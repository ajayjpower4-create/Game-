// Construction rules: socket index, snapping solver and placement validation.
// Placement previews use solve(); every placement and crane landing re-runs
// validate(), so the player always gets the same specific reason for a
// failure. Ported from the Roblox BuildRules (stud constants now metres).

import { V3, CF, v, VY, VZ, angleBetween, yawOf, round, clamp, rad } from "../core/math.js";
import { Config } from "../core/config.js";
import { $fmt } from "../core/lua.js";
import { Registry } from "../data/items.js";

const TOL = Config.Geo.SnapTolerance;
const CELL = 2;
const UP = VY;

export const SocketNames = {
  FootingTop: "a footing top",
  ColumnTop: "the top of a column",
  BeamSeat: "a beam seat on a column face",
  GussetMount: "a gusset mount on a column face",
  BraceSeat: "a gusset plate seat",
  CladSeat: "the outside face line of two columns",
  ScafNode: "a scaffold base jack",
  ScafStdTop: "the top of a scaffold upright",
  ScafRosette: "a rosette on a scaffold upright",
  ParapetSeat: "the roof edge line of two columns",
  PartitionSeat: "a column on the finished floor",
};

export const SupportStates = { Placed: true, Installed: true };
export const SolidStates = { Placed: true, Installed: true, Loose: true, Restrained: true };

function friendlyAccepts(acceptSet) {
  return Object.keys(acceptSet || {}).map((t) => SocketNames[t] || t).sort().join(" or ");
}

// ---------------------------------------------------------------------------
// Socket index over a World (see sim/world.js)
// ---------------------------------------------------------------------------

const cellKey = (x, y, z) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`;

export function buildIndex(world) {
  const idx = { cells: new Map(), list: [] };
  const recs = world.records();
  for (const r of recs) {
    if (!SupportStates[r.state]) continue;
    for (const s of r.def.sockets) {
      const wcf = r.cf.mul(s.cf);
      const p = wcf.pos;
      const sock = { type: s.type, cf: wcf, pos: p, owner: r.id, ownerName: r.def.name, multi: s.multi, provisional: r.state !== "Installed", occupiedBy: null };
      const k = cellKey(p.x, p.y, p.z);
      if (!idx.cells.has(k)) idx.cells.set(k, []);
      idx.cells.get(k).push(sock);
      idx.list.push(sock);
    }
  }
  world._index = idx;
  // occupancy from the plugs of placed/installed components
  for (const r of recs) {
    if (!SupportStates[r.state]) continue;
    for (const plug of r.def.plugs) {
      const wp = r.cf.mul(plug.cf).pos;
      for (const s of query(world, wp, TOL * 2)) {
        if (!s.multi && plug.acceptSet[s.type] && s.owner !== r.id) s.occupiedBy = r.id;
      }
    }
  }
  return idx;
}

export function index(world) {
  if (world.dirty || !world._index) {
    buildIndex(world);
    world.dirty = false;
  }
  return world._index;
}

export function query(world, pos, radius) {
  const idx = world._index || index(world);
  const out = [];
  const r = Math.ceil(radius / CELL);
  const cx = Math.floor(pos.x / CELL), cy = Math.floor(pos.y / CELL), cz = Math.floor(pos.z / CELL);
  for (let x = cx - r; x <= cx + r; x++) {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let z = cz - r; z <= cz + r; z++) {
        const list = idx.cells.get(`${x},${y},${z}`);
        if (!list) continue;
        for (const s of list) if (s.pos.dist(pos) <= radius) out.push(s);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Orientation helpers
// ---------------------------------------------------------------------------

function frameFrom(dir) {
  const f1 = dir.unit();
  let f3 = f1.cross(UP);
  if (f3.len < 1e-4) f3 = VZ;
  f3 = f3.unit();
  const f2 = f3.cross(f1);
  return CF.fromMatrix(v(), f1, f2, f3);
}

// Frame placing local plug points pA,pB onto world points a,b.
export function spanCf(pA, pB, a, b) {
  const R = frameFrom(b.sub(a)).mul(frameFrom(pB.sub(pA)).inverse());
  return CF.from(a).mul(R).mul(CF.from(pA.neg()));
}

function sCf(sock, angle, plug) {
  return sock.cf.mul(CF.angles(0, angle, 0)).mul(plug.cf.inverse());
}

export function angleDiff(def, a, b) {
  let d = angleBetween(a, b);
  if (def.symmetric180) d = Math.min(d, angleBetween(a, b.mul(CF.angles(0, Math.PI, 0))));
  return d;
}

const ok = (info) => ({ ok: true, reason: null, info });
const fail = (reason, info) => ({ ok: false, reason, info });

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

// opts: { exclude: [ids], excludeIds: Set, actorPos, reach, ignoreOverlap }
// returns { ok, reason, info: { mates: [ids], supports: [ids] } }
export function validate(world, def, cf, opts = {}) {
  const info = { mates: [], supports: [] };
  const excl = new Set(opts.exclude || []);
  const exIds = new Set(opts.excludeIds || []);

  if (def.kind === "Tool") return fail("Tools are equipped from the hotbar, not placed.", info);

  if (opts.actorPos && opts.reach) {
    const dist = cf.pos.dist(opts.actorPos);
    if (dist > opts.reach) return fail($fmt("Out of reach (%.1f m) — move closer.", dist), info);
  }

  const b = world.bounds();
  if (b) {
    const p = cf.pos;
    if (p.x < b.min.x || p.z < b.min.z || p.x > b.max.x || p.z > b.max.z) return fail("Outside the site boundary.", info);
  }

  index(world);

  const matchSocket = (plug, wcf) => {
    const wp = wcf.pos;
    let best = null, bestD = Infinity, wrong = null;
    for (const s of query(world, wp, 0.84)) {
      const d = s.pos.dist(wp);
      if (plug.acceptSet[s.type]) {
        if (d <= TOL && d < bestD) {
          best = s;
          bestD = d;
        }
      } else if (d <= 0.34 && !excl.has(s.owner)) {
        wrong = s;
      }
    }
    if (!best) {
      if (wrong) return [null, $fmt("Wrong connection type: this needs %s, not %s.", friendlyAccepts(plug.acceptSet), SocketNames[wrong.type] || wrong.type)];
      return [null, $fmt("Missing support: needs %s here.", friendlyAccepts(plug.acceptSet))];
    }
    if (best.occupiedBy && !excl.has(best.occupiedBy)) return [null, "That connection is already used by another component."];
    if (best.provisional) return [null, $fmt("Supporting %s isn't fastened yet — finish its connections first.", best.ownerName)];
    return [best];
  };

  const ray = (o, d) => world.raycast(o, d, exIds);

  if (def.kind === "Point") {
    const plug = def.plugs[0];
    const wcf = cf.mul(plug.cf);
    const [s, why] = matchSocket(plug, wcf);
    if (!s) return fail(why, info);
    if (wcf.yVec.dot(s.cf.yVec) < 0.995) return fail("Not plumb with its connection — rotate it upright.", info);
    if (def.rotStep >= 360 && wcf.look.dot(s.cf.look) < 0.99) return fail("Not aligned with its connection face.", info);
    info.mates.push(s.owner);
  } else if (def.kind === "Span") {
    const used = new Set();
    const matched = [];
    for (let i = 0; i < def.plugs.length; i++) {
      const plug = def.plugs[i];
      const wcf = cf.mul(plug.cf);
      const [s, why] = matchSocket(plug, wcf);
      if (!s) return fail((i === 0 ? "First end: " : "Second end: ") + why, info);
      if (used.has(s)) return fail("Both ends land on the same connection.", info);
      used.add(s);
      matched[i] = s;
      if (def.faceNormal) {
        const front = cf.vecToWorld(VZ);
        if (front.dot(s.cf.look) < 0.95) return fail("Panel faces the wrong way — it must hang on the outside face of the columns.", info);
      }
      info.mates.push(s.owner);
    }
    const expected = spanCf(def.plugs[0].cf.pos, def.plugs[1].cf.pos, matched[0].pos, matched[1].pos);
    if (angleBetween(expected, cf) > 0.05) return fail("Twisted out of line with its connections.", info);
    for (const req of def.requireSockets || []) {
      const wp = cf.mul(req.cf).pos;
      const s = query(world, wp, TOL * 2).find((s) => s.type === req.type);
      if (!s) return fail("Missing support: needs an upright with a rosette at every corner of the bay.", info);
      info.mates.push(s.owner);
    }
  } else if (def.kind === "Surface") {
    if (cf.yVec.y < 0.999) return fail("Floor sheets must lie level.", info);
    const half = def.size.x / 2 - 0.03;
    for (const [i, sx] of [-1, 1].entries()) {
      const origin = cf.point(v(sx * half, 0.2, 0));
      const hit = ray(origin, v(0, -0.533, 0));
      const rec = hit && world.record(hit);
      const okTag = rec && Object.keys(def.surface.supportTags).some((t) => rec.def.tags[t]);
      const endName = i === 0 ? "one end" : "the other end";
      if (!rec || !okTag) return fail($fmt("Missing support at %s: it must bear on a beam %.1f m from the first.", endName, def.sizeM.x), info);
      if (Math.abs(hit.pos.y - cf.y) > 0.04) return fail("Not bearing on the beam flange — lower it onto the steel.", info);
      if (rec.state !== "Installed") return fail($fmt("Supporting %s isn't fastened yet.", rec.def.name), info);
      info.supports.push(rec.id);
    }
  } else if (def.kind === "Slab") {
    if (cf.yVec.y < 0.999) return fail("Slabs are poured level.", info);
    const hx = def.size.x / 2 - 0.3, hz = def.size.z / 2 - 0.3;
    const seen = new Set();
    for (let i = 0; i <= 3; i++) {
      for (let j = 0; j <= 3; j++) {
        const o = cf.point(v(-hx + (2 * hx * i) / 3, 0.2, -hz + (2 * hz * j) / 3));
        const hit = ray(o, v(0, -0.5, 0));
        const r = hit && world.record(hit);
        if (r && r.def.tags.Slab) return fail("This bay has already been poured.", info);
        if (!r || !r.def.tags.Deck || r.def.tags.Roof) return fail("Missing deck under the pour — lay every sheet in this bay first.", info);
        if (r.state !== "Installed") return fail("Weld all the deck sheets in this bay before pouring.", info);
        if (Math.abs(hit.pos.y - cf.y) > 0.05) return fail("Pour level doesn't match the deck.", info);
        if (!seen.has(r.id)) {
          seen.add(r.id);
          info.supports.push(r.id);
        }
      }
    }
  } else if (def.kind === "Rest") {
    if (cf.yVec.y < 0.999) return fail("It has to stand upright.", info);
    const center = cf.pos;
    const hit = ray(center.add(v(0, 0.2, 0)), v(0, -0.467, 0));
    if (!hit) return fail("Missing support: nothing solid underneath.", info);
    if (Math.abs(hit.pos.y - center.y) > 0.05) return fail("Not resting on the surface.", info);
    if (hit.normal.y < 0.94) return fail("Ground is too steep here.", info);
    const rec = world.record(hit);
    if (def.rest && def.rest.terrainOnly && !hit.terrain) return fail("Footings must be set on prepared ground, not on other materials.", info);
    if (rec) {
      if (rec.state !== "Installed") return fail("Can only be set down on installed structure or the ground.", info);
      info.supports.push(rec.id);
    }
    const hx = (def.size.x / 2) * 0.85, hz = (def.size.z / 2) * 0.85;
    let misses = 0;
    for (const [cx, cz] of [[hx, hz], [-hx, hz], [hx, -hz], [-hx, -hz]]) {
      const h = ray(cf.point(v(cx, 0.2, cz)), v(0, -0.467, 0));
      if (!h || Math.abs(h.pos.y - center.y) > 0.133) misses++;
    }
    if (misses >= 2) return fail("Missing support: it would overhang an edge.", info);
  }

  if (!opts.ignoreOverlap) {
    for (const id of info.mates) excl.add(id);
    for (const id of info.supports) excl.add(id);
    let size = def.size.sub(v(0.047, 0.047, 0.047));
    size = v(Math.max(size.x, 0.017), Math.max(size.y, 0.017), Math.max(size.z, 0.017));
    const boxCf = cf.mul(CF.from(def.boundsOffset));
    for (const hit of world.overlap(boxCf, size, exIds)) {
      if (hit.fastener) continue;
      const rec = hit.comp;
      if (rec) {
        let ignore = excl.has(rec.id) || !SolidStates[rec.state];
        if (!ignore) for (const tag in def.overlapIgnore) if (rec.def.tags[tag]) ignore = true;
        if (!ignore) return fail("Overlaps " + rec.def.name + ".", info);
      } else if (hit.env) {
        return fail("Overlaps site equipment (" + hit.env + ").", info);
      }
    }
  }
  return ok(info);
}

// ---------------------------------------------------------------------------
// Solver: snapped frame for an item from an aim
// ---------------------------------------------------------------------------

// aim: { point: V3, hit: rayHit?, normal }
// opts: { rot, free, nudge: V3, current: CF (crane landing), excludeIds: Set }
// returns { cf } or { cf: null, hint }
export function solve(world, def, aim, opts = {}) {
  index(world);
  const exIds = opts.excludeIds;
  const ray = (o, d) => world.raycast(o, d, exIds);
  const kind = def.kind;
  if (kind === "Point") {
    const plug = def.plugs[0];
    let ref = aim.point;
    if (opts.current) ref = opts.current.mul(plug.cf).pos;
    let best = null, bestD = 1.167, wrong = null;
    for (const s of query(world, ref, 1.167)) {
      const d = s.pos.dist(ref);
      if (plug.acceptSet[s.type]) {
        if (!s.occupiedBy && d < bestD) {
          best = s;
          bestD = d;
        }
      } else if (!wrong) wrong = s;
    }
    if (!best) {
      if (wrong) return { cf: null, hint: $fmt("Wrong connection type: needs %s.", friendlyAccepts(plug.acceptSet)) };
      return { cf: null, hint: $fmt("Aim at %s.", friendlyAccepts(plug.acceptSet)) };
    }
    const step = rad(def.rotStep >= 360 ? 0 : def.rotStep);
    let k = opts.rot || 0;
    if (opts.current && step > 0) {
      let bestA = Infinity, bestK = 0;
      for (let kk = 0; kk < Math.floor((2 * Math.PI) / step + 0.5); kk++) {
        const a = angleBetween(sCf(best, step * kk, plug), opts.current);
        if (a < bestA) {
          bestA = a;
          bestK = kk;
        }
      }
      k = bestK;
    }
    return { cf: best.cf.mul(CF.angles(0, step * k, 0)).mul(plug.cf.inverse()) };
  } else if (kind === "Span") {
    const pA = def.plugs[0].cf.pos, pB = def.plugs[1].cf.pos;
    const L = pB.dist(pA);
    let ref = aim.point;
    if (opts.current) ref = opts.current.point(pA.add(pB).mul(0.5));
    const cands = query(world, ref, L / 2 + 1.333).filter((s) => def.plugs[0].acceptSet[s.type] && (s.multi || !s.occupiedBy));
    let best = null, bestScore = Infinity, sawPairDist = null;
    for (let i = 0; i < cands.length; i++) {
      for (let j = 0; j < cands.length; j++) {
        if (i === j) continue;
        const a = cands[i], b = cands[j];
        const w = b.pos.sub(a.pos);
        const dist = w.len;
        if (dist > 0.167 && Math.abs(dist - L) <= TOL * 1.5) {
          const inclination = Math.asin(clamp(w.y / dist, -1, 1));
          const okPitch = Math.abs(Math.abs(inclination) - (def.pitch || 0)) < rad(3);
          if (!okPitch) continue;
          const cf = spanCf(pA, pB, a.pos, b.pos);
          let good = true;
          if (def.faceNormal) {
            const front = cf.vecToWorld(VZ);
            good = front.dot(a.cf.look) > 0.95 && front.dot(b.cf.look) > 0.95;
          }
          if (good && def.requireSockets) {
            for (const req of def.requireSockets) {
              const wp = cf.mul(req.cf).pos;
              if (!query(world, wp, TOL * 2).some((s) => s.type === req.type)) {
                good = false;
                break;
              }
            }
          }
          if (good) {
            let score = a.pos.add(b.pos).mul(0.5).dist(ref);
            if (opts.current) score += angleDiff(def, cf, opts.current) * 2.667;
            if (score < bestScore) {
              best = cf;
              bestScore = score;
            }
          }
        } else if (dist > 0.167 && Math.abs(w.y) < 0.067) {
          if (sawPairDist === null || Math.abs(dist - L) < Math.abs(sawPairDist - L)) sawPairDist = dist;
        }
      }
    }
    if (!best) {
      if (cands.length === 0) return { cf: null, hint: $fmt("Aim between two connections: needs %s at both ends.", friendlyAccepts(def.plugs[0].acceptSet)) };
      if (sawPairDist !== null) return { cf: null, hint: $fmt("Missing support: needs two seats %.2f m apart (nearest pair is %.2f m).", L, sawPairDist) };
      return { cf: null, hint: $fmt("Missing support: no second seat %.2f m away.", L) };
    }
    return { cf: best };
  } else if (kind === "Surface") {
    let rec = null, anchorPoint = null;
    if (opts.current) {
      const half = def.size.x / 2 - 0.03;
      for (const sx of [-1, 1]) {
        const o = opts.current.point(v(sx * half, 0.167, 0));
        const hit = ray(o, v(0, -2.667, 0));
        const r = hit && world.record(hit);
        if (r && r.def.tags.Beam) {
          rec = r;
          anchorPoint = o;
          break;
        }
      }
    } else {
      rec = aim.hit && world.record(aim.hit);
      anchorPoint = aim.point;
    }
    if (!rec || !rec.def.tags.Beam) return { cf: null, hint: "Aim at the top flange of an installed beam." };
    const beamCf = rec.cf;
    let ax = beamCf.xVec;
    ax = v(ax.x, 0, ax.z);
    if (ax.len < 0.5) return { cf: null, hint: "That beam is not level." };
    ax = ax.unit();
    const d = rec.def.sizeM.y;
    const top = beamCf.pos.add(v(0, d / 2, 0));
    let s = ax.cross(UP).unit();
    if (anchorPoint.sub(top).dot(s) < 0) s = s.neg();
    const seat = Config.Geo.SeatOffset;
    const fullLen = rec.def.size.x + 2 * seat;
    const t0 = top.sub(ax.mul(fullLen / 2));
    const W = def.surface.tile;
    const tAim = anchorPoint.sub(t0).dot(ax);
    let t = (Math.floor(tAim / W) + 0.5) * W;
    t = clamp(t, W / 2, fullLen - W / 2);
    const L = def.size.x;
    let pos = t0.add(ax.mul(t)).add(s.mul(L / 2));
    pos = v(pos.x, top.y, pos.z);
    return { cf: CF.fromMatrix(pos, s, UP, s.cross(UP)) };
  } else if (kind === "Rest") {
    let p = aim.point;
    if (opts.current) {
      const hit = ray(opts.current.pos.add(v(0, 0.333, 0)), v(0, -26.7, 0));
      if (!hit) return { cf: null, hint: "No ground below the load." };
      p = hit.pos;
    }
    let yaw;
    if (opts.current) {
      yaw = yawOf(opts.current);
      if (!def.allowFree) yaw = round(yaw, rad(90));
    } else {
      let step = opts.free ? Config.Grid.FreeRotateStep : 90;
      if (def.rotStep >= 360) step = 0;
      yaw = rad(step * (opts.rot || 0));
    }
    let snapped = false;
    if (def.rest && def.rest.lattice && !opts.free) {
      let bestNode = null, bestD = 10;
      for (const s of query(world, p, 10)) {
        if (s.type === "ScafNode" && Math.abs(s.pos.y - Config.Geo.ScaffoldJack - p.y) < 0.667) {
          const dd = Math.hypot(s.pos.x - p.x, s.pos.z - p.z);
          if (dd < bestD) {
            bestNode = s;
            bestD = dd;
          }
        }
      }
      if (bestNode) {
        const snapAxis = (val) => {
          let best = 0, bestErr = Infinity;
          for (const L of Config.Geo.ScaffoldBays) {
            const cand = round(val, L);
            const err = Math.abs(cand - val);
            if (err < bestErr) {
              best = cand;
              bestErr = err;
            }
          }
          return best;
        };
        p = v(bestNode.pos.x + snapAxis(p.x - bestNode.pos.x), p.y, bestNode.pos.z + snapAxis(p.z - bestNode.pos.z));
        snapped = true;
      }
    }
    if (!snapped && !opts.free) {
      const g = (def.rest && def.rest.grid) || Config.Grid.Ground;
      p = v(round(p.x, g), p.y, round(p.z, g));
    }
    if (opts.nudge) p = p.add(v(opts.nudge.x, 0, opts.nudge.z));
    const hit = ray(p.add(v(0, 1, 0)), v(0, -2.667, 0));
    if (hit) p = v(p.x, hit.pos.y, p.z);
    return { cf: CF.from(p).mul(CF.angles(0, yaw, 0)) };
  }
  return { cf: null, hint: "This item can't be placed." };
}

// Slab pour for the bay containing the aimed deck sheet.
// returns { def, cf } or { reason }
export function solveSlab(world, aim) {
  index(world);
  const rec = aim.hit && world.record(aim.hit);
  if (!rec || !rec.def.tags.Deck || rec.def.tags.Roof) {
    if (rec && rec.def.tags.Slab) return { reason: "Already poured." };
    return { reason: "Aim at the metal deck of a floor bay." };
  }
  const deckCf = rec.cf;
  const s = v(deckCf.xVec.x, 0, deckCf.xVec.z).unit();
  const probe = deckCf.point(v(rec.def.size.x / 2 - 0.03, 0.2, 0));
  const hit = world.raycast(probe, v(0, -0.533, 0), new Set([rec.id]));
  const beam = hit && world.record(hit);
  if (!beam || !beam.def.tags.Beam) return { reason: "That deck sheet isn't bearing on a beam." };
  const ax = v(beam.cf.xVec.x, 0, beam.cf.xVec.z).unit();
  const bayZ = beam.def.bayM;
  const bayX = rec.def.sizeM.x;
  const id = "SL-CIP-" + Math.floor(bayX * 1000 + 0.5) + "-" + Math.floor(bayZ * 1000 + 0.5);
  const def = Registry.get(id);
  if (!def) return { reason: "No slab size for this bay." };
  const centre = beam.cf.pos;
  const p = deckCf.pos.add(ax.mul(centre.sub(deckCf.pos).dot(ax)));
  const top = deckCf.y + Config.Geo.DeckDepth;
  return { def, cf: CF.fromMatrix(v(p.x, top, p.z), s, UP, s.cross(UP)) };
}

// Ids of components an item at `cf` connects to or bears on (any state).
export function supportsOf(world, def, cf, selfId) {
  index(world);
  const ids = [];
  const seen = new Set();
  const add = (id) => {
    if (id && id !== selfId && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  };
  for (const plug of def.plugs) {
    const wp = cf.mul(plug.cf).pos;
    const s = query(world, wp, TOL * 2).find((s) => plug.acceptSet[s.type]);
    if (s) add(s.owner);
  }
  const ex = new Set(selfId ? [selfId] : []);
  if (def.kind === "Surface") {
    const half = def.size.x / 2 - 0.03;
    for (const sx of [-1, 1]) {
      const hit = world.raycast(cf.point(v(sx * half, 0.2, 0)), v(0, -0.533, 0), ex);
      const rec = hit && world.record(hit);
      if (rec) add(rec.id);
    }
  } else if (def.kind === "Slab") {
    const hx = def.size.x / 2 - 0.3, hz = def.size.z / 2 - 0.3;
    for (let i = 0; i <= 3; i++) {
      for (let j = 0; j <= 3; j++) {
        const hit = world.raycast(cf.point(v(-hx + (2 * hx * i) / 3, 0.2, -hz + (2 * hz * j) / 3)), v(0, -0.5, 0), ex);
        const rec = hit && world.record(hit);
        if (rec && rec.def.tags.Deck) add(rec.id);
      }
    }
  } else if (def.kind === "Rest") {
    const hit = world.raycast(cf.pos.add(v(0, 0.2, 0)), v(0, -0.467, 0), ex);
    const rec = hit && world.record(hit);
    if (rec) add(rec.id);
  }
  return ids;
}

// Components resting on / connected to `id` (blocking dismantle).
export function dependents(world, id) {
  return world.records().filter((r) => SupportStates[r.state] && (r.supportedBy || []).includes(id));
}
