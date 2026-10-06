import test from 'node:test';
import assert from 'node:assert/strict';
import { planScheduleChange, editability, weekOpponents, reversePlan } from '../src/core/franchise/schedule.js';
import { teamProfile } from '../src/core/teams.js';
import { StatsEngine } from '../src/core/stats/engine.js';
import { syntheticLeague } from './helpers.js';

// A tiny franchise-file league: week 4 has GB-MIN and BAL-PIT, CHI on bye.
function miniLeague() {
  const team = (abbr, i) => ({ teamId: `t${i}`, abbr, displayName: abbr, rowIndex: i, overall: 80 });
  const teams = Object.fromEntries(['GB', 'MIN', 'BAL', 'PIT', 'CHI'].map((a, i) => [`t${i}`, team(a, i)]));
  const g = (id, home, away, week, status = 'unplayed') => ({ gameId: id, rowIndex: Number(id.slice(1)), stage: 'reg', weekType: 'RegularSeason', week, seasonYear: 0, homeTeamId: home, awayTeamId: away, status, label: `Week ${week + 1}`, homeScore: 0, awayScore: 0 });
  return {
    source: 'franchise',
    season: { stage: 'NFLSeason', weekType: 'RegularSeason', week: 2, year: 0 },
    teams,
    games: { g1: g('g1', 't0', 't1', 4), g2: g('g2', 't2', 't3', 4), g3: g('g3', 't4', 't0', 1, 'played'), g4: g('g4', 't1', 't0', 9) },
    players: {}, playerGameStats: {}, teamGameStats: {},
  };
}

test('a matchup swap keeps every team playing once that week', () => {
  const league = miniLeague();
  const plan = planScheduleChange(league, { gameId: 'g1', teamId: 't0', newOpponentId: 't2' });
  const after = Object.fromEntries(plan.changes.map((c) => [c.gameId, c.after]));
  assert.deepEqual(after.g1, { home: 't0', away: 't2' }, 'GB now hosts BAL');
  assert.deepEqual(after.g2, { home: 't1', away: 't3' }, 'MIN takes BAL\'s place against PIT');
  const teamsThatWeek = [after.g1.home, after.g1.away, after.g2.home, after.g2.away].sort();
  assert.deepEqual(teamsThatWeek, ['t0', 't1', 't2', 't3']);
  assert.ok(plan.notes.some((n) => /MIN move into BAL's game/.test(n)));
});

test('home and away can be swapped, and changes undo', () => {
  const league = miniLeague();
  const plan = planScheduleChange(league, { gameId: 'g1', teamId: 't0', flipHomeAway: true });
  assert.deepEqual(plan.changes[0].after, { home: 't1', away: 't0' });
  const back = reversePlan(plan);
  assert.deepEqual(back.changes[0].after, { home: 't0', away: 't1' });
});

test('changes that would break the schedule are refused', () => {
  const league = miniLeague();
  assert.throws(() => planScheduleChange(league, { gameId: 'g1', teamId: 't0', newOpponentId: 't4' }), /bye that week/);
  assert.throws(() => planScheduleChange(league, { gameId: 'g3', teamId: 't0', newOpponentId: 't2' }), /already been played/);
  assert.throws(() => planScheduleChange(league, { gameId: 'g1', teamId: 't0', newOpponentId: 't0' }), /cannot play itself/);
  assert.throws(() => planScheduleChange(league, { gameId: 'g1', teamId: 't2', newOpponentId: 't3' }), /not in this game/);
  league.season.week = 6;
  assert.equal(editability(league, league.games.g1).ok, false, 'a week already gone by');
  assert.equal(editability(syntheticLeague(), syntheticLeague().games.s9002).ok, false, 'exports cannot be edited');
  const opps = weekOpponents(miniLeague(), miniLeague().games.g1);
  assert.equal(opps.find((o) => o.abbr === 'CHI').bye, true);
});

test('a team profile has the record, schedule, roster and leaders', () => {
  const league = syntheticLeague();
  const p = teamProfile(league, new StatsEngine(), { events: [] }, 'c101', {});
  assert.equal(p.record.text, '1-0');
  assert.equal(p.team.abbr, 'KC');
  assert.equal(p.schedule.length, 2);
  assert.equal(p.schedule[0].result, 'W 27-24');
  assert.equal(p.nextGame.gameId, 's9002');
  assert.equal(p.leaders.passing[0].value, 310);
  assert.ok(p.roster.length >= 9);
  assert.equal(p.ranks.find((r) => r.label === 'Points per game').value, 27);
  assert.equal(p.standing.division.name, 'AFC West');
  assert.equal(p.canEditSchedule, false);
});
