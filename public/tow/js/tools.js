// Hand tools and everything you can click in the world: toolboxes, the
// jump box and its clamps, ratchet straps, the winch hook, the impact
// wrench, bed/winch levers, hoods, wheels, cab buttons and the MDT.
import * as THREE from 'three';
import * as M from './materials.js';
import * as TX from './textures.js';
import { makeCanvas, canvasTexture, roundRect, clamp, damp } from './util.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

// ------------------------------------------------------------ tool models

function jumpBoxLabel() {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#f2b705'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#111'; g.fillRect(0, 150, 256, 106);
  g.fillStyle = '#111'; g.font = '900 34px Impact, Arial Black, sans-serif'; g.textAlign = 'center';
  g.fillText('BOOSTMAX', 128, 52);
  g.font = 'bold 20px Arial'; g.fillText('PRO 4000A', 128, 80);
  g.fillStyle = '#0d1a10'; roundRect(g, 70, 96, 116, 44, 6); g.fill();
  g.fillStyle = '#7dff8a'; g.font = 'bold 30px "Courier New", monospace'; g.fillText('12.8V', 128, 129);
  g.fillStyle = '#f2b705'; g.font = 'bold 16px Arial';
  g.fillText('JUMP STARTER · AIR · USB', 128, 182);
  g.fillStyle = '#d32020'; g.beginPath(); g.arc(60, 220, 14, 0, 7); g.fill();
  g.fillStyle = '#ddd'; g.beginPath(); g.arc(196, 220, 14, 0, 7); g.fill();
  return canvasTexture(c);
}

export function buildJumpBox() {
  const g = new THREE.Group();
  const label = jumpBoxLabel();
  const caseMat = new THREE.MeshStandardMaterial({ map: label, roughness: 0.55, metalness: 0.05 });
  const black = new THREE.MeshStandardMaterial({ color: 0x151517, roughness: 0.65 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.26, 0.14, 4, 0.03), [black, black, black, black, caseMat, caseMat]);
  body.position.y = 0.13;
  g.add(body);
  // Molded carry handle.
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.016, 10, 24, Math.PI), black);
  handle.position.y = 0.26;
  g.add(handle);
  // Bumpers on the corners.
  for (const x of [-0.14, 0.14]) for (const y of [0.02, 0.24]) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), M.rubber());
    b.position.set(x, y, 0);
    b.scale.set(1, 1, 2.6);
    g.add(b);
  }
  // Clamps parked on the side (when not connected).
  const clampR = buildClamp(0xc0161a), clampB = buildClamp(0x111111);
  clampR.position.set(-0.17, 0.12, 0.04); clampR.rotation.z = Math.PI / 2;
  clampB.position.set(-0.17, 0.12, -0.04); clampB.rotation.z = Math.PI / 2;
  g.add(clampR, clampB);
  g.userData.clamps = { red: clampR, black: clampB };
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.userData.tool = 'jumpbox'; } });
  return g;
}

// Alligator clamp: insulated handles, copper jaws with teeth.
export function buildClamp(color) {
  const g = new THREE.Group();
  const ins = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
  const copper = new THREE.MeshStandardMaterial({ color: 0xc27b4a, metalness: 1, roughness: 0.35 });
  for (const s of [1, -1]) {
    const h = new THREE.Mesh(new RoundedBoxGeometry(0.026, 0.09, 0.022, 2, 0.008), ins);
    h.position.set(0, 0.05, s * 0.012);
    h.rotation.x = s * 0.15;
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.05, 0.006), copper);
    jaw.position.set(0, -0.02, s * 0.006);
    g.add(h, jaw);
  }
  const spring = new THREE.Mesh(new THREE.TorusGeometry(0.009, 0.003, 6, 12), M.chrome());
  spring.position.y = 0.02;
  spring.rotation.y = Math.PI / 2;
  g.add(spring);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export function buildDrill() {
  const g = new THREE.Group();
  const yellow = new THREE.MeshStandardMaterial({ color: 0xf2b705, roughness: 0.45 });
  const black = new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.6 });
  const steel = M.chrome();
  // Motor housing.
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.038, 0.17, 18), yellow);
  motor.rotation.x = Math.PI / 2;
  motor.position.set(0, 0.17, 0.0);
  g.add(motor);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.03, 0.03, 18), black);
  cap.rotation.x = Math.PI / 2; cap.position.set(0, 0.17, -0.1);
  g.add(cap);
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.034, 0.05, 16), black);
  nose.rotation.x = Math.PI / 2; nose.position.set(0, 0.17, 0.105);
  g.add(nose);
  // Anvil + 19mm impact socket.
  const anvil = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.03), steel);
  anvil.position.set(0, 0.17, 0.14);
  const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.055, 6), new THREE.MeshStandardMaterial({ color: 0x2a2a2c, metalness: 0.9, roughness: 0.3 }));
  socket.rotation.x = Math.PI / 2; socket.position.set(0, 0.17, 0.175);
  g.add(anvil, socket);
  g.userData.socket = socket;
  // Pistol grip with trigger and battery pack.
  const grip = new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.12, 0.045, 2, 0.012), black);
  grip.position.set(0, 0.09, -0.02);
  grip.rotation.x = 0.2;
  g.add(grip);
  const trig = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.012), black);
  trig.position.set(0, 0.13, 0.015);
  g.add(trig);
  const batt = new THREE.Mesh(new RoundedBoxGeometry(0.075, 0.05, 0.11, 2, 0.01), yellow);
  batt.position.set(0, 0.025, -0.01);
  const battB = new THREE.Mesh(new RoundedBoxGeometry(0.077, 0.02, 0.112, 2, 0.006), black);
  battB.position.set(0, 0.045, -0.01);
  g.add(batt, battB);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.userData.tool = 'drill'; } });
  return g;
}

export function buildStrapCoil(n = 4) {
  const g = new THREE.Group();
  const web = new THREE.MeshStandardMaterial({ ...TX.webbing('#e8b41a'), roughness: 0.85 });
  for (let i = 0; i < n; i++) {
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.025, 6, 20), web);
    coil.rotation.x = Math.PI / 2;
    coil.scale.set(1, 1, 1.9);
    coil.position.set(0, 0.03 + i * 0.05, 0);
    g.add(coil);
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, 0.12), M.std(0x9ea3a8, 0.3, 0.95));
    r.position.set(0.09, 0.03 + i * 0.05, 0);
    g.add(r);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.userData.tool = 'straps'; } });
  return g;
}

export function buildCreeper() {
  const g = new THREE.Group();
  const board = new THREE.Mesh(new RoundedBoxGeometry(0.45, 0.04, 1.0, 2, 0.015), new THREE.MeshStandardMaterial({ color: 0xc0161a, roughness: 0.5 }));
  board.position.y = 0.09;
  g.add(board);
  const pad = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.04, 0.2, 2, 0.015), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 }));
  pad.position.set(0, 0.12, -0.38);
  g.add(pad);
  for (const x of [-0.18, 0.18]) for (const z of [-0.42, 0, 0.42]) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 }));
    c.position.set(x, 0.035, z);
    g.add(c);
  }
  return g;
}

// ---------------------------------------------------------- tool manager

export class Tools {
  constructor(game) {
    this.game = game;
    this.hand = null;            // 'jumpbox' | 'drill' | 'straps' | 'hook' | null
    this.straps = 4;             // straps currently in the toolbox
    this.strapsInHand = 0;
    this.pendingStrap = null;    // {car, wheel} waiting to be hooked to a slot
    this.jump = { state: 'box', car: null, red: false, black: false, box: buildJumpBox(), cables: null, groundPos: new THREE.Vector3() };
    this.drill = { state: 'box', mesh: buildDrill(), groundPos: new THREE.Vector3() };
    this.strapCoil = buildStrapCoil(4);
    this.creeper = buildCreeper();
    this.loose = [];             // tires knocked off, as physics props
    this.nuts = [];              // flying lug nuts
    this.work = null;            // current hold action progress
    game.scene.add(this.jump.box, this.drill.mesh, this.strapCoil, this.creeper);
    this.creeper.visible = false;
    for (const o of [this.jump.box, this.drill.mesh, this.strapCoil]) o.traverse((m) => { if (m.isMesh) m.userData.owner = this; });
    this.buildCables();
  }

  get truck() { return this.game.truck; }

  // Where each tool sits in the truck's toolboxes (driver side: jump box +
  // impact wrench; passenger side: straps).
  stowTransforms() {
    const t = this.truck;
    const tbL = t.model.toolboxes.find((b) => b.side > 0), tbR = t.model.toolboxes.find((b) => b.side < 0);
    return {
      jumpbox: t.localToWorld(tbL.slots[0].clone()),
      drill: t.localToWorld(tbL.slots[1].clone().add(new THREE.Vector3(0, 0, 0))),
      straps: t.localToWorld(tbR.slots[0].clone()),
    };
  }

  update(dt) {
    const g = this.game;
    const t = this.truck;
    if (!t) return;
    const st = this.stowTransforms();
    const q = t.curQuat;
    const handObj = g.player?.avatar.rig.R.grip;
    // Jump box placement.
    const J = this.jump;
    J.box.visible = true;
    if (J.state === 'box') { J.box.position.copy(st.jumpbox); J.box.quaternion.copy(q); J.box.rotateY(Math.PI / 2); }
    else if (J.state === 'hand' && handObj) { this.attachToHand(J.box, handObj, new THREE.Vector3(0, -0.24, 0.02)); }
    else if (J.state === 'ground') { J.box.position.copy(J.groundPos); }
    else if (J.state === 'connected' && J.car) {
      // Sitting on the radiator support in the engine bay.
      const s = J.car.model.spec;
      J.car.localToWorld(_v.set(0, s.noseY + 0.02, s.L / 2 - 0.32), J.box.position);
      J.box.quaternion.copy(J.car.curQuat);
    }
    this.updateCables(dt);
    // Winch hook in your hand (or in front of your face under a car).
    const W = t.winch;
    if (W.state === 'held') {
      // On the creeper you hold it out toward the frame, not in your face.
      if (g.mode === 'under' && g.underCamPos && g.under?.eye) W.hookPos.copy(g.underCamPos).lerp(g.under.eye.getWorldPosition(_v), 0.45);
      else if (handObj && g.mode === 'foot') { handObj.updateWorldMatrix(true, false); handObj.getWorldPosition(W.hookPos); }
      else W.hookPos.copy(g.player.chest());
    }
    // Drill.
    const D = this.drill;
    if (D.state === 'box') { D.mesh.position.copy(st.drill); D.mesh.quaternion.copy(q); D.mesh.rotateZ(Math.PI / 2); D.mesh.position.y += 0.04; }
    else if (D.state === 'hand' && handObj) this.attachToHand(D.mesh, handObj, new THREE.Vector3(0, -0.1, 0.02), true);
    else if (D.state === 'ground') D.mesh.position.copy(D.groundPos);
    if (D.spin) { D.mesh.userData.socket.rotation.y += dt * 60; }
    // Strap coil: in the box shows what's left; in hand shows what's carried.
    const inBox = this.straps;
    this.strapCoil.children.forEach((c, i) => { c.visible = Math.floor(i / 2) < (this.hand === 'straps' ? this.strapsInHand : inBox); });
    if (this.hand === 'straps' && handObj) this.attachToHand(this.strapCoil, handObj, new THREE.Vector3(0, -0.12, 0.05));
    else { this.strapCoil.position.copy(st.straps); this.strapCoil.quaternion.copy(q); }
    // Loose tires and flying nuts.
    for (const L of this.loose) {
      const p = L.body.translation(), r = L.body.rotation();
      L.mesh.position.set(p.x, p.y, p.z);
      L.mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }
    for (const n of this.nuts) {
      n.v.y -= 9.8 * dt;
      n.mesh.position.addScaledVector(n.v, dt);
      n.mesh.rotation.x += dt * 20;
      if (n.mesh.position.y < n.floor) { n.mesh.position.y = n.floor; n.v.multiplyScalar(0.3); n.v.y = Math.abs(n.v.y) * 0.3; }
      n.life -= dt;
    }
    this.nuts = this.nuts.filter((n) => { if (n.life <= 0) { g.scene.remove(n.mesh); return false; } return true; });
  }

  attachToHand(obj, grip, offset, pointForward = false) {
    grip.updateWorldMatrix(true, false);
    const p = offset.clone().applyMatrix4(grip.matrixWorld);
    obj.position.copy(p);
    const q = new THREE.Quaternion();
    grip.getWorldQuaternion(q);
    obj.quaternion.copy(q);
    if (pointForward) obj.rotateX(-Math.PI / 2);
  }

  // ------------------------------------------------- jumper cables
  buildCables() {
    const mk = (color) => {
      const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
      m.castShadow = true; m.frustumCulled = false;
      this.game.scene.add(m);
      return m;
    };
    this.cableR = mk(0xb3121b);
    this.cableB = mk(0x111111);
  }
  updateCables() {
    const J = this.jump;
    const box = J.box;
    const show = J.state !== 'box';
    this.cableR.visible = this.cableB.visible = show;
    const clamps = box.userData.clamps;
    if (!show) { clamps.red.visible = clamps.black.visible = true; return; }
    box.updateWorldMatrix(true, true);
    const out = (side) => new THREE.Vector3(-0.15, 0.2, side * 0.04).applyMatrix4(box.matrixWorld);
    for (const [key, mesh, side] of [['red', this.cableR, 1], ['black', this.cableB, -1]]) {
      const clampObj = clamps[key];
      const start = out(side);
      let end;
      const onTerminal = J.car && J.state === 'connected' && J[key];
      if (onTerminal) {
        const term = key === 'red' ? J.car.inst.terminals.pos : J.car.inst.terminals.neg;
        end = new THREE.Vector3();
        term.getWorldPosition(end);
        end.y += 0.035;
        // Move the clamp mesh into world space at the terminal.
        clampObj.visible = false;
        if (!J[key + 'Mesh']) { J[key + 'Mesh'] = buildClamp(key === 'red' ? 0xc0161a : 0x111111); this.game.scene.add(J[key + 'Mesh']); }
        J[key + 'Mesh'].visible = true;
        J[key + 'Mesh'].position.copy(end).add(new THREE.Vector3(0, 0.03, 0));
      } else {
        clampObj.visible = true;
        if (J[key + 'Mesh']) J[key + 'Mesh'].visible = false;
        end = new THREE.Vector3();
        clampObj.getWorldPosition(end);
      }
      const mid = start.clone().lerp(end, 0.5);
      mid.y -= Math.min(0.3, start.distanceTo(end) * 0.35);
      const curve = new THREE.CatmullRomCurve3([start, start.clone().lerp(mid, 0.5).add(new THREE.Vector3(0, -0.04, 0)), mid, end]);
      mesh.geometry.dispose();
      mesh.geometry = new THREE.TubeGeometry(curve, 24, 0.008, 6, false);
    }
  }

  // ------------------------------------------------- hand actions
  take(tool) {
    const g = this.game;
    if (this.hand) { g.hud.toast(`Your hands are full (${this.handName()}). Press G to put it down.`); return false; }
    if (tool === 'jumpbox') { this.jump.state = 'hand'; this.jump.car = null; this.jump.red = this.jump.black = false; }
    if (tool === 'drill') this.drill.state = 'hand';
    if (tool === 'straps') { if (this.straps <= 0) { g.hud.toast('No straps left in the box.'); return false; } this.strapsInHand = this.straps; this.straps = 0; }
    this.hand = tool;
    g.player.carrying = tool;
    g.audio.clank();
    g.events.emit('tool', tool);
    return true;
  }
  putBack() {
    const g = this.game;
    const tool = this.hand;
    if (!tool) return;
    if (tool === 'jumpbox') this.jump.state = 'box';
    if (tool === 'drill') this.drill.state = 'box';
    if (tool === 'straps') this.returnStraps();
    if (tool === 'hook') g.truck.stowHook();
    this.hand = null;
    g.player.carrying = null;
    g.audio.clank();
  }
  // Straps in hand, plus one draped over a tire but not hooked yet, go back in the box.
  returnStraps() {
    this.straps += this.strapsInHand + (this.pendingStrap ? 1 : 0);
    this.strapsInHand = 0;
    this.pendingStrap = null;
  }
  // Climbing into a cab: whatever you're holding goes back where it lives.
  stowHand() {
    const tool = this.hand;
    if (!tool) return;
    this.putBack();
    this.game.hud.toast(tool === 'hook' ? 'You let the winch reel the hook back in.' : `Put the ${tool === 'straps' ? 'straps' : tool === 'drill' ? 'impact wrench' : 'jump box'} back in the toolbox.`, 2.5);
  }
  drop() {
    const g = this.game;
    const tool = this.hand;
    if (!tool) return;
    const fwd = new THREE.Vector3(Math.sin(g.player.yaw), 0, Math.cos(g.player.yaw));
    const p = g.player.feet.clone().addScaledVector(fwd, 0.5);
    p.y = g.physics.groundHeight(p.x, p.z, p.y + 1.5) + 0.002;
    if (tool === 'jumpbox') { this.jump.state = 'ground'; this.jump.groundPos.copy(p); }
    if (tool === 'drill') { this.drill.state = 'ground'; this.drill.groundPos.copy(p); }
    if (tool === 'straps') { this.returnStraps(); g.hud.toast('Straps tossed back in the toolbox.'); }
    if (tool === 'hook') { g.truck.winch.state = 'dropped'; g.truck.winch.hookPos.copy(p).add(new THREE.Vector3(0, 0.05, 0)); }
    this.hand = null;
    g.player.carrying = null;
  }
  handName() {
    return { jumpbox: 'jump box', drill: 'impact wrench', straps: `${this.strapsInHand} ratchet straps`, hook: 'winch hook' }[this.hand] || 'nothing';
  }
  // End of a job: anything left lying around goes back in the box.
  restock() {
    if (this.jump.state === 'ground' || this.jump.state === 'connected') this.jump.state = 'box';
    if (this.drill.state === 'ground') this.drill.state = 'box';
    this.jump.car = null; this.jump.red = this.jump.black = false;
    // A hook left lying around gets reeled in; a dangling strap goes back in the box.
    const W = this.game.truck.winch;
    if (W.state === 'dropped') this.game.truck.stowHook();
    if (this.pendingStrap) { this.straps++; this.pendingStrap = null; }
    // Four straps, wherever they are.
    this.straps = Math.max(0, 4 - this.strapsInHand - this.game.truck.straps.length);
  }

  // Clamp the next cable on, in the right order: red to +, black to -.
  clampNext(car) {
    const J = this.jump;
    const g = this.game;
    if (J.car !== car) { J.car = car; J.red = false; J.black = false; }
    if (!J.red) { J.red = true; J.state = 'connected'; this.hand = null; g.player.carrying = null; g.audio.click(); g.hud.toast('Red clamp on the positive (+) terminal.'); g.events.emit('clamp', 'red'); return; }
    if (!J.black) { J.black = true; g.audio.click(); g.hud.toast('Black clamp on the negative (−) terminal. Jump box is ON — go start it.'); g.events.emit('clamp', 'black'); }
  }
  unclamp() {
    const J = this.jump;
    if (this.hand) { this.game.hud.toast(`Hands full \u2014 put down the ${this.handName()} first (G).`); return; }
    J.red = J.black = false;
    J.state = 'hand';
    this.hand = 'jumpbox';
    this.game.player.carrying = 'jumpbox';
    J.car = null;
    this.game.audio.click();
  }
  jumpReady(car) { return this.jump.car === car && this.jump.red && this.jump.black; }

  // ---------------------------------------------------- tire removal
  // Impact wrench: lugs spin off one at a time, then the wheel drops.
  drillWheel(car, wi, dt) {
    const w = car.wheels[wi];
    const W = this.work && this.work.car === car && this.work.wi === wi && this.work.kind === 'drill' ? this.work : (this.work = { car, wi, kind: 'drill', p: 0, nutsOff: 0 });
    W.p += dt / 2.6;
    const total = w.lugs?.length || 5;
    const should = Math.floor(W.p * (total + 0.5));
    while (W.nutsOff < Math.min(total, should)) {
      const lug = w.lugs?.[W.nutsOff];
      if (lug) { this.flingNut(lug, car); lug.visible = false; }
      W.nutsOff++;
      this.game.audio.pop();
    }
    this.drill.spin = true;
    this.game.audio.setLoop('drill', 1, 32 + Math.random() * 8);
    this.game.camRig.shake = Math.max(this.game.camRig.shake, 0.3);
    if (W.p >= 1) { this.detachWheel(car, wi, 1.5); this.work = null; return true; }
    return false;
  }
  // No tools: grab the tire and heave until it rips off.
  pullWheel(car, wi, dt) {
    const W = this.work && this.work.car === car && this.work.wi === wi && this.work.kind === 'pull' ? this.work : (this.work = { car, wi, kind: 'pull', p: 0 });
    W.p += dt / 5.5;
    this.game.audio.setLoop('strain', 1);
    this.game.camRig.shake = Math.max(this.game.camRig.shake, 0.6 + W.p);
    // The whole car rocks while you heave on it.
    const w = car.wheels[wi];
    const hub = car.localToWorld(_v.set(w.conn.x, w.conn.y - w.rest, w.conn.z));
    const out = _v2.set(w.side, 0.2, 0).applyQuaternion(car.curQuat);
    const k = Math.sin(performance.now() / 70) * 160 * (0.4 + W.p);
    car.body.applyImpulseAtPoint({ x: out.x * k * dt * 10, y: Math.abs(k) * dt * 4, z: out.z * k * dt * 10 }, { x: hub.x, y: hub.y, z: hub.z }, true);
    if (W.p >= 1) {
      for (const lug of w.lugs || []) { this.flingNut(lug, car, 3); lug.visible = false; }
      this.detachWheel(car, wi, 4.5);
      this.work = null;
      this.game.audio.clank();
      return true;
    }
    return false;
  }
  stopWork() {
    this.drill.spin = false;
    this.game.audio.setLoop('drill', 0);
    this.game.audio.setLoop('strain', 0);
  }

  flingNut(lug, car, speed = 1.6) {
    const p = new THREE.Vector3();
    lug.getWorldPosition(p);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.024, 6), M.chrome());
    m.position.copy(p);
    this.game.scene.add(m);
    const out = new THREE.Vector3(Math.sign(car.worldToLocal(p).x) || 1, 0, 0).applyQuaternion(car.curQuat);
    const floor = groundBelow(this.game, p, car) + 0.012;
    this.nuts.push({ mesh: m, floor, v: out.multiplyScalar(speed).add(new THREE.Vector3((Math.random() - 0.5), 1.5 + Math.random(), (Math.random() - 0.5))), life: 25 });
  }

  // The wheel becomes a loose physics object that rolls off.
  detachWheel(car, wi, kick) {
    const g = this.game;
    const w = car.wheels[wi];
    const pos = car.removeWheel(wi);
    if (!pos) return;
    const s = car.model.spec;
    // Tire + rim only (Object3D.clone would deep-copy userData, which points back at the car).
    const facing = w.spin?.children[0] ?? w.pivot;
    const visual = cloneVisual(facing);
    visual.visible = true;
    visual.position.set(0, 0, 0);
    visual.quaternion.copy(facing.quaternion);
    visual.traverse((o) => { if (o.isMesh) { o.userData.owner = this; o.userData.looseTire = true; } });
    const holder = new THREE.Group();
    holder.add(visual);
    g.scene.add(holder);
    const R = g.physics.R;
    const out = new THREE.Vector3(w.side, 0, 0).applyQuaternion(car.curQuat);
    // Starts just clear of the hub (outside the body) with a real tire's inertia.
    const m = 22, r = s.tireR, h = s.tireW;
    const at = pos.clone().addScaledVector(out, h / 2 + 0.12);
    at.y = Math.max(at.y, groundBelow(g, at, car) + r + 0.03);
    const body = g.physics.dynamicBody({ x: at.x, y: at.y + 0.02, z: at.z }, car.curQuat, {
      mass: m, inertia: { x: m * r * r / 2, y: m * (3 * r * r + h * h) / 12, z: m * (3 * r * r + h * h) / 12 }, linDamp: 0.1, angDamp: 0.2,
    });
    const col = g.physics.world.createCollider(R.ColliderDesc.cylinder(s.tireW / 2, s.tireR).setRotation({ x: 0, y: 0, z: Math.sin(Math.PI / 4), w: Math.cos(Math.PI / 4) }).setFriction(1.1).setRestitution(0.35).setDensity(0), body);
    col.userData = { prop: 'tire' };
    // Velocities, not impulses: a new body's mass isn't computed until the next step.
    body.setLinvel({ x: out.x * kick, y: 1.2, z: out.z * kick }, true);
    // Tip the top outward so it flops over (or tumbles away if you ripped it off).
    const tip = (2 + 0.5 * kick) / (m * (3 * r * r + h * h) / 12);
    body.setAngvel({ x: out.z * tip, y: (Math.random() - 0.5) * 1.5, z: -out.x * tip }, true);
    this.loose.push({ body, mesh: holder });
    g.events.emit('wheelOff', { car, wi });
    g.hud.toast(kick > 2 ? 'You ripped the wheel clean off with your bare hands!' : 'Wheel’s off.');
  }

  dispose() {
    const g = this.game;
    for (const L of this.loose) { g.physics.removeBody(L.body); g.scene.remove(L.mesh); }
    this.loose = [];
  }
}

// Ground height under p, ignoring the car itself (its body hull covers the wheel wells).
function groundBelow(g, p, car) {
  const h = g.physics.ray({ x: p.x, y: p.y + 0.5, z: p.z }, { x: 0, y: -1, z: 0 }, 6, { excludeBody: car.body, predicate: (c) => !c.userData?.player && !c.userData?.prop });
  return h ? h.point.y : p.y - 0.3;
}

// Copies a mesh hierarchy, sharing geometry and materials, skipping hidden parts.
function cloneVisual(src) {
  const dst = src.isMesh ? new THREE.Mesh(src.geometry, src.material) : new THREE.Group();
  dst.position.copy(src.position);
  dst.quaternion.copy(src.quaternion);
  dst.scale.copy(src.scale);
  dst.castShadow = src.castShadow;
  dst.receiveShadow = src.receiveShadow;
  for (const c of src.children) if (c.visible) dst.add(cloneVisual(c));
  return dst;
}
