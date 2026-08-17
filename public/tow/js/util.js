// Small math / geometry helpers shared by every module.
import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (t) => t * t * (3 - 2 * t);

// Frame-rate independent approach-a-target.
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt));

export function angleDelta(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) {
  const r = mulberry32(seed);
  r.range = (a, b) => a + r() * (b - a);
  r.int = (a, b) => Math.floor(a + r() * (b - a + 1));
  r.pick = (arr) => arr[Math.floor(r() * arr.length) % arr.length];
  r.chance = (p) => r() < p;
  return r;
}

/* ------------------------------------------------------------------ canvas */

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function canvasTexture(canvas, { repeat = null, aniso = 8, srgb = true } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = aniso;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  tex.needsUpdate = true;
  return tex;
}

// Draw text that always fits inside `maxWidth` by shrinking the font.
export function fitText(ctx, text, x, y, maxWidth, size, font = 'Arial', weight = 'bold', align = 'center') {
  let s = size;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  do {
    ctx.font = `${weight} ${s}px ${font}`;
    if (ctx.measureText(text).width <= maxWidth || s <= 6) break;
    s -= 1;
  } while (true);
  ctx.fillText(text, x, y);
  return s;
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/* ------------------------------------------------------------------- parts */

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 16);
const cylGeoHi = new THREE.CylinderGeometry(1, 1, 1, 24);
const sphereGeo = new THREE.SphereGeometry(1, 16, 12);

export function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(boxGeo, mat);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function cyl(r, h, mat, x = 0, y = 0, z = 0, seg = 16) {
  const m = new THREE.Mesh(seg > 16 ? cylGeoHi : cylGeo, mat);
  m.scale.set(r, h, r);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function sphere(r, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(sphereGeo, mat);
  m.scale.setScalar(r);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// A tapered box: front face can be narrower/shorter than the back one.
// Used constantly for greenhouses, hoods, fenders and noses.
export function wedgeBox(opts) {
  const {
    w = 1, h = 1, d = 1,
    topScaleX = 1, topScaleZ = 1,
    topOffsetZ = 0, topOffsetX = 0,
    mat,
  } = opts;
  const geo = new THREE.BoxGeometry(w, h, d);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > 0) {
      pos.setX(i, pos.getX(i) * topScaleX + topOffsetX);
      pos.setZ(i, pos.getZ(i) * topScaleZ + topOffsetZ);
    }
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// A box whose front (+Z) face is raked back — the classic windshield shape.
export function rakedBox(w, h, d, rakeFront, rakeBack, mat) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i), z = pos.getZ(i);
    if (y > 0 && z > 0) pos.setZ(i, z - rakeFront);
    if (y > 0 && z < 0) pos.setZ(i, z + rakeBack);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export function group(...children) {
  const g = new THREE.Group();
  for (const c of children) if (c) g.add(c);
  return g;
}

export function disposeObject(obj) {
  obj.traverse((o) => {
    if (o.geometry && o.geometry !== boxGeo && o.geometry !== cylGeo && o.geometry !== cylGeoHi && o.geometry !== sphereGeo) {
      o.geometry.dispose();
    }
  });
}

/* ------------------------------------------------------------------- misc */

export function fmtMoney(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

export function fmtClock(minutes) {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = String(Math.floor(m % 60)).padStart(2, '0');
  const ap = h24 < 12 ? 'AM' : 'PM';
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${mm} ${ap}`;
}

export function dist2(ax, az, bx, bz) {
  const dx = ax - bx, dz = az - bz;
  return dx * dx + dz * dz;
}

// Distance a car would travel in miles, for the odometer flavour.
export const metersToMiles = (m) => m / 1609.34;
