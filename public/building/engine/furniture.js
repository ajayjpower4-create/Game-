/* Furniture and fittings for interiors: the dispatcher, and the things every
 * kind of building needs — doors and internal windows, light fittings, décor
 * and people. The trade-specific ranges (offices, shops, kitchens, homes...)
 * register themselves from their own files.
 *
 * A builder gets (B, item, { w, d, h }, ctx, spec) and models the piece on
 * y = 0, centred, front toward +z. Fittings that hang (spec.ceil) are
 * modelled downward from y = 0, which the view puts at the ceiling. */

import { defineItems } from '../interiorlist.js';
import {
  PI, WOODS, FABRICS, LAMINATES, METALS, BRIGHTS, rbox, slab, cushion, post, disc, barX, barZ, lathe, legs, handle,
  face, picture, labelMat, screenMat, foliage, fronds, shadeHex, rng, cylGeo, THREE, M,
} from './furnkit.js';
import { personWith } from './figures.js';

export const FURN = {};

/** Add a range: its catalogue entries and the builders that model them. */
export function register(list, builders) {
  defineItems(list);
  Object.assign(FURN, builders);
}

export function buildItem(B, it, spec, ctx) {
  const dims = { w: it.w || spec.w, d: spec.d, h: spec.h };
  if (spec.person) {
    personWith(B, spec.person, it.seed || 1, { pose: it.pose || spec.pose || 'stand', turn: PI });
    return;
  }
  const fn = FURN[it.type];
  if (fn) fn(B, it, dims, ctx, spec);
  else slab(B, M.painted('#9aa1a8', 0.5), dims.w, dims.h, dims.d);
}

const seedOf = (it) => it.seed || 1;
const alu = () => M.metal('#b9bfc4', 0.35);
const black = () => M.painted('#22262b', 0.5);
const chrome = () => M.chrome();

/* ------------------------------------------------------------------ doors */

/** A door frame round an opening w wide and h high, in a wall along x. */
function frame(B, mat, w, h, depth = 0.56, t = 0.14) {
  slab(B, mat, t, h + t, depth, -w / 2 - t / 2, 0, 0);
  slab(B, mat, t, h + t, depth, w / 2 + t / 2, 0, 0);
  slab(B, mat, w + t * 2, t, depth, 0, h, 0);
  // Architraves on both faces.
  for (const sz of [-1, 1]) {
    slab(B, mat, 0.22, h + 0.22, 0.045, -w / 2 - 0.11, 0, sz * (depth / 2 + 0.02));
    slab(B, mat, 0.22, h + 0.22, 0.045, w / 2 + 0.11, 0, sz * (depth / 2 + 0.02));
    slab(B, mat, w + 0.44, 0.22, 0.045, 0, h, sz * (depth / 2 + 0.02));
  }
}

/** A leaf hinged at x = hinge, swung open by `open` radians toward +z. `make(L)` models the leaf lying from x = 0 to w. */
function leaf(B, hinge, dir, open, make) {
  const tmp = new (B.constructor)();
  make(tmp);
  for (const [mat, geos] of tmp.parts) {
    for (const g of geos) {
      if (dir < 0) g.scale(-1, 1, 1);
      // Mirrored geometry needs its winding turned back over.
      if (dir < 0 && g.index) { const a = g.index.array; for (let i = 0; i < a.length; i += 3) { const t = a[i]; a[i] = a[i + 2]; a[i + 2] = t; } g.computeVertexNormals(); }
      B.add(g, mat, { pos: [hinge, 0, 0], rot: [0, -dir * open, 0] });
    }
  }
}

const leverSet = (L, w, mat) => {
  for (const sz of [-1, 1]) {
    L.add(cylGeo(0.08, 0.08, 0.03, 12).rotateX(PI / 2), mat, { pos: [w - 0.22, 3.3, sz * 0.09] });
    barZ(L, mat, 0.03, 0.14, w - 0.22, 3.3, sz * 0.15, 8);
    barX(L, mat, 0.028, 0.42, w - 0.4, 3.3, sz * 0.2, 8);
  }
};

function woodLeaf(L, w, h, mat, hardware, { glazed = false, panels = true } = {}) {
  rbox(L, mat, w - 0.04, h - 0.06, 0.15, w / 2, 0.04, 0, 0.012);
  if (glazed) {
    slab(L, M.clearGlass('#b9d3dc'), w * 0.5, h * 0.42, 0.16, w / 2, h * 0.48, 0);
    for (const sz of [-1, 1]) {
      slab(L, mat, w * 0.5 + 0.12, 0.06, 0.02, w / 2, h * 0.48 - 0.06, sz * 0.085);
      slab(L, mat, w * 0.5 + 0.12, 0.06, 0.02, w / 2, h * 0.9, sz * 0.085);
    }
  } else if (panels) {
    // Raised panels both sides: two over one.
    for (const sz of [-1, 1]) {
      rbox(L, mat, w - 0.7, h * 0.42, 0.03, w / 2, h * 0.5, sz * 0.08, 0.01);
      rbox(L, mat, w - 0.7, h * 0.3, 0.03, w / 2, 0.55, sz * 0.08, 0.01);
    }
  }
  leverSet(L, w, hardware);
  for (const y of [0.8, h / 2, h - 0.8]) slab(L, hardware, 0.03, 0.34, 0.17, 0.0, y - 0.17, 0);
}

function glassLeaf(L, w, h, fr) {
  const st = 0.22;
  slab(L, fr, st, h - 0.06, 0.14, st / 2, 0.04, 0);
  slab(L, fr, st, h - 0.06, 0.14, w - st / 2 - 0.02, 0.04, 0);
  slab(L, fr, w - 0.04, 0.3, 0.14, w / 2, h - 0.34, 0);
  slab(L, fr, w - 0.04, 0.8, 0.14, w / 2, 0.04, 0);
  slab(L, M.clearGlass('#b9d3dc'), w - st * 2, h - 1.2, 0.04, w / 2, 0.84, 0);
  for (const sz of [-1, 1]) {
    barX(L, chrome(), 0.03, w - 0.55, w / 2, 3.4, sz * 0.14, 8);
    for (const x of [0.35, w - 0.35]) barZ(L, chrome(), 0.022, 0.1, x, 3.4, sz * 0.1, 6);
  }
}

const DOOR_FINISH = [...WOODS, ['#eceae4', 'Painted white'], ['#5b6670', 'Painted grey'], ['#2f4a6b', 'Painted blue'], ['#7a3b3b', 'Painted red']];
const isPaint = (hex) => ['#eceae4', '#5b6670', '#2f4a6b', '#7a3b3b', '#f1efe9', '#2b2b2e'].includes(hex);
const doorMat = (hex) => (isPaint(hex) ? M.laminate(hex, 0.5) : M.grain(hex, 0.45));
const swing = (it) => (it.variant === 'closed' ? 0 : it.variant === 'ajar' ? 0.5 : 1.45);
const DOOR_VARIANTS = [['open', 'Open'], ['ajar', 'Ajar'], ['closed', 'Closed']];

register([
  ['doors', 'door', 'Timber door', '🚪', 3, 0.6, 7, { cut: { w: 3.3, h1: 7 }, colors: DOOR_FINISH, variants: DOOR_VARIANTS }],
  ['doors', 'doorvision', 'Door with vision panel', '🚪', 3, 0.6, 7, { cut: { w: 3.3, h1: 7 }, colors: DOOR_FINISH, variants: DOOR_VARIANTS }],
  ['doors', 'doordouble', 'Double timber doors', '🚪', 6, 0.6, 7, { cut: { w: 6.3, h1: 7 }, colors: DOOR_FINISH, variants: DOOR_VARIANTS }],
  ['doors', 'doorglass', 'Glass door', '🚪', 3, 0.6, 7, { cut: { w: 3.3, h1: 7.2 }, variants: DOOR_VARIANTS }],
  ['doors', 'doorglass2', 'Double glass doors', '🚪', 6, 0.6, 7, { cut: { w: 6.3, h1: 7.2 }, variants: DOOR_VARIANTS }],
  ['doors', 'doorsteel', 'Steel door with closer', '🚪', 3, 0.6, 7, { cut: { w: 3.3, h1: 7 }, colors: METALS, variants: DOOR_VARIANTS }],
  ['doors', 'doorslide', 'Sliding barn door', '🚪', 3.6, 0.8, 7.6, { cut: { w: 3.4, h1: 7 }, colors: DOOR_FINISH, variants: [['open', 'Slid open'], ['closed', 'Closed']] }],
  ['doors', 'doorswing', 'Kitchen swing doors', '🚪', 5, 0.6, 7, { cut: { w: 5.3, h1: 7 }, variants: DOOR_VARIANTS }],
  ['doors', 'opening', 'Cased opening', '⬜', 4, 0.6, 7, { cut: { w: 4.3, h1: 7 }, colors: DOOR_FINISH }],
  ['doors', 'openingwide', 'Wide opening', '⬜', 8, 0.6, 7.5, { cut: { w: 8.3, h1: 7.5 }, colors: DOOR_FINISH }],
  ['doors', 'archway', 'Archway', '⌒', 4.4, 0.6, 8, { cut: { w: 4.4, h1: 8 }, colors: DOOR_FINISH }],
  ['doors', 'doorroll', 'Roller shutter door', '🧱', 10, 0.8, 10.6, { cut: { w: 10.2, h1: 10 }, variants: [['open', 'Rolled up'], ['half', 'Half up'], ['closed', 'Down']] }],
  ['doors', 'stripcurtain', 'Strip curtain doorway', '〰️', 8, 0.5, 9.2, { cut: { w: 8.2, h1: 9 } }],
  ['doors', 'intwindow', 'Internal window', '🪟', 4, 0.5, 7, { cut: { w: 4.2, h0: 3, h1: 6.8 }, colors: DOOR_FINISH }],
  ['doors', 'intwindowwide', 'Wide internal window', '🪟', 8, 0.5, 7, { cut: { w: 8.2, h0: 3, h1: 6.8 }, colors: DOOR_FINISH }],
  ['doors', 'hatch', 'Serving hatch', '🍽️', 5, 1.6, 5.4, { cut: { w: 5.2, h0: 3.2, h1: 5.3 } }],
], {
  door(B, it, { w, h }) {
    const mat = doorMat(it.color || WOODS[0][0]);
    frame(B, isPaint(it.color) ? mat : M.grain(shadeHex(it.color || WOODS[0][0], 0.9), 0.5), w + 0.02, 6.86);
    leaf(B, -w / 2, 1, swing(it), (L) => woodLeaf(L, w, 6.82, mat, alu()));
  },
  doorvision(B, it, { w }) {
    const mat = doorMat(it.color || WOODS[0][0]);
    frame(B, isPaint(it.color) ? mat : M.grain(shadeHex(it.color || WOODS[0][0], 0.9), 0.5), w + 0.02, 6.86);
    leaf(B, -w / 2, 1, swing(it), (L) => woodLeaf(L, w, 6.82, mat, alu(), { glazed: true }));
  },
  doordouble(B, it, { w }) {
    const mat = doorMat(it.color || WOODS[0][0]);
    frame(B, isPaint(it.color) ? mat : M.grain(shadeHex(it.color || WOODS[0][0], 0.9), 0.5), w + 0.02, 6.86);
    leaf(B, -w / 2, 1, swing(it), (L) => woodLeaf(L, w / 2, 6.82, mat, alu()));
    leaf(B, w / 2, -1, swing(it), (L) => woodLeaf(L, w / 2, 6.82, mat, alu()));
  },
  doorglass(B, it, { w }) {
    frame(B, M.frame(true), w + 0.02, 7.06, 0.4, 0.16);
    leaf(B, -w / 2, 1, swing(it), (L) => glassLeaf(L, w, 7.02, M.frame(true)));
  },
  doorglass2(B, it, { w }) {
    frame(B, M.frame(true), w + 0.02, 7.06, 0.4, 0.16);
    leaf(B, -w / 2, 1, swing(it), (L) => glassLeaf(L, w / 2, 7.02, M.frame(true)));
    leaf(B, w / 2, -1, swing(it), (L) => glassLeaf(L, w / 2, 7.02, M.frame(true)));
  },
  doorsteel(B, it, { w }) {
    const mat = M.painted(it.color || '#8a8f96', 0.5);
    frame(B, M.painted(shadeHex(it.color || '#8a8f96', 0.8), 0.5), w + 0.02, 6.86, 0.5, 0.16);
    leaf(B, -w / 2, 1, swing(it), (L) => {
      slab(L, mat, w - 0.04, 6.76, 0.15, w / 2, 0.04, 0);
      slab(L, M.clearGlass('#b9d3dc'), 0.5, 2.1, 0.16, w - 0.75, 4, 0);
      for (const sz of [-1, 1]) slab(L, black(), 0.62, 2.22, 0.01, w - 0.75, 3.94, sz * 0.08);
      slab(L, M.clearGlass('#b9d3dc'), 0.5, 2.1, 0.17, w - 0.75, 4, 0);
      leverSet(L, w, alu());
      slab(L, M.stainless(0.35), w - 0.3, 0.8, 0.16, w / 2, 0.08, 0);          // kick plate
      slab(L, alu(), 0.9, 0.2, 0.22, w * 0.45, 6.5, 0.16);                      // closer body
      barX(L, alu(), 0.025, 1.2, w * 0.3, 6.72, 0.24, 6);
    });
  },
  doorslide(B, it, { w }) {
    const mat = doorMat(it.color || WOODS[1][0]);
    const off = it.variant === 'closed' ? 0 : w * 0.95;
    barX(B, black(), 0.05, w * 2.1, w * 0.5, 7.35, 0.42, 8);
    for (const x of [-w * 0.5, w * 0.5, w * 1.5]) slab(B, black(), 0.08, 0.2, 0.36, x, 7.25, 0.24);
    const dx = off;
    rbox(B, mat, w + 0.3, 7.05, 0.14, dx, 0.06, 0.42, 0.012);
    // Z-brace boards across the face.
    for (const y of [0.4, 6.4]) slab(B, mat, w + 0.3, 0.42, 0.04, dx, y, 0.51);
    B.box(mat, Math.hypot(w + 0.2, 5.6), 0.42, 0.04, dx, 3.6, 0.51, [0, 0, Math.atan2(5.6, w + 0.2)]);
    for (const sx of [-1, 1]) { slab(B, black(), 0.12, 0.7, 0.05, dx + sx * (w / 2 - 0.25), 6.75, 0.52); disc(B, black(), 0.16, 0.06, dx + sx * (w / 2 - 0.25), 7.3, 0.42, 14); }
    slab(B, black(), 0.06, 0.9, 0.12, dx - w / 2 + 0.2, 3.2, 0.56);
    slab(B, isPaint(it.color) ? mat : M.grain(shadeHex(it.color || WOODS[1][0], 0.9), 0.5), 0.14, 7, 0.5, -w / 2 + 0.05, 0, 0);
    slab(B, isPaint(it.color) ? mat : M.grain(shadeHex(it.color || WOODS[1][0], 0.9), 0.5), 0.14, 7, 0.5, w / 2 - 0.25, 0, 0);
  },
  doorswing(B, it, { w }) {
    frame(B, M.stainless(0.35), w + 0.02, 6.86, 0.5, 0.14);
    const make = (L) => {
      const lw = w / 2;
      slab(L, M.stainless(0.35), lw - 0.05, 6.7, 0.13, lw / 2, 0.06, 0);
      L.add(cylGeo(0.42, 0.42, 0.15, 24).rotateX(PI / 2), M.clearGlass('#b9d3dc'), { pos: [lw / 2, 5, 0] });
      for (const sz of [-1, 1]) L.add(new THREE.TorusGeometry(0.44, 0.035, 6, 24), black(), { pos: [lw / 2, 5, sz * 0.07] });
      slab(L, M.stainless(0.25), lw - 0.2, 1.1, 0.15, lw / 2, 0.1, 0);
      slab(L, M.stainless(0.25), lw - 0.2, 0.7, 0.15, lw / 2, 2.9, 0);
    };
    leaf(B, -w / 2, 1, swing(it) * 0.6, make);
    leaf(B, w / 2, -1, swing(it) * 0.6, make);
  },
  opening(B, it, { w }) {
    const mat = doorMat(it.color || '#eceae4');
    frame(B, mat, w + 0.02, 6.86);
  },
  openingwide(B, it, { w }) {
    frame(B, doorMat(it.color || '#eceae4'), w + 0.02, 7.36, 0.6, 0.16);
  },
  archway(B, it, { w }) {
    const mat = doorMat(it.color || '#eceae4');
    const r = w / 2;
    const spring = 8 - r;
    slab(B, mat, 0.16, spring, 0.6, -r - 0.08, 0, 0);
    slab(B, mat, 0.16, spring, 0.6, r + 0.08, 0, 0);
    // The arch: a half ring, and the spandrels that fill the square cut above it.
    const ring = new THREE.RingGeometry(r, r + 0.18, 24, 1, 0, PI);
    for (const sz of [-1, 1]) B.add(ring.clone(), M.laminate(it.color || '#eceae4', 0.5), { pos: [0, spring, sz * 0.31], rot: sz < 0 ? [0, PI, 0] : null });
    const sp = new THREE.Shape();
    sp.moveTo(-r - 0.02, spring); sp.lineTo(-r - 0.02, 8.02); sp.lineTo(r + 0.02, 8.02); sp.lineTo(r + 0.02, spring);
    sp.absarc(0, spring, r, 0, PI, false);
    B.extrude(M.wallPaint('#eceae4'), sp, 0.5, { pos: [0, 0, -0.25] });
    const soffit = new THREE.CylinderGeometry(r, r, 0.6, 24, 1, true, -PI / 2, PI).rotateX(PI / 2);
    B.add(soffit, M.fabric(it.color || '#eceae4'), { pos: [0, spring, 0] });
  },
  doorroll(B, it, { w, h }) {
    const steel = M.metal('#8a9299', 0.45);
    const up = it.variant === 'closed' ? 0 : it.variant === 'half' ? 0.5 : 0.94;
    slab(B, steel, 0.22, 10, 0.3, -w / 2 - 0.11, 0, 0.2);
    slab(B, steel, 0.22, 10, 0.3, w / 2 + 0.11, 0, 0.2);
    rbox(B, M.painted('#6f767d', 0.5), w + 0.6, 1.1, 1.0, 0, 10, 0.3, 0.1);
    const curtain = 10 * (1 - up);
    if (curtain > 0.2) {
      slab(B, M.doorPanel('#b9c0c7'), w, curtain, 0.06, 0, 10 - curtain, 0.2);
      slab(B, M.painted('#e7b416', 0.5), w, 0.22, 0.14, 0, 10 - curtain, 0.2);
    }
    void h;
  },
  stripcurtain(B, it, { w }) {
    slab(B, M.metal('#b9bfc4', 0.4), w + 0.3, 0.2, 0.2, 0, 9, 0);
    const pvc = M.clearGlass('#cfe6c9');
    const r = rng(seedOf(it) * 31 + 5);
    for (let x = -w / 2 + 0.33; x < w / 2; x += 0.6) slab(B, pvc, 0.66, 8.9, 0.02, x, 0.08, (r() - 0.5) * 0.12, [0, (r() - 0.5) * 0.2, 0]);
  },
  intwindow(B, it, { w }) { internalWindow(B, it, w); },
  intwindowwide(B, it, { w }) { internalWindow(B, it, w); },
  hatch(B, it, { w }) {
    const st = M.stainless(0.3);
    slab(B, st, w + 0.3, 0.08, 1.6, 0, 3.2, 0);
    slab(B, st, 0.1, 2.1, 0.5, -w / 2 - 0.05, 3.2, 0);
    slab(B, st, 0.1, 2.1, 0.5, w / 2 + 0.05, 3.2, 0);
    slab(B, st, w + 0.3, 0.1, 0.5, 0, 5.3, 0);
    // Heat lamps over the pass.
    slab(B, st, w * 0.8, 0.12, 0.3, 0, 5.0, 0.45);
    for (let x = -w * 0.3; x <= w * 0.31; x += w * 0.3) disc(B, M.glow('#ffb060', 1.6), 0.16, 0.03, x, 4.97, 0.45, 12);
  },
});

function internalWindow(B, it, w) {
  const mat = doorMat(it.color || '#eceae4');
  const t = 0.12;
  slab(B, mat, w + 0.24, t, 0.5, 0, 3 - t, 0);
  slab(B, mat, w + 0.24, t, 0.5, 0, 6.8, 0);
  slab(B, mat, t, 3.8 + t * 2, 0.5, -w / 2 - t / 2 - 0.06, 3 - t, 0);
  slab(B, mat, t, 3.8 + t * 2, 0.5, w / 2 + t / 2 + 0.06, 3 - t, 0);
  slab(B, M.clearGlass('#b9d3dc'), w + 0.1, 3.8, 0.04, 0, 3, 0);
  const n = Math.max(1, Math.round(w / 4));
  for (let i = 1; i < n; i++) slab(B, mat, 0.08, 3.8, 0.14, -w / 2 + (w * i) / n, 3, 0);
  slab(B, mat, w + 0.5, 0.06, 0.7, 0, 2.94 - t, 0);
}

/* --------------------------------------------------------------- lighting */

const WARM = '#fff3e0';
const lampGlow = (hex = '#fff6e6', k = 1.7) => M.glow(hex, k);
const light = (ctx, y, power, range = 34, angle = 78, color = WARM, x = 0, z = 0) => ctx.lights.push({ x, y, z, power, range, angle, color });
const SHADES = [['#f1efe9', 'White'], ['#2b2f36', 'Black'], ['#b0782f', 'Brass'], ['#c9ced3', 'Steel'], ['#8a3b3b', 'Red'], ['#2e5b7a', 'Blue'], ['#3f6b52', 'Green']];

register([
  ['lighting', 'troffer24', 'LED panel 2 × 4', '▭', 2, 4, 0.2, { ceil: true }],
  ['lighting', 'troffer22', 'LED panel 2 × 2', '◻️', 2, 2, 0.2, { ceil: true }],
  ['lighting', 'downlight', 'Recessed downlight', '⚪', 0.7, 0.7, 0.15, { ceil: true }],
  ['lighting', 'pendant', 'Pendant light', '💡', 1.4, 1.4, 3, { ceil: true, colors: SHADES }],
  ['lighting', 'pendantglobe', 'Globe pendant', '🔮', 1.2, 1.2, 3, { ceil: true }],
  ['lighting', 'linear', 'Suspended linear light', '➖', 4, 0.4, 1.6, { ceil: true, colors: SHADES }],
  ['lighting', 'highbay', 'High-bay light', '🛸', 1.6, 1.6, 2.4, { ceil: true }],
  ['lighting', 'strip8', 'Industrial strip light', '━', 8, 0.5, 1.2, { ceil: true }],
  ['lighting', 'chandelier', 'Chandelier', '✨', 3.2, 3.2, 3.6, { ceil: true }],
  ['lighting', 'track', 'Track spotlights', '🔦', 6, 0.5, 0.9, { ceil: true, colors: SHADES }],
  ['lighting', 'ceilingfan', 'Ceiling fan with light', '🌀', 4.6, 4.6, 1.5, { ceil: true, colors: WOODS }],
  ['lighting', 'exitsign', 'Exit sign', '🟩', 1.3, 0.2, 0.9, { ceil: true }],
  ['lighting', 'floorlamp', 'Floor lamp', '🪔', 1.4, 1.4, 5.4, { colors: SHADES }],
  ['lighting', 'arclamp', 'Arc floor lamp', '🌙', 1.4, 4.6, 6.4, {}],
  ['lighting', 'tablelamp', 'Table lamp', '🛋️', 1, 1, 1.9, { top: true, colors: SHADES }],
  ['lighting', 'desklamp', 'Desk lamp', '💡', 0.6, 1.2, 1.5, { top: true, colors: METALS }],
  ['lighting', 'sconce', 'Wall light', '🕯️', 0.6, 0.5, 1, { wall: true, mount: 5.6, colors: SHADES }],
], {
  troffer24(B, it, d, ctx) {
    slab(B, M.painted('#f6f6f3', 0.5), 2, 0.08, 4, 0, -0.06, 0);
    slab(B, lampGlow(), 1.76, 0.03, 3.76, 0, -0.085, 0);
    slab(B, M.painted('#f6f6f3', 0.5), 0.05, 0.04, 3.76, 0, -0.1, 0);
    light(ctx, -0.3, 700, 36);
  },
  troffer22(B, it, d, ctx) {
    slab(B, M.painted('#f6f6f3', 0.5), 2, 0.08, 2, 0, -0.06, 0);
    slab(B, lampGlow(), 1.76, 0.03, 1.76, 0, -0.085, 0);
    light(ctx, -0.3, 460, 30);
  },
  downlight(B, it, d, ctx) {
    disc(B, M.painted('#f6f6f3', 0.5), 0.32, 0.05, 0, -0.04, 0, 20);
    disc(B, lampGlow(), 0.24, 0.03, 0, -0.06, 0, 20);
    light(ctx, -0.2, 320, 26, 60);
  },
  pendant(B, it, d, ctx) {
    const mat = it.color === '#b0782f' ? M.alloy('#c9a24a', 0.3) : it.color === '#c9ced3' ? M.alloy('#c9ced3', 0.3) : M.painted(it.color || '#2b2f36', 0.45);
    post(B, black(), 0.012, 0.012, 2.2, 0, -2.2, 0, 6);
    disc(B, black(), 0.16, 0.06, 0, -0.06, 0, 14);
    // A spun metal dome, open underneath.
    lathe(B, mat, [[0.06, -2.2], [0.12, -2.24], [0.34, -2.5], [0.6, -2.85], [0.68, -3.0]], 0, 0, 0, 24);
    lathe(B, M.painted('#f6f4ee', 0.6), [[0.66, -3.0], [0.58, -2.86], [0.32, -2.52], [0.1, -2.3]], 0, 0, 0, 24);
    B.sphere(lampGlow('#fff0d4', 2.2), 0.13, 0, -2.72, 0, { seg: 10 });
    light(ctx, -3, 420, 26, 62);
  },
  pendantglobe(B, it, d, ctx) {
    post(B, alu(), 0.012, 0.012, 1.9, 0, -1.9, 0, 6);
    disc(B, alu(), 0.16, 0.06, 0, -0.06, 0, 14);
    disc(B, alu(), 0.1, 0.16, 0, -2.05, 0, 12);
    B.sphere(lampGlow('#fff4e2', 1.5), 0.5, 0, -2.5, 0, { seg: 18 });
    light(ctx, -2.6, 400, 30, 85);
  },
  linear(B, it, { w }, ctx) {
    const mat = M.painted(it.color || '#2b2f36', 0.45);
    for (const x of [-w * 0.4, w * 0.4]) post(B, alu(), 0.008, 0.008, 1.3, x, -1.3, 0, 5);
    rbox(B, mat, w, 0.24, 0.3, 0, -1.54, 0, 0.03);
    slab(B, lampGlow(), w - 0.12, 0.03, 0.22, 0, -1.565, 0);
    light(ctx, -1.7, 620, 32);
  },
  highbay(B, it, d, ctx) {
    post(B, black(), 0.02, 0.02, 1.6, 0, -1.6, 0, 6);
    B.add(new THREE.TorusGeometry(0.1, 0.02, 6, 12), black(), { pos: [0, -1.62, 0] });
    lathe(B, M.painted('#1b1d20', 0.5), [[0.2, -1.7], [0.3, -1.76], [0.76, -1.92], [0.8, -2.08], [0.74, -2.12]], 0, 0, 0, 24);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; slab(B, M.painted('#1b1d20', 0.5), 0.04, 0.14, 0.4, Math.cos(a) * 0.5, -1.92, Math.sin(a) * 0.5, [0, -a + PI / 2, 0]); }
    disc(B, lampGlow('#f4f8ff', 2.2), 0.7, 0.03, 0, -2.13, 0, 24);
    light(ctx, -2.3, 1500, 70, 80, '#f4f8ff');
  },
  strip8(B, it, { w }, ctx) {
    for (const x of [-w * 0.42, w * 0.42]) post(B, alu(), 0.008, 0.008, 0.9, x, -0.9, 0, 5);
    slab(B, M.painted('#f1f2f0', 0.5), w, 0.2, 0.42, 0, -1.1, 0);
    for (const sz of [-1, 1]) barX(B, lampGlow('#f6faff', 2), 0.05, w - 0.3, 0, -1.14, sz * 0.11, 8);
    light(ctx, -1.3, 1100, 55, 82, '#f6faff');
  },
  chandelier(B, it, d, ctx) {
    const brass = M.alloy('#c9a24a', 0.28);
    post(B, brass, 0.02, 0.02, 1.4, 0, -1.4, 0, 6);
    disc(B, brass, 0.2, 0.08, 0, -0.08, 0, 16);
    lathe(B, brass, [[0.05, -1.4], [0.16, -1.55], [0.1, -1.8], [0.2, -2.1], [0.08, -2.4], [0.03, -2.6]], 0, 0, 0, 16);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * PI * 2;
      const x = Math.cos(a) * 1.3;
      const z = Math.sin(a) * 1.3;
      B.tube(brass, [Math.cos(a) * 0.15, -2.1, Math.sin(a) * 0.15], [Math.cos(a) * 0.8, -2.45, Math.sin(a) * 0.8], 0.022, 6);
      B.tube(brass, [Math.cos(a) * 0.8, -2.45, Math.sin(a) * 0.8], [x, -2.2, z], 0.022, 6);
      disc(B, brass, 0.1, 0.03, x, -2.2, z, 10);
      post(B, M.painted('#f4f1e6', 0.6), 0.03, 0.03, 0.3, x, -2.17, z, 8);
      B.sphere(lampGlow('#ffe9c2', 2.4), 0.06, x, -1.82, z, { sy: 1.5, seg: 8 });
    }
    light(ctx, -2.2, 700, 40, 88, '#ffe9c2');
  },
  track(B, it, { w }, ctx) {
    const mat = M.painted(it.color || '#2b2f36', 0.45);
    slab(B, mat, w, 0.1, 0.14, 0, -0.1, 0);
    const n = Math.max(2, Math.round(w / 2));
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (w * (i + 0.5)) / n;
      const a = (i % 2 ? 1 : -1) * 0.5;
      post(B, mat, 0.03, 0.03, 0.22, x, -0.32, 0, 6);
      B.add(cylGeo(0.13, 0.16, 0.5, 12).rotateX(PI / 2 - 0.9), mat, { pos: [x, -0.5, a * 0.3] });
      B.add(cylGeo(0.14, 0.14, 0.02, 12).rotateX(PI / 2 - 0.9), lampGlow('#fff0d4', 2.4), { pos: [x, -0.66, a * 0.3 + 0.2] });
    }
    light(ctx, -0.6, 520, 30, 60);
  },
  ceilingfan(B, it, d, ctx) {
    const wood = M.grain(it.color || WOODS[1][0], 0.5);
    const body = M.alloy('#b9bfc4', 0.3);
    disc(B, body, 0.28, 0.1, 0, -0.1, 0, 16);
    post(B, body, 0.04, 0.04, 0.7, 0, -0.8, 0, 8);
    lathe(B, body, [[0.1, -0.8], [0.42, -0.9], [0.46, -1.1], [0.3, -1.22], [0.2, -1.24]], 0, 0, 0, 20);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * PI * 2;
      B.box(body, 0.5, 0.03, 0.14, Math.cos(a) * 0.62, -1.02, -Math.sin(a) * 0.62, [0, a, 0]);
      rbox(B, wood, 1.7, 0.04, 0.5, Math.cos(a) * 1.55, -1.06, -Math.sin(a) * 1.55, 0.015, [0.12, a, 0]);
    }
    lathe(B, lampGlow('#fff2da', 1.7), [[0.2, -1.24], [0.34, -1.3], [0.3, -1.46], [0.02, -1.52]], 0, 0, 0, 16);
    light(ctx, -1.6, 420, 30, 85);
  },
  exitsign(B) {
    for (const x of [-0.45, 0.45]) post(B, alu(), 0.012, 0.012, 0.3, x, -0.3, 0, 5);
    slab(B, M.painted('#f1f2f0', 0.5), 1.25, 0.6, 0.12, 0, -0.9, 0);
    const m = labelMat('EXIT', { color: '#ffffff', bg: '#1f9a4a', aspect: 2.2, glow: true });
    face(B, m, 1.15, 0.5, 0, -0.6, 0.065);
    face(B, m, 1.15, 0.5, 0, -0.6, -0.065, [0, PI, 0]);
  },
  floorlamp(B, it, d, ctx) {
    const mat = it.color === '#b0782f' ? M.alloy('#c9a24a', 0.3) : M.painted('#2b2f36', 0.45);
    disc(B, mat, 0.5, 0.06, 0, 0, 0, 20);
    post(B, mat, 0.035, 0.035, 4.5, 0, 0.06, 0, 8);
    lathe(B, M.fabric(it.color && it.color !== '#b0782f' ? it.color : '#f1efe9'), [[0.62, 4.3], [0.44, 5.3]], 0, 0, 0, 20);
    B.sphere(lampGlow('#ffe9c2', 2), 0.12, 0, 4.7, 0, { seg: 8 });
    ctx.lights.push({ x: 0, y: 4.3, z: 0, power: 260, range: 22, angle: 85, color: '#ffe2b8' });
  },
  arclamp(B, it, { d }, ctx) {
    const st = M.alloy('#c9ced3', 0.25);
    rbox(B, M.plastic('#e9e6df', 0.3), 1.1, 0.5, 1.1, 0, 0, -d / 2 + 0.7, 0.06);
    const pts = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([0, 0.5 + Math.sin(t * PI * 0.62) * 6.2, -d / 2 + 0.7 + t * 3.4]); }
    for (let i = 1; i < pts.length; i++) B.tube(st, pts[i - 1], pts[i], 0.04, 8);
    const e = pts[pts.length - 1];
    lathe(B, st, [[0.06, e[1] - 0.02], [0.5, e[1] - 0.5], [0.52, e[1] - 0.56]], 0, 0, e[2], 20);
    B.sphere(lampGlow('#ffe9c2', 2), 0.14, 0, e[1] - 0.42, e[2], { seg: 8 });
    ctx.lights.push({ x: 0, y: e[1] - 0.6, z: e[2], power: 300, range: 22, angle: 70, color: '#ffe2b8' });
  },
  tablelamp(B, it, d, ctx) {
    lathe(B, M.porcelain(it.color === '#2b2f36' ? '#2b2f36' : '#e9e2d0'), [[0.24, 0], [0.3, 0.06], [0.16, 0.4], [0.2, 0.7], [0.06, 0.95], [0.04, 1.2]], 0, 0, 0, 16);
    lathe(B, M.fabric(it.color && it.color !== '#2b2f36' ? it.color : '#f1efe9'), [[0.5, 1.1], [0.34, 1.85]], 0, 0, 0, 20);
    B.sphere(lampGlow('#ffe9c2', 2), 0.1, 0, 1.4, 0, { seg: 8 });
    ctx.lights.push({ x: 0, y: 1.1, z: 0, power: 160, range: 16, angle: 85, color: '#ffe2b8' });
  },
  desklamp(B, it, d, ctx) {
    const mat = M.painted(it.color || '#2b2f36', 0.4);
    disc(B, mat, 0.26, 0.05, 0, 0, -0.3, 16);
    B.tube(mat, [0, 0.05, -0.3], [0, 0.9, -0.42], 0.022, 6);
    B.tube(mat, [0, 0.9, -0.42], [0, 1.35, 0.25], 0.022, 6);
    B.add(cylGeo(0.09, 0.2, 0.3, 12).rotateX(-0.5), mat, { pos: [0, 1.3, 0.34] });
    B.add(cylGeo(0.17, 0.17, 0.02, 12).rotateX(-0.5), lampGlow('#fff0d4', 2), { pos: [0, 1.17, 0.41] });
    ctx.lights.push({ x: 0, y: 1.1, z: 0.4, power: 90, range: 10, angle: 60, color: '#fff0d4' });
  },
  sconce(B, it, d, ctx) {
    const y = 5.6;
    slab(B, it.color === '#b0782f' ? M.alloy('#c9a24a', 0.3) : M.painted(it.color || '#2b2f36', 0.45), 0.34, 0.7, 0.08, 0, y - 0.35, 0.04);
    lathe(B, M.fabric('#f4efe2'), [[0.2, y - 0.2], [0.26, y + 0.35]], 0, 0, 0.26, 14);
    B.sphere(lampGlow('#ffe9c2', 2), 0.08, 0, y + 0.05, 0.26, { seg: 8 });
    ctx.lights.push({ x: 0, y: y - 0.2, z: 0.4, power: 140, range: 16, angle: 85, color: '#ffe2b8' });
  },
});

/* ------------------------------------------------------------------ décor */

const RUG = [['#8a3b3b', 'Red'], ['#2f3b4d', 'Navy'], ['#c9c3b5', 'Cream'], ['#5d6670', 'Grey'], ['#3f6b52', 'Green'], ['#b0782f', 'Ochre'], ['#6d4a8a', 'Plum'], ['#2b2f36', 'Black']];
const POTS = [['#e9e6df', 'White'], ['#2b2f36', 'Black'], ['#b0623f', 'Terracotta'], ['#8a8f96', 'Concrete'], ['#2e5b7a', 'Blue']];

const rugs = new Map();
function rugMat(hex, seed) {
  const key = `${hex}|${seed % 4}`;
  if (rugs.has(key)) return rugs.get(key);
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  const base = new THREE.Color(hex);
  const pale = `#${base.clone().lerp(new THREE.Color('#f1ead8'), 0.75).getHexString()}`;
  const deep = `#${base.clone().multiplyScalar(0.55).getHexString()}`;
  g.fillStyle = hex;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = pale;
  const style = seed % 4;
  if (style === 0) {
    g.lineWidth = 10; g.strokeRect(14, 14, 228, 228);
    g.lineWidth = 3; g.strokeRect(34, 34, 188, 188);
    g.fillStyle = deep;
    g.beginPath(); g.moveTo(128, 60); g.lineTo(196, 128); g.lineTo(128, 196); g.lineTo(60, 128); g.fill();
    g.fillStyle = pale;
    g.beginPath(); g.moveTo(128, 92); g.lineTo(164, 128); g.lineTo(128, 164); g.lineTo(92, 128); g.fill();
  } else if (style === 1) {
    for (let y = 0; y < 256; y += 32) { g.fillStyle = (y / 32) % 2 ? deep : pale; g.fillRect(0, y + 10, 256, 8); }
  } else if (style === 2) {
    g.lineWidth = 4;
    for (let k = -256; k < 512; k += 36) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 256, 256); g.stroke(); g.beginPath(); g.moveTo(k + 256, 0); g.lineTo(k, 256); g.stroke(); }
  } else {
    g.fillStyle = deep;
    g.fillRect(0, 0, 256, 22); g.fillRect(0, 234, 256, 22);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = M.printFace(t, { rough: 0.95 });
  rugs.set(key, m);
  return m;
}

function rug(B, it, w, d) {
  const g = new THREE.PlaneGeometry(w, d).rotateX(-PI / 2);
  B.add(g, rugMat(it.color || RUG[0][0], seedOf(it)), { pos: [0, 0.035, 0] });
  slab(B, M.cloth(shadeHex(it.color || RUG[0][0], 0.7)), w, 0.03, d, 0, 0, 0);
}

function pot(B, hex, r, h, x = 0, z = 0) {
  const mat = hex === '#b0623f' ? M.plastic(hex, 0.85) : hex === '#8a8f96' ? M.concrete('#a9a8a2') : M.porcelain(hex);
  lathe(B, mat, [[r * 0.72, 0], [r * 0.78, h * 0.05], [r, h * 0.92], [r * 1.04, h], [r * 0.92, h], [r * 0.88, h * 0.9]], x, 0, z, 20);
  disc(B, M.plastic('#3b2a1c', 0.95), r * 0.88, 0.03, x, h * 0.86, z, 16);
}

const clocks = new Map();
function clockMat(seed) {
  const k = seed % 3;
  if (clocks.has(k)) return clocks.get(k);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f6f5f0';
  g.beginPath(); g.arc(128, 128, 126, 0, 6.3); g.fill();
  g.fillStyle = '#1a1a1a';
  for (let i = 0; i < 12; i++) { const a = (i / 12) * PI * 2; g.save(); g.translate(128 + Math.sin(a) * 104, 128 - Math.cos(a) * 104); g.rotate(a); g.fillRect(-3, -10, 6, i % 3 ? 14 : 22); g.restore(); }
  const hand = (a, len, w) => { g.save(); g.translate(128, 128); g.rotate(a); g.fillRect(-w / 2, -len, w, len + 12); g.restore(); };
  hand([1.0, 4.2, 2.6][k], 62, 8);
  hand([0.2, 2.0, 5.3][k], 92, 5);
  g.fillStyle = '#c0392b';
  g.beginPath(); g.arc(128, 128, 7, 0, 6.3); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = M.printFace(t, { rough: 0.5 });
  clocks.set(k, m);
  return m;
}

register([
  ['decor', 'plantfig', 'Fiddle-leaf fig', '🌳', 2.6, 2.6, 6.4, { colors: POTS }],
  ['decor', 'plantsnake', 'Snake plant', '🌿', 1.4, 1.4, 3.6, { colors: POTS }],
  ['decor', 'plantpalm', 'Indoor palm', '🌴', 3.4, 3.4, 6.8, { colors: POTS }],
  ['decor', 'plantmonstera', 'Monstera', '🪴', 2.6, 2.6, 3.8, { colors: POTS }],
  ['decor', 'plantsmall', 'Desk plant', '🌱', 0.6, 0.6, 0.9, { top: true, colors: POTS }],
  ['decor', 'planterbox', 'Planter box', '🪴', 5, 1.4, 3.4, { len: true, colors: [['#2b2f36', 'Black'], ['#e9e6df', 'White'], ['#a8743f', 'Timber'], ['#8a8f96', 'Concrete']] }],
  ['decor', 'arts', 'Framed print', '🖼️', 2, 0.2, 2.5, { wall: true, mount: 5, variants: [['abstract', 'Abstract'], ['landscape', 'Landscape'], ['poster', 'Poster']] }],
  ['decor', 'artl', 'Large canvas', '🖼️', 5, 0.2, 3.4, { wall: true, mount: 5.2, variants: [['abstract', 'Abstract'], ['landscape', 'Landscape'], ['poster', 'Poster']] }],
  ['decor', 'artset', 'Gallery set of three', '🖼️', 6.6, 0.2, 2.6, { wall: true, mount: 5.2 }],
  ['decor', 'clock', 'Wall clock', '🕙', 1.3, 0.2, 1.3, { wall: true, mount: 6.8 }],
  ['decor', 'mirror', 'Wall mirror', '🪞', 2.6, 0.2, 4, { wall: true, mount: 4.6, colors: WOODS }],
  ['decor', 'mirrorfloor', 'Standing mirror', '🪞', 2, 1.6, 5.8, { colors: WOODS }],
  ['decor', 'rugs', 'Rug 4 × 6', '🟥', 6, 4, 0.06, { colors: RUG, flat: true }],
  ['decor', 'rugm', 'Rug 6 × 9', '🟥', 9, 6, 0.06, { colors: RUG, flat: true }],
  ['decor', 'rugl', 'Rug 9 × 12', '🟥', 12, 9, 0.06, { colors: RUG, flat: true }],
  ['decor', 'rugrunner', 'Hall runner', '🟥', 10, 2.6, 0.06, { colors: RUG, flat: true, len: true }],
  ['decor', 'doormat', 'Entrance matting', '⬛', 6, 4, 0.06, { flat: true, len: true }],
  ['decor', 'curtains', 'Curtains', '🪟', 7, 0.5, 8, { wall: true, colors: FABRICS, len: true }],
  ['decor', 'blinds', 'Venetian blinds', '🪟', 5, 0.3, 5.5, { wall: true, mount: 4.6, len: true }],
  ['decor', 'tvwall', 'Wall TV', '📺', 4.8, 0.3, 2.8, { wall: true, mount: 5, variants: [['tv', 'Television'], ['chart', 'Dashboard'], ['menu', 'Menu'], ['arrivals', 'Arrivals board'], ['cctv', 'CCTV wall'], ['sheet', 'Spreadsheet']] }],
  ['decor', 'bin', 'Waste bin', '🗑️', 1, 1, 1.3, { colors: METALS }],
  ['decor', 'binstation', 'Recycling station', '♻️', 4.2, 1.5, 3.4, {}],
  ['decor', 'coatstand', 'Coat stand', '🧥', 1.6, 1.6, 5.8, { colors: WOODS }],
  ['decor', 'vase', 'Vase of flowers', '💐', 0.6, 0.6, 1.5, { top: true, colors: POTS }],
  ['decor', 'books', 'Stack of books', '📚', 0.8, 0.6, 0.5, { top: true }],
  ['decor', 'extinguisher', 'Fire extinguisher', '🧯', 0.7, 0.5, 2, { wall: true, mount: 3.4 }],
  ['decor', 'hosereel', 'Fire hose reel', '🧯', 2.2, 0.8, 2.2, { wall: true, mount: 4 }],
  ['decor', 'signwall', 'Wall sign', '🪧', 4, 0.15, 1.2, { wall: true, mount: 6.6, text: 'RECEPTION', len: true, colors: BRIGHTS }],
  ['decor', 'signhang', 'Hanging aisle sign', '🪧', 4, 0.2, 1.6, { ceil: true, text: 'AISLE 1', colors: BRIGHTS }],
  ['decor', 'wetfloor', 'Wet floor sign', '⚠️', 1, 1.2, 2.2, {}],
  ['decor', 'stanchion', 'Rope barrier', '➰', 6, 1, 3.2, { len: true, colors: [['#8a1f2b', 'Red rope'], ['#1f2f5a', 'Blue rope'], ['#2b2f36', 'Black belt']] }],
  ['decor', 'screen', 'Folding screen', '🪭', 5.4, 1, 5.6, { colors: WOODS }],
  ['decor', 'diffuser', 'Air diffuser', '▦', 2, 2, 0.15, { ceil: true }],
  ['decor', 'sprinkler', 'Sprinkler head', '🚿', 0.3, 0.3, 0.3, { ceil: true }],
  ['decor', 'smoke', 'Smoke detector', '⚪', 0.5, 0.5, 0.15, { ceil: true }],
  ['decor', 'speaker', 'Ceiling speaker', '🔈', 0.8, 0.8, 0.1, { ceil: true }],
  ['decor', 'camdome', 'Dome camera', '📹', 0.6, 0.6, 0.4, { ceil: true }],
  ['decor', 'pillar', 'Structural column', '🏛️', 1.4, 1.4, 12, { colors: [['#eceae4', 'Painted'], ['#a9a8a2', 'Concrete'], ['#e7b416', 'Safety yellow'], ['#5b6670', 'Grey steel']], variants: [['square', 'Square'], ['round', 'Round'], ['steel', 'Steel I-section']] }],
], {
  plantfig(B, it) {
    const r = rng(seedOf(it) * 17 + 3);
    pot(B, it.color || POTS[0][0], 0.72, 1.3);
    B.tube(M.bark('#5d4a36'), [0, 1.1, 0], [0.1, 3.4, 0.05], 0.07, 6);
    B.tube(M.bark('#5d4a36'), [0.1, 3.4, 0.05], [-0.15, 5.2, 0.1], 0.05, 6);
    const leafMat = M.foliageTone('#3d6b3a');
    for (let i = 0; i < 26; i++) {
      const t = 0.25 + r() * 0.75;
      const a = r() * PI * 2;
      const y = 1.6 + t * 4.4;
      const d = 0.35 + r() * 0.75;
      const g = new THREE.CircleGeometry(0.42 + r() * 0.2, 8);
      g.scale(0.7, 1.15, 1);
      B.add(g, leafMat, { pos: [Math.cos(a) * d, y, Math.sin(a) * d], rot: [-0.9 + r() * 0.5, -a + PI / 2, 0] });
    }
  },
  plantsnake(B, it) {
    const r = rng(seedOf(it) * 19 + 5);
    pot(B, it.color || POTS[1][0], 0.55, 1.1);
    fronds(B, r, 0, 0.95, 0, 2.7, { n: 12, spread: 0.22, width: 0.3, hex: '#3f6b46', droop: 0.02 });
    fronds(B, r, 0, 0.95, 0, 2.2, { n: 6, spread: 0.2, width: 0.28, hex: '#8aa64a', droop: 0.02 });
  },
  plantpalm(B, it) {
    const r = rng(seedOf(it) * 23 + 7);
    pot(B, it.color || POTS[0][0], 0.8, 1.4);
    for (let i = 0; i < 4; i++) B.tube(M.bark('#6b5a3c'), [(r() - 0.5) * 0.3, 1.2, (r() - 0.5) * 0.3], [(r() - 0.5) * 0.8, 3.4 + r(), (r() - 0.5) * 0.8], 0.045, 6);
    fronds(B, r, 0, 3.2, 0, 3.6, { n: 16, spread: 1.15, width: 0.75, hex: '#3d6f3c', droop: 0.75 });
    fronds(B, r, 0, 2.2, 0, 2.6, { n: 9, spread: 1.0, width: 0.6, hex: '#4a7d42', droop: 0.6 });
  },
  plantmonstera(B, it) {
    const r = rng(seedOf(it) * 29 + 9);
    pot(B, it.color || POTS[3][0], 0.75, 1.2);
    const leafMat = M.foliageTone('#2f6b3a');
    for (let i = 0; i < 14; i++) {
      const a = r() * PI * 2;
      const len = 1.2 + r() * 1.4;
      const tip = [Math.cos(a) * len * 0.75, 1.1 + len * (0.6 + r() * 0.5), Math.sin(a) * len * 0.75];
      B.tube(M.plastic('#4c6b34', 0.8), [Math.cos(a) * 0.2, 1.05, Math.sin(a) * 0.2], tip, 0.025, 5);
      const g = new THREE.CircleGeometry(0.5 + r() * 0.25, 9);
      g.scale(0.85, 1.05, 1);
      B.add(g, leafMat, { pos: tip, rot: [-1.1 + r() * 0.5, -a + PI / 2, 0] });
    }
  },
  plantsmall(B, it) {
    const r = rng(seedOf(it) * 31 + 11);
    pot(B, it.color || POTS[0][0], 0.22, 0.34);
    foliage(B, r, 0, 0.3, 0, 0.3, 0.6, { n: 6, hex: '#4a7d42' });
  },
  planterbox(B, it, { w, d }) {
    const r = rng(seedOf(it) * 37 + 13);
    const hex = it.color || '#2b2f36';
    const mat = hex === '#a8743f' ? M.grain(hex, 0.6) : hex === '#8a8f96' ? M.concrete('#a9a8a2') : M.laminate(hex, 0.5);
    rbox(B, mat, w, 2, d, 0, 0, 0, 0.03);
    slab(B, M.plastic('#3b2a1c', 0.95), w - 0.2, 0.04, d - 0.2, 0, 1.97, 0);
    for (let x = -w / 2 + 0.7; x < w / 2 - 0.3; x += 1.1) fronds(B, r, x, 1.95, (r() - 0.5) * 0.3, 1.5 + r() * 0.5, { n: 9, spread: 0.5, width: 0.3, hex: r() < 0.5 ? '#3f6b46' : '#4a7d42', droop: 0.3 });
  },
  arts(B, it, { w, h }) { picture(B, w, h, 0, 5, { seed: seedOf(it), kind: it.variant || 'abstract' }); },
  artl(B, it, { w, h }) { picture(B, w, h, 0, 5.2, { seed: seedOf(it) + 3, kind: it.variant || 'abstract', mount: false, frame: '#3b2a1c' }); },
  artset(B, it) { for (let i = 0; i < 3; i++) picture(B, 2, 2.6, (i - 1) * 2.3, 5.2, { seed: seedOf(it) + i * 5, kind: i === 1 ? 'landscape' : 'abstract' }); },
  clock(B, it) {
    B.add(cylGeo(0.65, 0.65, 0.12, 28).rotateX(PI / 2), M.painted('#22262b', 0.4), { pos: [0, 6.8, 0.06] });
    B.add(new THREE.CircleGeometry(0.58, 28), clockMat(seedOf(it)), { pos: [0, 6.8, 0.125] });
  },
  mirror(B, it, { w, h }) {
    const fm = M.grain(it.color || WOODS[1][0], 0.5);
    rbox(B, fm, w, h, 0.12, 0, 4.6 - h / 2, 0.06, 0.02);
    slab(B, M.mirror(), w - 0.3, h - 0.3, 0.02, 0, 4.6 - h / 2 + 0.15, 0.125);
  },
  mirrorfloor(B, it, { w, h }) {
    const fm = M.grain(it.color || WOODS[0][0], 0.5);
    B.box(fm, w, h, 0.12, 0, h / 2 + 0.05, 0.1, [-0.14, 0, 0]);
    B.box(M.mirror(), w - 0.25, h - 0.25, 0.02, 0, h / 2 + 0.05, 0.18, [-0.14, 0, 0]);
    B.tube(fm, [0, h * 0.75, -0.25], [0, 0.03, -0.75], 0.035, 6);
  },
  rugs(B, it, { w, d }) { rug(B, it, w, d); },
  rugm(B, it, { w, d }) { rug(B, it, w, d); },
  rugl(B, it, { w, d }) { rug(B, it, w, d); },
  rugrunner(B, it, { w, d }) { rug(B, { ...it, seed: 3 }, w, d); },
  doormat(B, it, { w, d }) {
    slab(B, M.plastic('#2b2f36', 0.95), w, 0.04, d, 0, 0, 0);
    slab(B, M.cloth('#4a4f57'), w - 0.3, 0.03, d - 0.3, 0, 0.03, 0);
  },
  curtains(B, it, { w, h }) {
    const cloth = M.fabric(it.color || FABRICS[5][0]);
    barX(B, M.alloy('#8a7a5a', 0.35), 0.035, w + 0.5, 0, h - 0.2, 0.3, 8);
    for (const sx of [-1, 1]) {
      B.sphere(M.alloy('#8a7a5a', 0.35), 0.07, sx * (w / 2 + 0.28), h - 0.2, 0.3, { seg: 8 });
      // Each drape gathered to its side in soft pleats.
      const cw = Math.min(w * 0.28, 2.2);
      const x0 = sx * (w / 2 - cw / 2);
      const n = 9;
      for (let i = 0; i < n; i++) {
        const a = x0 - cw / 2 + (cw * i) / n;
        const b2 = x0 - cw / 2 + (cw * (i + 1)) / n;
        const o0 = i % 2 ? 0.38 : 0.22;
        const o1 = i % 2 ? 0.22 : 0.38;
        B.quad(cloth, [a, 0.08, o0], [b2, 0.08, o1], [b2, h - 0.22, o1], [a, h - 0.22, o0]);
      }
    }
  },
  blinds(B, it, { w, h }) {
    const y1 = 4.6 + h / 2;
    slab(B, M.painted('#f1f2f0', 0.5), w, 0.14, 0.16, 0, y1 - 0.14, 0.1);
    const slat = M.painted('#eceae4', 0.55);
    for (let y = y1 - 0.24; y > y1 - h; y -= 0.17) B.box(slat, w - 0.08, 0.012, 0.14, 0, y, 0.1, [0.55, 0, 0]);
    slab(B, M.painted('#f1f2f0', 0.5), w, 0.08, 0.14, 0, y1 - h - 0.04, 0.1);
  },
  tvwall(B, it, { w, h }) {
    rbox(B, M.pianoBlack(), w, h, 0.12, 0, 5 - h / 2, 0.1, 0.02);
    face(B, screenMat(it.variant || 'tv', seedOf(it)), w - 0.12, h - 0.12, 0, 5, 0.165);
    slab(B, black(), 1, 0.8, 0.06, 0, 4.6, 0.03);
  },
  bin(B, it) {
    lathe(B, M.painted(it.color || METALS[0][0], 0.5), [[0.36, 0], [0.38, 0.03], [0.46, 1.26], [0.48, 1.3], [0.44, 1.3], [0.42, 1.24]], 0, 0, 0, 18);
    disc(B, M.plastic('#17191c', 0.9), 0.42, 0.02, 0, 0.9, 0, 14);
  },
  binstation(B) {
    const cols = [['#2b2f36', 'WASTE'], ['#1f4f9c', 'RECYCLE'], ['#1f7a54', 'COMPOST']];
    cols.forEach(([hex, text], i) => {
      const x = (i - 1) * 1.4;
      rbox(B, M.stainless(0.35), 1.3, 3, 1.4, x, 0, 0, 0.04);
      slab(B, M.painted(hex, 0.5), 1.3, 0.5, 0.02, x, 2.4, 0.71);
      face(B, labelMat(text, { bg: hex, aspect: 3.2 }), 1.2, 0.36, x, 2.65, 0.725);
      slab(B, M.plastic('#0e0f10', 0.9), 0.8, 0.3, 0.03, x, 1.9, 0.705);
    });
  },
  coatstand(B, it) {
    const wood = M.grain(it.color || WOODS[1][0], 0.5);
    post(B, wood, 0.05, 0.07, 5.6, 0, 0.05, 0, 10);
    for (let i = 0; i < 3; i++) { const a = (i / 3) * PI * 2; B.tube(wood, [0, 0.5, 0], [Math.cos(a) * 0.75, 0.03, Math.sin(a) * 0.75], 0.04, 6); }
    for (let i = 0; i < 6; i++) { const a = (i / 6) * PI * 2; B.tube(wood, [0, 5.0 + (i % 2) * 0.4, 0], [Math.cos(a) * 0.5, 5.4 + (i % 2) * 0.4, Math.sin(a) * 0.5], 0.03, 6); }
    B.sphere(wood, 0.09, 0, 5.7, 0, { seg: 10 });
    // A coat left on it.
    rbox(B, M.cloth('#3b3b3f'), 0.9, 2.6, 0.5, 0.38, 2.7, 0.1, 0.18);
  },
  vase(B, it) {
    const r = rng(seedOf(it) * 41 + 3);
    lathe(B, M.porcelain(it.color || POTS[4][0]), [[0.12, 0], [0.2, 0.1], [0.24, 0.35], [0.12, 0.62], [0.14, 0.72]], 0, 0, 0, 16);
    for (let i = 0; i < 7; i++) {
      const a = r() * PI * 2;
      const tip = [Math.cos(a) * (0.1 + r() * 0.25), 1.1 + r() * 0.4, Math.sin(a) * (0.1 + r() * 0.25)];
      B.tube(M.plastic('#4c6b34', 0.8), [0, 0.6, 0], tip, 0.012, 4);
      B.sphere(M.plastic(['#c8241b', '#f0c33a', '#e96a9a', '#f4f1e6', '#8a5bd0'][Math.floor(r() * 5)], 0.6), 0.09, tip[0], tip[1], tip[2], { seg: 8 });
    }
  },
  books(B, it) {
    const r = rng(seedOf(it) * 43 + 5);
    let y = 0;
    for (let i = 0; i < 4; i++) {
      const hgt = 0.09 + r() * 0.07;
      rbox(B, M.laminate(['#7a1f2b', '#1f4f9c', '#2e6b3a', '#3b2a1c', '#c9a23a', '#2b2f36'][Math.floor(r() * 6)], 0.7), 0.72 - r() * 0.12, hgt, 0.5 - r() * 0.06, (r() - 0.5) * 0.05, y, (r() - 0.5) * 0.05, 0.012, [0, (r() - 0.5) * 0.3, 0]);
      y += hgt;
    }
  },
  extinguisher(B) {
    const red = M.painted('#c8241b', 0.35);
    lathe(B, red, [[0.02, 2.5], [0.2, 2.56], [0.21, 3.7], [0.14, 3.86], [0.06, 3.9]], 0, 0, 0.26, 14);
    post(B, black(), 0.05, 0.05, 0.16, 0, 3.9, 0.26, 8);
    slab(B, black(), 0.3, 0.05, 0.08, 0.08, 4.04, 0.26);
    B.tube(black(), [0, 4.0, 0.3], [-0.2, 3.3, 0.4], 0.025, 5);
    slab(B, M.laminate('#f4f4f0', 0.6), 0.3, 0.36, 0.01, 0, 3.0, 0.475);
    slab(B, M.painted('#c8241b', 0.5), 0.5, 0.5, 0.02, 0, 4.6, 0.01);
    face(B, labelMat('FIRE', { bg: '#c8241b', aspect: 1.6 }), 0.44, 0.28, 0, 4.85, 0.022);
  },
  hosereel(B) {
    const red = M.painted('#c8241b', 0.4);
    B.add(cylGeo(1, 1, 0.5, 28).rotateX(PI / 2), red, { pos: [0, 4, 0.4] });
    B.add(new THREE.TorusGeometry(0.72, 0.2, 8, 28), M.plastic('#17191c', 0.8), { pos: [0, 4, 0.4] });
    B.add(cylGeo(0.3, 0.3, 0.56, 16).rotateX(PI / 2), M.painted('#f4f4f0', 0.5), { pos: [0, 4, 0.42] });
    slab(B, red, 0.4, 1.4, 0.12, 0, 3.3, 0.06);
    B.tube(M.plastic('#17191c', 0.8), [0.9, 3.6, 0.5], [1.0, 3.0, 0.55], 0.06, 6);
    post(B, M.alloy('#c9a24a', 0.3), 0.04, 0.06, 0.3, 1.0, 2.7, 0.55, 8);
  },
  signwall(B, it, { w, h }) {
    const bg = it.color || '#1f4f9c';
    slab(B, M.painted(shadeHex(bg, 0.8), 0.5), w, h, 0.08, 0, 6.6 - h / 2, 0.04);
    face(B, labelMat(it.text || 'RECEPTION', { bg, aspect: (w - 0.1) / (h - 0.1) }), w - 0.1, h - 0.1, 0, 6.6, 0.085);
  },
  signhang(B, it, { w, h }) {
    const bg = it.color || '#1f4f9c';
    for (const x of [-w * 0.4, w * 0.4]) post(B, alu(), 0.01, 0.01, 0.5, x, -0.5, 0, 5);
    slab(B, M.painted(shadeHex(bg, 0.8), 0.5), w, h - 0.5, 0.08, 0, -h, 0);
    const m = labelMat(it.text || 'AISLE 1', { bg, aspect: (w - 0.1) / (h - 0.6) });
    face(B, m, w - 0.1, h - 0.6, 0, -h + (h - 0.5) / 2, 0.045);
    face(B, m, w - 0.1, h - 0.6, 0, -h + (h - 0.5) / 2, -0.045, [0, PI, 0]);
  },
  wetfloor(B) {
    const y = M.plastic('#f2c318', 0.45);
    const m = labelMat('CAUTION|WET FLOOR', { color: '#1a1a1a', bg: '#f2c318', aspect: 0.62 });
    for (const sz of [-1, 1]) {
      B.box(y, 0.95, 2.2, 0.05, 0, 1.08, sz * 0.26, [-sz * 0.24, 0, 0]);
      B.add(new THREE.PlaneGeometry(0.8, 1.3), m, { pos: [0, 1.25, sz * 0.27], rot: sz > 0 ? [-0.24, 0, 0] : [0.24, PI, 0] });
    }
  },
  stanchion(B, it, { w }) {
    const belt = it.color === '#2b2f36';
    const st = belt ? M.painted('#22262b', 0.4) : M.alloy('#c9a24a', 0.25);
    const n = Math.max(2, Math.round(w / 5) + 1);
    const xs = Array.from({ length: n }, (_, i) => -w / 2 + 0.5 + ((w - 1) * i) / (n - 1));
    for (const x of xs) {
      lathe(B, st, [[0.5, 0], [0.5, 0.06], [0.1, 0.16], [0.06, 0.2]], x, 0, 0, 20);
      post(B, st, 0.06, 0.06, 2.9, x, 0.18, 0, 12);
      lathe(B, st, [[0.06, 3.05], [0.13, 3.1], [0.13, 3.2], [0.03, 3.28]], x, 0, 0, 14);
    }
    for (let i = 1; i < xs.length; i++) {
      const a = xs[i - 1];
      const b2 = xs[i];
      if (belt) slab(B, M.fabric('#22262b'), b2 - a, 0.16, 0.012, (a + b2) / 2, 2.9, 0);
      else {
        // A velvet rope sagging between the posts.
        let prev = [a, 3.0, 0];
        for (let k = 1; k <= 8; k++) { const t = k / 8; const p = [a + (b2 - a) * t, 3.0 - Math.sin(t * PI) * 0.55, 0]; B.tube(M.cloth(it.color || '#8a1f2b'), prev, p, 0.05, 6); prev = p; }
      }
    }
  },
  screen(B, it, { w, h }) {
    const wood = M.grain(it.color || WOODS[1][0], 0.5);
    const pw = w / 3;
    for (let i = 0; i < 3; i++) {
      const ang = (i % 2 ? -1 : 1) * 0.35;
      const x = -w / 2 + pw * (i + 0.5);
      for (const sx of [-1, 1]) B.box(wood, 0.1, h, 0.1, x + sx * (pw / 2 - 0.05) * Math.cos(ang), h / 2, -sx * (pw / 2 - 0.05) * Math.sin(ang));
      B.box(wood, pw, 0.1, 0.1, x, h - 0.05, 0, [0, ang, 0]);
      B.box(wood, pw, 0.1, 0.1, x, 0.35, 0, [0, ang, 0]);
      B.box(M.fabric('#eee6d2'), pw - 0.14, h - 0.5, 0.02, x, h / 2 + 0.15, 0, [0, ang, 0]);
    }
  },
  diffuser(B) {
    slab(B, M.painted('#f6f6f3', 0.5), 2, 0.05, 2, 0, -0.05, 0);
    for (const k of [0.8, 0.56, 0.32]) slab(B, M.painted('#e2e2de', 0.5), 2 * k, 0.03, 2 * k, 0, -0.06 - (0.9 - k) * 0.06, 0);
  },
  sprinkler(B) {
    post(B, M.alloy('#c9ced3', 0.3), 0.04, 0.04, 0.16, 0, -0.16, 0, 8);
    disc(B, M.alloy('#c9ced3', 0.3), 0.12, 0.015, 0, -0.2, 0, 12);
    disc(B, M.painted('#f6f6f3', 0.5), 0.14, 0.02, 0, -0.02, 0, 12);
    slab(B, M.painted('#c8241b', 0.4), 0.03, 0.08, 0.03, 0, -0.14, 0.05);
  },
  smoke(B) {
    lathe(B, M.plastic('#f6f6f3', 0.5), [[0.24, 0], [0.24, -0.06], [0.18, -0.13], [0.02, -0.15]], 0, 0, 0, 18);
    B.sphere(M.signal('#39d353', 1.5), 0.012, 0.12, -0.1, 0, { seg: 6 });
  },
  speaker(B) {
    disc(B, M.painted('#f6f6f3', 0.5), 0.4, 0.03, 0, -0.03, 0, 22);
    disc(B, M.plastic('#d9d9d6', 0.9), 0.33, 0.012, 0, -0.04, 0, 22);
  },
  camdome(B) {
    disc(B, M.painted('#f6f6f3', 0.5), 0.3, 0.1, 0, -0.1, 0, 18);
    B.add(new THREE.SphereGeometry(0.24, 16, 8, 0, PI * 2, PI / 2, PI / 2), M.vehicleGlass(), { pos: [0, -0.1, 0] });
  },
  pillar(B, it, { w, h }) {
    const hex = it.color || '#eceae4';
    const mat = hex === '#a9a8a2' ? M.concrete('#a9a8a2') : hex === '#eceae4' ? M.wallPaint(hex) : M.painted(hex, 0.6);
    if (it.variant === 'round') post(B, mat, w / 2, w / 2, h, 0, 0, 0, 24);
    else if (it.variant === 'steel') {
      slab(B, mat, 0.07, h, w * 0.8, 0, 0, 0);
      for (const sz of [-1, 1]) slab(B, mat, w * 0.8, h, 0.07, 0, 0, sz * w * 0.4);
      slab(B, M.concrete('#a9a8a2'), w * 1.2, 0.12, w * 1.2, 0, 0, 0);
    } else slab(B, mat, w, h, w, 0, 0, 0);
  },
});

/* ---------------------------------------------------------------- people */

const SIT = ['sit', 'type', 'read', 'eat', 'lounge', 'stool'];
const STAND = ['stand', 'relaxed', 'talk', 'phone', 'text', 'hips', 'crossed', 'point', 'wave', 'carry', 'clipboard', 'counter', 'lean', 'reach', 'kneel', 'crouch', 'push'];
const person = (id, name, icon, role, pose = 'stand', h = 5.9) => ['people', id, name, icon, 2, 1.8, h, { person: role, pose, poses: [...STAND, ...SIT, 'lie', 'run', 'lift'], seeded: true }];

register([
  person('pvisitor', 'Visitor', '🧍', 'visitor'),
  person('pshopper', 'Shopper', '🛍️', 'shopper'),
  person('poffice', 'Office worker', '🧑‍💼', 'office'),
  person('pofficesit', 'Office worker, seated', '🧑‍💻', 'office', 'type', 4.4),
  person('pseated', 'Seated visitor', '🪑', 'visitor', 'sit', 4.4),
  person('pdiner', 'Diner', '🍴', 'visitor', 'eat', 4.4),
  person('pstudent', 'Student', '🎒', 'student'),
  person('pstudentsit', 'Student, seated', '📖', 'student', 'read', 4.4),
  person('pchild', 'Child', '🧒', 'child', 'stand', 4.4),
  person('pteacher', 'Teacher', '🧑‍🏫', 'teacher', 'point'),
  person('pclerk', 'Shop assistant', '🏷️', 'clerk', 'counter'),
  person('pchef', 'Chef', '🧑‍🍳', 'chef', 'counter', 6.4),
  person('pserver', 'Waiter', '🍽️', 'server', 'carry'),
  person('pmedic', 'Nurse', '🩺', 'medic', 'clipboard'),
  person('pdoctor', 'Doctor', '🥼', 'doctor', 'talk'),
  person('ppatient', 'Patient in bed', '🛌', 'visitor', 'lie', 2),
  person('pmechanic', 'Mechanic', '🔧', 'mechanic', 'reach'),
  person('pworker', 'Warehouse operative', '🦺', 'worker', 'carry'),
  person('pguard', 'Security guard', '💂', 'guard', 'hips'),
  person('pathlete', 'Gym member', '🏃', 'athlete', 'run'),
], {});

export { SIT, STAND };
void [FABRICS, LAMINATES, cushion, legs, handle];
