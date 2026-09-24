import test from 'node:test';
import assert from 'node:assert/strict';
import { buildScoringEvents, clockText, article, highlightsForGame, weekHighlights } from '../src/core/stats/highlights.js';
import { StatsEngine, computeGame, leagueCalibration } from '../src/core/stats/engine.js';
import { calibrateReps } from '../src/core/stats/blocking.js';
import { predictGame } from '../src/core/stats/predict.js';
import { seasonTotals, blockingByWeek, playerLog } from '../src/core/stats/aggregate.js';
import { syntheticLeague } from './helpers.js';

const game = (homeScore, awayScore) => ({ gameId: 'g1', homeTeamId: 'h', awayTeamId: 'a', homeScore, awayScore, status: 'played' });
const empty = { events: [] };

test('touchdown conversions written into the next entry are folded back', () => {
  const gp = {
    quarterLengthSec: 900,
    plays: [
      { teamId: 'h', quarter: 1, clockSec: 600, type: 'tdPass' },
      { teamId: 'a', quarter: 2, clockSec: 300, type: 'fieldGoal' },
      { teamId: 'a', quarter: 3, clockSec: 400, type: 'tdRun' },
      { teamId: 'h', quarter: 4, clockSec: 100, type: 'tdRun' },
    ],
    scoring: [
      { quarter: 1, clockSec: 600, homeAfter: 6, awayAfter: 0 },
      { quarter: 2, clockSec: 300, homeAfter: 7, awayAfter: 3 },
      { quarter: 3, clockSec: 400, homeAfter: 7, awayAfter: 9 },
      { quarter: 4, clockSec: 100, homeAfter: 13, awayAfter: 10 },
    ],
  };
  const ev = buildScoringEvents(game(14, 10), gp);
  assert.deepEqual(ev.map((e) => `${e.side}:${e.kind}:${e.conversion ?? '-'}`), ['home:TD:1', 'away:FG:-', 'away:TD:1', 'home:TD:1']);
  assert.deepEqual(ev.map((e) => `${e.scoreAfter.home}-${e.scoreAfter.away}`), ['7-0', '7-3', '7-10', '14-10']);
  assert.ok(ev[3].gameWinner, 'the fourth-quarter go-ahead score won it');
  assert.ok(!ev[0].gameWinner);
});

test('a failed try is a zero-point conversion', () => {
  const gp = { plays: [{ teamId: 'h', quarter: 2, clockSec: 200, type: 'tdRun' }], scoring: [{ quarter: 2, clockSec: 200, homeAfter: 6, awayAfter: 0 }] };
  const ev = buildScoringEvents(game(6, 0), gp);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].conversion, 0);
});

test('an early score in a blowout takes the lead for good but does not "win it"', () => {
  const gp = {
    plays: [{ teamId: 'h', quarter: 1, clockSec: 800, type: 'tdPass' }, { teamId: 'h', quarter: 2, clockSec: 500, type: 'tdRun' }, { teamId: 'h', quarter: 3, clockSec: 500, type: 'tdRun' }],
    scoring: [
      { quarter: 1, clockSec: 800, homeAfter: 7, awayAfter: 0 },
      { quarter: 2, clockSec: 500, homeAfter: 14, awayAfter: 0 },
      { quarter: 3, clockSec: 500, homeAfter: 21, awayAfter: 0 },
    ],
  };
  const ev = buildScoringEvents(game(21, 0), gp);
  assert.ok(ev.every((e) => !e.gameWinner));
  assert.ok(ev[0].leadForGood);
});

test('clock and article helpers read naturally', () => {
  assert.equal(clockText(4, 74), 'Q4 1:14');
  assert.equal(clockText(5, 600), 'OT 10:00');
  for (const n of [8, 11, 18, 80, 86, 800]) assert.equal(article(n), 'an', String(n));
  for (const n of [1, 12, 28, 70]) assert.equal(article(n), 'a', String(n));
});

test('box-score highlights for a league with no play-by-play', () => {
  const league = syntheticLeague();
  const h = highlightsForGame(league, 's9001', computeGame(league, 's9001', empty));
  assert.equal(h.hasPlayByPlay, false);
  assert.match(h.headline, /27/);
  assert.match(h.headline, /24/);
  assert.ok(h.highlights.length > 0);
  for (const list of [h.highlights, h.lowlights]) {
    for (let i = 0; i < list.length; i++) {
      assert.ok(list[i].text && list[i].impact >= 1 && list[i].impact <= 100);
      if (i) assert.ok(list[i - 1].impact >= list[i].impact, 'ranked by impact');
    }
  }
  assert.equal(highlightsForGame(league, 's9002', null), null, 'nothing for an unplayed game');
  const wk = weekHighlights(league, new StatsEngine(), empty, { stage: 'reg', week: league.games.s9001.week });
  assert.equal(wk.games.length, 1);
  assert.ok(wk.highlights.length > 0);
});

test('matchup preview works before and after kickoff', () => {
  const league = syntheticLeague();
  const engine = new StatsEngine();
  const ahead = predictGame(league, engine, empty, 's9002');
  assert.equal(ahead.played, false);
  for (const teamId of ['c101', 'c102']) {
    const s = ahead.teams[teamId];
    assert.ok(s.predicted.pressures >= 0 && s.predicted.sacks <= s.predicted.pressures);
    assert.ok(s.blockers.every((b) => ['Low', 'Medium', 'High', 'Critical'].includes(b.risk)));
    assert.ok(Array.isArray(s.offenseTips) && Array.isArray(s.defenseTipsForOpponent));
    assert.equal(s.basis.fromGames, 1, 'volume comes from the game already played');
  }
  const after = predictGame(league, engine, empty, 's9001');
  assert.equal(after.played, true);
  assert.equal(after.teams.c101.actual.sacks, 2);
  assert.equal(after.teams.c101.basis.fromGames, 0, 'nothing from the game itself leaks into its own preview');
});

test('calibration solves for the target pressure rate', () => {
  const samples = [{ reps: 10, logit: -2 }, { reps: 20, logit: -3 }, { reps: 5, logit: -1 }];
  const off = calibrateReps(samples, 0.1);
  const W = 35;
  const mean = samples.reduce((s, x) => s + (x.reps * 1) / (1 + Math.exp(-(x.logit + off))), 0) / W;
  assert.ok(Math.abs(mean - 0.1) < 1e-6);
  const c = leagueCalibration(syntheticLeague());
  assert.equal(c.repOffset, 0, 'too little data to calibrate on');
});

test('weekly blocking, week filters and player game logs', () => {
  const league = syntheticLeague();
  const engine = new StatsEngine();
  const week = league.games.s9001.week;
  assert.equal(seasonTotals(league, engine, empty, { stage: 'reg', week }).games, 1);
  assert.equal(seasonTotals(league, engine, empty, { stage: 'reg', week: week + 1 }).games, 0);
  const wk = blockingByWeek(league, engine, empty, { stage: 'reg', teamId: 'c101' });
  assert.equal(wk.weeks.length, 1);
  const lt = wk.players.find((p) => p.playerId === 'r2');
  assert.ok(lt.weeks[wk.weeks[0].key], 'the left tackle has a grade for the week');
  assert.equal(lt.weeks[wk.weeks[0].key].grade, lt.season.blockGrade);
  const log = playerLog(league, engine, empty, 'r2');
  assert.equal(log.length, 1);
  assert.ok(log[0].blocking);
  assert.equal(log[0].result, 'W 27-24');
});
