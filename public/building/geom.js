/* Plan geometry in feet. x runs east, y runs south toward the street; a
 * footprint is { x, y, w, d, rot } with (x, y) its unrotated top-left corner
 * and rot in degrees about its own centre. Nothing in here draws anything. */

export const DEG = Math.PI / 180;
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** Footprint corners, counter-clockwise from the north-west corner. */
export function corners({ x, y, w, d, rot = 0 }) {
  const a = rot * DEG;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const hx = w / 2;
  const hy = d / 2;
  const cx = x + hx;
  const cy = y + hy;
  return [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]]
    .map(([lx, ly]) => [cx + lx * ca - ly * sa, cy + lx * sa + ly * ca]);
}

export function bounds(fp) {
  const c = corners(fp);
  return {
    x0: Math.min(...c.map((p) => p[0])), x1: Math.max(...c.map((p) => p[0])),
    y0: Math.min(...c.map((p) => p[1])), y1: Math.max(...c.map((p) => p[1])),
  };
}

/** Centre and half-extents of the axis-aligned box round a footprint. */
function box(f, m = 0) {
  const r = f.rot || 0;
  const hx = f.w / 2 + m;
  const hy = f.d / 2 + m;
  const cx = f.x + f.w / 2;
  const cy = f.y + f.d / 2;
  if (r % 180 === 0) return [cx, cy, hx, hy, true];
  if (r % 90 === 0) return [cx, cy, hy, hx, true];
  const a = r * DEG;
  const c = Math.abs(Math.cos(a));
  const s = Math.abs(Math.sin(a));
  return [cx, cy, hx * c + hy * s, hx * s + hy * c, false];
}

/** Separating-axis test on two rotated rectangles; margin grows (or, when
 *  negative, shrinks) the first one before testing. Square-on rectangles —
 *  nearly everything — are settled by their boxes alone. */
export function overlaps(a, b, margin = 0) {
  const [ax, ay, aw, ah, aSq] = box(a, margin);
  const [bx, by, bw, bh, bSq] = box(b);
  if (Math.abs(ax - bx) > aw + bw || Math.abs(ay - by) > ah + bh) return false;
  if (aSq && bSq) return true;
  const A = corners({ ...a, w: a.w + margin * 2, d: a.d + margin * 2, x: a.x - margin, y: a.y - margin });
  const B = corners(b);
  for (const ring of [A, B]) {
    for (let i = 0; i < 4; i++) {
      const p = ring[i];
      const q = ring[(i + 1) % 4];
      const nx = -(q[1] - p[1]);
      const ny = q[0] - p[0];
      let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
      for (const [px, py] of A) { const v = px * nx + py * ny; minA = Math.min(minA, v); maxA = Math.max(maxA, v); }
      for (const [px, py] of B) { const v = px * nx + py * ny; minB = Math.min(minB, v); maxB = Math.max(maxB, v); }
      if (maxA < minB || maxB < minA) return false;
    }
  }
  return true;
}

export function contains(fp, px, py) {
  const c = corners(fp);
  let inside = false;
  for (let i = 0, j = 3; i < 4; j = i++) {
    const [xi, yi] = c[i];
    const [xj, yj] = c[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Turn a point given in an object's own frame (origin at its centre) into the world. */
export function toWorld(fp, lx, ly) {
  const a = (fp.rot || 0) * DEG;
  return [
    fp.x + fp.w / 2 + lx * Math.cos(a) - ly * Math.sin(a),
    fp.y + fp.d / 2 + lx * Math.sin(a) + ly * Math.cos(a),
  ];
}

/** And back again. */
export function toLocal(fp, wx, wy) {
  const a = -(fp.rot || 0) * DEG;
  const dx = wx - (fp.x + fp.w / 2);
  const dy = wy - (fp.y + fp.d / 2);
  return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)];
}

/**
 * The four walls of a footprint, each as an origin at the wall's left end (as
 * seen by someone standing outside looking at it), a unit vector running to
 * their right, the outward normal and the wall's length. Column 0 of a wall
 * grid is therefore always the left-hand bay as you look at it.
 */
export function wallFrames(fp) {
  const hx = fp.w / 2;
  const hy = fp.d / 2;
  const local = {
    N: { o: [-hx, hy], u: [1, 0], n: [0, 1], len: fp.w },
    S: { o: [hx, -hy], u: [-1, 0], n: [0, -1], len: fp.w },
    E: { o: [hx, hy], u: [0, -1], n: [1, 0], len: fp.d },
    W: { o: [-hx, -hy], u: [0, 1], n: [-1, 0], len: fp.d },
  };
  const a = (fp.rot || 0) * DEG;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const turn = ([vx, vy]) => [vx * ca - vy * sa, vx * sa + vy * ca];
  const out = {};
  for (const [id, f] of Object.entries(local)) {
    const o = turn(f.o);
    out[id] = {
      id,
      o: [fp.x + hx + o[0], fp.y + hy + o[1]],
      u: turn(f.u),
      n: turn(f.n),
      len: f.len,
    };
  }
  return out;
}

/** A rectangle standing off a wall, from t0 to t1 along it and `depth` out. */
export function rectOffWall(frame, t0, t1, depth, pad = 0) {
  const a0 = t0 - pad;
  const a1 = t1 + pad;
  const mx = frame.o[0] + frame.u[0] * ((a0 + a1) / 2) + frame.n[0] * (depth / 2);
  const my = frame.o[1] + frame.u[1] * ((a0 + a1) / 2) + frame.n[1] * (depth / 2);
  const w = a1 - a0;
  return { x: mx - w / 2, y: my - depth / 2, w, d: depth, rot: Math.atan2(frame.u[1], frame.u[0]) / DEG };
}
