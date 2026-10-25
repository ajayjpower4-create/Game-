// Finds the words inside a box on a livery picture, works out how they look (color,
// outline, size, boldness, lines) and erases them by filling in the background.
const TextFix = (() => {
  const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const hex = (c) => '#' + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');

  // How far color c is from the straight line between colors a and b (anti-aliased
  // edge pixels sit on that line; a real outline color does not).
  function offLine(c, a, b) {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const len = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1;
    const t = Math.min(1, Math.max(0, (ac[0] * ab[0] + ac[1] * ab[1] + ac[2] * ab[2]) / len));
    return Math.sqrt(dist2(c, [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t]));
  }

  // Distance (in pixels) from every marked pixel to the nearest unmarked one.
  function distanceInside(mask, w, h) {
    const d = new Float32Array(w * h);
    const BIG = 1e6;
    for (let i = 0; i < w * h; i++) d[i] = mask[i] ? BIG : 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!d[i]) continue;
      d[i] = Math.min(d[i], (x ? d[i - 1] : 0) + 1, (y ? d[i - w] : 0) + 1);
    }
    for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!d[i]) continue;
      d[i] = Math.min(d[i], (x < w - 1 ? d[i + 1] : 0) + 1, (y < h - 1 ? d[i + w] : 0) + 1);
    }
    return d;
  }

  function median(values) {
    const v = values.slice().sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)] : 0;
  }

  // Fills the marked pixels from the nearest unmarked pixels in the same row and column,
  // so flat colors and gradients continue smoothly under the old words.
  function inpaint(src, mask, w, h) {
    const out = new Uint8ClampedArray(w * h * 4);
    const sum = new Float32Array(w * h * 3), wsum = new Float32Array(w * h);
    const runs = (len, at) => {
      let i = 0;
      while (i < len) {
        if (!mask[at(i)]) { i++; continue; }
        let j = i;
        while (j < len && mask[at(j)]) j++;
        const a = i - 1, b = j; // known neighbors (may be outside)
        const wt = 1 / (j - i + 1);
        for (let k = i; k < j; k++) {
          let c;
          if (a >= 0 && b < len) {
            const t = (k - a) / (b - a), pa = at(a) * 4, pb = at(b) * 4;
            c = [src[pa] + (src[pb] - src[pa]) * t, src[pa + 1] + (src[pb + 1] - src[pa + 1]) * t, src[pa + 2] + (src[pb + 2] - src[pa + 2]) * t];
          } else if (a >= 0 || b < len) {
            const p = at(a >= 0 ? a : b) * 4;
            c = [src[p], src[p + 1], src[p + 2]];
          } else continue;
          const q = at(k);
          sum[q * 3] += c[0] * wt; sum[q * 3 + 1] += c[1] * wt; sum[q * 3 + 2] += c[2] * wt;
          wsum[q] += wt;
        }
        i = j;
      }
    };
    for (let y = 0; y < h; y++) runs(w, (x) => y * w + x);
    for (let x = 0; x < w; x++) runs(h, (y) => y * w + x);
    for (let i = 0; i < w * h; i++) {
      if (!mask[i] || !wsum[i]) continue;
      out[i * 4] = sum[i * 3] / wsum[i];
      out[i * 4 + 1] = sum[i * 3 + 1] / wsum[i];
      out[i * 4 + 2] = sum[i * 3 + 2] / wsum[i];
      out[i * 4 + 3] = 255;
    }
    return new ImageData(out, w, h);
  }

  // img: ImageData of the box. Returns null when there are no clear words in it.
  function analyze(img) {
    const { width: w, height: h, data } = img;
    const n = w * h;
    const color = (i) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];

    // Three color groups: the background (most of the box's edge) and up to two text colors.
    const step = Math.max(1, Math.floor(n / 40000));
    const sample = [];
    for (let i = 0; i < n; i += step) sample.push(color(i));
    const edge = [];
    for (let x = 0; x < w; x++) edge.push(x, (h - 1) * w + x);
    for (let y = 0; y < h; y++) edge.push(y * w, y * w + w - 1);
    const bgGuess = [0, 1, 2].map((c) => median(edge.map((i) => data[i * 4 + c])));
    const centers = [bgGuess];
    while (centers.length < 3) {
      let best = null, bestD = -1;
      for (const p of sample) { const d = Math.min(...centers.map((c) => dist2(p, c))); if (d > bestD) { bestD = d; best = p; } }
      centers.push(best.slice());
    }
    for (let it = 0; it < 10; it++) {
      const acc = centers.map(() => [0, 0, 0, 0]);
      for (const p of sample) {
        let k = 0;
        for (let j = 1; j < 3; j++) if (dist2(p, centers[j]) < dist2(p, centers[k])) k = j;
        acc[k][0] += p[0]; acc[k][1] += p[1]; acc[k][2] += p[2]; acc[k][3]++;
      }
      acc.forEach((a, k) => { if (a[3]) centers[k] = [a[0] / a[3], a[1] / a[3], a[2] / a[3]]; });
    }
    const label = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const p = color(i);
      let k = 0;
      for (let j = 1; j < 3; j++) if (dist2(p, centers[j]) < dist2(p, centers[k])) k = j;
      label[i] = k;
    }
    const edgeCount = [0, 0, 0];
    for (const i of edge) edgeCount[label[i]]++;
    const bg = edgeCount.indexOf(Math.max(...edgeCount));
    // Any group that touches a good part of the box's edge, or looks like the background, is background too.
    const isBg = [0, 1, 2].map((k) => k === bg || edgeCount[k] > edge.length * 0.2 || dist2(centers[k], centers[bg]) < 30 * 30);
    const textGroups = [0, 1, 2].filter((k) => !isBg[k]);
    if (!textGroups.length) return null;
    const mask = new Uint8Array(n);
    let textCount = 0;
    for (let i = 0; i < n; i++) if (!isBg[label[i]]) { mask[i] = 1; textCount++; }
    if (textCount < 12 || textCount > n * 0.75) return null;

    // Ink box, ignoring stray specks at the very edges.
    const rowC = new Int32Array(h), colC = new Int32Array(w);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) { rowC[y]++; colC[x]++; }
    let y0 = 0, y1 = h - 1, x0 = 0, x1 = w - 1;
    while (y0 < h && rowC[y0] < 2) y0++;
    while (y1 > y0 && rowC[y1] < 2) y1--;
    while (x0 < w && colC[x0] < 2) x0++;
    while (x1 > x0 && colC[x1] < 2) x1--;
    if (y0 >= y1 || x0 >= x1) return null;

    // Which text color is the letters' fill and which (if any) is an outline around them.
    const dist = distanceInside(mask, w, h);
    const stats = textGroups.map((k) => {
      let c = 0, ds = 0;
      for (let i = 0; i < n; i++) if (label[i] === k) { c++; ds += dist[i]; }
      return { k, count: c, depth: c ? ds / c : 0 };
    });
    stats.sort((a, b) => b.depth - a.depth);
    const fillK = stats[0].k;
    let outline = null;
    if (stats.length > 1) {
      const o = stats[1];
      const looksLikeOutline = o.count > textCount * 0.12 && o.depth < stats[0].depth &&
        offLine(centers[o.k], centers[bg], centers[fillK]) > 50;
      if (looksLikeOutline) outline = { color: hex(centers[o.k]), width: Math.max(1, Math.round(o.depth * 2 - 1)) };
    }

    // Text lines: rows with ink, split where there's a gap.
    const lines = [];
    const minGap = Math.max(2, Math.round((y1 - y0 + 1) * 0.06));
    let start = -1, gap = 0;
    for (let y = y0; y <= y1 + 1; y++) {
      const ink = y <= y1 && rowC[y] >= 1;
      if (ink) { if (start < 0) start = y; gap = 0; }
      else if (start >= 0 && (++gap >= minGap || y > y1)) {
        const end = y - gap;
        if (end - start >= 2) lines.push({ y0: start, y1: end });
        start = -1; gap = 0;
      }
    }
    for (const L of lines) {
      let lx0 = w, lx1 = -1;
      for (let y = L.y0; y <= L.y1; y++) for (let x = x0; x <= x1; x++) if (mask[y * w + x]) { if (x < lx0) lx0 = x; if (x > lx1) lx1 = x; }
      L.x0 = lx0; L.x1 = lx1;
    }
    if (!lines.length) lines.push({ x0, y0, x1, y1 });
    const lineH = median(lines.map((L) => L.y1 - L.y0 + 1));
    const spacing = lines.length > 1 ? (lines[lines.length - 1].y0 + lines[lines.length - 1].y1 - lines[0].y0 - lines[0].y1) / 2 / (lines.length - 1) : 0;
    const spread = (vals) => Math.max(...vals) - Math.min(...vals);
    const align = lines.length < 2 ? 'center'
      : spread(lines.map((L) => L.x0)) < lineH * 0.3 ? 'left'
        : spread(lines.map((L) => L.x1)) < lineH * 0.3 ? 'right' : 'center';

    // Stroke thickness compared with the letter height tells regular, bold or black.
    const fillDepths = [];
    for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 20000))) if (label[i] === fillK) fillDepths.push(dist[i]);
    fillDepths.sort((a, b) => a - b);
    const stroke = 2 * (fillDepths[Math.floor(fillDepths.length * 0.95)] || 1) - (outline ? 2 * outline.width : 0);
    const strokeRatio = Math.max(0, stroke) / Math.max(1, lineH);

    // What gets erased: the letters plus a little around them (soft edges, outline, shadow).
    const grow = 2;
    const erase = new Uint8Array(n);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      for (let dy = -grow; dy <= grow; dy++) for (let dx = -grow; dx <= grow; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < w && yy < h) erase[yy * w + xx] = 1;
      }
    }

    // A clean black-on-white copy, scaled so letters are a good size for reading.
    const scale = Math.min(4, Math.max(0.4, 56 / Math.max(1, lineH)));
    const pad = 24;
    const bw = document.createElement('canvas');
    const cw = Math.round((x1 - x0 + 1) * scale) + pad * 2, ch = Math.round((y1 - y0 + 1) * scale) + pad * 2;
    bw.width = cw; bw.height = ch;
    const bctx = bw.getContext('2d');
    bctx.fillStyle = '#fff';
    bctx.fillRect(0, 0, cw, ch);
    const tmp = document.createElement('canvas');
    tmp.width = x1 - x0 + 1; tmp.height = y1 - y0 + 1;
    const tctx = tmp.getContext('2d');
    const ti = tctx.createImageData(tmp.width, tmp.height);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const o = ((y - y0) * tmp.width + (x - x0)) * 4;
      const v = mask[y * w + x] ? 0 : 255;
      ti.data[o] = ti.data[o + 1] = ti.data[o + 2] = v; ti.data[o + 3] = 255;
    }
    tctx.putImageData(ti, 0, 0);
    bctx.imageSmoothingQuality = 'high';
    bctx.drawImage(tmp, pad, pad, cw - pad * 2, ch - pad * 2);

    return {
      fill: hex(centers[fillK]), background: hex(centers[bg]), outline,
      box: { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1, cx: (x0 + x1 + 1) / 2, cy: (y0 + y1 + 1) / 2 },
      lines, lineH, spacing, align, strokeRatio,
      patch: inpaint(data, erase, w, h),
      readable: bw,
    };
  }

  return { analyze };
})();

// Reads words from a picture with Tesseract, which is packed inside this file so it
// works without the internet. Started the first time it is needed.
const OCR = (() => {
  let ready = null;
  const block = (id) => { const el = document.getElementById(id); return el ? el.textContent : ''; };
  const available = () => !!(window.Tesseract && block('ocr-core').length > 1000);

  function start() {
    if (!ready) {
      ready = (async () => {
        if (!available()) throw new Error('The word reader is not part of this copy of the app.');
        // The worker asks for its English data with fetch(); answer that from the copy in this page.
        const shim = 'self.__ENG = "' + block('ocr-eng').trim() + '";\n' +
          'const __fetch = self.fetch;\n' +
          'self.fetch = (url, opts) => {\n' +
          '  if (!String(url).endsWith("/eng.traineddata.gz")) return __fetch(url, opts);\n' +
          '  const bin = atob(self.__ENG), data = new Uint8Array(bin.length);\n' +
          '  for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);\n' +
          '  return Promise.resolve(new Response(data));\n' +
          '};\n';
        const code = new Blob([shim, block('ocr-core'), '\n;\n', block('ocr-worker')], { type: 'application/javascript' });
        const worker = await window.Tesseract.createWorker('eng', 1, {
          workerPath: URL.createObjectURL(code), workerBlobURL: false, corePath: 'built-in.js',
          langPath: 'https://built-in.livery-designer', cacheMethod: 'none',
        });
        await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
        return worker;
      })();
      ready.catch(() => { ready = null; });
    }
    return ready;
  }

  const clean = (t) => String(t || '').split('\n').map((l) => l.replace(/\s+/g, ' ').replace(/^[|_~`'"\s]+|[|_~`'"\s]+$/g, '').trim()).filter(Boolean).join('\n');

  // Returns { text, confidence } for a canvas; also tries the mirror image (text on
  // the far side of a vehicle is often stored backwards on the texture).
  async function read(canvas) {
    const worker = await start();
    const first = (await worker.recognize(canvas)).data;
    let best = { text: clean(first.text), confidence: first.confidence, mirrored: false };
    if (best.confidence < 70) {
      const m = document.createElement('canvas');
      m.width = canvas.width; m.height = canvas.height;
      const x = m.getContext('2d');
      x.translate(m.width, 0);
      x.scale(-1, 1);
      x.drawImage(canvas, 0, 0);
      const second = (await worker.recognize(m)).data;
      if (second.confidence > best.confidence + 10) best = { text: clean(second.text), confidence: second.confidence, mirrored: true };
    }
    return best;
  }

  return { available, start, read };
})();
