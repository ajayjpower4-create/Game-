/* More props: pavement stencils and symbols, drainage, and (further down)
 * playgrounds, garden tools and the dealership kit. Same contract as the
 * builders in props.js: (B, o, { w, d, h }, ctx), in the prop's own frame —
 * x across, y up, z toward its front — standing on y = 0. */

import * as THREE from 'three';
import { cylGeo } from './builder.js';
import * as M from './materials.js';
import { rng } from './textures.js';
import { stencilMat, flat } from './marks.js';
import { Builder } from './builder.js';
import { lotLayout } from '../lots.js';
import { panelTexture } from './textures.js';
import { vehicleModel } from './vehicles.js';

const PI = Math.PI;
const PAINT_Y = 0.215;   // props stand at 0.02; paint lies just over the asphalt

/* ------------------------------------------------------------ paint */

/** A flat shape (THREE.Shape in x across, y forward) painted on the ground. */
function paintShape(B, mat, shape, y = PAINT_Y) {
  const g = new THREE.ShapeGeometry(shape, 6).rotateX(-PI / 2);
  B.add(g, mat, { pos: [0, y, 0] });
}

/** Arrow outlines in feet, pointing forward (-z): stem, head, and turns. */
function arrowShape(kind) {
  const s = new THREE.Shape();
  const stem = 0.5;      // half the stem width
  const head = 1.4;      // half the head width
  const L = 9;           // overall length
  const hl = 3;          // head length
  const y0 = -L / 2;
  if (kind === 'straight') {
    s.moveTo(-stem, y0); s.lineTo(stem, y0); s.lineTo(stem, L / 2 - hl); s.lineTo(head, L / 2 - hl);
    s.lineTo(0, L / 2); s.lineTo(-head, L / 2 - hl); s.lineTo(-stem, L / 2 - hl); s.closePath();
    return [s];
  }
  // A turn: the stem rises, bends, and the head points left (or right).
  const dir = kind === 'right' || kind === 'straightright' ? 1 : -1;
  const out = [];
  const t = new THREE.Shape();
  const bendY = 0.6;
  t.moveTo(-stem, y0); t.lineTo(stem, y0); t.lineTo(stem, bendY + stem);
  t.lineTo(-stem, bendY + stem); t.closePath();
  out.push(t);
  // The arm and its head, out to the side.
  const arm = new THREE.Shape();
  const ax = dir * 2.0;
  const pts = [[0, bendY - stem], [ax, bendY - stem], [ax, bendY - head], [ax + dir * hl * 0.9, bendY], [ax, bendY + head], [ax, bendY + stem], [0, bendY + stem]];
  if (dir < 0) pts.reverse();
  arm.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) arm.lineTo(x, y);
  arm.closePath();
  out.push(arm);
  if (kind.startsWith('straight')) {
    const up = new THREE.Shape();
    up.moveTo(-stem, bendY); up.lineTo(stem, bendY); up.lineTo(stem, L / 2 - hl); up.lineTo(head, L / 2 - hl);
    up.lineTo(0, L / 2); up.lineTo(-head, L / 2 - hl); up.lineTo(-stem, L / 2 - hl); up.closePath();
    out.push(up);
  }
  return out;
}

let ISA = null;
/** The accessible symbol: white on blue, drawn rather than typed (no font needed). */
function isaMat() {
  if (ISA) return ISA;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#1f5fb4';
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = g.fillStyle = '#ffffff';
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = 18;
  g.beginPath(); g.arc(118, 52, 18, 0, PI * 2); g.fill();
  g.beginPath(); g.moveTo(112, 82); g.lineTo(106, 146); g.lineTo(170, 146); g.lineTo(196, 206); g.stroke();
  g.beginPath(); g.moveTo(108, 108); g.lineTo(156, 108); g.stroke();
  g.lineWidth = 15;
  g.beginPath(); g.arc(110, 170, 52, -PI * 0.15, PI * 1.25); g.stroke();
  g.lineWidth = 10;
  g.strokeRect(10, 10, 236, 236);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  ISA = new THREE.MeshStandardMaterial({ map: t, roughness: 0.65, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  return ISA;
}

let EV = null;
function evMat() {
  if (EV) return EV;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#1f8a4c';
  g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#ffffff';
  // Lightning bolt over the letters EV.
  g.beginPath();
  g.moveTo(140, 22); g.lineTo(84, 116); g.lineTo(124, 116); g.lineTo(104, 176); g.lineTo(172, 84); g.lineTo(132, 84); g.lineTo(156, 22);
  g.closePath(); g.fill();
  g.font = '900 64px Arial, Helvetica, sans-serif';
  g.textAlign = 'center';
  g.fillText('EV', 128, 238);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 10;
  g.strokeRect(10, 10, 236, 236);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  EV = new THREE.MeshStandardMaterial({ map: t, roughness: 0.65, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  return EV;
}

/* ------------------------------------------------------------ drains */

const IRON = () => M.painted('#3a3734', 0.7);
const VOID = () => M.plastic('#050505', 1);

/** A bar grate: a frame and bars across it, the dark of the pit showing between. */
function grate(B, w, d, y, { bars = 9, along = false } = {}) {
  B.box(VOID(), w - 0.1, 0.02, d - 0.1, 0, y - 0.03, 0);
  const t = 0.12;
  for (const s of [-1, 1]) {
    B.box(IRON(), w, 0.06, t, 0, y, s * (d / 2 - t / 2));
    B.box(IRON(), t, 0.06, d, s * (w / 2 - t / 2), y, 0);
  }
  const n = bars;
  for (let i = 1; i < n; i++) {
    const k = -0.5 + i / n;
    if (along) B.box(IRON(), 0.07, 0.06, d - 0.1, k * (w - 0.1), y, 0);
    else B.box(IRON(), w - 0.1, 0.06, 0.07, 0, y, k * (d - 0.1));
  }
  // Cross ties under the bars.
  B.box(IRON(), along ? w - 0.1 : 0.08, 0.04, along ? 0.08 : d - 0.1, 0, y - 0.015, 0);
}

const COVERS = new Map();
/** A cast-iron cover's face: a waffle pattern and a word round it. */
function coverMat(word) {
  if (COVERS.has(word)) return COVERS.get(word);
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d');
  g.fillStyle = '#4a4744';
  g.fillRect(0, 0, s, s);
  g.save();
  g.beginPath(); g.arc(s / 2, s / 2, s * 0.36, 0, PI * 2); g.clip();
  g.fillStyle = '#2e2c2a';
  for (let y = 0; y < s; y += 16) for (let x = (y / 16) % 2 ? 8 : 0; x < s; x += 16) g.fillRect(x + 3, y + 3, 9, 9);
  g.restore();
  g.strokeStyle = '#2e2c2a';
  g.lineWidth = 6;
  for (const r of [0.37, 0.47]) { g.beginPath(); g.arc(s / 2, s / 2, s * r, 0, PI * 2); g.stroke(); }
  g.fillStyle = '#6b6762';
  g.font = '800 26px Arial, Helvetica, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const letters = word.split('');
  letters.forEach((ch, i) => {
    const a = -PI / 2 + (i - (letters.length - 1) / 2) * 0.2;
    g.save();
    g.translate(s / 2 + Math.cos(a) * s * 0.42, s / 2 + Math.sin(a) * s * 0.42);
    g.rotate(a + PI / 2);
    g.fillText(ch, 0, 0);
    g.restore();
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  // Cast iron reads as dull grey, not a mirror: a little metal, mostly rough.
  const m = new THREE.MeshStandardMaterial({ map: t, color: new THREE.Color('#d8d4cf'), roughness: 0.72, metalness: 0.35, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  COVERS.set(word, m);
  return m;
}

function cover(B, r, x, z, word, y = 0.215) {
  B.add(new THREE.CircleGeometry(r, 36).rotateX(-PI / 2), coverMat(word), { pos: [x, y + 0.012, z] });
  B.add(new THREE.TorusGeometry(r + 0.03, 0.05, 6, 36).rotateX(PI / 2).scale(1, 1, 0.4), IRON(), { pos: [x, y, z] });
  B.add(cylGeo(r + 0.22, r + 0.22, 0.05, 36), M.concrete('#a9a69e'), { pos: [x, y - 0.015, z] });
}

/* ------------------------------------------------------------ builders */

export const MORE = {
  /* ---- pavement stencils ---- */
  stencil(B, o, { w, d }) {
    const s = o.sign || {};
    const text = (s.text || 'STOP').replace(/\s*\|\s*/g, '\n');
    const lines = text.split('\n').length;
    flat(B, stencilMat(text, s.color || '#f4f2ea', { aspect: (w / d) * lines }), 0, 0, 0, -1, d, w, PAINT_Y);
  },
  arrowstraight(B, o) { for (const s of arrowShape('straight')) paintShape(B, M.paint(o.color || '#f4f2ea'), s); },
  arrowleft(B, o) { for (const s of arrowShape('left')) paintShape(B, M.paint(o.color || '#f4f2ea'), s); },
  arrowright(B, o) { for (const s of arrowShape('right')) paintShape(B, M.paint(o.color || '#f4f2ea'), s); },
  arrowstraightleft(B, o) { for (const s of arrowShape('straightleft')) paintShape(B, M.paint(o.color || '#f4f2ea'), s); },
  arrowstraightright(B, o) { for (const s of arrowShape('straightright')) paintShape(B, M.paint(o.color || '#f4f2ea'), s); },
  paintada(B, o, { w, d }) { flat(B, isaMat(), 0, 0, 0, -1, d, w, PAINT_Y); },
  paintev(B, o, { w, d }) { flat(B, evMat(), 0, 0, 0, -1, d, w, PAINT_Y); },

  /* ---- drainage ---- */
  catchbasin(B, o, { w, d }) {
    // A cast-iron grate in a concrete collar, the asphalt dished and stained round it.
    B.add(new THREE.CircleGeometry(w * 0.9, 28).rotateX(-PI / 2), stain(), { pos: [0, 0.205, 0] });
    B.box(M.concrete('#a9a69e'), w, 0.06, d, 0, 0.19, 0);
    grate(B, w - 0.9, d - 0.9, 0.235, { bars: 11, along: true });
  },
  curbinlet(B, o, { w, d }) {
    // A kerb inlet: the kerb box with its mouth, a grate in the gutter in front.
    const conc = M.concrete('#b4b1a9');
    B.box(conc, w, 0.72, d * 0.45, 0, 0.36, -d * 0.275);
    B.box(VOID(), w - 1.2, 0.3, 0.12, 0, 0.32, -d * 0.05 + 0.02);
    B.box(conc, w - 1.2, 0.1, 0.2, 0, 0.53, -d * 0.04);
    B.box(M.concrete('#a9a69e'), w, 0.06, d * 0.55, 0, 0.19, d * 0.225);
    grate(B, w - 1.6, d * 0.42, 0.235, { bars: 13, along: true });
    // "No dumping" plaque on the kerb top.
    flat(B, stencilMat('NO DUMPING\nDRAINS TO RIVER', '#1f4f9c', { aspect: 1.6, weight: 800 }), 0, -d * 0.275, 0, 1, 0.75, 1.2, 0.725);
  },
  manhole(B, o, { w }) {
    cover(B, w / 2 - 0.25, 0, 0, 'STORM SEWER');
  },
  sewer(B, o, { w }) {
    cover(B, w / 2 - 0.25, 0, 0, 'SANITARY SEWER');
  },
  areadrain(B, o, { w }) {
    // A round plastic grate in the lawn, on a little concrete ring.
    B.add(cylGeo(w / 2, w / 2, 0.08, 24), M.concrete('#b9b6ae'), { pos: [0, 0.04, 0] });
    B.add(new THREE.CircleGeometry(w / 2 - 0.12, 24).rotateX(-PI / 2), M.plastic('#1d2b22', 0.7), { pos: [0, 0.085, 0] });
    for (let k = 0; k < 4; k++) B.add(new THREE.TorusGeometry((w / 2 - 0.15) * (0.3 + k * 0.22), 0.025, 4, 24).rotateX(PI / 2), M.plastic('#2c3d31', 0.6), { pos: [0, 0.09, 0] });
    for (let k = 0; k < 6; k++) B.box(M.plastic('#2c3d31', 0.6), w - 0.3, 0.03, 0.05, 0, 0.095, 0, [0, (k * PI) / 6, 0]);
  },
  oilsep(B, o, { w, d }) {
    B.box(M.concrete('#b4b1a9'), w, 0.08, d, 0, 0.18, 0);
    for (const x of [-w / 3, 0, w / 3]) cover(B, Math.min(1.1, d / 2 - 0.4), x, 0, 'INTERCEPTOR', 0.235);
  },
  headwall(B, o, { w, d, h }) {
    // A culvert outfall: a concrete headwall with wing walls, the pipe mouth
    // and a riprap apron of loose rock where the water comes out.
    const conc = M.concrete('#b7b3aa');
    const back = -d / 2 + 1;
    B.box(conc, w, h, 1.2, 0, h / 2, back);
    for (const s of [-1, 1]) B.box(conc, 0.9, h * 0.8, 4.5, s * (w / 2 - 0.6), h * 0.4, back + 2.4, [0, s * 0.35, 0]);
    const r = Math.min(1.6, h * 0.38);
    B.add(cylGeo(r + 0.25, r + 0.25, 1.0, 28, true).rotateX(PI / 2), M.concrete('#a39f96'), { pos: [0, r + 0.35, back + 0.9] });
    B.add(new THREE.CircleGeometry(r, 28), VOID(), { pos: [0, r + 0.35, back + 0.55] });
    B.add(new THREE.RingGeometry(r, r + 0.25, 28), M.concrete('#a39f96'), { pos: [0, r + 0.35, back + 1.4] });
    const rr = rng(77);
    for (let i = 0; i < 60; i++) {
      const s = 0.4 + rr() * 0.6;
      const g = new THREE.IcosahedronGeometry(s, 0);
      B.add(g, M.rock('#8f8b84'), { pos: [(rr() - 0.5) * (w - 2), s * 0.35, back + 1.5 + rr() * (d - 3)], rot: [rr() * 3, rr() * 3, 0], scale: [1.2, 0.7, 1] });
    }
  },
};

let STAIN = null;
/** A soft dark ring of grime round a drain. */
function stain() {
  if (STAIN) return STAIN;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  grd.addColorStop(0, 'rgba(10,10,10,0.55)');
  grd.addColorStop(1, 'rgba(10,10,10,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  STAIN = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  return STAIN;
}

/* ------------------------------------------------------------ dealership */

const PENNANT = ['#c8241b', '#f4f4f2', '#1f5fb4', '#f2c318'];

/** A string of pennants hung between two points, sagging in the middle. */
function pennantString(B, a, b, sag = 1.2) {
  const L = Math.hypot(b[0] - a[0], b[2] - a[2]);
  const n = Math.max(2, Math.floor(L / 1.25));
  const fx = (b[0] - a[0]) / L;
  const fz = (b[2] - a[2]) / L;
  let prev = a;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * PI) * sag, a[2] + (b[2] - a[2]) * t];
    if (i) B.tube(M.plastic('#d9d9d6', 0.6), prev, p, 0.02, 3);
    if (i < n) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, fx * 0.95, 0, fz * 0.95, fx * 0.47, -1.15, fz * 0.47], 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1], 2));
      g.setIndex([0, 1, 2]);
      g.computeVertexNormals();
      B.add(g, M.fabric(PENNANT[i % PENNANT.length]), { pos: [p[0] + fx * 0.15, p[1] - 0.02, p[2] + fz * 0.15] });
    }
    prev = p;
  }
}

function pennantPole(B, x, z, h) {
  B.add(cylGeo(0.12, 0.16, h, 8), M.metal('#9aa1a8', 0.4), { pos: [x, h / 2, z] });
  B.add(new THREE.SphereGeometry(0.22, 10, 6), M.metal('#d6b45a', 0.3), { pos: [x, h + 0.15, z] });
}

/** What a dealer lot adds to a car park: display ramps along its front row and pennant strings round it. */
export function dealerDress(B, o, { w, d }) {
  const L = lotLayout({ ...o, w, d });
  const front = L.rows.length - 1;
  if (o.ramps !== false) {
    const steel = M.painted('#2b3036', 0.45);
    const deck = M.metal('#aeb4ba', 0.45);
    for (const st of L.stalls) {
      if (st.row !== front) continue;
      // A ramp under the car, rising toward the street (+y) so the car noses up at the road.
      const ax = st.ay < 0 ? -st.ax : st.ax;
      const ay = st.ay < 0 ? -st.ay : st.ay;
      const yaw = Math.atan2(ax, ay);
      const make = (g, mat, y) => B.add(g.rotateX(-0.12).rotateY(yaw), mat, { pos: [st.x, y, st.y] });
      make(new THREE.BoxGeometry(7.4, 0.25, 15.5), deck, 1.11 - 0.14);
      for (const sx of [-3.4, 3.4]) {
        const g = new THREE.BoxGeometry(0.35, 0.6, 15.5).translate(sx, 0, 0);
        make(g, steel, 1.11 - 0.45);
      }
      // The high end stands on legs.
      const hx = st.x + ax * 7.3;
      const hz = st.y + ay * 7.3;
      B.box(steel, 7, 1.8, 0.4, hx, 0.2 + 0.9, hz, [0, yaw, 0]);
    }
  }
  if (o.pennants !== false) {
    const h = 15;
    const span = 36;
    const n = Math.max(1, Math.round(w / span));
    const pts = [];
    for (let i = 0; i <= n; i++) pts.push([-w / 2 + 1 + ((w - 2) * i) / n, h, d / 2 - 1]);
    const side = Math.max(1, Math.round(d / span));
    const left = [];
    const right = [];
    for (let i = 0; i <= side; i++) {
      left.push([-w / 2 + 1, h, d / 2 - 1 - ((d - 2) * i) / side]);
      right.push([w / 2 - 1, h, d / 2 - 1 - ((d - 2) * i) / side]);
    }
    for (const run of [pts, left, right]) {
      run.forEach((p, i) => { pennantPole(B, p[0], p[2], h); if (i) pennantString(B, run[i - 1], p); });
    }
  }
}

Object.assign(MORE, {
  displayramp(B, o) {
    const steel = M.painted(o.color || '#2b3036', 0.45);
    B.add(new THREE.BoxGeometry(7.4, 0.25, 15.5).rotateX(-0.12), M.metal('#aeb4ba', 0.45), { pos: [0, 1.0, 0] });
    for (const sx of [-3.4, 3.4]) B.add(new THREE.BoxGeometry(0.35, 0.6, 15.5).rotateX(-0.12), steel, { pos: [sx, 0.7, 0] });
    B.box(steel, 7, 1.8, 0.4, 0, 0.9, 7.3);
  },
  turntable(B, o, { w }, ctx) {
    // A low drum with an LED ring, the deck turning slowly with a car on it.
    const r = w / 2;
    B.add(cylGeo(r, r + 0.15, 0.9, 48), M.painted('#2b3036', 0.35), { pos: [0, 0.45, 0] });
    B.add(new THREE.TorusGeometry(r + 0.08, 0.06, 6, 64).rotateX(PI / 2), M.led('#cfe8ff'), { pos: [0, 0.75, 0] });
    const deck = new Builder();
    deck.add(cylGeo(r - 0.3, r - 0.3, 0.12, 48), M.metal('#c9ced3', 0.3), { pos: [0, 0, 0] });
    for (let k = 0; k < 24; k++) deck.box(M.metal('#9aa1a8', 0.35), r * 1.8, 0.02, 0.05, 0, 0.065, 0, [0, (k * PI) / 24, 0]);
    const g = deck.finish(new THREE.Group());
    const car = vehicleModel(o.car || 'chevrolet-corvette', o.color || null, 6, 15, 4.5).finish(new THREE.Group());
    car.position.y = 0.07;
    g.add(car);
    g.position.y = 0.96;
    g.userData.turn = 0.25;
    ctx.moving.push(g);
  },
  pennants(B, o, { w }) {
    const h = 15;
    pennantPole(B, -w / 2 + 0.2, 0, h);
    pennantPole(B, w / 2 - 0.2, 0, h);
    pennantString(B, [-w / 2 + 0.2, h, 0], [w / 2 - 0.2, h, 0], Math.min(3, w / 25));
  },
  airdancer(B, o, dims, ctx) {
    // A fan box, and a tube figure that never stops waving.
    B.box(M.painted('#2b3036', 0.5), 2.6, 1.6, 2.6, 0, 0.8, 0);
    B.add(cylGeo(1.0, 1.0, 0.2, 20), M.metal('#7d858c', 0.4), { pos: [0, 1.65, 0] });
    const fig = new Builder();
    const body = M.fabric(o.color || '#e8341c');
    fig.add(cylGeo(0.9, 0.95, 9, 16, true), body, { pos: [0, 4.5, 0] });
    fig.add(cylGeo(0.75, 0.9, 5, 16, true), body, { pos: [0, 11.5, 0], rot: [0, 0, 0.12] });
    fig.add(new THREE.SphereGeometry(0.9, 14, 10), body, { pos: [0.3, 14.6, 0] });
    for (const s of [-1, 1]) fig.add(cylGeo(0.35, 0.4, 5, 10, true), body, { pos: [s * 2.6, 10.5, 0], rot: [0, 0, s * 1.0] });
    fig.add(new THREE.SphereGeometry(0.22, 8, 6), M.plastic('#ffffff', 0.4), { pos: [0.05, 14.8, 0.82] });
    fig.add(new THREE.SphereGeometry(0.22, 8, 6), M.plastic('#ffffff', 0.4), { pos: [0.6, 14.8, 0.78] });
    fig.add(new THREE.TorusGeometry(0.35, 0.07, 6, 12, PI), M.plastic('#1a1a1a', 0.5), { pos: [0.32, 14.25, 0.86], rot: [0, 0, PI] });
    const g = fig.finish(new THREE.Group());
    g.position.y = 1.7;
    g.userData.sway = { phase: (o.x || 0) * 0.37 };
    ctx.moving.push(g);
  },
  dealersign(B, o, { w, d, h }, ctx) {
    const s = o.sign || {};
    B.slab(M.concrete('#a8a59d'), w + 1, 1.2, d + 1, 0, 0, 0);
    B.slab(M.painted('#2b3036', 0.4), w * 0.3, h - 1.2, d * 0.8, 0, 1.2, 0);
    const pw = w;
    const ph = h * 0.42;
    B.slab(M.painted(s.bg || '#1f4f9c', 0.35), pw, ph, d, 0, h - ph, 0);
    const tex = panelTexture({ text: s.text || 'AUTO MALL', sub: s.sub || 'NEW · USED · SERVICE', logo: s.logo || '', color: s.color || '#ffffff', bg: s.bg || '#1f4f9c', aspect: (pw - 0.8) / (ph - 0.8) });
    const mat = M.signFace(tex);
    ctx.disposables.push(tex, mat);
    for (const sd of [1, -1]) {
      const z = sd * (d / 2 + 0.02);
      const hw = (pw - 0.8) / 2;
      const y0 = h - ph + 0.4;
      const y1 = h - 0.4;
      if (sd > 0) B.quad(mat, [-hw, y0, z], [hw, y0, z], [hw, y1, z], [-hw, y1, z], [0, 0, 1, 0, 1, 1, 0, 1]);
      else B.quad(mat, [hw, y0, z], [-hw, y0, z], [-hw, y1, z], [hw, y1, z], [0, 0, 1, 0, 1, 1, 0, 1]);
    }
    // A strip of price panels under the name.
    B.slab(M.painted('#f4f4f2', 0.4), pw * 0.8, h * 0.12, d * 0.9, 0, h - ph - h * 0.14, 0);
  },
  servicesign(B, o, { w, d, h }, ctx) {
    const s = o.sign || {};
    for (const sx of [-w / 2 + 0.4, w / 2 - 0.4]) B.add(cylGeo(0.2, 0.2, h, 10), M.metal('#5d646c', 0.4), { pos: [sx, h / 2, 0] });
    const ph = 2.6;
    B.box(M.painted(s.bg || '#1d2c44', 0.4), w, ph, d * 0.4, 0, h - ph / 2, 0);
    const tex = panelTexture({ text: s.text || 'SERVICE', sub: s.sub || 'DRIVE IN · CLEARANCE 10 FT', color: s.color || '#ffffff', bg: s.bg || '#1d2c44', aspect: (w - 0.4) / (ph - 0.3) });
    const mat = M.signFace(tex);
    ctx.disposables.push(tex, mat);
    const hw = (w - 0.4) / 2;
    const y0 = h - ph + 0.15;
    const y1 = h - 0.15;
    const z = d * 0.2 + 0.02;
    B.quad(mat, [-hw, y0, z], [hw, y0, z], [hw, y1, z], [-hw, y1, z], [0, 0, 1, 0, 1, 1, 0, 1]);
    B.quad(mat, [hw, y0, -z], [-hw, y0, -z], [-hw, y1, -z], [hw, y1, -z], [0, 0, 1, 0, 1, 1, 0, 1]);
    // Clearance bar hanging below.
    for (const sx of [-w / 2 + 0.4, w / 2 - 0.4]) B.add(cylGeo(0.03, 0.03, 1.2, 6), M.metal('#5d646c', 0.4), { pos: [sx * 0.8, h - ph - 0.6, 0] });
    B.add(cylGeo(0.18, 0.18, w * 0.8, 12).rotateZ(PI / 2), M.painted('#f2c318', 0.5), { pos: [0, h - ph - 1.25, 0] });
  },
  keydrop(B, o, { w, d, h }) {
    B.slab(M.concrete('#a8a59d'), w + 0.6, 0.3, d + 0.6, 0, 0, 0);
    B.slab(M.painted('#2b3036', 0.4), w, h - 0.3, d, 0, 0.3, 0);
    B.box(M.metal('#c9ced3', 0.3), w * 0.6, 0.25, 0.05, 0, h - 1.0, d / 2 + 0.02);
    flat(B, stencilMat('KEY DROP', '#ffffff', { aspect: 3 }), 0, d / 2 + 0.03, 0, 1, 0.4, w * 0.8, h - 0.55);
  },
  tyrerack(B, o, { w, d, h }) {
    const frame = M.painted('#c8241b', 0.45);
    for (const sx of [-w / 2 + 0.2, w / 2 - 0.2]) for (const sz of [-d / 2 + 0.2, d / 2 - 0.2]) B.box(frame, 0.15, h, 0.15, sx, h / 2, sz);
    for (const y of [1.2, 3.4, 5.6]) {
      B.box(frame, w, 0.12, d, 0, y - 0.95, 0);
      for (let x = -w / 2 + 1; x < w / 2 - 0.5; x += 1.25) {
        B.add(new THREE.TorusGeometry(0.8, 0.32, 10, 24), M.tread(), { pos: [x, y, 0], rot: [0, PI / 2 - 0.25, 0] });
        B.add(cylGeo(0.5, 0.5, 0.5, 18).rotateZ(PI / 2), M.alloy('#c9ced3', 0.25), { pos: [x, y, 0], rot: [0, -0.25, 0] });
      }
    }
  },
});

/* ------------------------------------------------------------ playground */

const STEEL = (hex) => M.painted(hex, 0.38);
const HDPE = (hex) => M.plastic(hex, 0.42);

/** A chain from a to b, as a row of small links. */
function chain(B, a, b, links = 14) {
  const mat = M.metal('#a9b0b6', 0.35);
  for (let i = 0; i < links; i++) {
    const t = (i + 0.5) / links;
    const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    B.add(new THREE.TorusGeometry(0.07, 0.018, 4, 8).rotateY(i % 2 ? PI / 2 : 0).scale(1, 1.6, 1), mat, { pos: p });
  }
}

/** Engineered wood fibre (or rubber) under play equipment, in a timber border. */
function safetySurface(B, w, d, kind = 'mulch-brown') {
  B.box(M.groundCover(kind), w - 0.6, 0.1, d - 0.6, 0, 0.12, 0);
  const timber = M.wood('#7a5c3e');
  for (const s of [-1, 1]) {
    B.box(timber, w, 0.5, 0.5, 0, 0.25, s * (d / 2 - 0.25));
    B.box(timber, 0.5, 0.5, d, s * (w / 2 - 0.25), 0.25, 0);
  }
}

/** A tube slide from a deck down to the ground, curving in plan. */
function slide(B, x, y, z, len, dir, hex) {
  const mat = HDPE(hex);
  const n = 10;
  const dx = Math.sin(dir);
  const dz = Math.cos(dir);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const yy = y * (1 - t) ** 1.25 + 0.9 * t;
    pts.push(new THREE.Vector3(x + dx * len * t, Math.max(0.9, yy), z + dz * len * t));
  }
  // An open trough: a half pipe swept down the run.
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const L = a.distanceTo(b);
    const g = new THREE.CylinderGeometry(1.2, 1.2, L + 0.05, 16, 1, true, PI / 2, PI).rotateZ(PI / 2);
    const m = new THREE.Matrix4().lookAt(a, b, new THREE.Vector3(0, 1, 0));
    g.rotateY(PI / 2).applyMatrix4(new THREE.Matrix4().extractRotation(m)).translate(mid.x, mid.y + 0.6, mid.z);
    B.add(g, mat);
  }
}

Object.assign(MORE, {
  swingset(B, o, { w, d, h }) {
    const steel = STEEL(o.color || '#2f6fb0');
    const beamY = h;
    // A-frames at each end and the top beam.
    for (const s of [-1, 1]) {
      const x = s * (w / 2 - 0.5);
      B.tube(steel, [x, 0, -d / 2 + 0.5], [x, beamY, 0], 0.2, 10);
      B.tube(steel, [x, 0, d / 2 - 0.5], [x, beamY, 0], 0.2, 10);
      B.tube(steel, [x, 3.2, -d / 2 + 1.7], [x, 3.2, d / 2 - 1.7], 0.12, 8);
    }
    B.tube(steel, [-w / 2 + 0.5, beamY, 0], [w / 2 - 0.5, beamY, 0], 0.27, 12);
    // Four swings: two belt seats, a toddler bucket, a basket.
    const bays = 4;
    for (let i = 0; i < bays; i++) {
      const cx = -w / 2 + (w * (i + 0.5)) / bays;
      const seatY = 1.8;
      for (const sx of [-0.8, 0.8]) chain(B, [cx + sx, beamY - 0.2, 0], [cx + sx * 0.95, seatY + 0.2, 0], 22);
      if (i === 2) {
        B.add(new THREE.CylinderGeometry(0.9, 0.7, 1.1, 16, 1, true), HDPE('#2b2f36'), { pos: [cx, seatY + 0.3, 0] });
        B.add(new THREE.CylinderGeometry(0.7, 0.7, 0.1, 16), HDPE('#2b2f36'), { pos: [cx, seatY - 0.2, 0] });
      } else {
        const g = new THREE.BoxGeometry(2.0, 0.12, 0.7);
        const p = g.attributes.position;
        for (let k = 0; k < p.count; k++) p.setY(k, p.getY(k) + (p.getX(k) / 1) ** 2 * 0.12);
        g.computeVertexNormals();
        B.add(g, HDPE('#1d1f22'), { pos: [cx, seatY, 0] });
      }
    }
    safetySurface(B, w + 6, d + 12);
  },
  slidetower(B, o, { w, d, h }) {
    const post = STEEL('#2f8f4e');
    const deckY = h - 3.5;
    for (const [x, z] of [[-2.2, -2.2], [2.2, -2.2], [2.2, 2.2], [-2.2, 2.2]]) B.add(cylGeo(0.22, 0.22, h, 12), post, { pos: [x, h / 2, z - d / 2 + 3] });
    B.box(STEEL('#c0392b'), 4.8, 0.2, 4.8, 0, deckY, -d / 2 + 3);
    // A pitched hood over the deck.
    B.add(new THREE.ConeGeometry(3.8, 2.2, 4).rotateY(PI / 4), HDPE('#f2c318'), { pos: [0, h + 0.7, -d / 2 + 3] });
    // Ladder up the back, slide down the front.
    for (const s of [-0.9, 0.9]) B.tube(post, [s, 0, -d / 2 - 0.3], [s, deckY, -d / 2 + 0.6], 0.12, 8);
    for (let k = 1; k < 7; k++) B.tube(post, [-0.9, (k * deckY) / 7, -d / 2 - 0.3 + (0.9 * k) / 7], [0.9, (k * deckY) / 7, -d / 2 - 0.3 + (0.9 * k) / 7], 0.07, 6);
    slide(B, 0, deckY, -d / 2 + 5.4, d - 6.4, 0, '#f2c318');
    safetySurface(B, w + 6, d + 6);
  },
  playstructure(B, o, { w, d, h }) {
    // Two towers joined by a bridge: roofs, a tube slide, a wave slide, a
    // climbing wall, panels and a fireman's pole, on a wood-fibre bed.
    safetySurface(B, w, d);
    const post = STEEL('#2f6fb0');
    const deck = STEEL('#4a4f55');
    const towers = [[-w / 4, 4.5], [w / 4, 6.5]];
    for (const [tx, ty] of towers) {
      for (const [x, z] of [[-2.6, -2.6], [2.6, -2.6], [2.6, 2.6], [-2.6, 2.6]]) B.add(cylGeo(0.24, 0.24, ty + 6.5, 12), post, { pos: [tx + x, (ty + 6.5) / 2, z] });
      B.box(deck, 5.6, 0.25, 5.6, tx, ty, 0);
      B.add(new THREE.ConeGeometry(4.4, 2.6, 4).rotateY(PI / 4), HDPE(ty > 5 ? '#c0392b' : '#f2c318'), { pos: [tx, ty + 7.6, 0] });
      // Panels on two sides: a tic-tac-toe spinner panel and a steering wheel.
      B.box(HDPE('#2fa36b'), 5.2, 3, 0.2, tx, ty + 1.9, -2.7);
      B.add(new THREE.TorusGeometry(0.7, 0.1, 6, 16), HDPE('#f2c318'), { pos: [tx, ty + 2.2, -2.85] });
    }
    // The bridge: a slatted walk between the decks, with rope sides.
    const [ax, ay] = towers[0];
    const [bx, by] = towers[1];
    const n = 9;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = ax + 2.8 + (bx - ax - 5.6) * t;
      const y = ay + (by - ay) * t - Math.sin(t * PI) * 0.4;
      B.box(M.wood('#8a6a4a'), (bx - ax - 5.6) / n - 0.15, 0.2, 3.6, x, y, 0);
    }
    for (const s of [-1, 1]) B.tube(M.plastic('#c9b48a', 0.8), [ax + 2.8, ay + 3, s * 1.8], [bx - 2.8, by + 3, s * 1.8], 0.08, 5);
    // Tube slide off the tall tower, wave slide off the low one.
    slide(B, bx + 2.8, by, 0, Math.min(14, w / 2 - 5), PI / 2, '#c0392b');
    slide(B, ax, ay, 2.8, Math.min(9, d / 2 - 3.5), 0, '#2fa36b');
    // Climbing wall with holds, up the back of the tall tower.
    const wall = new THREE.BoxGeometry(5.2, by + 0.6, 0.35).rotateX(0.32);
    B.add(wall, HDPE('#2f6fb0'), { pos: [bx, (by + 0.6) / 2, -4.2] });
    const r = rng(11);
    for (let k = 0; k < 18; k++) B.add(new THREE.IcosahedronGeometry(0.22, 0), HDPE(['#f2c318', '#c0392b', '#2fa36b'][k % 3]), { pos: [bx + (r() - 0.5) * 4.4, 0.6 + r() * by, -4.2 + 0.25 - (r() * by) * 0.0 - 0.1] });
    // Fireman's pole.
    B.add(cylGeo(0.1, 0.1, ay + 7, 10), M.metal('#c9ced3', 0.25), { pos: [ax - 4.2, (ay + 7) / 2, -1.6] });
    B.box(post, 1.8, 0.15, 0.15, ax - 3.4, ay + 6.8, -1.6);
  },
  seesaw(B, o, { w }) {
    B.box(STEEL('#2b2f36'), 0.8, 1.6, 0.8, 0, 0.8, 0);
    B.add(new THREE.BoxGeometry(w, 0.25, 0.9).rotateZ(0.12), HDPE(o.color || '#c0392b'), { pos: [0, 1.75, 0] });
    for (const s of [-1, 1]) {
      const x = s * (w / 2 - 0.9);
      const y = 1.75 + s * 0.12 * (w / 2 - 0.9) * -1;
      B.add(new THREE.BoxGeometry(0.9, 0.3, 1.2), HDPE('#1d1f22'), { pos: [x, y + 0.25, 0] });
      B.tube(STEEL('#f2c318'), [x + s * 0.4, y + 0.3, -0.5], [x + s * 0.4, y + 1.4, -0.5], 0.06, 6);
      B.tube(STEEL('#f2c318'), [x + s * 0.4, y + 1.4, -0.5], [x + s * 0.4, y + 1.4, 0.5], 0.06, 6);
      B.tube(STEEL('#f2c318'), [x + s * 0.4, y + 0.3, 0.5], [x + s * 0.4, y + 1.4, 0.5], 0.06, 6);
    }
    safetySurface(B, w + 4, 6);
  },
  springrider(B, o) {
    // A spring and a riding horse (or bug), handles and footrests.
    for (let k = 0; k < 8; k++) B.add(new THREE.TorusGeometry(0.45, 0.07, 6, 14).rotateX(PI / 2), M.metal('#d9dde0', 0.3), { pos: [0, 0.35 + k * 0.17, 0] });
    const col = HDPE(o.color || '#2fa36b');
    B.add(new THREE.CapsuleGeometry(0.55, 1.5, 4, 10).rotateX(PI / 2), col, { pos: [0, 2.2, 0] });
    B.add(new THREE.SphereGeometry(0.55, 12, 8), col, { pos: [0, 2.9, -1.25] });
    for (const s of [-1, 1]) {
      B.add(new THREE.SphereGeometry(0.12, 8, 6), M.plastic('#ffffff', 0.4), { pos: [s * 0.25, 3.05, -1.75] });
      B.tube(HDPE('#f2c318'), [s * 0.15, 2.9, -0.9], [s * 0.55, 3.0, -0.9], 0.07, 6);
      B.box(HDPE('#f2c318'), 0.5, 0.12, 0.4, s * 0.65, 1.8, 0.1);
    }
    safetySurface(B, 6, 6);
  },
  merrygoround(B, o, { w }, ctx) {
    safetySurface(B, w + 6, w + 6);
    B.add(cylGeo(0.5, 0.6, 1.2, 12), STEEL('#2b2f36'), { pos: [0, 0.6, 0] });
    const top = new Builder();
    top.add(cylGeo(w / 2, w / 2, 0.25, 40), M.metal('#aeb4ba', 0.4), { pos: [0, 0, 0] });
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * PI * 2;
      top.add(new THREE.CylinderGeometry(w / 2 - 0.05, w / 2 - 0.05, 0.27, 40, 1, false, a, PI / 3 - 0.02), HDPE(['#c0392b', '#f2c318', '#2f6fb0'][k % 3]), { pos: [0, 0.01, 0] });
      const ca = Math.cos(a + PI / 6);
      const sa = Math.sin(a + PI / 6);
      top.tube(STEEL('#d9dde0'), [ca * 0.6, 0.1, sa * 0.6], [ca * (w / 2 - 0.6), 2.4, sa * (w / 2 - 0.6)], 0.09, 6);
      top.tube(STEEL('#d9dde0'), [ca * (w / 2 - 0.6), 2.4, sa * (w / 2 - 0.6)], [ca * (w / 2 - 0.6), 0.1, sa * (w / 2 - 0.6)], 0.09, 6);
    }
    const g = top.finish(new THREE.Group());
    g.position.y = 1.25;
    g.userData.turn = 0.6;
    ctx.moving.push(g);
  },
  monkeybars(B, o, { w, d, h }) {
    const steel = STEEL(o.color || '#c0392b');
    for (const s of [-1, 1]) {
      for (const z of [-d / 2 + 0.3, d / 2 - 0.3]) B.tube(steel, [s * (w / 2 - 0.3), 0, z], [s * (w / 2 - 0.3), h, z], 0.15, 8);
      B.tube(steel, [-w / 2 + 0.3, h, s * (d / 2 - 0.3)], [w / 2 - 0.3, h, s * (d / 2 - 0.3)], 0.14, 8);
      for (let k = 1; k < 5; k++) B.tube(steel, [s * (w / 2 - 0.3), k * 1.3, -d / 2 + 0.3], [s * (w / 2 - 0.3), k * 1.3, d / 2 - 0.3], 0.07, 6);
    }
    for (let x = -w / 2 + 1.5; x < w / 2 - 1; x += 1.2) B.tube(STEEL('#d9dde0'), [x, h, -d / 2 + 0.3], [x, h, d / 2 - 0.3], 0.08, 6);
    safetySurface(B, w + 6, d + 6);
  },
  sandbox(B, o, { w, d }) {
    const timber = M.wood('#9a7650');
    for (const s of [-1, 1]) {
      B.box(timber, w, 1, 0.6, 0, 0.5, s * (d / 2 - 0.3));
      B.box(timber, 0.6, 1, d, s * (w / 2 - 0.3), 0.5, 0);
    }
    B.box(M.groundCover('peagravel'), w - 1.2, 0.7, d - 1.2, 0, 0.35, 0);
    B.add(new THREE.ConeGeometry(1.2, 0.8, 12), M.groundCover('peagravel'), { pos: [w * 0.15, 0.9, -d * 0.1] });
    B.add(new THREE.CylinderGeometry(0.4, 0.3, 0.5, 12, 1, true), HDPE('#c0392b'), { pos: [-w * 0.2, 0.95, d * 0.15] });
    B.add(new THREE.BoxGeometry(0.5, 0.05, 1.2), HDPE('#2f6fb0'), { pos: [-w * 0.1, 0.75, d * 0.25], rot: [0, 0.6, 0.2] });
  },
  climbdome(B, o, { w }) {
    // A geodesic climber: the edges of a subdivided icosahedron, top half.
    const g = new THREE.IcosahedronGeometry(w / 2, 1);
    const p = g.attributes.position;
    const seen = new Set();
    const steel = STEEL(o.color || '#2f8f4e');
    for (let i = 0; i < p.count; i += 3) {
      for (const [a, b] of [[i, i + 1], [i + 1, i + 2], [i + 2, i]]) {
        const A = [p.getX(a), p.getY(a), p.getZ(a)];
        const Bv = [p.getX(b), p.getY(b), p.getZ(b)];
        if (A[1] < -0.01 || Bv[1] < -0.01) continue;
        const key = [A, Bv].map((v) => v.map((n) => n.toFixed(2)).join(',')).sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        B.tube(steel, A, Bv, 0.09, 6);
      }
    }
    safetySurface(B, w + 6, w + 6);
  },
  playsurface(B, o, { w, d }) {
    safetySurface(B, w, d, o.cover || 'mulch-brown');
  },

  /* ---- landscaping ---- */
  mulchbed(B, o, { w, d }) {
    // A bed of ground cover in black steel edging.
    const kind = o.cover || 'mulch-brown';
    const shape = new THREE.Shape();
    const rx = w / 2;
    const rz = d / 2;
    const n = 48;
    for (let k = 0; k <= n; k++) {
      const a = (k / n) * PI * 2;
      // A soft-cornered rectangle (superellipse).
      const c = Math.cos(a);
      const s = Math.sin(a);
      const x = Math.sign(c) * Math.abs(c) ** 0.35 * rx;
      const z = Math.sign(s) * Math.abs(s) ** 0.35 * rz;
      if (k === 0) shape.moveTo(x, z); else shape.lineTo(x, z);
    }
    const geo = new THREE.ShapeGeometry(shape, 1).rotateX(-PI / 2);
    const uv = geo.attributes.uv;
    const pos = geo.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i), pos.getZ(i));
    B.add(geo, M.groundCover(kind), { pos: [0, 0.09, 0] });
    const pts = shape.getPoints(n);
    for (let i = 0; i < pts.length - 1; i++) B.tube(M.painted('#1b1d20', 0.6), [pts[i].x, 0.12, -pts[i].y], [pts[i + 1].x, 0.12, -pts[i + 1].y], 0.05, 4);
  },
  steppingstones(B, o, { w }) {
    const r = rng(Math.round((o.x || 0) * 7 + (o.y || 0) * 3));
    for (let x = -w / 2 + 1.2; x < w / 2 - 0.5; x += 2.2) {
      const s = 0.85 + r() * 0.3;
      B.add(cylGeo(s, s * 1.05, 0.25, 9), M.concrete('#b9b2a4'), { pos: [x, 0.12, (r() - 0.5) * 0.5], rot: [0, r() * 3, 0], scale: [1.15, 1, 0.9] });
    }
  },
  retainingwall(B, o, { w, d, h }) {
    // Split-face blocks in courses, each course stepped back a little, with a cap.
    const courses = Math.max(2, Math.round(h / 0.67));
    const r = rng(29);
    for (let c = 0; c < courses; c++) {
      const y = c * 0.67;
      const off = c % 2 ? 0.75 : 0;
      for (let x = -w / 2 + off; x < w / 2; x += 1.5) {
        const bw = Math.min(1.46, w / 2 - x);
        if (bw < 0.2) continue;
        B.box(M.concrete(['#b4ab9b', '#a8a090', '#bdb4a3'][Math.floor(r() * 3)]), bw, 0.64, d - c * 0.06, x + bw / 2, y + 0.33, -c * 0.03);
      }
    }
    B.box(M.concrete('#c7c0b2'), w + 0.2, 0.3, d + 0.15, 0, courses * 0.67 + 0.12, -courses * 0.03);
  },

  /* ---- garden tools ---- */
  wheelbarrow(B, o) {
    const tray = M.painted(o.color || '#2f8f4e', 0.4);
    const g = new THREE.CylinderGeometry(1.5, 1.0, 1.2, 4, 1, true).rotateY(PI / 4).scale(1, 1, 1.5);
    B.add(g, tray, { pos: [0, 1.75, 0.3], rot: [0.15, 0, 0] });
    B.add(new THREE.BoxGeometry(1.35, 0.06, 2.0), tray, { pos: [0, 1.17, 0.35], rot: [0.15, 0, 0] });
    B.add(new THREE.TorusGeometry(0.55, 0.18, 8, 18).rotateY(PI / 2), M.tyre(), { pos: [0, 0.73, -1.6] });
    B.add(cylGeo(0.22, 0.22, 0.4, 10).rotateZ(PI / 2), M.metal('#9aa1a8', 0.4), { pos: [0, 0.73, -1.6] });
    for (const s of [-1, 1]) {
      B.tube(M.wood('#a07a52'), [s * 0.35, 0.73, -1.6], [s * 0.85, 2.35, 2.4], 0.09, 6);
      B.tube(M.metal('#5d646c', 0.4), [s * 0.6, 1.2, 1.0], [s * 0.6, 0, 1.3], 0.05, 6);
      B.add(cylGeo(0.12, 0.12, 0.5, 8).rotateX(PI / 2), M.plastic('#1d1f22', 0.6), { pos: [s * 0.86, 2.4, 2.55] });
    }
  },
  pushmower(B, o) {
    const deck = M.painted(o.color || '#c0392b', 0.4);
    B.add(new THREE.CylinderGeometry(0.95, 1.0, 0.55, 20), deck, { pos: [0, 0.65, 0] });
    B.box(M.plastic('#1d1f22', 0.6), 1.2, 0.8, 0.9, 0, 1.2, -0.1);
    B.add(cylGeo(0.25, 0.25, 0.3, 10), M.metal('#5d646c', 0.4), { pos: [0, 1.75, -0.1] });
    for (const sx of [-1, 1]) for (const sz of [-0.85, 0.85]) B.add(cylGeo(0.36, 0.36, 0.18, 14).rotateZ(PI / 2), M.tyre(), { pos: [sx * 1.0, 0.36, sz] });
    // Grass bag and the handle.
    B.add(new THREE.BoxGeometry(1.3, 0.9, 1.1), M.fabric('#3d434b'), { pos: [0, 0.8, 1.4] });
    for (const s of [-1, 1]) B.tube(M.metal('#2b2f36', 0.4), [s * 0.7, 0.8, 0.8], [s * 0.7, 3.2, 2.6], 0.06, 6);
    B.tube(M.metal('#2b2f36', 0.4), [-0.7, 3.2, 2.6], [0.7, 3.2, 2.6], 0.06, 6);
  },
  ridingmower(B, o) {
    const body = M.painted(o.color || '#2f8f4e', 0.35);
    B.box(body, 2.6, 0.9, 3.4, 0, 1.6, -0.6);
    B.add(new THREE.BoxGeometry(2.4, 0.6, 1.4).translate(0, 0, 0), body, { pos: [0, 2.1, -1.5], rot: [0.25, 0, 0] });
    B.box(M.painted('#2b2f36', 0.5), 4.2, 0.5, 2.0, 0, 0.6, 0.2);
    B.add(new THREE.BoxGeometry(1.6, 0.4, 1.4), M.plastic('#1d1f22', 0.7), { pos: [0, 2.3, 0.9] });
    B.add(new THREE.BoxGeometry(1.6, 1.2, 0.3), M.plastic('#1d1f22', 0.7), { pos: [0, 2.9, 1.6], rot: [-0.2, 0, 0] });
    B.tube(M.plastic('#1d1f22', 0.6), [0, 2.0, -0.4], [0, 3.2, 0.1], 0.08, 6);
    B.add(new THREE.TorusGeometry(0.55, 0.07, 6, 16).rotateX(PI / 2 - 0.35), M.plastic('#1d1f22', 0.6), { pos: [0, 3.25, 0.15] });
    for (const s of [-1, 1]) {
      B.add(cylGeo(0.55, 0.55, 0.45, 16).rotateZ(PI / 2), M.tyre(), { pos: [s * 1.2, 0.55, -1.7] });
      B.add(cylGeo(0.85, 0.85, 0.75, 18).rotateZ(PI / 2), M.tyre(), { pos: [s * 1.25, 0.85, 1.6] });
      B.add(cylGeo(0.4, 0.4, 0.78, 14).rotateZ(PI / 2), M.painted('#f2c318', 0.4), { pos: [s * 1.26, 0.85, 1.6] });
    }
  },
  toolrack(B) {
    // A wooden rack against nothing in particular, with the tools leaning in it.
    const wood = M.wood('#9a7650');
    for (const s of [-1, 1]) B.box(wood, 0.3, 5, 0.3, s * 2.2, 2.5, 0);
    for (const y of [1.2, 4.3]) B.box(wood, 4.7, 0.3, 0.6, 0, y, 0);
    const handle = M.wood('#c49a6a');
    const steel = M.metal('#7d858c', 0.45);
    const tools = [
      // [x, head] — rake, shovel, hoe, pitchfork, broom
      [-1.6, 'rake'], [-0.8, 'shovel'], [0, 'hoe'], [0.8, 'fork'], [1.6, 'broom'],
    ];
    for (const [x, kind] of tools) {
      B.tube(handle, [x, 0.6, 0.6], [x + 0.1, 5.6, -0.15], 0.06, 6);
      if (kind === 'shovel') B.add(new THREE.BoxGeometry(0.75, 1.0, 0.06), steel, { pos: [x, 0.4, 0.68], rot: [0.15, 0, 0] });
      if (kind === 'rake') { B.box(steel, 1.3, 0.1, 0.1, x, 0.55, 0.65); for (let k = 0; k < 10; k++) B.box(steel, 0.04, 0.35, 0.04, x - 0.6 + k * 0.13, 0.4, 0.7); }
      if (kind === 'hoe') B.box(steel, 0.6, 0.35, 0.05, x, 0.5, 0.75);
      if (kind === 'fork') for (let k = 0; k < 4; k++) B.box(steel, 0.05, 0.9, 0.05, x - 0.22 + k * 0.15, 0.35, 0.68);
      if (kind === 'broom') B.box(M.plastic('#c9b48a', 0.9), 1.1, 0.5, 0.3, x, 0.3, 0.65);
    }
  },
  hosereel(B) {
    const frame = M.painted('#2f8f4e', 0.4);
    for (const s of [-1, 1]) B.add(new THREE.TorusGeometry(1.0, 0.07, 6, 24).rotateY(PI / 2), frame, { pos: [s * 0.7, 1.4, 0] });
    B.add(cylGeo(0.45, 0.45, 1.4, 16).rotateZ(PI / 2), frame, { pos: [0, 1.4, 0] });
    // The hose wound on, and a loop of it lying out on the ground.
    for (let k = 0; k < 6; k++) B.add(new THREE.TorusGeometry(0.62 + (k % 3) * 0.08, 0.07, 6, 24).rotateY(PI / 2), M.plastic('#3a9b4a', 0.5), { pos: [-0.5 + k * 0.2, 1.4, 0] });
    for (const s of [-1, 1]) B.box(frame, 0.1, 1.4, 1.8, s * 0.75, 0.7, 0);
    B.add(new THREE.TorusGeometry(1.6, 0.07, 6, 32).rotateX(PI / 2), M.plastic('#3a9b4a', 0.5), { pos: [0.6, 0.08, 2.4] });
    B.add(cylGeo(0.09, 0.12, 0.6, 8).rotateX(PI / 2), M.plastic('#f2c318', 0.5), { pos: [2.1, 0.12, 2.6] });
  },
  compostbin(B) {
    const wood = M.wood('#8a6a4a');
    for (let i = 0; i < 2; i++) {
      const x = (i - 0.5) * 3.4;
      for (let y = 0.2; y < 3; y += 0.5) {
        B.box(wood, 3.2, 0.35, 0.15, x, y, -1.5);
        for (const s of [-1, 1]) B.box(wood, 0.15, 0.35, 3, x + s * 1.6, y, 0);
      }
      B.add(new THREE.ConeGeometry(1.4, 1.4, 10), M.groundCover('mulch-black'), { pos: [x, 0.9, 0], scale: [1, 1, 0.9] });
    }
  },
  gardenshed(B, o, { w, d, h }) {
    // A small shed: board-and-batten walls, a gabled shingle roof, double doors and a window.
    const wall = M.wall('batten', o.color || '#8a9a7b');
    const roof = M.roof('tiles', '#4a4f55');
    const eave = h - 3;
    B.box(M.concrete('#b4b1a9'), w + 0.6, 0.4, d + 0.6, 0, 0.2, 0);
    B.box(wall, w, eave, d, 0, 0.4 + eave / 2, 0);
    const rise = 3;
    const sl = Math.hypot(d / 2 + 0.8, rise + 0.5);
    for (const s of [1, -1]) {
      const a = [-w / 2 - 0.6, 0.4 + eave - 0.4, s * (d / 2 + 0.8)];
      const b = [w / 2 + 0.6, 0.4 + eave - 0.4, s * (d / 2 + 0.8)];
      const c = [w / 2 + 0.6, 0.4 + eave + rise, 0];
      const e = [-w / 2 - 0.6, 0.4 + eave + rise, 0];
      if (s > 0) B.quad(roof, a, b, c, e, [0, 0, w + 1.2, 0, w + 1.2, sl, 0, sl]);
      else B.quad(roof, b, a, e, c, [0, 0, w + 1.2, 0, w + 1.2, sl, 0, sl]);
    }
    for (const s of [1, -1]) {
      const x = s * w / 2;
      const y0 = 0.4 + eave;
      const tri = s > 0 ? [[x, y0, d / 2], [x, y0, -d / 2], [x, y0 + rise, 0]] : [[x, y0, -d / 2], [x, y0, d / 2], [x, y0 + rise, 0]];
      B.quad(wall, tri[0], tri[1], tri[2], tri[2]);
    }
    const trim = M.painted('#f2f1ec', 0.55);
    B.box(M.wall('batten', '#efe9dc'), 4.4, 6.2, 0.15, -w * 0.12, 0.4 + 3.1, d / 2 + 0.08);
    B.box(trim, 0.15, 6.2, 0.2, -w * 0.12, 0.4 + 3.1, d / 2 + 0.16);
    for (const [x0, x1] of [[-2.2, 0], [0, 2.2]]) B.box(trim, 2.0, 0.2, 0.2, -w * 0.12 + (x0 + x1) / 2, 0.4 + 3.1, d / 2 + 0.17, [0, 0, 0.9 * (x0 < 0 ? 1 : -1)]);
    B.quad(M.glass(), [w * 0.2, 4.2, d / 2 + 0.06], [w * 0.38, 4.2, d / 2 + 0.06], [w * 0.38, 5.8, d / 2 + 0.06], [w * 0.2, 5.8, d / 2 + 0.06]);
    B.box(M.plastic('#6b5136', 0.7), w * 0.24, 0.5, 0.6, w * 0.29, 3.95, d / 2 + 0.3);
  },
  watercan(B) {
    B.add(cylGeo(0.45, 0.5, 0.9, 16), M.metal('#9aa1a8', 0.35), { pos: [0, 0.45, 0] });
    B.tube(M.metal('#9aa1a8', 0.35), [0.35, 0.35, 0], [1.2, 1.05, 0], 0.07, 6);
    B.add(new THREE.ConeGeometry(0.2, 0.25, 10).rotateZ(PI / 2 + 0.6), M.metal('#9aa1a8', 0.35), { pos: [1.25, 1.1, 0] });
    B.add(new THREE.TorusGeometry(0.35, 0.05, 6, 14, PI), M.metal('#9aa1a8', 0.35), { pos: [-0.05, 0.9, 0] });
  },
  potplants(B) {
    const r = rng(53);
    for (let i = 0; i < 5; i++) {
      const s = 0.55 + r() * 0.5;
      const x = (i - 2) * 1.3 + (r() - 0.5) * 0.3;
      const z = (r() - 0.5) * 1.2;
      B.add(new THREE.CylinderGeometry(s * 0.8, s * 0.55, s * 1.2, 14), M.painted('#b8643a', 0.85), { pos: [x, s * 0.6, z] });
      B.add(new THREE.TorusGeometry(s * 0.8, 0.07, 6, 16).rotateX(PI / 2), M.painted('#a9572f', 0.85), { pos: [x, s * 1.2, z] });
      B.add(new THREE.IcosahedronGeometry(s * 0.95, 1), M.leaves(i % 3), { pos: [x, s * 1.2 + s * 0.6, z], scale: [1, 0.85, 1] });
      if (i % 2) for (let k = 0; k < 6; k++) B.add(new THREE.IcosahedronGeometry(0.13, 0), M.painted(['#e0457b', '#f6d23a', '#ffffff'][i % 3], 0.6), { pos: [x + (r() - 0.5) * s, s * 1.6 + r() * s * 0.5, z + (r() - 0.5) * s] });
    }
  },
  birdbath(B) {
    const stone = M.concrete('#c9c2b4');
    B.add(cylGeo(0.7, 0.9, 0.3, 16), stone, { pos: [0, 0.15, 0] });
    B.add(new THREE.LatheGeometry([new THREE.Vector2(0.22, 0), new THREE.Vector2(0.3, 0.6), new THREE.Vector2(0.18, 1.4), new THREE.Vector2(0.3, 2.2)], 16), stone, { pos: [0, 0.3, 0] });
    B.add(new THREE.CylinderGeometry(1.3, 0.5, 0.45, 24), stone, { pos: [0, 2.7, 0] });
    B.add(new THREE.CircleGeometry(1.15, 24).rotateX(-PI / 2), M.water(), { pos: [0, 2.9, 0] });
  },
  gnome(B, o) {
    B.add(new THREE.CylinderGeometry(0.35, 0.45, 0.9, 12), M.plastic('#2f6fb0', 0.5), { pos: [0, 0.45, 0] });
    B.add(new THREE.SphereGeometry(0.3, 12, 8), M.plastic('#f1c9a5', 0.6), { pos: [0, 1.1, 0] });
    B.add(new THREE.ConeGeometry(0.33, 0.9, 12), M.plastic(o.color || '#c0392b', 0.5), { pos: [0, 1.65, 0], rot: [0.15, 0, 0] });
    B.add(new THREE.ConeGeometry(0.28, 0.6, 12).rotateX(PI), M.plastic('#f4f4f2', 0.7), { pos: [0, 0.82, 0.22] });
    B.add(new THREE.SphereGeometry(0.08, 8, 6), M.plastic('#e07a6a', 0.5), { pos: [0, 1.08, 0.3] });
  },

  /* ---- backyard ---- */
  firepit(B, o, { w }) {
    const r = w / 2;
    const stone = M.wall('stone', '#9b9488');
    B.add(new THREE.CylinderGeometry(r, r + 0.1, 1.4, 24, 1, true), stone, { pos: [0, 0.7, 0] });
    B.add(new THREE.TorusGeometry(r - 0.15, 0.2, 6, 24).rotateX(PI / 2), M.concrete('#b4ab9b'), { pos: [0, 1.4, 0] });
    B.add(new THREE.CircleGeometry(r - 0.2, 24).rotateX(-PI / 2), M.plastic('#2a2622', 0.95), { pos: [0, 0.6, 0] });
    for (let k = 0; k < 5; k++) B.add(cylGeo(0.15, 0.15, 1.4, 8).rotateZ(PI / 2), M.bark('#5d4a36'), { pos: [0, 0.75, 0], rot: [0, (k * PI) / 5, 0] });
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * PI * 2 + 0.4;
      B.box(M.wood('#8a6a4a'), 1.6, 0.15, 1.6, Math.cos(a) * (r + 3.2), 1.4, Math.sin(a) * (r + 3.2), [0, -a, 0]);
      B.box(M.wood('#8a6a4a'), 1.6, 1.8, 0.15, Math.cos(a) * (r + 4.0), 2.0, Math.sin(a) * (r + 4.0), [0, -a + PI / 2, 0.25]);
    }
  },
  bbqgrill(B) {
    const steel = M.metal('#c9ced3', 0.3);
    B.box(M.painted('#2b2f36', 0.4), 4.4, 2.3, 2.0, 0, 1.15, 0);
    B.add(new THREE.CylinderGeometry(1.0, 1.0, 3.0, 20, 1, false, 0, PI).rotateZ(PI / 2).rotateX(-PI / 2), steel, { pos: [0, 2.5, 0] });
    B.box(steel, 3.0, 0.15, 2.0, 0, 2.4, 0);
    for (const s of [-1, 1]) B.box(M.painted('#2b2f36', 0.4), 0.9, 0.08, 1.8, s * 2.1, 2.35, 0);
    B.tube(steel, [-1.2, 3.1, 1.15], [1.2, 3.1, 1.15], 0.06, 6);
    for (let k = 0; k < 4; k++) B.add(cylGeo(0.12, 0.12, 0.12, 10).rotateX(PI / 2), M.plastic('#1d1f22', 0.5), { pos: [-1.2 + k * 0.8, 2.0, 1.02] });
    B.add(cylGeo(0.5, 0.5, 1.4, 14), M.painted('#e9ecef', 0.4), { pos: [1.6, 0.7, -0.3] });
  },
  patioset(B, o, { w }) {
    const frame = M.metal('#2b2f36', 0.4);
    B.add(cylGeo(1.9, 1.9, 0.12, 24), M.painted('#e9ecef', 0.5), { pos: [0, 2.4, 0] });
    B.add(cylGeo(0.08, 0.08, 2.4, 8), frame, { pos: [0, 1.2, 0] });
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * PI * 2 + PI / 4;
      const x = Math.cos(a) * 2.9;
      const z = Math.sin(a) * 2.9;
      B.box(M.fabric('#c9b48a'), 1.6, 0.4, 1.6, x, 1.4, z);
      B.box(M.fabric('#c9b48a'), 1.6, 1.6, 0.35, x + Math.cos(a) * 0.7, 2.2, z + Math.sin(a) * 0.7, [0, -a + PI / 2, 0]);
      for (const [dx, dz] of [[-0.7, -0.7], [0.7, -0.7], [0.7, 0.7], [-0.7, 0.7]]) B.add(cylGeo(0.05, 0.05, 1.3, 6), frame, { pos: [x + dx, 0.65, z + dz] });
    }
    // The umbrella.
    B.add(cylGeo(0.06, 0.06, 7, 8), frame, { pos: [0, 3.5, 0] });
    B.add(new THREE.ConeGeometry(w / 2 - 0.3, 1.6, 8, 1, true), M.fabric(o.color || '#1f5f8a'), { pos: [0, 7.2, 0] });
  },
  trampoline(B, o, { w }) {
    const r = w / 2;
    B.add(new THREE.CircleGeometry(r - 0.9, 32).rotateX(-PI / 2), M.plastic('#1d1f22', 0.8), { pos: [0, 3.0, 0] });
    B.add(new THREE.TorusGeometry(r - 0.45, 0.42, 6, 40).rotateX(PI / 2).scale(1, 0.25, 1), M.plastic(o.color || '#2f6fb0', 0.5), { pos: [0, 3.05, 0] });
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      B.tube(M.metal('#9aa1a8', 0.35), [x, 0, z], [x, 3, z], 0.1, 8);
      B.tube(M.plastic('#2b2f36', 0.5), [x, 3, z], [x, 9, z], 0.09, 8);
    }
    B.add(new THREE.CylinderGeometry(r, r, 6, 32, 1, true), M.meshFence(), { pos: [0, 6, 0] });
    B.add(new THREE.TorusGeometry(r, 0.07, 6, 40).rotateX(PI / 2), M.plastic('#2b2f36', 0.5), { pos: [0, 9, 0] });
  },
  drivewayhoop(B) {
    B.add(cylGeo(0.25, 0.3, 12, 12), M.painted('#2b2f36', 0.4), { pos: [0, 6, 0] });
    B.box(M.painted('#2b2f36', 0.4), 0.3, 0.3, 2.6, 0, 11.6, 1.3, [0.1, 0, 0]);
    B.box(M.acrylic(), 6, 3.5, 0.12, 0, 12, 2.6);
    B.box(M.painted('#c0392b', 0.4), 2, 1.5, 0.05, 0, 11.6, 2.68);
    B.add(new THREE.TorusGeometry(0.75, 0.05, 6, 20).rotateX(PI / 2), M.painted('#e8641c', 0.4), { pos: [0, 10.8, 3.4] });
    B.add(new THREE.CylinderGeometry(0.75, 0.45, 1.4, 12, 1, true), M.meshFence(), { pos: [0, 10.1, 3.4] });
    B.box(M.concrete('#a8a59d'), 2, 0.5, 2, 0, 0.25, 0);
  },
  hammock(B, o, { w }) {
    const stand = M.metal('#2b2f36', 0.4);
    for (const s of [-1, 1]) {
      B.tube(stand, [s * (w / 2 - 0.2), 0.2, 0], [s * (w / 2 - 1.8), 4.2, 0], 0.12, 8);
      B.tube(stand, [s * (w / 2 - 0.2), 0.2, -1.6], [s * (w / 2 - 0.2), 0.2, 1.6], 0.1, 6);
    }
    B.tube(stand, [-w / 2 + 0.2, 0.15, 0], [w / 2 - 0.2, 0.15, 0], 0.12, 8);
    // The bed of the hammock, sagging between its spreader bars.
    const g = new THREE.PlaneGeometry(w - 4.6, 3, 16, 4).rotateX(-PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) / ((w - 4.6) / 2);
      p.setY(i, -(1 - x * x) * 1.3 + Math.abs(p.getZ(i)) * 0.25);
    }
    g.computeVertexNormals();
    B.add(g, M.fabric(o.color || '#c9502e'), { pos: [0, 3.0, 0] });
    for (const s of [-1, 1]) {
      B.box(M.wood('#8a6a4a'), 0.15, 0.15, 3.2, s * (w / 2 - 2.3), 3.0, 0);
      B.tube(M.plastic('#d9c9a3', 0.8), [s * (w / 2 - 2.3), 3.0, 0], [s * (w / 2 - 1.8), 4.1, 0], 0.04, 4);
    }
  },
});
