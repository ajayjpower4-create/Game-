/* Turns the design state into an isometric drawing of the site.
 *
 * Everything here is laid out in feet on a lot that runs x = 0..lot.width and
 * y = 0..lot.depth, with y = depth being the street edge nearest the viewer. */

import { makeCamera, drawBox, boxFaces, pad, line, faceText, shade, mixHex } from './iso.js';
import { FLOOR_HEIGHT, BAY_SPACING, STALL } from './catalog.js';

/* A tiny seeded generator, so parked cars and lit windows stay put between
 * redraws instead of shuffling every time a slider moves. */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/* Sorting key for a mass: the depth of its nearest footprint corner. Using the
 * centroid instead lets a long building sort behind a small thing tucked into
 * its own front corner. */
const nearKey = (cam, b) => Math.max(
  cam.depth(b.x, b.y), cam.depth(b.x + b.w, b.y),
  cam.depth(b.x, b.y + b.d), cam.depth(b.x + b.w, b.y + b.d),
);

/** True when a wall with this outward normal is turned toward the camera. */
const facing = (cam, nx, ny) => cam.depth(nx, ny) > cam.depth(0, 0);

/* ------------------------------------------------------------------ layout */

/** Work out where every mass sits before anything is drawn. */
export function layout(state) {
  const { lot, body, office, type } = state;
  const L = { lot, type };

  const isTower = type === 'tower';
  const isStorage = type === 'storage';

  const len = clamp(body.length, 60, lot.width - 60);
  const wid = clamp(body.width, 30, lot.depth - 180);
  const x0 = (lot.width - len) / 2;
  const y0 = 46;

  L.main = { x: x0, y: y0, w: len, d: wid, z0: 0, z1: isTower ? Math.max(2, body.floors) * FLOOR_HEIGHT : body.height };
  L.front = y0 + wid;              // the building's street-facing wall
  L.yard = lot.depth - L.front;    // everything in front of it

  // Storage rows march forward from the back of the lot, an aisle apart.
  if (isStorage) {
    const gap = wid + 44;
    const room = Math.max(1, Math.floor((lot.depth - y0 - 150) / gap) + 1);
    const rows = clamp(Math.round(body.rows ?? 3), 1, Math.min(5, room));
    L.rows = [];
    for (let i = 0; i < rows; i++) L.rows.push({ x: x0, y: y0 + i * gap, w: len, d: wid, z0: 0, z1: body.height });
    L.frontRow = L.rows[L.rows.length - 1];
    L.front = L.frontRow.y + wid;
    L.yard = lot.depth - L.front;
  }

  // The office end: a taller, slightly forward chunk of the same building.
  const oLen = clamp(office.length, 30, len - 20);
  L.office = null;
  if (office.on && !isTower) {
    const ox = office.side === 'right' ? x0 + len - oLen : x0;
    const oy = isStorage && L.frontRow ? L.frontRow.y : y0;
    L.office = {
      x: ox, y: oy, w: oLen, d: wid + 14, z0: 0,
      // Always at least a touch taller than the shell, so the office end reads
      // as its own mass from the street instead of hiding behind the warehouse.
      z1: Math.max(office.floors * FLOOR_HEIGHT, L.main.z1 + 4),
      side: office.side,
    };
  }
  if (isTower) {
    // The tower gets a podium instead of an office wing. It only reaches
    // forward — wrapping it round the back would bury the tower behind its
    // own roof slab.
    L.office = { x: x0 - 22, y: y0 + wid - 26, w: len + 44, d: 52, z0: 0, z1: 15, side: 'podium' };
  }

  // Dock bays live on the stretch of front wall the office does not take.
  L.dockRun = null;
  if (state.type === 'warehouse') {
    const from = L.office && L.office.side === 'left' ? x0 + oLen + 8 : x0 + 8;
    const to = L.office && L.office.side === 'right' ? x0 + len - oLen - 8 : x0 + len - 8;
    const span = to - from;
    const bays = clamp(Math.round(body.bays), 0, Math.max(0, Math.floor(span / BAY_SPACING)));
    L.dockRun = { from, to, bays, span };
  }

  // Front door sits on whichever mass reads as the entrance.
  const doorHost = L.office && L.office.side !== 'podium' ? L.office : L.main;
  L.entry = { x: doorHost.x + doorHost.w / 2, y: doorHost.y + doorHost.d, host: doorHost };

  // Drive, gate and booth line up with the entrance.
  L.driveX = clamp(L.entry.x - (L.office && L.office.side === 'right' ? -70 : 70), 70, lot.width - 70);
  L.gateY = lot.depth - clamp(L.yard * 0.32, 34, 90);
  L.booth = { x: L.driveX - 46, y: L.gateY - 9, w: 26, d: 18, z0: 0, z1: 10 };
  L.monument = { x: L.driveX + 30, y: L.gateY + 4, w: 3, d: 22, z0: 0, z1: 15 };

  return L;
}

/* -------------------------------------------------------------- wall detail */

function glass(night, r) {
  if (!night) return r() > 0.75 ? '#a9c8dc' : '#89aec8';
  return r() > 0.45 ? '#ffd489' : '#232c3b';
}

/** Windows on one wall face, in whichever of the three styles is selected. */
function windows(face, opts) {
  const { style, floors, night, seed = 7, t0 = 4, t1 = face.len - 4, base = 0, glassStroke = 'rgba(20,30,45,.35)' } = opts;
  const r = rng(seed);
  const span = t1 - t0;
  if (span < 6 || floors < 1) return '';
  let out = '';
  for (let f = 0; f < floors; f++) {
    const fh = base + f * FLOOR_HEIGHT;
    if (fh + FLOOR_HEIGHT > face.height + 0.5) break;
    if (style === 'ribbon') {
      out += face.quad(t0, t1, fh + 4, fh + 10, { fill: glass(night, r), stroke: glassStroke, 'stroke-width': 0.5 });
      for (let t = t0 + 8; t < t1 - 2; t += 8) {
        out += face.quad(t, t + 0.4, fh + 4, fh + 10, { fill: 'rgba(255,255,255,.5)', stroke: 'none' });
      }
    } else if (style === 'curtain') {
      out += face.quad(t0, t1, fh + 1.5, fh + FLOOR_HEIGHT - 1.5, { fill: night ? '#1b2433' : '#8fb6cf', stroke: glassStroke, 'stroke-width': 0.5 });
      for (let t = t0; t < t1 - 1; t += 6) {
        const w = Math.min(6, t1 - t) - 0.6;
        out += face.quad(t, t + w, fh + 1.5, fh + FLOOR_HEIGHT - 1.5, { fill: glass(night, r), opacity: night ? 0.95 : 0.55, stroke: 'none' });
        out += face.quad(t + w, t + w + 0.6, fh, fh + FLOOR_HEIGHT, { fill: 'rgba(255,255,255,.55)', stroke: 'none' });
      }
    } else {
      const step = 11;
      for (let t = t0 + 3; t + 6 < t1; t += step) {
        out += face.quad(t, t + 6, fh + 4.5, fh + 10.5, { fill: glass(night, r), stroke: glassStroke, 'stroke-width': 0.5 });
        out += face.quad(t - 0.6, t + 6.6, fh + 10.5, fh + 11.2, { fill: 'rgba(255,255,255,.55)', stroke: 'none' });
      }
    }
  }
  return out;
}

/** A row of roll-up dock doors with bumpers and a shallow canopy. */
function dockDoors(face, run, worldToT, night) {
  if (!run || run.bays < 1) return '';
  let out = '';
  const dh = Math.min(13, face.height - 1.5);
  const step = run.span / run.bays;
  for (let i = 0; i < run.bays; i++) {
    const cx = run.from + step * (i + 0.5);
    const t = worldToT(cx);
    if (t < 3 || t > face.len - 3) continue;
    const w = Math.min(9, step - 2.5);
    const a = t - w / 2;
    const b = t + w / 2;
    out += face.quad(a, b, 0, dh, { fill: night ? '#1b222e' : '#3d4652', stroke: 'rgba(15,20,28,.5)', 'stroke-width': 0.5 });
    for (let h = 2; h < dh; h += 2.4) out += face.quad(a, b, h, h + 0.35, { fill: 'rgba(255,255,255,.14)', stroke: 'none' });
    if (dh > 9) {
      out += face.quad(a - 0.8, a + 0.4, 0, 3.5, { fill: '#20262f', stroke: 'none' });
      out += face.quad(b - 0.4, b + 0.8, 0, 3.5, { fill: '#20262f', stroke: 'none' });
      out += face.quad(a - 1.2, b + 1.2, dh, Math.min(face.height, dh + 1.6), { fill: 'rgba(20,28,40,.55)', stroke: 'none' });
    }
  }
  return out;
}

/* ------------------------------------------------------------------- props */

function trailer(cam, x, y, night) {
  const box = { x, y, w: 8.5, d: 45, z0: 4.2, z1: 17 };
  let out = drawBox(cam, box, { color: night ? '#c9ccd2' : '#f2f4f7', roof: night ? '#b9bdc4' : '#e6e9ee' });
  out += drawBox(cam, { x: x + 1, y: y + 34, w: 6.5, d: 9, z0: 0, z1: 4.2 }, { color: '#2c3340' });
  out += drawBox(cam, { x: x + 1, y: y + 2, w: 6.5, d: 7, z0: 0, z1: 4.2 }, { color: '#2c3340' });
  return out;
}

function car(cam, x, y, color, night) {
  let out = drawBox(cam, { x, y, w: 6, d: 14, z0: 0.6, z1: 4.2 }, { color, roof: shade(color, 1.12) });
  out += drawBox(cam, { x: x + 0.6, y: y + 3.5, w: 4.8, d: 6.5, z0: 4.2, z1: 5.8 }, { color: night ? '#243043' : '#9fb6c9' });
  return out;
}

function tree(cam, x, y, scale = 1, night = false) {
  const h = 9 * scale;
  let out = drawBox(cam, { x: x - 0.6, y: y - 0.6, w: 1.2, d: 1.2, z0: 0, z1: h }, { color: '#6b5340', stroke: 'none' });
  const [px, py] = cam.project(x, y, h + 7 * scale);
  out += `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${(9 * scale * cam.scale).toFixed(1)}" ry="${(7 * scale * cam.scale).toFixed(1)}" fill="${night ? '#1e3a28' : '#3f7a4a'}" stroke="rgba(20,45,25,.35)" stroke-width="0.8"/>`;
  out += `<ellipse cx="${(px - 3 * cam.scale).toFixed(1)}" cy="${(py - 3 * cam.scale).toFixed(1)}" rx="${(6 * scale * cam.scale).toFixed(1)}" ry="${(4.5 * scale * cam.scale).toFixed(1)}" fill="${night ? '#27462f' : '#4d9159'}" stroke="none"/>`;
  return out;
}

function lightPole(cam, x, y, night) {
  let out = '';
  if (night) {
    const [gx, gy] = cam.project(x, y, 0);
    out += `<ellipse cx="${gx.toFixed(1)}" cy="${gy.toFixed(1)}" rx="${(30 * cam.scale).toFixed(1)}" ry="${(17 * cam.scale).toFixed(1)}" fill="url(#pool)"/>`;
  }
  out += drawBox(cam, { x: x - 0.5, y: y - 0.5, w: 1, d: 1, z0: 0, z1: 26 }, { color: '#4a515c', stroke: 'none' });
  out += drawBox(cam, { x: x - 2, y: y - 1.6, w: 4, d: 3.2, z0: 26, z1: 27.4 }, {
    color: night ? '#ffe9b0' : '#6d7480',
    roof: night ? '#fff3d0' : '#7d848f',
    stroke: 'none',
  });
  return out;
}

function bollard(cam, x, y) {
  return drawBox(cam, { x: x - 0.7, y: y - 0.7, w: 1.4, d: 1.4, z0: 0, z1: 3.6 }, { color: '#e0a51f', roof: '#f2c04a', stroke: 'rgba(60,40,0,.4)' });
}

function person(cam, x, y, shirt) {
  let out = drawBox(cam, { x: x - 0.7, y: y - 0.5, w: 1.4, d: 1, z0: 0, z1: 3 }, { color: '#22262f', stroke: 'none' });
  out += drawBox(cam, { x: x - 0.9, y: y - 0.6, w: 1.8, d: 1.2, z0: 3, z1: 5.2 }, { color: shirt, stroke: 'none' });
  out += drawBox(cam, { x: x - 0.5, y: y - 0.4, w: 1, d: 0.8, z0: 5.2, z1: 6 }, { color: '#c99a72', stroke: 'none' });
  return out;
}

/** Chain-link-ish fence line with a gap left for the drive. */
function fenceLine(cam, x0, x1, y, gap) {
  let out = '';
  for (let x = x0; x <= x1; x += 10) {
    if (gap && x > gap[0] - 6 && x < gap[1] + 6) continue;
    out += drawBox(cam, { x: x - 0.4, y: y - 0.4, w: 0.8, d: 0.8, z0: 0, z1: 8 }, { color: '#2b3038', stroke: 'none' });
    if (x + 10 <= x1 && !(gap && x + 10 > gap[0] - 6 && x + 10 < gap[1] + 6)) {
      out += line(cam, [x, y, 7.6], [x + 10, y, 7.6], { stroke: '#2b3038', 'stroke-width': 1.2 });
      out += line(cam, [x, y, 4], [x + 10, y, 4], { stroke: 'rgba(43,48,56,.45)', 'stroke-width': 0.8 });
    }
  }
  return out;
}

/* ------------------------------------------------------------------- scene */

export function render(state, size) {
  const L = layout(state);
  const night = state.view.time === 'night';
  const { lot } = state;
  // After dark the building is lit only by the lot lights, so the whole palette
  // drops before any face shading happens.
  const wall = night ? mixHex(state.skin.wall, 0.42) : state.skin.wall;
  const band = night ? mixHex(state.skin.band, 0.5) : state.skin.band;
  const r = rng(1337);

  // Fit the whole lot (and the tallest roof) into the frame.
  const probe = makeCamera({ rot: state.view.rot, scale: 1, cx: lot.width / 2, cy: lot.depth / 2, ox: 0, oy: 0 });
  const maxZ = Math.max(L.main.z1, L.office ? L.office.z1 : 0, 30);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of [[-6, -6], [lot.width + 6, -6], [lot.width + 6, lot.depth + 34], [-6, lot.depth + 34]]) {
    for (const z of [0, maxZ]) {
      const [px, py] = probe.project(x, y, z);
      minX = Math.min(minX, px); maxX = Math.max(maxX, px);
      minY = Math.min(minY, py); maxY = Math.max(maxY, py);
    }
  }
  const fit = Math.min(size.w / (maxX - minX), size.h / (maxY - minY)) * 0.99 * (state.view.zoom || 1);
  const cam = makeCamera({
    rot: state.view.rot,
    scale: fit,
    cx: lot.width / 2,
    cy: lot.depth / 2,
    ox: size.w / 2 - ((minX + maxX) / 2) * fit,
    oy: size.h / 2 - ((minY + maxY) / 2) * fit,
  });

  const pal = night
    ? { grass: '#1c3326', asphalt: '#20242c', stripe: '#5c6472', walk: '#333a45', road: '#191d24' }
    : { grass: '#5c8f52', asphalt: '#4a4f58', stripe: '#e8e3cf', walk: '#b9bec6', road: '#3c414a' };

  let out = '';

  /* --- ground ------------------------------------------------------------ */
  out += pad(cam, { x: -30, y: -30, w: lot.width + 60, d: lot.depth + 100, z: -0.2 }, { fill: pal.grass });
  out += pad(cam, { x: -30, y: lot.depth + 8, w: lot.width + 60, d: 46 }, { fill: pal.road });
  out += pad(cam, { x: -30, y: lot.depth + 29, w: lot.width + 60, d: 1.4 }, { fill: night ? '#6a6a52' : '#d9cf92' });

  // Yard paving in front of the building, plus the drive out to the street.
  // A storage compound is paved all the way back, since the aisles between the
  // rows are drive lanes.
  const paveY = state.type === 'storage' ? L.main.y - 14 : L.front;
  out += pad(cam, { x: L.main.x - 40, y: paveY, w: L.main.w + 80, d: Math.max(20, lot.depth - paveY - 20) }, { fill: pal.asphalt });
  out += pad(cam, { x: L.driveX - 22, y: L.front, w: 44, d: L.yard + 12 }, { fill: pal.asphalt });

  if (state.site.parking) {
    // Two banks of stalls in front of the office end, striped out one by one.
    const onRight = L.office ? L.office.side === 'right' : false;
    const bankX = onRight ? L.main.x + L.main.w - 20 : L.main.x + 20;
    const dir = onRight ? -1 : 1;
    const rows = L.yard > 190 ? 2 : 1;
    const cols = Math.max(4, Math.floor((L.main.w * 0.42) / STALL.w));
    L.stalls = [];
    for (let rw = 0; rw < rows; rw++) {
      const y = L.front + 40 + rw * (STALL.d + 26);
      for (let c = 0; c < cols; c++) {
        const x = bankX + dir * c * STALL.w - (dir < 0 ? STALL.w : 0);
        if (x < 6 || x + STALL.w > lot.width - 6) continue;
        if (Math.abs(x - L.driveX) < 30) continue;
        out += pad(cam, { x, y, w: STALL.w, d: STALL.d }, { fill: 'none', stroke: pal.stripe, 'stroke-width': 0.8 });
        L.stalls.push({ x, y });
      }
    }
  }

  // Walkway across the front of the building.
  out += pad(cam, { x: L.main.x - 8, y: L.front + (L.office ? 14 : 0), w: L.main.w + 16, d: 7 }, { fill: pal.walk });

  /* --- everything with height, painted back to front --------------------- */
  const items = [];
  const add = (key, svg) => items.push({ key, svg });
  // Is the street-facing wall — docks, doors, signage — the one we can see?
  const frontOn = facing(cam, 0, 1);

  // Storage rows sit behind the main mass.
  if (state.type === 'storage' && L.rows) {
    L.rows.forEach((row, i) => {
      if (i === 0) return;
      add(nearKey(cam, row), drawBox(cam, row, {
        color: wall,
        roof: shade(wall, night ? 0.9 : 1.05),
        decorate: (f) => (f.id === 'N' || f.id === 'S' ? dockDoors(f, { from: 0, to: f.len, bays: clamp(Math.round(state.body.bays), 1, 40), span: f.len }, (t) => t, night) : ''),
      }));
    });
  }

  // The main building.
  const mainKey = nearKey(cam, L.main);
  add(mainKey, drawBox(cam, L.main, {
      color: wall,
      roof: shade(wall, night ? 0.9 : 1.05),
      decorate: (f) => {
        let s = '';
        if (f.id === 'N') {
          // Parapet band and, on a warehouse, the run of dock doors.
          s += f.quad(0, f.len, f.height - 3, f.height, { fill: band, stroke: 'none' });
          if (state.type === 'warehouse') s += dockDoors(f, L.dockRun, (wx) => wx - L.main.x, night);
          if (state.type === 'retail') {
            s += f.quad(3, f.len - 3, 1, 12, { fill: night ? '#1e2a38' : '#8fb6cf', stroke: 'rgba(20,30,45,.4)', 'stroke-width': 0.6 });
            for (let t = 3; t < f.len - 3; t += 10) s += f.quad(t, t + 0.6, 1, 12, { fill: '#e9ecef', stroke: 'none' });
          }
          if (state.type === 'tower') s += windows(f, { style: 'curtain', floors: state.body.floors, night, seed: 21 });
          if (state.type === 'storage') s += dockDoors(f, { from: 0, to: f.len, bays: clamp(Math.round(state.body.bays), 1, 40), span: f.len }, (t) => t, night);
          if (!L.office) s += entranceDetail(f, state, night);
        }
        if ((f.id === 'E' || f.id === 'W') && state.type === 'tower') {
          s += windows(f, { style: 'curtain', floors: state.body.floors, night, seed: f.id === 'E' ? 33 : 44 });
        }
        if ((f.id === 'E' || f.id === 'W') && state.type !== 'tower') {
          s += f.quad(0, f.len, f.height - 3, f.height, { fill: band, stroke: 'none' });
        }
        return s;
      },
  }));

  // The office wing / podium — the part that gets floors, windows and the sign.
  if (L.office) {
    const o = L.office;
    const floors = state.type === 'tower' ? 1 : state.office.floors;
    const oKey = Math.max(mainKey, nearKey(cam, o));
    add(frontOn ? oKey + 1 : Math.min(mainKey, nearKey(cam, o)) - 1, drawBox(cam, o, {
      color: state.type === 'tower' ? shade(wall, 1.1) : wall,
      roof: shade(wall, night ? 0.88 : 1.02),
      decorate: (f) => {
        let s = '';
        if (f.id === 'N') {
          s += f.quad(0, f.len, f.height - 2.5, f.height, { fill: band, stroke: 'none' });
          s += windows(f, { style: state.skin.windows, floors, night, seed: 11, base: state.type === 'tower' ? 3 : 0 });
          s += entranceDetail(f, state, night);
        }
        if (f.id === 'E' || f.id === 'W') {
          s += windows(f, { style: state.skin.windows, floors, night, seed: f.id === 'E' ? 5 : 9 });
        }
        return s;
      },
    }));
  }

  if (state.entrance.porch || state.entrance.steps) {
    add(frontOn ? nearKey(cam, L.entry.host) + 1.5 : mainKey - 2, porch(cam, L, state, night));
  }

  // Wall signage sits on the front face, so it only exists when that face does.
  if (frontOn) {
    const signHost = state.type === 'tower' ? L.main : L.office || L.main;
    add(Math.max(mainKey, nearKey(cam, signHost)) + 2, wallSign(cam, signHost, state, night));
  }

  if (state.site.trailers && state.type === 'warehouse' && L.dockRun && L.dockRun.bays) {
    const step = L.dockRun.span / L.dockRun.bays;
    for (let i = 0; i < L.dockRun.bays; i++) {
      if (r() > 0.72) continue;
      const cx = L.dockRun.from + step * (i + 0.5);
      add(nearKey(cam, { x: cx - 4.25, y: L.front + 1, w: 8.5, d: 45 }), trailer(cam, cx - 4.25, L.front + 1, night));
    }
  }

  if (state.site.cars && L.stalls) {
    const colors = ['#b9bec6', '#2c3d5c', '#7d2f2f', '#20242c', '#e6e8ea', '#3d5c46'];
    for (const s of L.stalls) {
      if (r() > 0.55) continue;
      add(nearKey(cam, { x: s.x + 1.5, y: s.y + 2, w: 6, d: 14 }), car(cam, s.x + 1.5, s.y + 2, colors[Math.floor(r() * colors.length)], night));
    }
  }

  if (state.security.fence) {
    add(cam.depth(lot.width / 2, lot.depth) + 3, fenceLine(cam, 4, lot.width - 4, lot.depth, [L.driveX - 24, L.driveX + 24]));
  }

  if (state.security.booth) add(nearKey(cam, L.booth) + 1, guardBooth(cam, L, state, night));
  if (state.security.gate) add(cam.depth(L.driveX, L.gateY) + 1.2, gateArm(cam, L));
  if (state.signs.monument.on) add(nearKey(cam, L.monument) + 1.4, monumentSign(cam, L, state, night));

  for (let i = 0; i < clamp(Math.round(state.security.barricades), 0, 24); i++) {
    const side = i % 2 ? 1 : -1;
    const bx = L.driveX + side * (26 + Math.floor(i / 2) * 7);
    add(cam.depth(bx, L.gateY + 16) + 1, bollard(cam, bx, L.gateY + 16));
  }
  if (state.security.guard && state.security.booth) {
    add(cam.depth(L.driveX - 16, L.gateY + 6) + 1.5, person(cam, L.driveX - 16, L.gateY + 6, '#1b2027'));
    add(cam.depth(L.booth.x + 30, L.booth.y + 6) + 1.5, person(cam, L.booth.x + 30, L.booth.y + 6, '#7a4b2a'));
  }

  if (state.site.poles) {
    for (const px of [lot.width * 0.2, lot.width * 0.5, lot.width * 0.8]) {
      const py = L.front + Math.max(30, L.yard * 0.45);
      add(cam.depth(px, py), lightPole(cam, px, py, night));
    }
  }
  if (state.site.trees) {
    for (let i = 0; i < 9; i++) {
      const tx = 16 + (i / 8) * (lot.width - 32);
      if (Math.abs(tx - L.driveX) < 40) continue;
      const ty = lot.depth - 14;
      add(cam.depth(tx, ty), tree(cam, tx, ty, 0.8 + r() * 0.5, night));
    }
    for (const tx of [L.main.x - 24, L.main.x + L.main.w + 24]) {
      add(cam.depth(tx, L.front + 40), tree(cam, tx, L.front + 40, 1.1, night));
    }
  }

  items.sort((a, b) => a.key - b.key);
  out += items.map((i) => i.svg).join('');

  return { svg: out, cam, layout: L };
}

/* ------------------------------------------------------- signage & details */

function entranceDetail(face, state, night) {
  if (!state.entrance.doors) return '';
  const c = face.len / 2;
  let s = '';
  s += face.quad(c - 7, c + 7, 0, 10, { fill: night ? '#1d2836' : '#7fa8c4', stroke: 'rgba(20,30,45,.5)', 'stroke-width': 0.7 });
  s += face.quad(c - 0.4, c + 0.4, 0, 10, { fill: '#e9ecef', stroke: 'none' });
  s += face.quad(c - 7, c + 7, 10, 11.2, { fill: '#e9ecef', stroke: 'none' });
  if (state.entrance.canopy) {
    s += face.quad(c - 12, c + 12, 12, 13.6, { fill: 'rgba(25,35,50,.55)', stroke: 'none' });
  }
  return s;
}

/** Raised slab, steps and (optionally) a columned roof at the front doors. */
function porch(cam, L, state, night) {
  const host = L.entry.host;
  const cx = L.entry.x;
  const y = host.y + host.d;
  let s = '';
  if (state.entrance.steps) {
    s += drawBox(cam, { x: cx - 14, y, w: 28, d: 7, z0: 0, z1: 0.9 }, { color: night ? '#5b626c' : '#c9ced6' });
    s += drawBox(cam, { x: cx - 11, y: y + 7, w: 22, d: 2.4, z0: 0, z1: 0.45 }, { color: night ? '#525963' : '#bec3cb' });
  }
  if (state.entrance.porch) {
    s += drawBox(cam, { x: cx - 16, y, w: 32, d: 14, z0: 0.9, z1: 1.6 }, { color: night ? '#646b76' : '#d3d8de' });
    for (const px of [cx - 14, cx - 5, cx + 4, cx + 13]) {
      s += drawBox(cam, { x: px, y: y + 11, w: 1.6, d: 1.6, z0: 1.6, z1: 11 }, { color: night ? '#8d949e' : '#eef0f3' });
    }
    // Kept low so it never climbs into the signage above the doors.
    s += drawBox(cam, { x: cx - 17, y: y - 1, w: 34, d: 16, z0: 11, z1: 12.6 }, {
      color: night ? mixHex(state.skin.band, 0.5) : state.skin.band,
      roof: shade(state.skin.band, night ? 0.7 : 1.12),
    });
  }
  return s;
}

function wallSign(cam, host, state, night) {
  const sign = state.signs.wall;
  if (!sign.text && !sign.logo) return '';
  const f = boxFaces(cam, host).find((q) => q.id === 'N');
  const top = f.height;
  const chars = Math.max(6, (sign.text || '').length);
  // Signs are lit after dark, so the lettering brightens instead of sinking
  // into the wall behind it.
  const ink = night ? mixHex(sign.color, 1.45) : sign.color;
  // Fill most of the wall width, but never so tall that the stack of logo,
  // name and strapline climbs over the roofline.
  const size = clamp(Math.min((f.len * 0.78) / (0.58 * chars), (top * 0.86) / (sign.logo ? 3.2 : 1.6)), 2, top * 0.3);
  const cap = size * 0.72;

  // Stack downward from just under the parapet.
  let y = top - Math.max(2, top * 0.07);
  let s = '';
  if (sign.logo) {
    y -= size * 1.6 * 0.78;
    s += faceText(f, { t: f.len / 2, h: y, text: sign.logo, size: size * 1.6, color: ink, glow: night });
    y -= size * 0.45;
  }
  y -= cap;
  const textBase = y;
  s += faceText(f, { t: f.len / 2, h: y, text: sign.text || '', size, color: ink, letter: size * 0.08, glow: night });
  if (sign.sub) {
    y -= size * 0.55;
    s += faceText(f, {
      t: f.len / 2, h: y, text: sign.sub, size: size * 0.38, color: ink,
      letter: size * 0.09, weight: 600, glow: night, opacity: 0.9,
    });
  }
  // A transparent hit target so the wall can be clicked to edit its text.
  s += `<polygon class="hot" fill="transparent" stroke="none" data-sign="wall" points="${[
    f.at(2, top - 1), f.at(f.len - 2, top - 1), f.at(f.len - 2, Math.max(0, y - size * 0.6)), f.at(2, Math.max(0, y - size * 0.6)),
  ].map((p) => cam.project(...p).map((n) => n.toFixed(1)).join(',')).join(' ')}"/>`;
  return s;
}

function guardBooth(cam, L, state, night) {
  const b = L.booth;
  const sign = state.signs.booth;
  let s = drawBox(cam, b, {
    color: night ? '#3a4250' : '#e6e9ed',
    roof: '#2b3140',
    decorate: (f) => {
      let q = '';
      if (f.id !== 'S') {
        q += f.quad(2, f.len - 2, 3.5, 8, { fill: night ? '#ffe6a8' : '#9dc0d6', stroke: 'rgba(20,30,45,.5)', 'stroke-width': 0.6 });
      }
      return q;
    },
  });
  // Fascia above the window with the booth's own sign on it.
  const cap = { x: b.x - 1.5, y: b.y - 1.5, w: b.w + 3, d: b.d + 3, z0: 10, z1: 13.5 };
  s += drawBox(cam, cap, { color: state.signs.booth.color === '#ffffff' ? '#16305c' : shade(state.skin.band, 1), roof: '#20262f' });
  const f = boxFaces(cam, cap).find((q) => q.id === 'N');
  const text = `${sign.logo ? sign.logo + '  ' : ''}${sign.text || ''}`.trim();
  if (text) {
    const size = clamp((f.len / Math.max(10, text.length)) * 1.5, 1.1, 2.4);
    s += faceText(f, { t: f.len / 2, h: 1.1, text, size, color: night ? mixHex(sign.color, 1.45) : sign.color, glow: night });
  }
  s += `<polygon class="hot" fill="transparent" stroke="none" data-sign="booth" points="${[f.at(0, 0), f.at(f.len, 0), f.at(f.len, 3.5), f.at(0, 3.5)]
    .map((p) => cam.project(...p).map((n) => n.toFixed(1)).join(',')).join(' ')}"/>`;
  return s;
}

function gateArm(cam, L) {
  let s = drawBox(cam, { x: L.driveX - 25, y: L.gateY - 1, w: 2, d: 2, z0: 0, z1: 4 }, { color: '#d8dbe0' });
  // The arm itself, striped, lifted a touch so it reads as raised.
  const y = L.gateY;
  const x0 = L.driveX - 24;
  for (let i = 0; i < 10; i++) {
    const a = x0 + i * 4.6;
    s += drawBox(cam, { x: a, y: y - 0.35, w: 4.4, d: 0.7, z0: 3.6 + i * 0.32, z1: 4.3 + i * 0.32 }, {
      color: i % 2 ? '#c0392b' : '#f2f4f7', stroke: 'none',
    });
  }
  return s;
}

function monumentSign(cam, L, state, night) {
  const m = state.signs.monument;
  const panel = { x: L.monument.x, y: L.monument.y, w: 2.5, d: 26, z0: 3, z1: 17 };
  let s = drawBox(cam, { x: panel.x - 1, y: panel.y - 2, w: 4.5, d: 30, z0: 0, z1: 3 }, { color: '#9aa1aa' });
  s += drawBox(cam, panel, { color: m.color === '#ffffff' ? '#16305c' : shade(m.color, 0.9), roof: '#101722' });
  const f = boxFaces(cam, panel).find((q) => q.id === 'E');
  const words = String(m.text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > 18) { lines.push(cur.trim()); cur = w; } else cur += ' ' + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  const size = clamp(11 / Math.max(2.4, lines.length) * 0.42, 0.9, 1.9);
  const mink = night ? mixHex(m.color, 1.45) : m.color;
  if (m.logo) s += faceText(f, { t: f.len / 2, h: 11.4, text: m.logo, size: 3, color: mink, glow: night });
  lines.slice(0, 5).forEach((ln, i) => {
    s += faceText(f, { t: f.len / 2, h: 8.6 - i * size * 1.35, text: ln, size, color: mink, glow: night });
  });
  s += `<polygon class="hot" fill="transparent" stroke="none" data-sign="monument" points="${[f.at(0, 0), f.at(f.len, 0), f.at(f.len, 14), f.at(0, 14)]
    .map((p) => cam.project(...p).map((n) => n.toFixed(1)).join(',')).join(' ')}"/>`;
  return s;
}

export function frame(state, size, inner) {
  const night = state.view.time === 'night';
  const sky = night
    ? '<stop offset="0" stop-color="#0a1020"/><stop offset="1" stop-color="#1d2b3f"/>'
    : '<stop offset="0" stop-color="#7fb6e8"/><stop offset="1" stop-color="#d7e8f5"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size.w} ${size.h}" width="100%" height="100%" role="img" aria-label="Isometric view of the design">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">${sky}</linearGradient>
    <radialGradient id="pool"><stop offset="0" stop-color="rgba(255,232,170,.42)"/><stop offset="1" stop-color="rgba(255,232,170,0)"/></radialGradient>
    <filter id="signGlow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="${night ? 1.6 : 0}" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="${size.w}" height="${size.h}" fill="url(#sky)"/>
  ${night ? starfield(size) : clouds(size)}
  ${inner}
</svg>`;
}

function starfield(size) {
  const r = rng(99);
  let s = '';
  for (let i = 0; i < 70; i++) {
    s += `<circle cx="${(r() * size.w).toFixed(0)}" cy="${(r() * size.h * 0.5).toFixed(0)}" r="${(r() * 1.2 + 0.3).toFixed(1)}" fill="rgba(255,255,255,${(0.3 + r() * 0.6).toFixed(2)})"/>`;
  }
  s += `<circle cx="${(size.w * 0.82).toFixed(0)}" cy="${(size.h * 0.14).toFixed(0)}" r="${(size.h * 0.045).toFixed(0)}" fill="#f4f0e2" opacity=".9"/>`;
  return s;
}

function clouds(size) {
  const r = rng(7);
  let s = '';
  for (let i = 0; i < 5; i++) {
    const cx = r() * size.w;
    const cy = size.h * (0.06 + r() * 0.18);
    const rx = size.w * (0.05 + r() * 0.06);
    s += `<g opacity=".75" fill="#ffffff"><ellipse cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" rx="${rx.toFixed(0)}" ry="${(rx * 0.32).toFixed(0)}"/><ellipse cx="${(cx + rx * 0.5).toFixed(0)}" cy="${(cy - rx * 0.14).toFixed(0)}" rx="${(rx * 0.6).toFixed(0)}" ry="${(rx * 0.3).toFixed(0)}"/></g>`;
  }
  return s;
}
