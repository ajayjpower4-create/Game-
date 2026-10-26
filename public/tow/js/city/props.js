// Street furniture, instanced: cobra-head street lights, traffic signals on
// mast arms (they cycle), stop signs, street-name blades, hydrants, benches,
// trash cans, mailboxes and trees.
import * as THREE from 'three';
import * as TX from '../textures.js';
import { Buckets, cylAt, boxAt } from './geom.js';
import { GRID, ARTERIAL, halfWidthAt, CURB, SIDEWALK, NS_NAMES, EW_NAMES, BAY_X, PARKWAY } from './layout.js';
import * as SG from './signs.js';
import { Rng, mulberry32 } from '../util.js';

const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();

class Instancer {
  constructor(geo, mat, cap, { cast = true } = {}) {
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.count = 0;
    this.mesh.castShadow = cast;
    this.mesh.receiveShadow = true;
  }
  add(x, y, z, rotY = 0, s = 1, sy = s) {
    const i = this.mesh.count++;
    tmpQ.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, rotY);
    tmpM.compose(tmpP.set(x, y, z), tmpQ, tmpS.set(s, sy, s));
    this.mesh.setMatrixAt(i, tmpM);
    return i;
  }
  finish(parent) {
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.computeBoundingSphere();
    parent.add(this.mesh);
    return this.mesh;
  }
}

function treeGeos(seed) {
  const rand = mulberry32(seed);
  const trunk = new THREE.CylinderGeometry(0.14, 0.24, 3.2, 8);
  trunk.translate(0, 1.6, 0);
  // Canopy: a cluster of jittered icospheres.
  const blobs = [];
  for (let i = 0; i < 5; i++) {
    const g = new THREE.IcosahedronGeometry(1.4 + rand() * 0.8, 1);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, k);
      v.multiplyScalar(1 + (rand() - 0.5) * 0.28);
      p.setXYZ(k, v.x, v.y, v.z);
    }
    g.translate((rand() - 0.5) * 2.2, 4.2 + rand() * 1.8, (rand() - 0.5) * 2.2);
    blobs.push(g);
  }
  const canopy = mergeIndexed(blobs);
  canopy.computeVertexNormals();
  return { trunk, canopy };
}

function mergeIndexed(geos) {
  const parts = geos.map((g) => g.index ? g.toNonIndexed() : g);
  let n = 0;
  for (const g of parts) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return out;
}

export function buildProps(root, physics, info) {
  const rng = new Rng(777);
  const b = new Buckets();
  const metal = new THREE.MeshStandardMaterial({ color: 0x8a9096, metalness: 0.85, roughness: 0.42 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x2a2d30, metalness: 0.6, roughness: 0.5 });
  const yellowMetal = new THREE.MeshStandardMaterial({ color: 0xd4a017, metalness: 0.4, roughness: 0.5 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xe8e4da, emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 0.3 });

  // ---------------------------------------------------- street lights
  const poleG = new THREE.CylinderGeometry(0.08, 0.13, 9, 10); poleG.translate(0, 4.5, 0);
  const armG = new THREE.BoxGeometry(0.1, 0.1, 2.6); armG.translate(0, 8.7, 1.25);
  const headG = new THREE.BoxGeometry(0.42, 0.16, 0.8); headG.translate(0, 8.62, 2.6);
  const lights = { pole: new Instancer(poleG, metal, 1400), arm: new Instancer(armG, metal, 1400), head: new Instancer(headG, lampMat, 1400, { cast: false }) };
  const N = GRID.length, lo = GRID[0], hi = GRID[N - 1];
  const nearIntersection = (a) => GRID.some((g) => Math.abs(a - g) < halfWidthAt(g) + 9);
  for (const c of GRID) {
    const hw = halfWidthAt(c);
    const spacing = ARTERIAL.has(c) ? 30 : 38;
    for (let a = lo - 10; a <= hi + 10; a += spacing) {
      if (nearIntersection(a)) continue;
      for (const side of [-1, 1]) {
        if (!ARTERIAL.has(c) && side === ((Math.round(a / spacing) % 2) ? 1 : -1)) continue;
        // NS street at x=c: pole on the curb edge, arm reaching over the road.
        const off = hw + 0.7;
        lightAt(c + side * off, a, side > 0 ? -Math.PI / 2 : Math.PI / 2);
        lightAt(a, c + side * off, side > 0 ? Math.PI : 0);
      }
    }
  }
  function lightAt(x, z, rot) {
    if (Math.abs(x) > hi + 12 || Math.abs(z) > hi + 12) return;
    lights.pole.add(x, CURB, z, rot);
    lights.arm.add(x, CURB, z, rot);
    lights.head.add(x, CURB, z, rot);
    physics?.cylinder(x, CURB + 2, z, 0.14, 2);
  }
  // Parkway lights.
  for (let s = 0; s < 4 * 1135; s += 45) {
    // handled by the parkway path below
  }

  // ------------------------------------------------- signals & stops
  const sig = {
    phase: 0,
    mats: {},
  };
  for (const axis of ['ns', 'ew']) {
    for (const [col, hex] of [['r', 0xff2a1a], ['y', 0xffb000], ['g', 0x2aff7a]]) {
      sig.mats[axis + col] = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: hex, emissiveIntensity: 0, roughness: 0.3 });
    }
  }
  const mastPoleG = new THREE.CylinderGeometry(0.13, 0.17, 6.8, 12); mastPoleG.translate(0, 3.4, 0);
  const signalHousingG = new THREE.BoxGeometry(0.38, 1.05, 0.3);
  const lensG = new THREE.CircleGeometry(0.11, 16);
  const visorG = new THREE.CylinderGeometry(0.13, 0.13, 0.18, 12, 1, true, 0, Math.PI); visorG.rotateX(Math.PI / 2);
  const inst = {
    pole: new Instancer(mastPoleG, darkMetal, 400),
    housing: new Instancer(signalHousingG, darkMetal, 800),
  };
  const lens = {};
  for (const k of Object.keys(sig.mats)) lens[k] = new Instancer(lensG, sig.mats[k], 800, { cast: false });
  const stopPoleG = new THREE.CylinderGeometry(0.035, 0.035, 2.9, 8); stopPoleG.translate(0, 1.45, 0);
  const stopG = new THREE.CircleGeometry(0.38, 8); stopG.rotateZ(Math.PI / 8); stopG.translate(0, 2.6, 0.03);
  const stopI = { pole: new Instancer(stopPoleG, metal, 600), sign: new Instancer(stopG, SG.stopSign(), 600, { cast: false }) };
  const signalized = [];

  for (const x of GRID) for (const z of GRID) {
    const ax = ARTERIAL.has(x), az = ARTERIAL.has(z);
    const hx = halfWidthAt(x), hz = halfWidthAt(z);
    if (ax || az) {
      signalized.push({ x, z });
      // Four corner poles; each arm reaches over the lanes approaching it.
      // Approach from the north (heading +z) uses the NW... we place one per approach
      // on the far-right corner as in US practice.
      const approaches = [
        { axis: 'ns', dir: [0, 1], corner: [-hx - 0.8, hz + 0.8] },   // southbound: far-right = SW? (right of +z is -x)
        { axis: 'ns', dir: [0, -1], corner: [hx + 0.8, -hz - 0.8] },
        { axis: 'ew', dir: [1, 0], corner: [hx + 0.8, hz + 0.8] },
        { axis: 'ew', dir: [-1, 0], corner: [-hx - 0.8, -hz - 0.8] },
      ];
      for (const ap of approaches) {
        const px = x + ap.corner[0], pz = z + ap.corner[1];
        inst.pole.add(px, CURB, pz);
        physics?.cylinder(px, CURB + 3, pz, 0.18, 3);
        // Arm extends back across the approach lanes (toward the left of travel).
        const left = [-ap.dir[1], ap.dir[0]].map((v) => -v); // vector pointing across the road from the right curb
        const armLen = (ap.axis === 'ns' ? hx : hz) + 0.6;
        const ang = Math.atan2(left[0], left[1]);
        const arm = new THREE.CylinderGeometry(0.07, 0.09, armLen, 8);
        arm.rotateX(Math.PI / 2);
        arm.translate(0, 0, armLen / 2);
        arm.rotateY(ang);
        arm.translate(px, CURB + 6.4, pz);
        b.add('darkMetal', darkMetal, arm);
        // Heads hang from the arm over each lane, facing oncoming traffic.
        const faceRot = Math.atan2(-ap.dir[0], -ap.dir[1]);
        const art = ap.axis === 'ns' ? ax : az;
        const hwA = ap.axis === 'ns' ? hx : hz;
        const laneCenters = art ? [5.1, 1.7] : [1.7];
        for (const lc of laneCenters) {
          const d = hwA + 0.8 - lc;
          const hxp = px + left[0] * d, hzp = pz + left[1] * d;
          inst.housing.add(hxp, CURB + 5.7, hzp, faceRot);
          for (const [col, dy] of [['r', 0.32], ['y', 0], ['g', -0.32]]) {
            lens[ap.axis + col].add(hxp - ap.dir[0] * 0.16, CURB + 5.7 + dy, hzp - ap.dir[1] * 0.16, faceRot);
          }
        }
        // Street name blades on this pole.
        bladeAt(px, pz, x, z);
      }
    } else {
      // All-way stop.
      const approaches = [[0, 1, -hx - 0.6, -hz - 0.6], [0, -1, hx + 0.6, hz + 0.6], [1, 0, -hx - 0.6, hz + 0.6], [-1, 0, hx + 0.6, -hz - 0.6]];
      for (const [dx, dz, ox, oz] of approaches) {
        const px = x + ox, pz = z + oz;
        const faceRot = Math.atan2(-dx, -dz);
        stopI.pole.add(px, CURB, pz);
        stopI.sign.add(px, CURB, pz, faceRot);
        physics?.cylinder(px, CURB + 1.4, pz, 0.05, 1.4);
      }
      bladeAt(x - hx - 0.6, z - hz - 0.6, x, z);
    }
  }
  function bladeAt(px, pz, x, z) {
    const iN = GRID.indexOf(x), iE = GRID.indexOf(z);
    if (iN < 0 || iE < 0) return;
    // Blade along the NS street (readable from the EW street) and vice versa.
    for (const [name, rot, dy] of [[NS_NAMES[iN], Math.PI / 2, 0], [EW_NAMES[iE], 0, 0.2]]) {
      const g = new THREE.PlaneGeometry(1.1, 0.2);
      g.rotateY(rot);
      g.translate(px, CURB + 3.2 + dy, pz);
      const m = SG.streetBlade(name);
      b.add('blade' + name, m, g);
    }
  }

  // ------------------------------------------------- small furniture
  const hydrantG = (() => {
    const parts = [new THREE.CylinderGeometry(0.13, 0.16, 0.6, 12).translate(0, 0.3, 0), new THREE.SphereGeometry(0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.6, 0), new THREE.CylinderGeometry(0.05, 0.05, 0.42, 8).rotateZ(Math.PI / 2).translate(0, 0.4, 0)];
    return mergeIndexed(parts);
  })();
  hydrantG.computeVertexNormals();
  const hydI = new Instancer(hydrantG, new THREE.MeshStandardMaterial({ color: 0xc8211b, roughness: 0.5, metalness: 0.2 }), 600);
  const canG = new THREE.CylinderGeometry(0.3, 0.27, 0.95, 14); canG.translate(0, 0.475, 0);
  const canI = new Instancer(canG, new THREE.MeshStandardMaterial({ color: 0x2f4f3a, roughness: 0.6, metalness: 0.4 }), 500);
  const mailG = mergeIndexed([new THREE.BoxGeometry(0.5, 0.75, 0.55).translate(0, 0.62, 0), new THREE.CylinderGeometry(0.25, 0.25, 0.55, 14, 1, false, 0, Math.PI).rotateX(Math.PI / 2).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(0, 1.0, 0)]);
  mailG.computeVertexNormals();
  const mailI = new Instancer(mailG, new THREE.MeshStandardMaterial({ color: 0x1d4f91, roughness: 0.45, metalness: 0.3 }), 200);
  const benchG = mergeIndexed([new THREE.BoxGeometry(1.8, 0.06, 0.45).translate(0, 0.45, 0), new THREE.BoxGeometry(1.8, 0.45, 0.06).translate(0, 0.72, -0.22), new THREE.BoxGeometry(0.06, 0.45, 0.4).translate(-0.8, 0.22, 0), new THREE.BoxGeometry(0.06, 0.45, 0.4).translate(0.8, 0.22, 0)]);
  benchG.computeVertexNormals();
  const benchI = new Instancer(benchG, new THREE.MeshStandardMaterial({ color: 0x3b2a1e, roughness: 0.8 }), 300);
  const meterG = mergeIndexed([new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6).translate(0, 0.6, 0), new THREE.BoxGeometry(0.16, 0.28, 0.12).translate(0, 1.3, 0)]);
  meterG.computeVertexNormals();
  const meterI = new Instancer(meterG, darkMetal, 1500);

  for (const blk of info.blocks) {
    // Hydrant near one corner, can at another, a mailbox sometimes, meters on locals.
    hydI.add(blk.x0 + 1.0, CURB, blk.z0 + 7 + rng.next() * 6);
    physics?.cylinder(blk.x0 + 1.0, CURB + 0.3, blk.z0 + 7, 0.16, 0.3);
    canI.add(blk.x1 - 1.0, CURB, blk.z1 - 6);
    if (rng.chance(0.35)) mailI.add(blk.x1 - 1.0, CURB, blk.z0 + 9, -Math.PI / 2);
    for (const side of ['n', 's']) {
      const z = side === 'n' ? blk.z0 + 0.6 : blk.z1 - 0.6;
      const streetZ = side === 'n' ? GRID[blk.j] : GRID[blk.j + 1];
      if (ARTERIAL.has(streetZ)) continue;
      for (let x = blk.x0 + 9; x < blk.x1 - 9; x += 6.5) meterI.add(x, CURB, z, side === 'n' ? 0 : Math.PI);
    }
  }
  for (const s of info.benchSpots) benchI.add(s.x, CURB, s.z, s.rot);

  // --------------------------------------------------------- trees
  const leafTex = TX.leafCluster('#4d7a34', 3);
  const barkSet = TX.bark();
  const variants = [1, 2, 3].map((seed, i) => {
    const g = treeGeos(seed * 13);
    const trunkMat = new THREE.MeshStandardMaterial({ ...barkSet, roughness: 0.95 });
    const tint = [0x5d8a3a, 0x4a7a33, 0x6b8f3c][i];
    const leafMat = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.92, flatShading: false, map: leafTex.map });
    return { trunk: new Instancer(g.trunk, trunkMat, 5000), canopy: new Instancer(g.canopy, leafMat, 5000) };
  });
  const pitG = new THREE.PlaneGeometry(1.3, 1.3); pitG.rotateX(-Math.PI / 2);
  const pitI = new Instancer(pitG, new THREE.MeshStandardMaterial({ color: 0x3a2c20, roughness: 1 }), 2000, { cast: false });
  const placeTree = (x, z, y, s) => {
    const v = variants[rng.int(0, 2)];
    const rot = rng.next() * Math.PI * 2;
    v.trunk.add(x, y, z, rot, s);
    v.canopy.add(x, y, z, rot, s);
  };
  for (const t of info.treeSpots) {
    placeTree(t.x, t.z, t.y ?? 0, t.s);
    if (t.pit) pitI.add(t.x, CURB + 0.006, t.z);
    physics?.cylinder(t.x, (t.y ?? 0) + 1.2, t.z, 0.22 * t.s, 1.2);
  }
  // Woods around the outskirts (keep clear of roads, the bay and the ring).
  let placed = 0;
  for (let k = 0; k < 9000 && placed < 2600; k++) {
    const x = rng.range(-1500, BAY_X - 20), z = rng.range(-1500, 1500);
    const m = Math.max(Math.abs(x), Math.abs(z));
    if (m < PARKWAY.half + 22) {
      // Between the ring and the parkway: only sparse trees away from ramps/arterials.
      if (m < 640 || Math.abs(x - 240) < 30 || Math.abs(x + 240) < 30 || Math.abs(z - 240) < 30 || Math.abs(z + 240) < 30 || Math.abs(x) < 70 || Math.abs(z) < 90 || rng.chance(0.75)) continue;
    }
    if (info.solids.some((s) => x > s.x0 - 6 && x < s.x1 + 6 && z > s.z0 - 6 && z < s.z1 + 6)) continue;
    const s = 1 + rng.next() * 0.9;
    placeTree(x, z, 0, s);
    physics?.cylinder(x, 1.2, z, 0.22 * s, 1.2);
    placed++;
  }

  for (const i of [lights.pole, lights.arm, lights.head, inst.pole, inst.housing, stopI.pole, stopI.sign, hydI, canI, mailI, benchI, meterI, pitI]) i.finish(root);
  for (const l of Object.values(lens)) l.finish(root);
  for (const v of variants) { v.trunk.finish(root); v.canopy.finish(root); }
  b.build(root, { name: 'props-' });

  return { signals: sig, signalized, lampMat };
}

// Signal timing shared by every intersection (they're coordinated).
// Returns the light for an axis: 'g' | 'y' | 'r'.
export function signalState(t, axis) {
  const cycle = 44, green = 18, yellow = 3.5;
  const p = t % cycle;
  const nsState = p < green ? 'g' : p < green + yellow ? 'y' : 'r';
  const q = (p + cycle / 2) % cycle;
  const ewState = q < green ? 'g' : q < green + yellow ? 'y' : 'r';
  return axis === 'ns' ? nsState : ewState;
}

export function updateSignals(sig, t) {
  for (const axis of ['ns', 'ew']) {
    const s = signalState(t, axis);
    for (const c of ['r', 'y', 'g']) sig.mats[axis + c].emissiveIntensity = s === c ? 2.2 : 0;
  }
}
