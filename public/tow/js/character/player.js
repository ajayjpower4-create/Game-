// On-foot driver: Rapier kinematic character controller + avatar animation.
import * as THREE from 'three';
import { buildAvatar } from './avatar.js';
import { damp, dampAngle, clamp } from '../util.js';
import { GROUPS, groups } from '../physics.js';

const UP = new THREE.Vector3(0, 1, 0);
const _push = new THREE.Vector3();

export class Player {
  constructor(game, appearance) {
    this.game = game;
    this.physics = game.physics;
    this.R = game.physics.R;
    this.app = appearance;
    this.avatar = buildAvatar(appearance);
    this.root = this.avatar.root;
    game.scene.add(this.root);
    this.halfH = 0.55;
    this.radius = 0.3;
    const body = this.physics.world.createRigidBody(this.R.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 5, 0));
    const col = this.physics.world.createCollider(
      this.R.ColliderDesc.capsule(this.halfH, this.radius).setCollisionGroups(groups(GROUPS.player, 0xffff))
        // A kinematic capsule would be an immovable wall to anything dynamic, so
        // vehicles and props get no contact forces from it; instead the driver
        // is shoved aside (see shove()). Walking still can't pass through them.
        .setSolverGroups(groups(GROUPS.player, 0xffff & ~(GROUPS.vehicle | GROUPS.prop | GROUPS.cargo))).setFriction(0.2), body);
    col.userData = { player: this };
    this.body = body;
    this.collider = col;
    this.kcc = this.physics.world.createCharacterController(0.03);
    this.kcc.setUp({ x: 0, y: 1, z: 0 });
    this.kcc.enableAutostep(0.42, 0.18, false);
    this.kcc.enableSnapToGround(0.35);
    this.kcc.setMaxSlopeClimbAngle(50 * Math.PI / 180);
    this.kcc.setMinSlopeSlideAngle(55 * Math.PI / 180);
    this.kcc.setApplyImpulsesToDynamicBodies(true);
    this.kcc.setCharacterMass(90);
    this.pos = new THREE.Vector3(0, 5, 0);     // feet position
    this.prevPos = this.pos.clone();
    this.vel = new THREE.Vector3();
    this.vy = 0;
    this.grounded = false;
    this.yaw = 0;
    this.speed = 0;
    this.active = true;          // false while seated in a vehicle
    this.pose = 'auto';
    this.action = 0;
    this.lockMove = false;
    this.wish = new THREE.Vector3();
  }

  get feet() { return this.pos; }
  head(out = new THREE.Vector3()) { return out.copy(this.pos).add(new THREE.Vector3(0, this.avatar.eyeHeight, 0)); }
  chest(out = new THREE.Vector3()) { return out.copy(this.pos).add(new THREE.Vector3(0, 1.25 * this.avatar.rig.scale, 0)); }

  setActive(on) {
    this.active = on;
    this.collider.setEnabled(on);
    this.root.visible = on || this.showSeated;
  }

  teleport(p, yaw = this.yaw) {
    this.pos.copy(p);
    this.prevPos.copy(p);
    this.vy = 0;
    this.yaw = yaw;
    this.body.setTranslation({ x: p.x, y: p.y + this.halfH + this.radius, z: p.z }, true);
    this.body.setNextKinematicTranslation({ x: p.x, y: p.y + this.halfH + this.radius, z: p.z });
  }

  // wish: desired horizontal velocity (world), run flag handled by caller.
  fixedUpdate(dt) {
    if (!this.active) return;
    this.prevPos.copy(this.pos);
    const wish = this.lockMove ? new THREE.Vector3() : this.wish;
    // Accelerate toward the wished velocity.
    const accel = this.grounded ? 14 : 3;
    this.vel.x = damp(this.vel.x, wish.x, accel, dt);
    this.vel.z = damp(this.vel.z, wish.z, accel, dt);
    this.vy = this.grounded && this.vy < 0 ? -1 : this.vy - 9.81 * dt;
    if (this.jump && this.grounded) { this.vy = 4.2; this.jump = false; }
    const desired = { x: this.vel.x * dt, y: this.vy * dt, z: this.vel.z * dt };
    this.kcc.computeColliderMovement(this.collider, desired, this.R.QueryFilterFlags.EXCLUDE_SENSORS, undefined, (c) => !c.userData?.noPlayer);
    const mv = this.kcc.computedMovement();
    this.grounded = this.kcc.computedGrounded();
    const t = this.body.translation();
    const push = this.shove();
    const nx = t.x + mv.x + push.x, ny = t.y + mv.y, nz = t.z + mv.z + push.z;
    this.body.setNextKinematicTranslation({ x: nx, y: ny, z: nz });
    this.pos.set(nx, ny - this.halfH - this.radius, nz);
    // Fell through the world somehow? Put them back on the street.
    if (this.pos.y < -20) this.teleport(new THREE.Vector3(this.pos.x, 2, this.pos.z));
  }

  // Horizontal push out of any vehicle or prop that has moved into the capsule.
  shove() {
    const out = _push.set(0, 0, 0);
    const W = this.physics.world;
    W.contactPairsWith(this.collider, (other) => {
      if (other.isSensor()) return;
      const b = other.parent();
      if (!b || !b.isDynamic()) return;
      W.contactPair(this.collider, other, (m, flipped) => {
        let depth = 0;
        for (let i = 0; i < m.numContacts(); i++) depth = Math.max(depth, -m.contactDist(i));
        if (depth <= 0) return;
        const n = m.normal();
        const s = flipped ? 1 : -1;  // away from the other collider
        // Only the sideways part: standing on a deck or roof doesn't shove.
        out.x += s * n.x * depth;
        out.z += s * n.z * depth;
      });
    });
    const len = Math.hypot(out.x, out.z);
    if (len > 0.25) { out.x *= 0.25 / len; out.z *= 0.25 / len; }
    return out;
  }

  update(dt, alpha) {
    if (!this.active && !this.showSeated) return;
    if (this.active) {
      this.root.position.lerpVectors(this.prevPos, this.pos, alpha);
      const hs = Math.hypot(this.vel.x, this.vel.z);
      this.speed = hs;
      if (this.faceYaw !== undefined) this.yaw = dampAngle(this.yaw, this.faceYaw, 12, dt);
      else if (hs > 0.3) this.yaw = dampAngle(this.yaw, Math.atan2(this.vel.x, this.vel.z), 10, dt);
      this.root.rotation.set(0, this.yaw, 0);
    }
    this.avatar.update(dt, { speed: this.active ? this.speed : 0, pose: this.pose, carrying: !!this.carrying, action: this.action, handTargets: this.handTargets });
  }

  dispose() {
    this.physics.world.removeCharacterController(this.kcc);
    this.physics.world.removeRigidBody(this.body);
    this.game.scene.remove(this.root);
  }
}
