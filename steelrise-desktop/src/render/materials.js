// Procedural surface materials. Every texture is painted at startup on a
// canvas (no image files ship with the game), tiled in metres so steel,
// concrete and timber read at their real scale. Part colours come from vertex
// colours, so one material per surface type serves every item.

import * as THREE from "three";

const TEX = 256;

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// tileable value noise, octaves summed into a Float32Array (0..1)
function noise(size, scales, seed) {
  const out = new Float32Array(size * size);
  const r = rng(seed);
  let total = 0;
  for (const [cells, amp] of scales) {
    const g = new Float32Array(cells * cells).map(() => r());
    const step = size / cells;
    for (let y = 0; y < size; y++) {
      const gy = y / step, y0 = Math.floor(gy) % cells, y1 = (y0 + 1) % cells, ty = gy - Math.floor(gy), sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < size; x++) {
        const gx = x / step, x0 = Math.floor(gx) % cells, x1 = (x0 + 1) % cells, tx = gx - Math.floor(gx), sx = tx * tx * (3 - 2 * tx);
        const a = g[y0 * cells + x0], b = g[y0 * cells + x1], c = g[y1 * cells + x0], d = g[y1 * cells + x1];
        out[y * size + x] += amp * ((a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy);
      }
    }
    total += amp;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

function canvasTex(size, paint, srgb = true) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(size, size);
  paint(img.data, size, ctx);
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.generateMipmaps = true;
  return t;
}

// greyscale albedo modulation around 1.0 (vertex colour carries the hue)
function albedo(n, lo, hi) {
  return canvasTex(TEX, (d, s) => {
    for (let i = 0; i < s * s; i++) {
      const v = Math.round(255 * (lo + (hi - lo) * n[i]));
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
      d[i * 4 + 3] = 255;
    }
  });
}
function rough(n, lo, hi) {
  return canvasTex(TEX, (d, s) => {
    for (let i = 0; i < s * s; i++) {
      const v = Math.round(255 * (lo + (hi - lo) * n[i]));
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
      d[i * 4 + 3] = 255;
    }
  }, false);
}
// normal map from a height field
function normalFrom(h, strength) {
  return canvasTex(TEX, (d, s) => {
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const l = h[y * s + ((x - 1 + s) % s)], r = h[y * s + ((x + 1) % s)];
        const u = h[((y - 1 + s) % s) * s + x], dn = h[((y + 1) % s) * s + x];
        let nx = (l - r) * strength, ny = (u - dn) * strength, nz = 1;
        const len = Math.hypot(nx, ny, nz);
        const i = (y * s + x) * 4;
        d[i] = Math.round((nx / len * 0.5 + 0.5) * 255);
        d[i + 1] = Math.round((ny / len * 0.5 + 0.5) * 255);
        d[i + 2] = Math.round((nz / len * 0.5 + 0.5) * 255);
        d[i + 3] = 255;
      }
    }
  }, false);
}

function brushed(seed) {
  // streaks along U
  const out = new Float32Array(TEX * TEX);
  const r = rng(seed);
  const rows = new Float32Array(TEX).map(() => r());
  const base = noise(TEX, [[8, 1], [32, 0.5]], seed + 1);
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) out[y * TEX + x] = rows[y] * 0.45 + base[y * TEX + x] * 0.55;
  return out;
}

function planks(seed) {
  const out = new Float32Array(TEX * TEX);
  const grain = noise(TEX, [[4, 1], [64, 0.25]], seed);
  const r = rng(seed);
  const board = TEX / 4;
  const shade = [r(), r(), r(), r()];
  for (let y = 0; y < TEX; y++) {
    const b = Math.floor(y / board);
    const edge = y % board < 2 ? 0.35 : 1;
    for (let x = 0; x < TEX; x++) {
      const g = Math.sin((x / TEX) * Math.PI * 18 + grain[y * TEX + x] * 9 + b * 3) * 0.5 + 0.5;
      out[y * TEX + x] = (0.55 + 0.25 * g + 0.2 * shade[b]) * edge;
    }
  }
  return out;
}

function bricks() {
  const out = new Float32Array(TEX * TEX);
  const n = noise(TEX, [[32, 1], [128, 0.6]], 77);
  const r = rng(91);
  const rowsN = 8, brickW = TEX / 4;
  const tone = Array.from({ length: 64 }, () => 0.75 + 0.25 * r());
  for (let y = 0; y < TEX; y++) {
    const row = Math.floor(y / (TEX / rowsN));
    const off = (row % 2) * brickW / 2;
    for (let x = 0; x < TEX; x++) {
      const xx = (x + off) % TEX;
      const mortar = y % (TEX / rowsN) < 3 || xx % brickW < 3;
      const id = row * 4 + Math.floor(xx / brickW);
      out[y * TEX + x] = mortar ? 0.95 : tone[id % 64] * (0.85 + 0.15 * n[y * TEX + x]);
    }
  }
  return out;
}

function diamondPlate() {
  const out = new Float32Array(TEX * TEX);
  const cell = TEX / 8;
  for (let y = 0; y < TEX; y++) {
    for (let x = 0; x < TEX; x++) {
      const cx = (x % cell) / cell - 0.5, cy = (y % cell) / cell - 0.5;
      const flip = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 0;
      const u = flip ? cx + cy : cx - cy, w = flip ? cx - cy : cx + cy;
      const lug = Math.abs(u) < 0.32 && Math.abs(w) < 0.07;
      out[y * TEX + x] = lug ? 1 : 0;
    }
  }
  return out;
}

function fabric() {
  const out = new Float32Array(TEX * TEX);
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) out[y * TEX + x] = ((x >> 1) + (y >> 1)) % 2 ? 0.9 : 0.6;
  return out;
}

// material specs: tile = metres per texture repeat
const SPECS = {
  Metal: { tile: 1.5, metal: 0.55, rough: [0.38, 0.62], albedo: [0.82, 1.0], noise: "brushed", normal: 0.6 },
  DiamondPlate: { tile: 0.6, metal: 0.65, rough: [0.3, 0.55], albedo: [0.85, 1.0], noise: "diamond", normal: 6 },
  CorrodedMetal: { tile: 2, metal: 0.35, rough: [0.6, 0.95], albedo: [0.55, 1.0], noise: "rust", normal: 1.5 },
  Concrete: { tile: 2.5, metal: 0, rough: [0.78, 0.98], albedo: [0.78, 1.0], noise: "concrete", normal: 1.4 },
  Pavement: { tile: 3, metal: 0, rough: [0.8, 0.98], albedo: [0.8, 1.0], noise: "concrete", normal: 1.2 },
  Asphalt: { tile: 3, metal: 0, rough: [0.82, 1.0], albedo: [0.7, 1.0], noise: "gravel", normal: 2 },
  Slate: { tile: 2.5, metal: 0, rough: [0.75, 0.95], albedo: [0.82, 1.0], noise: "gravel", normal: 1.4 },
  Pebble: { tile: 1.5, metal: 0, rough: [0.7, 0.95], albedo: [0.6, 1.0], noise: "gravel", normal: 3 },
  Ground: { tile: 4, metal: 0, rough: [0.85, 1.0], albedo: [0.7, 1.0], noise: "dirt", normal: 1.6 },
  Mud: { tile: 4, metal: 0, rough: [0.45, 0.9], albedo: [0.6, 1.0], noise: "dirt", normal: 1.2 },
  Grass: { tile: 3, metal: 0, rough: [0.8, 1.0], albedo: [0.62, 1.0], noise: "grass", normal: 1.5 },
  LeafyGrass: { tile: 2, metal: 0, rough: [0.75, 1.0], albedo: [0.55, 1.0], noise: "grass", normal: 2 },
  Wood: { tile: 1.2, metal: 0, rough: [0.6, 0.85], albedo: [0.7, 1.0], noise: "planks", normal: 1 },
  WoodPlanks: { tile: 1.2, metal: 0, rough: [0.6, 0.85], albedo: [0.65, 1.0], noise: "planks", normal: 2 },
  Brick: { tile: 1.0, metal: 0, rough: [0.8, 0.98], albedo: [0.75, 1.0], noise: "brick", normal: 3 },
  Fabric: { tile: 0.3, metal: 0, rough: [0.85, 1.0], albedo: [0.82, 1.0], noise: "fabric", normal: 1 },
  SmoothPlastic: { tile: 2, metal: 0, rough: [0.42, 0.55], albedo: [0.96, 1.0], noise: "fine", normal: 0 },
  Plastic: { tile: 2, metal: 0, rough: [0.45, 0.6], albedo: [0.94, 1.0], noise: "fine", normal: 0.3 },
  Glass: { glass: true },
  FacadeGlass: { facade: true },
  Neon: { neon: true },
  Water: { water: true },
};

const cache = new Map();
let texSets = null;

function buildTexSets() {
  const sets = {};
  const make = (key, field, alb, rgh, nrm) => {
    sets[key] = { field, alb, rgh, nrm };
  };
  const fields = {
    brushed: brushed(11),
    diamond: diamondPlate(),
    rust: noise(TEX, [[4, 1], [16, 0.8], [64, 0.5]], 21),
    concrete: noise(TEX, [[8, 0.6], [32, 0.5], [128, 0.6]], 31),
    gravel: noise(TEX, [[64, 1], [128, 1]], 41),
    dirt: noise(TEX, [[4, 1], [16, 0.7], [128, 0.4]], 51),
    grass: noise(TEX, [[16, 0.5], [128, 1]], 61),
    planks: planks(71),
    brick: bricks(),
    fabric: fabric(),
    fine: noise(TEX, [[16, 1]], 81),
  };
  for (const [k, f] of Object.entries(fields)) make(k, f);
  return sets;
}

export const MAT_TILE = Object.fromEntries(Object.entries(SPECS).map(([k, s]) => [k, s.tile || 1]));

// shared texture triple per (noise kind, ranges)
function texturesFor(spec) {
  texSets = texSets || buildTexSets();
  const key = `${spec.noise}|${spec.albedo}|${spec.rough}|${spec.normal}`;
  if (cache.has("tex:" + key)) return cache.get("tex:" + key);
  const f = texSets[spec.noise].field;
  const t = {
    map: albedo(f, spec.albedo[0], spec.albedo[1]),
    roughnessMap: rough(f, spec.rough[0], spec.rough[1]),
    normalMap: spec.normal ? normalFrom(f, spec.normal) : null,
  };
  cache.set("tex:" + key, t);
  return t;
}

// key: material name + transparency + reflectance buckets
export function getMaterial(mat, tr = 0, refl = 0) {
  const key = `${mat}|${tr}|${refl}`;
  if (cache.has(key)) return cache.get(key);
  const spec = SPECS[mat] || SPECS.SmoothPlastic;
  let m;
  if (spec.glass) {
    m = new THREE.MeshPhysicalMaterial({ vertexColors: true, metalness: 0.1, roughness: 0.04, transparent: true, opacity: Math.min(0.85, 0.32 + (1 - Math.max(tr, 0.3)) * 0.4), envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide });
  } else if (spec.facade) {
    m = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.85, roughness: 0.12, envMapIntensity: 1.1 });
    m.color = new THREE.Color(0.55, 0.6, 0.65);
  } else if (spec.neon) {
    m = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  } else if (spec.water) {
    m = new THREE.MeshPhysicalMaterial({ color: 0x2c4c5c, metalness: 0, roughness: 0.08, transparent: true, opacity: 0.88, envMapIntensity: 1.2 });
  } else {
    const t = texturesFor(spec);
    m = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: t.map,
      roughnessMap: t.roughnessMap,
      normalMap: t.normalMap,
      metalness: spec.metal,
      roughness: 1,
      envMapIntensity: 1.0 + refl * 3,
    });
    if (t.normalMap) m.normalScale.set(0.6, 0.6);
    if (refl > 0) m.roughness = Math.max(0.35, 1 - refl * 3);
    if (tr > 0) {
      m.transparent = true;
      m.opacity = 1 - tr;
      m.depthWrite = tr < 0.5;
      m.side = THREE.DoubleSide;
    }
  }
  m.name = key;
  cache.set(key, m);
  return m;
}

// Unlit lens material: instance colour switches it between dim and lit.
let lensMat = null;
export function getLensMaterial() {
  lensMat = lensMat || new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  return lensMat;
}

// Ghost (placement preview) materials, shared.
const ghosts = {};
export function getGhostMaterial(kind) {
  if (!ghosts[kind]) {
    const color = { valid: 0x58d68d, invalid: 0xeb5748, info: 0x6eaaeb, plan: 0x6eaaeb }[kind] || 0xffffff;
    ghosts[kind] = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: kind === "plan" ? 0.16 : 0.42, depthWrite: false });
  }
  return ghosts[kind];
}

// Text sign texture (signs on boards, crane, gate).
export function signTexture(text, bg, fg, aspect) {
  const h = 256, w = Math.max(64, Math.min(2048, Math.round(h * aspect)));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  const hex = (n) => "#" + n.toString(16).padStart(6, "0");
  ctx.fillStyle = bg === undefined ? "rgba(0,0,0,0)" : hex(bg);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = hex(fg ?? 0xffffff);
  const lines = String(text).split("\n");
  let size = h / (lines.length * 1.25);
  ctx.font = `900 ${size}px "Segoe UI", Arial, sans-serif`;
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
  if (widest > w * 0.9) size *= (w * 0.9) / widest;
  ctx.font = `900 ${size}px "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((l, i) => ctx.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.15));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
