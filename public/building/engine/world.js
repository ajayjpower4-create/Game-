/* Keeps the 3D scene in step with the saved state.
 *
 * Each object is rebuilt only when its own data changes, so dragging one
 * trailer never rebuilds the warehouse. The ground is rebuilt when the site
 * plan changes; parked cars are drawn as instances, a few dozen draw calls for
 * a whole car park. */

import * as THREE from 'three';
import { buildBuilding, roofItemModel, roofSurfaceY } from './buildings.js';
import { buildRun } from './runs.js';
import { buildProp } from './props.js';
import { buildGround } from './ground.js';
import { CAR_BY_ID, CARS } from '../vehiclelist.js';
import { crowdParts } from './cars.js';
import { buildGarden, releaseGarden, gardenSig } from './garden.js';
import { vehicleModel } from './vehicles.js';
import { disposeTree } from './builder.js';
import * as M from './materials.js';
import { rng } from './textures.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { planSite, footprint, buildingsOf } from '../site.js';
import { contains, toLocal } from '../geom.js';
import { VEHICLE_COLORS } from '../catalog.js';

const DEG = Math.PI / 180;
const _box = new THREE.Box3();
const _sphere = new THREE.Sphere();

/** Where a placed model is and how big, for the engine's small-object culling. */
function measure(it) {
  if (!it.cull) return;
  it.group.updateMatrixWorld(true);
  _box.setFromObject(it.group);
  if (_box.isEmpty()) { it.cull.radius = 0; return; }
  _box.getBoundingSphere(_sphere);
  it.cull.centre.copy(_sphere.center);
  it.cull.radius = _sphere.radius;
}

/** What is underneath a plan point: the roof height of a building there, and
 *  whether a wall is close enough to bracket a duct to. */
export function makeUnder(state) {
  const blds = buildingsOf(state).map((b) => ({ b, fp: footprint(b) }));
  return (x, y) => {
    let roof = null;
    let wall = false;
    for (const { b, fp } of blds) {
      if (contains(fp, x, y)) {
        const [lx, ly] = toLocal(fp, x, y);
        const h = roofSurfaceY(b, lx + b.w / 2, ly + b.d / 2);
        roof = roof == null ? h : Math.max(roof, h);
      } else if (contains({ ...fp, x: fp.x - 3, y: fp.y - 3, w: fp.w + 6, d: fp.d + 6 }, x, y)) {
        wall = true;
      }
    }
    return { roof, wall };
  };
}

/** Build the 3D model for any object, positioned on the site. */
export function modelFor(o, under) {
  let g;
  if (o.kind === 'building') g = buildBuilding(o);
  else if (o.kind === 'plant') {
    g = roofItemModel(o.type, { ground: true }).finish(new THREE.Group());
    g.userData = { lights: [], moving: [], disposables: [] };
  } else if (o.kind === 'run') {
    g = buildRun(o, under).finish(new THREE.Group());
    g.userData = { lights: [], moving: [], disposables: [] };
  } else g = buildProp(o);
  place(g, o);
  return g;
}

export function place(g, o) {
  if (o.kind === 'run') {
    // Runs are built where their points are.
    g.position.set(0, 0, 0);
    g.rotation.y = 0;
    return;
  }
  const f = footprint(o);
  g.position.set(f.x + f.w / 2, o.kind === 'building' ? 0 : 0.02, f.y + f.d / 2);
  g.rotation.y = -(o.rot || 0) * DEG;
}

export function releaseModel(g) {
  for (const d of g.userData.disposables || []) {
    if (d.isMaterial) M.release(d);
    d.dispose?.();
  }
  disposeTree(g);
}

/* Parked-car kinds, with their sizes and how common they are. */
const PARKED = [
  ['car', 6, 15, 4.8, 5], ['hatch', 5.8, 13, 4.9, 3], ['suv', 6.4, 16, 6, 4], ['pickup', 6.6, 18, 6.2, 2], ['van', 6.6, 18, 8, 1],
];
/* On High quality and up, real makes and models instead. */
const PARKED_DETAIL = [
  ['toyota-camry', 5], ['toyota-rav4', 5], ['honda-civic', 4], ['ford-f150', 4], ['tesla-model3', 3], ['chevrolet-tahoe', 3],
  ['honda-odyssey', 2], ['bmw-3series', 2], ['bmw-x5', 2], ['jeep-grandcherokee', 3], ['jeep-wrangler', 2], ['ford-mustang', 1],
  ['mercedes-gclass', 1], ['chevrolet-corvette', 0.5], ['mercedes-sprinter', 1], ['tesla-cybertruck', 0.5],
].map(([id, wt]) => [id, CAR_BY_ID[id].W, CAR_BY_ID[id].L, CAR_BY_ID[id].H, wt]);

export class World {
  constructor(engine) {
    this.engine = engine;
    this.items = new Map();       // id -> { sig, group }
    this.groundSig = '';
    this.groundGroup = null;
    this.parked = new THREE.Group();
    this.pools = null;
    engine.ground.add(this.parked);
    this.carKits = null;
  }

  sync(state) {
    const E = this.engine;
    const seen = new Set();
    let changed = false;
    // Runs stand on whatever is under them, so they rebuild when buildings move.
    const layout = JSON.stringify(buildingsOf(state).map((b) => [b.x, b.y, b.w, b.d, b.rot, b.floors, b.height, b.roofType, b.parapet]));
    const under = makeUnder(state);
    for (const o of state.objects) {
      seen.add(o.id);
      // Moving or turning something only re-places its model.
      const { x, y, rot, ...shape } = o;
      const sig = JSON.stringify(shape) + (o.kind === 'run' ? layout : '');
      const at = `${x}|${y}|${rot}`;
      const have = this.items.get(o.id);
      if (have && have.sig === sig) {
        if (have.at !== at) {
          place(have.group, o);
          have.at = at;
          measure(have);
          changed = true;
        }
        continue;
      }
      if (have) { E.objects.remove(have.group); releaseModel(have.group); }
      const g = modelFor(o, under);
      g.userData.pick = { id: o.id };
      g.userData.obj = o.id;
      E.objects.add(g);
      // Buildings are never small enough to skip; everything else may be.
      const it = { sig, at, group: g, cull: o.kind === 'building' ? null : { group: g, centre: new THREE.Vector3(), radius: 0 } };
      measure(it);
      this.items.set(o.id, it);
      changed = true;
    }
    for (const [id, it] of this.items) {
      if (seen.has(id)) continue;
      E.objects.remove(it.group);
      releaseModel(it.group);
      this.items.delete(id);
      changed = true;
    }
    // The ground follows the plan.
    const plan = planSite(state);
    const roads = state.objects.filter((o) => o.kind === 'prop' && /^(road|lane|bend|tee|cross|roundabout|culdesac)$/.test(o.type)).map((o) => [o.x, o.y, o.w, o.d, o.rot]);
    // Bays in the player's own lots are drawn by the lots; only the automatic
    // ones belong to the ground, so resizing a lot does not rebuild the ground.
    const auto = plan.stalls.filter((s) => !s.manual);
    const gsig = JSON.stringify([state.lot, state.site, plan.pave, plan.drive, plan.aprons.map((a) => a.rect), plan.rollAprons, plan.walks, auto.length, auto[0], auto[auto.length - 1], plan.islands, plan.crossings.length, roads]);
    const csig = JSON.stringify([!!E.q.detailCars, state.site.cars, state.lot.width, plan.stalls.length, plan.stalls.map((s) => (s.manual ? [Math.round(s.cx), Math.round(s.cy), Math.round(s.rot), s.fill, s.dealer ? JSON.stringify(s.dealer) : 0] : 0)), auto[0], auto[auto.length - 1]]);
    if (gsig !== this.groundSig) {
      this.groundSig = gsig;
      if (this.groundGroup) { E.ground.remove(this.groundGroup); disposeTree(this.groundGroup); }
      this.groundGroup = buildGround(state, plan);
      E.ground.add(this.groundGroup);
      this.carSig = '';
      changed = true;
    }
    if (csig !== this.carSig) {
      this.carSig = csig;
      this.parkCars(state, plan);
      changed = true;
    }
    if (this.syncGarden(state, false)) changed = true;
    if (changed) {
      E.cullItems = [...this.items.values()].filter((it) => it.cull).map((it) => it.cull);
      this.collectLights();
      E.shadowDirty = true;
      E.moved = true;
    }
    this.plan = plan;
    return plan;
  }

  /** Rebuild the planting if it changed (called on its own while painting). */
  syncGarden(state, flag = true) {
    const sig = gardenSig(state.garden);
    if (sig === this.gardenSig) return false;
    this.gardenSig = sig;
    const E = this.engine;
    if (this.garden) { E.ground.remove(this.garden); releaseGarden(this.garden); }
    this.garden = buildGarden(state.garden);
    E.ground.add(this.garden);
    if (flag) { E.shadowDirty = true; E.moved = true; }
    return true;
  }

  get(id) {
    const it = this.items.get(id);
    return it ? it.group : null;
  }

  /** Every lamp on the site, in world space, for the engine's light pool. */
  collectLights() {
    const list = [];
    const v = new THREE.Vector3();
    const t = new THREE.Vector3();
    for (const { group } of this.items.values()) {
      const ls = group.userData.lights;
      if (!ls || !ls.length) continue;
      group.updateMatrixWorld(true);
      for (const l of ls) {
        v.set(l.x, l.y, l.z).applyMatrix4(group.matrixWorld);
        t.set(l.tx, 0, l.tz).applyMatrix4(group.matrixWorld);
        list.push({ ...l, x: v.x, y: v.y, z: v.z, tx: t.x, tz: t.z });
      }
    }
    this.engine.setLightSources(list);
    this.lightPools(list);
  }

  /** Soft pools of light on the ground under every lamp, one instanced mesh. */
  lightPools(list) {
    const E = this.engine;
    if (this.pools) { E.ground.remove(this.pools); this.pools.dispose(); }
    const pts = list.filter((l) => (l.pool == null ? 1 : l.pool) > 0);
    if (!pts.length) { this.pools = null; return; }
    const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const mesh = new THREE.InstancedMesh(geo, M.lightPool('#ffffff'), pts.length);
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    pts.forEach((l, i) => {
      // A pool roughly as wide as the lamp is high, twice over.
      const size = Math.min(72, Math.max(10, (l.y * 2.1 + 8) * (l.pool == null ? 1 : Math.max(0.5, l.pool))));
      m.makeScale(size, 1, size);
      m.setPosition(l.tx, 0.35, l.tz);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, col.set(l.color || '#ffd9a8'));
    });
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    mesh.userData.noPick = true;
    E.ground.add(mesh);
    this.pools = mesh;
  }

  /** Fill some of the parking bays with cars, and dealer lots with their stock. */
  parkCars(state, plan) {
    for (const c of [...this.parked.children]) { this.parked.remove(c); c.dispose?.(); }
    if (!plan.stalls.length) return;
    const detail = !!this.engine.q.detailCars;
    const list = detail ? PARKED_DETAIL : PARKED;
    const paint = M.carPaint('#ffffff');
    this.carPaint = paint;
    if (!this.carKits || this.carKitsDetail !== detail) {
      this.carKitsDetail = detail;
      this.carKits = list.map(([kind, w, L, h]) => {
        const B = vehicleModel(kind, null, w, L, h, paint, { lod: 'low' });
        if (detail) return { kind, parts: crowdParts(B, paint) };
        const parts = [];
        for (const [mat, geos] of B.parts) {
          const merged = geos.length === 1 ? geos[0] : mergeAll(geos);
          parts.push({ mat, geo: merged });
        }
        return { kind, parts };
      });
    }
    const r = rng(Math.round(state.lot.width * 3 + plan.stalls.length * 7));
    const weights = list.map((p) => p[4]);
    const total = weights.reduce((a, b) => a + b, 0);
    const per = this.carKits.map(() => []);
    const dealerStalls = [];
    for (const s of plan.stalls) {
      if (s.dealer) { dealerStalls.push(s); continue; }
      if (!state.site.cars) continue;
      // A lot the player laid out fills to its own setting; the automatic one to about two thirds.
      if (s.manual ? r() * 100 >= s.fill : r() > 0.68) continue;
      let pick = r() * total;
      let k = 0;
      while (pick > weights[k]) { pick -= weights[k]; k++; }
      const color = VEHICLE_COLORS[Math.floor(r() * VEHICLE_COLORS.length)];
      if (s.manual) {
        per[k].push({ x: s.cx + (r() - 0.5) * 0.4, z: s.cy + (r() - 0.5) * 0.4, rot: -s.rot * DEG + (r() - 0.5) * 0.05, color });
        continue;
      }
      const flip = r() < 0.18;
      per[k].push({ x: s.x + s.w / 2 + (r() - 0.5) * 0.6, z: s.y + s.d / 2 + (flip ? -0.4 : 0.4), rot: (flip ? Math.PI : 0) + (r() - 0.5) * 0.06, color });
    }
    this.instanceKits(this.carKits, per);
    if (dealerStalls.length) this.stockDealers(dealerStalls);
  }

  /** One instanced mesh per part of each kit, for the cars given per kit. */
  instanceKits(kits, per, extra = null) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const qp = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    const col = new THREE.Color();
    const Y = new THREE.Vector3(0, 1, 0);
    const X = new THREE.Vector3(1, 0, 0);
    kits.forEach((kit, k) => {
      const list = per[k];
      if (!list.length) return;
      for (const part of kit.parts) {
        const mesh = new THREE.InstancedMesh(part.geo, part.mat, list.length);
        list.forEach((c, i) => {
          q.setFromAxisAngle(Y, c.rot);
          if (c.pitch) q.multiply(qp.setFromAxisAngle(X, c.pitch));
          m.compose(new THREE.Vector3(c.x, c.y ?? 0.16, c.z), q, one);
          mesh.setMatrixAt(i, m);
          if (part.mat === this.carPaint) mesh.setColorAt(i, col.set(c.color));
        });
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        mesh.userData.noPick = true;
        this.parked.add(mesh);
      }
    });
  }

  /**
   * Dealer lots: every model of the chosen make (or all of them), arranged the
   * way the lot says — by brand a row each, by body style, or by colour — the
   * front row up on display ramps, a price sticker in every side window.
   */
  stockDealers(stalls) {
    if (!this.dealerKits) {
      this.dealerKits = CARS.map((c) => ({ id: c.id, car: c, parts: crowdParts(vehicleModel(c.id, null, c.W, c.L, c.H, this.carPaint, { lod: 'low' }), this.carPaint) }));
    }
    const kits = this.dealerKits;
    const per = kits.map(() => []);
    const stickers = [];
    const BODY = (b) => (/pickup|van|minivan/i.test(b) ? 2 : /suv|off-roader/i.test(b) ? 1 : 0);
    const RAINBOW = ['#f4f4f2', '#c4c8cc', '#6b7076', '#16181b', '#c8241b', '#e06a1b', '#e8b917', '#2e6b3a', '#2f5fa8', '#1b2f55', '#7a1a1f'];
    // Stalls of each lot in order: row by row, along each row.
    const lots = new Map();
    for (const s of stalls) {
      if (!lots.has(s.lot)) lots.set(s.lot, []);
      lots.get(s.lot).push(s);
    }
    for (const [lotId, list] of lots) {
      const D = list[0].dealer;
      const r = rng([...lotId].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) >>> 0);
      const pool = kits.map((k, i) => i).filter((i) => D.make === 'All' || kits[i].car.make === D.make);
      if (!pool.length) continue;
      const makes = [...new Set(pool.map((i) => kits[i].car.make))];
      const bodies = [0, 1, 2].filter((b) => pool.some((i) => BODY(kits[i].car.body) === b));
      const rows = [...new Set(list.map((s) => s.rowN))].sort((a, b) => b - a);
      let n = 0;
      for (const s of list) {
        if (r() * 100 >= s.fill) continue;
        let choices = pool;
        const ri = rows.indexOf(s.rowN);
        if (D.organize === 'brand') choices = pool.filter((i) => kits[i].car.make === makes[ri % makes.length]);
        else if (D.organize === 'body' && bodies.length) choices = pool.filter((i) => BODY(kits[i].car.body) === bodies[ri % bodies.length]);
        if (!choices.length) choices = pool;
        const k = choices[Math.floor(r() * choices.length)];
        const car = kits[k].car;
        const color = D.organize === 'color' ? RAINBOW[Math.floor(n / Math.max(1, Math.round(list.length / RAINBOW.length / 1.2))) % RAINBOW.length]
          : D.organize === 'brand' && r() < 0.35 ? car.color : RAINBOW[Math.floor(r() * RAINBOW.length)];
        n++;
        // The front row faces the road whatever the rest do; on ramps, nose up.
        const rot = -s.rot * DEG + (s.front ? s.toStreet * DEG : D.facing === 'out' ? Math.PI : 0);
        const ramp = D.ramps && s.front;
        const c = { x: s.cx, z: s.cy, rot, color, y: ramp ? 0.16 + 0.95 : 0.16, pitch: ramp ? 0.12 : 0 };
        per[k].push(c);
        if (D.stickers) stickers.push({ ...c, car });
      }
    }
    this.instanceKits(kits, per);
    if (!stickers.length) return;
    // Price stickers: a white card in the rear side window, both sides.
    const geo = new THREE.PlaneGeometry(0.9, 1.1);
    const mesh = new THREE.InstancedMesh(geo, M.plastic('#f6f6f2', 0.6), stickers.length * 2);
    const m = new THREE.Matrix4();
    const local = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const qp = new THREE.Quaternion();
    let i = 0;
    for (const c of stickers) {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), c.rot);
      if (c.pitch) q.multiply(qp.setFromAxisAngle(new THREE.Vector3(1, 0, 0), c.pitch));
      m.compose(new THREE.Vector3(c.x, c.y, c.z), q, new THREE.Vector3(1, 1, 1));
      for (const side of [1, -1]) {
        local.makeRotationY(side * Math.PI / 2);
        local.setPosition(side * (c.car.W / 2 - 0.12), c.car.H * 0.72, c.car.L * 0.12);
        mesh.setMatrixAt(i++, m.clone().multiply(local));
      }
    }
    mesh.computeBoundingSphere();
    mesh.userData.noPick = true;
    this.parked.add(mesh);
  }
}

function mergeAll(geos) {
  return mergeGeometries(geos, false);
}
