// Every injury in a game, including the small ones that are healed by the
// next week.
//
// Madden keeps injuries in three places, and none of them is complete on its
// own:
//   1. each game's injury list (the post-game report), which in practice holds
//      only some of the injuries from that game;
//   2. the league injury report: every injured player with the stage and week
//      his injury happened. Players come off it the moment they heal, so a
//      "couple of quarters" or "rest of the game" injury is gone a week later;
//   3. nothing at all in a Companion App / EA export, which only carries who is
//      hurt at the moment of the export.
// So the tool keeps a ledger: every time a league is loaded it writes down
// every injury it sees, and remembers it after the player heals. A game's
// injury report is then the union of all of it, each line saying where it
// came from.

import { getInjuryType } from '../franchise/injury-catalog.js';
import { INJURY_TYPE_ENUM, INJURY_SEVERITY_ENUM } from '../franchise/injury-enums.js';

const TYPE_BY_NUMBER = new Map(INJURY_TYPE_ENUM);
const SEVERITY_BY_NUMBER = new Map(INJURY_SEVERITY_ENUM);
const STAGE_RANK = { pre: 0, reg: 1, post: 2 };

// What each Madden severity means for the player.
export const SEVERITY = {
  WearMinor: { label: 'Minor wear and tear', minor: true },
  WearModerate: { label: 'Wear and tear', minor: true },
  WearSevere: { label: 'Heavy wear and tear', minor: true },
  CouplePlays: { label: 'Out a couple of plays', minor: true },
  CoupleQtrs: { label: 'Out a couple of quarters', minor: true },
  GameEnding: { label: 'Out for the rest of the game', minor: false },
  CoupleGames: { label: 'Out a couple of games', minor: false },
  SeveralGames: { label: 'Out several games', minor: false },
  SeasonEnding: { label: 'Out for the season', minor: false },
  CareerEnding: { label: 'Career-ending', minor: false },
};

// Export feeds may send Madden's enum numbers instead of names.
export function injuryTypeName(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' || /^\d+$/.test(String(v))) return TYPE_BY_NUMBER.get(Number(v)) || null;
  const s = String(v);
  return /^(Invalid_?|None|Healthy|Max_)$/i.test(s) ? null : s;
}
export function severityName(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number' || /^\d+$/.test(String(v))) return SEVERITY_BY_NUMBER.get(Number(v)) || null;
  const s = String(v);
  return /^(Invalid_?|Max_)$/.test(s) ? null : s;
}

export function injuryLabel(type) {
  const name = injuryTypeName(type);
  if (!name) return 'Injury';
  const cat = getInjuryType(name);
  if (cat) return cat.name;
  return name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
}

// What the injury means for the next game.
export function outlook({ severity, weeksMin, weeksMax, weeksLeft }) {
  const sev = SEVERITY[severity];
  const max = Number.isFinite(weeksMax) ? weeksMax : weeksLeft;
  if (severity === 'SeasonEnding' || severity === 'CareerEnding') return { key: 'season', text: severity === 'CareerEnding' ? 'Career-ending' : 'Out for the season' };
  if (sev && sev.minor) return { key: 'minor', text: 'Minor: part of a game at most' };
  if (severity === 'GameEnding' && (max == null || max <= 1)) return { key: max ? 'doubtful' : 'minor', text: max ? 'Out for the rest of the game; could miss next week' : 'Out for the rest of the game only' };
  if (max === 0) return { key: 'minor', text: 'Minor: no weeks missed' };
  if (Number.isFinite(weeksMin) && weeksMin >= 1) return { key: 'out', text: `Out ${weeksMin === max ? max : `${weeksMin}-${max}`} week${max === 1 ? '' : 's'}` };
  if (max >= 1) return { key: 'doubtful', text: `Could miss next week (0-${max} wk)` };
  return { key: 'unknown', text: 'Length not recorded' };
}

// ---------------------------------------------------------------- ledger

const stageOfGame = (g) => (g.stage === 'pre' ? 'PreSeason' : 'NFLSeason');

function teamGameInWeek(league, teamId, stage, week, year) {
  return Object.values(league.games).find((g) => g.status === 'played' && (g.homeTeamId === teamId || g.awayTeamId === teamId) && stageOfGame(g) === stage && g.week === week && (g.seasonYear == null || year == null || g.seasonYear === year)) || null;
}

function lastPlayedGame(league, teamId) {
  return Object.values(league.games)
    .filter((g) => g.status === 'played' && (g.homeTeamId === teamId || g.awayTeamId === teamId))
    .sort((a, b) => (a.seasonYear ?? 0) - (b.seasonYear ?? 0) || (STAGE_RANK[a.stage] ?? 3) - (STAGE_RANK[b.stage] ?? 3) || a.week - b.week)
    .pop() || null;
}

function playedIn(league, gameId, playerId) {
  const e = league.playerGameStats[gameId] && league.playerGameStats[gameId][playerId];
  if (!e) return null;
  return { snaps: e.snapsRecorded ? e.snaps : null };
}

// Write down every injury visible right now. Returns the updated ledger.
export function updateLedger(ledger, league, now = new Date().toISOString()) {
  const entries = ledger.entries || {};
  const first = !ledger.loads;
  const seenNow = new Set();
  const put = (key, row) => {
    seenNow.add(key);
    const prev = entries[key];
    entries[key] = prev ? { ...prev, ...row, firstSeenAt: prev.firstSeenAt, lastSeenAt: now, healedSeenAt: null } : { ...row, firstSeenAt: now, lastSeenAt: now, healedSeenAt: null };
  };

  // Madden's own per-game lists
  for (const [gameId, list] of Object.entries(league.gameInjuries || {})) {
    const g = league.games[gameId];
    for (const i of list) {
      if (!i.playerId) continue;
      const p = league.players[i.playerId];
      put(`game|${gameId}|${i.playerId}|${i.type}`, { source: 'game-list', gameId, playerId: i.playerId, name: p ? p.fullName : null, position: p ? p.position : null, teamId: p && p.teamId ? p.teamId : g ? (i.gameTeam === 0 ? g.homeTeamId : g.awayTeamId) : null, type: i.type, severity: severityName(i.severity), weeksMin: i.weeksMin, weeksMax: i.weeksMax });
    }
  }

  // The injury report as it stands
  for (const p of Object.values(league.players)) {
    const inj = p.injury;
    if (!inj || !['Injured', 'EarlyReturn'].includes(inj.status)) continue;
    const type = injuryTypeName(inj.type);
    if (league.source === 'franchise' && inj.stage) {
      const g = p.teamId ? teamGameInWeek(league, p.teamId, inj.stage, inj.week, inj.year) : null;
      put(`report|${p.playerId}|${type}|${inj.stage}|${inj.week}|${inj.year}`, { source: 'report', gameId: g ? g.gameId : null, stage: inj.stage, week: inj.week, year: inj.year, playerId: p.playerId, name: p.fullName, position: p.position, teamId: p.teamId, type, severity: severityName(inj.severity), weeksMin: inj.weeksMin, weeksMax: inj.weeksMax, weeksLeft: inj.weeksTotal, onIR: Boolean(inj.onIR) });
    } else {
      // No dates in an export: an injury is one "episode" from when it first
      // shows up until the player is healthy again.
      const open = Object.entries(entries).find(([, e]) => e.source === 'export' && e.playerId === p.playerId && e.type === type && !e.healedSeenAt);
      const key = open ? open[0] : `export|${p.playerId}|${type}|${now}`;
      const existing = entries[key];
      const g = existing ? null : p.teamId ? lastPlayedGame(league, p.teamId) : null;
      put(key, { source: 'export', playerId: p.playerId, name: p.fullName, position: p.position, teamId: p.teamId, type, severity: severityName(inj.severity), weeksLeft: inj.weeksTotal, weeksMax: existing ? existing.weeksMax : inj.weeksTotal, onIR: Boolean(inj.onIR),
        // The first time the tool sees a league it cannot know when anyone got
        // hurt; after that a new injury belongs to the game just played.
        gameId: existing ? existing.gameId : first ? null : g ? g.gameId : null,
        baseline: existing ? existing.baseline : first,
      });
    }
  }

  // Anyone who was hurt last time and is not now has healed.
  for (const [key, e] of Object.entries(entries)) {
    if (seenNow.has(key) || e.healedSeenAt) continue;
    if (e.source === 'game-list') continue;
    const p = league.players[e.playerId];
    const still = p && p.injury && ['Injured', 'EarlyReturn'].includes(p.injury.status) && injuryTypeName(p.injury.type) === e.type;
    if (!still) entries[key] = { ...e, healedSeenAt: now };
  }
  return { entries, loads: (ledger.loads || 0) + 1, updatedAt: now };
}

// ---------------------------------------------------------------- one game

export function gameInjuryReport(league, gameId, { ledger = null, injuryLog = [] } = {}) {
  const g = league.games[gameId];
  if (!g) return null;
  const rows = new Map();
  const teamOf = (p, fallback) => (p && p.teamId) || fallback || null;
  const add = (playerId, row) => {
    const p = league.players[playerId];
    const type = injuryTypeName(row.type);
    const key = `${playerId}|${type}`;
    const prev = rows.get(key);
    // Keep the most specific source for the same injury, but merge what each knows.
    const rank = { 'game-list': 0, tool: 1, report: 2, ledger: 3, export: 4 };
    if (prev && rank[prev.source] <= rank[row.source]) {
      rows.set(key, { ...row, ...prev, weeksLeft: prev.weeksLeft ?? row.weeksLeft, onIR: prev.onIR || row.onIR, also: [...new Set([...(prev.also || []), row.source])] });
      return;
    }
    const now = p && p.injury && ['Injured', 'EarlyReturn'].includes(p.injury.status) && injuryTypeName(p.injury.type) === type ? p.injury : null;
    const merged = {
      playerId,
      name: p ? p.fullName : row.name,
      position: p ? p.position : row.position,
      teamId: teamOf(p, row.teamId),
      type,
      injury: injuryLabel(type),
      severity: severityName(row.severity) || (now ? severityName(now.severity) : null),
      weeksMin: row.weeksMin ?? (now ? now.weeksMin : null),
      weeksMax: row.weeksMax ?? (now ? now.weeksMax : null),
      weeksLeft: now ? now.weeksTotal : 0,
      stillOut: Boolean(now),
      onIR: Boolean(now ? now.onIR : false),
      source: row.source,
      also: prev ? [...new Set([...(prev.also || []), prev.source])] : [],
      played: playedIn(league, gameId, playerId),
      note: row.note || null,
    };
    merged.severityLabel = merged.severity && SEVERITY[merged.severity] ? SEVERITY[merged.severity].label : merged.severity || '';
    merged.outlook = outlook(merged);
    rows.set(key, merged);
  };

  // 1. Madden's list for this game
  for (const i of (league.gameInjuries && league.gameInjuries[gameId]) || []) {
    if (!i.playerId) continue;
    add(i.playerId, { source: 'game-list', type: i.type, severity: i.severity, weeksMin: i.weeksMin, weeksMax: i.weeksMax, teamId: i.gameTeam === 0 ? g.homeTeamId : g.awayTeamId });
  }
  // 2. The injury report dated to this game's week, for both teams
  if (league.source === 'franchise') {
    const stage = stageOfGame(g);
    for (const p of Object.values(league.players)) {
      if (p.teamId !== g.homeTeamId && p.teamId !== g.awayTeamId) continue;
      const inj = p.injury;
      if (!inj || !['Injured', 'EarlyReturn'].includes(inj.status) || inj.stage !== stage || inj.week !== g.week) continue;
      if (inj.year != null && g.seasonYear != null && inj.year !== g.seasonYear) continue;
      add(p.playerId, { source: 'report', type: inj.type, severity: inj.severity, weeksMin: inj.weeksMin, weeksMax: inj.weeksMax, weeksLeft: inj.weeksTotal, onIR: inj.onIR });
    }
  }
  // 3. The ledger: injuries seen before that have since healed, and export
  //    injuries that first showed up after this game
  for (const e of Object.values((ledger && ledger.entries) || {})) {
    if (e.gameId !== gameId || !e.playerId) continue;
    if (e.source === 'game-list') { add(e.playerId, { ...e, source: 'game-list', healed: Boolean(e.healedSeenAt) }); continue; }
    add(e.playerId, { ...e, source: e.source === 'export' ? 'export' : 'ledger', healed: Boolean(e.healedSeenAt), note: e.source === 'export' ? 'First showed up in the export after this game' : e.healedSeenAt ? 'Healed since; remembered by the tool' : null });
  }
  // 4. Injuries written in with the injury tool
  for (const e of injuryLog || []) {
    if (e.gameId !== gameId || !e.plan || !e.plan.player) continue;
    add(e.plan.player.playerId, { source: 'tool', type: e.plan.injury.key, severity: e.plan.injury.severity, weeksMin: e.plan.injury.weeks, weeksMax: e.plan.injury.weeks, note: e.status === 'applied' ? `Written in with the injury tool (Q${e.plan.play.quarter} ${e.plan.play.clock})` : 'Saved in the injury tool, not written yet' });
  }

  // Hurt in this game, or only dated to its week on the injury report with
  // no stats in the game (hurt in practice, or before kickoff).
  for (const r of rows.values()) r.where = ['report', 'ledger'].includes(r.source) && !r.played && !r.also.includes('game-list') ? 'week' : 'game';
  const list = [...rows.values()].sort((a, b) => (a.where === b.where ? 0 : a.where === 'game' ? -1 : 1) || sevRank(b) - sevRank(a) || String(a.teamId).localeCompare(String(b.teamId)) || String(a.name).localeCompare(String(b.name)));
  const inGame = list.filter((r) => r.where === 'game');
  return {
    gameId,
    injuries: list,
    counts: { total: inGame.length, alsoThisWeek: list.length - inGame.length, minor: inGame.filter((r) => r.outlook.key === 'minor').length, out: inGame.filter((r) => ['out', 'season'].includes(r.outlook.key)).length, byTeam: { [g.homeTeamId]: inGame.filter((r) => r.teamId === g.homeTeamId).length, [g.awayTeamId]: inGame.filter((r) => r.teamId === g.awayTeamId).length } },
    sources: {
      gameList: league.source === 'franchise',
      report: league.source === 'franchise',
      ledger: Boolean(ledger && ledger.loads),
      exportOnly: league.source !== 'franchise',
    },
  };
}

function sevRank(r) {
  const order = ['WearMinor', 'WearModerate', 'WearSevere', 'CouplePlays', 'CoupleQtrs', 'GameEnding', 'CoupleGames', 'SeveralGames', 'SeasonEnding', 'CareerEnding'];
  const i = order.indexOf(r.severity);
  return i >= 0 ? i : r.weeksMax || 0;
}
