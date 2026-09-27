import test from 'node:test';
import assert from 'node:assert/strict';
import { weeklyRecap, recapWeeks, prettyInjury } from '../src/core/stats/recap.js';
import { contractsReport } from '../src/core/contracts.js';
import { moneyScale } from '../src/core/companion/league.js';
import { devTraitName, deriveLeagueCap, transactionKind } from '../src/core/franchise/reader.js';
import { StatsEngine } from '../src/core/stats/engine.js';
import { syntheticLeague } from './helpers.js';

const empty = { events: [] };

test('the weekly recap reports the scores, records and leaders exactly as recorded', () => {
  const league = syntheticLeague();
  const weeks = recapWeeks(league);
  assert.equal(weeks.length, 1);
  const r = weeklyRecap(league, new StatsEngine(), empty, { stage: weeks[0].stage, week: weeks[0].week });
  const g = r.scores.find((s) => s.status === 'played');
  assert.equal(g.homeScore, 27);
  assert.equal(g.awayScore, 24);
  assert.equal(g.winner, 'c101');
  assert.equal(g.homeRecord, '1-0');
  assert.equal(g.awayRecord, '0-1');
  assert.equal(g.overtime, null, 'no play-by-play, so overtime is unknown rather than guessed');
  assert.equal(r.leaders.passing[0].name, 'Pat Passer');
  assert.equal(r.leaders.passing[0].value, 310);
  assert.equal(r.leaders.rushing[0].value, 110);
  assert.equal(r.summary.totalPoints, 51);
  assert.ok(r.storylines.some((s) => s.kind === 'Nail-biter'), 'a 3-point game is a nail-biter');
  assert.equal(r.hasNews, false, 'a Companion App league has no news feed');
  assert.equal(r.upcoming.length, 1, 'next week is listed');
  assert.equal(prettyInjury('KneeACLCompleteTear').length > 0, true);
});

test('transactions are named by what changed', () => {
  assert.equal(transactionKind('FreeAgent', 'Signed', null, 't1'), 'signed');
  assert.equal(transactionKind('Signed', 'FreeAgent', 't1', null), 'released');
  assert.equal(transactionKind('Signed', 'Signed', 't1', 't2'), 'trade');
  assert.equal(transactionKind('PracticeSquad', 'Signed', 't1', 't1'), 'promoted');
});

test('development traits use Madden names', () => {
  assert.equal(devTraitName('College_Elite'), 'X-Factor');
  assert.equal(devTraitName('College_Star'), 'Superstar');
  assert.equal(devTraitName('College_Impact'), 'Star');
  assert.equal(devTraitName(3), 'X-Factor');
  assert.equal(syntheticLeague().players.r1.devTrait, 'X-Factor');
});

test('Companion App contracts and cap come through in dollars', () => {
  assert.equal(moneyScale([45000000, 9000000]), 1);
  assert.equal(moneyScale([4500, 900]), 10000, "Madden's own $10,000 units");
  assert.equal(moneyScale([45000, 9000]), 1000, 'thousands');
  assert.equal(moneyScale([27920], { team: true }), 10000);
  const league = syntheticLeague();
  assert.equal(league.players.r1.contract.capHit, 45000000);
  assert.equal(league.players.r1.contract.yearsLeft, 3);
  assert.equal(league.teams.c101.cap.room, 29200000);
  assert.equal(league.teams.c101.cap.teamCap, 279200000);
  const report = contractsReport(league, { teamId: 'c101' });
  assert.equal(report.detail, 'summary');
  assert.equal(report.players[0].name, 'Pat Passer');
  assert.equal(report.players[0].releaseSavings, 12000000);
  assert.ok(report.leaders.expiring.some((p) => p.name === 'Left Tackle'), 'one year left is an expiring deal');
});

test('the league cap is only named when the teams agree on it', () => {
  const players = {};
  const teams = {};
  for (let i = 0; i < 10; i++) {
    teams[`t${i}`] = { teamId: `t${i}`, cap: { room: 1000 * (i + 1), deadThisYear: 500, rollover: i === 0 ? 2000 : 0 } };
    players[`p${i}`] = { teamId: `t${i}`, contract: { status: 'Signed', capHit: 100000 - 1000 * (i + 1) - 500 + (i === 0 ? 2000 : 0) } };
  }
  assert.equal(deriveLeagueCap(teams, players).cap, 100000);
  for (const t of Object.values(teams)) t.cap.room = Math.round(Math.random() * 90000);
  assert.equal(deriveLeagueCap(teams, players), null, 'no agreement, no number');
});
