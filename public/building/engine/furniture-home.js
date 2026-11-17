/* Furniture for homes: living rooms, bedrooms, kitchens and bathrooms. */

import { register } from './furniture.js';
import {
  PI, WOODS, FABRICS, LEATHERS, LAMINATES, BRIGHTS,
  rbox, slab, cushion, post, disc, barX, barZ, lathe, legs, handle, cabinet, stock,
  face, labelMat, screenMat, artMat, picture, foliage, shadeHex, rng, cylGeo, THREE, M,
} from './furnkit.js';
import { TABLE_H, COUNTER_H, shelfRun } from './furniture-work.js';

const seedOf = (it) => it.seed || 1;
const blackPl = (r = 0.5) => M.plastic('#2b2f36', r);
const wood = (it, i = 0) => M.grain(it.color || WOODS[i][0], 0.45);
const lam = (it, i = 0) => M.laminate(it.color || LAMINATES[i][0], 0.42);

const STONE = [['#2b2f36', 'Black granite'], ['#e9e6df', 'White quartz'], ['#8a8f96', 'Grey stone'], ['#c9b89a', 'Beech'], ['#3b2a1c', 'Walnut']];
const worktop = (hex) => (hex === '#c9b89a' || hex === '#3b2a1c' ? M.grain(hex, 0.4) : M.laminate(hex, 0.22));

/* ======================================================================= */
/*                                 LIVING                                   */
/* ======================================================================= */

/** Scatter cushions along the back of a seat. */
function scatter(B, r, n, x0, x1, y, z, lean) {
  for (let i = 0; i < n; i++) {
    const hex = FABRICS[Math.floor(r() * FABRICS.length)][0];
    const s = 1.2 + r() * 0.35;
    cushion(B, M.cloth(hex), s, 0.32, s, x0 + ((x1 - x0) * (i + 0.5)) / n, y, z, { rot: [lean, (r() - 0.5) * 0.4, (r() - 0.5) * 0.3], puff: 0.28 });
  }
}

/** A sofa: base, seat cushions, back, arms and feet. */
function sofa(B, it, w, d, h, { seats = 3, chaise = 0, corner = 0 } = {}) {
  const r = rng(seedOf(it) * 373 + 1);
  const fab = it.variant === 'leather' ? M.leather(it.color || LEATHERS[1][0]) : M.cloth(it.color || FABRICS[0][0]);
  const armW = 0.75;
  const bodyD = d - (chaise ? 0 : 0);
  slab(B, fab, w - armW * 2, 1.05, bodyD - 0.3, 0, 0.45, 0.1);
  const inner = w - armW * 2 - 0.1;
  for (let i = 0; i < seats; i++) {
    cushion(B, fab, inner / seats - 0.08, 0.5, bodyD - 0.9, -inner / 2 + (inner / seats) * (i + 0.5), 1.5, 0.25, { puff: 0.2 });
    cushion(B, fab, inner / seats - 0.08, h - 2.05, 0.72, -inner / 2 + (inner / seats) * (i + 0.5), 2, -bodyD / 2 + 0.5, { rot: [0.1, 0, 0], puff: 0.16 });
  }
  for (const sx of [-1, 1]) {
    if (corner && sx < 0) continue;
    cushion(B, fab, armW, 1.6, bodyD, sx * (w / 2 - armW / 2), 0.45, 0, { puff: 0.1, r: 0.3 });
  }
  if (corner) {
    // An L: the return runs back along -x.
    slab(B, fab, corner, 1.05, d - 0.3, -w / 2 + corner / 2, 0.45, -d - (corner ? 0 : 0) / 2 + 0.1);
  }
  scatter(B, r, Math.max(2, seats - 1), -inner / 2 + 0.7, inner / 2 - 0.7, 1.95, -bodyD / 2 + 0.95, 0.3);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) post(B, M.grain('#5b3a26', 0.4), 0.09, 0.07, 0.45, sx * (w / 2 - 0.5), 0, sz * (bodyD / 2 - 0.45), 8);
}

const LIVING = [
  ['living', 'sofa3', 'Three-seat sofa', '🛋️', 7.4, 3.4, 2.9, { colors: FABRICS, variants: [['fabric', 'Fabric'], ['leather', 'Leather']] }],
  ['living', 'sofa2', 'Two-seat sofa', '🛋️', 5.4, 3.3, 2.9, { colors: FABRICS, variants: [['fabric', 'Fabric'], ['leather', 'Leather']] }],
  ['living', 'sofacorner', 'Corner sofa', '🛋️', 9, 7, 2.9, { colors: FABRICS, variants: [['fabric', 'Fabric'], ['leather', 'Leather']] }],
  ['living', 'recliner', 'Recliner', '💺', 3.4, 3.6, 3.4, { colors: LEATHERS }],
  ['living', 'footstool', 'Footstool', '🟫', 2.4, 2, 1.4, { colors: FABRICS, surface: 1.4 }],
  ['living', 'tvunit', 'TV unit', '📺', 6, 1.6, 1.8, { colors: WOODS, len: true, surface: 1.8 }],
  ['living', 'tvstand', 'Television', '📺', 4.6, 1, 3, { top: true, variants: [['tv', 'Film'], ['chart', 'Dashboard'], ['menu', 'Menu'], ['desktop', 'Desktop']] }],
  ['living', 'shelfhome', 'Shelving unit', '🗄️', 5, 1.3, 6, { colors: WOODS, len: true }],
  ['living', 'sideboard', 'Sideboard', '🪟', 5.4, 1.6, 2.6, { colors: WOODS, len: true, surface: 2.6 }],
  ['living', 'piano', 'Upright piano', '🎹', 5, 2.2, 4.2, { colors: [['#2b2b2e', 'Black'], ['#7a4f2c', 'Walnut'], ['#f1efe9', 'White']] }],
  ['living', 'fireplace', 'Fireplace', '🔥', 5, 1.4, 4, { wall: true, mount: 0, colors: [['#e9e6df', 'Limestone'], ['#2b2f36', 'Slate'], ['#9c5b47', 'Brick']] }],
  ['living', 'diningset', 'Dining table and chairs', '🍽️', 7, 4.4, 3, { colors: WOODS }],
  ['living', 'barcart', 'Drinks trolley', '🍸', 2.8, 1.6, 2.8, {}],
];

const LIVING_B = {
  sofa3: (B, it, { w, d, h }) => sofa(B, it, w, d, h, { seats: 3 }),
  sofa2: (B, it, { w, d, h }) => sofa(B, it, w, d, h, { seats: 2 }),
  sofacorner(B, it, { w, d, h }) {
    const r = rng(seedOf(it) * 379 + 2);
    const fab = it.variant === 'leather' ? M.leather(it.color || LEATHERS[1][0]) : M.cloth(it.color || FABRICS[0][0]);
    const run = 3.4;                       // depth of each arm of the L
    // The long run across the front.
    slab(B, fab, w, 1.05, run - 0.3, 0, 0.45, d / 2 - run / 2 + 0.1);
    for (let i = 0; i < 3; i++) {
      const x = -w / 2 + 0.9 + i * ((w - 1.8) / 3) + ((w - 1.8) / 3) * 0;
      cushion(B, fab, (w - 1.9) / 3 - 0.08, 0.5, run - 0.9, x + ((w - 1.8) / 3) / 2 - 0.45, 1.5, d / 2 - run / 2 + 0.25, { puff: 0.2 });
      cushion(B, fab, (w - 1.9) / 3 - 0.08, h - 2.05, 0.72, x + ((w - 1.8) / 3) / 2 - 0.45, 2, d / 2 - run + 0.5, { rot: [0.1, 0, 0], puff: 0.16 });
    }
    // The return going back on the left.
    const retD = d - run;
    slab(B, fab, run - 0.3, 1.05, retD, -w / 2 + run / 2 + 0.1, 0.45, -run / 2);
    for (let i = 0; i < 2; i++) {
      const z = -d / 2 + (retD / 2) * (i + 0.5);
      cushion(B, fab, run - 0.9, 0.5, retD / 2 - 0.1, -w / 2 + run / 2 + 0.25, 1.5, z, { puff: 0.2 });
      cushion(B, fab, 0.72, h - 2.05, retD / 2 - 0.1, -w / 2 + 0.5, 2, z, { rot: [0, 0, -0.1], puff: 0.16 });
    }
    cushion(B, fab, 0.75, 1.6, run, w / 2 - 0.38, 0.45, d / 2 - run / 2, { puff: 0.1, r: 0.3 });
    cushion(B, fab, run, 1.6, 0.75, -w / 2 + run / 2, 0.45, -d / 2 + 0.38, { puff: 0.1, r: 0.3 });
    scatter(B, r, 3, -w / 2 + 2, w / 2 - 1.2, 1.95, d / 2 - run + 0.95, 0.3);
    for (const [px, pz] of [[w / 2 - 0.5, d / 2 - 0.5], [-w / 2 + 0.5, d / 2 - 0.5], [-w / 2 + 0.5, -d / 2 + 0.5], [w / 2 - 0.5, d / 2 - run + 0.5]]) {
      post(B, M.grain('#5b3a26', 0.4), 0.09, 0.07, 0.45, px, 0, pz, 8);
    }
  },
  recliner(B, it, { w, d, h }) {
    const lea = M.leather(it.color || LEATHERS[1][0]);
    slab(B, lea, w - 1.2, 1.1, d - 1, 0, 0.3, 0.1);
    cushion(B, lea, w - 1.3, 0.55, d - 1.5, 0, 1.4, 0.25, { puff: 0.24 });
    cushion(B, lea, w - 1.2, h - 2, 0.8, 0, 1.95, -d / 2 + 0.6, { rot: [0.16, 0, 0], puff: 0.2 });
    cushion(B, lea, w - 1.6, 0.9, 0.55, 0, h - 0.95, -d / 2 + 0.95, { rot: [0.16, 0, 0], puff: 0.25 });
    for (const sx of [-1, 1]) cushion(B, lea, 0.65, 1.5, d - 0.9, sx * (w / 2 - 0.33), 0.3, 0.1, { puff: 0.14, r: 0.28 });
    disc(B, M.metal('#55585d', 0.4), 1.1, 0.14, 0, 0, 0.1, 20);
    slab(B, M.plastic('#2b2f36', 0.5), 0.3, 0.15, 0.5, w / 2 - 0.35, 1.6, d / 2 - 0.5);
  },
  footstool(B, it, { w, d, h }) {
    const fab = M.cloth(it.color || FABRICS[5][0]);
    cushion(B, fab, w, h - 0.35, d, 0, 0.35, 0, { puff: 0.18, r: 0.2 });
    legs(B, M.grain('#5b3a26', 0.4), w, d, 0.35, { round: true, t: 0.14, inset: 0.3, taper: 0.7 });
  },
  tvunit(B, it, { w, d, h }) {
    const m = wood(it, 2);
    rbox(B, m, w, 0.12, d, 0, h - 0.12, 0, 0.02);
    slab(B, m, w, 0.1, d, 0, 0.35, 0);
    for (const sx of [-1, 1]) slab(B, m, 0.1, h - 0.45, d, sx * (w / 2 - 0.05), 0.35, 0);
    slab(B, m, 0.1, h - 0.45, d, 0, 0.35, 0);
    for (const sx of [-1, 1]) {
      rbox(B, m, w / 2 - 0.25, h - 0.6, 0.06, sx * (w / 4 - 0.02), 0.45, d / 2 - 0.02, 0.012);
      barX(B, M.metal('#b9bfc4', 0.3), 0.025, w / 4, sx * (w / 4 - 0.02), h - 0.45, d / 2 + 0.06, 6);
    }
    legs(B, M.grain('#5b3a26', 0.4), w - 0.5, d - 0.2, 0.35, { round: true, t: 0.1, splay: 0.12 });
  },
  tvstand(B, it, { w, d, h }) {
    const black = M.pianoBlack();
    const sh = h - 0.75;
    slab(B, black, 1.6, 0.06, d, 0, 0, 0);
    slab(B, black, 0.3, 0.7, 0.25, 0, 0.06, 0);
    rbox(B, black, w, sh, 0.1, 0, 0.75, 0, 0.02);
    face(B, screenMat(it.variant || 'tv', seedOf(it)), w - 0.14, sh - 0.14, 0, 0.75 + sh / 2, 0.055);
  },
  shelfhome(B, it, { w, d, h }) {
    const m = wood(it, 0);
    const r = rng(seedOf(it) * 383 + 3);
    const bays = Math.max(2, Math.round(w / 3));
    for (let b = 0; b <= bays; b++) slab(B, m, 0.09, h, d, -w / 2 + (w / bays) * b, 0, 0);
    for (let k = 0; k <= 4; k++) slab(B, m, w, 0.09, d, 0, (k * (h - 0.09)) / 4, 0);
    slab(B, m, w, h, 0.04, 0, 0, -d / 2 + 0.02);
    for (let b = 0; b < bays; b++) for (let k = 0; k < 4; k++) {
      const x0 = -w / 2 + (w / bays) * b + 0.1;
      const x1 = x0 + w / bays - 0.2;
      const y = (k * (h - 0.09)) / 4 + 0.09;
      const pick = r();
      if (pick < 0.45) stock(B, r, x0, x1, y, -d / 2 + 0.1, d / 2 - 0.1, 'books', { fill: 0.8, maxH: (h - 0.09) / 4 - 0.25 });
      else if (pick < 0.6) {
        // A row of books leaning against a box.
        stock(B, r, x0, x0 + (x1 - x0) * 0.6, y, -d / 2 + 0.1, d / 2 - 0.1, 'books', { fill: 0.9, maxH: (h - 0.09) / 4 - 0.3 });
        slab(B, M.laminate(BRIGHTS[Math.floor(r() * BRIGHTS.length)][0], 0.6), (x1 - x0) * 0.3, 0.6, d - 0.4, x1 - (x1 - x0) * 0.18, y, 0);
      } else if (pick < 0.75) {
        lathe(B, M.porcelain(['#e9e6df', '#2e5b7a', '#b0623f'][Math.floor(r() * 3)]), [[0.2, 0], [0.38, 0.3], [0.3, 0.7], [0.36, 0.95], [0.34, 1]], (x0 + x1) / 2, y, 0, 16);
        if (r() < 0.6) foliage(B, r, (x0 + x1) / 2, y + 1, 0, 0.45, 0.7, { n: 5, hex: '#4a7d42' });
      } else if (pick < 0.88) {
        slab(B, M.laminate('#2b2b2e', 0.5), 1.1, 0.9, 0.08, (x0 + x1) / 2, y + 0.05, -d / 2 + 0.25);
        face(B, artMat(Math.floor(r() * 12), 'abstract'), 0.9, 0.7, (x0 + x1) / 2, y + 0.5, -d / 2 + 0.3);
      }
    }
  },
  sideboard(B, it, { w, d, h }) {
    const m = wood(it, 1);
    cabinet(B, { w, h: h - 0.4, d, y0: 0.4, body: m, front: m, cols: Math.max(2, Math.round(w / 2)), kind: 'door', toe: 0, top: m, topT: 0.12 });
    legs(B, M.grain('#5b3a26', 0.4), w - 0.6, d - 0.2, 0.4, { round: true, t: 0.12, splay: 0.14 });
  },
  piano(B, it, { w, d, h }) {
    const m = it.color === '#7a4f2c' ? M.grain('#7a4f2c', 0.3) : M.laminate(it.color || '#2b2b2e', 0.18);
    rbox(B, m, w, h - 1.1, d - 0.5, 0, 1.1, -0.2, 0.03);
    rbox(B, m, w, 0.18, d, 0, h - 0.18, -0.1, 0.03);
    // Keyboard: white keys with blacks on top, under a fall board.
    slab(B, m, w, 0.5, 0.9, 0, 2.3, d / 2 - 0.45);
    const keys = Math.floor((w - 0.6) / 0.19);
    for (let i = 0; i < keys; i++) slab(B, M.porcelain('#f8f8f6'), 0.175, 0.08, 0.8, -w / 2 + 0.35 + i * 0.19, 2.3, d / 2 - 0.5);
    for (let i = 0; i < keys; i++) if ([1, 2, 4, 5, 6].includes(i % 7)) slab(B, M.pianoBlack(), 0.1, 0.09, 0.5, -w / 2 + 0.44 + i * 0.19, 2.38, d / 2 - 0.65);
    slab(B, m, w, 0.6, 0.2, 0, 2.85, d / 2 - 0.1, [0.35, 0, 0]);
    for (const sx of [-1, 1]) slab(B, m, 0.4, 2.3, 0.9, sx * (w / 2 - 0.2), 0, d / 2 - 0.45);
    for (let i = 0; i < 3; i++) B.add(cylGeo(0.05, 0.07, 0.5, 8), M.metal('#c9a86a', 0.3), { pos: [(i - 1) * 0.4, 0.25, d / 2 - 0.5] });
    slab(B, M.laminate('#f6f5f1', 0.75), 1.6, 1.1, 0.04, 0, h, -0.3, [-0.25, 0, 0]);
  },
  fireplace(B, it, { w, d, h }) {
    const stone = it.color === '#9c5b47' ? M.brickMat('#9c5b47') : M.concrete(it.color || '#e9e6df');
    slab(B, stone, w, h, d, 0, 0, d / 2);
    slab(B, M.painted('#17191c', 0.8), w - 2, h - 1.4, 0.3, 0, 0.5, d - 0.1);
    // A glowing bed of logs behind the opening.
    const r = rng(seedOf(it) * 389 + 1);
    for (let i = 0; i < 5; i++) B.add(cylGeo(0.14, 0.12, w - 2.6, 7).rotateZ(PI / 2), M.bark('#5d4a36'), { pos: [(r() - 0.5) * 0.4, 0.7 + i * 0.22, d - 0.4 + (r() - 0.5) * 0.3], rot: [0, (r() - 0.5) * 0.3, 0] });
    slab(B, M.glow('#ff8a2a', 2.2), w - 2.4, 0.3, 0.5, 0, 0.6, d - 0.45);
    rbox(B, M.grain('#5b3a26', 0.4), w + 0.4, 0.22, d + 0.4, 0, h, d / 2, 0.04);
    for (let i = 0; i < 3; i++) lathe(B, M.porcelain(['#e9e6df', '#2e5b7a', '#b0623f'][i]), [[0.16, 0], [0.26, 0.2], [0.2, 0.5], [0.24, 0.6]], -w / 2 + 0.8 + i * 0.6, h + 0.22, d / 2, 14);
  },
  diningset(B, it, { w, d }) {
    const m = wood(it, 1);
    rbox(B, m, w - 1.6, 0.14, d - 1.6, 0, TABLE_H - 0.14, 0, 0.03);
    legs(B, m, w - 1.6, d - 1.6, TABLE_H - 0.14, { inset: 0.3, t: 0.17, taper: 0.85 });
    const r = rng(seedOf(it) * 397 + 2);
    // Four chairs tucked in on the long sides.
    for (const sz of [-1, 1]) for (let i = 0; i < 2; i++) {
      const x = (i - 0.5) * (w - 3.4);
      const z = sz * (d / 2 - 0.9);
      const turn = sz > 0 ? PI : 0;
      for (const sx of [-1, 1]) for (const sz2 of [-1, 1]) {
        post(B, m, 0.07, 0.055, 1.45, x + sx * 0.62, 0, z + sz2 * 0.62, 6);
      }
      rbox(B, m, 1.5, 0.12, 1.5, x, 1.45, z, 0.03);
      cushion(B, M.cloth(FABRICS[Math.floor(r() * 4)][0]), 1.35, 0.14, 1.35, x, 1.57, z, { puff: 0.14 });
      for (const sx of [-1, 1]) B.add(cylGeo(0.07, 0.085, 1.5, 8), m, { pos: [x + sx * 0.62, 2.3, z - Math.cos(turn) * 0.62], rot: [0, 0, 0] });
      rbox(B, m, 1.4, 0.4, 0.12, x, 2.7, z - Math.cos(turn) * 0.66, 0.04);
    }
    lathe(B, M.clearGlass('#dfe8ea'), [[0.22, 0], [0.3, 0.2], [0.22, 0.5], [0.24, 0.56]], 0, TABLE_H, 0, 14);
    foliage(B, r, 0, TABLE_H + 0.55, 0, 0.5, 0.6, { n: 6, hex: '#4a7d42' });
  },
  barcart(B, it, { w, d, h }) {
    const m = M.metal('#c9a86a', 0.25);
    const r = rng(seedOf(it) * 401 + 5);
    for (let k = 0; k < 2; k++) {
      const y = 0.55 + k * (h - 1.1);
      slab(B, M.clearGlass('#e8f2f4'), w - 0.2, 0.06, d - 0.2, 0, y, 0);
      for (const sz of [-1, 1]) barX(B, m, 0.04, w, 0, y + 0.1, sz * (d / 2 - 0.05), 6);
      for (const sx of [-1, 1]) barZ(B, m, 0.04, d, sx * (w / 2 - 0.05), y + 0.1, 0, 6);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      post(B, m, 0.05, 0.05, h - 0.3, sx * (w / 2 - 0.05), 0.3, sz * (d / 2 - 0.05), 8);
      B.add(cylGeo(0.15, 0.15, 0.06, 10).rotateZ(PI / 2), blackPl(0.6), { pos: [sx * (w / 2 - 0.05), 0.15, sz * (d / 2 - 0.05)] });
    }
    B.add(new THREE.TorusGeometry(0.3, 0.04, 5, 14, PI), m, { pos: [0, h, -d / 2 + 0.05], rot: [0, 0, 0] });
    for (let i = 0; i < 5; i++) if (r() < 0.8) {
      lathe(B, M.plastic(['#2e6f8e', '#8a5a2a', '#1f7a54', '#b84a6a'][Math.floor(r() * 4)], 0.25), [[0.16, 0], [0.17, 0.5], [0.13, 0.62], [0.06, 0.8], [0.06, 0.95]], -w / 2 + 0.4 + i * 0.5, h - 0.55, (r() - 0.5) * (d - 0.8), 10);
    }
    for (let i = 0; i < 3; i++) lathe(B, M.clearGlass('#e6f0f2'), [[0.13, 0], [0.14, 0.05], [0.07, 0.18], [0.06, 0.38], [0.17, 0.48], [0.18, 0.75]], -w / 2 + 0.5 + i * 0.45, 0.61, d / 2 - 0.45, 10);
  },
};

/* ======================================================================= */
/*                                BEDROOM                                   */
/* ======================================================================= */

/** A bed: base, mattress, duvet with a turned-back sheet, and pillows. */
function bed(B, it, w, d, h, pillows) {
  const r = rng(seedOf(it) * 409 + 3);
  const frame = M.grain(it.color || WOODS[1][0], 0.45);
  const cover = M.cloth(it.color2 || '#dfe3e8');
  slab(B, frame, w, 1.05, d, 0, 0, 0);
  // Mattress, then the duvet over its lower two thirds.
  cushion(B, M.cloth('#f4f4f1'), w - 0.3, 0.85, d - 0.3, 0, 1.05, 0, { puff: 0.06, r: 0.14 });
  cushion(B, cover, w - 0.22, 0.42, d * 0.68, 0, 1.78, d * 0.15, { puff: 0.14, r: 0.16 });
  slab(B, M.cloth('#f8f8f6'), w - 0.24, 0.12, d * 0.12, 0, 2.18, -d * 0.19);
  for (let i = 0; i < pillows; i++) {
    const x = pillows === 1 ? 0 : (i - (pillows - 1) / 2) * (w / pillows);
    cushion(B, M.cloth('#f8f8f6'), w / pillows - 0.35, 0.45, 1.45, x, 1.9, -d / 2 + 1.1, { rot: [-0.2, 0, 0], puff: 0.3 });
  }
  // Head and foot boards.
  rbox(B, frame, w, h - 1.05, 0.25, 0, 1.05, -d / 2 + 0.12, 0.05);
  rbox(B, frame, w, 0.6, 0.25, 0, 1.05, d / 2 - 0.12, 0.05);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) post(B, frame, 0.14, 0.12, 0.3, sx * (w / 2 - 0.3), -0.3, sz * (d / 2 - 0.3), 8);
  void r;
}

const BEDROOM = [
  ['bedroom', 'bedsingle', 'Single bed', '🛏️', 3.5, 6.8, 3.4, { colors: WOODS, colors2: FABRICS, label2: 'Bedding' }],
  ['bedroom', 'beddouble', 'Double bed', '🛏️', 5, 6.9, 3.6, { colors: WOODS, colors2: FABRICS, label2: 'Bedding' }],
  ['bedroom', 'bedking', 'King bed', '🛏️', 6.4, 7.2, 3.8, { colors: WOODS, colors2: FABRICS, label2: 'Bedding' }],
  ['bedroom', 'bunkbed', 'Bunk beds', '🪜', 3.6, 6.8, 5.8, { colors: WOODS, colors2: FABRICS, label2: 'Bedding' }],
  ['bedroom', 'cot', 'Cot', '👶', 2.6, 4.6, 3.2, { colors: WOODS }],
  ['bedroom', 'nightstand', 'Bedside table', '🕯️', 1.6, 1.4, 2, { colors: WOODS, surface: 2 }],
  ['bedroom', 'dresser', 'Chest of drawers', '🗄️', 4, 1.8, 3.4, { colors: WOODS, surface: 3.4 }],
  ['bedroom', 'wardrobe', 'Wardrobe', '👗', 5, 2.2, 7, { colors: WOODS, len: true, variants: [['doors', 'Hinged doors'], ['open', 'Open front'], ['mirror', 'Mirrored']] }],
  ['bedroom', 'dressingtable', 'Dressing table', '💄', 4, 1.6, 2.5, { colors: WOODS, surface: 2.5 }],
  ['bedroom', 'blanketbox', 'Blanket box', '🧺', 3.4, 1.6, 1.6, { colors: WOODS, surface: 1.6 }],
  ['bedroom', 'laundry', 'Laundry basket', '🧺', 1.6, 1.6, 2.2, {}],
];

const BEDROOM_B = {
  bedsingle: (B, it, { w, d, h }) => bed(B, it, w, d, h, 1),
  beddouble: (B, it, { w, d, h }) => bed(B, it, w, d, h, 2),
  bedking: (B, it, { w, d, h }) => bed(B, it, w, d, h, 2),
  bunkbed(B, it, { w, d, h }) {
    const frame = M.grain(it.color || WOODS[0][0], 0.45);
    const cover = M.cloth(it.color2 || '#dfe3e8');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) slab(B, frame, 0.3, h, 0.3, sx * (w / 2 - 0.15), 0, sz * (d / 2 - 0.15));
    for (const y of [1.2, 4]) {
      slab(B, frame, w, 0.22, d, 0, y, 0);
      cushion(B, M.cloth('#f4f4f1'), w - 0.3, 0.6, d - 0.3, 0, y + 0.22, 0, { puff: 0.06, r: 0.12 });
      cushion(B, cover, w - 0.25, 0.3, d * 0.66, 0, y + 0.78, d * 0.16, { puff: 0.12, r: 0.14 });
      cushion(B, M.cloth('#f8f8f6'), w - 1, 0.35, 1.3, 0, y + 0.85, -d / 2 + 1, { rot: [-0.2, 0, 0], puff: 0.3 });
      // Guard rails along the open side.
      for (const sz of [-1, 1]) slab(B, frame, w, 0.9, 0.14, 0, y + 0.22, sz * (d / 2 - 0.07));
      if (y > 2) slab(B, frame, 0.14, 1.5, d * 0.5, -w / 2 + 0.07, y + 0.22, -d * 0.2);
    }
    // The ladder at the foot end.
    for (const sx of [-1, 1]) slab(B, frame, 0.16, 4.3, 0.16, sx * 0.6, 0.5, d / 2 + 0.18);
    for (let i = 0; i < 5; i++) B.add(cylGeo(0.09, 0.09, 1.3, 8).rotateZ(PI / 2), frame, { pos: [0, 1.1 + i * 0.75, d / 2 + 0.18] });
  },
  cot(B, it, { w, d, h }) {
    const m = wood(it, 2);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) slab(B, m, 0.22, h, 0.22, sx * (w / 2 - 0.11), 0, sz * (d / 2 - 0.11));
    slab(B, m, w, 0.14, d, 0, 1.3, 0);
    cushion(B, M.cloth('#f4f4f1'), w - 0.3, 0.4, d - 0.3, 0, 1.44, 0, { puff: 0.05, r: 0.1 });
    cushion(B, M.cloth(['#cfe0e6', '#e6dfe8', '#e2e6d9'][seedOf(it) % 3]), w - 0.4, 0.2, d * 0.6, 0, 1.84, d * 0.15, { puff: 0.12 });
    for (const sz of [-1, 1]) {
      slab(B, m, w, 0.14, 0.14, 0, h - 0.14, sz * (d / 2 - 0.11));
      for (let i = 0; i < Math.floor(w / 0.38); i++) slab(B, m, 0.09, h - 1.5, 0.09, -w / 2 + 0.3 + i * 0.38, 1.4, sz * (d / 2 - 0.11));
    }
    for (const sx of [-1, 1]) {
      slab(B, m, 0.14, 0.14, d, sx * (w / 2 - 0.11), h - 0.14, 0);
      for (let i = 0; i < Math.floor(d / 0.38); i++) slab(B, m, 0.09, h - 1.5, 0.09, sx * (w / 2 - 0.11), 1.4, -d / 2 + 0.3 + i * 0.38);
    }
  },
  nightstand(B, it, { w, d, h }) {
    const m = wood(it, 1);
    cabinet(B, { w, h: h - 0.35, d, y0: 0.35, body: m, front: m, cols: 1, rows: 2, kind: 'drawer', toe: 0, top: m, topT: 0.1 });
    legs(B, M.grain('#5b3a26', 0.4), w - 0.3, d - 0.2, 0.35, { round: true, t: 0.1, splay: 0.14 });
    // A lamp and a book.
    const r = rng(seedOf(it) * 419 + 1);
    disc(B, M.metal('#c9a86a', 0.3), 0.25, 0.05, -w * 0.2, h, 0, 14);
    post(B, M.metal('#c9a86a', 0.3), 0.04, 0.04, 0.8, -w * 0.2, h + 0.05, 0, 8);
    lathe(B, M.glow('#ffeccd', 0.8), [[0.3, 0], [0.42, 0.55]], -w * 0.2, h + 0.85, 0, 16);
    if (r() < 0.7) slab(B, M.laminate(BRIGHTS[Math.floor(r() * BRIGHTS.length)][0], 0.6), 0.75, 0.1, 1, w * 0.22, h, 0.05, [0, r(), 0]);
  },
  dresser(B, it, { w, d, h }) {
    const m = wood(it, 1);
    cabinet(B, { w, h: h - 0.4, d, y0: 0.4, body: m, front: m, cols: 2, rows: 3, kind: 'drawer', toe: 0, top: m, topT: 0.12 });
    legs(B, M.grain('#5b3a26', 0.4), w - 0.5, d - 0.2, 0.4, { round: true, t: 0.12, splay: 0.14 });
    const r = rng(seedOf(it) * 421 + 2);
    lathe(B, M.porcelain('#e9e6df'), [[0.2, 0], [0.34, 0.25], [0.26, 0.6], [0.3, 0.7]], -w * 0.3, h, 0, 16);
    foliage(B, r, -w * 0.3, h + 0.7, 0, 0.4, 0.5, { n: 4, hex: '#5a8a4a' });
    picture(B, 1.1, 1.4, w * 0.28, h + 0.7, { seed: seedOf(it), kind: 'landscape', frame: '#5b3a26', mount: false });
  },
  wardrobe(B, it, { w, d, h }) {
    const m = wood(it, 1);
    const kind = it.variant || 'doors';
    const cols = Math.max(2, Math.round(w / 2.4));
    if (kind === 'open') {
      shelfRun(B, m, w, d, h, 1, { back: M.laminate(shadeHex(it.color || WOODS[1][0], 0.85), 0.7) });
      const r = rng(seedOf(it) * 431 + 1);
      barX(B, M.metal('#c9ced3', 0.3), 0.05, w - 0.3, 0, h * 0.62, 0, 8);
      for (let i = 0; i < Math.floor((w - 0.8) / 0.34); i++) {
        const col = ['#2f3b4d', '#8a3b3b', '#3f6b52', '#c9c3b5', '#2b2f36', '#dfe3e8'][Math.floor(r() * 6)];
        const len = 1.6 + r() * 1.3;
        B.add(cylGeo(0.02, 0.02, 0.9, 5).rotateZ(PI / 2), M.plastic('#55585d', 0.5), { pos: [-w / 2 + 0.5 + i * 0.34, h * 0.62 - 0.32, 0] });
        const g = new THREE.BoxGeometry(0.9, len, 0.26);
        const p = g.attributes.position;
        for (let k = 0; k < p.count; k++) { const t = (p.getY(k) + len / 2) / len; p.setX(k, p.getX(k) * (0.55 + t * 0.5)); }
        g.computeVertexNormals();
        B.add(g, M.cloth(col), { pos: [-w / 2 + 0.5 + i * 0.34, h * 0.62 - 0.35 - len / 2, 0] });
      }
      stock(B, r, -w / 2 + 0.2, w / 2 - 0.2, h - 1.4, -d / 2 + 0.2, d / 2 - 0.2, 'folded', { fill: 0.9 });
    } else {
      cabinet(B, { w, h, d, body: m, front: kind === 'mirror' ? M.mirror() : m, cols, kind: 'door', toe: 0.2, gap: 0.05 });
      if (kind === 'mirror') for (let c = 0; c < cols; c++) slab(B, m, w / cols - 0.02, h - 0.2, 0.05, -w / 2 + (w / cols) * (c + 0.5), 0.2, d / 2 - 0.06);
    }
  },
  dressingtable(B, it, { w, d, h }) {
    const m = wood(it, 2);
    rbox(B, m, w, 0.12, d, 0, h - 0.12, 0, 0.02);
    cabinet(B, { w: 1.6, h: h - 0.5, d: d - 0.1, x: -w / 2 + 0.9, y0: 0.5, body: m, front: m, cols: 1, rows: 2, kind: 'drawer', toe: 0 });
    for (const sx of [1]) legs(B, M.grain('#5b3a26', 0.4), w - 0.4, d - 0.2, h - 0.12, { round: true, t: 0.11, inset: 0.3, taper: 0.7, splay: 0.02 });
    // A round mirror on a stand and a few bottles.
    const r = rng(seedOf(it) * 433 + 2);
    B.add(new THREE.TorusGeometry(0.95, 0.07, 7, 24), M.metal('#c9a86a', 0.3), { pos: [w * 0.2, h + 1.3, -d / 2 + 0.3] });
    B.add(cylGeo(0.92, 0.92, 0.04, 24).rotateX(PI / 2), M.mirror(), { pos: [w * 0.2, h + 1.3, -d / 2 + 0.3] });
    post(B, M.metal('#c9a86a', 0.3), 0.04, 0.05, 0.4, w * 0.2, h, -d / 2 + 0.3, 8);
    for (let i = 0; i < 4; i++) lathe(B, M.clearGlass(['#e6d8e8', '#dfe8ea', '#e8e2d0'][Math.floor(r() * 3)]), [[0.1, 0], [0.13, 0.2], [0.08, 0.3], [0.05, 0.42]], -w * 0.1 + i * 0.3, h, 0.2 + (r() - 0.5) * 0.3, 10);
  },
  blanketbox(B, it, { w, d, h }) {
    const m = wood(it, 2);
    slab(B, m, w, h - 0.12, d, 0, 0, 0);
    rbox(B, m, w + 0.1, 0.14, d + 0.1, 0, h - 0.14, 0, 0.03);
    slab(B, M.metal('#9aa1a8', 0.3), 0.5, 0.2, 0.08, 0, h - 0.6, d / 2 + 0.01);
    for (const sz of [-1, 1]) for (let i = 0; i < 2; i++) slab(B, M.metal('#9aa1a8', 0.4), 0.14, h - 0.3, 0.05, (i - 0.5) * (w - 0.9), 0.1, sz * (d / 2 + 0.01));
  },
  laundry(B, it, { w, d, h }) {
    const r = rng(seedOf(it) * 439 + 1);
    lathe(B, M.sheet('weave', '#c9b89a'), [[w / 2 - 0.25, 0], [w / 2 - 0.15, 0.3], [w / 2, h - 0.35], [w / 2 + 0.05, h - 0.25]], 0, 0, 0, 20);
    lathe(B, M.plastic('#d9cbb0', 0.8), [[w / 2 + 0.06, 0], [w / 2 + 0.04, 0.12], [w / 2 - 0.4, 0.18]], 0, h - 0.25, 0, 20);
    for (let i = 0; i < 3; i++) cushion(B, M.cloth(['#dfe3e8', '#c9d9c2', '#e2d2c2'][i]), 0.9, 0.3, 0.8, (r() - 0.5) * 0.6, h - 0.5 + i * 0.1, (r() - 0.5) * 0.6, { rot: [0, r() * 3, 0], puff: 0.3 });
  },
};

/* ======================================================================= */
/*                             HOME KITCHEN                                 */
/* ======================================================================= */

const HOME = [
  ['home', 'kitchenrun', 'Kitchen run', '🍳', 10, 2.2, COUNTER_H, { len: true, colors: LAMINATES, colors2: STONE, label2: 'Worktop', surface: COUNTER_H }],
  ['home', 'kitchenwall', 'Wall cupboards', '🗄️', 8, 1.2, 2.8, { wall: true, mount: 7.2, len: true, colors: LAMINATES }],
  ['home', 'kitchenisland', 'Island', '🏝️', 7, 3.4, 3.1, { len: true, colors: LAMINATES, colors2: STONE, label2: 'Worktop', surface: COUNTER_H }],
  ['home', 'sinkrun', 'Sink unit', '🚰', 4, 2.2, COUNTER_H, { colors: LAMINATES, colors2: STONE, label2: 'Worktop' }],
  ['home', 'cooker', 'Range cooker', '🔥', 3, 2.2, 3.4, { colors: [['#e9eaea', 'Stainless'], ['#2b2f36', 'Black'], ['#c0392b', 'Red'], ['#1f4f9c', 'Blue']] }],
  ['home', 'hob', 'Hob and oven unit', '🍲', 2.6, 2.2, COUNTER_H, { colors: LAMINATES, colors2: STONE, label2: 'Worktop' }],
  ['home', 'extractor', 'Cooker hood', '💨', 3, 1.8, 2.4, { wall: true, mount: 7.4 }],
  ['home', 'fridgehome', 'Fridge freezer', '🧊', 3, 2.4, 6.2, { colors: [['#e9eaea', 'Stainless'], ['#f1f2f0', 'White'], ['#2b2f36', 'Black']], variants: [['double', 'American'], ['single', 'Tall']] }],
  ['home', 'dishwasher', 'Dishwasher', '🧼', 2, 2.2, COUNTER_H, {}],
  ['home', 'washer', 'Washing machine', '🫧', 2, 2.2, COUNTER_H, {}],
  ['home', 'microwave', 'Microwave', '📻', 1.7, 1.3, 1.1, { top: true }],
  ['home', 'kettletoaster', 'Kettle and toaster', '☕', 1.8, 1, 1.1, { top: true }],
  ['home', 'fruitbowl', 'Fruit bowl', '🍇', 1.1, 1.1, 0.5, { top: true }],
  ['home', 'barstoolhome', 'Kitchen stool', '🪑', 1.4, 1.4, 3.3, { colors: WOODS }],
  ['home', 'binhome', 'Kitchen bin', '🗑️', 1.3, 1.3, 2.3, {}],
];

/** A base-unit run: carcasses, doors, plinth and worktop. */
function baseRun(B, it, w, d, { h = COUNTER_H, sink = false, hob = false, appliance = null } = {}) {
  const door = lam(it);
  const top = worktop(it.color2 || STONE[1][0]);
  const cols = Math.max(1, Math.round(w / 2.2));
  const toe = 0.35;
  slab(B, M.laminate('#2b2f36', 0.6), w - 0.1, toe, d - 0.3, 0, 0, -0.1);
  slab(B, M.laminate('#d9d9d6', 0.5), w, h - toe - 0.12, d - 0.1, 0, toe, -0.03);
  const cw = w / cols;
  for (let c = 0; c < cols; c++) {
    const x = -w / 2 + cw * (c + 0.5);
    if (appliance === 'dishwasher' || appliance === 'washer') {
      slab(B, M.metal('#dde0e2', 0.3), cw - 0.1, h - toe - 0.2, 0.1, x, toe + 0.08, d / 2 - 0.02);
      if (appliance === 'washer') {
        B.add(cylGeo(0.62, 0.62, 0.12, 20).rotateX(PI / 2), M.painted('#55585d', 0.4), { pos: [x, h / 2, d / 2 + 0.04] });
        B.add(cylGeo(0.52, 0.52, 0.1, 20).rotateX(PI / 2), M.clearGlass('#9fb4bc'), { pos: [x, h / 2, d / 2 + 0.08] });
      }
      slab(B, M.pianoBlack(), cw - 0.3, 0.3, 0.06, x, h - 0.55, d / 2 + 0.03);
      continue;
    }
    if (hob && c === Math.floor(cols / 2)) {
      // An oven under the hob.
      slab(B, M.pianoBlack(), cw - 0.12, h - toe - 0.35, 0.1, x, toe + 0.12, d / 2 - 0.02);
      slab(B, M.clearGlass('#3a4348'), cw - 0.6, h - toe - 1.1, 0.05, x, toe + 0.45, d / 2 + 0.04);
      barX(B, M.metal('#c9ced3', 0.3), 0.05, cw - 0.4, x, h - 0.45, d / 2 + 0.1, 8);
      continue;
    }
    const drawers = (c + (seedOf(it) % 3)) % 3 === 0;
    if (drawers) for (let k = 0; k < 3; k++) {
      const dh = (h - toe - 0.12) / 3;
      rbox(B, door, cw - 0.06, dh - 0.05, 0.07, x, toe + k * dh, d / 2 - 0.04, 0.012);
      barX(B, M.metal('#b9bfc4', 0.3), 0.025, cw * 0.5, x, toe + k * dh + dh * 0.6, d / 2 + 0.04, 6);
    } else {
      rbox(B, door, cw - 0.06, h - toe - 0.17, 0.07, x, toe, d / 2 - 0.04, 0.012);
      barX(B, M.metal('#b9bfc4', 0.3), 0.025, cw * 0.5, x, h - 0.5, d / 2 + 0.04, 6);
    }
  }
  rbox(B, top, w, 0.12, d, 0, h - 0.12, 0, 0.015);
  slab(B, top, w, 0.4, 0.06, 0, h, -d / 2 + 0.03);
  if (sink) {
    const st = M.stainless(0.2);
    slab(B, st, 2.4, 0.08, 1.5, 0, h - 0.1, 0.05);
    slab(B, M.painted('#17191c', 0.85), 2.1, 0.05, 1.25, 0, h - 0.13, 0.05);
    B.tube(M.chrome(), [0, h, -d / 2 + 0.35], [0, h + 1, -d / 2 + 0.35], 0.05, 8);
    B.tube(M.chrome(), [0, h + 1, -d / 2 + 0.35], [0, h + 0.85, -d / 2 + 0.95], 0.045, 8);
    barX(B, M.chrome(), 0.035, 0.5, 0.25, h + 0.35, -d / 2 + 0.35, 6);
  }
  if (hob) {
    const x = -w / 2 + cw * (Math.floor(cols / 2) + 0.5);
    slab(B, M.pianoBlack(), 2.3, 0.04, 1.8, x, h, 0);
    for (let i = 0; i < 4; i++) {
      const bx = x + ((i % 2) - 0.5) * 1.1;
      const bz = (Math.floor(i / 2) - 0.5) * 0.9;
      B.add(new THREE.TorusGeometry(0.28, 0.025, 5, 20), M.metal('#55585d', 0.5), { pos: [bx, h + 0.03, bz], rot: [PI / 2, 0, 0] });
      B.add(new THREE.TorusGeometry(0.17, 0.02, 5, 16), M.metal('#55585d', 0.5), { pos: [bx, h + 0.03, bz], rot: [PI / 2, 0, 0] });
    }
  }
  return h;
}

const HOME_B = {
  kitchenrun(B, it, { w, d }) { baseRun(B, it, w, d, {}); },
  sinkrun(B, it, { w, d }) { baseRun(B, it, w, d, { sink: true }); },
  hob(B, it, { w, d }) { baseRun(B, it, w, d, { hob: true }); },
  dishwasher(B, it, { w, d }) { baseRun(B, it, w, d, { appliance: 'dishwasher' }); },
  washer(B, it, { w, d }) { baseRun(B, it, w, d, { appliance: 'washer' }); },
  kitchenisland(B, it, { w, d }) {
    const h = baseRun(B, it, w, d - 1.2, { sink: true });
    // A panelled back and an overhang for stools.
    const door = lam(it);
    const top = worktop(it.color2 || STONE[1][0]);
    slab(B, door, w, h - 0.12, 0.08, 0, 0, -(d - 1.2) / 2 - 0.04);
    rbox(B, top, w + 0.1, 0.12, d, 0, h - 0.12, -0.6, 0.015);
  },
  kitchenwall(B, it, { w, d, h }) {
    const door = lam(it);
    const y = 4.4;      // modelled from the wall outward, hung high
    const cols = Math.max(2, Math.round(w / 2.2));
    slab(B, M.laminate('#d9d9d6', 0.5), w, h, d - 0.05, 0, y, d / 2);
    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + (w / cols) * (c + 0.5);
      rbox(B, door, w / cols - 0.06, h - 0.06, 0.07, x, y + 0.03, d - 0.02, 0.012);
      barX(B, M.metal('#b9bfc4', 0.3), 0.025, (w / cols) * 0.5, x, y + 0.35, d + 0.05, 6);
    }
    slab(B, M.painted('#3d434b', 0.5), w, 0.1, d + 0.06, 0, y + h, d / 2);
    slab(B, M.glow('#fff4e2', 0.7), w - 0.6, 0.05, d * 0.5, 0, y - 0.05, d * 0.5);
  },
  cooker(B, it, { w, d, h }) {
    const body = M.painted(it.color || '#e9eaea', 0.4);
    slab(B, body, w, h - 0.3, d, 0, 0, 0);
    slab(B, M.pianoBlack(), w - 0.1, 0.06, d - 0.1, 0, h - 0.3, 0);
    for (let i = 0; i < 4; i++) {
      const bx = ((i % 2) - 0.5) * (w * 0.42);
      const bz = (Math.floor(i / 2) - 0.5) * (d * 0.42);
      B.add(cylGeo(0.36, 0.36, 0.08, 14), M.metal('#3d434b', 0.7), { pos: [bx, h - 0.22, bz] });
      for (let k = 0; k < 4; k++) B.add(new THREE.BoxGeometry(0.06, 0.09, 0.72), M.metal('#2b2f36', 0.8), { pos: [bx, h - 0.2, bz], rot: [0, (k / 4) * PI, 0] });
    }
    // Oven door with a glass panel, handle and knobs.
    slab(B, M.pianoBlack(), w - 0.15, h - 1.5, 0.1, 0, 0.5, d / 2 - 0.02);
    slab(B, M.clearGlass('#3a4348'), w - 0.8, h - 2.3, 0.05, 0, 0.85, d / 2 + 0.04);
    barX(B, M.metal('#c9ced3', 0.3), 0.055, w - 0.5, 0, h - 0.95, d / 2 + 0.12, 8);
    for (let i = 0; i < 4; i++) B.add(cylGeo(0.11, 0.11, 0.1, 10).rotateX(PI / 2), blackPl(0.4), { pos: [-w / 2 + 0.4 + i * ((w - 0.8) / 3), h - 0.6, d / 2 + 0.05] });
    slab(B, body, w, 0.3, 0.2, 0, h - 0.3, -d / 2 + 0.1);
  },
  extractor(B, it, { w, d, h }) {
    const st = M.metal('#c9ced3', 0.28);
    const y = 1.2;
    // A chimney hood on the wall above the hob.
    slab(B, st, w * 0.45, h - 1.4, d * 0.5, 0, y + 1.4, d * 0.3);
    for (const sz of [0]) void sz;
    const g = new THREE.CylinderGeometry(0.1, 0.1, 0.1, 4);
    void g;
    slab(B, st, w, 0.35, d, 0, y + 1.05, d / 2);
    for (const sx of [-1, 1]) B.add(new THREE.BoxGeometry(0.1, 1.1, d), st, { pos: [sx * (w / 2 - 0.05), y + 0.5, d / 2], rot: [0, 0, sx * 0.2] });
    slab(B, M.pianoBlack(), w - 0.5, 0.06, d - 0.3, 0, y + 1, d / 2);
    for (const sx of [-1, 1]) slab(B, M.glow('#fff4e2', 1), 0.5, 0.04, 0.5, sx * w * 0.25, y + 0.96, d * 0.55);
    void it;
  },
  fridgehome(B, it, { w, d, h }) {
    const body = M.painted(it.color || '#e9eaea', 0.35);
    const dbl = (it.variant || 'double') === 'double';
    slab(B, body, w, h, d, 0, 0, 0);
    if (dbl) {
      for (const sx of [-1, 1]) {
        slab(B, M.metal('#dde0e2', 0.28), w / 2 - 0.04, h - 0.3, 0.12, sx * w / 4, 0.15, d / 2 - 0.02);
        B.add(cylGeo(0.05, 0.05, h - 2, 8), M.metal('#9aa1a8', 0.3), { pos: [sx * 0.18, h / 2, d / 2 + 0.14] });
      }
      slab(B, M.pianoBlack(), 1, 1.5, 0.1, -w / 4, h - 2.4, d / 2 + 0.05);
      face(B, labelMat('ICE|WATER', { color: '#8ad4ff', bg: '#0d1114', aspect: 1.4, glow: true }), 0.8, 1.2, -w / 4, h - 1.8, d / 2 + 0.11);
    } else {
      slab(B, M.metal('#dde0e2', 0.28), w - 0.08, h * 0.64, 0.12, 0, h * 0.35, d / 2 - 0.02);
      slab(B, M.metal('#dde0e2', 0.28), w - 0.08, h * 0.32, 0.12, 0, 0.1, d / 2 - 0.02);
      for (const y of [h * 0.42, h * 0.08]) B.add(cylGeo(0.05, 0.05, h * 0.25, 8), M.metal('#9aa1a8', 0.3), { pos: [w / 2 - 0.4, y + h * 0.1, d / 2 + 0.14] });
    }
    const r = rng(seedOf(it) * 443 + 1);
    for (let i = 0; i < 4; i++) if (r() < 0.6) slab(B, M.laminate(['#f6f5f1', '#f0e6c8', '#dfe8f2'][Math.floor(r() * 3)], 0.8), 0.5, 0.65, 0.01, -w / 2 + 0.5 + r() * (w - 1), h * 0.5 + r() * h * 0.3, d / 2 + 0.13, [0, 0, (r() - 0.5) * 0.2]);
  },
  microwave(B, it, { w, d, h }) {
    const body = M.painted('#e9eaea', 0.4);
    rbox(B, body, w, h, d, 0, 0, 0, 0.04);
    slab(B, M.pianoBlack(), w * 0.68, h - 0.18, 0.06, -w * 0.14, 0.09, d / 2 + 0.01);
    slab(B, M.clearGlass('#3a4348'), w * 0.58, h - 0.34, 0.03, -w * 0.14, 0.17, d / 2 + 0.04);
    slab(B, M.pianoBlack(), w * 0.26, h - 0.2, 0.05, w * 0.35, 0.1, d / 2 + 0.01);
    face(B, labelMat('12:30', { color: '#6ae08a', bg: '#101317', aspect: 2.6, glow: true }), w * 0.2, 0.18, w * 0.35, h * 0.72, d / 2 + 0.05);
    void it;
  },
  kettletoaster(B, it, { w, d, h }) {
    lathe(B, M.metal('#c9ced3', 0.25), [[0.42, 0], [0.45, 0.15], [0.4, 0.85], [0.34, 1], [0.3, 1.05]], -w / 2 + 0.5, 0, 0, 16);
    slab(B, blackPl(0.4), 0.3, 0.6, 0.25, -w / 2 + 0.95, 0.2, 0);
    rbox(B, M.metal('#c9ced3', 0.25), 0.95, h - 0.25, d - 0.2, w / 2 - 0.55, 0, 0, 0.1);
    for (const sz of [-0.2, 0.2]) slab(B, M.pianoBlack(), 0.6, 0.04, 0.12, w / 2 - 0.55, h - 0.25, sz);
    barZ(B, blackPl(0.4), 0.05, 0.3, w / 2 - 0.95, h - 0.45, 0, 6);
    void it;
  },
  fruitbowl(B, it, { w, h }) {
    const r = rng(seedOf(it) * 449 + 2);
    lathe(B, M.porcelain('#f1ece2'), [[0.1, 0], [w / 2 - 0.08, h * 0.75], [w / 2, h], [w / 2 - 0.07, h]], 0, 0, 0, 20);
    for (let i = 0; i < 7; i++) {
      const a = r() * PI * 2;
      const rad = r() * (w / 2 - 0.3);
      B.add(new THREE.IcosahedronGeometry(0.17, 1), M.plastic(['#c8241b', '#e36a1c', '#e2b31b', '#5b9a3a', '#7a2f5a'][Math.floor(r() * 5)], 0.55), { pos: [Math.cos(a) * rad, h * 0.65 + r() * 0.2, Math.sin(a) * rad] });
    }
  },
  barstoolhome(B, it, { w, h }) {
    const m = wood(it, 0);
    legs(B, m, w - 0.1, w - 0.1, h - 0.22, { round: true, t: 0.12, splay: 0.07, taper: 0.8 });
    for (const y of [0.8, 1.5]) for (const sz of [-1, 1]) barX(B, m, 0.05, w - 0.35, 0, y, sz * (w / 2 - 0.3), 6);
    for (const y of [0.8, 1.5]) for (const sx of [-1, 1]) barZ(B, m, 0.05, w - 0.35, sx * (w / 2 - 0.3), y + 0.2, 0, 6);
    disc(B, m, w / 2, 0.22, 0, h - 0.22, 0, 20);
    for (let i = 0; i <= 10; i++) {
      const a = -PI * 0.5 + (i / 10) * PI;
      B.add(cylGeo(0.055, 0.055, 1.15, 6), m, { pos: [Math.sin(a) * (w / 2 - 0.12), h + 0.5, -Math.cos(a) * (w / 2 - 0.12)], rot: [0.08 * Math.cos(a), 0, -0.08 * Math.sin(a)] });
    }
    B.add(new THREE.TorusGeometry(w / 2 - 0.12, 0.06, 6, 20, PI), m, { pos: [0, h + 1.05, 0], rot: [PI / 2, PI, 0] });
  },
  binhome(B, it, { w, d, h }) {
    const st = M.metal('#c9ced3', 0.3);
    lathe(B, st, [[w / 2 - 0.08, 0], [w / 2, 0.12], [w / 2 - 0.02, h - 0.3], [w / 2 + 0.02, h - 0.22]], 0, 0, 0, 20);
    lathe(B, M.plastic('#2b2f36', 0.5), [[w / 2 + 0.03, 0], [w / 2, 0.14], [w / 2 - 0.45, 0.2]], 0, h - 0.22, 0, 20);
    slab(B, M.plastic('#2b2f36', 0.5), 0.5, 0.3, 0.25, 0, 0.05, -d / 2 - 0.05);
    void it;
  },
};

/* ======================================================================= */
/*                              BATH & WC                                   */
/* ======================================================================= */

const BATH = [
  ['bath', 'bathtub', 'Bath', '🛁', 5.4, 2.6, 2, { colors: [['#f6f6f3', 'White'], ['#2b2f36', 'Black'], ['#e9e6df', 'Stone']] }],
  ['bath', 'shower', 'Shower enclosure', '🚿', 3.4, 3.4, 7.4, {}],
  ['bath', 'showerbath', 'Shower over bath', '🚿', 5.4, 2.6, 7, {}],
  ['bath', 'toilet', 'WC', '🚽', 1.8, 2.6, 2.6, {}],
  ['bath', 'toiletwall', 'Wall-hung WC', '🚽', 1.8, 2.2, 4.4, { wall: true, mount: 0 }],
  ['bath', 'urinal', 'Urinal', '🚹', 1.6, 1.2, 3.4, { wall: true, mount: 0 }],
  ['bath', 'basinped', 'Pedestal basin', '🚰', 2.2, 1.8, 2.9, { wall: true, mount: 0 }],
  ['bath', 'vanity', 'Vanity unit', '🪞', 4, 1.8, 2.9, { colors: WOODS, colors2: STONE, label2: 'Top', len: true }],
  ['bath', 'basinrow', 'Washroom trough', '🧼', 7, 1.8, 2.9, { len: true, colors: STONE }],
  ['bath', 'towelrail', 'Heated towel rail', '🧻', 2, 0.5, 4, { wall: true, mount: 4.6 }],
  ['bath', 'bathmirror', 'Bathroom mirror', '🪞', 3, 0.3, 3, { wall: true, mount: 5.6 }],
  ['bath', 'showerscreen', 'Shower screen', '🚿', 3, 0.3, 6.4, { wall: true, mount: 0 }],
  ['bath', 'bathcab', 'Bathroom cabinet', '💊', 2.4, 1, 2.6, { wall: true, mount: 5.8, colors: LAMINATES }],
  ['bath', 'drier', 'Hand drier', '💨', 1, 0.8, 1.4, { wall: true, mount: 4.4 }],
  ['bath', 'babychange', 'Baby change table', '👶', 3, 1.4, 2.6, { wall: true, mount: 2.8 }],
];

const BATH_B = {
  bathtub(B, it, { w, d, h }) {
    const porc = M.porcelain(it.color || '#f6f6f3');
    // The tub: an outer shell with an inset well.
    rbox(B, porc, w, h, d, 0, 0, 0, 0.14);
    const g = new THREE.BoxGeometry(w - 0.6, h, d - 0.5);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const t = (p.getY(i) + h / 2) / h; p.setX(i, p.getX(i) * (0.82 + t * 0.18)); p.setZ(i, p.getZ(i) * (0.8 + t * 0.2)); }
    g.computeVertexNormals();
    B.add(g, M.porcelain('#eceae4'), { pos: [0, h / 2 + 0.28, 0] });
    slab(B, M.clearGlass('#cfe0e6'), w - 0.75, 0.05, d - 0.65, 0, h - 0.55, 0);
    B.tube(M.chrome(), [-w / 2 + 0.5, h, -d / 2 + 0.3], [-w / 2 + 0.5, h + 0.55, -d / 2 + 0.3], 0.05, 8);
    B.tube(M.chrome(), [-w / 2 + 0.5, h + 0.55, -d / 2 + 0.3], [-w / 2 + 0.5, h + 0.45, -d / 2 + 0.8], 0.045, 8);
    for (const sz of [-1, 1]) barZ(B, M.chrome(), 0.035, 0.4, -w / 2 + 0.5 + sz * 0.3, h + 0.25, -d / 2 + 0.3, 6);
    void it;
  },
  shower(B, it, { w, d, h }) {
    const tray = M.porcelain('#f6f6f3');
    slab(B, tray, w, 0.35, d, 0, 0, 0);
    const gl = M.clearGlass('#dfeef2');
    // Two glass sides, a door panel, and the fittings on the back wall.
    slab(B, gl, 0.06, h - 0.35, d, -w / 2 + 0.03, 0.35, 0);
    slab(B, gl, w, h - 0.35, 0.06, 0, 0.35, d / 2 - 0.03);
    slab(B, gl, w * 0.55, h - 0.35, 0.06, -w * 0.2, 0.35, -d / 2 + 0.03);
    for (const [x, z, rot] of [[-w / 2 + 0.03, 0, [0, 0, 0]]]) void [x, z, rot];
    slab(B, M.chrome(), w, 0.1, 0.1, 0, h - 0.1, d / 2 - 0.03);
    barZ(B, M.chrome(), 0.04, 0.5, w * 0.1, h / 2, -d / 2 + 0.12, 8);
    B.tube(M.chrome(), [w / 2 - 0.5, 1, -d / 2 + 0.2], [w / 2 - 0.5, h - 1.4, -d / 2 + 0.2], 0.06, 8);
    B.tube(M.chrome(), [w / 2 - 0.5, h - 1.4, -d / 2 + 0.2], [w / 2 - 0.5, h - 1.4, -d / 2 + 0.9], 0.055, 8);
    disc(B, M.chrome(), 0.5, 0.08, w / 2 - 0.5, h - 1.5, -d / 2 + 0.9, 18);
    slab(B, M.chrome(), 0.5, 0.7, 0.2, w / 2 - 0.5, 3.2, -d / 2 + 0.18);
  },
  showerbath(B, it, { w, d, h }) {
    BATH_B.bathtub(B, it, { w, d, h: 2 });
    const gl = M.clearGlass('#dfeef2');
    slab(B, gl, w * 0.45, h - 2, 0.07, -w / 2 + w * 0.22, 2, 0);
    slab(B, M.chrome(), 0.09, h - 2, 0.12, -w / 2 + w * 0.45, 2, 0);
    B.tube(M.chrome(), [w / 2 - 0.6, 2.4, -d / 2 + 0.2], [w / 2 - 0.6, h - 0.8, -d / 2 + 0.2], 0.06, 8);
    B.tube(M.chrome(), [w / 2 - 0.6, h - 0.8, -d / 2 + 0.2], [w / 2 - 0.6, h - 0.8, -d / 2 + 0.8], 0.055, 8);
    disc(B, M.chrome(), 0.42, 0.08, w / 2 - 0.6, h - 0.9, -d / 2 + 0.8, 16);
  },
  toilet(B, it, { w, d, h }) {
    const porc = M.porcelain('#f6f6f3');
    // Cistern, bowl on its foot, and the seat.
    slab(B, porc, w, h - 1.1, 0.75, 0, 1.1, -d / 2 + 0.38);
    slab(B, porc, w - 0.1, 0.1, 0.85, 0, h - 0.1, -d / 2 + 0.38);
    lathe(B, porc, [[0.42, 0], [0.5, 0.3], [0.42, 0.9], [0.62, 1.25], [0.68, 1.4]], 0, 0, d * 0.12, 18);
    const bowl = new THREE.BoxGeometry(w - 0.25, 0.55, d * 0.62);
    const p = bowl.attributes.position;
    for (let i = 0; i < p.count; i++) { const t = (p.getY(i) + 0.275) / 0.55; p.setX(i, p.getX(i) * (0.7 + t * 0.3)); p.setZ(i, p.getZ(i) * (0.75 + t * 0.25)); }
    bowl.computeVertexNormals();
    B.add(bowl, porc, { pos: [0, 1.65, d * 0.12] });
    B.add(new THREE.TorusGeometry(0.62, 0.09, 7, 18), M.plastic('#f1f0ec', 0.4), { pos: [0, 1.96, d * 0.12], rot: [PI / 2, 0, 0], scale: [1.1, 1.25, 1] });
    slab(B, M.plastic('#f1f0ec', 0.4), w - 0.3, 0.07, 0.4, 0, 1.96, -d / 2 + 0.75, [-0.25, 0, 0]);
    disc(B, M.chrome(), 0.14, 0.05, w * 0.2, h, -d / 2 + 0.38, 12);
    void it;
  },
  toiletwall(B, it, { w, d, h }) {
    const porc = M.porcelain('#f6f6f3');
    slab(B, M.laminate('#e9e6df', 0.4), w + 1.4, h, 0.5, 0, 0, 0.25);
    const bowl = new THREE.BoxGeometry(w, 0.75, d);
    const p = bowl.attributes.position;
    for (let i = 0; i < p.count; i++) { const t = (p.getY(i) + 0.375) / 0.75; const u = (p.getZ(i) + d / 2) / d; p.setX(i, p.getX(i) * (0.72 + t * 0.28) * (0.65 + u * 0.35)); }
    bowl.computeVertexNormals();
    B.add(bowl, porc, { pos: [0, 1.5, d / 2 + 0.4] });
    B.add(new THREE.TorusGeometry(0.58, 0.08, 7, 18), M.plastic('#f1f0ec', 0.4), { pos: [0, 1.9, d / 2 + 0.45], rot: [PI / 2, 0, 0], scale: [1.05, 1.3, 1] });
    slab(B, M.chrome(), 0.8, 0.5, 0.06, 0, h - 0.9, 0.52);
    void it;
  },
  urinal(B, it, { w, d, h }) {
    const porc = M.porcelain('#f6f6f3');
    const g = new THREE.BoxGeometry(w, h - 0.6, d);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const t = (p.getY(i) + (h - 0.6) / 2) / (h - 0.6); p.setX(i, p.getX(i) * (0.72 + t * 0.28)); p.setZ(i, p.getZ(i) * (0.5 + t * 0.5)); }
    g.computeVertexNormals();
    B.add(g, porc, { pos: [0, 2.3 + (h - 0.6) / 2, d / 2] });
    lathe(B, porc, [[0.45, 0], [0.3, 0.4], [0.26, 0.75]], 0, 1.9, d * 0.4, 14);
    B.tube(M.chrome(), [0, 2.3 + h - 0.6, 0.1], [0, 2.3 + h - 0.2, 0.1], 0.05, 8);
    disc(B, M.chrome(), 0.14, 0.05, 0, 2.3 + h - 0.15, 0.1, 12);
    void it;
  },
  basinped(B, it, { w, d, h }) {
    const porc = M.porcelain('#f6f6f3');
    lathe(B, porc, [[0.5, 0], [0.42, 0.4], [0.38, h - 0.8], [0.55, h - 0.55]], 0, 0, d * 0.35, 18);
    const g = new THREE.BoxGeometry(w, 0.55, d);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const t = (p.getY(i) + 0.275) / 0.55; p.setX(i, p.getX(i) * (0.62 + t * 0.38)); p.setZ(i, p.getZ(i) * (0.62 + t * 0.38)); }
    g.computeVertexNormals();
    B.add(g, porc, { pos: [0, h - 0.27, d / 2] });
    slab(B, M.painted('#e9e9e4', 0.7), w - 0.55, 0.03, d - 0.5, 0, h - 0.12, d / 2);
    B.tube(M.chrome(), [0, h, 0.2], [0, h + 0.55, 0.2], 0.05, 8);
    B.tube(M.chrome(), [0, h + 0.55, 0.2], [0, h + 0.42, d * 0.62], 0.045, 8);
    for (const sx of [-1, 1]) barZ(B, M.chrome(), 0.035, 0.35, sx * 0.3, h + 0.22, 0.2, 6);
    void it;
  },
  vanity(B, it, { w, d, h }) {
    const m = wood(it, 1);
    const top = worktop(it.color2 || STONE[1][0]);
    slab(B, m, w, h - 0.5, d, 0, 0.5, 0);
    const cols = Math.max(2, Math.round(w / 2));
    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + (w / cols) * (c + 0.5);
      rbox(B, m, w / cols - 0.07, h - 0.65, 0.07, x, 0.57, d / 2 - 0.03, 0.012);
      barX(B, M.metal('#b9bfc4', 0.3), 0.025, (w / cols) * 0.5, x, h - 0.5, d / 2 + 0.04, 6);
    }
    rbox(B, top, w, 0.12, d, 0, h - 0.12, 0, 0.015);
    for (let c = 0; c < Math.max(1, Math.floor(cols / 2)); c++) {
      const x = cols > 2 ? (c - (Math.floor(cols / 2) - 1) / 2) * (w / Math.floor(cols / 2)) : 0;
      slab(B, M.porcelain('#f6f6f3'), 1.5, 0.1, 1.1, x, h - 0.1, 0.05);
      slab(B, M.painted('#e9e9e4', 0.7), 1.3, 0.04, 0.95, x, h - 0.12, 0.05);
      B.tube(M.chrome(), [x, h, -d / 2 + 0.3], [x, h + 0.65, -d / 2 + 0.3], 0.045, 8);
      B.tube(M.chrome(), [x, h + 0.65, -d / 2 + 0.3], [x, h + 0.52, -d / 2 + 0.8], 0.04, 8);
    }
  },
  basinrow(B, it, { w, d, h }) {
    const stone = M.laminate(it.color || STONE[2][0], 0.3);
    rbox(B, stone, w, 0.5, d, 0, h - 0.5, 0, 0.03);
    const g = new THREE.BoxGeometry(w - 0.5, 0.42, d - 0.35);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const t = (p.getY(i) + 0.21) / 0.42; p.setZ(i, p.getZ(i) * (0.55 + t * 0.45)); }
    g.computeVertexNormals();
    B.add(g, M.porcelain('#eceae4'), { pos: [0, h - 0.24, 0.05] });
    for (const sx of [-1, 1]) slab(B, M.metal('#b9bfc4', 0.35), 0.14, h - 0.5, d - 0.4, sx * (w / 2 - 0.6), 0, 0);
    const n = Math.max(2, Math.round(w / 2.4));
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (w / n) * (i + 0.5);
      B.tube(M.chrome(), [x, h, -d / 2 + 0.25], [x, h + 0.75, -d / 2 + 0.25], 0.05, 8);
      B.tube(M.chrome(), [x, h + 0.75, -d / 2 + 0.25], [x, h + 0.6, -d / 2 + 0.85], 0.045, 8);
    }
  },
  towelrail(B, it, { w, d, h }) {
    const m = M.chrome();
    for (const sx of [-1, 1]) slab(B, m, 0.12, h, 0.12, sx * (w / 2 - 0.06), 3, d - 0.1);
    for (let i = 0; i < 7; i++) B.add(cylGeo(0.06, 0.06, w - 0.1, 8).rotateZ(PI / 2), m, { pos: [0, 3.2 + i * ((h - 0.5) / 7), d - 0.1] });
    for (const sx of [-1, 1]) slab(B, m, 0.18, 0.3, d, sx * (w / 2 - 0.06), 3.3, d / 2);
    const r = rng(seedOf(it) * 457 + 1);
    cushion(B, M.cloth(['#dfe3e8', '#c9d9c2', '#e2d2c2'][Math.floor(r() * 3)]), w * 0.6, 1.6, 0.22, w * 0.1, 3.2 + 3 * ((h - 0.5) / 7), d + 0.02, { puff: 0.05, r: 0.08 });
  },
  bathmirror(B, it, { w, h }) {
    slab(B, M.metal('#c9ced3', 0.3), w, h, 0.1, 0, 0, 0.05);
    slab(B, M.mirror(), w - 0.18, h - 0.18, 0.04, 0, 0.09, 0.11);
    slab(B, M.glow('#f4f8fb', 0.9), w - 0.5, 0.06, 0.06, 0, h + 0.08, 0.08);
    void it;
  },
  showerscreen(B, it, { w, h }) {
    slab(B, M.clearGlass('#dfeef2'), w, h, 0.07, 0, 0, 0.2);
    slab(B, M.chrome(), 0.1, h, 0.14, -w / 2 + 0.05, 0, 0.2);
    slab(B, M.chrome(), 0.14, 0.3, 0.3, -w / 2 + 0.05, h - 0.3, 0.1);
    void it;
  },
  bathcab(B, it, { w, d, h }) {
    const m = lam(it);
    slab(B, m, w, h, d, 0, 4, d / 2);
    for (const sx of [-1, 1]) {
      slab(B, M.mirror(), w / 2 - 0.06, h - 0.1, 0.05, sx * w / 4, 4.05, d - 0.02);
      barZ(B, M.metal('#b9bfc4', 0.3), 0.03, 0.15, -sx * 0.18, 4 + h / 2, d + 0.05, 6);
    }
    void it;
  },
  drier(B, it, { w, d, h }) {
    const m = M.metal('#c9ced3', 0.3);
    const g = new THREE.BoxGeometry(w, h, d);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const u = (p.getZ(i) + d / 2) / d; p.setY(i, p.getY(i) * (1 - u * 0.35)); }
    g.computeVertexNormals();
    B.add(g, m, { pos: [0, 3.4 + h / 2, d / 2] });
    slab(B, M.painted('#17191c', 0.6), w * 0.6, 0.1, 0.1, 0, 3.4 + h * 0.2, d - 0.02);
    disc(B, M.glow('#6ae08a', 0.6), 0.05, 0.03, 0, 3.4 + h * 0.75, d, 8);
    void it;
  },
  babychange(B, it, { w, d, h }) {
    const m = M.plastic('#d9d4c7', 0.6);
    slab(B, m, w, 0.3, d, 0, 2.5, d / 2);
    for (const sz of [-1, 1]) slab(B, m, w, 0.55, 0.14, 0, 2.8, d / 2 + sz * (d / 2 - 0.07));
    for (const sx of [-1, 1]) slab(B, m, 0.14, 0.55, d, sx * (w / 2 - 0.07), 2.8, d / 2);
    slab(B, M.painted('#8a8f96', 0.5), w * 0.5, 0.12, 0.12, 0, 2.3, d * 0.9, [0.5, 0, 0]);
    void [it, h];
  },
};

register([...LIVING, ...BEDROOM, ...HOME, ...BATH],
  { ...LIVING_B, ...BEDROOM_B, ...HOME_B, ...BATH_B });

void [labelMat, handle, barZ, post, screenMat];
