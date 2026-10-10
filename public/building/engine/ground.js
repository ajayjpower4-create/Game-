/* The ground: everything that is not an object on the lot.
 *
 * Fields roll away to a tree-lined horizon with a town in the haze; a street
 * runs along the front with kerbs, footways and markings; the yard is paved,
 * with concrete truck courts in front of the loading bays, a parking layout
 * with lines, accessible bays, wheel stops and planted islands, and paths and
 * crossings to every door. It is rebuilt whenever the plan changes. */

import * as THREE from 'three';
import { Builder } from './builder.js';
import * as M from './materials.js';
import { rng } from './textures.js';
import { corners, bounds } from '../geom.js';
import { PROP_BY_ID, footprint } from '../catalog.js';

const DEG = Math.PI / 180;

/* ------------------------------------------------------------- helpers */

/** An up-facing quad over a plan rectangle; UVs are world feet so tiles run on. */
function flat(b, mat, rect, y) {
  const c = corners(rect);                // NW, NE, SE, SW
  const p = [c[3], c[2], c[1], c[0]];     // counter-clockwise seen from above
  b.quad(mat, [p[0][0], y, p[0][1]], [p[1][0], y, p[1][1]], [p[2][0], y, p[2][1]], [p[3][0], y, p[3][1]],
    [p[0][0], p[0][1], p[1][0], p[1][1], p[2][0], p[2][1], p[3][0], p[3][1]]);
}

/** A raised slab over a plan rectangle (top at y0 + h). */
function slab(b, mat, rect, y0, h) {
  b.box(mat, rect.w, h, rect.d, rect.x + rect.w / 2, y0 + h / 2, rect.y + rect.d / 2, rect.rot ? [0, -rect.rot * DEG, 0] : null);
}

/** A painted stripe from one plan point to another. */
function stripe(b, mat, x0, z0, x1, z1, width, y) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  if (len < 0.05) return;
  const rot = Math.atan2(z1 - z0, x1 - x0) / DEG;
  flat(b, mat, { x: (x0 + x1) / 2 - len / 2, y: (z0 + z1) / 2 - width / 2, w: len, d: width, rot }, y);
}

/** Dashed stripe. */
function dashes(b, mat, x0, z0, x1, z1, width, y, dash, gap) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const ux = (x1 - x0) / len;
  const uz = (z1 - z0) / len;
  for (let t = 0; t < len; t += dash + gap) {
    const e = Math.min(len, t + dash);
    stripe(b, mat, x0 + ux * t, z0 + uz * t, x0 + ux * e, z0 + uz * e, width, y);
  }
}

/** Value noise for the terrain. */
function noise2(seed) {
  const r = rng(seed);
  const P = 64;
  const g = Array.from({ length: P * P }, () => r());
  const at = (i, j) => g[((j % P + P) % P) * P + ((i % P + P) % P)];
  return (x, y) => {
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = x - i;
    const fy = y - j;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    return at(i, j) * (1 - u) * (1 - v) + at(i + 1, j) * u * (1 - v) + at(i, j + 1) * (1 - u) * v + at(i + 1, j + 1) * u * v;
  };
}

/* Wheelchair symbol painted in accessible bays. */
let adaTex = null;
let adaMat = null;
function adaTexture() {
  if (adaTex) return adaTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#ffffff';
  g.lineWidth = 9;
  g.lineCap = 'round';
  g.beginPath(); g.arc(62, 20, 10, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(60, 36); g.lineTo(56, 74); g.lineTo(88, 74); g.lineTo(98, 104); g.stroke();
  g.beginPath(); g.moveTo(58, 52); g.lineTo(82, 52); g.stroke();
  g.lineWidth = 8;
  g.beginPath(); g.arc(56, 84, 26, Math.PI * 0.55, Math.PI * 1.75); g.stroke();
  adaTex = new THREE.CanvasTexture(c);
  adaTex.colorSpace = THREE.SRGBColorSpace;
  return adaTex;
}

/** Painted arrow (as a little shape) pointing along +z in its own frame. */
function arrowShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.6, 0); s.lineTo(0.6, 0); s.lineTo(0.6, 6); s.lineTo(1.8, 6); s.lineTo(0, 9); s.lineTo(-1.8, 6); s.lineTo(-0.6, 6); s.closePath();
  return s;
}

/* ---------------------------------------------------------------- build */

export function buildGround(state, plan) {
  const { lot } = state;
  const site = state.site || {};
  const W = lot.width;
  const D = lot.depth;
  const cx = W / 2;
  const cz = D / 2;
  const group = new THREE.Group();
  group.name = 'ground';
  const b = new Builder();
  const r = rng(Math.round(W * 7 + D * 13));

  const white = M.paint('#f2f1ea');
  const yellow = M.paint('#e7b416');
  const blue = M.paint('#1f5bb8');

  /* ---- terrain to the horizon ---- */
  {
    const size = 26000;
    const seg = 130;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const n = noise2(17);
    const rc = Math.max(W, D) * 0.9 + 500;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + cx;
      const z = pos.getZ(i) + cz;
      const d = Math.hypot(x - cx, z - cz);
      const k = THREE.MathUtils.smoothstep(d, rc, rc + 4500);
      const hill = (n(x / 2600, z / 2600) * 0.7 + n(x / 900, z / 900) * 0.3) * 260 - 60;
      // The street runs straight out of sight, so the ground stays level along it.
      const road = THREE.MathUtils.smoothstep(Math.abs(z - (D + 40)), 120, 900);
      pos.setXYZ(i, x, -0.35 + Math.max(-40, hill) * k * road, z);
      uv.setXY(i, x, z);
    }
    geo.computeVertexNormals();
    b.add(geo, M.field('#e8e6cf'));
  }

  /* ---- the lot itself: mown grass, with a low kerb around it ---- */
  if (site.grass !== false) {
    flat(b, M.grass('#f2f1e2'), { x: 0, y: 0, w: W, d: D + 3 }, 0.02);
  } else {
    flat(b, M.gravel(), { x: 0, y: 0, w: W, d: D + 3 }, 0.02);
  }

  /* ---- street ---- */
  if (site.road !== false) {
    const R = plan.road;
    const x0 = -9000;
    const x1 = W + 9000;
    // Footway on our side, from the lot line to the kerb.
    flat(b, M.paving(), { x: x0, y: D + 3, w: x1 - x0, d: R.kerb - (D + 3) + 0.5 }, 0.5);
    slab(b, M.kerb(), { x: x0, y: R.kerb, w: x1 - x0, d: 1 }, 0, 0.5);
    // Carriageway.
    flat(b, M.road(), { x: x0, y: R.y0 - 1, w: x1 - x0, d: R.y1 - R.y0 + 2 }, 0.04);
    const mid = (R.y0 + R.y1) / 2;
    // Double yellow centre line, white edge lines and a dashed lane line each side.
    stripe(b, yellow, x0, mid - 0.45, x1, mid - 0.45, 0.35, 0.07);
    stripe(b, yellow, x0, mid + 0.45, x1, mid + 0.45, 0.35, 0.07);
    stripe(b, white, x0, R.y0 + 1.2, x1, R.y0 + 1.2, 0.4, 0.07);
    stripe(b, white, x0, R.y1 - 1.2, x1, R.y1 - 1.2, 0.4, 0.07);
    // Far kerb, footway and verge.
    slab(b, M.kerb(), { x: x0, y: R.y1, w: x1 - x0, d: 1 }, 0, 0.5);
    flat(b, M.paving(), { x: x0, y: R.y1 + 1, w: x1 - x0, d: 8 }, 0.5);
    flat(b, M.grass('#f2f5ea'), { x: x0, y: R.y1 + 9, w: x1 - x0, d: 28 }, 0.03);
    // Where the drive and any side road meet the street, the footway drops
    // and the tarmac runs through to the carriageway.
    const mouths = [[plan.drive.x0, plan.drive.x1]];
    for (const o of state.objects) {
      if (o.kind !== 'prop' || !(PROP_BY_ID[o.type] || {}).road) continue;
      const bb = bounds(footprint(o));
      if (bb.y1 >= D - 4 && bb.y0 <= D + 12) mouths.push([bb.x0, bb.x1]);
    }
    for (const [mx0, mx1] of mouths) {
      flat(b, M.road(), { x: mx0, y: D - 2, w: mx1 - mx0, d: R.y0 - (D - 2) + 0.6 }, 0.54);
      for (const ex of [mx0 - 1.5, mx1 + 0.5]) slab(b, M.kerb(), { x: ex, y: D + 3, w: 1, d: R.kerb - D - 2 }, 0, 0.56);
    }
    // A crossing where the drive meets the street.
    const dx = plan.driveX;
    for (let z = R.y0 + 3; z < R.y1 - 3; z += 3) stripe(b, white, dx + 30, z, dx + 42, z, 1.5, 0.08);
    // Bus stop box and a "SLOW" by the entrance.
    stripe(b, yellow, dx + 90, R.y0 + 2, dx + 160, R.y0 + 2, 0.35, 0.08);
  }

  /* ---- yard paving ---- */
  const P = plan.pave;
  if (site.pavement !== false) {
    const pave = { x: P.x0, y: P.y0, w: P.x1 - P.x0, d: P.y1 - P.y0 };
    flat(b, M.asphalt(), pave, 0.16);
    // Edge kerb all round.
    slab(b, M.kerb(), { x: P.x0 - 0.8, y: P.y0 - 0.8, w: pave.w + 1.6, d: 0.8 }, 0, 0.45);
    slab(b, M.kerb(), { x: P.x0 - 0.8, y: P.y1, w: (plan.drive.x0 - P.x0) + 0.8, d: 0.8 }, 0, 0.45);
    slab(b, M.kerb(), { x: plan.drive.x1, y: P.y1, w: Math.max(0, P.x1 - plan.drive.x1 + 0.8), d: 0.8 }, 0, 0.45);
    slab(b, M.kerb(), { x: P.x0 - 0.8, y: P.y0, w: 0.8, d: pave.d }, 0, 0.45);
    slab(b, M.kerb(), { x: P.x1, y: P.y0, w: 0.8, d: pave.d }, 0, 0.45);
    // The drive out to the street.
    const dr = plan.drive;
    flat(b, M.asphalt(), { x: dr.x0, y: dr.y0, w: dr.x1 - dr.x0, d: dr.y1 - dr.y0 + 1 }, 0.17);
    if (site.markings !== false) {
      // Lane divider, arrows in and out, and a stop line at the gate.
      dashes(b, white, plan.driveX, dr.y0 - 40, plan.driveX, dr.y1 - 2, 0.4, 0.22, 8, 8);
      stripe(b, white, dr.x0 + 1, plan.gateY + 6, plan.driveX - 1, plan.gateY + 6, 1.2, 0.22);
      for (const [ax, az, rot] of [[plan.driveX - 12, dr.y1 - 30, Math.PI], [plan.driveX + 12, dr.y1 - 42, 0]]) {
        b.extrude(white, arrowShape(), 0.02, { pos: [ax, 0.2, az], rot: [-Math.PI / 2, 0, rot] });
      }
    }
  }

  /* ---- truck courts, roll-up aprons, paths ---- */
  for (const a of plan.aprons) {
    slab(b, M.concrete('#c9c6bf'), a.rect, 0, 0.24);
    if (site.markings !== false) {
      // Guide lines between the bays.
      const f = a.face;
      const step = 12;
      for (let t = a.t0; t <= a.t1 + 0.01; t += step) {
        const px = f.o[0] + f.u[0] * t;
        const pz = f.o[1] + f.u[1] * t;
        stripe(b, yellow, px + f.n[0] * 4, pz + f.n[1] * 4, px + f.n[0] * 54, pz + f.n[1] * 54, 0.45, 0.28);
      }
    }
  }
  for (const a of plan.rollAprons) slab(b, M.concrete('#cdcac3'), a.rect, 0, 0.22);
  for (const w of plan.walks) slab(b, M.paving(), w.rect, 0, 0.42);
  if (site.markings !== false) {
    for (const c of plan.crossings) {
      // Zebra stripes across the drive aisle in front of each entrance.
      const rc = c.at;
      const cs = corners(rc);
      const along = [cs[1][0] - cs[0][0], cs[1][1] - cs[0][1]];
      const len = Math.hypot(...along);
      const u = [along[0] / len, along[1] / len];
      const nrm = [cs[3][0] - cs[0][0], cs[3][1] - cs[0][1]];
      for (let t = 1; t < len - 1; t += 2.6) {
        const p0 = [cs[0][0] + u[0] * t, cs[0][1] + u[1] * t];
        stripe(b, white, p0[0], p0[1], p0[0] + nrm[0], p0[1] + nrm[1], 1.3, 0.21);
      }
    }
  }

  /* ---- parking ---- */
  if (site.parking !== false && site.pavement !== false) {
    const lineY = 0.21;
    const rows = new Map();
    for (const s of plan.stalls) {
      if (!rows.has(s.row)) rows.set(s.row, []);
      rows.get(s.row).push(s);
      if (site.markings !== false) {
        stripe(b, white, s.x, s.y, s.x, s.y + s.d, 0.33, lineY);
        stripe(b, white, s.x + s.w, s.y, s.x + s.w, s.y + s.d, 0.33, lineY);
        if (s.ada) {
          flat(b, blue, { x: s.x + 0.4, y: s.y + 0.4, w: s.w - 0.8, d: s.d - 0.8 }, lineY - 0.005);
          const mat = adaMat || (adaMat = M.signFace(adaTexture()));
          b.quad(mat, [s.x + 1.5, lineY + 0.01, s.y + 10.5], [s.x + s.w - 1.5, lineY + 0.01, s.y + 10.5], [s.x + s.w - 1.5, lineY + 0.01, s.y + 4.5], [s.x + 1.5, lineY + 0.01, s.y + 4.5], [0, 0, 1, 0, 1, 1, 0, 1]);
        }
      }
    }
    for (const w of plan.wheelStops) slab(b, M.concrete('#d9d5c8'), w, 0.16, 0.45);
    for (const isl of plan.islands) {
      slab(b, M.kerb(), isl, 0, 0.55);
      flat(b, M.grass('#ffffff'), { x: isl.x + 0.6, y: isl.y + 0.6, w: isl.w - 1.2, d: isl.d - 1.2 }, 0.58);
      // A clipped shrub or two.
      for (let k = 0; k < 2; k++) {
        b.sphere(M.leaves(k % 3), 1.8 + r() * 0.8, isl.x + isl.w / 2, 1.6, isl.y + 4 + k * (isl.d - 8), { sy: 0.7, seg: 9 });
      }
    }
  }

  b.finish(group);

  /* ---- scenery beyond the lot: tree belts and a town in the haze ---- */
  group.add(scenery(state, plan, r));
  group.traverse((o) => { if (o.isMesh) o.userData.ground = true; });
  return group;
}

function scenery(state, plan, r) {
  const { lot } = state;
  const W = lot.width;
  const D = lot.depth;
  const out = new THREE.Group();
  const roadZ = (plan.road.y0 + plan.road.y1) / 2;
  const clear = (x, z, pad) => !(x > -pad && x < W + pad && z > -pad && z < D + 90 + pad) && Math.abs(z - roadZ) > 70;

  // Tree clumps: one instanced mesh of lumpy canopies, coloured per tree.
  const crown = new THREE.IcosahedronGeometry(1, 1);
  {
    const p = crown.attributes.position;
    const n = noise2(5);
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i);
      const k = 0.82 + n(v.x * 3 + 9, v.z * 3 + v.y * 2 + 9) * 0.4;
      p.setXYZ(i, v.x * k, v.y * k, v.z * k);
    }
    crown.computeVertexNormals();
    const uv = crown.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i) * 6);
  }
  const spots = [];
  // Belts: lines of trees along field boundaries, and loose woods further out.
  for (let belt = 0; belt < 26; belt++) {
    const ang = r() * Math.PI * 2;
    const dist = 650 + r() * 3600;
    const bx = W / 2 + Math.cos(ang) * dist;
    const bz = D / 2 + Math.sin(ang) * dist;
    const dir = r() * Math.PI;
    const len = 300 + r() * 1400;
    for (let t = -len / 2; t < len / 2; t += 16 + r() * 22) {
      const x = bx + Math.cos(dir) * t + (r() - 0.5) * 30;
      const z = bz + Math.sin(dir) * t + (r() - 0.5) * 30;
      if (clear(x, z, 140)) spots.push([x, z, 14 + r() * 16]);
    }
  }
  for (let i = 0; i < 520; i++) {
    const ang = r() * Math.PI * 2;
    const dist = 420 + Math.pow(r(), 0.7) * 5200;
    const x = W / 2 + Math.cos(ang) * dist;
    const z = D / 2 + Math.sin(ang) * dist;
    if (clear(x, z, 120)) spots.push([x, z, 12 + r() * 18]);
  }
  const leafMats = [M.leaves(0), M.leaves(1), M.leaves(2)];
  const trunk = new THREE.CylinderGeometry(0.5, 0.7, 1, 6).translate(0, 0.5, 0);
  for (let v = 0; v < 3; v++) {
    const mine = spots.filter((_, i) => i % 3 === v);
    const crowns = new THREE.InstancedMesh(crown, leafMats[v], mine.length);
    const trunks = new THREE.InstancedMesh(trunk, M.bark(), mine.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    mine.forEach(([x, z, s], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28);
      m.compose(new THREE.Vector3(x, s * 0.95, z), q, new THREE.Vector3(s * 0.55, s * 0.62, s * 0.55));
      crowns.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(x, -0.3, z), q, new THREE.Vector3(s * 0.08, s * 0.6, s * 0.08));
      trunks.setMatrixAt(i, m);
    });
    crowns.castShadow = true;
    crowns.receiveShadow = true;
    trunks.castShadow = true;
    crowns.computeBoundingSphere();
    trunks.computeBoundingSphere();
    out.add(crowns, trunks);
  }

  // Far-off buildings: a business park to one side, a town skyline beyond.
  const boxes = [];
  for (let i = 0; i < 70; i++) {
    const ang = (r() < 0.5 ? -0.5 : 2.6) + (r() - 0.5) * 1.4;
    const dist = 1500 + r() * 4500;
    const x = W / 2 + Math.cos(ang) * dist;
    const z = D / 2 + Math.sin(ang) * dist * 0.8 - 400;
    if (!clear(x, z, 300)) continue;
    const tall = dist > 4200 && r() < 0.35;
    boxes.push({ x, z, w: 60 + r() * 260, d: 50 + r() * 200, h: tall ? 70 + r() * 160 : 18 + r() * 34, rot: r() * 0.4 - 0.2, tone: r() });
  }
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const tones = [M.wall('precast', '#cfd4da'), M.wall('composite', '#9aa3ad'), M.wall('brick', '#a86b55')];
  tones.forEach((mat, t) => {
    const mine = boxes.filter((bx) => Math.floor(bx.tone * 3) === t);
    if (!mine.length) return;
    const inst = new THREE.InstancedMesh(box, mat, mine.length);
    const m = new THREE.Matrix4();
    mine.forEach((bx, i) => {
      m.compose(new THREE.Vector3(bx.x, -0.5, bx.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), bx.rot), new THREE.Vector3(bx.w, bx.h, bx.d));
      inst.setMatrixAt(i, m);
    });
    inst.castShadow = false;
    inst.receiveShadow = true;
    inst.computeBoundingSphere();
    out.add(inst);
  });
  out.traverse((o) => { o.userData.noPick = true; });
  return out;
}
