// Writing to a franchise: only the intended table changes, the file never
// grows past Madden's save size, writes go through a temp file, Madden being
// open blocks writes, and a save that will not open can get a backup back.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { FranchiseService } from '../src/core/franchise/service.js';
import { planScheduleChange, weekOpponents } from '../src/core/franchise/schedule.js';
import { openFranchise, tableByUniqueIdOrName, readFields, TABLE_IDS } from '../src/core/franchise/reader.js';
import { maddenRunning, packChecked } from '../src/core/franchise/safewrite.js';
import { prepareSave, DATA_OFFSET } from '../src/core/franchise/savefile.js';

const DATA = '/home/user/bep713/madden-franchise/tests/data';
const testSave = [process.env.M26_TEST_FILE, `${DATA}/CAREER-TESTSAVE-26`].filter(Boolean).find((p) => fs.existsSync(p));
const maddenSave = fs.existsSync(`${DATA}/CAREER-26COMPRESS`) ? `${DATA}/CAREER-26COMPRESS` : null;
const skip = testSave ? false : 'no Madden 26 test save available';

function copyTo(src, name = 'CAREER-LLL-AUTOSAVE') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm26fc-write-'));
  const file = path.join(dir, name);
  fs.copyFileSync(src, file);
  return { dir, file };
}

function anySwap(league) {
  const game = Object.values(league.games).find((g) => g.stage === 'reg' && g.week === 6);
  const target = weekOpponents(league, game).find((o) => !o.bye && o.teamId !== game.homeTeamId && o.teamId !== game.awayTeamId);
  return planScheduleChange(league, { gameId: game.gameId, teamId: game.homeTeamId, newOpponentId: target.teamId });
}

test('Madden is spotted in the process list, and this app is not mistaken for it', () => {
  assert.equal(maddenRunning({ list: '"Madden26.exe","1234","Console","1","2,000,000 K"\r\n"explorer.exe","1","Console","1","1 K"' }), true);
  assert.equal(maddenRunning({ list: '"Madden26FranchiseControl-portable.exe","88","Console","1","90,000 K"' }), false);
  assert.equal(maddenRunning({ list: '"Madden 26 Franchise Control.exe","88","Console","1","90,000 K"' }), false);
  assert.equal(maddenRunning({ list: '"chrome.exe","5","Console","1","1 K"' }), false);
});

test('a schedule change rewrites only the schedule table and the file stays the same size', { skip }, async () => {
  const { dir, file } = copyTo(testSave);
  const before = fs.readFileSync(file);
  const svc = new FranchiseService({ backupDir: path.join(dir, 'backups') });
  const league = await svc.open(file);
  const plan = anySwap(league);
  await svc.applyScheduleChange(plan);
  const after = fs.readFileSync(file);
  assert.equal(after.length, before.length, 'never grows past the save size');
  assert.ok(!fs.readdirSync(dir).some((f) => f.includes('franchise-control-tmp')), 'no temp file left behind');
  assert.equal(prepareSave(file).repaired, false, 'the written file is a normal, closed save');
  // Every table except SeasonGame is byte-for-byte what it was.
  const a = await openFranchise(testSave);
  const b = await openFranchise(file);
  const changed = b.tables.filter((t, i) => !t.data.equals(a.tables[i].data)).map((t) => t.name);
  assert.deepEqual([...new Set(changed)], ['SeasonGame']);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a change that would touch another table is refused before the file is written', { skip }, async () => {
  const { dir, file } = copyTo(testSave);
  const franchise = await openFranchise(file);
  const gameT = tableByUniqueIdOrName(franchise, TABLE_IDS.SeasonGame, 'SeasonGame');
  const teamT = tableByUniqueIdOrName(franchise, TABLE_IDS.Team, 'Team');
  await readFields(teamT, ['TeamIndex']);
  const rec = teamT.records.find((r) => !r.isEmpty);
  rec.TeamIndex = (rec.TeamIndex + 1) % 32;
  assert.throws(() => packChecked(franchise, [gameT]), /would also have altered Team/);
  assert.ok(fs.readFileSync(file).equals(fs.readFileSync(testSave)));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a nearly full Madden save is not pushed past its size; the file is left alone', { skip: maddenSave ? false : 'no Madden-written test save' }, async () => {
  // A save Madden wrote, in a box with only a little room to spare. Madden
  // packs tighter than zlib, so the tool's copy would not fit.
  const src = fs.readFileSync(maddenSave);
  const clen = src.readUIntLE(0x4a, 3);
  const unpacked = zlib.inflateSync(src.subarray(DATA_OFFSET, DATA_OFFSET + clen));
  const ours = zlib.deflateSync(unpacked, { level: 9, memLevel: 9 }).length;
  assert.ok(ours > clen, 'Madden packs this save tighter than zlib does');
  const { dir, file } = copyTo(maddenSave);
  fs.writeFileSync(file, src.subarray(0, DATA_OFFSET + clen + 1000));
  const original = fs.readFileSync(file);
  const svc = new FranchiseService({ backupDir: path.join(dir, 'backups') });
  const league = await svc.open(file);
  await assert.rejects(() => svc.applyScheduleChange(anySwap(league)), (e) => e.code === 'TOO_BIG' && /too full/.test(e.message));
  assert.ok(fs.readFileSync(file).equals(original), 'the save is untouched');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('nothing is written while Madden is running', { skip }, async () => {
  const { dir, file } = copyTo(testSave);
  const svc = new FranchiseService({ backupDir: path.join(dir, 'backups') });
  const league = await svc.open(file);
  svc.maddenCheck = () => true;
  await assert.rejects(() => svc.applyScheduleChange(anySwap(league)), (e) => e.code === 'MADDEN_RUNNING' && /Close Madden/.test(e.message));
  const player = Object.values(league.players).find((p) => p.injury.status === 'Uninjured' && p.teamId);
  await assert.rejects(() => svc.applyInjury({ playerId: player.playerId, injuryKey: 'AnkleHighSprain', weeks: 2 }), (e) => e.code === 'MADDEN_RUNNING');
  assert.ok(fs.readFileSync(file).equals(fs.readFileSync(testSave)));
  assert.ok(!fs.existsSync(path.join(dir, 'backups')), 'no backup is made for a refused write');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a save on a newer Madden layout than the tool knows opens read-only', { skip }, async () => {
  const { dir, file } = copyTo(testSave);
  const plan = anySwap(await new FranchiseService().open(file));
  const buf = fs.readFileSync(file);
  buf.writeUInt32LE(9999, 0x3e);
  fs.writeFileSync(file, buf);
  const svc = new FranchiseService({ backupDir: path.join(dir, 'backups') });
  const league = await svc.open(file);
  assert.match(league.writeBlocked, /layout 9999_1/);
  assert.ok(league.warnings.some((w) => /switched off/.test(w)));
  await assert.rejects(() => svc.applyScheduleChange(plan), (e) => e.code === 'LAYOUT');
  assert.ok(fs.readFileSync(file).equals(buf), 'untouched');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a save that will not open can have a backup put back, keeping the broken copy', { skip }, async () => {
  const { dir, file } = copyTo(testSave);
  const svc = new FranchiseService();
  const league = await svc.open(file);
  await svc.applyScheduleChange(anySwap(league));
  const backups = svc.backupsFor(file);
  assert.equal(backups.length, 1);
  // The save gets cut short afterwards.
  const good = fs.readFileSync(file);
  fs.writeFileSync(file, good.subarray(0, 1500000));
  const fresh = new FranchiseService();
  await assert.rejects(() => fresh.open(file), (e) => e.code === 'TRUNCATED');
  const r = await fresh.restoreFileBackup(file, backups[0].file);
  assert.ok(fs.readFileSync(file).equals(fs.readFileSync(testSave)), 'the backup from before the change is back');
  assert.equal(fs.readFileSync(r.kept).length, 1500000, 'the broken copy is kept');
  assert.equal(Object.keys(r.league.teams).length, 32);
  fs.rmSync(dir, { recursive: true, force: true });
});
