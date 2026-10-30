// Telehandler driving: keys, chase / cab cameras and the HUD feed.

import { CF, v, clamp } from "../core/math.js";
import { input } from "../core/input.js";
import { bus } from "../core/events.js";

export class MachineControl {
  constructor(game, renderer) {
    this.g = game;
    this.r = renderer;
    this.camYaw = 0;
    this.camPitch = -0.15;
    this.chaseYaw = 0;
    this.smooth = null;
    bus.on("key", (code) => this.onKey(code));
  }
  m() {
    return this.g.telehandler;
  }
  active() {
    const m = this.m();
    return this.g.mode === "Play" && m && m.driving && !input.blocked;
  }
  report(r) {
    if (r && r.msg) bus.emit("notify", r.msg, r.ok ? "info" : "warn");
    return r;
  }
  onKey(code) {
    if (!this.active()) return;
    const m = this.m();
    if (code === "KeyX") this.report(m.exit());
    else if (code === "KeyG") this.report(m.pickUp());
    else if (code === "Enter" || code === "NumpadEnter") this.report(m.land());
    else if (code === "KeyV") {
      m.view = m.view === "Chase" ? "Cab" : "Chase";
      this.smooth = null;
    }
  }
  inputState() {
    if (!this.active()) return {};
    return {
      forward: input.held("KeyW"),
      back: input.held("KeyS"),
      left: input.held("KeyA"),
      right: input.held("KeyD"),
      boomUp: input.held("KeyR"),
      boomDown: input.held("KeyF"),
      extend: input.held("KeyE"),
      retract: input.held("KeyQ"),
      precision: input.held("ShiftLeft"),
    };
  }
  updateCamera(dt, mouse) {
    const m = this.m();
    if (!m || !m.driving) return false;
    const cam = this.r.camera;
    const f = m.frame();
    let want;
    if (m.view === "Cab") {
      this.camYaw = clamp(this.camYaw - mouse.dx * 0.003, -2.6, 2.6);
      this.camPitch = clamp(this.camPitch - mouse.dy * 0.003, -1.2, 0.9);
      want = CF.from(m.seatPos().add(v(0, 0.3, 0))).mul(f.rot).mul(CF.angles(0, -Math.PI / 2 + this.camYaw, 0)).mul(CF.angles(this.camPitch, 0, 0));
    } else {
      this.chaseYaw = clamp(this.chaseYaw - mouse.dx * 0.003, -2.8, 2.8);
      const focus = f.point(v(1.2, 2.2, 0));
      want = CF.from(focus).mul(CF.angles(0, m.heading + Math.PI + this.chaseYaw, 0)).mul(CF.angles(-0.34, 0, 0)).mul(CF.at(0, 0, 10.5));
      // keep the camera out of walls
      want = CF.lookAt(want.pos, focus);
      this.smooth = this.smooth ? this.smooth.lerp(want, Math.min(1, dt * 6)) : want;
      want = this.smooth;
    }
    cam.position.set(want.x, want.y, want.z);
    const q = want.toQuat();
    cam.quaternion.set(q[0], q[1], q[2], q[3]);
    return true;
  }
  update() {
    const m = this.m();
    bus.emit("machineHud", m && m.driving ? m.hudData() : null);
  }
}
