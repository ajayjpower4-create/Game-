// Targets and drops for one team in one game.
//
// Madden records catches and drops for every receiver. Targets it does not
// keep per game, so the tool rebuilds them: every catch and drop was a target,
// and the team's remaining incompletions (throwaways, overthrows, breakups,
// picks) are shared out by how involved each receiver was. When the export
// carries a catch percentage, that is used instead. Tracked targets win.

import { makeRng, apportion } from '../rng.js';
import { RECEIVERS } from '../positions.js';
import { rating, offense, snapCount } from './context.js';

export function receivingForTeam({ league, gameId, ctx, overrides = {} }) {
  const rng = makeRng('receiving', league.leagueId, gameId, ctx.teamId);
  const tracked = overrides.receiving || {};
  const receivers = ctx.people
    .filter((x) => RECEIVERS.includes(x.player.position) || offense(x).RECEIVECATCHES > 0 || offense(x).RECEIVEDROPS > 0)
    .map((x) => {
      const o = offense(x);
      const { snaps, recorded } = snapCount(ctx, x, ctx.offPlays);
      return {
        x,
        playerId: x.player.playerId,
        name: x.player.fullName,
        position: x.player.position,
        snaps,
        snapsRecorded: recorded,
        catches: o.RECEIVECATCHES || 0,
        drops: o.RECEIVEDROPS || 0,
        yards: o.RECEIVEYARDS || 0,
        tds: o.RECEIVETDS || 0,
        yac: o.RECEIVEYARDSAFTER || 0,
        longest: o.RECEIVELONGEST || 0,
        catchPct: o.RECCATCHPCT || 0,
      };
    })
    .filter((r) => r.catches > 0 || r.drops > 0 || r.snaps > 0);

  const incompletions = Math.max(0, ctx.passAttempts - ctx.passCompleted);
  const teamDrops = receivers.reduce((s, r) => s + r.drops, 0);
  const otherIncompletions = Math.max(0, incompletions - teamDrops);
  const weights = receivers.map((r) => (r.catches + r.drops + 0.35) * (1 + Math.max(0, rating(r.x.player, 'deepRoute') - 70) / 60) * (r.snaps > 0 ? 1 : 0.2));
  const extra = apportion(otherIncompletions, weights, rng);

  const rows = receivers.map((r, i) => {
    let targets;
    let source;
    if (tracked[r.playerId]) {
      targets = Math.max(tracked[r.playerId].targets, r.catches);
      source = 'tracked';
    } else if (r.catchPct > 0 && r.catches > 0) {
      targets = Math.max(r.catches + r.drops, Math.round(r.catches / (r.catchPct / 100)));
      source = 'recorded';
    } else {
      targets = r.catches + r.drops + extra[i];
      source = 'reconstructed';
    }
    const drops = tracked[r.playerId] ? Math.max(r.drops, tracked[r.playerId].drops) : r.drops;
    return {
      playerId: r.playerId,
      name: r.name,
      position: r.position,
      snaps: r.snaps,
      targets,
      catches: r.catches,
      drops,
      yards: r.yards,
      tds: r.tds,
      yac: r.yac,
      longest: r.longest,
      catchRate: targets ? Math.round((r.catches / targets) * 1000) / 10 : 0,
      dropRate: r.catches + drops ? Math.round((drops / (r.catches + drops)) * 1000) / 10 : 0,
      yardsPerTarget: targets ? Math.round((r.yards / targets) * 10) / 10 : 0,
      source: { targets: source, drops: tracked[r.playerId] ? 'tracked' : 'recorded', catches: 'recorded', snaps: r.snapsRecorded ? 'recorded' : 'reconstructed' },
    };
  });
  rows.sort((a, b) => b.targets - a.targets || b.yards - a.yards);
  return {
    teamId: ctx.teamId,
    summary: {
      passAttempts: ctx.passAttempts,
      completions: ctx.passCompleted,
      targets: rows.reduce((s, r) => s + r.targets, 0),
      drops: rows.reduce((s, r) => s + r.drops, 0),
      dropRate: ctx.passAttempts ? Math.round((rows.reduce((s, r) => s + r.drops, 0) / ctx.passAttempts) * 1000) / 10 : 0,
    },
    players: rows,
  };
}
