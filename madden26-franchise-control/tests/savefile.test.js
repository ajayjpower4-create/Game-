// Opening saves that are cut short, still being written, or whose franchise
// data was never closed off. Uses the real Madden 26 save when available.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { prepareSave, inspectSave, readHeader, describeSaveCheck, SaveFileError, DATA_OFFSET } from '../src/core/franchise/savefile.js';
import { openFranchise, loadFranchiseLibrary } from '../src/core/franchise/reader.js';
import { FranchiseService } from '../src/core/franchise/service.js';
import { findFranchiseFiles } from '../src/core/franchise/locate.js';

const candidates = [process.env.M26_TEST_FILE, '/home/user/bep713/madden-franchise/tests/data/CAREER-TESTSAVE-26'].filter(Boolean);
const source = candidates.find((p) => fs.existsSync(p));
const skip = source ? false : 'no Madden 26 test save available';

function workDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'm26fc-save-'));
}

// The save with its franchise data written but never closed off, the way a
// stream is left when the writer flushes instead of finishing.
function unclosedCopy(original, { keepTrailer }) {
  const clen = original.readUIntLE(0x4a, 3);
  const unpacked = zlib.inflateSync(original.subarray(DATA_OFFSET, DATA_OFFSET + clen));
  const stream = zlib.deflateSync(unpacked, { finishFlush: zlib.constants.Z_SYNC_FLUSH });
  const header = Buffer.from(original.subarray(0, DATA_OFFSET));
  header.writeUIntLE(stream.length, 0x4a, 3);
  const trailer = keepTrailer ? Buffer.alloc(original.length - DATA_OFFSET - stream.length, 0) : Buffer.alloc(0);
  return { file: Buffer.concat([header, stream, trailer]), unpacked };
}

test('a normal save passes the check untouched', { skip }, async () => {
  const buf = fs.readFileSync(source);
  const info = inspectSave(buf);
  assert.equal(info.container, 'FBCHUNKS');
  assert.equal(info.year, 26);
  assert.equal(info.game, 'Madden');
  assert.equal(info.complete, true);
  const prepared = prepareSave(source);
  assert.equal(prepared.repaired, false);
  assert.ok(prepared.buffer.equals(buf), 'the file bytes are used as they are');
  assert.equal(prepared.info.tableCount, 1895);
  const franchise = await openFranchise(source);
  assert.equal(franchise.saveCheck.tablesRead, 1895);
  assert.equal(franchise.saveCheck.repaired, false);
  assert.equal(readHeader(source).year, 26);
});

test('the error from the bug report is reproduced and then fixed', { skip }, async () => {
  const dir = workDir();
  const file = path.join(dir, 'CAREER-LLL-AUTOSAVE');
  const original = fs.readFileSync(source);
  const { file: bytes } = unclosedCopy(original, { keepTrailer: false });
  fs.writeFileSync(file, bytes);

  // What the app used to do: hand the file straight to the library.
  const Franchise = await loadFranchiseLibrary();
  await assert.rejects(() => Franchise.create(file, { autoUnempty: false }), /unexpected end of file/);

  // What it does now.
  const svc = new FranchiseService({ backupDir: path.join(dir, 'backups') });
  const league = await svc.open(file);
  assert.equal(league.fileCheck.repaired, true);
  assert.equal(league.fileCheck.tablesRead, league.fileCheck.tableCount);
  assert.equal(Object.keys(league.teams).length, 32);
  assert.ok(Object.keys(league.players).length > 2000);
  assert.ok(league.warnings.some((w) => /recovered/.test(w)));

  // Same league as the untouched save.
  const clean = await new FranchiseService({ backupDir: path.join(dir, 'b2') }).open(source);
  assert.equal(Object.keys(league.players).length, Object.keys(clean.players).length);
  assert.equal(Object.keys(league.games).length, Object.keys(clean.games).length);

  // A write leaves a normal, closed file behind, and backs up the original.
  const player = Object.values(league.players).find((p) => p.injury.status === 'Uninjured' && p.teamId);
  const applied = await svc.applyInjury({ playerId: player.playerId, injuryKey: 'AnkleHighSprain', weeks: 2 });
  assert.ok(fs.readFileSync(applied.backupPath).equals(bytes), 'the backup is the file as it was');
  const after = prepareSave(file);
  assert.equal(after.repaired, false, 'the written file opens without any recovery');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('an unclosed stream followed by old data is recovered too', { skip }, async () => {
  const dir = workDir();
  const file = path.join(dir, 'CAREER-OLDDATA');
  const { file: bytes, unpacked } = unclosedCopy(fs.readFileSync(source), { keepTrailer: true });
  fs.writeFileSync(file, bytes);
  const prepared = prepareSave(file);
  assert.equal(prepared.repaired, true);
  assert.equal(prepared.info.unpackedLength, unpacked.length);
  const franchise = await openFranchise(file);
  assert.equal(franchise.saveCheck.tablesRead, 1895);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a save that is cut short says so instead of failing with a zlib error', { skip }, async () => {
  const dir = workDir();
  const file = path.join(dir, 'CAREER-HALF');
  const original = fs.readFileSync(source);
  const clen = original.readUIntLE(0x4a, 3);
  fs.writeFileSync(file, original.subarray(0, DATA_OFFSET + Math.floor(clen / 2)));
  await assert.rejects(() => openFranchise(file), (e) => {
    assert.ok(e instanceof SaveFileError);
    assert.equal(e.code, 'TRUNCATED');
    assert.match(e.message, /cut short/);
    assert.match(e.message, /OneDrive/);
    assert.match(describeSaveCheck(e.details), /Compressed data: \d+ bytes/);
    return true;
  });
  fs.rmSync(dir, { recursive: true, force: true });
});

test('files that are not franchise saves get a plain message', async () => {
  const dir = workDir();
  const empty = path.join(dir, 'CAREER-EMPTY');
  fs.writeFileSync(empty, Buffer.alloc(10));
  assert.throws(() => prepareSave(empty), (e) => e.code === 'EMPTY');
  const junk = path.join(dir, 'CAREER-JUNK');
  fs.writeFileSync(junk, Buffer.alloc(200000, 7));
  assert.throws(() => prepareSave(junk), (e) => e.code === 'NOT_FRANCHISE' && /not a Madden franchise file/.test(e.message));
  assert.throws(() => prepareSave(path.join(dir, 'CAREER-GONE')), (e) => e.code === 'ENOENT' && /not there/.test(e.message));
  fs.rmSync(dir, { recursive: true, force: true });
});

test("saves in Madden's saves folder on OneDrive are found, with the year read from the file", { skip }, () => {
  const home = workDir();
  const dir = path.join(home, 'OneDrive', 'Documents', 'Madden NFL 26', 'saves');
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(source, path.join(dir, 'CAREER-LLL-AUTOSAVE'));
  fs.copyFileSync(source, path.join(dir, 'CAREER-LLL'));
  const { files } = findFranchiseFiles({ home, env: {} });
  assert.deepEqual(files.map((f) => f.name).sort(), ['CAREER-LLL', 'CAREER-LLL-AUTOSAVE']);
  assert.ok(files.every((f) => f.year === 26 && f.game === 'Madden' && f.cutShort === false));
  // A folder the app only knows from a past open still shows the right year.
  const other = path.join(home, 'Elsewhere');
  fs.mkdirSync(other);
  fs.copyFileSync(source, path.join(other, 'CAREER-COPY'));
  const extra = findFranchiseFiles({ home: path.join(home, 'nobody'), env: {}, extraDirs: [other] });
  assert.equal(extra.files[0].year, 26);
  fs.rmSync(home, { recursive: true, force: true });
});
