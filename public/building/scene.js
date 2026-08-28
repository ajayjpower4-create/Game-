/* Turns the design state into an isometric drawing of the site.
 *
 * Everything here is laid out in feet on a lot that runs x = 0..lot.width and
 * y = 0..lot.depth, with y = depth being the street edge nearest the viewer. */

import {
  makeCamera, drawBox, boxFaces, pad, poly, line, ellipse, faceText,
  shade, mixHex, tint, rgba, shadowOf, SUN, TONE,
} from './iso.js';
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

/* ----------------------------------------------------------------- palette */

export function palette(night) {
  return night
    ? {
      night: true,
      sky0: '#050a16', sky1: '#16233c', haze: 'rgba(90,120,170,.20)',
      grass: '#1a2a1b', grassAlt: '#203320', soil: '#151820', soilDark: '#0e1116',
      asphalt: '#1b1f27', asphaltAlt: '#232830', stripe: 'rgba(224,230,214,.42)',
      walk: '#2c323c', curb: '#3a404a', road: '#14171d', roadLine: 'rgba(196,178,86,.55)',
      shadow: 'rgba(0,0,0,0)', trunk: '#2a2118', leaf: '#1d3a27', leafHi: '#26492f',
      metal: '#3d434d', glassLo: '#141c28',
    }
    : {
      night: false,
      sky0: '#3f86cf', sky1: '#cfe4f2', haze: 'rgba(255,255,255,.55)',
      grass: '#6d9159', grassAlt: '#7ba065', soil: '#6b5a46', soilDark: '#544736',
      asphalt: '#53585f', asphaltAlt: '#5c6169', stripe: 'rgba(246,244,232,.92)',
      walk: '#b9bec6', curb: '#cfd3d8', road: '#44494f', roadLine: 'rgba(226,196,84,.9)',
      shadow: 'rgba(22,32,50,.40)', trunk: '#6b5340', leaf: '#3f7a4a', leafHi: '#5aa05f',
      metal: '#98a0ab', glassLo: '#7ea6c4',
    };
}

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
      // Always a touch taller than the shell, so the office end reads as its
      // own mass from the street instead of hiding behind the warehouse.
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
  if (type === 'warehouse') {
    const from = L.office && L.office.side === 'left' ? x0 + oLen + 8 : x0 + 8;
    const to = L.office && L.office.side === 'right' ? x0 + len - oLen - 8 : x0 + len - 8;
    const span = to - from;
    const bays = clamp(Math.round(body.bays), 0, Math.max(0, Math.floor(span / BAY_SPACING)));
    L.dockRun = { from, to, bays, span };
  }

  // Front door sits on whichever mass reads as the entrance.
  const doorHost = L.office && L.office.side !== 'podium' ? L.office : L.main;
  L.entry = { x: doorHost.x + doorHost.w / 2, y: doorHost.y + doorHost.d, host: doorHost };

  // Where parking can go: the yard, minus the truck court in front of the
  // docks and minus the drive itself.
  const pk = { x0: L.main.x - 34, x1: L.main.x + L.main.w + 34, y0: L.front + 30, y1: lot.depth - 92 };
  if (type === 'warehouse' && L.dockRun) {
    if (L.office && L.office.side === 'right') pk.x0 = L.dockRun.to + 16;
    else pk.x1 = L.dockRun.from - 16;
  }
  if (isStorage) { pk.y0 = L.front + 16; pk.x1 = Math.min(pk.x1, L.main.x + L.main.w * 0.45); }
  pk.x0 = Math.max(pk.x0, 14);
  pk.x1 = Math.min(pk.x1, lot.width - 14);
  L.park = pk;

  // Drive, gate and booth line up with the entrance.
  L.driveX = clamp(L.entry.x - (L.office && L.office.side === 'right' ? -70 : 70), 70, lot.width - 70);
  L.gateY = lot.depth - clamp(L.yard * 0.32, 40, 96);
  L.booth = { x: L.driveX - 46, y: L.gateY - 9, w: 26, d: 18, z0: 0, z1: 10 };
  L.monument = { x: L.driveX + 30, y: L.gateY + 4, w: 3, d: 22, z0: 0, z1: 15 };

  return L;
}

/* -------------------------------------------------------------- wall detail */

/** Precast panel joints and a reveal line — what stops a wall reading as paint. */
function panelJoints(face, { step = 25, pal, detail }) {
  if (!detail) return '';
  let out = '';
  for (let t = step; t < face.len - 1; t += step) {
    out += face.quad(t - 0.18, t + 0.18, 0, face.height, { fill: 'rgba(20,28,40,.16)', stroke: 'none' });
    out += face.quad(t + 0.18, t + 0.5, 0, face.height, { fill: 'rgba(255,255,255,.14)', stroke: 'none' });
  }
  return out;
}

/** Ribbed metal siding, for storage rows and trailers. */
function ribs(face, { step = 3.5, detail }) {
  if (!detail) return '';
  let out = '';
  for (let t = step; t < face.len - 0.5; t += step) {
    out += face.quad(t, t + 0.28, 0, face.height, { fill: 'rgba(255,255,255,.13)', stroke: 'none' });
    out += face.quad(t + 0.28, t + 0.5, 0, face.height, { fill: 'rgba(20,28,40,.1)', stroke: 'none' });
  }
  return out;
}

/** One pane of glass: sky-reflecting by day, individually lit by night. */
function pane(face, t0, t1, h0, h1, night, r) {
  if (!night) {
    return face.quad(t0, t1, h0, h1, { fill: 'url(#glassDay)', stroke: 'rgba(16,28,42,.45)', 'stroke-width': 0.35 });
  }
  const lit = r() > 0.42;
  return face.quad(t0, t1, h0, h1, {
    fill: lit ? 'url(#glassLit)' : '#161d2a',
    stroke: 'rgba(8,12,20,.6)', 'stroke-width': 0.35,
  });
}

/** Windows on one wall face, in whichever of the three styles is selected. */
function windows(face, opts) {
  const { style, floors, night, seed = 7, base = 0, detail, band } = opts;
  const t0 = 4;
  const t1 = face.len - 4;
  const r = rng(seed);
  if (t1 - t0 < 6 || floors < 1) return '';
  let out = '';
  for (let f = 0; f < floors; f++) {
    const fh = base + f * FLOOR_HEIGHT;
    if (fh + FLOOR_HEIGHT > face.height + 0.5) break;

    if (style === 'ribbon') {
      // A continuous band, recessed, with a sill and a shadow under the head.
      out += face.quad(t0 - 0.8, t1 + 0.8, fh + 3.4, fh + 10.6, { fill: 'rgba(18,26,38,.45)', stroke: 'none' });
      for (let t = t0; t < t1 - 0.5; t += 6) {
        out += pane(face, t, Math.min(t + 5.4, t1), fh + 4, fh + 10, night, r);
      }
      if (detail) {
        out += face.quad(t0 - 0.8, t1 + 0.8, fh + 10, fh + 10.9, { fill: 'rgba(10,16,26,.35)', stroke: 'none' });
        out += face.quad(t0 - 1.2, t1 + 1.2, fh + 3, fh + 3.9, { fill: 'rgba(255,255,255,.5)', stroke: 'none' });
      }
    } else if (style === 'curtain') {
      // Floor-to-floor glazing with a spandrel band at each slab edge.
      out += face.quad(t0, t1, fh + 0.6, fh + FLOOR_HEIGHT - 0.6, { fill: night ? '#0f151f' : '#5f7f9b', stroke: 'none' });
      for (let t = t0; t < t1 - 0.5; t += 5.5) {
        const w = Math.min(5.5, t1 - t);
        out += pane(face, t + 0.35, t + w - 0.35, fh + 3.2, fh + FLOOR_HEIGHT - 1.2, night, r);
        if (detail) out += face.quad(t + w - 0.35, t + w + 0.15, fh, fh + FLOOR_HEIGHT, { fill: band, stroke: 'none' });
      }
      out += face.quad(t0, t1, fh + 0.6, fh + 3.2, { fill: night ? '#131a26' : mixHex(band, 0.9), stroke: 'none' });
      if (detail) out += face.quad(t0, t1, fh + 3.2, fh + 3.5, { fill: 'rgba(255,255,255,.22)', stroke: 'none' });
    } else {
      // Punched openings: a deep reveal, glass set back, a bright sill.
      const step = 11;
      for (let t = t0 + 2; t + 6.5 < t1; t += step) {
        out += face.quad(t - 0.7, t + 7.2, fh + 3.8, fh + 11.2, { fill: 'rgba(18,26,38,.4)', stroke: 'none' });
        out += pane(face, t, t + 6.5, fh + 4.3, fh + 10.6, night, r);
        if (detail) {
          out += face.quad(t - 1, t + 7.5, fh + 3.3, fh + 4.3, { fill: 'rgba(255,255,255,.55)', stroke: 'none' });
          out += face.quad(t - 0.7, t + 7.2, fh + 10.6, fh + 11.3, { fill: 'rgba(10,16,26,.3)', stroke: 'none' });
        }
      }
    }
  }
  return out;
}

/** A row of roll-up doors: recessed, ribbed, bumpered, with a lamp above. */
function dockDoors(face, run, worldToT, night, detail, opts = {}) {
  if (!run || run.bays < 1) return '';
  const { numbers = false, bumpers = true, canopy = true } = opts;
  const dh = Math.min(13.5, face.height - 1.5);
  const step = run.span / run.bays;
  let out = '';
  for (let i = 0; i < run.bays; i++) {
    const cx = run.from + step * (i + 0.5);
    const t = worldToT(cx);
    if (t < 3 || t > face.len - 3) continue;
    const w = Math.min(9.5, step - 2.2);
    const a = t - w / 2;
    const b = t + w / 2;

    if (canopy && dh > 9) out += face.quad(a - 1.6, b + 1.6, dh, Math.min(face.height, dh + 1.9), { fill: 'rgba(16,24,36,.5)', stroke: 'none' });
    out += face.quad(a - 0.9, b + 0.9, 0, dh + 0.9, { fill: 'rgba(16,24,36,.42)', stroke: 'none' });
    out += face.quad(a, b, 0, dh, { fill: night ? '#161c26' : '#48515d', stroke: 'rgba(12,18,26,.6)', 'stroke-width': 0.4 });
    if (detail) {
      for (let h = 1.4; h < dh - 0.4; h += 2.1) {
        out += face.quad(a, b, h, h + 0.42, { fill: 'rgba(255,255,255,.15)', stroke: 'none' });
        out += face.quad(a, b, h + 0.42, h + 0.8, { fill: 'rgba(0,0,0,.14)', stroke: 'none' });
      }
      out += face.quad(a, b, dh - 1.2, dh, { fill: 'rgba(0,0,0,.28)', stroke: 'none' });
    }
    if (bumpers && dh > 9) {
      out += face.quad(a - 1.1, a - 0.1, 0, 3.6, { fill: '#1b2029', stroke: 'none' });
      out += face.quad(b + 0.1, b + 1.1, 0, 3.6, { fill: '#1b2029', stroke: 'none' });
    }
    if (numbers && detail && w > 6) {
      out += faceText(face, {
        t, h: dh + 2.6, text: String(i + 1), size: 1.8,
        color: night ? 'rgba(255,225,170,.85)' : 'rgba(255,255,255,.8)', weight: 700,
      });
    }
    if (night) {
      out += face.quad(t - 0.8, t + 0.8, dh + 2, dh + 2.7, { fill: '#ffdf9e', stroke: 'none' });
      out += face.quad(a - 3, b + 3, 0, dh + 2, { fill: 'url(#wallLamp)', stroke: 'none' });
    }
  }
  return out;
}

/** Glazed double doors, transom and canopy, centred on a wall. */
function entranceDetail(face, state, night, detail) {
  if (!state.entrance.doors) return '';
  const c = face.len / 2;
  let s = '';
  s += face.quad(c - 8.5, c + 8.5, 0, 12.4, { fill: 'rgba(16,24,36,.4)', stroke: 'none' });
  s += face.quad(c - 7.6, c + 7.6, 0, 11.6, { fill: night ? '#1a2534' : '#6f96b4', stroke: 'rgba(14,22,34,.6)', 'stroke-width': 0.4 });
  s += face.quad(c - 7.2, c + 7.2, 0.3, 9.4, { fill: night ? 'url(#glassLit)' : 'url(#glassDay)', stroke: 'none' });
  if (detail) {
    s += face.quad(c - 0.35, c + 0.35, 0, 9.4, { fill: '#e9ecef', stroke: 'none' });
    s += face.quad(c - 7.6, c + 7.6, 9.4, 10, { fill: '#e9ecef', stroke: 'none' });
    s += face.quad(c - 3.6, c - 3.2, 3.4, 5.4, { fill: '#dfe4ea', stroke: 'none' });
    s += face.quad(c + 3.2, c + 3.6, 3.4, 5.4, { fill: '#dfe4ea', stroke: 'none' });
  }
  if (state.entrance.canopy) {
    s += face.quad(c - 13, c + 13, 12.4, 13, { fill: 'rgba(12,18,28,.5)', stroke: 'none' });
    s += face.quad(c - 13, c + 13, 13, 14.6, { fill: night ? '#2a3446' : '#dfe3e8', stroke: 'rgba(14,22,34,.4)', 'stroke-width': 0.4 });
  }
  if (night) s += face.quad(c - 12, c + 12, 0, 14, { fill: 'url(#wallLamp)', stroke: 'none' });
  return s;
}

/** Retail storefront: glazing between piers, with a deep sign band above. */
function storefront(face, state, night, detail, band) {
  let s = '';
  const top = Math.min(face.height - 5.5, 13);
  s += face.quad(2, face.len - 2, 0.6, top, { fill: 'rgba(16,24,36,.35)', stroke: 'none' });
  const r = rng(3);
  const units = clamp(Math.round(state.body.bays), 2, 14);
  const w = (face.len - 6) / units;
  for (let u = 0; u < units; u++) {
    const a = 3 + u * w;
    for (let t = a + 1; t < a + w - 2.2; t += 5) {
      s += pane(face, t, Math.min(t + 4.4, a + w - 2.2), 1.2, top - 0.8, night, r);
    }
    if (detail) s += face.quad(a + w - 2.2, a + w - 0.9, 0, top + 0.6, { fill: mixHex(band, night ? 0.6 : 1.05), stroke: 'none' });
  }
  s += face.quad(0, face.len, top + 0.6, face.height - 1.4, { fill: mixHex(band, night ? 0.55 : 1), stroke: 'none' });
  if (detail) s += face.quad(0, face.len, face.height - 1.4, face.height, { fill: 'rgba(255,255,255,.35)', stroke: 'none' });
  return s;
}

/* ------------------------------------------------------------- roof detail */

/** Coping band, membrane, plant and skylights — the top of a building is the
 *  biggest surface in an isometric view, so it cannot stay a blank slab. */
function roofDetail(cam, box, { pal, night, kind, detail, seed = 5 }) {
  const { x, y, w, d, z1 } = box;
  const r = rng(seed);
  let out = '';
  const inset = 1.6;
  out += pad(cam, { x: x + inset, y: y + inset, w: w - inset * 2, d: d - inset * 2, z: z1 + 0.02 }, {
    fill: night ? '#232830' : '#9aa2ac', stroke: 'none',
  });
  if (!detail) return out;

  // Roof-membrane seams.
  for (let t = x + 10; t < x + w - 4; t += 14) {
    out += line(cam, [t, y + inset, z1 + 0.03], [t, y + d - inset, z1 + 0.03], { stroke: 'rgba(255,255,255,.07)', 'stroke-width': 0.8 });
  }

  if (kind === 'flat-large') {
    // Skylight bands and rooftop units on a big shed roof.
    for (let sx = x + 22; sx < x + w - 24; sx += 34) {
      for (let sy = y + 16; sy < y + d - 16; sy += 30) {
        out += pad(cam, { x: sx, y: sy, w: 9, d: 5, z: z1 + 0.05 }, {
          fill: night ? 'rgba(255,214,150,.35)' : 'rgba(236,244,250,.85)', stroke: 'rgba(30,40,55,.3)', 'stroke-width': 0.4,
        });
      }
    }
  }
  const units = kind === 'flat-large' ? 5 : 3;
  for (let i = 0; i < units; i++) {
    const ux = x + 12 + r() * Math.max(4, w - 32);
    const uy = y + 12 + r() * Math.max(4, d - 28);
    const uw = 7 + r() * 5;
    out += drawBox(cam, { x: ux, y: uy, w: uw, d: 6.5, z0: z1, z1: z1 + 3.4 }, {
      color: night ? '#3b414b' : '#aeb5bd', roof: night ? '#454b56' : '#c6ccd3', crisp: true,
      stroke: 'rgba(20,28,40,.45)',
    });
    out += pad(cam, { x: ux + 1, y: uy + 1, w: uw - 2, d: 4.5, z: z1 + 3.42 }, { fill: 'rgba(20,28,40,.3)', stroke: 'none' });
  }
  // Parapet inner shadow along the two far edges.
  out += pad(cam, { x: x + inset, y: y + inset, w: w - inset * 2, d: 2.4, z: z1 + 0.06 }, { fill: 'rgba(16,24,36,.25)', stroke: 'none' });
  return out;
}

/* ------------------------------------------------------------------- props */

function trailer(cam, x, y, night, pal, detail, seed = 1) {
  const body = { x, y, w: 8.5, d: 45, z0: 4.4, z1: 17.6 };
  let out = drawBox(cam, body, {
    color: night ? '#8f959e' : '#eef1f4',
    roof: night ? '#7d838c' : '#dfe3e8',
    stroke: 'rgba(20,28,40,.4)',
    decorate: (f) => {
      let s = ribs(f, { step: 4, detail });
      if (f.id === 'N') {
        // Rear doors, hinges and a bumper.
        s += f.quad(0.6, f.len - 0.6, 0.4, f.height - 0.6, { fill: night ? '#7b818a' : '#e2e6ea', stroke: 'rgba(20,28,40,.35)', 'stroke-width': 0.3 });
        s += f.quad(f.len / 2 - 0.15, f.len / 2 + 0.15, 0.4, f.height - 0.6, { fill: 'rgba(20,28,40,.4)', stroke: 'none' });
      }
      if (detail && (f.id === 'E' || f.id === 'W')) {
        s += f.quad(2, f.len - 2, f.height - 1.6, f.height - 1.1, { fill: 'rgba(20,28,40,.18)', stroke: 'none' });
      }
      return s;
    },
  });
  // Chassis, bogie and landing gear.
  out += drawBox(cam, { x: x + 0.6, y: y + 1, w: 7.3, d: 43, z0: 3.5, z1: 4.4 }, { color: '#2b323d', crisp: true, stroke: 'none' });
  for (const wy of [y + 3.5, y + 7.5]) {
    out += drawBox(cam, { x: x - 0.3, y: wy, w: 9.1, d: 3, z0: 0, z1: 3.5 }, { color: '#171b22', crisp: true, stroke: 'none' });
  }
  out += drawBox(cam, { x: x + 1.5, y: y + 33, w: 5.5, d: 1.6, z0: 0, z1: 3.5 }, { color: '#39414d', crisp: true, stroke: 'none' });
  return out;
}

function tractor(cam, x, y, night, color = '#b23a3a') {
  let out = drawBox(cam, { x: x + 0.4, y: y + 1, w: 7.7, d: 20, z0: 2.6, z1: 4 }, { color: '#2b323d', crisp: true, stroke: 'none' });
  out += drawBox(cam, { x, y: y + 9, w: 8.5, d: 11, z0: 4, z1: 13.5 }, {
    color, roof: mixHex(color, 1.2), stroke: 'rgba(20,28,40,.45)',
    decorate: (f) => (f.id === 'N' ? f.quad(1, f.len - 1, 5.5, 8.6, { fill: night ? '#1b2534' : '#8fb0c8', stroke: 'none' }) : ''),
  });
  out += drawBox(cam, { x: x + 0.6, y, w: 7.3, d: 9, z0: 4, z1: 9.4 }, { color: mixHex(color, 0.92), roof: mixHex(color, 1.05), stroke: 'rgba(20,28,40,.45)' });
  for (const wy of [y + 1, y + 12, y + 15.5]) {
    out += drawBox(cam, { x: x - 0.3, y: wy, w: 9.1, d: 3, z0: 0, z1: 3.4 }, { color: '#171b22', crisp: true, stroke: 'none' });
  }
  if (night) out += ellipse(cam, x + 4, y - 3, 9, 5, { fill: 'url(#pool)' });
  return out;
}

function car(cam, x, y, color, night, detail) {
  const body = { x: x + 0.35, y: y + 0.5, w: 5.3, d: 13, z0: 1.15, z1: 3.9 };
  let out = '';
  for (const wy of [y + 2, y + 9.4]) {
    out += drawBox(cam, { x, y: wy, w: 6, d: 2.2, z0: 0.15, z1: 1.5 }, { color: '#15181e', crisp: true, stroke: 'none' });
  }
  out += drawBox(cam, body, {
    color, roof: mixHex(color, 1.1), stroke: 'rgba(16,22,32,.55)',
    decorate: (f) => (detail && (f.id === 'E' || f.id === 'W')
      ? f.quad(1.5, f.len - 1.5, f.height - 1.1, f.height - 0.5, { fill: 'rgba(255,255,255,.22)', stroke: 'none' })
      : ''),
  });
  out += drawBox(cam, { x: x + 0.75, y: y + 3.6, w: 4.5, d: 6, z0: 3.9, z1: 5.5 }, {
    color: night ? '#1c2634' : mixHex(color, 0.8),
    roof: mixHex(color, 1.06),
    stroke: 'rgba(16,22,32,.5)',
    decorate: (f) => f.quad(0.3, f.len - 0.3, 0.2, f.height - 0.3, { fill: night ? '#141c28' : 'url(#glassDay)', stroke: 'none' }),
  });
  if (night) {
    out += ellipse(cam, x + 3, y - 1, 5, 2.6, { fill: 'rgba(255,236,190,.16)' });
  }
  return out;
}

function tree(cam, x, y, scale, pal, seed = 2) {
  const r = rng(seed);
  const h = 9 * scale;
  let out = drawBox(cam, { x: x - 0.7, y: y - 0.7, w: 1.4, d: 1.4, z0: 0, z1: h }, { color: pal.trunk, crisp: true, stroke: 'none' });
  const blobs = [
    [0, 0, 9.5, 7.2, pal.leaf],
    [-3.2, -1.6, 6.4, 4.8, pal.leafHi],
    [3.4, 1.8, 5.6, 4.2, mixHex(pal.leaf, 0.86)],
  ];
  for (const [dx, dy, rx, ry, fill] of blobs) {
    out += ellipse(cam, x + dx * scale, y + dy * scale, rx * scale, ry * scale, {
      fill, stroke: 'rgba(16,34,20,.35)', 'stroke-width': 0.6,
    }, h + 6.5 * scale + r() * 0.6);
  }
  return out;
}

function shrub(cam, x, y, pal, s = 1) {
  return ellipse(cam, x, y, 3.4 * s, 2.3 * s, { fill: pal.leafHi, stroke: 'rgba(16,34,20,.3)', 'stroke-width': 0.5 }, 2.2 * s);
}

function lightPole(cam, x, y, night, pal) {
  let out = '';
  if (night) out += ellipse(cam, x, y + 4, 34, 19, { fill: 'url(#pool)' });
  out += drawBox(cam, { x: x - 1.3, y: y - 1.3, w: 2.6, d: 2.6, z0: 0, z1: 2.2 }, { color: pal.night ? '#2a2f37' : '#8d939b', crisp: true, stroke: 'none' });
  out += drawBox(cam, { x: x - 0.55, y: y - 0.55, w: 1.1, d: 1.1, z0: 2.2, z1: 27 }, { color: pal.night ? '#333a44' : '#767d86', crisp: true, stroke: 'none' });
  out += drawBox(cam, { x: x - 0.5, y: y + 0.5, w: 1, d: 4.5, z0: 26.4, z1: 27.2 }, { color: pal.night ? '#333a44' : '#767d86', crisp: true, stroke: 'none' });
  out += drawBox(cam, { x: x - 2.2, y: y + 3.6, w: 4.4, d: 3.4, z0: 25.4, z1: 26.6 }, {
    color: night ? '#ffe6ad' : '#6f767f', roof: night ? '#4a4f58' : '#878e97', crisp: true, stroke: 'none',
  });
  if (night) {
    out += `<g filter="url(#lampGlow)">${ellipse(cam, x, y + 5.3, 3.4, 2, { fill: '#fff0c8' }, 25.6)}</g>`;
  }
  return out;
}

function bollard(cam, x, y, night) {
  let out = drawBox(cam, { x: x - 0.75, y: y - 0.75, w: 1.5, d: 1.5, z0: 0, z1: 3.6 }, {
    color: night ? '#8d7422' : '#e5aa1f', roof: night ? '#a68a2c' : '#f6c94f', stroke: 'rgba(60,44,6,.45)',
  });
  out += drawBox(cam, { x: x - 0.78, y: y - 0.78, w: 1.56, d: 1.56, z0: 2.5, z1: 2.9 }, {
    color: night ? '#c9cdd2' : '#f2f4f6', crisp: true, stroke: 'none',
  });
  return out;
}

function person(cam, x, y, shirt, skin = '#c99a72') {
  let out = drawBox(cam, { x: x - 0.75, y: y - 0.5, w: 1.5, d: 1, z0: 0, z1: 2.9 }, { color: '#20242c', crisp: true, stroke: 'none' });
  out += drawBox(cam, { x: x - 0.95, y: y - 0.62, w: 1.9, d: 1.24, z0: 2.9, z1: 5.2 }, { color: shirt, crisp: true, stroke: 'rgba(0,0,0,.25)' });
  out += drawBox(cam, { x: x - 0.52, y: y - 0.42, w: 1.04, d: 0.84, z0: 5.2, z1: 6.05 }, { color: skin, crisp: true, stroke: 'none' });
  return out;
}

/** Steel palisade fence with a mesh infill, open where the drive crosses. */
function fenceLine(cam, x0, x1, y, gap, pal) {
  let out = '';
  const post = pal.night ? '#20242c' : '#2f343c';
  for (let x = x0; x <= x1 - 10; x += 10) {
    const inGap = (a) => gap && a > gap[0] - 5 && a < gap[1] + 5;
    if (inGap(x) || inGap(x + 10)) continue;
    out += poly(cam, [[x, y, 8], [x + 10, y, 8], [x + 10, y, 0], [x, y, 0]], { fill: 'url(#mesh)', stroke: 'none' });
    out += line(cam, [x, y, 7.9], [x + 10, y, 7.9], { stroke: post, 'stroke-width': 1.4 });
    out += line(cam, [x, y, 4.2], [x + 10, y, 4.2], { stroke: rgba('#2f343c', 0.5), 'stroke-width': 0.9 });
    out += line(cam, [x, y, 0.3], [x + 10, y, 0.3], { stroke: post, 'stroke-width': 1 });
  }
  for (let x = x0; x <= x1; x += 10) {
    if (gap && x > gap[0] - 5 && x < gap[1] + 5) continue;
    out += drawBox(cam, { x: x - 0.35, y: y - 0.35, w: 0.7, d: 0.7, z0: 0, z1: 8.6 }, { color: post, crisp: true, stroke: 'none' });
  }
  return out;
}

/* --------------------------------------------------------- site structures */

function guardBooth(cam, L, state, night, pal, detail) {
  const b = L.booth;
  const sign = state.signs.booth;
  let s = drawBox(cam, { x: b.x - 1, y: b.y - 1, w: b.w + 2, d: b.d + 2, z0: 0, z1: 1.1 }, {
    color: night ? '#3a3f48' : '#b9bec6', stroke: 'rgba(20,28,40,.4)',
  });
  s += drawBox(cam, { ...b, z0: 1.1 }, {
    color: night ? '#39414d' : '#e8ebee',
    roof: night ? '#2b313a' : '#cfd4da',
    ao: 1.6,
    decorate: (f) => {
      let q = '';
      if (f.id === 'N' || f.id === 'E' || f.id === 'W') {
        // Glazing all round, with a counter below the sill.
        q += f.quad(1.6, f.len - 1.6, 3.2, 7.6, { fill: 'rgba(16,24,36,.35)', stroke: 'none' });
        q += f.quad(2, f.len - 2, 3.5, 7.3, {
          fill: night ? 'url(#glassLit)' : 'url(#glassDay)', stroke: 'rgba(16,24,36,.5)', 'stroke-width': 0.35,
        });
        if (detail) {
          q += f.quad(2, f.len - 2, 3.1, 3.5, { fill: 'rgba(255,255,255,.6)', stroke: 'none' });
          q += f.quad(f.len / 2 - 0.15, f.len / 2 + 0.15, 3.5, 7.3, { fill: 'rgba(230,236,242,.85)', stroke: 'none' });
        }
      }
      if (f.id === 'S') q += f.quad(f.len / 2 - 1.6, f.len / 2 + 1.6, 0, 6.6, { fill: night ? '#232a33' : '#c4cad1', stroke: 'none' });
      return q;
    },
  });
  // Deep fascia cap carrying the booth's own sign.
  const cap = { x: b.x - 2.2, y: b.y - 2.2, w: b.w + 4.4, d: b.d + 4.4, z0: 8.9, z1: 12.6 };
  const capColor = mixHex(state.skin.band, night ? 0.55 : 1);
  s += drawBox(cam, cap, { color: capColor, roof: night ? '#1d222a' : '#2b323c', stroke: 'rgba(14,20,30,.5)' });
  const f = boxFaces(cam, cap).find((q) => q.id === 'N');
  const text = `${sign.logo ? sign.logo + '  ' : ''}${sign.text || ''}`.trim();
  if (text) {
    const size = clamp((f.len * 0.8) / (0.58 * Math.max(10, text.length)), 1, 2.3);
    s += faceText(f, {
      t: f.len / 2, h: (f.height - size * 0.72) / 2, text, size,
      color: night ? mixHex(sign.color, 1.4) : sign.color, glow: night,
    });
  }
  s += `<polygon class="hot" fill="transparent" stroke="none" data-sign="booth" points="${[f.at(0, 0), f.at(f.len, 0), f.at(f.len, f.height), f.at(0, f.height)]
    .map((p) => cam.project(...p).map((n) => n.toFixed(1)).join(',')).join(' ')}"/>`;
  if (night) s += ellipse(cam, b.x + b.w / 2, b.y + b.d / 2 + 6, 26, 15, { fill: 'url(#pool)' });
  return s;
}

function gateArm(cam, L, night) {
  const x = L.driveX - 25;
  const y = L.gateY;
  let s = drawBox(cam, { x: x - 1.4, y: y - 1.4, w: 2.8, d: 2.8, z0: 0, z1: 4.6 }, {
    color: night ? '#8a9099' : '#e6e9ec', roof: night ? '#9aa0a8' : '#f2f4f6', stroke: 'rgba(20,28,40,.45)',
  });
  // The arm, lifted a little at the tip so it reads as raised.
  for (let i = 0; i < 11; i++) {
    const a = x + 1.4 + i * 4.4;
    s += drawBox(cam, { x: a, y: y - 0.4, w: 4.2, d: 0.8, z0: 4.1 + i * 0.3, z1: 4.9 + i * 0.3 }, {
      color: i % 2 ? '#c0392b' : '#f4f6f8', crisp: true, stroke: 'rgba(20,28,40,.35)',
    });
  }
  return s;
}

function monumentSign(cam, L, state, night, pal, detail) {
  const m = state.signs.monument;
  const panel = { x: L.monument.x, y: L.monument.y, w: 3, d: 26, z0: 3.4, z1: 17 };
  const base = { x: panel.x - 1.4, y: panel.y - 2.6, w: 5.8, d: 31, z0: 0, z1: 3.4 };
  let s = drawBox(cam, base, { color: night ? '#3c4149' : '#9aa1aa', roof: night ? '#4a5058' : '#b4bac1', ao: 1 });
  const shell = mixHex(m.color === '#ffffff' ? '#16305c' : m.color, night ? 0.55 : 0.85);
  s += drawBox(cam, panel, { color: shell, roof: mixHex(shell, 1.2), ao: 1.2 });
  const f = boxFaces(cam, panel).find((q) => q.id === 'E');
  if (detail) s += f.quad(1, f.len - 1, 0.8, f.height - 0.8, { fill: 'rgba(255,255,255,.1)', stroke: 'rgba(255,255,255,.35)', 'stroke-width': 0.3 });

  const words = String(m.text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > 17) { lines.push(cur.trim()); cur = w; } else cur += ' ' + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  const ink = night ? mixHex(m.color, 1.45) : m.color;
  const size = clamp(1.9 - lines.length * 0.16, 0.95, 1.9);
  let y = f.height - 3.4;
  if (m.logo) { s += faceText(f, { t: f.len / 2, h: y - 1.4, text: m.logo, size: 3.1, color: ink, glow: night }); y -= 4.6; }
  lines.slice(0, 5).forEach((ln) => {
    s += faceText(f, { t: f.len / 2, h: y, text: ln, size, color: ink, glow: night, weight: 700 });
    y -= size * 1.45;
  });
  s += `<polygon class="hot" fill="transparent" stroke="none" data-sign="monument" points="${[f.at(0, 0), f.at(f.len, 0), f.at(f.len, f.height), f.at(0, f.height)]
    .map((p) => cam.project(...p).map((n) => n.toFixed(1)).join(',')).join(' ')}"/>`;
  if (night) s += ellipse(cam, panel.x + 1.5, panel.y + 13, 14, 8, { fill: 'url(#pool)' });
  return s;
}

/** Raised slab, steps and (optionally) a columned roof at the front doors. */
function porch(cam, L, state, night, pal) {
  const host = L.entry.host;
  const cx = L.entry.x;
  const y = host.y + host.d;
  let s = '';
  if (state.entrance.steps) {
    s += drawBox(cam, { x: cx - 15, y, w: 30, d: 7.5, z0: 0, z1: 1 }, { color: night ? '#5b626c' : '#cbd0d7', ao: 0.6 });
    s += drawBox(cam, { x: cx - 12, y: y + 7.5, w: 24, d: 2.6, z0: 0, z1: 0.5 }, { color: night ? '#525963' : '#c0c5cc' });
  }
  if (state.entrance.porch) {
    s += drawBox(cam, { x: cx - 17, y, w: 34, d: 15, z0: 1, z1: 1.8 }, { color: night ? '#646b76' : '#d5dae0', ao: 0.5 });
    for (const px of [cx - 14.5, cx - 5, cx + 4.5, cx + 13.5]) {
      s += drawBox(cam, { x: px - 0.9, y: y + 12, w: 1.8, d: 1.8, z0: 1.8, z1: 11.4 }, {
        color: night ? '#8d949e' : '#f0f2f5', stroke: 'rgba(20,28,40,.35)',
      });
    }
    // Kept low so it never climbs into the signage above the doors.
    s += drawBox(cam, { x: cx - 18, y: y - 1, w: 36, d: 17, z0: 11.4, z1: 13.2 }, {
      color: mixHex(state.skin.band, night ? 0.5 : 1),
      roof: mixHex(state.skin.band, night ? 0.62 : 1.14),
      stroke: 'rgba(14,20,30,.5)',
    });
    if (night) s += ellipse(cam, cx, y + 8, 20, 11, { fill: 'url(#pool)' });
  }
  return s;
}

/** The name on the building. It sits on its own fascia panel so it never has
 *  to fight the glazing underneath it. */
function wallSign(cam, host, state, night, wallColor, detail, full = false) {
  const sign = state.signs.wall;
  if (!sign.text && !sign.logo) return '';
  const f = boxFaces(cam, host).find((q) => q.id === 'N');
  const top = f.height;
  const chars = Math.max(6, (sign.text || '').length);

  // The panel: a band under the parapet, as deep as the building can carry.
  const bandH = full ? Math.min(top * 0.5, 18) : clamp(top * 0.34, 6.5, 17);
  const y1 = top - Math.max(full ? 1.6 : 2.8, top * (full ? 0.05 : 0.085));
  const y0 = Math.max(1, y1 - bandH);
  const h = y1 - y0;
  const inset = Math.min(3, f.len * 0.04);

  // Room for the stack of logo, name and strapline inside that band.
  const rows = (sign.logo ? 1.6 : 0) + 0.72 + (sign.sub ? 0.62 : 0) + 0.5;
  const size = clamp(Math.min((f.len - inset * 2) * 0.88 / (0.58 * chars), h / rows), 1.8, 20);
  const ink = night ? mixHex(sign.color, 1.45) : sign.color;
  // The panel is a real applied fascia, so it needs to read against the
  // lettering: light behind dark ink, dark behind light ink.
  const lum = (hex) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  };
  const face = lum(ink) > 0.55
    ? mixHex(wallColor, night ? 0.5 : 0.72)
    : mixHex(wallColor, night ? 1.25 : 1.13);

  let s = f.quad(inset - 0.7, f.len - inset + 0.7, y0 - 0.9, y1 + 0.6, { fill: 'rgba(14,22,34,.3)', stroke: 'none' });
  s += f.quad(inset, f.len - inset, y0, y1, { fill: face, stroke: 'rgba(14,22,34,.35)', 'stroke-width': 0.4 });
  if (detail) {
    s += f.quad(inset, f.len - inset, y1 - 0.45, y1, { fill: 'rgba(255,255,255,.34)', stroke: 'none' });
    s += f.quad(inset, f.len - inset, y0, y0 + 0.45, { fill: 'rgba(10,16,26,.22)', stroke: 'none' });
  }

  // Centre the stack in the band and walk down it.
  const stack = rows * size;
  let y = y0 + (h - stack) / 2 + stack;
  if (sign.logo) {
    y -= size * 1.6 * 0.8;
    s += faceText(f, { t: f.len / 2, h: y, text: sign.logo, size: size * 1.6, color: ink, glow: night });
    y -= size * 0.3;
  }
  y -= size * 0.72;
  s += faceText(f, {
    t: f.len / 2, h: y, text: sign.text || '', size, color: ink,
    letter: size * 0.06, glow: night, shadow: !night,
  });
  if (sign.sub) {
    y -= size * 0.5;
    s += faceText(f, {
      t: f.len / 2, h: y, text: sign.sub, size: size * 0.4, color: ink,
      letter: size * 0.1, weight: 600, glow: night, opacity: 0.92,
    });
  }
  if (night) s += f.quad(inset, f.len - inset, y0 - 2, y1, { fill: 'url(#wallLamp)', stroke: 'none' });

  s += `<polygon class="hot" fill="transparent" stroke="none" data-sign="wall" points="${
    [f.at(inset, y1), f.at(f.len - inset, y1), f.at(f.len - inset, y0), f.at(inset, y0)]
      .map((p) => cam.project(...p).map((n) => n.toFixed(1)).join(',')).join(' ')}"/>`;
  return s;
}

/* ---------------------------------------------------------- ground marking */

function stallStripes(cam, s, pal) {
  const w = 0.5;
  let out = pad(cam, { x: s.x, y: s.y, w, d: STALL.d }, { fill: pal.stripe, stroke: 'none' });
  out += pad(cam, { x: s.x + STALL.w - w, y: s.y, w, d: STALL.d }, { fill: pal.stripe, stroke: 'none' });
  return out;
}

function crosswalk(cam, x, y, w, d, pal) {
  let out = '';
  for (let t = 0; t < w - 1.4; t += 3.4) {
    out += pad(cam, { x: x + t, y, w: 1.8, d }, { fill: pal.stripe, stroke: 'none' });
  }
  return out;
}

/** A lane arrow painted on the drive. */
function arrow(cam, x, y, pal, dir = 1) {
  const tip = y + 7 * dir;
  return poly(cam, [
    [x - 0.9, y], [x + 0.9, y], [x + 0.9, y + 4.2 * dir], [x + 2.6, y + 4.2 * dir],
    [x, tip], [x - 2.6, y + 4.2 * dir], [x - 0.9, y + 4.2 * dir],
  ], { fill: pal.stripe, stroke: 'none', opacity: 0.75 });
}

/* ------------------------------------------------------------------- scene */

export function render(state, size, opts = {}) {
  const L = layout(state);
  const night = state.view.time === 'night';
  const pal = palette(night);
  const { lot } = state;
  const r = rng(1337);

  // Fit the whole lot (and the tallest roof) into the frame.
  const probe = makeCamera({ rot: state.view.rot, scale: 1, cx: lot.width / 2, cy: lot.depth / 2, ox: 0, oy: 0 });
  const maxZ = Math.max(L.main.z1, L.office ? L.office.z1 : 0, 30);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const bounds = [[-46, -46], [lot.width + 46, -46], [lot.width + 46, lot.depth + 70], [-46, lot.depth + 70]];
  for (const [x, y] of bounds) {
    for (const z of [-11, maxZ]) {
      const [px, py] = probe.project(x, y, z);
      minX = Math.min(minX, px); maxX = Math.max(maxX, px);
      minY = Math.min(minY, py); maxY = Math.max(maxY, py);
    }
  }
  const fit = Math.min(size.w / (maxX - minX), size.h / (maxY - minY)) * 0.995 * (state.view.zoom || 1);
  const cam = makeCamera({
    rot: state.view.rot,
    scale: fit,
    cx: lot.width / 2,
    cy: lot.depth / 2,
    ox: size.w / 2 - ((minX + maxX) / 2) * fit,
    oy: size.h / 2 - ((minY + maxY) / 2) * fit,
  });
  // Fine material detail is wasted once a foot is under half a pixel — and
  // while a slider is being dragged, the cheap pass keeps the drag at speed.
  const fast = !!opts.fast;
  const detail = fit > 0.55 && !fast;

  let ground = '';
  // The site sits on a slab, like a model on a table — it gives the grass an
  // edge to stop at instead of fading into sky at the corners.
  const slab = { x: -46, y: -46, w: lot.width + 92, d: lot.depth + 116, z0: -11, z1: 0 };
  const shadows = [];
  const items = [];
  const add = (key, svg) => items.push({ key, svg });
  const shade_ = (box) => shadows.push(night ? { ...box, z0: box.z0 * 0.3, z1: box.z1 * 0.3 } : box);
  // Is the street-facing wall — docks, doors, signage — the one we can see?
  const frontOn = facing(cam, 0, 1);

  /* --- ground ------------------------------------------------------------ */
  if (!fast) ground += `<g filter="url(#slabShadow)"><polygon fill="rgba(8,14,26,${night ? 0.5 : 0.34})" points="${
    [[slab.x + 10, slab.y + 14, 0], [slab.x + slab.w + 12, slab.y + 16, 0],
     [slab.x + slab.w + 12, slab.y + slab.d + 18, 0], [slab.x + 8, slab.y + slab.d + 16, 0]]
      .map((q) => cam.project(q[0], q[1], -12).map((n) => n.toFixed(1)).join(',')).join(' ')}"/></g>`;
  ground += drawBox(cam, slab, { color: pal.soil, roof: pal.grass, stroke: 'rgba(12,18,28,.4)' });
  if (!fast) ground += pad(cam, { x: slab.x, y: slab.y, w: slab.w, d: slab.d, z: 0.01 }, { fill: 'url(#grassTex)', stroke: 'none' });

  // Street, centre line, kerb and footway.
  const roadY = lot.depth + 12;
  const roadX = slab.x;
  const roadW = slab.w;
  ground += pad(cam, { x: roadX, y: roadY, w: roadW, d: slab.y + slab.d - roadY }, { fill: pal.road });
  if (!fast) ground += pad(cam, { x: roadX, y: roadY, w: roadW, d: slab.y + slab.d - roadY }, { fill: 'url(#asphTex)', stroke: 'none' });
  for (let x = roadX + 6; x < roadX + roadW - 12; x += 22) {
    ground += pad(cam, { x, y: roadY + 25, w: 12, d: 0.9 }, { fill: pal.roadLine, stroke: 'none' });
  }
  ground += pad(cam, { x: roadX, y: lot.depth + 4, w: roadW, d: 8 }, { fill: pal.walk });
  ground += pad(cam, { x: roadX, y: roadY - 1, w: roadW, d: 1 }, { fill: pal.curb, stroke: 'none' });

  // Yard paving. A storage compound is paved all the way back, since the
  // aisles between the rows are drive lanes.
  const paveY = state.type === 'storage' ? L.main.y - 14 : L.front - 2;
  const paveX = L.main.x - 46;
  const paveW = L.main.w + 92;
  const paveD = Math.max(20, lot.depth - paveY - 16);
  ground += pad(cam, { x: paveX, y: paveY, w: paveW, d: paveD }, { fill: pal.asphalt, stroke: pal.curb, 'stroke-width': 1.2 });
  if (!fast) ground += pad(cam, { x: paveX, y: paveY, w: paveW, d: paveD }, { fill: 'url(#asphTex)', stroke: 'none' });
  // The drive out to the street.
  ground += pad(cam, { x: L.driveX - 24, y: paveY + paveD - 2, w: 48, d: lot.depth - paveY - paveD + 10 }, { fill: pal.asphalt, stroke: pal.curb, 'stroke-width': 1.2 });

  // Concrete truck apron in front of the docks — poured, not paved.
  if (state.type === 'warehouse' && L.dockRun && L.dockRun.bays) {
    ground += pad(cam, { x: L.dockRun.from - 6, y: L.front, w: L.dockRun.span + 12, d: 62 }, {
      fill: night ? '#2f343c' : '#7e848c', stroke: 'rgba(255,255,255,.12)', 'stroke-width': 0.8,
    });
    if (detail) {
      for (let x = L.dockRun.from; x < L.dockRun.to; x += 12) {
        ground += line(cam, [x, L.front, 0.01], [x, L.front + 62, 0.01], { stroke: 'rgba(255,255,255,.09)', 'stroke-width': 0.8 });
      }
    }
  }

  // Walkway across the front of the building.
  const walkY = L.front + (L.office && L.office.side !== 'podium' ? 15 : 1);
  ground += pad(cam, { x: L.main.x - 10, y: walkY, w: L.main.w + 20, d: 8 }, { fill: pal.walk, stroke: 'rgba(0,0,0,.18)', 'stroke-width': 0.5 });

  /* --- parking ----------------------------------------------------------- */
  L.stalls = [];
  L.islands = [];
  if (state.site.parking) {
    // Rows of stalls with a drive aisle between each, filling whatever yard is
    // left once the truck court and the entrance drive are taken out.
    const pk = L.park;
    const pitch = STALL.d + 26;
    const rows = Math.max(0, Math.floor((pk.y1 - pk.y0) / pitch));
    for (let rw = 0; rw < rows; rw++) {
      const y = pk.y0 + rw * pitch;
      const run = [];
      for (let x = pk.x0; x + STALL.w <= pk.x1; x += STALL.w) {
        // Leave the drive and the walk to the front doors clear.
        if (Math.abs(x + STALL.w / 2 - L.driveX) < 32) continue;
        if (rw === 0 && Math.abs(x + STALL.w / 2 - L.entry.x) < 16) continue;
        ground += stallStripes(cam, { x, y }, pal);
        const ada = rw === 0 && Math.abs(x - L.entry.x) < 40;
        L.stalls.push({ x, y, ada });
        run.push(x);
      }
      if (run.length > 2) {
        // A kerbed island at each end of the run, planted.
        for (const [ix, sign] of [[Math.min(...run) - 9, 1], [Math.max(...run) + STALL.w + 1, -1]]) {
          if (ix < pk.x0 - 12 || ix > pk.x1 + 4) continue;
          ground += pad(cam, { x: ix, y: y - 1, w: 8, d: STALL.d + 2 }, { fill: pal.walk, stroke: 'rgba(0,0,0,.2)', 'stroke-width': 0.5 });
          ground += pad(cam, { x: ix + 1, y, w: 6, d: STALL.d }, { fill: pal.grassAlt, stroke: 'none' });
          L.islands.push({ x: ix + 4, y: y + 4 }, { x: ix + 4, y: y + STALL.d - 5 });
        }
      }
    }
    for (const st of L.stalls.filter((q) => q.ada)) {
      ground += pad(cam, { x: st.x + 0.6, y: st.y + 0.6, w: STALL.w - 1.2, d: STALL.d - 1.2 }, {
        fill: night ? 'rgba(46,86,150,.45)' : 'rgba(38,94,168,.5)', stroke: 'none',
      });
    }
  }

  // Painted approach: crosswalk to the front doors, arrows and a stop bar.
  if (detail) {
    ground += crosswalk(cam, L.entry.x - 12, L.front + 24, 24, 7, pal);
    ground += arrow(cam, L.driveX - 11, L.gateY + 26, pal, -1);
    ground += arrow(cam, L.driveX + 11, L.gateY + 30, pal, 1);
    ground += pad(cam, { x: L.driveX - 23, y: L.gateY + 12, w: 22, d: 1.6 }, { fill: pal.stripe, stroke: 'none' });
  }

  /* --- everything with height, painted back to front --------------------- */
  const wall = night ? mixHex(state.skin.wall, 0.44) : state.skin.wall;
  const band = night ? mixHex(state.skin.band, 0.52) : state.skin.band;
  const roofColor = night ? '#262b33' : '#b6bcc3';

  // Storage rows sit behind the main mass.
  if (state.type === 'storage' && L.rows) {
    L.rows.forEach((row, i) => {
      if (i === 0) return;
      shade_(row);
      add(nearKey(cam, row), drawBox(cam, row, {
        color: wall, roof: roofColor, ao: 2.4,
        decorate: (f) => {
          if (f.id === 'N' || f.id === 'S') {
            return dockDoors(f, { from: 0, to: f.len, bays: clamp(Math.round(state.body.bays), 1, 40), span: f.len },
              (t) => t, night, detail, { bumpers: false, canopy: false });
          }
          return ribs(f, { step: 4, detail });
        },
      }) + roofDetail(cam, row, { pal, night, kind: 'flat', detail, seed: 9 + i }));
    });
  }

  // The main building.
  const mainKey = nearKey(cam, L.main);
  shade_(L.main);
  add(mainKey, drawBox(cam, L.main, {
    color: wall, roof: roofColor, ao: 3,
    decorate: (f) => {
      let s = '';
      const isFront = f.id === 'N';
      if (state.type === 'tower') {
        s += windows(f, { style: 'curtain', floors: state.body.floors, night, seed: f.id === 'N' ? 21 : f.id === 'E' ? 33 : 44, detail, band });
        if (detail) s += f.quad(0, f.len, f.height - 2.4, f.height, { fill: mixHex(band, night ? 0.7 : 1.1), stroke: 'none' });
        return s;
      }
      if (state.type === 'retail' && isFront) return storefront(f, state, night, detail, band);
      s += panelJoints(f, { step: state.type === 'storage' ? 0 : 25, pal, detail: detail && state.type !== 'storage' });
      if (state.type === 'storage') s += ribs(f, { step: 4, detail });
      // Parapet band all the way round, in proportion to the wall it caps.
      const bh = clamp(f.height * 0.1, 0.9, 3);
      s += f.quad(0, f.len, f.height - bh, f.height, { fill: band, stroke: 'none' });
      if (detail) s += f.quad(0, f.len, f.height - bh, f.height - bh * 0.85, { fill: 'rgba(255,255,255,.28)', stroke: 'none' });
      if (isFront) {
        if (state.type === 'warehouse') s += dockDoors(f, L.dockRun, (wx) => wx - L.main.x, night, detail, { numbers: true });
        if (state.type === 'storage') {
          s += dockDoors(f, { from: 0, to: f.len, bays: clamp(Math.round(state.body.bays), 1, 40), span: f.len },
            (t) => t, night, detail, { bumpers: false, canopy: false });
        }
        if (!L.office) s += entranceDetail(f, state, night, detail);
      }
      return s;
    },
  }) + roofDetail(cam, L.main, {
    pal, night, detail,
    kind: L.main.w * L.main.d > 20000 ? 'flat-large' : 'flat',
  }));

  // The office wing / podium — the part that gets floors, windows and the sign.
  if (L.office) {
    const o = L.office;
    const floors = state.type === 'tower' ? 1 : state.office.floors;
    const oKey = Math.max(mainKey, nearKey(cam, o));
    shade_(o);
    add(frontOn ? oKey + 1 : Math.min(mainKey, nearKey(cam, o)) - 1, drawBox(cam, o, {
      color: state.type === 'tower' ? mixHex(wall, 1.08) : wall,
      roof: roofColor, ao: 3,
      decorate: (f) => {
        let s = panelJoints(f, { step: 25, pal, detail });
        const bh = clamp(f.height * 0.08, 0.9, 2.8);
        s += f.quad(0, f.len, f.height - bh, f.height, { fill: band, stroke: 'none' });
        if (detail) s += f.quad(0, f.len, f.height - bh, f.height - bh * 0.85, { fill: 'rgba(255,255,255,.28)', stroke: 'none' });
        if (f.id === 'N' || f.id === 'E' || f.id === 'W') {
          s += windows(f, {
            style: state.skin.windows, floors, night, detail, band,
            seed: f.id === 'N' ? 11 : f.id === 'E' ? 5 : 9,
            base: state.type === 'tower' ? 2 : 0,
          });
        }
        if (f.id === 'N') s += entranceDetail(f, state, night, detail);
        return s;
      },
    }) + roofDetail(cam, o, { pal, night, kind: 'flat', detail, seed: 17 }));
  }

  // Wall signage sits on the front face, so it only exists when that face does.
  if (frontOn) {
    let signHost = state.type === 'tower' ? L.main : L.office || L.main;
    let full = false;
    let svg = '';
    if (signHost.z1 < 30) {
      // A low building has no wall deep enough to carry a readable name, so it
      // gets what a real one gets: a raised parapet element over the entrance.
      const fw = clamp(signHost.w * 0.32, 50, 120);
      const fx = clamp(L.entry.x - fw / 2, signHost.x + 1, signHost.x + signHost.w - fw - 1);
      const feature = { x: fx, y: signHost.y + signHost.d - 7, w: fw, d: 9, z0: 0, z1: signHost.z1 + 13 };
      svg += drawBox(cam, feature, {
        color: wall, roof: mixHex(band, night ? 0.7 : 1.05), ao: 3,
        decorate: (f) => {
          const bh = clamp(f.height * 0.07, 0.9, 2.2);
          let q = panelJoints(f, { step: 22, pal, detail });
          q += f.quad(0, f.len, f.height - bh, f.height, { fill: band, stroke: 'none' });
          if (detail) q += f.quad(0, f.len, f.height - bh, f.height - bh * 0.85, { fill: 'rgba(255,255,255,.28)', stroke: 'none' });
          // The entrance belongs on this element, since it stands over it.
          if (f.id === 'N') q += entranceDetail(f, state, night, detail);
          return q;
        },
      });
      signHost = feature;
      full = true;
      shade_(feature);
    }
    svg += wallSign(cam, signHost, state, night, wall, detail, full);
    add(Math.max(mainKey, nearKey(cam, signHost)) + 2, svg);
  }

  if (state.entrance.porch || state.entrance.steps) {
    add(frontOn ? nearKey(cam, L.entry.host) + 1.5 : mainKey - 2, porch(cam, L, state, night, pal));
  }

  /* --- yard traffic ------------------------------------------------------ */
  if (state.site.trailers && state.type === 'warehouse' && L.dockRun && L.dockRun.bays) {
    const step = L.dockRun.span / L.dockRun.bays;
    for (let i = 0; i < L.dockRun.bays; i++) {
      if (r() > 0.72) continue;
      const cx = L.dockRun.from + step * (i + 0.5);
      const box = { x: cx - 4.25, y: L.front + 1, w: 8.5, d: 45, z0: 4.4, z1: 17.6 };
      shade_(box);
      add(nearKey(cam, box), trailer(cam, box.x, box.y, night, pal, detail, i));
    }
    // A drop lot: spare trailers parked out in the yard, which is what fills
    // a truck court in real life.
    const dropY = L.front + 74;
    if (dropY + 46 < lot.depth - 40) {
      for (let i = 0; i < 4; i++) {
        const dx = L.dockRun.from + 14 + i * 15;
        if (dx > L.dockRun.to - 6) break;
        const box = { x: dx, y: dropY, w: 8.5, d: 45, z0: 4.4, z1: 17.6 };
        shade_(box);
        add(nearKey(cam, box), trailer(cam, box.x, box.y, night, pal, detail, 40 + i));
      }
    }

    // One rig on the move in the yard.
    const tx = clamp(L.dockRun.to + 18, 20, lot.width - 30);
    const ty = L.front + 78;
    if (ty < lot.depth - 40) {
      shade_({ x: tx, y: ty, w: 8.5, d: 20, z0: 0, z1: 13.5 });
      add(nearKey(cam, { x: tx, y: ty, w: 8.5, d: 20 }), tractor(cam, tx, ty, night, '#2c4a7c'));
    }
  }

  if (state.site.cars && L.stalls.length) {
    const colors = ['#c8ccd2', '#26374f', '#7d2f2f', '#1e2229', '#e9ebee', '#35543f', '#5a6472', '#8d5a24'];
    for (const s of L.stalls) {
      if (r() > 0.62) continue;
      const box = { x: s.x + 1.5, y: s.y + 2, w: 6, d: 14, z0: 0, z1: 5.5 };
      shade_(box);
      add(nearKey(cam, box), car(cam, box.x, box.y, colors[Math.floor(r() * colors.length)], night, detail));
    }
  }

  /* --- boundary and security -------------------------------------------- */
  if (state.security.fence) {
    add(cam.depth(lot.width / 2, lot.depth) + 3, fenceLine(cam, 4, lot.width - 4, lot.depth, [L.driveX - 26, L.driveX + 26], pal));
  }
  if (state.security.booth) {
    shade_({ ...L.booth, z1: 12.6 });
    add(nearKey(cam, L.booth) + 1, guardBooth(cam, L, state, night, pal, detail));
  }
  if (state.security.gate) add(cam.depth(L.driveX, L.gateY) + 1.2, gateArm(cam, L, night));
  if (state.signs.monument.on) {
    shade_({ x: L.monument.x - 1.4, y: L.monument.y - 2.6, w: 5.8, d: 31, z0: 0, z1: 17 });
    add(nearKey(cam, L.monument) + 1.4, monumentSign(cam, L, state, night, pal, detail));
  }
  for (let i = 0; i < clamp(Math.round(state.security.barricades), 0, 24); i++) {
    const side = i % 2 ? 1 : -1;
    const bx = L.driveX + side * (27 + Math.floor(i / 2) * 7);
    const by = L.gateY + 16;
    shade_({ x: bx - 0.75, y: by - 0.75, w: 1.5, d: 1.5, z0: 0, z1: 3.6 });
    add(cam.depth(bx, by) + 1, bollard(cam, bx, by, night));
  }
  if (state.security.guard && state.security.booth) {
    add(cam.depth(L.driveX - 16, L.gateY + 6) + 1.5, person(cam, L.driveX - 16, L.gateY + 6, '#1b2027'));
    add(cam.depth(L.booth.x + 31, L.booth.y + 7) + 1.5, person(cam, L.booth.x + 31, L.booth.y + 7, '#7a4b2a'));
  }

  /* --- landscape --------------------------------------------------------- */
  if (state.site.poles) {
    for (const px of [lot.width * 0.18, lot.width * 0.5, lot.width * 0.82]) {
      const py = L.front + Math.max(34, L.yard * 0.5);
      if (Math.abs(px - L.driveX) < 26) continue;
      shade_({ x: px - 1.3, y: py - 1.3, w: 2.6, d: 2.6, z0: 0, z1: 27 });
      add(cam.depth(px, py), lightPole(cam, px, py, night, pal));
    }
  }
  if (state.site.trees) {
    for (let i = 0; i < 10; i++) {
      const tx = 16 + (i / 9) * (lot.width - 32);
      if (Math.abs(tx - L.driveX) < 42) continue;
      const ty = lot.depth - 15;
      const sc = 0.85 + r() * 0.5;
      shade_({ x: tx - 7 * sc, y: ty - 6 * sc, w: 14 * sc, d: 12 * sc, z0: 12 * sc, z1: 15 * sc });
      add(cam.depth(tx, ty), tree(cam, tx, ty, sc, pal, i + 3));
    }
    for (const tx of [L.main.x - 28, L.main.x + L.main.w + 28]) {
      const ty = L.front + 46;
      shade_({ x: tx - 8, y: ty - 7, w: 16, d: 14, z0: 13, z1: 17 });
      add(cam.depth(tx, ty), tree(cam, tx, ty, 1.15, pal, 21));
    }
    for (const is of L.islands) {
      add(cam.depth(is.x, is.y), shrub(cam, is.x, is.y, pal, 0.9));
    }
  }

  items.sort((a, b) => a.key - b.key);

  const shadowLayer = shadows.length && !fast
    ? `<g filter="url(#softShadow)" fill="${night ? 'rgba(0,0,0,.45)' : pal.shadow}">${shadows.map((b) => shadowOf(cam, b)).join('')}</g>`
    : '';

  return { svg: ground + shadowLayer + items.map((i) => i.svg).join(''), cam, layout: L, pal };
}

/* ------------------------------------------------------------------- frame */

export function frame(state, size, inner) {
  const night = state.view.time === 'night';
  const pal = palette(night);
  const horizon = size.h * 0.42;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size.w} ${size.h}" width="100%" height="100%" role="img" aria-label="Isometric view of the design">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${pal.sky0}"/>
      <stop offset="${night ? 0.75 : 0.62}" stop-color="${pal.sky1}"/>
      <stop offset="1" stop-color="${night ? '#25324a' : '#e8f1f7'}"/>
    </linearGradient>
    <linearGradient id="wallFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="rgba(255,255,255,${night ? 0.05 : 0.14})"/>
      <stop offset="0.55" stop-color="rgba(255,255,255,0)"/>
      <stop offset="1" stop-color="rgba(10,16,26,${night ? 0.3 : 0.16})"/>
    </linearGradient>
    <linearGradient id="roofFade" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="rgba(255,255,255,${night ? 0.03 : 0.12})"/>
      <stop offset="1" stop-color="rgba(10,16,26,${night ? 0.22 : 0.1})"/>
    </linearGradient>
    <linearGradient id="baseAO" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="rgba(12,18,28,0)"/>
      <stop offset="1" stop-color="rgba(12,18,28,${night ? 0.5 : 0.34})"/>
    </linearGradient>
    <linearGradient id="glassDay" x1="0" y1="0" x2="0.25" y2="1">
      <stop offset="0" stop-color="#cfe2f0"/>
      <stop offset="0.42" stop-color="#8fb4d0"/>
      <stop offset="0.43" stop-color="#5f87a8"/>
      <stop offset="1" stop-color="#476b8c"/>
    </linearGradient>
    <linearGradient id="glassLit" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffe6b0"/>
      <stop offset="1" stop-color="#f0bf6a"/>
    </linearGradient>
    <radialGradient id="pool">
      <stop offset="0" stop-color="rgba(255,231,168,.40)"/>
      <stop offset="0.55" stop-color="rgba(255,226,158,.16)"/>
      <stop offset="1" stop-color="rgba(255,226,158,0)"/>
    </radialGradient>
    <radialGradient id="wallLamp" cx="0.5" cy="0.85" r="0.75">
      <stop offset="0" stop-color="rgba(255,226,160,.30)"/>
      <stop offset="1" stop-color="rgba(255,226,160,0)"/>
    </radialGradient>
    <radialGradient id="sunGlow">
      <stop offset="0" stop-color="rgba(255,246,214,.85)"/>
      <stop offset="1" stop-color="rgba(255,246,214,0)"/>
    </radialGradient>
    <pattern id="asphTex" width="34" height="34" patternUnits="userSpaceOnUse">
      <rect width="34" height="34" fill="rgba(255,255,255,0)"/>
      <circle cx="7" cy="9" r="1.3" fill="rgba(255,255,255,.035)"/>
      <circle cx="24" cy="6" r="1" fill="rgba(0,0,0,.05)"/>
      <circle cx="15" cy="21" r="1.5" fill="rgba(255,255,255,.028)"/>
      <circle cx="29" cy="27" r="1.1" fill="rgba(0,0,0,.045)"/>
      <circle cx="3" cy="28" r="0.9" fill="rgba(255,255,255,.03)"/>
    </pattern>
    <pattern id="grassTex" width="22" height="22" patternUnits="userSpaceOnUse">
      <rect width="22" height="22" fill="rgba(255,255,255,0)"/>
      <circle cx="5" cy="15" r="4.2" fill="rgba(0,0,0,.022)"/>
      <circle cx="16" cy="6" r="3.4" fill="rgba(255,255,255,${night ? 0.012 : 0.026})"/>
      <circle cx="19" cy="18" r="2.2" fill="rgba(0,0,0,.016)"/>
    </pattern>
    <pattern id="mesh" width="6" height="6" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill="rgba(24,30,40,${night ? 0.4 : 0.18})"/>
      <path d="M0 0 L6 6 M6 0 L0 6" stroke="rgba(210,218,228,${night ? 0.14 : 0.3})" stroke-width="0.7"/>
    </pattern>
    <filter id="slabShadow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="${(size.w / 90).toFixed(2)}"/>
    </filter>
    <filter id="softShadow" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur stdDeviation="${(size.w / 420).toFixed(2)}"/>
    </filter>
    <filter id="signGlow" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="${night ? 2.2 : 0}" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="lampGlow" x="-300%" y="-300%" width="700%" height="700%">
      <feGaussianBlur stdDeviation="${(size.w / 190).toFixed(2)}" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="cloud" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="${(size.w / 150).toFixed(2)}"/>
    </filter>
  </defs>
  <rect width="${size.w}" height="${size.h}" fill="url(#sky)"/>
  ${night ? starfield(size) : daySky(size)}
  <rect y="${horizon.toFixed(0)}" width="${size.w}" height="${(size.h - horizon).toFixed(0)}" fill="${pal.haze}" opacity="${night ? 0.5 : 0.35}"/>
  ${inner}
</svg>`;
}

function starfield(size) {
  const r = rng(99);
  let s = '';
  for (let i = 0; i < 90; i++) {
    s += `<circle cx="${(r() * size.w).toFixed(0)}" cy="${(r() * size.h * 0.55).toFixed(0)}" r="${(r() * 1.1 + 0.25).toFixed(1)}" fill="rgba(255,255,255,${(0.25 + r() * 0.65).toFixed(2)})"/>`;
  }
  const mx = size.w * 0.82;
  const my = size.h * 0.15;
  s += `<circle cx="${mx.toFixed(0)}" cy="${my.toFixed(0)}" r="${(size.h * 0.1).toFixed(0)}" fill="url(#sunGlow)" opacity=".5"/>`;
  s += `<circle cx="${mx.toFixed(0)}" cy="${my.toFixed(0)}" r="${(size.h * 0.04).toFixed(0)}" fill="#f6f2e4"/>`;
  s += `<circle cx="${(mx - size.h * 0.012).toFixed(0)}" cy="${(my - size.h * 0.008).toFixed(0)}" r="${(size.h * 0.038).toFixed(0)}" fill="#fffdf6"/>`;
  return s;
}

function daySky(size) {
  const r = rng(7);
  const sx = size.w * 0.2;
  const sy = size.h * 0.1;
  let s = `<circle cx="${sx.toFixed(0)}" cy="${sy.toFixed(0)}" r="${(size.h * 0.26).toFixed(0)}" fill="url(#sunGlow)" opacity=".45"/>`;
  s += '<g filter="url(#cloud)" fill="#ffffff">';
  for (let i = 0; i < 6; i++) {
    const cx = r() * size.w;
    const cy = size.h * (0.04 + r() * 0.2);
    const rx = size.w * (0.05 + r() * 0.07);
    s += `<g opacity="${(0.55 + r() * 0.35).toFixed(2)}">`;
    s += `<ellipse cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" rx="${rx.toFixed(0)}" ry="${(rx * 0.3).toFixed(0)}"/>`;
    s += `<ellipse cx="${(cx + rx * 0.45).toFixed(0)}" cy="${(cy - rx * 0.16).toFixed(0)}" rx="${(rx * 0.55).toFixed(0)}" ry="${(rx * 0.32).toFixed(0)}"/>`;
    s += `<ellipse cx="${(cx - rx * 0.5).toFixed(0)}" cy="${(cy - rx * 0.06).toFixed(0)}" rx="${(rx * 0.42).toFixed(0)}" ry="${(rx * 0.24).toFixed(0)}"/>`;
    s += '</g>';
  }
  return s + '</g>';
}
