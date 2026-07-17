// ============================================================
// Construction Highway Simulator — main game
// ============================================================
import * as THREE from 'three';
import { STATES, TERRAIN_NAMES, vestsForState } from './data.js';

const LANE_W = 3.7;          // US standard lane width (m)
const ROAD_LEN = 2000;       // length of highway segment (m)
const SCENERY_SCALE = ROAD_LEN / 800;   // density multiplier for roadside objects
const MPH = 0.44704;         // mph -> m/s

// US right-hand traffic:
//   side 'A' (x > 0) drives in the -z direction
//   side 'B' (x < 0) drives in the +z direction
// so every driver has the median on their left and the shoulder on their right.

// ---------------- global game state ----------------
const sel = { state: null, highway: null, vest: null };

let renderer, scene, camera, clock;
let player;                  // character group
let limbs;                   // {lArm,rArm,lLeg,rLeg} pivot groups
let playing = false;
let paused = false;
let buildMenuOpen = false;
let freeCam = false;
let wantLock = false;        // we asked for pointer lock on purpose

let yaw = Math.PI, pitch = 0.15;          // third-person orbit
const free = { pos: new THREE.Vector3(), yaw: 0, pitch: 0, speed: 24 };
const vel = new THREE.Vector3();
let onGround = true;
const keys = {};

let roadInfo = null;         // computed lane geometry for current highway
let groundMeshes = [];       // raycast targets for placement
let placedRoot, placed = [];
let ghost = null, ghostDef = null, buildYaw = 0, ghostOk = false;
let buildStretch = 1;        // [ and ] stretch props that support it
let breakerA = null, breakerPreview = null;   // road-breaker rectangle tool
let blinkers = [];           // {mat, phase, speed} flashing lights
let cars = [];
let laneBlockers = { A: [], B: [] };  // per-lane sorted arrays of z positions
let clouds = [];
let sun = null, hemiLight = null, ambLight = null, skyDome = null;
let pmrem = null, envRT = null;
let buildingMats = [];       // window materials that glow at night
let towerSpots = [];         // real lights on placed light towers
let timeIdx = 0;             // 0 day, 1 dusk, 2 night
let photoCount = 0;

// drivable vehicles
let vehiclesRoot = null;
let vehicles = [];           // {group, def, heading, speed, steer}
let driving = null;

const raycaster = new THREE.Raycaster();
const CENTER = new THREE.Vector2(0, 0);

// ---------------- DOM helpers ----------------
const $ = (id) => document.getElementById(id);
const show = (el) => el.classList.remove('hidden');
const hide = (el) => el.classList.add('hidden');

let toastTimer = null;
function toast(msg, ms = 2200) {
  const t = $('toast');
  t.textContent = msg;
  show(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => hide(t), ms);
}

// ============================================================
// Canvas texture helpers (shields, signs, vest, faces...)
// ============================================================
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Highway shield drawing — Interstate / US route / State route
export function drawShield(ctx, sign, num, size) {
  const s = size;
  ctx.clearRect(0, 0, s, s);
  ctx.lineJoin = 'round';
  if (sign === 'I') {
    // interstate: blue shield, red crest
    ctx.fillStyle = '#fff';
    shieldPath(ctx, s, 0);
    ctx.fill();
    ctx.fillStyle = '#003f87';
    shieldPath(ctx, s, s * 0.035);
    ctx.fill();
    ctx.fillStyle = '#b01324';
    ctx.beginPath();
    ctx.moveTo(s * 0.09, s * 0.10);
    ctx.quadraticCurveTo(s * 0.5, s * 0.22, s * 0.91, s * 0.10);
    ctx.lineTo(s * 0.89, s * 0.30);
    ctx.quadraticCurveTo(s * 0.5, s * 0.40, s * 0.11, s * 0.30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    const fs = num.length >= 3 ? 0.34 : 0.44;
    ctx.font = `800 ${Math.floor(s * fs)}px Arial`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(num, s / 2, s * 0.62);
  } else if (sign === 'US') {
    // US route: white shield, black number
    ctx.fillStyle = '#111';
    usShieldPath(ctx, s, 0);
    ctx.fill();
    ctx.fillStyle = '#fff';
    usShieldPath(ctx, s, s * 0.04);
    ctx.fill();
    ctx.fillStyle = '#111';
    const fs = num.length >= 3 ? 0.32 : 0.42;
    ctx.font = `800 ${Math.floor(s * fs)}px Arial`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(num, s / 2, s * 0.52);
  } else {
    // state route: white circle on black square
    ctx.fillStyle = '#111';
    ctx.fillRect(s * 0.05, s * 0.05, s * 0.9, s * 0.9);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    const fs = num.length >= 3 ? 0.26 : 0.36;
    ctx.font = `800 ${Math.floor(s * fs)}px Arial`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(num, s / 2, s * 0.52);
  }
}

function shieldPath(ctx, s, inset) {
  const i = inset;
  ctx.beginPath();
  ctx.moveTo(s * 0.5, s * 0.97 - i);
  ctx.quadraticCurveTo(s * 0.06 + i, s * 0.72, s * 0.06 + i, s * 0.28);
  ctx.quadraticCurveTo(s * 0.06 + i, s * 0.06 + i, s * 0.5, s * 0.10 + i * 0.5);
  ctx.quadraticCurveTo(s * 0.94 - i, s * 0.06 + i, s * 0.94 - i, s * 0.28);
  ctx.quadraticCurveTo(s * 0.94 - i, s * 0.72, s * 0.5, s * 0.97 - i);
  ctx.closePath();
}

function usShieldPath(ctx, s, inset) {
  const i = inset;
  ctx.beginPath();
  ctx.moveTo(s * 0.08 + i, s * 0.15 + i);
  ctx.lineTo(s * 0.92 - i, s * 0.15 + i);
  ctx.quadraticCurveTo(s * 0.92 - i, s * 0.55, s * 0.72, s * 0.72);
  ctx.quadraticCurveTo(s * 0.5, s * 0.92 - i, s * 0.28, s * 0.72);
  ctx.quadraticCurveTo(s * 0.08 + i, s * 0.55, s * 0.08 + i, s * 0.15 + i);
  ctx.closePath();
}

function shieldCanvas(sign, num, size = 128) {
  const c = makeCanvas(size, size);
  drawShield(c.getContext('2d'), sign, num, size);
  return c;
}

// Generic road-sign texture (diamond / rect / octagon)
function signTexture({ shape = 'diamond', bg = '#ff7900', fg = '#111', lines = [], sub = null, big = null }) {
  const s = 256;
  const c = makeCanvas(s, s);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, s, s);
  ctx.lineJoin = 'round';

  if (shape === 'diamond') {
    ctx.save();
    ctx.translate(s / 2, s / 2);
    ctx.rotate(Math.PI / 4);
    const d = s * 0.62;
    ctx.fillStyle = '#111';
    roundRect(ctx, -d / 2 - 5, -d / 2 - 5, d + 10, d + 10, 14); ctx.fill();
    ctx.fillStyle = bg;
    roundRect(ctx, -d / 2, -d / 2, d, d, 10); ctx.fill();
    ctx.strokeStyle = fg; ctx.lineWidth = 5;
    roundRect(ctx, -d / 2 + 12, -d / 2 + 12, d - 24, d - 24, 6); ctx.stroke();
    ctx.restore();
  } else if (shape === 'octagon') {
    ctx.fillStyle = '#fff';
    octPath(ctx, s / 2, s / 2, s * 0.48); ctx.fill();
    ctx.fillStyle = bg;
    octPath(ctx, s / 2, s / 2, s * 0.44); ctx.fill();
  } else {
    ctx.fillStyle = '#111';
    roundRect(ctx, s * 0.06, s * 0.06, s * 0.88, s * 0.88, 12); ctx.fill();
    ctx.fillStyle = bg;
    roundRect(ctx, s * 0.09, s * 0.09, s * 0.82, s * 0.82, 8); ctx.fill();
    ctx.strokeStyle = fg; ctx.lineWidth = 4;
    roundRect(ctx, s * 0.13, s * 0.13, s * 0.74, s * 0.74, 5); ctx.stroke();
  }

  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (big === 'arrow-merge') {
    // merge arrow symbol
    ctx.strokeStyle = fg; ctx.lineWidth = 16; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s * 0.40, s * 0.72);
    ctx.quadraticCurveTo(s * 0.40, s * 0.48, s * 0.55, s * 0.34);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(s * 0.40, s * 0.30);
    ctx.lineTo(s * 0.62, s * 0.24);
    ctx.lineTo(s * 0.56, s * 0.46);
    ctx.closePath();
    ctx.fillStyle = fg; ctx.fill();
  } else if (big) {
    ctx.font = `900 ${Math.floor(s * 0.30)}px Arial`;
    ctx.fillText(big, s / 2, s / 2);
  } else {
    const n = lines.length;
    const fs = shape === 'diamond' ? (n >= 3 ? 26 : 30) : (n >= 3 ? 34 : 40);
    ctx.font = `800 ${fs}px Arial Narrow, Arial`;
    const lh = fs * 1.15;
    const y0 = s / 2 - ((n - 1) * lh) / 2;
    lines.forEach((ln, i) => ctx.fillText(ln, s / 2, y0 + i * lh));
  }
  if (sub) {
    ctx.font = '800 30px Arial';
    ctx.fillText(sub, s / 2, s * 0.72);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function octPath(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (i * Math.PI) / 4;
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}

// striped orange/white panel used for barricade boards
function stripeTexture(angleRight = true) {
  const c = makeCanvas(128, 32);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, 128, 32);
  ctx.fillStyle = '#ff6a00';
  for (let x = -32; x < 160; x += 32) {
    ctx.beginPath();
    if (angleRight) {
      ctx.moveTo(x, 32); ctx.lineTo(x + 16, 32);
      ctx.lineTo(x + 32 + 16, 0); ctx.lineTo(x + 32, 0);
    } else {
      ctx.moveTo(x, 0); ctx.lineTo(x + 16, 0);
      ctx.lineTo(x + 32 + 16, 32); ctx.lineTo(x + 32, 32);
    }
    ctx.closePath(); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

// vest textures: front + back for the torso block
function vestTextures(vest) {
  const mk = (isBack) => {
    const c = makeCanvas(128, 128);
    const ctx = c.getContext('2d');
    // base with subtle fabric weave
    ctx.fillStyle = vest.base; ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    for (let y = 0; y < 128; y += 3) ctx.fillRect(0, y, 128, 1);
    ctx.fillStyle = 'rgba(0,0,0,.04)';
    for (let x = 0; x < 128; x += 3) ctx.fillRect(x, 0, 1, 128);

    if (isBack && vest.pattern === 'chevron') {
      // diagonal safety chevrons (flagger / TMA style)
      for (let i = -128; i < 200; i += 26) {
        ctx.fillStyle = ((i / 26) & 1) ? vest.stripe : (vest.trim || '#d21f1f');
        ctx.beginPath();
        ctx.moveTo(i, 128); ctx.lineTo(i + 13, 128);
        ctx.lineTo(i + 13 + 64, 0); ctx.lineTo(i + 64, 0);
        ctx.closePath(); ctx.fill();
      }
    }

    // shoulder trim
    ctx.fillStyle = vest.trim || '#333'; ctx.fillRect(0, 0, 128, 12);
    // two vertical reflective bands (dark piping + silver + white glint)
    for (const bx of [28, 84]) {
      ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.fillRect(bx - 2, 12, 20, 116);
      ctx.fillStyle = vest.stripe; ctx.fillRect(bx, 12, 16, 116);
      ctx.fillStyle = 'rgba(255,255,255,.65)'; ctx.fillRect(bx + 4, 12, 5, 116);
    }
    // horizontal waist band
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(0, 84, 128, 20);
    ctx.fillStyle = vest.stripe; ctx.fillRect(0, 86, 128, 16);
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(0, 90, 128, 5);

    if (isBack) {
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      roundRect(ctx, 12, 40, 104, 30, 6); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      let fs = 15;
      ctx.font = `800 ${fs}px Arial`;
      while (ctx.measureText(vest.text).width > 96 && fs > 7) { fs--; ctx.font = `800 ${fs}px Arial`; }
      ctx.fillText(vest.text, 64, 55);
    } else {
      // zipper
      ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(62, 12, 4, 116);
      // chest pockets with flaps
      ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 2;
      ctx.strokeRect(48, 34, 14, 16); ctx.strokeRect(66, 34, 14, 16);
      // ID badge on a clip
      ctx.fillStyle = '#f2f3f5'; roundRect(ctx, 48, 54, 20, 26, 3); ctx.fill();
      ctx.fillStyle = '#1d5fbf'; ctx.fillRect(48, 54, 20, 7);
      ctx.fillStyle = '#c8ccd4'; ctx.fillRect(51, 66, 14, 3); ctx.fillRect(51, 71, 10, 3);
      // radio clip
      ctx.fillStyle = '#26282c'; roundRect(ctx, 70, 56, 9, 18, 2); ctx.fill();
      ctx.fillStyle = '#4a4f57'; ctx.fillRect(73, 52, 3, 6);
    }
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  };
  return { front: mk(false), back: mk(true) };
}

function faceTexture() {
  const c = makeCanvas(128, 128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f0c040'; ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.arc(44, 52, 8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(84, 52, 8, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(64, 72, 22, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
  return new THREE.CanvasTexture(c);
}

// subtle per-pixel noise texture: makes big flat surfaces read as asphalt/dirt
function noiseTexture(base, variation = 14, size = 128) {
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const col = new THREE.Color(base);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 2 * variation;
    img.data[i] = Math.max(0, Math.min(255, col.r * 255 + n));
    img.data[i + 1] = Math.max(0, Math.min(255, col.g * 255 + n));
    img.data[i + 2] = Math.max(0, Math.min(255, col.b * 255 + n));
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

let _windowTex = null;
function windowTexture() {
  if (_windowTex) return _windowTex;
  const c = makeCanvas(64, 64);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#3d434d'; ctx.fillRect(0, 0, 64, 64);
  for (let y = 6; y < 60; y += 14) {
    for (let x = 6; x < 60; x += 14) {
      ctx.fillStyle = Math.random() < 0.45 ? '#ffe9a3' : '#20242b';
      ctx.fillRect(x, y, 8, 9);
    }
  }
  _windowTex = new THREE.CanvasTexture(c);
  _windowTex.wrapS = _windowTex.wrapT = THREE.RepeatWrapping;
  return _windowTex;
}

// ============================================================
// Small geometry helpers
// ============================================================
const lamb = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.03, envMapIntensity: 0.7, ...opts });
const shiny = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.35, envMapIntensity: 1.0, ...opts });
// glossy automotive paint: clearcoat over a metallic base flake — the BeamNG look
const carPaint = (color, opts = {}) => {
  const m = new THREE.MeshPhysicalMaterial({
    color, roughness: 0.32, metalness: 0.55,
    clearcoat: 1.0, clearcoatRoughness: 0.08,
    envMapIntensity: 1.35, ...opts,
  });
  m.userData.isPaint = true;   // tagged so the livery system can recolor it
  return m;
};
// brushed / chrome metal
const metalMat = (color = '#c8ced6', opts = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.22, metalness: 0.95, envMapIntensity: 1.4, ...opts });
// automotive glass
const carGlass = (opts = {}) =>
  new THREE.MeshPhysicalMaterial({
    color: '#101822', roughness: 0.06, metalness: 0.0,
    transmission: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.05,
    envMapIntensity: 1.6, reflectivity: 0.6, ...opts,
  });

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lamb(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function cyl(rT, rB, h, color, x = 0, y = 0, z = 0, seg = 10) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rT, rB, h, seg), lamb(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// Rounded-box geometry: push a subdivided box's corners onto a rounded shell.
// This is what makes cars and props read as curved instead of pure LEGO bricks.
const _rboxCache = new Map();
function roundedBoxGeometry(w, h, d, r, seg = 4) {
  r = Math.min(r, w / 2, h / 2, d / 2);
  const key = `${w.toFixed(3)},${h.toFixed(3)},${d.toFixed(3)},${r.toFixed(3)},${seg}`;
  if (_rboxCache.has(key)) return _rboxCache.get(key);
  const geo = new THREE.BoxGeometry(w, h, d, seg, seg, seg);
  const pos = geo.attributes.position;
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
  const v = new THREE.Vector3(), inner = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    inner.set(
      Math.max(-hx, Math.min(hx, v.x)),
      Math.max(-hy, Math.min(hy, v.y)),
      Math.max(-hz, Math.min(hz, v.z))
    );
    const n = v.clone().sub(inner);
    if (n.lengthSq() > 1e-9) { n.normalize(); v.copy(inner).addScaledVector(n, r); }
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  _rboxCache.set(key, geo);
  return geo;
}

// rounded-box mesh
function rbox(w, h, d, mat, r = 0.12, x = 0, y = 0, z = 0) {
  const material = typeof mat === 'string' ? lamb(mat) : mat;
  const m = new THREE.Mesh(roundedBoxGeometry(w, h, d, r), material);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function addBlinker(mesh, phase = 0, speed = 3) {
  mesh.material = new THREE.MeshStandardMaterial({
    color: '#7a4a00', emissive: new THREE.Color('#ffb400'), emissiveIntensity: 0,
  });
  blinkers.push({ mat: mesh.material, phase, speed });
  return mesh;
}

// ============================================================
// Buildable catalog
// ============================================================
function coneBuilder(r, h, bands) {
  return () => {
    const g = new THREE.Group();
    // rubber base with beveled edge
    const base = box(r * 3.2, 0.05, r * 3.2, '#d14e00');
    base.position.y = 0.025;
    const base2 = box(r * 2.5, 0.05, r * 2.5, '#e85d04');
    base2.position.y = 0.075;
    g.add(base, base2);
    const c = new THREE.Mesh(
      new THREE.CylinderGeometry(r * 0.22, r, h, 18),
      new THREE.MeshStandardMaterial({ color: '#ff5e00', roughness: 0.55 })
    );
    c.position.y = h / 2 + 0.06;
    c.castShadow = true;
    g.add(c);
    for (let i = 0; i < bands; i++) {
      const t = 0.45 + i * 0.28;
      const rr = r * 0.22 + (r - r * 0.22) * (1 - t);
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(rr + 0.012, rr + 0.022, h * 0.13, 18),
        new THREE.MeshStandardMaterial({
          color: '#ffffff', roughness: 0.25,
          emissive: '#cfd8de', emissiveIntensity: 0.25,   // retroreflective collar
        })
      );
      band.position.y = 0.06 + h * t;
      g.add(band);
    }
    return g;
  };
}

function barricadeBuilder(panels, width, withLight) {
  return () => {
    const g = new THREE.Group();
    const legColor = '#e8e8e8';
    const stripeMat = new THREE.MeshStandardMaterial({ map: stripeTexture(true) });
    const h = panels === 3 ? 1.6 : 1.0;
    // legs (angled A-frames at both ends)
    for (const sx of [-width / 2 + 0.06, width / 2 - 0.06]) {
      const l1 = box(0.07, h, 0.07, legColor, sx, h / 2, 0.14);
      l1.rotation.x = 0.18;
      const l2 = box(0.07, h, 0.07, legColor, sx, h / 2, -0.14);
      l2.rotation.x = -0.18;
      g.add(l1, l2);
    }
    const n = panels;
    for (let i = 0; i < n; i++) {
      const y = n === 1 ? h - 0.18 : 0.42 + i * ((h - 0.5) / (n - 1));
      const p = new THREE.Mesh(new THREE.BoxGeometry(width, 0.22, 0.05), stripeMat);
      p.position.set(0, y, 0);
      p.castShadow = true;
      g.add(p);
    }
    if (withLight) {
      g.add(box(0.05, 0.25, 0.05, '#333', 0, h + 0.1, 0));
      const lens = cyl(0.09, 0.09, 0.1, '#ffb400', 0, h + 0.28, 0);
      lens.rotation.x = Math.PI / 2;
      addBlinker(lens, Math.random() * Math.PI * 2);
      g.add(lens);
    }
    return g;
  };
}

function signBuilder(texOpts, { w = 1.1, h = 1.1, postH = 2.1, twoPost = false, backTex = null } = {}) {
  return () => {
    const g = new THREE.Group();
    const posts = twoPost ? [-w * 0.35, w * 0.35] : [0];
    for (const px of posts) g.add(box(0.07, postH, 0.07, '#8a8f98', px, postH / 2, 0));
    const tex = signTexture(texOpts);
    const mats = [
      lamb('#9aa0a8'), lamb('#9aa0a8'), lamb('#9aa0a8'), lamb('#9aa0a8'),
      new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.1 }),
      backTex
        ? new THREE.MeshStandardMaterial({ map: signTexture(backTex), transparent: true, alphaTest: 0.1 })
        : lamb('#7d838c'),
    ];
    const panel = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.04), mats);
    panel.position.y = postH + h / 2 - 0.15;
    // face +z: readable by side-A traffic, which approaches from +z
    panel.castShadow = true;
    g.add(panel);
    return g;
  };
}

function buildCatalog() {
  const drivableWrap = (make) => () => {
    const m = make().mesh;
    m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return m;
  };
  return [
    // ---------- VEHICLES (drivable — press E to get in) ----------
    { cat: 'Vehicles', id: 'fleet_pickup', icon: '🛻', name: 'DOT Crew Pickup', drivable: true,
      desc: 'Crew cab fleet pickup — blue dash striping, DIAL 511',
      blocks: false, build: drivableWrap(makeFleetPickup) },
    { cat: 'Vehicles', id: 'utility_truck', icon: '🚐', name: 'Utility Service Truck', drivable: true,
      desc: 'Service body, compartment doors, overhead ladder rack',
      blocks: false, build: drivableWrap(makeUtilityTruck) },
    { cat: 'Vehicles', id: 'stake_truck', icon: '🚚', name: 'Stake Bed Truck', drivable: true,
      desc: 'Long-hood cab with chrome grille and stake bed',
      blocks: false, build: drivableWrap(makeStakeTruck) },
    { cat: 'Vehicles', id: 'sign_truck', icon: '🪧', name: 'Custom Sign Truck', drivable: true,
      customText: true,
      desc: 'Flatbed with a big message board — you write the message',
      blocks: false, build: drivableWrap(() => makeSignTruck(signTruckText)) },
    { cat: 'Vehicles', id: 'drive_dump', icon: '🚚', name: 'DOT Dump Truck', drivable: true,
      desc: 'Drive the tandem dump truck around the site',
      blocks: false, build: () => CATALOG.find((d) => d.id === 'dump_truck').build() },
    { cat: 'Vehicles', id: 'drive_tma', icon: '🚛', name: 'Crash Truck (TMA)', drivable: true,
      desc: 'Drive the attenuator truck into position',
      blocks: false, build: () => CATALOG.find((d) => d.id === 'tma_truck').build() },

    // ---------- TOOLS (rectangle: click two corners) ----------
    { cat: 'Tools', id: 'road_breaker', icon: '🧨', name: 'Road Breaker', tool: 'breaker',
      desc: 'Click two corners of the lane to demolish pavement into dirt & rubble', blocks: false },
    { cat: 'Tools', id: 'trench', icon: '🕳️', name: 'Dig Trench', tool: 'trench',
      desc: 'Click two corners to open a dirt trench in the road', blocks: false },
    { cat: 'Tools', id: 'repave', icon: '⬛', name: 'Fresh Asphalt Patch', tool: 'repave',
      desc: 'Click two corners to lay fresh new blacktop', blocks: false },
    { cat: 'Tools', id: 'gravelpad', icon: '🟫', name: 'Gravel Pad', tool: 'gravel',
      desc: 'Click two corners to lay a compacted gravel work pad', blocks: false },

    // ---------- CONES ----------
    { cat: 'Cones', id: 'cone_skinny', icon: '🔶', name: 'Skinny Cone',
      desc: '28" standard traffic cone', blocks: true, build: coneBuilder(0.14, 0.72, 1) },
    { cat: 'Cones', id: 'cone_fat', icon: '🔶', name: 'Fat Cone',
      desc: 'Wide-body cone, extra stable', blocks: true, build: coneBuilder(0.22, 0.7, 2) },
    { cat: 'Cones', id: 'cone_tall', icon: '🔶', name: 'Tall Grabber Cone',
      desc: '36" cone with two reflective collars', blocks: true, build: coneBuilder(0.15, 0.95, 2) },
    { cat: 'Cones', id: 'drum', icon: '🛢️', name: 'Traffic Drum',
      desc: 'Orange channelizer barrel', blocks: true, build: () => {
        const g = new THREE.Group();
        const d = cyl(0.26, 0.3, 0.95, '#ff5e00', 0, 0.5, 0, 18);
        g.add(d);
        for (const y of [0.35, 0.62, 0.85]) {
          const band = new THREE.Mesh(
            new THREE.CylinderGeometry(0.285, 0.295, 0.11, 18),
            new THREE.MeshStandardMaterial({ color: '#fff', roughness: 0.25, emissive: '#cfd8de', emissiveIntensity: 0.25 })
          );
          band.position.y = y;
          g.add(band);
        }
        g.add(box(0.75, 0.06, 0.75, '#222', 0, 0.03, 0));
        return g;
      } },
    { cat: 'Cones', id: 'delineator', icon: '📍', name: 'Delineator Post',
      desc: 'Flexible orange post with reflector', blocks: true, build: () => {
        const g = new THREE.Group();
        g.add(cyl(0.35, 0.4, 0.08, '#222', 0, 0.04, 0, 12));
        g.add(cyl(0.045, 0.05, 1.0, '#ff6a00', 0, 0.58, 0, 8));
        g.add(cyl(0.052, 0.052, 0.1, '#ffffff', 0, 0.95, 0, 8));
        return g;
      } },

    // ---------- BARRICADES ----------
    { cat: 'Barricades', id: 'barricade1', icon: '🚧', name: 'Type I Barricade',
      desc: 'Single striped board on A-frame', blocks: true, build: barricadeBuilder(1, 0.9, false) },
    { cat: 'Barricades', id: 'barricade2m', icon: '🚧', name: 'Barricade + Marker',
      desc: 'Type II with flashing amber marker light', blocks: true, build: barricadeBuilder(2, 0.9, true) },
    { cat: 'Barricades', id: 'barricade3', icon: '🚧', name: 'Type III Barricade',
      desc: 'Full-width 3-board road closure barricade', blocks: true, build: barricadeBuilder(3, 2.4, true) },
    { cat: 'Barricades', id: 'aframe', icon: '🅰️', name: 'A-Frame Board',
      desc: 'Small folding barricade', blocks: true, build: barricadeBuilder(1, 0.65, false) },
    { cat: 'Barricades', id: 'jersey', icon: '🧱', name: 'Jersey Barrier',
      desc: 'Concrete safety barrier, 3 m', blocks: true, build: () => {
        const g = new THREE.Group();
        const b1 = box(0.6, 0.25, 3, '#b9bbb6', 0, 0.125, 0);
        const b2 = box(0.38, 0.45, 3, '#b9bbb6', 0, 0.47, 0);
        const b3 = box(0.2, 0.35, 3, '#b9bbb6', 0, 0.85, 0);
        g.add(b1, b2, b3);
        return g;
      } },
    { cat: 'Barricades', id: 'water_barrier', icon: '🟧', name: 'Water Barrier',
      desc: 'Orange water-filled plastic barrier', blocks: true, build: () => {
        const g = new THREE.Group();
        g.add(box(0.55, 0.8, 1.8, '#ff7422', 0, 0.4, 0));
        g.add(box(0.62, 0.12, 1.86, '#e05e0d', 0, 0.06, 0));
        g.add(cyl(0.08, 0.08, 0.05, '#ffd23f', 0, 0.83, 0.6));
        g.add(cyl(0.08, 0.08, 0.05, '#ffd23f', 0, 0.83, -0.6));
        return g;
      } },
    { cat: 'Barricades', id: 'fence', icon: '🥅', name: 'Safety Fence Panel',
      desc: 'Orange mesh construction fencing', blocks: true, build: () => {
        const g = new THREE.Group();
        g.add(cyl(0.04, 0.04, 1.2, '#555b63', -1.1, 0.6, 0));
        g.add(cyl(0.04, 0.04, 1.2, '#555b63', 1.1, 0.6, 0));
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(2.2, 0.95, 0.02),
          new THREE.MeshStandardMaterial({ color: '#ff6a00', transparent: true, opacity: 0.65 })
        );
        mesh.position.y = 0.62;
        g.add(mesh);
        return g;
      } },

    // ---------- SIGNS ----------
    { cat: 'Signs', id: 's_roadwork', icon: '⚠️', name: 'ROAD WORK AHEAD',
      desc: 'Orange diamond warning sign', blocks: true,
      build: signBuilder({ lines: ['ROAD', 'WORK', 'AHEAD'] }) },
    { cat: 'Signs', id: 's_rlc', icon: '⚠️', name: 'RIGHT LANE CLOSED',
      desc: 'Right lane closed ahead', blocks: true,
      build: signBuilder({ lines: ['RIGHT LANE', 'CLOSED', 'AHEAD'] }) },
    { cat: 'Signs', id: 's_llc', icon: '⚠️', name: 'LEFT LANE CLOSED',
      desc: 'Left lane closed ahead', blocks: true,
      build: signBuilder({ lines: ['LEFT LANE', 'CLOSED', 'AHEAD'] }) },
    { cat: 'Signs', id: 's_merge', icon: '↖️', name: 'MERGE Arrow',
      desc: 'Lane-merge arrow diamond', blocks: true,
      build: signBuilder({ big: 'arrow-merge' }) },
    { cat: 'Signs', id: 's_flagger', icon: '🚩', name: 'FLAGGER AHEAD',
      desc: 'Flagger symbol warning', blocks: true,
      build: signBuilder({ lines: ['FLAGGER', 'AHEAD'] }) },
    { cat: 'Signs', id: 's_shoulder', icon: '⚠️', name: 'SHOULDER WORK',
      desc: 'Shoulder work warning', blocks: true,
      build: signBuilder({ lines: ['SHOULDER', 'WORK'] }) },
    { cat: 'Signs', id: 's_onelane', icon: '⚠️', name: 'ONE LANE ROAD',
      desc: 'One lane road ahead', blocks: true,
      build: signBuilder({ lines: ['ONE LANE', 'ROAD', 'AHEAD'] }) },
    { cat: 'Signs', id: 's_detour', icon: '↪️', name: 'DETOUR',
      desc: 'Orange detour marker with arrow', blocks: true,
      build: signBuilder({ shape: 'rect', bg: '#ff7900', lines: ['DETOUR', '→'] }, { w: 1.2, h: 0.7, postH: 1.9 }) },
    { cat: 'Signs', id: 's_endwork', icon: '🏁', name: 'END ROAD WORK',
      desc: 'Marks the end of the work zone', blocks: true,
      build: signBuilder({ shape: 'rect', bg: '#ff7900', lines: ['END', 'ROAD WORK'] }, { w: 1.2, h: 0.9 }) },
    { cat: 'Signs', id: 's_closed', icon: '⛔', name: 'ROAD CLOSED',
      desc: 'White regulatory closure sign', blocks: true,
      build: signBuilder({ shape: 'rect', bg: '#ffffff', lines: ['ROAD', 'CLOSED'] }, { w: 1.5, h: 0.9, twoPost: true }) },
    { cat: 'Signs', id: 's_speed', icon: '🚸', name: 'SPEED LIMIT 45',
      desc: 'Work zone speed limit', blocks: true,
      build: signBuilder({ shape: 'rect', bg: '#ffffff', lines: ['SPEED', 'LIMIT', '45'] }, { w: 0.9, h: 1.2, postH: 2.2 }) },
    { cat: 'Signs', id: 's_paddle', icon: '🛑', name: 'STOP / SLOW Paddle',
      desc: 'Two-sided flagger paddle on staff', blocks: true,
      build: signBuilder(
        { shape: 'octagon', bg: '#c1121f', big: 'STOP', fg: '#fff' },
        { w: 0.75, h: 0.75, postH: 1.7, backTex: { shape: 'octagon', bg: '#ff7900', big: 'SLOW' } }
      ) },
    { cat: 'Signs', id: 's_prepstop', icon: '⚠️', name: 'BE PREPARED TO STOP',
      desc: 'Queue warning diamond', blocks: true,
      build: signBuilder({ lines: ['BE', 'PREPARED', 'TO STOP'] }) },
    { cat: 'Signs', id: 's_utility', icon: '⚠️', name: 'UTILITY WORK',
      desc: 'Utility work ahead diamond', blocks: true,
      build: signBuilder({ lines: ['UTILITY', 'WORK', 'AHEAD'] }) },
    { cat: 'Signs', id: 's_bump', icon: '⚠️', name: 'BUMP',
      desc: 'Rough pavement warning', blocks: true,
      build: signBuilder({ big: 'BUMP' }) },
    { cat: 'Signs', id: 's_freshoil', icon: '🛢️', name: 'FRESH OIL',
      desc: 'Fresh oil / loose gravel plaque', blocks: true,
      build: signBuilder({ shape: 'rect', bg: '#ff7900', lines: ['FRESH', 'OIL'] }, { w: 1.1, h: 0.8, postH: 1.9 }) },
    { cat: 'Signs', id: 's_reduced', icon: '⚠️', name: 'REDUCED SPEED AHEAD',
      desc: 'Speed reduction warning', blocks: true,
      build: signBuilder({ lines: ['REDUCED', 'SPEED', 'AHEAD'] }) },
    { cat: 'Signs', id: 's_exitclosed', icon: '⛔', name: 'EXIT CLOSED',
      desc: 'Exit closure panel', blocks: true,
      build: signBuilder({ shape: 'rect', bg: '#ff7900', lines: ['EXIT', 'CLOSED'] }, { w: 1.3, h: 0.8, twoPost: true }) },
    { cat: 'Signs', id: 's_trucks', icon: '⚠️', name: 'TRUCKS ENTERING',
      desc: 'Trucks entering highway warning', blocks: true,
      build: signBuilder({ lines: ['TRUCKS', 'ENTERING', 'HIGHWAY'] }) },

    // ---------- EQUIPMENT ----------
    { cat: 'Equipment', id: 'steel_poles', icon: '🏗️', name: 'Steel Pole Bundle',
      desc: 'Stacked steel poles on cribbing', blocks: true, build: () => {
        const g = new THREE.Group();
        g.add(box(0.3, 0.15, 0.3, '#7a5a34', -1.4, 0.075, 0));
        g.add(box(0.3, 0.15, 0.3, '#7a5a34', 1.4, 0.075, 0));
        let i = 0;
        for (let row = 0; row < 3; row++) {
          for (let k = 0; k <= 3 - row; k++) {
            const p = cyl(0.09, 0.09, 4, '#9aa2ad', (k - (3 - row) / 2) * 0.19, 0.24 + row * 0.16, 0, 8);
            p.rotation.z = Math.PI / 2;
            p.rotation.y = Math.PI / 2;
            g.add(p); i++;
          }
        }
        return g;
      } },
    { cat: 'Equipment', id: 'pallet', icon: '📦', name: 'Wood Pallet',
      desc: 'Single wooden pallet', blocks: true, build: () => palletMesh(1) },
    { cat: 'Equipment', id: 'pallet_stack', icon: '📦', name: 'Pallet Stack',
      desc: 'Stack of five pallets', blocks: true, build: () => palletMesh(5) },
    { cat: 'Equipment', id: 'sandbags', icon: '🪨', name: 'Sandbag Pile',
      desc: 'Pile of sandbags', blocks: true, build: () => {
        const g = new THREE.Group();
        const c = '#b39b6e';
        const positions = [
          [0, 0.09, 0], [0.35, 0.09, 0.1], [-0.35, 0.09, -0.05], [0.05, 0.09, 0.35],
          [-0.1, 0.09, -0.35], [0.15, 0.26, 0.12], [-0.2, 0.26, -0.1], [0, 0.42, 0],
        ];
        for (const [x, y, z] of positions) {
          const b = box(0.42, 0.18, 0.28, c, x, y, z);
          b.rotation.y = Math.random() * Math.PI;
          g.add(b);
        }
        return g;
      } },
    { cat: 'Equipment', id: 'plate', icon: '⬛', name: 'Steel Road Plate',
      desc: 'Heavy trench plate, drive-over', blocks: false, build: () => {
        const g = new THREE.Group();
        g.add(box(2.4, 0.05, 3, '#6b737d', 0, 0.025, 0));
        return g;
      } },
    { cat: 'Equipment', id: 'light_tower', icon: '💡', name: 'Light Tower',
      desc: 'Portable mast lighting, night-ready', blocks: true, build: () => {
        const g = new THREE.Group();
        g.add(box(1.4, 0.7, 0.8, '#ffb400', 0, 0.45, 0));
        g.add(cyl(0.16, 0.16, 0.35, '#333', -0.9, 0.18, 0.42, 8));
        g.add(cyl(0.16, 0.16, 0.35, '#333', -0.9, 0.18, -0.42, 8));
        g.add(cyl(0.05, 0.06, 4.6, '#8a8f98', 0.2, 3.1, 0));
        const head = new THREE.Group();
        for (const dx of [-0.34, -0.115, 0.115, 0.34]) {
          const lampBody = box(0.2, 0.28, 0.12, '#444', dx, 0, 0);
          const lens = new THREE.Mesh(
            new THREE.BoxGeometry(0.16, 0.22, 0.02),
            new THREE.MeshBasicMaterial({ color: '#fff6cc' })
          );
          lens.position.set(dx, 0, 0.08);
          head.add(lampBody, lens);
        }
        head.position.set(0.2, 5.35, 0);
        head.rotation.x = 0.35;
        g.add(head);
        // real light source — switched on by the time-of-day system
        const spot = new THREE.SpotLight('#fff3c4', 0, 60, 0.85, 0.5, 1.2);
        spot.position.set(0.2, 5.3, 0);
        spot.target.position.set(0.2, 0, 7);
        spot.visible = false;
        g.add(spot, spot.target);
        return g;
      } },
    { cat: 'Equipment', id: 'generator', icon: '🔌', name: 'Generator',
      desc: 'Towable diesel generator', blocks: true, build: () => {
        const g = new THREE.Group();
        g.add(box(1.8, 1.0, 1.0, '#ffd23f', 0, 0.75, 0));
        g.add(box(1.82, 0.1, 1.02, '#333', 0, 1.3, 0));
        const w1 = cyl(0.22, 0.22, 0.14, '#222', -0.7, 0.25, 0.51, 10);
        w1.rotation.x = Math.PI / 2;
        const w2 = cyl(0.22, 0.22, 0.14, '#222', -0.7, 0.25, -0.51, 10);
        w2.rotation.x = Math.PI / 2;
        g.add(w1, w2);
        g.add(cyl(0.04, 0.04, 1.0, '#888', 1.2, 0.35, 0));
        return g;
      } },
    { cat: 'Equipment', id: 'arrow_board', icon: '➡️', name: 'Arrow Board',
      desc: 'Flashing arrow trailer — merge left', blocks: true, build: () => {
        const g = new THREE.Group();
        g.add(box(1.9, 0.12, 1.1, '#ff8c1a', 0, 0.5, 0));
        const w1 = cyl(0.26, 0.26, 0.16, '#222', 0, 0.26, 0.58, 10);
        w1.rotation.x = Math.PI / 2;
        const w2 = cyl(0.26, 0.26, 0.16, '#222', 0, 0.26, -0.58, 10);
        w2.rotation.x = Math.PI / 2;
        g.add(w1, w2);
        const panel = box(2.4, 1.2, 0.08, '#1a1a1a', 0, 1.8, 0);
        g.add(panel);
        // arrow lamps (blinking, pointing left when facing traffic)
        const pts = [
          [-0.9, 0], [-0.55, 0], [-0.2, 0], [0.15, 0], [0.5, 0], [0.85, 0],
          [-0.55, 0.32], [-0.2, 0.55], [-0.55, -0.32], [-0.2, -0.55],
        ];
        for (const [x, y] of pts) {
          const lamp = cyl(0.09, 0.09, 0.06, '#ffb400', x, 1.8 + y, 0.06);
          lamp.rotation.x = Math.PI / 2;
          addBlinker(lamp, 0, 2.2);
          g.add(lamp);
        }
        return g;
      } },
    { cat: 'Equipment', id: 'message_board', icon: '🔤', name: 'Message Board',
      desc: 'Programmable message sign trailer', blocks: true, build: () => {
        const g = new THREE.Group();
        g.add(box(1.9, 0.12, 1.1, '#ff8c1a', 0, 0.5, 0));
        const w1 = cyl(0.26, 0.26, 0.16, '#222', 0, 0.26, 0.58, 10);
        w1.rotation.x = Math.PI / 2;
        const w2 = cyl(0.26, 0.26, 0.16, '#222', 0, 0.26, -0.58, 10);
        w2.rotation.x = Math.PI / 2;
        g.add(w1, w2);
        const c = makeCanvas(256, 128);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#0d0d0d'; ctx.fillRect(0, 0, 256, 128);
        ctx.fillStyle = '#ffb400';
        ctx.font = '900 34px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ROAD WORK', 128, 52);
        ctx.fillText('AHEAD', 128, 96);
        const tex = new THREE.CanvasTexture(c);
        const mats = [
          lamb('#222'), lamb('#222'), lamb('#222'), lamb('#222'),
          lamb('#222'),
          new THREE.MeshBasicMaterial({ map: tex }),
        ];
        const panel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 0.1), mats);
        panel.position.y = 1.9;
        panel.castShadow = true;
        g.add(panel);
        return g;
      } },
    { cat: 'Equipment', id: 'work_truck', icon: '🛻', name: 'DOT Work Truck',
      desc: 'Crew pickup — beacons, chevrons, DOT door decals', blocks: true,
      build: () => {
        const m = makePickup('#ff8c1a', true).mesh;
        m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        return m;
      } },
    { cat: 'Equipment', id: 'dump_truck', icon: '🚚', name: 'DOT Dump Truck',
      desc: 'Tandem dump truck loaded with gravel', blocks: true, build: () => {
        const g = new THREE.Group();
        const paint = shiny('#ff8c1a');
        g.add(box(2.1, 0.45, 7.0, '#26282c', 0, 0.7, 0));
        const cab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.3, 1.7), paint);
        cab.position.set(0, 1.55, 2.5); cab.castShadow = true;
        const windows = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.5, 1.5), glassMat());
        windows.position.set(0, 1.9, 2.5);
        const hood = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.8, 1.2), paint);
        hood.position.set(0, 1.3, 3.85); hood.castShadow = true;
        const grille = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 0.08), metalMat('#c8ced6'));
        grille.position.set(0, 1.25, 4.48);
        g.add(cab, windows, hood, grille);
        // dump bed with gravel load
        const bedM = shiny('#d8dade');
        for (const [w, h, d, x, y, z] of [
          [2.2, 0.9, 4.4, 0, 1.55, -1.5],
          [0.1, 1.2, 4.4, -1.05, 1.7, -1.5], [0.1, 1.2, 4.4, 1.05, 1.7, -1.5],
          [2.2, 1.2, 0.12, 0, 1.7, -3.7], [2.2, 1.2, 0.12, 0, 1.7, 0.7],
        ]) {
          const part = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bedM);
          part.position.set(x, y, z); part.castShadow = true;
          g.add(part);
        }
        const gravel = box(1.95, 0.45, 4.1, '#9a917f', 0, 2.15, -1.5);
        g.add(gravel);
        const beacon = cyl(0.1, 0.12, 0.16, '#ffb400', 0, 2.28, 2.5);
        addBlinker(beacon, 0, 5);
        g.add(beacon);
        g.add(dotDoorDecal(-1.06, 1.5, 2.5), dotDoorDecal(1.06, 1.5, 2.5));
        addWheels(g, 0.5, [[-1.0, 3.4], [1.0, 3.4], [-1.0, -1.2], [1.0, -1.2], [-1.0, -2.4], [1.0, -2.4]]);
        return g;
      } },
    { cat: 'Equipment', id: 'tma_truck', icon: '🚛', name: 'Crash Truck (TMA)',
      desc: 'Attenuator truck that shields the crew, arrow board up top', blocks: true, build: () => {
        const g = new THREE.Group();
        const paint = shiny('#ff8c1a');
        g.add(box(2.1, 0.45, 6.4, '#26282c', 0, 0.7, 0.4));
        const cab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.3, 1.8), paint);
        cab.position.set(0, 1.55, 2.6); cab.castShadow = true;
        const windows = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.5, 1.6), glassMat());
        windows.position.set(0, 1.9, 2.6);
        g.add(cab, windows);
        const bed = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.25, 3.8), paint);
        bed.position.set(0, 1.1, -0.4); bed.castShadow = true;
        g.add(bed);
        // ballast blocks
        g.add(box(1.8, 0.7, 2.6, '#c2c6cc', 0, 1.6, -0.4));
        // attenuator cushion at the rear (striped crash pad)
        const pad = new THREE.Mesh(
          new THREE.BoxGeometry(2.2, 0.9, 1.4),
          new THREE.MeshStandardMaterial({ map: stripeTexture(true) })
        );
        pad.position.set(0, 0.75, -3.1);
        pad.castShadow = true;
        g.add(pad);
        g.add(box(2.2, 0.12, 1.5, '#2a2c30', 0, 1.28, -3.08));
        // raised arrow board
        g.add(box(0.12, 1.6, 0.12, '#33373d', -0.8, 2.6, -1.6));
        g.add(box(0.12, 1.6, 0.12, '#33373d', 0.8, 2.6, -1.6));
        const board = box(2.3, 1.15, 0.1, '#141518', 0, 3.9, -1.6);
        g.add(board);
        const pts = [
          [-0.85, 0], [-0.5, 0], [-0.15, 0], [0.2, 0], [0.55, 0], [0.9, 0],
          [-0.5, 0.3], [-0.15, 0.52], [-0.5, -0.3], [-0.15, -0.52],
        ];
        for (const [x, y] of pts) {
          const lamp = cyl(0.08, 0.08, 0.06, '#ffb400', x, 3.9 + y, -1.66);
          lamp.rotation.x = Math.PI / 2;
          addBlinker(lamp, 0, 2.2);
          g.add(lamp);
        }
        g.add(dotDoorDecal(-1.06, 1.5, 2.6), dotDoorDecal(1.06, 1.5, 2.6));
        addWheels(g, 0.48, [[-1.0, 2.6], [1.0, 2.6], [-1.0, -1.4], [1.0, -1.4]]);
        return g;
      } },
    { cat: 'Equipment', id: 'dot_suv', icon: '🚙', name: 'DOT Supervisor SUV',
      desc: 'White fleet SUV with amber light bar', blocks: true, build: () => {
        const { mesh } = makeSUV();
        mesh.traverse((o) => {
          if (o.isMesh && o.material.color && !o.material.map &&
              o.material.roughness < 0.5 && o.material.color.getHexString() !== '7fb9dd') {
            o.material = shiny('#f4f5f7');
          }
        });
        const stripe = box(1.92, 0.16, 4.72, '#ff8c1a', 0, 0.9, 0);
        mesh.add(stripe);
        const bar = box(1.1, 0.1, 0.34, '#2a2c30', 0, 1.78, -0.25);
        mesh.add(bar);
        for (const bx of [-0.35, 0, 0.35]) {
          const lamp = cyl(0.08, 0.08, 0.1, '#ffb400', bx, 1.88, -0.25, 8);
          addBlinker(lamp, bx * 5, 4);
          mesh.add(lamp);
        }
        mesh.add(dotDoorDecal(-1.0, 1.0, 0.6), dotDoorDecal(1.0, 1.0, 0.6));
        mesh.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        return mesh;
      } },
    { cat: 'Equipment', id: 'excavator', icon: '🚜', name: 'Mini Excavator',
      desc: 'Tracked digger with boom arm', blocks: true, build: () => {
        const g = new THREE.Group();
        g.add(box(0.5, 0.5, 2.6, '#2f2f2f', -0.75, 0.3, 0));
        g.add(box(0.5, 0.5, 2.6, '#2f2f2f', 0.75, 0.3, 0));
        g.add(box(1.6, 0.3, 2.0, '#caa53d', 0, 0.65, 0));
        g.add(box(1.2, 1.0, 1.3, '#ffb400', -0.15, 1.3, -0.3));
        const glass = box(0.9, 0.7, 0.9, '#9fd8ff', -0.15, 1.42, -0.28);
        g.add(glass);
        const boom = box(0.25, 0.3, 1.8, '#ffb400', 0.35, 1.45, 1.0);
        boom.rotation.x = -0.55;
        g.add(boom);
        const stick = box(0.2, 0.25, 1.4, '#ffb400', 0.35, 2.05, 2.0);
        stick.rotation.x = 0.8;
        g.add(stick);
        const bucket = box(0.5, 0.4, 0.45, '#8a8f98', 0.35, 1.4, 2.6);
        g.add(bucket);
        return g;
      } },
    { cat: 'Equipment', id: 'porta', icon: '🚻', name: 'Porta-John',
      desc: 'Every job site needs one', blocks: true, build: () => {
        const g = new THREE.Group();
        g.add(box(1.1, 2.2, 1.1, '#1668b3', 0, 1.1, 0));
        g.add(box(1.16, 0.15, 1.16, '#e8e8e8', 0, 2.25, 0));
        g.add(box(0.08, 1.7, 0.7, '#0e4a80', 0.52, 1.05, 0));
        g.add(box(0.06, 0.25, 0.06, '#ddd', 0.56, 1.1, 0.25));
        return g;
      } },

    // ---------- PROPS ----------
    { cat: 'Props', id: 'toolbox', icon: '🧰', name: 'Toolbox',
      desc: 'Red mechanic toolbox', blocks: false, build: () => {
        const g = new THREE.Group();
        g.add(box(0.62, 0.3, 0.3, '#c0261d', 0, 0.16, 0));
        g.add(box(0.64, 0.1, 0.32, '#8f1a13', 0, 0.36, 0));
        g.add(box(0.2, 0.05, 0.06, '#2a2c30', 0, 0.44, 0));
        g.add(box(0.05, 0.08, 0.32, '#d8dade', -0.31, 0.3, 0));
        g.add(box(0.05, 0.08, 0.32, '#d8dade', 0.31, 0.3, 0));
        return g;
      } },
    { cat: 'Props', id: 'jobbox', icon: '🗄️', name: 'Job Site Gang Box',
      desc: 'Heavy steel storage chest', blocks: true, build: () => {
        const g = new THREE.Group();
        g.add(box(1.6, 0.75, 0.75, '#d8a713', 0, 0.55, 0));
        g.add(box(1.62, 0.14, 0.77, '#b58a0d', 0, 0.98, 0));
        g.add(box(0.3, 0.06, 0.1, '#2a2c30', 0, 1.06, 0.3));
        for (const cx of [-0.65, 0.65]) for (const cz of [-0.28, 0.28]) {
          g.add(cyl(0.09, 0.09, 0.16, '#26282c', cx, 0.1, cz, 8));
        }
        return g;
      } },
    { cat: 'Props', id: 'step_ladder', icon: '🪜', name: 'Step Ladder',
      desc: 'A-frame fiberglass step ladder', blocks: false, build: () => {
        const g = new THREE.Group();
        for (const dz of [-0.42, 0.42]) {
          for (const dx of [-0.28, 0.28]) {
            const rail = box(0.06, 1.7, 0.09, dz < 0 ? '#d8a713' : '#c2c6cc', dx, 0.82, dz);
            rail.rotation.x = dz < 0 ? 0.28 : -0.28;
            g.add(rail);
          }
        }
        for (let i = 0; i < 4; i++) {
          const step = box(0.55, 0.05, 0.14, '#d8dade', 0, 0.3 + i * 0.38, -0.32 + i * 0.11);
          g.add(step);
        }
        g.add(box(0.6, 0.05, 0.3, '#c0261d', 0, 1.62, 0));
        return g;
      } },
    { cat: 'Props', id: 'ext_ladder', icon: '🪜', name: 'Extension Ladder',
      desc: 'Long leaning ladder — stretch it with [ ]', blocks: false, stretch: 'z', build: () => {
        const g = new THREE.Group();
        const lean = new THREE.Group();
        for (const dx of [-0.25, 0.25]) {
          lean.add(box(0.06, 0.1, 4.2, '#d8dade', dx, 0, 0));
        }
        for (let i = 0; i < 12; i++) {
          lean.add(box(0.46, 0.05, 0.07, '#c2c6cc', 0, 0, -1.9 + i * 0.35));
        }
        lean.position.y = 1.55;
        lean.rotation.x = -0.75;   // leaning up
        g.add(lean);
        return g;
      } },
    { cat: 'Props', id: 'bucket', icon: '🪣', name: 'Asphalt Bucket',
      desc: 'Sealcoat / asphalt patch bucket', blocks: false, build: () => {
        const g = new THREE.Group();
        g.add(cyl(0.18, 0.15, 0.38, '#17181a', 0, 0.19, 0, 14));
        g.add(cyl(0.185, 0.185, 0.04, '#33373d', 0, 0.4, 0, 14));
        const lbl = cyl(0.181, 0.181, 0.14, '#e8e8e8', 0, 0.22, 0, 14);
        g.add(lbl);
        return g;
      } },
    { cat: 'Props', id: 'bucket_stack', icon: '🪣', name: 'Bucket Pallet',
      desc: 'Pallet stacked with asphalt buckets', blocks: true, build: () => {
        const g = palletMesh(1);
        for (let i = 0; i < 6; i++) {
          const b = cyl(0.18, 0.15, 0.38, i % 2 ? '#17181a' : '#3a3d42', -0.4 + (i % 3) * 0.4, 0.34, i < 3 ? -0.28 : 0.28, 12);
          g.add(b);
          g.add(cyl(0.185, 0.185, 0.04, '#33373d', b.position.x, 0.55, b.position.z, 12));
        }
        return g;
      } },
    { cat: 'Props', id: 'steel_beam', icon: '🏗️', name: 'Steel I-Beam',
      desc: 'Structural beam on cribbing — stretch with [ ]', blocks: true, stretch: 'z', build: () => {
        const g = new THREE.Group();
        g.add(box(0.3, 0.15, 0.3, '#7a5a34', 0, 0.075, -1.6));
        g.add(box(0.3, 0.15, 0.3, '#7a5a34', 0, 0.075, 1.6));
        const m = shiny('#9aa2ad', { metalness: 0.5, roughness: 0.4 });
        const flangeB = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 4.4), m);
        flangeB.position.y = 0.18;
        const web = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.34, 4.4), m);
        web.position.y = 0.38;
        const flangeT = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 4.4), m);
        flangeT.position.y = 0.58;
        flangeB.castShadow = web.castShadow = flangeT.castShadow = true;
        g.add(flangeB, web, flangeT);
        return g;
      } },
    { cat: 'Props', id: 'beam_column', icon: '🏛️', name: 'Steel Column',
      desc: 'Vertical I-beam column — stretch height with [ ]', blocks: true, stretch: 'y', build: () => {
        const g = new THREE.Group();
        g.add(box(0.7, 0.06, 0.7, '#6f7680', 0, 0.03, 0));
        const m = shiny('#9aa2ad', { metalness: 0.5, roughness: 0.4 });
        const web = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.4, 0.3), m);
        web.position.y = 1.76;
        const f1 = new THREE.Mesh(new THREE.BoxGeometry(0.36, 3.4, 0.06), m);
        f1.position.set(0, 1.76, 0.17);
        const f2 = new THREE.Mesh(new THREE.BoxGeometry(0.36, 3.4, 0.06), m);
        f2.position.set(0, 1.76, -0.17);
        web.castShadow = f1.castShadow = f2.castShadow = true;
        g.add(web, f1, f2);
        return g;
      } },
    { cat: 'Props', id: 'rebar', icon: '🥢', name: 'Rebar Bundle',
      desc: 'Bundle of rebar — stretch with [ ]', blocks: false, stretch: 'z', build: () => {
        const g = new THREE.Group();
        for (let i = 0; i < 8; i++) {
          const r = cyl(0.025, 0.025, 3.4, '#6b4f3a', (Math.random() - 0.5) * 0.22, 0.05 + Math.random() * 0.16, (Math.random() - 0.5) * 0.2, 6);
          r.rotation.x = Math.PI / 2;
          g.add(r);
        }
        g.add(box(0.34, 0.26, 0.08, '#8a9099', 0, 0.13, -1.0));
        g.add(box(0.34, 0.26, 0.08, '#8a9099', 0, 0.13, 1.0));
        return g;
      } },
    { cat: 'Props', id: 'pipe_concrete', icon: '⭕', name: 'Concrete Pipe',
      desc: 'Big culvert section — stretch with [ ]', blocks: true, stretch: 'z', build: () => {
        const g = new THREE.Group();
        const pipe = new THREE.Mesh(
          new THREE.CylinderGeometry(0.7, 0.7, 2.4, 16, 1, true),
          lamb('#b9bbb6', { side: THREE.DoubleSide })
        );
        pipe.rotation.x = Math.PI / 2;
        pipe.position.y = 0.7;
        pipe.castShadow = true;
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.07, 8, 16), lamb('#a5a7a2'));
        rim.position.set(0, 0.7, 1.2);
        const rim2 = rim.clone();
        rim2.position.z = -1.2;
        g.add(pipe, rim, rim2);
        return g;
      } },
    { cat: 'Props', id: 'scaffold', icon: '🏗️', name: 'Scaffold Tower',
      desc: 'Two-level scaffolding with planks', blocks: true, build: () => {
        const g = new THREE.Group();
        const m = shiny('#c2c6cc');
        for (const dx of [-0.9, 0.9]) for (const dz of [-0.6, 0.6]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.8, 8), m);
          leg.position.set(dx, 1.9, dz);
          leg.castShadow = true;
          g.add(leg);
        }
        for (const y of [1.2, 2.4, 3.6]) {
          for (const dz of [-0.6, 0.6]) {
            const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 6), m);
            bar.rotation.z = Math.PI / 2;
            bar.position.set(0, y, dz);
            g.add(bar);
          }
          const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.1, 6), m);
          cross.rotation.z = Math.PI / 2;
          cross.rotation.y = 0.6;
          cross.position.set(0, y - 0.5, 0);
          g.add(cross);
        }
        for (const y of [1.25, 2.45]) {
          for (let k = 0; k < 4; k++) {
            g.add(box(0.42, 0.05, 1.3, '#a3763f', -0.68 + k * 0.45, y, 0));
          }
        }
        return g;
      } },
    { cat: 'Props', id: 'dirt_pile', icon: '⛰️', name: 'Dirt Pile + Shovel',
      desc: 'Fresh dig with a shovel stuck in it', blocks: true, build: () => {
        const g = new THREE.Group();
        const pile = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.9, 9), lamb('#6e532f'));
        pile.position.y = 0.45;
        pile.castShadow = true;
        g.add(pile);
        const handle = cyl(0.03, 0.03, 1.2, '#a3763f', 0.4, 1.15, 0.2, 6);
        handle.rotation.z = 0.5;
        g.add(handle);
        const blade = box(0.24, 0.3, 0.04, '#8a9099', 0.13, 0.68, 0.2);
        blade.rotation.z = 0.5;
        g.add(blade);
        return g;
      } },
    { cat: 'Props', id: 'gravel_pile', icon: '🪨', name: 'Gravel Pile',
      desc: 'Crushed aggregate pile', blocks: true, build: () => {
        const g = new THREE.Group();
        const pile = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.0, 10), lamb('#8f8b82'));
        pile.position.y = 0.5;
        pile.castShadow = true;
        g.add(pile);
        for (let i = 0; i < 6; i++) {
          const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1 + Math.random() * 0.08, 0), lamb('#7d7a72'));
          const a = Math.random() * Math.PI * 2;
          rock.position.set(Math.cos(a) * (1.2 + Math.random() * 0.4), 0.08, Math.sin(a) * (1.2 + Math.random() * 0.4));
          g.add(rock);
        }
        return g;
      } },
    { cat: 'Props', id: 'cooler', icon: '🧊', name: 'Water Cooler',
      desc: 'Orange crew cooler with cup sleeve', blocks: false, build: () => {
        const g = new THREE.Group();
        g.add(cyl(0.24, 0.24, 0.5, '#e85d04', 0, 0.27, 0, 14));
        g.add(cyl(0.25, 0.25, 0.09, '#f5f5f5', 0, 0.56, 0, 14));
        g.add(box(0.06, 0.05, 0.08, '#f5f5f5', 0, 0.16, 0.24));
        g.add(cyl(0.05, 0.05, 0.3, '#f5f5f5', 0.33, 0.2, 0, 8));
        return g;
      } },
    { cat: 'Props', id: 'wheelbarrow', icon: '🛒', name: 'Wheelbarrow',
      desc: 'Contractor wheelbarrow', blocks: false, build: () => {
        const g = new THREE.Group();
        const tub = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.35, 0.4, 10, 1, true), lamb('#c0261d', { side: THREE.DoubleSide }));
        tub.position.set(0, 0.55, 0.2);
        tub.scale.z = 0.7;
        tub.castShadow = true;
        g.add(tub);
        const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.04, 10), lamb('#a01f17'));
        bottom.position.set(0, 0.37, 0.2);
        bottom.scale.z = 0.7;
        g.add(bottom);
        for (const hx of [-0.22, 0.22]) {
          const h = box(0.05, 0.05, 1.5, '#a3763f', hx, 0.42, -0.35);
          h.rotation.x = 0.12;
          g.add(h);
          g.add(box(0.05, 0.35, 0.05, '#6f7680', hx, 0.2, -0.55));
        }
        const wheel = makeWheel(0.22, 0.12);
        wheel.position.set(0, 0.22, 0.75);
        g.add(wheel);
        return g;
      } },
    { cat: 'Props', id: 'cable_reel', icon: '🧵', name: 'Cable Reel',
      desc: 'Big wooden utility spool', blocks: true, build: () => {
        const g = new THREE.Group();
        const side1 = cyl(0.7, 0.7, 0.1, '#a3763f', 0, 0.7, 0.35, 16);
        side1.rotation.x = Math.PI / 2;
        const side2 = cyl(0.7, 0.7, 0.1, '#a3763f', 0, 0.7, -0.35, 16);
        side2.rotation.x = Math.PI / 2;
        const core = cyl(0.32, 0.32, 0.62, '#2a2c30', 0, 0.7, 0, 14);
        core.rotation.x = Math.PI / 2;
        g.add(side1, side2, core);
        return g;
      } },
    { cat: 'Props', id: 'portable_signal', icon: '🚦', name: 'Portable Traffic Signal',
      desc: 'Temporary work-zone signal on a trailer mast', blocks: true, build: () => {
        const g = new THREE.Group();
        g.add(box(1.0, 0.14, 1.4, '#ff8c1a', 0, 0.4, 0));
        const w1 = cyl(0.24, 0.24, 0.14, '#222', 0, 0.24, 0.5, 10); w1.rotation.x = Math.PI / 2;
        const w2 = cyl(0.24, 0.24, 0.14, '#222', 0, 0.24, -0.5, 10); w2.rotation.x = Math.PI / 2;
        g.add(w1, w2);
        g.add(cyl(0.07, 0.08, 3.6, '#3a3d42', 0, 2.3, 0, 8));
        const head = box(0.34, 1.0, 0.28, '#1a1c20', 0, 4.0, 0);
        g.add(head);
        const rl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), new THREE.MeshStandardMaterial({ color: '#7a1414', emissive: '#ff2020', emissiveIntensity: 1.2 }));
        rl.position.set(0, 4.28, 0.15); g.add(rl);
        g.add(cyl(0.11, 0.11, 0.05, '#3a2a00', 0, 4.0, 0.15, 8));
        const grn = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshStandardMaterial({ color: '#0a3d0a', emissive: '#111', emissiveIntensity: 0 }));
        grn.position.set(0, 3.72, 0.15); g.add(grn);
        return g;
      } },
    { cat: 'Props', id: 'concrete_bags', icon: '🧱', name: 'Concrete Bag Pallet',
      desc: 'Shrink-wrapped pallet of concrete mix', blocks: true, build: () => {
        const g = palletMesh(1);
        for (let row = 0; row < 3; row++) for (let i = 0; i < 4; i++) {
          const bag = box(0.5, 0.16, 0.34, i % 2 ? '#c9c3b4' : '#bdb7a6', -0.55 + (i % 2) * 0.55, 0.22 + row * 0.17, -0.2 + (i > 1 ? 0.4 : 0));
          bag.rotation.y = (i > 1 ? 0.05 : -0.05);
          g.add(bag);
        }
        return g;
      } },
    { cat: 'Props', id: 'compressor', icon: '⚙️', name: 'Air Compressor',
      desc: 'Towable air compressor unit', blocks: true, build: () => {
        const g = new THREE.Group();
        g.add(rbox(1.5, 0.9, 0.9, lamb('#d21f1f'), 0.1, 0, 0.75, 0));
        g.add(box(1.52, 0.1, 0.92, '#26282c', 0, 1.25, 0));
        g.add(cyl(0.06, 0.06, 1.0, '#8a9099', 1.0, 0.4, 0, 8));
        const w1 = cyl(0.2, 0.2, 0.12, '#222', 0, 0.2, 0.46, 10); w1.rotation.x = Math.PI / 2;
        const w2 = cyl(0.2, 0.2, 0.12, '#222', 0, 0.2, -0.46, 10); w2.rotation.x = Math.PI / 2;
        g.add(w1, w2);
        g.add(cyl(0.05, 0.05, 0.6, '#1a1c20', -0.6, 0.9, 0.3, 6));
        return g;
      } },
    { cat: 'Props', id: 'jackhammer', icon: '🔨', name: 'Jackhammer',
      desc: 'Pneumatic breaker leaning on the deck', blocks: false, build: () => {
        const g = new THREE.Group();
        const jh = new THREE.Group();
        jh.add(box(0.16, 0.4, 0.16, '#d8a713', 0, 1.0, 0));
        jh.add(box(0.4, 0.1, 0.1, '#26282c', 0, 1.2, 0));
        jh.add(cyl(0.04, 0.03, 0.9, '#8a9099', 0, 0.45, 0, 8));
        jh.rotation.z = 0.35;
        g.add(jh);
        return g;
      } },
    { cat: 'Props', id: 'saw_stand', icon: '🪚', name: 'Cut-Off Saw',
      desc: 'Concrete cut-off saw on a stand', blocks: false, build: () => {
        const g = new THREE.Group();
        for (const dx of [-0.3, 0.3]) { const l = box(0.05, 0.7, 0.05, '#3a3d42', dx, 0.35, -0.2); l.rotation.x = 0.2; g.add(l); }
        g.add(box(0.7, 0.12, 0.4, '#d21f1f', 0, 0.72, 0));
        g.add(cyl(0.28, 0.28, 0.03, '#c8ccd4', 0.4, 0.85, 0, 18));
        g.add(box(0.4, 0.2, 0.24, '#e8a200', -0.1, 0.85, 0));
        return g;
      } },
    { cat: 'Props', id: 'survey_tripod', icon: '📐', name: 'Survey Tripod',
      desc: 'Total station on a survey tripod', blocks: false, build: () => {
        const g = new THREE.Group();
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          const leg = cyl(0.03, 0.03, 1.6, '#e8b923', Math.cos(a) * 0.35, 0.8, Math.sin(a) * 0.35, 6);
          leg.rotation.x = Math.cos(a) * 0.22; leg.rotation.z = -Math.sin(a) * 0.22;
          g.add(leg);
        }
        g.add(box(0.22, 0.2, 0.16, '#1a1c20', 0, 1.6, 0));
        g.add(cyl(0.05, 0.05, 0.18, '#3a3d42', 0.14, 1.62, 0, 8));
        return g;
      } },
    { cat: 'Props', id: 'beacon_stand', icon: '🚨', name: 'Flashing Beacon Stand',
      desc: 'Amber warning beacon on a tripod', blocks: false, build: () => {
        const g = new THREE.Group();
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          const leg = cyl(0.03, 0.03, 1.5, '#3a3d42', Math.cos(a) * 0.28, 0.75, Math.sin(a) * 0.28, 6);
          leg.rotation.x = Math.cos(a) * 0.2; leg.rotation.z = -Math.sin(a) * 0.2;
          g.add(leg);
        }
        const lens = cyl(0.14, 0.14, 0.16, '#ffb400', 0, 1.55, 0, 12);
        addBlinker(lens, 0, 3.5);
        g.add(lens);
        g.add(cyl(0.15, 0.15, 0.04, '#1a1c20', 0, 1.45, 0, 12));
        return g;
      } },
    { cat: 'Props', id: 'pipe_stack', icon: '🧻', name: 'PVC Pipe Stack',
      desc: 'Stacked white PVC pipes — stretch with [ ]', blocks: true, stretch: 'z', build: () => {
        const g = new THREE.Group();
        g.add(box(0.3, 0.15, 0.3, '#7a5a34', 0, 0.075, -1.4));
        g.add(box(0.3, 0.15, 0.3, '#7a5a34', 0, 0.075, 1.4));
        let row = 0;
        for (let r = 0; r < 3; r++) {
          for (let k = 0; k <= 3 - r; k++) {
            const p = cyl(0.11, 0.11, 3.6, '#e8eaec', (k - (3 - r) / 2) * 0.24, 0.28 + r * 0.2, 0, 12);
            p.rotation.x = Math.PI / 2;
            g.add(p); row++;
          }
        }
        return g;
      } },
    { cat: 'Props', id: 'safety_net_roll', icon: '🧶', name: 'Safety Netting Roll',
      desc: 'Roll of orange construction fencing', blocks: false, build: () => {
        const g = new THREE.Group();
        const roll = cyl(0.35, 0.35, 1.0, '#ff6a00', 0, 0.35, 0, 14);
        roll.rotation.z = Math.PI / 2;
        g.add(roll);
        g.add(cyl(0.36, 0.36, 0.05, '#e05e0d', 0.5, 0.35, 0, 14));
        g.add(cyl(0.36, 0.36, 0.05, '#e05e0d', -0.5, 0.35, 0, 14));
        return g;
      } },
    { cat: 'Props', id: 'water_tank', icon: '🛢️', name: 'Water Tank',
      desc: 'Poly water tank on a skid', blocks: true, build: () => {
        const g = new THREE.Group();
        g.add(box(1.6, 0.12, 1.2, '#3a3d42', 0, 0.06, 0));
        const tank = cyl(0.55, 0.6, 1.4, '#2f7fb0', 0, 0.82, 0, 16);
        tank.rotation.z = Math.PI / 2;
        g.add(tank);
        g.add(cyl(0.12, 0.12, 0.1, '#1a1c20', 0, 1.4, 0, 10));
        g.add(cyl(0.05, 0.05, 0.4, '#8a9099', 0.75, 0.6, 0, 8));
        return g;
      } },
    { cat: 'Props', id: 'manhole', icon: '⚫', name: 'Open Manhole',
      desc: 'Open manhole ringed with mini cones', blocks: true, build: () => {
        const g = new THREE.Group();
        g.add(cyl(0.55, 0.55, 0.06, '#3a3d42', 0, 0.03, 0, 18));
        g.add(cyl(0.42, 0.42, 0.4, '#0a0a0c', 0, -0.2, 0, 16));
        const lid = cyl(0.5, 0.5, 0.05, '#5a5f66', 0.8, 0.025, 0.3, 18);
        g.add(lid);
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const cone = cyl(0.05, 0.12, 0.35, '#ff6a00', Math.cos(a) * 0.7, 0.17, Math.sin(a) * 0.7, 8);
          g.add(cone);
          g.add(cyl(0.09, 0.1, 0.06, '#f5f5f5', Math.cos(a) * 0.7, 0.22, Math.sin(a) * 0.7, 8));
        }
        return g;
      } },
    { cat: 'Props', id: 'tool_cart', icon: '🛒', name: 'Tool Cart',
      desc: 'Rolling tool cart with drawers', blocks: true, build: () => {
        const g = new THREE.Group();
        g.add(rbox(0.9, 0.9, 0.55, lamb('#1668b3'), 0.05, 0, 0.6, 0));
        for (const y of [0.4, 0.62, 0.84]) {
          g.add(box(0.82, 0.02, 0.5, '#0e4a80', 0, y, 0.02));
          g.add(box(0.24, 0.04, 0.06, '#c8ccd4', 0, y, 0.3));
        }
        g.add(box(0.92, 0.06, 0.57, '#e8eaec', 0, 1.08, 0));
        for (const [x, z] of [[-0.38, 0.2], [0.38, 0.2], [-0.38, -0.2], [0.38, -0.2]]) {
          const w = cyl(0.08, 0.08, 0.05, '#1a1c20', x, 0.1, z, 8); w.rotation.x = Math.PI / 2; g.add(w);
        }
        return g;
      } },
    { cat: 'Props', id: 'debris_pile', icon: '🗑️', name: 'Debris Pile',
      desc: 'Pile of busted concrete and rubble', blocks: true, build: () => {
        const g = new THREE.Group();
        for (let i = 0; i < 14; i++) {
          const c = box(0.2 + Math.random() * 0.3, 0.1 + Math.random() * 0.15, 0.2 + Math.random() * 0.3, i % 3 ? '#9a958c' : '#3a3d42');
          const a = Math.random() * Math.PI * 2, r = Math.random() * 0.7;
          c.position.set(Math.cos(a) * r, 0.08 + Math.random() * 0.35, Math.sin(a) * r);
          c.rotation.set(Math.random(), Math.random() * Math.PI, Math.random());
          g.add(c);
        }
        return g;
      } },
  ];
}

function palletMesh(count) {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const y0 = i * 0.15;
    const p = new THREE.Group();
    for (const dz of [-0.5, 0, 0.5]) p.add(box(1.2, 0.09, 0.09, '#a3763f', 0, y0 + 0.05, dz));
    for (let k = 0; k < 5; k++) p.add(box(0.16, 0.03, 1.1, '#b98a4e', -0.5 + k * 0.25, y0 + 0.11, 0));
    p.rotation.y = count > 1 ? (Math.random() - 0.5) * 0.15 : 0;
    g.add(p);
  }
  return g;
}

const CATALOG = buildCatalog();
const CATEGORIES = ['Vehicles', 'Tools', 'Cones', 'Barricades', 'Signs', 'Equipment', 'Props'];

// ============================================================
// Menu UI flow
// ============================================================
function initMenus() {
  $('btn-start').onclick = () => { hide($('screen-title')); showStatePicker(); };
  $('btn-back-state').onclick = () => { hide($('screen-highway')); show($('screen-state')); };
  $('btn-back-highway').onclick = () => { hide($('screen-vest')); show($('screen-highway')); };
  $('btn-resume').onclick = resumeGame;
  $('btn-clear').onclick = () => { clearPlaced(); resumeGame(); };
  $('btn-menu').onclick = () => location.reload();
  $('build-close').onclick = closeBuildMenu;
}

function showStatePicker() {
  const grid = $('state-grid');
  if (!grid.childElementCount) {
    for (const [name, s] of Object.entries(STATES)) {
      const card = document.createElement('div');
      card.className = 'state-card';
      card.innerHTML = `<span class="state-abbr">${s.abbr}</span>
        <div class="state-name">${name}</div>
        <div class="state-count">${s.highways.length} highways</div>`;
      card.onclick = () => { sel.state = name; showHighwayPicker(); };
      grid.appendChild(card);
    }
  }
  show($('screen-state'));
}

function showHighwayPicker() {
  hide($('screen-state'));
  const s = STATES[sel.state];
  $('highway-sub').textContent = `Real highways in ${sel.state} — modeled from map data`;
  const list = $('highway-list');
  list.innerHTML = '';
  for (const hw of s.highways) {
    const card = document.createElement('div');
    card.className = 'highway-card';
    const shieldWrap = document.createElement('div');
    shieldWrap.className = 'highway-shield';
    shieldWrap.appendChild(shieldCanvas(hw.sign, hw.num, 112));
    const info = document.createElement('div');
    info.className = 'highway-info';
    const label = hw.sign === 'I' ? `I-${hw.num}` : hw.sign === 'US' ? `US-${hw.num}` : `${s.abbr}-${hw.num}`;
    info.innerHTML = `<div class="highway-name">${label} &mdash; ${hw.name}</div>
      <div class="highway-meta">to <b>${hw.city}</b> &bull; ${TERRAIN_NAMES[hw.terrain]} &bull; ${hw.lanes} lanes each way &bull; ${hw.speed} mph</div>`;
    card.append(shieldWrap, info);
    card.onclick = () => { sel.highway = hw; showVestPicker(); };
    list.appendChild(card);
  }
  show($('screen-highway'));
}

function showVestPicker() {
  hide($('screen-highway'));
  $('vest-sub').textContent = `${sel.state} crew vests — pick your look`;
  const list = $('vest-list');
  list.innerHTML = '';
  for (const vest of vestsForState(sel.state)) {
    const card = document.createElement('div');
    card.className = 'vest-card';
    const prev = document.createElement('div');
    prev.className = 'vest-preview';
    prev.style.background = vest.base;
    prev.style.setProperty('--stripe', vest.stripe);
    prev.querySelectorAll && (prev.innerHTML = `<div class="vest-band" style="background:${vest.stripe}"></div>`);
    // vertical stripes via pseudo elements need inline style workaround:
    const st1 = document.createElement('div');
    st1.style.cssText = `position:absolute;top:0;bottom:0;left:16px;width:14px;background:${vest.stripe}`;
    const st2 = document.createElement('div');
    st2.style.cssText = `position:absolute;top:0;bottom:0;right:16px;width:14px;background:${vest.stripe}`;
    const trim = document.createElement('div');
    trim.style.cssText = `position:absolute;top:0;left:0;right:0;height:10px;background:${vest.trim};border-radius:7px 7px 0 0`;
    prev.append(st1, st2, trim);
    card.appendChild(prev);
    card.insertAdjacentHTML('beforeend',
      `<div class="vest-name">${vest.name}</div><div class="vest-desc">${vest.desc}</div>`);
    card.onclick = () => { sel.vest = vest; startGame(); };
    list.appendChild(card);
  }
  show($('screen-vest'));
}

// ============================================================
// Game start
// ============================================================
function startGame() {
  hide($('screen-vest'));
  const s = STATES[sel.state];
  const hw = sel.highway;
  const label = hw.sign === 'I' ? `I-${hw.num}` : hw.sign === 'US' ? `US-${hw.num}` : `${s.abbr}-${hw.num}`;
  $('loading-text').textContent = `Building ${label} from map data...`;
  show($('screen-loading'));

  setTimeout(() => {
    initThree();
    buildWorld();
    spawnPlayer();
    spawnTraffic();
    initBuildUI();
    hide($('screen-loading'));
    show($('hud'));
    $('location-tag').innerHTML =
      `<b>${label}</b> &mdash; ${hw.name}<br/>${sel.state} &bull; ${TERRAIN_NAMES[hw.terrain]} &bull; ` +
      `${hw.lanes} lanes each way &bull; to ${hw.city}`;
    playing = true;
    requestLock();
    toast('Click to lock the mouse. Press B to open the build menu!', 4200);
  }, 450);
}

function initThree() {
  const canvas = $('game-canvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 2200);
  clock = new THREE.Clock();

  // PMREM generator for image-based lighting (real reflections on paint/glass/metal)
  pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// ---- equirectangular sky, used both for the environment (IBL) and dome ----
function equirectSky(topC, midC, horizonC, groundC, sunY, stars) {
  const w = 512, h = 256;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0.0, topC);
  grad.addColorStop(0.42, midC);
  grad.addColorStop(0.5, horizonC);
  grad.addColorStop(0.52, groundC);
  grad.addColorStop(1.0, groundC);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  if (stars) {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 200; i++) {
      const y = Math.random() * (h * 0.46);
      ctx.globalAlpha = 0.35 + Math.random() * 0.65;
      const s = Math.random() < 0.1 ? 2 : 1;
      ctx.fillRect(Math.random() * w, y, s, s);
    }
    ctx.globalAlpha = 1;
  }
  // sun / moon disc + glow
  const sx = w * 0.72, sy = h * (0.46 - sunY * 0.4);
  const glow = ctx.createRadialGradient(sx, sy, 2, sx, sy, 60);
  glow.addColorStop(0, stars ? 'rgba(220,230,255,0.9)' : 'rgba(255,247,220,0.95)');
  glow.addColorStop(1, 'rgba(255,247,220,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(sx, sy, 60, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = stars ? '#e8edff' : '#fffbe8';
  ctx.beginPath(); ctx.arc(sx, sy, stars ? 9 : 13, 0, Math.PI * 2); ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function updateEnvironment(preset) {
  if (!pmrem) return;
  const equi = equirectSky(preset.sky[0], preset.sky[1], preset.sky[1],
    lightenHex(preset.fog, -0.15), (preset.sunY - 30) / 90, preset.stars);
  if (envRT) envRT.dispose();
  envRT = pmrem.fromEquirectangular(equi);
  scene.environment = envRT.texture;
  equi.dispose();
}

// ============================================================
// World building
// ============================================================
const TERRAIN_STYLE = {
  desert:   { ground: '#d9b26a', sky: '#a7ccec', fog: '#e3cda4', fogFar: 750 },
  urban:    { ground: '#8f9294', sky: '#a9c6e4', fog: '#b9c3cb', fogFar: 650 },
  forest:   { ground: '#4e7a3a', sky: '#9ed0f5', fog: '#bcd4c4', fogFar: 700 },
  plains:   { ground: '#7da84e', sky: '#a5d3f7', fog: '#d6e3c5', fogFar: 800 },
  mountain: { ground: '#6f7d6a', sky: '#9cc4ef', fog: '#c3cdd6', fogFar: 700 },
  swamp:    { ground: '#52683f', sky: '#c2cfae', fog: '#c9d6b8', fogFar: 550 },
  coast:    { ground: '#cfc08a', sky: '#8fd0f7', fog: '#cfe4ee', fogFar: 800 },
};

// ============================================================
// Time of day
// ============================================================
const TIME_NAMES = ['Day', 'Dusk', 'Night'];

function skyTexture(top, mid, horizon, stars = false) {
  const c = makeCanvas(64, 256);
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, top);
  grad.addColorStop(0.55, mid);
  grad.addColorStop(1, horizon);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 256);
  if (stars) {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 90; i++) {
      const y = Math.random() * 150;
      ctx.globalAlpha = 0.4 + Math.random() * 0.6;
      ctx.fillRect(Math.random() * 64, y, 1, 1);
    }
    ctx.globalAlpha = 1;
  }
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

function timePreset(style) {
  return [
    { // day
      sky: [lightenHex(style.sky, 0.25), style.sky, style.fog], stars: false,
      fog: style.fog, fogFar: style.fogFar,
      sunColor: '#fff4de', sunInt: 2.4, hemiInt: 1.05, ambInt: 0.25,
      lights: 0.5, towers: 0, windows: 0, sunY: 90,
    },
    { // dusk
      sky: ['#2c3e6b', '#b95f3c', '#f2a65e'], stars: false,
      fog: '#c98d63', fogFar: style.fogFar * 0.85,
      sunColor: '#ffb066', sunInt: 1.1, hemiInt: 0.45, ambInt: 0.18,
      lights: 2.2, towers: 300, windows: 0.5, sunY: 35,
    },
    { // night
      sky: ['#05070f', '#0b1122', '#1a2340'], stars: true,
      fog: '#0d1220', fogFar: style.fogFar * 0.7,
      sunColor: '#8fa8d8', sunInt: 0.35, hemiInt: 0.14, ambInt: 0.08,
      lights: 3.2, towers: 600, windows: 0.85, sunY: 70,
    },
  ];
}

function lightenHex(hex, amt) {
  const col = new THREE.Color(hex);
  col.lerp(new THREE.Color(amt >= 0 ? '#ffffff' : '#000000'), Math.abs(amt));
  return '#' + col.getHexString();
}

function applyTime() {
  const style = TERRAIN_STYLE[sel.highway.terrain];
  const p = timePreset(style)[timeIdx];
  skyDome.material.map = skyTexture(...p.sky, p.stars);
  skyDome.material.needsUpdate = true;
  scene.fog.color.set(p.fog);
  scene.fog.far = p.fogFar;
  scene.fog.near = timeIdx === 2 ? 60 : 120;
  sun.color.set(p.sunColor);
  sun.intensity = p.sunInt;
  hemiLight.intensity = p.hemiInt;
  ambLight.intensity = p.ambInt;
  HEADLIGHT_MAT.emissiveIntensity = p.lights;
  TAILLIGHT_MAT.emissiveIntensity = p.lights * 0.7;
  for (const s of towerSpots) { s.intensity = p.towers; s.visible = p.towers > 0; }
  for (const m of buildingMats) m.emissiveIntensity = p.windows;
  sunHeight = p.sunY;
  updateEnvironment(p);
  const tt = $('time-tag');
  if (tt) tt.textContent = '🕐 ' + TIME_NAMES[timeIdx];
}
let sunHeight = 90;

function laneCenterX(side, lane) {
  // side 'A' = +x, traffic moves -z ; side 'B' = -x, traffic moves +z
  // lane 0 is the inside (median) lane
  const x = roadInfo.medianHalf + roadInfo.shoulderIn + LANE_W * (lane + 0.5);
  return side === 'A' ? x : -x;
}

function buildWorld() {
  const hw = sel.highway;
  const style = TERRAIN_STYLE[hw.terrain];
  const lanes = hw.lanes;

  buildingMats = [];
  towerSpots = [];
  scene.background = new THREE.Color(style.sky);
  scene.fog = new THREE.Fog(style.fog, 120, style.fogFar);

  // ---- sky dome (gradient + stars at night) ----
  skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(1200, 24, 14),
    new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false })
  );
  skyDome.renderOrder = -10;
  scene.add(skyDome);

  // ---- lighting ----
  hemiLight = new THREE.HemisphereLight(style.sky, style.ground, 1.05);
  ambLight = new THREE.AmbientLight('#ffffff', 0.25);
  scene.add(hemiLight, ambLight);
  sun = new THREE.DirectionalLight('#fff4de', 2.4);
  sun.position.set(60, 90, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -70; sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70; sun.shadow.camera.bottom = -70;
  sun.shadow.camera.far = 400;
  scene.add(sun, sun.target);

  // ---- geometry constants ----
  const medianW = hw.terrain === 'urban' ? 1.2 : 9;
  const shoulderIn = 1.5, shoulderOut = 3.0;
  const sideW = shoulderIn + lanes * LANE_W + shoulderOut;
  roadInfo = {
    medianHalf: medianW / 2, shoulderIn, shoulderOut, sideW,
    outerEdge: medianW / 2 + sideW, lanes, medianW,
  };

  // ---- ground ----
  const groundTex = noiseTexture(style.ground, 7);
  groundTex.repeat.set(90, 90);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(ROAD_LEN + 900, ROAD_LEN + 900),
    lamb('#ffffff', { map: groundTex })   // color lives in the texture
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.08;
  ground.receiveShadow = true;
  scene.add(ground);
  groundMeshes.push(ground);

  // ---- roadway (two carriageways) ----
  const asphaltTex = noiseTexture('#3d4045', 5);
  asphaltTex.repeat.set(3, ROAD_LEN / 24);
  asphaltTex.anisotropy = 8;
  const asphalt = lamb('#ffffff', { map: asphaltTex, roughness: 0.96 });
  for (const dir of [1, -1]) {
    const road = new THREE.Mesh(new THREE.BoxGeometry(sideW, 0.16, ROAD_LEN), asphalt);
    road.position.set(dir * (medianW / 2 + sideW / 2), -0.08, 0);
    road.receiveShadow = true;
    scene.add(road);
    groundMeshes.push(road);
  }

  // ---- median ----
  if (hw.terrain === 'urban') {
    const jb = new THREE.Group();
    const b1 = box(0.62, 0.25, ROAD_LEN, '#b9bbb6', 0, 0.125, 0);
    const b2 = box(0.4, 0.5, ROAD_LEN, '#b9bbb6', 0, 0.45, 0);
    const b3 = box(0.22, 0.35, ROAD_LEN, '#b9bbb6', 0, 0.85, 0);
    b1.receiveShadow = b2.receiveShadow = true;
    jb.add(b1, b2, b3);
    scene.add(jb);
  } else {
    const grass = new THREE.Mesh(new THREE.BoxGeometry(medianW, 0.1, ROAD_LEN), lamb(style.ground));
    grass.position.y = -0.06;
    grass.receiveShadow = true;
    scene.add(grass);
    groundMeshes.push(grass);
  }

  // ---- lane markings ----
  buildMarkings();
  buildRoadWear();

  // ---- guardrails / walls ----
  buildRoadside(hw, style);

  // ---- overhead gantries + roadside extras ----
  buildGantry(hw, -120, 'A');
  buildGantry(hw, 320, 'B');
  buildGantry(hw, -ROAD_LEN * 0.38, 'A');
  buildMileMarkers(hw);
  buildRoadsideSigns(hw);
  buildDelineators(hw);
  buildBillboards(hw);

  // ---- scenery ----
  buildScenery(hw, style);

  // ---- clouds: soft billboard puffs instead of floating boxes ----
  const cloudTex = (() => {
    const c = makeCanvas(128, 128);
    const ctx = c.getContext('2d');
    // a cluster of soft radial blobs makes one puffy texture
    for (const [bx, by, br] of [[64, 70, 46], [38, 78, 32], [92, 80, 34], [58, 52, 30], [80, 58, 26]]) {
      const gr = ctx.createRadialGradient(bx, by, 1, bx, by, br);
      gr.addColorStop(0, 'rgba(255,255,255,0.85)');
      gr.addColorStop(0.7, 'rgba(255,255,255,0.35)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  for (let i = 0; i < Math.round(14 * SCENERY_SCALE); i++) {
    const cl = new THREE.Group();
    const n = 2 + Math.floor(Math.random() * 4);
    for (let k = 0; k < n; k++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: cloudTex, transparent: true, opacity: 0.5 + Math.random() * 0.3,
        depthWrite: false, fog: false,
      }));
      const s = 26 + Math.random() * 34;
      sp.scale.set(s, s * (0.45 + Math.random() * 0.2), 1);
      sp.position.set(k * 14 - n * 7 + (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 10);
      cl.add(sp);
    }
    cl.position.set((Math.random() - 0.5) * (ROAD_LEN + 400), 100 + Math.random() * 70, (Math.random() - 0.5) * (ROAD_LEN + 400));
    scene.add(cl);
    clouds.push(cl);
  }

  // placed-item root + drivable vehicle root
  placedRoot = new THREE.Group();
  vehiclesRoot = new THREE.Group();
  scene.add(placedRoot, vehiclesRoot);

  timeIdx = 0;
  applyTime();
}

// tire wear tracks, raised lane reflectors and oil staining — what makes
// pavement read as *used* asphalt instead of fresh printer toner
function buildRoadWear() {
  const { lanes } = roadInfo;
  // darker polished wheel paths in every lane
  const wearMat = new THREE.MeshStandardMaterial({
    color: '#000000', transparent: true, opacity: 0.13, roughness: 0.55,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1,
  });
  const wearGeo = new THREE.PlaneGeometry(0.5, ROAD_LEN);
  for (const side of ['A', 'B']) {
    for (let l = 0; l < lanes; l++) {
      const cx = laneCenterX(side, l);
      for (const off of [-0.55, 0.55]) {
        const strip = new THREE.Mesh(wearGeo, wearMat);
        strip.rotation.x = -Math.PI / 2;
        strip.position.set(cx + off, 0.004, 0);
        scene.add(strip);
      }
    }
  }
  // raised pavement reflectors between the dashes (instanced)
  const per = Math.floor(ROAD_LEN / 24);
  const nBound = Math.max(0, lanes - 1) * 2;
  if (nBound > 0) {
    const dots = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.1, 0.02, 0.12),
      new THREE.MeshStandardMaterial({ color: '#e8e8e8', emissive: '#cfd8de', emissiveIntensity: 0.3, roughness: 0.3 }),
      nBound * per
    );
    const m4 = new THREE.Matrix4();
    let idx = 0;
    for (const dir of [1, -1]) {
      for (let l = 1; l < lanes; l++) {
        const x = dir * (roadInfo.medianHalf + roadInfo.shoulderIn + LANE_W * l);
        for (let k = 0; k < per; k++) {
          m4.setPosition(x, 0.012, -ROAD_LEN / 2 + k * 24 + 9);
          dots.setMatrixAt(idx++, m4);
        }
      }
    }
    dots.count = idx;
    scene.add(dots);
  }
  // oil drip stains down the middle of random lanes
  const stainMat = new THREE.MeshStandardMaterial({
    color: '#0a0a0c', transparent: true, opacity: 0.14, roughness: 0.4,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1,
  });
  for (let i = 0; i < 60 * SCENERY_SCALE; i++) {
    const side = Math.random() < 0.5 ? 'A' : 'B';
    const lane = Math.floor(Math.random() * lanes);
    const stain = new THREE.Mesh(new THREE.CircleGeometry(0.25 + Math.random() * 0.5, 10), stainMat);
    stain.rotation.x = -Math.PI / 2;
    stain.scale.y = 1.6 + Math.random() * 2;   // stretched along travel
    stain.position.set(laneCenterX(side, lane) + (Math.random() - 0.5) * 0.4, 0.005, (Math.random() - 0.5) * ROAD_LEN);
    scene.add(stain);
  }
}

function buildMarkings() {
  const { lanes, medianHalf, shoulderIn, sideW } = roadInfo;
  const white = new THREE.MeshBasicMaterial({ color: '#e8e8e8' });
  const yellowM = new THREE.MeshBasicMaterial({ color: '#f5c518' });

  // solid edge lines
  const edgeGeo = new THREE.BoxGeometry(0.13, 0.01, ROAD_LEN);
  for (const dir of [1, -1]) {
    const yellow = new THREE.Mesh(edgeGeo, yellowM);
    yellow.position.set(dir * (medianHalf + shoulderIn - 0.3), 0.006, 0);
    scene.add(yellow);
    const wl = new THREE.Mesh(edgeGeo, white);
    wl.position.set(dir * (medianHalf + sideW - roadInfo.shoulderOut + 0.15), 0.006, 0);
    scene.add(wl);
  }

  // dashed lane lines (instanced)
  const dashLen = 3, gap = 9, per = Math.floor(ROAD_LEN / (dashLen + gap));
  const nBound = Math.max(0, lanes - 1) * 2;
  if (nBound > 0) {
    const inst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.13, 0.01, dashLen), white, nBound * per);
    const m4 = new THREE.Matrix4();
    let idx = 0;
    for (const dir of [1, -1]) {
      for (let l = 1; l < lanes; l++) {
        const x = dir * (medianHalf + shoulderIn + LANE_W * l);
        for (let k = 0; k < per; k++) {
          m4.setPosition(x, 0.006, -ROAD_LEN / 2 + k * (dashLen + gap) + dashLen / 2);
          inst.setMatrixAt(idx++, m4);
        }
      }
    }
    scene.add(inst);
  }
}

function buildRoadside(hw, style) {
  const { outerEdge } = roadInfo;
  if (hw.terrain === 'urban') {
    // sound walls
    for (const dir of [1, -1]) {
      const wall = box(0.5, 4.5, ROAD_LEN, '#c9b8a0', dir * (outerEdge + 4), 2.25, 0);
      wall.receiveShadow = true;
      scene.add(wall);
      for (let z = -ROAD_LEN / 2; z < ROAD_LEN / 2; z += 24) {
        scene.add(box(0.7, 4.7, 0.7, '#b3a28b', dir * (outerEdge + 4), 2.35, z));
      }
    }
  } else {
    // guardrail: rail + instanced posts
    const railMat = lamb('#adb3ba');
    for (const dir of [1, -1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, ROAD_LEN), railMat);
      rail.position.set(dir * (outerEdge + 0.6), 0.6, 0);
      scene.add(rail);
      const n = Math.floor(ROAD_LEN / 4);
      const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.75, 0.14), lamb('#7d838c'), n);
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < n; i++) {
        m4.setPosition(dir * (outerEdge + 0.62), 0.37, -ROAD_LEN / 2 + i * 4 + 2);
        posts.setMatrixAt(i, m4);
      }
      scene.add(posts);
    }
  }
}

function buildGantry(hw, z, side = 'A') {
  const { outerEdge } = roadInfo;
  const g = new THREE.Group();
  const h = 7.5;
  g.add(cyl(0.28, 0.32, h, '#6f7680', outerEdge + 1.5, h / 2, 0));
  g.add(cyl(0.28, 0.32, h, '#6f7680', -(outerEdge + 1.5), h / 2, 0));
  const beam = box((outerEdge + 1.5) * 2, 0.7, 0.5, '#6f7680', 0, h, 0);
  g.add(beam);

  // big green guide sign
  const c = makeCanvas(512, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#00693f'; ctx.fillRect(0, 0, 512, 256);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 496, 240);
  ctx.save(); ctx.translate(40, 24); drawShield(ctx, hw.sign, hw.num, 90); ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.font = '800 44px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(side === 'A' ? 'NORTH' : 'SOUTH', 160, 84);
  ctx.font = '800 56px Arial';
  ctx.fillText(hw.city, 40, 175);
  ctx.font = '700 36px Arial';
  ctx.fillText('NEXT EXIT  1 MILE', 40, 226);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(440, 200); ctx.lineTo(440, 150); ctx.lineTo(420, 150);
  ctx.lineTo(455, 115); ctx.lineTo(490, 150); ctx.lineTo(470, 150); ctx.lineTo(470, 200);
  ctx.closePath(); ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  const dull = lamb('#4a5158');
  const face = new THREE.MeshStandardMaterial({ map: tex });
  // side A approaches from +z (reads the +z face); side B from -z
  const panelMats = side === 'A'
    ? [dull, dull, dull, dull, face, dull]
    : [dull, dull, dull, dull, dull, face];
  const panel = new THREE.Mesh(new THREE.BoxGeometry(7, 3.4, 0.15), panelMats);
  const px = roadInfo.medianHalf + roadInfo.sideW / 2;
  panel.position.set(side === 'A' ? px : -px, h - 0.5, side === 'A' ? 0.35 : -0.35);
  panel.castShadow = true;
  g.add(panel);
  g.position.z = z;
  scene.add(g);
}

// -------- billboards with fake ads along the whole highway --------
function billboardAds() {
  const dot = STATES[sel.state].dot;
  return [
    { bg: '#d62828', brand: 'BIG TEX BURGERS', tag: 'NEXT EXIT — OPEN 24 HRS', emoji: '🍔' },
    { bg: '#f77f00', brand: 'CONE ZONE ENERGY', tag: 'FUEL FOR THE CREW', emoji: '⚡', fg: '#222' },
    { bg: '#003049', brand: 'BLOCKY & SONS LAW', tag: 'INJURED? CALL 555-CONE', emoji: '⚖️' },
    { bg: '#2a9d8f', brand: 'MEGA-LOT RV PARK', tag: 'POOL • WIFI • $29 A NIGHT', emoji: '🚐' },
    { bg: '#6a040f', brand: "JOE'S WAFFLE BARN", tag: 'WORLD FAMOUS SINCE 1987', emoji: '🧇' },
    { bg: '#5f0f40', brand: 'BLOCKVILLE CASINO', tag: 'LOOSEST SLOTS ON THE INTERSTATE', emoji: '🎰' },
    { bg: '#1d3557', brand: 'SLEEPY PINES MOTEL', tag: 'FREE HBO • VACANCY', emoji: '🛏️' },
    { bg: '#386641', brand: 'GREEN ACRES PRODUCE', tag: 'FRESH CORN — 2 MI', emoji: '🌽' },
    { bg: '#ffb703', brand: "WORLD'S LARGEST CONE", tag: "YOU'LL FLIP YOUR LID — 3 MI", emoji: '🔶', fg: '#333' },
    { bg: '#e63946', brand: 'CRASHPROOF INSURANCE', tag: 'COVERED. EVEN IN A WORK ZONE.', emoji: '🛡️' },
    { bg: '#212529', brand: "DON'T TEXT & DRIVE", tag: 'A MESSAGE FROM ' + dot.toUpperCase(), emoji: '📵' },
    { bg: '#0077b6', brand: 'SPLASH KINGDOM', tag: 'EXIT 23 — KIDS SWIM FREE', emoji: '🌊' },
  ];
}

function adTexture(ad) {
  const c = makeCanvas(512, 192);
  const ctx = c.getContext('2d');
  ctx.fillStyle = ad.bg; ctx.fillRect(0, 0, 512, 192);
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, 492, 172);
  ctx.font = '80px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(ad.emoji, 78, 96);
  const fg = ad.fg || '#ffffff';
  ctx.fillStyle = fg;
  ctx.textAlign = 'left';
  let fs = 44;
  ctx.font = `900 ${fs}px Arial`;
  while (ctx.measureText(ad.brand).width > 340 && fs > 22) { fs -= 2; ctx.font = `900 ${fs}px Arial`; }
  ctx.fillText(ad.brand, 148, 82);
  ctx.font = '600 22px Arial';
  ctx.globalAlpha = 0.92;
  ctx.fillText(ad.tag, 150, 132);
  ctx.globalAlpha = 1;
  return new THREE.CanvasTexture(c);
}

function buildBillboards() {
  const ads = billboardAds();
  const { outerEdge } = roadInfo;
  let i = 0;
  for (let z = -ROAD_LEN / 2 + 60; z < ROAD_LEN / 2 - 40; z += 150 + Math.random() * 60) {
    const side = i % 2 === 0 ? 1 : -1;    // alternate sides of the highway
    const ad = ads[i % ads.length];
    const g = new THREE.Group();
    g.add(cyl(0.28, 0.34, 6.5, '#7a7f88', 0, 3.25, 0, 10));
    const face = new THREE.MeshStandardMaterial({ map: adTexture(ad) });
    const back = lamb('#5c6168');
    const p = new THREE.Mesh(
      new THREE.BoxGeometry(9, 3.4, 0.25),
      [back, back, back, back, face, back]
    );
    p.position.y = 7.2;
    g.add(p);
    // catwalk + lights for flavor
    g.add(box(9.2, 0.12, 0.5, '#4a4f57', 0, 5.35, 0.3));
    for (const lx of [-3, 0, 3]) g.add(box(0.18, 0.18, 0.4, '#33373d', lx, 9.05, 0.25));
    g.position.set(side * (outerEdge + 10 + Math.random() * 14), 0, z);
    // panel faces +z by default; traffic on its side approaches from +z (side A)
    // or -z (side B) — angle it toward its own carriageway's drivers
    g.rotation.y = side > 0 ? -0.25 : Math.PI - 0.25;
    scene.add(g);
    i++;
  }
}

function buildMileMarkers(hw) {
  const { outerEdge } = roadInfo;
  let mile = 100 + Math.floor(Math.random() * 80);
  // small green mile markers, placed on the ROADSIDE beyond the guardrail
  // (never on the shoulder / breakdown lane), every 0.2 mi, both carriageways
  const off = outerEdge + (hw.terrain === 'urban' ? 1.1 : 2.2);
  for (let z = -ROAD_LEN / 2 + 40; z < ROAD_LEN / 2; z += 90) {
    const label = (mile + z / 1600).toFixed(1);
    mile = 100 + Math.floor(Math.random() * 80); // keep whole-mile numbers varied
    const c = makeCanvas(48, 120);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#00693f'; ctx.fillRect(0, 0, 48, 120);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.strokeRect(2.5, 2.5, 43, 115);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = '700 13px Arial';
    ctx.fillText('MILE', 24, 30);
    ctx.font = '800 30px Arial';
    ctx.fillText(String(100 + ((z + ROAD_LEN / 2) / 90 | 0)), 24, 74);
    const tex = new THREE.CanvasTexture(c);
    const back = lamb('#3a4048');
    const face = new THREE.MeshStandardMaterial({ map: tex });
    for (const dir of [1, -1]) {
      const g = new THREE.Group();
      g.add(box(0.05, 1.3, 0.05, '#8a8f98', 0, 0.65, 0));
      // side A (dir +1) faces +z traffic; side B faces -z
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.72, 0.03),
        dir > 0 ? [back, back, back, back, face, back] : [back, back, back, back, back, face]);
      p.position.y = 1.35;
      g.add(p);
      g.position.set(dir * off, 0, z + (dir < 0 ? 45 : 0));
      scene.add(g);
    }
  }
}

// reflective delineator posts along the shoulder edge (instanced for perf)
function buildDelineators(hw) {
  const { medianHalf, shoulderIn, sideW, outerEdge } = roadInfo;
  const shoulderEdge = medianHalf + sideW - roadInfo.shoulderOut + 0.4;
  const n = Math.floor(ROAD_LEN / 24) * 4;
  const postGeo = new THREE.CylinderGeometry(0.04, 0.05, 1.05, 6);
  const posts = new THREE.InstancedMesh(postGeo, lamb('#e8e8e8'), n);
  const refl = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.09, 0.14, 0.02),
    new THREE.MeshStandardMaterial({ color: '#ffb400', emissive: '#ffb400', emissiveIntensity: 0.35 }),
    n
  );
  const m4 = new THREE.Matrix4();
  let i = 0;
  for (const dir of [1, -1]) {
    for (const xEdge of [shoulderEdge, outerEdge - 0.3]) {
      for (let z = -ROAD_LEN / 2 + 12; z < ROAD_LEN / 2 && i < n; z += 24) {
        const x = dir * xEdge;
        m4.setPosition(x, 0.52, z);
        posts.setMatrixAt(i, m4);
        m4.setPosition(x, 0.9, z + 0.05);
        refl.setMatrixAt(i, m4);
        i++;
      }
    }
  }
  posts.count = i; refl.count = i;
  posts.instanceMatrix.needsUpdate = true; refl.instanceMatrix.needsUpdate = true;
  scene.add(posts, refl);
}

// realistic roadside signage: speed limit, exit gore, distance guide signs
function buildRoadsideSigns(hw) {
  const s = STATES[sel.state];
  const { outerEdge } = roadInfo;
  const off = outerEdge + (hw.terrain === 'urban' ? 0.9 : 2.0);

  const postSign = (canvasDraw, w, h, z, side, postH = 2.4) => {
    const c = makeCanvas(128, Math.round(128 * h / w));
    canvasDraw(c.getContext('2d'), c.width, c.height);
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    const back = lamb('#5b626b');
    const face = new THREE.MeshStandardMaterial({ map: tex });
    const g = new THREE.Group();
    g.add(box(0.07, postH, 0.07, '#8a8f98', -w * 0.28, postH / 2, 0));
    g.add(box(0.07, postH, 0.07, '#8a8f98', w * 0.28, postH / 2, 0));
    const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.05),
      side > 0 ? [back, back, back, back, face, back] : [back, back, back, back, back, face]);
    p.position.y = postH + h / 2 - 0.1;
    g.add(p);
    g.position.set(side * off, 0, z);
    scene.add(g);
  };

  const speedDraw = (ctx, w, h) => {
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 4; ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.fillStyle = '#111'; ctx.textAlign = 'center';
    ctx.font = '800 20px Arial'; ctx.fillText('SPEED', w / 2, h * 0.24);
    ctx.fillText('LIMIT', w / 2, h * 0.44);
    ctx.font = '900 56px Arial'; ctx.fillText(String(hw.speed), w / 2, h * 0.82);
  };
  const exitDraw = (ctx, w, h) => {
    ctx.fillStyle = '#00693f'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.strokeRect(5, 5, w - 10, h - 10);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.font = '800 22px Arial'; ctx.fillText('EXIT', w / 2, h * 0.34);
    ctx.font = '900 40px Arial'; ctx.fillText(String(20 + Math.floor(Math.random() * 200)), w / 2, h * 0.78);
  };
  const distDraw = (ctx, w, h) => {
    ctx.fillStyle = '#00693f'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(4, 4, w - 8, h - 8);
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
    ctx.font = '800 18px Arial';
    ctx.fillText(s.abbr === hw.city ? hw.city : hw.city, 14, h * 0.32);
    ctx.textAlign = 'right'; ctx.fillText(String(8 + Math.floor(Math.random() * 40)), w - 14, h * 0.32);
    ctx.textAlign = 'left'; ctx.fillText(sel.state.slice(0, 10), 14, h * 0.68);
    ctx.textAlign = 'right'; ctx.fillText(String(40 + Math.floor(Math.random() * 120)), w - 14, h * 0.68);
  };

  // scatter signs down both sides of the highway
  for (let z = -ROAD_LEN / 2 + 120; z < ROAD_LEN / 2 - 60; z += 260) {
    postSign(speedDraw, 0.9, 1.2, z, 1);
    postSign(speedDraw, 0.9, 1.2, z + 130, -1);
  }
  for (let z = -ROAD_LEN / 2 + 220; z < ROAD_LEN / 2 - 60; z += 320) {
    postSign(exitDraw, 1.0, 1.0, z, 1, 3.0);
    postSign(distDraw, 1.8, 1.0, z - 160, -1, 3.2);
  }
}

// ---------------- scenery per terrain ----------------
function rndRoadside(minDist, maxDist) {
  const side = Math.random() < 0.5 ? 1 : -1;
  return {
    x: side * (roadInfo.outerEdge + minDist + Math.random() * (maxDist - minDist)),
    z: (Math.random() - 0.5) * (ROAD_LEN + 200),
  };
}

// natural color jitter so no two trees are the same green
function jitterColor(hex, amt = 0.1) {
  const col = new THREE.Color(hex);
  const hsl = {};
  col.getHSL(hsl);
  col.setHSL(
    hsl.h + (Math.random() - 0.5) * amt * 0.35,
    THREE.MathUtils.clamp(hsl.s + (Math.random() - 0.5) * amt, 0, 1),
    THREE.MathUtils.clamp(hsl.l + (Math.random() - 0.5) * amt, 0.05, 0.9)
  );
  return '#' + col.getHexString();
}

function makePine(scale = 1) {
  const g = new THREE.Group();
  g.add(cyl(0.2 * scale, 0.28 * scale, 1.6 * scale, jitterColor('#6b4a2a', 0.12), 0, 0.8 * scale, 0, 7));
  const green = jitterColor('#2c5e2e', 0.16);
  const green2 = jitterColor(green, 0.08);
  // three overlapping tiers with slight offsets read as branch layers
  g.add(cyl(0.01, 1.8 * scale, 2.2 * scale, green, 0.05 * scale, 2.2 * scale, 0, 8));
  g.add(cyl(0.01, 1.4 * scale, 2.0 * scale, green2, -0.04 * scale, 3.4 * scale, 0.05 * scale, 8));
  g.add(cyl(0.01, 1.0 * scale, 1.7 * scale, green, 0, 4.5 * scale, 0, 8));
  g.rotation.z = (Math.random() - 0.5) * 0.06;   // subtle natural lean
  return g;
}

function makeBlobTree(scale = 1) {
  const g = new THREE.Group();
  const trunkC = jitterColor('#6b4a2a', 0.12);
  g.add(cyl(0.16 * scale, 0.22 * scale, 1.4 * scale, trunkC, 0, 0.7 * scale, 0, 7));
  // branch stub
  const branch = cyl(0.07 * scale, 0.1 * scale, 0.8 * scale, trunkC, 0.35 * scale, 1.5 * scale, 0, 5);
  branch.rotation.z = -0.7;
  g.add(branch);
  // clumped multi-blob canopy with per-blob color shift
  const baseGreen = jitterColor('#3f7d32', 0.18);
  const blobs = [
    [0, 2.5, 0, 1.35], [0.75, 2.15, 0.3, 0.95], [-0.7, 2.2, -0.25, 0.9],
    [0.2, 3.1, -0.4, 0.85], [-0.3, 2.0, 0.65, 0.8],
  ];
  for (const [bx, by, bz, br] of blobs) {
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(br * scale, 0), lamb(jitterColor(baseGreen, 0.1)));
    blob.position.set(bx * scale, by * scale, bz * scale);
    blob.scale.y = 0.85;
    blob.rotation.set(Math.random(), Math.random(), Math.random());
    blob.castShadow = true;
    g.add(blob);
  }
  return g;
}

function makeCactus(scale = 1) {
  const g = new THREE.Group();
  const green = '#3f8f4a';
  g.add(cyl(0.22 * scale, 0.26 * scale, 2.4 * scale, green, 0, 1.2 * scale, 0, 8));
  const a1 = cyl(0.13 * scale, 0.15 * scale, 1.0 * scale, green, 0.55 * scale, 1.7 * scale, 0, 8);
  const a1b = cyl(0.13 * scale, 0.14 * scale, 0.5 * scale, green, 0.55 * scale, 1.25 * scale, 0, 8);
  a1b.rotation.z = Math.PI / 2;
  const a2 = cyl(0.12 * scale, 0.14 * scale, 0.8 * scale, green, -0.5 * scale, 1.45 * scale, 0, 8);
  const a2b = cyl(0.12 * scale, 0.13 * scale, 0.45 * scale, green, -0.48 * scale, 1.05 * scale, 0, 8);
  a2b.rotation.z = Math.PI / 2;
  g.add(a1, a1b, a2, a2b);
  return g;
}

function makePalm(scale = 1) {
  const g = new THREE.Group();
  g.add(cyl(0.14 * scale, 0.22 * scale, 4 * scale, '#8a6a45', 0, 2 * scale, 0, 7));
  for (let i = 0; i < 6; i++) {
    const leaf = box(0.35 * scale, 0.06, 2.4 * scale, '#3f8f4a', 0, 0, 0);
    leaf.position.set(Math.sin(i) * 0.2, 4.1 * scale, Math.cos(i) * 0.2);
    leaf.rotation.y = (i / 6) * Math.PI * 2;
    leaf.rotation.x = 0.5;
    g.add(leaf);
  }
  return g;
}

// ---- realistic building facades, drawn per-building on canvas ----
// styles: glass curtain-wall tower / concrete with punched windows / brick
function facadeTexture(style, wMeters, hMeters) {
  const cols = Math.max(3, Math.round(wMeters / 2.6));
  const floors = Math.max(3, Math.round(hMeters / 3.2));
  const cw = 24, fh = 26;
  const c = makeCanvas(cols * cw, floors * fh);
  const ctx = c.getContext('2d');
  const palettes = {
    glass:    { wall: '#5a6b7d', win: '#7fa8c8', winLit: '#ffe9a3', mullion: '#3a4450' },
    concrete: { wall: '#b0aca2', win: '#3a4450', winLit: '#ffd97a', mullion: '#8f8b82' },
    brick:    { wall: '#8a5a44', win: '#2e3844', winLit: '#ffcf70', mullion: '#6e4636' },
  };
  const P = palettes[style];
  ctx.fillStyle = P.wall; ctx.fillRect(0, 0, c.width, c.height);
  // subtle wall grime streaks
  ctx.fillStyle = 'rgba(0,0,0,.06)';
  for (let i = 0; i < cols; i++) ctx.fillRect(i * cw + (i % 3), 0, 1.5, c.height);
  // emissive layer drawn separately: only lit windows on black
  const ec = makeCanvas(c.width, c.height);
  const ectx = ec.getContext('2d');
  ectx.fillStyle = '#000'; ectx.fillRect(0, 0, c.width, c.height);

  for (let f = 0; f < floors; f++) {
    const y = c.height - (f + 1) * fh;   // draw from ground floor up
    if (f === 0) {
      // street-level: storefront glass + entrance
      ctx.fillStyle = '#2a323c'; ctx.fillRect(0, y + 4, c.width, fh - 4);
      ctx.fillStyle = '#9fc3dd';
      for (let i = 0; i < cols; i++) ctx.fillRect(i * cw + 3, y + 7, cw - 6, fh - 12);
      ctx.fillStyle = '#1a1e24';
      ctx.fillRect(((cols / 2) | 0) * cw + 4, y + 7, cw - 8, fh - 7);   // doorway
      continue;
    }
    // floor spandrel band
    ctx.fillStyle = P.mullion; ctx.fillRect(0, y, c.width, 3);
    for (let i = 0; i < cols; i++) {
      const lit = Math.random() < 0.4;
      const inset = style === 'glass' ? 2 : 5;
      const wx = i * cw + inset, wy = y + (style === 'glass' ? 4 : 7);
      const ww = cw - inset * 2, wh = fh - (style === 'glass' ? 7 : 13);
      ctx.fillStyle = P.win;
      ctx.fillRect(wx, wy, ww, wh);
      // sky reflection gradient on glass
      const gr = ctx.createLinearGradient(0, wy, 0, wy + wh);
      gr.addColorStop(0, 'rgba(255,255,255,.28)');
      gr.addColorStop(0.5, 'rgba(255,255,255,.04)');
      gr.addColorStop(1, 'rgba(0,0,0,.12)');
      ctx.fillStyle = gr; ctx.fillRect(wx, wy, ww, wh);
      if (style === 'glass') { ctx.fillStyle = P.mullion; ctx.fillRect(wx + ww / 2 - 1, wy, 1.5, wh); }
      if (lit) {
        ctx.fillStyle = 'rgba(255,233,163,.75)'; ctx.fillRect(wx, wy, ww, wh);
        ectx.fillStyle = P.winLit; ectx.fillRect(wx, wy, ww, wh);
      }
    }
  }
  // parapet
  ctx.fillStyle = lightenHex(P.wall, -0.25); ctx.fillRect(0, 0, c.width, 5);
  const map = new THREE.CanvasTexture(c);
  const emissiveMap = new THREE.CanvasTexture(ec);
  map.anisotropy = 4;
  return { map, emissiveMap };
}

function facadeMat(style, w, h) {
  const { map, emissiveMap } = facadeTexture(style, w, h);
  const mat = new THREE.MeshStandardMaterial({
    map, emissiveMap, emissive: '#ffe9a3', emissiveIntensity: 0,
    roughness: style === 'glass' ? 0.35 : 0.85,
    metalness: style === 'glass' ? 0.4 : 0.05,
    envMapIntensity: style === 'glass' ? 1.1 : 0.5,
  });
  buildingMats.push(mat);
  return mat;
}

function roofTop(w, d, h, tall) {
  const g = new THREE.Group();
  // parapet lip
  const lip = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.7, d + 0.5), lamb('#6e6a62'));
  lip.position.y = h + 0.2;
  g.add(lip);
  // AC units / vents
  for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
    const ac = box(1.6 + Math.random() * 1.5, 1.0, 1.4 + Math.random(), '#9aa0a6',
      (Math.random() - 0.5) * (w - 5), h + 1.0, (Math.random() - 0.5) * (d - 5));
    g.add(ac);
  }
  if (tall && Math.random() < 0.5) {
    // rooftop water tank
    const tank = cyl(1.6, 1.6, 2.6, '#7a5c40', (Math.random() - 0.5) * (w - 7), h + 2.2, (Math.random() - 0.5) * (d - 7), 10);
    g.add(tank);
    g.add(cyl(1.8, 0.4, 0.9, '#5e4630', tank.position.x, h + 3.9, tank.position.z, 10));
  }
  if (tall) {
    // antenna mast with an aircraft-warning beacon (blinks at night)
    const mast = cyl(0.08, 0.12, 6, '#8a8f98', 0, h + 3.4, 0, 6);
    g.add(mast);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6),
      new THREE.MeshStandardMaterial({ color: '#7a1414', emissive: '#ff2020', emissiveIntensity: 0 }));
    beacon.position.set(0, h + 6.4, 0);
    blinkers.push({ mat: beacon.material, phase: Math.random() * 6, speed: 0.8 });
    g.add(beacon);
  }
  return g;
}

function makeBuilding() {
  const g = new THREE.Group();
  const style = ['glass', 'concrete', 'brick'][Math.floor(Math.random() * 3)];
  const tall = Math.random() < 0.4;
  const h = tall ? 35 + Math.random() * 55 : 12 + Math.random() * 26;
  const w = 12 + Math.random() * 16;
  const d = 12 + Math.random() * 16;
  const side = facadeMat(style, w, h);
  const roof = lamb('#55575c');
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, roof, roof, side, side]);
  b.position.y = h / 2;
  g.add(b);
  g.add(roofTop(w, d, h, tall));
  // 35% get a stepped-back upper tier — real skyline variety
  if (Math.random() < 0.35) {
    const h2 = h * (0.35 + Math.random() * 0.3);
    const w2 = w * 0.62, d2 = d * 0.62;
    const side2 = facadeMat(style, w2, h2);
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(w2, h2, d2), [side2, side2, roof, roof, side2, side2]);
    b2.position.y = h + h2 / 2;
    g.add(b2);
    g.add(roofTop(w2, d2, h + h2, tall));
  }
  return g;
}

function buildScenery(hw, style) {
  const T = hw.terrain;
  const add = (obj, x, z, ry = Math.random() * Math.PI * 2) => {
    obj.position.set(x, 0, z);
    obj.rotation.y = ry;
    scene.add(obj);
  };

  if (T === 'forest' || T === 'mountain') {
    for (let i = 0; i < Math.round(90 * SCENERY_SCALE); i++) {
      const { x, z } = rndRoadside(4, 180);
      add(makePine(0.8 + Math.random() * 1.6), x, z);
    }
  }
  if (T === 'mountain') {
    for (let i = 0; i < Math.round(10 * SCENERY_SCALE); i++) {
      const d = 350 + Math.random() * 380;
      const side = Math.random() < 0.5 ? 1 : -1;
      const peakH = 120 + Math.random() * 160;
      const peak = new THREE.Mesh(new THREE.ConeGeometry(peakH * 0.9, peakH, 6), lamb('#7d8892'));
      peak.position.set(side * d, peakH / 2 - 6, (Math.random() - 0.5) * (ROAD_LEN + 700));
      const snow = new THREE.Mesh(new THREE.ConeGeometry(peakH * 0.28, peakH * 0.32, 6), lamb('#f2f5f8'));
      snow.position.set(peak.position.x, peakH - peakH * 0.16 - 6, peak.position.z);
      scene.add(peak, snow);
    }
  }
  if (T === 'desert') {
    for (let i = 0; i < Math.round(40 * SCENERY_SCALE); i++) {
      const { x, z } = rndRoadside(5, 160);
      add(makeCactus(0.7 + Math.random() * 1.2), x, z);
    }
    for (let i = 0; i < Math.round(26 * SCENERY_SCALE); i++) {
      const { x, z } = rndRoadside(8, 200);
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6 + Math.random() * 1.6, 0), lamb('#b08a5e'));
      rock.position.y = 0.4;
      add(rock, x, z);
    }
    for (let i = 0; i < Math.round(7 * SCENERY_SCALE); i++) {
      const d = 300 + Math.random() * 350;
      const side = Math.random() < 0.5 ? 1 : -1;
      const mh = 30 + Math.random() * 45;
      const mesa = new THREE.Mesh(new THREE.CylinderGeometry(30 + Math.random() * 35, 42 + Math.random() * 35, mh, 9), lamb('#c27b4a'));
      mesa.position.set(side * d, mh / 2 - 4, (Math.random() - 0.5) * (ROAD_LEN + 600));
      scene.add(mesa);
    }
  }
  if (T === 'plains') {
    for (let i = 0; i < Math.round(20 * SCENERY_SCALE); i++) {
      const { x, z } = rndRoadside(10, 220);
      const bale = cyl(0.8, 0.8, 1.2, '#d9b866', 0, 0.8, 0, 10);
      bale.rotation.z = Math.PI / 2;
      const w = new THREE.Group(); w.add(bale);
      add(w, x, z);
    }
    for (let i = 0; i < Math.round(6 * SCENERY_SCALE); i++) {
      const { x, z } = rndRoadside(60, 300);
      const barn = new THREE.Group();
      barn.add(box(8, 5, 12, '#a83232', 0, 2.5, 0));
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 12, 3), lamb('#7d2626'));
      roof.rotation.z = Math.PI / 2;
      roof.rotation.y = Math.PI / 2;
      roof.position.y = 6.2;
      roof.scale.y = 0.7;
      barn.add(roof);
      add(barn, x, z);
    }
    for (let i = 0; i < Math.round(8 * SCENERY_SCALE); i++) {
      const { x, z } = rndRoadside(120, 420);
      const t = new THREE.Group();
      t.add(cyl(0.5, 1.2, 40, '#e8eaec', 0, 20, 0, 8));
      for (let b = 0; b < 3; b++) {
        const blade = box(0.7, 14, 0.15, '#f2f4f6', 0, 7, 0);
        const pivot = new THREE.Group();
        pivot.add(blade);
        pivot.position.set(0, 40, 1);
        pivot.rotation.z = (b / 3) * Math.PI * 2;
        t.add(pivot);
      }
      add(t, x, z, 0);
    }
    for (let i = 0; i < Math.round(30 * SCENERY_SCALE); i++) {
      const { x, z } = rndRoadside(6, 150);
      add(makeBlobTree(0.5 + Math.random() * 0.8), x, z);
    }
  }
  if (T === 'urban') {
    for (let i = 0; i < Math.round(46 * SCENERY_SCALE); i++) {
      const side = Math.random() < 0.5 ? 1 : -1;
      const b = makeBuilding();
      b.position.x = side * (roadInfo.outerEdge + 22 + Math.random() * 160);
      b.position.z = (Math.random() - 0.5) * (ROAD_LEN + 300);
      scene.add(b);
    }
    // overpass bridge
    const op = new THREE.Group();
    const span = roadInfo.outerEdge * 2 + 30;
    op.add(box(span, 1.4, 9, '#9aa0a6', 0, 6.6, 0));
    op.add(box(span, 0.9, 0.4, '#7d838c', 0, 7.7, 4.4));
    op.add(box(span, 0.9, 0.4, '#7d838c', 0, 7.7, -4.4));
    for (const dx of [-(roadInfo.outerEdge + 8), roadInfo.outerEdge + 8]) {
      op.add(cyl(1.2, 1.4, 6, '#8d9399', dx, 3, 0, 10));
    }
    op.position.z = -ROAD_LEN * 0.2;
    scene.add(op);
    const op2 = op.clone();
    op2.position.z = ROAD_LEN * 0.31;
    scene.add(op2);
  }
  if (T === 'swamp') {
    for (let i = 0; i < Math.round(40 * SCENERY_SCALE); i++) {
      const { x, z } = rndRoadside(6, 160);
      const t = new THREE.Group();
      t.add(cyl(0.3, 0.7, 3.5, '#5e4a33', 0, 1.75, 0, 7));
      const moss = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6, 0), lamb('#4a6b35'));
      moss.position.y = 4.2; moss.scale.y = 0.7;
      t.add(moss);
      add(t, x, z);
    }
    for (let i = 0; i < Math.round(14 * SCENERY_SCALE); i++) {
      const { x, z } = rndRoadside(4, 140);
      const w = new THREE.Mesh(new THREE.CylinderGeometry(6 + Math.random() * 12, 6, 0.05, 12), lamb('#3f5d52'));
      w.position.set(x, -0.02, z);
      scene.add(w);
    }
  }
  if (T === 'coast') {
    // ocean on one side
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(900, ROAD_LEN + 900), lamb('#2e7fa8'));
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(-(roadInfo.outerEdge + 480), -0.04, 0);
    scene.add(ocean);
    for (let i = 0; i < Math.round(30 * SCENERY_SCALE); i++) {
      const side = Math.random() < 0.65 ? 1 : -1;
      const x = side * (roadInfo.outerEdge + 5 + Math.random() * 120);
      add(makePalm(0.7 + Math.random() * 0.9), x, (Math.random() - 0.5) * (ROAD_LEN + 200));
    }
  }

}

// ============================================================
// Character
// ============================================================
function spawnPlayer() {
  player = new THREE.Group();
  const vest = sel.vest;
  const { front, back } = vestTextures(vest);
  const skin = '#f0c040';

  // legs (pivot at hip)
  const mkLimb = (w, h, d, color, hipY, x, isArm = false, texMats = null) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, hipY, 0);
    const mesh = texMats
      ? new THREE.Mesh(new THREE.BoxGeometry(w, h, d), texMats)
      : box(w, h, d, color);
    mesh.position.y = -h / 2;
    mesh.castShadow = true;
    pivot.add(mesh);
    player.add(pivot);
    return pivot;
  };

  const lLeg = mkLimb(0.34, 0.8, 0.34, '#3b4a6b', 0.8, -0.19);
  const rLeg = mkLimb(0.34, 0.8, 0.34, '#3b4a6b', 0.8, 0.19);
  // boots
  for (const p of [lLeg, rLeg]) {
    const boot = box(0.36, 0.18, 0.4, '#5e4423', 0, -0.73, 0.03);
    p.add(boot);
  }
  // arms: bare skin, or sleeved (jacket) in the vest color with a reflective cuff
  const armColor = vest.sleeves || skin;
  const lArm = mkLimb(0.28, 0.78, 0.28, armColor, 1.6, -0.54);
  const rArm = mkLimb(0.28, 0.78, 0.28, armColor, 1.6, 0.54);
  if (vest.sleeves) {
    for (const a of [lArm, rArm]) {
      // reflective cuff band + skin hand at the wrist
      a.add(box(0.3, 0.08, 0.3, vest.stripe, 0, -0.5, 0));
      a.add(box(0.26, 0.14, 0.26, skin, 0, -0.72, 0));
    }
  }

  // torso with vest textures: [+x,-x,+y,-y,+z(front),-z(back)]
  const torsoMats = [
    lamb(vest.base), lamb(vest.base), lamb(vest.trim), lamb(vest.base),
    new THREE.MeshStandardMaterial({ map: front }),
    new THREE.MeshStandardMaterial({ map: back }),
  ];
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.85, 0.42), torsoMats);
  torso.position.y = 1.22;
  torso.castShadow = true;
  player.add(torso);

  // head with face on +z
  const faceTex = faceTexture();
  const headMats = [
    lamb(skin), lamb(skin), lamb(skin), lamb(skin),
    new THREE.MeshStandardMaterial({ map: faceTex }),
    lamb(skin),
  ];
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), headMats);
  head.position.y = 1.95;
  head.castShadow = true;
  player.add(head);

  // hard hat (vest-specific color) with a ratchet band and brim
  const hatColor = vest.hat || (vest.id === 'green' ? '#ffd23f' : '#ff6a00');
  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
    lamb(hatColor, { roughness: 0.5 }));
  hat.position.y = 2.24; hat.castShadow = true;
  const brim = cyl(0.42, 0.42, 0.04, hatColor, 0, 2.23, 0.08, 16);
  brim.scale.z = 1.15;
  const band = cyl(0.325, 0.325, 0.05, '#2a2c30', 0, 2.28, 0, 14);
  // little ridge on top of the hard hat
  const ridge = box(0.06, 0.14, 0.5, hatColor, 0, 2.4, 0);
  player.add(hat, brim, band, ridge);

  limbs = { lArm, rArm, lLeg, rLeg };

  // spawn on the right shoulder of side A, facing its direction of travel (-z)
  player.position.set(roadInfo.outerEdge - 1.4, 0, 0);
  player.rotation.y = Math.PI;
  yaw = Math.PI;
  scene.add(player);
}

// ============================================================
// Traffic
// ============================================================
// ---------------- detailed blocky vehicles ----------------
const glassMat = () => new THREE.MeshStandardMaterial({
  color: '#7fb9dd', roughness: 0.18, metalness: 0.35,
});
// shared materials so the time-of-day system can flip every light at once
const HEADLIGHT_MAT = new THREE.MeshStandardMaterial({
  color: '#fffbe8', emissive: '#fff6c9', emissiveIntensity: 0.5,
});
const TAILLIGHT_MAT = new THREE.MeshStandardMaterial({
  color: '#8f1414', emissive: '#ff2020', emissiveIntensity: 0.5,
});
const headlightMat = () => HEADLIGHT_MAT;
const taillightMat = () => TAILLIGHT_MAT;
const DOT_YELLOW = '#f2cb1d';   // Liberty-style safety yellow fleet paint

// A wheel with a real rim: tyre (with tread), alloy face + 5 spokes, lug nuts.
// Structure: steerPivot(rot.y) → spinner(rot.x) → wheel meshes, so the tyre
// can roll (spinner) and the front axle can steer (steerPivot) independently.
let _treadTex = null;
function treadTexture() {
  if (_treadTex) return _treadTex;
  const c = makeCanvas(32, 32);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#141517'; ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = '#050506';
  for (let i = 0; i < 32; i += 6) ctx.fillRect(i, 0, 3, 32);
  _treadTex = new THREE.CanvasTexture(c);
  _treadTex.wrapS = _treadTex.wrapT = THREE.RepeatWrapping;
  _treadTex.repeat.set(8, 1);
  return _treadTex;
}

function makeWheel(r = 0.36, w = 0.26, rim = '#c4c9d0') {
  const steerPivot = new THREE.Group();
  const spinner = new THREE.Group();
  spinner.rotation.z = Math.PI / 2;   // lay the cylinder axis along X
  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, w, 22),
    new THREE.MeshStandardMaterial({ color: '#191a1c', roughness: 0.9, metalness: 0.0, map: treadTexture() })
  );
  tire.castShadow = true;
  // black sidewall discs, slightly inset so the rim sits proud
  const sw = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.98, r * 0.98, w * 0.96, 22), lamb('#101113', { roughness: 0.92 }));
  const rimMat = metalMat(rim, { roughness: 0.28 });
  const face = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.68, r * 0.68, w + 0.02, 20), rimMat);
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.5, r * 0.62, 0.05, 18), lamb('#26282c'));
  dish.position.y = w / 2 - 0.02;
  const dish2 = dish.clone(); dish2.position.y = -(w / 2 - 0.02); dish2.rotation.x = Math.PI;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.14, r * 0.14, w + 0.04, 10), rimMat);
  spinner.add(tire, sw, face, dish, dish2, hub);
  for (const side of [1, -1]) {
    for (let i = 0; i < 5; i++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(r * 0.12, 0.04, r * 0.44), rimMat);
      spoke.geometry.translate(0, 0, r * 0.26);
      spoke.position.y = side * (w / 2 - 0.02);
      spoke.rotation.y = (i / 5) * Math.PI * 2;
      spinner.add(spoke);
    }
  }
  steerPivot.add(spinner);
  steerPivot.userData.spinner = spinner;
  return steerPivot;
}

function addWheels(g, r, positions, w = 0.26) {
  if (!g.userData.wheels) g.userData.wheels = [];
  const zs = positions.map((p) => p[1]);
  const maxZ = Math.max(...zs);
  for (const [x, z] of positions) {
    const wheel = makeWheel(r, w);
    wheel.position.set(x, r, z);
    g.add(wheel);
    g.userData.wheels.push({ pivot: wheel, spinner: wheel.userData.spinner, radius: r, steer: z >= maxZ - 0.01 });
  }
}

// front/rear detail shared by all cars: rounded bumpers, grille, lights, plate
function addCarFace(g, { w, frontZ, backZ, lightY = 0.62, bumperY = 0.34 }) {
  g.add(rbox(w, 0.24, 0.16, lamb('#26282c'), 0.07, 0, bumperY, frontZ));
  g.add(rbox(w, 0.24, 0.16, lamb('#26282c'), 0.07, 0, bumperY, backZ - 0.01));
  // grille
  g.add(rbox(w * 0.55, 0.2, 0.05, metalMat('#3a3d42', { roughness: 0.4 }), 0.03, 0, bumperY + 0.26, frontZ + 0.02));
  for (const sx of [-w / 2 + 0.32, w / 2 - 0.32]) {
    const hl = new THREE.Mesh(roundedBoxGeometry(0.36, 0.16, 0.08, 0.05), headlightMat());
    hl.position.set(sx, lightY, frontZ + 0.02);
    const tl = new THREE.Mesh(roundedBoxGeometry(0.36, 0.16, 0.08, 0.05), taillightMat());
    tl.position.set(sx, lightY, backZ - 0.02);
    g.add(hl, tl);
  }
  const plate = box(0.44, 0.17, 0.03, '#e8e8e8', 0, bumperY + 0.15, backZ - 0.09);
  g.add(plate);
}

function addMirrors(g, x, y, z) {
  for (const sx of [-x, x]) {
    const arm = box(0.14, 0.05, 0.06, '#26282c', sx, y, z);
    const glass = rbox(0.06, 0.16, 0.22, carGlass(), 0.03, sx + Math.sign(sx) * 0.08, y + 0.02, z);
    g.add(arm, glass);
  }
}

const CAR_COLORS = ['#b8392e', '#2f6db3', '#e8eaec', '#20242c', '#8a9099', '#d8b62f',
  '#2e7d4f', '#6b3fa0', '#c9591b', '#a5adb8', '#13355e', '#701c1c'];

// ---- real car silhouettes: extrude a 2D side profile across the car width ----
// pts: [z, y] polyline (+z = front). Entries of 4 numbers are quadratic curves
// [cpZ, cpY, z, y] so hoods, windshields and rooflines can actually curve.
function profileBody(pts, width, mat, bevel = 0.06) {
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    if (p.length === 4) shape.quadraticCurveTo(p[0], p[1], p[2], p[3]);
    else shape.lineTo(p[0], p[1]);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: width - bevel * 2,
    bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: 3, curveSegments: 8,
  });
  geo.rotateY(-Math.PI / 2);   // profile plane -> (z, y), extrusion -> width on x
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  geo.translate(-(bb.min.x + bb.max.x) / 2, 0, 0);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

// dark fender arches so the wheels sit *inside* the body instead of under it
function addWheelArches(g, r, positions, bodyHalfW) {
  const archMat = lamb('#17181a', { roughness: 0.95 });
  for (const [x, z] of positions) {
    const arch = new THREE.Mesh(new THREE.TorusGeometry(r + 0.1, 0.055, 6, 14, Math.PI), archMat);
    arch.rotation.y = Math.PI / 2;
    arch.position.set(Math.sign(x) * (bodyHalfW - 0.01), r, z);
    g.add(arch);
    // shadowed inner well
    const well = new THREE.Mesh(new THREE.CircleGeometry(r + 0.08, 14, 0, Math.PI), lamb('#0a0b0c'));
    well.rotation.y = Math.sign(x) > 0 ? -Math.PI / 2 : Math.PI / 2;
    well.position.set(Math.sign(x) * (bodyHalfW - 0.03), r, z);
    g.add(well);
  }
}

// door handles + exhaust tip — the tiny stuff that sells realism up close
function addCarExtras(g, { halfW, handleY, handleZs, exhaustZ }) {
  const chrome = metalMat('#c8ced6');
  for (const sx of [-1, 1]) {
    for (const hz of handleZs) {
      const h = new THREE.Mesh(roundedBoxGeometry(0.03, 0.045, 0.22, 0.015), chrome);
      h.position.set(sx * (halfW + 0.005), handleY, hz);
      g.add(h);
    }
  }
  if (exhaustZ !== undefined) {
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.18, 10), metalMat('#5a5f66'));
    tip.rotation.x = Math.PI / 2;
    tip.position.set(-0.55, 0.24, exhaustZ);
    g.add(tip);
  }
}

function makeSedan() {
  const col = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
  const paint = carPaint(col);
  const g = new THREE.Group();
  // lower body: real sedan silhouette — nose, curved hood, beltline, decklid
  const body = profileBody([
    [2.28, 0.36], [2.32, 0.55, 2.26, 0.72],       // nose
    [1.6, 0.86, 1.05, 0.9],                        // curved hood
    [-1.6, 0.92],                                  // beltline
    [-2.2, 0.9, -2.28, 0.78],                      // decklid
    [-2.3, 0.4], [-2.0, 0.3], [2.0, 0.3],          // rockers
  ], 1.82, paint);
  g.add(body);
  // greenhouse: raked windshield, curved roof, fastback C-pillar — in glass
  const glass = profileBody([
    [1.02, 0.9], [0.5, 1.32, -0.1, 1.36],          // windshield + roof crown
    [-0.95, 1.33],                                 // roofline
    [-1.55, 0.92],                                 // C-pillar
  ], 1.6, carGlass(), 0.04);
  g.add(glass);
  // painted roof panel + B-pillar
  g.add(rbox(1.56, 0.07, 1.15, paint, 0.03, 0, 1.36, -0.45));
  g.add(box(1.62, 0.42, 0.06, '#101215', 0, 1.1, -0.28));
  const positions = [[-0.86, 1.42], [0.86, 1.42], [-0.86, -1.42], [0.86, -1.42]];
  addWheelArches(g, 0.36, positions, 0.91);
  addCarFace(g, { w: 1.82, frontZ: 2.26, backZ: -2.26, lightY: 0.68 });
  addMirrors(g, 0.96, 1.06, 0.82);
  addCarExtras(g, { halfW: 0.91, handleY: 0.98, handleZs: [0.45, -0.55], exhaustZ: -2.28 });
  addWheels(g, 0.36, positions);
  return { mesh: g, len: 4.6 };
}

function makeSUV() {
  const col = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
  const paint = carPaint(col);
  const g = new THREE.Group();
  const body = profileBody([
    [2.38, 0.4], [2.42, 0.65, 2.34, 0.88],         // nose
    [1.7, 1.02, 1.2, 1.05],                        // hood
    [-2.25, 1.08],                                 // tall beltline
    [-2.38, 0.95], [-2.38, 0.44], [-2.05, 0.32], [2.05, 0.32],
  ], 1.92, paint);
  g.add(body);
  // upright greenhouse running almost to the tailgate
  const glass = profileBody([
    [1.15, 1.05], [0.75, 1.6, 0.2, 1.64],
    [-1.95, 1.6],
    [-2.2, 1.06],
  ], 1.7, carGlass(), 0.04);
  g.add(glass);
  g.add(rbox(1.66, 0.07, 2.2, paint, 0.03, 0, 1.64, -0.75));      // roof panel
  g.add(box(1.72, 0.5, 0.06, '#101215', 0, 1.3, -0.3));           // B-pillar
  g.add(rbox(1.96, 0.2, 4.7, lamb('#1c1f26'), 0.08, 0, 0.3, 0));  // cladding
  for (const rx of [-0.62, 0.62]) g.add(rbox(0.09, 0.08, 2.4, metalMat('#2a2d33'), 0.03, rx, 1.72, -0.7));
  const positions = [[-0.9, 1.52], [0.9, 1.52], [-0.9, -1.52], [0.9, -1.52]];
  addWheelArches(g, 0.42, positions, 0.96);
  addCarFace(g, { w: 1.92, frontZ: 2.4, backZ: -2.4, lightY: 0.78, bumperY: 0.42 });
  addMirrors(g, 1.02, 1.24, 0.95);
  addCarExtras(g, { halfW: 0.96, handleY: 1.1, handleZs: [0.55, -0.5], exhaustZ: -2.4 });
  addWheels(g, 0.42, positions);
  return { mesh: g, len: 4.8 };
}

function makePickup(col = null, dot = false) {
  col = col || CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
  const paint = carPaint(col);
  const g = new THREE.Group();
  // tall truck body with a long flat hood and open bed cutout behind the cab
  const body = profileBody([
    [2.68, 0.42], [2.72, 0.72, 2.62, 0.95],        // upright nose
    [1.65, 1.06],                                  // hood
    [-2.6, 1.06],                                  // continues as bed rail height
    [-2.68, 0.95], [-2.68, 0.46], [-2.3, 0.34], [2.3, 0.34],
  ], 1.96, paint);
  g.add(body);
  // cab greenhouse over the front half only
  const glass = profileBody([
    [1.55, 1.05], [1.15, 1.66, 0.7, 1.7],
    [-0.15, 1.68],
    [-0.42, 1.06],
  ], 1.74, carGlass(), 0.04);
  g.add(glass);
  g.add(rbox(1.7, 0.07, 1.1, paint, 0.03, 0, 1.7, 0.35));         // cab roof
  // open bed: recess between the rails
  g.add(box(1.6, 0.06, 2.0, '#3a3d42', 0, 1.02, -1.55));          // bed floor
  g.add(box(1.6, 0.5, 0.08, '#26282c', 0, 0.85, -0.52));          // bed front wall
  g.add(rbox(1.9, 0.16, 0.14, paint, 0.05, 0, 1.0, -2.6));        // tailgate cap
  const positions = [[-0.92, 1.7], [0.92, 1.7], [-0.92, -1.7], [0.92, -1.7]];
  addWheelArches(g, 0.44, positions, 0.98);
  addCarFace(g, { w: 1.96, frontZ: 2.7, backZ: -2.7, lightY: 0.82, bumperY: 0.44 });
  addMirrors(g, 1.04, 1.32, 1.3);
  addCarExtras(g, { halfW: 0.98, handleY: 1.12, handleZs: [0.9], exhaustZ: -2.7 });
  addWheels(g, 0.44, positions);
  if (dot) {
    // amber beacon bar + door decals + rear chevrons
    const bar = box(1.0, 0.1, 0.3, '#2a2c30', 0, 1.78, 0.35);
    g.add(bar);
    for (const bx of [-0.32, 0, 0.32]) {
      const lamp = cyl(0.08, 0.08, 0.1, '#ffb400', bx, 1.88, 0.35, 8);
      addBlinker(lamp, bx * 4, 4);
      g.add(lamp);
    }
    const chev = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.34, 0.04),
      new THREE.MeshStandardMaterial({ map: stripeTexture(true) })
    );
    chev.position.set(0, 0.72, -2.72);
    g.add(chev);
    g.add(dotDoorDecal(-0.995, 0.76, 0.9), dotDoorDecal(0.995, 0.76, 0.9));
  }
  return { mesh: g, len: 5.4 };
}

// Liberty-style door emblem: blue triangle road logo + agency text,
// painted straight onto the panel color
function dotDoorDecal(x, y, z, paint = '#ff8c1a') {
  const stateName = sel.state || 'STATE';
  const c = makeCanvas(160, 80);
  const ctx = c.getContext('2d');
  // transparent background so the emblem floats on whatever livery the body wears
  // (a soft white halo keeps text legible on dark liveries)
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  roundRect(ctx, 2, 6, 156, 68, 10); ctx.fill();
  // triangle emblem with road swoosh
  ctx.fillStyle = '#1d5fbf';
  ctx.beginPath();
  ctx.moveTo(30, 12); ctx.lineTo(52, 62); ctx.lineTo(8, 62);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(18, 62);
  ctx.quadraticCurveTo(34, 44, 30, 24);
  ctx.stroke();
  ctx.strokeStyle = '#7fd0f0'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(26, 62);
  ctx.quadraticCurveTo(42, 46, 36, 30);
  ctx.stroke();
  // agency text
  ctx.fillStyle = '#111';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  let fs = 13;
  ctx.font = `800 ${fs}px Arial`;
  while (ctx.measureText(stateName.toUpperCase()).width > 96 && fs > 8) { fs--; ctx.font = `800 ${fs}px Arial`; }
  ctx.fillText(stateName.toUpperCase(), 58, 24);
  ctx.font = '800 11px Arial';
  ctx.fillText('DEPARTMENT OF', 58, 41);
  ctx.fillText('TRANSPORTATION', 58, 56);
  const decal = new THREE.Mesh(
    new THREE.PlaneGeometry(0.84, 0.42),
    new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c), transparent: true })
  );
  decal.position.set(x, y, z);
  decal.rotation.y = x < 0 ? -Math.PI / 2 : Math.PI / 2;   // face outward from the door
  return decal;
}

// blue reflective dash striping on fleet yellow (photo-style)
function dashStripeTex() {
  const c = makeCanvas(256, 24);
  const ctx = c.getContext('2d');
  ctx.fillStyle = DOT_YELLOW;
  ctx.fillRect(0, 0, 256, 24);
  ctx.fillStyle = '#1d5fbf';
  for (let x = 4; x < 256; x += 26) ctx.fillRect(x, 6, 16, 12);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

function textDecal(text, w, h, { bg = DOT_YELLOW, fg = '#1d5fbf', size = 26 } = {}) {
  const c = makeCanvas(256, Math.round(256 * (h / w)));
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  let fs = size;
  ctx.font = `900 ${fs}px Arial`;
  while (ctx.measureText(text).width > c.width - 20 && fs > 8) { fs--; ctx.font = `900 ${fs}px Arial`; }
  ctx.fillText(text, c.width / 2, c.height / 2);
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, h, w),
    new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c) })
  );
  return m;
}

// service-body compartment doors (photo-style utility bed sides)
function compartmentTex() {
  const c = makeCanvas(256, 96);
  const ctx = c.getContext('2d');
  ctx.fillStyle = DOT_YELLOW; ctx.fillRect(0, 0, 256, 96);
  ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.lineWidth = 3;
  const doors = [[8, 8, 70, 80], [86, 8, 84, 38], [86, 52, 84, 36], [178, 8, 70, 80]];
  for (const [x, y, w, h] of doors) {
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = 'rgba(0,0,0,.85)';
    ctx.fillRect(x + w / 2 - 8, y + h - 10, 16, 4);   // latch
    ctx.fillStyle = DOT_YELLOW;
  }
  return new THREE.CanvasTexture(c);
}

// red/white DOT conspicuity striping for truck rears
function conspicuityTex() {
  const c = makeCanvas(128, 16);
  const ctx = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? '#ffffff' : '#d21f1f';
    ctx.fillRect(i * 16, 0, 16, 16);
  }
  return new THREE.CanvasTexture(c);
}

function fleetLightBar(x, y, z) {
  const g = new THREE.Group();
  g.add(box(1.0, 0.09, 0.28, '#e8eaec', 0, 0.05, 0));
  for (const bx of [-0.3, 0.3]) {
    const lamp = box(0.22, 0.1, 0.2, '#ffb400', bx, 0.13, 0);
    addBlinker(lamp, bx * 6, 4);
    g.add(lamp);
  }
  g.position.set(x, y, z);
  return g;
}

function addDashStripes(g, halfW, y, z, len) {
  const mat = new THREE.MeshStandardMaterial({ map: dashStripeTex() });
  for (const sx of [-halfW, halfW]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.14, len), mat);
    band.position.set(sx, y, z);
    g.add(band);
  }
}

// ---- DOT Crew Pickup (crew cab, photo 1) ----
function makeFleetPickup() {
  const paint = carPaint(DOT_YELLOW);
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.62, 5.5), paint);
  body.position.y = 0.78;
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.2, 1.3), paint);
  hood.position.set(0, 1.14, 2.0);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.74, 2.5), paint);
  cab.position.set(0, 1.44, 0.35);
  const windows = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.4, 2.3), glassMat());
  windows.position.set(0, 1.52, 0.35);
  const bPillar = new THREE.Mesh(new THREE.BoxGeometry(1.93, 0.42, 0.1), paint);
  bPillar.position.set(0, 1.52, 0.35);   // splits glass into crew-cab windows
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.52, 0.08), glassMat());
  windshield.position.set(0, 1.42, 1.68);
  windshield.rotation.x = -0.35;
  g.add(body, hood, cab, windows, bPillar, windshield);
  // bed
  g.add(box(1.88, 0.4, 0.1, DOT_YELLOW, 0, 1.28, -0.95));
  g.add(box(1.88, 0.4, 0.1, DOT_YELLOW, 0, 1.28, -2.7));
  g.add(box(0.1, 0.4, 1.85, DOT_YELLOW, -0.9, 1.28, -1.82));
  g.add(box(0.1, 0.4, 1.85, DOT_YELLOW, 0.9, 1.28, -1.82));
  addDashStripes(g, 0.985, 1.02, 0.2, 4.9);
  g.add(dotDoorDecal(-0.99, 1.42, 0.85, DOT_YELLOW), dotDoorDecal(0.99, 1.42, 0.85, DOT_YELLOW));
  const dialL = textDecal('DIAL 511', 1.1, 0.24); dialL.position.set(-0.955, 1.32, -1.85);
  const dialR = textDecal('DIAL 511', 1.1, 0.24); dialR.position.set(0.955, 1.32, -1.85);
  g.add(dialL, dialR);
  g.add(fleetLightBar(0, 1.86, 0.35));
  addCarFace(g, { w: 1.95, frontZ: 2.75, backZ: -2.75, lightY: 0.82, bumperY: 0.44 });
  addMirrors(g, 1.04, 1.34, 1.35);
  addWheels(g, 0.44, [[-0.92, 1.85], [0.92, 1.85], [-0.92, -1.8], [0.92, -1.8]]);
  return { mesh: g, len: 5.5 };
}

// ---- Utility Service Truck (service body + ladder rack, photos 2-3) ----
function makeUtilityTruck() {
  const paint = carPaint(DOT_YELLOW);
  const g = new THREE.Group();
  g.add(box(2.05, 0.4, 6.2, '#26282c', 0, 0.62, 0.1));
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.85, 1.5), paint);
  hood.position.set(0, 1.25, 2.55); hood.castShadow = true;
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.15, 1.5), paint);
  cab.position.set(0, 1.55, 1.3); cab.castShadow = true;
  const windows = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.48, 1.3), glassMat());
  windows.position.set(0, 1.86, 1.3);
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 0.08), glassMat());
  windshield.position.set(0, 1.78, 2.1);
  windshield.rotation.x = -0.3;
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 0.08), metalMat('#c8ced6'));
  grille.position.set(0, 1.15, 3.32);
  g.add(hood, cab, windows, windshield, grille);
  // black grille guard
  g.add(box(1.9, 0.12, 0.08, '#1c1e22', 0, 1.55, 3.5));
  g.add(box(1.9, 0.12, 0.08, '#1c1e22', 0, 1.1, 3.5));
  for (const gx of [-0.75, -0.25, 0.25, 0.75]) g.add(box(0.08, 0.85, 0.08, '#1c1e22', gx, 1.3, 3.5));
  g.add(box(2.1, 0.35, 0.25, '#26282c', 0, 0.55, 3.45));
  // service body with compartment doors
  const compTex = new THREE.MeshStandardMaterial({ map: compartmentTex() });
  const plainY = carPaint(DOT_YELLOW);
  const bodyBox = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 1.25, 3.6),
    [compTex, compTex, plainY, plainY, plainY, plainY]
  );
  bodyBox.position.set(0, 1.35, -1.6);
  bodyBox.castShadow = true;
  g.add(bodyBox);
  const consp = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.16, 0.03),
    new THREE.MeshStandardMaterial({ map: conspicuityTex() })
  );
  consp.position.set(0, 0.8, -3.42);
  g.add(consp);
  // overhead ladder rack + ladder
  const rackM = shiny('#dfe3e8');
  for (const rx of [-1.05, 1.05]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 4.6), rackM);
    rail.position.set(rx, 2.35, -1.2);
    g.add(rail);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), rackM);
    post.position.set(rx, 2.1, -3.2);
    g.add(post);
  }
  const rackBar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.08), rackM);
  rackBar.position.set(0, 2.35, -3.2);
  g.add(rackBar);
  // white ladder up top, hanging over the cab like the photo
  for (const lx of [-0.35, 0.35]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 4.4), shiny('#f2f3f5'));
    rail.position.set(lx, 2.46, -0.4);
    g.add(rail);
  }
  for (let i = 0; i < 9; i++) {
    const rung = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.05, 0.08), shiny('#f2f3f5'));
    rung.position.set(0, 2.46, -2.4 + i * 0.48);
    g.add(rung);
  }
  g.add(dotDoorDecal(-1.03, 1.5, 1.35, DOT_YELLOW), dotDoorDecal(1.03, 1.5, 1.35, DOT_YELLOW));
  const beacon = cyl(0.09, 0.11, 0.14, '#ffb400', 0, 2.2, 1.3);
  addBlinker(beacon, 1, 4.5);
  g.add(beacon);
  for (const sx of [-0.68, 0.68]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.06), headlightMat());
    hl.position.set(sx, 1.1, 3.34);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.06), taillightMat());
    tl.position.set(sx, 1.0, -3.43);
    g.add(hl, tl);
  }
  addWheels(g, 0.46, [[-0.95, 2.3], [0.95, 2.3], [-0.95, -1.9], [0.95, -1.9]]);
  return { mesh: g, len: 6.8 };
}

// ---- Stake Bed Truck (long-hood cab, photo 4) ----
function makeStakeTruck() {
  const paint = carPaint(DOT_YELLOW);
  const g = new THREE.Group();
  g.add(box(2.1, 0.45, 7.6, '#26282c', 0, 0.66, -0.2));
  // long hood with chrome grille
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.95, 2.3), paint);
  hood.position.set(0, 1.35, 2.9); hood.castShadow = true;
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 0.08), metalMat('#d5dae0'));
  grille.position.set(0, 1.25, 4.08);
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.4, 0.2), metalMat('#c8ced6'));
  bumper.position.set(0, 0.6, 4.1);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.15, 1.55, 1.7), paint);
  cab.position.set(0, 1.75, 1.0); cab.castShadow = true;
  const windows = new THREE.Mesh(new THREE.BoxGeometry(2.19, 0.62, 1.5), glassMat());
  windows.position.set(0, 2.15, 1.0);
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.62, 0.08), glassMat());
  windshield.position.set(0, 2.05, 1.9);
  windshield.rotation.x = -0.25;
  g.add(hood, grille, bumper, cab, windows, windshield);
  for (const sx of [-0.7, 0.7]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.06), headlightMat());
    hl.position.set(sx, 1.15, 4.1);
    g.add(hl);
  }
  // stake bed
  const bedFloor = box(2.4, 0.22, 4.6, '#8a9099', 0, 1.15, -2.2);
  g.add(bedFloor);
  const slatM = shiny(DOT_YELLOW);
  for (const sx of [-1.15, 1.15]) {
    for (let i = 0; i < 6; i++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.15, 0.1), slatM);
      post.position.set(sx, 1.85, -4.3 + i * 0.85);
      g.add(post);
    }
    for (const ry of [1.5, 1.95, 2.35]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 4.5), slatM);
      rail.position.set(sx, ry, -2.2);
      g.add(rail);
    }
  }
  for (const rz of [-4.45, 0.05]) {
    for (const ry of [1.5, 1.95, 2.35]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(2.34, 0.14, 0.06), slatM);
      rail.position.set(0, ry, rz);
      g.add(rail);
    }
  }
  const consp = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 0.16, 0.03),
    new THREE.MeshStandardMaterial({ map: conspicuityTex() })
  );
  consp.position.set(0, 1.0, -4.52);
  g.add(consp);
  for (const sx of [-0.75, 0.75]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.06), taillightMat());
    tl.position.set(sx, 0.85, -4.53);
    g.add(tl);
  }
  g.add(dotDoorDecal(-1.09, 1.7, 1.05, DOT_YELLOW), dotDoorDecal(1.09, 1.7, 1.05, DOT_YELLOW));
  g.add(fleetLightBar(0, 2.6, 1.0));
  addMirrors(g, 1.15, 2.0, 1.9);
  addWheels(g, 0.5, [[-0.98, 2.9], [0.98, 2.9], [-0.98, -1.6], [0.98, -1.6], [-0.98, -2.7], [0.98, -2.7]]);
  return { mesh: g, len: 8.6 };
}

// ---- Custom Sign Truck (flatbed with a programmable board) ----
let signTruckText = 'SLOW DOWN\nWORK ZONE';

function signBoardTexture(text) {
  const c = makeCanvas(512, 288);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0c0d10'; ctx.fillRect(0, 0, 512, 288);
  ctx.strokeStyle = '#3a3d42'; ctx.lineWidth = 8;
  ctx.strokeRect(6, 6, 500, 276);
  const lines = text.toUpperCase().split(/\n|\//).map((l) => l.trim()).filter(Boolean).slice(0, 3);
  ctx.fillStyle = '#ffb400';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lh = 288 / (lines.length + 1);
  lines.forEach((ln, i) => {
    let fs = 64;
    ctx.font = `900 ${fs}px monospace`;
    while (ctx.measureText(ln).width > 470 && fs > 18) { fs -= 2; ctx.font = `900 ${fs}px monospace`; }
    ctx.fillText(ln, 256, lh * (i + 1));
  });
  return new THREE.CanvasTexture(c);
}

function makeSignTruck(text) {
  const paint = carPaint(DOT_YELLOW);
  const g = new THREE.Group();
  g.add(box(2.05, 0.4, 6.0, '#26282c', 0, 0.62, 0.2));
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.25, 1.7), paint);
  cab.position.set(0, 1.5, 2.2); cab.castShadow = true;
  const windows = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.5, 1.5), glassMat());
  windows.position.set(0, 1.86, 2.2);
  g.add(cab, windows);
  const bed = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.2, 3.6), paint);
  bed.position.set(0, 1.05, -1.1); bed.castShadow = true;
  g.add(bed);
  // big message board on posts
  g.add(box(0.14, 2.2, 0.14, '#33373d', -1.0, 2.2, -1.4));
  g.add(box(0.14, 2.2, 0.14, '#33373d', 1.0, 2.2, -1.4));
  const boardTex = new THREE.MeshBasicMaterial({ map: signBoardTexture(text) });
  const dark = lamb('#141518');
  const board = new THREE.Mesh(
    new THREE.BoxGeometry(3.1, 1.9, 0.14),
    [dark, dark, dark, dark, dark, boardTex]   // reads from behind (-z), toward following traffic
  );
  board.position.set(0, 4.2, -1.4);
  board.castShadow = true;
  g.add(board);
  for (const [bx, by] of [[-1.4, 3.4], [1.4, 3.4], [-1.4, 5.0], [1.4, 5.0]]) {
    const lamp = cyl(0.08, 0.08, 0.08, '#ffb400', bx, by, -1.42);
    lamp.rotation.x = Math.PI / 2;
    addBlinker(lamp, (bx + by) * 2, 3);
    g.add(lamp);
  }
  g.add(dotDoorDecal(-1.03, 1.45, 2.25, DOT_YELLOW), dotDoorDecal(1.03, 1.45, 2.25, DOT_YELLOW));
  addCarFace(g, { w: 2.05, frontZ: 3.05, backZ: -2.9, lightY: 0.75, bumperY: 0.42 });
  addWheels(g, 0.46, [[-0.95, 2.2], [0.95, 2.2], [-0.95, -1.7], [0.95, -1.7]]);
  return { mesh: g, len: 6.4 };
}

function makeSemi() {
  const cabCol = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
  const paint = shiny(cabCol);
  const g = new THREE.Group();
  // tractor
  const chassis = box(1.9, 0.4, 5.4, '#26282c', 0, 0.62, 3.6);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.0, 2.0), paint);
  hood.position.set(0, 1.3, 5.2);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.9, 1.8), paint);
  cab.position.set(0, 1.9, 3.4);
  const windows = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.6, 1.6), glassMat());
  windows.position.set(0, 2.35, 3.4);
  const deflector = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.7, 1.0), paint);
  deflector.position.set(0, 3.1, 3.2);
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 0.08), metalMat('#c8ced6'));
  grille.position.set(0, 1.2, 6.22);
  g.add(chassis, hood, cab, windows, deflector, grille);
  for (const sx of [-1.2, 1.2]) {
    const stack = cyl(0.09, 0.09, 1.6, '#aab2bc', sx, 2.6, 2.6, 8);
    g.add(stack);
  }
  for (const sx of [-0.65, 0.65]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.06), headlightMat());
    hl.position.set(sx, 0.95, 6.26);
    g.add(hl);
  }
  // trailer
  const trailer = box(2.4, 2.6, 9.6, '#e6e8ea', 0, 2.05, -2.6);
  g.add(trailer);
  g.add(box(2.4, 0.08, 9.6, '#b9bec6', 0, 3.38, -2.6));
  for (const sx of [-0.7, 0.7]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.06), taillightMat());
    tl.position.set(sx, 0.9, -7.42);
    g.add(tl);
  }
  g.add(box(2.2, 0.5, 0.06, '#8a9099', 0, 0.5, -7.4)); // rear bumper bar
  addWheels(g, 0.5, [
    [-0.95, 5.2], [0.95, 5.2],
    [-0.95, 2.2], [0.95, 2.2], [-0.95, 1.2], [0.95, 1.2],
    [-0.95, -5.6], [0.95, -5.6], [-0.95, -6.6], [0.95, -6.6],
  ]);
  return { mesh: g, len: 14.5 };
}

function makeBoxTruck() {
  const paint = shiny('#f2f3f5');
  const g = new THREE.Group();
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.3, 1.8), paint);
  cab.position.set(0, 1.15, 2.6);
  const windows = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.5, 1.6), glassMat());
  windows.position.set(0, 1.5, 2.6);
  g.add(cab, windows);
  // cargo box with logo
  const c = makeCanvas(256, 128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f7f7f7'; ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = '#e63946';
  ctx.font = '900 34px Arial'; ctx.textAlign = 'center';
  ctx.fillText('BLOCKY', 128, 56);
  ctx.fillStyle = '#1d3557';
  ctx.font = '800 26px Arial';
  ctx.fillText('MOVERS ★', 128, 94);
  const sideTex = new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c) });
  const plain = lamb('#f0f0f0');
  const cargo = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, 4.6), [sideTex, sideTex, plain, plain, plain, plain]);
  cargo.position.set(0, 1.75, -0.9);
  g.add(cargo);
  addCarFace(g, { w: 2.0, frontZ: 3.5, backZ: -3.2, lightY: 0.7, bumperY: 0.42 });
  addWheels(g, 0.42, [[-0.95, 2.6], [0.95, 2.6], [-0.95, -1.6], [0.95, -1.6]]);
  return { mesh: g, len: 7 };
}

function makeCar() {
  const r = Math.random();
  let v;
  if (r < 0.40) v = makeSedan();
  else if (r < 0.62) v = makeSUV();
  else if (r < 0.78) v = makePickup();
  else if (r < 0.86) v = makeBoxTruck();
  else if (r < 0.94) v = makeSemi();
  else v = makePickup('#ff8c1a', true);   // DOT crew truck in traffic
  v.mesh.traverse((o) => { o.castShadow = false; }); // perf: traffic doesn't cast
  return v;
}

function spawnTraffic() {
  const hw = sel.highway;
  // keep total vehicle count reasonable on the long highway
  const perLane = Math.min(12, Math.max(3, Math.round(ROAD_LEN / (hw.lanes * 55))));
  for (const side of ['A', 'B']) {
    for (let lane = 0; lane < hw.lanes; lane++) {
      for (let i = 0; i < perLane; i++) {
        const { mesh, len } = makeCar();
        const z = -ROAD_LEN / 2 + Math.random() * ROAD_LEN;
        const baseSpeed = hw.speed * MPH * (0.85 + Math.random() * 0.25);
        const car = {
          mesh, len, side, lane,
          dir: side === 'A' ? -1 : 1,   // right-hand traffic (see top of file)
          z, x: laneCenterX(side, lane),
          speed: baseSpeed, baseSpeed,
        };
        mesh.rotation.y = side === 'A' ? Math.PI : 0;
        mesh.position.set(car.x, 0, z);
        scene.add(mesh);
        cars.push(car);
      }
    }
  }
  computeLaneBlockers();
}

function computeLaneBlockers() {
  const { lanes } = roadInfo;
  laneBlockers = { A: [], B: [] };
  for (const side of ['A', 'B']) {
    for (let l = 0; l < lanes; l++) laneBlockers[side].push([]);
  }
  for (const p of placed) {
    if (!p.def.blocks) continue;
    const x = p.group.position.x;
    const side = x > 0 ? 'A' : 'B';
    const inner = roadInfo.medianHalf + roadInfo.shoulderIn;
    const off = Math.abs(x) - inner;
    if (off < -0.4 || off > roadInfo.lanes * LANE_W + 0.4) continue; // shoulder/median: no lane blocked
    const lane = Math.min(roadInfo.lanes - 1, Math.max(0, Math.floor(off / LANE_W)));
    laneBlockers[side][lane].push(p.group.position.z);
  }
  for (const side of ['A', 'B']) for (const arr of laneBlockers[side]) arr.sort((a, b) => a - b);
}

function nextBlockerDist(side, lane, z, dir) {
  const arr = laneBlockers[side][lane];
  let best = Infinity;
  for (const bz of arr) {
    const d = (bz - z) * dir;
    if (d > -2 && d < best) best = d;
  }
  return best;
}

function laneIsClearAhead(side, lane, z, dir, dist) {
  return nextBlockerDist(side, lane, z, dir) > dist;
}

function updateTraffic(dt) {
  const { lanes } = roadInfo;
  for (const car of cars) {
    const { side, dir } = car;
    let target = car.baseSpeed;

    const bd = nextBlockerDist(side, car.lane, car.z, dir);
    if (bd < 130) {
      // try to change lanes
      let merged = false;
      for (const cand of [car.lane - 1, car.lane + 1]) {
        if (cand < 0 || cand >= lanes) continue;
        if (!laneIsClearAhead(side, cand, car.z, dir, 150)) continue;
        // avoid cars nearby in candidate lane
        let ok = true;
        for (const o of cars) {
          if (o === car || o.side !== side || o.lane !== cand) continue;
          if (Math.abs(o.z - car.z) < 14) { ok = false; break; }
        }
        if (ok) { car.lane = cand; merged = true; break; }
      }
      if (!merged) {
        // slow down / stop before the blockage
        if (bd < 12) target = 0;
        else target = Math.min(target, car.baseSpeed * ((bd - 12) / 110));
      } else {
        target = Math.min(target, car.baseSpeed * 0.6); // merge slowdown
      }
    }

    // follow the car ahead in the same lane
    for (const o of cars) {
      if (o === car || o.side !== side || o.lane !== car.lane) continue;
      const gap = (o.z - car.z) * dir;
      if (gap > 0 && gap < 18) {
        target = Math.min(target, gap < 7 ? 0 : o.speed * 0.95);
      }
    }

    car.speed += (target - car.speed) * Math.min(1, dt * 2.2);
    car.z += car.speed * dir * dt;
    if (car.z > ROAD_LEN / 2 + 20) car.z -= ROAD_LEN + 40;
    if (car.z < -ROAD_LEN / 2 - 20) car.z += ROAD_LEN + 40;

    const tx = laneCenterX(side, car.lane);
    const dx = tx - car.x;
    car.x += THREE.MathUtils.clamp(dx, -3.2 * dt, 3.2 * dt);

    car.mesh.position.set(car.x, 0, car.z);
    const lean = THREE.MathUtils.clamp(dx * 0.18, -0.22, 0.22);
    car.mesh.rotation.y = side === 'A' ? Math.PI - lean : lean;
    // spin the wheels with travel speed
    const wheels = car.mesh.userData.wheels;
    if (wheels) {
      const roll = (car.speed * dt) / 0.4;
      for (const wl of wheels) wl.spinner.rotation.x -= roll;
    }
  }
}

// ============================================================
// Build system
// ============================================================
let activeTab = 'Cones';

function initBuildUI() {
  const tabs = $('build-tabs');
  tabs.innerHTML = '';
  for (const cat of CATEGORIES) {
    const t = document.createElement('div');
    t.className = 'build-tab' + (cat === activeTab ? ' active' : '');
    t.textContent = cat;
    t.onclick = () => { activeTab = cat; renderBuildItems();
      tabs.querySelectorAll('.build-tab').forEach((el) => el.classList.toggle('active', el.textContent === cat));
    };
    tabs.appendChild(t);
  }
  renderBuildItems();
}

function renderBuildItems() {
  const wrap = $('build-items');
  wrap.innerHTML = '';
  for (const def of CATALOG.filter((d) => d.cat === activeTab)) {
    const el = document.createElement('div');
    el.className = 'build-item' + (ghostDef && ghostDef.id === def.id ? ' selected' : '');
    el.innerHTML = `<div class="bi-icon">${def.icon}</div>
      <div class="bi-name">${def.name}${def.drivable ? ' <span class="bi-tag">DRIVE</span>' : ''}</div>
      <div class="bi-desc">${def.desc}</div>`;
    el.onclick = () => {
      if (def.customText) { openSignModal(def); return; }
      selectItem(def); closeBuildMenu();
    };
    wrap.appendChild(el);
  }
}

function openSignModal(def) {
  const modal = $('sign-modal');
  const input = $('sign-modal-input');
  input.value = signTruckText;
  show(modal);
  input.focus();
  input.select();
  const done = (ok) => {
    hide(modal);
    if (ok) {
      const txt = input.value.trim();
      if (txt) signTruckText = txt;
      selectItem(def);
      closeBuildMenu();
    }
    $('sign-modal-ok').onclick = null;
    $('sign-modal-cancel').onclick = null;
    input.onkeydown = null;
  };
  $('sign-modal-ok').onclick = () => done(true);
  $('sign-modal-cancel').onclick = () => done(false);
  input.onkeydown = (e) => {
    e.stopPropagation();   // don't trigger game keybinds while typing
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); done(true); }
    if (e.key === 'Escape') done(false);
  };
}

// Rectangle surface tool: demolish, trench, repave, or gravel a region.
function makeSurfacePatch(kind, A, B) {
  const w = THREE.MathUtils.clamp(Math.abs(B.x - A.x), 0.6, 80);
  const d = THREE.MathUtils.clamp(Math.abs(B.z - A.z), 0.6, 80);
  const cx = (A.x + B.x) / 2, cz = (A.z + B.z) / 2;
  const g = new THREE.Group();
  g.position.set(cx, 0, cz);
  const area = w * d;

  if (kind === 'repave') {
    const tex = noiseTexture('#2b2e33', 6);
    tex.repeat.set(Math.max(1, w / 4), Math.max(1, d / 4));
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), lamb('#ffffff', { map: tex, roughness: 0.85 }));
    slab.position.y = 0.06; slab.receiveShadow = true;
    g.add(slab);
    // fresh seams / lane paint dashes optional edge
    const edge = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.02, d + 0.06), lamb('#1c1e21'));
    edge.position.y = 0.02; g.add(edge);
    return g;
  }
  if (kind === 'gravel') {
    const tex = noiseTexture('#8f8b82', 20);
    tex.repeat.set(Math.max(1, w / 2), Math.max(1, d / 2));
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), lamb('#ffffff', { map: tex, roughness: 1.0 }));
    slab.position.y = 0.06; slab.receiveShadow = true;
    g.add(slab);
    for (let i = 0; i < Math.min(120, area * 1.2); i++) {
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.04 + Math.random() * 0.07, 0), lamb('#7d7a72'));
      r.position.set((Math.random() - 0.5) * w, 0.11, (Math.random() - 0.5) * d);
      g.add(r);
    }
    return g;
  }

  // breaker / trench both expose dirt with broken asphalt around the edge
  const dirtTex = noiseTexture('#6e532f', 16);
  dirtTex.repeat.set(Math.max(1, w / 2), Math.max(1, d / 2));
  const depth = kind === 'trench' ? 0.9 : 0.12;
  const floorY = kind === 'trench' ? -depth + 0.05 : 0.05;
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), lamb('#ffffff', { map: dirtTex, roughness: 1.0 }));
  floor.position.y = floorY; floor.receiveShadow = true;
  g.add(floor);

  if (kind === 'trench') {
    // dirt walls
    const wallMat = lamb('#5c4526', { roughness: 1.0 });
    g.add(new THREE.Mesh(new THREE.BoxGeometry(w, depth, 0.15), wallMat)).position.set(0, floorY + depth / 2, d / 2);
    g.add(new THREE.Mesh(new THREE.BoxGeometry(w, depth, 0.15), wallMat)).position.set(0, floorY + depth / 2, -d / 2);
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.15, depth, d), wallMat)).position.set(w / 2, floorY + depth / 2, 0);
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.15, depth, d), wallMat)).position.set(-w / 2, floorY + depth / 2, 0);
    // spoil piles along the long edge
    for (let i = 0; i < Math.min(30, w); i++) {
      const pile = new THREE.Mesh(new THREE.ConeGeometry(0.35 + Math.random() * 0.3, 0.5, 7), lamb('#6e532f'));
      pile.position.set((Math.random() - 0.5) * w, 0.2, (Math.random() < 0.5 ? 1 : -1) * (d / 2 + 0.5));
      g.add(pile);
    }
    // exposed conduit pipe at the bottom
    const pipe = cyl(0.18, 0.18, w * 0.9, '#5a5f66', 0, floorY + 0.2, 0, 10);
    pipe.rotation.z = Math.PI / 2;
    g.add(pipe);
  }

  // broken asphalt chunks ringing / littering the demolished area
  const chunkMat = lamb('#3a3d42', { roughness: 0.95 });
  const nChunks = Math.min(90, Math.max(8, area * 0.9));
  for (let i = 0; i < nChunks; i++) {
    const cw = 0.25 + Math.random() * 0.5;
    const chunk = new THREE.Mesh(
      new THREE.BoxGeometry(cw, 0.09 + Math.random() * 0.06, cw * (0.6 + Math.random() * 0.6)),
      chunkMat
    );
    // cluster chunks toward the ragged edges
    const edge = Math.random();
    let px, pz;
    if (edge < 0.5) { px = (Math.random() - 0.5) * w; pz = (Math.random() < 0.5 ? -1 : 1) * (d / 2) * (0.7 + Math.random() * 0.5); }
    else { pz = (Math.random() - 0.5) * d; px = (Math.random() < 0.5 ? -1 : 1) * (w / 2) * (0.7 + Math.random() * 0.5); }
    chunk.position.set(px, (kind === 'trench' ? 0.06 : 0.11) + Math.random() * 0.05, pz);
    chunk.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * Math.PI, (Math.random() - 0.5) * 0.5);
    chunk.castShadow = true;
    g.add(chunk);
  }
  // a few bent rebar rods poking out of the rubble
  for (let i = 0; i < Math.min(10, area * 0.15); i++) {
    const rod = cyl(0.02, 0.02, 0.5 + Math.random() * 0.4, '#8a6a45', 0, 0, 0, 5);
    rod.position.set((Math.random() - 0.5) * w * 0.8, 0.18, (Math.random() - 0.5) * d * 0.8);
    rod.rotation.set((Math.random() - 0.5) * 0.9, 0, (Math.random() - 0.5) * 0.9);
    g.add(rod);
  }
  // loose gravel/dust
  for (let i = 0; i < Math.min(80, area); i++) {
    const gr = new THREE.Mesh(new THREE.DodecahedronGeometry(0.03 + Math.random() * 0.05, 0), lamb('#7a6a4a'));
    gr.position.set((Math.random() - 0.5) * w, (kind === 'trench' ? floorY + 0.06 : 0.1), (Math.random() - 0.5) * d);
    g.add(gr);
  }
  return g;
}

function selectItem(def) {
  clearGhost();
  ghostDef = def;
  if (def.tool) {
    // rectangle tool: no prop ghost, use a two-click corner preview
    breakerA = null;
    breakerPreview = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        color: def.tool === 'repave' ? '#2f3236' : def.tool === 'gravel' ? '#8f8b82' : '#c14a1a',
        transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide,
      })
    );
    breakerPreview.rotation.x = -Math.PI / 2;
    breakerPreview.visible = false;
    scene.add(breakerPreview);
    $('current-item-name').textContent = def.name;
    $('current-item-hint').textContent = 'Click corner 1, then corner 2 • Q cancel';
    return;
  }
  ghost = def.build();
  ghost.traverse((o) => {
    if (o.isLight) { o.visible = false; o.intensity = 0; }
    if (o.isMesh) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      o.material = mats.length === 1 ? mats[0].clone() : mats.map((m) => m.clone());
      const list = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of list) { m.transparent = true; m.opacity = 0.5; m.depthWrite = false; }
      o.castShadow = false;
    }
  });
  ghost.visible = false;
  scene.add(ghost);
  buildStretch = 1;
  $('current-item-name').textContent = def.name;
  $('current-item-hint').textContent = def.stretch
    ? 'Left-click to place • R rotate • [ ] stretch • Q deselect'
    : 'Left-click to place • R rotate • Q deselect';
}

function applyStretch(obj, axis, amount) {
  if (axis === 'x') obj.scale.x = amount;
  else if (axis === 'y') obj.scale.y = amount;
  else obj.scale.z = amount;
}

function clearGhost() {
  if (ghost) { scene.remove(ghost); ghost = null; }
  if (breakerPreview) { scene.remove(breakerPreview); breakerPreview = null; }
  breakerA = null;
  ghostDef = null;
  $('current-item-name').textContent = 'No item selected';
  $('current-item-hint').textContent = 'Press B for the build menu';
}

function crosshairGround() {
  raycaster.setFromCamera(CENTER, camera);
  const hits = raycaster.intersectObjects(groundMeshes, false);
  if (hits.length && hits[0].distance < 90) return hits[0].point.clone();
  return null;
}

function updateGhost() {
  if (buildMenuOpen || paused) { if (ghost) ghost.visible = false; if (breakerPreview) breakerPreview.visible = false; return; }
  // rectangle tool preview
  if (ghostDef && ghostDef.tool) {
    const p = crosshairGround();
    if (!p) { breakerPreview.visible = false; return; }
    const a = breakerA || p;
    const cx = (a.x + p.x) / 2, cz = (a.z + p.z) / 2;
    const w = Math.max(0.4, Math.abs(p.x - a.x)), d = Math.max(0.4, Math.abs(p.z - a.z));
    breakerPreview.position.set(cx, 0.06, cz);
    breakerPreview.scale.set(breakerA ? w : 0.6, breakerA ? d : 0.6, 1);
    breakerPreview.visible = true;
    return;
  }
  if (!ghost) return;
  raycaster.setFromCamera(CENTER, camera);
  const hits = raycaster.intersectObjects(groundMeshes, false);
  if (hits.length && hits[0].distance < 55) {
    const p = hits[0].point;
    ghost.position.set(p.x, Math.max(0, p.y), p.z);
    ghost.rotation.y = buildYaw;
    if (ghostDef.stretch) applyStretch(ghost, ghostDef.stretch, buildStretch);
    ghost.visible = true;
    ghostOk = true;
  } else {
    ghost.visible = false;
    ghostOk = false;
  }
}

function placeItem() {
  // rectangle tool: first click sets a corner, second click builds the patch
  if (ghostDef && ghostDef.tool) {
    const p = crosshairGround();
    if (!p) return;
    if (!breakerA) { breakerA = p; toast('Corner set — click the opposite corner'); return; }
    const patch = makeSurfacePatch(ghostDef.tool, breakerA, p);
    if (patch) {
      placedRoot.add(patch);
      placed.push({ group: patch, def: ghostDef });
      const kind = { breaker: 'Pavement demolished', trench: 'Trench dug', repave: 'Fresh asphalt laid', gravel: 'Gravel pad laid' }[ghostDef.tool];
      toast('🧨 ' + kind);
    }
    breakerA = null;
    return;
  }
  if (!ghostDef || !ghostOk || !ghost.visible) return;
  const item = ghostDef.build();
  item.position.copy(ghost.position);
  item.rotation.y = buildYaw;
  if (ghostDef.stretch) applyStretch(item, ghostDef.stretch, buildStretch);
  if (ghostDef.drivable) {
    vehiclesRoot.add(item);
    vehicles.push({ group: item, def: ghostDef, heading: buildYaw, speed: 0, steer: 0 });
    toast('Vehicle spawned — walk up and press E to drive');
  } else {
    placedRoot.add(item);
    placed.push({ group: item, def: ghostDef });
    item.traverse((o) => { if (o.isSpotLight) { towerSpots.push(o); } });
    applyTime();   // switch new lights to the current time of day
    computeLaneBlockers();
  }
}

function dropBlinkersOf(obj) {
  const mats = new Set();
  obj.traverse((o) => { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => mats.add(m)); });
  blinkers = blinkers.filter((b) => !mats.has(b.mat));
}

function deleteAimed() {
  raycaster.setFromCamera(CENTER, camera);
  const hits = raycaster.intersectObjects([...placedRoot.children, ...vehiclesRoot.children], true);
  if (!hits.length || hits[0].distance > 55) return;
  let obj = hits[0].object;
  while (obj && obj.parent !== placedRoot && obj.parent !== vehiclesRoot) obj = obj.parent;
  if (!obj) return;
  if (obj.parent === vehiclesRoot) {
    const idx = vehicles.findIndex((v) => v.group === obj);
    if (idx >= 0) {
      if (driving === vehicles[idx]) return;   // can't delete the one you're in
      dropBlinkersOf(obj);
      vehiclesRoot.remove(obj);
      vehicles.splice(idx, 1);
      toast('Vehicle removed');
    }
    return;
  }
  const idx = placed.findIndex((p) => p.group === obj);
  if (idx >= 0) {
    dropBlinkersOf(obj);
    const gone = new Set();
    obj.traverse((o) => { if (o.isSpotLight) gone.add(o); });
    if (gone.size) towerSpots = towerSpots.filter((s) => !gone.has(s));
    placedRoot.remove(obj);
    placed.splice(idx, 1);
    computeLaneBlockers();
    toast('Item removed');
  }
}

function clearPlaced() {
  for (const p of placed) placedRoot.remove(p.group);
  placed = [];
  if (driving) exitVehicle();
  for (const v of vehicles) vehiclesRoot.remove(v.group);
  vehicles = [];
  blinkers = [];
  towerSpots = [];
  computeLaneBlockers();
  toast('Cleared all placed items');
}

function openBuildMenu() {
  buildMenuOpen = true;
  renderBuildItems();
  show($('build-menu'));
  document.exitPointerLock();
}

function closeBuildMenu() {
  buildMenuOpen = false;
  hide($('build-menu'));
  requestLock();
}

// ============================================================
// Input & camera
// ============================================================
function requestLock() {
  wantLock = true;
  const p = renderer.domElement.requestPointerLock();
  if (p && p.catch) p.catch(() => {});
}

function resumeGame() {
  paused = false;
  hide($('pause-overlay'));
  requestLock();
}

function initInput() {
  const canvas = $('game-canvas');

  document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === renderer?.domElement;
    if (!locked && playing && !buildMenuOpen && wantLock) {
      // user pressed Esc
      paused = true;
      show($('pause-overlay'));
    }
    if (locked) { paused = false; hide($('pause-overlay')); }
  });

  canvas.addEventListener('click', () => {
    if (playing && !paused && !buildMenuOpen && document.pointerLockElement !== canvas) requestLock();
  });

  document.addEventListener('mousemove', (e) => {
    if (!playing || document.pointerLockElement !== renderer?.domElement) return;
    const sens = 0.0024;
    if (freeCam) {
      free.yaw -= e.movementX * sens;
      free.pitch = THREE.MathUtils.clamp(free.pitch - e.movementY * sens, -1.5, 1.5);
    } else {
      yaw -= e.movementX * sens;
      pitch = THREE.MathUtils.clamp(pitch + e.movementY * sens, -0.35, 1.1);
    }
  });

  document.addEventListener('mousedown', (e) => {
    if (!playing || paused || buildMenuOpen) return;
    if (document.pointerLockElement !== renderer?.domElement) return;
    if (e.button === 0) placeItem();
    else if (e.button === 2) deleteAimed();
  });
  document.addEventListener('contextmenu', (e) => { if (playing) e.preventDefault(); });

  document.addEventListener('wheel', (e) => {
    if (freeCam) free.speed = THREE.MathUtils.clamp(free.speed * (e.deltaY > 0 ? 0.85 : 1.18), 4, 120);
  });

  document.addEventListener('keydown', (e) => {
    if (!playing) return;
    keys[e.code] = true;
    if (e.code === 'KeyB') { buildMenuOpen ? closeBuildMenu() : openBuildMenu(); }
    if (buildMenuOpen || paused) return;
    if (e.code === 'KeyQ') clearGhost();
    if (e.code === 'KeyR') buildYaw += (e.shiftKey ? -1 : 1) * Math.PI / 8;
    if (e.code === 'KeyG') toggleFreeCam();
    if (e.code === 'KeyP') takePhoto();
    if (e.code === 'KeyX') deleteAimed();
    if (e.code === 'KeyT') {
      timeIdx = (timeIdx + 1) % 3;
      applyTime();
      toast('🕐 ' + TIME_NAMES[timeIdx]);
    }
    if (e.code === 'KeyE' && !freeCam) {
      if (driving) exitVehicle();
      else enterVehicleNearby();
    }
    if (e.code === 'KeyL') cycleLivery();
    if (e.code === 'BracketLeft' && ghostDef?.stretch) {
      buildStretch = Math.max(0.4, buildStretch / 1.15);
    }
    if (e.code === 'BracketRight' && ghostDef?.stretch) {
      buildStretch = Math.min(4, buildStretch * 1.15);
    }
  });
  document.addEventListener('keyup', (e) => { keys[e.code] = false; });
}

function toggleFreeCam() {
  freeCam = !freeCam;
  if (freeCam) {
    free.pos.copy(camera.position);
    const d = camera.getWorldDirection(new THREE.Vector3());
    free.yaw = Math.atan2(d.x, d.z);
    free.pitch = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1));
    show($('mode-tag'));
    toast('Free cam — fly around and press P to take pictures');
  } else {
    hide($('mode-tag'));
  }
}

function takePhoto() {
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  const s = STATES[sel.state];
  const hw = sel.highway;
  const label = (hw.sign === 'I' ? 'I' + hw.num : hw.sign === 'US' ? 'US' + hw.num : s.abbr + hw.num);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CHS_${s.abbr}_${label}_${++photoCount}.png`;
  a.click();

  const sh = $('shutter');
  hide(sh); void sh.offsetWidth; show(sh);
  setTimeout(() => hide(sh), 300);
  $('photo-thumb-img').src = url;
  show($('photo-thumb'));
  clearTimeout(takePhoto._t);
  takePhoto._t = setTimeout(() => hide($('photo-thumb')), 2600);
}

// ============================================================
// Driving
// ============================================================
function enterVehicleNearby() {
  let best = null, bd = 5.5;
  for (const v of vehicles) {
    const d = v.group.position.distanceTo(player.position);
    if (d < bd) { bd = d; best = v; }
  }
  if (!best) return;
  driving = best;
  player.visible = false;
  yaw = best.heading;
  _speedoLast = -1;
  updateSpeedo(0);
  show($('speedo'));
  $('current-item-name').textContent = '🚗 Driving: ' + best.def.name;
  $('current-item-hint').textContent = 'W/S gas & brake • A/D steer • Shift boost • Space handbrake • E get out';
  toast('Driving the ' + best.def.name);
}

function cycleLivery() {
  const v = driving;
  if (!v) { toast('Get in a vehicle first (E), then L to change livery'); return; }
  const vest = sel.vest;
  const liveries = [
    { name: 'Factory', color: null },
    { name: vest.name + ' livery', color: vest.base },
    { name: 'Hi-Vis Yellow', color: '#f2cb1d' },
    { name: 'Pearl White', color: '#eef0f2' },
    { name: 'Blackout', color: '#1a1c20' },
  ];
  v.liveryIdx = ((v.liveryIdx ?? 0) + 1) % liveries.length;
  const L = liveries[v.liveryIdx];
  v.group.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (m && m.userData && m.userData.isPaint) {
        if (m.userData.orig === undefined) m.userData.orig = m.color.getHex();
        m.color.setHex(L.color ? new THREE.Color(L.color).getHex() : m.userData.orig);
      }
    }
  });
  toast('🎨 Livery: ' + L.name);
}

function exitVehicle() {
  const v = driving;
  if (!v) return;
  driving = null;
  player.visible = true;
  hide($('speedo'));
  v.group.rotation.z = 0;
  const h = v.heading;
  player.position.set(
    v.group.position.x + Math.sin(h + Math.PI / 2) * 2.4,
    0,
    v.group.position.z + Math.cos(h + Math.PI / 2) * 2.4
  );
  player.rotation.y = h;
  yaw = h;
  vel.y = 0; onGround = true;
  $('current-item-name').textContent = ghostDef ? ghostDef.name : 'No item selected';
  $('current-item-hint').textContent = ghostDef ? 'Left-click to place • R rotate • Q deselect' : 'Press B for the build menu';
}

let _speedoCtx = null, _speedoLast = -1;
function updateSpeedo(mph) {
  mph = Math.round(mph);
  if (mph === _speedoLast) return;
  _speedoLast = mph;
  const cv = $('speedo-canvas');
  if (!cv) return;
  const ctx = _speedoCtx || (_speedoCtx = cv.getContext('2d'));
  const S = 180, cx = S / 2, cy = S / 2, R = 76;
  ctx.clearRect(0, 0, S, S);
  // dial face
  ctx.beginPath(); ctx.arc(cx, cy, R + 8, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(12,14,18,0.85)'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,210,63,0.5)'; ctx.stroke();
  const maxMph = 100;
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
  // ticks
  for (let m = 0; m <= maxMph; m += 10) {
    const a = a0 + (a1 - a0) * (m / maxMph);
    const big = m % 20 === 0;
    ctx.strokeStyle = m > 70 ? '#ff5a4d' : '#c8ccd4';
    ctx.lineWidth = big ? 3 : 1.5;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (R - (big ? 12 : 7)), cy + Math.sin(a) * (R - (big ? 12 : 7)));
    ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    ctx.stroke();
    if (big) {
      ctx.fillStyle = '#aeb6c4'; ctx.font = '700 11px Arial';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(m), cx + Math.cos(a) * (R - 24), cy + Math.sin(a) * (R - 24));
    }
  }
  // needle
  const av = a0 + (a1 - a0) * Math.min(1, mph / maxMph);
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(av) * 12, cy - Math.sin(av) * 12);
  ctx.lineTo(cx + Math.cos(av) * (R - 14), cy + Math.sin(av) * (R - 14));
  ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2); ctx.fillStyle = '#ffd23f'; ctx.fill();
  // readout
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.font = '800 30px Arial'; ctx.fillText(mph, cx, cy + 34);
  ctx.fillStyle = '#8a93a5'; ctx.font = '700 11px Arial'; ctx.fillText('MPH', cx, cy + 52);
}

function vehicleRadius(v) {
  return v._radius || (v._radius = Math.max(1.4, v.def && v.len ? v.len * 0.42 : (v.len || 5) * 0.42));
}

function updateDriving(dt) {
  const v = driving;
  const boost = (keys['ShiftLeft'] || keys['ShiftRight']) ? 1.5 : 1;   // hold Shift to floor it
  // throttle / brake / reverse
  if (keys['KeyW']) v.speed += 9 * dt * boost;
  else if (keys['KeyS']) v.speed -= 11 * dt;
  else v.speed *= Math.max(0, 1 - dt * 0.7);          // coasting drag
  if (keys['Space']) v.speed *= Math.max(0, 1 - dt * 3.2);
  v.speed = THREE.MathUtils.clamp(v.speed, -8, 30 * boost);
  if (Math.abs(v.speed) < 0.05 && !keys['KeyW'] && !keys['KeyS']) v.speed = 0;

  // steering (A = left), effectiveness scales with speed and flips in reverse
  const steerIn = (keys['KeyA'] ? 1 : 0) - (keys['KeyD'] ? 1 : 0);
  v.steer += (steerIn - v.steer) * Math.min(1, dt * 7);
  v.heading += v.steer * dt * 1.9 * THREE.MathUtils.clamp(v.speed / 9, -1, 1);

  const prevX = v.group.position.x, prevZ = v.group.position.z;
  let nx = prevX + Math.sin(v.heading) * v.speed * dt;
  let nz = prevZ + Math.cos(v.heading) * v.speed * dt;

  // ---- collision: keep out of other vehicles and solid props ----
  const rSelf = vehicleRadius(v);
  let hit = false;
  for (const o of vehicles) {
    if (o === v) continue;
    const rr = rSelf + vehicleRadius(o);
    let dx = nx - o.group.position.x, dz = nz - o.group.position.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < rr * rr && d2 > 1e-4) {
      const d = Math.sqrt(d2);
      nx = o.group.position.x + (dx / d) * rr;
      nz = o.group.position.z + (dz / d) * rr;
      hit = true;
    }
  }
  for (const p of placed) {
    if (!p.def.blocks) continue;
    const rr = rSelf + 0.8;
    let dx = nx - p.group.position.x, dz = nz - p.group.position.z;
    const d2 = dx * dx + dz * dz;
    if (d2 < rr * rr && d2 > 1e-4) {
      const d = Math.sqrt(d2);
      nx = p.group.position.x + (dx / d) * rr;
      nz = p.group.position.z + (dz / d) * rr;
      hit = true;
    }
  }
  if (hit) v.speed *= 0.35;   // crunch — bleed speed on impact

  v.group.position.x = THREE.MathUtils.clamp(nx, -400, 400);
  v.group.position.z = THREE.MathUtils.clamp(nz, -ROAD_LEN / 2, ROAD_LEN / 2);
  v.group.rotation.y = v.heading;

  // ---- spin & steer the wheels ----
  const wheels = v.group.userData.wheels;
  if (wheels) {
    const rollDist = Math.hypot(v.group.position.x - prevX, v.group.position.z - prevZ) * Math.sign(v.speed || 1);
    for (const wl of wheels) {
      wl.spinner.rotation.x -= rollDist / wl.radius;
      if (wl.steer) wl.pivot.rotation.y = v.steer * 0.5;
    }
  }

  // subtle body roll & pitch under steering/accel
  v.group.rotation.z = -v.steer * THREE.MathUtils.clamp(v.speed / 22, 0, 1) * 0.05;

  // keep the (hidden) player with the vehicle
  player.position.copy(v.group.position);

  // speedometer
  const mph = Math.abs(v.speed) / MPH;
  updateSpeedo(mph);

  // chase camera
  const dist = 10.5;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const px = v.group.position.x, pz = v.group.position.z;
  camera.position.set(
    px - Math.sin(yaw) * cp * dist,
    2.9 + sp * dist,
    pz - Math.cos(yaw) * cp * dist
  );
  if (camera.position.y < 0.5) camera.position.y = 0.5;
  camera.lookAt(px, 1.7, pz);
}

// ============================================================
// Update loop
// ============================================================
const fwd = new THREE.Vector3();
const rightV = new THREE.Vector3();

function updatePlayer(dt, t) {
  const speed = keys['ShiftLeft'] || keys['ShiftRight'] ? 8 : 4.4;
  fwd.set(Math.sin(yaw), 0, Math.cos(yaw));
  rightV.set(-fwd.z, 0, fwd.x); // screen-right = forward x up

  let mx = 0, mz = 0;
  if (keys['KeyW']) mz += 1;
  if (keys['KeyS']) mz -= 1;
  if (keys['KeyA']) mx -= 1;
  if (keys['KeyD']) mx += 1;
  const moving = mx !== 0 || mz !== 0;

  if (moving && !paused && !buildMenuOpen) {
    const dir = new THREE.Vector3()
      .addScaledVector(fwd, mz)
      .addScaledVector(rightV, mx)
      .normalize();
    player.position.addScaledVector(dir, speed * dt);
    const targetRot = Math.atan2(dir.x, dir.z);
    let dr = targetRot - player.rotation.y;
    while (dr > Math.PI) dr -= Math.PI * 2;
    while (dr < -Math.PI) dr += Math.PI * 2;
    player.rotation.y += dr * Math.min(1, dt * 12);
  }

  // jump & gravity
  if (keys['Space'] && onGround) { vel.y = 6.2; onGround = false; }
  if (!onGround) {
    vel.y -= 18 * dt;
    player.position.y += vel.y * dt;
    if (player.position.y <= 0) { player.position.y = 0; vel.y = 0; onGround = true; }
  }

  // keep player inside the world
  player.position.x = THREE.MathUtils.clamp(player.position.x, -400, 400);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -ROAD_LEN / 2, ROAD_LEN / 2);

  // limb swing
  const sw = moving ? Math.sin(t * (speed > 5 ? 13 : 9)) * 0.7 : 0;
  limbs.lLeg.rotation.x = sw;
  limbs.rLeg.rotation.x = -sw;
  limbs.lArm.rotation.x = -sw * 0.8;
  limbs.rArm.rotation.x = sw * 0.8;

  // third-person camera
  const dist = 5.4;
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  camera.position.set(
    player.position.x - Math.sin(yaw) * cp * dist,
    player.position.y + 1.7 + sp * dist,
    player.position.z - Math.cos(yaw) * cp * dist
  );
  if (camera.position.y < 0.35) camera.position.y = 0.35;
  camera.lookAt(player.position.x, player.position.y + 1.55, player.position.z);
}

function updateFreeCam(dt) {
  const d = new THREE.Vector3(
    Math.sin(free.yaw) * Math.cos(free.pitch),
    Math.sin(free.pitch),
    Math.cos(free.yaw) * Math.cos(free.pitch)
  );
  const r = new THREE.Vector3(-d.z, 0, d.x).normalize();
  const boost = keys['Enter'] || keys['NumpadEnter'] ? 4 : 1;   // hold Enter to fly faster
  const sp = free.speed * boost * dt;
  if (keys['KeyW']) free.pos.addScaledVector(d, sp);
  if (keys['KeyS']) free.pos.addScaledVector(d, -sp);
  if (keys['KeyA']) free.pos.addScaledVector(r, -sp);
  if (keys['KeyD']) free.pos.addScaledVector(r, sp);
  if (keys['Space']) free.pos.y += sp;
  if (keys['ShiftLeft'] || keys['ShiftRight']) free.pos.y -= sp;
  free.pos.y = Math.max(0.3, free.pos.y);
  camera.position.copy(free.pos);
  camera.lookAt(free.pos.x + d.x, free.pos.y + d.y, free.pos.z + d.z);
}

function animate() {
  requestAnimationFrame(animate);
  if (!renderer) return;
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (playing && !paused) {
    if (freeCam) updateFreeCam(dt);
    else if (driving) updateDriving(dt);
    else updatePlayer(dt, t);
    updateTraffic(dt);
    updateGhost();

    // blinking lights
    for (const b of blinkers) {
      b.mat.emissiveIntensity = Math.sin(t * b.speed * Math.PI + b.phase) > 0 ? 1.4 : 0.05;
    }
    // drifting clouds
    for (const cl of clouds) {
      cl.position.x += dt * 1.2;
      if (cl.position.x > ROAD_LEN / 2 + 300) cl.position.x = -(ROAD_LEN / 2 + 300);
    }
    // sun shadows follow the player
    const focus = freeCam ? free.pos : (driving ? driving.group.position : player.position);
    sun.position.set(focus.x + 60, sunHeight, focus.z + 40);
    sun.target.position.set(focus.x, 0, focus.z);
    skyDome.position.set(focus.x, 0, focus.z);
  }

  if (renderer && scene && camera) renderer.render(scene, camera);
}

// ============================================================
// boot
// ============================================================
initMenus();
initInput();
animate();

// small debug handle (used by automated tests)
window.CHS = {
  get placed() { return placed; },
  get cars() { return cars; },
  get blockers() { return laneBlockers; },
  get playing() { return playing; },
  get debug() {
    return {
      yaw, pitch, ghostOk,
      ghost: ghost ? ghost.position.toArray() : null,
      cam: camera ? camera.position.toArray() : null,
      player: player ? player.position.toArray() : null,
    };
  },
  get vehicles() { return vehicles; },
  get driving() { return driving; },
  get timeIdx() { return timeIdx; },
  setTime(i) { timeIdx = ((i % 3) + 3) % 3; applyTime(); },
  teleport(x, z, ry) {
    if (!player) return;
    player.position.set(x, 0, z);
    if (ry !== undefined) { player.rotation.y = ry; yaw = ry; }
  },
  // scripted helpers for automated tests / screenshots
  place(id, x, z, ry = 0) {
    const def = CATALOG.find((d) => d.id === id);
    if (!def || !placedRoot) return false;
    const item = def.build();
    item.position.set(x, 0, z);
    item.rotation.y = ry;
    if (def.drivable) {
      vehiclesRoot.add(item);
      vehicles.push({ group: item, def, heading: ry, speed: 0, steer: 0 });
    } else {
      placedRoot.add(item);
      placed.push({ group: item, def });
      item.traverse((o) => { if (o.isSpotLight) towerSpots.push(o); });
      applyTime();
      computeLaneBlockers();
    }
    return true;
  },
  setCam(x, y, z, cyaw, cpitch) {
    if (!camera) return;
    freeCam = true;
    show($('mode-tag'));
    free.pos.set(x, y, z);
    free.yaw = cyaw;
    free.pitch = cpitch;
  },
};
