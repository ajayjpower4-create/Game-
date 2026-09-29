import test from 'node:test';
import assert from 'node:assert/strict';
import { updateLedger, gameInjuryReport, injuryTypeName, severityName, outlook } from '../src/core/injuries/game-injuries.js';
import { exportPlays, scoringBreakdown } from '../src/core/stats/export-plays.js';
import { boxScore, passerRating } from '../src/core/stats/boxscore.js';
import { powerRankings, playoffPicture, fantasyPoints } from '../src/core/stats/league-table.js';
import { highlightsForGame } from '../src/core/stats/highlights.js';
import { computeGame } from '../src/core/stats/engine.js';
import { syntheticLeague } from './helpers.js';

test('export injury codes are decoded with Madden\'s own enums', () => {
  assert.equal(injuryTypeName(3), 'AnkleHighSprain');
  assert.equal(injuryTypeName('KneeACLCompleteTear'), 'KneeACLCompleteTear');
  assert.equal(injuryTypeName('Invalid_'), null);
  assert.equal(severityName(4), 'CoupleQtrs');
  assert.equal(outlook({ severity: 'CoupleQtrs', weeksMin: 0, weeksMax: 1 }).key, 'minor', 'a couple of quarters never costs a week');
  assert.equal(outlook({ severity: 'SeasonEnding' }).key, 'season');
  assert.equal(outlook({ severity: 'CoupleGames', weeksMin: 3, weeksMax: 4 }).text, 'Out 3-4 weeks');
});

test('the ledger ties a new export injury to the game just played, and remembers it after he heals', () => {
  const league = syntheticLeague();
  // First load: whoever is hurt already cannot be dated.
  league.players.r3.injury = { status: 'Injured', type: 'KneeMCLSprain', weeksTotal: 2, onIR: false };
  let ledger = updateLedger({ entries: {}, loads: 0 }, league, '2026-01-01T00:00:00Z');
  const base = Object.values(ledger.entries).find((e) => e.playerId === 'r3');
  assert.equal(base.baseline, true);
  assert.equal(base.gameId, null, 'an injury seen on the first load is not pinned on a game');
  // Next export: a new, small injury appears after the game.
  league.players.r5.injury = { status: 'Injured', type: 'ShoulderStrain', severity: 'CoupleQtrs', weeksTotal: 0, onIR: false };
  ledger = updateLedger(ledger, league, '2026-01-02T00:00:00Z');
  const fresh = Object.values(ledger.entries).find((e) => e.playerId === 'r5');
  assert.equal(fresh.gameId, 's9001');
  // He heals before the next export; the game still lists him.
  league.players.r5.injury = { status: 'Uninjured', weeksTotal: 0 };
  ledger = updateLedger(ledger, league, '2026-01-03T00:00:00Z');
  assert.ok(Object.values(ledger.entries).find((e) => e.playerId === 'r5').healedSeenAt);
  const rep = gameInjuryReport(league, 's9001', { ledger });
  const row = rep.injuries.find((i) => i.playerId === 'r5');
  assert.ok(row, 'the healed small injury is still in the game report');
  assert.equal(row.outlook.key, 'minor');
  assert.equal(row.stillOut, false);
  assert.ok(!rep.injuries.some((i) => i.playerId === 'r3'), 'the undated injury is not');
});

test('the injury tool\'s own injuries show up in the game report', () => {
  const league = syntheticLeague();
  const log = [{ gameId: 's9001', status: 'scheduled', plan: { player: { playerId: 'r8', name: 'Mike Backer', position: 'MLB' }, injury: { key: 'KneeACLCompleteTear', severity: 'SeasonEnding', weeks: 36 }, play: { quarter: 2, clock: '5:00' } } }];
  const rep = gameInjuryReport(league, 's9001', { injuryLog: log });
  assert.equal(rep.injuries[0].playerId, 'r8');
  assert.equal(rep.injuries[0].source, 'tool');
});

test('real plays are rebuilt from an export box score only when certain', () => {
  const league = syntheticLeague();
  const { plays } = exportPlays(league, 's9001');
  const bomb = plays.find((p) => p.type === 'Long completion' || p.type === 'Touchdown pass');
  assert.ok(bomb, 'the 45-yard completion is matched to the one receiver whose longest catch was 45');
  assert.deepEqual(bomb.playerIds, ['r1', 'r4']);
  assert.equal(bomb.touchdown, false, 'not every catch he made was a touchdown, so it is not called one');
  const td = plays.find((p) => p.type === 'Touchdown catch');
  assert.ok(td && td.playerIds[0] === 'r6', 'a player whose only catch scored had a touchdown catch');
  const fg = plays.find((p) => /field goal/i.test(p.type));
  assert.ok(fg && fg.yards === 48);
  const h = highlightsForGame(league, 's9001', computeGame(league, 's9001', { events: [] }));
  assert.ok(h.highlights.some((m) => m.source === 'box score (real play)'));
});

test('the points breakdown adds up to the final score', () => {
  const league = syntheticLeague();
  const bd = scoringBreakdown(league, 's9001');
  assert.equal(bd.c101.final, 27);
  assert.equal(bd.c101.passTD, 3);
  assert.equal(bd.c101.fg, 2);
  assert.equal(bd.c101.xp, 3);
  assert.equal(bd.c101.complete, true);
  assert.equal(bd.c102.unexplained, null, 'no kicking stats, so no claim either way');
});

test('box score and passer rating', () => {
  const league = syntheticLeague();
  const b = boxScore(league, 's9001');
  assert.equal(b.teams.c101.passing[0].yards, 310);
  assert.equal(b.teams.c101.kicking[0].points, 9);
  assert.equal(b.lineScore, null, 'no scoring log in an export, so no quarter-by-quarter line');
  assert.ok(b.teamStats.some((r) => r.label === 'Penalties' && r.home === 6));
  assert.equal(passerRating({ PASSATTEMPTS: 20, PASSCOMPLETED: 20, PASSYARDS: 300, PASSTDS: 4, PASSINTS: 0 }), 158.3, 'a perfect game is 158.3');
});

test('power rankings, playoff picture and fantasy points', () => {
  const league = syntheticLeague();
  const pr = powerRankings(league, 'reg', league.games.s9001.seasonYear, league.games.s9001.week);
  assert.equal(pr[0].abbr, 'KC', 'the winner ranks first');
  assert.equal(pr[0].record, '1-0');
  const pp = playoffPicture(league, league.games.s9001.seasonYear, league.games.s9001.week);
  assert.equal(pp.length, 1, 'both teams are in the AFC');
  assert.equal(pp[0].teams[0].abbr, 'KC');
  assert.equal(pp[0].teams[0].how, 'Division leader');
  assert.equal(fantasyPoints({ offense: { RECEIVECATCHES: 5, RECEIVEYARDS: 100, RECEIVETDS: 1 } }), 21);
});
