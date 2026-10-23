// ZIP reading and writing.
// Reading only loads the parts of a (possibly huge) vehicle zip that are asked for.
// Writing stores files uncompressed: PNGs are already compressed, and stored zips
// open everywhere (Windows Explorer, 7-Zip, BeamNG).
const Zip = (() => {
  const CRC_TABLE = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    CRC_TABLE[n] = c >>> 0;
  }

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function dosTime(d) {
    return {
      time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
      date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    };
  }

  // Local records and central directory entries for new files, starting at byte `base`.
  function records(files, base) {
    const enc = new TextEncoder();
    const { time, date } = dosTime(new Date());
    const locals = [];
    const central = [];
    let offset = base;
    for (const file of files) {
      const name = enc.encode(file.name);
      const data = typeof file.data === 'string' ? enc.encode(file.data) : file.data;
      const crc = crc32(data);

      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true);
      local.setUint16(4, 20, true);
      local.setUint16(6, 0x0800, true); // names are UTF-8
      local.setUint16(8, 0, true);      // stored
      local.setUint16(10, time, true);
      local.setUint16(12, date, true);
      local.setUint32(14, crc, true);
      local.setUint32(18, data.length, true);
      local.setUint32(22, data.length, true);
      local.setUint16(26, name.length, true);
      locals.push(new Uint8Array(local.buffer), name, data);

      const cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true);
      cd.setUint16(4, 20, true);
      cd.setUint16(6, 20, true);
      cd.setUint16(8, 0x0800, true);
      cd.setUint16(12, time, true);
      cd.setUint16(14, date, true);
      cd.setUint32(16, crc, true);
      cd.setUint32(20, data.length, true);
      cd.setUint32(24, data.length, true);
      cd.setUint16(28, name.length, true);
      cd.setUint32(42, offset, true);
      central.push(new Uint8Array(cd.buffer), name);

      offset += 30 + name.length + data.length;
    }
    return { locals, central, end: offset };
  }

  function endRecord(count, cdSize, cdStart) {
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, count, true);
    end.setUint16(10, count, true);
    end.setUint32(12, cdSize, true);
    end.setUint32(16, cdStart, true);
    return new Uint8Array(end.buffer);
  }

  // files: [{ name: 'folder/file.png', data: Uint8Array | string }]
  function build(files) {
    const r = records(files, 0);
    const cdSize = r.central.reduce((n, p) => n + p.length, 0);
    return new Blob([...r.locals, ...r.central, endRecord(files.length, cdSize, r.end)], { type: 'application/zip' });
  }

  function decodeName(bytes, flags) {
    if (flags & 0x800) return new TextDecoder().decode(bytes);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch (e) { return String.fromCharCode(...bytes); }
  }

  async function open(file) {
    const size = file.size;
    const tailLen = Math.min(size, 65557);
    const tail = new DataView(await file.slice(size - tailLen).arrayBuffer());
    let eocd = -1;
    for (let i = tailLen - 22; i >= 0; i--) if (tail.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('"' + file.name + '" is not a zip file, or it is damaged.');
    let count = tail.getUint16(eocd + 10, true);
    let cdSize = tail.getUint32(eocd + 12, true);
    let cdOffset = tail.getUint32(eocd + 16, true);
    let zip64 = false;
    if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
      const loc = eocd - 20;
      if (loc >= 0 && tail.getUint32(loc, true) === 0x07064b50) {
        const recAt = Number(tail.getBigUint64(loc + 8, true));
        const rec = new DataView(await file.slice(recAt, recAt + 56).arrayBuffer());
        if (rec.getUint32(0, true) === 0x06064b50) {
          count = Number(rec.getBigUint64(32, true));
          cdSize = Number(rec.getBigUint64(40, true));
          cdOffset = Number(rec.getBigUint64(48, true));
          zip64 = true;
        }
      }
    }
    const cd = new Uint8Array(await file.slice(cdOffset, cdOffset + cdSize).arrayBuffer());
    const dv = new DataView(cd.buffer);
    const entries = [];
    let p = 0;
    while (p + 46 <= cd.length && dv.getUint32(p, true) === 0x02014b50) {
      const flags = dv.getUint16(p + 8, true);
      const method = dv.getUint16(p + 10, true);
      let csize = dv.getUint32(p + 20, true);
      let usize = dv.getUint32(p + 24, true);
      const n = dv.getUint16(p + 28, true), m = dv.getUint16(p + 30, true), c = dv.getUint16(p + 32, true);
      let offset = dv.getUint32(p + 42, true);
      if (usize === 0xffffffff || csize === 0xffffffff || offset === 0xffffffff) {
        for (let e = p + 46 + n; e + 4 <= p + 46 + n + m;) {
          const id = dv.getUint16(e, true), len = dv.getUint16(e + 2, true);
          if (id === 1) {
            let q = e + 4;
            if (usize === 0xffffffff) { usize = Number(dv.getBigUint64(q, true)); q += 8; }
            if (csize === 0xffffffff) { csize = Number(dv.getBigUint64(q, true)); q += 8; }
            if (offset === 0xffffffff) { offset = Number(dv.getBigUint64(q, true)); }
            zip64 = true;
          }
          e += 4 + len;
        }
      }
      const name = decodeName(cd.subarray(p + 46, p + 46 + n), flags);
      entries.push({ name, lower: name.toLowerCase(), flags, method, csize, usize, offset, raw: cd.subarray(p, p + 46 + n + m + c) });
      p += 46 + n + m + c;
    }
    const byName = new Map();
    for (const e of entries) byName.set(e.lower, e);
    return { file, entries, byName, cdOffset, zip64 };
  }

  async function read(zip, entry) {
    if (entry.flags & 1) throw new Error(entry.name + ' is password protected.');
    const lh = new DataView(await zip.file.slice(entry.offset, entry.offset + 30).arrayBuffer());
    if (lh.getUint32(0, true) !== 0x04034b50) throw new Error('The zip is damaged at ' + entry.name);
    const start = entry.offset + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
    const blob = zip.file.slice(start, start + entry.csize);
    if (entry.method === 0) return new Uint8Array(await blob.arrayBuffer());
    if (entry.method === 8) {
      if (typeof DecompressionStream === 'undefined') throw new Error('This browser is too old to open zip files. Please update Chrome, Edge or Firefox.');
      const out = blob.stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(out).arrayBuffer());
    }
    throw new Error(entry.name + ' is packed in a way this app can\'t read (zip method ' + entry.method + '). Re-zip the vehicle with normal "Deflate" compression.');
  }

  async function readText(zip, entry) {
    return new TextDecoder().decode(await read(zip, entry));
  }

  // A copy of `zip` with `files` added. Entries for which drop(name) is true are left out.
  // Every kept entry is copied byte for byte, so nothing else in the vehicle changes.
  function rebuild(zip, files, drop) {
    const keep = zip.entries.filter((e) => !drop(e.name));
    const count = keep.length + files.length;
    if (zip.zip64 || zip.cdOffset > 0xf0000000 || count > 0xfff0) throw new Error('This vehicle file is too big to rebuild. Use the separate livery file instead.');
    const r = records(files, zip.cdOffset);
    const centralOld = keep.map((e) => e.raw);
    const cdSize = centralOld.reduce((n, b) => n + b.length, 0) + r.central.reduce((n, b) => n + b.length, 0);
    return new Blob([zip.file.slice(0, zip.cdOffset), ...r.locals, ...centralOld, ...r.central, endRecord(count, cdSize, r.end)], { type: 'application/zip' });
  }

  return { build, open, read, readText, rebuild, crc32 };
})();
