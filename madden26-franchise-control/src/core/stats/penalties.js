// Penalties per player for one team in one game.
//
// Madden records only the team's penalty count and yards. The tool charges
// each flag to a player using how often each position draws flags, the
// player's awareness, and how many snaps he played, and picks a penalty type
// whose yardage adds up to the recorded team total. The other systems steer
// it: a blocker who kept getting beaten is the one who grabs (holding), a
// corner giving up catches draws the interference and holding calls, and a
// rusher hitting the quarterback risks roughing the passer. Tracked
// penalties replace this completely.

import { makeRng, apportion } from '../rng.js';
import { rating, snapCount, defense } from './context.js';
import { side as sideOf } from '../positions.js';

const POSITION_RATE = { LT: 3.4, RT: 3.4, LG: 2.4, RG: 2.4, C: 1.6, TE: 1.6, WR: 1.4, HB: 0.6, FB: 0.5, QB: 0.45, LE: 2.2, RE: 2.2, DT: 1.7, LOLB: 1.4, ROLB: 1.4, MLB: 1.0, CB: 2.6, SS: 1.3, FS: 1.1, K: 0.05, P: 0.1, LS: 0.15 };

const TYPES = {
  OL: [['False Start', 5, 45], ['Offensive Holding', 10, 42], ['Illegal Formation', 5, 5], ['Ineligible Man Downfield', 5, 5], ['Facemask', 15, 2], ['Unnecessary Roughness', 15, 1]],
  WR: [['Offensive Pass Interference', 10, 35], ['False Start', 5, 30], ['Offensive Holding', 10, 25], ['Illegal Shift', 5, 7], ['Taunting', 15, 3]],
  TE: [['Offensive Holding', 10, 40], ['False Start', 5, 35], ['Offensive Pass Interference', 10, 20], ['Illegal Formation', 5, 5]],
  RB: [['Offensive Holding', 10, 50], ['False Start', 5, 30], ['Illegal Motion', 5, 15], ['Facemask', 15, 5]],
  QB: [['Intentional Grounding', 10, 45], ['Delay of Game', 5, 45], ['Illegal Forward Pass', 5, 10]],
  DL: [['Offside', 5, 40], ['Neutral Zone Infraction', 5, 20], ['Encroachment', 5, 12], ['Roughing the Passer', 15, 12], ['Illegal Use of Hands', 10, 8], ['Facemask', 15, 5], ['Unnecessary Roughness', 15, 3]],
  LB: [['Defensive Holding', 5, 25], ['Unnecessary Roughness', 15, 20], ['Offside', 5, 18], ['Facemask', 15, 12], ['Roughing the Passer', 15, 12], ['Illegal Contact', 5, 8], ['Defensive Pass Interference', 0, 5]],
  DB: [['Defensive Pass Interference', 0, 34], ['Defensive Holding', 5, 28], ['Illegal Contact', 5, 15], ['Unnecessary Roughness', 15, 10], ['Facemask', 15, 8], ['Taunting', 15, 5]],
  ST: [['Offensive Holding', 10, 50], ['Running Into the Kicker', 5, 25], ['Roughing the Kicker', 15, 10], ['Illegal Block in the Back', 10, 15]],
};

function typeGroup(pos) {
  if (['LT', 'LG', 'C', 'RG', 'RT'].includes(pos)) return 'OL';
  if (pos === 'WR') return 'WR';
  if (pos === 'TE') return 'TE';
  if (pos === 'HB' || pos === 'FB') return 'RB';
  if (pos === 'QB') return 'QB';
  if (['LE', 'RE', 'DT'].includes(pos)) return 'DL';
  if (['LOLB', 'MLB', 'ROLB'].includes(pos)) return 'LB';
  if (['CB', 'FS', 'SS'].includes(pos)) return 'DB';
  return 'ST';
}

export function penaltiesForTeam({ league, gameId, ctx, oppCtx, overrides = {}, blocking = null, passRush = null }) {
  const rng = makeRng('penalties', league.leagueId, gameId, ctx.teamId);
  const tracked = overrides.penalties || null;

  const people = ctx.people.map((x) => {
    const sd = sideOf(x.player.position);
    const plays = sd === 'offense' ? ctx.offPlays : sd === 'defense' ? oppCtx.offPlays : 12;
    const { snaps } = snapCount(ctx, x, plays);
    return { x, playerId: x.player.playerId, name: x.player.fullName, position: x.player.position, snapPct: plays ? Math.min(1, snaps / plays) : 0 };
  });
  // What the other systems saw each player do.
  const beaten = new Map((blocking ? blocking.blockers : []).map((b) => [b.playerId, b.pressuresAllowed + 0.5 * (b.runRepsLost || 0) / 4]));
  const hits = new Map((passRush || []).map((r) => [r.playerId, r.hits + r.sacks]));
  const lean = (p) => {
    const g = typeGroup(p.position);
    if (g === 'OL' || g === 'TE' || g === 'RB') return 1 + Math.min(1.2, 0.18 * (beaten.get(p.playerId) || 0));
    if (g === 'DB') return 1 + Math.min(1, 0.12 * (defense(p.x).CTHALLOWED || 0));
    if (g === 'DL' || g === 'LB') return 1 + Math.min(0.6, 0.12 * (hits.get(p.playerId) || 0));
    return 1;
  };
  // Tilt the flag type toward what that player was doing wrong.
  const typeTable = (p) => {
    const g = typeGroup(p.position);
    const table = TYPES[g];
    const bump = (name, by) => table.map(([t, y, w]) => [t, y, t === name ? w * by : w]);
    if (g === 'OL' || g === 'TE' || g === 'RB') return bump('Offensive Holding', 1 + 0.25 * (beaten.get(p.playerId) || 0));
    if (g === 'DB') return bump('Defensive Pass Interference', 1 + 0.15 * (defense(p.x).CTHALLOWED || 0));
    if (g === 'DL' || g === 'LB') return bump('Roughing the Passer', 1 + 0.3 * (hits.get(p.playerId) || 0));
    return table;
  };

  let flags = []; // {playerId, type, yards}
  let source;
  if (tracked) {
    for (const [playerId, list] of Object.entries(tracked)) for (const f of list) flags.push({ playerId, type: f.type, yards: f.yards });
    source = 'tracked';
  } else {
    const count = ctx.penalties || 0;
    const weights = people.map((p) => (POSITION_RATE[p.position] || 0.5) * (1 + Math.max(0, 72 - rating(p.x.player, 'awareness')) / 60) * (p.snapPct > 0 ? 0.15 + p.snapPct : 0.02) * lean(p));
    const dist = apportion(count, weights, rng);
    dist.forEach((n, i) => {
      for (let k = 0; k < n; k++) {
        const table = typeTable(people[i]);
        const [type, yards] = rng.weighted(table.map(([t, y, w]) => ({ item: [t, y], weight: w })));
        flags.push({ playerId: people[i].playerId, type, yards, spot: yards === 0 });
      }
    });
    // Make the yards add up to the recorded team total.
    const targetYards = ctx.penaltyYards || 0;
    if (flags.length) {
      const spots = flags.filter((f) => f.spot);
      let fixed = flags.filter((f) => !f.spot).reduce((s, f) => s + f.yards, 0);
      let remaining = targetYards - fixed;
      if (spots.length) {
        const share = apportion(Math.max(spots.length * 3, remaining), spots.map(() => 1), rng);
        spots.forEach((f, i) => { f.yards = Math.max(1, Math.min(55, share[i])); });
      } else {
        // No spot fouls: nudge fixed-yard flags so the total matches.
        let diff = remaining;
        let guard = 0;
        while (diff !== 0 && guard++ < 200) {
          const f = rng.pick(flags);
          const step = Math.sign(diff) * Math.min(Math.abs(diff), 5);
          const next = f.yards + step;
          if (next >= 1 && next <= 25) { f.yards = next; diff -= step; }
        }
      }
      fixed = flags.reduce((s, f) => s + f.yards, 0);
    }
    source = 'reconstructed';
  }

  const byPlayer = new Map();
  for (const f of flags) {
    const p = people.find((q) => q.playerId === f.playerId) || { playerId: f.playerId, name: (league.players[f.playerId] || {}).fullName || f.playerId, position: (league.players[f.playerId] || {}).position || '?' };
    const row = byPlayer.get(f.playerId) || { playerId: p.playerId, name: p.name, position: p.position, penalties: 0, yards: 0, types: [] };
    row.penalties += 1;
    row.yards += f.yards;
    row.types.push({ type: f.type, yards: f.yards });
    byPlayer.set(f.playerId, row);
  }
  const rows = [...byPlayer.values()].map((r) => ({ ...r, source: { penalties: source } })).sort((a, b) => b.penalties - a.penalties || b.yards - a.yards);
  return {
    teamId: ctx.teamId,
    summary: { penalties: flags.length, yards: flags.reduce((s, f) => s + f.yards, 0), recordedPenalties: ctx.penalties || 0, recordedYards: ctx.penaltyYards || 0, source },
    players: rows,
  };
}
