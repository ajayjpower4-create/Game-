// Parametric car bodies.
//
// A body is lofted through ~140 cross-sections along its length. Each
// section is a rounded rectangle whose bottom follows the rocker line and
// rises over the wheels, so the wheel arches are real cut-outs. A second
// loft — the greenhouse — sits on the beltline and is split into glass,
// roof and pillars by where each face lands. Lights, grilles and plates are
// grids projected onto the finished surface so they wrap the corners the way
// real lamps do. The hood is a separate panel on a hinge with an engine bay
// (and battery) underneath, because the player opens it on jump-start calls.
import * as THREE from 'three';
import { monotone } from './curves.js';
import { buildWheel, mergeSimple } from './wheels.js';
import * as M from '../materials.js';
import { makeCanvas, canvasTexture, roundRect, clamp, lerp, smoothstep } from '../util.js';

const LOOP = { bottom: 3, bcorner: 4, side: 6, tcorner: 7, top: 5 };

// ------------------------------------------------------------- profiles

function defaults(s) {
  const d = {
    style: 'sedan', L: 4.6, W: 1.8, H: 1.45, wb: 2.7, fo: 0.95,
    tireR: 0.32, tireW: 0.225, rimR: 0.23, gc: 0.16, archGap: 0.045,
    noseY: 0.68, hoodY: 0.98, deckY: 1.02, tailY: 0.98,
    beltF: 1.0, beltR: 1.05,
    cornerF: 0.42, cornerR: 0.38, topR: 0.13, botR: 0.07, tuck: 0.05, crown: 0.03,
    tumble: 0.2, roofCrown: 0.022,
    rim: 'spoke5', rimColor: 0xc9ccd1, caliper: 0x2a2a2c, tread: 0,
    head: 'swept', tail: 'wide', grille: 'mesh', pillarsBlack: false,
    metallic: true, plateFront: true,
  };
  const o = Object.assign(d, s);
  // Greenhouse stations default to proportions of a sedan.
  o.zW ??= o.L / 2 - o.fo - 0.55;
  o.zR1 ??= o.zW - 0.75;
  o.zR2 ??= o.zR1 - 1.15;
  o.zB ??= o.zR2 - 0.55;
  o.bPillar ??= (o.zR1 + o.zR2) / 2 + 0.05;
  o.zf = o.L / 2 - o.fo;
  o.zr = o.zf - o.wb;
  o.hoodFront ??= o.L / 2 - 0.22;
  return o;
}

function stationList(s) {
  const zs = new Set();
  const add = (z) => zs.add(Math.round(z * 2000) / 2000);
  const L2 = s.L / 2;
  for (let z = -L2; z <= L2; z += 0.075) add(z);
  // Quadratic spacing into the bumpers so the plan-view rounding is smooth.
  for (let i = 0; i <= 14; i++) {
    const t = (i / 14) ** 2 * 0.42;
    add(L2 - t); add(-L2 + t);
  }
  const ar = s.tireR + s.archGap;
  for (const zc of [s.zf, s.zr]) {
    for (let z = zc - ar - 0.06; z <= zc + ar + 0.06; z += 0.025) add(z);
    // Exact arch edges so the cut-out starts cleanly.
    add(zc - ar + 0.0005); add(zc + ar - 0.0005);
  }
  if (s.hoodFront) add(s.hoodFront);
  add(s.zW); add(s.zW - 0.001);
  return [...zs].filter((z) => z >= -L2 && z <= L2).sort((a, b) => a - b);
}

function makeProfiles(s) {
  const L2 = s.L / 2;
  // Top line of the lower body: nose → hood → beltline → deck → tail.
  const top = [
    [L2, s.noseY - 0.11], [L2 - 0.02, s.noseY - 0.05], [L2 - 0.07, s.noseY - 0.012], [L2 - 0.16, s.noseY],
    [lerp(L2 - 0.16, s.zW, 0.45), lerp(s.noseY, s.hoodY, 0.7)],
    [s.zW + 0.02, s.hoodY], [s.zW - 0.02, s.beltF],
    [s.zB + 0.02, s.beltR],
  ];
  if (s.style === 'pickup') {
    top.push([s.zB - 0.02, s.bedY], [-L2 + 0.05, s.bedY], [-L2, s.bedY - 0.05]);
  } else if (s.zB > -L2 + 0.2) {
    top.push([s.zB - 0.04, s.deckY], [lerp(s.zB, -L2, 0.6), s.deckY - 0.01], [-L2 + 0.08, s.tailY], [-L2 + 0.02, s.tailY - 0.05], [-L2, s.tailY - 0.12]);
  } else {
    top.push([-L2 + 0.03, s.tailY - 0.03], [-L2, s.tailY - 0.1]);
  }
  const topF = monotone(top);

  const bot = [
    [L2, s.gc + 0.2], [L2 - 0.12, s.gc + 0.1], [L2 - 0.35, s.gc + 0.03], [L2 - 0.6, s.gc],
    [-L2 + 0.55, s.gc], [-L2 + 0.25, s.gc + 0.06], [-L2, s.gc + 0.22],
  ];
  const botBase = monotone(bot);
  const ar = s.tireR + s.archGap;
  const axleY = s.tireR;
  const botF = (z) => {
    let y = botBase(z);
    for (const zc of [s.zf, s.zr]) {
      const dz = z - zc;
      if (Math.abs(dz) < ar) y = Math.max(y, axleY + Math.sqrt(ar * ar - dz * dz));
    }
    return y;
  };

  const halfW = (z) => {
    const W2 = s.W / 2;
    let w = W2;
    const rf = s.cornerF, rr = s.cornerR;
    if (z > L2 - rf) {
      const d = z - (L2 - rf);
      w = W2 - rf + Math.sqrt(Math.max(0, rf * rf - d * d));
    } else if (z < -L2 + rr) {
      const d = (-L2 + rr) - z;
      w = W2 - rr + Math.sqrt(Math.max(0, rr * rr - d * d));
    }
    // Slight taper toward the nose like a real fascia.
    w -= smoothstep(s.zf, L2, z) * 0.02;
    return w;
  };

  // Roof line over the greenhouse.
  let roofF = null;
  if (s.zW > s.zB) {
    const pts = [
      [s.zW, s.beltF],
      [lerp(s.zW, s.zR1, 0.5), lerp(s.beltF, s.H, 0.6)],
      [s.zR1, s.H - 0.012],
      [(s.zR1 + s.zR2) / 2, s.H],
      [s.zR2, s.H - 0.018],
      [lerp(s.zR2, s.zB, 0.5), lerp(s.H, s.beltR, s.style === 'sedan' || s.style === 'coupe' ? 0.5 : 0.35)],
      [s.zB, s.beltR],
    ];
    roofF = monotone(pts);
  }
  return { topF, botF, halfW, roofF };
}

// Right half of a rounded-rect cross-section, bottom center → top center.
function halfLoop(w, wTop, yb, yt, s, crown) {
  const h = Math.max(0.001, yt - yb);
  let rb = Math.min(s.botR, h * 0.35, w * 0.4);
  let rt = Math.min(s.topR, h * 0.55, wTop * 0.4);
  if (rb + rt > h) { const k = h / (rb + rt); rb *= k; rt *= k; }
  const pts = [];
  // bottom flat
  for (let i = 0; i < LOOP.bottom; i++) pts.push([(w - rb) * (i / LOOP.bottom), yb, 'bottom']);
  // bottom corner
  for (let i = 0; i < LOOP.bcorner; i++) {
    const a = -Math.PI / 2 + (Math.PI / 2) * (i / LOOP.bcorner);
    pts.push([w - rb + Math.cos(a) * rb, yb + rb + Math.sin(a) * rb, 'bottom']);
  }
  // side, leaning in toward the top with a little shoulder bulge
  for (let i = 0; i < LOOP.side; i++) {
    const t = i / LOOP.side;
    const x = lerp(w, wTop, t * t) + Math.sin(t * Math.PI) * 0.008;
    pts.push([x, lerp(yb + rb, yt - rt, t), 'side']);
  }
  // top corner
  for (let i = 0; i < LOOP.tcorner; i++) {
    const a = (Math.PI / 2) * (i / LOOP.tcorner);
    pts.push([wTop - rt + Math.cos(a) * rt, yt - rt + Math.sin(a) * rt, 'tcorner']);
  }
  // top, crowned
  for (let i = 0; i <= LOOP.top; i++) {
    const t = i / LOOP.top;
    const x = (wTop - rt) * (1 - t);
    pts.push([x, yt + crown * (1 - (1 - t) * (1 - t)), 'top']);
  }
  return pts;
}

function fullLoop(half) {
  // Mirror to the left side, skipping the shared top/bottom center points.
  const left = [];
  for (let i = half.length - 2; i >= 1; i--) left.push([-half[i][0], half[i][1], half[i][2]]);
  return half.concat(left);
}

// Horizontal half-width of a half loop at height y (for projections).
function hwAt(half, y) {
  let best = -1;
  for (let i = 0; i < half.length - 1; i++) {
    const [x0, y0] = half[i], [x1, y1] = half[i + 1];
    const lo = Math.min(y0, y1), hi = Math.max(y0, y1);
    if (y < lo - 1e-6 || y > hi + 1e-6) continue;
    const x = Math.abs(y1 - y0) < 1e-6 ? Math.max(x0, x1) : lerp(x0, x1, (y - y0) / (y1 - y0));
    if (x > best) best = x;
  }
  return best;
}

// ------------------------------------------------------------- loft mesh

function loft(stations, loops, classify) {
  // stations: z values; loops: arrays of [x,y,tag] (all same length)
  const n = loops[0].length;
  const pos = new Float32Array(stations.length * (n + 1) * 3);
  const uv = new Float32Array(stations.length * (n + 1) * 2);
  const L0 = stations[0], L1 = stations[stations.length - 1];
  for (let i = 0; i < stations.length; i++) {
    for (let j = 0; j <= n; j++) {
      const p = loops[i][j % n];
      const k = i * (n + 1) + j;
      pos[k * 3] = p[0]; pos[k * 3 + 1] = p[1]; pos[k * 3 + 2] = stations[i];
      uv[k * 2] = (stations[i] - L0) / (L1 - L0);
      uv[k * 2 + 1] = j / n;
    }
  }
  const buckets = {};
  for (let i = 0; i < stations.length - 1; i++) {
    for (let j = 0; j < n; j++) {
      const a = i * (n + 1) + j, b = a + 1, c = (i + 1) * (n + 1) + j, d = c + 1;
      // Segments on the left half take the tag of their lower end so both
      // halves split into regions symmetrically.
      const p0 = loops[i][j], p1 = loops[i][(j + 1) % n];
      const left = p0[0] < -1e-6 || (Math.abs(p0[0]) <= 1e-6 && p1[0] < 0);
      const tag = left ? p1[2] : p0[2];
      const key = classify(i, j, tag, (stations[i] + stations[i + 1]) / 2, (p0[0] + p1[0]) / 2);
      if (!key) continue;
      (buckets[key] ||= []).push(a, b, c, b, d, c);
    }
  }
  return { pos, uv, buckets, n };
}

function bucketGeometry(pos, uv, indices) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

// Re-index so each bucket is a standalone geometry with only its vertices.
function compact(geo) {
  const idx = geo.index.array;
  const map = new Map();
  const P = geo.attributes.position.array, U = geo.attributes.uv.array;
  const np = [], nu = [], ni = [];
  for (const v of idx) {
    let m = map.get(v);
    if (m === undefined) {
      m = map.size;
      map.set(v, m);
      np.push(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
      nu.push(U[v * 2], U[v * 2 + 1]);
    }
    ni.push(m);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(np, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(nu, 2));
  g.setIndex(ni);
  g.computeVertexNormals();
  return g;
}

// Normals computed on the full grid, then copied into compacted pieces so
// seams between paint/glass/hood stay perfectly smooth.
function splitBuckets(pos, uv, buckets) {
  const all = [];
  for (const k in buckets) all.push(...buckets[k]);
  const full = bucketGeometry(pos, uv, all);
  const N = full.attributes.normal.array;
  const out = {};
  for (const k in buckets) {
    const idx = buckets[k];
    const map = new Map();
    const np = [], nn = [], nu = [], ni = [];
    for (const v of idx) {
      let m = map.get(v);
      if (m === undefined) {
        m = map.size;
        map.set(v, m);
        np.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]);
        nn.push(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]);
        nu.push(uv[v * 2], uv[v * 2 + 1]);
      }
      ni.push(m);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(np, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nn, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(nu, 2));
    g.setIndex(ni);
    out[k] = g;
  }
  return out;
}

function capGeometry(loop, z, facing) {
  const pos = [], idx = [];
  let cx = 0, cy = 0;
  for (const p of loop) { cx += p[0]; cy += p[1]; }
  cx /= loop.length; cy /= loop.length;
  pos.push(cx, cy, z);
  for (const p of loop) pos.push(p[0], p[1], z);
  const n = loop.length;
  for (let i = 0; i < n; i++) {
    const a = 1 + i, b = 1 + ((i + 1) % n);
    if (facing > 0) idx.push(0, a, b); else idx.push(0, b, a);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const nrm = [];
  for (let i = 0; i <= n; i++) nrm.push(0, 0, facing);
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  const uv = [];
  for (let i = 0; i <= n; i++) uv.push(0.5, 0.5);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// -------------------------------------------------------- decal textures

function seamTexture(s, sections) {
  // White canvas multiplied over the paint; dark hairlines are panel gaps.
  const W = 1024, H = 512;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  const L2 = s.L / 2;
  const u = (z) => ((z + L2) / s.L) * W;
  const { sideLo, sideHi, topLo, topHi } = sections;
  g.strokeStyle = 'rgba(20,20,22,0.85)';
  g.lineWidth = 2.2;
  const vline = (z, v0, v1) => {
    for (const [a, b] of [[v0, v1], [1 - v1, 1 - v0]]) {
      g.beginPath(); g.moveTo(u(z), a * H); g.lineTo(u(z), b * H); g.stroke();
    }
  };
  const hline = (z0, z1, v) => {
    for (const vv of [v, 1 - v]) {
      g.beginPath(); g.moveTo(u(z0), vv * H); g.lineTo(u(z1), vv * H); g.stroke();
    }
  };
  if (s.style !== 'pickup' || true) {
    // Door shut lines.
    const doors = s.doors ?? (s.style === 'coupe' || s.style === 'sports'
      ? [s.zW - 0.02, s.zR2 + 0.15]
      : [s.zW - 0.02, s.bPillar - 0.03, s.zR2 + 0.02]);
    for (const z of doors) vline(z, sideLo + 0.01, sideHi);
    // Front bumper / fender split ahead of the front wheel.
    vline(s.zf + s.tireR + s.archGap + 0.05, sideLo, sideHi * 0.7 + sideLo * 0.3);
    vline(s.zr - s.tireR - s.archGap - 0.05, sideLo, sideHi * 0.7 + sideLo * 0.3);
    // Hood edges.
    hline(s.hoodFront, s.zW, topLo + 0.004);
    // Rocker crease line.
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 1.5;
    hline(s.zr + 0.4, s.zf - 0.4, sideLo + (sideHi - sideLo) * 0.18);
    // Door handles as recessed pockets.
    g.fillStyle = 'rgba(10,10,10,0.55)';
    const handles = s.style === 'coupe' || s.style === 'sports' ? [s.zR2 + 0.28] : [s.bPillar - 0.17, s.zR2 + 0.17];
    for (const z of handles) {
      for (const v of [sideHi - 0.03, 1 - (sideHi - 0.03)]) {
        roundRect(g, u(z) - 14, v * H - 3, 28, 6, 3); g.fill();
      }
    }
    // Fuel door on the right rear quarter.
    g.strokeStyle = 'rgba(20,20,22,0.8)';
    g.lineWidth = 2;
    const fz = s.zr + s.tireR + 0.22;
    roundRect(g, u(fz) - 12, (sideHi - 0.06) * H - 12, 24, 22, 4);
    g.stroke();
  }
  const t = canvasTexture(c, { aniso: 4 });
  return t;
}

function headlightTexture(style) {
  const W = 256, H = 128;
  const c = makeCanvas(W, H), e = makeCanvas(W, H);
  const g = c.getContext('2d'), ge = e.getContext('2d');
  // Housing: dark chrome bezel with reflectors.
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#3a3d42'); grad.addColorStop(0.5, '#15171a'); grad.addColorStop(1, '#2a2c30');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
  const projector = (x, y, r) => {
    const rg = g.createRadialGradient(x, y, r * 0.1, x, y, r);
    rg.addColorStop(0, '#f4f7fb'); rg.addColorStop(0.35, '#9aa3ad'); rg.addColorStop(0.7, '#d9dee4'); rg.addColorStop(1, '#4b5058');
    g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    g.fillStyle = '#e8eef5'; g.beginPath(); g.arc(x, y, r * 0.45, 0, 7); g.fill();
    ge.fillStyle = '#fffaf0'; ge.beginPath(); ge.arc(x, y, r * 0.5, 0, 7); ge.fill();
  };
  if (style === 'round') {
    projector(W / 2, H / 2, H * 0.42);
    ge.strokeStyle = '#fff'; ge.lineWidth = 8; ge.beginPath(); ge.arc(W / 2, H / 2, H * 0.44, 0, 7); ge.stroke();
    g.strokeStyle = '#eef'; g.lineWidth = 6; g.beginPath(); g.arc(W / 2, H / 2, H * 0.44, 0, 7); g.stroke();
  } else if (style === 'quad') {
    projector(W * 0.3, H * 0.52, H * 0.32);
    projector(W * 0.7, H * 0.52, H * 0.32);
  } else {
    projector(W * 0.36, H * 0.55, H * 0.26);
    projector(W * 0.66, H * 0.55, H * 0.22);
    // LED daytime running light strip along the top edge.
    g.fillStyle = '#f6f8fb';
    roundRect(g, W * 0.06, H * 0.12, W * 0.88, H * 0.1, 6); g.fill();
    ge.fillStyle = '#ffffff';
    roundRect(ge, W * 0.06, H * 0.12, W * 0.88, H * 0.1, 6); ge.fill();
  }
  // Chrome sparkle.
  g.globalAlpha = 0.2; g.fillStyle = '#fff';
  g.fillRect(0, H * 0.05, W, 3);
  return { map: canvasTexture(c), emissive: canvasTexture(e) };
}

function taillightTexture(style) {
  const W = 256, H = 128;
  const c = makeCanvas(W, H), e = makeCanvas(W, H);
  const g = c.getContext('2d'), ge = e.getContext('2d');
  g.fillStyle = '#5a0a0c'; g.fillRect(0, 0, W, H);
  ge.fillStyle = '#300000'; ge.fillRect(0, 0, W, H);
  // Optic texture: fine horizontal ridges.
  for (let y = 0; y < H; y += 4) { g.fillStyle = y % 8 ? '#6d0f12' : '#4a070a'; g.fillRect(0, y, W, 2); }
  if (style === 'round') {
    for (const x of [W * 0.3, W * 0.7]) {
      ge.fillStyle = '#ff2a1a'; ge.beginPath(); ge.arc(x, H / 2, H * 0.36, 0, 7); ge.fill();
      g.fillStyle = '#7a1214'; g.beginPath(); g.arc(x, H / 2, H * 0.36, 0, 7); g.fill();
    }
  } else {
    // LED tube outline.
    ge.strokeStyle = '#ff3020'; ge.lineWidth = 12;
    roundRect(ge, W * 0.08, H * 0.18, W * 0.84, H * 0.5, 18); ge.stroke();
    g.strokeStyle = '#8c1518'; g.lineWidth = 12;
    roundRect(g, W * 0.08, H * 0.18, W * 0.84, H * 0.5, 18); g.stroke();
  }
  // Clear reverse lamp segment.
  g.fillStyle = '#d7d9dc'; g.fillRect(W * 0.12, H * 0.74, W * 0.3, H * 0.14);
  ge.fillStyle = '#000'; ge.fillRect(W * 0.12, H * 0.74, W * 0.3, H * 0.14);
  return { map: canvasTexture(c), emissive: canvasTexture(e) };
}

function grilleTexture(style) {
  const W = 256, H = 128;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#0b0c0d'; g.fillRect(0, 0, W, H);
  if (style === 'bars' || style === 'chrome') {
    g.fillStyle = style === 'chrome' ? '#c9ccd2' : '#2a2c2f';
    for (let y = 10; y < H; y += 22) g.fillRect(0, y, W, 9);
  } else if (style === 'slots') {
    g.fillStyle = '#25272a';
    for (let x = 12; x < W; x += 26) g.fillRect(x, 0, 10, H);
  } else if (style === 'closed') {
    g.fillStyle = '#1b1c1e'; g.fillRect(0, 0, W, H);
  } else {
    // Honeycomb mesh.
    g.fillStyle = '#26282b';
    const r = 9;
    for (let y = 0; y < H + r; y += r * 1.5) {
      for (let x = 0; x < W + r; x += r * 1.75) {
        const ox = (Math.round(y / (r * 1.5)) % 2) * r * 0.87;
        g.beginPath();
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
          const px = x + ox + Math.cos(a) * r * 0.82, py = y + Math.sin(a) * r * 0.82;
          k ? g.lineTo(px, py) : g.moveTo(px, py);
        }
        g.closePath();
        g.lineWidth = 3; g.strokeStyle = '#26282b'; g.stroke();
      }
    }
  }
  // Surround.
  g.strokeStyle = style === 'chrome' ? '#d9dce1' : '#2e3034';
  g.lineWidth = 8; g.strokeRect(0, 0, W, H);
  return canvasTexture(c);
}

export function plateTexture(text, top = 'SKYVILLE', color = '#1d3d8f') {
  const W = 256, H = 128;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#f4f3ee'; roundRect(g, 0, 0, W, H, 10); g.fill();
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(120,160,220,0.35)'); grad.addColorStop(0.4, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  g.fillStyle = color;
  g.font = 'bold 20px Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText(top, W / 2, 26);
  g.font = 'bold 62px "Arial Narrow", Arial, sans-serif';
  g.fillText(text, W / 2, 96);
  g.font = '12px Arial, sans-serif';
  g.fillText('THE HARBOR STATE', W / 2, 118);
  g.strokeStyle = '#333'; g.lineWidth = 3; roundRect(g, 4, 4, W - 8, H - 8, 8); g.stroke();
  return canvasTexture(c, { aniso: 4 });
}

// ---------------------------------------------------- surface projection

function makeSurface(stations, halves) {
  // Distance along z from an end to where a ray at (x,y) meets the body.
  const n = stations.length;
  function hitZ(x, y, fromFront, maxDepth = 0.5) {
    const ax = Math.abs(x);
    let prev = -1;
    const zEnd = fromFront ? stations[n - 1] : stations[0];
    for (let k = 0; k < n; k++) {
      const i = fromFront ? n - 1 - k : k;
      // Grazing rays would smear a lamp down the whole flank; stop them.
      if (Math.abs(stations[i] - zEnd) > maxDepth) return null;
      const hw = hwAt(halves[i], y);
      if (hw >= ax) {
        if (prev < 0) return stations[i];
        const hp = hwAt(halves[prev], y);
        const t = hp < 0 ? 0.5 : clamp((ax - hp) / Math.max(1e-6, hw - hp), 0, 1);
        return lerp(stations[prev], stations[i], t);
      }
      prev = i;
    }
    return null;
  }
  function sideX(z, y) {
    let i = 0;
    while (i < n - 2 && stations[i + 1] < z) i++;
    const t = clamp((z - stations[i]) / (stations[i + 1] - stations[i]), 0, 1);
    const a = hwAt(halves[i], y), b = hwAt(halves[i + 1], y);
    if (a < 0 || b < 0) return null;
    return lerp(a, b, t);
  }
  return { hitZ, sideX };
}

// Projects a 2D shape (given as an SDF over [-1,1]^2) onto the front/rear.
function projectEnd(surface, { cx, cy, w, h, sdf, fromFront, offset = 0.004, res = [26, 14], maxDepth = 0.45 }) {
  const [nx, ny] = res;
  const P = [], U = [], idx = [], inside = [], valid = [];
  const pt = (u, v) => {
    const x = cx + u * w / 2, y = cy + v * h / 2;
    const z = surface.hitZ(x, y, fromFront, maxDepth);
    return z === null ? null : [x, y, z];
  };
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      let u = (i / nx) * 2 - 1, v = (j / ny) * 2 - 1;
      let d = sdf(u, v);
      let du = u, dv = v;
      if (d > 0) {
        // Snap outside vertices onto the shape edge so outlines are smooth.
        for (let it = 0; it < 6 && d > 1e-4; it++) {
          const e = 0.002;
          const gx = (sdf(du + e, dv) - sdf(du - e, dv)) / (2 * e);
          const gy = (sdf(du, dv + e) - sdf(du, dv - e)) / (2 * e);
          const gl = Math.hypot(gx, gy) || 1;
          du -= (gx / gl) * d; dv -= (gy / gl) * d;
          d = sdf(du, dv);
        }
      }
      inside.push(sdf(u, v) <= 0);
      const p = pt(du, dv);
      valid.push(!!p);
      const q = p || [cx + du * w / 2, cy + dv * h / 2, 0];
      P.push(q);
      U.push([(du + 1) / 2, (dv + 1) / 2]);
    }
  }
  const row = nx + 1;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
      if (!(inside[a] || inside[b] || inside[c] || inside[d])) continue;
      if (!(valid[a] && valid[b] && valid[c] && valid[d])) continue;
      if (fromFront) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
    }
  }
  // Normals from the grid, then push the decal off the paint.
  const g = new THREE.BufferGeometry();
  const flat = new Float32Array(P.length * 3);
  P.forEach((p, k) => { flat[k * 3] = p[0]; flat[k * 3 + 1] = p[1]; flat[k * 3 + 2] = p[2]; });
  g.setAttribute('position', new THREE.BufferAttribute(flat, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U.flat(), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const nrm = g.attributes.normal.array;
  for (let k = 0; k < P.length; k++) {
    flat[k * 3] += nrm[k * 3] * offset;
    flat[k * 3 + 1] += nrm[k * 3 + 1] * offset;
    flat[k * 3 + 2] += nrm[k * 3 + 2] * offset;
  }
  g.attributes.position.needsUpdate = true;
  return g;
}

// Projects a rectangle onto a flank (rays along -x / +x) for door decals.
export function projectSide(surface, { cz, cy, w, h, side, offset = 0.004, res = [24, 10] }) {
  const [nx, ny] = res;
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const u = i / nx, v = j / ny;
      // u runs front→back on the right side, back→front on the left, so text reads correctly.
      const z = side > 0 ? cz - w / 2 + u * w : cz + w / 2 - u * w;
      const y = cy - h / 2 + v * h;
      const x = (surface.sideX(z, y) ?? 0) * side;
      pos.push(x, y, z);
      uv.push(u, v);
    }
  }
  const row = nx + 1;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Make sure normals face outward, then lift off the paint.
  const n = g.attributes.normal.array, p = g.attributes.position.array;
  let flip = 0;
  for (let k = 0; k < n.length; k += 3) flip += n[k] * side;
  if (flip < 0) {
    for (let k = 0; k < idx.length; k += 3) { const t = idx[k]; idx[k] = idx[k + 1]; idx[k + 1] = t; }
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  for (let k = 0; k < p.length; k += 3) {
    p[k] += g.attributes.normal.array[k] * offset;
    p[k + 1] += g.attributes.normal.array[k + 1] * offset;
    p[k + 2] += g.attributes.normal.array[k + 2] * offset;
  }
  g.attributes.position.needsUpdate = true;
  return g;
}

// SDF helpers in [-1,1] space.
const sdfRoundRect = (rx = 0.25, ry = 0.4) => (u, v) => {
  const qx = Math.abs(u) - (1 - rx), qy = Math.abs(v) - (1 - ry);
  const k = Math.max(rx, ry);
  const ox = Math.max(qx / rx * k, 0), oy = Math.max(qy / ry * k, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx / rx * k, qy / ry * k), 0) - k;
};
const sdfCircle = () => (u, v) => Math.hypot(u, v) - 1;
// A swept lamp: tall at the outboard end (u=+1), thin inboard.
const sdfSwept = (taper = 0.55) => (u, v) => {
  const halfH = lerp(1 - taper, 1, (u + 1) / 2);
  const dy = Math.abs(v) - halfH;
  const dx = Math.abs(u) - 1;
  return Math.max(dx, dy) + 0.0;
};

// ---------------------------------------------------------- the builder

export function buildCarModel(specIn) {
  const s = defaults(specIn);
  const stations = stationList(s);
  const prof = makeProfiles(s);

  // Lower body.
  const halves = [], loops = [];
  for (const z of stations) {
    const w = prof.halfW(z);
    const yb = prof.botF(z), yt = Math.max(prof.topF(z), yb + (yb > s.gc + 0.2 ? 0.07 : 0.02));
    const half = halfLoop(w, w - s.tuck, yb, yt, s, s.crown * smoothstep(-s.L / 2, s.L / 2 - 0.3, z) + 0.004);
    halves.push(half);
    loops.push(fullLoop(half));
  }
  const n = loops[0].length;
  const halfCount = halves[0].length;
  // Loop indices bounding each region, for the seam texture and the hood cut.
  const tags = loops[0].map((p) => p[2]);
  const firstTop = tags.indexOf('top');
  const lastTop = tags.lastIndexOf('top');
  const firstSide = tags.indexOf('side');
  const sections = {
    sideLo: firstSide / n, sideHi: (firstTop - LOOP.tcorner) / n,
    topLo: (firstTop - 2) / n, topHi: (lastTop + 2) / n,
  };
  // Hood panel: top + upper corners between the hood front and the cowl.
  const hoodJ0 = firstTop - 3, hoodJ1 = lastTop + 3;
  const isHood = (j, zMid) => zMid > s.zW + 0.02 && zMid < s.hoodFront && j >= hoodJ0 && j < hoodJ1;

  const lower = loft(stations, loops, (i, j, tag, zMid) => {
    // A truck cab is hollow: no lid at the beltline over the seats.
    if (s.style === 'cab' && tag === 'top' && zMid < s.zW - 0.02 && zMid > s.zB + 0.02) return null;
    if (tag === 'bottom' && loops[i][0][1] < s.gc + 0.1) return 'under';
    if (isHood(j, zMid)) return 'hood';
    return 'paint';
  });
  const lowerParts = splitBuckets(lower.pos, lower.uv, lower.buckets);

  // Greenhouse.
  const gStations = stations.filter((z) => z >= s.zB && z <= s.zW);
  if (gStations[0] > s.zB) gStations.unshift(s.zB);
  if (gStations[gStations.length - 1] < s.zW) gStations.push(s.zW);
  // Finer sampling through the greenhouse for crisp pillar edges.
  for (let z = s.zB; z < s.zW; z += 0.035) gStations.push(z);
  gStations.sort((a, b) => a - b);
  const gs = [...new Set(gStations.map((z) => Math.round(z * 2000) / 2000))];
  const gLoops = [];
  const GH = { ...s, botR: 0.0, topR: Math.min(0.14, s.topR + 0.02) };
  for (const z of gs) {
    const w = prof.halfW(z) - 0.035;
    const yb = prof.topF(z) - 0.03;
    const yt = Math.max(prof.roofF(z), yb + 0.0005);
    const k = clamp((yt - yb) / Math.max(0.01, s.H - s.beltF), 0, 1);
    const half = halfLoop(w, w - s.tumble * k, yb, yt, GH, s.roofCrown * k);
    gLoops.push(fullLoop(half));
  }
  const winStart = s.zW - 0.06; // A-pillar base
  const sideGlass = s.sideGlass ?? null;
  const pillarMat = s.pillarsBlack ? 'black' : 'paint';
  const greenhouse = loft(gs, gLoops, (i, j, tag, z, x) => {
    if (tag === 'bottom') return null;
    const inWind = z > s.zR1;
    const inBack = z < s.zR2;
    if (s.style === 'cab') {
      // Truck cab: windshield, door windows and a rear window, no rear doors.
      if (tag === 'top') return inWind ? 'glass' : inBack ? (Math.abs(x) < s.W * 0.3 ? 'glass' : 'paint') : 'paint';
      if (tag === 'tcorner') return inWind ? pillarMat : 'paint';
      if (z > winStart || z < s.zB + 0.12) return 'paint';
      if (inBack) return 'paint';
      return 'glass';
    }
    if (tag === 'top') {
      if (inWind) return 'glass';
      if (inBack) return s.style === 'pickup' || s.style === 'van' && s.rearGlass === false ? 'paint' : 'glass';
      return s.sunroof && z < s.zR1 - 0.15 && z > s.zR1 - 0.9 && Math.abs(x) < 0.38 ? 'glass' : 'paint';
    }
    if (tag === 'tcorner') {
      // Upper corners: windshield/backlight wrap a little, otherwise pillars & rails.
      const jj = j % (gLoops[0].length);
      const local = Math.min(jj, gLoops[0].length - jj);
      const nearTop = local > (gLoops[0].length / 2) - LOOP.top - 3;
      if (inWind && nearTop) return 'glass';
      if (inBack && nearTop && s.style !== 'sedan' && s.style !== 'coupe' && s.style !== 'pickup') return 'glass';
      return inWind ? pillarMat : 'paint';
    }
    // side
    if (z > winStart) return 'paint';
    if (sideGlass) return sideGlass.some(([a, b]) => z >= a && z <= b) ? 'glass' : 'paint';
    if (Math.abs(z - s.bPillar) < 0.055) return 'black';
    if (inBack) {
      if (s.style === 'sedan') return z > s.zR2 - (s.zR2 - s.zB) * 0.3 ? 'glass' : 'paint';
      if (s.style === 'coupe' || s.style === 'sports') return 'paint';
      if (z < s.zB + 0.14) return 'paint';
      return 'glass';
    }
    if (s.style === 'sedan' && Math.abs(z - (s.zR2 + 0.02)) < 0.05) return 'black';
    return 'glass';
  });
  const ghParts = splitBuckets(greenhouse.pos, greenhouse.uv, greenhouse.buckets);

  // ------------------------------------------------ assemble the model
  const root = new THREE.Group();
  root.name = s.name || 'car';
  const seamTex = seamTexture(s, sections);
  const parts = { paint: [], glass: [], black: [], chrome: [], under: [] };
  const addMesh = (geo, slot, mat) => {
    geo.userData.shared = true;
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData.slot = slot;
    root.add(m);
    parts[slot]?.push(m);
    return m;
  };
  const placeholderPaint = M.carPaint('#888888', { seamMap: seamTex });
  addMesh(lowerParts.paint, 'paint', placeholderPaint);
  if (lowerParts.under) addMesh(lowerParts.under, 'under', M.underbody());
  addMesh(blankUV(ghParts.paint), 'paint', placeholderPaint);
  if (ghParts.glass) addMesh(ghParts.glass, 'glass', M.glassOpaque());
  if (ghParts.black) addMesh(ghParts.black, 'black', M.glossBlack());
  // End caps.
  const frontLoop = loops[loops.length - 1], rearLoop = loops[0];
  addMesh(blankUV(capGeometry(frontLoop, s.L / 2, 1)), 'paint', placeholderPaint);
  addMesh(blankUV(capGeometry(rearLoop, -s.L / 2, -1)), 'paint', placeholderPaint);

  // Hood on a hinge at the cowl.
  const hoodPivot = new THREE.Group();
  const hingeY = prof.topF(s.zW + 0.03) - 0.01;
  hoodPivot.position.set(0, hingeY, s.zW + 0.03);
  root.add(hoodPivot);
  const hoodGeo = lowerParts.hood;
  hoodGeo.translate(0, -hingeY, -(s.zW + 0.03));
  hoodGeo.userData.shared = true;
  const hood = new THREE.Mesh(hoodGeo, placeholderPaint);
  hood.castShadow = true;
  hood.userData.slot = 'paint';
  hood.userData.part = 'hood';
  hoodPivot.add(hood);
  parts.paint.push(hood);
  // Hood underside (inner panel) seen when it's open.
  const inner = hoodGeo.clone();
  inner.translate(0, -0.025, 0);
  const innerIdx = inner.index.array;
  for (let i = 0; i < innerIdx.length; i += 3) { const t = innerIdx[i]; innerIdx[i] = innerIdx[i + 1]; innerIdx[i + 1] = t; }
  inner.computeVertexNormals();
  inner.userData.shared = true;
  const hoodInner = new THREE.Mesh(inner, M.std(0x2b2c2e, 0.8));
  hoodInner.userData.part = 'hood';
  hoodPivot.add(hoodInner);

  // Engine bay under the hood: tub, engine, battery with terminals.
  const bay = s.noBay ? null : buildEngineBay(s, prof, hingeY);
  if (bay) root.add(bay.group);

  // Lights, grille, plates — projected onto the body.
  const surf = makeSurface(stations, halves);
  const lamps = { head: [], tail: [], brake: [], reverse: [], indicatorF: [], indicatorR: [] };
  const headTex = headlightTexture(s.head);
  const headMat = M.lightLens('head', headTex.map);
  headMat.emissiveMap = headTex.emissive;
  const tailTex = taillightTexture(s.tailShape || 'wide');
  const tailMat = M.lightLens('tail', tailTex.map);
  tailMat.emissiveMap = tailTex.emissive;
  const W2 = s.W / 2;
  const hl = s.headlight ?? {};
  const hlW = hl.w ?? 0.42, hlH = hl.h ?? 0.13;
  const hlY = hl.y ?? (s.noseY - 0.05);
  const hlX = hl.x ?? (W2 - hlW / 2 - 0.05);
  const hlShape = s.head === 'round' ? sdfCircle() : s.head === 'swept' ? sdfSwept(0.5) : sdfRoundRect(0.2, 0.35);
  for (const side of [1, -1]) {
    const flip = (fn) => (u, v) => fn(u * side, v);
    const g = projectEnd(surf, { cx: hlX * side, cy: hlY, w: hlW, h: hlH, sdf: flip(hlShape), fromFront: true });
    if (side < 0) mirrorUV(g);
    g.userData.shared = true;
    const m = new THREE.Mesh(g, headMat);
    m.userData.slot = 'head';
    m.userData.part = 'headlight';
    m.userData.side = side;
    root.add(m);
    lamps.head.push(m);
  }
  // Grille + lower intake.
  const gr = s.grilleBox ?? { w: s.W * 0.42, h: 0.17, y: s.noseY - 0.12 };
  if (s.grille !== 'none') {
    const gg = projectEnd(surf, { cx: 0, cy: gr.y, w: gr.w, h: gr.h, sdf: sdfRoundRect(0.12, 0.3), fromFront: true, offset: 0.003 });
    gg.userData.shared = true;
    const gm = new THREE.MeshStandardMaterial({ map: grilleTexture(s.grille), metalness: s.grille === 'chrome' ? 0.8 : 0.3, roughness: 0.35 });
    const grille = new THREE.Mesh(gg, gm);
    root.add(grille);
  }
  const intake = projectEnd(surf, { cx: 0, cy: s.gc + 0.16, w: s.W * 0.6, h: 0.11, sdf: sdfRoundRect(0.15, 0.4), fromFront: true, offset: 0.003 });
  intake.userData.shared = true;
  root.add(new THREE.Mesh(intake, new THREE.MeshStandardMaterial({ map: grilleTexture('mesh'), roughness: 0.6 })));
  // Fog lamps.
  for (const side of [1, -1]) {
    const fg = projectEnd(surf, { cx: side * (W2 - 0.2), cy: s.gc + 0.17, w: 0.1, h: 0.06, sdf: sdfRoundRect(0.4, 0.5), fromFront: true });
    fg.userData.shared = true;
    const fog = M.lightLens('head');
    fog.color.set(0x5a6068);
    root.add(new THREE.Mesh(fg, fog));
  }
  // Tail lamps.
  const tl = s.taillight ?? {};
  const tlW = tl.w ?? 0.38, tlH = tl.h ?? 0.12;
  const tlY = tl.y ?? (s.tailY - 0.1);
  const tlX = tl.x ?? (W2 - tlW / 2 - 0.03);
  const tlShape = s.tailShape === 'round' ? sdfCircle() : s.tailShape === 'tall' ? sdfRoundRect(0.3, 0.12) : sdfSwept(0.4);
  for (const side of s.noTail ? [] : [1, -1]) {
    const flip = (fn) => (u, v) => fn(u * side, v);
    const g = projectEnd(surf, { cx: tlX * side, cy: tlY, w: tlW, h: tlH, sdf: flip(tlShape), fromFront: false });
    if (side < 0) mirrorUV(g);
    g.userData.shared = true;
    const m = new THREE.Mesh(g, tailMat);
    m.userData.slot = 'tail';
    m.userData.part = 'taillight';
    root.add(m);
    lamps.tail.push(m);
  }
  if (s.lightBarRear) {
    const g = projectEnd(surf, { cx: 0, cy: tlY + 0.02, w: s.W - 0.4, h: 0.035, sdf: sdfRoundRect(0.05, 0.5), fromFront: false });
    g.userData.shared = true;
    const m = new THREE.Mesh(g, tailMat);
    root.add(m);
  }
  // License plates.
  const plateGeoF = s.plateFront ? projectEnd(surf, { cx: 0, cy: s.gc + 0.3, w: 0.305, h: 0.152, sdf: sdfRoundRect(0.06, 0.12), fromFront: true, offset: 0.012, res: [6, 3] }) : null;
  const plateGeoR = s.noTail ? null : projectEnd(surf, { cx: 0, cy: s.plateRearY ?? (s.tailY - 0.3), w: 0.305, h: 0.152, sdf: sdfRoundRect(0.06, 0.12), fromFront: false, offset: 0.012, res: [6, 3] });
  if (plateGeoR) mirrorUV(plateGeoR);
  const plates = [];
  for (const pg of [plateGeoF, plateGeoR]) {
    if (!pg) continue;
    pg.userData.shared = true;
    const pm = new THREE.Mesh(pg, M.plateWhite());
    pm.userData.part = 'plate';
    root.add(pm);
    plates.push(pm);
  }

  // Side mirrors.
  for (const side of s.noMirrors ? [] : [1, -1]) {
    const mz = s.zW - 0.12;
    const my = prof.topF(mz) + 0.1;
    const mx = (surf.sideX(mz, my - 0.1) ?? W2) * side;
    const housing = new THREE.Mesh(mirrorGeo(), placeholderPaint);
    housing.position.set(mx + side * 0.1, my, mz);
    housing.scale.x = side;
    housing.castShadow = true;
    housing.userData.slot = 'paint';
    root.add(housing);
    parts.paint.push(housing);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.085), M.chrome());
    glass.position.set(mx + side * 0.1, my, mz - 0.077);
    glass.rotation.y = Math.PI;
    root.add(glass);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.035, 0.06), M.blackTrim());
    arm.position.set(mx + side * 0.04, my - 0.03, mz + 0.02);
    root.add(arm);
  }
  // Wipers resting at the cowl.
  for (const side of [1, -1]) {
    const wiper = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.012, 0.02), M.blackTrim());
    const y = prof.topF(s.zW + 0.04) + 0.012;
    wiper.position.set(side * 0.26 - 0.08, y, s.zW + 0.02);
    wiper.rotation.y = side * 0.05;
    root.add(wiper);
  }
  // Exhaust tip(s).
  const exG = new THREE.CylinderGeometry(0.035, 0.035, 0.12, 16, 1, true);
  exG.rotateX(Math.PI / 2);
  for (const side of s.noExhaust ? [] : s.dualExhaust ? [1, -1] : [-1]) {
    const ex = new THREE.Mesh(exG, M.chrome());
    ex.position.set(side * (W2 - 0.38), s.gc + 0.07, -s.L / 2 + 0.03);
    root.add(ex);
  }
  // Arch liners and underbody so you can't see through the wheel wells.
  const ar = s.tireR + s.archGap;
  for (const zc of s.noWheels ? [s.zf] : [s.zf, s.zr]) {
    const liner = new THREE.Mesh(linerGeo(ar, s.W - 0.06), M.underbody());
    liner.position.set(0, s.tireR, zc);
    root.add(liner);
  }
  if (!s.noWheels) {
    const floor = new THREE.Mesh(new THREE.BoxGeometry(s.W - 0.12, 0.04, s.L - 0.5), M.underbody());
    floor.position.set(0, s.gc + 0.03, 0);
    root.add(floor);
  }

  // Extras by style.
  if (s.style === 'pickup') addPickupBed(root, s, prof, placeholderPaint, parts);
  if (s.roofRails) addRoofRails(root, s, prof);
  if (s.spare) {
    const sp = buildWheel({ tireR: s.tireR, tireW: s.tireW, rimR: s.rimR, style: s.rim, rimColor: s.rimColor, tread: s.tread }, 1);
    sp.pivot.rotation.y = -Math.PI / 2;
    sp.pivot.position.set(0, s.tailY + 0.05, -s.L / 2 - s.tireW / 2 + 0.02);
    root.add(sp.pivot);
  }
  if (s.spoiler) {
    const sg = new THREE.Mesh(blankUV(new THREE.BoxGeometry(s.W - 0.4, 0.025, 0.16)), placeholderPaint);
    sg.position.set(0, s.deckY + 0.07, -s.L / 2 + 0.16);
    sg.rotation.x = -0.12;
    root.add(sg);
    parts.paint.push(sg);
    for (const side of [1, -1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.06), M.blackTrim());
      post.position.set(side * (s.W / 2 - 0.45), s.deckY + 0.03, -s.L / 2 + 0.17);
      root.add(post);
    }
  }
  if (s.antenna !== false) {
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 8), M.glossBlack());
    fin.scale.set(0.6, 1, 2.6);
    fin.position.set(0, prof.roofF ? prof.roofF(s.zR2 + 0.1) + 0.02 : s.H, s.zR2 + 0.1);
    root.add(fin);
  }

  // Wheels.
  const wheels = [];
  const wheelOpts = { tireR: s.tireR, tireW: s.tireW, rimR: s.rimR, style: s.rim, rimColor: s.rimColor, caliper: s.caliper, tread: s.tread };
  const trackX = W2 - s.tireW / 2 - 0.035;
  for (const [z, front] of s.noWheels ? [] : [[s.zf, true], [s.zr, false]]) {
    for (const side of [-1, 1]) {
      const w = buildWheel(wheelOpts, side);
      w.pivot.position.set(side * trackX, s.tireR, z);
      w.pivot.userData.front = front;
      w.pivot.userData.side = side;
      root.add(w.pivot);
      wheels.push(w);
    }
  }

  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

  return {
    spec: s,
    surface: surf,
    profiles: prof,
    template: root,
    seamTex,
    lampsInfo: lamps,
    plates,
    wheels,
    hoodPivot,
    bay,
    dims: {
      L: s.L, W: s.W, H: s.H, gc: s.gc, tireR: s.tireR, trackX, zf: s.zf, zr: s.zr,
      beltY: s.beltF, noseY: s.noseY,
    },
  };
}

function mirrorUV(g) {
  const uv = g.attributes.uv.array;
  for (let i = 0; i < uv.length; i += 2) uv[i] = 1 - uv[i];
  g.attributes.uv.needsUpdate = true;
}

function roundedRectPath(path, x, y, w, h, r) {
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y);
  path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + h - r);
  path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  path.lineTo(x + r, y + h);
  path.quadraticCurveTo(x, y + h, x, y + h - r);
  path.lineTo(x, y + r);
  path.quadraticCurveTo(x, y, x + r, y);
}

let _mirrorGeo = null;
function mirrorGeo() {
  if (_mirrorGeo) return _mirrorGeo;
  // Rounded housing, wider at the glass end and tapering forward.
  const shape = new THREE.Shape();
  roundedRectPath(shape, -0.095, -0.055, 0.19, 0.11, 0.035);
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.012, bevelSegments: 5, curveSegments: 8 });
  g.translate(0, 0, -0.045);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = p.getZ(i);
    if (z > 0) { const k = 1 - Math.min(1, z / 0.04) * 0.35; p.setX(i, p.getX(i) * k); p.setY(i, p.getY(i) * k); }
  }
  g.computeVertexNormals();
  blankUV(g);
  g.userData.shared = true;
  _mirrorGeo = g;
  return g;
}

const linerCache = new Map();
function linerGeo(r, width) {
  const key = r + '|' + width;
  if (linerCache.has(key)) return linerCache.get(key);
  // Half cylinder over the wheel (open bottom), plus inner walls.
  const g = new THREE.CylinderGeometry(r - 0.005, r - 0.005, width, 24, 1, true, -Math.PI / 2, Math.PI);
  g.rotateZ(Math.PI / 2);
  g.rotateX(-Math.PI / 2);
  // Make it render from inside.
  const idx = g.index.array;
  for (let i = 0; i < idx.length; i += 3) { const t = idx[i]; idx[i] = idx[i + 1]; idx[i + 1] = t; }
  g.computeVertexNormals();
  // A center wall so you can't see straight through to the far wheel.
  const wall = new THREE.CircleGeometry(r - 0.01, 20, 0, Math.PI);
  wall.rotateY(Math.PI / 2);
  const merged = mergeSimple([g, wall]);
  merged.userData.shared = true;
  linerCache.set(key, merged);
  return merged;
}

// Points every UV at a blank corner of the seam texture (for paint parts
// that aren't part of the lofted body).
function blankUV(g) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5, 0.004);
  uv.needsUpdate = true;
  return g;
}

function buildEngineBay(s, prof, hingeY) {
  const group = new THREE.Group();
  group.visible = false; // only shown while the hood is open
  const zFront = s.hoodFront - 0.05, zBack = s.zW + 0.06;
  const len = zFront - zBack;
  const zc = (zFront + zBack) / 2;
  const topY = Math.min(prof.topF(zc), hingeY) - 0.04;
  const w = s.W - 0.32;
  // Bay tub.
  const tub = new THREE.Mesh(new THREE.BoxGeometry(w, 0.35, len), M.std(0x1a1b1d, 0.85));
  tub.material = tub.material.clone();
  tub.material.side = THREE.BackSide;
  tub.position.set(0, topY - 0.15, zc);
  group.add(tub);
  // Engine cover, intake, strut towers, reservoirs.
  const engine = new THREE.Mesh(new THREE.BoxGeometry(w * 0.48, 0.2, len * 0.5), M.std(0x2a2b2d, 0.5, 0.3));
  engine.position.set(0.05, topY - 0.14, zc);
  group.add(engine);
  const cover = new THREE.Mesh(new THREE.BoxGeometry(w * 0.4, 0.04, len * 0.42), M.glossBlack());
  cover.position.set(0.05, topY - 0.03, zc);
  group.add(cover);
  const air = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.34), M.blackTrim());
  air.position.set(w / 2 - 0.2, topY - 0.1, zc + len * 0.15);
  group.add(air);
  const res = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.14, 14), M.std(0xe8e4d0, 0.4));
  res.position.set(w / 2 - 0.15, topY - 0.08, zc - len * 0.3);
  group.add(res);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.025, 12), M.std(0xf2c218, 0.5));
  cap.position.set(res.position.x, topY - 0.005, res.position.z);
  group.add(cap);
  for (const side of [1, -1]) {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.2, 16), M.std(0x2f3033, 0.6, 0.4));
    tower.position.set(side * (w / 2 - 0.08), topY - 0.12, zBack + 0.18);
    group.add(tower);
  }
  // Battery on the driver's (left) side, terminals up.
  const battery = new THREE.Group();
  const bx = -(w / 2 - 0.2), bz = zc + len * 0.12;
  battery.position.set(bx, topY - 0.17, bz);
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.19, 0.26), M.std(0x161718, 0.6));
  box.position.y = 0.0;
  battery.add(box);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.26), M.std(0x2b2c2e, 0.5));
  lid.position.y = 0.105;
  battery.add(lid);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.08), new THREE.MeshStandardMaterial({ map: batteryLabel(), roughness: 0.5 }));
  label.rotation.x = -Math.PI / 2;
  label.position.set(0, 0.116, 0.02);
  battery.add(label);
  const posT = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.025, 12), M.std(0xb08d57, 0.35, 0.9));
  posT.position.set(0.05, 0.13, -0.09);
  const negT = posT.clone();
  negT.position.set(-0.05, 0.13, -0.09);
  const posCap = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.012, 0.035), M.std(0xc0161a, 0.5));
  posCap.position.set(0.05, 0.121, -0.09);
  battery.add(posT, negT, posCap);
  for (const o of [box, lid]) o.userData.part = 'battery';
  group.add(battery);
  battery.userData.part = 'battery';
  group.traverse((o) => { if (o.isMesh && !o.userData.part) o.userData.part = 'bay'; });
  return {
    group, battery,
    terminals: { pos: posT, neg: negT },
  };
}

let _batLabel = null;
function batteryLabel() {
  if (_batLabel) return _batLabel;
  const c = makeCanvas(128, 64);
  const g = c.getContext('2d');
  g.fillStyle = '#1d1e20'; g.fillRect(0, 0, 128, 64);
  g.fillStyle = '#d32020'; g.fillRect(0, 0, 128, 14);
  g.fillStyle = '#fff'; g.font = 'bold 11px Arial'; g.fillText('MAXPOWER  12V', 6, 11);
  g.fillStyle = '#ddd'; g.font = 'bold 18px Arial'; g.fillText('650 CCA', 8, 38);
  g.font = '10px Arial'; g.fillText('GROUP 51R  ·  AGM', 8, 56);
  g.fillStyle = '#e33'; g.font = 'bold 22px Arial'; g.fillText('+', 104, 40);
  _batLabel = canvasTexture(c);
  return _batLabel;
}

function addPickupBed(root, s, prof, paint, parts) {
  const L2 = s.L / 2;
  const z0 = s.zB - 0.08, z1 = -L2 + 0.02;
  const len = z0 - z1;
  const zc = (z0 + z1) / 2;
  const w = s.W - 0.04;
  const rail = s.bedRail ?? s.bedY + 0.48;
  const wallH = rail - s.bedY;
  const sideGeo = blankUV(new THREE.BoxGeometry(0.07, wallH, len));
  for (const side of [1, -1]) {
    const wall = new THREE.Mesh(sideGeo, paint);
    wall.position.set(side * (w / 2 - 0.035), s.bedY + wallH / 2, zc);
    root.add(wall);
    parts.paint.push(wall);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, len), M.blackTrim());
    cap.position.set(side * (w / 2 - 0.05), rail + 0.012, zc);
    root.add(cap);
  }
  const front = new THREE.Mesh(blankUV(new THREE.BoxGeometry(w, wallH, 0.07)), paint);
  front.position.set(0, s.bedY + wallH / 2, z0);
  root.add(front);
  parts.paint.push(front);
  const gate = new THREE.Mesh(blankUV(new THREE.BoxGeometry(w, wallH, 0.07)), paint);
  gate.position.set(0, s.bedY + wallH / 2, z1 + 0.035);
  root.add(gate);
  parts.paint.push(gate);
  const liner = new THREE.Mesh(new THREE.BoxGeometry(w - 0.14, 0.02, len - 0.12), M.std(0x161616, 0.9));
  liner.position.set(0, s.bedY + 0.01, zc);
  root.add(liner);
  // Rear bumper.
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(s.W - 0.1, 0.14, 0.16), s.chromeBumper ? M.chrome() : M.blackTrim());
  bumper.position.set(0, s.gc + 0.32, -L2 + 0.02);
  root.add(bumper);
}

function addRoofRails(root, s, prof) {
  for (const side of [1, -1]) {
    const len = s.zR1 - s.zR2 + 0.3;
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.04, len), M.std(0x1b1c1e, 0.4, 0.6));
    const zc = (s.zR1 + s.zR2) / 2;
    rail.position.set(side * (s.W / 2 - s.tumble - 0.12), s.H + 0.035, zc);
    root.add(rail);
  }
}

// ------------------------------------------------- instancing helpers

const PAINTS = [
  ['#f4f4f2', false, 16], ['#101112', true, 14], ['#b9bcc1', true, 13], ['#5f6368', true, 12],
  ['#1d3557', true, 6], ['#8b1a1a', true, 6], ['#c0392b', false, 3], ['#2e4a3a', true, 2],
  ['#3a6fb0', true, 4], ['#d7c9a7', true, 2], ['#6e2c48', true, 1], ['#e2b33b', false, 1],
  ['#2c2f35', true, 6], ['#9fa8b3', true, 4], ['#e6e1d6', true, 4], ['#4b5320', false, 1],
];

export function randomPaint(rng) {
  const total = PAINTS.reduce((a, p) => a + p[2], 0);
  let r = rng.next() * total;
  for (const p of PAINTS) { r -= p[2]; if (r <= 0) return { color: p[0], metallic: p[1] }; }
  return { color: PAINTS[0][0], metallic: PAINTS[0][1] };
}

/**
 * Makes a drivable/renderable instance of a model. Shares geometry, and
 * paint per color; lens materials are cloned so lights switch per car.
 */
export function instantiate(model, { color = '#c0c0c0', metallic = true, plate = 'SKV 1234' } = {}) {
  const root = model.template.clone(true);
  const paint = M.carPaint(color, { metallic, seamMap: model.seamTex });
  const lamps = { head: [], tail: [] };
  const headMat = model.lampsInfo.head[0].material.clone();
  const tailMat = model.lampsInfo.tail[0] ? model.lampsInfo.tail[0].material.clone() : null;
  const plateMat = new THREE.MeshStandardMaterial({ map: plateTexture(plate), roughness: 0.35, metalness: 0.1 });
  let hoodPivot = null, bay = null, battery = null;
  const wheels = [];
  root.traverse((o) => {
    if (o.isMesh) {
      if (o.userData.slot === 'paint') o.material = paint;
      if (o.userData.slot === 'head') { o.material = headMat; lamps.head.push(o); }
      if (o.userData.slot === 'tail') { o.material = tailMat; lamps.tail.push(o); }
      if (o.userData.part === 'plate') o.material = plateMat;
    }
  });
  // Re-find structural nodes in the clone by matching the template's tree.
  const tIndex = new Map();
  let k = 0;
  model.template.traverse((o) => tIndex.set(o, k++));
  const byIndex = [];
  root.traverse((o) => byIndex.push(o));
  hoodPivot = byIndex[tIndex.get(model.hoodPivot)];
  let terminals = null;
  if (model.bay) {
    bay = byIndex[tIndex.get(model.bay.group)];
    battery = byIndex[tIndex.get(model.bay.battery)];
    terminals = {
      pos: byIndex[tIndex.get(model.bay.terminals.pos)],
      neg: byIndex[tIndex.get(model.bay.terminals.neg)],
    };
  }
  for (const w of model.wheels) {
    wheels.push({
      pivot: byIndex[tIndex.get(w.pivot)],
      spin: byIndex[tIndex.get(w.spin)],
      lugs: w.lugs.map((l) => byIndex[tIndex.get(l)]),
      tire: byIndex[tIndex.get(w.tire)],
    });
  }
  return { root, paint, headMat, tailMat, lamps, hoodPivot, bay, battery, terminals, wheels };
}

export { mergeSimple };
