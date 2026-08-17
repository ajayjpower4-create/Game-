// Civilian fleet. Every model is assembled from primitives at runtime — chunky
// Roblox-style parts, but proportioned and detailed enough that a Ranger reads
// as a Ranger and a box truck reads as a box truck.
//
// +Z is forward (the nose), +X is right, the origin sits on the ground.
import * as THREE from 'three';
import { box, cyl, rakedBox, wedgeBox, makeCanvas, canvasTexture, makeRng, TAU } from './util.js';
import { mat, paint, glass, lightMat, texMat, C, CAR_COLORS } from './materials.js';

/* ------------------------------------------------------------------ catalog */
// family: how the silhouette is assembled. Everything else tunes proportions.
const V = (id, name, family, spec) => ({ id, name, family, ...spec });

export const VEHICLES = [
  // --- compact & midsize sedans -------------------------------------------
  V('civia', 'Aizen Civia', 'car', { L: 4.4, W: 1.78, bodyH: 0.72, cabH: 0.72, cabL: 2.0, cabZ: -0.25, rideH: 0.26, wheelR: 0.32, wb: 2.6, rake: 0.42, tail: 'notch', segment: 'compact' }),
  V('corsair', 'Meridian Corsair', 'car', { L: 4.85, W: 1.85, bodyH: 0.76, cabH: 0.74, cabL: 2.2, cabZ: -0.3, rideH: 0.27, wheelR: 0.34, wb: 2.85, rake: 0.46, tail: 'notch', segment: 'midsize' }),
  V('fairlane', 'Fairlane LX', 'car', { L: 5.25, W: 1.95, bodyH: 0.8, cabH: 0.76, cabL: 2.35, cabZ: -0.25, rideH: 0.3, wheelR: 0.36, wb: 3.05, rake: 0.34, tail: 'notch', boxy: true, segment: 'full-size' }),
  V('volans40', 'Volan S40', 'car', { L: 4.6, W: 1.8, bodyH: 0.75, cabH: 0.75, cabL: 2.15, cabZ: -0.28, rideH: 0.27, wheelR: 0.33, wb: 2.7, rake: 0.4, tail: 'notch', segment: 'compact' }),
  V('accolade', 'Kestrel Accolade', 'car', { L: 4.5, W: 1.76, bodyH: 0.7, cabH: 0.7, cabL: 2.05, cabZ: -0.26, rideH: 0.25, wheelR: 0.31, wb: 2.62, rake: 0.44, tail: 'notch', segment: 'economy' }),
  V('regal', 'Brookvale Regal', 'car', { L: 5.4, W: 2.0, bodyH: 0.84, cabH: 0.74, cabL: 2.5, cabZ: -0.2, rideH: 0.31, wheelR: 0.37, wb: 3.15, rake: 0.3, tail: 'notch', boxy: true, chrome: true, segment: 'luxury' }),

  // --- coupes, sports, muscle ---------------------------------------------
  V('vantorra', 'Vantorra GT', 'car', { L: 4.5, W: 1.9, bodyH: 0.66, cabH: 0.6, cabL: 1.7, cabZ: -0.45, rideH: 0.2, wheelR: 0.34, wb: 2.6, rake: 0.55, tail: 'fast', spoiler: true, segment: 'sports' }),
  V('makoz3', 'Mako Z3', 'car', { L: 4.35, W: 1.86, bodyH: 0.62, cabH: 0.56, cabL: 1.6, cabZ: -0.4, rideH: 0.18, wheelR: 0.33, wb: 2.5, rake: 0.6, tail: 'fast', segment: 'sports' }),
  V('fury', 'Bronson Fury', 'car', { L: 5.0, W: 1.98, bodyH: 0.74, cabH: 0.62, cabL: 2.0, cabZ: -0.35, rideH: 0.26, wheelR: 0.38, wb: 2.9, rake: 0.42, tail: 'fast', hoodScoop: true, stripes: true, segment: 'muscle' }),
  V('diplomat', 'Diplomat R/T', 'car', { L: 5.1, W: 2.0, bodyH: 0.78, cabH: 0.64, cabL: 2.05, cabZ: -0.3, rideH: 0.27, wheelR: 0.38, wb: 2.95, rake: 0.36, tail: 'notch', boxy: true, hoodScoop: true, stripes: true, segment: 'muscle' }),
  V('solstice', 'Solstice Roadster', 'car', { L: 4.1, W: 1.8, bodyH: 0.6, cabH: 0.42, cabL: 1.3, cabZ: -0.4, rideH: 0.19, wheelR: 0.31, wb: 2.4, rake: 0.5, tail: 'fast', convertible: true, segment: 'roadster' }),
  V('veloce', 'Apex Veloce', 'car', { L: 4.6, W: 2.0, bodyH: 0.56, cabH: 0.5, cabL: 1.5, cabZ: -0.55, rideH: 0.14, wheelR: 0.35, wb: 2.7, rake: 0.62, tail: 'fast', spoiler: true, wide: true, segment: 'exotic' }),

  // --- hatchbacks & wagons -------------------------------------------------
  V('sprite', 'Kestrel Sprite', 'car', { L: 3.9, W: 1.7, bodyH: 0.72, cabH: 0.78, cabL: 1.95, cabZ: -0.2, rideH: 0.26, wheelR: 0.3, wb: 2.4, rake: 0.4, tail: 'hatch', segment: 'hatchback' }),
  V('pip', 'Nomura Pip', 'car', { L: 3.5, W: 1.62, bodyH: 0.74, cabH: 0.8, cabL: 1.8, cabZ: -0.15, rideH: 0.25, wheelR: 0.28, wb: 2.25, rake: 0.34, tail: 'hatch', boxy: true, segment: 'kei' }),
  V('estate', 'Volan Estate', 'car', { L: 4.9, W: 1.84, bodyH: 0.76, cabH: 0.82, cabL: 2.7, cabZ: -0.4, rideH: 0.28, wheelR: 0.33, wb: 2.85, rake: 0.42, tail: 'wagon', roofRack: true, segment: 'wagon' }),
  V('trailmark', 'Meridian Trailmark', 'car', { L: 4.95, W: 1.9, bodyH: 0.8, cabH: 0.84, cabL: 2.75, cabZ: -0.4, rideH: 0.34, wheelR: 0.35, wb: 2.9, rake: 0.4, tail: 'wagon', roofRack: true, cladding: true, segment: 'wagon' }),

  // --- SUVs and off-roaders ------------------------------------------------
  V('ranger', 'Bricktown Ranger', 'tall', { L: 4.9, W: 2.0, bodyH: 0.95, cabH: 0.95, cabL: 2.9, cabZ: -0.25, rideH: 0.42, wheelR: 0.4, wb: 2.9, rake: 0.3, roofRack: true, segment: 'SUV' }),
  V('summit', 'Summit XL', 'tall', { L: 5.4, W: 2.06, bodyH: 1.0, cabH: 1.0, cabL: 3.3, cabZ: -0.3, rideH: 0.45, wheelR: 0.42, wb: 3.1, rake: 0.3, roofRack: true, chrome: true, segment: 'full-size SUV' }),
  V('trailhawk', 'Trailhawk 4x4', 'tall', { L: 4.3, W: 1.94, bodyH: 0.98, cabH: 0.9, cabL: 2.4, cabZ: -0.2, rideH: 0.52, wheelR: 0.44, wb: 2.6, rake: 0.12, boxy: true, bullbar: true, spare: true, segment: 'off-road' }),
  V('rove', 'Nomura Rove', 'tall', { L: 4.6, W: 1.86, bodyH: 0.86, cabH: 0.88, cabL: 2.6, cabZ: -0.3, rideH: 0.36, wheelR: 0.36, wb: 2.7, rake: 0.38, cladding: true, segment: 'crossover' }),
  V('landmaster', 'Landmaster 90', 'tall', { L: 4.5, W: 1.98, bodyH: 1.05, cabH: 0.95, cabL: 2.7, cabZ: -0.2, rideH: 0.5, wheelR: 0.43, wb: 2.8, rake: 0.05, boxy: true, roofRack: true, spare: true, segment: 'off-road' }),
  V('cascade', 'Cascade Sport', 'tall', { L: 4.35, W: 1.82, bodyH: 0.84, cabH: 0.86, cabL: 2.45, cabZ: -0.28, rideH: 0.34, wheelR: 0.34, wb: 2.6, rake: 0.4, segment: 'crossover' }),

  // --- pickups -------------------------------------------------------------
  V('haul150', 'Bricktown Haul 150', 'pickup', { L: 5.8, W: 2.05, bodyH: 0.92, cabH: 0.9, cabL: 2.1, rideH: 0.44, wheelR: 0.41, wb: 3.5, bedL: 2.1, chrome: true, segment: 'pickup' }),
  V('crest2500', 'Sierra Crest 2500', 'pickup', { L: 6.3, W: 2.15, bodyH: 1.0, cabH: 0.95, cabL: 2.4, rideH: 0.52, wheelR: 0.46, wb: 3.8, bedL: 2.2, dually: true, segment: 'heavy pickup' }),
  V('trek', 'Nomura Trek', 'pickup', { L: 5.3, W: 1.9, bodyH: 0.86, cabH: 0.88, cabL: 1.95, rideH: 0.42, wheelR: 0.38, wb: 3.2, bedL: 1.85, segment: 'midsize pickup' }),
  V('workhorse', 'Fairlane Workhorse', 'pickup', { L: 5.4, W: 1.98, bodyH: 0.9, cabH: 0.82, cabL: 1.6, rideH: 0.46, wheelR: 0.4, wb: 3.3, bedL: 2.3, boxy: true, patina: true, segment: 'vintage pickup' }),

  // --- vans, buses, commercial --------------------------------------------
  V('cargo250', 'Kestrel Cargo 250', 'van', { L: 5.6, W: 2.02, bodyH: 1.9, cabH: 0.0, rideH: 0.34, wheelR: 0.38, wb: 3.5, nose: 0.75, segment: 'cargo van' }),
  V('voyage', 'Meridian Voyage', 'van', { L: 5.1, W: 1.96, bodyH: 1.35, cabH: 0.0, rideH: 0.3, wheelR: 0.35, wb: 3.0, nose: 1.1, windows: true, slider: true, segment: 'minivan' }),
  V('vagabond', 'Vagabond Custom', 'van', { L: 5.3, W: 2.0, bodyH: 1.55, cabH: 0.0, rideH: 0.32, wheelR: 0.36, wb: 3.2, nose: 0.85, mural: true, segment: 'panel van' }),
  V('parcel', 'Parcel Post Sprinter', 'van', { L: 6.0, W: 2.04, bodyH: 2.1, cabH: 0.0, rideH: 0.36, wheelR: 0.39, wb: 3.7, nose: 0.7, livery: 'PARCEL POST', segment: 'delivery van' }),
  V('box450', 'Bricktown Box 450', 'box', { L: 7.4, W: 2.3, bodyH: 1.05, cabH: 1.05, cabL: 1.9, rideH: 0.5, wheelR: 0.46, wb: 4.4, boxL: 4.3, boxH: 2.5, segment: 'box truck' }),
  V('sundae', 'Sundae Cruiser', 'box', { L: 6.2, W: 2.1, bodyH: 1.0, cabH: 1.0, cabL: 1.8, rideH: 0.44, wheelR: 0.4, wb: 3.8, boxL: 3.3, boxH: 2.1, icecream: true, segment: 'food truck' }),
  V('shuttle', 'Skyville Transit Shuttle', 'bus', { L: 8.4, W: 2.35, bodyH: 2.55, rideH: 0.42, wheelR: 0.46, wb: 5.2, segment: 'shuttle bus' }),

  // --- specials ------------------------------------------------------------
  V('cab', 'Skyville Yellow Cab', 'car', { L: 5.0, W: 1.92, bodyH: 0.8, cabH: 0.8, cabL: 2.4, cabZ: -0.28, rideH: 0.3, wheelR: 0.35, wb: 2.95, rake: 0.36, tail: 'notch', taxi: true, forceColor: 0xf2c009, segment: 'taxi' }),
  V('interceptor', 'SPD Interceptor', 'car', { L: 5.1, W: 1.96, bodyH: 0.78, cabH: 0.76, cabL: 2.3, cabZ: -0.3, rideH: 0.29, wheelR: 0.36, wb: 3.0, rake: 0.4, tail: 'notch', police: true, forceColor: 0x1b2733, segment: 'police' }),
  V('stretch', 'Brookvale Stretch', 'car', { L: 7.6, W: 2.0, bodyH: 0.82, cabH: 0.74, cabL: 4.6, cabZ: -0.3, rideH: 0.3, wheelR: 0.36, wb: 5.2, rake: 0.3, tail: 'notch', boxy: true, chrome: true, forceColor: 0x101216, segment: 'limousine' }),
  V('rustbucket', 'Pinter Rustbucket', 'car', { L: 4.2, W: 1.72, bodyH: 0.72, cabH: 0.7, cabL: 1.9, cabZ: -0.25, rideH: 0.24, wheelR: 0.3, wb: 2.45, rake: 0.4, tail: 'hatch', patina: true, segment: 'beater' }),
  V('ravello', 'Ravello 650', 'bike', { L: 2.1, W: 0.8, rideH: 0.3, wheelR: 0.33, wb: 1.45, segment: 'motorcycle' }),
];

export const VEHICLE_BY_ID = Object.fromEntries(VEHICLES.map((v) => [v.id, v]));

/* -------------------------------------------------------------- plate texture */

const PLATE_LETTERS = 'ABCDEFGHJKLMNPRSTVWXYZ';
function plateTexture(rng) {
  const c = makeCanvas(256, 128);
  const x = c.getContext('2d');
  x.fillStyle = '#f4f5ef'; x.fillRect(0, 0, 256, 128);
  x.strokeStyle = '#1b3a6b'; x.lineWidth = 8; x.strokeRect(6, 6, 244, 116);
  x.fillStyle = '#1b3a6b';
  x.font = 'bold 22px Arial'; x.textAlign = 'center';
  x.fillText('SKYVILLE', 128, 30);
  const txt = `${rng.int(100, 999)} ${PLATE_LETTERS[rng.int(0, 21)]}${PLATE_LETTERS[rng.int(0, 21)]}${PLATE_LETTERS[rng.int(0, 21)]}`;
  x.font = 'bold 54px Arial';
  x.fillStyle = '#14203a';
  x.fillText(txt, 128, 78);
  x.font = '16px Arial';
  x.fillText('THE HARBOR STATE', 128, 110);
  return canvasTexture(c);
}

/* ------------------------------------------------------------------- wheels */

function buildWheel(radius, width, { rimColor = C.rim, flat = false, dually = false } = {}) {
  const g = new THREE.Group();
  const r = radius;
  const tire = cyl(r, width, mat(C.tire, { roughness: 0.95 }), 0, 0, 0, 24);
  tire.rotation.z = Math.PI / 2;
  g.add(tire);
  if (dually) {
    const outer = cyl(r, width * 0.85, mat(C.tire, { roughness: 0.95 }), width * 0.9, 0, 0, 24);
    outer.rotation.z = Math.PI / 2;
    g.add(outer);
  }
  // Sidewall lettering ring + rim face.
  const rim = cyl(r * 0.62, width * 1.04, mat(rimColor, { roughness: 0.3, metalness: 0.7 }), 0, 0, 0, 24);
  rim.rotation.z = Math.PI / 2;
  g.add(rim);
  const hub = cyl(r * 0.22, width * 1.12, mat(C.rimDark, { metalness: 0.6, roughness: 0.4 }), 0, 0, 0);
  hub.rotation.z = Math.PI / 2;
  g.add(hub);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    const spoke = box(width * 1.06, r * 0.5, r * 0.14, mat(C.rimDark, { metalness: 0.5 }),
      0, Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.36);
    spoke.rotation.x = -a;
    g.add(spoke);
  }
  // Lug nuts — the drill job needs something to bite on.
  const lugs = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.3;
    const lug = cyl(r * 0.055, width * 1.2, mat(C.steel, { metalness: 0.8, roughness: 0.3 }),
      0, Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2);
    lug.rotation.z = Math.PI / 2;
    lug.castShadow = false;
    g.add(lug);
    lugs.push(lug);
  }
  g.userData.lugs = lugs;
  if (flat) g.scale.y = 0.72;
  return g;
}

/* ------------------------------------------------------------- shared detail */

function addWheels(root, spec, opts) {
  const wheels = [];
  const r = spec.wheelR;
  const width = spec.dually ? 0.26 : Math.max(0.2, spec.W * 0.13);
  const halfTrack = spec.W / 2 - width * 0.55;
  const zf = spec.wb / 2, zr = -spec.wb / 2;
  const positions = [
    [-halfTrack, zf, 'FL'], [halfTrack, zf, 'FR'],
    [-halfTrack, zr, 'RL'], [halfTrack, zr, 'RR'],
  ];
  for (const [x, z, tag] of positions) {
    const flat = opts.flatTires?.includes(tag);
    const w = buildWheel(r, width, { rimColor: opts.rimColor ?? (spec.patina ? C.rimDark : C.rim), flat, dually: spec.dually && z < 0 });
    w.position.set(x, r, z);
    if (spec.dually && z < 0) w.position.x = x - Math.sign(x) * 0.0;
    if (spec.dually && z < 0) w.scale.x = 1;
    w.userData.tag = tag;
    w.userData.baseY = r;
    w.userData.side = x < 0 ? -1 : 1;
    w.userData.steer = z > 0;
    root.add(w);
    wheels.push(w);
    // Brake disc behind the wheel, revealed when a tire comes off.
    const disc = cyl(r * 0.5, 0.05, mat(0x6b6f76, { metalness: 0.7, roughness: 0.5 }), x, r, z);
    disc.rotation.z = Math.PI / 2;
    disc.visible = true;
    root.add(disc);
    w.userData.disc = disc;
  }
  return wheels;
}

function addPlate(root, spec, rng, z, y) {
  const tex = plateTexture(rng);
  const m = box(0.42, 0.22, 0.03, texMat(tex), 0, y, z);
  root.add(m);
}

function addMirrors(root, spec, y, z) {
  const armM = mat(C.darkSteel);
  for (const s of [-1, 1]) {
    const arm = box(0.1, 0.05, 0.1, armM, s * (spec.W / 2 + 0.02), y, z);
    root.add(arm);
    const face = box(0.06, 0.14, 0.2, mat(C.black), s * (spec.W / 2 + 0.12), y + 0.02, z);
    root.add(face);
  }
}

function addDoorSeams(root, spec, bodyY, bodyH, count, startZ, spacing) {
  const seam = mat(0x000000, { roughness: 1 });
  for (const s of [-1, 1]) {
    for (let i = 0; i < count; i++) {
      const z = startZ - i * spacing;
      root.add(box(0.012, bodyH * 0.9, 0.03, seam, s * (spec.W / 2 + 0.005), bodyY, z));
      // Door handle
      root.add(box(0.03, 0.05, 0.22, mat(spec.chrome ? C.chrome : C.darkSteel, { metalness: 0.6 }),
        s * (spec.W / 2 + 0.02), bodyY + bodyH * 0.22, z - spacing * 0.45));
    }
  }
}

function addEngineBay(hoodGroup, root, spec, bayY, bayZ, bayL) {
  const bay = new THREE.Group();
  bay.position.set(0, bayY, bayZ);
  // Firewall + inner fenders make the bay read as a bay and not a hole.
  bay.add(box(spec.W * 0.86, 0.05, bayL, mat(0x2a2c31), 0, -0.14, 0));
  const engine = box(spec.W * 0.42, 0.34, bayL * 0.5, mat(0x4a4d55, { metalness: 0.5, roughness: 0.6 }), 0, 0.06, -bayL * 0.1);
  bay.add(engine);
  bay.add(box(spec.W * 0.3, 0.1, bayL * 0.32, mat(0x6f7480, { metalness: 0.6 }), 0, 0.25, -bayL * 0.12));
  // Air box + hoses
  bay.add(box(0.28, 0.16, 0.3, mat(0x1d1f24), spec.W * 0.24, 0.18, bayL * 0.14));
  bay.add(cyl(0.05, 0.42, mat(0x26282e), spec.W * 0.1, 0.2, bayL * 0.2));
  // Radiator up front
  bay.add(box(spec.W * 0.6, 0.28, 0.07, mat(0x33363c), 0, 0.06, bayL * 0.42));

  // The battery: the whole point of a jump-start call.
  const battery = box(0.3, 0.26, 0.2, mat(0x1a1c22, { roughness: 0.6 }), -spec.W * 0.26, 0.18, bayL * 0.24);
  battery.name = 'battery';
  bay.add(battery);
  bay.add(box(0.34, 0.03, 0.24, mat(0x2b2e34), -spec.W * 0.26, 0.32, bayL * 0.24));
  const posT = cyl(0.035, 0.07, mat(0xc0392b, { metalness: 0.4 }), -spec.W * 0.26 + 0.09, 0.36, bayL * 0.24 + 0.05);
  const negT = cyl(0.035, 0.07, mat(0x14151a, { metalness: 0.4 }), -spec.W * 0.26 - 0.09, 0.36, bayL * 0.24 + 0.05);
  posT.name = 'terminalPos'; negT.name = 'terminalNeg';
  bay.add(posT, negT);
  root.add(bay);
  root.userData.batteryWorld = battery;
  root.userData.bay = bay;
  return bay;
}

function addLightsAndBumpers(root, spec, opts, nose, tail, bodyY, bodyH) {
  const bumperM = mat(spec.patina ? 0x8a8d92 : (spec.chrome ? C.chrome : 0x2b2d33), { metalness: spec.chrome ? 0.8 : 0.2, roughness: spec.chrome ? 0.2 : 0.7 });
  const head = lightMat(C.headlight, 0.9);
  const tailM = lightMat(C.tail, 0.7);
  const amberM = lightMat(0xffa726, 0.5);
  const hw = spec.W * 0.5;

  // Front bumper + valance
  root.add(box(spec.W * 0.99, 0.2, 0.22, bumperM, 0, bodyY - bodyH * 0.34, nose - 0.03));
  root.add(box(spec.W * 0.9, 0.12, 0.16, mat(0x1d1f24), 0, bodyY - bodyH * 0.52, nose - 0.05));
  // Grille
  const grilleH = Math.min(0.26, bodyH * 0.45);
  root.add(box(spec.W * 0.62, grilleH, 0.06, mat(0x121317), 0, bodyY + 0.02, nose + 0.005));
  for (let i = 0; i < 3; i++) {
    root.add(box(spec.W * 0.6, 0.025, 0.07, mat(spec.chrome ? C.chrome : 0x3a3d44, { metalness: 0.7 }),
      0, bodyY + 0.02 - grilleH * 0.3 + i * grilleH * 0.3, nose + 0.02));
  }
  // Headlights + turn signals
  for (const s of [-1, 1]) {
    root.add(box(0.34, 0.16, 0.08, head, s * hw * 0.66, bodyY + 0.06, nose + 0.005));
    root.add(box(0.14, 0.1, 0.06, amberM, s * hw * 0.92, bodyY + 0.04, nose - 0.01));
  }
  // Rear bumper, tail lights, reflectors
  root.add(box(spec.W * 0.99, 0.2, 0.22, bumperM, 0, bodyY - bodyH * 0.34, tail + 0.03));
  for (const s of [-1, 1]) {
    root.add(box(0.3, 0.18, 0.07, tailM, s * hw * 0.7, bodyY + 0.08, tail - 0.005));
    root.add(box(0.1, 0.06, 0.05, mat(0xd8d8d8, { emissive: 0x333333 }), s * hw * 0.9, bodyY - 0.08, tail - 0.01));
  }
  root.add(box(0.5, 0.05, 0.05, lightMat(C.tail, 0.4), 0, bodyY + bodyH * 0.4, tail - 0.02));
  // Exhaust
  root.add(cyl(0.05, 0.3, mat(C.steel, { metalness: 0.7 }), hw * 0.55, bodyY - bodyH * 0.48, tail + 0.1));
}

/* ------------------------------------------------------------ body families */

function buildCar(spec, opts, rng) {
  const root = new THREE.Group();
  const color = opts.color ?? spec.forceColor ?? rng.pick(CAR_COLORS);
  const bodyM = spec.patina ? mat(color, { roughness: 0.95, metalness: 0 }) : paint(color);
  const glassM = glass(spec.taxi || spec.police ? 0x16202c : 0x0f151d, 0.55);
  const trimM = mat(spec.chrome ? C.chrome : 0x25272c, { metalness: spec.chrome ? 0.8 : 0.3, roughness: 0.35 });

  const nose = spec.L / 2, tail = -spec.L / 2;
  const bodyY = spec.rideH + spec.bodyH / 2;
  const bodyH = spec.bodyH;

  // Main tub, slightly tapered towards the nose unless the car is boxy.
  const tub = wedgeBox({
    w: spec.W, h: bodyH, d: spec.L, mat: bodyM,
    topScaleX: spec.boxy ? 0.99 : 0.965, topScaleZ: 0.995,
  });
  tub.position.set(0, bodyY, 0);
  root.add(tub);
  // Rocker panels + a shoulder crease to break up the slab sides.
  root.add(box(spec.W * 1.005, 0.09, spec.L * 0.72, mat(spec.cladding ? 0x2c2e33 : color, { roughness: 0.8 }), 0, spec.rideH + 0.06, 0));
  root.add(box(spec.W * 1.01, 0.05, spec.L * 0.8, mat(0x000000, { roughness: 1, opacity: 0.25, transparent: true }), 0, bodyY + bodyH * 0.16, 0));

  // Hood: pivots at the windscreen end so it can be popped open.
  const hoodPivot = new THREE.Group();
  const hoodZfront = nose - 0.06;
  const hoodZback = spec.cabZ + spec.cabL / 2;
  const hoodL = Math.max(0.5, hoodZfront - hoodZback);
  hoodPivot.position.set(0, bodyY + bodyH / 2, hoodZback);
  const hood = box(spec.W * 0.94, 0.08, hoodL, bodyM, 0, 0.02, hoodL / 2);
  hoodPivot.add(hood);
  if (spec.hoodScoop) {
    hoodPivot.add(box(0.5, 0.12, 0.5, mat(0x1c1e22), 0, 0.1, hoodL * 0.55));
    hoodPivot.add(box(0.44, 0.06, 0.42, mat(0x0d0e11), 0, 0.16, hoodL * 0.55));
  }
  if (spec.stripes) {
    hoodPivot.add(box(0.42, 0.02, hoodL * 0.95, mat(0xf2f2f2), 0, 0.07, hoodL / 2));
  }
  hoodPivot.userData.isHood = true;
  root.add(hoodPivot);
  root.userData.hood = hoodPivot;
  // Cut the engine bay out under the hood.
  addEngineBay(hoodPivot, root, spec, bodyY + bodyH * 0.1, (hoodZfront + hoodZback) / 2, hoodL);

  // Greenhouse.
  const cabY = spec.rideH + bodyH + spec.cabH / 2;
  if (spec.convertible) {
    root.add(box(spec.W * 0.86, 0.28, spec.cabL * 0.5, mat(0x141519), 0, cabY - spec.cabH * 0.2, spec.cabZ - spec.cabL * 0.2));
    root.add(box(spec.W * 0.8, 0.5, 0.06, glassM, 0, cabY, spec.cabZ + spec.cabL * 0.42));
    root.add(box(spec.W * 0.82, 0.06, 0.08, trimM, 0, cabY + 0.26, spec.cabZ + spec.cabL * 0.42));
  } else {
    const cab = rakedBox(spec.W * 0.9, spec.cabH, spec.cabL,
      spec.rake, spec.tail === 'fast' ? spec.rake * 0.8 : spec.tail === 'wagon' ? 0.02 : spec.rake * 0.35, bodyM);
    cab.position.set(0, cabY, spec.cabZ);
    root.add(cab);
    // Glass: windscreen, backlight, side glass.
    const wsA = Math.atan2(spec.rake, spec.cabH);
    const ws = box(spec.W * 0.84, Math.hypot(spec.cabH, spec.rake) * 0.98, 0.05, glassM,
      0, cabY, spec.cabZ + spec.cabL / 2 - spec.rake / 2 + 0.01);
    ws.rotation.x = -wsA;
    root.add(ws);
    const backRake = spec.tail === 'fast' ? spec.rake * 0.8 : spec.tail === 'wagon' ? 0.02 : spec.rake * 0.35;
    const bl = box(spec.W * 0.82, Math.hypot(spec.cabH, backRake) * 0.96, 0.05, glassM,
      0, cabY, spec.cabZ - spec.cabL / 2 + backRake / 2 - 0.01);
    bl.rotation.x = Math.atan2(backRake, spec.cabH);
    root.add(bl);
    for (const s of [-1, 1]) {
      root.add(box(0.04, spec.cabH * 0.72, spec.cabL * 0.82, glassM, s * spec.W * 0.45, cabY + 0.02, spec.cabZ));
      // Window frame + B pillar
      root.add(box(0.05, spec.cabH * 0.9, 0.07, mat(0x101116), s * spec.W * 0.452, cabY, spec.cabZ + 0.02));
      root.add(box(0.05, 0.05, spec.cabL * 0.86, trimM, s * spec.W * 0.452, cabY + spec.cabH * 0.42, spec.cabZ));
    }
    // Roof panel with a hint of crown.
    root.add(box(spec.W * 0.86, 0.05, spec.cabL * (spec.tail === 'fast' ? 0.6 : 0.8), bodyM,
      0, cabY + spec.cabH / 2, spec.cabZ - spec.rake * 0.2));
  }

  // Wagon/hatch tails get a squared-off rear.
  if (spec.tail === 'wagon' || spec.tail === 'hatch') {
    root.add(box(spec.W * 0.9, spec.cabH * 0.9, 0.08, bodyM, 0, cabY - 0.02, spec.cabZ - spec.cabL / 2 - 0.03));
  }
  if (spec.spoiler) {
    root.add(box(spec.W * 0.8, 0.05, 0.24, mat(0x17181c), 0, bodyY + bodyH * 0.62, tail + 0.28));
    for (const s of [-1, 1]) root.add(box(0.06, 0.16, 0.1, mat(0x17181c), s * spec.W * 0.32, bodyY + bodyH * 0.54, tail + 0.28));
  }
  if (spec.roofRack) {
    for (const s of [-1, 1]) {
      root.add(box(0.06, 0.06, spec.cabL * 0.7, mat(0x2e3035), s * spec.W * 0.32, spec.rideH + bodyH + spec.cabH + 0.04, spec.cabZ));
    }
  }

  addLightsAndBumpers(root, spec, opts, nose, tail, bodyY, bodyH);
  addMirrors(root, spec, cabY - spec.cabH * 0.2, spec.cabZ + spec.cabL * 0.42);
  addDoorSeams(root, spec, bodyY, bodyH, spec.cabL > 3 ? 3 : 2, spec.cabZ + spec.cabL * 0.35, spec.cabL * 0.38);
  addPlate(root, spec, rng, nose + 0.03, spec.rideH + bodyH * 0.35);
  addPlate(root, spec, rng, tail - 0.03, spec.rideH + bodyH * 0.35);

  if (spec.taxi) {
    const sign = box(0.7, 0.18, 0.28, mat(0xf7d117, { emissive: 0x6b5a00 }), 0, spec.rideH + bodyH + spec.cabH + 0.09, spec.cabZ + 0.2);
    root.add(sign);
    root.add(box(spec.W * 0.92, 0.34, 0.02, mat(0x1a1a1a), 0, bodyY, spec.W * 0.0 - 0.0));
    for (const s of [-1, 1]) root.add(box(0.02, 0.3, 1.0, mat(0x101010), s * (spec.W / 2 + 0.006), bodyY, spec.cabZ + 0.1));
  }
  if (spec.police) {
    const bar = new THREE.Group();
    bar.position.set(0, spec.rideH + bodyH + spec.cabH + 0.08, spec.cabZ + 0.15);
    bar.add(box(1.2, 0.1, 0.24, mat(0x111318)));
    bar.add(box(0.5, 0.09, 0.22, lightMat(0x2f6fff, 1.2), -0.3, 0.01, 0));
    bar.add(box(0.5, 0.09, 0.22, lightMat(0xff2f2f, 1.2), 0.3, 0.01, 0));
    root.add(bar);
    for (const s of [-1, 1]) root.add(box(0.02, 0.5, 1.4, mat(0xf0f2f4), s * (spec.W / 2 + 0.006), bodyY, spec.cabZ + 0.1));
  }
  if (spec.patina) {
    for (let i = 0; i < 7; i++) {
      const s = rng.chance(0.5) ? -1 : 1;
      root.add(box(0.02, rng.range(0.1, 0.3), rng.range(0.2, 0.7), mat(C.rust, { roughness: 1 }),
        s * (spec.W / 2 + 0.008), spec.rideH + rng.range(0.05, bodyH), rng.range(-spec.L * 0.4, spec.L * 0.4)));
    }
  }
  return { root, bodyY, bodyH, color };
}

function buildTall(spec, opts, rng) {
  // SUVs: one tall tub, a long greenhouse, and a proper tailgate.
  const r = buildCar({ ...spec, tail: 'wagon' }, opts, rng);
  const { root } = r;
  // Chunkier arches + running boards to sell the ride height.
  for (const s of [-1, 1]) {
    root.add(box(0.1, 0.1, spec.wb * 0.75, mat(0x27292e), s * (spec.W / 2 + 0.02), spec.rideH - 0.02, 0));
    for (const z of [spec.wb / 2, -spec.wb / 2]) {
      root.add(box(0.07, 0.14, spec.wheelR * 2.3, mat(spec.cladding ? 0x2c2e33 : 0x1f2126),
        s * (spec.W / 2 + 0.015), spec.wheelR * 1.15, z));
    }
  }
  if (spec.bullbar) {
    const bb = new THREE.Group();
    bb.position.set(0, spec.rideH + 0.3, spec.L / 2 + 0.16);
    bb.add(box(spec.W * 0.9, 0.1, 0.1, mat(C.steel, { metalness: 0.6 })));
    for (const s of [-1, 0, 1]) bb.add(box(0.08, 0.6, 0.08, mat(C.steel, { metalness: 0.6 }), s * spec.W * 0.3, 0.2, 0));
    root.add(bb);
  }
  if (spec.spare) {
    const spare = buildWheel(spec.wheelR * 0.95, 0.24, {});
    spare.position.set(0, spec.rideH + spec.bodyH * 0.9, -spec.L / 2 - 0.16);
    spare.rotation.z = Math.PI / 2;
    root.add(spare);
  }
  return r;
}

function buildPickup(spec, opts, rng) {
  const root = new THREE.Group();
  const color = opts.color ?? spec.forceColor ?? rng.pick(CAR_COLORS);
  const bodyM = spec.patina ? mat(color, { roughness: 0.95 }) : paint(color);
  const glassM = glass(0x0f151d, 0.55);
  const nose = spec.L / 2, tail = -spec.L / 2;
  const bodyY = spec.rideH + spec.bodyH / 2;
  const bodyH = spec.bodyH;
  const cabZ = nose - 1.0 - spec.cabL / 2;

  root.add(box(spec.W * 0.9, 0.2, spec.L * 0.95, mat(0x1d1f23), 0, spec.rideH * 0.6, 0)); // frame rails
  // Front clip + cab tub
  const front = box(spec.W, bodyH, nose - cabZ + spec.cabL / 2, bodyM, 0, bodyY, (nose + cabZ - spec.cabL / 2) / 2);
  root.add(front);
  const cabY = spec.rideH + bodyH + spec.cabH / 2;
  const cab = rakedBox(spec.W * 0.96, spec.cabH, spec.cabL, 0.28, 0.04, bodyM);
  cab.position.set(0, cabY, cabZ);
  root.add(cab);
  const ws = box(spec.W * 0.86, spec.cabH * 1.02, 0.05, glassM, 0, cabY, cabZ + spec.cabL / 2 - 0.13);
  ws.rotation.x = -0.24;
  root.add(ws);
  root.add(box(spec.W * 0.84, spec.cabH * 0.9, 0.05, glassM, 0, cabY, cabZ - spec.cabL / 2 + 0.03));
  for (const s of [-1, 1]) root.add(box(0.04, spec.cabH * 0.7, spec.cabL * 0.8, glassM, s * spec.W * 0.48, cabY + 0.02, cabZ));
  root.add(box(spec.W * 0.94, 0.06, spec.cabL * 0.9, bodyM, 0, cabY + spec.cabH / 2, cabZ));

  // Hood
  const hoodPivot = new THREE.Group();
  const hoodBackZ = cabZ + spec.cabL / 2;
  const hoodL = nose - 0.08 - hoodBackZ;
  hoodPivot.position.set(0, bodyY + bodyH / 2, hoodBackZ);
  hoodPivot.add(box(spec.W * 0.95, 0.09, hoodL, bodyM, 0, 0.02, hoodL / 2));
  root.add(hoodPivot);
  root.userData.hood = hoodPivot;
  addEngineBay(hoodPivot, root, spec, bodyY + bodyH * 0.12, hoodBackZ + hoodL / 2, hoodL);

  // Bed: walls, floor, tailgate, bedliner ribs.
  const bedZ = cabZ - spec.cabL / 2 - spec.bedL / 2 - 0.1;
  const bedH = bodyH * 0.92;
  const bedY = spec.rideH + bedH / 2 + 0.1;
  root.add(box(spec.W, 0.1, spec.bedL, mat(0x2b2d32), 0, spec.rideH + 0.14, bedZ));
  for (const s of [-1, 1]) root.add(box(0.12, bedH, spec.bedL, bodyM, s * (spec.W / 2 - 0.06), bedY, bedZ));
  root.add(box(spec.W, bedH, 0.1, bodyM, 0, bedY, bedZ - spec.bedL / 2)); // tailgate
  root.add(box(spec.W, bedH, 0.12, bodyM, 0, bedY, bedZ + spec.bedL / 2)); // bulkhead
  for (const s of [-1, 1]) root.add(box(0.16, 0.06, spec.bedL, mat(spec.chrome ? C.chrome : 0x1f2126, { metalness: 0.6 }), s * (spec.W / 2 - 0.06), bedY + bedH / 2, bedZ));

  addLightsAndBumpers(root, spec, opts, nose, tail, bodyY, bodyH);
  addMirrors(root, spec, cabY - 0.1, cabZ + spec.cabL * 0.45);
  addDoorSeams(root, spec, bodyY, bodyH, spec.cabL > 2.2 ? 2 : 1, cabZ + spec.cabL * 0.3, 0.9);
  addPlate(root, spec, rng, nose + 0.03, spec.rideH + bodyH * 0.3);
  addPlate(root, spec, rng, tail - 0.03, spec.rideH + bodyH * 0.3);
  if (spec.patina) {
    for (let i = 0; i < 6; i++) {
      const s = rng.chance(0.5) ? -1 : 1;
      root.add(box(0.02, rng.range(0.1, 0.3), rng.range(0.2, 0.6), mat(C.rust, { roughness: 1 }),
        s * (spec.W / 2 + 0.008), spec.rideH + rng.range(0.1, bodyH), rng.range(-spec.L * 0.4, spec.L * 0.3)));
    }
  }
  return { root, bodyY, bodyH, color };
}

function buildVan(spec, opts, rng) {
  const root = new THREE.Group();
  const color = opts.color ?? spec.forceColor ?? rng.pick(CAR_COLORS);
  const bodyM = paint(color);
  const glassM = glass(0x101720, 0.55);
  const nose = spec.L / 2, tail = -spec.L / 2;
  const bodyH = spec.bodyH;
  const bodyY = spec.rideH + bodyH / 2;

  // One tall slab with a short raked nose.
  const main = box(spec.W, bodyH, spec.L - spec.nose, bodyM, 0, bodyY, -spec.nose / 2);
  root.add(main);
  const noseBlock = wedgeBox({ w: spec.W * 0.98, h: bodyH * 0.55, d: spec.nose + 0.4, mat: bodyM, topScaleZ: 0.55, topOffsetZ: -0.25 });
  noseBlock.position.set(0, spec.rideH + bodyH * 0.275, nose - spec.nose / 2 - 0.2);
  root.add(noseBlock);
  // Windshield + cab glass
  const ws = box(spec.W * 0.88, bodyH * 0.44, 0.06, glassM, 0, spec.rideH + bodyH * 0.72, nose - spec.nose - 0.06);
  ws.rotation.x = -0.18;
  root.add(ws);
  for (const s of [-1, 1]) {
    root.add(box(0.04, bodyH * 0.3, 1.2, glassM, s * (spec.W / 2 - 0.01), spec.rideH + bodyH * 0.7, nose - spec.nose - 0.75));
    if (spec.windows) {
      root.add(box(0.04, bodyH * 0.34, spec.L * 0.42, glassM, s * (spec.W / 2 - 0.01), spec.rideH + bodyH * 0.66, -spec.L * 0.16));
    }
  }
  // Rear doors + roof
  root.add(box(spec.W * 0.99, bodyH * 0.9, 0.06, mat(color, { roughness: 0.55 }), 0, bodyY, tail + 0.02));
  root.add(box(0.03, bodyH * 0.86, 0.08, mat(0x101116), 0, bodyY, tail + 0.05));
  root.add(box(spec.W * 0.96, 0.06, spec.L * 0.8, bodyM, 0, spec.rideH + bodyH, -spec.L * 0.08));
  if (spec.slider) {
    for (const s of [-1, 1]) root.add(box(0.02, bodyH * 0.8, 1.3, mat(0x000000, { transparent: true, opacity: 0.25 }), s * (spec.W / 2 + 0.006), bodyY, -0.1));
  }
  if (spec.livery) {
    const c = makeCanvas(512, 256); const x = c.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 512, 256);
    x.fillStyle = '#123c78'; x.font = 'bold 64px Arial'; x.textAlign = 'center';
    x.fillText(spec.livery, 256, 120);
    x.fillStyle = '#c0392b'; x.fillRect(96, 150, 320, 14);
    x.fillStyle = '#333'; x.font = '28px Arial'; x.fillText('SAME DAY · SKYVILLE', 256, 200);
    const tex = canvasTexture(c);
    for (const s of [-1, 1]) {
      const panel = box(0.02, 1.0, 2.0, texMat(tex), s * (spec.W / 2 + 0.01), bodyY, -0.3);
      panel.rotation.y = s > 0 ? 0 : Math.PI;
      root.add(panel);
    }
  }
  if (spec.mural) {
    for (const s of [-1, 1]) root.add(box(0.02, bodyH * 0.5, spec.L * 0.5, mat(0xe67e22), s * (spec.W / 2 + 0.008), bodyY + 0.1, -0.4));
  }
  const hoodPivot = new THREE.Group();
  hoodPivot.position.set(0, spec.rideH + bodyH * 0.5, nose - spec.nose - 0.05);
  hoodPivot.add(box(spec.W * 0.9, 0.08, spec.nose * 0.9, bodyM, 0, 0.02, spec.nose * 0.45));
  root.add(hoodPivot);
  root.userData.hood = hoodPivot;
  addEngineBay(hoodPivot, root, spec, spec.rideH + bodyH * 0.4, nose - spec.nose * 0.55, spec.nose * 0.9);
  addLightsAndBumpers(root, spec, opts, nose - 0.02, tail, spec.rideH + 0.42, 0.8);
  addMirrors(root, spec, spec.rideH + bodyH * 0.66, nose - spec.nose - 0.1);
  addPlate(root, spec, rng, nose + 0.02, spec.rideH + 0.3);
  addPlate(root, spec, rng, tail - 0.03, spec.rideH + 0.3);
  return { root, bodyY, bodyH, color };
}

function buildBoxTruck(spec, opts, rng) {
  const root = new THREE.Group();
  const color = opts.color ?? spec.forceColor ?? rng.pick(CAR_COLORS);
  const bodyM = paint(color);
  const glassM = glass(0x101720, 0.55);
  const nose = spec.L / 2, tail = -spec.L / 2;
  const bodyY = spec.rideH + spec.bodyH / 2;

  root.add(box(spec.W * 0.8, 0.24, spec.L * 0.96, mat(0x1c1e22), 0, spec.rideH * 0.7, 0));
  const cabZ = nose - spec.cabL / 2 - 0.1;
  root.add(box(spec.W * 0.94, spec.bodyH, spec.cabL + 0.5, bodyM, 0, bodyY, cabZ));
  const cabTopY = spec.rideH + spec.bodyH + spec.cabH / 2;
  const cab = rakedBox(spec.W * 0.92, spec.cabH, spec.cabL, 0.2, 0.02, bodyM);
  cab.position.set(0, cabTopY, cabZ);
  root.add(cab);
  const ws = box(spec.W * 0.84, spec.cabH * 0.96, 0.06, glassM, 0, cabTopY, cabZ + spec.cabL / 2 - 0.1);
  ws.rotation.x = -0.18;
  root.add(ws);
  for (const s of [-1, 1]) root.add(box(0.04, spec.cabH * 0.6, spec.cabL * 0.7, glassM, s * spec.W * 0.46, cabTopY, cabZ - 0.1));

  // Cargo box with corrugation + roll door
  const boxZ = cabZ - spec.cabL / 2 - spec.boxL / 2 - 0.25;
  const boxY = spec.rideH + 0.35 + spec.boxH / 2;
  const boxM = spec.icecream ? paint(0xf7f2e8) : mat(0xe8eaec, { roughness: 0.7 });
  root.add(box(spec.W, spec.boxH, spec.boxL, boxM, 0, boxY, boxZ));
  for (let i = 0; i < 10; i++) {
    root.add(box(spec.W * 1.005, 0.04, 0.05, mat(0xcfd2d6), 0, spec.rideH + 0.45 + i * (spec.boxH / 10), boxZ));
  }
  root.add(box(spec.W * 0.96, spec.boxH * 0.9, 0.08, mat(0xbfc3c8), 0, boxY, boxZ - spec.boxL / 2 - 0.02));
  root.add(box(spec.W, 0.16, spec.boxL, mat(0x2d2f34), 0, spec.rideH + 0.32, boxZ));
  if (spec.icecream) {
    const c = makeCanvas(512, 256); const x = c.getContext('2d');
    x.fillStyle = '#fff6e5'; x.fillRect(0, 0, 512, 256);
    x.fillStyle = '#e8546b'; x.font = 'bold 62px Arial'; x.textAlign = 'center'; x.fillText('SUNDAE', 256, 90);
    x.fillStyle = '#3d7dc4'; x.font = 'bold 44px Arial'; x.fillText('CRUISER', 256, 145);
    x.fillStyle = '#444'; x.font = '26px Arial'; x.fillText('SOFT SERVE · SHAKES · CONES', 256, 200);
    const tex = canvasTexture(c);
    for (const s of [-1, 1]) {
      const p = box(0.03, spec.boxH * 0.6, spec.boxL * 0.75, texMat(tex), s * (spec.W / 2 + 0.02), boxY, boxZ);
      p.rotation.y = s > 0 ? 0 : Math.PI;
      root.add(p);
    }
    root.add(cyl(0.35, 0.7, mat(0xf6e6c8), 0, spec.rideH + 0.35 + spec.boxH + 0.35, boxZ));
  }
  const hoodPivot = new THREE.Group();
  hoodPivot.position.set(0, bodyY + spec.bodyH * 0.4, cabZ + spec.cabL / 2);
  hoodPivot.add(box(spec.W * 0.85, 0.08, 0.5, bodyM, 0, 0, 0.25));
  root.add(hoodPivot);
  root.userData.hood = hoodPivot;
  addEngineBay(hoodPivot, root, spec, bodyY + spec.bodyH * 0.3, cabZ + spec.cabL / 2 + 0.28, 0.6);
  addLightsAndBumpers(root, spec, opts, nose, tail, spec.rideH + 0.45, 0.8);
  addMirrors(root, spec, cabTopY, cabZ + spec.cabL / 2 - 0.05);
  addPlate(root, spec, rng, nose + 0.03, spec.rideH + 0.32);
  return { root, bodyY, bodyH: spec.bodyH, color };
}

function buildBus(spec, opts, rng) {
  const root = new THREE.Group();
  const color = opts.color ?? spec.forceColor ?? 0xf0f2f4;
  const bodyM = paint(color);
  const glassM = glass(0x121a24, 0.5);
  const nose = spec.L / 2, tail = -spec.L / 2;
  const bodyY = spec.rideH + spec.bodyH / 2;
  root.add(box(spec.W, spec.bodyH, spec.L, bodyM, 0, bodyY, 0));
  root.add(box(spec.W * 1.01, 0.5, spec.L * 0.99, mat(0x2d6ea8), 0, spec.rideH + 0.3, 0));
  // Window strip both sides + a big windscreen.
  for (const s of [-1, 1]) root.add(box(0.05, spec.bodyH * 0.34, spec.L * 0.78, glassM, s * (spec.W / 2 - 0.01), spec.rideH + spec.bodyH * 0.66, -spec.L * 0.05));
  root.add(box(spec.W * 0.94, spec.bodyH * 0.42, 0.06, glassM, 0, spec.rideH + spec.bodyH * 0.62, nose - 0.03));
  root.add(box(spec.W * 0.9, spec.bodyH * 0.36, 0.06, glassM, 0, spec.rideH + spec.bodyH * 0.62, tail + 0.03));
  root.add(box(spec.W * 0.98, 0.08, spec.L * 0.96, bodyM, 0, spec.rideH + spec.bodyH, 0));
  root.add(box(1.2, 0.3, 0.05, mat(0x14161a, { emissive: 0x332200, emissiveIntensity: 0.6 }), 0, spec.rideH + spec.bodyH * 0.92, nose + 0.01));
  // Doors
  root.add(box(0.05, spec.bodyH * 0.7, 1.0, mat(0x1b1d22), spec.W / 2 + 0.005, spec.rideH + spec.bodyH * 0.42, nose - 1.6));
  addLightsAndBumpers(root, spec, opts, nose, tail, spec.rideH + 0.45, 0.8);
  addPlate(root, spec, rng, tail - 0.04, spec.rideH + 0.3);
  return { root, bodyY, bodyH: spec.bodyH, color };
}

function buildBike(spec, opts, rng) {
  const root = new THREE.Group();
  const color = opts.color ?? rng.pick(CAR_COLORS);
  const bodyM = paint(color);
  root.add(box(0.24, 0.3, 0.9, bodyM, 0, 0.68, 0.1));
  root.add(box(0.3, 0.18, 0.5, mat(0x18191d), 0, 0.86, -0.35));
  root.add(box(0.36, 0.34, 0.36, mat(0x5a5e66, { metalness: 0.6 }), 0, 0.5, 0.0));
  root.add(box(0.7, 0.06, 0.08, mat(0x24262b), 0, 0.95, 0.6));
  root.add(cyl(0.03, 0.7, mat(C.steel, { metalness: 0.7 }), 0.1, 0.62, 0.62));
  root.add(cyl(0.03, 0.7, mat(C.steel, { metalness: 0.7 }), -0.1, 0.62, 0.62));
  root.add(box(0.26, 0.2, 0.14, lightMat(C.headlight, 0.8), 0, 0.82, 0.68));
  root.add(box(0.16, 0.1, 0.06, lightMat(C.tail, 0.6), 0, 0.75, -0.62));
  root.userData.hood = null;
  return { root, bodyY: 0.6, bodyH: 0.6, color };
}

/* ------------------------------------------------------------------ factory */

let vehicleSeq = 1;

export function buildVehicle(specOrId, opts = {}) {
  const spec = typeof specOrId === 'string' ? VEHICLE_BY_ID[specOrId] : specOrId;
  if (!spec) throw new Error('unknown vehicle ' + specOrId);
  const rng = makeRng(opts.seed ?? (vehicleSeq++ * 7919 + 13));
  let built;
  switch (spec.family) {
    case 'pickup': built = buildPickup(spec, opts, rng); break;
    case 'van': built = buildVan(spec, opts, rng); break;
    case 'box': built = buildBoxTruck(spec, opts, rng); break;
    case 'bus': built = buildBus(spec, opts, rng); break;
    case 'bike': built = buildBike(spec, opts, rng); break;
    case 'tall': built = buildTall(spec, opts, rng); break;
    default: built = buildCar(spec, opts, rng);
  }
  const root = built.root;
  const wheels = spec.family === 'bike' ? buildBikeWheels(root, spec) : addWheels(root, spec, opts);
  root.userData.kind = 'vehicle';
  root.userData.spec = spec;
  root.userData.color = built.color;
  root.userData.wheels = wheels;
  root.userData.dims = { L: spec.L, W: spec.W, H: spec.rideH + (spec.bodyH ?? 1) + (spec.cabH ?? 0), wheelR: spec.wheelR };
  root.userData.hoodOpen = 0;
  root.userData.tiresOff = [];
  root.userData.jumped = false;
  root.name = 'vehicle:' + spec.id;

  if (opts.damage) applyDamage(root, spec, opts.damage, rng);
  return root;
}

function buildBikeWheels(root, spec) {
  const wheels = [];
  for (const [z, tag] of [[spec.wb / 2, 'FL'], [-spec.wb / 2, 'RL']]) {
    const w = buildWheel(spec.wheelR, 0.16, { rimColor: C.rimDark });
    w.position.set(0, spec.wheelR, z);
    w.userData.tag = tag; w.userData.baseY = spec.wheelR; w.userData.side = 0;
    root.add(w);
    wheels.push(w);
  }
  return wheels;
}

/* ------------------------------------------------------------------- damage */

export function applyDamage(root, spec, kind, rng = makeRng(7)) {
  const crumple = mat(0x2a2c31, { roughness: 1 });
  const shatter = mat(0xdfe6ea, { transparent: true, opacity: 0.75, roughness: 0.2 });
  const nose = spec.L / 2, tail = -spec.L / 2;
  const y = (spec.rideH ?? 0.3) + (spec.bodyH ?? 0.8) / 2;
  const add = (m) => root.add(m);

  if (kind === 'front' || kind === 'headon') {
    if (root.userData.hood) {
      root.userData.hood.rotation.x = -0.22;
      root.userData.hood.children.forEach((c) => { c.rotation.z = rng.range(-0.08, 0.08); });
    }
    add(box(spec.W * 0.95, 0.5, 0.3, crumple, 0, y, nose - 0.05));
    add(box(spec.W * 0.4, 0.2, 0.5, crumple, rng.range(-0.4, 0.4), y - 0.3, nose - 0.2));
    const hang = box(spec.W * 0.7, 0.16, 0.16, mat(0x1d1f24), 0.2, y - 0.55, nose + 0.05);
    hang.rotation.z = 0.3; add(hang);
    add(box(0.5, 0.4, 0.04, shatter, rng.range(-0.3, 0.3), y + 0.6, spec.cabZ != null ? spec.cabZ + 0.7 : 0.6));
    root.userData.leaking = true;
  } else if (kind === 'rear') {
    add(box(spec.W * 0.95, 0.45, 0.3, crumple, 0, y, tail + 0.05));
    const hang = box(spec.W * 0.8, 0.16, 0.16, mat(0x1d1f24), -0.2, y - 0.5, tail - 0.06);
    hang.rotation.z = -0.25; add(hang);
    add(box(spec.W * 0.6, 0.3, 0.04, shatter, 0, y + 0.55, tail + 0.35));
  } else if (kind === 'side') {
    const s = rng.chance(0.5) ? -1 : 1;
    add(box(0.16, 0.55, 1.4, crumple, s * (spec.W / 2 - 0.02), y, rng.range(-0.5, 0.5)));
    add(box(0.06, 0.4, 0.9, shatter, s * (spec.W / 2 + 0.01), y + 0.62, 0));
  } else if (kind === 'rollover') {
    root.rotation.z = Math.PI * (rng.chance(0.5) ? 0.52 : -0.52);
    root.position.y += spec.W * 0.35;
    add(box(spec.W * 0.9, 0.4, spec.L * 0.5, crumple, 0, y + 0.7, 0));
  } else if (kind === 'flat') {
    // handled by opts.flatTires
  }
  root.userData.damage = kind;
  return root;
}

export function setHoodOpen(vehicle, open) {
  const hood = vehicle.userData.hood;
  if (!hood) return;
  vehicle.userData.hoodOpen = open ? 1 : 0;
}

export function updateVehicleAnim(vehicle, dt) {
  const hood = vehicle.userData.hood;
  if (hood) {
    const target = vehicle.userData.hoodOpen ? -1.15 : (vehicle.userData.damage === 'front' ? -0.22 : 0);
    hood.rotation.x += (target - hood.rotation.x) * Math.min(1, dt * 6);
  }
}

// Pop a tire off. Returns the detached wheel group (now free-standing).
export function detachTire(vehicle, wheelGroup) {
  if (!wheelGroup || wheelGroup.userData.detached) return null;
  wheelGroup.userData.detached = true;
  vehicle.userData.tiresOff.push(wheelGroup.userData.tag);
  wheelGroup.userData.lugs?.forEach((l) => { l.visible = false; });
  const world = new THREE.Vector3();
  wheelGroup.getWorldPosition(world);
  vehicle.remove(wheelGroup);
  wheelGroup.position.copy(world);
  wheelGroup.rotation.set(0, 0, Math.PI / 2);
  return wheelGroup;
}

export const VEHICLE_COUNT = VEHICLES.length;
