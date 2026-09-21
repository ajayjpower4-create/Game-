// Missed tackles for one team's defense in one game.
//
// Madden records tackles and assists for each defender, and broken tackles for
// every ball carrier on the other side. Every broken tackle is a missed tackle
// by somebody, so the tool starts from the opponent's recorded broken tackles
// (plus a small yards-after-catch allowance), and charges them to defenders by
// how often they were in on tackles and how good they are at making them.
// Tracked missed tackles replace this.

import { makeRng, apportion } from '../rng.js';
import { DEFENSE } from '../positions.js';
import { rating, defense, offense, snapCount } from './context.js';

const MISS_FACTOR = { CB: 1.35, FS: 1.2, SS: 1.15, LOLB: 1.0, ROLB: 1.0, MLB: 0.95, LE: 0.7, RE: 0.7, DT: 0.55 };

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
  const yacMisses = Math.round(oppCtx.yac / 55);
  const teamMissed = tracked ? Object.values(tracked).reduce((a, b) => a + b, 0) : brokenTackles + yacMisses;

  const weights = defenders.map((r) => (r.tackles + r.assists * 0.5 + 0.6) * Math.exp(-(rating(r.x.player, 'tackle') - 68) / 13) * (MISS_FACTOR[r.position] || 0.8) * (r.snaps > 0 ? 1 : 0.1));
  const dist = tracked ? null : apportion(teamMissed, weights, rng);

  const rows = defenders.map((r, i) => {
    const missed = tracked ? tracked[r.playerId] || 0 : dist[i];
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
      tackles: rows.reduce((s, r) => s + r.tackles, 0),
      assists: rows.reduce((s, r) => s + r.assists, 0),
      source: tracked ? 'tracked' : 'reconstructed (from recorded broken tackles)',
    },
    players: rows,
  };
}
