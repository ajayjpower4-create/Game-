// Geometry helpers for the city: quads with world-space UVs, swept strips,
// and a bucket that merges everything sharing a material into one mesh.
import * as THREE from 'three';

export class Buckets {
  constructor() { this.map = new Map(); }
  add(key, material, geo) {
    let b = this.map.get(key);
    if (!b) { b = { material, geos: [] }; this.map.set(key, b); }
    b.geos.push(geo);
  }
  build(parent, { cast = true, receive = true, name = '' } = {}) {
    const meshes = [];
    for (const [key, b] of this.map) {
      const g = mergeAll(b.geos);
      if (!g) continue;
      g.computeBoundingSphere();
      const m = new THREE.Mesh(g, b.material);
      m.name = name + key;
      m.castShadow = cast && !b.material.transparent;
      m.receiveShadow = receive;
      m.matrixAutoUpdate = false;
      m.updateMatrix();
      parent.add(m);
      meshes.push(m);
    }
    this.map.clear();
    return meshes;
  }
}

// Concatenates geometries (position/normal/uv), converting to non-indexed.
export function mergeAll(geos) {
  let count = 0;
  const parts = [];
  for (const g0 of geos) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    if (!g.attributes.normal) g.computeVertexNormals();
    parts.push(g);
    count += g.attributes.position.count;
  }
  if (!count) return null;
  const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), uv = new Float32Array(count * 2);
  let o = 0;
  for (const g of parts) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

// Axis-aligned horizontal quad at height y, UVs in world meters / tile.
export function hquad(x0, z0, x1, z1, y, tile = 1, up = true) {
  const g = new THREE.BufferGeometry();
  const p = [x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1];
  const uv = [x0 / tile, -z0 / tile, x1 / tile, -z0 / tile, x1 / tile, -z1 / tile, x0 / tile, -z1 / tile];
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0].map((v, i) => (i % 3 === 1 ? (up ? 1 : -1) : 0)), 3));
  g.setIndex(up ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]);
  return g;
}

// Vertical wall quad from (x0,z0) to (x1,z1), y from y0 to y1, facing the
// side given by the right-hand normal of the segment direction.
// u tiles by uTile meters along the wall, v by vTile meters up.
export function wall(x0, z0, x1, z1, y0, y1, uTile = 1, vTile = 1, flip = false, vOffset = 0) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const g = new THREE.BufferGeometry();
  const p = [x0, y0, z0, x1, y0, z1, x1, y1, z1, x0, y1, z0];
  const u1 = len / uTile, v0 = vOffset, v1 = vOffset + (y1 - y0) / vTile;
  const uv = [0, v0, u1, v0, u1, v1, 0, v1];
  // Normal matches the winding: (-dz, dx) of the segment direction.
  let nx = -(z1 - z0) / len, nz = (x1 - x0) / len;
  if (flip) { nx = -nx; nz = -nz; }
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([nx, 0, nz, nx, 0, nz, nx, 0, nz, nx, 0, nz], 3));
  g.setIndex(flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3]);
  return g;
}

// Four walls + roof of an axis-aligned box building, UVs per facade tile.
// faces: optional per-face material keys {n,s,e,w,roof}. Returns {key: geo[]}.
export function boxWalls(x0, z0, x1, z1, y0, y1, uTile, vTile, vOffset = 0) {
  // Walls listed so each faces outward: north (-z), east (+x), south (+z), west (-x).
  return {
    n: wall(x1, z0, x0, z0, y0, y1, uTile, vTile, false, vOffset),
    e: wall(x1, z1, x1, z0, y0, y1, uTile, vTile, false, vOffset),
    s: wall(x0, z1, x1, z1, y0, y1, uTile, vTile, false, vOffset),
    w: wall(x0, z0, x0, z1, y0, y1, uTile, vTile, false, vOffset),
  };
}

// Sweeps a 2D cross-section (array of [lateral, height]) along a path of
// {x,y,z,nx,nz} samples (n = lateral unit normal). UV: u along path in
// meters/uTile, v along the section in meters/vTile.
export function sweep(path, section, { uTile = 8, vTile = 8, closed = false } = {}) {
  const pos = [], uv = [], idx = [];
  const ns = section.length;
  let along = 0;
  const secLen = [0];
  for (let k = 1; k < ns; k++) secLen.push(secLen[k - 1] + Math.hypot(section[k][0] - section[k - 1][0], section[k][1] - section[k - 1][1]));
  for (let i = 0; i < path.length; i++) {
    const p = path[i];
    if (i > 0) along += Math.hypot(p.x - path[i - 1].x, p.y - path[i - 1].y, p.z - path[i - 1].z);
    for (let k = 0; k < ns; k++) {
      const [lat, h] = section[k];
      pos.push(p.x + p.nx * lat, p.y + h, p.z + p.nz * lat);
      uv.push(along / uTile, secLen[k] / vTile);
    }
  }
  for (let i = 0; i < path.length - 1; i++) {
    for (let k = 0; k < ns - 1; k++) {
      const a = i * ns + k, b = a + 1, c = a + ns, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Flips winding (and normals) if a swept surface came out facing inward.
export function flipGeo(g) {
  const idx = g.index.array;
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i]; idx[i] = idx[i + 1]; idx[i + 1] = t; }
  g.index.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

// Box geometry placed in world space (for small solid pieces).
export function boxAt(w, h, d, x, y, z, rotY = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  return g;
}

export function cylAt(rt, rb, h, x, y, z, seg = 12) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  g.translate(x, y, z);
  return g;
}
