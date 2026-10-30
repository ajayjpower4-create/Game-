// Drivable telehandler (4 t / 13 m): drive around site, pick loose material
// on the forks, set it down, or land it on its connection like the crane.
// Kinematic driving with ground following and collision stops; a capacity
// chart that falls with reach.

import { CF, V3, v, clamp, wrapAngle, yawOf, fmtKg } from "../core/math.js";
import { Config, rgb } from "../core/config.js";
import { $fmt } from "../core/lua.js";
import { Node } from "../world/node.js";
import { collidersFor } from "../world/physics.js";
import * as Rules from "./buildRules.js";
import { bus } from "../core/events.js";

const YEL = rgb(232, 170, 22), DARK = rgb(40, 42, 46), TIRE = rgb(26, 26, 28), GLASS = rgb(60, 80, 96);
const WHEEL_R = 0.62;
const MAX_KG = 4000;
const ok = (msg) => ({ ok: true, msg });
const no = (msg) => ({ ok: false, msg });

// boom pivot (vehicle frame), boom length when retracted
const PIVOT = v(-1.7, 2.05, 0.35);
const BOOM0 = 4.6;
const MAX_EXT = 8.4;

function buildModel() {
  const root = new Node("Telehandler");
  const b = root.b;
  b.box("Frame", v(4.4, 0.55, 1.5), CF.at(0, 0.95, 0), YEL, "Metal");
  b.box("Belly", v(3.6, 0.35, 1.1), CF.at(0, 0.55, 0), DARK, "Metal");
  b.box("Engine", v(1.3, 0.95, 0.9), CF.at(-1.5, 1.55, 0.35), YEL, "Metal");
  b.box("Grille", v(0.05, 0.6, 0.7), CF.at(-2.16, 1.5, 0.35), DARK, "Metal", { nc: true });
  b.box("Counterweight", v(0.5, 0.8, 1.9), CF.at(-2.35, 1.0, 0), DARK, "Metal");
  for (const sz of [-1, 1]) b.box("Fender", v(1.5, 0.08, 0.55), CF.at(sz * 1.4 - 0.05 * sz, 1.42, 0), YEL, "Metal", { nc: true });
  // cab on the left
  b.box("CabFloor", v(1.6, 0.12, 0.95), CF.at(0.1, 1.3, -0.7), DARK, "Metal");
  b.box("CabBack", v(0.08, 1.6, 0.95), CF.at(-0.7, 2.1, -0.7), DARK, "Metal");
  b.box("CabRoof", v(1.65, 0.08, 1.0), CF.at(0.1, 2.92, -0.7), DARK, "Metal");
  for (const [x, z] of [[0.86, -0.25], [0.86, -1.15], [-0.66, -1.15], [-0.66, -0.25]]) b.box("CabPost", v(0.07, 1.6, 0.07), CF.at(x, 2.1, z), DARK, "Metal", { nc: true });
  b.box("Windscreen", v(0.02, 1.4, 0.85), CF.at(0.88, 2.15, -0.7), GLASS, "Glass", { nc: true, tr: 0.4 });
  b.box("SideGlass", v(1.45, 1.1, 0.02), CF.at(0.1, 2.3, -1.17), GLASS, "Glass", { nc: true, tr: 0.4 });
  b.box("Seat", v(0.5, 0.45, 0.5), CF.at(-0.25, 1.6, -0.7), rgb(30, 30, 32), "Fabric", { nc: true });
  b.box("Wheelhouse", v(0.4, 0.3, 0.06), CF.at(0.45, 1.95, -0.7), DARK, "SmoothPlastic", { nc: true });
  b.box("Beacon", v(0.15, 0.12, 0.15), CF.at(0.4, 3.02, -0.7), rgb(255, 160, 20), "Neon", { nc: true, ns: true });
  const interact = b.box("DriveVolume", v(4.8, 3.0, 2.2), CF.at(0, 1.6, 0), YEL, "SmoothPlastic", { tr: 1, nc: true, ns: true });
  interact.interact = "Telehandler";
  const wheels = root.add(new Node("Wheels"));
  for (const x of [-1.35, 1.35]) {
    for (const z of [-0.95, 0.95]) {
      const w = wheels.add(new Node("Wheel", CF.at(x, WHEEL_R, z).mul(CF.angles(0, Math.PI / 2, 0))));
      w.b.cylX("Tyre", 0.5, WHEEL_R * 2, new CF(), TIRE, "SmoothPlastic");
      w.b.cylX("Rim", 0.52, WHEEL_R * 1.1, new CF(), YEL, "Metal", { nc: true });
      for (let k = 0; k < 10; k++) w.b.box("Lug", v(0.52, 0.06, 0.12), CF.angles((k * Math.PI) / 5, 0, 0).mul(CF.at(0, WHEEL_R - 0.03, 0)), rgb(22, 22, 24), "SmoothPlastic", { nc: true, ns: true });
      w.attrs.radius = WHEEL_R;
      w.attrs.front = x > 0;
    }
  }
  // boom: pivot frame, boom along +X
  const boom = root.add(new Node("Boom", CF.from(PIVOT)));
  boom.b.box("Outer", v(BOOM0, 0.48, 0.46), CF.at(BOOM0 / 2, 0, 0), YEL, "Metal", { nc: true });
  boom.b.box("Ram", v(1.6, 0.16, 0.16), CF.at(1.0, -0.35, 0), rgb(200, 202, 206), "Metal", { nc: true });
  const inner = boom.add(new Node("Inner", new CF()));
  inner.b.box("Inner", v(BOOM0 - 0.2, 0.36, 0.34), CF.at(BOOM0 / 2 + 0.1, 0, 0), YEL, "Metal", { nc: true });
  const carriage = root.add(new Node("Carriage", new CF()));
  carriage.b.box("Plate", v(0.14, 0.9, 1.25), CF.at(0, 0.45, 0), DARK, "Metal", { nc: true });
  for (const z of [-0.38, 0.38]) {
    carriage.b.box("Fork", v(1.2, 0.05, 0.12), CF.at(0.66, 0.025, z), DARK, "Metal", { nc: true });
    carriage.b.box("Shank", v(0.06, 0.8, 0.12), CF.at(0.08, 0.4, z), DARK, "Metal", { nc: true });
  }
  return root;
}

export class Telehandler {
  constructor(game, pos, heading) {
    this.g = game;
    this.model = buildModel();
    this.pos = pos;
    this.heading = heading; // forward = (sin, 0, cos)
    this.speed = 0;
    this.steer = 0;
    this.boomAngle = -0.3;
    this.ext = 0;
    this.wheelTravel = 0;
    this.driving = false;
    this.view = "Chase";
    this.loadId = null;
    this.loadOffset = null;
    this.locked = false;
    this.tilt = new CF();
    this.owner = { kind: "machine", machine: this, name: "telehandler" };
    this.colliders = [];
    this.groundY = this.groundAt(this.pos);
    this.updateColliders();
  }

  // vehicle frame: forward along local +X
  frame() {
    return CF.at(this.pos.x, this.groundY, this.pos.z).mul(CF.angles(0, this.heading - Math.PI / 2, 0)).mul(this.tilt);
  }
  boomCf() {
    return CF.from(PIVOT).mul(CF.angles(0, 0, this.boomAngle));
  }
  // fork frame (vehicle local): carriage stays level
  forkLocal() {
    const tip = this.boomCf().point(v(BOOM0 + this.ext, -0.1, 0));
    return CF.at(tip.x + 0.2, tip.y - 0.45, tip.z - 0.35);
  }
  forkCf() {
    return this.frame().mul(this.forkLocal());
  }
  reach() {
    return Math.max(0, this.forkLocal().x - 1.35);
  }
  capacityKg() {
    return Math.min(MAX_KG, Math.floor((MAX_KG * 3.2) / Math.max(3.2, this.reach())));
  }

  load() {
    return this.loadId ? this.g.world.get(this.loadId) : null;
  }
  holds(comp) {
    return this.loadId === comp.id;
  }

  groundAt(p) {
    const hit = this.g.world.physics.raycast(v(p.x, (this.groundY ?? 0) + 1.5, p.z), v(0, -6, 0), (c) => this.solidFilter(c) && c.owner.kind !== "comp");
    return hit ? hit.pos.y : 0;
  }

  solidFilter(c) {
    const o = c.owner;
    if (!o || !c.solid || o === this.owner || o.kind === "strap") return false;
    if (o.kind === "comp") return o.state !== "Carried" && o.state !== "Rigged" && o.id !== this.loadId;
    return true;
  }

  blocked(frame) {
    const ph = this.g.world.physics;
    const f = (c) => this.solidFilter(c);
    // chassis box (raised off the ground so ramps and kerbs don't stop it)
    if (ph.overlapBox(frame.mul(CF.at(-0.1, 1.15, 0)), v(5.0, 1.3, 2.3), f).length) return true;
    const load = this.load();
    if (load && !this.locked) {
      let size = load.def.size.sub(v(0.1, 0.1, 0.1));
      size = v(Math.max(size.x, 0.05), Math.max(size.y, 0.05), Math.max(size.z, 0.05));
      const lcf = frame.mul(this.forkLocal()).mul(this.loadOffset).mul(CF.from(load.def.boundsOffset));
      if (ph.overlapBox(lcf, size, f).length) return true;
    }
    return false;
  }

  updateColliders() {
    const w = this.g.world;
    w.removeColliders(this.colliders);
    this.colliders = collidersFor(this.model.b.parts, this.frame(), this.owner);
    w.physics.addAll(this.colliders);
  }

  dispose() {
    this.g.world.removeColliders(this.colliders);
  }

  // ---------------------------------------------------------------------------
  enter() {
    const pl = this.g.player;
    if (pl.carrying) return no("Put down what you're carrying first.");
    if (this.g.crane && this.g.crane.operating) return no("Leave the crane controls first.");
    this.driving = true;
    bus.emit("event", "MachineEntered", {});
    return ok();
  }
  exit() {
    if (!this.driving) return no("Not driving.");
    this.driving = false;
    this.speed = 0;
    const out = this.frame().point(v(0, 0, -2.2));
    this.g.player.teleport(v(out.x, this.groundY + 0.05, out.z), this.heading);
    return ok();
  }
  seatPos() {
    return this.frame().point(v(-0.25, 1.85, -0.7));
  }

  pickUp() {
    if (this.load()) return this.setDown();
    const fork = this.forkCf();
    let best = null, bestD = Infinity;
    for (const c of this.g.world.records()) {
      if (c.state !== "Loose" && c.state !== "Restrained") continue;
      const centre = c.cf.mul(CF.from(c.def.boundsOffset)).pos;
      const lp = fork.pointToObj(centre);
      const halfY = c.def.size.y / 2;
      if (lp.x < 0.1 || lp.x > 2.6 || Math.abs(lp.z) > 1.4 || lp.y < -0.4 || lp.y > halfY + 1.2) continue;
      const d = Math.abs(lp.z) + Math.abs(lp.x - 0.7);
      if (d < bestD) {
        best = c;
        bestD = d;
      }
    }
    if (!best) return no("Drive the forks under a load first (lower them with F).");
    if (best.state === "Restrained") return no("Release the cargo straps on that stack first.");
    if (best.trailerId && this.g.delivery.isArriving(best.trailerId)) return no("Wait for the truck to stop.");
    const kg = best.def.weightKg;
    if (kg > this.capacityKg()) return no($fmt("Too heavy at this reach: %s, capacity %s. Retract the boom.", fmtKg(kg), fmtKg(this.capacityKg())));
    const blocker = this.g.components.stackedOnTop(best);
    if (blocker) return no("Take the " + blocker + " off the top of the stack first.");
    // seat the load on the forks: keep its pose, lift it to rest on the tines
    const local = fork.inverse().mul(best.cf);
    const bottom = this.loadBottomLocal(best.def, local);
    this.loadOffset = CF.at(0, 0.05 - bottom, 0).mul(local);
    this.loadId = best.id;
    this.locked = false;
    best.holder = "telehandler";
    best.restraint = "";
    this.g.delivery.onRemovedFromTrailer(best);
    this.g.components.setState(best, "Rigged");
    bus.emit("fx", "Rig", best.cf.pos, null);
    return ok();
  }

  loadBottomLocal(def, localCf) {
    const box = localCf.mul(CF.from(def.boundsOffset));
    const h = def.size.mul(0.5);
    let low = Infinity;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) low = Math.min(low, box.point(v(sx * h.x, sy * h.y, sz * h.z)).y);
    return low;
  }

  setDown() {
    const comp = this.load();
    if (!comp) return no("Nothing on the forks.");
    if (this.locked) {
      const done = this.g.components.fastenedCount(comp);
      if (comp.state === "Placed" && done < comp.def.minFastenRelease) return no($fmt("Fasten at least %d connection%s before backing out (%d done).", comp.def.minFastenRelease, comp.def.minFastenRelease > 1 ? "s" : "", done));
      this.release();
      return ok("Forks clear.");
    }
    const cf = comp.cf;
    const hit = this.g.world.raycast(cf.pos.add(v(0, 0.5, 0)), v(0, -40, 0), new Set([comp.id]));
    const ground = hit ? hit.pos.y : 0;
    const low = this.loadBottomLocal(comp.def, cf);
    if (low - ground > 0.45) return no("Lower the forks until the load sits on the ground or a deck.");
    const pose = this.g.components.restingPose(comp, cf.pos, yawOf(cf));
    this.release();
    comp.cf = pose;
    this.g.components.setState(comp, "Loose");
    bus.emit("fx", "Drop", pose.pos, comp.def.id);
    return ok("Load set down.");
  }

  release() {
    const l = this.load();
    if (l) l.holder = "";
    this.loadId = null;
    this.loadOffset = null;
    this.locked = false;
  }

  land() {
    const comp = this.load();
    if (!comp || this.locked) return no("No load to land.");
    const s = Rules.solve(this.g.world, comp.def, { point: comp.cf.pos }, { current: comp.cf, excludeIds: new Set([comp.id]) });
    if (!s.cf) return no(s.hint || "No connection near the load.");
    const d = s.cf.pos.dist(comp.cf.pos);
    const ang = Rules.angleDiff(comp.def, s.cf, comp.cf);
    if (d > Config.Crane.LandPosTolerance) return no($fmt("Still %.1f m from the connection — bring it closer.", d));
    if (ang > Config.Crane.LandAngleTolerance) return no("Line the load up with its connection first.");
    const r = Rules.validate(this.g.world, comp.def, s.cf, { exclude: [comp.id], excludeIds: [comp.id] });
    if (!r.ok) return no(r.reason);
    this.g.components.commitPlacement(comp, s.cf, r.info);
    this.locked = true;
    this.speed = 0;
    bus.emit("fx", "Set", s.cf.pos, comp.def.id);
    bus.emit("event", "Landed", { item: comp.def.id });
    if (this.g.components.easy()) {
      this.release();
      return ok(comp.def.name + " attached.");
    }
    return ok(comp.def.minFastenRelease > 0 ? $fmt("Landed. Fasten at least %d connection%s, then back the forks out (G).", comp.def.minFastenRelease, comp.def.minFastenRelease > 1 ? "s" : "") : "Landed — G to back the forks out.");
  }

  // ---------------------------------------------------------------------------
  update(dt, input) {
    const prev = { pos: this.pos, heading: this.heading, boomAngle: this.boomAngle, ext: this.ext, groundY: this.groundY };
    const k = (n) => !!(input && input[n]);
    const fine = k("precision") ? 0.3 : 1;
    if (this.driving && !this.locked) {
      const throttle = (k("forward") ? 1 : 0) - (k("back") ? 1 : 0);
      const target = throttle * (throttle > 0 ? 6 : 2.5) * fine;
      const accel = Math.sign(target - this.speed) === Math.sign(this.speed) || this.speed === 0 ? 2.2 : 5;
      this.speed += clamp(target - this.speed, -accel * dt, accel * dt);
      const steerIn = (k("left") ? 1 : 0) - (k("right") ? 1 : 0);
      this.steer += clamp(steerIn * 0.6 - this.steer, -1.2 * dt, 1.2 * dt);
      this.boomAngle = clamp(this.boomAngle + ((k("boomUp") ? 1 : 0) - (k("boomDown") ? 1 : 0)) * 0.22 * fine * dt, -0.36, 1.15);
      this.ext = clamp(this.ext + ((k("extend") ? 1 : 0) - (k("retract") ? 1 : 0)) * 0.9 * fine * dt, 0, MAX_EXT);
    } else {
      this.speed = 0;
    }
    // capacity limit while extending with a load
    const load = this.load();
    if (load && load.def.weightKg > this.capacityKg() && this.ext > prev.ext) {
      this.ext = prev.ext;
      this.flash = "OVERLOAD — RETRACT";
      this.flashUntil = this.g.time + 1;
    }
    if (Math.abs(this.speed) > 0.001) {
      // bicycle model, wheelbase 2.7 m
      this.heading = wrapAngle(this.heading + ((this.speed * Math.tan(this.steer)) / 2.7) * dt);
      const dir = v(Math.sin(this.heading), 0, Math.cos(this.heading));
      this.pos = this.pos.add(dir.mul(this.speed * dt));
      this.wheelTravel += this.speed * dt;
    }
    // ground following: four wheel contacts give height and tilt
    const yawCf = CF.at(this.pos.x, 0, this.pos.z).mul(CF.angles(0, this.heading - Math.PI / 2, 0));
    const hs = [[1.35, -0.95], [1.35, 0.95], [-1.35, -0.95], [-1.35, 0.95]].map(([x, z]) => this.groundAt(yawCf.point(v(x, 0, z))));
    const front = (hs[0] + hs[1]) / 2, rear = (hs[2] + hs[3]) / 2, left = (hs[0] + hs[2]) / 2, right = (hs[1] + hs[3]) / 2;
    const gy = Math.max((front + rear) / 2, Math.min(...hs));
    if (gy - prev.groundY > 0.45) {
      // too steep a step: stop
      this.pos = prev.pos;
      this.heading = prev.heading;
      this.speed = 0;
    } else {
      this.groundY = gy;
      this.tilt = CF.angles(Math.atan2(left - right, 1.9) * 0.9, 0, Math.atan2(front - rear, 2.7) * 0.9);
    }
    if (this.blocked(this.frame())) {
      Object.assign(this, { pos: prev.pos, heading: prev.heading, boomAngle: prev.boomAngle, ext: prev.ext, groundY: prev.groundY });
      if (Math.abs(this.speed) > 0.5) bus.emit("fx", "ContactLight", this.pos, null);
      this.speed = 0;
    }
    const moved = this.pos !== prev.pos || this.heading !== prev.heading;
    if (moved) this.updateColliders();
    if (load && load.state === "Rigged") {
      load.cf = this.forkCf().mul(this.loadOffset);
      this.g.components.move(load, load.cf);
    }
    this.engine = this.driving ? 0.45 + Math.min(1, Math.abs(this.speed) / 6) * 0.55 : 0;
  }

  hudData() {
    const load = this.load();
    return {
      speed: Math.abs(this.speed) * 3.6,
      boomDeg: (this.boomAngle * 180) / Math.PI,
      reach: this.reach(),
      height: this.forkCf().y - this.groundY,
      cap: this.capacityKg(),
      load: load ? load.def.name : null,
      loadKg: load ? load.def.weightKg : 0,
      locked: this.locked,
      flash: this.g.time < (this.flashUntil || 0) ? this.flash : null,
      hint: (load ? (this.locked ? "G back out after fastening" : "G set down · ENTER land on connection") : "G pick up (forks under a load)") + "\nW/S drive · A/D steer · R/F boom · Q/E telescope · Shift fine\nV camera · X leave",
    };
  }

  serialize() {
    return { pos: [this.pos.x, this.pos.y, this.pos.z], heading: this.heading, boom: this.boomAngle, ext: this.ext };
  }
  restore(s) {
    if (!s || !Array.isArray(s.pos)) return;
    this.pos = v(...s.pos);
    this.heading = s.heading || 0;
    this.boomAngle = s.boom ?? -0.3;
    this.ext = s.ext || 0;
    this.groundY = this.groundAt(this.pos);
    this.updateColliders();
  }
}
