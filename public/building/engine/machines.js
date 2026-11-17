/* Plant and site kit: the machines that put a building up, the signs that go
 * round the works, and the materials stacked on the pad.
 *
 * Machines are modelled like the other vehicles — length along z, the front
 * at +z, standing on y = 0 — and are reached from vehicleModel. */

import * as THREE from 'three';
import { Builder, cylGeo } from './builder.js';
import * as M from './materials.js';
import { rng } from './textures.js';

const PI = Math.PI;

const steel = (r = 0.5) => M.metal('#3b3f45', r);
const dark = (r = 0.6) => M.painted('#22262b', r);
const glassM = () => M.vehicleGlass();
const grip = () => M.tread();

/** A road wheel with a tyre and a rim. */
function wheel(B, x, y, z, r, w, rim = M.metal('#b9c0c6', 0.3)) {
  B.add(cylGeo(r, r, w, 16).rotateZ(PI / 2), M.tyre(), { pos: [x, y, z] });
  B.add(cylGeo(r * 0.55, r * 0.55, w + 0.06, 12).rotateZ(PI / 2), rim, { pos: [x, y, z] });
}

/** A rubber track on its sprockets and rollers, running along z. */
function track(B, x, z0, z1, r, w, { y = 0 } = {}) {
  const len = z1 - z0;
  const cz = (z0 + z1) / 2;
  const belt = M.rubber();
  B.add(cylGeo(r, r, w, 16).rotateZ(PI / 2), belt, { pos: [x, y + r, z0 + r] });
  B.add(cylGeo(r, r, w, 16).rotateZ(PI / 2), belt, { pos: [x, y + r, z1 - r] });
  B.box(belt, w, r * 2, len - r * 2, x, y + r, cz);
  // Grousers, the frame and the rollers.
  for (let i = 0; i < Math.round(len / 0.75); i++) {
    const zz = z0 + r + i * 0.75;
    if (zz > z1 - r) break;
    B.box(grip(), w + 0.1, 0.1, 0.3, x, y + 0.02, zz);
    B.box(grip(), w + 0.1, 0.1, 0.3, x, y + r * 2 - 0.02, zz);
  }
  B.box(steel(), w - 0.5, r * 0.9, len - r * 3, x, y + r, cz);
  for (let i = 0; i < 4; i++) B.add(cylGeo(r * 0.38, r * 0.38, w - 0.3, 10).rotateZ(PI / 2), steel(0.6), { pos: [x, y + r * 0.45, z0 + r * 1.6 + (i * (len - r * 3.2)) / 3] });
}

/** A beacon on a stalk. */
function beacon(B, x, y, z) {
  B.add(cylGeo(0.14, 0.14, 0.35, 10), M.signal('#ffa31a', 2.2), { pos: [x, y + 0.18, z] });
  B.box(dark(), 0.1, 0.25, 0.1, x, y - 0.1, z);
}

/**
 * A cab: a painted kick panel, glass above it in a frame, and a roof — so it
 * reads as a glasshouse with an operator in it, not a black box.
 */
function cab(B, paint, w, h, d, x, y, z, { tint = true } = {}) {
  const kick = Math.min(1.5, h * 0.33);
  const glass = M.carGlass('#2b3b44', 0.5);
  B.box(paint, w, kick, d, x, y + kick / 2, z);
  B.box(paint, w + 0.1, 0.22, d + 0.1, x, y + h, z);
  B.box(M.painted('#2b2f36', 0.5), w + 0.14, 0.12, d + 0.14, x, y + h - 0.2, z);
  // Corner posts and a mid post each side.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box(steel(0.45), 0.2, h, 0.2, x + sx * (w / 2 - 0.1), y + h / 2, z + sz * (d / 2 - 0.1));
  for (const sx of [-1, 1]) B.box(steel(0.45), 0.14, h - kick, 0.14, x + sx * (w / 2 - 0.07), y + kick + (h - kick) / 2, z + d * 0.1);
  if (tint) {
    for (const sz of [-1, 1]) B.box(glass, w - 0.3, h - kick - 0.35, 0.05, x, y + kick + (h - kick) / 2 - 0.1, z + sz * (d / 2 - 0.06));
    for (const sx of [-1, 1]) B.box(glass, 0.05, h - kick - 0.35, d - 0.3, x + sx * (w / 2 - 0.06), y + kick + (h - kick) / 2 - 0.1, z);
  }
  // Seat, column and a handrail by the door.
  B.box(M.upholstery('#2a2c30'), w * 0.46, 0.3, d * 0.4, x, y + kick + 0.3, z - d * 0.08);
  B.box(M.upholstery('#2a2c30'), w * 0.46, 1.3, 0.28, x, y + kick + 1.1, z - d * 0.3);
  B.add(cylGeo(0.07, 0.07, 1.1, 8), dark(), { pos: [x, y + kick + 0.9, z + d * 0.22], rot: [0.3, 0, 0] });
  B.add(cylGeo(0.4, 0.4, 0.12, 14), dark(), { pos: [x, y + kick + 1.5, z + d * 0.3], rot: [1.2, 0, 0] });
  B.box(M.painted('#e8820f', 0.5), 0.1, h * 0.55, 0.1, x + w / 2 + 0.06, y + kick + h * 0.2, z + d * 0.26);
}

/** A bucket: a curved shell of slats with a cutting edge and teeth. */
function bucket(B, w, cz, y, { depth = 2.6, height = 3.4, teeth = 5, mat = null, turn = 0 } = {}) {
  const shell = mat || M.metal('#8a9199', 0.45);
  const n = 7;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const a = turn + t * 1.5;
    const yy = y + height * (1 - Math.cos(a - turn) * 0.85) * 0.9;
    const zz = cz + depth * Math.sin(a - turn) * 0.85;
    B.box(shell, w, height / 3.4, 0.5, 0, yy, zz, [a - 0.5, 0, 0]);
  }
  B.box(M.metal('#6f757c', 0.55), w, 0.35, 0.8, 0, y - 0.1, cz + depth * 0.95);
  for (let i = 0; i < teeth; i++) {
    const x = -w / 2 + (w / (teeth - 1 || 1)) * i;
    B.box(M.metal('#55585d', 0.6), 0.5, 0.3, 0.9, x * 0.92, y - 0.12, cz + depth * 1.3);
  }
  for (const sx of [-1, 1]) B.box(shell, 0.25, height, depth * 1.6, sx * (w / 2 - 0.12), y + height * 0.45, cz + depth * 0.45);
}

/** The machines, by type. Returns false if this file does not know the type. */
export function machineModel(B, type, { paint, color, w, L, h, z0 }) {
  const yel = M.painted(color || '#e2a51b', 0.45);
  const r = rng(w * 31 + L * 17 + h * 7);
  switch (type) {
    case 'dozer': {
      // Tracked dozer: blade on push arms, ripper at the back.
      for (const sx of [-1, 1]) track(B, sx * (w / 2 - 0.9), z0 + 2, z0 + L - 4.5, 1.5, 1.8);
      B.box(yel, w - 2.4, 2.4, L - 9, 0, 2.4, 1);
      B.box(yel, w - 3.4, 2.2, 5, 0, 4.4, -1.5);
      cab(B, yel, w - 3.6, 4.2, 4.4, 0, 3.5, -2.2);
      B.box(dark(), w - 3, 1.6, 3.4, 0, 4.2, 2.6);
      B.add(cylGeo(0.26, 0.26, 2, 8), steel(), { pos: [w / 2 - 2.2, 6.6, 1.4] });
      // Blade: a curved mouldboard of overlapping slats, with side wings.
      for (let i = 0; i < 9; i++) {
        const t = i / 8;
        const yy = 0.55 + t * 4.2;
        const zz = z0 + L - 0.6 - Math.sin(t * 1.35) * 1.9;
        B.box(yel, w, 0.78, 0.6, 0, yy, zz, [0.95 - t * 1.05, 0, 0]);
      }
      for (const sx of [-1, 1]) B.box(yel, 0.3, 4.4, 2.4, sx * (w / 2 - 0.15), 2.6, z0 + L - 1.6);
      B.box(M.metal('#6f757c', 0.55), w + 0.1, 0.5, 1, 0, 0.3, z0 + L - 0.4);
      for (const sx of [-1, 1]) {
        B.tube(yel, [sx * (w / 2 - 1.2), 1.6, z0 + 5], [sx * (w / 2 - 0.8), 1.3, z0 + L - 1.6], 0.3, 6);
        B.tube(steel(), [sx * (w / 2 - 2), 3.6, z0 + 4], [sx * (w / 2 - 1.2), 3.4, z0 + L - 2.4], 0.18, 6);
      }
      // Ripper: a beam across the back with three curved shanks.
      B.box(yel, w - 2, 0.9, 1, 0, 2.6, z0 + 0.4);
      for (const sx of [-1, 0, 1]) {
        B.box(steel(0.6), 0.45, 2.6, 0.8, sx * 2.2, 1.5, z0 + 0.2, [0.3, 0, 0]);
        B.box(M.metal('#55585d', 0.6), 0.45, 0.9, 0.5, sx * 2.2, 0.35, z0 - 0.5, [0.55, 0, 0]);
      }
      for (const sx of [-1, 1]) B.tube(yel, [sx * 2.6, 2.6, z0 + 0.6], [sx * 2, 3.6, z0 + 3], 0.22, 5);
      beacon(B, 0, h, -1.5);
      return true;
    }
    case 'loader': {
      // Articulated wheel loader: big wheels, hinge in the middle, bucket out front.
      for (const sx of [-1, 1]) {
        wheel(B, sx * (w / 2 - 1), 3, z0 + 4.5, 3, 2.2, M.painted('#d9dde2', 0.4));
        wheel(B, sx * (w / 2 - 1), 3, z0 + L - 8, 3, 2.2, M.painted('#d9dde2', 0.4));
      }
      // Back end: engine bay and counterweight.
      B.box(yel, w - 1.6, 3, L * 0.34, 0, 3.6, z0 + 4.5);
      B.box(yel, w - 2.2, 2.2, 3, 0, 6.4, z0 + 3.4);
      B.box(M.painted('#2b2f36', 0.6), w - 2.8, 1.2, 2.4, 0, 7.6, z0 + 3.2);
      B.box(yel, w - 1.2, 2.6, 2, 0, 2.6, z0 + 1.2);
      // The hinge, then the front half carrying the arms.
      B.add(cylGeo(1.1, 1.1, w - 3, 14).rotateZ(PI / 2), steel(0.5), { pos: [0, 4, z0 + L * 0.44] });
      B.box(yel, w - 1.8, 2.6, L * 0.3, 0, 3.3, z0 + L - 7.5);
      cab(B, M.painted('#f1f2f4', 0.4), w - 3.4, 5.2, 4.8, 0, 5.1, z0 + L * 0.36);
      // Lift arms, tilt rams and the bucket.
      for (const sx of [-1, 1]) {
        B.tube(yel, [sx * (w / 2 - 1.5), 7.4, z0 + L * 0.42], [sx * (w / 2 - 1.8), 3.2, z0 + L - 2.6], 0.46, 6);
        B.tube(M.metal('#c9ced3', 0.35), [sx * (w / 2 - 1.5), 5.4, z0 + L * 0.46], [sx * (w / 2 - 1.8), 4.2, z0 + L - 5], 0.26, 6);
      }
      bucket(B, w, z0 + L - 2.4, 2.4, { depth: 2.2, height: 3.8, teeth: 6 });
      beacon(B, 0, h, z0 + L * 0.36);
      return true;
    }
    case 'backhoe': {
      // Loader at the front, backhoe boom folded over the back.
      for (const sx of [-1, 1]) {
        wheel(B, sx * (w / 2 - 0.7), 1.5, z0 + L - 4.5, 1.5, 1.2, M.painted('#d9dde2', 0.4));
        wheel(B, sx * (w / 2 - 0.8), 2.3, z0 + 4.5, 2.3, 1.6, M.painted('#d9dde2', 0.4));
      }
      B.box(yel, w - 1.6, 2.2, L - 8, 0, 3, 0);
      B.box(yel, w - 2.6, 2.6, 5, 0, 4.2, z0 + L - 7);
      cab(B, M.painted('#f1f2f4', 0.4), w - 2, 4.4, 5, 0, 4.2, z0 + L * 0.42);
      // Front loader arms and bucket.
      for (const sx of [-1, 1]) B.tube(yel, [sx * (w / 2 - 1), 5.6, z0 + L * 0.5], [sx * (w / 2 - 1.2), 2.6, z0 + L - 1.8], 0.35, 6);
      bucket(B, w - 0.6, z0 + L - 1.8, 1.9, { depth: 1.7, height: 2.9, teeth: 5 });
      // Backhoe: boom up over the cab, dipper hanging, bucket curled.
      B.box(yel, 2.4, 2, 2.4, 0, 3.6, z0 + 1.6);
      B.tube(yel, [0.8, 4.6, z0 + 1.8], [0.8, 10.5, z0 + 5.5], 0.5, 6);
      B.tube(yel, [0.8, 10.5, z0 + 5.5], [0.8, 6.5, z0 + 7.5], 0.42, 6);
      B.tube(yel, [0.8, 6.5, z0 + 7.5], [0.8, 4.6, z0 + 6.4], 0.3, 6);
      B.box(steel(0.6), 1.4, 1.5, 1.5, 0.8, 4, z0 + 6, [0.5, 0, 0]);
      for (const sx of [-1, 1]) B.box(steel(0.6), 0.5, 2.6, 1.4, sx * (w / 2 - 0.4), 1.3, z0 + 1.4, [0.3, 0, 0]);
      beacon(B, 0, h, z0 + L * 0.42);
      return true;
    }
    case 'roller': {
      // Tandem drum roller.
      const drum = M.metal('#c2c7cc', 0.35);
      for (const zz of [z0 + 2.4, z0 + L - 2.4]) {
        B.add(cylGeo(2.2, 2.2, w - 0.4, 20).rotateZ(PI / 2), drum, { pos: [0, 2.2, zz] });
        B.add(cylGeo(2.25, 2.25, 0.3, 20).rotateZ(PI / 2), steel(0.5), { pos: [0, 2.2, zz] });
        B.box(steel(), w - 1, 1, 1, 0, 3.4, zz);
      }
      B.box(yel, w - 1.4, 2.2, L - 8, 0, 3.6, 0);
      B.box(dark(), w - 2, 0.3, L - 9, 0, 4.7, 0);
      B.box(M.upholstery('#2a2c30'), 2, 0.3, 1.8, 0, 4.8, -0.6);
      B.box(M.upholstery('#2a2c30'), 2, 1.5, 0.3, 0, 5.6, -1.5);
      B.box(yel, 2.4, 0.8, 1.4, 0, 5, 1.6);
      for (const sx of [-1, 1]) B.box(steel(), 0.2, h - 5, 0.2, sx * (w / 2 - 0.6), (h - 5) / 2 + 4.8, -1.4);
      B.box(yel, w, 0.25, 3.4, 0, h, -0.8);
      beacon(B, w / 2 - 0.8, h, -0.8);
      return true;
    }
    case 'telehandler': {
      // Telescopic handler: boom along the side, forks out front.
      for (const sx of [-1, 1]) {
        wheel(B, sx * (w / 2 - 0.7), 2, z0 + 3.4, 2, 1.5, M.painted('#d9dde2', 0.4));
        wheel(B, sx * (w / 2 - 0.7), 2, z0 + L - 5.5, 2, 1.5, M.painted('#d9dde2', 0.4));
      }
      B.box(yel, w - 1, 2.4, L - 5, 0, 2.9, 0);
      cab(B, M.painted('#f1f2f4', 0.4), 3.4, 5, 5, -(w / 2 - 2), 4.1, z0 + L * 0.4);
      B.box(yel, 3.2, 3.4, L - 8, w / 2 - 1.8, 4.6, -1);
      // The boom, part extended, with the carriage and forks.
      const by = 7.6;
      B.box(yel, 2.6, 2.4, L * 0.72, 0.6, by, z0 + L * 0.3, [-0.12, 0, 0]);
      B.box(M.painted('#d9dde2', 0.4), 2.1, 1.9, L * 0.5, 0.6, by + 1.4, z0 + L * 0.72, [-0.12, 0, 0]);
      B.box(steel(0.5), 3.6, 2.6, 0.5, 0.6, by + 1.2, z0 + L - 0.6);
      for (const sx of [-1, 1]) {
        B.box(steel(0.6), 0.5, 0.35, 3.6, 0.6 + sx * 1.2, by + 0.1, z0 + L + 1.2);
        B.box(steel(0.6), 0.5, 2.4, 0.4, 0.6 + sx * 1.2, by + 1.1, z0 + L - 0.3);
      }
      for (const sx of [-1, 1]) B.box(steel(0.6), 0.45, 2.4, 1.2, sx * (w / 2 - 0.3), 1.2, z0 + L - 4, [0.35, 0, 0]);
      beacon(B, -(w / 2 - 2), h, z0 + L * 0.4);
      return true;
    }
    case 'boomlift': {
      // Articulating boom lift with the basket up high.
      for (const sx of [-1, 1]) {
        wheel(B, sx * (w / 2 - 0.6), 1.5, z0 + 2.4, 1.5, 1.2, M.painted('#2b2f36', 0.5));
        wheel(B, sx * (w / 2 - 0.6), 1.5, z0 + L - 2.4, 1.5, 1.2, M.painted('#2b2f36', 0.5));
      }
      B.box(M.painted(color || '#e05a20', 0.45), w - 0.6, 1.8, L - 2, 0, 2.2, 0);
      B.add(cylGeo(2.2, 2.4, 1.6, 16), M.painted(color || '#e05a20', 0.45), { pos: [0, 3.9, -1] });
      B.box(dark(), 3, 1.8, 3, 0, 4.6, -2.6);
      const topY = h - 3.4;
      B.tube(M.painted(color || '#e05a20', 0.45), [0, 4.4, -1], [0, topY * 0.72, 2.6], 0.6, 8);
      B.tube(M.painted(color || '#e05a20', 0.45), [0, topY * 0.72, 2.6], [0, topY, 0.4], 0.5, 8);
      B.tube(steel(), [0, topY, 0.4], [0, topY + 0.6, 2.4], 0.3, 6);
      // The basket, with its rails and toe boards.
      B.box(M.metal('#8c9299', 0.5), 4.6, 0.2, 2.8, 0, topY + 0.6, 3.6);
      for (const sx of [-1, 1]) for (const zz of [-1.3, 1.3]) B.box(steel(), 0.14, 3.4, 0.14, sx * 2.2, topY + 2.3, 3.6 + zz);
      for (const yy of [1.6, 3.2]) {
        B.box(steel(), 4.6, 0.12, 0.12, 0, topY + 0.6 + yy, 2.3);
        B.box(steel(), 4.6, 0.12, 0.12, 0, topY + 0.6 + yy, 4.9);
        for (const sx of [-1, 1]) B.box(steel(), 0.12, 0.12, 2.8, sx * 2.2, topY + 0.6 + yy, 3.6);
      }
      B.box(M.plastic('#e8e3d4', 0.8), 4.4, 0.8, 2.6, 0, topY + 0.8, 3.6);
      beacon(B, 0, 5.5, -2.6);
      return true;
    }
    case 'dumper': {
      // Articulated site dumper with the skip tipped down.
      for (const sx of [-1, 1]) {
        wheel(B, sx * (w / 2 - 1.1), 2.6, z0 + 4, 2.6, 2.1, M.painted('#d9dde2', 0.4));
        wheel(B, sx * (w / 2 - 1.1), 2.6, z0 + L - 4, 2.6, 2.1, M.painted('#d9dde2', 0.4));
        wheel(B, sx * (w / 2 - 1.1), 2.6, z0 + L - 8.5, 2.6, 2.1, M.painted('#d9dde2', 0.4));
      }
      B.box(yel, w - 1.6, 2.2, L - 6, 0, 3.4, 0);
      cab(B, yel, w - 3, 4.6, 5, 0, 4.5, z0 + L - 5.5);
      B.box(yel, w - 2.6, 2.6, 3.4, 0, 3.6, z0 + L - 1.6);
      // The body: a tapered skip.
      const bg = new THREE.BoxGeometry(w - 0.8, 4.4, L * 0.52);
      const p = bg.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const t = (p.getY(i) + 2.2) / 4.4;
        p.setX(i, p.getX(i) * (0.72 + t * 0.28));
        p.setZ(i, p.getZ(i) * (0.86 + t * 0.14));
      }
      bg.computeVertexNormals();
      B.add(bg, yel, { pos: [0, 6, z0 + L * 0.3] });
      B.cone(M.dirt('#8a7558'), w / 2 - 1, 1.6, 0, 7.4, z0 + L * 0.3, 10);
      beacon(B, 0, h, z0 + L - 5.5);
      return true;
    }
    case 'minidigger': {
      // Mini excavator: rubber tracks, a house that slews, a small boom.
      for (const sx of [-1, 1]) track(B, sx * (w / 2 - 0.55), z0 + 0.6, z0 + L - 2.4, 1, 1.1);
      B.box(steel(0.6), w - 0.4, 0.5, L - 3.6, 0, 1.9, -0.8);
      B.add(cylGeo(2.1, 2.2, 0.5, 18), yel, { pos: [0, 2.3, -0.8] });
      B.box(yel, w - 0.6, 2.6, L * 0.44, 0, 3.6, -1.6);
      cab(B, yel, w - 1.6, 4.4, 3.6, -0.3, 2.6, -1.2, { tint: true });
      B.box(steel(0.6), w, 0.45, 1.6, 0, 0.9, z0 + L - 0.9);        // dozer blade
      B.tube(yel, [0.7, 3.4, 0.8], [0.7, 8.4, 2.8], 0.45, 6);
      B.tube(yel, [0.7, 8.4, 2.8], [0.7, 4.2, 5.4], 0.38, 6);
      B.box(steel(0.55), 1.3, 1.6, 1.4, 0.7, 2.6, 5.9, [0.6, 0, 0]);
      for (let i = 0; i < 4; i++) B.box(steel(0.7), 0.12, 0.5, 0.4, 0.7 - 0.45 + i * 0.3, 1.95, 6.4, [0.6, 0, 0]);
      beacon(B, -0.3, 7.2, -1.2);
      return true;
    }
    case 'concretepump': {
      // Line pump on a trailer chassis, outriggers down, boom folded.
      B.box(M.painted('#d9dde2', 0.4), w, 1.6, L - 2, 0, 3, 0);
      for (const sx of [-1, 1]) {
        wheel(B, sx * (w / 2 - 0.6), 1.8, z0 + 4, 1.8, 1.4);
        wheel(B, sx * (w / 2 - 0.6), 1.8, z0 + 7.5, 1.8, 1.4);
        for (const zz of [z0 + 2.5, z0 + L - 3]) {
          B.box(steel(0.5), 0.7, 0.7, 2.4, sx * (w / 2 + 0.8), 3, zz);
          B.box(steel(0.5), 0.6, 3, 0.6, sx * (w / 2 + 1.8), 1.5, zz);
          B.box(steel(0.6), 1.6, 0.4, 1.6, sx * (w / 2 + 1.8), 0.2, zz);
        }
      }
      B.box(M.painted(color || '#c0392b', 0.45), w - 1, 3, 7, 0, 3.8, z0 + 3.5);
      B.box(steel(0.5), w - 1.6, 2, 4, 0, 4.4, z0 + L - 5);
      B.add(cylGeo(0.5, 0.5, 6, 12).rotateX(PI / 2), M.metal('#8c9299', 0.4), { pos: [0, 7.4, z0 + 6] });
      B.tube(M.painted(color || '#c0392b', 0.45), [0, 7.8, z0 + 4], [0, h - 1, z0 + L - 3], 0.5, 8);
      B.tube(M.painted(color || '#c0392b', 0.45), [0, h - 1, z0 + L - 3], [0, h - 2.5, z0 + 5], 0.42, 8);
      B.box(M.plastic('#2b2f36', 0.7), 2.4, 1, 2.4, 0, 5.4, z0 + L - 1.4);
      return true;
    }
    case 'sitecabin': {
      // A stacked pair of site cabins with a stair and a landing.
      const body = M.painted(color || '#e9eaea', 0.45);
      const bandM = M.painted('#2e6f8e', 0.5);
      for (let k = 0; k < 2; k++) {
        const y = 0.8 + k * (h - 1.4) / 2;
        const bh = (h - 1.6) / 2;
        B.box(body, w, bh, L, 0, y + bh / 2, 0);
        B.box(bandM, w + 0.06, 0.8, L + 0.06, 0, y + bh - 0.6, 0);
        B.box(M.metal('#9aa1a8', 0.4), w + 0.12, 0.25, L + 0.12, 0, y + bh, 0);
        // Windows and a door on the long side.
        for (let i = 0; i < Math.max(2, Math.round(L / 8)); i++) {
          B.box(M.clearGlass('#9fc0cc'), 0.08, 2.6, 4, w / 2 + 0.02, y + bh - 2.2, -L / 2 + 4 + i * (L / Math.max(2, Math.round(L / 8))));
        }
        B.box(M.painted('#55585d', 0.5), 0.1, 6.6, 3, w / 2 + 0.02, y + 3.3, L / 2 - 3);
      }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box(steel(0.6), 0.6, 0.8, 0.6, sx * (w / 2 - 0.3), 0.4, sz * (L / 2 - 0.3));
      // Stair up to the landing.
      const ly = 0.8 + (h - 1.4) / 2;
      B.box(M.metal('#8c9299', 0.5), 5, 0.2, L * 0.6, w / 2 + 2.5, ly, L * 0.1);
      for (let i = 0; i < 8; i++) B.box(M.metal('#8c9299', 0.5), 4, 0.15, 0.9, w / 2 + 2.5, 0.9 + i * (ly - 0.9) / 8, -L * 0.2 - i * 1);
      for (const sz of [-1, 1]) for (let i = 0; i <= 4; i++) {
        B.box(steel(), 0.12, 3.4, 0.12, w / 2 + 0.6 + i * 1.2, ly + 1.7, L * 0.1 + sz * (L * 0.3 - 0.2));
      }
      for (const sz of [-1, 1]) B.box(steel(), 5, 0.12, 0.12, w / 2 + 2.5, ly + 3.4, L * 0.1 + sz * (L * 0.3 - 0.2));
      return true;
    }
    default:
      return false;
  }
  void [r, paint];
}
