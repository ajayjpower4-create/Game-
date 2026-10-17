/* Pavement markings and drainage channels, drawn point by point like a duct
 * run: fire lanes with their stencils, painted fire-lane and no-parking
 * kerbs, solid, double and dashed lines, stop bars, crosswalks, hatched
 * no-parking zones and slot-grated trench drains. Built in world space, on
 * the ground (x east, z toward the street). */

import * as THREE from 'three';
import { Builder } from './builder.js';
import * as M from './materials.js';
import { RUN_BY_ID } from '../catalog.js';

const Y = 0.235;   // just over the asphalt (bay lines sit at 0.21)

/* ------------------------------------------------------------ stencils */

const stencils = new Map();
/**
 * Paint letters as a material: white glyphs on a clear canvas, tinted by the
 * paint colour. `aspect` is the shape of the patch they are laid on (long
 * over tall), so the letters keep their proportions. Lines split on \n.
 */
export function stencilMat(text, hex = '#f4f2ea', { aspect = 4, weight = 900 } = {}) {
  const key = `${text}|${hex}|${aspect.toFixed(2)}`;
  if (stencils.has(key)) return stencils.get(key);
  const lines = String(text || ' ').toUpperCase().split('\n');
  const lh = aspect > 8 ? 96 : 192;
  const c = document.createElement('canvas');
  c.height = lh * lines.length;
  c.width = Math.min(4096, Math.max(64, Math.round(c.height * aspect)));
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  lines.forEach((ln, i) => {
    g.save();
    g.font = `${weight} ${Math.round(lh * 0.86)}px "Arial Narrow", "Roboto Condensed", Arial, Helvetica, sans-serif`;
    const w = Math.max(1, g.measureText(ln).width);
    g.translate(c.width / 2, lh * (i + 0.5) + lh * 0.04);
    // Fit the line across, squeezing (never stretching) the letters.
    g.scale(Math.min(1.6, (c.width * 0.96) / w), 1);
    g.fillText(ln, 0, 0);
    g.restore();
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  // Blended rather than alpha-tested: tested letters thin out and vanish in
  // the smaller mipmaps, so lettering would disappear a little way off.
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(hex), map: t, transparent: true, alphaTest: 0.02, depthWrite: false, roughness: 0.65,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
  });
  stencils.set(key, m);
  return m;
}

/**
 * A flat patch on the ground centred at (cx, cz): `L` long in the direction
 * (fx, fz) — the top of any lettering on it — and `A` across. UVs 0..1.
 */
export function flat(B, mat, cx, cz, fx, fz, L, A, y = Y) {
  const rx = -fz;
  const rz = fx;
  const p = (s, t) => [cx + rx * s * A / 2 + fx * t * L / 2, y, cz + rz * s * A / 2 + fz * t * L / 2];
  B.quad(mat, p(-1, -1), p(1, -1), p(1, 1), p(-1, 1), [0, 0, 1, 0, 1, 1, 0, 1]);
}

/* ------------------------------------------------------------ lines */

const dirOf = (a, b) => {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const L = Math.hypot(dx, dz) || 1;
  return [dx / L, dz / L, L];
};

/** A painted strip along a polyline, each leg run on past its ends to close the corners. */
function strip(B, mat, pts, w, { closed = false, y = Y, uvAlong = 0 } = {}) {
  const P = closed ? [...pts, pts[0]] : pts;
  for (let i = 0; i < P.length - 1; i++) {
    const [fx, fz, L] = dirOf(P[i], P[i + 1]);
    const ext = w / 2;
    const cx = (P[i][0] + P[i + 1][0]) / 2;
    const cz = (P[i][1] + P[i + 1][1]) / 2;
    if (uvAlong) {
      // Texture repeating along the strip (u across, v along, in feet × uvAlong).
      const rx = -fz;
      const rz = fx;
      const len = L + (closed ? ext * 2 : (i === 0 ? 0 : ext) + (i === P.length - 2 ? 0 : ext));
      const p = (s, t) => [cx + rx * s * w / 2 + fx * t * len / 2, y, cz + rz * s * w / 2 + fz * t * len / 2];
      B.quad(mat, p(-1, -1), p(1, -1), p(1, 1), p(-1, 1), [0, 0, 1, 0, 1, len * uvAlong, 0, len * uvAlong]);
    } else flat(B, mat, cx, cz, fx, fz, L + ext * 2, w, y);
  }
}

/** The polyline moved sideways by d (right of the direction of travel is +). */
function offsetLine(pts, d) {
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const [f0x, f0z] = dirOf(i ? a : p, i ? p : b);
    const [f1x, f1z] = dirOf(i < pts.length - 1 ? p : a, i < pts.length - 1 ? b : p);
    let nx = -(f0z + f1z) / 2;
    let nz = (f0x + f1x) / 2;
    const n = Math.hypot(nx, nz) || 1;
    nx /= n;
    nz /= n;
    // Keep the offset true round a corner (mitre), within reason.
    const k = Math.min(3, 1 / Math.max(0.33, nx * -f1z + nz * f1x));
    return [p[0] + nx * d * k, p[1] + nz * d * k];
  });
}

/** Walk a polyline, calling fn(x, z, fx, fz) every `every` feet from `start`. */
function along(pts, every, start, fn) {
  let next = start;
  let run = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [fx, fz, L] = dirOf(pts[i], pts[i + 1]);
    while (next <= run + L) {
      const t = next - run;
      fn(pts[i][0] + fx * t, pts[i][1] + fz * t, fx, fz, i);
      next += every;
    }
    run += L;
  }
  return run;
}

/** Pieces of a polyline: [from, to] distances. */
function pieces(pts, ranges) {
  const out = [];
  for (const [s0, s1] of ranges) {
    const seg = [];
    let run = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [fx, fz, L] = dirOf(pts[i], pts[i + 1]);
      const a = Math.max(s0, run);
      const b = Math.min(s1, run + L);
      if (b > a) {
        const p0 = [pts[i][0] + fx * (a - run), pts[i][1] + fz * (a - run)];
        const p1 = [pts[i][0] + fx * (b - run), pts[i][1] + fz * (b - run)];
        if (!seg.length) seg.push(p0);
        seg.push(p1);
      }
      run += L;
    }
    if (seg.length > 1) out.push(seg);
  }
  return out;
}

function length(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}

/* ------------------------------------------------------------ kerbs */

/** A kerb along the line, painted, with lettering on both faces every so often. */
function paintedKerb(B, pts, hex, text) {
  const conc = M.kerb();
  const paint = M.painted(hex, 0.62);
  const w = 0.5;
  const h = 0.5;
  for (let i = 0; i < pts.length - 1; i++) {
    const [fx, fz, L] = dirOf(pts[i], pts[i + 1]);
    const cx = (pts[i][0] + pts[i + 1][0]) / 2;
    const cz = (pts[i][1] + pts[i + 1][1]) / 2;
    const rot = [0, Math.atan2(-fz, fx), 0];
    B.box(paint, L + w, h, w, cx, 0.2 + h / 2, cz, rot);
    // Concrete below the paint line (the gutter side stays bare).
    B.box(conc, L + w, 0.2, w + 0.02, cx, 0.1, cz, rot);
  }
  if (!text) return;
  const tl = Math.min(9, 0.42 * text.length);
  const mat = stencilMat(text, '#f4f2ea', { aspect: tl / 0.3 });
  const total = length(pts);
  const y0 = 0.27;
  const y1 = 0.6;
  along(pts, 30, Math.min(6, total / 2 - tl / 2), (x, z, fx, fz, i) => {
    // Only where the whole word fits on this leg.
    const a = pts[i];
    const b = pts[i + 1];
    const t0 = Math.hypot(x - a[0], z - a[1]);
    if (t0 + tl > Math.hypot(b[0] - a[0], b[1] - a[1])) return;
    const rx = -fz;
    const rz = fx;
    const o = w / 2 + 0.012;
    const s = [x, z];
    const e = [x + fx * tl, z + fz * tl];
    // Right face, reading from start to end; left face the other way.
    B.quad(mat, [s[0] + rx * o, y0, s[1] + rz * o], [e[0] + rx * o, y0, e[1] + rz * o], [e[0] + rx * o, y1, e[1] + rz * o], [s[0] + rx * o, y1, s[1] + rz * o], [0, 0, 1, 0, 1, 1, 0, 1]);
    B.quad(mat, [e[0] - rx * o, y0, e[1] - rz * o], [s[0] - rx * o, y0, s[1] - rz * o], [s[0] - rx * o, y1, s[1] - rz * o], [e[0] - rx * o, y1, e[1] - rz * o], [0, 0, 1, 0, 1, 1, 0, 1]);
  });
}

/* ------------------------------------------------------------ drains */

let GRATE = null;
/** Slotted steel grate, slots across the channel. */
function grateMat() {
  if (GRATE) return GRATE;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#8f969c';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#121314';
  for (let y = 4; y < 64; y += 16) g.fillRect(8, y, 48, 7);
  g.fillStyle = '#6d7379';
  g.fillRect(0, 0, 3, 64);
  g.fillRect(61, 0, 3, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  GRATE = new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0.6, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  return GRATE;
}

function trench(B, pts, w) {
  // Concrete haunch either side, the galvanised edge rails, the grate between.
  strip(B, M.concrete('#b9b6ae'), pts, w + 1.0, { y: Y - 0.01 });
  strip(B, M.metal('#9aa1a8', 0.45), pts, w + 0.16, { y: Y + 0.004 });
  strip(B, grateMat(), pts, w, { y: Y + 0.008, uvAlong: 2 });
  // End caps.
  for (const [p, q] of [[pts[0], pts[1]], [pts[pts.length - 1], pts[pts.length - 2]]]) {
    const [fx, fz] = dirOf(p, q);
    flat(B, M.metal('#5d646c', 0.5), p[0] - fx * 0.04, p[1] - fz * 0.04, fx, fz, 0.16, w + 0.16, Y + 0.012);
  }
}

/* ------------------------------------------------------------ zones */

/** Diagonal stripes across a closed outline. */
function hatch(B, mat, poly, gap, w) {
  const [ex, ez] = dirOf(poly[0], poly[1]);
  // Stripe direction: 45° to the first edge.
  const c = Math.SQRT1_2;
  const sx = ex * c - ez * c;
  const sz = ex * c + ez * c;
  const nx = -sz;
  const nz = sx;
  const ts = poly.map((p) => p[0] * nx + p[1] * nz);
  const t0 = Math.min(...ts);
  const t1 = Math.max(...ts);
  for (let t = t0 + gap / 2; t < t1; t += gap) {
    const xs = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const da = a[0] * nx + a[1] * nz - t;
      const db = b[0] * nx + b[1] * nz - t;
      if ((da < 0) === (db < 0)) continue;
      const k = da / (da - db);
      xs.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]);
    }
    xs.sort((p, q) => (p[0] * sx + p[1] * sz) - (q[0] * sx + q[1] * sz));
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const [fx, fz, L] = dirOf(xs[i], xs[i + 1]);
      if (L < 0.3) continue;
      flat(B, mat, (xs[i][0] + xs[i + 1][0]) / 2, (xs[i][1] + xs[i + 1][1]) / 2, fx, fz, L, w);
    }
  }
}

/* ------------------------------------------------------------ build */

/** Build one marking (an object of kind 'run' with a marking style). */
export function buildMark(o) {
  const B = new Builder();
  const spec = RUN_BY_ID[o.style] || {};
  const pts = (o.points || []).map((p) => [p.x, p.y]);
  if (pts.length < 2) return B;
  const color = o.color || spec.color || '#f4f2ea';
  const w = o.size || spec.size || 0.33;
  const paint = M.paint(color);
  const side = o.flip ? 1 : -1;
  switch (o.style) {
    case 'firelane': {
      strip(B, paint, pts, w);
      const text = o.text || spec.text || 'FIRE LANE';
      const tl = Math.min(16, 1.25 * text.length + 1);
      const th = 2.8;
      const mat = stencilMat(text, color, { aspect: tl / th });
      const total = length(pts);
      along(pts, 50, Math.min(12, total / 2), (x, z, fx, fz) => {
        // Beside the stripe, the tops of the letters toward it.
        const rx = -fz * side;
        const rz = fx * side;
        const off = w / 2 + 0.9 + th / 2;
        flat(B, mat, x + rx * off, z + rz * off, -rx, -rz, th, tl);
      });
      break;
    }
    case 'firecurb':
    case 'yellowcurb':
      paintedKerb(B, pts, color, o.style === 'firecurb' ? (o.text || spec.text) : '');
      break;
    case 'double': {
      for (const d of [-(w / 2 + 0.17), w / 2 + 0.17]) strip(B, paint, offsetLine(pts, d), w);
      break;
    }
    case 'dashed': {
      const total = length(pts);
      const ranges = [];
      for (let s = 0; s < total; s += 12) ranges.push([s, Math.min(total, s + 6)]);
      for (const seg of pieces(pts, ranges)) strip(B, paint, seg, w);
      break;
    }
    case 'crosswalk': {
      // Continental bars, two feet wide, across the walking line.
      along(pts, 4, 1, (x, z, fx, fz) => flat(B, paint, x, z, fx, fz, 2, w));
      break;
    }
    case 'hatch': {
      const poly = pts.length > 2 ? pts : [pts[0], pts[1], [pts[1][0] + 1, pts[1][1] + 1]];
      strip(B, paint, poly, w, { closed: true });
      hatch(B, paint, poly, 3, w * 1.5);
      break;
    }
    case 'trench':
      trench(B, pts, w);
      break;
    default:
      strip(B, paint, pts, w);
  }
  return B;
}
