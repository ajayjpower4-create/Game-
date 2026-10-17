/* Detailed cars, by make and model.
 *
 * A body is a stack of cross-sections lofted into a smooth skin: a lower body
 * (bumpers, hood, doors, deck) with real wheel openings and wells, and a
 * greenhouse (windscreen, side glass, roof, rear window) on top. Everything
 * else — lamps, grilles, panel gaps, pillars, trim, handles, badges, plates —
 * is drawn in a front, rear, side or top view and laid onto that skin, so it
 * follows every curve of the body the way the real part does. Wheels have
 * profiled tyres with tread, spoked rims, brake discs and calipers; the cabin
 * has seats, a dashboard and a steering wheel you can see through the glass.
 *
 * Frame: x across (right side positive), y up, z along the car with the
 * FRONT at -z, like every other vehicle in the game. Feet throughout. */

import * as THREE from 'three';
import { Builder, boxGeo, cylGeo } from './builder.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as M from './materials.js';
import { CAR_BY_ID } from '../vehiclelist.js';

const PI = Math.PI;
// 1 = full detail; 0 = lighter, for crowds of parked cars and traffic.
let DETAIL = 1;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ================================================================ curves */

/** A smooth curve through [t, value] keys that never overshoots them. */
export function spline(keys) {
  const k = [...keys].sort((a, b) => a[0] - b[0]);
  const n = k.length;
  if (n === 1) return () => k[0][1];
  const xs = k.map((p) => p[0]);
  const ys = k.map((p) => p[1]);
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / Math.max(1e-9, xs[i + 1] - xs[i]));
  const m = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) { const tau = 3 / Math.sqrt(s); m[i] = tau * a * d[i]; m[i + 1] = tau * b * d[i]; }
  }
  return (t) => {
    if (t <= xs[0]) return ys[0];
    if (t >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && t > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const s = (t - xs[i]) / h;
    const s2 = s * s;
    const s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * ys[i] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * ys[i + 1] + (s3 - s2) * h * m[i + 1];
  };
}

/* ================================================================ shells */

/** A surface as cross-sections along z: each section is the right half,
 *  [[x, y], ...] from the bottom centre round to the top centre. */
class Shell {
  constructor() { this.st = []; }
  add(z, pts, meta = {}) { this.st.push({ z, pts, ...meta }); }
  get z0() { return this.st[0].z; }
  get z1() { return this.st[this.st.length - 1].z; }
  /** The section at any z, blended from the two either side. */
  at(z) {
    const s = this.st;
    if (z <= s[0].z) return s[0].pts;
    if (z >= s[s.length - 1].z) return s[s.length - 1].pts;
    let lo = 0;
    let hi = s.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (s[mid].z <= z) lo = mid; else hi = mid; }
    const a = s[lo];
    const b = s[hi];
    const k = (z - a.z) / Math.max(1e-9, b.z - a.z);
    return a.pts.map((p, i) => [p[0] + (b.pts[i][0] - p[0]) * k, p[1] + (b.pts[i][1] - p[1]) * k]);
  }
}

/** The outermost x of a section at height y (null if the section misses it). */
function xAt(pts, y) {
  let best = null;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    if ((y0 - y) * (y1 - y) > 0) continue;
    const x = Math.abs(y1 - y0) < 1e-9 ? Math.max(x0, x1) : x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
    if (best === null || x > best) best = x;
  }
  return best;
}

/** The highest y of a section at x. */
function yAt(pts, x) {
  let best = null;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    if ((x0 - x) * (x1 - x) > 0) continue;
    const y = Math.abs(x1 - x0) < 1e-9 ? Math.max(y0, y1) : y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    if (best === null || y > best) best = y;
  }
  return best;
}

/**
 * The outside of the car, for laying parts onto: given a point in a front,
 * rear, side or top view, where does it land on the skin, and which way does
 * the skin face there?
 */
class Skin {
  constructor(shells) {
    this.shells = shells;
    this.z0 = Math.min(...shells.map((s) => s.z0));
    this.z1 = Math.max(...shells.map((s) => s.z1));
  }

  sideX(z, y) {
    let best = null;
    for (const sh of this.shells) {
      if (z < sh.z0 || z > sh.z1) continue;
      const x = xAt(sh.at(z), y);
      if (x !== null && (best === null || x > best)) best = x;
    }
    return best;
  }

  topY(x, z) {
    let best = null;
    for (const sh of this.shells) {
      if (z < sh.z0 || z > sh.z1) continue;
      const y = yAt(sh.at(z), Math.abs(x));
      if (y !== null && (best === null || y > best)) best = y;
    }
    return best;
  }

  /** The first z, from the front (or from the back), where (x, y) is on the car. */
  endZ(x, y, rear) {
    const ax = Math.abs(x);
    const inside = (z) => { const s = this.sideX(z, y); return s !== null && s >= ax - 1e-6; };
    const N = 80;
    let prev = rear ? this.z1 : this.z0;
    for (let k = 0; k <= N; k++) {
      const z = rear ? this.z1 - ((this.z1 - this.z0) * k) / N : this.z0 + ((this.z1 - this.z0) * k) / N;
      if (inside(z)) {
        if (k === 0) return z;
        let a = prev;
        let b = z;
        for (let it = 0; it < 16; it++) { const m = (a + b) / 2; if (inside(m)) b = m; else a = m; }
        return b;
      }
      prev = z;
    }
    return null;
  }

  /** Where a point drawn in a view lands: { p: [x, y, z], n: [x, y, z] }. */
  hit(view, a, b) {
    const h = 0.03;
    if (view === 'side') {
      const x = this.sideX(a, b);
      if (x === null) return null;
      const dz = (this.sideX(a + h, b) ?? x) - (this.sideX(a - h, b) ?? x);
      const dy = (this.sideX(a, b + h) ?? x) - (this.sideX(a, b - h) ?? x);
      return { p: [x, b, a], n: norm([1, -dy / (2 * h), -dz / (2 * h)]) };
    }
    if (view === 'top') {
      const y = this.topY(a, b);
      if (y === null) return null;
      const dx = (this.topY(a + h, b) ?? y) - (this.topY(a - h, b) ?? y);
      const dz = (this.topY(a, b + h) ?? y) - (this.topY(a, b - h) ?? y);
      return { p: [a, y, b], n: norm([-dx / (2 * h), 1, -dz / (2 * h)]) };
    }
    const rear = view === 'rear';
    const z = this.endZ(a, b, rear);
    if (z === null) return null;
    const zx = (this.endZ(a + h, b, rear) ?? z) - (this.endZ(a - h, b, rear) ?? z);
    const zy = (this.endZ(a, b + h, rear) ?? z) - (this.endZ(a, b - h, rear) ?? z);
    const s = rear ? -1 : 1;
    return { p: [a, b, z], n: norm([s * zx / (2 * h), s * zy / (2 * h), -s]) };
  }
}

/** How squarely a view looks at the skin there: parts are not laid onto
 *  surfaces seen edge-on (they would smear round the corner). */
const VIEW_DIR = { front: [0, 0, -1], rear: [0, 0, 1], side: [1, 0, 0], top: [0, 1, 0] };
function facing(view, h, min = 0.3) {
  return h && dot(VIEW_DIR[view], h.n) >= min ? h : null;
}

function norm(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/* ================================================================ lofting */

/**
 * Skin a shell: quads between neighbouring sections, the material for each
 * picked by zone(i, j) (null leaves a hole). Normals come from the whole grid,
 * so the shading runs smoothly across material borders. Mirrored to the left.
 */
function loft(B, shell, zone, { mirror = true, flip = false, caps = false, capMat = null, flat = false } = {}) {
  const S = shell.st;
  const ns = S.length;
  const np = S[0].pts.length;
  const P = (i, j) => [S[i].pts[j][0], S[i].pts[j][1], S[i].z];
  if (flat) {
    // Every quad its own flat facet: crisp creases between panels.
    for (let i = 0; i < ns - 1; i++) {
      for (let j = 0; j < np - 1; j++) {
        const m = zone(i, j);
        if (!m) continue;
        const a = P(i, j);
        const b = P(i + 1, j);
        const c = P(i + 1, j + 1);
        const d = P(i, j + 1);
        for (const side of mirror ? [1, -1] : [1]) {
          const f = (p) => [p[0] * side, p[1], p[2]];
          // Wound to face out: right side a-d-c-b, left side the reverse.
          if (side > 0) B.quad(m, f(a), f(d), f(c), f(b)); else B.quad(m, f(a), f(b), f(c), f(d));
        }
      }
    }
    if (caps) loftCaps(B, S, mirror, capMat);
    return;
  }
  // Grid normals: across the section × along the car.
  const N = [];
  for (let i = 0; i < ns; i++) {
    for (let j = 0; j < np; j++) {
      const tj = sub3(P(i, Math.min(np - 1, j + 1)), P(i, Math.max(0, j - 1)));
      const ti = sub3(P(Math.min(ns - 1, i + 1), j), P(Math.max(0, i - 1), j));
      let n = cross(tj, ti);
      if (Math.hypot(...n) < 1e-9) n = [0, 1, 0];
      n = norm(n);
      if (flip) n = [-n[0], -n[1], -n[2]];
      N.push(n);
    }
  }
  const byMat = new Map();
  for (let i = 0; i < ns - 1; i++) {
    for (let j = 0; j < np - 1; j++) {
      const m = zone(i, j);
      if (!m) continue;
      if (!byMat.has(m)) byMat.set(m, []);
      byMat.get(m).push([i, j]);
    }
  }
  for (const [m, quads] of byMat) {
    for (const side of mirror ? [1, -1] : [1]) {
      const map = new Map();
      const pos = [];
      const nor = [];
      const uv = [];
      const idx = [];
      const vid = (i, j) => {
        const k = i * np + j;
        let v = map.get(k);
        if (v === undefined) {
          v = pos.length / 3;
          map.set(k, v);
          const p = P(i, j);
          const n = N[k];
          pos.push(p[0] * side, p[1], p[2]);
          nor.push(n[0] * side, n[1], n[2]);
          uv.push(p[2], p[1] + p[0]);
        }
        return v;
      };
      const out = (side > 0) !== flip;
      for (const [i, j] of quads) {
        const a = vid(i, j);
        const b = vid(i + 1, j);
        const c = vid(i + 1, j + 1);
        const d = vid(i, j + 1);
        if (out) idx.push(a, d, c, a, c, b); else idx.push(a, c, d, a, b, c);
      }
      B.add(geometry(pos, nor, uv, idx), m);
    }
  }
  if (caps) loftCaps(B, S, mirror, capMat);
}

/** Close the two ends of a shell (front and back faces) with fans. */
function loftCaps(B, S, mirror, capMat) {
  const ns = S.length;
  {
    for (const [i, dir] of [[0, -1], [ns - 1, 1]]) {
      const pts = S[i].pts;
      const z = S[i].z;
      const cy = (pts[0][1] + pts[pts.length - 1][1]) / 2;
      for (const side of mirror ? [1, -1] : [1]) {
        const pos = [0, cy, z];
        const nor = [0, 0, dir];
        const uv = [0, cy];
        const idx = [];
        for (const p of pts) { pos.push(p[0] * side, p[1], z); nor.push(0, 0, dir); uv.push(p[0], p[1]); }
        for (let k = 1; k < pts.length; k++) {
          const a = k;
          const b = k + 1;
          // Facing out of the end it closes.
          const ccw = (dir > 0) === (side > 0);
          if (ccw) idx.push(0, a, b); else idx.push(0, b, a);
        }
        B.add(geometry(pos, nor, uv, idx), capMat);
      }
    }
  }
}

function geometry(pos, nor, uv, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** A copy reflected to the other side of the car. */
function mirrored(g) {
  const m = g.clone();
  const p = m.attributes.position;
  const n = m.attributes.normal;
  for (let i = 0; i < p.count; i++) { p.setX(i, -p.getX(i)); if (n) n.setX(i, -n.getX(i)); }
  const idx = m.index.array;
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  return m;
}

/* ================================================================ parts laid on the skin */

/** Resample a polyline so no step is longer than `step`. */
function resample(line, step, closed = false) {
  const src = closed ? [...line, line[0]] : line;
  const out = [];
  for (let i = 0; i < src.length - 1; i++) {
    const [a0, b0] = src[i];
    const [a1, b1] = src[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(a1 - a0, b1 - b0) / step));
    for (let k = 0; k < n; k++) out.push([a0 + ((a1 - a0) * k) / n, b0 + ((b1 - b0) * k) / n]);
  }
  if (!closed) out.push(src[src.length - 1]);
  return out;
}

function subdivide(verts, faces) {
  const cache = new Map();
  const v = [...verts];
  const mid = (i, j) => {
    const key = i < j ? `${i},${j}` : `${j},${i}`;
    let k = cache.get(key);
    if (k === undefined) { k = v.length; v.push([(v[i][0] + v[j][0]) / 2, (v[i][1] + v[j][1]) / 2]); cache.set(key, k); }
    return k;
  };
  const f = [];
  for (const [a, b, c] of faces) {
    const ab = mid(a, b);
    const bc = mid(b, c);
    const ca = mid(c, a);
    f.push([a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]);
  }
  return [v, f];
}

/**
 * A flat shape drawn in a view, laid onto the skin and lifted `off` off it:
 * lamps, grilles, plates, pillars, intakes. Mirrored to the other side unless
 * it already spans both.
 */
function decal(B, mat, skin, view, poly, { off = 0.01, sub = 2, mirror = true, uv = null, step = 0.25 } = {}) {
  let contour = resample(poly, step, true).map(([a, b]) => new THREE.Vector2(a, b));
  if (THREE.ShapeUtils.isClockWise(contour)) contour = contour.reverse();
  const tris = THREE.ShapeUtils.triangulateShape(contour, []);
  let verts = contour.map((p) => [p.x, p.y]);
  let faces = tris.map((t) => [t[0], t[1], t[2]]);
  for (let k = 0; k < (DETAIL ? sub : Math.min(sub, 1)); k++) [verts, faces] = subdivide(verts, faces);
  const hits = verts.map(([a, b]) => facing(view, skin.hit(view, a, b), 0.22));
  let minA = Infinity;
  let maxA = -Infinity;
  let minB = Infinity;
  let maxB = -Infinity;
  for (const [a, b] of verts) { minA = Math.min(minA, a); maxA = Math.max(maxA, a); minB = Math.min(minB, b); maxB = Math.max(maxB, b); }
  const pos = [];
  const nor = [];
  const uvs = [];
  const idx = [];
  const map = new Map();
  const vid = (i) => {
    let k = map.get(i);
    if (k === undefined) {
      k = pos.length / 3;
      map.set(i, k);
      const h = hits[i];
      pos.push(...add3(h.p, h.n, off));
      nor.push(...h.n);
      if (uv === 'fit') {
        // Text reads left to right as seen from the side it is on.
        const f = (verts[i][0] - minA) / Math.max(1e-6, maxA - minA);
        uvs.push(view === 'rear' ? f : 1 - f, (verts[i][1] - minB) / Math.max(1e-6, maxB - minB));
      } else uvs.push(verts[i][0], verts[i][1]);
    }
    return k;
  };
  for (const [a, b, c] of faces) {
    if (!hits[a] || !hits[b] || !hits[c]) continue;
    const ia = vid(a);
    const ib = vid(b);
    const ic = vid(c);
    // Face the way the skin faces.
    const pa = pos.slice(ia * 3, ia * 3 + 3);
    const pb = pos.slice(ib * 3, ib * 3 + 3);
    const pc = pos.slice(ic * 3, ic * 3 + 3);
    const fn = cross(sub3(pb, pa), sub3(pc, pa));
    if (dot(fn, hits[a].n) >= 0) idx.push(ia, ib, ic); else idx.push(ia, ic, ib);
  }
  if (!idx.length) return;
  const g = geometry(pos, nor, uvs, idx);
  B.add(g, mat);
  if (mirror) B.add(mirrored(g), mat);
}

/**
 * A strip laid along a line drawn in a view: panel gaps, chrome trim, LED
 * light bars, wiper blades. `raise` gives it height off the skin (a trim
 * strip you can see the edge of).
 */
function ribbon(B, mat, skin, view, line, width, { off = 0.006, mirror = true, closed = false, raise = 0, step = 0.05 } = {}) {
  const pts = resample(line, DETAIL ? step : Math.max(step, 0.16), closed);
  if (!DETAIL) raise = 0;
  if (closed) pts.push(pts[0]);
  const hits = pts.map(([a, b]) => facing(view, skin.hit(view, a, b), 0.18));
  // Runs of points that landed.
  let run = [];
  const runs = [];
  for (const h of hits) { if (h) run.push(h); else { if (run.length > 1) runs.push(run); run = []; } }
  if (run.length > 1) runs.push(run);
  for (const r of runs) {
    const pos = [];
    const nor = [];
    const uv = [];
    const idx = [];
    let along = 0;
    r.forEach((h, i) => {
      const prev = r[Math.max(0, i - 1)].p;
      const next = r[Math.min(r.length - 1, i + 1)].p;
      const t = norm(sub3(next, prev));
      const s = norm(cross(h.n, t));
      if (i > 0) along += Math.hypot(...sub3(h.p, r[i - 1].p));
      const base = add3(h.p, h.n, off);
      const top = add3(h.p, h.n, off + raise);
      const L = add3(top, s, width / 2);
      const R = add3(top, s, -width / 2);
      if (raise > 0) {
        const L0 = add3(base, s, width / 2);
        const R0 = add3(base, s, -width / 2);
        pos.push(...L0, ...L, ...R, ...R0);
        nor.push(...s, ...h.n, ...h.n, ...s.map((v) => -v));
        uv.push(along, 0, along, 0.33, along, 0.66, along, 1);
      } else {
        pos.push(...L, ...R);
        nor.push(...h.n, ...h.n);
        uv.push(along, 0, along, 1);
      }
    });
    const per = raise > 0 ? 4 : 2;
    for (let i = 0; i < r.length - 1; i++) {
      const a = i * per;
      const b = (i + 1) * per;
      // Side to side across the strip, wound to face out of the skin (s = n × t).
      for (let k = 0; k < per - 1; k++) idx.push(a + k, b + k + 1, b + k, a + k, a + k + 1, b + k + 1);
    }
    const g = geometry(pos, nor, uv, idx);
    B.add(g, mat);
    if (mirror) B.add(mirrored(g), mat);
  }
}

/** Put a small part (built facing +z, up +y) onto the skin, facing out of it. */
function stud(B, geo, mat, skin, view, a, b, { off = 0, mirror = true, upHint = [0, 1, 0] } = {}) {
  const h = skin.hit(view, a, b);
  if (!h) return null;
  const z = h.n;
  let x = cross(upHint, z);
  if (Math.hypot(...x) < 1e-4) x = [1, 0, 0];
  x = norm(x);
  const y = cross(z, x);
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(...x), new THREE.Vector3(...y), new THREE.Vector3(...z));
  const p = add3(h.p, z, off);
  m.setPosition(p[0], p[1], p[2]);
  const g = geo.clone().applyMatrix4(m);
  B.add(g, mat);
  if (mirror) B.add(mirrored(g), mat);
  geo.dispose();
  return h;
}

/** A box from eight corners (bottom four, then top four), flat-shaded. */
function hexa(B, mat, c) {
  const faces = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
  for (const [a, b, cc, d] of faces) B.quad(mat, c[a], c[b], c[cc], c[d]);
}

/* ================================================================ wheels */

/**
 * A wheel: a profiled tyre with tread, a rim of the chosen design, the brake
 * disc behind it and a caliper. Axle along x; `side` is +1 for the right-hand
 * wheels (rim facing +x) and -1 for the left.
 */
export function carWheel(B, x, y, z, R, W, side, w = {}) {
  const rimR = w.rimR || R * 0.68;
  const g = new THREE.Group();
  const parts = new Builder();
  const rimMat = w.rimMat || M.alloy(w.rimColor || '#c9ced3', w.rough ?? 0.22);
  const darkRim = M.alloy('#3a3e43', 0.5);
  // Tyre.
  const sw = R - rimR;
  const prof = [
    [rimR + 0.01, -W * 0.44], [rimR + sw * 0.3, -W * 0.5], [rimR + sw * 0.72, -W * 0.5], [R - 0.07, -W * 0.47],
    [R - 0.018, -W * 0.41], [R, -W * 0.3], [R, 0], [R, W * 0.3], [R - 0.018, W * 0.41], [R - 0.07, W * 0.47],
    [rimR + sw * 0.72, W * 0.5], [rimR + sw * 0.3, W * 0.5], [rimR + 0.01, W * 0.44],
  ].map(([r, a]) => new THREE.Vector2(r, a));
  const seg = w.seg || (DETAIL ? 36 : 16);
  w = { ...w, seg };
  const tyre = new THREE.LatheGeometry(prof, seg).rotateZ(-PI / 2);
  parts.add(tyre, M.tread());
  // Barrel and the back of the rim.
  parts.add(cylGeo(rimR, rimR, W * 0.84, w.seg || 36, true).rotateZ(PI / 2), darkRim);
  parts.add(new THREE.CircleGeometry(rimR, 24).rotateY(-PI / 2).translate(-W * 0.3, 0, 0), darkRim);
  // Brake disc and hat.
  const discR = rimR * 0.8;
  parts.add(cylGeo(discR, discR, 0.07, 28).rotateZ(PI / 2).translate(W * 0.02, 0, 0), M.metal('#8c9196', 0.32));
  parts.add(cylGeo(rimR * 0.3, rimR * 0.3, 0.16, 16).rotateZ(PI / 2).translate(W * 0.1, 0, 0), M.metal('#5d6166', 0.5));
  // Rim lip.
  const face = W * 0.4;
  parts.add(new THREE.TorusGeometry(rimR - 0.015, 0.032, 6, w.seg || 36).rotateY(PI / 2).translate(face, 0, 0), rimMat);
  // The spokes.
  rimFace(parts, w.style || 'five', rimR, face, rimMat, w);
  // Hub, centre cap and wheel nuts.
  parts.add(cylGeo(rimR * 0.2, rimR * 0.22, 0.09, 20).rotateZ(PI / 2).translate(face - 0.02, 0, 0), rimMat);
  parts.add(cylGeo(rimR * 0.12, rimR * 0.12, 0.03, 20).rotateZ(PI / 2).translate(face + 0.03, 0, 0), w.capMat || M.pianoBlack());
  const nuts = DETAIL ? (w.nuts || 5) : 0;
  for (let k = 0; k < nuts; k++) {
    const a = (k / nuts) * PI * 2;
    parts.add(cylGeo(0.035, 0.035, 0.07, 6).rotateZ(PI / 2).translate(face + 0.01, Math.cos(a) * rimR * 0.27, Math.sin(a) * rimR * 0.27), M.chrome());
  }
  parts.finish(g);
  // Face the right way out and move into place.
  g.rotation.y = side > 0 ? 0 : PI;
  g.position.set(x, y, z);
  g.updateMatrixWorld(true);
  g.traverse((o) => {
    if (!o.isMesh) return;
    B.add(o.geometry.clone().applyMatrix4(o.matrixWorld), o.material);
    o.geometry.dispose();
  });
  // Caliper, on the trailing side of the disc.
  if (w.caliper !== false && DETAIL) {
    const cal = M.painted(w.caliper || '#3a3d42', 0.35);
    const ca = PI * 0.58;
    const cr = discR * 0.86;
    const cg = boxGeo(0.12, 0.42, 0.22);
    cg.rotateX(-(ca - PI / 2));
    cg.translate(x + side * W * 0.11, y + Math.sin(ca) * cr, z + Math.cos(ca) * cr * 1);
    B.add(cg, cal);
  }
}

/** The face of a rim: spokes in one of several designs. */
function rimFace(B, style, rimR, face, mat, w) {
  const r0 = rimR * 0.2;
  const r1 = rimR - 0.04;
  const depth = 0.05;
  const spoke = (ang, w0, w1, dish = 0.06, sweep = 0, m = mat, rr0 = r0, rr1 = r1) => {
    const d0 = [0, Math.cos(ang), Math.sin(ang)];
    const t0 = [0, -Math.sin(ang), Math.cos(ang)];
    const a1 = ang + sweep;
    const d1 = [0, Math.cos(a1), Math.sin(a1)];
    const t1 = [0, -Math.sin(a1), Math.cos(a1)];
    const at = (d, t, r, half, x) => [x, d[1] * r + t[1] * half, d[2] * r + t[2] * half];
    const fi = face;
    const fo = face - dish;
    hexa(B, m, [
      at(d0, t0, rr0, -w0 / 2, fi - depth), at(d1, t1, rr1, -w1 / 2, fo - depth), at(d1, t1, rr1, w1 / 2, fo - depth), at(d0, t0, rr0, w0 / 2, fi - depth),
      at(d0, t0, rr0, -w0 / 2, fi), at(d1, t1, rr1, -w1 / 2, fo), at(d1, t1, rr1, w1 / 2, fo), at(d0, t0, rr0, w0 / 2, fi),
    ]);
  };
  const n = w.n || 5;
  switch (style) {
    case 'split':
      for (let k = 0; k < n; k++) {
        const a = (k / n) * PI * 2;
        spoke(a - 0.05, rimR * 0.1, rimR * 0.09, 0.07, -0.12);
        spoke(a + 0.05, rimR * 0.1, rimR * 0.09, 0.07, 0.12);
      }
      break;
    case 'multi':
      for (let k = 0; k < n * 2; k++) spoke((k / (n * 2)) * PI * 2, rimR * 0.08, rimR * 0.1, 0.08);
      break;
    case 'six':
      for (let k = 0; k < 6; k++) spoke((k / 6) * PI * 2, rimR * 0.16, rimR * 0.24, 0.03);
      break;
    case 'turbine':
      for (let k = 0; k < 14; k++) spoke((k / 14) * PI * 2, rimR * 0.07, rimR * 0.13, 0.04, 0.5);
      break;
    case 'aero': {
      // A flat aero cover with a few vents.
      B.add(new THREE.CircleGeometry(r1, 36).rotateY(PI / 2).translate(face - 0.01, 0, 0), mat);
      for (let k = 0; k < 5; k++) spoke((k / 5) * PI * 2 + 0.3, rimR * 0.12, rimR * 0.2, 0, 0.3, M.pianoBlack(), rimR * 0.55, rimR * 0.85);
      break;
    }
    case 'steel': {
      B.add(new THREE.CircleGeometry(r1, 32).rotateY(PI / 2).translate(face - 0.04, 0, 0), mat);
      const hole = M.plastic('#0a0b0c', 0.9);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * PI * 2;
        B.add(new THREE.CircleGeometry(rimR * 0.1, 12).rotateY(PI / 2).translate(face - 0.035, Math.cos(a) * rimR * 0.62, Math.sin(a) * rimR * 0.62), hole);
      }
      break;
    }
    case 'truck': {
      // Polished aluminium disc with ten hand holes; the hub cover and nut
      // covers stand proud of it.
      B.add(new THREE.CircleGeometry(r1, 36).rotateY(PI / 2).translate(face - 0.03, 0, 0), mat);
      const hole = M.plastic('#0a0b0c', 0.9);
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * PI * 2 + PI / 10;
        B.add(new THREE.CircleGeometry(rimR * 0.09, 12).scale(1, 1.5, 1).rotateZ(a).rotateY(PI / 2).translate(face - 0.025, Math.cos(a) * rimR * 0.66, Math.sin(a) * rimR * 0.66), hole);
      }
      B.add(cylGeo(rimR * 0.36, rimR * 0.42, 0.3, 24).rotateZ(PI / 2).translate(face + 0.12, 0, 0), M.chrome());
      B.add(new THREE.SphereGeometry(rimR * 0.36, 16, 8, 0, PI * 2, 0, PI / 2).rotateZ(-PI / 2).translate(face + 0.27, 0, 0), M.chrome());
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * PI * 2;
        B.add(new THREE.ConeGeometry(0.045, 0.2, 8).rotateZ(-PI / 2).translate(face + 0.08, Math.cos(a) * rimR * 0.52, Math.sin(a) * rimR * 0.52), M.chrome());
      }
      break;
    }
    case 'mesh':
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * PI * 2;
        spoke(a, rimR * 0.05, rimR * 0.06, 0.07, 0.35);
        spoke(a, rimR * 0.05, rimR * 0.06, 0.07, -0.35);
      }
      break;
    default:
      for (let k = 0; k < n; k++) spoke((k / n) * PI * 2, rimR * 0.13, rimR * 0.22, 0.07);
  }
}

/* ================================================================ the body */

/** One cross-section of the lower body (right half, 16 points). */
function bodySection(c, hw, yTop, ySh, yBot, yFloor, arch) {
  const shR = Math.max(0.04, Math.min(c.shR ?? 0.22, (ySh - yBot) * 0.3, hw * 0.25));
  const botR = Math.max(0.04, Math.min(c.botR ?? 0.25, (ySh - yBot) * 0.25));
  const tuck = c.tuck ?? 0.05;
  const topIn = c.topIn ?? 0.02;
  const sx = (s) => hw * (1 - tuck * (1 - s) ** 2.2 - topIn * s ** 3);
  let y0 = yBot + botR;
  const pts = [[0, yFloor]];
  if (arch) {
    // Over a wheel the skin stops at the arch and a wheel well goes up into the body.
    const ay = Math.min(arch.y, ySh - shR - 0.06);
    y0 = ay;
    pts.push([hw - arch.depth, yFloor], [hw - arch.depth, ay], [sx(0) - 0.03, ay]);
  } else {
    pts.push([hw - botR * 1.1, yFloor], [sx(0) - botR * 0.45, yBot + botR * 0.2], [sx(0), y0]);
  }
  const yS = ySh - shR;
  for (const s of [0.22, 0.48, 0.74, 1]) pts.push([sx(s), lerp(y0, yS, s)]);
  // Shoulder: round over from the side to the top.
  const xT = sx(1);
  for (const a of [0.45, 0.95]) pts.push([xT - shR + Math.cos(a) * shR, yS + Math.sin(a) * shR]);
  pts.push([xT - shR, ySh]);
  // Top: crowned toward the centre line.
  const xs = Math.max(0.01, xT - shR);
  for (const f of [0.8, 0.6, 0.4, 0.2, 0]) pts.push([xs * f, yTop + (ySh - yTop) * f * f]);
  return pts;
}

/** A cross-section of a body made of flat stainless panels (13 points):
 *  vertical sides to a crease, then the upper body leaning in to a flat top. */
function panelSection(c, hw, yTop, yBelt, yBot, yFloor, arch) {
  const pts = [[0, yFloor]];
  let y0 = yBot + 0.12;
  if (arch) {
    const ay = Math.min(arch.y, yBelt - 0.1);
    y0 = ay;
    pts.push([hw - arch.depth, yFloor], [hw - arch.depth, ay], [hw - 0.02, ay]);
  } else {
    pts.push([hw - 0.35, yFloor], [hw - 0.08, yBot], [hw, y0]);
  }
  const yB = Math.min(yBelt, yTop - 0.04);
  pts.push([hw, lerp(y0, yB, 0.5)], [hw, yB]);
  const lean = Math.min(c.lean ?? 0.95, Math.max(0, (yTop - yB) * 0.42));
  const xT = hw - lean;
  pts.push([xT + 0.04, yTop - 0.03], [xT, yTop], [xT * 0.75, yTop + 0.01], [xT * 0.5, yTop + 0.02], [xT * 0.25, yTop + 0.02], [0, yTop + 0.02]);
  // Pad to a fixed count.
  while (pts.length < 13) pts.push(pts[pts.length - 1]);
  return pts;
}

/** One cross-section of the greenhouse (right half, 11 points). The roof
 *  rolls over from the side glass rather than meeting it at a crease. */
function glassSection(hwG, yBelt, hwT, yEdge, yRoof, bow) {
  const pts = [];
  for (const s of [0, 0.05, 0.5, 0.95, 1]) pts.push([lerp(hwG, hwT, s) + bow * Math.sin(PI * s), lerp(yBelt, yEdge, s)]);
  for (const f of [0.965, 0.86, 0.66, 0.42, 0.18, 0]) pts.push([hwT * f, yRoof - (yRoof - yEdge) * f ** 3]);
  return pts;
}

/** The axles: where the wheels are, how big, how big the arches. */
function axles(car) {
  const R = car.tire / 2;
  const z0 = -car.L / 2;
  const gap = car.archGap ?? 0.17;
  return [car.fo, car.fo + car.wb].map((s) => ({ z: z0 + s, y: R + (car.lift || 0), R, Ra: R + gap }));
}

function stations(car, extra = []) {
  const set = new Set();
  const add = (t) => set.add(Math.round(clamp(t, 0, 1) * 1e5) / 1e5);
  for (const t of [0, 0.002, 0.005, 0.009, 0.014, 0.02, 0.027, 0.035, 0.044]) { add(t); add(1 - t); }
  const step = DETAIL ? 0.011 : 0.024;
  for (let t = 0.05; t < 0.95; t += step) add(t);
  const nArch = DETAIL ? 9 : 5;
  for (const ax of axles(car)) {
    const tc = (ax.z + car.L / 2) / car.L;
    const tr = ax.Ra / car.L;
    for (const s of [-1, 1]) { add(tc + s * tr - 0.0004); add(tc + s * tr + 0.0004); }
    for (let k = -nArch; k <= nArch; k++) add(tc + (tr * k) / (nArch + 0.6));
  }
  for (const t of extra) add(t);
  return [...set].sort((a, b) => a - b);
}

/**
 * Build the lower body and greenhouse shells of a car from its lines:
 * car.lines = { top, shoulder, bottom, plan } as [t, value] keys,
 * car.glass = { a0, a1, c0, r1, roof, edge, belt, inset, tumble, bow }.
 */
function shells(car) {
  const { L, W } = car;
  const top = spline(car.lines.top);
  const shoulder = spline(car.lines.shoulder);
  const bottom = spline(car.lines.bottom);
  const plan = spline(car.lines.plan);
  const ax = axles(car);
  const body = new Shell();
  for (const t of stations(car, car.lines.breaks || [])) {
    const z = -L / 2 + t * L;
    const hw = (W / 2) * plan(t);
    let arch = null;
    for (const a of ax) {
      const dz = z - a.z;
      if (Math.abs(dz) < a.Ra) arch = { y: a.y + Math.sqrt(a.Ra * a.Ra - dz * dz), depth: car.wellDepth ?? (car.tireW + 0.5) };
    }
    const section = car.section === 'panel' ? panelSection : bodySection;
    body.add(z, section(car.lines, hw, top(t), shoulder(t), bottom(t), bottom(t) + 0.04, arch), { t, arch: !!arch });
  }
  let glass = null;
  const G = car.glass;
  if (G) {
    const roof = spline(G.roof);
    const edge = spline(G.edge);
    const belt = spline(G.belt);
    const tumble = typeof G.tumble === 'number' ? () => G.tumble : spline(G.tumble);
    const inset = typeof G.inset === 'number' ? () => G.inset : spline(G.inset);
    glass = new Shell();
    const ts = new Set([G.a0, G.a1, G.c0, G.r1, ...(G.breaks || [])]);
    for (let t = G.a0; t < G.r1; t += DETAIL ? 0.008 : 0.018) ts.add(t);
    for (const k of [0.002, 0.006, 0.012]) { ts.add(G.a0 + k); ts.add(G.r1 - k); }
    for (const t of [...ts].sort((a, b) => a - b)) {
      if (t < G.a0 || t > G.r1) continue;
      const z = -L / 2 + t * L;
      const hwG = (W / 2) * plan(t) - inset(t);
      // The glass starts a little inside the body so no gap shows under it.
      glass.add(z, glassSection(hwG, belt(t) - 0.05, hwG - tumble(t), Math.max(belt(t), edge(t)), Math.max(edge(t), roof(t)), G.bow ?? 0.04), { t });
    }
  }
  return { body, glass, fn: { top, shoulder, bottom, plan, roof: G && spline(G.roof), edge: G && spline(G.edge), belt: G && spline(G.belt) } };
}

/* ================================================================ shared parts */

const gapMat = () => M.plastic('#050506', 0.95);

let PLATE = null;
/** A number plate (the same made-up registration on every car). */
function plate() {
  if (PLATE) return PLATE;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f5f2';
  g.fillRect(0, 0, 256, 128);
  g.strokeStyle = '#26324a';
  g.lineWidth = 6;
  g.strokeRect(5, 5, 246, 118);
  g.fillStyle = '#1f3c7a';
  g.font = 'bold 20px sans-serif';
  g.textAlign = 'center';
  g.fillText('BUILDING SIM', 128, 30);
  g.fillStyle = '#1b2433';
  g.font = 'bold 60px sans-serif';
  g.fillText('BDS 2026', 128, 98);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  PLATE = new THREE.MeshStandardMaterial({ map: t, roughness: 0.45, metalness: 0.2 });
  return PLATE;
}

const NAMES = new Map();
/** Chrome model lettering for a boot lid. */
function nameMat(text) {
  if (!NAMES.has(text)) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 96;
    const g = c.getContext('2d');
    g.fillStyle = '#000';
    g.fillRect(0, 0, 512, 96);
    g.fillStyle = '#fff';
    g.font = 'bold 68px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text.toUpperCase(), 256, 52);
    const t = new THREE.CanvasTexture(c);
    NAMES.set(text, new THREE.MeshStandardMaterial({ color: '#dfe4e8', roughness: 0.18, metalness: 1, alphaMap: t, alphaTest: 0.5 }));
  }
  return NAMES.get(text);
}

/* ================================================================ assembling a car */

/** Everything a model's own details need. */
function context(car, paint, opts) {
  const { body, glass, fn } = shells(car);
  const skin = new Skin(glass ? [body, glass] : [body]);
  const L = car.L;
  const Z = (t) => -L / 2 + t * L;
  const lit = !!opts.lit;
  return {
    car, paint, skin, body, glass, fn, Z, lit, L, W: car.W, H: car.H,
    ax: axles(car),
    head: lit ? M.lamp('#fff6e0', 8) : M.reflector(),
    drl: lit ? M.lamp('#ffffff', 6) : M.led('#f2f7fb'),
    tail: lit ? M.lamp('#ff2a1a', 4) : M.tailLens('#9c0f18'),
    tailLed: lit ? M.lamp('#ff3a2a', 6) : M.tailLens('#d01e26'),
    amber: lit ? M.lamp('#ffa31a', 3) : M.tailLens('#c46a12'),
    dark: M.plastic('#101113', 0.7),
    trim: car.trim === 'chrome' ? M.chrome() : M.pianoBlack(),
    glassMat: M.carGlass(),
  };
}

/** Skin the shells with the right material in each zone. */
function skinBody(B, cx) {
  const { car, paint, body, glass } = cx;
  const under = M.plastic('#141517', 0.9);
  const clad = car.clad ? M.cladding() : paint;
  const S = body.st;
  const bed = car.bed;
  const panel = car.section === 'panel';
  loft(B, body, (i, j) => {
    const arch = S[i].arch || S[i + 1].arch;
    if (j === 0) return under;
    if (j <= 2) return arch ? under : clad;
    if (j === 3 && car.clad) return clad;
    // A pickup's load bed is open on top (its walls are added separately).
    if (bed && !panel && j >= 10 && (S[i].t + S[i + 1].t) / 2 > bed[0]) return null;
    return paint;
  }, { caps: true, capMat: paint, flat: panel });
  if (glass) {
    const G = car.glass;
    const roofMat = G.roofMat === 'glass' ? cx.glassMat : G.roofMat === 'black' ? M.pianoBlack() : paint;
    const GS = glass.st;
    loft(B, glass, (i, j) => {
      const t = (GS[i].t + GS[i + 1].t) / 2;
      // Side windows, unless the model panels some of the greenhouse in (a van's load area).
      if (j <= 3) return G.solidFrom != null && t > G.solidFrom ? paint : cx.glassMat;
      const inRoof = t > G.a1 && t < G.c0;
      if (j === 4) return inRoof ? roofMat : (G.pillarMat === 'black' ? M.pianoBlack() : paint);
      if (inRoof) return roofMat;
      if (t >= G.c0 && G.rearGlass === false) return paint;
      return cx.glassMat;
    });
  }
}

/** Seats, dashboard, steering wheel, door cards and headliner. */
function cabin(B, cx, o = {}) {
  const { car, Z, fn } = cx;
  const G = car.glass;
  if (!G) return;
  const seatMat = M.upholstery(o.seat || '#2b2d31');
  const dash = M.upholstery('#17181b', 0.7);
  const floorY = (o.floor ?? (fn.bottom(0.5) + 0.42));
  const beltY = fn.belt((G.a0 + G.r1) / 2);
  // Inside the narrowest part of the cabin, clear of the body sides.
  const hwIn = (car.W / 2) * Math.min(fn.plan(G.a0 + 0.02), fn.plan((G.a0 + G.r1) / 2), fn.plan(G.r1 - 0.02)) - 0.45;
  // Dashboard under the windscreen.
  const zd0 = Z(G.a0) + 0.45;
  const zd1 = Z(G.a0 + (G.a1 - G.a0) * 0.6);
  B.box(dash, hwIn * 2 - 0.1, 0.5, zd1 - zd0, 0, beltY - 0.2, (zd0 + zd1) / 2);
  B.box(dash, 0.7, beltY - floorY - 0.4, 0.9, 0, floorY + (beltY - floorY - 0.4) / 2, zd1 + 0.2);
  // Steering wheel on the driver's (left) side, and a screen.
  const sx = -car.W * 0.2;
  B.add(new THREE.TorusGeometry(0.5, 0.05, 6, 20).rotateX(PI * 0.3).translate(sx, beltY + 0.05, zd1 + 0.45), M.upholstery('#121315', 0.6));
  B.add(cylGeo(0.06, 0.06, 0.55, 8).rotateX(PI * 0.8).translate(sx, beltY - 0.1, zd1 + 0.25), dash);
  B.box(M.pianoBlack(), 0.9, 0.55, 0.06, 0.1, beltY + 0.3, zd1 - 0.05, [-0.25, 0, 0]);
  // Seats: two buckets in front, a bench behind (more rows in big vans).
  const seat = (x, z, wdt) => {
    B.box(seatMat, wdt, 0.4, 1.55, x, floorY + 0.75, z);
    B.box(seatMat, wdt * 0.94, 1.9, 0.35, x, floorY + 1.75, z + 0.85, [-0.22, 0, 0]);
    B.box(seatMat, wdt * 0.5, 0.5, 0.25, x, floorY + 2.85, z + 1.05, [-0.12, 0, 0]);
  };
  const zf = Z(lerp(G.a1, G.c0, 0.12)) + 0.3;
  seat(-car.W * 0.2, zf, 1.6);
  seat(car.W * 0.2, zf, 1.6);
  B.box(seatMat, 0.5, 0.6, 1.4, 0, floorY + 0.65, zf + 0.1);
  const rows = o.rows ?? 1;
  for (let r = 1; r <= rows; r++) {
    const zr = zf + r * (o.rowGap || 2.9);
    if (zr > Z(G.r1) - 1.2) break;
    seat(-car.W * 0.2, zr, 1.55);
    seat(car.W * 0.2, zr, 1.55);
    if (!o.captains) seat(0, zr, 0.9);
  }
  // Door cards and the headliner close the cabin in.
  const zA = Z(G.a0) + 0.3;
  const zB = Z(Math.min(G.r1, G.c0 + 0.03)) - 0.2;
  for (const s of [-1, 1]) B.box(M.upholstery('#202226'), 0.08, beltY - floorY - 0.12, zB - zA, s * hwIn, (beltY + floorY) / 2 - 0.06, (zA + zB) / 2);
  // The headliner sits inside the roof, narrower than the roof itself.
  const tm = (G.a1 + G.c0) / 2;
  const roofY = fn.roof(tm);
  const tum = typeof G.tumble === 'number' ? G.tumble : spline(G.tumble)(tm);
  const ins = typeof G.inset === 'number' ? G.inset : spline(G.inset)(tm);
  const hwRoof = (car.W / 2) * fn.plan(tm) - ins - tum - 0.25;
  // Only as far forward and back as the roof is that high.
  let h0 = G.a1;
  while (h0 < tm && fn.roof(h0) < roofY - 0.12) h0 += 0.005;
  let h1 = G.c0;
  while (h1 > tm && fn.roof(h1) < roofY - 0.12) h1 -= 0.005;
  B.box(M.upholstery('#c9c6bf', 0.95), hwRoof * 2, 0.05, Z(h1) - Z(h0), 0, roofY - 0.2, (Z(h0) + Z(h1)) / 2);
  B.box(M.upholstery('#1a1b1e'), hwIn * 2, 0.06, zB - zA, 0, floorY, (zA + zB) / 2);
}

/** The four wheels, with the car's rim design. */
function wheels(B, cx, w = {}) {
  const { car } = cx;
  const plan = cx.fn.plan;
  for (const a of cx.ax) {
    const t = (a.z + car.L / 2) / car.L;
    const hw = (car.W / 2) * plan(t);
    const x = hw - (car.tireW || 0.75) / 2 - (w.inset ?? 0.12);
    for (const s of [1, -1]) carWheel(B, s * x, a.y, a.z, a.R, car.tireW || 0.75, s, { ...car.wheel, ...w });
  }
}

/** Panel gaps round the doors, following the arches. */
function doorLines(B, cx, doors, o = {}) {
  const { Z, fn, ax } = cx;
  const gm = gapMat();
  const rocker = (t) => fn.bottom(t) + (o.sill ?? 0.4);
  const belt = (t) => (fn.belt ? fn.belt(t) : fn.shoulder(t)) - 0.04;
  // Each cut runs from the belt down to the sill, stepping round a wheel arch.
  for (const t of doors) {
    const z = Z(t);
    const line = [[z, belt(t)]];
    let yb = rocker(t);
    for (const a of ax) {
      const dz = z - a.z;
      const R = a.Ra + 0.12;
      if (Math.abs(dz) < R) yb = Math.max(yb, a.y + Math.sqrt(R * R - dz * dz));
    }
    line.push([z, yb]);
    ribbon(B, gm, cx.skin, 'side', line, 0.028, { off: 0.004 });
  }
  if (o.bottom !== false && doors.length > 1) {
    const zs = Z(doors[0]);
    const ze = Z(doors[doors.length - 1]);
    const ys = rocker((doors[0] + doors[doors.length - 1]) / 2);
    ribbon(B, gm, cx.skin, 'side', [[zs, ys], [ze, ys]], 0.028, { off: 0.004 });
  }
}

/** A door handle: a pull with a dark recess behind it. */
function handle(B, cx, t, y, o = {}) {
  const z = cx.Z(t);
  decal(B, M.plastic('#0f1012', 0.6), cx.skin, 'side', ellipse(z, y, 0.32, 0.075, 14), { off: 0.003, sub: 1 });
  const g = boxGeo(0.62, 0.09, 0.07);
  g.translate(0, 0, 0.035);
  stud(B, g, o.flush ? cx.paint : (o.mat || cx.paint), cx.skin, 'side', z, y, { off: 0.01 });
}

function ellipse(cx, cy, rx, ry, n = 16, rot = 0) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * PI * 2;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    out.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  return out;
}

function roundRect(cx, cy, w, h, r = 0.1, n = 4) {
  const out = [];
  const x0 = cx - w / 2 + r;
  const x1 = cx + w / 2 - r;
  const y0 = cy - h / 2 + r;
  const y1 = cy + h / 2 - r;
  const corner = (x, y, a0) => { for (let k = 0; k <= n; k++) { const a = a0 + (k / n) * (PI / 2); out.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); } };
  corner(x1, y0, -PI / 2);
  corner(x1, y1, 0);
  corner(x0, y1, PI / 2);
  corner(x0, y0, PI);
  return out;
}

/** A wing mirror on its arm, glass facing back, indicator along the bottom. */
function mirrorAt(B, cx, t, y, o = {}) {
  const h = cx.skin.hit('side', cx.Z(t), y);
  if (!h) return;
  const [x0, y0, z0] = h.p;
  const out = o.out ?? 0.5;
  const cap = o.cap === 'black' ? M.pianoBlack() : o.cap === 'chrome' ? M.chrome() : cx.paint;
  for (const s of [1, -1]) {
    const bx = s * x0;
    const hx = s * (x0 + out);
    const hy = y0 + (o.lift ?? 0.22);
    const hz = z0 + 0.25;
    const r = o.size ?? 0.26;
    B.add(new THREE.SphereGeometry(r, 18, 12, 0, PI * 2, 0, PI).scale(1.3, 0.85, 0.7).translate(hx, hy, hz), cap);
    B.add(new THREE.CircleGeometry(r * 1.05, 18).scale(1.22, 0.76, 1).translate(hx, hy, hz + r * 0.62), M.chrome());
    B.box(M.pianoBlack(), Math.abs(hx - bx), 0.12, 0.3, (bx + hx) / 2, y0 + 0.06, z0 + 0.15);
    B.box(cx.amber, 0.45, 0.04, 0.06, hx + s * 0.05, hy - 0.2, hz - 0.15);
  }
}

/** Windscreen wipers lying at the base of the glass. */
function wipers(B, cx, o = {}) {
  const G = cx.car.glass;
  const z = cx.Z(G.a0) + (o.dz ?? 0.18);
  const w = cx.car.W;
  for (const [x0, x1] of [[-w * 0.36, w * 0.06], [w * 0.06, w * 0.4]]) {
    ribbon(B, M.pianoBlack(), cx.skin, 'top', [[x0, z + 0.05], [x1, z - 0.02]], 0.05, { off: 0.02, raise: 0.03, mirror: false });
  }
}

/** Front and rear number plates. */
function plates(B, cx, front, rear) {
  if (front) decal(B, plate(), cx.skin, 'front', roundRect(front[0], front[1], 1.0, 0.5, 0.04), { off: 0.03, mirror: false, uv: 'fit', sub: 1 });
  if (rear) {
    decal(B, M.plastic('#0d0e10', 0.8), cx.skin, 'rear', roundRect(rear[0], rear[1], 1.18, 0.66, 0.06), { off: 0.005, mirror: false, sub: 1 });
    decal(B, plate(), cx.skin, 'rear', roundRect(rear[0], rear[1], 1.0, 0.5, 0.04), { off: 0.02, mirror: false, uv: 'fit', sub: 1 });
  }
}

/** A headlamp: housing, projectors, a daytime-running strip and the lens. */
function headlamp(B, cx, shape, o = {}) {
  decal(B, o.housing || M.pianoBlack(), cx.skin, 'front', shape, { off: 0.008, sub: 2 });
  for (const [x, y, r] of o.projectors || []) {
    const g = new THREE.SphereGeometry(r, 14, 10);
    g.scale(1, 1, 0.6);
    stud(B, g, cx.head, cx.skin, 'front', x, y, { off: 0.02 });
    if (DETAIL) {
      const ring = new THREE.TorusGeometry(r * 1.15, r * 0.18, 6, 18);
      stud(B, ring, M.chrome(), cx.skin, 'front', x, y, { off: 0.018 });
    }
  }
  if (o.drl) ribbon(B, cx.drl, cx.skin, 'front', o.drl, o.drlW || 0.06, { off: 0.022, raise: 0.01 });
  if (o.amber) ribbon(B, cx.amber, cx.skin, 'front', o.amber, 0.05, { off: 0.02 });
  decal(B, M.lens(), cx.skin, 'front', shape, { off: 0.04, sub: 2 });
  ribbon(B, M.pianoBlack(), cx.skin, 'front', shape, 0.03, { off: 0.02, closed: true });
}

/** A tail lamp: lens with lit strips inside it. */
function taillamp(B, cx, shape, o = {}) {
  decal(B, cx.tail, cx.skin, 'rear', shape, { off: 0.012, sub: 2 });
  for (const line of o.leds || []) ribbon(B, cx.tailLed, cx.skin, 'rear', line, o.ledW || 0.05, { off: 0.03, raise: 0.008 });
  if (o.reverse) decal(B, M.plastic('#e9ecef', 0.12), cx.skin, 'rear', o.reverse, { off: 0.028, sub: 1 });
  if (o.amber) decal(B, cx.amber, cx.skin, 'rear', o.amber, { off: 0.028, sub: 1 });
  ribbon(B, M.pianoBlack(), cx.skin, 'rear', shape, 0.025, { off: 0.016, closed: true });
}

/** A grille: mesh or bars inside a frame. */
function grille(B, cx, shape, o = {}) {
  decal(B, o.mesh || M.grilleMesh('#3b3e43'), cx.skin, 'front', shape, { off: o.recess ?? 0.012, sub: 3, mirror: false });
  if (o.frame) ribbon(B, o.frame, cx.skin, 'front', shape, o.frameW || 0.07, { off: 0.025, raise: 0.03, closed: true, mirror: false });
  for (const bar of o.bars || []) ribbon(B, o.barMat || M.chrome(), cx.skin, 'front', bar, o.barW || 0.06, { off: 0.03, raise: 0.03, mirror: false });
}

/** Exhaust tips under the back bumper. */
function exhaust(B, cx, tips, o = {}) {
  for (const [x, y] of tips) {
    const h = cx.skin.hit('rear', x, y + 0.25);
    const z = h ? h.p[2] : cx.L / 2;
    const r = o.r || 0.16;
    const g = cylGeo(r, r, 0.6, 18, true).rotateX(PI / 2).translate(x, y, z - 0.2);
    B.add(g, M.chrome());
    B.add(new THREE.CircleGeometry(r * 0.85, 16).translate(x, y, z - 0.05), M.plastic('#050505', 0.9));
    if (o.oval) B.add(cylGeo(r * 1.2, r * 1.2, 0.05, 18, true).rotateX(PI / 2).scale(1.4, 0.8, 1).translate(x, y, z + 0.08), M.chrome());
  }
}

/** Lettering and a badge. */
function badge(B, cx, view, a, b, r, mat = null) {
  // An emblem: a dark or coloured centre in a bright ring (no real logos).
  const g = new THREE.CylinderGeometry(r * 0.86, r * 0.86, 0.035, 24).rotateX(PI / 2);
  stud(B, g, mat || M.pianoBlack(), cx.skin, view, a, b, { off: 0.02, mirror: false });
  const ring = new THREE.TorusGeometry(r * 0.9, r * 0.1, 6, 28);
  stud(B, ring, M.alloy('#dfe3e7', 0.15), cx.skin, view, a, b, { off: 0.03, mirror: false });
}
function lettering(B, cx, view, text, a, b, w) {
  decal(B, nameMat(text), cx.skin, view, roundRect(a, b, w, w * 0.19, 0.01), { off: 0.012, mirror: false, uv: 'fit', sub: 1 });
}

/* ================================================================ public */

const MODELS = {};

/** Build one car. Returns a Builder, like vehicleModel. */
export function carModel(id, color, paintOverride = null, opts = {}) {
  const base = CAR_BY_ID[id];
  const def = MODELS[id];
  const B = new Builder();
  if (!base || !def) {
    B.box(paintOverride || M.carPaint(color || '#c9ccd0'), 6, 4.6, 15, 0, 2.6, 0);
    return B;
  }
  DETAIL = opts.lod === 'low' ? 0 : 1;
  const car = { ...base, ...def.spec };
  // Bare stainless unless someone picks a colour (a wrap).
  const bare = car.stainless && (!color || color === base.color);
  const paint = paintOverride || (bare ? M.alloy('#c3c7cb', 0.4) : M.carPaint(color || base.color));
  const cx = context(car, paint, opts);
  skinBody(B, cx);
  def.details(B, cx);
  DETAIL = 1;
  return B;
}

export function isCar(id) { return !!MODELS[id] && !!CAR_BY_ID[id]; }

/* ---------------------------------------------------------------- crowds */

const CROWD = {};
function crowdMat(kind) {
  if (!CROWD[kind]) {
    CROWD[kind] = {
      glass: () => M.vehicleGlass(), dark: () => M.plastic('#141517', 0.6), tyre: () => M.tyre(), metal: () => M.alloy('#b4bac0', 0.3),
      light: () => M.plastic('#e4e8ec', 0.2), red: () => M.tailLens('#9c0f18'), amber: () => M.tailLens('#c46a12'),
    }[kind]();
  }
  return CROWD[kind];
}

/** Which of a handful of shared finishes a part can be drawn with in a crowd. */
function classify(mat) {
  if (mat.transparent) return mat.opacity > 0.5 ? 'glass' : 'light';
  if (mat === M.tread()) return 'tyre';
  if (mat.map && !mat.normalMap) return 'light';
  const c = mat.color;
  if (c.r > 0.3 && c.g > 0.08 && c.g < c.r * 0.6 && c.b < c.g * 0.3) return 'amber';
  if (c.r > 0.2 && c.r > c.g * 2.5 && c.r > c.b * 2.5) return 'red';
  if (mat.metalness >= 0.8) return 'metal';
  if (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b > 0.45) return 'light';
  return 'dark';
}

/**
 * A car ready to be drawn hundreds of times over (a full car park, the
 * traffic): its parts merged onto the body paint plus seven shared finishes,
 * so each model costs a handful of draw calls. Lamps that light at night keep
 * their own materials.
 */
export function crowdParts(B, paint) {
  const groups = new Map();
  for (const [mat, geos] of B.parts) {
    if (mat.alphaMap) { for (const g of geos) g.dispose(); continue; }   // lettering: too small to see
    const target = mat === paint || mat.userData.lamp ? mat : crowdMat(classify(mat));
    if (!groups.has(target)) groups.set(target, []);
    groups.get(target).push(...geos);
  }
  const out = [];
  for (const [mat, geos] of groups) out.push({ mat, geo: geos.length === 1 ? geos[0] : mergeGeometries(geos, false) });
  return out;
}


/* ================================================================ detail kit */

const BLACK = () => M.pianoBlack();

/** A pillar laid over the side glass from t0 to t1 (leaning back by `lean`). */
function pillar(B, cx, t0, t1, mat, lean = 0) {
  const { Z, fn } = cx;
  decal(B, mat, cx.skin, 'side', [
    [Z(t0), fn.belt(t0) - 0.03], [Z(t1), fn.belt(t1) - 0.03],
    [Z(t1 + lean), fn.edge(t1 + lean) + 0.03], [Z(t0 + lean), fn.edge(t0 + lean) + 0.03],
  ], { off: 0.012 });
}

/** The pillar behind the last side window: from a line rising from tb (at the
 *  belt) to tt (at the roof edge), back to the end of the glass. `via` puts a
 *  kink in its front edge (the BMW Hofmeister kink). */
function rearPillar(B, cx, tb, tt, mat, o = {}) {
  const { Z, fn } = cx;
  const G = cx.car.glass;
  const pts = [[Z(tb), fn.belt(tb) - 0.03], [Z(G.r1 + 0.012), fn.belt(G.r1) - 0.03]];
  for (let t = G.r1; t > tt; t -= 0.006) pts.push([Z(t), fn.edge(t) + 0.03]);
  pts.push([Z(tt), fn.edge(tt) + 0.03]);
  for (const [t, dy] of o.via || []) pts.push([Z(t), fn.belt(t) + dy]);
  decal(B, mat, cx.skin, 'side', pts, { off: 0.013 });
}

/** Trim round the side windows: along the top under the roof edge, down the
 *  rear pillar, and along the belt. */
function dlo(B, cx, mat, o = {}) {
  const { Z, fn } = cx;
  const G = cx.car.glass;
  const top = [];
  const tTop = o.tTop ?? G.c0;
  for (let t = G.a0 + 0.012; t <= tTop; t += 0.006) top.push([Z(t), fn.edge(t) - 0.035]);
  if (o.down != null) top.push([Z(o.down), fn.belt(o.down) + 0.06]);
  ribbon(B, mat, cx.skin, 'side', top, o.w ?? 0.045, { off: 0.015, raise: 0.01 });
  const tEnd = o.tEnd ?? o.down ?? G.r1 - 0.02;
  const belt = [];
  for (let t = G.a0 + 0.01; t <= tEnd; t += 0.01) belt.push([Z(t), fn.belt(t) + 0.012]);
  ribbon(B, mat, cx.skin, 'side', belt, o.w ?? 0.045, { off: 0.015, raise: 0.01 });
}

/** The top of the lower body's side at t (where hood and fender meet). */
function shoulderX(cx, t) {
  const sec = cx.body.at(cx.Z(t));
  return sec[10] ? sec[10][0] : (cx.car.W / 2) * 0.9;
}

/** Shut lines round the bonnet: across the front and down both fenders. */
function hoodLines(B, cx, tFront, o = {}) {
  const { Z } = cx;
  const G = cx.car.glass;
  const tEnd = o.tEnd ?? (G ? G.a0 - 0.006 : 0.3);
  const xf = shoulderX(cx, tFront + 0.01) - (o.inset ?? 0.05);
  const across = [];
  for (let k = 0; k <= 16; k++) {
    const x = -xf + (2 * xf * k) / 16;
    across.push([x, Z(tFront) + (o.curve ?? 0.25) * (x / xf) ** 2]);
  }
  ribbon(B, gapMat(), cx.skin, 'top', across, 0.025, { mirror: false });
  const side = [];
  for (let t = tFront + (o.curve ?? 0.25) / cx.L; t <= tEnd; t += 0.008) side.push([shoulderX(cx, t) - (o.inset ?? 0.05), Z(t)]);
  ribbon(B, gapMat(), cx.skin, 'top', side, 0.025);
}

/** Shut lines round a boot lid. */
function trunkLines(B, cx, tFront) {
  const { Z, fn } = cx;
  const xf = shoulderX(cx, tFront) - 0.05;
  const across = [];
  for (let k = 0; k <= 16; k++) { const x = -xf + (2 * xf * k) / 16; across.push([x, Z(tFront) - 0.05 * (x / xf) ** 2]); }
  ribbon(B, gapMat(), cx.skin, 'top', across, 0.025, { mirror: false });
  const side = [];
  for (let t = tFront; t <= 0.985; t += 0.008) side.push([shoulderX(cx, t) - 0.05, Z(t)]);
  ribbon(B, gapMat(), cx.skin, 'top', side, 0.025);
  ribbon(B, gapMat(), cx.skin, 'rear', [[-xf * 0.95, fn.shoulder(0.99) - 0.35], [xf * 0.95, fn.shoulder(0.99) - 0.35]], 0.025, { mirror: false });
}

/** Shut lines round a tailgate or hatch, seen from behind. */
function hatchLines(B, cx, { w, y0, y1 }) {
  ribbon(B, gapMat(), cx.skin, 'rear', [[-w, y0], [w, y0], [w * 0.94, y1], [-w * 0.94, y1]], 0.028, { mirror: false, closed: true });
}

function roofRails(B, cx, [t0, t1], mat = M.alloy('#2e3135', 0.4)) {
  const { Z, car, fn } = cx;
  const G = car.glass;
  const tum = typeof G.tumble === 'number' ? G.tumble : 0.4;
  const ins = typeof G.inset === 'number' ? G.inset : 0.3;
  const line = [];
  for (let t = t0; t <= t1; t += 0.01) line.push([(car.W / 2) * fn.plan(t) - ins - tum - 0.28, Z(t)]);
  ribbon(B, mat, cx.skin, 'top', line, 0.13, { off: 0.1, raise: 0.08 });
  for (const t of [t0, t1]) {
    const x = (car.W / 2) * fn.plan(t) - ins - tum - 0.28;
    const g = boxGeo(0.14, 0.42, 0.14);
    g.translate(0, 0, 0.07);
    stud(B, g, mat, cx.skin, 'top', x, Z(t), { off: 0 });
  }
}

/** Wheel-arch mouldings: a solid flare round each opening, standing off the
 *  body side (plastic cladding, or body colour), squared off on top for the
 *  boxier off-roaders. */
function archFlares(B, cx, { w = 0.22, raise = 0.06, mat = null, square = false } = {}) {
  const m = mat || M.cladding();
  for (const a of cx.ax) {
    const t = (a.z + cx.L / 2) / cx.L;
    const yb = cx.fn.bottom(t) + 0.2 - a.y;
    const R0 = a.Ra + 0.01;
    const R1 = a.Ra + w;
    const cap = (r) => (square ? r * 0.9 : r);
    const outer = [];
    const inner = [];
    for (let k = 0; k <= 28; k++) {
      const th = (k / 28) * PI;
      outer.push([-Math.cos(th) * R1, Math.max(yb, Math.min(cap(R1), Math.sin(th) * R1))]);
      inner.push([-Math.cos(th) * R0, Math.max(yb, Math.min(cap(R0), Math.sin(th) * R0))]);
    }
    // Shape x is -z (so the extrusion lands the right way round), y is up.
    const sh = new THREE.Shape();
    sh.moveTo(-R1, yb);
    for (const [x, y] of outer) sh.lineTo(x, y);
    sh.lineTo(R1, yb);
    sh.lineTo(R0, yb);
    for (const [x, y] of [...inner].reverse()) sh.lineTo(x, y);
    sh.lineTo(-R0, yb);
    sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: raise + 0.12, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 2, curveSegments: 4 });
    g.rotateY(PI / 2);
    // Sit it on the body side at the arch, standing out by `raise`.
    const x = (cx.skin.sideX(a.z, a.y + a.Ra * 0.75) ?? (cx.car.W / 2) * cx.fn.plan(t)) - 0.12;
    g.translate(x, a.y, a.z);
    B.add(g, m);
    B.add(mirrored(g), m);
  }
}

/** Running boards under the doors. */
function sideSteps(B, cx, [t0, t1], mat = M.cladding('#18191b')) {
  const { Z, car, fn } = cx;
  const tm = (t0 + t1) / 2;
  const hw = (car.W / 2) * fn.plan(tm);
  const y = fn.bottom(tm) - 0.12;
  for (const s of [1, -1]) {
    B.box(mat, 0.62, 0.14, Z(t1) - Z(t0), s * (hw + 0.08), y, (Z(t0) + Z(t1)) / 2);
    B.box(M.alloy('#9aa0a6', 0.35), 0.5, 0.03, Z(t1) - Z(t0) - 0.2, s * (hw + 0.1), y + 0.085, (Z(t0) + Z(t1)) / 2);
    for (const t of [t0 + 0.03, t1 - 0.03]) B.box(M.metal('#2b2e33', 0.5), 0.5, 0.3, 0.2, s * (hw - 0.15), y + 0.15, Z(t));
  }
}

function rearWiper(B, cx, y, len = 1.0) {
  ribbon(B, BLACK(), cx.skin, 'rear', [[0, y], [len * 0.85, y + len * 0.5]], 0.05, { off: 0.03, raise: 0.03, mirror: false });
  badge(B, cx, 'rear', 0, y, 0.07, BLACK());
}

function brakeLight(B, cx, y, w = 0.9) {
  decal(B, cx.tailLed, cx.skin, 'rear', roundRect(0, y, w, 0.09, 0.03), { off: 0.02, mirror: false, sub: 1 });
}

function aerial(B, cx, t) {
  const fin = new THREE.SphereGeometry(0.3, 12, 8).scale(0.22, 1, 0.5);
  stud(B, fin, BLACK(), cx.skin, 'top', 0, cx.Z(t), { off: 0.02, mirror: false });
}

/** A spare wheel standing upright on the tailgate, its face to the rear. */
function spareWheel(B, cx, y, z, w = {}) {
  const tmp = new Builder();
  carWheel(tmp, 0, 0, 0, cx.ax[0].R, cx.car.tireW, 1, { ...cx.car.wheel, ...w, caliper: false });
  const m = new THREE.Matrix4().makeRotationY(-PI / 2).setPosition(0, y, z);
  for (const [mat, geos] of tmp.parts) for (const g of geos) B.add(g.applyMatrix4(m), mat);
}

/** A separate bumper bar across the front (end -1) or back (end 1):
 *  for trucks and off-roaders. */
function bumper(B, cx, end, o = {}) {
  const { car } = cx;
  const t = end < 0 ? 0 : 1;
  const hw = (car.W / 2) * cx.fn.plan(t) + (o.wide ?? 0.12);
  const z = end * (cx.L / 2 + (o.out ?? 0.18));
  const d = o.depth ?? 0.55;
  const mat = o.mat || M.metal('#202225', 0.55);
  const h = o.y1 - o.y0;
  // The bar, its rounded ends wrapping back, and a black lower lip.
  B.box(mat, hw * 2 - 0.5, h, d, 0, (o.y0 + o.y1) / 2, z - end * d * 0.1);
  for (const s of [1, -1]) B.box(mat, 0.6, h * 0.92, d + 0.6, s * (hw - 0.35), (o.y0 + o.y1) / 2, z - end * 0.35, [0, s * end * 0.35, 0]);
  if (o.lower) B.box(o.lower, hw * 2 - 1.0, h * 0.45, d * 0.8, 0, o.y0 + h * 0.22, z + end * 0.04);
  if (o.step) B.box(M.cladding('#18191b'), hw * 1.1, 0.06, d * 0.7, 0, o.y1 + 0.03, z);
  if (o.fog) for (const s of [1, -1]) B.box(cx.drl, 0.45, 0.16, 0.05, s * (hw - 0.75), o.y0 + h * 0.62, z + end * (d / 2 + 0.02));
}

/** Everything most models share. */
function finish(B, cx, o) {
  const { fn, paint } = cx;
  const matOf = (m) => (m === 'paint' ? paint : m === 'chrome' ? M.chrome() : m === 'black' || !m ? BLACK() : m);
  if (cx.car.glass) {
    if (o.b) pillar(B, cx, o.b[0], o.b[1], matOf(o.bMat || 'black'), o.bLean || 0);
    for (const p of o.mid || []) pillar(B, cx, p[0], p[1], matOf(p[2] || 'black'), p[3] || 0);
    if (o.rear) rearPillar(B, cx, o.rear.tb, o.rear.tt, matOf(o.rear.mat || 'paint'), o.rear);
    if (o.dlo) dlo(B, cx, matOf(o.dlo.mat || 'chrome'), o.dlo);
  }
  if (o.doors) doorLines(B, cx, o.doors, { sill: o.sill });
  for (const t of o.handles || []) handle(B, cx, t, (fn.belt ? fn.belt(t) : fn.shoulder(t)) - (o.handleDrop ?? 0.32), { mat: matOf(o.handleMat || 'paint') });
  if (o.mirror) mirrorAt(B, cx, o.mirror.t, (fn.belt ? fn.belt(o.mirror.t) : fn.shoulder(o.mirror.t)) + (o.mirror.dy ?? 0.06), o.mirror);
  if (o.hood != null) hoodLines(B, cx, o.hood, o.hoodOpts || {});
  if (o.trunk != null) trunkLines(B, cx, o.trunk);
  if (o.hatch) hatchLines(B, cx, o.hatch);
  if (o.wipers !== false && cx.car.glass) wipers(B, cx);
  if (o.fin != null) aerial(B, cx, o.fin);
  if (o.rails) roofRails(B, cx, o.rails);
  if (o.flares) archFlares(B, cx, o.flares);
  if (o.steps) sideSteps(B, cx, o.steps);
  if (o.rearWiper != null) rearWiper(B, cx, o.rearWiper);
  if (o.brake != null) brakeLight(B, cx, o.brake);
  if (o.plates) plates(B, cx, o.plates.front != null ? [0, o.plates.front] : null, o.plates.rear != null ? [0, o.plates.rear] : null);
  wheels(B, cx, o.wheel || {});
  if (o.cabin !== false && DETAIL) cabin(B, cx, o.cabin || {});
}

/** Lines along a straight run of keys, so a spline follows it exactly. */
function straight(a, b, n = 8) {
  const out = [];
  for (let k = 0; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  return out;
}

const mirrorX = (pts) => pts.map(([x, y]) => [-x, y]).reverse();

/* ================================================================ the models */

/* Toyota Camry: a sleek mid-size sedan — hammerhead nose, big trapezoid lower
 * grille, slim swept headlamps, a long low deck with lamps joined by a band. */
MODELS['toyota-camry'] = {
  spec: {
    tireW: 0.77,
    wheel: { style: 'split', rimColor: '#b9bfc5', rimR: 0.75 },
    lines: {
      top: [[0, 2.0], [0.008, 2.3], [0.025, 2.52], [0.045, 2.61], [0.13, 2.76], [0.22, 2.95], [0.29, 3.12], [0.305, 3.2], [0.83, 3.44], [0.87, 3.47], [0.955, 3.44], [0.975, 3.38], [0.99, 3.2], [1, 2.75]],
      shoulder: [[0, 1.9], [0.008, 2.15], [0.03, 2.42], [0.1, 2.58], [0.29, 3.04], [0.305, 3.14], [0.83, 3.38], [0.95, 3.38], [0.975, 3.3], [0.99, 3.1], [1, 2.6]],
      bottom: [[0, 1.0], [0.008, 0.76], [0.025, 0.62], [0.1, 0.58], [0.8, 0.6], [0.93, 0.82], [0.975, 0.95], [0.993, 1.15], [1, 1.45]],
      plan: [[0, 0.62], [0.012, 0.78], [0.035, 0.88], [0.075, 0.95], [0.14, 0.99], [0.2, 1], [0.84, 1], [0.92, 0.975], [0.965, 0.92], [0.99, 0.84], [1, 0.74]],
      tuck: 0.06, shR: 0.22, botR: 0.24,
    },
    glass: {
      a0: 0.305, a1: 0.465, c0: 0.7, r1: 0.835,
      roof: [[0.305, 3.24], [0.465, 4.62], [0.56, 4.74], [0.66, 4.69], [0.7, 4.6], [0.835, 3.5]],
      edge: [[0.305, 3.2], [0.465, 4.38], [0.56, 4.47], [0.7, 4.34], [0.835, 3.45]],
      belt: [[0.305, 3.2], [0.835, 3.45]],
      inset: 0.3, tumble: 0.5,
    },
  },
  details(B, cx) {
    const { skin } = cx;
    const hl = [[1.15, 2.42], [1.9, 2.5], [2.55, 2.5], [2.8, 2.38], [2.78, 2.2], [2.3, 2.16], [1.25, 2.26]];
    headlamp(B, cx, hl, { projectors: [[1.95, 2.33, 0.11], [2.35, 2.33, 0.1]], drl: [[1.25, 2.36], [1.9, 2.44], [2.55, 2.44], [2.72, 2.36]], amber: [[2.5, 2.22], [2.72, 2.24]] });
    grille(B, cx, [[-1.18, 2.42], [1.18, 2.42], [1.08, 2.3], [-1.08, 2.3]], { mesh: BLACK() });
    grille(B, cx, [[-1.75, 1.98], [1.75, 1.98], [1.95, 1.7], [1.7, 0.98], [-1.7, 0.98], [-1.95, 1.7]], { mesh: M.grilleMesh('#2d3034'), frame: BLACK() });
    for (const s of [1, -1]) decal(B, BLACK(), skin, 'front', [[s * 2.1, 1.75], [s * 2.45, 1.85], [s * 2.5, 1.2], [s * 2.05, 1.05]], { off: 0.012, mirror: false, sub: 2 });
    for (const s of [1, -1]) ribbon(B, cx.drl, skin, 'front', [[s * 2.2, 1.7], [s * 2.42, 1.75]], 0.05, { off: 0.025, mirror: false });
    badge(B, cx, 'front', 0, 2.36, 0.19);
    const tl = [[1.25, 3.3], [2.4, 3.33], [2.9, 3.25], [2.95, 3.05], [2.4, 3.02], [1.35, 3.1]];
    taillamp(B, cx, tl, { leds: [[[1.4, 3.22], [2.4, 3.25], [2.85, 3.18]], [[2.5, 3.1], [2.88, 3.1]]], reverse: [[1.5, 3.17], [1.85, 3.18], [1.85, 3.12], [1.5, 3.12]] });
    decal(B, BLACK(), skin, 'rear', [[-1.3, 3.28], [1.3, 3.28], [1.3, 3.12], [-1.3, 3.12]], { off: 0.01, mirror: false, sub: 1 });
    decal(B, M.plastic('#17181a', 0.8), skin, 'rear', [[-2.5, 1.45], [2.5, 1.45], [2.4, 1.05], [-2.4, 1.05]], { off: 0.006, mirror: false });
    lettering(B, cx, 'rear', 'Camry', -1.6, 2.92, 0.75);
    badge(B, cx, 'rear', 0, 3.0, 0.17);
    ribbon(B, cx.paint, skin, 'rear', [[-2.2, 3.45], [2.2, 3.45]], 0.08, { off: 0.0, raise: 0.05, mirror: false });
    finish(B, cx, {
      b: [0.553, 0.585], rear: { tb: 0.785, tt: 0.69, mat: 'paint' }, dlo: { mat: 'chrome', tTop: 0.69, down: 0.78 },
      doors: [0.3, 0.556, 0.79], handles: [0.505, 0.74], mirror: { t: 0.33, cap: 'black' },
      hood: 0.045, trunk: 0.84, fin: 0.685, plates: { front: 1.4, rear: 2.38 },
    });
  },
};

/* Toyota RAV4: a squared-off compact SUV with black arch cladding, an
 * octagonal grille, thin angular lamps and roof rails. */
MODELS['toyota-rav4'] = {
  spec: {
    tireW: 0.74, archGap: 0.22, clad: true,
    wheel: { style: 'five', rimColor: '#4a4e54', rimR: 0.75, rough: 0.35 },
    lines: {
      top: [[0, 2.55], [0.01, 2.85], [0.03, 3.15], [0.06, 3.32], [0.15, 3.45], [0.24, 3.62], [0.265, 3.72], [0.93, 3.92], [0.95, 3.9], [0.975, 3.82], [0.99, 3.6], [1, 3.25]],
      shoulder: [[0, 2.45], [0.01, 2.75], [0.03, 3.05], [0.15, 3.32], [0.255, 3.6], [0.265, 3.66], [0.93, 3.86], [0.975, 3.7], [0.99, 3.45], [1, 3.1]],
      bottom: [[0, 1.45], [0.012, 1.15], [0.04, 0.98], [0.1, 0.9], [0.85, 0.92], [0.94, 1.05], [0.985, 1.3], [1, 1.6]],
      plan: [[0, 0.68], [0.012, 0.82], [0.04, 0.91], [0.09, 0.97], [0.16, 1], [0.86, 1], [0.94, 0.975], [0.98, 0.92], [1, 0.84]],
      tuck: 0.05, shR: 0.18, botR: 0.22,
    },
    glass: {
      a0: 0.265, a1: 0.395, c0: 0.925, r1: 0.965,
      roof: [[0.265, 3.75], [0.395, 5.38], [0.55, 5.58], [0.85, 5.52], [0.925, 5.4], [0.965, 3.98]],
      edge: [[0.265, 3.72], [0.395, 5.15], [0.55, 5.32], [0.88, 5.25], [0.925, 5.15], [0.965, 3.95]],
      belt: [[0.265, 3.72], [0.7, 3.84], [0.965, 3.95]],
      inset: 0.32, tumble: 0.42, roofMat: 'black',
    },
  },
  details(B, cx) {
    const { skin } = cx;
    headlamp(B, cx, [[1.35, 3.12], [2.55, 3.2], [2.85, 3.1], [2.8, 2.9], [1.5, 2.97]], { projectors: [[2.05, 3.05, 0.1], [2.4, 3.05, 0.1]], drl: [[1.45, 3.07], [2.55, 3.13], [2.78, 3.0]] });
    grille(B, cx, [[-1.3, 3.05], [1.3, 3.05], [1.85, 2.6], [1.7, 1.6], [-1.7, 1.6], [-1.85, 2.6]], { mesh: M.grilleMesh('#24272b'), frame: M.cladding() });
    decal(B, M.alloy('#9aa1a8', 0.45), skin, 'front', [[-1.3, 1.5], [1.3, 1.5], [1.05, 1.22], [-1.05, 1.22]], { off: 0.02, mirror: false });
    for (const s of [1, -1]) decal(B, M.cladding(), skin, 'front', [[s * 2.0, 2.45], [s * 2.75, 2.6], [s * 2.8, 1.5], [s * 1.95, 1.55]], { off: 0.012, mirror: false });
    for (const s of [1, -1]) decal(B, cx.drl, skin, 'front', roundRect(s * 2.4, 1.95, 0.4, 0.22, 0.08), { off: 0.025, mirror: false, sub: 1 });
    badge(B, cx, 'front', 0, 2.6, 0.22);
    taillamp(B, cx, [[1.7, 3.62], [2.75, 3.62], [2.95, 3.4], [2.3, 3.32], [1.8, 3.42]], { leds: [[[1.85, 3.52], [2.75, 3.52], [2.9, 3.42]]] });
    decal(B, M.cladding(), skin, 'rear', [[-2.7, 1.8], [2.7, 1.8], [2.75, 1.25], [-2.75, 1.25]], { off: 0.008, mirror: false });
    lettering(B, cx, 'rear', 'RAV4', 0, 3.25, 0.9);
    finish(B, cx, {
      b: [0.515, 0.545], mid: [[0.745, 0.77]], rear: { tb: 0.875, tt: 0.85, mat: 'paint' }, dlo: { mat: 'black', tTop: 0.9, down: 0.875 },
      doors: [0.275, 0.53, 0.755], handles: [0.47, 0.71], mirror: { t: 0.29, cap: 'black', size: 0.3 },
      hood: 0.045, hatch: { w: 2.35, y0: 2.45, y1: 5.3 }, rearWiper: 4.5, brake: 5.35, rails: [0.43, 0.88], flares: { w: 0.32, raise: 0.05, square: true },
      plates: { front: 2.05, rear: 2.75 },
    });
  },
};

/* Ford F-150: a full-size crew-cab pickup — a tall square bonnet, a big grille
 * with two heavy bars, C-clamp lamps, a chrome bumper and a 5.5 ft bed. */
MODELS['ford-f150'] = {
  spec: {
    tireW: 0.9, archGap: 0.3, bed: [0.672, 1],
    wheel: { style: 'six', rimColor: '#c9ced3', rimR: 0.83, nuts: 6 },
    lines: {
      top: [[0, 4.22], [0.004, 4.36], [0.012, 4.43], [0.05, 4.48], [0.2, 4.58], [0.27, 4.7], [0.285, 4.75], [0.665, 4.85], [0.672, 4.88], [0.995, 4.88], [1, 4.8]],
      shoulder: [[0, 4.05], [0.004, 4.25], [0.012, 4.33], [0.27, 4.6], [0.285, 4.68], [0.665, 4.78], [0.672, 4.85], [0.99, 4.85], [1, 4.7]],
      bottom: [[0, 1.55], [0.01, 1.45], [0.04, 1.5], [0.1, 1.65], [0.9, 1.7], [0.995, 1.75], [1, 1.95]],
      plan: [[0, 0.93], [0.004, 0.975], [0.012, 0.995], [0.03, 1], [0.97, 1], [0.995, 0.99], [1, 0.97]],
      tuck: 0.03, shR: 0.12, botR: 0.15, topIn: 0.01,
    },
    glass: {
      a0: 0.285, a1: 0.39, c0: 0.64, r1: 0.66,
      roof: [[0.285, 4.78], [0.39, 6.28], [0.5, 6.43], [0.62, 6.4], [0.64, 6.33], [0.66, 4.95]],
      edge: [[0.285, 4.75], [0.39, 6.05], [0.5, 6.18], [0.64, 6.12], [0.66, 4.92]],
      belt: [[0.285, 4.75], [0.66, 4.85]],
      inset: 0.28, tumble: 0.32,
    },
  },
  details(B, cx) {
    const { skin, Z } = cx;
    // C-clamp headlamps either side of the grille.
    const hl = [[2.15, 4.28], [3.12, 4.28], [3.25, 3.62], [2.2, 3.6]];
    headlamp(B, cx, hl, { projectors: [[2.5, 3.95, 0.13], [2.85, 3.95, 0.13]], drl: [[2.3, 3.72], [2.3, 4.18], [3.08, 4.18], [3.15, 3.72]], drlW: 0.07 });
    grille(B, cx, [[-2.05, 4.28], [2.05, 4.28], [2.1, 3.0], [-2.1, 3.0]], {
      mesh: M.grilleMesh('#2b2e33'), frame: M.chrome(), frameW: 0.12,
      bars: [[[-2.05, 3.88], [2.05, 3.88]], [[-2.08, 3.4], [2.08, 3.4]]], barW: 0.16,
    });
    bumper(B, cx, -1, { y0: 1.7, y1: 2.95, mat: M.alloy('#c7ccd1', 0.28), lower: M.cladding(), fog: true });
    badge(B, cx, 'front', 0, 3.64, 0.3, M.alloy('#1f3e7a', 0.25));
    for (const s of [1, -1]) B.box(M.painted('#c32020', 0.4), 0.25, 0.3, 0.45, s * 1.6, 1.95, -cx.L / 2 + 0.15);
    // Tailgate, lamps, step bumper.
    taillamp(B, cx, [[2.85, 4.75], [3.28, 4.75], [3.28, 3.15], [2.85, 3.15]], { leds: [[[3.05, 4.6], [3.05, 3.3]]], reverse: [[2.9, 3.95], [3.24, 3.95], [3.24, 3.6], [2.9, 3.6]] });
    hatchLines(B, cx, { w: 2.75, y0: 2.75, y1: 4.86 });
    bumper(B, cx, 1, { y0: 1.8, y1: 2.6, mat: M.alloy('#c7ccd1', 0.28), step: true });
    decal(B, BLACK(), skin, 'rear', roundRect(0, 4.3, 0.9, 0.22, 0.05), { off: 0.015, mirror: false, sub: 1 });
    lettering(B, cx, 'rear', 'F-150', 0, 3.75, 1.4);
    pickupBed(B, cx, 0.672);
    finish(B, cx, {
      b: [0.47, 0.5], rear: { tb: 0.632, tt: 0.628, mat: 'paint' }, dlo: { mat: 'black', tTop: 0.63, down: 0.632 },
      doors: [0.29, 0.475, 0.636], handles: [0.43, 0.6], handleMat: 'chrome', mirror: { t: 0.3, cap: 'black', size: 0.36, out: 0.55 },
      hood: 0.03, hoodOpts: { inset: 0.1, curve: 0.05 }, steps: [0.29, 0.63], flares: { w: 0.2, raise: 0.05 },
      plates: { front: null, rear: null }, cabin: { rows: 1 },
    });
    decal(B, plate(), skin, 'rear', roundRect(0, 2.2, 1.0, 0.5, 0.04), { off: 0.38, mirror: false, uv: 'fit', sub: 1 });
    void Z;
  },
};

/** A pickup's load bed: floor, walls, wheel humps, rail caps, the tailgate inside. */
function pickupBed(B, cx, t0) {
  const { Z, car, fn } = cx;
  const liner = M.cladding('#3a3d41');
  const z0 = Z(t0) + 0.04;
  const z1 = cx.L / 2 - 0.22;
  const floorY = fn.bottom(0.85) + 1.25;
  const railY = fn.shoulder(0.85) - 0.02;
  const hw = (car.W / 2) * fn.plan(0.85) - 0.24;
  B.box(liner, hw * 2, 0.1, z1 - z0, 0, floorY, (z0 + z1) / 2);
  for (let k = 0; k < 9; k++) B.box(liner, 0.12, 0.05, z1 - z0, -hw + 0.4 + k * ((hw * 2 - 0.8) / 8), floorY + 0.07, (z0 + z1) / 2);
  for (const s of [-1, 1]) {
    B.box(liner, 0.14, railY - floorY, z1 - z0, s * hw, (railY + floorY) / 2, (z0 + z1) / 2);
    const az = cx.ax[1].z;
    B.box(liner, 0.85, 1.0, 3.4, s * (hw - 0.45), floorY + 0.5, az);
    ribbon(B, M.cladding('#141517'), cx.skin, 'top', [[hw + 0.12, z0 + 0.1], [hw + 0.12, z1]], 0.32, { off: 0.01, raise: 0.03 });
  }
  B.box(liner, hw * 2, railY - floorY + 0.1, 0.14, 0, (railY + floorY) / 2, z0);
  B.box(liner, hw * 2, railY - floorY, 0.14, 0, (railY + floorY) / 2, z1);
}

/* Ford Mustang: a long-bonnet fastback coupe — shark nose, trapezoid grille,
 * three-bar lamps front and rear, wide rear haunches and quad tailpipes. */
MODELS['ford-mustang'] = {
  spec: {
    tireW: 0.84, archGap: 0.13,
    wheel: { style: 'split', rimColor: '#232528', rimR: 0.79, caliper: '#b0141b', rough: 0.3 },
    lines: {
      top: [[0, 1.75], [0.008, 2.05], [0.025, 2.32], [0.06, 2.48], [0.15, 2.62], [0.26, 2.85], [0.33, 3.05], [0.345, 3.1], [0.86, 3.3], [0.9, 3.33], [0.97, 3.32], [0.99, 3.22], [1, 2.85]],
      shoulder: [[0, 1.7], [0.025, 2.2], [0.1, 2.42], [0.33, 2.98], [0.345, 3.05], [0.86, 3.24], [0.96, 3.25], [0.99, 3.05], [1, 2.75]],
      bottom: [[0, 0.95], [0.01, 0.62], [0.05, 0.5], [0.85, 0.52], [0.95, 0.7], [0.99, 1.0], [1, 1.25]],
      plan: [[0, 0.58], [0.015, 0.75], [0.05, 0.87], [0.12, 0.94], [0.26, 0.96], [0.45, 0.955], [0.62, 0.99], [0.72, 1], [0.88, 1], [0.95, 0.965], [0.985, 0.9], [1, 0.8]],
      tuck: 0.07, shR: 0.24, botR: 0.2,
    },
    glass: {
      a0: 0.345, a1: 0.49, c0: 0.6, r1: 0.86,
      roof: [[0.345, 3.12], [0.49, 4.38], [0.55, 4.53], [0.6, 4.45], [0.86, 3.32]],
      edge: [[0.345, 3.1], [0.49, 4.22], [0.55, 4.34], [0.6, 4.26], [0.86, 3.3]],
      belt: [[0.345, 3.1], [0.86, 3.3]],
      inset: 0.42, tumble: 0.5,
    },
  },
  details(B, cx) {
    const { skin, Z } = cx;
    const hl = [[1.45, 2.3], [2.55, 2.4], [2.85, 2.22], [2.75, 2.05], [1.6, 2.08]];
    headlamp(B, cx, hl, { projectors: [[1.85, 2.2, 0.1]] });
    for (const x of [2.15, 2.32, 2.49]) ribbon(B, cx.drl, skin, 'front', [[x, 2.13], [x + 0.04, 2.33]], 0.05, { off: 0.03 });
    grille(B, cx, [[-1.35, 2.15], [1.35, 2.15], [1.6, 1.25], [-1.6, 1.25]], { mesh: M.grilleMesh('#202226'), frame: BLACK() });
    for (const s of [1, -1]) decal(B, M.grilleMesh('#202226'), skin, 'front', [[s * 1.85, 1.55], [s * 2.65, 1.7], [s * 2.7, 1.0], [s * 1.9, 0.95]], { off: 0.012, mirror: false });
    for (const s of [1, -1]) decal(B, BLACK(), skin, 'top', [[s * 0.75, Z(0.11)], [s * 1.25, Z(0.11)], [s * 1.25, Z(0.17)], [s * 0.75, Z(0.17)]], { off: 0.012, mirror: false });
    badge(B, cx, 'front', 0, 1.75, 0.18);
    decal(B, BLACK(), skin, 'rear', [[-2.55, 3.22], [2.55, 3.22], [2.45, 2.75], [-2.45, 2.75]], { off: 0.008, mirror: false });
    for (const x of [1.55, 1.85, 2.15]) taillamp(B, cx, roundRect(x, 2.98, 0.2, 0.42, 0.05), { leds: [[[x, 2.82], [x, 3.14]]] });
    decal(B, M.plastic('#141517', 0.75), skin, 'rear', [[-2.6, 1.3], [2.6, 1.3], [2.5, 0.75], [-2.5, 0.75]], { off: 0.008, mirror: false });
    exhaust(B, cx, [[-2.15, 0.95], [-1.75, 0.95], [1.75, 0.95], [2.15, 0.95]], { r: 0.15 });
    lettering(B, cx, 'rear', 'MUSTANG', 0, 2.6, 1.2);
    ribbon(B, BLACK(), skin, 'rear', [[-2.3, 3.32], [2.3, 3.32]], 0.12, { off: 0, raise: 0.08, mirror: false });
    finish(B, cx, {
      rear: { tb: 0.68, tt: 0.6, mat: 'paint' }, dlo: { mat: 'black', tTop: 0.6, down: 0.68 },
      doors: [0.35, 0.6], handles: [0.55], mirror: { t: 0.37, cap: 'paint' },
      hood: 0.03, hoodOpts: { inset: 0.08 }, trunk: 0.875, fin: 0.58, plates: { front: null, rear: 2.0 },
      cabin: { rows: 1, rowGap: 2.5 },
    });
  },
};

/* Chevrolet Tahoe: a big body-on-frame SUV — tall flat bonnet, a wide grille
 * split by a heavy bar, two-tier lamps, three rows of seats. */
MODELS['chevrolet-tahoe'] = {
  spec: {
    tireW: 0.9, archGap: 0.28,
    wheel: { style: 'six', rimColor: '#cfd4d8', rimR: 0.917, nuts: 6 },
    lines: {
      top: [[0, 3.2], [0.006, 3.55], [0.02, 3.88], [0.05, 4.02], [0.2, 4.15], [0.245, 4.25], [0.255, 4.3], [0.975, 4.45], [0.99, 4.35], [1, 4.05]],
      shoulder: [[0, 3.05], [0.006, 3.45], [0.02, 3.8], [0.245, 4.18], [0.255, 4.24], [0.975, 4.38], [0.99, 4.25], [1, 3.95]],
      bottom: [[0, 1.6], [0.01, 1.3], [0.04, 1.2], [0.1, 1.25], [0.9, 1.3], [0.98, 1.45], [1, 1.8]],
      plan: [[0, 0.82], [0.006, 0.91], [0.02, 0.96], [0.06, 0.99], [0.1, 1], [0.93, 1], [0.975, 0.985], [0.993, 0.95], [1, 0.9]],
      tuck: 0.03, shR: 0.14, botR: 0.18,
    },
    glass: {
      a0: 0.255, a1: 0.355, c0: 0.968, r1: 0.982,
      roof: [[0.255, 4.33], [0.355, 6.2], [0.5, 6.37], [0.95, 6.33], [0.968, 6.27], [0.982, 4.5]],
      edge: [[0.255, 4.3], [0.355, 5.98], [0.5, 6.1], [0.968, 6.05], [0.982, 4.47]],
      belt: [[0.255, 4.3], [0.982, 4.45]],
      inset: 0.3, tumble: 0.32,
    },
  },
  details(B, cx) {
    const { skin } = cx;
    headlamp(B, cx, [[2.15, 3.92], [3.18, 3.92], [3.28, 3.75], [2.2, 3.72]], { drl: [[2.25, 3.84], [3.15, 3.84]] });
    headlamp(B, cx, [[2.25, 3.2], [3.15, 3.2], [3.22, 2.85], [2.3, 2.85]], { projectors: [[2.55, 3.02, 0.12], [2.9, 3.02, 0.12]] });
    grille(B, cx, [[-2.1, 3.9], [2.1, 3.9], [2.2, 2.55], [-2.2, 2.55]], { mesh: M.grilleMesh('#3a3e43'), frame: M.chrome(), frameW: 0.1 });
    ribbon(B, M.chrome(), skin, 'front', [[-3.25, 3.4], [3.25, 3.4]], 0.32, { off: 0.04, raise: 0.05, mirror: false });
    badge(B, cx, 'front', 0, 3.4, 0.32, M.alloy('#c9a227', 0.25));
    decal(B, M.cladding(), skin, 'front', [[-2.6, 2.4], [2.6, 2.4], [2.7, 1.6], [-2.7, 1.6]], { off: 0.015, mirror: false });
    decal(B, M.alloy('#9aa1a8', 0.45), skin, 'front', [[-1.4, 1.75], [1.4, 1.75], [1.2, 1.45], [-1.2, 1.45]], { off: 0.025, mirror: false });
    taillamp(B, cx, [[2.65, 4.42], [3.3, 4.42], [3.33, 3.35], [2.75, 3.35]], { leds: [[[2.8, 4.3], [3.2, 4.3], [3.2, 3.5]]] });
    decal(B, M.cladding(), skin, 'rear', [[-3.1, 2.3], [3.1, 2.3], [3.15, 1.6], [-3.15, 1.6]], { off: 0.01, mirror: false });
    lettering(B, cx, 'rear', 'TAHOE', 0, 3.2, 1.2);
    badge(B, cx, 'rear', 0, 3.85, 0.25, M.alloy('#c9a227', 0.25));
    exhaust(B, cx, [[2.3, 1.45]], { r: 0.16 });
    finish(B, cx, {
      b: [0.445, 0.475], mid: [[0.665, 0.695]], rear: { tb: 0.885, tt: 0.875, mat: 'paint' }, dlo: { mat: 'chrome', tTop: 0.9, down: 0.885 },
      doors: [0.26, 0.45, 0.67], handles: [0.41, 0.63], handleMat: 'chrome', mirror: { t: 0.275, cap: 'paint', size: 0.34 },
      hood: 0.03, hoodOpts: { inset: 0.12, curve: 0.08 }, hatch: { w: 2.65, y0: 2.75, y1: 6.15 }, rearWiper: 5.0, brake: 6.15,
      rails: [0.4, 0.92], steps: [0.26, 0.69], plates: { front: 2.0, rear: 2.75 }, cabin: { rows: 2 },
    });
  },
};

/* Chevrolet Corvette (C8): mid-engined — a low nose, the cabin pushed
 * forward, big side intakes, a glass engine cover and quad centre exhausts. */
MODELS['chevrolet-corvette'] = {
  spec: {
    tireW: 0.88, archGap: 0.12,
    wheel: { style: 'five', rimColor: '#2b2d31', rimR: 0.83, caliper: '#c8241b', rough: 0.3 },
    lines: {
      top: [[0, 1.42], [0.01, 1.7], [0.035, 1.9], [0.1, 2.1], [0.2, 2.35], [0.28, 2.6], [0.3, 2.68], [0.61, 3.02], [0.635, 3.32], [0.75, 3.3], [0.93, 3.25], [0.975, 3.3], [0.99, 3.22], [1, 2.75]],
      shoulder: [[0, 1.36], [0.035, 1.82], [0.12, 2.05], [0.28, 2.5], [0.3, 2.62], [0.61, 2.95], [0.66, 3.2], [0.95, 3.18], [0.99, 3.05], [1, 2.65]],
      bottom: [[0, 0.72], [0.012, 0.45], [0.06, 0.38], [0.9, 0.42], [0.97, 0.62], [1, 1.05]],
      plan: [[0, 0.52], [0.015, 0.72], [0.05, 0.86], [0.13, 0.93], [0.25, 0.95], [0.45, 0.94], [0.6, 0.97], [0.75, 1], [0.9, 1], [0.965, 0.96], [0.99, 0.88], [1, 0.8]],
      tuck: 0.08, shR: 0.26, botR: 0.18,
    },
    glass: {
      a0: 0.3, a1: 0.43, c0: 0.51, r1: 0.62,
      roof: [[0.3, 2.7], [0.43, 3.92], [0.47, 4.05], [0.51, 3.98], [0.62, 3.08]],
      edge: [[0.3, 2.68], [0.43, 3.75], [0.47, 3.86], [0.51, 3.8], [0.62, 3.05]],
      belt: [[0.3, 2.68], [0.62, 3.03]],
      inset: 0.55, tumble: 0.5, roofMat: 'black', pillarMat: 'black',
    },
  },
  details(B, cx) {
    const { skin, Z } = cx;
    headlamp(B, cx, [[1.5, 1.98], [2.55, 2.12], [2.85, 2.05], [2.75, 1.88], [1.65, 1.84]], { projectors: [[2.2, 1.98, 0.09]], drl: [[1.6, 1.92], [2.55, 2.06], [2.8, 2.0]] });
    grille(B, cx, [[-1.2, 1.55], [1.2, 1.55], [1.1, 0.95], [-1.1, 0.95]], { mesh: M.grilleMesh('#1d1f22'), frame: BLACK() });
    for (const s of [1, -1]) decal(B, M.grilleMesh('#1d1f22'), skin, 'front', [[s * 1.5, 1.6], [s * 2.4, 1.75], [s * 2.6, 1.1], [s * 1.6, 0.95]], { off: 0.012, mirror: false });
    badge(B, cx, 'front', 0, 1.82, 0.16);
    // Side intakes ahead of the rear wheels, and the glass engine cover.
    decal(B, M.grilleMesh('#141517'), skin, 'side', [[Z(0.575), 2.9], [Z(0.7), 2.98], [Z(0.715), 1.55], [Z(0.62), 1.3]], { off: 0.012 });
    decal(B, cx.glassMat, skin, 'top', [[-1.35, Z(0.645)], [1.35, Z(0.645)], [1.25, Z(0.82)], [-1.25, Z(0.82)]], { off: 0.02, mirror: false });
    for (let t = 0.66; t < 0.82; t += 0.025) ribbon(B, BLACK(), skin, 'top', [[-1.25, Z(t)], [1.25, Z(t)]], 0.05, { off: 0.03, mirror: false });
    taillamp(B, cx, [[1.6, 3.15], [2.75, 3.12], [2.95, 2.85], [2.4, 2.75], [1.7, 2.9]], { leds: [[[1.7, 3.0], [2.7, 3.02], [2.85, 2.9]]] });
    decal(B, BLACK(), skin, 'rear', [[-2.7, 1.5], [2.7, 1.5], [2.55, 0.8], [-2.55, 0.8]], { off: 0.008, mirror: false });
    exhaust(B, cx, [[-0.85, 1.1], [-0.4, 1.1], [0.4, 1.1], [0.85, 1.1]], { r: 0.14 });
    lettering(B, cx, 'rear', 'CORVETTE', 0, 2.62, 1.3);
    ribbon(B, BLACK(), skin, 'top', [[-2.4, Z(0.982)], [2.4, Z(0.982)]], 0.3, { off: 0.02, raise: 0.14, mirror: false });
    finish(B, cx, {
      rear: { tb: 0.555, tt: 0.505, mat: 'paint' }, dlo: { mat: 'black', tTop: 0.5, down: 0.555 },
      doors: [0.31, 0.56], mirror: { t: 0.32, cap: 'paint', size: 0.24 },
      hood: 0.04, hoodOpts: { inset: 0.15, tEnd: 0.27 }, plates: { front: null, rear: 1.85 }, cabin: { rows: 0 },
    });
  },
};

/* Honda Civic hatchback: a low fastback hatch — slim lamps, a honeycomb lower
 * grille, a light bar across the tailgate. */
MODELS['honda-civic'] = {
  spec: {
    tireW: 0.77, archGap: 0.13,
    wheel: { style: 'split', rimColor: '#33363a', rimR: 0.75, rough: 0.3 },
    lines: {
      top: [[0, 1.95], [0.008, 2.22], [0.03, 2.45], [0.07, 2.55], [0.17, 2.7], [0.28, 2.95], [0.295, 3.02], [0.93, 3.3], [0.965, 3.33], [0.985, 3.25], [1, 2.9]],
      shoulder: [[0, 1.88], [0.03, 2.38], [0.1, 2.5], [0.28, 2.88], [0.295, 2.96], [0.93, 3.22], [0.98, 3.12], [1, 2.8]],
      bottom: [[0, 0.95], [0.01, 0.62], [0.04, 0.52], [0.85, 0.55], [0.95, 0.75], [0.99, 1.0], [1, 1.3]],
      plan: [[0, 0.6], [0.012, 0.77], [0.04, 0.88], [0.1, 0.95], [0.18, 0.99], [0.85, 1], [0.94, 0.97], [0.98, 0.9], [1, 0.8]],
      tuck: 0.06, shR: 0.2, botR: 0.22,
    },
    glass: {
      a0: 0.295, a1: 0.455, c0: 0.655, r1: 0.93,
      roof: [[0.295, 3.05], [0.455, 4.5], [0.55, 4.64], [0.64, 4.57], [0.655, 4.52], [0.93, 3.35]],
      edge: [[0.295, 3.02], [0.455, 4.36], [0.55, 4.47], [0.655, 4.36], [0.93, 3.32]],
      belt: [[0.295, 3.02], [0.93, 3.3]],
      inset: 0.3, tumble: 0.48,
    },
  },
  details(B, cx) {
    const { skin } = cx;
    headlamp(B, cx, [[1.3, 2.38], [2.4, 2.45], [2.7, 2.32], [2.6, 2.2], [1.4, 2.25]], { projectors: [[1.75, 2.32, 0.09], [2.05, 2.33, 0.09]], drl: [[1.35, 2.3], [2.4, 2.39], [2.62, 2.3]] });
    grille(B, cx, [[-1.25, 2.4], [1.25, 2.4], [1.15, 2.28], [-1.15, 2.28]], { mesh: BLACK() });
    grille(B, cx, [[-1.7, 2.0], [1.7, 2.0], [1.85, 1.3], [1.6, 1.0], [-1.6, 1.0], [-1.85, 1.3]], { mesh: M.grilleMesh('#202226'), frame: BLACK() });
    badge(B, cx, 'front', 0, 2.34, 0.16);
    taillamp(B, cx, [[1.1, 3.2], [2.55, 3.22], [2.85, 3.05], [2.55, 2.95], [1.2, 3.05]], { leds: [[[1.2, 3.12], [2.55, 3.14], [2.8, 3.05]]] });
    ribbon(B, cx.tailLed, skin, 'rear', [[-1.15, 3.13], [1.15, 3.13]], 0.05, { off: 0.025, mirror: false });
    decal(B, BLACK(), skin, 'rear', [[-2.4, 1.3], [2.4, 1.3], [2.3, 0.8], [-2.3, 0.8]], { off: 0.008, mirror: false });
    exhaust(B, cx, [[-0.28, 0.95], [0.28, 0.95]], { r: 0.13 });
    lettering(B, cx, 'rear', 'CIVIC', 0, 2.85, 0.75);
    ribbon(B, BLACK(), skin, 'rear', [[-2.2, 3.36], [2.2, 3.36]], 0.12, { off: 0, raise: 0.06, mirror: false });
    finish(B, cx, {
      b: [0.535, 0.565], rear: { tb: 0.785, tt: 0.66, mat: 'paint' }, dlo: { mat: 'black', tTop: 0.66, down: 0.78 },
      doors: [0.3, 0.54, 0.775], handles: [0.49, 0.73], mirror: { t: 0.32, cap: 'black' },
      hood: 0.04, hatch: { w: 2.3, y0: 2.35, y1: 3.4 }, fin: 0.645, plates: { front: 1.45, rear: 2.5 },
    });
  },
};

/* Honda Odyssey: a minivan — sliding rear doors on rails, the dropped belt
 * line over them, a wing-bar grille and captain's chairs. */
MODELS['honda-odyssey'] = {
  spec: {
    tireW: 0.77, archGap: 0.17,
    wheel: { style: 'multi', rimColor: '#c4c9ce', rimR: 0.79 },
    lines: {
      top: [[0, 2.35], [0.008, 2.65], [0.03, 2.95], [0.08, 3.15], [0.2, 3.38], [0.26, 3.55], [0.27, 3.6], [0.6, 3.67], [0.625, 3.5], [0.975, 3.57], [0.99, 3.45], [1, 3.2]],
      shoulder: [[0, 2.25], [0.03, 2.85], [0.2, 3.3], [0.26, 3.5], [0.27, 3.54], [0.6, 3.61], [0.625, 3.44], [0.975, 3.5], [0.99, 3.38], [1, 3.1]],
      bottom: [[0, 1.15], [0.01, 0.85], [0.04, 0.72], [0.88, 0.75], [0.97, 0.9], [1, 1.35]],
      plan: [[0, 0.66], [0.012, 0.8], [0.04, 0.9], [0.1, 0.97], [0.18, 1], [0.9, 1], [0.96, 0.98], [0.99, 0.93], [1, 0.87]],
      tuck: 0.04, shR: 0.18, botR: 0.22,
    },
    glass: {
      a0: 0.27, a1: 0.375, c0: 0.962, r1: 0.98,
      roof: [[0.27, 3.62], [0.375, 5.55], [0.5, 5.8], [0.93, 5.72], [0.962, 5.62], [0.98, 3.65]],
      edge: [[0.27, 3.6], [0.375, 5.32], [0.5, 5.52], [0.962, 5.42], [0.98, 3.6]],
      belt: [[0.27, 3.6], [0.6, 3.66], [0.625, 3.48], [0.98, 3.55]],
      inset: 0.3, tumble: 0.4,
    },
  },
  details(B, cx) {
    const { skin, Z, fn } = cx;
    headlamp(B, cx, [[1.6, 3.05], [2.9, 3.0], [3.1, 2.75], [2.4, 2.65], [1.65, 2.8]], { projectors: [[2.2, 2.85, 0.12], [2.6, 2.85, 0.11]], drl: [[1.7, 2.98], [2.85, 2.94], [3.02, 2.78]] });
    grille(B, cx, [[-1.6, 3.0], [1.6, 3.0], [1.4, 2.55], [-1.4, 2.55]], { mesh: M.grilleMesh('#2b2e33'), bars: [[[-2.3, 3.06], [2.3, 3.06]]], barW: 0.12 });
    grille(B, cx, [[-1.9, 2.1], [1.9, 2.1], [1.7, 1.3], [-1.7, 1.3]], { mesh: M.grilleMesh('#202226'), frame: BLACK() });
    badge(B, cx, 'front', 0, 2.8, 0.2);
    taillamp(B, cx, [[1.6, 3.95], [3.0, 3.85], [3.05, 3.5], [1.7, 3.55]], { leds: [[[1.75, 3.8], [2.95, 3.72]]] });
    ribbon(B, M.chrome(), skin, 'rear', [[-1.6, 3.72], [1.6, 3.72]], 0.1, { off: 0.03, raise: 0.02, mirror: false });
    decal(B, M.plastic('#17181a', 0.8), skin, 'rear', [[-2.9, 1.6], [2.9, 1.6], [2.8, 1.1], [-2.8, 1.1]], { off: 0.008, mirror: false });
    lettering(B, cx, 'rear', 'ODYSSEY', -1.7, 3.3, 1.0);
    // The sliding door's track along the rear quarter.
    ribbon(B, gapMat(), skin, 'side', [[Z(0.72), fn.belt(0.72) - 0.12], [Z(0.95), fn.belt(0.95) - 0.12]], 0.05);
    finish(B, cx, {
      b: [0.44, 0.47], mid: [[0.7, 0.73]], rear: { tb: 0.905, tt: 0.89, mat: 'paint' }, dlo: { mat: 'chrome', tTop: 0.9, down: 0.905 },
      doors: [0.275, 0.445, 0.72], handles: [0.41, 0.67], handleMat: 'chrome', mirror: { t: 0.29, cap: 'paint' },
      hood: 0.04, hatch: { w: 2.55, y0: 2.35, y1: 5.55 }, rearWiper: 4.4, brake: 5.6, plates: { front: 1.75, rear: 3.0 },
      cabin: { rows: 2, captains: true, rowGap: 2.8 },
    });
  },
};

/* Tesla Model 3: smooth and grille-less — slim lamps, a glass roof from the
 * windscreen back, flush handles, aero wheels and C-shaped tail lamps. */
MODELS['tesla-model3'] = {
  spec: {
    tireW: 0.77, archGap: 0.13,
    wheel: { style: 'aero', rimColor: '#34373b', rimR: 0.75, rough: 0.35 },
    lines: {
      top: [[0, 1.9], [0.008, 2.2], [0.03, 2.42], [0.08, 2.55], [0.18, 2.72], [0.27, 2.98], [0.285, 3.05], [0.88, 3.42], [0.94, 3.46], [0.975, 3.42], [0.99, 3.3], [1, 2.9]],
      shoulder: [[0, 1.85], [0.03, 2.35], [0.12, 2.55], [0.27, 2.9], [0.285, 3.0], [0.88, 3.36], [0.97, 3.36], [0.99, 3.15], [1, 2.8]],
      bottom: [[0, 0.9], [0.01, 0.6], [0.04, 0.5], [0.88, 0.52], [0.96, 0.7], [0.99, 0.95], [1, 1.25]],
      plan: [[0, 0.56], [0.015, 0.74], [0.045, 0.86], [0.1, 0.94], [0.2, 0.99], [0.85, 1], [0.94, 0.975], [0.98, 0.91], [1, 0.82]],
      tuck: 0.06, shR: 0.28, botR: 0.25,
    },
    glass: {
      a0: 0.285, a1: 0.44, c0: 0.62, r1: 0.88,
      roof: [[0.285, 3.08], [0.44, 4.58], [0.52, 4.73], [0.6, 4.68], [0.62, 4.62], [0.88, 3.45]],
      edge: [[0.285, 3.05], [0.44, 4.42], [0.52, 4.54], [0.62, 4.45], [0.88, 3.42]],
      belt: [[0.285, 3.05], [0.88, 3.4]],
      inset: 0.32, tumble: 0.5, roofMat: 'glass',
    },
  },
  details(B, cx) {
    const { skin } = cx;
    headlamp(B, cx, [[1.6, 2.3], [2.55, 2.4], [2.8, 2.3], [2.7, 2.18], [1.75, 2.2]], { projectors: [[2.2, 2.28, 0.08]], drl: [[1.7, 2.25], [2.55, 2.34], [2.72, 2.28]], drlW: 0.04 });
    decal(B, BLACK(), skin, 'front', [[-1.4, 1.35], [1.4, 1.35], [1.3, 1.05], [-1.3, 1.05]], { off: 0.01, mirror: false });
    for (const s of [1, -1]) decal(B, BLACK(), skin, 'front', [[s * 2.0, 1.25], [s * 2.6, 1.35], [s * 2.6, 1.05], [s * 2.0, 1.0]], { off: 0.01, mirror: false });
    taillamp(B, cx, [[1.7, 3.35], [2.7, 3.32], [2.95, 3.15], [2.85, 2.95], [2.5, 3.05], [1.8, 3.15]], { leds: [[[1.8, 3.26], [2.7, 3.24], [2.88, 3.1], [2.82, 3.0]]], ledW: 0.04 });
    decal(B, M.plastic('#141517', 0.75), skin, 'rear', [[-2.5, 1.35], [2.5, 1.35], [2.4, 0.85], [-2.4, 0.85]], { off: 0.008, mirror: false });
    lettering(B, cx, 'rear', 'TESLA', 0, 3.12, 0.9);
    finish(B, cx, {
      b: [0.535, 0.565], rear: { tb: 0.795, tt: 0.63, mat: 'black' }, dlo: { mat: 'black', tTop: 0.63, down: 0.79 },
      doors: [0.29, 0.538, 0.79], handles: [0.5, 0.745], handleMat: 'black', mirror: { t: 0.315, cap: 'paint' },
      hood: 0.05, hoodOpts: { curve: 0.4 }, trunk: 0.89, plates: { front: 1.6, rear: 2.55 },
    });
  },
};

/* Tesla Cybertruck: flat stainless panels folded at hard creases — a single
 * slope over the cab to the vaulted bed cover, light bars front and back. */
const CYB = (() => {
  const keys = [[0, 3.2], ...straight([0.012, 3.55], [0.43, 5.88], 12), ...straight([0.43, 5.88], [0.995, 4.25], 14).slice(1), [1, 3.9]];
  return keys;
})();
MODELS['tesla-cybertruck'] = {
  spec: {
    tireW: 0.94, archGap: 0.26, section: 'panel', stainless: true,
    wheel: { style: 'aero', rimColor: '#9ba1a7', rimR: 0.83, rough: 0.45 },
    lines: {
      top: CYB,
      shoulder: [[0, 3.0], [0.012, 3.5], [0.2, 3.7], [1, 3.8]],
      bottom: [[0, 1.75], [0.012, 1.5], [0.05, 1.55], [0.95, 1.6], [1, 1.9]],
      plan: [[0, 0.93], [0.006, 0.98], [0.012, 1], [0.99, 1], [1, 0.98]],
      lean: 0.95,
    },
    glass: null,
  },
  details(B, cx) {
    const { skin, Z, fn } = cx;
    const roofY = spline(CYB);
    // Side windows on the leaning upper panels; a black band at the B-pillar.
    const win = [[Z(0.24), 3.98], [Z(0.66), 4.0]];
    for (let t = 0.66; t >= 0.24; t -= 0.02) win.push([Z(t), Math.min(roofY(t) - 0.3, 5.55)]);
    decal(B, M.carGlass('#06090c', 0.85), skin, 'side', win, { off: 0.012 });
    decal(B, BLACK(), skin, 'side', [[Z(0.452), 3.95], [Z(0.47), 3.95], [Z(0.47), 5.7], [Z(0.452), 5.7]], { off: 0.02 });
    // Windscreen on the front slope, from above.
    decal(B, M.carGlass('#06090c', 0.85), skin, 'top', [[-2.25, Z(0.2)], [2.25, Z(0.2)], [2.15, Z(0.425)], [-2.15, Z(0.425)]], { off: 0.012, mirror: false });
    // Light bars.
    ribbon(B, cx.drl, skin, 'front', [[-3.2, 3.5], [3.2, 3.5]], 0.07, { off: 0.03, mirror: false });
    ribbon(B, cx.tailLed, skin, 'rear', [[-3.2, 3.85], [3.2, 3.85]], 0.08, { off: 0.03, mirror: false });
    // Panel lines on the doors and over the vault cover.
    for (const t of [0.245, 0.455, 0.665]) ribbon(B, gapMat(), skin, 'side', [[Z(t), 1.9], [Z(t), Math.min(roofY(t) - 0.2, 5.6)]], 0.028, { off: 0.004 });
    for (let t = 0.68; t < 0.99; t += 0.035) ribbon(B, gapMat(), skin, 'top', [[-2.6, Z(t)], [2.6, Z(t)]], 0.025, { off: 0.004, mirror: false });
    // Angular black cladding round the arches and along the sills.
    for (const a of cx.ax) {
      const R = a.Ra + 0.32;
      decal(B, M.cladding('#1b1d20'), skin, 'side', [[a.z - R, 1.7], [a.z - R * 0.62, a.y + R * 0.95], [a.z + R * 0.62, a.y + R * 0.95], [a.z + R, 1.7], [a.z + R, 1.45], [a.z - R, 1.45]], { off: 0.02 });
    }
    decal(B, M.cladding('#1b1d20'), skin, 'side', [[Z(0.26), 2.2], [Z(0.68), 2.2], [Z(0.68), 1.5], [Z(0.26), 1.5]], { off: 0.02 });
    decal(B, M.cladding('#1b1d20'), skin, 'front', [[-3.25, 2.5], [3.25, 2.5], [3.25, 1.6], [-3.25, 1.6]], { off: 0.02, mirror: false });
    decal(B, M.cladding('#1b1d20'), skin, 'rear', [[-3.25, 2.6], [3.25, 2.6], [3.25, 1.8], [-3.25, 1.8]], { off: 0.02, mirror: false });
    lettering(B, cx, 'rear', 'TESLA', 0, 3.35, 1.4);
    handle(B, cx, 0.4, 4.05, { mat: BLACK() });
    mirrorAt(B, cx, 0.25, 4.0, { cap: 'black', size: 0.22, out: 0.35 });
    plates(B, cx, null, [0, 2.2]);
    wheels(B, cx);
    void fn;
  },
};

/* BMW 3 Series: a compact sports saloon — twin kidney grilles, angular lamps
 * with L-shaped light guides, the Hofmeister kink and trapezoid tailpipes. */
MODELS['bmw-3series'] = {
  spec: {
    tireW: 0.74, archGap: 0.13,
    wheel: { style: 'split', rimColor: '#5d6268', rimR: 0.79, caliper: '#2a5bd0' },
    lines: {
      top: [[0, 2.0], [0.008, 2.3], [0.03, 2.5], [0.08, 2.6], [0.17, 2.75], [0.285, 3.05], [0.3, 3.12], [0.82, 3.43], [0.88, 3.47], [0.95, 3.46], [0.985, 3.36], [1, 2.95]],
      shoulder: [[0, 1.92], [0.03, 2.42], [0.1, 2.55], [0.285, 2.98], [0.3, 3.06], [0.82, 3.37], [0.96, 3.38], [0.99, 3.2], [1, 2.85]],
      bottom: [[0, 0.95], [0.01, 0.62], [0.04, 0.52], [0.88, 0.55], [0.96, 0.75], [0.99, 1.0], [1, 1.25]],
      plan: [[0, 0.62], [0.012, 0.78], [0.035, 0.88], [0.08, 0.95], [0.15, 0.99], [0.86, 1], [0.94, 0.975], [0.98, 0.9], [1, 0.8]],
      tuck: 0.06, shR: 0.2, botR: 0.22,
    },
    glass: {
      a0: 0.3, a1: 0.455, c0: 0.69, r1: 0.825,
      roof: [[0.3, 3.15], [0.455, 4.6], [0.55, 4.73], [0.66, 4.66], [0.69, 4.58], [0.825, 3.47]],
      edge: [[0.3, 3.12], [0.455, 4.44], [0.55, 4.55], [0.69, 4.4], [0.825, 3.44]],
      belt: [[0.3, 3.12], [0.825, 3.43]],
      inset: 0.3, tumble: 0.5,
    },
  },
  details(B, cx) {
    const { skin } = cx;
    for (const s of [1, -1]) {
      const k = roundRect(s * 0.42, 2.32, 0.72, 0.55, 0.14, 4);
      decal(B, BLACK(), skin, 'front', k, { off: 0.012, mirror: false });
      for (let x = -0.28; x <= 0.29; x += 0.093) ribbon(B, M.alloy('#c9ced3', 0.2), skin, 'front', [[s * 0.42 + x, 2.1], [s * 0.42 + x, 2.54]], 0.035, { off: 0.03, mirror: false });
      ribbon(B, M.chrome(), skin, 'front', k, 0.06, { off: 0.02, raise: 0.04, closed: true, mirror: false });
    }
    headlamp(B, cx, [[0.95, 2.48], [2.2, 2.55], [2.75, 2.42], [2.7, 2.22], [1.05, 2.25]], { projectors: [[1.55, 2.37, 0.1], [1.9, 2.38, 0.1]], drl: [[1.3, 2.47], [2.15, 2.5], [2.25, 2.3]] });
    for (const s of [1, -1]) decal(B, BLACK(), skin, 'front', [[s * 1.7, 1.8], [s * 2.6, 1.95], [s * 2.65, 1.05], [s * 1.8, 1.0]], { off: 0.012, mirror: false });
    grille(B, cx, [[-1.2, 1.65], [1.2, 1.65], [1.1, 1.0], [-1.1, 1.0]], { mesh: M.grilleMesh('#202226') });
    badge(B, cx, 'front', 0, 2.68, 0.16);
    taillamp(B, cx, [[1.25, 3.32], [2.45, 3.36], [2.95, 3.25], [2.95, 3.0], [2.5, 3.0], [2.5, 3.15], [1.3, 3.15]], { leds: [[[1.4, 3.27], [2.45, 3.3], [2.85, 3.22], [2.85, 3.06]]] });
    decal(B, M.plastic('#141517', 0.75), skin, 'rear', [[-2.55, 1.3], [2.55, 1.3], [2.45, 0.8], [-2.45, 0.8]], { off: 0.008, mirror: false });
    exhaust(B, cx, [[-2.05, 0.98], [2.05, 0.98]], { r: 0.15, oval: true });
    lettering(B, cx, 'rear', '330i', 1.9, 2.92, 0.55);
    badge(B, cx, 'rear', 0, 3.05, 0.16);
    finish(B, cx, {
      b: [0.535, 0.565], rear: { tb: 0.775, tt: 0.69, mat: 'paint', via: [[0.745, 0.6], [0.77, 0.35]] }, dlo: { mat: 'black', tTop: 0.69, down: 0.77 },
      doors: [0.305, 0.54, 0.775], handles: [0.5, 0.735], mirror: { t: 0.325, cap: 'black' },
      hood: 0.04, hoodOpts: { curve: 0.35 }, trunk: 0.835, fin: 0.68, plates: { front: 1.35, rear: 2.45 },
    });
  },
};

/* BMW X5: a big luxury SUV — tall kidneys, slim lamps, a chrome window line
 * with the kink in the D-pillar, roof rails and big multi-spoke wheels. */
MODELS['bmw-x5'] = {
  spec: {
    tireW: 0.9, archGap: 0.18,
    wheel: { style: 'multi', rimColor: '#9da3a9', rimR: 0.875, caliper: '#2a5bd0' },
    lines: {
      top: [[0, 2.65], [0.008, 2.95], [0.03, 3.25], [0.08, 3.4], [0.2, 3.62], [0.27, 3.78], [0.28, 3.82], [0.94, 4.0], [0.96, 3.98], [0.985, 3.85], [1, 3.5]],
      shoulder: [[0, 2.55], [0.03, 3.15], [0.12, 3.4], [0.27, 3.72], [0.28, 3.76], [0.94, 3.93], [0.98, 3.75], [1, 3.4]],
      bottom: [[0, 1.3], [0.01, 1.05], [0.04, 0.95], [0.88, 0.98], [0.96, 1.1], [1, 1.5]],
      plan: [[0, 0.68], [0.012, 0.82], [0.04, 0.91], [0.1, 0.97], [0.18, 1], [0.88, 1], [0.95, 0.975], [0.985, 0.92], [1, 0.84]],
      tuck: 0.05, shR: 0.2, botR: 0.22,
    },
    glass: {
      a0: 0.28, a1: 0.41, c0: 0.93, r1: 0.962,
      roof: [[0.28, 3.85], [0.41, 5.55], [0.55, 5.75], [0.88, 5.68], [0.93, 5.58], [0.962, 4.05]],
      edge: [[0.28, 3.82], [0.41, 5.3], [0.55, 5.47], [0.93, 5.35], [0.962, 4.02]],
      belt: [[0.28, 3.82], [0.962, 4.0]],
      inset: 0.3, tumble: 0.42,
    },
  },
  details(B, cx) {
    const { skin } = cx;
    for (const s of [1, -1]) {
      const k = roundRect(s * 0.6, 3.0, 1.05, 0.85, 0.16, 4);
      decal(B, BLACK(), skin, 'front', k, { off: 0.012, mirror: false });
      for (let x = -0.42; x <= 0.43; x += 0.12) ribbon(B, M.alloy('#c9ced3', 0.2), skin, 'front', [[s * 0.6 + x, 2.66], [s * 0.6 + x, 3.34]], 0.04, { off: 0.03, mirror: false });
      ribbon(B, M.chrome(), skin, 'front', k, 0.08, { off: 0.02, raise: 0.05, closed: true, mirror: false });
    }
    headlamp(B, cx, [[1.25, 3.3], [2.6, 3.32], [3.0, 3.18], [2.95, 2.98], [1.3, 3.05]], { projectors: [[1.75, 3.17, 0.11], [2.15, 3.17, 0.11]], drl: [[1.4, 3.25], [2.55, 3.27], [2.92, 3.15], [2.88, 3.02]] });
    for (const s of [1, -1]) decal(B, BLACK(), skin, 'front', [[s * 2.0, 2.5], [s * 2.95, 2.62], [s * 3.0, 1.6], [s * 2.05, 1.5]], { off: 0.012, mirror: false });
    grille(B, cx, [[-1.6, 2.2], [1.6, 2.2], [1.45, 1.55], [-1.45, 1.55]], { mesh: M.grilleMesh('#202226'), frame: BLACK() });
    decal(B, M.alloy('#9aa1a8', 0.45), skin, 'front', [[-1.4, 1.42], [1.4, 1.42], [1.2, 1.18], [-1.2, 1.18]], { off: 0.02, mirror: false });
    badge(B, cx, 'front', 0, 3.6, 0.2);
    taillamp(B, cx, [[1.6, 4.0], [2.9, 3.98], [3.15, 3.8], [3.05, 3.55], [1.7, 3.65]], { leds: [[[1.75, 3.88], [2.85, 3.86], [3.05, 3.72]]] });
    ribbon(B, M.chrome(), skin, 'rear', [[-1.6, 3.62], [1.6, 3.62]], 0.06, { off: 0.025, raise: 0.02, mirror: false });
    decal(B, M.plastic('#141517', 0.75), skin, 'rear', [[-2.85, 1.7], [2.85, 1.7], [2.75, 1.2], [-2.75, 1.2]], { off: 0.008, mirror: false });
    exhaust(B, cx, [[-2.2, 1.35], [2.2, 1.35]], { r: 0.16, oval: true });
    lettering(B, cx, 'rear', 'X5', 2.0, 3.4, 0.4);
    badge(B, cx, 'rear', 0, 4.2, 0.2);
    finish(B, cx, {
      b: [0.515, 0.545], mid: [[0.745, 0.775]], rear: { tb: 0.875, tt: 0.86, mat: 'paint', via: [[0.86, 0.6]] }, dlo: { mat: 'chrome', tTop: 0.88, down: 0.875 },
      doors: [0.285, 0.52, 0.76], handles: [0.48, 0.72], mirror: { t: 0.3, cap: 'black', size: 0.3 },
      hood: 0.04, hoodOpts: { curve: 0.3 }, hatch: { w: 2.5, y0: 2.4, y1: 5.45 }, rearWiper: 4.4, brake: 5.5, rails: [0.43, 0.9],
      plates: { front: 1.95, rear: 2.75 },
    });
  },
};

/* Mercedes-Benz G-Class: a box — flat panels, an upright windscreen, round
 * lamps, indicators on the wing tops, exposed hinges and a spare on the back. */
MODELS['mercedes-gclass'] = {
  spec: {
    tireW: 0.9, archGap: 0.24,
    wheel: { style: 'multi', rimColor: '#3a3e43', rimR: 0.833 },
    lines: {
      top: [[0, 3.55], [0.004, 3.8], [0.012, 3.88], [0.15, 3.95], [0.255, 4.1], [0.265, 4.15], [0.99, 4.15], [0.997, 4.1], [1, 3.9]],
      shoulder: [[0, 3.45], [0.004, 3.72], [0.012, 3.82], [0.255, 4.0], [0.265, 4.08], [0.99, 4.08], [1, 3.85]],
      bottom: [[0, 1.75], [0.008, 1.5], [0.03, 1.5], [0.12, 1.6], [0.88, 1.6], [0.995, 1.6], [1, 1.75]],
      plan: [[0, 0.92], [0.004, 0.97], [0.01, 0.99], [0.02, 1], [0.985, 1], [0.995, 0.98], [1, 0.95]],
      tuck: 0, shR: 0.08, botR: 0.1, topIn: 0.005,
    },
    glass: {
      a0: 0.265, a1: 0.295, c0: 0.985, r1: 0.995,
      roof: [[0.265, 4.18], [0.295, 6.3], [0.32, 6.45], [0.98, 6.45], [0.985, 6.4], [0.995, 4.2]],
      edge: [[0.265, 4.15], [0.295, 6.12], [0.32, 6.25], [0.985, 6.25], [0.995, 4.18]],
      belt: [[0.265, 4.15], [0.995, 4.15]],
      inset: 0.22, tumble: 0.12, bow: 0,
    },
  },
  details(B, cx) {
    const { skin, Z } = cx;
    grille(B, cx, [[-1.55, 3.62], [1.55, 3.62], [1.55, 2.6], [-1.55, 2.6]], { mesh: BLACK(), frame: M.chrome(), bars: [[[-1.5, 3.36], [1.5, 3.36]], [[-1.5, 3.1], [1.5, 3.1]], [[-1.5, 2.84], [1.5, 2.84]]], barW: 0.07 });
    badge(B, cx, 'front', 0, 3.1, 0.34, M.chrome());
    for (const s of [1, -1]) {
      const ring = ellipse(s * 2.35, 3.12, 0.44, 0.44, 28);
      headlamp(B, cx, ring.map(([x, y]) => [x * s > 0 ? x : x, y]), { projectors: [[s * 2.35, 3.12, 0.16]] });
      ribbon(B, cx.drl, skin, 'front', ellipse(s * 2.35, 3.12, 0.34, 0.34, 28), 0.05, { off: 0.045, closed: true, mirror: false });
      // Indicator pods on top of the wings.
      B.box(cx.amber, 0.35, 0.16, 0.45, s * 2.85, 3.98, Z(0.04));
      B.box(M.chrome(), 0.39, 0.04, 0.49, s * 2.85, 3.9, Z(0.04));
    }
    decal(B, M.cladding(), skin, 'front', [[-3.2, 2.45], [3.2, 2.45], [3.2, 1.78], [-3.2, 1.78]], { off: 0.08, mirror: false });
    for (const s of [1, -1]) decal(B, cx.drl, skin, 'front', roundRect(s * 2.6, 2.1, 0.45, 0.2, 0.05), { off: 0.09, mirror: false, sub: 1 });
    // Side rubbing strip, exposed hinges, the spare wheel on the back door.
    ribbon(B, M.cladding(), skin, 'side', [[Z(0.255), 2.75], [Z(0.665), 2.75]], 0.22, { off: 0.01, raise: 0.05 });
    ribbon(B, M.cladding(), skin, 'side', [[Z(0.85), 2.75], [Z(0.995), 2.75]], 0.22, { off: 0.01, raise: 0.05 });
    for (const [t, y] of [[0.272, 3.9], [0.272, 2.4], [0.507, 3.9], [0.507, 2.4]]) {
      const g = cylGeo(0.06, 0.06, 0.4, 10);
      stud(B, g, BLACK(), skin, 'side', Z(t), y, { off: 0.05 });
    }
    spareWheel(B, cx, 3.4, cx.L / 2 + 0.55, { style: 'multi', rimColor: '#3a3e43' });
    B.add(cylGeo(cx.ax[0].R + 0.06, cx.ax[0].R + 0.06, 0.95, 32, true).rotateX(PI / 2).translate(0, 3.4, cx.L / 2 + 0.55), cx.paint);
    taillamp(B, cx, [[2.75, 3.95], [3.12, 3.95], [3.12, 2.55], [2.75, 2.55]], { leds: [[[2.93, 3.8], [2.93, 2.7]]] });
    decal(B, M.cladding(), skin, 'rear', [[-3.15, 2.3], [3.15, 2.3], [3.15, 1.75], [-3.15, 1.75]], { off: 0.03, mirror: false });
    exhaust(B, cx, [], {});
    finish(B, cx, {
      b: [0.5, 0.53], mid: [[0.745, 0.775]], rear: { tb: 0.935, tt: 0.935, mat: 'paint' }, dlo: { mat: 'black', tTop: 0.98, down: 0.935 },
      doors: [0.27, 0.5, 0.76], handles: [0.46, 0.715], handleMat: 'chrome', mirror: { t: 0.285, cap: 'paint', size: 0.32, out: 0.55 },
      hood: 0.015, hoodOpts: { inset: 0.12, curve: 0.02 }, steps: [0.255, 0.66], flares: { w: 0.3, raise: 0.08, square: true },
      plates: { front: 2.12, rear: 2.6 }, cabin: { rows: 1 },
    });
  },
};

/* Mercedes-Benz Sprinter: a high-roof van — a short sloping bonnet, a huge
 * windscreen, a sliding side door and twin rear doors. */
MODELS['mercedes-sprinter'] = {
  spec: {
    tireW: 0.8, archGap: 0.22,
    wheel: { style: 'five', rimColor: '#c9ced3', rimR: 0.667 },
    lines: {
      top: [[0, 2.75], [0.006, 3.1], [0.03, 3.5], [0.07, 3.82], [0.105, 4.05], [0.115, 4.1], [0.995, 4.3], [1, 4.15]],
      shoulder: [[0, 2.65], [0.03, 3.4], [0.105, 3.98], [0.115, 4.04], [0.995, 4.22], [1, 4.05]],
      bottom: [[0, 1.4], [0.008, 1.15], [0.04, 1.1], [0.1, 1.4], [0.95, 1.45], [0.995, 1.5], [1, 1.75]],
      plan: [[0, 0.74], [0.01, 0.86], [0.035, 0.94], [0.08, 0.98], [0.12, 1], [0.99, 1], [1, 0.98]],
      tuck: 0.02, shR: 0.14, botR: 0.14, topIn: 0.01,
    },
    glass: {
      a0: 0.115, a1: 0.2, c0: 0.993, r1: 1.0, solidFrom: 0.265, rearGlass: false,
      roof: [[0.115, 4.12], [0.2, 7.5], [0.235, 8.55], [0.27, 8.9], [0.3, 8.96], [0.985, 8.96], [0.993, 8.9], [1.0, 4.35]],
      edge: [[0.115, 4.1], [0.2, 7.25], [0.24, 8.25], [0.3, 8.6], [0.993, 8.6], [1.0, 4.3]],
      belt: [[0.115, 4.1], [1.0, 4.3]],
      inset: 0.1, tumble: 0.28, bow: 0.02,
    },
  },
  details(B, cx) {
    const { skin, Z } = cx;
    grille(B, cx, [[-1.45, 3.35], [1.45, 3.35], [1.35, 2.5], [-1.35, 2.5]], { mesh: BLACK(), frame: BLACK(), bars: [[[-1.4, 3.08], [1.4, 3.08]], [[-1.38, 2.8], [1.38, 2.8]]], barW: 0.08 });
    badge(B, cx, 'front', 0, 2.95, 0.3, M.chrome());
    headlamp(B, cx, [[1.5, 3.45], [2.8, 3.55], [3.2, 3.35], [3.0, 3.05], [1.55, 3.0]], { projectors: [[2.1, 3.25, 0.14], [2.6, 3.28, 0.13]], drl: [[1.6, 3.4], [2.8, 3.48], [3.12, 3.32]] });
    bumper(B, cx, -1, { y0: 1.15, y1: 2.35, mat: M.cladding('#1e2023'), out: 0.05, depth: 0.7, fog: true });
    // Sliding door (right side), rubbing strip, rear doors with windows.
    for (const t of [0.29, 0.43]) ribbon(B, gapMat(), skin, 'side', [[Z(t), 8.2], [Z(t), 1.9]], 0.03, { off: 0.004, mirror: false });
    ribbon(B, gapMat(), skin, 'side', [[Z(0.29), 8.2], [Z(0.43), 8.2]], 0.03, { off: 0.004, mirror: false });
    ribbon(B, M.metal('#3a3e43', 0.5), skin, 'side', [[Z(0.43), 5.5], [Z(0.72), 5.5]], 0.08, { off: 0.01, raise: 0.05, mirror: false });
    handle(B, cx, 0.41, 4.6, { mat: BLACK() });
    ribbon(B, M.cladding(), skin, 'side', [[Z(0.27), 2.6], [Z(0.99), 2.6]], 0.3, { off: 0.01, raise: 0.05 });
    for (const y of [3.6, 5.0, 6.4]) ribbon(B, cx.paint, skin, 'side', [[Z(0.45), y], [Z(0.98), y]], 0.18, { off: 0, raise: 0.03 });
    ribbon(B, gapMat(), skin, 'rear', [[0, 8.5], [0, 1.95]], 0.03, { off: 0.004, mirror: false });
    hatchLines(B, cx, { w: 2.85, y0: 1.95, y1: 8.5 });
    decal(B, cx.glassMat, skin, 'rear', [[0.3, 7.6], [2.55, 7.6], [2.55, 5.6], [0.3, 5.6]], { off: 0.012 });
    taillamp(B, cx, [[2.95, 4.7], [3.28, 4.7], [3.28, 2.4], [2.95, 2.4]], { leds: [[[3.12, 4.55], [3.12, 2.55]]] });
    brakeLight(B, cx, 8.75, 1.0);
    decal(B, M.cladding(), skin, 'rear', [[-3.3, 2.0], [3.3, 2.0], [3.3, 1.55], [-3.3, 1.55]], { off: 0.06, mirror: false });
    finish(B, cx, {
      b: [0.258, 0.272], doors: [0.12, 0.265], handles: [0.235], handleDrop: 0.4, mirror: { t: 0.13, cap: 'black', size: 0.4, out: 0.6, lift: 0.4 },
      hood: 0.03, hoodOpts: { tEnd: 0.11, curve: 0.05 }, plates: { front: null, rear: 2.3 }, cabin: { rows: 0 },
    });
    decal(B, plate(), skin, 'front', roundRect(0, 1.75, 1.0, 0.5, 0.04), { off: 0.42, mirror: false, uv: 'fit', sub: 1 });
  },
};

/* Jeep Wrangler Unlimited: the seven-slot grille and round lamps, a flat
 * fold-down windscreen, big black wing flares, a black hard top and the
 * spare on the tailgate. */
MODELS['jeep-wrangler'] = {
  spec: {
    tireW: 0.9, archGap: 0.34, wellDepth: 1.7,
    wheel: { style: 'five', rimColor: '#2a2c30', rimR: 0.708, rough: 0.4 },
    lines: {
      top: [[0, 3.3], [0.004, 3.7], [0.01, 3.95], [0.015, 4.05], [0.25, 4.18], [0.27, 4.25], [0.28, 4.3], [0.995, 4.32], [1, 4.2]],
      shoulder: [[0, 3.2], [0.004, 3.62], [0.015, 3.98], [0.25, 4.12], [0.28, 4.25], [0.995, 4.26], [1, 4.15]],
      bottom: [[0, 2.15], [0.006, 1.9], [0.02, 1.9], [0.08, 2.05], [0.9, 2.05], [0.99, 2.05], [1, 2.2]],
      plan: [[0, 0.8], [0.004, 0.84], [0.015, 0.85], [0.2, 0.86], [0.28, 0.88], [0.995, 0.88], [1, 0.87]],
      tuck: 0, shR: 0.1, botR: 0.1, topIn: 0.005,
    },
    glass: {
      a0: 0.28, a1: 0.315, c0: 0.99, r1: 0.997,
      roof: [[0.28, 4.33], [0.315, 5.95], [0.34, 6.13], [0.985, 6.1], [0.99, 6.05], [0.997, 4.35]],
      edge: [[0.28, 4.3], [0.315, 5.8], [0.34, 5.92], [0.99, 5.88], [0.997, 4.33]],
      belt: [[0.28, 4.3], [0.997, 4.32]],
      inset: 0.15, tumble: 0.18, bow: 0, roofMat: 'black', pillarMat: 'black',
    },
  },
  details(B, cx) {
    const { skin, Z } = cx;
    // Seven slots, the outer pair cut by the round lamps.
    for (const x of [-1.65, -1.1, -0.55, 0, 0.55, 1.1, 1.65]) decal(B, BLACK(), skin, 'front', roundRect(x, 3.35, 0.3, 1.0, 0.13), { off: 0.012, mirror: false, sub: 1 });
    for (const s of [1, -1]) {
      headlamp(B, cx, ellipse(s * 2.05, 3.45, 0.42, 0.42, 28), { projectors: [[s * 2.05, 3.45, 0.16]] });
      ribbon(B, cx.drl, skin, 'front', ellipse(s * 2.05, 3.45, 0.36, 0.36, 28), 0.04, { off: 0.045, closed: true, mirror: false });
      ribbon(B, BLACK(), skin, 'front', ellipse(s * 2.05, 3.45, 0.47, 0.47, 28), 0.08, { off: 0.03, raise: 0.03, closed: true, mirror: false });
    }
    // Steel front bumper with red tow hooks, a skid plate.
    B.box(M.metal('#1f2124', 0.6), 6.4, 0.7, 0.75, 0, 2.35, -cx.L / 2 - 0.15);
    for (const s of [1, -1]) B.box(M.painted('#c32020', 0.4), 0.22, 0.32, 0.4, s * 1.55, 2.35, -cx.L / 2 - 0.62);
    B.box(M.metal('#1f2124', 0.6), 3.0, 0.12, 2.0, 0, 1.55, -cx.L / 2 + 1.0);
    // Wing flares, hood latches, the windscreen frame, hinges, rock rails.
    archFlares(B, cx, { w: 0.62, raise: 0.32, square: true });
    for (const s of [1, -1]) B.box(BLACK(), 0.18, 0.2, 0.35, s * 2.45, 4.15, Z(0.24));
    ribbon(B, cx.paint, skin, 'top', [[-2.45, Z(0.282)], [2.45, Z(0.282)]], 0.18, { off: 0.0, raise: 0.12, mirror: false });
    for (const [t, y] of [[0.29, 3.9], [0.29, 2.75], [0.508, 3.9], [0.508, 2.75]]) B.box(BLACK(), 0.12, 0.28, 0.32, cx.W / 2 * 0.88 + 0.04, y, Z(t));
    for (const [t, y] of [[0.29, 3.9], [0.29, 2.75], [0.508, 3.9], [0.508, 2.75]]) B.box(BLACK(), 0.12, 0.28, 0.32, -(cx.W / 2 * 0.88 + 0.04), y, Z(t));
    for (const s of [1, -1]) B.box(M.metal('#1f2124', 0.6), 0.35, 0.3, Z(0.66) - Z(0.27), s * (cx.W / 2 * 0.88 + 0.1), 1.95, (Z(0.27) + Z(0.66)) / 2);
    // Back: square lamps, the spare, a black bumper.
    taillamp(B, cx, [[2.15, 3.85], [2.62, 3.85], [2.62, 3.0], [2.15, 3.0]], { leds: [[[2.38, 3.75], [2.38, 3.1]]] });
    spareWheel(B, cx, 3.6, cx.L / 2 + 0.55, { style: 'five', rimColor: '#2a2c30' });
    B.box(M.metal('#1f2124', 0.6), 6.0, 0.6, 0.6, 0, 2.35, cx.L / 2 + 0.1);
    brakeLight(B, cx, 5.2, 0.6);
    lettering(B, cx, 'side', 'JEEP', Z(0.12), 3.75, 0.8);
    finish(B, cx, {
      b: [0.5, 0.53], mid: [[0.76, 0.79]], rear: { tb: 0.955, tt: 0.955, mat: 'black' },
      doors: [0.285, 0.505, 0.76], handles: [0.46, 0.715], handleMat: 'black', mirror: { t: 0.3, cap: 'black', size: 0.3, out: 0.4 },
      hood: 0.012, hoodOpts: { inset: 0.15, curve: 0.02 }, plates: { front: null, rear: 2.8 }, cabin: { rows: 1 },
    });
  },
};

/* Jeep Grand Cherokee: a modern SUV — a wide, slim seven-slot grille between
 * thin lamps, a floating black roof and a full-width light at the back. */
MODELS['jeep-grandcherokee'] = {
  spec: {
    tireW: 0.87, archGap: 0.2,
    wheel: { style: 'split', rimColor: '#c4c9ce', rimR: 0.833 },
    lines: {
      top: [[0, 2.85], [0.006, 3.2], [0.025, 3.45], [0.08, 3.6], [0.2, 3.75], [0.265, 3.88], [0.275, 3.92], [0.95, 4.08], [0.965, 4.06], [0.985, 3.95], [1, 3.6]],
      shoulder: [[0, 2.75], [0.025, 3.35], [0.15, 3.62], [0.265, 3.82], [0.275, 3.86], [0.95, 4.01], [0.985, 3.85], [1, 3.5]],
      bottom: [[0, 1.4], [0.01, 1.1], [0.04, 1.0], [0.88, 1.02], [0.96, 1.15], [1, 1.55]],
      plan: [[0, 0.72], [0.01, 0.84], [0.035, 0.92], [0.09, 0.975], [0.16, 1], [0.88, 1], [0.95, 0.975], [0.985, 0.93], [1, 0.86]],
      tuck: 0.05, shR: 0.18, botR: 0.2,
    },
    glass: {
      a0: 0.275, a1: 0.4, c0: 0.93, r1: 0.962,
      roof: [[0.275, 3.95], [0.4, 5.68], [0.55, 5.9], [0.88, 5.82], [0.93, 5.72], [0.962, 4.12]],
      edge: [[0.275, 3.92], [0.4, 5.45], [0.55, 5.62], [0.93, 5.5], [0.962, 4.1]],
      belt: [[0.275, 3.92], [0.962, 4.08]],
      inset: 0.3, tumble: 0.4, roofMat: 'black', pillarMat: 'black',
    },
  },
  details(B, cx) {
    const { skin } = cx;
    for (const x of [-1.26, -0.84, -0.42, 0, 0.42, 0.84, 1.26]) decal(B, BLACK(), skin, 'front', roundRect(x, 3.15, 0.24, 0.62, 0.08), { off: 0.012, mirror: false, sub: 1 });
    ribbon(B, M.chrome(), skin, 'front', [[-1.5, 3.5], [1.5, 3.5], [1.5, 2.8], [-1.5, 2.8]], 0.06, { off: 0.02, raise: 0.03, closed: true, mirror: false });
    headlamp(B, cx, [[1.6, 3.42], [2.75, 3.4], [2.95, 3.2], [1.6, 3.15]], { projectors: [[2.1, 3.28, 0.1], [2.45, 3.28, 0.1]], drl: [[1.65, 3.36], [2.75, 3.34]] });
    decal(B, BLACK(), skin, 'front', [[-2.3, 2.5], [2.3, 2.5], [2.4, 1.6], [-2.4, 1.6]], { off: 0.012, mirror: false });
    decal(B, M.alloy('#9aa1a8', 0.45), skin, 'front', [[-1.4, 1.5], [1.4, 1.5], [1.2, 1.25], [-1.2, 1.25]], { off: 0.02, mirror: false });
    taillamp(B, cx, [[1.3, 4.0], [2.9, 3.98], [3.1, 3.8], [1.4, 3.85]], { leds: [[[1.4, 3.92], [2.9, 3.9], [3.05, 3.82]]] });
    decal(B, BLACK(), skin, 'rear', [[-1.35, 4.0], [1.35, 4.0], [1.35, 3.85], [-1.35, 3.85]], { off: 0.01, mirror: false, sub: 1 });
    lettering(B, cx, 'rear', 'JEEP', 0, 3.6, 0.8);
    decal(B, M.plastic('#141517', 0.75), skin, 'rear', [[-2.9, 1.75], [2.9, 1.75], [2.8, 1.25], [-2.8, 1.25]], { off: 0.008, mirror: false });
    exhaust(B, cx, [[-2.25, 1.4], [2.25, 1.4]], { r: 0.15, oval: true });
    finish(B, cx, {
      b: [0.5, 0.53], mid: [[0.74, 0.77]], rear: { tb: 0.875, tt: 0.86, mat: 'black' }, dlo: { mat: 'chrome', tTop: 0.9, down: 0.875 },
      doors: [0.28, 0.505, 0.755], handles: [0.465, 0.715], handleMat: 'chrome', mirror: { t: 0.3, cap: 'black', size: 0.3 },
      hood: 0.03, hoodOpts: { curve: 0.25 }, hatch: { w: 2.5, y0: 2.5, y1: 5.6 }, rearWiper: 4.6, brake: 5.65, rails: [0.43, 0.9],
      plates: { front: 2.05, rear: 2.85 },
    });
  },
};

/* The kit, for the trucks (and anything else built the same way). */
export { Shell, Skin, loft, decal, ribbon, stud, hexa, mirrored, plate, badge, lettering, roundRect, ellipse, gapMat, BLACK, resample };
