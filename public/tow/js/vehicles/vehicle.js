// Drivable vehicles on Rapier's raycast vehicle controller, plus the
// customer cars you jump, winch, strap and pull wheels off of.
import * as THREE from 'three';
import { buildCarModel, instantiate } from './carbuilder.js';
import { BY_ID } from './catalog.js';
import { clamp, damp, lerp } from '../util.js';
import { GROUPS, groups } from '../physics.js';

const modelCache = new Map();
export function getCarModel(id) {
  if (!modelCache.has(id)) modelCache.set(id, buildCarModel(BY_ID[id]));
  return modelCache.get(id);
}

const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
export const WHEEL_QUERY = groups(GROUPS.vehicle, 0xffff & ~GROUPS.player);

export class VehicleBase {
  constructor(game) {
    this.game = game;
    this.physics = game.physics;
    this.R = game.physics.R;
    this.body = null;
    this.ctrl = null;
    this.wheels = [];        // {conn, radius, rest, front, drive, side, pivot, spin, removed}
    this.prevPos = new THREE.Vector3();
    this.prevQuat = new THREE.Quaternion();
    this.curPos = new THREE.Vector3();
    this.curQuat = new THREE.Quaternion();
    this.controls = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
    this.steerAngle = 0;
    this.speed = 0;          // forward m/s
    this.gear = 'P';
    this.engineOn = false;
    this.rpm = 700;
    this.maxSteer = 0.6;
    this.engineForce = 4000;
    this.brakeForce = 40;
    this.topSpeed = 45;
    this.reverseSpeed = 6;
    this.driven = false;
    this.mass = 1400;
    this.gripScale = 1;
    this.frictionSlip = 2.4;
    this.kinematic = false;
  }

  createBody(pos, yaw, colliders, { mass, com, inertia, linDamp = 0.08, angDamp = 0.35 }) {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    this.body = this.physics.dynamicBody(pos, q, { mass, com, inertia, linDamp, angDamp });
    this.body.userData = { vehicle: this };
    this.colliders = [];
    for (const c of colliders) {
      const base = c.hull ? this.R.ColliderDesc.convexHull(new Float32Array(c.hull)) : this.R.ColliderDesc.cuboid(c.hx, c.hy, c.hz).setTranslation(c.x, c.y, c.z);
      const d = base.setDensity(0).setFriction(c.friction ?? 0.6).setRestitution(0.05)
        .setCollisionGroups(groups(GROUPS.vehicle, 0xffff));
      if (c.rot) d.setRotation(c.rot);
      const col = this.physics.world.createCollider(d, this.body);
      col.userData = { vehicle: this, part: c.part };
      this.colliders.push(col);
    }
    this.mass = mass;
    this.prevPos.copy(pos); this.curPos.copy(pos);
    this.prevQuat.copy(q); this.curQuat.copy(q);
  }

  createController(wheelDefs, tune) {
    this.ctrl = this.physics.world.createVehicleController(this.body);
    this.ctrl.indexUpAxis = 1;
    this.ctrl.setIndexForwardAxis = 2;
    wheelDefs.forEach((w, i) => {
      this.ctrl.addWheel({ x: w.conn.x, y: w.conn.y, z: w.conn.z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, w.rest, w.radius);
      this.ctrl.setWheelSuspensionStiffness(i, tune.stiffness);
      this.ctrl.setWheelSuspensionCompression(i, tune.compression);
      this.ctrl.setWheelSuspensionRelaxation(i, tune.relaxation);
      this.ctrl.setWheelMaxSuspensionTravel(i, tune.travel);
      this.ctrl.setWheelMaxSuspensionForce(i, this.mass * 9.81 * 4);
      this.ctrl.setWheelFrictionSlip(i, tune.slip);
      this.ctrl.setWheelSideFrictionStiffness(i, tune.side ?? 1);
    });
    this.frictionSlip = tune.slip;
    this.wheels = wheelDefs;
  }

  setGrip(scale) {
    this.gripScale = scale;
    if (!this.ctrl) return;
    for (let i = 0; i < this.wheels.length; i++) this.ctrl.setWheelFrictionSlip(i, this.frictionSlip * scale);
  }

  // Runs every physics step, before world.step().
  fixedUpdate(dt) {
    this.prevPos.copy(this.curPos);
    this.prevQuat.copy(this.curQuat);
    if (!this.ctrl || this.kinematic || this.suspended) return;
    const c = this.controls;
    const v = this.ctrl.currentVehicleSpeed();
    this.speed = v;
    // Speed-sensitive steering.
    const steerTarget = c.steer * this.maxSteer / (1 + Math.abs(v) / 14);
    this.steerAngle = damp(this.steerAngle, steerTarget, 6, dt);
    let engine = 0, brake = this.idleBrake ?? 0.4;
    if (this.engineOn && this.driven) {
      // Gear logic: S brakes while rolling forward, then reverses once stopped.
      if (c.throttle > 0.05) {
        if (v < -0.6) brake = this.brakeForce * c.throttle;
        else { this.gear = 'D'; const k = clamp(1 - v / this.topSpeed, 0, 1); engine = this.engineForce * c.throttle * Math.pow(k, 0.55); brake = 0; }
      } else if (c.brake > 0.05) {
        if (v > 0.6) brake = this.brakeForce * c.brake;
        else { this.gear = 'R'; const k = clamp(1 + v / this.reverseSpeed, 0, 1); engine = -this.engineForce * 0.55 * c.brake * k; brake = 0; }
      } else {
        // Coasting; nearly stopped with no pedal, hill-hold keeps it from
        // rolling back (say, halfway up a tilted bed when you lift off).
        brake = Math.abs(v) < 1 ? this.brakeForce * 0.6 : this.brakeForce * 0.03;
      }
    } else if (!this.driven) {
      brake = this.parkedBrake ?? this.brakeForce * 0.8;
    }
    if (c.handbrake > 0) brake = Math.max(brake, this.brakeForce * 1.6);
    if (this.parkingBrake) { engine = 0; brake = Math.max(brake, this.brakeForce * 3); }
    // Raycast-vehicle brakes never really hold, least of all on a slope like
    // a tilted rollback bed. With the brakes on and the vehicle slow, act like
    // static friction instead: cancel the slide relative to whatever it's
    // standing on, plus this step's pull of gravity down the slope, up to
    // what the tires can grip (~0.8 g), so a hard enough shove still moves it.
    if (engine === 0 && brake >= this.brakeForce * 0.5 && Math.abs(v) < 2.5 && this.ctrl.wheelIsInContact(0)) {
      const lv = this.body.linvel();
      let gx = 0, gy = 0, gz = 0;
      const ground = this.ctrl.wheelGroundObject(0)?.parent();
      if (ground && !ground.isFixed()) { const gv = ground.linvel(); gx = gv.x; gy = gv.y; gz = gv.z; }
      const n = this.ctrl.wheelContactNormal(0) ?? { x: 0, y: 1, z: 0 };
      // Sliding velocity and gravity, both along the ground plane.
      let rx = lv.x - gx, ry = lv.y - gy, rz = lv.z - gz;
      const rn = rx * n.x + ry * n.y + rz * n.z;
      rx -= rn * n.x; ry -= rn * n.y; rz -= rn * n.z;
      const gn = -9.81 * n.y;
      const tx = -gn * n.x, ty = -9.81 - gn * n.y, tz = -gn * n.z;
      let ix = -(rx + tx * dt) * this.mass, iy = -(ry + ty * dt) * this.mass, iz = -(rz + tz * dt) * this.mass;
      const cap = this.mass * 0.8 * 9.81 * dt, mag = Math.hypot(ix, iy, iz);
      if (mag > cap) { const k = cap / mag; ix *= k; iy *= k; iz *= k; }
      this.body.applyImpulse({ x: ix, y: iy, z: iz }, true);
    }
    const drivenWheels = this.wheels.filter((w) => w.drive && !w.removed).length || 1;
    this.wheels.forEach((w, i) => {
      this.ctrl.setWheelSteering(i, w.front ? this.steerAngle : 0);
      this.ctrl.setWheelEngineForce(i, w.drive && !w.removed ? engine / drivenWheels : 0);
      this.ctrl.setWheelBrake(i, (c.handbrake > 0 && !w.front) ? brake * 1.4 : brake);
    });
    this.ctrl.updateVehicle(dt, undefined, WHEEL_QUERY, this.wheelFilter);
    // Revs for sound/gauges.
    const target = this.engineOn ? 650 + Math.abs(v) * 70 % 1600 + c.throttle * 900 + (Math.abs(v) > 1 ? 400 : 0) : 0;
    this.rpm = damp(this.rpm, target, 5, dt);
  }

  // After world.step(): read the new pose.
  postStep() {
    if (!this.body) return;
    const t = this.body.translation(), r = this.body.rotation();
    this.curPos.set(t.x, t.y, t.z);
    this.curQuat.set(r.x, r.y, r.z, r.w);
  }

  syncVisual(alpha, root) {
    root.position.lerpVectors(this.prevPos, this.curPos, alpha);
    root.quaternion.slerpQuaternions(this.prevQuat, this.curQuat, alpha);
    if (!this.ctrl || this.suspended) return;
    for (let i = 0; i < this.wheels.length; i++) {
      const w = this.wheels[i];
      if (!w.pivot) continue;
      const len = this.ctrl.wheelSuspensionLength(i) ?? w.rest;
      w.pivot.position.set(w.conn.x, w.conn.y - len, w.conn.z);
      w.pivot.rotation.y = w.front ? this.steerAngle : 0;
      if (w.spin) w.spin.rotation.x = (this.ctrl.wheelRotation(i) ?? 0) * (w.spinSign ?? 1);
      if (w.extra) for (const e of w.extra) { e.pivot.position.set(e.x, w.conn.y - len, e.z); e.pivot.rotation.y = w.front ? this.steerAngle : 0; e.spin.rotation.x = w.spin.rotation.x; }
    }
  }

  get position() { return this.curPos; }
  get quaternion() { return this.curQuat; }
  forward(out = new THREE.Vector3()) { return out.set(0, 0, 1).applyQuaternion(this.curQuat); }
  yaw() { const f = this.forward(_v); return Math.atan2(f.x, f.z); }
  worldToLocal(p, out = new THREE.Vector3()) { return out.copy(p).sub(this.curPos).applyQuaternion(_q.copy(this.curQuat).invert()); }
  localToWorld(p, out = new THREE.Vector3()) { return out.copy(p).applyQuaternion(this.curQuat).add(this.curPos); }

  setKinematic(on) {
    if (on === this.kinematic) return;
    this.kinematic = on;
    this.body.setBodyType(on ? this.R.RigidBodyType.KinematicPositionBased : this.R.RigidBodyType.Dynamic, true);
  }

  teleport(pos, yaw) {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    this.body.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true);
    this.body.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.curPos.copy(pos); this.prevPos.copy(pos);
    this.curQuat.copy(q); this.prevQuat.copy(q);
  }

  dispose() {
    if (this.ctrl) this.physics.world.removeVehicleController(this.ctrl);
    if (this.body) this.physics.world.removeRigidBody(this.body);
    this.ctrl = null; this.body = null;
  }
}

// ----------------------------------------------------------------- cars

const MASS_BY_STYLE = { sedan: 1450, hatch: 1250, coupe: 1600, suv: 1950, wagon: 1650, pickup: 2250, minivan: 2050, van: 2500 };

export class Car extends VehicleBase {
  constructor(game, id, { pos, yaw = 0, color = '#c0c0c0', metallic = true, plate = 'SKV 0000', dead = false, damaged = null } = {}) {
    super(game);
    this.id = id;
    this.spec = BY_ID[id];
    this.model = getCarModel(id);
    this.inst = instantiate(this.model, { color, metallic, plate });
    this.root = this.inst.root;
    this.root.userData.car = this;
    this.color = color;
    this.root.traverse((o) => { if (o.isMesh) o.userData.owner = this; });
    game.scene.add(this.root);
    const s = this.model.spec;
    const d = this.model.dims;
    this.mass = MASS_BY_STYLE[s.style] ?? 1500;
    this.engineForce = this.mass * 3.0;
    this.brakeForce = this.mass * 7 / 240;
    this.topSpeed = 42;
    this.dead = dead;
    this.damaged = damaged;
    this.hoodOpen = 0;
    this.hoodTarget = 0;
    this.hazards = false;
    const beltY = s.beltF;
    // Lower body as a hull with chamfered bumpers, so the nose clears a
    // rollback's ramp the way a real bumper's approach angle does.
    const hw = s.W / 2 - 0.05, L2 = s.L / 2 - 0.03;
    const hull = [];
    for (const x of [-hw, hw]) {
      hull.push(
        x, s.gc + 0.36, L2, x, Math.max(s.gc + 0.4, s.noseY - 0.05), L2,
        x, s.gc + 0.07, s.zf - 0.15, x, s.gc + 0.07, s.zr + 0.15,
        x, s.gc + 0.38, -L2, x, Math.max(s.gc + 0.42, (s.style === 'pickup' ? s.bedRail : s.tailY) - 0.05), -L2,
        x, beltY, s.zW, x, beltY, Math.max(s.zB, -L2 + 0.3),
      );
    }
    const colliders = [
      { hull, part: 'body' },
      { hx: s.W / 2 - 0.22, hy: Math.max(0.05, (s.H - beltY) / 2 - 0.02), hz: Math.max(0.2, (s.zW - s.zB) / 2), x: 0, y: beltY + (s.H - beltY) / 2, z: (s.zW + s.zB) / 2, part: 'cabin' },
    ];
    const com = { x: 0, y: s.gc + 0.38, z: (s.zf + s.zr) / 2 + 0.1 };
    const m = this.mass;
    const inertia = { x: m * (s.H * s.H + s.L * s.L) / 12, y: m * (s.W * s.W + s.L * s.L) / 12, z: m * (s.W * s.W + s.H * s.H) / 12 };
    this.createBody(pos, yaw, colliders, { mass: m, com, inertia });
    const rest = 0.18;
    const defs = this.inst.wheels.map((w) => {
      const front = w.pivot.userData.front, side = w.pivot.userData.side;
      return {
        conn: new THREE.Vector3(side * d.trackX, s.tireR + rest - 0.02, front ? s.zf : s.zr),
        radius: s.tireR, rest, front, drive: s.style === 'pickup' || s.style === 'van' || s.id === 'mustang' || s.id === 'camaro' || s.id === 'challenger' || s.id === 'charger' ? !front : front,
        side, pivot: w.pivot, spin: w.spin, lugs: w.lugs, tire: w.tire, removed: false,
      };
    });
    this.createController(defs, { stiffness: 34, compression: 4.0, relaxation: 2.6, travel: 0.16, slip: 2.6 });
    this.parkedBrake = this.brakeForce * 2;
    if (damaged) this.applyDamage(damaged);
  }

  update(dt) {
    // Hood hinge.
    this.hoodOpen = damp(this.hoodOpen, this.hoodTarget, 6, dt);
    if (this.inst.hoodPivot) this.inst.hoodPivot.rotation.x = -this.hoodOpen * 1.15;
    if (this.inst.bay) this.inst.bay.visible = this.hoodOpen > 0.02;
    // Hazards blink the lamps; brake lights while braking.
    const blink = this.hazards && (performance.now() % 1000) < 500;
    const braking = this.driven && this.controls.brake > 0.1 && this.speed > 0.3;
    this.inst.headMat.emissiveIntensity = blink ? 1.2 : this.lightsOn ? 1.5 : 0;
    if (this.inst.tailMat) this.inst.tailMat.emissiveIntensity = braking ? 2.4 : blink ? 1.6 : this.lightsOn ? 0.6 : 0;
  }

  // Crumples one end: pushes body vertices back and down near the impact.
  applyDamage({ end = 'front', severity = 1, side = 0 }) {
    const s = this.model.spec;
    const zEnd = end === 'front' ? s.L / 2 : -s.L / 2;
    const dir = end === 'front' ? -1 : 1;
    const depth = 0.18 + 0.22 * severity;
    this.root.traverse((o) => {
      if (!o.isMesh || !o.geometry.attributes.position) return;
      if (o.parent !== this.root && o.parent !== this.inst.hoodPivot) return;
      const slot = o.userData.slot;
      if (!['paint', 'head', 'tail', 'glass', 'under', 'black'].includes(slot) && o.userData.part !== 'plate' && o.userData.part !== 'hood') return;
      o.geometry = o.geometry.clone();
      o.geometry.userData.shared = false;
      const p = o.geometry.attributes.position;
      const toRoot = o.parent === this.inst.hoodPivot ? this.inst.hoodPivot.position : null;
      for (let i = 0; i < p.count; i++) {
        let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const rz = toRoot ? z + toRoot.z : z;
        const ry = toRoot ? y + toRoot.y : y;
        const dist = Math.abs(rz - zEnd);
        if (dist > 0.85) continue;
        const k = Math.pow(1 - dist / 0.85, 1.6);
        const lateral = side ? clamp(1 + side * x / (s.W / 2), 0, 2) / 2 + 0.4 : 1;
        const n = Math.sin(x * 23 + ry * 17) * 0.5 + Math.sin(x * 9 - rz * 13) * 0.5;
        z += dir * depth * k * lateral * (0.8 + 0.25 * n);
        y -= depth * 0.25 * k * (ry > s.noseY - 0.1 ? 1 : 0.3) * lateral;
        x *= 1 - 0.02 * k;
        p.setXYZ(i, x, y, z);
      }
      p.needsUpdate = true;
      o.geometry.computeVertexNormals();
    });
    // Smashed lamp on the impact end.
    const lamps = end === 'front' ? this.inst.lamps.head : this.inst.lamps.tail;
    if (lamps[0]) {
      const broken = lamps[0].material.clone();
      broken.color.set(0x1a1a1a); broken.map = null; broken.emissiveIntensity = 0; broken.roughness = 0.6;
      broken.needsUpdate = true;
      this.brokenLamp = broken;
      // The model merges both lamps into one mesh per side; smash the near one.
      const victim = lamps.find((l) => (l.userData.side ?? 1) === (side || 1)) ?? lamps[0];
      victim.material = broken;
    }
    this.damaged = { end, severity, side };
  }

  setHood(open) { this.hoodTarget = open ? 1 : 0; }

  // Takes a wheel off: hides it and lets that corner drop on the hub.
  removeWheel(i) {
    const w = this.wheels[i];
    if (!w || w.removed) return null;
    w.removed = true;
    // The tire and rim come off; the brake disc and caliper stay on the hub,
    // which now sits on the ground.
    const facing = w.spin?.children[0];
    if (facing) facing.visible = false; else w.pivot.visible = false;
    for (const lug of w.lugs || []) lug.visible = false;
    this.ctrl.setWheelRadius(i, Math.max(0.14, this.model.spec.rimR - 0.04));
    this.ctrl.setWheelSuspensionRestLength(i, 0.04);
    this.body.wakeUp();
    const world = new THREE.Vector3();
    w.pivot.getWorldPosition(world);
    return world;
  }

  doorPosition(out = new THREE.Vector3()) {
    const s = this.model.spec;
    return this.localToWorld(out.set(s.W / 2 + 0.6, 0, (s.zW + s.bPillar) / 2), out);
  }
  // Points used for winch hooks (frame rails at the front and back).
  towPoints() {
    const s = this.model.spec;
    return [
      { name: 'front', local: new THREE.Vector3(0, s.gc + 0.08, s.L / 2 - 0.35) },
      { name: 'rear', local: new THREE.Vector3(0, s.gc + 0.08, -s.L / 2 + 0.35) },
    ];
  }
  batteryWorld(out = new THREE.Vector3()) {
    if (!this.inst.battery) return null;
    this.inst.battery.getWorldPosition(out);
    return out;
  }

  dispose() {
    super.dispose();
    this.game.scene.remove(this.root);
  }
}
