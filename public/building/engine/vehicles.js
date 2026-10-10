/* Vehicles, from hatchbacks to tower-crane trucks.
 *
 * Each model is built in its own frame: x across, y up, z along its length
 * with the FRONT at -z and the rear at +z (so a trailer backs onto a dock with
 * its +z end). Bodies are side profiles extruded across the width with bevelled
 * edges, so they have real curves and catch the light like painted panels.
 *
 * `paint` lets the caller swap the body colour for a shared white material, so
 * parked cars and traffic can be drawn as instances with per-car colours. */

import * as THREE from 'three';
import { Builder } from './builder.js';
import * as M from './materials.js';

/** Extrude a side profile [[z, y], ...] across the width, centred on x = 0. */
function profile(B, mat, pts, width, { bevel = 0.35, x = 0 } = {}) {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  const bw = Math.min(bevel, width * 0.2);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.05, width - bw * 2), bevelEnabled: bw > 0, bevelThickness: bw, bevelSize: bw, bevelSegments: 3, curveSegments: 6 });
  // Shape x is our z; the extrusion runs across the car.
  g.rotateY(-Math.PI / 2);
  g.translate(x + (width - bw * 2) / 2, 0, 0);
  B.add(g, mat);
}

function wheel(B, x, y, z, r, w, { rim = M.metal('#b9c0c6', 0.25), dual = false } = {}) {
  const rot = [0, 0, Math.PI / 2];
  B.cyl(M.tyre(), r, r, w, x, y, z, { seg: 18, rot });
  const side = Math.sign(x) || 1;
  B.cyl(rim, r * 0.62, r * 0.62, 0.06, x + side * (w / 2 + 0.01), y, z, { seg: 16, rot });
  B.cyl(M.metal('#55595e', 0.5), r * 0.2, r * 0.2, 0.1, x + side * (w / 2 + 0.04), y, z, { seg: 8, rot });
  if (dual) B.cyl(M.tyre(), r, r, w, x - side * (w + 0.1), y, z, { seg: 18, rot });
}

/* Lamps: plain lenses on parked vehicles, lit after dark on moving ones. */
let LIT = false;
const LIGHT_W = () => (LIT ? M.lamp('#fff6e0', 7) : M.plastic('#e9edf0', 0.15));
const LIGHT_R = () => (LIT ? M.lamp('#ff2a1a', 4) : M.plastic('#8c1a14', 0.2));
const LIGHT_A = () => (LIT ? M.lamp('#ffa31a', 3) : M.plastic('#c7801a', 0.2));

/* ---------------------------------------------------------------- cars */

/** A family of passenger vehicles from one generator. */
function passenger(B, kind, paint, w, L, h) {
  const z0 = -L / 2;
  const P = {
    car: { belt: 0.56, hood: 0.27, roof0: 0.36, roof1: 0.7, tail: 0.88, ground: 0.55 },
    hatch: { belt: 0.56, hood: 0.22, roof0: 0.32, roof1: 0.86, tail: 0.98, ground: 0.55 },
    suv: { belt: 0.58, hood: 0.24, roof0: 0.33, roof1: 0.9, tail: 0.98, ground: 0.75 },
    police: { belt: 0.56, hood: 0.27, roof0: 0.36, roof1: 0.7, tail: 0.88, ground: 0.55 },
  }[kind] || { belt: 0.56, hood: 0.27, roof0: 0.36, roof1: 0.7, tail: 0.88, ground: 0.55 };
  const g = P.ground;
  const belt = h * P.belt;
  // Lower body: bumpers, wheel arches implied by the bevel.
  profile(B, paint, [
    [z0 + 0.3, g + 0.2], [z0 + L - 0.25, g + 0.2], [z0 + L, g + 0.9], [z0 + L, belt],
    [z0 + L * P.tail, belt + 0.12], [z0 + L * P.hood, belt + 0.05], [z0 + 0.2, belt - 0.35], [z0, g + 0.95],
  ], w, { bevel: 0.45 });
  // Greenhouse: glass all round, then the roof skin on top.
  const r0 = z0 + L * P.roof0;
  const r1 = z0 + L * P.roof1;
  const wsBase = z0 + L * P.hood + 0.3;
  const rearBase = z0 + L * Math.min(0.97, P.tail);
  profile(B, M.vehicleGlass(), [[wsBase, belt + 0.02], [rearBase, belt + 0.06], [r1 + 0.15, h - 0.08], [r0 - 0.1, h - 0.08]], w - 0.5, { bevel: 0.22 });
  profile(B, paint, [[r0 - 0.15, h - 0.12], [r1 + 0.2, h - 0.12], [r1 + 0.05, h], [r0, h]], w - 0.45, { bevel: 0.22 });
  // Pillars between the windows.
  const mid = (r0 + r1) / 2;
  for (const sx of [-1, 1]) B.box(paint, 0.12, h - belt - 0.15, 0.35, sx * (w / 2 - 0.3), belt + (h - belt) / 2, mid);
  // Wheels.
  const r = Math.max(1.05, g + 0.6);
  for (const wz of [z0 + L * 0.18, z0 + L * 0.8]) for (const sx of [-1, 1]) wheel(B, sx * (w / 2 - 0.42), r, wz, r, 0.75);
  // Lights, grille, plates and mirrors.
  for (const sx of [-1, 1]) {
    B.box(LIGHT_W(), 1.2, 0.35, 0.15, sx * (w / 2 - 0.9), belt - 0.45, z0 + 0.12);
    B.box(LIGHT_R(), 1.1, 0.4, 0.12, sx * (w / 2 - 0.8), belt - 0.25, z0 + L - 0.05);
    B.box(paint, 0.15, 0.32, 0.6, sx * (w / 2 + 0.12), belt + 0.35, wsBase + 0.6);
  }
  B.box(M.plastic('#15181c', 0.6), w * 0.42, 0.45, 0.12, 0, belt - 0.7, z0 + 0.06);
  B.box(M.plastic('#f2f2ec', 0.5), 1.1, 0.4, 0.06, 0, g + 0.85, z0 + L + 0.02);
  B.box(M.plastic('#22262b', 0.7), w - 0.2, 0.5, 0.25, 0, g + 0.45, z0 + L - 0.15);
  B.box(M.plastic('#22262b', 0.7), w - 0.2, 0.5, 0.25, 0, g + 0.45, z0 + 0.15);
  if (kind === 'police') {
    B.box(M.plastic('#1b1e22', 0.5), w * 0.7, 0.3, 1.2, 0, h + 0.15, mid);
    B.box(M.signal('#2a6bff', 3), w * 0.3, 0.25, 0.9, -w * 0.18, h + 0.4, mid);
    B.box(M.signal('#ff2a2a', 3), w * 0.3, 0.25, 0.9, w * 0.18, h + 0.4, mid);
    for (const sx of [-1, 1]) B.box(M.plastic('#f4f6f8', 0.4), 0.05, 0.9, L * 0.5, sx * (w / 2 + 0.06), belt - 0.6, z0 + L * 0.5);
  }
}

function pickup(B, paint, w, L, h) {
  const z0 = -L / 2;
  const g = 0.8;
  const belt = h * 0.6;
  profile(B, paint, [[z0 + 0.3, g], [z0 + L, g], [z0 + L, belt], [z0 + L * 0.38, belt], [z0 + L * 0.2, belt - 0.1], [z0, belt - 0.6], [z0, g + 0.6]], w, { bevel: 0.4 });
  profile(B, M.vehicleGlass(), [[z0 + L * 0.2 + 0.2, belt], [z0 + L * 0.42, belt], [z0 + L * 0.42, h - 0.1], [z0 + L * 0.27, h - 0.1]], w - 0.5, { bevel: 0.2 });
  profile(B, paint, [[z0 + L * 0.26, h - 0.15], [z0 + L * 0.43, h - 0.15], [z0 + L * 0.43, h], [z0 + L * 0.27, h]], w - 0.45, { bevel: 0.2 });
  // Load bed.
  B.box(M.plastic('#1c1f23', 0.8), w - 0.8, 0.1, L * 0.52, 0, belt - 0.9, z0 + L * 0.71);
  const r = 1.3;
  for (const wz of [z0 + L * 0.17, z0 + L * 0.8]) for (const sx of [-1, 1]) wheel(B, sx * (w / 2 - 0.45), r, wz, r, 0.85);
  for (const sx of [-1, 1]) {
    B.box(LIGHT_W(), 1, 0.4, 0.15, sx * (w / 2 - 0.8), belt - 0.5, z0 + 0.1);
    B.box(LIGHT_R(), 0.3, 1, 0.12, sx * (w / 2 - 0.25), belt - 0.6, z0 + L - 0.02);
  }
  B.box(M.chrome(), w - 0.3, 0.5, 0.3, 0, g + 0.3, z0 + 0.1);
  B.box(M.chrome(), w - 0.3, 0.45, 0.3, 0, g + 0.3, z0 + L - 0.1);
}

function van(B, paint, w, L, h, { boxy = 0.18, high = false } = {}) {
  const z0 = -L / 2;
  const g = 0.75;
  profile(B, paint, [[z0 + 0.3, g], [z0 + L, g], [z0 + L, h], [z0 + L * boxy + 1.5, h], [z0 + L * boxy * 0.4, h * 0.62], [z0, h * 0.42], [z0, g + 0.5]], w, { bevel: 0.35 });
  // Windscreen and cab side windows.
  const ws0 = [z0 + L * boxy * 0.42, h * 0.63];
  const ws1 = [z0 + L * boxy + 1.4, h - 0.15];
  B.add(quadGeo([-w / 2 + 0.35, ws0[1], ws0[0] - 0.05], [w / 2 - 0.35, ws0[1], ws0[0] - 0.05], [w / 2 - 0.35, ws1[1], ws1[0] - 0.05], [-w / 2 + 0.35, ws1[1], ws1[0] - 0.05], true), M.vehicleGlass());
  for (const sx of [-1, 1]) B.box(M.vehicleGlass(), 0.06, h * 0.28, L * boxy * 0.9, sx * (w / 2 + 0.02), h * 0.72, z0 + L * boxy * 0.95);
  if (high) for (const sx of [-1, 1]) B.box(M.plastic('#f2f2ec', 0.5), 0.05, 0.6, L * 0.6, sx * (w / 2 + 0.03), h * 0.55, z0 + L * 0.62);
  const r = 1.25;
  for (const wz of [z0 + L * 0.15, z0 + L * 0.8]) for (const sx of [-1, 1]) wheel(B, sx * (w / 2 - 0.45), r, wz, r, 0.8);
  for (const sx of [-1, 1]) {
    B.box(LIGHT_W(), 0.9, 0.5, 0.15, sx * (w / 2 - 0.7), h * 0.38, z0 + 0.1);
    B.box(LIGHT_R(), 0.3, 1.2, 0.1, sx * (w / 2 - 0.25), h * 0.45, z0 + L - 0.02);
  }
  B.box(M.plastic('#22262b', 0.7), w, 0.6, 0.3, 0, g + 0.3, z0 + 0.15);
  B.box(M.plastic('#22262b', 0.7), w, 0.6, 0.3, 0, g + 0.3, z0 + L - 0.15);
  B.box(M.plastic('#15181c', 0.6), w * 0.5, 0.6, 0.1, 0, h * 0.3, z0 + 0.04);
}

/* --------------------------------------------------------------- trucks */

/** A cab-over truck cab at the front of a chassis. */
function truckCab(B, paint, w, z0, h, { len = 8, sleeper = true } = {}) {
  const g = 2.2;
  profile(B, paint, [[z0 + 0.4, g], [z0 + len, g], [z0 + len, h - 0.4], [z0 + len - 0.4, h], [z0 + 1.3, h], [z0 + 0.6, h - 0.6], [z0, h * 0.55], [z0, g + 0.8]], w, { bevel: 0.35 });
  B.add(quadGeo([-w / 2 + 0.4, h * 0.56, z0 - 0.02], [w / 2 - 0.4, h * 0.56, z0 - 0.02], [w / 2 - 0.4, h - 1.1, z0 + 0.45], [-w / 2 + 0.4, h - 1.1, z0 + 0.45], true), M.vehicleGlass());
  for (const sx of [-1, 1]) {
    B.box(M.vehicleGlass(), 0.06, 1.8, 2.4, sx * (w / 2 + 0.02), h * 0.66, z0 + 1.8);
    B.box(M.metal('#2a2d31', 0.4), 0.15, 2, 0.15, sx * (w / 2 + 0.9), h * 0.62, z0 + 0.9);
    B.box(M.plastic('#1c1f23', 0.4), 0.3, 1.4, 0.5, sx * (w / 2 + 0.9), h * 0.62, z0 + 0.9);
    B.box(LIGHT_W(), 1.1, 0.5, 0.15, sx * (w / 2 - 0.9), 3.1, z0 - 0.05);
    B.box(LIGHT_A(), 0.4, 0.3, 0.15, sx * (w / 2 - 0.2), 3.1, z0 - 0.05);
  }
  B.box(M.chrome(), w * 0.6, 1.6, 0.12, 0, 4.2, z0 - 0.03);
  B.box(M.plastic('#22262b', 0.6), w + 0.2, 0.9, 0.6, 0, 2.2, z0 + 0.2);
  for (const sx of [-1, 1]) B.box(M.signal('#ffa31a', 1.5), 0.4, 0.2, 0.2, sx * (w / 2 - 0.6), h + 0.05, z0 + 1.4);
  if (sleeper) B.box(paint, w - 0.4, 1.6, 2.5, 0, h + 0.6, z0 + len - 2.2);
}

function chassis(B, w, z0, z1, axles, { y = 2.6, dual = true, r = 1.7 } = {}) {
  B.box(M.metal('#2b2e33', 0.5), w * 0.55, 0.9, z1 - z0, 0, y, (z0 + z1) / 2);
  for (const az of axles) {
    for (const sx of [-1, 1]) wheel(B, sx * (w / 2 - 0.55), r, az, r, 0.9, { dual: dual && az !== axles[0] });
    for (const sx of [-1, 1]) B.box(M.plastic('#15171a', 0.8), 1.9, 0.08, 3.6, sx * (w / 2 - 0.9), r * 2 + 0.2, az);
  }
}

function boxBody(B, mat, w, z0, z1, y0, y1, { ribs = true } = {}) {
  B.box(mat, w, y1 - y0, z1 - z0, 0, (y0 + y1) / 2, (z0 + z1) / 2);
  if (ribs) {
    const rib = M.metal('#c7ccd1', 0.35);
    for (let z = z0 + 1.5; z < z1 - 0.5; z += 3.2) for (const sx of [-1, 1]) B.box(rib, 0.1, y1 - y0 - 0.3, 0.2, sx * (w / 2 + 0.05), (y0 + y1) / 2, z);
    B.box(rib, w + 0.2, 0.3, z1 - z0, 0, y1 - 0.15, (z0 + z1) / 2);
    B.box(rib, w + 0.2, 0.4, z1 - z0, 0, y0 + 0.2, (z0 + z1) / 2);
  }
  // Rear doors.
  B.box(M.metal('#b4bac0', 0.4), w - 0.2, y1 - y0 - 0.6, 0.12, 0, (y0 + y1) / 2, z1 + 0.06);
  B.box(M.metal('#7c8389', 0.4), 0.12, y1 - y0 - 0.6, 0.18, 0, (y0 + y1) / 2, z1 + 0.1);
  for (const sx of [-1, 1]) {
    B.box(LIGHT_R(), 0.5, 0.35, 0.1, sx * (w / 2 - 0.5), y0 - 0.5, z1 + 0.1);
    for (const hy of [0.3, 0.7]) B.box(M.metal('#6b7178', 0.4), 0.08, 0.1, 0.25, sx * w * 0.25, y0 + (y1 - y0) * hy, z1 + 0.15);
  }
}

function trailer(B, paint, w, L, h, { reefer = false } = {}) {
  const z0 = -L / 2;
  const z1 = L / 2;
  const y0 = 4.1;
  boxBody(B, paint, w, z0, z1, y0, h, { ribs: true });
  B.box(M.metal('#2b2e33', 0.5), w * 0.5, 0.8, L - 2, 0, y0 - 0.4, 0);
  // Landing legs near the front, tandem axles at the back.
  for (const sx of [-1, 1]) {
    B.box(M.metal('#3b3f45', 0.5), 0.35, 3.6, 0.35, sx * 3, 1.9, z0 + 10);
    B.box(M.metal('#3b3f45', 0.5), 0.8, 0.12, 0.8, sx * 3, 0.06, z0 + 10);
    B.box(M.paint('#e44c1c'), 0.06, 0.5, L * 0.85, sx * (w / 2 + 0.07), y0 + 0.5, 0);
    B.box(M.plastic('#15171a', 0.8), 0.08, 1.6, 9, sx * (w / 2 - 0.1), 2.6, z1 - 7);
  }
  B.box(M.metal('#3b3f45', 0.5), w - 1, 0.5, 0.4, 0, 1.8, z1 - 0.4);
  for (const az of [z1 - 6.8, z1 - 3]) for (const sx of [-1, 1]) wheel(B, sx * (w / 2 - 0.55), 1.7, az, 1.7, 0.9, { dual: true });
  if (reefer) {
    B.box(M.painted('#e8eaec', 0.4), w - 0.8, 5.5, 2.2, 0, h - 3.6, z0 - 1.1);
    B.box(M.louvre(), w - 1.4, 3.2, 0.06, 0, h - 3.6, z0 - 2.22);
    B.box(M.painted('#20242a', 0.5), 1.5, 0.8, 0.1, 0, h - 1.4, z0 - 2.23);
  }
}

/* ------------------------------------------------------------ builders */

function quadGeo(a, b, c, d, doubleSided = false) {
  const g = new THREE.BufferGeometry();
  const pts = doubleSided ? [...a, ...b, ...c, ...d, ...d, ...c, ...b, ...a] : [...a, ...b, ...c, ...d];
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  g.setIndex(doubleSided ? [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7] : [0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}

/**
 * Model one vehicle. o: { type, color }. Pass `paint` to override the body
 * material (white instance paint for crowds of parked cars).
 */
export function vehicleModel(type, color, w, L, h, paintOverride = null, { lit = false } = {}) {
  LIT = lit;
  const B = new Builder();
  const paint = paintOverride || M.carPaint(color || '#d9dde2');
  const z0 = -L / 2;
  switch (type) {
    case 'car':
    case 'hatch':
    case 'suv':
      passenger(B, type, paint, w, L, h);
      break;
    case 'police':
      passenger(B, 'police', paintOverride || M.carPaint('#1d2735'), w, L, h);
      break;
    case 'pickup':
      pickup(B, paint, w, L, h);
      break;
    case 'van':
      van(B, paint, w, L, h, { boxy: 0.16 });
      break;
    case 'ambulance': {
      const body = M.carPaint('#f4f5f2');
      van(B, body, w, L, h, { boxy: 0.2, high: true });
      for (const sx of [-1, 1]) {
        B.box(M.paint('#1a8a3a'), 0.05, 1, L * 0.7, sx * (w / 2 + 0.04), h * 0.42, 1.5);
        B.box(M.paint('#e7c517'), 0.05, 0.6, L * 0.7, sx * (w / 2 + 0.04), h * 0.62, 1.5);
      }
      B.box(M.signal('#2a6bff', 3), w * 0.8, 0.35, 0.6, 0, h + 0.15, z0 + L * 0.2);
      break;
    }
    case 'bus': {
      const body = paintOverride || M.carPaint(color || '#c9a227');
      profile(B, body, [[z0 + 0.5, 1.2], [z0 + L, 1.2], [z0 + L, h], [z0 + 0.6, h], [z0, h - 0.8], [z0, 1.8]], w, { bevel: 0.4 });
      for (const sx of [-1, 1]) B.box(M.vehicleGlass(), 0.06, 3.4, L - 6, sx * (w / 2 + 0.02), h - 3.4, 1.5);
      B.add(quadGeo([-w / 2 + 0.3, 3.5, z0 - 0.03], [w / 2 - 0.3, 3.5, z0 - 0.03], [w / 2 - 0.3, h - 0.6, z0 - 0.03], [-w / 2 + 0.3, h - 0.6, z0 - 0.03], true), M.vehicleGlass());
      B.box(M.signal('#ffb020', 1.8), w * 0.6, 0.6, 0.06, 0, h - 0.35, z0 - 0.05);
      for (const wz of [z0 + 7, z0 + L - 9]) for (const sx of [-1, 1]) wheel(B, sx * (w / 2 - 0.55), 1.6, wz, 1.6, 0.9);
      for (const sx of [-1, 1]) {
        B.box(LIGHT_W(), 0.9, 0.5, 0.12, sx * (w / 2 - 0.8), 2.4, z0 - 0.05);
        B.box(LIGHT_R(), 0.4, 1.4, 0.1, sx * (w / 2 - 0.3), 3, z0 + L + 0.03);
      }
      break;
    }
    case 'tractor': {
      truckCab(B, paint, w, z0, h, { len: 9 });
      chassis(B, w, z0 + 2, z0 + L - 0.5, [z0 + 3.2, z0 + L - 6, z0 + L - 2.6]);
      B.box(M.metal('#2b2e33', 0.5), w - 1.6, 0.4, 4.5, 0, 4, z0 + L - 4);
      B.cyl(M.chrome(), 0.35, 0.35, 5, w / 2 - 0.3, h - 1.2, z0 + 9.4, {});
      B.cyl(M.metal('#9aa1a8', 0.3), 1, 1, 4, w / 2 - 0.4, 3, z0 + 10.6, { rot: [Math.PI / 2, 0, 0] });
      break;
    }
    case 'boxtruck': {
      truckCab(B, paint, w, z0, 9.5, { len: 7, sleeper: false });
      chassis(B, w, z0 + 2, z0 + L - 0.5, [z0 + 3.2, z0 + L - 5]);
      boxBody(B, M.painted('#eef0f2', 0.45), w, z0 + 7.6, z0 + L, 3.6, h);
      break;
    }
    case 'trailer':
      trailer(B, paint, w, L, h);
      break;
    case 'reefer':
      trailer(B, M.painted('#f1f3f5', 0.4), w, L, h, { reefer: true });
      break;
    case 'tanker': {
      const tank = M.metal('#d3d8dc', 0.2);
      const len = L - 3;
      B.cyl(tank, 3.6, 3.6, len, 0, h - 3.8, 1.5, { seg: 24, rot: [Math.PI / 2, 0, 0] });
      for (const zz of [1.5 - len / 2, 1.5 + len / 2]) B.sphere(tank, 3.6, 0, h - 3.8, zz, { sz: 0.25, seg: 18 });
      for (let i = -2; i <= 2; i++) B.cyl(M.metal('#9aa1a8', 0.3), 3.65, 3.65, 0.25, 0, h - 3.8, 1.5 + i * len * 0.2, { seg: 24, rot: [Math.PI / 2, 0, 0], open: true });
      B.box(M.metal('#6b7178', 0.4), 1.2, 0.3, len * 0.8, 0, h + 0.2, 1.5);
      truckCab(B, M.carPaint(color || '#c0392b'), w, z0, 11.5, { len: 8 });
      chassis(B, w, z0 + 2, z0 + L - 0.5, [z0 + 3.2, z0 + 11, z0 + L - 6.5, z0 + L - 3]);
      break;
    }
    case 'flatbed': {
      truckCab(B, M.carPaint(color || '#2c4a7c'), w, z0, 11.5, { len: 8 });
      chassis(B, w, z0 + 2, z0 + L - 0.5, [z0 + 3.2, z0 + 11, z0 + L - 6.5, z0 + L - 3]);
      B.box(M.wood('#7a5a3f'), w, 0.6, L - 10, 0, 4.4, 5);
      // A load of steel beams and timber bundles under straps.
      for (let i = 0; i < 3; i++) B.box(M.metal('#6f7378', 0.5), w - 1.2, 1.4, 9, 0, 5.4 + i * 0, z0 + 14 + i * 11);
      for (let i = 0; i < 2; i++) B.box(M.wood('#c7a77a'), w - 1, 2.6, 8, 0, 6, z0 + 16 + i * 11 + 5);
      for (let z = z0 + 13; z < z0 + L - 2; z += 5) B.box(M.paint('#e7b416'), w + 0.1, 3.4, 0.2, 0, 6, z);
      break;
    }
    case 'dumptruck': {
      truckCab(B, paint, w, z0, h - 0.5, { len: 7, sleeper: false });
      chassis(B, w, z0 + 2, z0 + L - 0.5, [z0 + 3.2, z0 + L - 7, z0 + L - 3.4]);
      profile(B, M.painted('#d7a21b', 0.5), [[z0 + 8, 4.4], [z0 + L, 4.4], [z0 + L, h], [z0 + 7, h + 0.6], [z0 + 7.5, 6]], w, { bevel: 0.2 });
      break;
    }
    case 'mixer': {
      truckCab(B, paint, w, z0, 10.5, { len: 7, sleeper: false });
      chassis(B, w, z0 + 2, z0 + L - 0.5, [z0 + 3.2, z0 + L - 7, z0 + L - 3.4]);
      const drum = new THREE.LatheGeometry([[0.1, 0], [3, 1.5], [3.6, 6], [3.2, 11], [1.4, 14.5], [0.9, 15]].map(([r2, y]) => new THREE.Vector2(r2, y)), 20);
      B.add(drum, M.painted('#e6e8ea', 0.35), { pos: [0, h - 4.6, z0 + 9], rot: [Math.PI / 2 - 0.22, 0, 0] });
      for (let i = 0; i < 3; i++) B.tube(M.painted('#c0392b', 0.4), [0, h - 4.6 + 3.3 * Math.cos(i * 2.1), z0 + 11 + i * 3], [0, h - 4.6 - 3.3 * Math.cos(i * 2.1), z0 + 13 + i * 3], 0.25);
      B.box(M.metal('#4a4f55', 0.5), 1, 1, 4, 0, 4.5, z0 + L - 1);
      break;
    }
    case 'firetruck': {
      const red = M.carPaint('#c0201a');
      truckCab(B, red, w, z0, 9.5, { len: 9, sleeper: false });
      chassis(B, w, z0 + 2, z0 + L - 0.5, [z0 + 3.4, z0 + L - 7, z0 + L - 3.4]);
      B.box(red, w, h - 4.2, L - 10, 0, 4 + (h - 4.2) / 2 - 0.4, z0 + 9.5 + (L - 10) / 2);
      for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) B.box(M.metal('#c9ced3', 0.25), 0.06, h - 6, 4.2, sx * (w / 2 + 0.03), 3.6 + (h - 6) / 2, z0 + 11.5 + i * 4.7);
      B.box(M.metal('#c9ced3', 0.3), 1.6, 0.6, L - 8, 0, h + 0.4, 2);
      B.box(M.signal('#ff2a1a', 3), w * 0.8, 0.35, 0.6, 0, 9.8, z0 + 1.2);
      for (const sx of [-1, 1]) B.box(M.paint('#f4f6f8'), 0.06, 0.5, L - 4, sx * (w / 2 + 0.05), 4.6, 1);
      break;
    }
    case 'forklift': {
      const yel = M.painted('#e2a51b', 0.45);
      B.box(yel, w, 2.2, L * 0.55, 0, 2, 1.2);
      B.box(M.painted('#2c3036', 0.6), w - 0.4, 1.8, 1.6, 0, 2.2, L / 2 - 0.9);
      for (const sx of [-1, 1]) B.box(M.metal('#2c3036', 0.5), 0.2, h - 0.5, 0.2, sx * (w / 2 - 0.4), (h - 0.5) / 2 + 0.6, 0.2);
      B.box(M.metal('#2c3036', 0.5), w, 0.2, L * 0.5, 0, h, 1);
      for (const sx of [-1, 1]) {
        B.box(M.metal('#3b3f45', 0.5), 0.25, 5, 0.3, sx * 1, 3, z0 + 3.4);
        B.box(M.metal('#3b3f45', 0.5), 0.35, 0.2, 3.6, sx * 1, 0.6, z0 + 1.6);
      }
      B.box(M.wood('#a07a52'), 3.6, 0.5, 3.6, 0, 0.95, z0 + 1.8);
      B.box(M.plastic('#d7d2c4', 0.9), 3.4, 2.2, 3.4, 0, 2.3, z0 + 1.8);
      for (const wz of [z0 + 3.6, z0 + L - 1.4]) for (const sx of [-1, 1]) wheel(B, sx * (w / 2 - 0.4), 0.9, wz, 0.9, 0.7);
      B.box(M.signal('#ffa31a', 2), 0.4, 0.4, 0.4, 0, h + 0.3, 1);
      break;
    }
    case 'excavator': {
      const yel = M.painted('#e2a51b', 0.45);
      for (const sx of [-1, 1]) {
        B.box(M.metal('#2b2e33', 0.6), 2.2, 2.6, L * 0.55, sx * (w / 2 - 1.1), 1.3, 2);
        B.box(M.plastic('#15171a', 0.9), 2.3, 0.3, L * 0.55, sx * (w / 2 - 1.1), 2.65, 2);
      }
      B.box(yel, w - 0.6, 3, 11, 0, 4.4, 3.5);
      B.box(yel, 4.2, 4.5, 5, -2.2, 7.6, 0.5);
      B.box(M.vehicleGlass(), 3.8, 3, 0.1, -2.2, 8.2, -2);
      B.box(M.painted('#2b2e33', 0.6), w - 1, 3, 3, 0, 4.6, 8.4);
      B.tube(yel, [1.5, 5.5, -1], [1.5, h, z0 + 8], 0.9, 8);
      B.tube(yel, [1.5, h, z0 + 8], [1.5, 3, z0 + 2], 0.7, 8);
      B.box(M.metal('#3b3f45', 0.5), 3.2, 2.2, 2.4, 1.5, 1.8, z0 + 1.4);
      break;
    }
    case 'mobilecrane': {
      const yel = M.painted('#e2a51b', 0.45);
      truckCab(B, yel, w, z0, 9, { len: 6, sleeper: false });
      chassis(B, w, z0 + 2, z0 + L - 0.5, [z0 + 3.2, z0 + 10, z0 + L - 12, z0 + L - 8, z0 + L - 4]);
      B.box(yel, w, 2.6, L - 8, 0, 4.4, 3.5);
      B.box(yel, 5, 4, 7, 0, 7.6, z0 + L - 8);
      B.box(M.metal('#e9ecee', 0.35), 2.2, 2.2, L - 6, 0, h - 1.2, -1);
      for (const sx of [-1, 1]) for (const zz of [z0 + 7, z0 + L - 3]) B.box(M.metal('#3b3f45', 0.5), 0.5, 2.8, 0.5, sx * (w / 2 + 2.5), 1.6, zz);
      break;
    }
    default:
      B.box(paint, w, h, L, 0, h / 2, 0);
  }
  return B;
}
