// The elevated I-671 ring: deck, jersey barriers, piers, lane paint,
// diamond-interchange ramps, overhead guide signs and median lighting.
import * as THREE from 'three';
import * as TX from '../textures.js';
import { Buckets, sweep, flipGeo, boxAt, cylAt, mergeAll } from './geom.js';
import {
  RING, DECK, RING_LEN, ringPoint, INTERCHANGES, sideS, RAMP, rampWorld,
} from './layout.js';
import * as SG from './signs.js';

const Y = RING.deckY;

function ringPath(s0, s1, step, yOff = 0) {
  const pts = [];
  const n = Math.max(1, Math.ceil((s1 - s0) / step));
  for (let i = 0; i <= n; i++) {
    const s = s0 + (s1 - s0) * (i / n);
    const p = ringPoint(s);
    pts.push({ x: p.x, y: Y + yOff, z: p.z, nx: p.nx, nz: p.nz, s });
  }
  return pts;
}

// Jersey barrier cross-sections (lateral, height), ordered so faces point out.
const JERSEY = [[0, 0], [0.08, 0.08], [0.25, 0.33], [0.3, 1.07], [0.45, 1.07], [0.45, 0]];
// Barrier whose roadway face is at `lat` and which extends `dir` (+1 toward
// higher lateral / -1 toward lower).
function jerseySection(lat, dir) {
  const pts = JERSEY.map(([a, h]) => [lat + dir * a, h]);
  return dir > 0 ? pts.reverse() : pts;
}
const MEDIAN = [[0.3, 0], [0.25, 0.33], [0.08, 1.07], [-0.08, 1.07], [-0.25, 0.33], [-0.3, 0]];

export function buildHighway(root, physics, roadMats) {
  const b = new Buckets();
  const conc = TX.concrete(21, [1, 0.99, 0.96], 150);
  const concMat = new THREE.MeshStandardMaterial({ ...conc, roughness: 0.9 });
  const concDark = new THREE.MeshStandardMaterial({ ...TX.concrete(22, [1, 1, 1], 120), roughness: 0.95 });
  const barrierMat = new THREE.MeshStandardMaterial({ ...TX.concrete(23, [1, 1, 0.98], 185), roughness: 0.8 });
  const road = roadMats.roadLight;
  const deckGeos = [], wallGeos = [];

  // ---- deck slab and median
  const full = ringPath(0, RING_LEN, 5);
  const top = sweep(full, [[DECK.parapet, 0], [-DECK.parapet, 0]], { uTile: 8, vTile: 8 });
  b.add('deckTop', road, top);
  deckGeos.push(top);
  b.add('deckUnder', concDark, sweep(full, [[-DECK.parapet, -RING.deckThick], [DECK.parapet, -RING.deckThick]], { uTile: 6, vTile: 6 }));
  b.add('deckSide', concMat, sweep(full, [[-DECK.parapet, 0], [-DECK.parapet, -RING.deckThick]], { uTile: 4, vTile: 4 }));
  b.add('deckSide', concMat, sweep(full, [[DECK.parapet, -RING.deckThick], [DECK.parapet, 0]], { uTile: 4, vTile: 4 }));
  const med = sweep(full, MEDIAN, { uTile: 4, vTile: 2 });
  b.add('barrier', barrierMat, med);
  wallGeos.push(med);

  // ---- parapets with gaps where ramps peel off / merge in
  const gaps = { in: [], out: [] };
  const sepLen = RAMP.len - (RAMP.len - RAMP.flat) + 4; // stretch where the ramp rides alongside at deck height
  for (const ic of INTERCHANGES) {
    const s0 = sideS(ic.side, ic.u);
    gaps.in.push([s0 - RAMP.len - 2, s0 - RAMP.len + sepLen], [s0 + RAMP.len - sepLen, s0 + RAMP.len + 2]);
    gaps.out.push([s0 + RAMP.len - sepLen, s0 + RAMP.len + 2], [s0 - RAMP.len - 2, s0 - RAMP.len + sepLen]);
  }
  const runs = (gapList) => {
    const g = gapList.map(([a, c]) => [((a % RING_LEN) + RING_LEN) % RING_LEN, ((c % RING_LEN) + RING_LEN) % RING_LEN]).sort((p, q) => p[0] - q[0]);
    const out = [];
    let cur = g[g.length - 1][1] - RING_LEN;
    for (const [a, c] of g) { if (a > cur) out.push([cur, a]); cur = Math.max(cur, c); }
    return out;
  };
  for (const [s0, s1] of runs(gaps.in)) {
    const path = ringPath(s0, s1, 5);
    const g = sweep(path, jerseySection(DECK.edge, 1), { uTile: 4, vTile: 2 });
    b.add('barrier', barrierMat, g); wallGeos.push(g);
  }
  for (const [s0, s1] of runs(gaps.out)) {
    const path = ringPath(s0, s1, 5);
    const g = sweep(path, jerseySection(-DECK.edge, -1), { uTile: 4, vTile: 2 });
    b.add('barrier', barrierMat, g); wallGeos.push(g);
  }

  // ---- lane paint
  const paintStrip = (mat, key, lat, w, s0, s1, dash = 0, gap = 0) => {
    if (dash) {
      for (let s = s0; s < s1; s += dash + gap) {
        const p = ringPath(s, Math.min(s1, s + dash), 1.5, 0.03);
        b.add(key, mat, sweep(p, [[lat + w / 2, 0], [lat - w / 2, 0]], { uTile: 4, vTile: 1 }));
      }
    } else {
      const p = ringPath(s0, s1, 5, 0.03);
      b.add(key, mat, sweep(p, [[lat + w / 2, 0], [lat - w / 2, 0]], { uTile: 4, vTile: 1 }));
    }
  };
  for (const side of [1, -1]) {
    paintStrip(roadMats.yellow, 'yellow', side * DECK.innerLanes[0], 0.15, 0, RING_LEN);
    paintStrip(roadMats.white, 'white', side * DECK.innerLanes[1], 0.15, 0, RING_LEN, 3, 9);
    paintStrip(roadMats.white, 'white', side * DECK.innerLanes[2], 0.18, 0, RING_LEN);
  }

  // ---- piers
  const icS = INTERCHANGES.map((ic) => sideS(ic.side, ic.u));
  const pierGeos = [];
  for (let s = 10; s < RING_LEN; s += 38) {
    if (icS.some((c) => Math.abs(c - s) < 22)) continue;
    const p = ringPoint(s);
    const ang = Math.atan2(p.tx, p.tz);
    for (const lat of [-7.2, 7.2]) {
      const x = p.x + p.nx * lat, z = p.z + p.nz * lat;
      pierGeos.push(cylAt(0.78, 0.85, Y - RING.deckThick, x, (Y - RING.deckThick) / 2, z, 16));
      physics?.cylinder(x, (Y - RING.deckThick) / 2, z, 0.82, (Y - RING.deckThick) / 2);
    }
    const cap = new THREE.BoxGeometry(19, 1.1, 2.0);
    cap.rotateY(Math.atan2(-p.nz, p.nx));
    cap.translate(p.x, Y - RING.deckThick - 0.55, p.z);
    pierGeos.push(cap);
  }
  for (const g of pierGeos) b.add('pier', concMat, g);

  // ---- median light poles
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x8d9298, metalness: 0.8, roughness: 0.4 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x444444, emissive: 0xfff1d6, emissiveIntensity: 0.0, roughness: 0.4 });
  for (let s = 30; s < RING_LEN; s += 62) {
    const p = ringPoint(s);
    b.add('hwpole', poleMat, cylAt(0.11, 0.17, 12, p.x, Y + 6, p.z, 10));
    for (const side of [1, -1]) {
      const ax = p.x + p.nx * side * 1.8, az = p.z + p.nz * side * 1.8;
      const arm = new THREE.BoxGeometry(0.12, 0.12, 3.6);
      arm.rotateY(Math.atan2(p.nx, p.nz));
      arm.translate(ax, Y + 11.9, az);
      b.add('hwpole', poleMat, arm);
      const head = new THREE.BoxGeometry(0.5, 0.16, 0.9);
      head.rotateY(Math.atan2(p.nx, p.nz));
      head.translate(p.x + p.nx * side * 3.5, Y + 11.8, p.z + p.nz * side * 3.5);
      b.add('hwlamp', lampMat, head);
    }
  }

  // ---- ramps
  const rampInfo = [];
  for (const ic of INTERCHANGES) {
    for (const dir of [1, -1]) {
      for (const kind of ['off', 'on']) {
        const raw = rampWorld(ic, dir, kind);
        // Lateral normals in the xz plane (left of travel direction = +n so sections match the deck).
        const path = raw.map((p, i) => {
          const a = raw[Math.max(0, i - 1)], c = raw[Math.min(raw.length - 1, i + 1)];
          const dx = c.x - a.x, dz = c.z - a.z, L = Math.hypot(dx, dz) || 1;
          return { x: p.x, y: p.y + 0.01, z: p.z, nx: -dz / L, nz: dx / L };
        });
        // Travel direction tangent is (dx,dz); n = (-dz, dx) is to the LEFT of travel.
        const hw = RAMP.width / 2;
        const t = sweep(path, [[-hw, 0], [hw, 0]], { uTile: 8, vTile: 8 });
        orientUp(t);
        b.add('deckTop', road, t);
        deckGeos.push(t);
        const sideA = sweep(path, [[hw, 0], [hw, -0.9]], { uTile: 4, vTile: 4 });
        const sideB = sweep(path, [[-hw, -0.9], [-hw, 0]], { uTile: 4, vTile: 4 });
        b.add('deckSide', concMat, orientAway(sideA, path, hw));
        b.add('deckSide', concMat, orientAway(sideB, path, -hw));
        const under = sweep(path, [[hw, -0.9], [-hw, -0.9]], { uTile: 6, vTile: 6 });
        b.add('deckUnder', concDark, orientDown(under));
        // Barriers: the side away from the deck always; the deck side once separated.
        const deckSideSign = sideTowardRing(path, ic);
        const elevated = path.filter((p) => p.y > 0.6);
        if (elevated.length > 1) {
          const sub = (pred) => { const out = []; for (const p of path) if (pred(p)) out.push(p); return out; };
          const far = sub((p) => p.y > 0.4);
          const near = sub((p) => p.y > 0.4 && p.y < RING.deckY - 0.05);
          const farSec = jerseySection(-deckSideSign * hw, -deckSideSign);
          const g1 = sweep(far, farSec.map(([a, h]) => [a, h]), { uTile: 4, vTile: 2 });
          b.add('barrier', barrierMat, g1); wallGeos.push(g1);
          if (near.length > 1) {
            const g2 = sweep(near, jerseySection(deckSideSign * hw, deckSideSign), { uTile: 4, vTile: 2 });
            b.add('barrier', barrierMat, g2); wallGeos.push(g2);
          }
        }
        // Edge paint.
        const paintPath = path.map((p) => ({ ...p, y: p.y + 0.025 }));
        b.add('white', roadMats.white, orientUp(sweep(paintPath, [[-hw + 0.5, 0], [-hw + 0.35, 0]], { uTile: 4, vTile: 1 })));
        b.add('yellow', roadMats.yellow, orientUp(sweep(paintPath, [[hw - 0.35, 0], [hw - 0.5, 0]], { uTile: 4, vTile: 1 })));
        // Piers under the elevated part.
        let acc = 0;
        for (let i = 1; i < path.length; i++) {
          acc += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
          if (acc > 22 && path[i].y > 2.2) {
            acc = 0;
            const h = path[i].y - 0.9;
            b.add('pier', concMat, cylAt(0.6, 0.65, h, path[i].x, h / 2, path[i].z, 14));
            physics?.cylinder(path[i].x, h / 2, path[i].z, 0.65, h / 2);
          }
        }
        rampInfo.push({ ic, dir, kind, path });
      }
    }
  }

  // ---- overhead guide signs and gore signs
  buildSigns(b, physics);

  b.build(root, { name: 'hw-' });

  // Colliders: drivable surfaces + barriers as trimeshes.
  if (physics) {
    const deckAll = mergeAll(deckGeos);
    physics.trimeshFromGeometry(deckAll, { friction: 1.0 });
    const walls = mergeAll(wallGeos);
    physics.trimeshFromGeometry(walls, { friction: 0.4 });
  }
  return { rampInfo, lampMat };
}

// Ensures a horizontal sweep faces up.
function orientUp(g) {
  const n = g.attributes.normal;
  let sum = 0;
  for (let i = 0; i < n.count; i++) sum += n.getY(i);
  if (sum < 0) flipGeo(g);
  return g;
}
function orientDown(g) {
  const n = g.attributes.normal;
  let sum = 0;
  for (let i = 0; i < n.count; i++) sum += n.getY(i);
  if (sum > 0) flipGeo(g);
  return g;
}
// Side wall at lateral `lat` should face away from the ramp center.
function orientAway(g, path, lat) {
  const n = g.attributes.normal;
  const p = path[Math.floor(path.length / 2)];
  const want = Math.sign(lat);
  const i = Math.floor(n.count / 2);
  const dot = n.getX(i) * p.nx + n.getZ(i) * p.nz;
  if (Math.sign(dot) !== want) flipGeo(g);
  return g;
}
// +1 if the ring centerline lies on the +n side of this ramp, else -1.
function sideTowardRing(path, ic) {
  const p = path[Math.floor(path.length * 0.2)];
  const s = sideS(ic.side, ic.u);
  const c = ringPoint(s);
  const dx = c.x - p.x, dz = c.z - p.z;
  // Project onto the ring's normal direction to find where the deck is.
  const d = dx * p.nx + dz * p.nz;
  return d > 0 ? 1 : -1;
}

function signPanel(b, mat, key, x, y, z, w, h, rotY) {
  const g = new THREE.PlaneGeometry(w, h);
  g.rotateY(rotY);
  g.translate(x, y, z);
  b.add(key, mat, g);
  // Back of the panel (aluminum).
  const back = new THREE.PlaneGeometry(w, h);
  back.rotateY(rotY + Math.PI);
  back.translate(x - Math.sin(rotY) * 0.02, y, z - Math.cos(rotY) * 0.02);
  b.add('signback', signBack(), back);
}
let _signBack = null;
const signBack = () => (_signBack ||= new THREE.MeshStandardMaterial({ color: 0x9aa0a6, metalness: 0.7, roughness: 0.45 }));
let _steel = null;
const galv = () => (_steel ||= new THREE.MeshStandardMaterial({ color: 0x9da3a9, metalness: 0.85, roughness: 0.38 }));

// Truss gantry spanning one roadway at arc length s. dir: +1 inner loop, -1 outer.
function gantry(b, physics, s, dir, panels) {
  const p = ringPoint(s);
  const yTop = Y + 6.3;
  const lat0 = dir * 0.9, lat1 = dir * (DECK.parapet + 0.6);
  const A = { x: p.x + p.nx * lat0, z: p.z + p.nz * lat0 };
  const B = { x: p.x + p.nx * lat1, z: p.z + p.nz * lat1 };
  for (const P of [A, B]) {
    b.add('gantry', galv(), cylAt(0.16, 0.2, yTop - Y + 0.5, P.x, Y + (yTop - Y + 0.5) / 2, P.z, 12));
    physics?.cylinder(P.x, Y + 3, P.z, 0.2, 3);
  }
  const len = Math.hypot(B.x - A.x, B.z - A.z);
  const ang = Math.atan2(p.nx, p.nz);
  for (const dy of [0, 1.1]) {
    const beam = new THREE.CylinderGeometry(0.09, 0.09, len, 8);
    beam.rotateZ(Math.PI / 2);
    beam.rotateY(ang - Math.PI / 2);
    beam.translate((A.x + B.x) / 2, yTop + dy, (A.z + B.z) / 2);
    b.add('gantry', galv(), beam);
  }
  // Panels face oncoming traffic: inner loop travels +t, so face -t.
  const face = Math.atan2(-p.tx * dir, -p.tz * dir);
  for (const pn of panels) {
    const lat = dir * pn.lat;
    const x = p.x + p.nx * lat - p.tx * dir * 0.25, z = p.z + p.nz * lat - p.tz * dir * 0.25;
    signPanel(b, pn.mat, 'sign' + pn.mat.uuid, x, yTop + 0.55, z, pn.w, pn.h, face);
  }
}

function postSign(b, physics, x, z, y, mat, w, h, face, postH = 2.4) {
  b.add('gantry', galv(), cylAt(0.05, 0.05, postH + h / 2, x, y + (postH + h / 2) / 2, z, 8));
  signPanel(b, mat, 'sign' + mat.uuid, x + Math.sin(face) * 0.06, y + postH + h / 2, z + Math.cos(face) * 0.06, w, h, face);
}

function buildSigns(b, physics) {
  let mile = 1;
  for (const ic of INTERCHANGES) {
    const s0 = sideS(ic.side, ic.u);
    for (const dir of [1, -1]) {
      const loop = dir > 0 ? 'Inner' : 'Outer';
      // Advance guide sign ~1/4 mile out, exit-only sign at the split, gore sign.
      const adv = s0 - dir * 430, at = s0 - dir * (RAMP.len + 6);
      gantry(b, physics, adv, dir, [
        { lat: 9.4, w: 6.4, h: 3.25, mat: SG.exitGuideSign({ exit: ic.exit, street: ic.street, dest: ic.dest, distance: '1/4 MILE' }) },
        { lat: 3.2, w: 3.6, h: 2.45, mat: SG.routeSign(loop, 'down') },
      ]);
      gantry(b, physics, at, dir, [
        { lat: 10.2, w: 6.4, h: 3.25, mat: SG.exitGuideSign({ exit: ic.exit, street: ic.street, dest: ic.dest, arrow: true }) },
        { lat: 3.6, w: 3.6, h: 2.45, mat: SG.routeSign(loop, 'down') },
      ]);
      // Gore sign where the ramp separates.
      const gs = s0 - dir * (RAMP.len - RAMP.flat + 8);
      const gp = ringPoint(gs);
      const lat = dir * (DECK.parapet + 2.2);
      const face = Math.atan2(-gp.tx * dir, -gp.tz * dir);
      postSign(b, physics, gp.x + gp.nx * lat, gp.z + gp.nz * lat, Y, SG.goreSign(ic.exit), 1.6, 1.2, face, 1.4);
      // Speed limit after the merge.
      const sl = s0 + dir * (RAMP.len + 60);
      const sp = ringPoint(sl);
      const slat = dir * (DECK.parapet + 0.5);
      postSign(b, physics, sp.x + sp.nx * slat, sp.z + sp.nz * slat, Y, SG.speedLimit(55), 0.8, 1.0, Math.atan2(-sp.tx * dir, -sp.tz * dir), 1.6);
    }
    // Mile markers on the outer edge between interchanges.
    const mm = ringPoint(s0 + 300);
    postSign(b, physics, mm.x - mm.nx * (DECK.parapet + 0.5), mm.z - mm.nz * (DECK.parapet + 0.5), Y, SG.mileMarker(mile++), 0.3, 0.8, Math.atan2(mm.tx, mm.tz), 1.1);
  }
}
