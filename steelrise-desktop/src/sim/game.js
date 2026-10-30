// Single-player game state: the loaded site and everything on it, the player
// and the clock. Independent of rendering so it can run headless in tests.

import { CF, V3, v } from "../core/math.js";
import { Config } from "../core/config.js";
import { Site } from "./site.js";
import { bus } from "../core/events.js";

export class PlayerState {
  constructor() {
    this.pos = v(0, 0, 0); // feet
    this.vel = v(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.carrying = null;
    this.tool = "TL-HANDS";
    this.onGround = true;
    this.climbing = false;
    this.teleportTo = null;
  }
  rootPos() {
    return this.pos.add(v(0, 1.0, 0));
  }
  eyePos() {
    return this.pos.add(v(0, 1.62, 0));
  }
  teleport(pos, yaw) {
    this.pos = pos;
    this.vel = v(0, 0, 0);
    if (yaw !== undefined) this.yaw = yaw;
    bus.emit("player", "teleport", this);
  }
  serialize() {
    return { pos: [this.pos.x, this.pos.y, this.pos.z], yaw: this.yaw, tool: this.tool };
  }
}

export class Game {
  constructor(settings = {}) {
    this.settings = { ...Config.DefaultSettings, ...settings };
    this.time = 0;
    this.player = new PlayerState();
    this.site = new Site(this);
    this.world = null;
    this.components = null;
    this.delivery = null;
    this.crane = null;
    this.siteDef = null;
  }

  loadSite(siteId, save) {
    const r = this.site.load(siteId, save);
    if (r.ok) {
      const def = this.siteDef;
      if (save && save.player && Array.isArray(save.player.pos)) {
        this.player.teleport(v(...save.player.pos), save.player.yaw || 0);
        this.player.tool = save.player.tool || "TL-HANDS";
      } else {
        this.player.teleport(def.spawnM.add(v(0, 0.05, 0)), Math.PI);
        this.player.tool = "TL-HANDS";
      }
      this.player.carrying = null;
    }
    return r;
  }

  // fixed simulation step
  update(dt, craneInput, machineInput) {
    if (!this.world) return;
    this.time += dt;
    this.site.update(dt);
    this.delivery.update(dt);
    if (this.crane) {
      this.crane.update(dt, craneInput);
      this.crane.postUpdate();
    }
    if (this.telehandler) this.telehandler.update(dt, machineInput);
    const pl = this.player;
    if (pl.carrying) {
      pl.carrying.cf = this.components.carryPose(pl.carrying);
      this.world.changed("move", pl.carrying);
    }
  }
}
