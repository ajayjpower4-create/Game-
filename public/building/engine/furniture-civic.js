/* Furniture for schools, clinics, lobbies, workshops and gyms. */

import { register } from './furniture.js';
import {
  PI, WOODS, FABRICS, LEATHERS, LAMINATES, METALS, BRIGHTS,
  rbox, slab, cushion, post, disc, barX, barZ, lathe, legs, handle, cabinet, stock,
  face, labelMat, screenMat, artMat, monitor, keyboard, foliage, shadeHex, rng, cylGeo, THREE, M,
} from './furnkit.js';
import { DESK_H, TABLE_H, COUNTER_H, shelfRun, chairBase, seatPad } from './furniture-work.js';
import { carModel } from './cars.js';
import { CARS } from '../vehiclelist.js';

const seedOf = (it) => it.seed || 1;
const blackPl = (r = 0.5) => M.plastic('#2b2f36', r);
const steelLeg = () => M.painted('#3d434b', 0.45);
const wood = (it, i = 0) => M.grain(it.color || WOODS[i][0], 0.45);
const lam = (it, i = 0) => M.laminate(it.color || LAMINATES[i][0], 0.42);

/* ======================================================================= */
/*                                 SCHOOL                                   */
/* ======================================================================= */

/** A school chair: a bent tube frame with a moulded shell. */
function shellChair(B, hex, seatH, { scale = 1 } = {}) {
  const m = M.metal('#aeb4ba', 0.3);
  const sh = M.plastic(hex, 0.5);
  const w = 1.45 * scale;
  for (const sx of [-1, 1]) {
    B.tube(m, [sx * (w / 2 - 0.1), 0.03, 0.62 * scale], [sx * (w / 2 - 0.1), seatH, 0.55 * scale], 0.045, 6);
    B.tube(m, [sx * (w / 2 - 0.1), 0.03, -0.6 * scale], [sx * (w / 2 - 0.1), seatH + 1.5 * scale, -0.72 * scale], 0.045, 6);
    B.tube(m, [sx * (w / 2 - 0.1), 0.03, 0.62 * scale], [sx * (w / 2 - 0.1), 0.03, -0.6 * scale], 0.045, 6);
  }
  barX(B, m, 0.045, w - 0.2, 0, seatH - 0.1, 0, 6);
  cushion(B, sh, w, 0.12, 1.4 * scale, 0, seatH, 0, { puff: 0.2, r: 0.18 });
  cushion(B, sh, w - 0.1, 1.1 * scale, 0.14, 0, seatH + 0.75 * scale, -0.72 * scale, { rot: [0.14, 0, 0], puff: 0.12, r: 0.16 });
}

const SCHOOL = [
  ['school', 'deskstudent', 'Student desk', '📝', 2.4, 2, 2.4, { colors: WOODS, surface: 2.4 }],
  ['school', 'deskdouble', 'Double desk', '✏️', 4.4, 2, 2.4, { colors: WOODS, surface: 2.4 }],
  ['school', 'tablegroup', 'Group table', '👥', 5, 4, 2.3, { colors: LAMINATES, surface: 2.3 }],
  ['school', 'chairschool', 'School chair', '🪑', 1.6, 1.7, 2.7, { colors: BRIGHTS }],
  ['school', 'deskteacher', 'Teacher desk', '🧑‍🏫', 5, 2.6, 2.6, { colors: WOODS, surface: DESK_H }],
  ['school', 'boardteach', 'Teaching whiteboard', '🧮', 12, 0.5, 4.4, { wall: true, mount: 5.6, len: true }],
  ['school', 'smartboard', 'Interactive screen', '🖥️', 7, 0.4, 4.2, { wall: true, mount: 5.4 }],
  ['school', 'cubbies', 'Cubby unit', '🎒', 5, 1.4, 4, { colors: BRIGHTS, len: true }],
  ['school', 'tablecanteen', 'Canteen bench table', '🍱', 10, 5, 2.5, { colors: LAMINATES, len: true, surface: 2.5 }],
  ['school', 'labbench', 'Science bench', '🧪', 8, 2.8, 3.1, { len: true, surface: 3.1 }],
  ['school', 'labstool', 'Lab stool', '🔬', 1.4, 1.4, 2.6, { colors: BRIGHTS }],
  ['school', 'easel', 'Art easel', '🎨', 2.4, 2.2, 5.4, {}],
  ['school', 'bookbox', 'Book trolley', '📗', 3, 1.6, 3.4, { colors: BRIGHTS }],
  ['school', 'projector', 'Ceiling projector', '📽️', 1.4, 1.6, 1.6, { ceil: true }],
];

const SCHOOL_B = {
  deskstudent: (B, it, dim) => schoolDesk(B, it, dim, 1),
  deskdouble: (B, it, dim) => schoolDesk(B, it, dim, 2),
  tablegroup(B, it, { w, d, h }) {
    rbox(B, lam(it), w, 0.12, d, 0, h - 0.12, 0, 0.1);
    legs(B, M.metal('#aeb4ba', 0.3), w, d, h - 0.12, { round: true, t: 0.14, inset: 0.35 });
    for (const sx of [-1, 1]) barZ(B, M.metal('#aeb4ba', 0.3), 0.055, d - 0.7, sx * (w / 2 - 0.35), 0.5, 0, 6);
  },
  chairschool(B, it) {
    shellChair(B, it.color || BRIGHTS[1][0], 1.35);
  },
  deskteacher(B, it, { w, d }) {
    const m = wood(it, 1);
    rbox(B, m, w, 0.14, d, 0, DESK_H - 0.14, 0, 0.03);
    slab(B, m, w - 0.3, DESK_H - 0.3, 0.1, 0, 0.15, -d / 2 + 0.2);
    cabinet(B, { w: 1.8, h: DESK_H - 0.14, d: d - 0.2, x: w / 2 - 1, body: m, front: m, cols: 1, rows: 3, kind: 'drawer', toe: 0.15 });
    for (const sz of [-1, 1]) slab(B, m, 0.14, DESK_H - 0.3, d - 0.3, -w / 2 + 0.07, 0.15, 0);
    monitor(B, -w / 4, DESK_H, -d * 0.2, { w: 1.8, kind: 'desktop', seed: seedOf(it) });
    keyboard(B, -w / 4, DESK_H, d * 0.1);
    const r = rng(seedOf(it) * 263 + 2);
    for (let i = 0; i < 4; i++) slab(B, M.laminate(['#f6f5f1', '#e9e2d0'][i % 2], 0.7), 0.75, 0.04, 1, w / 2 - 2.6, DESK_H + i * 0.04, 0.2, [0, (r() - 0.5) * 0.2, 0]);
  },
  boardteach(B, it, { w, h }) {
    const fr = M.metal('#b9bfc4', 0.35);
    slab(B, fr, w, h, 0.16, 0, 0, 0.02);
    slab(B, M.porcelain('#fbfbf9'), w - 0.3, h - 0.3, 0.05, 0, 0.15, 0.17);
    slab(B, fr, w, 0.2, 0.42, 0, -0.2, 0.06);
    // Ruled squares on one half, like a maths board.
    const r = rng(seedOf(it) * 269 + 1);
    for (let i = 0; i < 12; i++) {
      slab(B, M.painted(['#1f4f9c', '#c0392b', '#1f7a54'][Math.floor(r() * 3)], 0.4), 0.7 + r() * 2.6, 0.05, 0.01, -w / 2 + 1 + r() * (w - 3), h * 0.25 + Math.floor(r() * 6) * h * 0.12, 0.2);
    }
    for (let i = 0; i < 5; i++) B.add(cylGeo(0.07, 0.07, 0.5, 8).rotateZ(PI / 2), M.plastic(['#c0392b', '#1f4f9c', '#1f7a54', '#2b2f36', '#e36a1c'][i], 0.4), { pos: [-w / 2 + 0.8 + i * 0.35, -0.06, 0.24] });
  },
  smartboard(B, it, { w, h }) {
    slab(B, M.pianoBlack(), w, h, 0.26, 0, 0, 0.13);
    face(B, screenMat(['chart', 'sheet', 'menu', 'desktop'][seedOf(it) % 4], seedOf(it)), w - 0.3, h - 0.3, 0, h / 2, 0.27);
    slab(B, M.painted('#17191c', 0.5), w * 0.3, 0.12, 0.3, 0, -0.1, 0.16);
  },
  cubbies(B, it, { w, d, h }) {
    const m = M.laminate('#e9e6df', 0.5);
    const col = M.plastic(it.color || BRIGHTS[0][0], 0.5);
    const r = rng(seedOf(it) * 271 + 3);
    const n = Math.max(2, Math.round(w / 1.4));
    slab(B, m, w, h, 0.06, 0, 0, -d / 2 + 0.03);
    for (let i = 0; i <= n; i++) slab(B, m, 0.07, h, d, -w / 2 + (w / n) * i, 0, 0);
    for (let k = 0; k <= 2; k++) slab(B, m, w, 0.07, d, 0, (k * (h - 0.07)) / 2, 0);
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (w / n) * (i + 0.5);
      if (r() < 0.75) {
        // A bag or a stack of books in the pigeonhole.
        if (r() < 0.5) rbox(B, M.cloth(['#c0392b', '#1f4f9c', '#1f7a54', '#6d4a8a'][Math.floor(r() * 4)]), w / n - 0.4, 0.9, d - 0.5, x, 0.07, 0, 0.15);
        else stock(B, r, x - w / n / 2 + 0.2, x + w / n / 2 - 0.2, h / 2 + 0.07, -d / 2 + 0.2, d / 2 - 0.2, 'books', { maxH: 0.8 });
      }
      slab(B, col, w / n - 0.12, 0.3, 0.03, x, h - 0.4, d / 2 - 0.01);
    }
    slab(B, col, w, 0.18, d + 0.1, 0, h - 0.18, 0);
  },
  tablecanteen(B, it, { w, d, h }) {
    const top = lam(it);
    const m = M.metal('#aeb4ba', 0.35);
    rbox(B, top, w, 0.12, d / 2.6, 0, h - 0.12, 0, 0.06);
    for (const sz of [-1, 1]) rbox(B, top, w, 0.1, d / 4.4, 0, 1.45, sz * (d / 2 - d / 8.8), 0.06);
    const n = Math.max(2, Math.round(w / 5) + 1);
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + 0.6 + i * ((w - 1.2) / (n - 1));
      slab(B, m, 0.16, h - 0.12, 0.16, x, 0, 0);
      for (const sz of [-1, 1]) {
        B.tube(m, [x, h - 0.4, 0], [x, 1.55, sz * (d / 2 - d / 8.8)], 0.07, 6);
        B.tube(m, [x, 1.45, sz * (d / 2 - d / 8.8)], [x, 0.05, sz * (d / 2 - d / 8.8) * 0.9], 0.07, 6);
      }
      slab(B, m, 0.4, 0.1, d - 1.2, x, 0, 0);
    }
  },
  labbench(B, it, { w, d, h }) {
    const body = M.laminate('#3d434b', 0.5);
    const r = rng(seedOf(it) * 277 + 5);
    cabinet(B, { w, h, d, body, front: body, cols: Math.max(2, Math.round(w / 2.4)), kind: 'door', top: M.laminate('#1f2226', 0.35), topT: 0.14, over: 0.08 });
    // Sinks, taps, gas outlets and a reagent shelf.
    for (let i = 0; i < 2; i++) {
      const x = -w / 2 + 1.6 + i * (w - 3.2);
      slab(B, M.porcelain('#e9e9e4'), 1.3, 0.1, 1.1, x, h - 0.02, 0.1);
      slab(B, M.painted('#17191c', 0.9), 1.1, 0.06, 0.9, x, h - 0.06, 0.1);
      B.tube(M.chrome(), [x, h + 0.14, -0.5], [x, h + 1.1, -0.5], 0.05, 8);
      B.tube(M.chrome(), [x, h + 1.1, -0.5], [x, h + 0.95, 0.05], 0.045, 8);
    }
    for (let i = 0; i < Math.floor(w / 2.2); i++) {
      const x = -w / 2 + 1.1 + i * 2.2;
      post(B, M.painted('#2e6f8e', 0.4), 0.09, 0.11, 0.5, x, h + 0.14, -d / 2 + 0.35, 8);
      barZ(B, M.painted('#2e6f8e', 0.4), 0.05, 0.3, x, h + 0.5, -d / 2 + 0.5, 6);
    }
    for (let i = 0; i < 6; i++) if (r() < 0.7) {
      lathe(B, M.clearGlass('#dfeef2'), [[0.01, 0], [0.22, 0.03], [0.24, 0.5], [0.1, 0.62], [0.09, 0.78]], -w / 2 + 2.6 + r() * (w - 5), h + 0.14, (r() - 0.5) * (d - 1.2), 12);
    }
  },
  labstool(B, it, { h }) {
    const m = M.metal('#aeb4ba', 0.3);
    legs(B, m, 1.2, 1.2, h - 0.22, { round: true, t: 0.1, splay: 0.09 });
    B.add(new THREE.TorusGeometry(0.58, 0.045, 5, 16), m, { pos: [0, 0.8, 0], rot: [PI / 2, 0, 0] });
    cushion(B, M.plastic(it.color || BRIGHTS[2][0], 0.5), 1.35, 0.22, 1.35, 0, h - 0.22, 0, { puff: 0.25, r: 0.2 });
  },
  easel(B, it, { w, d, h }) {
    const m = M.grain('#c9a06a', 0.6);
    for (const sx of [-1, 1]) B.tube(m, [sx * (w / 2 - 0.2), 0, d / 2 - 0.3], [sx * 0.12, h, -0.1], 0.08, 6);
    B.tube(m, [0, 0, -d / 2 + 0.2], [0, h - 0.6, -0.1], 0.08, 6);
    for (const y of [1.3, 3]) barX(B, m, 0.06, w - 0.5, 0, y, 0.25 - (y / h) * 0.35, 6);
    slab(B, m, w - 0.3, 0.14, 0.4, 0, 2.3, 0.18, [-0.1, 0, 0]);
    slab(B, M.laminate('#f4f2ea', 0.8), 2, 2.4, 0.06, 0, 2.44, 0.2, [-0.1, 0, 0]);
    face(B, artMat(seedOf(it), 'abstract'), 1.8, 2.2, 0, 3.64, 0.26, [-0.1, 0, 0]);
  },
  bookbox(B, it, { w, d, h }) {
    const m = M.laminate(it.color || BRIGHTS[1][0], 0.5);
    const r = rng(seedOf(it) * 281 + 1);
    for (const sx of [-1, 1]) slab(B, m, 0.09, h - 0.3, d, sx * (w / 2 - 0.05), 0.3, 0);
    slab(B, m, w, 0.09, d, 0, 0.3, 0);
    for (const sz of [-1, 1]) {
      slab(B, m, w - 0.2, 1.1, 0.07, 0, h - 1.3, sz * (d / 2 - 0.04), [sz * 0.18, 0, 0]);
      slab(B, m, w - 0.2, 0.09, d / 2 - 0.1, 0, h - 1.4, sz * (d / 4), [sz * 0.18, 0, 0]);
      stock(B, r, -w / 2 + 0.2, w / 2 - 0.2, h - 1.35, sz > 0 ? 0.05 : -d / 2 + 0.1, sz > 0 ? d / 2 - 0.1 : -0.05, 'books', { maxH: 0.95 });
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add(cylGeo(0.15, 0.15, 0.08, 10).rotateZ(PI / 2), blackPl(0.6), { pos: [sx * (w / 2 - 0.15), 0.15, sz * (d / 2 - 0.3)] });
  },
  projector(B, it, { w, d, h }) {
    const m = M.painted('#e9e6df', 0.4);
    post(B, M.metal('#9aa1a8', 0.4), 0.06, 0.06, h - 0.8, 0, -(h - 0.8), 0, 8);
    disc(B, M.metal('#9aa1a8', 0.4), 0.3, 0.06, 0, -0.06, 0, 12);
    rbox(B, m, w, 0.7, d, 0, -h, 0, 0.06);
    disc(B, M.lens(), 0.22, 0.14, 0, -h + 0.35, d / 2, 14);
    B.add(cylGeo(0.22, 0.22, 0.2, 14).rotateX(PI / 2), m, { pos: [0, -h + 0.35, d / 2 + 0.08] });
    void it;
  },
};

function schoolDesk(B, it, { w, d, h }, places) {
  const m = wood(it, 2);
  const f = M.metal('#aeb4ba', 0.3);
  rbox(B, m, w, 0.1, d, 0, h - 0.1, 0, 0.06);
  slab(B, M.laminate('#d9d4c7', 0.6), w - 0.4, 0.06, d - 0.5, 0, h - 0.5, 0);   // book tray
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2 - 0.3);
    B.tube(f, [x, 0.03, d / 2 - 0.25], [x, 0.03, -d / 2 + 0.25], 0.05, 6);
    B.tube(f, [x, 0.03, d / 2 - 0.25], [x, h - 0.1, d / 2 - 0.3], 0.05, 6);
    B.tube(f, [x, 0.03, -d / 2 + 0.25], [x, h - 0.1, -d / 2 + 0.3], 0.05, 6);
  }
  const r = rng(seedOf(it) * 283 + 2);
  for (let i = 0; i < places; i++) {
    const x = places === 1 ? 0 : (i - 0.5) * (w / 2);
    if (r() < 0.7) slab(B, M.laminate('#f6f5f1', 0.75), 0.8, 0.03, 1.05, x, h, 0.1, [0, (r() - 0.5) * 0.3, 0]);
    if (r() < 0.5) B.add(cylGeo(0.04, 0.04, 0.5, 6).rotateZ(PI / 2), M.plastic(['#e2b31b', '#c0392b', '#1f4f9c'][Math.floor(r() * 3)], 0.4), { pos: [x + 0.2, h + 0.05, 0.35], rot: [0, r(), 0] });
  }
}

/* ======================================================================= */
/*                                MEDICAL                                   */
/* ======================================================================= */

const MEDICAL = [
  ['medical', 'bedward', 'Hospital bed', '🛏️', 3.6, 7.4, 4.4, { colors: [['#dfe6ea', 'White'], ['#cfe0e6', 'Blue'], ['#e2e6d9', 'Green']] }],
  ['medical', 'couchexam', 'Examination couch', '🩻', 2.6, 6.4, 2.9, { colors: [['#2e6f8e', 'Blue'], ['#3f6b52', 'Green'], ['#6d4a8a', 'Plum'], ['#55585d', 'Grey']] }],
  ['medical', 'chairdental', 'Treatment chair', '🦷', 3, 6, 5, { colors: [['#2e6f8e', 'Blue'], ['#3f6b52', 'Green'], ['#d9d4c7', 'Sand']] }],
  ['medical', 'trolleycrash', 'Crash trolley', '🚑', 2.4, 1.8, 3.6, {}],
  ['medical', 'cabmedical', 'Medicine cabinet', '💊', 3, 1.6, 6.4, {}],
  ['medical', 'sinkclinical', 'Clinical wash basin', '🧼', 2.2, 1.8, 4.2, { wall: true, mount: 0 }],
  ['medical', 'ivstand', 'Drip stand', '💉', 1.6, 1.6, 6.2, {}],
  ['medical', 'vitals', 'Patient monitor', '📈', 1.6, 1.4, 5.4, {}],
  ['medical', 'benchwait', 'Waiting bench', '⏳', 8, 2.4, 2.9, { colors: FABRICS, len: true }],
  ['medical', 'nursestation', 'Nurses station', '🧑‍⚕️', 9, 3.4, 3.8, { colors: LAMINATES, len: true }],
  ['medical', 'stoolclinical', 'Clinician stool', '🪑', 1.6, 1.6, 2.6, { colors: [['#2e6f8e', 'Blue'], ['#3f6b52', 'Green'], ['#2b2f36', 'Black']] }],
  ['medical', 'wheelchair', 'Wheelchair', '♿', 2.4, 3.6, 3.3, {}],
  ['medical', 'scales', 'Column scales', '⚖️', 1.6, 1.8, 4.4, {}],
  ['medical', 'sharps', 'Sharps bin', '⚠️', 0.9, 0.7, 1.2, { wall: true, mount: 4.2 }],
  ['medical', 'geldispenser', 'Hand gel dispenser', '🧴', 0.6, 0.5, 1.1, { wall: true, mount: 4.4 }],
  ['medical', 'lightbox', 'X-ray viewer', '🩻', 2.4, 0.2, 2, { wall: true, mount: 5 }],
];

const MEDICAL_B = {
  bedward(B, it, { w, d, h }) {
    const m = M.painted('#e9eaea', 0.4);
    const chrome = M.metal('#c9ced3', 0.3);
    // Frame and castors.
    slab(B, m, w - 0.3, 0.3, d - 0.6, 0, 1.6, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      post(B, chrome, 0.1, 0.1, 1.6, sx * (w / 2 - 0.5), 0, sz * (d / 2 - 0.7), 8);
      B.add(cylGeo(0.2, 0.2, 0.1, 10).rotateZ(PI / 2), blackPl(0.6), { pos: [sx * (w / 2 - 0.5), 0.2, sz * (d / 2 - 0.7)] });
    }
    // Mattress, raised at the head, and the bedding.
    const mat = M.cloth(it.color || '#dfe6ea');
    cushion(B, mat, w - 0.5, 0.6, d * 0.58, 0, 1.9, d * 0.2, { puff: 0.1 });
    cushion(B, mat, w - 0.5, 0.6, d * 0.38, 0, 2.0, -d * 0.29, { rot: [-0.22, 0, 0], puff: 0.1 });
    cushion(B, M.cloth('#f4f6f7'), w - 0.6, 0.3, d * 0.42, 0, 2.5, d * 0.26, { puff: 0.2 });
    cushion(B, M.cloth('#f8f8f6'), w - 1.1, 0.4, 1.4, 0, 2.45, -d * 0.3, { rot: [-0.22, 0, 0], puff: 0.3 });
    // Head and foot boards, and side rails.
    for (const [sz, bh] of [[-1, 1.5], [1, 1.1]]) {
      rbox(B, M.laminate('#e9e6df', 0.5), w, bh, 0.18, 0, 1.75, sz * (d / 2 - 0.15), 0.08);
      slab(B, chrome, w - 0.1, 0.12, 0.3, 0, 1.75 + bh, sz * (d / 2 - 0.15));
    }
    for (const sx of [-1, 1]) {
      slab(B, M.plastic('#d9d9d6', 0.5), 0.12, 0.8, d * 0.4, sx * (w / 2 - 0.2), 2.3, -d * 0.1);
      for (const y of [2.35, 2.95]) B.add(cylGeo(0.06, 0.06, d * 0.4, 8).rotateX(PI / 2), chrome, { pos: [sx * (w / 2 - 0.2), y, -d * 0.1] });
    }
    void h;
  },
  couchexam(B, it, { w, d, h }) {
    const vinyl = M.leather(it.color || '#2e6f8e', 0.4);
    const base = M.painted('#e9eaea', 0.4);
    slab(B, base, w - 0.8, h - 0.7, d - 2.4, 0, 0, 0.2);
    slab(B, M.metal('#b9bfc4', 0.35), w - 0.3, 0.25, d - 1.6, 0, h - 0.7, 0.1);
    cushion(B, vinyl, w, 0.45, d * 0.62, 0, h - 0.45, d * 0.18, { puff: 0.1 });
    cushion(B, vinyl, w, 0.45, d * 0.34, 0, h - 0.4, -d * 0.3, { rot: [-0.3, 0, 0], puff: 0.1 });
    // Paper roll at the head.
    B.add(cylGeo(0.3, 0.3, w - 0.2, 12).rotateZ(PI / 2), M.plastic('#f8f8f6', 0.8), { pos: [0, h + 0.1, -d / 2 + 0.3] });
    slab(B, M.plastic('#f8f8f6', 0.8), w - 0.3, 0.02, d * 0.5, 0, h - 0.02, -d * 0.12, [-0.3, 0, 0]);
    slab(B, M.painted('#55585d', 0.5), 0.5, 0.6, 0.3, w / 2 - 0.5, h - 1.3, d / 2 - 0.9);
  },
  chairdental(B, it, { w, d, h }) {
    const vinyl = M.leather(it.color || '#2e6f8e', 0.4);
    const base = M.painted('#e9eaea', 0.4);
    lathe(B, base, [[1.1, 0], [1, 0.2], [0.4, 0.35], [0.36, 1.1]], 0, 0, d * 0.1, 20);
    slab(B, M.metal('#b9bfc4', 0.35), 1.2, 0.5, d - 1.6, 0, 1.1, 0);
    // Seat, reclined back, head rest and arms.
    cushion(B, vinyl, w - 0.5, 0.5, d * 0.34, 0, 1.6, d * 0.22, { puff: 0.12 });
    cushion(B, vinyl, w - 0.5, 0.5, d * 0.46, 0, 1.75, -d * 0.16, { rot: [-0.22, 0, 0], puff: 0.12 });
    cushion(B, vinyl, w - 1.1, 0.4, 1.1, 0, 2.5, -d * 0.44, { rot: [-0.22, 0, 0], puff: 0.2 });
    for (const sx of [-1, 1]) cushion(B, vinyl, 0.4, 0.3, 2, sx * (w / 2 - 0.35), 2.1, d * 0.1, { puff: 0.1 });
    // The light on its arm, and a bracket table.
    post(B, M.metal('#c9ced3', 0.3), 0.1, 0.1, h - 1.2, -w / 2 + 0.2, 1.1, d / 2 - 1, 8);
    B.tube(M.metal('#c9ced3', 0.3), [-w / 2 + 0.2, h - 0.1, d / 2 - 1], [0.3, h + 0.3, -d * 0.1], 0.08, 8);
    rbox(B, M.painted('#f1f2f0', 0.35), 1.8, 0.4, 0.9, 0.3, h + 0.1, -d * 0.1, 0.12, [0.5, 0, 0]);
    slab(B, M.glow('#f6fbff', 2), 1.5, 0.06, 0.7, 0.3, h + 0.05, -d * 0.1 + 0.2, [0.5, 0, 0]);
    slab(B, M.metal('#dde0e2', 0.3), 1.6, 0.06, 1.2, w / 2 - 0.2, 3.1, d * 0.1);
  },
  trolleycrash(B, it, { w, d, h }) {
    const body = M.painted('#c0392b', 0.45);
    const r = rng(seedOf(it) * 293 + 1);
    slab(B, body, w, h - 0.6, d, 0, 0.4, 0);
    rbox(B, M.plastic('#f1f2f0', 0.5), w + 0.1, 0.1, d + 0.1, 0, h - 0.2, 0, 0.02);
    for (let i = 0; i < 4; i++) {
      const y = 0.55 + i * ((h - 0.9) / 4);
      rbox(B, M.painted('#e9eaea', 0.4), w - 0.15, (h - 0.9) / 4 - 0.06, 0.06, 0, y, d / 2 - 0.02, 0.012);
      barX(B, M.metal('#9aa1a8', 0.3), 0.04, w * 0.5, 0, y + ((h - 0.9) / 4) * 0.5, d / 2 + 0.06, 6);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add(cylGeo(0.2, 0.2, 0.08, 10).rotateZ(PI / 2), blackPl(0.6), { pos: [sx * (w / 2 - 0.2), 0.2, sz * (d / 2 - 0.25)] });
    B.add(cylGeo(0.05, 0.05, w, 8).rotateZ(PI / 2), M.metal('#c9ced3', 0.3), { pos: [0, h - 0.6, -d / 2 - 0.15] });
    for (let i = 0; i < 3; i++) slab(B, M.plastic(['#2e6f8e', '#e2b31b', '#f1f2f0'][i], 0.5), 0.5, 0.3, 0.4, -w / 2 + 0.5 + i * 0.6, h - 0.1, 0, [0, r(), 0]);
  },
  cabmedical(B, it, { w, d, h }) {
    const body = M.painted('#f1f2f0', 0.4);
    const r = rng(seedOf(it) * 307 + 2);
    slab(B, body, w, 2.4, d, 0, 0, 0);
    for (const sx of [-1, 1]) rbox(B, body, w / 2 - 0.06, 2.1, 0.06, sx * w / 4, 0.15, d / 2 - 0.02, 0.012);
    const ys = shelfRun(B, body, w, d, h - 2.4, 3, { y0: 2.4, back: M.laminate('#e9e6df', 0.7) });
    for (const y of ys) stock(B, r, -w / 2 + 0.2, w / 2 - 0.2, y, -d / 2 + 0.15, d / 2 - 0.15, 'boxes', { maxH: 0.75, palette: ['#f1f2f0', '#dfe8f2', '#e2f0e4', '#f4e4e4', '#e9e2d0'] });
    for (const sx of [-1, 1]) {
      slab(B, M.clearGlass('#dfeef2'), w / 2 - 0.2, h - 2.8, 0.05, sx * w / 4, 2.6, d / 2 - 0.06);
      barZ(B, M.metal('#9aa1a8', 0.3), 0.04, 0.2, sx * 0.25, h - 1.6, d / 2 + 0.02, 6);
    }
  },
  sinkclinical(B, it, { w, d }) {
    const y = 2.8;
    lathe(B, M.porcelain('#f6f6f3'), [[w / 2 - 0.1, 0], [w / 2, 0.15], [w / 2 - 0.05, 0.75], [w / 2 - 0.35, 0.85], [w / 2 - 0.3, 0.2]], 0, y, d / 2 - 0.1, 20);
    slab(B, M.porcelain('#f6f6f3'), w * 0.6, 1, 0.1, 0, y - 0.6, 0.05);
    B.tube(M.chrome(), [0, y + 0.6, 0.12], [0, y + 1.25, 0.12], 0.05, 8);
    B.tube(M.chrome(), [0, y + 1.25, 0.12], [0, y + 1.05, d * 0.5], 0.045, 8);
    barZ(B, M.chrome(), 0.04, 0.75, 0, y + 1.1, 0.4, 6);
    slab(B, M.plastic('#f1f2f0', 0.4), 0.55, 0.8, 0.3, -w / 2 - 0.05, y + 1.5, 0.15);
    slab(B, M.plastic('#2e6f8e', 0.4), 0.55, 0.8, 0.3, w / 2 + 0.05, y + 1.5, 0.15);
    void it;
  },
  ivstand(B, it, { h }) {
    const m = M.metal('#c9ced3', 0.3);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * PI * 2;
      B.add(cylGeo(0.05, 0.05, 0.75, 6).rotateZ(PI / 2), m, { pos: [Math.cos(a) * 0.38, 0.25, Math.sin(a) * 0.38], rot: [0, -a, 0] });
      B.add(cylGeo(0.12, 0.12, 0.07, 8).rotateZ(PI / 2), blackPl(0.6), { pos: [Math.cos(a) * 0.7, 0.12, Math.sin(a) * 0.7], rot: [0, -a, 0] });
    }
    post(B, m, 0.08, 0.08, h - 0.6, 0, 0.2, 0, 10);
    for (const sx of [-1, 1]) B.add(cylGeo(0.04, 0.04, 0.5, 6).rotateZ(PI / 2), m, { pos: [sx * 0.25, h - 0.4, 0] });
    for (const sx of [-1, 1]) {
      const bag = M.plastic(sx > 0 ? '#e8f0e4' : '#f0ece0', 0.35);
      const g = new THREE.BoxGeometry(0.75, 1.5, 0.3);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const t = (p.getY(i) + 0.75) / 1.5; p.setX(i, p.getX(i) * (0.5 + t * 0.6)); p.setZ(i, p.getZ(i) * (0.6 + Math.sin(t * PI) * 0.8)); }
      g.computeVertexNormals();
      B.add(g, bag, { pos: [sx * 0.45, h - 1.25, 0] });
      B.tube(M.acrylic(), [sx * 0.45, h - 2, 0], [sx * 0.45 + sx * 0.1, h - 3.6, 0.1], 0.025, 5);
    }
    void it;
  },
  vitals(B, it, { w, d, h }) {
    const m = M.metal('#c9ced3', 0.3);
    disc(B, M.painted('#55585d', 0.5), 0.7, 0.08, 0, 0, 0, 16);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2 + 0.4;
      B.add(cylGeo(0.1, 0.1, 0.07, 8).rotateZ(PI / 2), blackPl(0.6), { pos: [Math.cos(a) * 0.62, 0.1, Math.sin(a) * 0.62], rot: [0, -a, 0] });
    }
    post(B, m, 0.07, 0.07, h - 1.4, 0, 0.08, 0, 10);
    rbox(B, M.painted('#e9eaea', 0.4), w, 1.4, d * 0.7, 0, h - 1.4, 0, 0.06);
    face(B, screenMat('vitals', seedOf(it)), w - 0.2, 1.2, 0, h - 0.7, d * 0.36);
    for (let i = 0; i < 3; i++) B.tube(M.plastic(['#1f4f9c', '#c0392b', '#2b2f36'][i], 0.5), [w / 2 - 0.1, h - 1.6, 0], [w / 2 + 0.3, h - 2.6 - i * 0.3, 0.3], 0.03, 5);
  },
  benchwait(B, it, { w, d, h }) {
    const m = M.metal('#aeb4ba', 0.3);
    const fab = M.cloth(it.color || FABRICS[0][0]);
    const n = Math.max(2, Math.round(w / 2));
    for (const sx of [-1, 1]) {
      B.tube(m, [sx * (w / 2 - 0.3), 0.04, d / 2 - 0.3], [sx * (w / 2 - 0.3), 1.35, d / 2 - 0.35], 0.06, 6);
      B.tube(m, [sx * (w / 2 - 0.3), 0.04, -d / 2 + 0.3], [sx * (w / 2 - 0.3), h, -d / 2 + 0.2], 0.06, 6);
      B.tube(m, [sx * (w / 2 - 0.3), 0.04, d / 2 - 0.3], [sx * (w / 2 - 0.3), 0.04, -d / 2 + 0.3], 0.06, 6);
    }
    barX(B, m, 0.06, w - 0.5, 0, 1.3, 0, 8);
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (w / n) * (i + 0.5);
      cushion(B, fab, w / n - 0.12, 0.3, d - 0.9, x, 1.35, 0.1, { puff: 0.15, r: 0.12 });
      cushion(B, fab, w / n - 0.12, h - 1.75, 0.22, x, 1.75, -d / 2 + 0.3, { rot: [0.1, 0, 0], puff: 0.1, r: 0.12 });
      if (i < n - 1) barZ(B, m, 0.05, d - 1.2, -w / 2 + (w / n) * (i + 1), 1.6, 0.1, 6);
    }
  },
  nursestation(B, it, { w, d, h }) {
    const body = lam(it);
    slab(B, body, w, 2.6, d - 1.2, 0, 0, -0.4);
    rbox(B, M.laminate('#e9e6df', 0.35), w, 0.14, d - 1, 0, 2.6, -0.4, 0.03);
    slab(B, body, w, h - 0.2, 0.7, 0, 0, d / 2 - 0.35);
    rbox(B, M.grain('#a8743f', 0.4), w + 0.2, 0.2, 1.1, 0, h - 0.2, d / 2 - 0.4, 0.05);
    const r = rng(seedOf(it) * 311 + 4);
    for (let i = 0; i < 2; i++) monitor(B, (i - 0.5) * w * 0.4, 2.6, -0.9, { w: 1.8, kind: ['chart', 'sheet'][i], seed: seedOf(it) + i });
    keyboard(B, -w * 0.2, 2.6, -0.1);
    for (let i = 0; i < 5; i++) if (r() < 0.7) slab(B, M.laminate('#f6f5f1', 0.7), 0.8, 0.05, 1, w / 2 - 1.5 - r() * 2, 2.6, -0.3, [0, (r() - 0.5) * 0.4, 0]);
  },
  stoolclinical(B, it, { h }) {
    chairBase(B, 0, 0, h - 0.5);
    cushion(B, M.leather(it.color || '#2e6f8e', 0.45), 1.45, 0.3, 1.45, 0, h - 0.3, 0, { puff: 0.22, r: 0.2 });
  },
  wheelchair(B, it, { w, d, h }) {
    const m = M.metal('#55585d', 0.4);
    const fab = M.cloth('#2b2f36');
    for (const sx of [-1, 1]) {
      // Big rear wheel with a push rim, small front castor.
      B.add(new THREE.TorusGeometry(1.05, 0.08, 6, 24).rotateY(PI / 2), M.tyre(), { pos: [sx * (w / 2 - 0.1), 1.1, -d * 0.12] });
      B.add(new THREE.TorusGeometry(0.9, 0.04, 5, 22).rotateY(PI / 2), M.metal('#c9ced3', 0.3), { pos: [sx * (w / 2 + 0.05), 1.1, -d * 0.12] });
      for (let i = 0; i < 8; i++) B.add(cylGeo(0.02, 0.02, 2.1, 4).rotateZ(PI / 2).rotateX((i / 8) * PI), M.metal('#c9ced3', 0.3), { pos: [sx * (w / 2 - 0.1), 1.1, -d * 0.12] });
      B.add(new THREE.TorusGeometry(0.35, 0.07, 6, 16).rotateY(PI / 2), M.tyre(), { pos: [sx * (w / 2 - 0.35), 0.35, d * 0.34] });
      B.tube(m, [sx * (w / 2 - 0.3), 0.35, d * 0.34], [sx * (w / 2 - 0.3), 1.55, d * 0.2], 0.05, 6);
      B.tube(m, [sx * (w / 2 - 0.3), 1.55, d * 0.2], [sx * (w / 2 - 0.3), 1.55, -d * 0.3], 0.05, 6);
      B.tube(m, [sx * (w / 2 - 0.3), 1.55, -d * 0.3], [sx * (w / 2 - 0.3), h - 0.2, -d * 0.42], 0.05, 6);
      B.tube(m, [sx * (w / 2 - 0.3), h - 0.2, -d * 0.42], [sx * (w / 2 - 0.3), h - 0.1, -d * 0.52], 0.05, 6);
      // Arm rest and foot plate.
      rbox(B, blackPl(0.5), 0.22, 0.12, 1.6, sx * (w / 2 - 0.25), 2.3, -d * 0.05, 0.05);
      B.tube(m, [sx * (w / 2 - 0.3), 1.5, d * 0.2], [sx * (w / 2 - 0.4), 0.6, d * 0.42], 0.05, 6);
      slab(B, M.painted('#3d434b', 0.5), 0.6, 0.06, 0.7, sx * (w / 2 - 0.45), 0.55, d * 0.46, [0.2, 0, 0]);
    }
    slab(B, fab, w - 0.6, 0.12, d * 0.5, 0, 1.55, -d * 0.05);
    slab(B, fab, w - 0.6, 1.5, 0.1, 0, 1.67, -d * 0.36, [0.1, 0, 0]);
  },
  scales(B, it, { w, d, h }) {
    const m = M.painted('#e9eaea', 0.4);
    slab(B, M.painted('#55585d', 0.5), w, 0.2, d, 0, 0, 0);
    slab(B, M.metal('#b9bfc4', 0.3), w - 0.2, 0.08, d - 0.2, 0, 0.2, 0);
    post(B, m, 0.12, 0.12, h - 1, 0, 0.28, -d / 2 + 0.25, 8);
    rbox(B, m, 1.1, 0.8, 0.5, 0, h - 0.8, -d / 2 + 0.3, 0.06, [-0.3, 0, 0]);
    face(B, labelMat('72.4', { color: '#39414a', bg: '#c9d4c9', aspect: 2.2 }), 0.8, 0.42, 0, h - 0.4, -d / 2 + 0.52, [-0.3, 0, 0]);
    void it;
  },
  sharps(B, it, { w, d, h }) {
    slab(B, M.plastic('#e2b31b', 0.5), w, h - 0.2, d, 0, 2.6, d / 2);
    slab(B, M.plastic('#c0392b', 0.5), w + 0.05, 0.25, d + 0.05, 0, 2.6 + h - 0.25, d / 2);
    slab(B, M.plastic('#2b2f36', 0.6), w * 0.5, 0.06, d * 0.4, 0, 2.6 + h - 0.1, d / 2);
    face(B, labelMat('SHARPS', { color: '#2b2f36', bg: '#e2b31b', aspect: 4 }), w * 0.8, 0.3, 0, 3, d + 0.01);
    void it;
  },
  geldispenser(B, it, { w, d, h }) {
    slab(B, M.plastic('#f1f2f0', 0.4), w, h, d, 0, 3.4, d / 2);
    slab(B, M.plastic('#2e6f8e', 0.4), w * 0.7, 0.2, 0.05, 0, 3.4 + h * 0.75, d + 0.01);
    slab(B, M.plastic('#55585d', 0.5), w * 0.45, 0.3, d * 0.6, 0, 3.4 - 0.25, d * 0.6);
    void it;
  },
  lightbox(B, it, { w, h }) {
    slab(B, M.painted('#e9eaea', 0.4), w, h, 0.14, 0, 0, 0.07);
    slab(B, M.glow('#eef6ff', 1.3), w - 0.25, h - 0.25, 0.04, 0, 0.12, 0.15);
    slab(B, M.acrylic(), w * 0.5, h * 0.75, 0.02, -w * 0.12, 0.3, 0.18);
    void it;
  },
};

/* ======================================================================= */
/*                                 LOBBY                                    */
/* ======================================================================= */

const LOBBY = [
  ['lobby', 'sofalobby', 'Lobby sofa', '🛋️', 7, 3.2, 2.7, { colors: LEATHERS }],
  ['lobby', 'armchair', 'Armchair', '💺', 3.2, 3.2, 2.8, { colors: FABRICS }],
  ['lobby', 'coffeetable', 'Coffee table', '🪵', 4, 2.4, 1.4, { colors: WOODS, surface: 1.4 }],
  ['lobby', 'sidetable', 'Side table', '🕯️', 1.8, 1.8, 2, { colors: WOODS, surface: 2 }],
  ['lobby', 'benchslat', 'Slatted bench', '🪑', 6, 1.8, 1.6, { colors: WOODS, len: true }],
  ['lobby', 'directory', 'Directory board', '🧭', 3.4, 0.3, 5, { wall: true, mount: 5.6 }],
  ['lobby', 'turnstile', 'Speed gate', '🚶', 1.4, 5, 3.4, {}],
  ['lobby', 'liftdoors', 'Lift entrance', '🛗', 5, 0.6, 8, { wall: true, mount: 0, cut: { w: 4.2, h0: 0, h1: 7.6 } }],
  ['lobby', 'stairflight', 'Stair flight', '🪜', 5, 14, 11, { len: true }],
  ['lobby', 'escalator', 'Escalator', '↗️', 5.4, 24, 13, {}],
  ['lobby', 'vending', 'Vending machine', '🥤', 3.4, 2.6, 6.4, { variants: [['drinks', 'Drinks'], ['snacks', 'Snacks']] }],
  ['lobby', 'atm', 'Cash machine', '🏧', 2.4, 1.4, 6, { wall: true, mount: 0 }],
  ['lobby', 'plinth', 'Display plinth', '🏺', 2, 2, 3.4, { colors: [['#f1efe9', 'White'], ['#2b2f36', 'Black'], ['#a9a8a2', 'Concrete']], surface: 3.4 }],
  ['lobby', 'barrierpost', 'Security barrier', '🛂', 1.2, 1.2, 3.4, {}],
];

const LOBBY_B = {
  sofalobby(B, it, { w, d, h }) {
    const lea = M.leather(it.color || LEATHERS[0][0]);
    slab(B, lea, w - 1, 0.9, d - 0.4, 0, 0.5, 0);
    const n = Math.max(2, Math.round(w / 3));
    for (let i = 0; i < n; i++) cushion(B, lea, (w - 1.2) / n - 0.1, 0.45, d - 0.8, -w / 2 + 0.6 + ((w - 1.2) / n) * (i + 0.5), 1.4, 0.1, { puff: 0.18 });
    for (let i = 0; i < n; i++) cushion(B, lea, (w - 1.2) / n - 0.1, h - 1.9, 0.6, -w / 2 + 0.6 + ((w - 1.2) / n) * (i + 0.5), 1.85, -d / 2 + 0.35, { puff: 0.12 });
    for (const sx of [-1, 1]) cushion(B, lea, 0.55, 1.5, d, sx * (w / 2 - 0.28), 0.5, 0, { puff: 0.08 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) post(B, M.metal('#b9bfc4', 0.3), 0.07, 0.07, 0.5, sx * (w / 2 - 0.5), 0, sz * (d / 2 - 0.4), 8);
  },
  armchair(B, it, { w, d, h }) {
    const fab = M.cloth(it.color || FABRICS[2][0]);
    slab(B, fab, w - 0.9, 0.9, d - 0.5, 0, 0.5, 0);
    cushion(B, fab, w - 1.1, 0.5, d - 0.9, 0, 1.4, 0.1, { puff: 0.2 });
    cushion(B, fab, w - 1, h - 1.9, 0.65, 0, 1.85, -d / 2 + 0.38, { rot: [0.08, 0, 0], puff: 0.12 });
    for (const sx of [-1, 1]) cushion(B, fab, 0.5, 1.45, d - 0.2, sx * (w / 2 - 0.25), 0.5, 0.05, { puff: 0.1 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) post(B, M.grain('#5b3a26', 0.45), 0.08, 0.06, 0.5, sx * (w / 2 - 0.45), 0, sz * (d / 2 - 0.45), 8);
  },
  coffeetable(B, it, { w, d, h }) {
    const m = wood(it, 1);
    rbox(B, m, w, 0.14, d, 0, h - 0.14, 0, 0.03);
    slab(B, m, w - 0.8, 0.08, d - 0.6, 0, 0.45, 0);
    legs(B, m, w, d, h - 0.14, { inset: 0.3, t: 0.16 });
    const r = rng(seedOf(it) * 313 + 2);
    for (let i = 0; i < 3; i++) slab(B, M.laminate(['#2f3b4d', '#8a3b3b', '#e9e2d0'][i], 0.6), 1.1, 0.07, 1.4, -w * 0.2 + i * 0.05, h + i * 0.07, 0.1, [0, (r() - 0.5) * 0.3, 0]);
    lathe(B, M.porcelain('#e9e6df'), [[0.3, 0], [0.42, 0.25], [0.3, 0.5], [0.26, 0.56]], w * 0.25, h, 0, 16);
    foliage(B, r, w * 0.25, h + 0.5, 0, 0.45, 0.6, { n: 5, hex: '#4a7d42' });
  },
  sidetable(B, it, { w, h }) {
    const m = wood(it, 1);
    disc(B, m, w / 2, 0.12, 0, h - 0.12, 0, 24);
    post(B, M.metal('#c9a86a', 0.3), 0.1, 0.1, h - 0.12, 0, 0, 0, 12);
    disc(B, M.metal('#c9a86a', 0.3), w / 2 - 0.3, 0.07, 0, 0, 0, 20);
  },
  benchslat(B, it, { w, d, h }) {
    const m = wood(it, 0);
    for (let i = 0; i < 5; i++) rbox(B, m, w, 0.14, d / 6, 0, h - 0.14, -d / 2 + d / 12 + i * (d / 5.2), 0.04);
    for (const sx of [-1, 1]) {
      slab(B, M.metal('#55585d', 0.4), 0.12, h - 0.14, d - 0.2, sx * (w / 2 - 0.5), 0, 0);
      slab(B, M.metal('#55585d', 0.4), 0.3, 0.08, d, sx * (w / 2 - 0.5), 0, 0);
    }
  },
  directory(B, it, { w, h }) {
    slab(B, M.pianoBlack(), w, h, 0.18, 0, 0, 0.09);
    slab(B, M.metal('#c9a86a', 0.3), w + 0.1, 0.1, 0.22, 0, h, 0.09);
    face(B, labelMat(it.text || 'DIRECTORY', { color: '#e9c87a', bg: '#1a1d21', aspect: 6 }), w - 0.4, 0.45, 0, h - 0.5, 0.19);
    const r = rng(seedOf(it) * 317 + 1);
    for (let i = 0; i < 9; i++) {
      const y = h - 1.3 - i * ((h - 2) / 9);
      slab(B, M.painted('#c9ced3', 0.4), w * 0.45 + r() * 0.5, 0.1, 0.01, -w * 0.18, y, 0.19);
      slab(B, M.painted('#8a8f96', 0.4), 0.4, 0.1, 0.01, w * 0.38, y, 0.19);
    }
  },
  turnstile(B, it, { w, d, h }) {
    const body = M.painted('#e9eaea', 0.35);
    for (const sz of [-1, 1]) {
      // Two pedestals with glass wings between them.
      rbox(B, body, w, h, d / 2 - 0.3, 0, 0, sz * (d / 4 + 0.15), 0.18);
      rbox(B, M.pianoBlack(), w - 0.15, 0.14, d / 2 - 0.5, 0, h, sz * (d / 4 + 0.15), 0.03);
      slab(B, M.glow(sz > 0 ? '#3fb950' : '#58a6ff', 1.2), w * 0.4, 0.05, 0.5, 0, h + 0.01, sz * (d / 4 + 0.15));
      slab(B, M.clearGlass('#dfeef2'), 0.06, h - 0.4, 1.5, 0, 0.3, sz * 0.9, [0, 0, 0]);
    }
    slab(B, M.metal('#b9bfc4', 0.3), w * 0.35, 0.45, 0.5, 0, h - 1, d / 2 - 0.2);
  },
  liftdoors(B, it, { w, h }) {
    // Mounted in a wall: the surround and the two leaves.
    const sur = M.metal('#b9bfc4', 0.3);
    const leaf = M.metal('#9aa1a8', 0.25);
    slab(B, sur, w, h, 0.3, 0, 0, 0.1);
    slab(B, M.pianoBlack(), w - 1, h - 0.9, 0.08, 0, 0, 0.18);
    for (const sx of [-1, 1]) slab(B, leaf, (w - 1.1) / 2, h - 0.95, 0.12, sx * (w - 1.1) / 4, 0, 0.22);
    for (const sx of [-1, 1]) for (let i = 0; i < 6; i++) slab(B, M.metal('#8a8f96', 0.4), (w - 1.3) / 2, 0.03, 0.02, sx * (w - 1.1) / 4, 0.6 + i * ((h - 1.8) / 6), 0.29);
    slab(B, M.pianoBlack(), 1.8, 0.7, 0.1, 0, h - 0.75, 0.2);
    face(B, labelMat(it.text || '▲ 3', { color: '#e8a53a', bg: '#101317', aspect: 3, glow: true }), 1.5, 0.45, 0, h - 0.4, 0.26);
    slab(B, M.pianoBlack(), 0.5, 1.1, 0.1, w / 2 - 0.35, 3.6, 0.2);
    for (let i = 0; i < 2; i++) disc(B, M.glow('#f0e05a', i ? 0.2 : 1.2), 0.1, 0.04, w / 2 - 0.35, 4.1 - i * 0.4, 0.26, 10);
  },
  stairflight(B, it, { w, d, h }) {
    const tread = M.concrete('#c4c2bb');
    const n = Math.max(6, Math.round(h / 0.62));
    const rise = h / n;
    const run = (d - 1) / n;
    for (let i = 0; i < n; i++) {
      slab(B, tread, w, 0.18, run + 0.1, 0, i * rise + rise - 0.18, d / 2 - 0.5 - i * run - run / 2);
      slab(B, M.concrete('#b4b2ab'), w, rise - 0.18, 0.12, 0, i * rise, d / 2 - 0.5 - i * run - run + 0.06);
      slab(B, M.metal('#55585d', 0.5), w - 0.3, 0.02, 0.1, 0, i * rise + rise - 0.01, d / 2 - 0.5 - i * run - 0.1);
    }
    // Stringer and a glass balustrade with a timber handrail.
    for (const sx of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= n; i++) pts.push([sx * (w / 2 - 0.05), i * rise, d / 2 - 0.5 - i * run]);
      for (let i = 0; i < n; i++) {
        B.tube(M.clearGlass('#dfeef2'), [pts[i][0], pts[i][1] + 0.1, pts[i][2]], [pts[i + 1][0], pts[i + 1][1] + 0.1, pts[i + 1][2]], 0.03, 4);
        B.tube(M.clearGlass('#dfeef2'), [pts[i][0], pts[i][1] + 1.6, pts[i][2]], [pts[i + 1][0], pts[i + 1][1] + 1.6, pts[i + 1][2]], 0.03, 4);
        B.add(new THREE.BoxGeometry(0.06, 3, Math.hypot(rise, run)), M.clearGlass('#dfeef2'), { pos: [sx * (w / 2 - 0.05), i * rise + rise / 2 + 1.5, d / 2 - 0.5 - i * run - run / 2], rot: [Math.atan2(rise, run), 0, 0] });
        B.tube(M.grain('#8a5a36', 0.4), [pts[i][0], pts[i][1] + 3.1, pts[i][2]], [pts[i + 1][0], pts[i + 1][1] + 3.1, pts[i + 1][2]], 0.09, 8);
      }
    }
    slab(B, M.concrete('#b4b2ab'), w, 0.5, 1, 0, h - 0.5, -d / 2 + 0.5);
    void it;
  },
  escalator(B, it, { w, d, h }) {
    const m = M.metal('#9aa1a8', 0.35);
    const steps = Math.round(d / 1.35);
    const rise = h / steps;
    const run = d / steps;
    // Truss sides and the moving handrail.
    for (const sx of [-1, 1]) {
      for (let i = 0; i < steps; i++) {
        B.add(new THREE.BoxGeometry(0.22, 3.4, Math.hypot(rise, run)), M.clearGlass('#dfeef2'), { pos: [sx * (w / 2 - 0.12), i * rise + rise / 2 + 1.8, d / 2 - i * run - run / 2], rot: [Math.atan2(rise, run), 0, 0] });
        B.tube(blackPl(0.4), [sx * (w / 2 - 0.12), i * rise + 3.5, d / 2 - i * run], [sx * (w / 2 - 0.12), (i + 1) * rise + 3.5, d / 2 - (i + 1) * run], 0.12, 8);
        B.add(new THREE.BoxGeometry(0.5, 0.5, Math.hypot(rise, run)), m, { pos: [sx * (w / 2 - 0.12), i * rise - 0.3, d / 2 - i * run - run / 2], rot: [Math.atan2(rise, run), 0, 0] });
      }
    }
    for (let i = 0; i < steps; i++) {
      slab(B, M.metal('#b9bfc4', 0.3), w - 0.6, 0.12, run * 0.98, 0, i * rise + rise - 0.12, d / 2 - i * run - run / 2);
      for (let k = 0; k < 9; k++) slab(B, M.metal('#8a8f96', 0.45), 0.08, 0.03, run * 0.9, -w / 2 + 0.5 + k * ((w - 1) / 8), i * rise + rise, d / 2 - i * run - run / 2);
      slab(B, M.metal('#8a8f96', 0.5), w - 0.6, rise - 0.12, 0.1, 0, i * rise, d / 2 - i * run - run + 0.05);
    }
    for (const sz of [-1, 1]) slab(B, M.metal('#c9ced3', 0.3), w - 0.6, 0.14, 1.6, 0, sz > 0 ? 0 : h - 0.14, sz * (d / 2 - 0.4));
    slab(B, M.glow('#3fb950', 1), 0.5, 0.05, 0.3, 0, 0.16, d / 2 - 0.4);
    void it;
  },
  vending(B, it, { w, d, h }) {
    const r = rng(seedOf(it) * 331 + 3);
    const drinks = (it.variant || 'drinks') === 'drinks';
    slab(B, M.painted(drinks ? '#c0392b' : '#1f4f9c', 0.4), w, h, d, 0, 0, 0);
    slab(B, M.pianoBlack(), w - 0.5, h - 1.6, 0.1, 0, 0.8, d / 2 - 0.03);
    slab(B, M.clearGlass('#dfeef2'), w - 0.7, h - 1.8, 0.05, 0, 0.9, d / 2 + 0.03);
    // The racks behind the glass.
    for (let k = 0; k < 5; k++) {
      const y = 1.1 + k * ((h - 2.2) / 5);
      slab(B, M.metal('#8a8f96', 0.5), w - 0.8, 0.05, 0.5, 0, y, d / 2 - 0.35);
      for (let i = 0; i < Math.floor((w - 0.9) / 0.5); i++) {
        const x = -w / 2 + 0.55 + i * 0.5;
        if (drinks) B.add(cylGeo(0.17, 0.17, 0.55, 10), M.painted(['#c0392b', '#1f7a54', '#e2b31b', '#2e6f8e'][Math.floor(r() * 4)], 0.35), { pos: [x, y + 0.32, d / 2 - 0.35] });
        else slab(B, M.plastic(['#e36a1c', '#e2b31b', '#c0392b', '#f1f2f0'][Math.floor(r() * 4)], 0.45), 0.42, 0.55, 0.14, x, y + 0.05, d / 2 - 0.35);
      }
    }
    slab(B, M.glow('#fff4e2', 0.7), w - 0.9, 0.04, 0.1, 0, h - 1.2, d / 2 - 0.1);
    slab(B, M.pianoBlack(), 0.9, 2.4, 0.08, w / 2 - 0.6, h - 3.4, d / 2 + 0.02);
    for (let i = 0; i < 8; i++) disc(B, M.plastic('#55585d', 0.4), 0.09, 0.04, w / 2 - 0.75 + (i % 2) * 0.3, h - 3.2 + Math.floor(i / 2) * 0.35, d / 2 + 0.07, 8);
    slab(B, M.pianoBlack(), w - 1.4, 0.9, 0.3, 0, 0.5, d / 2 - 0.05);
  },
  atm(B, it, { w, d, h }) {
    slab(B, M.painted('#2b3b4d', 0.4), w, h, d, 0, 0, d / 2);
    slab(B, M.pianoBlack(), w - 0.4, 1.6, 0.14, 0, 3.5, d + 0.02, [-0.25, 0, 0]);
    face(B, screenMat('pos', seedOf(it)), w - 0.7, 1.3, 0, 4.2, d + 0.12, [-0.25, 0, 0]);
    slab(B, M.metal('#b9bfc4', 0.3), w - 0.6, 0.7, 0.12, 0, 2.6, d + 0.04, [-0.6, 0, 0]);
    for (let i = 0; i < 12; i++) slab(B, blackPl(0.4), 0.17, 0.12, 0.05, -0.5 + (i % 3) * 0.35, 2.85 - Math.floor(i / 3) * 0.17, d + 0.16, [-0.6, 0, 0]);
    slab(B, M.metal('#c9ced3', 0.3), 0.9, 0.08, 0.1, 0.6, 3.1, d + 0.06);
    slab(B, M.pianoBlack(), 1.4, 0.3, 0.1, 0, 2.1, d + 0.04);
    slab(B, M.glow('#4ab3e8', 1), w - 0.3, 0.08, 0.06, 0, h - 0.5, d + 0.01);
    void it;
  },
  plinth(B, it, { w, d, h }) {
    const m = M.laminate(it.color || '#f1efe9', 0.35);
    rbox(B, m, w, h, d, 0, 0, 0, 0.02);
    slab(B, M.painted('#2b2f36', 0.6), w - 0.2, 0.08, d - 0.2, 0, 0, 0);
  },
  barrierpost(B, it, { w, h }) {
    const m = M.metal('#c9ced3', 0.25);
    disc(B, M.painted('#2b2f36', 0.5), w / 2, 0.2, 0, 0, 0, 20);
    lathe(B, m, [[w / 2 - 0.1, 0], [w / 2 - 0.12, h - 0.9], [w / 2 - 0.05, h - 0.75], [w / 2 - 0.1, h - 0.6], [w / 2 - 0.3, h - 0.5], [0.01, h - 0.48]], 0, 0.2, 0, 20);
    slab(B, M.painted('#17191c', 0.5), w * 0.55, 0.14, w * 0.3, 0, h - 0.5, 0);
    void it;
  },
};

/* ======================================================================= */
/*                          GARAGE & SHOWROOM                               */
/* ======================================================================= */

const GARAGE = [
  ['garage', 'carlift', 'Two-post lift', '🚗', 11, 12, 12, { seeded: true, variants: [['down', 'Lowered'], ['up', 'Raised'], ['car', 'Car on the lift']] }],
  ['garage', 'benchgarage', 'Workbench and vice', '🔧', 7, 2.6, 3, { len: true, surface: 3 }],
  ['garage', 'toolchest', 'Roller tool chest', '🧰', 4.4, 2, 4.2, { colors: [['#c0392b', 'Red'], ['#1f4f9c', 'Blue'], ['#2b2f36', 'Black'], ['#e2b31b', 'Yellow']] }],
  ['garage', 'tyrerack', 'Tyre rack', '🛞', 6, 2.2, 7, { len: true }],
  ['garage', 'compressor', 'Air compressor', '💨', 2.6, 5, 4.4, {}],
  ['garage', 'enginehoist', 'Engine crane', '🏗️', 3.6, 7, 7.4, {}],
  ['garage', 'wheelbalancer', 'Wheel balancer', '⚙️', 4, 3, 5, {}],
  ['garage', 'partscounter', 'Parts counter', '🔩', 8, 3, 3.6, { colors: LAMINATES, len: true }],
  ['garage', 'oildrain', 'Oil drainer', '🛢️', 2, 2, 4.6, {}],
  ['garage', 'showroomcar', 'Showroom car', '🚙', 7, 17, 5.5, { seeded: true, hint: 'Reroll picks another model', colors: [['#f4f4f2', 'White'], ['#16181b', 'Black'], ['#c4c8cc', 'Silver'], ['#c8241b', 'Red'], ['#2f5fa8', 'Blue'], ['#1b3f2f', 'Green'], ['#7a1a1f', 'Burgundy'], ['#d9c66a', 'Champagne']] }],
  ['garage', 'turntable', 'Display turntable', '💿', 16, 16, 0.7, { colors: [['#2b2f36', 'Black'], ['#f1efe9', 'White'], ['#8a0f1a', 'Red carpet']], flat: true }],
];

const GARAGE_B = {
  carlift(B, it, { w, d, h }) {
    const col = M.painted('#c0392b', 0.4);
    const up = (it.variant || 'down') !== 'down';
    const ah = up ? 6.5 : 0.6;
    for (const sx of [-1, 1]) {
      slab(B, col, 1.6, h, 1.4, sx * (w / 2 - 0.8), 0, 0);
      slab(B, M.painted('#2b2f36', 0.5), 2.6, 0.5, 2.6, sx * (w / 2 - 0.8), 0, 0);
      slab(B, col, 1.2, 0.5, 1.2, sx * (w / 2 - 0.8), h - 0.5, 0);
      // Carriage and the two swing arms, lowered or raised.
      slab(B, M.painted('#e2b31b', 0.45), 1.9, 1.2, 1.7, sx * (w / 2 - 0.8), ah, 0);
      for (const sz of [-1, 1]) {
        const len = d * 0.3;
        B.add(new THREE.BoxGeometry(len, 0.5, 0.7), M.painted('#e2b31b', 0.45), { pos: [sx * (w / 2 - 1 - Math.cos(0.5) * len / 2), ah + 0.4, sz * Math.sin(0.5) * len / 2], rot: [0, -sx * sz * 0.5, 0] });
        const px = sx * (w / 2 - 1 - Math.cos(0.5) * len);
        const pz = sz * Math.sin(0.5) * len;
        B.add(cylGeo(0.3, 0.3, 0.5, 10), M.painted('#2b2f36', 0.5), { pos: [px, ah + 0.55, pz] });
      }
    }
    slab(B, M.painted('#2b2f36', 0.5), w - 1, 0.6, 0.8, 0, h - 0.6, 0);
    slab(B, M.painted('#e9eaea', 0.4), 1, 1.8, 0.7, -w / 2 + 0.3, 3.6, 1.2);
    if ((it.variant || 'down') === 'car') {
      const car = CARS[seedOf(it) % CARS.length];
      const cb = carModel(car.id, null, null, { lod: 'low' });
      const mtx = new THREE.Matrix4().makeRotationY(PI / 2).setPosition(0, ah + 0.8, 0);
      for (const [mat, geos] of cb.parts) for (const g of geos) B.add(g.clone().applyMatrix4(mtx), mat);
    }
  },
  benchgarage(B, it, { w, d, h }) {
    const m = M.painted('#3d434b', 0.5);
    const r = rng(seedOf(it) * 337 + 1);
    rbox(B, M.grain('#9a7b52', 0.75), w, 0.18, d, 0, h - 0.18, 0, 0.02);
    for (const sx of [-1, 1]) {
      slab(B, m, 0.16, h - 0.18, d - 0.3, sx * (w / 2 - 0.4), 0, 0);
      slab(B, m, 0.4, 0.1, d, sx * (w / 2 - 0.4), 0, 0);
    }
    slab(B, m, w - 1.2, 0.1, d - 0.5, 0, 0.7, 0);
    // A bench vice, a pegboard and some tools.
    slab(B, M.painted('#2e6f8e', 0.4), 0.9, 0.7, 1.4, -w / 2 + 1.2, h, 0.1);
    B.add(cylGeo(0.09, 0.09, 1, 8).rotateX(PI / 2), M.metal('#9aa1a8', 0.3), { pos: [-w / 2 + 1.2, h + 0.5, 0.9] });
    barX(B, M.metal('#9aa1a8', 0.3), 0.06, 0.8, -w / 2 + 1.2, h + 0.5, 1.3, 6);
    for (let i = 0; i < 6; i++) if (r() < 0.7) {
      const x = -w / 2 + 2.6 + r() * (w - 3.5);
      B.add(cylGeo(0.05, 0.05, 0.7 + r() * 0.5, 6).rotateZ(PI / 2), M.metal('#aeb4ba', 0.3), { pos: [x, h + 0.05, (r() - 0.5) * (d - 0.8)], rot: [0, r() * 3, 0] });
    }
  },
  toolchest(B, it, { w, d, h }) {
    const body = M.painted(it.color || '#c0392b', 0.4);
    slab(B, body, w, h - 0.5, d, 0, 0.4, 0);
    rbox(B, M.grain('#9a7b52', 0.75), w + 0.15, 0.14, d + 0.1, 0, h - 0.14, 0, 0.02);
    const n = 5;
    for (let i = 0; i < n; i++) {
      const y = 0.5 + i * ((h - 0.8) / n);
      rbox(B, body, w - 0.12, (h - 0.8) / n - 0.06, 0.06, 0, y, d / 2 - 0.02, 0.012);
      barX(B, M.metal('#c9ced3', 0.3), 0.045, w * 0.5, 0, y + ((h - 0.8) / n) * 0.5, d / 2 + 0.07, 6);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add(cylGeo(0.22, 0.22, 0.12, 10).rotateZ(PI / 2), blackPl(0.6), { pos: [sx * (w / 2 - 0.3), 0.22, sz * (d / 2 - 0.3)] });
  },
  tyrerack(B, it, { w, d, h }) {
    const m = M.painted('#e36a1c', 0.45);
    const r = rng(seedOf(it) * 347 + 2);
    for (const sx of [-1, 1]) slab(B, m, 0.22, h, d, sx * (w / 2 - 0.11), 0, 0);
    for (let k = 0; k < 3; k++) {
      const y = 1 + k * ((h - 1.4) / 3);
      for (const sz of [-1, 1]) slab(B, m, w, 0.18, 0.18, 0, y, sz * (d / 2 - 0.3));
      for (let i = 0; i < Math.floor(w / 0.75); i++) if (r() < 0.85) {
        const rad = 1.05 + r() * 0.2;
        B.add(new THREE.TorusGeometry(rad, 0.33, 8, 18).rotateY(PI / 2), M.tyre(), { pos: [-w / 2 + 0.5 + i * 0.75, y + rad + 0.1, 0] });
        if (r() < 0.4) B.add(cylGeo(rad * 0.62, rad * 0.62, 0.5, 14).rotateZ(PI / 2), M.alloy('#c9ced3', 0.3), { pos: [-w / 2 + 0.5 + i * 0.75, y + rad + 0.1, 0] });
      }
    }
  },
  compressor(B, it, { w, d, h }) {
    const m = M.painted('#1f4f9c', 0.4);
    B.add(cylGeo(w / 2 - 0.1, w / 2 - 0.1, d - 1, 18).rotateX(PI / 2), m, { pos: [0, w / 2 + 0.3, 0] });
    for (const sz of [-1, 1]) lathe(B, m, [[0.01, 0], [w / 2 - 0.3, 0.12], [w / 2 - 0.1, 0.4]], 0, w / 2 + 0.3, sz * (d / 2 - 0.5), 16, [sz > 0 ? -PI / 2 : PI / 2, 0, 0]);
    for (const sz of [-1, 1]) slab(B, M.painted('#55585d', 0.5), w - 0.4, 0.3, 0.6, 0, 0, sz * (d / 2 - 0.8));
    // Pump, motor and the pressure gauges.
    slab(B, M.painted('#2b2f36', 0.5), 1.4, 1.1, 1.6, -0.3, h - 1.3, -0.4);
    B.add(cylGeo(0.75, 0.75, 1.3, 14).rotateZ(PI / 2), M.painted('#55585d', 0.45), { pos: [0.9, h - 0.9, -0.4] });
    for (const a of [0.3, -0.3]) B.add(cylGeo(0.3, 0.3, 0.9, 10), M.metal('#9aa1a8', 0.4), { pos: [-0.6, h - 0.3, -0.4 + a], rot: [0.2, 0, a * 0.8] });
    disc(B, M.metal('#c9ced3', 0.3), 0.3, 0.1, 0, h - 1.6, d / 2 - 0.6, 14);
    void it;
  },
  enginehoist(B, it, { w, d, h }) {
    const m = M.painted('#c0392b', 0.4);
    for (const sx of [-1, 1]) {
      slab(B, m, 0.4, 0.4, d - 0.6, sx * (w / 2 - 0.3), 0.2, 0.2);
      for (const sz of [-1, 1]) B.add(cylGeo(0.25, 0.25, 0.2, 10).rotateZ(PI / 2), blackPl(0.6), { pos: [sx * (w / 2 - 0.3), 0.25, 0.2 + sz * (d / 2 - 0.6)] });
      slab(B, m, 0.45, h - 2.4, 0.45, sx * (w / 2 - 0.3), 0.4, -d / 2 + 0.6);
    }
    slab(B, m, w - 0.2, 0.5, 0.5, 0, h - 2, -d / 2 + 0.6);
    slab(B, m, 0.5, 0.5, d * 0.75, 0, h - 2, -d / 2 + 0.6 + d * 0.37);
    B.tube(m, [0, h - 2, -d / 2 + 0.8], [0, h - 2 + 1.6, -d / 2 + 0.8 + d * 0.45], 0.22, 8);
    B.add(cylGeo(0.3, 0.3, 1.6, 12).rotateZ(PI / 2), M.metal('#9aa1a8', 0.4), { pos: [0, h - 2.6, -d / 2 + 1.6], rot: [0, 0, 0] });
    B.tube(M.metal('#55585d', 0.5), [0, h - 0.4, d / 2 - 0.5], [0, h - 2.6, d / 2 - 0.5], 0.05, 6);
    B.add(new THREE.TorusGeometry(0.22, 0.07, 6, 12), M.metal('#55585d', 0.5), { pos: [0, h - 2.8, d / 2 - 0.5], rot: [0, PI / 2, 0] });
  },
  wheelbalancer(B, it, { w, d, h }) {
    const m = M.painted('#e9eaea', 0.4);
    slab(B, M.painted('#55585d', 0.5), w - 0.4, 0.3, d, 0, 0, 0);
    slab(B, m, w - 0.8, h - 2.2, d - 0.6, -0.4, 0.3, 0);
    rbox(B, m, w, 1.4, d - 0.4, -0.4, h - 1.9, 0, 0.12);
    rbox(B, M.pianoBlack(), 1.6, 1, 0.12, -0.4, h - 1.5, d / 2 - 0.3, 0.03, [-0.3, 0, 0]);
    face(B, screenMat('chart', seedOf(it)), 1.4, 0.8, -0.4, h - 1, d / 2 - 0.15, [-0.3, 0, 0]);
    B.add(cylGeo(0.22, 0.22, 2.4, 12).rotateZ(PI / 2), M.metal('#9aa1a8', 0.35), { pos: [w / 2 - 0.4, h - 2.6, 0] });
    B.add(new THREE.TorusGeometry(1.1, 0.33, 8, 18).rotateY(PI / 2), M.tyre(), { pos: [w / 2 - 0.1, h - 2.6, 0] });
    B.add(cylGeo(0.7, 0.7, 0.5, 14).rotateZ(PI / 2), M.alloy('#c9ced3', 0.3), { pos: [w / 2 - 0.1, h - 2.6, 0] });
  },
  partscounter(B, it, { w, d, h }) {
    const body = lam(it);
    slab(B, body, w, h - 0.2, d - 0.8, 0, 0, -0.4);
    rbox(B, M.laminate('#3d434b', 0.35), w + 0.2, 0.16, d, 0, h - 0.2, 0, 0.03);
    monitor(B, -w * 0.25, h, -0.5, { w: 1.6, kind: 'sheet', seed: seedOf(it), turn: 0.15 });
    const r = rng(seedOf(it) * 349 + 5);
    for (let i = 0; i < 4; i++) if (r() < 0.8) slab(B, M.plastic(['#b58a55', '#2b2f36', '#c0392b'][Math.floor(r() * 3)], 0.6), 0.9, 0.5, 0.8, w / 2 - 1 - i * 1.1, h, -0.2, [0, (r() - 0.5) * 0.4, 0]);
    slab(B, M.painted('#2b2f36', 0.5), w, 0.14, 0.14, 0, 0.3, d / 2 - 0.45);
  },
  oildrain(B, it, { w, d, h }) {
    const m = M.painted('#e2b31b', 0.45);
    lathe(B, m, [[0.01, 0], [w / 2 - 0.2, 0.1], [w / 2 - 0.15, 1.9], [w / 2 - 0.3, 2], [0.3, 2.1], [0.26, 2.2]], 0, 0.9, 0, 18);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2 + 0.6;
      B.add(cylGeo(0.05, 0.05, 0.7, 6).rotateZ(PI / 2), M.metal('#55585d', 0.5), { pos: [Math.cos(a) * 0.35, 0.5, Math.sin(a) * 0.35], rot: [0, -a, 0] });
      B.add(cylGeo(0.13, 0.13, 0.08, 8).rotateZ(PI / 2), blackPl(0.6), { pos: [Math.cos(a) * 0.68, 0.13, Math.sin(a) * 0.68], rot: [0, -a, 0] });
    }
    post(B, M.metal('#9aa1a8', 0.35), 0.1, 0.1, 1.3, 0, 3, 0, 10);
    lathe(B, M.plastic('#2b2f36', 0.5), [[0.1, 0], [w / 2 + 0.1, 0.5], [w / 2 + 0.15, 0.6], [w / 2 - 0.4, 0.62]], 0, h - 0.7, 0, 18);
    void it;
  },
  showroomcar(B, it) {
    const car = CARS[seedOf(it) % CARS.length];
    const cb = carModel(car.id, it.color || null, null, {});
    const mtx = new THREE.Matrix4().makeRotationY(PI / 2);
    for (const [mat, geos] of cb.parts) for (const g of geos) B.add(g.clone().applyMatrix4(mtx), mat);
  },
  turntable(B, it, { w, h }) {
    const m = it.color === '#8a0f1a' ? M.cloth('#8a0f1a') : M.laminate(it.color || '#2b2f36', 0.3);
    disc(B, m, w / 2, h - 0.08, 0, 0, 0, 48);
    disc(B, M.metal('#c9a86a', 0.25), w / 2 + 0.06, 0.08, 0, h - 0.08, 0, 48);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * PI * 2;
      disc(B, M.glow('#fff4e2', 1.1), 0.12, 0.03, Math.cos(a) * (w / 2 - 0.35), h - 0.05, Math.sin(a) * (w / 2 - 0.35), 8);
    }
  },
};

/* ======================================================================= */
/*                                  GYM                                     */
/* ======================================================================= */

/** A weight plate on a bar or a peg. */
function plate(B, r, x, y, z, axis = 'x') {
  const g = new THREE.TorusGeometry(r, r * 0.3, 7, 16);
  if (axis === 'x') g.rotateY(PI / 2);
  B.add(g, M.painted('#17191c', 0.6), { pos: [x, y, z] });
  const d2 = cylGeo(r * 0.75, r * 0.75, r * 0.3, 14);
  if (axis === 'x') d2.rotateZ(PI / 2);
  B.add(d2, M.painted('#2b2f36', 0.65), { pos: [x, y, z] });
}

const GYM = [
  ['gym', 'treadmill', 'Treadmill', '🏃', 3.4, 7, 5.4, {}],
  ['gym', 'bikeupright', 'Exercise bike', '🚴', 2.4, 4.6, 4.8, {}],
  ['gym', 'rower', 'Rowing machine', '🚣', 2, 8, 3, {}],
  ['gym', 'elliptical', 'Cross trainer', '🦵', 2.6, 6.4, 5.6, {}],
  ['gym', 'benchflat', 'Weights bench', '🏋️', 2.4, 4.4, 1.6, {}],
  ['gym', 'rackpower', 'Power rack', '🔲', 6, 5.4, 8, { colors: [['#2b2f36', 'Black'], ['#c0392b', 'Red'], ['#1f4f9c', 'Blue']] }],
  ['gym', 'dumbbellrack', 'Dumbbell rack', '💪', 7, 2.2, 3.2, { len: true }],
  ['gym', 'cablemachine', 'Cable machine', '🏗️', 4, 4, 7.4, {}],
  ['gym', 'platetree', 'Weight tree', '⚫', 2.4, 2.4, 4.4, {}],
  ['gym', 'kettlebells', 'Kettlebell set', '🔔', 4, 1.4, 1.8, {}],
  ['gym', 'matstack', 'Exercise mats', '🧘', 2.6, 4.4, 1.4, { colors: BRIGHTS }],
  ['gym', 'punchbag', 'Punch bag', '🥊', 2, 2, 7, { ceil: true }],
  ['gym', 'gymball', 'Exercise balls', '⚪', 3.4, 2, 2.6, { colors: BRIGHTS }],
];

const GYM_B = {
  treadmill(B, it, { w, d, h }) {
    const m = M.painted('#2b2f36', 0.45);
    const deck = M.painted('#17191c', 0.7);
    slab(B, m, w, 0.6, d - 1, 0, 0.2, 0.3);
    slab(B, deck, w - 0.9, 0.2, d - 2.2, 0, 0.8, 0.5);
    for (const sz of [-1, 1]) B.add(cylGeo(0.22, 0.22, w - 0.95, 12).rotateZ(PI / 2), M.metal('#9aa1a8', 0.4), { pos: [0, 0.78, 0.5 + sz * (d - 2.2) / 2] });
    for (const sx of [-1, 1]) slab(B, m, 0.45, 0.55, d - 1.2, sx * (w / 2 - 0.22), 0.55, 0.3);
    // Console mast, rails and the screen.
    for (const sx of [-1, 1]) {
      B.tube(m, [sx * (w / 2 - 0.3), 0.6, -d / 2 + 1], [sx * (w / 2 - 0.3), h - 1.2, -d / 2 + 0.6], 0.11, 8);
      B.tube(blackPl(0.5), [sx * (w / 2 - 0.3), h - 2.2, -d / 2 + 0.8], [sx * (w / 2 - 0.3), h - 2.3, 0.4], 0.09, 8);
    }
    rbox(B, m, w - 0.2, 1.1, 0.5, 0, h - 1.15, -d / 2 + 0.6, 0.08, [0.3, 0, 0]);
    face(B, screenMat('chart', seedOf(it)), w - 0.6, 0.85, 0, h - 0.6, -d / 2 + 0.85, [0.3, 0, 0]);
  },
  bikeupright(B, it, { w, d, h }) {
    const m = M.painted('#3d434b', 0.45);
    slab(B, m, w, 0.35, 1.4, 0, 0, d / 2 - 0.8);
    slab(B, m, w, 0.35, 1.4, 0, 0, -d / 2 + 0.8);
    B.tube(m, [0, 0.35, d / 2 - 0.8], [0, h - 1.4, d / 2 - 1.6], 0.17, 8);
    B.tube(m, [0, 0.35, -d / 2 + 0.8], [0, h - 2.6, -d / 2 + 1.4], 0.17, 8);
    // Flywheel shroud, cranks, saddle and bars.
    rbox(B, M.painted('#e9eaea', 0.4), 0.7, 2.2, 2, 0, 0.5, -d / 2 + 1.5, 0.2);
    B.add(cylGeo(0.14, 0.14, 1.4, 10).rotateZ(PI / 2), M.metal('#9aa1a8', 0.35), { pos: [0, 1.5, -d / 2 + 2.3] });
    for (const sx of [-1, 1]) {
      slab(B, M.metal('#9aa1a8', 0.35), 0.1, 1.1, 0.25, sx * 0.6, 1.5 - sx * 0.55, -d / 2 + 2.3);
      slab(B, blackPl(0.5), 0.5, 0.1, 0.8, sx * 0.75, 1.5 - sx * 1.05, -d / 2 + 2.3);
    }
    cushion(B, M.leather('#2a2a2c', 0.5), 0.7, 0.3, 1.4, 0, h - 1.5, d / 2 - 1.65, { puff: 0.25, r: 0.2 });
    B.tube(blackPl(0.5), [-0.9, h - 1.3, -d / 2 + 1.1], [0.9, h - 1.3, -d / 2 + 1.1], 0.09, 8);
    for (const sx of [-1, 1]) B.tube(blackPl(0.5), [sx * 0.9, h - 1.3, -d / 2 + 1.1], [sx * 0.9, h - 1.4, -d / 2 + 2], 0.09, 8);
    rbox(B, M.pianoBlack(), 1.3, 0.9, 0.25, 0, h - 0.9, -d / 2 + 1, 0.05, [0.25, 0, 0]);
    face(B, screenMat('chart', seedOf(it) + 1), 1.1, 0.7, 0, h - 0.5, -d / 2 + 1.2, [0.25, 0, 0]);
  },
  rower(B, it, { w, d, h }) {
    const m = M.metal('#9aa1a8', 0.35);
    B.add(cylGeo(0.2, 0.2, d - 2.2, 10).rotateX(PI / 2), m, { pos: [0, h - 1.2, 0.4] });
    slab(B, M.painted('#2b2f36', 0.5), w, 0.4, 1.6, 0, h - 1.9, d / 2 - 0.9);
    slab(B, M.painted('#2b2f36', 0.5), w, 0.4, 1.8, 0, 0, -d / 2 + 0.9);
    // Seat on the rail, flywheel housing, footplates and handle.
    cushion(B, M.plastic('#17191c', 0.5), w - 0.6, 0.3, 1.1, 0, h - 0.95, -0.5, { puff: 0.2, r: 0.15 });
    lathe(B, M.plastic('#2b2f36', 0.5), [[0.01, 0], [1.1, 0.1], [1.15, 0.5], [1.05, 0.6], [0.2, 0.65]], 0, 0.4, -d / 2 + 1.4, 18, [PI / 2, 0, 0]);
    for (const sx of [-1, 1]) slab(B, M.plastic('#55585d', 0.5), 0.75, 0.12, 1.3, sx * 0.55, 1.1, -d / 2 + 2.6, [-0.35, 0, 0]);
    barX(B, blackPl(0.5), 0.07, 1.6, 0, 1.5, -d / 2 + 3.4, 8);
  },
  elliptical(B, it, { w, d, h }) {
    const m = M.painted('#3d434b', 0.45);
    slab(B, m, w, 0.4, d - 1, 0, 0, 0);
    rbox(B, M.painted('#e9eaea', 0.4), w - 0.4, 2.4, 2.2, 0, 0.4, -d / 2 + 1.4, 0.25);
    B.tube(m, [0, 2.8, -d / 2 + 1.4], [0, h - 1, -d / 2 + 1], 0.2, 8);
    for (const sx of [-1, 1]) {
      // Foot rail and pedal, plus the swinging arm.
      B.tube(m, [sx * 0.8, 0.6, -d / 2 + 2.2], [sx * 0.8, 1.2, d / 2 - 0.8], 0.11, 8);
      slab(B, M.plastic('#17191c', 0.6), 0.85, 0.14, 2, sx * 0.8, 1.2, 0.3, [-0.06, 0, 0]);
      B.tube(m, [sx * 0.75, 2.6, -d / 2 + 2], [sx * 0.95, h - 0.6, -d / 2 + 1.3 + sx * 0.2], 0.1, 8);
      B.tube(blackPl(0.5), [sx * 0.95, h - 0.6, -d / 2 + 1.3], [sx * 1.15, h - 0.2, -d / 2 + 2], 0.09, 8);
    }
    rbox(B, M.pianoBlack(), 1.5, 1, 0.3, 0, h - 1, -d / 2 + 1, 0.06, [0.25, 0, 0]);
    face(B, screenMat('chart', seedOf(it) + 2), 1.3, 0.8, 0, h - 0.6, -d / 2 + 1.22, [0.25, 0, 0]);
  },
  benchflat(B, it, { w, d, h }) {
    const m = M.painted('#2b2f36', 0.45);
    cushion(B, M.leather('#17191c', 0.5), w - 0.6, 0.35, d - 0.6, 0, h - 0.35, 0, { puff: 0.08, r: 0.12 });
    for (const sz of [-1, 1]) {
      B.tube(m, [0, h - 0.4, sz * (d / 2 - 0.5)], [0, 0.08, sz * (d / 2 - 0.2)], 0.12, 8);
      slab(B, m, w, 0.16, 0.5, 0, 0, sz * (d / 2 - 0.2));
    }
    slab(B, m, 0.3, 0.3, d - 1, 0, h - 0.65, 0);
  },
  rackpower(B, it, { w, d, h }) {
    const m = M.painted(it.color || '#2b2f36', 0.45);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      slab(B, m, 0.45, h, 0.45, sx * (w / 2 - 0.25), 0, sz * (d / 2 - 0.25));
      slab(B, m, 0.9, 0.2, 0.9, sx * (w / 2 - 0.25), 0, sz * (d / 2 - 0.25));
      // Punched holes up the uprights.
      for (let k = 0; k < 18; k++) slab(B, M.painted('#17191c', 0.7), 0.5, 0.11, 0.11, sx * (w / 2 - 0.25), 1 + k * ((h - 2) / 18), sz * (d / 2 - 0.25) + sz * 0.18);
    }
    for (const sx of [-1, 1]) slab(B, m, 0.4, 0.4, d, sx * (w / 2 - 0.25), h - 0.4, 0);
    slab(B, m, w, 0.4, 0.4, 0, h - 0.4, -d / 2 + 0.25);
    B.add(cylGeo(0.14, 0.14, w + 1.4, 12).rotateZ(PI / 2), M.metal('#9aa1a8', 0.3), { pos: [0, h - 0.6, d / 2 - 0.25] });
    // A loaded bar on the J-hooks.
    const bary = 4.4;
    B.add(cylGeo(0.12, 0.12, w + 2.6, 12).rotateZ(PI / 2), M.metal('#c9ced3', 0.3), { pos: [0, bary, -d / 2 + 0.6] });
    for (const sx of [-1, 1]) for (let k = 0; k < 2; k++) plate(B, 0.95 - k * 0.12, sx * (w / 2 + 0.35 - k * 0.3), bary, -d / 2 + 0.6);
    for (const sx of [-1, 1]) slab(B, M.painted('#17191c', 0.6), 0.3, 0.5, 0.6, sx * (w / 2 - 0.5), bary - 0.5, -d / 2 + 0.5);
  },
  dumbbellrack(B, it, { w, d, h }) {
    const m = M.painted('#2b2f36', 0.45);
    for (const sx of [-1, 1]) {
      slab(B, m, 0.3, h, d, sx * (w / 2 - 0.15), 0, 0);
      slab(B, m, 0.5, 0.14, d + 0.3, sx * (w / 2 - 0.15), 0, 0);
    }
    for (let k = 0; k < 2; k++) {
      const y = 1 + k * (h - 1.9);
      for (const sz of [-1, 1]) slab(B, m, w, 0.2, 0.35, 0, y, sz * (d / 2 - 0.3), [sz * 0.25, 0, 0]);
      const n = Math.floor(w / 1.1);
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + (w / n) * (i + 0.5);
        const rr = 0.3 + (1 - k) * 0.12 + (i / n) * 0.1;
        B.add(cylGeo(0.09, 0.09, 1.1, 8).rotateZ(PI / 2), M.metal('#c9ced3', 0.3), { pos: [x, y + 0.5, 0] });
        for (const sx of [-1, 1]) {
          B.add(cylGeo(rr, rr, 0.45, 12).rotateZ(PI / 2), M.painted('#17191c', 0.6), { pos: [x + sx * 0.34, y + 0.5, 0] });
          B.add(cylGeo(rr * 0.95, rr * 0.95, 0.5, 12).rotateZ(PI / 2), M.painted('#2b2f36', 0.5), { pos: [x + sx * 0.5, y + 0.5, 0] });
        }
      }
    }
  },
  cablemachine(B, it, { w, d, h }) {
    const m = M.painted('#2b2f36', 0.45);
    for (const sx of [-1, 1]) {
      slab(B, m, 0.4, h, 0.4, sx * (w / 2 - 0.2), 0, -d / 2 + 0.4);
      slab(B, m, 0.8, 0.2, d, sx * (w / 2 - 0.2), 0, 0);
    }
    slab(B, m, w, 0.4, 0.4, 0, h - 0.4, -d / 2 + 0.4);
    // The weight stack between the posts.
    slab(B, M.painted('#55585d', 0.5), w - 1.4, h - 1.4, 1.1, 0, 0.2, -d / 2 + 0.45);
    for (let k = 0; k < 12; k++) slab(B, M.painted('#17191c', 0.6), w - 1.7, 0.3, 1.2, 0, 0.3 + k * 0.34, -d / 2 + 0.45);
    for (const sx of [-1, 1]) {
      B.add(new THREE.TorusGeometry(0.22, 0.06, 6, 12), M.metal('#9aa1a8', 0.35), { pos: [sx * (w / 2 - 0.2), h - 0.75, -d / 2 + 0.4], rot: [0, PI / 2, 0] });
      B.tube(blackPl(0.6), [sx * (w / 2 - 0.2), h - 0.75, -d / 2 + 0.6], [sx * (w / 2 - 0.2), h - 2.6, -d / 2 + 0.6], 0.035, 5);
      barX(B, blackPl(0.5), 0.07, 0.8, sx * (w / 2 - 0.2), h - 2.7, -d / 2 + 0.6, 8);
    }
    cushion(B, M.leather('#17191c', 0.5), 1.5, 0.3, 1.5, 0, 1.4, d / 2 - 1, { puff: 0.1 });
    slab(B, m, 0.3, 1.4, 1.4, 0, 0, d / 2 - 1);
  },
  platetree(B, it, { w, h }) {
    const m = M.painted('#2b2f36', 0.45);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * PI * 2;
      slab(B, m, 0.3, 0.2, w / 2, Math.cos(a) * (w / 4), 0, Math.sin(a) * (w / 4), [0, -a, 0]);
    }
    post(B, m, 0.22, 0.26, h, 0, 0, 0, 10);
    for (let k = 0; k < 3; k++) {
      const y = 0.9 + k * ((h - 1.3) / 3);
      const rr = 0.95 - k * 0.18;
      for (const sx of [-1, 1]) {
        B.add(cylGeo(0.1, 0.1, 1.1, 8).rotateZ(PI / 2), M.metal('#9aa1a8', 0.35), { pos: [sx * 0.55, y, 0] });
        for (let p = 0; p < 2; p++) plate(B, rr, sx * (0.75 + p * 0.28), y, 0);
      }
    }
  },
  kettlebells(B, it, { w, d, h }) {
    const r = rng(seedOf(it) * 353 + 1);
    const n = 4;
    for (let i = 0; i < n; i++) {
      const s = 0.55 + i * 0.12;
      const x = -w / 2 + 0.7 + i * ((w - 1.4) / (n - 1));
      lathe(B, M.painted('#17191c', 0.55), [[s * 0.75, 0], [s, s * 0.45], [s * 0.85, s * 1.1], [s * 0.45, s * 1.25], [s * 0.42, s * 1.35]], x, 0, 0, 16);
      B.add(new THREE.TorusGeometry(s * 0.55, s * 0.17, 7, 14), M.painted('#17191c', 0.55), { pos: [x, s * 1.5, 0], rot: [0, PI / 2, 0] });
      slab(B, M.painted(['#c0392b', '#1f4f9c', '#1f7a54', '#e2b31b'][i], 0.4), s * 1.1, s * 0.3, 0.04, x, s * 0.5, s * 0.92);
    }
    void [d, h, r];
  },
  matstack(B, it, { w, d, h }) {
    const r = rng(seedOf(it) * 359 + 2);
    const n = Math.max(3, Math.round(h / 0.22));
    for (let i = 0; i < n; i++) {
      const col = i % 2 ? shadeHex(it.color || BRIGHTS[2][0], 0.85) : (it.color || BRIGHTS[2][0]);
      rbox(B, M.plastic(col, 0.8), w - r() * 0.1, 0.2, d - r() * 0.1, (r() - 0.5) * 0.12, i * 0.21, (r() - 0.5) * 0.15, 0.06, [0, (r() - 0.5) * 0.08, 0]);
    }
  },
  punchbag(B, it, { w, h }) {
    // Hangs from the ceiling.
    disc(B, M.painted('#55585d', 0.5), 0.75, 0.12, 0, -0.12, 0, 16);
    B.add(new THREE.TorusGeometry(0.16, 0.05, 6, 12), M.metal('#9aa1a8', 0.35), { pos: [0, -0.3, 0], rot: [PI / 2, 0, 0] });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2;
      B.tube(M.metal('#9aa1a8', 0.35), [0, -0.4, 0], [Math.cos(a) * w * 0.3, -1.3, Math.sin(a) * w * 0.3], 0.035, 5);
    }
    lathe(B, M.leather('#2a2a2c', 0.45), [[0.01, 0], [w / 2 - 0.15, 0.25], [w / 2, 0.6], [w / 2, h - 2], [w / 2 - 0.1, h - 1.7], [0.01, h - 1.6]], 0, -1.4, 0, 20, [PI, 0, 0]);
    void it;
  },
  gymball(B, it, { w, d, h }) {
    const r = rng(seedOf(it) * 367 + 3);
    for (let i = 0; i < 3; i++) {
      const rr = 1.1 - i * 0.12;
      const col = [it.color || BRIGHTS[1][0], BRIGHTS[2][0], BRIGHTS[4][0]][i];
      B.sphere(M.plastic(col, 0.45), rr, -w / 2 + 1.2 + i * 1.1, rr, (r() - 0.5) * (d - 2), { seg: 18 });
    }
    void h;
  },
};

register([...SCHOOL, ...MEDICAL, ...LOBBY, ...GARAGE, ...GYM],
  { ...SCHOOL_B, ...MEDICAL_B, ...LOBBY_B, ...GARAGE_B, ...GYM_B });

void [TABLE_H, COUNTER_H, METALS, seatPad, handle, barZ, barX];
