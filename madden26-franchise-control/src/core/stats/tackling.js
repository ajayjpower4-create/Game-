// Missed tackles for one team's defense in one game.
//
// Madden records tackles and assists for each defender, and broken tackles for
// every ball carrier on the other side. Every broken tackle is a missed tackle
// by somebody. Misses on runs come from the opponent's recorded broken
// tackles and land mostly on the front seven, the players who meet runners
// first. Misses after the catch are estimated from yards after catch beyond
// what a normal catch gives, and land mostly on the defensive backs and
// linebackers who gave up catches. Within each, a defender is charged by how
// often he was around the ball and how well he tackles.
// Tracked missed tackles replace this.

import { makeRng, apportion } from '../rng.js';
import { DEFENSE } from '../positions.js';
import { rating, defense, offense, snapCount } from './context.js';

// Who is in position to miss, on runs and after catches.
const RUN_FACTOR = { MLB: 1.3, LOLB: 1.15, ROLB: 1.15, SS: 1.05, DT: 0.9, LE: 0.85, RE: 0.85, FS: 0.8, CB: 0.7 };
const PASS_FACTOR = { CB: 1.45, FS: 1.2, SS: 1.2, MLB: 0.95, LOLB: 0.8, ROLB: 0.8, LE: 0.2, RE: 0.2, DT: 0.12 };
const YAC_PER_CATCH = 4.5;

export function tacklingForTeam({ league, gameId, ctx, oppCtx, overrides = {} }) {
  const rng = makeRng('tackling', league.leagueId, gameId, ctx.teamId);
  const tracked = overrides.missedTackles || null;

  const defenders = ctx.people
    .filter((x) => DEFENSE.includes(x.player.position) || defense(x).DEFTACKLES > 0)
    .map((x) => {
      const d = defense(x);
      const { snaps, recorded } = snapCount(ctx, x, oppCtx.offPlays);
      return {
        x,
        playerId: x.player.playerId,
        name: x.player.fullName,
        position: x.player.position,
        snaps,
        snapsRecorded: recorded,
        tackles: d.DEFTACKLES || 0,
        assists: d.ASSDEFTACKLES || 0,
        tfl: d.DEFTACKLESFORLOSS || 0,
        bigHits: d.BIGHITS || 0,
        sacks: d.DLINESACKS || 0,
        forcedFumbles: d.DLINEFORCEDFUMBLES || 0,
        catchesAllowed: d.CTHALLOWED || 0,
        deflections: d.DEFPASSDEFLECTIONS || 0,
      };
    })
    .filter((r) => r.snaps > 0 || r.tackles > 0 || r.assists > 0);

  // Broken tackles by the opponent's ball carriers are recorded.
  let brokenTackles = 0;
  for (const x of oppCtx.people) brokenTackles += offense(x).RUSHBROKENTACKLES || 0;
  const yacMisses = Math.round(Math.max(0, oppCtx.yac - YAC_PER_CATCH * oppCtx.catches) / 16 + oppCtx.catches * 0.06);
  const teamMissed = tracked ? Object.values(tracked).reduce((a, b) => a + b, 0) : brokenTackles + yacMisses;

  const skill = (r) => Math.exp(-(rating(r.x.player, 'tackle') - 68) / 13) * (r.snaps > 0 ? 1 : 0.1);
  const runW = defenders.map((r) => (r.tackles + r.assists * 0.5 + 0.6) * (RUN_FACTOR[r.position] || 0.6) * skill(r));
  const passW = defenders.map((r) => (r.catchesAllowed * 1.2 + r.tackles * 0.5 + 0.4) * (PASS_FACTOR[r.position] || 0.4) * skill(r));
  const runDist = tracked ? null : apportion(brokenTackles, runW, rng);
  const passDist = tracked ? null : apportion(yacMisses, passW, rng);

  const rows = defenders.map((r, i) => {
    const missed = tracked ? tracked[r.playerId] || 0 : runDist[i] + passDist[i];
    const attempts = r.tackles + r.assists + missed;
    return {
      playerId: r.playerId,
      name: r.name,
      position: r.position,
      snaps: r.snaps,
      tackles: r.tackles,
      assists: r.assists,
      tacklesForLoss: r.tfl,
      bigHits: r.bigHits,
      sacks: r.sacks,
      forcedFumbles: r.forcedFumbles,
      catchesAllowed: r.catchesAllowed,
      deflections: r.deflections,
      missedTackles: missed,
      missedRun: tracked ? null : runDist[i],
      missedPass: tracked ? null : passDist[i],
      tackleAttempts: attempts,
      missRate: attempts ? Math.round((missed / attempts) * 1000) / 10 : 0,
      source: { tackles: 'recorded', missedTackles: tracked ? 'tracked' : 'reconstructed', snaps: r.snapsRecorded ? 'recorded' : 'reconstructed' },
    };
  });
  rows.sort((a, b) => b.missedTackles - a.missedTackles || b.tackles - a.tackles);
  return {
    teamId: ctx.teamId,
    summary: {
      missedTackles: teamMissed,
      brokenTacklesAllowed: brokenTackles,
      missedOnRuns: tracked ? null : brokenTackles,
      missedAfterCatch: tracked ? null : yacMisses,
      tackles: rows.reduce((s, r) => s + r.tackles, 0),
      assists: rows.reduce((s, r) => s + r.assists, 0),
      source: tracked ? 'tracked' : 'reconstructed (runs: recorded broken tackles; after the catch: yards after catch)',
    },
    players: rows,
  };
}
