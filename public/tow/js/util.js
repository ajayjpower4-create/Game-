// Small shared helpers: math, seeded randomness, canvas textures.
import * as THREE from 'three';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (v - a) / (b - a);
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
// Frame-rate independent exponential approach.
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const wrapAngle = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
export const dampAngle = (a, b, lambda, dt) => a + wrapAngle(b - a) * (1 - Math.exp(-lambda * dt));

export function mulberry32(seed) {
  let s = seed >>> 0;
  return function rand() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export class Rng {
  constructor(seed = 1) { this.r = mulberry32(seed); }
  next() { return this.r(); }
  range(a, b) { return a + (b - a) * this.r(); }
  int(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[Math.floor(this.r() * arr.length) % arr.length]; }
  chance(p) { return this.r() < p; }
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.r() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

// --------------------------------------------------------------- canvases

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function canvasTexture(canvas, { repeat = false, srgb = true, aniso = 8, mips = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  t.generateMipmaps = mips;
  if (!mips) t.minFilter = THREE.LinearFilter;
  return t;
}

// Value noise that tiles over `period` cells, for seamless textures.
export function tileNoise(period, seed = 1) {
  const rand = mulberry32(seed);
  const grid = new Float32Array(period * period);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
  const at = (x, y) => grid[((y % period + period) % period) * period + ((x % period + period) % period)];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

// Fractal tiling noise sampled in [0,1) texture space.
export function fbmTiling(seed, baseCells = 4, octaves = 5) {
  const layers = [];
  for (let o = 0; o < octaves; o++) layers.push(tileNoise(baseCells << o, seed + o * 101));
  return (u, v) => {
    let sum = 0, amp = 0.5, norm = 0;
    for (let o = 0; o < octaves; o++) {
      const cells = baseCells << o;
      sum += layers[o](u * cells, v * cells) * amp;
      norm += amp;
      amp *= 0.5;
    }
    return sum / norm;
  };
}

// Turns a grayscale height canvas into a tangent-space normal map canvas.
export function heightToNormal(heightCanvas, strength = 2, wrap = true) {
  const w = heightCanvas.width, h = heightCanvas.height;
  const src = heightCanvas.getContext('2d').getImageData(0, 0, w, h).data;
  const out = makeCanvas(w, h);
  const ctx = out.getContext('2d');
  const img = ctx.createImageData(w, h);
  const H = (x, y) => {
    if (wrap) { x = (x + w) % w; y = (y + h) % h; } else { x = clamp(x, 0, w - 1); y = clamp(y, 0, h - 1); }
    return src[(y * w + x) * 4] / 255;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      let nx = -dx, ny = dy, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      const i = (y * w + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

// Fits text into a box by shrinking the font.
export function fitText(ctx, text, maxWidth, size, weight = 700, family = 'Arial, Helvetica, sans-serif') {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && s > 6) {
    s -= 1;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function shadeHex(hex, f) {
  const c = new THREE.Color(hex);
  if (f >= 0) c.lerp(new THREE.Color(1, 1, 1), f); else c.multiplyScalar(1 + f);
  return '#' + c.getHexString();
}

// Disposes everything under an object (geometries are kept if shared).
export function disposeTree(obj, { geometries = true, materials = false } = {}) {
  obj.traverse((o) => {
    if (o.isMesh) {
      if (geometries && !o.geometry.userData.shared) o.geometry.dispose();
      if (materials) [].concat(o.material).forEach((m) => m.dispose());
    }
  });
}

export const tmpV = new THREE.Vector3();
export const tmpV2 = new THREE.Vector3();
export const tmpQ = new THREE.Quaternion();
export const UP = new THREE.Vector3(0, 1, 0);

export function fmtMoney(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

export function fmtDist(m) {
  const feet = m * 3.28084;
  if (feet < 900) return `${Math.round(feet / 10) * 10} ft`;
  const miles = m / 1609.34;
  return `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
}
