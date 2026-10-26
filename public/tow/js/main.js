// Tow Truck Simulator — game shell: boot, setup, modes, controls, loop.
import * as THREE from 'three';
import { Renderer } from './renderer.js';
import { Physics } from './physics.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { Hud } from './hud.js';
import { Weather, WEATHER_BY_ID } from './weather.js';
import { buildCity } from './city/city.js';
import { Nav } from './nav.js';
import { Setup } from './setup.js';
import { TowTruck } from './vehicles/truck.js';
import { Car, getCarModel } from './vehicles/vehicle.js';
import { staticParts } from './vehicles/carbuilder.js';
import { CATALOG, displayName } from './vehicles/catalog.js';
import { Player } from './character/player.js';
import { CameraRig } from './camera.js';
import { Tools } from './tools.js';
import { Interact } from './interact.js';
import { Jobs } from './jobs/jobs.js';
import { Traffic, Parked } from './traffic.js';
import { SPAWNS, ringPoint, parkwayPoint, streetAt, RING, CURB } from './city/layout.js';
import { clamp, damp, fmtMoney } from './util.js';
import * as M from './materials.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

class Events {
  constructor() { this.h = {}; }
  on(n, f) { (this.h[n] ||= []).push(f); }
  emit(n, ...a) { for (const f of this.h[n] || []) f(...a); }
}

class Game {
  constructor() {
    this.canvas = $('game');
    this.renderer = new Renderer(this.canvas, params.get('q') || localStorage.getItem('towsim.quality') || 'high');
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.06, 5000);
    this.renderer.camera = this.camera;
    this.renderer.resize();
    this.input = new Input(this.canvas);
    this.audio = new Audio();
    this.hud = new Hud(this);
    this.events = new Events();
    this.cars = [];
    this.mode = 'menu';
    this.money = 0;
    this.time = 0;
    this.clockStart = 9 * 3600;
    this.acc = 0;
    this.fixed = 1 / 60;
    this.paused = false;
    // Test hook: let the simulation catch up fully on slow machines.
    this.maxAcc = params.has('fast') ? 1.0 : 0.1;
    this.maxSteps = params.has('fast') ? 60 : 6;
    this.simTime = 0;
  }

  async boot() {
    const prog = (p, msg) => { $('loadFill').style.width = `${Math.round(p * 100)}%`; if (msg) $('loadText').textContent = msg; };
    prog(0.02, 'Starting the physics engine…');
    this.physics = await Physics.create();
    this.camRig = new CameraRig(this.camera, this.physics);
    this.city = await buildCity(this.scene, this.physics, (p, m) => prog(0.05 + p * 0.55, m));
    this.weather = new Weather(this.renderer.renderer, this.scene);
    this.weather.registerWet([this.city.mats.road, this.city.mats.roadLight, this.city.mats.sidewalk, this.city.mats.lotAsphalt]);
    this.weather.onThunder = (d) => this.audio.thunder(d);
    this.weather.set('clear');
    this.nav = new Nav(this.city.graph);
    this.hud.buildMap(this.city);
    // Build every car model up front so traffic never hitches.
    for (let i = 0; i < CATALOG.length; i++) {
      prog(0.62 + (i / CATALOG.length) * 0.33, `Detailing the ${displayName(CATALOG[i])}…`);
      const m = getCarModel(CATALOG[i].id);
      staticParts(m);
      if (i % 3 === 2) await new Promise((r) => setTimeout(r, 0));
    }
    prog(1, 'Ready.');
    this.renderer.buildComposer(this.scene, this.camera);
    this.setup = new Setup(this);
    $('loading').classList.remove('show');
    this.bindUI();
    if (params.has('quick')) this.startShift(this.setup.state);
    else this.setup.open();
    this.last = performance.now();
    requestAnimationFrame(() => this.loop());
    window.game = this;
    // Test helpers (used by automated playthroughs).
    window.T = {
      click: (btn = 0) => { this.input.mouse.pressed[btn] = true; this.input.mouse.down[btn] = true; setTimeout(() => { this.input.mouse.down[btn] = false; }, 50); },
      hold: (btn = 0, on = true) => { if (on) this.input.mouse.pressed[btn] = true; this.input.mouse.down[btn] = on; },
      // Puts the truck nose-out in front of the job car, as you'd park to load it.
      parkForLoad: (gap = 3) => {
        const car = this.jobs.job.car, t = this.truck;
        const yaw = car.yaw();
        const f = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
        const tail = -t.spec.bed.rear;
        const p = car.curPos.clone().addScaledVector(f, car.model.spec.L / 2 + gap + tail);
        p.y = this.physics.groundHeight(p.x, p.z, p.y + 4) + 0.3;
        t.teleport(p, yaw);
      },
      // Moves the truck and anything loaded on it together.
      moveTruck: (pos, yaw) => {
        const t = this.truck;
        const inv = new THREE.Matrix4().compose(t.curPos, t.curQuat, new THREE.Vector3(1, 1, 1)).invert();
        const riders = this.cars.filter((c) => t.onBed(c)).map((c) => ({ c, rel: inv.clone().multiply(new THREE.Matrix4().compose(c.curPos, c.curQuat, new THREE.Vector3(1, 1, 1))) }));
        for (const r of riders) t.unsecure(r.c);
        t.teleport(pos, yaw);
        const m = new THREE.Matrix4().compose(t.curPos, t.curQuat, new THREE.Vector3(1, 1, 1));
        for (const r of riders) {
          const w = m.clone().multiply(r.rel), p = new THREE.Vector3(), q = new THREE.Quaternion();
          w.decompose(p, q, new THREE.Vector3());
          r.c.body.setTranslation(p, true); r.c.body.setRotation(q, true);
          r.c.body.setLinvel({ x: 0, y: 0, z: 0 }, true); r.c.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
          r.c.curPos.copy(p); r.c.prevPos.copy(p); r.c.curQuat.copy(q); r.c.prevQuat.copy(q);
          if (t.straps.filter((s) => s.car === r.c && s.tension >= 1).length >= 4) t.secure(r.c);
        }
      },
      overhead: (p, h = 25) => {
        this.camRig.mode = 'debug';
        this.camera.position.set(p.x + 0.01, p.y + h, p.z + 0.01);
        this.camera.lookAt(p.x, p.y, p.z);
      },
      cam: (pos, target) => {
        this.camRig.mode = 'debug';
        this.camera.position.set(pos.x, pos.y, pos.z);
        this.camera.lookAt(target.x, target.y, target.z);
      },
      look: (target) => {
        const d = new THREE.Vector3(target.x, target.y, target.z).sub(this.camera.position);
        this.camRig.yaw = Math.atan2(-d.x, -d.z);
        this.camRig.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
      },
    };
    window.ready = true;
  }

  bindUI() {
    $('resume').onclick = () => this.resume();
    $('toMenu').onclick = () => location.reload();
    $('cancelJob').onclick = () => { this.jobs?.cancel(); this.resume(); };
    $('quality').value = this.renderer.qualityName;
    $('quality').onchange = (e) => { this.renderer.setQuality(e.target.value); localStorage.setItem('towsim.quality', e.target.value); this.applyShadowSize(); };
    $('sens').oninput = (e) => { this.input.sensitivity = +e.target.value; };
    $('vol').oninput = (e) => this.audio.setVolume(+e.target.value);
    $('trafficSel').onchange = (e) => { if (this.traffic) this.traffic.density = +e.target.value; if (+e.target.value === 0) this.traffic?.clear(); };
    $('clickToPlay').onclick = () => { this.audio.unlock(); this.input.requestLock(); };
    this.input.onLockChange = (locked) => {
      if (this.mode === 'menu') return;
      if (locked) { $('clickToPlay').classList.remove('show'); this.resume(); }
      else if (!this.mapOpen && !this.hud.dialogState) this.pause();
    };
    $('controlsList').innerHTML = [
      ['W / S', 'Gas / brake (hold S to reverse)'], ['A / D', 'Steer'], ['Space', 'Handbrake'], ['Mouse', 'Look around (inside the cab too)'],
      ['Left click', 'Use / press buttons / take tools'], ['Hold left/right click', 'Bed & winch levers, impact wrench, pulling'], ['E', 'Get in/out · talk · slide under a car'],
      ['G', 'Put down what you’re holding'], ['P', 'Parking brake'], ['1 / 2 / 3', 'ELS: slow amber flash / steady amber / off'], ['L', 'Headlights'],
      ['K', 'Hazards'], ['J', 'Deck work lights'], ['H', 'Horn'], ['C', 'Cab view ↔ chase cam'], ['V', 'First / third person on foot'],
      ['Enter', 'Accept a call'], ['Backspace', 'Decline a call'], ['F', 'Drop the car off at the shop'], ['M', 'Map'], ['F1', 'Show/hide help'], ['Esc', 'Pause'],
    ].map(([k, v]) => `<b>${k}</b><span>${v}</span>`).join('');
  }

  applyShadowSize() {
    const s = this.renderer.q.shadowSize;
    this.weather.sun.shadow.mapSize.set(s, s);
    this.weather.sun.shadow.map?.dispose();
    this.weather.sun.shadow.map = null;
  }

  // -------------------------------------------------------------- setup
  previewWeather(id) {
    this.weather.set(id);
    this.previewCam = { pos: new THREE.Vector3(330, 70, 820), look: new THREE.Vector3(0, 35, 0) };
  }

  spawnPose(s) {
    if (s.ring) {
      const p = ringPoint(s.ring.s, s.ring.off);
      return { x: p.x, y: RING.deckY + 0.3, z: p.z, yaw: Math.atan2(p.tx, p.tz) };
    }
    if (s.parkway) {
      const p = parkwayPoint(s.parkway.s, -s.parkway.off);
      return { x: p.x, y: 0.3, z: p.z, yaw: Math.atan2(-p.tx, -p.tz) };
    }
    return { x: s.x, y: 0.3, z: s.z, yaw: Math.atan2(s.dir[0], s.dir[1]) };
  }

  customSpawnPose(sp) {
    const e = this.city.graph.edges[sp.edge];
    if (!e) return { x: sp.x, y: 0.3, z: sp.z, yaw: 0 };
    const a = e.pts[sp.seg], b = e.pts[sp.seg + 1] ?? a;
    const yaw = Math.atan2(b.x - a.x, b.z - a.z);
    // Pull into the right-hand lane (streets are drawn on their centerline).
    const off = e.kind === 'street' ? 1.9 : e.kind === 'highway' ? 1.85 : 0;
    return { x: sp.x - Math.cos(yaw) * off, y: sp.y + 0.3, z: sp.z + Math.sin(yaw) * off, yaw };
  }

  startShift(state) {
    this.state = state;
    this.setup?.close();
    this.audio.unlock();
    this.weather.set(state.weather);
    const pose = state.spawn.kind === 'custom' ? this.customSpawnPose(state.spawn) : this.spawnPose(SPAWNS[state.spawn.index] ?? SPAWNS[0]);
    const pos = new THREE.Vector3(pose.x, this.physics.groundHeight(pose.x, pose.z, pose.y + 4) + 0.35, pose.z);
    this.truck = new TowTruck(this, state.truck, state.livery, pos, pose.yaw);
    this.truck.setGrip(this.weather.grip);
    this.player = new Player(this, state.appearance);
    this.tools = new Tools(this);
    this.interact = new Interact(this);
    this.jobs = new Jobs(this);
    if (params.has('job')) this.jobs.timer = +params.get('job') || 3;
    this.traffic = new Traffic(this);
    this.parked = new Parked(this);
    this.events.on('accept', () => {});
    this.enterTruck(true);
    this.truck.parkingBrake = true;
    this.mode = 'truck';
    this.camRig.mode = 'cab';
    this.hud.show(true);
    this.renderer.buildComposer(this.scene, this.camera);
    this.applyShadowSize();
    this.input.wantLock = true;
    $('clickToPlay').classList.add('show');
    this.hud.toast('Shift started. Parking brake is set — press P to release it. First call should come in within a minute.', 7);
    this.jobs.updateMDT();
  }

  // ---------------------------------------------------------- vehicles
  get vehicle() { return this.mode === 'truck' ? this.truck : this.mode === 'car' ? this.driving : null; }

  enterTruck(initial = false) {
    const t = this.truck;
    this.interact?.endHold();
    this.tools?.stowHand();
    this.mode = 'truck';
    t.driven = true;
    if (!t.engineOn) { t.engineOn = true; if (!initial) this.audio.starter(); }
    this.player.setActive(false);
    this.player.showSeated = true;
    const I = t.interior;
    t.root.add(this.player.root);
    this.player.root.position.set(I.seatPos.x, I.seatPos.y - 0.04, I.seatPos.z + 0.02);
    this.player.root.rotation.set(0, 0, 0);
    this.player.root.visible = true;
    this.player.pose = 'sit';
    this.camRig.mode = this.lastTruckCam ?? 'cab';
    this.camRig.headYaw = 0; this.camRig.headPitch = -0.18;
    if (!initial) this.audio.thump(0.35, 90);
  }

  exitVehicle() {
    const g = this;
    const v = this.vehicle;
    if (!v) return;
    const isTruck = v === this.truck;
    const door = isTruck ? v.driverDoorWorld() : v.doorPosition();
    door.y = this.physics.groundHeight(door.x, door.z, v.curPos.y + 2.5);
    if (isTruck) this.lastTruckCam = this.camRig.mode;
    v.driven = false;
    v.controls = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
    this.scene.add(this.player.root);
    this.player.showSeated = false;
    this.player.pose = 'auto';
    this.player.setActive(true);
    this.player.avatar.setHeadVisible(true);
    this.player.teleport(door, v.yaw() + Math.PI / 2);
    this.mode = 'foot';
    this.camRig.mode = this.footCam ?? 'third';
    this.camRig.yaw = v.yaw() + Math.PI / 2 + Math.PI;
    this.camRig.pitch = -0.15;
    this.driving = null;
    this.audio.thump(0.35, 90);
    if (!isTruck && v.engineOn && v.dead === false) { /* leave it running */ }
  }

  enterCar(car) {
    this.interact.endHold();
    this.tools.stowHand();
    this.mode = 'car';
    this.driving = car;
    car.driven = true;
    this.player.setActive(false);
    this.player.root.visible = false;
    this.camRig.mode = 'chase';
    this.camRig.chaseYaw = car.yaw() + Math.PI;
    this.audio.thump(0.35, 90);
    if (car.engineOn) return;
    if (!car.canStart) { this.hud.toast('It won’t start and the wheels won’t roll right — this one gets winched.'); return; }
    if (car.dead) {
      if (this.tools.jumpReady(car)) {
        this.audio.starter();
        this.hud.toast('Cranking… the jump box is doing its thing.');
        setTimeout(() => { car.dead = false; car.engineOn = true; this.hud.toast('It started! Leave it running and drive it up the bed.'); }, 1000);
      } else {
        this.audio.click(); setTimeout(() => this.audio.click(), 150); setTimeout(() => this.audio.click(), 300);
        this.hud.toast('Click-click-click. Battery’s dead. Clamp the jump box on first.');
      }
      return;
    }
    car.engineOn = true;
    this.audio.starter();
  }

  removeCar(car) {
    if (!car) return;
    if (this.driving === car) this.exitVehicle();
    if (this.under?.car === car) this.slideOut();
    for (const s of [...(this.truck?.straps ?? [])]) if (s.car === car) this.truck.removeStrap(s);
    if (this.truck?.winch.attach?.car === car) this.truck.stowHook();
    this.truck?.unsecure(car);
    this.truck?.carrying.delete(car);
    if (this.tools?.jump.car === car) this.tools.restock();
    car.dispose();
    this.cars = this.cars.filter((c) => c !== car);
  }

  // ------------------------------------------------------ cab controls
  setELS(mode) {
    this.truck.els = mode;
    this.audio.button();
    this.hud.toast({ slow: 'ELS: slow amber flashing', steady: 'ELS: amber steady, not flashing', off: 'ELS: amber off' }[mode], 1.6);
  }
  toggleParkingBrake() {
    const t = this.truck;
    if (!t.parkingBrake && Math.abs(t.speed) > 2.5) { this.hud.toast('Too fast to set the parking brake.'); return; }
    t.parkingBrake = !t.parkingBrake;
    this.audio.burst(0.6, { freq: 3000, type: 'highpass', vol: 0.25 });
    this.hud.toast(t.parkingBrake ? 'Parking brake set.' : 'Parking brake released.', 1.6);
  }
  eatChips(bag) {
    const c = bag.userData.chips;
    if (c.left <= 0) return;
    c.left -= 1;
    this.audio.bagRustle();
    setTimeout(() => this.audio.crunch(), 350);
    this.camRig.shake = 0.25;
    this.chipsEaten = (this.chipsEaten ?? 0) + 1;
    if (c.left === 0) { bag.scale.set(1, 0.55, 0.5); this.hud.toast(`Finished the ${c.flavor.toLowerCase()} chips.`); }
    else if (this.chipsEaten % 5 === 1) this.hud.toast(['Crunchy.', `Mmm, ${c.flavor.toLowerCase()}.`, 'Dispatch can wait a second.', 'Salt on the steering wheel now.'][this.chipsEaten % 4], 1.8);
  }

  // ------------------------------------------------------- slide under
  slideUnder(car, end) {
    const s = car.model.spec;
    const sign = end === 'front' ? 1 : -1;
    const tp = car.towPoints().find((p) => p.name === end);
    this.under = { car, end, tp };
    this.mode = 'under';
    this.player.setActive(false);
    this.player.root.visible = true;
    // Lie on the creeper with your head under the bumper.
    const out = car.localToWorld(new THREE.Vector3(0, 0, sign * (s.L / 2 + 0.75)));
    out.y = this.physics.groundHeight(out.x, out.z, car.curPos.y + 1.5);
    this.player.root.position.copy(out);
    this.player.root.rotation.set(0, car.yaw() + (end === 'front' ? 0 : Math.PI), 0);
    this.player.pose = 'lie';
    this.player.showSeated = true;
    const cr = this.tools.creeper;
    cr.visible = true;
    // Creeper under your back, sticking out past the bumper.
    cr.position.copy(car.localToWorld(new THREE.Vector3(0, 0, sign * (s.L / 2 + 0.85))));
    cr.position.y = out.y;
    cr.rotation.set(0, car.yaw() + (end === 'front' ? 0 : Math.PI), 0);
    // Frame rails + a tow eye to hook onto.
    if (!car.underFrame) car.underFrame = addUnderside(car);
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 10, 24), new THREE.MeshStandardMaterial({ color: 0xffb000, emissive: 0xffa000, emissiveIntensity: 1.2, metalness: 0.6, roughness: 0.3 }));
    // Hangs just below and ahead of the front crossmember.
    eye.position.copy(tp.local).add(new THREE.Vector3(0, -0.07, sign * 0.13));
    // Vertical loop facing out of the bumper, so it faces you on the creeper.
    eye.userData.underHook = true;
    car.root.add(eye);
    this.jobs.underTargets = [eye];
    this.under.eye = eye;
    // Camera at your eyes: head on the creeper just past the bumper, below
    // the car's floor, looking in under it at the frame. The body lies out
    // behind the camera, so the avatar is hidden while you're down there.
    const head = car.localToWorld(new THREE.Vector3(0, 0, sign * (s.L / 2 + 0.3)));
    head.y = out.y + clamp(s.gc * 0.6, 0.08, 0.2);
    this.underCamPos = head;
    this.player.root.visible = false;
    const target = car.localToWorld(tp.local.clone());
    const d = target.clone().sub(head);
    this.camRig.yaw = Math.atan2(-d.x, -d.z);
    this.camRig.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    this.camRig.mode = 'under';
    this.audio.burst(0.5, { freq: 700, type: 'lowpass', vol: 0.15 });
  }
  attachHookUnder() {
    const u = this.under;
    if (!u) return;
    const W = this.truck.winch;
    W.state = 'attached';
    W.attach = { car: u.car, local: u.tp.local.clone() };
    const hook = u.car.localToWorld(u.tp.local.clone());
    W.length = this.truck.constructor.pathLen(this.truck.cablePath(hook)) + 0.15;
    this.tools.hand = null;
    this.player.carrying = null;
    this.audio.clank();
    this.hud.toast('Hooked to the frame. Slide out (E), then work the bed and winch levers behind the cab.', 5);
    this.events.emit('hooked', u.car);
    u.eye.visible = false;
  }
  slideOut() {
    const u = this.under;
    if (!u) return;
    u.car.root.remove(u.eye);
    this.jobs.underTargets = [];
    this.tools.creeper.visible = false;
    // Roll out beside the bumper (driver's side), clear of the bed's landing spot.
    const s = u.car.model.spec;
    const sign = u.end === 'front' ? 1 : -1;
    const p = u.car.localToWorld(new THREE.Vector3(s.W / 2 + 0.75, 0, sign * (s.L / 2 - 0.4)));
    p.y = this.physics.groundHeight(p.x, p.z, u.car.curPos.y + 1.5);
    this.scene.add(this.player.root);
    this.player.pose = 'auto';
    this.player.showSeated = false;
    this.player.setActive(true);
    this.player.root.visible = true;
    this.player.teleport(p, u.car.yaw() + Math.PI / 2);
    this.mode = 'foot';
    this.camRig.mode = this.footCam ?? 'third';
    this.under = null;
  }

  // Where the driver's hands hold the rim (10 and 2), following the wheel as it
  // turns until the arms would cross.
  steeringGrips() {
    const I = this.truck.interior;
    const sg = I.steerGroup;
    sg.updateWorldMatrix(true, false);
    const turn = clamp(I.steerWheel.rotation.z, -1.1, 1.1);
    const grip = (a) => sg.localToWorld(new THREE.Vector3(Math.cos(a + turn) * 0.2, Math.sin(a + turn) * 0.2, -0.03));
    this._grips = this._grips ?? {};
    this._grips.L = grip(0.35);
    this._grips.R = grip(Math.PI - 0.35);
    return this._grips;
  }

  // ---------------------------------------------------------- queries
  focus() {
    if (this.mode === 'menu') return this.previewCam?.look ?? new THREE.Vector3();
    const v = this.vehicle;
    if (v) return v.curPos;
    if (this.mode === 'under' && this.underCamPos) return this.underCamPos;
    return this.player?.feet ?? new THREE.Vector3();
  }
  headingYaw() {
    const v = this.vehicle;
    if (v) return v.yaw();
    const f = this.camRig.groundForward(new THREE.Vector3());
    return Math.atan2(f.x, f.z);
  }
  clock() {
    const t = this.clockStart + this.time;
    const h = Math.floor(t / 3600) % 24, m = Math.floor(t / 60) % 60;
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  }
  locationName() {
    const f = this.focus();
    if (f.y > 5) return 'I-671 (Skyville Beltway)';
    const s = streetAt(f.x, f.z);
    if (s) return s;
    if (Math.max(Math.abs(f.x), Math.abs(f.z)) > 690) return 'Skyville Pkwy';
    return 'Skyville';
  }

  // E-key proximity action for the prompt.
  computeEAction() {
    if (this.hud.dialogState) return null;
    if (this.mode === 'truck' || this.mode === 'car') return { label: 'Get out', run: () => this.exitVehicle() };
    if (this.mode === 'under') return { label: 'Slide back out', run: () => this.slideOut() };
    if (this.mode !== 'foot') return null;
    const p = this.player.feet;
    for (const n of this.jobs.npcs) if (n.root.position.distanceTo(p) < 2.8) return { label: `Talk to ${n.name}`, run: () => this.jobs.talk(n) };
    const door = this.truck.driverDoorWorld();
    if (Math.hypot(door.x - p.x, door.z - p.z) < 2.0 && Math.abs(door.y - p.y) < 2) return { label: 'Get in the truck', run: () => this.enterTruck() };
    for (const c of this.cars) {
      if (!c.jobCar) continue;
      const s = c.model.spec;
      if (this.tools.hand === 'hook') {
        for (const end of ['front', 'rear']) {
          const e = c.localToWorld(new THREE.Vector3(0, 0, (end === 'front' ? 1 : -1) * (s.L / 2 + 0.3)));
          if (Math.hypot(e.x - p.x, e.z - p.z) < 1.9) return { label: `Slide under the ${end} and hook the frame`, run: () => this.slideUnder(c, end) };
        }
      }
      const d = c.doorPosition();
      if (Math.hypot(d.x - p.x, d.z - p.z) < 1.9 && !c.secured) return { label: `Get in the ${displayName(c.spec)}`, run: () => this.enterCar(c) };
    }
    return null;
  }

  // -------------------------------------------------------------- input
  handleInput(dt) {
    const I = this.input;
    if (I.hit('F1')) this.hud.helpOn = !this.hud.helpOn;
    if (I.hit('KeyM')) { this.mapOpen = !this.mapOpen; this.hud.openBigMap(this.mapOpen); if (this.mapOpen) I.exitLock(); else I.requestLock(); }
    // While the map or a conversation has your attention, let go of the
    // pedals and stop walking (otherwise the last keys stay held).
    const idle = () => {
      const v = this.vehicle;
      if (v) Object.assign(v.controls, { throttle: 0, brake: 0, steer: 0, handbrake: 0 });
      this.player?.wish.set(0, 0, 0);
      this.audio.horn(false);
      I.consumeMouse();
    };
    if (this.mapOpen) { idle(); return; }
    if (I.hit('Enter')) this.jobs.accept();
    if (I.hit('Backspace')) this.jobs.decline();
    if (this.hud.dialogState) { idle(); if (I.hit('KeyE') || I.mouse.pressed[0]) this.hud.advanceDialog(); return; }
    const m = I.consumeMouse();
    this.camRig.look(m.dx, m.dy);
    if (I.mouse.wheel) this.camRig.zoom(I.mouse.wheel);
    this.eAction = this.computeEAction();
    if (I.hit('KeyE') && this.eAction) { this.eAction.run(); this.eAction = null; }
    if (I.hit('KeyF') && this.jobs.job) {
      const j = this.jobs.job;
      if (j.canDrop) this.jobs.dropOff();
      else if (j.flags.atShop) this.hud.toast('Come to a full stop in the yellow box first.', 2.5);
    }
    const v = this.vehicle;
    if (v) {
      const steerT = I.axis('KeyD', 'KeyA');
      const c = v.controls;
      c.steer = damp(c.steer, steerT, steerT === 0 ? 7 : 3.2, dt);
      c.throttle = I.down('KeyW') || I.down('ArrowUp') ? 1 : 0;
      c.brake = I.down('KeyS') || I.down('ArrowDown') ? 1 : 0;
      c.handbrake = I.down('Space') ? 1 : 0;
      if (v === this.truck) {
        const t = this.truck;
        if (I.hit('KeyP')) this.toggleParkingBrake();
        if (I.hit('Digit1')) this.setELS('slow');
        if (I.hit('Digit2')) this.setELS('steady');
        if (I.hit('Digit3')) this.setELS('off');
        if (I.hit('KeyL')) { t.headlights = !t.headlights; this.audio.click(); }
        if (I.hit('KeyK')) { t.hazard = !t.hazard; this.audio.button(); }
        if (I.hit('KeyJ')) { t.work = !t.work; this.audio.button(); }
        if (I.hit('KeyC')) { this.camRig.mode = this.camRig.mode === 'cab' ? 'chase' : 'cab'; this.camRig.chaseYaw = t.yaw() + Math.PI; }
        if (c.throttle && t.parkingBrake && !this.pbWarned) { this.pbWarned = true; this.hud.toast('Parking brake is on — press P (or pull the yellow knob) to release it.', 4); }
        if (!t.parkingBrake) this.pbWarned = false;
      } else if (I.hit('KeyL')) v.lightsOn = !v.lightsOn;
      this.audio.horn(I.down('KeyH'));
    } else {
      this.audio.horn(false);
    }
    if (this.mode === 'foot') {
      const p = this.player;
      const f = this.camRig.groundForward(new THREE.Vector3());
      const r = new THREE.Vector3(-f.z, 0, f.x);
      const mv = new THREE.Vector3().addScaledVector(f, I.axis('KeyS', 'KeyW')).addScaledVector(r, I.axis('KeyA', 'KeyD'));
      if (mv.lengthSq() > 1) mv.normalize();
      const speed = I.down('ShiftLeft') || I.down('ShiftRight') ? 4.6 : 1.75;
      p.wish.copy(mv).multiplyScalar(speed * (this.tools.hand === 'jumpbox' ? 0.85 : 1));
      if (I.hit('Space')) p.jump = true;
      if (I.hit('KeyG') && this.tools.hand) { const tb = this.interact.nearOpenToolbox(); if (tb && this.interact.toolboxFor(this.tools.hand) === tb) this.tools.putBack(); else this.tools.drop(); }
      if (I.hit('KeyV')) { this.camRig.mode = this.camRig.mode === 'first' ? 'third' : 'first'; this.footCam = this.camRig.mode; }
      // Face where you're working/aiming when holding a tool or in first person.
      p.faceYaw = this.camRig.mode === 'first' || this.interact.held ? this.camRig.yaw + Math.PI : undefined;
      if (p.poseTimer > 0) { p.poseTimer -= dt; if (p.poseTimer <= 0 && !this.interact.held) { p.pose = 'auto'; p.action = 0; } }
    }
    // Interactions (mouse).
    if (this.mode !== 'menu') this.interact.update(dt);
  }

  pause() {
    if (this.mode === 'menu' || this.paused) return;
    this.paused = true;
    $('pause').classList.add('show');
    this.audio.ctx?.suspend();
  }
  resume() {
    this.paused = false;
    $('pause').classList.remove('show');
    this.audio.ctx?.resume();
    if (!this.input.locked) this.input.requestLock();
  }

  // ---------------------------------------------------------------- loop
  loop() {
    requestAnimationFrame(() => this.loop());
    const now = performance.now();
    const rawDt = (now - this.last) / 1000;
    const dt = Math.min(params.has('fast') ? 1.0 : 0.1, rawDt);
    this.last = now;
    if (this.mode === 'menu') { this.menuFrame(dt); this.input.endFrame(); return; }
    if (this.paused) { this.render(); this.input.endFrame(); return; }
    this.time += dt;
    this.handleInput(dt);
    // Fixed-rate physics.
    this.acc = Math.min(this.acc + dt, this.maxAcc);
    let steps = 0;
    while (this.acc >= this.fixed && steps < this.maxSteps) {
      this.simTime += this.fixed;
      this.truck.fixedUpdate(this.fixed);
      for (const c of this.cars) c.fixedUpdate(this.fixed);
      this.player.fixedUpdate(this.fixed);
      this.physics.world.step();
      this.truck.postStep();
      for (const c of this.cars) c.postStep();
      this.acc -= this.fixed;
      steps++;
    }
    const alpha = this.acc / this.fixed;
    // Visual sync.
    this.truck.update(dt, alpha);
    for (const c of this.cars) {
      if (c.kinematic) { c.root.position.copy(c.curPos); c.root.quaternion.copy(c.curQuat); }
      else c.syncVisual(alpha, c.root);
      c.update(dt);
    }
    // The seated driver's head is hidden from the inside view.
    if (this.mode === 'truck') this.player.avatar.setHeadVisible(this.camRig.mode !== 'cab');
    this.player.handTargets = this.mode === 'truck' ? this.steeringGrips() : null;
    this.player.update(dt, alpha);
    this.tools.update(dt);
    this.jobs.update(dt);
    this.traffic.update(dt);
    this.parked.update();
    this.city.update(this.time);
    // GPS.
    if (this.nav.route) {
      const info = this.nav.update(dt, this.focus(), this.headingYaw());
      if (info?.rerouteNeeded) this.nav.plan(this.focus(), this.headingYaw(), this.nav.route.dest, this.nav.route.label);
    }
    this.updateCamera(dt);
    this.weather.update(dt, this.camera, this.focus());
    this.updateAudio(dt);
    this.hud.update(dt);
    this.render();
    this.input.endFrame();
  }

  menuFrame(dt) {
    const s = this.setup;
    if (!s) return;
    if (s.previewMode === 'studio' || s.previewMode === 'map') {
      s.update(dt);
      this.renderer.render(s.scene, s.cam);
    } else {
      this.time += dt;
      const pc = this.previewCam ?? { pos: new THREE.Vector3(330, 70, 820), look: new THREE.Vector3(0, 35, 0) };
      const t = this.time * 0.03;
      this.camera.position.set(pc.look.x + Math.sin(t + 0.4) * 780, 70, pc.look.z + Math.cos(t + 0.4) * 780);
      this.camera.lookAt(pc.look);
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.city.update(this.time);
      this.weather.update(dt, this.camera, pc.look);
      this.renderer.render(this.scene, this.camera);
    }
  }

  updateCamera(dt) {
    const R = this.camRig;
    const v = this.vehicle;
    if (R.mode === 'debug') return; // test hook: camera placed by hand
    this.camera.fov = R.mode === 'cab' ? 72 : 66;
    if (this.mode === 'truck' && R.mode === 'cab') {
      const t = this.truck;
      // The camera sits right at the seated driver's eyes.
      this.player.root.updateWorldMatrix(true, true);
      const world = this.player.avatar.rig.head.localToWorld(new THREE.Vector3(0, 0.115, 0.085));
      R.updateCab(dt, world, t.root.quaternion);
    } else if (v) {
      const s = v === this.truck ? { L: this.truck.spec.cabFront - this.truck.spec.bed.rear, H: this.truck.spec.cab.H } : v.model.spec;
      R.updateChase(dt, v, s.L, s.H, this.player.collider);
    } else if (this.mode === 'under') {
      R.updateUnder(dt, this.underCamPos);
    } else if (R.mode === 'first') {
      R.updateFirst(dt, this.player.head());
      this.player.avatar.setHeadVisible(false);
    } else {
      this.player.avatar.setHeadVisible(true);
      R.updateThird(dt, this.player.head().add(new THREE.Vector3(0, 0.05, 0)), this.player.collider);
    }
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  updateAudio(dt) {
    const A = this.audio;
    if (!A.ctx) return;
    const t = this.truck;
    const v = this.vehicle;
    const dTruck = this.camera.position.distanceTo(t.curPos);
    if (v && v !== t) A.setEngine(v.engineOn, v.rpm, v.controls.throttle, 'car', 1);
    else A.setEngine(t.engineOn && dTruck < 60, t.rpm, t === v ? t.controls.throttle : 0, 'diesel', t === v ? 1 : clamp(1 - dTruck / 60, 0, 1) * 0.7);
    const near = clamp(1 - dTruck / 30, 0, 1);
    A.setLoop('hydraulic', t.bed.moving ? near : 0);
    A.setLoop('hydraulicHiss', t.bed.moving ? near : 0);
    A.setLoop('winch', t.winch.running && t.winch.state === 'attached' ? near : t.winch.running ? near * 0.6 : 0, 140 + (t.winch.tension / 55000) * 120);
    const w = this.weather.def;
    A.setLoop('rain', w.rain ? (this.mode === 'truck' && this.camRig.mode === 'cab' ? 0.7 : 1) * Math.min(1, w.rain) : 0);
    A.setLoop('wind', w.id === 'storm' || w.snow ? 0.7 : 0.25);
    A.setLoop('city', 0.6);
    // Back-up alarm.
    this.beepT = (this.beepT ?? 0) - dt;
    if (t.reversing && this.beepT <= 0) { A.beep(); this.beepT = 0.95; }
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

// Frame rails and a crossmember under the car so the underside looks right.
function addUnderside(car) {
  const s = car.model.spec;
  const g = new THREE.Group();
  const steel = M.std(0x1d1e20, 0.6, 0.6);
  for (const side of [1, -1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, s.L - 0.5), steel);
    rail.position.set(side * 0.45, s.gc + 0.06, 0);
    g.add(rail);
  }
  for (const z of [s.L / 2 - 0.4, -s.L / 2 + 0.4, s.zf, s.zr]) {
    const cm = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.08, 0.1), steel);
    cm.position.set(0, s.gc + 0.07, z);
    g.add(cm);
  }
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, s.L - 0.8, 10), M.std(0x6b6460, 0.5, 0.7));
  exhaust.rotation.x = Math.PI / 2;
  exhaust.position.set(-0.2, s.gc + 0.02, -0.2);
  g.add(exhaust);
  // Floor pan above the rails so looking up shows the underbody, not the inside of the shell.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(s.W - 0.3, s.L - 0.7).rotateX(Math.PI / 2), M.std(0x141516, 0.85, 0.2));
  floor.position.y = s.gc + 0.13;
  floor.castShadow = false;
  g.add(floor);
  const oilPan = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.1, 0.5), steel);
  oilPan.position.set(0, s.gc + 0.04, s.zf - 0.1);
  g.add(oilPan);
  car.root.add(g);
  return g;
}

const game = new Game();
game.boot().catch((e) => {
  console.error(e);
  $('loadText').textContent = 'Something went wrong while loading: ' + e.message;
});
