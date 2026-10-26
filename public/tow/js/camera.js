// Camera modes: third-person over the shoulder, first-person, in-cab driver
// view with free head look, chase cam behind a vehicle, and under-car view.
import * as THREE from 'three';
import { clamp, damp, dampAngle, wrapAngle } from './util.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ');

export class CameraRig {
  constructor(camera, physics) {
    this.cam = camera;
    this.physics = physics;
    this.mode = 'third';
    this.yaw = 0;
    this.pitch = -0.15;
    this.dist = 3.4;
    this.headYaw = 0;
    this.headPitch = -0.08;
    this.chaseYaw = 0;
    this.chasePitch = -0.22;
    this.freeLook = 0;
    this.shake = 0;
    this.fovBase = 70;
  }

  look(dx, dy) {
    const k = 0.0022;
    if (this.mode === 'cab') {
      this.headYaw = clamp(this.headYaw - dx * k, -2.4, 2.4);
      this.headPitch = clamp(this.headPitch - dy * k, -1.25, 1.0);
    } else if (this.mode === 'chase') {
      this.chaseYaw -= dx * k;
      this.chasePitch = clamp(this.chasePitch - dy * k, -1.2, 0.35);
      if (Math.abs(dx) + Math.abs(dy) > 0) this.freeLook = 1.5;
    } else {
      this.yaw -= dx * k;
      this.pitch = clamp(this.pitch - dy * k, -1.35, 1.2);
    }
  }

  zoom(w) { this.dist = clamp(this.dist + w * 0.4, 1.6, 7); }

  // Third person: orbit behind the player's shoulder, pulled in by walls.
  updateThird(dt, headPos, exclude) {
    _e.set(this.pitch, this.yaw, 0);
    _q.setFromEuler(_e);
    const back = _v.set(0.42, 0.15, this.dist).applyQuaternion(_q);
    const target = _v2.copy(headPos);
    const desired = target.clone().add(back);
    const dir = back.clone().normalize();
    const hit = this.physics.ray(target, dir, back.length() + 0.3, { excludeCollider: exclude });
    let d = back.length();
    if (hit) d = Math.max(0.35, hit.toi - 0.25);
    this.cam.position.copy(target).addScaledVector(dir, d);
    if (this.cam.position.y < 0.25) this.cam.position.y = 0.25;
    this.cam.quaternion.copy(_q);
    this.applyShake(dt);
  }

  updateFirst(dt, eyePos) {
    _e.set(this.pitch, this.yaw, 0);
    this.cam.quaternion.setFromEuler(_e);
    this.cam.position.copy(eyePos);
    this.applyShake(dt);
  }

  // Driver's eye inside the cab: head turns relative to the truck.
  updateCab(dt, eyeWorld, vehicleQuat) {
    // Cameras look down -z; the truck faces +z, hence the half turn.
    _e.set(this.headPitch, this.headYaw + Math.PI, 0);
    _q.setFromEuler(_e);
    this.cam.quaternion.copy(vehicleQuat).multiply(_q);
    this.cam.position.copy(eyeWorld);
    this.applyShake(dt);
  }

  // Chase cam behind a vehicle; the mouse orbits, then it eases back.
  updateChase(dt, vehicle, length, height, exclude) {
    const vy = vehicle.yaw();
    this.freeLook = Math.max(0, this.freeLook - dt);
    if (this.freeLook <= 0) {
      const speed = Math.abs(vehicle.speed);
      const targetYaw = vy + Math.PI + (vehicle.speed < -0.5 ? Math.PI : 0);
      this.chaseYaw = dampAngle(this.chaseYaw, targetYaw, speed > 1 ? 3 : 1.2, dt);
      this.chasePitch = damp(this.chasePitch, -0.2, 2, dt);
    }
    const dist = length * 0.85 + 4.2;
    const center = _v2.copy(vehicle.position).add(_v.set(0, height * 0.75, 0));
    const offset = new THREE.Vector3(Math.sin(this.chaseYaw) * Math.cos(this.chasePitch), -Math.sin(this.chasePitch), Math.cos(this.chaseYaw) * Math.cos(this.chasePitch)).multiplyScalar(dist);
    const dir = offset.clone().normalize();
    const hit = this.physics.ray(center, dir, dist + 0.3, { excludeBody: vehicle.body, excludeCollider: exclude });
    let d = dist;
    if (hit) d = Math.max(1.2, hit.toi - 0.3);
    this.cam.position.copy(center).addScaledVector(dir, d);
    this.cam.lookAt(center);
    this.applyShake(dt);
  }

  updateUnder(dt, pos, lookAt) {
    this.cam.position.copy(pos);
    _e.set(this.pitch, this.yaw, 0);
    this.cam.quaternion.setFromEuler(_e);
  }

  applyShake(dt) {
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2);
      const s = this.shake * 0.02;
      this.cam.position.x += (Math.random() - 0.5) * s;
      this.cam.position.y += (Math.random() - 0.5) * s;
      this.cam.position.z += (Math.random() - 0.5) * s;
    }
  }

  // World-space forward of the camera on the ground plane.
  groundForward(out = new THREE.Vector3()) {
    out.set(0, 0, -1).applyQuaternion(this.cam.quaternion);
    out.y = 0;
    return out.normalize();
  }
}
