/* The joiner's kit: the shapes and finishes every piece of furniture is put
 * together from — softened boxes, cushions, turned legs, cabinets with doors,
 * drawers and handles, shelves and the stock that fills them, lit screens,
 * pictures, books. Furniture stands on y = 0, centred, its front toward +z;
 * sizes are feet and textures keep their real scale on every piece. */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { cylGeo } from './builder.js';
import * as M from './materials.js';
import { rng } from './textures.js';

export const PI = Math.PI;

/* ------------------------------------------------------------- palettes */

export const WOODS = [['#a8743f', 'Oak'], ['#7a4f2c', 'Walnut'], ['#d2b48a', 'Maple'], ['#5b3a26', 'Espresso'], ['#c9c5bb', 'Grey wash'], ['#f1efe9', 'White'], ['#2b2b2e', 'Black']];
export const FABRICS = [['#5d6670', 'Slate'], ['#2f3b4d', 'Navy'], ['#7a7468', 'Stone'], ['#8a3b3b', 'Brick red'], ['#3f6b52', 'Forest'], ['#c9c3b5', 'Oatmeal'], ['#3b3b3f', 'Charcoal'], ['#2e5b7a', 'Teal blue'], ['#b0782f', 'Mustard'], ['#6d4a8a', 'Plum']];
export const LEATHERS = [['#2a2a2c', 'Black'], ['#4a2f1f', 'Dark brown'], ['#7a4a2a', 'Tan'], ['#b08a5a', 'Saddle'], ['#e2ddd2', 'Cream'], ['#5d1f1f', 'Oxblood']];
export const LAMINATES = [['#e9e6df', 'Off-white'], ['#f6f5f1', 'White'], ['#c9c5bb', 'Grey'], ['#8a8f96', 'Storm'], ['#3d434b', 'Graphite'], ['#a8743f', 'Oak effect']];
export const METALS = [['#2b2f36', 'Black'], ['#c9ced3', 'Silver'], ['#f1f2f0', 'White'], ['#8a8f96', 'Grey'], ['#1f4f9c', 'Blue'], ['#c0392b', 'Red']];
export const BRIGHTS = [['#c0392b', 'Red'], ['#1f4f9c', 'Blue'], ['#1f7a54', 'Green'], ['#e2b31b', 'Yellow'], ['#e36a1c', 'Orange'], ['#2b2f36', 'Black'], ['#f1f2f0', 'White'], ['#6d4a8a', 'Purple']];
export const PRODUCT = ['#c0392b', '#e2b31b', '#1f4f9c', '#1f7a54', '#e36a1c', '#f4f4f0', '#6d4a8a', '#2e6f8e', '#b84a6a', '#8a5a36', '#d9d4c7', '#2b2f36', '#3fa0a8', '#9ac43a'];

/* ------------------------------------------------------------ the shapes */

/** Give a geometry UVs in feet, by whichever way each face looks. */
export function feetUV(geo) {
  const p = geo.attributes.position;
  const n = geo.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i));
    const ay = Math.abs(n.getY(i));
    const az = Math.abs(n.getZ(i));
    if (ay >= ax && ay >= az) { uv[i * 2] = p.getX(i); uv[i * 2 + 1] = p.getZ(i); }
    else if (ax >= az) { uv[i * 2] = p.getZ(i); uv[i * 2 + 1] = p.getY(i); }
    else { uv[i * 2] = p.getX(i); uv[i * 2 + 1] = p.getY(i); }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

/** A box with eased edges standing on y0. r is the edge radius. */
export function rbox(B, mat, w, h, d, x = 0, y0 = 0, z = 0, r = 0.04, rot = null) {
  const rr = Math.max(0.005, Math.min(r, w / 2 - 0.002, h / 2 - 0.002, d / 2 - 0.002));
  const g = feetUV(new RoundedBoxGeometry(Math.max(0.02, w), Math.max(0.02, h), Math.max(0.02, d), 2, rr));
  return B.add(g, mat, { pos: [x, y0 + h / 2, z], rot });
}

/** A plain box standing on y0 (hard edges: carcasses, boards, glass). */
export const slab = (B, mat, w, h, d, x = 0, y0 = 0, z = 0, rot = null) => B.box(mat, Math.max(0.01, w), Math.max(0.01, h), Math.max(0.01, d), x, y0 + h / 2, z, rot);

/** A cushion: a soft-edged box, plump on top. */
export function cushion(B, mat, w, h, d, x, y0, z, { r = null, rot = null, puff = 0.12 } = {}) {
  const rr = r ?? Math.min(h * 0.45, 0.16);
  const g = new RoundedBoxGeometry(w, h, d, 3, Math.max(0.01, Math.min(rr, w / 2 - 0.01, h / 2 - 0.005, d / 2 - 0.01)));
  if (puff) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = 1 - (p.getX(i) / (w / 2)) ** 2;
      const v = 1 - (p.getZ(i) / (d / 2)) ** 2;
      if (p.getY(i) > 0) p.setY(i, p.getY(i) + Math.max(0, u) * Math.max(0, v) * h * puff);
    }
    g.computeVertexNormals();
  }
  feetUV(g);
  return B.add(g, mat, { pos: [x, y0 + h / 2, z], rot });
}

/** A round post standing on y0; rt / rb give it a taper. */
export const post = (B, mat, rt, rb, h, x, y0, z, seg = 12) => B.add(cylGeo(rt, rb, h, seg), mat, { pos: [x, y0 + h / 2, z] });

/** A disc or drum lying flat, resting on y0. */
export const disc = (B, mat, r, h, x, y0, z, seg = 24) => B.add(cylGeo(r, r, h, seg), mat, { pos: [x, y0 + h / 2, z] });

/** A cylinder along x (rails, rolls, handles) centred at x, y, z. */
export const barX = (B, mat, r, len, x, y, z, seg = 10) => B.add(cylGeo(r, r, len, seg).rotateZ(PI / 2), mat, { pos: [x, y, z] });
export const barZ = (B, mat, r, len, x, y, z, seg = 10) => B.add(cylGeo(r, r, len, seg).rotateX(PI / 2), mat, { pos: [x, y, z] });

/** A turned shape: profile is [[radius, height], ...] from the bottom up. */
export function lathe(B, mat, profile, x = 0, y0 = 0, z = 0, seg = 20, rot = null) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(0.0005, r), y)), seg);
  feetUV(g);
  return B.add(g, mat, { pos: [x, y0, z], rot });
}

/** Four legs under a top: square (r = 0) or round, optionally tapering. */
export function legs(B, mat, w, d, h, { inset = 0.12, t = 0.14, round = false, taper = 1, y0 = 0, splay = 0 } = {}) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (w / 2 - inset);
    const z = sz * (d / 2 - inset);
    if (round) {
      const g = cylGeo(t / 2, (t / 2) * taper, h, 10);
      B.add(g, mat, { pos: [x + sx * splay * h * 0.5, y0 + h / 2, z + sz * splay * h * 0.5], rot: splay ? [sz * -splay, 0, sx * splay] : null });
    } else slab(B, mat, t, h, t, x, y0, z);
  }
}

/** A bar handle on a door or drawer front (the front faces +z at z). */
export function handle(B, mat, x, y, z, len = 0.4, vertical = false) {
  if (vertical) {
    B.add(cylGeo(0.022, 0.022, len, 8), mat, { pos: [x, y, z + 0.07] });
    for (const dy of [-len * 0.38, len * 0.38]) barZ(B, mat, 0.016, 0.07, x, y + dy, z + 0.035, 6);
  } else {
    barX(B, mat, 0.022, len, x, y, z + 0.07, 8);
    for (const dx of [-len * 0.38, len * 0.38]) barZ(B, mat, 0.016, 0.07, x + dx, y, z + 0.035, 6);
  }
}

/**
 * A cabinet: carcass, plinth, and a front of doors or drawers with handles.
 * fronts: [{ kind: 'door' | 'drawer' | 'open' | 'glass', n, rows }] left to right
 * in equal bays, or a single { kind, cols, rows }.
 */
export function cabinet(B, { w, h, d, x = 0, y0 = 0, z = 0, body, front, top = null, topT = 0.1, over = 0.06, toe = 0.3, cols = 2, rows = 1, kind = 'door', pull = null, gap = 0.035, back = true, shelves = 0, shelfMat = null }) {
  const hd = pull || M.metal('#b9bfc4', 0.3);
  const carc = h - (top ? topT : 0);
  // Plinth, set back.
  if (toe > 0) slab(B, M.laminate('#2b2f36', 0.6), w - 0.1, toe, d - 0.25, x, y0, z - 0.08);
  const bh = carc - toe;
  if (kind === 'open' || kind === 'glass') {
    // An open or glazed case: sides, back, shelves.
    const t = 0.07;
    slab(B, body, t, bh, d, x - w / 2 + t / 2, y0 + toe, z);
    slab(B, body, t, bh, d, x + w / 2 - t / 2, y0 + toe, z);
    slab(B, body, w, t, d, x, y0 + toe, z);
    slab(B, body, w, t, d, x, y0 + toe + bh - t, z);
    if (back) slab(B, body, w, bh, 0.04, x, y0 + toe, z - d / 2 + 0.02);
    for (let i = 1; i <= shelves; i++) slab(B, shelfMat || body, w - t * 2, 0.06, d - 0.08, x, y0 + toe + (bh * i) / (shelves + 1), z + 0.02);
    if (kind === 'glass') slab(B, M.clearGlass('#b9d3dc'), w - t * 2, bh - t * 2, 0.03, x, y0 + toe + t, z + d / 2 - 0.03);
  } else {
    slab(B, body, w, bh, d - 0.06, x, y0 + toe, z - 0.03);
    const cw = w / cols;
    const rh = bh / rows;
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      const fx = x - w / 2 + cw * (c + 0.5);
      const fy = y0 + toe + rh * r;
      rbox(B, front, cw - gap, rh - gap, 0.07, fx, fy + gap / 2, z + d / 2 - 0.035, 0.012);
      if (kind === 'drawer') handle(B, hd, fx, fy + rh * 0.62, z + d / 2, Math.min(0.5, cw * 0.4));
      else handle(B, hd, fx + (c % 2 === 0 && cols > 1 ? cw * 0.36 : -cw * 0.36) * (cols === 1 ? -1 : 1), fy + (y0 + toe + bh > 4.5 && rows === 1 ? rh * 0.25 : rh * 0.72), z + d / 2, 0.36, true);
    }
  }
  if (top) rbox(B, top, w + over * 2, topT, d + over, x, y0 + carc, z + over / 2, 0.02);
}

/* -------------------------------------------------------------- stock */

/**
 * Fill a shelf with goods: from x0 to x1 at height y, between z0 (back) and z1
 * (front). kind: boxes, cans, bottles, books, folded, bins, cartons, produce.
 */
export function stock(B, r, x0, x1, y, z0, z1, kind = 'boxes', { fill = 0.92, maxH = 1.1, palette = PRODUCT } = {}) {
  const depth = z1 - z0;
  let x = x0 + 0.04;
  const zc = (z0 + z1) / 2;
  while (x < x1 - 0.12) {
    if (r() > fill) { x += 0.25 + r() * 0.5; continue; }
    const col = palette[Math.floor(r() * palette.length)];
    if (kind === 'books') {
      const w = 0.07 + r() * 0.09;
      const h = Math.min(maxH, 0.62 + r() * 0.3);
      if (x + w > x1) break;
      slab(B, M.laminate(col, 0.7), w, h, Math.min(depth, 0.5 + r() * 0.15), x + w / 2, y, z1 - 0.3 - r() * 0.04, r() < 0.06 ? [0, 0, 0.12] : null);
      x += w + 0.004;
    } else if (kind === 'cans' || kind === 'bottles') {
      const rad = kind === 'cans' ? 0.13 : 0.11;
      const h = kind === 'cans' ? 0.36 : Math.min(maxH, 0.72 + r() * 0.2);
      const n = Math.max(1, Math.floor(depth / (rad * 2.1)));
      const run = 2 + Math.floor(r() * 4);
      const mat = kind === 'cans' ? M.painted(col, 0.35) : M.plastic(col, 0.25);
      for (let k = 0; k < run && x + rad * 2 < x1; k++) {
        for (let j = 0; j < Math.min(n, 2); j++) {
          B.add(cylGeo(rad, rad, h, 8), mat, { pos: [x + rad, y + h / 2, z1 - rad - 0.03 - j * rad * 2.1] });
          if (kind === 'bottles') B.add(cylGeo(rad * 0.35, rad * 0.8, h * 0.28, 8), mat, { pos: [x + rad, y + h * 1.12, z1 - rad - 0.03 - j * rad * 2.1] });
        }
        x += rad * 2 + 0.015;
      }
      x += 0.03;
    } else if (kind === 'folded') {
      const w = 0.95 + r() * 0.2;
      if (x + w > x1) break;
      const n = 2 + Math.floor(r() * 4);
      for (let k = 0; k < n; k++) rbox(B, M.cloth(palette[Math.floor(r() * palette.length)]), w, 0.13, Math.min(depth - 0.06, 1.1), x + w / 2, y + k * 0.135, zc, 0.04);
      x += w + 0.12;
    } else if (kind === 'bins') {
      const w = 0.62;
      if (x + w > x1) break;
      slab(B, M.plastic(col, 0.5), w - 0.04, 0.42, Math.min(depth - 0.04, 1.2), x + w / 2, y, zc);
      slab(B, M.plastic('#17191c', 0.8), w - 0.1, 0.02, Math.min(depth - 0.1, 1.1), x + w / 2, y + 0.41, zc);
      x += w;
    } else if (kind === 'produce') {
      const w = 1.3;
      if (x + w > x1) break;
      const mat = M.plastic(['#c8241b', '#e36a1c', '#e2b31b', '#5b9a3a', '#7a2f5a', '#d9c86a'][Math.floor(r() * 6)], 0.55);
      for (let i = 0; i < 4; i++) for (let j = 0; j < Math.max(1, Math.floor(depth / 0.3)); j++) {
        B.add(new THREE.IcosahedronGeometry(0.14, 1), mat, { pos: [x + 0.18 + i * 0.3 + (j % 2) * 0.1, y + 0.13 + ((i + j) % 2) * 0.08, z0 + 0.18 + j * 0.3] });
      }
      x += w + 0.06;
    } else {
      // Boxes and cartons: facings of the same product, a couple deep.
      const w = kind === 'cartons' ? 1.1 + r() * 0.7 : 0.32 + r() * 0.45;
      const h = Math.min(maxH, kind === 'cartons' ? 0.8 + r() * 0.5 : 0.5 + r() * 0.55);
      const run = kind === 'cartons' ? 1 : 1 + Math.floor(r() * 3);
      const mat = kind === 'cartons' ? M.plastic(['#b58a55', '#a67c4a', '#c29a66'][Math.floor(r() * 3)], 0.85) : M.laminate(col, 0.55);
      for (let k = 0; k < run && x + w < x1; k++) {
        slab(B, mat, w - 0.02, h, Math.min(depth - 0.04, kind === 'cartons' ? depth - 0.1 : 0.7), x + w / 2, y, kind === 'cartons' ? zc : z1 - 0.38);
        if (kind !== 'cartons') slab(B, M.laminate('#f4f4f0', 0.6), w * 0.7, h * 0.3, 0.01, x + w / 2, y + h * 0.35, z1 - 0.025);
        else slab(B, M.plastic('#d9c9a8', 0.6), 0.16, 0.012, Math.min(depth - 0.1, 1.2), x + w / 2, y + h, zc);
        x += w;
      }
      x += 0.02;
    }
  }
}

/* -------------------------------------------------------------- screens */

const screens = new Map();
/** What a screen is showing: 'desktop', 'sheet', 'code', 'pos', 'tv', 'menu', 'chart', 'cctv', 'vitals', 'arrivals'. */
export function screenMat(kind = 'desktop', seed = 1) {
  const key = `${kind}|${seed % 4}`;
  if (screens.has(key)) return screens.get(key);
  const W = 320;
  const H = 180;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const r = rng(seed * 131 + kind.length * 17);
  const bar = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  if (kind === 'tv') {
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, ['#2a5b9b', '#7a3b6b', '#1f6b5a', '#c2553a'][seed % 4]);
    sky.addColorStop(1, '#f0c98a');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(20,30,40,.75)';
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) g.lineTo(x, H * 0.62 - r() * 40);
    g.lineTo(W, H);
    g.fill();
    bar(0, H - 26, W, 26, 'rgba(10,14,22,.85)');
    bar(8, H - 20, 60, 14, '#c0392b');
    bar(76, H - 17, 180, 4, '#e9eef2');
    bar(76, H - 10, 120, 3, '#9aa7b3');
  } else if (kind === 'code') {
    bar(0, 0, W, H, '#161b22');
    bar(0, 0, 46, H, '#0f1318');
    const cols = ['#7ee787', '#79c0ff', '#ff7b72', '#d2a8ff', '#c9d1d9', '#ffa657'];
    for (let y = 8; y < H - 6; y += 9) {
      let x = 54 + Math.floor(r() * 3) * 12;
      for (let k = 0; k < 2 + r() * 4 && x < W - 20; k++) { const w = 12 + r() * 60; bar(x, y, w, 4, cols[Math.floor(r() * cols.length)]); x += w + 6; }
    }
  } else if (kind === 'sheet' || kind === 'pos') {
    bar(0, 0, W, H, '#f4f6f8');
    bar(0, 0, W, 16, kind === 'pos' ? '#1f4f9c' : '#1f7a54');
    for (let y = 22; y < H; y += 12) bar(0, y, W, 1, '#c9d1d9');
    for (let x = 40; x < W; x += kind === 'pos' ? 70 : 46) bar(x, 16, 1, H, '#c9d1d9');
    for (let i = 0; i < 46; i++) bar(44 + Math.floor(r() * 6) * 46, 25 + Math.floor(r() * 12) * 12, 14 + r() * 24, 5, r() < 0.2 ? '#c0392b' : '#3d434b');
    if (kind === 'pos') { bar(W - 96, 26, 88, 60, '#e9edf1'); bar(W - 96, 96, 88, 30, '#1f7a54'); bar(W - 96, 132, 88, 30, '#c0392b'); }
  } else if (kind === 'chart') {
    bar(0, 0, W, H, '#10151c');
    bar(0, 0, W, 14, '#1b2430');
    g.strokeStyle = '#3fb950';
    g.lineWidth = 2.5;
    g.beginPath();
    let y = H * 0.6;
    for (let x = 10; x < W * 0.62; x += 8) { y = Math.max(30, Math.min(H - 20, y + (r() - 0.55) * 22)); x === 10 ? g.moveTo(x, y) : g.lineTo(x, y); }
    g.stroke();
    for (let i = 0; i < 7; i++) bar(W * 0.68 + i * 14, H - 20 - r() * 90, 9, 200, ['#58a6ff', '#f0883e', '#3fb950'][i % 3]);
    bar(W * 0.66, H - 20, 110, 30, '#10151c');
  } else if (kind === 'menu') {
    bar(0, 0, W, H, '#1a1410');
    for (let cI = 0; cI < 3; cI++) {
      bar(12 + cI * 104, 10, 70, 9, '#e8b339');
      for (let i = 0; i < 9; i++) { bar(12 + cI * 104, 30 + i * 15, 50 + r() * 22, 4, '#f1ece2'); bar(82 + cI * 104, 30 + i * 15, 16, 4, '#e8b339'); }
    }
  } else if (kind === 'cctv') {
    bar(0, 0, W, H, '#0a0c0f');
    for (let i = 0; i < 4; i++) {
      const x = (i % 2) * (W / 2) + 2;
      const y = Math.floor(i / 2) * (H / 2) + 2;
      const gr = g.createLinearGradient(x, y, x, y + H / 2);
      gr.addColorStop(0, '#3d4650');
      gr.addColorStop(1, '#1b2026');
      g.fillStyle = gr;
      g.fillRect(x, y, W / 2 - 4, H / 2 - 4);
      bar(x + 10 + r() * 60, y + 40 + r() * 20, 50, 30, 'rgba(120,130,140,.5)');
      bar(x + 4, y + 4, 26, 5, '#c0392b');
    }
  } else if (kind === 'vitals') {
    bar(0, 0, W, H, '#05080b');
    const cols = ['#3fb950', '#58a6ff', '#f0e05a', '#ff7b72'];
    for (let k = 0; k < 4; k++) {
      g.strokeStyle = cols[k];
      g.lineWidth = 2;
      g.beginPath();
      const y0 = 26 + k * 40;
      for (let x = 6; x < W * 0.7; x += 3) {
        const ph = (x % 46) / 46;
        const yy = y0 - (k === 0 ? (ph > 0.42 && ph < 0.5 ? 22 : ph > 0.5 && ph < 0.56 ? -8 : 0) : Math.sin(x * (0.08 + k * 0.03)) * 8);
        x === 6 ? g.moveTo(x, yy) : g.lineTo(x, yy);
      }
      g.stroke();
      g.fillStyle = cols[k];
      g.font = '700 26px Helvetica, Arial, sans-serif';
      g.fillText(String([72, 98, 16, 120][k] + Math.floor(r() * 9)), W * 0.76, y0 + 8);
    }
  } else if (kind === 'arrivals') {
    bar(0, 0, W, H, '#0b1420');
    bar(0, 0, W, 18, '#1f4f9c');
    for (let i = 0; i < 9; i++) { bar(10, 26 + i * 16, 40, 6, '#f0e05a'); bar(60, 26 + i * 16, 120 + r() * 50, 6, '#e9eef2'); bar(W - 60, 26 + i * 16, 44, 6, r() < 0.2 ? '#ff7b72' : '#3fb950'); }
  } else {
    // A desktop: wallpaper, a couple of windows, a task bar.
    const wp = g.createLinearGradient(0, 0, W, H);
    wp.addColorStop(0, ['#1f4f9c', '#2e6b5a', '#5b3a7a', '#274060'][seed % 4]);
    wp.addColorStop(1, ['#6aa7e0', '#8fc9a8', '#c59ad0', '#7fa3c9'][seed % 4]);
    g.fillStyle = wp;
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 2; i++) {
      const x = 20 + i * 120 + r() * 20;
      const y = 14 + r() * 26;
      bar(x, y, 150, 104, '#f6f8fa');
      bar(x, y, 150, 12, '#d0d7de');
      for (let k = 0; k < 8; k++) bar(x + 8, y + 20 + k * 10, 60 + r() * 70, 4, '#8c959f');
    }
    bar(0, H - 12, W, 12, 'rgba(15,20,28,.85)');
    for (let i = 0; i < 6; i++) bar(8 + i * 16, H - 10, 10, 8, PRODUCT[i]);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  const m = M.screenFace(t);
  screens.set(key, m);
  return m;
}

/** A flat face showing a material, facing +z at (x, y, z) — screens, pictures, labels. */
export function face(B, mat, w, h, x, y, z, rot = null) {
  const g = new THREE.PlaneGeometry(w, h);
  return B.add(g, mat, { pos: [x, y, z], rot });
}

/** A monitor on its stand, sitting on a desk at height y. */
export function monitor(B, x, y, z, { w = 2.0, kind = 'desktop', seed = 1, turn = 0 } = {}) {
  const h = w * 0.58;
  const black = M.pianoBlack();
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  slab(B, M.painted('#2b2f36', 0.4), 0.75, 0.04, 0.55, x, y, z, [0, turn, 0]);
  slab(B, M.painted('#2b2f36', 0.4), 0.14, 0.5, 0.08, x - s * 0.1, y + 0.03, z - c * 0.1, [0, turn, 0]);
  rbox(B, black, w, h, 0.09, x, y + 0.42, z, 0.02, [0, turn, 0]);
  face(B, screenMat(kind, seed), w - 0.1, h - 0.1, x + s * 0.048, y + 0.42 + h / 2, z + c * 0.048, [0, turn, 0]);
}

/** A keyboard and mouse. */
export function keyboard(B, x, y, z, turn = 0) {
  rbox(B, M.plastic('#2b2f36', 0.5), 1.4, 0.06, 0.45, x, y, z, 0.015, [0, turn, 0]);
  slab(B, M.plastic('#3d434b', 0.7), 1.3, 0.02, 0.36, x, y + 0.055, z, [0, turn, 0]);
  rbox(B, M.plastic('#2b2f36', 0.4), 0.2, 0.09, 0.33, x + Math.cos(turn) * 1.05, y, z - Math.sin(turn) * 1.05, 0.04, [0, turn, 0]);
}

/* ------------------------------------------------------------- pictures */

const arts = new Map();
/** A framed print: abstract shapes, a landscape, a chart or a poster, by seed. */
export function artMat(seed = 1, kind = 'abstract') {
  const key = `${kind}|${seed % 12}`;
  if (arts.has(key)) return arts.get(key);
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  const r = rng(seed * 977 + 13);
  const pal = [['#e9e2d0', '#c2553a', '#2e5b7a', '#e2b31b', '#2b2f36'], ['#f1efe9', '#3f6b52', '#b0782f', '#8a3b3b', '#2f3b4d'], ['#dfe8f2', '#1f4f9c', '#c0392b', '#f4f4f0', '#3d434b'], ['#f3ead8', '#6d4a8a', '#b84a6a', '#e36a1c', '#2e6f8e']][seed % 4];
  g.fillStyle = pal[0];
  g.fillRect(0, 0, 256, 256);
  if (kind === 'landscape') {
    const sky = g.createLinearGradient(0, 0, 0, 256);
    sky.addColorStop(0, pal[2]);
    sky.addColorStop(0.6, pal[0]);
    g.fillStyle = sky;
    g.fillRect(0, 0, 256, 256);
    for (let k = 0; k < 4; k++) {
      g.fillStyle = [pal[4], pal[1], pal[3], pal[4]][k];
      g.globalAlpha = 0.55 + k * 0.12;
      g.beginPath();
      g.moveTo(0, 256);
      for (let x = 0; x <= 256; x += 16) g.lineTo(x, 130 + k * 28 - r() * 46);
      g.lineTo(256, 256);
      g.fill();
    }
    g.globalAlpha = 1;
  } else if (kind === 'poster') {
    g.fillStyle = pal[1 + (seed % 3)];
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = pal[0];
    g.fillRect(24, 30, 208, 14);
    g.fillRect(24, 56, 140, 8);
    g.beginPath();
    g.arc(128, 150, 54, 0, 6.3);
    g.fill();
    g.fillRect(24, 224, 208, 8);
  } else {
    for (let i = 0; i < 9; i++) {
      g.fillStyle = pal[1 + Math.floor(r() * 4)];
      g.globalAlpha = 0.75;
      if (r() < 0.5) g.fillRect(r() * 200, r() * 200, 30 + r() * 120, 20 + r() * 110);
      else { g.beginPath(); g.arc(r() * 256, r() * 256, 16 + r() * 60, 0, 6.3); g.fill(); }
    }
    g.globalAlpha = 1;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = M.printFace(t, { rough: 0.6 });
  arts.set(key, m);
  return m;
}

/** A picture in a frame, hung on a wall behind it (its back at z = 0). */
export function picture(B, w, h, x, y, { seed = 1, kind = 'abstract', frame = '#2b2b2e', mount = true } = {}) {
  const fm = M.laminate(frame, 0.5);
  const t = 0.09;
  slab(B, fm, w, t, 0.1, x, y - h / 2, 0.05);
  slab(B, fm, w, t, 0.1, x, y + h / 2 - t, 0.05);
  slab(B, fm, t, h, 0.1, x - w / 2 + t / 2, y - h / 2, 0.05);
  slab(B, fm, t, h, 0.1, x + w / 2 - t / 2, y - h / 2, 0.05);
  slab(B, M.laminate('#f6f4ee', 0.8), w - t, h - t, 0.03, x, y - h / 2 + t / 2, 0.03);
  const m = mount ? 0.22 : 0.02;
  face(B, artMat(seed, kind), w - t * 2 - m, h - t * 2 - m, x, y, 0.062);
}

/* ---------------------------------------------------------------- text */

const labels = new Map();
/** A printed label or sign face: words on a colour (cached). */
export function labelMat(text, { color = '#ffffff', bg = '#1d2c44', aspect = 3, glow = false, weight = 800 } = {}) {
  const key = `${text}|${color}|${bg}|${aspect}|${glow}`;
  if (labels.has(key)) return labels.get(key);
  const W = 512;
  const H = Math.max(32, Math.round(W / aspect));
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const lines = String(text).split('|');
  let size = (H * 0.72) / lines.length;
  g.font = `${weight} ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  const widest = Math.max(...lines.map((l) => g.measureText(l).width));
  if (widest > W * 0.9) size *= (W * 0.9) / widest;
  g.font = `${weight} ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  lines.forEach((l, i) => g.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * size * 1.12));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  const m = glow ? M.screenFace(t) : M.printFace(t, { rough: 0.5 });
  labels.set(key, m);
  return m;
}

/** A potted plant's foliage: a clump of leaf-textured lumps round a point. */
export function foliage(B, r, x, y, z, radius, height, { n = 7, hex = '#3f6b3a' } = {}) {
  const mat = M.plastic(hex, 0.75);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2 + r() * 0.6;
    const d = radius * (0.25 + r() * 0.5);
    const g = new THREE.IcosahedronGeometry(1, 1);
    B.add(g, i % 2 ? mat : M.plastic(shadeHex(hex, 0.85), 0.75), { pos: [x + Math.cos(a) * d, y + height * (0.35 + r() * 0.55), z + Math.sin(a) * d], scale: [radius * (0.42 + r() * 0.25), height * (0.22 + r() * 0.16), radius * (0.42 + r() * 0.25)], rot: [r(), r() * 3, r()] });
  }
}

/** Long strap or sword leaves rising from a pot (snake plant, dracaena, palm fronds). */
export function fronds(B, r, x, y, z, height, { n = 9, spread = 0.5, width = 0.22, hex = '#3d6b3a', droop = 0.3 } = {}) {
  const mat = M.foliageTone(hex);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2 + r() * 0.7;
    const lean = spread * (0.3 + r() * 0.7);
    const len = height * (0.7 + r() * 0.3);
    const seg = 5;
    const pos = [];
    const idx = [];
    for (let k = 0; k <= seg; k++) {
      const t = k / seg;
      const out = Math.sin(lean) * len * t + droop * t * t * len * 0.4;
      const up = Math.cos(lean) * len * t - droop * t * t * len * 0.35;
      const w = width * (1 - t * 0.9) * (0.4 + Math.sin(Math.min(1, t * 2.2) * PI / 2) * 0.6) * 0.5;
      const px = x + Math.cos(a) * out;
      const pz = z + Math.sin(a) * out;
      pos.push(px - Math.sin(a) * w, y + up, pz + Math.cos(a) * w, px + Math.sin(a) * w, y + up, pz - Math.cos(a) * w);
      if (k < seg) { const b = k * 2; idx.push(b, b + 1, b + 3, b, b + 3, b + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    B.add(g, mat);
  }
}

export function shadeHex(hex, k) {
  const c = new THREE.Color(hex);
  if (k >= 1) c.lerp(new THREE.Color('#ffffff'), k - 1); else c.multiplyScalar(k);
  return `#${c.getHexString()}`;
}

export { rng, cylGeo, THREE, M };
