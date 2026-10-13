/* Parking lots laid out by the player.
 *
 * A lot is a rectangle the player places and sizes; this works out the bays
 * inside it — rows of stalls either side of drive aisles that run along its
 * width — for any stall angle and width. The 3D model, the parked cars and the
 * stats all read the same layout. Plan feet, in the lot's own frame: x across
 * its width, y along its depth, origin at its centre. Nothing here draws. */

import { toWorld } from './geom.js';

export const LOT_ANGLES = [90, 60, 45];
export const STALL_WIDTHS = [8.5, 9, 9.5, 10];
const STALL_LEN = 18;

/** Settings for a lot, with defaults filled in. */
export function lotSettings(o) {
  return {
    angle: LOT_ANGLES.includes(+o.angle) ? +o.angle : 90,
    sw: STALL_WIDTHS.includes(+o.sw) ? +o.sw : 9,
    ada: Math.max(0, Math.min(20, Math.round(o.ada ?? 2))),
    ev: Math.max(0, Math.min(40, Math.round(o.ev ?? 0))),
    fill: Math.max(0, Math.min(100, o.fill ?? 65)),
    kerbs: o.kerbs !== false,
    lights: o.lights !== false,
    islands: o.islands !== false,
    surface: o.surface || 'asphalt',
    lines: o.lines || '#f4f2ea',
  };
}

/**
 * The bays in a lot of the given size. Each stall: centre (x, y), the way its
 * nose points (dir: +1 down the lot, −1 up it), its own angle, accessible/EV.
 */
export function lotLayout(o) {
  const S = lotSettings(o);
  const w = o.w || 120;
  const d = o.d || 70;
  const a = (S.angle * Math.PI) / 180;
  // How deep a row of stalls is across the aisle, how far apart they sit along
  // it, and how wide the aisle between two rows must be.
  const depth = STALL_LEN * Math.sin(a) + (S.angle === 90 ? 0 : (S.sw / 2) * Math.cos(a));
  const pitch = S.sw / Math.sin(a);
  const aisle = S.angle === 90 ? 24 : S.angle === 60 ? 18 : 14;
  const margin = 2;
  const endGap = S.islands ? 9 : 3;
  const x0 = -w / 2 + margin + endGap;
  const x1 = w / 2 - margin - endGap;
  const rows = [];
  const aisles = [];
  let y = -d / 2 + margin;
  const room = () => d / 2 - margin - y;
  while (room() >= depth + aisle) {
    // A double-loaded module when it fits, otherwise one row and its aisle.
    rows.push({ y0: y, y1: y + depth, dir: 1 });
    y += depth;
    aisles.push({ y0: y, y1: y + aisle });
    y += aisle;
    if (room() >= depth) {
      rows.push({ y0: y, y1: y + depth, dir: -1 });
      y += depth;
    }
    if (room() >= depth + aisle) y += 1.5;   // a curb strip between modules
  }
  // Centre the rows in the lot rather than leaving all the slack at one end.
  const slack = Math.max(0, d / 2 - margin - y);
  if (rows.length && slack > 0.5) {
    const sh = slack / 2;
    for (const r of rows) { r.y0 += sh; r.y1 += sh; }
    for (const a of aisles) { a.y0 += sh; a.y1 += sh; }
  }
  const stalls = [];
  const lean = S.angle === 90 ? 0 : 90 - S.angle;
  rows.forEach((row, ri) => {
    const usable = x1 - x0 - (S.angle === 90 ? 0 : depth / Math.tan(a));
    const n = Math.max(0, Math.floor(usable / pitch));
    const start = x0 + (usable - n * pitch) / 2 + pitch / 2 + (S.angle === 90 ? 0 : (depth / Math.tan(a)) / 2);
    // The stall's axis, from the aisle to its head: straight across the row,
    // leaned over for angled parking.
    const phi = (row.dir * lean * Math.PI) / 180;
    const ax = row.dir * Math.sin(phi);
    const ay = -row.dir * Math.cos(phi);
    for (let i = 0; i < n; i++) {
      stalls.push({ x: start + i * pitch, y: (row.y0 + row.y1) / 2, dir: row.dir, ax, ay, row: ri });
    }
  });
  // Accessible bays go at the start of the first row; EV bays at the end of the last.
  for (let i = 0; i < Math.min(S.ada, stalls.length); i++) stalls[i].ada = true;
  const last = stalls.length - 1;
  for (let i = 0; i < Math.min(S.ev, stalls.length); i++) if (!stalls[last - i].ada) stalls[last - i].ev = true;
  return { S, w, d, depth, pitch, aisle, rows, aisles, stalls, len: STALL_LEN, x0, x1 };
}

/**
 * The bays of a placed lot in site coordinates, shaped like the automatic
 * plan's stalls so the parked cars and the stats can use them as they are.
 */
export function lotStalls(o, fp) {
  const L = lotLayout(o);
  return L.stalls.map((s, i) => {
    const [cx, cy] = toWorld(fp, s.x, s.y);
    // The car's heading, in the same degrees objects turn by: nose in to the head of the bay.
    const rot = (fp.rot || 0) + (Math.atan2(s.ax, -s.ay) * 180) / Math.PI;
    return {
      x: cx - L.S.sw / 2, y: cy - L.len / 2, w: L.S.sw, d: L.len, cx, cy, rot,
      ada: !!s.ada, ev: !!s.ev, row: `${o.id}:${s.row}`, manual: true, fill: L.S.fill, n: i,
    };
  });
}
