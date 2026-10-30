// On-foot interaction: what the crosshair is on, contextual prompts, picking
// up, releasing straps, entering the crane, releasing trucks, switching
// equipment, hold-to-fasten / hold-to-dismantle with the equipped tool, hand
// placement with a snapping ghost, and concrete pouring.

import * as THREE from "three";
import { CF, V3, v, VY, fmtKg } from "../core/math.js";
import { Config } from "../core/config.js";
import { $fmt } from "../core/lua.js";
import { input } from "../core/input.js";
import { bus } from "../core/events.js";
import { Registry } from "../data/items.js";
import * as Rules from "../sim/buildRules.js";
import { itemVariant } from "../render/siteView.js";
import { getGhostMaterial } from "../render/materials.js";

const HOLD_TIME = { Bolt: 0.55, Wedge: 0.35, Weld: 0.9, Screed: 0.8, Dismantle: 1.2 };
const TOOL_NAME = { Bolt: "impact wrench (2)", Wedge: "scaffold hammer (3)", Weld: "welder (4)", Screed: "trowel (7)" };
const VERB = { Weld: "Weld", Wedge: "Drive wedge", Screed: "Trowel finish", Bolt: "Tighten bolt" };
const POUR_TIME = 2.5;

export class Interaction {
  constructor(game, renderer, controller) {
    this.g = game;
    this.r = renderer;
    this.ctrl = controller;
    this.target = null;
    this.hold = null;
    this.placement = { rot: 0, free: false, nudge: v(), last: null };
    this.pour = { target: null, holdStart: null };
    this.ghost = null;
    this.ghostKey = null;
    this.solveAcc = 0;
    // fastener markers
    const geo = new THREE.SphereGeometry(0.07, 10, 8);
    this.markerMat = new THREE.MeshBasicMaterial({ color: 0xffc20e, depthTest: false, transparent: true, opacity: 0.9 });
    this.markers = new THREE.InstancedMesh(geo, this.markerMat, 512);
    this.markers.count = 0;
    this.markers.renderOrder = 10;
    this.markers.frustumCulled = false;
    renderer.scene.add(this.markers);
    this.hover = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), new THREE.MeshBasicMaterial({ color: 0xece9e2, depthTest: false, transparent: true }));
    this.hover.renderOrder = 11;
    this.hover.visible = false;
    renderer.scene.add(this.hover);
    this.markerList = [];
    this.markerAcc = 0;

    bus.on("key", (code) => this.onKey(code));
    bus.on("mouse", (b) => this.onMouse(b));
    bus.on("mouseup", (b) => {
      if (b === 0) {
        if (this.hold && this.hold.kind === "Fasten") this.cancelHold();
        this.pour.holdStart = null;
      }
    });
    bus.on("keyup", (code) => {
      if (code === "KeyX" && this.hold && this.hold.kind === "Dismantle") this.cancelHold();
    });
    bus.on("carry", () => this.clearGhost());
  }

  active() {
    const g = this.g;
    return g.mode === "Play" && !input.blocked && !(g.crane && g.crane.operating);
  }
  reach() {
    return Config.Reach.Interact;
  }
  root() {
    return this.g.player.rootPos();
  }

  // ray from the camera
  cast(maxDist, exclude) {
    const cam = this.r.camera;
    const o = cam.position;
    const d = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const pl = this.g.player;
    return this.g.world.physics.raycast(v(o.x, o.y, o.z), v(d.x, d.y, d.z).mul(maxDist), (c) => {
      const ow = c.owner;
      if (!ow) return false;
      if (ow.kind === "comp") return ow !== pl.carrying && ow.state !== "Carried" && !(exclude && exclude.has(ow.id));
      return true;
    });
  }

  resolve(hit) {
    if (!hit) return null;
    const o = hit.owner;
    const base = { pos: hit.pos, dist: hit.dist, hit };
    if (!o || o === "terrain") return null;
    if (o.kind === "strap") return { ...base, kind: "Strap", strap: o.strap, trailer: o.trailer };
    if (o.kind === "crane" && hit.col.interact) return { ...base, kind: "Crane" };
    if (o.kind === "trailer" && hit.col.interact) return { ...base, kind: "Truck", trailer: o.trailer };
    if (o.kind === "comp") return { ...base, kind: "Component", rec: o };
    return null;
  }

  nearestFastener(rec, point, ftype) {
    let best = null, bestD = 0.733;
    rec.def.fasteners.forEach((f, i) => {
      if (rec.fastened[i] === "1" || (ftype && f.type !== ftype)) return;
      const p = rec.cf.point(f.pos);
      const d = p.dist(point);
      if (d < bestD) {
        best = { index: i, pos: p, type: f.type };
        bestD = d;
      }
    });
    return best;
  }

  toolFastens() {
    const def = Registry.get(this.g.player.tool);
    return def && def.fastens;
  }

  buildPrompt() {
    const t = this.target;
    if (!t) return null;
    const list = [];
    const carrying = !!this.g.player.carrying;
    const within = (pos, extra = 0) => this.root().dist(pos) <= Config.Reach.Interact + extra;
    if (t.kind === "Strap") {
      if (within(t.pos, 1)) list.push({ key: "E", text: "Release ratchet strap", sub: "Frees every piece in this stack" });
      else list.push({ text: "Ratchet strap", sub: "Move closer to release", disabled: true });
    } else if (t.kind === "Crane") {
      list.push({ key: "E", text: "Climb into the crane cab", sub: "Or operate from the ground with the radio remote (5)" });
    } else if (t.kind === "Truck") {
      const tr = t.trailer;
      if (tr.empty) list.push({ key: "E", text: tr.kind === "rail" ? "Release the empty railcar" : "Release the empty truck", sub: "Frees the unloading bay" });
      else list.push({ text: (tr.kind === "rail" ? "Railcar — siding " : "Delivery truck — bay ") + tr.bay, sub: tr.remaining + " pieces still on the deck", disabled: true });
    } else if (t.kind === "Component") {
      const rec = t.rec, def = rec.def;
      const sub = `${fmtKg(def.weightKg)}  ·  ${def.handling}`;
      if (rec.state === "Restrained") list.push({ text: def.name, sub: "Secured by cargo straps — release the strap first", disabled: true });
      else if (rec.state === "Loose") {
        const wc = Config.WeightClasses[def.weightClass];
        if (wc.carry && !carrying) list.push({ key: "E", text: "Pick up " + def.name, sub });
        else if (!wc.carry) list.push({ text: def.name, sub: "Heavy — rig it with the crane (" + fmtKg(def.weightKg) + ")", disabled: true });
      } else if (rec.state === "Placed") {
        const need = def.fasteners[0] && def.fasteners[0].type;
        const ft = this.toolFastens();
        const done = [...rec.fastened].filter((c) => c === "1").length;
        const progress = `${done} / ${def.fasteners.length} connections made`;
        if (ft && ft === need) {
          const f = this.nearestFastener(rec, t.pos, ft);
          if (f) list.push({ key: "Hold LMB", text: VERB[ft] || "Fasten", sub: def.name + "  ·  " + progress });
          else list.push({ text: "Aim at a yellow connection marker", sub: def.name + "  ·  " + progress, disabled: true });
        } else {
          list.push({ text: def.name + " — not fastened", sub: "Equip the " + (TOOL_NAME[need] || "right tool") + "  ·  " + progress, disabled: true, warn: true });
        }
      } else if (rec.state === "Installed") {
        list.push({ text: def.name, sub: "Installed" });
        if (!carrying) list.push({ key: "Hold X", text: "Dismantle", sub: def.fasteners.length ? "Needs the " + (TOOL_NAME[def.fasteners[0].type] || "tool") : null });
      } else if (rec.state === "Rigged") {
        list.push({ text: def.name, sub: "On the crane hook", disabled: true });
      }
      if (def.functional && (rec.state === "Installed" || rec.state === "Loose")) list.push({ key: "F", text: rec.on ? "Switch off" : "Switch on" });
    }
    return list;
  }

  report(r) {
    if (r && !r.ok && r.msg) bus.emit("notify", r.msg, "warn");
    else if (r && r.ok && r.msg) bus.emit("notify", r.msg, "info");
    return r;
  }

  onKey(code) {
    if (!this.active()) return;
    const g = this.g, pl = g.player;
    if (pl.carrying) return this.placementKey(code);
    const t = this.target;
    if (code === "KeyE" && t) {
      if (t.kind === "Strap") this.report(g.delivery.releaseStrap(t.strap, t.trailer));
      else if (t.kind === "Crane") {
        const r = this.report(g.crane.enter("Cab"));
        if (r.ok) bus.emit("crane", "start", g.crane);
      } else if (t.kind === "Truck" && t.trailer.empty) this.report(g.delivery.dismiss(t.trailer));
      else if (t.kind === "Component" && t.rec.state === "Loose" && Config.WeightClasses[t.rec.def.weightClass].carry) {
        const r = this.report(g.components.pickUp(t.rec));
        if (r.ok) bus.emit("sfx", "PickUp", t.rec.cf.pos);
      }
    } else if (code === "KeyF" && t && t.kind === "Component" && t.rec.def.functional) {
      this.report(g.components.toggle(t.rec));
    } else if (code === "KeyX") {
      this.startHold("Dismantle");
    }
  }

  onMouse(b) {
    if (!this.active() || b !== 0) return;
    const pl = this.g.player;
    if (pl.carrying) return this.placeNow();
    if (pl.tool === "TL-POUR") {
      const t = this.pour.target;
      if (t && t.valid) {
        this.pour.holdStart = this.g.time;
        bus.emit("fx", "PourStart", t.cf.pos, null);
      } else if (t) bus.emit("notify", t.reason || "Can't pour here.", "warn");
      return;
    }
    this.startHold("Fasten");
  }

  startHold(kind) {
    const t = this.target;
    if (!t || t.kind !== "Component") return;
    const rec = t.rec;
    if (kind === "Fasten") {
      const ft = this.toolFastens();
      if (!ft || rec.state !== "Placed") return;
      const f = this.nearestFastener(rec, t.pos, ft);
      if (!f) return;
      this.hold = { kind, id: rec.id, rec, index: f.index, pos: f.pos, start: this.g.time, duration: HOLD_TIME[ft] || 0.6, ftype: ft };
      bus.emit("tooluse", ft, true, f.pos);
    } else {
      if (rec.state !== "Installed" && rec.state !== "Placed") return;
      this.hold = { kind, id: rec.id, rec, start: this.g.time, duration: HOLD_TIME.Dismantle };
    }
  }

  cancelHold() {
    if (this.hold && this.hold.ftype) bus.emit("tooluse", this.hold.ftype, false, null);
    this.hold = null;
    bus.emit("hold", null);
  }

  finishHold() {
    const h = this.hold;
    this.cancelHold();
    if (h.kind === "Fasten") {
      const r = this.report(this.g.components.fasten(h.rec, h.index));
      // keep going on the next marker while the button stays down
      if (r.ok && input.button(0)) setTimeout(() => this.active() && input.button(0) && this.startHold("Fasten"), 100);
    } else {
      this.report(this.g.components.dismantle(h.rec));
    }
  }

  // ---------------------------------------------------------------------------
  // Placement (carried item)
  // ---------------------------------------------------------------------------
  placementKey(code) {
    const P = this.placement;
    const def = this.g.player.carrying.def;
    if (code === "KeyR") P.rot += P.free ? 90 / Config.Grid.FreeRotateStep : 1;
    else if (code === "KeyZ") P.rot -= 1;
    else if (code === "KeyC") P.rot += 1;
    else if (code === "KeyT") {
      if (def.allowFree) {
        P.free = !P.free;
        P.nudge = v();
      } else bus.emit("notify", "Free placement is only for props and equipment — structure snaps to its connections.", "info");
    } else if (code === "KeyG") {
      this.report(this.g.components.dropCarried());
    } else if (P.free && code.startsWith("Arrow")) {
      const step = input.held("ShiftLeft") ? 0.5 : Config.Grid.Fine;
      const yaw = this.g.player.yaw;
      const fwd = v(-Math.sin(yaw), 0, -Math.cos(yaw));
      const right = v(Math.cos(yaw), 0, -Math.sin(yaw));
      const d = code === "ArrowUp" ? fwd : code === "ArrowDown" ? fwd.neg() : code === "ArrowRight" ? right : right.neg();
      P.nudge = P.nudge.add(d.mul(step));
    }
  }

  placeNow() {
    const P = this.placement;
    if (!P.last) return;
    if (!P.last.cf || !P.last.valid) {
      bus.emit("notify", P.last.reason || "Can't place here.", "warn");
      return;
    }
    const r = this.report(this.g.components.place(P.last.cf, P.free));
    if (r.ok) {
      P.rot = 0;
      P.free = false;
      P.nudge = v();
      P.last = null;
      this.clearGhost();
    }
  }

  setGhost(def, cf, valid) {
    const key = def.id + (valid ? "v" : "x");
    if (!this.ghost || this.ghostDef !== def) {
      this.clearGhost();
      const vnt = itemVariant(def, false);
      const g = new THREE.Group();
      for (const b of vnt.buckets) {
        const m = new THREE.Mesh(b.geometry, getGhostMaterial("valid"));
        m.renderOrder = 5;
        g.add(m);
      }
      g.matrixAutoUpdate = false;
      this.r.scene.add(g);
      this.ghost = g;
      this.ghostDef = def;
    }
    if (this.ghostKey !== key) {
      const mat = getGhostMaterial(valid ? "valid" : "invalid");
      this.ghost.children.forEach((m) => (m.material = mat));
      this.ghostKey = key;
    }
    this.ghost.visible = !!cf;
    if (cf) cf.toMatrix4(this.ghost.matrix);
    this.ghost.matrixWorldNeedsUpdate = true;
  }
  clearGhost() {
    if (this.ghost) this.r.scene.remove(this.ghost);
    this.ghost = null;
    this.ghostDef = null;
    this.ghostKey = null;
  }

  updatePlacement() {
    const g = this.g, pl = g.player, comp = pl.carrying;
    const P = this.placement;
    const def = comp.def;
    const hit = this.cast(Config.Reach.Place + 4.7, new Set([comp.id]));
    let cf = null, reason = null, valid = false;
    if (hit) {
      const aim = { point: hit.pos, hit: hit.terrain ? null : hit, normal: hit.normal };
      const s = Rules.solve(g.world, def, aim, { rot: P.rot, free: P.free, nudge: P.nudge, excludeIds: new Set([comp.id]) });
      cf = s.cf;
      reason = s.hint;
    } else reason = "Aim at the ground or a connection.";
    let ghostCf = cf;
    if (cf) {
      const r = Rules.validate(g.world, def, cf, { exclude: [comp.id], excludeIds: [comp.id], actorPos: pl.rootPos(), reach: Config.Reach.Place });
      valid = r.ok;
      reason = r.reason;
    } else if (hit) {
      ghostCf = CF.from(hit.pos.add(v(0, def.originBottom ? 0 : def.size.y / 2, 0))).mul(CF.angles(0, (Math.PI / 2) * P.rot, 0));
    }
    P.last = { cf, valid, reason };
    this.setGhost(def, ghostCf, valid);
    let hints = "LMB place · R rotate · Z/C fine";
    if (def.allowFree) hints += " · T free" + (P.free ? " (ON)" : "") + (P.free ? " · arrows nudge" : "");
    hints += " · G drop";
    bus.emit("placement", { title: def.name + (P.free ? "  ·  FREE PLACEMENT" : ""), valid, reason, hints });
  }

  // ---------------------------------------------------------------------------
  // Concrete pour preview
  // ---------------------------------------------------------------------------
  updatePour() {
    const g = this.g;
    const hit = this.cast(Config.Reach.Place + 6.7);
    let def = null, cf = null, reason = null, valid = false;
    if (hit && !hit.terrain) {
      const s = Rules.solveSlab(g.world, { point: hit.pos, hit });
      def = s.def;
      cf = s.cf;
      reason = s.reason;
    } else reason = "Aim at the metal deck of a floor bay.";
    if (def && cf) {
      const r = Rules.validate(g.world, def, cf, {});
      valid = r.ok;
      reason = r.reason;
      this.setGhost(def, cf.plus(v(0, 0.017, 0)), valid);
      this.pour.target = { def, cf, valid, reason };
    } else {
      this.clearGhost();
      this.pour.target = null;
    }
    bus.emit("placement", { title: def ? "Pour: " + def.name : "Concrete pump hose", valid, okText: "Bay ready — hold the left mouse button to pour", reason, hints: "Hold LMB pour · 7 trowel to finish · 1 hands" });
    if (this.pour.holdStart !== null) {
      const t = this.pour.target;
      if (!t || !t.valid) {
        this.pour.holdStart = null;
        bus.emit("hold", null);
        return;
      }
      const a = (g.time - this.pour.holdStart) / POUR_TIME;
      bus.emit("hold", a);
      if (a >= 1) {
        this.pour.holdStart = null;
        bus.emit("hold", null);
        this.report(g.components.pour(t.def, t.cf));
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Fastener markers
  // ---------------------------------------------------------------------------
  refreshMarkers() {
    const list = [];
    const root = this.root();
    for (const c of this.g.world.records()) {
      if (c.state !== "Placed" || c.cf.pos.dist(root) > 23) continue;
      c.def.fasteners.forEach((f, i) => {
        if (c.fastened[i] !== "1") list.push(c.cf.point(f.pos));
      });
    }
    this.markerList = list;
    const m = new THREE.Matrix4();
    this.markers.count = Math.min(list.length, 512);
    for (let i = 0; i < this.markers.count; i++) {
      m.makeTranslation(list[i].x, list[i].y, list[i].z);
      this.markers.setMatrixAt(i, m);
    }
    this.markers.instanceMatrix.needsUpdate = true;
  }

  update(dt) {
    const g = this.g;
    this.markerAcc += dt;
    if (this.markerAcc > 0.25) {
      this.markerAcc = 0;
      if (g.world && g.mode === "Play") this.refreshMarkers();
      else this.markers.count = 0;
    }
    this.hover.visible = false;
    if (!this.active()) {
      if (this.target) {
        this.target = null;
        bus.emit("prompt", null);
      }
      if (this.hold) this.cancelHold();
      if (!(g.player.carrying && g.mode === "Play")) {
        this.clearGhost();
        bus.emit("placement", null);
      }
      return;
    }
    const pl = g.player;
    if (pl.carrying) {
      this.target = null;
      bus.emit("prompt", null);
      this.solveAcc += dt;
      if (this.solveAcc >= 1 / 30) {
        this.solveAcc = 0;
        this.updatePlacement();
      }
      return;
    }
    if (pl.tool === "TL-POUR") {
      this.solveAcc += dt;
      if (this.solveAcc >= 1 / 20) {
        this.solveAcc = 0;
        this.updatePour();
      }
    } else if (this.ghost) {
      this.clearGhost();
      bus.emit("placement", null);
    } else bus.emit("placement", null);

    let t = this.resolve(this.cast(13.3));
    if (t && t.dist > Config.Reach.Interact + 4) t = null;
    this.target = t;
    bus.emit("prompt", this.buildPrompt());
    // hovered marker
    if (t && t.kind === "Component" && t.rec.state === "Placed") {
      const f = this.nearestFastener(t.rec, t.pos, this.toolFastens());
      if (f) {
        this.hover.position.set(f.pos.x, f.pos.y, f.pos.z);
        this.hover.visible = true;
      }
    }
    if (this.hold) {
      if (!t || t.kind !== "Component" || t.rec.id !== this.hold.id) return this.cancelHold();
      if (this.hold.kind === "Fasten") {
        const f = this.nearestFastener(t.rec, t.pos, this.hold.ftype);
        if (!f || f.index !== this.hold.index) return this.cancelHold();
      }
      const a = (g.time - this.hold.start) / this.hold.duration;
      bus.emit("hold", a);
      if (a >= 1) this.finishHold();
    }
  }
}
