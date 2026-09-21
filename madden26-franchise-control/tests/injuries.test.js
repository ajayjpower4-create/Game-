import test from 'node:test';
import assert from 'node:assert/strict';
import { INJURY_TYPES, getInjuryType, severityFor, injuryTypesByPart } from '../src/core/franchise/injury-catalog.js';
import { planInjury, pickInjuryPlay, healFields } from '../src/core/franchise/injuries.js';

test('catalog covers the game enum with unique keys', () => {
  const keys = new Set(INJURY_TYPES.map((t) => t.key));
  assert.equal(keys.size, INJURY_TYPES.length);
  assert.ok(keys.has('KneeACLCompleteTear'));
  assert.ok(keys.has('AnkleAchillesTear'));
  assert.ok(getInjuryType('KneeACLCompleteTear').seasonEnding);
  const byPart = injuryTypesByPart();
  assert.ok(byPart.Knee.length >= 10);
});

test('severity follows the weeks out', () => {
  assert.equal(severityFor(0), 'GameEnding');
  assert.equal(severityFor(3), 'CoupleGames');
  assert.equal(severityFor(10), 'SeveralGames');
  assert.equal(severityFor(20), 'SeasonEnding');
  assert.equal(severityFor(2, { seasonEnding: true }), 'SeasonEnding');
});

test('planInjury fills every Player field the game needs', () => {
  const player = { playerId: 'p1', firstName: 'A', lastName: 'B', position: 'LT' };
  const plan = planInjury({ leagueId: 'L', gameId: 'g1', player, injuryKey: 'KneeACLCompleteTear', week: 5, stage: 'NFLSeason', year: 2, placeOnIR: true });
  assert.equal(plan.fields.InjuryStatus, 'Injured');
  assert.equal(plan.fields.InjuryType, 'KneeACLCompleteTear');
  assert.equal(plan.fields.InjurySeverity, 'SeasonEnding');
  assert.ok(['Left', 'Right'].includes(plan.fields.InjurySide));
  assert.ok(plan.fields.TotalInjuryDuration >= 36);
  assert.equal(plan.fields.MaxInjuryDuration, plan.fields.TotalInjuryDuration);
  assert.equal(plan.fields.LatestInjuryWeek, 5);
  assert.equal(plan.fields.LatestInjuryYear, 2);
  assert.equal(plan.fields.IsInjuredReserve, true);
  assert.equal(plan.fields.CurrentYearSeasonEndingInjuryWeek, 5);
  assert.ok(plan.play.quarter >= 1 && plan.play.quarter <= 4);
  assert.match(plan.play.clock, /^\d{1,2}:\d{2}$/);
  // Deterministic
  const again = planInjury({ leagueId: 'L', gameId: 'g1', player, injuryKey: 'KneeACLCompleteTear', week: 5, stage: 'NFLSeason', year: 2, placeOnIR: true });
  assert.deepEqual(again.play, plan.play);
  assert.equal(again.fields.TotalInjuryDuration, plan.fields.TotalInjuryDuration);
});

test('weeks override and unsided injuries', () => {
  const player = { playerId: 'p1', firstName: 'A', lastName: 'B', position: 'CB' };
  const plan = planInjury({ leagueId: 'L', gameId: 'g1', player, injuryKey: 'BackSpasms', weeks: 2, week: 1, stage: 'NFLSeason', year: 0 });
  assert.equal(plan.fields.TotalInjuryDuration, 2);
  assert.equal(plan.fields.InjurySide, 'NA');
  assert.equal(plan.fields.InjurySeverity, 'CoupleGames');
  assert.equal(plan.fields.IsInjuredReserve, false);
  assert.throws(() => planInjury({ leagueId: 'L', gameId: 'g', player, injuryKey: 'Nope' }));
});

test('injury play uses the right play pool', () => {
  const off = pickInjuryPlay({ leagueId: 'L', gameId: 'g', playerId: 'p', position: 'WR' });
  const def = pickInjuryPlay({ leagueId: 'L', gameId: 'g', playerId: 'p2', position: 'CB' });
  assert.ok(off.playType && def.playType);
  assert.equal(healFields().InjuryStatus, 'Uninjured');
});
