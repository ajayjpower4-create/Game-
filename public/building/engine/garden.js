/* Planting: shrubs, perennials, bedding flowers, ornamental grasses and
 * rocks, painted onto the site with a brush over beds of mulch, pine straw or
 * stone.
 *
 * Each kind of plant is modelled once, in a few variants, and every plant on
 * the site is an instance of one of them: a thousand bushes cost a few dozen
 * draw calls. Each plant keeps its own size, turn and leaf shade, and the
 * flowering kinds their own bloom colour.
 *
 * Saved as state.garden = { items: [[kind, x, y, scale, turn, colour], ...],
 * covers: [[kind, x, y, radius], ...] } in plan feet. */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Builder, cylGeo } from './builder.js';
import * as M from './materials.js';
import { rng } from './textures.js';

const PI = Math.PI;
const VARIANTS = 3;

/* Materials by role: tinted per plant (leaves, blades, rock), tinted per
 * bloom (petals), or as they are (stems). */
const LEAF = () => M.foliage(0);
const BLADE = () => M.foliage(9);
const PETAL = () => M.petals();
const ROCK = () => M.rock('#ffffff');
const STEM = () => M.bark('#5d4a36');
const GREEN_STEM = () => M.plastic('#4c6b34', 0.8);

/* ------------------------------------------------------------- shapes */

const lumps = new Map();
/** A lumpy ball (radius about 1), reused by every plant. */
function lump(seed, detail = 1) {
  const key = `${seed}|${detail}`;
  if (!lumps.has(key)) {
    const g = new THREE.IcosahedronGeometry(1, detail);
    const p = g.attributes.position;
    const r = rng(71 + seed * 13);
    const bumps = Array.from({ length: 8 }, () => [new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), 0.1 + r() * 0.22]);
    const v = new THREE.Vector3();
    for (let k = 0; k < p.count; k++) {
      v.fromBufferAttribute(p, k);
      let s = 1;
      for (const [dir, amt] of bumps) s += Math.max(0, v.dot(dir) - 0.5) * amt * 2.2;
      s += Math.sin(v.x * 9 + seed) * Math.cos(v.z * 8) * 0.05;
      p.setXYZ(k, v.x * s, v.y * s, v.z * s);
    }
    g.computeVertexNormals();
    const uv = g.attributes.uv;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * 5, uv.getY(k) * 3);
    lumps.set(key, g);
  }
  return lumps.get(key).clone();
}

/** A rock: a lump pushed about much harder, flat underneath. */
function rockGeo(seed) {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position;
  const r = rng(301 + seed * 7);
  const planes = Array.from({ length: 6 }, () => [new THREE.Vector3(r() - 0.5, r() * 0.8, r() - 0.5).normalize(), 0.62 + r() * 0.25]);
  const v = new THREE.Vector3();
  for (let k = 0; k < p.count; k++) {
    v.fromBufferAttribute(p, k);
    // Facets: cut by a few planes, like a split stone.
    for (const [n, d] of planes) { const t = v.dot(n); if (t > d) v.addScaledVector(n, d - t); }
    if (v.y < -0.35) v.y = -0.35;
    p.setXYZ(k, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** One leaf blade arching out from the crown: a tapered strip. */
function blade(len, width, angle, lean, droop, seg = 4, twist = 0) {
  const pos = [];
  const idx = [];
  const uv = [];
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const out = Math.sin(lean) * len * t + droop * t * t * len * 0.35;
    const up = Math.cos(lean) * len * t - droop * t * t * len * 0.55;
    const w = width * (1 - t * 0.85) * 0.5;
    const tw = twist * t;
    const px = c * out;
    const pz = s * out;
    // Across the blade, at right angles to its direction.
    const ax = -s * Math.cos(tw);
    const az = c * Math.cos(tw);
    const ay = Math.sin(tw);
    pos.push(px + ax * w, up + ay * w, pz + az * w, px - ax * w, up - ay * w, pz - az * w);
    uv.push(0, t * len, width, t * len);
    if (i < seg) { const a = i * 2; idx.push(a, a + 1, a + 3, a, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A broad leaf (hosta), cupped and arched, lying out from the centre. */
function broadLeaf(len, width, angle, tilt) {
  const g = new THREE.PlaneGeometry(width, len, 4, 6);
  const p = g.attributes.position;
  for (let k = 0; k < p.count; k++) {
    let x = p.getX(k);
    const y = p.getY(k) + len / 2;
    const t = y / len;
    // Leaf outline: widest a third of the way, to a point.
    x *= Math.max(0, Math.sin(Math.min(1, Math.max(0, t) * 1.05) * PI)) ** 0.7 * (1 - t * 0.2);
    const cup = (x / (width / 2)) ** 2 * 0.12 * width;
    p.setXYZ(k, x, cup, y);
  }
  g.rotateX(-tilt);
  // Arch: the tip falls away.
  for (let k = 0; k < p.count; k++) {
    const z = p.getZ(k);
    p.setY(k, p.getY(k) - (z / len) ** 2 * len * 0.35);
  }
  g.rotateY(-angle + PI / 2);
  g.computeVertexNormals();
  return g;
}

/** Points over the upper part of an ellipsoid (where flowers sit on a shrub). */
function onMound(r, n, rx, ry, cy, minUp = 0.05) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = r() * PI * 2;
    const up = minUp + r() * (1 - minUp);
    const h = Math.sqrt(1 - up * up);
    out.push([Math.cos(a) * h * rx, cy + up * ry, Math.sin(a) * h * rx, a]);
  }
  return out;
}

/* ------------------------------------------------------------- plants */

/* spacing: feet between plants at normal density; scale: the size range;
 * tint: leaf shades; flowers: bloom colours (one picked per plant). */
export const GARDEN = [
  {
    id: 'boxwood', name: 'Boxwood', icon: '🟢', group: 'Shrubs', spacing: 3, scale: [0.85, 1.15], tint: ['#3d6a2f', '#4a7834', '#36602a', '#43702f'],
    build(B, r) {
      B.add(lump(0, 2), LEAF(), { pos: [0, 1.25, 0], scale: [1.45, 1.2, 1.45] });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * PI * 2 + r();
        B.add(lump(i + 1), LEAF(), { pos: [Math.cos(a) * 0.65, 1.0 + r() * 0.5, Math.sin(a) * 0.65], scale: [0.9, 0.8, 0.9], rot: [0, r() * 3, 0] });
      }
    },
  },
  {
    id: 'azalea', name: 'Azalea', icon: '🌺', group: 'Shrubs', spacing: 3.5, scale: [0.85, 1.2], tint: ['#3f6531', '#4b7236', '#38592c'],
    flowers: ['#e0457b', '#f27aa3', '#f6f2f4', '#c8244e', '#e96a3a'],
    build(B, r) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * PI * 2 + r() * 0.5;
        B.add(lump(i, 1), LEAF(), { pos: [Math.cos(a) * 0.75, 1.0 + r() * 0.3, Math.sin(a) * 0.75], scale: [0.95, 0.75, 0.95], rot: [0, r() * 3, 0] });
      }
      B.add(lump(7, 2), LEAF(), { pos: [0, 1.2, 0], scale: [1.3, 1.0, 1.3] });
      const bloom = new THREE.IcosahedronGeometry(0.17, 0);
      for (const [x, y, z] of onMound(r, 60, 1.62, 1.12, 1.0, 0.1)) B.add(bloom.clone(), PETAL(), { pos: [x, y, z], scale: [1, 0.6, 1], rot: [r(), r(), 0] });
    },
  },
  {
    id: 'hydrangea', name: 'Hydrangea', icon: '💠', group: 'Shrubs', spacing: 4.5, scale: [0.85, 1.15], tint: ['#4e7a3a', '#5a8642', '#46703a'],
    flowers: ['#7fa6e8', '#b691e0', '#f3f1ec', '#ea93bd', '#9fc4f0'],
    build(B, r) {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * PI * 2 + r() * 0.5;
        B.add(lump(i + 2, 1), LEAF(), { pos: [Math.cos(a) * 1.0, 1.3 + r() * 0.5, Math.sin(a) * 1.0], scale: [1.1, 0.95, 1.1], rot: [0, r() * 3, 0] });
      }
      B.add(lump(9, 2), LEAF(), { pos: [0, 1.6, 0], scale: [1.5, 1.3, 1.5] });
      for (const [x, y, z] of onMound(r, 16, 2.0, 1.55, 1.35, 0.15)) B.add(lump(Math.floor(r() * 4) + 20, 1), PETAL(), { pos: [x, y, z], scale: [0.48, 0.4, 0.48] });
    },
  },
  {
    id: 'rose', name: 'Rose bush', icon: '🌹', group: 'Shrubs', spacing: 3.5, scale: [0.85, 1.15], tint: ['#35602e', '#3f6a34', '#2f5428'],
    flowers: ['#c8102e', '#f5b8c6', '#fff1d0', '#e9572f', '#a3123a'],
    build(B, r) {
      const tips = [];
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * PI * 2 + r() * 0.6;
        const tip = [Math.cos(a) * (0.8 + r() * 0.5), 2.4 + r() * 0.9, Math.sin(a) * (0.8 + r() * 0.5)];
        B.tube(GREEN_STEM(), [Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15], tip, 0.05, 5);
        tips.push(tip);
      }
      for (const [x, y, z] of tips) B.add(lump(Math.floor(r() * 6), 1), LEAF(), { pos: [x * 0.85, y - 0.45, z * 0.85], scale: [0.65, 0.55, 0.65] });
      B.add(lump(3, 1), LEAF(), { pos: [0, 1.4, 0], scale: [1.1, 0.9, 1.1] });
      const rose = new THREE.SphereGeometry(0.2, 8, 6);
      for (const [x, y, z] of tips) B.add(rose.clone(), PETAL(), { pos: [x, y + 0.05, z], scale: [1, 0.8, 1] });
      for (const [x, y, z] of onMound(r, 12, 1.25, 1.0, 1.4, 0.3)) B.add(rose.clone(), PETAL(), { pos: [x, y, z], scale: [0.85, 0.7, 0.85] });
    },
  },
  {
    id: 'juniper', name: 'Spreading juniper', icon: '🌿', group: 'Evergreens', spacing: 5.5, scale: [0.85, 1.2], tint: ['#4f7466', '#5a7f6c', '#46695c'],
    build(B, r) {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * PI * 2 + r() * 0.4;
        const d = 1.0 + r() * 1.3;
        B.add(lump(i, 1), LEAF(), { pos: [Math.cos(a) * d, 0.55 + r() * 0.2, Math.sin(a) * d], scale: [1.4, 0.45, 0.85], rot: [0, -a, 0] });
      }
      B.add(lump(11, 2), LEAF(), { pos: [0, 0.8, 0], scale: [1.4, 0.65, 1.4] });
    },
  },
  {
    id: 'arborvitae', name: 'Arborvitae', icon: '🌲', group: 'Evergreens', spacing: 3.5, scale: [0.85, 1.2], tint: ['#2f5a2c', '#386333', '#2a5028'],
    build(B, r) {
      B.add(cylGeo(0.12, 0.18, 1.0, 6), STEM(), { pos: [0, 0.5, 0] });
      for (let i = 0; i < 8; i++) {
        const t = i / 8;
        const rad = 1.5 * (1 - t ** 1.6 * 0.75);
        B.add(lump(i % 6, i < 5 ? 2 : 1), LEAF(), { pos: [(r() - 0.5) * 0.15, 1.3 + i * 1.2, (r() - 0.5) * 0.15], scale: [rad, 1.05, rad], rot: [0, r() * 3, 0] });
      }
      B.add(new THREE.ConeGeometry(0.55, 1.6, 8), LEAF(), { pos: [0, 10.8, 0] });
    },
  },
  {
    id: 'holly', name: 'Holly', icon: '🎄', group: 'Evergreens', spacing: 4.5, scale: [0.85, 1.2], tint: ['#1f4a2a', '#24522e', '#1c4426'],
    flowers: ['#c4161c', '#d61f1f'],
    build(B, r) {
      for (let i = 0; i < 6; i++) {
        const t = i / 6;
        const rad = 2.0 * (1 - t * 0.75);
        B.add(lump(i + 3, 2), LEAF(), { pos: [0, 1.2 + i * 0.95, 0], scale: [rad, 0.95, rad], rot: [0, r() * 3, 0] });
      }
      const berry = new THREE.IcosahedronGeometry(0.07, 0);
      for (let i = 0; i < 40; i++) {
        const y = 0.9 + r() * 5.2;
        const rad = 2.0 * (1 - ((y - 1.2) / 5.7) * 0.75) * 1.02;
        const a = r() * PI * 2;
        B.add(berry.clone(), PETAL(), { pos: [Math.cos(a) * rad, y, Math.sin(a) * rad] });
      }
    },
  },
  {
    id: 'grass', name: 'Ornamental grass', icon: '🌾', group: 'Perennials', spacing: 3.2, scale: [0.85, 1.2], tint: ['#7d9a52', '#8aa45f', '#6f8f4c', '#9aa86a'],
    flowers: ['#dccaa0', '#e8dab8', '#cfae8c', '#d9b5b0'],
    build(B, r) {
      const parts = [];
      for (let i = 0; i < 70; i++) {
        const a = r() * PI * 2;
        const lean = 0.15 + r() * 0.65;
        const g = blade(2.4 + r() * 1.6, 0.11, a, lean, 0.6 + r() * 0.9, 4, (r() - 0.5) * 1.2);
        g.translate(Math.cos(a) * r() * 0.3, 0, Math.sin(a) * r() * 0.3);
        parts.push(g);
      }
      B.add(mergeGeometries(parts, false), BLADE());
      for (let i = 0; i < 14; i++) {
        const a = r() * PI * 2;
        const lean = r() * 0.35;
        const h = 3.6 + r() * 1.2;
        const top = [Math.cos(a) * Math.sin(lean) * h, Math.cos(lean) * h, Math.sin(a) * Math.sin(lean) * h];
        B.tube(GREEN_STEM(), [0, 0, 0], top, 0.02, 4);
        B.add(lump(i % 5), PETAL(), { pos: [top[0], top[1] - 0.25, top[2]], scale: [0.09, 0.5, 0.09], rot: [Math.cos(a) * lean, 0, -Math.sin(a) * lean] });
      }
    },
  },
  {
    id: 'hosta', name: 'Hosta', icon: '🍃', group: 'Perennials', spacing: 2.6, scale: [0.85, 1.2], tint: ['#5f8a69', '#7aa26b', '#4f7a6a', '#93ad5c'],
    build(B, r) {
      const parts = [];
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * PI * 2 + r() * 0.4;
        const g = broadLeaf(1.35 + r() * 0.4, 0.85 + r() * 0.25, a, 0.35 + r() * 0.6);
        g.translate(0, 0.25 + r() * 0.35, 0);
        parts.push(g);
      }
      B.add(mergeGeometries(parts, false), BLADE());
    },
  },
  {
    id: 'lavender', name: 'Lavender', icon: '💜', group: 'Perennials', spacing: 2.4, scale: [0.85, 1.15], tint: ['#7d9078', '#8a9a83', '#73876f'],
    flowers: ['#8a6cc4', '#9b7bd1', '#7a5db5'],
    build(B, r) {
      B.add(lump(4, 1), LEAF(), { pos: [0, 0.55, 0], scale: [1.0, 0.6, 1.0] });
      const spike = cylGeo(0.035, 0.06, 0.38, 5);
      for (let i = 0; i < 46; i++) {
        const a = r() * PI * 2;
        const lean = 0.1 + r() * 0.5;
        const h = 1.6 + r() * 0.5;
        const top = [Math.cos(a) * Math.sin(lean) * h, Math.cos(lean) * h, Math.sin(a) * Math.sin(lean) * h];
        B.tube(GREEN_STEM(), [Math.cos(a) * 0.2, 0.5, Math.sin(a) * 0.2], top, 0.012, 3);
        B.add(spike.clone(), PETAL(), { pos: top, rot: [Math.sin(a) * lean, 0, -Math.cos(a) * lean] });
      }
    },
  },
  {
    id: 'daylily', name: 'Daylilies', icon: '🌼', group: 'Perennials', spacing: 2.4, scale: [0.85, 1.15], tint: ['#5d8a3c', '#6b9444', '#527e36'],
    flowers: ['#f08a1c', '#f7c22b', '#e0502a', '#f3d36b'],
    build(B, r) {
      const parts = [];
      for (let i = 0; i < 36; i++) {
        const a = r() * PI * 2;
        parts.push(blade(1.6 + r() * 0.8, 0.16, a, 0.3 + r() * 0.5, 1.0 + r() * 0.8, 4));
      }
      B.add(mergeGeometries(parts, false), BLADE());
      const trumpet = new THREE.ConeGeometry(0.24, 0.32, 6, 1, true).rotateX(PI);
      for (let i = 0; i < 9; i++) {
        const a = r() * PI * 2;
        const lean = r() * 0.4;
        const h = 2.2 + r() * 0.6;
        const top = [Math.cos(a) * Math.sin(lean) * h, Math.cos(lean) * h, Math.sin(a) * Math.sin(lean) * h];
        B.tube(GREEN_STEM(), [0, 0, 0], top, 0.025, 4);
        B.add(trumpet.clone(), PETAL(), { pos: [top[0], top[1] + 0.1, top[2]], rot: [0.5 * Math.sin(a), 0, -0.5 * Math.cos(a)] });
      }
    },
  },
  {
    id: 'annuals', name: 'Bedding flowers', icon: '🌸', group: 'Flowers', spacing: 0.9, scale: [0.85, 1.15], tint: ['#3f6e2f', '#4a7a36', '#3a6230'],
    flowers: ['#e8344a', '#f6d23a', '#f08c1e', '#ffffff', '#c94fc0', '#ef7fb0', '#6a5bd6'],
    build(B, r) {
      B.add(lump(Math.floor(r() * 6)), LEAF(), { pos: [0, 0.32, 0], scale: [0.5, 0.32, 0.5] });
      const flower = new THREE.CircleGeometry(0.11, 6).rotateX(-PI / 2);
      for (const [x, y, z] of onMound(r, 11, 0.47, 0.32, 0.3, 0.35)) B.add(flower.clone(), PETAL(), { pos: [x, y + 0.04, z], rot: [(r() - 0.5) * 0.6, r() * 3, (r() - 0.5) * 0.6] });
    },
  },
  {
    id: 'tulips', name: 'Tulips', icon: '🌷', group: 'Flowers', spacing: 0.75, scale: [0.85, 1.15], tint: ['#5b8a4a', '#6a9655', '#4f7d42'],
    flowers: ['#d8202e', '#f6c524', '#f07aa6', '#ffffff', '#8b3fb5', '#f2771e'],
    build(B, r) {
      const cup = new THREE.CylinderGeometry(0.15, 0.09, 0.3, 8, 1, true);
      for (let i = 0; i < 3; i++) {
        const x = (r() - 0.5) * 0.4;
        const z = (r() - 0.5) * 0.4;
        const h = 1.1 + r() * 0.35;
        B.tube(GREEN_STEM(), [x, 0, z], [x, h, z], 0.025, 4);
        B.add(cup.clone(), PETAL(), { pos: [x, h + 0.15, z] });
        B.add(new THREE.SphereGeometry(0.1, 8, 4, 0, PI * 2, PI / 2, PI / 2), PETAL(), { pos: [x, h + 0.01, z] });
        const a = r() * PI * 2;
        B.add(blade(0.8, 0.22, a, 0.25, 0.3, 3), BLADE(), { pos: [x, 0, z] });
      }
    },
  },
  {
    id: 'boulder', name: 'Boulders', icon: '🪨', group: 'Rocks', spacing: 6, scale: [0.6, 1.5], tint: ['#8f8b84', '#9c958a', '#7f7c78', '#a89a86'],
    build(B, r, v) {
      B.add(rockGeo(v), ROCK(), { pos: [0, 0.75, 0], scale: [2.2, 1.6, 1.7], rot: [0, r() * 3, 0] });
    },
  },
  {
    id: 'stones', name: 'Landscape stones', icon: '⚪', group: 'Rocks', spacing: 2.2, scale: [0.7, 1.3], tint: ['#a49e94', '#8a857e', '#b5a993', '#9a8f80'],
    build(B, r, v) {
      for (let i = 0; i < 3; i++) {
        const s = 0.35 + r() * 0.4;
        B.add(rockGeo(v * 3 + i + 10), ROCK(), { pos: [(r() - 0.5) * 1.4, s * 0.3, (r() - 0.5) * 1.4], scale: [s * 1.2, s * 0.8, s], rot: [0, r() * 3, 0] });
      }
    },
  },
];

export const GARDEN_BY_ID = Object.fromEntries(GARDEN.map((k) => [k.id, k]));
export const GARDEN_GROUPS = [...new Set(GARDEN.map((k) => k.group))];
export const COVERS = Object.entries(M.GROUND_COVERS).map(([id, c]) => ({ id, ...c }));
export const COVER_BY_ID = Object.fromEntries(COVERS.map((c) => [c.id, c]));

/* ------------------------------------------------------------- kits */

const kits = new Map();
/** The variants of one kind, each as parts merged per material. */
function kit(id) {
  if (kits.has(id)) return kits.get(id);
  const k = GARDEN_BY_ID[id];
  const tinted = new Set([LEAF(), BLADE(), ROCK()]);
  const out = [];
  for (let v = 0; v < VARIANTS; v++) {
    const B = new Builder();
    k.build(B, rng(1000 + v * 97 + id.length * 13), v);
    const parts = [];
    for (const [mat, geos] of B.parts) {
      const clean = geos.map((g) => (g.index ? g : g.toNonIndexed ? indexed(g) : g));
      const geo = clean.length === 1 ? clean[0] : mergeGeometries(clean, false);
      if (!geo) continue;
      geo.computeBoundingSphere();
      parts.push({ geo, mat, role: mat === PETAL() ? 'bloom' : tinted.has(mat) ? 'tint' : null });
    }
    out.push(parts);
  }
  kits.set(id, out);
  return out;
}

function indexed(g) {
  const n = g.attributes.position.count;
  g.setIndex(Array.from({ length: n }, (_, i) => i));
  return g;
}

/* ------------------------------------------------------------- the scene */

/** Build every plant and bed of ground cover as a group of instanced meshes. */
export function buildGarden(garden) {
  const group = new THREE.Group();
  group.userData.noPick = true;
  if (!garden) return group;
  // Ground covers first: one mesh per kind, beds as rough-edged discs.
  const byCover = new Map();
  for (const c of garden.covers || []) {
    if (!COVER_BY_ID[c[0]]) continue;
    if (!byCover.has(c[0])) byCover.set(c[0], []);
    byCover.get(c[0]).push(c);
  }
  COVERS.forEach((cv, ci) => {
    const list = byCover.get(cv.id);
    if (!list) return;
    const pos = [];
    const nor = [];
    const uv = [];
    const idx = [];
    const y = 0.07 + ci * 0.006;
    for (const [, x, z, rad] of list) {
      const n = Math.max(14, Math.min(40, Math.round(rad * 3)));
      const r = rng(Math.round(x * 31 + z * 17 + rad * 7));
      const base = pos.length / 3;
      pos.push(x, y, z); nor.push(0, 1, 0); uv.push(x, -z);
      const wob = Array.from({ length: 4 }, () => [r() * PI * 2, 0.03 + r() * 0.05, 2 + Math.floor(r() * 4)]);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * PI * 2;
        let rr = rad;
        for (const [ph, amp, f] of wob) rr += Math.sin(a * f + ph) * amp * rad;
        const px = x + Math.cos(a) * rr;
        const pz = z + Math.sin(a) * rr;
        pos.push(px, y, pz); nor.push(0, 1, 0); uv.push(px, -pz);
        idx.push(base, base + 1 + ((k + 1) % n), base + 1 + k);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, M.groundCover(cv.id));
    mesh.receiveShadow = true;
    mesh.userData.noPick = true;
    mesh.userData.own = true;
    group.add(mesh);
  });
  // Plants: instances of each kind's variants.
  const per = new Map();
  for (const it of garden.items || []) {
    const k = GARDEN_BY_ID[it[0]];
    if (!k) continue;
    const v = hash(it[1], it[2]) % VARIANTS;
    const key = `${it[0]}|${v}`;
    if (!per.has(key)) per.set(key, { id: it[0], v, list: [] });
    per.get(key).list.push(it);
  }
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();
  for (const { id, v, list } of per.values()) {
    const k = GARDEN_BY_ID[id];
    for (const part of kit(id)[v]) {
      const mesh = new THREE.InstancedMesh(part.geo, part.mat, list.length);
      list.forEach((it, i) => {
        const [, x, z, s = 1, turn = 0, c = 0] = it;
        q.setFromAxisAngle(up, (turn * PI) / 180);
        sc.setScalar(s);
        p.set(x, 0.02, z);
        m.compose(p, q, sc);
        mesh.setMatrixAt(i, m);
        if (part.role === 'tint') {
          const h = hash(x * 3, z * 5);
          col.set(k.tint[h % k.tint.length]);
          col.multiplyScalar(0.92 + ((h >> 4) % 17) / 100);
          mesh.setColorAt(i, col);
        } else if (part.role === 'bloom') {
          const fl = k.flowers || ['#ffffff'];
          mesh.setColorAt(i, col.set(fl[((c % fl.length) + fl.length) % fl.length]));
        }
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      mesh.userData.noPick = true;
      group.add(mesh);
    }
  }
  return group;
}

/** Free a garden group (the shared plant shapes stay cached). */
export function releaseGarden(group) {
  for (const o of group.children) {
    if (o.isInstancedMesh) o.dispose();
    else if (o.userData.own) o.geometry.dispose();
  }
}

function hash(a, b) {
  let h = (Math.round(a * 10) * 73856093) ^ (Math.round(b * 10) * 19349663);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
}

/** A cheap fingerprint of the garden, so the scene rebuilds only on change. */
export function gardenSig(garden) {
  if (!garden) return '0';
  let h = 0;
  for (const it of garden.items || []) h = (h * 31 + hash(it[1], it[2]) + (it[0].length * 7 + it[3] * 100 + it[5])) % 2147483647;
  for (const c of garden.covers || []) h = (h * 31 + hash(c[1], c[2]) + c[3] * 10 + c[0].length) % 2147483647;
  return `${(garden.items || []).length}|${(garden.covers || []).length}|${h}`;
}

/* ------------------------------------------------------------- the brush */

const r1 = (v) => Math.round(v * 10) / 10;

/**
 * Plant one dab of the brush: plants of `kind` scattered in a circle,
 * clear of each other and of anything `blocked` says no to. A brush smaller
 * than one plant puts a single plant at the centre. Returns how many went in.
 */
export function stamp(garden, kind, cx, cy, radius, density, blocked, seed) {
  const k = GARDEN_BY_ID[kind];
  if (!k) return 0;
  const r = rng(seed >>> 0 || 1);
  const sp = k.spacing / Math.sqrt(density);
  const near = grid(garden.items, 8);
  const clear = (x, y) => {
    if (blocked(x, y)) return false;
    for (const o of near.around(x, y)) {
      const ok = GARDEN_BY_ID[o[0]];
      const need = o[0] === kind ? sp * 0.85 : ((ok ? ok.spacing : 2) + k.spacing) * 0.35;
      if (Math.hypot(o[1] - x, o[2] - y) < need) return false;
    }
    return true;
  };
  const add = (x, y) => {
    const it = [kind, r1(x), r1(y), Math.round((k.scale[0] + r() * (k.scale[1] - k.scale[0])) * 100) / 100, Math.round(r() * 360), Math.floor(r() * 64)];
    garden.items.push(it);
    near.put(it);
  };
  if (radius < sp * 0.7) {
    if (!clear(cx, cy)) return 0;
    add(cx, cy);
    return 1;
  }
  const tries = Math.ceil(((PI * radius * radius) / (sp * sp)) * 2.2) + 3;
  let n = 0;
  for (let t = 0; t < tries; t++) {
    const a = r() * PI * 2;
    const d = Math.sqrt(r()) * radius;
    const x = cx + Math.cos(a) * d;
    const y = cy + Math.sin(a) * d;
    if (!clear(x, y)) continue;
    add(x, y);
    n++;
  }
  return n;
}

/** Lay a bed of ground cover under the brush (skipped where one already is). */
export function coverStamp(garden, kind, cx, cy, radius) {
  for (const c of garden.covers) {
    if (c[0] === kind && Math.hypot(c[1] - cx, c[2] - cy) < c[3] * 0.4 && c[3] >= radius * 0.8) return 0;
  }
  garden.covers.push([kind, r1(cx), r1(cy), r1(radius)]);
  return 1;
}

/** Take out plants (and, if asked, ground cover) under the brush. */
export function erase(garden, cx, cy, radius, { plants = true, covers = true } = {}) {
  const before = garden.items.length + garden.covers.length;
  if (plants) garden.items = garden.items.filter((it) => Math.hypot(it[1] - cx, it[2] - cy) > radius);
  if (covers) garden.covers = garden.covers.filter((c) => Math.hypot(c[1] - cx, c[2] - cy) > radius + c[3] * 0.25);
  return before - garden.items.length - garden.covers.length;
}

/** A clean garden from whatever was saved. */
export function normalizeGarden(g) {
  const out = { items: [], covers: [] };
  if (!g || typeof g !== 'object') return out;
  for (const it of Array.isArray(g.items) ? g.items : []) {
    if (Array.isArray(it) && GARDEN_BY_ID[it[0]] && Number.isFinite(+it[1]) && Number.isFinite(+it[2])) {
      out.items.push([it[0], +it[1], +it[2], +it[3] || 1, +it[4] || 0, +it[5] || 0]);
    }
  }
  for (const c of Array.isArray(g.covers) ? g.covers : []) {
    if (Array.isArray(c) && COVER_BY_ID[c[0]] && Number.isFinite(+c[1]) && Number.isFinite(+c[2]) && +c[3] > 0) out.covers.push([c[0], +c[1], +c[2], +c[3]]);
  }
  return out;
}

/** A simple spatial hash over plants, for spacing checks. */
function grid(items, cell) {
  const map = new Map();
  const key = (x, y) => `${Math.floor(x / cell)}|${Math.floor(y / cell)}`;
  const put = (it) => {
    const kk = key(it[1], it[2]);
    if (!map.has(kk)) map.set(kk, []);
    map.get(kk).push(it);
  };
  for (const it of items) put(it);
  return {
    put,
    *around(x, y) {
      const gx = Math.floor(x / cell);
      const gy = Math.floor(y / cell);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) yield* map.get(`${gx + i}|${gy + j}`) || [];
    },
  };
}
