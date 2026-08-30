/* Assembles the drawing from state.objects.
 *
 * Every object is wrapped in a <g data-id> so the editor can pick it, and the
 * whole scene is painted back to front from the camera's own depth. */

import {
  makeCamera, drawBox, boxFaces, poly, line, pad, ellipse, faceText, topFace,
  mixHex, rgba, lum, clamp, corners, hull, shadowOf, overlaps, contains, facing, SUN,
} from './iso.js';
import { drawCell, drawRoofItem, drawBooth, drawProp } from './parts.js';
import {
  FLOOR_HEIGHT, STALL, PROP_BY_ID, ROOF_BY_ID, BOOTH_BY_ID, buildingHeight, wallCols,
  footprint, objHeight,
} from './catalog.js';

export { footprint, objHeight };

const FACES = ['N', 'E', 'S', 'W'];

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

/* ----------------------------------------------------------------- palette */

export function palette(night) {
  return night
    ? {
      night: true,
      sky0: '#050a16', sky1: '#16233c', haze: 'rgba(90,120,170,.20)',
      grass: '#1a2a1b', grassAlt: '#203320', soil: '#151820',
      asphalt: '#1b1f27', stripe: 'rgba(224,230,214,.42)',
      walk: '#2c323c', curb: '#3a404a', road: '#14171d', roadLine: 'rgba(196,178,86,.55)',
      concrete: '#2f343c', shadow: 'rgba(0,0,0,.45)',
      trunk: '#2a2118', leaf: '#1d3a27', leafHi: '#26492f',
    }
    : {
      night: false,
      sky0: '#3f86cf', sky1: '#cfe4f2', haze: 'rgba(255,255,255,.55)',
      grass: '#6d9159', grassAlt: '#7ba065', soil: '#6b5a46',
      asphalt: '#53585f', stripe: 'rgba(246,244,232,.92)',
      walk: '#b9bec6', curb: '#cfd3d8', road: '#44494f', roadLine: 'rgba(226,196,84,.9)',
      concrete: '#7e848c', shadow: 'rgba(22,32,50,.40)',
      trunk: '#6b5340', leaf: '#3f7a4a', leafHi: '#5aa05f',
    };
}

/* --------------------------------------------------------------- footprints */

export const bounds = (fp) => {
  const c = corners(fp);
  return {
    x0: Math.min(...c.map((p) => p[0])), x1: Math.max(...c.map((p) => p[0])),
    y0: Math.min(...c.map((p) => p[1])), y1: Math.max(...c.map((p) => p[1])),
  };
};

const nearKey = (cam, fp) => Math.max(...corners(fp).map((p) => cam.depth(p[0], p[1])));

/** Buildings an object must not sit inside. */
export const buildingsOf = (state) => state.objects.filter((o) => o.kind === 'building');

/** Is this footprint clear of every building (and optionally other solids)? */
export function isClear(state, fp, ignoreId) {
  for (const b of state.objects) {
    if (b.id === ignoreId) continue;
    if (b.kind !== 'building') continue;
    if (overlaps(fp, footprint(b), -0.5)) return false;
  }
  return true;
}

/* ------------------------------------------------------------------ camera */

export function fitCamera(state, size) {
  const { lot, view } = state;
  const margin = 46;
  const slab = { x: -margin, y: -margin, w: lot.width + margin * 2, d: lot.depth + margin + 70, rot: 0 };
  const probe = makeCamera({ yaw: view.yaw, pitch: view.pitch, scale: 1, cx: lot.width / 2, cy: lot.depth / 2 });
  let maxZ = 40;
  for (const o of state.objects) maxZ = Math.max(maxZ, objHeight(o) + 20);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of corners(slab)) {
    for (const z of [-11, maxZ]) {
      const [px, py] = probe.project(x, y, z);
      minX = Math.min(minX, px); maxX = Math.max(maxX, px);
      minY = Math.min(minY, py); maxY = Math.max(maxY, py);
    }
  }
  const fit = Math.min(size.w / (maxX - minX), size.h / (maxY - minY)) * 0.98;
  const scale = fit * (view.zoom || 1);
  return makeCamera({
    yaw: view.yaw,
    pitch: view.pitch,
    scale,
    cx: lot.width / 2 + (view.panX || 0),
    cy: lot.depth / 2 + (view.panY || 0),
    ox: size.w / 2 - ((minX + maxX) / 2) * scale,
    oy: size.h / 2 - ((minY + maxY) / 2) * scale,
  });
}

/* --------------------------------------------------------------- buildings */

/** World position and frame of one wall cell, used for aprons and paths. */
function cellAnchor(cam, b, face, col) {
  const box = { x: b.x, y: b.y, w: b.w, d: b.d, rot: b.rot || 0, z0: 0, z1: buildingHeight(b) };
  const f = boxFaces(cam, box).find((q) => q.id === face);
  if (!f) return null;
  const cols = wallCols(b, face);
  const cw = f.len / cols;
  const t = (col + 0.5) * cw;
  const p = f.at(t, 0);
  return { p, normal: f.normal, cw, face: f };
}

function drawBuilding(cam, b, ctx) {
  const { night, detail, pal } = ctx;
  const H = buildingHeight(b);
  const box = { x: b.x, y: b.y, w: b.w, d: b.d, rot: b.rot || 0, z0: 0, z1: H };
  const wall = night ? mixHex(b.wall, 0.44) : b.wall;
  const band = night ? mixHex(b.band, 0.52) : b.band;
  const rowH = H / Math.max(1, b.floors);
  let dockTag = 0;
  let signSvg = '';

  let svg = drawBox(cam, box, {
    color: wall,
    roof: night ? '#262b33' : '#b6bcc3',
    ao: Math.min(3, H * 0.12),
    decorate: (f) => {
      const g = b.walls[f.id];
      let s = '';
      // Precast joints, unless the whole wall is glass.
      if (detail && b.style !== 'tower') {
        for (let t = 25; t < f.len - 1; t += 25) {
          s += f.quad(t - 0.18, t + 0.18, 0, f.height, { fill: 'rgba(20,28,40,.16)', stroke: 'none' });
          s += f.quad(t + 0.18, t + 0.5, 0, f.height, { fill: 'rgba(255,255,255,.14)', stroke: 'none' });
        }
      }
      if (g) {
        const cols = g[0] ? g[0].length : 0;
        const cw = f.len / Math.max(1, cols);
        for (let row = 0; row < g.length; row++) {
          for (let col = 0; col < cols; col++) {
            const type = g[row][col];
            if (!type || type === 'blank') continue;
            s += drawCell(f, {
              type, t0: col * cw, t1: (col + 1) * cw,
              h0: row * rowH, h1: (row + 1) * rowH,
              night, detail, band, tag: type === 'dock' ? ++dockTag : null,
            });
          }
        }
      }
      // Parapet, in proportion to the wall it caps.
      if (b.parapet !== false) {
        const bh = clamp(f.height * 0.09, 0.9, 3);
        s += f.quad(0, f.len, f.height - bh, f.height, { fill: band, stroke: 'none' });
        if (detail) s += f.quad(0, f.len, f.height - bh, f.height - bh * 0.85, { fill: 'rgba(255,255,255,.28)', stroke: 'none' });
      }
      // The sign is collected, not drawn here: on a low building its fascia
      // stands proud of the parapet, and the roof is painted after the walls.
      if (b.sign && b.sign.on && f.id === (b.sign.face || 'N') && f.visible) signSvg = wallSign(cam, f, b, night, wall, detail);
      return s;
    },
  });

  // Roof: membrane inside the coping, then whatever the player put up there.
  const inset = 1.6;
  const rk = corners(box);
  const shrink = rk.map((p) => [
    p[0] + (b.x + b.w / 2 - p[0]) * (inset / Math.max(b.w, b.d)) * 2,
    p[1] + (b.y + b.d / 2 - p[1]) * (inset / Math.max(b.w, b.d)) * 2,
    H + 0.02,
  ]);
  svg += poly(cam, shrink, { fill: night ? '#232830' : '#9aa2ac', stroke: 'none' });
  if (detail) {
    const f = boxFaces(cam, box).find((q) => q.id === 'N');
    for (let t = 8; t < f.len - 4; t += 16) {
      const a = f.at(t, 0);
      const c = corners(box);
      const dir = [c[3][0] - c[0][0], c[3][1] - c[0][1]];
      svg += line(cam, [a[0] + dir[0] * 0.02, a[1] + dir[1] * 0.02, H + 0.03],
        [a[0] + dir[0] * 0.98, a[1] + dir[1] * 0.98, H + 0.03], { stroke: 'rgba(255,255,255,.07)', 'stroke-width': 0.8 });
    }
  }
  return svg + signSvg;
}

/** Roof machines in building-local coordinates, turned with the building. */
export function roofItemWorld(b, item) {
  const spec = ROOF_BY_ID[item.type] || { w: 8, d: 6, h: 3 };
  const a = (b.rot || 0) * Math.PI / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const lx = item.dx - b.w / 2;
  const ly = item.dy - b.d / 2;
  const cx = b.x + b.w / 2 + lx * ca - ly * sa;
  const cy = b.y + b.d / 2 + lx * sa + ly * ca;
  return {
    art: spec.art, h: spec.h, seed: (item.dx * 7 + item.dy * 13) | 0,
    x: cx - spec.w / 2, y: cy - spec.d / 2, w: spec.w, d: spec.d,
    rot: (b.rot || 0) + (item.rot || 0),
  };
}

/* -------------------------------------------------------------- wall signs */

function wallSign(cam, f, b, night, wallColor, detail) {
  const sign = b.sign;
  if (!sign.text && !sign.logo) return '';
  const top = f.height;
  const chars = Math.max(6, (sign.text || '').length);
  // A low building has no wall deep enough to carry a readable name, so the
  // fascia stands up above the parapet — which is what a real strip does.
  const raise = top < 26 ? Math.min(11, 28 - top) : 0;
  const bandH = clamp(Math.max(top, 20) * 0.34, 6.5, 17);
  const y1 = top + raise - (raise ? 0.6 : Math.max(2.8, top * 0.085));
  const y0 = Math.max(1, y1 - bandH);
  const h = y1 - y0;
  const inset = Math.min(3, f.len * 0.04);
  const rows = (sign.logo ? 1.6 : 0) + 0.72 + (sign.sub ? 0.62 : 0) + 0.5;
  const size = clamp(Math.min((f.len - inset * 2) * 0.88 / (0.58 * chars), h / rows), 1.6, 20);
  const ink = night ? mixHex(sign.color, 1.45) : sign.color;
  // The panel is an applied fascia, so it reads against the lettering: light
  // behind dark ink, dark behind light ink.
  const face = lum(ink) > 0.55
    ? mixHex(wallColor, night ? 0.5 : 0.72)
    : mixHex(wallColor, night ? 1.25 : 1.13);

  let s = f.quad(inset - 0.7, f.len - inset + 0.7, y0 - 0.9, y1 + 0.6, { fill: 'rgba(14,22,34,.3)', stroke: 'none' });
  s += f.quad(inset, f.len - inset, y0, y1, { fill: face, stroke: 'rgba(14,22,34,.35)', 'stroke-width': 0.4 });
  if (detail) {
    s += f.quad(inset, f.len - inset, y1 - 0.45, y1, { fill: 'rgba(255,255,255,.34)', stroke: 'none' });
    s += f.quad(inset, f.len - inset, y0, y0 + 0.45, { fill: 'rgba(10,16,26,.22)', stroke: 'none' });
  }
  const stack = rows * size;
  let y = y0 + (h - stack) / 2 + stack;
  if (sign.logo) {
    y -= size * 1.6 * 0.8;
    s += faceText(f, { t: f.len / 2, h: y, text: sign.logo, size: size * 1.6, color: ink, glow: night });
    y -= size * 0.3;
  }
  y -= size * 0.72;
  s += faceText(f, { t: f.len / 2, h: y, text: sign.text || '', size, color: ink, letter: size * 0.06, glow: night, shadow: !night });
  if (sign.sub) {
    y -= size * 0.5;
    s += faceText(f, { t: f.len / 2, h: y, text: sign.sub, size: size * 0.4, color: ink, letter: size * 0.1, weight: 600, glow: night, opacity: 0.92 });
  }
  if (night) s += f.quad(inset, f.len - inset, y0 - 2, y1, { fill: 'url(#wallLamp)', stroke: 'none' });
  return s;
}

/* ------------------------------------------------------ ground and marking */

const angleOf = (u) => (Math.atan2(u[1], u[0]) * 180) / Math.PI;

/** A rectangle standing off a wall: aprons, walkways, anything that belongs to
 *  a run of openings. */
function runRect(f, t0, t1, depth, pad = 0) {
  const a = f.at(t0, 0);
  const b = f.at(t1, 0);
  const ux = (b[0] - a[0]) / Math.max(1e-6, t1 - t0);
  const uy = (b[1] - a[1]) / Math.max(1e-6, t1 - t0);
  const mx = (a[0] + b[0]) / 2 + f.normal[0] * (depth / 2);
  const my = (a[1] + b[1]) / 2 + f.normal[1] * (depth / 2);
  const w = t1 - t0 + pad * 2;
  return { x: mx - w / 2, y: my - depth / 2, w, d: depth, rot: angleOf([ux, uy]) };
}

/** Contiguous runs of a cell type along one wall's ground floor. */
function groundRuns(b, face, types) {
  const g = b.walls[face];
  if (!g || !g[0]) return [];
  const row = g[0];
  const runs = [];
  let start = -1;
  for (let i = 0; i <= row.length; i++) {
    const hit = i < row.length && types.includes(row[i]);
    if (hit && start < 0) start = i;
    if (!hit && start >= 0) { runs.push([start, i]); start = -1; }
  }
  return runs;
}

/** Everything the buildings imply on the ground: aprons, paths, crossings. */
function servicePads(cam, state, pal, ctx) {
  const out = { svg: '', keepClear: [] };
  for (const b of buildingsOf(state)) {
    const box = { x: b.x, y: b.y, w: b.w, d: b.d, rot: b.rot || 0, z0: 0, z1: buildingHeight(b) };
    for (const f of boxFaces(cam, box)) {
      const cols = wallCols(b, f.id);
      const cw = f.len / Math.max(1, cols);
      // Truck apron in front of any run of loading bays.
      for (const [a, z] of groundRuns(b, f.id, ['dock'])) {
        const rect = runRect(f, a * cw, z * cw, 62, 8);
        // Trucks need room to swing, so the court stays clear well past the
        // concrete itself — that is what keeps parking out of the dock apron.
        out.keepClear.push(runRect(f, a * cw, z * cw, 125, 14));
        out.svg += poly(cam, corners(rect).map((p) => [p[0], p[1], 0.01]), {
          fill: pal.concrete, stroke: 'rgba(255,255,255,.14)', 'stroke-width': 0.8,
        });
        if (ctx.detail) {
          for (let t = a * cw; t <= z * cw; t += cw) {
            const s0 = f.at(t, 0);
            out.svg += line(cam, [s0[0] + 0.02, s0[1], 0.02],
              [s0[0] + f.normal[0] * 62, s0[1] + f.normal[1] * 62, 0.02],
              { stroke: 'rgba(255,255,255,.09)', 'stroke-width': 0.8 });
          }
        }
      }
      // Apron for roll-up doors, shallower.
      for (const [a, z] of groundRuns(b, f.id, ['roll'])) {
        const rect = runRect(f, a * cw, z * cw, 26, 4);
        out.keepClear.push(rect);
        out.svg += poly(cam, corners(rect).map((p) => [p[0], p[1], 0.01]), { fill: pal.concrete, stroke: 'none' });
      }
      // A path and a crossing at every entrance.
      for (const [a, z] of groundRuns(b, f.id, ['door'])) {
        const walk = runRect(f, a * cw, z * cw, 13, 5);
        out.keepClear.push(walk);
        out.svg += poly(cam, corners(walk).map((p) => [p[0], p[1], 0.01]), {
          fill: pal.walk, stroke: 'rgba(0,0,0,.18)', 'stroke-width': 0.5,
        });
        if (ctx.detail) {
          const cross = runRect(f, a * cw - 2, z * cw + 2, 8, 0);
          const c = corners({ ...cross, y: cross.y, x: cross.x });
          // Zebra bars across the crossing, walked in the wall's direction.
          const n = 6;
          for (let i = 0; i < n; i++) {
            const t0 = i / n;
            const t1 = (i + 0.55) / n;
            const p = (tt, s) => [
              c[0][0] + (c[1][0] - c[0][0]) * tt + (c[3][0] - c[0][0]) * s,
              c[0][1] + (c[1][1] - c[0][1]) * tt + (c[3][1] - c[0][1]) * s,
              0.02,
            ];
            out.svg += poly(cam, [p(t0, 0.05), p(t1, 0.05), p(t1, 0.95), p(t0, 0.95)], { fill: pal.stripe, stroke: 'none' });
          }
        }
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------- scene */

export function render(state, size, opts = {}) {
  const { fast = false, selected = null, ghost = null, hover = null } = opts;
  const cam = fitCamera(state, size);
  const night = state.view.time === 'night';
  const pal = palette(night);
  const detail = cam.scale > 0.42 && !fast;
  const ctx = { night, detail, pal };
  const { lot } = state;
  const r = rng(1337);

  const items = [];
  const shadows = [];
  const add = (key, svg, fp, h) => svg && items.push({ key, svg, bb: bounds(fp || { x: 0, y: 0, w: 0, d: 0, rot: 0 }), h: h || 0 });
  const castShadow = (fp, z0, z1) => shadows.push({ ...fp, z0, z1 });

  /* --- ground ------------------------------------------------------------ */
  const slab = { x: -46, y: -46, w: lot.width + 92, d: lot.depth + 116, rot: 0, z0: -11, z1: 0 };
  let ground = '';
  if (!fast) {
    ground += `<g filter="url(#slabShadow)"><polygon fill="rgba(8,14,26,${night ? 0.5 : 0.34})" points="${
      corners({ ...slab, x: slab.x + 10, y: slab.y + 16 }).map((q) => cam.project(q[0], q[1], -12).map((n) => n.toFixed(1)).join(',')).join(' ')}"/></g>`;
  }
  ground += drawBox(cam, slab, { color: pal.soil, roof: pal.grass, stroke: 'rgba(12,18,28,.4)' });
  if (!fast && state.site.grass) ground += pad(cam, { x: slab.x, y: slab.y, w: slab.w, d: slab.d, z: 0.01 }, { fill: 'url(#grassTex)', stroke: 'none' });

  // The street.
  if (state.site.road) {
    const roadY = lot.depth + 12;
    const roadD = slab.y + slab.d - roadY;
    ground += pad(cam, { x: slab.x, y: roadY, w: slab.w, d: roadD }, { fill: pal.road });
    if (!fast) ground += pad(cam, { x: slab.x, y: roadY, w: slab.w, d: roadD }, { fill: 'url(#asphTex)', stroke: 'none' });
    if (!fast) {
      for (let x = slab.x + 6; x < slab.x + slab.w - 12; x += 22) {
        ground += pad(cam, { x, y: roadY + roadD / 2 - 0.45, w: 12, d: 0.9 }, { fill: pal.roadLine, stroke: 'none' });
      }
    }
    ground += pad(cam, { x: slab.x, y: lot.depth + 4, w: slab.w, d: 8 }, { fill: pal.walk });
    ground += pad(cam, { x: slab.x, y: roadY - 1, w: slab.w, d: 1 }, { fill: pal.curb, stroke: 'none' });
  }

  // Where the gate is decides where the drive is.
  const gateObj = state.objects.find((o) => o.kind === 'prop' && o.type === 'gate');
  const boothObj = state.objects.find((o) => o.kind === 'booth');
  const driveX = gateObj ? gateObj.x + (PROP_BY_ID.gate.w) / 2
    : boothObj ? boothObj.x + 58 : lot.width * 0.28;
  const gateY = gateObj ? gateObj.y + 1.5 : lot.depth - 70;

  // Pavement wraps the buildings and reaches the street.
  const blds = buildingsOf(state);
  let px0 = lot.width * 0.5 - 120, px1 = lot.width * 0.5 + 120, py0 = 60;
  if (blds.length) {
    px0 = Math.min(...blds.map((b) => bounds(footprint(b)).x0)) - 42;
    px1 = Math.max(...blds.map((b) => bounds(footprint(b)).x1)) + 42;
    py0 = Math.min(...blds.map((b) => bounds(footprint(b)).y0)) - 16;
  }
  px0 = clamp(px0, 10, lot.width - 40);
  px1 = clamp(px1, 40, lot.width - 10);
  py0 = clamp(py0, 10, lot.depth - 60);
  const py1 = lot.depth - 16;
  if (state.site.pavement) {
    ground += pad(cam, { x: px0, y: py0, w: px1 - px0, d: py1 - py0 }, { fill: pal.asphalt, stroke: pal.curb, 'stroke-width': 1.2 });
    if (!fast) ground += pad(cam, { x: px0, y: py0, w: px1 - px0, d: py1 - py0 }, { fill: 'url(#asphTex)', stroke: 'none' });
    ground += pad(cam, { x: driveX - 24, y: py1 - 2, w: 48, d: lot.depth - py1 + 8 }, { fill: pal.asphalt, stroke: pal.curb, 'stroke-width': 1.2 });
  }

  const svc = servicePads(cam, state, pal, ctx);
  ground += svc.svg;

  /* --- parking ----------------------------------------------------------- */
  const stalls = [];
  if (state.site.parking) {
    // Rows run the whole paved yard; anything that clashes with a building, a
    // truck court or the drive simply does not get a bay. That way adding a
    // building in the middle of the lot re-flows the parking around it instead
    // of wiping it out.
    const firstY = blds.length ? Math.min(...blds.map((b) => bounds(footprint(b)).y1)) + 28 : py0 + 20;
    const pitch = STALL.d + 26;
    for (let y = firstY; y + STALL.d < Math.min(py1 - 10, lot.depth - 86); y += pitch) {
      const run = [];
      for (let x = px0 + 8; x + STALL.w < px1 - 8; x += STALL.w) {
        const rect = { x, y, w: STALL.w, d: STALL.d, rot: 0 };
        if (Math.abs(x + STALL.w / 2 - driveX) < 32) continue;
        if (!isClear(state, rect)) continue;
        if (svc.keepClear.some((k) => overlaps(rect, k))) continue;
        if (!fast) {
          ground += pad(cam, { x, y, w: 0.5, d: STALL.d }, { fill: pal.stripe, stroke: 'none' });
          ground += pad(cam, { x: x + STALL.w - 0.5, y, w: 0.5, d: STALL.d }, { fill: pal.stripe, stroke: 'none' });
        }
        stalls.push({ x, y });
        run.push(x);
      }
      if (run.length > 2 && state.site.markings && !fast) {
        for (const ix of [Math.min(...run) - 9, Math.max(...run) + STALL.w + 1]) {
          if (ix < px0 || ix > px1 - 8) continue;
          ground += pad(cam, { x: ix, y: y - 1, w: 8, d: STALL.d + 2 }, { fill: pal.walk, stroke: 'rgba(0,0,0,.2)', 'stroke-width': 0.5 });
          ground += pad(cam, { x: ix + 1, y, w: 6, d: STALL.d }, { fill: pal.grassAlt, stroke: 'none' });
        }
      }
    }
  }

  // Lane markings at the gate.
  if (state.site.markings && detail && gateObj) {
    const arrow = (x, y, dir) => poly(cam, [
      [x - 0.9, y, 0.02], [x + 0.9, y, 0.02], [x + 0.9, y + 4.2 * dir, 0.02], [x + 2.6, y + 4.2 * dir, 0.02],
      [x, y + 7 * dir, 0.02], [x - 2.6, y + 4.2 * dir, 0.02], [x - 0.9, y + 4.2 * dir, 0.02],
    ], { fill: pal.stripe, stroke: 'none', opacity: 0.75 });
    ground += arrow(driveX - 11, gateY + 26, -1);
    ground += arrow(driveX + 11, gateY + 30, 1);
    ground += pad(cam, { x: driveX - 23, y: gateY + 12, w: 22, d: 1.6 }, { fill: pal.stripe, stroke: 'none' });
  }

  /* --- objects ----------------------------------------------------------- */
  for (const o of state.objects) {
    const drawn = drawObject(cam, o, ctx, state.skin, { pickIds: true });
    if (!drawn.svg) continue;
    for (const sh of drawn.shadows) castShadow(sh.fp, sh.z0, sh.z1);
    // Thin things — poles, signs, flags — need a fatter grab area than their
    // own footprint or they are almost impossible to click. While the camera is
    // moving nothing is clickable anyway, so the pads are skipped.
    const grab = o.kind === 'building' ? drawn.fp : {
      ...drawn.fp, x: drawn.fp.x - 3, y: drawn.fp.y - 3, w: drawn.fp.w + 6, d: drawn.fp.d + 6,
    };
    const pad = fast ? '' : hitShape(cam, grab, 0, Math.max(2, drawn.h));
    add(nearKey(cam, drawn.fp),
      `<g data-id="${o.id}" class="pick${selected === o.id ? ' sel' : ''}${hover === o.id ? ' hov' : ''}">${pad}${drawn.svg}</g>`,
      drawn.fp, drawn.h);
  }

  // Parked cars are scenery, not objects — they follow the stalls.
  if (state.site.cars && stalls.length && !fast) {
    const colors = ['#c8ccd2', '#26374f', '#7d2f2f', '#1e2229', '#e9ebee', '#35543f', '#5a6472', '#8d5a24'];
    for (const s of stalls) {
      if (r() > 0.55) continue;
      const fp = { x: s.x + 1.5, y: s.y + 2, w: 6, d: 14, rot: 0 };
      castShadow(fp, 0, 5.5);
      // Scenery, so it must never swallow a click meant for a real object.
      add(nearKey(cam, fp),
        `<g pointer-events="none">${drawProp(cam, { ...fp, h: 5.5, art: 'car', color: colors[Math.floor(r() * colors.length)] }, ctx)}</g>`,
        fp, 5.5);
    }
  }

  depthSort(items, state.view.yaw);

  const shadowLayer = shadows.length && !fast
    ? `<g filter="url(#softShadow)" fill="${pal.shadow}">${shadows.map((b) => shadowOf(cam, b, night ? 0.3 : 1)).join('')}</g>`
    : '';

  /* --- overlays ---------------------------------------------------------- */
  let overlay = '';
  const selObj = selected && state.objects.find((o) => o.id === selected);
  if (selObj) overlay += marker(cam, footprint(selObj), objHeight(selObj), '#8fe3c0');
  if (selected && selected.includes('#')) {
    const [bid, idx] = selected.split('#');
    const b = state.objects.find((o) => o.id === bid);
    if (b) {
      const w = roofItemWorld(b, b.roofItems[+idx] || { dx: 0, dy: 0 });
      overlay += marker(cam, w, w.h, '#8fe3c0', buildingHeight(b));
    }
  }
  if (ghost && ghost.obj) {
    const ok = ghost.ok !== false;
    const drawn = drawObject(cam, ghost.obj, ctx, state.skin, { z: ghost.z || 0 });
    overlay += `<g opacity=".68" style="pointer-events:none">${drawn.svg}</g>`;
    overlay += marker(cam, drawn.fp, drawn.h, ok ? '#8fe3c0' : '#ff6b6b', ghost.z || 0, !ok);
  }

  return {
    svg: ground + shadowLayer + items.map((i) => i.svg).join('') + overlay,
    cam, pal, driveX, gateY, stalls,
  };
}

/**
 * Painter order for boxes standing on the ground.
 *
 * A single depth number per object is not enough: a 380-foot shed has a corner
 * nearer the camera than a trailer parked in front of its other end, which had
 * the shed painting straight over the trailer. So objects that are separated
 * along a world axis are ordered by that separation — which is exact — and only
 * genuinely overlapping ones fall back to height and distance.
 */
export function depthSort(items, yaw) {
  const a = (yaw * Math.PI) / 180;
  const sa = Math.sin(a);
  const ca = Math.cos(a);
  const e = 0.01;
  const cmp = (A, B) => {
    const p = A.bb;
    const q = B.bb;
    if (p.x0 >= q.x1 - e) return sa > 0 ? 1 : -1;
    if (p.x1 <= q.x0 + e) return sa > 0 ? -1 : 1;
    if (p.y0 >= q.y1 - e) return ca > 0 ? 1 : -1;
    if (p.y1 <= q.y0 + e) return ca > 0 ? -1 : 1;
    // They share ground: the taller one has to go on top, or nothing of it shows.
    if (Math.abs(A.h - B.h) > 0.5) return A.h - B.h;
    return A.key - B.key;
  };
  // Insertion sort: the comparator is not a total order, and this keeps the
  // pairwise answers that matter rather than trusting a sort network.
  for (let i = 1; i < items.length; i++) {
    const it = items[i];
    let j = i - 1;
    while (j >= 0 && cmp(items[j], it) > 0) { items[j + 1] = items[j]; j -= 1; }
    items[j + 1] = it;
  }
  return items;
}

/** Draw any one object. Used for the scene and for the placement ghost. */
export function drawObject(cam, o, ctx, skin = {}, opts = {}) {
  const fp = footprint(o);
  const shadows = [];
  let svg = '';
  let h = 8;
  if (o.kind === 'building') {
    h = buildingHeight(o);
    shadows.push({ fp, z0: 0, z1: h });
    svg = drawBuilding(cam, o, ctx);
    for (let i = 0; i < (o.roofItems || []).length; i++) {
      const w = roofItemWorld(o, o.roofItems[i]);
      const machine = drawRoofItem(cam, w, h, { ...ctx, wall: ctx.night ? mixHex(o.wall, 0.44) : o.wall });
      svg += opts.pickIds
        ? `<g data-id="${o.id}#${i}">${hitShape(cam, { ...w, x: w.x - 2, y: w.y - 2, w: w.w + 4, d: w.d + 4 }, h, h + w.h)}${machine}</g>`
        : machine;
    }
  } else if (o.kind === 'booth') {
    const spec = BOOTH_BY_ID[o.design] || BOOTH_BY_ID.classic;
    h = spec.h + 3;
    shadows.push({ fp, z0: 0, z1: h });
    svg = drawBooth(cam, { ...fp, h: spec.h, art: spec.art, sign: o.sign }, { ...ctx, band: skin.band || '#1f3a63' });
  } else if (o.kind === 'roof') {
    // A machine being placed, floating at the roof height it will land on.
    const spec = ROOF_BY_ID[o.type];
    if (spec) {
      h = spec.h;
      svg = drawRoofItem(cam, { ...fp, h, art: spec.art, seed: 3 }, opts.z || 0, ctx);
    }
  } else if (o.kind === 'prop') {
    const spec = PROP_BY_ID[o.type];
    if (spec) {
      h = o.h != null ? o.h : spec.h;
      shadows.push({ fp, z0: spec.art === 'trailer' ? 4.4 : 0, z1: h });
      svg = drawProp(cam, { ...fp, h, art: spec.art, sign: o.sign, color: o.color, seedn: (o.x * 3 + o.y * 7) | 0 }, ctx);
    }
  }
  return { svg, fp, h, shadows };
}

/**
 * A transparent silhouette over an object so it can be clicked anywhere on
 * itself, not only where its own paint happens to land. It goes first inside
 * the object's group, so nearer objects still take the click.
 */
export function hitShape(cam, fp, z0, z1) {
  const pts = [];
  for (const [x, y] of corners(fp)) {
    pts.push(cam.project(x, y, z0));
    pts.push(cam.project(x, y, z1));
  }
  const ring = hull(pts);
  if (ring.length < 3) return '';
  // fill="none" with pointer-events="all" keeps it invisible everywhere —
  // including an exported SVG that has no stylesheet — and still clickable.
  return `<polygon class="hit" fill="none" pointer-events="all" points="${ring.map((q) => q.map((n) => n.toFixed(1)).join(',')).join(' ')}"/>`;
}

/** Selection / placement marker: footprint on the ground and a cage around it. */
function marker(cam, fp, h, color, z0 = 0, bad = false) {
  const c = corners(fp);
  const dash = bad ? ' stroke-dasharray="6 4"' : '';
  let s = `<polygon points="${c.map((p) => cam.project(p[0], p[1], z0).map((n) => n.toFixed(1)).join(',')).join(' ')}" fill="${rgba(color, bad ? 0.16 : 0.14)}" stroke="${color}" stroke-width="2"${dash}/>`;
  if (h > 1.5) {
    s += `<polygon points="${c.map((p) => cam.project(p[0], p[1], z0 + h).map((n) => n.toFixed(1)).join(',')).join(' ')}" fill="none" stroke="${rgba(color, 0.75)}" stroke-width="1.5"${dash}/>`;
    for (const p of c) {
      s += line(cam, [p[0], p[1], z0], [p[0], p[1], z0 + h], { stroke: rgba(color, 0.55), 'stroke-width': 1.2 });
    }
  }
  return s;
}

/* ------------------------------------------------------------------- frame */

export function frame(state, size, inner) {
  const night = state.view.time === 'night';
  const pal = palette(night);
  const horizon = size.h * 0.42;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size.w} ${size.h}" width="100%" height="100%" role="img" aria-label="View of the site">
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
    </pattern>
    <pattern id="grassTex" width="22" height="22" patternUnits="userSpaceOnUse">
      <rect width="22" height="22" fill="rgba(255,255,255,0)"/>
      <circle cx="5" cy="15" r="4.2" fill="rgba(0,0,0,.022)"/>
      <circle cx="16" cy="6" r="3.4" fill="rgba(255,255,255,${night ? 0.012 : 0.026})"/>
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
