// The fleet you actually drive: five rollbacks, five liveries each, and a cab
// interior you can sit in, poke at, and eat lunch in.
import * as THREE from 'three';
import { box, cyl, rakedBox, wedgeBox, makeCanvas, canvasTexture, makeRng, TAU, fitText } from './util.js';
import { mat, paint, glass, lightMat, texMat, C } from './materials.js';

/* ------------------------------------------------------------------ liveries */

export const LIVERIES = [
  {
    id: 'flagcity', company: 'FLAG CITY TOWING', address: '8563 West Skyville Road',
    phone: '671-907-4212', base: 0xf2f3f0, accent: 0xc0392b, text: '#141414', textMode: 'black',
    tagline: '24 HOUR LIGHT & HEAVY RECOVERY',
  },
  {
    id: 'harborpoint', company: 'HARBOR POINT RECOVERY', address: '214 Dockside Avenue',
    phone: '671-555-0148', base: 0x14315c, accent: 0xf2c009, text: '#ffffff', textMode: 'white',
    tagline: 'FLATBED · LOCKOUTS · JUMP STARTS',
  },
  {
    id: 'delgado', company: 'DELGADO & SONS TOWING', address: '1190 Ironbridge Street',
    phone: '671-442-8890', base: 0x9c2a22, accent: 0xf5f5f5, text: '#ffffff', textMode: 'white',
    tagline: 'FAMILY OWNED SINCE 1978',
  },
  {
    id: 'roadside24', company: 'SKYVILLE 24HR ROADSIDE', address: '77 Meridian Boulevard',
    phone: '671-300-9911', base: 0xf0a80c, accent: 0x1b1b1b, text: '#141414', textMode: 'black',
    tagline: 'FAST · FAIR · ANY HOUR',
  },
  {
    id: 'northgate', company: 'NORTHGATE AUTO TRANSPORT', address: '4402 Northgate Pike',
    phone: '671-818-2277', base: 0x16181c, accent: 0x2fa8d8, text: '#ffffff', textMode: 'white',
    tagline: 'LONG DISTANCE · IMPOUND · REPO',
  },
];

export const LIVERY_BY_ID = Object.fromEntries(LIVERIES.map((l) => [l.id, l]));

function liveryDoorTexture(liv) {
  const c = makeCanvas(1024, 512);
  const x = c.getContext('2d');
  x.fillStyle = '#' + liv.base.toString(16).padStart(6, '0');
  x.fillRect(0, 0, 1024, 512);
  // accent band
  x.fillStyle = '#' + liv.accent.toString(16).padStart(6, '0');
  x.fillRect(0, 372, 1024, 26);
  x.fillRect(0, 410, 1024, 10);
  x.fillStyle = liv.text;
  fitText(x, liv.company, 512, 150, 940, 92);
  x.font = '40px Arial';
  x.textAlign = 'center';
  x.fillText(liv.address, 512, 236);
  x.font = 'bold 62px Arial';
  x.fillText(liv.phone, 512, 312);
  x.font = 'bold 26px Arial';
  x.fillText(liv.tagline, 512, 462);
  return canvasTexture(c);
}

// The skirt panel is roughly 12:1, so the artwork is drawn at that ratio —
// otherwise the lettering smears down the side of the deck.
function liveryBedTexture(liv) {
  const W = 1536, H = 128;
  const c = makeCanvas(W, H);
  const x = c.getContext('2d');
  x.fillStyle = '#' + liv.base.toString(16).padStart(6, '0');
  x.fillRect(0, 0, W, H);
  x.fillStyle = '#' + liv.accent.toString(16).padStart(6, '0');
  x.fillRect(0, H - 14, W, 8);
  x.fillRect(0, 4, W, 5);
  x.fillStyle = liv.text;
  fitText(x, liv.company, W * 0.32, H * 0.46, W * 0.5, 62);
  x.textAlign = 'right';
  x.font = 'bold 46px Arial';
  x.fillText(liv.phone, W - 40, H * 0.42);
  x.font = '24px Arial';
  x.fillText(liv.address, W - 40, H * 0.74);
  return canvasTexture(c);
}

/* -------------------------------------------------------------- truck specs */

export const TRUCKS = [
  {
    id: 'lightduty', name: 'Vantage 4500 Rollback', blurb: '19 ft steel deck, 8,000 lb winch. The everyday car hauler.',
    cabL: 2.0, cabW: 2.2, cabH: 1.5, hoodL: 1.6, frameH: 0.95, wheelR: 0.46, dually: true,
    bedW: 2.3, bedH: 0.26, wb: 5.5, L: 9.6, style: 'conventional',
    stack: false, topBar: true, boxes: 3, capacity: 4200, speed: 118,
  },
  {
    id: 'heavy', name: 'Ironclad 6600 Heavy Rollback', blurb: '24 ft deck, 20,000 lb planetary winch, air brakes.',
    cabL: 2.3, cabW: 2.4, cabH: 1.68, hoodL: 2.0, frameH: 1.12, wheelR: 0.55, dually: true,
    bedW: 2.5, bedH: 0.3, wb: 6.0, L: 11.2, style: 'conventional',
    stack: true, topBar: true, boxes: 4, capacity: 9000, speed: 104,
  },
  {
    id: 'coe', name: 'Meridian COE Slideback', blurb: 'Cab-over. Turns in an alley, sees everything.',
    cabL: 2.1, cabW: 2.3, cabH: 1.9, hoodL: 0.35, frameH: 1.0, wheelR: 0.48, dually: true,
    bedW: 2.35, bedH: 0.26, wb: 4.8, L: 9.2, style: 'coe',
    stack: false, topBar: true, boxes: 3, capacity: 5200, speed: 110,
  },
  {
    id: 'wheelift', name: 'Bricktown 350 Wheel-Lift', blurb: 'Pickup chassis, short deck and a self-loader out back.',
    cabL: 1.9, cabW: 2.05, cabH: 1.28, hoodL: 1.5, frameH: 0.8, wheelR: 0.42, dually: false,
    bedW: 2.1, bedH: 0.22, wb: 4.4, L: 8.0, style: 'pickup',
    stack: false, topBar: false, boxes: 2, capacity: 2600, speed: 132, wheelLift: true,
  },
  {
    id: 'compact', name: 'Kestrel Quickpick', blurb: 'Small, fast, and legal in every parking garage in Skyville.',
    cabL: 1.75, cabW: 1.98, cabH: 1.22, hoodL: 1.1, frameH: 0.74, wheelR: 0.38, dually: false,
    bedW: 2.0, bedH: 0.2, wb: 3.6, L: 7.0, style: 'coe',
    stack: false, topBar: false, boxes: 2, capacity: 1900, speed: 140, wheelLift: true,
  },
];

export const TRUCK_BY_ID = Object.fromEntries(TRUCKS.map((t) => [t.id, t]));

/* Where the cab sits, and therefore how much deck actually fits behind it.
   Derived rather than hand-tuned so the deck never overlaps the cab. */
export function truckLayout(spec) {
  const noseZ = spec.L / 2;
  const cabZ = spec.style === 'coe' ? noseZ - spec.cabL / 2 - 0.15 : noseZ - spec.hoodL - spec.cabL / 2;
  const deckFrontZ = cabZ - spec.cabL / 2 - 0.3;
  const deckRearZ = -spec.L / 2;
  return { noseZ, cabZ, deckFrontZ, deckRearZ, deckLength: deckFrontZ - deckRearZ };
}

/* ------------------------------------------------------------------ helpers */

function amberLens(w, h, d, x, y, z) {
  // Each lens owns its material: the wig-wag drives them individually, and a
  // shared cached material would make the whole bar flash in unison.
  const m = box(w, h, d, lightMat(C.amber, 0.15).clone(), x, y, z);
  m.userData.amber = true;
  m.castShadow = false;
  return m;
}

// A lightbar of individual amber lenses that can flash as a group.
function buildLightbar(width, height = 0.14) {
  const g = new THREE.Group();
  g.add(box(width, height * 0.55, 0.18, mat(0x1a1c20)));
  const lenses = [];
  const n = Math.max(4, Math.round(width / 0.28));
  for (let i = 0; i < n; i++) {
    const x = -width / 2 + (i + 0.5) * (width / n);
    const l = amberLens(width / n * 0.82, height, 0.2, x, height * 0.2, 0);
    l.userData.phase = i < n / 2 ? 0 : 1;
    g.add(l);
    lenses.push(l);
  }
  g.add(box(width * 1.02, 0.04, 0.22, mat(0x101216), 0, height * 0.75, 0));
  g.userData.lenses = lenses;
  return g;
}

function buildTruckWheel(radius, width, dually) {
  const g = new THREE.Group();
  const tire = cyl(radius, width, mat(C.tire, { roughness: 0.95 }), 0, 0, 0, 24);
  tire.rotation.z = Math.PI / 2;
  g.add(tire);
  if (dually) {
    const t2 = cyl(radius, width, mat(C.tire, { roughness: 0.95 }), width * 1.05, 0, 0, 24);
    t2.rotation.z = Math.PI / 2;
    g.add(t2);
  }
  const rim = cyl(radius * 0.6, width * (dually ? 2.2 : 1.06), mat(0xc8ccd2, { metalness: 0.75, roughness: 0.25 }), dually ? width * 0.5 : 0, 0, 0, 24);
  rim.rotation.z = Math.PI / 2;
  g.add(rim);
  const hub = cyl(radius * 0.24, width * (dually ? 2.4 : 1.2), mat(0x6c7178, { metalness: 0.6 }), dually ? width * 0.5 : 0, 0, 0);
  hub.rotation.z = Math.PI / 2;
  g.add(hub);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const lug = cyl(radius * 0.05, width * (dually ? 2.5 : 1.3), mat(0x8b9099, { metalness: 0.8 }),
      dually ? width * 0.5 : 0, Math.cos(a) * radius * 0.24, Math.sin(a) * radius * 0.24);
    lug.rotation.z = Math.PI / 2;
    g.add(lug);
  }
  return g;
}

/* ------------------------------------------------------- gauge / screen art */

function makeScreen(w, h, pxW, pxH) {
  const canvas = makeCanvas(pxW, pxH);
  const ctx = canvas.getContext('2d');
  const tex = canvasTexture(canvas);
  const material = texMat(tex, { emissive: 0xffffff, emissiveMap: tex, roughness: 0.4 });
  material.emissiveIntensity = 0.55;
  const mesh = box(w, h, 0.02, material);
  return { canvas, ctx, tex, mesh, material };
}

/* ------------------------------------------------------------------ interior */

function buildInterior(spec, liv, truck) {
  const g = new THREE.Group();
  const interact = [];
  const W = spec.cabW, L = spec.cabL, H = spec.cabH;
  const trimM = mat(0x25272c, { roughness: 0.9 });
  const seatM = mat(0x2f3239, { roughness: 0.95 });
  const seatTrim = mat(liv.accent, { roughness: 0.9 });
  const plasticM = mat(0x1c1e23, { roughness: 0.85 });

  // Cab shell (inside faces), floor, headliner, rear wall.
  g.add(box(W - 0.1, 0.06, L - 0.08, mat(0x181a1e, { roughness: 1 }), 0, 0, 0));
  g.add(box(W - 0.1, 0.05, L - 0.08, mat(0x33363c, { roughness: 1 }), 0, H - 0.12, 0));
  g.add(box(W - 0.12, H - 0.2, 0.06, trimM, 0, H / 2 - 0.06, -L / 2 + 0.06));
  // Rear window into the bed
  g.add(box(W * 0.6, 0.34, 0.02, glass(0x0d131b, 0.45), 0, H * 0.62, -L / 2 + 0.03));

  // Seats: driver + passenger, with headrests and a console between.
  for (const s of [-1, 1]) {
    const sx = s * W * 0.24;
    const base = box(0.62, 0.16, 0.62, seatM, sx, 0.34, -0.05);
    const backRest = box(0.62, 0.78, 0.16, seatM, sx, 0.75, -0.32);
    backRest.rotation.x = -0.12;
    const head = box(0.34, 0.2, 0.14, plasticM, sx, 1.18, -0.36);
    g.add(box(0.66, 0.28, 0.66, plasticM, sx, 0.2, -0.05));
    g.add(base, backRest, head);
    g.add(box(0.5, 0.03, 0.5, seatTrim, sx, 0.425, -0.05));
    // seat belt
    g.add(box(0.05, 0.9, 0.03, mat(0x14161a), sx + s * 0.3, 0.75, -0.3));
  }
  g.add(box(0.3, 0.34, 0.7, plasticM, 0, 0.3, -0.1));
  const cup = cyl(0.06, 0.16, mat(0x3b3f46), 0.06, 0.5, 0.05);
  g.add(cup);
  const coffee = cyl(0.05, 0.2, mat(0xf3ede2), 0.06, 0.58, 0.05);
  coffee.userData.interactable = { id: 'coffee', label: 'Drink coffee', hint: 'E' };
  g.add(coffee); interact.push(coffee);

  // Dashboard: a raked slab plus a centre stack.
  const dashZ = L / 2 - 0.38;
  const dash = rakedBox(W - 0.04, 0.5, 0.62, 0.2, 0, plasticM);
  dash.position.set(0, 0.72, dashZ);
  g.add(dash);
  g.add(box(W - 0.06, 0.12, 0.5, mat(0x2b2e34), 0, 0.99, dashZ + 0.03));   // dash top pad
  g.add(box(W - 0.04, 0.34, 0.12, plasticM, 0, 0.36, dashZ + 0.24));       // knee bolster
  g.add(box(W - 0.04, 0.44, 0.1, mat(0x1a1c21), 0, 0.22, dashZ + 0.28));    // firewall

  // Windscreen header and A-pillars, so the glass has a frame around it.
  g.add(box(W - 0.06, 0.16, 0.16, trimM, 0, H - 0.22, L / 2 - 0.16));
  for (const s of [-1, 1]) {
    const pillar = box(0.12, H * 0.52, 0.14, trimM, s * (W / 2 - 0.08), H * 0.66, L / 2 - 0.28);
    pillar.rotation.x = -0.2;
    g.add(pillar);
  }

  // Instrument cluster (live canvas).
  const cluster = makeScreen(0.46, 0.2, 512, 224);
  cluster.mesh.position.set(W * 0.22, 0.88, dashZ - 0.18);
  cluster.mesh.rotation.x = -0.35;
  g.add(cluster.mesh);

  // Steering wheel on a raked column.
  const wheelPivot = new THREE.Group();
  wheelPivot.position.set(W * 0.22, 0.8, dashZ - 0.44);
  wheelPivot.rotation.x = -0.62;
  const rimTorus = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.026, 10, 28), mat(0x17181c, { roughness: 0.7 }));
  wheelPivot.add(rimTorus);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + Math.PI / 2;
    const spoke = box(0.05, 0.16, 0.03, mat(0x2c2f35), Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0.01);
    spoke.rotation.z = a - Math.PI / 2;
    wheelPivot.add(spoke);
  }
  wheelPivot.add(cyl(0.07, 0.05, mat(liv.accent, { roughness: 0.6 }), 0, 0, 0.01));
  g.add(wheelPivot);
  g.add(box(0.09, 0.09, 0.34, plasticM, W * 0.22, 0.66, dashZ - 0.3));
  // Column stalks
  g.add(box(0.22, 0.03, 0.03, mat(0x3a3d43), W * 0.22 + 0.12, 0.76, dashZ - 0.4));

  // Pedals
  for (let i = 0; i < 3; i++) {
    g.add(box(0.08, 0.02, 0.16, mat(0x2a2c31), W * 0.3 - i * 0.13, 0.12, dashZ - 0.18));
  }

  /* ---- centre stack: radio, ELS panel, bed controls, switches ---- */
  const stackZ = dashZ - 0.14;
  g.add(box(0.6, 0.56, 0.2, mat(0x1a1c21), -0.06, 0.7, stackZ));

  // Radio head unit: the call screen.
  const radio = makeScreen(0.5, 0.24, 640, 300);
  radio.mesh.position.set(-0.06, 0.86, stackZ - 0.11);
  radio.mesh.rotation.x = -0.12;
  radio.mesh.userData.interactable = { id: 'radio', label: 'Radio', hint: 'E' };
  g.add(radio.mesh); interact.push(radio.mesh);
  g.add(box(0.56, 0.3, 0.06, mat(0x101216), -0.06, 0.86, stackZ - 0.06));
  // Radio buttons
  const acceptBtn = box(0.11, 0.06, 0.05, mat(0x1f7a3d, { emissive: 0x0d3d1e }), 0.1, 0.66, stackZ - 0.1);
  acceptBtn.userData.interactable = { id: 'accept', label: 'Accept call', hint: 'E' };
  const declineBtn = box(0.11, 0.06, 0.05, mat(0x8c2b2b, { emissive: 0x3d0d0d }), -0.06, 0.66, stackZ - 0.1);
  declineBtn.userData.interactable = { id: 'decline', label: 'Decline call', hint: 'E' };
  const mapBtn = box(0.11, 0.06, 0.05, mat(0x2b4d8c, { emissive: 0x0d1d3d }), -0.22, 0.66, stackZ - 0.1);
  mapBtn.userData.interactable = { id: 'maptoggle', label: 'Toggle map', hint: 'E' };
  g.add(acceptBtn, declineBtn, mapBtn);
  interact.push(acceptBtn, declineBtn, mapBtn);

  // ELS control panel — three amber buttons in a row, labelled.
  const elsPanel = new THREE.Group();
  elsPanel.position.set(-W * 0.3, 0.86, stackZ - 0.02);
  elsPanel.rotation.y = 0.5;
  elsPanel.add(box(0.34, 0.24, 0.05, mat(0x121418)));
  const elsLabel = makeScreen(0.32, 0.09, 320, 90);
  elsLabel.mesh.position.set(0, 0.085, -0.03);
  elsPanel.add(elsLabel.mesh);
  const elsButtons = [];
  const modes = [
    { id: 'els_off', label: 'ELS — off', mode: 0 },
    { id: 'els_steady', label: 'ELS — amber steady', mode: 1 },
    { id: 'els_flash', label: 'ELS — slow amber flash', mode: 2 },
  ];
  modes.forEach((m, i) => {
    const b = box(0.08, 0.07, 0.05, mat(0x3a2a10, { emissive: 0x160e02 }), -0.1 + i * 0.1, -0.03, -0.03);
    b.userData.interactable = { id: m.id, label: m.label, hint: 'E' };
    b.userData.elsMode = m.mode;
    elsPanel.add(b);
    elsButtons.push(b);
    interact.push(b);
  });
  g.add(elsPanel);

  // Bed / PTO control head — mirrors the outside panel.
  const pto = box(0.1, 0.07, 0.05, mat(0x2c3138, { emissive: 0x0a0c0e }), -W * 0.3 + 0.02, 0.62, stackZ - 0.06);
  pto.rotation.y = 0.5;
  pto.userData.interactable = { id: 'pto', label: 'Engage PTO / bed controls', hint: 'E' };
  g.add(pto); interact.push(pto);

  // Parking brake: a lever that actually moves.
  const brakePivot = new THREE.Group();
  brakePivot.position.set(-0.16, 0.42, 0.12);
  const lever = box(0.05, 0.42, 0.05, mat(0x3d4148, { metalness: 0.5 }), 0, 0.2, 0);
  const knob = box(0.09, 0.1, 0.09, mat(0xc0392b), 0, 0.42, 0);
  knob.userData.interactable = { id: 'parkbrake', label: 'Parking brake', hint: 'E' };
  brakePivot.add(lever, knob);
  g.add(brakePivot);
  interact.push(knob);

  // Shifter
  const shifter = box(0.05, 0.3, 0.05, mat(0x2a2d33), 0.02, 0.5, 0.2);
  const shiftKnob = box(0.09, 0.09, 0.09, mat(0x14161a), 0.02, 0.66, 0.2);
  shiftKnob.userData.interactable = { id: 'shifter', label: 'Gear selector', hint: 'E' };
  g.add(shifter, shiftKnob);
  interact.push(shiftKnob);

  // Bag of chips riding shotgun.
  const chips = new THREE.Group();
  chips.position.set(-W * 0.24, 0.5, -0.02);
  chips.rotation.set(0.2, 0.5, 0.15);
  const bagTex = (() => {
    const c = makeCanvas(256, 256); const x = c.getContext('2d');
    x.fillStyle = '#d94f1e'; x.fillRect(0, 0, 256, 256);
    x.fillStyle = '#ffd23f'; x.beginPath(); x.arc(128, 118, 74, 0, TAU); x.fill();
    x.fillStyle = '#5c1d06'; x.font = 'bold 40px Arial'; x.textAlign = 'center';
    x.fillText('SKY', 128, 108); x.fillText('CHIPS', 128, 152);
    x.fillStyle = '#fff'; x.font = 'bold 20px Arial'; x.fillText('SALT & VINEGAR', 128, 216);
    return canvasTexture(c);
  })();
  const bag = box(0.22, 0.3, 0.1, texMat(bagTex));
  bag.userData.interactable = { id: 'chips', label: 'Eat chips', hint: 'E' };
  chips.add(bag);
  chips.add(box(0.24, 0.04, 0.11, mat(0xb03a12), 0, 0.16, 0));
  g.add(chips);
  interact.push(bag);

  // Clipboard with the current job stuck to the dash.
  const clip = makeScreen(0.26, 0.34, 300, 400);
  clip.mesh.position.set(-W * 0.34, 0.58, stackZ + 0.08);
  clip.mesh.rotation.set(-0.2, 0.6, 0);
  clip.mesh.userData.interactable = { id: 'clipboard', label: 'Read job sheet', hint: 'E' };
  g.add(clip.mesh); interact.push(clip.mesh);

  // CB radio + hanging mic, air fresheners, sun visors.
  g.add(box(0.24, 0.1, 0.16, mat(0x1b1d22), 0.0, H - 0.28, 0.1));
  g.add(box(0.05, 0.12, 0.04, mat(0x24262b), 0.16, H - 0.42, 0.1));
  g.add(box(0.4, 0.02, 0.18, mat(0x3c3f45), W * 0.22, H - 0.16, dashZ - 0.1));
  g.add(box(0.4, 0.02, 0.18, mat(0x3c3f45), W * 0.22, H - 0.16, dashZ - 0.1));
  const tree = box(0.09, 0.12, 0.01, mat(0x2ecc71), 0, H * 0.72, dashZ - 0.2);
  g.add(tree);
  // Door cards with armrests and window switches
  for (const s of [-1, 1]) {
    g.add(box(0.05, H * 0.66, L - 0.2, mat(0x212429, { roughness: 0.95 }), s * (W / 2 - 0.06), 0.5, 0));
    g.add(box(0.1, 0.08, 0.5, mat(0x2c3037), s * (W / 2 - 0.11), 0.72, 0.02));
    g.add(box(0.06, 0.03, 0.14, mat(0x3d4148), s * (W / 2 - 0.13), 0.78, 0.16));
  }

  // Dome light: without it the moulded interior reads as a black void.
  const dome = new THREE.PointLight(0xffefd6, 1.1, 2.6, 1.8);
  dome.position.set(0, H - 0.2, -0.1);
  g.add(dome);
  g.add(box(0.22, 0.05, 0.14, lightMat(0xfff4e0, 0.7), 0, H - 0.14, -0.1));

  truck.userData.screens = { cluster, radio, clip, elsLabel };
  truck.userData.interior = g;
  truck.userData.interiorInteract = interact;
  truck.userData.parts = truck.userData.parts || {};
  truck.userData.parts.steeringWheel = wheelPivot;
  truck.userData.parts.brakeLever = brakePivot;
  truck.userData.parts.elsButtons = elsButtons;
  truck.userData.parts.chips = chips;
  return g;
}

/* ------------------------------------------------------------- utility boxes */

function buildUtilityBox(w, h, d, liv, label) {
  const g = new THREE.Group();
  const shell = box(w, h, d, mat(0x2f3238, { metalness: 0.35, roughness: 0.55 }));
  g.add(shell);
  const doorPivot = new THREE.Group();
  doorPivot.position.set(w / 2 + 0.005, -h / 2, 0);
  const door = box(0.04, h * 0.92, d * 0.94, mat(liv.base, { roughness: 0.45, metalness: 0.25 }), 0, h * 0.46, 0);
  doorPivot.add(door);
  doorPivot.add(box(0.05, 0.05, d * 0.5, mat(C.chrome, { metalness: 0.8 }), 0.02, h * 0.75, 0));
  g.add(doorPivot);
  g.userData.doorPivot = doorPivot;
  g.userData.open = false;
  door.userData.interactable = { id: 'utilitybox', label: label || 'Utility compartment', hint: 'E' };
  g.userData.doorMesh = door;
  return g;
}

/* ---------------------------------------------------------------- the truck */

export function buildTowTruck(truckId, liveryId, opts = {}) {
  const spec = TRUCK_BY_ID[truckId] || TRUCKS[0];
  const liv = LIVERY_BY_ID[liveryId] || LIVERIES[0];
  const rng = makeRng(opts.seed ?? 4242);
  const root = new THREE.Group();
  root.name = 'towtruck:' + spec.id;

  const bodyM = paint(liv.base);
  const accentM = paint(liv.accent);
  const frameM = mat(0x22252a, { metalness: 0.4, roughness: 0.7 });
  const deckM = mat(0x4b4f56, { metalness: 0.55, roughness: 0.6 });
  const glassM = glass(0x0e141c, 0.5);
  const doorTex = liveryDoorTexture(liv);
  const bedTex = liveryBedTexture(liv);

  const frameY = spec.frameH;
  const layout = truckLayout(spec);
  const { noseZ, cabZ, deckFrontZ, deckRearZ } = layout;
  const bedLen = layout.deckLength;
  const cabFloorY = frameY + 0.1;

  // ---- chassis rails + crossmembers
  for (const s of [-1, 1]) {
    root.add(box(0.16, 0.3, spec.L * 0.94, frameM, s * spec.cabW * 0.3, frameY - 0.2, -0.2));
  }
  for (let i = -3; i <= 3; i++) {
    root.add(box(spec.cabW * 0.62, 0.12, 0.14, frameM, 0, frameY - 0.2, i * spec.L * 0.12 - 0.2));
  }
  // fuel tank + air tanks + battery box under the rail
  root.add(cyl(0.28, 1.1, mat(0xb9bec6, { metalness: 0.8, roughness: 0.3 }), -spec.cabW * 0.42, frameY - 0.28, cabZ - spec.cabL));
  const fuel = root.children[root.children.length - 1];
  fuel.rotation.z = Math.PI / 2;
  root.add(cyl(0.16, 0.6, mat(0x53585f, { metalness: 0.6 }), spec.cabW * 0.42, frameY - 0.28, cabZ - spec.cabL));
  root.children[root.children.length - 1].rotation.z = Math.PI / 2;

  // ---- cab
  // Built in three bands: a lower body that reaches down past the frame, a
  // belt line, and a raked greenhouse. The nose is a solid front clip with
  // fenders, so nothing floats.
  const cab = new THREE.Group();
  cab.position.set(0, 0, cabZ);
  const cabShellH = spec.cabH + 0.3;
  const cabBottomY = frameY - 0.36;                      // rocker/step height
  const beltY = cabFloorY + cabShellH * 0.5;             // window sill
  const roofY = cabFloorY + cabShellH;
  const lowerH = beltY - cabBottomY;
  const isCOE = spec.style === 'coe';

  // Lower cab body.
  cab.add(box(spec.cabW, lowerH, spec.cabL, bodyM, 0, cabBottomY + lowerH / 2, 0));
  cab.add(box(spec.cabW * 1.01, 0.1, spec.cabL * 0.99, mat(liv.accent, { roughness: 0.5 }), 0, beltY - 0.02, 0));

  // Greenhouse.
  const ghH = roofY - beltY;
  const gh = rakedBox(spec.cabW * 0.99, ghH, spec.cabL * (isCOE ? 0.98 : 0.9),
    isCOE ? 0.1 : 0.24, 0.04, bodyM);
  gh.position.set(0, beltY + ghH / 2, isCOE ? 0 : -spec.cabL * 0.03);
  cab.add(gh);
  const wsRake = isCOE ? 0.1 : 0.24;
  const wsZ = (isCOE ? spec.cabL * 0.49 : spec.cabL * 0.42) - wsRake / 2;
  const ws = box(spec.cabW * 0.9, Math.hypot(ghH, wsRake) * 0.98, 0.05, glassM, 0, beltY + ghH / 2, wsZ);
  ws.rotation.x = -Math.atan2(wsRake, ghH);
  cab.add(ws);
  cab.add(box(spec.cabW * 0.98, 0.07, spec.cabL * (isCOE ? 0.95 : 0.86), bodyM, 0, roofY, isCOE ? 0 : -spec.cabL * 0.04));
  // Roof marker lights, the five-lamp cluster every wrecker has.
  for (let i = -2; i <= 2; i++) {
    cab.add(box(0.1, 0.06, 0.12, lightMat(0xffb03a, 0.6), i * 0.22, roofY + 0.06, wsZ - 0.1));
  }

  if (!isCOE) {
    // ---- front clip: hood deck, fenders down to the bumper, grille, lights
    const hoodTopY = frameY + 0.74;
    const noseFront = spec.cabL / 2 + spec.hoodL;
    const hoodL = spec.hoodL;
    const hood = wedgeBox({ w: spec.cabW * 0.94, h: 0.16, d: hoodL, mat: bodyM, topScaleX: 0.92, topScaleZ: 0.98 });
    hood.position.set(0, hoodTopY, spec.cabL / 2 + hoodL / 2);
    cab.add(hood);
    // Fender/engine-bay sides filling everything under the hood.
    const clipH = hoodTopY - (frameY - 0.3);
    for (const s of [-1, 1]) {
      cab.add(box(0.28, clipH, hoodL, bodyM, s * (spec.cabW / 2 - 0.14), hoodTopY - clipH / 2, spec.cabL / 2 + hoodL / 2));
    }
    cab.add(box(spec.cabW * 0.82, clipH * 0.9, hoodL * 0.9, mat(0x2b2f35), 0, hoodTopY - clipH * 0.5, spec.cabL / 2 + hoodL / 2));
    // Wheel arches over the steer axle.
    for (const s of [-1, 1]) {
      const arcZ = spec.cabL / 2 + hoodL * 0.4;
      cab.add(box(0.34, 0.12, spec.wheelR * 2.5, bodyM, s * (spec.cabW / 2 - 0.05), frameY - 0.3, arcZ));
      cab.add(box(0.1, spec.wheelR * 0.9, spec.wheelR * 2.5, mat(0x1f2227), s * (spec.cabW / 2 - 0.02), frameY - 0.62, arcZ));
    }
    // Grille panel and chrome bars on the nose face.
    cab.add(box(spec.cabW * 0.9, clipH * 0.86, 0.12, mat(0x101216), 0, hoodTopY - clipH * 0.48, noseFront));
    for (let i = 0; i < 5; i++) {
      cab.add(box(spec.cabW * 0.82, 0.05, 0.16, mat(C.chrome, { metalness: 0.85 }),
        0, hoodTopY - clipH * 0.8 + i * clipH * 0.16, noseFront + 0.02));
    }
    for (const s of [-1, 1]) {
      cab.add(box(0.34, 0.2, 0.14, lightMat(C.headlight, 0.9), s * spec.cabW * 0.32, frameY + 0.16, noseFront + 0.02));
      cab.add(box(0.14, 0.12, 0.1, lightMat(0xffa726, 0.5), s * spec.cabW * 0.46, frameY + 0.16, noseFront));
    }
    // Bumper + tow eyes.
    cab.add(box(spec.cabW * 1.02, 0.26, 0.26, mat(C.chrome, { metalness: 0.8, roughness: 0.25 }), 0, frameY - 0.24, noseFront + 0.06));
    for (const s of [-1, 1]) cab.add(box(0.1, 0.14, 0.12, mat(0x3a3f46), s * 0.4, frameY - 0.36, noseFront + 0.02));
  } else {
    // Cab-over: flat face, low bumper, lights in the front panel.
    const faceZ = spec.cabL / 2;
    for (const s of [-1, 1]) {
      cab.add(box(0.36, 0.22, 0.14, lightMat(C.headlight, 0.9), s * spec.cabW * 0.3, frameY - 0.1, faceZ + 0.02));
      cab.add(box(0.14, 0.12, 0.1, lightMat(0xffa726, 0.5), s * spec.cabW * 0.45, frameY - 0.1, faceZ));
    }
    cab.add(box(spec.cabW * 0.7, 0.3, 0.1, mat(0x101216), 0, frameY + 0.24, faceZ + 0.02));
    cab.add(box(spec.cabW * 1.02, 0.3, 0.26, mat(0x2b2f35), 0, frameY - 0.4, faceZ + 0.04));
  }

  // Doors carrying the livery, plus glass, mirrors and steps.
  for (const s of [-1, 1]) {
    const doorH = lowerH * 0.74;
    const door = box(0.03, doorH, spec.cabL * 0.8, texMat(doorTex),
      s * (spec.cabW / 2 + 0.012), beltY - doorH / 2 - 0.08, 0);
    door.rotation.y = s > 0 ? 0 : Math.PI;
    door.userData.interactable = { id: 'cabdoor', label: 'Get in the truck', hint: 'F' };
    cab.add(door);
    cab.add(box(0.05, ghH * 0.66, spec.cabL * 0.62, glassM, s * (spec.cabW / 2 - 0.01), beltY + ghH * 0.42, -0.05));
    // Mirror arms
    cab.add(box(0.26, 0.05, 0.05, mat(0x1e2126), s * (spec.cabW / 2 + 0.14), beltY + ghH * 0.5, spec.cabL / 2 - 0.12));
    cab.add(box(0.07, 0.5, 0.22, mat(0x14161a), s * (spec.cabW / 2 + 0.27), beltY + ghH * 0.3, spec.cabL / 2 - 0.12));
    // Step under the door
    cab.add(box(0.34, 0.06, 0.62, mat(0x33373d, { metalness: 0.5 }), s * (spec.cabW / 2 - 0.06), cabBottomY + 0.02, -0.05));
    cab.add(box(0.06, 0.34, 0.06, mat(0x2b2f35), s * (spec.cabW / 2 - 0.02), cabBottomY + 0.2, -0.32));
  }
  if (spec.stack) {
    for (const s of [-1, 1]) {
      cab.add(cyl(0.08, 2.6, mat(C.chrome, { metalness: 0.9, roughness: 0.2 }), s * (spec.cabW / 2 + 0.1), frameY + 1.3, -spec.cabL / 2 + 0.12));
      cab.add(cyl(0.1, 0.18, mat(0x3a3f46, { metalness: 0.7 }), s * (spec.cabW / 2 + 0.1), frameY + 2.6, -spec.cabL / 2 + 0.12));
    }
  }
  root.add(cab);

  // Interior lives in cab space.
  const interior = buildInterior({ ...spec, cabH: cabShellH }, liv, root);
  interior.position.set(0, cabFloorY, cabZ + 0.05);
  root.add(interior);

  // ---- the deck: pivots and slides like a real rollback
  const bedPivot = new THREE.Group();
  const bedRearZ = deckRearZ;
  bedPivot.position.set(0, frameY, bedRearZ);
  const deckY = spec.bedH / 2;
  const deck = box(spec.bedW, spec.bedH, bedLen, deckM, 0, deckY, bedLen / 2);
  bedPivot.add(deck);
  // Deck tread plate stripes so the surface reads at a glance.
  const treads = Math.max(8, Math.round(bedLen / 0.45));
  for (let i = 0; i < treads; i++) {
    bedPivot.add(box(spec.bedW * 0.98, 0.012, 0.07, mat(0x5b6068, { metalness: 0.6, roughness: 0.5 }),
      0, spec.bedH + 0.006, 0.25 + i * (bedLen / treads)));
  }
  // Side rails with strap rings + livery skirts hanging under the deck.
  const strapPoints = [];
  for (const s of [-1, 1]) {
    bedPivot.add(box(0.1, 0.16, bedLen, mat(0x3f444b, { metalness: 0.5 }), s * (spec.bedW / 2 - 0.03), spec.bedH + 0.08, bedLen / 2));
    const skirt = box(0.04, 0.4, bedLen * 0.94, texMat(bedTex), s * (spec.bedW / 2 + 0.01), -0.21, bedLen / 2);
    skirt.rotation.y = s > 0 ? 0 : Math.PI;
    bedPivot.add(skirt);
    bedPivot.add(box(0.06, 0.05, bedLen * 0.96, mat(liv.accent, { roughness: 0.5 }), s * (spec.bedW / 2 + 0.02), -0.02, bedLen / 2));
    for (let i = 0; i < 2; i++) {
      const z = bedLen * (i === 0 ? 0.26 : 0.72);
      const ring = cyl(0.05, 0.07, mat(0xc9ced6, { metalness: 0.85 }), s * (spec.bedW / 2 - 0.03), spec.bedH + 0.18, z);
      bedPivot.add(ring);
      strapPoints.push({ mesh: ring, side: s, index: strapPoints.length, z, x: s * (spec.bedW / 2 - 0.03) });
    }
  }
  // Headboard + winch + light panel at the front of the deck.
  const headboardH = 1.15;
  bedPivot.add(box(spec.bedW, headboardH, 0.16, mat(0x3a3e45, { metalness: 0.5 }), 0, headboardH / 2 + spec.bedH, bedLen - 0.08));
  for (let i = 0; i < 5; i++) {
    bedPivot.add(box(0.07, headboardH * 0.86, 0.07, mat(0x53585f), -spec.bedW * 0.4 + i * spec.bedW * 0.2, headboardH / 2 + spec.bedH, bedLen - 0.16));
  }
  const winchBody = cyl(0.17, 0.62, mat(0x8d939b, { metalness: 0.8, roughness: 0.3 }), 0, spec.bedH + 0.34, bedLen - 0.32);
  winchBody.rotation.z = Math.PI / 2;
  winchBody.userData.interactable = { id: 'winch', label: 'Winch controls', hint: 'E' };
  bedPivot.add(winchBody);
  bedPivot.add(box(0.56, 0.28, 0.34, mat(0x35393f), 0, spec.bedH + 0.16, bedLen - 0.32));
  const winchAnchor = new THREE.Object3D();
  winchAnchor.position.set(0, spec.bedH + 0.36, bedLen - 0.48);
  bedPivot.add(winchAnchor);
  // Rear approach ramp lip + amber bar across the tail of the deck.
  const lip = box(spec.bedW * 0.96, 0.07, 0.8, deckM, 0, spec.bedH * 0.35, -0.34);
  lip.rotation.x = 0.16;
  bedPivot.add(lip);
  const rearBar = buildLightbar(spec.bedW * 0.9, 0.12);
  rearBar.position.set(0, spec.bedH + 0.3, -0.05);
  bedPivot.add(rearBar);

  root.add(bedPivot);

  // Exterior bed control panel — the levers you actually use to load a car.
  const ctrlPanel = new THREE.Group();
  ctrlPanel.position.set(spec.cabW / 2 + 0.12, frameY + 0.25, cabZ - spec.cabL / 2 - 0.5);
  ctrlPanel.add(box(0.12, 0.36, 0.4, mat(0x22262c)));
  const leverTilt = box(0.06, 0.3, 0.06, mat(0xf0a80c), 0.1, 0.2, 0.1);
  leverTilt.userData.interactable = { id: 'lever_bed', label: 'Bed tilt lever', hint: 'E' };
  const leverWinch = box(0.06, 0.3, 0.06, mat(0xc0392b), 0.1, 0.2, -0.1);
  leverWinch.userData.interactable = { id: 'lever_winch', label: 'Winch lever', hint: 'E' };
  ctrlPanel.add(leverTilt, leverWinch);
  root.add(ctrlPanel);

  // ---- utility compartments under the deck (jump box, straps, tools)
  const boxes = [];
  const boxLabels = [
    'Utility compartment — jump box',
    'Utility compartment — straps & ratchets',
    'Utility compartment — tools',
    'Utility compartment — spares',
  ];
  for (const s of [-1, 1]) {
    for (let i = 0; i < spec.boxes; i++) {
      const bw = 0.32, bh = 0.38, bd = (bedLen - 1.2) / spec.boxes - 0.2;
      const ub = buildUtilityBox(bw, bh, bd, liv, boxLabels[i % boxLabels.length]);
      ub.position.set(s * (spec.bedW / 2 - 0.16), frameY - 0.5, bedRearZ + 0.8 + i * (bd + 0.2) + bd / 2);
      ub.scale.x = s;
      ub.userData.slot = i;
      ub.userData.side = s;
      root.add(ub);
      boxes.push(ub);
    }
  }

  // ---- amber lighting: roof bar, cab corner strobes, side markers
  const amberGroups = [];
  if (spec.topBar) {
    const bar = buildLightbar(spec.cabW * 0.95, 0.16);
    bar.position.set(0, cabFloorY + cabShellH + 0.1, cabZ + 0.1);
    root.add(bar);
    amberGroups.push(bar);
  } else {
    const beacon = new THREE.Group();
    beacon.position.set(0, cabFloorY + cabShellH + 0.14, cabZ - 0.2);
    beacon.add(cyl(0.1, 0.16, mat(0x1a1c20), 0, -0.08, 0));
    const dome = cyl(0.11, 0.2, lightMat(C.amber, 0.15), 0, 0.06, 0);
    dome.userData.amber = true;
    beacon.add(dome);
    beacon.userData.lenses = [dome];
    root.add(beacon);
    amberGroups.push(beacon);
  }
  amberGroups.push(rearBar);
  // Cab corner + side markers
  const markers = [];
  for (const s of [-1, 1]) {
    const m1 = amberLens(0.12, 0.08, 0.08, s * (spec.cabW / 2 - 0.02), cabFloorY + cabShellH + 0.04, cabZ + spec.cabL / 2 - 0.1);
    root.add(m1); markers.push(m1);
    const m2 = amberLens(0.1, 0.07, 0.07, s * (spec.bedW / 2 + 0.02), frameY - 0.1, bedRearZ + 1.4);
    root.add(m2); markers.push(m2);
  }
  amberGroups.push({ userData: { lenses: markers } });

  // ---- wheels
  const wheels = [];
  const wr = spec.wheelR;
  const halfTrack = spec.cabW / 2 - 0.18;
  // Front axle sits under the hood (or under the COE cab), rear under the deck.
  const frontAxleZ = spec.style === 'coe' ? noseZ - 1.05 : noseZ - spec.hoodL * 0.6;
  const axles = [
    { z: frontAxleZ, dually: false },
    { z: frontAxleZ - spec.wb, dually: spec.dually },
  ];
  if (spec.id === 'heavy') axles.push({ z: axles[1].z - 1.4, dually: true });
  for (const ax of axles) {
    for (const s of [-1, 1]) {
      const w = buildTruckWheel(wr, spec.dually ? 0.24 : 0.26, ax.dually);
      w.position.set(s * halfTrack, wr, ax.z);
      w.scale.x = s;
      w.userData.steer = ax === axles[0];
      root.add(w);
      wheels.push(w);
    }
  }

  // ---- rear: tow bar, wheel lift if the model has one, mud flaps
  if (spec.wheelLift) {
    const lift = new THREE.Group();
    lift.position.set(0, frameY - 0.42, bedRearZ - 0.3);
    lift.add(box(0.3, 0.16, 1.1, mat(0x3b4046, { metalness: 0.6 }), 0, 0, -0.3));
    lift.add(box(1.5, 0.12, 0.14, mat(0x3b4046, { metalness: 0.6 }), 0, -0.06, -0.85));
    for (const s of [-1, 1]) lift.add(box(0.12, 0.12, 0.5, mat(0x53585f), s * 0.6, -0.06, -1.05));
    root.add(lift);
    root.userData.wheelLift = lift;
  }
  for (const s of [-1, 1]) {
    root.add(box(0.02, 0.4, 0.34, mat(0x17181c), s * (spec.bedW / 2 - 0.1), frameY - 0.62, bedRearZ - 0.05));
  }
  root.add(box(spec.bedW * 0.9, 0.12, 0.12, mat(0x2b2f35, { metalness: 0.5 }), 0, frameY - 0.5, bedRearZ - 0.2));

  // ---- rear work lights + plate
  for (const s of [-1, 1]) {
    root.add(box(0.2, 0.3, 0.08, lightMat(C.tail, 0.5), s * (spec.bedW / 2 - 0.16), frameY - 0.25, bedRearZ - 0.24));
  }

  root.userData.kind = 'towtruck';
  root.userData.spec = spec;
  root.userData.livery = liv;
  root.userData.wheels = wheels;
  root.userData.steerWheels = wheels.filter((w) => w.userData.steer);
  root.userData.bed = {
    pivot: bedPivot, length: bedLen, width: spec.bedW, deckY: spec.bedH,
    rearZ: bedRearZ, tilt: 0, slide: 0, baseZ: bedRearZ, baseY: frameY,
  };
  root.userData.strapPoints = strapPoints;
  root.userData.winchAnchor = winchAnchor;
  root.userData.boxes = boxes;
  root.userData.amberGroups = amberGroups;
  root.userData.elsMode = 0;
  root.userData.parkBrake = true;
  root.userData.cabZ = cabZ;
  root.userData.cabFloorY = cabFloorY;
  // Eye point: behind the wheel, just high enough to see over the dash.
  root.userData.seatPos = new THREE.Vector3(spec.cabW * 0.22, cabFloorY + 1.26, cabZ - 0.22);
  root.userData.exitPos = new THREE.Vector3(spec.cabW / 2 + 1.0, 0, cabZ);
  root.userData.dims = { L: spec.L, W: spec.cabW + 0.2, H: cabFloorY + cabShellH + 0.3 };
  root.userData.controlPanel = ctrlPanel;
  return root;
}

/* ------------------------------------------------------------ live behaviour */

const AMBER_ON = new THREE.Color(C.amber);

export function setELSMode(truck, mode) {
  truck.userData.elsMode = mode;
  const label = truck.userData.screens?.elsLabel;
  if (label) {
    const { ctx, tex } = label;
    ctx.fillStyle = '#0b0d10'; ctx.fillRect(0, 0, 320, 90);
    ctx.fillStyle = mode === 0 ? '#666' : '#ffb03a';
    ctx.font = 'bold 26px Arial'; ctx.textAlign = 'center';
    ctx.fillText(['ELS  OFF', 'AMBER  STEADY', 'AMBER  SLOW FLASH'][mode], 160, 40);
    ctx.fillStyle = '#3a3f47';
    ctx.fillRect(20, 60, 280, 12);
    ctx.fillStyle = mode === 0 ? '#3a3f47' : '#ffb03a';
    ctx.fillRect(20, 60, 93 * (mode + 1), 12);
    tex.needsUpdate = true;
  }
}

export function updateTruckLights(truck, time) {
  const mode = truck.userData.elsMode || 0;
  const groups = truck.userData.amberGroups || [];
  // Mode 2 is the deliberately lazy amber wig-wag every real wrecker runs.
  const slow = Math.sin(time * 3.4) > 0 ? 1 : 0;
  const slowAlt = 1 - slow;
  for (const g of groups) {
    const lenses = g.userData?.lenses || [];
    for (const l of lenses) {
      let on = 0;
      if (mode === 1) on = 1;
      else if (mode === 2) on = (l.userData.phase === 1 ? slowAlt : slow);
      const m = l.material;
      if (m.__on !== on) {
        m.__on = on;
        m.emissive.copy(AMBER_ON);
        m.emissiveIntensity = on ? 2.4 : 0.06;
        m.color.setHex(on ? 0xffc04a : 0x8a5a12);
      }
    }
  }
}

export function setBedTilt(truck, t) {
  truck.userData.bed.targetTilt = Math.max(0, Math.min(1, t));
}

export function updateBed(truck, dt) {
  const bed = truck.userData.bed;
  const target = bed.targetTilt ?? 0;
  const speed = 0.42;
  const d = target - bed.tilt;
  if (Math.abs(d) > 1e-4) {
    bed.tilt += Math.sign(d) * Math.min(Math.abs(d), speed * dt);
    bed.moving = true;
  } else bed.moving = false;
  // Full tilt slides the deck back and drops its tail to the pavement, the way
  // a rollback actually loads.
  const angle = bed.tilt * 0.34; // ~19.5 degrees
  bed.pivot.rotation.x = -angle;
  bed.pivot.position.z = bed.baseZ - bed.tilt * 1.6;
  bed.pivot.position.y = bed.baseY - bed.tilt * (bed.baseY - 0.16);
}

export function updateTruckAnim(truck, dt, state) {
  updateBed(truck, dt);
  const p = truck.userData.parts;
  if (p?.steeringWheel && state) {
    p.steeringWheel.rotation.z = -(state.steer || 0) * 2.2;
  }
  if (p?.brakeLever) {
    const target = truck.userData.parkBrake ? -0.05 : -0.75;
    p.brakeLever.rotation.x += (target - p.brakeLever.rotation.x) * Math.min(1, dt * 8);
  }
  if (p?.elsButtons) {
    p.elsButtons.forEach((b, i) => {
      const active = truck.userData.elsMode === i;
      b.material = active ? mat(0xffb03a, { emissive: 0xff8c00, emissiveIntensity: 1.4 }) : mat(0x3a2a10, { emissive: 0x160e02 });
    });
  }
  for (const b of truck.userData.boxes || []) {
    const target = b.userData.open ? -1.35 * (b.userData.side < 0 ? 1 : 1) : 0;
    b.userData.doorPivot.rotation.z += (target - b.userData.doorPivot.rotation.z) * Math.min(1, dt * 8);
  }
}

/* Where a loaded car should sit on the deck, in truck-local space. */
export function deckAnchor(truck, offset = 0) {
  const bed = truck.userData.bed;
  const v = new THREE.Vector3(0, bed.deckY, bed.length * 0.5 + offset);
  bed.pivot.updateMatrixWorld(true);
  return bed.pivot.localToWorld(v.clone());
}
