// Reads .dds textures (BC1/DXT1, BC2/DXT3, BC3/DXT5, BC4, BC5, BC7 and plain RGBA)
// so a vehicle's existing texture can be used as the template. Only the top
// mip level is decoded.
const DDS = (() => {
  const FOURCC = (s) => s.charCodeAt(0) | (s.charCodeAt(1) << 8) | (s.charCodeAt(2) << 16) | (s.charCodeAt(3) << 24);

  function unpack565(c) {
    const r = (c >> 11) & 31, g = (c >> 5) & 63, b = c & 31;
    return [(r << 3) | (r >> 2), (g << 2) | (g >> 4), (b << 3) | (b >> 2)];
  }

  function colorBlock(view, off, out, w, h, bx, by, alphaFromBlock, forceFour) {
    const c0 = view.getUint16(off, true), c1 = view.getUint16(off + 2, true);
    const bits = view.getUint32(off + 4, true);
    const a = unpack565(c0), b = unpack565(c1);
    const pal = [a.concat(255), b.concat(255)];
    if (c0 > c1 || forceFour) {
      pal.push([(2 * a[0] + b[0]) / 3, (2 * a[1] + b[1]) / 3, (2 * a[2] + b[2]) / 3, 255]);
      pal.push([(a[0] + 2 * b[0]) / 3, (a[1] + 2 * b[1]) / 3, (a[2] + 2 * b[2]) / 3, 255]);
    } else {
      pal.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, 255]);
      pal.push([0, 0, 0, alphaFromBlock ? 255 : 0]);
    }
    for (let py = 0; py < 4; py++) {
      for (let px = 0; px < 4; px++) {
        const x = bx + px, y = by + py;
        if (x >= w || y >= h) continue;
        const p = pal[(bits >>> (2 * (py * 4 + px))) & 3];
        const i = (y * w + x) * 4;
        out[i] = p[0]; out[i + 1] = p[1]; out[i + 2] = p[2];
        if (!alphaFromBlock) out[i + 3] = p[3];
      }
    }
  }

  // BC3 alpha / BC4 / BC5 channel block: two endpoints and 3-bit indices.
  function channelBlock(bytes, off, out, w, h, bx, by, channel) {
    const a0 = bytes[off], a1 = bytes[off + 1];
    const pal = [a0, a1];
    if (a0 > a1) for (let i = 1; i < 7; i++) pal.push(((7 - i) * a0 + i * a1) / 7);
    else {
      for (let i = 1; i < 5; i++) pal.push(((5 - i) * a0 + i * a1) / 5);
      pal.push(0, 255);
    }
    let lo = bytes[off + 2] | (bytes[off + 3] << 8) | (bytes[off + 4] << 16);
    let hi = bytes[off + 5] | (bytes[off + 6] << 8) | (bytes[off + 7] << 16);
    for (let k = 0; k < 16; k++) {
      const idx = k < 8 ? (lo >> (3 * k)) & 7 : (hi >> (3 * (k - 8))) & 7;
      const x = bx + (k & 3), y = by + (k >> 2);
      if (x >= w || y >= h) continue;
      out[(y * w + x) * 4 + channel] = pal[idx];
    }
  }

  function explicitAlphaBlock(bytes, off, out, w, h, bx, by) {
    for (let k = 0; k < 16; k++) {
      const v = (bytes[off + (k >> 1)] >> ((k & 1) * 4)) & 15;
      const x = bx + (k & 3), y = by + (k >> 2);
      if (x >= w || y >= h) continue;
      out[(y * w + x) * 4 + 3] = v * 17;
    }
  }

  // BC7, following Pillow's public-domain (CC0) decoder in libImaging/BcnDecode.c.
  // Per mode: subsets, partition bits, rotation bits, index-select bits, color bits,
  // alpha bits, per-endpoint p-bit, shared p-bit, index bits, second index bits.
  const BC7_MODES = [
    [3, 4, 0, 0, 4, 0, 1, 0, 3, 0], [2, 6, 0, 0, 6, 0, 0, 1, 3, 0], [3, 6, 0, 0, 5, 0, 0, 0, 2, 0], [2, 6, 0, 0, 7, 0, 1, 0, 2, 0],
    [1, 0, 2, 1, 5, 6, 0, 0, 2, 3], [1, 0, 2, 0, 7, 8, 0, 0, 2, 2], [1, 0, 0, 0, 7, 7, 1, 0, 4, 0], [2, 6, 0, 0, 5, 5, 1, 0, 2, 0],
  ];
  const BC7_SI2 = [
    0xcccc, 0x8888, 0xeeee, 0xecc8, 0xc880, 0xfeec, 0xfec8, 0xec80, 0xc800, 0xffec, 0xfe80, 0xe800, 0xffe8, 0xff00, 0xfff0, 0xf000,
    0xf710, 0x008e, 0x7100, 0x08ce, 0x008c, 0x7310, 0x3100, 0x8cce, 0x088c, 0x3110, 0x6666, 0x366c, 0x17e8, 0x0ff0, 0x718e, 0x399c,
    0xaaaa, 0xf0f0, 0x5a5a, 0x33cc, 0x3c3c, 0x55aa, 0x9696, 0xa55a, 0x73ce, 0x13c8, 0x324c, 0x3bdc, 0x6996, 0xc33c, 0x9966, 0x0660,
    0x0272, 0x04e4, 0x4e40, 0x2720, 0xc936, 0x936c, 0x39c6, 0x639c, 0x9336, 0x9cc6, 0x817e, 0xe718, 0xccf0, 0x0fcc, 0x7744, 0xee22,
  ];
  const BC7_SI3 = [
    0xaa685050, 0x6a5a5040, 0x5a5a4200, 0x5450a0a8, 0xa5a50000, 0xa0a05050, 0x5555a0a0, 0x5a5a5050, 0xaa550000, 0xaa555500,
    0xaaaa5500, 0x90909090, 0x94949494, 0xa4a4a4a4, 0xa9a59450, 0x2a0a4250, 0xa5945040, 0x0a425054, 0xa5a5a500, 0x55a0a0a0,
    0xa8a85454, 0x6a6a4040, 0xa4a45000, 0x1a1a0500, 0x0050a4a4, 0xaaa59090, 0x14696914, 0x69691400, 0xa08585a0, 0xaa821414,
    0x50a4a450, 0x6a5a0200, 0xa9a58000, 0x5090a0a8, 0xa8a09050, 0x24242424, 0x00aa5500, 0x24924924, 0x24499224, 0x50a50a50,
    0x500aa550, 0xaaaa4444, 0x66660000, 0xa5a0a5a0, 0x50a050a0, 0x69286928, 0x44aaaa44, 0x66666600, 0xaa444444, 0x54a854a8,
    0x95809580, 0x96969600, 0xa85454a8, 0x80959580, 0xaa141414, 0x96960000, 0xaaaa1414, 0xa05050a0, 0xa0a5a5a0, 0x96000000,
    0x40804080, 0xa9a8a9a8, 0xaaaaaa44, 0x2a4a5254,
  ];
  const BC7_AI0 = [15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 2, 8, 2, 2, 8, 8, 15, 2, 8, 2, 2, 8, 8, 2, 2,
    15, 15, 6, 8, 2, 8, 15, 15, 2, 8, 2, 2, 2, 15, 15, 6, 6, 2, 6, 8, 15, 15, 2, 2, 15, 15, 15, 15, 15, 2, 2, 15];
  const BC7_AI1 = [3, 3, 15, 15, 8, 3, 15, 15, 8, 8, 6, 6, 6, 5, 3, 3, 3, 3, 8, 15, 3, 3, 6, 10, 5, 8, 8, 6, 8, 5, 15, 15,
    8, 15, 3, 5, 6, 10, 8, 15, 15, 3, 15, 5, 15, 15, 15, 15, 3, 15, 5, 5, 5, 8, 5, 10, 5, 10, 8, 13, 15, 12, 3, 3];
  const BC7_AI2 = [15, 8, 8, 3, 15, 15, 3, 8, 15, 15, 15, 15, 15, 15, 15, 8, 15, 8, 15, 3, 15, 8, 15, 8, 3, 15, 6, 10, 15, 15, 10, 8,
    15, 3, 15, 10, 10, 8, 9, 10, 6, 15, 8, 15, 3, 6, 6, 8, 15, 3, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 3, 15, 15, 8];
  const BC7_WEIGHTS = { 2: [0, 21, 43, 64], 3: [0, 9, 18, 27, 37, 46, 55, 64], 4: [0, 4, 9, 13, 17, 21, 26, 30, 34, 38, 43, 47, 51, 55, 60, 64] };

  function bc7Block(src, off, out, w, h, bx, by) {
    const get = (bit, count) => {
      if (!count) return 0;
      const i = off + (bit >> 3);
      return ((src[i] | ((src[i + 1] || 0) << 8)) >> (bit & 7)) & ((1 << count) - 1);
    };
    let mode = 0;
    while (mode < 8 && !(src[off] & (1 << mode))) mode++;
    if (mode === 8) {
      for (let k = 0; k < 16; k++) {
        const x = bx + (k & 3), y = by + (k >> 2);
        if (x < w && y < h) out.set([0, 0, 0, 255], (y * w + x) * 4);
      }
      return;
    }
    const [ns, pb, rb, isb, cb0, ab0, epb, spb, ib, ib2] = BC7_MODES[mode];
    let bit = mode + 1;
    let cb = cb0, ab = ab0;
    const cw = BC7_WEIGHTS[ib], aw = BC7_WEIGHTS[ab && ib2 ? ib2 : ib];
    const partition = get(bit, pb); bit += pb;
    const rotation = get(bit, rb); bit += rb;
    const indexSel = get(bit, isb); bit += isb;
    const numep = ns * 2;
    const ep = [];
    for (let i = 0; i < numep; i++) ep.push([0, 0, 0, 255]);
    for (let c = 0; c < 3; c++) for (let i = 0; i < numep; i++) { ep[i][c] = get(bit, cb); bit += cb; }
    if (ab) for (let i = 0; i < numep; i++) { ep[i][3] = get(bit, ab); bit += ab; }
    const addP = (e, v) => { for (let c = 0; c < 3; c++) e[c] = (e[c] << 1) | v; if (ab) e[3] = (e[3] << 1) | v; };
    if (epb) {
      cb++; if (ab) ab++;
      for (let i = 0; i < numep; i++) { const v = get(bit, 1); bit++; addP(ep[i], v); }
    }
    if (spb) {
      cb++; if (ab) ab++;
      for (let i = 0; i < numep; i += 2) { const v = get(bit, 1); bit++; addP(ep[i], v); addP(ep[i + 1], v); }
    }
    const expand = (v, n) => { v = (v << (8 - n)) & 255; return v | (v >> n); };
    for (const e of ep) {
      for (let c = 0; c < 3; c++) e[c] = expand(e[c], cb);
      if (ab) e[3] = expand(e[3], ab);
    }
    let cibit = bit, aibit = bit + 16 * ib - ns;
    for (let i = 0; i < 16; i++) {
      const s = ns === 2 ? 1 & (BC7_SI2[partition] >> i) : ns === 3 ? 3 & (BC7_SI3[partition] >>> (2 * i)) : 0;
      let n = ib;
      if (i === 0) n--;
      else if (ns === 2 && i === BC7_AI0[partition]) n--;
      else if (ns === 3 && (i === BC7_AI1[partition] || i === BC7_AI2[partition])) n--;
      const i0 = get(cibit, n);
      cibit += n;
      let wc = cw[i0], wa = cw[i0];
      if (ab && ib2) {
        const n2 = i === 0 ? ib2 - 1 : ib2;
        const i1 = get(aibit, n2);
        aibit += n2;
        if (indexSel) { wc = aw[i1]; wa = cw[i0]; } else { wc = cw[i0]; wa = aw[i1]; }
      }
      const e0 = ep[s * 2], e1 = ep[s * 2 + 1];
      const px = [
        ((64 - wc) * e0[0] + wc * e1[0] + 32) >> 6,
        ((64 - wc) * e0[1] + wc * e1[1] + 32) >> 6,
        ((64 - wc) * e0[2] + wc * e1[2] + 32) >> 6,
        ((64 - wa) * e0[3] + wa * e1[3] + 32) >> 6,
      ];
      if (rotation) { const t = px[rotation - 1]; px[rotation - 1] = px[3]; px[3] = t; }
      const x = bx + (i & 3), y = by + (i >> 2);
      if (x < w && y < h) out.set(px, (y * w + x) * 4);
    }
  }

  function decodeBlocks(format, buf, dataOff, w, h) {
    const bytes = new Uint8Array(buf);
    const view = new DataView(buf);
    const out = new Uint8ClampedArray(w * h * 4);
    const blockSize = format === 'bc1' || format === 'bc4' ? 8 : 16;
    if (format === 'bc7') {
      if (dataOff + Math.ceil(w / 4) * Math.ceil(h / 4) * 16 > bytes.length) throw new Error('This DDS file is cut short.');
      for (let by = 0, off = dataOff; by < h; by += 4) for (let bx = 0; bx < w; bx += 4, off += 16) bc7Block(bytes, off, out, w, h, bx, by);
      return out;
    }
    const bw = Math.ceil(w / 4), bh = Math.ceil(h / 4);
    if (dataOff + bw * bh * blockSize > bytes.length) throw new Error('This DDS file is cut short.');
    let off = dataOff;
    for (let by = 0; by < bh; by++) {
      for (let bx = 0; bx < bw; bx++, off += blockSize) {
        const x = bx * 4, y = by * 4;
        if (format === 'bc1') colorBlock(view, off, out, w, h, x, y, false, false);
        else if (format === 'bc2') { explicitAlphaBlock(bytes, off, out, w, h, x, y); colorBlock(view, off + 8, out, w, h, x, y, true, true); }
        else if (format === 'bc3') { channelBlock(bytes, off, out, w, h, x, y, 3); colorBlock(view, off + 8, out, w, h, x, y, true, true); }
        else if (format === 'bc4') {
          channelBlock(bytes, off, out, w, h, x, y, 0);
          for (let k = 0; k < 16; k++) {
            const px = x + (k & 3), py = y + (k >> 2);
            if (px >= w || py >= h) continue;
            const i = (py * w + px) * 4;
            out[i + 1] = out[i + 2] = out[i]; out[i + 3] = 255;
          }
        } else if (format === 'bc5') {
          channelBlock(bytes, off, out, w, h, x, y, 0);
          channelBlock(bytes, off + 8, out, w, h, x, y, 1);
          for (let k = 0; k < 16; k++) {
            const px = x + (k & 3), py = y + (k >> 2);
            if (px >= w || py >= h) continue;
            const i = (py * w + px) * 4;
            const nx = out[i] / 127.5 - 1, ny = out[i + 1] / 127.5 - 1;
            out[i + 2] = (Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)) * 0.5 + 0.5) * 255;
            out[i + 3] = 255;
          }
        }
      }
    }
    return out;
  }

  function maskShift(mask) {
    if (!mask) return { shift: 0, bits: 0 };
    let shift = 0;
    while (!((mask >>> shift) & 1)) shift++;
    let bits = 0;
    while ((mask >>> (shift + bits)) & 1) bits++;
    return { shift, bits };
  }

  function decodeMasked(buf, dataOff, w, h, bpp, masks, hasAlpha) {
    const view = new DataView(buf);
    const out = new Uint8ClampedArray(w * h * 4);
    const bytesPer = bpp / 8;
    const pitch = Math.ceil((w * bpp) / 8);
    const ch = masks.map(maskShift);
    if (dataOff + pitch * h > buf.byteLength) throw new Error('This DDS file is cut short.');
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = dataOff + y * pitch + x * bytesPer;
        let v = 0;
        for (let b = 0; b < bytesPer; b++) v |= view.getUint8(p + b) << (8 * b);
        v >>>= 0;
        const i = (y * w + x) * 4;
        for (let c = 0; c < 4; c++) {
          const { shift, bits } = ch[c];
          if (!bits) { out[i + c] = c === 3 ? 255 : 0; continue; }
          const raw = (v >>> shift) & ((1 << bits) - 1);
          out[i + c] = Math.round((raw * 255) / ((1 << bits) - 1));
        }
        if (!hasAlpha) out[i + 3] = 255;
      }
    }
    return out;
  }

  function decode(buf) {
    const view = new DataView(buf);
    if (buf.byteLength < 128 || view.getUint32(0, true) !== 0x20534444) throw new Error('This is not a DDS file.');
    const h = view.getUint32(12, true), w = view.getUint32(16, true);
    const pfFlags = view.getUint32(80, true);
    const fourCC = view.getUint32(84, true);
    let dataOff = 128;
    let format = null;

    if (pfFlags & 0x4) {
      if (fourCC === FOURCC('DXT1')) format = 'bc1';
      else if (fourCC === FOURCC('DXT2') || fourCC === FOURCC('DXT3')) format = 'bc2';
      else if (fourCC === FOURCC('DXT4') || fourCC === FOURCC('DXT5')) format = 'bc3';
      else if (fourCC === FOURCC('ATI1') || fourCC === FOURCC('BC4U')) format = 'bc4';
      else if (fourCC === FOURCC('ATI2') || fourCC === FOURCC('BC5U')) format = 'bc5';
      else if (fourCC === FOURCC('DX10')) {
        const dxgi = view.getUint32(128, true);
        dataOff = 148;
        if (dxgi >= 70 && dxgi <= 72) format = 'bc1';
        else if (dxgi >= 73 && dxgi <= 75) format = 'bc2';
        else if (dxgi >= 76 && dxgi <= 78) format = 'bc3';
        else if (dxgi >= 79 && dxgi <= 81) format = 'bc4';
        else if (dxgi >= 82 && dxgi <= 84) format = 'bc5';
        else if (dxgi >= 27 && dxgi <= 32) return { width: w, height: h, data: decodeMasked(buf, dataOff, w, h, 32, [0xff, 0xff00, 0xff0000, 0xff000000], true) };
        else if (dxgi === 87 || dxgi === 91) return { width: w, height: h, data: decodeMasked(buf, dataOff, w, h, 32, [0xff0000, 0xff00, 0xff, 0xff000000], true) };
        else if (dxgi === 88 || dxgi === 93) return { width: w, height: h, data: decodeMasked(buf, dataOff, w, h, 32, [0xff0000, 0xff00, 0xff, 0], false) };
        else if (dxgi >= 97 && dxgi <= 99) format = 'bc7';
        else throw new Error('DDS format ' + dxgi + ' is not supported.');
      } else {
        throw new Error('DDS compression "' + String.fromCharCode(fourCC & 255, (fourCC >> 8) & 255, (fourCC >> 16) & 255, fourCC >>> 24) + '" is not supported.');
      }
      return { width: w, height: h, data: decodeBlocks(format, buf, dataOff, w, h) };
    }

    const bpp = view.getUint32(88, true);
    const masks = [view.getUint32(92, true), view.getUint32(96, true), view.getUint32(100, true), view.getUint32(104, true)];
    const hasAlpha = !!(pfFlags & 0x1) && masks[3] !== 0;
    if (pfFlags & 0x40 || pfFlags & 0x20000 || pfFlags & 0x2) {
      if (pfFlags & 0x20000 && !(pfFlags & 0x40)) { masks[1] = masks[2] = masks[0]; } // luminance
      return { width: w, height: h, data: decodeMasked(buf, dataOff, w, h, bpp, masks, hasAlpha) };
    }
    throw new Error('This DDS file type is not supported.');
  }

  return { decode };
})();
