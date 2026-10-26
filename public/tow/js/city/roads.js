// Streets, sidewalks/curbs, lane paint and crosswalks.
import * as THREE from 'three';
import * as TX from '../textures.js';
import { Buckets, hquad, wall, sweep, flipGeo } from './geom.js';
import { GRID, ARTERIAL, SIDEWALK, CURB, halfWidthAt, PARKWAY, parkwayPoint, PARKWAY_LEN, INTERCHANGES, rotK, RING, RAMP, BAY_X } from './layout.js';

export function roadMaterials() {
  const asp = TX.asphalt(0);
  const road = new THREE.MeshStandardMaterial({ ...asp, roughness: 1, metalness: 0, envMapIntensity: 0.25 });
  const asp2 = TX.asphalt(1);
  const roadLight = new THREE.MeshStandardMaterial({ ...asp2, roughness: 1, metalness: 0, envMapIntensity: 0.25 });
  // Surfaces laid on top of other surfaces get a depth bias so they never
  // flicker against what's underneath (ground under streets, lots on slabs).
  const lotAsphalt = road.clone();
  Object.assign(lotAsphalt, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  const sw = TX.sidewalk();
  const sidewalk = new THREE.MeshStandardMaterial({ ...sw, roughness: 0.92, envMapIntensity: 0.35 });
  const cc = TX.concrete(3, [1, 0.99, 0.96], 165);
  const curb = new THREE.MeshStandardMaterial({ ...cc, roughness: 0.85 });
  const white = new THREE.MeshStandardMaterial({ ...TX.roadPaint('#f1f1ec'), transparent: false, alphaTest: 0.5, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const yellow = new THREE.MeshStandardMaterial({ ...TX.roadPaint('#e8b923'), transparent: false, alphaTest: 0.5, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const gr = TX.grass();
  const grass = new THREE.MeshStandardMaterial({ ...gr, roughness: 1, envMapIntensity: 0.3, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 4 });
  const parkGrass = new THREE.MeshStandardMaterial({ ...gr, roughness: 1, envMapIntensity: 0.3, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  return { road, roadLight, lotAsphalt, sidewalk, curb, white, yellow, grass, parkGrass };
}

// A painted line from (x0,z0) to (x1,z1), width w, dashed if dash>0.
function paintLine(b, mat, key, x0, z0, x1, z1, w, y = 0.035, dash = 0, gap = 0) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  if (len < 0.05) return;
  const dx = (x1 - x0) / len, dz = (z1 - z0) / len;
  const nx = -dz * w / 2, nz = dx * w / 2;
  const segs = [];
  if (dash > 0) {
    for (let s = 0; s < len; s += dash + gap) segs.push([s, Math.min(len, s + dash)]);
  } else segs.push([0, len]);
  for (const [s0, s1] of segs) {
    const ax = x0 + dx * s0, az = z0 + dz * s0, bx = x0 + dx * s1, bz = z0 + dz * s1;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([ax - nx, y, az - nz, bx - nx, y, bz - nz, bx + nx, y, bz + nz, ax + nx, y, az + nz], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, s0 / 4, 1, s0 / 4, 1, s1 / 4, 0, s1 / 4].map((v, i) => (i % 2 ? v : v)), 2));
    // Winding so the quad faces up.
    const cross = (bx - ax) * (nz * 2) - (bz - az) * (nx * 2);
    g.setIndex(cross < 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2]);
    b.add(key, mat, g);
  }
}

export function buildRoads(root, physics, M) {
  const b = new Buckets();
  const N = GRID.length;
  const lo = GRID[0], hi = GRID[N - 1];
  const Y = 0.02;

  // ---- ground: grass everywhere, bay water handled elsewhere
  const ground = hquad(-2200, -2200, BAY_X, 2200, 0, 6);
  b.add('grass', M.grass, ground);

  // ---- street pavement
  const extent = (c) => (ARTERIAL.has(c) && c !== 0 ? PARKWAY.half : hi + halfWidthAt(hi));
  for (const c of GRID) {
    const hw = halfWidthAt(c);
    const e = extent(c);
    // North-south (constant x) and east-west (constant z) strips.
    b.add('road', M.road, hquad(c - hw, -e, c + hw, e, Y, 8));
    b.add('road', M.road, hquad(-e, c - hw, e, c + hw, Y, 8));
  }
  // Parkway ring.
  const pkPath = [];
  for (let s = 0; s <= PARKWAY_LEN + 0.1; s += 6) {
    const p = parkwayPoint(s);
    pkPath.push({ x: p.x, y: Y, z: p.z, nx: p.nx, nz: p.nz });
  }
  b.add('road', M.road, sweep(pkPath, [[PARKWAY.hw, 0], [-PARKWAY.hw, 0]], { uTile: 8, vTile: 8 }));
  // Ramp terminal aprons: asphalt between ramp ends and the arterial.
  for (const ic of INTERCHANGES) {
    for (const off of [RAMP.offEnd, -RAMP.offEnd]) {
      const pts = [];
      for (const [du, dl] of [[-16, -3.6], [16, -3.6], [16, 3.6], [-16, 3.6]]) {
        const [x, z] = rotK(ic.u + du, -RING.half + off + dl, ic.side);
        pts.push([x, z]);
      }
      const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
      b.add('road', M.road, hquad(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs), Y + 0.002, 8));
    }
  }

  // ---- blocks: raised sidewalk slabs with curbs
  const blocks = [];
  for (let i = 0; i < N - 1; i++) {
    for (let j = 0; j < N - 1; j++) {
      const x0 = GRID[i] + halfWidthAt(GRID[i]), x1 = GRID[i + 1] - halfWidthAt(GRID[i + 1]);
      const z0 = GRID[j] + halfWidthAt(GRID[j]), z1 = GRID[j + 1] - halfWidthAt(GRID[j + 1]);
      blocks.push({ i, j, x0, x1, z0, z1, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2 });
      slab(b, M, physics, x0, z0, x1, z1);
    }
  }
  // Outer sidewalks along the frontage roads (outside the grid), split where arterials pass.
  const outerSide = (fixed, axis, sign) => {
    const hw = halfWidthAt(hi);
    const a0 = fixed + sign * hw, a1 = a0 + sign * SIDEWALK;
    const cuts = [-240, 240];
    const runs = [[lo - hw - SIDEWALK, cuts[0] - 8], [cuts[0] + 8, cuts[1] - 8], [cuts[1] + 8, hi + hw + SIDEWALK]];
    for (const [r0, r1] of runs) {
      if (axis === 'z') slab(b, M, physics, r0, Math.min(a0, a1), r1, Math.max(a0, a1));
      else slab(b, M, physics, Math.min(a0, a1), r0, Math.max(a0, a1), r1);
    }
  };
  outerSide(lo, 'z', -1); outerSide(hi, 'z', 1); outerSide(lo, 'x', -1); outerSide(hi, 'x', 1);

  // ---- lane paint
  for (let i = 0; i < N; i++) {
    const c = GRID[i];
    const art = ARTERIAL.has(c);
    const hw = halfWidthAt(c);
    const e = extent(c);
    // Segment breakpoints along this street: every crossing street.
    const crossings = GRID.map((g) => [g, halfWidthAt(g)]);
    if (art && c !== 0) {
      for (const d of [RING.half - RAMP.offEnd, RING.half + RAMP.offEnd, PARKWAY.half]) { crossings.push([d, 4]); crossings.push([-d, 4]); }
    }
    crossings.sort((a, b2) => a[0] - b2[0]);
    for (let k = 0; k < crossings.length - 1; k++) {
      const [a, ha] = crossings[k], [bb, hb] = crossings[k + 1];
      const s0 = a + ha + (Math.abs(a) <= hi ? 5.4 : 1), s1 = bb - hb - (Math.abs(bb) <= hi ? 5.4 : 1);
      if (s1 - s0 < 2 || Math.max(Math.abs(a), Math.abs(bb)) > e) continue;
      for (const axis of ['ns', 'ew']) {
        const L = (u0, v0, u1, v1, w, mat, key, dash = 0, gap = 0) => {
          if (axis === 'ns') paintLine(b, mat, key, c + u0, v0, c + u1, v1, w, 0.035, dash, gap);
          else paintLine(b, mat, key, v0, c + u0, v1, c + u1, w, 0.035, dash, gap);
        };
        L(-0.12, s0, -0.12, s1, 0.1, M.yellow, 'yellow');
        L(0.12, s0, 0.12, s1, 0.1, M.yellow, 'yellow');
        if (art) {
          L(-3.4, s0, -3.4, s1, 0.12, M.white, 'white', 3, 9);
          L(3.4, s0, 3.4, s1, 0.12, M.white, 'white', 3, 9);
          L(-6.8, s0, -6.8, s1, 0.12, M.white, 'white');
          L(6.8, s0, 6.8, s1, 0.12, M.white, 'white');
        } else {
          L(-3.4, s0, -3.4, s1, 0.1, M.white, 'white');
          L(3.4, s0, 3.4, s1, 0.1, M.white, 'white');
        }
      }
    }
    // Crosswalks + stop bars at grid intersections.
    if (Math.abs(c) > hi) continue;
    for (const g of GRID) {
      const hg = halfWidthAt(g);
      for (const dirSign of [-1, 1]) {
        for (const axis of ['ns', 'ew']) {
          const edge = g + dirSign * (hg + 0.6);
          const far = edge + dirSign * 3.0;
          // Zebra stripes across this street (width 2*hw).
          for (let u = -hw + 0.5; u < hw - 0.3; u += 1.0) {
            if (axis === 'ns') paintLine(b, M.white, 'white', c + u, Math.min(edge, far), c + u, Math.max(edge, far), 0.55, 0.036);
            else paintLine(b, M.white, 'white', Math.min(edge, far), c + u, Math.max(edge, far), c + u, 0.55, 0.036);
          }
          // Stop bar across the lanes approaching the intersection (right-hand traffic).
          const bar = far + dirSign * 0.8;
          const h = axis === 'ns'
            ? (dirSign < 0 ? [-hw + 0.3, -0.3] : [0.3, hw - 0.3])
            : (dirSign < 0 ? [0.3, hw - 0.3] : [-hw + 0.3, -0.3]);
          if (axis === 'ns') paintLine(b, M.white, 'white', c + h[0], bar, c + h[1], bar, 0.45, 0.036);
          else paintLine(b, M.white, 'white', bar, c + h[0], bar, c + h[1], 0.45, 0.036);
        }
      }
    }
  }
  // Parkway paint.
  b.add('yellow', M.yellow, sweep(pkPath.map((p) => ({ ...p, y: 0.035 })), [[0.22, 0], [0.02, 0]], { uTile: 4, vTile: 1 }));
  b.add('yellow', M.yellow, sweep(pkPath.map((p) => ({ ...p, y: 0.035 })), [[-0.02, 0], [-0.22, 0]], { uTile: 4, vTile: 1 }));
  for (const off of [6.3, -6.1]) b.add('white', M.white, sweep(pkPath.map((p) => ({ ...p, y: 0.035 })), [[off + 0.1, 0], [off - 0.1, 0]], { uTile: 4, vTile: 1 }));

  const meshes = b.build(root, { cast: false, name: 'roads-' });
  for (const m of meshes) if (m.name.endsWith('grass')) m.receiveShadow = true;
  return { blocks };
}

function slab(b, M, physics, x0, z0, x1, z1) {
  b.add('sidewalk', M.sidewalk, hquad(x0, z0, x1, z1, CURB, 3));
  // Curb faces (outward).
  b.add('curb', M.curb, wall(x1, z0, x0, z0, 0, CURB, 2, 2));
  b.add('curb', M.curb, wall(x1, z1, x1, z0, 0, CURB, 2, 2));
  b.add('curb', M.curb, wall(x0, z1, x1, z1, 0, CURB, 2, 2));
  b.add('curb', M.curb, wall(x0, z0, x0, z1, 0, CURB, 2, 2));
  physics?.box((x0 + x1) / 2, CURB / 2, (z0 + z1) / 2, (x1 - x0) / 2, CURB / 2, (z1 - z0) / 2, { friction: 0.9 });
}
