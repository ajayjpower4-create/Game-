/* Semi tractors, by make and model.
 *
 * Everything a highway tractor carries is here: ladder-frame rails and cross
 * members, a steer axle on leaf springs, an air-ride drive tandem on dual
 * wheels, polished aluminium wheels with hub and nut covers, fuel tanks on
 * straps, cab steps and grab handles, the fifth wheel, the deck plate with
 * its coiled air lines, quarter fenders and mud flaps with chrome weights,
 * west-coast and hood mirrors, marker lights, horns, stacks and air cleaners.
 * Aero trucks (sloping bonnet, roof fairing, chassis skirts) and classics
 * (long square bonnet, separate wings, sun visor, chrome) share the chassis.
 *
 * Frame: x across, y up, front at -z (as every vehicle in the game); `s` is
 * feet back from the front bumper. */

import * as THREE from 'three';
import { Builder, boxGeo, cylGeo } from './builder.js';
import * as M from './materials.js';
import { TRUCK_BY_ID } from '../vehiclelist.js';
import { Shell, Skin, loft, decal, ribbon, stud, mirrored, plate, badge, lettering, roundRect, ellipse, gapMat, BLACK, spline, carWheel } from './cars.js';

const PI = Math.PI;
const R = 1.7;          // 295/75R22.5 tyre radius
const TW = 0.97;        // tyre width
const RIM = 0.94;       // 22.5 in rim

/* Bright-work on the big flat parts (bumpers, grille shells) is polished
 * alloy: true chrome there only mirrors the ground and reads bronze. */
const BRIGHT = () => M.alloy('#e4e8eb', 0.16);

let LINER = null;
/** The inside of the cab, drawn from within only, so the shell can't be seen through. */
function liner() {
  if (!LINER) LINER = new THREE.MeshStandardMaterial({ color: new THREE.Color('#3b3d41'), roughness: 0.92, side: THREE.BackSide });
  return LINER;
}

/* ================================================================ sections */

/** A rounded box section (right half, 13 points: bottom centre round to top centre). */
function roundBox(hw, y0, y1, rb, rt, crown = 0.06) {
  rb = Math.min(rb, (y1 - y0) * 0.3, hw * 0.4);
  rt = Math.min(rt, (y1 - y0) * 0.45, hw * 0.45);
  const pts = [[0, y0], [Math.max(0.01, hw - rb), y0]];
  for (const a of [0.35, 0.75]) pts.push([hw - rb + Math.sin((a * PI) / 2) * rb, y0 + rb - Math.cos((a * PI) / 2) * rb]);
  pts.push([hw, y0 + rb]);
  const ys0 = y0 + rb;
  const ys1 = Math.max(ys0 + 0.01, y1 - rt);
  for (const f of [0.33, 0.66]) pts.push([hw, ys0 + (ys1 - ys0) * f]);
  pts.push([hw, ys1]);
  for (const a of [0.3, 0.7]) pts.push([hw - rt + Math.cos((a * PI) / 2) * rt, ys1 + Math.sin((a * PI) / 2) * rt]);
  pts.push([hw - rt, y1]);
  pts.push([(hw - rt) * 0.5, y1 + crown * 0.75]);
  pts.push([0, y1 + crown]);
  return pts;
}

/** A shell from keyed lines along s (feet from the bumper). */
function boxShell(T, s0, s1, { hw, y0, y1, rb, rt, crown = 0.06, step = 0.25, breaks = [] }) {
  const sh = new Shell();
  const set = new Set([s0, s1, ...breaks.filter((b) => b > s0 && b < s1)]);
  for (let s = s0; s < s1; s += step) set.add(+s.toFixed(4));
  for (const k of [0.04, 0.12]) { set.add(s0 + k); set.add(s1 - k); }
  for (const s of [...set].sort((a, b) => a - b)) {
    const z = -T.L / 2 + s;
    sh.add(z, roundBox(hw(s), y0(s), y1(s), rb(s), rt(s), crown), { t: s });
  }
  return sh;
}

/* ================================================================ chassis */

function chassis(B, T, o) {
  const Z = (s) => -T.L / 2 + s;
  const rail = M.metal('#1d1f22', 0.55);
  const steel = M.metal('#2a2d31', 0.5);
  const sF = T.fo;
  const sD = T.fo + T.wb;
  const sA = [sD - 2.17, sD + 2.17];
  // Frame rails (C-channels) and cross members.
  for (const s of [1, -1]) {
    B.box(rail, 0.06, 0.95, T.L - 1.0, s * 1.42, 3.45, Z(0.6 + (T.L - 1.0) / 2));
    for (const dy of [-0.45, 0.45]) B.box(rail, 0.3, 0.06, T.L - 1.0, s * 1.29, 3.45 + dy, Z(0.6 + (T.L - 1.0) / 2));
  }
  for (const s of [3, sF + 3, T.bbc + 1, sA[0] - 1.2, sD, sA[1] + 1.2, T.L - 0.35]) B.box(steel, 2.8, 0.5, 0.25, 0, 3.45, Z(s));
  // Steer axle: I-beam, leaf springs, shocks.
  B.box(steel, 6.6, 0.42, 0.32, 0, R - 0.05, Z(sF));
  for (const s of [1, -1]) {
    for (let k = 0; k < 4; k++) B.box(M.metal('#1b1d20', 0.6), 0.32, 0.07, 4.6 - k * 0.6, s * 1.42, R + 0.35 + k * 0.08, Z(sF));
    B.add(cylGeo(0.12, 0.12, 1.4, 8).rotateZ(s * 0.25), M.metal('#3a3e43', 0.4), { pos: [s * 1.8, R + 0.8, Z(sF + 0.7)] });
  }
  // Drive tandem: axle housings with the differential bulge, air bags, torque rods.
  for (const s of sA) {
    B.add(cylGeo(0.26, 0.26, 6.5, 12).rotateZ(PI / 2), steel, { pos: [0, R, Z(s)] });
    B.add(new THREE.SphereGeometry(0.75, 16, 12).scale(1, 1, 1.2), steel, { pos: [0, R, Z(s)] });
    for (const x of [1, -1]) {
      B.add(cylGeo(0.45, 0.45, 0.7, 14), M.rubber(), { pos: [x * 1.42, R + 0.85, Z(s + 1.1)] });
      B.box(steel, 0.35, 0.3, 2.8, x * 1.42, R + 0.35, Z(s + 0.4));
    }
    B.box(steel, 0.18, 0.18, 2.4, 0.5, R + 0.6, Z(s - 1.0), [0.25, 0, 0]);
  }
  // Wheels: polished steers, duals on the drives.
  const wheel = { style: 'truck', rimR: RIM, rimColor: '#dfe3e7', rough: 0.12, caliper: false, nuts: 0 };
  const plain = { style: 'steel', rimR: RIM, rimColor: '#3a3e43', rough: 0.5, caliper: false, nuts: 0 };
  const xs = T.W / 2 - TW / 2 - 0.05;
  for (const sd of [1, -1]) {
    carWheel(B, sd * (xs - 0.15), R, Z(sF), R, TW, sd, wheel);
    for (const s of sA) {
      carWheel(B, sd * xs, R, Z(s), R, TW, sd, o.drives === 'steel' ? plain : wheel);
      carWheel(B, sd * (xs - TW - 0.14), R, Z(s), R, TW, -sd, plain);
    }
  }
  // Fifth wheel, its slide and the deck plate with the air lines.
  const fz = Z(sD - 0.7);
  const fifth = new THREE.Shape();
  fifth.moveTo(-1.5, -1.3); fifth.lineTo(1.5, -1.3); fifth.lineTo(1.5, 1.4); fifth.lineTo(0.22, 1.4); fifth.lineTo(0.12, 0.1);
  fifth.lineTo(-0.12, 0.1); fifth.lineTo(-0.22, 1.4); fifth.lineTo(-1.5, 1.4); fifth.closePath();
  const fg = new THREE.ExtrudeGeometry(fifth, { depth: 0.2, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 1 });
  fg.rotateX(-PI / 2).rotateX(0.04).translate(0, 4.15, fz);
  B.add(fg, M.metal('#151618', 0.4));
  for (const s of [1, -1]) B.box(steel, 0.35, 0.45, 2.2, s * 1.2, 3.95, fz);
  const deck0 = T.bbc + T.sleeper + 0.4;
  if (deck0 < sD - 2.2) {
    B.box(M.alloy('#aeb4ba', 0.45), 3.0, 0.06, sD - 2.2 - deck0, 0, 3.98, Z((deck0 + sD - 2.2) / 2));
    // The pogo stick and its coiled lines: red emergency, blue service, green electrical.
    const pz = Z(deck0 + 0.4);
    B.add(cylGeo(0.05, 0.05, 2.6, 8), M.chrome(), { pos: [0.8, 5.3, pz] });
    // Each line a coil running back from the pogo, sagging a little.
    [['#c8241b', 0.35], ['#2a5bd0', -0.1], ['#2e8b3a', -0.55]].forEach(([c, dx]) => {
      for (let k = 0; k < 9; k++) {
        const sag = Math.sin((k / 8) * PI) * 0.18;
        B.add(new THREE.TorusGeometry(0.19, 0.028, 5, 14), M.plastic(c, 0.5), { pos: [0.8 + dx, 6.2 - sag - k * 0.02, pz + 0.2 + k * 0.1], rot: [0, 0.12, 0] });
      }
      B.add(cylGeo(0.035, 0.035, 0.5, 6).rotateX(PI / 2), M.plastic(c, 0.5), { pos: [0.8 + dx, 6.3, pz] });
    });
    B.box(M.metal('#2a2d31', 0.5), 0.8, 0.12, 0.12, 0.6, 6.35, pz);
  }
  // Quarter fenders over the drives, mud flaps with chrome weights, tail lamps.
  const fender = o.fenderMat || M.pianoBlack();
  for (const sd of [1, -1]) {
    for (const s of sA) {
      // Over the top of the duals: theta measured from +z, so 0.18-0.82 pi is the crown.
      const g = new THREE.CylinderGeometry(R + 0.22, R + 0.22, 2.3, 28, 1, true, PI * 0.18, PI * 0.64).rotateZ(PI / 2);
      B.add(g, fender, { pos: [sd * (xs - TW / 2 - 0.07), R, Z(s)] });
    }
    B.box(M.rubber(), 2.2, 2.5, 0.05, sd * (xs - 0.5), 1.65, Z(sA[1] + R + 0.45));
    B.box(M.chrome(), 2.2, 0.22, 0.08, sd * (xs - 0.5), 0.5, Z(sA[1] + R + 0.45));
    B.box(M.lamp('#ff2a1a', 4), 0.55, 0.3, 0.08, sd * 1.1, 3.0, Z(T.L - 0.25));
    B.box(M.tailLens('#c46a12'), 0.3, 0.2, 0.08, sd * 1.65, 3.0, Z(T.L - 0.25));
  }
  B.box(M.metal('#1d1f22', 0.55), 3.4, 0.5, 0.25, 0, 3.0, Z(T.L - 0.35));
  B.add(new THREE.PlaneGeometry(1.0, 0.5).translate(0, 3.6, Z(T.L - 0.2)), plate());
}

/** Fuel tanks on straps, either side under the cab, with steps on their fronts. */
function fuelTanks(B, T, s0, len, { r = 1.05, mat = M.alloy('#d5dade', 0.16), steps = true, skip = 0 } = {}) {
  const Z = (s) => -T.L / 2 + s;
  for (const sd of [1, -1]) {
    if (skip === sd) continue;
    const x = sd * 3.05;
    B.add(cylGeo(r, r, len, 28).rotateX(PI / 2), mat, { pos: [x, 2.55, Z(s0 + len / 2)] });
    for (const e of [0, len]) B.add(new THREE.SphereGeometry(r, 24, 10).scale(1, 1, 0.12), mat, { pos: [x, 2.55, Z(s0 + e)] });
    for (const f of [0.18, 0.82]) B.add(cylGeo(r + 0.03, r + 0.03, 0.18, 28, true).rotateX(PI / 2), M.pianoBlack(), { pos: [x, 2.55, Z(s0 + len * f)] });
    B.add(cylGeo(0.2, 0.2, 0.15, 14), M.chrome(), { pos: [x + sd * 0.3, 2.55 + r, Z(s0 + len * 0.62)] });
    for (const f of [0.18, 0.82]) B.box(M.metal('#1d1f22', 0.5), 1.6, 0.25, 0.25, sd * 2.1, 2.0, Z(s0 + len * f));
    if (steps) {
      for (const y of [1.3, 2.2]) B.box(M.alloy('#aeb4ba', 0.45), 0.85, 0.1, 1.5, sd * 3.95, y, Z(s0 - 0.6));
      B.box(M.metal('#1d1f22', 0.5), 0.12, 1.4, 1.5, sd * 4.35, 1.75, Z(s0 - 0.6));
    }
  }
}

/** West-coast mirrors on the doors and convex mirrors on the wings. */
function mirrors(B, T, s, { hood = null, y = 7.6 } = {}) {
  const z = -T.L / 2 + s;
  const arm = M.chrome();
  for (const sd of [1, -1]) {
    const xb = sd * 3.95;
    const xm = sd * 4.85;
    B.add(cylGeo(0.05, 0.05, 1.0, 8).rotateZ(PI / 2), arm, { pos: [(xb + xm) / 2, y + 0.75, z] });
    B.add(cylGeo(0.05, 0.05, 1.0, 8).rotateZ(PI / 2), arm, { pos: [(xb + xm) / 2, y - 0.85, z] });
    B.add(cylGeo(0.04, 0.04, 1.7, 8), arm, { pos: [xm, y, z] });
    B.box(M.pianoBlack(), 0.16, 1.35, 0.6, xm + sd * 0.12, y + 0.05, z + 0.05);
    B.box(M.chrome(), 0.02, 1.25, 0.5, xm + sd * 0.12, y + 0.05, z + 0.36);
    B.box(M.pianoBlack(), 0.16, 0.42, 0.5, xm + sd * 0.12, y - 0.95, z + 0.05);
    if (hood) {
      const [hs, hy, hx] = hood;
      B.add(cylGeo(0.035, 0.035, 0.7, 6), arm, { pos: [sd * hx, hy + 0.35, -T.L / 2 + hs] });
      B.add(new THREE.SphereGeometry(0.22, 12, 8).scale(1, 1, 0.6), M.pianoBlack(), { pos: [sd * hx, hy + 0.75, -T.L / 2 + hs] });
    }
  }
}

/** Amber clearance lights in a row. */
function markers(B, T, s, y, half, n = 5, { lit = false } = {}) {
  const z = -T.L / 2 + s;
  const mat = lit ? M.lamp('#ffa31a', 3) : M.tailLens('#d6820f');
  for (let k = 0; k < n; k++) {
    const x = -half + (2 * half * k) / (n - 1);
    B.add(new THREE.SphereGeometry(0.11, 10, 6, 0, PI * 2, 0, PI / 2).scale(1.4, 0.8, 1), mat, { pos: [x, y, z] });
  }
}

/** Chrome stacks: straight pipes with heat shields and mitred tops. */
function stacks(B, T, s, top, { x = 3.55, single = false } = {}) {
  const z = -T.L / 2 + s;
  for (const sd of single ? [1] : [1, -1]) {
    B.add(cylGeo(0.3, 0.3, top - 4.0, 18), M.chrome(), { pos: [sd * x, 4.0 + (top - 4.0) / 2, z] });
    B.add(cylGeo(0.36, 0.36, 3.0, 18, true), M.alloy('#c2c7cc', 0.3), { pos: [sd * x, 6.5, z] });
    B.add(cylGeo(0.3, 0.3, 0.6, 18, true).rotateX(-0.6), M.chrome(), { pos: [sd * x, top + 0.2, z + 0.15] });
    for (const y of [5.2, 7.8, top - 1.5]) B.box(M.metal('#1d1f22', 0.5), 0.12, 0.12, 0.7, sd * x, y, z - 0.45);
  }
}

/** Round chrome air cleaners standing either side of the cowl. */
function airCleaners(B, T, s, { y0 = 4.6, h = 3.1, r = 0.78, x = 3.15 } = {}) {
  const z = -T.L / 2 + s;
  for (const sd of [1, -1]) {
    B.add(cylGeo(r, r, h, 28), M.chrome(), { pos: [sd * x, y0 + h / 2, z] });
    B.add(new THREE.SphereGeometry(r, 24, 8, 0, PI * 2, 0, PI / 2), M.chrome(), { pos: [sd * x, y0 + h, z] });
    for (const f of [0.2, 0.8]) B.add(cylGeo(r + 0.03, r + 0.03, 0.12, 28, true), M.pianoBlack(), { pos: [sd * x, y0 + h * f, z] });
    B.add(cylGeo(0.35, 0.35, 1.0, 14).rotateX(PI / 2), M.chrome(), { pos: [sd * x * 0.8, y0 + h * 0.3, z + 0.7] });
  }
}

function horns(B, T, s, y) {
  const z = -T.L / 2 + s;
  for (const [x, l] of [[0.9, 2.2], [1.25, 1.7]]) {
    B.add(new THREE.CylinderGeometry(0.18, 0.05, l, 14, 1, true).rotateX(PI / 2), M.chrome(), { pos: [x, y, z + l / 2] });
    B.add(cylGeo(0.05, 0.05, 0.4, 6), M.chrome(), { pos: [x, y - 0.25, z + l * 0.6] });
  }
}

/** Grab handles beside a cab door. */
function grabs(B, T, s, y0, y1) {
  for (const sd of [1, -1]) B.add(cylGeo(0.04, 0.04, y1 - y0, 8), M.chrome(), { pos: [sd * 4.02, (y0 + y1) / 2, -T.L / 2 + s] });
}

/* ================================================================ cabs */

/**
 * The cab and sleeper of an aero truck as one shell: a raked windscreen, the
 * cab roof, a fairing rising to the sleeper roof and a rounded back. Glass
 * in the windscreen; door and sleeper windows laid on as decals.
 */
function aeroCab(B, T, paint, cx, k) {
  const sC = k.cowl;
  const sW = sC + k.ws;
  const sEnd = T.bbc + T.sleeper;
  const top = spline([
    [sC - 0.4, k.cowlY], [sC, k.cowlY + 0.05], [sW, k.roof - 0.25], [sW + 0.6, k.roof], [T.bbc - 2.6, k.roof + 0.05],
    [T.bbc - 0.6, T.H - 0.5], [T.bbc + 0.6, T.H], [sEnd - 0.4, T.H], [sEnd, T.H - 0.35],
  ]);
  const shell = boxShell(T, sC - 0.4, sEnd, {
    hw: (s) => (s < sC + 0.8 ? 3.75 + 0.2 * Math.min(1, (s - sC + 0.4) / 1.2) : 3.95),
    y0: () => 3.95, y1: top, rb: () => 0.2, rt: (s) => (s < sW + 0.5 ? 0.55 : 0.45), crown: 0.08, step: 0.2, breaks: [sC, sW],
  });
  const glass = M.carGlass('#0a1016', 0.72);
  const st = shell.st;
  loft(B, shell, (i, j) => {
    const s = (st[i].t + st[i + 1].t) / 2;
    if (s > sC && s < sW && j >= 10) return glass;
    if (j <= 1) return M.plastic('#141517', 0.9);
    return paint;
  }, { caps: true, capMat: paint });
  return { shell, top, sW };
}

/** A classic square cab with a two-piece flat windscreen and a sleeper box behind. */
function classicCab(B, T, paint, cx, k) {
  const sC = k.cowl;
  const sW = sC + k.ws;
  const sEnd = T.bbc + T.sleeper;
  const keys = [[sC - 0.3, k.cowlY], [sC, k.cowlY + 0.05], [sW, k.roof - 0.1], [sW + 0.3, k.roof], [T.bbc - 0.25, k.roof]];
  if (k.raised) keys.push([T.bbc + 0.3, k.roof + 0.6], [T.bbc + 1.6, T.H], [sEnd - 0.3, T.H], [sEnd, T.H - 0.2]);
  else keys.push([T.bbc - 0.1, k.roof + 0.05], [T.bbc + 0.05, T.H], [sEnd - 0.2, T.H], [sEnd, T.H - 0.15]);
  const top = spline(keys);
  const shell = boxShell(T, sC - 0.3, sEnd, {
    hw: () => 3.9, y0: () => 4.0, y1: top, rb: () => 0.15, rt: () => 0.25, crown: 0.05, step: 0.2, breaks: [sC, sW, T.bbc],
  });
  const glass = M.carGlass('#0a1016', 0.72);
  const st = shell.st;
  loft(B, shell, (i, j) => {
    const s = (st[i].t + st[i + 1].t) / 2;
    if (s > sC && s < sW && j >= 10) return glass;
    if (j <= 1) return M.plastic('#141517', 0.9);
    return paint;
  }, { caps: true, capMat: paint });
  return { shell, top, sW };
}

/** Door and sleeper windows, door shut lines, the cab steps' handles. */
function cabSides(B, T, cx, cab, k) {
  const Z = (s) => -T.L / 2 + s;
  const sC = k.cowl;
  const win = M.carGlass('#0a1016', 0.78);
  const dTop = k.roof - 0.45;
  const door = [[Z(sC + 0.35), 6.65], [Z(sC + 3.55), 6.65], [Z(sC + 3.55), dTop], [Z(sC + k.ws * 0.75 + 0.35), dTop]];
  decal(B, win, cx.skin, 'side', door, { off: 0.012 });
  ribbon(B, M.pianoBlack(), cx.skin, 'side', door, 0.08, { off: 0.016, closed: true });
  // The door's own outline and its handle.
  ribbon(B, gapMat(), cx.skin, 'side', [[Z(sC + 0.15), 4.2], [Z(sC + 0.15), 6.5], [Z(sC + k.ws * 0.7 + 0.2), k.roof - 0.15], [Z(sC + 3.8), k.roof - 0.15], [Z(sC + 3.8), 4.2]], 0.03, { off: 0.004 });
  B.box(M.chrome(), 0.08, 0.12, 0.7, 4.0, 6.2, Z(sC + 3.3));
  B.box(M.chrome(), 0.08, 0.12, 0.7, -4.0, 6.2, Z(sC + 3.3));
  // Sleeper windows.
  if (k.sleeperWindow !== false) {
    const sw = T.bbc + T.sleeper * 0.45;
    decal(B, win, cx.skin, 'side', roundRect(Z(sw), 8.4, 1.4, 0.8, 0.15), { off: 0.012 });
  }
  // The luggage door into the sleeper, under its window.
  const ls = T.bbc + 0.45;
  ribbon(B, gapMat(), cx.skin, 'side', roundRect(Z(ls + 1.05), 5.45, 2.1, 1.9, 0.18), 0.03, { off: 0.004, closed: true });
  for (const sd of [1, -1]) B.box(M.chrome(), 0.06, 0.1, 0.5, sd * 3.99, 6.05, Z(ls + 1.75));
  // Grab handles either side of the door, steps under it.
  grabs(B, T, sC + 0.08, 4.8, 8.0);
  grabs(B, T, sC + 3.75, 4.6, 7.2);
  // Wiper blades parked at the foot of the screen.
  for (const x0 of [-3.1, -0.45]) ribbon(B, M.pianoBlack(), cx.skin, 'front', [[x0, k.cowlY + 0.28], [x0 + 2.1, k.cowlY + 0.5]], 0.07, { off: 0.03, mirror: false });
  interior(B, T, k);
}

/** What shows through the windscreen: dashboard, the big flat steering wheel,
 *  air-ride seats, the engine tunnel and the curtain to the sleeper. */
function interior(B, T, k) {
  const Z = (s) => -T.L / 2 + s;
  const s0 = k.cowl - 0.25;
  const s1 = T.bbc - 0.1;
  const top = k.roof - 0.15;
  B.box(liner(), 7.5, top - 4.05, s1 - s0, 0, (top + 4.05) / 2, Z((s0 + s1) / 2));
  const dash = M.upholstery('#1a1b1e', 0.7);
  const dTop = k.cowlY - 0.15;
  B.box(dash, 7.1, dTop - 4.1, 1.4, 0, (dTop + 4.1) / 2, Z(k.cowl + 0.6));
  B.box(M.pianoBlack(), 2.2, 0.75, 0.08, -1.7, dTop + 0.1, Z(k.cowl + 1.2), [-0.35, 0, 0]);
  B.box(M.upholstery('#26282c', 0.7), 1.6, 1.1, 0.5, 0.2, dTop - 0.35, Z(k.cowl + 1.5));
  // Steering wheel, nearly flat, on the left.
  const ws = k.cowl + 2.05;
  B.add(new THREE.TorusGeometry(0.8, 0.07, 8, 28).rotateX(PI / 2 - 0.55), M.upholstery('#121315', 0.6), { pos: [-1.75, dTop + 0.15, Z(ws)] });
  B.add(cylGeo(0.09, 0.09, 1.3, 8).rotateX(-0.55), dash, { pos: [-1.75, dTop - 0.25, Z(ws - 0.45)] });
  B.add(new THREE.CylinderGeometry(0.22, 0.22, 0.12, 14).rotateX(PI / 2 - 0.55), M.upholstery('#121315', 0.6), { pos: [-1.75, dTop + 0.15, Z(ws)] });
  // Seats on their air-ride bases, the engine tunnel between.
  const seat = M.upholstery('#3a3631', 0.88);
  for (const x of [-1.75, 1.85]) {
    const zs = Z(k.cowl + 3.0);
    B.box(M.metal('#2a2d31', 0.5), 1.1, 0.9, 1.1, x, 4.55, zs);
    B.box(seat, 1.85, 0.45, 1.9, x, 5.2, zs);
    B.box(seat, 1.8, 2.4, 0.45, x, 6.5, zs + 1.0, [-0.12, 0, 0]);
    B.box(seat, 1.0, 0.6, 0.35, x, 8.0, zs + 1.15, [-0.08, 0, 0]);
  }
  B.box(M.upholstery('#2a2c30'), 1.6, 1.0, 2.6, 0.05, 4.55, Z(k.cowl + 2.6));
  B.box(M.fabric('#4a4640'), 7.3, top - 4.3, 0.1, 0, (top + 4.3) / 2, Z(s1 - 0.08));
}

/** An aero bonnet's shut line (it tilts forward with its wings) and side vents. */
function aeroDetails(B, T, cx, k) {
  const Z = (s) => -T.L / 2 + s;
  ribbon(B, gapMat(), cx.skin, 'side', [[Z(k.cowl - 0.3), k.cowlY - 0.1], [Z(k.cowl - 0.45), 4.7], [Z(T.fo + R + 0.6), 3.75], [Z(T.fo + R + 0.6), 3.1]], 0.035, { off: 0.004 });
  for (let i = 0; i < 5; i++) {
    const y = 4.7 + i * 0.17;
    ribbon(B, M.pianoBlack(), cx.skin, 'side', [[Z(k.cowl - 2.6 + i * 0.12), y], [Z(k.cowl - 1.2 + i * 0.05), y]], 0.08, { off: 0.008 });
  }
}

/** Battery box and tool box under a classic's sleeper, with tread-plate lids. */
function sideBoxes(B, T) {
  const Z = (s) => -T.L / 2 + s;
  const s0 = T.bbc + 0.45;
  const len = Math.min(2.4, T.fo + T.wb - 2.17 - R - 0.6 - s0);
  if (len < 1) return;
  for (const sd of [1, -1]) {
    B.box(M.painted('#1b1d20', 0.5), 1.5, 1.7, len, sd * 3.35, 2.45, Z(s0 + len / 2));
    B.box(M.alloy('#b9bfc5', 0.4), 1.6, 0.08, len + 0.1, sd * 3.35, 3.34, Z(s0 + len / 2));
    B.box(M.chrome(), 0.05, 0.12, 0.6, sd * 4.11, 2.9, Z(s0 + len / 2));
  }
}

/* ================================================================ bonnets */

/** An aero bonnet: bumper, grille and wings in one piece, round the steer wheels. */
function aeroHood(B, T, paint, k) {
  const L = T.L;
  const sh = new Shell();
  const top = spline(k.top);
  const side = spline(k.side);
  const bot = spline(k.bottom);
  const plan = spline(k.plan);
  const sF = T.fo;
  const Ra = R + 0.32;
  const ts = new Set();
  for (let s = 0; s <= k.end; s += 0.12) ts.add(+s.toFixed(3));
  for (const s of [0.02, 0.05, 0.1, k.end]) ts.add(s);
  for (const d of [-1, 1]) { ts.add(sF + d * Ra - 0.01); ts.add(sF + d * Ra + 0.01); }
  for (let q = -8; q <= 8; q++) ts.add(sF + (Ra * q) / 8.6);
  for (const s of [...ts].filter((v) => v >= 0 && v <= k.end).sort((a, b) => a - b)) {
    const z = -L / 2 + s;
    const hw = 4.15 * plan(s);
    const dz = s - sF;
    const arch = Math.abs(dz) < Ra ? { y: R + Math.sqrt(Ra * Ra - dz * dz), depth: 1.9 } : null;
    sh.add(z, hoodSection(hw, top(s), side(s), bot(s), arch, k), { t: s, arch: !!arch });
  }
  const st = sh.st;
  const under = M.plastic('#141517', 0.9);
  loft(B, sh, (i, j) => {
    const arch = st[i].arch || st[i + 1].arch;
    if (j === 0) return under;
    if (j <= 2) return arch ? under : paint;
    return paint;
  }, { caps: true, capMat: paint });
  return sh;
}

/** A bonnet section (16 points), like a car's but with a flatter top. */
function hoodSection(hw, yTop, ySh, yBot, arch, k) {
  const shR = k.shR ?? 0.35;
  const pts = [[0, yBot]];
  let y0 = yBot + 0.15;
  if (arch) {
    const ay = Math.min(arch.y, ySh - shR - 0.06);
    y0 = ay;
    pts.push([hw - arch.depth, yBot], [hw - arch.depth, ay], [hw - 0.03, ay]);
  } else {
    pts.push([hw - 0.18, yBot], [hw - 0.04, yBot + 0.06], [hw, y0]);
  }
  const yS = ySh - shR;
  for (const s of [0.25, 0.5, 0.75, 1]) pts.push([hw * (1 - 0.02 * s), y0 + (yS - y0) * s]);
  const xT = hw * 0.98;
  for (const a of [0.45, 0.95]) pts.push([xT - shR + Math.cos(a) * shR, yS + Math.sin(a) * shR]);
  pts.push([xT - shR, ySh]);
  const xs = Math.max(0.01, xT - shR);
  for (const f of [0.8, 0.6, 0.4, 0.2, 0]) pts.push([xs * f, yTop + (ySh - yTop) * f * f]);
  return pts;
}

/** A classic long bonnet: a square box between the wings, crisp edges. */
function classicHood(B, T, paint, k) {
  const sh = boxShell(T, 0.35, k.end, {
    hw: (s) => k.hoodW / 2 + (k.taper || 0) * (s / k.end), y0: () => k.hoodBottom, y1: (s) => k.hoodY + 0.25 * (s / k.end) + (s < 0.6 ? -0.1 * (0.6 - s) : 0),
    rb: () => 0.15, rt: () => k.hoodR ?? 0.3, crown: 0.05, step: 0.3,
  });
  loft(B, sh, (i, j) => (j <= 1 ? M.plastic('#141517', 0.9) : paint), { caps: true, capMat: paint });
  return sh;
}

/** Separate wings over the steer wheels, sweeping down to the steps. */
function classicFenders(B, T, paint, k) {
  const sF = T.fo;
  const Ra = R + 0.32;
  const front = k.wingFront ?? 0.5;
  const back = k.wingBack ?? sF + 3.2;
  const topY = R + Ra + (k.wingRise ?? 0.35);
  const shape = new THREE.Shape();
  // Side view, in (-s, y) so the extrusion lands the right way round.
  shape.moveTo(-front, k.wingLow ?? 2.9);
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const th = PI - (i / N) * PI;
    const s = sF + Math.cos(th) * (Ra + 0.75);
    const y = R + Math.sin(th) * (Ra + 0.75);
    shape.lineTo(-Math.max(front, Math.min(back, s)), Math.min(topY, Math.max(2.9, y)));
  }
  shape.lineTo(-back, k.wingBackY ?? 3.4);
  shape.lineTo(-back, 2.8);
  for (let i = N; i >= 0; i--) {
    const th = PI - (i / N) * PI;
    shape.lineTo(-(sF + Math.cos(th) * Ra), Math.max(2.4, R + Math.sin(th) * Ra));
  }
  shape.lineTo(-front, 2.4);
  shape.closePath();
  const wd = 4.15 - k.hoodW / 2 + 0.05;
  const g = new THREE.ExtrudeGeometry(shape, { depth: wd, bevelEnabled: true, bevelSize: k.wingBevel ?? 0.18, bevelThickness: k.wingBevel ?? 0.18, bevelSegments: 4, curveSegments: 6 });
  g.rotateY(PI / 2);
  g.translate(k.hoodW / 2 - 0.05, 0, -T.L / 2);
  B.add(g, paint);
  B.add(mirrored(g), paint);
}

/* ================================================================ the models */

const TMODELS = {};

/* Freightliner Cascadia: the long-haul aero truck — a sloping bonnet with
 * swept lamps, a wide chrome grille, a one-piece screen and chassis skirts. */
TMODELS['freightliner-cascadia'] = (B, T, paint, o) => {
  const k = {
    cowl: 6.6, ws: 1.5, cowlY: 6.4, roof: 9.85,
    top: [[0, 4.65], [0.2, 5.25], [0.6, 5.5], [3.5, 5.95], [6.2, 6.35], [7.0, 6.45]],
    side: [[0, 4.35], [0.4, 5.05], [3.5, 5.6], [7.0, 6.2]],
    bottom: [[0, 1.4], [0.6, 1.35], [1.6, 1.6], [6.0, 2.9], [7.0, 3.3]],
    plan: [[0, 0.84], [0.25, 0.92], [0.9, 0.97], [3, 0.98], [7, 0.96]], end: 7.0, shR: 0.45,
  };
  const hood = aeroHood(B, T, paint, k);
  const cab = aeroCab(B, T, paint, null, k);
  const cx = { skin: new Skin([hood, cab.shell]) };
  // Grille, lamps, bumper.
  decal(B, BRIGHT(), cx.skin, 'front', [[-1.95, 5.0], [1.95, 5.0], [1.7, 2.75], [-1.7, 2.75]], { off: 0.02, mirror: false });
  decal(B, M.grilleMesh('#2b2e33'), cx.skin, 'front', [[-1.75, 4.85], [1.75, 4.85], [1.55, 2.9], [-1.55, 2.9]], { off: 0.03, mirror: false });
  for (let y = 3.15; y < 4.8; y += 0.32) ribbon(B, BRIGHT(), cx.skin, 'front', [[-1.7, y], [1.7, y]], 0.08, { off: 0.04, raise: 0.03, mirror: false });
  badge(B, cx, 'front', 0, 5.25, 0.28);
  decal(B, M.pianoBlack(), cx.skin, 'front', [[2.1, 5.1], [3.6, 4.85], [3.95, 4.3], [3.7, 4.05], [2.2, 4.4]], { off: 0.015 });
  decal(B, M.lens(), cx.skin, 'front', [[2.1, 5.1], [3.6, 4.85], [3.95, 4.3], [3.7, 4.05], [2.2, 4.4]], { off: 0.04 });
  for (const x of [2.6, 3.2]) stud(B, new THREE.SphereGeometry(0.17, 12, 8).scale(1, 1, 0.5), M.reflector(), cx.skin, 'front', x, 4.55, { off: 0.02 });
  ribbon(B, M.led(), cx.skin, 'front', [[2.2, 4.5], [3.65, 4.15]], 0.07, { off: 0.035 });
  decal(B, M.cladding('#1b1d20'), cx.skin, 'front', [[-4.0, 2.4], [4.0, 2.4], [4.0, 1.5], [-4.0, 1.5]], { off: 0.02, mirror: false });
  for (const s of [1, -1]) decal(B, M.led(), cx.skin, 'front', roundRect(s * 3.2, 1.95, 0.6, 0.18, 0.05), { off: 0.04, mirror: false, sub: 1 });
  // Cab sides, roof lights, mirrors, skirts, chassis.
  cabSides(B, T, cx, cab, k);
  aeroDetails(B, T, cx, k);
  markers(B, T, k.cowl + k.ws + 0.4, k.roof + 0.12, 1.6);
  mirrors(B, T, k.cowl + 0.35, { hood: [1.2, 5.5, 3.9] });
  const Z = (s) => -T.L / 2 + s;
  const s0 = k.cowl + 0.3;
  const s1 = T.fo + T.wb - 2.17 - R - 0.4;
  for (const sd of [1, -1]) B.box(paint, 0.12, 2.5, s1 - s0, sd * 4.15, 2.75, Z((s0 + s1) / 2));
  for (const sd of [1, -1]) B.box(paint, 0.1, 8.0, 1.5, sd * 3.98, 8.5, Z(T.bbc + T.sleeper + 0.65));
  fuelTanks(B, T, k.cowl + 0.9, 4.2, { r: 0.95 });
  chassis(B, T, { fenderMat: M.pianoBlack() });
  lettering(B, cx, 'front', 'FREIGHTLINER', 0, 5.55, 2.4);
};

/* Volvo VNL 860: tall and upright — a huge grille crossed by a chrome bar,
 * tall slim lamps at the corners and the tallest sleeper of the lot. */
TMODELS['volvo-vnl'] = (B, T, paint, o) => {
  const k = {
    cowl: 6.3, ws: 1.2, cowlY: 6.6, roof: 10.1,
    top: [[0, 5.2], [0.15, 5.6], [0.5, 5.8], [3.5, 6.15], [6.6, 6.55]],
    side: [[0, 4.9], [0.4, 5.4], [3.5, 5.85], [6.6, 6.35]],
    bottom: [[0, 1.45], [0.6, 1.4], [1.6, 1.6], [5.8, 2.9], [6.6, 3.3]],
    plan: [[0, 0.88], [0.25, 0.94], [0.9, 0.98], [6.6, 0.97]], end: 6.6, shR: 0.4,
  };
  const hood = aeroHood(B, T, paint, k);
  const cab = aeroCab(B, T, paint, null, k);
  const cx = { skin: new Skin([hood, cab.shell]) };
  decal(B, BRIGHT(), cx.skin, 'front', [[-2.0, 5.5], [2.0, 5.5], [1.85, 2.6], [-1.85, 2.6]], { off: 0.02, mirror: false });
  decal(B, M.grilleMesh('#24272b'), cx.skin, 'front', [[-1.82, 5.35], [1.82, 5.35], [1.7, 2.75], [-1.7, 2.75]], { off: 0.03, mirror: false });
  for (let x = -1.5; x <= 1.55; x += 0.3) ribbon(B, M.alloy('#c9ced3', 0.2), cx.skin, 'front', [[x, 2.8], [x, 5.3]], 0.05, { off: 0.04, mirror: false });
  ribbon(B, BRIGHT(), cx.skin, 'front', [[-1.75, 5.2], [1.75, 2.9]], 0.18, { off: 0.06, raise: 0.05, mirror: false });
  badge(B, cx, 'front', 0, 4.05, 0.4);
  const hl = [[2.25, 5.35], [3.5, 5.2], [3.9, 4.7], [3.85, 3.3], [3.4, 3.2], [2.3, 3.5]];
  decal(B, M.pianoBlack(), cx.skin, 'front', hl, { off: 0.015 });
  decal(B, M.lens(), cx.skin, 'front', hl, { off: 0.04 });
  for (const y of [4.7, 4.1]) stud(B, new THREE.SphereGeometry(0.2, 12, 8).scale(1, 1, 0.5), M.reflector(), cx.skin, 'front', 3.0, y, { off: 0.02 });
  ribbon(B, M.led(), cx.skin, 'front', [[2.4, 5.2], [3.45, 5.1], [3.75, 4.6], [3.72, 3.5]], 0.07, { off: 0.035 });
  decal(B, M.cladding('#1b1d20'), cx.skin, 'front', [[-4.0, 2.4], [4.0, 2.4], [4.0, 1.5], [-4.0, 1.5]], { off: 0.02, mirror: false });
  cabSides(B, T, cx, cab, k);
  aeroDetails(B, T, cx, k);
  markers(B, T, T.bbc + 0.5, T.H + 0.08, 2.4, 5);
  mirrors(B, T, k.cowl + 0.35, { hood: [1.0, 5.8, 3.9] });
  const Z = (s) => -T.L / 2 + s;
  const s0 = k.cowl + 0.3;
  const s1 = T.fo + T.wb - 2.17 - R - 0.4;
  for (const sd of [1, -1]) B.box(paint, 0.12, 2.5, s1 - s0, sd * 4.15, 2.75, Z((s0 + s1) / 2));
  for (const sd of [1, -1]) B.box(paint, 0.1, 8.4, 1.5, sd * 3.98, 8.6, Z(T.bbc + T.sleeper + 0.65));
  fuelTanks(B, T, k.cowl + 0.9, 4.2, { r: 0.95 });
  chassis(B, T, { fenderMat: M.pianoBlack() });
  lettering(B, cx, 'front', 'VOLVO', 0, 5.8, 1.6);
};

/* Mack Anthem: a tall, square, chrome-framed grille with vertical bars, lamps
 * low in the bumper corners, and the bulldog on the nose. */
TMODELS['mack-anthem'] = (B, T, paint, o) => {
  const k = {
    cowl: 5.9, ws: 1.25, cowlY: 6.5, roof: 9.9,
    top: [[0, 5.55], [0.12, 5.85], [0.5, 5.95], [3.5, 6.2], [6.2, 6.5]],
    side: [[0, 5.2], [0.4, 5.6], [3.5, 5.9], [6.2, 6.3]],
    bottom: [[0, 1.4], [0.6, 1.35], [1.6, 1.6], [5.4, 2.9], [6.2, 3.3]],
    plan: [[0, 0.9], [0.25, 0.95], [0.9, 0.98], [6.2, 0.97]], end: 6.2, shR: 0.3,
  };
  const hood = aeroHood(B, T, paint, k);
  const cab = aeroCab(B, T, paint, null, k);
  const cx = { skin: new Skin([hood, cab.shell]) };
  decal(B, BRIGHT(), cx.skin, 'front', [[-1.9, 5.7], [1.9, 5.7], [1.9, 2.55], [-1.9, 2.55]], { off: 0.02, mirror: false });
  decal(B, M.grilleMesh('#1d1f22'), cx.skin, 'front', [[-1.7, 5.5], [1.7, 5.5], [1.7, 2.75], [-1.7, 2.75]], { off: 0.03, mirror: false });
  for (let x = -1.55; x <= 1.56; x += 0.22) ribbon(B, BRIGHT(), cx.skin, 'front', [[x, 2.8], [x, 5.45]], 0.08, { off: 0.04, raise: 0.03, mirror: false });
  // The bulldog stands on the bonnet's nose (a small chrome figure).
  B.box(M.chrome(), 0.35, 0.35, 0.8, 0, 6.15, -T.L / 2 + 0.6);
  B.add(new THREE.SphereGeometry(0.2, 12, 8), M.chrome(), { pos: [0, 6.35, -T.L / 2 + 0.25] });
  const hl = [[2.2, 2.85], [3.9, 2.95], [3.95, 2.35], [2.25, 2.3]];
  decal(B, M.pianoBlack(), cx.skin, 'front', hl, { off: 0.015 });
  decal(B, M.lens(), cx.skin, 'front', hl, { off: 0.04 });
  for (const x of [2.7, 3.4]) stud(B, new THREE.SphereGeometry(0.2, 12, 8).scale(1, 1, 0.5), M.reflector(), cx.skin, 'front', x, 2.6, { off: 0.02 });
  ribbon(B, M.led(), cx.skin, 'front', [[2.2, 4.9], [3.6, 4.7], [3.95, 4.3]], 0.08, { off: 0.03 });
  decal(B, BRIGHT(), cx.skin, 'front', [[-4.0, 2.2], [4.0, 2.2], [4.0, 1.5], [-4.0, 1.5]], { off: 0.02, mirror: false });
  cabSides(B, T, cx, cab, k);
  aeroDetails(B, T, cx, k);
  markers(B, T, k.cowl + k.ws + 0.4, k.roof + 0.12, 1.6);
  mirrors(B, T, k.cowl + 0.35, { hood: [1.0, 5.9, 3.9] });
  fuelTanks(B, T, k.cowl + 0.8, 4.4, { r: 1.0 });
  stacks(B, T, T.bbc + T.sleeper + 0.35, T.H + 1.2, { single: true, x: 3.4 });
  chassis(B, T, { fenderMat: M.alloy('#c9ced3', 0.2) });
  lettering(B, cx, 'front', 'MACK', 0, 5.95, 1.0);
};

/* International LT: a smooth aero nose, a grille in horizontal slats crossed
 * by a chrome bar, swept lamps and a full-height roof fairing. */
TMODELS['international-lt'] = (B, T, paint, o) => {
  const k = {
    cowl: 6.5, ws: 1.5, cowlY: 6.4, roof: 9.85,
    top: [[0, 4.85], [0.2, 5.35], [0.6, 5.55], [3.5, 6.0], [6.9, 6.45]],
    side: [[0, 4.55], [0.4, 5.15], [3.5, 5.65], [6.9, 6.25]],
    bottom: [[0, 1.4], [0.6, 1.35], [1.6, 1.6], [6.0, 2.9], [6.9, 3.3]],
    plan: [[0, 0.85], [0.25, 0.92], [0.9, 0.97], [6.9, 0.96]], end: 6.9, shR: 0.45,
  };
  const hood = aeroHood(B, T, paint, k);
  const cab = aeroCab(B, T, paint, null, k);
  const cx = { skin: new Skin([hood, cab.shell]) };
  decal(B, M.pianoBlack(), cx.skin, 'front', [[-1.9, 5.1], [1.9, 5.1], [1.65, 2.75], [-1.65, 2.75]], { off: 0.02, mirror: false });
  for (let y = 3.0; y < 5.0; y += 0.25) ribbon(B, M.alloy('#c9ced3', 0.2), cx.skin, 'front', [[-1.7, y], [1.7, y]], 0.06, { off: 0.035, mirror: false });
  ribbon(B, BRIGHT(), cx.skin, 'front', [[-1.85, 4.15], [1.85, 4.15]], 0.3, { off: 0.05, raise: 0.05, mirror: false });
  badge(B, cx, 'front', 0, 4.15, 0.3, M.painted('#c8241b', 0.3));
  const hl = [[2.05, 5.0], [3.55, 4.8], [3.95, 4.2], [3.6, 3.95], [2.15, 4.35]];
  decal(B, M.pianoBlack(), cx.skin, 'front', hl, { off: 0.015 });
  decal(B, M.lens(), cx.skin, 'front', hl, { off: 0.04 });
  for (const x of [2.55, 3.15]) stud(B, new THREE.SphereGeometry(0.17, 12, 8).scale(1, 1, 0.5), M.reflector(), cx.skin, 'front', x, 4.5, { off: 0.02 });
  ribbon(B, M.led(), cx.skin, 'front', [[2.1, 4.85], [3.5, 4.65], [3.85, 4.2]], 0.07, { off: 0.035 });
  decal(B, M.cladding('#1b1d20'), cx.skin, 'front', [[-4.0, 2.4], [4.0, 2.4], [4.0, 1.5], [-4.0, 1.5]], { off: 0.02, mirror: false });
  cabSides(B, T, cx, cab, k);
  aeroDetails(B, T, cx, k);
  markers(B, T, k.cowl + k.ws + 0.4, k.roof + 0.12, 1.6);
  mirrors(B, T, k.cowl + 0.35, { hood: [1.1, 5.6, 3.9] });
  const Z = (s) => -T.L / 2 + s;
  const s0 = k.cowl + 0.3;
  const s1 = T.fo + T.wb - 2.17 - R - 0.4;
  for (const sd of [1, -1]) B.box(paint, 0.12, 2.5, s1 - s0, sd * 4.15, 2.75, Z((s0 + s1) / 2));
  for (const sd of [1, -1]) B.box(paint, 0.1, 8.0, 1.5, sd * 3.98, 8.5, Z(T.bbc + T.sleeper + 0.65));
  fuelTanks(B, T, k.cowl + 0.9, 4.2, { r: 0.95 });
  chassis(B, T, { fenderMat: M.pianoBlack() });
  lettering(B, cx, 'front', 'INTERNATIONAL', 0, 5.4, 2.4);
};

/* Peterbilt 389: the long square bonnet, a tall chrome grille with vertical
 * bars, chrome air cleaners and twin stacks, a sun visor and a flat-top
 * sleeper — and chrome on nearly everything else. */
TMODELS['peterbilt-389'] = (B, T, paint, o) => {
  const k = {
    cowl: 7.4, ws: 0.75, cowlY: 6.05, roof: 9.6, raised: false,
    hoodW: 4.0, hoodY: 5.85, hoodBottom: 2.75, end: 7.6, hoodR: 0.22, taper: 0.25,
    wingFront: 0.55, wingBack: 6.4, wingRise: 0.25, wingLow: 2.8, wingBackY: 3.3, wingBevel: 0.16,
  };
  const hood = classicHood(B, T, paint, k);
  classicFenders(B, T, paint, k);
  const cab = classicCab(B, T, paint, null, k);
  const cx = { skin: new Skin([hood, cab.shell]) };
  // Grille: a tall chrome frame and bars, the oval emblem above it.
  decal(B, BRIGHT(), cx.skin, 'front', [[-1.85, 5.75], [1.85, 5.75], [1.85, 2.85], [-1.85, 2.85]], { off: 0.02, mirror: false });
  decal(B, M.grilleMesh('#1d1f22'), cx.skin, 'front', [[-1.62, 5.55], [1.62, 5.55], [1.62, 3.05], [-1.62, 3.05]], { off: 0.03, mirror: false });
  for (let x = -1.5; x <= 1.51; x += 0.15) ribbon(B, BRIGHT(), cx.skin, 'front', [[x, 3.1], [x, 5.5]], 0.05, { off: 0.04, raise: 0.03, mirror: false });
  stud(B, new THREE.CylinderGeometry(0.42, 0.42, 0.06, 24).rotateX(PI / 2).scale(1.5, 1, 1), M.painted('#a3191d', 0.3), cx.skin, 'front', 0, 5.95, { off: 0.03, mirror: false });
  // Chrome bumper, headlamp pods on the wings, wing-top lights.
  B.box(BRIGHT(), 8.2, 1.15, 0.65, 0, 2.05, -T.L / 2 + 0.1);
  for (const sd of [1, -1]) {
    B.box(M.chrome(), 1.5, 0.75, 0.55, sd * 3.2, 4.1, -T.L / 2 + 1.25);
    for (const x of [2.85, 3.5]) {
      B.add(new THREE.CircleGeometry(0.26, 18).translate(sd * x, 4.1, -T.L / 2 + 0.96), M.lens());
      B.add(new THREE.SphereGeometry(0.24, 12, 8).scale(1, 1, 0.4).translate(sd * x, 4.1, -T.L / 2 + 1.0), M.reflector());
    }
    B.box(M.tailLens('#d6820f'), 0.35, 0.15, 0.6, sd * 3.6, 4.98, -T.L / 2 + 1.5);
  }
  cabSides(B, T, cx, cab, { ...k, sleeperWindow: true });
  // Sun visor with marker lights, horns, air cleaners, stacks, chrome tanks.
  B.box(paint, 7.6, 0.18, 1.3, 0, k.roof - 0.05, -T.L / 2 + k.cowl + k.ws + 0.1, [0.22, 0, 0]);
  markers(B, T, k.cowl + k.ws - 0.35, k.roof - 0.12, 3.0, 5);
  horns(B, T, k.cowl + k.ws + 0.8, k.roof + 0.35);
  airCleaners(B, T, k.cowl - 0.55, { y0: 4.7, h: 3.0 });
  stacks(B, T, T.bbc + 0.25, T.H + 2.2, { x: 3.55 });
  mirrors(B, T, k.cowl + 0.4, { hood: [2.0, 5.3, 4.0] });
  fuelTanks(B, T, k.cowl + 0.9, 5.0, { r: 1.08, mat: M.chrome() });
  sideBoxes(B, T);
  chassis(B, T, { fenderMat: M.chrome() });
};

/* Kenworth W900: the longest nose of all, rounded wings that sweep down to
 * the steps, twin round lamps in chrome pods, a raised-roof sleeper. */
TMODELS['kenworth-w900'] = (B, T, paint, o) => {
  const k = {
    cowl: 7.3, ws: 0.8, cowlY: 6.15, roof: 9.7, raised: true,
    hoodW: 4.2, hoodY: 5.95, hoodBottom: 2.7, end: 7.5, hoodR: 0.45, taper: 0.15,
    wingFront: 0.45, wingBack: 6.6, wingRise: 0.5, wingLow: 2.6, wingBackY: 3.1, wingBevel: 0.3,
  };
  const hood = classicHood(B, T, paint, k);
  classicFenders(B, T, paint, k);
  const cab = classicCab(B, T, paint, null, k);
  const cx = { skin: new Skin([hood, cab.shell]) };
  decal(B, BRIGHT(), cx.skin, 'front', [[-1.95, 5.85], [1.95, 5.85], [1.95, 2.8], [-1.95, 2.8]], { off: 0.02, mirror: false });
  decal(B, M.grilleMesh('#2b2e33'), cx.skin, 'front', [[-1.75, 5.65], [1.75, 5.65], [1.75, 3.0], [-1.75, 3.0]], { off: 0.03, mirror: false });
  for (let y = 3.15; y < 5.6; y += 0.2) ribbon(B, BRIGHT(), cx.skin, 'front', [[-1.72, y], [1.72, y]], 0.05, { off: 0.04, raise: 0.02, mirror: false });
  lettering(B, cx, 'front', 'KENWORTH', 0, 5.0, 2.0);
  B.box(BRIGHT(), 8.3, 1.2, 0.7, 0, 2.05, -T.L / 2 + 0.05);
  for (const sd of [1, -1]) {
    B.add(cylGeo(0.62, 0.62, 0.9, 24).rotateX(PI / 2), M.chrome(), { pos: [sd * 3.3, 4.25, -T.L / 2 + 1.0] });
    B.add(new THREE.CircleGeometry(0.5, 20).translate(sd * 3.3, 4.25, -T.L / 2 + 0.54), M.lens());
    B.add(new THREE.SphereGeometry(0.45, 14, 8).scale(1, 1, 0.35).translate(sd * 3.3, 4.25, -T.L / 2 + 0.6), M.reflector());
    B.box(M.tailLens('#d6820f'), 0.4, 0.15, 0.5, sd * 3.5, 5.15, -T.L / 2 + 1.6);
  }
  cabSides(B, T, cx, cab, k);
  B.box(paint, 7.6, 0.18, 1.4, 0, k.roof - 0.05, -T.L / 2 + k.cowl + k.ws + 0.1, [0.25, 0, 0]);
  markers(B, T, k.cowl + k.ws - 0.4, k.roof - 0.12, 3.0, 5);
  markers(B, T, T.bbc + 1.7, T.H + 0.08, 2.6, 5);
  horns(B, T, k.cowl + k.ws + 0.8, k.roof + 0.35);
  airCleaners(B, T, k.cowl - 0.5, { y0: 4.6, h: 3.2, r: 0.82 });
  stacks(B, T, T.bbc + 0.25, T.H + 1.4, { x: 3.55 });
  mirrors(B, T, k.cowl + 0.4, { hood: [2.0, 5.4, 4.0] });
  fuelTanks(B, T, k.cowl + 0.9, 5.2, { r: 1.08, mat: M.chrome() });
  sideBoxes(B, T);
  chassis(B, T, { fenderMat: M.chrome() });
};

/* ================================================================ public */

export function isTruck(id) { return !!TMODELS[id] && !!TRUCK_BY_ID[id]; }

/** Build one tractor. Returns a Builder, like vehicleModel. */
export function truckModel(id, color, paintOverride = null, opts = {}) {
  const T = TRUCK_BY_ID[id];
  const B = new Builder();
  if (!T || !TMODELS[id]) {
    B.box(paintOverride || M.carPaint(color || '#c9ccd0'), 8.2, 10, 24, 0, 6, 0);
    return B;
  }
  const paint = paintOverride || M.carPaint(color || T.color);
  TMODELS[id](B, T, paint, opts);
  return B;
}
