/* Isometric drawing kit.
 *
 * The world is measured in feet: x runs along the front of the lot, y runs back
 * into it, z is up. Everything the game draws is a box, a flat quad on the
 * ground, or something stuck to the side of a box, so that is all this file
 * knows how to do. */

const COS30 = Math.cos(Math.PI / 6);
const SIN30 = Math.sin(Math.PI / 6);

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

export function poly(cam, pts, style = {}) {
  const d = pts.map((p) => cam.project(p[0], p[1], p[2] || 0).map((n) => n.toFixed(2)).join(',')).join(' ');
  return `<polygon points="${d}" ${attrs(style)}/>`;
}

export function line(cam, a, b, style = {}) {
  const p1 = cam.project(a[0], a[1], a[2] || 0);
  const p2 = cam.project(b[0], b[1], b[2] || 0);
  return `<line x1="${p1[0].toFixed(2)}" y1="${p1[1].toFixed(2)}" x2="${p2[0].toFixed(2)}" y2="${p2[1].toFixed(2)}" ${attrs(style)}/>`;
}

/* ------------------------------------------------------------------- shading */

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Same mix as `shade`, but returned as hex so it can be shaded again. */
export function mixHex(hex, f) {
  const [r, g, b] = hexToRgb(hex);
  const mix = (c) => Math.round(f >= 1 ? c + (255 - c) * Math.min(f - 1, 1) : c * f);
  return '#' + [mix(r), mix(g), mix(b)].map((n) => n.toString(16).padStart(2, '0')).join('');
}

/** Multiply a hex colour toward white (f > 1) or black (f < 1). */
export function shade(hex, f) {
  const [r, g, b] = hexToRgb(hex);
  const mix = (c) => Math.round(f >= 1 ? c + (255 - c) * Math.min(f - 1, 1) : c * f);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
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
    center: at(len / 2, (z1 - z0) / 2),
    // Depth of the face centre, used to sort the four walls of a box.
    depth: cam.depth(o[0] + u[0] * (len / 2), o[1] + u[1] * (len / 2)),
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
      const m = [U[0] - O[0], U[1] - O[1], -(V[0] - O[0]), -(V[1] - O[1]), O[0], O[1]];
      return m.map((n) => n.toFixed(4)).join(',');
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

/**
 * Draw a box far walls first, then near walls, then the roof. For a convex box
 * the near walls plus the roof cover the far ones exactly, so nothing needs a
 * visibility test — the back of the building is painted over, and so is
 * anything decorating it.
 */
export function drawBox(cam, box, opts = {}) {
  const { color = '#c8ced6', roof = null, decorate = null, stroke = 'rgba(20,30,45,.28)' } = opts;
  const faces = boxFaces(cam, box);
  // The lot's front edge is +y, so the N and E walls are the ones the
  // camera sees at rest; they take the sunlight.
  const tone = { N: 1.0, E: 0.86, S: 0.74, W: 0.66 };
  let out = '';
  for (const f of [...faces].sort((a, b) => a.depth - b.depth)) {
    out += f.quad(0, f.len, 0, f.height, { fill: shade(color, tone[f.id]), stroke, 'stroke-width': 0.6 });
    if (decorate) out += decorate(f) || '';
  }
  const { x, y, w, d, z1 = 10 } = box;
  out += poly(cam, [[x, y, z1], [x + w, y, z1], [x + w, y + d, z1], [x, y + d, z1]], {
    fill: roof || shade(color, 1.16),
    stroke,
    'stroke-width': 0.6,
  });
  return out;
}

/** A flat patch of ground: parking, pavement, grass, the lot itself. */
export function pad(cam, { x, y, w, d, z = 0 }, style) {
  return poly(cam, [[x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z]], style);
}

/** Text laid onto a wall face. Size and offsets are in feet. */
export function faceText(face, { t, h, text, size = 4, color = '#fff', anchor = 'middle', weight = 800, letter = 0, family, glow = false, opacity = 1 }) {
  const style = {
    'font-size': size,
    'font-family': family || '"Helvetica Neue", Helvetica, Arial, sans-serif',
    'font-weight': weight,
    'letter-spacing': letter,
    fill: color,
    'text-anchor': anchor,
    opacity,
  };
  const filter = glow ? ' filter="url(#signGlow)"' : '';
  return `<g transform="matrix(${face.matrix(t, h)})"><text x="0" y="0" ${attrs(style)}${filter}>${esc(text)}</text></g>`;
}
