import test from 'node:test';
import assert from 'node:assert/strict';
import { computeGame, StatsEngine } from '../src/core/stats/engine.js';
import { seasonTotals } from '../src/core/stats/aggregate.js';
import { addEvent, overridesForGame } from '../src/core/tracker/tracker.js';
import { syntheticLeague } from './helpers.js';

const league = syntheticLeague();
const empty = { events: [] };

test('every category is produced for both teams and is deterministic', () => {
  const a = computeGame(league, 's9001', empty);
  const b = computeGame(league, 's9001', empty);
  assert.deepEqual(a, b);
  for (const teamId of ['c101', 'c102']) {
    const t = a.teams[teamId];
    for (const key of ['blocking', 'passRush', 'snaps', 'receiving', 'tackling', 'penalties']) assert.ok(t[key], key);
  }
});

test('blocking respects recorded totals', () => {
  const t = computeGame(league, 's9001', empty).teams.c101;
  assert.equal(t.blocking.summary.sacksAllowed, 2);
  assert.ok(t.blocking.summary.pressuresAllowed >= 2);
  assert.equal(t.blocking.blockers.reduce((s, b) => s + b.sacksAllowed, 0), 2);
  assert.equal(t.blocking.blockers.reduce((s, b) => s + b.pressuresAllowed, 0), t.blocking.summary.pressuresAllowed);
  const rushers = t.blocking.passRush; // Buffalo rushers vs KC
  assert.equal(rushers.reduce((s, r) => s + r.pressures, 0), t.blocking.summary.pressuresAllowed);
  assert.equal(rushers.find((r) => r.name === 'Von Edge').sacks, 2, 'recorded sacks are kept');
  assert.ok(t.blocking.summary.bestBlocker);
  for (const b of t.blocking.blockers) assert.ok(b.avgTimeHeld > 1 && b.avgTimeHeld < 5);
});

test('receiving rebuilds targets from catches, drops and incompletions', () => {
  const t = computeGame(league, 's9001', empty).teams.c101;
  const fast = t.receiving.players.find((r) => r.name === 'Fast Receiver');
  assert.equal(fast.targets, 12, 'catch pct from the export wins');
  assert.equal(fast.source.targets, 'recorded');
  const slot = t.receiving.players.find((r) => r.name === 'Slot Guy');
  assert.ok(slot.targets >= 8);
  assert.equal(slot.drops, 2);
  assert.equal(t.receiving.summary.drops, 3);
});

test('missed tackles come from the opponent broken tackles', () => {
  const t = computeGame(league, 's9001', empty).teams.c101;
  assert.equal(t.tackling.summary.brokenTacklesAllowed, 2);
  assert.equal(t.tackling.players.reduce((s, r) => s + r.missedTackles, 0), t.tackling.summary.missedTackles);
});

test('penalties add up to the recorded team totals', () => {
  const t = computeGame(league, 's9001', empty).teams.c101;
  assert.equal(t.penalties.summary.penalties, 6);
  assert.equal(t.penalties.summary.yards, 55);
  assert.equal(t.penalties.players.reduce((s, r) => s + r.penalties, 0), 6);
});

test('snap counts are bounded by the play count', () => {
  const t = computeGame(league, 's9001', empty).teams.c101;
  const qb = t.snaps.players.find((s) => s.position === 'QB');
  assert.equal(qb.offSnaps, t.snaps.summary.offPlays);
  for (const s of t.snaps.players) {
    assert.ok(s.offSnaps <= t.snaps.summary.offPlays);
    assert.ok(s.defSnaps <= t.snaps.summary.defPlays);
  }
});

test('tracker events override reconstructed numbers', () => {
  const tracker = { events: [] };
  addEvent(tracker, { type: 'pancake', gameId: 's9001', teamId: 'c101', playerId: 'r2' });
  addEvent(tracker, { type: 'pancake', gameId: 's9001', teamId: 'c101', playerId: 'r2' });
  addEvent(tracker, { type: 'missedTackle', gameId: 's9001', teamId: 'c101', playerId: 'r8' });
  addEvent(tracker, { type: 'penalty', gameId: 's9001', teamId: 'c101', playerId: 'r1', penaltyType: 'Delay of Game', yards: 5 });
  addEvent(tracker, { type: 'target', gameId: 's9001', teamId: 'c101', playerId: 'r5' });
  addEvent(tracker, { type: 'snaps', gameId: 's9001', teamId: 'c101', playerId: 'r5', offSnaps: 12, stSnaps: 4 });
  addEvent(tracker, { type: 'sack', gameId: 's9001', teamId: 'c102', playerId: 'r23', againstTeamId: 'c101', againstPlayerId: 'r2' });
  addEvent(tracker, { type: 'hurry', gameId: 's9001', teamId: 'c102', playerId: 'r24', againstTeamId: 'c101', againstPlayerId: 'r3' });
  const ov = overridesForGame(tracker, 's9001');
  assert.equal(ov.c101.pancakes.r2, 2);
  assert.equal(ov.c102.passRush.r23.sacks, 1);
  const t = computeGame(league, 's9001', tracker).teams.c101;
  const lt = t.blocking.blockers.find((b) => b.playerId === 'r2');
  assert.equal(lt.pancakes, 2);
  assert.equal(lt.source.pancakes, 'tracked');
  assert.equal(t.tackling.summary.missedTackles, 1);
  assert.equal(t.tackling.players.find((r) => r.playerId === 'r8').missedTackles, 1);
  assert.equal(t.penalties.summary.penalties, 1);
  assert.equal(t.penalties.summary.source, 'tracked');
  assert.equal(t.receiving.players.find((r) => r.playerId === 'r5').targets, 6, 'never fewer targets than catches');
  const slotSnaps = t.snaps.players.find((s) => s.playerId === 'r5');
  assert.equal(slotSnaps.offSnaps, 12);
  assert.equal(slotSnaps.stSnaps, 4);
  // Von Edge plays for Buffalo, so he shows up in Buffalo's pass rush.
  const buf = computeGame(league, 's9001', tracker).teams.c102;
  const von = buf.passRush.players.find((r) => r.playerId === 'r23');
  assert.equal(von.source.pressures, 'tracked');
  assert.equal(von.sacks, 2, 'recorded box-score sacks are never lowered');
  assert.equal(von.beat.r2, 1);
  assert.equal(t.blocking.summary.pressureSource, 'tracked');
  assert.equal(lt.source.pressures, 'tracked');
  assert.equal(lt.sacksAllowed, 1);
});

test('season totals and leaders aggregate across games', () => {
  const engine = new StatsEngine();
  const totals = seasonTotals(league, engine, empty, { stage: 'reg' });
  assert.equal(totals.games, 1);
  assert.ok(totals.leaders.mostPressures.length);
  assert.ok(totals.leaders.mostSnaps[0].total > 0);
  assert.ok(totals.snaps.players.every((p) => Number.isFinite(p.snapPct)));
  assert.equal(totals.teams.c101.penalties, 6);
  const filtered = seasonTotals(league, engine, empty, { stage: 'reg', teamId: 'c102' });
  assert.ok(filtered.blocking.players.every((b) => b.teamId === 'c102'));
});
