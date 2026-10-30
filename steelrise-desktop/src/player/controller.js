// On-foot player: walking, sprinting, jumping, ladder climbing, collision
// against everything solid on site, first/third-person camera, a simple
// worker avatar and the held tool in view.

import * as THREE from "three";
import { CF, V3, v, clamp } from "../core/math.js";
import { Config } from "../core/config.js";
import { input } from "../core/input.js";
import { bus } from "../core/events.js";
import { Registry } from "../data/items.js";
import { Builder } from "../world/builder.js";
import { bucketize, groupFromBuckets } from "../render/meshes.js";
import { itemVariant } from "../render/siteView.js";

const RADIUS = 0.3;
const HEIGHT = 1.8;
const EYE = 1.62;

export class Controller {
  constructor(game, renderer) {
    this.g = game;
    this.r = renderer;
    this.cam = renderer.camera;
    this.thirdPerson = false;
    this.orbit = 4.2;
    this.bob = 0;
    this.stepAcc = 0;
    this.enabled = false;
    this.avatar = makeAvatar();
    this.avatar.visible = false;
    renderer.scene.add(this.avatar);
    renderer.scene.add(this.cam);
    this.toolHolder = new THREE.Group();
    this.toolHolder.position.set(0.28, -0.26, -0.55);
    this.cam.add(this.toolHolder);
    this.toolId = null;
    this.swing = 0;
    this.fallStart = null;
    bus.on("tool", (id) => this.setTool(id));
    bus.on("player", (kind) => {
      if (kind === "teleport") this.g.player.vel = v();
    });
  }

  setTool(id) {
    if (id === this.toolId) return;
    this.toolId = id;
    this.toolHolder.clear();
    const def = Registry.get(id);
    if (!def || id === "TL-HANDS") return;
    const vnt = itemVariant(def, false);
    const g = groupFromBuckets(vnt.buckets);
    g.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = false;
        o.receiveShadow = false;
      }
    });
    // tools are modelled pointing -Z; tilt them into the hand
    g.rotation.set(-0.15, 0.25, 0.05);
    g.scale.setScalar(1.1);
    this.toolHolder.add(g);
  }

  physics() {
    return this.g.world && this.g.world.physics;
  }

  // solid colliders the player bumps into
  filter = (c) => {
    const o = c.owner;
    if (!o || !c.solid) return false;
    if (o.kind === "strap") return false;
    if (o.kind === "comp") return o.state !== "Carried" && o !== this.g.player.carrying;
    return true;
  };

  groundHeight(pos, reach) {
    const ph = this.physics();
    let best = null;
    const offs = [[0, 0], [RADIUS * 0.6, 0], [-RADIUS * 0.6, 0], [0, RADIUS * 0.6], [0, -RADIUS * 0.6]];
    for (const [ox, oz] of offs) {
      const o = v(pos.x + ox, pos.y + Config.stepHeight + 0.05, pos.z + oz);
      const hit = ph.raycast(o, v(0, -(Config.stepHeight + 0.05 + reach), 0), this.filter);
      if (hit && hit.normal.y > 0.6 && (best === null || hit.pos.y > best)) best = hit.pos.y;
    }
    return best;
  }

  collide(pos) {
    const ph = this.physics();
    let p = pos;
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const h of [RADIUS + 0.02, 0.9, HEIGHT - RADIUS]) {
        const contacts = ph.sphereContacts(p.x, p.y + h, p.z, RADIUS, this.filter);
        for (const c of contacts) {
          // low obstacles are stepped onto instead of pushing back
          if (h < 0.5 && c.col.max[1] - p.y <= Config.stepHeight && c.normal.y < 0.7) continue;
          let n = c.normal;
          if (h < 0.5 && n.y > 0.7) continue; // ground handled by the ground probe
          if (h > 1 && n.y < -0.7) {
            // head bump
            p = p.add(v(0, -c.depth, 0));
            if (this.g.player.vel.y > 0) this.g.player.vel = v(this.g.player.vel.x, 0, this.g.player.vel.z);
            moved = true;
            continue;
          }
          n = v(n.x, 0, n.z);
          const len = n.len;
          if (len < 1e-4) continue;
          p = p.add(n.mul(c.depth / len));
          moved = true;
        }
      }
      if (!moved) break;
    }
    return p;
  }

  update(dt) {
    const g = this.g;
    const pl = g.player;
    const crane = g.crane;
    if (!g.world) return;
    if (crane && crane.operating && crane.mode === "Cab") {
      const seat = crane.cabSeatCf();
      pl.pos = seat.pos.sub(v(0, 0.55, 0));
      pl.vel = v();
      this.avatar.visible = false;
      this.toolHolder.visible = false;
      return;
    }
    this.toolHolder.visible = !this.thirdPerson && !(crane && crane.operating && crane.view !== "Player");
    const m = this.enabled && !(crane && crane.operating) ? input : null;
    const fwdIn = m ? (m.held("KeyW") ? 1 : 0) - (m.held("KeyS") ? 1 : 0) : 0;
    const sideIn = m ? (m.held("KeyD") ? 1 : 0) - (m.held("KeyA") ? 1 : 0) : 0;
    const carrying = pl.carrying;
    const wc = carrying ? Config.WeightClasses[carrying.def.weightClass] : null;
    const sprint = m && m.held("ShiftLeft") && !carrying;
    const speed = wc ? wc.walkSpeed : sprint ? Config.sprintSpeed : Config.walkSpeed;
    const yaw = pl.yaw;
    const fwd = v(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = v(Math.cos(yaw), 0, -Math.sin(yaw));
    let wish = fwd.mul(fwdIn).add(right.mul(sideIn));
    if (wish.len > 1) wish = wish.unit();

    // ladders
    const ph = this.physics();
    const canClimb = !carrying || Config.WeightClasses[carrying.def.weightClass].climb;
    const climbVol = canClimb ? ph.climbAt(pl.pos.add(v(0, 0.9, 0)), RADIUS + 0.25) : null;
    let vel = pl.vel;
    if (climbVol && (fwdIn !== 0 || pl.climbing) && !(m && m.held("Space"))) {
      pl.climbing = fwdIn !== 0 || pl.climbing;
      vel = v(right.x * sideIn * 1.2, fwdIn * 2.4, right.z * sideIn * 1.2);
      // hug the ladder
      const c = climbVol.cf.pos;
      const toward = v(c.x - pl.pos.x, 0, c.z - pl.pos.z);
      if (toward.len > 0.45) vel = vel.add(toward.unit().mul(0.8));
      // top out onto the platform
      if (fwdIn > 0 && pl.pos.y + 0.9 > climbVol.max[1]) vel = vel.add(fwd.mul(1.5));
    } else {
      if (pl.climbing && m && m.held("Space")) vel = fwd.mul(-2.5).add(v(0, 2, 0));
      pl.climbing = false;
      const target = wish.mul(speed);
      const accel = pl.onGround ? 30 : 5;
      const hv = v(vel.x, 0, vel.z);
      const dv = target.sub(hv);
      const maxDv = accel * dt;
      const step = dv.len > maxDv ? dv.unit().mul(maxDv) : dv;
      vel = v(vel.x + step.x, vel.y - Config.gravity * dt, vel.z + step.z);
      if (pl.onGround && m && m.held("Space") && !this.jumpHeld) {
        vel = v(vel.x, Config.jumpSpeed, vel.z);
        pl.onGround = false;
        bus.emit("fx", "Jump", pl.pos, null);
      }
    }
    this.jumpHeld = m && m.held("Space");

    // integrate in small steps
    const travel = vel.mul(dt);
    const steps = Math.max(1, Math.ceil(travel.len / 0.15));
    let p = pl.pos;
    const wasGround = pl.onGround;
    for (let i = 0; i < steps; i++) {
      p = p.add(v(travel.x / steps, 0, travel.z / steps));
      p = this.collide(p);
      p = p.add(v(0, travel.y / steps, 0));
      const gy = this.groundHeight(p, Math.max(0.05, -vel.y * dt + 0.05));
      if (gy !== null && vel.y <= 0.01 && p.y - gy <= 0.06 + (wasGround ? Config.stepHeight * 0.5 : 0) && gy - p.y <= Config.stepHeight) {
        p = v(p.x, gy, p.z);
        vel = v(vel.x, 0, vel.z);
        pl.onGround = true;
      } else if (gy !== null && gy > p.y && gy - p.y <= Config.stepHeight && !pl.climbing) {
        p = v(p.x, gy, p.z);
        vel = v(vel.x, Math.max(vel.y, 0), vel.z);
        pl.onGround = true;
      } else {
        pl.onGround = pl.climbing;
      }
      p = this.collide(p);
    }
    // landing / falls
    if (!wasGround && pl.onGround && this.fallStart !== null) {
      const drop = this.fallStart - p.y;
      if (drop > 1.2) bus.emit("fx", "Land", p, drop);
      this.fallStart = null;
    }
    if (!pl.onGround && this.fallStart === null) this.fallStart = p.y;
    if (pl.onGround) this.fallStart = null;
    if (p.y < -12) {
      // fell off the quay or out of the world
      bus.emit("notify", "You fell — back to the site gate.", "warn");
      p = g.siteDef.spawnM.add(v(0, 0.1, 0));
      vel = v();
    }
    pl.pos = p;
    pl.vel = vel;

    // footsteps
    const hs = Math.hypot(vel.x, vel.z);
    if (pl.onGround && hs > 0.5) {
      this.stepAcc += hs * dt;
      this.bob += hs * dt * 2.2;
      if (this.stepAcc > (sprint ? 0.95 : 0.75)) {
        this.stepAcc = 0;
        bus.emit("footstep", p, this.surfaceUnder(p), hs);
      }
    } else if (pl.climbing && Math.abs(vel.y) > 0.3) {
      this.stepAcc += Math.abs(vel.y) * dt;
      if (this.stepAcc > 0.45) {
        this.stepAcc = 0;
        bus.emit("footstep", p, "Metal", 1);
      }
    }
  }

  surfaceUnder(p) {
    const hit = this.physics().raycast(p.add(v(0, 0.3, 0)), v(0, -0.6, 0), this.filter);
    if (!hit) return "Ground";
    if (hit.terrain) return "Ground";
    const o = hit.owner;
    if (o && o.kind === "comp") {
      const t = o.def.tags;
      if (t.Concrete || t.Slab || t.Footing) return "Concrete";
      return "Metal";
    }
    return "Metal";
  }

  // mouse look (pointer locked)
  look(dx, dy) {
    const pl = this.g.player;
    const sens = 0.0022 * (this.g.settings.mouseSensitivity || 1);
    pl.yaw -= dx * sens;
    pl.pitch = clamp(pl.pitch - dy * sens, -1.5, 1.5);
  }

  updateCamera(dt) {
    const pl = this.g.player;
    const cam = this.cam;
    const eye = pl.eyePos();
    const bobY = pl.onGround ? Math.sin(this.bob * Math.PI) * 0.025 : 0;
    const rot = new THREE.Euler(pl.pitch, pl.yaw, 0, "YXZ");
    cam.quaternion.setFromEuler(rot);
    if (this.thirdPerson) {
      const back = new THREE.Vector3(0, 0, 1).applyQuaternion(cam.quaternion);
      const origin = v(eye.x, eye.y + 0.2, eye.z);
      const want = this.orbit;
      const hit = this.physics().raycast(origin, v(back.x, back.y, back.z).mul(want), (c) => this.filter(c));
      const d = hit ? Math.max(0.6, hit.dist - 0.25) : want;
      cam.position.set(origin.x + back.x * d, origin.y + back.y * d, origin.z + back.z * d);
    } else {
      cam.position.set(eye.x, eye.y + bobY, eye.z);
    }
    // avatar
    const showAvatar = this.thirdPerson;
    this.avatar.visible = showAvatar;
    if (showAvatar) {
      this.avatar.position.set(pl.pos.x, pl.pos.y, pl.pos.z);
      this.avatar.rotation.set(0, pl.yaw, 0);
      const hs = Math.hypot(pl.vel.x, pl.vel.z);
      const a = Math.sin(this.bob * Math.PI) * Math.min(hs / 4, 1) * 0.6;
      const L = this.avatar.userData;
      L.legL.rotation.x = a;
      L.legR.rotation.x = -a;
      L.armL.rotation.x = pl.carrying ? -1.2 : -a * 0.8;
      L.armR.rotation.x = pl.carrying ? -1.2 : a * 0.8;
    }
    // tool sway
    this.swing += dt;
    this.toolHolder.position.y = -0.26 + Math.sin(this.bob * Math.PI * 2) * 0.006;
  }

  toolKick(amount = 1) {
    this.toolHolder.position.z = -0.55 + 0.02 * amount;
    setTimeout(() => (this.toolHolder.position.z = -0.55), 60);
  }
}

// Simple site worker: boots, jeans, hi-vis vest, hard hat.
function makeAvatar() {
  const root = new THREE.Group();
  const part = (build) => {
    const b = new Builder();
    build(b);
    const g = groupFromBuckets(bucketize(b.parts));
    g.traverse((o) => o.isMesh && (o.castShadow = true));
    return g;
  };
  const skin = 0xc69072, jeans = 0x2e3f5c, vest = 0xff7a12, shirt = 0x50555c, boot = 0x2a211b;
  const legL = new THREE.Group(), legR = new THREE.Group(), armL = new THREE.Group(), armR = new THREE.Group();
  for (const [g, x] of [[legL, -0.1], [legR, 0.1]]) {
    g.position.set(x, 0.9, 0);
    g.add(part((b) => {
      b.box("Leg", v(0.15, 0.78, 0.17), CF.at(0, -0.42, 0), jeans, "Fabric");
      b.box("Boot", v(0.16, 0.12, 0.27), CF.at(0, -0.84, -0.04), boot, "SmoothPlastic");
    }));
    root.add(g);
  }
  root.add(part((b) => {
    b.box("Hips", v(0.38, 0.16, 0.2), CF.at(0, 0.95, 0), jeans, "Fabric");
    b.box("Torso", v(0.42, 0.55, 0.22), CF.at(0, 1.3, 0), shirt, "Fabric");
    b.box("Vest", v(0.44, 0.46, 0.24), CF.at(0, 1.31, 0), vest, "Fabric");
    b.box("Stripe", v(0.45, 0.04, 0.245), CF.at(0, 1.22, 0), 0xd8dcd8, "SmoothPlastic");
    b.box("Stripe2", v(0.45, 0.04, 0.245), CF.at(0, 1.38, 0), 0xd8dcd8, "SmoothPlastic");
    b.box("Neck", v(0.1, 0.06, 0.1), CF.at(0, 1.6, 0), skin, "SmoothPlastic");
    b.box("Head", v(0.2, 0.24, 0.22), CF.at(0, 1.74, 0), skin, "SmoothPlastic");
    b.cylY("HatDome", 0.12, 0.27, v(0, 1.89, 0), 0xf2f0e8, "SmoothPlastic");
    b.cylY("HatBrim", 0.02, 0.33, v(0, 1.84, -0.01), 0xf2f0e8, "SmoothPlastic");
    b.box("Glasses", v(0.19, 0.04, 0.02), CF.at(0, 1.77, -0.115), 0x202428, "Glass");
  }));
  for (const [g, x] of [[armL, -0.27], [armR, 0.27]]) {
    g.position.set(x, 1.52, 0);
    g.add(part((b) => {
      b.box("Arm", v(0.12, 0.55, 0.13), CF.at(0, -0.27, 0), shirt, "Fabric");
      b.box("Glove", v(0.11, 0.12, 0.12), CF.at(0, -0.6, 0), 0xd0ff28, "Fabric");
    }));
    root.add(g);
  }
  root.userData = { legL, legR, armL, armR };
  return root;
}
