// Pre-erected ring-lock scaffold for new sites: a run along the street-side
// (-Z) face of the building with base jacks, uprights, ledgers, transoms,
// steel platform decks on every lift, inner and outer guardrails and access
// ladders. Built
// from the same catalog pieces the player uses, so it can be extended or
// dismantled like anything else.

import { CF, v, VY } from "../core/math.js";
import { Config } from "../core/config.js";
import { Registry } from "../data/items.js";
import { spanCf } from "./buildRules.js";

const G = Config.Geo;
const BAY = G.ScaffoldBayLong; // 2.57 m along the face
const WIDTH = G.ScaffoldBayShort; // 1.09 m deep
const LIFT = G.ScaffoldLift; // 2.0 m
const JACK = G.ScaffoldJack; // node height above the ground
const OFFSET = 1.25; // inner line distance from the column grid (clears footings and cladding)

function span(id, a, b) {
  const def = Registry.get(id);
  return { item: id, cf: spanCf(def.plugs[0].cf.pos, def.plugs[1].cf.pos, a, b) };
}

// start: first standard position (y = 0); along / out: unit vectors
// returns [{ item, cf }]
export function scaffoldRun(start, along, out, bays, lifts) {
  const list = [];
  const localZ = along.cross(VY); // deck local +Z for a proper frame
  const yaw = Math.atan2(-along.z, along.x); // ladder rails along the face
  const lineInner = (k) => start.add(along.mul(k * BAY));
  const lineOuter = (k) => lineInner(k).add(out.mul(WIDTH));
  const at = (p, y) => v(p.x, y, p.z);
  for (let k = 0; k <= bays; k++) {
    for (const base of [lineInner(k), lineOuter(k)]) {
      list.push({ item: "SC-BASEJACK", cf: CF.at(base.x, 0, base.z) });
      for (let l = 0; l < lifts; l++) list.push({ item: "SC-STD-2000", cf: CF.at(base.x, JACK + l * LIFT, base.z) });
      list.push({ item: "SC-STD-1000", cf: CF.at(base.x, JACK + lifts * LIFT, base.z) });
    }
    // base transom near the ground
    list.push(span("SC-LEDGER-1090", at(lineInner(k), JACK + 0.5), at(lineOuter(k), JACK + 0.5)));
  }
  for (let k = 0; k < bays; k++) {
    // base ledgers
    for (const line of [lineInner, lineOuter]) list.push(span("SC-LEDGER-2570", at(line(k), JACK + 0.5), at(line(k + 1), JACK + 0.5)));
  }
  for (let l = 1; l <= lifts; l++) {
    const y = JACK + l * LIFT;
    for (let k = 0; k <= bays; k++) list.push(span("SC-LEDGER-1090", at(lineInner(k), y), at(lineOuter(k), y)));
    for (let k = 0; k < bays; k++) {
      for (const line of [lineInner, lineOuter]) list.push(span("SC-LEDGER-2570", at(line(k), y), at(line(k + 1), y)));
      // platform: corner A on the -localZ side, B on the +localZ side
      const innerIsMinus = out.dot(localZ) > 0;
      const A = innerIsMinus ? at(lineInner(k), y) : at(lineOuter(k), y);
      const B = innerIsMinus ? at(lineOuter(k + 1), y) : at(lineInner(k + 1), y);
      list.push(span("SC-DECK-2570", A, B));
      // guardrails on the outside (bay 0 is left open for the ladder)
      if (k > 0) for (const dy of [0.5, 1.0]) list.push(span("SC-LEDGER-2570", at(lineOuter(k), y + dy), at(lineOuter(k + 1), y + dy)));
      // inner guardrails: the platform stands off the building to clear the footings
      for (const dy of [0.5, 1.0]) list.push(span("SC-LEDGER-2570", at(lineInner(k), y + dy), at(lineInner(k + 1), y + dy)));
    }
    // end guardrails
    for (const k of [0, bays]) for (const dy of [0.5, 1.0]) list.push(span("SC-LEDGER-1090", at(lineInner(k), y + dy), at(lineOuter(k), y + dy)));
  }
  // ladders up the outside of bay 0, one per lift
  const lc = lineOuter(0).add(along.mul(BAY / 2)).add(out.mul(0.12));
  for (let l = 0; l < lifts; l++) {
    const y = l === 0 ? 0 : JACK + l * LIFT + 0.08;
    list.push({ item: "SC-LADDER-27", cf: CF.at(lc.x, y, lc.z).mul(CF.angles(0, yaw, 0)) });
  }
  return list;
}

// The scaffold for a site: along the -Z face of the building grid (or the
// first blueprint on Empty Land), as high as the standing frame.
export function siteScaffold(site, stage) {
  let grid = site.grid;
  let lifts;
  if (!grid) {
    grid = site.blueprints && site.blueprints[0] && site.blueprints[0].grid;
    if (!grid) return [];
    lifts = 2;
  } else {
    let topLevel = 1;
    for (const e of stage) if (e.phase === "column") topLevel = Math.max(topLevel, e.level);
    lifts = Math.max(2, Math.min(5, Math.floor((G.FootingTop + topLevel * grid.floorH) / LIFT)));
  }
  const length = grid.nx * grid.bayX;
  const bays = Math.max(1, Math.floor(length / BAY));
  const startX = grid.originM.x + (length - bays * BAY) / 2;
  const start = v(startX, 0, grid.originM.z - OFFSET);
  return scaffoldRun(start, v(1, 0, 0), v(0, 0, -1), bays, lifts);
}
