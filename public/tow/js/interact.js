// Crosshair interaction: figures out what you're looking at, shows the
// prompt, and runs press/hold actions with the mouse (E handles proximity
// actions like doors, talking and sliding under a car).
import * as THREE from 'three';
import { Car } from './vehicles/vehicle.js';
import { TowTruck } from './vehicles/truck.js';

const ray = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);

export class Interact {
  constructor(game) {
    this.game = game;
    this.target = null;
    this.held = null;
  }

  // Finds the interactable under the crosshair.
  pick() {
    const g = this.game;
    ray.setFromCamera(center, g.camera);
    const inCab = g.mode === 'truck' && g.camRig.mode === 'cab';
    if (inCab) {
      ray.far = 1.6;
      const hits = ray.intersectObjects(g.truck.interior.interactive, false);
      return hits[0] ? { hit: hits[0], obj: hits[0].object } : null;
    }
    if (g.mode !== 'foot' && g.mode !== 'under') return null;
    ray.far = g.mode === 'under' ? 2.5 : (g.camRig.mode === 'first' ? 2.6 : 2.6 + g.camRig.dist);
    const list = [];
    const p = g.player.feet;
    const near = (o, r) => o && o.position.distanceTo(p) < r;
    if (g.truck && g.truck.curPos.distanceTo(p) < 14) list.push(g.truck.root, ...g.truck.straps.map((s) => s.ratchet));
    if (g.truck && g.truck.hookMesh.position.distanceTo(p) < 4) list.push(g.truck.hookMesh);   // may be lying far from the truck
    for (const c of g.cars) if (c.curPos.distanceTo(p) < 9) list.push(c.root);
    const T = g.tools;
    list.push(T.jump.box, T.drill.mesh, T.strapCoil);
    for (const L of T.loose) if (near(L.mesh, 6)) list.push(L.mesh);
    for (const n of g.jobs.npcs) if (n.root.position.distanceTo(p) < 6) list.push(n.root);
    if (g.jobs.underTargets) list.push(...g.jobs.underTargets);
    const hits = ray.intersectObjects(list, true);
    for (const h of hits) {
      // Ignore hits closer to the camera than the player (third-person camera behind them).
      const camToPlayer = g.camera.position.distanceTo(g.player.chest());
      if (g.mode === 'foot' && g.camRig.mode === 'third' && h.distance < camToPlayer - 0.6) continue;
      if (h.object.userData.avatar) continue;
      // Tie-down slots only matter while you're holding a strap to hook.
      if (h.object.userData.part === 'anchor' && !T.pendingStrap) continue;
      if (!h.object.visible) continue;
      // Must be within arm's reach of the player, not just the camera.
      if (g.mode === 'foot' && h.point.distanceTo(g.player.chest()) > 2.3) return null;
      return { hit: h, obj: h.object };
    }
    return null;
  }

  // Turns a hit into an action description.
  resolve(t) {
    const g = this.game;
    const T = g.tools;
    if (!t) return null;
    const o = t.obj;
    const ud = o.userData;
    // ---- cab controls
    if (ud.interact) return this.cabAction(ud.interact.id, t);
    // ---- under a car: the tow eye on the frame
    if (ud.underHook) return { label: 'Hook the winch to the frame here', press: () => g.attachHookUnder() };
    // ---- tools lying in the toolbox / on the ground / connected
    let toolName = null;
    for (let q = o; q; q = q.parent) if (q.userData.tool) { toolName = q.userData.tool; break; }
    if (toolName) {
      if (toolName === 'jumpbox' && T.jump.state === 'connected') return { label: 'Unclamp & take the jump box', press: () => T.unclamp() };
      const state = toolName === 'jumpbox' ? T.jump.state : toolName === 'drill' ? T.drill.state : 'box';
      if (state === 'hand') return null;
      const tb = this.toolboxFor(toolName);
      if (state === 'box' && tb && tb.open < 0.6) return { label: 'Open the toolbox first', press: () => { tb.target = 1; g.audio.clank(); } };
      if (T.hand) return T.hand === toolName ? null : { label: `Hands full — [G] put down the ${T.handName()}`, press: () => {} };
      const nice = { jumpbox: 'jump box', drill: 'impact wrench', straps: `ratchet straps (${T.straps})` }[toolName];
      return { label: `Take the ${nice}`, press: () => T.take(toolName) };
    }
    // ---- loose tires
    if (ud.looseTire) {
      const L = T.loose.find((l) => l.mesh === o || isChild(l.mesh, o));
      return L ? { label: 'Kick the tire', press: () => { const d = L.mesh.position.clone().sub(g.player.feet).setY(0).normalize(); L.body.applyImpulse({ x: d.x * 120, y: 60, z: d.z * 120 }, true); g.audio.thump(0.4, 90); } } : null;
    }
    // ---- straps
    if (ud.part === 'ratchet' && ud.strap) {
      const s = ud.strap;
      return {
        label: s.tension >= 1 ? 'Strap is tight · [RMB] release it' : `Crank the ratchet (${Math.round(s.tension * 100)}%) · [RMB] release`,
        press: () => { if (s.tension < 1) { g.truck.tighten(s); g.audio.ratchet(); g.player.action = 1; } else g.audio.click(); },
        alt: () => { g.truck.removeStrap(s); g.audio.click(); if (!T.hand || T.hand === 'straps') { T.hand = 'straps'; T.strapsInHand++; g.player.carrying = 'straps'; } else T.straps++; },
        pose: 'kneel',
      };
    }
    if (ud.part === 'anchor') {
      if (T.pendingStrap) {
        const a = g.truck.model.bed.anchors[ud.anchor];
        if (a.used) return { label: 'That slot is taken', press: () => {} };
        return { label: 'Hook the strap into this tie-down slot', press: () => this.hookStrap(ud.anchor), pose: 'kneel' };
      }
      return null;
    }
    // ---- winch hook
    if (ud.part === 'winchHook' || ud.part === 'winchDrum') {
      const W = g.truck.winch;
      if (W.state === 'attached') {
        if (T.hand) return { label: `Hands full \u2014 [G] put down the ${T.handName()}`, press: () => {} };
        return { label: 'Unhook the winch from the car', press: () => { g.truck.stowHook(); W.state = 'held'; W.hookPos.copy(g.player.chest()); T.hand = 'hook'; g.player.carrying = 'hook'; g.audio.clank(); } };
      }
      if (W.state === 'stowed' || W.state === 'dropped') {
        if (T.hand) return { label: `Hands full — [G] put down the ${T.handName()}`, press: () => {} };
        return { label: 'Grab the winch hook (free-spool)', press: () => { W.state = 'held'; T.hand = 'hook'; g.player.carrying = 'hook'; g.audio.clank(); g.events.emit('tool', 'hook'); } };
      }
      return null;
    }
    // ---- truck parts
    const owner = findOwner(o);
    if (owner instanceof TowTruck) {
      if (ud.part === 'toolboxDoor') {
        const tb = owner.model.toolboxes.find((b) => b.side === ud.side);
        if (tb.open > 0.5 && T.hand && T.hand !== 'hook' && this.toolboxFor(T.hand) === tb) return { label: `Put the ${T.handName()} back`, press: () => T.putBack() };
        return { label: tb.target ? 'Close the toolbox' : 'Open the toolbox', press: () => { tb.target = tb.target ? 0 : 1; g.audio.clank(); } };
      }
      if (ud.part === 'lever') {
        const bed = ud.lever === 'bed';
        return {
          label: bed ? '[Hold LMB] Bed up (tilt & slide back) · [Hold RMB] bed down' : '[Hold LMB] Winch in · [Hold RMB] winch out',
          hold: (dt, btn) => { const v = btn === 2 ? -1 : 1; if (bed) owner.bed.lever = v; else owner.winch.lever = v; },
          release: () => { owner.bed.lever = 0; owner.winch.lever = 0; },
          // The lever leans as you pull it; keep going while you stand at the controls.
          stay: () => g.mode === 'foot' && owner.controlStationWorld().distanceTo(g.player.feet) < 2.6,
          holdBoth: true,
        };
      }
      if (T.hand && T.hand !== 'hook') {
        const tb = this.nearOpenToolbox();
        if (tb && this.toolboxFor(T.hand) === tb) return { label: `Put the ${T.handName()} back`, press: () => T.putBack() };
      }
      return null;
    }
    // ---- cars
    if (owner instanceof Car) {
      const car = owner;
      if (car.driven) return null;
      const wi = wheelIndex(car, o);
      if (wi >= 0 && !car.wheels[wi].removed) {
        // The car rocks while you work on it, so the hold lasts while you stay at the wheel.
        const atWheel = () => g.mode === 'foot' && !car.wheels[wi].removed && car.wheels[wi].pivot.getWorldPosition(new THREE.Vector3()).distanceTo(g.player.chest()) < 2.4;
        if (T.hand === 'drill') return { label: '[Hold LMB] Zip the lug nuts off with the impact', hold: (dt) => T.drillWheel(car, wi, dt), release: () => T.stopWork(), stay: atWheel, pose: 'kneel' };
        if (T.hand === 'straps' && g.truck.onBed(car)) {
          if (T.pendingStrap) return { label: 'Hook the strap you\'re holding to a tie-down slot first', press: () => {} };
          if (g.truck.straps.some((s) => s.car === car && s.wheel === wi)) return { label: 'This tire is already strapped', press: () => {} };
          return { label: `Wrap a ratchet strap over this tire (${T.strapsInHand} left)`, press: () => this.wrapStrap(car, wi), pose: 'kneel' };
        }
        if (!T.hand) return { label: '[Hold LMB] Rip the wheel off with all your strength', hold: (dt) => { g.player.action = 1; return T.pullWheel(car, wi, dt); }, release: () => { T.stopWork(); g.player.action = 0; }, stay: atWheel, pose: 'pull' };
      }
      if (ud.part === 'hood') {
        return { label: car.hoodTarget ? 'Close the hood' : 'Pop the hood', press: () => { car.setHood(!car.hoodTarget); g.audio.thump(0.3, 120); g.events.emit('hood', car); } };
      }
      if ((ud.part === 'battery' || ud.part === 'bay') && car.hoodOpen > 0.6) {
        const J = T.jump;
        if (T.hand === 'jumpbox') return { label: 'Clamp the RED cable to the + terminal', press: () => T.clampNext(car) };
        if (J.car === car && J.red && !J.black) return { label: 'Clamp the BLACK cable to the − terminal', press: () => T.clampNext(car) };
        if (J.car === car && J.red && J.black) return { label: car.dead ? 'Jump box connected — get in and start it' : 'Engine running · unclamp the jump box', press: () => { if (!car.dead) T.unclamp(); } };
        return { label: car.dead ? 'Battery is dead. Get the jump box from the toolbox.' : 'Battery looks fine', press: () => {} };
      }
      if (!ud.part || ud.slot === 'paint') {
        // Front of the car: hood latch.
        const local = car.worldToLocal(t.hit.point);
        const s = car.model.spec;
        if (local.z > s.zW + 0.1 && local.y > s.noseY - 0.25) return { label: car.hoodTarget ? 'Close the hood' : 'Pop the hood', press: () => { car.setHood(!car.hoodTarget); g.audio.thump(0.3, 120); g.events.emit('hood', car); } };
      }
      return null;
    }
    return null;
  }

  cabAction(id, t) {
    const g = this.game;
    const tr = g.truck;
    switch (id) {
      case 'els_slow': return { label: 'ELS: slow amber flashing', press: () => g.setELS('slow') };
      case 'els_steady': return { label: 'ELS: amber on, no flashing', press: () => g.setELS('steady') };
      case 'els_off': return { label: 'ELS: no amber (off)', press: () => g.setELS('off') };
      case 'work': return { label: tr.work ? 'Deck work lights off' : 'Deck work lights on', press: () => { tr.work = !tr.work; g.audio.button(); } };
      case 'hazard': return { label: tr.hazard ? 'Hazards off' : 'Hazards on', press: () => { tr.hazard = !tr.hazard; g.audio.button(); } };
      case 'parkingBrake': return { label: tr.parkingBrake ? 'Release the parking brake (push in)' : 'Set the parking brake (pull out)', press: () => g.toggleParkingBrake() };
      case 'headlights': return { label: tr.headlights ? 'Headlights off' : 'Headlights on', press: () => { tr.headlights = !tr.headlights; g.audio.click(); } };
      case 'wipers': return { label: tr.wipers ? 'Wipers off' : 'Wipers on', press: () => { tr.wipers = !tr.wipers; g.audio.click(); } };
      case 'horn': return { label: 'Horn', hold: () => { g.audio.horn(true); }, release: () => g.audio.horn(false), stay: () => g.mode === 'truck' };
      case 'chips': {
        const bag = t.obj;
        const c = bag.userData.chips;
        if (c.left <= 0) return { label: 'Empty bag. Crumbs.', press: () => g.audio.bagRustle() };
        return { label: `Eat a handful of ${c.flavor.toLowerCase()} chips (${c.left} left)`, press: () => g.eatChips(bag) };
      }
      case 'mdt': {
        const uv = t.hit.uv;
        const B = tr.interior.mdtButtons || {};
        const inBox = (r) => r && uv && uv.x >= r[0] && uv.x <= r[2] && (1 - uv.y) >= r[1] && (1 - uv.y) <= r[3];
        if (inBox(B.accept)) return { label: 'ACCEPT the call', press: () => g.jobs.accept() };
        if (inBox(B.decline)) return { label: 'Decline the call', press: () => g.jobs.decline() };
        return { label: 'Dispatch radio', press: () => {} };
      }
    }
    return null;
  }

  toolboxFor(tool) {
    const tr = this.game.truck;
    if (!tr) return null;
    const side = tool === 'straps' ? -1 : 1;
    return tr.model.toolboxes.find((b) => b.side === side);
  }
  nearOpenToolbox() {
    const tr = this.game.truck;
    const p = this.game.player.feet;
    for (const tb of tr.model.toolboxes) {
      if (tb.open < 0.5) continue;
      const c = tr.localToWorld(tb.center.clone());
      if (c.distanceTo(p) < 2.2) return tb;
    }
    return null;
  }

  wrapStrap(car, wi) {
    const g = this.game, T = g.tools;
    if (T.strapsInHand <= 0) return;
    T.pendingStrap = { car, wi };
    T.strapsInHand--;
    g.audio.bagRustle();
    g.hud.toast('Strap is over the tire — now click a tie-down slot on the bed rail next to it.');
  }
  hookStrap(anchor) {
    const g = this.game, T = g.tools;
    const p = T.pendingStrap;
    if (!p) return;
    // Slot must be near that wheel.
    const tr = g.truck;
    const aw = tr.anchorWorld(anchor);
    const hub = new THREE.Vector3();
    p.car.wheels[p.wi].pivot.getWorldPosition(hub);
    if (aw.distanceTo(hub) > 1.6) { g.hud.toast('Pick a slot right next to that tire.'); return; }
    tr.addStrap(p.car, p.wi, anchor);
    T.pendingStrap = null;
    g.audio.clank();
    if (T.strapsInHand <= 0) { T.hand = null; g.player.carrying = null; }
    g.events.emit('strap', p.car);
    g.hud.toast('Hooked. Click the ratchet to crank it tight.');
  }

  update(dt) {
    const g = this.game;
    const inp = g.input;
    const picked = this.pick();
    // Continue a hold action while the button stays down and you're still on
    // the same thing; a hold that reports it's finished ends itself.
    if (this.held) {
      const H = this.held;
      if (inp.mouse.down[H.btn] && (H.act.stay ? H.act.stay() : targetKey(picked) === H.key)) {
        this.target = H.act;
        if (H.act.hold(dt, H.btn)) this.endHold();
        return;
      }
      this.endHold();
    }
    const act = this.resolve(picked);
    this.target = act;
    if (!act) return;
    // Poses only play while you're actually doing the thing.
    const posePlayer = () => { if (act.pose && g.mode === 'foot') { g.player.pose = act.pose; g.player.poseTimer = act.hold ? 0 : 0.9; } };
    const startHold = (btn) => { this.held = { act, btn, key: targetKey(picked) }; if (act.hold(dt, btn)) this.endHold(); };
    if (inp.mouse.pressed[0]) {
      posePlayer();
      if (act.hold) startHold(0);
      else act.press?.();
    } else if (inp.mouse.pressed[2]) {
      posePlayer();
      if (act.hold && act.holdBoth) startHold(2);
      else act.alt?.();
    }
  }

  endHold() {
    const g = this.game;
    this.held?.act.release?.();
    this.held = null;
    g.player.pose = 'auto';
    g.player.action = 0;
  }
}

// What a hold is attached to: one wheel, one lever, or one object.
function targetKey(t) {
  if (!t) return null;
  const o = t.obj;
  if (o.userData.part === 'lever') return 'lever:' + o.userData.lever;
  const owner = findOwner(o);
  if (owner instanceof Car) { const wi = wheelIndex(owner, o); if (wi >= 0) return `wheel:${owner.body?.handle}:${wi}`; }
  return o.uuid;
}

function isChild(root, o) { for (let q = o; q; q = q.parent) if (q === root) return true; return false; }
function findOwner(o) { for (let q = o; q; q = q.parent) if (q.userData.owner) return q.userData.owner; return null; }
function wheelIndex(car, o) {
  for (let q = o; q; q = q.parent) {
    const i = car.wheels.findIndex((w) => w.pivot === q);
    if (i >= 0) return i;
  }
  return -1;
}
