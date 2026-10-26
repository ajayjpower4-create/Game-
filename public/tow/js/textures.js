// Procedural PBR textures, drawn once on canvases and cached.
// Every surface gets a color map plus a normal map (and usually roughness)
// so it catches light like the real material instead of reading as flat paint.
import * as THREE from 'three';
import { makeCanvas, canvasTexture, heightToNormal, fbmTiling, mulberry32, clamp, roundRect } from './util.js';

const cache = new Map();
function cached(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

function setRepeat(set, rx, ry) {
  for (const t of Object.values(set)) if (t && t.isTexture) t.repeat.set(rx, ry);
  return set;
}

// Clones a texture set so callers can set their own repeat.
export function cloneSet(set, rx = 1, ry = 1) {
  const out = {};
  for (const [k, t] of Object.entries(set)) {
    if (t && t.isTexture) {
      out[k] = t.clone();
      out[k].needsUpdate = true;
      out[k].repeat.set(rx, ry);
    }
  }
  return out;
}

function fill(canvas, fn) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a = 255] = fn(x / w, y / h, x, y);
      const i = (y * w + x) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

// ------------------------------------------------------------------ asphalt
// One tile covers 8 x 8 m of road.
export function asphalt(variant = 0) {
  return cached('asphalt' + variant, () => {
    const N = 1024;
    const rand = mulberry32(17 + variant);
    const base = fbmTiling(3 + variant, 4, 6);
    const fine = fbmTiling(9 + variant, 64, 3);
    const patch = fbmTiling(21 + variant, 2, 3);
    const col = makeCanvas(N, N), hgt = makeCanvas(N, N), rough = makeCanvas(N, N);
    const H = new Float32Array(N * N);
    fill(col, (u, v, x, y) => {
      const n = base(u, v), f = fine(u, v), p = patch(u, v);
      // Aggregate: scattered bright and dark stones.
      const stone = rand();
      let g = 52 + n * 22 + (f - 0.5) * 26;
      if (stone > 0.985) g += 38 * rand();
      else if (stone < 0.02) g -= 18;
      if (p > 0.66) g -= 9; // darker repair patches
      g = variant === 1 ? g * 1.15 : g;
      H[y * N + x] = clamp(f * 0.6 + (stone > 0.97 ? 0.4 : 0) + n * 0.2, 0, 1);
      return [g * 0.98, g, g * 1.04];
    });
    // Tire polish in the wheel tracks + oil drips down the lane center.
    const ctx = col.getContext('2d');
    ctx.globalAlpha = 0.05;
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = rand() > 0.5 ? '#000' : '#2a2620';
      const x = rand() * N, y = rand() * N, r = 3 + rand() * 18;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * (0.4 + rand() * 0.6), rand() * 3, 0, Math.PI * 2); ctx.fill();
    }
    // Hairline cracks with tar seal.
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = '#141414';
    for (let i = 0; i < 9; i++) {
      ctx.lineWidth = 1 + rand() * 2;
      ctx.beginPath();
      let x = rand() * N, y = rand() * N;
      ctx.moveTo(x, y);
      for (let k = 0; k < 14; k++) { x += (rand() - 0.5) * 60; y += (rand() - 0.5) * 60; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    fill(hgt, (u, v, x, y) => { const g = H[y * N + x] * 255; return [g, g, g]; });
    fill(rough, (u, v, x, y) => { const g = 200 + (H[y * N + x] - 0.5) * 60; return [g, g, g]; });
    return {
      map: canvasTexture(col, { repeat: true }),
      normalMap: canvasTexture(heightToNormal(hgt, 3.2), { repeat: true, srgb: false }),
      roughnessMap: canvasTexture(rough, { repeat: true, srgb: false }),
    };
  });
}

// --------------------------------------------------------------- concrete
// Sidewalk slabs: one tile = 3 x 3 m with saw-cut joints every 1.5 m.
export function sidewalk() {
  return cached('sidewalk', () => {
    const N = 512;
    const rand = mulberry32(5);
    const n1 = fbmTiling(41, 4, 5), n2 = fbmTiling(77, 32, 3);
    const col = makeCanvas(N, N), hgt = makeCanvas(N, N);
    const joint = (t) => {
      const d = Math.min(Math.abs(t - 0), Math.abs(t - 0.5), Math.abs(t - 1));
      return d < 0.004;
    };
    fill(col, (u, v) => {
      let g = 168 + (n1(u, v) - 0.5) * 34 + (n2(u, v) - 0.5) * 18;
      if (rand() > 0.995) g -= 30;
      if (joint(u) || joint(v)) g -= 55;
      return [g * 1.0, g * 0.985, g * 0.95];
    });
    // Gum spots and stains.
    const ctx = col.getContext('2d');
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(60,58,55,${0.08 + rand() * 0.15})`;
      ctx.beginPath(); ctx.arc(rand() * N, rand() * N, 1 + rand() * 3, 0, 7); ctx.fill();
    }
    fill(hgt, (u, v) => {
      let g = 150 + n2(u, v) * 60;
      if (joint(u) || joint(v)) g = 40;
      return [g, g, g];
    });
    return {
      map: canvasTexture(col, { repeat: true }),
      normalMap: canvasTexture(heightToNormal(hgt, 2.0), { repeat: true, srgb: false }),
    };
  });
}

export function concrete(seed = 3, tint = [1, 1, 1], brightness = 150) {
  return cached(`concrete${seed}${tint}${brightness}`, () => {
    const N = 512;
    const n1 = fbmTiling(seed, 4, 6), n2 = fbmTiling(seed + 9, 48, 2);
    const col = makeCanvas(N, N), hgt = makeCanvas(N, N);
    fill(col, (u, v) => {
      const g = brightness + (n1(u, v) - 0.5) * 40 + (n2(u, v) - 0.5) * 14;
      return [g * tint[0], g * tint[1], g * tint[2]];
    });
    fill(hgt, (u, v) => { const g = n2(u, v) * 255; return [g, g, g]; });
    return {
      map: canvasTexture(col, { repeat: true }),
      normalMap: canvasTexture(heightToNormal(hgt, 1.2), { repeat: true, srgb: false }),
    };
  });
}

// ------------------------------------------------------------------ brick
// One tile = 2.4 m wide x 1.2 m tall of running bond.
export function brick(color = '#8a3b2a', seed = 1) {
  return cached('brick' + color + seed, () => {
    const W = 512, Hh = 256;
    const rand = mulberry32(seed * 31);
    const noise = fbmTiling(seed + 3, 16, 3);
    const col = makeCanvas(W, Hh), hgt = makeCanvas(W, Hh);
    const c = col.getContext('2d'), h = hgt.getContext('2d');
    const rows = 16, cols = 11;
    const bh = Hh / rows, bw = W / cols;
    const base = new THREE.Color(color);
    c.fillStyle = '#9d968b'; c.fillRect(0, 0, W, Hh);
    h.fillStyle = '#202020'; h.fillRect(0, 0, W, Hh);
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * bw * 0.5;
      for (let k = -1; k <= cols; k++) {
        const x = k * bw + off, y = r * bh;
        const tint = base.clone().offsetHSL((rand() - 0.5) * 0.03, (rand() - 0.5) * 0.12, (rand() - 0.5) * 0.12);
        c.fillStyle = '#' + tint.getHexString();
        c.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
        const g = 150 + rand() * 70;
        h.fillStyle = `rgb(${g},${g},${g})`;
        h.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
      }
    }
    // Weathering.
    const img = c.getImageData(0, 0, W, Hh);
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const n = 0.85 + noise(x / W, y / Hh) * 0.3 + (rand() - 0.5) * 0.08;
      img.data[i] *= n; img.data[i + 1] *= n; img.data[i + 2] *= n;
    }
    c.putImageData(img, 0, 0);
    return {
      map: canvasTexture(col, { repeat: true }),
      normalMap: canvasTexture(heightToNormal(hgt, 2.5), { repeat: true, srgb: false }),
    };
  });
}

// ------------------------------------------------------------------ grass
export function grass() {
  return cached('grass', () => {
    const N = 512;
    const rand = mulberry32(88);
    const n1 = fbmTiling(12, 4, 5), n2 = fbmTiling(13, 64, 2);
    const col = makeCanvas(N, N), hgt = makeCanvas(N, N);
    fill(col, (u, v) => {
      const a = n1(u, v), b = n2(u, v);
      const blade = rand();
      return [52 + a * 40 + blade * 18, 78 + a * 42 + b * 30 + blade * 20, 34 + a * 18];
    });
    fill(hgt, () => { const g = rand() * 255; return [g, g, g]; });
    return {
      map: canvasTexture(col, { repeat: true }),
      normalMap: canvasTexture(heightToNormal(hgt, 1.5), { repeat: true, srgb: false }),
    };
  });
}

// ---------------------------------------------------------- diamond plate
// Aluminium tread plate for the deck, toolboxes and steps. 1 tile = 0.6 m.
export function diamondPlate() {
  return cached('diamond', () => {
    const N = 256;
    const hgt = makeCanvas(N, N), rough = makeCanvas(N, N), col = makeCanvas(N, N);
    const h = hgt.getContext('2d');
    h.fillStyle = '#404040'; h.fillRect(0, 0, N, N);
    const n = fbmTiling(5, 8, 3);
    const cell = N / 8;
    for (let r = -1; r <= 8; r++) {
      for (let k = -1; k <= 8; k++) {
        const cx = k * cell + (r % 2) * cell / 2, cy = r * cell;
        const ang = (r % 2 ? 1 : -1) * Math.PI / 4;
        h.save(); h.translate(cx, cy); h.rotate(ang);
        const g = h.createLinearGradient(-cell * 0.35, 0, cell * 0.35, 0);
        g.addColorStop(0, '#606060'); g.addColorStop(0.5, '#f0f0f0'); g.addColorStop(1, '#606060');
        h.fillStyle = g;
        h.beginPath(); h.ellipse(0, 0, cell * 0.38, cell * 0.075, 0, 0, Math.PI * 2); h.fill();
        h.restore();
      }
    }
    fill(col, (u, v) => { const g = 175 + (n(u, v) - 0.5) * 40; return [g, g + 2, g + 6]; });
    fill(rough, (u, v) => { const g = 90 + n(u, v) * 70; return [g, g, g]; });
    return {
      map: canvasTexture(col, { repeat: true }),
      normalMap: canvasTexture(heightToNormal(hgt, 4), { repeat: true, srgb: false }),
      roughnessMap: canvasTexture(rough, { repeat: true, srgb: false }),
    };
  });
}

// Brushed / scuffed metal.
export function brushed(seed = 1) {
  return cached('brushed' + seed, () => {
    const N = 256;
    const rand = mulberry32(seed);
    const hgt = makeCanvas(N, N), rough = makeCanvas(N, N);
    const lines = new Float32Array(N);
    for (let y = 0; y < N; y++) lines[y] = rand();
    fill(hgt, (u, v, x, y) => { const g = 100 + lines[y] * 80 + rand() * 20; return [g, g, g]; });
    const n = fbmTiling(seed + 4, 4, 4);
    fill(rough, (u, v, x, y) => { const g = 70 + n(u, v) * 90 + lines[y] * 20; return [g, g, g]; });
    return {
      normalMap: canvasTexture(heightToNormal(hgt, 0.6), { repeat: true, srgb: false }),
      roughnessMap: canvasTexture(rough, { repeat: true, srgb: false }),
    };
  });
}

// ---------------------------------------------------------------- tires
// Tread normal map: u runs around the tire, v across the tread.
export function tireTread(pattern = 0) {
  return cached('tread' + pattern, () => {
    const W = 512, Hh = 128;
    const hgt = makeCanvas(W, Hh);
    const h = hgt.getContext('2d');
    h.fillStyle = '#c8c8c8'; h.fillRect(0, 0, W, Hh);
    h.fillStyle = '#202020';
    // Circumferential grooves.
    const grooves = pattern === 2 ? [0.5] : [0.3, 0.5, 0.7];
    for (const g of grooves) h.fillRect(0, g * Hh - 4, W, 8);
    // Lateral sipes / blocks.
    const blocks = pattern === 2 ? 22 : 44;
    for (let i = 0; i < blocks; i++) {
      const x = (i / blocks) * W;
      h.save();
      h.translate(x, 0);
      if (pattern === 2) {
        // Aggressive all-terrain lugs.
        h.fillRect(-5, 0, 10, Hh * 0.42);
        h.fillRect(4, Hh * 0.58, 10, Hh * 0.42);
      } else {
        h.transform(1, 0, 0.35, 1, 0, 0);
        h.fillRect(-2, 0, 4, Hh * 0.28);
        h.fillRect(-1.5, Hh * 0.72, 3, Hh * 0.28);
        h.fillRect(-1, Hh * 0.36, 2, Hh * 0.1);
        h.fillRect(-1, Hh * 0.56, 2, Hh * 0.1);
      }
      h.restore();
    }
    const col = makeCanvas(8, 8);
    const c = col.getContext('2d'); c.fillStyle = '#1b1b1c'; c.fillRect(0, 0, 8, 8);
    return {
      normalMap: canvasTexture(heightToNormal(hgt, 5), { repeat: true, srgb: false }),
    };
  });
}

// Sidewall with raised lettering, mapped in polar coords onto a ring.
export function tireSidewall(text = 'ALL SEASON  ·  M+S  ·  225/45R18  ·  RADIAL TUBELESS') {
  return cached('sidewall' + text, () => {
    const N = 512;
    const col = makeCanvas(N, N), hgt = makeCanvas(N, N);
    const c = col.getContext('2d'), h = hgt.getContext('2d');
    c.fillStyle = '#1c1c1d'; c.fillRect(0, 0, N, N);
    h.fillStyle = '#808080'; h.fillRect(0, 0, N, N);
    const cx = N / 2;
    for (const ctx of [c, h]) {
      ctx.save();
      ctx.translate(cx, cx);
      ctx.font = 'bold 26px Arial, sans-serif';
      ctx.fillStyle = ctx === c ? '#262627' : '#d0d0d0';
      const chars = text.split('');
      const total = chars.length;
      for (let i = 0; i < total; i++) {
        ctx.save();
        ctx.rotate((i / total) * Math.PI * 2);
        ctx.fillText(chars[i], -7, -N * 0.39);
        ctx.restore();
      }
      ctx.restore();
    }
    return {
      map: canvasTexture(col),
      normalMap: canvasTexture(heightToNormal(hgt, 3), { srgb: false }),
    };
  });
}

// ---------------------------------------------------------- road paint
export function roadPaint(color = '#f2f2ee') {
  return cached('paint' + color, () => {
    const W = 64, Hh = 512;
    const rand = mulberry32(7);
    const n = fbmTiling(19, 8, 4);
    const col = makeCanvas(W, Hh);
    const base = new THREE.Color(color);
    fill(col, (u, v) => {
      const worn = n(u * 0.25, v) + (rand() - 0.5) * 0.25;
      const a = worn < 0.33 ? 90 : 255;
      return [base.r * 255, base.g * 255, base.b * 255, a];
    });
    return { map: canvasTexture(col, { repeat: true }) };
  });
}

// --------------------------------------------------------------- foliage
export function leafCluster(tint = '#4f7a35', seed = 1) {
  return cached('leaf' + tint + seed, () => {
    const N = 256;
    const rand = mulberry32(seed);
    const col = makeCanvas(N, N);
    const c = col.getContext('2d');
    const base = new THREE.Color(tint);
    for (let i = 0; i < 420; i++) {
      const x = N / 2 + (rand() - 0.5) * N * 0.9 * Math.sqrt(rand());
      const y = N / 2 + (rand() - 0.5) * N * 0.9 * Math.sqrt(rand());
      const t = base.clone().offsetHSL((rand() - 0.5) * 0.05, 0, (rand() - 0.5) * 0.18);
      c.fillStyle = '#' + t.getHexString();
      c.save(); c.translate(x, y); c.rotate(rand() * Math.PI * 2);
      c.beginPath(); c.ellipse(0, 0, 9 + rand() * 6, 4 + rand() * 3, 0, 0, Math.PI * 2); c.fill();
      c.restore();
    }
    return { map: canvasTexture(col) };
  });
}

export function bark() {
  return cached('bark', () => {
    const W = 128, Hh = 256;
    const n = fbmTiling(61, 8, 4);
    const col = makeCanvas(W, Hh), hgt = makeCanvas(W, Hh);
    fill(col, (u, v) => { const g = 55 + n(u * 3, v * 0.5) * 50; return [g * 1.1, g * 0.92, g * 0.75]; });
    fill(hgt, (u, v) => { const g = n(u * 3, v * 0.5) * 255; return [g, g, g]; });
    return {
      map: canvasTexture(col, { repeat: true }),
      normalMap: canvasTexture(heightToNormal(hgt, 4), { repeat: true, srgb: false }),
    };
  });
}

// Generic fine noise used as a roughness breakup on paint, plastics, etc.
export function grime(seed = 2) {
  return cached('grime' + seed, () => {
    const N = 256;
    const n = fbmTiling(seed, 4, 5);
    const rough = makeCanvas(N, N);
    fill(rough, (u, v) => { const g = 150 + (n(u, v) - 0.5) * 120; return [g, g, g]; });
    return { roughnessMap: canvasTexture(rough, { repeat: true, srgb: false }) };
  });
}

// Plastic with a fine sandblasted grain (dashboards, bumpers, cases).
export function texturedPlastic() {
  return cached('plastic', () => {
    const N = 256;
    const rand = mulberry32(3);
    const hgt = makeCanvas(N, N);
    fill(hgt, () => { const g = 110 + rand() * 60; return [g, g, g]; });
    return { normalMap: canvasTexture(heightToNormal(hgt, 0.8), { repeat: true, srgb: false }) };
  });
}

// Woven polyester webbing for ratchet straps.
export function webbing(color = '#e8b41a') {
  return cached('web' + color, () => {
    const W = 64, Hh = 64;
    const col = makeCanvas(W, Hh), hgt = makeCanvas(W, Hh);
    const base = new THREE.Color(color);
    fill(col, (u, v, x, y) => {
      const weave = ((x >> 1) + (y >> 2)) % 2 ? 1 : 0.86;
      const edge = x < 3 || x > W - 4 ? 0.7 : 1;
      return [base.r * 255 * weave * edge, base.g * 255 * weave * edge, base.b * 255 * weave * edge];
    });
    fill(hgt, (u, v, x, y) => { const g = ((x >> 1) + (y >> 2)) % 2 ? 200 : 90; return [g, g, g]; });
    return {
      map: canvasTexture(col, { repeat: true }),
      normalMap: canvasTexture(heightToNormal(hgt, 1.5), { repeat: true, srgb: false }),
    };
  });
}

// Twisted wire rope for the winch cable.
export function wireRope() {
  return cached('rope', () => {
    const W = 64, Hh = 32;
    const hgt = makeCanvas(W, Hh);
    fill(hgt, (u, v) => {
      const s = Math.sin((u * 6 + v * 2) * Math.PI * 2) * 0.5 + 0.5;
      const g = 60 + s * 180;
      return [g, g, g];
    });
    const rough = makeCanvas(W, Hh);
    fill(rough, (u, v) => { const g = 90 + Math.sin((u * 6 + v * 2) * Math.PI * 2) * 30; return [g, g, g]; });
    return {
      normalMap: canvasTexture(heightToNormal(hgt, 3), { repeat: true, srgb: false }),
      roughnessMap: canvasTexture(rough, { repeat: true, srgb: false }),
    };
  });
}

export { setRepeat, roundRect };
