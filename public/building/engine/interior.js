/* The inside of a building, drawn while its interior is open for editing.
 *
 * The building's own model is hidden and this takes its place: one storey as
 * a shell of thick walls with the same windows and doors the outside shows
 * (so daylight and the view come through them), the floor and its patches of
 * other finishes, the partitions with doorways cut where doors stand, the
 * ceiling with its lights, and the furniture.
 *
 * Furniture is instanced: every item of a kind and colour is one model drawn
 * many times, so a floor of two hundred desks is a few dozen draw calls and
 * moving one of them only rewrites a matrix.
 *
 * Seen from outside (the dolls'-house view) the roof and ceiling are off and
 * whichever outside walls stand between the camera and the rooms are cut down
 * to a stub; walking inside, everything is up. */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Builder, cylGeo } from './builder.js';
import * as M from './materials.js';
import { localFrames, Face, openingRect, cellOnFloor } from './buildings.js';
import { buildItem } from './furniture.js';
import { ITEM_BY_ID, WALL_BY_ID, WALL_T, roomOf, levelOf, wallHeight, nearWall, itemSize } from '../interiorlist.js';
import { footprint } from '../site.js';

const DEG = Math.PI / 180;
const PI = Math.PI;
const STUB = 1.0;                   // how high a cut-down wall stands
const FACES = ['N', 'E', 'S', 'W'];
export const FLOOR_UP = 0.42;       // finished floor above the ground outside

/* ----------------------------------------------------------------- kits */

const kits = new Map();

/** The model of an item, built once for every item that looks the same. */
export function kitFor(item) {
  const spec = ITEM_BY_ID[item.type];
  if (!spec) return null;
  const { id, x, y, rot, lift, ...rest } = item;
  const key = JSON.stringify(rest);
  if (!kits.has(key)) {
    const B = new Builder();
    const ctx = { lights: [] };
    try {
      buildItem(B, item, spec, ctx);
    } catch (e) {
      console.warn('interior item', item.type, e);
      B.slab(M.painted('#c0392b', 0.6), spec.w, spec.h, spec.d, 0, 0, 0);
    }
    const parts = [];
    for (const [mat, geos] of B.parts) {
      if (!geos.length) continue;
      const geo = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
      if (!geo) continue;
      geo.computeBoundingSphere();
      geo.computeBoundingBox();
      parts.push({ geo, mat });
    }
    kits.set(key, { key, parts, lights: ctx.lights });
  }
  return kits.get(key);
}

/* ------------------------------------------------------------ the shell */

const mats = (b, room) => ({
  out: M.wall(b.cladding || 'precast', b.wall || '#d8dde3'),
  in: M.wallPaint(room.wallColor),
  reveal: M.wallPaint('#dedbd3'),
  cut: M.plastic('#2f343a', 0.8),
  frame: M.frame(false),
  dark: M.frame(true),
});

/** One bay of an outside wall, as thick wall round whatever opening the bay has. */
function shellBay(F, m, s0, s1, fh, o) {
  const T = WALL_T;
  if (!o) {
    F.rect(m.out, s0, s1, 0, fh, 0);
    F.rectIn(m.in, s0, s1, 0, fh, -T);
    return;
  }
  const a = s0 + o.s0;
  const z = s0 + o.s1;
  for (const [u0, u1, h0, h1] of [[s0, s1, 0, o.h0], [s0, s1, o.h1, fh], [s0, a, o.h0, o.h1], [z, s1, o.h0, o.h1]]) {
    F.rect(m.out, u0, u1, h0, h1, 0);
    F.rectIn(m.in, u0, u1, h0, h1, -T);
  }
  // The reveals through the wall's thickness.
  const q = (p1, p2, p3, p4) => F.b.quad(m.reveal, p1, p2, p3, p4);
  q(F.p(a, o.h0, 0), F.p(a, o.h0, -T), F.p(a, o.h1, -T), F.p(a, o.h1, 0));
  q(F.p(z, o.h0, -T), F.p(z, o.h0, 0), F.p(z, o.h1, 0), F.p(z, o.h1, -T));
  if (o.h0 > 0.05) q(F.p(a, o.h0, 0), F.p(z, o.h0, 0), F.p(z, o.h0, -T), F.p(a, o.h0, -T));
  q(F.p(a, o.h1, -T), F.p(z, o.h1, -T), F.p(z, o.h1, 0), F.p(a, o.h1, 0));
  const mid = -T * 0.5;
  const w = z - a;
  if (o.fill === 'glass') {
    F.rect(M.clearGlass(), a, z, o.h0, o.h1, mid, true);
    const fr = 0.16;
    const d0 = mid - 0.1;
    const d1 = mid + 0.1;
    F.box(m.frame, a, z, o.h0, o.h0 + fr, d0, d1);
    F.box(m.frame, a, z, o.h1 - fr, o.h1, d0, d1);
    F.box(m.frame, a, a + fr, o.h0, o.h1, d0, d1);
    F.box(m.frame, z - fr, z, o.h0, o.h1, d0, d1);
    for (let i = 1; i < (o.cols || 1); i++) F.box(m.frame, a + (w * i) / o.cols - fr / 2, a + (w * i) / o.cols + fr / 2, o.h0, o.h1, d0, d1);
    if (o.h0 < 0.5 && o.h1 > 8.2) F.box(m.frame, a, z, 7.2, 7.2 + fr, d0, d1);       // transom over doors
    if (o.entrance) {
      // Push bars on the pair of leaves in the middle.
      for (const sx of [-1, 1]) F.box(M.chrome(), a + w / 2 + sx * 0.3 - 0.06, a + w / 2 + sx * 0.3 + 0.06, 3, 4.4, mid - 0.32, mid - 0.2);
    }
    if (o.h0 > 1) F.box(M.laminate('#e9e6df'), a - 0.15, z + 0.15, o.h0 - 0.12, o.h0, -T - 0.25, -T + 0.05);     // window board
  } else if (o.fill === 'door') {
    F.box(M.painted('#5f6b78', 0.5), a + 0.12, z - 0.12, o.h0, o.h1 - 0.12, mid - 0.07, mid + 0.07);
    F.box(m.dark, a, a + 0.14, o.h0, o.h1, mid - 0.2, mid + 0.2);
    F.box(m.dark, z - 0.14, z, o.h0, o.h1, mid - 0.2, mid + 0.2);
    F.box(m.dark, a, z, o.h1 - 0.14, o.h1, mid - 0.2, mid + 0.2);
    F.box(M.chrome(), a + 0.5, z - 0.5, 3.2, 3.42, mid - 0.25, mid - 0.1);         // panic bar
    F.box(M.glow('#39d353', 1.4), a + w / 2 - 0.55, a + w / 2 + 0.55, o.h1 + 0.25, o.h1 + 0.75, -T - 0.12, -T - 0.02);   // exit sign
  } else if (o.fill === 'panel') {
    F.box(M.doorPanel('#b9c0c7'), a, z, o.h0, o.h1, mid - 0.05, mid + 0.05);
    F.box(M.metal('#8a9299', 0.45), a - 0.05, a + 0.2, o.h0, o.h1 + 0.6, -T - 0.2, -T);
    F.box(M.metal('#8a9299', 0.45), z - 0.2, z + 0.05, o.h0, o.h1 + 0.6, -T - 0.2, -T);
    F.box(M.metal('#8a9299', 0.45), a - 0.05, z + 0.05, o.h1 + 0.3, o.h1 + 1.1, -T - 0.9, -T);
  } else if (o.fill === 'open') {
    F.box(m.frame, a, z, o.h0 - 0.1, o.h0 + 0.12, -T * 0.7, -T * 0.3);
  }
}

/** A storey's outside walls, each face twice over: standing, and cut down. */
function buildShell(b, level, room) {
  const group = new THREE.Group();
  group.name = 'shell';
  const m = mats(b, room);
  const frames = localFrames(b.w, b.d);
  const faces = {};
  for (const face of FACES) {
    const f = frames[face];
    const grid = b.walls[face] || [['blank']];
    const row = grid[Math.min(level, grid.length - 1)] || [];
    const cols = Math.max(1, (grid[0] || []).length);
    const cw = f.len / cols;
    const BF = new Builder();
    const BS = new Builder();
    const F = new Face(BF, f);
    const S = new Face(BS, f);
    let run = 0;
    for (let c = 0; c < cols; c++) {
      const o = openingRect(cellOnFloor(row[c], level), cw, room.fh);
      shellBay(F, m, c * cw, (c + 1) * cw, room.fh, o);
      // The stub leaves doorways open.
      if (o && o.h0 < 0.5) {
        if (c * cw + o.s0 - run > 0.02) S.box(m.cut, run, c * cw + o.s0, 0, STUB, -WALL_T, 0);
        run = c * cw + o.s1;
      }
    }
    if (f.len - run > 0.02) S.box(m.cut, run, f.len, 0, STUB, -WALL_T, 0);
    BF.quad(m.cut, F.p(0, room.fh, 0), F.p(f.len, room.fh, 0), F.p(f.len, room.fh, -WALL_T), F.p(0, room.fh, -WALL_T));
    const full = BF.finish(new THREE.Group());
    const stub = BS.finish(new THREE.Group(), { cast: false });
    stub.visible = false;
    const g = new THREE.Group();
    g.add(full, stub);
    group.add(g);
    faces[face] = { full, stub, n: f.n, o: f.o, len: f.len, u: f.u };
  }
  // What the storey stands on: the slab, and the storeys below as a plain block.
  const B = new Builder();
  B.box(M.concrete('#9c9a94'), b.w + 0.3, 0.7, b.d + 0.3, 0, -0.36, 0);
  if (level > 0) B.box(m.out, b.w, level * room.fh - 0.7 + FLOOR_UP, b.d, 0, -0.7 - (level * room.fh - 0.7 + FLOOR_UP) / 2, 0);
  group.add(B.finish(new THREE.Group()));
  return { group, faces };
}

/* ---------------------------------------------------------------- floors */

function buildFloor(b, room, L) {
  const B = new Builder();
  const hx = b.w / 2 - WALL_T;
  const hz = b.d / 2 - WALL_T;
  const y = 0.02;
  B.quad(M.floorFinish(room.floor, room.floorColor), [-hx, y, hz], [hx, y, hz], [hx, y, -hz], [-hx, y, -hz], [-hx, hz, hx, hz, hx, -hz, -hx, -hz]);
  (L.areas || []).forEach((a, i) => {
    const x0 = Math.max(-hx, a.x - b.w / 2);
    const x1 = Math.min(hx, a.x + a.w - b.w / 2);
    const z0 = Math.max(-hz, a.y - b.d / 2);
    const z1 = Math.min(hz, a.y + a.d - b.d / 2);
    if (x1 - x0 < 0.1 || z1 - z0 < 0.1) return;
    const yy = y + 0.012 + i * 0.002;
    B.quad(M.floorFinish(a.finish, a.color), [x0, yy, z1], [x1, yy, z1], [x1, yy, z0], [x0, yy, z0], [x0, z1, x1, z1, x1, z0, x0, z0]);
  });
  const g = B.finish(new THREE.Group(), { cast: false });
  g.name = 'floor';
  return g;
}

/* --------------------------------------------------------------- ceiling */

function buildCeiling(b, room) {
  const B = new Builder();
  const lights = [];
  const hx = b.w / 2 - WALL_T;
  const hz = b.d / 2 - WALL_T;
  const type = room.ceilingType;
  const y = type === 'open' ? room.fh - 0.3 : room.ceil;
  const mat = M.ceilingFinish(type, room.ceilingColor);
  B.quad(mat, [-hx, y, -hz], [hx, y, -hz], [hx, y, hz], [-hx, y, hz], [-hx, -hz, hx, -hz, hx, hz, -hx, hz]);
  const lamp = M.glow('#fff8ec', 1.5);
  if (type === 'open') {
    // The structure overhead: joists across the short span, girders the long way.
    const steel = M.painted('#d9d6cc', 0.6);
    const alongX = b.w >= b.d;
    const span = alongX ? hz : hx;
    const run = alongX ? hx : hz;
    const jd = Math.min(2.4, Math.max(1, span / 12));
    for (let s = -run + 3; s < run - 1; s += 6) {
      for (const dy of [0, -jd]) {
        if (alongX) B.box(steel, 0.35, 0.18, span * 2, s, y - 0.1 + dy, 0);
        else B.box(steel, span * 2, 0.18, 0.35, 0, y - 0.1 + dy, s);
      }
      if (alongX) B.box(steel, 0.06, jd, span * 2, s, y - 0.1 - jd / 2, 0);
      else B.box(steel, span * 2, jd, 0.06, 0, y - 0.1 - jd / 2, s);
    }
    for (let k = -1; k <= 1; k += 2) {
      const off = k * span * 0.5;
      if (alongX) B.box(steel, run * 2, jd + 0.9, 0.7, 0, y - 0.3 - (jd + 0.9) / 2, off);
      else B.box(steel, 0.7, jd + 0.9, run * 2, off, y - 0.3 - (jd + 0.9) / 2, 0);
    }
    if (room.autoLights) {
      // Strip lights on chains under the joists.
      const ly = Math.max(10, y - jd - 2.2);
      const nx = Math.max(1, Math.round((hx * 2) / 22));
      const nz = Math.max(1, Math.round((hz * 2) / 22));
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        const x = -hx + ((i + 0.5) * hx * 2) / nx;
        const z = -hz + ((j + 0.5) * hz * 2) / nz;
        B.box(M.painted('#f1f2f0', 0.5), 0.9, 0.22, 4.2, x, ly + 0.11, z);
        B.box(lamp, 0.7, 0.05, 4, x, ly - 0.02, z);
        for (const dz of [-1.7, 1.7]) B.box(steel, 0.03, y - jd - ly - 0.1, 0.03, x, (y - jd + ly) / 2, z + dz);
        lights.push({ x, y: ly - 0.2, z, power: 1300, range: 60, angle: 78, color: '#fff3e0' });
      }
    }
  } else if (room.autoLights) {
    // Lay-in troffers (or downlights in plaster and timber) on a regular grid.
    const tile = type === 'tile';
    const sx = tile ? 8 : 6;
    const sz = tile ? 10 : 6;
    const nx = Math.max(1, Math.round((hx * 2) / sx));
    const nz = Math.max(1, Math.round((hz * 2) / sz));
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      let x = -hx + ((i + 0.5) * hx * 2) / nx;
      let z = -hz + ((j + 0.5) * hz * 2) / nz;
      if (tile) { x = Math.round(x / 2) * 2 + 1; z = Math.round(z / 2) * 2 + 2; }
      if (Math.abs(x) > hx - 1 || Math.abs(z) > hz - 2) continue;
      if (tile) {
        B.box(M.painted('#f6f6f3', 0.5), 2, 0.06, 4, x, y - 0.02, z);
        B.box(lamp, 1.76, 0.04, 3.76, x, y - 0.045, z);
        B.box(M.painted('#f6f6f3', 0.5), 0.05, 0.05, 3.76, x, y - 0.06, z);
      } else {
        B.add(cylGeo(0.3, 0.3, 0.06, 16), M.painted('#f6f6f3', 0.5), { pos: [x, y - 0.02, z] });
        B.add(cylGeo(0.23, 0.23, 0.04, 16), lamp, { pos: [x, y - 0.045, z] });
      }
      if ((i + j) % 2 === 0) lights.push({ x, y: y - 0.2, z, power: tile ? 620 : 380, range: 34, angle: 80, color: '#fff3e0' });
    }
  }
  const g = B.finish(new THREE.Group(), { cast: true, receive: false });
  g.name = 'ceiling';
  return { group: g, lights };
}

/* ------------------------------------------------------------ partitions */

/** Doors and internal windows cut their own holes through any wall they stand in. */
function cutsFor(wall, items) {
  const cuts = [];
  for (const it of items) {
    const spec = ITEM_BY_ID[it.type];
    if (!spec || !spec.cut) continue;
    const n = nearWall(wall, it.x, it.y);
    if (n.dist > 0.75) continue;
    // Only a door lying along the wall cuts it.
    const a = (it.rot || 0) * DEG;
    const along = Math.abs(Math.cos(a) * n.ux + Math.sin(a) * n.uy);
    if (along < 0.9) continue;
    const half = (it.w || spec.cut.w || spec.w) / 2;
    const s = n.t * n.len;
    if (s + half < 0.05 || s - half > n.len - 0.05) continue;
    cuts.push({ s0: Math.max(0, s - half), s1: Math.min(n.len, s + half), h0: spec.cut.h0 || 0, h1: spec.cut.h1 || 7 });
  }
  return cuts.sort((p, q) => p.s0 - q.s0);
}

/** The solid pieces of a partition as [s0, s1, h0, h1] along it: the runs
 *  between doorways, and what stands under and over each door or window. */
export function wallRuns(wall, items, H, t = 0.4) {
  const len = Math.hypot(wall.b[0] - wall.a[0], wall.b[1] - wall.a[1]);
  const solid = [];
  let at = -t / 2;                       // run a little past each end so corners close
  for (const c of cutsFor(wall, items)) {
    if (c.s0 > at) solid.push([at, c.s0, 0, H]);
    if (c.h0 > 0.05) solid.push([c.s0, c.s1, 0, Math.min(H, c.h0)]);
    if (H > c.h1 + 0.05) solid.push([c.s0, c.s1, c.h1, H]);
    at = Math.max(at, c.s1);
  }
  if (len + t / 2 > at) solid.push([at, len + t / 2, 0, H]);
  return solid;
}

function buildWalls(b, room, L) {
  const BF = new Builder();
  const BS = new Builder();
  const cutMat = M.plastic('#2f343a', 0.8);
  for (const wall of L.walls) {
    const type = WALL_BY_ID[wall.type] || WALL_BY_ID.drywall;
    const dx = wall.b[0] - wall.a[0];
    const dy = wall.b[1] - wall.a[1];
    const len = Math.hypot(dx, dy);
    if (len < 0.2) continue;
    const ux = dx / len;
    const uz = dy / len;
    const rotY = Math.atan2(-uz, ux);
    const t = type.t;
    const H = wallHeight(wall, room);
    const ox = wall.a[0] - b.w / 2;
    const oz = wall.a[1] - b.d / 2;
    // A box along the wall from s0 to s1, h0 to h1, `d` thick and `off` to one side.
    const seg = (B, mat, s0, s1, h0, h1, d = t, off = 0) => {
      if (s1 - s0 < 0.02 || h1 - h0 < 0.02) return;
      const sm = (s0 + s1) / 2;
      B.box(mat, s1 - s0, h1 - h0, d, ox + ux * sm - uz * off, (h0 + h1) / 2, oz + uz * sm + ux * off, [0, rotY, 0]);
    };
    const solid = wallRuns(wall, L.items, H, t);
    const color = wall.color || (type.colors ? type.colors[0] : room.wallColor);
    for (const [s0, s1, h0, h1] of solid) {
      switch (type.id) {
        case 'glass': {
          const fr = M.frame(true);
          seg(BF, fr, s0, s1, h0, Math.max(h0, Math.min(h1, 0.3)));
          seg(BF, fr, s0, s1, Math.max(h0, h1 - 0.22), h1);
          seg(BF, M.clearGlass('#b9d3dc'), s0, s1, Math.max(h0, 0.3), h1 - 0.22, 0.04);
          const n = Math.max(1, Math.round((s1 - s0) / 4));
          for (let i = 0; i <= n; i++) {
            const s = s0 + ((s1 - s0) * i) / n;
            seg(BF, fr, Math.max(s0, s - 0.07), Math.min(s1, s + 0.07), h0, h1);
          }
          // A frosted band at eye level, as glass walls carry so nobody walks into them.
          if (h0 < 3 && h1 > 5) seg(BF, M.clearGlass('#f4f7f8'), s0 + 0.1, s1 - 0.1, 3.3, 4.4, 0.06);
          break;
        }
        case 'block': seg(BF, M.wall('splitface', color), s0, s1, h0, h1); break;
        case 'brick': seg(BF, M.wall('brick', wall.color || '#9c5b47'), s0, s1, h0, h1); break;
        case 'timber': {
          const wood = M.grain(wall.color || '#a8743f', 0.6);
          seg(BF, wood, s0, s1, h0, Math.min(h1, h0 + 0.25));
          seg(BF, wood, s0, s1, Math.max(h0, h1 - 0.2), h1);
          for (let s = s0 + 0.12; s < s1 - 0.05; s += 0.42) seg(BF, wood, s, Math.min(s1, s + 0.14), h0, h1, t * 0.8);
          break;
        }
        case 'cubicle': {
          seg(BF, M.cloth(color), s0, s1, Math.max(h0, 0.35), h1 - 0.12, t * 0.8);
          seg(BF, M.painted('#3a3f45', 0.5), s0, s1, h0, Math.min(h1, 0.35));
          seg(BF, M.metal('#b9bfc4', 0.4), s0, s1, h1 - 0.12, h1, t * 1.15);
          break;
        }
        case 'mesh': {
          const steel = M.painted('#f2c318', 0.5);
          seg(BF, steel, s0, s1, h0, Math.min(h1, h0 + 0.15));
          seg(BF, steel, s0, s1, h1 - 0.15, h1);
          const n = Math.max(1, Math.round((s1 - s0) / 5));
          for (let i = 0; i <= n; i++) {
            const s = s0 + ((s1 - s0) * i) / n;
            seg(BF, steel, Math.max(s0, s - 0.08), Math.min(s1, s + 0.08), h0, h1, 0.16);
          }
          const p = (s, h) => [ox + ux * s, h, oz + uz * s];
          BF.quad(M.meshFence(), p(s0, h0), p(s1, h0), p(s1, h1), p(s0, h1), [s0, h0, s1, h0, s1, h1, s0, h1]);
          BF.quad(M.meshFence(), p(s1, h0), p(s0, h0), p(s0, h1), p(s1, h1), [s1, h0, s0, h0, s0, h1, s1, h1]);
          break;
        }
        case 'rail': {
          const steel = M.metal('#c9ced3', 0.3);
          seg(BF, M.clearGlass('#b9d3dc'), s0, s1, Math.max(h0, 0.25), h1 - 0.12, 0.04);
          seg(BF, steel, s0, s1, h1 - 0.12, h1, 0.18);
          const n = Math.max(1, Math.round((s1 - s0) / 4));
          for (let i = 0; i <= n; i++) {
            const s = s0 + ((s1 - s0) * i) / n;
            seg(BF, steel, Math.max(s0, s - 0.06), Math.min(s1, s + 0.06), h0, h1, 0.14);
          }
          break;
        }
        case 'curtain': {
          // A ceiling track and a pleated curtain hanging to just off the floor.
          seg(BF, M.metal('#c9ced3', 0.4), s0, s1, room.ceil - 0.12, room.ceil, 0.1);
          const cloth = M.fabric(color);
          const p = (s, h, o) => [ox + ux * s - uz * o, h, oz + uz * s + ux * o];
          const pleats = Math.max(4, Math.round((s1 - s0) / 0.45));
          for (let i = 0; i < pleats; i++) {
            const a0 = s0 + ((s1 - s0) * i) / pleats;
            const a1 = s0 + ((s1 - s0) * (i + 1)) / pleats;
            const o0 = i % 2 ? 0.09 : -0.09;
            BF.quad(cloth, p(a0, 0.9, o0), p(a1, 0.9, -o0), p(a1, h1, -o0), p(a0, h1, o0));
          }
          seg(BF, M.meshFence(), s0, s1, h1, room.ceil - 0.12, 0.02);
          break;
        }
        case 'half': {
          seg(BF, M.wallPaint(color), s0, s1, h0, h1 - 0.1);
          seg(BF, M.grain('#a8743f', 0.5), s0, s1, h1 - 0.1, h1, t + 0.18);
          break;
        }
        default: {
          seg(BF, M.wallPaint(color), s0, s1, h0, h1);
          if (h0 < 0.05) {
            // Skirting both sides.
            const sk = M.laminate('#f4f3ef', 0.5);
            seg(BF, sk, s0, s1, 0, 0.34, 0.05, t / 2 + 0.025);
            seg(BF, sk, s0, s1, 0, 0.34, 0.05, -t / 2 - 0.025);
          }
        }
      }
    }
    // Cut down: a stub along the solid runs that reach the floor.
    for (const [s0, s1, h0] of solid) if (h0 < 0.05) seg(BS, cutMat, s0, s1, 0, Math.min(STUB, H), t);
  }
  const full = BF.finish(new THREE.Group());
  const stub = BS.finish(new THREE.Group(), { cast: false });
  stub.visible = false;
  const g = new THREE.Group();
  g.name = 'walls';
  g.add(full, stub);
  return { group: g, full, stub };
}

/* --------------------------------------------------------------- the view */

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _up = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3();

export class InteriorView {
  constructor(engine, world) {
    this.E = engine;
    this.world = world;
    this.root = new THREE.Group();
    this.root.name = 'interior';
    this.root.visible = false;
    engine.scene.add(this.root);
    this.marks = new THREE.Group();          // selection, ghost, drawing guides: never picked
    this.marks.userData.noPick = true;
    this.items = new THREE.Group();
    this.items.name = 'items';
    this.root.add(this.items, this.marks);
    this.sig = {};
    this.b = null;
    this.view = 'cut';
    this.walking = false;
  }

  get active() { return !!this.b; }

  /** Open a building's storey: its own model steps aside for this one. */
  open(b, level) {
    if (this.b && this.b.id !== b.id) this.close();
    this.b = b;
    this.level = level;
    this.root.visible = true;
    this.sig = {};
    this.sync(b, level);
  }

  close() {
    if (!this.b) return;
    const g = this.world.get(this.b.id);
    if (g) g.visible = true;
    this.b = null;
    this.root.visible = false;
    for (const key of ['shell', 'floor', 'ceiling', 'walls']) this.drop(key);
    this.clearItems();
    this.clearMarks();
    this.world.indoorLights = null;
    this.world.collectLights();
    this.E.shadowDirty = true;
    this.E.moved = true;
  }

  drop(key) {
    const part = this[key];
    if (!part) return;
    const g = part.group || part;
    this.root.remove(g);
    g.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    this[key] = null;
  }

  clearItems() {
    for (const c of [...this.items.children]) { this.items.remove(c); c.dispose?.(); }
    this.slots = new Map();
  }

  clearMarks() {
    for (const c of [...this.marks.children]) {
      this.marks.remove(c);
      c.traverse((o) => { if (o.geometry && o.userData.own) o.geometry.dispose(); });
    }
    this.selBox = null;
    this.ghost = null;
    this.guide = null;
  }

  /** Bring the model up to date with the building. Only what changed is rebuilt. */
  sync(b = this.b, level = this.level) {
    if (!b) return;
    this.b = b;
    this.level = level;
    const E = this.E;
    const ext = this.world.get(b.id);
    if (ext) ext.visible = false;
    const room = this.room = roomOf(b);
    const L = levelOf(b, level);
    const fp = footprint(b);
    // The finished floor sits a step above the paving outside.
    this.root.position.set(fp.x + fp.w / 2, level * room.fh + FLOOR_UP, fp.y + fp.d / 2);
    this.root.rotation.y = -(b.rot || 0) * DEG;
    this.root.updateMatrixWorld(true);
    const sig = {
      shell: JSON.stringify([b.w, b.d, b.floors, b.height, b.walls, b.cladding, b.wall, level, room.wallColor]),
      floor: JSON.stringify([b.w, b.d, room.floor, room.floorColor, L.areas]),
      ceiling: JSON.stringify([b.w, b.d, room.fh, room.ceil, room.ceilingType, room.ceilingColor, room.autoLights]),
      walls: JSON.stringify([b.w, b.d, L.walls, room.ceil, room.ceilingType, room.wallColor, L.items.filter((i) => (ITEM_BY_ID[i.type] || {}).cut).map((i) => [i.type, i.x, i.y, i.rot, i.w])]),
    };
    let changed = false;
    if (sig.shell !== this.sig.shell) { this.drop('shell'); this.shell = buildShell(b, level, room); this.root.add(this.shell.group); changed = true; }
    if (sig.floor !== this.sig.floor) { this.drop('floor'); this.floor = buildFloor(b, room, L); this.root.add(this.floor); changed = true; }
    if (sig.ceiling !== this.sig.ceiling) { this.drop('ceiling'); this.ceiling = buildCeiling(b, room); this.root.add(this.ceiling.group); changed = true; }
    if (sig.walls !== this.sig.walls) { this.drop('walls'); this.walls = buildWalls(b, room, L); this.root.add(this.walls.group); changed = true; }
    this.sig = { ...this.sig, ...sig };
    if (this.syncItems(b, L, room)) changed = true;
    if (changed) {
      this.applyView();
      this.collectLights(L, room);
      E.shadowDirty = true;
    }
    E.moved = true;
  }

  /** Where an item's instance stands, in the storey's frame. */
  matrixOf(it, room = this.room) {
    const spec = ITEM_BY_ID[it.type] || {};
    const y = spec.ceil ? room.ceil : (it.lift || 0);
    _q.setFromAxisAngle(_up, -(it.rot || 0) * DEG);
    return _m.compose(_p.set(it.x - this.b.w / 2, y, it.y - this.b.d / 2), _q, _s);
  }

  syncItems(b, L, room) {
    const kitSig = JSON.stringify(L.items.map((it) => { const { x, y, rot, lift, ...rest } = it; return rest; }));
    const posSig = JSON.stringify(L.items.map((it) => [it.x, it.y, it.rot, it.lift])) + room.ceil;
    if (kitSig === this.sig.kits && posSig === this.sig.pos) return false;
    if (kitSig !== this.sig.kits) {
      // Membership changed: regroup the items by kit and make fresh instances.
      this.clearItems();
      const groups = new Map();
      for (const it of L.items) {
        const kit = kitFor(it);
        if (!kit) continue;
        if (!groups.has(kit.key)) groups.set(kit.key, { kit, list: [] });
        groups.get(kit.key).list.push(it);
      }
      for (const { kit, list } of groups.values()) {
        const meshes = kit.parts.map((part) => {
          const mesh = new THREE.InstancedMesh(part.geo, part.mat, list.length);
          const lit = part.mat.blending === THREE.AdditiveBlending;
          mesh.castShadow = !part.mat.transparent && !lit;
          mesh.receiveShadow = true;
          mesh.userData.items = list.map((it) => it.id);
          mesh.frustumCulled = false;
          this.items.add(mesh);
          return mesh;
        });
        list.forEach((it, i) => this.slots.set(it.id, { meshes, i, kit }));
      }
    }
    for (const it of L.items) this.moveItem(it, room, false);
    for (const mesh of this.items.children) { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); }
    this.sig.kits = kitSig;
    this.sig.pos = posSig;
    return true;
  }

  /** Re-place one item (while it is dragged) without rebuilding anything. */
  moveItem(it, room = this.room, flush = true) {
    const slot = this.slots.get(it.id);
    if (!slot) return;
    const m = this.matrixOf(it, room);
    for (const mesh of slot.meshes) {
      mesh.setMatrixAt(slot.i, m);
      if (flush) { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); }
    }
    if (flush) { this.E.moved = true; this.E.shadowDirty = true; }
  }

  /** Lamps on this storey, in world space, for the night-light pool. */
  collectLights(L, room) {
    const list = [];
    const push = (x, y, z, l) => {
      _v.set(x, y, z).applyMatrix4(this.root.matrixWorld);
      list.push({ x: _v.x, y: _v.y, z: _v.z, tx: _v.x, tz: _v.z, ty: this.root.position.y, color: l.color || '#fff1dc', power: l.power || 500, range: l.range || 40, angle: l.angle || 75, pool: 0, indoor: true });
    };
    if (this.walking || this.view !== 'down') {
      for (const l of this.ceiling ? this.ceiling.lights : []) push(l.x, l.y, l.z, l);
    }
    for (const it of L.items) {
      const kit = kitFor(it);
      if (!kit || !kit.lights.length) continue;
      const spec = ITEM_BY_ID[it.type] || {};
      const a = -(it.rot || 0) * DEG;
      const by = spec.ceil ? room.ceil : (it.lift || 0);
      for (const l of kit.lights) {
        const x = it.x - this.b.w / 2 + l.x * Math.cos(a) + l.z * Math.sin(a);
        const z = it.y - this.b.d / 2 - l.x * Math.sin(a) + l.z * Math.cos(a);
        push(x, by + l.y, z, l);
      }
    }
    this.world.indoorLights = list;
    this.world.collectLights();
  }

  /** Walls up, cut away toward the camera, or all down; the ceiling only when inside. */
  setView(view, walking) {
    this.view = view;
    this.walking = walking;
    this.applyView();
    if (this.b) this.collectLights(levelOf(this.b, this.level), this.room);
  }

  applyView() {
    if (!this.shell) return;
    const inside = this.walking;
    if (this.ceiling) this.ceiling.group.visible = inside;
    const down = !inside && this.view === 'down';
    if (this.walls) { this.walls.full.visible = !down; this.walls.stub.visible = down; }
    this.cutaway(true);
    this.E.shadowDirty = true;
    this.E.moved = true;
  }

  /** Each frame: drop the outside walls that stand between the camera and the rooms. */
  cutaway(force = false) {
    if (!this.shell) return;
    const inside = this.walking;
    const cam = _v.copy(this.E.camera.position);
    this.root.worldToLocal(cam);
    let changed = false;
    for (const face of FACES) {
      const f = this.shell.faces[face];
      let cut = false;
      if (!inside) {
        if (this.view === 'down') cut = true;
        else if (this.view === 'cut') {
          // Outside this wall's plane, and looking in over it.
          const out = (cam.x - f.o[0]) * f.n[0] + (cam.z - f.o[1]) * f.n[1];
          cut = out > 1;
        }
      }
      if (f.stub.visible !== cut || force) {
        f.stub.visible = cut;
        f.full.visible = !cut;
        changed = true;
      }
    }
    if (changed) { this.E.shadowDirty = true; this.E.moved = true; }
  }

  /* ------------------------------------------------------------ picking */

  /** Where the pointer meets the floor of this storey, in the building's own feet. */
  floorAt(ev, lift = 0) {
    const g = this.E.groundAt(ev, this.root.position.y + lift);
    if (!g) return null;
    _v.set(g.x, 0, g.y);
    this.root.worldToLocal(_v);
    return { x: _v.x + this.b.w / 2, y: _v.z + this.b.d / 2 };
  }

  /** A building-local point in the world. */
  toWorld(x, y, h = 0) {
    return new THREE.Vector3(x - this.b.w / 2, h, y - this.b.d / 2).applyMatrix4(this.root.matrixWorld);
  }

  /** The item under the pointer, if any. */
  pickItem(ev) {
    const ray = this.E.rayFrom(ev);
    const hits = ray.intersectObjects(this.items.children, false);
    for (const h of hits) {
      const ids = h.object.userData.items;
      if (ids && h.instanceId != null) return { id: ids[h.instanceId], point: h.point, distance: h.distance };
    }
    return null;
  }

  /** The partition under the pointer: the one nearest where the ray lands. */
  pickWall(ev, L) {
    const ray = this.E.rayFrom(ev);
    let at = null;
    if (this.walls) {
      const hit = ray.intersectObjects(this.walls.group.children, true).find((h) => h.object.visible && h.object.parent.visible);
      if (hit) { _v.copy(hit.point); this.root.worldToLocal(_v); at = { x: _v.x + this.b.w / 2, y: _v.z + this.b.d / 2, exact: true, distance: hit.distance }; }
    }
    if (!at) return null;
    let best = null;
    for (const w of L.walls) {
      const n = nearWall(w, at.x, at.y);
      if (n.dist < 0.9 && (!best || n.dist < best.dist)) best = { wall: w, dist: n.dist, distance: at.distance };
    }
    return best;
  }

  /* -------------------------------------------------------------- marks */

  /** A box round the selected item, or a line along the selected wall. */
  select(sel, L) {
    if (this.selBox) { this.marks.remove(this.selBox); this.selBox.geometry.dispose(); this.selBox = null; }
    if (!sel || !this.b) { this.E.moved = true; return; }
    const mat = SEL_MAT;
    if (sel.kind === 'item') {
      const it = L.items.find((i) => i.id === sel.id);
      if (!it) return;
      const s = itemSize(it);
      const spec = ITEM_BY_ID[it.type] || {};
      const bg = new THREE.BoxGeometry(s.w + 0.16, s.h + 0.1, s.d + 0.16);
      // Things fixed to a wall are modelled from the wall outward, at their own height.
      if (spec.wall) bg.translate(0, spec.mount ? spec.mount - s.h / 2 : 0, s.d / 2);
      const geo = new THREE.EdgesGeometry(bg);
      const box = new THREE.LineSegments(geo, mat);
      const y = spec.ceil ? this.room.ceil - s.h / 2 : (it.lift || 0) + s.h / 2;
      box.position.set(it.x - this.b.w / 2, y, it.y - this.b.d / 2);
      box.rotation.y = -(it.rot || 0) * DEG;
      this.selBox = box;
    } else if (sel.kind === 'wall') {
      const w = L.walls.find((i) => i.id === sel.id);
      if (!w) return;
      const H = wallHeight(w, this.room) + 0.08;
      const t = (WALL_BY_ID[w.type] || { t: 0.4 }).t + 0.14;
      const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
      const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(len + 0.14, H, t)), mat);
      box.position.set((w.a[0] + w.b[0]) / 2 - this.b.w / 2, H / 2, (w.a[1] + w.b[1]) / 2 - this.b.d / 2);
      box.rotation.y = Math.atan2(-(w.b[1] - w.a[1]), w.b[0] - w.a[0]);
      this.selBox = box;
    } else if (sel.kind === 'area') {
      const a = (L.areas || []).find((i) => i.id === sel.id);
      if (!a) return;
      const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(a.w, 0.1, a.d)), mat);
      box.position.set(a.x + a.w / 2 - this.b.w / 2, 0.1, a.y + a.d / 2 - this.b.d / 2);
      this.selBox = box;
    }
    if (this.selBox) {
      this.selBox.renderOrder = 10;
      this.selBox.userData.own = true;
      this.marks.add(this.selBox);
    }
    this.E.moved = true;
  }

  /** The thing about to be placed, following the pointer. */
  setGhost(item, ok = true) {
    if (!item) {
      if (this.ghost) { this.marks.remove(this.ghost); this.ghost = null; this.E.moved = true; }
      return;
    }
    const kit = kitFor(item);
    if (!kit) return;
    if (!this.ghost || this.ghost.userData.key !== kit.key) {
      if (this.ghost) this.marks.remove(this.ghost);
      const g = new THREE.Group();
      for (const part of kit.parts) {
        const mesh = new THREE.Mesh(part.geo, part.mat);
        mesh.castShadow = false;
        g.add(mesh);
      }
      const s = itemSize(item);
      const rg = new THREE.BoxGeometry(s.w + 0.1, 0.06, s.d + 0.1);
      if ((ITEM_BY_ID[item.type] || {}).wall) rg.translate(0, 0, s.d / 2);
      const ring = new THREE.LineSegments(new THREE.EdgesGeometry(rg), GHOST_MAT.clone());
      ring.userData.own = true;
      ring.userData.ring = true;
      ring.position.y = ((ITEM_BY_ID[item.type] || {}).ceil ? -s.h : 0) + 0.06;
      g.add(ring);
      g.userData.key = kit.key;
      this.ghost = g;
      this.marks.add(g);
    }
    const spec = ITEM_BY_ID[item.type] || {};
    this.ghost.position.set(item.x - this.b.w / 2, spec.ceil ? this.room.ceil : (item.lift || 0), item.y - this.b.d / 2);
    this.ghost.rotation.y = -(item.rot || 0) * DEG;
    for (const c of this.ghost.children) if (c.userData.ring) c.material.color.set(ok ? 0x5fd08a : 0xf0524d);
    this.E.moved = true;
  }

  /** Lines for the wall or floor patch being drawn: points are building-local [x, y]. */
  setGuide(points, { closed = false, color = 0x46b4ff, h = 0.15 } = {}) {
    if (this.guide) { this.marks.remove(this.guide); this.guide.geometry.dispose(); this.guide = null; }
    if (points && points.length > 1) {
      const pts = points.map(([x, y]) => new THREE.Vector3(x - this.b.w / 2, h, y - this.b.d / 2));
      if (closed) pts.push(pts[0].clone());
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true }));
      line.renderOrder = 11;
      line.userData.own = true;
      this.guide = line;
      this.marks.add(line);
    }
    this.E.moved = true;
  }
}

const SEL_MAT = new THREE.LineBasicMaterial({ color: 0x46b4ff, depthTest: false, transparent: true });
const GHOST_MAT = new THREE.LineBasicMaterial({ color: 0x5fd08a, depthTest: false, transparent: true });

export { PI };
