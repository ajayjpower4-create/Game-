// The full box score for one game, exactly as Madden recorded it: every
// player's passing, rushing, receiving, defense, kicking, punting and return
// line, the team stat comparison, and (when the save has the scoring log) the
// score by quarter.

import { buildScoringEvents } from './highlights.js';
import { scoringBreakdown } from './export-plays.js';

const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);

function clock(sec) {
  if (!Number.isFinite(sec) || sec <= 0) return null;
  return `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
}

// Points per quarter from the scoring log. Shown only when the quarters add
// up to the final score exactly.
export function lineScore(league, gameId) {
  const g = league.games[gameId];
  const gp = league.gamePlays && league.gamePlays[gameId];
  if (!g || !gp || !gp.scoring || !gp.scoring.length) return null;
  const events = buildScoringEvents(g, gp);
  const quarters = Math.max(4, ...events.map((e) => e.quarter || 0));
  const rows = { home: Array(quarters).fill(0), away: Array(quarters).fill(0) };
  for (const e of events) rows[e.side][Math.max(1, e.quarter) - 1] += e.points + (e.conversion || 0);
  const total = (r) => r.reduce((a, b) => a + b, 0);
  if (total(rows.home) !== g.homeScore || total(rows.away) !== g.awayScore) return null;
  return { labels: Array.from({ length: quarters }, (_, i) => (i < 4 ? `Q${i + 1}` : quarters === 5 ? 'OT' : `OT${i - 3}`)), home: rows.home, away: rows.away, overtime: quarters > 4 };
}

export function boxScore(league, gameId) {
  const g = league.games[gameId];
  if (!g || g.status !== 'played') return null;
  const lines = Object.values(league.playerGameStats[gameId] || {});
  const who = (e) => {
    const p = league.players[e.playerId];
    return { playerId: e.playerId, name: p ? p.fullName : 'Unknown player', position: p ? p.position : '' };
  };
  const teams = {};
  for (const teamId of [g.awayTeamId, g.homeTeamId]) {
    const mine = lines.filter((e) => (e.teamId || (league.players[e.playerId] || {}).teamId) === teamId);
    const o = (e) => e.offense || {};
    const d = (e) => e.defense || {};
    const k = (e) => e.kicking || {};
    const r = (e) => e.returns || {};
    const by = (list, key) => list.sort((a, b) => (b[key] || 0) - (a[key] || 0));
    teams[teamId] = {
      passing: by(mine.filter((e) => n(o(e).PASSATTEMPTS) > 0).map((e) => ({ ...who(e), comp: n(o(e).PASSCOMPLETED), att: n(o(e).PASSATTEMPTS), yards: n(o(e).PASSYARDS), td: n(o(e).PASSTDS), int: n(o(e).PASSINTS), sacked: n(o(e).PASSSACKED), long: n(o(e).PASSLONGEST), pct: pct(n(o(e).PASSCOMPLETED), n(o(e).PASSATTEMPTS)), ypa: n(o(e).PASSATTEMPTS) ? Math.round((n(o(e).PASSYARDS) / n(o(e).PASSATTEMPTS)) * 10) / 10 : null, rating: passerRating(o(e)) })), 'yards'),
      rushing: by(mine.filter((e) => n(o(e).RUSHATTEMPTS) > 0).map((e) => ({ ...who(e), car: n(o(e).RUSHATTEMPTS), yards: n(o(e).RUSHYARDS), avg: Math.round((n(o(e).RUSHYARDS) / n(o(e).RUSHATTEMPTS)) * 10) / 10, td: n(o(e).RUSHTDS), long: n(o(e).RUSHLONGEST), brokenTackles: n(o(e).RUSHBROKENTACKLES), afterContact: typeof o(e).RUSHYARDSAFTER1STHIT === 'number' ? o(e).RUSHYARDSAFTER1STHIT : null, fumbles: n(o(e).RUSHFUMBLES) })), 'yards'),
      receiving: by(mine.filter((e) => n(o(e).RECEIVECATCHES) > 0 || n(o(e).RECEIVEDROPS) > 0).map((e) => ({ ...who(e), rec: n(o(e).RECEIVECATCHES), yards: n(o(e).RECEIVEYARDS), avg: n(o(e).RECEIVECATCHES) ? Math.round((n(o(e).RECEIVEYARDS) / n(o(e).RECEIVECATCHES)) * 10) / 10 : 0, td: n(o(e).RECEIVETDS), long: n(o(e).RECEIVELONGEST), yac: n(o(e).RECEIVEYARDSAFTER), drops: n(o(e).RECEIVEDROPS) })), 'yards'),
      defense: by(mine.filter((e) => e.defense && (n(d(e).DEFTACKLES) + n(d(e).ASSDEFTACKLES) + n(d(e).DLINESACKS) + n(d(e).DSECINTS) + n(d(e).DEFPASSDEFLECTIONS) + n(d(e).DLINEFORCEDFUMBLES) + n(d(e).DLINEFUMBLERECOVERIES)) > 0).map((e) => ({ ...who(e), tackles: n(d(e).DEFTACKLES), assists: n(d(e).ASSDEFTACKLES), tfl: n(d(e).DEFTACKLESFORLOSS), sacks: n(d(e).DLINESACKS) + n(d(e).DLINEHALFSACK) * 0.5, int: n(d(e).DSECINTS), pd: n(d(e).DEFPASSDEFLECTIONS), ff: n(d(e).DLINEFORCEDFUMBLES), fr: n(d(e).DLINEFUMBLERECOVERIES), td: n(d(e).DSECINTTDS) || n(d(e).DEFTDS), bigHits: n(d(e).BIGHITS) })), 'tackles'),
      kicking: mine.filter((e) => n(k(e).KICKFGATTEMPTS) + n(k(e).KICKEPATTEMPTS) > 0).map((e) => ({ ...who(e), fgMade: n(k(e).KICKFGMADE), fgAtt: n(k(e).KICKFGATTEMPTS), long: n(k(e).KICKFGLONGEST), xpMade: n(k(e).KICKEPMADE), xpAtt: n(k(e).KICKEPATTEMPTS), points: n(k(e).KICKFGMADE) * 3 + n(k(e).KICKEPMADE) })),
      punting: mine.filter((e) => n(k(e).PUNTATTEMPTS) > 0).map((e) => ({ ...who(e), punts: n(k(e).PUNTATTEMPTS), yards: n(k(e).PUNTYARDS), avg: Math.round((n(k(e).PUNTYARDS) / n(k(e).PUNTATTEMPTS)) * 10) / 10, net: k(e).PUNTNETYARDS != null ? Math.round((n(k(e).PUNTNETYARDS) / n(k(e).PUNTATTEMPTS)) * 10) / 10 : null, long: n(k(e).PUNTLONGEST), in20: n(k(e).PUNTIN20) })),
      returns: mine.filter((e) => n(r(e).KRETATTEMPTS) + n(r(e).PRETATTEMPTS) > 0).map((e) => ({ ...who(e), kr: n(r(e).KRETATTEMPTS), krYards: n(r(e).KRETYARDS), krLong: n(r(e).KRETLONGEST), krTd: n(r(e).KRETTDS), pr: n(r(e).PRETATTEMPTS), prYards: n(r(e).PRETYARDS), prLong: n(r(e).PRETLONGEST), prTd: n(r(e).PRETTDS) })),
    };
  }
  // Team comparison: only rows the save or export actually has.
  const T = (id) => (league.teamGameStats[gameId] || {})[id] || {};
  const A = T(g.awayTeamId);
  const H = T(g.homeTeamId);
  const sumP = (id, f) => teams[id].passing.reduce((s, x) => s + x[f], 0);
  const row = (label, a, h, { higherIsBetter = true, fmt = null } = {}) => (a == null && h == null ? null : { label, away: a, home: h, awayText: fmt ? fmt(a) : a, homeText: fmt ? fmt(h) : h, better: a == null || h == null || a === h ? null : (a > h) === higherIsBetter ? 'away' : 'home' });
  const has = (x, f) => (typeof x[f] === 'number' ? x[f] : null);
  const conv = (c, att) => (att == null ? null : `${c || 0}/${att}`);
  const teamStats = [
    row('Total yards', has(A, 'OFFYARDS') ?? has(A, 'TOTALYARDS'), has(H, 'OFFYARDS') ?? has(H, 'TOTALYARDS')),
    row('Passing yards', has(A, 'OFFPASSYARDS'), has(H, 'OFFPASSYARDS')),
    row('Rushing yards', has(A, 'OFFRUSHYARDS'), has(H, 'OFFRUSHYARDS')),
    row('Completions / attempts', sumP(g.awayTeamId, 'att') || null, sumP(g.homeTeamId, 'att') || null, { fmt: (v) => null }),
    row('First downs', has(A, 'FIRSTDOWNS'), has(H, 'FIRSTDOWNS')),
    row('Third downs', has(A, 'THIRDDOWNS') != null ? pct(A.THIRDDOWNCONV, A.THIRDDOWNS) : null, has(H, 'THIRDDOWNS') != null ? pct(H.THIRDDOWNCONV, H.THIRDDOWNS) : null, { fmt: null }),
    row('Fourth downs', has(A, 'FOURTHDOWNS') != null ? pct(A.FOURTHDOWNCONV, A.FOURTHDOWNS) : null, has(H, 'FOURTHDOWNS') != null ? pct(H.FOURTHDOWNCONV, H.FOURTHDOWNS) : null),
    row('Red zone touchdowns', has(A, 'OFFREDZONES') != null ? pct(A.OFFREDZONETDS, A.OFFREDZONES) : null, has(H, 'OFFREDZONES') != null ? pct(H.OFFREDZONETDS, H.OFFREDZONES) : null),
    row('Turnovers', has(A, 'GIVEAWAYS'), has(H, 'GIVEAWAYS'), { higherIsBetter: false }),
    row('Sacks by the defense', has(A, 'SACKS'), has(H, 'SACKS')),
    row('Penalties', has(A, 'PENALTIES'), has(H, 'PENALTIES'), { higherIsBetter: false }),
    row('Penalty yards', has(A, 'PENALTYYARDS'), has(H, 'PENALTYYARDS'), { higherIsBetter: false }),
    row('Time of possession', has(A, 'POSSESSIONTIME') || null, has(H, 'POSSESSIONTIME') || null, { fmt: clock }),
  ].filter(Boolean);
  // Show conversions as "made/tried" next to the rate.
  for (const r of teamStats) {
    if (r.label === 'Completions / attempts') { r.awayText = conv(sumP(g.awayTeamId, 'comp'), sumP(g.awayTeamId, 'att')); r.homeText = conv(sumP(g.homeTeamId, 'comp'), sumP(g.homeTeamId, 'att')); r.better = null; }
    if (r.label === 'Third downs') { r.awayText = conv(A.THIRDDOWNCONV, A.THIRDDOWNS); r.homeText = conv(H.THIRDDOWNCONV, H.THIRDDOWNS); }
    if (r.label === 'Fourth downs') { r.awayText = conv(A.FOURTHDOWNCONV, A.FOURTHDOWNS); r.homeText = conv(H.FOURTHDOWNCONV, H.FOURTHDOWNS); }
    if (r.label === 'Red zone touchdowns') { r.awayText = conv(A.OFFREDZONETDS, A.OFFREDZONES); r.homeText = conv(H.OFFREDZONETDS, H.OFFREDZONES); }
  }
  return { gameId, teams, teamStats, lineScore: lineScore(league, gameId), breakdown: scoringBreakdown(league, gameId) };
}

// NFL passer rating.
export function passerRating(o) {
  const att = n(o.PASSATTEMPTS);
  if (!att) return null;
  const c = (x) => Math.max(0, Math.min(2.375, x));
  const a = c((n(o.PASSCOMPLETED) / att - 0.3) * 5);
  const b = c((n(o.PASSYARDS) / att - 3) * 0.25);
  const t = c((n(o.PASSTDS) / att) * 20);
  const i = c(2.375 - (n(o.PASSINTS) / att) * 25);
  return Math.round(((a + b + t + i) / 6) * 1000) / 10;
}
