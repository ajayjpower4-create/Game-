// Ambient traffic: kinematic cars that follow lanes on the road graph,
// obey the coordinated signals and stop signs, keep their distance, and
// stop for you. Parked cars line the curbs near wherever you are.
import * as THREE from 'three';
import { instantiateStatic, randomPaint } from './vehicles/carbuilder.js';
import { getCarModel } from './vehicles/vehicle.js';
import { CATALOG } from './vehicles/catalog.js';
import { GRID, ARTERIAL, halfWidthAt, CURB, SIDEWALK } from './city/layout.js';
import { signalState } from './city/props.js';
import { Rng, clamp, damp } from './util.js';
import { GROUPS, groups } from './physics.js';

const _v = new THREE.Vector3();
const COMMON = ['civic', 'corolla', 'camry', 'accord', 'altima', 'rav4', 'crv', 'rogue', 'f150', 'silverado', 'elantra', 'malibu', 'explorer', 'tahoe', 'jetta', 'escape', 'tucson', 'sentra', 'odyssey', 'model3', 'grandcherokee', 'prius', 'wrangler', 'transit', 'ram1500', 'k5', 'outback', 'sonata', 'crownvic', 'tacoma'];

function polylineAt(pts, s, offset, out) {
  // Walk the polyline to arc length s, offset to the right of travel.
  let acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const L = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    if (acc + L >= s || i === pts.length - 2) {
      const t = L > 0 ? clamp((s - acc) / L, 0, 1) : 0;
      const dx = (b.x - a.x) / (L || 1), dz = (b.z - a.z) / (L || 1);
      out.x = a.x + (b.x - a.x) * t - dz * offset;
      out.y = a.y + (b.y - a.y) * t;
      out.z = a.z + (b.z - a.z) * t + dx * offset;
      out.yaw = Math.atan2(dx, dz);
      out.pitch = Math.atan2(b.y - a.y, Math.hypot(b.x - a.x, b.z - a.z));
      return out;
    }
    acc += L;
  }
  return out;
}

export class Traffic {
  constructor(game) {
    this.game = game;
    this.graph = game.city.graph;
    this.cars = [];
    this.rng = new Rng(99);
    this.density = 1;
    this.t = 0;
    this.edgeLen = this.graph.edges.map((e) => e.len);
  }

  laneOffset(e, lane) {
    if (e.kind === 'highway') return lane ? -1.85 : 1.85;   // highway polylines run on the lane divider
    if (e.kind === 'ramp') return 0;
    const a = e.pts[0], b = e.pts[e.pts.length - 1];
    const ns = Math.abs(b.z - a.z) > Math.abs(b.x - a.x);
    const c = ns ? a.x : a.z;
    const art = ARTERIAL.has(c) || Math.abs(c) === 720;
    return art ? (lane ? 1.7 : 5.1) : 1.7;
  }

  // Trim distances so cars stop at the stop line instead of the intersection center.
  trims(e) {
    if (e.kind !== 'street') return [4, 4];
    const crossHW = (node) => {
      const n = this.graph.nodes[node];
      const a = e.pts[0], b = e.pts[e.pts.length - 1];
      const ns = Math.abs(b.z - a.z) > Math.abs(b.x - a.x);
      return halfWidthAt(ns ? n.z : n.x) + 5;
    };
    return [crossHW(e.from), crossHW(e.to)];
  }

  spawn(focus, near = false) {
    const g = this.game;
    const edges = this.graph.edges;
    for (let tries = 0; tries < 30; tries++) {
      const e = edges[this.rng.int(0, edges.length - 1)];
      const s = this.rng.range(0, e.len);
      const p = polylineAt(e.pts, s, 0, {});
      const d = Math.hypot(p.x - focus.x, p.z - focus.z);
      if (d < (near ? 60 : 150) || d > 290) continue;
      if (Math.abs(p.y - focus.y) > 30) continue;
      const lane = e.kind === 'ramp' ? 0 : this.rng.int(0, 1);
      if (this.cars.some((c) => c.edge === e && c.lane === lane && Math.abs(c.s - s) < 15)) continue;
      const id = this.rng.pick(COMMON);
      const model = getCarModel(id);
      const paint = randomPaint(this.rng);
      const inst = instantiateStatic(model, { color: paint.color, metallic: paint.metallic });
      g.scene.add(inst.root);
      const sp = model.spec;
      const body = g.physics.world.createRigidBody(g.physics.R.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, p.y, p.z));
      g.physics.world.createCollider(g.physics.R.ColliderDesc.cuboid(sp.W / 2 - 0.05, (sp.H - sp.gc) / 2 - 0.05, sp.L / 2 - 0.05).setTranslation(0, sp.gc + (sp.H - sp.gc) / 2, 0)
        .setCollisionGroups(groups(GROUPS.vehicle, 0xffff)), body);
      const car = {
        id, model, inst, body, edge: e, lane, s, speed: e.speed * this.rng.range(0.7, 0.95), limitK: this.rng.range(0.85, 1.08),
        len: sp.L, wheelR: sp.tireR, spin: 0, stopT: 0, turn: null, pos: new THREE.Vector3(p.x, p.y, p.z), yaw: 0,
      };
      this.cars.push(car);
      return car;
    }
    return null;
  }

  remove(car) {
    this.game.scene.remove(car.inst.root);
    this.game.physics.world.removeRigidBody(car.body);
    this.cars = this.cars.filter((c) => c !== car);
  }

  chooseNext(car) {
    const e = car.edge;
    const node = this.graph.nodes[e.to];
    const opts = node.out.map((i) => this.graph.edges[i]).filter((n) => {
      if (n.to === e.from && n.kind === e.kind) return false; // no U-turns
      return true;
    });
    if (!opts.length) return null;
    // Prefer going straight; highway traffic mostly stays on the highway.
    const weights = opts.map((n) => {
      const a = e.pts[e.pts.length - 2], b = e.pts[e.pts.length - 1];
      const c = n.pts[1] ?? n.pts[0];
      const h1 = Math.atan2(b.x - a.x, b.z - a.z), h2 = Math.atan2(c.x - n.pts[0].x, c.z - n.pts[0].z);
      let d = Math.abs(h2 - h1); if (d > Math.PI) d = Math.PI * 2 - d;
      let w = d < 0.4 ? 3 : 1;
      if (e.kind === 'highway' && n.kind === 'ramp') w = 0.35;
      return w;
    });
    let r = this.rng.next() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < opts.length; i++) { r -= weights[i]; if (r <= 0) return opts[i]; }
    return opts[0];
  }

  // Obstacles the AI must not drive into: other cars ahead, your truck, job cars, you.
  gapAhead(car, fx, fz) {
    let best = 999;
    const px = car.pos.x, pz = car.pos.z;
    // halfLen: obstacle extent along our path; halfWid: how wide it is.
    const check = (x, z, y, halfLen, halfWid) => {
      if (Math.abs(y - car.pos.y) > 3) return;
      const dx = x - px, dz = z - pz;
      const along = dx * fx + dz * fz;
      if (along <= -halfLen || along > 45) return;
      const lat = Math.abs(dx * fz - dz * fx);
      if (lat > halfWid + 1.15) return;
      best = Math.min(best, along - halfLen - car.len / 2);
    };
    for (const o of this.cars) if (o !== car) check(o.pos.x, o.pos.z, o.pos.y, o.len / 2, 0.95);
    const g = this.game;
    if (g.truck) check(g.truck.curPos.x, g.truck.curPos.z, g.truck.curPos.y, 4.5, 1.3);
    for (const c of g.cars) check(c.curPos.x, c.curPos.z, c.curPos.y, 2.4, 1.0);
    if (g.player?.active) check(g.player.feet.x, g.player.feet.z, g.player.feet.y, 0.5, 0.4);
    return best;
  }

  update(dt) {
    const g = this.game;
    this.t += dt;
    const focus = g.focus();
    const target = Math.round(22 * this.density * (g.renderer.q.traffic ?? 1));
    // Spawn/despawn around you.
    for (const c of [...this.cars]) if (Math.hypot(c.pos.x - focus.x, c.pos.z - focus.z) > 340) this.remove(c);
    if (this.cars.length < target) this.spawn(focus, this.cars.length < target / 3);
    for (const car of this.cars) this.step(car, dt);
  }

  step(car, dt) {
    const e = car.edge;
    const [t0, t1] = this.trims(e);
    const endS = e.len - t1;
    // Target speed: limit, signal/stop sign, gap ahead.
    let target = e.speed * car.limitK;
    const p = car.turn ? null : polylineAt(e.pts, car.s, this.laneOffset(e, car.lane), {});
    const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
    const toEnd = endS - car.s;
    if (!car.turn && e.kind === 'street') {
      const node = this.graph.nodes[e.to];
      const sig = this.game.city.signalized.some((q) => q.x === node.x && q.z === node.z);
      const a = e.pts[0], b = e.pts[e.pts.length - 1];
      const axis = Math.abs(b.z - a.z) > Math.abs(b.x - a.x) ? 'ns' : 'ew';
      const inGrid = Math.abs(node.x) <= 480 && Math.abs(node.z) <= 480;
      if (inGrid && toEnd < 40) {
        if (sig) {
          const st = signalState(this.game.time, axis);
          if (st === 'r' || (st === 'y' && toEnd > 12)) target = Math.min(target, Math.max(0, (toEnd - 1.5) * 0.6));
        } else if (car.stopT < 1.4) {
          target = Math.min(target, Math.max(0, (toEnd - 1) * 0.5));
          if (toEnd < 2.5 && car.speed < 0.5) car.stopT += dt;
        }
      }
    }
    const gap = this.gapAhead(car, fx, fz);
    if (gap < 40) target = Math.min(target, Math.max(0, (gap - 4) * 0.55));
    const acc = target > car.speed ? 2.2 : 6.5;
    car.speed = damp(car.speed, target, acc * 0.6, dt);
    if (Math.abs(car.speed - target) < 0.05) car.speed = target;
    const ds = car.speed * dt;
    let out;
    if (car.turn) {
      const T = car.turn;
      T.u += ds / T.len;
      const u = Math.min(1, T.u);
      const a = T.p0, c = T.c, b = T.p2;
      const x = (1 - u) * (1 - u) * a.x + 2 * (1 - u) * u * c.x + u * u * b.x;
      const y = (1 - u) * (1 - u) * a.y + 2 * (1 - u) * u * c.y + u * u * b.y;
      const z = (1 - u) * (1 - u) * a.z + 2 * (1 - u) * u * c.z + u * u * b.z;
      const tx = 2 * (1 - u) * (c.x - a.x) + 2 * u * (b.x - c.x), tz = 2 * (1 - u) * (c.z - a.z) + 2 * u * (b.z - c.z);
      out = { x, y, z, yaw: Math.atan2(tx, tz), pitch: 0 };
      if (T.u >= 1) { car.turn = null; car.edge = T.next; car.s = T.s0; car.stopT = 0; car.lane = T.lane; }
    } else {
      car.s += ds;
      if (car.s >= endS) {
        const next = this.chooseNext(car);
        if (!next) { this.remove(car); return; }
        const [n0] = this.trims(next);
        const lane = next.kind === 'ramp' ? 0 : (e.kind === 'ramp' ? 0 : car.lane);
        const p0 = polylineAt(e.pts, endS, this.laneOffset(e, car.lane), {});
        const p2 = polylineAt(next.pts, n0, this.laneOffset(next, lane), {});
        const node = this.graph.nodes[e.to];
        // Control point where the two lane lines meet.
        const c = { x: (p0.x + p2.x) / 2, y: (p0.y + p2.y) / 2, z: (p0.z + p2.z) / 2 };
        const d0 = { x: Math.sin(p0.yaw), z: Math.cos(p0.yaw) }, d2 = { x: Math.sin(p2.yaw), z: Math.cos(p2.yaw) };
        const den = d0.x * d2.z - d0.z * d2.x;
        if (Math.abs(den) > 0.2) {
          const t = ((p2.x - p0.x) * d2.z - (p2.z - p0.z) * d2.x) / den;
          if (t > 0 && t < 40) { c.x = p0.x + d0.x * t; c.z = p0.z + d0.z * t; }
        }
        const len = Math.hypot(c.x - p0.x, c.z - p0.z) + Math.hypot(p2.x - c.x, p2.z - c.z) + 0.1;
        car.turn = { p0, c, p2, u: 0, len, next, s0: n0, lane };
        out = p0;
      } else out = polylineAt(e.pts, car.s, this.laneOffset(e, car.lane), {});
    }
    car.pos.set(out.x, out.y, out.z);
    car.yaw = out.yaw;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-(out.pitch || 0), out.yaw, 0, 'YXZ'));
    car.inst.root.position.copy(car.pos);
    car.inst.root.quaternion.copy(q);
    car.body.setNextKinematicTranslation({ x: out.x, y: out.y, z: out.z });
    car.body.setNextKinematicRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    car.spin += ds / car.wheelR;
    for (const w of car.inst.wheels) w.spin.rotation.x = car.spin;
  }

  clear() { for (const c of [...this.cars]) this.remove(c); }
}

// --------------------------------------------------------------- parked

export class Parked {
  constructor(game) {
    this.game = game;
    this.rng = new Rng(4321);
    this.spots = [];
    this.exclusions = [];
    this.active = new Map();
    // Curbside spots on local streets (parking lanes).
    for (const c of GRID) {
      if (ARTERIAL.has(c)) continue;
      for (let k = 0; k < GRID.length - 1; k++) {
        const a0 = GRID[k] + halfWidthAt(GRID[k]) + 9, a1 = GRID[k + 1] - halfWidthAt(GRID[k + 1]) - 9;
        for (let a = a0; a < a1; a += 6.6) {
          for (const side of [1, -1]) {
            if (this.rng.next() > 0.42) continue;
            // NS street: parking lane at c ± 4.7, facing with traffic on that side.
            this.spots.push({ x: c + side * 4.7, y: 0, z: a, yaw: side > 0 ? Math.PI : 0, id: this.rng.pick(COMMON), paint: randomPaint(this.rng) });
            this.spots.push({ x: a, y: 0, z: c + side * 4.7, yaw: side > 0 ? Math.PI / 2 : -Math.PI / 2, id: this.rng.pick(COMMON), paint: randomPaint(this.rng) });
          }
        }
      }
    }
    for (const p of game.city.parkingSpots) this.spots.push({ x: p.x, y: p.y ?? CURB, z: p.z, yaw: p.rot ?? 0, id: this.rng.pick(COMMON), paint: randomPaint(this.rng), shop: p.shop });
    // Keep shop driveways/aprons clear.
    for (const s of game.city.shops) this.exclusions.push({ x: s.drop.x, z: s.drop.z, r: 14, perm: true });
    for (const a of game.city.aprons ?? []) {
      const x = a.axis === 'x' ? a.curb + a.dirS * 2.5 : a.center, z = a.axis === 'x' ? a.center : a.curb + a.dirS * 2.5;
      this.exclusions.push({ x, z, r: a.half + 5, perm: true });
    }
  }

  blocked(spot) { return false; }
  exclude(x, z, r) { this.exclusions.push({ x, z, r }); for (const [s, c] of this.active) if (Math.hypot(s.x - x, s.z - z) < r) this.despawn(s); }
  clearExclusions() { this.exclusions = this.exclusions.filter((e) => e.perm); }

  despawn(spot) {
    const c = this.active.get(spot);
    if (!c) return;
    this.game.scene.remove(c.inst.root);
    this.game.physics.world.removeRigidBody(c.body);
    this.active.delete(spot);
  }

  update() {
    const f = this.game.focus();
    const R = 135, MAX = 42;
    // Nearest spots within range.
    const near = [];
    for (const s of this.spots) {
      const d = Math.hypot(s.x - f.x, s.z - f.z);
      if (d < R && !this.exclusions.some((e) => Math.hypot(s.x - e.x, s.z - e.z) < e.r)) near.push([d, s]);
    }
    near.sort((a, b) => a[0] - b[0]);
    const want = new Set(near.slice(0, MAX).map((n) => n[1]));
    for (const s of [...this.active.keys()]) if (!want.has(s)) this.despawn(s);
    let budget = 3; // spread creation over frames
    for (const s of want) {
      if (this.active.has(s) || budget <= 0) continue;
      budget--;
      const model = getCarModel(s.id);
      const inst = instantiateStatic(model, { color: s.paint.color, metallic: s.paint.metallic });
      inst.root.position.set(s.x, s.y, s.z);
      inst.root.rotation.y = s.yaw;
      for (const w of inst.wheels) w.pivot.position.y = model.spec.tireR;
      this.game.scene.add(inst.root);
      const sp = model.spec;
      const body = this.game.physics.world.createRigidBody(this.game.physics.R.RigidBodyDesc.fixed().setTranslation(s.x, s.y, s.z).setRotation({ x: 0, y: Math.sin(s.yaw / 2), z: 0, w: Math.cos(s.yaw / 2) }));
      this.game.physics.world.createCollider(this.game.physics.R.ColliderDesc.cuboid(sp.W / 2 - 0.05, (sp.H - sp.gc) / 2, sp.L / 2 - 0.05).setTranslation(0, sp.gc + (sp.H - sp.gc) / 2, 0)
        .setCollisionGroups(groups(GROUPS.vehicle, 0xffff)), body);
      this.active.set(s, { inst, body });
    }
  }

  clear() { for (const s of [...this.active.keys()]) this.despawn(s); }
}
