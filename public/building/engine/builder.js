/* Geometry builder.
 *
 * Models are assembled from parts — quads, boxes, cylinders, spheres — placed
 * in the model's own frame (feet; x across, y up, z toward the front). When a
 * model is finished every part that shares a material is merged into a single
 * mesh, so a building with two thousand window parts is still a handful of
 * draw calls. UVs are in feet so tiled materials keep real-world scale. */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();

function scaleUV(geo, ranges) {
  const uv = geo.attributes.uv;
  for (const [start, count, su, sv] of ranges) {
    for (let i = start; i < start + count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
  uv.needsUpdate = true;
  return geo;
}

/** A box whose UVs measure feet on every face. */
export function boxGeo(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  return scaleUV(g, [[0, 4, d, h], [4, 4, d, h], [8, 4, w, d], [12, 4, w, d], [16, 4, w, h], [20, 4, w, h]]);
}

export function cylGeo(rt, rb, h, seg = 16, open = false) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
  const uv = g.attributes.uv;
  const circ = Math.PI * 2 * Math.max(rt, rb);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circ, uv.getY(i) * h);
  return g;
}

export class Builder {
  constructor() {
    this.parts = new Map();   // material -> [geometry]
  }

  /** Add any geometry, baked into place. rot is [x, y, z] in radians. */
  add(geo, mat, { pos = [0, 0, 0], rot = null, scale = null } = {}) {
    if (geo.index === null) geo = geo.toNonIndexed ? toIndexed(geo) : geo;
    _e.set(...(rot || [0, 0, 0]));
    _q.setFromEuler(_e);
    _s.set(...(scale || [1, 1, 1]));
    _p.set(...pos);
    _m.compose(_p, _q, _s);
    geo.applyMatrix4(_m);
    if (!geo.attributes.uv) {
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    }
    for (const k of Object.keys(geo.attributes)) {
      if (k !== 'position' && k !== 'normal' && k !== 'uv') geo.deleteAttribute(k);
    }
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(geo);
    return this;
  }

  /**
   * A flat quad from four corners, counter-clockwise as seen from the side it
   * faces. UVs default to feet along the first edge and up the last.
   */
  quad(mat, a, b, c, d, uv = null) {
    const pos = new Float32Array([...a, ...b, ...c, ...d]);
    const ab = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const ad = new THREE.Vector3(d[0] - a[0], d[1] - a[1], d[2] - a[2]);
    const n = new THREE.Vector3().crossVectors(ab, ad).normalize();
    const nor = new Float32Array([n.x, n.y, n.z, n.x, n.y, n.z, n.x, n.y, n.z, n.x, n.y, n.z]);
    const L = ab.length();
    const H = ad.length();
    const uvs = new Float32Array(uv || [0, 0, L, 0, L, H, 0, H]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(g);
    return this;
  }

  /** A box centred at (x, y, z). */
  box(mat, w, h, d, x = 0, y = 0, z = 0, rot = null) {
    return this.add(boxGeo(Math.max(0.01, w), Math.max(0.01, h), Math.max(0.01, d)), mat, { pos: [x, y, z], rot });
  }

  /** A box resting on y0 rather than centred on y. */
  slab(mat, w, h, d, x, y0, z, rot = null) {
    return this.box(mat, w, h, d, x, y0 + h / 2, z, rot);
  }

  cyl(mat, rt, rb, h, x, y, z, { seg = 16, rot = null, open = false } = {}) {
    return this.add(cylGeo(rt, rb, h, seg, open), mat, { pos: [x, y, z], rot });
  }

  /** A post or pipe standing on y0. */
  post(mat, r, h, x, y0, z, seg = 10) {
    return this.cyl(mat, r, r, h, x, y0 + h / 2, z, { seg });
  }

  sphere(mat, r, x, y, z, { sx = 1, sy = 1, sz = 1, seg = 14 } = {}) {
    return this.add(new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.6 | 0)), mat, { pos: [x, y, z], scale: [sx, sy, sz] });
  }

  cone(mat, r, h, x, y, z, seg = 14, rot = null) {
    return this.add(new THREE.ConeGeometry(r, h, seg), mat, { pos: [x, y, z], rot });
  }

  /** A pipe from one point to another. */
  tube(mat, a, b, r, seg = 8) {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const len = va.distanceTo(vb);
    if (len < 1e-4) return this;
    const g = cylGeo(r, r, len, seg, true);
    const mid = va.clone().add(vb).multiplyScalar(0.5);
    const dir = vb.clone().sub(va).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    g.applyMatrix4(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)));
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    if (!this.parts.has(mat)) this.parts.set(mat, []);
    this.parts.get(mat).push(g);
    return this;
  }

  /** An extruded 2-D profile (THREE.Shape), extruded along +z by depth. */
  extrude(mat, shape, depth, { pos = [0, 0, 0], rot = null, bevel = 0 } = {}) {
    const g = new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 10,
    });
    return this.add(g, mat, { pos, rot });
  }

  /** Merge everything into meshes and hang them on a group. */
  finish(group = new THREE.Group(), { cast = true, receive = true } = {}) {
    for (const [mat, geos] of this.parts) {
      if (!geos.length) continue;
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, mat);
      const lit = mat.blending === THREE.AdditiveBlending;
      mesh.castShadow = cast && !mat.transparent && !lit;
      mesh.receiveShadow = receive && !lit;
      group.add(mesh);
      for (const g of geos) if (g !== merged) g.dispose();
    }
    this.parts.clear();
    return group;
  }
}

function toIndexed(geo) {
  const count = geo.attributes.position.count;
  const idx = new Array(count);
  for (let i = 0; i < count; i++) idx[i] = i;
  geo.setIndex(idx);
  return geo;
}

/** Dispose every geometry under an object (materials are shared and cached). */
export function disposeTree(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
  });
}
