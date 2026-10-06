// Changing who plays whom, midseason.
//
// A schedule change is a swap inside one week: if the Packers play the
// Vikings in week 7 and you want them to play the Ravens instead, the Ravens
// leave their week-7 game and the Vikings take their place in it. Every team
// still plays exactly once that week, nobody's bye moves, and only the two
// games' team slots change. Played games and games in weeks already gone by
// cannot be touched.

import { divisionOf } from '../stats/league-table.js';

const STAGE_RANK = { pre: 0, reg: 1, post: 2 };
const EDITABLE = new Set(['PreSeason', 'RegularSeason']);

function currentPosition(league) {
  const s = league.season || {};
  const stage = s.stage === 'PreSeason' ? 'pre' : s.weekType === 'RegularSeason' || s.stage === 'NFLSeason' ? 'reg' : null;
  return { stage, week: Number.isFinite(s.week) ? s.week : 0 };
}

// Can this game be changed, and if not, why not.
export function editability(league, game) {
  if (!game) return { ok: false, reason: 'Unknown game.' };
  if (league.source !== 'franchise') return { ok: false, reason: 'Schedules can only be changed in a PC franchise file. Console and EA-hosted leagues live on EA servers.' };
  if (game.status === 'played') return { ok: false, reason: 'This game has already been played.' };
  if (!EDITABLE.has(game.weekType)) return { ok: false, reason: 'Only preseason and regular-season games can be changed.' };
  const cur = currentPosition(league);
  if (cur.stage && ((STAGE_RANK[game.stage] ?? 9) < (STAGE_RANK[cur.stage] ?? 0) || (game.stage === cur.stage && game.week < cur.week))) return { ok: false, reason: 'That week has already gone by.' };
  const thisWeek = cur.stage === game.stage && cur.week === game.week;
  return { ok: true, currentWeek: thisWeek };
}

const sameSlot = (g, w) => g.stage === w.stage && g.week === w.week && (g.seasonYear ?? 0) === (w.seasonYear ?? 0);

// Every team that plays in this game's week, and the game it plays in.
export function weekOpponents(league, game) {
  const games = Object.values(league.games).filter((g) => sameSlot(g, game));
  const playing = new Map();
  for (const g of games) {
    playing.set(g.homeTeamId, g);
    playing.set(g.awayTeamId, g);
  }
  return Object.values(league.teams).map((t) => {
    const g = playing.get(t.teamId) || null;
    const opp = g ? (g.homeTeamId === t.teamId ? g.awayTeamId : g.homeTeamId) : null;
    return { teamId: t.teamId, abbr: t.abbr, name: t.displayName, gameId: g ? g.gameId : null, opponentId: opp, home: g ? g.homeTeamId === t.teamId : null, played: g ? g.status === 'played' : false, bye: !g };
  }).sort((a, b) => (a.abbr || '').localeCompare(b.abbr || ''));
}

// Work out a change without writing anything.
export function planScheduleChange(league, { gameId, teamId, newOpponentId, flipHomeAway = false }) {
  const game = league.games[gameId];
  const ed = editability(league, game);
  if (!ed.ok) throw new Error(ed.reason);
  if (teamId !== game.homeTeamId && teamId !== game.awayTeamId) throw new Error('That team is not in this game.');
  const oldOpp = teamId === game.homeTeamId ? game.awayTeamId : game.homeTeamId;
  const newOpp = newOpponentId || oldOpp;
  const T = (id) => league.teams[id] || { abbr: '?', displayName: 'Unknown' };
  if (newOpp === teamId) throw new Error('A team cannot play itself.');
  const changes = [];
  const after = new Map();
  const slot = (g) => after.get(g.gameId) || { home: g.homeTeamId, away: g.awayTeamId };
  const notes = [];

  if (newOpp !== oldOpp) {
    const other = Object.values(league.games).find((g) => sameSlot(g, game) && g.gameId !== game.gameId && (g.homeTeamId === newOpp || g.awayTeamId === newOpp));
    if (!other) throw new Error(`${T(newOpp).displayName} have their bye that week, so there is no game to swap them out of. Pick a team that plays that week.`);
    if (other.status === 'played') throw new Error(`${T(newOpp).displayName} have already played that week.`);
    const edOther = editability(league, other);
    if (!edOther.ok) throw new Error(edOther.reason);
    // The new opponent takes the old opponent's side of this game, and the old
    // opponent takes the new opponent's side of the other game.
    const g1 = slot(game);
    after.set(game.gameId, g1.home === oldOpp ? { home: newOpp, away: g1.away } : { home: g1.home, away: newOpp });
    const g2 = slot(other);
    after.set(other.gameId, g2.home === newOpp ? { home: oldOpp, away: g2.away } : { home: g2.home, away: oldOpp });
    const thirdId = other.homeTeamId === newOpp ? other.awayTeamId : other.homeTeamId;
    notes.push(`${T(oldOpp).displayName} move into ${T(newOpp).abbr}'s game and play ${T(thirdId).displayName} instead.`);
    if (divisionOf(T(teamId)) && divisionOf(T(teamId)) === divisionOf(T(oldOpp))) notes.push(`${T(teamId).abbr} vs ${T(oldOpp).abbr} was a division game.`);
    if (divisionOf(T(newOpp)) && divisionOf(T(newOpp)) === divisionOf(T(thirdId))) notes.push(`${T(newOpp).abbr} vs ${T(thirdId).abbr} was a division game.`);
    if (edOther.currentWeek) notes.push('The other game is in the current week too.');
  }
  if (flipHomeAway) {
    const g1 = slot(game);
    after.set(game.gameId, { home: g1.away, away: g1.home });
  }
  for (const [gid, a] of after) {
    const g = league.games[gid];
    if (a.home === g.homeTeamId && a.away === g.awayTeamId) continue;
    changes.push({ gameId: gid, rowIndex: g.rowIndex, label: g.label, before: { home: g.homeTeamId, away: g.awayTeamId }, after: a });
  }
  if (!changes.length) throw new Error('Nothing would change.');

  // How often the two teams meet this season once this is done.
  const season = Object.values(league.games).filter((g) => (g.seasonYear ?? 0) === (game.seasonYear ?? 0) && g.stage === game.stage);
  const meetings = season.filter((g) => {
    const a = after.get(g.gameId) || { home: g.homeTeamId, away: g.awayTeamId };
    return (a.home === teamId && a.away === newOpp) || (a.home === newOpp && a.away === teamId);
  }).length;
  if (meetings > 1) notes.push(`${T(teamId).abbr} and ${T(newOpp).abbr} would meet ${meetings} times this ${game.stage === 'pre' ? 'preseason' : 'season'}.`);
  if (ed.currentWeek) notes.push("This is the current week. Madden has already set up this week's games, so make changes like this before you advance into a week when you can.");

  const describe = (c) => `${c.label}: ${T(c.before.away).abbr} @ ${T(c.before.home).abbr} becomes ${T(c.after.away).abbr} @ ${T(c.after.home).abbr}`;
  return {
    gameId,
    teamId,
    oldOpponentId: oldOpp,
    newOpponentId: newOpp,
    flipHomeAway: Boolean(flipHomeAway),
    week: { stage: game.stage, week: game.week, label: game.label },
    changes,
    lines: changes.map(describe),
    notes,
    currentWeek: Boolean(ed.currentWeek),
  };
}

// The plan that puts things back the way they were.
export function reversePlan(plan) {
  return { ...plan, changes: plan.changes.map((c) => ({ ...c, before: c.after, after: c.before })), lines: plan.changes.map((c) => c.label + ': put back'), notes: [], undo: true };
}
