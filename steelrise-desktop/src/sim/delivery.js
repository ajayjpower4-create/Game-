// Flatbed and rail deliveries: vehicles pull into unloading bays with every
// ordered piece physically on the deck, stacked on dunnage and held by
// ratchet straps. Pieces leave visible gaps as they are unloaded; an empty
// truck can be dismissed to free the bay.

import { CF, V3, v, clamp } from "../core/math.js";
import { Config } from "../core/config.js";
import { $fmt } from "../core/lua.js";
import { Registry } from "../data/items.js";
import { buildTruck, buildFlatcar, buildLocomotive } from "../world/vehicles.js";
import { Node } from "../world/node.js";
import { pack } from "./packing.js";
import { collidersFor, makeCollider } from "../world/physics.js";
import { bus, newId } from "../core/events.js";

const D = Config.Delivery;
const VEHICLES = {
  truck: { len: D.BedLength, width: D.BedWidth, maxKg: D.TrailerMaxKg, maxH: D.MaxStackHeight, animM: 70, name: "truck" },
  rail: { len: 17.4, width: 2.7, maxKg: 60000, maxH: 2.8, animM: 160, name: "railcar" },
};
const STRAP = Config.Colors.StrapOrange;

const ok = (msg) => ({ ok: true, msg });
const no = (msg) => ({ ok: false, msg });
const easeOut = (t) => 1 - (1 - t) ** 3;
const easeIn = (t) => t * t * t;

export class Delivery {
  constructor(game) {
    this.g = game;
    this.trailers = new Map();
    this.checkAcc = 0;
  }
  get world() {
    return this.g.world;
  }
  spotsFor(kind) {
    const site = this.g.siteDef;
    if (!site) return [];
    return kind === "rail" ? site.railSpots || [] : site.bays;
  }
  now() {
    return this.g.time;
  }

  clearAll() {
    for (const t of this.trailers.values()) this.removeTrailer(t);
    this.trailers.clear();
  }

  isArriving(id) {
    const t = this.trailers.get(id);
    return !!t && this.now() < t.arriveAt + D.ArriveSeconds;
  }

  cargoOf(id) {
    return this.world.records().filter((c) => c.trailerId === id);
  }

  updateManifest(t) {
    const counts = new Map();
    for (const c of this.cargoOf(t.id)) counts.set(c.def.id, (counts.get(c.def.id) || 0) + 1);
    t.manifest = [...counts].map(([id, qty]) => ({ id, name: Registry.get(id)?.name || id, qty }));
    t.remaining = [...counts.values()].reduce((a, b) => a + b, 0);
    t.empty = t.remaining === 0;
    if (t.empty) t.emptySince = t.emptySince ?? this.now();
    else t.emptySince = null;
    bus.emit("trailer", "manifest", t);
  }

  bedFrame(t) {
    return t.bayCf.mul(CF.at(0, t.bedTop, 0));
  }

  // straps, dunnage and their hit volumes live in a node on the vehicle
  buildLoadExtras(t, extras) {
    const load = t.model.add(new Node("Load"));
    t.loadNode = load;
    const bedLocal = CF.at(0, t.bedTop, 0);
    t.dunnage = extras.dunnage;
    for (const d of extras.dunnage) load.b.box("Dunnage", d.size, bedLocal.mul(d.cf), Config.Colors.Timber, "Wood");
    t.straps = [];
    extras.straps.forEach((s, i) => {
      const id = s.id || t.id + ":S" + (i + 1);
      t.straps.push({ id, x: s.x, top: s.top, width: s.width, group: s.group, released: !!s.released });
    });
    this.rebuildStraps(t);
  }

  rebuildStraps(t) {
    const old = t.model.children.find((c) => c.name === "Straps");
    if (old) t.model.children.splice(t.model.children.indexOf(old), 1);
    const node = t.model.add(new Node("Straps"));
    const bed = CF.at(0, t.bedTop, 0);
    const bedHalf = t.bedWidthM / 2;
    for (const s of t.straps) {
      if (s.released) continue;
      const W = Math.max(s.width, t.bedWidthM * 0.5);
      node.b.box("Band", v(0.053, 0.02, W + 0.04), bed.mul(CF.at(s.x, s.top + 0.013, 0)), STRAP, "Fabric", { nc: true, ns: true });
      for (const sz of [-1, 1]) {
        const a = v(s.x, s.top + 0.013, sz * (W / 2 + 0.017));
        const b = v(s.x, -0.117, sz * (bedHalf + 0.02));
        const len = b.sub(a).len;
        node.b.box("Leg", v(0.053, len, 0.02), bed.mul(CF.from(a.add(b).mul(0.5)).mul(CF.angles(Math.atan2(a.z - b.z, a.y - b.y), 0, 0))), STRAP, "Fabric", { nc: true, ns: true });
      }
      node.b.box("Ratchet", v(0.1, 0.15, 0.067), bed.mul(CF.at(s.x, s.top * 0.45, bedHalf + 0.04)), Config.Colors.Galvanized, "Metal", { nc: true });
    }
    t.version = (t.version || 0) + 1;
    this.refreshColliders(t);
  }

  refreshColliders(t) {
    const w = this.world;
    if (t.colliders) w.removeColliders(t.colliders);
    const cf = this.vehicleCf(t);
    t.colliders = [];
    const owner = t.owner;
    const add = (parts, nodeCf) => {
      for (const c of collidersFor(parts, cf.mul(nodeCf), owner)) {
        c.local = nodeCf.mul(c.local);
        t.colliders.push(c);
      }
    };
    // body + load, skip wheels (handled as part of body silhouette)
    add(t.model.b.parts.filter((p) => !p.nc || p.interact), new CF());
    if (t.loadNode) add(t.loadNode.b.parts, t.loadNode.cf);
    if (t.loco) add(t.loco.b.parts.filter((p) => !p.nc), t.loco.cf);
    // strap hit boxes
    const bed = CF.at(0, t.bedTop, 0);
    for (const s of t.straps) {
      if (s.released) continue;
      const W = Math.max(s.width, t.bedWidthM * 0.5);
      const local = bed.mul(CF.at(s.x, s.top / 2, 0));
      const c = makeCollider(cf.mul(local), v(0.4, s.top + 0.2, W + 0.27), { kind: "strap", strap: s, trailer: t }, { solid: false, query: true, name: "StrapHit" });
      c.local = local;
      t.colliders.push(c);
    }
    w.physics.addAll(t.colliders);
  }

  vehicleCf(t) {
    return t.bayCf.mul(CF.at(t.offset || 0, 0, 0));
  }

  freeBay(kind = "truck") {
    const used = new Set();
    for (const t of this.trailers.values()) if (t.kind === kind) used.add(t.bay);
    const spots = this.spotsFor(kind);
    const limit = kind === "truck" ? Math.min(spots.length, D.MaxTrailers) : spots.length;
    for (let i = 1; i <= limit; i++) if (!used.has(i)) return i;
    return null;
  }

  // placed: bed-local frames from pack() spawn restrained cargo; null when
  // restoring a save (cargo is restored separately)
  spawnTrailer(bayIndex, placed, extras, opts = {}) {
    const kind = opts.kind || "truck";
    const vehicle = VEHICLES[kind];
    const id = opts.id || (kind === "rail" ? "R" : "T") + newId("").slice(-8);
    const bayCf = this.spotsFor(kind)[bayIndex - 1];
    const seed = opts.seed || Math.floor(Math.random() * 1e6) + 1;
    let built, loco = null;
    if (kind === "rail") {
      built = buildFlatcar(new CF(), seed);
      if (opts.loco) {
        const l = buildLocomotive(CF.at(-(built.length / 2 + 9.1), 0, 0));
        loco = l.model;
        built.model.add(loco);
      }
    } else {
      built = buildTruck(new CF(), seed);
    }
    const t = {
      id,
      bay: bayIndex,
      kind,
      bedWidthM: vehicle.width,
      bayCf,
      bedTop: built.bedTop,
      model: built.model,
      loco,
      hasLoco: !!opts.loco,
      seed,
      animDist: vehicle.animM,
      arriveAt: opts.instant ? -1e9 : this.now(),
      departAt: 0,
      offset: opts.instant ? 0 : vehicle.animM,
      cargoFinal: new Map(),
      manifest: [],
      remaining: 0,
      empty: false,
    };
    t.owner = { kind: "trailer", trailer: t, name: kind === "rail" ? "railcar" : "truck" };
    this.trailers.set(id, t);
    this.buildLoadExtras(t, extras);
    if (placed) {
      const bed = this.bedFrame(t);
      for (const p of placed) {
        const c = this.g.components.spawn(p.id, bed.mul(p.cf), "Restrained", { restraint: id + ":" + p.group, trailer: id });
        if (c) t.cargoFinal.set(c, c.cf);
      }
    } else {
      for (const c of this.cargoOf(id)) t.cargoFinal.set(c, c.cf);
    }
    for (const s of t.straps) if (!s.group.includes(":")) s.group = id + ":" + s.group;
    this.updateManifest(t);
    if (!opts.instant) {
      this.applyOffset(t, t.offset);
      bus.emit("fx", kind === "rail" ? "TrainArrive" : "TruckArrive", bayCf.pos, null);
    }
    bus.emit("trailer", "spawn", t);
    return t;
  }

  removeTrailer(t) {
    if (t.colliders) this.world.removeColliders(t.colliders);
    t.colliders = null;
    bus.emit("trailer", "remove", t);
  }

  request(itemId, qty, mode) {
    const site = this.g.siteDef;
    if (!site) return no("No site loaded.");
    const kind = mode === "rail" ? "rail" : "truck";
    const vehicle = VEHICLES[kind];
    if (kind === "rail" && !(site.railSpots || []).length) return no("This site has no rail siding — deliveries come by truck.");
    const def = Registry.get(itemId || "");
    if (!def || !def.deliverable) return no("That item can't be delivered.");
    const maxQty = def.weightClass === "Light" ? 40 : def.weightClass === "Medium" ? 16 : 10;
    qty = clamp(Math.floor(Number(qty) || 1), 1, maxQty);
    const loose = this.world.records().filter((c) => c.state === "Loose" || c.state === "Restrained").length;
    if (loose + qty > D.MaxLooseComponents) return no($fmt("Too much loose material on site (%d). Install or stack what you have first.", loose));
    let remaining = [{ id: itemId, qty }];
    let delivered = 0, vehicles = 0;
    while (remaining.length > 0) {
      const bay = this.freeBay(kind);
      if (!bay) break;
      const r = pack(remaining, vehicle.len, vehicle.width, vehicle.maxH, { maxKg: vehicle.maxKg });
      if (r.placed.length === 0) {
        if (delivered === 0) return no("That load won't fit on a " + vehicle.name + ".");
        break;
      }
      this.spawnTrailer(bay, r.placed, r.extras, { kind, loco: kind === "rail" && vehicles === 0 });
      delivered += r.placed.length;
      vehicles++;
      remaining = r.leftovers;
    }
    if (delivered === 0) {
      if (kind === "rail") return no("The siding is full — unload and release the railcars first.");
      return no("All unloading bays are occupied — unload and dismiss a truck first.");
    }
    let msg = $fmt("%d × %s on %d %s%s — arriving now.", delivered, def.name, vehicles, vehicle.name, vehicles > 1 ? "s" : "");
    if (delivered < qty) msg += $fmt(" %d didn't fit: free a bay and order again.", qty - delivered);
    return ok(msg);
  }

  // starter loads for a fresh site (no drive-in)
  spawnLoaded(bayIndex, requests) {
    const veh = VEHICLES.truck;
    const r = pack(requests, veh.len, veh.width, veh.maxH, { maxKg: veh.maxKg });
    return this.spawnTrailer(bayIndex, r.placed, r.extras, { instant: true });
  }

  releaseStrap(strap, trailer) {
    const t = trailer;
    if (!t || strap.released) return no("Strap already released.");
    if (this.isArriving(t.id)) return no("Wait for the truck to stop.");
    const pl = this.g.player;
    const bed = this.bedFrame(t);
    const W = Math.max(strap.width, t.bedWidthM * 0.5);
    const hitCf = bed.mul(CF.at(strap.x, strap.top / 2, 0));
    const lp = hitCf.pointToObj(pl.rootPos());
    const h = v(0.2, (strap.top + 0.2) / 2, (W + 0.27) / 2);
    const d = lp.sub(v(clamp(lp.x, -h.x, h.x), clamp(lp.y, -h.y, h.y), clamp(lp.z, -h.z, h.z))).len;
    if (d > Config.Reach.Interact) return no("Out of reach — walk up to the trailer.");
    strap.released = true;
    this.rebuildStraps(t);
    bus.emit("fx", "Strap", hitCf.pos, null);
    // group free once all of its straps are off
    const held = t.straps.some((s) => s.group === strap.group && !s.released);
    if (!held) {
      for (const c of this.cargoOf(t.id)) {
        if (c.restraint === strap.group) {
          c.restraint = "";
          if (c.state === "Restrained") this.g.components.setState(c, "Loose");
        }
      }
    }
    bus.emit("trailer", "strap", t);
    return ok();
  }

  onRemovedFromTrailer(comp) {
    const t = comp.trailerId && this.trailers.get(comp.trailerId);
    if (t) {
      comp.trailerId = "";
      t.cargoFinal.delete(comp);
      this.updateManifest(t);
    }
  }

  depart(id) {
    const t = this.trailers.get(id);
    if (!t || t.departing) return;
    t.departing = true;
    t.departAt = this.now();
    bus.emit("fx", t.kind === "rail" ? "TrainDepart" : "TruckDepart", t.bayCf.pos, null);
  }

  dismiss(t) {
    if (!t) return no("No such truck.");
    const left = this.cargoOf(t.id).length;
    if (left > 0) return no($fmt("Unload all materials first (%d left on the deck).", left));
    this.depart(t.id);
    return ok("Truck released.");
  }

  // drive-in / drive-out along the vehicle's own axis
  applyOffset(t, offset) {
    const prev = t.offset || 0;
    t.offset = offset;
    t.wheelTravel = (t.wheelTravel || 0) + (offset - prev);
    const cf = this.vehicleCf(t);
    if (t.colliders) for (const c of t.colliders) this.world.physics.move(c, cf.mul(c.local));
    const rel = cf.mul(t.bayCf.inverse());
    for (const [c, finalCf] of t.cargoFinal) {
      if (this.world.comps.has(c.id) && (c.state === "Restrained" || c.state === "Loose") && c.trailerId === t.id) {
        c.cf = rel.mul(finalCf);
        this.world.moveColliders(c);
        this.world.changed("move", c);
      }
    }
  }

  update(dt) {
    const now = this.now();
    for (const t of [...this.trailers.values()]) {
      if (t.departAt > 0) {
        const p = clamp((now - t.departAt) / D.DepartSeconds, 0, 1);
        this.applyOffset(t, -easeIn(p) * t.animDist);
        t.engine = 1;
        if (p >= 1) {
          this.trailers.delete(t.id);
          this.removeTrailer(t);
        }
      } else if (now < t.arriveAt + D.ArriveSeconds) {
        const p = clamp((now - t.arriveAt) / D.ArriveSeconds, 0, 1);
        this.applyOffset(t, (1 - easeOut(p)) * t.animDist);
        t.engine = 1 - p * 0.5;
        t.arriving = true;
      } else {
        if (t.arriving) {
          t.arriving = false;
          this.applyOffset(t, 0);
          bus.emit("fx", "AirBrake", t.bayCf.pos, null);
        }
        t.engine = 0.45;
      }
    }
    // empty vehicles leave on their own after a while
    this.checkAcc += dt;
    if (this.checkAcc > 5) {
      this.checkAcc = 0;
      for (const t of this.trailers.values()) {
        if (t.emptySince != null && !t.departing && now - t.emptySince > (t.kind === "rail" ? 20 : 120)) this.depart(t.id);
      }
    }
  }

  serialize() {
    const out = [];
    for (const t of this.trailers.values()) {
      if (t.departing) continue;
      out.push({
        id: t.id,
        bay: t.bay,
        kind: t.kind,
        loco: t.hasLoco,
        seed: t.seed,
        dunnage: (t.dunnage || []).map((d) => ({ cf: d.cf.toArray(), size: [d.size.x, d.size.y, d.size.z] })),
        straps: t.straps.map((s) => ({ ...s })),
      });
    }
    return out;
  }

  restore(list) {
    for (const data of list || []) {
      const kind = data.kind || "truck";
      if (!data.bay || !this.spotsFor(kind)[data.bay - 1]) continue;
      const dun = (data.dunnage || []).map((d) => ({ cf: CF.fromArray(d.cf), size: v(d.size[0], d.size[1], d.size[2]) }));
      this.spawnTrailer(data.bay, null, { dunnage: dun, straps: data.straps || [] }, { instant: true, id: data.id, seed: data.seed, kind, loco: data.loco });
    }
  }

  refreshAll() {
    for (const t of this.trailers.values()) {
      for (const c of this.cargoOf(t.id)) t.cargoFinal.set(c, c.cf);
      this.updateManifest(t);
    }
  }
}
