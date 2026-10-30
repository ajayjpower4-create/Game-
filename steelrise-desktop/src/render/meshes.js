// Turns Builder part specs into GPU geometry. Parts are merged per surface
// bucket (material + transparency + shadow flag) so a column with 20 parts is
// two or three draw calls, and identical items share one geometry.

import * as THREE from "three";
import { getMaterial, getLensMaterial, MAT_TILE, signTexture } from "./materials.js";

const _c = new THREE.Color();

class Acc {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.uv = [];
    this.col = [];
    this.idx = [];
  }
  get count() {
    return this.pos.length / 3;
  }
}

// world transform of a local point/vector by a CF
function tp(cf, x, y, z) {
  const r = cf.r;
  return [cf.x + r[0] * x + r[1] * y + r[2] * z, cf.y + r[3] * x + r[4] * y + r[5] * z, cf.z + r[6] * x + r[7] * y + r[8] * z];
}
function tv(cf, x, y, z) {
  const r = cf.r;
  return [r[0] * x + r[1] * y + r[2] * z, r[3] * x + r[4] * y + r[5] * z, r[6] * x + r[7] * y + r[8] * z];
}

function quad(acc, cf, p0, p1, p2, p3, n, uvs, rgb) {
  const base = acc.count;
  const wn = tv(cf, n[0], n[1], n[2]);
  for (let i = 0; i < 4; i++) {
    const p = [p0, p1, p2, p3][i];
    acc.pos.push(...tp(cf, p[0], p[1], p[2]));
    acc.nrm.push(...wn);
    acc.uv.push(uvs[i * 2], uvs[i * 2 + 1]);
    acc.col.push(rgb[0], rgb[1], rgb[2]);
  }
  acc.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function tri(acc, cf, p0, p1, p2, n, uvs, rgb) {
  const base = acc.count;
  const wn = tv(cf, n[0], n[1], n[2]);
  for (let i = 0; i < 3; i++) {
    const p = [p0, p1, p2][i];
    acc.pos.push(...tp(cf, p[0], p[1], p[2]));
    acc.nrm.push(...wn);
    acc.uv.push(uvs[i * 2], uvs[i * 2 + 1]);
    acc.col.push(rgb[0], rgb[1], rgb[2]);
  }
  acc.idx.push(base, base + 1, base + 2);
}

function addBox(acc, part, rgb, tile) {
  const { x, y, z } = part.size;
  const hx = x / 2, hy = y / 2, hz = z / 2;
  const cf = part.cf;
  const u = (a, b) => [0, 0, a / tile, 0, a / tile, b / tile, 0, b / tile];
  // +X, -X, +Y, -Y, +Z, -Z (counter-clockwise seen from outside)
  quad(acc, cf, [hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz], [1, 0, 0], u(z, y), rgb);
  quad(acc, cf, [-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz], [-1, 0, 0], u(z, y), rgb);
  quad(acc, cf, [-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz], [0, 1, 0], u(x, z), rgb);
  quad(acc, cf, [-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz], [0, -1, 0], u(x, z), rgb);
  quad(acc, cf, [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz], [0, 0, 1], u(x, y), rgb);
  quad(acc, cf, [hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz], [0, 0, -1], u(x, y), rgb);
}

// Roblox-style wedge: full bottom and back (+Z) faces, slope rising from the
// front-bottom edge (-Z) to the back-top edge.
function addWedge(acc, part, rgb, tile) {
  const { x, y, z } = part.size;
  const hx = x / 2, hy = y / 2, hz = z / 2;
  const cf = part.cf;
  const u = (a, b) => [0, 0, a / tile, 0, a / tile, b / tile, 0, b / tile];
  quad(acc, cf, [-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz], [0, -1, 0], u(x, z), rgb);
  quad(acc, cf, [-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz], [0, 0, 1], u(x, y), rgb);
  const sl = Math.hypot(y, z);
  quad(acc, cf, [hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, hz], [hx, hy, hz], [0, z / sl, -y / sl], u(x, sl), rgb);
  tri(acc, cf, [hx, -hy, -hz], [hx, hy, hz], [hx, -hy, hz], [1, 0, 0], [0, 0, z / tile, y / tile, z / tile, 0], rgb);
  tri(acc, cf, [-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-1, 0, 0], [0, 0, z / tile, 0, z / tile, y / tile], rgb);
}

// cylinder along local X; diameter from size.y (Roblox uses min(y, z))
function addCyl(acc, part, rgb, tile) {
  const len = part.size.x;
  const r = Math.min(part.size.y, part.size.z) / 2;
  const n = Math.max(8, Math.min(28, Math.round(r * 2 * 40)));
  const cf = part.cf;
  const hx = len / 2;
  const circ = 2 * Math.PI * r;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
    // side: per-vertex normals for smooth shading
    const base = acc.count;
    const verts = [[-hx, c0, s0], [hx, c0, s0], [hx, c1, s1], [-hx, c1, s1]];
    const us = [i / n, i / n, (i + 1) / n, (i + 1) / n];
    const vs = [0, 1, 1, 0];
    for (let k = 0; k < 4; k++) {
      const [px, cy, sz] = verts[k];
      acc.pos.push(...tp(cf, px, cy * r, sz * r));
      acc.nrm.push(...tv(cf, 0, cy, sz));
      acc.uv.push((us[k] * circ) / tile, (vs[k] * len) / tile);
      acc.col.push(rgb[0], rgb[1], rgb[2]);
    }
    acc.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    // caps
    tri(acc, cf, [hx, 0, 0], [hx, c0 * r, s0 * r], [hx, c1 * r, s1 * r], [1, 0, 0], [0.5, 0.5, 0.5 + c0 * 0.5 * (2 * r / tile), 0.5 + s0 * 0.5 * (2 * r / tile), 0.5 + c1 * 0.5 * (2 * r / tile), 0.5 + s1 * 0.5 * (2 * r / tile)], rgb);
    tri(acc, cf, [-hx, 0, 0], [-hx, c1 * r, s1 * r], [-hx, c0 * r, s0 * r], [-1, 0, 0], [0.5, 0.5, 0.5 + c1 * 0.5, 0.5 + s1 * 0.5, 0.5 + c0 * 0.5, 0.5 + s0 * 0.5], rgb);
  }
}

function addBall(acc, part, rgb, tile) {
  const r = Math.min(part.size.x, part.size.y, part.size.z) / 2;
  const cf = part.cf;
  const W = 16, H = 10;
  const base = acc.count;
  for (let j = 0; j <= H; j++) {
    const th = (j / H) * Math.PI;
    for (let i = 0; i <= W; i++) {
      const ph = (i / W) * Math.PI * 2;
      const nx = Math.sin(th) * Math.cos(ph), ny = Math.cos(th), nz = Math.sin(th) * Math.sin(ph);
      acc.pos.push(...tp(cf, nx * r, ny * r, nz * r));
      acc.nrm.push(...tv(cf, nx, ny, nz));
      acc.uv.push(((i / W) * Math.PI * 2 * r) / tile, ((j / H) * Math.PI * r) / tile);
      acc.col.push(rgb[0], rgb[1], rgb[2]);
    }
  }
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const a = base + j * (W + 1) + i, b = a + W + 1;
      acc.idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
}

export function partRgb(color) {
  _c.setHex(color);
  return [_c.r, _c.g, _c.b];
}

export function addPart(acc, part) {
  const rgb = partRgb(part.color);
  const tile = MAT_TILE[part.mat] || 1;
  if (part.shape === "cyl") addCyl(acc, part, rgb, tile);
  else if (part.shape === "ball") addBall(acc, part, rgb, tile);
  else if (part.shape === "wedge") addWedge(acc, part, rgb, tile);
  else addBox(acc, part, rgb, tile);
}

export function accToGeometry(acc) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(acc.pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(acc.nrm, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(acc.uv, 2));
  g.setAttribute("color", new THREE.Float32BufferAttribute(acc.col, 3));
  g.setIndex(acc.count > 65535 ? new THREE.Uint32BufferAttribute(acc.idx, 1) : new THREE.Uint16BufferAttribute(acc.idx, 1));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

const trBucket = (tr) => (!tr ? 0 : tr >= 0.75 ? 0.8 : tr >= 0.45 ? 0.6 : tr >= 0.2 ? 0.35 : 0.1);
const reflBucket = (r) => (!r ? 0 : r >= 0.12 ? 0.15 : 0.06);

// Groups parts into render buckets: [{ key, geometry, material, castShadow, lens }]
export function bucketize(parts, opts = {}) {
  const accs = new Map();
  for (const p of parts) {
    if (p.tr >= 1) continue;
    const lens = !!p.lens;
    const mat = opts.opaqueGlass && p.mat === "Glass" ? "FacadeGlass" : p.mat;
    const glass = mat === "Glass";
    const tr = glass ? 0.3 : trBucket(p.tr);
    const refl = reflBucket(p.refl);
    const shadow = !p.ns && !glass && tr < 0.5;
    const key = lens ? "lens" : `${mat}|${tr}|${refl}|${shadow ? 1 : 0}`;
    let a = accs.get(key);
    if (!a) {
      a = { acc: new Acc(), mat, tr, refl, shadow, lens };
      accs.set(key, a);
    }
    addPart(a.acc, p);
  }
  const out = [];
  for (const [key, a] of accs) {
    if (a.acc.count === 0) continue;
    out.push({
      key,
      geometry: accToGeometry(a.acc),
      material: a.lens ? getLensMaterial() : getMaterial(a.mat, a.tr, a.refl),
      castShadow: a.shadow,
      lens: a.lens,
      transparent: a.tr > 0 || a.mat === "Glass",
    });
  }
  return out;
}

// Sign planes (text) as standalone meshes in the model's local space.
export function signMeshes(signs) {
  const out = [];
  for (const s of signs) {
    const p = s.part;
    // text goes on the part's front (-Z) or back (+Z) face
    const w = p.size.x, h = p.size.y;
    const tex = signTexture(s.text, s.bg, s.fg, w / h);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.98, h * 0.96), new THREE.MeshStandardMaterial({ map: tex, transparent: s.bg === undefined, roughness: 0.6 }));
    const back = s.face === "back";
    const cf = p.cf.mul(back ? { x: 0, y: 0, z: p.size.z / 2 + 0.004, r: [1, 0, 0, 0, 1, 0, 0, 0, 1] } : { x: 0, y: 0, z: -p.size.z / 2 - 0.004, r: [-1, 0, 0, 0, 1, 0, 0, 0, -1] });
    cf.toMatrix4(m.matrix);
    m.matrixAutoUpdate = false;
    m.name = "Sign";
    out.push(m);
  }
  return out;
}

// Group of meshes for a bucket list (dynamic / one-off models).
export function groupFromBuckets(buckets, signs) {
  const g = new THREE.Group();
  for (const b of buckets) {
    const m = new THREE.Mesh(b.geometry, b.material);
    m.castShadow = b.castShadow;
    m.receiveShadow = !b.transparent;
    m.userData.lens = b.lens;
    if (b.transparent) m.renderOrder = 2;
    g.add(m);
  }
  for (const s of signs || []) g.add(s);
  return g;
}
