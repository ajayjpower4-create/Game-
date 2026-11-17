/* Buildings part-way up: the pad, the footings, the structural frame, the
 * decks, the sheathing — and the scaffolding round a building being fitted
 * out. A building carries b.build = { stage, frame, color }; anything but
 * the last stage is modelled here instead of by buildings.js.
 *
 * Everything is in feet, in the building's own frame: x across its width,
 * z across its depth, y up from the pad. */

import * as THREE from 'three';
import { Builder, cylGeo } from './builder.js';
import * as M from './materials.js';
import { buildingHeight } from '../catalog.js';
import { DEG } from '../geom.js';
import { localFrames, roofRise, roofSurfaceY, openingRect, cellOnFloor, PARAPET, Face } from './buildings.js';
import { rng } from './textures.js';

const PI = Math.PI;

/** The stages a building goes through, in order. */
export const BUILD_STAGES = [
  { id: 'pad', name: 'Site cleared', icon: '🚧', blurb: 'Graded pad, setting-out lines, trenches dug.' },
  { id: 'found', name: 'Foundations', icon: '🧱', blurb: 'Footings poured, slab down, holding-down bolts set.' },
  { id: 'frame', name: 'Frame up', icon: '🏗️', blurb: 'Columns, beams and joists standing.' },
  { id: 'deck', name: 'Decked', icon: '🪵', blurb: 'Floors and roof decked out.' },
  { id: 'close', name: 'Sheathed', icon: '📦', blurb: 'Sheathing, weather barrier and scaffolding.' },
  { id: 'fit', name: 'Fitting out', icon: '🪜', blurb: 'Clad and roofed, scaffold still up.' },
];
export const STAGE_IDS = BUILD_STAGES.map((s) => s.id);
export const stageIndex = (id) => Math.max(0, STAGE_IDS.indexOf(id));

export const FRAME_KINDS = [
  { id: 'steel', name: 'Steel frame', icon: '🔩' },
  { id: 'timber', name: 'Timber frame', icon: '🪵' },
];

export const STEEL_COLORS = [['#b4bcc4', 'Galvanised'], ['#8c4a33', 'Red oxide'], ['#3f6b8a', 'Blue'], ['#5a6168', 'Grey'], ['#c9a22b', 'Yellow']];

/** Is this building still going up? */
export function underConstruction(b) {
  return !!(b && b.build && b.build.stage && b.build.stage !== 'done');
}

/** Has it got as far as having walls on? */
export function buildStage(b) {
  return underConstruction(b) ? stageIndex(b.build.stage) : STAGE_IDS.length;
}

/* ------------------------------------------------------------- materials */

const lumber = () => M.sheet('timber', '#e0c08a');
const lumberDark = () => M.sheet('timber', '#c9a874');
const ply = () => M.sheet('plywood', '#d9bd86');
const osb = () => M.sheet('osb', '#d9c9a0');
const wrapMat = () => M.sheet('wrap', '#f2f3f4');
const conc = (hex = '#b9b6ae') => M.concrete(hex);
const rebarMat = () => M.metal('#9a6a4a', 0.85);
const deckMat = () => M.roof('rib', '#9aa2a9');

/* --------------------------------------------------------------- shapes */

/** A rolled steel section standing up: web and two flanges. */
function colI(B, mat, h, x, z, { dp = 1.15, fw = 0.8, t = 0.1, y0 = 0, cross = false } = {}) {
  if (cross) {
    B.box(mat, dp, h, t, x, y0 + h / 2, z);
    for (const s of [-1, 1]) B.box(mat, t, h, fw, x + s * (dp / 2 - t / 2), y0 + h / 2, z);
  } else {
    B.box(mat, t, h, dp, x, y0 + h / 2, z);
    for (const s of [-1, 1]) B.box(mat, fw, h, t, x, y0 + h / 2, z + s * (dp / 2 - t / 2));
  }
}

/** A steel beam lying along x (or z): web upright, flanges top and bottom. */
function beamI(B, mat, len, cx, y, cz, { dp = 1.5, fw = 0.75, t = 0.1, along = 'x' } = {}) {
  if (along === 'x') {
    B.box(mat, len, dp - t * 2, t, cx, y - dp / 2, cz);
    for (const s of [-1, 1]) B.box(mat, len, t, fw, cx, y - dp / 2 + s * (dp / 2 - t / 2), cz);
  } else {
    B.box(mat, t, dp - t * 2, len, cx, y - dp / 2, cz);
    for (const s of [-1, 1]) B.box(mat, fw, t, len, cx, y - dp / 2 + s * (dp / 2 - t / 2), cz);
  }
}

/** An open-web steel joist: two chords and a zigzag of round web members. */
function barJoist(B, mat, len, cx, y, cz, { dp = 1.8, along = 'x', bays = 0 } = {}) {
  const n = bays || Math.max(4, Math.round(len / 3.5));
  const ax = along === 'x';
  const at = (t, hh) => (ax ? [cx - len / 2 + len * t, y - hh, cz] : [cx, y - hh, cz - len / 2 + len * t]);
  const chord = (hh, th) => (ax ? B.box(mat, len, th, 0.34, cx, y - hh, cz) : B.box(mat, 0.34, th, len, cx, y - hh, cz));
  chord(0.07, 0.14);
  chord(dp - 0.07, 0.14);
  for (let i = 0; i < n; i++) {
    B.tube(mat, at(i / n, 0.14), at((i + 0.5) / n, dp - 0.14), 0.055, 5);
    B.tube(mat, at((i + 0.5) / n, dp - 0.14), at((i + 1) / n, 0.14), 0.055, 5);
  }
}

/** A sawn timber member between two points (studs, plates, rafters, braces). */
function stick(B, mat, a, b2, w = 0.125, t = 0.46) {
  const dx = b2[0] - a[0];
  const dy = b2[1] - a[1];
  const dz = b2[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  if (len < 0.02) return;
  const g = new THREE.BoxGeometry(w, len, t);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz).normalize());
  const m = new THREE.Matrix4().makeRotationFromQuaternion(q).setPosition((a[0] + b2[0]) / 2, (a[1] + b2[1]) / 2, (a[2] + b2[2]) / 2);
  B.add(g.applyMatrix4(m), mat);
}

/** A sheet of board laid over a rectangle of wall, in 4 × 8 panels. */
function sheetWall(B, mat, face, s0, s1, h0, h1, dp, holes = []) {
  const covered = (s, h) => holes.some((o) => s > o.s0 - 0.25 && s < o.s1 + 0.25 && h > o.h0 - 0.25 && h < o.h1 + 0.25);
  for (let s = s0; s < s1 - 0.05; s += 4) {
    for (let h = h0; h < h1 - 0.05; h += 8) {
      const a = Math.min(s + 4, s1);
      const b2 = Math.min(h + 8, h1);
      // Skip a panel only where the opening really swallows it.
      if (covered((s + a) / 2, (h + b2) / 2) && covered(s + 0.2, h + 0.2) && covered(a - 0.2, b2 - 0.2)) continue;
      face.rect(mat, s + 0.06, a - 0.06, h + 0.06, b2 - 0.06, dp);
    }
  }
}

/* ------------------------------------------------------------- the pad */

function pad(B, b, r) {
  const w = b.w;
  const d = b.d;
  // Graded dirt, a touch proud of the site, with tracked-in edges.
  B.slab(M.dirt('#9b8463'), w + 16, 0.3, d + 16, 0, -0.3, 0);
  B.slab(M.dirt('#8a7558'), w + 6, 0.12, d + 6, 0, 0, 0);
  // Setting-out profiles: stakes and string lines round the footprint.
  const line = M.plastic('#e2b31b', 0.6);
  for (const [x0, z0, x1, z1] of [[-1, -1, 1, -1], [1, -1, 1, 1], [1, 1, -1, 1], [-1, 1, -1, -1]]) {
    const a = [(x0 * (w + 5)) / 2, 2.6, (z0 * (d + 5)) / 2];
    const c = [(x1 * (w + 5)) / 2, 2.6, (z1 * (d + 5)) / 2];
    B.tube(line, a, c, 0.035, 4);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = (sx * (w + 5)) / 2;
    const z = (sz * (d + 5)) / 2;
    for (const o of [-1.6, 1.6]) {
      B.post(M.sheet('timber', '#d9bd86'), 0.13, 3, x + (sx ? 0 : o), 0, z + o * (sx ? 1 : 0), 4);
    }
    B.post(M.sheet('timber', '#d9bd86'), 0.13, 3.2, x, 0, z, 4);
    B.box(M.sheet('timber', '#d9bd86'), 3.4, 0.14, 0.4, x, 2.9, z);
  }
  // Trenches round the edge, with spoil beside them.
  const trench = M.dirt('#6f5c42');
  for (const f of [[0, (d - 3) / 2, w - 4, 3], [0, -(d - 3) / 2, w - 4, 3], [(w - 3) / 2, 0, 3, d - 4], [-(w - 3) / 2, 0, 3, d - 4]]) {
    B.box(trench, f[2], 1.6, f[3], f[0], -0.7, f[1]);
    B.box(rebarMat(), f[2] - 1, 0.08, 0.08, f[0], -0.4, f[1] + (f[3] > f[2] ? 0 : 0.5));
  }
  for (let i = 0; i < 5; i++) {
    const a = r() * PI * 2;
    const rad = Math.max(w, d) * 0.55 + r() * 12;
    B.cone(M.dirt('#7a6448'), 4 + r() * 3, 3 + r() * 2.5, Math.cos(a) * rad, 0, Math.sin(a) * rad, 10);
  }
  return 0;
}

/* ------------------------------------------------------- the foundations */

/** Column centres across the plan, on a sensible structural grid. */
function gridLines(len, want) {
  const n = Math.max(1, Math.round(len / want));
  const out = [];
  for (let i = 0; i <= n; i++) out.push(-len / 2 + (len / n) * i);
  return out;
}

function foundations(B, b, { bolts = true, slab = true } = {}) {
  const w = b.w;
  const d = b.d;
  const timber = (b.build && b.build.frame) === 'timber';
  const xs = gridLines(w, timber ? 22 : 26);
  const zs = gridLines(d, timber ? 20 : 24);
  B.slab(M.dirt('#8a7558'), w + 16, 0.2, d + 16, 0, -0.2, 0);
  // Perimeter footing and stem wall.
  const th = timber ? 1.1 : 1.4;
  for (const [cx, cz, sw, sd] of [[0, (d - th) / 2, w, th], [0, -(d - th) / 2, w, th], [(w - th) / 2, 0, th, d - th * 2], [-(w - th) / 2, 0, th, d - th * 2]]) {
    B.box(conc('#a8a49c'), sw + 1.4, 0.9, sd + 1.4, cx, -0.45, cz);
    B.slab(conc(), sw, 1.5, sd, cx, 0, cz);
  }
  if (slab) {
    B.slab(conc('#c2bfb6'), w - th * 2, 0.7, d - th * 2, 0, 0, 0);
    // Saw-cut control joints.
    for (let i = 1; i < Math.round(w / 25); i++) B.box(conc('#9e9b94'), 0.1, 0.02, d - th * 2, -w / 2 + th + ((w - th * 2) / Math.round(w / 25)) * i, 0.7, 0);
    for (let i = 1; i < Math.round(d / 25); i++) B.box(conc('#9e9b94'), w - th * 2, 0.02, 0.1, 0, 0.7, -d / 2 + th + ((d - th * 2) / Math.round(d / 25)) * i);
  }
  // Pad footings under every internal column, with their bolts.
  if (!timber) {
    for (const x of xs) for (const z of zs) {
      const edge = Math.abs(Math.abs(x) - w / 2) < 0.1 || Math.abs(Math.abs(z) - d / 2) < 0.1;
      if (!edge) B.slab(conc('#a8a49c'), 4.5, 1.1, 4.5, x, 0, z);
      if (!bolts) continue;
      B.slab(M.metal('#8a8f96', 0.6), 1.9, 0.12, 1.9, x, edge ? 1.5 : 1.1, z);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        B.post(M.metal('#c9ced3', 0.4), 0.07, 0.55, x + sx * 0.6, edge ? 1.62 : 1.22, z + sz * 0.6, 6);
      }
    }
  } else if (bolts) {
    for (const [cx, cz, sw, sd] of [[0, (d - th) / 2, w, th], [0, -(d - th) / 2, w, th]]) {
      for (let i = 0; i < Math.round(sw / 6); i++) B.post(M.metal('#c9ced3', 0.4), 0.06, 0.5, -sw / 2 + 3 + i * 6, 1.5, cz, 6);
    }
  }
  return timber ? 1.5 : 1.5;
}

/* ------------------------------------------------------------ the frame */

function steelFrame(B, b, H, floors, fh, opts) {
  const w = b.w;
  const d = b.d;
  const mat = M.painted((b.build && b.build.color) || STEEL_COLORS[0][0], 0.55);
  const xs = gridLines(w, 26);
  const zs = gridLines(d, 24);
  const y0 = 1.5;
  const levels = [];
  for (let f = 1; f <= floors; f++) levels.push(y0 + fh * f);
  const roofY = levels[levels.length - 1];
  // Columns the whole way up, with their base plates and splice plates.
  for (const x of xs) for (const z of zs) {
    const cross = Math.abs(Math.abs(x) - w / 2) < 0.1;
    colI(B, mat, roofY - y0 + 0.4, x, z, { y0, cross, dp: H > 40 ? 1.35 : 1.15 });
    for (const y of levels.slice(0, -1)) B.box(mat, 1.5, 0.12, 1.5, x, y + 0.35, z);
  }
  // Beams along both directions at every level.
  for (const y of levels) {
    for (const z of zs) for (let i = 0; i < xs.length - 1; i++) {
      beamI(B, mat, xs[i + 1] - xs[i] - 1.2, (xs[i] + xs[i + 1]) / 2, y, z, { along: 'x', dp: 1.8 });
    }
    for (const x of xs) for (let i = 0; i < zs.length - 1; i++) {
      beamI(B, mat, zs[i + 1] - zs[i] - 1.2, x, y, (zs[i] + zs[i + 1]) / 2, { along: 'z', dp: 1.5 });
    }
    // Joists filling each bay, spanning the shorter way.
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++) {
      const bw = xs[i + 1] - xs[i];
      const bd = zs[j + 1] - zs[j];
      const spanX = bw <= bd;
      const n = Math.max(2, Math.round((spanX ? bd : bw) / 6));
      for (let k = 1; k < n; k++) {
        if (spanX) barJoist(B, mat, bw - 0.9, (xs[i] + xs[i + 1]) / 2, y - 0.1, zs[j] + (bd / n) * k, { along: 'x', dp: 1.7 });
        else barJoist(B, mat, bd - 0.9, xs[i] + (bw / n) * k, y - 0.1, (zs[j] + zs[j + 1]) / 2, { along: 'z', dp: 1.7 });
      }
    }
  }
  // Cross bracing in a bay on each side.
  const brace = M.metal('#c9ced3', 0.5);
  for (const z of [zs[0], zs[zs.length - 1]]) {
    const i = Math.max(0, Math.floor((xs.length - 1) / 2));
    for (const y of levels) {
      B.tube(brace, [xs[i], y - fh, z], [xs[i + 1], y - 0.6, z], 0.12, 6);
      B.tube(brace, [xs[i + 1], y - fh, z], [xs[i], y - 0.6, z], 0.12, 6);
    }
  }
  for (const x of [xs[0], xs[xs.length - 1]]) {
    const j = Math.max(0, Math.floor((zs.length - 1) / 2));
    for (const y of levels) {
      B.tube(brace, [x, y - fh, zs[j]], [x, y - 0.6, zs[j + 1]], 0.12, 6);
      B.tube(brace, [x, y - fh, zs[j + 1]], [x, y - 0.6, zs[j]], 0.12, 6);
    }
  }
  // A pitched roof gets rafters over the top steel.
  if (opts.pitched) {
    for (const x of xs) {
      const prof = roofProfile(b, 'z', x);
      for (let i = 0; i < prof.length - 1; i++) B.tube(mat, prof[i], prof[i + 1], 0.22, 5);
    }
  }
  return { xs, zs, levels, roofY, mat };
}

/** The line a roof surface takes across the building, in model coordinates. */
function roofProfile(b, along, at, step = 6) {
  const w = b.w;
  const d = b.d;
  const pts = [];
  const len = along === 'z' ? d : w;
  const n = Math.max(2, Math.round(len / step));
  for (let i = 0; i <= n; i++) {
    const t = (len / n) * i;
    const dx = along === 'z' ? at + w / 2 : t;
    const dy = along === 'z' ? t : at + d / 2;
    const y = roofSurfaceY(b, dx, dy);
    pts.push([dx - w / 2, y, dy - d / 2]);
  }
  return pts;
}

function timberFrame(B, b, H, floors, fh, opts) {
  const w = b.w;
  const d = b.d;
  const m = lumber();
  const md = lumberDark();
  const y0 = 1.5;
  const frames = localFrames(w, d);
  // Stick framing at 16 in centres on a house; a big shed is post and beam,
  // so the members get fewer and heavier as the building grows.
  const span = Math.max(w, d);
  const spacing = span > 240 ? 4 : span > 110 ? 2.4 : 1.333;
  const heavy = span > 110;
  const sw = heavy ? 0.42 : 0.125;      // member width
  const st = heavy ? 0.75 : 0.46;       // member thickness
  const t = st;
  const levels = [];
  for (let f = 0; f < floors; f++) levels.push(y0 + fh * f);
  const walls = [];
  for (const face of ['N', 'E', 'S', 'W']) {
    const f = frames[face];
    const cols = (b.walls && b.walls[face]) ? b.walls[face][0].length : 4;
    const cw = f.len / cols;
    for (let fl = 0; fl < floors; fl++) {
      const base = y0 + fh * fl;
      const topY = base + fh - 0.6;
      const at = (s, y, dp = 0) => [f.o[0] + f.u[0] * s + f.n[0] * dp, y, f.o[1] + f.u[1] * s + f.n[1] * dp];
      // Sole plate and a double top plate.
      stick(B, md, at(0.2, base + 0.06), at(f.len - 0.2, base + 0.06), sw, t);
      stick(B, m, at(0.2, topY - 0.06), at(f.len - 0.2, topY - 0.06), sw, t);
      stick(B, m, at(0.2, topY + 0.07), at(f.len - 0.2, topY + 0.07), sw, t);
      // Openings on this storey, from the wall grid.
      const holes = [];
      for (let c = 0; c < cols; c++) {
        const type = cellOnFloor((b.walls && b.walls[face] && b.walls[face][fl] && b.walls[face][fl][c]) || 'blank', fl);
        const o = openingRect(type, cw, fh);
        if (!o || o.fill === 'open') continue;
        holes.push({ s0: c * cw + o.s0, s1: c * cw + o.s1, h0: base + o.h0, h1: base + Math.min(o.h1, fh - 1) });
      }
      walls.push({ face, f, base, topY, holes, at });
      // Studs, skipping where an opening is, with cripples above and below.
      for (let s = 0.6; s < f.len - 0.6; s += spacing) {
        const hole = holes.find((o) => s > o.s0 - 0.3 && s < o.s1 + 0.3);
        if (!hole) { stick(B, m, at(s, base + 0.12), at(s, topY - 0.12), sw, t); continue; }
        if (hole.h0 > base + 0.6) stick(B, m, at(s, base + 0.12), at(s, hole.h0 - 0.3), sw, t);
        if (hole.h1 + 0.5 < topY) stick(B, m, at(s, hole.h1 + 0.5), at(s, topY - 0.12), sw, t);
      }
      for (const o of holes) {
        // King studs, trimmers, header and sill.
        for (const s of [o.s0, o.s1]) {
          stick(B, m, at(s, base + 0.12), at(s, topY - 0.12), sw, t);
          stick(B, m, at(s + (s === o.s0 ? 0.16 : -0.16), base + 0.12), at(s + (s === o.s0 ? 0.16 : -0.16), o.h1 + 0.1), sw, t);
        }
        stick(B, md, at(o.s0, o.h1 + 0.3), at(o.s1, o.h1 + 0.3), 0.6, t);
        if (o.h0 > base + 0.5) stick(B, md, at(o.s0, o.h0 - 0.1), at(o.s1, o.h0 - 0.1), 0.24, t);
      }
      // A let-in diagonal brace at each end.
      for (const s of [1.5, f.len - 1.5]) {
        const dir = s < f.len / 2 ? 1 : -1;
        stick(B, m, at(s, base + 0.3), at(s + dir * Math.min(10, f.len / 3), topY - 0.3), 0.12, 0.14);
      }
    }
  }
  // Floor joists and rim boards between storeys.
  const spanX = w <= d;
  for (let fl = 1; fl < floors; fl++) {
    const y = y0 + fh * fl - 0.5;
    const len = spanX ? w : d;
    const across = spanX ? d : w;
    for (let s = 1.2; s < across - 1.2; s += spacing) {
      const a = spanX ? [-w / 2 + 0.4, y, -d / 2 + s] : [-w / 2 + s, y, -d / 2 + 0.4];
      const c = spanX ? [w / 2 - 0.4, y, -d / 2 + s] : [-w / 2 + s, y, d / 2 - 0.4];
      stick(B, m, a, c, sw, heavy ? 1.3 : 0.8);
    }
    // A beam down the middle of a long span, on posts.
    if (len > 26) {
      const bz = spanX ? 0 : 0;
      if (spanX) stick(B, md, [0, y, -d / 2 + 0.5], [0, y, d / 2 - 0.5], 0.5, 1);
      else stick(B, md, [-w / 2 + 0.5, y, 0], [w / 2 - 0.5, y, 0], 0.5, 1);
      for (let k = -1; k <= 1; k += 1) {
        const px = spanX ? 0 : (k * (w - 10)) / 2;
        const pz = spanX ? (k * (d - 10)) / 2 : bz;
        B.box(md, 0.5, fh - 1.2, 0.5, px, y - (fh - 1.2) / 2 - 0.5, pz);
      }
    }
    for (const [cx, cz, sw, sd] of [[0, (d - 0.2) / 2, w, 0.2], [0, -(d - 0.2) / 2, w, 0.2], [(w - 0.2) / 2, 0, 0.2, d], [-(w - 0.2) / 2, 0, 0.2, d]]) {
      B.box(m, sw, 1, sd, cx, y - 0.5, cz);
    }
  }
  // Roof: trusses or rafters following the real roof shape.
  const ridgeAlong = w >= d ? 'z' : 'x';
  const along = ridgeAlong === 'z' ? w : d;
  const spacing2 = along > 240 ? 6 : along > 110 ? 4 : 2;
  for (let s = -along / 2 + 1; s <= along / 2 - 1; s += spacing2) {
    if (!opts.pitched) {
      // Flat roof: joists straight across, no need to follow a slope.
      const y = 1.5 + fh * floors - 0.5;
      const a = ridgeAlong === 'z' ? [s, y, -d / 2 + 0.4] : [-w / 2 + 0.4, y, s];
      const c = ridgeAlong === 'z' ? [s, y, d / 2 - 0.4] : [w / 2 - 0.4, y, s];
      stick(B, m, a, c, sw, heavy ? 1.5 : 0.8);
      continue;
    }
    const prof = roofProfile(b, ridgeAlong, s, 8);
    const eave = Math.min(prof[0][1], prof[prof.length - 1][1]);
    for (let i = 0; i < prof.length - 1; i++) stick(B, m, prof[i], prof[i + 1], sw, heavy ? 1.2 : 0.75);
    // Bottom chord and webs make it a truss.
    const a = [prof[0][0], eave, prof[0][2]];
    const c = [prof[prof.length - 1][0], eave, prof[prof.length - 1][2]];
    stick(B, m, a, c, sw, heavy ? 1 : 0.6);
    for (let i = 1; i < prof.length - 1; i++) {
      const foot = [prof[i][0], eave, prof[i][2]];
      if (prof[i][1] - eave > 0.6) stick(B, m, foot, prof[i], sw * 0.8, heavy ? 0.7 : 0.4);
    }
  }
  // Purlins or strapping over the joists, to tie them together.
  const acrossLen = ridgeAlong === 'z' ? d : w;
  const y2 = 1.5 + fh * floors - 0.5 + (opts.pitched ? 0 : 0.5);
  if (!opts.pitched) {
    for (let t = -acrossLen / 2 + 6; t < acrossLen / 2 - 5; t += 12) {
      const a = ridgeAlong === 'z' ? [-along / 2 + 1, y2, t] : [t, y2, -along / 2 + 1];
      const c = ridgeAlong === 'z' ? [along / 2 - 1, y2, t] : [t, y2, along / 2 - 1];
      stick(B, md, a, c, sw, 0.5);
    }
  }
  return { levels, y0, walls, ridgeAlong, m };
}

/* --------------------------------------------------------------- decking */

function decks(B, b, H, floors, fh, kind, info) {
  const w = b.w;
  const d = b.d;
  const timber = kind === 'timber';
  const flat = !b.roofType || b.roofType === 'flat';
  const mat = timber ? ply() : deckMat();
  for (let f = 1; f < floors; f++) {
    const y = 1.5 + fh * f;
    B.slab(mat, w - 1.2, 0.22, d - 1.2, 0, y - 0.22, 0);
    if (!timber) B.slab(conc('#bdbab2'), w - 1.4, 0.35, d - 1.4, 0, y - 0.22, 0);
  }
  if (flat) {
    B.slab(mat, w - 0.8, 0.3, d - 0.8, 0, 1.5 + fh * floors - 0.3, 0);
  } else {
    // Sheathing laid over the slope, a strip at a time.
    const along = info && info.ridgeAlong ? info.ridgeAlong : (w >= d ? 'z' : 'x');
    const span = along === 'z' ? w : d;
    const step = 4;
    for (let s = -span / 2; s < span / 2 - 0.1; s += step) {
      const p0 = roofProfile(b, along, s, 5);
      const p1 = roofProfile(b, along, Math.min(s + step, span / 2), 5);
      for (let i = 0; i < p0.length - 1; i++) {
        B.quad(mat, [p0[i][0], p0[i][1] + 0.1, p0[i][2]], [p1[i][0], p1[i][1] + 0.1, p1[i][2]], [p1[i + 1][0], p1[i + 1][1] + 0.1, p1[i + 1][2]], [p0[i + 1][0], p0[i + 1][1] + 0.1, p0[i + 1][2]]);
      }
    }
  }
}

/* ------------------------------------------------------------- sheathing */

function sheathing(B, b, H, floors, fh, kind) {
  const frames = localFrames(b.w, b.d);
  const board = kind === 'timber' ? osb() : ply();
  for (const face of ['N', 'E', 'S', 'W']) {
    const f = frames[face];
    const fc = new Face(B, f);
    const cols = (b.walls && b.walls[face]) ? b.walls[face][0].length : 4;
    const cw = f.len / cols;
    for (let fl = 0; fl < floors; fl++) {
      const base = 1.5 + fh * fl;
      const holes = [];
      for (let c = 0; c < cols; c++) {
        const type = cellOnFloor((b.walls && b.walls[face] && b.walls[face][fl] && b.walls[face][fl][c]) || 'blank', fl);
        const o = openingRect(type, cw, fh);
        if (!o) continue;
        holes.push({ s0: c * cw + o.s0, s1: c * cw + o.s1, h0: base + o.h0, h1: base + Math.min(o.h1, fh - 0.6) });
      }
      sheetWall(B, board, fc, 0.3, f.len - 0.3, base, base + fh - 0.4, 0.28, holes);
      // The weather barrier goes over everything but the openings: the full
      // runs between them, and the strips over and under each one.
      const top = base + fh - 0.6;
      for (const [s0, s1] of bandsAround(0.3, f.len - 0.3, holes)) fc.rect(wrapMat(), s0, s1, base + 0.2, top, 0.34);
      for (const o of holes) {
        const a = Math.max(0.3, o.s0);
        const c = Math.min(f.len - 0.3, o.s1);
        if (c - a < 0.3) continue;
        if (o.h0 > base + 0.5) fc.rect(wrapMat(), a, c, base + 0.2, o.h0, 0.34);
        if (o.h1 < top - 0.3) fc.rect(wrapMat(), a, c, o.h1, top, 0.34);
      }
    }
  }
}

/** The runs of wall left either side of the openings on a face. */
function bandsAround(s0, s1, holes) {
  const cuts = holes.slice().sort((a, b2) => a.s0 - b2.s0);
  const out = [];
  let x = s0;
  for (const h of cuts) {
    if (h.s0 > x + 0.6) out.push([x, Math.min(h.s0, s1)]);
    x = Math.max(x, h.s1);
  }
  if (s1 > x + 0.6) out.push([x, s1]);
  return out;
}

/* ------------------------------------------------------------ scaffolding */

/** A scaffold round a building: standards, ledgers, boards, toe boards, ties. */
export function scaffold(B, b, H, { sides = ['N', 'E', 'S', 'W'], lifts = 0, r = null } = {}) {
  const rand = r || rng(7);
  const tube = M.metal('#b9bfc4', 0.45);
  const boardM = M.sheet('timber', '#d9bd86');
  const frames = localFrames(b.w, b.d);
  const top = H + 3;
  const n = Math.max(2, lifts || Math.round(top / 6.5));
  const lift = top / n;
  for (const face of sides) {
    const f = frames[face];
    const at = (s, y, dp) => [f.o[0] + f.u[0] * s + f.n[0] * dp, y, f.o[1] + f.u[1] * s + f.n[1] * dp];
    const bays = Math.max(1, Math.round(f.len / 7));
    const bw = f.len / bays;
    for (let i = 0; i <= bays; i++) {
      const s = Math.min(f.len - 0.1, i * bw);
      for (const dp of [1, 4.2]) {
        B.tube(tube, at(s, 0, dp), at(s, top, dp), 0.11, 6);
        B.box(M.metal('#8a8f96', 0.5), 0.5, 0.1, 0.5, ...at(s, 0.05, dp));
      }
      for (let k = 1; k <= n; k++) B.tube(tube, at(s, lift * k, 1), at(s, lift * k, 4.2), 0.1, 5);
    }
    for (let k = 1; k <= n; k++) {
      const y = lift * k;
      for (const dp of [1, 4.2]) {
        B.tube(tube, at(0.1, y, dp), at(f.len - 0.1, y, dp), 0.1, 5);
        B.tube(tube, at(0.1, y + 1.6, dp), at(f.len - 0.1, y + 1.6, dp), 0.1, 5);
        if (dp > 2) B.tube(tube, at(0.1, y + 3.1, dp), at(f.len - 0.1, y + 3.1, dp), 0.1, 5);
      }
      // Boards are only where the work is: the top two lifts are decked out,
      // the ones below are bare tube.
      if (k < n - 1) continue;
      const rotY = Math.atan2(-f.u[1], f.u[0]);
      for (let i = 0; i < bays; i++) {
        const s0 = i * bw + 0.15;
        const len = bw - 0.3;
        for (let j = 0; j < 4; j++) {
          const p = at(s0 + len / 2, y + 0.16, 1.3 + j * 0.78);
          B.box(boardM, len, 0.1, 0.76, p[0], p[1], p[2], [0, rotY, 0]);
        }
        const t = at(s0 + len / 2, y + 0.45, 4.28);
        B.box(boardM, len, 0.5, 0.1, t[0], t[1], t[2], [0, rotY, 0]);
      }
    }
    // A diagonal brace every few bays, up the full height.
    for (let k = 1; k <= n; k++) {
      for (let i = 0; i < bays; i += 2) {
        B.tube(tube, at(i * bw, lift * k - lift, 4.2), at(Math.min((i + 1) * bw, f.len), lift * k, 4.2), 0.09, 5);
      }
    }
    // A ladder bay with its hoop guard.
    const ls = Math.min(f.len - 1.5, bw * 0.5);
    for (const sx of [-0.55, 0.55]) B.tube(tube, at(ls + sx, 0, 2.6), at(ls + sx, top, 2.6), 0.07, 5);
    for (let y = 1; y < top; y += 1.1) B.tube(tube, at(ls - 0.55, y, 2.6), at(ls + 0.55, y, 2.6), 0.05, 4);
    // Netting on the outside of a couple of bays.
    if (rand() < 0.75) {
      const i = Math.floor(rand() * bays);
      const fc = new (b.__Face || Object)();
      void fc;
      for (let k = 1; k <= n; k++) {
        const y = lift * k;
        const s0 = i * bw;
        const s1 = Math.min((i + 1) * bw, f.len);
        const a = at(s0, y - lift + 0.2, 4.35);
        const c = at(s1, y - 0.2, 4.35);
        B.quad(M.meshFence(), [a[0], a[1], a[2]], [c[0], a[1], c[2]], [c[0], c[1], c[2]], [a[0], c[1], a[2]], [0, 0, (s1 - s0) / 3, 0, (s1 - s0) / 3, lift / 3, 0, lift / 3]);
      }
    }
  }
}

/* ------------------------------------------------------------ site stuff */

/** Bits and pieces that live on the slab while the work goes on. */
function siteDressing(B, b, r, stage) {
  const w = b.w;
  const d = b.d;
  const y = stage >= 1 ? 2.2 : 0;
  const spots = [];
  for (let i = 0; i < 6; i++) {
    spots.push([(r() - 0.5) * (w - 12), (r() - 0.5) * (d - 12)]);
  }
  spots.forEach(([x, z], i) => {
    const k = (i + Math.floor(r() * 3)) % 5;
    if (k === 0) {
      // A banded stack of timber.
      const n = 3 + Math.floor(r() * 3);
      for (let j = 0; j < n; j++) B.box(lumber(), 10, 0.5, 3.4, x, y + 0.25 + j * 0.52, z);
      for (const sx of [-1, 1]) B.box(M.metal('#8a8f96', 0.5), 0.1, n * 0.52 + 0.2, 3.5, x + sx * 3, y + (n * 0.52) / 2, z);
    } else if (k === 1) {
      // Sheet goods on bearers.
      for (let j = 0; j < 8; j++) B.box(j % 2 ? ply() : osb(), 8, 0.1, 4, x, y + 0.4 + j * 0.11, z);
      for (const sz of [-1, 1]) B.box(lumberDark(), 8.2, 0.4, 0.4, x, y + 0.2, z + sz * 1.6);
    } else if (k === 2) {
      // A bale of insulation under a tarpaulin.
      B.box(M.plastic('#d9d4c7', 0.9), 7, 3.4, 4.4, x, y, z);
      B.box(M.plastic('#2e6f8e', 0.75), 7.6, 0.2, 5, x, y + 3.4, z);
    } else if (k === 3) {
      // Drums and buckets.
      for (let j = 0; j < 3; j++) B.cyl(M.painted(['#1f4f9c', '#e2b31b', '#c0392b'][j], 0.5), 1, 1, 2.9, x + j * 2.2, y + 1.45, z, { seg: 12 });
    } else {
      // A dumpy bag of aggregate.
      B.box(M.plastic('#d9d9d6', 0.95), 3.4, 3.4, 3.4, x, y, z);
      B.cone(M.dirt('#9b8463'), 1.6, 0.8, x, y + 3.4, z, 10);
    }
  });
}

/* --------------------------------------------------------------- public */

/**
 * A building part-way up. Returns a THREE.Group in the same frame as
 * buildBuilding's, so the editor can treat the two the same way.
 */
export function buildFrame(b) {
  const group = new THREE.Group();
  const B = new Builder();
  const stage = stageIndex((b.build && b.build.stage) || 'frame');
  const kind = (b.build && b.build.frame) === 'timber' ? 'timber' : 'steel';
  const H = buildingHeight(b);
  const floors = Math.max(1, b.floors || 1);
  const fh = H / floors;
  const flat = !b.roofType || b.roofType === 'flat';
  const r = rng((b.id || 'x').split('').reduce((a, c) => a + c.charCodeAt(0), 7) * 31 + stage);

  if (stage === 0) {
    pad(B, b, r);
    B.finish(group);
    group.userData.lights = [];
    group.userData.disposables = [];
    group.userData.moving = [];
    return group;
  }

  foundations(B, b);
  let info = {};
  if (stage >= 2) {
    info = kind === 'timber'
      ? timberFrame(B, b, H, floors, fh, { pitched: !flat })
      : steelFrame(B, b, H, floors, fh, { pitched: !flat });
    if (flat && b.parapet) {
      // A parapet upstand is framed before the cladding goes on.
      const frames = localFrames(b.w, b.d);
      for (const face of ['N', 'E', 'S', 'W']) {
        const f = frames[face];
        const at = (s, y2, dp = 0) => [f.o[0] + f.u[0] * s + f.n[0] * dp, y2, f.o[1] + f.u[1] * s + f.n[1] * dp];
        const pm = kind === 'timber' ? lumber() : M.painted((b.build && b.build.color) || STEEL_COLORS[0][0], 0.55);
        for (let s = 2; s < f.len - 1; s += 8) B.tube(pm, at(s, H + 1.2), at(s, H + 1.2 + PARAPET * 0.75), 0.17, 4);
        B.tube(pm, at(1, H + 1.2 + PARAPET * 0.7), at(f.len - 1, H + 1.2 + PARAPET * 0.7), 0.16, 4);
      }
    }
  }
  if (stage >= 3) decks(B, b, H, floors, fh, kind, info);
  if (stage >= 4) sheathing(B, b, H, floors, fh, kind);
  if (stage >= 4) scaffold(B, b, H, { r });
  if (stage >= 1) siteDressing(B, b, r, stage);

  B.finish(group);
  group.userData.lights = [];
  group.userData.disposables = [];
  group.userData.moving = [];
  return group;
}

export { roofProfile, stick, scaffold as buildScaffold };
void [roofRise, DEG, cylGeo];
