// Boot, world state, and the loop that ties dispatch, the truck, the rig and
// the player together.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildCity } from './city.js';
import {
  buildTowTruck, setELSMode, updateTruckLights, updateTruckAnim, setBedTilt,
  deckAnchor, LIVERY_BY_ID,
} from './towtrucks.js';
import { buildVehicle, updateVehicleAnim, detachTire } from './vehicles.js';
import { buildCharacter, animateCharacter } from './character.js';
import { createWeather, WEATHER_BY_ID } from './weather.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { TruckController, FootController, CameraRig } from './physics.js';
import { TowRig, makeJumperCables, TOOL_LABELS, compartmentKit } from './equipment.js';
import { Dispatch, SCENE_TYPE_LABEL } from './jobs.js';
import { SetupUI, HUD } from './ui.js';
import { clamp, fmtMoney, fmtClock, makeRng } from './util.js';

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.08, 2600);

// A cheap indoor probe is enough to keep chrome, glass and paint from going
// flat black — there is no HDR file to download.
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();
}

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

const loadFill = document.getElementById('loadFill');
const loadText = document.getElementById('loadText');
const setStatus = (pct, text) => {
  loadFill.style.width = pct + '%';
  if (text) loadText.textContent = text;
};
const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

/* ------------------------------------------------------------------- boot */

let city, weather, audio, input, hud, game;

async function boot() {
  setStatus(8, 'Surveying Skyville…');
  await frame();
  city = buildCity(scene, { seed: 20240815 });
  setStatus(52, 'Hanging the beltway signs…');
  await frame();
  weather = createWeather(scene, renderer);
  audio = createAudio();
  input = createInput(canvas);
  setStatus(76, 'Loading the fleet…');
  await frame();
  // Warm the vehicle builders so the first job does not hitch.
  const warm = buildVehicle('civia', { seed: 1 });
  scene.add(warm); scene.remove(warm);
  setStatus(94, 'Charging the jump box…');
  await frame();
  document.getElementById('loading').classList.add('hidden');
  const setup = document.getElementById('setup');
  setup.classList.remove('hidden');
  new SetupUI(setup, { city, onStart: (cfg) => startGame(cfg) });
  // Idle camera drifting over downtown behind the setup screens.
  idleCamera();
}

let idleT = 0;
function idleCamera() {
  if (game) return;
  idleT += 0.0016;
  camera.position.set(Math.cos(idleT) * 260, 120, Math.sin(idleT) * 260);
  camera.lookAt(0, 20, 0);
  weather.update(0.016, camera);
  renderer.render(scene, camera);
  requestAnimationFrame(idleCamera);
}

/* ------------------------------------------------------------------- game */

class Game {
  constructor(cfg) {
    this.cfg = cfg;
    this.rng = makeRng(Date.now() & 0xffff);
    this.mode = 'truck';           // truck | foot | car
    this.camView = 'cab';          // cab | chase
    this.money = 0;
    this.minutes = (WEATHER_BY_ID[cfg.weather] || {}).hour * 60 || 540;
    this.energy = 1;
    this.damagePenalty = 0;
    this.paused = false;
    this.holdId = null;
    this.holdTime = 0;
    this.jobVehicle = null;
    this.jobVehicleCtl = null;
    this.placedCones = [];
    this.deliveredAt = 0;
    this.righting = 0;
    this.tireProgress = new Map();
    this.hoodOpen = false;
    this.jumperOn = false;
    this.screenTimer = 0;

    const liv = LIVERY_BY_ID[cfg.livery];

    // --- truck
    this.truck = buildTowTruck(cfg.truck, cfg.livery);
    scene.add(this.truck);
    this.truckCtl = new TruckController(this.truck, city, {
      onImpact: (f) => this.onImpact(f),
    });
    const spawn = city.spawnPoints.find((s) => s.id === cfg.spawn) || city.spawnPoints[0];
    this.truckCtl.placeAt(spawn.x, spawn.z, spawn.heading, spawn.y);
    this.truck.userData.parkBrake = true;
    setELSMode(this.truck, 0);

    // --- player
    this.character = buildCharacter(cfg.character, { company: liv.company });
    this.character.visible = false;
    scene.add(this.character);
    this.foot = new FootController(this.character, city);
    this.foot.platforms.push((x, z, y) => this.deckHeightAt(x, z, y));

    // --- rig, weather, dispatch
    this.rig = new TowRig(scene, city, audio);
    this.rig.setTruck(this.truck);
    this.jumpers = makeJumperCables(scene);
    this.dispatch = new Dispatch(city, this.rng);
    this.cam = new CameraRig(camera);
    this.cam.yaw = spawn.heading;
    this.cam.resetHead();

    const w = weather.apply(cfg.weather);
    this.truckCtl.grip = w.grip;
    city.setNight(!!w.night || w.hour >= 19 || w.hour <= 5);
    if (w.particles === 'rain') audio.startRain(w.id === 'storm' ? 1.4 : 1);

    this.rig.on('load_lost', () => {
      hud.toast('You lost the load. Hook it back up — and strap it this time.', 'bad');
      this.damagePenalty += 60;
      this.dispatch.undo('straps');
      this.dispatch.undo('winch');
      this.dispatch.undo('bed_up');
    });
    this.rig.on('strap_tight', (n) => {
      if (n >= 4) {
        hud.toast('All four straps tight. That is not going anywhere.', 'good');
        this.dispatch.complete('straps');
      } else hud.toast(`Strap ${n} of 4 ratcheted down.`);
    });

    hud.toast('Shift started. Dispatch will call in a minute — keep the radio on.', 'good');
    hud.toast('F to get out of the truck · V for cab view · H for the controls', '');
  }

  /* --------------------------------------------------------- helpers */

  get liveryName() { return LIVERY_BY_ID[this.cfg.livery].company; }

  // Lets the player walk on the deck.
  deckHeightAt(x, z, y) {
    const bed = this.truck.userData.bed;
    const p = new THREE.Vector3(x, 0, z);
    bed.pivot.updateWorldMatrix(true, false);
    const local = bed.pivot.worldToLocal(p.clone());
    if (Math.abs(local.x) < bed.width / 2 && local.z > -0.4 && local.z < bed.length + 0.6) {
      const world = bed.pivot.localToWorld(new THREE.Vector3(local.x, bed.deckY + 0.06, local.z));
      return world.y;
    }
    return null;
  }

  worldPos(obj) {
    obj.updateWorldMatrix(true, false);
    return new THREE.Vector3().setFromMatrixPosition(obj.matrixWorld);
  }

  onImpact(force) {
    this.cam.shake = Math.min(0.4, force * 0.02);
    audio.thud();
    if (this.rig.load) {
      this.damagePenalty += Math.round(force);
      if (force > 9) hud.toast('That hit is coming out of the ticket.', 'bad');
    }
  }

  /* ------------------------------------------------------- job plumbing */

  spawnJobVehicle(job) {
    if (this.jobVehicle) { scene.remove(this.jobVehicle); this.jobVehicle = null; }
    const sc = job.scene;
    const v = buildVehicle(sc.vehicle, {
      seed: Math.floor(this.rng() * 1e6),
      flatTires: sc.flats || null,
      damage: sc.damage || null,
    });
    const site = job.site;
    v.position.set(site.x, site.y ?? city.heightAt(site.x, site.z), site.z);
    v.rotation.y = site.heading + (sc.type === 'winchout' ? 0.6 : 0);
    if (sc.type === 'winchout') {
      // Off the pavement and nose down in the dirt.
      v.position.x += Math.sin(site.heading + Math.PI / 2) * 3.4;
      v.position.z += Math.cos(site.heading + Math.PI / 2) * 3.4;
      v.position.y = city.heightAt(v.position.x, v.position.z) - 0.25;
      v.rotation.x = 0.12;
    }
    v.userData.job = job;
    scene.add(v);
    this.jobVehicle = v;
    this.hoodOpen = false;
    this.jumperOn = false;
    this.jumpers.hide();
    this.tireProgress.clear();
    this.placedCones = [];
    return v;
  }

  jobWaypoint() {
    const a = this.dispatch.active;
    if (!a) return null;
    const needShop = a.steps.some((s) => s.id === 'deliver' && !s.done) && this.rig.load;
    if (needShop) return a.shop.drop;
    if (a.steps.every((s) => s.done || s.id === 'deliver' || s.id === 'drop')) return a.shop.drop;
    return a.site;
  }

  distanceTo(p) {
    const from = this.mode === 'foot' ? this.foot.pos : this.truckCtl.pos;
    return Math.hypot(from.x - p.x, from.z - p.z);
  }

  /* ---------------------------------------------------- interactions */

  gatherInteractions() {
    const list = [];
    const p = this.foot.pos;
    const near = (v, r) => v && Math.hypot(p.x - v.x, p.z - v.z) < r && Math.abs(p.y - v.y) < 3.4;
    // Compartments, strap rings and wheels sit close together — always offer
    // the nearest one rather than whichever comes first in the array.
    const nearest = (items, posOf, radius) => {
      let best = null, bd = radius * radius;
      for (const it of items) {
        const w = posOf(it);
        if (!w || Math.abs(p.y - w.y) > 3.4) continue;
        const d = (p.x - w.x) ** 2 + (p.z - w.z) ** 2;
        if (d < bd) { bd = d; best = it; }
      }
      return best;
    };
    const t = this.truck;
    const job = this.dispatch.active;
    const carried = this.rig.carried;

    // --- get in the truck
    const cabWorld = t.localToWorld(new THREE.Vector3(t.userData.spec.cabW / 2 + 0.6, 1.2, t.userData.cabZ));
    if (near(cabWorld, 2.6)) list.push({ key: 'F', label: 'Get in the truck', action: () => this.enterTruck() });

    // --- utility compartments
    const nearBox = nearest(t.userData.boxes, (b) => this.worldPos(b), 2.4);
    if (nearBox) {
      const b = nearBox;
      const kit = compartmentKit(b.userData.side, b.userData.slot);
      const names = kit.map((k) => TOOL_LABELS[k].toLowerCase()).join(', ');
      if (!b.userData.open) {
        list.push({ key: 'E', label: `Open compartment (${names})`, action: () => { b.userData.open = true; audio.clunk(); } });
      } else if (!carried) {
        const take = (item) => () => {
          this.rig.takeTool(item);
          if (item === 'jumpbox') this.dispatch.complete('jumpbox');
          hud.toast(`Picked up the ${TOOL_LABELS[item].toLowerCase()}.`);
        };
        list.push({ key: 'E', label: `Take the ${TOOL_LABELS[kit[0]].toLowerCase()}`, action: take(kit[0]) });
        if (kit[1]) list.push({ key: 'Q', label: `Take the ${TOOL_LABELS[kit[1]].toLowerCase()}`, action: take(kit[1]) });
      } else {
        list.push({ key: 'E', label: 'Close compartment', action: () => { b.userData.open = false; audio.clunk(); } });
      }
    }

    // --- winch hook
    const anchor = this.rig.winchAnchorWorld;
    if (this.rig.hookState === 'stowed' && near(anchor, 3.0) && !carried) {
      list.push({ key: 'E', label: 'Pull the winch hook out', action: () => this.rig.takeHook() });
    }
    if (this.rig.hookState === 'carried' && near(anchor, 2.2)) {
      list.push({ key: 'E', label: 'Stow the winch hook', action: () => this.rig.stowHook() });
    }

    // --- bed and winch levers
    const panel = this.worldPos(t.userData.controlPanel);
    if (near(panel, 2.6)) {
      const bed = t.userData.bed;
      const down = (bed.targetTilt ?? 0) > 0.5;
      list.push({
        key: 'E', label: down ? 'Raise the bed' : 'Tilt the bed down',
        action: () => {
          setBedTilt(t, down ? 0 : 1);
          audio.hydraulic();
          if (down) this.dispatch.complete('bed_up'); else this.dispatch.complete('bed_down');
        },
      });
      if (this.rig.hookState === 'attached') {
        if (this.righting > 0) {
          list.push({ key: 'E', hold: 2.4, label: 'Winch it back onto its wheels', action: () => this.finishRighting() });
        } else if (!this.rig.load) {
          list.push({ key: 'E', label: 'Hold E — winch it in', winch: true, action: () => {} });
        }
      }
      if (this.rig.load) {
        list.push({ key: 'R', label: 'Release the hook', action: () => this.rig.releaseHook() });
      }
    }

    // --- straps
    if (this.rig.load) {
      // If you are holding a strap, offer the nearest free ring; otherwise the
      // nearest strap that still needs tension.
      const pool = carried?.type === 'strap'
        ? t.userData.strapPoints.filter((sp) => !this.rig.straps.some((s) => s.point === sp))
        : t.userData.strapPoints.filter((sp) => this.rig.straps.some((s) => s.point === sp && s.tension < 0.98));
      const sp = nearest(pool, (x) => this.worldPos(x.mesh), 2.4);
      if (sp) {
        const existing = this.rig.straps.find((s) => s.point === sp);
        if (!existing && carried?.type === 'strap') {
          list.push({
            key: 'E', label: 'Hook the strap over the wheel',
            action: () => { this.rig.attachStrap(sp); this.rig.consumeCarried(); },
          });
        } else if (existing) {
          list.push({ key: 'LMB', label: 'Hold left mouse — ratchet it tight', ratchet: existing });
        }
      }
    }

    // --- the job vehicle
    const v = this.jobVehicle;
    if (v && job) {
      const spec = v.userData.spec;
      const fwd = new THREE.Vector3(Math.sin(v.rotation.y), 0, Math.cos(v.rotation.y));
      const nose = v.position.clone().addScaledVector(fwd, (spec.L || 4) / 2 + 0.3);
      const driverDoor = v.position.clone()
        .addScaledVector(fwd, 0.3)
        .addScaledVector(new THREE.Vector3(fwd.z, 0, -fwd.x), (spec.W || 1.8) / 2 + 0.6);

      if (near(nose, 2.6) && v.userData.hood) {
        list.push({
          key: 'E', label: this.hoodOpen ? 'Close the hood' : 'Pop the hood',
          action: () => {
            this.hoodOpen = !this.hoodOpen;
            v.userData.hoodOpen = this.hoodOpen ? 1 : 0;
            audio.clunk();
            if (this.hoodOpen) this.dispatch.complete('hood');
          },
        });
        if (this.hoodOpen && carried?.type === 'jumpbox' && !this.jumperOn) {
          list.push({
            key: 'E', hold: 1.6, label: 'Clamp the leads to the battery',
            action: () => {
              this.jumperOn = true;
              this.rig.dropCarried(nose.clone().addScaledVector(fwd, -0.2));
              audio.clunk();
              this.dispatch.complete('clamps');
              hud.toast('Red to positive, black to ground. Give it a minute, then crank it.');
            },
          });
        }
        if (this.jumperOn && !v.userData.running) {
          list.push({
            key: 'E', hold: 1.2, label: 'Crank it over',
            action: () => {
              v.userData.running = true;
              audio.jumpstart();
              this.dispatch.complete('crank');
              hud.toast('It caught. Leave the box on it — get it up on the deck.', 'good');
            },
          });
        }
      }

      if (near(driverDoor, 2.4)) {
        if (job.scene.type === 'lockout' && carried?.type === 'slimjim') {
          list.push({
            key: 'E', hold: 3.0, label: 'Work the slim jim down the window',
            action: () => {
              audio.clunk();
              this.dispatch.complete('unlock');
              hud.toast('Door is open. Keys are on the seat, where they always are.', 'good');
            },
          });
        }
        if (v.userData.running && this.dispatch.isCurrent('drive_on')) {
          list.push({ key: 'E', label: 'Get in and drive it up', action: () => this.enterJobCar() });
        }
        if (job.scene.type === 'fuel' && carried?.type === 'fuelcan') {
          list.push({
            key: 'E', hold: 2.6, label: 'Pour the can into the tank',
            action: () => {
              this.rig.consumeCarried();
              this.dispatch.complete('fuel');
              audio.jumpstart();
              hud.toast('Two gallons in. That will get them to a station.', 'good');
            },
          });
        }
      }

      // Winch hook onto the casualty.
      if (this.rig.hookState === 'carried' && Math.hypot(p.x - v.position.x, p.z - v.position.z) < 3.6) {
        list.push({
          key: 'E', hold: 1.4,
          label: v.userData.damage === 'rollover' ? 'Slide under and hook the frame' : 'Slide under and hook the tow points',
          action: () => {
            this.rig.attachHook(v);
            this.dispatch.complete('hook');
            if (v.userData.damage === 'rollover' && this.dispatch.hasStep('righting')) this.righting = 1;
            hud.toast('Hooked. Bed down, then hold the winch lever.', 'good');
          },
        });
      }

      // Wheels: drill or brute force.
      const wheel = this.dispatch.hasStep('tire_off')
        ? nearest((v.userData.wheels || []).filter((w) => !w.userData.detached), (w) => this.worldPos(w), 2.0)
        : null;
      if (wheel) {
        const withDrill = carried?.type === 'drill';
        list.push({
          key: 'E', hold: withDrill ? 2.2 : 5.0,
          label: withDrill ? 'Run the lug nuts off with the impact' : 'Break the lugs loose by hand',
          drill: withDrill,
          action: () => {
            const tire = detachTire(v, wheel);
            if (tire) {
              scene.add(tire);
              this.rig.props.push({ type: 'tire', mesh: tire });
              audio.clunk();
              this.dispatch.complete('tire_off');
              hud.toast(withDrill ? 'Wheel is off. Impact wrench earns its keep.' : 'Wheel is off. Your back will feel that tomorrow.', 'good');
            }
          },
        });
      }
    }

    // --- carried items: place or drop
    if (carried) {
      if (carried.type === 'cone') {
        list.push({
          key: 'E', label: 'Set the cone down here',
          action: () => {
            const drop = this.rig.dropCarried(p.clone().add(new THREE.Vector3(Math.sin(this.foot.yaw), 0, Math.cos(this.foot.yaw)).multiplyScalar(1.1)));
            if (drop) {
              drop.mesh.position.y = city.heightAt(drop.mesh.position.x, drop.mesh.position.z);
              this.placedCones.push(drop.mesh.position.clone());
              if (this.placedCones.length >= 2 && job) {
                const site = job.site;
                const close = this.placedCones.filter((c) => Math.hypot(c.x - site.x, c.z - site.z) < 22).length;
                if (close >= 2) {
                  this.dispatch.complete('cones');
                  hud.toast('Scene is coned off. Now you can work.', 'good');
                }
              }
            }
          },
        });
      }
      list.push({ key: 'G', label: `Drop the ${TOOL_LABELS[carried.type].toLowerCase()}`, action: () => this.rig.dropCarried(p.clone()) });
    } else {
      // Pick a dropped prop back up.
      const prop = nearest(this.rig.props, (x) => x.mesh.position, 1.8);
      if (prop) {
        list.push({
          key: 'E', label: `Pick up the ${TOOL_LABELS[prop.type]?.toLowerCase() || 'item'}`,
          action: () => {
            this.rig.props = this.rig.props.filter((x) => x !== prop);
            this.rig.takeExisting(prop.type, prop.mesh);
          },
        });
      }
    }
    return list;
  }

  /* ---------------------------------------------------- mode switching */

  enterTruck() {
    this.mode = 'truck';
    this.character.visible = false;
    this.camView = 'cab';
    this.cam.resetHead();
    if (this.rig.carried && this.rig.carried.type !== 'hook') this.rig.dropCarried(this.foot.pos.clone());
    hud.toast('In the cab. P for the parking brake, T to change gear.');
  }

  exitTruck() {
    const t = this.truck;
    const out = t.localToWorld(t.userData.exitPos.clone());
    this.mode = 'foot';
    this.character.visible = true;
    this.foot.placeAt(out.x, out.z, this.truckCtl.yaw, city.heightAt(out.x, out.z));
    this.cam.mode = 'third';
    this.truckCtl.speed = 0;
  }

  enterJobCar() {
    const v = this.jobVehicle;
    if (!v) return;
    const spec = v.userData.spec;
    this.mode = 'car';
    this.character.visible = false;
    this.jobVehicleCtl = new TruckController(v, city, { onImpact: () => audio.thud() });
    this.jobVehicleCtl.spec = {
      L: spec.L, cabW: spec.W, wb: spec.wb, wheelR: spec.wheelR, speed: 26,
    };
    this.jobVehicleCtl.placeAt(v.position.x, v.position.z, v.rotation.y, v.position.y);
    this.jobVehicleCtl.gear = 'D';
    hud.toast('Line it up with the deck and drive on. Slow and straight.');
  }

  exitJobCar() {
    const v = this.jobVehicle;
    this.mode = 'foot';
    this.character.visible = true;
    const out = new THREE.Vector3(v.position.x + 1.8, 0, v.position.z);
    this.foot.placeAt(out.x, out.z, v.rotation.y, city.heightAt(out.x, out.z));
    this.jobVehicleCtl = null;
  }

  /* -------------------------------------------------------- cab controls */

  handleCabInteract() {
    // Raycast whatever is under the crosshair inside the cab.
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(0, 0), camera);
    const targets = this.truck.userData.interiorInteract || [];
    const hits = ray.intersectObjects(targets, false);
    if (!hits.length || hits[0].distance > 2.2) return null;
    return hits[0].object.userData.interactable;
  }

  runCabAction(id) {
    const t = this.truck;
    switch (id) {
      case 'els_off': setELSMode(t, 0); audio.click(); break;
      case 'els_steady': setELSMode(t, 1); audio.click(); break;
      case 'els_flash': setELSMode(t, 2); audio.click(); break;
      case 'parkbrake':
        t.userData.parkBrake = !t.userData.parkBrake;
        audio.clunk();
        hud.toast(t.userData.parkBrake ? 'Parking brake set.' : 'Parking brake off.');
        break;
      case 'shifter': this.cycleGear(); break;
      case 'chips': this.eatChips(); break;
      case 'coffee':
        this.energy = clamp(this.energy + 0.18, 0, 1);
        audio.click();
        hud.toast('Gas station coffee. Not good, but effective.');
        break;
      case 'accept': this.acceptCall(); break;
      case 'decline': this.declineCall(); break;
      case 'radio': hud.toast(this.dispatch.pending ? 'Call on screen — accept or decline.' : 'Channel quiet. Dispatch will call.'); break;
      case 'maptoggle': hud.toggleMap(); break;
      case 'pto':
        t.userData.pto = !t.userData.pto;
        audio.hydraulic();
        hud.toast(t.userData.pto ? 'PTO engaged — bed and winch are live.' : 'PTO off.');
        break;
      case 'clipboard':
        hud.toast(this.dispatch.active
          ? `${this.dispatch.active.scene.caller} → ${this.dispatch.active.shop.name}`
          : 'Job sheet is empty.');
        break;
      case 'cabdoor': this.exitTruck(); break;
      default: break;
    }
  }

  cycleGear() {
    const order = ['P', 'R', 'N', 'D'];
    const i = order.indexOf(this.truckCtl.gear);
    this.truckCtl.gear = order[(i + 1) % order.length];
    audio.click();
    if (this.truckCtl.gear !== 'P') this.truck.userData.parkBrake = false;
  }

  eatChips() {
    this.energy = clamp(this.energy + 0.3, 0, 1);
    audio.crunch();
    const lines = [
      'Salt and vinegar. Breakfast of the trade.',
      'Crumbs everywhere. Worth it.',
      'That is the third bag today.',
      'You eat while dispatch talks. Multitasking.',
    ];
    hud.toast(lines[Math.floor(Math.random() * lines.length)]);
  }

  /* ------------------------------------------------------------ calls */

  acceptCall() {
    const offer = this.dispatch.pending;
    if (!offer) return;
    const job = this.dispatch.accept();
    hud.hideCall();
    audio.accept();
    this.spawnJobVehicle(job);
    hud.toast(`Call accepted — ${job.site.street}. Follow the marker.`, 'good');
  }

  declineCall() {
    if (!this.dispatch.pending) return;
    this.dispatch.decline();
    hud.hideCall();
    audio.deny();
    hud.toast('Declined. Dispatch will find somebody else.');
  }

  /* ------------------------------------------------------- job progress */

  finishRighting() {
    const v = this.jobVehicle;
    if (!v) return;
    v.rotation.z = 0;
    v.position.y = city.heightAt(v.position.x, v.position.z);
    this.righting = 0;
    this.dispatch.complete('righting');
    audio.thud();
    hud.toast('Back on its wheels. Now drag it on.', 'good');
  }

  checkDelivery(dt) {
    const job = this.dispatch.active;
    if (!job) return;
    const d = Math.hypot(this.truckCtl.pos.x - job.shop.drop.x, this.truckCtl.pos.z - job.shop.drop.z);
    if (d < 16 && this.rig.load && !job.steps.find((s) => s.id === 'deliver')?.done) {
      if (Math.abs(this.truckCtl.speed) < 1.2) {
        this.dispatch.complete('deliver');
        hud.toast(`At ${job.shop.name}. Drop the bed and roll it off.`, 'good');
      }
    }
    // Unload: bed down at the shop and the car comes off.
    if (d < 24 && this.rig.load && this.truck.userData.bed.tilt > 0.7) {
      const car = this.rig.unloadVehicle();
      if (car) {
        const fwd = new THREE.Vector3(Math.sin(this.truckCtl.yaw), 0, Math.cos(this.truckCtl.yaw));
        car.position.addScaledVector(fwd, -3.2);
        car.position.y = city.heightAt(car.position.x, car.position.z);
        this.rig.stowHook();
        this.dispatch.complete('drop');
        audio.thud();
      }
    }
  }

  checkJobFinished() {
    const job = this.dispatch.active;
    if (!job) return;
    if (!job.steps.every((s) => s.done)) return;
    const w = weather.current;
    const rec = this.dispatch.finish({
      damagePenalty: this.damagePenalty,
      weatherBonus: w.grip < 0.8 ? 1.2 : 1,
      timeTaken: this.dispatch.clock - job.acceptedAt,
    });
    this.money += rec.pay;
    this.damagePenalty = 0;
    audio.cash();
    hud.toast(`Job closed — ${fmtMoney(rec.pay)} from ${rec.caller}.`, 'good');
    if (this.jobVehicle) {
      // Leave the car at the shop, then quietly clean it up.
      const v = this.jobVehicle;
      setTimeout(() => { if (v.parent) scene.remove(v); }, 40000);
      this.jobVehicle = null;
    }
    for (const c of this.placedCones) { /* cones stay where you left them */ }
    this.jumpers.hide();
  }

  /* ------------------------------------------------------- cab screens */

  drawScreens() {
    const s = this.truck.userData.screens;
    if (!s) return;
    const job = this.dispatch.active;
    const offer = this.dispatch.pending;

    // Instrument cluster.
    const c = s.cluster;
    const g = c.ctx;
    g.fillStyle = '#0a0d12'; g.fillRect(0, 0, 512, 224);
    g.strokeStyle = '#1d2836'; g.lineWidth = 3;
    g.beginPath(); g.arc(128, 112, 84, Math.PI * 0.75, Math.PI * 2.25); g.stroke();
    const frac = clamp(this.truckCtl.speedMph / 90, 0, 1);
    g.strokeStyle = '#ffb03a'; g.lineWidth = 8;
    g.beginPath(); g.arc(128, 112, 84, Math.PI * 0.75, Math.PI * 0.75 + frac * Math.PI * 1.5); g.stroke();
    g.fillStyle = '#eef3f8'; g.font = 'bold 54px Arial'; g.textAlign = 'center';
    g.fillText(Math.round(this.truckCtl.speedMph), 128, 128);
    g.font = '16px Arial'; g.fillStyle = '#7f8b9a'; g.fillText('MPH', 128, 156);
    g.textAlign = 'left';
    g.font = 'bold 26px Arial'; g.fillStyle = '#ffb03a';
    g.fillText(this.truckCtl.gear, 250, 60);
    g.font = '16px Arial'; g.fillStyle = '#8b98a8';
    g.fillText(this.truck.userData.parkBrake ? 'PARK BRAKE' : '', 290, 60);
    g.fillText(`ELS ${['OFF', 'STEADY', 'FLASH'][this.truck.userData.elsMode]}`, 250, 96);
    g.fillText(`ODO ${(this.truckCtl.odometer / 1609).toFixed(1)} mi`, 250, 128);
    g.fillText(fmtClock(this.minutes), 250, 160);
    g.fillStyle = this.energy < 0.3 ? '#e2574c' : '#46c07a';
    g.fillRect(250, 176, 200 * this.energy, 10);
    g.strokeStyle = '#2b3644'; g.strokeRect(250, 176, 200, 10);
    c.tex.needsUpdate = true;

    // Radio head unit.
    const r = s.radio;
    const q = r.ctx;
    q.fillStyle = '#07131a'; q.fillRect(0, 0, 640, 300);
    q.strokeStyle = '#123240'; q.lineWidth = 4; q.strokeRect(8, 8, 624, 284);
    q.fillStyle = '#2fd4a0'; q.font = 'bold 22px monospace';
    q.fillText(this.liveryName, 24, 44);
    q.fillStyle = '#8fd8ff'; q.font = '17px monospace';
    if (offer) {
      q.fillStyle = '#ffb03a'; q.font = 'bold 22px monospace';
      q.fillText('*** INCOMING CALL ***', 24, 88);
      q.fillStyle = '#cfe8f6'; q.font = '16px monospace';
      wrapText(q, offer.scene.text, 24, 120, 590, 22, 5);
      q.fillStyle = '#2fd4a0'; q.font = 'bold 18px monospace';
      q.fillText('[ACCEPT]', 24, 262);
      q.fillStyle = '#ff7a6a';
      q.fillText('[DECLINE]', 200, 262);
    } else if (job) {
      q.fillStyle = '#8fd8ff'; q.font = '16px monospace';
      q.fillText(`JOB ${(SCENE_TYPE_LABEL[job.scene.type] || '').toUpperCase()}`, 24, 84);
      wrapText(q, job.scene.text, 24, 112, 590, 20, 3);
      const step = this.dispatch.currentStep();
      q.fillStyle = '#ffb03a'; q.font = 'bold 17px monospace';
      wrapText(q, '> ' + (step ? step.text : 'All done — head back out'), 24, 210, 590, 22, 2);
      q.fillStyle = '#5d7f92'; q.font = '15px monospace';
      q.fillText(`→ ${job.shop.name}`, 24, 272);
    } else {
      q.fillStyle = '#4f6d7d'; q.font = '18px monospace';
      q.fillText('CHANNEL 4 — QUIET', 24, 100);
      q.fillText(fmtClock(this.minutes), 24, 140);
      q.fillText(`EARNED ${fmtMoney(this.money)}`, 24, 180);
      q.fillText(`CALLS ${this.dispatch.completed.length}`, 24, 220);
    }
    r.tex.needsUpdate = true;

    // Clipboard.
    const cl = s.clip;
    const k = cl.ctx;
    k.fillStyle = '#efe9d8'; k.fillRect(0, 0, 300, 400);
    k.fillStyle = '#c9c0a8'; k.fillRect(0, 0, 300, 46);
    k.fillStyle = '#2a2a2a'; k.font = 'bold 18px Arial'; k.textAlign = 'center';
    k.fillText('JOB SHEET', 150, 30);
    k.textAlign = 'left'; k.font = '13px Arial';
    if (job) {
      k.fillText(`Caller: ${job.scene.caller}`, 16, 74);
      k.fillText(`Type: ${SCENE_TYPE_LABEL[job.scene.type] || job.scene.type}`, 16, 96);
      k.fillText(`Shop: ${job.shop.name}`, 16, 118);
      k.fillText(`Fee: ${fmtMoney(job.pay)}`, 16, 140);
      k.fillStyle = '#444'; k.font = '12px Arial';
      job.steps.slice(0, 11).forEach((st, i) => {
        k.fillStyle = st.done ? '#3f7a4f' : '#333';
        k.fillText(`${st.done ? '✓' : '□'} ${st.text.slice(0, 34)}`, 16, 176 + i * 19);
      });
    } else {
      k.fillText('No active job.', 16, 80);
      k.fillText(`Completed today: ${this.dispatch.completed.length}`, 16, 104);
      k.fillText(`Earned: ${fmtMoney(this.money)}`, 16, 128);
    }
    cl.tex.needsUpdate = true;
  }

  /* -------------------------------------------------------------- loop */

  update(dt, time) {
    const t = this.truck;
    this.minutes += dt * 0.6;
    this.energy = clamp(this.energy - dt * 0.0022, 0, 1);

    // --- global keys
    if (input.justPressed('KeyH')) document.getElementById('help').classList.toggle('hidden');
    if (input.justPressed('KeyM')) hud.toggleMap();
    if (input.justPressed('KeyY')) this.acceptCall();
    if (input.justPressed('KeyN')) this.declineCall();
    if (input.justPressed('Digit1')) setELSMode(t, 0);
    if (input.justPressed('Digit2')) setELSMode(t, 1);
    if (input.justPressed('Digit3')) setELSMode(t, 2);

    if (this.mode === 'truck') {
      if (input.justPressed('KeyV')) {
        this.camView = this.camView === 'cab' ? 'chase' : 'cab';
        if (this.camView === 'cab') this.cam.resetHead();
      }
      if (input.justPressed('KeyF')) this.exitTruck();
      if (input.justPressed('KeyP')) {
        t.userData.parkBrake = !t.userData.parkBrake;
        audio.clunk();
      }
      if (input.justPressed('KeyT')) this.cycleGear();
      const driving = !t.userData.parkBrake && (this.truckCtl.gear === 'D' || this.truckCtl.gear === 'R');
      this.truckCtl.update(dt, input, { driving, parkBrake: t.userData.parkBrake });
      audio.engineState(this.truckCtl.rpm, Math.abs(this.truckCtl.speed) / 30);
      // Cab interactions under the crosshair.
      let cabPrompt = null;
      if (this.camView === 'cab') {
        const hit = this.handleCabInteract();
        if (hit) {
          cabPrompt = [{ key: 'E', label: hit.label }];
          if (input.justPressed('KeyE')) this.runCabAction(hit.id);
        }
      }
      hud.setPrompt(cabPrompt || [
        { key: 'F', label: 'Get out' },
        { key: 'T', label: `Gear (${this.truckCtl.gear})` },
        { key: 'P', label: t.userData.parkBrake ? 'Release parking brake' : 'Set parking brake' },
      ]);
      hud.setMeter(null);
      document.getElementById('crosshair').classList.toggle('on', this.camView === 'cab');
    } else if (this.mode === 'car' && this.jobVehicleCtl) {
      if (input.justPressed('KeyF')) this.exitJobCar();
      this.jobVehicleCtl.update(dt, input, { driving: true, parkBrake: false });
      const anchor = deckAnchor(this.truck, 0);
      const d = Math.hypot(this.jobVehicleCtl.pos.x - anchor.x, this.jobVehicleCtl.pos.z - anchor.z);
      if (this.truck.userData.bed.tilt > 0.6 && d < 4.2) {
        this.rig.completeLoad(this.jobVehicle);
        this.dispatch.complete('drive_on');
        this.jobVehicleCtl = null;
        this.mode = 'foot';
        this.character.visible = true;
        const out = anchor.clone();
        this.foot.placeAt(out.x + 2.4, out.z, this.truckCtl.yaw, city.heightAt(out.x + 2.4, out.z));
        hud.toast('On the deck. Raise the bed and strap it down.', 'good');
      }
      hud.setPrompt([{ key: 'F', label: 'Get out of the car' }, { key: 'W/S', label: 'Drive it onto the deck' }]);
      document.getElementById('crosshair').classList.remove('on');
    } else {
      // On foot.
      const list = this.gatherInteractions();
      const primary = list.find((i) => i.key === 'E');
      const ratchet = list.find((i) => i.ratchet);
      this.foot.update(dt, input, this.cam.yaw, { canMove: true, run: true });
      document.getElementById('crosshair').classList.remove('on');

      // Hold-to-act.
      if (primary?.hold) {
        if (input.down('KeyE')) {
          this.holdTime += dt * (this.energy > 0.25 ? 1 : 0.6);
          if (primary.drill) audio.drill(Math.random() < dt * 8);
          if (this.holdTime >= primary.hold) { this.holdTime = 0; primary.action(); }
        } else this.holdTime = Math.max(0, this.holdTime - dt * 2);
        hud.setMeter(primary.label, this.holdTime / primary.hold);
      } else if (primary?.winch) {
        if (input.down('KeyE')) {
          const prog = this.rig.winchIn(dt, this.truckCtl);
          hud.setMeter('Winching', prog);
          if (prog >= 1) this.dispatch.complete('winch');
        } else hud.setMeter('Hold E to winch', 0);
      } else if (ratchet) {
        if (input.mouse.down) this.rig.tightenStrap(ratchet.ratchet, dt);
        hud.setMeter('Ratchet tension', ratchet.ratchet.tension);
      } else {
        this.holdTime = 0;
        hud.setMeter(null);
        if (input.justPressed('KeyE') && primary) primary.action();
      }
      for (const i of list) {
        if (i.key !== 'E' && i.key !== 'LMB' && input.justPressed('Key' + i.key)) i.action();
      }
      hud.setPrompt(list);
    }

    // --- world updates
    updateTruckAnim(t, dt, this.truckCtl);
    updateTruckLights(t, time);
    this.rig.update(dt, {
      playerPos: this.mode === 'foot' ? this.foot.pos : this.truckCtl.pos,
      truckCtl: this.truckCtl,
      character: this.character,
    });
    if (this.jobVehicle) {
      updateVehicleAnim(this.jobVehicle, dt);
      if (this.jumperOn && this.hoodOpen) {
        const bay = this.jobVehicle.userData.bay;
        if (bay) {
          const b = this.worldPos(this.jobVehicle.userData.batteryWorld);
          const src = b.clone().add(new THREE.Vector3(0, 0.4, 0.6));
          this.jumpers.show(src, b.clone().add(new THREE.Vector3(0.1, 0.2, 0)), b.clone().add(new THREE.Vector3(-0.1, 0.2, 0)));
        }
      }
    }
    if (this.mode === 'foot') animateCharacter(this.character, dt, {
      speed: this.foot.speed, carrying: !!this.rig.carried, working: this.holdTime > 0 ? 1 : 0,
    });

    // --- dispatch
    const offer = this.dispatch.update(dt, { busy: false });
    if (offer) {
      audio.call();
      hud.showCall(offer, { distance: this.distanceTo(offer.site) });
      hud.toast('Dispatch is calling — Y to accept, N to decline.');
    }
    this.checkDelivery(dt);
    this.checkJobFinished();

    // --- camera
    this.cam.handleMouse(input, dt);
    if (this.mode === 'truck' && this.camView === 'cab') {
      this.cam.interior(t, dt);
      camera.near = 0.06;
    } else {
      camera.near = 0.2;
      const focus = this.mode === 'foot' ? this.foot.pos
        : this.mode === 'car' ? this.jobVehicleCtl.pos : this.truckCtl.pos;
      const dist = this.mode === 'foot' ? 6 : this.mode === 'car' ? 8 : 13;
      this.cam.follow(focus, dt, { height: this.mode === 'foot' ? 1.5 : 2.4, distance: Math.max(this.cam.distance, dist * 0.6) });
    }
    camera.updateProjectionMatrix();

    // --- HUD
    const ctl = this.mode === 'car' && this.jobVehicleCtl ? this.jobVehicleCtl : this.truckCtl;
    hud.setStats({
      speedMph: ctl.speedMph, gear: this.truckCtl.gear, els: t.userData.elsMode,
      money: this.money, minutes: this.minutes,
      carrying: this.rig.carried ? TOOL_LABELS[this.rig.carried.type] : null,
    });
    const wp = this.jobWaypoint();
    const job = this.dispatch.active;
    hud.setJob(job, wp ? `${Math.round(this.distanceTo(wp))} m away` : null);
    const playerPos = this.mode === 'foot' ? this.foot.pos : ctl.pos;
    const heading = this.mode === 'foot' ? this.foot.yaw : ctl.yaw;
    hud.drawMap(playerPos, wp, heading);
    if (hud.mapOpen) hud.drawBigMap(playerPos, wp, city.shops);

    this.screenTimer -= dt;
    if (this.screenTimer <= 0) { this.drawScreens(); this.screenTimer = 0.2; }

    weather.update(dt, camera);
  }
}

function wrapText(ctx, text, x, y, maxW, lh, maxLines) {
  const words = String(text).split(' ');
  let line = '', lines = 0;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW) {
      ctx.fillText(line, x, y + lines * lh);
      lines++; line = w;
      if (lines >= maxLines) return;
    } else line = test;
  }
  if (line && lines < maxLines) ctx.fillText(line, x, y + lines * lh);
}

/* ------------------------------------------------------------ lifecycle */

function startGame(cfg) {
  document.getElementById('setup').classList.add('hidden');
  document.getElementById('hud').classList.remove('hidden');
  hud = new HUD(document.getElementById('hud'), city);
  audio.resume();
  audio.startEngine();
  game = new Game(cfg);
  input.setEnabled(true);
  input.lock();

  document.getElementById('resumeBtn').onclick = () => setPaused(false);
  document.getElementById('helpBtn').onclick = () => document.getElementById('help').classList.toggle('hidden');
  document.getElementById('restartBtn').onclick = () => location.reload();

  addEventListener('keydown', (e) => {
    if (e.code === 'Escape') setPaused(!game.paused);
  });
  lastT = performance.now();
  requestAnimationFrame(loop);
}

function setPaused(v) {
  if (!game) return;
  game.paused = v;
  document.getElementById('pause').classList.toggle('hidden', !v);
  input.setEnabled(!v);
  if (v) {
    const d = game.dispatch;
    document.getElementById('pauseStats').innerHTML =
      `Calls completed: <b>${d.completed.length}</b><br>` +
      `Earned: <b>${fmtMoney(game.money)}</b><br>` +
      `Declined: <b>${d.declined}</b><br>` +
      `Driven: <b>${(game.truckCtl.odometer / 1609).toFixed(1)} mi</b><br>` +
      `Clock: <b>${fmtClock(game.minutes)}</b>`;
  } else input.lock();
}

// Handy for tuning and for automated smoke tests.
window.__tow = {
  get renderer() { return renderer; },
  get scene() { return scene; },
  get game() { return game; },
  get city() { return city; },
};

let lastT = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  if (game && !game.paused) game.update(dt, now / 1000);
  input.endFrame(dt);
  renderer.render(scene, camera);
}

boot();
