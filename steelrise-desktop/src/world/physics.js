// Collision world: oriented boxes in a 2D spatial hash plus the graded
// ground plane (y = 0). Supports ray casts (aiming, support checks),
// box overlap (placement), and sphere contacts (the player capsule).

import { V3, CF } from "../core/math.js";

const CELL = 4;
const BIG_CELLS = 600;

// Collider: { cf, hx, hy, hz, owner, solid, query, climb, name }
export function makeCollider(cf, size, owner, flags = {}) {
  const c = { hx: size.x / 2, hy: size.y / 2, hz: size.z / 2, owner, solid: flags.solid !== false, query: flags.query !== false, climb: !!flags.climb, name: flags.name || "", cells: null, stamp: 0 };
  setColliderCf(c, cf);
  return c;
}

export function setColliderCf(c, cf) {
  c.cf = cf;
  const r = cf.r;
  // world AABB
  const ex = Math.abs(r[0]) * c.hx + Math.abs(r[1]) * c.hy + Math.abs(r[2]) * c.hz;
  const ey = Math.abs(r[3]) * c.hx + Math.abs(r[4]) * c.hy + Math.abs(r[5]) * c.hz;
  const ez = Math.abs(r[6]) * c.hx + Math.abs(r[7]) * c.hy + Math.abs(r[8]) * c.hz;
  c.min = [cf.x - ex, cf.y - ey, cf.z - ez];
  c.max = [cf.x + ex, cf.y + ey, cf.z + ez];
}

export class Physics {
  constructor() {
    this.cells = new Map();
    this.big = new Set();
    this.stamp = 1;
    this.groundY = 0;
    this.count = 0;
    this.bounds = null; // optional ground extent
  }

  add(c) {
    const ix0 = Math.floor(c.min[0] / CELL), ix1 = Math.floor(c.max[0] / CELL);
    const iz0 = Math.floor(c.min[2] / CELL), iz1 = Math.floor(c.max[2] / CELL);
    this.count++;
    if ((ix1 - ix0 + 1) * (iz1 - iz0 + 1) > BIG_CELLS) {
      this.big.add(c);
      c.cells = "big";
      return;
    }
    c.cells = [];
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        const k = ix * 100003 + iz;
        let list = this.cells.get(k);
        if (!list) this.cells.set(k, (list = []));
        list.push(c);
        c.cells.push(list);
      }
    }
  }
  remove(c) {
    if (!c.cells) return;
    this.count--;
    if (c.cells === "big") this.big.delete(c);
    else {
      for (const list of c.cells) {
        const i = list.indexOf(c);
        if (i >= 0) {
          list[i] = list[list.length - 1];
          list.pop();
        }
      }
    }
    c.cells = null;
  }
  move(c, cf) {
    this.remove(c);
    setColliderCf(c, cf);
    this.add(c);
  }
  addAll(list) {
    for (const c of list) this.add(c);
  }
  removeAll(list) {
    for (const c of list) this.remove(c);
  }

  // candidates whose AABB overlaps [min,max]
  query(min, max, fn) {
    const st = ++this.stamp;
    const ix0 = Math.floor(min[0] / CELL), ix1 = Math.floor(max[0] / CELL);
    const iz0 = Math.floor(min[2] / CELL), iz1 = Math.floor(max[2] / CELL);
    const visit = (c) => {
      if (c.stamp === st) return;
      c.stamp = st;
      if (c.max[0] < min[0] || c.min[0] > max[0] || c.max[1] < min[1] || c.min[1] > max[1] || c.max[2] < min[2] || c.min[2] > max[2]) return;
      fn(c);
    };
    for (let ix = ix0; ix <= ix1; ix++) {
      for (let iz = iz0; iz <= iz1; iz++) {
        const list = this.cells.get(ix * 100003 + iz);
        if (list) for (let i = 0; i < list.length; i++) visit(list[i]);
      }
    }
    for (const c of this.big) visit(c);
  }

  // ray vs OBB (slab test in box space); returns t in [0, maxT] or -1
  static rayObb(c, ox, oy, oz, dx, dy, dz, maxT, nOut) {
    const r = c.cf.r;
    const px = ox - c.cf.x, py = oy - c.cf.y, pz = oz - c.cf.z;
    // into local space (R^T)
    const lo = [r[0] * px + r[3] * py + r[6] * pz, r[1] * px + r[4] * py + r[7] * pz, r[2] * px + r[5] * py + r[8] * pz];
    const ld = [r[0] * dx + r[3] * dy + r[6] * dz, r[1] * dx + r[4] * dy + r[7] * dz, r[2] * dx + r[5] * dy + r[8] * dz];
    const h = [c.hx, c.hy, c.hz];
    let tmin = 0, tmax = maxT, axis = -1, sign = 0;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(ld[i]) < 1e-12) {
        if (lo[i] < -h[i] || lo[i] > h[i]) return -1;
      } else {
        let t1 = (-h[i] - lo[i]) / ld[i], t2 = (h[i] - lo[i]) / ld[i];
        let s = -1;
        if (t1 > t2) {
          const t = t1;
          t1 = t2;
          t2 = t;
          s = 1;
        }
        if (t1 > tmin) {
          tmin = t1;
          axis = i;
          sign = s;
        }
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) return -1;
      }
    }
    if (axis < 0) {
      // origin inside the box
      if (nOut) nOut.set = false;
      return 0;
    }
    if (nOut) {
      nOut.x = r[axis] * sign;
      nOut.y = r[3 + axis] * sign;
      nOut.z = r[6 + axis] * sign;
    }
    return tmin;
  }

  // dir carries the max distance in its length.
  // filter(c) -> bool to accept a collider. opts.ground (default true)
  raycast(origin, dir, filter, opts = {}) {
    const len = dir.len;
    if (len < 1e-9) return null;
    const dx = dir.x / len, dy = dir.y / len, dz = dir.z / len;
    let best = len, hit = null;
    const n = { x: 0, y: 1, z: 0 };
    let bestN = null;
    const test = (c) => {
      if (!c.query || (filter && !filter(c))) return;
      const t = Physics.rayObb(c, origin.x, origin.y, origin.z, dx, dy, dz, best, n);
      if (t >= 0 && t < best) {
        // starting inside a box: ignore it (matches engine raycasts)
        if (t === 0 && n.set === false) {
          n.set = undefined;
          return;
        }
        best = t;
        hit = c;
        bestN = new V3(n.x, n.y, n.z);
      }
    };
    // walk cells along the ray (2D DDA in x/z)
    const st = ++this.stamp;
    const visitCell = (list) => {
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        if (c.stamp === st) continue;
        c.stamp = st;
        test(c);
      }
    };
    let ix = Math.floor(origin.x / CELL), iz = Math.floor(origin.z / CELL);
    const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const tdx = Math.abs(dx) > 1e-12 ? CELL / Math.abs(dx) : Infinity;
    const tdz = Math.abs(dz) > 1e-12 ? CELL / Math.abs(dz) : Infinity;
    let tmx = Math.abs(dx) > 1e-12 ? ((dx > 0 ? (ix + 1) * CELL : ix * CELL) - origin.x) / dx : Infinity;
    let tmz = Math.abs(dz) > 1e-12 ? ((dz > 0 ? (iz + 1) * CELL : iz * CELL) - origin.z) / dz : Infinity;
    let tCell = 0;
    for (let guard = 0; guard < 4000; guard++) {
      // boxes overlapping this column can be hit no earlier than... any t, so test all,
      // but we may stop once the cell entry is beyond the best hit
      if (tCell > best) break;
      const list = this.cells.get(ix * 100003 + iz);
      if (list) visitCell(list);
      if (tmx < tmz) {
        tCell = tmx;
        tmx += tdx;
        ix += stepX;
      } else {
        tCell = tmz;
        tmz += tdz;
        iz += stepZ;
      }
      if (tCell > len) break;
    }
    for (const c of this.big) if (c.stamp !== st) { c.stamp = st; test(c); }
    // ground plane
    if (opts.ground !== false && dy < -1e-9 && origin.y >= this.groundY - 0.01) {
      const t = (this.groundY - origin.y) / dy;
      if (t >= 0 && t < best && this.inGround(origin.x + dx * t, origin.z + dz * t)) {
        return { pos: new V3(origin.x + dx * t, this.groundY, origin.z + dz * t), normal: new V3(0, 1, 0), col: null, owner: "terrain", terrain: true, dist: t };
      }
    }
    if (!hit) return null;
    return { pos: new V3(origin.x + dx * best, origin.y + dy * best, origin.z + dz * best), normal: bestN, col: hit, owner: hit.owner, terrain: false, dist: best };
  }

  inGround(x, z) {
    const b = this.bounds;
    return !b || (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ);
  }

  // OBB overlap (separating axis test). cf + half extents.
  overlapBox(cf, size, filter) {
    const box = makeCollider(cf, size, null);
    const out = [];
    this.query(box.min, box.max, (c) => {
      if (filter && !filter(c)) return;
      if (obbOverlap(box, c)) out.push(c);
    });
    return out;
  }

  // Sphere vs boxes: returns list of { push: V3 (out of the box), normal, col }
  sphereContacts(cx, cy, cz, radius, filter, out = []) {
    const min = [cx - radius, cy - radius, cz - radius], max = [cx + radius, cy + radius, cz + radius];
    this.query(min, max, (c) => {
      if (!c.solid || (filter && !filter(c))) return;
      const r = c.cf.r;
      const px = cx - c.cf.x, py = cy - c.cf.y, pz = cz - c.cf.z;
      const lx = r[0] * px + r[3] * py + r[6] * pz, ly = r[1] * px + r[4] * py + r[7] * pz, lz = r[2] * px + r[5] * py + r[8] * pz;
      const qx = Math.max(-c.hx, Math.min(c.hx, lx)), qy = Math.max(-c.hy, Math.min(c.hy, ly)), qz = Math.max(-c.hz, Math.min(c.hz, lz));
      let dx = lx - qx, dy = ly - qy, dz = lz - qz;
      let d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > radius * radius) return;
      let nx, ny, nz, depth;
      if (d2 > 1e-10) {
        const d = Math.sqrt(d2);
        nx = dx / d; ny = dy / d; nz = dz / d;
        depth = radius - d;
      } else {
        // centre inside: push out along the shallowest face
        const ex = c.hx - Math.abs(lx), ey = c.hy - Math.abs(ly), ez = c.hz - Math.abs(lz);
        if (ex <= ey && ex <= ez) { nx = Math.sign(lx) || 1; ny = 0; nz = 0; depth = ex + radius; }
        else if (ey <= ez) { nx = 0; ny = Math.sign(ly) || 1; nz = 0; depth = ey + radius; }
        else { nx = 0; ny = 0; nz = Math.sign(lz) || 1; depth = ez + radius; }
      }
      const wn = new V3(r[0] * nx + r[1] * ny + r[2] * nz, r[3] * nx + r[4] * ny + r[5] * nz, r[6] * nx + r[7] * ny + r[8] * nz);
      out.push({ normal: wn, depth, col: c });
    });
    return out;
  }

  // climbable volumes containing a point
  climbAt(p, pad = 0.35) {
    let found = null;
    this.query([p.x - pad, p.y - 1, p.z - pad], [p.x + pad, p.y + 1, p.z + pad], (c) => {
      if (!c.climb || found) return;
      const lp = c.cf.pointToObj(p);
      if (Math.abs(lp.x) <= c.hx + pad && Math.abs(lp.y) <= c.hy + 0.2 && Math.abs(lp.z) <= c.hz + pad) found = c;
    });
    return found;
  }
}

function obbOverlap(a, b) {
  const A = [a.cf.xVec, a.cf.yVec, a.cf.zVec];
  const B = [b.cf.xVec, b.cf.yVec, b.cf.zVec];
  const ea = [a.hx, a.hy, a.hz], eb = [b.hx, b.hy, b.hz];
  const t0 = b.cf.pos.sub(a.cf.pos);
  const t = [t0.dot(A[0]), t0.dot(A[1]), t0.dot(A[2])];
  const R = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], AR = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { R[i][j] = A[i].dot(B[j]); AR[i][j] = Math.abs(R[i][j]) + 1e-6; }
  for (let i = 0; i < 3; i++) {
    const ra = ea[i], rb = eb[0] * AR[i][0] + eb[1] * AR[i][1] + eb[2] * AR[i][2];
    if (Math.abs(t[i]) > ra + rb) return false;
  }
  for (let j = 0; j < 3; j++) {
    const ra = ea[0] * AR[0][j] + ea[1] * AR[1][j] + ea[2] * AR[2][j], rb = eb[j];
    if (Math.abs(t[0] * R[0][j] + t[1] * R[1][j] + t[2] * R[2][j]) > ra + rb) return false;
  }
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const i1 = (i + 1) % 3, i2 = (i + 2) % 3, j1 = (j + 1) % 3, j2 = (j + 2) % 3;
      const ra = ea[i1] * AR[i2][j] + ea[i2] * AR[i1][j];
      const rb = eb[j1] * AR[i][j2] + eb[j2] * AR[i][j1];
      if (Math.abs(t[i2] * R[i1][j] - t[i1] * R[i2][j]) > ra + rb) return false;
    }
  }
  return true;
}

// Colliders for a model's parts placed at `worldCf`.
export function collidersFor(parts, worldCf, owner) {
  const out = [];
  for (const p of parts) {
    if (p.climb) {
      const c = makeCollider(worldCf.mul(p.cf), p.size, owner, { solid: false, query: false, climb: true, name: p.name });
      c.local = p.cf;
      out.push(c);
      continue;
    }
    const solid = !p.nc && !(p.tr >= 1);
    // interaction volumes (truck cab, crane gate) are invisible but aimable
    const query = !!p.interact || (!p.nq && !(p.tr >= 1));
    if (!solid && !query) continue;
    const c = makeCollider(worldCf.mul(p.cf), p.size, owner, { solid, query, name: p.name });
    c.local = p.cf;
    if (p.interact) c.interact = p.interact;
    out.push(c);
  }
  return out;
}

export { CF };
