// Thin wrapper over Rapier: static world geometry, vehicles, queries.
import RAPIER from '/tow/vendor/rapier/rapier.mjs';
import * as THREE from 'three';

export const GROUPS = {
  // Collision groups: membership << 16 | filter.
  world: 0x0001, vehicle: 0x0002, player: 0x0004, prop: 0x0008, cargo: 0x0010,
};
export const groups = (member, filter) => (member << 16) | filter;

export class Physics {
  static async create() {
    await RAPIER.init({});
    const p = new Physics();
    return p;
  }
  constructor() {
    this.R = RAPIER;
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = 1 / 60;
    this.world.numSolverIterations = 8;
    this.fixed = 1 / 60;
    this.acc = 0;
    this.statics = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    this.colliderOwners = new Map(); // collider handle → object
    this.vehicles = new Set();
    this.preStep = [];
  }

  // ------------------------------------------------------------ statics
  box(cx, cy, cz, hx, hy, hz, { rotY = 0, friction = 0.9, owner = null, rot = null } = {}) {
    const d = this.R.ColliderDesc.cuboid(hx, hy, hz).setTranslation(cx, cy, cz).setFriction(friction);
    if (rot) d.setRotation(rot);
    else if (rotY) d.setRotation({ x: 0, y: Math.sin(rotY / 2), z: 0, w: Math.cos(rotY / 2) });
    const c = this.world.createCollider(d, this.statics);
    if (owner) this.colliderOwners.set(c.handle, owner);
    return c;
  }
  cylinder(cx, cy, cz, r, hh, { owner = null } = {}) {
    const d = this.R.ColliderDesc.cylinder(hh, r).setTranslation(cx, cy, cz);
    const c = this.world.createCollider(d, this.statics);
    if (owner) this.colliderOwners.set(c.handle, owner);
    return c;
  }
  convex(points, { friction = 0.9 } = {}) {
    const d = this.R.ColliderDesc.convexHull(new Float32Array(points));
    if (!d) return null;
    d.setFriction(friction);
    return this.world.createCollider(d, this.statics);
  }
  trimesh(vertices, indices, { friction = 0.9 } = {}) {
    const d = this.R.ColliderDesc.trimesh(new Float32Array(vertices), new Uint32Array(indices)).setFriction(friction);
    return this.world.createCollider(d, this.statics);
  }
  // Adds a static trimesh from a world-space BufferGeometry.
  trimeshFromGeometry(geo, opts) {
    const g = geo.index ? geo : geo;
    const pos = g.attributes.position.array;
    let idx;
    if (g.index) idx = g.index.array; else { idx = new Uint32Array(pos.length / 3); for (let i = 0; i < idx.length; i++) idx[i] = i; }
    return this.trimesh(pos, idx, opts);
  }

  // ------------------------------------------------------------ dynamics
  dynamicBody(pos, quat, { mass, com = { x: 0, y: 0, z: 0 }, inertia, linDamp = 0.05, angDamp = 0.3, ccd = false } = {}) {
    const d = this.R.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z)
      .setLinearDamping(linDamp).setAngularDamping(angDamp).setCanSleep(true);
    if (quat) d.setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w });
    if (mass) d.setAdditionalMassProperties(mass, com, inertia ?? { x: mass, y: mass, z: mass }, { x: 0, y: 0, z: 0, w: 1 });
    if (ccd) d.setCcdEnabled(true);
    return this.world.createRigidBody(d);
  }

  removeBody(body) {
    if (!body) return;
    this.world.removeRigidBody(body);
  }

  // ------------------------------------------------------------ queries
  // Raycast against the world; returns {toi, point, normal, collider} or null.
  ray(origin, dir, maxToi = 100, { exclude = null, filterGroups } = {}) {
    const r = new this.R.Ray(origin, dir);
    const hit = this.world.castRayAndGetNormal(r, maxToi, true, undefined, filterGroups, undefined, exclude ?? undefined);
    if (!hit) return null;
    const t = hit.timeOfImpact ?? hit.toi;
    return {
      toi: t,
      point: new THREE.Vector3(origin.x + dir.x * t, origin.y + dir.y * t, origin.z + dir.z * t),
      normal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z),
      collider: hit.collider,
    };
  }

  groundHeight(x, z, from = 60) {
    const h = this.ray({ x, y: from, z }, { x: 0, y: -1, z: 0 }, from + 5);
    return h ? h.point.y : 0;
  }

  // ------------------------------------------------------------ stepping
  step(dt, onFixed) {
    this.acc = Math.min(this.acc + dt, 0.1);
    let steps = 0;
    while (this.acc >= this.fixed) {
      onFixed?.(this.fixed);
      for (const fn of this.preStep) fn(this.fixed);
      this.world.step();
      this.acc -= this.fixed;
      steps++;
    }
    return steps;
  }

  get alpha() { return this.acc / this.fixed; }
}

export { RAPIER };
