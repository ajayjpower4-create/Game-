// Building facade materials. Each texture is one bay wide and one floor tall
// and tiles across a wall by world-space UVs, so windows line up with floors.
// Glass gets low roughness / high metalness in the PBR maps so it actually
// mirrors the sky and the street.
import * as THREE from 'three';
import { makeCanvas, canvasTexture, heightToNormal, mulberry32, fbmTiling, roundRect } from '../util.js';

const cache = new Map();
function once(key, fn) {
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

// Draws a canvas set: color, roughness, metalness, height (for normals).
function facadeSet(W, H, draw) {
  const col = makeCanvas(W, H), rough = makeCanvas(W, H), metal = makeCanvas(W, H), hgt = makeCanvas(W, H);
  const ctx = { c: col.getContext('2d'), r: rough.getContext('2d'), m: metal.getContext('2d'), h: hgt.getContext('2d'), W, H };
  ctx.m.fillStyle = '#000'; ctx.m.fillRect(0, 0, W, H);
  ctx.h.fillStyle = '#808080'; ctx.h.fillRect(0, 0, W, H);
  draw(ctx);
  return {
    map: canvasTexture(col, { repeat: true }),
    roughnessMap: canvasTexture(rough, { repeat: true, srgb: false }),
    metalnessMap: canvasTexture(metal, { repeat: true, srgb: false }),
    normalMap: canvasTexture(heightToNormal(hgt, 2.2), { repeat: true, srgb: false }),
  };
}

function glassGradient(g, x, y, w, h, tint = [70, 90, 110], seed = 1) {
  const rand = mulberry32(seed);
  const grad = g.createLinearGradient(x, y, x + w * 0.3, y + h);
  const [r, gg, b] = tint;
  grad.addColorStop(0, `rgb(${r + 70},${gg + 70},${b + 70})`);
  grad.addColorStop(0.45, `rgb(${r},${gg},${b})`);
  grad.addColorStop(1, `rgb(${r * 0.5},${gg * 0.5},${b * 0.55})`);
  g.fillStyle = grad;
  g.fillRect(x, y, w, h);
  // Blinds / curtains in some windows.
  if (rand() < 0.35) {
    g.fillStyle = `rgba(${200 + rand() * 40},${190 + rand() * 40},${170 + rand() * 30},0.55)`;
    g.fillRect(x, y, w, h * (0.2 + rand() * 0.5));
  }
}

function paintWindow(ctx, x, y, w, h, opts = {}) {
  const { c, r, m, h: hg } = ctx;
  const frame = opts.frame ?? '#e9e6df';
  // Recess shadow.
  c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(x - 3, y - 3, w + 6, h + 6);
  c.fillStyle = frame; c.fillRect(x - 2, y - 2, w + 4, h + 4);
  glassGradient(c, x + 3, y + 3, w - 6, h - 6, opts.tint, opts.seed);
  // Mullion.
  c.fillStyle = frame;
  if (opts.split !== false) c.fillRect(x + 3, y + h * 0.48, w - 6, 4);
  r.fillStyle = '#d0d0d0'; r.fillRect(x - 3, y - 3, w + 6, h + 6);
  r.fillStyle = '#101010'; r.fillRect(x + 3, y + 3, w - 6, h - 6);
  m.fillStyle = '#b0b0b0'; m.fillRect(x + 3, y + 3, w - 6, h - 6);
  hg.fillStyle = '#2a2a2a'; hg.fillRect(x - 2, y - 2, w + 4, h + 4);
  hg.fillStyle = '#505050'; hg.fillRect(x + 3, y + 3, w - 6, h - 6);
  // Sill.
  if (opts.sill !== false) {
    c.fillStyle = opts.sillColor ?? '#cfc9bd'; c.fillRect(x - 8, y + h + 2, w + 16, 9);
    hg.fillStyle = '#e0e0e0'; hg.fillRect(x - 8, y + h + 2, w + 16, 9);
    r.fillStyle = '#c8c8c8'; r.fillRect(x - 8, y + h + 2, w + 16, 9);
  }
  if (opts.lintel) {
    c.fillStyle = opts.lintel; c.fillRect(x - 6, y - 14, w + 12, 11);
    hg.fillStyle = '#d0d0d0'; hg.fillRect(x - 6, y - 14, w + 12, 11);
  }
}

function brickBase(ctx, color, seed) {
  const { c, r, h, W, H } = ctx;
  const rand = mulberry32(seed);
  const base = new THREE.Color(color);
  c.fillStyle = '#9b958a'; c.fillRect(0, 0, W, H);
  r.fillStyle = '#e6e6e6'; r.fillRect(0, 0, W, H);
  h.fillStyle = '#303030'; h.fillRect(0, 0, W, H);
  const rows = 40, bw = W / 10, bh = H / rows;
  for (let row = 0; row < rows; row++) {
    const off = (row % 2) * bw / 2;
    for (let k = -1; k <= 10; k++) {
      const t = base.clone().offsetHSL((rand() - 0.5) * 0.03, (rand() - 0.5) * 0.1, (rand() - 0.5) * 0.1);
      c.fillStyle = '#' + t.getHexString();
      c.fillRect(k * bw + off + 1, row * bh + 1, bw - 2, bh - 2);
      const v = 150 + rand() * 60;
      h.fillStyle = `rgb(${v},${v},${v})`;
      h.fillRect(k * bw + off + 1, row * bh + 1, bw - 2, bh - 2);
    }
  }
  const n = fbmTiling(seed, 4, 4);
  const img = c.getImageData(0, 0, W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const k = 0.85 + n(x / W, y / H) * 0.3;
    img.data[i] *= k; img.data[i + 1] *= k; img.data[i + 2] *= k;
  }
  c.putImageData(img, 0, 0);
}

function concreteBase(ctx, tone, seed) {
  const { c, r, h, W, H } = ctx;
  const n = fbmTiling(seed, 4, 5);
  const img = c.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const v = tone + (n(x / W, y / H) - 0.5) * 30;
    img.data[i] = v; img.data[i + 1] = v * 0.98; img.data[i + 2] = v * 0.94; img.data[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  r.fillStyle = '#d8d8d8'; r.fillRect(0, 0, W, H);
  // Panel joint along the floor line.
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, H - 4, W, 4);
  h.fillStyle = '#404040'; h.fillRect(0, H - 4, W, 4);
}

// Tile sizes in meters: bay width (u) and floor height (v).
export const BAY = 3.2, FLOOR = 3.4;

export function brickFacade(color, seed = 1, style = 0) {
  return once(`brick${color}${seed}${style}`, () => facadeSet(256, 272, (ctx) => {
    brickBase(ctx, color, seed);
    const w = style === 1 ? 110 : 96, hgt = style === 1 ? 150 : 140;
    paintWindow(ctx, (256 - w) / 2, 70, w, hgt, { seed, lintel: style === 2 ? '#d8d2c4' : null, frame: style === 1 ? '#2b2d30' : '#ece8de' });
  }));
}

export function glassCurtain(tint = [60, 92, 112], seed = 4) {
  return once(`glass${tint}${seed}`, () => facadeSet(128, 272, (ctx) => {
    const { c, r, m, h, W, H } = ctx;
    const rand = mulberry32(seed);
    glassGradient(c, 0, 0, W, H, tint, seed);
    // Floor slab band (spandrel) and vertical mullions.
    c.fillStyle = `rgb(${tint[0] * 0.55},${tint[1] * 0.55},${tint[2] * 0.6})`;
    c.fillRect(0, H - 52, W, 52);
    r.fillStyle = '#0d0d0d'; r.fillRect(0, 0, W, H);
    r.fillStyle = '#303030'; r.fillRect(0, H - 52, W, 52);
    m.fillStyle = '#e0e0e0'; m.fillRect(0, 0, W, H);
    c.fillStyle = '#5d646c';
    c.fillRect(0, 0, 6, H); c.fillRect(W - 6, 0, 6, H);
    c.fillRect(0, H - 54, W, 5);
    r.fillStyle = '#707070'; r.fillRect(0, 0, 6, H); r.fillRect(W - 6, 0, 6, H);
    h.fillStyle = '#c0c0c0'; h.fillRect(0, 0, 6, H); h.fillRect(W - 6, 0, 6, H); h.fillRect(0, H - 54, W, 5);
    if (rand() < 0.5) { c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(0, 0, W, H * 0.4); }
  }));
}

export function concreteOffice(tone = 168, seed = 7) {
  return once(`conc${tone}${seed}`, () => facadeSet(256, 272, (ctx) => {
    concreteBase(ctx, tone, seed);
    paintWindow(ctx, 22, 50, 212, 150, { seed, frame: '#3a3d42', sill: false, split: false, tint: [55, 75, 95] });
  }));
}

export function stuccoFacade(color = '#d9cdb5', seed = 11) {
  return once(`stucco${color}${seed}`, () => facadeSet(256, 272, (ctx) => {
    const { c, r, h, W, H } = ctx;
    const n = fbmTiling(seed, 8, 4);
    const base = new THREE.Color(color);
    const img = c.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, k = 0.9 + n(x / W, y / H) * 0.2;
      img.data[i] = base.r * 255 * k; img.data[i + 1] = base.g * 255 * k; img.data[i + 2] = base.b * 255 * k; img.data[i + 3] = 255;
    }
    c.putImageData(img, 0, 0);
    r.fillStyle = '#e0e0e0'; r.fillRect(0, 0, W, H);
    paintWindow(ctx, 70, 66, 116, 132, { seed, frame: '#ffffff', tint: [80, 95, 110] });
  }));
}

// Corrugated metal siding for warehouses and shops.
export function corrugated(color = '#9aa3a8', seed = 3) {
  return once(`corr${color}${seed}`, () => facadeSet(128, 272, (ctx) => {
    const { c, r, m, h, W, H } = ctx;
    const base = new THREE.Color(color);
    for (let x = 0; x < W; x++) {
      const s = Math.sin((x / W) * Math.PI * 2 * 8) * 0.5 + 0.5;
      const k = 0.75 + s * 0.35;
      c.fillStyle = `rgb(${base.r * 255 * k},${base.g * 255 * k},${base.b * 255 * k})`;
      c.fillRect(x, 0, 1, H);
      const v = 60 + s * 160;
      h.fillStyle = `rgb(${v},${v},${v})`; h.fillRect(x, 0, 1, H);
    }
    r.fillStyle = '#909090'; r.fillRect(0, 0, W, H);
    m.fillStyle = '#707070'; m.fillRect(0, 0, W, H);
    // Rust streaks.
    const rand = mulberry32(seed);
    for (let i = 0; i < 6; i++) {
      c.fillStyle = `rgba(120,70,30,${0.08 + rand() * 0.1})`;
      c.fillRect(rand() * W, rand() * H * 0.3, 2 + rand() * 4, H * (0.3 + rand() * 0.6));
    }
  }));
}

export function cinderBlock(color = '#d9d6cf', seed = 5) {
  return once(`cinder${color}${seed}`, () => facadeSet(256, 272, (ctx) => {
    const { c, r, h, W, H } = ctx;
    const base = new THREE.Color(color);
    const rand = mulberry32(seed);
    c.fillStyle = '#8f8b84'; c.fillRect(0, 0, W, H);
    h.fillStyle = '#404040'; h.fillRect(0, 0, W, H);
    const rows = 8, bw = W / 2, bh = H / rows;
    for (let row = 0; row < rows; row++) {
      for (let k = -1; k <= 2; k++) {
        const x = k * bw + (row % 2) * bw / 2;
        const t = base.clone().offsetHSL(0, 0, (rand() - 0.5) * 0.05);
        c.fillStyle = '#' + t.getHexString();
        c.fillRect(x + 2, row * bh + 2, bw - 4, bh - 4);
        h.fillStyle = '#b0b0b0'; h.fillRect(x + 2, row * bh + 2, bw - 4, bh - 4);
      }
    }
    r.fillStyle = '#e8e8e8'; r.fillRect(0, 0, W, H);
  }));
}

// Storefront ground floor: big plate glass, a door, a kick plate.
export function storefront(frame = '#2b2d30', seed = 2) {
  return once(`store${frame}${seed}`, () => facadeSet(256, 336, (ctx) => {
    const { c, r, m, h, W, H } = ctx;
    c.fillStyle = frame; c.fillRect(0, 0, W, H);
    r.fillStyle = '#606060'; r.fillRect(0, 0, W, H);
    m.fillStyle = '#909090'; m.fillRect(0, 0, W, H);
    const rand = mulberry32(seed);
    const door = rand() < 0.4;
    const gx = 10, gy = 70, gw = W - 20, gh = H - 120;
    glassGradient(c, gx, gy, gw, gh, [40, 55, 70], seed);
    // Merchandise / interior shapes behind the glass.
    for (let i = 0; i < 9; i++) {
      c.fillStyle = `hsla(${rand() * 360},40%,${30 + rand() * 30}%,0.55)`;
      c.fillRect(gx + rand() * gw * 0.9, gy + gh * (0.45 + rand() * 0.4), 10 + rand() * 30, 8 + rand() * 40);
    }
    r.fillStyle = '#0a0a0a'; r.fillRect(gx, gy, gw, gh);
    m.fillStyle = '#c0c0c0'; m.fillRect(gx, gy, gw, gh);
    if (door) {
      c.fillStyle = frame; c.fillRect(W / 2 - 4, gy, 8, gh);
      c.fillStyle = '#c9ccd1'; c.fillRect(W / 2 + 10, gy + gh * 0.5, 4, 26);
    }
    // Kick plate and transom.
    c.fillStyle = '#3b3e43'; c.fillRect(0, H - 50, W, 50);
    c.fillStyle = frame; c.fillRect(0, 60, W, 10);
    h.fillStyle = '#303030'; h.fillRect(gx, gy, gw, gh);
  }));
}

export function rowhouseGround(color, seed = 1) {
  return once(`rowg${color}${seed}`, () => facadeSet(512, 336, (ctx) => {
    brickBase(ctx, color, seed);
    const { c, r, h } = ctx;
    // Door with a transom and a pair of windows.
    c.fillStyle = '#2b1d14'; c.fillRect(60, 110, 92, 200);
    c.fillStyle = '#5a3a24'; c.fillRect(68, 120, 76, 186);
    c.fillStyle = '#d4af37'; c.fillRect(132, 210, 6, 6);
    glassGradient(c, 66, 76, 80, 30, [80, 95, 110], seed);
    h.fillStyle = '#404040'; h.fillRect(60, 110, 92, 200);
    paintWindow(ctx, 230, 110, 96, 140, { seed: seed + 1 });
    paintWindow(ctx, 370, 110, 96, 140, { seed: seed + 2 });
  }));
}

export function gravelRoof() {
  return once('roof', () => {
    const N = 256;
    const rand = mulberry32(31);
    const col = makeCanvas(N, N), hgt = makeCanvas(N, N);
    const c = col.getContext('2d'), h = hgt.getContext('2d');
    const img = c.createImageData(N, N), himg = h.createImageData(N, N);
    for (let i = 0; i < N * N; i++) {
      const v = 95 + rand() * 50;
      img.data[i * 4] = v; img.data[i * 4 + 1] = v * 0.97; img.data[i * 4 + 2] = v * 0.92; img.data[i * 4 + 3] = 255;
      const hv = rand() * 255;
      himg.data[i * 4] = himg.data[i * 4 + 1] = himg.data[i * 4 + 2] = hv; himg.data[i * 4 + 3] = 255;
    }
    c.putImageData(img, 0, 0); h.putImageData(himg, 0, 0);
    return { map: canvasTexture(col, { repeat: true }), normalMap: canvasTexture(heightToNormal(hgt, 2), { repeat: true, srgb: false }) };
  });
}

// Sign atlas: every business sign lives in one texture (one draw call).
export class SignAtlas {
  constructor(cols = 4, rows = 32, cw = 512, ch = 96) {
    this.cols = cols; this.rows = rows; this.cw = cw; this.ch = ch;
    this.canvas = makeCanvas(cols * cw, rows * ch);
    this.g = this.canvas.getContext('2d');
    this.next = 0;
    this.texture = canvasTexture(this.canvas, { aniso: 8 });
    this.material = new THREE.MeshStandardMaterial({ map: this.texture, roughness: 0.45, metalness: 0.1, emissive: 0xffffff, emissiveMap: this.texture, emissiveIntensity: 0.08 });
  }
  add(text, { bg = '#1d3557', fg = '#ffffff', font = '"Arial Black", Impact, Arial, sans-serif', sub = '' } = {}) {
    // Identical signs share a slot, so the atlas never wraps and overwrites.
    const key = `${text}|${bg}|${fg}|${sub}`;
    this.slots ||= new Map();
    if (this.slots.has(key)) return this.slots.get(key);
    if (this.next >= this.cols * this.rows) console.warn('Sign atlas full');
    const i = this.next++ % (this.cols * this.rows);
    const cx = (i % this.cols) * this.cw, cy = Math.floor(i / this.cols) * this.ch;
    const g = this.g;
    g.save();
    g.translate(cx, cy);
    g.fillStyle = bg; g.fillRect(0, 0, this.cw, this.ch);
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 4; g.strokeRect(4, 4, this.cw - 8, this.ch - 8);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = sub ? 50 : 60;
    g.font = `900 ${size}px ${font}`;
    while (g.measureText(text).width > this.cw - 40 && size > 14) { size -= 2; g.font = `900 ${size}px ${font}`; }
    g.fillText(text, this.cw / 2, sub ? this.ch * 0.4 : this.ch / 2 + 2);
    if (sub) { g.font = `600 20px Arial, sans-serif`; g.fillText(sub, this.cw / 2, this.ch * 0.8); }
    g.restore();
    this.texture.needsUpdate = true;
    // UV rect (flipY: canvas top = v 1).
    const u0 = cx / this.canvas.width, u1 = (cx + this.cw) / this.canvas.width;
    const v1 = 1 - cy / this.canvas.height, v0 = 1 - (cy + this.ch) / this.canvas.height;
    const uv = [u0, v0, u1, v1];
    this.slots.set(key, uv);
    return uv;
  }
}

export function facadeMaterial(set, opts = {}) {
  return new THREE.MeshStandardMaterial({ ...set, metalness: 1, roughness: 1, envMapIntensity: 1.0, ...opts });
}
