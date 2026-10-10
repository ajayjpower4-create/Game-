/* Props and guard booths in 3D.
 *
 * Every item in the props menu has a model here, built in its own frame (x
 * across its width, z across its depth, y up, origin at its footprint centre).
 * Long things — fences, walls, hedges, racking — stretch to their length.
 * Lamps report the light they throw so the engine can light the ground with
 * it at night; flags and turbines report the parts that move. */

import * as THREE from 'three';
import { Builder, cylGeo } from './builder.js';
import * as M from './materials.js';
import { rng } from './textures.js';
import { plant, person } from './nature.js';
import { vehicleModel } from './vehicles.js';
import { PROP_BY_ID, BOOTH_BY_ID } from '../catalog.js';

const DEG = Math.PI / 180;

/* ------------------------------------------------------------ text panels */

/** A sign face with wrapped lines of text on a coloured ground. */
function panelTexture({ text = '', sub = '', logo = '', color = '#ffffff', bg = '#1d2c44', aspect = 4, border = true, align = 'center' }) {
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

/** Lit panel material: the face glows softly after dark. */
function panelMat(tex, ctx) {
  const m = M.signFace(tex);
  m.transparent = false;
  m.alphaTest = 0;
  ctx.disposables.push(tex, m);
  return m;
}

/** A quad facing +z (or -z with back=true), centred at (x, y, z). */
function face(B, mat, w, h, x, y, z, back = false) {
  const hw = w / 2;
  const hh = h / 2;
  if (!back) B.quad(mat, [x - hw, y - hh, z], [x + hw, y - hh, z], [x + hw, y + hh, z], [x - hw, y + hh, z], [0, 0, 1, 0, 1, 1, 0, 1]);
  else B.quad(mat, [x + hw, y - hh, z], [x - hw, y - hh, z], [x - hw, y + hh, z], [x + hw, y + hh, z], [0, 0, 1, 0, 1, 1, 0, 1]);
}

/* ---------------------------------------------------------------- lights */

function lightAt(ctx, x, y, z, { tx = x, tz = z, color = '#ffe2b8', power = 900, range = 140, angle = 64, pool = 1 } = {}) {
  ctx.lights.push({ x, y, z, tx, tz, color, power, range, angle, pool });
}

/** A modern LED area light head ("shoebox"), facing down. */
function shoebox(B, x, y, z, rotY = 0) {
  B.box(M.painted('#3a3f45', 0.45), 2.6, 0.45, 1.6, x, y, z, [0, rotY, 0]);
  B.box(M.lamp('#fff3e0', 9), 2.2, 0.06, 1.2, x, y - 0.25, z, [0, rotY, 0]);
}

/* ------------------------------------------------------------- the props */

const steel = () => M.metal('#8d949b', 0.42);
const galv = () => M.metal('#a9b0b6', 0.35);
const dark = () => M.painted('#2e3338', 0.5);
const yellow = () => M.painted('#e7b416', 0.45);

const P = {
  /* ---- boundary ---- */
  fence(B, o, { w }) {
    for (let x = -w / 2; x <= w / 2 + 0.01; x += Math.min(10, w)) B.post(galv(), 0.2, 8.4, x, 0, 0, 8);
    B.tube(galv(), [-w / 2, 7.9, 0], [w / 2, 7.9, 0], 0.12, 6);
    B.tube(galv(), [-w / 2, 0.4, 0], [w / 2, 0.4, 0], 0.08, 6);
    B.quad(M.meshFence(), [-w / 2, 0.3, 0], [w / 2, 0.3, 0], [w / 2, 7.9, 0], [-w / 2, 7.9, 0], [-w / 2, 0.3, w / 2, 0.3, w / 2, 7.9, -w / 2, 7.9]);
    for (let k = 0; k < 3; k++) B.tube(M.metal('#6d747a', 0.4), [-w / 2, 8.3 + k * 0.35, -0.2 + k * 0.2], [w / 2, 8.3 + k * 0.35, -0.2 + k * 0.2], 0.03, 3);
  },
  palisade(B, o, { w }) {
    const mat = M.painted('#2f4a3a', 0.5);
    for (let x = -w / 2; x <= w / 2 + 0.01; x += Math.min(9, w)) B.box(mat, 0.4, 8.4, 0.4, x, 4.2, 0);
    B.box(mat, w, 0.2, 0.3, 0, 1.4, -0.25);
    B.box(mat, w, 0.2, 0.3, 0, 6.6, -0.25);
    for (let x = -w / 2 + 0.3; x < w / 2; x += 0.62) {
      B.box(mat, 0.26, 7.6, 0.08, x, 3.8, 0);
      B.add(new THREE.ConeGeometry(0.2, 0.6, 3), mat, { pos: [x, 7.9, 0] });
    }
  },
  woodfence(B, o, { w }) {
    const wood = M.wood('#8a6a4a');
    for (let x = -w / 2; x <= w / 2 + 0.01; x += Math.min(6, w)) B.box(M.wood('#6e5238'), 0.35, 6.2, 0.35, x, 3.1, 0);
    B.box(wood, w, 5.6, 0.12, 0, 3.0, 0.1);
    B.box(M.wood('#6e5238'), w, 0.25, 0.3, 0, 5.9, 0.1);
    B.box(M.concrete('#9a978f'), w, 0.5, 0.3, 0, 0.25, 0.1);
  },
  wall(B, o, { w }) {
    const brick = M.wall('brick', '#9c5b47');
    B.box(brick, w, 6.4, 1.1, 0, 3.2, 0);
    for (let x = -w / 2; x <= w / 2 + 0.01; x += Math.min(15, w)) B.box(brick, 1.8, 7, 1.6, x, 3.5, 0);
    B.box(M.concrete('#c9c4b8'), w + 0.2, 0.35, 1.5, 0, 6.6, 0);
    for (let x = -w / 2; x <= w / 2 + 0.01; x += Math.min(15, w)) B.box(M.concrete('#c9c4b8'), 2.1, 0.4, 1.9, x, 7.2, 0);
  },
  guardrail(B, o, { w }) {
    for (let x = -w / 2 + 0.5; x <= w / 2; x += 6.25) B.box(galv(), 0.3, 2.6, 0.5, x, 1.3, -0.1);
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(0.15, 0.3); s.lineTo(0, 0.55); s.lineTo(0.15, 0.85); s.lineTo(0, 1.1); s.lineTo(0.08, 1.1); s.lineTo(0.23, 0.85); s.lineTo(0.08, 0.55); s.lineTo(0.23, 0.3); s.lineTo(0.08, 0); s.closePath();
    B.extrude(galv(), s, w, { pos: [-w / 2, 1.3, 0.2], rot: [0, Math.PI / 2, 0] });
  },
  gate(B, o, { w }, ctx) {
    // Barrier: motor housing at the left end, striped arm across the lane.
    const hx = -w / 2 + 1.5;
    B.slab(M.concrete('#b9b6ae'), 3, 0.4, 3, hx, 0, 0);
    B.slab(M.painted('#d9dde1', 0.4), 1.8, 3.6, 1.6, hx, 0.4, 0);
    B.slab(M.painted('#b7232c', 0.4), 1.9, 0.3, 1.7, hx, 4, 0);
    B.box(M.signal('#2ee86a', 2), 0.4, 0.4, 0.05, hx, 3.5, 0.83);
    const L = w - 2.6;
    const n = Math.max(4, Math.round(L / 3));
    for (let i = 0; i < n; i++) {
      const x0 = hx + 1 + (L * i) / n;
      B.box(M.painted(i % 2 ? '#f4f4f0' : '#d0202a', 0.35), L / n, 0.45, 0.3, x0 + L / n / 2, 3.6, 0.2);
    }
    B.box(M.lamp('#ff3020', 4), 0.3, 0.2, 0.32, hx + 1 + L * 0.3, 3.92, 0.2);
    B.box(M.lamp('#ff3020', 4), 0.3, 0.2, 0.32, hx + 1 + L * 0.7, 3.92, 0.2);
    B.post(galv(), 0.18, 3.4, hx + 1 + L, 0, 0.2, 8);
    B.box(M.painted('#2e3338', 0.5), 0.5, 0.5, 0.5, hx + 1 + L, 3.4, 0.2);
  },
  slidegate(B, o, { w }) {
    const mat = M.painted('#3a4048', 0.45);
    B.box(mat, w, 0.35, 0.35, 0, 0.8, 0);
    B.box(mat, w, 0.35, 0.35, 0, 6.8, 0);
    for (let x = -w / 2 + 0.2; x < w / 2; x += 0.55) B.box(mat, 0.14, 6.2, 0.14, x, 3.8, 0);
    for (const x of [-w / 2 + 1, w / 2 - 1]) B.cyl(dark(), 0.45, 0.45, 0.25, x, 0.45, 0, { rot: [0, 0, Math.PI / 2] });
    B.box(M.painted('#3a4048', 0.45), 0.8, 8, 0.8, w / 2 + 0.6, 4, 0);
    B.box(M.painted('#e7b416', 0.4), 0.1, 0.5, w * 0.98, 0, 3.8, 0.12, [0, Math.PI / 2, 0]);
  },
  turnstile(B, o, { w, d }) {
    B.slab(M.concrete('#9a978f'), w, 0.3, d, 0, 0, 0);
    B.slab(galv(), w, 0.25, d, 0, 7.4, 0);
    B.post(galv(), 0.25, 7.4, 0, 0.3, 0);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2;
      for (let y = 1; y < 7; y += 0.6) B.tube(galv(), [0, y, 0], [Math.cos(a) * 1.8, y, Math.sin(a) * 1.8], 0.05, 4);
    }
    for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) for (let y = 1; y < 7; y += 0.6) B.box(galv(), 0.08, 0.08, d - 0.4, x, y, 0);
    for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]) B.post(galv(), 0.12, 7.4, x * 0.95, 0.3, z * 0.95);
    B.box(M.signal('#2ee86a', 2), 0.5, 0.3, 0.05, w / 2 - 0.6, 5, d / 2 + 0.02);
  },
  bollard(B) {
    B.post(yellow(), 0.45, 3.3, 0, 0, 0, 14);
    B.sphere(yellow(), 0.45, 0, 3.3, 0, { sy: 0.5, seg: 14 });
    B.cyl(M.signal('#f4f4f0', 0.25), 0.47, 0.47, 0.3, 0, 2.7, 0, { seg: 14, open: true });
  },
  barrier(B, o, { w }) {
    const s = new THREE.Shape();
    s.moveTo(-1, 0); s.lineTo(1, 0); s.lineTo(1, 0.3); s.lineTo(0.55, 1.0); s.lineTo(0.3, 3.2); s.lineTo(-0.3, 3.2); s.lineTo(-0.55, 1.0); s.lineTo(-1, 0.3); s.closePath();
    B.extrude(M.concrete('#c5c2ba'), s, w, { pos: [-w / 2, 0, 0], rot: [0, Math.PI / 2, 0] });
    B.box(M.painted('#e7b416', 0.5), w * 0.98, 0.4, 0.05, 0, 2.5, 0.42, [0.14, 0, 0]);
  },
  crowdbarrier(B, o, { w }) {
    const g = galv();
    B.tube(g, [-w / 2, 0.4, 0], [-w / 2, 3.5, 0], 0.1, 6);
    B.tube(g, [w / 2, 0.4, 0], [w / 2, 3.5, 0], 0.1, 6);
    B.tube(g, [-w / 2, 3.5, 0], [w / 2, 3.5, 0], 0.1, 6);
    B.tube(g, [-w / 2, 0.8, 0], [w / 2, 0.8, 0], 0.08, 6);
    for (let x = -w / 2 + 0.5; x < w / 2; x += 0.45) B.tube(g, [x, 0.8, 0], [x, 3.5, 0], 0.04, 4);
    for (const x of [-w / 2, w / 2]) B.box(g, 0.15, 0.1, 1.8, x, 0.05, 0);
  },
  cone(B) {
    B.slab(M.plastic('#1c1d20', 0.8), 1.5, 0.12, 1.5, 0, 0, 0);
    B.add(new THREE.ConeGeometry(0.62, 2.3, 16, 1, true), M.plastic('#f2621f', 0.55), { pos: [0, 1.25, 0] });
    B.cyl(M.signal('#f4f4f0', 0.2), 0.42, 0.5, 0.35, 0, 1.0, 0, { seg: 16, open: true });
  },
  drum(B) {
    for (let i = 0; i < 5; i++) B.cyl(M.plastic(i % 2 ? '#f4f4f0' : '#f2621f', 0.5), 0.85, 0.9, 0.64, 0, 0.32 + i * 0.64, 0, { seg: 16 });
    B.slab(M.plastic('#1c1d20', 0.8), 2, 0.25, 2, 0, 0, 0);
  },
  speedbump(B, o, { w, d }) {
    const s = new THREE.Shape();
    s.moveTo(-d / 2, 0); s.quadraticCurveTo(0, 0.7, d / 2, 0); s.closePath();
    B.extrude(M.plastic('#1f2125', 0.7), s, w, { pos: [-w / 2, 0.15, 0], rot: [0, Math.PI / 2, 0] });
    for (let x = -w / 2 + 1; x < w / 2; x += 2) B.box(M.painted('#e7b416', 0.5), 1, 0.05, d * 0.5, x, 0.5, 0);
  },

  /* ---- signs ---- */
  monument(B, o, { w, d, h }, ctx) {
    const s = o.sign || {};
    B.slab(M.wall('stone', '#bfb8a8'), w, 2.6, d + 1, 0, 0, 0);
    B.slab(M.concrete('#a8a399'), w + 0.4, 0.3, d + 1.4, 0, 2.6, 0);
    B.slab(M.wall('render', '#e8e4dc'), w - 1, h - 3.6, d, 0, 2.9, 0);
    B.slab(M.metal('#4d545c', 0.4), w - 0.6, 0.5, d + 0.3, 0, h - 0.7, 0);
    const tex = panelTexture({ text: s.text || 'WELCOME', sub: s.sub || '', logo: s.logo || '', color: s.color || '#ffffff', bg: s.bg || '#1d2c44', aspect: (w - 2.6) / (h - 6) });
    const mat = panelMat(tex, ctx);
    face(B, mat, w - 2.6, h - 6, 0, 2.9 + (h - 3.6) / 2, d / 2 + 0.02);
    face(B, mat, w - 2.6, h - 6, 0, 2.9 + (h - 3.6) / 2, -d / 2 - 0.02, true);
    for (const x of [-w / 3, w / 3]) {
      B.box(M.painted('#2e3338', 0.5), 1, 0.5, 0.8, x, 0.25, d / 2 + 3);
      lightAt(ctx, x, 0.6, d / 2 + 3, { tx: x, tz: d / 2 + 0.5, power: 120, range: 22, angle: 50, pool: 0.4 });
    }
    plant(B, 'shrub', 9, {});
  },
  pylon(B, o, { w, d, h }, ctx) {
    const s = o.sign || {};
    B.slab(M.wall('composite', '#3d434b'), 2.4, h - 10, 2.4, -w / 2 + 2.5, 0, 0);
    B.slab(M.wall('composite', '#3d434b'), 2.4, h - 10, 2.4, w / 2 - 2.5, 0, 0);
    B.slab(M.wall('composite', '#2b3036'), w, 10.5, d, 0, h - 10.5, 0);
    const tex = panelTexture({ text: s.text || 'OPEN 24 HOURS', sub: s.sub || '', logo: s.logo || '', color: s.color || '#ffffff', bg: s.bg || '#c0392b', aspect: (w - 1) / 9.5 });
    const mat = panelMat(tex, ctx);
    face(B, mat, w - 1, 9.5, 0, h - 5.25, d / 2 + 0.02);
    face(B, mat, w - 1, 9.5, 0, h - 5.25, -d / 2 - 0.02, true);
    for (let i = 0; i < 3; i++) {
      const pt = panelTexture({ text: ['DIESEL', 'UNLEADED', 'EV'][i], color: '#ffffff', bg: '#1b1f24', aspect: 4, border: false });
      const pm = panelMat(pt, ctx);
      face(B, pm, w - 6, (h - 13) / 3.4, 0, 3 + i * ((h - 13) / 3), 1.22);
      face(B, pm, w - 6, (h - 13) / 3.4, 0, 3 + i * ((h - 13) / 3), -1.22, true);
    }
    B.slab(M.wall('composite', '#2b3036'), w - 5, h - 11, 2.4, 0, 0.5, 0);
  },
  billboard(B, o, { w, d, h }, ctx) {
    const s = o.sign || {};
    B.post(steel(), 1.4, h - 14, 0, 0, 0, 14);
    B.box(steel(), w * 0.6, 1, 1, 0, h - 14, 0);
    B.slab(M.painted('#2b3036', 0.5), w, 14, 1.2, 0, h - 14, 0);
    const tex = panelTexture({ text: s.text || 'YOUR AD HERE', sub: s.sub || 'CALL 555-0100', logo: s.logo || '', color: s.color || '#ffffff', bg: s.bg || '#1f4f9c', aspect: (w - 1.2) / 13 });
    face(B, panelMat(tex, ctx), w - 1.2, 13, 0, h - 7, 0.62);
    B.box(steel(), w, 0.2, 3, 0, h - 14.5, 1.8);
    for (let x = -w / 2 + 4; x < w / 2; x += 9) {
      B.tube(steel(), [x, h + 0.5, 0.6], [x, h + 2, 3], 0.1, 4);
      B.box(M.lamp('#fff3d6', 6), 1.6, 0.4, 0.8, x, h + 2, 3);
      lightAt(ctx, x, h + 1.8, 3.4, { tx: x, tz: 0.6, power: 160, range: 30, angle: 50, pool: 0 });
    }
  },
  postsign(B, o, { w }, ctx) {
    const s = o.sign || {};
    for (const x of [-w / 2 + 0.6, w / 2 - 0.6]) B.post(galv(), 0.18, 8, x, 0, 0, 8);
    B.box(M.painted('#e7eaee', 0.4), w, 4, 0.2, 0, 5.8, 0);
    const tex = panelTexture({ text: s.text || 'DELIVERIES', sub: s.sub || '', logo: s.logo || '➜', color: s.color || '#ffffff', bg: s.bg || '#1f4f9c', aspect: (w - 0.4) / 3.6 });
    face(B, panelMat(tex, ctx), w - 0.4, 3.6, 0, 5.8, 0.11);
  },
  dirsign(B, o, { w }, ctx) {
    const s = o.sign || {};
    B.post(galv(), 0.2, 9, 0, 0, 0, 8);
    const lines = (s.text || 'RECEPTION ➜ / GOODS IN ➜ / VISITORS ➜').split('/').map((t) => t.trim()).slice(0, 4);
    lines.forEach((t, i) => {
      const tex = panelTexture({ text: t, color: s.color || '#ffffff', bg: i % 2 ? '#16305c' : '#1f4f9c', aspect: w / 1.3, border: false });
      const m = panelMat(tex, ctx);
      B.box(M.painted('#16305c', 0.5), w, 1.3, 0.15, 0.6, 8 - i * 1.45, 0);
      face(B, m, w, 1.3, 0.6, 8 - i * 1.45, 0.08);
      face(B, m, w, 1.3, 0.6, 8 - i * 1.45, -0.08, true);
    });
  },
  stopsign(B, o, d2, ctx) {
    B.post(galv(), 0.12, 8, 0, 0, 0, 6);
    const tex = panelTexture({ text: 'STOP', color: '#ffffff', bg: '#c8102e', aspect: 1, border: false });
    const m = panelMat(tex, ctx);
    const oct = new THREE.CircleGeometry(1.25, 8).rotateZ(Math.PI / 8);
    B.add(oct, m, { pos: [0, 7, 0.1] });
    B.add(new THREE.CircleGeometry(1.25, 8).rotateZ(Math.PI / 8).rotateY(Math.PI), M.metal('#a9b0b6', 0.4), { pos: [0, 7, 0.08] });
  },
  speedsign(B, o, d2, ctx) {
    B.post(galv(), 0.12, 8, 0, 0, 0, 6);
    const tex = panelTexture({ text: 'SPEED LIMIT 15', color: '#111111', bg: '#f4f4f0', aspect: 0.8 });
    face(B, panelMat(tex, ctx), 2, 2.5, 0, 6.6, 0.1);
    B.box(M.metal('#a9b0b6', 0.4), 2, 2.5, 0.05, 0, 6.6, 0.06);
  },
  parksign(B, o, d2, ctx) {
    B.post(galv(), 0.12, 8, 0, 0, 0, 6);
    const tex = panelTexture({ text: 'P', color: '#ffffff', bg: '#1f5bb8', aspect: 0.85 });
    face(B, panelMat(tex, ctx), 2, 2.3, 0, 6.8, 0.1);
    B.box(M.metal('#a9b0b6', 0.4), 2, 2.3, 0.05, 0, 6.8, 0.06);
  },
  adasign(B, o, d2, ctx) {
    B.post(galv(), 0.12, 7, 0, 0, 0, 6);
    const tex = panelTexture({ text: 'RESERVED PARKING', logo: '♿', color: '#ffffff', bg: '#1f5bb8', aspect: 0.75 });
    face(B, panelMat(tex, ctx), 1.6, 2.1, 0, 5.8, 0.1);
    B.box(M.metal('#a9b0b6', 0.4), 1.6, 2.1, 0.05, 0, 5.8, 0.06);
  },
  trafficlight(B) {
    B.post(M.painted('#2e3338', 0.5), 0.3, 16, 0, 0, 0, 10);
    B.box(M.painted('#2e3338', 0.5), 1.3, 3.8, 1, 0, 12.6, 0.6);
    B.cyl(M.signal('#3a0c0c', 0.2), 0.42, 0.42, 0.1, 0, 13.8, 1.12, { rot: [Math.PI / 2, 0, 0], seg: 14 });
    B.cyl(M.signal('#3a2a08', 0.2), 0.42, 0.42, 0.1, 0, 12.6, 1.12, { rot: [Math.PI / 2, 0, 0], seg: 14 });
    B.cyl(M.signal('#22ff66', 3), 0.42, 0.42, 0.1, 0, 11.4, 1.12, { rot: [Math.PI / 2, 0, 0], seg: 14 });
    for (const y of [13.8, 12.6, 11.4]) B.box(M.painted('#2e3338', 0.5), 1.0, 0.1, 0.5, 0, y + 0.5, 1.3);
  },
  flag(B, o, s, ctx) {
    flagpole(B, 0, 0, 34, ctx, o.color || '#1f4f9c', 0);
  },
  flags3(B, o, s, ctx) {
    ['#1f4f9c', '#c0392b', '#1f7a54'].forEach((c, i) => flagpole(B, (i - 1) * 6.5, 0, 34 - Math.abs(i - 1) * 3, ctx, c, i));
  },

  /* ---- lighting ---- */
  pole(B, o, s, ctx) {
    B.slab(M.concrete('#a8a59d'), 2.2, 2.2, 2.2, 0, 0, 0);
    B.add(cylGeo(0.22, 0.38, 25, 10), M.metal('#7d858c', 0.4), { pos: [0, 2.2 + 12.5, 0] });
    B.box(M.metal('#7d858c', 0.4), 0.35, 0.35, 3, 0, 27, -1.3);
    shoebox(B, 0, 26.7, -3);
    lightAt(ctx, 0, 26.2, -3, { tx: 0, tz: -14 });
  },
  pole2(B, o, s, ctx) {
    B.slab(M.concrete('#a8a59d'), 2.2, 2.2, 2.2, 0, 0, 0);
    B.add(cylGeo(0.24, 0.4, 28, 10), M.metal('#7d858c', 0.4), { pos: [0, 2.2 + 14, 0] });
    B.box(M.metal('#7d858c', 0.4), 0.35, 0.35, 6, 0, 30, 0);
    shoebox(B, 0, 29.7, -3);
    shoebox(B, 0, 29.7, 3);
    lightAt(ctx, 0, 29.2, -3, { tx: 0, tz: -16 });
    lightAt(ctx, 0, 29.2, 3, { tx: 0, tz: 16 });
  },
  floodmast(B, o, s, ctx) {
    B.slab(M.concrete('#a8a59d'), 3.4, 2.4, 3.4, 0, 0, 0);
    B.add(cylGeo(0.4, 0.8, 40, 12), galv(), { pos: [0, 22.4, 0] });
    B.box(galv(), 7, 0.4, 0.4, 0, 41.5, 0);
    B.box(galv(), 0.4, 0.4, 7, 0, 41.5, 0);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const x = Math.cos(a) * 3;
      const z = Math.sin(a) * 3;
      B.box(M.painted('#3a3f45', 0.45), 1.6, 1.2, 1.6, x, 41, z, [0.6, -a, 0]);
      B.box(M.lamp('#f6f8ff', 10), 1.3, 0.06, 1.3, x, 40.4, z, [0.6, -a, 0]);
      lightAt(ctx, x, 40, z, { tx: x * 10, tz: z * 10, color: '#f2f5ff', power: 2600, range: 220, angle: 55 });
    }
  },
  streetlamp(B, o, s, ctx) {
    B.add(cylGeo(0.18, 0.32, 23, 10), M.metal('#7d858c', 0.4), { pos: [0, 11.5, 0] });
    B.tube(M.metal('#7d858c', 0.4), [0, 22.5, 0], [0, 23.4, -2.5], 0.16, 6);
    B.tube(M.metal('#7d858c', 0.4), [0, 23.4, -2.5], [0, 23.6, -5.2], 0.14, 6);
    B.box(M.painted('#5d646b', 0.45), 1.3, 0.5, 2.6, 0, 23.5, -5.6, [-0.05, 0, 0]);
    B.box(M.lamp('#ffd8a0', 9), 1.0, 0.06, 2.0, 0, 23.22, -5.6);
    lightAt(ctx, 0, 23, -5.6, { tx: 0, tz: -10, color: '#ffd9a6', power: 1100, range: 120, angle: 66 });
  },
  heritage(B, o, s, ctx) {
    const black = M.painted('#1d2125', 0.4);
    B.cyl(black, 0.6, 0.8, 1.5, 0, 0.75, 0, { seg: 10 });
    B.add(cylGeo(0.18, 0.26, 10, 10), black, { pos: [0, 6.5, 0] });
    B.cyl(black, 0.5, 0.25, 0.5, 0, 11.6, 0, { seg: 8 });
    B.cyl(M.lamp('#ffd28a', 6), 0.55, 0.42, 1.4, 0, 12.5, 0, { seg: 8 });
    B.cone(black, 0.8, 0.8, 0, 13.6, 0, 8);
    lightAt(ctx, 0, 12.4, 0, { color: '#ffd08a', power: 380, range: 50, angle: 80 });
  },
  bollardlight(B, o, s, ctx) {
    B.cyl(M.painted('#3a3f45', 0.45), 0.42, 0.45, 3.2, 0, 1.6, 0, { seg: 14 });
    B.cyl(M.lamp('#fff1d0', 5), 0.4, 0.4, 0.5, 0, 3.45, 0, { seg: 14 });
    B.cyl(M.painted('#3a3f45', 0.45), 0.5, 0.5, 0.25, 0, 3.85, 0, { seg: 14 });
    lightAt(ctx, 0, 3.4, 0, { power: 60, range: 14, angle: 85, pool: 0.5 });
  },
  cctv(B) {
    B.add(cylGeo(0.2, 0.32, 20, 10), M.painted('#e9ecee', 0.4), { pos: [0, 10, 0] });
    for (const a of [0.6, 2.6]) {
      B.box(M.painted('#e9ecee', 0.4), 0.3, 0.3, 1.6, Math.sin(a) * 0.8, 19.4, Math.cos(a) * 0.8, [0, a, 0]);
      B.box(M.painted('#f4f6f8', 0.35), 0.7, 0.6, 1.6, Math.sin(a) * 1.8, 19.1, Math.cos(a) * 1.8, [0.3, a, 0]);
      B.box(M.vehicleGlass(), 0.5, 0.4, 0.1, Math.sin(a) * 2.6, 18.9, Math.cos(a) * 2.6, [0.3, a, 0]);
    }
    B.sphere(M.painted('#e9ecee', 0.35), 0.5, 0, 20.1, 0, { sy: 0.6, seg: 12 });
  },

  /* ---- planting ---- */
  flowerbed(B, o, { w, d }) {
    B.slab(M.wood('#6e5238'), w, 0.9, d, 0, 0, 0);
    B.slab(M.plastic('#3d2b1f', 0.95), w - 0.6, 0.15, d - 0.6, 0, 0.8, 0);
    const r = rng(hashId(o.id));
    const cols = ['#e94e77', '#f4d03f', '#9b59b6', '#ffffff', '#e67e22', '#d6336c'];
    for (let i = 0; i < Math.floor(w * d * 0.9); i++) {
      const x = (r() - 0.5) * (w - 1.2);
      const z = (r() - 0.5) * (d - 1.2);
      B.sphere(M.leaves(i % 3), 0.45, x, 1.1, z, { sy: 0.7, seg: 6 });
      if (r() > 0.35) B.sphere(M.plastic(cols[Math.floor(r() * cols.length)], 0.6), 0.22, x + 0.1, 1.45, z, { seg: 5 });
    }
  },
  planter(B, o, { w, d }) {
    B.slab(M.concrete('#cfccc4'), w, 2.6, d, 0, 0, 0);
    B.slab(M.plastic('#3d2b1f', 0.95), w - 0.6, 0.1, d - 0.6, 0, 2.55, 0);
    const P2 = new Builder();
    plant(P2, 'shrub', hashId(o.id), {});
    for (const [m, geos] of P2.parts) for (const g of geos) B.add(g, m, { pos: [0, 2.3, 0], scale: [0.7, 0.7, 0.7] });
  },
  rock(B, o, { w, d, h }) {
    const g = new THREE.DodecahedronGeometry(1, 1);
    const p = g.attributes.position;
    const r = rng(hashId(o.id));
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.85 + r() * 0.3), p.getY(i) * (0.85 + r() * 0.3), p.getZ(i) * (0.85 + r() * 0.3));
    g.computeVertexNormals();
    B.add(g, M.wall('stone', '#9b968b'), { pos: [0, h * 0.35, 0], scale: [w / 2, h * 0.7, d / 2] });
  },
  pond(B, o, { w, d }) {
    const shape = new THREE.Shape();
    const n = 28;
    const r = rng(hashId(o.id));
    const radii = Array.from({ length: n }, () => 0.86 + r() * 0.14);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = Math.cos(a) * (w / 2) * radii[i];
      const z = Math.sin(a) * (d / 2) * radii[i];
      if (i === 0) shape.moveTo(x, z); else shape.lineTo(x, z);
    }
    shape.closePath();
    const water = new THREE.ShapeGeometry(shape).rotateX(Math.PI / 2);
    // ShapeGeometry faces +z; after the turn it faces down, so flip it back up.
    water.scale(1, -1, 1);
    B.add(water, M.water(), { pos: [0, 0.18, 0] });
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = Math.cos(a) * (w / 2) * radii[i];
      const z = Math.sin(a) * (d / 2) * radii[i];
      B.sphere(M.wall('stone', '#a29d92'), 1.1 + r() * 0.8, x, 0.2, z, { sy: 0.45, seg: 7 });
      if (r() > 0.6) for (let k = 0; k < 6; k++) B.box(M.leaves(1), 0.12, 2 + r() * 2, 0.12, x * 0.92 + (r() - 0.5) * 2, 1.2, z * 0.92 + (r() - 0.5) * 2, [(r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3]);
    }
  },
  fountain(B, o, { w, h }, ctx) {
    const stone = M.wall('stone', '#cfc7b6');
    const R = w / 2;
    const ring = new THREE.LatheGeometry([[R - 1, 0], [R, 0], [R, 1.8], [R - 0.2, 2], [R - 1, 2], [R - 1, 0.4]].map(([x, y]) => new THREE.Vector2(x, y)), 36);
    B.add(ring, stone);
    B.add(new THREE.CircleGeometry(R - 1, 36).rotateX(-Math.PI / 2), M.water(), { pos: [0, 1.5, 0] });
    B.cyl(stone, 0.8, 1.1, 3.5, 0, 3, 0, { seg: 14 });
    B.add(new THREE.LatheGeometry([[0.4, 0], [2.6, 0.4], [2.8, 0.9], [0.5, 0.7]].map(([x, y]) => new THREE.Vector2(x, y)), 24), stone, { pos: [0, 4.6, 0] });
    B.add(new THREE.CircleGeometry(2.5, 24).rotateX(-Math.PI / 2), M.water(), { pos: [0, 5.35, 0] });
    B.add(new THREE.ConeGeometry(0.6, h - 4.5, 12, 1, true), M.clearGlass('#e8f4f8'), { pos: [0, 5.4 + (h - 4.5) / 2, 0] });
    lightAt(ctx, 0, 1.6, 0, { tx: 0, tz: 0, color: '#bfe6ff', power: 120, range: 20, angle: 80, pool: 0 });
  },

  /* ---- yard ---- */
  dumpster(B, o, { w, d, h }) {
    const body = M.painted(o.color || '#2f6b4a', 0.55);
    const s = new THREE.Shape();
    s.moveTo(-d / 2 + 0.6, 0.6); s.lineTo(d / 2, 0.6); s.lineTo(d / 2, h - 0.4); s.lineTo(-d / 2, h - 0.4); s.closePath();
    B.extrude(body, s, w, { pos: [-w / 2, 0, 0], rot: [0, Math.PI / 2, 0] });
    B.box(M.plastic('#1d2125', 0.6), w + 0.1, 0.25, d + 0.3, 0, h - 0.2, 0.1, [-0.06, 0, 0]);
    for (const [x, z] of [[-w / 2 + 0.8, -d / 2 + 1.2], [w / 2 - 0.8, -d / 2 + 1.2], [-w / 2 + 0.8, d / 2 - 0.8], [w / 2 - 0.8, d / 2 - 0.8]]) B.cyl(M.tyre(), 0.3, 0.3, 0.3, x, 0.3, z, { rot: [0, 0, Math.PI / 2] });
    for (const sx of [-1, 1]) B.box(steel(), 0.25, 0.6, d * 0.9, sx * (w / 2 + 0.1), h * 0.6, 0);
  },
  skip(B, o, { w, d, h }) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + 1.6, 0); s.lineTo(w / 2 - 1.6, 0); s.lineTo(w / 2, h); s.lineTo(-w / 2, h); s.closePath();
    B.extrude(M.painted(o.color || '#e2a51b', 0.55), s, d - 0.4, { pos: [0, 0, -(d - 0.4) / 2] });
    B.slab(M.plastic('#4a3b2c', 0.95), w - 0.6, 0.1, d - 0.8, 0, h - 1.4, 0);
    for (let i = 0; i < 6; i++) B.box(M.wood('#8a6a4a'), 3, 0.4, 0.6, (i - 2.5) * 1.4, h - 1, (i % 3 - 1) * 1.2, [0, i, 0.3]);
  },
  compactor(B, o, { w, d, h }) {
    B.slab(M.painted('#2c5f8a', 0.5), w * 0.7, h, d, -w * 0.15, 0, 0);
    B.slab(M.painted('#3d434b', 0.5), w * 0.3, h * 0.6, d, w * 0.35, 0, 0);
    B.box(M.painted('#e7b416', 0.5), 0.1, 0.5, d * 0.95, -w * 0.5 - 0.05, h * 0.8, 0);
    B.box(M.painted('#1d2125', 0.5), 0.15, 1.5, 1, w * 0.5, 4, d / 2 - 1);
  },
  recycling(B, o, { w }) {
    ['#2f6b9a', '#3a8a3e', '#7a7f85', '#c27d1b'].forEach((c, i) => {
      const x = -w / 2 + 1.5 + i * (w - 3) / 3;
      B.slab(M.plastic(c, 0.6), 2.6, 3.8, 3, x, 0.3, 0);
      B.slab(M.plastic(c, 0.5), 2.7, 0.25, 3.2, x, 4.1, 0.1);
      B.cyl(M.tyre(), 0.3, 0.3, 0.3, x - 0.9, 0.3, -1.2, { rot: [0, 0, Math.PI / 2] });
      B.cyl(M.tyre(), 0.3, 0.3, 0.3, x + 0.9, 0.3, -1.2, { rot: [0, 0, Math.PI / 2] });
    });
  },
  container(B, o, { w, d, h }) {
    container(B, o.color || '#b5482f', w, d, h, 0);
  },
  containers(B, o, { w, d, h }) {
    const r = rng(hashId(o.id));
    const cols = ['#b5482f', '#1f5b8a', '#2f7a4a', '#d9a21b', '#7d858c', '#5b2a43'];
    container(B, cols[Math.floor(r() * 6)], w, d, h / 2, 0);
    container(B, cols[Math.floor(r() * 6)], w, d, h / 2, h / 2);
  },
  generator(B, o, { w, d, h }) {
    B.slab(M.concrete('#a8a59d'), w + 1, 0.5, d + 1, 0, 0, 0);
    B.slab(M.painted('#e6e8ea', 0.45), w, h - 0.5, d, 0, 0.5, 0);
    for (const sz of [-1, 1]) B.box(M.louvre(), w * 0.35, h * 0.5, 0.06, w * 0.25, h * 0.5, sz * (d / 2 + 0.03));
    B.post(M.metal('#4a4f55', 0.4), 0.3, 2, -w * 0.3, h, 0);
    B.box(M.painted('#1d2125', 0.5), 1, 1.2, 0.1, -w * 0.4, h * 0.6, d / 2 + 0.05);
  },
  transformer(B, o, { w, d, h }) {
    B.slab(M.concrete('#a8a59d'), w + 1, 0.6, d + 1, 0, 0, 0);
    B.slab(M.painted('#3f6b4e', 0.5), w * 0.7, h * 0.7, d * 0.7, 0, 0.6, 0);
    for (let i = -3; i <= 3; i++) for (const sz of [-1, 1]) B.box(M.painted('#3f6b4e', 0.5), 0.1, h * 0.55, 1, i * 0.6, 0.6 + h * 0.32, sz * (d * 0.35 + 0.5));
    for (let i = -1; i <= 1; i++) {
      B.cyl(M.plastic('#8a5a3c', 0.4), 0.25, 0.3, 1.6, i * 1.4, h * 0.7 + 1.4, 0, { seg: 8 });
      for (let k = 0; k < 4; k++) B.cyl(M.plastic('#8a5a3c', 0.4), 0.45, 0.45, 0.12, i * 1.4, h * 0.7 + 0.8 + k * 0.35, 0, { seg: 8 });
    }
    B.box(M.painted('#e7b416', 0.5), 1.2, 1.2, 0.05, 0, h * 0.45, d * 0.35 + 0.03);
  },
  lpg(B, o, { w, d, h }) {
    B.slab(M.concrete('#a8a59d'), w, 0.4, d, 0, 0, 0);
    B.cyl(M.painted('#f1f2f0', 0.35), d * 0.45, d * 0.45, w - d * 0.9, 0, h * 0.5, 0, { rot: [0, 0, Math.PI / 2], seg: 22 });
    for (const sx of [-1, 1]) B.sphere(M.painted('#f1f2f0', 0.35), d * 0.45, sx * (w / 2 - d * 0.45), h * 0.5, 0, { sx: 0.4, seg: 16 });
    for (const sx of [-1, 1]) B.slab(M.concrete('#bdb9b1'), 1, h * 0.35, d * 0.7, sx * w * 0.25, 0.4, 0);
    B.cyl(M.metal('#8a9198', 0.4), 0.6, 0.6, 0.8, 0, h * 0.5 + d * 0.45, 0, { seg: 10 });
  },
  oiltank(B, o, { w, h }) {
    B.slab(M.concrete('#a8a59d'), w + 2, 1.6, w + 2, 0, 0, 0);
    B.cyl(M.painted('#4d6b4f', 0.45), w * 0.42, w * 0.42, h - 2, 0, 1.6 + (h - 2) / 2, 0, { seg: 22 });
    B.add(new THREE.SphereGeometry(w * 0.42, 22, 6, 0, Math.PI * 2, 0, 0.5), M.painted('#4d6b4f', 0.45), { pos: [0, h - 0.4 - w * 0.42 * Math.cos(0.5), 0] });
    for (let y = 2; y < h; y += 1.2) B.box(M.metal('#8a9198', 0.4), 0.06, 0.06, 1.2, w * 0.45, y, 0);
  },
  ibc(B, o, { w, d, h }) {
    for (const x of [-w / 4, w / 4]) {
      B.slab(M.wood('#a07a52'), w / 2 - 0.3, 0.5, d, x, 0, 0);
      B.slab(M.plastic('#e9ecdf', 0.4), w / 2 - 0.6, h - 1, d - 0.4, x, 0.5, 0);
      for (let k = 0; k < 4; k++) B.box(galv(), w / 2 - 0.5, 0.06, d - 0.3, x, 0.8 + k * (h - 1.2) / 3, 0);
    }
  },
  gascage(B, o, { w, d, h }) {
    B.slab(M.concrete('#a8a59d'), w, 0.3, d, 0, 0, 0);
    for (let i = 0; i < 6; i++) {
      const c = ['#2f6b4a', '#1d2125', '#c0392b', '#2f6b9a'][i % 4];
      B.post(M.painted(c, 0.4), 0.45, 4.6, -w / 2 + 1 + (i % 3) * 1.8, 0.3, (Math.floor(i / 3) - 0.5) * 1.6);
    }
    B.quad(M.meshFence(), [-w / 2, 0.3, d / 2], [w / 2, 0.3, d / 2], [w / 2, h, d / 2], [-w / 2, h, d / 2], [-w / 2, 0, w / 2, 0, w / 2, h, -w / 2, h]);
    B.quad(M.meshFence(), [w / 2, 0.3, -d / 2], [-w / 2, 0.3, -d / 2], [-w / 2, h, -d / 2], [w / 2, h, -d / 2], [-w / 2, 0, w / 2, 0, w / 2, h, -w / 2, h]);
    B.slab(galv(), w, 0.15, d, 0, h, 0);
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.post(galv(), 0.1, h, x * w / 2, 0, z * d / 2);
  },
  silo(B, o, { w, h }) {
    const R = w / 2 - 0.5;
    B.slab(M.concrete('#a8a59d'), w, 1, w, 0, 0, 0);
    B.add(cylGeo(R, R, h - 8, 28), M.metal('#c8ced3', 0.32), { pos: [0, 1 + (h - 8) / 2, 0] });
    for (let y = 4; y < h - 8; y += 3) B.cyl(M.metal('#aeb5bb', 0.35), R + 0.06, R + 0.06, 0.2, 0, y, 0, { seg: 28, open: true });
    B.cone(M.metal('#c8ced3', 0.32), R + 0.3, 7, 0, h - 3.5, 0, 28);
    for (let y = 1; y < h - 6; y += 1) B.box(galv(), 1.2, 0.08, 0.08, 0, y, R + 0.6);
    B.box(galv(), 0.08, h - 6, 0.08, -0.6, 1 + (h - 6) / 2, R + 0.6);
    B.box(galv(), 0.08, h - 6, 0.08, 0.6, 1 + (h - 6) / 2, R + 0.6);
  },
  watertower(B, o, { w, h }) {
    const legs = h * 0.62;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      B.tube(galv(), [Math.cos(a) * w * 0.45, 0, Math.sin(a) * w * 0.45], [Math.cos(a) * w * 0.28, legs, Math.sin(a) * w * 0.28], 0.6, 8);
    }
    for (let y = 10; y < legs; y += 14) {
      const k = 0.45 - (y / legs) * 0.17;
      for (let i = 0; i < 4; i++) {
        const a0 = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const a1 = ((i + 1) / 4) * Math.PI * 2 + Math.PI / 4;
        B.tube(galv(), [Math.cos(a0) * w * k, y, Math.sin(a0) * w * k], [Math.cos(a1) * w * k, y, Math.sin(a1) * w * k], 0.2, 5);
      }
    }
    B.post(galv(), 1.2, legs, 0, 0, 0);
    const tank = new THREE.LatheGeometry([[0.1, 0], [w * 0.3, 1], [w * 0.5, 7], [w * 0.5, h - legs - 6], [w * 0.15, h - legs - 1], [0.4, h - legs]].map(([x, y]) => new THREE.Vector2(x, y)), 30);
    B.add(tank, M.painted('#dfe4e8', 0.35), { pos: [0, legs, 0] });
    B.cyl(galv(), w * 0.53, w * 0.53, 0.3, 0, legs + 7, 0, { seg: 30, open: true });
  },
  pallets(B, o, { w, d, h }) {
    const n = Math.max(3, Math.round(h / 0.55));
    const r = rng(hashId(o.id));
    for (let i = 0; i < n; i++) B.box(M.wood(i % 2 ? '#a07a52' : '#8c6a47'), w - 0.4 + (r() - 0.5) * 0.3, 0.45, d - 0.3, (r() - 0.5) * 0.3, 0.25 + i * 0.52, (r() - 0.5) * 0.3, [0, (r() - 0.5) * 0.06, 0]);
  },
  racking(B, o, { w, d, h }) {
    const blue = M.painted('#2c5f8a', 0.45);
    const orange = M.painted('#e2701b', 0.45);
    const r = rng(hashId(o.id));
    const bay = 9;
    const n = Math.max(1, Math.round(w / bay));
    const bw = w / n;
    for (let i = 0; i <= n; i++) {
      const x = -w / 2 + i * bw;
      for (const z of [-d / 2 + 0.2, d / 2 - 0.2]) B.box(blue, 0.3, h, 0.3, x, h / 2, z);
      for (let y = 1; y < h; y += 2.5) B.box(blue, 0.1, 0.1, d - 0.4, x, y, 0);
    }
    for (const y of [0.4, 5.5, 10.5, 15.4].filter((y) => y < h)) {
      for (const z of [-d / 2 + 0.2, d / 2 - 0.2]) B.box(orange, w, 0.45, 0.25, 0, y, z);
      for (let i = 0; i < n; i++) {
        for (let k = 0; k < 2; k++) {
          if (r() < 0.2) continue;
          const x = -w / 2 + i * bw + bw * (k + 0.5) / 2;
          B.box(M.wood('#a07a52'), bw / 2 - 0.6, 0.45, d - 0.6, x, y + 0.45, 0);
          const hh = 2 + r() * 2.2;
          B.box(M.plastic(['#c7a77a', '#d4b98e', '#e9ecdf', '#b88d5b'][Math.floor(r() * 4)], 0.9), bw / 2 - 0.9, hh, d - 0.9, x, y + 0.7 + hh / 2, 0);
        }
      }
    }
  },
  canopy(B, o, { w, d, h }, ctx) {
    for (const x of [-w / 2 + 1, 0, w / 2 - 1]) for (const z of [-d / 2 + 1, d / 2 - 1]) B.box(M.painted('#5d646b', 0.45), 0.8, h - 1, 0.8, x, (h - 1) / 2, z);
    B.box(M.painted('#5d646b', 0.45), w, 1.4, 0.6, 0, h - 1.4, -d / 2 + 1);
    B.box(M.painted('#5d646b', 0.45), w, 1.4, 0.6, 0, h - 1.4, d / 2 - 1);
    B.box(M.roof('seam', '#a3aab1'), w + 2, 0.3, d + 2, 0, h - 0.4, 0, [0.05, 0, 0]);
    for (const x of [-w / 4, w / 4]) {
      B.box(M.lamp('#f3f6ff', 6), 3, 0.1, 0.8, x, h - 1.6, 0);
      lightAt(ctx, x, h - 1.8, 0, { color: '#f0f4ff', power: 500, range: 50, angle: 80 });
    }
  },
  carport(B, o, { w, d, h }, ctx) {
    for (let x = -w / 2 + 2; x <= w / 2 - 2; x += (w - 4) / 2) {
      B.box(M.painted('#cfd4d9', 0.4), 0.9, h - 1, 0.9, x, (h - 1) / 2, 0);
      B.box(M.painted('#cfd4d9', 0.4), 0.6, 0.8, d, x, h - 0.8, 0, [-0.1, 0, 0]);
    }
    B.box(M.solarPanel(), w, 0.25, d, 0, h - 0.2, 0, [-0.1, 0, 0]);
    for (let x = -w / 2 + 2; x < w / 2; x += 3.4) B.box(M.frame(false), 0.08, 0.3, d, x, h - 0.1, 0, [-0.1, 0, 0]);
    for (const x of [-w / 3, 0, w / 3]) {
      B.box(M.lamp('#f3f6ff', 5), 1.6, 0.06, 0.6, x, h - 1.4, 0);
      lightAt(ctx, x, h - 1.5, 0, { color: '#eef3ff', power: 240, range: 30, angle: 80, pool: 0.6 });
    }
  },
  evcharger(B, o, { w, d, h }) {
    B.slab(M.concrete('#bdb9b1'), w + 0.6, 0.3, d + 0.6, 0, 0, 0);
    B.slab(M.painted('#f1f3f5', 0.35), w, h - 0.3, d, 0, 0.3, 0);
    B.box(M.painted('#1d2125', 0.4), w * 0.8, 1, 0.05, 0, h * 0.7, -d / 2 - 0.03);
    B.box(M.signal('#2ee8a0', 2.4), w * 0.9, 0.2, d + 0.06, 0, h - 0.5, 0);
    B.tube(M.plastic('#1d2125', 0.6), [w / 2, h * 0.5, 0], [w / 2 + 0.6, 1.2, -0.4], 0.08, 6);
  },
  fuelisland(B, o, { w, d }) {
    B.slab(M.concrete('#cfccc4'), w, 0.6, d, 0, 0, 0);
    for (const x of [-w / 4, w / 4]) {
      B.slab(M.painted('#f1f3f5', 0.35), 3, 5.4, 2.2, x, 0.6, 0);
      B.slab(M.painted('#c0392b', 0.4), 3.05, 1, 2.25, x, 5, 0);
      for (const sz of [-1, 1]) {
        B.box(M.vehicleGlass(), 1.4, 0.8, 0.05, x, 3.6, sz * 1.13);
        B.box(M.signal('#9fe6ff', 0.6), 1.2, 0.6, 0.03, x, 3.6, sz * 1.16);
        B.tube(M.plastic('#1d2125', 0.6), [x + 1.2, 4, sz * 1.1], [x + 1.6, 1.5, sz * 1.6], 0.07, 5);
      }
    }
    B.post(yellow(), 0.35, 3, -w / 2 + 0.6, 0.6, 0);
    B.post(yellow(), 0.35, 3, w / 2 - 0.6, 0.6, 0);
  },
  fuelcanopy(B, o, { w, d, h }, ctx) {
    for (const x of [-w / 4, w / 4]) for (const z of [-d / 4, d / 4]) B.slab(M.wall('composite', '#e8eaec'), 1.6, h - 3, 1.6, x, 0, z);
    B.slab(M.painted('#f1f3f5', 0.4), w, 2.8, d, 0, h - 3, 0);
    for (const [len, x, z, ry] of [[w, 0, d / 2, 0], [w, 0, -d / 2, 0], [d, w / 2, 0, Math.PI / 2], [d, -w / 2, 0, Math.PI / 2]]) {
      B.box(M.painted('#c0392b', 0.4), len + 0.2, 1.1, 0.3, x, h - 2.2, z, [0, ry, 0]);
      B.box(M.signal('#ffffff', 0.8), len + 0.2, 0.15, 0.32, x, h - 1.55, z, [0, ry, 0]);
    }
    for (let x = -w / 2 + 8; x < w / 2; x += 14) {
      for (let z = -d / 2 + 8; z < d / 2; z += 12) {
        B.box(M.lamp('#ffffff', 10), 2.4, 0.06, 2.4, x, h - 3.04, z);
      }
    }
    for (const x of [-w / 3, 0, w / 3]) lightAt(ctx, x, h - 3.2, 0, { color: '#f8faff', power: 1500, range: 70, angle: 85 });
  },
  busshelter(B, o, { w, d, h }) {
    const frame = M.metal('#5d646b', 0.4);
    for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) for (const z of [-d / 2 + 0.2, d / 2 - 0.2]) B.box(frame, 0.25, h - 0.3, 0.25, x, (h - 0.3) / 2, z);
    B.box(M.clearGlass(), w - 0.4, h - 1.2, 0.08, 0, (h - 1.2) / 2 + 0.6, -d / 2 + 0.2);
    for (const sx of [-1, 1]) B.box(M.clearGlass(), 0.08, h - 1.2, d - 0.6, sx * (w / 2 - 0.2), (h - 1.2) / 2 + 0.6, 0);
    B.box(M.painted('#3d434b', 0.45), w + 0.6, 0.35, d + 0.6, 0, h - 0.1, 0);
    B.box(M.wood('#8a6a4a'), w * 0.6, 0.2, 1.2, 0, 1.6, -d / 2 + 1);
    B.box(M.signal('#f4f6ff', 0.8), 3.4, 5, 0.1, w / 2 - 2.2, 3.4, -d / 2 + 0.3);
  },
  smokeshelter(B, o, { w, d, h }) {
    const frame = M.painted('#3d434b', 0.45);
    for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) for (const z of [-d / 2 + 0.2, d / 2 - 0.2]) B.box(frame, 0.25, h, 0.25, x, h / 2, z);
    B.box(M.roof('seam', '#9aa1a8'), w + 1, 0.2, d + 1, 0, h, 0, [0.08, 0, 0]);
    B.box(M.clearGlass(), w - 0.4, h - 1.6, 0.06, 0, (h - 1.6) / 2 + 0.8, -d / 2 + 0.2);
    B.box(M.wood('#8a6a4a'), w * 0.8, 0.2, 1, 0, 1.6, -d / 2 + 0.8);
    B.cyl(galv(), 0.4, 0.4, 3, w / 2 - 1, 1.5, d / 2 - 1, { seg: 10 });
  },
  bikerack(B, o, { w }) {
    for (let x = -w / 2 + 1; x <= w / 2 - 1; x += 2) {
      const pts = [];
      for (let i = 0; i <= 8; i++) {
        const a = (i / 8) * Math.PI;
        pts.push([x, Math.sin(a) * 1.4 + 1.4 * (i === 0 || i === 8 ? 0 : 1) * 0, Math.cos(a) * 1.1]);
      }
      B.tube(galv(), [x, 0, -1.1], [x, 2.2, -1.1], 0.1, 6);
      B.tube(galv(), [x, 0, 1.1], [x, 2.2, 1.1], 0.1, 6);
      B.tube(galv(), [x, 2.2, -1.1], [x, 2.6, 0], 0.1, 6);
      B.tube(galv(), [x, 2.6, 0], [x, 2.2, 1.1], 0.1, 6);
    }
  },
  bench(B, o, { w, d }) {
    for (const x of [-w / 2 + 0.6, w / 2 - 0.6]) {
      B.box(M.painted('#2e3338', 0.5), 0.25, 1.6, d - 0.2, x, 0.8, 0);
      B.box(M.painted('#2e3338', 0.5), 0.25, 1.4, 0.25, x, 2.2, d / 2 - 0.2);
    }
    for (let k = 0; k < 3; k++) B.box(M.wood('#9a6b47'), w, 0.15, 0.45, 0, 1.6, -d / 2 + 0.4 + k * 0.55);
    for (let k = 0; k < 2; k++) B.box(M.wood('#9a6b47'), w, 0.4, 0.12, 0, 2.2 + k * 0.5, d / 2 - 0.12, [-0.15, 0, 0]);
  },
  picnic(B, o, { w, d }) {
    B.box(M.wood('#9a6b47'), w, 0.2, 2.6, 0, 2.5, 0);
    for (const sz of [-1, 1]) B.box(M.wood('#9a6b47'), w, 0.18, 1, 0, 1.5, sz * 2.3);
    for (const sx of [-1, 1]) {
      B.box(M.wood('#7d5539'), 0.25, 3, 0.3, sx * (w / 2 - 1), 1.3, 0, [0.6, 0, 0]);
      B.box(M.wood('#7d5539'), 0.25, 3, 0.3, sx * (w / 2 - 1), 1.3, 0, [-0.6, 0, 0]);
    }
  },
  trashcan(B) {
    B.cyl(M.painted('#2f4a3a', 0.5), 0.9, 0.85, 3, 0, 1.5, 0, { seg: 14 });
    B.cyl(M.painted('#2a2f34', 0.5), 0.95, 0.95, 0.3, 0, 3.2, 0, { seg: 14 });
  },
  hydrant(B) {
    const red = M.painted('#c8231b', 0.4);
    B.cyl(red, 0.45, 0.5, 2, 0, 1, 0, { seg: 12 });
    B.sphere(red, 0.45, 0, 2.05, 0, { sy: 0.7, seg: 12 });
    for (const a of [0, Math.PI]) B.cyl(red, 0.2, 0.2, 0.5, Math.cos(a) * 0.55, 1.5, Math.sin(a) * 0.55, { rot: [0, 0, Math.PI / 2], seg: 8 });
    B.cyl(red, 0.25, 0.25, 0.5, 0, 1.5, -0.55, { rot: [Math.PI / 2, 0, 0], seg: 8 });
    B.cyl(red, 0.62, 0.62, 0.15, 0, 0.1, 0, { seg: 12 });
  },
  mailbox(B) {
    const red = M.painted('#c8231b', 0.35);
    B.cyl(red, 0.85, 0.85, 4.2, 0, 2.1, 0, { seg: 16 });
    B.sphere(red, 0.85, 0, 4.2, 0, { sy: 0.4, seg: 16 });
    B.box(M.painted('#1d2125', 0.5), 1, 0.15, 0.1, 0, 3.4, 0.82);
    B.cyl(M.painted('#1d2125', 0.5), 0.95, 0.95, 0.3, 0, 0.15, 0, { seg: 16 });
  },
  vending(B, o, { w, d, h }) {
    B.slab(M.painted('#c0392b', 0.4), w, h, d, 0, 0, 0);
    B.box(M.signal('#f4fbff', 1.1), w * 0.6, h * 0.65, 0.05, -w * 0.12, h * 0.55, d / 2 + 0.03);
    B.box(M.vehicleGlass(), w * 0.62, h * 0.67, 0.04, -w * 0.12, h * 0.55, d / 2 + 0.07);
    B.box(M.painted('#1d2125', 0.4), w * 0.22, h * 0.4, 0.06, w * 0.33, h * 0.6, d / 2 + 0.03);
  },
  portaloo(B, o, { w, d, h }) {
    B.slab(M.plastic('#2c6fb4', 0.55), w, h - 0.6, d, 0, 0, 0);
    B.slab(M.plastic('#e9ecee', 0.5), w + 0.2, 0.6, d + 0.2, 0, h - 0.6, 0);
    B.box(M.plastic('#245d97', 0.55), w - 1, h - 1.8, 0.08, 0, (h - 1.6) / 2, d / 2 + 0.04);
    B.box(M.painted('#2ee86a', 0.5), 0.5, 0.2, 0.05, w * 0.25, 4.2, d / 2 + 0.09);
  },
  cabin(B, o, { w, d, h }) {
    B.slab(M.concrete('#a8a59d'), w, 0.6, d, 0, 0, 0);
    B.slab(M.wall('rib', '#c9d2d9'), w, h - 0.6, d, 0, 0.6, 0);
    for (let x = -w / 2 + 4; x < w / 2 - 2; x += 7) {
      B.box(M.glassLit(0), 3.6, 2.6, 0.08, x, 5, d / 2 + 0.04);
      B.box(M.frame(false), 3.9, 0.2, 0.2, x, 3.6, d / 2 + 0.1);
    }
    B.box(M.painted('#3d434b', 0.5), 3, 6.4, 0.08, w / 2 - 3, 3.8, d / 2 + 0.04);
    B.slab(M.metal('#8d949b', 0.4), 4, 0.4, 2.4, w / 2 - 3, 0, d / 2 + 1.2);
  },
  scaffold(B, o, { w, d, h }) {
    const g = galv();
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.post(g, 0.12, h, x * (w / 2 - 0.2), 0, z * (d / 2 - 0.2), 6);
    for (let y = 0.5; y < h; y += 6.5) {
      B.box(M.wood('#a9875f'), w, 0.2, d, 0, y + 0.1, 0);
      for (const z of [-d / 2 + 0.2, d / 2 - 0.2]) {
        B.box(g, w, 0.12, 0.12, 0, y + 3.5, z);
        B.tube(g, [-w / 2 + 0.2, y, z], [w / 2 - 0.2, y + 6.5, z], 0.06, 4);
      }
    }
    B.box(M.painted('#e2701b', 0.5), w, 1, 0.05, 0, 3.5, d / 2);
  },
  turbine(B, o, { h }, ctx) {
    const hub = h * 0.8;
    B.slab(M.concrete('#a8a59d'), 12, 1, 12, 0, 0, 0);
    B.add(cylGeo(2.4, 5.5, hub, 24), M.painted('#eef0f2', 0.35), { pos: [0, hub / 2 + 1, 0] });
    B.box(M.painted('#eef0f2', 0.35), 5, 5, 14, 0, hub + 2.5, 2);
    B.box(M.signal('#ff2a1f', 2), 0.8, 0.5, 0.8, 0, hub + 5.3, 5);
    const rotor = new Builder();
    rotor.sphere(M.painted('#eef0f2', 0.35), 2.4, 0, 0, 0, { sz: 1.4, seg: 14 });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const blade = new THREE.Shape();
      blade.moveTo(-1, 0); blade.lineTo(1.4, 0); blade.lineTo(0.5, h * 0.24); blade.lineTo(-0.3, h * 0.25); blade.closePath();
      const geo = new THREE.ExtrudeGeometry(blade, { depth: 0.6, bevelEnabled: false });
      rotor.add(geo, M.painted('#f4f6f8', 0.3), { pos: [0, 0, -0.3], rot: [0, 0, a] });
    }
    const g = rotor.finish(new THREE.Group());
    g.position.set(0, hub + 2.5, -6.5);
    g.userData.spin = { axis: 'z', speed: 1.1 };
    ctx.moving.push(g);
  },
  phonemast(B, o, { w, h }) {
    const g = galv();
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.tube(g, [x * w * 0.35, 0, z * w * 0.35], [x * 1.4, h, z * 1.4], 0.25, 6);
    for (let y = 6; y < h; y += 7) {
      const k = w * 0.35 - (y / h) * (w * 0.35 - 1.4);
      for (const [a, b2] of [[[-k, -k], [k, -k]], [[k, -k], [k, k]], [[k, k], [-k, k]], [[-k, k], [-k, -k]]]) {
        B.tube(g, [a[0], y, a[1]], [b2[0], y + 7, b2[1]], 0.08, 4);
        B.tube(g, [a[0], y, a[1]], [b2[0], y, b2[1]], 0.1, 4);
      }
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      B.box(M.painted('#e9ecee', 0.4), 1.1, 5, 0.5, Math.cos(a) * 2.4, h - 4, Math.sin(a) * 2.4, [0, -a, 0]);
    }
    B.add(new THREE.CylinderGeometry(1.4, 1.4, 0.4, 16), M.painted('#e9ecee', 0.4), { pos: [1.6, h - 12, 0], rot: [0, 0, Math.PI / 2] });
    B.sphere(M.signal('#ff2a1f', 3), 0.4, 0, h + 0.5, 0, { seg: 8 });
    B.slab(M.wall('rib', '#b9c2c9'), 8, 8, 6, w * 0.3, 0, -w * 0.25);
  },
  powerpole(B, o, { h }) {
    const wood = M.wood('#5b4634');
    B.add(cylGeo(0.4, 0.55, h, 10), wood, { pos: [0, h / 2, 0] });
    B.box(wood, 0.4, 0.5, 8, 0, h - 2, 0);
    for (const z of [-3.4, 0, 3.4]) {
      B.cyl(M.plastic('#cfd8de', 0.3), 0.25, 0.3, 1, 0, h - 1.3, z, { seg: 8 });
      B.tube(M.metal('#4d5258', 0.4), [0, h - 0.8, z], [-60, h - 2.5, z], 0.04, 3);
      B.tube(M.metal('#4d5258', 0.4), [0, h - 0.8, z], [60, h - 2.5, z], 0.04, 3);
    }
    B.cyl(M.painted('#8d949b', 0.4), 1, 1, 2.6, 0.9, h - 7, 0, { seg: 12 });
  },
  crane(B, o, { w, h }, ctx) {
    const yel = M.painted('#e2b31b', 0.45);
    const m = w * 0.32;
    B.slab(M.concrete('#a8a59d'), w, 2, w, 0, 0, 0);
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.box(yel, 0.5, h - 2, 0.5, x * m, (h - 2) / 2 + 2, z * m);
    for (let y = 2; y < h - 6; y += 6) {
      for (const [a, b2] of [[[-m, -m], [m, -m]], [[m, -m], [m, m]], [[m, m], [-m, m]], [[-m, m], [-m, -m]]]) B.tube(yel, [a[0], y, a[1]], [b2[0], y + 6, b2[1]], 0.12, 4);
    }
    const top = h - 2;
    const jib = 120;
    const cj = 40;
    B.box(yel, 6, 4, 6, 0, top + 2, 0);
    B.box(M.glassLit(1), 4, 3, 0.1, 0, top + 1.5, -3.05);
    for (const [x0, x1] of [[0, jib], [0, -cj]]) {
      B.box(yel, Math.abs(x1 - x0), 0.4, 0.4, (x0 + x1) / 2, top + 4.2, -1.6);
      B.box(yel, Math.abs(x1 - x0), 0.4, 0.4, (x0 + x1) / 2, top + 4.2, 1.6);
      B.box(yel, Math.abs(x1 - x0), 0.4, 0.4, (x0 + x1) / 2, top + 7.4, 0);
      for (let x = Math.min(x0, x1); x < Math.max(x0, x1); x += 6) {
        B.tube(yel, [x, top + 4.2, -1.6], [x + 3, top + 7.4, 0], 0.1, 4);
        B.tube(yel, [x + 3, top + 7.4, 0], [x + 6, top + 4.2, 1.6], 0.1, 4);
      }
    }
    B.box(yel, 2, 18, 2, 0, top + 13, 0);
    B.tube(galv(), [0, top + 22, 0], [jib * 0.8, top + 7.6, 0], 0.08, 3);
    B.tube(galv(), [0, top + 22, 0], [-cj, top + 7.6, 0], 0.08, 3);
    B.box(M.concrete('#9a978f'), 8, 6, 5, -cj + 6, top + 2, 0);
    B.box(yel, 3, 1.5, 3, jib * 0.6, top + 3.4, 0);
    B.tube(galv(), [jib * 0.6, top + 3, 0], [jib * 0.6, top - 50, 0], 0.05, 3);
    B.box(M.painted('#d0202a', 0.4), 1.6, 2, 1.6, jib * 0.6, top - 51, 0);
    B.sphere(M.signal('#ff2a1f', 3), 0.4, jib, top + 7.8, 0, { seg: 8 });
    B.sphere(M.signal('#ff2a1f', 3), 0.4, 0, top + 22.5, 0, { seg: 8 });
  },

  /* ---- roads ---- */
  road(B, o, { w, d }) { roadStrip(B, w, d, { lanes: 2 }); },
  lane(B, o, { w, d }) { roadStrip(B, w, d, { lanes: 1 }); },
  bend(B, o, { w, d }) {
    // A quarter turn about the footprint's -x/-z corner, 26 ft wide.
    const R1 = Math.min(w, d) - 1.5;
    const R0 = R1 - 26;
    const cx = -w / 2;
    const cz = -d / 2;
    ring(B, M.road(), cx, cz, R0, R1, 0, Math.PI / 2, 0.26);
    arcKerb(B, cx, cz, R1 + 0.5, 0, Math.PI / 2);
    arcKerb(B, cx, cz, Math.max(1, R0 - 0.5), 0, Math.PI / 2);
    arcLine(B, M.paint('#e7b416'), cx, cz, (R0 + R1) / 2 - 0.45, 0.32, 0, Math.PI / 2, 0.3);
    arcLine(B, M.paint('#e7b416'), cx, cz, (R0 + R1) / 2 + 0.45, 0.32, 0, Math.PI / 2, 0.3);
    arcLine(B, M.paint('#f2f1ea'), cx, cz, R0 + 1.2, 0.35, 0, Math.PI / 2, 0.3);
    arcLine(B, M.paint('#f2f1ea'), cx, cz, R1 - 1.2, 0.35, 0, Math.PI / 2, 0.3);
  },
  tee(B, o, { w, d }) {
    flatRect(B, M.road(), 0, 0, w, d, 0.26);
    // The through road runs along x; the branch leaves toward -z.
    for (const sz of [1]) B.box(M.kerb(), w, 0.5, 1, 0, 0.25, sz * (d / 2 - 0.5));
    const white = M.paint('#f2f1ea');
    stripeX(B, M.paint('#e7b416'), -w / 2, w / 2, d / 2 - 13 - 0.45, 0.32);
    stripeX(B, M.paint('#e7b416'), -w / 2, w / 2, d / 2 - 13 + 0.45, 0.32);
    for (let x = -11; x < 0; x += 2.4) B.box(white, 1.2, 0.03, 0.6, x, 0.31, -d / 2 + 14);
    for (let z = -d / 2 + 2; z < -d / 2 + 13; z += 6) B.box(white, 0.35, 0.03, 3, 0, 0.31, z);
  },
  cross(B, o, { w, d }) {
    flatRect(B, M.road(), 0, 0, w, d, 0.26);
    const white = M.paint('#f2f1ea');
    for (const [x, z, ry] of [[0, d / 2 - 2, 0], [0, -d / 2 + 2, 0], [w / 2 - 2, 0, Math.PI / 2], [-w / 2 + 2, 0, Math.PI / 2]]) {
      for (let k = -11; k <= 11; k += 2.4) B.box(white, 1.3, 0.03, 3.2, x + (ry ? 0 : k), 0.31, z + (ry ? k : 0), [0, ry, 0]);
    }
    for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]) B.cyl(M.kerb(), 1.2, 1.2, 0.5, x, 0.25, z, { seg: 10 });
  },
  roundabout(B, o, { w }) {
    const R = w / 2;
    ring(B, M.road(), 0, 0, R * 0.42, R - 1, 0, Math.PI * 2, 0.26, 48);
    arcKerb(B, 0, 0, R - 0.5, 0, Math.PI * 2, 48);
    arcKerb(B, 0, 0, R * 0.42 - 0.4, 0, Math.PI * 2, 40);
    B.add(new THREE.CircleGeometry(R * 0.42 - 0.6, 40).rotateX(-Math.PI / 2), M.grass('#ffffff'), { pos: [0, 0.55, 0] });
    arcLine(B, M.paint('#f2f1ea'), 0, 0, (R * 0.42 + R) / 2, 0.3, 0, Math.PI * 2, 0.3, 48, 6, 6);
    plant(B, 'shrub', 31, {});
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      B.post(galv(), 0.1, 7, Math.cos(a) * R * 0.32, 0.5, Math.sin(a) * R * 0.32, 6);
      B.cyl(M.painted('#1f5bb8', 0.4), 1.1, 1.1, 0.08, Math.cos(a) * R * 0.32, 6.6, Math.sin(a) * R * 0.32, { rot: [Math.PI / 2, 0, -a], seg: 16 });
    }
  },
  culdesac(B, o, { w }) {
    const R = w / 2 - 1;
    B.add(new THREE.CircleGeometry(R, 40).rotateX(-Math.PI / 2), M.road(), { pos: [0, 0.26, 0] });
    arcKerb(B, 0, 0, R + 0.5, Math.PI * 0.62, Math.PI * 2.38, 40);
    B.add(new THREE.CircleGeometry(R * 0.28, 24).rotateX(-Math.PI / 2), M.grass('#ffffff'), { pos: [0, 0.5, 0] });
    arcKerb(B, 0, 0, R * 0.28, 0, Math.PI * 2, 24);
    plant(B, 'tree', 47, {});
  },
  zebra(B, o, { w, d }) {
    const white = M.paint('#f2f1ea');
    for (let x = -w / 2 + 1; x < w / 2 - 0.5; x += 2.6) B.box(white, 1.3, 0.03, d - 1, x + 0.65, 0.32, 0);
    for (const sx of [-1, 1]) {
      B.post(M.painted('#1d2125', 0.4), 0.15, 9, sx * (w / 2 + 2), 0, 0, 8);
      B.sphere(M.lamp('#ffb020', 6), 0.6, sx * (w / 2 + 2), 9.4, 0, { seg: 12 });
    }
  },

  /* ---- plant yard ---- */
  plantyard(B, o, { w, d, h }) {
    // Louvred screen on three sides, a pair of gates in the front, a slab floor.
    B.slab(M.concrete('#c9c6bf'), w, 0.35, d, 0, 0, 0);
    const steel = M.painted('#4d545c', 0.5);
    const runs = [[-w / 2, -d / 2, w / 2, -d / 2], [-w / 2, -d / 2, -w / 2, d / 2], [w / 2, -d / 2, w / 2, d / 2], [-w / 2, d / 2, -6, d / 2], [6, d / 2, w / 2, d / 2]];
    for (const [x0, z0, x1, z1] of runs) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const ry = Math.atan2(-(z1 - z0), x1 - x0);
      B.box(M.louvre(), len, h - 0.8, 0.25, (x0 + x1) / 2, 0.35 + (h - 0.8) / 2, (z0 + z1) / 2, [0, ry, 0]);
      B.box(steel, len, 0.3, 0.4, (x0 + x1) / 2, h - 0.3, (z0 + z1) / 2, [0, ry, 0]);
    }
    for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2], [-6, d / 2], [6, d / 2]]) B.box(steel, 0.5, h, 0.5, x, h / 2, z);
    for (const sx of [-1, 1]) B.box(M.meshFence(), 5.8, h - 1, 0.05, sx * 3, (h - 1) / 2 + 0.5, d / 2 + 0.2);
  },
  lowwall(B, o, { w, d, h }) {
    const block = M.wall('render', '#cfcbc2');
    B.box(block, w, h - 0.35, d, 0, (h - 0.35) / 2, 0);
    B.box(M.concrete('#b8b3a8'), w + 0.2, 0.35, d + 0.3, 0, h - 0.17, 0);
    for (let x = -w / 2; x <= w / 2 + 0.01; x += Math.min(12, w)) B.box(block, 1.6, h + 0.2, d + 0.4, x, (h + 0.2) / 2, 0);
  },
  screenwall(B, o, { w, d, h }) {
    const steel = M.painted('#4d545c', 0.5);
    B.box(M.louvre(), w, h - 0.6, d * 0.5, 0, 0.3 + (h - 0.6) / 2, 0);
    for (let x = -w / 2; x <= w / 2 + 0.01; x += Math.min(10, w)) B.box(steel, 0.5, h, 0.6, x, h / 2, 0);
    B.box(steel, w, 0.3, d * 0.8, 0, h - 0.15, 0);
    B.box(M.concrete('#b8b3a8'), w, 0.3, d * 1.3, 0, 0.15, 0);
  },
  plantpad(B, o, { w, d, h }) {
    B.slab(M.concrete('#c9c6bf'), w, h, d, 0, 0, 0);
    B.box(M.painted('#e7b416', 0.5), w + 0.05, 0.12, d + 0.05, 0, h - 0.1, 0);
  },
  pipebridge(B, o, { w, d, h }) {
    // Steel portals carrying pipes and trays between buildings.
    const steel = M.painted('#5d646c', 0.5);
    const n = Math.max(2, Math.round(w / 20) + 1);
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (w * i) / (n - 1);
      for (const sz of [-1, 1]) {
        B.box(steel, 0.6, h, 0.6, x, h / 2, sz * (d / 2 - 0.3));
        B.slab(M.concrete('#a8a59d'), 1.6, 0.4, 1.6, x, 0, sz * (d / 2 - 0.3));
      }
      B.box(steel, 0.6, 0.6, d, x, h - 0.3, 0);
      B.box(steel, 0.5, 0.5, d, x, h - 4, 0);
    }
    for (const sz of [-1, 1]) B.box(steel, w, 0.6, 0.4, 0, h - 0.3, sz * (d / 2 - 0.3));
    const cols = ['#d9dde1', '#c0392b', '#2c5f8a', '#d9dde1'];
    cols.forEach((c, k) => B.tube(M.painted(c, 0.35), [-w / 2, h + 0.4, -d / 2 + 1 + k * ((d - 2) / 3)], [w / 2, h + 0.4, -d / 2 + 1 + k * ((d - 2) / 3)], 0.35, 10));
    B.box(M.metal('#8d949b', 0.45), w, 0.15, d * 0.6, 0, h - 3.6, 0);
  },

  /* ---- gates ---- */
  heavyboom(B, o, { w }, ctx) {
    P.gate(B, o, { w }, ctx);
    // A mesh skirt hangs under the arm to stop people ducking under.
    const L = w - 2.6;
    const x0 = -w / 2 + 2.5;
    for (let x = x0; x < x0 + L; x += 0.6) B.box(M.metal('#c9ced3', 0.35), 0.06, 2.4, 0.06, x, 2.2, 0.2);
    B.box(M.metal('#c9ced3', 0.35), L, 0.1, 0.1, x0 + L / 2, 1, 0.2);
  },
  cantilever(B, o, { w, h }) {
    const mat = M.painted('#2f4a3a', 0.45);
    const leaf = w * 0.72;
    const x0 = -w / 2;
    B.box(mat, leaf, 0.5, 0.45, x0 + leaf / 2, 0.9, 0);
    B.box(mat, leaf, 0.35, 0.35, x0 + leaf / 2, h - 1, 0);
    for (let x = x0 + 0.3; x < x0 + leaf; x += 0.55) B.box(mat, 0.14, h - 1.4, 0.14, x, (h - 1) / 2 + 0.4, 0);
    // Counterweight tail running on rollers behind the posts.
    B.box(mat, w - leaf, 0.6, 0.45, x0 + leaf + (w - leaf) / 2, 0.9, 0);
    B.tube(mat, [x0 + leaf, h - 1, 0], [w / 2, 1.2, 0], 0.16, 6);
    for (const x of [x0 + leaf + 1, w / 2 - 1]) {
      B.box(M.painted('#3a4048', 0.45), 0.8, 3.2, 1.6, x, 1.6, 0.9);
      B.cyl(dark(), 0.35, 0.35, 0.5, x, 1.1, 0.25, { rot: [Math.PI / 2, 0, 0] });
    }
    B.box(M.painted('#e7b416', 0.4), leaf, 0.3, 0.05, x0 + leaf / 2, 3, 0.25);
  },
  swinggate(B, o, { w, h }) {
    const mat = M.painted('#2f3d52', 0.45);
    for (const sx of [-1, 1]) {
      B.box(M.painted('#2f3d52', 0.45), 0.8, h + 1, 0.8, sx * (w / 2 + 0.4), (h + 1) / 2, 0);
      B.sphere(mat, 0.55, sx * (w / 2 + 0.4), h + 1.3, 0, { seg: 10 });
      // Each leaf, slightly ajar.
      const lw = w / 2 - 0.3;
      const ang = sx * 0.12;
      const leaf = new Builder();
      leaf.box(mat, lw, 0.3, 0.3, -sx * lw / 2, 0.8, 0);
      leaf.box(mat, lw, 0.3, 0.3, -sx * lw / 2, h - 0.6, 0);
      for (let x = 0.3; x < lw; x += 0.55) {
        leaf.box(mat, 0.12, h - 0.8, 0.12, -sx * x, (h - 0.4) / 2 + 0.4, 0);
        leaf.add(new THREE.ConeGeometry(0.12, 0.4, 4), mat, { pos: [-sx * x, h + 0.1, 0] });
      }
      leaf.tube(mat, [0, 0.9, 0], [-sx * lw, h - 0.6, 0], 0.1, 5);
      for (const [m, geos] of leaf.parts) for (const g of geos) B.add(g, m, { pos: [sx * (w / 2 - 0.1), 0, 0], rot: [0, ang, 0] });
    }
    B.box(M.painted('#3a3f45', 0.5), 1, 1.4, 0.8, w / 2 + 0.4, 1.4, 1);
  },
  bifold(B, o, { w, h }, ctx) {
    const frame = M.painted('#3a4048', 0.45);
    for (const sx of [-1, 1]) {
      B.box(frame, 1.2, h + 1.5, 1.2, sx * (w / 2 + 0.6), (h + 1.5) / 2, 0);
      B.box(M.lamp('#ffb020', 5), 0.5, 0.3, 0.5, sx * (w / 2 + 0.6), h + 1.7, 0);
      // Two leaves per side folded into a shallow V.
      for (let k = 0; k < 2; k++) {
        const lw = w / 4 - 0.2;
        const ang = sx * (k ? -0.35 : 0.35);
        const x = sx * (w / 2 - lw / 2 - k * lw);
        const z = k ? 0.8 : 0.4;
        B.box(M.meshFence(), lw, h - 1, 0.05, x, h / 2, z, [0, ang, 0]);
        B.box(frame, lw, 0.25, 0.25, x, h - 0.4, z, [0, ang, 0]);
        B.box(frame, lw, 0.25, 0.25, x, 0.6, z, [0, ang, 0]);
      }
    }
    lightAt(ctx, 0, h + 1.5, 2, { tx: 0, tz: 8, power: 300, range: 40, angle: 70 });
  },
  wedge(B, o, { w, d, h }) {
    const s = new THREE.Shape();
    s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(d / 2 - 1.2, h); s.lineTo(-d / 2 + 0.4, h * 0.25); s.closePath();
    B.extrude(M.painted('#2b3036', 0.5), s, w, { pos: [-w / 2, 0, 0], rot: [0, Math.PI / 2, 0] });
    for (let x = -w / 2 + 0.6; x < w / 2; x += 1.6) B.box(M.painted(Math.round(x) % 2 ? '#e7b416' : '#1d2125', 0.45), 0.8, 0.05, 2.8, x + 0.4, h * 0.62, -0.2, [0.5, 0, 0]);
    B.slab(M.painted('#e7b416', 0.45), 1.2, 3.4, 1.2, w / 2 + 1.2, 0, 0);
    B.box(M.signal('#ff2a1a', 2.5), 0.4, 0.4, 0.1, w / 2 + 1.2, 2.8, 0.62);
  },
  risingbollards(B, o, { w, h }, ctx) {
    const n = Math.max(2, Math.round(w / 4));
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + 1 + ((w - 2) * i) / (n - 1);
      B.cyl(M.metal('#9aa1a8', 0.3), 0.75, 0.75, 0.08, x, 0.04, 0, { seg: 16 });
      B.cyl(M.painted('#2b3036', 0.4), 0.55, 0.55, h - 0.3, x, (h - 0.3) / 2, 0, { seg: 16 });
      B.cyl(M.signal('#ff3a1a', 2), 0.56, 0.56, 0.25, x, h - 0.5, 0, { seg: 16, open: true });
      B.cyl(M.painted('#2b3036', 0.4), 0.6, 0.6, 0.15, x, h - 0.1, 0, { seg: 16 });
    }
    B.slab(M.painted('#d9dde1', 0.45), 1.6, 3.6, 1.2, w / 2 + 1.6, 0, 0);
    void ctx;
  },
  tyrekiller(B, o, { w, d }, ctx) {
    B.slab(M.metal('#5d646b', 0.5), w, 0.25, d, 0, 0, 0);
    for (let x = -w / 2 + 0.5; x < w / 2; x += 0.9) {
      for (const z of [-d / 4, d / 4]) B.add(new THREE.ConeGeometry(0.16, 0.6, 4), M.metal('#c9ced3', 0.3), { pos: [x, 0.5, z], rot: [-0.5, 0, 0] });
    }
    B.post(galv(), 0.12, 7, w / 2 + 2, 0, 0, 6);
    const tex = panelTexture({ text: 'SEVERE TYRE DAMAGE', color: '#ffffff', bg: '#c8102e', aspect: 1.4 });
    face(B, panelMat(tex, ctx), 2.8, 2, w / 2 + 2, 6.2, 0.12);
  },
  pedgate(B, o, { w, h }, ctx) {
    const mat = M.painted('#2f3d52', 0.45);
    for (const sx of [-1, 1]) B.box(mat, 0.5, h, 0.5, sx * (w / 2 - 0.25), h / 2, 0);
    B.box(mat, w - 1, 0.25, 0.2, 0, 1, 0);
    B.box(mat, w - 1, 0.25, 0.2, 0, h - 0.6, 0);
    for (let x = -w / 2 + 0.8; x < w / 2 - 0.5; x += 0.5) B.box(mat, 0.1, h - 1.6, 0.1, x, h / 2 + 0.2, 0);
    B.box(M.painted('#3a3f45', 0.45), 0.5, 4.2, 0.5, w / 2 + 1, 2.1, 0.6);
    B.box(M.signal('#2ee86a', 2), 0.35, 0.5, 0.05, w / 2 + 1, 3.8, 0.87);
    lightAt(ctx, 0, h, 1, { power: 120, range: 22, angle: 80, pool: 0.5 });
  },
  archgate(B, o, { w, d, h }, ctx) {
    const s = o.sign || {};
    const clad = M.wall('composite', '#3d434b');
    for (const sx of [-1, 1]) B.slab(clad, 3.4, h, d, sx * (w / 2 - 1.7), 0, 0);
    B.slab(clad, w, 5, d, 0, h - 5, 0);
    const tex = panelTexture({ text: s.text || 'WELCOME', sub: s.sub || '', logo: s.logo || '', color: s.color || '#ffffff', bg: s.bg || '#1f4f9c', aspect: (w - 8) / 4 });
    const mat = panelMat(tex, ctx);
    face(B, mat, w - 8, 4, 0, h - 2.5, d / 2 + 0.02);
    face(B, mat, w - 8, 4, 0, h - 2.5, -d / 2 - 0.02, true);
    for (const sx of [-1, 1]) for (let x = -w / 2 + 6; x < w / 2 - 4; x += 8) {
      B.box(M.lamp('#ffffff', 6), 1.6, 0.06, 1.6, x, h - 5.03, sx * 0.6);
    }
    lightAt(ctx, 0, h - 5.2, 0, { power: 900, range: 50, angle: 80 });
  },
};

/* ------------------------------------------------------------ road kit */

/** An up-facing rectangle centred at (x, z), UVs in world-ish feet. */
function flatRect(B, mat, x, z, w, d, y) {
  B.quad(mat, [x - w / 2, y, z + d / 2], [x + w / 2, y, z + d / 2], [x + w / 2, y, z - d / 2], [x - w / 2, y, z - d / 2], [x - w / 2, z + d / 2, x + w / 2, z + d / 2, x + w / 2, z - d / 2, x - w / 2, z - d / 2]);
}

function stripeX(B, mat, x0, x1, z, width, y = 0.31) {
  B.box(mat, x1 - x0, 0.03, width, (x0 + x1) / 2, y, z);
}

/** A straight road along x: carriageway, kerbs, centre and edge lines. */
function roadStrip(B, w, d, { lanes = 2 } = {}) {
  flatRect(B, M.road(), 0, 0, w, d - 1, 0.26);
  for (const sz of [-1, 1]) B.box(M.kerb(), w, 0.5, 0.8, 0, 0.25, sz * (d / 2 - 0.4));
  const white = M.paint('#f2f1ea');
  for (const sz of [-1, 1]) stripeX(B, white, -w / 2, w / 2, sz * (d / 2 - 1.8), 0.35);
  if (lanes === 2) {
    stripeX(B, M.paint('#e7b416'), -w / 2, w / 2, -0.45, 0.32);
    stripeX(B, M.paint('#e7b416'), -w / 2, w / 2, 0.45, 0.32);
  } else {
    for (let x = -w / 2 + 10; x < w / 2 - 6; x += 30) {
      B.extrude(white, arrowShape(), 0.02, { pos: [x, 0.3, 0], rot: [-Math.PI / 2, 0, -Math.PI / 2] });
    }
  }
}

function arrowShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0.5, 5); s.lineTo(1.5, 5); s.lineTo(0, 7.5); s.lineTo(-1.5, 5); s.lineTo(-0.5, 5); s.closePath();
  return s;
}

/** A flat ring segment (road surface round a bend or roundabout). */
function ring(B, mat, cx, cz, r0, r1, a0, a1, y, seg = 24) {
  const g = new THREE.RingGeometry(Math.max(0.1, r0), r1, seg, 1, a0, a1 - a0).rotateX(-Math.PI / 2);
  const uv = g.attributes.uv;
  const pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), pos.getZ(i));
  // RingGeometry turns the right way for -x/-z after rotateX; mirror z so the
  // arc sweeps from +x round to +z in our frame.
  g.scale(1, 1, -1);
  g.computeVertexNormals();
  fixUp(g);
  B.add(g, mat, { pos: [cx, y, cz] });
}

/** Make sure a flat geometry faces up. */
function fixUp(g) {
  const n = g.attributes.normal;
  if (n.count && n.getY(0) < 0) {
    const idx = g.index.array;
    for (let i = 0; i < idx.length; i += 3) { const t = idx[i]; idx[i] = idx[i + 2]; idx[i + 2] = t; }
    g.index.needsUpdate = true;
    g.computeVertexNormals();
  }
}

function arcKerb(B, cx, cz, r, a0, a1, seg = 18) {
  for (let i = 0; i < seg; i++) {
    const t0 = a0 + ((a1 - a0) * i) / seg;
    const t1 = a0 + ((a1 - a0) * (i + 1)) / seg;
    const p0 = [cx + Math.cos(t0) * r, cz + Math.sin(t0) * r];
    const p1 = [cx + Math.cos(t1) * r, cz + Math.sin(t1) * r];
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    B.box(M.kerb(), len + 0.1, 0.5, 0.8, (p0[0] + p1[0]) / 2, 0.25, (p0[1] + p1[1]) / 2, [0, -Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), 0]);
  }
}

function arcLine(B, mat, cx, cz, r, width, a0, a1, y, seg = 24, dash = 0, gap = 0) {
  for (let i = 0; i < seg; i++) {
    if (dash && i % 2) continue;
    const t0 = a0 + ((a1 - a0) * i) / seg;
    const t1 = a0 + ((a1 - a0) * (i + 1)) / seg;
    const p0 = [cx + Math.cos(t0) * r, cz + Math.sin(t0) * r];
    const p1 = [cx + Math.cos(t1) * r, cz + Math.sin(t1) * r];
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    B.box(mat, len + 0.05, 0.03, width, (p0[0] + p1[0]) / 2, y + 0.02, (p0[1] + p1[1]) / 2, [0, -Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), 0]);
  }
  void gap;
}

function container(B, color, w, d, h, y0) {
  const body = M.wall('rib', color);
  B.box(body, w - 0.4, h - 0.6, d - 0.1, 0, y0 + h / 2, 0);
  const frame = M.painted(color, 0.55);
  for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) for (const z of [-d / 2 + 0.2, d / 2 - 0.2]) B.box(frame, 0.45, h, 0.45, x, y0 + h / 2, z);
  for (const y of [y0 + 0.2, y0 + h - 0.2]) for (const z of [-d / 2 + 0.15, d / 2 - 0.15]) B.box(frame, w, 0.4, 0.3, 0, y, z);
  for (const y of [y0 + 0.2, y0 + h - 0.2]) for (const x of [-w / 2 + 0.15, w / 2 - 0.15]) B.box(frame, 0.3, 0.4, d, x, y, 0);
  // Doors and locking bars at the +x end.
  B.box(M.painted(color, 0.6), 0.1, h - 0.8, d - 0.6, w / 2 - 0.05, y0 + h / 2, 0);
  for (const z of [-d * 0.32, -d * 0.12, d * 0.12, d * 0.32]) B.box(galv(), 0.15, h - 1.2, 0.1, w / 2 + 0.05, y0 + h / 2, z);
}

function flagpole(B, x, z, h, ctx, color, k) {
  B.add(cylGeo(0.12, 0.25, h, 10), M.metal('#d9dee2', 0.25), { pos: [x, h / 2, z] });
  B.sphere(M.metal('#d6b45a', 0.3), 0.35, x, h + 0.2, z, { seg: 10 });
  B.cyl(M.concrete('#bdb9b1'), 0.9, 1.1, 0.6, x, 0.3, z, { seg: 12 });
  const geo = new THREE.PlaneGeometry(7, 4.4, 16, 6).translate(3.5, 0, 0);
  const mat = M.fabric(color);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x + 0.1, h - 2.6, z);
  mesh.castShadow = true;
  mesh.userData.flag = { base: geo.attributes.position.array.slice(), phase: k * 1.7 };
  ctx.moving.push(mesh);
}

/* ----------------------------------------------------------------- booths */

/** A small cabin with a glazed band all round and a lit sign over the lane. */
function cabinBody(B, w, d, h, { wall = M.wall('composite', '#e8ebee'), base = 3.2, head = 7.6, door = 'S', glass = M.glassLit(1) } = {}) {
  const t = 0.4;
  // Solid base and head, glass between, posts at the corners.
  B.slab(wall, w, base, d, 0, 0, 0);
  B.slab(wall, w, h - head, d, 0, head, 0);
  B.box(glass, w - 0.2, head - base, d - 0.2, 0, (base + head) / 2, 0);
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.box(M.frame(true), 0.35, head - base, 0.35, x * (w / 2 - 0.17), (base + head) / 2, z * (d / 2 - 0.17));
  for (let x = -w / 2 + 3; x < w / 2 - 1; x += 3) {
    B.box(M.frame(true), 0.15, head - base, 0.12, x, (base + head) / 2, d / 2 - 0.04);
    B.box(M.frame(true), 0.15, head - base, 0.12, x, (base + head) / 2, -d / 2 + 0.04);
  }
  B.box(M.concrete('#c9c6bf'), w + 0.3, 0.2, d + 0.3, 0, base, 0);
  if (door === 'S') B.box(M.painted('#3d434b', 0.45), 3, 7, 0.1, w / 2 - 2.6, 3.5, -d / 2 - 0.05);
  if (door === 'E') B.box(M.painted('#3d434b', 0.45), 0.1, 7, 3, w / 2 + 0.05, 3.5, -d / 2 + 2.6);
  return t;
}

function boothSign(B, ctx, o, w, y, z, h = 1.6, back = false) {
  const s = o.sign || {};
  const tex = panelTexture({ text: s.text || 'SECURITY', logo: s.logo || '', color: s.color || '#ffffff', bg: s.bg || '#16305c', aspect: w / h, border: false });
  face(B, panelMat(tex, ctx), w, h, 0, y, z, back);
}

function boothRoof(B, ctx, w, d, y, over = 2.2, col = '#3d434b') {
  B.box(M.painted(col, 0.45), w + over * 2, 1.0, d + over * 2, 0, y + 0.5, 0);
  B.box(M.roof('membrane', '#b9bdc2'), w + over * 2 - 0.4, 0.05, d + over * 2 - 0.4, 0, y + 1.02, 0);
  for (const [x, z] of [[-w / 2 - over / 2, d / 2 + over / 2], [w / 2 + over / 2, d / 2 + over / 2], [w / 2 + over / 2, -d / 2 - over / 2], [-w / 2 - over / 2, -d / 2 - over / 2]]) {
    B.box(M.lamp('#fff3dc', 5), 0.7, 0.05, 0.7, x, y - 0.02, z);
  }
  lightAt(ctx, w / 2 + over / 2, y - 0.2, 0, { tx: w / 2 + 6, tz: 0, power: 420, range: 45, angle: 78 });
  lightAt(ctx, 0, y - 0.2, d / 2 + over / 2, { tx: 0, tz: d / 2 + 6, power: 300, range: 40, angle: 78 });
}

const BOOTH = {
  classic(B, o, { w, d, h }, ctx) {
    const bw = w * 0.6;
    const bd = d * 0.62;
    B.slab(M.concrete('#cfccc4'), w, 0.6, d, 0, 0, 0);
    B.box(M.painted('#e7b416', 0.45), w, 0.12, 0.3, 0, 0.62, d / 2 - 0.15);
    B.box(M.painted('#e7b416', 0.45), w, 0.12, 0.3, 0, 0.62, -d / 2 + 0.15);
    cabinBody(B, bw, bd, h - 1, {});
    boothRoof(B, ctx, bw, bd, h - 1, 2.6);
    boothSign(B, ctx, o, bw + 4, h - 0.5, bd / 2 + 2.62);
    boothSign(B, ctx, o, bw + 4, h - 0.5, -bd / 2 - 2.62, 1.6, true);
    B.box(M.painted('#3d434b', 0.45), 1, 1.6, 1.4, -bw / 2 - 1.2, 0.8, 0);
  },
  canopy(B, o, { w, d, h }, ctx) {
    const bw = w * 0.38;
    const bd = d * 0.6;
    B.slab(M.concrete('#cfccc4'), bw + 2, 0.6, bd + 2, -w / 2 + bw / 2 + 1, 0, 0);
    const off = -w / 2 + bw / 2 + 1;
    const sub = new Builder();
    cabinBody(sub, bw, bd, h - 2.5, {});
    for (const [m, geos] of sub.parts) for (const g of geos) B.add(g, m, { pos: [off, 0.6, 0] });
    // Deep canopy over the lane on two columns.
    for (const z of [-d / 2 + 1, d / 2 - 1]) B.box(M.painted('#d9dde1', 0.4), 0.8, h + 1, 0.8, w / 2 - 1, (h + 1) / 2, z);
    B.box(M.painted('#1f4f9c', 0.45), w, 1.6, d, 0, h + 1.8, 0);
    B.box(M.roof('membrane', '#b9bdc2'), w - 0.4, 0.05, d - 0.4, 0, h + 2.62, 0);
    boothSign(B, ctx, o, w * 0.8, h + 1.8, d / 2 + 0.02, 1.4);
    boothSign(B, ctx, o, w * 0.8, h + 1.8, -d / 2 - 0.02, 1.4, true);
    for (const x of [-w / 4, w / 4]) {
      B.box(M.lamp('#ffffff', 8), 3, 0.06, 1.2, x, h + 0.98, 0);
      lightAt(ctx, x, h + 0.8, 0, { color: '#f8faff', power: 900, range: 50, angle: 82 });
    }
  },
  brick(B, o, { w, d, h }, ctx) {
    const brick = M.wall('brick', '#9c5b47');
    B.slab(brick, w, 3.2, d, 0, 0, 0);
    B.box(M.glassLit(0), w - 0.3, 4.2, d - 0.3, 0, 5.3, 0);
    for (let x = -w / 2 + 3; x < w / 2; x += 3.2) for (const sz of [-1, 1]) B.box(M.painted('#f4f4f0', 0.5), 0.25, 4.2, 0.15, x, 5.3, sz * (d / 2 - 0.1));
    B.slab(brick, w, h - 7.4, d, 0, 7.4, 0);
    // Hipped slate roof.
    const roof = new THREE.ConeGeometry(Math.hypot(w, d) / 2 + 1.4, 5, 4, 1).rotateY(Math.PI / 4);
    roof.scale(w / Math.hypot(w, d) * 1.414, 1, d / Math.hypot(w, d) * 1.414);
    B.add(roof, M.roof('tiles', '#4d535b'), { pos: [0, h + 2.4, 0] });
    B.slab(M.painted('#f4f4f0', 0.5), w + 0.6, 0.5, d + 0.6, 0, h - 0.1, 0);
    boothSign(B, ctx, o, w * 0.7, h - 1.6, d / 2 + 0.03, 1.4);
    B.box(M.painted('#2f4a3a', 0.45), 3.2, 7, 0.1, 0, 3.5, -d / 2 - 0.05);
    lightAt(ctx, 0, h - 0.6, d / 2 + 1.5, { power: 300, range: 40 });
    B.box(M.lamp('#ffd28a', 5), 0.6, 1, 0.5, w / 2 - 1.5, h - 2.5, d / 2 + 0.3);
  },
  cube(B, o, { w, d, h }, ctx) {
    B.slab(M.concrete('#cfccc4'), w + 2, 0.5, d + 2, 0, 0, 0);
    B.box(M.glassLit(2), w, h - 1.8, d, 0, (h - 1.8) / 2 + 0.5, 0);
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.box(M.frame(true), 0.3, h - 1.3, 0.3, x * w / 2, (h - 1.3) / 2 + 0.5, z * d / 2);
    for (let x = -w / 2 + 4.5; x < w / 2; x += 4.5) for (const sz of [-1, 1]) B.box(M.frame(true), 0.12, h - 1.8, 0.15, x, (h - 1.8) / 2 + 0.5, sz * d / 2);
    B.slab(M.painted('#2b3036', 0.4), w + 1.4, 1.2, d + 1.4, 0, h - 1.3, 0);
    boothSign(B, ctx, o, w * 0.8, h - 0.7, d / 2 + 0.72, 0.9);
    boothSign(B, ctx, o, w * 0.8, h - 0.7, -d / 2 - 0.72, 0.9, true);
    lightAt(ctx, 0, h - 1.5, d / 2 + 0.7, { tx: 0, tz: d / 2 + 6, power: 350, range: 40 });
  },
  container(B, o, { w, d, h }, ctx) {
    container(B, '#d9dde1', w, d, h, 0);
    B.box(M.glassLit(1), w * 0.55, 3.6, 0.1, -w * 0.12, 5, d / 2 + 0.02);
    B.box(M.glassLit(1), 0.1, 3.6, d * 0.5, -w / 2 - 0.02, 5, 0);
    B.box(M.painted('#3d434b', 0.45), 3, 7, 0.1, w * 0.32, 3.5, d / 2 + 0.05);
    B.box(M.painted('#1f4f9c', 0.45), w + 1, 0.3, d + 2.4, 0, h + 0.2, 0.6);
    boothSign(B, ctx, o, w * 0.7, h - 1.1, d / 2 + 0.06, 1.2);
    lightAt(ctx, 0, h - 0.2, d / 2 + 1.5, { power: 300, range: 40 });
  },
  twin(B, o, { w, d, h }, ctx) {
    B.slab(M.concrete('#cfccc4'), w, 0.6, d * 0.5, 0, 0, 0);
    for (const x of [-w * 0.3, w * 0.3]) {
      const sub = new Builder();
      cabinBody(sub, 8, 7, h - 2.6, {});
      for (const [m, geos] of sub.parts) for (const g of geos) B.add(g, m, { pos: [x, 0.6, 0] });
    }
    for (const x of [-w / 2 + 0.6, w / 2 - 0.6]) for (const z of [-d / 2 + 0.6, d / 2 - 0.6]) B.box(M.painted('#d9dde1', 0.4), 0.7, h, 0.7, x, h / 2, z);
    B.box(M.painted('#3d434b', 0.45), w, 1.4, d, 0, h + 0.7, 0);
    B.box(M.roof('membrane', '#b9bdc2'), w - 0.4, 0.05, d - 0.4, 0, h + 1.42, 0);
    boothSign(B, ctx, o, w * 0.6, h + 0.7, d / 2 + 0.02, 1.2);
    boothSign(B, ctx, o, w * 0.6, h + 0.7, -d / 2 - 0.02, 1.2, true);
    for (const x of [-w / 4, 0, w / 4]) {
      B.box(M.lamp('#ffffff', 8), 2.4, 0.06, 1.2, x, h - 0.02, 0);
      lightAt(ctx, x, h - 0.2, 0, { color: '#f8faff', power: 700, range: 45, angle: 82 });
    }
    B.box(M.signal('#22ff66', 2.5), 0.5, 0.5, 0.1, -w * 0.3 + 4.2, h - 3, d / 2 - 2);
    B.box(M.signal('#ff2a1a', 2.5), 0.5, 0.5, 0.1, w * 0.3 - 4.2, h - 3, -d / 2 + 2);
  },
  hut(B, o, { w, d, h }, ctx) {
    const wood = M.wall('timber', '#7a5a3f');
    B.slab(M.concrete('#cfccc4'), w, 0.5, d, 0, 0, 0);
    B.slab(wood, w - 2, h - 3.4, d - 2, 0, 0.5, 0);
    B.box(M.glassLit(0), w - 5, 3, 0.1, 0, 4.8, d / 2 - 0.95);
    B.box(M.glassLit(0), 0.1, 3, d - 5, w / 2 - 0.95, 4.8, 0);
    const ridge = h;
    const eave = h - 3.4;
    const hw = w / 2;
    const hd = d / 2;
    B.quad(M.roof('tiles', '#5a3e36'), [-hw, eave, hd], [hw, eave, hd], [hw, ridge, 0], [-hw, ridge, 0]);
    B.quad(M.roof('tiles', '#5a3e36'), [hw, eave, -hd], [-hw, eave, -hd], [-hw, ridge, 0], [hw, ridge, 0]);
    for (const sx of [-1, 1]) {
      const x = sx * (hw - 1);
      const tri = new THREE.BufferGeometry();
      const pts = sx > 0 ? [x, eave, hd - 1, x, eave, -hd + 1, x, ridge - 0.5, 0] : [x, eave, -hd + 1, x, eave, hd - 1, x, ridge - 0.5, 0];
      tri.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, d, 0, d / 2, 3], 2));
      tri.setIndex([0, 1, 2]);
      tri.computeVertexNormals();
      B.add(tri, wood);
    }
    boothSign(B, ctx, o, w * 0.6, eave - 0.9, hd - 0.92, 1.1);
    B.box(M.lamp('#ffd28a', 5), 0.5, 0.8, 0.4, -hw + 2, eave - 1.4, hd - 0.8);
    lightAt(ctx, -hw + 2, eave - 1.6, hd, { power: 250, range: 30 });
  },
  tower(B, o, { w, d, h }, ctx) {
    const cab = 8;
    const legs = h - cab;
    for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.box(M.painted('#5d646b', 0.45), 0.6, legs, 0.6, x * (w / 2 - 1.5), legs / 2, z * (d / 2 - 1.5));
    for (let y = 2; y < legs; y += 4) {
      B.tube(galv(), [-w / 2 + 1.5, y, d / 2 - 1.5], [w / 2 - 1.5, y + 3.5, d / 2 - 1.5], 0.08, 4);
      B.tube(galv(), [w / 2 - 1.5, y, -d / 2 + 1.5], [-w / 2 + 1.5, y + 3.5, -d / 2 + 1.5], 0.08, 4);
    }
    // Stair up one side.
    for (let i = 0; i < 14; i++) B.box(M.metal('#8d949b', 0.4), 2.6, 0.15, 0.9, -w / 2 - 1.2, 0.6 + i * (legs / 14), d / 2 - 1 - i * ((d - 2) / 14));
    B.slab(M.metal('#5d646b', 0.45), w, 0.5, d, 0, legs, 0);
    for (const sz of [-1, 1]) B.box(galv(), w, 3.4, 0.1, 0, legs + 2, sz * d / 2);
    const sub = new Builder();
    cabinBody(sub, w - 3, d - 3, cab - 1, { base: 2, head: 5.5 });
    for (const [m, geos] of sub.parts) for (const g of geos) B.add(g, m, { pos: [0, legs + 0.5, 0] });
    boothRoof(B, ctx, w - 3, d - 3, h - 0.5, 1.4);
    boothSign(B, ctx, o, w - 1.5, h, (d - 3) / 2 + 1.42, 0.9);
    B.box(M.lamp('#f3f6ff', 10), 1, 0.7, 0.7, w / 2 - 1.5, h + 0.8, d / 2 - 1.5, [0.5, 0.7, 0]);
    lightAt(ctx, w / 2 - 1.5, h + 0.5, d / 2 - 1.5, { tx: w / 2 + 20, tz: d / 2 + 30, color: '#f3f6ff', power: 1600, range: 160, angle: 40 });
  },
  kiosk(B, o, { w, h }, ctx) {
    const R = w / 2 - 0.6;
    B.cyl(M.concrete('#cfccc4'), R + 0.8, R + 0.8, 0.5, 0, 0.25, 0, { seg: 28 });
    B.add(cylGeo(R, R, 3, 28), M.wall('composite', '#e8ebee'), { pos: [0, 2, 0] });
    B.cyl(M.glassLit(1), R - 0.05, R - 0.05, 4.2, 0, 5.6, 0, { seg: 28 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      B.box(M.frame(true), 0.2, 4.2, 0.2, Math.cos(a) * R, 5.6, Math.sin(a) * R);
    }
    B.cyl(M.wall('composite', '#e8ebee'), R, R, h - 7.7, 0, 7.7 + (h - 7.7) / 2, 0, { seg: 28 });
    B.cyl(M.painted('#1f4f9c', 0.45), R + 1.6, R + 1.6, 0.9, 0, h + 0.45, 0, { seg: 28 });
    B.cyl(M.roof('membrane', '#b9bdc2'), R + 1.5, R + 1.5, 0.05, 0, h + 0.92, 0, { seg: 28 });
    boothSign(B, ctx, o, R * 1.2, h - 1, R + 0.05, 0.9);
    lightAt(ctx, 0, h - 0.2, R + 1, { power: 300, range: 36 });
  },
  office(B, o, { w, d, h }, ctx) {
    const wall = M.wall('composite', '#3d434b');
    B.slab(M.concrete('#cfccc4'), w + 2, 0.5, d + 2, 0, 0, 0);
    B.slab(wall, w, 3, d, 0, 0.5, 0);
    B.box(M.glassLit(2), w - 0.3, 6, d - 0.3, 0, 6.5, 0);
    for (let x = -w / 2 + 4; x < w / 2; x += 4) for (const sz of [-1, 1]) B.box(M.frame(true), 0.2, 6, 0.2, x, 6.5, sz * (d / 2 - 0.1));
    B.slab(wall, w, h - 9.5, d, 0, 9.5, 0);
    B.slab(M.painted('#c9922b', 0.4), w + 4, 1.2, d + 4, 0, h - 0.6, 0);
    boothSign(B, ctx, o, w * 0.7, h - 2, d / 2 + 0.03, 1.8);
    B.box(M.glassLit(1), 6, 7.5, 0.1, w / 2 - 6, 4.2, d / 2 + 0.05);
    lightAt(ctx, 0, h - 1, d / 2 + 2, { power: 450, range: 50 });
    lightAt(ctx, w / 2 + 2, h - 1, 0, { tx: w / 2 + 8, tz: 0, power: 450, range: 50 });
  },
};

/* ------------------------------------------------------------- dispatch */

function hashId(id) {
  let h = 2166136261;
  for (const c of String(id)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

const PEOPLE = new Set(['worker', 'visitor', 'guard', 'group']);
const PLANTS = new Set(['tree', 'oak', 'maple', 'birch', 'conifer', 'pine', 'palm', 'shrub', 'hedge']);

/**
 * Build a prop or booth into a group in its own frame.
 * userData.lights: night lights (own frame); userData.moving: animated parts;
 * userData.disposables: textures and materials made for this object only.
 */
export function buildProp(o) {
  const group = new THREE.Group();
  const B = new Builder();
  const ctx = { lights: [], moving: [], disposables: [] };
  const isBooth = o.kind === 'booth';
  const spec = isBooth ? BOOTH_BY_ID[o.design] : PROP_BY_ID[o.type];
  const dims = {
    w: o.w != null ? o.w : spec ? spec.w : 8,
    d: o.d != null ? o.d : spec ? spec.d : 8,
    h: o.h != null ? o.h : spec ? spec.h : 8,
  };
  if (isBooth) {
    (BOOTH[o.design] || BOOTH.classic)(B, o, dims, ctx);
  } else if (spec && spec.vehicle) {
    const VB = vehicleModel(o.type, o.color, dims.w, dims.d, dims.h);
    VB.finish(group);
    group.userData = { lights: [], moving: [], disposables: [] };
    return group;
  } else if (PLANTS.has(o.type)) {
    plant(B, o.type, hashId(o.id), dims);
  } else if (PEOPLE.has(o.type)) {
    const seed = hashId(o.id);
    if (o.type === 'group') {
      const r = rng(seed);
      for (let i = 0; i < 4; i++) person(B, r() > 0.7 ? 'worker' : 'visitor', seed + i * 7, (i % 2 - 0.5) * 3 + (r() - 0.5), (Math.floor(i / 2) - 0.5) * 2.6, r() * 6.28);
    } else {
      person(B, o.type, seed, 0, 0, 0);
    }
  } else if (P[o.type]) {
    P[o.type](B, o, dims, ctx);
  } else {
    B.slab(M.painted('#9aa1a8', 0.5), dims.w, dims.h, dims.d, 0, 0, 0);
  }
  B.finish(group);
  for (const m of ctx.moving) group.add(m);
  group.userData = { lights: ctx.lights, moving: ctx.moving, disposables: ctx.disposables };
  return group;
}
