/* What some building styles add to the plain box: a dealership's brand
 * portal and covered service drive, a school's entrance canopy and clock,
 * a house's porch, dormers and garage, an apartment block's balconies and
 * breezeway stairs. Each runs after the walls and roof, in the building's
 * own frame: x across the front from left to right, y up, the front (N)
 * face at z = +d/2. */

import * as THREE from 'three';
import { cylGeo } from './builder.js';
import * as M from './materials.js';
import { panelTexture } from './textures.js';
import { BUILDING_STYLES } from '../catalog.js';
import { roofMaterial, roofRise } from './buildings.js';

const PI = Math.PI;

/** A sign panel facing +z (front) at (x, y, z). */
function panel(B, mat, w, h, x, y, z) {
  const hw = w / 2;
  const hh = h / 2;
  B.quad(mat, [x - hw, y - hh, z], [x + hw, y - hh, z], [x + hw, y + hh, z], [x - hw, y + hh, z], [0, 0, 1, 0, 1, 1, 0, 1]);
}

function signMat(out, opts) {
  const tex = panelTexture(opts);
  const mat = M.signFace(tex);
  out.disposables.push(tex, mat);
  return mat;
}


/* ------------------------------------------------------------ house parts */

const q4 = (B, m, a, b, c, d, uv) => B.quad(m, a, b, c, d, uv);

/** The windows on a face, as the walls laid them out (see bay() in buildings.js). */
function windowsOn(b, H, face = 'N') {
  const grid = b.walls[face] || [];
  const cols = Math.max(1, (grid[0] || []).length);
  const len = face === 'N' || face === 'S' ? b.w : b.d;
  const cw = len / cols;
  const fh = H / Math.max(1, b.floors);
  const tall = fh > 18;
  const out = [];
  for (let r = 0; r < b.floors; r++) {
    const row = grid[Math.min(r, grid.length - 1)] || [];
    for (let c = 0; c < cols; c++) {
      if (row[c] !== 'window') continue;
      const w = Math.min(cw * 0.62, tall ? 10 : 8);
      const sill = tall ? 4 : fh * 0.3;
      const hgt = tall ? Math.min(fh * 0.55, fh - 8) : fh * 0.47;
      out.push({ s: (c + 0.5) * cw, w, y0: r * fh + sill, y1: r * fh + sill + hgt, floor: r, col: c });
    }
  }
  return out;
}

/** Louvred shutters either side of every front window. */
function shutters(B, b, H, hex) {
  const mat = M.painted(hex, 0.55);
  const rail = M.painted(hex, 0.75);
  const hz = b.d / 2;
  for (const win of windowsOn(b, H, 'N')) {
    const x = -b.w / 2 + win.s;
    const sw = Math.max(1.2, win.w * 0.38);
    const h = win.y1 - win.y0;
    for (const s of [-1, 1]) {
      const cx = x + s * (win.w / 2 + sw / 2 + 0.25);
      B.box(mat, sw, h, 0.14, cx, (win.y0 + win.y1) / 2, hz + 0.08);
      for (let k = 1; k < 9; k++) B.box(rail, sw - 0.25, 0.05, 0.06, cx, win.y0 + (h * k) / 9, hz + 0.17);
    }
  }
}

/** A chimney stack with a cap and two pots. */
function chimney(B, mat, x, z, y0, y1, w = 3.2, d = 2.4) {
  B.box(mat, w, y1 - y0, d, x, (y0 + y1) / 2, z);
  B.box(M.concrete('#a9a69e'), w + 0.5, 0.45, d + 0.5, x, y1 + 0.2, z);
  for (const s of [-0.6, 0.6]) B.add(cylGeo(0.3, 0.36, 1.1, 10), M.painted('#8a5a44', 0.8), { pos: [x + s, y1 + 0.95, z] });
}

/** A simple gabled roof over a rectangle centred at (cx, cz); eaves at y. */
function gableRoof(B, roofMat, wallMat, cx, cz, w, d, y, rise, alongX = true, e = 1.2) {
  const L = alongX ? w : d;
  const S = alongX ? d : w;
  const map = alongX ? (a, yy, c) => [cx + a, yy, cz + c] : (a, yy, c) => [cx + c, yy, cz - a];
  const hl = L / 2;
  const hs = S / 2;
  const slope = rise / hs;
  const ey = y - e * slope;
  const sl = Math.hypot(hs + e, rise + e * slope);
  q4(B, roofMat, map(-hl - e, ey, hs + e), map(hl + e, ey, hs + e), map(hl + e, y + rise, 0), map(-hl - e, y + rise, 0), [0, 0, L + 2 * e, 0, L + 2 * e, sl, 0, sl]);
  q4(B, roofMat, map(hl + e, ey, -hs - e), map(-hl - e, ey, -hs - e), map(-hl - e, y + rise, 0), map(hl + e, y + rise, 0), [0, 0, L + 2 * e, 0, L + 2 * e, sl, 0, sl]);
  const soffit = M.painted('#e6e3dc', 0.8);
  q4(B, soffit, map(-hl - e, y + rise - 0.35, 0), map(hl + e, y + rise - 0.35, 0), map(hl + e, ey - 0.35, hs + e), map(-hl - e, ey - 0.35, hs + e));
  q4(B, soffit, map(hl + e, y + rise - 0.35, 0), map(-hl - e, y + rise - 0.35, 0), map(-hl - e, ey - 0.35, -hs - e), map(hl + e, ey - 0.35, -hs - e));
  // Gable ends.
  const t1 = [map(hl, y, hs), map(hl, y, -hs), map(hl, y + rise, 0)];
  const t2 = [map(-hl, y, -hs), map(-hl, y, hs), map(-hl, y + rise, 0)];
  for (const t of [t1, t2]) q4(B, wallMat, t[0], t[1], t[2], t[2], [0, 0, S, 0, S / 2, rise, S / 2, rise]);
  const trim = M.painted('#f2f1ec', 0.6);
  for (const sd of [1, -1]) B.tube(trim, map(-hl - e, ey - 0.15, sd * (hs + e)), map(hl + e, ey - 0.15, sd * (hs + e)), 0.3, 6);
}

/** A gabled dormer on the front slope of a ridge-along-x roof. */
function dormer(B, b, H, x, dw, wallMat, roofMat) {
  const hs = b.d / 2;
  const rise = roofRise(b);
  const slope = rise / hs;
  const zf = hs * 0.52;
  const yRoof = H + rise - slope * zf;
  const y0 = yRoof - 0.3;
  const dh = Math.min(6.5, rise * 0.55);
  const y1 = y0 + dh;
  const zb = Math.max(0.5, (H + rise - y1) / slope);
  B.box(wallMat, dw, dh, zf - zb, x, (y0 + y1) / 2, (zf + zb) / 2);
  gableRoof(B, roofMat, wallMat, x, (zf + zb) / 2 + 0.4, dw, zf - zb + 0.8, y1, dw * 0.42, false, 0.6);
  // The window in its face.
  const ww = dw * 0.52;
  const wh = dh * 0.62;
  const wy = y0 + dh * 0.45;
  B.box(M.painted('#f4f4f0', 0.5), ww + 0.6, wh + 0.6, 0.12, x, wy, zf + 0.04);
  q4(B, M.glass(), [x - ww / 2, wy - wh / 2, zf + 0.12], [x + ww / 2, wy - wh / 2, zf + 0.12], [x + ww / 2, wy + wh / 2, zf + 0.12], [x - ww / 2, wy + wh / 2, zf + 0.12]);
  B.box(M.painted('#f4f4f0', 0.5), 0.12, wh, 0.1, x, wy, zf + 0.16);
}

/**
 * A porch across the front: a raised deck with steps, posts along its edge
 * and a roof — a lean-to off the wall (`shed`) or its own gable (`gable`).
 */
function porch(B, b, { x0, x1, depth = 8, top = 9.5, deck = 1.4, posts = 4, post = 'square', roof = 'shed', roofMat, postHex = '#f4f4f0', rail = true, pier = null }) {
  const hz = b.d / 2;
  const z0 = hz;
  const z1 = hz + depth;
  const w = x1 - x0;
  const cx = (x0 + x1) / 2;
  const wood = M.painted('#8a6a4a', 0.75);
  const white = M.painted(postHex, 0.55);
  // Deck, its skirt and the steps down in the middle.
  B.box(wood, w, 0.25, depth, cx, deck - 0.12, (z0 + z1) / 2);
  B.box(M.painted('#e9e6df', 0.7), w, deck - 0.25, 0.2, cx, (deck - 0.25) / 2, z1 - 0.1);
  const steps = Math.max(2, Math.round(deck / 0.6));
  for (let k = 0; k < steps; k++) {
    const h = deck - (k + 1) * (deck / steps);
    B.box(wood, 6, Math.max(0.15, deck / steps), 1.0, cx, h + deck / steps / 2, z1 + 0.5 + k * 1.0);
  }
  // Posts (on stone piers for a craftsman porch).
  const xs = [];
  for (let i = 0; i < posts; i++) xs.push(x0 + 0.6 + ((w - 1.2) * i) / (posts - 1));
  for (const x of xs) {
    const z = z1 - 0.6;
    if (pier) {
      B.box(pier, 2.0, 3.2, 2.0, x, deck + 1.6, z);
      B.add(new THREE.CylinderGeometry(0.42, 0.7, top - deck - 3.2, 4).rotateY(PI / 4), white, { pos: [x, deck + 3.2 + (top - deck - 3.2) / 2, z] });
    } else if (post === 'round') {
      B.add(cylGeo(0.42, 0.48, top - deck, 14), white, { pos: [x, (top + deck) / 2, z] });
      B.box(white, 1.3, 0.4, 1.3, x, deck + 0.2, z);
      B.box(white, 1.3, 0.4, 1.3, x, top - 0.2, z);
    } else {
      B.box(white, 0.6, top - deck, 0.6, x, (top + deck) / 2, z);
    }
  }
  // Railings between the posts, open at the steps.
  if (rail) {
    for (let i = 0; i < xs.length - 1; i++) {
      const a = xs[i];
      const c = xs[i + 1];
      if (cx > a && cx < c) continue;
      B.box(white, c - a, 0.25, 0.3, (a + c) / 2, deck + 3.0, z1 - 0.6);
      B.box(white, c - a, 0.2, 0.25, (a + c) / 2, deck + 0.5, z1 - 0.6);
      for (let x = a + 0.5; x < c - 0.3; x += 0.55) B.box(white, 0.12, 2.5, 0.12, x, deck + 1.75, z1 - 0.6);
    }
  }
  // Beam and roof.
  B.box(white, w + 0.6, 0.9, 0.7, cx, top + 0.45, z1 - 0.6);
  const mat = roofMat || M.roof('seam', '#33373c');
  if (roof === 'gable') {
    gableRoof(B, mat, M.painted(postHex, 0.6), cx, (z0 + z1) / 2 + 0.6, w + 1.2, depth + 1.2, top + 0.9, Math.min(5, w * 0.22), false, 0.8);
  } else {
    const ya = top + 2.4;
    const yb = top + 0.9;
    q4(B, mat, [x0 - 0.8, yb, z1 + 0.8], [x1 + 0.8, yb, z1 + 0.8], [x1 + 0.8, ya, z0], [x0 - 0.8, ya, z0], [0, 0, w, 0, w, depth, 0, depth]);
    q4(B, M.painted('#e6e3dc', 0.8), [x1 + 0.8, yb - 0.25, z1 + 0.8], [x0 - 0.8, yb - 0.25, z1 + 0.8], [x0 - 0.8, ya - 0.25, z0], [x1 + 0.8, ya - 0.25, z0]);
    B.box(white, w + 1.6, 0.5, 0.25, cx, yb - 0.1, z1 + 0.8);
  }
  // A ceiling light by the door.
  B.add(new THREE.CircleGeometry(0.4, 12).rotateX(PI / 2), M.lamp('#ffe6b8', 2.5), { pos: [cx, top - 0.05, (z0 + z1) / 2] });
}

/** A garage wing off one end: walls, a gabled roof and two panelled doors on the front. */
function garageWing(B, b, side, { gw = 24, gd = 26, h = 10, wallMat, roofMat, doors = 2, set = 3 }) {
  const hx = b.w / 2;
  const hz = b.d / 2;
  const cx = side * (hx + gw / 2);
  const zf = hz - set;
  const cz = zf - gd / 2;
  B.box(wallMat, gw, h, gd, cx, h / 2, cz);
  gableRoof(B, roofMat, wallMat, cx, cz, gw, gd, h, Math.min(7, gd * 0.25), true, 1.1);
  const dw = doors === 1 ? 16 : 9;
  for (let i = 0; i < doors; i++) {
    const x = cx + (doors === 1 ? 0 : (i - 0.5) * (dw + 2));
    const z = zf + 0.03;
    q4(B, M.doorPanel('#ecebe6'), [x - dw / 2, 0.1, z], [x + dw / 2, 0.1, z], [x + dw / 2, 7.6, z], [x - dw / 2, 7.6, z], [0, 0, dw, 0, dw, 7.5, 0, 7.5]);
    for (let k = 1; k < 4; k++) B.box(M.painted('#d6d5cf', 0.6), dw, 0.1, 0.06, x, k * 1.9, z + 0.04);
    // A row of small windows across the top panel.
    for (let j = 0; j < 4; j++) q4(B, M.glass(), [x - dw / 2 + 0.6 + j * (dw - 1.2) / 4, 6.3, z + 0.06], [x - dw / 2 + 0.6 + (j + 1) * (dw - 1.2) / 4 - 0.25, 6.3, z + 0.06], [x - dw / 2 + 0.6 + (j + 1) * (dw - 1.2) / 4 - 0.25, 7.2, z + 0.06], [x - dw / 2 + 0.6 + j * (dw - 1.2) / 4, 7.2, z + 0.06]);
    B.box(M.painted('#f4f4f0', 0.5), dw + 0.8, 0.5, 0.3, x, 7.85, z + 0.1);
  }
  // Driveway apron in front.
  B.box(M.concrete('#c7c4bc'), doors === 1 ? 20 : dw * 2 + 6, 0.08, 18, cx, 0.04, zf + 9);
  // Coach lights.
  for (const s of [-1, 1]) B.box(M.lamp('#ffd9a0', 2), 0.5, 0.8, 0.4, cx + s * (dw + 2.2), 8.6, zf + 0.3);
}

/* A flag that waves (the site animates anything carrying userData.flag). */
let FLAG_TEX = null;
function flagMat() {
  if (!FLAG_TEX) {
    const c = document.createElement('canvas');
    c.width = 190;
    c.height = 100;
    const g = c.getContext('2d');
    for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#b22234'; g.fillRect(0, (i * 100) / 13, 190, 100 / 13 + 0.5); }
    g.fillStyle = '#3c3b6e';
    g.fillRect(0, 0, 76, 54);
    g.fillStyle = '#ffffff';
    for (let r = 0; r < 9; r++) for (let k = 0; k < (r % 2 ? 5 : 6); k++) { g.beginPath(); g.arc(6 + k * 12.6 + (r % 2 ? 6.3 : 0), 4 + r * 5.6, 1.5, 0, PI * 2); g.fill(); }
    FLAG_TEX = new THREE.CanvasTexture(c);
    FLAG_TEX.colorSpace = THREE.SRGBColorSpace;
  }
  return new THREE.MeshStandardMaterial({ map: FLAG_TEX, roughness: 0.85, side: THREE.DoubleSide });
}

function flagpole(B, out, x, z, h) {
  B.add(cylGeo(0.12, 0.28, h, 10), M.metal('#d9dee2', 0.25), { pos: [x, h / 2, z] });
  B.add(new THREE.SphereGeometry(0.35, 10, 8), M.metal('#d6b45a', 0.3), { pos: [x, h + 0.25, z] });
  B.add(cylGeo(1.4, 1.6, 0.6, 16), M.concrete('#bdb9b1'), { pos: [x, 0.3, z] });
  const geo = new THREE.PlaneGeometry(8, 4.4, 16, 6).translate(4, 0, 0);
  const mat = flagMat();
  out.disposables.push(mat);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x + 0.15, h - 2.6, z);
  mesh.castShadow = true;
  mesh.userData.flag = { base: geo.attributes.position.array.slice(), phase: x * 0.13 };
  out.moving.push(mesh);
}

/** A round wall clock: white face, black hands set to ten past ten. */
function clock(B, x, y, z, r) {
  B.add(cylGeo(r + 0.25, r + 0.25, 0.4, 32).rotateX(PI / 2), M.painted('#2b2f36', 0.4), { pos: [x, y, z + 0.2] });
  B.add(new THREE.CircleGeometry(r, 32), M.plastic('#f6f5f0', 0.5), { pos: [x, y, z + 0.42] });
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * PI * 2;
    B.box(M.plastic('#1a1a1a', 0.5), 0.12, k % 3 ? 0.35 : 0.6, 0.04, x + Math.sin(a) * r * 0.82, y + Math.cos(a) * r * 0.82, z + 0.45, [0, 0, -a]);
  }
  B.box(M.plastic('#1a1a1a', 0.5), 0.16, r * 0.55, 0.05, x - Math.sin(PI / 3) * r * 0.27, y + Math.cos(PI / 3) * r * 0.27, z + 0.48, [0, 0, PI / 3]);
  B.box(M.plastic('#1a1a1a', 0.5), 0.12, r * 0.8, 0.05, x + Math.sin(PI / 3.5) * r * 0.38, y + Math.cos(PI / 3.5) * r * 0.38, z + 0.5, [0, 0, -PI / 3.5]);
}

/** A school's front: an entrance tower with the name and a clock, a canopy over the doors, the flag. */
function schoolFront(B, b, H, out, { tower = 26, canopy = 44, name = 'ELEMENTARY SCHOOL' } = {}) {
  const hz = b.d / 2;
  const wallMat = M.wall(b.cladding || 'brick', b.wall || '#c4a27a');
  const th = H + 14;
  B.box(wallMat, tower, th, 14, 0, th / 2, hz - 3);
  B.box(M.painted(b.band || '#1f4f9c', 0.35), tower + 1, 1.2, 15, 0, th + 0.6, hz - 3);
  // Glazed slot up the tower over the doors.
  q4(B, M.glass(), [-tower * 0.18, 12, hz + 4.02], [tower * 0.18, 12, hz + 4.02], [tower * 0.18, th - 9, hz + 4.02], [-tower * 0.18, th - 9, hz + 4.02]);
  const label = ((b.sign && b.sign.text) || b.name || name).toUpperCase();
  panel(B, signMat(out, { text: label, color: '#ffffff', bg: b.band || '#1f4f9c', aspect: (tower - 2) / 3.4, border: false }), tower - 2, 3.4, 0, th - 6.8, hz + 4.03);
  clock(B, 0, th - 3, hz + 4.0, 1.8);
  // Canopy over the entrance on slim columns.
  const cd = 14;
  const cy = Math.min(12, (H / Math.max(1, b.floors)) * 0.8);
  B.box(M.painted('#e9ecef', 0.45), canopy, 1.2, cd, 0, cy + 0.6, hz + cd / 2);
  B.box(M.painted(b.band || '#1f4f9c', 0.35), canopy + 0.3, 0.8, 0.4, 0, cy + 0.6, hz + cd + 0.2);
  for (const sx of [-1, 1]) for (const f of [0.35, 0.95]) B.add(cylGeo(0.4, 0.4, cy, 12), M.metal('#c9ced3', 0.3), { pos: [sx * canopy * 0.45, cy / 2, hz + cd * f] });
  for (let x = -canopy / 2 + 4; x < canopy / 2 - 2; x += 8) B.add(new THREE.CircleGeometry(0.4, 12).rotateX(PI / 2), M.lamp('#fff3d6', 2.5), { pos: [x, cy - 0.02, hz + cd / 2] });
  out.lights.push({ x: 0, y: cy - 0.5, z: hz + cd / 2, tx: 0, tz: hz + cd, color: '#ffe7c2', power: 500, range: 50, angle: 75, pool: 0.8 });
  flagpole(B, out, tower / 2 + 22, hz + 30, 30);
}

const EXTRAS = {
  /* A dealership: the tall brand portal framing the showroom doors, a flat
   * canopy over the service drive at the right-hand end, and a fascia band. */
  dealership(b, B, H, out) {
    const hx = b.w / 2;
    const hz = b.d / 2;
    const acm = M.painted(b.band || '#1f4f9c', 0.3);
    const silver = M.metal('#c9ced3', 0.3);
    // Portal: two piers and a deep header, standing proud of the glass.
    const pw = Math.min(36, b.w * 0.3);
    const ph = H + 9;
    const dep = 5;
    for (const s of [-1, 1]) B.box(acm, 3, ph, dep, s * (pw / 2 - 1.5), ph / 2, hz + dep / 2);
    B.box(acm, pw, 8, dep, 0, ph - 4, hz + dep / 2);
    // Soffit lights under the header.
    for (let x = -pw / 2 + 5; x < pw / 2 - 4; x += 5) B.add(new THREE.CircleGeometry(0.35, 12).rotateX(PI / 2), M.lamp('#fff1cc', 3), { pos: [x, ph - 8.02, hz + dep / 2] });
    out.lights.push({ x: 0, y: ph - 8.5, z: hz + dep / 2, tx: 0, tz: hz + 14, color: '#ffe7c2', power: 500, range: 60, angle: 70, pool: 0.8 });
    const name = ((b.sign && b.sign.text) || b.name || 'AUTO DEALER').toUpperCase();
    panel(B, signMat(out, { text: name, sub: 'NEW · CERTIFIED PRE-OWNED', color: '#ffffff', bg: b.band || '#1f4f9c', aspect: (pw - 2) / 6.2, border: false }), pw - 2, 6.2, 0, ph - 4, hz + dep + 0.03);
    // A silver fascia band along the top of the showroom glass.
    B.box(silver, b.w + 0.4, 1.4, 0.6, 0, H - 0.4, hz + 0.3);
    // Service drive: a canopy off the right-hand (east) end over a drive lane.
    const cw = Math.min(40, b.d * 0.6);
    const cd = 26;
    const ch = 15;
    const cx = hx + cd / 2;
    B.box(M.painted('#e9ecef', 0.4), cd, 2.2, cw, cx, ch + 1.1, 0);
    B.box(acm, cd + 0.4, 0.9, cw + 0.4, cx, ch + 2.0, 0);
    for (const sz of [-1, 1]) B.add(cylGeo(0.6, 0.6, ch, 14), silver, { pos: [hx + cd - 1.5, ch / 2, sz * (cw / 2 - 1.5)] });
    for (let z = -cw / 2 + 5; z < cw / 2 - 3; z += 8) {
      for (let x = hx + 5; x < hx + cd - 3; x += 8) {
        B.add(new THREE.CircleGeometry(0.4, 12).rotateX(PI / 2), M.lamp('#ffffff', 3), { pos: [x, ch - 0.02, z] });
      }
    }
    out.lights.push({ x: cx, y: ch - 0.5, z: 0, tx: cx, tz: 0, color: '#f4f7ff', power: 700, range: 60, angle: 80, pool: 1 });
    // The SERVICE sign on the canopy's outer edge, facing down the drive.
    const sm = signMat(out, { text: 'SERVICE', sub: 'DRIVE IN', color: '#ffffff', bg: '#1d2c44', aspect: (cw * 0.7) / 1.8, border: false });
    const X = cx + cd / 2 + 0.23;
    const sw = cw * 0.35;
    B.quad(sm, [X, ch + 0.2, sw], [X, ch + 0.2, -sw], [X, ch + 2.0, -sw], [X, ch + 2.0, sw], [0, 0, 1, 0, 1, 1, 0, 1]);
    // Painted drive lane with arrows under the canopy.
    B.box(M.painted('#3a3f45', 0.8), cd, 0.04, cw - 4, cx, 0.03, 0);
  },

  /* An elementary school: one long storey, the entrance tower, a canopy, the flag. */
  school(b, B, H, out) {
    schoolFront(B, b, H, out, { name: 'ELEMENTARY SCHOOL' });
  },

  /* A high school: three floors, the entrance tower, and the gym rising above the west wing. */
  highschool(b, B, H, out) {
    schoolFront(B, b, H, out, { tower: 34, canopy: 60, name: 'HIGH SCHOOL' });
    const wallMat = M.wall(b.cladding || 'brick', b.wall || '#a8654f');
    const gw = Math.min(120, b.w * 0.36);
    const gx = -b.w / 2 + gw / 2;
    const gh = 16;
    B.box(wallMat, gw, gh, b.d, gx, H + gh / 2, 0);
    // Clerestory glazing round the gym, under a metal fascia.
    for (const sd of [1, -1]) {
      const z = sd * (b.d / 2 + 0.05);
      const xa = gx - sd * (gw / 2 - 4);
      const xb = gx + sd * (gw / 2 - 4);
      q4(B, M.glass(), [xa, H + 8, z], [xb, H + 8, z], [xb, H + 13, z], [xa, H + 13, z]);
    }
    B.box(M.painted(b.band || '#7a1a1f', 0.35), gw + 0.6, 1.4, b.d + 0.6, gx, H + gh + 0.7, 0);
    B.box(M.roof('membrane', '#c9cdd2'), gw - 1, 0.1, b.d - 1, gx, H + gh + 0.05, 0);
    panel(B, signMat(out, { text: 'HOME OF THE EAGLES', color: '#ffffff', bg: b.band || '#7a1a1f', aspect: (gw * 0.6) / 3, border: false }), gw * 0.6, 3, gx, H + gh - 2, b.d / 2 + 0.06);
  },

  /* A modern farmhouse: white board-and-batten, a black metal porch across the
   * front, two dormers, black shutters, a chimney and a garage wing. */
  farmhouse(b, B, H, out) {
    const wallMat = M.wall(b.cladding || 'batten', b.wall || '#f3f2ee');
    const roofMat = roofMaterial(b);
    porch(B, b, { x0: -b.w / 2 + 2, x1: b.w / 2 - 2, depth: 8, top: Math.min(9.5, H / b.floors - 0.5), posts: 5, roof: 'shed', roofMat: M.roof('seam', '#2b2f36'), postHex: '#2b2f36', rail: false });
    if (b.w >= b.d) for (const x of [-b.w * 0.22, b.w * 0.22]) dormer(B, b, H, x, 7, wallMat, roofMat);
    shutters(B, b, H, '#1f2226');
    chimney(B, M.wall('brick', '#7d4a3a'), -b.w / 2 + 4, -b.d * 0.15, H - 6, H + roofRise(b) + 3);
    garageWing(B, b, 1, { gw: 24, gd: Math.min(28, b.d - 2), h: 10, wallMat, roofMat: M.roof('seam', '#2b2f36'), doors: 2 });
  },

  /* A colonial: symmetrical, shuttered, a pedimented portico on round columns, chimneys at both ends. */
  colonial(b, B, H, out) {
    const wallMat = M.wall(b.cladding || 'siding', b.wall || '#e6ddc9');
    const roofMat = roofMaterial(b);
    const pw = 12;
    porch(B, b, { x0: -pw / 2, x1: pw / 2, depth: 6, top: Math.min(10, H / b.floors), deck: 1.0, posts: 2, post: 'round', roof: 'gable', roofMat, rail: false });
    shutters(B, b, H, '#1f3a2c');
    if (b.w >= b.d) for (const x of [-b.w * 0.28, 0, b.w * 0.28]) dormer(B, b, H, x, 6, wallMat, roofMat);
    for (const s of [-1, 1]) chimney(B, M.wall('brick', '#8a4d3c'), s * (b.w / 2 - 1.6), 0, 0, H + roofRise(b) + 3, 4, 3.2);
    // Brick foundation band.
    B.box(M.wall('brick', '#8a4d3c'), b.w + 0.3, 1.6, b.d + 0.3, 0, 0.8, 0);
  },

  /* A ranch: long and low under a hipped roof, a brick front, a covered entry and an attached garage. */
  ranch(b, B, H, out) {
    shutters(B, b, H, '#3d434b');
    porch(B, b, { x0: -b.w * 0.15, x1: b.w * 0.1, depth: 6, top: H - 0.4, deck: 0.6, posts: 2, roof: 'shed', roofMat: roofMaterial(b), rail: false });
    garageWing(B, b, -1, { gw: 24, gd: b.d - 4, h: H, wallMat: M.wall(b.cladding || 'brick', b.wall || '#a0644d'), roofMat: roofMaterial(b), doors: 1, set: 1 });
    chimney(B, M.wall('brick', '#7d4a3a'), b.w * 0.25, -b.d * 0.1, H - 4, H + roofRise(b) + 2);
  },

  /* A craftsman bungalow: front-gabled, a deep porch on tapered columns over stone piers. */
  craftsman(b, B, H, out) {
    porch(B, b, { x0: -b.w / 2 + 1, x1: b.w / 2 - 1, depth: 9, top: H - 0.6, deck: 2.0, posts: 2, roof: 'gable', roofMat: roofMaterial(b), postHex: '#efe9dc', pier: M.wall('stone', '#9b9488') });
    shutters(B, b, H, '#5a3e2b');
    chimney(B, M.wall('stone', '#9b9488'), -b.w / 2 - 1.2, -b.d * 0.2, 0, H + roofRise(b) + 2, 3.6, 3);
    // Exposed rafter tails along both eaves.
    for (const s of [-1, 1]) for (let z = -b.d / 2 + 1; z < b.d / 2; z += 2) B.box(M.painted('#5a3e2b', 0.7), 1.4, 0.3, 0.25, s * (b.w / 2 + 0.9), H - 0.5, z, [0, 0, s * -0.55]);
  },

  /* Garden apartments: three floors either side of an open breezeway with its
   * stairs, balconies on the back, condensers on pads beside the building. */
  gardenapts(b, B, H, out) {
    const fh = H / b.floors;
    const grid = b.walls.N[0];
    const cols = grid.length;
    const cw = b.w / cols;
    const mid = Math.floor(cols / 2);
    const x0 = -b.w / 2 + mid * cw + 1.2;
    const x1 = x0 + cw - 2.4;
    const steel = M.painted('#3d434b', 0.5);
    const tread = M.concrete('#b4b2ab');
    // Switchback flights up the breezeway, landing at each floor.
    for (let f = 0; f < b.floors - 1; f++) {
      const y0 = f * fh;
      const half = fh / 2;
      const zA = b.d / 2 - 2;
      const zB = b.d / 2 - 12;
      for (const [ya, yb, xa, flip] of [[y0, y0 + half, x0 + 1.6, 1], [y0 + half, y0 + fh, x1 - 1.6, -1]]) {
        const n = 8;
        for (let k = 0; k < n; k++) {
          const t = (k + 0.5) / n;
          const z = flip > 0 ? zA + (zB - zA) * t : zB + (zA - zB) * t;
          B.box(tread, 3.2, 0.25, 1.3, xa, ya + (yb - ya) * t, z);
        }
        B.add(new THREE.CylinderGeometry(0.05, 0.05, Math.hypot(zA - zB, half), 6).rotateX(Math.atan2(zA - zB, half) * flip), steel, { pos: [xa + 1.6, (ya + yb) / 2 + 3, (zA + zB) / 2] });
      }
      B.box(tread, x1 - x0, 0.3, 3, (x0 + x1) / 2, y0 + half, b.d / 2 - 13.5);
    }
    // Balconies on the back: a slab, railings and a privacy screen per flat.
    const rails = M.painted('#2b2f36', 0.5);
    for (let f = 1; f < b.floors; f++) {
      for (let c = 0; c < cols; c += 2) {
        if (c === mid) continue;
        const x = -b.w / 2 + (c + 0.5) * cw;
        const y = f * fh;
        B.box(M.concrete('#cfccc4'), cw * 0.9, 0.5, 5, x, y - 0.25, -b.d / 2 - 2.5);
        B.box(rails, cw * 0.9, 0.18, 0.18, x, y + 3.4, -b.d / 2 - 4.9);
        for (let k = 0; k <= 10; k++) B.box(rails, 0.08, 3.4, 0.08, x - cw * 0.45 + (cw * 0.9 * k) / 10, y + 1.7, -b.d / 2 - 4.9);
      }
    }
    // Condensers on their pads along one end.
    for (let i = 0; i < b.floors * 2; i++) {
      const z = -b.d / 2 + 4 + i * 4.2;
      if (z > b.d / 2 - 3) break;
      B.box(M.concrete('#bdb9b1'), 3.4, 0.3, 3.4, b.w / 2 + 3, 0.15, z);
      B.box(M.painted('#d9dcdf', 0.45), 2.8, 2.6, 2.8, b.w / 2 + 3, 1.6, z);
      B.add(new THREE.CircleGeometry(1.1, 16).rotateX(-PI / 2), M.plastic('#2b2f36', 0.6), { pos: [b.w / 2 + 3, 2.92, z] });
    }
  },

  /* Podium apartments: shops on the ground floor, coloured accent panels on
   * the floors above, a cornice, and a roof terrace with a pergola. */
  podium(b, B, H, out) {
    const fh = H / b.floors;
    const hz = b.d / 2;
    const accents = [b.band || '#7a5a2e', '#3d434b', '#c9b79c'];
    // Vertical accent panels breaking up the upper facade.
    const n = Math.max(2, Math.round(b.w / 45));
    for (let i = 0; i < n; i++) {
      const x = -b.w / 2 + ((i + 0.5) * b.w) / n;
      B.box(M.wall('composite', accents[i % accents.length]), 9, H - fh, 0.5, x, fh + (H - fh) / 2, hz + 0.25);
    }
    // Cornice and a canopy over the shops.
    B.box(M.painted('#2b2f36', 0.4), b.w + 2, 1.6, b.d + 2, 0, H + 0.8 + 3.5, 0);
    B.box(M.painted('#2b2f36', 0.4), b.w, 0.6, 5, 0, fh - 1.6, hz + 2.5);
    // Roof terrace: decking, a pergola and planters.
    const tx = b.w * 0.25;
    B.box(M.wood('#8a6a4a'), 40, 0.3, 26, tx, H + 0.2, 0);
    for (const sx of [-18, 18]) for (const sz of [-11, 11]) B.box(M.painted('#2b2f36', 0.4), 0.6, 9, 0.6, tx + sx, H + 4.8, sz);
    for (let z = -12; z <= 12; z += 2) B.box(M.wood('#6b4f37'), 38, 0.35, 0.4, tx, H + 9.4, z);
    for (const sx of [-14, -4, 6, 16]) {
      B.box(M.concrete('#8f8e89'), 4, 2, 4, tx + sx, H + 1.3, 14);
      B.add(new THREE.IcosahedronGeometry(1.8, 1), M.leaves(1), { pos: [tx + sx, H + 3.3, 14], scale: [1, 0.8, 1] });
    }
  },
};

/** Add a style's extras, if it has any. Returns lights and disposables to merge. */
export function buildingExtras(b, B, H) {
  const out = { lights: [], disposables: [], moving: [] };
  const key = (BUILDING_STYLES[b.style] || {}).extras;
  if (key && EXTRAS[key]) EXTRAS[key](b, B, H, out);
  return out;
}

export { EXTRAS };
