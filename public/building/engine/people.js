/* People.
 *
 * Every figure is one skinned mesh built to real proportions: a torso lofted
 * from hips to neck, arms and legs as tubes that bend at the elbow and knee,
 * hands with thumbs, shoes, and a head with a jaw, nose, ears, eyes, brows and
 * a mouth under one of several heads of hair or hats. Clothes are part of the
 * same surface — sleeves, hems, collars, a jacket's V over a shirt and tie, a
 * hi-vis vest with its reflective bands — coloured per vertex, so a whole
 * crowd shares a single material.
 *
 * A figure has a seventeen-bone skeleton. Standing props are posed once and
 * baked (stand, sit, type, carry, dig, flag traffic...); the walkers keep
 * their bones and stride properly.
 *
 * Figures face -z; +x is their right. Feet in feet. */

import * as THREE from 'three';
import * as M from './materials.js';
import { rng } from './textures.js';

const PI = Math.PI;
const TAU = PI * 2;

export const BONES = ['pelvis', 'spine', 'chest', 'neck', 'head', 'armR', 'foreR', 'handR', 'armL', 'foreL', 'handL', 'thighR', 'shinR', 'footR', 'thighL', 'shinL', 'footL'];
const BI = Object.fromEntries(BONES.map((b, i) => [b, i]));
const PARENT = [-1, 0, 1, 2, 3, 2, 5, 6, 2, 8, 9, 0, 11, 12, 0, 14, 15];

/* ------------------------------------------------------------- the mesh */

const colour = (() => {
  const cache = new Map();
  return (hex) => {
    if (hex && hex.isColor) return hex;
    if (!cache.has(hex)) cache.set(hex, new THREE.Color(hex));
    return cache.get(hex);
  };
})();

const shade = (hex, k) => {
  const c = colour(hex).clone();
  return k >= 1 ? c.lerp(new THREE.Color('#ffffff'), k - 1) : c.multiplyScalar(k);
};

class Skin {
  constructor() {
    this.p = [];
    this.c = [];
    this.bi = [];
    this.bw = [];
    this.ix = [];
  }

  v(x, y, z, col, b0, b1 = b0, w1 = 0) {
    this.p.push(x, y, z);
    this.c.push(col.r, col.g, col.b);
    this.bi.push(b0, b1, 0, 0);
    this.bw.push(1 - w1, w1, 0, 0);
    return this.p.length / 3 - 1;
  }

  at(i) { return [this.p[i * 3], this.p[i * 3 + 1], this.p[i * 3 + 2]]; }

  /** A triangle wound so that it faces away from `inside`. */
  tri(a, b, c, inside) {
    const A = this.at(a);
    const B = this.at(b);
    const C = this.at(c);
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
    const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const mx = (A[0] + B[0] + C[0]) / 3 - inside[0];
    const my = (A[1] + B[1] + C[1]) / 3 - inside[1];
    const mz = (A[2] + B[2] + C[2]) / 3 - inside[2];
    if (nx * mx + ny * my + nz * mz >= 0) this.ix.push(a, b, c);
    else this.ix.push(a, c, b);
  }

  /** Join two rows of vertices (rings, or open strips of equal length). */
  stitch(r0, r1, c0, c1, open = false) {
    const n = r0.length;
    const mid = [(c0[0] + c1[0]) / 2, (c0[1] + c1[1]) / 2, (c0[2] + c1[2]) / 2];
    for (let k = 0; k < (open ? n - 1 : n); k++) {
      const k1 = (k + 1) % n;
      this.tri(r0[k], r1[k], r0[k1], mid);
      this.tri(r0[k1], r1[k], r1[k1], mid);
    }
  }

  /** Close a ring with a fan to an apex, facing away from `inside`. */
  cap(row, apex, inside, col, b0, b1 = b0, w1 = 0) {
    const a = this.v(apex[0], apex[1], apex[2], col, b0, b1, w1);
    for (let k = 0; k < row.length; k++) this.tri(row[k], row[(k + 1) % row.length], a, inside);
  }

  /**
   * A tube through rings. Each ring: c centre, rx and rz half-widths, n the
   * superellipse power (2 = an ellipse), plane 'xz' (a tube along y) or 'xy'
   * (along z), col a colour or (angle) => colour, b [bone, bone, weight of the
   * second] or (angle) => that, brk to leave a gap before this ring.
   */
  loft(rings, { seg = 10, cap0 = true, cap1 = true, arc = null, bulge = 0.5 } = {}) {
    const rows = [];
    const a0 = arc ? arc[0] : 0;
    const a1 = arc ? arc[1] : TAU;
    const count = arc ? seg + 1 : seg;
    for (const r of rings) {
      const row = [];
      const ex = 2 / (r.n || 2);
      for (let k = 0; k < count; k++) {
        const a = a0 + ((a1 - a0) * k) / (arc ? seg : seg);
        const cs = Math.cos(a);
        const sn = Math.sin(a);
        const u = Math.sign(cs) * Math.abs(cs) ** ex * r.rx;
        const w = Math.sign(sn) * Math.abs(sn) ** ex * (r.rz2 != null && sn < 0 ? r.rz2 : r.rz);
        const col = typeof r.col === 'function' ? r.col(a, k) : r.col;
        const b = typeof r.b === 'function' ? r.b(a, k) : r.b;
        const p = r.plane === 'xy' ? [r.c[0] + u, r.c[1] + w, r.c[2]] : [r.c[0] + u, r.c[1], r.c[2] + w];
        row.push(this.v(p[0], p[1], p[2], colour(col), b[0], b[1] ?? b[0], b[2] || 0));
      }
      rows.push(row);
    }
    for (let i = 1; i < rings.length; i++) {
      if (rings[i].brk) continue;
      this.stitch(rows[i - 1], rows[i], rings[i - 1].c, rings[i].c, !!arc);
    }
    if (!arc) {
      const end = (i, j) => {
        const r = rings[i];
        const o = rings[j];
        const d = [r.c[0] - o.c[0], r.c[1] - o.c[1], r.c[2] - o.c[2]];
        const L = Math.hypot(d[0], d[1], d[2]) || 1;
        const k = (Math.min(r.rx, r.rz) * bulge) / L;
        const b = typeof r.b === 'function' ? r.b(0, 0) : r.b;
        const col = typeof r.col === 'function' ? r.col(0, 0) : r.col;
        this.cap(rows[i], [r.c[0] + d[0] * k, r.c[1] + d[1] * k, r.c[2] + d[2] * k], o.c, colour(col), b[0], b[1] ?? b[0], b[2] || 0);
      };
      if (cap0 && rings.length > 1) end(0, 1);
      if (cap1 && rings.length > 1) end(rings.length - 1, rings.length - 2);
    }
    return rows;
  }

  /** A rounded lump: an ellipsoid of the given half-sizes. */
  blob(c, [rx, ry, rz], col, b, { seg = 8, rings = 5 } = {}) {
    const rs = [];
    for (let i = 0; i < rings; i++) {
      const t = -1 + (2 * (i + 0.5)) / rings;
      const q = Math.sqrt(1 - t * t);
      rs.push({ c: [c[0], c[1] + t * ry, c[2]], rx: rx * q, rz: rz * q, col, b });
    }
    this.loft(rs, { seg, bulge: 0.9 });
  }

  /** A box (for things in hands, badges, packs), axis-aligned. */
  box(c, [w, h, d], col, b) {
    this.loft([
      { c: [c[0], c[1] - h / 2, c[2]], rx: w / 2, rz: d / 2, n: 12, col, b },
      { c: [c[0], c[1] + h / 2, c[2]], rx: w / 2, rz: d / 2, n: 12, col, b },
    ], { seg: 8, bulge: 0 });
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.bi, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.bw, 4));
    g.setIndex(this.ix);
    g.computeVertexNormals();
    return g;
  }
}

/* ------------------------------------------------------------ the body */

const SKIN_TONES = ['#f1c9a5', '#e8b88f', '#d8a079', '#c68c62', '#a8714a', '#8a5a3a', '#6b4429', '#4f3220', '#f5d5b8', '#dcae86'];
const HAIR_TONES = ['#1b1512', '#2a1f17', '#3b2a1c', '#5a3b22', '#7a5230', '#a77d4b', '#c9a56a', '#8d8d8a', '#d9d6cf', '#6e2f1a'];

/** Where the joints are for a figure of height H. */
function jointsFor(H, sw) {
  const J = {
    pelvis: [0, 0.53, 0], spine: [0, 0.585, 0], chest: [0, 0.69, 0], neck: [0, 0.862, 0.004], head: [0, 0.895, 0],
    armR: [sw, 0.815, 0], foreR: [sw, 0.63, 0], handR: [sw, 0.485, 0],
    armL: [-sw, 0.815, 0], foreL: [-sw, 0.63, 0], handL: [-sw, 0.485, 0],
    thighR: [0.052, 0.52, 0], shinR: [0.052, 0.285, 0], footR: [0.052, 0.045, 0],
    thighL: [-0.052, 0.52, 0], shinL: [-0.052, 0.285, 0], footL: [-0.052, 0.045, 0],
  };
  return BONES.map((b) => J[b].map((v) => v * H));
}

/** The head's surface: t runs chin (-1) to crown (1), a round from +x by way of the back. */
function headPoint(H, k, t, a, off = 0, hang = null) {
  const hh = 0.066 * H * k;
  const yc = 0.868 * H + hh;
  const ts = hang != null ? Math.max(t, hang) : t;
  const at = Math.abs(ts);
  const q = ts >= 0 ? Math.sqrt(Math.max(0, 1 - ts * ts)) : Math.max(0, 1 - at ** 2.6) ** (1 / 2.6);
  const jaw = ts < 0 ? 1 - 0.27 * at ** 1.5 : 1;
  const rx = 0.0445 * H * k * q * jaw + off;
  const qb = ts >= 0 ? q : Math.max(0, 1 - at ** 1.7) ** (1 / 1.7);
  const rzB = 0.056 * H * k * qb + off;
  const qf = Math.max(0, 1 - at ** 3) ** (1 / 3);
  const rzF = 0.0495 * H * k * qf * (ts < 0 ? 1 - 0.05 * at : 1) + off;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const ex = 2 / 2.3;
  return [Math.sign(c) * Math.abs(c) ** ex * rx, yc + t * hh, Math.sign(s) * Math.abs(s) ** ex * (s >= 0 ? rzB : rzF) - 0.004 * H];
}

/** How far forward the face is at a height (y) and offset (x), for placing features on it. */
function faceZ(H, k, y, x) {
  const hh = 0.066 * H * k;
  const t = (y - (0.868 * H + hh)) / hh;
  const at = Math.abs(t);
  const q = t >= 0 ? Math.sqrt(Math.max(0, 1 - t * t)) : Math.max(0, 1 - at ** 2.6) ** (1 / 2.6);
  const rx = 0.0445 * H * k * q * (t < 0 ? 1 - 0.27 * at ** 1.5 : 1);
  const cx = Math.min(0.98, Math.abs(x) / Math.max(1e-4, rx));
  const sn = Math.max(0, 1 - cx ** 2.3) ** (1 / 2.3);
  const rzF = 0.0495 * H * k * Math.max(0, 1 - at ** 3) ** (1 / 3) * (t < 0 ? 1 - 0.05 * at : 1);
  return -sn * rzF - 0.004 * H;
}

/**
 * Build a figure. spec: H height, sex 'm' | 'f', build (1 = average), belly,
 * child, skin, hair { style, color }, top { kind, color, color2, sleeve },
 * bottom { kind, color }, shoes { kind, color }, hat { kind, color },
 * vest (a colour), apron (a colour), extras [...].
 */
export function makeFigure(spec) {
  const H = spec.H || 5.8;
  const f = spec.sex === 'f';
  const w = spec.build || 1;
  const belly = spec.belly || 0;
  const kid = !!spec.child;
  const hk = kid ? 1.2 : 1;                      // children's heads are bigger for their height
  const sw = H * (f ? 0.1 : 0.113) * (0.9 + 0.1 * w) * (kid ? 0.9 : 1);
  const J = jointsFor(H, sw / H);
  const S = new Skin();
  const skin = colour(spec.skin || SKIN_TONES[2]);
  const top = { kind: 'tee', color: '#4a6fa5', ...(spec.top || {}) };
  const bottom = { kind: 'pants', color: '#2b3442', ...(spec.bottom || {}) };
  const shoes = { kind: 'shoe', color: '#1c1c1e', ...(spec.shoes || {}) };
  const hair = { style: 'short', color: HAIR_TONES[1], ...(spec.hair || {}) };
  const topCol = colour(top.color);
  const botCol = colour(bottom.color);
  const B = BI;
  const h = (v) => v * H;

  /* ---- torso: one tube from the crotch to the base of the neck ---- */
  const wt = (y) => {
    if (y < 0.56) return [B.pelvis, B.pelvis, 0];
    if (y < 0.6) return [B.pelvis, B.spine, (y - 0.56) / 0.04];
    if (y < 0.67) return [B.spine, B.spine, 0];
    if (y < 0.71) return [B.spine, B.chest, (y - 0.67) / 0.04];
    return [B.chest, B.chest, 0];
  };
  // y, half-width, half-depth, forward offset — a man's; a woman's differs below.
  const T = f
    ? [[0.455, 0.045, 0.045, 0], [0.49, 0.096, 0.064, 0.003], [0.525, 0.104, 0.069, 0.006], [0.57, 0.094, 0.062, 0.002], [0.62, 0.072, 0.052, -0.002], [0.66, 0.076, 0.055, -0.004], [0.705, 0.084, 0.06, -0.006], [0.745, 0.09, 0.068, -0.012], [0.78, 0.093, 0.064, -0.008], [0.805, 0.094, 0.054, 0], [0.832, 0.08, 0.045, 0.004], [0.852, 0.05, 0.036, 0.006], [0.866, 0.029, 0.029, 0.006]]
    : [[0.455, 0.045, 0.045, 0], [0.49, 0.092, 0.062, 0.002], [0.525, 0.098, 0.066, 0.004], [0.57, 0.092, 0.062, 0], [0.615, 0.084, 0.058, -0.002], [0.66, 0.088, 0.061, -0.003], [0.71, 0.097, 0.066, -0.004], [0.76, 0.104, 0.068, -0.004], [0.8, 0.106, 0.06, 0], [0.83, 0.092, 0.05, 0.004], [0.852, 0.058, 0.04, 0.006], [0.866, 0.033, 0.033, 0.006]];
  const dress = top.kind === 'dress';
  const coverall = top.kind === 'coverall';
  const tucked = !!top.tucked || top.kind === 'suit' || coverall || dress;
  const hem = top.kind === 'suit' ? 0.5 : top.kind === 'hoodie' ? 0.545 : tucked ? 0.612 : 0.575;
  const suit = top.kind === 'suit';
  const shirtCol = colour(top.color2 || '#f1f1ee');
  const tieCol = top.tie ? colour(top.tie) : null;
  const sleeveless = top.sleeve === 'none';
  const vneck = top.kind === 'scrubs' || top.kind === 'dress' || top.kind === 'blouse';
  // The colour of the torso at a height and an angle round it (front is 3π/2).
  const torsoCol = (y) => (a) => {
    const front = Math.abs(((a - 1.5 * PI + 3 * PI) % TAU) - PI);     // 0 dead ahead
    if (y < hem - 0.001 && !dress && !coverall) return botCol;
    if (bottom.belt && y > 0.598 && y < 0.622 && tucked && !dress) return colour(bottom.belt);
    if (suit) {
      // A jacket's V: shirt between the lapels, a tie down the middle.
      const open = y > 0.69 ? Math.min(0.4, (y - 0.69) * 3.4) : 0;
      if (front < open && y < 0.858) return tieCol && front < 0.12 ? tieCol : shirtCol;
      if (y > 0.845) return shirtCol;
      return topCol;
    }
    if (top.kind === 'shirt' && tieCol && front < 0.11 && y > 0.62 && y < 0.85) return tieCol;
    if (vneck && y > 0.8 && front < (y - 0.8) * 9) return skin;
    if (y > 0.858) return top.kind === 'tee' || top.kind === 'scrubs' || dress || top.kind === 'blouse' || top.kind === 'tank' ? skin : topCol;
    if (top.kind === 'tank' && y > 0.8 && (front > 0.9 && front < 2.2)) return skin;
    if (top.stripe && y > 0.7 && y < 0.735) return colour(top.stripe);
    return topCol;
  };
  const loose = top.kind === 'hoodie' ? 1.1 : suit ? 1.07 : top.kind === 'coat' ? 1.08 : 1.03;
  // The torso's width, depth and set at any height, between the stations above.
  const torsoAt = (y) => {
    let i = T.findIndex((t) => t[0] >= y);
    if (i < 0) i = T.length - 1;
    i = Math.max(1, i);
    const a = T[i - 1];
    const b = T[i];
    const u = b[0] === a[0] ? 0 : Math.min(1, Math.max(0, (y - a[0]) / (b[0] - a[0])));
    return [a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u, a[3] + (b[3] - a[3]) * u];
  };
  // Extra rings either side of every colour change keep hems, belts and stripes crisp.
  const edges = [];
  if (!dress && !coverall) edges.push(hem);
  if (bottom.belt && tucked && !dress) edges.push(0.598, 0.622);
  if (top.stripe) edges.push(0.7, 0.735);
  const stations = T.map((t) => t[0]);
  for (const e of edges) stations.push(e - 0.0008, e + 0.0008);
  if (suit) stations.push(0.68, 0.695, 0.725, 0.74, 0.775, 0.79, 0.815, 0.842);
  stations.sort((a, b) => a - b);
  const rings = [];
  for (const y of stations.filter((v, i, l) => !i || v - l[i - 1] > 1e-5)) {
    if (y < T[0][0] || y > T[T.length - 1][0]) continue;
    const [rx, rz, z] = torsoAt(y);
    const mid = Math.max(0, 1 - Math.abs(y - 0.63) / 0.14);
    const clothed = y >= hem || dress || coverall;
    const k = (clothed ? loose : bottom.kind === 'skirt' ? 1 : 1.04) * (0.88 + 0.12 * w) * (kid ? 0.92 : 1);
    rings.push({ c: [0, h(y), h(z - belly * 0.03 * mid)], rx: h(rx) * k, rz: h(rz) * k * (1 + belly * 0.45 * mid), rz2: h(rz) * k * (1 + belly * 0.9 * mid), n: 2.25, col: torsoCol(y), b: wt(y) });
  }
  // A shirt worn out, or a jacket, hangs past the waist as a skirt of its own.
  if (!tucked || suit) {
    const iy = T.findIndex((t) => t[0] >= hem);
    const base = T[Math.max(1, iy)];
    const k = loose * (0.88 + 0.12 * w) * 1.03;
    S.loft([
      { c: [0, h(hem - 0.004), h(0.003)], rx: h(base[1]) * k * 0.96, rz: h(base[2]) * k * 0.96, n: 2.25, col: suit ? torsoCol(hem + 0.02) : topCol, b: wt(hem) },
      { c: [0, h(hem), h(0.003)], rx: h(base[1]) * k * 1.035, rz: h(base[2]) * k * 1.06, n: 2.25, col: suit ? torsoCol(hem + 0.02) : topCol, b: wt(hem) },
      { c: [0, h(hem + 0.05), h(0.002)], rx: h(base[1]) * k * 1.0, rz: h(base[2]) * k * 1.02, n: 2.25, col: suit ? torsoCol(hem + 0.05) : topCol, b: wt(hem + 0.05) },
    ], { seg: 24, cap0: false, cap1: false });
  }
  S.loft(rings, { seg: 24, cap1: false });

  /* ---- neck and collar ---- */
  const nr = h(f ? 0.027 : 0.0315) * (kid ? 0.9 : 1);
  S.loft([
    { c: [0, h(0.85), h(0.008)], rx: nr * 1.12, rz: nr * 1.1, col: skin, b: [B.chest] },
    { c: [0, h(0.872), h(0.004)], rx: nr, rz: nr, col: skin, b: [B.chest, B.neck, 0.6] },
    { c: [0, h(0.9), h(0.0)], rx: nr * 0.98, rz: nr, col: skin, b: [B.neck, B.head, 0.6] },
  ], { seg: 10, cap0: false, cap1: false });
  if (['shirt', 'polo', 'suit', 'coat', 'uniform', 'coverall'].includes(top.kind)) {
    const cc = suit || top.kind === 'coat' ? shirtCol : topCol;
    S.loft([
      { c: [0, h(0.856), h(0.007)], rx: nr * 1.5, rz: nr * 1.42, col: cc, b: [B.chest] },
      { c: [0, h(0.878), h(0.006)], rx: nr * 1.24, rz: nr * 1.2, col: cc, b: [B.chest, B.neck, 0.5] },
    ], { seg: 10, cap0: false, cap1: false, arc: [-0.22 * PI, 1.22 * PI] });
  }
  if (top.kind === 'hoodie') {
    S.blob([0, h(0.868), h(0.05)], [h(0.062), h(0.03), h(0.036)], topCol, [B.chest], { seg: 10 });
  }

  /* ---- arms ---- */
  const ak = (f ? 0.86 : 1) * (0.9 + 0.1 * w) * (kid ? 0.85 : 1);
  const longSleeve = ['long', 'shirt', 'suit', 'hoodie', 'coat', 'uniform', 'coverall', 'jacket'].includes(top.kind) && top.sleeve !== 'short';
  const sleeveEnd = sleeveless ? 0.02 : longSleeve ? -0.318 : top.sleeve === 'cap' ? -0.045 : -0.105;
  const sleeveK = top.kind === 'hoodie' ? 1.3 : suit || top.kind === 'coat' ? 1.24 : longSleeve ? 1.16 : 1.2;
  const ARM = [[0.031, 0.006], [0.025, 0.017], [0.012, 0.0265], [-0.012, 0.0305], [-0.06, 0.028], [-0.12, 0.026], [-0.165, 0.023], [-0.185, 0.022], [-0.21, 0.0235], [-0.25, 0.022], [-0.3, 0.0175], [-0.33, 0.0148]];
  for (const side of [1, -1]) {
    const arm = side > 0 ? B.armR : B.armL;
    const fore = side > 0 ? B.foreR : B.foreL;
    const hand = side > 0 ? B.handR : B.handL;
    const x = side * sw;
    const ys = h(0.815);
    const aw = (dy) => (dy > -0.165 ? [arm] : dy > -0.21 ? [arm, fore, (-0.165 - dy) / 0.045] : [fore]);
    const rs = [];
    let cut = false;
    for (let i = 0; i < ARM.length; i++) {
      const [dy, r] = ARM[i];
      const inSleeve = dy >= sleeveEnd - 1e-6;
      if (!inSleeve && !cut) {
        // The cuff: the sleeve closes in to the arm, then the skin carries on.
        cut = true;
        const [py, pr] = [sleeveEnd, r];
        rs.push({ c: [x, ys + h(py), 0], rx: h(pr) * ak * sleeveK, rz: h(pr) * ak * sleeveK, col: topCol, b: aw(py) });
        rs.push({ c: [x, ys + h(py) + 0.001, 0], rx: h(pr) * ak * 0.9, rz: h(pr) * ak * 0.9, col: topCol, b: aw(py) });
        rs.push({ c: [x, ys + h(py) + 0.004, 0], rx: h(pr) * ak, rz: h(pr) * ak, col: skin, b: aw(py), brk: true });
      }
      // A sleeve sits close on the shoulder and hangs looser toward its opening.
      const k = inSleeve ? 1.05 + (sleeveK - 1.05) * Math.min(1, Math.max(0, -dy / 0.09)) : 1;
      const flat = i === ARM.length - 1 ? 0.86 : 1;
      rs.push({ c: [x, ys + h(dy), 0], rx: h(r) * ak * k * flat, rz: h(r) * ak * k, col: inSleeve ? topCol : spec.gloves && dy < -0.29 ? colour(spec.gloves) : skin, b: aw(dy) });
    }
    S.loft(rs, { seg: 10, cap1: false });
    // Hand: a palm that narrows to curled fingers, and a thumb.
    const yw = h(0.485);
    const hc = spec.gloves ? colour(spec.gloves) : skin;
    const hk2 = (f ? 0.9 : 1) * (kid ? 0.85 : 1);
    const HAND = [[0.004, 0.0125, 0.0155, 0], [-0.028, 0.0115, 0.0235, 0], [-0.058, 0.0105, 0.0245, -0.001], [-0.084, 0.009, 0.021, -0.005], [-0.104, 0.006, 0.014, -0.011]];
    S.loft(HAND.map(([dy, rx, rz, dx]) => ({ c: [x + side * h(dx), yw + h(dy) * hk2, h(-0.002)], rx: h(rx) * hk2, rz: h(rz) * hk2, n: 2.4, col: hc, b: [hand] })), { seg: 8, cap0: false });
    S.loft([
      { c: [x - side * h(0.002), yw - h(0.02) * hk2, h(-0.02) * hk2], rx: h(0.0078), rz: h(0.0078), col: hc, b: [hand] },
      { c: [x - side * h(0.004), yw - h(0.045) * hk2, h(-0.03) * hk2], rx: h(0.0068), rz: h(0.0068), col: hc, b: [hand] },
      { c: [x - side * h(0.007), yw - h(0.066) * hk2, h(-0.034) * hk2], rx: h(0.005), rz: h(0.005), col: hc, b: [hand] },
    ], { seg: 6 });
  }

  /* ---- legs ---- */
  const lk = (0.9 + 0.1 * w) * (kid ? 0.88 : 1);
  const LEG = [[0.515, 0.05, 0.056, 0.054, 0], [0.47, 0.052, 0.058, 0.055, 0], [0.42, 0.048, 0.054, 0.054, 0], [0.36, 0.041, 0.046, 0.053, 0], [0.31, 0.034, 0.038, 0.052, -0.001], [0.285, 0.032, 0.035, 0.052, -0.002], [0.26, 0.031, 0.034, 0.052, 0], [0.21, 0.033, 0.037, 0.052, 0.004], [0.14, 0.026, 0.029, 0.052, 0.003], [0.08, 0.021, 0.024, 0.052, 0], [0.05, 0.02, 0.023, 0.052, 0]];
  const legEnd = dress || bottom.kind === 'skirt' ? 9 : bottom.kind === 'shorts' ? 0.335 : coverall || bottom.kind !== 'none' ? 0.062 : 9;
  const tight = bottom.kind === 'leggings' ? 1.03 : bottom.kind === 'jeans' ? 1.1 : 1.14;
  const legCol = coverall ? topCol : botCol;
  for (const side of [1, -1]) {
    const thigh = side > 0 ? B.thighR : B.thighL;
    const shin = side > 0 ? B.shinR : B.shinL;
    const foot = side > 0 ? B.footR : B.footL;
    const lw = (y) => (y > 0.31 ? [thigh] : y > 0.26 ? [thigh, shin, (0.31 - y) / 0.05] : [shin]);
    const rs = [];
    let cut = false;
    for (const [y, rx, rz, cx, cz] of LEG) {
      const inLeg = y >= legEnd - 1e-6;
      if (!inLeg && !cut && legEnd < 1) {
        cut = true;
        const m = Math.max(rx, 0.03);
        rs.push({ c: [side * h(cx), h(legEnd), h(cz)], rx: h(m) * lk * tight, rz: h(Math.max(rz, 0.032)) * lk * tight, col: legCol, b: lw(legEnd) });
        rs.push({ c: [side * h(cx), h(legEnd) + 0.001, h(cz)], rx: h(rx) * lk * 0.9, rz: h(rz) * lk * 0.9, col: legCol, b: lw(legEnd) });
        rs.push({ c: [side * h(cx), h(legEnd) + 0.004, h(cz)], rx: h(rx) * lk, rz: h(rz) * lk, col: skin, b: lw(legEnd), brk: true });
      }
      const straight = inLeg && bottom.kind !== 'leggings' && y < 0.3;
      const kx = inLeg ? tight : (f ? (y > 0.3 ? 1.03 : 0.92) : 1);
      rs.push({
        c: [side * h(cx), h(y), h(cz)],
        rx: h(straight ? Math.max(rx, 0.03) : rx) * lk * kx,
        rz: h(straight ? Math.max(rz, 0.032) : rz) * lk * kx,
        col: inLeg ? legCol : spec.socks && y < 0.1 ? colour(spec.socks) : skin, b: lw(y),
      });
    }
    S.loft(rs, { seg: 10, cap1: false });
    // Shoe or boot: lofted heel to toe, flat underneath, a darker sole.
    const sc = colour(shoes.color);
    const sole = colour(shoes.sole || (shoes.kind === 'sneaker' ? '#f0efe9' : '#141414'));
    const fk = (f ? 0.92 : 1) * (kid ? 0.82 : 1);
    const x = side * h(0.052);
    const heel = shoes.kind === 'heel' ? 0.012 : 0;
    const SHOE = [[0.038, 0.017, 0.014], [0.024, 0.0245, 0.027], [0.0, 0.0265, 0.034], [-0.03, 0.028, 0.0275], [-0.062, 0.031, 0.021], [-0.092, 0.031, 0.0175], [-0.11, 0.0265, 0.0145], [-0.119, 0.019, 0.011]];
    const shoeCol = (a) => (Math.sin(a) < -0.72 ? sole : sc);
    S.loft(SHOE.map(([z, rx, ry]) => ({ c: [x, h(ry + heel * Math.max(0, 0.6 + z * 8)) * fk, h(z) * fk], rx: h(rx) * fk, rz: h(ry) * fk, n: 2.7, plane: 'xy', col: shoeCol, b: [foot] })), { seg: 10 });
    if (shoes.kind === 'boot') {
      S.loft([
        { c: [x, h(0.04), h(0.002)], rx: h(0.027), rz: h(0.03), col: sc, b: [foot, shin, 0.5] },
        { c: [x, h(0.085), h(0.002)], rx: h(0.03), rz: h(0.033), col: sc, b: [shin] },
        { c: [x, h(0.115), h(0.003)], rx: h(0.0335), rz: h(0.036), col: sc, b: [shin] },
      ], { seg: 10, cap0: false, cap1: false });
    }
  }

  /* ---- skirt or dress: a cone that follows both thighs ---- */
  if (dress || bottom.kind === 'skirt' || top.kind === 'coat') {
    const coat = top.kind === 'coat' && !dress && bottom.kind !== 'skirt';
    const col = dress || coat ? topCol : botCol;
    const len = coat ? 0.3 : bottom.length === 'long' ? 0.2 : bottom.length === 'mini' ? 0.4 : 0.31;
    const sb = (t) => (a) => {
      const s = Math.cos(a) >= 0 ? B.thighR : B.thighL;
      return [B.pelvis, s, Math.min(0.75, t * 0.85)];
    };
    const flare = coat ? 0.1 : bottom.flare ?? 0.28;
    const n = 7;
    const rs = [];
    const [wx, wz] = torsoAt(0.6);
    const [hx0, hz0] = torsoAt(0.525);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const y = 0.6 - (0.6 - len) * t;
      // Off the waist, over the hips, then flaring to the hem.
      const hip = Math.min(1, Math.max(0, (0.6 - y) / 0.075));
      const hk3 = hip * hip * (3 - 2 * hip);
      const pad = coat ? 0.014 : 0.006;
      const out = Math.max(0, t - 0.2);
      rs.push({ c: [0, h(y), h(0.004)], rx: h(wx + pad + (hx0 - wx) * hk3 + flare * 0.17 * out) * (0.9 + 0.1 * w), rz: h(wz + pad + (hz0 - wz) * hk3 + flare * 0.15 * out), n: 2.2, col, b: sb(t) });
    }
    S.loft(rs, { seg: 18, cap0: false, cap1: false });
    // The inside of the hem, so there is no seeing through it from below.
    S.loft([{ ...rs[n] }, { ...rs[n], c: [0, rs[n].c[1] + 0.002, rs[n].c[2]], rx: rs[n].rx * 0.55, rz: rs[n].rz * 0.5, col: shade(col, 0.55) }], { seg: 18, cap0: false, cap1: false });
  }

  /* ---- hi-vis vest: a shell over the chest with reflective bands ---- */
  if (spec.vest) {
    const vc = colour(spec.vest);
    const silver = colour('#d9dde0');
    const vestCol = (y) => (a) => {
      const front = Math.abs(((a - 1.5 * PI + 3 * PI) % TAU) - PI);
      if ((y > 0.633 && y < 0.655) || (y > 0.69 && y < 0.712)) return silver;
      // Braces over each shoulder.
      const sideA = Math.abs(Math.abs(Math.cos(a)) - 0.62);
      if (y > 0.712 && sideA < 0.1) return silver;
      if (front < 0.06 && y < 0.8) return shade(vc, 0.72);
      return vc;
    };
    const rs = [];
    for (const y of [0.598, 0.6, 0.632, 0.634, 0.654, 0.656, 0.689, 0.691, 0.711, 0.713, 0.745, 0.78, 0.806, 0.832]) {
      const [rx, rz, z] = torsoAt(y);
      const mid = Math.max(0, 1 - Math.abs(y - 0.63) / 0.14);
      const k = loose * 1.07 * (0.88 + 0.12 * w);
      const open = y > 0.8 ? 0.8 : 1;
      rs.push({ c: [0, h(y), h(z - belly * 0.03 * mid)], rx: h(rx) * k * (y === 0.598 ? 0.9 : 1) * open, rz: h(rz) * k * (1 + belly * 0.45 * mid) * (y === 0.598 ? 0.9 : 1), rz2: h(rz) * k * (1 + belly * 0.9 * mid), n: 2.25, col: vestCol(y), b: wt(y) });
    }
    S.loft(rs, { seg: 24, cap0: false, cap1: false });
  }

  /* ---- apron: a bib and a skirt at the front ---- */
  if (spec.apron) {
    const ac = colour(spec.apron);
    const rs = [];
    for (const [y, rx, rz] of [[0.33, 0.1, 0.085], [0.45, 0.1, 0.082], [0.56, 0.1, 0.075], [0.61, 0.09, 0.067], [0.68, 0.085, 0.07], [0.75, 0.07, 0.076], [0.79, 0.055, 0.074]]) {
      rs.push({ c: [0, h(y), h(0.0)], rx: h(rx) * (0.9 + 0.1 * w), rz: h(rz) * (1 + belly * 0.95), n: 2.2, col: ac, b: y < 0.5 ? (a) => [B.pelvis, Math.cos(a) >= 0 ? B.thighR : B.thighL, 0.4] : wt(y) });
    }
    S.loft(rs, { seg: 10, arc: [1.14 * PI, 1.86 * PI] });
  }

  /* ---- head ---- */
  const HT = [-0.97, -0.86, -0.7, -0.52, -0.32, -0.12, 0.08, 0.28, 0.48, 0.66, 0.82, 0.94];
  const HS = 16;
  const lips = shade(skin, 0.74).lerp(new THREE.Color('#9c4a42'), 0.35);
  const rows = HT.map((t) => {
    const row = [];
    for (let k = 0; k < HS; k++) {
      const p = headPoint(H, hk, t, (k / HS) * TAU);
      row.push(S.v(p[0], p[1], p[2], skin, B.head));
    }
    return row;
  });
  const hc0 = [0, h(0.868) + 0.066 * H * hk, 0];
  for (let i = 1; i < rows.length; i++) S.stitch(rows[i - 1], rows[i], hc0, hc0);
  S.cap(rows[0], headPoint(H, hk, -1, 0), hc0, skin, B.head);
  S.cap(rows[rows.length - 1], headPoint(H, hk, 1, 0), hc0, skin, B.head);
  const hy = (v) => h(0.868) + (v - 0.868) * H * hk;     // a height on the head, scaled with it
  const hx = (v) => h(v) * hk;
  // Nose, ears, eyes, brows, mouth.
  const nz = faceZ(H, hk, hy(0.918), 0);
  S.loft([
    { c: [0, hy(0.948), faceZ(H, hk, hy(0.948), 0) + hx(0.001)], rx: hx(0.004), rz: hx(0.003), col: skin, b: [B.head] },
    { c: [0, hy(0.928), nz - hx(0.004)], rx: hx(0.0062), rz: hx(0.006), col: skin, b: [B.head] },
    { c: [0, hy(0.917), nz - hx(0.0075)], rx: hx(0.0088), rz: hx(0.0078), col: skin, b: [B.head] },
    { c: [0, hy(0.911), nz - hx(0.004)], rx: hx(0.0082), rz: hx(0.005), col: shade(skin, 0.86), b: [B.head] },
  ], { seg: 6, bulge: 0.3 });
  const dark = colour('#1c1512');
  const hairCol = colour(hair.color);
  for (const side of [1, -1]) {
    const ex = side * hx(0.0172);
    const ey = hy(0.9435);
    const ez = faceZ(H, hk, ey, ex);
    S.blob([ex, ey, ez + hx(0.0008)], [hx(0.0078), hx(0.0036), hx(0.0034)], colour('#f3f1ec'), [B.head], { seg: 6, rings: 3 });
    S.blob([ex, ey, ez - hx(0.0014)], [hx(0.0034), hx(0.0034), hx(0.0026)], spec.eyes ? colour(spec.eyes) : dark, [B.head], { seg: 6, rings: 3 });
    S.blob([ex * 1.02, hy(0.9535), faceZ(H, hk, hy(0.9535), ex) - hx(0.0006)], [hx(0.0105), hx(0.002), hx(0.003)], shade(hairCol, 0.8), [B.head], { seg: 6, rings: 3 });
    // Ear.
    const earY = hy(0.932);
    S.blob([side * (hx(0.0445) + hx(0.001)), earY, hx(0.006)], [hx(0.005), hx(0.0135), hx(0.008)], shade(skin, 0.95), [B.head], { seg: 6, rings: 4 });
  }
  S.blob([0, hy(0.8975), faceZ(H, hk, hy(0.8975), 0) + hx(0.0002)], [hx(0.0125), hx(0.0027), hx(0.0032)], lips, [B.head], { seg: 6, rings: 3 });
  if (spec.beard) {
    // A beard is the lower face, pushed out a little in the hair's colour.
    hairShell(S, H, hk, hairCol, hx(0.0035), (t, a) => t < -0.34 && Math.sin(a) < 0.25 && !(t > -0.62 && t < -0.44 && Math.abs(Math.cos(a)) < 0.3 && Math.sin(a) < 0), [-0.97, -0.86, -0.72, -0.58, -0.44, -0.3]);
  }
  if (spec.glasses) {
    const gc = colour(spec.glasses === true ? '#20242a' : spec.glasses);
    for (const side of [1, -1]) {
      const ex = side * hx(0.0172);
      const ez = faceZ(H, hk, hy(0.9435), ex) - hx(0.0042);
      S.box([ex, hy(0.9435), ez], [hx(0.019), hx(0.0115), hx(0.0012)], gc, [B.head]);
      S.box([side * hx(0.04), hy(0.9445), hx(-0.012)], [hx(0.0014), hx(0.003), hx(0.058)], gc, [B.head]);
    }
    S.box([0, hy(0.946), faceZ(H, hk, hy(0.946), 0) - hx(0.0046)], [hx(0.016), hx(0.0022), hx(0.0012)], gc, [B.head]);
  }

  /* ---- hair ---- */
  const hat = spec.hat || null;
  const style = hair.style;
  if (style !== 'bald') {
    const off = hx(style === 'buzz' ? 0.0022 : style === 'afro' ? 0.02 : style === 'curly' ? 0.011 : 0.0065);
    const low = style === 'bob' || style === 'long' ? -0.72 : style === 'afro' ? -0.2 : -0.42;
    const fringe = style === 'fringe' || style === 'bob' ? 0.38 : 0.52;
    // The hairline: high on the forehead, down past the ears, low at the nape.
    const mask = (t, a) => {
      const s = Math.sin(a);
      const c = Math.abs(Math.cos(a));
      if (s < -0.25) return t > fringe + 0.2 * c * c - (style === 'afro' ? 0.1 : 0);
      if (s < 0.2) return t > (style === 'bob' || style === 'long' ? low : -0.05) - (s + 0.25) * 0.5;
      return t > low;
    };
    hairShell(S, H, hk, hairCol, hat ? Math.min(off, hx(0.004)) : off, mask, null, style === 'bob' || style === 'long' ? -0.2 : null);
    if (style === 'long') {
      S.loft([
        { c: [0, hy(0.925), hx(0.036)], rx: hx(0.05), rz: hx(0.03), col: hairCol, b: [B.head] },
        { c: [0, hy(0.88), hx(0.04)], rx: hx(0.054), rz: hx(0.028), col: hairCol, b: [B.head, B.chest, 0.4] },
        { c: [0, h(0.82), h(0.05)], rx: h(0.056), rz: h(0.022), col: hairCol, b: [B.chest] },
        { c: [0, h(0.765), h(0.058)], rx: h(0.046), rz: h(0.015), col: shade(hairCol, 0.92), b: [B.chest] },
      ], { seg: 10, cap0: false });
    }
    if (style === 'ponytail') {
      S.loft([
        { c: [0, hy(0.965), hx(0.052)], rx: hx(0.013), rz: hx(0.013), col: hairCol, b: [B.head] },
        { c: [0, hy(0.94), hx(0.07)], rx: hx(0.015), rz: hx(0.015), col: hairCol, b: [B.head] },
        { c: [0, hy(0.89), hx(0.074)], rx: hx(0.012), rz: hx(0.012), col: hairCol, b: [B.head] },
        { c: [0, hy(0.85), hx(0.07)], rx: hx(0.006), rz: hx(0.006), col: shade(hairCol, 0.9), b: [B.head] },
      ], { seg: 6 });
    }
    if (style === 'bun') S.blob([0, hy(0.99), hx(0.038)], [hx(0.022), hx(0.02), hx(0.022)], hairCol, [B.head], { seg: 8 });
  }

  /* ---- hats ---- */
  if (hat) {
    const hcol = colour(hat.color || '#f2c018');
    const crown = (t0, off, col = hcol, ts = null) => hairShell(S, H, hk, col, off, (t) => t >= t0 - 1e-6, ts || [t0, t0 + 0.14, 0.62, 0.78, 0.9, 0.97]);
    if (hat.kind === 'hardhat') {
      crown(0.34, hx(0.012));
      // Brim all round, longer at the front; a ridge over the top.
      const rs = [];
      for (const [k, dy] of [[1.0, 0], [1.2, -0.004], [1.21, 0.002], [1.0, 0.006]]) {
        rs.push({ c: [0, hy(0.957) + hx(dy), hx(-0.004) - (k > 1.1 ? hx(0.012) : 0)], rx: hx(0.0515) * k, rz: hx(0.062) * k, col: hcol, b: [B.head] });
      }
      S.loft(rs, { seg: 14, cap0: false, cap1: false });
      S.blob([0, hy(1.008), hx(-0.002)], [hx(0.008), hx(0.006), hx(0.05)], shade(hcol, 0.94), [B.head], { seg: 6 });
    } else if (hat.kind === 'cap' || hat.kind === 'guardcap') {
      const peak = hat.kind === 'guardcap';
      crown(0.4, hx(peak ? 0.01 : 0.006));
      if (peak) {
        S.loft([
          { c: [0, hy(0.972), hx(-0.004)], rx: hx(0.055), rz: hx(0.064), col: hcol, b: [B.head] },
          { c: [0, hy(0.996), hx(-0.006)], rx: hx(0.064), rz: hx(0.072), col: hcol, b: [B.head] },
          { c: [0, hy(1.004), hx(-0.004)], rx: hx(0.058), rz: hx(0.066), col: hcol, b: [B.head] },
        ], { seg: 14, cap0: false });
        S.box([0, hy(0.972), hx(-0.058)], [hx(0.03), hx(0.012), hx(0.004)], colour('#c9a23a'), [B.head]);
      }
      // The bill.
      S.loft([
        { c: [0, hy(0.963), hx(-0.045)], rx: hx(0.042), rz: hx(0.003), col: peak ? colour('#141414') : hcol, b: [B.head], plane: 'xy' },
        { c: [0, hy(0.958), hx(-0.075)], rx: hx(0.038), rz: hx(0.0028), col: peak ? colour('#141414') : hcol, b: [B.head], plane: 'xy' },
        { c: [0, hy(0.954), hx(-0.094)], rx: hx(0.026), rz: hx(0.0025), col: peak ? colour('#141414') : hcol, b: [B.head], plane: 'xy' },
      ], { seg: 8 });
    } else if (hat.kind === 'beanie') {
      crown(0.26, hx(0.01));
      S.loft([
        { c: [0, hy(0.95), hx(-0.004)], rx: hx(0.054), rz: hx(0.064), col: shade(hcol, 0.85), b: [B.head] },
        { c: [0, hy(0.962), hx(-0.004)], rx: hx(0.055), rz: hx(0.065), col: shade(hcol, 0.85), b: [B.head] },
      ], { seg: 14, cap0: false, cap1: false });
    } else if (hat.kind === 'toque') {
      S.loft([
        { c: [0, hy(0.962), hx(-0.002)], rx: hx(0.05), rz: hx(0.058), col: hcol, b: [B.head] },
        { c: [0, hy(1.0), hx(-0.002)], rx: hx(0.05), rz: hx(0.056), col: hcol, b: [B.head] },
        { c: [0, hy(1.04), hx(-0.002)], rx: hx(0.064), rz: hx(0.068), col: hcol, b: [B.head] },
        { c: [0, hy(1.07), hx(-0.002)], rx: hx(0.056), rz: hx(0.06), col: hcol, b: [B.head] },
      ], { seg: 12, cap0: false, bulge: 0.35 });
    } else if (hat.kind === 'hood' ) {
      crown(-0.3, hx(0.014), topCol, [-0.3, -0.05, 0.2, 0.45, 0.66, 0.82, 0.94]);
    }
    if (hat.muffs) {
      for (const side of [1, -1]) S.blob([side * hx(0.052), hy(0.932), hx(0.006)], [hx(0.012), hx(0.02), hx(0.017)], colour(hat.muffs), [B.head], { seg: 8 });
    }
  }

  /* ---- things worn ---- */
  for (const ex of spec.extras || []) {
    if (ex === 'badge') S.box([h(-0.045), h(0.775), h(-0.07) * loose], [h(0.012), h(0.015), h(0.004)], colour('#d6b24a'), [B.chest]);
    if (ex === 'id') {
      S.box([h(0.03), h(0.7), h(-0.072) * loose], [h(0.02), h(0.028), h(0.003)], colour('#f4f4f2'), [B.chest]);
      S.box([h(0.03), h(0.705), h(-0.074) * loose], [h(0.012), h(0.012), h(0.003)], colour('#5b84c4'), [B.chest]);
    }
    if (ex === 'pack') {
      S.loft([
        { c: [0, h(0.62), h(0.085)], rx: h(0.07), rz: h(0.03), n: 3, col: colour(spec.packColor || '#2f4a6b'), b: [B.spine, B.chest, 0.5] },
        { c: [0, h(0.7), h(0.095)], rx: h(0.078), rz: h(0.04), n: 3, col: colour(spec.packColor || '#2f4a6b'), b: [B.chest] },
        { c: [0, h(0.8), h(0.085)], rx: h(0.068), rz: h(0.032), n: 3, col: colour(spec.packColor || '#2f4a6b'), b: [B.chest] },
      ], { seg: 10 });
      for (const side of [1, -1]) {
        S.loft([
          { c: [side * h(0.062), h(0.66), h(-0.03)], rx: h(0.01), rz: h(0.045), col: colour('#1f2a38'), b: [B.chest] },
          { c: [side * h(0.066), h(0.84), h(0.0)], rx: h(0.011), rz: h(0.06), col: colour('#1f2a38'), b: [B.chest] },
        ], { seg: 6 });
      }
    }
    if (ex === 'toolbelt') {
      S.loft([
        { c: [0, h(0.565), h(0.003)], rx: h(0.104) * (0.9 + 0.1 * w), rz: h(0.072), n: 2.2, col: colour('#6b4a2a'), b: [B.pelvis] },
        { c: [0, h(0.59), h(0.003)], rx: h(0.1) * (0.9 + 0.1 * w), rz: h(0.07), n: 2.2, col: colour('#6b4a2a'), b: [B.pelvis] },
      ], { seg: 16, cap0: false, cap1: false });
      for (const side of [1, -1]) S.box([side * h(0.105), h(0.53), h(0.0)], [h(0.03), h(0.085), h(0.06)], colour('#7a5632'), [B.pelvis]);
      S.box([h(0.108), h(0.5), h(0.03)], [h(0.012), h(0.12), h(0.012)], colour('#c9ced3'), [B.pelvis]);
    }
    if (ex === 'radio') S.box([h(0.085), h(0.58), h(-0.03)], [h(0.02), h(0.05), h(0.03)], colour('#17191c'), [B.pelvis]);
    if (ex === 'stethoscope') {
      S.loft([
        { c: [0, h(0.84), h(0.01)], rx: h(0.045), rz: h(0.05), col: colour('#2b2f36'), b: [B.chest] },
        { c: [0, h(0.848), h(0.01)], rx: h(0.045), rz: h(0.05), col: colour('#2b2f36'), b: [B.chest] },
      ], { seg: 10, cap0: false, cap1: false });
      S.blob([h(0.03), h(0.745), h(-0.073) * loose], [h(0.012), h(0.012), h(0.005)], colour('#c9ced3'), [B.chest], { seg: 6, rings: 3 });
    }
    if (ex === 'mask') {
      const my = hy(0.905);
      S.loft([
        { c: [0, hy(0.888), hx(-0.004)], rx: hx(0.04), rz: hx(0.052), col: colour('#a9cbe0'), b: [B.head] },
        { c: [0, my, hx(-0.004)], rx: hx(0.045), rz: hx(0.056), col: colour('#a9cbe0'), b: [B.head] },
        { c: [0, hy(0.928), hx(-0.004)], rx: hx(0.045), rz: hx(0.054), col: colour('#a9cbe0'), b: [B.head] },
      ], { seg: 8, arc: [1.18 * PI, 1.82 * PI] });
    }
  }

  const geo = S.geometry();
  return { geo, joints: J, H, spec };
}

/** A shell just off the head — hair, a beard, a hat's crown — wherever mask(t, a) says. */
function hairShell(S, H, hk, col, off, mask, ts = null, hang = null) {
  const T = ts || [-0.97, -0.86, -0.72, -0.58, -0.44, -0.3, -0.16, -0.02, 0.14, 0.3, 0.46, 0.62, 0.76, 0.88, 0.96];
  const n = 20;
  const c0 = [0, 0.868 * H + 0.066 * H * hk, 0];
  const rows = T.map((t) => {
    const row = [];
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU;
      const lump = 1 + (off > 0.05 ? Math.sin(a * 5 + t * 9) * 0.12 : 0);
      const p = headPoint(H, hk, t, a, off * lump, hang);
      row.push(S.v(p[0], p[1], p[2], col, BI.head));
    }
    return row;
  });
  for (let i = 1; i < T.length; i++) {
    for (let k = 0; k < n; k++) {
      const k1 = (k + 1) % n;
      const a = ((k + 0.5) / n) * TAU;
      if (!mask((T[i] + T[i - 1]) / 2, a)) continue;
      S.tri(rows[i - 1][k], rows[i][k], rows[i - 1][k1], c0);
      S.tri(rows[i - 1][k1], rows[i][k], rows[i][k1], c0);
    }
  }
  if (mask(1, 0)) S.cap(rows[rows.length - 1], headPoint(H, hk, 1, 0, off), c0, col, BI.head);
}

/* ------------------------------------------------------------- wardrobes */

const pick = (r, list) => list[Math.floor(r() * list.length)];
const CASUAL = ['#4a6fa5', '#8a3b3b', '#3f6b52', '#c9c3b5', '#2f3540', '#a8693b', '#6d5a8a', '#d9d4c7', '#c2553a', '#2e6f8e', '#e2e0da', '#55606e', '#b84a6a', '#d7a531'];
const OFFICE_SHIRT = ['#f1f1ee', '#dfe8f2', '#c9d9ea', '#f3e9e0', '#e6e0f0', '#d4e3d7'];
const TROUSER = ['#2b3442', '#3d3a36', '#1f2226', '#5b4a36', '#31455f', '#4a4f57', '#6b6457'];
const JEANS = ['#31455f', '#3d5677', '#263447', '#52688a', '#1f2a3a'];
const SUITS = ['#1f2530', '#2b3038', '#3a3f48', '#1c2740', '#3b3430', '#4a4f57'];
const TIES = ['#7a1f2b', '#1f4f9c', '#2e6b3a', '#b8891f', '#3b3b4a', '#5b2a55'];
const DRESS = ['#8a3b55', '#2e5b7a', '#3f6b52', '#1f2226', '#b0482f', '#6d4a8a', '#c9a23a', '#d9d4c7'];
const HAIR_M = ['short', 'short', 'short', 'buzz', 'buzz', 'bald', 'fringe', 'curly'];
const HAIR_F = ['long', 'long', 'bob', 'bob', 'ponytail', 'ponytail', 'bun', 'short', 'curly', 'afro'];

/** A person for a role, different for every seed. */
export function personSpec(role = 'visitor', seed = 1) {
  const r = rng((Math.imul(seed | 0, 2654435761) >>> 0) || 7);
  r(); r();
  const child = role === 'child';
  const f = role === 'chef' ? r() < 0.35 : role === 'worker' || role === 'foreman' || role === 'flagger' || role === 'mechanic' ? r() < 0.18 : r() < 0.5;
  const H = child ? 3.9 + r() * 0.7 : f ? 5.15 + r() * 0.55 : 5.5 + r() * 0.65;
  const older = !child && r() < 0.22;
  const spec = {
    seed, role, sex: f ? 'f' : 'm', H, child,
    build: 0.92 + r() * 0.24 + (r() < 0.15 ? 0.12 : 0),
    belly: !child && r() < 0.3 ? 0.3 + r() * 0.7 : 0,
    skin: pick(r, SKIN_TONES),
    hair: { style: pick(r, f ? HAIR_F : HAIR_M), color: older ? pick(r, ['#8d8d8a', '#b9b6ae', '#d9d6cf', '#5e5a56']) : pick(r, HAIR_TONES.slice(0, 7).concat(HAIR_TONES[9])) },
    beard: !f && !child && r() < 0.2,
    glasses: r() < 0.16,
    extras: [],
  };
  const casual = () => {
    const kind = pick(r, f ? ['tee', 'long', 'blouse', 'hoodie', 'tank', 'dress', 'dress', 'tee'] : ['tee', 'tee', 'polo', 'long', 'hoodie', 'shirt']);
    spec.top = { kind, color: kind === 'dress' ? pick(r, DRESS) : pick(r, CASUAL), sleeve: kind === 'blouse' && r() < 0.5 ? 'cap' : kind === 'dress' ? pick(r, ['none', 'cap', 'short']) : undefined, stripe: kind === 'tee' && r() < 0.15 ? '#f1f1ee' : null };
    spec.bottom = kind === 'dress' ? { kind: 'none', length: pick(r, ['knee', 'knee', 'long']) }
      : f && r() < 0.2 ? { kind: 'skirt', color: pick(r, TROUSER.concat(DRESS)), length: pick(r, ['knee', 'mini', 'long']) }
        : r() < 0.2 ? { kind: 'shorts', color: pick(r, ['#5b4a36', '#31455f', '#8a8273', '#2b3442']) }
          : f && r() < 0.25 ? { kind: 'leggings', color: pick(r, ['#1f2226', '#2b3442', '#3d3a36']) }
            : { kind: 'jeans', color: pick(r, JEANS.concat(TROUSER)) };
    spec.shoes = { kind: r() < 0.6 ? 'sneaker' : 'shoe', color: pick(r, ['#f0efe9', '#1c1c1e', '#3b3b3f', '#7a4a2a', '#2f4a6b', '#8a3b3b']) };
  };
  const office = () => {
    if (!f && r() < 0.4) {
      spec.top = { kind: 'suit', color: pick(r, SUITS), color2: pick(r, OFFICE_SHIRT), tie: r() < 0.75 ? pick(r, TIES) : null };
      spec.bottom = { kind: 'pants', color: spec.top.color };
    } else if (f && r() < 0.3) {
      spec.top = { kind: 'dress', color: pick(r, DRESS), sleeve: pick(r, ['cap', 'short']) };
      spec.bottom = { kind: 'none', length: 'knee', flare: 0.12 };
    } else if (f && r() < 0.4) {
      spec.top = { kind: 'blouse', color: pick(r, OFFICE_SHIRT.concat(['#8a3b55', '#2e5b7a'])), tucked: true, sleeve: r() < 0.5 ? 'short' : undefined };
      spec.bottom = { kind: 'skirt', color: pick(r, SUITS), length: 'knee', flare: 0.08 };
    } else {
      spec.top = { kind: 'shirt', color: pick(r, OFFICE_SHIRT), tucked: true, tie: !f && r() < 0.35 ? pick(r, TIES) : null, sleeve: r() < 0.25 ? 'short' : undefined };
      spec.bottom = { kind: 'pants', color: pick(r, TROUSER), belt: '#2a1f17' };
    }
    spec.shoes = { kind: f && r() < 0.5 ? 'heel' : 'shoe', color: pick(r, ['#1c1c1e', '#3b2a1c', '#2a2a2e']) };
    if (r() < 0.5) spec.extras.push('id');
  };
  switch (role) {
    case 'worker': case 'foreman': case 'flagger': {
      const lime = role === 'flagger' || r() < 0.6;
      spec.top = { kind: r() < 0.55 ? 'long' : 'tee', color: pick(r, ['#5d6670', '#31455f', '#8a8273', '#3d3a36', '#e36a1c', '#c6d92e']) };
      spec.bottom = { kind: 'jeans', color: pick(r, JEANS.concat(['#5b4a36', '#3d3a36'])) };
      spec.shoes = { kind: 'boot', color: pick(r, ['#8a6234', '#3b2a1c', '#1c1c1e']) };
      spec.vest = lime ? '#c9e21f' : '#f2671d';
      spec.hat = { kind: 'hardhat', color: role === 'foreman' ? '#f4f4f2' : pick(r, ['#f2c018', '#f2c018', '#f4f4f2', '#e36a1c', '#2f6fbf', '#3f8f4a']), muffs: r() < 0.12 ? '#c8241b' : null };
      spec.gloves = r() < 0.5 ? pick(r, ['#d9b46a', '#8a8f96', '#e2e0da']) : null;
      if (role !== 'flagger' && r() < 0.45) spec.extras.push('toolbelt');
      if (r() < 0.3) spec.glasses = '#2b3036';
      break;
    }
    case 'guard':
      spec.top = { kind: 'uniform', color: pick(r, ['#1d2735', '#1f2226', '#2b3442']), tucked: true, sleeve: r() < 0.4 ? 'short' : undefined };
      spec.bottom = { kind: 'pants', color: '#141a24', belt: '#0e0e10' };
      spec.shoes = { kind: 'boot', color: '#141414' };
      spec.hat = r() < 0.7 ? { kind: r() < 0.5 ? 'guardcap' : 'cap', color: '#141a24' } : null;
      spec.extras.push('badge', 'radio');
      if (r() < 0.3) spec.vest = '#c9e21f';
      break;
    case 'chef':
      spec.top = { kind: 'uniform', color: '#f4f4f2' };
      spec.bottom = { kind: 'pants', color: pick(r, ['#1f2226', '#3d3f44', '#2b3442']) };
      spec.shoes = { kind: 'shoe', color: '#141414' };
      spec.hat = { kind: r() < 0.6 ? 'toque' : 'beanie', color: r() < 0.8 ? '#f4f4f2' : '#1f2226' };
      spec.apron = r() < 0.7 ? pick(r, ['#f4f4f2', '#1f2226', '#3d3f44']) : null;
      break;
    case 'server':
      spec.top = { kind: 'shirt', color: pick(r, ['#f1f1ee', '#1f2226']), tucked: true, sleeve: r() < 0.4 ? 'short' : undefined };
      spec.bottom = { kind: 'pants', color: '#1f2226' };
      spec.shoes = { kind: 'shoe', color: '#141414' };
      spec.apron = pick(r, ['#1f2226', '#7a1f2b', '#2e3d2f']);
      break;
    case 'medic': {
      const c = pick(r, ['#2e7f8a', '#3a6ea5', '#5b8a6a', '#7a5a9a', '#28497a', '#b0607a']);
      spec.top = { kind: 'scrubs', color: c };
      spec.bottom = { kind: 'pants', color: c };
      spec.shoes = { kind: 'sneaker', color: pick(r, ['#f0efe9', '#3b3b3f']) };
      if (r() < 0.6) spec.extras.push('stethoscope');
      if (r() < 0.3) spec.extras.push('mask');
      spec.extras.push('id');
      break;
    }
    case 'doctor':
      spec.top = { kind: 'coat', color: '#f4f4f2', color2: pick(r, OFFICE_SHIRT), tie: !f && r() < 0.5 ? pick(r, TIES) : null };
      spec.bottom = { kind: 'pants', color: pick(r, TROUSER) };
      spec.shoes = { kind: 'shoe', color: '#1c1c1e' };
      spec.extras.push('stethoscope', 'id');
      break;
    case 'mechanic':
      spec.top = { kind: 'coverall', color: pick(r, ['#28497a', '#3d3f44', '#5d2a2a', '#2e4a3a']) };
      spec.bottom = { kind: 'pants', color: spec.top.color };
      spec.shoes = { kind: 'boot', color: '#1c1c1e' };
      spec.hat = r() < 0.4 ? { kind: 'cap', color: spec.top.color } : null;
      spec.gloves = r() < 0.4 ? '#1c1c1e' : null;
      break;
    case 'clerk': {
      const c = pick(r, ['#c0392b', '#1f4f9c', '#1f7a54', '#2b3442', '#e36a1c']);
      spec.top = { kind: 'polo', color: c, tucked: r() < 0.5 };
      spec.bottom = { kind: 'pants', color: pick(r, ['#8a8273', '#2b3442', '#1f2226']), belt: '#2a1f17' };
      spec.shoes = { kind: 'sneaker', color: '#1c1c1e', sole: '#f0efe9' };
      spec.extras.push('id');
      if (r() < 0.35) spec.apron = c;
      break;
    }
    case 'athlete':
      spec.top = { kind: r() < 0.5 ? 'tank' : 'tee', color: pick(r, ['#e2e0da', '#1f2226', '#c2553a', '#2e6f8e', '#c6d92e', '#b84a6a']) };
      spec.bottom = f && r() < 0.6 ? { kind: 'leggings', color: pick(r, ['#1f2226', '#2b3442', '#5b2a55']) } : { kind: 'shorts', color: pick(r, ['#1f2226', '#31455f', '#5d6670']) };
      spec.shoes = { kind: 'sneaker', color: pick(r, ['#f0efe9', '#c2553a', '#2e6f8e', '#1c1c1e']) };
      spec.socks = '#f0efe9';
      spec.belly = 0;
      break;
    case 'student': case 'child':
      casual();
      if (r() < 0.6) { spec.extras.push('pack'); spec.packColor = pick(r, ['#2f4a6b', '#8a3b3b', '#3f6b52', '#1f2226', '#b84a6a', '#d7a531']); }
      spec.beard = false;
      if (child) { spec.belly = 0; spec.glasses = r() < 0.08; }
      break;
    case 'teacher': case 'office':
      office();
      break;
    case 'shopper': case 'visitor': default:
      if (r() < 0.25) office(); else casual();
      if (role === 'visitor') spec.extras = spec.extras.filter((e) => e !== 'id');
  }
  return spec;
}

/* ----------------------------------------------------------------- poses */

/* A pose gives each bone [bend, twist, lean] in radians: bend swings a limb
 * forward (or bows the spine), twist turns it about its own length, lean takes
 * an arm or leg out to the side. A key without R or L applies to both sides,
 * mirrored. `seat` is the height sat at; without it the feet find the floor. */
export const POSES = {
  stand: { arm: [0.04, 0.1, 0.1], fore: [0.18, 0, 0], thigh: [0, 0, 0.025], head: [0.02, 0, 0] },
  relaxed: { armR: [0.08, 0.15, 0.1], foreR: [0.25, 0, 0], armL: [-0.04, -0.1, -0.09], foreL: [0.12, 0, 0], thighR: [0.06, 0, 0.03], shinR: [-0.1, 0, 0], thighL: [-0.02, 0, -0.03], pelvis: [0, 0, 0.03], spine: [0, 0, -0.03], head: [0.03, 0.2, 0] },
  hips: { arm: [-0.3, 0.95, 0.62], fore: [1.55, 0, 0], thigh: [0, 0, 0.06], chest: [-0.04, 0, 0] },
  crossed: { arm: [0.42, 0.95, 0.12], fore: [1.7, 0, 0], thigh: [0, 0, 0.04], chest: [-0.03, 0, 0] },
  phone: { armR: [0.55, 0.55, 0.28], foreR: [2.35, 0, 0], armL: [0.04, -0.1, -0.1], foreL: [0.2, 0, 0], head: [0.03, -0.12, 0.1], thigh: [0, 0, 0.03] },
  text: { arm: [0.3, 0.42, 0.06], fore: [1.5, 0, 0], head: [0.4, 0, 0], thigh: [0, 0, 0.03] },
  point: { armR: [1.42, 0, 0.12], foreR: [0.08, 0, 0], armL: [0.04, -0.1, -0.1], foreL: [0.2, 0, 0], head: [0, -0.1, 0], thigh: [0, 0, 0.04] },
  wave: { armR: [0.15, 0, 2.5], foreR: [0.55, 0, 0], armL: [0.04, -0.1, -0.1], foreL: [0.2, 0, 0], thigh: [0, 0, 0.03] },
  talk: { armR: [0.45, 0.1, 0.2], foreR: [1.25, 0, 0], armL: [0.25, -0.2, -0.12], foreL: [1.0, 0, 0], head: [0, 0.15, 0], thigh: [0, 0, 0.03] },
  carry: { arm: [0.32, 0.06, 0.1], fore: [1.3, 0, 0], thigh: [0, 0, 0.03], chest: [-0.06, 0, 0] },
  clipboard: { armL: [0.3, -0.35, -0.05], foreL: [1.45, 0, 0], armR: [0.5, 0.45, 0.12], foreR: [1.2, 0, 0], head: [0.3, 0, 0], thigh: [0, 0, 0.03] },
  counter: { arm: [0.3, 0.08, 0.1], fore: [1.15, 0, 0], thigh: [0, 0, 0.03], head: [0.08, 0, 0] },
  push: { arm: [0.75, 0.05, 0.1], fore: [0.6, 0, 0], spine: [0.22, 0, 0], thighR: [0.4, 0, 0.02], shinR: [-0.35, 0, 0], thighL: [-0.3, 0, -0.02], shinL: [-0.2, 0, 0], footL: [-0.3, 0, 0], head: [-0.15, 0, 0] },
  dig: { spine: [0.45, 0, 0], chest: [0.22, 0.25, 0], armR: [0.35, 0.1, 0.1], foreR: [0.5, 0, 0], armL: [0.75, -0.4, -0.1], foreL: [0.35, 0, 0], thighR: [0.55, 0, 0.1], shinR: [-0.6, 0, 0], thighL: [-0.3, 0, -0.1], shinL: [-0.25, 0, 0], footL: [-0.3, 0, 0], head: [-0.3, 0, 0] },
  kneel: { spine: [0.3, 0, 0], chest: [0.15, 0, 0], thighR: [1.75, 0, 0.12], shinR: [-1.9, 0, 0], thighL: [0.15, 0, -0.08], shinL: [-1.7, 0, 0], footL: [0.9, 0, 0], arm: [0.6, 0.1, 0.05], fore: [0.6, 0, 0], head: [-0.1, 0, 0] },
  crouch: { spine: [0.5, 0, 0], chest: [0.2, 0, 0], thigh: [2.2, 0, 0.25], shin: [-2.5, 0, 0], foot: [0.3, 0, 0], arm: [0.5, 0.1, 0.05], fore: [0.9, 0, 0], head: [-0.4, 0, 0] },
  reach: { armR: [2.5, 0, 0.2], foreR: [0.25, 0, 0], armL: [2.2, 0, -0.25], foreL: [0.45, 0, 0], chest: [-0.12, 0, 0], head: [-0.35, 0, 0], thigh: [0, 0, 0.05] },
  flag: { armR: [0.25, 0.3, 0.42], foreR: [1.35, 0, 0], armL: [1.35, 0, -0.5], foreL: [0.2, 0, 0], handL: [-1.2, 0, 0], thigh: [0, 0, 0.06] },
  lean: { pelvis: [0, 0, 0.1], spine: [0, 0, -0.08], armR: [0.3, 0.9, 0.25], foreR: [1.6, 0, 0], armL: [0.04, -0.1, -0.12], foreL: [0.3, 0, 0], thighR: [0.2, 0, 0.1], shinR: [-0.45, 0, 0], thighL: [0, 0, -0.06], head: [0, 0.2, 0] },
  sit: { seat: 1.55, thigh: [1.5, 0, 0.07], shin: [-1.48, 0, 0], arm: [0.3, 0.1, 0.08], fore: [1.0, 0.3, 0], spine: [-0.03, 0, 0], head: [0.03, 0, 0] },
  type: { seat: 1.55, thigh: [1.5, 0, 0.07], shin: [-1.4, 0, 0], arm: [0.38, 0.05, 0.1], fore: [1.2, 0.2, 0], spine: [0.06, 0, 0], head: [0.1, 0, 0] },
  lounge: { seat: 1.35, pelvis: [-0.22, 0, 0], thigh: [1.3, 0, 0.14], shin: [-1.25, 0, 0], armR: [0.1, 0.2, 0.45], foreR: [0.9, 0, 0], armL: [0.2, -0.2, -0.12], foreL: [1.0, 0, 0], spine: [0.05, 0, 0], head: [0.15, 0, 0] },
  eat: { seat: 1.55, thigh: [1.5, 0, 0.07], shin: [-1.45, 0, 0], armR: [0.55, 0.3, 0.15], foreR: [1.75, 0, 0], armL: [0.4, -0.1, -0.1], foreL: [1.15, 0, 0], spine: [0.12, 0, 0], head: [0.12, 0, 0] },
  read: { seat: 1.55, thigh: [1.5, 0, 0.07], shin: [-1.48, 0, 0], arm: [0.45, 0.4, 0.05], fore: [1.5, 0, 0], head: [0.32, 0, 0] },
  stool: { seat: 2.4, thigh: [1.25, 0, 0.1], shin: [-1.2, 0, 0], arm: [0.4, 0.1, 0.1], fore: [1.15, 0, 0], spine: [0.08, 0, 0] },
  drive: { seat: 1.3, pelvis: [-0.2, 0, 0], thigh: [1.3, 0, 0.1], shin: [-0.95, 0, 0], arm: [0.85, 0.1, 0.08], fore: [0.7, 0, 0], spine: [0.05, 0, 0], head: [0.12, 0, 0] },
  lie: { lie: true, arm: [0.02, 0.1, 0.12], fore: [0.1, 0, 0], thigh: [0, 0, 0.04] },
  squat: { thigh: [1.5, 0, 0.2], shin: [-1.9, 0, 0], foot: [0.4, 0, 0], spine: [0.5, 0, 0], arm: [0.7, 0, 0.05], fore: [0.5, 0, 0], head: [-0.3, 0, 0] },
  lift: { arm: [2.9, 0, 0.14], fore: [0.2, 0, 0], thigh: [0, 0, 0.07], chest: [-0.08, 0, 0], head: [-0.1, 0, 0] },
  run: { thighR: [0.95, 0, 0.02], shinR: [-1.2, 0, 0], thighL: [-0.5, 0, -0.02], shinL: [-0.6, 0, 0], footL: [-0.5, 0, 0], armR: [-0.7, 0, 0.12], foreR: [1.5, 0, 0], armL: [0.9, 0, -0.12], foreL: [1.6, 0, 0], spine: [0.2, 0, 0], head: [-0.12, 0, 0] },
};

/** A stride of a walk: p runs 0..2π through one full cycle. */
export function walkPose(p, { swing = 1 } = {}) {
  const leg = (q) => {
    const s = Math.sin(q);
    const lift = Math.max(0, Math.cos(q - 0.35));
    return { thigh: [0.44 * s * swing - 0.04, 0, 0], shin: [-(0.1 + 0.9 * lift * lift) * swing, 0, 0], foot: [0.18 * s - 0.25 * lift * lift, 0, 0] };
  };
  const R = leg(p);
  const L = leg(p + PI);
  const a = Math.sin(p) * swing;
  return {
    pelvis: [0.03, 0.07 * a, 0.035 * Math.cos(p)],
    spine: [0.03, -0.06 * a, -0.03 * Math.cos(p)],
    chest: [0, -0.1 * a, 0],
    head: [0, 0.09 * a, 0],
    thighR: [R.thigh[0], 0, 0.02], shinR: R.shin, footR: R.foot,
    thighL: [L.thigh[0], 0, -0.02], shinL: L.shin, footL: L.foot,
    armR: [-0.42 * a, 0.1, 0.09], foreR: [0.32 - 0.2 * a, 0, 0],
    armL: [0.42 * a, -0.1, -0.09], foreL: [0.32 + 0.2 * a, 0, 0],
  };
}

const _eu = new THREE.Euler(0, 0, 0, 'ZXY');
const ZERO = [0, 0, 0];

const AXIAL = new Set(['pelvis', 'spine', 'chest', 'neck', 'head']);

/** The rotation a pose gives a bone: its own entry, or the shared one mirrored for the left.
 *  The spine and head bow forward for a positive bend, as the limbs swing forward. */
function boneRot(pose, name) {
  if (pose[name]) return AXIAL.has(name) ? [-pose[name][0], pose[name][1], pose[name][2]] : pose[name];
  const base = name.slice(0, -1);
  const side = name.slice(-1);
  if ((side === 'R' || side === 'L') && pose[base]) {
    const v = pose[base];
    return side === 'R' ? v : [v[0], -v[1], -v[2]];
  }
  return ZERO;
}

/** World matrices of the bones in a pose, feet on the floor (or seated). */
export function solvePose(fig, pose = POSES.stand) {
  const J = fig.joints;
  const H = fig.H;
  const world = [];
  const local = new THREE.Matrix4();
  for (let i = 0; i < BONES.length; i++) {
    const r = boneRot(pose, BONES[i]);
    local.makeRotationFromEuler(_eu.set(r[0], r[1], r[2], 'ZXY'));
    const p = PARENT[i];
    if (p < 0) local.setPosition(J[i][0], J[i][1], J[i][2]);
    else local.setPosition(J[i][0] - J[p][0], J[i][1] - J[p][1], J[i][2] - J[p][2]);
    world.push(p < 0 ? local.clone() : world[p].clone().multiply(local));
  }
  // Drop (or raise) the whole figure until the lower foot is on the ground.
  let dy = 0;
  if (pose.seat != null) {
    dy = pose.seat * (fig.spec.child ? 0.8 : 1) + 0.05 * H - J[BI.thighR][1];
  } else if (!pose.lie && !pose.float) {
    let low = Infinity;
    const v = new THREE.Vector3();
    for (const b of [BI.footR, BI.footL]) {
      for (const z of [0.036, -0.03, -0.115]) {
        v.set(0, -0.045 * H, z * H).applyMatrix4(world[b]);
        low = Math.min(low, v.y);
      }
    }
    dy = -low;
  }
  if (pose.lie) {
    // Laid on the back at `bed` height, head toward +z.
    const m = new THREE.Matrix4().makeRotationX(PI / 2);
    m.setPosition(0, (pose.bed || 0) + 0.075 * H, -0.5 * H);
    for (const w of world) w.premultiply(m);
  } else if (dy) {
    for (const w of world) w.elements[13] += dy;
  }
  return world;
}

/** A point given in a bone's own frame (relative to its joint), in a pose. */
export function boneWorld(fig, world, bone, offset = ZERO) {
  return new THREE.Vector3(offset[0], offset[1], offset[2]).applyMatrix4(world[BI[bone]]);
}

/** Where a hand's grip is in a pose, and which way the forearm runs. */
export function gripOf(fig, world, side = 'R') {
  const at = boneWorld(fig, world, `hand${side}`, [0, -0.05 * fig.H, -0.012 * fig.H]);
  const wrist = boneWorld(fig, world, `hand${side}`);
  const elbow = boneWorld(fig, world, `fore${side}`);
  return { at, dir: wrist.clone().sub(elbow).normalize() };
}

/** The figure's geometry frozen in a pose, turned and moved to where it stands. */
export function bakeFigure(fig, pose = POSES.stand, { x = 0, y = 0, z = 0, turn = 0, world = null } = {}) {
  const W = world || solvePose(fig, pose);
  const J = fig.joints;
  const skinM = W.map((m, i) => m.clone().multiply(new THREE.Matrix4().makeTranslation(-J[i][0], -J[i][1], -J[i][2])));
  const src = fig.geo;
  const pos = src.attributes.position;
  const si = src.attributes.skinIndex;
  const sw = src.attributes.skinWeight;
  const out = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const w1 = sw.getY(i);
    a.copy(v).applyMatrix4(skinM[si.getX(i)]);
    if (w1 > 0.001) a.lerp(b.copy(v).applyMatrix4(skinM[si.getY(i)]), w1);
    out[i * 3] = x + a.x * c + a.z * s;
    out[i * 3 + 1] = y + a.y;
    out[i * 3 + 2] = z - a.x * s + a.z * c;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(out, 3));
  g.setAttribute('color', src.attributes.color.clone());
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2));
  g.setIndex(src.index.clone());
  g.computeVertexNormals();
  return g;
}

/**
 * Stand a figure in a builder. Returns { fig, world, at(bone, offset), grip(side) }
 * in the builder's frame, for putting things in its hands.
 */
export function placePerson(B, role, seed, { x = 0, y = 0, z = 0, turn = 0, pose = 'stand', spec = null } = {}) {
  const fig = makeFigure({ ...personSpec(role, seed), ...(spec || {}) });
  const P = typeof pose === 'string' ? POSES[pose] || POSES.stand : pose;
  const world = solvePose(fig, P);
  B.add(bakeFigure(fig, P, { x, y, z, turn, world }), M.figure());
  fig.geo.dispose();
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  const out = (v) => [x + v.x * c + v.z * s, y + v.y, z - v.x * s + v.z * c];
  return {
    fig, world,
    at: (bone, offset) => out(boneWorld(fig, world, bone, offset)),
    grip: (side = 'R') => { const g = gripOf(fig, world, side); return { at: out(g.at), dir: [g.dir.x * c + g.dir.z * s, g.dir.y, -g.dir.x * s + g.dir.z * c] }; },
  };
}

/* ---------------------------------------------------------- living figures */

/** A figure with its bones, for walking about: { mesh, pose(p), dispose() }. */
export function rigFigure(fig) {
  const J = fig.joints;
  const bones = BONES.map((name) => {
    const b = new THREE.Bone();
    b.name = name;
    b.rotation.order = 'ZXY';
    return b;
  });
  BONES.forEach((name, i) => {
    const p = PARENT[i];
    if (p < 0) bones[i].position.set(J[i][0], J[i][1], J[i][2]);
    else { bones[i].position.set(J[i][0] - J[p][0], J[i][1] - J[p][1], J[i][2] - J[p][2]); bones[p].add(bones[i]); }
  });
  const mesh = new THREE.SkinnedMesh(fig.geo, M.figure());
  mesh.add(bones[0]);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  const rootY = J[0][1];
  return {
    mesh, fig,
    /** Take up a pose; the feet stay on the ground. */
    pose(P) {
      for (let i = 0; i < BONES.length; i++) {
        const r = boneRot(P, BONES[i]);
        bones[i].rotation.set(r[0], r[1], r[2], 'ZXY');
      }
      const W = solvePose(fig, P);
      bones[0].position.y = W[0].elements[13];
      return rootY;
    },
    dispose() { fig.geo.dispose(); mesh.skeleton.dispose(); },
  };
}

/** How far a figure travels in one full stride cycle, for pacing the animation. */
export function strideLength(fig) {
  return 2 * 2 * 0.475 * fig.H * Math.sin(0.44);
}
