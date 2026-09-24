// Runs every advanced-stat module for one game and caches the results.
//
// Order matters because the systems feed each other: blocking decides how
// much pressure there was, which shapes throwaways (targets) and who drew
// holding flags (penalties), and a blocker's flags come back off his grade.

import { teamContext } from './context.js';
import { blockingForTeam, setupMatchups, calibrateReps, MODEL } from './blocking.js';
import { snapsForTeam } from './snaps.js';
import { receivingForTeam } from './receiving.js';
import { tacklingForTeam } from './tackling.js';
import { penaltiesForTeam } from './penalties.js';
import { buildScoringEvents, highlightsForGame } from './highlights.js';
import { overridesForGame } from '../tracker/tracker.js';

// League-wide baselines, so "good" means good for this league and this
// version of Madden's ratings, not for some fixed scale:
//   repOffset  makes the average rep produce NFL-typical pressure
//   sackBase   this league's own rate of pressure turning into sacks
//   ybcMean    this league's yards before contact per carry
export function leagueCalibration(league) {
  const vals = [];
  const samples = [];
  let dropbacks = 0;
  let sacks = 0;
  for (const g of Object.values(league.games)) {
    if (g.status !== 'played') continue;
    const home = teamContext(league, g.gameId, g.homeTeamId, g.awayTeamId);
    const away = teamContext(league, g.gameId, g.awayTeamId, g.homeTeamId);
    for (const [ctx, opp] of [[home, away], [away, home]]) {
      if (!ctx.dropbacks) continue;
      dropbacks += ctx.dropbacks;
      sacks += ctx.sacksAllowed;
      const { pairs } = setupMatchups({ league, gameId: g.gameId, ctx, oppCtx: opp, gameScript: gameScriptFor(league, g, opp.teamId) });
      for (const pr of pairs) samples.push({ reps: pr.reps, logit: pr.logit });
    }
    const lines = league.playerGameStats[g.gameId] || {};
    const perTeam = {};
    for (const e of Object.values(lines)) {
      const o = e.offense;
      if (!o || !o.RUSHATTEMPTS) continue;
      const t = (perTeam[e.teamId] ||= { carries: 0, ybc: 0, split: false });
      t.carries += o.RUSHATTEMPTS;
      if (typeof o.RUSHYARDSAFTER1STHIT === 'number') { t.ybc += (o.RUSHYARDS || 0) - o.RUSHYARDSAFTER1STHIT; t.split = true; } else t.ybc += (o.RUSHYARDS || 0) * 0.45;
    }
    for (const t of Object.values(perTeam)) if (t.carries >= 5) vals.push({ v: Math.max(0, t.ybc) / t.carries, w: t.carries });
  }
  const repOffset = samples.length >= 20 ? calibrateReps(samples) : 0;
  // The average one-on-one rep a rusher wins, once calibrated.
  let repW = 0;
  let repS = 0;
  for (const x of samples) { repW += x.reps; repS += x.reps / (1 + Math.exp(-(x.logit + repOffset))); }
  const repWinRate = repW ? repS / repW : null;
  // Pressure is pinned to about 38 per 100 dropbacks, so the league's sack
  // rate tells us how often pressure became a sack in this league.
  const sackBase = dropbacks >= 60 ? Math.max(0.08, Math.min(0.45, sacks / (0.38 * dropbacks))) : MODEL.sackBase;
  const base = { repOffset, repWinRate, sackBase, leagueSackRate: dropbacks ? sacks / dropbacks : null, dropbacks, pairSamples: samples.length };
  if (vals.length < 4) return { ...base, ybcMean: 1.9, ybcSd: 0.9, samples: vals.length };
  const W = vals.reduce((s, x) => s + x.w, 0);
  const mean = vals.reduce((s, x) => s + x.v * x.w, 0) / W;
  const variance = vals.reduce((s, x) => s + x.w * (x.v - mean) ** 2, 0) / W;
  return { ...base, ybcMean: mean, ybcSd: Math.max(0.35, Math.sqrt(variance)), samples: vals.length };
}

// Share of the game this defense spent up by 10 or more. Defenses leading big
// pin their ears back; offenses trailing big throw into it.
export function gameScriptFor(league, game, defenseTeamId) {
  const gp = league.gamePlays && league.gamePlays[game.gameId];
  const defSide = defenseTeamId === game.homeTeamId ? 'home' : 'away';
  if (gp && gp.scoring && gp.scoring.length) {
    const qLen = gp.quarterLengthSec || 900;
    const events = buildScoringEvents(game, gp);
    const at = (ev) => (Math.min(ev.quarter, 5) - 1) * qLen + (qLen - ev.clockSec);
    const end = 4 * qLen;
    let t = 0;
    let margin = 0;
    let up10 = 0;
    for (const ev of events) {
      const now = Math.min(end, Math.max(t, at(ev)));
      if (margin >= 10) up10 += now - t;
      t = now;
      margin = defSide === 'home' ? ev.scoreAfter.home - ev.scoreAfter.away : ev.scoreAfter.away - ev.scoreAfter.home;
    }
    if (margin >= 10) up10 += Math.max(0, end - t);
    return Math.max(0, Math.min(1, up10 / end));
  }
  const m = defSide === 'home' ? game.homeScore - game.awayScore : game.awayScore - game.homeScore;
  return m >= 21 ? 0.7 : m >= 14 ? 0.45 : m >= 10 ? 0.25 : 0;
}

export function computeGame(league, gameId, tracker, { calib = null } = {}) {
  const game = league.games[gameId];
  if (!game) throw new Error(`Unknown game ${gameId}`);
  if (game.status !== 'played') return { gameId, game, played: false, teams: {} };
  const overrides = overridesForGame(tracker, gameId);
  const home = teamContext(league, gameId, game.homeTeamId, game.awayTeamId);
  const away = teamContext(league, gameId, game.awayTeamId, game.homeTeamId);
  const out = { gameId, game, played: true, teams: {} };
  // Blocking for both offenses first: each defense's pass rush lives in the
  // other team's blocking, and penalties need both.
  const blockingOf = {};
  for (const [ctx, opp] of [[home, away], [away, home]]) {
    blockingOf[ctx.teamId] = blockingForTeam({ league, gameId, ctx, oppCtx: opp, overrides: overrides[ctx.teamId] || {}, oppOverrides: overrides[opp.teamId] || {}, calib, gameScript: gameScriptFor(league, game, opp.teamId) });
  }
  for (const [ctx, opp] of [[home, away], [away, home]]) {
    const ov = overrides[ctx.teamId] || {};
    const blocking = blockingOf[ctx.teamId];
    const penalties = penaltiesForTeam({ league, gameId, ctx, oppCtx: opp, overrides: ov, blocking, passRush: blockingOf[opp.teamId].passRush });
    // Flags on a blocker come off his grade.
    for (const pen of penalties.players) {
      const b = blocking.blockers.find((x) => x.playerId === pen.playerId);
      if (b) { b.penalties = pen.penalties; b.blockGrade = Math.max(0, b.blockGrade - 4 * pen.penalties); }
    }
    out.teams[ctx.teamId] = {
      teamId: ctx.teamId,
      opponentId: opp.teamId,
      plays: { offense: ctx.offPlays, defense: opp.offPlays, dropbacks: ctx.dropbacks, rushAttempts: ctx.rushAttempts },
      blocking,
      snaps: snapsForTeam({ league, gameId, ctx, oppCtx: opp, overrides: ov }),
      receiving: receivingForTeam({ league, gameId, ctx, overrides: ov, blocking }),
      tackling: tacklingForTeam({ league, gameId, ctx, oppCtx: opp, overrides: ov }),
      penalties,
    };
  }
  for (const t of Object.values(out.teams)) t.blocking.blockers.sort((a, b) => b.blockGrade - a.blockGrade);
  // A defense's pass rush is computed while working the opposing offense; expose it on the defense's side too.
  for (const teamId of Object.keys(out.teams)) {
    const oppId = out.teams[teamId].opponentId;
    const ob = out.teams[oppId].blocking;
    out.teams[teamId].passRush = {
      teamId,
      players: ob.passRush,
      matchups: ob.matchups,
      summary: { pressures: ob.summary.pressuresAllowed, sacks: ob.summary.sacksAllowed, hits: ob.summary.hitsAllowed, hurries: ob.summary.hurriesAllowed, missedSacks: ob.passRush.reduce((s, r) => s + r.missedSacks, 0), unblocked: ob.summary.unblockedPressures, source: ob.summary.pressureSource },
    };
  }
  return out;
}

export class StatsEngine {
  constructor() {
    this.cache = new Map();
    this.memoCache = new Map();
    this.calibCache = new Map();
  }
  stamp(tracker) {
    return tracker && tracker.events ? tracker.events.length + ':' + (tracker.events[tracker.events.length - 1] || {}).id : '0';
  }
  key(league, gameId, tracker) {
    return `${league.leagueId}|${league.loadedAt || ''}|${gameId}|${this.stamp(tracker)}`;
  }
  calibration(league) {
    const k = `${league.leagueId}|${league.loadedAt || ''}`;
    if (!this.calibCache.has(k)) this.calibCache.set(k, leagueCalibration(league));
    return this.calibCache.get(k);
  }
  game(league, gameId, tracker) {
    const k = this.key(league, gameId, tracker);
    if (!this.cache.has(k)) this.cache.set(k, computeGame(league, gameId, tracker, { calib: this.calibration(league) }));
    return this.cache.get(k);
  }
  highlights(league, gameId, tracker) {
    return this.memo(`hl|${this.key(league, gameId, tracker)}`, () => highlightsForGame(league, gameId, this.game(league, gameId, tracker)));
  }
  // Any derived result keyed by the league, its load and the tracker state.
  memo(key, fn) {
    if (!this.memoCache.has(key)) this.memoCache.set(key, fn());
    return this.memoCache.get(key);
  }
  leagueKey(league, tracker) {
    return `${league.leagueId}|${league.loadedAt || ''}|${this.stamp(tracker)}`;
  }
  playedGames(league, { stage, teamId, week } = {}) {
    return Object.values(league.games).filter((g) => g.status === 'played' && (!stage || stage === 'all' || g.stage === stage) && (week == null || week === '' || g.week === Number(week)) && (!teamId || g.homeTeamId === teamId || g.awayTeamId === teamId));
  }
  clear() {
    this.cache.clear();
    this.memoCache.clear();
    this.calibCache.clear();
  }
}
