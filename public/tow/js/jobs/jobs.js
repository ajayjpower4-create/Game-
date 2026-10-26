// Dispatch: radio calls, scene setup (car, customer, cones, flares, cops),
// objectives, routing to the shop the customer names, drop-off and pay.
import * as THREE from 'three';
import { Car } from '../vehicles/vehicle.js';
import { BY_ID, displayName } from '../vehicles/catalog.js';
import { randomPaint } from '../vehicles/carbuilder.js';
import { buildAvatar, defaultAppearance, SKIN_TONES, HAIR_STYLES, HAIR_COLORS, FACES, CLOTH_COLORS } from '../character/avatar.js';
import { FIRST_CALL, SECOND_CALL, SCENARIOS, SEDANS, ALIASES } from './scenarios.js';
import { GRID, ARTERIAL, halfWidthAt, EW_NAMES, NS_NAMES, SHOPS, RING, ringPoint, RING_LEN, INTERCHANGES, sideS, CURB } from '../city/layout.js';
import { Rng, fmtMoney, fmtDist, clamp } from '../util.js';
import * as M from '../materials.js';

const FIRST_NAMES = ['Mike', 'Danielle', 'Tony', 'Keisha', 'Luis', 'Priya', 'Sean', 'Maria', 'Dave', 'Jasmine', 'Vinny', 'Rosa', 'Kevin', 'Angela', 'Jamal', 'Megan', 'Sal', 'Tanya', 'Eddie', 'Nicole', 'Ray', 'Gloria', 'Frank', 'Mei'];

// Curbside spots where a disabled car can sit.
function buildSpots() {
  const spots = [];
  const hi = GRID[GRID.length - 1];
  for (const c of GRID) {
    const hw = halfWidthAt(c);
    const off = ARTERIAL.has(c) ? 7.0 : 4.7;
    for (let k = 0; k < GRID.length - 1; k++) {
      const a0 = GRID[k] + halfWidthAt(GRID[k]) + 12, a1 = GRID[k + 1] - halfWidthAt(GRID[k + 1]) - 12;
      for (let a = a0; a < a1; a += 22) {
        for (const dir of [1, -1]) {
          // N-S street at x=c heading dir*z: right side is -dir*x.
          const nsName = NS_NAMES[GRID.indexOf(c)], ewName = EW_NAMES[GRID.indexOf(c)];
          const crossA = EW_NAMES[k], crossB = EW_NAMES[k + 1];
          spots.push({ x: c - dir * off, y: 0, z: a, yaw: dir > 0 ? 0 : Math.PI, side: [-dir, 0], hw, street: nsName, near: `${nsName} between ${crossA} & ${crossB}`, kind: 'street' });
          spots.push({ x: a, y: 0, z: c + dir * off, yaw: dir > 0 ? Math.PI / 2 : -Math.PI / 2, side: [0, dir], hw, street: ewName, near: `${ewName} between ${NS_NAMES[k]} & ${NS_NAMES[k + 1]}`, kind: 'street' });
        }
      }
    }
  }
  // Highway shoulders, away from ramps.
  const icS = INTERCHANGES.map((ic) => sideS(ic.side, ic.u));
  for (let s = 40; s < RING_LEN; s += 70) {
    if (icS.some((c) => Math.abs(c - s) < 300)) continue;
    for (const dir of [1, -1]) {
      const p = ringPoint(s, dir * 10.6);
      const yaw = Math.atan2(p.tx * dir, p.tz * dir);
      spots.push({ x: p.x, y: RING.deckY, z: p.z, yaw, side: [p.nx * dir, p.nz * dir], ring: { s, dir }, hw: 0, street: `I-671 ${dir > 0 ? 'Inner' : 'Outer'} Loop`, near: `I-671 ${dir > 0 ? 'Inner' : 'Outer'} Loop shoulder`, kind: 'highway' });
    }
  }
  for (const s of spots) {
    const m = Math.max(Math.abs(s.x), Math.abs(s.z));
    s.zone = s.kind === 'highway' ? 'highway' : m < 250 ? 'downtown' : m > 360 ? 'outer' : 'city';
  }
  return spots;
}

// A point d meters along the spot's lane (negative = behind), or null when it
// would land in an intersection or off the end of the street.
function alongStreet(spot, pos, fwd, d) {
  if (spot.ring) {
    const p = ringPoint(((spot.ring.s + spot.ring.dir * d) % RING_LEN + RING_LEN) % RING_LEN, spot.ring.dir * 10.6);
    return { pos: new THREE.Vector3(p.x, pos.y, p.z), yaw: Math.atan2(p.tx * spot.ring.dir, p.tz * spot.ring.dir) };
  }
  const p = pos.clone().addScaledVector(fwd, d);
  const along = Math.abs(fwd.z) > 0.5 ? p.z : p.x;
  if (along < GRID[0] || along > GRID[GRID.length - 1]) return null;
  if (GRID.some((c) => Math.abs(along - c) < halfWidthAt(c) + 7)) return null;
  return { pos: p, yaw: spot.yaw };
}

class Npc {
  constructor(game, name, pos, yaw) {
    const rng = new Rng((Math.random() * 1e9) | 0);
    const app = {
      ...defaultAppearance(), face: rng.int(0, FACES.length - 1), skin: rng.int(0, SKIN_TONES.length - 1),
      height: rng.int(158, 192), build: rng.pick(['slim', 'average', 'average', 'heavy', 'athletic']), body: rng.chance(0.5) ? 'fem' : 'masc',
      hair: rng.pick(HAIR_STYLES)[0], hairColor: rng.int(0, HAIR_COLORS.length - 1), facialHair: 'none',
      shirt: rng.pick(['tee', 'hoodie', 'jacket', 'henley']), shirtColor: rng.int(0, CLOTH_COLORS.length - 1), pants: rng.pick(['jeans', 'work', 'cargo']),
      pantsColor: rng.int(0, 3), boots: 'sneakers', hat: rng.chance(0.25) ? 'cap' : 'none', hatColor: rng.int(0, 9), gloves: 'none', vest: 'none',
    };
    if (app.body === 'masc' && rng.chance(0.4)) app.facialHair = rng.pick(['stubble', 'beard', 'goatee', 'mustache']);
    this.name = name;
    this.avatar = buildAvatar(app);
    this.root = this.avatar.root;
    this.root.position.copy(pos);
    this.root.rotation.y = yaw;
    this.root.traverse((o) => { if (o.isMesh) o.userData.npc = this; });
    game.scene.add(this.root);
    this.game = game;
    this.talked = false;
    this.t = Math.random() * 10;
  }
  update(dt) {
    this.t += dt;
    const p = this.game.focus();
    const d = p.distanceTo(this.root.position);
    if (d < 25) {
      const yaw = Math.atan2(p.x - this.root.position.x, p.z - this.root.position.z);
      let dy = yaw - this.root.rotation.y;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      this.root.rotation.y += dy * Math.min(1, dt * 3);
    }
    // Waves when the truck pulls up.
    const wave = d < 40 && d > 6 && !this.talked;
    this.avatar.update(dt, { speed: 0, pose: wave ? 'reach' : 'auto', action: wave ? Math.sin(this.t * 8) : 0 });
    if (wave) this.avatar.rig.R.elbow.rotation.z = Math.sin(this.t * 9) * 0.6;
  }
  dispose() { this.game.scene.remove(this.root); }
}

export class Jobs {
  constructor(game) {
    this.game = game;
    this.spots = buildSpots();
    this.rng = new Rng(Date.now() & 0xffff);
    this.offer = null;
    this.job = null;
    this.npcs = [];
    this.props = [];
    this.timer = 60;          // first call ~1 minute after you spawn
    this.count = 0;
    this.earned = 0;
    this.history = [];
    this.pool = this.rng.shuffle(SCENARIOS.slice());
    this.underTargets = [];
    this.flash = 0;
  }

  // ------------------------------------------------------------- calls
  nextScenario() {
    if (this.count === 0) return FIRST_CALL;
    if (this.count === 1) return SECOND_CALL;
    if (!this.pool.length) this.pool = this.rng.shuffle(SCENARIOS.slice());
    return this.pool.pop();
  }

  pickSpot(zone, from) {
    const ok = this.spots.filter((s) => {
      if (zone !== 'any' && !(zone === 'city' ? s.zone !== 'highway' : s.zone === zone)) return false;
      const d = Math.hypot(s.x - from.x, s.z - from.z);
      return d > 260 && d < 950 && !this.game.parked?.blocked(s);
    });
    const list = ok.length ? ok : this.spots.filter((s) => Math.hypot(s.x - from.x, s.z - from.z) > 150);
    return this.rng.pick(list);
  }

  makeOffer() {
    const g = this.game;
    const sc = this.nextScenario();
    const vehicle = sc.vehicle === 'random-sedan' ? this.rng.pick(SEDANS) : (ALIASES[sc.vehicle] ?? sc.vehicle);
    const from = g.truck.curPos;
    const spot = this.pickSpot(sc.zone, from);
    // The customer picks the shop; skew toward nearby ones.
    const shops = SHOPS.slice().sort((a, b) => Math.hypot(a.x - spot.x, a.z - spot.z) - Math.hypot(b.x - spot.x, b.z - spot.z));
    const shop = this.rng.pick(shops.slice(0, 5));
    const dist = Math.hypot(spot.x - from.x, spot.z - from.z);
    const leg = Math.hypot(shop.drop.x - spot.x, shop.drop.z - spot.z);
    const base = sc.method === 'winch' ? 165 : sc.method === 'jump' ? 125 : 110;
    const pay = Math.round(base + leg * 0.06 + (sc.zone === 'highway' ? 40 : 0));
    this.offer = {
      sc, vehicle, spot, shop, pay, client: this.rng.pick(FIRST_NAMES),
      title: sc.title, method: sc.method, vehicleName: displayName(BY_ID[vehicle]),
    };
    this.offerTimer = 45;
    g.audio.dispatch();
    setTimeout(() => g.audio.radioChatter(1.6), 900);
    g.hud.radio(this.offer, dist);
    this.updateMDT();
  }

  updateMDT() {
    const g = this.game;
    if (!g.truck) return;
    const o = this.job ?? this.offer;
    if (!o) { g.truck.setMDT({ call: null, jobs: this.count, earned: fmtMoney(this.earned), idleText: this.idleText() }); return; }
    const from = g.truck.curPos;
    g.truck.setMDT({
      call: {
        title: o.title, vehicleName: o.vehicleName, locationName: o.spot.near, distance: fmtDist(Math.hypot(o.spot.x - from.x, o.spot.z - from.z)),
        pay: fmtMoney(o.pay), method: { jump: 'Dead battery · jump box + drive on', driveon: 'Runs · drive it on', winch: 'Won’t move · winch it' }[o.method],
        accepted: !!this.job, destination: this.job?.told ? this.job.shop.name : null,
      },
      nav: g.nav.instruction(), clock: g.clock(),
    });
  }
  idleText() { return this.timer > 0 ? `Next call in about ${Math.ceil(this.timer / 10) * 10}s…` : 'Waiting for calls…'; }

  accept() {
    const g = this.game;
    if (!this.offer || this.job) return;
    const o = this.offer;
    this.offer = null;
    this.job = { ...o, stage: 'enroute', flags: {}, started: g.time };
    g.audio.button();
    g.hud.closeRadio();
    g.parked?.exclude(o.spot.x, o.spot.z, 22);
    this.spawnScene(this.job);
    g.nav.plan(g.truck.curPos, g.truck.yaw(), this.job.car.curPos, `${this.job.vehicleName} · ${o.spot.near}`);
    g.hud.toast(`Call accepted: ${o.title}. Follow the GPS.`);
    this.updateMDT();
  }
  decline() {
    const g = this.game;
    if (!this.offer) return;
    this.offer = null;
    this.timer = 30;
    g.hud.closeRadio();
    g.audio.button();
    this.updateMDT();
  }

  // ------------------------------------------------------------- scene
  spawnScene(job) {
    const g = this.game;
    const s = job.spot;
    const paint = randomPaint(this.rng);
    const yaw = s.yaw;
    const pos = new THREE.Vector3(s.x, s.y + 0.15, s.z);
    const sc = job.sc;
    const car = new Car(g, job.vehicle, { pos, yaw, color: paint.color, metallic: paint.metallic, plate: plateText(this.rng), dead: sc.method === 'jump' || sc.method === 'winch', damaged: sc.damage ?? null });
    car.jobCar = true;
    car.method = sc.method;
    car.hazards = (sc.props ?? []).includes('hazards');
    car.canStart = sc.method !== 'winch';
    car.setGrip(g.weather.grip);
    g.cars.push(car);
    job.car = car;
    if (sc.flats) for (let i = 0; i < sc.flats; i++) car.ctrl.setWheelRadius(i, car.model.spec.tireR * 0.82);
    // Customer on the sidewalk side.
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const side = new THREE.Vector3(s.side[0], 0, s.side[1]);
    const npcPos = pos.clone().addScaledVector(fwd, 2.5).addScaledVector(side, s.kind === 'highway' ? 1.6 : (s.hw ? 2.6 : 2));
    npcPos.y = s.kind === 'highway' ? RING.deckY : CURB;
    const npc = new Npc(g, job.client, npcPos, yaw + Math.PI);
    this.npcs.push(npc);
    job.npc = npc;
    // Props.
    const props = sc.props ?? [];
    const behind = pos.clone().addScaledVector(fwd, -car.model.spec.L / 2 - 2);
    if (props.includes('cones') || props.includes('flares')) {
      for (let i = 0; i < 4; i++) {
        const p = behind.clone().addScaledVector(fwd, -i * 3.2).addScaledVector(side, -0.3 - i * 0.7);
        this.addProp(props.includes('flares') && i % 2 ? 'flare' : 'cone', p);
      }
    }
    if (props.includes('debris')) {
      const end = sc.damage?.end === 'rear' ? -1 : 1;
      const at = pos.clone().addScaledVector(fwd, end * (car.model.spec.L / 2 + 0.8));
      this.addDebris(at, fwd, sc.damage?.end === 'front');
    }
    // The other driver pulled well ahead, leaving room to back a rollback up
    // to the damaged front end (or behind the cop if that's an intersection).
    const otherAt = props.includes('otherCar') && [car.model.spec.L + 18, -car.model.spec.L - 26].map((d) => alongStreet(s, pos, fwd, d)).find(Boolean);
    if (otherAt) {
      const id = this.rng.pick(SEDANS);
      const other = new Car(g, id, { pos: otherAt.pos, yaw: otherAt.yaw, color: randomPaint(this.rng).color, plate: plateText(this.rng), damaged: { end: 'rear', severity: 0.7 } });
      other.hazards = true;
      other.prop = true;
      g.cars.push(other);
      this.props.push({ kind: 'car', car: other });
    }
    if (props.includes('police')) {
      const back = pos.clone().addScaledVector(fwd, -car.model.spec.L - 11).addScaledVector(side, -0.6);
      const cop = new Car(g, 'explorer', { pos: back, yaw, color: '#f4f4f2', metallic: false, plate: 'SPD 2210' });
      cop.prop = true;
      cop.police = addPoliceKit(cop);
      g.cars.push(cop);
      this.props.push({ kind: 'car', car: cop });
    }
    job.sceneCenter = pos.clone();
  }

  addProp(kind, p) {
    const g = this.game;
    p.y = g.physics.groundHeight(p.x, p.z, p.y + 3);
    if (kind === 'cone') {
      const mesh = coneMesh();
      mesh.position.copy(p);
      g.scene.add(mesh);
      // Weighted rubber base: low center of mass, light top.
      const body = g.physics.dynamicBody({ x: p.x, y: p.y + 0.36, z: p.z }, null, { mass: 3, com: { x: 0, y: -0.24, z: 0 }, inertia: { x: 0.09, y: 0.04, z: 0.09 }, linDamp: 0.3, angDamp: 0.4 });
      const col = g.physics.world.createCollider(g.physics.R.ColliderDesc.cone(0.36, 0.17).setFriction(0.8).setDensity(0), body);
      this.props.push({ kind, mesh, body, offset: -0.36 });
    } else {
      const mesh = flareMesh();
      mesh.position.copy(p).add(new THREE.Vector3(0, 0.03, 0));
      mesh.rotation.y = Math.random() * 6;
      g.scene.add(mesh);
      this.props.push({ kind, mesh });
    }
  }

  addDebris(at, fwd, coolant) {
    const g = this.game;
    const grp = new THREE.Group();
    const plastic = M.std(0x1b1c1e, 0.6);
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xbfd6e0, roughness: 0.1, transparent: true, opacity: 0.7 });
    for (let i = 0; i < 26; i++) {
      const glassBit = i % 2 === 0;
      const m = new THREE.Mesh(new THREE.BoxGeometry(glassBit ? 0.03 : 0.08 + Math.random() * 0.2, 0.01, glassBit ? 0.03 : 0.05 + Math.random() * 0.12), glassBit ? glass : plastic);
      m.position.set((Math.random() - 0.5) * 3, 0.012, (Math.random() - 0.5) * 2.5);
      m.rotation.y = Math.random() * 6;
      m.receiveShadow = true;
      grp.add(m);
    }
    if (coolant) {
      const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), new THREE.MeshPhysicalMaterial({ color: 0x2fb04a, roughness: 0.05, transparent: true, opacity: 0.55, clearcoat: 1, polygonOffset: true, polygonOffsetFactor: -3 }));
      puddle.rotation.x = -Math.PI / 2;
      puddle.scale.set(1.4, 1, 1);
      puddle.position.y = 0.006;
      grp.add(puddle);
    }
    grp.position.copy(at);
    grp.position.y = g.physics.groundHeight(at.x, at.z, at.y + 3) + 0.002;
    g.scene.add(grp);
    this.props.push({ kind: 'debris', mesh: grp });
  }

  clearScene(job, keepCar = false) {
    const g = this.game;
    g.parked?.clearExclusions();   // curbside parking can fill back in
    for (const p of this.props) {
      if (p.kind === 'car') { g.removeCar(p.car); continue; }
      if (p.body) g.physics.removeBody(p.body);
      if (p.mesh) g.scene.remove(p.mesh);
    }
    this.props = [];
    for (const n of this.npcs) n.dispose();
    this.npcs = [];
    if (!keepCar && job?.car) g.removeCar(job.car);
  }

  // ---------------------------------------------------------- objectives
  objectives() {
    const j = this.job;
    if (!j) return [];
    const g = this.game;
    const f = j.flags;
    const shopName = j.told ? j.shop.name : 'the shop the customer names';
    const tr = g.truck;
    const straps = tr.straps.filter((s) => s.car === j.car);
    const list = [];
    const add = (text, done, optional = false) => list.push({ text, done: !!done, optional });
    add(`Drive to the ${j.vehicleName} — ${j.spot.near}`, f.arrived);
    add(`Talk to ${j.client} (the customer)`, j.told);
    if (j.method === 'jump') {
      add('Grab the jump box from the toolbox under the bed', f.gotJump);
      add('Pop the car’s hood', f.hood);
      add('Clamp the jump box to the battery (red +, black −)', f.clamped);
      add('Get in the car and start it', f.started);
      add('Lower the bed at the controls behind the cab', f.bedDown);
      add('Drive the car up onto the bed, then get out', f.loaded);
    } else if (j.method === 'driveon') {
      add('Lower the bed at the controls behind the cab', f.bedDown);
      add('Get in the car and drive it up onto the bed', f.loaded);
    } else {
      add('Grab the winch hook off the back of the bed', f.gotHook);
      add('Slide under the car and hook the frame', f.hooked);
      add('Lift the bed at the controls (tilt + slide back)', f.bedDown);
      add('Winch it up onto the bed', f.loaded);
    }
    add('Bring the bed back down flat', f.bedHome);
    add(`Strap it down: 4 straps from the toolbox, ratchet them tight (${straps.filter((s) => s.tension >= 1).length}/4)`, tr.secured.has(j.car), j.method === 'winch');
    add(`Tow it to ${shopName}`, f.atShop);
    add('Drop it off in the yellow box ([F])', f.done);
    return list;
  }

  // ------------------------------------------------------------- update
  update(dt) {
    const g = this.game;
    for (const n of this.npcs) n.update(dt);
    // Physics-driven props follow their bodies.
    for (const p of this.props) {
      if (p.body && p.mesh) {
        // The mesh's origin is the cone's base, `offset` below the body along its own axis.
        const t = p.body.translation(), r = p.body.rotation();
        p.mesh.quaternion.set(r.x, r.y, r.z, r.w);
        p.mesh.position.set(0, p.offset, 0).applyQuaternion(p.mesh.quaternion).add(t);
      }
      if (p.kind === 'flare') { p.mesh.userData.flame.material.emissiveIntensity = 3 + Math.random() * 2.5; }
      if (p.kind === 'car' && p.car.police) animatePolice(p.car, g.time);
    }
    if (!g.truck) return;
    // Delivered cars stay at the shop a couple of minutes, then go inside
    // (only once you've driven off, so nothing vanishes in front of you).
    this.delivered = (this.delivered ?? []).filter((d) => {
      if (g.time - d.t < 120 || g.focus().distanceTo(d.car.curPos) < 70) return true;
      g.removeCar(d.car);
      return false;
    });
    // Next call.
    if (!this.job && !this.offer) {
      this.timer -= dt;
      if (this.timer <= 0) this.makeOffer();
    }
    if (this.offer) {
      this.offerTimer -= dt;
      this.flash += dt;
      if (this.offerTimer <= 0) { g.hud.toast('Dispatch gave that call to another truck.'); this.decline(); this.timer = 25; }
    }
    const j = this.job;
    this.mdtT = (this.mdtT ?? 0) - dt;
    if (this.mdtT <= 0) { this.mdtT = 0.5; this.updateMDT(); }
    if (!j) return;
    const tr = g.truck;
    const car = j.car;
    const f = j.flags;
    if (!f.arrived && tr.curPos.distanceTo(car.curPos) < 45) { f.arrived = true; g.hud.toast(`You're on scene. Talk to ${j.client}.`); g.nav.clear(); }
    if (g.tools.hand === 'jumpbox' || g.tools.jump.state === 'connected') f.gotJump = true;
    if (car.hoodTarget) f.hood = true;
    if (g.tools.jumpReady(car)) f.clamped = true;
    if (car.engineOn) f.started = true;
    if (tr.winch.state === 'held' || tr.winch.state === 'attached') f.gotHook = true;
    if (tr.winch.state === 'attached' && tr.winch.attach?.car === car) f.hooked = true;
    // Later steps imply the earlier ones, so the checklist never shows a gap.
    if (f.clamped) f.gotJump = f.hood = true;
    if (f.started) f.gotJump = f.hood = f.clamped = true;
    if (f.hooked) f.gotHook = true;
    if (tr.bed.slide > tr.bed.slideMax * 0.9) f.bedDown = true;
    const loaded = tr.loaded(car);
    if (loaded && !car.driven) f.loaded = true;
    if (f.loaded && loaded && tr.bed.tilt === 0 && tr.bed.slide === 0) f.bedHome = true;
    // Dropped it?
    if (f.bedHome && !loaded && !car.driven && !j.dropWarned && tr.curPos.distanceTo(car.curPos) > 8) {
      j.dropWarned = true;
      f.loaded = f.bedHome = false;
      g.hud.toast('The car came off the truck! Go back and reload it.', 5);
      j.penalty = (j.penalty ?? 0) + 75;
    }
    if (loaded && j.dropWarned) j.dropWarned = false;
    // Route to the shop once it's loaded.
    if (f.bedHome && j.told && !j.routedToShop) {
      j.routedToShop = true;
      g.nav.plan(tr.curPos, tr.yaw(), new THREE.Vector3(j.shop.drop.x, 0, j.shop.drop.z), j.shop.name);
      g.hud.toast(`Loaded. Take it to ${j.shop.name}, ${j.shop.address}.`);
    }
    const atShop = Math.hypot(tr.curPos.x - j.shop.drop.x, tr.curPos.z - j.shop.drop.z) < 18;
    f.atShop = atShop && loaded;
    j.canDrop = f.atShop && Math.abs(tr.speed) < 1;
    // Clean up an old scene once you're well away.
    if (j.done && this.leftover && tr.curPos.distanceTo(this.leftover) > 160) { this.leftover = null; }
  }

  talk(npc) {
    const g = this.game;
    const j = this.job;
    if (!j || j.npc !== npc) {
      g.hud.dialog(npc.name, ["I already called it in, the tow guy should be here soon."]);
      return;
    }
    const lines = j.sc.lines.map((l) => l.replaceAll('{shop}', `${j.shop.name} on ${j.shop.address.split(' ').slice(1).join(' ')}`));
    g.hud.dialog(j.client, lines, () => {
      j.told = true;
      npc.talked = true;
      g.hud.toast(`Destination: ${j.shop.name} — ${j.shop.address}`, 5);
      this.updateMDT();
    });
  }

  dropOff() {
    const g = this.game;
    const j = this.job;
    if (!j?.canDrop) return false;
    const tr = g.truck;
    // Unstrap, unhook, roll it into the shop's lot.
    for (const s of [...tr.straps]) if (s.car === j.car) { tr.removeStrap(s); g.tools.straps++; }
    if (tr.winch.attach?.car === j.car) tr.stowHook();
    tr.unsecure(j.car);
    const shop = j.shop;
    const slot = this.shopSlot(shop, j.car);
    if (slot) j.car.teleport(slot, Math.atan2(-shop.face[0], -shop.face[1]));
    j.car.hazards = false;
    g.hud.fade();
    const strapped = !!j.flags.strapBonus || tr.secured.size > 0;
    const pay = Math.max(40, j.pay - (j.penalty ?? 0));
    this.earned += pay;
    g.money += pay;
    this.count++;
    j.flags.done = true;
    j.done = true;
    g.audio.cash();
    g.hud.toast(`${shop.name} signed for the ${j.vehicleName}. +${fmtMoney(pay)}`, 6);
    this.history.push({ title: j.title, pay, shop: shop.name });
    g.tools.restock();
    // The car stays parked at the shop for a while; the scene gets cleaned up.
    this.clearScene(j, true);
    j.car.jobCar = false;
    if (slot) this.delivered = [...(this.delivered ?? []), { car: j.car, t: g.time, shop }];
    else g.removeCar(j.car);   // no room on the forecourt: they roll it straight into a bay
    this.job = null;
    g.nav.clear();
    this.timer = this.count === 1 ? 25 : 35 + Math.random() * 45;
    this.updateMDT();
    return true;
  }

  // A free space on the shop's forecourt, beside the drop box and clear of
  // the truck and the customer cars parked on the other side.
  shopSlot(shop, car) {
    const g = this.game;
    const [fx, fz] = shop.face;
    const tr = g.truck;
    const inv = new THREE.Matrix4().compose(tr.curPos, tr.curQuat, new THREE.Vector3(1, 1, 1)).invert();
    for (const side of [-9, -3.8, -13]) {
      const p = new THREE.Vector3(shop.x + fx * 12 + (fz ? side : 0), (shop.base ?? 0) + 0.2, shop.z + fz * 12 + (fx ? side : 0));
      const lt = p.clone().applyMatrix4(inv);
      if (Math.abs(lt.x) < 2.6 && lt.z > tr.spec.bed.rear - 3 && lt.z < tr.spec.cabFront + 3) continue;
      if (g.cars.some((c) => c !== car && c.curPos.distanceTo(p) < 3.5)) continue;
      if (g.player.active && g.player.feet.distanceTo(p) < 3) continue;
      return p;
    }
    return null;
  }

  cancel() {
    const g = this.game;
    if (!this.job) return;
    const tr = g.truck;
    for (const s of [...tr.straps]) { tr.removeStrap(s); g.tools.straps++; }
    if (tr.winch.state === 'attached') tr.stowHook();
    this.clearScene(this.job);
    this.job = null;
    g.nav.clear();
    g.tools.restock();
    this.timer = 30;
    g.hud.toast('Job cancelled. Dispatch is not thrilled.');
    this.updateMDT();
  }
}

function plateText(rng) {
  const L = 'ABCDEFGHJKLMNPRSTUVWXYZ';
  return `${L[rng.int(0, L.length - 1)]}${L[rng.int(0, L.length - 1)]}${L[rng.int(0, L.length - 1)]} ${rng.int(1000, 9999)}`;
}

let _coneGeo = null;
function coneMesh() {
  if (!_coneGeo) {
    _coneGeo = new THREE.CylinderGeometry(0.035, 0.17, 0.66, 18, 4);
    _coneGeo.translate(0, 0.36, 0);
  }
  const g = new THREE.Group();
  const orange = new THREE.MeshStandardMaterial({ color: 0xff5a0a, roughness: 0.5 });
  const cone = new THREE.Mesh(_coneGeo, orange);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.035, 0.42), new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.8 }));
  base.position.y = 0.018;
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.11, 0.1, 18, 1, true), M.reflectiveTape());
  stripe.position.y = 0.46;
  g.add(cone, base, stripe);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

function flareMesh() {
  const g = new THREE.Group();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 10), new THREE.MeshStandardMaterial({ color: 0xb3121b, roughness: 0.6 }));
  stick.rotation.z = Math.PI / 2;
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff3a1a, emissive: 0xff2a0a, emissiveIntensity: 4 }));
  flame.position.x = 0.16;
  g.add(stick, flame);
  g.userData.flame = flame;
  return g;
}

// Police light bar and door lettering on a white Explorer.
function addPoliceKit(car) {
  const s = car.model.spec;
  const bar = new THREE.Group();
  bar.position.set(0, s.H + 0.06, (s.zR1 + s.zR2) / 2 + 0.2);
  car.root.add(bar);
  const red = M.lightLens('red'), blue = M.lightLens('blue');
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.06, 0.28), M.std(0x111111, 0.4));
  bar.add(base);
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.07, 0.26), i < 3 ? red : blue);
    m.position.set(-0.5 + i * 0.2, 0.06, 0);
    bar.add(m);
  }
  // Blue stripe down each side.
  for (const side of [1, -1]) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(s.L * 0.8, 0.12), new THREE.MeshStandardMaterial({ color: 0x1f3f8f, roughness: 0.4 }));
    stripe.position.set(side * (s.W / 2 + 0.004), s.beltF - 0.28, 0);
    stripe.rotation.y = side * Math.PI / 2;
    car.root.add(stripe);
  }
  car.inst.paint = car.paint;
  return { red, blue };
}
function animatePolice(car, t) {
  const p = car.police;
  const ph = (t * 3) % 1;
  p.red.emissiveIntensity = ph < 0.5 ? 4 : 0;
  p.blue.emissiveIntensity = ph >= 0.5 ? 4 : 0;
}
