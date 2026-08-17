// Arcade truck physics on a sampled height field, plus the on-foot controller
// and the camera rig that sits behind both.
import * as THREE from 'three';
import { clamp, lerp, damp, angleDelta } from './util.js';

const GRAVITY = 22;

/* ------------------------------------------------------------ truck driving */

export class TruckController {
  constructor(truck, city, opts = {}) {
    this.truck = truck;
    this.city = city;
    this.spec = truck.userData.spec;
    this.pos = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0; this.roll = 0;
    this.speed = 0;
    this.steer = 0;
    this.vy = 0;
    this.airborne = false;
    this.gear = 'P';
    this.rpm = 0.15;
    this.grip = 1;
    this.wheelSpin = 0;
    this.odometer = 0;
    this.lastImpact = 0;
    this.onImpact = opts.onImpact || (() => {});
    this.loadMass = 0;
  }

  placeAt(x, z, heading, y) {
    this.pos.set(x, y ?? this.city.heightAt(x, z), z);
    this.yaw = heading;
    this.speed = 0;
    this.syncMesh();
  }

  get maxSpeed() {
    const base = this.spec.speed / 3.6;
    return base * (1 - Math.min(0.32, this.loadMass / 12000));
  }

  update(dt, input, { driving = false, parkBrake = true } = {}) {
    const t = this.truck;
    const throttle = driving ? Math.max(0, input.axis('KeyS', 'KeyW')) : 0;
    const braking = driving ? Math.max(0, input.axis('KeyW', 'KeyS')) : 0;
    const steerInput = driving ? input.axis('KeyD', 'KeyA') : 0;
    const handbrake = driving && input.down('Space');

    // Steering: slower rack the faster you go, like a real loaded wrecker.
    const speedFactor = 1 - clamp(Math.abs(this.speed) / this.maxSpeed, 0, 1) * 0.72;
    const maxSteer = 0.62 * speedFactor;
    this.steer = damp(this.steer, steerInput * maxSteer, 7, dt);

    const loadFactor = 1 - Math.min(0.45, this.loadMass / 9000);
    let accel = 0;
    if (this.gear === 'D') accel = throttle * 5.2 * loadFactor;
    else if (this.gear === 'R') accel = -throttle * 3.0 * loadFactor;
    if (parkBrake) accel = 0;

    const brakeForce = (braking * 11 + (handbrake ? 16 : 0) + (parkBrake ? 26 : 0)) * this.grip;
    this.speed += accel * dt;
    if (Math.abs(this.speed) > 0.02) {
      const dec = Math.min(Math.abs(this.speed) / dt, brakeForce + 0.9 + Math.abs(this.speed) * 0.06 + this.speed * this.speed * 0.0022);
      this.speed -= Math.sign(this.speed) * dec * dt;
    } else if (accel === 0) this.speed = 0;

    const lim = this.gear === 'R' ? 9 : this.maxSpeed;
    this.speed = clamp(this.speed, this.gear === 'R' ? -lim : -1.5, lim);

    // Bicycle-model yaw. Low grip bleeds the turn into a slide.
    const wb = this.spec.wb;
    let yawRate = (this.speed / wb) * Math.tan(this.steer);
    const lateralG = Math.abs(yawRate * this.speed) / 9.81;
    const slipping = lateralG > this.grip * 0.85;
    if (slipping) yawRate *= 0.6 + 0.4 * this.grip;
    if (handbrake && Math.abs(this.speed) > 4) yawRate *= 1.5;
    this.yaw += yawRate * dt;

    // Integrate along the heading.
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const nx = this.pos.x + fx * this.speed * dt;
    const nz = this.pos.z + fz * this.speed * dt;

    if (this.collides(nx, nz, this.yaw)) {
      // Try sliding along one axis before giving up (kerbs and walls).
      if (!this.collides(nx, this.pos.z, this.yaw)) { this.pos.x = nx; }
      else if (!this.collides(this.pos.x, nz, this.yaw)) { this.pos.z = nz; }
      else {
        const hit = Math.abs(this.speed);
        this.speed *= -0.18;
        if (hit > 5 && performance.now() - this.lastImpact > 400) {
          this.lastImpact = performance.now();
          this.onImpact(hit);
        }
      }
    } else {
      this.pos.x = nx; this.pos.z = nz;
      this.odometer += Math.abs(this.speed) * dt;
    }

    // Ground following, with a real fall if you drive off the deck.
    const groundY = this.sampleGround();
    if (this.airborne || this.pos.y > groundY + 0.35) {
      this.vy -= GRAVITY * dt;
      this.pos.y += this.vy * dt;
      this.airborne = true;
      if (this.pos.y <= groundY) {
        this.pos.y = groundY;
        if (this.vy < -6) this.onImpact(Math.abs(this.vy));
        this.vy = 0; this.airborne = false;
        this.speed *= 0.7;
      }
    } else {
      this.pos.y = damp(this.pos.y, groundY, 12, dt);
      this.vy = 0;
    }

    // Pitch and roll from the height field under the axles.
    const half = this.spec.cabW / 2;
    const hF = this.city.heightAt(this.pos.x + fx * wb / 2, this.pos.z + fz * wb / 2);
    const hR = this.city.heightAt(this.pos.x - fx * wb / 2, this.pos.z - fz * wb / 2);
    const hL = this.city.heightAt(this.pos.x + fz * half, this.pos.z - fx * half);
    const hRt = this.city.heightAt(this.pos.x - fz * half, this.pos.z + fx * half);
    this.pitch = damp(this.pitch, -Math.atan2(hF - hR, wb), 6, dt);
    this.roll = damp(this.roll, Math.atan2(hL - hRt, half * 2), 6, dt);

    this.rpm = clamp(0.12 + Math.abs(this.speed) / this.maxSpeed * 0.85 + throttle * 0.2, 0, 1.2);
    this.wheelSpin += (this.speed / this.spec.wheelR) * dt;
    this.syncMesh();
  }

  sampleGround() {
    const c = this.city;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const wb = this.spec.wb;
    return Math.max(
      c.heightAt(this.pos.x + fx * wb * 0.5, this.pos.z + fz * wb * 0.5),
      c.heightAt(this.pos.x - fx * wb * 0.5, this.pos.z - fz * wb * 0.5),
    );
  }

  collides(x, z, yaw) {
    const c = this.city;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const L = this.spec.L / 2 - 0.2, W = this.spec.cabW / 2 + 0.1;
    for (const [l, w] of [[L, W], [L, -W], [-L, W], [-L, -W], [L, 0], [0, W], [0, -W]]) {
      if (c.isSolid(x + fx * l + rx * w, z + fz * l + rz * w)) return true;
    }
    return false;
  }

  syncMesh() {
    const t = this.truck;
    t.position.copy(this.pos);
    t.rotation.set(0, 0, 0);
    t.rotateY(this.yaw);
    t.rotateX(this.pitch);
    t.rotateZ(this.roll);
    for (const w of t.userData.wheels) {
      w.rotation.x = this.wheelSpin;
      if (w.userData.steer) w.rotation.y = this.steer * 0.85;
    }
  }

  get speedMph() { return Math.abs(this.speed) * 2.23694; }
}

/* -------------------------------------------------------------- on-foot */

export class FootController {
  constructor(character, city) {
    this.char = character;
    this.city = city;
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.vy = 0;
    this.grounded = true;
    this.speed = 0;
    this.platforms = [];   // extra surfaces you can stand on (truck deck, etc.)
    this.radius = 0.42;
    this.height = 1.8;
  }

  placeAt(x, z, yaw, y) {
    this.pos.set(x, y ?? this.city.heightAt(x, z), z);
    this.yaw = yaw ?? 0;
    this.vy = 0;
  }

  groundAt(x, z, currentY) {
    let g = this.city.heightAt(x, z);
    for (const p of this.platforms) {
      const h = p(x, z, currentY);
      if (h != null && h > g && h <= currentY + 0.65) g = h;
    }
    return g;
  }

  update(dt, input, camYaw, { canMove = true, run = false } = {}) {
    let mx = 0, mz = 0;
    if (canMove) {
      const f = input.axis('KeyS', 'KeyW');
      const s = input.axis('KeyD', 'KeyA');
      // Camera-relative movement, Roblox style.
      mx = Math.sin(camYaw) * f - Math.cos(camYaw) * s;
      mz = Math.cos(camYaw) * f + Math.sin(camYaw) * s;
    }
    const len = Math.hypot(mx, mz);
    const sprint = run && input.down('ShiftLeft');
    const target = len > 0.01 ? (sprint ? 6.4 : 3.4) : 0;
    this.speed = damp(this.speed, target, 10, dt);
    if (len > 0.01) {
      mx /= len; mz /= len;
      this.yaw = this.yaw + angleDelta(this.yaw, Math.atan2(mx, mz)) * Math.min(1, dt * 12);
    }

    const step = this.speed * dt;
    const nx = this.pos.x + mx * step, nz = this.pos.z + mz * step;
    if (!this.blocked(nx, this.pos.z)) this.pos.x = nx;
    if (!this.blocked(this.pos.x, nz)) this.pos.z = nz;

    const g = this.groundAt(this.pos.x, this.pos.z, this.pos.y);
    if (this.grounded && canMove && input.justPressed('Space')) {
      this.vy = 7.2; this.grounded = false;
    }
    if (!this.grounded) {
      this.vy -= GRAVITY * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= g) { this.pos.y = g; this.vy = 0; this.grounded = true; }
    } else {
      if (this.pos.y > g + 0.6) { this.grounded = false; }
      else this.pos.y = damp(this.pos.y, g, 18, dt);
    }

    this.char.position.copy(this.pos);
    this.char.rotation.y = this.yaw;
  }

  blocked(x, z) {
    // Ignore walls you are standing on top of (the bed, an overpass).
    const g = this.city.heightAt(x, z);
    if (this.pos.y > g + 1.4) return false;
    return this.city.isSolid(x, z);
  }
}

/* ------------------------------------------------------------- camera rig */

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0; this.pitch = -0.22;
    this.distance = 8;
    this.target = new THREE.Vector3();
    this.mode = 'third';           // third | first | interior | orbit
    this.smoothed = new THREE.Vector3();
    this.shake = 0;
  }

  handleMouse(input, dt) {
    if (!input.locked) return;
    const sens = 0.0022;
    this.yaw -= input.mouse.dx * sens;
    this.pitch = clamp(this.pitch - input.mouse.dy * sens, -1.25, 1.05);
    // Head look inside the cab is tracked separately and clamped, so you can
    // glance at the radio without the chase camera spinning round with you.
    this.headYaw = clamp((this.headYaw || 0) - input.mouse.dx * sens, -2.0, 2.0);
    this.headPitch = clamp((this.headPitch || 0) - input.mouse.dy * sens, -1.0, 0.7);
    if (input.mouse.wheel) this.distance = clamp(this.distance + input.mouse.wheel * 1.2, 3, 22);
  }

  resetHead() { this.headYaw = 0; this.headPitch = -0.06; }

  follow(targetPos, dt, { height = 1.6, distance = null, lookAhead = 0 } = {}) {
    const d = distance ?? this.distance;
    this.target.copy(targetPos);
    this.target.y += height;
    this.smoothed.lerp(this.target, 1 - Math.exp(-14 * dt));
    const cp = Math.cos(this.pitch);
    const ox = Math.sin(this.yaw) * cp * d;
    const oz = Math.cos(this.yaw) * cp * d;
    const oy = Math.sin(-this.pitch) * d;
    this.camera.position.set(this.smoothed.x - ox, this.smoothed.y + oy + 0.6, this.smoothed.z - oz);
    if (this.shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 2.2);
    }
    this.camera.lookAt(this.smoothed.x, this.smoothed.y + 0.2, this.smoothed.z);
  }

  // Sit in the cab: the camera rides in truck space with free head look.
  // The extra PI turns the camera around to face the truck's nose (+Z),
  // since a three.js camera looks down its own -Z.
  interior(truck, dt) {
    const seat = truck.userData.seatPos;
    const p = seat.clone();
    truck.updateMatrixWorld(true);
    truck.localToWorld(p);
    this.camera.position.copy(p);
    const q = new THREE.Quaternion();
    truck.getWorldQuaternion(q);
    const look = new THREE.Euler(this.headPitch ?? 0, (this.headYaw ?? 0) + Math.PI, 0, 'YXZ');
    const lq = new THREE.Quaternion().setFromEuler(look);
    this.camera.quaternion.copy(q).multiply(lq);
    // Keep the chase camera lined up behind the truck for when you switch back.
    this.yaw = Math.atan2(
      2 * (q.w * q.y + q.x * q.z),
      1 - 2 * (q.y * q.y + q.x * q.x),
    ) + (this.headYaw ?? 0);
    if (this.shake > 0) {
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.3;
      this.shake = Math.max(0, this.shake - dt * 2.2);
    }
  }
}
