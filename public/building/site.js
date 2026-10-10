/* Site logic — what may stand where, and what the ground around the buildings
 * should be. Pure functions over the saved state; the 3D engine and the editor
 * both read from here so they never disagree. */

import { corners, bounds, overlaps, contains, wallFrames, rectOffWall, clamp, DEG } from './geom.js';
import { STALL, PROP_BY_ID, BOOTH_BY_ID, buildingHeight, footprint, objHeight } from './catalog.js';

export { footprint, objHeight, bounds };

export const buildingsOf = (state) => state.objects.filter((o) => o.kind === 'building');

/* Things with enough bulk that two of them in the same place is a glitch, not a
 * design. Scatter — bollards, cones, signs, planting — is left free to touch. */
export const isSolid = (o) => {
  if (o.kind === 'building' || o.kind === 'booth') return true;
  if (o.kind !== 'prop') return false;
  const spec = PROP_BY_ID[o.type];
  return !!(spec && spec.solid);
};

/**
 * Is this footprint free? Nothing solid may share ground with anything else
 * solid. A building is the exception: it goes where it is put, and whatever was
 * standing there gets moved out of its way (see evictFrom).
 */
export function isClear(state, fp, ignoreId, kind = 'prop') {
  if (kind === 'building') return true;
  for (const o of state.objects) {
    if (o.id === ignoreId || !isSolid(o)) continue;
    if (overlaps(fp, footprint(o), -0.5)) return false;
  }
  return true;
}

/** Push anything caught inside a building out to the nearest clear ground. */
export function evictFrom(state, b) {
  const box = footprint(b);
  const cx = box.x + box.w / 2;
  const cy = box.y + box.d / 2;
  let moved = 0;
  for (const o of state.objects) {
    if (o === b || o.kind === 'building' || !isSolid(o)) continue;
    if (!overlaps(footprint(o), box, -0.5)) continue;
    const f = footprint(o);
    let dx = f.x + f.w / 2 - cx;
    let dy = f.y + f.d / 2 - cy;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    for (let step = 5; step <= 400; step += 5) {
      const nx = o.x + dx * step;
      const ny = o.y + dy * step;
      if (isClear(state, { ...f, x: nx, y: ny }, o.id, o.kind)) {
        o.x = nx;
        o.y = ny;
        moved += 1;
        break;
      }
    }
  }
  return moved;
}

/** Contiguous runs of the given cell types along one wall's ground floor. */
export function groundRuns(b, face, types) {
  const row = ((b.walls[face] || [])[0]) || [];
  const runs = [];
  let start = -1;
  for (let i = 0; i <= row.length; i++) {
    const hit = i < row.length && types.includes(row[i]);
    if (hit && start < 0) start = i;
    if (!hit && start >= 0) { runs.push([start, i]); start = -1; }
  }
  return runs;
}

/** Every loading bay and roll-up door on the site, as a point on the wall and its normal. */
export function dockAnchors(state) {
  const out = [];
  for (const b of buildingsOf(state)) {
    const frames = wallFrames(footprint(b));
    for (const [face, f] of Object.entries(frames)) {
      const row = ((b.walls[face] || [])[0]) || [];
      const cw = f.len / Math.max(1, row.length);
      row.forEach((type, col) => {
        if (type !== 'dock' && type !== 'roll') return;
        const t = (col + 0.5) * cw;
        out.push({ x: f.o[0] + f.u[0] * t, y: f.o[1] + f.u[1] * t, nx: f.n[0], ny: f.n[1], type, building: b.id });
      });
    }
  }
  return out;
}

/**
 * Square a vehicle onto the nearest loading bay it has been backed up to.
 * Returns the new placement, or null when it is not near a free bay.
 */
export function snapToDock(state, o, reach = 24) {
  const fp = footprint(o);
  const cx = fp.x + fp.w / 2;
  const cy = fp.y + fp.d / 2;
  let best = null;
  for (const a of dockAnchors(state)) {
    const px = a.x + a.nx * (fp.d / 2 + 1.5);
    const py = a.y + a.ny * (fp.d / 2 + 1.5);
    const dist = Math.hypot(px - cx, py - cy);
    if (dist < reach && (!best || dist < best.dist)) best = { dist, px, py, a };
  }
  if (!best) return null;
  // Back it in: the vehicle's own length axis (+y, its rear) points into the wall.
  const rot = Math.atan2(best.a.nx, -best.a.ny) / DEG;
  const turned = footprint({ ...o, rot });
  const spot = { x: best.px - turned.w / 2, y: best.py - turned.d / 2, rot };
  return isClear(state, footprint({ ...o, ...spot }), o.id, o.kind) ? spot : null;
}

/* --------------------------------------------------------------- the plan */

/**
 * Everything the ground needs to know: where the street, the drive and the
 * paving are; the truck aprons, paths and crossings implied by the openings in
 * each wall; and a parking layout that flows around all of it.
 */
export function planSite(state) {
  const { lot } = state;
  const blds = buildingsOf(state);
  const plan = {
    lot,
    road: { y0: lot.depth + 12, y1: lot.depth + 70, kerb: lot.depth + 11, footway: [lot.depth + 3, lot.depth + 11] },
    aprons: [], rollAprons: [], walks: [], crossings: [], keepClear: [],
    stalls: [], islands: [], wheelStops: [], lamps: [],
  };

  // The gate decides where the drive meets the street.
  const gate = state.objects.find((o) => o.kind === 'prop' && o.type === 'gate');
  const booth = state.objects.find((o) => o.kind === 'booth');
  plan.driveX = gate ? gate.x + (gate.w || PROP_BY_ID.gate.w) / 2 : booth ? booth.x + 58 : lot.width * 0.28;
  plan.gateY = gate ? gate.y + 1.5 : lot.depth - 70;

  // Paving wraps the buildings and reaches the street.
  let x0 = lot.width * 0.5 - 120, x1 = lot.width * 0.5 + 120, y0 = 60;
  if (blds.length) {
    x0 = Math.min(...blds.map((b) => bounds(footprint(b)).x0)) - 42;
    x1 = Math.max(...blds.map((b) => bounds(footprint(b)).x1)) + 42;
    y0 = Math.min(...blds.map((b) => bounds(footprint(b)).y0)) - 16;
  }
  plan.pave = {
    x0: clamp(x0, 10, lot.width - 40),
    x1: clamp(x1, 40, lot.width - 10),
    y0: clamp(y0, 10, lot.depth - 60),
    y1: lot.depth - 16,
  };
  plan.drive = { x0: plan.driveX - 24, x1: plan.driveX + 24, y0: plan.pave.y1 - 2, y1: plan.road.y0 };

  // What the openings in each wall imply on the ground in front of it.
  for (const b of blds) {
    const frames = wallFrames(footprint(b));
    for (const [face, f] of Object.entries(frames)) {
      const cols = ((b.walls[face] || [])[0] || []).length || 1;
      const cw = f.len / cols;
      for (const [a, z] of groundRuns(b, face, ['dock'])) {
        plan.aprons.push({ rect: rectOffWall(f, a * cw, z * cw, 62, 8), face: f, t0: a * cw, t1: z * cw });
        // Trucks need room to swing, so the court stays clear well past the concrete.
        plan.keepClear.push(rectOffWall(f, a * cw, z * cw, 125, 14));
      }
      for (const [a, z] of groundRuns(b, face, ['roll'])) {
        const r = rectOffWall(f, a * cw, z * cw, 26, 4);
        plan.rollAprons.push({ rect: r });
        plan.keepClear.push(r);
      }
      for (const [a, z] of groundRuns(b, face, ['door'])) {
        const walk = rectOffWall(f, a * cw, z * cw, 13, 5);
        plan.walks.push({ rect: walk });
        plan.keepClear.push(walk);
        plan.crossings.push({ rect: rectOffWall(f, a * cw - 2, z * cw + 2, 8, 0), at: rectOffWall(f, a * cw, z * cw, 21, 2) });
      }
    }
  }

  // Parking: rows across the whole yard; anything that clashes with a
  // building, a truck court, a path or the drive just does not get a bay.
  if (state.site.parking) {
    const firstY = blds.length ? Math.min(...blds.map((b) => bounds(footprint(b)).y1)) + 28 : plan.pave.y0 + 20;
    const pitch = STALL.d + 26;
    const doors = plan.walks.map((w) => [w.rect.x + w.rect.w / 2, w.rect.y + w.rect.d / 2]);
    // Bays stay off anything set down on the ground — ponds, planting, poles,
    // signs, bins — though a parked vehicle may of course sit in one.
    const obstacles = state.objects
      .filter((o) => o.kind === 'prop' && !(PROP_BY_ID[o.type] || {}).vehicle && (PROP_BY_ID[o.type] || {}).cat !== 'People')
      .map(footprint);
    for (let y = firstY, row = 0; y + STALL.d < Math.min(plan.pave.y1 - 10, lot.depth - 86); y += pitch, row++) {
      const run = [];
      for (let x = plan.pave.x0 + 8; x + STALL.w < plan.pave.x1 - 8; x += STALL.w) {
        const rect = { x, y, w: STALL.w, d: STALL.d, rot: 0 };
        if (Math.abs(x + STALL.w / 2 - plan.driveX) < 32) continue;
        if (!isClear(state, rect)) continue;
        if (plan.keepClear.some((k) => overlaps(rect, k))) continue;
        if (obstacles.some((f) => overlaps(rect, f, -0.5))) continue;
        // Accessible bays go nearest the doors.
        const ada = doors.some(([dx, dy]) => Math.hypot(dx - (x + STALL.w / 2), dy - (y + STALL.d / 2)) < 46);
        plan.stalls.push({ x, y, w: STALL.w, d: STALL.d, row, ada });
        plan.wheelStops.push({ x: x + 1.5, y: y + 1.2, w: STALL.w - 3, d: 0.8 });
        run.push(x);
      }
      if (run.length > 2) {
        for (const ix of [Math.min(...run) - 9, Math.max(...run) + STALL.w + 1]) {
          if (ix < plan.pave.x0 || ix > plan.pave.x1 - 8) continue;
          const island = { x: ix, y: y - 1, w: 8, d: STALL.d + 2 };
          if (blds.some((b) => overlaps(island, footprint(b)))) continue;
          plan.islands.push(island);
        }
      }
    }
  }
  return plan;
}

/** Floor area, footprints and counts — the numbers a site plan is judged by. */
export function siteStats(state, plan = planSite(state)) {
  const blds = buildingsOf(state);
  const footprintArea = blds.reduce((s, b) => s + b.w * b.d, 0);
  const floorArea = blds.reduce((s, b) => s + b.w * b.d * Math.max(1, b.floors), 0);
  const lotArea = state.lot.width * state.lot.depth;
  let docks = 0, doors = 0, windows = 0;
  for (const b of blds) {
    for (const g of Object.values(b.walls || {})) {
      for (const row of g) for (const c of row) {
        if (c === 'dock') docks++;
        else if (c === 'door') doors++;
        else if (c === 'window' || c === 'ribbon' || c === 'glass') windows++;
      }
    }
  }
  return {
    buildings: blds.length,
    footprintArea,
    floorArea,
    lotArea,
    coverage: lotArea ? footprintArea / lotArea : 0,
    stalls: plan.stalls.length,
    adaStalls: plan.stalls.filter((s) => s.ada).length,
    docks, doors, windows,
    props: state.objects.filter((o) => o.kind === 'prop').length,
    booths: state.objects.filter((o) => o.kind === 'booth').length,
    roofItems: blds.reduce((s, b) => s + (b.roofItems || []).length, 0),
    trees: state.objects.filter((o) => o.kind === 'prop' && /tree|conifer|palm|birch|maple|pine/.test(o.type)).length,
  };
}
