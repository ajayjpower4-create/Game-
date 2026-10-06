// Runs only when a Madden 26 save is available (set M26_TEST_FILE or keep the
// madden-franchise repo test data next to this checkout).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FranchiseService } from '../src/core/franchise/service.js';
import { StatsEngine } from '../src/core/stats/engine.js';
import { weeklyRecap } from '../src/core/stats/recap.js';
import { contractsReport } from '../src/core/contracts.js';
import { planScheduleChange, weekOpponents, reversePlan } from '../src/core/franchise/schedule.js';
import { openFranchise } from '../src/core/franchise/reader.js';

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

test('reads contracts, the salary cap and league news from a real save', { skip: source ? false : 'no Madden 26 test save available' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm26fc-'));
  const work = path.join(dir, 'CAREER-TEST');
  fs.copyFileSync(source, work);
  const league = await new FranchiseService({ backupDir: path.join(dir, 'backups') }).open(work);
  // The 2025 NFL cap, solved from the teams' cap room
  assert.equal(league.salaryCap.cap, 279200000);
  const allen = Object.values(league.players).find((p) => p.fullName === 'Josh Allen' && p.position === 'QB');
  assert.equal(allen.contract.capHit, 36330000);
  assert.equal(allen.contract.length, 6);
  assert.equal(allen.contract.years[0].capHit, allen.contract.capHit, 'salary + prorated bonus is the cap hit');
  assert.equal(allen.devTrait, 'X-Factor');
  const report = contractsReport(league, { teamId: allen.teamId });
  assert.equal(report.team.cap.teamCap - report.team.cap.room, report.team.cap.spent);
  assert.equal(report.players[0].name, 'Josh Allen', 'his is the biggest cap hit on the Bills');
  assert.ok(league.news.stories.length > 0);
  const first = Object.values(league.games).find((g) => g.status === 'played');
  const recap = weeklyRecap(league, new StatsEngine(), { events: [] }, { stage: first.stage, week: first.week });
  assert.ok(recap.scores.filter((s) => s.status === 'played').every((s) => Number.isFinite(s.homeScore) && s.homeRecord));
  assert.ok(recap.stories.length > 0, "Madden's stories for the week are in the recap");
  assert.ok(recap.injuries.some((i) => i.source === 'game-list'), "Madden's own game injury lists are in the recap");
  assert.ok(recap.injuries.length > 20, 'plus the injury report for the week');
});

test('changes a matchup in a real save, reads it back, and undoes it exactly', { skip: source ? false : 'no Madden 26 test save available' }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm26fc-'));
  const work = path.join(dir, 'CAREER-TEST');
  fs.copyFileSync(source, work);
  const svc = new FranchiseService({ backupDir: path.join(dir, 'backups') });
  const league = await svc.open(work);
  const game = Object.values(league.games).find((g) => g.stage === 'reg' && g.week === 6);
  const teamId = game.homeTeamId;
  const target = weekOpponents(league, game).find((o) => !o.bye && o.teamId !== game.homeTeamId && o.teamId !== game.awayTeamId);
  const plan = planScheduleChange(league, { gameId: game.gameId, teamId, newOpponentId: target.teamId });
  await svc.applyScheduleChange(plan);
  const changed = svc.league.games[game.gameId];
  assert.ok(changed.homeTeamId === target.teamId || changed.awayTeamId === target.teamId, 'the new opponent is in the game');
  const week = Object.values(svc.league.games).filter((g) => g.stage === 'reg' && g.week === 6);
  const count = {};
  for (const g of week) for (const t of [g.homeTeamId, g.awayTeamId]) count[t] = (count[t] || 0) + 1;
  assert.ok(Object.values(count).every((c) => c === 1), 'every team plays once that week');
  await svc.applyScheduleChange(reversePlan(plan));
  const orig = await openFranchise(source);
  const now = await openFranchise(work);
  const differing = orig.tables.filter((t, i) => Buffer.compare(Buffer.from(t.data), Buffer.from(now.tables[i].data)) !== 0).map((t) => t.name);
  assert.deepEqual(differing, [], 'after undo the save is identical to the original');
});
