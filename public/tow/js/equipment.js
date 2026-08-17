// The gear in the compartments and everything you do with it: jump box, straps
// and ratchets, the winch and its cable, the impact wrench, cones and chocks.
import * as THREE from 'three';
import { box, cyl, clamp, lerp, damp, TAU } from './util.js';
import { mat, lightMat } from './materials.js';
import { deckAnchor } from './towtrucks.js';

/* ------------------------------------------------------------- tool models */

export function buildJumpBox() {
  const g = new THREE.Group();
  g.add(box(0.36, 0.26, 0.2, mat(0xf0c419, { roughness: 0.6 }), 0, 0.13, 0));
  g.add(box(0.38, 0.05, 0.22, mat(0x1c1e22), 0, 0.28, 0));
  g.add(box(0.14, 0.08, 0.02, lightMat(0x2ecc71, 0.8), -0.08, 0.18, 0.11));
  g.add(box(0.1, 0.03, 0.02, mat(0x14161a), 0.09, 0.18, 0.11));
  // Handle + cables
  g.add(box(0.2, 0.03, 0.03, mat(0x2b2e33), 0, 0.33, 0));
  for (const [s, col] of [[-1, 0xc0392b], [1, 0x14151a]]) {
    const cable = cyl(0.015, 0.34, mat(col, { roughness: 0.9 }), s * 0.12, 0.05, 0.14);
    cable.rotation.x = 0.9;
    g.add(cable);
    g.add(box(0.06, 0.1, 0.12, mat(col), s * 0.12, -0.04, 0.26));
  }
  g.userData.tool = 'jumpbox';
  return g;
}

export function buildStrapCoil() {
  const g = new THREE.Group();
  const strapM = mat(0xd8a018, { roughness: 0.95 });
  for (let i = 0; i < 4; i++) {
    g.add(box(0.24, 0.03, 0.18 - i * 0.02, strapM, 0, 0.04 + i * 0.035, 0));
  }
  g.add(box(0.12, 0.12, 0.1, mat(0x9aa0a8, { metalness: 0.7 }), 0, 0.12, 0.12));
  g.userData.tool = 'strap';
  return g;
}

export function buildDrill() {
  const g = new THREE.Group();
  g.add(box(0.12, 0.16, 0.3, mat(0xe8590c, { roughness: 0.6 }), 0, 0.2, 0));
  g.add(box(0.1, 0.2, 0.12, mat(0x1c1e22), 0, 0.06, -0.06));
  g.add(cyl(0.045, 0.14, mat(0x8b9099, { metalness: 0.8 }), 0, 0.2, 0.2));
  g.rotation.x = Math.PI / 2;
  g.userData.tool = 'drill';
  return g;
}

export function buildCone() {
  const g = new THREE.Group();
  g.add(box(0.34, 0.04, 0.34, mat(0xe8590c, { roughness: 0.9 }), 0, 0.02, 0));
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.55, 10), mat(0xf4661b, { roughness: 0.85 }));
  c.position.y = 0.3; c.castShadow = true;
  g.add(c);
  const band = new THREE.Mesh(new THREE.ConeGeometry(0.105, 0.1, 10), mat(0xf2f3f0));
  band.position.y = 0.36;
  g.add(band);
  g.userData.tool = 'cone';
  return g;
}

export function buildChock() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.28), mat(0xf0c419));
  m.geometry.attributes.position.array.forEach(() => {});
  g.add(m);
  g.userData.tool = 'chock';
  return g;
}

export function buildHook() {
  const g = new THREE.Group();
  g.add(box(0.1, 0.16, 0.1, mat(0x9aa0a8, { metalness: 0.8, roughness: 0.3 }), 0, 0.08, 0));
  const c = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.028, 8, 14, Math.PI * 1.4), mat(0x8b9099, { metalness: 0.85 }));
  c.position.y = -0.04; c.rotation.x = Math.PI / 2; c.rotation.z = 0.6;
  c.castShadow = true;
  g.add(c);
  g.add(box(0.14, 0.05, 0.05, mat(0xc0392b), 0, 0.18, 0));
  g.userData.tool = 'hook';
  return g;
}

export function buildFuelCan() {
  const g = new THREE.Group();
  g.add(box(0.24, 0.36, 0.16, mat(0xc0392b, { roughness: 0.7 }), 0, 0.18, 0));
  g.add(box(0.1, 0.06, 0.1, mat(0x8e2a20), 0, 0.39, 0));
  g.add(box(0.16, 0.04, 0.04, mat(0x1c1e22), 0, 0.38, -0.06));
  const spout = cyl(0.03, 0.3, mat(0xf0c419), 0, 0.34, 0.12);
  spout.rotation.x = 0.9;
  g.add(spout);
  g.userData.tool = 'fuelcan';
  return g;
}

export function buildSlimJim() {
  const g = new THREE.Group();
  g.add(box(0.04, 0.02, 0.9, mat(0xb9bec6, { metalness: 0.8, roughness: 0.3 }), 0, 0, 0));
  g.add(box(0.05, 0.03, 0.12, mat(0x1c1e22), 0, 0, -0.42));
  g.userData.tool = 'slimjim';
  return g;
}

const TOOL_BUILDERS = {
  jumpbox: buildJumpBox, strap: buildStrapCoil, drill: buildDrill,
  cone: buildCone, chock: buildChock, hook: buildHook,
  fuelcan: buildFuelCan, slimjim: buildSlimJim,
};

export const TOOL_LABELS = {
  jumpbox: 'Jump box', strap: 'Ratchet strap', drill: 'Impact wrench',
  cone: 'Safety cone', chock: 'Wheel chock', hook: 'Winch hook', tire: 'Wheel',
  fuelcan: 'Fuel can', slimjim: 'Slim jim',
};

// What lives in each compartment. Every truck has at least two boxes per side,
// and the first two on each side already cover the whole kit — so no job is
// ever un-doable because you picked the small wrecker.
export const COMPARTMENTS = {
  driver: [
    ['jumpbox', 'drill'],
    ['strap', 'chock'],
    ['strap', 'jumpbox'],
    ['drill', 'strap'],
  ],
  kerb: [
    ['cone', 'fuelcan'],
    ['slimjim', 'cone'],
    ['fuelcan', 'strap'],
    ['chock', 'cone'],
  ],
};

export function compartmentKit(side, slot) {
  const list = side < 0 ? COMPARTMENTS.driver : COMPARTMENTS.kerb;
  return list[slot % list.length];
}

/* ------------------------------------------------------------------ the rig */

export class TowRig {
  constructor(scene, city, audio) {
    this.scene = scene;
    this.city = city;
    this.audio = audio;
    this.truck = null;
    this.carried = null;          // { type, mesh }
    this.props = [];              // dropped props in the world
    this.hook = buildHook();
    this.hook.visible = false;
    scene.add(this.hook);
    this.hookState = 'stowed';    // stowed | carried | attached
    this.hookTarget = null;
    this.hookPos = new THREE.Vector3();
    this.ropeLength = 0;
    this.maxRope = 22;
    this.tension = 0;

    // Cable: a tube rebuilt each frame so it can sag and snap taut.
    this.ropeMat = mat(0x22262b, { roughness: 0.7, metalness: 0.3 });
    this.rope = new THREE.Mesh(new THREE.BufferGeometry(), this.ropeMat);
    this.rope.frustumCulled = false;
    this.rope.visible = false;
    scene.add(this.rope);

    this.straps = [];             // { point, mesh, attached, tension }
    this.strapGroup = new THREE.Group();
    scene.add(this.strapGroup);

    this.load = null;             // { vehicle, offsetZ, offsetX, lean, secured }
    this.winching = 0;
    this.jumperAttached = false;
    this.events = new Map();
  }

  on(name, fn) {
    if (!this.events.has(name)) this.events.set(name, []);
    this.events.get(name).push(fn);
  }
  emit(name, payload) {
    for (const fn of this.events.get(name) || []) fn(payload);
  }

  setTruck(truck) {
    this.truck = truck;
    this.resetStraps();
    this.hookState = 'stowed';
    this.hookTarget = null;
  }

  resetStraps() {
    for (const s of this.straps) this.strapGroup.remove(s.mesh);
    this.straps = [];
  }

  /* ---------------------------------------------------------- carrying */

  takeTool(type) {
    if (this.carried) return false;
    const mesh = (TOOL_BUILDERS[type] || buildStrapCoil)();
    mesh.userData.tool = type;
    this.scene.add(mesh);
    this.carried = { type, mesh };
    this.audio.click();
    this.emit('take', type);
    return true;
  }

  takeExisting(type, mesh) {
    if (this.carried) return false;
    this.carried = { type, mesh };
    if (!mesh.parent) this.scene.add(mesh);
    this.emit('take', type);
    return true;
  }

  dropCarried(pos, yaw = 0) {
    if (!this.carried) return null;
    const { type, mesh } = this.carried;
    mesh.position.copy(pos);
    mesh.rotation.set(0, yaw, 0);
    if (type === 'tire') mesh.rotation.z = Math.PI / 2;
    this.props.push({ type, mesh });
    this.carried = null;
    this.audio.clunk();
    this.emit('drop', type);
    return { type, mesh };
  }

  consumeCarried() {
    if (!this.carried) return null;
    const c = this.carried;
    this.scene.remove(c.mesh);
    this.carried = null;
    return c;
  }

  updateCarried(character) {
    if (!this.carried) return;
    // Held out in front of the chest with both hands — matches the carry pose
    // the character animation puts the arms into.
    const torso = character.userData.torso;
    torso.updateWorldMatrix(true, false);
    const p = new THREE.Vector3(0, 0.42, 0.52).applyMatrix4(torso.matrixWorld);
    this.carried.mesh.position.copy(p);
    this.carried.mesh.rotation.y = character.rotation.y;
    if (this.carried.type === 'tire') {
      this.carried.mesh.rotation.set(0, character.rotation.y, Math.PI / 2);
      this.carried.mesh.position.y += 0.1;
    }
  }

  /* ------------------------------------------------------------- winch */

  get winchAnchorWorld() {
    if (!this.truck) return new THREE.Vector3();
    const a = this.truck.userData.winchAnchor;
    a.updateWorldMatrix(true, false);
    return new THREE.Vector3().setFromMatrixPosition(a.matrixWorld);
  }

  takeHook() {
    if (this.hookState !== 'stowed' || this.carried) return false;
    this.hookState = 'carried';
    this.hook.visible = true;
    this.rope.visible = true;
    this.carried = { type: 'hook', mesh: this.hook };
    this.audio.clunk();
    this.emit('hook_taken');
    return true;
  }

  stowHook() {
    this.hookState = 'stowed';
    this.hookTarget = null;
    this.hook.visible = false;
    this.rope.visible = false;
    if (this.carried?.type === 'hook') this.carried = null;
  }

  attachHook(vehicle) {
    if (this.hookState !== 'carried') return false;
    this.hookState = 'attached';
    this.hookTarget = vehicle;
    if (this.carried?.type === 'hook') this.carried = null;
    this.audio.clunk();
    this.emit('hook_attached', vehicle);
    return true;
  }

  releaseHook() {
    if (this.hookState === 'attached') {
      this.hookState = 'carried';
      this.carried = { type: 'hook', mesh: this.hook };
      this.hookTarget = null;
      this.emit('hook_released');
    }
  }

  updateRope(dt, playerPos) {
    if (!this.truck || this.hookState === 'stowed') { this.rope.visible = false; return; }
    const anchor = this.winchAnchorWorld;
    if (this.hookState === 'carried') {
      const p = playerPos.clone();
      p.y += 0.5;
      const d = p.distanceTo(anchor);
      if (d > this.maxRope) {
        // Cable is out of line — the hook lags behind at full extension.
        p.sub(anchor).setLength(this.maxRope).add(anchor);
      }
      this.hookPos.lerp(p, 1 - Math.exp(-18 * dt));
    } else if (this.hookState === 'attached' && this.hookTarget) {
      const t = this.hookTarget;
      const spec = t.userData.spec;
      const local = new THREE.Vector3(0, (spec?.rideH ?? 0.3) * 0.6, (spec?.L ?? 4) / 2 - 0.1);
      t.updateMatrixWorld(true);
      this.hookPos.copy(t.localToWorld(local));
    }
    this.hook.position.copy(this.hookPos);
    this.hook.lookAt(anchor);

    // Catenary-ish sag that pulls flat as tension rises.
    const dist = anchor.distanceTo(this.hookPos);
    const slack = clamp(1 - this.tension, 0, 1) * Math.min(2.2, dist * 0.18);
    const pts = [];
    const N = 10;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const p = new THREE.Vector3().lerpVectors(anchor, this.hookPos, t);
      p.y -= Math.sin(t * Math.PI) * slack;
      pts.push(p);
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, 12, 0.035 + this.tension * 0.01, 5, false);
    this.rope.geometry.dispose();
    this.rope.geometry = geo;
    this.rope.visible = true;
    this.tension = damp(this.tension, this.winching > 0 ? 1 : (this.hookState === 'attached' ? 0.35 : 0), 4, dt);
  }

  /* -------------------------------------------------------- winching in */

  // Drags the hooked vehicle toward the deck. Returns 0..1 progress.
  winchIn(dt, truckCtl) {
    if (this.hookState !== 'attached' || !this.hookTarget) return 0;
    const v = this.hookTarget;
    const bed = this.truck.userData.bed;
    this.winching = 0.25;
    this.audio.winch(true);

    const target = deckAnchor(this.truck, 0);
    const dir = new THREE.Vector3(target.x - v.position.x, 0, target.z - v.position.z);
    const dist = dir.length();
    dir.normalize();

    const speed = 1.15;
    const step = Math.min(dist, speed * dt);
    v.position.x += dir.x * step;
    v.position.z += dir.z * step;

    // The hook is on the car's nose, so it comes up the deck facing the cab —
    // same heading as the truck, not opposite it.
    const truckYaw = truckCtl ? truckCtl.yaw : this.truck.rotation.y;
    const want = truckYaw;
    let dyaw = ((want - v.rotation.y + Math.PI * 3) % TAU) - Math.PI;
    v.rotation.y += dyaw * Math.min(1, dt * 1.6);

    // Climb the tilted deck: ride the ramp, nose up, then settle.
    const onRamp = clamp(1 - dist / (bed.length * 0.9), 0, 1);
    const deckWorldY = target.y;
    const groundY = this.city.heightAt(v.position.x, v.position.z);
    v.position.y = lerp(groundY, deckWorldY, onRamp * onRamp);
    v.rotation.x = -bed.tilt * 0.34 * onRamp;
    // The classic winch judder.
    v.position.y += Math.sin(performance.now() * 0.02) * 0.012 * (1 - onRamp);

    if (dist < 0.35) {
      this.completeLoad(v);
      return 1;
    }
    return clamp(1 - dist / (bed.length * 1.2), 0, 1);
  }

  completeLoad(vehicle) {
    const bed = this.truck.userData.bed;
    bed.pivot.attach(vehicle);
    vehicle.position.set(0, bed.deckY, bed.length * 0.5);
    vehicle.rotation.set(0, 0, 0);
    this.load = {
      vehicle, offsetZ: 0, offsetX: 0, lean: 0, secured: false,
      mass: vehicle.userData.spec?.L * 400 || 1400, slid: 0,
    };
    this.hookState = 'attached';
    this.audio.thud();
    this.emit('loaded', vehicle);
  }

  unloadVehicle() {
    if (!this.load) return null;
    const v = this.load.vehicle;
    const world = new THREE.Vector3();
    v.getWorldPosition(world);
    const q = new THREE.Quaternion();
    v.getWorldQuaternion(q);
    this.scene.attach(v);
    v.position.copy(world);
    v.quaternion.copy(q);
    v.position.y = this.city.heightAt(world.x, world.z);
    v.rotation.x = 0; v.rotation.z = 0;
    const out = this.load.vehicle;
    this.load = null;
    this.resetStraps();
    this.emit('unloaded', out);
    return out;
  }

  /* ------------------------------------------------------------- straps */

  strapPointsFree() {
    if (!this.truck) return [];
    return this.truck.userData.strapPoints.filter((p) => !this.straps.some((s) => s.point === p));
  }

  attachStrap(point) {
    if (!this.truck || !this.load) return false;
    if (this.straps.some((s) => s.point === point)) return false;
    const strapM = mat(0xd8a018, { roughness: 0.95 });
    const g = new THREE.Group();
    const band = box(0.12, 0.04, 1, strapM, 0, 0, 0);
    g.add(band);
    const ratchet = box(0.16, 0.14, 0.2, mat(0x9aa0a8, { metalness: 0.7 }), 0, 0, 0);
    g.add(ratchet);
    this.strapGroup.add(g);
    this.straps.push({ point, mesh: g, band, ratchet, attached: true, tension: 0 });
    this.audio.clunk();
    this.emit('strap_attached', this.straps.length);
    return true;
  }

  tightenStrap(strap, dt) {
    if (!strap || strap.tension >= 1) return false;
    strap.tension = clamp(strap.tension + dt * 0.75, 0, 1);
    if (Math.random() < dt * 14) this.audio.ratchet();
    if (strap.tension >= 1) {
      this.audio.clunk();
      this.emit('strap_tight', this.securedCount);
    }
    return true;
  }

  get securedCount() { return this.straps.filter((s) => s.tension >= 0.98).length; }
  get strapsNeeded() { return 4; }

  updateStraps(dt) {
    if (!this.truck) return;
    const load = this.load;
    for (const s of this.straps) {
      const p = s.point.mesh;
      p.updateWorldMatrix(true, false);
      const from = new THREE.Vector3().setFromMatrixPosition(p.matrixWorld);
      let to;
      if (load) {
        // Over the nearest tire of the loaded car.
        const v = load.vehicle;
        v.updateWorldMatrix(true, false);
        const spec = v.userData.spec;
        const lz = s.point.z < this.truck.userData.bed.length / 2 ? -1 : 1;
        const local = new THREE.Vector3(
          Math.sign(s.point.x) * (spec?.W ?? 1.8) * 0.42,
          (spec?.wheelR ?? 0.33) * 0.9,
          lz * (spec?.wb ?? 2.6) * 0.5,
        );
        to = v.localToWorld(local);
      } else {
        to = from.clone().add(new THREE.Vector3(0, -0.6, 0));
      }
      const mid = from.clone().lerp(to, 0.5);
      const sag = (1 - s.tension) * 0.35;
      mid.y -= sag;
      const len = from.distanceTo(to) + sag * 0.8;
      s.mesh.position.copy(mid);
      s.mesh.lookAt(to);
      // box() bakes the size into mesh.scale, so keep the webbing's own
      // cross-section and only stretch it along its length.
      s.band.scale.set(0.11, 0.03 + s.tension * 0.012, len);
      s.band.material = s.tension >= 0.98 ? mat(0xf2c204, { roughness: 0.8 }) : mat(0xa8801a, { roughness: 0.95 });
      s.ratchet.position.set(0, 0, len * 0.32);
    }
  }

  /* ---------------------------------------------- load physics while driving */

  updateLoad(dt, truckCtl) {
    const load = this.load;
    if (!load || !this.truck) return;
    const v = load.vehicle;
    const secured = this.securedCount;
    load.secured = secured >= 4;
    const looseness = clamp(1 - secured / 4, 0, 1);

    if (looseness <= 0.001) {
      load.offsetZ = damp(load.offsetZ, 0, 6, dt);
      load.offsetX = damp(load.offsetX, 0, 6, dt);
      load.lean = damp(load.lean, 0, 6, dt);
    } else {
      // Unsecured cars do exactly what you'd expect: they wander.
      const accel = (truckCtl.speed - (load.lastSpeed ?? truckCtl.speed)) / Math.max(dt, 1e-3);
      load.lastSpeed = truckCtl.speed;
      const lateral = Math.tan(truckCtl.steer) * truckCtl.speed * truckCtl.speed / Math.max(1, truckCtl.spec.wb) * 0.02;
      load.offsetZ = clamp(load.offsetZ - accel * dt * 0.09 * looseness, -2.6, 2.6);
      load.offsetX = clamp(load.offsetX + lateral * dt * looseness * 2.2, -1.6, 1.6);
      load.offsetZ += Math.sin(performance.now() * 0.004) * dt * 0.05 * looseness;
      load.lean = clamp(load.offsetX * 0.12, -0.2, 0.2);
      // Bed tilt makes it worse.
      load.offsetZ -= this.truck.userData.bed.tilt * dt * 1.4 * looseness;
      load.offsetZ = damp(load.offsetZ, load.offsetZ, 1, dt);
    }

    const bed = this.truck.userData.bed;
    v.position.set(load.offsetX, bed.deckY, bed.length * 0.5 + load.offsetZ);
    v.rotation.set(0, 0, load.lean);

    const off = Math.abs(load.offsetZ) > 2.4 || Math.abs(load.offsetX) > 1.45;
    if (off) {
      const dropped = this.unloadVehicle();
      if (dropped) {
        dropped.rotation.y += (Math.random() - 0.5) * 0.8;
        this.audio.thud();
        this.emit('load_lost', dropped);
      }
    }
  }

  update(dt, ctx) {
    this.updateRope(dt, ctx.playerPos);
    this.updateStraps(dt);
    if (ctx.truckCtl) this.updateLoad(dt, ctx.truckCtl);
    this.winching = Math.max(0, this.winching - dt);
    if (this.carried && ctx.character) this.updateCarried(ctx.character);
  }
}

/* -------------------------------------------------- jumper cable rendering */

export function makeJumperCables(scene) {
  const g = new THREE.Group();
  const red = mat(0xc0392b, { roughness: 0.9 });
  const black = mat(0x14151a, { roughness: 0.9 });
  const mk = (m) => {
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), m);
    mesh.frustumCulled = false;
    g.add(mesh);
    return mesh;
  };
  const cables = [mk(red), mk(black)];
  g.visible = false;
  scene.add(g);
  return {
    group: g,
    show(from, toPos, toNeg) {
      g.visible = true;
      [[toPos, 0.12], [toNeg, -0.12]].forEach(([to, off], i) => {
        const a = from.clone().add(new THREE.Vector3(off, 0.1, 0));
        const pts = [];
        for (let k = 0; k <= 8; k++) {
          const t = k / 8;
          const p = new THREE.Vector3().lerpVectors(a, to, t);
          p.y -= Math.sin(t * Math.PI) * 0.28;
          pts.push(p);
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        cables[i].geometry.dispose();
        cables[i].geometry = new THREE.TubeGeometry(curve, 10, 0.022, 5, false);
      });
    },
    hide() { g.visible = false; },
  };
}
