// Crane operator controls and cameras. Cab: operator seat with free look;
// Hook: trolley camera looking down the falls; Exterior: orbit around the
// hook or load; Player (radio remote): your own view while you work.

import * as THREE from "three";
import { CF, v, clamp } from "../core/math.js";
import { input } from "../core/input.js";
import { bus } from "../core/events.js";
import * as CM from "../sim/craneMath.js";
import { getGhostMaterial } from "../render/materials.js";
import { itemVariant } from "../render/siteView.js";

const VIEWS = { Cab: ["Cab", "Hook", "Exterior"], Remote: ["Player", "Hook", "Exterior"] };

export class CraneControl {
  constructor(game, renderer, controller) {
    this.g = game;
    this.r = renderer;
    this.ctrl = controller;
    this.camYaw = 0;
    this.camPitch = -0.38;
    this.orbitYaw = 0.5;
    this.orbitPitch = -0.45;
    this.orbitDist = 20;
    this.recoverHold = null;
    this.ghost = null;
    this.ghostDef = null;
    this.smoothCam = null;
    bus.on("key", (code) => this.onKey(code));
    bus.on("keyup", (code) => {
      if (code === "KeyY") {
        this.recoverHold = null;
        bus.emit("hold", null);
      }
    });
    bus.on("crane", (kind) => {
      if (kind === "enter") {
        this.camYaw = 0;
        this.camPitch = -0.38;
        this.smoothCam = null;
      }
      if (kind === "exit") this.clearGhost();
    });
  }

  crane() {
    return this.g.crane;
  }
  active() {
    const c = this.crane();
    return this.g.mode === "Play" && c && c.operating && !input.blocked;
  }
  report(r) {
    if (r && !r.ok && r.msg) bus.emit("notify", r.msg, "warn");
    else if (r && r.ok && r.msg) bus.emit("notify", r.msg, "info");
    return r;
  }

  onKey(code) {
    if (!this.active()) return;
    const c = this.crane();
    if (code === "KeyX") this.report(c.exit());
    else if (code === "KeyG") this.report(c.hookOrRelease());
    else if (code === "Enter" || code === "NumpadEnter") this.report(c.landNow());
    else if (code === "KeyH") {
      c.assist = !c.assist;
      bus.emit("notify", "Alignment assist " + (c.assist ? "on" : "off"), "info");
    } else if (code === "KeyV") {
      const views = VIEWS[c.mode];
      c.view = views[(views.indexOf(c.view) + 1) % views.length];
      this.smoothCam = null;
    } else if (code === "KeyY") this.recoverHold = this.g.time;
  }

  inputState() {
    if (!this.active()) return {};
    return {
      slewLeft: input.held("KeyA"),
      slewRight: input.held("KeyD"),
      trolleyOut: input.held("KeyW"),
      trolleyIn: input.held("KeyS"),
      lower: input.held("KeyF"),
      raise: input.held("KeyR"),
      rotLeft: input.held("KeyZ"),
      rotRight: input.held("KeyC"),
      precision: input.held("ShiftLeft"),
    };
  }

  // camera; returns true when the crane owns the camera this frame
  updateCamera(dt, mouse) {
    const c = this.crane();
    if (!c || !c.operating || c.view === "Player") return false;
    const cam = this.r.camera;
    const st = c.st, cfg = c.cfg;
    const slew = CM.slewCf(cfg, st.slew);
    const load = c.load();
    let want;
    if (c.view === "Cab") {
      this.camYaw = clamp(this.camYaw - mouse.dx * 0.0035, -2.4, 2.4);
      this.camPitch = clamp(this.camPitch - mouse.dy * 0.0035, -1.35, 0.6);
      const eye = slew.point(CM.CabEye);
      want = CF.from(eye).mul(slew.rot).mul(CF.angles(0, -Math.PI / 2 + this.camYaw, 0)).mul(CF.angles(this.camPitch, 0, 0));
      this.smoothCam = want;
    } else if (c.view === "Hook") {
      const trolley = CM.trolleyCf(cfg, st);
      const eye = trolley.point(v(0, -0.6, 0.733));
      const focus = (load ? load.cf.pos : c.hookPos()).sub(v(0, 2, 0));
      want = CF.lookAt(eye, focus, slew.xVec);
      this.smoothCam = want;
    } else {
      if (input.button(2)) {
        this.orbitYaw -= mouse.dx * 0.005;
        this.orbitPitch = clamp(this.orbitPitch - mouse.dy * 0.005, -1.4, 0.3);
      }
      if (mouse.wheel) this.orbitDist = clamp(this.orbitDist + mouse.wheel * 2, 5, 87);
      const focus = load ? load.cf.pos : c.hookPos();
      want = CF.from(focus).mul(CF.angles(0, this.orbitYaw, 0)).mul(CF.angles(this.orbitPitch, 0, 0)).mul(CF.at(0, 0, this.orbitDist));
      this.smoothCam = this.smoothCam ? this.smoothCam.lerp(want, Math.min(dt * 8, 1)) : want;
      want = this.smoothCam;
    }
    cam.position.set(want.x, want.y, want.z);
    const q = want.toQuat();
    cam.quaternion.set(q[0], q[1], q[2], q[3]);
    return true;
  }

  setGhost(target) {
    if (!target || !target.cf) return this.clearGhost();
    if (this.ghostDef !== target.def) {
      this.clearGhost();
      const g = new THREE.Group();
      for (const b of itemVariant(target.def, false).buckets) g.add(new THREE.Mesh(b.geometry, getGhostMaterial("valid")));
      g.matrixAutoUpdate = false;
      this.r.scene.add(g);
      this.ghost = g;
      this.ghostDef = target.def;
    }
    const mat = getGhostMaterial(target.valid ? "valid" : "invalid");
    this.ghost.children.forEach((m) => (m.material = mat));
    target.cf.toMatrix4(this.ghost.matrix);
    this.ghost.matrixWorldNeedsUpdate = true;
  }
  clearGhost() {
    if (this.ghost) this.r.scene.remove(this.ghost);
    this.ghost = null;
    this.ghostDef = null;
  }

  update() {
    const c = this.crane();
    if (!c || !c.operating) {
      bus.emit("craneHud", null);
      return;
    }
    this.setGhost(c.assist ? c.target : null);
    bus.emit("craneHud", c.hudData(input.held("ShiftLeft")));
    if (this.recoverHold !== null) {
      const a = (this.g.time - this.recoverHold) / 1.2;
      bus.emit("hold", a);
      if (a >= 1) {
        this.recoverHold = null;
        bus.emit("hold", null);
        this.report(c.recover());
      }
    }
  }
}
