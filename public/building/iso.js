/* Isometric drawing kit.
 *
 * The world is measured in feet: x runs east, y runs south toward the street,
 * z is up. The camera orbits freely — any yaw, a pitch from near-ground to
 * overhead, zoom and pan — so nothing here may assume a fixed viewpoint.
 *
 * Everything drawn is a prism (a box with a heading), a flat patch of ground,
 * or something glued to the side of a prism. */

/* Where a shadow lands, per foot of height. The sun sits up and to the left of
 * the world, so shadows fall down and to the right of the buildings. */
export const SUN = { dx: 0.72, dy: 0.46 };
const SUN_LEN = Math.hypot(SUN.dx, SUN.dy);
const SUN_N = { x: SUN.dx / SUN_LEN, y: SUN.dy / SUN_LEN };

export const DEG = Math.PI / 180;

export function makeCamera({ yaw = 45, pitch = 34, scale = 1, cx = 0, cy = 0, ox = 0, oy = 0 }) {
  const a = yaw * DEG;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const k = Math.sin(pitch * DEG);   // how much depth squashes vertically
  const kz = Math.cos(pitch * DEG);  // how much height rises on screen
  return {
    yaw, pitch, scale, k, kz, cx, cy, ox, oy,
    project(x, y, z = 0) {
      const dx = x - cx;
      const dy = y - cy;
      const rx = dx * ca - dy * sa;
      const ry = dx * sa + dy * ca;
      return [ox + rx * scale, oy + (ry * k - z * kz) * scale];
    },
    /** Screen point back to a world point on the plane at height z. */
    unproject(sx, sy, z = 0) {
      const rx = (sx - ox) / scale;
      const ry = ((sy - oy) / scale + z * kz) / k;
      return [cx + rx * ca + ry * sa, cy - rx * sa + ry * ca];
    },
    // Painter's-algorithm key: bigger means nearer the viewer, so draw last.
    depth(x, y) {
      return (x - cx) * sa + (y - cy) * ca;
    },
  };
}

/** True when a wall with this outward normal is turned toward the camera. */
export const facing = (cam, nx, ny) => cam.depth(cam.cx + nx, cam.cy + ny) > 0;

/* --------------------------------------------------------------- svg pieces */

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const attrs = (o) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => `${k}="${esc(v)}"`)
    .join(' ');

const pts = (cam, list) =>
  list.map((p) => cam.project(p[0], p[1], p[2] || 0).map((n) => n.toFixed(2)).join(',')).join(' ');

export function poly(cam, list, style = {}) {
  return `<polygon points="${pts(cam, list)}" ${attrs(style)}/>`;
}

export function line(cam, a, b, style = {}) {
  const p1 = cam.project(a[0], a[1], a[2] || 0);
  const p2 = cam.project(b[0], b[1], b[2] || 0);
  return `<line x1="${p1[0].toFixed(2)}" y1="${p1[1].toFixed(2)}" x2="${p2[0].toFixed(2)}" y2="${p2[1].toFixed(2)}" ${attrs(style)}/>`;
}

/** An axis-aligned patch of ground: pavement, grass, paint. */
export function pad(cam, { x, y, w, d, z = 0 }, style) {
  return poly(cam, [[x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z]], style);
}

export function ellipse(cam, x, y, rx, ry, style, z = 0) {
  const [px, py] = cam.project(x, y, z);
  // A circle lying on a horizontal plane squashes with the camera pitch.
  return `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${(rx * cam.scale).toFixed(1)}" ry="${(ry * cam.scale * cam.k * 2).toFixed(1)}" ${attrs(style)}/>`;
}

/**
 * A blob with volume — a tree canopy, a dish. Unlike a painted circle on the
 * ground it must NOT squash when the camera drops toward the horizon, or the
 * trees turn into puddles.
 */
export function sphere(cam, x, y, z, rx, ry, style) {
  const [px, py] = cam.project(x, y, z);
  return `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${(rx * cam.scale).toFixed(1)}" ry="${(ry * cam.scale).toFixed(1)}" ${attrs(style)}/>`;
}

/* ------------------------------------------------------------------- colour */

function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const clamp255 = (n) => Math.max(0, Math.min(255, Math.round(n)));
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** Mix a hex colour toward white (f > 1) or black (f < 1), returned as hex. */
export function mixHex(hex, f) {
  const [r, g, b] = hexToRgb(hex);
  const mix = (c) => clamp255(f >= 1 ? c + (255 - c) * Math.min(f - 1, 1) : c * f);
  return '#' + [mix(r), mix(g), mix(b)].map((n) => n.toString(16).padStart(2, '0')).join('');
}

export const shade = mixHex;

export function rgba(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function lum(hex) {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/* ---------------------------------------------------------------- geometry */

/** Footprint corners of a box with a heading, counter-clockwise from (0,0). */
export function corners({ x, y, w, d, rot = 0 }) {
  const a = rot * DEG;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const hx = w / 2;
  const hy = d / 2;
  const cxp = x + hx;
  const cyp = y + hy;
  return [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]]
    .map(([lx, ly]) => [cxp + lx * ca - ly * sa, cyp + lx * sa + ly * ca]);
}

/** Convex hull (monotone chain) of 2-d points, used for cast shadows. */
export function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (src) => {
    const out = [];
    for (const q of src) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], q) <= 0) out.pop();
      out.push(q);
    }
    out.pop();
    return out;
  };
  return [...half(p), ...half([...p].reverse())];
}

/**
 * The shadow a box throws on the ground: the footprint swept along the sun
 * vector between the box's own bottom and top. Boxes that float — a trailer
 * body, a canopy — cast a shadow that has come away from them, which is what
 * sells the height.
 */
export function shadowOf(cam, box, k = 1) {
  const base = corners(box);
  const z0 = (box.z0 || 0) * k;
  const z1 = (box.z1 == null ? 10 : box.z1) * k;
  const at = (h) => base.map(([px, py]) => [px + SUN.dx * h, py + SUN.dy * h]);
  const ring = hull([...at(z0), ...at(z1)]);
  return `<polygon points="${pts(cam, ring.map((p) => [p[0], p[1], 0]))}"/>`;
}

/** Do two footprints overlap? Separating-axis test on rotated rectangles. */
export function overlaps(a, b, margin = 0) {
  const A = corners({ ...a, w: a.w + margin * 2, d: a.d + margin * 2, x: a.x - margin, y: a.y - margin });
  const B = corners(b);
  for (const poly4 of [A, B]) {
    for (let i = 0; i < 4; i++) {
      const p = poly4[i];
      const q = poly4[(i + 1) % 4];
      const axis = [-(q[1] - p[1]), q[0] - p[0]];
      let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
      for (const [px, py] of A) { const v = px * axis[0] + py * axis[1]; minA = Math.min(minA, v); maxA = Math.max(maxA, v); }
      for (const [px, py] of B) { const v = px * axis[0] + py * axis[1]; minB = Math.min(minB, v); maxB = Math.max(maxB, v); }
      if (maxA < minB || maxB < minA) return false;
    }
  }
  return true;
}

/** Is a point inside a footprint? */
export function contains(box, px, py) {
  const c = corners(box);
  let inside = false;
  for (let i = 0, j = 3; i < 4; j = i++) {
    const [xi, yi] = c[i];
    const [xj, yj] = c[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/* ---------------------------------------------------------------- box faces */

/* A wall face carries its own little coordinate system: `t` runs along the wall
 * from 0..len, `h` runs up it from the face's own base. Anything glued to a
 * wall — a door, a window grid, a sign — is written in those terms and never
 * has to think about the projection or the building's heading. */
function faceFrame(cam, o, u, len, z0, z1, id, normal) {
  const at = (t, h) => [o[0] + u[0] * t, o[1] + u[1] * t, z0 + h];
  return {
    id, len, normal, at,
    height: z1 - z0,
    depth: cam.depth(o[0] + u[0] * (len / 2), o[1] + u[1] * (len / 2)),
    visible: cam.depth(cam.cx + normal[0], cam.cy + normal[1]) > 0,
    quad(t0, t1, h0, h1, style) {
      return poly(cam, [at(t0, h1), at(t1, h1), at(t1, h0), at(t0, h0)], style);
    },
    /* Screen-space matrix that lays flat content (text, a logo) onto the wall.
     * Local y points up the wall, which is why V is negated. Signwriters paint
     * a wall in whichever direction reads from outside it, so if this face runs
     * right-to-left on screen the frame is walked the other way — otherwise the
     * lettering comes out mirrored. */
    matrix(t, h) {
      const flip = cam.project(...at(1, 0))[0] < cam.project(...at(0, 0))[0];
      const tt = flip ? len - t : t;
      const step = flip ? -1 : 1;
      const O = cam.project(...at(tt, h));
      const U = cam.project(...at(tt + step, h));
      const V = cam.project(...at(tt, h + 1));
      return [U[0] - O[0], U[1] - O[1], -(V[0] - O[0]), -(V[1] - O[1]), O[0], O[1]]
        .map((n) => n.toFixed(4)).join(',');
    },
  };
}

// Face ids are local to the object: 'N' always means its own front, whichever
// way it has been turned.
const FACE_IDS = ['S', 'E', 'N', 'W'];

export function boxFaces(cam, box) {
  const c = corners(box);
  const z0 = box.z0 || 0;
  const z1 = box.z1 == null ? 10 : box.z1;
  const out = [];
  for (let i = 0; i < 4; i++) {
    const a = c[i];
    const b = c[(i + 1) % 4];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    const u = [dx / len, dy / len];
    out.push(faceFrame(cam, [a[0], a[1], z0], u, len, z0, z1, FACE_IDS[i], [u[1], -u[0]]));
  }
  return out;
}

/** How much sun a wall with this normal catches. */
export function toneOf(normal) {
  const lit = -(normal[0] * SUN_N.x + normal[1] * SUN_N.y);
  return 0.64 + 0.36 * clamp((lit + 0.25) / 1.25, 0, 1);
}

/**
 * Draw a prism far walls first, then near walls, then the roof. For a convex
 * box the near walls plus the roof cover the far ones exactly, so nothing needs
 * a visibility test — the back is painted over, and so is anything decorating
 * it.
 */
export function drawBox(cam, box, opts = {}) {
  const {
    color = '#c8ced6',
    roof = null,
    decorate = null,
    stroke = 'rgba(18,26,38,.32)',
    grade = true,     // vertical light falloff down each wall
    ao = 0,           // feet of ground-shadow darkening at the base
    crisp = false,    // small props: skip the gradients, keep the edges tight
    roofStyle = null, // extra attributes for the top face
  } = opts;
  const faces = boxFaces(cam, box);
  let out = '';
  for (const f of [...faces].sort((a, b) => a.depth - b.depth)) {
    out += f.quad(0, f.len, 0, f.height, { fill: mixHex(color, toneOf(f.normal)), stroke, 'stroke-width': 0.5 });
    if (grade && !crisp) out += f.quad(0, f.len, 0, f.height, { fill: 'url(#wallFade)', stroke: 'none' });
    if (decorate) out += decorate(f) || '';
    if (ao > 0) out += f.quad(0, f.len, 0, Math.min(ao, f.height), { fill: 'url(#baseAO)', stroke: 'none' });
  }
  const z1 = box.z1 == null ? 10 : box.z1;
  const top = corners(box).map((p) => [p[0], p[1], z1]);
  out += poly(cam, top, { fill: roof || mixHex(color, 1.16), stroke, 'stroke-width': 0.5, ...(roofStyle || {}) });
  if (!crisp) out += poly(cam, top, { fill: 'url(#roofFade)', stroke: 'none' });
  return out;
}

/** The top face on its own, for drawing things onto a roof. */
export function topFace(cam, box, style) {
  const z1 = box.z1 == null ? 10 : box.z1;
  return poly(cam, corners(box).map((p) => [p[0], p[1], z1]), style);
}

/** A pitched roof, for the props that want one. */
export function gableRoof(cam, box, { color = '#8d5a45', rise = 4, along = 'w' } = {}) {
  const c = corners(box);
  const z = box.z1 == null ? 10 : box.z1;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const ridgeA = along === 'w' ? mid(c[0], c[3]) : mid(c[0], c[1]);
  const ridgeB = along === 'w' ? mid(c[1], c[2]) : mid(c[3], c[2]);
  const slopes = along === 'w'
    ? [[c[0], c[1], ridgeB, ridgeA], [c[3], c[2], ridgeB, ridgeA]]
    : [[c[0], c[3], ridgeB, ridgeA], [c[1], c[2], ridgeB, ridgeA]];
  let out = '';
  const ends = along === 'w'
    ? [[c[0], c[3], ridgeA], [c[1], c[2], ridgeB]]
    : [[c[0], c[1], ridgeA], [c[3], c[2], ridgeB]];
  for (const [a, b, r] of ends) {
    out += poly(cam, [[a[0], a[1], z], [b[0], b[1], z], [r[0], r[1], z + rise]], {
      fill: mixHex(color, 0.82), stroke: 'rgba(18,26,38,.35)', 'stroke-width': 0.5,
    });
  }
  slopes.forEach((q, i) => {
    out += poly(cam, [
      [q[0][0], q[0][1], z], [q[1][0], q[1][1], z],
      [q[2][0], q[2][1], z + rise], [q[3][0], q[3][1], z + rise],
    ], { fill: mixHex(color, i ? 0.9 : 1.12), stroke: 'rgba(18,26,38,.35)', 'stroke-width': 0.5 });
  });
  return out;
}

/** A vertical cylinder — tanks, stacks, silos, bollards. */
export function cylinder(cam, { x, y, r, z0 = 0, z1 = 10 }, { color = '#b9c0c8', top = null } = {}) {
  const seg = 16;
  const ring = (z) => Array.from({ length: seg }, (_, i) => {
    const a = (i / seg) * Math.PI * 2;
    return [x + Math.cos(a) * r, y + Math.sin(a) * r, z];
  });
  const lo = ring(z0);
  const hi = ring(z1);
  let out = '';
  const order = Array.from({ length: seg }, (_, i) => i)
    .sort((i, j) => cam.depth(lo[i][0], lo[i][1]) - cam.depth(lo[j][0], lo[j][1]));
  for (const i of order) {
    const j = (i + 1) % seg;
    const n = [Math.cos(((i + 0.5) / seg) * Math.PI * 2), Math.sin(((i + 0.5) / seg) * Math.PI * 2)];
    out += poly(cam, [hi[i], hi[j], lo[j], lo[i]], { fill: mixHex(color, toneOf(n)), stroke: 'none' });
  }
  out += poly(cam, hi, { fill: top || mixHex(color, 1.18), stroke: 'rgba(18,26,38,.3)', 'stroke-width': 0.5 });
  return out;
}

/** Text laid onto a wall face. Size and offsets are in feet. */
export function faceText(face, { t, h, text, size = 4, color = '#fff', anchor = 'middle', weight = 800, letter = 0, family, glow = false, opacity = 1, shadow = false }) {
  const style = {
    'font-size': size,
    'font-family': family || '"Helvetica Neue", Helvetica, Arial, sans-serif',
    'font-weight': weight,
    'letter-spacing': letter,
    'text-anchor': anchor,
    opacity,
  };
  const m = face.matrix(t, h);
  const filter = glow ? ' filter="url(#signGlow)"' : '';
  let out = `<g transform="matrix(${m})">`;
  if (shadow) {
    out += `<text x="${(size * 0.05).toFixed(2)}" y="${(size * 0.05).toFixed(2)}" ${attrs({ ...style, fill: 'rgba(0,0,0,.28)' })}>${esc(text)}</text>`;
  }
  out += `<text x="0" y="0" ${attrs({ ...style, fill: color })}${filter}>${esc(text)}</text></g>`;
  return out;
}
