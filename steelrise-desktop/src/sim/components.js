// Every physical material/component on site and its state machine:
//
//   Restrained -> Loose -> Carried | Rigged -> Placed -> Installed
//                   ^________________________________________|  (dismantle)
//
// The delivered piece IS the installed piece: one record moves through every
// state, nothing is duplicated or swapped.

import { CF, V3, v, VY, clamp, yawOf, hashString, fmtKg } from "../core/math.js";
import { Config } from "../core/config.js";
import { $fmt } from "../core/lua.js";
import { Registry } from "../data/items.js";
import { Builder } from "../world/builder.js";
import * as Rules from "./buildRules.js";
import { transportBox } from "./packing.js";
import { bus, newId } from "../core/events.js";

const TOOL_NEED = { Bolt: "the impact wrench (2)", Wedge: "the scaffold hammer (3)", Weld: "the welder (4)", Screed: "the trowel (7)" };
const TOOL_SHORT = { Bolt: "impact wrench (2)", Wedge: "scaffold hammer (3)", Weld: "welder (4)", Screed: "trowel (7)" };

const ok = (msg) => ({ ok: true, msg });
const no = (msg) => ({ ok: false, msg });

// parts of an item variant (cached) — used for colliders
const partCache = new Map();
export function itemParts(def, installed) {
  const key = def.id + (installed ? "|i" : "|l");
  let parts = partCache.get(key);
  if (!parts) {
    const b = new Builder({ installed });
    try {
      def.build(b, def, b.opts);
    } catch (e) {
      console.warn("[STEELRISE] builder failed for", def.id, e);
      b.parts.length = 0;
      b.box("Fallback", def.sizeM, CF.at(0, def.originBottom ? def.sizeM.y / 2 : 0, 0), Config.Colors.Invalid, "SmoothPlastic");
    }
    parts = { parts: b.parts, lights: b.lights, signs: b.signs };
    partCache.set(key, parts);
  }
  return parts;
}

export class Components {
  constructor(game) {
    this.g = game;
  }
  get world() {
    return this.g.world;
  }
  // Easy building: carry anything, snap from further away, attach instantly
  easy() {
    return this.g.settings.easyBuild !== false;
  }
  placeReach() {
    return this.easy() ? Config.Reach.EasyPlace : Config.Reach.Place;
  }

  // opts: { id, fastened, supportedBy, restraint, trailer, on }
  spawn(itemId, cf, state, opts = {}) {
    const def = Registry.get(itemId);
    if (!def) {
      console.warn("[STEELRISE] unknown item", itemId);
      return null;
    }
    const id = opts.id || newId("C");
    const n = def.fasteners.length;
    const comp = {
      kind: "comp",
      id,
      def,
      cf,
      state,
      holder: "",
      restraint: opts.restraint || "",
      trailerId: opts.trailer || "",
      supportedBy: Array.isArray(opts.supportedBy) ? opts.supportedBy : opts.supportedBy ? String(opts.supportedBy).split(",").filter(Boolean) : [],
      fastened: opts.fastened || (state === "Installed" ? "1" : "0").repeat(n),
      on: !!opts.on,
      tint: ((hashString(id) % 1000) / 1000 - 0.5) * 0.09,
    };
    this.setVariant(comp);
    this.world.comps.set(id, comp);
    this.world.attachColliders(comp);
    this.world.changed("spawn", comp);
    return comp;
  }

  setVariant(comp) {
    comp.installedLook = comp.state === "Installed";
    const p = itemParts(comp.def, comp.installedLook);
    comp.parts = p.parts;
    comp.lights = p.lights;
  }

  destroy(comp) {
    this.world.detachColliders(comp);
    this.world.comps.delete(comp.id);
    this.world.changed("remove", comp);
  }

  clearAll() {
    for (const c of [...this.world.comps.values()]) this.destroy(c);
  }

  setState(comp, state) {
    comp.state = state;
    if ((state === "Installed") !== comp.installedLook) this.setVariant(comp);
    if (state === "Carried") this.world.detachColliders(comp);
    else this.world.attachColliders(comp);
    this.world.changed("state", comp);
  }

  move(comp, cf) {
    comp.cf = cf;
    if (comp.state !== "Carried") this.world.moveColliders(comp);
    this.world.changed("move", comp);
  }

  fastenedCount(comp) {
    return [...comp.fastened].filter((c) => c === "1").length;
  }

  // distance from a point to the component's bounding box
  distanceTo(comp, point) {
    const def = comp.def;
    const cf = comp.cf.mul(CF.from(def.boundsOffset));
    const lp = cf.pointToObj(point);
    const h = def.size.mul(0.5);
    const c = v(clamp(lp.x, -h.x, h.x), clamp(lp.y, -h.y, h.y), clamp(lp.z, -h.z, h.z));
    return lp.sub(c).len;
  }

  // ---------------------------------------------------------------------------
  // Tools
  // ---------------------------------------------------------------------------
  equip(toolId) {
    const def = Registry.get(toolId || "");
    if (!def || def.kind !== "Tool") return no("Unknown tool.");
    this.g.player.tool = toolId;
    bus.emit("tool", toolId);
    return ok();
  }

  // ---------------------------------------------------------------------------
  // Hand carrying
  // ---------------------------------------------------------------------------
  stackedOnTop(comp) {
    const def = comp.def;
    const cf = comp.cf.mul(CF.from(def.boundsOffset));
    const up = cf.vecToObj(VY);
    const ax = Math.abs(up.x), ay = Math.abs(up.y), az = Math.abs(up.z);
    const halfY = (ax * def.size.x) / 2 + (ay * def.size.y) / 2 + (az * def.size.z) / 2;
    const probe = v(ax >= ay && ax >= az ? 0.167 : def.size.x * 0.8, ay > ax && ay >= az ? 0.167 : def.size.y * 0.8, az > ax && az > ay ? 0.167 : def.size.z * 0.8);
    const box = cf.rot.plus(cf.pos.add(v(0, halfY + 0.117, 0)));
    for (const hit of this.world.overlap(box, probe)) {
      const o = hit.comp;
      if (o && o !== comp && (o.state === "Loose" || o.state === "Restrained")) return o.def.name;
    }
    return null;
  }

  carryPose(comp) {
    const pl = this.g.player;
    const def = comp.def;
    const root = CF.from(pl.rootPos()).mul(CF.angles(0, pl.yaw, 0));
    const longest = Math.max(def.size.x, def.size.y, def.size.z);
    if (longest > 1.667) {
      let axis = new CF();
      if (longest === def.size.x) axis = CF.angles(0, Math.PI / 2, 0);
      else if (longest === def.size.y) axis = CF.angles(-Math.PI / 2, 0, 0);
      return root.mul(CF.at(0.37, 0.53, 0)).mul(axis).mul(CF.from(def.boundsOffset.neg()));
    }
    const depth = Math.max(def.size.x, def.size.z) / 2;
    return root.mul(CF.at(0, 0.067, -(depth + 0.467))).mul(CF.from(def.boundsOffset.neg()));
  }

  pickUp(comp) {
    const g = this.g, pl = g.player;
    if (!comp || !this.world.comps.has(comp.id)) return no("That item no longer exists.");
    const def = comp.def;
    if (pl.carrying) return no("You're already carrying something — place or drop it first (G).");
    if (g.crane && g.crane.operating) return no("Leave the crane controls first.");
    const easy = this.easy();
    if (comp.state === "Restrained" && !easy) return no("Secured by cargo straps — release the strap first.");
    if (comp.state !== "Loose" && comp.state !== "Restrained") return no("Only loose materials can be picked up.");
    if (comp.trailerId && g.delivery.isArriving(comp.trailerId)) return no("The truck is still pulling in.");
    const wc = Config.WeightClasses[def.weightClass];
    if (!wc.carry && !easy) return no($fmt("Too heavy to carry (%s) — use the crane, or turn on Easy building in Settings.", fmtKg(def.weightKg)));
    if (this.distanceTo(comp, pl.rootPos()) > Config.Reach.Interact) return no("Out of reach — move closer.");
    const blocker = this.stackedOnTop(comp);
    if (blocker) return no("Take the " + blocker + " off the top of the stack first.");
    comp.holder = "player";
    comp.restraint = "";
    g.delivery.onRemovedFromTrailer(comp);
    comp.trailerId = "";
    pl.carrying = comp;
    this.setState(comp, "Carried");
    comp.cf = this.carryPose(comp);
    bus.emit("fx", "Pickup", comp.cf.pos, def.id);
    bus.emit("carry", comp);
    return ok();
  }

  // lay an item down in its transport pose on whatever is below `point`
  restingPose(comp, point, yaw, excludeIds) {
    const def = comp.def;
    const hit = this.world.raycast(point.add(v(0, 1.333, 0)), v(0, -20, 0), excludeIds || new Set([comp.id]));
    const groundY = hit ? hit.pos.y : 0;
    const R = CF.angles(0, yaw, 0).mul(def.transport);
    const { box, offset } = transportBox(def);
    const rotOffset = CF.angles(0, yaw, 0).vecToWorld(offset);
    const centre = v(point.x, groundY + box.y / 2 + 0.007, point.z);
    return CF.from(centre.sub(rotOffset)).mul(R);
  }

  dropCarried(silent) {
    const pl = this.g.player;
    const comp = pl.carrying;
    if (!comp) return no("Not carrying anything.");
    const def = comp.def;
    const root = CF.from(pl.rootPos()).mul(CF.angles(0, pl.yaw, 0));
    const base = root.point(v(0, 0, -(Math.min(def.size.x, def.size.z) / 2 + 0.667)));
    comp.cf = this.restingPose(comp, base, pl.yaw);
    comp.holder = "";
    pl.carrying = null;
    this.setState(comp, "Loose");
    if (!silent) bus.emit("fx", "Drop", comp.cf.pos, def.id);
    bus.emit("carry", null);
    return ok();
  }

  // commit to a validated pose; state from whether it needs fastening
  commitPlacement(comp, cf, info) {
    const def = comp.def;
    comp.cf = cf;
    comp.supportedBy = [...(info.mates || []), ...(info.supports || [])];
    const needs = def.fasteners.length > 0 && !this.easy();
    comp.fastened = (needs ? "0" : "1").repeat(def.fasteners.length);
    comp.restraint = "";
    comp.trailerId = "";
    this.setState(comp, needs ? "Placed" : "Installed");
    if (!needs) this.onInstalled(comp);
  }

  place(cf, free) {
    const pl = this.g.player;
    const comp = pl.carrying;
    if (!comp) return no("You're not carrying anything.");
    const def = comp.def;
    if (free && !def.allowFree) return no("Free placement isn't available for structural members.");
    const r = Rules.validate(this.world, def, cf, { exclude: [comp.id], excludeIds: [comp.id], actorPos: pl.rootPos(), reach: this.placeReach() });
    if (!r.ok) return no(r.reason);
    pl.carrying = null;
    comp.holder = "";
    this.commitPlacement(comp, cf, r.info);
    bus.emit("fx", "Set", cf.pos, def.id);
    bus.emit("event", "Placed", { item: def.id });
    bus.emit("carry", null);
    return ok();
  }

  // ---------------------------------------------------------------------------
  // Fastening, installing, dismantling
  // ---------------------------------------------------------------------------
  onInstalled(comp) {
    if (comp.state !== "Installed") this.setState(comp, "Installed");
    this.world.changed("installed", comp);
    bus.emit("event", "Installed", { item: comp.def.id });
    this.g.site.onComponentInstalled(comp);
  }

  fasten(comp, index) {
    const pl = this.g.player;
    if (!comp || !this.world.comps.has(comp.id)) return no("That component no longer exists.");
    const def = comp.def;
    if (comp.state !== "Placed") return no("Only placed components need fastening.");
    const f = def.fasteners[index];
    if (!f) return no("No fastener there.");
    if (comp.fastened[index] === "1") return no("Already tight.");
    const tool = Registry.get(pl.tool);
    if (!tool || tool.fastens !== f.type) return no("Wrong tool — this needs " + (TOOL_NEED[f.type] || f.type) + ".");
    const wp = comp.cf.point(f.pos);
    if (pl.rootPos().dist(wp) > Config.Reach.Fasten) return no("Out of reach — get closer to the connection (scaffold or deck).");
    comp.fastened = comp.fastened.slice(0, index) + "1" + comp.fastened.slice(index + 1);
    this.world.changed("fastened", comp);
    bus.emit("fx", f.type, wp, def.id);
    if (!comp.fastened.includes("0")) {
      this.onInstalled(comp);
      this.g.crane.onComponentInstalled(comp);
    }
    return ok();
  }

  dismantle(comp) {
    const g = this.g, pl = g.player;
    if (!comp || !this.world.comps.has(comp.id)) return no("That component no longer exists.");
    const def = comp.def;
    if (comp.state !== "Installed" && comp.state !== "Placed") return no("Nothing to dismantle.");
    if (g.crane.holds(comp) || (g.telehandler && g.telehandler.holds(comp))) return no("The crane or telehandler is still holding it — release it first.");
    if (this.distanceTo(comp, pl.rootPos()) > Config.Reach.Interact) return no("Out of reach.");
    if (def.fasteners.length > 0) {
      const tool = Registry.get(pl.tool);
      if (!tool || tool.fastens !== def.fasteners[0].type) return no("Equip the " + (TOOL_SHORT[def.fasteners[0].type] || "right tool") + " to undo its connections.");
    }
    const deps = Rules.dependents(this.world, comp.id);
    if (deps.length > 0) return no("Remove what it supports first: " + deps[0].def.name + ".");
    comp.supportedBy = [];
    comp.fastened = "0".repeat(def.fasteners.length);
    this.setState(comp, "Loose");
    bus.emit("fx", "Dismantle", comp.cf.pos, def.id);
    g.site.onComponentRemoved(comp);
    return ok();
  }

  // ---------------------------------------------------------------------------
  // Concrete: the pump hose places a slab over a fully decked bay
  // ---------------------------------------------------------------------------
  pour(def, cf) {
    const pl = this.g.player;
    if (pl.tool !== "TL-POUR") return no("Equip the concrete pump hose (6).");
    if (!def || def.kind !== "Slab" || !cf) return no("Nothing to pour there.");
    const root = pl.rootPos();
    const d = Math.hypot(root.x - cf.x, root.z - cf.z);
    if (d > Math.max(def.size.x, def.size.z) / 2 + Config.Reach.Place || Math.abs(root.y - cf.y) > 4) return no("Out of reach — stand on or next to the bay you're pouring.");
    const r = Rules.validate(this.world, def, cf, {});
    if (!r.ok) return no(r.reason);
    const slab = this.spawn(def.id, cf, this.easy() ? "Installed" : "Placed", { supportedBy: r.info.supports });
    if (this.easy() && slab) this.onInstalled(slab);
    bus.emit("fx", "Pour", cf.pos, def.id);
    return ok("Concrete placed — finish it with the trowel (7) at the four marks.");
  }

  // ---------------------------------------------------------------------------
  // Functional equipment (lights, engines)
  // ---------------------------------------------------------------------------
  toggle(comp) {
    const pl = this.g.player;
    if (!comp) return no("Gone.");
    if (!comp.def.functional) return no("Nothing to switch on.");
    if (comp.state !== "Installed" && comp.state !== "Loose") return no("Set it down first.");
    if (this.distanceTo(comp, pl.rootPos()) > Config.Reach.Interact) return no("Out of reach.");
    comp.on = !comp.on;
    this.world.changed("toggle", comp);
    bus.emit("fx", "Toggle", comp.cf.pos, comp.on);
    return ok();
  }
}
