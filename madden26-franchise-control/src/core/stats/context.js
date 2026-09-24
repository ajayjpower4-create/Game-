// Builds the per-game context every stat module works from: who played for
// each team, what the team did (plays, dropbacks, sacks, penalties), and the
// recorded stat lines for each player.

import { side as sideOf, SNAP_SHARE, STARTERS } from '../positions.js';

export const rating = (player, key, fallback = 65) => {
  const v = player && player.ratings ? player.ratings[key] : undefined;
  return typeof v === 'number' && v > 0 ? v : fallback;
};

export function teamLine(league, gameId, teamId) {
  return (league.teamGameStats[gameId] && league.teamGameStats[gameId][teamId]) || {};
}

// Players that count for a team in a game: anyone with a recorded stat line
// for that game, plus the team's current roster so backups who did not show
// up in the box score still get snap counts.
export function participants(league, gameId, teamId) {
  const entries = league.playerGameStats[gameId] || {};
  const map = new Map();
  for (const entry of Object.values(entries)) {
    const player = league.players[entry.playerId];
    if (!player) continue;
    const team = entry.teamId || player.teamId;
    if (team !== teamId) continue;
    map.set(entry.playerId, { player, entry, played: true });
  }
  for (const player of Object.values(league.players)) {
    if (player.teamId !== teamId || map.has(player.playerId)) continue;
    if (player.contractStatus === 'PracticeSquad') continue;
    if (player.injury && player.injury.status === 'Injured' && !(league.playerGameStats[gameId] || {})[player.playerId]) continue;
    map.set(player.playerId, { player, entry: null, played: false });
  }
  return [...map.values()];
}

export function offense(line) {
  return (line && line.entry && line.entry.offense) || {};
}
export function defense(line) {
  return (line && line.entry && line.entry.defense) || {};
}
export function oline(line) {
  return (line && line.entry && line.entry.oline) || {};
}

// Depth order at a position: recorded snaps first, then box-score involvement,
// then overall rating.
export function depthOrder(people, position) {
  return people
    .filter((x) => x.player.position === position)
    .sort((a, b) => {
      const sa = a.entry && a.entry.snapsRecorded ? a.entry.snaps : -1;
      const sb = b.entry && b.entry.snapsRecorded ? b.entry.snaps : -1;
      if (sa !== sb) return sb - sa;
      const ia = involvement(a);
      const ib = involvement(b);
      if (ia !== ib) return ib - ia;
      return (b.player.overall || 0) - (a.player.overall || 0);
    });
}

export function involvement(x) {
  const o = offense(x);
  const d = defense(x);
  return (o.PASSATTEMPTS || 0) + (o.RUSHATTEMPTS || 0) + (o.RECEIVECATCHES || 0) * 2 + (o.RECEIVEDROPS || 0) + (d.DEFTACKLES || 0) + (d.ASSDEFTACKLES || 0) + (d.DLINESACKS || 0) * 2 + (d.DEFPASSDEFLECTIONS || 0) + (d.DSECINTS || 0) * 2;
}

export function teamContext(league, gameId, teamId, opponentId) {
  const people = participants(league, gameId, teamId);
  const line = teamLine(league, gameId, teamId);
  const oppLine = teamLine(league, gameId, opponentId);
  const anyRecordedSnaps = people.some((x) => x.entry && x.entry.snapsRecorded);

  let passAttempts = line.PASSATTEMPTS || 0;
  let rushAttempts = line.RUSHATTEMPTS || 0;
  let sacksAllowed = line.SACKSALLOWED || 0;
  let passCompleted = line.PASSCOMPLETED || 0;
  // Fill from player lines when the team line is missing pieces.
  const sums = { pa: 0, pc: 0, ra: 0, sk: 0, ints: 0, drops: 0, catches: 0, yac: 0 };
  for (const x of people) {
    const o = offense(x);
    sums.pa += o.PASSATTEMPTS || 0;
    sums.pc += o.PASSCOMPLETED || 0;
    sums.ra += o.RUSHATTEMPTS || 0;
    sums.sk += o.PASSSACKED || 0;
    sums.ints += o.PASSINTS || 0;
    sums.drops += o.RECEIVEDROPS || 0;
    sums.catches += o.RECEIVECATCHES || 0;
    sums.yac += o.RECEIVEYARDSAFTER || 0;
  }
  if (!passAttempts) passAttempts = sums.pa;
  if (!rushAttempts) rushAttempts = sums.ra;
  if (!sacksAllowed) sacksAllowed = sums.sk || (oppLine.SACKS || 0);
  if (!passCompleted) passCompleted = sums.pc || sums.catches;

  const dropbacks = passAttempts + sacksAllowed;
  let offPlays = passAttempts + rushAttempts + sacksAllowed;
  if (anyRecordedSnaps) {
    const maxOff = Math.max(0, ...people.filter((x) => sideOf(x.player.position) === 'offense' && x.entry && x.entry.snapsRecorded).map((x) => x.entry.snaps));
    if (maxOff > 0) offPlays = Math.max(offPlays, maxOff);
  }
  if (!offPlays) offPlays = 60;

  // Run blocking, measured: yards gained before the first defender got a hand
  // on the runner. Madden records both halves of every carry.
  let carries = 0;
  let ybc = 0;
  let brokenTackles = 0;
  for (const x of people) {
    const o = offense(x);
    if (!o.RUSHATTEMPTS) continue;
    carries += o.RUSHATTEMPTS;
    brokenTackles += o.RUSHBROKENTACKLES || 0;
    if (typeof o.RUSHYARDSAFTER1STHIT === 'number') ybc += (o.RUSHYARDS || 0) - o.RUSHYARDSAFTER1STHIT;
    else ybc += (o.RUSHYARDS || 0) * 0.45; // exports without the split: typical share
  }

  // The passer who took most of the dropbacks; his release and escapability
  // shape every pressure number.
  let qb = null;
  let qbAtt = -1;
  for (const x of people) {
    const att = offense(x).PASSATTEMPTS || 0;
    if (att > qbAtt && (x.player.position === 'QB' || att > 0)) { qb = x.player; qbAtt = att; }
  }
  if (!qb) qb = (people.find((x) => x.player.position === 'QB') || {}).player || null;

  return {
    teamId,
    opponentId,
    people,
    line,
    oppLine,
    anyRecordedSnaps,
    passAttempts,
    passCompleted,
    rushAttempts,
    sacksAllowed,
    dropbacks,
    offPlays,
    interceptions: line.PASSINTS || sums.ints,
    drops: sums.drops,
    catches: sums.catches,
    yac: sums.yac,
    penalties: line.PENALTIES || 0,
    penaltyYards: line.PENALTYYARDS || 0,
    run: { carries, yardsBeforeContact: Math.max(0, ybc), brokenTackles },
    qb,
  };
}

// Estimated share of a team's plays a player was on the field for, when the
// game did not record it. Uses the depth chart the box score implies.
export function estimatedSnapShare(people, x) {
  const pos = x.player.position;
  const order = depthOrder(people, pos);
  const idx = order.findIndex((y) => y.player.playerId === x.player.playerId);
  const shares = SNAP_SHARE[pos] || [0.5, 0.2];
  const share = idx >= 0 && idx < shares.length ? shares[idx] : 0;
  return { share, depth: idx + 1, starters: STARTERS[pos] || 1 };
}

export function snapCount(ctx, x, plays) {
  if (x.entry && x.entry.snapsRecorded) return { snaps: x.entry.snaps, recorded: true };
  const { share } = estimatedSnapShare(ctx.people, x);
  return { snaps: Math.round(plays * share), recorded: false };
}
