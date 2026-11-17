/* Furniture for places of work: offices, shops, warehouses, restaurants and
 * their kitchens. Schools, clinics, lobbies, garages and gyms are in
 * furniture-civic.js. Everything stands on y = 0, centred, front toward +z. */

import { register } from './furniture.js';
import {
  PI, WOODS, FABRICS, LEATHERS, LAMINATES, METALS, BRIGHTS, PRODUCT,
  rbox, slab, cushion, post, disc, barX, barZ, lathe, legs, handle, cabinet, stock,
  face, labelMat, screenMat, monitor, keyboard, foliage, shadeHex, rng, cylGeo, THREE, M,
} from './furnkit.js';

const seedOf = (it) => it.seed || 1;
const alu = (r = 0.35) => M.metal('#b9bfc4', r);
const steelLeg = () => M.painted('#3d434b', 0.45);
const blackPl = (r = 0.5) => M.plastic('#2b2f36', r);
const wood = (it, i = 0) => M.grain(it.color || WOODS[i][0], 0.45);
const lam = (it, i = 0) => M.laminate(it.color || LAMINATES[i][0], 0.42);

/* The tops furniture puts things on, so small pieces settle at the right height. */
const DESK_H = 2.45;
const TABLE_H = 2.45;
const COUNTER_H = 3.1;
const BAR_H = 3.6;

/* ======================================================================= */
/*                                 OFFICE                                   */
/* ======================================================================= */

/** A rectangular worktop on a steel frame, the way system desks are made. */
function deskTop(B, it, w, d, { h = DESK_H, t = 0.12, legMat = null, frame = true } = {}) {
  const top = lam(it);
  rbox(B, top, w, t, d, 0, h - t, 0, 0.02);
  const lg = legMat || steelLeg();
  if (frame) {
    for (const sx of [-1, 1]) {
      const x = sx * (w / 2 - 0.3);
      slab(B, lg, 0.14, h - t, d * 0.78, x, 0, 0);              // flat panel leg
      slab(B, lg, 0.3, 0.09, d * 0.9, x, 0, 0);                  // foot
    }
    slab(B, lg, w - 1.1, 0.1, 0.1, 0, h - t - 0.5, -d / 2 + 0.3); // cross rail
  }
}

/** A modesty panel / privacy screen above the back edge of a desk. */
function deskScreen(B, w, h, z, hex = '#5d6670') {
  rbox(B, M.cloth(hex), w, h, 0.09, 0, DESK_H, z, 0.03);
  for (const sx of [-1, 1]) slab(B, alu(0.3), 0.06, h, 0.14, sx * (w / 2 - 0.04), DESK_H, z);
}

/** The gas-lift base every office chair sits on. */
function chairBase(B, x, z, h, { mat = null, castors = true } = {}) {
  const m = mat || blackPl(0.45);
  post(B, M.metal('#9aa1a8', 0.3), 0.09, 0.09, h, x, 0.5, z, 10);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * PI * 2;
    B.add(cylGeo(0.05, 0.07, 0.95, 6).rotateZ(PI / 2), m, { pos: [x + Math.cos(a) * 0.48, 0.3, z + Math.sin(a) * 0.48], rot: [0, -a, 0] });
    if (castors) B.add(cylGeo(0.12, 0.12, 0.07, 10).rotateX(PI / 2), blackPl(0.6), { pos: [x + Math.cos(a) * 0.9, 0.13, z + Math.sin(a) * 0.9], rot: [0, -a, 0] });
  }
}

/** A seat and back on a frame: the shape under most chairs. */
function seatPad(B, mat, w, d, y, { back = 0, backT = 0.16, lean = 0.12, z = 0, thick = 0.22 } = {}) {
  cushion(B, mat, w, thick, d, 0, y, z, { puff: 0.1 });
  if (back) {
    const by = y + thick;
    cushion(B, mat, w * 0.94, back, backT, 0, by, z - d / 2 + 0.08 - Math.sin(lean) * back * 0.5, { rot: [-lean, 0, 0], puff: 0.06 });
  }
}

function taskChair(B, it, { arms = true, mesh = true, exec = false } = {}) {
  const fab = M.cloth(it.color || FABRICS[0][0]);
  const h = exec ? 1.6 : 1.5;
  chairBase(B, 0, 0, h - 0.55);
  // Seat pan on its mechanism.
  slab(B, blackPl(0.6), 1.2, 0.12, 1.1, 0, h - 0.18, 0.05);
  cushion(B, exec ? M.leather(it.color || LEATHERS[0][0]) : fab, 1.55, 0.26, 1.45, 0, h, 0.02, { puff: 0.14 });
  // Back: a mesh panel in a frame, or a padded shell.
  const bh = exec ? 2.1 : 1.85;
  const bz = -0.62;
  if (mesh && !exec) {
    for (const sx of [-1, 1]) B.add(cylGeo(0.05, 0.05, bh, 8), blackPl(0.5), { pos: [sx * 0.72, h + 0.3 + bh / 2, bz + 0.1 + sx * 0], rot: [0.1, 0, 0] });
    slab(B, blackPl(0.5), 1.5, 0.08, 0.1, 0, h + 0.3 + bh, bz - 0.02);
    slab(B, M.meshFence(), 1.42, bh - 0.12, 0.03, 0, h + 0.34, bz + 0.08, [0.1, 0, 0]);
    slab(B, blackPl(0.5), 1.5, 0.12, 0.16, 0, h + 0.36, bz + 0.1);
  } else {
    cushion(B, exec ? M.leather(it.color || LEATHERS[0][0]) : fab, 1.55, bh, 0.3, 0, h + 0.22, bz + 0.04, { rot: [0.12, 0, 0], puff: 0.08 });
    if (exec) for (let i = 1; i < 3; i++) slab(B, blackPl(0.7), 1.5, 0.03, 0.02, 0, h + 0.22 + (bh * i) / 3, bz + 0.2);
  }
  slab(B, blackPl(0.5), 0.18, 0.5, 0.5, 0, h + 0.1, bz - 0.1);
  if (arms) for (const sx of [-1, 1]) {
    slab(B, blackPl(0.5), 0.1, 0.72, 0.12, sx * 0.84, h + 0.1, -0.2);
    rbox(B, blackPl(0.35), 0.26, 0.11, 0.95, sx * 0.84, h + 0.82, 0.02, 0.05);
  }
}

function fileCab(B, it, w, d, h, drawers) {
  const body = M.painted(it.color || METALS[2][0], 0.45);
  slab(B, body, w, h, d, 0, 0, 0);
  const dh = (h - 0.12) / drawers;
  for (let i = 0; i < drawers; i++) {
    const y = 0.1 + i * dh;
    rbox(B, body, w - 0.08, dh - 0.05, 0.06, 0, y, d / 2 - 0.02, 0.012);
    slab(B, M.metal('#9aa1a8', 0.3), w * 0.44, 0.1, 0.07, 0, y + dh * 0.62, d / 2 + 0.03);
    slab(B, M.laminate('#f1efe9', 0.6), 0.5, 0.18, 0.01, -w / 2 + 0.42, y + dh * 0.2, d / 2 + 0.035);
  }
}

function shelfRun(B, mat, w, d, h, shelves, { back = null, t = 0.09, y0 = 0 } = {}) {
  slab(B, mat, t, h, d, -w / 2 + t / 2, y0, 0);
  slab(B, mat, t, h, d, w / 2 - t / 2, y0, 0);
  slab(B, mat, w, t, d, 0, y0, 0);
  slab(B, mat, w, t, d, 0, y0 + h - t, 0);
  if (back) slab(B, back, w - t * 2, h - t * 2, 0.04, 0, y0 + t, -d / 2 + 0.02);
  const ys = [];
  for (let i = 1; i <= shelves; i++) {
    const y = y0 + t + ((h - t * 2) * i) / (shelves + 1);
    slab(B, mat, w - t * 2, 0.07, d - 0.06, 0, y, 0.02);
    ys.push(y + 0.07);
  }
  return ys;
}

const OFFICE = [
  ['office', 'desk', 'Desk', '🖥️', 5, 2.6, 2.6, { colors: LAMINATES, surface: DESK_H, len: true }],
  ['office', 'deskl', 'Corner desk', '📐', 6, 6, 2.6, { colors: LAMINATES, surface: DESK_H }],
  ['office', 'deskbench', 'Bench desks (four)', '🧑‍💻', 11, 5.2, 4.4, { colors: LAMINATES, surface: DESK_H, len: true, colors2: FABRICS, label2: 'Screen fabric' }],
  ['office', 'deskstand', 'Sit-stand desk', '⬆️', 5, 2.6, 3.9, { colors: LAMINATES, surface: 3.75 }],
  ['office', 'deskreception', 'Reception desk', '💁', 8, 3, 3.6, { colors: LAMINATES, len: true, colors2: WOODS, label2: 'Counter top' }],
  ['office', 'chairtask', 'Task chair', '💺', 2.2, 2.2, 3.6, { colors: FABRICS }],
  ['office', 'chairexec', 'Executive chair', '🪑', 2.4, 2.5, 4, { colors: LEATHERS }],
  ['office', 'chairguest', 'Visitor chair', '🪑', 1.9, 1.9, 2.9, { colors: FABRICS }],
  ['office', 'chairstack', 'Stacking chair', '🪑', 1.7, 1.8, 2.8, { colors: BRIGHTS }],
  ['office', 'pedestal', 'Desk pedestal', '🗄️', 1.4, 2, 2.1, { colors: METALS }],
  ['office', 'cabfile', 'Filing cabinet', '🗃️', 1.5, 2.1, 4.2, { colors: METALS }],
  ['office', 'cablateral', 'Lateral filing cabinet', '🗄️', 3.2, 1.8, 4.2, { colors: METALS }],
  ['office', 'cabtall', 'Storage cupboard', '🚪', 3, 1.6, 6.2, { colors: METALS }],
  ['office', 'credenza', 'Credenza', '🪟', 5, 1.6, 2.4, { colors: WOODS, surface: 2.4, len: true }],
  ['office', 'bookcase', 'Bookcase', '📚', 3, 1.2, 6, { colors: WOODS }],
  ['office', 'bookcaselow', 'Low bookcase', '📖', 3, 1.2, 3.4, { colors: WOODS, surface: 3.4 }],
  ['office', 'tablemeet', 'Meeting table', '🪑', 10, 4, 2.5, { colors: WOODS, surface: TABLE_H, len: true }],
  ['office', 'tableround', 'Round table', '⭕', 4, 4, 2.5, { colors: WOODS, surface: TABLE_H }],
  ['office', 'tableflip', 'Folding training table', '📋', 6, 2, 2.5, { colors: LAMINATES, surface: TABLE_H, len: true }],
  ['office', 'whiteboard', 'Whiteboard', '📝', 8, 0.4, 4, { wall: true, mount: 5.4, len: true }],
  ['office', 'pinboard', 'Pin board', '📌', 5, 0.3, 3.4, { wall: true, mount: 5.2, len: true }],
  ['office', 'printer', 'Office copier', '🖨️', 2.6, 2.4, 4, { colors: METALS }],
  ['office', 'printerdesk', 'Desktop printer', '🖨️', 1.6, 1.3, 1, { top: true, colors: METALS }],
  ['office', 'shredder', 'Shredder', '🗑️', 1.4, 1.3, 2.3, {}],
  ['office', 'watercooler', 'Water cooler', '🚰', 1.3, 1.3, 4.3, {}],
  ['office', 'coffeepoint', 'Coffee point', '☕', 5, 2, 7.2, { colors: LAMINATES, len: true }],
  ['office', 'pod', 'Acoustic phone booth', '📞', 4, 4, 7.4, { colors: FABRICS }],
  ['office', 'sofabreak', 'Breakout sofa', '🛋️', 6.4, 3, 2.7, { colors: FABRICS }],
  ['office', 'lockers', 'Locker bank', '🔐', 4, 1.6, 6, { colors: METALS, len: true }],
  ['office', 'servercab', 'Server rack', '🖧', 2, 3.2, 6.8, {}],
  ['office', 'safe', 'Floor safe', '🔒', 1.8, 1.8, 2.4, {}],
];

const OFFICE_B = {
  desk(B, it, { w, d }) {
    deskTop(B, it, w, d);
    const r = rng(seedOf(it) * 31 + 5);
    monitor(B, -w * 0.08, DESK_H, -d * 0.22, { w: 2.0, kind: ['desktop', 'sheet', 'code', 'chart'][Math.floor(r() * 4)], seed: seedOf(it) });
    keyboard(B, -w * 0.08, DESK_H, d * 0.08);
    if (r() < 0.6) {
      slab(B, M.laminate('#f1efe9', 0.7), 0.85, 0.09, 1.1, w / 2 - 0.9, DESK_H, -d * 0.1);
      slab(B, M.laminate(PRODUCT[Math.floor(r() * 8)], 0.6), 0.75, 0.05, 1, w / 2 - 0.9, DESK_H + 0.09, -d * 0.1, [0, 0, 0.03]);
    }
    if (r() < 0.5) disc(B, M.porcelain('#f4f4f0'), 0.17, 0.3, w / 2 - 1.9, DESK_H, d * 0.14, 12);
  },
  deskl(B, it, { w, d }) {
    // The main run across the front, and a return going back on the left.
    const main = 2.6;
    const top = lam(it);
    rbox(B, top, w, 0.12, main, 0, DESK_H - 0.12, d / 2 - main / 2, 0.02);
    const retD = d - main;
    rbox(B, top, main, 0.12, retD, -w / 2 + main / 2, DESK_H - 0.12, -main / 2, 0.02);
    const lg = steelLeg();
    for (const [x, z] of [[w / 2 - 0.35, d / 2 - main / 2], [-w / 2 + 0.35, d / 2 - main / 2], [-w / 2 + 0.35, -d / 2 + 0.5]]) {
      slab(B, lg, 0.14, DESK_H - 0.12, 1.9, x, 0, z);
      slab(B, lg, 0.34, 0.09, 2.1, x, 0, z);
    }
    monitor(B, 0.4, DESK_H, d / 2 - main + 0.5, { w: 2.1, kind: 'desktop', seed: seedOf(it) });
    monitor(B, -w / 2 + 0.75, DESK_H, -main / 2, { w: 1.9, kind: 'sheet', seed: seedOf(it) + 2, turn: PI / 2 });
    keyboard(B, 0.4, DESK_H, d / 2 - main / 2 + 0.3);
  },
  deskbench(B, it, { w, d }) {
    const top = lam(it);
    const r = rng(seedOf(it) * 17 + 11);
    for (const sz of [-1, 1]) rbox(B, top, w, 0.12, d / 2 - 0.1, 0, DESK_H - 0.12, sz * (d / 4 + 0.05), 0.02);
    for (const sx of [-1, 1]) {
      slab(B, steelLeg(), 0.16, DESK_H - 0.12, 0.16, sx * (w / 2 - 0.5), 0, -d / 2 + 0.6);
      slab(B, steelLeg(), 0.16, DESK_H - 0.12, 0.16, sx * (w / 2 - 0.5), 0, d / 2 - 0.6);
      slab(B, steelLeg(), 0.16, 0.14, d - 1.2, sx * (w / 2 - 0.5), DESK_H - 0.4, 0);
      slab(B, steelLeg(), 0.4, 0.09, d - 0.9, sx * (w / 2 - 0.5), 0, 0);
    }
    slab(B, steelLeg(), w - 1.4, 0.3, 0.12, 0, DESK_H - 0.9, 0);
    deskScreen(B, w, 1.45, 0, it.color2 || FABRICS[0][0]);
    for (let i = 0; i < 2; i++) for (const sz of [-1, 1]) {
      const x = (i - 0.5) * w * 0.52;
      monitor(B, x, DESK_H, sz * 0.75, { w: 1.9, kind: ['desktop', 'code', 'sheet', 'chart'][Math.floor(r() * 4)], seed: seedOf(it) + i * 3 + (sz > 0 ? 1 : 0), turn: sz > 0 ? PI : 0 });
      keyboard(B, x, DESK_H, sz * 1.75, sz > 0 ? PI : 0);
    }
  },
  deskstand(B, it, { w, d }) {
    const top = lam(it);
    const h = 3.75;
    rbox(B, top, w, 0.12, d, 0, h - 0.12, 0, 0.02);
    for (const sx of [-1, 1]) {
      const x = sx * (w / 2 - 0.5);
      slab(B, M.painted('#d9dadc', 0.4), 0.34, h - 0.12, 0.34, x, 0, 0);
      slab(B, M.painted('#9aa1a8', 0.35), 0.26, h - 0.9, 0.26, x, 0, 0);
      rbox(B, steelLeg(), 0.3, 0.14, d + 0.3, x, 0, 0, 0.04);
    }
    slab(B, blackPl(0.4), 1.1, 0.3, 0.14, w / 2 - 1.4, h - 0.42, d / 2 - 0.02);
    monitor(B, 0, h, -d * 0.2, { w: 2.1, kind: 'code', seed: seedOf(it) });
    keyboard(B, 0, h, d * 0.1);
  },
  deskreception(B, it, { w }) {
    const body = lam(it);
    // Low working top behind, high transaction top in front.
    slab(B, body, w, 2.45, 1.5, 0, 0, -0.6);
    rbox(B, M.laminate('#e9e6df', 0.35), w, 0.14, 1.7, 0, 2.45, -0.6, 0.03);
    slab(B, body, w, 3.45, 1.1, 0, 0, 0.85);
    rbox(B, M.grain(it.color2 || WOODS[3][0], 0.4), w + 0.2, 0.18, 1.5, 0, 3.45, 0.9, 0.05);
    slab(B, M.glow('#e8f1ff', 0.6), w - 1, 0.05, 0.08, 0, 2.9, 1.42);
    monitor(B, w * 0.22, 2.45, -0.5, { w: 1.8, kind: 'desktop', seed: seedOf(it), turn: PI * 0.08 });
    keyboard(B, w * 0.22, 2.45, -0.1);
  },
  chairtask: (B, it) => taskChair(B, it, { arms: true, mesh: true }),
  chairexec: (B, it) => taskChair(B, it, { arms: true, exec: true }),
  chairguest(B, it) {
    const fab = M.cloth(it.color || FABRICS[0][0]);
    const m = alu(0.3);
    for (const sx of [-1, 1]) {
      // Cantilever frame: a continuous bent tube.
      B.tube(m, [sx * 0.72, 0.03, 0.75], [sx * 0.72, 0.03, -0.72], 0.05, 8);
      B.tube(m, [sx * 0.72, 0.03, 0.75], [sx * 0.72, 1.45, 0.72], 0.05, 8);
      B.tube(m, [sx * 0.72, 1.45, 0.72], [sx * 0.72, 1.45, -0.6], 0.05, 8);
      B.tube(m, [sx * 0.72, 1.45, -0.6], [sx * 0.72, 2.85, -0.78], 0.05, 8);
    }
    seatPad(B, fab, 1.55, 1.55, 1.45, { back: 1.25, lean: 0.14, z: 0.02, thick: 0.2 });
    cushion(B, fab, 1.5, 1.25, 0.2, 0, 1.68, -0.76, { rot: [0.13, 0, 0], puff: 0.05 });
  },
  chairstack(B, it) {
    const sh = M.plastic(it.color || BRIGHTS[1][0], 0.45);
    const m = M.metal('#aeb4ba', 0.3);
    legs(B, m, 1.5, 1.5, 1.42, { round: true, t: 0.1, splay: 0.08 });
    for (const sz of [-1, 1]) barX(B, m, 0.05, 1.4, 0, 0.55, sz * 0.62, 8);
    cushion(B, sh, 1.5, 0.14, 1.45, 0, 1.42, 0, { puff: 0.18, r: 0.2 });
    cushion(B, sh, 1.4, 1.2, 0.16, 0, 1.6, -0.66, { rot: [0.16, 0, 0], puff: 0.1, r: 0.18 });
  },
  pedestal(B, it, { w, d, h }) {
    fileCab(B, it, w, d, h, 3);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add(cylGeo(0.09, 0.09, 0.09, 8).rotateX(PI / 2), blackPl(0.6), { pos: [sx * (w / 2 - 0.2), 0.05, sz * (d / 2 - 0.25)] });
  },
  cabfile: (B, it, { w, d, h }) => fileCab(B, it, w, d, h, 4),
  cablateral: (B, it, { w, d, h }) => fileCab(B, it, w, d, h, 3),
  cabtall(B, it, { w, d, h }) {
    const body = M.painted(it.color || METALS[2][0], 0.45);
    slab(B, body, w, h, d, 0, 0, 0);
    for (const sx of [-1, 1]) {
      rbox(B, body, w / 2 - 0.06, h - 0.3, 0.07, sx * w / 4, 0.15, d / 2 - 0.03, 0.012);
      handle(B, M.metal('#9aa1a8', 0.3), -sx * 0.18, h * 0.5, d / 2, 0.8, true);
    }
    slab(B, M.painted('#2b2f36', 0.6), w - 0.2, 0.15, d - 0.2, 0, 0, 0);
  },
  credenza(B, it, { w, d, h }) {
    cabinet(B, { w, h, d, body: wood(it), front: wood(it), cols: Math.max(2, Math.round(w / 2.2)), toe: 0.25, kind: 'door', top: wood(it), topT: 0.12 });
  },
  bookcase(B, it, { w, d, h }) {
    const m = wood(it);
    const ys = shelfRun(B, m, w, d, h, 4, { back: M.laminate(shadeHex(it.color || WOODS[0][0], 0.8), 0.7) });
    const r = rng(seedOf(it) * 41 + 3);
    for (const y of ys) if (r() < 0.85) stock(B, r, -w / 2 + 0.2, w / 2 - 0.2, y, -d / 2 + 0.1, d / 2 - 0.1, 'books', { fill: 0.78, maxH: 1.05 });
  },
  bookcaselow(B, it, { w, d, h }) {
    const m = wood(it);
    const ys = shelfRun(B, m, w, d, h, 1, { back: M.laminate(shadeHex(it.color || WOODS[0][0], 0.8), 0.7) });
    const r = rng(seedOf(it) * 43 + 7);
    for (const y of ys) stock(B, r, -w / 2 + 0.2, w / 2 - 0.2, y, -d / 2 + 0.1, d / 2 - 0.1, 'books', { fill: 0.7, maxH: 1.05 });
  },
  tablemeet(B, it, { w, d }) {
    const top = wood(it);
    rbox(B, top, w, 0.16, d, 0, TABLE_H - 0.16, 0, 0.03);
    // Two trestle legs and a stretcher.
    for (const sx of [-1, 1]) {
      const x = sx * (w / 2 - 1.3);
      slab(B, M.painted('#3d434b', 0.4), 0.3, TABLE_H - 0.16, d - 1.2, x, 0, 0);
      rbox(B, M.painted('#3d434b', 0.4), 0.6, 0.1, d - 0.6, x, 0, 0, 0.03);
    }
    // Power grommets down the middle.
    for (let i = -1; i <= 1; i++) if (w > 7 || i === 0) {
      disc(B, blackPl(0.4), 0.3, 0.03, (i * w) / 3.4, TABLE_H, 0, 12);
      disc(B, M.metal('#8a8f96', 0.3), 0.26, 0.05, (i * w) / 3.4, TABLE_H - 0.02, 0, 12);
    }
  },
  tableround(B, it, { w }) {
    const top = wood(it);
    const r = w / 2;
    disc(B, top, r, 0.14, 0, TABLE_H - 0.14, 0, 32);
    disc(B, M.metal('#8a8f96', 0.3), 0.22, TABLE_H - 0.2, 0, 0.06, 0, 16);
    lathe(B, M.painted('#3d434b', 0.4), [[r * 0.62, 0], [r * 0.6, 0.08], [0.3, 0.16], [0.26, 0.2]], 0, 0, 0, 24);
  },
  tableflip(B, it, { w, d }) {
    rbox(B, lam(it), w, 0.1, d, 0, TABLE_H - 0.1, 0, 0.02);
    const m = M.painted('#6f757c', 0.4);
    for (const sx of [-1, 1]) {
      const x = sx * (w / 2 - 0.6);
      B.tube(m, [x, 0.05, -d / 2 + 0.35], [x, TABLE_H - 0.1, -0.1], 0.06, 8);
      B.tube(m, [x, 0.05, d / 2 - 0.35], [x, TABLE_H - 0.1, 0.1], 0.06, 8);
      B.tube(m, [x, 0.05, -d / 2 + 0.35], [x, 0.05, d / 2 - 0.35], 0.06, 8);
    }
    slab(B, M.laminate('#8a8f96', 0.6), w - 1.4, 0.9, 0.05, 0, 1.1, -d / 2 + 0.06);
  },
  whiteboard(B, it, { w, h }) {
    const fr = alu(0.3);
    slab(B, fr, w, h, 0.16, 0, 0, 0.02);
    slab(B, M.porcelain('#fbfbf9'), w - 0.26, h - 0.26, 0.05, 0, 0.13, 0.17);
    slab(B, fr, w, 0.18, 0.38, 0, -0.18, 0.05);
    const r = rng(seedOf(it) * 53 + 1);
    for (let i = 0; i < 4; i++) B.add(cylGeo(0.07, 0.07, 0.5, 8).rotateZ(PI / 2), M.plastic(['#c0392b', '#1f4f9c', '#1f7a54', '#2b2f36'][i], 0.4), { pos: [-w / 2 + 0.7 + i * 0.35, -0.04, 0.2] });
    // A few strokes left on the board.
    for (let i = 0; i < 7; i++) {
      const y = h * 0.78 - Math.floor(r() * 5) * h * 0.14;
      slab(B, M.painted(['#1f4f9c', '#c0392b', '#2b2f36'][Math.floor(r() * 3)], 0.4), 0.9 + r() * 2.2, 0.045, 0.01, -w / 2 + 0.9 + r() * (w - 2.6), y, 0.2);
    }
  },
  pinboard(B, it, { w, h }) {
    slab(B, M.laminate('#8a7f6e', 0.9), w, h, 0.09, 0, 0, 0.05);
    for (const sx of [-1, 1]) slab(B, alu(0.4), 0.1, h + 0.1, 0.14, sx * (w / 2 + 0.02), -0.05, 0.05);
    const r = rng(seedOf(it) * 59 + 2);
    for (let i = 0; i < 9; i++) {
      const pw = 0.6 + r() * 0.5;
      slab(B, M.laminate(['#f6f5f1', '#f0e6c8', '#dfe8f2', '#f4d9d9'][Math.floor(r() * 4)], 0.8), pw, pw * 1.3, 0.02, -w / 2 + 0.5 + r() * (w - 1.2), 0.3 + r() * (h - 1.6), 0.1, [0, 0, (r() - 0.5) * 0.14]);
    }
  },
  printer(B, it, { w, d, h }) {
    const body = M.painted(it.color || '#e9e6df', 0.45);
    slab(B, body, w, h - 1.4, d, 0, 0, 0);
    rbox(B, body, w + 0.2, 1.1, d + 0.1, 0, h - 1.4, 0, 0.06);
    // Output tray slot and control panel.
    slab(B, blackPl(0.7), w - 0.3, 0.4, 0.3, 0, h - 1.15, d / 2 - 0.5);
    slab(B, M.painted('#d4d2cc', 0.5), w - 0.5, 0.06, 0.8, 0, h - 1.1, d / 2 - 0.8);
    rbox(B, blackPl(0.3), 1.2, 0.1, 0.8, w / 2 - 0.9, h - 0.3, d / 2 - 0.55, 0.03, [-0.5, 0, 0]);
    face(B, screenMat('pos', seedOf(it)), 0.95, 0.55, w / 2 - 0.9, h - 0.22, d / 2 - 0.4, [-0.5, 0, 0]);
    for (let i = 0; i < 3; i++) slab(B, M.painted('#d4d2cc', 0.5), w - 0.4, 0.05, 0.05, 0, 0.4 + i * 0.5, d / 2 + 0.01);
  },
  printerdesk(B, it, { w, d, h }) {
    const body = M.painted(it.color || '#3d434b', 0.5);
    rbox(B, body, w, h * 0.72, d, 0, 0, 0, 0.06);
    rbox(B, M.painted('#2b2f36', 0.6), w - 0.2, h * 0.3, d - 0.3, 0, h * 0.7, -0.05, 0.05);
    slab(B, M.laminate('#f6f5f1', 0.7), w - 0.5, 0.02, 0.5, 0, h * 0.72, d / 2 - 0.1, [0.12, 0, 0]);
  },
  shredder(B, it, { w, d, h }) {
    slab(B, M.plastic('#55585d', 0.4), w - 0.1, h * 0.72, d - 0.1, 0, 0, 0);
    rbox(B, blackPl(0.35), w, h * 0.3, d, 0, h * 0.7, 0, 0.04);
    slab(B, M.painted('#17191c', 0.8), w * 0.72, 0.03, 0.12, 0, h, 0);
  },
  watercooler(B, it, { w, d, h }) {
    const body = M.painted('#f1f2f0', 0.4);
    slab(B, body, w, h - 1.5, d, 0, 0, 0);
    lathe(B, M.clearGlass('#cfe6f0'), [[0.01, 0], [0.5, 0.1], [0.56, 0.9], [0.5, 1.3], [0.2, 1.45], [0.17, 1.5]], 0, h - 1.5, 0, 18);
    disc(B, M.plastic('#2e6f8e', 0.4), 0.3, 0.18, 0, h - 1.56, 0, 14);
    for (const [i, c] of [['#2e6f8e'], ['#c0392b']].entries()) {
      slab(B, M.plastic(c[0], 0.4), 0.16, 0.3, 0.3, (i - 0.5) * 0.44, h - 2.5, d / 2 - 0.05);
      barZ(B, M.plastic('#d9d9d6', 0.4), 0.05, 0.25, (i - 0.5) * 0.44, h - 2.42, d / 2 + 0.12, 6);
    }
    slab(B, M.metal('#9aa1a8', 0.25), 0.9, 0.04, 0.5, 0, h - 2.9, d / 2 - 0.15);
  },
  coffeepoint(B, it, { w, d }) {
    const body = lam(it);
    cabinet(B, { w, h: COUNTER_H, d, body, front: body, cols: Math.max(2, Math.round(w / 2.4)), kind: 'door', top: M.laminate('#3d434b', 0.3), topT: 0.14 });
    // Wall cupboards above, a kettle, a coffee machine and mugs.
    cabinet(B, { w, h: 2.2, d: d - 0.6, y0: 5, z: -0.3, body, front: body, cols: Math.max(2, Math.round(w / 2.4)), kind: 'door', toe: 0 });
    const y = COUNTER_H + 0.14;
    rbox(B, M.painted('#2b2f36', 0.35), 1.1, 1.3, 1, -w / 2 + 1.1, y, -0.1, 0.06);
    slab(B, M.metal('#b9bfc4', 0.25), 0.9, 0.08, 0.8, -w / 2 + 1.1, y, 0.1);
    lathe(B, M.metal('#c9ced3', 0.25), [[0.01, 0], [0.42, 0.05], [0.46, 0.85], [0.4, 1], [0.38, 1.05]], -w / 2 + 2.5, y, -0.05, 14);
    for (let i = 0; i < 4; i++) disc(B, M.porcelain(['#f4f4f0', '#2e6f8e', '#c0392b', '#f4f4f0'][i]), 0.17, 0.3, w / 2 - 1.6 + (i % 2) * 0.45, y, -0.35 + Math.floor(i / 2) * 0.45, 12);
    // A sink at the far end.
    slab(B, M.stainless(0.22), 1.5, 0.12, 1.2, w / 2 - 1.1, COUNTER_H - 0.02, 0);
    slab(B, M.painted('#2b2f36', 0.9), 1.3, 0.1, 1, w / 2 - 1.1, COUNTER_H - 0.1, 0);
    B.tube(M.chrome(), [w / 2 - 1.1, y, -d / 2 + 0.3], [w / 2 - 1.1, y + 0.85, -d / 2 + 0.3], 0.05, 8);
    B.tube(M.chrome(), [w / 2 - 1.1, y + 0.85, -d / 2 + 0.3], [w / 2 - 1.1, y + 0.8, -d / 2 + 0.9], 0.05, 8);
  },
  pod(B, it, { w, d, h }) {
    const felt = M.cloth(it.color || FABRICS[6][0]);
    const t = 0.3;
    // Four walls with a glass front and door gap, a lid and a floor.
    slab(B, felt, w, h, t, 0, 0, -d / 2 + t / 2);
    for (const sx of [-1, 1]) slab(B, felt, t, h, d - t * 2, sx * (w / 2 - t / 2), 0, 0);
    slab(B, felt, w, h * 0.14, d, 0, h - h * 0.14, 0);
    slab(B, M.laminate('#3d434b', 0.5), w - t * 2, 0.12, d - t * 2, 0, 0, 0);
    slab(B, M.clearGlass('#cfe0e6'), w - t * 2, h - h * 0.14 - 0.12, 0.06, 0, 0.12, d / 2 - 0.1);
    slab(B, felt, w * 0.3, h - h * 0.14 - 0.12, t, w / 2 - w * 0.15 - t / 2, 0.12, d / 2 - t / 2);
    barZ(B, M.metal('#c9ced3', 0.3), 0.045, 0.3, w * 0.18, 3.3, d / 2 - 0.02, 8);
    // A perch, a shelf and a downlight.
    rbox(B, M.grain('#a8743f', 0.45), w - t * 2 - 0.3, 0.12, 1.1, 0, 2.3, -d / 2 + 0.85, 0.02);
    cushion(B, M.cloth('#3b3b3f'), 1.6, 0.25, 1.1, -w * 0.18, 2.42, -d / 2 + 0.9, { puff: 0.1 });
    disc(B, M.glow('#fff4e2', 1.3), 0.3, 0.06, 0, h - h * 0.14 - 0.08, -0.2, 14);
  },
  sofabreak(B, it, { w, d, h }) {
    const fab = M.cloth(it.color || FABRICS[0][0]);
    slab(B, fab, w, 0.9, d, 0, 0.45, 0);
    for (let i = 0; i < 2; i++) cushion(B, fab, w / 2 - 0.12, 0.42, d - 0.5, (i - 0.5) * (w / 2 + 0.06), 1.35, 0.12, { puff: 0.16 });
    cushion(B, fab, w, h - 1.75, 0.65, 0, 1.75, -d / 2 + 0.33, { puff: 0.1 });
    for (const sx of [-1, 1]) cushion(B, fab, 0.55, 1.1, d, sx * (w / 2 - 0.28), 0.9, 0, { puff: 0.08 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) post(B, M.grain('#5b3a26', 0.4), 0.09, 0.07, 0.45, sx * (w / 2 - 0.4), 0, sz * (d / 2 - 0.4), 8);
    const r = rng(seedOf(it) * 61 + 4);
    for (let i = 0; i < 2; i++) cushion(B, M.cloth(FABRICS[Math.floor(r() * FABRICS.length)][0]), 1.3, 0.3, 1.3, (i - 0.5) * w * 0.6, 1.72, -d / 2 + 0.75, { rot: [0.35, 0, 0], puff: 0.2 });
  },
  lockers(B, it, { w, d, h }) {
    const body = M.painted(it.color || METALS[3][0], 0.45);
    const n = Math.max(2, Math.round(w / 1.3));
    slab(B, body, w, h, d, 0, 0.3, 0);
    slab(B, M.painted('#2b2f36', 0.6), w - 0.1, 0.3, d - 0.1, 0, 0, 0);
    slab(B, body, w, 0.2, d + 0.2, 0, h + 0.3, -0.1, [0.18, 0, 0]);
    const dw = w / n;
    for (let i = 0; i < n; i++) for (let k = 0; k < 2; k++) {
      const x = -w / 2 + dw * (i + 0.5);
      const y = 0.35 + k * (h - 0.1) / 2;
      rbox(B, body, dw - 0.1, (h - 0.1) / 2 - 0.08, 0.06, x, y, d / 2 - 0.02, 0.012);
      slab(B, M.metal('#9aa1a8', 0.3), 0.12, 0.5, 0.08, x + dw * 0.32, y + 0.5, d / 2 + 0.02);
      for (let v = 0; v < 3; v++) slab(B, M.painted('#2b2f36', 0.8), dw * 0.5, 0.03, 0.02, x, y + (h - 0.1) / 2 - 0.35 + v * 0.1, d / 2 + 0.03);
      slab(B, M.laminate('#f1efe9', 0.7), 0.3, 0.2, 0.01, x - dw * 0.2, y + (h - 0.1) / 2 - 0.6, d / 2 + 0.035);
    }
  },
  servercab(B, it, { w, d, h }) {
    slab(B, M.painted('#17191c', 0.5), w, h, d, 0, 0, 0);
    slab(B, M.meshFence(), w - 0.2, h - 0.5, 0.05, 0, 0.25, d / 2 - 0.02);
    const r = rng(seedOf(it) * 67 + 8);
    for (let i = 0; i < 14; i++) {
      const y = 0.4 + i * ((h - 0.8) / 14);
      const kind = r();
      if (kind < 0.55) {
        slab(B, M.painted('#2b2f36', 0.4), w - 0.35, 0.28, 0.3, 0, y, d / 2 - 0.35);
        for (let k = 0; k < 6; k++) slab(B, M.glow(k % 3 === 0 ? '#3fb950' : '#58a6ff', 1.4), 0.05, 0.05, 0.02, -w / 2 + 0.45 + k * 0.17, y + 0.14, d / 2 - 0.2);
      } else if (kind < 0.8) {
        slab(B, M.painted('#3d434b', 0.5), w - 0.35, 0.5, 0.3, 0, y, d / 2 - 0.35);
        for (let k = 0; k < 12; k++) slab(B, M.glow('#f0e05a', 1.2), 0.03, 0.03, 0.02, -w / 2 + 0.35 + k * 0.12, y + 0.3, d / 2 - 0.2);
      }
    }
  },
  safe(B, it, { w, d, h }) {
    const body = M.painted('#2b2f36', 0.45);
    rbox(B, body, w, h, d, 0, 0, 0, 0.05);
    rbox(B, M.painted('#3d434b', 0.4), w - 0.25, h - 0.25, 0.12, 0, 0.12, d / 2 - 0.02, 0.03);
    B.add(cylGeo(0.3, 0.3, 0.12, 18).rotateX(PI / 2), M.metal('#b9bfc4', 0.25), { pos: [0.35, h * 0.5, d / 2 + 0.05] });
    for (let i = 0; i < 3; i++) B.add(cylGeo(0.05, 0.05, 0.42, 8).rotateX(PI / 2).rotateZ((i / 3) * PI * 2), M.metal('#c9ced3', 0.25), { pos: [0.35, h * 0.5, d / 2 + 0.14], rot: [0, 0, (i / 3) * PI * 2] });
    slab(B, blackPl(0.3), 0.45, 0.6, 0.06, -0.5, h * 0.52, d / 2 + 0.04);
  },
};

/* ======================================================================= */
/*                                 RETAIL                                   */
/* ======================================================================= */

/** Upright posts and a footplate: the skeleton of every shop shelf. */
function gondolaFrame(B, w, d, h, mat, { ends = true } = {}) {
  slab(B, mat, w, 0.12, d, 0, 0, 0);
  if (ends) for (const sx of [-1, 1]) {
    slab(B, mat, 0.1, h, d, sx * (w / 2 - 0.05), 0, 0);
    for (let k = 0; k < 14; k++) slab(B, M.painted('#8a8f96', 0.6), 0.05, 0.05, d - 0.1, sx * (w / 2 - 0.05), 0.6 + k * ((h - 0.9) / 14), 0);
  }
}

const SHELF_COLS = [['#f1f2f0', 'White'], ['#d9d9d6', 'Light grey'], ['#3d434b', 'Graphite'], ['#2b2f36', 'Black'], ['#1f4f9c', 'Blue'], ['#1f7a54', 'Green']];

const RETAIL = [
  ['retail', 'gondola', 'Gondola shelving (double)', '🏪', 8, 4, 6, { colors: SHELF_COLS, len: true, variants: [['boxes', 'Packets'], ['cans', 'Tins'], ['bottles', 'Bottles'], ['folded', 'Folded clothing'], ['bins', 'Tubs']] }],
  ['retail', 'shelfwall', 'Wall shelving run', '🧱', 8, 2, 7, { colors: SHELF_COLS, len: true, variants: [['boxes', 'Packets'], ['cans', 'Tins'], ['bottles', 'Bottles'], ['folded', 'Folded clothing'], ['books', 'Books']] }],
  ['retail', 'endcap', 'End cap display', '🎁', 4, 2.4, 5, { colors: SHELF_COLS }],
  ['retail', 'pallettop', 'Pallet promotion', '📦', 4, 4, 4.2, {}],
  ['retail', 'tabledisplay', 'Display table', '🧺', 5, 3.4, 2.6, { colors: WOODS, surface: 2.6 }],
  ['retail', 'rackround', 'Round clothing rack', '👕', 4, 4, 5.2, { colors: METALS }],
  ['retail', 'rackrail', 'Clothing rail', '🧥', 6, 2, 5.4, { colors: METALS, len: true }],
  ['retail', 'mannequin', 'Mannequin', '🧍', 1.8, 1.8, 6, { colors: [['#e9e2d4', 'Cream'], ['#2b2f36', 'Black'], ['#b9bfc4', 'Chrome'], ['#8a7f6e', 'Timber']] }],
  ['retail', 'counterpos', 'Checkout counter', '💳', 6, 3, 3.3, { colors: LAMINATES, len: true }],
  ['retail', 'selfcheckout', 'Self-checkout', '🤳', 2.6, 2.6, 5, {}],
  ['retail', 'fridgeopen', 'Open chiller', '🥛', 8, 3, 7, { len: true }],
  ['retail', 'fridgeglass', 'Glass-door fridge', '🥤', 5, 2.6, 6.6, { len: true }],
  ['retail', 'freezerchest', 'Chest freezer', '🧊', 5, 2.8, 3, { len: true }],
  ['retail', 'deli', 'Serve-over counter', '🧀', 8, 3.4, 4.4, { len: true }],
  ['retail', 'produce', 'Produce display', '🍎', 6, 4, 3.6, { len: true }],
  ['retail', 'basketstack', 'Basket stack', '🧺', 1.6, 1.6, 3.2, {}],
  ['retail', 'trolleybay', 'Trolley bay', '🛒', 3, 7, 3.4, {}],
  ['retail', 'fittingbench', 'Fitting room bench', '🪑', 3, 1.4, 1.6, { colors: WOODS }],
  ['retail', 'shelfback', 'Back counter shelving', '🗄️', 6, 1.4, 7, { colors: LAMINATES, len: true }],
];

const RETAIL_B = {
  gondola(B, it, { w, d, h }, ctx, spec) {
    const mat = M.painted(it.color || SHELF_COLS[0][0], 0.45);
    const r = rng(seedOf(it) * 71 + 3);
    gondolaFrame(B, w, d, h, mat);
    slab(B, M.painted(shadeHex(it.color || SHELF_COLS[0][0], 0.9), 0.5), w - 0.2, h - 0.2, 0.08, 0, 0.1, 0);
    const kind = it.variant || 'boxes';
    for (const sz of [-1, 1]) {
      for (let k = 0; k < 4; k++) {
        const y = 0.75 + k * ((h - 1.1) / 4);
        slab(B, mat, w - 0.2, 0.06, d / 2 - 0.1, 0, y, sz * (d / 4 + 0.03));
        slab(B, mat, w - 0.2, 0.14, 0.04, 0, y + 0.06, sz * (d / 2 - 0.06));   // front lip
        stock(B, r, -w / 2 + 0.15, w / 2 - 0.15, y + 0.06, sz > 0 ? 0.06 : -d / 2 + 0.1, sz > 0 ? d / 2 - 0.1 : -0.06, kind, { maxH: (h - 1.1) / 4 - 0.18 });
        // Shelf-edge ticket strip.
        slab(B, M.laminate('#f6f5f1', 0.6), w - 0.24, 0.1, 0.02, 0, y + 0.07, sz * (d / 2 - 0.02));
      }
    }
    void spec;
  },
  shelfwall(B, it, { w, d, h }) {
    const mat = M.painted(it.color || SHELF_COLS[0][0], 0.45);
    const r = rng(seedOf(it) * 73 + 5);
    slab(B, mat, w, 0.12, d, 0, 0, 0);
    slab(B, mat, w, h, 0.1, 0, 0, -d / 2 + 0.05);
    for (const sx of [-1, 1]) slab(B, mat, 0.1, h, d, sx * (w / 2 - 0.05), 0, 0);
    for (let k = 0; k < 5; k++) {
      const y = 0.8 + k * ((h - 1.2) / 5);
      slab(B, mat, w - 0.2, 0.06, d - 0.15, 0, y, 0.04);
      slab(B, mat, w - 0.2, 0.12, 0.04, 0, y + 0.06, d / 2 - 0.06);
      stock(B, r, -w / 2 + 0.15, w / 2 - 0.15, y + 0.06, -d / 2 + 0.15, d / 2 - 0.08, it.variant || 'boxes', { maxH: (h - 1.2) / 5 - 0.2 });
      slab(B, M.laminate('#f6f5f1', 0.6), w - 0.24, 0.1, 0.02, 0, y + 0.07, d / 2 - 0.02);
    }
  },
  endcap(B, it, { w, d, h }) {
    const mat = M.painted(it.color || SHELF_COLS[4][0], 0.45);
    const r = rng(seedOf(it) * 79 + 7);
    slab(B, mat, w, 0.12, d, 0, 0, 0);
    slab(B, mat, w, h, 0.1, 0, 0, -d / 2 + 0.05);
    for (let k = 0; k < 3; k++) {
      const y = 0.8 + k * ((h - 1.4) / 3);
      slab(B, mat, w - 0.1, 0.06, d - 0.2, 0, y, 0.06);
      stock(B, r, -w / 2 + 0.1, w / 2 - 0.1, y + 0.06, -d / 2 + 0.2, d / 2 - 0.1, 'boxes', { maxH: (h - 1.4) / 3 - 0.2 });
    }
    slab(B, M.painted('#c0392b', 0.4), w, 0.7, 0.08, 0, h - 0.7, d / 2 - 0.1);
    face(B, labelMat(it.text || 'OFFER', { color: '#ffffff', bg: '#c0392b', aspect: 5 }), w - 0.2, 0.5, 0, h - 0.38, d / 2 - 0.04);
  },
  pallettop(B, it, { w, d }) {
    palletBase(B, w, d);
    const r = rng(seedOf(it) * 83 + 2);
    for (let k = 0; k < 3; k++) stock(B, r, -w / 2 + 0.3, w / 2 - 0.3, 0.5 + k * 1.1, -d / 2 + 0.3, d / 2 - 0.3, 'cartons', { maxH: 1 });
    slab(B, M.painted('#e2b31b', 0.4), w, 0.6, 0.05, 0, 3.6, d / 2 - 0.1);
    face(B, labelMat(it.text || 'SPECIAL', { color: '#2b2f36', bg: '#e2b31b', aspect: 6 }), w - 0.2, 0.42, 0, 3.9, d / 2 - 0.06);
  },
  tabledisplay(B, it, { w, d, h }) {
    const m = wood(it);
    rbox(B, m, w, 0.12, d, 0, h - 0.12, 0, 0.02);
    rbox(B, m, w - 0.6, 0.1, d - 0.6, 0, h * 0.45, 0, 0.02);
    legs(B, m, w, d, h - 0.12, { inset: 0.3, t: 0.18 });
    const r = rng(seedOf(it) * 89 + 6);
    stock(B, r, -w / 2 + 0.4, w / 2 - 0.4, h, -d / 2 + 0.5, d / 2 - 0.5, 'folded', { fill: 0.9 });
  },
  rackround(B, it, { w, h }) {
    const m = M.metal(it.color || '#c9ced3', 0.3);
    const r = rng(seedOf(it) * 97 + 1);
    post(B, m, 0.08, 0.08, h - 0.4, 0, 0, 0, 10);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * PI * 2;
      B.add(cylGeo(0.05, 0.05, w / 2 - 0.2, 6).rotateZ(PI / 2), m, { pos: [Math.cos(a) * (w / 4), 0.12, Math.sin(a) * (w / 4)], rot: [0, -a, 0] });
      B.add(cylGeo(0.1, 0.1, 0.06, 10).rotateX(PI / 2), blackPl(0.6), { pos: [Math.cos(a) * (w / 2 - 0.25), 0.1, Math.sin(a) * (w / 2 - 0.25)] });
    }
    B.add(new THREE.TorusGeometry(w / 2 - 0.25, 0.045, 6, 28).rotateX(PI / 2), m, { pos: [0, h - 0.4, 0] });
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * PI * 2 + r() * 0.1;
      hangingGarment(B, r, Math.cos(a) * (w / 2 - 0.25), h - 0.42, Math.sin(a) * (w / 2 - 0.25), -a);
    }
  },
  rackrail(B, it, { w, d, h }) {
    const m = M.metal(it.color || '#c9ced3', 0.3);
    const r = rng(seedOf(it) * 101 + 4);
    for (const sx of [-1, 1]) {
      const x = sx * (w / 2 - 0.3);
      post(B, m, 0.06, 0.06, h - 0.3, x, 0.1, 0, 10);
      rbox(B, m, 0.3, 0.1, d - 0.2, x, 0, 0, 0.03);
      B.tube(m, [x, h - 0.6, 0], [x, h - 0.3, 0], 0.05, 6);
    }
    barX(B, m, 0.05, w - 0.6, 0, h - 0.3, 0, 8);
    const n = Math.floor((w - 1) / 0.32);
    for (let i = 0; i < n; i++) hangingGarment(B, r, -w / 2 + 0.5 + i * 0.32, h - 0.32, 0, PI / 2);
  },
  mannequin(B, it, { h }) {
    const m = it.color === '#b9bfc4' ? M.chrome() : it.color === '#8a7f6e' ? M.grain('#a8743f', 0.5) : M.porcelain(it.color || '#e9e2d4');
    const s = h / 6;
    disc(B, M.metal('#9aa1a8', 0.3), 0.75 * s, 0.07 * s, 0, 0, 0, 20);
    post(B, M.metal('#9aa1a8', 0.3), 0.08 * s, 0.1 * s, 1.5 * s, 0, 0.07 * s, 0, 10);
    // Legs, hips, torso, shoulders — a dress form, no head.
    lathe(B, m, [[0.02, 0], [0.26, 0.05], [0.3, 0.6], [0.26, 1.3], [0.24, 1.55]], -0.22 * s, 1.5 * s, 0, 14);
    lathe(B, m, [[0.02, 0], [0.26, 0.05], [0.3, 0.6], [0.26, 1.3], [0.24, 1.55]], 0.22 * s, 1.5 * s, 0, 14);
    lathe(B, m, [[0.5, 0], [0.58, 0.35], [0.52, 0.8], [0.44, 1.3], [0.5, 1.75], [0.58, 2.1], [0.5, 2.3], [0.2, 2.4], [0.02, 2.42]], 0, 3.05 * s, 0, 18);
    for (const sx of [-1, 1]) B.add(cylGeo(0.12 * s, 0.09 * s, 2.1 * s, 10), m, { pos: [sx * 0.62 * s, 4.1 * s, 0], rot: [0, 0, sx * 0.1] });
  },
  counterpos(B, it, { w, d, h }) {
    const body = lam(it);
    slab(B, body, w, h, d - 0.4, 0, 0, -0.2);
    rbox(B, M.laminate('#3d434b', 0.35), w + 0.15, 0.14, d, 0, h, 0, 0.03);
    slab(B, M.painted('#2b2f36', 0.5), w, 0.12, 0.1, 0, 0.1, d / 2 - 0.25);    // kick rail
    // Till, screen, card reader, scanner and a bagging area.
    rbox(B, blackPl(0.4), 1.5, 0.5, 1.2, -w / 2 + 1.3, h + 0.14, -0.15, 0.04);
    rbox(B, blackPl(0.35), 1.3, 1.2, 0.12, -w / 2 + 1.3, h + 0.64, -0.5, 0.03, [-0.18, 0, 0]);
    face(B, screenMat('pos', seedOf(it)), 1.2, 1.05, -w / 2 + 1.3, h + 1.2, -0.38, [-0.18, 0, 0]);
    rbox(B, blackPl(0.4), 0.45, 0.65, 0.3, -w / 2 + 2.4, h + 0.14, 0.45, 0.05, [-0.3, 0, 0]);
    slab(B, M.metal('#b9bfc4', 0.25), 1.1, 0.1, 0.9, w / 2 - 1.5, h + 0.14, 0);
    slab(B, M.glow('#c0392b', 1.2), 0.5, 0.02, 0.4, w / 2 - 1.5, h + 0.15, 0);
    const r = rng(seedOf(it) * 103 + 9);
    for (let i = 0; i < 3; i++) slab(B, M.plastic(['#f1f2f0', '#e2e6e9'][i % 2], 0.6), 0.5, 0.35, 0.3, w / 2 - 0.7, h + 0.14 + i * 0.03, -0.4 + r() * 0.3, [0, r(), 0]);
  },
  selfcheckout(B, it, { w, d, h }) {
    const body = M.painted('#f1f2f0', 0.4);
    slab(B, body, w, 3, d - 0.6, 0, 0, -0.3);
    rbox(B, M.laminate('#d9d9d6', 0.35), w, 0.12, d, 0, 3, 0, 0.03);
    rbox(B, blackPl(0.35), 1.6, 1.3, 0.14, 0, h - 1.6, -0.5, 0.04, [-0.35, 0, 0]);
    face(B, screenMat('pos', seedOf(it) + 1), 1.45, 1.15, 0, h - 1.05, -0.25, [-0.35, 0, 0]);
    // Scales plate, card terminal, bag stand and the status light.
    slab(B, M.metal('#b9bfc4', 0.25), 1.1, 0.06, 0.9, -w / 2 + 0.7, 3.12, 0.3);
    rbox(B, blackPl(0.4), 0.4, 0.6, 0.28, w / 2 - 0.5, 3.12, 0.1, 0.05, [-0.3, 0, 0]);
    post(B, M.metal('#9aa1a8', 0.3), 0.06, 0.06, h - 3.2, w / 2 - 0.3, 3.12, -0.6, 8);
    for (let i = 0; i < 3; i++) B.add(cylGeo(0.16, 0.16, 0.22, 12), M.glow(['#c0392b', '#e2b31b', '#3fb950'][i], i === 2 ? 1.4 : 0.2), { pos: [w / 2 - 0.3, h - 0.1 - i * 0.24, -0.6] });
  },
  fridgeopen(B, it, { w, d, h }) {
    const body = M.painted('#e9eaea', 0.4);
    const r = rng(seedOf(it) * 107 + 3);
    // A carcass open at the front: back, sides, canopy and a kick plate.
    slab(B, body, w, h, 0.25, 0, 0, -d / 2 + 0.12);
    for (const sx of [-1, 1]) slab(B, body, 0.22, h, d, sx * (w / 2 - 0.11), 0, 0);
    slab(B, M.painted('#2b2f36', 0.7), w - 0.5, h - 1.6, 0.06, 0, 0.8, -d / 2 + 0.28);
    for (let k = 0; k < 4; k++) {
      const y = 1 + k * ((h - 2) / 4);
      slab(B, M.metal('#d9dadc', 0.3), w - 0.3, 0.06, d - 0.5, 0, y, 0.1);
      slab(B, M.metal('#d9dadc', 0.3), w - 0.3, 0.1, 0.03, 0, y + 0.06, d / 2 - 0.15);
      stock(B, r, -w / 2 + 0.2, w / 2 - 0.2, y + 0.06, -d / 2 + 0.3, d / 2 - 0.2, ['bottles', 'cans', 'boxes'][k % 3], { maxH: (h - 2) / 4 - 0.22 });
      slab(B, M.glow('#dff0f6', 0.8), w - 0.4, 0.04, 0.08, 0, y + (h - 2) / 4 - 0.14, d / 2 - 0.3);
      slab(B, M.laminate('#f6f5f1', 0.6), w - 0.34, 0.1, 0.02, 0, y + 0.07, d / 2 - 0.1);
    }
    slab(B, M.painted('#2e6f8e', 0.4), w, 0.8, d * 0.5, 0, h - 0.8, 0.1);
    slab(B, body, w, 0.35, d, 0, h - 1.15, 0);
    slab(B, M.painted('#55585d', 0.5), w, 0.9, d, 0, 0, 0);
    face(B, labelMat(it.text || 'CHILLED', { color: '#ffffff', bg: '#2e6f8e', aspect: 9 }), w - 0.6, 0.5, 0, h - 0.5, d * 0.25 + 0.03);
  },
  fridgeglass(B, it, { w, d, h }) {
    const body = M.painted('#d9d9d6', 0.4);
    const r = rng(seedOf(it) * 109 + 5);
    // Carcass: sides, back, top and base — the front is all door.
    for (const sx of [-1, 1]) slab(B, body, 0.2, h, d, sx * (w / 2 - 0.1), 0, 0);
    slab(B, body, w, h, 0.2, 0, 0, -d / 2 + 0.1);
    slab(B, body, w, 0.9, d, 0, 0, 0);
    slab(B, M.painted('#17191c', 0.8), w - 0.4, h - 1.6, 0.05, 0, 0.9, -d / 2 + 0.22);
    const n = Math.max(1, Math.round(w / 2.5));
    for (let k = 0; k < 5; k++) {
      const y = 0.9 + k * ((h - 1.8) / 5);
      slab(B, M.metal('#c9ced3', 0.3), w - 0.4, 0.05, d - 0.5, 0, y, -0.05);
      stock(B, r, -w / 2 + 0.25, w / 2 - 0.25, y + 0.05, -d / 2 + 0.3, d / 2 - 0.35, k % 2 ? 'bottles' : 'cans', { maxH: (h - 1.8) / 5 - 0.2 });
    }
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (w / n) * (i + 0.5);
      slab(B, M.clearGlass('#cfe6f0'), w / n - 0.1, h - 1.5, 0.08, x, 0.75, d / 2 - 0.08);
      slab(B, M.metal('#b9bfc4', 0.3), 0.1, h - 1.5, 0.14, x + w / n / 2 - 0.08, 0.75, d / 2 - 0.08);
      barZ(B, M.metal('#b9bfc4', 0.3), 0.04, 0.2, x - w / n / 2 + 0.35, h / 2, d / 2 + 0.02, 8);
    }
    slab(B, M.painted('#c0392b', 0.4), w, 0.9, d + 0.1, 0, h - 0.9, 0);
    face(B, labelMat(it.text || 'CHILLED', { color: '#ffffff', bg: '#c0392b', aspect: 7 }), w - 0.4, 0.55, 0, h - 0.45, d / 2 + 0.06);
  },
  freezerchest(B, it, { w, d, h }) {
    slab(B, M.painted('#e9eaea', 0.4), w, h - 0.3, d, 0, 0, 0);
    slab(B, M.painted('#8a8f96', 0.5), w - 0.2, 0.3, d - 0.2, 0, 0, 0);
    const n = Math.max(2, Math.round(w / 2.4));
    const r = rng(seedOf(it) * 113 + 7);
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (w / n) * (i + 0.5);
      slab(B, M.clearGlass('#dde8ee'), w / n - 0.12, 0.08, d - 0.3, x, h - 0.38, 0);
      slab(B, M.metal('#c9ced3', 0.3), w / n - 0.12, 0.12, 0.12, x, h - 0.3, d / 2 - 0.2);
      stock(B, r, x - w / n / 2 + 0.2, x + w / n / 2 - 0.2, h - 1.5, -d / 2 + 0.3, d / 2 - 0.3, 'boxes', { maxH: 0.9 });
    }
    slab(B, M.painted('#2e6f8e', 0.45), w + 0.1, 0.45, d + 0.1, 0, h - 0.45, 0);
  },
  deli(B, it, { w, d, h }) {
    const r = rng(seedOf(it) * 127 + 2);
    slab(B, M.metal('#c9ced3', 0.3), w, h - 1.6, d, 0, 0, 0);
    slab(B, M.painted('#2b2f36', 0.7), w, 0.4, d, 0, 0, 0);
    // The refrigerated well and its sloping glass.
    slab(B, M.stainless(0.25), w - 0.2, 0.1, d - 0.4, 0, h - 1.6, 0);
    slab(B, M.clearGlass('#dfeef2'), w, 1.5, 0.08, 0, h - 1.6, d / 2 - 0.5, [0.38, 0, 0]);
    slab(B, M.clearGlass('#dfeef2'), w, 0.5, 0.06, 0, h - 0.5, -0.1);
    for (const sx of [-1, 1]) slab(B, M.metal('#b9bfc4', 0.3), 0.07, 1.5, d - 0.4, sx * (w / 2 - 0.04), h - 1.6, 0);
    for (let i = 0; i < Math.floor(w / 1.2); i++) {
      const x = -w / 2 + 0.7 + i * 1.2;
      slab(B, M.metal('#dde0e2', 0.3), 1.05, 0.08, d - 0.9, x, h - 1.5, -0.05);
      const col = ['#e8c9a0', '#d9a06a', '#f0e2c0', '#c86a5a', '#efe4cf'][Math.floor(r() * 5)];
      for (let k = 0; k < 3; k++) rbox(B, M.plastic(col, 0.6), 0.75 - k * 0.1, 0.22, d - 1.3, x, h - 1.42 + k * 0.22, -0.05, 0.06);
      slab(B, M.laminate('#f6f5f1', 0.6), 0.5, 0.2, 0.02, x, h - 1.45, d / 2 - 0.42, [0.38, 0, 0]);
    }
    slab(B, M.metal('#dde0e2', 0.3), w, 0.1, 1, 0, h - 0.6, -d / 2 + 0.5);
  },
  produce(B, it, { w, d, h }) {
    const r = rng(seedOf(it) * 131 + 4);
    const frame = M.grain('#8a5a36', 0.6);
    slab(B, M.painted('#3f6b52', 0.5), w, 0.9, d, 0, 0, 0);
    // Two tiers of crates on a sloping bed.
    for (let tier = 0; tier < 2; tier++) {
      const y = 0.9 + tier * 1.3;
      const dd = d - tier * 1.2;
      slab(B, frame, w, 0.12, dd, 0, y, -tier * 0.6, [0.12, 0, 0]);
      const n = Math.max(2, Math.floor(w / 1.6));
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + (w / n) * (i + 0.5);
        const cw = w / n - 0.12;
        for (const sz of [-1, 1]) slab(B, frame, cw, 0.5, 0.06, x, y + 0.12, -tier * 0.6 + sz * (dd / 2 - 0.05));
        for (const sx of [-1, 1]) slab(B, frame, 0.06, 0.5, dd - 0.1, x + sx * (cw / 2 - 0.03), y + 0.12, -tier * 0.6);
        const col = ['#c8241b', '#e36a1c', '#e2b31b', '#5b9a3a', '#7a2f5a', '#d9c86a', '#a33a2a'][Math.floor(r() * 7)];
        const fruit = M.plastic(col, 0.55);
        for (let a = 0; a < 3; a++) for (let b2 = 0; b2 < Math.max(2, Math.floor(dd / 0.55)); b2++) {
          B.add(new THREE.IcosahedronGeometry(0.17, 1), fruit, { pos: [x - cw / 3 + a * (cw / 3.2), y + 0.4 + ((a + b2) % 2) * 0.1, -tier * 0.6 - dd / 2 + 0.35 + b2 * 0.5], rot: [r(), r() * 3, r()] });
        }
      }
    }
    void h;
  },
  basketstack(B, it, { w, d, h }) {
    const m = M.plastic(it.color || '#1f4f9c', 0.5);
    post(B, M.metal('#9aa1a8', 0.3), 0.06, 0.06, h, 0, 0, 0, 8);
    disc(B, M.metal('#9aa1a8', 0.3), 0.6, 0.06, 0, 0, 0, 14);
    for (let i = 0; i < 9; i++) {
      const y = 0.6 + i * 0.28;
      for (const sz of [-1, 1]) slab(B, m, w - 0.2, 0.3, 0.05, 0, y, sz * (d / 2 - 0.12));
      for (const sx of [-1, 1]) slab(B, m, 0.05, 0.3, d - 0.3, sx * (w / 2 - 0.12), y, 0);
      slab(B, m, w - 0.25, 0.05, d - 0.25, 0, y, 0);
      barX(B, m, 0.035, w - 0.5, 0, y + 0.36, 0, 6);
    }
  },
  trolleybay(B, it, { w, d }) {
    const m = M.metal('#c9ced3', 0.3);
    const r = rng(seedOf(it) * 137 + 1);
    for (let i = 0; i < 5; i++) {
      const z = -d / 2 + 0.9 + i * ((d - 1.6) / 5);
      const bw = w - 0.5;
      // Basket: a tapered wire box on a chassis, nested into the one behind.
      for (const sx of [-1, 1]) slab(B, M.meshFence(), 0.05, 1.3, 1.9, sx * (bw / 2 - 0.1), 1.5, z, [0, 0, sx * 0.08]);
      slab(B, M.meshFence(), bw - 0.2, 1.25, 0.05, 0, 1.5, z - 0.95);
      slab(B, M.meshFence(), bw - 0.3, 1.1, 0.05, 0, 1.6, z + 0.95, [0.15, 0, 0]);
      slab(B, M.meshFence(), bw - 0.2, 0.05, 1.85, 0, 1.45, z);
      barX(B, m, 0.05, bw, 0, 2.85, z + 0.9, 8);
      for (const sx of [-1, 1]) {
        B.tube(m, [sx * (bw / 2 - 0.12), 1.4, z + 0.9], [sx * (bw / 2 - 0.2), 0.35, z + 0.75], 0.045, 6);
        B.tube(m, [sx * (bw / 2 - 0.12), 1.4, z - 0.9], [sx * (bw / 2 - 0.2), 0.35, z - 0.7], 0.045, 6);
        for (const sz of [-1, 1]) B.add(cylGeo(0.18, 0.18, 0.08, 10).rotateZ(PI / 2), blackPl(0.6), { pos: [sx * (bw / 2 - 0.2), 0.18, z + sz * 0.72] });
      }
      slab(B, M.plastic(['#c0392b', '#1f4f9c', '#1f7a54'][Math.floor(r() * 3)], 0.5), bw - 0.4, 0.2, 0.1, 0, 2.7, z + 0.88);
    }
  },
  fittingbench(B, it, { w, d, h }) {
    const m = wood(it);
    rbox(B, m, w, 0.14, d, 0, h - 0.14, 0, 0.03);
    for (const sx of [-1, 1]) slab(B, M.metal('#9aa1a8', 0.3), 0.1, h - 0.14, d - 0.2, sx * (w / 2 - 0.4), 0, 0);
  },
  shelfback(B, it, { w, d, h }) {
    const m = lam(it);
    const r = rng(seedOf(it) * 139 + 3);
    cabinet(B, { w, h: 3, d, body: m, front: m, cols: Math.max(2, Math.round(w / 2.4)), kind: 'door', top: M.laminate('#3d434b', 0.35), topT: 0.12 });
    const ys = shelfRun(B, m, w, d - 0.3, h - 3.6, 2, { y0: 3.6, back: M.laminate('#e9e6df', 0.7) });
    for (const y of ys) stock(B, r, -w / 2 + 0.2, w / 2 - 0.2, y, -d / 2 + 0.3, d / 2 - 0.2, r() < 0.5 ? 'boxes' : 'bottles', { maxH: 1 });
  },
};

/** A garment on a hanger, hanging from (x, y, z) with its shoulders along `turn`. */
function hangingGarment(B, r, x, y, z, turn) {
  const col = ['#2f3b4d', '#8a3b3b', '#3f6b52', '#c9c3b5', '#2b2f36', '#6d4a8a', '#b0782f', '#dfe3e8'][Math.floor(r() * 8)];
  const mat = M.cloth(col);
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  // Hook and hanger bar.
  B.add(new THREE.TorusGeometry(0.07, 0.015, 5, 10, PI * 1.5), M.metal('#c9ced3', 0.3), { pos: [x, y + 0.05, z], rot: [0, turn, 0] });
  B.add(cylGeo(0.02, 0.02, 0.95, 5).rotateZ(PI / 2), M.plastic('#55585d', 0.5), { pos: [x, y - 0.3, z], rot: [0, turn, 0] });
  const len = 1.8 + r() * 1.6;
  // The garment: a tapered slab with sleeves.
  const g = new THREE.BoxGeometry(0.95, len, 0.22);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const ty = (p.getY(i) + len / 2) / len;
    p.setX(i, p.getX(i) * (0.55 + ty * 0.5));
    p.setZ(i, p.getZ(i) * (0.7 + (1 - Math.abs(ty - 0.5) * 2) * 0.6));
  }
  g.computeVertexNormals();
  B.add(g, mat, { pos: [x, y - 0.32 - len / 2, z], rot: [0, turn, 0] });
  if (r() < 0.5) for (const sx of [-1, 1]) B.add(cylGeo(0.12, 0.09, 1.1, 6), mat, { pos: [x + c * sx * 0.42, y - 0.75, z - s * sx * 0.42], rot: [0, turn, sx * 0.25] });
}

/* ======================================================================= */
/*                               WAREHOUSE                                  */
/* ======================================================================= */

/** A timber pallet, top face at y ≈ 0.48. */
function palletBase(B, w = 4, d = 3.3, y0 = 0, x = 0, z = 0) {
  const m = M.grain('#b08a5a', 0.85);
  for (let i = 0; i < 3; i++) slab(B, m, w, 0.12, 0.45, x, y0, z - d / 2 + 0.25 + i * ((d - 0.5) / 2));
  for (let i = 0; i < 3; i++) slab(B, m, 0.45, 0.22, d, x - w / 2 + 0.25 + i * ((w - 0.5) / 2), y0 + 0.12, z);
  for (let i = 0; i < 6; i++) slab(B, m, w, 0.12, 0.42, x, y0 + 0.34, z - d / 2 + 0.22 + i * ((d - 0.44) / 5));
  return y0 + 0.46;
}

/** Shrink-wrapped cartons on a pallet. */
function palletLoad(B, r, w, d, h, y0, x = 0, z = 0) {
  const n = Math.max(2, Math.floor(w / 1.3));
  const m = Math.max(2, Math.floor(d / 1.3));
  const rows = Math.max(1, Math.floor(h / 1.1));
  for (let k = 0; k < rows; k++) for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const col = ['#b58a55', '#a67c4a', '#c29a66'][Math.floor(r() * 3)];
    slab(B, M.plastic(col, 0.85), w / n - 0.06, h / rows - 0.05, d / m - 0.06, x - w / 2 + (w / n) * (i + 0.5), y0 + k * (h / rows), z - d / 2 + (d / m) * (j + 0.5));
  }
  slab(B, M.acrylic(), w + 0.06, h, d + 0.06, x, y0, z);
}

const WAREHOUSE = [
  ['warehouse', 'rackpallet', 'Pallet racking', '🏗️', 9, 4, 16, { len: true, colors: [['#1f4f9c', 'Blue'], ['#e36a1c', 'Orange'], ['#c0392b', 'Red'], ['#3d434b', 'Grey']] }],
  ['warehouse', 'rackcantilever', 'Cantilever racking', '🪵', 9, 4, 12, { len: true }],
  ['warehouse', 'shelfbin', 'Small parts shelving', '🔩', 6, 1.8, 7, { len: true }],
  ['warehouse', 'palletload', 'Wrapped pallet', '📦', 4, 3.3, 4.5, {}],
  ['warehouse', 'palletempty', 'Pallet stack', '🪵', 4, 3.3, 3.4, {}],
  ['warehouse', 'crate', 'Timber crate', '🪵', 3.6, 3, 3, {}],
  ['warehouse', 'drums', 'Drum set', '🛢️', 4, 2.2, 3, { colors: [['#1f4f9c', 'Blue'], ['#2b2f36', 'Black'], ['#c0392b', 'Red'], ['#4a7d42', 'Green']] }],
  ['warehouse', 'ibc', 'IBC tote', '🧴', 4, 3.4, 4.2, {}],
  ['warehouse', 'conveyor', 'Roller conveyor', '🎢', 10, 2.4, 2.6, { len: true, surface: 2.6 }],
  ['warehouse', 'packbench', 'Packing station', '📮', 6, 3, 6.4, { len: true, surface: 3 }],
  ['warehouse', 'cagetrolley', 'Roll cage', '🛒', 2.8, 3.4, 5.6, {}],
  ['warehouse', 'palletjack', 'Pallet truck', '🛻', 2.4, 5.4, 4, { colors: [['#e2b31b', 'Yellow'], ['#c0392b', 'Red'], ['#1f4f9c', 'Blue']] }],
  ['warehouse', 'forkliftin', 'Forklift', '🚜', 4.2, 9, 7.2, { colors: [['#e2b31b', 'Yellow'], ['#c0392b', 'Red'], ['#1f7a54', 'Green'], ['#e36a1c', 'Orange']] }],
  ['warehouse', 'guardrail', 'Safety barrier', '🚧', 8, 0.6, 3.6, { len: true }],
  ['warehouse', 'stacker', 'Box stack', '📦', 3.4, 3, 5, {}],
];

const WAREHOUSE_B = {
  rackpallet(B, it, { w, d, h }) {
    const up = M.painted(it.color || '#1f4f9c', 0.45);
    const beam = M.painted('#e36a1c', 0.45);
    const r = rng(seedOf(it) * 149 + 3);
    const bays = Math.max(1, Math.round(w / 9));
    for (let i = 0; i <= bays; i++) {
      const x = -w / 2 + (w / bays) * i;
      for (const sz of [-1, 1]) {
        slab(B, up, 0.3, h, 0.25, x, 0, sz * (d / 2 - 0.2));
        slab(B, M.painted('#e2b31b', 0.5), 0.45, 0.6, 0.4, x, 0, sz * (d / 2 - 0.2));
      }
      // Lacing between the two uprights.
      for (let k = 0; k < Math.floor(h / 1.6); k++) {
        const y = 0.5 + k * 1.6;
        B.tube(up, [x, y, -d / 2 + 0.2], [x, y + 0.8, d / 2 - 0.2], 0.07, 5);
        B.tube(up, [x, y + 0.8, -d / 2 + 0.2], [x, y + 1.6, d / 2 - 0.2], 0.07, 5);
      }
    }
    const levels = Math.max(2, Math.floor((h - 1.5) / 4.5));
    for (let L = 1; L <= levels; L++) {
      const y = L * ((h - 0.6) / (levels + 0.15));
      for (const sz of [-1, 1]) {
        slab(B, beam, w, 0.42, 0.22, 0, y, sz * (d / 2 - 0.2));
        slab(B, beam, w, 0.12, 0.42, 0, y + 0.3, sz * (d / 2 - 0.3));
      }
      for (let i = 0; i < bays; i++) for (let k = 0; k < 2; k++) {
        if (r() < 0.22) continue;
        const px = -w / 2 + (w / bays) * (i + 0.28 + k * 0.44);
        const pw = Math.min(4, w / bays / 2 - 0.4);
        const top = palletBase(B, pw, d - 0.6, y + 0.42, px);
        palletLoad(B, r, pw - 0.3, d - 1, Math.min(2.5 + r() * 1.2, (h - 0.6) / (levels + 0.15) - 1.2), top, px);
      }
    }
    // Ground level: pallets on the floor.
    for (let i = 0; i < bays * 2; i++) if (r() < 0.75) {
      const px = -w / 2 + (w / (bays * 2)) * (i + 0.5);
      const pw = Math.min(4, w / bays / 2 - 0.4);
      const top = palletBase(B, pw, d - 0.6, 0, px);
      palletLoad(B, r, pw - 0.3, d - 1, 2.2 + r(), top, px);
    }
  },
  rackcantilever(B, it, { w, d, h }) {
    const m = M.painted('#3d434b', 0.45);
    const r = rng(seedOf(it) * 151 + 5);
    const n = Math.max(2, Math.round(w / 5));
    for (let i = 0; i <= n; i++) {
      const x = -w / 2 + (w / n) * i;
      slab(B, m, 0.35, h, 0.35, x, 0, 0);
      rbox(B, m, 0.6, 0.3, d, x, 0, 0, 0.04);
      for (let k = 1; k <= 3; k++) {
        const y = k * (h / 3.6);
        for (const sz of [-1, 1]) {
          slab(B, M.painted('#e36a1c', 0.45), 0.3, 0.3, d / 2 - 0.2, x, y, sz * (d / 4 + 0.1));
          post(B, M.painted('#e36a1c', 0.45), 0.08, 0.08, 0.7, x, y + 0.3, sz * (d / 2 - 0.25), 8);
        }
      }
    }
    for (let k = 0; k < 3; k++) {
      const y = (k + 1) * (h / 3.6) + 0.3;
      for (const sz of [-1, 1]) {
        const cnt = 2 + Math.floor(r() * 3);
        for (let j = 0; j < cnt; j++) {
          const kind = r();
          if (kind < 0.5) slab(B, M.grain('#b08a5a', 0.8), w - 1, 0.3, 0.75, 0, y + j * 0.32, sz * (d / 4 + 0.1));
          else B.add(cylGeo(0.3, 0.3, w - 1, 10).rotateZ(PI / 2), M.metal('#9aa1a8', 0.5), { pos: [0, y + 0.3 + j * 0.62, sz * (d / 4 + 0.1) + (j % 2) * 0.3] });
        }
      }
    }
  },
  shelfbin(B, it, { w, d, h }) {
    const m = M.painted('#8a8f96', 0.5);
    const r = rng(seedOf(it) * 157 + 7);
    for (const sx of [-1, 1]) {
      slab(B, m, 0.1, h, d, sx * (w / 2 - 0.05), 0, 0);
      for (let k = 0; k < 20; k++) slab(B, M.painted('#6f757c', 0.6), 0.04, 0.06, d - 0.1, sx * (w / 2 - 0.05), 0.5 + k * ((h - 0.8) / 20), 0);
    }
    const shelves = 6;
    for (let k = 0; k < shelves; k++) {
      const y = 0.4 + k * ((h - 0.7) / shelves);
      slab(B, m, w - 0.1, 0.06, d, 0, y, 0);
      const n = Math.floor(w / 0.85);
      for (let i = 0; i < n; i++) if (r() < 0.88) {
        const x = -w / 2 + (w / n) * (i + 0.5);
        const col = ['#e36a1c', '#1f4f9c', '#e2b31b', '#c0392b', '#3f6b52'][Math.floor(r() * 5)];
        const bm = M.plastic(col, 0.55);
        // A louvred bin: a box with a sloping open front.
        slab(B, bm, w / n - 0.08, 0.55, 0.06, x, y + 0.06, -d / 2 + 0.05);
        for (const sx of [-1, 1]) slab(B, bm, 0.05, 0.5, d - 0.1, x + sx * (w / n / 2 - 0.07), y + 0.06, 0);
        slab(B, bm, w / n - 0.08, 0.06, d - 0.1, x, y + 0.06, 0);
        slab(B, bm, w / n - 0.08, 0.3, 0.06, x, y + 0.06, d / 2 - 0.08);
        slab(B, M.laminate('#f6f5f1', 0.7), w / n - 0.3, 0.14, 0.01, x, y + 0.14, d / 2 - 0.04);
      }
    }
  },
  palletload(B, it, { w, d, h }) {
    const r = rng(seedOf(it) * 163 + 1);
    const top = palletBase(B, w, d);
    palletLoad(B, r, w - 0.25, d - 0.25, h - top, top);
  },
  palletempty(B, it, { w, d, h }) {
    for (let i = 0; i < Math.max(2, Math.round(h / 0.6)); i++) palletBase(B, w, d, i * 0.58);
  },
  crate(B, it, { w, d, h }) {
    const m = M.grain('#a8834f', 0.85);
    const r = rng(seedOf(it) * 167 + 3);
    const y0 = palletBase(B, w, d) - 0.46;
    for (const sz of [-1, 1]) {
      slab(B, m, w, h - 0.5, 0.1, 0, 0.5, sz * (d / 2 - 0.05));
      for (let k = 0; k < 3; k++) slab(B, m, w, 0.22, 0.16, 0, 0.6 + k * ((h - 0.9) / 2.2), sz * (d / 2 - 0.05));
    }
    for (const sx of [-1, 1]) {
      slab(B, m, 0.1, h - 0.5, d - 0.2, sx * (w / 2 - 0.05), 0.5, 0);
      slab(B, m, 0.16, h - 0.6, 0.2, sx * (w / 2 - 0.05), 0.55, 0);
    }
    slab(B, m, w, 0.12, d, 0, h - 0.12, 0);
    face(B, labelMat('FRAGILE', { color: '#2b2f36', bg: '#f1ece2', aspect: 3.2 }), 1.2, 0.4, -w / 4, h * 0.6, d / 2 + 0.02);
    void [r, y0];
  },
  drums(B, it, { w, d, h }) {
    const m = M.painted(it.color || '#1f4f9c', 0.45);
    const r = rng(seedOf(it) * 173 + 5);
    for (let i = 0; i < 3; i++) {
      const x = -w / 2 + 0.8 + (i % 3) * 1.25;
      const z = (i % 2) * 0.5 - 0.25;
      lathe(B, m, [[0.01, 0], [0.7, 0.03], [0.73, 0.12], [0.7, 0.3], [0.76, 0.55], [0.7, 0.8], [0.7, h - 0.8], [0.76, h - 0.55], [0.7, h - 0.3], [0.73, h - 0.12], [0.7, h - 0.03], [0.01, h]], x, 0, z, 18);
      disc(B, M.metal('#9aa1a8', 0.4), 0.2, 0.05, x + 0.3, h, z, 10);
      if (r() < 0.6) face(B, labelMat(['OIL', 'FUEL', 'COOLANT'][Math.floor(r() * 3)], { color: '#f1f2f0', bg: '#2b2f36', aspect: 2.4 }), 0.7, 0.3, x, h * 0.6, z + 0.72);
    }
  },
  ibc(B, it, { w, d, h }) {
    const cage = M.metal('#b9bfc4', 0.4);
    const y0 = palletBase(B, w, d);
    const ch = h - y0 - 0.2;
    slab(B, M.acrylic(), w - 0.4, ch, d - 0.4, 0, y0, 0);
    slab(B, M.plastic('#dfe6e2', 0.4), w - 0.5, ch - 0.3, d - 0.5, 0, y0 + 0.15, 0);
    for (let i = 0; i <= 6; i++) {
      const y = y0 + (ch / 6) * i;
      for (const sz of [-1, 1]) slab(B, cage, w - 0.3, 0.07, 0.07, 0, y, sz * (d / 2 - 0.18));
      for (const sx of [-1, 1]) slab(B, cage, 0.07, 0.07, d - 0.3, sx * (w / 2 - 0.18), y, 0);
    }
    for (let i = 0; i < 5; i++) {
      const x = -w / 2 + 0.2 + (i * (w - 0.4)) / 4;
      for (const sz of [-1, 1]) slab(B, cage, 0.07, ch, 0.07, x, y0, sz * (d / 2 - 0.18));
    }
    lathe(B, M.plastic('#2b2f36', 0.5), [[0.3, 0], [0.34, 0.1], [0.3, 0.2], [0.26, 0.26]], 0, h - 0.2, 0, 14);
    slab(B, M.plastic('#55585d', 0.5), 0.5, 0.5, 0.4, 0, y0 + 0.05, d / 2 - 0.1);
  },
  conveyor(B, it, { w, d, h }) {
    const m = M.painted('#3d434b', 0.45);
    for (const sz of [-1, 1]) {
      slab(B, m, w, 0.6, 0.14, 0, h - 0.6, sz * (d / 2 - 0.1));
      for (let i = 0; i <= Math.floor(w / 4); i++) {
        const x = -w / 2 + 0.5 + i * ((w - 1) / Math.max(1, Math.floor(w / 4)));
        slab(B, m, 0.16, h - 0.6, 0.16, x, 0, sz * (d / 2 - 0.1));
        if (sz > 0) slab(B, m, 0.12, 0.12, d - 0.4, x, 0.4, 0);
      }
    }
    const rollers = Math.floor(w / 0.42);
    for (let i = 0; i < rollers; i++) {
      B.add(cylGeo(0.14, 0.14, d - 0.35, 10).rotateZ(PI / 2), M.metal('#aeb4ba', 0.35), { pos: [-w / 2 + 0.25 + i * ((w - 0.5) / (rollers - 1)), h - 0.14, 0] });
    }
    const r = rng(seedOf(it) * 179 + 2);
    for (let i = 0; i < 3; i++) if (r() < 0.75) {
      const bw = 1.1 + r() * 0.8;
      slab(B, M.plastic('#b58a55', 0.85), bw, bw * 0.7, Math.min(d - 0.6, 1.2 + r() * 0.5), -w / 2 + 1.5 + i * (w / 3.2), h, (r() - 0.5) * 0.4);
      slab(B, M.plastic('#d9c9a8', 0.6), 0.16, 0.012, Math.min(d - 0.6, 1.2), -w / 2 + 1.5 + i * (w / 3.2), h + bw * 0.7, (r() - 0.5) * 0.4);
    }
  },
  packbench(B, it, { w, d, h }) {
    const m = M.painted('#6f757c', 0.5);
    const r = rng(seedOf(it) * 181 + 4);
    rbox(B, M.grain('#c9b89a', 0.7), w, 0.14, d, 0, 2.86, 0, 0.02);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) slab(B, m, 0.14, 2.86, 0.14, sx * (w / 2 - 0.3), 0, sz * (d / 2 - 0.3));
    slab(B, m, w - 0.5, 0.1, d - 0.5, 0, 0.6, 0);
    // Upright frame with a shelf, a light and a carton rack above.
    for (const sx of [-1, 1]) slab(B, m, 0.12, h - 3, 0.12, sx * (w / 2 - 0.3), 3, -d / 2 + 0.3);
    slab(B, m, w - 0.5, 0.1, 1, 0, 4.9, -d / 2 + 0.6);
    slab(B, M.glow('#f4f7fa', 1.1), w - 1, 0.1, 0.35, 0, h - 0.5, -d / 2 + 0.9);
    for (let i = 0; i < 4; i++) slab(B, M.plastic(['#e36a1c', '#1f4f9c', '#e2b31b', '#3f6b52'][i], 0.55), 0.85, 0.5, 0.8, -w / 2 + 0.9 + i * 1.1, 5, -d / 2 + 0.6);
    // Kit on the bench: a carton, tape gun, scanner, scales and a screen.
    slab(B, M.plastic('#b58a55', 0.85), 1.5, 1.1, 1.2, -w / 2 + 1.4, 3, 0.1);
    rbox(B, blackPl(0.4), 0.5, 0.35, 0.8, -w / 2 + 2.7, 3, -0.3, 0.08);
    slab(B, M.metal('#b9bfc4', 0.25), 1.2, 0.08, 1, w / 2 - 1.2, 3, 0.2);
    monitor(B, w / 2 - 1.4, 3, -d / 2 + 0.7, { w: 1.5, kind: 'sheet', seed: seedOf(it) });
    for (let i = 0; i < 2; i++) B.add(cylGeo(0.3, 0.3, 0.3, 14).rotateZ(PI / 2), M.plastic('#c9a86a', 0.6), { pos: [w / 2 - 2.4, 3.25, -0.4 + i * 0.5] });
    void r;
  },
  cagetrolley(B, it, { w, d, h }) {
    const m = M.meshFence();
    const f = M.metal('#9aa1a8', 0.4);
    const r = rng(seedOf(it) * 191 + 3);
    slab(B, M.painted('#55585d', 0.5), w, 0.14, d, 0, 0.35, 0);
    for (const sx of [-1, 1]) {
      slab(B, m, 0.05, h - 0.5, d - 0.2, sx * (w / 2 - 0.05), 0.5, 0);
      slab(B, f, 0.1, h - 0.5, 0.1, sx * (w / 2 - 0.05), 0.5, -d / 2 + 0.08);
      slab(B, f, 0.1, h - 0.5, 0.1, sx * (w / 2 - 0.05), 0.5, d / 2 - 0.08);
    }
    slab(B, m, w - 0.2, h - 0.5, 0.05, 0, 0.5, -d / 2 + 0.05);
    slab(B, f, w, 0.1, 0.1, 0, h - 0.1, -d / 2 + 0.08);
    for (let k = 0; k < 2; k++) slab(B, m, w - 0.2, 0.06, d - 0.3, 0, 0.5 + k * 2.2, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add(cylGeo(0.17, 0.17, 0.1, 10).rotateZ(PI / 2), blackPl(0.6), { pos: [sx * (w / 2 - 0.25), 0.17, sz * (d / 2 - 0.3)] });
    for (let i = 0; i < 5; i++) if (r() < 0.8) slab(B, M.plastic(['#b58a55', '#c29a66'][i % 2], 0.85), w - 0.5, 0.75, d - 0.6, 0, (i < 3 ? 0.5 : 2.76) + (i % 3) * 0.78, 0);
  },
  palletjack(B, it, { w, d, h }) {
    const m = M.painted(it.color || '#e2b31b', 0.45);
    const dark = M.painted('#2b2f36', 0.5);
    for (const sx of [-1, 1]) {
      slab(B, m, 0.6, 0.35, d - 1.2, sx * (w / 2 - 0.4), 0.15, 0.2);
      B.add(cylGeo(0.17, 0.17, 0.26, 10).rotateZ(PI / 2), blackPl(0.7), { pos: [sx * (w / 2 - 0.4), 0.17, d / 2 - 0.7] });
    }
    slab(B, m, w, 0.5, 1, 0, 0.1, -d / 2 + 0.5);
    for (const sx of [-1, 1]) B.add(cylGeo(0.3, 0.3, 0.3, 12).rotateZ(PI / 2), blackPl(0.7), { pos: [sx * 0.55, 0.3, -d / 2 + 0.45] });
    B.tube(dark, [0, 0.6, -d / 2 + 0.5], [0, h - 0.4, -d / 2 - 0.3], 0.1, 8);
    barX(B, dark, 0.07, 1.5, 0, h - 0.4, -d / 2 - 0.32, 8);
    slab(B, m, 0.6, 0.5, 0.35, 0, 0.6, -d / 2 + 0.3);
  },
  forkliftin(B, it, { w, d, h }) {
    const body = M.painted(it.color || '#e2b31b', 0.4);
    const dark = M.painted('#2b2f36', 0.5);
    const mast = M.metal('#8a8f96', 0.4);
    // Counterweight body and bonnet.
    rbox(B, body, w, 2.4, d * 0.46, 0, 0.5, -d * 0.22, 0.12);
    rbox(B, body, w - 0.4, 1.1, d * 0.3, 0, 2.9, -d * 0.28, 0.1);
    // Wheels: big drive wheels forward, small steers behind.
    for (const sx of [-1, 1]) {
      B.add(cylGeo(1.05, 1.05, 0.65, 16).rotateZ(PI / 2), M.tyre(), { pos: [sx * (w / 2 - 0.2), 1.05, d * 0.12] });
      B.add(cylGeo(0.5, 0.5, 0.66, 12).rotateZ(PI / 2), M.metal('#d9d9d6', 0.4), { pos: [sx * (w / 2 - 0.2), 1.05, d * 0.12] });
      B.add(cylGeo(0.72, 0.72, 0.5, 14).rotateZ(PI / 2), M.tyre(), { pos: [sx * (w / 2 - 0.55), 0.72, -d * 0.36] });
    }
    // Operator station: seat, wheel, overhead guard.
    cushion(B, M.leather('#2a2a2c', 0.55), 1.5, 0.35, 1.4, 0, 2.9, -d * 0.12, { puff: 0.1 });
    cushion(B, M.leather('#2a2a2c', 0.55), 1.5, 1.5, 0.3, 0, 3.25, -d * 0.12 - 0.6, { rot: [0.18, 0, 0], puff: 0.06 });
    post(B, dark, 0.06, 0.06, 0.8, 0, 3.4, d * 0.02, 8);
    B.add(new THREE.TorusGeometry(0.42, 0.06, 6, 16), dark, { pos: [0, 4.2, d * 0.02], rot: [1.1, 0, 0] });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) slab(B, mast, 0.16, h - 1.2, 0.16, sx * (w / 2 - 0.3), 1.2, -d * 0.1 + sz * 1.5);
    slab(B, mast, w, 0.14, 3.4, 0, h - 0.14, -d * 0.1);
    for (let i = 0; i < 5; i++) slab(B, mast, w, 0.1, 0.12, 0, h - 0.1, -d * 0.1 - 1.6 + i * 0.8);
    // Mast and forks at the front.
    for (const sx of [-1, 1]) {
      slab(B, mast, 0.3, h - 0.6, 0.5, sx * 1, 0.3, d / 2 - 0.6);
      slab(B, M.painted('#55585d', 0.45), 0.22, h - 2.2, 0.36, sx * 0.7, 0.4, d / 2 - 0.55);
    }
    slab(B, mast, 2.6, 0.5, 0.4, 0, 0.5, d / 2 - 0.45);
    for (const sx of [-1, 1]) {
      slab(B, M.metal('#6f757c', 0.5), 0.4, 0.14, 2.6, sx * 0.85, 0.12, d / 2 + 0.75);
      slab(B, M.metal('#6f757c', 0.5), 0.4, 1.1, 0.16, sx * 0.85, 0.12, d / 2 - 0.3);
    }
    slab(B, M.glow('#e8a53a', 1.2), 0.5, 0.25, 0.5, 0, h, -d * 0.1);
  },
  guardrail(B, it, { w, d, h }) {
    const m = M.painted('#e2b31b', 0.45);
    const n = Math.max(2, Math.round(w / 6) + 1);
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (w / (n - 1)) * i;
      slab(B, m, 0.4, h, d, x, 0, 0);
      slab(B, M.painted('#2b2f36', 0.5), 0.7, 0.14, d + 0.3, x, 0, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.add(cylGeo(0.07, 0.07, 0.1, 8), M.metal('#9aa1a8', 0.3), { pos: [x + sx * 0.22, 0.1, sz * (d / 2 + 0.07)] });
    }
    for (const y of [h * 0.35, h * 0.82]) slab(B, m, w, 0.42, d * 0.6, 0, y - 0.21, 0);
  },
  stacker(B, it, { w, d, h }) {
    const r = rng(seedOf(it) * 193 + 6);
    let y = 0;
    while (y < h - 0.5) {
      const bh = 0.7 + r() * 0.6;
      const bw = w * (0.7 + r() * 0.3);
      const bd = d * (0.7 + r() * 0.3);
      slab(B, M.plastic(['#b58a55', '#a67c4a', '#c29a66'][Math.floor(r() * 3)], 0.85), bw, bh, bd, (r() - 0.5) * (w - bw), y, (r() - 0.5) * (d - bd), [0, (r() - 0.5) * 0.25, 0]);
      y += bh;
    }
  },
};

/* ======================================================================= */
/*                          RESTAURANT & DINING                             */
/* ======================================================================= */

/** A place setting: plate, cutlery, glass. */
function setting(B, r, x, y, z, turn = 0) {
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  disc(B, M.porcelain('#f8f7f3'), 0.52, 0.05, x, y, z, 20);
  lathe(B, M.porcelain('#f8f7f3'), [[0.3, 0], [0.52, 0.06], [0.5, 0.07], [0.28, 0.02]], x, y + 0.04, z, 18);
  for (const k of [-1, 1]) slab(B, M.metal('#dfe3e6', 0.2), 0.08, 0.02, 0.6, x + c * k * 0.72, y, z - s * k * 0.72, [0, turn, 0]);
  lathe(B, M.clearGlass('#e6f0f2'), [[0.14, 0], [0.16, 0.05], [0.07, 0.2], [0.06, 0.45], [0.2, 0.55], [0.22, 0.9], [0.2, 0.92]], x + c * 0.6 - s * 0.55, y, z - s * 0.6 - c * 0.55, 14);
  if (r() < 0.5) slab(B, M.cloth(['#8a3b3b', '#2f3b4d', '#c9c3b5'][Math.floor(r() * 3)]), 0.42, 0.04, 0.55, x - c * 0.78, y, z + s * 0.78, [0, turn, 0]);
}

const DINING = [
  ['dining', 'table2', 'Table for two', '🍽️', 2.6, 2.6, 2.5, { colors: WOODS, surface: TABLE_H }],
  ['dining', 'table4', 'Table for four', '🍽️', 3.6, 3.6, 2.5, { colors: WOODS, surface: TABLE_H }],
  ['dining', 'tablelong', 'Long dining table', '🍴', 8, 3.4, 2.5, { colors: WOODS, surface: TABLE_H, len: true }],
  ['dining', 'tablebistro', 'Bistro table', '☕', 2.4, 2.4, 2.5, { colors: METALS, surface: TABLE_H }],
  ['dining', 'tablehigh', 'Poseur table', '🍸', 2.6, 2.6, 3.6, { colors: WOODS, surface: BAR_H }],
  ['dining', 'chairdining', 'Dining chair', '🪑', 1.8, 1.9, 3, { colors: WOODS, colors2: FABRICS, label2: 'Seat pad' }],
  ['dining', 'chairtub', 'Tub chair', '🛋️', 2.4, 2.4, 2.6, { colors: FABRICS }],
  ['dining', 'barstool', 'Bar stool', '🪑', 1.5, 1.5, 3.4, { colors: LEATHERS }],
  ['dining', 'booth', 'Booth', '🍔', 6, 6.4, 4.4, { colors: LEATHERS, len: true }],
  ['dining', 'banquette', 'Banquette seating', '🛋️', 8, 2.6, 4, { colors: LEATHERS, len: true }],
  ['dining', 'bar', 'Bar counter', '🍺', 10, 3.4, 3.7, { colors: WOODS, len: true }],
  ['dining', 'backbar', 'Back bar', '🥃', 8, 1.6, 8, { colors: WOODS, len: true }],
  ['dining', 'hoststand', 'Host stand', '📖', 2.4, 1.6, 3.8, { colors: WOODS }],
  ['dining', 'buffet', 'Hot buffet counter', '🍲', 8, 3, 4.6, { len: true }],
  ['dining', 'dessertcase', 'Cake display', '🍰', 4, 2.4, 4.6, {}],
  ['dining', 'espresso', 'Espresso machine', '☕', 2.6, 1.8, 2.2, { top: true }],
  ['dining', 'waiterstation', 'Waiter station', '🧾', 3, 1.6, 3.2, { colors: WOODS }],
  ['dining', 'highchair', 'High chair', '👶', 1.4, 1.5, 3.2, {}],
];

const DINING_B = {
  table2: (B, it, dim) => diningTable(B, it, dim, 2),
  table4: (B, it, dim) => diningTable(B, it, dim, 4),
  tablelong: (B, it, dim) => diningTable(B, it, dim, 6),
  tablebistro(B, it, { w }) {
    const r = rng(seedOf(it) * 197 + 3);
    const m = M.metal(it.color || '#2b2f36', 0.4);
    disc(B, M.grain('#8a5a36', 0.4), w / 2, 0.12, 0, TABLE_H - 0.12, 0, 26);
    disc(B, m, w / 2 + 0.02, 0.05, 0, TABLE_H - 0.17, 0, 26);
    post(B, m, 0.17, 0.2, TABLE_H - 0.17, 0, 0.1, 0, 12);
    lathe(B, m, [[0.95, 0], [0.9, 0.06], [0.24, 0.1], [0.2, 0.16]], 0, 0, 0, 20);
    setting(B, r, 0, TABLE_H, 0.5, PI);
    setting(B, r, 0, TABLE_H, -0.5, 0);
  },
  tablehigh(B, it, { w }) {
    const m = M.metal('#3d434b', 0.4);
    disc(B, M.grain(it.color || '#5b3a26', 0.4), w / 2, 0.14, 0, BAR_H - 0.14, 0, 26);
    post(B, m, 0.2, 0.22, BAR_H - 0.14, 0, 0.12, 0, 12);
    lathe(B, m, [[1.05, 0], [1, 0.07], [0.26, 0.12], [0.22, 0.18]], 0, 0, 0, 20);
    B.add(new THREE.TorusGeometry(w / 2 - 0.25, 0.05, 6, 20), m, { pos: [0, 1, 0], rot: [PI / 2, 0, 0] });
  },
  chairdining(B, it) {
    const m = wood(it, 1);
    const seat = 1.5;
    legs(B, m, 1.5, 1.55, seat, { inset: 0.16, t: 0.13, taper: 0.8 });
    rbox(B, m, 1.6, 0.14, 1.6, 0, seat, 0, 0.03);
    cushion(B, M.cloth(it.color2 || FABRICS[0][0]), 1.44, 0.16, 1.44, 0, seat + 0.14, 0, { puff: 0.14 });
    for (const sx of [-1, 1]) B.add(cylGeo(0.075, 0.09, 1.5, 8), m, { pos: [sx * 0.68, seat + 0.75, -0.7], rot: [-0.07, 0, 0] });
    rbox(B, m, 1.5, 0.45, 0.14, 0, seat + 1.05, -0.78, 0.04, [-0.07, 0, 0]);
    rbox(B, m, 1.5, 0.3, 0.12, 0, seat + 0.5, -0.74, 0.04, [-0.07, 0, 0]);
  },
  chairtub(B, it, { w, d, h }) {
    const fab = M.cloth(it.color || FABRICS[1][0]);
    const seat = 1.25;
    // A wrap-around back built from an arc of blocks.
    for (let i = 0; i <= 16; i++) {
      const a = -PI * 0.62 + (i / 16) * PI * 1.24;
      const rr = w / 2 - 0.22;
      B.add(new THREE.BoxGeometry(0.33, h - seat - 0.1, 0.42), fab, { pos: [Math.sin(a) * rr, seat + (h - seat - 0.1) / 2, -Math.cos(a) * rr], rot: [0, a, 0] });
    }
    slab(B, fab, w - 0.3, seat, d - 0.3, 0, 0, 0);
    cushion(B, fab, w - 0.55, 0.35, d - 0.6, 0, seat - 0.12, 0.12, { puff: 0.18 });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) post(B, M.grain('#5b3a26', 0.4), 0.08, 0.06, 0.3, sx * (w / 2 - 0.5), 0, sz * (d / 2 - 0.5), 8);
  },
  barstool(B, it, { h }) {
    const m = M.metal('#2b2f36', 0.4);
    const lea = M.leather(it.color || LEATHERS[1][0]);
    legs(B, m, 1.3, 1.3, h - 0.3, { round: true, t: 0.1, splay: 0.06 });
    for (const y of [0.75, h - 0.9]) B.add(new THREE.TorusGeometry(0.62 + (y < 1 ? 0.07 : 0), 0.045, 5, 18), m, { pos: [0, y, 0], rot: [PI / 2, 0, 0] });
    cushion(B, lea, 1.5, 0.3, 1.5, 0, h - 0.3, 0, { puff: 0.2, r: 0.22 });
    for (const sx of [-1, 1]) B.add(cylGeo(0.06, 0.06, 1.1, 8), m, { pos: [sx * 0.55, h + 0.5, -0.62], rot: [-0.12, 0, 0] });
    cushion(B, lea, 1.3, 0.75, 0.25, 0, h + 0.5, -0.68, { rot: [0.12, 0, 0], puff: 0.1 });
  },
  booth(B, it, { w, d, h }) {
    const lea = M.leather(it.color || LEATHERS[5][0]);
    const r = rng(seedOf(it) * 199 + 1);
    for (const sz of [-1, 1]) {
      const z = sz * (d / 2 - 1.1);
      slab(B, lea, w, 1.3, 2.1, 0, 0, z);
      cushion(B, lea, w - 0.2, 0.3, 1.9, 0, 1.3, z, { puff: 0.14 });
      // Buttoned back, tilted.
      cushion(B, lea, w, h - 1.6, 0.42, 0, 1.6, z - sz * 1.05, { rot: [sz * 0.1, 0, 0], puff: 0.05 });
      slab(B, M.grain('#5b3a26', 0.45), w + 0.1, 0.16, 0.5, 0, h, z - sz * 1.05);
      for (let i = 0; i < Math.floor(w / 1.4); i++) for (let k = 0; k < 2; k++) {
        B.add(new THREE.SphereGeometry(0.07, 8, 6), M.leather(shadeHex(it.color || LEATHERS[5][0], 0.8)), { pos: [-w / 2 + 0.8 + i * 1.4, 2.3 + k * 0.9, z - sz * 0.84] });
      }
    }
    // The table between them.
    rbox(B, M.grain('#8a5a36', 0.4), w - 1.2, 0.14, d - 4.6, 0, TABLE_H - 0.14, 0, 0.03);
    post(B, M.metal('#3d434b', 0.4), 0.17, 0.2, TABLE_H - 0.14, 0, 0, 0, 12);
    disc(B, M.metal('#3d434b', 0.4), 0.8, 0.07, 0, 0, 0, 18);
    setting(B, r, -w * 0.18, TABLE_H, 0, PI / 2);
    setting(B, r, w * 0.18, TABLE_H, 0, -PI / 2);
    disc(B, M.clearGlass('#e8e2d0'), 0.22, 0.35, 0, TABLE_H, 0, 10);
    disc(B, M.glow('#ffb45c', 1.6), 0.14, 0.05, 0, TABLE_H + 0.3, 0, 8);
  },
  banquette(B, it, { w, d, h }) {
    const lea = M.leather(it.color || LEATHERS[1][0]);
    slab(B, lea, w, 1.3, d - 0.5, 0, 0, 0.25);
    cushion(B, lea, w - 0.15, 0.3, d - 0.7, 0, 1.3, 0.25, { puff: 0.14 });
    cushion(B, lea, w, h - 1.6, 0.45, 0, 1.6, -d / 2 + 0.3, { puff: 0.05 });
    for (let i = 0; i < Math.floor(w / 1.3); i++) for (let k = 0; k < 2; k++) {
      B.add(new THREE.SphereGeometry(0.07, 8, 6), M.leather(shadeHex(it.color || LEATHERS[1][0], 0.8)), { pos: [-w / 2 + 0.75 + i * 1.3, 2.3 + k * 0.85, -d / 2 + 0.52] });
    }
    slab(B, M.grain('#5b3a26', 0.45), w + 0.1, 0.16, 0.55, 0, h, -d / 2 + 0.3);
  },
  bar(B, it, { w, d, h }) {
    const front = M.grain(it.color || '#5b3a26', 0.5);
    const r = rng(seedOf(it) * 211 + 5);
    slab(B, front, w, h - 0.2, d - 1, 0, 0, -0.5);
    for (let i = 0; i < Math.floor(w / 1.6); i++) slab(B, M.grain(shadeHex(it.color || '#5b3a26', 0.85), 0.5), 0.14, h - 0.6, 0.1, -w / 2 + 0.8 + i * 1.6, 0.2, d / 2 - 0.95);
    rbox(B, M.grain('#3b2a1c', 0.25), w + 0.3, 0.22, d, 0, h - 0.22, 0, 0.06);
    slab(B, M.metal('#b9bfc4', 0.3), w, 0.06, 0.4, 0, h - 0.3, d / 2 - 0.1);
    // Foot rail, drip tray, taps and a glass shelf under the counter.
    for (let i = 0; i <= Math.floor(w / 5); i++) slab(B, M.metal('#c9a86a', 0.3), 0.14, 0.5, 0.14, -w / 2 + 0.3 + i * (w / Math.max(1, Math.floor(w / 5))), 0, d / 2 - 0.45);
    B.add(cylGeo(0.09, 0.09, w - 0.4, 10).rotateZ(PI / 2), M.metal('#c9a86a', 0.25), { pos: [0, 0.6, d / 2 - 0.45] });
    slab(B, M.stainless(0.25), 2.6, 0.06, 0.9, -w / 2 + 2, h, -0.4);
    for (let i = 0; i < 4; i++) {
      const x = -w / 2 + 1.2 + i * 0.45;
      post(B, M.chrome(), 0.07, 0.07, 0.75, x, h, -0.75, 10);
      B.tube(M.chrome(), [x, h + 0.75, -0.75], [x, h + 0.62, -0.5], 0.06, 6);
      B.add(cylGeo(0.055, 0.055, 0.4, 8), M.plastic(['#1f7a54', '#c0392b', '#2b2f36', '#e2b31b'][i], 0.4), { pos: [x, h + 0.95, -0.75] });
    }
    slab(B, front, w - 1, 0.1, d - 1.4, 0, 1.6, -0.5);
    for (let i = 0; i < Math.floor(w / 0.6); i++) if (r() < 0.7) {
      lathe(B, M.clearGlass('#e6f0f2'), [[0.17, 0], [0.19, 0.06], [0.09, 0.22], [0.08, 0.5], [0.22, 0.6], [0.24, 0.95]], -w / 2 + 0.6 + i * 0.6, 1.7, -0.5 + (i % 2) * 0.5, 10);
    }
  },
  backbar(B, it, { w, d, h }) {
    const m = M.grain(it.color || '#3b2a1c', 0.45);
    const r = rng(seedOf(it) * 223 + 2);
    cabinet(B, { w, h: 3, d, body: m, front: m, cols: Math.max(2, Math.round(w / 2.6)), kind: 'door', top: M.grain('#2b2b2e', 0.3), topT: 0.12 });
    // Lit bottle shelving above, with a mirrored back.
    slab(B, M.mirror(), w - 0.4, h - 3.6, 0.05, 0, 3.4, -d / 2 + 0.06);
    for (const sx of [-1, 1]) slab(B, m, 0.14, h - 3.2, d, sx * (w / 2 - 0.07), 3.2, 0);
    for (let k = 0; k < 4; k++) {
      const y = 3.6 + k * ((h - 4) / 4);
      slab(B, M.clearGlass('#dfeef2'), w - 0.3, 0.06, d - 0.25, 0, y, 0.05);
      slab(B, M.glow('#ffd9a0', 1.1), w - 0.5, 0.04, 0.08, 0, y - 0.06, d / 2 - 0.22);
      for (let i = 0; i < Math.floor((w - 0.6) / 0.42); i++) if (r() < 0.82) {
        const col = ['#2e6f8e', '#8a5a2a', '#1f7a54', '#b84a6a', '#e2d2a8', '#55585d'][Math.floor(r() * 6)];
        const hh = 0.9 + r() * 0.5;
        lathe(B, M.plastic(col, 0.25), [[0.17, 0], [0.18, hh * 0.55], [0.14, hh * 0.68], [0.07, hh * 0.85], [0.07, hh], [0.08, hh + 0.03]], -w / 2 + 0.5 + i * 0.42, y + 0.06, (r() - 0.5) * (d - 1), 10);
      }
    }
    slab(B, m, w, 0.25, d + 0.15, 0, h - 0.25, 0);
  },
  hoststand(B, it, { w, d, h }) {
    const m = wood(it, 3);
    slab(B, m, w, h - 0.2, d, 0, 0, 0);
    rbox(B, M.grain('#2b2b2e', 0.3), w + 0.2, 0.14, d + 0.2, 0, h - 0.2, 0, 0.03, [-0.12, 0, 0]);
    slab(B, M.laminate('#f1ece2', 0.7), w - 0.6, 0.04, d - 0.4, 0, h - 0.04, 0.05, [-0.12, 0, 0]);
    slab(B, M.metal('#c9a86a', 0.3), w - 0.3, 0.06, 0.06, 0, h - 0.55, d / 2 + 0.02);
  },
  buffet(B, it, { w, d, h }) {
    const r = rng(seedOf(it) * 227 + 4);
    slab(B, M.stainless(0.3), w, h - 1.5, d, 0, 0, 0);
    slab(B, M.painted('#55585d', 0.5), w - 0.3, 0.4, d - 0.3, 0, 0, 0);
    rbox(B, M.metal('#c9ced3', 0.25), w + 0.15, 0.1, d + 0.15, 0, h - 1.5, 0, 0.02);
    // Gastronorm pans of food in a hot well, under a heat gantry.
    const n = Math.max(2, Math.floor(w / 2));
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (w / n) * (i + 0.5);
      slab(B, M.stainless(0.2), w / n - 0.15, 0.4, d - 1, x, h - 1.9, 0);
      const food = ['#c8762a', '#e0c86a', '#8a4a2a', '#d9d2b8', '#5b7a3a', '#a33a2a'][Math.floor(r() * 6)];
      slab(B, M.plastic(food, 0.7), w / n - 0.25, 0.1, d - 1.15, x, h - 1.58, 0);
      slab(B, M.metal('#dde0e2', 0.25), w / n - 0.4, 0.3, 0.06, x, h - 1.4, -d / 2 + 0.35, [-0.5, 0, 0]);
    }
    for (const sx of [-1, 1]) slab(B, M.metal('#b9bfc4', 0.3), 0.1, 1.4, 0.1, sx * (w / 2 - 0.1), h - 1.4, -d / 2 + 0.4);
    slab(B, M.metal('#b9bfc4', 0.3), w, 0.35, 0.8, 0, h - 0.35, -d / 2 + 0.4);
    slab(B, M.glow('#ffb45c', 1.5), w - 0.6, 0.08, 0.3, 0, h - 0.42, -d / 2 + 0.4);
    slab(B, M.clearGlass('#e8f2f4'), w, 1, 0.06, 0, h - 1.3, d / 2 - 0.25, [0.45, 0, 0]);
    // Trayslide.
    for (const sx of [-1, 1]) B.add(cylGeo(0.06, 0.06, 1.4, 8).rotateX(PI / 2), M.metal('#c9ced3', 0.25), { pos: [sx * (w / 2 - 0.6), h - 1.55, d / 2 + 0.55] });
  },
  dessertcase(B, it, { w, d, h }) {
    const r = rng(seedOf(it) * 229 + 6);
    slab(B, M.painted('#2b2f36', 0.45), w, 2.6, d, 0, 0, 0);
    slab(B, M.metal('#c9ced3', 0.3), w + 0.1, 0.12, d + 0.1, 0, 2.6, 0);
    slab(B, M.clearGlass('#e8f2f4'), w - 0.15, h - 2.9, 0.05, 0, 2.72, d / 2 - 0.08);
    slab(B, M.clearGlass('#e8f2f4'), w - 0.15, h - 2.9, 0.05, 0, 2.72, -d / 2 + 0.08);
    for (const sx of [-1, 1]) slab(B, M.metal('#b9bfc4', 0.3), 0.08, h - 2.9, d, sx * (w / 2 - 0.04), 2.72, 0);
    slab(B, M.metal('#b9bfc4', 0.3), w, 0.14, d, 0, h - 0.14, 0);
    for (let k = 0; k < 2; k++) {
      const y = 2.78 + k * ((h - 3.1) / 2);
      slab(B, M.clearGlass('#dfeef2'), w - 0.3, 0.05, d - 0.3, 0, y, 0);
      slab(B, M.glow('#fff0d2', 1.2), w - 0.5, 0.04, 0.07, 0, y + (h - 3.1) / 2 - 0.12, d / 2 - 0.25);
      for (let i = 0; i < Math.floor(w / 1.1); i++) {
        const x = -w / 2 + 0.6 + i * 1.1;
        const cake = ['#e8d9b8', '#8a4a2a', '#f0e2e8', '#c9a86a', '#6b3a2a'][Math.floor(r() * 5)];
        disc(B, M.porcelain('#f8f7f3'), 0.42, 0.04, x, y + 0.05, 0, 16);
        if (r() < 0.5) lathe(B, M.plastic(cake, 0.7), [[0.38, 0], [0.4, 0.3], [0.38, 0.42], [0.3, 0.46], [0, 0.48]], x, y + 0.09, 0, 18);
        else for (let s2 = 0; s2 < 4; s2++) B.add(new THREE.CylinderGeometry(0.34, 0.34, 0.34, 14, 1, false, s2 * 1.5, 1.4), M.plastic(cake, 0.7), { pos: [x, y + 0.26, 0] });
      }
    }
  },
  espresso(B, it, { w, d, h }) {
    const body = M.metal('#b9bfc4', 0.22);
    rbox(B, body, w, h - 0.5, d, 0, 0, 0, 0.08);
    rbox(B, M.painted('#2b2f36', 0.35), w - 0.2, 0.5, d - 0.3, 0, h - 0.5, -0.1, 0.06);
    slab(B, M.painted('#17191c', 0.5), w - 0.4, 0.9, 0.1, 0, 0.35, d / 2 - 0.02);
    slab(B, M.stainless(0.2), w - 0.5, 0.06, 0.35, 0, 0.3, d / 2 - 0.2);
    for (const sx of [-1, 1]) {
      // Group head with a portafilter handle.
      disc(B, M.chrome(), 0.22, 0.3, sx * 0.55, 0.95, d / 2 - 0.35, 12);
      B.add(cylGeo(0.26, 0.26, 0.12, 12), M.chrome(), { pos: [sx * 0.55, 0.88, d / 2 - 0.35] });
      B.add(cylGeo(0.06, 0.06, 0.5, 8).rotateX(PI / 2), M.plastic('#17191c', 0.4), { pos: [sx * 0.55, 0.82, d / 2 - 0.1] });
      B.tube(M.chrome(), [sx * (w / 2 - 0.2), 1.1, d / 2 - 0.4], [sx * (w / 2 - 0.2), 0.55, d / 2 - 0.3], 0.045, 6);
    }
    disc(B, M.glow('#ffd9a0', 1), 0.1, 0.03, 0, 1.25, d / 2 - 0.2, 8);
    for (let i = 0; i < 6; i++) disc(B, M.porcelain('#f4f4f0'), 0.17, 0.26, -w / 2 + 0.35 + (i % 3) * 0.4, h - 0.5 + 0.5, -0.1 + Math.floor(i / 3) * 0.4, 10);
  },
  waiterstation(B, it, { w, d, h }) {
    const m = wood(it, 3);
    const r = rng(seedOf(it) * 233 + 3);
    cabinet(B, { w, h: h - 0.6, d, body: m, front: m, cols: 2, kind: 'drawer', rows: 3, top: M.grain('#2b2b2e', 0.3), topT: 0.12 });
    monitor(B, 0, h - 0.6, -0.1, { w: 1.3, kind: 'pos', seed: seedOf(it), turn: 0.1 });
    for (let i = 0; i < 3; i++) lathe(B, M.clearGlass('#e6f0f2'), [[0.16, 0], [0.18, 0.05], [0.08, 0.2], [0.07, 0.45], [0.2, 0.55], [0.22, 0.85]], -w / 2 + 0.45 + i * 0.38, h - 0.6, d / 2 - 0.4, 10);
    void r;
  },
  highchair(B, it, { w, d, h }) {
    const m = M.grain('#a8743f', 0.5);
    legs(B, m, w - 0.2, d - 0.2, h - 1.1, { round: true, t: 0.11, splay: 0.12 });
    rbox(B, m, w - 0.3, 0.1, d - 0.3, 0, h - 1.1, 0, 0.03);
    rbox(B, m, w - 0.35, 0.9, 0.1, 0, h - 1, -d / 2 + 0.25, 0.03);
    rbox(B, M.plastic('#d9d9d6', 0.5), w - 0.1, 0.07, 0.75, 0, h - 0.25, d / 2 - 0.35, 0.05);
    for (const sx of [-1, 1]) B.add(cylGeo(0.05, 0.05, 0.6, 6), m, { pos: [sx * (w / 2 - 0.22), h - 0.65, d / 2 - 0.4] });
  },
};

function diningTable(B, it, { w, d }, seats) {
  const r = rng(seedOf(it) * 239 + 1);
  const m = wood(it, 1);
  rbox(B, m, w, 0.14, d, 0, TABLE_H - 0.14, 0, 0.03);
  legs(B, m, w, d, TABLE_H - 0.14, { inset: 0.28, t: 0.16, taper: 0.85 });
  if (seats > 4) for (const sz of [-1, 1]) slab(B, m, w - 1, 0.1, 0.12, 0, TABLE_H - 0.9, sz * (d / 2 - 0.35));
  const places = seats === 2 ? [[0, 0.55, PI], [0, -0.55, 0]] : seats === 4
    ? [[-w * 0.2, d * 0.22, PI], [w * 0.2, d * 0.22, PI], [-w * 0.2, -d * 0.22, 0], [w * 0.2, -d * 0.22, 0]]
    : [[-w * 0.28, d * 0.22, PI], [0, d * 0.22, PI], [w * 0.28, d * 0.22, PI], [-w * 0.28, -d * 0.22, 0], [0, -d * 0.22, 0], [w * 0.28, -d * 0.22, 0]];
  for (const [px, pz, t] of places) setting(B, r, px, TABLE_H, pz, t);
  // A small centrepiece.
  lathe(B, M.clearGlass('#dfe8ea'), [[0.22, 0], [0.26, 0.12], [0.2, 0.4], [0.22, 0.46]], 0, TABLE_H, 0, 12);
  foliage(B, r, 0, TABLE_H + 0.45, 0, 0.42, 0.55, { n: 5, hex: '#4a7d42' });
}

/* ======================================================================= */
/*                             PRO KITCHEN                                  */
/* ======================================================================= */

/** A stainless unit on round adjustable feet. */
function sstable(B, w, d, h, { shelf = true, splash = 0 } = {}) {
  const st = M.stainless(0.28);
  rbox(B, st, w, 0.1, d, 0, h - 0.1, 0, 0.02);
  slab(B, st, w, 0.12, 0.2, 0, h - 0.22, -d / 2 + 0.1);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    post(B, M.metal('#9aa1a8', 0.35), 0.09, 0.09, h - 0.22, sx * (w / 2 - 0.25), 0.18, sz * (d / 2 - 0.25), 10);
    post(B, blackPl(0.6), 0.11, 0.13, 0.18, sx * (w / 2 - 0.25), 0, sz * (d / 2 - 0.25), 8);
  }
  if (shelf) slab(B, st, w - 0.35, 0.07, d - 0.35, 0, 0.75, 0);
  if (splash) slab(B, st, w, splash, 0.08, 0, h, -d / 2 + 0.04, [-0.06, 0, 0]);
  return h;
}

const KITCHEN = [
  ['kitchen', 'prepbench', 'Stainless prep bench', '🔪', 6, 2.6, 3, { len: true, surface: 3 }],
  ['kitchen', 'prepsink', 'Prep sink bench', '🚰', 5, 2.6, 3, { len: true, surface: 3 }],
  ['kitchen', 'rangesix', 'Six-burner range', '🔥', 4, 3, 4.6, {}],
  ['kitchen', 'griddle', 'Griddle and fryers', '🍳', 5, 3, 4.6, {}],
  ['kitchen', 'combioven', 'Combi oven', '♨️', 3.4, 3.2, 6, {}],
  ['kitchen', 'pizzaoven', 'Deck oven', '🍕', 5, 3.4, 5.6, {}],
  ['kitchen', 'hood', 'Extraction canopy', '💨', 8, 4, 2.6, { ceil: true, len: true }],
  ['kitchen', 'passgantry', 'Pass with heat lamps', '🍽️', 8, 2.6, 6.6, { len: true, surface: 3.2 }],
  ['kitchen', 'dishwash', 'Pass-through dishwasher', '🧼', 3.2, 3, 6.4, {}],
  ['kitchen', 'potsink', 'Three-bowl pot sink', '🫧', 7, 2.8, 3.2, { len: true }],
  ['kitchen', 'handsink', 'Hand wash basin', '🧴', 1.6, 1.4, 4, { wall: true, mount: 0 }],
  ['kitchen', 'fridgereach', 'Reach-in refrigerator', '🧊', 4.4, 3, 7, { variants: [['fridge', 'Refrigerator'], ['freezer', 'Freezer']] }],
  ['kitchen', 'shelfwire', 'Wire shelving', '🗄️', 5, 2, 6.4, { len: true }],
  ['kitchen', 'icemachine', 'Ice machine', '🧊', 2.6, 2.6, 6, {}],
  ['kitchen', 'mixerfloor', 'Floor mixer', '🥣', 2.2, 2.6, 4.6, {}],
  ['kitchen', 'trolleyfood', 'Food trolley', '🛒', 2.2, 3.4, 4.4, {}],
  ['kitchen', 'binkitchen', 'Kitchen waste bin', '🗑️', 1.8, 1.8, 3, {}],
];

const KITCHEN_B = {
  prepbench(B, it, { w, d, h }) {
    sstable(B, w, d, h, { splash: 0.8 });
    const r = rng(seedOf(it) * 241 + 2);
    // A board, a tub and a few things in progress.
    slab(B, M.plastic('#e9e2d0', 0.6), 1.8, 0.1, 1.3, -w / 2 + 1.4, h, 0.1);
    for (let i = 0; i < 2; i++) slab(B, M.plastic(['#d9d9d6', '#e9e9e4'][i], 0.5), 1, 0.6, 0.9, w / 2 - 1.2 - i * 1.1, h, -0.1);
    B.add(cylGeo(0.06, 0.06, 0.9, 6).rotateZ(PI / 2), M.metal('#dfe3e6', 0.2), { pos: [-w / 2 + 1.4, h + 0.13, 0.5], rot: [0, 0.3, 0] });
    void r;
  },
  prepsink(B, it, { w, d, h }) {
    sstable(B, w, d, h, { splash: 0.9 });
    const st = M.stainless(0.22);
    slab(B, M.painted('#2b2f36', 0.9), 2, 0.5, 1.6, w / 2 - 1.5, h - 0.5, 0);
    slab(B, st, 2.2, 0.06, 1.8, w / 2 - 1.5, h - 0.06, 0);
    slab(B, M.painted('#17191c', 0.9), 1.9, 0.02, 1.5, w / 2 - 1.5, h - 0.08, 0);
    B.tube(M.chrome(), [w / 2 - 1.5, h, -d / 2 + 0.35], [w / 2 - 1.5, h + 1.3, -d / 2 + 0.35], 0.06, 8);
    B.tube(M.chrome(), [w / 2 - 1.5, h + 1.3, -d / 2 + 0.35], [w / 2 - 1.5, h + 1.15, -d / 2 + 1.1], 0.06, 8);
    for (const sx of [-1, 1]) barX(B, M.chrome(), 0.04, 0.45, w / 2 - 1.5 + sx * 0.4, h + 0.3, -d / 2 + 0.35, 6);
  },
  rangesix(B, it, { w, d, h }) {
    const st = M.stainless(0.3);
    const blk = M.painted('#17191c', 0.55);
    slab(B, st, w, h - 1.2, d, 0, 0, 0);
    slab(B, blk, w - 0.1, 0.9, 0.08, 0, h - 2.1, d / 2 - 0.02);     // oven door
    barX(B, M.metal('#c9ced3', 0.3), 0.06, w - 0.6, 0, h - 1.45, d / 2 + 0.12, 8);
    slab(B, blk, w, 0.12, d, 0, h - 1.2, 0);
    // Burner grates and rings.
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      const x = -w / 2 + (w / 3) * (i + 0.5);
      const z = -d / 2 + (d / 2.2) * (j + 0.6);
      B.add(cylGeo(0.42, 0.42, 0.1, 14), M.metal('#3d434b', 0.7), { pos: [x, h - 1.05, z] });
      for (let k = 0; k < 4; k++) B.add(new THREE.BoxGeometry(0.07, 0.1, 0.8), M.metal('#2b2f36', 0.8), { pos: [x, h - 1.02, z], rot: [0, (k / 4) * PI, 0] });
      B.add(cylGeo(0.26, 0.2, 0.12, 12), M.metal('#55585d', 0.6), { pos: [x, h - 1.16, z] });
    }
    slab(B, st, w, 0.5, 0.25, 0, h - 0.5, -d / 2 + 0.1);
    for (let i = 0; i < 6; i++) B.add(cylGeo(0.13, 0.13, 0.12, 10).rotateX(PI / 2), blackPl(0.4), { pos: [-w / 2 + 0.4 + i * ((w - 0.8) / 5), h - 1.7, d / 2 + 0.06] });
  },
  griddle(B, it, { w, d, h }) {
    const st = M.stainless(0.3);
    slab(B, st, w, h - 1.2, d, 0, 0, 0);
    slab(B, M.painted('#17191c', 0.55), w, 0.12, d, 0, h - 1.2, 0);
    // Flat top on the left, two fryer wells on the right.
    slab(B, M.metal('#55585d', 0.35), w * 0.5 - 0.2, 0.14, d - 0.5, -w * 0.25, h - 1.08, 0);
    slab(B, st, w * 0.5 - 0.2, 0.3, 0.1, -w * 0.25, h - 0.94, -d / 2 + 0.3);
    for (let i = 0; i < 2; i++) {
      const x = w * 0.14 + i * (w * 0.22);
      slab(B, M.painted('#2b2f36', 0.8), w * 0.2, 0.5, d - 0.9, x, h - 1.6, 0);
      slab(B, M.plastic('#e8c96a', 0.3), w * 0.18, 0.06, d - 1, x, h - 1.3, 0);
      for (const sz of [-1, 1]) {
        slab(B, M.meshFence(), w * 0.17, 0.4, 0.05, x, h - 1.25, sz * 0.3);
        barZ(B, blackPl(0.4), 0.05, 0.5, x, h - 0.85, -d / 2 - 0.1, 6);
      }
    }
    for (let i = 0; i < 4; i++) B.add(cylGeo(0.12, 0.12, 0.12, 10).rotateX(PI / 2), blackPl(0.4), { pos: [-w / 2 + 0.5 + i * 0.5, h - 1.75, d / 2 + 0.06] });
  },
  combioven(B, it, { w, d, h }) {
    const st = M.stainless(0.3);
    slab(B, st, w, h, d, 0, 0, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) post(B, M.metal('#9aa1a8', 0.35), 0.09, 0.09, 0.9, sx * (w / 2 - 0.25), -0.9, sz * (d / 2 - 0.25), 8);
    for (let k = 0; k < 2; k++) {
      const y = 0.4 + k * ((h - 0.8) / 2);
      slab(B, M.painted('#2b2f36', 0.4), w - 0.9, (h - 0.9) / 2 - 0.1, 0.1, -0.2, y, d / 2 - 0.02);
      slab(B, M.clearGlass('#3a4348'), w - 1.6, (h - 0.9) / 2 - 0.6, 0.05, -0.2, y + 0.25, d / 2 + 0.04);
      barZ(B, M.metal('#c9ced3', 0.3), 0.05, 0.3, w / 2 - 1, y + ((h - 0.9) / 2 - 0.1) / 2, d / 2 + 0.16, 8);
      slab(B, M.painted('#17191c', 0.4), 0.75, (h - 0.9) / 2 - 0.3, 0.08, w / 2 - 0.45, y + 0.1, d / 2 - 0.01);
      face(B, screenMat('pos', seedOf(it) + k), 0.6, 0.8, w / 2 - 0.45, y + 1, d / 2 + 0.04);
    }
  },
  pizzaoven(B, it, { w, d, h }) {
    const st = M.stainless(0.3);
    const blk = M.painted('#3d434b', 0.5);
    for (let k = 0; k < 2; k++) {
      const y = 1.4 + k * 1.9;
      slab(B, st, w, 1.8, d, 0, y, 0);
      slab(B, blk, w - 0.3, 1.1, 0.12, 0, y + 0.4, d / 2 - 0.02);
      slab(B, M.glow('#ff9a3c', 0.9), w - 1, 0.5, 0.04, 0, y + 0.65, d / 2 + 0.05);
      barX(B, M.metal('#c9ced3', 0.3), 0.06, w - 0.8, 0, y + 0.35, d / 2 + 0.14, 8);
      for (let i = 0; i < 3; i++) B.add(cylGeo(0.12, 0.12, 0.1, 10).rotateX(PI / 2), blackPl(0.4), { pos: [-w / 2 + 0.5 + i * 0.45, y + 1.55, d / 2 + 0.06] });
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) post(B, M.metal('#9aa1a8', 0.35), 0.1, 0.1, 1.4, sx * (w / 2 - 0.3), 0, sz * (d / 2 - 0.3), 8);
    slab(B, st, w, 0.14, d, 0, h - 0.14, 0);
    void h;
  },
  hood(B, it, { w, d, h }) {
    const st = M.stainless(0.3);
    // Hangs from the ceiling: modelled downward from y = 0.
    slab(B, st, w, 0.12, d, 0, -0.12, 0);
    for (const sx of [-1, 1]) B.add(cylGeo(0.07, 0.07, h - 1.6, 8), M.metal('#9aa1a8', 0.35), { pos: [sx * (w / 2 - 0.5), -(h - 1.6) / 2, 0] });
    const y0 = -(h - 1.5);
    slab(B, st, w, 1.5, d, 0, y0, 0);
    // Sloped lower lip and grease filters inside.
    for (const sz of [-1, 1]) slab(B, st, w, 0.55, 0.5, 0, y0 - 0.2, sz * (d / 2 - 0.1), [sz * 0.5, 0, 0]);
    for (let i = 0; i < Math.floor(w / 1.3); i++) {
      slab(B, M.metal('#8a8f96', 0.5), 1.15, 1.1, 0.08, -w / 2 + 0.75 + i * 1.3, y0 + 0.2, d / 2 - 0.45, [0.35, 0, 0]);
    }
    for (let i = 0; i < Math.floor(w / 2.6); i++) slab(B, M.glow('#f4f7fa', 1.2), 1.4, 0.06, 0.3, -w / 2 + 1.3 + i * 2.6, y0 + 0.14, 0);
    slab(B, st, 2.2, 1.6, 2.2, 0, -1.6, -d / 2 + 1.2);
  },
  passgantry(B, it, { w, d, h }) {
    sstable(B, w, d, 3.2, { shelf: true });
    const st = M.stainless(0.28);
    for (const sx of [-1, 1]) slab(B, M.metal('#9aa1a8', 0.35), 0.12, h - 3.2, 0.12, sx * (w / 2 - 0.4), 3.2, 0);
    slab(B, st, w - 0.4, 0.1, d - 0.9, 0, h - 1.5, 0);
    slab(B, st, w - 0.4, 0.5, 0.3, 0, h - 0.5, 0);
    for (let i = 0; i < Math.max(2, Math.floor(w / 2.4)); i++) {
      const x = -w / 2 + (w / Math.max(2, Math.floor(w / 2.4))) * (i + 0.5);
      B.add(cylGeo(0.16, 0.16, 1.3, 10).rotateZ(PI / 2), M.glow('#ffad4a', 1.6), { pos: [x, h - 0.62, 0] });
      slab(B, st, 1.5, 0.2, 0.5, x, h - 0.5, 0);
    }
    const r = rng(seedOf(it) * 251 + 4);
    for (let i = 0; i < 3; i++) if (r() < 0.8) {
      disc(B, M.porcelain('#f8f7f3'), 0.55, 0.06, -w / 2 + 1.5 + i * 2, 3.2, 0.2, 18);
      B.add(new THREE.IcosahedronGeometry(0.3, 1), M.plastic(['#c8762a', '#8a4a2a', '#d9d2b8'][i % 3], 0.7), { pos: [-w / 2 + 1.5 + i * 2, 3.4, 0.2], scale: [1, 0.5, 1] });
    }
    // Docket rail.
    barX(B, M.metal('#c9ced3', 0.3), 0.05, w - 1, 0, h - 1.1, -d / 2 + 0.3, 8);
    for (let i = 0; i < 5; i++) if (r() < 0.7) slab(B, M.laminate('#f6f5f1', 0.7), 0.5, 0.7, 0.01, -w / 2 + 1 + i * 1.4, h - 1.8, -d / 2 + 0.3);
  },
  dishwash(B, it, { w, d, h }) {
    const st = M.stainless(0.3);
    slab(B, st, w, 3.2, d, 0, 0, 0);
    slab(B, st, w, h - 5.2, d, 0, 5.2, 0);
    for (const sx of [-1, 1]) slab(B, st, 0.35, 2, d, sx * (w / 2 - 0.17), 3.2, 0);
    // The hood that lifts, with its handle.
    slab(B, M.metal('#c9ced3', 0.3), w - 0.6, 1.9, 0.12, 0, 3.25, d / 2 - 0.08);
    barX(B, M.metal('#9aa1a8', 0.3), 0.07, w - 1.4, 0, 4.9, d / 2 + 0.1, 8);
    slab(B, M.painted('#17191c', 0.5), 1, 0.8, 0.08, w / 2 - 0.8, h - 1.2, d / 2 - 0.02);
    for (let i = 0; i < 3; i++) B.add(cylGeo(0.09, 0.09, 0.1, 10).rotateX(PI / 2), M.plastic(['#1f7a54', '#c0392b', '#e2b31b'][i], 0.4), { pos: [w / 2 - 0.8, h - 0.9 - i * 0.25, d / 2 + 0.04] });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) post(B, M.metal('#9aa1a8', 0.35), 0.1, 0.1, 0.5, sx * (w / 2 - 0.3), -0.5, sz * (d / 2 - 0.3), 8);
    slab(B, M.plastic('#55585d', 0.6), w - 0.8, 0.2, d - 0.8, 0, 3.3, 0);
  },
  potsink(B, it, { w, d, h }) {
    const st = M.stainless(0.25);
    sstable(B, w, d, h, { shelf: false, splash: 0.9 });
    for (let i = 0; i < 3; i++) {
      const x = -w / 2 + (w / 3) * (i + 0.5);
      slab(B, M.painted('#17191c', 0.9), w / 3 - 0.3, 0.9, d - 0.6, x, h - 0.95, 0);
      slab(B, st, w / 3 - 0.2, 0.08, d - 0.5, x, h - 0.1, 0);
      disc(B, M.metal('#8a8f96', 0.4), 0.12, 0.02, x, h - 0.95, 0, 10);
    }
    B.tube(M.chrome(), [0, h, -d / 2 + 0.3], [0, h + 1.5, -d / 2 + 0.3], 0.06, 8);
    B.tube(M.chrome(), [0, h + 1.5, -d / 2 + 0.3], [0, h + 1.35, -d / 2 + 1.2], 0.05, 8);
    B.tube(M.chrome(), [0, h + 1.35, -d / 2 + 1.2], [0, h + 0.5, -d / 2 + 1.2], 0.04, 6);
  },
  handsink(B, it, { w, d, h }) {
    // Wall item: modelled out from z = 0 at its mounting height.
    const st = M.stainless(0.25);
    const y = 2.9;
    slab(B, st, w, 0.5, d, 0, y, d / 2);
    slab(B, M.painted('#17191c', 0.9), w - 0.3, 0.1, d - 0.2, 0, y + 0.3, d / 2);
    slab(B, st, w, 0.9, 0.08, 0, y, 0.04);
    B.tube(M.chrome(), [0, y + 0.5, 0.1], [0, y + 0.85, 0.1], 0.05, 8);
    B.tube(M.chrome(), [0, y + 0.85, 0.1], [0, y + 0.7, d * 0.6], 0.045, 8);
    slab(B, M.plastic('#f1f2f0', 0.4), 0.55, 0.75, 0.3, -w / 2 - 0.1, y + 1.1, 0.15);
    void h;
  },
  fridgereach(B, it, { w, d, h }) {
    const st = M.stainless(0.3);
    const freezer = it.variant === 'freezer';
    slab(B, st, w, h - 1.2, d, 0, 0.7, 0);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) post(B, M.metal('#9aa1a8', 0.35), 0.1, 0.1, 0.7, sx * (w / 2 - 0.3), 0, sz * (d / 2 - 0.3), 8);
    slab(B, st, w, 0.5, d, 0, h - 0.5, 0);
    for (const sx of [-1, 1]) {
      slab(B, M.metal('#dde0e2', 0.28), w / 2 - 0.1, h - 2, 0.12, sx * w / 4, 0.85, d / 2 - 0.02);
      barZ(B, M.metal('#9aa1a8', 0.3), 0.05, 0.3, sx * (w / 4 - w * 0.17), (h - 2) / 2 + 0.85, d / 2 + 0.13, 8);
      B.add(cylGeo(0.05, 0.05, h - 3, 8), M.metal('#9aa1a8', 0.3), { pos: [sx * (w / 4 - w * 0.17), (h - 2) / 2 + 0.85, d / 2 + 0.18] });
    }
    slab(B, M.painted('#17191c', 0.5), 0.9, 0.5, 0.06, -w / 2 + 0.7, h - 0.45, d / 2 + 0.01);
    face(B, labelMat(freezer ? '-4°' : '38°', { color: freezer ? '#8ad4ff' : '#9ae6a0', bg: '#0d1114', aspect: 2.2, glow: true }), 0.7, 0.32, -w / 2 + 0.7, h - 0.2, d / 2 + 0.05);
  },
  shelfwire(B, it, { w, d, h }) {
    const m = M.metal('#c9ced3', 0.35);
    const r = rng(seedOf(it) * 257 + 3);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      post(B, m, 0.08, 0.08, h, sx * (w / 2 - 0.12), 0, sz * (d / 2 - 0.12), 8);
      post(B, blackPl(0.6), 0.1, 0.12, 0.16, sx * (w / 2 - 0.12), 0, sz * (d / 2 - 0.12), 8);
    }
    for (let k = 0; k < 4; k++) {
      const y = 0.9 + k * ((h - 1.2) / 3.2);
      // A wire shelf: a frame with rods across it.
      for (const sz of [-1, 1]) B.add(cylGeo(0.05, 0.05, w - 0.2, 8).rotateZ(PI / 2), m, { pos: [0, y, sz * (d / 2 - 0.14)] });
      for (const sx of [-1, 1]) B.add(cylGeo(0.05, 0.05, d - 0.25, 8).rotateX(PI / 2), m, { pos: [sx * (w / 2 - 0.14), y, 0] });
      for (let i = 0; i < Math.floor(w / 0.45); i++) B.add(cylGeo(0.025, 0.025, d - 0.25, 5).rotateX(PI / 2), m, { pos: [-w / 2 + 0.3 + i * 0.45, y - 0.03, 0] });
      if (r() < 0.85) stock(B, r, -w / 2 + 0.25, w / 2 - 0.25, y + 0.03, -d / 2 + 0.25, d / 2 - 0.25, ['cartons', 'bins', 'boxes'][Math.floor(r() * 3)], { maxH: (h - 1.2) / 3.2 - 0.3 });
    }
  },
  icemachine(B, it, { w, d, h }) {
    const st = M.stainless(0.3);
    slab(B, st, w, h - 2.4, d, 0, 2.4, 0);
    slab(B, M.painted('#d9d9d6', 0.4), w - 0.1, 2.4, d - 0.1, 0, 0, 0);
    slab(B, M.metal('#dde0e2', 0.28), w - 0.2, 1.4, 0.1, 0, 2.7, d / 2 - 0.02);
    barX(B, M.metal('#9aa1a8', 0.3), 0.05, w - 0.8, 0, 2.85, d / 2 + 0.1, 8);
    for (let i = 0; i < 10; i++) slab(B, M.metal('#8a8f96', 0.5), w - 0.4, 0.05, 0.03, 0, h - 1.4 + i * 0.12, d / 2 + 0.01);
    void it;
  },
  mixerfloor(B, it, { w, d, h }) {
    const body = M.painted('#d9d9d6', 0.35);
    slab(B, body, w - 0.2, 1.4, d - 0.4, 0, 0, 0);
    lathe(B, M.metal('#b9bfc4', 0.3), [[0.01, 0], [0.75, 0.1], [0.8, 1.2], [0.85, 1.35], [0.8, 1.4]], 0, 1.4, 0.2, 18);
    rbox(B, body, w - 0.3, 1.1, d - 0.6, 0, 2.9, -0.3, 0.1);
    rbox(B, body, w - 0.5, 1.2, 1, 0, 2.9, 0.4, 0.12);
    B.add(cylGeo(0.14, 0.14, 1.1, 10), M.metal('#9aa1a8', 0.3), { pos: [0, 2.4, 0.2] });
    B.add(cylGeo(0.05, 0.3, 0.9, 8), M.metal('#c9ced3', 0.3), { pos: [0, 1.9, 0.2] });
    B.add(cylGeo(0.12, 0.12, 0.3, 10).rotateZ(PI / 2), blackPl(0.4), { pos: [w / 2 - 0.25, 3.3, 0.2] });
    void h;
  },
  trolleyfood(B, it, { w, d, h }) {
    const st = M.stainless(0.3);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      post(B, M.metal('#9aa1a8', 0.35), 0.07, 0.07, h - 0.3, sx * (w / 2 - 0.12), 0.3, sz * (d / 2 - 0.12), 8);
      B.add(cylGeo(0.16, 0.16, 0.1, 10).rotateZ(PI / 2), blackPl(0.6), { pos: [sx * (w / 2 - 0.12), 0.16, sz * (d / 2 - 0.12)] });
    }
    for (let k = 0; k < 3; k++) {
      const y = 0.6 + k * ((h - 0.9) / 2.2);
      slab(B, st, w, 0.07, d, 0, y, 0);
      slab(B, st, w, 0.1, 0.05, 0, y + 0.07, d / 2 - 0.02);
    }
    B.add(cylGeo(0.05, 0.05, w - 0.1, 8).rotateZ(PI / 2), M.metal('#c9ced3', 0.3), { pos: [0, h, -d / 2 - 0.15] });
    for (const sx of [-1, 1]) B.tube(M.metal('#c9ced3', 0.3), [sx * (w / 2 - 0.12), h - 0.6, -d / 2 + 0.1], [sx * (w / 2 - 0.05), h, -d / 2 - 0.15], 0.045, 6);
  },
  binkitchen(B, it, { w, d, h }) {
    const st = M.stainless(0.3);
    lathe(B, st, [[w / 2 - 0.1, 0], [w / 2, 0.15], [w / 2 - 0.02, h - 0.3], [w / 2 + 0.03, h - 0.25]], 0, 0, 0, 18);
    lathe(B, M.metal('#c9ced3', 0.25), [[w / 2 + 0.04, 0], [w / 2 + 0.02, 0.12], [w / 2 - 0.5, 0.2]], 0, h - 0.25, 0, 18);
    B.add(cylGeo(0.06, 0.06, 0.6, 6), st, { pos: [0, 0.3, -d / 2 - 0.1] });
    barZ(B, st, 0.05, 0.5, 0, 0.1, -d / 2 - 0.1, 6);
    void it;
  },
};

register([...OFFICE, ...RETAIL, ...WAREHOUSE, ...DINING, ...KITCHEN],
  { ...OFFICE_B, ...RETAIL_B, ...WAREHOUSE_B, ...DINING_B, ...KITCHEN_B });

export { palletBase, palletLoad, sstable, shelfRun, chairBase, taskChair, seatPad, deskTop, setting, hangingGarment, DESK_H, TABLE_H, COUNTER_H, BAR_H };
