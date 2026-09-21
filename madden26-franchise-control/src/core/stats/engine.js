// Runs every advanced-stat module for one game and caches the result.

import { teamContext } from './context.js';
import { blockingForTeam } from './blocking.js';
import { snapsForTeam } from './snaps.js';
import { receivingForTeam } from './receiving.js';
import { tacklingForTeam } from './tackling.js';
import { penaltiesForTeam } from './penalties.js';
import { overridesForGame } from '../tracker/tracker.js';

export function computeGame(league, gameId, tracker) {
  const game = league.games[gameId];
  if (!game) throw new Error(`Unknown game ${gameId}`);
  if (game.status !== 'played') return { gameId, game, played: false, teams: {} };
  const overrides = overridesForGame(tracker, gameId);
  const home = teamContext(league, gameId, game.homeTeamId, game.awayTeamId);
  const away = teamContext(league, gameId, game.awayTeamId, game.homeTeamId);
  const out = { gameId, game, played: true, teams: {} };
  for (const [ctx, opp] of [[home, away], [away, home]]) {
    const ov = overrides[ctx.teamId] || {};
    const oppOv = overrides[opp.teamId] || {};
    out.teams[ctx.teamId] = {
      teamId: ctx.teamId,
      opponentId: opp.teamId,
      plays: { offense: ctx.offPlays, defense: opp.offPlays, dropbacks: ctx.dropbacks, rushAttempts: ctx.rushAttempts },
      blocking: blockingForTeam({ league, gameId, ctx, oppCtx: opp, overrides: ov, oppOverrides: oppOv }),
      snaps: snapsForTeam({ league, gameId, ctx, oppCtx: opp, overrides: ov }),
      receiving: receivingForTeam({ league, gameId, ctx, overrides: ov }),
      tackling: tacklingForTeam({ league, gameId, ctx, oppCtx: opp, overrides: ov }),
      penalties: penaltiesForTeam({ league, gameId, ctx, oppCtx: opp, overrides: ov }),
    };
  }
  // A defense's pass rush is computed while working the opposing offense; expose it on the defense's side too.
  for (const teamId of Object.keys(out.teams)) {
    const oppId = out.teams[teamId].opponentId;
    out.teams[teamId].passRush = { teamId, players: out.teams[oppId].blocking.passRush, matchups: out.teams[oppId].blocking.matchups, summary: { pressures: out.teams[oppId].blocking.summary.pressuresAllowed, sacks: out.teams[oppId].blocking.summary.sacksAllowed, hits: out.teams[oppId].blocking.summary.hitsAllowed, hurries: out.teams[oppId].blocking.summary.hurriesAllowed, missedSacks: out.teams[oppId].blocking.passRush.reduce((s, r) => s + r.missedSacks, 0), source: out.teams[oppId].blocking.summary.pressureSource } };
  }
  return out;
}

export class StatsEngine {
  constructor() {
    this.cache = new Map();
  }
  key(league, gameId, tracker) {
    const stamp = tracker && tracker.events ? tracker.events.length + ':' + (tracker.events[tracker.events.length - 1] || {}).id : '0';
    return `${league.leagueId}|${league.loadedAt || ''}|${gameId}|${stamp}`;
  }
  game(league, gameId, tracker) {
    const k = this.key(league, gameId, tracker);
    if (!this.cache.has(k)) this.cache.set(k, computeGame(league, gameId, tracker));
    return this.cache.get(k);
  }
  playedGames(league, { stage, teamId } = {}) {
    return Object.values(league.games).filter((g) => g.status === 'played' && (!stage || g.stage === stage) && (!teamId || g.homeTeamId === teamId || g.awayTeamId === teamId));
  }
  clear() {
    this.cache.clear();
  }
}
