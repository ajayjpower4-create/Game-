/* Procedural surface textures.
 *
 * Every surface in the game is painted here at start-up from noise, so the
 * game ships no image files: colour (albedo) maps, normal maps derived from a
 * height field, and roughness maps. All of them tile seamlessly, and every one
 * knows its real-world size in feet — geometry carries UVs in feet, so a brick
 * is a brick-sized brick on every wall. */

import * as THREE from 'three';

const SIZE = 512;
let ANISO = 4;
/** Texture filtering for surfaces made from now on; `apply` also updates the ones already made. */
export function setAnisotropy(n, apply = false) {
  if (n === ANISO) return;
  ANISO = n;
  if (!apply) return;
  for (const set of cache.values()) {
    for (const t of Object.values(set)) if (t && t.isTexture) { t.anisotropy = n; t.needsUpdate = true; }
  }
}

/* ------------------------------------------------------------------ noise */

export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/** Value noise that tiles with the given period (in lattice cells). */
function tileNoise(period, seed) {
  const r = rng(seed);
  const lat = new Float32Array(period * period);
  for (let i = 0; i < lat.length; i++) lat[i] = r();
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const x0 = ((xi % period) + period) % period;
    const y0 = ((yi % period) + period) % period;
    const x1 = (x0 + 1) % period;
    const y1 = (y0 + 1) % period;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = lat[y0 * period + x0];
    const b = lat[y0 * period + x1];
    const c = lat[y1 * period + x0];
    const d = lat[y1 * period + x1];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

/** Fractal noise over a texture of `size` pixels, tiling at its edges.
 *  The whole pixel grid is computed up front with lookup tables (fast); any
 *  other coordinate falls back to evaluating the octaves directly. */
function fbmField(size, { octaves = 4, base = 4, seed = 1, gain = 0.5 } = {}) {
  const layers = [];
  for (let o = 0; o < octaves; o++) layers.push({ n: tileNoise(base << o, seed * 31 + o * 7), f: (base << o) / size, P: base << o, seed: seed * 31 + o * 7 });
  let norm = 0;
  let amp = 1;
  for (let o = 0; o < octaves; o++) { norm += amp; amp *= gain; }
  const table = new Float32Array(size * size);
  amp = 1;
  for (const L of layers) {
    const P = L.P;
    const r = rng(L.seed);
    const lat = new Float32Array(P * P);
    for (let i = 0; i < lat.length; i++) lat[i] = r();
    const x0 = new Int32Array(size);
    const x1 = new Int32Array(size);
    const ux = new Float32Array(size);
    for (let x = 0; x < size; x++) {
      const fx = x * L.f;
      const xi = Math.floor(fx);
      const xf = fx - xi;
      x0[x] = ((xi % P) + P) % P;
      x1[x] = (x0[x] + 1) % P;
      ux[x] = xf * xf * (3 - 2 * xf);
    }
    for (let y = 0; y < size; y++) {
      const fy = y * L.f;
      const yi = Math.floor(fy);
      const yf = fy - yi;
      const r0 = (((yi % P) + P) % P) * P;
      const r1 = ((((yi % P) + P) % P + 1) % P) * P;
      const v = yf * yf * (3 - 2 * yf);
      const row = y * size;
      for (let x = 0; x < size; x++) {
        const a = lat[r0 + x0[x]];
        const b = lat[r0 + x1[x]];
        const c = lat[r1 + x0[x]];
        const d = lat[r1 + x1[x]];
        const u = ux[x];
        table[row + x] += (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * amp;
      }
    }
    amp *= gain;
  }
  for (let i = 0; i < table.length; i++) table[i] /= norm;
  const slow = (x, y) => {
    let v = 0;
    let a = 1;
    for (const L of layers) {
      v += L.n(x * L.f, y * L.f) * a;
      a *= gain;
    }
    return v / norm;
  };
  return (x, y) => ((x | 0) === x && (y | 0) === y && x >= 0 && y >= 0 && x < size && y < size ? table[y * size + x] : slow(x, y));
}

/* -------------------------------------------------------------- canvases */

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  // Keep these canvases in main memory: reading pixels back from a GPU canvas
  // would stall until every pending WebGL job has finished.
  c.getContext('2d', { willReadFrequently: true });
  return c;
}

/** Fill a canvas pixel by pixel. fn(x, y) returns [r, g, b] (0..255) or a grey. */
function paint(c, fn) {
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(c.width, c.height);
  const d = img.data;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      const v = fn(x, y);
      const i = (y * c.width + x) << 2;
      if (typeof v === 'number') {
        d[i] = v; d[i + 1] = v; d[i + 2] = v;
      } else {
        d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2];
      }
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Turn a height field (Float32Array, 0..1) into a tangent-space normal map. */
function normalMap(h, w, hh, strength = 2) {
  const c = canvas(w, hh);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, hh);
  const d = img.data;
  const at = (x, y) => h[((y + hh) % hh) * w + ((x + w) % w)];
  for (let y = 0; y < hh; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.sqrt(dx * dx + dy * dy + 1);
      const i = (y * w + x) * 4;
      d[i] = (-dx / len * 0.5 + 0.5) * 255;
      d[i + 1] = (dy / len * 0.5 + 0.5) * 255;
      d[i + 2] = (1 / len * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function tex(c, { srgb = true, tileX = 1, tileY = tileX } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = ANISO;
  // Geometry UVs are in feet; this is how many feet one copy of the texture covers.
  t.repeat.set(1 / tileX, 1 / tileY);
  t.needsUpdate = true;
  return t;
}

const clamp255 = (v) => Math.max(0, Math.min(255, v));

/* Direct pixel drawing — far faster than canvas paths for thousands of tiny
 * marks — and wrapping at the edges, so the result still tiles. */
function blend(d, w, h, x, y, r, g, b, a) {
  let xi = x | 0;
  let yi = y | 0;
  if (xi < 0) xi += w; else if (xi >= w) xi -= w;
  if (yi < 0) yi += h; else if (yi >= h) yi -= h;
  const i = (yi * w + xi) << 2;
  d[i] = d[i] + (r - d[i]) * a;
  d[i + 1] = d[i + 1] + (g - d[i + 1]) * a;
  d[i + 2] = d[i + 2] + (b - d[i + 2]) * a;
}

function splat(d, w, h, cx, cy, rx, ry, ang, r, g, b, a) {
  const R = Math.ceil(Math.max(rx, ry));
  const c = Math.cos(ang);
  const sn = Math.sin(ang);
  const ix = Math.round(cx);
  const iy = Math.round(cy);
  const irx = 1 / rx;
  const iry = 1 / ry;
  for (let y = -R; y <= R; y++) {
    for (let x = -R; x <= R; x++) {
      const u = (x * c + y * sn) * irx;
      const v = (y * c - x * sn) * iry;
      const q = u * u + v * v;
      if (q <= 1) blend(d, w, h, ix + x, iy + y, r, g, b, a * (1 - q * 0.4));
    }
  }
}

function stroke(d, w, h, x0, y0, x1, y1, r, g, b, a) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let k = 0; k <= n; k++) blend(d, w, h, Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), r, g, b, a);
}

/* --------------------------------------------------------------- surfaces */

/* Each builder returns { map, normalMap, roughnessMap } sized in feet. Albedo
 * maps are mostly near-white so a material colour can tint them: one brick
 * texture serves red brick, buff brick and painted brick alike. */

const builders = {
  asphalt() {
    const s = SIZE;
    const n = fbmField(s, { base: 4, octaves: 5, seed: 11 });
    const r = rng(5);
    const h = new Float32Array(s * s);
    for (let i = 0; i < h.length; i++) h[i] = r() * 0.6;
    const col = paint(canvas(s), (x, y) => {
      const g = n(x, y);
      let v = 90 + (g - 0.5) * 12 + (r() - 0.5) * 34;
      // Aggregate: the odd pale stone in the binder.
      if (r() > 0.985) v += 46;
      return clamp255(v);
    });
    const rough = paint(canvas(s), (x, y) => clamp255(215 + (n(x, y) - 0.5) * 50));
    return { map: tex(col, { tileX: 14 }), normalMap: tex(normalMap(h, s, s, 1.2), { srgb: false, tileX: 14 }), roughnessMap: tex(rough, { srgb: false, tileX: 14 }) };
  },

  road() {
    const s = SIZE;
    const n = fbmField(s, { base: 3, octaves: 5, seed: 23 });
    const r = rng(9);
    const h = new Float32Array(s * s);
    for (let i = 0; i < h.length; i++) h[i] = r() * 0.5;
    const col = paint(canvas(s), (x, y) => clamp255(64 + (n(x, y) - 0.5) * 14 + (r() - 0.5) * 30 + (r() > 0.99 ? 30 : 0)));
    const rough = paint(canvas(s), (x, y) => clamp255(200 + (n(x, y) - 0.5) * 60));
    return { map: tex(col, { tileX: 20 }), normalMap: tex(normalMap(h, s, s, 1.0), { srgb: false, tileX: 20 }), roughnessMap: tex(rough, { srgb: false, tileX: 20 }) };
  },

  concrete() {
    const s = SIZE;
    const n = fbmField(s, { base: 3, octaves: 5, seed: 41 });
    const r = rng(3);
    const h = new Float32Array(s * s);
    const joint = (x, y) => x < 2 || y < 2;
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) h[y * s + x] = joint(x, y) ? 0 : 0.5 + r() * 0.08;
    const col = paint(canvas(s), (x, y) => {
      if (joint(x, y)) return 120;
      const g = n(x, y);
      return clamp255(200 + (g - 0.5) * 46 + (r() - 0.5) * 14 - (g > 0.72 ? 24 : 0));
    });
    const rough = paint(canvas(s), (x, y) => clamp255(205 + (n(x, y) - 0.5) * 40));
    return { map: tex(col, { tileX: 15 }), normalMap: tex(normalMap(h, s, s, 3), { srgb: false, tileX: 15 }), roughnessMap: tex(rough, { srgb: false, tileX: 15 }) };
  },

  paving() {
    const s = SIZE;
    const n = fbmField(s, { base: 4, octaves: 4, seed: 61 });
    const r = rng(17);
    const step = s / 4;
    const joint = (x, y) => x % step < 2 || y % step < 2;
    const h = new Float32Array(s * s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) h[y * s + x] = joint(x, y) ? 0 : 0.5 + r() * 0.05;
    const col = paint(canvas(s), (x, y) => (joint(x, y) ? 140 : clamp255(212 + (n(x, y) - 0.5) * 30 + (r() - 0.5) * 12)));
    return { map: tex(col, { tileX: 10 }), normalMap: tex(normalMap(h, s, s, 3), { srgb: false, tileX: 10 }), roughnessMap: null };
  },

  grass() {
    const s = SIZE;
    const n = fbmField(s, { base: 4, octaves: 5, seed: 71 });
    const n2 = fbmField(s, { base: 16, octaves: 3, seed: 72 });
    const r = rng(77);
    const c = canvas(s);
    paint(c, (x, y) => {
      const g = n(x, y);
      const k = n2(x, y);
      // Mostly green, with drier straw-coloured patches.
      const dry = Math.max(0, g - 0.72) * 0.8;
      return [clamp255(66 + g * 26 + k * 14 + dry * 60), clamp255(84 + g * 30 + k * 18 + dry * 30), clamp255(44 + g * 12 + dry * 10)];
    });
    // Blades.
    const ctx = c.getContext('2d');
    const img = ctx.getImageData(0, 0, s, s);
    const px = img.data;
    for (let i = 0; i < 14000; i++) {
      const x = r() * s;
      const y = r() * s;
      const l = 2 + r() * 6;
      const shade = r();
      if (shade > 0.55) stroke(px, s, s, x, y, x + (r() - 0.5) * 3, y - l, 100 + shade * 50, 130 + shade * 40, 55 + shade * 15, 0.42);
      else stroke(px, s, s, x, y, x + (r() - 0.5) * 3, y - l, 28, 46 + shade * 40, 18, 0.42);
    }
    ctx.putImageData(img, 0, 0);
    const h = new Float32Array(s * s);
    for (let i = 0; i < h.length; i++) h[i] = px[i * 4 + 1] / 255;
    return { map: tex(c, { tileX: 9 }), normalMap: tex(normalMap(h, s, s, 1.6), { srgb: false, tileX: 9 }), roughnessMap: null };
  },

  macro() {
    // Broad, soft blotches laid over big surfaces so their tiling never shows.
    const s = 256;
    const n = fbmField(s, { base: 3, octaves: 5, seed: 241, gain: 0.55 });
    const c = paint(canvas(s), (x, y) => clamp255(n(x, y) * 255));
    return { map: tex(c, { srgb: false, tileX: 1 }) };
  },

  dirt() {
    // Oil stains, tyre marks and grime for yards and parking.
    const s = SIZE;
    const n = fbmField(s, { base: 5, octaves: 5, seed: 251 });
    const r = rng(253);
    const c = canvas(s);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 26; i++) {
      const x = r() * s;
      const y = r() * s;
      const rad = 8 + r() * 30;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `rgba(30,28,26,${0.25 + r() * 0.3})`);
      g.addColorStop(1, 'rgba(30,28,26,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(x, y, rad, rad * (0.5 + r() * 0.5), r() * Math.PI, 0, Math.PI * 2); ctx.fill();
    }
    const id = ctx.getImageData(0, 0, s, s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
      const i = (y * s + x) * 4;
      const k = 0.88 + n(x, y) * 0.24;
      id.data[i] = clamp255(id.data[i] * k); id.data[i + 1] = clamp255(id.data[i + 1] * k); id.data[i + 2] = clamp255(id.data[i + 2] * k);
    }
    ctx.putImageData(id, 0, 0);
    return { map: tex(c, { tileX: 40 }) };
  },

  brick() {
    // Running bond: 4 bricks across 3 ft, 12 courses up 3 ft.
    const s = SIZE;
    const courses = 12;
    const per = 4;
    const ch = s / courses;
    const bw = s / per;
    const r = rng(101);
    const n = fbmField(s, { base: 8, octaves: 3, seed: 102 });
    const shade = [];
    for (let i = 0; i < courses * per * 2; i++) shade.push(0.78 + r() * 0.3);
    const h = new Float32Array(s * s);
    const col = paint(canvas(s), (x, y) => {
      const row = Math.floor(y / ch);
      const off = row % 2 ? bw / 2 : 0;
      const bx = ((x + off) % s);
      const col = Math.floor(bx / bw);
      const inMortar = y % ch < 3 || bx % bw < 3;
      const k = shade[row * per + col] * (0.92 + n(x, y) * 0.16);
      h[y * s + x] = inMortar ? 0 : 0.6 + n(x, y) * 0.15;
      if (inMortar) return 236;
      return clamp255(205 * k);
    });
    const rough = paint(canvas(s), (x, y) => (h[y * s + x] === 0 ? 240 : 205));
    return { map: tex(col, { tileX: 3 }), normalMap: tex(normalMap(h, s, s, 4), { srgb: false, tileX: 3 }), roughnessMap: tex(rough, { srgb: false, tileX: 3 }) };
  },

  stone() {
    const s = SIZE;
    const rows = 4;
    const per = 3;
    const ch = s / rows;
    const bw = s / per;
    const r = rng(111);
    const n = fbmField(s, { base: 8, octaves: 4, seed: 112 });
    const shade = [];
    for (let i = 0; i < rows * per * 2; i++) shade.push(0.86 + r() * 0.18);
    const h = new Float32Array(s * s);
    const col = paint(canvas(s), (x, y) => {
      const row = Math.floor(y / ch);
      const off = row % 2 ? bw / 2 : 0;
      const bx = (x + off) % s;
      const c = Math.floor(bx / bw);
      const joint = y % ch < 3 || bx % bw < 3;
      h[y * s + x] = joint ? 0 : 0.5 + n(x, y) * 0.3;
      return joint ? 170 : clamp255(225 * shade[row * per + c] * (0.9 + n(x, y) * 0.2));
    });
    return { map: tex(col, { tileX: 6 }), normalMap: tex(normalMap(h, s, s, 3), { srgb: false, tileX: 6 }), roughnessMap: null };
  },

  precast() {
    // One panel: 25 ft wide, 12 ft high, with a recessed joint on its edge.
    const w = SIZE;
    const hh = 256;
    const n = fbmField(w, { base: 6, octaves: 5, seed: 121 });
    const r = rng(123);
    const h = new Float32Array(w * hh);
    const col = paint(canvas(w, hh), (x, y) => {
      const joint = x < 3 || y < 2;
      h[y * w + x] = joint ? 0 : 0.5;
      if (joint) return 150;
      // Weathering streaks run down from the top of each panel.
      const streak = n(x * 0.3, 0) > 0.62 ? (1 - y / hh) * 14 : 0;
      return clamp255(232 + (n(x, y) - 0.5) * 22 + (r() - 0.5) * 8 - streak);
    });
    return { map: tex(col, { tileX: 25, tileY: 12 }), normalMap: tex(normalMap(h, w, hh, 5), { srgb: false, tileX: 25, tileY: 12 }), roughnessMap: null };
  },

  rib() {
    // Trapezoidal profiled sheet: one rib every 0.75 ft, 4 across a 3 ft tile.
    const s = 256;
    const ribs = 4;
    const period = s / ribs;
    const n = fbmField(s, { base: 4, octaves: 3, seed: 131 });
    const h = new Float32Array(s * s);
    const profile = (x) => {
      const p = (x % period) / period;
      if (p < 0.15) return 1;
      if (p < 0.25) return 1 - (p - 0.15) / 0.1;
      if (p < 0.9) return 0;
      return (p - 0.9) / 0.1;
    };
    const col = paint(canvas(s), (x, y) => {
      const v = profile(x);
      h[y * s + x] = v;
      return clamp255(225 + v * 18 + (n(x, y) - 0.5) * 14);
    });
    return { map: tex(col, { tileX: 3 }), normalMap: tex(normalMap(h, s, s, 6), { srgb: false, tileX: 3 }), roughnessMap: null };
  },

  composite() {
    // Flat cassette panels 10 ft x 3.3 ft with thin shadow joints.
    const w = SIZE;
    const hh = 168;
    const n = fbmField(w, { base: 4, octaves: 3, seed: 141 });
    const h = new Float32Array(w * hh);
    const col = paint(canvas(w, hh), (x, y) => {
      const joint = x < 2 || y < 2;
      h[y * w + x] = joint ? 0 : 0.5;
      return joint ? 120 : clamp255(236 + (n(x, y) - 0.5) * 8);
    });
    return { map: tex(col, { tileX: 10, tileY: 3.3 }), normalMap: tex(normalMap(h, w, hh, 6), { srgb: false, tileX: 10, tileY: 3.3 }), roughnessMap: null };
  },

  render() {
    const s = SIZE;
    const n = fbmField(s, { base: 6, octaves: 5, seed: 151 });
    const r = rng(153);
    const h = new Float32Array(s * s);
    for (let i = 0; i < h.length; i++) h[i] = r() * 0.15;
    const col = paint(canvas(s), (x, y) => clamp255(238 + (n(x, y) - 0.5) * 16 + (r() - 0.5) * 6));
    return { map: tex(col, { tileX: 12 }), normalMap: tex(normalMap(h, s, s, 0.8), { srgb: false, tileX: 12 }), roughnessMap: null };
  },

  timber() {
    // Vertical boards, 6 in wide, with grain and a shadow gap.
    const s = SIZE;
    const boards = 8;
    const bw = s / boards;
    const r = rng(161);
    const shade = Array.from({ length: boards }, () => 0.8 + r() * 0.25);
    const grain = fbmField(s, { base: 2, octaves: 4, seed: 162 });
    const h = new Float32Array(s * s);
    const col = paint(canvas(s), (x, y) => {
      const b = Math.floor(x / bw);
      const gap = x % bw < 3;
      h[y * s + x] = gap ? 0 : 0.5 + grain(x * 6, y * 0.3) * 0.15;
      if (gap) return 90;
      const g = grain(x * 6, y * 0.3);
      return clamp255(220 * shade[b] * (0.85 + g * 0.3));
    });
    return { map: tex(col, { tileX: 4 }), normalMap: tex(normalMap(h, s, s, 3), { srgb: false, tileX: 4 }), roughnessMap: null };
  },

  membrane() {
    // Single-ply roofing: pale sheets with welded seams and dirt.
    const s = SIZE;
    const n = fbmField(s, { base: 3, octaves: 5, seed: 171 });
    const h = new Float32Array(s * s);
    const col = paint(canvas(s), (x, y) => {
      const seam = x % (s / 2) < 3;
      h[y * s + x] = seam ? 1 : 0.3;
      const dirt = n(x, y);
      return clamp255(214 + (dirt - 0.5) * 50 - (seam ? 10 : 0));
    });
    return { map: tex(col, { tileX: 20 }), normalMap: tex(normalMap(h, s, s, 3), { srgb: false, tileX: 20 }), roughnessMap: null };
  },

  seam() {
    // Standing-seam metal roof: raised seams every 1.5 ft.
    const s = 256;
    const per = 4;
    const p = s / per;
    const n = fbmField(s, { base: 4, octaves: 3, seed: 181 });
    const h = new Float32Array(s * s);
    const col = paint(canvas(s), (x, y) => {
      const seam = x % p < 4;
      h[y * s + x] = seam ? 1 : 0;
      return clamp255(225 + (seam ? 20 : 0) + (n(x, y) - 0.5) * 16);
    });
    return { map: tex(col, { tileX: 6 }), normalMap: tex(normalMap(h, s, s, 5), { srgb: false, tileX: 6 }), roughnessMap: null };
  },

  tiles() {
    // Roof tiles / slates in staggered rows.
    const s = SIZE;
    const rows = 8;
    const per = 6;
    const rh = s / rows;
    const tw = s / per;
    const r = rng(191);
    const shade = Array.from({ length: rows * per }, () => 0.8 + r() * 0.3);
    const h = new Float32Array(s * s);
    const col = paint(canvas(s), (x, y) => {
      const row = Math.floor(y / rh);
      const off = row % 2 ? tw / 2 : 0;
      const bx = (x + off) % s;
      const c = Math.floor(bx / tw);
      const fy = (y % rh) / rh;
      h[y * s + x] = fy + (bx % tw < 2 ? -0.5 : 0);
      const edge = bx % tw < 2 || fy > 0.92;
      return edge ? 70 : clamp255(220 * shade[row * per + c] * (0.85 + fy * 0.25));
    });
    return { map: tex(col, { tileX: 6 }), normalMap: tex(normalMap(h, s, s, 3), { srgb: false, tileX: 6 }), roughnessMap: null };
  },

  slats() {
    // Roll-up door curtain: horizontal slats, 4 in each.
    const s = 128;
    const per = 16;
    const p = s / per;
    const h = new Float32Array(s * s);
    const col = paint(canvas(s), (x, y) => {
      const f = (y % p) / p;
      h[y * s + x] = Math.sin(f * Math.PI);
      return clamp255(200 + Math.sin(f * Math.PI) * 40 - (f < 0.1 ? 60 : 0));
    });
    return { map: tex(col, { tileX: 5.33 }), normalMap: tex(normalMap(h, s, s, 4), { srgb: false, tileX: 5.33 }), roughnessMap: null };
  },

  hvac() {
    // Sheet-metal casing: panels with seams, a screw at each corner, faint
    // weathering streaks and a little grime low down. Covers 8 ft.
    const s = 256;
    const n = fbmField(s, { base: 5, octaves: 4, seed: 311 });
    const r = rng(313);
    const h = new Float32Array(s * s);
    const streak = new Float32Array(s);
    for (let x = 0; x < s; x++) streak[x] = r() < 0.25 ? r() * 18 : 0;
    const col = paint(canvas(s), (x, y) => {
      const px = x % 64;
      const py = y % 128;
      const seam = px < 2 || py < 2;
      const screw = (Math.hypot(px - 6, py - 6) < 2.2) || (Math.hypot(px - 58, py - 6) < 2.2);
      h[y * s + x] = seam ? 0 : screw ? 0.9 : 0.5 + n(x, y) * 0.04;
      const grime = Math.max(0, (y - s * 0.7) / (s * 0.3)) * 14;
      const v = seam ? 160 : screw ? 150 : 226 + n(x, y) * 10 - streak[x] * (y / s) - grime;
      return clamp255(v);
    });
    const rough = paint(canvas(s), (x, y) => clamp255(110 + n(x, y) * 50 + (x % 64 < 2 ? 50 : 0)));
    return {
      map: tex(col, { tileX: 8 }),
      normalMap: tex(normalMap(h, s, s, 3), { srgb: false, tileX: 8 }),
      roughnessMap: tex(rough, { srgb: false, tileX: 8 }),
    };
  },

  jet() {
    // Falling or spurting water: bright streaks with gaps, as an alpha mask.
    const w = 64;
    const h = 256;
    const r = rng(331);
    const lanes = Array.from({ length: w }, () => ({ a: 0.35 + r() * 0.65, ph: r() * h, len: 30 + r() * 90 }));
    const c = paint(canvas(w, h), (x, y) => {
      const L = lanes[x];
      const t = ((y + L.ph) % h) / L.len;
      const f = t % 1;
      const on = f < 0.7 ? 0.6 + 0.4 * Math.sin(f / 0.7 * Math.PI) : 0.18;
      return clamp255(255 * L.a * on);
    });
    return { map: tex(c, { srgb: false, tileX: 1, tileY: 1 }) };
  },

  foam() {
    // Churned white water where jets land: a soft ring.
    const s = 128;
    const n = fbmField(s, { base: 6, octaves: 3, seed: 341 });
    const c = paint(canvas(s), (x, y) => {
      const d = Math.hypot(x - s / 2, y - s / 2) / (s / 2);
      const ring = Math.max(0, 1 - Math.abs(d - 0.62) / 0.36);
      return clamp255(255 * ring * (0.55 + n(x, y) * 0.9));
    });
    const t = tex(c, { srgb: false, tileX: 1 });
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.repeat.set(1, 1);
    return { map: t };
  },

  fanguard() {
    // A wire fan guard as an alpha mask: rings and spokes.
    const s = 256;
    const c = paint(canvas(s), (x, y) => {
      const dx = x - s / 2;
      const dy = y - s / 2;
      const d = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      const ring = d % 11 < 2.2 || d > s / 2 - 5;
      const spoke = Math.abs(Math.sin(a * 4)) * d < 2.4;
      return ring || spoke || d < 16 ? 255 : 0;
    });
    const t = tex(c, { srgb: false, tileX: 1 });
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.repeat.set(1, 1);
    return { map: t };
  },

  louvre() {
    const s = 128;
    const per = 12;
    const p = s / per;
    const h = new Float32Array(s * s);
    const col = paint(canvas(s), (x, y) => {
      const f = (y % p) / p;
      h[y * s + x] = f;
      return f > 0.8 ? 40 : clamp255(150 + f * 90);
    });
    return { map: tex(col, { tileX: 4 }), normalMap: tex(normalMap(h, s, s, 6), { srgb: false, tileX: 4 }), roughnessMap: null };
  },

  leaves() {
    const s = 128;
    const n = fbmField(s, { base: 4, octaves: 4, seed: 201 });
    const r = rng(203);
    const c = canvas(s);
    paint(c, (x, y) => {
      const g = n(x, y);
      return [clamp255(150 + g * 80), clamp255(170 + g * 80), clamp255(130 + g * 60)];
    });
    const ctx = c.getContext('2d');
    const img = ctx.getImageData(0, 0, s, s);
    const px = img.data;
    for (let i = 0; i < 700; i++) {
      const x = r() * s;
      const y = r() * s;
      const k = r();
      const rx = 1.2 + r() * 1.6;
      const ry = 0.7 + r() * 1.1;
      const a = r() * Math.PI;
      if (k > 0.6) splat(px, s, s, x, y, rx, ry, a, 255, 255, 230, 0.45);
      else splat(px, s, s, x, y, rx, ry, a, 40, 60, 30, 0.45);
    }
    ctx.putImageData(img, 0, 0);
    const h = new Float32Array(s * s);
    for (let i = 0; i < h.length; i++) h[i] = px[i * 4 + 1] / 255;
    return { map: tex(c, { tileX: 4 }), normalMap: tex(normalMap(h, s, s, 3), { srgb: false, tileX: 4 }), roughnessMap: null };
  },

  bark() {
    const s = 128;
    const n = fbmField(s, { base: 2, octaves: 4, seed: 211 });
    const h = new Float32Array(s * s);
    const col = paint(canvas(s), (x, y) => {
      const g = n(x * 4, y * 0.5);
      h[y * s + x] = g;
      return clamp255(170 + (g - 0.5) * 120);
    });
    return { map: tex(col, { tileX: 2 }), normalMap: tex(normalMap(h, s, s, 4), { srgb: false, tileX: 2 }), roughnessMap: null };
  },

  mesh() {
    // Chain-link diamonds, as an alpha mask.
    const s = 64;
    const c = paint(canvas(s), (x, y) => {
      const u = (x + y) % 32;
      const v = (x - y + 64) % 32;
      return u < 3 || v < 3 ? 255 : 0;
    });
    return { map: tex(c, { srgb: false, tileX: 0.6 }) };
  },

  water() {
    const s = 256;
    const n = fbmField(s, { base: 6, octaves: 5, seed: 221 });
    const h = new Float32Array(s * s);
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) h[y * s + x] = n(x, y);
    return { normalMap: tex(normalMap(h, s, s, 6), { srgb: false, tileX: 12 }) };
  },

  wear() {
    // A grey mask for worn road paint.
    const s = 256;
    const n = fbmField(s, { base: 8, octaves: 4, seed: 231 });
    const r = rng(233);
    const c = paint(canvas(s), (x, y) => clamp255((n(x, y) > 0.27 ? 245 : 70) - r() * 30));
    return { map: tex(c, { srgb: false, tileX: 6 }) };
  },
};

const cache = new Map();

/** The texture set for a surface, made on first use. */
export const texStats = { ms: 0, made: [] };
export function surface(name) {
  if (!cache.has(name)) {
    const t = performance.now();
    cache.set(name, builders[name]());
    const ms = performance.now() - t;
    texStats.ms += ms;
    texStats.made.push([name, Math.round(ms)]);
  }
  return cache.get(name);
}

/* ------------------------------------------------------- special canvases */

/** A lit office seen through a window — ceiling panels, a back wall, desks. */
export function interiorTexture(seed = 1) {
  const key = `interior${seed}`;
  if (cache.has(key)) return cache.get(key);
  const w = 128;
  const h = 128;
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const r = rng(seed * 97);
  const warm = r() > 0.4;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, warm ? '#fff3d6' : '#eef6ff');
  g.addColorStop(0.35, warm ? '#f2c98a' : '#c9dcf0');
  g.addColorStop(1, warm ? '#7a5634' : '#56677a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Ceiling light strips.
  ctx.fillStyle = 'rgba(255,255,255,.95)';
  for (let i = 0; i < 3; i++) ctx.fillRect(10 + i * 40, 6, 26, 5);
  // Desks, monitors, the odd person.
  ctx.fillStyle = 'rgba(30,24,20,.55)';
  for (let i = 0; i < 4; i++) {
    const x = r() * w;
    ctx.fillRect(x, h * 0.66, 22 + r() * 18, 6);
    ctx.fillRect(x + 4, h * 0.56, 8, 10);
  }
  if (r() > 0.5) { ctx.fillRect(r() * w, h * 0.45, 6, 30); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  cache.set(key, t);
  return t;
}

/** Lettering for a sign: transparent background, text in the given colour. */
export function signTexture({ text = '', sub = '', logo = '', color = '#ffffff', bg = null, width = 1024, height = 256, weight = 800 }) {
  const c = canvas(width, height);
  const ctx = c.getContext('2d');
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height); }
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const family = '"Helvetica Neue", Helvetica, Arial, sans-serif';
  const hasSub = !!sub;
  let x = width / 2;
  let mainSize = height * (hasSub ? 0.46 : 0.6);
  ctx.font = `${weight} ${mainSize}px ${family}`;
  const logoW = logo ? mainSize * 1.25 : 0;
  let tw = ctx.measureText(text).width + logoW;
  if (tw > width * 0.94) {
    mainSize *= (width * 0.94) / tw;
    ctx.font = `${weight} ${mainSize}px ${family}`;
    tw = ctx.measureText(text).width + (logo ? mainSize * 1.25 : 0);
  }
  const top = hasSub ? height * 0.38 : height / 2;
  if (logo) {
    ctx.font = `${mainSize * 1.05}px ${family}`;
    ctx.fillText(logo, x - tw / 2 + mainSize * 0.55, top);
    ctx.font = `${weight} ${mainSize}px ${family}`;
    x += mainSize * 0.62;
  }
  ctx.fillText(text, x, top);
  if (hasSub) {
    const ss = Math.min(height * 0.2, mainSize * 0.5);
    ctx.font = `600 ${ss}px ${family}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${ss * 0.12}px`;
    ctx.fillText(sub, width / 2, height * 0.8);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = ANISO;
  return t;
}

/** A painted or printed panel: background, optional border, text wrapped to fit
 *  in up to four lines, an optional logo on the left and a smaller second line. */
export function panelTexture({ text = '', sub = '', logo = '', color = '#ffffff', bg = '#1d2c44', aspect = 4, border = true, align = 'center' }) {
  const W = 1024;
  const H = Math.max(64, Math.round(W / aspect));
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  if (border) {
    g.strokeStyle = 'rgba(255,255,255,.25)';
    g.lineWidth = Math.max(3, H * 0.02);
    g.strokeRect(H * 0.05, H * 0.05, W - H * 0.1, H - H * 0.1);
  }
  const fam = '"Helvetica Neue", Helvetica, Arial, sans-serif';
  const words = String(text).split(/\s+/).filter(Boolean);
  const pad = W * 0.06;
  const logoW = logo ? H * 0.5 : 0;
  const maxW = W - pad * 2 - logoW;
  // Find the biggest font that fits in up to four lines.
  let size = H * 0.5;
  let lines = [];
  for (; size > 12; size *= 0.92) {
    g.font = `800 ${size}px ${fam}`;
    lines = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w;
      if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    }
    if (cur) lines.push(cur);
    const total = lines.length * size * 1.12 + (sub ? size * 0.7 : 0);
    if (lines.length <= 4 && total < H * 0.8 && lines.every((l) => g.measureText(l).width <= maxW)) break;
  }
  g.fillStyle = color;
  g.textBaseline = 'middle';
  g.textAlign = align;
  const total = lines.length * size * 1.12 + (sub ? size * 0.7 : 0);
  let y = H / 2 - total / 2 + size * 0.56;
  const x = align === 'center' ? W / 2 + logoW / 2 : pad + logoW;
  if (logo) {
    g.font = `${size * 1.3}px ${fam}`;
    g.textAlign = 'center';
    g.fillText(logo, pad + logoW / 2 - (align === 'center' ? 0 : 0), H / 2);
    g.textAlign = align;
  }
  g.font = `800 ${size}px ${fam}`;
  for (const l of lines) { g.fillText(l, x, y); y += size * 1.12; }
  if (sub) {
    g.font = `600 ${size * 0.5}px ${fam}`;
    g.fillText(sub, x, y + size * 0.05);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Neon script: glowing tubes on a clear backing, in a handwritten face. */
export function neonTexture({ text = 'Open', color = '#ff4fd8', aspect = 4.5 }) {
  const W = 1024;
  const H = Math.max(96, Math.round(W / aspect));
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const fam = '"Brush Script MT", "Segoe Script", "Snell Roundhand", cursive';
  let size = H * 0.7;
  g.font = `italic 700 ${size}px ${fam}`;
  const tw = g.measureText(text || ' ').width;
  if (tw > W * 0.9) { size *= (W * 0.9) / tw; g.font = `italic 700 ${size}px ${fam}`; }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  // Halo, coloured tube, white-hot core.
  g.shadowColor = color;
  g.shadowBlur = size * 0.25;
  g.strokeStyle = color;
  g.lineWidth = size * 0.09;
  g.strokeText(text, W / 2, H / 2);
  g.shadowBlur = size * 0.08;
  g.strokeText(text, W / 2, H / 2);
  g.shadowBlur = 0;
  g.strokeStyle = 'rgba(255,255,255,.85)';
  g.lineWidth = size * 0.025;
  g.strokeText(text, W / 2, H / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = ANISO;
  return t;
}

/** A safety sign: a coloured header band with its word, the message below. */
export function safetyTexture({ head = 'WARNING', text = '', bg = '#f2c318', color = '#1d1f22', aspect = 0.75 }) {
  const W = 512;
  const H = Math.max(64, Math.round(W / aspect));
  const c = canvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#fbfbf8';
  g.fillRect(0, 0, W, H);
  const band = H * 0.3;
  g.fillStyle = bg;
  g.fillRect(0, 0, W, band);
  g.strokeStyle = '#1d1f22';
  g.lineWidth = W * 0.02;
  g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, W - g.lineWidth, H - g.lineWidth);
  const fam = '"Helvetica Neue", Helvetica, Arial, sans-serif';
  // A warning triangle beside the header word.
  const tri = band * 0.62;
  const tx = W * 0.08;
  const ty = band / 2;
  g.fillStyle = '#1d1f22';
  g.beginPath(); g.moveTo(tx + tri / 2, ty - tri / 2); g.lineTo(tx + tri, ty + tri / 2); g.lineTo(tx, ty + tri / 2); g.closePath(); g.fill();
  g.fillStyle = bg;
  g.font = `900 ${tri * 0.7}px ${fam}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('!', tx + tri / 2, ty + tri * 0.12);
  g.fillStyle = color;
  let hs = band * 0.5;
  g.font = `900 ${hs}px ${fam}`;
  const hw = g.measureText(head).width;
  if (hw > W * 0.7) { hs *= (W * 0.7) / hw; g.font = `900 ${hs}px ${fam}`; }
  g.fillText(head, W * 0.56, band / 2);
  // The message, wrapped.
  g.fillStyle = '#1d1f22';
  const words = String(text).split(/\s+/).filter(Boolean);
  let size = (H - band) * 0.22;
  let lines = [];
  for (; size > 10; size *= 0.92) {
    g.font = `800 ${size}px ${fam}`;
    lines = [];
    let cur = '';
    for (const w of words) {
      const s = cur ? `${cur} ${w}` : w;
      if (g.measureText(s).width > W * 0.84 && cur) { lines.push(cur); cur = w; } else cur = s;
    }
    if (cur) lines.push(cur);
    if (lines.length * size * 1.15 < (H - band) * 0.8 && lines.every((l) => g.measureText(l).width <= W * 0.84)) break;
  }
  let y = band + (H - band) / 2 - ((lines.length - 1) * size * 1.15) / 2;
  for (const l of lines) { g.fillText(l, W / 2, y); y += size * 1.15; }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = ANISO;
  return t;
}

/** An LED screen showing a message: a deep gradient, bright text, fine pixel grid. */
export function screenTexture({ text = '', sub = '', color = '#ffffff', bg = '#0b3d91', aspect = 16 / 9 }) {
  const W = 1024;
  const H = Math.max(64, Math.round(W / aspect));
  const c = canvas(W, H);
  const g = c.getContext('2d');
  const base = new THREE.Color(bg);
  const lite = base.clone().lerp(new THREE.Color('#ffffff'), 0.25);
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, `#${lite.getHexString()}`);
  grad.addColorStop(1, `#${base.clone().multiplyScalar(0.55).getHexString()}`);
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  // A swoosh for a bit of design.
  g.fillStyle = 'rgba(255,255,255,.08)';
  g.beginPath(); g.ellipse(W * 0.85, H * 1.1, W * 0.6, H * 0.55, -0.3, 0, Math.PI * 2); g.fill();
  const fam = '"Helvetica Neue", Helvetica, Arial, sans-serif';
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = H * (sub ? 0.26 : 0.32);
  g.font = `900 ${size}px ${fam}`;
  const tw = g.measureText(text || ' ').width;
  if (tw > W * 0.88) { size *= (W * 0.88) / tw; g.font = `900 ${size}px ${fam}`; }
  g.fillText(text, W / 2, sub ? H * 0.42 : H / 2);
  if (sub) {
    let ss = Math.min(size * 0.45, H * 0.11);
    g.font = `600 ${ss}px ${fam}`;
    const sw = g.measureText(sub).width;
    if (sw > W * 0.88) { ss *= (W * 0.88) / sw; g.font = `600 ${ss}px ${fam}`; }
    g.fillText(sub, W / 2, H * 0.7);
  }
  // LED pixel grid.
  g.fillStyle = 'rgba(0,0,0,.18)';
  const step = Math.max(4, Math.round(W / 180));
  for (let x = 0; x < W; x += step) g.fillRect(x, 0, 1, H);
  for (let y = 0; y < H; y += step) g.fillRect(0, y, W, 1);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = ANISO;
  return t;
}

/** A soft radial spot, for light pools on the ground and lamp glows. */
export function glowTexture() {
  if (cache.has('glow')) return cache.get('glow');
  const s = 128;
  const c = canvas(s);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  cache.set('glow', t);
  return t;
}
