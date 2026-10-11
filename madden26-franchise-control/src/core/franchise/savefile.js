// Reads a Madden save off the disk and checks it before the franchise library
// parses it.
//
// A franchise save is a fixed-size box: an "FBCHUNKS" header, then the whole
// franchise as one zlib stream starting at 0x52. The header says how long the
// stream is (3 bytes at 0x4A), and whatever follows it is left over from older
// saves. Inside the stream, the franchise header says how many tables there
// are, which lets us prove a file is complete.
//
// What goes wrong in the real world: Madden or OneDrive is still writing the
// file, OneDrive only has part of it on this PC, or the stream was written
// without its closing block. The first two get a re-read and a clear message;
// the last can be recovered when every table is still there.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

export const DATA_OFFSET = 0x52;
const LENGTH_OFFSET = 0x4a;
const LABEL_START = 0x22;

export class SaveFileError extends Error {
  constructor(message, { code = 'SAVE', details = null } = {}) {
    super(message);
    this.name = 'SaveFileError';
    this.code = code;
    this.details = details;
  }
}

function pause(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

const mb = (n) => `${(n / 1048576).toFixed(2)} MB`;

function readErrorMessage(e, filePath) {
  const name = path.basename(filePath);
  if (e.code === 'ENOENT') return `${name} is not there any more. Madden may have renamed or replaced it; pick it again from the list.`;
  if (e.code === 'EBUSY') return `Windows says ${name} is in use. Madden is probably still saving it. Wait a few seconds and open it again.`;
  if (e.code === 'EACCES' || e.code === 'EPERM') return `Windows would not let this app read ${name}. If it is in OneDrive, right-click it and choose "Always keep on this device", then try again.`;
  // Windows reports cloud-file failures (OneDrive not running, file not
  // downloaded) with codes Node does not name.
  if (e.code === 'UNKNOWN' || e.code === 'EIO') return `${name} could not be read from the disk. If it is in OneDrive, make sure OneDrive is running and the file shows a green check (right-click it and choose "Always keep on this device"), then try again.`;
  return `Could not read ${name}: ${e.message}`;
}

// The whole file, read again if it changed while it was being read.
export function readStable(filePath, { tries = 4, waitMs = 700 } = {}) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    let before;
    let buf;
    let after;
    try {
      before = fs.statSync(filePath);
      buf = fs.readFileSync(filePath);
      after = fs.statSync(filePath);
    } catch (e) {
      if (['EBUSY', 'EPERM', 'EACCES'].includes(e.code) && i < tries - 1) {
        pause(waitMs);
        continue;
      }
      throw new SaveFileError(readErrorMessage(e, filePath), { code: e.code || 'READ', details: { file: path.basename(filePath), path: filePath, readError: `${e.code || ''} ${e.message}`.trim() } });
    }
    if (before.size === after.size && before.mtimeMs === after.mtimeMs && buf.length === after.size) return { buf, stat: after, attempts: i + 1, unstable: false };
    last = { buf, stat: after };
    if (i < tries - 1) pause(waitMs);
  }
  return { ...last, attempts: tries, unstable: true };
}

// Read just the header (cheap; used when listing saves).
export function readHeader(filePath) {
  let fd = null;
  try {
    fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(DATA_OFFSET + 2);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    return inspectSave(buf.subarray(0, n), fs.fstatSync(fd).size);
  } catch {
    return null;
  } finally {
    if (fd !== null) try { fs.closeSync(fd); } catch { /* already closed */ }
  }
}

// What the header says. `size` is the real file size when `buf` is only the
// start of the file.
export function inspectSave(buf, size = buf.length) {
  const info = { size, container: null, label: null, year: null, game: null, compressedLength: null, compressedEnd: null, zlibHeader: null, complete: null };
  const magic = buf.subarray(0, 8).toString('latin1');
  if (magic === 'FBCHUNKS' && buf.length >= DATA_OFFSET) {
    info.container = 'FBCHUNKS';
    info.label = buf.subarray(LABEL_START, DATA_OFFSET).toString('latin1').split('\0')[0].replace(/[^\x20-\x7e]/g, '') || null;
    const m = /^(Madden|College)-(\d{2})/.exec(info.label || '') || /^M(\d{2})_/.exec(info.label || '');
    if (m) {
      info.year = Number(m[2] || m[1]);
      info.game = m[1] === 'College' ? 'College Football' : 'Madden';
    } else if (/^RL\d/.test(info.label || '')) {
      info.year = 19;
      info.game = 'Madden';
    }
    info.compressedLength = buf.readUIntLE(LENGTH_OFFSET, 3);
    info.compressedEnd = DATA_OFFSET + info.compressedLength;
    info.zlibHeader = buf.length > DATA_OFFSET ? buf[DATA_OFFSET] === 0x78 : null;
    info.complete = info.compressedEnd <= size;
  } else if (magic.startsWith('FrTk')) {
    info.container = 'uncompressed';
  } else if (buf[0] === 0x78) {
    info.container = 'zlib';
  }
  return info;
}

// Tables the franchise says it has.
export function tableCountOf(unpacked) {
  if (!unpacked || unpacked.length < 0x18 || unpacked.subarray(0, 4).toString('latin1') !== 'FrTk') return null;
  return unpacked.readUInt32BE(0x14);
}

function damaged(info, filePath) {
  const name = path.basename(filePath);
  if (info.complete === false) {
    return new SaveFileError(
      `${name} is cut short. Its header says the franchise data is ${mb(info.compressedLength)}, but only ${mb(Math.max(0, info.size - DATA_OFFSET))} of it is in the file. ` +
        'That happens when Madden or OneDrive is still writing the file, or when OneDrive has not finished downloading it. ' +
        'Wait a minute and open it again. If it is in OneDrive, right-click it and choose "Always keep on this device". You can also open the copy without -AUTOSAVE.',
      { code: 'TRUNCATED', details: info },
    );
  }
  return new SaveFileError(
    `${name} could not be unpacked (${info.inflateError || 'unknown error'}). Part of the franchise data is missing or damaged. ` +
      'If Madden still loads this franchise, save it again in Madden (or let it autosave), close Madden, and open the new copy here.',
    { code: 'DAMAGED', details: info },
  );
}

// Read and check a save. Returns the bytes the library should parse, which
// are the file's own bytes unless the stream had to be closed off.
export function prepareSave(filePath) {
  const { buf, stat, attempts, unstable } = readStable(filePath);
  const info = { file: path.basename(filePath), path: filePath, ...inspectSave(buf), modified: stat.mtime.toISOString(), attempts, unstable };
  if (buf.length < 1024) throw new SaveFileError(`${info.file} is empty or almost empty (${buf.length} bytes). It is not a franchise save, or it has not finished downloading.`, { code: 'EMPTY', details: info });
  if (!info.container) throw new SaveFileError(`${info.file} is not a Madden franchise file. Franchise saves are the files that start with CAREER- in Madden's saves or settings folder.`, { code: 'NOT_FRANCHISE', details: info });
  if (info.container !== 'FBCHUNKS') return { buffer: buf, info, repaired: false };
  if (!info.zlibHeader) throw new SaveFileError(`${info.file} has a Madden header but its franchise data is not where it should be. A Madden update may have changed the save format.`, { code: 'UNKNOWN_FORMAT', details: info });

  // The normal case: the stream ends where the header says.
  try {
    const out = zlib.inflateSync(buf.subarray(DATA_OFFSET, Math.min(buf.length, info.compressedEnd)));
    info.unpackedLength = out.length;
    info.tableCount = tableCountOf(out);
    return { buffer: buf, info, repaired: false };
  } catch (e) {
    info.inflateError = e.message;
  }

  // It did not. Try the ways a save can still be whole: a stream that runs on
  // past the stated length (a stale length), and a stream that has all its
  // data but no closing block. Keep whichever gives the most data; the caller
  // then checks every table is there before trusting it.
  const Z = zlib.constants;
  const ways = [
    ['longer-than-header', () => zlib.inflateSync(buf.subarray(DATA_OFFSET))],
    ['unclosed-stream', () => zlib.inflateSync(buf.subarray(DATA_OFFSET, Math.min(buf.length, info.compressedEnd)), { finishFlush: Z.Z_SYNC_FLUSH })],
    ['unclosed-to-end', () => zlib.inflateSync(buf.subarray(DATA_OFFSET), { finishFlush: Z.Z_SYNC_FLUSH })],
  ];
  let out = null;
  const failures = [];
  for (const [how, run] of ways) {
    try {
      const r = run();
      if (tableCountOf(r) != null && (!out || r.length > out.length)) {
        out = r;
        info.recovery = how;
      }
    } catch (e) {
      failures.push(`${how}: ${e.message}`);
    }
  }
  if (!out && failures.length) info.recoveryError = failures.join('; ');
  if (!out || tableCountOf(out) == null) throw damaged(info, filePath);
  info.unpackedLength = out.length;
  info.tableCount = tableCountOf(out);

  // Close the stream off and point the header at it, keeping the file size.
  const packed = zlib.deflateSync(out, { windowBits: 15 });
  const header = Buffer.from(buf.subarray(0, DATA_OFFSET));
  header.writeUIntLE(packed.length, LENGTH_OFFSET, 3);
  const rest = buf.length > DATA_OFFSET + packed.length ? buf.subarray(DATA_OFFSET + packed.length) : Buffer.alloc(0);
  return { buffer: Buffer.concat([header, packed, rest]), info, repaired: true, damagedError: () => damaged(info, filePath) };
}

// Plain text for the "copy details" button.
export function describeSaveCheck(info) {
  if (!info) return '';
  const lines = [
    `File: ${info.file || ''}`,
    info.path ? `Path: ${info.path}` : null,
    info.size != null ? `Size: ${info.size} bytes` : null,
    info.modified ? `Saved: ${info.modified}` : null,
    info.container ? `Container: ${info.container}` : null,
    info.label ? `Made by: ${info.label}` : null,
    info.compressedLength != null ? `Compressed data: ${info.compressedLength} bytes (ends at ${info.compressedEnd}, file has ${info.size})` : null,
    info.zlibHeader != null ? `Data header found: ${info.zlibHeader ? 'yes' : 'no'}` : null,
    info.inflateError ? `Unpack error: ${info.inflateError}` : null,
    info.recovery ? `Recovery: ${info.recovery}` : null,
    info.recoveryError ? `Recovery error: ${info.recoveryError}` : null,
    info.unpackedLength != null ? `Unpacked: ${info.unpackedLength} bytes` : null,
    info.tableCount != null ? `Tables in header: ${info.tableCount}` : null,
    info.tablesRead != null ? `Tables read: ${info.tablesRead}` : null,
    info.parseError ? `Parse error: ${info.parseError}` : null,
    info.readError ? `Read error: ${info.readError}` : null,
    info.unstable ? 'The file kept changing while it was read.' : null,
    info.attempts > 1 ? `Read attempts: ${info.attempts}` : null,
  ];
  return lines.filter(Boolean).join('\n');
}
