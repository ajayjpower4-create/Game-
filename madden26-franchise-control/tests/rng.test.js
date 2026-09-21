import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, apportion, hashString } from '../src/core/rng.js';

test('rng is deterministic for the same seed', () => {
  const a = makeRng('a', 1, 'x');
  const b = makeRng('a', 1, 'x');
  assert.equal(a.next(), b.next());
  assert.equal(a.int(1, 10), b.int(1, 10));
  assert.notEqual(makeRng('a').next(), makeRng('b').next());
});

test('apportion hands out exactly the total', () => {
  const rng = makeRng('t');
  const out = apportion(10, [1, 1, 1], rng);
  assert.equal(out.reduce((s, v) => s + v, 0), 10);
  assert.deepEqual(apportion(0, [1, 2], rng), [0, 0]);
  assert.equal(apportion(5, [0, 0], rng).reduce((s, v) => s + v, 0), 5);
  assert.deepEqual(apportion(7, [], rng), []);
});

test('hashString is stable', () => {
  assert.equal(hashString('madden'), hashString('madden'));
  assert.notEqual(hashString('madden'), hashString('Madden'));
});
