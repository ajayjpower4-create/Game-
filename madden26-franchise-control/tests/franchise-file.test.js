// Runs only when a Madden 26 save is available (set M26_TEST_FILE or keep the
// madden-franchise repo test data next to this checkout).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FranchiseService } from '../src/core/franchise/service.js';
import { StatsEngine } from '../src/core/stats/engine.js';

const candidates = [process.env.M26_TEST_FILE, '/home/user/bep713/madden-franchise/tests/data/CAREER-TESTSAVE-26'].filter(Boolean);
const source = candidates.find((p) => fs.existsSync(p));

test('reads a real Madden 26 save and writes an injury', { skip: source ? false : 'no Madden 26 test save available' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm26fc-'));
  const work = path.join(dir, 'CAREER-TEST');
  fs.copyFileSync(source, work);
  const svc = new FranchiseService({ backupDir: path.join(dir, 'backups') });
  const league = await svc.open(work);
  assert.equal(league.gameYear, 26);
  assert.equal(Object.keys(league.teams).length, 32);
  assert.ok(Object.keys(league.players).length > 2000);
  assert.ok(Object.keys(league.games).length > 250);
  const played = Object.values(league.games).filter((g) => g.status === 'played');
  assert.ok(played.length > 0);
  const stats = league.playerGameStats[played[0].gameId];
  assert.ok(Object.values(stats).some((e) => e.snapsRecorded && e.snaps > 0), 'real snap counts are read');
  const engine = new StatsEngine();
  const result = engine.game(league, played[0].gameId, { events: [] });
  const home = result.teams[played[0].homeTeamId];
  assert.ok(home.snaps.summary.recorded);
  assert.ok(home.blocking.blockers.length >= 5);
  const player = Object.values(league.players).find((p) => p.teamId === played[0].homeTeamId && p.position === 'RT' && p.injury.status === 'Uninjured');
  const applied = await svc.applyInjury({ playerId: player.playerId, gameId: played[0].gameId, injuryKey: 'AnkleHighSprain', weeks: 4 });
  assert.equal(applied.written.InjuryStatus, 'Injured');
  assert.ok(fs.existsSync(applied.backupPath));
  assert.equal(svc.league.players[player.playerId].injury.status, 'Injured');
  assert.equal(svc.league.players[player.playerId].injury.weeksTotal, 4);
  const healed = await svc.heal(player.playerId);
  assert.equal(healed.written.InjuryStatus, 'Uninjured');
  fs.rmSync(dir, { recursive: true, force: true });
});
