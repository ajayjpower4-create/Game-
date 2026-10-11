// Writes a changed franchise back to disk without risking the save.
//
// The franchise library's own save recompresses the whole franchise and
// writes it straight over the file. That has three ways to hurt a save:
//   - Our compression comes out a little bigger than Madden's (up to ~3% on
//     the test saves). Madden's save is a fixed-size box, so a late-season
//     franchise near the limit can be pushed past it.
//   - The file is truncated and rewritten in place, so anything that stops
//     the write part way (the app closing, OneDrive or Madden touching the
//     file) leaves a broken save.
//   - Nothing checks that only the intended table changed.
// So here: the new franchise data must be the same size as before and may
// only differ inside the tables the change is allowed to touch; it must fit
// in Madden's box; it is written to a temporary file, read back and checked,
// and only then swapped in for the real file.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { DATA_OFFSET, inspectSave } from './savefile.js';

export class WriteRefused extends Error {
  constructor(message, code = 'WRITE_REFUSED') {
    super(message);
    this.name = 'WriteRefused';
    this.code = code;
  }
}

function pause(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// Madden running on this PC (Windows only). This app's own exe has "Madden"
// in its name too, so anything with "Franchise" or "Control" is not Madden.
export function maddenRunning({ list = null } = {}) {
  let out = list;
  if (out == null) {
    if (process.platform !== 'win32') return false;
    try {
      out = execFileSync('tasklist', ['/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true, timeout: 8000 });
    } catch {
      return false;
    }
  }
  return out.split(/\r?\n/).some((line) => {
    const name = (line.split('","')[0] || '').replace(/^"/, '');
    return /^madden.*\.exe$/i.test(name) && !/franchise|control/i.test(name);
  });
}

// Byte ranges of the franchise data that differ between two buffers.
export function changedRanges(a, b) {
  const out = [];
  const step = 4096;
  for (let i = 0; i < a.length; i += step) {
    const end = Math.min(a.length, i + step);
    if (a.subarray(i, end).equals(b.subarray(i, end))) continue;
    for (let j = i; j < end; j++) {
      if (a[j] === b[j]) continue;
      const last = out[out.length - 1];
      if (last && last[1] === j) last[1] = j + 1;
      else out.push([j, j + 1]);
    }
  }
  return out;
}

// The bytes to write for a changed franchise, after checking the change.
// `allowed` are the table objects the change is meant to touch.
export function packChecked(franchise, allowed) {
  const packedBefore = franchise.packedFileContents;
  if (!packedBefore || packedBefore.subarray(0, 8).toString('latin1') !== 'FBCHUNKS') throw new WriteRefused('This file is not in the format the tool knows how to write, so it was left alone.');
  // The library edits its in-memory copy in place, so take "before" from
  // the bytes that were read off the disk.
  const before = zlib.inflateSync(packedBefore.subarray(DATA_OFFSET, inspectSave(packedBefore).compressedEnd));
  const after = franchise.strategy.file.generateUnpackedContents(franchise.tables, franchise.unpackedFileContents);
  if (after.length !== before.length) {
    throw new WriteRefused(`The change would have changed the size of the franchise data (${before.length} to ${after.length} bytes), which a change like this never should. The file was not touched.`);
  }
  const zones = allowed.map((t) => [t.offset, t.offset + t.data.length, t.name]);
  const diffs = changedRanges(before, after);
  const stray = diffs.filter(([s, e]) => !zones.some(([zs, ze]) => s >= zs && e <= ze));
  if (stray.length) {
    const names = new Set();
    for (const [s] of stray.slice(0, 50)) {
      const t = franchise.tables.find((x) => s >= x.offset && s < x.offset + x.data.length);
      names.add(t ? t.name : `byte ${s}`);
    }
    throw new WriteRefused(`The change would also have altered ${[...names].join(', ')}, which it should not touch. The file was not changed.`);
  }
  if (!diffs.length) throw new WriteRefused('Nothing in the file would change.', 'NO_CHANGE');

  // Compress as tightly as zlib can, and make sure it still fits in
  // Madden's box (the file's size, which Madden fixes when it creates it).
  const capacity = packedBefore.length - DATA_OFFSET;
  let packed = zlib.deflateSync(after, { windowBits: 15, level: 9, memLevel: 9 });
  if (packed.length > capacity) {
    const alt = zlib.deflateSync(after, { windowBits: 15, level: 9, memLevel: 9, strategy: zlib.constants.Z_FILTERED });
    if (alt.length < packed.length) packed = alt;
  }
  if (packed.length > capacity) {
    throw new WriteRefused(`This franchise is too full for the tool to write back safely: the data needs ${packed.length} bytes and Madden's save holds ${capacity}. Madden packs it a little tighter than the tool can, so the file was not touched.`, 'TOO_BIG');
  }
  if (packed.length > 0xffffff) throw new WriteRefused('The franchise data is larger than a Madden save can describe. The file was not touched.', 'TOO_BIG');
  const header = Buffer.from(packedBefore.subarray(0, DATA_OFFSET));
  header.writeUIntLE(packed.length, 0x4a, 3);
  const file = Buffer.concat([header, packed, packedBefore.subarray(DATA_OFFSET + packed.length)]);
  return { file, unpacked: after, changed: diffs.reduce((n, [s, e]) => n + e - s, 0), tables: [...new Set(diffs.map(([s]) => (zones.find(([zs, ze]) => s >= zs && s < ze) || [])[2]))] };
}

// Write `file` in place of `target`: to a temporary file first, read back
// and checked, then swapped in.
export function writeChecked(target, file, unpacked) {
  const temp = path.join(path.dirname(target), `.${path.basename(target)}.franchise-control-tmp`);
  fs.writeFileSync(temp, file);
  try {
    const back = fs.readFileSync(temp);
    if (!back.equals(file)) throw new WriteRefused('The new copy did not read back the same as what was written, so the original file was left alone.', 'WRITE_CHECK');
    const info = inspectSave(back);
    const data = zlib.inflateSync(back.subarray(DATA_OFFSET, info.compressedEnd));
    if (!data.equals(unpacked)) throw new WriteRefused('The new copy did not unpack to the changed franchise, so the original file was left alone.', 'WRITE_CHECK');
    let lastErr = null;
    for (let i = 0; i < 6; i++) {
      try {
        fs.renameSync(temp, target);
        return;
      } catch (e) {
        lastErr = e;
        pause(400);
      }
    }
    // Some sync tools hold the old file open; copy over it instead, then
    // make sure the copy landed whole.
    fs.copyFileSync(temp, target);
    if (!fs.readFileSync(target).equals(file)) throw new WriteRefused(`The file could not be replaced cleanly (${lastErr && lastErr.code}).`, 'WRITE_CHECK');
  } finally {
    try { fs.unlinkSync(temp); } catch { /* already moved */ }
  }
}
