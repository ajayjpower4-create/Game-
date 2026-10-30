// Loads a site: environment, crane, the starting stage of the building (or a
// save), starter deliveries and the scaffold kit. Tracks wind, time of day
// and blueprint progress for the task panel.

import { CF, v, clamp } from "../core/math.js";
import { Config } from "../core/config.js";
import { $fmt } from "../core/lua.js";
import { Registry } from "../data/items.js";
import { getSite, layout, sortEntries, stageEntries, blueprintGrid } from "../data/sites.js";
import * as Rules from "./buildRules.js";
import { World } from "./world.js";
import { Components } from "./components.js";
import { Delivery } from "./delivery.js";
import { Crane } from "./crane.js";
import { Telehandler } from "./telehandler.js";
import { pack } from "./packing.js";
import { buildEnvironment, isNight } from "../world/env.js";
import { bus } from "../core/events.js";

const WIND_BASE = { Rural: 6, Suburban: 5, Downtown: 6, Waterfront: 9, Industrial: 7, CityCenter: 8, Residential: 5, HighRise: 9 };
const PHASE_VERB = { footing: "Set footing", column: "Erect column", beam: "Hang beam", gusset: "Bolt gusset plate", brace: "Install brace", deck: "Lay deck sheet", slab: "Pour slab", facade: "Hang facade unit", parapet: "Set parapet", balcony: "Hang balcony" };

const posKey = (itemId, p) => `${itemId}@${Math.floor(p.x * 6 + 0.5)},${Math.floor(p.y * 6 + 0.5)},${Math.floor(p.z * 6 + 0.5)}`;

export class Site {
  constructor(game) {
    this.g = game;
    this.def = null;
    this.wind = { speed: 0, dir: 0.7, mean: 6, gust: 0 };
    this.clock = 12;
    this.blueprint = null;
    this.entries = null;
    this.progress = { installed: 0, total: 0, next: "" };
    this.windAcc = 0;
    this.dirty = false;
  }

  unload() {
    const g = this.g;
    if (!g.world) return;
    if (g.crane) g.crane.dispose();
    if (g.telehandler) g.telehandler.dispose();
    g.telehandler = null;
    g.delivery.clearAll();
    g.components.clearAll();
    g.player.carrying = null;
    bus.emit("site", "unload", this);
    g.world = null;
    g.crane = null;
    this.def = null;
  }

  // Loads a site (fresh or from a save). Each step is isolated so a failure
  // in one part of the world is reported instead of aborting the load.
  load(siteId, save) {
    const def = getSite(siteId);
    if (!def) return { ok: false, msg: "Unknown site." };
    this.unload();
    const g = this.g;
    this.def = def;
    g.siteDef = def;
    g.world = new World(def);
    g.components = new Components(g);
    g.delivery = new Delivery(g);
    const failures = [];
    const step = (label, fn) => {
      try {
        fn();
      } catch (e) {
        console.error("[STEELRISE] site step failed:", label, e);
        failures.push(label + ": " + (e && e.message ? e.message : String(e)));
      }
    };
    this.wind = { speed: WIND_BASE[def.style] || 6, dir: 0.7, mean: WIND_BASE[def.style] || 6, gust: 0 };
    step("environment", () => {
      const e = buildEnvironment(def);
      this.env = e;
      g.world.addStatic(e.env.b.parts, new CF(), { kind: "env", name: "site equipment" });
      g.world.addStatic(e.surroundings.b.parts, new CF(), { kind: "sur", name: "building" });
      // ground ends at the quay on the waterfront
      const lot = def.lotM;
      g.world.physics.bounds = { minX: -2000, maxX: 2000, minZ: -2000, maxZ: e.terrain.water ? e.terrain.water.minZ : 2000 };
    });
    step("tower crane", () => {
      g.crane = new Crane(g, def.crane);
    });
    if (!g.crane) g.crane = new Crane(g, { ...def.crane });
    step("telehandler", () => {
      const ld = def.laydownM;
      // park it next to the laydown yard, wherever there is room
      const tries = [];
      for (const r of [4, 7, 10]) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) tries.push(v(ld.center.x + dx * (ld.size.x / 2 + r), 0, ld.center.z + dz * (ld.size.z / 2 + r)));
      tries.push(def.spawnM.add(v(6, 0, 6)));
      g.telehandler = new Telehandler(g, tries[0], 0);
      for (const p of tries) {
        for (const h of [0, Math.PI / 2]) {
          g.telehandler.pos = p;
          g.telehandler.heading = h;
          g.telehandler.groundY = g.telehandler.groundAt(p);
          if (!g.telehandler.blocked(g.telehandler.frame()) && Math.abs(p.x) < def.lotM.x / 2 - 3 && Math.abs(p.z) < def.lotM.z / 2 - 3) {
            g.telehandler.updateColliders();
            p.found = true;
            break;
          }
        }
        if (p.found) break;
      }
      if (save && save.telehandler) g.telehandler.restore(save.telehandler);
    });
    step("materials", () => {
      if (save) {
        for (const c of save.components || []) {
          if (!Registry.get(c.t) || !Array.isArray(c.c)) continue;
          g.components.spawn(c.t, CF.fromArray(c.c), c.s || "Loose", { id: c.i, fastened: c.f, supportedBy: c.sb, restraint: c.r, trailer: c.tr, on: c.on });
        }
        g.delivery.restore(save.trailers);
        if (save.cranes) g.crane.restore(save.cranes["1"]);
        g.delivery.refreshAll();
      } else {
        const stage = [];
        for (const e of stageEntries(def)) {
          const c = g.components.spawn(e.item, e.cf, "Installed", {});
          if (c) stage.push(c);
        }
        g.world.markDirty();
        for (const c of stage) c.supportedBy = Rules.supportsOf(g.world, c.def, c.cf, c.id);
        if (def.starter) {
          if (def.starter.trailer) g.delivery.spawnLoaded(1, def.starter.trailer.map(([id, qty]) => ({ id, qty })));
          this.spawnLaydown(def.starter.laydown);
        } else {
          // next work package from the blueprint
          const staged = new Set(stageEntries(def).map((e) => e.key));
          const counts = new Map();
          let n = 0;
          for (const e of sortEntries(layout(def.grid))) {
            if (staged.has(e.key) || e.phase === "deck" || e.phase === "gusset" || e.phase === "slab") continue;
            counts.set(e.item, (counts.get(e.item) || 0) + 1);
            if (++n >= 10) break;
          }
          const pending = [...counts].map(([id, qty]) => ({ id, qty }));
          if (pending.length) g.delivery.spawnLoaded(1, pending);
          this.spawnLaydown([
            ["CON-GUSSET-350", 4],
            ["SC-BASEJACK", 4],
            ["SC-STD-2000", 8],
            ["SC-LEDGER-2570", 6],
            ["SC-LEDGER-1090", 6],
            ["SC-DECK-2570", 2],
            ["SC-LADDER-27", 1],
          ]);
        }
      }
    });
    this.clock = save && save.clock != null ? save.clock : def.lighting.clock || 12;
    step("blueprint", () => this.setBlueprint(save ? save.blueprint || null : def.grid ? "Site" : null));
    this.failures = failures;
    this.dirty = false;
    bus.emit("site", "loaded", this);
    return { ok: true, failures };
  }

  spawnLaydown(requests) {
    if (!requests || !requests.length) return;
    const ld = this.def.laydownM;
    const frame = CF.at(ld.center.x, 0, ld.center.z);
    const r = pack(requests.map(([id, qty]) => ({ id, qty })), ld.size.x, ld.size.z, 1.2, {});
    const parts = [];
    for (const d of r.extras.dunnage) parts.push({ name: "Dunnage", shape: "box", size: d.size, cf: frame.mul(d.cf), color: Config.Colors.Timber, mat: "Wood" });
    this.laydownDunnage = parts;
    this.g.world.addStatic(parts, new CF(), { kind: "env", name: "Dunnage" });
    bus.emit("site", "dunnage", parts);
    for (const p of r.placed) this.g.components.spawn(p.id, frame.mul(p.cf), "Loose", {});
  }

  setClock(clock) {
    this.clock = clamp(Number(clock) || 12, 0, 24);
    this.dirty = true;
    bus.emit("site", "clock", this);
  }
  isNight() {
    return isNight(this.clock);
  }

  setBlueprint(id) {
    if (!this.def) return;
    const grid = id ? blueprintGrid(this.def, id) : null;
    this.blueprint = grid ? id || "Site" : null;
    this.entries = grid ? sortEntries(layout(grid)) : null;
    if (this.g.world) this.g.world.blueprintGrid = grid || null;
    this.recountProgress();
    bus.emit("site", "blueprint", this);
  }

  recountProgress() {
    const entries = this.entries;
    if (!entries || !entries.length) {
      this.progress = { installed: 0, total: 0, next: "Free build — order materials from the catalog (Tab) and build anywhere on the lot." };
      bus.emit("progress", this.progress);
      return;
    }
    const installed = new Set();
    for (const c of this.g.world.records()) if (c.state === "Installed") installed.add(posKey(c.def.id, c.cf.pos));
    let done = 0, nextE = null;
    for (const e of entries) {
      if (installed.has(posKey(e.item, e.cf.pos))) done++;
      else if (!nextE) nextE = e;
    }
    let next = "Blueprint complete. Outstanding work!";
    if (nextE) {
      const def = Registry.get(nextE.item);
      const grid = String.fromCharCode(65 + nextE.i) + (nextE.j + 1);
      const where = nextE.phase === "footing" ? "grid " + grid : $fmt("level %d, grid %s", nextE.level, grid);
      next = $fmt("%s — %s (%s)", PHASE_VERB[nextE.phase] || "Install", def ? def.name : nextE.item, where);
    }
    this.progress = { installed: done, total: entries.length, next, nextEntry: nextE };
    bus.emit("progress", this.progress);
  }

  onComponentInstalled() {
    this.dirty = true;
    this.recountProgress();
  }
  onComponentRemoved() {
    this.dirty = true;
    this.recountProgress();
  }

  // gusty wind: a mean that drifts slowly plus short gusts
  update(dt) {
    this.windAcc += dt;
    if (this.windAcc < 1 || !this.def) return;
    this.windAcc = 0;
    const w = this.wind;
    const base = WIND_BASE[this.def.style] || 6;
    w.mean += (base - w.mean) * 0.02 + (Math.random() * 0.5 - 0.25);
    w.gust = w.gust * 0.8 + (Math.random() * 2 - 1) * (Math.random() < 0.08 ? 6 : 1.2);
    w.dir += Math.random() * 0.08 - 0.04;
    w.speed = Math.round(clamp(w.mean + w.gust, 0, 22) * 10) / 10;
  }

  serialize() {
    const g = this.g;
    const comps = [];
    for (const c of g.world.records()) {
      let state = c.state;
      let cf = c.cf;
      // carried / hanging pieces are saved as set down where they are
      if (state === "Carried" || state === "Rigged") {
        state = "Loose";
        cf = g.components.restingPose(c, c.cf.pos, 0);
      }
      comps.push({ i: c.id, t: c.def.id, c: cf.toArray(), s: state, f: c.fastened, sb: c.supportedBy.join(","), r: c.restraint, tr: c.trailerId, on: c.on || undefined });
    }
    return {
      version: 1,
      site: this.def.id,
      savedAt: Date.now(),
      clock: this.clock,
      blueprint: this.blueprint,
      components: comps,
      trailers: g.delivery.serialize(),
      cranes: { 1: g.crane ? g.crane.serialize() : null },
      telehandler: g.telehandler ? g.telehandler.serialize() : null,
      player: g.player.serialize(),
      installed: comps.filter((c) => c.s === "Installed").length,
    };
  }
}
