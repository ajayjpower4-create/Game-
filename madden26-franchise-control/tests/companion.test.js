import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPath, extractList, normalizeSchedule, weekTypeFor } from '../src/core/companion/normalize.js';
import { syntheticLeague } from './helpers.js';

test('classifyPath recognises every companion export url', () => {
  assert.deepEqual(classifyPath(['xbsx', '123', 'leagueteams']), { platform: 'xbsx', leagueId: '123', kind: 'leagueteams' });
  assert.deepEqual(classifyPath(['ps5', '9', 'standings']), { platform: 'ps5', leagueId: '9', kind: 'standings' });
  assert.deepEqual(classifyPath(['pc', '1', 'week', 'reg', '3', 'receiving']), { platform: 'pc', leagueId: '1', kind: 'receiving', stage: 'reg', week: 3 });
  assert.deepEqual(classifyPath(['pc', '1', 'team', '55', 'roster']), { platform: 'pc', leagueId: '1', kind: 'roster', teamId: '55' });
  assert.deepEqual(classifyPath(['pc', '1', 'freeagents', 'roster']), { platform: 'pc', leagueId: '1', kind: 'roster', teamId: 'freeagents' });
  assert.equal(classifyPath(['pc', '1', 'week', 'reg', '3', 'nonsense']), null);
  assert.equal(classifyPath(['pc']), null);
});

test('extractList finds the list even with an unexpected key', () => {
  assert.equal(extractList('passing', { playerPassingStatInfoList: [1, 2] }).length, 2);
  assert.equal(extractList('passing', { somethingElse: [1] }).length, 1);
  assert.equal(extractList('passing', null).length, 0);
});

test('schedule normalisation and playoff week types', () => {
  const g = normalizeSchedule({ scheduleId: 5, homeTeamId: 1, awayTeamId: 2, homeScore: 10, awayScore: 3, status: 3, weekIndex: 0, stageIndex: 1 });
  assert.equal(g.gameId, 's5');
  assert.equal(g.status, 'played');
  assert.equal(g.weekType, 'RegularSeason');
  assert.equal(normalizeSchedule({ scheduleId: 6, homeTeamId: 1, awayTeamId: 2, status: 1, weekIndex: 4, stageIndex: 1 }).status, 'unplayed');
  assert.equal(weekTypeFor(1, 18), 'WildcardPlayoff');
  assert.equal(weekTypeFor(1, 22), 'SuperBowl');
  assert.equal(weekTypeFor(0, 0), 'PreSeason');
});

test('buildLeagueFromCompanion assembles a full league model', () => {
  const league = syntheticLeague();
  assert.equal(Object.keys(league.teams).length, 2);
  assert.equal(Object.keys(league.players).length, 16);
  assert.equal(Object.keys(league.games).length, 2);
  assert.equal(league.games.s9001.status, 'played');
  assert.equal(league.games.s9001.label, 'Week 1');
  assert.equal(league.teamGameStats.s9001.c101.PENALTIES, 6);
  assert.equal(league.teamGameStats.s9001.c101.PASSATTEMPTS, 34, 'pass attempts summed from player lines');
  assert.equal(league.playerGameStats.s9001.r4.offense.RECEIVECATCHES, 9);
  assert.equal(league.playerGameStats.s9001.r9.defense.DLINESACKS, 2);
  assert.equal(league.teams.c101.record.wins, 1);
});
