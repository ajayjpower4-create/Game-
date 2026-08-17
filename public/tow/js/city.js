// Skyville: a mid-size East Coast city inside a ring highway.
//
// Everything static is generated once and merged down to a handful of draw
// calls. The same road data also rasterises into a height grid (so ramps and
// the elevated ring actually work under the wheels) and a collision grid.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { box, makeCanvas, canvasTexture, makeRng, clamp, lerp, TAU, roundRect, fitText } from './util.js';
import { mat, glass, lightMat, texMat, C } from './materials.js';
import { buildVehicle } from './vehicles.js';

export const CITY = {
  HALF: 700,          // world extends -700..700
  RING_HALF: 520,     // ring highway half-extent
  RING_R: 170,        // corner radius of the ring
  RING_W: 30,         // full roadway width (both carriageways)
  RING_Y: 9,          // deck height
  BLOCK: 80,          // street spacing
  STREET_W: 13,
  ARTERIAL_W: 21,
  GRID_MAX: 440,      // streets run from -GRID_MAX..GRID_MAX
  CELL: 2,
};

/* ------------------------------------------------------------------ merging */

class Merger {
  constructor() { this.buckets = new Map(); }

  addGeometry(geo, material, matrix, uvScale) {
    let g = geo.clone();
    if (uvScale && g.attributes.uv) {
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvScale[0], uv.getY(i) * uvScale[1]);
    }
    if (matrix) g.applyMatrix4(matrix);
    g.clearGroups();
    for (const key of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv'].includes(key)) g.deleteAttribute(key);
    }
    if (!g.attributes.uv) {
      const uv = new Float32Array(g.attributes.position.count * 2);
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    }
    let bucket = this.buckets.get(material);
    if (!bucket) { bucket = []; this.buckets.set(material, bucket); }
    bucket.push(g);
  }

  // Fold an entire built object (a parked car, a sign, a lamp) into the merge.
  addObject(obj) {
    obj.updateMatrixWorld(true);
    obj.traverse((o) => {
      if (o.isMesh && o.geometry) this.addGeometry(o.geometry, o.material, o.matrixWorld);
    });
  }

  build(parent, { castShadow = true, receiveShadow = true } = {}) {
    for (const [material, list] of this.buckets) {
      if (!list.length) continue;
      const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
      if (!merged) continue;
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = castShadow && !material.transparent;
      mesh.receiveShadow = receiveShadow;
      mesh.matrixAutoUpdate = false;
      parent.add(mesh);
      list.length = 0;
    }
    this.buckets.clear();
  }
}

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitPlane = new THREE.PlaneGeometry(1, 1);
const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 12);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();

function mBox(merger, material, w, h, d, x, y, z, ry = 0, uvScale = null) {
  _e.set(0, ry, 0); _q.setFromEuler(_e);
  _m.compose(_v.set(x, y, z), _q, _s.set(w, h, d));
  merger.addGeometry(unitBox, material, _m, uvScale);
}

function mPlaneY(merger, material, w, d, x, y, z, ry = 0, uvScale = null) {
  _e.set(-Math.PI / 2, 0, ry, 'YXZ'); _q.setFromEuler(_e);
  _m.compose(_v.set(x, y, z), _q, _s.set(w, d, 1));
  merger.addGeometry(unitPlane, material, _m, uvScale);
}

function mCyl(merger, material, r, h, x, y, z) {
  _q.identity();
  _m.compose(_v.set(x, y, z), _q, _s.set(r, h, r));
  merger.addGeometry(unitCyl, material, _m);
}

/* ----------------------------------------------------------------- textures */

function asphaltTexture(kind) {
  const c = makeCanvas(256, 256);
  const x = c.getContext('2d');
  x.fillStyle = '#3a3b40'; x.fillRect(0, 0, 256, 256);
  // speckle
  for (let i = 0; i < 2600; i++) {
    const g = 40 + Math.random() * 40;
    x.fillStyle = `rgba(${g},${g},${g + 4},.35)`;
    x.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  x.fillStyle = '#e8e2c8';
  if (kind === 'street') {
    for (let y = 0; y < 256; y += 48) x.fillRect(126, y, 5, 26);        // dashed centre
    x.fillRect(10, 0, 4, 256); x.fillRect(242, 0, 4, 256);              // edge lines
  } else if (kind === 'arterial') {
    x.fillStyle = '#f0d878';
    x.fillRect(120, 0, 5, 256); x.fillRect(132, 0, 5, 256);             // double yellow
    x.fillStyle = '#e8e2c8';
    for (let y = 0; y < 256; y += 44) { x.fillRect(64, y, 4, 22); x.fillRect(190, y, 4, 22); }
    x.fillRect(8, 0, 4, 256); x.fillRect(244, 0, 4, 256);
  } else if (kind === 'highway') {
    x.fillStyle = '#e8e2c8';
    for (let y = 0; y < 256; y += 40) { x.fillRect(72, y, 5, 20); x.fillRect(180, y, 5, 20); }
    x.fillRect(6, 0, 6, 256); x.fillRect(244, 0, 6, 256);
    x.fillStyle = '#f0d878'; x.fillRect(124, 0, 6, 256);
  } else if (kind === 'ramp') {
    x.fillStyle = '#e8e2c8';
    x.fillRect(12, 0, 5, 256); x.fillRect(239, 0, 5, 256);
  }
  return canvasTexture(c, { repeat: [1, 1] });
}

function groundTexture() {
  const c = makeCanvas(256, 256);
  const x = c.getContext('2d');
  x.fillStyle = '#54763e'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3000; i++) {
    const g = Math.random();
    x.fillStyle = g > 0.5 ? 'rgba(90,120,60,.5)' : 'rgba(60,90,45,.5)';
    x.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
  }
  return canvasTexture(c, { repeat: [120, 120] });
}

function concreteTexture() {
  const c = makeCanvas(128, 128);
  const x = c.getContext('2d');
  x.fillStyle = '#a3a49f'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 900; i++) {
    const g = 150 + Math.random() * 40;
    x.fillStyle = `rgba(${g},${g},${g - 5},.4)`;
    x.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  x.strokeStyle = 'rgba(120,120,116,.6)'; x.lineWidth = 2;
  x.strokeRect(1, 1, 126, 126);
  return canvasTexture(c, { repeat: [1, 1] });
}

function windowTexture(style, seed) {
  const rng = makeRng(seed);
  const c = makeCanvas(256, 256);
  const x = c.getContext('2d');
  const palettes = {
    glass: ['#5d7f96', '#4d6c81', '#6d8fa6'],
    brick: ['#8d4f3c', '#7a4433', '#9b5a45'],
    tan: ['#b9a184', '#a8917a', '#c4ad91'],
    concrete: ['#9a9c9a', '#8b8d8b', '#a7a9a7'],
    modern: ['#3f4750', '#4a535c', '#38404a'],
  };
  const pal = palettes[style] || palettes.concrete;
  x.fillStyle = pal[0]; x.fillRect(0, 0, 256, 256);
  if (style === 'brick') {
    for (let y = 0; y < 256; y += 10) {
      for (let bx = (y / 10) % 2 ? -10 : 0; bx < 256; bx += 22) {
        x.fillStyle = rng() > 0.5 ? pal[1] : pal[2];
        x.fillRect(bx + 1, y + 1, 20, 8);
      }
    }
  }
  // Windows
  const cols = style === 'glass' || style === 'modern' ? 8 : 6;
  const rows = 8;
  for (let r = 0; r < rows; r++) {
    for (let cc = 0; cc < cols; cc++) {
      const lit = rng() > 0.62;
      const w = 256 / cols, h = 256 / rows;
      x.fillStyle = lit ? '#f4e3ac' : '#232a33';
      x.fillRect(cc * w + w * 0.18, r * h + h * 0.2, w * 0.64, h * 0.52);
      x.fillStyle = 'rgba(20,22,26,.6)';
      x.fillRect(cc * w + w * 0.18, r * h + h * 0.44, w * 0.64, 2);
    }
  }
  x.fillStyle = 'rgba(0,0,0,.18)';
  for (let r = 0; r < rows; r++) x.fillRect(0, r * (256 / rows) + 256 / rows - 3, 256, 3);
  return canvasTexture(c);
}

const BUSINESS_WORDS = {
  a: ['Harbor', 'Meridian', 'Ironbridge', 'Northgate', 'Cannery', 'Skyville', 'Lakeside', 'Front St.',
    'Bayview', 'Delgado', 'Kowalski', 'Prospect', 'Union', 'Corner', 'Old Mill', 'Riverside', 'Beacon'],
  b: ['Deli', 'Diner', 'Hardware', 'Laundromat', 'Bakery', 'Pharmacy', 'Barbers', 'Pizza', 'Market',
    'Bodega', 'Tavern', 'Coffee', 'Cleaners', 'Books', 'Records', 'Bagels', 'Sub Shop', 'Nail Salon',
    'Insurance', 'Realty', 'Dental', 'Print Shop', 'Liquors', 'Wings', 'Tackle', 'Auto Parts'],
};

function signTexture(text, bg = '#1b2430', fg = '#f5f2e8', sub = '') {
  const c = makeCanvas(512, 128);
  const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 512, 128);
  x.strokeStyle = 'rgba(255,255,255,.18)'; x.lineWidth = 4; x.strokeRect(6, 6, 500, 116);
  x.fillStyle = fg;
  fitText(x, text, 256, sub ? 52 : 64, 470, 54);
  if (sub) { x.font = '24px Arial'; x.textAlign = 'center'; x.fillText(sub, 256, 96); }
  return canvasTexture(c);
}

function highwaySignTexture(lines, { exit = null, width = 1024, height = 512 } = {}) {
  const c = makeCanvas(width, height);
  const x = c.getContext('2d');
  x.fillStyle = '#0d5c33'; x.fillRect(0, 0, width, height);
  x.strokeStyle = '#f2f4f0'; x.lineWidth = 8;
  roundRect(x, 14, 14, width - 28, height - 28, 18); x.stroke();
  x.fillStyle = '#f2f4f0';
  x.textAlign = 'center';
  const n = lines.length;
  lines.forEach((ln, i) => {
    const y = height * ((i + 1) / (n + 1));
    fitText(x, ln.text, width / 2, y, width - 90, ln.size || 76);
  });
  if (exit) {
    x.fillStyle = '#f2f4f0';
    roundRect(x, width - 250, 26, 220, 92, 12); x.fill();
    x.fillStyle = '#0d5c33';
    x.font = 'bold 62px Arial';
    x.fillText('EXIT ' + exit, width - 140, 90);
  }
  return canvasTexture(c);
}

function shieldTexture(num) {
  const c = makeCanvas(256, 256);
  const x = c.getContext('2d');
  x.fillStyle = '#f2f4f0'; x.fillRect(0, 0, 256, 256);
  x.fillStyle = '#123c78';
  roundRect(x, 20, 46, 216, 180, 26); x.fill();
  x.fillStyle = '#c0392b'; x.fillRect(20, 46, 216, 44);
  x.fillStyle = '#f2f4f0'; x.font = 'bold 30px Arial'; x.textAlign = 'center';
  x.fillText('INTERSTATE', 128, 78);
  x.font = 'bold 104px Arial';
  x.fillText(String(num), 128, 180);
  return canvasTexture(c);
}

function plainSignTexture(text, sub, bg = '#f2f4f0', fg = '#14161a') {
  const c = makeCanvas(256, 320);
  const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 256, 320);
  x.strokeStyle = fg; x.lineWidth = 6; x.strokeRect(10, 10, 236, 300);
  x.fillStyle = fg; x.textAlign = 'center';
  x.font = 'bold 40px Arial';
  x.fillText(text, 128, 100);
  x.font = 'bold 92px Arial';
  x.fillText(sub, 128, 210);
  return canvasTexture(c);
}

/* ------------------------------------------------------------- street names */

const AVENUES = ['1st Ave', '2nd Ave', '3rd Ave', '4th Ave', '5th Ave', '6th Ave', '7th Ave', '8th Ave', '9th Ave', '10th Ave', '11th Ave', '12th Ave'];
const CROSS_STREETS = ['Cannery Row', 'Ironbridge St', 'Meridian Blvd', 'Prospect St', 'Union St', 'Harbor Blvd',
  'Beacon St', 'Delgado Way', 'Northgate Pike', 'Front St', 'Lakeside Dr', 'Dockside Ave'];

/* ---------------------------------------------------------------- the shops */

const SHOP_DEFS = [
  { id: 'ironbridge', name: 'Ironbridge Auto & Diesel', x: 300, z: -330, rot: 0, kind: 'diesel' },
  { id: 'delgado', name: 'Delgado Brothers Garage', x: -350, z: 60, rot: Math.PI / 2, kind: 'general' },
  { id: 'harborpoint', name: 'Harbor Point Motors', x: 415, z: 140, rot: -Math.PI / 2, kind: 'import' },
  { id: 'northgate', name: 'Northgate Tire & Brake', x: -60, z: 395, rot: Math.PI, kind: 'tire' },
  { id: 'meridian', name: 'Meridian Collision Center', x: 130, z: 40, rot: 0, kind: 'body' },
  { id: 'impound', name: 'Skyville Municipal Impound', x: -180, z: -400, rot: 0, kind: 'impound' },
  { id: 'lakeside', name: 'Lakeside Transmission', x: -395, z: 330, rot: Math.PI / 2, kind: 'trans' },
  { id: 'route9', name: 'Route 9 Truck Repair', x: 385, z: -420, rot: -Math.PI / 2, kind: 'truck' },
];

/* --------------------------------------------------------------- generation */

export function buildCity(scene, opts = {}) {
  const rng = makeRng(opts.seed ?? 20240815);
  const group = new THREE.Group();
  group.name = 'skyville';
  scene.add(group);

  const cell = CITY.CELL;
  const gridN = Math.ceil((CITY.HALF * 2) / cell);
  const height = new Float32Array(gridN * gridN);
  const roadFlag = new Uint8Array(gridN * gridN);
  const solid = new Uint8Array(gridN * gridN);

  const idx = (ix, iz) => iz * gridN + ix;
  const toCell = (v) => Math.floor((v + CITY.HALF) / cell);
  const toWorld = (i) => i * cell - CITY.HALF + cell / 2;

  const segments = [];   // road segments, also used for the minimap
  const roadNodes = [];  // curbside points where jobs can happen

  function addSegment(ax, az, bx, bz, w, type, y0 = 0, y1 = 0, name = '') {
    segments.push({ ax, az, bx, bz, w, type, y0, y1, name });
  }

  /* ---- 1. street grid ---- */
  const streetLines = [];
  const G = CITY.GRID_MAX;
  const nLines = Math.floor((G * 2) / CITY.BLOCK) + 1;
  for (let i = 0; i < nLines; i++) {
    const v = -G + i * CITY.BLOCK;
    const arterial = i % 3 === 0;
    const w = arterial ? CITY.ARTERIAL_W : CITY.STREET_W;
    const nameNS = AVENUES[Math.min(AVENUES.length - 1, i)];
    const nameEW = CROSS_STREETS[Math.min(CROSS_STREETS.length - 1, i)];
    addSegment(v, -G, v, G, w, arterial ? 'arterial' : 'street', 0, 0, nameNS);
    addSegment(-G, v, G, v, w, arterial ? 'arterial' : 'street', 0, 0, nameEW);
    streetLines.push({ axis: 'ns', v, w, arterial, name: nameNS });
    streetLines.push({ axis: 'ew', v, w, arterial, name: nameEW });
  }

  /* ---- 2. ring highway ---- */
  // A rounded rectangle traced anticlockwise: east straight, NE arc, north
  // straight, NW arc, and so on back to the start.
  const ringPts = [];
  const RH = CITY.RING_HALF, RR = CITY.RING_R;
  const straight = RH - RR;
  const cornerSteps = 12;
  const arcs = [
    { cx: straight, cz: straight, a0: 0 },              // NE
    { cx: -straight, cz: straight, a0: Math.PI / 2 },   // NW
    { cx: -straight, cz: -straight, a0: Math.PI },      // SW
    { cx: straight, cz: -straight, a0: Math.PI * 1.5 }, // SE
  ];
  ringPts.push({ x: RH, z: -straight });
  for (const arc of arcs) {
    for (let i = 0; i <= cornerSteps; i++) {
      const a = arc.a0 + (i / cornerSteps) * (Math.PI / 2);
      ringPts.push({ x: arc.cx + Math.cos(a) * RR, z: arc.cz + Math.sin(a) * RR });
    }
  }
  for (let i = 0; i < ringPts.length; i++) {
    const a = ringPts[i], b = ringPts[(i + 1) % ringPts.length];
    addSegment(a.x, a.z, b.x, b.z, CITY.RING_W, 'highway', CITY.RING_Y, CITY.RING_Y, 'I-671 Beltway');
  }

  /* ---- 3. ramps: eight interchanges ---- */
  const ramps = [];
  const rampAngles = [0, 45, 90, 135, 180, 225, 270, 315];
  rampAngles.forEach((deg, i) => {
    const a = (deg * Math.PI) / 180;
    // Find the ring point nearest this bearing.
    let best = null, bestD = Infinity;
    for (const p of ringPts) {
      const pa = Math.atan2(p.z, p.x);
      const d = Math.abs(((pa - a + Math.PI * 3) % TAU) - Math.PI);
      if (d < bestD) { bestD = d; best = p; }
    }
    const dirx = -Math.cos(a), dirz = -Math.sin(a);
    const len = 165;
    const ex = best.x + dirx * len, ez = best.z + dirz * len;
    // Two ramps per interchange (on and off), offset to either side.
    const perpx = -dirz, perpz = dirx;
    for (const side of [-1, 1]) {
      addSegment(best.x + perpx * side * 9, best.z + perpz * side * 9,
        ex + perpx * side * 5, ez + perpz * side * 5, 13, 'ramp', CITY.RING_Y, 0.05);
    }
    // Connector into the grid — snapped onto an actual street centreline.
    const snapLine = (v) => clamp(Math.round((v + G) / CITY.BLOCK) * CITY.BLOCK - G, -G, G);
    const gx = snapLine(ex);
    const gz = snapLine(ez);
    addSegment(ex, ez, Math.abs(dirx) > Math.abs(dirz) ? gx : ex, Math.abs(dirx) > Math.abs(dirz) ? ez : gz, 18, 'arterial', 0.05, 0);
    addSegment(Math.abs(dirx) > Math.abs(dirz) ? gx : ex, Math.abs(dirx) > Math.abs(dirz) ? ez : gz, gx, gz, 18, 'arterial', 0, 0);
    ramps.push({ exit: i + 1, ring: best, end: { x: ex, z: ez }, angle: a, name: CROSS_STREETS[(i * 2) % CROSS_STREETS.length] });
  });

  /* ---- 4. rasterise roads into the height + road grids ---- */
  function rasteriseSegment(s) {
    const halfW = s.w / 2;
    const minx = Math.min(s.ax, s.bx) - halfW - 4, maxx = Math.max(s.ax, s.bx) + halfW + 4;
    const minz = Math.min(s.az, s.bz) - halfW - 4, maxz = Math.max(s.az, s.bz) + halfW + 4;
    const i0 = clamp(toCell(minx), 0, gridN - 1), i1 = clamp(toCell(maxx), 0, gridN - 1);
    const j0 = clamp(toCell(minz), 0, gridN - 1), j1 = clamp(toCell(maxz), 0, gridN - 1);
    const dx = s.bx - s.ax, dz = s.bz - s.az;
    const len2 = dx * dx + dz * dz || 1;
    for (let j = j0; j <= j1; j++) {
      const wz = toWorld(j);
      for (let i = i0; i <= i1; i++) {
        const wx = toWorld(i);
        let t = ((wx - s.ax) * dx + (wz - s.az) * dz) / len2;
        t = clamp(t, 0, 1);
        const px = s.ax + dx * t, pz = s.az + dz * t;
        const d = Math.hypot(wx - px, wz - pz);
        const k = idx(i, j);
        if (d <= halfW) {
          const y = lerp(s.y0, s.y1, t);
          if (!roadFlag[k] || y > height[k]) height[k] = y;
          roadFlag[k] = 1;
          solid[k] = 0;
        }
      }
    }
  }
  for (const s of segments) rasteriseSegment(s);

  // Barriers: cells hugging an elevated road that are not themselves road.
  function rasteriseBarrier(s) {
    if (s.y0 < 1 && s.y1 < 1) return;
    const halfW = s.w / 2;
    const outer = halfW + 3.2;
    const i0 = clamp(toCell(Math.min(s.ax, s.bx) - outer), 0, gridN - 1);
    const i1 = clamp(toCell(Math.max(s.ax, s.bx) + outer), 0, gridN - 1);
    const j0 = clamp(toCell(Math.min(s.az, s.bz) - outer), 0, gridN - 1);
    const j1 = clamp(toCell(Math.max(s.az, s.bz) + outer), 0, gridN - 1);
    const dx = s.bx - s.ax, dz = s.bz - s.az;
    const len2 = dx * dx + dz * dz || 1;
    for (let j = j0; j <= j1; j++) {
      const wz = toWorld(j);
      for (let i = i0; i <= i1; i++) {
        const wx = toWorld(i);
        let t = clamp(((wx - s.ax) * dx + (wz - s.az) * dz) / len2, 0, 1);
        const d = Math.hypot(wx - (s.ax + dx * t), wz - (s.az + dz * t));
        const k = idx(i, j);
        if (d > halfW && d <= outer && !roadFlag[k]) solid[k] = 1;
      }
    }
  }
  for (const s of segments) rasteriseBarrier(s);

  // Everything outside the ring is off limits (water, embankment, scrub).
  for (let j = 0; j < gridN; j++) {
    for (let i = 0; i < gridN; i++) {
      const x = toWorld(i), z = toWorld(j);
      const k = idx(i, j);
      if (roadFlag[k]) continue;
      const inside = Math.abs(x) < RH - CITY.RING_W / 2 - 2 && Math.abs(z) < RH - CITY.RING_W / 2 - 2 &&
        (Math.hypot(Math.max(0, Math.abs(x) - straight), Math.max(0, Math.abs(z) - straight)) < RR - CITY.RING_W / 2 - 2);
      if (!inside) solid[k] = 1;
    }
  }

  /* ---- 5. visual road surfaces ---- */
  const roadMerger = new Merger();
  const texStreet = texMat(asphaltTexture('street'), { roughness: 0.95 });
  const texArterial = texMat(asphaltTexture('arterial'), { roughness: 0.95 });
  const texHighway = texMat(asphaltTexture('highway'), { roughness: 0.95 });
  const texRamp = texMat(asphaltTexture('ramp'), { roughness: 0.95 });
  for (const t of [texStreet, texArterial, texHighway, texRamp]) {
    t.map.wrapS = t.map.wrapT = THREE.RepeatWrapping;
  }
  const roadMatOf = { street: texStreet, arterial: texArterial, highway: texHighway, ramp: texRamp };
  const concreteM = texMat(concreteTexture(), { roughness: 0.95 });
  concreteM.map.wrapS = concreteM.map.wrapT = THREE.RepeatWrapping;
  const curbM = mat(0xb0b2ad, { roughness: 0.9 });
  const barrierM = mat(0xc3c5c0, { roughness: 0.85 });

  for (const s of segments) {
    const len = Math.hypot(s.bx - s.ax, s.bz - s.az);
    if (len < 0.5) continue;
    const cx = (s.ax + s.bx) / 2, cz = (s.az + s.bz) / 2;
    const cy = (s.y0 + s.y1) / 2;
    const ang = Math.atan2(s.bx - s.ax, s.bz - s.az);
    const material = roadMatOf[s.type] || texStreet;
    const pitch = Math.atan2(s.y1 - s.y0, len);
    // Road slab.
    _e.set(pitch, ang, 0, 'YXZ'); _q.setFromEuler(_e);
    _m.compose(_v.set(cx, cy + 0.03, cz), _q, _s.set(s.w, 0.22, len + 0.6));
    roadMerger.addGeometry(unitBox, material, _m, [1, len / (s.w * 1.2)]);

    if (s.type === 'highway' || s.type === 'ramp') {
      // Guard rails + jersey barriers along both edges.
      for (const side of [-1, 1]) {
        const ox = Math.cos(ang) * side * (s.w / 2 + 0.35);
        const oz = -Math.sin(ang) * side * (s.w / 2 + 0.35);
        _m.compose(_v.set(cx + ox, cy + 0.55, cz + oz), _q, _s.set(0.5, 0.95, len));
        roadMerger.addGeometry(unitBox, barrierM, _m);
      }
      if (s.type === 'highway') {
        _m.compose(_v.set(cx, cy + 0.5, cz), _q, _s.set(0.9, 0.9, len));
        roadMerger.addGeometry(unitBox, barrierM, _m);
      }
      // Piers holding the deck up.
      if (s.y0 > 1 || s.y1 > 1) {
        const steps = Math.max(1, Math.round(len / 26));
        for (let i = 0; i < steps; i++) {
          const t = (i + 0.5) / steps;
          const px = lerp(s.ax, s.bx, t), pz = lerp(s.az, s.bz, t);
          const py = lerp(s.y0, s.y1, t);
          // Skip where the ramp has come down to grade, or the pier cap ends up
          // sitting across the carriageway.
          if (py < 2.2) continue;
          mBox(roadMerger, concreteM, 2.4, py - 0.6, 2.4, px, (py - 0.6) / 2, pz, ang, [1, py / 3]);
          mBox(roadMerger, concreteM, s.w * 0.86, 0.6, 2.6, px, py - 0.55, pz, ang);
        }
      }
    } else {
      // Sidewalks + curbs on surface streets.
      for (const side of [-1, 1]) {
        const ox = Math.cos(ang) * side * (s.w / 2 + 1.6);
        const oz = -Math.sin(ang) * side * (s.w / 2 + 1.6);
        _e.set(0, ang, 0); _q.setFromEuler(_e);
        _m.compose(_v.set(cx + ox, 0.1, cz + oz), _q, _s.set(3.2, 0.28, len));
        roadMerger.addGeometry(unitBox, concreteM, _m, [1, len / 6]);
        _m.compose(_v.set(cx + Math.cos(ang) * side * (s.w / 2 + 0.05), 0.13, cz - Math.sin(ang) * side * (s.w / 2 + 0.05)), _q, _s.set(0.35, 0.34, len));
        roadMerger.addGeometry(unitBox, curbM, _m);
      }
    }
  }

  /* ---- 6. curbside job sites along the surface streets ---- */
  for (const line of streetLines) {
    const stepCount = Math.floor((G * 2) / 40);
    for (let i = 1; i < stepCount; i++) {
      const along = -G + i * 40 + rng.range(-8, 8);
      const side = rng.chance(0.5) ? 1 : -1;
      const off = (line.w / 2 - 2.4) * side;
      const p = line.axis === 'ns'
        ? { x: line.v + off, z: along, heading: side > 0 ? Math.PI : 0 }
        : { x: along, z: line.v + off, heading: side > 0 ? -Math.PI / 2 : Math.PI / 2 };
      if (Math.hypot(p.x, p.z) < 40) continue;
      roadNodes.push({ ...p, street: line.name, type: 'street' });
    }
  }
  // Shoulder spots on the beltway for the ugly highway calls.
  for (let i = 0; i < ringPts.length; i += 2) {
    const a = ringPts[i], b = ringPts[(i + 1) % ringPts.length];
    const ang = Math.atan2(b.x - a.x, b.z - a.z);
    const side = i % 4 === 0 ? 1 : -1;
    roadNodes.push({
      x: (a.x + b.x) / 2 + Math.cos(ang) * side * (CITY.RING_W / 2 - 3),
      z: (a.z + b.z) / 2 - Math.sin(ang) * side * (CITY.RING_W / 2 - 3),
      heading: ang + (side > 0 ? 0 : Math.PI), y: CITY.RING_Y,
      street: 'I-671 Beltway', type: 'highway',
    });
  }

  /* ---- 7. blocks: buildings, parking lots, parks ---- */
  const buildingMerger = new Merger();
  const propMerger = new Merger();
  const windowMats = ['glass', 'brick', 'tan', 'concrete', 'modern'].flatMap((style) =>
    [0, 1, 2].map((k) => ({ style, m: texMat(windowTexture(style, 1000 + k * 31), { roughness: 0.8 }) })));
  for (const wm of windowMats) { wm.m.map.wrapS = wm.m.map.wrapT = THREE.RepeatWrapping; }
  const roofM = mat(C.roofTar, { roughness: 1 });
  const trimM = mat(0x6d7075, { roughness: 0.8 });
  const awningM = mat(0x9c2f2f, { roughness: 0.9 });
  const lotM = mat(0x33353a, { roughness: 0.98 });
  const grassM = mat(0x4f7a3a, { roughness: 1 });

  const businesses = [];
  const blockHalf = CITY.BLOCK / 2 - CITY.STREET_W / 2 - 4.2;
  const occupied = [];

  function districtOf(x, z) {
    const r = Math.hypot(x, z);
    if (x > 180 && z < -180) return 'industrial';
    if (r < 150) return 'downtown';
    if (r < 300) return 'midtown';
    if (x > 330) return 'waterfront';
    return 'outer';
  }

  const shopSites = SHOP_DEFS.map((s) => ({ ...s }));

  for (let bx = -G + CITY.BLOCK / 2; bx < G; bx += CITY.BLOCK) {
    for (let bz = -G + CITY.BLOCK / 2; bz < G; bz += CITY.BLOCK) {
      const cxx = bx, czz = bz;
      if (Math.hypot(cxx, czz) > RH - 70) continue;
      // Leave room for the mechanic shops.
      const nearShop = shopSites.some((s) => Math.hypot(s.x - cxx, s.z - czz) < CITY.BLOCK * 0.8);
      if (nearShop) continue;
      const district = districtOf(cxx, czz);
      const roll = rng();

      if (district === 'downtown' && Math.hypot(cxx, czz) < 46) {
        // City hall park in the middle of town.
        mPlaneY(propMerger, grassM, blockHalf * 2, blockHalf * 2, cxx, 0.06, czz);
        for (let i = 0; i < 8; i++) addTree(propMerger, cxx + rng.range(-25, 25), czz + rng.range(-25, 25), rng);
        addFountain(propMerger, cxx, czz);
        continue;
      }
      if (roll < 0.08 && district !== 'downtown') {
        // Pocket park.
        mPlaneY(propMerger, grassM, blockHalf * 2, blockHalf * 2, cxx, 0.06, czz);
        for (let i = 0; i < 6; i++) addTree(propMerger, cxx + rng.range(-24, 24), czz + rng.range(-24, 24), rng);
        for (let i = 0; i < 3; i++) addBench(propMerger, cxx + rng.range(-20, 20), czz + rng.range(-20, 20), rng() * TAU);
        continue;
      }
      if (roll < 0.2) {
        // Surface parking lot — free real estate for illegally-parked cars.
        mPlaneY(propMerger, lotM, blockHalf * 2, blockHalf * 2, cxx, 0.07, czz);
        for (let i = -2; i <= 2; i++) {
          mBox(propMerger, mat(0xd8d9d4), blockHalf * 1.8, 0.02, 0.2, cxx, 0.09, czz + i * 11);
        }
        const cars = rng.int(2, 5);
        for (let i = 0; i < cars; i++) {
          addParkedCar(propMerger, cxx + rng.range(-22, 22), czz + rng.range(-24, 24), rng.chance(0.5) ? 0 : Math.PI, rng);
        }
        occupied.push({ x: cxx, z: czz, r: blockHalf });
        continue;
      }

      // Otherwise: a row of buildings around the block edge.
      const count = district === 'downtown' ? rng.int(1, 2) : rng.int(2, 4);
      for (let i = 0; i < count; i++) {
        const w = (blockHalf * 2) / count - 2;
        const ox = -blockHalf + w / 2 + i * (w + 2);
        const bxx = cxx + (rng.chance(0.5) ? ox : ox * 0.98);
        const bzz = czz + rng.range(-6, 6);
        const depth = blockHalf * rng.range(1.2, 1.9);
        let h;
        if (district === 'downtown') h = rng.range(45, 105);
        else if (district === 'midtown') h = rng.range(16, 42);
        else if (district === 'industrial') h = rng.range(8, 16);
        else if (district === 'waterfront') h = rng.range(10, 26);
        else h = rng.range(7, 15);
        const style = district === 'downtown' ? (rng.chance(0.6) ? 'glass' : 'modern')
          : district === 'industrial' ? 'concrete'
            : rng.chance(0.5) ? 'brick' : 'tan';
        const wm = windowMats.filter((m) => m.style === style)[rng.int(0, 2)];
        const name = `${rng.pick(BUSINESS_WORDS.a)} ${rng.pick(BUSINESS_WORDS.b)}`;
        addBuilding(buildingMerger, propMerger, {
          x: bxx, z: bzz, w: Math.min(w, 34), d: Math.min(depth, 40), h,
          material: wm.m, roofM, trimM, awningM, name, district, rng,
        });
        businesses.push({ name, x: bxx, z: bzz });
        occupied.push({ x: bxx, z: bzz, r: Math.max(w, depth) / 2 });
        // Footprint blocks driving.
        markSolidRect(bxx, bzz, Math.min(w, 34), Math.min(depth, 40));
      }
    }
  }

  function markSolidRect(x, z, w, d, rot = 0) {
    const r = Math.max(w, d) / 2 + 1;
    const i0 = clamp(toCell(x - r), 0, gridN - 1), i1 = clamp(toCell(x + r), 0, gridN - 1);
    const j0 = clamp(toCell(z - r), 0, gridN - 1), j1 = clamp(toCell(z + r), 0, gridN - 1);
    const cosR = Math.cos(-rot), sinR = Math.sin(-rot);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const dx = toWorld(i) - x, dz = toWorld(j) - z;
        const lx = dx * cosR - dz * sinR, lz = dx * sinR + dz * cosR;
        if (Math.abs(lx) <= w / 2 && Math.abs(lz) <= d / 2) {
          const k = idx(i, j);
          if (!roadFlag[k]) solid[k] = 1;
        }
      }
    }
  }

  /* ---- 8. mechanic shops ---- */
  const shops = [];
  for (const def of shopSites) {
    const g = addMechanicShop(buildingMerger, propMerger, def, rng);
    markSolidRect(def.x, def.z, 34, 24, def.rot);
    const fwd = new THREE.Vector3(Math.sin(def.rot), 0, Math.cos(def.rot));
    shops.push({
      id: def.id, name: def.name, kind: def.kind,
      x: def.x, z: def.z, rot: def.rot,
      drop: { x: def.x + fwd.x * 22, z: def.z + fwd.z * 22 },
    });
  }

  /* ---- 9. street furniture ---- */
  const lampLensM = mat(0xfff0c0, { emissive: 0xffe08a, emissiveIntensity: 0.2, roughness: 0.4 });
  const poleM = mat(0x3f444b, { metalness: 0.5, roughness: 0.6 });
  for (const line of streetLines) {
    for (let a = -G + 30; a < G; a += 60) {
      const side = ((a / 60) | 0) % 2 ? 1 : -1;
      const px = line.axis === 'ns' ? line.v + side * (line.w / 2 + 2.6) : a;
      const pz = line.axis === 'ns' ? a : line.v + side * (line.w / 2 + 2.6);
      if (Math.hypot(px, pz) > RH - 60) continue;
      addStreetLight(propMerger, px, pz, line.axis === 'ns' ? (side > 0 ? -Math.PI / 2 : Math.PI / 2) : (side > 0 ? Math.PI : 0), poleM, lampLensM);
      if (rng.chance(0.25)) addHydrant(propMerger, px + rng.range(-2, 2), pz + rng.range(-2, 2));
      if (rng.chance(0.2)) addTree(propMerger, px, pz, rng, 0.8);
      if (rng.chance(0.15)) addTrashCan(propMerger, px, pz + 3);
    }
  }
  // Traffic signals at the arterial intersections.
  for (const l1 of streetLines.filter((l) => l.axis === 'ns' && l.arterial)) {
    for (const l2 of streetLines.filter((l) => l.axis === 'ew' && l.arterial)) {
      if (Math.hypot(l1.v, l2.v) > RH - 80) continue;
      addTrafficLight(propMerger, l1.v, l2.v, l1.w, l2.w, poleM);
      addStreetNameSign(propMerger, l1.v, l2.v, l1.name, l2.name, poleM);
    }
  }

  /* ---- 10. highway signage ---- */
  const signMerger = new Merger();
  ramps.forEach((r, i) => {
    const exitNo = r.exit;
    const ang = Math.atan2(r.end.x - r.ring.x, r.end.z - r.ring.z);
    const alongAng = ang + Math.PI / 2;
    // Advance guide sign on a gantry over the deck, one before the exit.
    const gx = r.ring.x - Math.sin(alongAng) * 90;
    const gz = r.ring.z - Math.cos(alongAng) * 90;
    addGantrySign(signMerger, gx, gz, alongAng, [
      { text: r.name, size: 84 }, { text: 'EXIT ' + exitNo + '  —  1/2 MILE', size: 52 },
    ], exitNo);
    // Gore sign right at the ramp nose.
    addPostSign(signMerger, r.ring.x - Math.sin(alongAng) * 12, r.ring.z - Math.cos(alongAng) * 12,
      alongAng, highwaySignTexture([{ text: 'EXIT ' + exitNo, size: 92 }, { text: r.name, size: 54 }], { width: 512, height: 320 }), 5.5, 3.2, CITY.RING_Y + 1.6);
    // Interstate shield + speed limit further along.
    addPostSign(signMerger, r.ring.x - Math.sin(alongAng) * 150, r.ring.z - Math.cos(alongAng) * 150,
      alongAng, shieldTexture(671), 2.2, 2.2, CITY.RING_Y + 3.4);
    addPostSign(signMerger, r.ring.x - Math.sin(alongAng) * 200, r.ring.z - Math.cos(alongAng) * 200,
      alongAng, plainSignTexture('SPEED LIMIT', '55'), 2.0, 2.6, CITY.RING_Y + 3.2);
    if (i % 2 === 0) {
      addPostSign(signMerger, r.ring.x - Math.sin(alongAng) * 240, r.ring.z - Math.cos(alongAng) * 240,
        alongAng, highwaySignTexture([{ text: 'SKYVILLE', size: 74 }, { text: 'NEXT 4 EXITS', size: 48 }], { width: 512, height: 288 }), 5, 2.8, CITY.RING_Y + 2.4);
    }
  });
  // Mile markers all the way round.
  for (let i = 0; i < ringPts.length; i += 3) {
    const p = ringPts[i], q = ringPts[(i + 1) % ringPts.length];
    const ang = Math.atan2(q.x - p.x, q.z - p.z);
    addPostSign(signMerger, p.x + Math.cos(ang) * (CITY.RING_W / 2 + 1.2), p.z - Math.sin(ang) * (CITY.RING_W / 2 + 1.2),
      ang + Math.PI / 2, plainSignTexture('MILE', String(1 + (i / 3 | 0))), 0.7, 1.1, CITY.RING_Y + 1.6, 0.6);
  }

  /* ---- 11. ground, water, harbour ---- */
  const groundM = texMat(groundTexture(), { roughness: 1 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(CITY.HALF * 2 + 600, CITY.HALF * 2 + 600), groundM);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  group.add(ground);

  const waterM = mat(0x24506b, { roughness: 0.25, metalness: 0.3, transparent: true, opacity: 0.92 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(600, 2000), waterM);
  water.rotation.x = -Math.PI / 2;
  water.position.set(CITY.HALF + 180, -0.6, 0);
  group.add(water);
  // Piers and warehouses on the harbour side, visible from the beltway.
  for (let i = -3; i <= 3; i++) {
    mBox(propMerger, concreteM, 90, 1.4, 14, RH + 60, 0.7, i * 120);
    for (let k = 0; k < 5; k++) mCyl(propMerger, mat(0x4b4038), 1.2, 6, RH + 20 + k * 20, 1, i * 120 + 7);
  }

  buildingMerger.build(group);
  propMerger.build(group);
  signMerger.build(group);
  roadMerger.build(group, { castShadow: false });

  /* ---- 12. spawn points the player picks from ---- */
  // Every spawn sits on a street centreline (grid lines are at -440 + 80k) or
  // on the beltway deck, so nobody starts the shift inside a building.
  const snap = (v) => Math.round((v + G) / CITY.BLOCK) * CITY.BLOCK - G;
  const spawnPoints = [
    { id: 'yard', name: 'The Yard (company lot)', desc: 'Home base off Ironbridge Street.', x: snap(280), z: -270, heading: 0 },
    { id: 'downtown', name: 'Downtown — Meridian & 6th', desc: 'Towers, one-ways, and meter maids.', x: snap(40), z: 65, heading: 0 },
    { id: 'harbor', name: 'Harbor Point', desc: 'Docks, potholes, and salt air.', x: snap(360), z: 175, heading: Math.PI },
    { id: 'northgate', name: 'Northgate Pike', desc: 'Strip malls and big parking lots.', x: -35, z: snap(360), heading: Math.PI / 2 },
    { id: 'westside', name: 'Westside — Delgado Way', desc: 'Row houses, tight streets.', x: snap(-360), z: 25, heading: 0 },
    { id: 'beltway_n', name: 'I-671 Beltway (north)', desc: 'Start up on the highway deck.', x: 0, z: RH - 7, heading: Math.PI / 2, y: CITY.RING_Y },
    { id: 'beltway_s', name: 'I-671 Beltway (south)', desc: 'Southbound shoulder near Exit 5.', x: 0, z: -RH + 7, heading: -Math.PI / 2, y: CITY.RING_Y },
    { id: 'impound', name: 'Municipal Impound', desc: 'South end, next to the fence.', x: snap(-200), z: -345, heading: 0 },
  ];
  // Nudge anything that still landed on something solid onto clear ground.
  for (const s of spawnPoints) {
    if (!s.y && solid[idx(clamp(toCell(s.x), 0, gridN - 1), clamp(toCell(s.z), 0, gridN - 1))]) {
      const node = roadNodes.reduce((best, n) => {
        const d = (n.x - s.x) ** 2 + (n.z - s.z) ** 2;
        return (!best || d < best.d) ? { n, d } : best;
      }, null);
      if (node) { s.x = node.n.x; s.z = node.n.z; s.heading = node.n.heading; }
    }
  }

  /* ---- 13. sampling helpers ---- */
  function heightAt(x, z) {
    const fx = (x + CITY.HALF) / cell - 0.5, fz = (z + CITY.HALF) / cell - 0.5;
    const i = Math.floor(fx), j = Math.floor(fz);
    if (i < 0 || j < 0 || i >= gridN - 1 || j >= gridN - 1) return 0;
    const tx = fx - i, tz = fz - j;
    const h00 = height[idx(i, j)], h10 = height[idx(i + 1, j)];
    const h01 = height[idx(i, j + 1)], h11 = height[idx(i + 1, j + 1)];
    return lerp(lerp(h00, h10, tx), lerp(h01, h11, tx), tz);
  }
  function isSolid(x, z) {
    const i = toCell(x), j = toCell(z);
    if (i < 0 || j < 0 || i >= gridN || j >= gridN) return true;
    return solid[idx(i, j)] === 1;
  }
  function isRoad(x, z) {
    const i = toCell(x), j = toCell(z);
    if (i < 0 || j < 0 || i >= gridN || j >= gridN) return false;
    return roadFlag[idx(i, j)] === 1;
  }

  /* ---- 14. minimap ---- */
  const mapCanvas = makeCanvas(1024, 1024);
  {
    const x = mapCanvas.getContext('2d');
    const S = 1024 / (CITY.HALF * 2);
    const tx = (wx) => (wx + CITY.HALF) * S;
    const tz = (wz) => (CITY.HALF - wz) * S;
    x.fillStyle = '#171a1f'; x.fillRect(0, 0, 1024, 1024);
    x.fillStyle = '#1e2937';
    x.fillRect(tx(RH + 40), 0, 1024, 1024);
    for (const s of segments) {
      x.strokeStyle = s.type === 'highway' ? '#c8a13a' : s.type === 'ramp' ? '#9c7f2f' : s.type === 'arterial' ? '#6d747f' : '#4a5058';
      x.lineWidth = Math.max(1.5, s.w * S * 0.9);
      x.beginPath(); x.moveTo(tx(s.ax), tz(s.az)); x.lineTo(tx(s.bx), tz(s.bz)); x.stroke();
    }
    for (const shop of shops) {
      x.fillStyle = '#3fbf6f';
      x.beginPath(); x.arc(tx(shop.x), tz(shop.z), 8, 0, TAU); x.fill();
      x.fillStyle = '#d7ffe6'; x.font = 'bold 15px Arial'; x.textAlign = 'center';
      x.fillText(shop.name.replace(/ (Auto|Brothers|Point|Tire|Collision|Municipal|Truck).*/, ''), tx(shop.x), tz(shop.z) - 12);
    }
  }

  const city = {
    group, segments, ramps, shops, spawnPoints, roadNodes, businesses,
    streetLines, mapCanvas, ringPts,
    heightAt, isSolid, isRoad,
    bounds: CITY.HALF,
    lampLensM, windowMats,
    nearestRoadNode(x, z, filter) {
      let best = null, bd = Infinity;
      for (const n of roadNodes) {
        if (filter && !filter(n)) continue;
        const d = (n.x - x) ** 2 + (n.z - z) ** 2;
        if (d < bd) { bd = d; best = n; }
      }
      return best;
    },
    randomJobSite(rng2, kind = 'street') {
      const pool = roadNodes.filter((n) => (kind === 'any' ? true : n.type === kind));
      return pool[Math.floor(rng2() * pool.length)] || roadNodes[0];
    },
    setNight(isNight) {
      lampLensM.emissiveIntensity = isNight ? 2.2 : 0.15;
      lampLensM.color.setHex(isNight ? 0xfff3d0 : 0xdedbd0);
    },
  };
  return city;
}

/* --------------------------------------------------------------- prop parts */

function addBuilding(bm, pm, o) {
  const { x, z, w, d, h, material, roofM, trimM, awningM, name, district, rng } = o;
  // One texture repeat covers ~26 m of wall, so windows land on believable
  // 3-4 m floor spacing instead of a dense grid of dots.
  mBox(bm, material, w, h, d, x, h / 2, z, 0, [w / 26, h / 24]);
  // Roof slab + parapet + rooftop clutter.
  mBox(bm, roofM, w + 0.4, 0.5, d + 0.4, x, h + 0.2, z);
  for (const s of [-1, 1]) {
    mBox(bm, trimM, w + 0.5, 1.0, 0.5, x, h + 0.6, z + s * (d / 2 + 0.1));
    mBox(bm, trimM, 0.5, 1.0, d + 0.5, x + s * (w / 2 + 0.1), h + 0.6, z);
  }
  if (h > 20) {
    mBox(bm, trimM, w * 0.3, 2.4, d * 0.3, x + w * 0.2, h + 1.4, z - d * 0.2);
    mBox(bm, trimM, 2, 1.4, 2, x - w * 0.25, h + 1.0, z + d * 0.2);
  } else {
    mBox(bm, trimM, 2.2, 1.2, 1.6, x + w * 0.2, h + 0.9, z);
    mBox(bm, trimM, 1.2, 0.8, 1.2, x - w * 0.25, h + 0.7, z - d * 0.2);
  }
  // Ground floor: storefront glass, awning, and a lit sign.
  const frontZ = z + d / 2 + 0.05;
  mBox(bm, mat(0x1b2732, { roughness: 0.3, metalness: 0.2 }), w * 0.86, 3.2, 0.2, x, 1.8, frontZ);
  mBox(bm, awningM, w * 0.9, 0.24, 1.6, x, 3.9, frontZ + 0.7);
  const signM = texMat(signTexture(name, district === 'industrial' ? '#2c3138' : '#1b2430',
    '#f5f2e8', district === 'downtown' ? 'SUITE 100' : ''), { emissive: 0x222222 });
  mBox(bm, signM, Math.min(w * 0.8, 9), 1.7, 0.16, x, 5.2, frontZ + 0.1);
  // Door + stoop
  mBox(bm, mat(0x2c2016), 1.4, 2.6, 0.16, x - w * 0.3, 1.3, frontZ + 0.06);
  mBox(bm, mat(0xa8a9a4), 2.2, 0.2, 1.2, x - w * 0.3, 0.1, frontZ + 0.7);
  if (rng.chance(0.4)) {
    // Fire escape on the side.
    for (let i = 1; i * 4 < h; i++) {
      mBox(pm, mat(0x33383f, { metalness: 0.6 }), 0.2, 0.2, d * 0.5, x - w / 2 - 0.6, i * 4, z);
      mBox(pm, mat(0x33383f, { metalness: 0.6 }), 1.6, 0.12, d * 0.5, x - w / 2 - 0.8, i * 4 - 0.1, z);
    }
  }
}

function addMechanicShop(bm, pm, def, rng) {
  const { x, z, rot, name, kind } = def;
  const shellM = mat(kind === 'impound' ? 0x8a8d86 : 0xb8bcbb, { roughness: 0.9 });
  const roofM = mat(0x4a4e54, { roughness: 1 });
  const doorM = mat(0x5d646c, { roughness: 0.7, metalness: 0.3 });
  const W = 34, D = 22, H = 8.5;
  mBox(bm, shellM, W, H, D, x, H / 2, z, rot, [W / 26, H / 20]);
  mBox(bm, roofM, W + 1, 0.7, D + 1, x, H + 0.3, z, rot);
  const fwd = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot));
  const right = new THREE.Vector3(Math.cos(rot), 0, -Math.sin(rot));
  // Three roll-up bay doors with tracks.
  for (let i = -1; i <= 1; i++) {
    const px = x + fwd.x * (D / 2 + 0.1) + right.x * i * 9.5;
    const pz = z + fwd.z * (D / 2 + 0.1) + right.z * i * 9.5;
    mBox(bm, doorM, 7.4, 5.6, 0.3, px, 2.8, pz, rot);
    for (let k = 0; k < 7; k++) mBox(bm, mat(0x4d545c), 7.4, 0.1, 0.36, px, 0.5 + k * 0.8, pz, rot);
    mBox(bm, mat(0x2f3238), 8.2, 0.4, 0.5, px, 5.8, pz, rot);
  }
  // Sign board over the doors.
  const sm = texMat(signTexture(name, '#14203a', '#f6f7f3', '24 HOUR DROP · KEYS IN THE BOX'), { emissive: 0x1a1a1a });
  mBox(bm, sm, 22, 3.4, 0.4, x + fwd.x * (D / 2 + 0.5), H + 1.6, z + fwd.z * (D / 2 + 0.5), rot);
  // Apron, drop-off box, junk on the lot.
  mPlaneY(pm, mat(0x3a3d42, { roughness: 1 }), 46, 26, x + fwd.x * 20, 0.05, z + fwd.z * 20, rot);
  mBox(pm, mat(0xd8b02a), 0.6, 1.2, 0.6, x + fwd.x * 14 + right.x * 12, 0.6, z + fwd.z * 14 + right.z * 12, rot);
  for (let i = 0; i < 4; i++) {
    const px = x + fwd.x * (10 + rng.range(0, 18)) + right.x * rng.range(-16, 16);
    const pz = z + fwd.z * (10 + rng.range(0, 18)) + right.z * rng.range(-16, 16);
    if (rng.chance(0.6)) addParkedCar(pm, px, pz, rot + rng.range(-0.3, 0.3), rng, true);
    else addTireStack(pm, px, pz, rng);
  }
  mBox(pm, mat(0x2b6a3f), 3, 2, 6, x - fwd.x * (D / 2 + 3), 1, z - fwd.z * (D / 2 + 3), rot); // dumpster
  return null;
}

const PARKED_POOL = ['civia', 'corsair', 'sprite', 'ranger', 'haul150', 'cargo250', 'accolade', 'rove', 'cab', 'estate', 'pip', 'trek'];
function addParkedCar(merger, x, z, heading, rng, junk = false) {
  const id = PARKED_POOL[Math.floor(rng() * PARKED_POOL.length)];
  const v = buildVehicle(id, { seed: Math.floor(rng() * 1e6), flatTires: junk && rng.chance(0.5) ? ['FL'] : null });
  v.position.set(x, 0, z);
  v.rotation.y = heading;
  merger.addObject(v);
}

function addTireStack(merger, x, z, rng) {
  const tm = mat(C.tire, { roughness: 0.95 });
  const n = 3 + Math.floor(rng() * 3);
  for (let i = 0; i < n; i++) mCyl(merger, tm, 0.36, 0.22, x, 0.11 + i * 0.22, z);
}

function addTree(merger, x, z, rng, scale = 1) {
  const trunkM = mat(0x5a4632, { roughness: 1 });
  const leafM = mat(0x38632c, { roughness: 1 });
  const h = rng.range(3.4, 6) * scale;
  mCyl(merger, trunkM, 0.22 * scale, h, x, h / 2, z);
  mBox(merger, leafM, 3.2 * scale, 2.4 * scale, 3.2 * scale, x, h + 0.9 * scale, z, rng() * TAU);
  mBox(merger, leafM, 2.2 * scale, 1.8 * scale, 2.2 * scale, x, h + 2.1 * scale, z, rng() * TAU);
}

function addBench(merger, x, z, rot) {
  const wood = mat(0x6b4a2c, { roughness: 1 });
  const iron = mat(0x2c2f34, { metalness: 0.4 });
  mBox(merger, wood, 1.8, 0.1, 0.5, x, 0.5, z, rot);
  mBox(merger, wood, 1.8, 0.5, 0.1, x - Math.sin(rot) * 0.22, 0.75, z - Math.cos(rot) * 0.22, rot);
  mBox(merger, iron, 0.1, 0.5, 0.5, x, 0.25, z, rot);
}

function addFountain(merger, x, z) {
  const stone = mat(0xb9bab5, { roughness: 0.9 });
  const water = mat(0x3d7fa6, { roughness: 0.2, metalness: 0.3 });
  mCyl(merger, stone, 6, 1, x, 0.5, z);
  mCyl(merger, water, 5.4, 0.2, x, 0.95, z);
  mCyl(merger, stone, 1.2, 3, x, 1.5, z);
  mCyl(merger, stone, 2.4, 0.4, x, 2.6, z);
}

function addStreetLight(merger, x, z, rot, poleM, lensM) {
  mCyl(merger, poleM, 0.13, 8, x, 4, z);
  const dx = Math.sin(rot) * 1.6, dz = Math.cos(rot) * 1.6;
  mBox(merger, poleM, 0.16, 0.16, 3.2, x + dx, 7.9, z + dz, rot);
  mBox(merger, lensM, 0.5, 0.2, 1.1, x + dx * 1.6, 7.7, z + dz * 1.6, rot);
  mBox(merger, poleM, 0.6, 0.14, 1.3, x + dx * 1.6, 7.86, z + dz * 1.6, rot);
}

function addHydrant(merger, x, z) {
  const m = mat(0xc0392b, { roughness: 0.8 });
  mCyl(merger, m, 0.16, 0.7, x, 0.35, z);
  mCyl(merger, m, 0.2, 0.12, x, 0.74, z);
  mBox(merger, m, 0.5, 0.14, 0.14, x, 0.5, z);
}

function addTrashCan(merger, x, z) {
  mCyl(merger, mat(0x2f4c34, { roughness: 0.9 }), 0.32, 0.9, x, 0.45, z);
  mCyl(merger, mat(0x22331f), 0.34, 0.08, x, 0.94, z);
}

function addTrafficLight(merger, x, z, w1, w2, poleM) {
  for (const [sx, sz] of [[1, 1], [-1, -1]]) {
    const px = x + sx * (w1 / 2 + 2.4), pz = z + sz * (w2 / 2 + 2.4);
    mCyl(merger, poleM, 0.14, 6.4, px, 3.2, pz);
    const rot = Math.atan2(-sx, -sz);
    mBox(merger, poleM, 0.14, 0.14, 4.4, px - Math.sin(rot) * -2.2, 6.2, pz - Math.cos(rot) * -2.2, rot);
    const hx = px + Math.sin(rot) * 4.2, hz = pz + Math.cos(rot) * 4.2;
    mBox(merger, mat(0x1d2024), 0.5, 1.4, 0.4, hx, 5.4, hz, rot);
    mBox(merger, lightMat(0xd0362a, 1.1), 0.3, 0.3, 0.44, hx, 5.85, hz, rot);
    mBox(merger, lightMat(0xdcb02a, 0.25), 0.3, 0.3, 0.44, hx, 5.42, hz, rot);
    mBox(merger, lightMat(0x33a852, 0.25), 0.3, 0.3, 0.44, hx, 4.99, hz, rot);
  }
}

function addStreetNameSign(merger, x, z, nameNS, nameEW, poleM) {
  const px = x + 12, pz = z + 12;
  mCyl(merger, poleM, 0.08, 4.4, px, 2.2, pz);
  const t1 = texMat(signTexture(nameEW, '#0d5c33', '#f4f6f2'));
  const t2 = texMat(signTexture(nameNS, '#0d5c33', '#f4f6f2'));
  mBox(merger, t1, 3.2, 0.7, 0.08, px, 4.3, pz, 0);
  mBox(merger, t2, 0.08, 0.7, 3.2, px, 3.5, pz, 0);
}

function addGantrySign(merger, x, z, rot, lines, exitNo) {
  const steelM = mat(0x767c84, { metalness: 0.6, roughness: 0.5 });
  const y = CITY.RING_Y;
  const half = CITY.RING_W / 2 + 2;
  const right = { x: Math.cos(rot), z: -Math.sin(rot) };
  for (const s of [-1, 1]) {
    mCyl(merger, steelM, 0.28, 8.5, x + right.x * half * s, y + 4.2, z + right.z * half * s);
  }
  mBox(merger, steelM, half * 2 + 1.2, 0.4, 0.4, x, y + 8.2, z, rot);
  mBox(merger, steelM, half * 2 + 1.2, 0.4, 0.4, x, y + 7.0, z, rot);
  const tex = highwaySignTexture(lines, { exit: exitNo });
  mBox(merger, texMat(tex, { emissive: 0x0c2c1c }), 9.5, 4.6, 0.25, x, y + 5.6, z, rot);
}

function addPostSign(merger, x, z, rot, tex, w, h, y, poleR = 0.09) {
  const poleM = mat(0x8b9097, { metalness: 0.5, roughness: 0.6 });
  mCyl(merger, poleM, poleR, y, x, y / 2, z);
  mBox(merger, texMat(tex, { emissive: 0x1a1a1a }), w, h, 0.14, x, y, z, rot);
}
