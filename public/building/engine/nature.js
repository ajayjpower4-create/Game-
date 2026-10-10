/* Trees, shrubs and people.
 *
 * Canopies are clusters of lumpy, leaf-textured masses hung on real branches,
 * so they have depth, gaps and self-shadowing rather than reading as balls on
 * sticks. Every tree is seeded from its id, so no two are quite alike and a
 * tree looks the same every time the site is loaded. */

import * as THREE from 'three';
import * as M from './materials.js';
import { rng } from './textures.js';

/* A few lumpy base shapes, displaced once and reused by scaling. */
const lumps = [];
function lump(i) {
  if (!lumps.length) {
    for (let v = 0; v < 4; v++) {
      const g = new THREE.IcosahedronGeometry(1, 2);
      const p = g.attributes.position;
      const r = rng(31 + v * 17);
      const bumps = Array.from({ length: 9 }, () => [new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), 0.12 + r() * 0.2]);
      const tmp = new THREE.Vector3();
      for (let k = 0; k < p.count; k++) {
        tmp.fromBufferAttribute(p, k);
        let s = 1;
        for (const [dir, amt] of bumps) s += Math.max(0, tmp.dot(dir) - 0.55) * amt * 2.4;
        s += (Math.sin(tmp.x * 7 + v) * Math.cos(tmp.z * 6) * Math.sin(tmp.y * 5)) * 0.06;
        p.setXYZ(k, tmp.x * s, tmp.y * s * 0.92, tmp.z * s);
      }
      g.computeVertexNormals();
      const uv = g.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 9, uv.getY(k) * 5);
      lumps.push(g);
    }
  }
  return lumps[i % lumps.length];
}

function blob(B, mat, x, y, z, rx, ry, rz, v) {
  B.add(lump(v).clone(), mat, { pos: [x, y, z], scale: [rx, ry, rz], rot: [0, v * 1.3, 0] });
}

/* ------------------------------------------------------------------ trees */

/** A broadleaf tree: trunk, limbs and a clustered canopy. */
function broadleaf(B, r, { h, spread, trunkH, barkHex = '#6b5340', leaf = 0, clumps = 7, flat = 0.75 }) {
  const bark = M.bark(barkHex);
  const leaves = M.leaves(leaf);
  const trunkR = Math.max(0.35, spread * 0.035);
  B.cyl(bark, trunkR * 0.7, trunkR, trunkH, 0, trunkH / 2, 0, { seg: 9 });
  B.cyl(bark, trunkR * 1.5, trunkR * 1.05, 0.8, 0, 0.4, 0, { seg: 9 });
  const crownY = trunkH + (h - trunkH) * 0.45;
  const limbs = 4 + Math.floor(r() * 3);
  for (let i = 0; i < limbs; i++) {
    const a = (i / limbs) * Math.PI * 2 + r() * 0.6;
    const reach = spread * (0.22 + r() * 0.16);
    const end = [Math.cos(a) * reach, crownY + (r() - 0.3) * (h - trunkH) * 0.35, Math.sin(a) * reach];
    B.tube(bark, [0, trunkH - 0.5, 0], end, trunkR * 0.45, 6);
  }
  B.tube(bark, [0, trunkH - 0.5, 0], [0, h * 0.8, 0], trunkR * 0.5, 6);
  // Canopy: a central mass with clumps around it.
  const R = spread / 2;
  blob(B, leaves, 0, crownY + R * 0.15, 0, R * 0.72, (h - trunkH) * 0.42, R * 0.72, Math.floor(r() * 4));
  for (let i = 0; i < clumps; i++) {
    const a = (i / clumps) * Math.PI * 2 + r() * 0.8;
    const d = R * (0.42 + r() * 0.25);
    const s = R * (0.38 + r() * 0.2);
    blob(B, leaves, Math.cos(a) * d, crownY + (r() - 0.35) * (h - trunkH) * 0.4, Math.sin(a) * d, s, s * flat, s, i);
  }
  blob(B, leaves, (r() - 0.5) * R * 0.3, h - R * 0.35, (r() - 0.5) * R * 0.3, R * 0.45, R * 0.36, R * 0.45, 2);
}

function conifer(B, r, { h, spread, tiers = 6, trunkH = 3, lean = 0 }) {
  const bark = M.bark('#5a4636');
  const needles = M.needles();
  B.cyl(bark, 0.25, Math.max(0.4, spread * 0.05), h * 0.9, 0, h * 0.45, 0, { seg: 8 });
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const y = trunkH + (h - trunkH) * t;
    const rad = (spread / 2) * (1 - t * 0.85) * (0.9 + r() * 0.2);
    const tierH = ((h - trunkH) / tiers) * 1.7;
    const g = new THREE.ConeGeometry(rad, tierH, 11, 2, true);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const yy = p.getY(k);
      if (yy < 0) {
        const s = 1 + Math.sin(k * 2.7 + i) * 0.12;
        p.setXYZ(k, p.getX(k) * s, yy - Math.abs(Math.sin(k * 1.3)) * 0.4, p.getZ(k) * s);
      }
    }
    g.computeVertexNormals();
    const uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * rad * 2, uv.getY(k) * tierH);
    B.add(g, needles, { pos: [lean * t, y + tierH * 0.35, 0], rot: [0, r() * 3, 0] });
    // A disc closes the underside of each tier.
    B.add(new THREE.CircleGeometry(rad * 0.98, 11).rotateX(Math.PI / 2), needles, { pos: [lean * t, y + tierH * 0.35 - tierH / 2 - 0.2, 0] });
  }
}

function palm(B, r, { h }) {
  const bark = M.bark('#8a7556');
  const frond = M.leaves(1);
  const segs = 9;
  let x = 0;
  let z = 0;
  const bend = (r() - 0.5) * 0.25;
  let top = [0, 0, 0];
  for (let i = 0; i < segs; i++) {
    const y0 = (h * 0.9 * i) / segs;
    const y1 = (h * 0.9 * (i + 1)) / segs;
    const nx = x + bend * (i + 1) * 0.6;
    B.tube(bark, [x, y0, z], [nx, y1, z], 0.75 - i * 0.03, 8);
    B.cyl(bark, 0.82 - i * 0.03, 0.82 - i * 0.03, 0.25, nx, y1, z, { seg: 8 });
    x = nx;
    top = [x, y1, z];
  }
  const n = 10;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + r() * 0.3;
    const len = 9 + r() * 4;
    let prev = top;
    for (let k = 1; k <= 4; k++) {
      const t = k / 4;
      const p = [top[0] + Math.cos(a) * len * t, top[1] + 1.8 * t - 5.5 * t * t, top[2] + Math.sin(a) * len * t];
      const mid = [(prev[0] + p[0]) / 2, (prev[1] + p[1]) / 2, (prev[2] + p[2]) / 2];
      const segLen = Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]);
      const pitch = Math.atan2(p[1] - prev[1], Math.hypot(p[0] - prev[0], p[2] - prev[2]));
      B.box(frond, segLen + 0.3, 0.12, 2.6 * (1 - t * 0.6), mid[0], mid[1], mid[2], [0, -a, pitch]);
      prev = p;
    }
  }
  for (let i = 0; i < 4; i++) B.sphere(M.bark('#5a4a33'), 0.5, top[0] + Math.cos(i * 1.6) * 0.8, top[1] - 0.8, top[2] + Math.sin(i * 1.6) * 0.8, { seg: 7 });
}

/** Build any tree or bush into a Builder, seeded from `seed`. */
export function plant(B, type, seed, o = {}) {
  const r = rng(seed);
  const jitter = 0.85 + r() * 0.3;
  switch (type) {
    case 'tree':
      broadleaf(B, r, { h: 26 * jitter, spread: 18 * jitter, trunkH: 7, leaf: 0 });
      break;
    case 'oak':
      broadleaf(B, r, { h: 38 * jitter, spread: 32 * jitter, trunkH: 9, barkHex: '#5c4a3b', leaf: 0, clumps: 9, flat: 0.7 });
      break;
    case 'maple':
      broadleaf(B, r, { h: 28 * jitter, spread: 21 * jitter, trunkH: 7, leaf: 2, clumps: 8 });
      break;
    case 'birch':
      broadleaf(B, r, { h: 30 * jitter, spread: 12 * jitter, trunkH: 10, barkHex: '#e6e2d8', leaf: 1, clumps: 6, flat: 1.1 });
      break;
    case 'conifer':
      conifer(B, r, { h: 30 * jitter, spread: 12 * jitter, tiers: 7, trunkH: 2.5 });
      break;
    case 'pine': {
      const h = 46 * jitter;
      B.cyl(M.bark('#6b4d36'), 0.45, 0.9, h * 0.85, 0, h * 0.42, 0, { seg: 8 });
      for (let i = 0; i < 6; i++) {
        const a = i * 1.1 + r();
        const y = h * (0.6 + r() * 0.3);
        B.tube(M.bark('#6b4d36'), [0, y - 2, 0], [Math.cos(a) * 4, y, Math.sin(a) * 4], 0.25, 5);
        blob(B, M.needles(), Math.cos(a) * 4, y + 0.6, Math.sin(a) * 4, 3.6, 1.8, 3.6, i);
      }
      blob(B, M.needles(), 0, h * 0.92, 0, 4.5, 3, 4.5, 1);
      break;
    }
    case 'palm':
      palm(B, r, { h: 30 * jitter });
      break;
    case 'shrub': {
      for (let i = 0; i < 4; i++) {
        const a = i * 1.7 + r();
        blob(B, M.leaves(i % 3), Math.cos(a) * 1.4, 1.8, Math.sin(a) * 1.4, 2.2 + r(), 1.7 + r() * 0.5, 2.2 + r(), i);
      }
      break;
    }
    case 'hedge': {
      const L = o.w || 24;
      const D = o.d || 4;
      B.box(M.leaves(0), L - 1, 3.6, D - 1, 0, 1.8, 0);
      for (let x = -L / 2 + 1.5; x < L / 2 - 1; x += 2.2 + r()) {
        blob(B, M.leaves(r() > 0.7 ? 1 : 0), x, 3 + r() * 0.8, (r() - 0.5) * 0.6, 1.8, 1.6, D / 2 - 0.1, Math.floor(r() * 4));
      }
      break;
    }
    default:
      broadleaf(B, r, { h: 24, spread: 16, trunkH: 7 });
  }
}

/* ------------------------------------------------------------------ people */

const SKIN = ['#e8c4a8', '#c99a78', '#8d5e3c', '#f1d2bb', '#5c3b28'];
const SHIRTS = ['#3e6fb0', '#c0392b', '#f1f2f4', '#2f4a3a', '#7a5a2e', '#2b2f36', '#d4a72c', '#6a3d9a'];
const PANTS = ['#2b3442', '#3d3a36', '#1f2226', '#5b4a36', '#31455f'];

/** One standing figure about 5.8 ft tall, facing -z. */
export function person(B, role, seed, x = 0, z = 0, turn = 0) {
  const r = rng(seed);
  const skin = M.plastic(SKIN[Math.floor(r() * SKIN.length)], 0.7);
  let shirt = M.fabric(SHIRTS[Math.floor(r() * SHIRTS.length)]);
  let pants = M.fabric(PANTS[Math.floor(r() * PANTS.length)]);
  if (role === 'guard') { shirt = M.fabric('#1d2735'); pants = M.fabric('#141a24'); }
  if (role === 'worker') pants = M.fabric('#2f3d52');
  const h = 5.5 + r() * 0.6;
  const k = h / 5.8;
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  const P = (px, py, pz) => [x + px * c + pz * s, py, z - px * s + pz * c];
  const leg = new THREE.CapsuleGeometry(0.24 * k, 2.3 * k, 4, 8);
  const arm = new THREE.CapsuleGeometry(0.17 * k, 1.9 * k, 4, 8);
  const stride = (r() - 0.5) * 0.5;
  B.add(leg.clone(), pants, { pos: P(-0.32 * k, 1.45 * k, stride * 0.3), rot: [stride * 0.4, turn, 0] });
  B.add(leg.clone(), pants, { pos: P(0.32 * k, 1.45 * k, -stride * 0.3), rot: [-stride * 0.4, turn, 0] });
  B.add(new THREE.CapsuleGeometry(0.62 * k, 1.35 * k, 4, 10), shirt, { pos: P(0, 3.55 * k, 0), rot: [0, turn, 0], scale: [1, 1, 0.62] });
  B.add(arm.clone(), shirt, { pos: P(-0.88 * k, 3.45 * k, 0), rot: [0.1, turn, 0.12] });
  B.add(arm.clone(), shirt, { pos: P(0.88 * k, 3.45 * k, 0), rot: [-0.1, turn, -0.12] });
  B.sphere(skin, 0.15 * k, ...P(-0.98 * k, 2.25 * k, 0), { seg: 6 });
  B.sphere(skin, 0.15 * k, ...P(0.98 * k, 2.25 * k, 0), { seg: 6 });
  B.cyl(skin, 0.17 * k, 0.2 * k, 0.4 * k, ...P(0, 4.75 * k, 0), { seg: 8 });
  B.sphere(skin, 0.42 * k, ...P(0, 5.25 * k, 0), { sy: 1.15, seg: 12 });
  B.add(new THREE.SphereGeometry(0.45 * k, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), M.fabric(['#2a1f17', '#5a3b22', '#1b1b1b', '#a77d4b'][Math.floor(r() * 4)]), { pos: P(0, 5.3 * k, 0.03), rot: [-0.25, turn, 0] });
  B.box(M.tyre(), 0.5 * k, 0.3 * k, 1 * k, ...P(-0.32 * k, 0.15 * k, -0.15), [0, turn, 0]);
  B.box(M.tyre(), 0.5 * k, 0.3 * k, 1 * k, ...P(0.32 * k, 0.15 * k, -0.15), [0, turn, 0]);
  if (role === 'worker' || role === 'guard') {
    const vest = role === 'worker' ? M.painted('#d6ee2a', 0.6) : M.painted('#c8e02a', 0.6);
    B.add(new THREE.CapsuleGeometry(0.66 * k, 1.0 * k, 4, 10), vest, { pos: P(0, 3.75 * k, 0), rot: [0, turn, 0], scale: [1, 1, 0.66] });
  }
  if (role === 'worker') {
    B.add(new THREE.SphereGeometry(0.52 * k, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.plastic(r() > 0.5 ? '#f4f4f2' : '#f2c018', 0.4), { pos: P(0, 5.45 * k, 0) });
  }
  if (role === 'guard') {
    B.cyl(M.fabric('#141a24'), 0.48 * k, 0.48 * k, 0.3 * k, ...P(0, 5.65 * k, 0), { seg: 12 });
    B.box(M.fabric('#141a24'), 0.7 * k, 0.06, 0.4 * k, ...P(0, 5.52 * k, -0.45 * k), [0, turn, 0]);
  }
}
