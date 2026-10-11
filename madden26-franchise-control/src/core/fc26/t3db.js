// Reads EA's T3DB databases, the format FC 26 keeps its squads and career
// data in. A career save holds one or more of them (the career's squads and
// the career-mode tables) inside an FBCHUNKS wrapper.
//
// The layout follows the FC 26 file parser in fc26-mcp (MIT, see
// fc26-data/LICENSE-fc26-mcp.txt). Field and table names come from EA's
// own metadata for FC 26 (fc26-data/fifa_ng_db-meta-fc26.xml): the file
// only stores four-letter short names.
//
// Database:   "DB\0\x08\0\0\0\0", u32 size, u32 0, u32 table count, u32 crc,
//             then (short name, u32 offset) per table, u32 crc, tables.
// Table:      u32, u32 record size, 10 bytes, u16 valid records, 4 bytes,
//             u8 field count, 11 bytes, 16 bytes per field (u32 type,
//             u32 bit offset, 4-char short name, u32 bit depth), records.
// Values are bit-packed, least significant bit first. Integers are stored
// minus the field's lowest allowed value.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const FC26_META = path.resolve(HERE, '../../../fc26-data/fifa_ng_db-meta-fc26.xml');
export const DB_MAGIC = Buffer.from([0x44, 0x42, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00]);

const TYPE_STRING = 0;
const TYPE_FLOAT = 4;

let metaCache = null;

// EA's metadata: table and field names by short name, with each integer
// field's lowest value and its type.
export function loadMeta(file = FC26_META) {
  if (metaCache && metaCache.file === file) return metaCache;
  const xml = fs.readFileSync(file, 'utf8');
  const attrs = (tag) => {
    const out = {};
    for (const m of tag.matchAll(/(\w+)="([^"]*)"/g)) out[m[1]] = m[2];
    return out;
  };
  const tables = new Map();
  const tableRe = /<table\s[^>]*>[\s\S]*?<\/table>/g;
  for (const block of xml.matchAll(tableRe)) {
    const head = attrs(block[0].slice(0, block[0].indexOf('>')));
    const fields = new Map();
    for (const f of block[0].matchAll(/<field\s[^>]*\/>/g)) {
      const a = attrs(f[0]);
      fields.set(a.shortname, {
        name: a.name,
        type: (a.type || '').replace('DBOFIELDTYPE_', '').toLowerCase(),
        depth: Number(a.depth) || 0,
        low: Number(a.rangelow) || 0,
        high: a.rangehigh != null ? Number(a.rangehigh) : null,
      });
    }
    tables.set(head.shortname, { name: head.name, shortname: head.shortname, saveGroups: (head.savegroups || '').split(',').filter(Boolean), fields });
  }
  metaCache = { file, tables };
  return metaCache;
}

// Every database in a buffer, wherever it sits.
export function findDatabases(buf) {
  const out = [];
  let at = buf.indexOf(DB_MAGIC);
  while (at >= 0) {
    if (at + 24 <= buf.length) {
      const size = buf.readUInt32LE(at + 8);
      const tableCount = buf.readUInt32LE(at + 16);
      if (size >= 28 && at + size <= buf.length && tableCount > 0 && tableCount < 4096 && 24 + tableCount * 8 + 4 <= size) {
        out.push({ offset: at, size, tableCount, data: buf.subarray(at, at + size) });
        at = buf.indexOf(DB_MAGIC, at + size);
        continue;
      }
    }
    at = buf.indexOf(DB_MAGIC, at + 1);
  }
  return out;
}

// The databases in a save. Most saves store them as they are; if none turn
// up, look inside any zlib streams too.
export function databasesInFile(buf) {
  let dbs = findDatabases(buf);
  let unpacked = null;
  if (!dbs.length) {
    // A compressed save would start its stream near the front.
    let tries = 0;
    for (let i = 0; i < Math.min(buf.length - 1, 0x10000) && !dbs.length && tries < 64; i++) {
      if (buf[i] !== 0x78 || ![0x01, 0x5e, 0x9c, 0xda].includes(buf[i + 1])) continue;
      tries++;
      try {
        unpacked = zlib.inflateSync(buf.subarray(i), { finishFlush: zlib.constants.Z_SYNC_FLUSH });
        dbs = findDatabases(unpacked);
      } catch { /* not a stream */ }
    }
  }
  return { dbs, unpacked: Boolean(unpacked && dbs.length) };
}

function readBits(data, pos, bitOffset, depth) {
  let byte = pos + (bitOffset >> 3);
  let bit = bitOffset & 7;
  let value = 0;
  let read = 0;
  while (read < depth && byte < data.length) {
    const take = Math.min(8 - bit, depth - read);
    value += ((data[byte] >> bit) & ((1 << take) - 1)) * 2 ** read;
    read += take;
    bit = 0;
    byte++;
  }
  return value;
}

function readString(data, start, bytes) {
  const end = Math.min(data.length, start + bytes);
  let stop = data.indexOf(0, start);
  if (stop < 0 || stop > end) stop = end;
  return data.subarray(start, stop).toString('utf8');
}

// One database: its table list, and tables read on demand.
export class T3DB {
  constructor(db, meta = loadMeta()) {
    this.data = db.data;
    this.offset = db.offset;
    this.meta = meta;
    const d = this.data;
    const count = d.readUInt32LE(16);
    this.index = [];
    let at = 24;
    for (let i = 0; i < count; i++) {
      const short = d.subarray(at, at + 4).toString('latin1');
      const off = d.readUInt32LE(at + 4);
      const m = meta.tables.get(short);
      this.index.push({ short, offset: off, name: m ? m.name : null });
      at += 8;
    }
    this.tablesStart = at + 4;
    this.cache = new Map();
  }

  get tableNames() {
    return this.index.filter((t) => t.name).map((t) => t.name);
  }

  has(name) {
    return this.index.some((t) => t.name === name);
  }

  // The table's header and field layout.
  layout(name) {
    const entry = this.index.find((t) => t.name === name);
    if (!entry) return null;
    const d = this.data;
    let pos = this.tablesStart + entry.offset;
    if (pos + 36 > d.length) throw new Error(`Table ${name} starts past the end of its database.`);
    const recordSize = d.readUInt32LE(pos + 4);
    const rows = d.readUInt16LE(pos + 18);
    const fieldCount = d[pos + 24];
    pos += 36;
    const tmeta = this.meta.tables.get(entry.short);
    const fields = [];
    for (let i = 0; i < fieldCount; i++) {
      const short = d.subarray(pos + 8, pos + 12).toString('latin1');
      const fm = tmeta && tmeta.fields.get(short);
      fields.push({ type: d.readUInt32LE(pos), bitOffset: d.readUInt32LE(pos + 4), short, depth: d.readUInt32LE(pos + 12), name: fm ? fm.name : short, kind: fm ? fm.type : null, low: fm ? fm.low : 0 });
      pos += 16;
    }
    fields.sort((a, b) => a.bitOffset - b.bitOffset);
    if (pos + rows * recordSize > d.length) throw new Error(`Table ${name} runs past the end of its database (${rows} rows of ${recordSize} bytes).`);
    return { name, short: entry.short, recordSize, rows, fields, dataStart: pos };
  }

  // Rows as plain objects. `wanted` limits the fields read.
  rows(name, wanted = null) {
    const key = name + '|' + (wanted ? wanted.join(',') : '*');
    if (this.cache.has(key)) return this.cache.get(key);
    const lay = this.layout(name);
    if (!lay) return [];
    const want = wanted ? new Set(wanted) : null;
    const fields = lay.fields.filter((f) => !want || want.has(f.name));
    const d = this.data;
    const out = new Array(lay.rows);
    for (let r = 0; r < lay.rows; r++) {
      const at = lay.dataStart + r * lay.recordSize;
      const row = {};
      for (const f of fields) {
        if (f.type === TYPE_STRING || f.kind === 'string') row[f.name] = readString(d, at + (f.bitOffset >> 3), f.depth >> 3);
        else if (f.type === TYPE_FLOAT || f.kind === 'real') row[f.name] = d.readFloatLE(at + (f.bitOffset >> 3));
        else row[f.name] = readBits(d, at, f.bitOffset, f.depth) + f.low;
      }
      out[r] = row;
    }
    this.cache.set(key, out);
    return out;
  }
}

// FC dates (DBOFIELDTYPE_DATE) count days from 14 October 1582.
const GREGORIAN_START = Date.UTC(1582, 9, 14);
export function fcDate(days) {
  if (!Number.isFinite(days) || days <= 0) return null;
  return new Date(GREGORIAN_START + days * 86400000).toISOString().slice(0, 10);
}

// Career-mode dates are whole numbers like 20250816.
export function ymd(n) {
  if (!Number.isFinite(n) || n < 19000101 || n > 21001231) return null;
  const s = String(n);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}
