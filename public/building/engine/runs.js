/* Ductwork and pipework.
 *
 * A run is a list of points in plan feet with a height (x east, y toward the
 * street, z up). Between them it is drawn as rectangular or spiral duct,
 * insulated pipe pairs, cable tray, conduit or a gas main, with elbows at the
 * corners — and it is held up by whatever is underneath it: stands on a
 * roof, straps on a wall, sleepers on the ground, and steel portals where it
 * crosses open ground between buildings. Built in world space. */

import * as THREE from 'three';
import { Builder } from './builder.js';
import * as M from './materials.js';
import { RUN_BY_ID } from '../catalog.js';

const UP = new THREE.Vector3(0, 1, 0);
const X = new THREE.Vector3(1, 0, 0);

/** A frame for a segment: x along it, y "up" across it, z the other way. */
function frame(a, b) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  dir.normalize();
  const ref = Math.abs(dir.y) > 0.95 ? X : UP;
  const side = new THREE.Vector3().crossVectors(dir, ref).normalize();
  const up = new THREE.Vector3().crossVectors(side, dir).normalize();
  return { dir, side, up, len };
}

/** A box along a segment with the given cross-section. */
function segBox(B, mat, a, b, w, h, f = frame(a, b)) {
  if (f.len < 0.01) return;
  const g = new THREE.BoxGeometry(f.len, h, w);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * f.len, uv.getY(i) * Math.max(w, h));
  const m = new THREE.Matrix4().makeBasis(f.dir, f.up, f.side);
  m.setPosition(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5));
  g.applyMatrix4(m);
  B.add(g, mat);
}

const vec = (p) => new THREE.Vector3(p.x, p.z, p.y);

/**
 * Build one run. `under(x, y)` tells the supports what is below a point:
 * { roof: height or null, wall: true when a building wall is close by }.
 */
export function buildRun(o, under = () => ({ roof: null, wall: false })) {
  const B = new Builder();
  const spec = RUN_BY_ID[o.style] || RUN_BY_ID.duct;
  const size = o.size || spec.size;
  const color = o.color || spec.color;
  const pts = (o.points || []).map(vec);
  if (pts.length < 2) return B;
  const style = o.style || 'duct';
  const body = style === 'duct' || style === 'spiral' || style === 'tray' || style === 'conduit'
    ? M.metal(color, 0.34)
    : M.painted(color, 0.35);
  const steel = M.painted('#5d646c', 0.5);
  const dw = size;
  const dh = style === 'duct' ? size * 0.65 : style === 'tray' ? 0.5 : size;

  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const f = frame(a, b);
    if (f.len < 0.05) continue;
    switch (style) {
      case 'duct': {
        segBox(B, body, a, b, dw, dh, f);
        // Flanged joints every five feet.
        for (let t = 5; t < f.len - 0.5; t += 5) {
          const p = a.clone().addScaledVector(f.dir, t);
          segBox(B, M.metal('#9aa1a8', 0.4), p.clone().addScaledVector(f.dir, -0.12), p.clone().addScaledVector(f.dir, 0.12), dw + 0.25, dh + 0.25);
        }
        break;
      }
      case 'spiral': {
        B.tube(body, a.toArray(), b.toArray(), size / 2, 16);
        for (let t = 4; t < f.len - 0.4; t += 4) {
          const p = a.clone().addScaledVector(f.dir, t);
          B.tube(M.metal('#9aa1a8', 0.4), p.clone().addScaledVector(f.dir, -0.08).toArray(), p.clone().addScaledVector(f.dir, 0.08).toArray(), size / 2 + 0.06, 16);
        }
        break;
      }
      case 'pipes': {
        // Flow and return under aluminium cladding, with coloured bands.
        const r = size * 0.24;
        for (const [k, band] of [[-1, '#c0392b'], [1, '#2c5f8a']]) {
          const off = f.side.clone().multiplyScalar(k * size * 0.3);
          const pa = a.clone().add(off);
          const pb = b.clone().add(off);
          B.tube(M.metal('#e3e7ea', 0.22), pa.toArray(), pb.toArray(), r, 12);
          for (let t = 6; t < f.len - 0.5; t += 12) {
            const p = pa.clone().addScaledVector(f.dir, t);
            B.tube(M.painted(band, 0.4), p.clone().addScaledVector(f.dir, -0.4).toArray(), p.clone().addScaledVector(f.dir, 0.4).toArray(), r + 0.03, 12);
          }
        }
        break;
      }
      case 'tray': {
        const base = a.clone().addScaledVector(f.up, -dh / 2);
        const baseB = b.clone().addScaledVector(f.up, -dh / 2);
        segBox(B, body, base, baseB, dw, 0.08, f);
        for (const k of [-1, 1]) {
          const off = f.side.clone().multiplyScalar(k * dw / 2).addScaledVector(f.up, -dh / 4);
          segBox(B, body, a.clone().add(off), b.clone().add(off), 0.08, dh / 2, f);
        }
        for (let k = -1; k <= 1; k++) {
          const off = f.side.clone().multiplyScalar(k * dw * 0.25).addScaledVector(f.up, -dh / 2 + 0.15);
          B.tube(M.plastic('#1d2125', 0.6), a.clone().add(off).toArray(), b.clone().add(off).toArray(), 0.1, 6);
        }
        break;
      }
      case 'conduit': {
        for (let k = -1; k <= 1; k++) {
          const off = f.side.clone().multiplyScalar(k * 0.3);
          B.tube(body, a.clone().add(off).toArray(), b.clone().add(off).toArray(), 0.12, 8);
        }
        break;
      }
      default: {
        B.tube(body, a.toArray(), b.toArray(), size / 2, 12);
        break;
      }
    }
    supports(B, a, b, f, { dw, dh, steel, under, style });
  }

  // Elbows at every bend, and caps at the ends.
  pts.forEach((p, i) => {
    if (style === 'duct') B.box(body, dw + 0.05, dh + 0.05, dw + 0.05, p.x, p.y, p.z);
    else if (style === 'spiral' || style === 'gas') B.sphere(body, size / 2 + 0.02, p.x, p.y, p.z, { seg: 14 });
    else if (style === 'pipes') {
      const f = i ? frame(pts[i - 1], p) : frame(p, pts[1]);
      for (const k of [-1, 1]) {
        const q = p.clone().addScaledVector(f.side, k * size * 0.3);
        B.sphere(M.metal('#e3e7ea', 0.22), size * 0.25, q.x, q.y, q.z, { seg: 12 });
      }
    }
  });
  return B;
}

/** Whatever holds a segment up, sampled along it. */
function supports(B, a, b, f, { dw, dh, steel, under, style }) {
  const vertical = Math.abs(f.dir.y) > 0.8;
  if (vertical) {
    // Straps round it as it runs down a wall.
    for (let t = 3; t < f.len; t += 6) {
      const p = a.clone().addScaledVector(f.dir, t);
      B.box(steel, dw + 0.5, 0.25, dw + 0.5, p.x, p.y, p.z);
    }
    return;
  }
  const step = 8;
  let lastPortal = -99;
  for (let t = Math.min(3, f.len / 2); t < f.len; t += step) {
    const p = a.clone().addScaledVector(f.dir, t);
    const below = under(p.x, p.z);
    const bottom = p.y - dh / 2;
    const side = f.side.clone();
    if (below.roof != null && bottom - below.roof > 0.15 && bottom - below.roof < 16) {
      // A stand on the roof: two legs, a cross-bar and rubber pads.
      const legH = bottom - below.roof;
      for (const k of [-1, 1]) {
        const q = p.clone().addScaledVector(side, k * (dw / 2 + 0.25));
        B.box(steel, 0.22, legH, 0.22, q.x, below.roof + legH / 2, q.z);
        B.box(M.rubber(), 0.9, 0.18, 0.9, q.x, below.roof + 0.09, q.z);
      }
      segBox(B, steel, p.clone().addScaledVector(side, -(dw / 2 + 0.35)).setY(bottom - 0.12), p.clone().addScaledVector(side, dw / 2 + 0.35).setY(bottom - 0.12), 0.3, 0.24);
    } else if (below.roof == null && below.wall) {
      // A bracket off the wall it runs along.
      B.box(steel, 0.3, 0.3, 0.3, p.x, bottom - 0.2, p.z);
      B.box(steel, dw + 0.6, 0.22, 0.22, p.x, bottom - 0.15, p.z, [0, -Math.atan2(f.dir.z, f.dir.x) + Math.PI / 2, 0]);
    } else if (below.roof == null) {
      if (bottom < 4) {
        // Sleepers on the ground.
        B.box(M.concrete('#b8b3a8'), dw + 1.2, Math.max(0.3, bottom), 1.2, p.x, Math.max(0.3, bottom) / 2, p.z, [0, -Math.atan2(f.dir.z, f.dir.x) + Math.PI / 2, 0]);
      } else if (t - lastPortal >= 18) {
        // A steel portal where the run crosses open ground.
        lastPortal = t;
        for (const k of [-1, 1]) {
          const q = p.clone().addScaledVector(side, k * (dw / 2 + 1.2));
          B.box(steel, 0.6, bottom, 0.6, q.x, bottom / 2, q.z);
          B.box(M.concrete('#a8a59d'), 1.6, 0.4, 1.6, q.x, 0.2, q.z);
        }
        segBox(B, steel, p.clone().addScaledVector(side, -(dw / 2 + 1.5)).setY(bottom - 0.3), p.clone().addScaledVector(side, dw / 2 + 1.5).setY(bottom - 0.3), 0.6, 0.6);
      }
    }
  }
  void style;
}

/** Points to add to go from a to b with square corners: rise first if b is
 *  higher, travel at the higher level, drop at the far end if b is lower. */
export function squarePath(a, b) {
  const out = [];
  const hi = Math.max(a.z, b.z);
  if (b.z > a.z + 0.3) out.push({ x: a.x, y: a.y, z: hi });
  if (Math.abs(b.x - a.x) > 0.3 && Math.abs(b.y - a.y) > 0.3) {
    // Take the longer leg first.
    if (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)) out.push({ x: b.x, y: a.y, z: hi });
    else out.push({ x: a.x, y: b.y, z: hi });
  }
  if (a.z > b.z + 0.3) out.push({ x: b.x, y: b.y, z: hi });
  out.push({ ...b });
  // Drop repeats.
  const clean = [];
  let prev = a;
  for (const p of out) {
    if (Math.hypot(p.x - prev.x, p.y - prev.y, p.z - prev.z) > 0.05) clean.push(p);
    prev = p;
  }
  return clean;
}
