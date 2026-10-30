// Tower crane simulation: operator controls with acceleration and braking, a
// damped pendulum for load sway (wind included), travel limits and the load
// chart, ground and collision stops, rigging, the alignment assist, landing,
// unhooking and recovery.

import { CF, V3, v, clamp, wrapAngle, rampVelocity, yawOf, fmtKg, deg } from "../core/math.js";
import { Config } from "../core/config.js";
import { $fmt } from "../core/lua.js";
import * as CM from "./craneMath.js";
import * as Rules from "./buildRules.js";
import { buildCrane } from "../world/craneModel.js";
import { collidersFor } from "../world/physics.js";
import { transportBox } from "./packing.js";
import { bus } from "../core/events.js";

const K = Config.Crane;
const ok = (msg, data) => ({ ok: true, msg, data });
const no = (msg) => ({ ok: false, msg });
const RIG_NAMES = { Bridle: "two-leg bridle", Upright: "top lug — hangs plumb", Pitch: "choker — hangs at brace angle" };

export class Crane {
  constructor(game, def) {
    this.g = game;
    this.def = def;
    this.cfg = CM.craneConfig(def);
    this.st = CM.defaultState(def);
    this.nodes = buildCrane(def);
    this.v = { slew: 0, trolley: 0, hoist: 0, rot: 0 };
    this.sv = { x: 0, z: 0 };
    this.operating = false;
    this.mode = null;
    this.view = null;
    this.assist = true;
    this.loadId = null;
    this.rigOffset = null;
    this.rigStart = null;
    this.rigTime = 0;
    this.locked = false;
    this.contactCooldown = 0;
    this.lastSolve = 0;
    this.target = null;
    this.flashText = null;
    this.flashUntil = 0;
    this.prev = { ...this.st };
    this.speeds = { slew: 0, trolley: 0, hoist: 0 };
    this.owner = { kind: "crane", crane: this, name: "tower crane" };
    // static mast colliders (+ the access gate volumes)
    this.staticColliders = this.g.world.addStatic(this.nodes.static.b.parts, new CF(), this.owner);
    this.access = this.nodes.static.b.parts.filter((p) => p.interact === "CraneAccess");
    this.slewParts = this.nodes.slew.b.parts.filter((p) => p.interact || (!p.nc && !(p.tr >= 1)));
    this.slewColliders = [];
    this.updateSlewColliders();
  }

  dispose() {
    const w = this.g.world;
    w.removeColliders(this.staticColliders);
    w.removeColliders(this.slewColliders);
  }

  updateSlewColliders() {
    const w = this.g.world;
    w.removeColliders(this.slewColliders);
    this.slewColliders = collidersFor(this.slewParts, CM.slewCf(this.cfg, this.st.slew), this.owner);
    w.physics.addAll(this.slewColliders);
  }

  load() {
    return this.loadId ? this.g.world.get(this.loadId) : null;
  }
  holds(comp) {
    return this.loadId === comp.id;
  }
  loadKg() {
    const l = this.load();
    return l ? l.def.weightKg + K.RiggingKg : 0;
  }
  hookPos(st = this.st) {
    return CM.hookPos(this.cfg, st);
  }
  rigBlend() {
    return clamp((this.g.time - this.rigTime) / 1.5, 0, 1);
  }
  // current pose of the rigged load (including the pick-up blend)
  riggedLoadCf(st = this.st) {
    if (!this.rigOffset) return null;
    const target = CM.loadCf(this.cfg, st, this.rigOffset);
    const a = this.rigBlend();
    if (this.rigStart && a < 1) {
      const e = a * a * (3 - 2 * a);
      return this.rigStart.lerp(target, e);
    }
    return target;
  }
  flash(text) {
    this.flashText = text;
    this.flashUntil = this.g.time + 1.2;
  }

  // ---------------------------------------------------------------------------
  // Operator entry / exit
  // ---------------------------------------------------------------------------
  nearAccess(pos) {
    return this.access.some((p) => p.cf.pos.dist(pos) <= Config.Reach.CraneCab + p.size.len / 2);
  }

  enter(mode) {
    const pl = this.g.player;
    if (pl.carrying) return no("Put down what you're carrying first.");
    if (mode === "Remote") {
      if (pl.tool !== "TL-REMOTE") return no("Equip the crane radio remote (5).");
    } else if (!this.nearAccess(pl.rootPos())) {
      // the cab door itself also counts
      return no("Go to the crane access gate at the mast base (or climb to the top).");
    }
    this.operating = true;
    this.mode = mode;
    this.view = mode === "Cab" ? "Cab" : "Player";
    this.assist = this.g.settings.assist !== false;
    this.v = { slew: 0, trolley: 0, hoist: 0, rot: 0 };
    bus.emit("crane", "enter", this);
    return ok(null, { mode });
  }

  exit() {
    if (!this.operating) return no("Not operating a crane.");
    const mode = this.mode;
    this.operating = false;
    this.mode = null;
    this.target = null;
    if (mode === "Cab") {
      const base = this.cfg.base;
      this.g.player.teleport(base.add(v(0, 0.4, -(CM.MastWidth / 2 + 1.667))), 0);
    }
    bus.emit("crane", "exit", this);
    return ok();
  }

  cabSeatCf() {
    return CM.slewCf(this.cfg, this.st.slew).mul(CF.from(CM.CabOffset)).mul(CF.at(0.067, -0.2, 0)).mul(CF.angles(0, -Math.PI / 2, 0));
  }

  // ---------------------------------------------------------------------------
  // Rigging
  // ---------------------------------------------------------------------------
  attachCandidate(st = this.st) {
    const hook = this.hookPos(st);
    let best = null, bestD = Infinity;
    for (const c of this.g.world.records()) {
      if (c.state !== "Loose" && c.state !== "Restrained") continue;
      const lift = c.cf.point(CM.liftCentre(c.def)).add(v(0, K.SlingDrop, 0));
      const d = lift.dist(hook);
      if (d < bestD) {
        best = c;
        bestD = d;
      }
    }
    if (best && bestD <= K.AttachRange + 0.5) return { comp: best, d: bestD };
    return { comp: null, d: bestD };
  }

  attach(comp) {
    if (!this.operating) return no("You're not at the crane controls.");
    if (this.loadId) return no("Something is already on the hook.");
    if (!comp) return no("Nothing to hook.");
    const def = comp.def;
    if (comp.state === "Restrained") return no("Release the cargo straps on that stack first.");
    if (comp.state !== "Loose") return no("Only loose materials can be rigged.");
    if (comp.trailerId && this.g.delivery.isArriving(comp.trailerId)) return no("Wait for the truck to stop.");
    const hook = this.hookPos();
    const liftWorld = comp.cf.point(CM.liftCentre(def));
    const target = liftWorld.add(v(0, K.SlingDrop, 0));
    let spread = 0;
    for (const p of def.liftPoints) spread = Math.max(spread, p.dist(CM.liftCentre(def)));
    if (hook.dist(target) > K.AttachRange + 0.5 + spread * 0.25) return no("Bring the hook over the rigging points first.");
    const wind = this.g.site.wind.speed;
    if (wind > K.WindStopMs) return no($fmt("Wind %.0f m/s — above the %d m/s lifting limit. Wait for it to drop.", wind, K.WindStopMs));
    const kg = def.weightKg + K.RiggingKg;
    const cap = CM.capacityKg(this.cfg, this.st.trolley);
    if (kg > cap) return no($fmt("Over the load chart: %s at this radius, capacity %s. Trolley in closer.", fmtKg(kg), fmtKg(cap)));
    const blocker = this.g.components.stackedOnTop(comp);
    if (blocker) return no("Take the " + blocker + " off the top of the stack first.");
    const hookCf = CM.hookCf(this.cfg, this.st);
    this.rigOffset = CM.rigOffset(def, comp.cf, hookCf);
    this.st.loadYaw = 0;
    this.loadId = comp.id;
    this.rigTime = this.g.time;
    this.rigStart = comp.cf;
    this.locked = false;
    comp.restraint = "";
    this.g.delivery.onRemovedFromTrailer(comp);
    comp.holder = "crane";
    this.g.components.setState(comp, "Rigged");
    bus.emit("fx", "Rig", liftWorld, null);
    return ok();
  }

  unrig() {
    const l = this.load();
    if (l) l.holder = "";
    this.loadId = null;
    this.rigOffset = null;
    this.rigStart = null;
    this.locked = false;
  }

  land(target) {
    if (!this.operating) return no("You're not at the crane controls.");
    const comp = this.load();
    if (!comp || this.locked) return no("No hanging load to land.");
    if (this.g.time - this.rigTime < 1.4) return no("Let the load settle on the slings first.");
    const def = comp.def;
    const loadCf = this.riggedLoadCf();
    const dPos = target.pos.dist(loadCf.pos);
    const ang = Rules.angleDiff(def, target, loadCf);
    if (dPos > K.LandPosTolerance) return no($fmt("Still %.1f m from the connection — bring it closer.", dPos));
    if (ang > K.LandAngleTolerance) return no($fmt("Rotate the load to line up (%d° off).", Math.floor(deg(ang) + 0.5)));
    const r = Rules.validate(this.g.world, def, target, { exclude: [comp.id], excludeIds: [comp.id] });
    if (!r.ok) return no(r.reason);
    this.g.components.commitPlacement(comp, target, r.info);
    this.locked = true;
    this.st.swingX = this.st.swingZ = 0;
    this.sv = { x: 0, z: 0 };
    this.v = { slew: 0, trolley: 0, hoist: 0, rot: 0 };
    bus.emit("fx", "Set", target.pos, def.id);
    const need = def.minFastenRelease;
    if (need > 0) bus.emit("notify", $fmt("Landed. Fasten at least %d connection%s, then unhook (G).", need, need > 1 ? "s" : ""), "info");
    return ok();
  }

  bottomY(def, cf) {
    const box = cf.mul(CF.from(def.boundsOffset));
    const h = def.size.mul(0.5);
    let low = Infinity;
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) low = Math.min(low, box.point(v(sx * h.x, sy * h.y, sz * h.z)).y);
    return low;
  }

  release() {
    if (!this.operating) return no("You're not at the crane controls.");
    const comp = this.load();
    if (!comp) {
      this.unrig();
      return no("Nothing on the hook.");
    }
    const def = comp.def;
    if (this.locked) {
      const done = this.g.components.fastenedCount(comp);
      if (comp.state === "Placed" && done < def.minFastenRelease) {
        return no($fmt("Fasten at least %d connection%s before unhooking (%d done).", def.minFastenRelease, def.minFastenRelease > 1 ? "s" : "", done));
      }
      this.unrig();
      bus.emit("fx", "Unhook", comp.cf.pos, null);
      return ok("Rigging released.");
    }
    const loadCf = this.riggedLoadCf();
    const hit = this.g.world.raycast(loadCf.pos.add(v(0, 0.667, 0)), v(0, -66, 0), new Set([comp.id]));
    const groundY = hit ? hit.pos.y : 0;
    if (this.bottomY(def, loadCf) - groundY > 0.533) return no("Lower it until it sits on the ground or a deck before unhooking.");
    const pose = this.g.components.restingPose(comp, loadCf.pos, yawOf(CF.angles(0, this.st.slew + this.st.loadYaw, 0)));
    this.unrig();
    comp.cf = pose;
    this.g.components.setState(comp, "Loose");
    bus.emit("fx", "Drop", pose.pos, def.id);
    return ok("Load set down.");
  }

  recoveryPose(comp) {
    const site = this.g.siteDef;
    const ld = site.laydownM;
    const c = ld.center;
    const comps = this.g.components;
    const { box, offset } = transportBox(comp.def);
    for (let gz = -ld.size.z / 2 + 0.667; gz <= ld.size.z / 2 - 0.667; gz += 1) {
      for (let gx = -ld.size.x / 2 + 0.667; gx <= ld.size.x / 2 - 0.667; gx += 1) {
        const pose = comps.restingPose(comp, c.add(v(gx, 0, gz)), 0);
        const clear = this.g.world.physics.overlapBox(CF.from(pose.pos.add(offset)), box.sub(v(0.067, 0.067, 0.067)), (col) => col.solid && col.owner && col.owner !== comp && col.name !== "Dunnage" && (col.owner.kind === "comp" || col.owner.kind === "env")).length === 0;
        if (clear) return pose;
      }
    }
    return comps.restingPose(comp, c, 0);
  }

  recover() {
    const comp = this.load();
    let msg = "Hook recovered.";
    if (comp) {
      if (comp.state !== "Installed") {
        comp.cf = this.recoveryPose(comp);
        comp.fastened = "0".repeat(comp.def.fasteners.length);
        comp.supportedBy = [];
        this.g.components.setState(comp, "Loose");
        msg = comp.def.name + " returned to the laydown yard.";
      }
      this.unrig();
    }
    this.st.hoist = Math.min(this.st.hoist, 8);
    this.st.swingX = this.st.swingZ = this.st.loadYaw = 0;
    this.sv = { x: 0, z: 0 };
    this.v = { slew: 0, trolley: 0, hoist: 0, rot: 0 };
    return ok(msg);
  }

  onComponentInstalled(comp) {
    if (this.loadId === comp.id && this.operating) bus.emit("notify", "All connections made — unhook with G.", "success");
  }

  // ---------------------------------------------------------------------------
  // Simulation
  // ---------------------------------------------------------------------------
  blocked(st, load, skipLoad) {
    const w = this.g.world;
    const hits = (cf, size) =>
      w.physics.overlapBox(cf, size, (c) => {
        const o = c.owner;
        if (!c.solid || !o) return false;
        if (o === load || o.kind === "strap" || o.kind === "sur" || c.fastener) return false;
        if (o.kind === "crane") return this.staticColliders.includes(c);
        if (o.kind === "comp") return o.state !== "Carried" && o.state !== "Rigged";
        return true;
      }).length > 0;
    const hookCf = CM.blockCf(this.cfg, st);
    if (hits(hookCf.mul(CF.at(0, 0.4, 0)), v(0.4, 1.133, 0.533))) return true;
    if (load && !skipLoad) {
      const cf = this.riggedLoadCf(st);
      if (cf) {
        let size = load.def.size.sub(v(0.167, 0.167, 0.167));
        size = v(Math.max(size.x, 0.033), Math.max(size.y, 0.033), Math.max(size.z, 0.033));
        if (hits(cf.mul(CF.from(load.def.boundsOffset)), size)) return true;
      }
    }
    return false;
  }

  groundClearance(st, load) {
    let bottom, origin;
    if (load) {
      const cf = this.riggedLoadCf(st);
      bottom = this.bottomY(load.def, cf);
      origin = cf.mul(CF.from(load.def.boundsOffset)).pos;
    } else {
      const hp = this.hookPos(st);
      bottom = hp.y - 0.2;
      origin = hp;
    }
    const hit = this.g.world.physics.raycast(origin.add(v(0, 0.667, 0)), v(0, -140, 0), (c) => {
      const o = c.owner;
      if (!o || o === load || o.kind === "crane" || o.kind === "strap") return false;
      if (o.kind === "comp") return o.state !== "Carried" && o.state !== "Rigged";
      return true;
    });
    const surface = hit ? hit.pos.y : -20;
    return bottom - surface;
  }

  update(dt, input) {
    dt = Math.min(dt, 1 / 20);
    if (!this.operating) {
      this.speeds = { slew: 0, trolley: 0, hoist: 0 };
      this.prev = { ...this.st };
      return;
    }
    const st = this.st;
    const cfg = this.cfg;
    const load = this.load();
    const hanging = load && load.state === "Rigged";
    const blending = hanging && this.rigBlend() < 1;
    const key = (k) => !!input && !!input[k];
    const prec = key("precision") ? K.PrecisionFactor : 1;
    let slewIn = (key("slewLeft") ? 1 : 0) - (key("slewRight") ? 1 : 0);
    let trolleyIn = (key("trolleyOut") ? 1 : 0) - (key("trolleyIn") ? 1 : 0);
    let hoistIn = (key("lower") ? 1 : 0) - (key("raise") ? 1 : 0);
    let rotIn = (key("rotLeft") ? 1 : 0) - (key("rotRight") ? 1 : 0);
    if (this.locked) slewIn = trolleyIn = rotIn = hoistIn = 0;
    const hoistMax = hanging ? K.HoistLoadedSpeed : K.HoistMaxSpeed;
    const vel = this.v;
    const oldV = { slew: vel.slew, trolley: vel.trolley };
    vel.slew = rampVelocity(vel.slew, slewIn * K.SlewMaxSpeed * prec, K.SlewAccel, K.SlewBrake, dt);
    vel.trolley = rampVelocity(vel.trolley, trolleyIn * K.TrolleyMaxSpeed * prec, K.TrolleyAccel, K.TrolleyBrake, dt);
    vel.hoist = rampVelocity(vel.hoist, hoistIn * hoistMax * prec, K.HoistAccel, K.HoistBrake, dt);
    vel.rot = rampVelocity(vel.rot, rotIn * K.LoadRotateSpeed * prec, K.LoadRotateSpeed * 2, K.LoadRotateSpeed * 3, dt);

    // brake clunk when a fast motion is released
    const fast = Math.abs(oldV.slew) > K.SlewMaxSpeed * 0.5 || Math.abs(oldV.trolley) > K.TrolleyMaxSpeed * 0.5;
    if (fast && slewIn === 0 && trolleyIn === 0 && !this.braked) {
      this.braked = true;
      bus.emit("fx", "CraneBrake", CM.slewCf(cfg, st.slew).pos, null);
    } else if (slewIn !== 0 || trolleyIn !== 0) this.braked = false;

    const prev = { ...st };
    st.slew = wrapAngle(st.slew + vel.slew * dt);
    st.trolley += vel.trolley * dt;
    st.hoist += vel.hoist * dt;
    st.loadYaw = wrapAngle(st.loadYaw + vel.rot * dt);

    // travel limits and load chart
    let maxR = cfg.maxR;
    let kg = 0;
    if (hanging) {
      kg = load.def.weightKg + K.RiggingKg;
      maxR = Math.min(maxR, CM.maxRadiusFor(cfg, kg));
    }
    if (st.trolley > maxR) {
      if (vel.trolley > 0 && kg > 0) this.flash("LOAD MOMENT LIMIT");
      st.trolley = Math.max(maxR, Math.min(prev.trolley, maxR));
      vel.trolley = Math.min(vel.trolley, 0);
    } else if (st.trolley < cfg.minR) {
      st.trolley = cfg.minR;
      vel.trolley = Math.max(vel.trolley, 0);
    }
    if (st.hoist < cfg.minRope) {
      st.hoist = cfg.minRope;
      vel.hoist = Math.max(vel.hoist, 0);
    } else if (st.hoist > cfg.maxRope) {
      st.hoist = cfg.maxRope;
      vel.hoist = Math.min(vel.hoist, 0);
    }

    // pendulum sway in the jib frame (small-angle model, real g)
    if (this.locked) {
      st.swingX = st.swingZ = 0;
      this.sv = { x: 0, z: 0 };
    } else {
      const L = Math.max(st.hoist + (hanging ? K.SlingDrop : 0), 0.667);
      const g = K.PendulumGravity;
      const damping = this.assist ? K.SwingDampingAssist : K.SwingDamping;
      let aRad = (vel.trolley - oldV.trolley) / dt - vel.slew * vel.slew * st.trolley;
      let aTan = -((vel.slew - oldV.slew) / dt) * st.trolley;
      const wind = this.g.site.wind;
      if (wind.speed > 0) {
        const hookY = this.hookPos(st).y;
        const exposure = clamp(hookY / 40, 0.3, 1.5);
        let sail = 0.6;
        if (hanging) {
          const area = load.def.sizeM.x * Math.max(load.def.sizeM.y, load.def.sizeM.z);
          sail = clamp(0.4 + area / Math.max(load.def.weightKg / 120, 0.5), 0.4, 3);
        }
        const t = this.g.time;
        const gust = 0.85 + 0.3 * (0.5 + 0.5 * Math.sin(t * 0.7 + wind.dir * 3) * Math.sin(t * 1.9 + 1.3));
        const push = K.WindForce * wind.speed * wind.speed * exposure * sail * gust;
        const wl = CM.slewCf(cfg, st.slew).vecToObj(v(Math.cos(wind.dir), 0, Math.sin(wind.dir)));
        aRad -= wl.x * push;
        aTan -= wl.z * push;
      }
      const steps = 4;
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        const ax = -(g / L) * st.swingX - aRad - damping * this.sv.x;
        const az = -(g / L) * st.swingZ - aTan - damping * this.sv.z;
        this.sv.x += ax * h;
        this.sv.z += az * h;
        st.swingX += this.sv.x * h;
        st.swingZ += this.sv.z * h;
      }
    }
    CM.sanitize(cfg, st);

    // ground / deck stop while lowering
    if (vel.hoist > 0) {
      const clearance = this.groundClearance(st, hanging ? load : null);
      if (clearance < 0.05) {
        st.hoist = Math.max(cfg.minRope, st.hoist - (0.05 - clearance));
        vel.hoist = 0;
      }
    }

    // collision stop
    this.contactCooldown -= dt;
    if (!blending && this.blocked(st, hanging ? load : null)) {
      if (!this.blocked(prev, hanging ? load : null)) {
        Object.assign(st, { slew: prev.slew, trolley: prev.trolley, hoist: prev.hoist, loadYaw: prev.loadYaw, swingX: prev.swingX, swingZ: prev.swingZ });
        this.sv = { x: -this.sv.x * 0.3, z: -this.sv.z * 0.3 };
        this.v = { slew: 0, trolley: 0, hoist: 0, rot: 0 };
        if (this.contactCooldown <= 0) {
          this.contactCooldown = 0.6;
          this.flash("CONTACT");
          bus.emit("fx", hanging ? "ContactHeavy" : "ContactLight", hanging ? load.cf.pos : this.hookPos(st), null);
        }
      }
    }

    // motor speeds for audio
    this.speeds = {
      slew: Math.abs(wrapAngle(st.slew - this.prev.slew)) / dt / K.SlewMaxSpeed,
      trolley: Math.abs(st.trolley - this.prev.trolley) / dt / K.TrolleyMaxSpeed,
      hoist: Math.abs(st.hoist - this.prev.hoist) / dt / K.HoistMaxSpeed,
    };
    this.prev = { ...st };
    if (Math.abs(vel.slew) > 1e-4) this.updateSlewColliders();
    this.updateAssist(hanging ? load : null);
  }

  // pose the rigged load each frame (whether or not anyone is operating)
  postUpdate() {
    const load = this.load();
    if (load && load.state === "Rigged") {
      const cf = this.riggedLoadCf();
      if (cf) this.g.components.move(load, cf);
    }
  }

  updateAssist(load) {
    if (!(this.assist && load && !this.locked)) {
      this.target = null;
      return;
    }
    if (this.g.time - this.lastSolve < 0.12) return;
    this.lastSolve = this.g.time;
    const loadCf = this.riggedLoadCf();
    const s = Rules.solve(this.g.world, load.def, { point: loadCf.pos }, { current: loadCf, excludeIds: new Set([load.id]) });
    if (!s.cf) {
      this.target = { cf: null, valid: false, reason: s.hint, def: load.def };
      return;
    }
    const r = Rules.validate(this.g.world, load.def, s.cf, { exclude: [load.id], excludeIds: [load.id] });
    this.target = { cf: s.cf, valid: r.ok, reason: r.reason, def: load.def };
  }

  landNow() {
    const load = this.load();
    if (!load || load.state !== "Rigged") return no("Nothing hanging to land.");
    const loadCf = this.riggedLoadCf();
    const s = Rules.solve(this.g.world, load.def, { point: loadCf.pos }, { current: loadCf, excludeIds: new Set([load.id]) });
    if (!s.cf) return no(s.hint || "No connection near the load.");
    return this.land(s.cf);
  }

  hookOrRelease() {
    if (this.load()) return this.release();
    const cand = this.attachCandidate();
    if (!cand.comp) return no("Bring the hook down over a load's rigging points first.");
    const r = this.attach(cand.comp);
    if (r.ok) bus.emit("fx", "SlingRattle", cand.comp.cf.pos, null);
    return r;
  }

  guidance(loadCf, target, def) {
    const slew = CM.slewCf(this.cfg, this.st.slew);
    const delta = target.pos.sub(loadCf.pos);
    const lv = slew.vecToObj(delta);
    const lines = [];
    if (Math.abs(lv.x) > 0.05) lines.push($fmt("TROLLEY %s  %.2f m   (%s)", lv.x > 0 ? "OUT" : "IN", Math.abs(lv.x), lv.x > 0 ? "W" : "S"));
    if (Math.abs(lv.z) > 0.05) lines.push($fmt("SLEW %s  %.2f m   (%s)", lv.z > 0 ? "RIGHT" : "LEFT", Math.abs(lv.z), lv.z > 0 ? "D" : "A"));
    if (Math.abs(delta.y) > 0.05) lines.push($fmt("%s  %.2f m   (%s)", delta.y < 0 ? "LOWER" : "RAISE", Math.abs(delta.y), delta.y < 0 ? "F" : "R"));
    let yawErr = wrapAngle(yawOf(target) - yawOf(loadCf));
    if (def.symmetric180 && Math.abs(yawErr) > Math.PI / 2) yawErr = wrapAngle(yawErr + Math.PI);
    if (Math.abs(yawErr) > (2 * Math.PI) / 180) lines.push($fmt("ROTATE %s  %d°   (%s)", yawErr > 0 ? "LEFT" : "RIGHT", Math.floor(deg(Math.abs(yawErr)) + 0.5), yawErr > 0 ? "Z" : "C"));
    const ang = Rules.angleDiff(def, target, loadCf);
    const ready = delta.len <= K.LandPosTolerance && ang <= K.LandAngleTolerance;
    if (ready) lines.unshift("ALIGNED — press ENTER to land and secure");
    return { text: lines.join("\n"), ready };
  }

  hudData(precision) {
    const st = this.st, cfg = this.cfg;
    const load = this.load();
    const hanging = load && load.state === "Rigged";
    const kg = load ? load.def.weightKg + K.RiggingKg : 0;
    const cap = CM.capacityKg(cfg, st.trolley);
    const d = {
      mode: this.mode,
      view: this.view,
      assist: this.assist,
      radiusM: st.trolley,
      heightM: this.hookPos().y,
      slewDeg: deg(st.slew),
      loadName: load ? load.def.name : null,
      loadKg: kg,
      capKg: cap,
      lmi: kg / Math.max(cap, 1),
      precision,
      windMs: this.g.site.wind.speed,
      flash: this.g.time < this.flashUntil ? this.flashText : null,
    };
    if (this.locked && load) {
      const done = this.g.components.fastenedCount(load);
      const need = load.def.minFastenRelease;
      if (load.state === "Installed" || done >= need) {
        d.guide = "Connections made. G — unhook.";
        d.guideReady = true;
      } else {
        d.guide = $fmt("Crane is holding the piece in place.\nFasten %d connection%s (%d/%d done), then unhook with G.\nTip: use the radio remote from the steel or scaffold.", need, need > 1 ? "s" : "", done, need);
      }
    } else if (hanging) {
      d.guide = "Rigging: " + (RIG_NAMES[load.def.rigging] || load.def.rigging);
      if (this.assist && this.target && this.target.cf) {
        const g = this.guidance(this.riggedLoadCf(), this.target.cf, load.def);
        d.guide = (this.target.valid ? "" : "✕ " + (this.target.reason || "") + "\n") + g.text;
        d.guideReady = g.ready && this.target.valid;
      } else if (this.assist && this.target && this.target.reason) {
        d.guide = this.target.reason;
      }
    } else {
      const cand = this.attachCandidate();
      if (cand.comp) {
        if (cand.comp.state === "Restrained") d.guide = cand.comp.def.name + " — release its cargo straps first.";
        else {
          d.guide = "G — hook " + cand.comp.def.name + "\n(" + (RIG_NAMES[cand.comp.def.rigging] || cand.comp.def.rigging) + ", " + fmtKg(cand.comp.def.weightKg) + ")";
          d.guideReady = true;
        }
      } else {
        d.guide = cand.d < 13 ? $fmt("Nearest load %.1f m from the hook", cand.d) : "Hook free";
      }
    }
    const hints = [];
    if (hanging) hints.push("ENTER land · G set down on ground");
    hints.push("WASD slew/trolley · R/F hoist · Z/C rotate · Shift fine");
    hints.push("H assist · V camera · X exit · hold Y recover");
    d.hint = hints.join("\n");
    return d;
  }

  serialize() {
    return { slew: this.st.slew, trolley: this.st.trolley, hoist: this.st.hoist };
  }
  restore(s) {
    if (!s) return;
    this.st.slew = Number(s.slew) || this.st.slew;
    this.st.trolley = Number(s.trolley) || this.st.trolley;
    this.st.hoist = Number(s.hoist) || this.st.hoist;
    CM.sanitize(this.cfg, this.st);
    this.updateSlewColliders();
  }
}
