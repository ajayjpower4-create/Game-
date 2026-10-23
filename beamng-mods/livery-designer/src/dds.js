// Reads .dds textures (BC1/DXT1, BC2/DXT3, BC3/DXT5, BC4, BC5 and plain RGBA)
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

  function decodeBlocks(format, buf, dataOff, w, h) {
    const bytes = new Uint8Array(buf);
    const view = new DataView(buf);
    const out = new Uint8ClampedArray(w * h * 4);
    const blockSize = format === 'bc1' || format === 'bc4' ? 8 : 16;
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
        else if (dxgi >= 97 && dxgi <= 99) throw new Error('BC7_DDS');
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
