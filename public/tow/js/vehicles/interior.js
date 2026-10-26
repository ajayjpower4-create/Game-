// Tow truck cab interior: dash, live gauges, steering wheel, seats, door
// cards, the amber ELS switch panel, a push-pull parking brake, the dispatch
// MDT you accept calls on, and bags of chips riding shotgun.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as M from '../materials.js';
import * as TX from '../textures.js';
import { makeCanvas, canvasTexture, roundRect, fitText, clamp, heightToNormal } from '../util.js';
import { getCabModel } from './towtruck.js';

function rbox(w, h, d, r, mat, x, y, z, parent, seg = 3) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, r), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// Fabric with a woven normal map for seats.
let _fabric = null;
function fabric() {
  if (_fabric) return _fabric;
  const N = 128;
  const h = makeCanvas(N, N);
  const g = h.getContext('2d');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const v = ((x >> 1) + (y >> 1)) % 2 ? 180 : 90;
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.fillRect(x, y, 1, 1);
  }
  const n = canvasTexture(heightToNormal(h, 1.5), { repeat: true, srgb: false });
  n.repeat.set(6, 6);
  _fabric = new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.95, normalMap: n, normalScale: new THREE.Vector2(0.6, 0.6) });
  return _fabric;
}

const dashPlastic = () => {
  const p = TX.texturedPlastic();
  const n = p.normalMap.clone();
  n.needsUpdate = true;
  n.repeat.set(8, 8);
  return new THREE.MeshStandardMaterial({ color: 0x232427, roughness: 0.7, normalMap: n, normalScale: new THREE.Vector2(0.5, 0.5) });
};

// ------------------------------------------------------------- textures

export function drawGauges(canvas, s) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  g.fillStyle = '#050608'; g.fillRect(0, 0, W, H);
  const dial = (cx, cy, r, value, max, label, ticks, red) => {
    g.save();
    g.translate(cx, cy);
    const grad = g.createRadialGradient(0, 0, r * 0.2, 0, 0, r);
    grad.addColorStop(0, '#15181d'); grad.addColorStop(1, '#0a0b0e');
    g.fillStyle = grad; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#8a929c'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, r - 2, 0, Math.PI * 2); g.stroke();
    const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    for (let i = 0; i <= ticks; i++) {
      const a = a0 + (a1 - a0) * (i / ticks);
      const major = i % 2 === 0;
      g.strokeStyle = red && i / ticks > red ? '#e0332b' : '#e9edf2';
      g.lineWidth = major ? 3 : 1.5;
      g.beginPath();
      g.moveTo(Math.cos(a) * (r - 6), Math.sin(a) * (r - 6));
      g.lineTo(Math.cos(a) * (r - (major ? 18 : 12)), Math.sin(a) * (r - (major ? 18 : 12)));
      g.stroke();
      if (major) {
        g.fillStyle = '#e9edf2'; g.font = `bold ${Math.round(r * 0.16)}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(Math.round((max * i) / ticks / (label === 'RPM x1000' ? 1000 : 1))), Math.cos(a) * (r - 32), Math.sin(a) * (r - 32));
      }
    }
    g.fillStyle = '#9aa3ad'; g.font = `${Math.round(r * 0.13)}px Arial`; g.textAlign = 'center';
    g.fillText(label, 0, r * 0.45);
    const a = a0 + (a1 - a0) * clamp(value / max, 0, 1);
    g.strokeStyle = '#ff5a1f'; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-Math.cos(a) * 10, -Math.sin(a) * 10); g.lineTo(Math.cos(a) * (r - 14), Math.sin(a) * (r - 14)); g.stroke();
    g.fillStyle = '#30343a'; g.beginPath(); g.arc(0, 0, 9, 0, Math.PI * 2); g.fill();
    g.restore();
  };
  dial(W * 0.27, H * 0.5, H * 0.44, s.rpm, 4000, 'RPM x1000', 8, 0.82);
  dial(W * 0.73, H * 0.5, H * 0.44, s.mph, 100, 'MPH', 10, 0);
  // Center info: gear, odometer, fuel, temp, warnings.
  g.fillStyle = '#0d1014'; roundRect(g, W * 0.43, H * 0.12, W * 0.14, H * 0.76, 8); g.fill();
  g.fillStyle = '#7fd1ff'; g.font = `bold ${Math.round(H * 0.16)}px Arial`; g.textAlign = 'center';
  g.fillText(s.gear, W * 0.5, H * 0.33);
  g.font = `${Math.round(H * 0.07)}px Arial`; g.fillStyle = '#cfd6de';
  g.fillText(String(Math.round(s.odo)).padStart(6, '0') + ' mi', W * 0.5, H * 0.46);
  // Fuel bar.
  g.fillStyle = '#2a2f36'; g.fillRect(W * 0.45, H * 0.56, W * 0.1, H * 0.06);
  g.fillStyle = s.fuel < 0.15 ? '#ff9a1f' : '#7ee07e'; g.fillRect(W * 0.45, H * 0.56, W * 0.1 * s.fuel, H * 0.06);
  g.fillStyle = '#cfd6de'; g.font = `${Math.round(H * 0.05)}px Arial`; g.fillText('E   FUEL   F', W * 0.5, H * 0.68);
  // Indicator lamps.
  const lamp = (x, y, col, on, txt) => {
    g.fillStyle = on ? col : '#1b1f25';
    g.font = `bold ${Math.round(H * 0.06)}px Arial`;
    g.fillText(txt, x, y);
  };
  lamp(W * 0.47, H * 0.8, '#ff3b30', s.parking, '(P)');
  lamp(W * 0.53, H * 0.8, '#ffb000', s.els !== 'off', '◆');
  lamp(W * 0.12, H * 0.14, '#36d36a', s.turnL, '◀');
  lamp(W * 0.88, H * 0.14, '#36d36a', s.turnR, '▶');
  lamp(W * 0.5, H * 0.92, '#3aa0ff', s.high, 'HI');
}

export function makeButtonTexture(label, sub = '', color = '#ffb000') {
  const c = makeCanvas(128, 96);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 96);
  grad.addColorStop(0, '#2e3136'); grad.addColorStop(1, '#16181b');
  g.fillStyle = grad; roundRect(g, 2, 2, 124, 92, 12); g.fill();
  g.strokeStyle = '#4a4e55'; g.lineWidth = 3; roundRect(g, 2, 2, 124, 92, 12); g.stroke();
  g.fillStyle = '#f1f3f5'; g.textAlign = 'center';
  fitText(g, label, 110, 26, 800);
  g.fillText(label, 64, 46);
  if (sub) { g.font = '600 15px Arial'; g.fillStyle = '#aeb5bd'; g.fillText(sub, 64, 70); }
  g.fillStyle = color; g.fillRect(44, 80, 40, 6);
  return canvasTexture(c);
}

function chipsTexture(flavor, color) {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, color); grad.addColorStop(1, '#1a1a1a');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(255,255,255,0.15)';
  for (let i = 0; i < 12; i++) g.fillRect(0, i * 22, 256, 2);
  g.fillStyle = '#fff6d6';
  g.beginPath(); g.ellipse(128, 120, 92, 60, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#b32020';
  g.font = '900 34px Impact, Arial Black, sans-serif'; g.textAlign = 'center';
  g.fillText('CRUNCH', 128, 108);
  g.fillText('TOWN', 128, 146);
  g.fillStyle = '#fff'; g.font = 'bold 24px Arial';
  g.fillText('KETTLE CHIPS', 128, 205);
  g.font = 'bold 20px Arial'; g.fillStyle = '#ffe28a';
  g.fillText(flavor, 128, 236);
  // Chip illustrations.
  g.fillStyle = '#e8b04a';
  for (const [x, y] of [[40, 40], [210, 50], [60, 190]]) { g.beginPath(); g.ellipse(x, y, 22, 15, 0.4, 0, 7); g.fill(); }
  return canvasTexture(c);
}

// Pillow-shaped bag: a subdivided box squeezed at the crimped ends.
function chipBagGeometry() {
  const g = new THREE.BoxGeometry(0.2, 0.3, 0.08, 8, 12, 4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const ty = Math.abs(y) / 0.15; // 0 center → 1 crimp
    const squeeze = 1 - Math.pow(ty, 4);
    const puff = Math.cos((x / 0.1) * Math.PI / 2) * 0.6 + 0.4;
    p.setZ(i, z * squeeze * puff);
    p.setX(i, x * (1 - 0.05 * Math.pow(ty, 3)));
    // Crinkle.
    p.setZ(i, p.getZ(i) + Math.sin(x * 90 + y * 50) * 0.002 * squeeze);
  }
  g.computeVertexNormals();
  return g;
}

export function drawMDT(canvas, state) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  g.fillStyle = '#0b1220'; g.fillRect(0, 0, W, H);
  // Status bar.
  g.fillStyle = '#16233a'; g.fillRect(0, 0, W, 40);
  g.fillStyle = '#9fc4ff'; g.font = 'bold 20px Arial'; g.textAlign = 'left';
  g.fillText('SKYVILLE DISPATCH · MDT', 14, 27);
  g.textAlign = 'right'; g.fillStyle = '#d6e4ff';
  g.fillText(state.clock || '', W - 14, 27);
  const btns = {};
  if (state.call) {
    const c = state.call;
    g.fillStyle = state.flash ? '#ffcc33' : '#ffb000';
    g.fillRect(0, 40, W, 34);
    g.fillStyle = '#1a1200'; g.font = 'bold 22px Arial'; g.textAlign = 'center';
    g.fillText(c.accepted ? 'ACTIVE CALL' : '◆ NEW CALL ◆', W / 2, 65);
    g.textAlign = 'left'; g.fillStyle = '#ffffff';
    fitText(g, c.title, W - 30, 26, 800);
    g.fillText(c.title, 16, 106);
    g.font = '18px Arial'; g.fillStyle = '#c9d6ea';
    const lines = [
      `Vehicle: ${c.vehicleName}`,
      `Location: ${c.locationName}`,
      `Distance: ${c.distance}   ·   Pay: ${c.pay}`,
      c.accepted ? `Destination: ${c.destination || 'ask the customer on scene'}` : `Job: ${c.method}`,
    ];
    lines.forEach((l, i) => { fitText(g, l, W - 30, 18, 400); g.fillText(l, 16, 136 + i * 26); });
    if (!c.accepted) {
      g.fillStyle = '#1f9d55'; roundRect(g, 16, H - 74, W / 2 - 24, 58, 10); g.fill();
      g.fillStyle = '#9b2226'; roundRect(g, W / 2 + 8, H - 74, W / 2 - 24, 58, 10); g.fill();
      g.fillStyle = '#fff'; g.font = 'bold 26px Arial'; g.textAlign = 'center';
      g.fillText('ACCEPT', 16 + (W / 2 - 24) / 2, H - 36);
      g.fillText('DECLINE', W / 2 + 8 + (W / 2 - 24) / 2, H - 36);
      btns.accept = [16 / W, (H - 74) / H, (W / 2 - 8) / W, (H - 16) / H];
      btns.decline = [(W / 2 + 8) / W, (H - 74) / H, (W - 16) / W, (H - 16) / H];
    } else {
      g.fillStyle = '#20324f'; roundRect(g, 16, H - 74, W - 32, 58, 10); g.fill();
      g.fillStyle = '#d6e4ff'; g.font = 'bold 20px Arial'; g.textAlign = 'center';
      fitText(g, state.nav || 'Follow the GPS route', W - 60, 20, 700);
      g.fillText(state.nav || 'Follow the GPS route', W / 2, H - 38);
    }
  } else {
    g.fillStyle = '#9fb3cc'; g.font = 'bold 26px Arial'; g.textAlign = 'center';
    g.fillText('AVAILABLE', W / 2, 110);
    g.font = '18px Arial'; g.fillStyle = '#6f84a0';
    g.fillText(state.idleText || 'Waiting for calls…', W / 2, 146);
    g.fillStyle = '#c9d6ea'; g.font = '18px Arial';
    g.fillText(`Jobs today: ${state.jobs || 0}    Earned: ${state.earned || '$0'}`, W / 2, 190);
    g.fillText(`Unit ${state.unit || ''}`, W / 2, 222);
  }
  return btns;
}

// ------------------------------------------------------------- builder

export function buildInterior(t, truck) {
  const group = new THREE.Group();
  group.name = 'interior';
  const cs = getCabModel(t).spec;
  const cz = truck.cabCenter;
  const W = t.cab.W;
  const xIn = W / 2 - 0.085;
  const floor = t.floorY;
  const roof = t.cab.H - 0.075;
  const zDash = cz + cs.zW;               // windshield base
  const zRear = cz + cs.zB + 0.075;        // inside face of the back wall
  const belt = cs.beltF;
  const plastic = dashPlastic();
  const plasticLight = new THREE.MeshStandardMaterial({ color: 0x55585e, roughness: 0.75 });
  const carpet = new THREE.MeshStandardMaterial({ color: 0x1a1b1d, roughness: 1 });
  const headliner = new THREE.MeshStandardMaterial({ color: 0x8e8b86, roughness: 0.95, side: THREE.DoubleSide });
  const interactive = [];
  const tag = (mesh, id, prompt) => { mesh.userData.interact = { id, prompt }; interactive.push(mesh); return mesh; };

  // Floor, back wall (to the beltline), headliner.
  box(xIn * 2, 0.03, zDash - zRear, carpet, 0, floor, (zDash + zRear) / 2, group);
  box(xIn * 2, belt - floor, 0.05, plastic, 0, (belt + floor) / 2, zRear - 0.02, group);
  box(xIn * 2, 0.02, zDash - zRear - 0.2, headliner, 0, roof, (zDash + zRear) / 2 - 0.1, group);
  // Back wall pillars around the rear window.
  for (const side of [1, -1]) box(xIn * 0.45, roof - belt, 0.05, plasticLight, side * xIn * 0.78, (roof + belt) / 2, zRear - 0.02, group);

  // Door cards with armrest, pull handle and speaker.
  for (const side of [1, -1]) {
    const x = side * xIn;
    const len = zDash - zRear - 0.1;
    const zc = (zDash + zRear) / 2;
    box(0.04, belt - floor - 0.02, len, plastic, x, (belt + floor) / 2, zc, group);
    rbox(0.08, 0.06, len * 0.45, 0.02, plasticLight, x - side * 0.05, floor + (belt - floor) * 0.55, zc - 0.05, group);
    const spk = new THREE.Mesh(new THREE.CircleGeometry(0.07, 24), M.std(0x0c0c0c, 0.9));
    spk.position.set(x - side * 0.022, floor + 0.18, zc + len * 0.25);
    spk.rotation.y = -side * Math.PI / 2;
    group.add(spk);
    const handle = rbox(0.03, 0.03, 0.12, 0.01, M.chrome(), x - side * 0.04, belt - 0.12, zDash - 0.28, group);
    handle.userData.part = 'doorHandle';
  }

  // ---- Dashboard.
  const dashDepth = 0.5;
  const dashTop = belt - 0.04;
  const dz0 = zDash - 0.02;
  const dz1 = zDash - dashDepth;
  // Main slab sloping into the windshield.
  const dash = new THREE.Shape();
  dash.moveTo(dz0, dashTop - 0.03);
  dash.lineTo(dz0 - 0.02, dashTop + 0.02);
  dash.lineTo(dz1 + 0.12, dashTop + 0.03);
  dash.quadraticCurveTo(dz1, dashTop + 0.02, dz1, dashTop - 0.06);
  dash.lineTo(dz1 + 0.06, floor + 0.32);
  dash.lineTo(dz0, floor + 0.25);
  dash.lineTo(dz0, dashTop - 0.03);
  const dg = new THREE.ExtrudeGeometry(dash, { depth: xIn * 2, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 });
  dg.rotateY(-Math.PI / 2);
  dg.translate(xIn, 0, 0);
  // ExtrudeGeometry put the profile in x/y; after the rotation the profile's x is world z.
  const dashMesh = new THREE.Mesh(dg, plastic);
  dashMesh.castShadow = true; dashMesh.receiveShadow = true;
  group.add(dashMesh);

  const drvX = 0.46;   // driver centerline (+x = left side)
  const psgX = -0.46;
  // Gauge binnacle and cluster.
  const binZ = dz1 + 0.13;
  rbox(0.46, 0.07, 0.16, 0.03, plastic, drvX, dashTop + 0.025, binZ + 0.02, group);
  const gaugeCanvas = makeCanvas(512, 200);
  drawGauges(gaugeCanvas, { rpm: 700, mph: 0, gear: 'P', odo: 128440, fuel: 0.8, parking: true, els: 'off' });
  const gaugeTex = canvasTexture(gaugeCanvas, { mips: false });
  const gaugeMat = new THREE.MeshStandardMaterial({ map: gaugeTex, emissive: 0xffffff, emissiveMap: gaugeTex, emissiveIntensity: 0.75, roughness: 0.3 });
  const gauges = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.17), gaugeMat);
  gauges.position.set(drvX, dashTop - 0.045, binZ - 0.065);
  gauges.rotation.y = Math.PI;
  gauges.rotation.x = 0.25;
  group.add(gauges);

  // Steering column & wheel.
  const steerGroup = new THREE.Group();
  const wheelCenter = new THREE.Vector3(drvX, dashTop - 0.1, dz1 - 0.24);
  steerGroup.position.copy(wheelCenter);
  steerGroup.rotation.x = 0.42; // top of the rim leans toward the windshield
  group.add(steerGroup);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.36, 14), plastic);
  col.rotation.x = Math.PI / 2;
  col.position.z = 0.2;
  steerGroup.add(col);
  const wheel = new THREE.Group();
  steerGroup.add(wheel);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.021, 14, 48), M.std(0x161719, 0.55));
  wheel.add(rim);
  for (const a of [0, Math.PI * 0.85, Math.PI * 1.15]) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.18, 0.018), plastic);
    spoke.position.set(Math.sin(a) * 0.1, -Math.cos(a) * 0.1, 0.0);
    spoke.rotation.z = a;
    wheel.add(spoke);
  }
  const hub = rbox(0.13, 0.11, 0.05, 0.025, plastic, 0, -0.01, 0.01, wheel);
  tag(hub, 'horn', 'Horn');
  // Turn signal / wiper stalks.
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 8), plasticLight);
  stalk.rotation.z = Math.PI / 2;
  stalk.position.set(0.12, 0.02, 0.08);
  steerGroup.add(stalk);
  const shifter = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 8), plasticLight);
  shifter.rotation.z = -Math.PI / 2.4;
  shifter.position.set(-0.14, 0.05, 0.1);
  steerGroup.add(shifter);

  // Pedals.
  for (const [dx, w, h] of [[-0.12, 0.08, 0.16], [0.06, 0.1, 0.07]]) {
    const ped = rbox(w, h, 0.02, 0.008, M.rubber(), drvX + dx, floor + 0.14, dz1 - 0.02, group);
    ped.rotation.x = 0.5;
  }

  // Center stack with HVAC vents.
  rbox(0.34, 0.36, 0.1, 0.02, plastic, 0.02, dashTop - 0.25, dz1 + 0.03, group);
  const ventTex = (() => {
    const c = makeCanvas(128, 64);
    const g = c.getContext('2d');
    g.fillStyle = '#0d0d0e'; g.fillRect(0, 0, 128, 64);
    g.fillStyle = '#3a3c40';
    for (let i = 4; i < 64; i += 9) g.fillRect(4, i, 120, 3);
    return canvasTexture(c);
  })();
  for (const x of [-0.08, 0.12, drvX + 0.3, psgX - 0.15]) {
    const vent = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.06), new THREE.MeshStandardMaterial({ map: ventTex, roughness: 0.6 }));
    vent.position.set(x, dashTop - 0.08, dz1 - 0.01);
    vent.rotation.y = Math.PI;
    group.add(vent);
  }

  // Parking brake: yellow diamond push/pull knob left of the column.
  const pbBase = new THREE.Group();
  pbBase.position.set(drvX + 0.28, dashTop - 0.2, dz1 + 0.035);
  group.add(pbBase);
  const pbStem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 8), M.chrome());
  pbStem.rotation.x = Math.PI / 2;
  pbStem.position.z = -0.025;
  pbBase.add(pbStem);
  const pbKnob = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.03), M.std(0xf2c200, 0.4));
  pbKnob.rotation.z = Math.PI / 4;
  pbKnob.position.z = -0.05;
  pbBase.add(pbKnob);
  tag(pbKnob, 'parkingBrake', 'Parking brake');
  const pbLabel = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.025), new THREE.MeshBasicMaterial({ map: labelTex('PARKING BRAKE') }));
  pbLabel.position.set(drvX + 0.28, dashTop - 0.155, dz1 + 0.03);
  pbLabel.rotation.y = Math.PI;
  group.add(pbLabel);

  // Headlight and wiper knobs on the left of the dash.
  const knobs = {};
  for (const [id, label, dx] of [['headlights', 'LIGHTS', 0.38], ['wipers', 'WIPERS', 0.47]]) {
    const k = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.025, 0.03, 18), M.std(0x2a2c30, 0.4, 0.3));
    k.rotation.x = Math.PI / 2;
    k.position.set(drvX + dx - 0.15 + 0.14, dashTop - 0.12, dz1 - 0.005);
    group.add(k);
    tag(k, id, label === 'LIGHTS' ? 'Headlights' : 'Wipers');
    knobs[id] = k;
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.018), new THREE.MeshBasicMaterial({ map: labelTex(label) }));
    lab.position.set(k.position.x, dashTop - 0.085, dz1 - 0.004);
    lab.rotation.y = Math.PI;
    group.add(lab);
  }

  // ---- ELS switch panel (mounted under the center of the dash).
  const panel = new THREE.Group();
  panel.position.set(0.02, dashTop - 0.5, dz1 - 0.02);
  panel.rotation.x = 0.35;
  group.add(panel);
  rbox(0.36, 0.11, 0.05, 0.01, M.std(0x111214, 0.45, 0.3), 0, 0, 0.03, panel);
  const buttons = {};
  const defs = [
    ['els_slow', 'SLOW', 'AMBER FLASH', '#ffb000'],
    ['els_steady', 'STEADY', 'AMBER ON', '#ffb000'],
    ['els_off', 'OFF', 'AMBER', '#cfd6de'],
    ['work', 'WORK', 'DECK LIGHTS', '#9fd0ff'],
    ['hazard', 'HAZARD', 'FLASHERS', '#ff4a3a'],
  ];
  defs.forEach(([id, label, sub, color], i) => {
    const tex = makeButtonTexture(label, sub, color);
    const mat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.25, roughness: 0.5 });
    const b = new THREE.Mesh(new RoundedBoxGeometry(0.062, 0.048, 0.02, 2, 0.006), mat);
    b.position.set(0.14 - i * 0.07, 0.005, 0);
    panel.add(b);
    tag(b, id, { els_slow: 'ELS: slow amber flashing', els_steady: 'ELS: amber steady (no flash)', els_off: 'ELS: amber off', work: 'Deck work lights', hazard: 'Hazard flashers' }[id]);
    const led = new THREE.Mesh(new THREE.CircleGeometry(0.006, 12), new THREE.MeshStandardMaterial({ color: 0x220000, emissive: new THREE.Color(color), emissiveIntensity: 0 }));
    led.position.set(b.position.x + 0.022, 0.02, -0.011);
    led.rotation.y = Math.PI;
    panel.add(led);
    buttons[id] = { mesh: b, led, mat };
  });
  const plab = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.02), new THREE.MeshBasicMaterial({ map: labelTex('WARNING LIGHT CONTROL') }));
  plab.position.set(0, 0.045, -0.011);
  plab.rotation.y = Math.PI;
  panel.add(plab);

  // ---- MDT / dispatch radio on a RAM mount by the passenger side.
  const mdtGroup = new THREE.Group();
  mdtGroup.position.set(-0.22, dashTop + 0.13, dz1 - 0.1);
  mdtGroup.rotation.y = -0.3;
  mdtGroup.rotation.x = 0.15;
  group.add(mdtGroup);
  rbox(0.3, 0.21, 0.025, 0.012, M.std(0x0c0c0d, 0.5), 0, 0, 0.0, mdtGroup);
  const mdtCanvas = makeCanvas(512, 340);
  drawMDT(mdtCanvas, { unit: 'T-' + truck.spec.id.toUpperCase() });
  const mdtTex = canvasTexture(mdtCanvas, { mips: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.18), new THREE.MeshBasicMaterial({ map: mdtTex, toneMapped: false }));
  screen.position.z = -0.014;
  screen.rotation.y = Math.PI;
  mdtGroup.add(screen);
  tag(screen, 'mdt', 'Dispatch radio');
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8), M.std(0x111111, 0.6));
  arm.position.set(0, -0.15, 0.03);
  mdtGroup.add(arm);
  // CB radio under the dash with a hanging mic.
  rbox(0.18, 0.05, 0.14, 0.01, M.std(0x141414, 0.5, 0.3), -0.25, dashTop - 0.42, dz1 + 0.05, group);
  const mic = rbox(0.05, 0.08, 0.03, 0.012, M.std(0x111111, 0.5), -0.3, dashTop - 0.33, dz1 - 0.06, group);
  mic.rotation.z = 0.2;

  // ---- Seats.
  const seats = [];
  for (const x of [drvX, psgX]) {
    const seat = new THREE.Group();
    seat.position.set(x, t.seatY, zRear + 0.42);
    group.add(seat);
    rbox(0.5, 0.12, 0.5, 0.05, fabric(), 0, -0.06, 0.04, seat);
    const back = rbox(0.5, 0.62, 0.13, 0.05, fabric(), 0, 0.3, -0.22, seat);
    back.rotation.x = -0.18;
    const headrest = rbox(0.26, 0.16, 0.1, 0.04, fabric(), 0, 0.72, -0.3, seat);
    headrest.rotation.x = -0.18;
    box(0.4, t.seatY - floor - 0.14, 0.4, plastic, 0, -(t.seatY - floor) / 2 - 0.05, 0.02, seat);
    seats.push(seat);
  }
  // Center console with cupholders and a coffee.
  rbox(0.26, t.seatY - floor + 0.05, 0.5, 0.03, plastic, 0, (t.seatY + floor) / 2, zRear + 0.42, group);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.13, 18), M.std(0xf4efe6, 0.6));
  cup.position.set(0.05, t.seatY + 0.11, zRear + 0.62);
  group.add(cup);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.015, 18), M.std(0x222222, 0.4));
  lid.position.set(0.05, t.seatY + 0.18, zRear + 0.62);
  group.add(lid);
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.037, 0.05, 18, 1, true), M.std(0x8b5a2b, 0.9));
  sleeve.position.set(0.05, t.seatY + 0.11, zRear + 0.62);
  group.add(sleeve);

  // Bags of chips on the passenger seat.
  const chips = [];
  const flavors = [['SEA SALT', '#1e5fbf'], ['BBQ', '#a3361b'], ['SOUR CREAM & ONION', '#2f7d3a']];
  const bagGeo = chipBagGeometry();
  flavors.forEach(([fl, col], i) => {
    const mat = new THREE.MeshPhysicalMaterial({ map: chipsTexture(fl, col), roughness: 0.32, metalness: 0.15, clearcoat: 0.6, side: THREE.DoubleSide });
    const bag = new THREE.Mesh(bagGeo, mat);
    bag.position.set(psgX + (i - 1) * 0.13, t.seatY + 0.03 + i * 0.012, zRear + 0.45 + (i % 2) * 0.08);
    bag.rotation.set(-Math.PI / 2 + 0.08, 0, (i - 1) * 0.35);
    bag.castShadow = true;
    group.add(bag);
    tag(bag, 'chips', `Eat ${fl.toLowerCase()} chips`);
    bag.userData.chips = { flavor: fl, left: 24 };
    chips.push(bag);
  });

  // Clipboard with work orders on the dash.
  const clip = new THREE.Mesh(new THREE.BoxGeometry(0.23, 0.006, 0.3), new THREE.MeshStandardMaterial({ map: clipboardTex(), roughness: 0.8 }));
  clip.position.set(psgX + 0.05, dashTop + 0.04, dz1 + 0.2);
  clip.rotation.y = 0.3;
  group.add(clip);

  // Rear-view mirror and visors.
  const rvm = rbox(0.24, 0.07, 0.03, 0.015, M.std(0x111111, 0.5), 0.0, roof - 0.12, zDash - 0.32, group);
  const rvmGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.055), M.chrome());
  rvmGlass.position.set(0, roof - 0.12, zDash - 0.336);
  rvmGlass.rotation.y = Math.PI - 0.12;
  group.add(rvmGlass);
  for (const x of [drvX, psgX]) {
    const visor = rbox(0.4, 0.015, 0.17, 0.006, headliner, x, roof - 0.02, zDash - 0.42, group);
    visor.rotation.x = 0.12;
  }
  // A-pillar trims (cover the inside of the painted pillar).
  for (const side of [1, -1]) {
    const h = roof - belt;
    const trim = box(0.06, Math.hypot(h, cs.zW - cs.zR1) + 0.05, 0.06, plasticLight, side * (xIn - 0.04), (roof + belt) / 2, zDash - (cs.zW - cs.zR1) / 2, group);
    trim.rotation.x = Math.atan2(cs.zW - cs.zR1, h);
  }

  group.traverse((o) => { if (o.isMesh) { o.receiveShadow = true; } });

  const eye = new THREE.Vector3(drvX, t.eyeY, zRear + 0.36);
  return {
    group, interactive, steerWheel: wheel, steerGroup, gaugeCanvas, gaugeTex, mdtCanvas, mdtTex, screen,
    buttons, pbKnob, chips, eye, seats, knobs, drvX, psgX, zRear, zDash,
    seatPos: new THREE.Vector3(drvX, t.seatY, zRear + 0.42),
    mdtButtons: {},
  };
}

function labelTex(text) {
  const c = makeCanvas(256, 64);
  const g = c.getContext('2d');
  g.fillStyle = '#121315'; g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#e8eaed'; g.textAlign = 'center'; g.textBaseline = 'middle';
  fitText(g, text, 240, 36, 700);
  g.fillText(text, 128, 34);
  return canvasTexture(c);
}

function clipboardTex() {
  const c = makeCanvas(256, 320);
  const g = c.getContext('2d');
  g.fillStyle = '#8b6b43'; g.fillRect(0, 0, 256, 320);
  g.fillStyle = '#f7f5ef'; g.fillRect(16, 30, 224, 280);
  g.fillStyle = '#9da3aa'; g.fillRect(90, 6, 76, 36);
  g.fillStyle = '#222'; g.font = 'bold 18px Arial'; g.fillText('TOW INVOICE', 30, 66);
  g.font = '12px Arial';
  for (let i = 0; i < 14; i++) { g.fillStyle = '#c9ccd1'; g.fillRect(30, 84 + i * 15, 196, 1); }
  g.fillStyle = '#334'; g.fillText('Unit · Plate · VIN · Mileage', 30, 80);
  return canvasTexture(c);
}
