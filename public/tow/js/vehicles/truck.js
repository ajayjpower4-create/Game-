// The player's rollback at runtime: driving, the tilting/sliding carrier bed
// (its colliders move with it), the winch cable, ratchet straps, toolboxes,
// ELS light patterns, headlights and the live cab gauges/dispatch screen.
import * as THREE from 'three';
import { VehicleBase } from './vehicle.js';
import { TRUCK_BY_ID, buildTowTruck, poseBed } from './towtruck.js';
import { buildInterior, drawGauges, drawMDT } from './interior.js';
import * as M from '../materials.js';
import * as TX from '../textures.js';
import { clamp, damp, lerp } from '../util.js';
import { GROUPS, groups } from '../physics.js';

// Usable cable on the winch drum (m).
const MAX_CABLE = 30;

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
const X = new THREE.Vector3(1, 0, 0);

export class TowTruck extends VehicleBase {
  constructor(game, truckId, liveryIndex, pos, yaw) {
    super(game);
    const t = this.spec = TRUCK_BY_ID[truckId];
    this.model = buildTowTruck(t, liveryIndex);
    this.root = this.model.root;
    this.interior = buildInterior(t, this.model);
    this.root.add(this.interior.group);
    // The cab shell already shades the interior; its ~150 small parts don't
    // need to be drawn again into the shadow map.
    this.interior.group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    this.root.traverse((o) => { if (o.isMesh) o.userData.owner = this; });
    game.scene.add(this.root);
    this.mass = t.mass;
    this.engineForce = t.engine;
    this.brakeForce = this.mass * 7.5 / 240;
    this.topSpeed = t.topSpeed;
    this.maxSteer = t.cabover ? 0.66 : 0.58;
    this.reverseSpeed = 5;
    this.engineOn = false;
    this.parkingBrake = true;

    // ---- chassis colliders (truck-local)
    const c = t.cab, cs = this.model.cab;
    const zW = this.model.cabCenter + (this.model.cab ? 0 : 0);
    const cabSpec = this.model.cab ? null : null;
    const cabZW = this.model.cabCenter + (t.cabFront - t.cabBack) / 2 - c.hoodLen;
    const cols = [
      { part: 'hood', hx: c.W / 2 - 0.08, hy: (c.hoodY - c.gc) / 2, hz: Math.max(0.1, (t.cabFront - cabZW) / 2), x: 0, y: (c.hoodY + c.gc) / 2, z: (t.cabFront + cabZW) / 2 },
      { part: 'cab', hx: c.W / 2 - 0.02, hy: (c.H - c.gc) / 2, hz: (cabZW - t.cabBack) / 2, x: 0, y: (c.H + c.gc) / 2, z: (cabZW + t.cabBack) / 2 },
      { part: 'frame', hx: 0.5, hy: 0.16, hz: (t.cabFront - t.bed.pivotZ) / 2, x: 0, y: t.frameTop - 0.16, z: (t.cabFront + t.bed.pivotZ) / 2 },
      { part: 'bumper', hx: c.W / 2, hy: 0.12, hz: 0.1, x: 0, y: c.gc + 0.02, z: t.cabFront + 0.04 },
    ];
    for (const tb of this.model.toolboxes) {
      const cz = (t.toolbox.z0 + t.toolbox.z1) / 2;
      cols.push({ part: 'toolbox', hx: 0.23, hy: (t.toolbox.y1 - t.toolbox.y0) / 2, hz: (t.toolbox.z0 - t.toolbox.z1) / 2, x: tb.side * (t.bed.width / 2 - 0.25), y: (t.toolbox.y0 + t.toolbox.y1) / 2, z: cz });
    }
    const m = this.mass;
    const L = t.cabFront - t.bed.rear;
    this.createBody(pos, yaw, cols, {
      mass: m, com: { x: 0, y: t.frameTop - 0.15, z: (t.frontZ + t.rearZ) / 2 - 0.2 },
      inertia: { x: m * (2.2 * 2.2 + L * L) / 12, y: m * (2.4 * 2.4 + L * L) / 12, z: m * (2.4 * 2.4 + 2.2 * 2.2) / 12 },
      linDamp: 0.06, angDamp: 0.6,
    });

    // ---- wheels
    const rest = 0.24;
    const defs = [];
    for (const w of this.model.wheels) {
      defs.push({
        conn: new THREE.Vector3(w.x, t.tire.tireR + rest - 0.03, w.z), radius: t.tire.tireR, rest,
        front: w.front, drive: !w.front, side: w.side, pivot: w.pivot, spin: w.spin, removed: false,
      });
    }
    this.createController(defs, { stiffness: 42, compression: 4.6, relaxation: 3.0, travel: 0.16, slip: 2.6 });
    this.idleBrake = 0;

    // ---- the bed: colliders attached to the chassis, re-posed as it moves
    const bed = this.model.bed;
    this.bed = { tilt: 0, slide: 0, lever: 0, moving: false, maxTilt: t.maxTilt, slideMax: t.bed.slideMax };
    const W = bed.width;
    const tailLen = 0.5;
    this.bedCols = [];
    const addBed = (desc, local, part) => {
      desc.setDensity(0).setFriction(0.95).setCollisionGroups(groups(GROUPS.vehicle, 0xffff));
      const col = this.physics.world.createCollider(desc, this.body);
      col.userData = { vehicle: this, part };
      this.bedCols.push({ col, local });
    };
    const deckLen = bed.zFront - (bed.zRear + tailLen);
    addBed(this.R.ColliderDesc.cuboid(W / 2, 0.05, deckLen / 2), new THREE.Vector3(0, bed.deckY - 0.05, (bed.zFront + bed.zRear + tailLen) / 2), 'deck');
    const zr = bed.zRear;
    const hull = [];
    for (const sx of [-W / 2, W / 2]) hull.push(sx, bed.deckY, zr + tailLen, sx, bed.deckY - 0.16, zr + tailLen, sx, 0.015, zr, sx, -0.01, zr + 0.08);
    addBed(this.R.ColliderDesc.convexHull(new Float32Array(hull)), new THREE.Vector3(0, 0, 0), 'deck');
    for (const sx of [-1, 1]) addBed(this.R.ColliderDesc.cuboid(0.035, 0.05, (bed.zFront - bed.zRear) / 2 - 0.1), new THREE.Vector3(sx * (W / 2 + 0.035), bed.deckY + 0.02, (bed.zFront + bed.zRear) / 2), 'rail');
    addBed(this.R.ColliderDesc.cuboid(W / 2, 0.6, 0.06), new THREE.Vector3(0, bed.deckY + 0.6, bed.zFront - 0.04), 'headboard');
    addBed(this.R.ColliderDesc.cuboid(0.6, 0.12, (bed.zFront - bed.zRear) / 2 - 0.4), new THREE.Vector3(0, bed.deckY - 0.2, (bed.zFront + bed.zRear) / 2 + 0.2), 'under');
    this.updateBedColliders();

    // ---- winch, straps, misc state
    this.winch = {
      state: 'stowed', length: 0.5, hookPos: new THREE.Vector3(), attach: null, lever: 0, tension: 0, freeSpool: false,
      cable: null, hook: null,
    };
    this.straps = [];
    this.secured = new Map();        // car → joint
    this.carrying = new Map();       // car → relative matrix during bed motion
    this.els = 'off';
    this.headlights = false;
    this.work = false;
    this.hazard = false;
    this.horn = false;
    this.wipers = false;
    this.wiperT = 0;
    this.elsT = 0;
    this.gaugeT = 0;
    this.mdtState = { unit: 'T-' + t.id.toUpperCase() };
    this.mdtDirty = true;
    this.buildCable();
    poseBed(this.model, 0, 0);
  }

  // ---------------------------------------------------------- bed math
  // Matrix of the bed frame in truck-local coordinates.
  bedLocalMatrix(out = new THREE.Matrix4(), tilt = this.bed.tilt, slide = this.bed.slide) {
    const p = this.model.bed.pivot.position;
    _q.setFromAxisAngle(X, -tilt);
    out.compose(p, _q, _a.set(1, 1, 1));
    _m2.makeTranslation(0, 0, -slide);
    return out.multiply(_m2);
  }
  bedWorldMatrix(out = new THREE.Matrix4()) {
    _m.compose(this.curPos, this.curQuat, _a.set(1, 1, 1));
    return out.multiplyMatrices(_m, this.bedLocalMatrix(_m2.clone()));
  }
  bedPointWorld(local, out = new THREE.Vector3()) {
    return out.copy(local).applyMatrix4(this.bedWorldMatrix(new THREE.Matrix4()));
  }

  updateBedColliders() {
    const bm = this.bedLocalMatrix(new THREE.Matrix4());
    const rot = new THREE.Quaternion().setFromRotationMatrix(bm);
    for (const { col, local } of this.bedCols) {
      const p = local.clone().applyMatrix4(bm);
      col.setTranslationWrtParent({ x: p.x, y: p.y, z: p.z });
      col.setRotationWrtParent({ x: rot.x, y: rot.y, z: rot.z, w: rot.w });
    }
  }

  // Is this car sitting on (or being dragged up) the deck?
  onBed(car) {
    const inv = this.bedWorldMatrix(new THREE.Matrix4()).invert();
    const p = car.curPos.clone().applyMatrix4(inv);
    const b = this.model.bed;
    return Math.abs(p.x) < b.width / 2 + 0.4 && p.z > b.zRear - 0.6 && p.z < b.zFront + 0.2 && p.y > b.deckY - 0.5 && p.y < b.deckY + 0.9;
  }
  // Fully aboard: every wheel ahead of the tail and the bed flat.
  loaded(car) {
    if (!this.onBed(car)) return false;
    const inv = this.bedWorldMatrix(new THREE.Matrix4()).invert();
    const s = car.model.spec;
    const rear = car.localToWorld(new THREE.Vector3(0, 0, -s.L / 2 + 0.2)).applyMatrix4(inv);
    const front = car.localToWorld(new THREE.Vector3(0, 0, s.L / 2 - 0.2)).applyMatrix4(inv);
    const b = this.model.bed;
    return Math.min(rear.z, front.z) > b.zRear + 0.15 && Math.max(rear.z, front.z) < b.zFront + 0.1;
  }

  // ------------------------------------------------------------- step
  fixedUpdate(dt) {
    super.fixedUpdate(dt);
    const bed = this.bed;
    const prevTilt = bed.tilt, prevSlide = bed.slide;
    bed.blocked = '';
    if (bed.lever !== 0) {
      if (!this.parkingBrake) bed.blocked = 'Set the parking brake before working the bed.';
      else if (bed.lever > 0) {
        if (bed.tilt < bed.maxTilt) bed.tilt = Math.min(bed.maxTilt, bed.tilt + dt * 0.055);
        else bed.slide = Math.min(bed.slideMax, bed.slide + dt * 0.42);
      } else {
        if (bed.slide > 0) bed.slide = Math.max(0, bed.slide - dt * 0.42);
        else bed.tilt = Math.max(0, bed.tilt - dt * 0.055);
      }
    }
    bed.moving = bed.tilt !== prevTilt || bed.slide !== prevSlide;
    if (bed.moving) {
      // Cars on the deck ride along with it (held by the winch, straps or their parking brake).
      for (const car of this.game.cars) {
        if (car.driven || car.body == null) continue;
        if (!this.carrying.has(car) && (this.onBed(car) || this.secured.has(car))) {
          if (this.secured.has(car)) { this.physics.world.removeImpulseJoint(this.secured.get(car), true); this.secured.delete(car); car.wasSecured = true; }
          const rel = this.bedWorldMatrix(new THREE.Matrix4()).invert().multiply(new THREE.Matrix4().compose(car.curPos, car.curQuat, _a.set(1, 1, 1)));
          this.carrying.set(car, rel);
          car.setKinematic(true);
        }
      }
      this.updateBedColliders();
    }
    if (this.carrying.size) {
      const bw = this.bedWorldMatrix(new THREE.Matrix4());
      for (const [car, rel] of this.carrying) {
        const mw = bw.clone().multiply(rel);
        const p = new THREE.Vector3(), q = new THREE.Quaternion();
        mw.decompose(p, q, _a);
        car.body.setNextKinematicTranslation({ x: p.x, y: p.y, z: p.z });
        car.body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
        if (!bed.moving) {
          car.setKinematic(false);
          car.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
          car.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
          this.carrying.delete(car);
          if (car.wasSecured) { car.wasSecured = false; this.secure(car); }
        }
      }
    }
    this.fixedWinch(dt);
    this.fixedStraps(dt);
  }

  // ------------------------------------------------------------ winch
  fairleadWorld(out = new THREE.Vector3()) { return this.bedPointWorld(this.model.bed.winchPoint, out); }
  tailRollerWorld(out = new THREE.Vector3()) { const b = this.model.bed; return this.bedPointWorld(_d.set(0, 0.1, b.zRear + 0.05), out); }
  deckTailWorld(out = new THREE.Vector3()) { const b = this.model.bed; return this.bedPointWorld(_d.set(0, b.deckY + 0.05, b.zRear + 0.55), out); }

  // Cable path from drum to hook, wrapping over the tail when the hook is behind/below it.
  cablePath(hook) {
    const f = this.fairleadWorld(new THREE.Vector3());
    const inv = this.bedWorldMatrix(new THREE.Matrix4()).invert();
    const hl = hook.clone().applyMatrix4(inv);
    const b = this.model.bed;
    if (hl.z < b.zRear + 0.6 || hl.y < b.deckY - 0.2) {
      const dt = this.deckTailWorld(new THREE.Vector3());
      const tr = this.tailRollerWorld(new THREE.Vector3());
      // Only wrap the roller if the hook hangs below the deck line.
      if (hl.y < b.deckY - 0.05) return [f, dt, tr, hook.clone()];
      return [f, dt, hook.clone()];
    }
    return [f, hook.clone()];
  }
  static pathLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += pts[i].distanceTo(pts[i - 1]); return L; }

  hookWorld(out = new THREE.Vector3()) {
    const w = this.winch;
    if (w.state === 'attached' && w.attach) return w.attach.car.localToWorld(w.attach.local, out);
    if (w.state === 'stowed') return this.deckTailWorld(out);
    return out.copy(w.hookPos);
  }

  fixedWinch(dt) {
    const w = this.winch;
    const lever = w.lever;
    if (lever !== 0 && !this.parkingBrake) { w.blocked = 'Set the parking brake before running the winch.'; }
    else w.blocked = '';
    const running = lever !== 0 && !w.blocked;
    const hook = this.hookWorld(_c);
    const path = this.cablePath(hook);
    const d = TowTruck.pathLen(path);
    if (w.state === 'held' || w.state === 'dropped') {
      // There's only so much cable on the drum: walking off with the hook
      // makes you let go of it, and driving off drags a dropped hook along.
      if (d > MAX_CABLE) {
        if (w.state === 'held') {
          this.game.tools.drop();
          this.game.hud.toast('That\u2019s all the cable on the drum \u2014 you had to let go of the hook.', 3);
        } else {
          const toward = path[path.length - 2];
          w.hookPos.lerp(toward, (d - MAX_CABLE) / Math.max(0.01, hook.distanceTo(toward)));
          const gh = this.physics.ray({ x: w.hookPos.x, y: w.hookPos.y + 1.5, z: w.hookPos.z }, { x: 0, y: -1, z: 0 }, 4, { excludeBody: this.body });
          if (gh) w.hookPos.y = Math.max(w.hookPos.y, gh.point.y + 0.05);
        }
      }
      w.length = Math.min(Math.max(w.length, d), MAX_CABLE);
      if (running && lever > 0) {
        w.length = Math.max(0.5, w.length - 0.6 * dt);
        if (w.state === 'dropped' && d > w.length) {
          // Drag the loose hook toward the truck.
          const dir = path[path.length - 2].clone().sub(hook).normalize();
          w.hookPos.addScaledVector(dir, 0.6 * dt);
          if (d < 1.0) this.stowHook();
        }
      } else if (running && lever < 0) w.length += 0.6 * dt;
    } else if (w.state === 'attached') {
      if (running) w.length = clamp(w.length - lever * 0.38 * dt, 0.4, 40);
      // The drum clutch slips while the bed tilts or slides, so moving the bed
      // never yanks a hooked car; only reeling in builds tension.
      else if (this.bed.moving) w.length = Math.max(w.length, d);
      const car = w.attach.car;
      w.tension = 0;
      if (d > w.length && car.body) {
        const end = path[path.length - 2];
        const dir = _a.copy(end).sub(hook).normalize();
        // Relative speed along the cable (positive = stretching).
        const cv = car.body.velocityAtPoint ? car.body.velocityAtPoint({ x: hook.x, y: hook.y, z: hook.z }) : car.body.linvel();
        const tv = this.body.linvel();
        const rel = -((cv.x - tv.x) * dir.x + (cv.y - tv.y) * dir.y + (cv.z - tv.z) * dir.z);
        const T = clamp(52000 * (d - w.length) + 7000 * Math.max(0, rel), 0, 55000);
        w.tension = T;
        if (!car.kinematic) {
          car.body.applyImpulseAtPoint({ x: dir.x * T * dt, y: dir.y * T * dt, z: dir.z * T * dt }, { x: hook.x, y: hook.y, z: hook.z }, true);
        }
        const tp = path[path.length - 2];
        this.body.applyImpulseAtPoint({ x: -dir.x * T * dt, y: -dir.y * T * dt, z: -dir.z * T * dt }, { x: tp.x, y: tp.y, z: tp.z }, true);
      }
      // A winched car rolls freely (in neutral).
      car.parkedBrake = w.tension > 0 || running ? 0.4 : car.brakeForce * 2;
    }
    w.running = running;
  }

  stowHook() {
    const w = this.winch;
    if (w.attach?.car) w.attach.car.parkedBrake = w.attach.car.brakeForce * 2;
    w.state = 'stowed';
    w.attach = null;
    w.length = 0.5;
  }

  buildCable() {
    const mat = new THREE.MeshStandardMaterial({ color: 0x8c8f94, metalness: 0.9, roughness: 0.38, ...TX.wireRope() });
    this.cableMat = mat;
    this.cableMesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    this.cableMesh.castShadow = true;
    this.cableMesh.frustumCulled = false;
    this.game.scene.add(this.cableMesh);
    // Grab hook with a short chain bridle.
    const hook = new THREE.Group();
    const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.12, 10), M.std(0x3a3d42, 0.35, 0.9));
    shank.position.y = 0.06;
    const bend = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.016, 10, 20, Math.PI * 1.35), M.std(0xc0161a, 0.35, 0.6));
    bend.rotation.z = Math.PI * 0.85;
    bend.position.y = -0.03;
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.008, 8, 16), M.std(0x3a3d42, 0.35, 0.9));
    eye.position.y = 0.13;
    const latch = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.06, 0.01), M.chrome());
    latch.position.set(0.035, 0.0, 0);
    latch.rotation.z = 0.5;
    hook.add(shank, bend, eye, latch);
    hook.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.userData.part = 'winchHook'; o.userData.owner = this; } });
    this.hookMesh = hook;
    this.game.scene.add(hook);
  }

  updateCableVisual() {
    const w = this.winch;
    const hook = this.hookWorld(new THREE.Vector3());
    const pts = this.cablePath(hook);
    // Sag in the free span when there's slack.
    const d = TowTruck.pathLen(pts);
    const slack = Math.max(0, w.length - d);
    const curvePts = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const seg = a.distanceTo(b);
      const n = Math.max(2, Math.ceil(seg / 0.25));
      const free = i === pts.length - 2;
      const sag = free ? Math.min(1.2, Math.sqrt(slack * seg) * 0.45 + (w.state === 'attached' && w.tension > 100 ? 0 : 0.03 * seg)) : 0.0;
      for (let k = 0; k < n; k++) {
        const t = k / n;
        const p = a.clone().lerp(b, t);
        p.y -= sag * 4 * t * (1 - t);
        curvePts.push(p);
      }
    }
    curvePts.push(pts[pts.length - 1]);
    if (curvePts.length < 2) return;
    const curve = new THREE.CatmullRomCurve3(curvePts, false, 'centripetal');
    const segs = Math.min(160, curvePts.length * 2);
    const g = new THREE.TubeGeometry(curve, segs, 0.0075, 6, false);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * d * 20);
    this.cableMesh.geometry.dispose();
    this.cableMesh.geometry = g;
    // Hook orientation: hangs along the cable's last segment.
    this.hookMesh.position.copy(hook);
    const last = curvePts[curvePts.length - 2];
    const dir = _a.copy(last).sub(hook).normalize();
    this.hookMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  }

  // ----------------------------------------------------------- straps
  // A strap wraps a car's tire and hooks to a tie-down slot on the deck rail.
  addStrap(car, wheelIndex, anchorIndex) {
    const s = { car, wheel: wheelIndex, anchor: anchorIndex, tension: 0, clicks: 0, mesh: null, ratchet: null };
    this.model.bed.anchors[anchorIndex].used = true;
    s.mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ ...TX.webbing('#e8b41a'), roughness: 0.85, side: THREE.DoubleSide }));
    s.mesh.castShadow = true;
    s.mesh.frustumCulled = false;
    s.ratchet = buildRatchet();
    // A bigger invisible grab area: the ratchet is small and shifts as it tightens.
    const grab = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.3), M.pickProxy);
    grab.position.z = 0.07;
    s.ratchet.add(grab);
    s.ratchet.traverse((o) => { if (o.isMesh) { o.userData.part = 'ratchet'; o.userData.strap = s; o.userData.owner = this; } });
    this.game.scene.add(s.mesh, s.ratchet);
    this.straps.push(s);
    return s;
  }
  removeStrap(s) {
    this.game.scene.remove(s.mesh, s.ratchet);
    s.mesh.geometry.dispose();
    this.model.bed.anchors[s.anchor].used = false;
    this.straps = this.straps.filter((x) => x !== s);
    if (this.secured.has(s.car)) this.unsecure(s.car);
  }
  tighten(s) {
    s.clicks++;
    s.tension = Math.min(1, s.clicks / 6);
    const carStraps = this.straps.filter((x) => x.car === s.car);
    if (carStraps.length >= 4 && carStraps.every((x) => x.tension >= 1) && !this.secured.has(s.car) && this.loaded(s.car)) this.secure(s.car);
    return s.tension;
  }
  anchorWorld(i, out = new THREE.Vector3()) { return this.bedPointWorld(this.model.bed.anchors[i].local, out); }

  fixedStraps(dt) {
    for (const s of this.straps) {
      if (s.tension <= 0 || this.secured.has(s.car) || s.car.kinematic) continue;
      const w = s.car.wheels[s.wheel];
      if (!w) continue;
      const hub = s.car.localToWorld(_b.set(w.conn.x, w.conn.y - (s.car.ctrl.wheelSuspensionLength(s.wheel) ?? w.rest), w.conn.z));
      const an = this.anchorWorld(s.anchor, _c);
      const dir = _a.copy(an).sub(hub);
      const len = dir.length();
      if (len < 0.01) continue;
      dir.divideScalar(len);
      const F = 5200 * s.tension * s.tension;
      s.car.body.applyImpulseAtPoint({ x: dir.x * F * dt, y: dir.y * F * dt, z: dir.z * F * dt }, { x: hub.x, y: hub.y, z: hub.z }, true);
      this.body.applyImpulseAtPoint({ x: -dir.x * F * dt, y: -dir.y * F * dt, z: -dir.z * F * dt }, { x: an.x, y: an.y, z: an.z }, true);
    }
  }

  // Four tight straps lock the car to the truck (a fixed joint).
  secure(car) {
    if (this.secured.has(car)) return;
    const R = this.R;
    const inv = _q.copy(this.curQuat).invert();
    const anchor1 = car.curPos.clone().sub(this.curPos).applyQuaternion(inv);
    const frame1 = _q2.copy(inv).multiply(car.curQuat);
    const data = R.JointData.fixed({ x: anchor1.x, y: anchor1.y, z: anchor1.z }, { x: frame1.x, y: frame1.y, z: frame1.z, w: frame1.w }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, w: 1 });
    const j = this.physics.world.createImpulseJoint(data, this.body, car.body, true);
    j.setContactsEnabled?.(false);
    this.secured.set(car, j);
    car.suspended = true;
    car.secured = true;
  }
  unsecure(car) {
    const j = this.secured.get(car);
    if (j) this.physics.world.removeImpulseJoint(j, true);
    this.secured.delete(car);
    car.suspended = false;
    car.secured = false;
    car.body?.wakeUp();
  }

  updateStrapVisuals() {
    for (const s of this.straps) {
      const car = s.car;
      const w = car.wheels[s.wheel];
      const an = this.anchorWorld(s.anchor, new THREE.Vector3());
      const hub = new THREE.Vector3();
      w.pivot.getWorldPosition(hub);
      const r = car.model.spec.tireR;
      // Wrap: anchor → front of tread → over the top → back of tread → deck behind.
      const fwd = car.forward(new THREE.Vector3());
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(car.curQuat);
      const side = new THREE.Vector3().crossVectors(fwd, up).normalize();
      const toAnchor = an.clone().sub(hub);
      const sgn = Math.sign(toAnchor.dot(fwd)) || 1;
      const slack = 1 - s.tension;
      const pts = [an.clone().addScaledVector(up, 0.02)];
      const steps = 9;
      for (let k = 0; k <= steps; k++) {
        const a = (k / steps) * Math.PI; // from the anchor side over the top to the far side
        const ang = sgn > 0 ? a : Math.PI - a;
        const rr = r + 0.012 + slack * 0.05 * Math.sin(a);
        pts.push(hub.clone().addScaledVector(fwd, Math.cos(ang) * rr).addScaledVector(up, Math.sin(ang) * rr + 0.0));
      }
      const far = hub.clone().addScaledVector(fwd, -sgn * (r + 0.05)).addScaledVector(up, -r + 0.03);
      pts.push(far);
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      const g = ribbonGeometry(curve, 40, 0.05, side);
      s.mesh.geometry.dispose();
      s.mesh.geometry = g;
      // Ratchet sits a bit up the strap from the anchor.
      const rp = pts[0].clone().lerp(pts[1], 0.45);
      s.ratchet.position.copy(rp);
      s.ratchet.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pts[1].clone().sub(pts[0]).normalize());
      s.ratchet.userData.handle.rotation.x = -0.3 - s.tension * 0.9 + Math.sin(s.clicks * 2.1) * 0.2;
    }
  }

  // ---------------------------------------------------------- visuals
  update(dt, alpha) {
    this.syncVisual(alpha, this.root);
    poseBed(this.model, this.bed.tilt, this.bed.slide);
    // Levers lean while held.
    const lv = this.model.controls.levers;
    lv.bed.pivot.rotation.z = damp(lv.bed.pivot.rotation.z, this.bed.lever * 0.5, 12, dt);
    lv.winch.pivot.rotation.z = damp(lv.winch.pivot.rotation.z, this.winch.lever * 0.5, 12, dt);
    // Toolbox doors.
    for (const tb of this.model.toolboxes) {
      tb.open = damp(tb.open, tb.target, 7, dt);
      tb.doorPivot.rotation.z = -tb.side * tb.open * 1.45;
    }
    // Only draw the interior when you could actually see into the cab.
    this.interior.group.visible = this.game.camera.position.distanceTo(this.curPos) < 28;
    this.updateELS(dt);
    // Wipers: ~40 sweeps a minute; switching off lets the blades finish and park.
    if (this.wipers || this.wiperT % 1.5 > 0.05) {
      this.wiperT = (this.wiperT ?? 0) + dt;
      if (!this.wipers && this.wiperT % 1.5 > 1.45) this.wiperT = 0;
    }
    const sweep = (1 - Math.cos(((this.wiperT ?? 0) % 1.5) / 1.5 * Math.PI * 2)) / 2 * 1.45;
    for (const w of this.model.wipers) w.rotation.y = w.userData.sweep * sweep;
    // Lamps.
    const L = this.model.lamps;
    const braking = this.driven && this.controls.brake > 0.1 && this.speed > 0.3;
    const reversing = this.driven && this.gear === 'R' && this.speed < -0.05;
    const blink = this.hazard && (performance.now() % 1000) < 500;
    L.headMat.emissiveIntensity = this.headlights ? 2.2 : blink ? 1 : 0;
    L.headSpots[0].intensity = this.headlights ? 260 : 0;
    L.tailMat.emissiveIntensity = braking ? 2.6 : blink ? 1.8 : this.headlights ? 0.7 : 0;
    L.reverse.emissiveIntensity = reversing ? 2 : 0;
    L.work[0].intensity = this.work ? 90 : 0;
    this.reversing = reversing;
    // Interior: steering wheel follows the front wheels, gauges at 10 Hz.
    const I = this.interior;
    I.steerWheel.rotation.z = this.steerAngle * 7.5;
    I.pbKnob.position.z = this.parkingBrake ? -0.075 : -0.05;
    this.gaugeT -= dt;
    if (this.gaugeT <= 0) {
      this.gaugeT = 0.1;
      drawGauges(I.gaugeCanvas, {
        rpm: this.engineOn ? this.rpm : 0, mph: Math.abs(this.speed) * 2.237, gear: this.parkingBrake ? 'P' : this.gear,
        odo: 128440 + (this.odo || 0) / 1609, fuel: 0.78, parking: this.parkingBrake, els: this.els,
        turnL: false, turnR: false, high: false,
      });
      I.gaugeTex.needsUpdate = true;
    }
    if (this.mdtDirty) {
      this.mdtDirty = false;
      I.mdtButtons = drawMDT(I.mdtCanvas, this.mdtState);
      I.mdtTex.needsUpdate = true;
    }
    const B = I.buttons;
    const led = (id, on) => { B[id].led.material.emissiveIntensity = on ? 3 : 0; B[id].mat.emissiveIntensity = on ? 0.6 : 0.2; };
    led('els_slow', this.els === 'slow'); led('els_steady', this.els === 'steady'); led('els_off', this.els === 'off');
    led('work', this.work); led('hazard', this.hazard);
    if (Math.abs(this.speed) > 0.1) this.odo = (this.odo || 0) + Math.abs(this.speed) * dt;
    // Cable and straps.
    this.updateCableVisual();
    this.updateStrapVisuals();
  }

  updateELS(dt) {
    this.elsT += dt;
    const E = this.model.els;
    let a = 0, b = 0;
    if (this.els === 'steady') { a = b = 1; }
    else if (this.els === 'slow') {
      // Slow alternating amber: ~0.8 s per side with a soft LED ramp.
      const ph = (this.elsT % 1.6) / 1.6;
      const ramp = (x) => clamp(Math.sin(x * Math.PI) * 1.6, 0, 1);
      a = ph < 0.5 ? ramp(ph * 2) : 0;
      b = ph >= 0.5 ? ramp((ph - 0.5) * 2) : 0;
    }
    E.bankA.emissiveIntensity = a * 4;
    E.bankB.emissiveIntensity = b * 4;
    for (const l of E.lights) {
      const k = l.bank === 'AB' ? Math.max(a, b) : l.bank === 'R' ? Math.max(a, b) : 0;
      l.light.intensity = k * (l.bank === 'R' ? 26 : 40);
    }
  }

  setMDT(state) { Object.assign(this.mdtState, state); this.mdtDirty = true; }

  driverDoorWorld(out = new THREE.Vector3()) {
    const t = this.spec;
    return this.localToWorld(out.set(t.cab.W / 2 + 0.75, 0, this.interior.seatPos.z + 0.1), out);
  }
  controlStationWorld(out = new THREE.Vector3()) {
    const t = this.spec;
    return this.localToWorld(out.set(t.bed.width / 2 + 0.45, 0, t.controlZ), out);
  }

  dispose() {
    for (const s of [...this.straps]) this.removeStrap(s);
    this.game.scene.remove(this.cableMesh, this.hookMesh, this.root);
    super.dispose();
  }
}

// Flat ribbon along a curve (for webbing straps).
function ribbonGeometry(curve, segs, width, sideHint) {
  const pos = [], uv = [], idx = [];
  const pts = curve.getSpacedPoints(segs);
  let along = 0;
  for (let i = 0; i <= segs; i++) {
    const p = pts[i];
    if (i > 0) along += p.distanceTo(pts[i - 1]);
    const side = sideHint;
    pos.push(p.x + side.x * width / 2, p.y + side.y * width / 2, p.z + side.z * width / 2, p.x - side.x * width / 2, p.y - side.y * width / 2, p.z - side.z * width / 2);
    uv.push(0, along / 0.05, 1, along / 0.05);
  }
  for (let i = 0; i < segs; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function buildRatchet() {
  const g = new THREE.Group();
  const steel = M.std(0x9ea3a8, 0.3, 0.95);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.14), steel);
  g.add(frame);
  const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.06, 12), steel);
  spool.rotation.z = Math.PI / 2;
  g.add(spool);
  const handle = new THREE.Group();
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.16), steel);
  bar.position.z = 0.08;
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.025, 0.05), M.std(0x1a1a1a, 0.7));
  grip.position.z = 0.16;
  handle.add(bar, grip);
  handle.position.y = 0.02;
  g.add(handle);
  g.userData.handle = handle;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
