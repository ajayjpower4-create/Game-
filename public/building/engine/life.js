/* Things that move: traffic on the street, people on the paths, flags in the
 * wind, wind turbines, and rain or snow falling round the camera. */

import * as THREE from 'three';
import { vehicleModel } from './vehicles.js';
import { person } from './nature.js';
import { Builder } from './builder.js';
import * as M from './materials.js';
import { rng } from './textures.js';
import { VEHICLE_COLORS } from '../catalog.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const KINDS = [['car', 6, 15, 4.8, 5], ['hatch', 5.8, 13, 4.9, 3], ['suv', 6.4, 16, 6, 4], ['van', 6.6, 18, 8, 2], ['pickup', 6.6, 18, 6.2, 2], ['boxtruck', 8, 26, 12.5, 1], ['bus', 8.4, 40, 10.5, 0.4]];

export class Life {
  constructor(engine, world) {
    this.E = engine;
    this.world = world;
    this.group = new THREE.Group();
    this.group.name = 'life';
    engine.live.add(this.group);
    this.cars = [];
    this.walkers = [];
    this.traffic = true;
    this.people = true;
    this.kits = null;
    this.r = rng(99);
    engine.addTicker((dt, t) => this.tick(dt, t));
    this.buildWeather();
  }

  /* ---------------------------------------------------------- traffic */

  makeKits() {
    const paint = M.carPaint('#ffffff');
    this.paint = paint;
    this.kits = KINDS.map(([kind, w, L, h]) => {
      const B = vehicleModel(kind, null, w, L, h, kind === 'bus' || kind === 'boxtruck' ? null : paint, { lit: true });
      const parts = [];
      for (const [mat, geos] of B.parts) parts.push({ mat, geo: geos.length === 1 ? geos[0] : mergeGeometries(geos, false) });
      return { kind, L, parts };
    });
  }

  setup(state, plan) {
    this.state = state;
    this.plan = plan;
    for (const c of [...this.group.children]) { this.group.remove(c); c.dispose?.(); }
    this.cars = [];
    this.walkers = [];
    this.meshes = [];
    if (!this.kits) this.makeKits();
    const r = this.r;
    const W = state.lot.width;
    const road = plan.road;
    const mid = (road.y0 + road.y1) / 2;
    // Traffic: a pool per kind, cars spaced out along both lanes.
    if (state.site.road !== false) {
      const total = 18;
      const weights = KINDS.map((k) => k[4]);
      const sum = weights.reduce((a, b) => a + b, 0);
      const per = this.kits.map(() => []);
      for (let i = 0; i < total; i++) {
        let pick = r() * sum;
        let k = 0;
        while (pick > weights[k]) { pick -= weights[k]; k++; }
        const dir = i % 2 ? 1 : -1;
        const car = {
          k, idx: per[k].length, dir,
          x: -1800 + r() * (W + 3600),
          z: mid + (dir > 0 ? 6 : -6),
          speed: 38 + r() * 22,
          color: VEHICLE_COLORS[Math.floor(r() * VEHICLE_COLORS.length)],
        };
        per[k].push(car);
        this.cars.push(car);
      }
      this.kits.forEach((kit, k) => {
        const n = per[k].length;
        if (!n) return;
        for (const part of kit.parts) {
          const mesh = new THREE.InstancedMesh(part.geo, part.mat, n);
          mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          if (part.mat === this.paint) per[k].forEach((c, i) => mesh.setColorAt(i, new THREE.Color(c.color)));
          mesh.castShadow = false;
          mesh.receiveShadow = true;
          mesh.frustumCulled = false;
          mesh.userData.kit = k;
          this.group.add(mesh);
          this.meshes.push(mesh);
        }
      });
    }
    // People: a few walking the footway and the paths to the doors.
    const routes = [];
    routes.push([[-200, road.footway[0] + 4], [W + 200, road.footway[0] + 4]]);
    routes.push([[W + 200, road.y1 + 5], [-200, road.y1 + 5]]);
    for (const w of plan.walks.slice(0, 4)) {
      const cx = w.rect.x + w.rect.w / 2;
      const cy = w.rect.y + w.rect.d / 2;
      routes.push([[cx, cy], [cx, Math.min(state.lot.depth - 30, cy + 90)], [plan.driveX - 30, state.lot.depth - 30]]);
    }
    for (let i = 0; i < 9; i++) {
      const route = routes[i % routes.length];
      const B = new Builder();
      person(B, i % 4 === 0 ? 'worker' : 'visitor', 500 + i * 13, 0, 0, 0);
      const g = B.finish(new THREE.Group());
      g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
      this.group.add(g);
      this.walkers.push({ g, route, t: r(), speed: 4 + r() * 1.5, len: routeLength(route), dirSign: 1 });
    }
  }

  tick(dt, t) {
    const E = this.E;
    // Traffic
    if (this.meshes) {
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const one = new THREE.Vector3(1, 1, 1);
      const W = this.state ? this.state.lot.width : 600;
      const up = new THREE.Vector3(0, 1, 0);
      for (const c of this.cars) {
        c.x += c.dir * c.speed * dt;
        if (c.dir > 0 && c.x > W + 1900) c.x = -1900;
        if (c.dir < 0 && c.x < -1900) c.x = W + 1900;
      }
      for (const mesh of this.meshes) {
        mesh.visible = this.traffic;
        if (!this.traffic) continue;
        const k = mesh.userData.kit;
        let i = 0;
        for (const c of this.cars) {
          if (c.k !== k) continue;
          // Model fronts point -z; turn them to face along the lane.
          q.setFromAxisAngle(up, c.dir > 0 ? -Math.PI / 2 : Math.PI / 2);
          m.compose(new THREE.Vector3(c.x, 0.05, c.z), q, one);
          mesh.setMatrixAt(i++, m);
        }
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
    // Walkers
    for (const w of this.walkers) {
      w.g.visible = this.people;
      if (!this.people) continue;
      w.t += (w.speed * dt * w.dirSign) / Math.max(1, w.len);
      if (w.t > 1) { w.t = 1; w.dirSign = -1; }
      if (w.t < 0) { w.t = 0; w.dirSign = 1; }
      const [x, z, ang] = along(w.route, w.t);
      w.g.position.set(x, 0.45 + Math.abs(Math.sin(t * 6 + w.len)) * 0.08, z);
      w.g.rotation.y = ang + (w.dirSign < 0 ? Math.PI : 0);
    }
    // Flags and spinning parts on the site.
    for (const { group } of this.world.items.values()) {
      const mv = group.userData.moving;
      if (!mv || !mv.length) continue;
      for (const part of mv) {
        if (part.userData.spin) part.rotation.z += part.userData.spin.speed * dt;
        if (part.userData.flag) wave(part, t);
      }
    }
    this.stepWeather(dt);
    E.moved = true;
  }

  /* ------------------------------------------------------------ weather */

  buildWeather() {
    const n = 7000;
    const pos = new Float32Array(n * 6);
    const r = rng(7);
    this.drops = [];
    for (let i = 0; i < n; i++) {
      const x = (r() - 0.5) * 700;
      const y = r() * 320;
      const z = (r() - 0.5) * 700;
      this.drops.push([x, y, z, 0.8 + r() * 0.4]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xaab8c6, transparent: true, opacity: 0.35, depthWrite: false }));
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    const sp = new Float32Array(n * 3);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.22, transparent: true, opacity: 0.8, depthWrite: false }));
    this.snow.frustumCulled = false;
    this.snow.visible = false;
    this.E.fx.add(this.rain, this.snow);
  }

  stepWeather(dt) {
    const W = this.E.W || {};
    const rainOn = (W.rain || 0) > 0;
    const snowOn = (W.flakes || 0) > 0;
    this.rain.visible = rainOn;
    this.snow.visible = snowOn;
    if (!rainOn && !snowOn) return;
    const c = this.E.mode === 'orbit' ? this.E.controls.target : this.E.camera.position;
    const camY = this.E.camera.position.y;
    const base = Math.max(0, camY - 160);
    if (rainOn) {
      const arr = this.rain.geometry.attributes.position.array;
      const fall = 90 * dt * (W.rain || 1);
      const slant = 0.25;
      this.drops.forEach((d, i) => {
        d[1] -= fall * d[3];
        d[0] += fall * slant * 0.3;
        if (d[1] < base) { d[1] += 320; d[0] = (Math.random() - 0.5) * 700; }
        const x = c.x + d[0];
        const z = c.z + d[2];
        const y = d[1];
        arr.set([x, y, z, x - slant, y + 3.2, z], i * 6);
      });
      this.rain.geometry.attributes.position.needsUpdate = true;
      this.rain.geometry.computeBoundingSphere();
    }
    if (snowOn) {
      // Snow falls in a shallow layer near the ground, so an aerial view still
      // sees the site through it.
      const arr = this.snow.geometry.attributes.position.array;
      const t = performance.now() / 1000;
      const top = Math.min(140, Math.max(40, camY * 0.6));
      const n = Math.min(this.drops.length, 4500);
      for (let i = 0; i < n; i++) {
        const d = this.drops[i];
        const y = ((d[1] - t * 4.5 * d[3]) % top + top) % top;
        arr[i * 3] = c.x + d[0] + Math.sin(t * 0.7 + i) * 2.5;
        arr[i * 3 + 1] = y;
        arr[i * 3 + 2] = c.z + d[2] + Math.cos(t * 0.5 + i * 1.3) * 2.5;
      }
      this.snow.geometry.setDrawRange(0, n);
      this.snow.geometry.attributes.position.needsUpdate = true;
    }
  }
}

function routeLength(route) {
  let L = 0;
  for (let i = 1; i < route.length; i++) L += Math.hypot(route[i][0] - route[i - 1][0], route[i][1] - route[i - 1][1]);
  return L;
}

function along(route, t) {
  const L = routeLength(route);
  let d = t * L;
  for (let i = 1; i < route.length; i++) {
    const [x0, z0] = route[i - 1];
    const [x1, z1] = route[i];
    const seg = Math.hypot(x1 - x0, z1 - z0);
    if (d <= seg || i === route.length - 1) {
      const k = seg ? Math.min(1, d / seg) : 0;
      return [x0 + (x1 - x0) * k, z0 + (z1 - z0) * k, Math.atan2(-(x1 - x0), -(z1 - z0))];
    }
    d -= seg;
  }
  return [route[0][0], route[0][1], 0];
}

/** Ripple a flag mesh along its length. */
function wave(mesh, t) {
  const pos = mesh.geometry.attributes.position;
  const base = mesh.userData.flag.base;
  const ph = mesh.userData.flag.phase;
  for (let i = 0; i < pos.count; i++) {
    const x = base[i * 3];
    const y = base[i * 3 + 1];
    const k = x / 7;
    pos.setXYZ(i, x * (1 - 0.04 * k), y - k * k * 0.6 + Math.sin(t * 3.1 + x * 0.9 + ph) * 0.08 * k, Math.sin(t * 4 + x * 0.8 + ph) * 0.9 * k + Math.sin(t * 7 + y + x) * 0.15 * k);
  }
  pos.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
}
