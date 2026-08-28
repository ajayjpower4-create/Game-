/* Isometric drawing kit.
 *
 * The world is measured in feet: x runs along the front of the lot, y runs back
 * into it, z is up. Everything drawn is a box, a flat patch of ground, or
 * something glued to the side of a box, so that is all this file knows how to
 * make — but it makes them with lighting, cast shadows and material detail. */

const COS30 = Math.cos(Math.PI / 6);
const SIN30 = Math.sin(Math.PI / 6);

/* Where a shadow lands, per foot of height. The sun sits up and to the left of
 * the screen, so shadows fall down and to the right, into the yard where they
 * can be seen. */
export const SUN = { dx: 0.72, dy: 0.46 };

export function makeCamera({ rot = 0, scale = 1, cx = 0, cy = 0, ox = 0, oy = 0 }) {
  const a = (rot * Math.PI) / 2;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const spin = (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    return [dx * ca - dy * sa, dx * sa + dy * ca];
  };
  return {
    scale,
    project(x, y, z = 0) {
      const [rx, ry] = spin(x, y);
      return [ox + (rx - ry) * COS30 * scale, oy + ((rx + ry) * SIN30 - z) * scale];
    },
    // Painter's-algorithm key: bigger means nearer the viewer, so draw last.
    depth(x, y) {
      const [rx, ry] = spin(x, y);
      return rx + ry;
    },
  };
}

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

/** A flat patch of ground: parking, pavement, grass, the lot itself. */
export function pad(cam, { x, y, w, d, z = 0 }, style) {
  return poly(cam, [[x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z]], style);
}

export function ellipse(cam, x, y, rx, ry, style, z = 0) {
  const [px, py] = cam.project(x, y, z);
  return `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${(rx * cam.scale).toFixed(1)}" ry="${(ry * cam.scale).toFixed(1)}" ${attrs(style)}/>`;
}

/* ------------------------------------------------------------------- colour */

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const clamp255 = (n) => Math.max(0, Math.min(255, Math.round(n)));

/** Mix a hex colour toward white (f > 1) or black (f < 1), returned as hex. */
export function mixHex(hex, f) {
  const [r, g, b] = hexToRgb(hex);
  const mix = (c) => clamp255(f >= 1 ? c + (255 - c) * Math.min(f - 1, 1) : c * f);
  return '#' + [mix(r), mix(g), mix(b)].map((n) => n.toString(16).padStart(2, '0')).join('');
}

export const shade = (hex, f) => mixHex(hex, f);

/** Push a colour toward a tint — used to sit everything in the same daylight. */
export function tint(hex, target, amount) {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  return '#' + a.map((c, i) => clamp255(c + (b[i] - c) * amount).toString(16).padStart(2, '0')).join('');
}

export function rgba(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ---------------------------------------------------------------- geometry */

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
 * vector between the box's own bottom and top. Boxes that float (a trailer
 * body, a canopy) cast a shadow that has come away from them, which is what
 * sells the height.
 */
export function shadowOf(cam, box) {
  const { x, y, w, d, z0 = 0, z1 = 10 } = box;
  const base = [[x, y], [x + w, y], [x + w, y + d], [x, y + d]];
  const at = (h) => base.map(([px, py]) => [px + SUN.dx * h, py + SUN.dy * h]);
  const ring = hull([...at(z0), ...at(z1)]);
  return `<polygon points="${pts(cam, ring.map((p) => [p[0], p[1], 0]))}"/>`;
}

/* ---------------------------------------------------------------- box faces */

/* A wall face carries its own little coordinate system: `t` runs along the wall
 * from 0..len, `h` runs up it from the face's own base. Anything glued to a
 * wall — a dock door, a window grid, a sign — is written in those terms and
 * never has to think about the projection. */
function faceFrame(cam, o, u, len, z0, z1, id) {
  const at = (t, h) => [o[0] + u[0] * t, o[1] + u[1] * t, z0 + h];
  return {
    id,
    len,
    height: z1 - z0,
    at,
    depth: cam.depth(o[0] + u[0] * (len / 2), o[1] + u[1] * (len / 2)),
    quad(t0, t1, h0, h1, style) {
      return poly(cam, [at(t0, h1), at(t1, h1), at(t1, h0), at(t0, h0)], style);
    },
    edge(t0, h0, t1, h1, style) {
      return line(cam, at(t0, h0), at(t1, h1), style);
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

export function boxFaces(cam, { x, y, w, d, z0 = 0, z1 = 10 }) {
  return [
    faceFrame(cam, [x, y, z0], [1, 0], w, z0, z1, 'S'),
    faceFrame(cam, [x + w, y, z0], [0, 1], d, z0, z1, 'E'),
    faceFrame(cam, [x + w, y + d, z0], [-1, 0], w, z0, z1, 'N'),
    faceFrame(cam, [x, y + d, z0], [0, -1], d, z0, z1, 'W'),
  ];
}

// How much light each wall catches. The sun is off the front-left, so the
// street face is brightest and the far side falls away.
export const TONE = { N: 1.0, E: 0.83, S: 0.7, W: 0.62 };

/**
 * Draw a box far walls first, then near walls, then the roof. For a convex box
 * the near walls plus the roof cover the far ones exactly, so nothing needs a
 * visibility test — the back of the building is painted over, and so is
 * anything decorating it.
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
  } = opts;
  const faces = boxFaces(cam, box);
  let out = '';
  for (const f of [...faces].sort((a, b) => a.depth - b.depth)) {
    out += f.quad(0, f.len, 0, f.height, { fill: mixHex(color, TONE[f.id]), stroke, 'stroke-width': 0.5 });
    if (grade && !crisp) out += f.quad(0, f.len, 0, f.height, { fill: 'url(#wallFade)', stroke: 'none' });
    if (decorate) out += decorate(f) || '';
    if (ao > 0) out += f.quad(0, f.len, 0, Math.min(ao, f.height), { fill: 'url(#baseAO)', stroke: 'none' });
  }
  const { x, y, w, d, z1 = 10 } = box;
  const top = [[x, y, z1], [x + w, y, z1], [x + w, y + d, z1], [x, y + d, z1]];
  out += poly(cam, top, { fill: roof || mixHex(color, 1.16), stroke, 'stroke-width': 0.5 });
  if (!crisp) out += poly(cam, top, { fill: 'url(#roofFade)', stroke: 'none' });
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
