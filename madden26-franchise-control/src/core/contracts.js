// Contracts and the salary cap, for every team and player in the league.
//
// Everything here is what Madden itself stores: each player's salary and
// prorated signing bonus for every year of his deal, the cap hit the game
// carries for him this season, and each team's cap room, dead money and
// rollover. Nothing is estimated. A Companion App export carries less (one
// salary, one bonus, the cap hit and release numbers, no year-by-year), so
// those columns stay empty rather than guessed.

import { positionRank } from './positions.js';

const ACTIVE = new Set(['Signed', 'Extended', 'Restructured', 'Expiring', 'PracticeSquad']);

// Calendar year of franchise season 0; contract year i of a deal whose current
// year is k falls in the season (current + i - k).
function seasonYear(league) {
  const cy = league.season && Number.isFinite(league.season.calendarYear) ? league.season.calendarYear : null;
  return cy;
}

export function contractRow(league, p) {
  const c = p.contract;
  const team = p.teamId ? league.teams[p.teamId] : null;
  const cy = seasonYear(league);
  const teamCap = team && team.cap ? team.cap.teamCap : null;
  const years = (c && c.years ? c.years : []).map((y) => ({ ...y, season: cy != null ? cy + (y.index - c.yearIndex) : null, current: y.index === c.yearIndex, done: y.index < c.yearIndex }));
  const draftYear = p.draft ? (p.draft.calendarYear || (cy != null && Number.isFinite(p.draft.year) && league.source === 'franchise' ? cy - (league.season.year || 0) + 1 + p.draft.year : null)) : null;
  return {
    playerId: p.playerId,
    name: p.fullName,
    position: p.position,
    teamId: p.teamId,
    age: p.age,
    overall: p.overall,
    devTrait: p.devTrait,
    yearsPro: p.yearsPro,
    status: c ? c.status : p.contractStatus,
    capHit: c ? c.capHit : null,
    capPct: c && teamCap ? Math.round((c.capHit / teamCap) * 1000) / 10 : null,
    salary: c ? c.salary : null,
    bonusProration: c && c.bonusProration != null ? c.bonusProration : null,
    signingBonus: c ? (c.totalBonus != null ? c.totalBonus : c.signingBonus ?? null) : null,
    length: c ? c.length : null,
    yearsLeft: c ? c.yearsLeft : null,
    contractYear: c && c.length ? `${Math.min(c.length, (c.yearIndex || 0) + 1)} of ${c.length}` : null,
    total: c && c.total != null ? c.total : null,
    averagePerYear: c && c.averagePerYear != null ? c.averagePerYear : null,
    remaining: c && c.remaining != null ? c.remaining : null,
    remainingBonus: c && c.remainingBonus != null ? c.remainingBonus : null,
    releaseSavings: c && c.releaseSavings != null ? c.releaseSavings : null,
    releasePenalty: c && c.releasePenalty != null ? c.releasePenalty : null,
    expiresAfter: c && c.length && cy != null ? cy + c.yearsLeft - 1 : null,
    lastYear: Boolean(c && c.length && c.yearsLeft === 1),
    extraYearOption: Boolean(c && c.extraYearOption),
    draftRound: p.draft ? p.draft.round : null,
    draftPick: p.draft ? p.draft.pick : null,
    draftYear,
    injured: Boolean(p.injury && p.injury.status === 'Injured'),
    years,
  };
}

function teamSummary(league, teamId, rows) {
  const t = league.teams[teamId];
  const mine = rows.filter((r) => r.teamId === teamId && ACTIVE.has(r.status));
  const top = mine.slice().sort((a, b) => (b.capHit || 0) - (a.capHit || 0))[0] || null;
  // Money already committed to future seasons, from the year-by-year deals.
  const commitments = [0, 1, 2, 3, 4].map((k) => mine.reduce((s, r) => {
    const cur = r.years.find((y) => y.current);
    if (!cur) return s;
    const y = r.years.find((x) => x.index === cur.index + k);
    return s + (y ? y.capHit : 0);
  }, 0));
  const hasYears = mine.some((r) => r.years.length);
  return {
    teamId,
    abbr: t.abbr,
    name: t.displayName,
    cap: t.cap || null,
    players: mine.length,
    activeCapHits: mine.reduce((s, r) => s + (r.capHit || 0), 0),
    topContract: top ? { playerId: top.playerId, name: top.name, position: top.position, capHit: top.capHit } : null,
    expiring: mine.filter((r) => r.lastYear).length,
    commitments: hasYears ? commitments : null,
    byPosition: Object.entries(mine.reduce((m, r) => { m[r.position] = (m[r.position] || 0) + (r.capHit || 0); return m; }, {})).map(([position, capHit]) => ({ position, capHit })).sort((a, b) => positionRank(a.position) - positionRank(b.position)),
  };
}

export function contractsReport(league, { teamId = null } = {}) {
  const rows = Object.values(league.players).filter((p) => p.contract).map((p) => contractRow(league, p));
  const signed = rows.filter((r) => r.teamId && ACTIVE.has(r.status));
  const teams = Object.keys(league.teams).map((id) => teamSummary(league, id, rows)).sort((a, b) => (a.abbr || '').localeCompare(b.abbr || ''));
  const top = (list, key, n = 25) => list.filter((r) => r[key] != null && r[key] > 0).sort((a, b) => b[key] - a[key]).slice(0, n);
  // With a team picked, the leader lists are that team's.
  const pool = teamId ? signed.filter((r) => r.teamId === teamId) : signed;
  const freeAgents = rows.filter((r) => !r.teamId && r.status === 'FreeAgent').sort((a, b) => (b.overall || 0) - (a.overall || 0)).slice(0, 100);
  const cy = seasonYear(league);
  return {
    source: league.source,
    detail: league.source === 'franchise' ? 'year-by-year' : 'summary',
    season: cy,
    salaryCap: league.salaryCap || null,
    teams,
    team: teamId && league.teams[teamId] ? teams.find((t) => t.teamId === teamId) : null,
    players: teamId ? rows.filter((r) => r.teamId === teamId).sort((a, b) => (b.capHit || 0) - (a.capHit || 0)) : [],
    leaders: {
      capHit: top(pool, 'capHit'),
      total: top(pool, 'total', 15),
      averagePerYear: top(pool, 'averagePerYear', 15),
      remainingBonus: top(pool, 'remainingBonus', 15),
      expiring: pool.filter((r) => r.lastYear).sort((a, b) => (b.overall || 0) - (a.overall || 0)).slice(0, teamId ? 60 : 30),
    },
    freeAgents,
    counts: { signed: signed.length, freeAgents: rows.filter((r) => r.status === 'FreeAgent').length, expiring: signed.filter((r) => r.lastYear).length },
  };
}

export function playerContract(league, playerId) {
  const p = league.players[playerId];
  return p && p.contract ? contractRow(league, p) : null;
}
