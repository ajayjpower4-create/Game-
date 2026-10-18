/* Semi trailers: a 53 ft dry van and reefer, a 48 ft flatbed with lumber, a
 * step deck with steel and crates, a stainless tanker, a two-level car hauler
 * carrying real cars, a 40 ft container on its chassis and an end-dump.
 *
 * They share their running gear: the upper coupler and kingpin, landing gear
 * with its crank, a sliding air-ride tandem on dual wheels, mud flaps, the
 * rear underride guard, lamps, side markers and red-and-white reflective tape.
 * Frame as every vehicle: x across, y up, front at -z; `s` is feet back from
 * the trailer's front edge. The front sits on a fifth wheel 4.25 ft up. */

import * as THREE from 'three';
import { Builder, cylGeo } from './builder.js';
import * as M from './materials.js';
import { carWheel, carModel } from './cars.js';
import { TRAILER_BY_ID, CARS } from '../vehiclelist.js';
import { rng } from './textures.js';

const PI = Math.PI;
const R = 1.7;          // 22.5 in wheels
const TW = 0.97;
const W = 8.5;
const PLATE = 4.25;     // top of the fifth wheel: the trailer's front rests here

const steel = () => M.metal('#25272b', 0.55);
const galv = () => M.metal('#9aa1a8', 0.45);

/* ------------------------------------------------------------ running gear */

/** Dual wheels on two axles, air-ride beams, the slider box, mud flaps. */
function tandem(B, Z, sRear, { style = 'steel', rim = '#c9ced3', frameY = 3.4 } = {}) {
  const axles = [sRear - 4.1, sRear];
  const xs = W / 2 - TW / 2 - 0.05;
  const wheel = style === 'alloy'
    ? { style: 'truck', rimR: 0.94, rimColor: '#dfe3e7', rough: 0.12, caliper: false, nuts: 0 }
    : { style: 'steel', rimR: 0.94, rimColor: rim, rough: 0.45, caliper: false, nuts: 0 };
  const inner = { style: 'steel', rimR: 0.94, rimColor: '#3a3e43', rough: 0.5, caliper: false, nuts: 0 };
  for (const s of axles) {
    B.add(cylGeo(0.24, 0.24, 7.2, 12).rotateZ(PI / 2), steel(), { pos: [0, R, Z(s)] });
    for (const sd of [1, -1]) {
      carWheel(B, sd * xs, R, Z(s), R, TW, sd, wheel);
      carWheel(B, sd * (xs - TW - 0.14), R, Z(s), R, TW, -sd, inner);
      // Trailing arm and air bag.
      B.box(steel(), 0.4, 0.35, 3.0, sd * 1.55, R + 0.1, Z(s + 0.6));
      B.add(cylGeo(0.45, 0.45, 0.75, 14), M.rubber(), { pos: [sd * 1.55, R + 0.75, Z(s + 1.6)] });
      B.box(steel(), 0.3, frameY - R - 0.4, 0.5, sd * 1.55, (frameY + R + 0.4) / 2, Z(s - 1.0));
    }
  }
  // The slider box the axles hang from, with its pin holes.
  for (const sd of [1, -1]) {
    B.box(galv(), 0.25, 0.9, axles[1] - axles[0] + 6, sd * 1.65, frameY - 0.35, Z((axles[0] + axles[1]) / 2));
    for (let k = 0; k < 8; k++) B.add(new THREE.CircleGeometry(0.08, 8).rotateY(sd * PI / 2), M.plastic('#050505', 0.9), { pos: [sd * 1.79, frameY - 0.35, Z(axles[0] - 2 + k * 1.2)] });
  }
  // Mud flaps behind the rear axle.
  for (const sd of [1, -1]) {
    B.box(M.rubber(), 2.1, 2.4, 0.05, sd * (xs - 0.5), 1.6, Z(sRear + R + 0.5));
    B.box(galv(), 2.1, 0.15, 0.12, sd * (xs - 0.5), 2.85, Z(sRear + R + 0.5));
  }
  return axles;
}

/** Landing gear: two legs with sand shoes, a cross brace and the crank. */
function landingGear(B, Z, s, topY) {
  const legY0 = 0.55;
  for (const sd of [1, -1]) {
    const x = sd * 1.75;
    B.box(steel(), 0.45, topY - 2.2, 0.45, x, (topY + 2.2) / 2, Z(s));
    B.box(galv(), 0.32, 2.2 - legY0, 0.32, x, (2.2 + legY0) / 2, Z(s));
    B.box(steel(), 1.0, 0.12, 1.0, x, legY0 - 0.05, Z(s));
    B.tube(steel(), [x, topY - 0.3, Z(s)], [x * 0.2, topY - 1.6, Z(s + 1.8)], 0.08, 6);
  }
  B.box(steel(), 3.5, 0.15, 0.15, 0, topY - 1.6, Z(s));
  // Gearbox and the crank handle on the curb side.
  B.box(steel(), 0.5, 0.5, 0.5, 2.15, topY - 1.2, Z(s));
  B.tube(galv(), [2.4, topY - 1.2, Z(s)], [2.75, topY - 1.2, Z(s)], 0.05, 6);
  B.tube(galv(), [2.75, topY - 1.2, Z(s)], [2.75, topY - 2.2, Z(s)], 0.05, 6);
}

/** The rear underride guard, tail lamps, plate and the reflective tape. */
function rearEnd(B, Z, L, { y = 1.9, light = 3.6 } = {}) {
  const zr = Z(L) + 0.05;
  B.box(galv(), 7.6, 0.45, 0.4, 0, y, zr - 0.6);
  for (const sd of [1, -1]) B.box(galv(), 0.3, light - y, 0.3, sd * 2.2, (light + y) / 2, zr - 0.7);
  // DOT tape on the bumper: red and white blocks.
  for (let k = 0; k < 10; k++) B.box(M.lamp(k % 2 ? '#f4f4f2' : '#d6141c', 0.6), 0.74, 0.18, 0.02, -3.33 + k * 0.74, y, zr - 0.39);
  for (const sd of [1, -1]) {
    for (const [dx, col] of [[3.55, '#d6141c'], [3.0, '#d6141c'], [2.45, '#e08a12']]) {
      B.add(new THREE.CircleGeometry(0.22, 16).scale(1.4, 1, 1), M.tailLens(col), { pos: [sd * dx, light, zr + 0.01] });
      B.add(new THREE.TorusGeometry(0.24, 0.04, 6, 16).scale(1.4, 1, 1), M.rubber(), { pos: [sd * dx, light, zr + 0.01] });
    }
  }
  for (const x of [-0.5, 0, 0.5]) B.add(new THREE.CircleGeometry(0.09, 10), M.tailLens('#d6141c'), { pos: [x, light + 0.55, zr + 0.01] });
  B.box(M.plastic('#e9ecef', 0.5), 1.0, 0.5, 0.03, 0, light - 0.55, zr + 0.01);
}

/** Red and white reflective tape along the bottom of each side. */
function sideTape(B, Z, s0, s1, y, x = W / 2 + 0.01) {
  const n = Math.floor((s1 - s0) / 1.5);
  for (let k = 0; k < n; k++) {
    if (k % 2) continue;
    const s = s0 + k * 1.5;
    for (const sd of [1, -1]) B.box(M.lamp(Math.floor(k / 2) % 2 ? '#f4f4f2' : '#d6141c', 0.6), 0.02, 0.17, 1.4, sd * x, y, Z(s + 0.7));
  }
  for (const sd of [1, -1]) {
    B.box(M.tailLens('#e08a12'), 0.06, 0.15, 0.3, sd * x, y + 0.35, Z(s0 + 0.5));
    B.box(M.tailLens('#e08a12'), 0.06, 0.15, 0.3, sd * x, y + 0.35, Z((s0 + s1) / 2));
    B.box(M.tailLens('#d6141c'), 0.06, 0.15, 0.3, sd * x, y + 0.35, Z(s1 - 0.5));
  }
}

/** Kingpin and upper coupler under the front. */
function coupler(B, Z, y = PLATE) {
  B.box(steel(), 7.8, 0.3, 4.5, 0, y + 0.15, Z(2.3));
  B.add(cylGeo(0.17, 0.2, 0.5, 12), galv(), { pos: [0, y - 0.2, Z(3)] });
  // Glad hands on the front face.
  for (const [x, col] of [[-0.6, '#c8241b'], [-0.2, '#2a5bd0']]) B.box(M.painted(col, 0.5), 0.25, 0.18, 0.15, x, y + 1.3, Z(0) - 0.08);
  B.box(M.plastic('#1d1f22', 0.6), 0.45, 0.45, 0.2, 0.55, y + 1.3, Z(0) - 0.1);
}

/* ------------------------------------------------------------ bodies */

/** A box van: panel walls on exterior posts, rails top and bottom, swing doors. */
function vanBody(B, Z, L, paint, { y0 = 4.4, H = 13.5, reefer = false } = {}) {
  const h = H - y0;
  const cy = y0 + h / 2;
  B.box(paint, W - 0.1, h, L, 0, cy, 0);
  // Translucent roof, rails along the top and bottom, the posts.
  B.box(M.plastic('#e9ece6', 0.6), W - 0.25, 0.04, L - 0.4, 0, H + 0.01, 0);
  for (const sd of [1, -1]) {
    B.box(galv(), 0.12, 0.35, L, sd * (W / 2), H - 0.18, 0);
    B.box(galv(), 0.14, 0.7, L, sd * (W / 2), y0 + 0.35, 0);
    for (let s = 2; s < L - 1; s += 2) B.box(M.metal('#c9ced3', 0.4), 0.05, h - 1.0, 0.16, sd * (W / 2 - 0.02), cy + 0.15, Z(s));
  }
  // Floor cross members under the floor.
  for (let s = 1; s < L; s += 1.6) B.box(steel(), W - 0.6, 0.35, 0.18, 0, y0 - 0.2, Z(s));
  // Rear frame and the two swing doors with their lock rods and hinges.
  const zr = Z(L) + 0.02;
  B.box(galv(), W, 0.55, 0.3, 0, H - 0.25, zr);
  B.box(galv(), W, 0.4, 0.3, 0, y0 + 0.2, zr);
  for (const sd of [1, -1]) B.box(galv(), 0.35, h, 0.32, sd * (W / 2 - 0.15), cy, zr);
  const door = M.painted(paint.color ? '#' + paint.color.getHexString() : '#f2f3f4', 0.45);
  for (const sd of [1, -1]) {
    B.box(door, W / 2 - 0.4, h - 1.0, 0.08, sd * (W / 4 - 0.05), cy - 0.05, zr + 0.15);
    for (const fx of [0.25, 0.75]) {
      const x = sd * ((W / 2 - 0.4) * fx + 0.25);
      B.add(cylGeo(0.05, 0.05, h - 0.8, 8), M.chrome(), { pos: [x, cy, zr + 0.25] });
      B.box(M.chrome(), 0.12, 0.9, 0.12, x + sd * 0.2, y0 + 2.4, zr + 0.28);
      for (const yy of [y0 + 0.5, H - 0.6]) B.box(galv(), 0.3, 0.25, 0.25, x, yy, zr + 0.22);
    }
    for (let k = 0; k < 4; k++) B.box(galv(), 0.35, 0.3, 0.2, sd * (W / 2 - 0.35), y0 + 1.2 + k * ((h - 2.4) / 3), zr + 0.22);
  }
  // Tape round the doors and along the sides.
  for (let k = 0; k < 11; k++) B.box(M.lamp(k % 2 ? '#f4f4f2' : '#d6141c', 0.6), 0.7, 0.16, 0.02, -3.6 + k * 0.72, H - 0.6, zr + 0.21);
  sideTape(B, Z, 0.5, L - 0.5, y0 + 0.35, W / 2 + 0.08);
  // Front: the reefer's refrigeration unit, or a plain nose with its corner posts.
  const zf = Z(0) - 0.02;
  for (const sd of [1, -1]) B.box(galv(), 0.3, h, 0.25, sd * (W / 2 - 0.15), cy, zf);
  if (reefer) {
    const uy = H - 3.6;
    B.box(M.painted('#f4f5f6', 0.4), 7.2, 6.0, 1.4, 0, uy, zf - 0.7);
    B.box(M.grilleMesh('#2b2e33'), 5.8, 2.6, 0.05, 0, uy + 0.9, zf - 1.42);
    B.box(M.plastic('#1d1f22', 0.6), 5.8, 1.6, 0.06, 0, uy - 1.6, zf - 1.42);
    B.box(M.plastic('#2b2f36', 0.5), 1.6, 0.5, 0.06, -2.2, uy + 2.6, zf - 1.43);
    for (const sd of [1, -1]) B.add(new THREE.CircleGeometry(0.75, 20), M.plastic('#15171a', 0.7), { pos: [sd * 1.7, uy - 1.6, zf - 1.46] });
  }
  return { y0, H };
}

/** A flatbed or step deck: deck boards, side rails with stake pockets, winches. */
function flatDeck(B, Z, s0, s1, y, { wood = true } = {}) {
  const len = s1 - s0;
  const zc = Z((s0 + s1) / 2);
  if (wood) {
    for (let x = -W / 2 + 0.6; x < W / 2 - 0.4; x += 0.55) B.box(M.wood('#9a7a52'), 0.5, 0.12, len - 0.2, x + 0.25, y - 0.06, zc);
  } else B.box(M.metal('#5d646c', 0.5), W - 0.4, 0.12, len, 0, y - 0.06, zc);
  for (const sd of [1, -1]) {
    B.box(M.alloy('#c9ced3', 0.35), 0.3, 0.75, len, sd * (W / 2 - 0.15), y - 0.3, zc);
    for (let s = s0 + 1; s < s1 - 0.5; s += 2) B.box(M.plastic('#0b0c0d', 0.9), 0.04, 0.25, 0.4, sd * (W / 2 + 0.005), y - 0.25, Z(s));
  }
  // Main beams under the deck.
  for (const sd of [1, -1]) B.box(steel(), 0.25, 1.4, len, sd * 1.6, y - 0.9, zc);
  for (let s = s0 + 1; s < s1; s += 2.2) B.box(steel(), W - 1.0, 0.25, 0.15, 0, y - 0.35, Z(s));
}

/** Strap winches along the side rail, the straps over the load. */
function straps(B, Z, ss, y, top, w = W) {
  for (const s of ss) {
    for (const sd of [1, -1]) B.add(cylGeo(0.18, 0.18, 0.5, 10).rotateX(PI / 2), M.alloy('#c9ced3', 0.35), { pos: [sd * (w / 2 + 0.05), y - 0.55, Z(s)] });
    const strap = M.fabric('#e2b31b');
    B.box(strap, 0.04, top - y + 0.55, 0.25, w / 2 + 0.06, (top + y - 0.55) / 2, Z(s));
    B.box(strap, 0.04, top - y + 0.55, 0.25, -w / 2 - 0.06, (top + y - 0.55) / 2, Z(s));
    B.box(strap, w + 0.12, 0.04, 0.25, 0, top + 0.02, Z(s));
  }
}

/* ------------------------------------------------------------ the trailers */

const BUILD = {
  van53(B, Z, T, paint) {
    vanBody(B, Z, T.L, paint);
    coupler(B, Z);
    landingGear(B, Z, 12.5, 4.3);
    tandem(B, Z, T.L - 4.5);
    rearEnd(B, Z, T.L, { light: 3.7 });
    // Aero side skirts between the landing gear and the tandem.
    for (const sd of [1, -1]) B.box(M.painted('#2b2f36', 0.5), 0.06, 2.6, T.L - 32, sd * (W / 2 - 0.1), 2.65, Z(15 + (T.L - 32) / 2));
  },
  reefer53(B, Z, T, paint) {
    vanBody(B, Z, T.L, paint, { reefer: true });
    coupler(B, Z);
    landingGear(B, Z, 12.5, 4.3);
    tandem(B, Z, T.L - 4.5, { style: 'alloy' });
    rearEnd(B, Z, T.L, { light: 3.7 });
    // The reefer's own fuel tank under the floor.
    B.box(M.alloy('#c9ced3', 0.3), 2.4, 1.6, 3.6, -2.4, 3.2, Z(18));
  },
  flatbed48(B, Z, T, paint) {
    const y = 5.0;
    flatDeck(B, Z, 0, T.L, y);
    B.box(paint, W - 0.6, 0.5, T.L, 0, y - 1.6, 0);
    coupler(B, Z, PLATE);
    landingGear(B, Z, 11, y - 0.6);
    tandem(B, Z, T.L - 4, { frameY: 3.6 });
    rearEnd(B, Z, T.L, { light: 4.2 });
    sideTape(B, Z, 0.5, T.L - 0.5, y - 0.3, W / 2 + 0.02);
    // Bundles of lumber, wrapped, two across and two high.
    const wrap = M.fabric('#e8eef2');
    const ends = M.wood('#d9b98a');
    for (let k = 0; k < 3; k++) {
      const s = 1 + k * 15.5;
      for (const sd of [1, -1]) for (const layer of [0, 1]) {
        const yy = y + 0.25 + layer * 2.45;
        B.box(wrap, 3.9, 2.3, 15, sd * 2.0, yy + 1.15, Z(s + 7.5));
        B.box(ends, 3.7, 2.1, 0.08, sd * 2.0, yy + 1.15, Z(s + 15) + 0.04);
        B.box(ends, 3.7, 2.1, 0.08, sd * 2.0, yy + 1.15, Z(s) - 0.04);
        B.box(M.wood('#8a6a4a'), 3.9, 0.25, 0.35, sd * 2.0, yy - 0.05, Z(s + 3));
        B.box(M.wood('#8a6a4a'), 3.9, 0.25, 0.35, sd * 2.0, yy - 0.05, Z(s + 12));
      }
    }
    straps(B, Z, [3, 8, 13, 18.5, 23.5, 28.5, 34, 39, 44], y, y + 5.2);
    // Headache rack at the front.
    B.box(galv(), W - 0.4, 6, 0.3, 0, y + 3, Z(0.3));
  },
  stepdeck53(B, Z, T, paint) {
    const yu = 5.0;
    const yl = 3.5;
    flatDeck(B, Z, 0, 11, yu);
    flatDeck(B, Z, 12, T.L, yl);
    // The step between decks.
    B.box(steel(), W - 0.4, yu - yl, 1.0, 0, (yu + yl) / 2, Z(11.5));
    coupler(B, Z, PLATE);
    landingGear(B, Z, 9, yu - 0.6);
    tandem(B, Z, T.L - 4, { frameY: 2.9 });
    rearEnd(B, Z, T.L, { y: 1.5, light: 2.9 });
    sideTape(B, Z, 12.5, T.L - 0.5, yl - 0.3, W / 2 + 0.02);
    // Steel I-beams in a bundle, and wooden crates up on the top deck.
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
      const x = -2.4 + i * 1.6;
      const yy = yl + 0.3 + j * 1.25;
      B.box(M.metal('#5d4a3e', 0.6), 1.2, 0.12, 30, x, yy + 0.06, Z(29));
      B.box(M.metal('#5d4a3e', 0.6), 1.2, 0.12, 30, x, yy + 1.0, Z(29));
      B.box(M.metal('#5d4a3e', 0.6), 0.12, 0.9, 30, x, yy + 0.53, Z(29));
    }
    for (const s of [16, 24, 32, 40]) B.box(M.wood('#8a6a4a'), W - 1, 0.25, 0.4, 0, yl + 0.15, Z(s));
    straps(B, Z, [17, 25, 33, 41], yl, yl + 2.9, 6.6);
    for (const [x, s, h] of [[-2, 3, 3], [2, 3, 3.5], [0, 8, 2.5]]) {
      B.box(M.wood('#c9a26b'), 3.6, h, 4, x, yu + h / 2, Z(s));
      for (const f of [-0.45, 0.45]) B.box(M.wood('#a07a52'), 3.7, 0.3, 4.1, x, yu + h / 2 + f * h, Z(s));
    }
  },
  tanker42(B, Z, T, paint) {
    // An oval stainless barrel with rings, a catwalk and domes on top, a ladder at the back.
    const cy = 7.6;
    const g = new THREE.CylinderGeometry(1, 1, T.L - 1.5, 40, 1, false).rotateX(PI / 2).scale(W / 2 - 0.05, 3.2, 1);
    B.add(g, paint, { pos: [0, cy, 0.25] });
    for (const e of [-1, 1]) B.add(new THREE.SphereGeometry(1, 32, 16, 0, PI * 2, 0, PI / 2).rotateX(e > 0 ? PI / 2 : -PI / 2).scale(W / 2 - 0.05, 3.2, 0.9), paint, { pos: [0, cy, 0.25 + e * (T.L - 1.5) / 2] });
    for (let s = 4; s < T.L - 2; s += 6) B.add(new THREE.CylinderGeometry(1, 1, 0.25, 40, 1, true).rotateX(PI / 2).scale(W / 2 + 0.02, 3.26, 1), M.alloy('#eef1f3', 0.1), { pos: [0, cy, Z(s)] });
    for (const s of [10, 21, 32]) {
      B.add(cylGeo(0.95, 0.95, 0.7, 24), M.alloy('#c9ced3', 0.3), { pos: [0, cy + 3.35, Z(s)] });
      B.add(new THREE.SphereGeometry(0.95, 20, 8, 0, PI * 2, 0, PI / 2), M.alloy('#c9ced3', 0.3), { pos: [0, cy + 3.7, Z(s)] });
    }
    B.box(M.alloy('#9aa1a8', 0.5), 1.6, 0.1, T.L - 8, 0, cy + 3.3, Z(T.L / 2));
    for (const sd of [1, -1]) B.tube(galv(), [sd * 1.2, cy + 4.6, Z(5)], [sd * 1.2, cy + 4.6, Z(T.L - 4)], 0.05, 6);
    // Ladder up the back.
    for (const sd of [1, -1]) B.tube(galv(), [sd * 0.7, 3.5, Z(T.L) + 0.2], [sd * 0.7, cy + 3.4, Z(T.L) - 0.3], 0.05, 6);
    for (let k = 1; k < 9; k++) B.tube(galv(), [-0.7, 3.5 + k * 0.9, Z(T.L) + 0.2 - k * 0.055], [0.7, 3.5 + k * 0.9, Z(T.L) + 0.2 - k * 0.055], 0.04, 5);
    // Hose tubes along the side, valves and the spill box underneath.
    for (const sd of [1, -1]) B.add(cylGeo(0.3, 0.3, T.L - 18, 12).rotateX(PI / 2), galv(), { pos: [sd * 3.6, 4.2, Z(T.L / 2 + 2)] });
    B.box(M.alloy('#c9ced3', 0.35), 2.4, 1.0, 2.0, 0, 3.7, Z(T.L / 2));
    B.add(cylGeo(0.25, 0.25, 1.2, 10).rotateZ(PI / 2), M.painted('#e2b31b', 0.4), { pos: [3.1, 3.9, Z(T.L / 2)] });
    // Front and rear subframes (the barrel carries the load itself).
    coupler(B, Z, PLATE);
    B.box(steel(), 2.6, 0.8, 8, 0, PLATE + 0.6, Z(4));
    landingGear(B, Z, 8, PLATE + 0.3);
    B.box(steel(), 3.4, 1.0, 12, 0, 3.6, Z(T.L - 7));
    tandem(B, Z, T.L - 4, { style: 'alloy', frameY: 3.4 });
    rearEnd(B, Z, T.L, { light: 3.7 });
    sideTape(B, Z, 6, T.L - 6, 4.6, W / 2 - 0.05);
  },
  carhauler(B, Z, T, paint, opts) {
    // Two decks of open steel frame on hydraulic posts, six cars aboard.
    const frame = paint;
    const yl = 2.8;
    const yu = 8.2;
    for (const sd of [1, -1]) {
      const x = sd * (W / 2 - 0.2);
      B.box(frame, 0.3, 0.9, T.L, x, yl, 0);
      B.tube(frame, [x, PLATE + 0.4, Z(0)], [x, yl, Z(10)], 0.22, 6);
      B.box(frame, 0.3, 0.6, T.L - 3, x, yu, Z(T.L / 2 + 1.5));
      for (let s = 4; s < T.L - 1; s += 7) {
        B.box(frame, 0.32, yu - yl, 0.32, x, (yu + yl) / 2, Z(s));
        B.add(cylGeo(0.12, 0.12, 2.5, 8), M.chrome(), { pos: [x - sd * 0.15, yu - 1.6, Z(s + 0.4)] });
      }
      for (let s = 2; s < T.L - 2; s += 3.5) B.tube(frame, [x, yl + 0.4, Z(s)], [x, yu - 0.3, Z(s + 3.5)], 0.07, 5);
    }
    // Wheel tracks (open grating) on both decks.
    for (const y of [yl + 0.45, yu + 0.32]) for (const sd of [1, -1]) B.box(M.metal('#5d646c', 0.45), 1.6, 0.08, T.L - 4, sd * 2.4, y, Z(T.L / 2 + 1));
    coupler(B, Z, PLATE);
    landingGear(B, Z, 10, PLATE + 0.2);
    tandem(B, Z, T.L - 4, { frameY: yl - 0.2 });
    rearEnd(B, Z, T.L, { y: 1.6, light: 2.8 });
    // The cars: real models, simplified.
    const r = rng(opts.seed || 7);
    const colours = ['#f4f4f2', '#16181b', '#c4c8cc', '#c8241b', '#2f5fa8', '#6b7076', '#1b2f55', '#7a1a1f'];
    // Low cars go underneath (the top deck is just over them); anything up top.
    const low = CARS.filter((c) => c.L < 17 && c.H < 4.9);
    const any = CARS.filter((c) => c.L < 17.5 && c.H < 6.2);
    const slots = [[yl + 0.5, 13.5, 0.03, low], [yl + 0.5, 30, 0, low], [yl + 2.3, 45.5, -0.06, low], [yu + 0.4, 9, -0.06, any], [yu + 0.4, 26, 0, any], [yu + 0.4, 43, 0.05, any]];
    for (const [y, s, pitch, pick] of slots) {
      const car = pick[Math.floor(r() * pick.length)];
      const cb = carModel(car.id, colours[Math.floor(r() * colours.length)], null, { lod: 'low' });
      const m = new THREE.Matrix4().makeRotationX(pitch).setPosition(0, y, Z(s));
      for (const [mat, geos] of cb.parts) for (const g of geos) B.add(g.applyMatrix4(m), mat);
    }
  },
  container40(B, Z, T, paint) {
    // A gooseneck chassis and a 40 ft corrugated box on its twist locks.
    const yb = 4.9;
    for (const sd of [1, -1]) {
      B.box(steel(), 0.3, 1.2, T.L - 10, sd * 1.6, yb - 0.6, Z(10 + (T.L - 10) / 2));
      B.box(steel(), 0.3, 0.7, 10, sd * 1.6, PLATE + 0.35, Z(5));
    }
    for (const s of [0.5, T.L - 0.6]) B.box(steel(), W - 0.4, 0.4, 0.5, 0, yb - 0.2, Z(s));
    coupler(B, Z, PLATE);
    landingGear(B, Z, 12, yb - 0.6);
    tandem(B, Z, T.L - 4.5, { frameY: yb - 0.4 });
    rearEnd(B, Z, T.L, { light: 3.9 });
    const box = M.wall('rib', paint.color ? '#' + paint.color.getHexString() : '#2a5b9b');
    const h = 8.5;
    const cy = yb + h / 2;
    B.box(box, W - 0.1, h, 40, 0, cy, Z(0.2 + 20));
    // Corner castings, the top and bottom rails, the doors with four lock bars.
    for (const sx of [1, -1]) for (const sy of [yb + 0.25, yb + h - 0.25]) for (const s of [0.4, 40]) B.box(M.metal('#2b2e33', 0.6), 0.6, 0.5, 0.6, sx * (W / 2 - 0.25), sy, Z(s));
    const zr = Z(40.2) + 0.03;
    for (const x of [-3.0, -1.4, 1.4, 3.0]) {
      B.add(cylGeo(0.06, 0.06, h - 0.6, 8), galv(), { pos: [x, cy, zr + 0.12] });
      B.box(galv(), 0.12, 0.8, 0.12, x + 0.25, yb + 3, zr + 0.16);
    }
    B.box(M.plastic('#0b0c0d', 0.9), 0.05, h - 0.4, 0.05, 0, cy, zr + 0.05);
  },
  enddump(B, Z, T, paint) {
    // A half-round tub on a frame, the hoist up its front, a tailgate and the tarp roll.
    const y0 = 4.8;
    const g = new THREE.CylinderGeometry(1, 1, T.L - 3, 40, 1, true, PI / 2, PI).rotateX(-PI / 2).scale(W / 2 - 0.1, 3.6, 1);
    B.add(inside(g), paint, { pos: [0, y0 + 3.6, Z(2 + (T.L - 3) / 2)] });
    B.add(g, paint, { pos: [0, y0 + 3.6, Z(2 + (T.L - 3) / 2)] });
    for (const sd of [1, -1]) B.box(paint, 0.15, 0.6, T.L - 3, sd * (W / 2 - 0.12), y0 + 3.9, Z(2 + (T.L - 3) / 2));
    for (let s = 3; s < T.L - 1; s += 2.5) B.add(new THREE.TorusGeometry(1, 0.025, 4, 30, PI).rotateZ(PI).scale(W / 2 - 0.05, 3.63, 1), M.alloy('#eef1f3', 0.2), { pos: [0, y0 + 3.6, Z(s)] });
    // Front wall and the telescopic hoist.
    B.box(paint, W - 0.3, 4.6, 0.25, 0, y0 + 2.4, Z(2));
    for (let k = 0; k < 4; k++) B.add(cylGeo(0.6 - k * 0.1, 0.6 - k * 0.1, 1.8, 16), M.chrome(), { pos: [0, y0 - 0.6 + k * 1.6, Z(1.3)] });
    // Tailgate.
    B.box(paint, W - 0.4, 4.4, 0.25, 0, y0 + 2.5, Z(T.L - 1));
    B.box(galv(), W - 0.2, 0.3, 0.3, 0, y0 + 4.6, Z(T.L - 1));
    B.add(cylGeo(0.35, 0.35, W - 0.6, 14).rotateZ(PI / 2), M.fabric('#2b2f36'), { pos: [0, y0 + 4.5, Z(2.5)] });
    for (const sd of [1, -1]) B.box(steel(), 0.3, 1.2, T.L - 2, sd * 1.5, y0 - 0.5, Z(1 + (T.L - 2) / 2));
    coupler(B, Z, PLATE);
    landingGear(B, Z, 9, y0 - 0.8);
    tandem(B, Z, T.L - 4, { style: 'alloy', frameY: y0 - 0.9 });
    rearEnd(B, Z, T.L, { light: 3.9 });
  },
};

/** The same surface seen from inside (for open tubs and troughs). */
function inside(g) {
  const m = g.clone();
  const n = m.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
  const idx = m.index.array;
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  return m;
}

/* ------------------------------------------------------------ public */

export function isTrailer(id) { return !!BUILD[id] && !!TRAILER_BY_ID[id]; }

/** One trailer, its front at -L/2, as a Builder. */
export function trailerModel(id, color, paintOverride = null, opts = {}) {
  const T = TRAILER_BY_ID[id];
  const B = new Builder();
  if (!T) return B;
  const Z = (s) => -T.L / 2 + s;
  const paint = paintOverride || (id === 'tanker42' && (!color || color === T.color) ? M.alloy('#d9dde0', 0.14) : M.painted(color || T.color, 0.45));
  BUILD[id](B, Z, T, paint, opts);
  return B;
}

/** Move everything in a builder along z. */
export function shiftBuilder(B, dz) {
  for (const geos of B.parts.values()) for (const g of geos) g.translate(0, 0, dz);
  return B;
}
