// Rollback tow trucks: five cab/chassis models sharing one carrier design.
//
// Truck coordinates: +z forward, +x is the driver's (left) side, y up,
// z = 0 halfway between the axles. The bed lives in its own frame whose
// origin is the tilt pivot at the back of the subframe; tilting rotates the
// tail down and sliding pushes the whole deck back along its own axis.
import * as THREE from 'three';
import { buildCarModel, instantiate, projectSide } from './carbuilder.js';
import { buildWheel } from './wheels.js';
import * as M from '../materials.js';
import * as TX from '../textures.js';
import { LIVERIES, COMPANIES, doorTexture, bedSideTexture, headboardTexture } from './liveries.js';
import { makeCanvas, canvasTexture, roundRect } from '../util.js';

const deg = Math.PI / 180;

const tire19 = { tireR: 0.405, tireW: 0.225, rimR: 0.25 };
const tire16 = { tireR: 0.386, tireW: 0.215, rimR: 0.21 };
const tire22 = { tireR: 0.525, tireW: 0.28, rimR: 0.29 };

export const TRUCKS = [
  {
    id: 'f550', name: 'Ford F-550 Super Duty', blurb: '19.5 ft steel carrier, 6.7L Power Stroke diesel, regular cab.',
    wb: 4.9, tire: tire19, trackF: 0.9, trackR: 0.86, cabFront: 3.5, cabBack: 0.45,
    cab: { W: 2.03, H: 2.2, gc: 0.62, noseY: 1.28, hoodY: 1.56, beltF: 1.63, beltR: 1.63, hoodLen: 1.5, wsLen: 0.44, roofLen: 1.0,
      cornerF: 0.2, cornerR: 0.08, topR: 0.1, tumble: 0.1, head: 'rect', grille: 'chrome', grilleBox: { w: 1.02, h: 0.5, y: 1.02 }, headlight: { w: 0.4, h: 0.26, x: 0.74, y: 1.14 } },
    floorY: 0.86, seatY: 1.22, eyeY: 1.95,
    frameTop: 0.92, bed: { len: 5.95, width: 2.44, front: 0.3, deckTop: 1.25, pivotZ: -3.5, pivotY: 1.07 },
    toolbox: { z0: -0.36, z1: -1.62, y0: 0.5, y1: 1.06 }, controlZ: -0.12,
    mass: 6400, engine: 15500, topSpeed: 34, exhaust: 'side', rim: 'truck',
  },
  {
    id: 'ram5500', name: 'Ram 5500 HD', blurb: '20 ft aluminum carrier, Cummins diesel, big crosshair grille.',
    wb: 4.95, tire: tire19, trackF: 0.9, trackR: 0.86, cabFront: 3.56, cabBack: 0.47,
    cab: { W: 2.05, H: 2.24, gc: 0.64, noseY: 1.38, hoodY: 1.62, beltF: 1.68, beltR: 1.68, hoodLen: 1.52, wsLen: 0.42, roofLen: 1.0,
      cornerF: 0.24, cornerR: 0.08, topR: 0.11, tumble: 0.1, head: 'rect', grille: 'mesh', grilleBox: { w: 1.18, h: 0.56, y: 1.08 }, headlight: { w: 0.34, h: 0.3, x: 0.76, y: 1.2 } },
    floorY: 0.88, seatY: 1.25, eyeY: 1.98,
    frameTop: 0.93, bed: { len: 6.1, width: 2.44, front: 0.32, deckTop: 1.26, pivotZ: -3.55, pivotY: 1.08 },
    toolbox: { z0: -0.36, z1: -1.62, y0: 0.5, y1: 1.06 }, controlZ: -0.12,
    mass: 6600, engine: 16500, topSpeed: 35, exhaust: 'side', rim: 'truck',
  },
  {
    id: 'npr', name: 'Isuzu NPR-HD Cab-Over', blurb: 'City cab-over, tight turning circle, 18 ft carrier.',
    wb: 4.5, tire: tire16, trackF: 0.83, trackR: 0.8, cabFront: 3.35, cabBack: 1.55,
    cab: { W: 2.0, H: 2.36, gc: 0.5, noseY: 0.95, hoodY: 1.24, beltF: 1.34, beltR: 1.4, hoodLen: 0.12, wsLen: 0.3, roofLen: 1.3,
      cornerF: 0.14, cornerR: 0.05, topR: 0.13, tumble: 0.06, head: 'rect', grille: 'bars', grilleBox: { w: 1.1, h: 0.3, y: 0.96 }, headlight: { w: 0.38, h: 0.2, x: 0.73, y: 0.8 }, fo: 1.1 },
    floorY: 1.0, seatY: 1.36, eyeY: 2.08,
    frameTop: 0.86, bed: { len: 5.5, width: 2.4, front: 1.45, deckTop: 1.16, pivotZ: -2.95, pivotY: 1.0 },
    toolbox: { z0: 1.2, z1: -0.1, y0: 0.46, y1: 0.98 }, controlZ: 1.38,
    mass: 5400, engine: 12500, topSpeed: 31, exhaust: 'side', rim: 'steel', cabover: true,
  },
  {
    id: 'intl', name: 'International MV607', blurb: 'Medium duty, 22 ft carrier, air brakes, roomy crew of one.',
    wb: 5.6, tire: tire22, trackF: 1.02, trackR: 0.92, cabFront: 3.95, cabBack: 1.0,
    cab: { W: 2.3, H: 2.78, gc: 0.78, noseY: 1.26, hoodY: 1.7, beltF: 1.88, beltR: 1.88, hoodLen: 1.45, wsLen: 0.36, roofLen: 0.74,
      cornerF: 0.26, cornerR: 0.08, topR: 0.12, tumble: 0.1, head: 'swept', grille: 'mesh', grilleBox: { w: 1.0, h: 0.62, y: 1.2 }, headlight: { w: 0.42, h: 0.22, x: 0.86, y: 1.32 } },
    floorY: 1.3, seatY: 1.68, eyeY: 2.4,
    frameTop: 1.06, bed: { len: 6.5, width: 2.44, front: 0.86, deckTop: 1.42, pivotZ: -4.1, pivotY: 1.24 },
    toolbox: { z0: 0.6, z1: -1.0, y0: 0.62, y1: 1.2 }, controlZ: 0.76,
    mass: 9800, engine: 26000, topSpeed: 32, exhaust: 'side', rim: 'truck',
  },
  {
    id: 'pete', name: 'Peterbilt 337', blurb: 'Square-nose medium duty, chrome stack, 22 ft carrier.',
    wb: 5.6, tire: tire22, trackF: 1.02, trackR: 0.92, cabFront: 4.05, cabBack: 1.0,
    cab: { W: 2.3, H: 2.86, gc: 0.8, noseY: 1.46, hoodY: 1.8, beltF: 1.92, beltR: 1.92, hoodLen: 1.62, wsLen: 0.28, roofLen: 0.76,
      cornerF: 0.1, cornerR: 0.06, topR: 0.08, tumble: 0.05, head: 'rect', grille: 'chrome', grilleBox: { w: 1.02, h: 0.78, y: 1.22 }, headlight: { w: 0.36, h: 0.2, x: 0.9, y: 1.36 }, crown: 0.01 },
    floorY: 1.32, seatY: 1.7, eyeY: 2.42,
    frameTop: 1.06, bed: { len: 6.5, width: 2.44, front: 0.86, deckTop: 1.42, pivotZ: -4.1, pivotY: 1.24 },
    toolbox: { z0: 0.6, z1: -1.0, y0: 0.62, y1: 1.2 }, controlZ: 0.76,
    mass: 10200, engine: 27000, topSpeed: 32, exhaust: 'stack', rim: 'truck',
  },
];
for (const t of TRUCKS) {
  t.frontZ = t.wb / 2;
  t.rearZ = -t.wb / 2;
  t.maxTilt = 12.5 * deg;
  const b = t.bed;
  b.rear = b.front - b.len;
  b.deckY = b.deckTop - b.pivotY;        // deck surface in bed-local
  b.zFront = b.front - b.pivotZ;          // bed-local front edge
  b.zRear = b.rear - b.pivotZ;            // bed-local tail edge (negative)
  b.slideMax = (b.pivotY - 0.02) / Math.sin(t.maxTilt) + b.zRear;
}
export const TRUCK_BY_ID = Object.fromEntries(TRUCKS.map((t) => [t.id, t]));

// --------------------------------------------------------- tiny builders

function box(w, h, d, mat, x, y, z, parent, opts = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = opts.cast ?? true;
  m.receiveShadow = true;
  if (opts.rx) m.rotation.x = opts.rx;
  if (opts.ry) m.rotation.y = opts.ry;
  if (opts.rz) m.rotation.z = opts.rz;
  parent.add(m);
  return m;
}
function cyl(rt, rb, h, mat, x, y, z, parent, axis = 'y', seg = 20) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

// ------------------------------------------------------------- builder

const cabModels = new Map();

function cabSpec(t) {
  const c = t.cab;
  const L = t.cabFront - t.cabBack;
  const L2 = L / 2;
  const zW = L2 - c.hoodLen;
  // The back of a cab is a near-vertical wall: the roof runs right to it.
  const roofLen = L - c.hoodLen - c.wsLen - 0.12;
  const s = {
    name: t.id + '-cab', style: 'cab', L, W: c.W, H: c.H, gc: c.gc,
    wb: 30, fo: c.fo ?? (t.cabFront - t.frontZ),
    tireR: t.tire.tireR, tireW: t.tire.tireW, rimR: t.tire.rimR, archGap: 0.07,
    noseY: c.noseY, hoodY: c.hoodY, beltF: c.beltF, beltR: c.beltR, deckY: c.beltR, tailY: c.beltR,
    zW, zR1: zW - c.wsLen, zR2: zW - c.wsLen - roofLen, zB: -L2 + 0.04,
    cornerF: c.cornerF, cornerR: c.cornerR, topR: c.topR, tumble: c.tumble, tuck: 0.03, crown: c.crown ?? 0.02, roofCrown: 0.01,
    head: c.head, grille: c.grille, grilleBox: c.grilleBox, headlight: c.headlight,
    hoodFront: L2 - 0.15, bPillar: 99,
    noWheels: true, noBay: true, noTail: true, noMirrors: true, noExhaust: true, antenna: false,
    plateFront: true,
  };
  if (t.cabover) {
    s.hoodFront = L2 - 0.02;
  }
  return s;
}

export function getCabModel(t) {
  if (!cabModels.has(t.id)) cabModels.set(t.id, buildCarModel(cabSpec(t)));
  return cabModels.get(t.id);
}

/**
 * Builds a complete tow truck for `truck` in `livery`. Returns the scene
 * graph plus handles the runtime animates (bed, levers, doors, lights).
 */
export function buildTowTruck(t, liveryIndex = 0) {
  const liv = LIVERIES[t.id][liveryIndex] ?? LIVERIES[t.id][0];
  const root = new THREE.Group();
  root.name = 'towtruck';
  const cabCenter = (t.cabFront + t.cabBack) / 2;

  // ---- cab shell (lofted like the cars, with see-through glass)
  const cabModel = getCabModel(t);
  const cab = instantiate(cabModel, { color: liv.cab, metallic: liv.metallic, plate: 'TOW ' + (100 + liveryIndex * 37) });
  cab.root.position.z = cabCenter;
  root.add(cab.root);
  const wipers = [];
  cab.root.traverse((o) => { if (o.userData.part === 'wiperPivot') wipers.push(o); });
  // The shell's inside faces get door-panel plastic and headliner instead of
  // showing the exterior paint from within.
  const cabTrim = new THREE.MeshStandardMaterial({ color: 0x3b3e42, roughness: 0.88, metalness: 0, side: THREE.BackSide });
  const shell = [];
  cab.root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.material === cab.paint) shell.push(o);
    if (o.userData.slot === 'glass') { o.material = M.glassClear(); o.castShadow = false; o.renderOrder = 2; }
    if (o.userData.slot === 'black') o.material = M.glossBlack();
  });
  for (const o of shell) {
    const inside = new THREE.Mesh(o.geometry, cabTrim);
    inside.receiveShadow = true;
    o.add(inside);
  }
  // Door lettering.
  const cs = cabModel.spec;
  const doorZc = (cs.zW - 0.06 + cs.zB + 0.12) / 2;
  const doorW = Math.min(1.25, (cs.zW - 0.06) - (cs.zB + 0.12) - 0.08);
  const doorMat = new THREE.MeshStandardMaterial({ map: doorTexture(liv), transparent: true, roughness: 0.35, metalness: 0.0, polygonOffset: true, polygonOffsetFactor: -2 });
  for (const side of [1, -1]) {
    const g = projectSide(cabModel.surface, { cz: doorZc, cy: cs.beltF - 0.34, w: doorW, h: doorW * 0.5, side, offset: 0.006 });
    const m = new THREE.Mesh(g, doorMat);
    m.position.z = cabCenter;
    root.add(m);
  }

  // ---- big tow mirrors on arms
  const mirrorParts = [];
  for (const side of [1, -1]) {
    const zM = cabCenter + cs.zW - 0.05;
    const yM = cs.beltF + 0.22;
    const xM = side * (t.cab.W / 2 + 0.22);
    const arm = cyl(0.014, 0.014, 0.32, M.chrome(), side * (t.cab.W / 2 + 0.1), yM - 0.12, zM, root, 'x', 10);
    arm.rotation.z = side * 0.25;
    const arm2 = cyl(0.014, 0.014, 0.3, M.chrome(), side * (t.cab.W / 2 + 0.1), yM + 0.2, zM, root, 'x', 10);
    const head = box(0.2, 0.36, 0.08, M.glossBlack(), xM, yM + 0.04, zM, root);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.32), M.chrome());
    glass.position.set(xM, yM + 0.04, zM - 0.042);
    glass.rotation.y = Math.PI;
    root.add(glass);
    const convex = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.chrome());
    convex.rotation.x = -Math.PI / 2;
    convex.scale.set(1, 0.4, 1);
    convex.position.set(xM, yM - 0.2, zM - 0.02);
    root.add(convex);
    mirrorParts.push(head, glass);
  }

  // ---- chassis: frame rails, axles, tanks, steps
  const frame = new THREE.Group();
  root.add(frame);
  const frameLen = t.cabFront - 0.25 - (t.bed.pivotZ - 0.15);
  const frameZ = (t.cabFront - 0.25 + t.bed.pivotZ - 0.15) / 2;
  for (const side of [1, -1]) box(0.075, 0.26, frameLen, M.frameBlack(), side * 0.44, t.frameTop - 0.13, frameZ, frame);
  for (let z = t.bed.pivotZ + 0.2; z < t.cabFront - 0.6; z += 1.1) box(0.82, 0.18, 0.08, M.frameBlack(), 0, t.frameTop - 0.14, z, frame);
  // Front bumper & tow hooks.
  const bumperMat = t.id === 'pete' || t.id === 'f550' ? M.chrome() : M.frameBlack();
  box(t.cab.W + 0.02, 0.24, 0.18, bumperMat, 0, t.cab.gc + 0.02, t.cabFront + 0.04, root);
  for (const side of [1, -1]) {
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.016, 8, 16, Math.PI * 1.3), M.std(0xc0161a, 0.4, 0.3));
    hook.position.set(side * 0.38, t.cab.gc - 0.12, t.cabFront + 0.02);
    hook.rotation.y = Math.PI / 2;
    root.add(hook);
  }
  // Axles.
  cyl(0.06, 0.06, t.trackF * 2 - 0.2, M.frameBlack(), 0, t.tire.tireR, t.frontZ, frame, 'x');
  cyl(0.075, 0.075, t.trackR * 2 - 0.1, M.frameBlack(), 0, t.tire.tireR, t.rearZ, frame, 'x');
  const diff = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), M.frameBlack());
  diff.scale.set(1, 0.9, 1.15);
  diff.position.set(0, t.tire.tireR, t.rearZ + 0.05);
  frame.add(diff);
  cyl(0.045, 0.045, Math.abs(t.frontZ - t.rearZ) - 1.4, M.darkSteel(), 0, t.tire.tireR + 0.05, (t.frontZ + t.rearZ) / 2 - 0.3, frame, 'z');
  // Leaf springs.
  for (const z of [t.frontZ, t.rearZ]) for (const side of [1, -1]) {
    const leaf = box(0.07, 0.07, 1.25, M.darkSteel(), side * 0.44, t.tire.tireR + 0.1, z, frame);
    leaf.scale.y = 1;
  }
  // Fuel tank on the passenger side, steps/battery box on the driver side.
  const tankZ = t.cabBack - 0.55;
  const tank = cyl(0.27, 0.27, 0.95, M.satinMetal(), -0.82, t.frameTop - 0.35, tankZ, frame, 'z', 28);
  for (const dz of [-0.3, 0.3]) {
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.275, 0.012, 6, 32), M.frameBlack());
    strap.position.set(-0.82, t.frameTop - 0.35, tankZ + dz);
    frame.add(strap);
  }
  if (!t.cabover) {
    // Cab step under the doors.
    for (const side of [1, -1]) {
      const stepMat = new THREE.MeshStandardMaterial({ ...TX.cloneSet(TX.diamondPlate(), 2, 1), metalness: 1, roughness: 0.35 });
      box(0.24, 0.035, 0.7, stepMat, side * (t.cab.W / 2 - 0.08), t.cab.gc - 0.1, cabCenter - 0.25, root);
    }
  } else {
    for (const side of [1, -1]) {
      const stepMat = new THREE.MeshStandardMaterial({ ...TX.cloneSet(TX.diamondPlate(), 2, 1), metalness: 1, roughness: 0.35 });
      box(0.2, 0.03, 0.5, stepMat, side * (t.cab.W / 2 - 0.12), 0.42, t.frontZ - 0.62, root);
    }
  }
  // Exhaust.
  if (t.exhaust === 'stack') {
    const stack = cyl(0.065, 0.065, 2.0, M.chrome(), 1.0, t.frameTop + 0.95, t.cabBack - 0.18, root, 'y', 20);
    const heat = cyl(0.085, 0.085, 0.8, M.std(0x1a1a1a, 0.4, 0.8), 1.0, t.frameTop + 0.6, t.cabBack - 0.18, root, 'y', 20);
    stack.userData.exhaust = true;
    heat.castShadow = true;
  } else {
    cyl(0.045, 0.045, 1.4, M.darkSteel(), -0.55, 0.5, t.cabBack - 0.9, frame, 'z', 12);
  }

  // ---- wheels: steerable fronts, duals at the back
  const wheels = [];
  const wOpts = { ...t.tire, style: t.rim, rimColor: t.rim === 'steel' ? 0xe8e8e6 : 0xd9dbde, tread: 2, lugs: 8 };
  for (const side of [1, -1]) {
    const f = buildWheel(wOpts, side);
    f.pivot.position.set(side * t.trackF, t.tire.tireR, t.frontZ);
    root.add(f.pivot);
    wheels.push({ ...f, front: true, side, z: t.frontZ, x: side * t.trackF });
    const r = buildWheel({ ...wOpts, dual: true }, side);
    r.pivot.position.set(side * t.trackR, t.tire.tireR, t.rearZ);
    root.add(r.pivot);
    wheels.push({ ...r, front: false, side, z: t.rearZ, x: side * t.trackR });
  }

  // ---- fenders over the duals, mud flaps
  for (const side of [1, -1]) {
    const fg = new THREE.CylinderGeometry(t.tire.tireR + 0.07, t.tire.tireR + 0.07, 0.62, 24, 1, true, -Math.PI / 2, Math.PI);
    fg.rotateZ(Math.PI / 2);
    fg.rotateX(-Math.PI / 2);
    const fender = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ ...TX.cloneSet(TX.diamondPlate(), 2, 3), metalness: 1, roughness: 0.3, side: THREE.DoubleSide }));
    fender.position.set(side * (t.trackR - 0.12), t.tire.tireR, t.rearZ);
    fender.castShadow = true;
    root.add(fender);
    const flap = box(0.58, 0.5, 0.012, M.rubber(), side * (t.trackR - 0.12), t.tire.tireR * 0.62, t.rearZ - t.tire.tireR - 0.16, root);
    flap.userData.mudflap = true;
  }

  // ---- toolboxes under the bed (aluminum diamond plate, drop-down doors)
  const toolboxes = [];
  const tb = t.toolbox;
  const dp = TX.diamondPlate();
  for (const side of [1, -1]) {
    const len = tb.z0 - tb.z1;
    const zc = (tb.z0 + tb.z1) / 2;
    const h = tb.y1 - tb.y0;
    const depth = 0.46;
    const xOut = side * (t.bed.width / 2 - 0.02);
    const xc = xOut - side * depth / 2;
    const group = new THREE.Group();
    root.add(group);
    const mat = new THREE.MeshStandardMaterial({ ...TX.cloneSet(dp, len / 0.6, h / 0.6), metalness: 1, roughness: 0.3 });
    const shell = new THREE.Group();
    group.add(shell);
    // Shell: back, top, bottom, ends (open on the outboard face).
    box(0.012, h, len, mat, xOut - side * depth, tb.y0 + h / 2, zc, shell);
    box(depth, 0.012, len, mat, xc, tb.y1, zc, shell);
    box(depth, 0.012, len, mat, xc, tb.y0, zc, shell);
    box(depth, h, 0.012, mat, xc, tb.y0 + h / 2, tb.z0, shell);
    box(depth, h, 0.012, mat, xc, tb.y0 + h / 2, tb.z1, shell);
    // Dark interior liner and a shelf.
    const liner = box(depth - 0.03, h - 0.03, len - 0.03, M.std(0x15161a, 0.9), xc, tb.y0 + h / 2, zc, shell);
    liner.material = liner.material.clone();
    liner.material.side = THREE.BackSide;
    box(depth - 0.04, 0.01, len - 0.04, mat, xc, tb.y0 + h * 0.48, zc, shell);
    // Door hinged along the bottom outboard edge.
    const doorPivot = new THREE.Group();
    doorPivot.position.set(xOut, tb.y0, zc);
    group.add(doorPivot);
    const door = box(0.014, h, len - 0.01, mat, 0, h / 2, 0, doorPivot);
    door.userData.part = 'toolboxDoor';
    door.userData.side = side;
    // Stainless T-handle latch.
    const latch = box(0.03, 0.05, 0.16, M.chrome(), side * 0.012, h - 0.09, 0, doorPivot);
    latch.userData.part = 'toolboxDoor';
    latch.userData.side = side;
    // Brackets to frame.
    box(Math.abs(xOut) - 0.48 - depth, 0.06, 0.08, M.frameBlack(), side * (0.48 + (Math.abs(xOut) - depth - 0.48) / 2), tb.y1 - 0.04, tb.z0 - 0.15, root);
    box(Math.abs(xOut) - 0.48 - depth, 0.06, 0.08, M.frameBlack(), side * (0.48 + (Math.abs(xOut) - depth - 0.48) / 2), tb.y1 - 0.04, tb.z1 + 0.15, root);
    toolboxes.push({
      side, group, doorPivot, door, latch, open: 0, target: 0,
      // Where items sit inside (truck coords): bottom shelf and middle shelf.
      slots: [
        new THREE.Vector3(xc + side * 0.02, tb.y0 + 0.02, zc + len * 0.25),
        new THREE.Vector3(xc + side * 0.02, tb.y0 + 0.02, zc - len * 0.25),
        new THREE.Vector3(xc + side * 0.02, tb.y0 + h * 0.48 + 0.01, zc),
      ],
      center: new THREE.Vector3(xOut, tb.y0 + h / 2, zc),
      dims: { len, h, depth },
    });
  }

  // ---- control station (driver side, behind the cab)
  const controls = buildControlStation(t, root, liv);

  // ---- subframe & tilt rams (fixed)
  const sub = new THREE.Group();
  root.add(sub);
  const subLen = t.bed.front - 0.1 - t.bed.pivotZ;
  for (const side of [1, -1]) box(0.09, 0.12, subLen, M.frameBlack(), side * 0.46, t.frameTop + 0.06, t.bed.pivotZ + subLen / 2, sub);
  cyl(0.08, 0.08, 1.02, M.darkSteel(), 0, t.bed.pivotY, t.bed.pivotZ, sub, 'x');
  const rams = [];
  for (const side of [1, -1]) {
    const barrel = cyl(0.06, 0.06, 1, M.std(0x1a1b1d, 0.4, 0.6), 0, 0, 0, root);
    const rod = cyl(0.03, 0.03, 1, M.chrome(), 0, 0, 0, root);
    rams.push({ side, barrel, rod, base: new THREE.Vector3(side * 0.3, t.frameTop + 0.05, t.bed.pivotZ + 2.2) });
  }

  // ---- the carrier bed
  const bed = buildBed(t, liv);
  root.add(bed.pivot);

  // ---- ELS: roof light bar, grille and rear strobes
  const els = buildELS(t, root, bed, cabCenter);

  // ---- lamps
  const headMat = cab.headMat;
  const tailMat = bed.tailMat;
  // One wide spot stands in for both headlamps, one for the deck work
  // lights: every extra light costs every pixel on screen.
  const headSpots = [];
  {
    const sp = new THREE.SpotLight(0xfff3df, 0, 80, 0.62, 0.6, 1.3);
    const hy = t.cab.headlight.y;
    sp.position.set(0, hy, t.cabFront + 0.1);
    sp.target.position.set(0, hy - 1.4, t.cabFront + 20);
    root.add(sp, sp.target);
    headSpots.push(sp);
  }
  const work = [];
  {
    const wl = new THREE.SpotLight(0xf4f7ff, 0, 16, 0.9, 0.6, 1.2);
    bed.slideG.add(wl, wl.target);
    wl.position.set(0, bed.deckY + 1.3, bed.zFront - 0.15);
    wl.target.position.set(0, bed.deckY, bed.zFront - 4.5);
    work.push(wl);
  }

  // Shadows on, but keep tiny bits from casting.
  root.traverse((o) => { if (o.isMesh && o.geometry.boundingSphere === null) o.geometry.computeBoundingSphere(); });

  return {
    spec: t, livery: liv, liveryIndex, root, cab, cabCenter, wheels, toolboxes, controls, bed, rams, els,
    lamps: { headMat, tailMat, headSpots, work, reverse: bed.reverseMat, brake: bed.tailMat },
    mirrors: mirrorParts, wipers,
  };
}

// ------------------------------------------------------------ the bed

function buildBed(t, liv) {
  const b = t.bed;
  const pivot = new THREE.Group();       // fixed at the pivot point (truck coords)
  pivot.position.set(0, b.pivotY, b.pivotZ);
  const tiltG = new THREE.Group();       // rotates about X
  pivot.add(tiltG);
  const slideG = new THREE.Group();      // translates along local -Z
  tiltG.add(slideG);

  const W = b.width;
  const deckY = b.deckY;
  const zF = b.zFront, zR = b.zRear;
  const tailLen = 0.5;
  const mainLen = zF - (zR + tailLen);
  const mainZ = (zF + zR + tailLen) / 2;

  // Deck surface: steel slat deck with a fine anti-slip texture.
  const deckSet = TX.cloneSet(TX.diamondPlate(), W / 0.6, mainLen / 0.6);
  const deckMat = new THREE.MeshStandardMaterial({ ...deckSet, color: 0x80838a, metalness: 0.8, roughness: 0.78 });
  const deck = box(W, 0.05, mainLen, deckMat, 0, deckY - 0.025, mainZ, slideG);
  deck.userData.part = 'deck';
  // Tapered tail section.
  const tailShape = new THREE.Shape();
  tailShape.moveTo(0, 0);
  tailShape.lineTo(tailLen, 0);
  tailShape.lineTo(tailLen, -0.05);
  tailShape.lineTo(0.08, -deckY + 0.03);
  tailShape.lineTo(0, -deckY + 0.03);
  tailShape.lineTo(0, 0);
  const tailGeo = new THREE.ExtrudeGeometry(tailShape, { depth: W, bevelEnabled: false });
  tailGeo.rotateY(-Math.PI / 2);
  tailGeo.translate(W / 2, deckY, zR);
  const tail = new THREE.Mesh(tailGeo, deckMat);
  tail.castShadow = true; tail.receiveShadow = true;
  tail.userData.part = 'deck';
  slideG.add(tail);
  // Tail rollers.
  for (const side of [1, -1]) cyl(0.055, 0.055, 0.5, M.darkSteel(), side * 0.65, 0.07, zR + 0.06, slideG, 'x', 16);
  // Side rails (C-channel) with livery fascia.
  const railMat = new THREE.MeshStandardMaterial({ color: liv.bed, metalness: 0.3, roughness: 0.4 });
  const bedTex = bedSideTexture(liv);
  const fasciaMat = new THREE.MeshStandardMaterial({ map: bedTex, metalness: 0.2, roughness: 0.4 });
  const railLen = zF - zR - 0.1;
  const railZ = (zF + zR + 0.1) / 2;
  const anchors = [];
  for (const side of [1, -1]) {
    const x = side * (W / 2 + 0.03);
    box(0.06, 0.22, railLen, railMat, x, deckY - 0.08, railZ, slideG);
    const fascia = new THREE.Mesh(new THREE.PlaneGeometry(railLen, 0.2), fasciaMat);
    fascia.position.set(x + side * 0.031, deckY - 0.08, railZ);
    fascia.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    slideG.add(fascia);
    // Rub rail lip on top.
    box(0.09, 0.03, railLen, M.darkSteel(), x - side * 0.01, deckY + 0.015, railZ, slideG);
    // Strap/chain tie-down slots every 0.42 m along the top of each rail.
    for (let z = zR + 0.7; z < zF - 0.4; z += 0.42) {
      const slot = box(0.05, 0.012, 0.11, M.std(0x050505, 0.9), x - side * 0.01, deckY + 0.032, z, slideG, { cast: false });
      slot.userData.part = 'anchor';
      slot.userData.anchor = anchors.length;
      // The slot is a few centimeters across; give the crosshair more to land on.
      const grab = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.24), M.pickProxy);
      grab.userData = { part: 'anchor', anchor: anchors.length };
      slot.add(grab);
      anchors.push({ side, local: new THREE.Vector3(x - side * 0.01, deckY + 0.035, z), mesh: slot, used: false });
    }
  }
  // Cross members under the deck.
  for (let z = zR + 0.6; z < zF; z += 0.7) box(W - 0.1, 0.1, 0.07, M.frameBlack(), 0, deckY - 0.11, z, slideG);
  // Longitudinal subrails the bed slides on.
  for (const side of [1, -1]) box(0.1, 0.14, zF - zR - 0.6, M.frameBlack(), side * 0.46, deckY - 0.16, (zF + zR + 0.6) / 2, slideG);

  // Headboard (cab protector): frame posts, mesh, top bar.
  const hbH = 1.15;
  const hbZ = zF - 0.04;
  const hbMat = new THREE.MeshStandardMaterial({ color: liv.bed, metalness: 0.35, roughness: 0.4 });
  for (const side of [1, -1]) box(0.08, hbH, 0.08, hbMat, side * (W / 2 - 0.04), deckY + hbH / 2, hbZ, slideG);
  box(W, 0.1, 0.1, hbMat, 0, deckY + hbH, hbZ, slideG);
  box(W, 0.08, 0.08, hbMat, 0, deckY + 0.04, hbZ, slideG);
  const meshTex = (() => {
    const c = makeCanvas(256, 256);
    const g = c.getContext('2d');
    g.clearRect(0, 0, 256, 256);
    g.strokeStyle = '#d9d9d9';
    g.lineWidth = 6;
    for (let i = -256; i < 512; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 256, 256); g.stroke(); g.beginPath(); g.moveTo(i + 256, 0); g.lineTo(i, 256); g.stroke(); }
    const t2 = canvasTexture(c, { repeat: true });
    t2.repeat.set(8, 4);
    return t2;
  })();
  const meshPanel = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.1, hbH - 0.12), new THREE.MeshStandardMaterial({ map: meshTex, color: liv.bed === '#16171a' ? 0x8a8d92 : 0x9fa3a8, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, metalness: 0.8, roughness: 0.4 }));
  meshPanel.position.set(0, deckY + hbH / 2 + 0.02, hbZ);
  slideG.add(meshPanel);
  // Company sign on the back of the headboard top.
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.6, 0.26), new THREE.MeshStandardMaterial({ map: headboardTexture(liv), roughness: 0.4 }));
  sign.position.set(0, deckY + hbH - 0.2, hbZ - 0.06);
  sign.rotation.y = Math.PI;
  slideG.add(sign);

  // Winch: hydraulic planetary winch under the headboard.
  const winch = new THREE.Group();
  winch.position.set(0, deckY + 0.16, zF - 0.32);
  slideG.add(winch);
  const drum = cyl(0.12, 0.12, 0.42, M.std(0x8a1a1a, 0.5, 0.5), 0, 0, 0, winch, 'x', 24);
  cyl(0.15, 0.15, 0.05, M.frameBlack(), 0.24, 0, 0, winch, 'x', 24);
  cyl(0.15, 0.15, 0.05, M.frameBlack(), -0.24, 0, 0, winch, 'x', 24);
  cyl(0.09, 0.09, 0.22, M.std(0x202124, 0.4, 0.7), 0.4, 0, 0, winch, 'x', 18);
  box(0.6, 0.06, 0.4, M.frameBlack(), 0, -0.14, 0, winch);
  // Cable wraps on the drum.
  const wraps = cyl(0.135, 0.135, 0.36, M.std(0x5d6066, 0.45, 0.9), 0, 0, 0, winch, 'x', 24);
  wraps.userData.part = 'winchDrum';
  drum.userData.part = 'winchDrum';
  // Fairlead roller just behind the drum.
  const fair = cyl(0.03, 0.03, 0.24, M.chrome(), 0, -0.06, -0.24, winch, 'x', 12);

  // Rear lights: stop/tail/turn, reverse, plate.
  const tailMat = M.lightLens('tail');
  const reverseMat = M.lightLens('reverse');
  const plateMat = new THREE.MeshStandardMaterial({ map: plateTex('TOW ' + COMPANIES[liv.company].phone.slice(-4)), roughness: 0.4 });
  for (const side of [1, -1]) {
    const lamp = cyl(0.06, 0.06, 0.03, tailMat, side * (W / 2 - 0.18), deckY - 0.12, zR + 0.48, slideG, 'z', 20);
    lamp.rotation.y = Math.PI;
    const lamp2 = cyl(0.06, 0.06, 0.03, tailMat, side * (W / 2 - 0.36), deckY - 0.12, zR + 0.48, slideG, 'z', 20);
    const rev = cyl(0.04, 0.04, 0.03, reverseMat, side * (W / 2 - 0.52), deckY - 0.12, zR + 0.48, slideG, 'z', 16);
    box(0.62, 0.18, 0.06, M.frameBlack(), side * (W / 2 - 0.36), deckY - 0.12, zR + 0.52, slideG);
    // Amber side markers along the rails.
    for (const z of [zR + 1.0, (zR + zF) / 2, zF - 0.6]) {
      const mk = box(0.012, 0.035, 0.08, M.lightLens('amber'), side * (W / 2 + 0.065), deckY - 0.08, z, slideG, { cast: false });
      mk.userData.marker = true;
    }
  }
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.305, 0.152), plateMat);
  plate.position.set(0, deckY - 0.12, zR + 0.44);
  plate.rotation.y = Math.PI;
  slideG.add(plate);
  // Stowed wheel-lift under the tail.
  box(0.24, 0.16, 1.4, M.std(0x1b1c1e, 0.5, 0.4), 0, -0.05, zR + 1.2, slideG);
  box(1.5, 0.12, 0.16, M.std(0x1b1c1e, 0.5, 0.4), 0, -0.05, zR + 0.55, slideG);

  return {
    pivot, tiltG, slideG, deckY, zFront: zF, zRear: zR, width: W, anchors, tailMat, reverseMat,
    winch, winchPoint: new THREE.Vector3(0, deckY + 0.1, zF - 0.56), deck, tail,
    tilt: 0, slide: 0,
  };
}

function plateTex(text) {
  const c = makeCanvas(256, 128);
  const g = c.getContext('2d');
  g.fillStyle = '#f4f3ee'; roundRect(g, 0, 0, 256, 128, 10); g.fill();
  g.fillStyle = '#1d3d8f'; g.textAlign = 'center';
  g.font = 'bold 18px Arial'; g.fillText('SKYVILLE  ·  TOW', 128, 26);
  g.font = 'bold 60px "Arial Narrow", Arial'; g.fillText(text, 128, 96);
  return canvasTexture(c, { aniso: 4 });
}

// --------------------------------------------------------- control box

function controlPanelTexture() {
  const c = makeCanvas(512, 512);
  const g = c.getContext('2d');
  g.fillStyle = '#2a2c30'; g.fillRect(0, 0, 512, 512);
  g.fillStyle = '#d8d9db'; roundRect(g, 20, 20, 472, 472, 18); g.fill();
  g.fillStyle = '#c0161a'; g.fillRect(20, 20, 472, 70);
  g.fillStyle = '#fff'; g.font = 'bold 40px Arial'; g.textAlign = 'center';
  g.fillText('CARRIER CONTROLS', 256, 70);
  g.fillStyle = '#111'; g.font = 'bold 34px Arial';
  g.fillText('BED', 150, 140); g.fillText('WINCH', 362, 140);
  g.font = 'bold 26px Arial';
  g.fillText('▲ RAISE', 150, 190); g.fillText('▼ LOWER', 150, 470);
  g.fillText('▲ IN', 362, 190); g.fillText('▼ OUT', 362, 470);
  g.font = '18px Arial'; g.fillStyle = '#333';
  g.fillText('STAND CLEAR OF DECK WHILE OPERATING', 256, 500);
  g.strokeStyle = '#444'; g.lineWidth = 4;
  g.strokeRect(80, 210, 140, 230); g.strokeRect(292, 210, 140, 230);
  return canvasTexture(c);
}

function buildControlStation(t, root, liv) {
  const x = t.bed.width / 2 - 0.02;
  const z = t.controlZ;
  const y = t.frameTop + 0.08;
  const group = new THREE.Group();
  group.position.set(x, y, z);
  root.add(group);
  box(0.08, 0.5, 0.36, M.std(0x1c1d20, 0.5, 0.5), -0.04, 0.0, 0, group);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.48), new THREE.MeshStandardMaterial({ map: controlPanelTexture(), roughness: 0.5 }));
  face.position.set(0.002, 0, 0);
  face.rotation.y = Math.PI / 2;
  group.add(face);
  const levers = {};
  for (const [name, dz] of [['bed', 0.072], ['winch', -0.072]]) {
    const pivot = new THREE.Group();
    pivot.position.set(0.02, -0.02, dz);
    group.add(pivot);
    const rod = cyl(0.008, 0.008, 0.24, M.chrome(), 0.12, 0, 0, pivot, 'x', 10);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.028, 16, 12), M.std(name === 'bed' ? 0xc0161a : 0x111111, 0.35));
    knob.position.set(0.25, 0, 0);
    pivot.add(knob);
    for (const o of [rod, knob]) { o.userData.part = 'lever'; o.userData.lever = name; }
    levers[name] = { pivot, knob, value: 0 };
  }
  // Free-spool knob.
  const fs = cyl(0.02, 0.02, 0.04, M.std(0xe8b10f, 0.4), 0.02, 0.2, 0, group, 'x', 14);
  fs.userData.part = 'freespool';
  return { group, levers, worldPos: new THREE.Vector3(x, y, z) };
}

// ---------------------------------------------------------------- ELS

function buildELS(t, root, bed, cabCenter) {
  const cs = getCabModel(t).spec;
  const roofY = t.cab.H;
  const barZ = cabCenter + (cs.zR1 + cs.zR2) / 2 + 0.15;
  const barW = Math.min(1.5, t.cab.W - 0.3);
  const bar = new THREE.Group();
  bar.position.set(0, roofY + 0.02, barZ);
  root.add(bar);
  // Feet & base extrusion.
  for (const side of [1, -1]) box(0.08, 0.05, 0.22, M.frameBlack(), side * (barW / 2 - 0.15), 0.0, 0, bar);
  box(barW, 0.05, 0.28, M.std(0x1b1c1f, 0.35, 0.8), 0, 0.045, 0, bar);
  const bankA = M.lightLens('amber');
  const bankB = M.lightLens('amber');
  const modules = 8;
  const mw = (barW - 0.1) / modules;
  for (let i = 0; i < modules; i++) {
    const mat = (i < modules / 2 ? (i % 2 === 0) : (i % 2 === 1)) ? bankA : bankB;
    const x = -barW / 2 + 0.05 + mw * (i + 0.5);
    // Front and rear facing LED heads under the dome.
    box(mw - 0.012, 0.05, 0.025, mat, x, 0.095, 0.115, bar, { cast: false });
    box(mw - 0.012, 0.05, 0.025, mat, x, 0.095, -0.115, bar, { cast: false });
  }
  // Clear polycarbonate dome over it all.
  const domeG = new THREE.CapsuleGeometry(0.075, barW - 0.16, 8, 16);
  domeG.rotateZ(Math.PI / 2);
  domeG.scale(1, 0.85, 1.75);
  const dome = new THREE.Mesh(domeG, new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0, depthWrite: false }));
  dome.position.y = 0.1;
  dome.renderOrder = 3;
  bar.add(dome);
  // Grille strobes & rear strobes.
  const front = [];
  for (const side of [1, -1]) {
    const gs = box(0.07, 0.03, 0.02, side > 0 ? bankA : bankB, side * 0.32, t.cab.grilleBox.y - t.cab.grilleBox.h / 2 + 0.06, t.cabFront + 0.035, root, { cast: false });
    front.push(gs);
  }
  for (const side of [1, -1]) {
    const rs = box(0.1, 0.05, 0.03, side > 0 ? bankB : bankA, side * (bed.width / 2 - 0.36), bed.deckY - 0.02, bed.zRear + 0.5, bed.slideG, { cast: false });
    const top = box(0.12, 0.06, 0.06, side > 0 ? bankA : bankB, side * (bed.width / 2 - 0.05), bed.deckY + 1.23, bed.zFront - 0.04, bed.slideG, { cast: false });
  }
  // Actual light cast on the surroundings (no shadows: cheap).
  const lights = [];
  const pl = new THREE.PointLight(0xffa41a, 0, 24, 1.6);
  pl.position.set(0, roofY + 0.4, barZ);
  root.add(pl);
  lights.push({ light: pl, bank: 'AB' });
  const rear = new THREE.PointLight(0xffa41a, 0, 16, 1.6);
  rear.position.set(0, bed.deckY + 0.3, bed.zRear + 0.4);
  bed.slideG.add(rear);
  lights.push({ light: rear, bank: 'R' });
  return { bar, bankA, bankB, lights, mode: 'off' };
}

// Poses the bed and hydraulic rams for the current tilt/slide.
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
export function poseBed(truck, tilt, slide) {
  const bed = truck.bed;
  bed.tilt = tilt;
  bed.slide = slide;
  bed.tiltG.rotation.x = -tilt;
  bed.slideG.position.z = -slide;
  // Rams run from the frame to a point under the bed (in truck coords).
  truck.root.updateMatrixWorld(true);
  for (const r of truck.rams) {
    _a.copy(r.base);
    // Attachment under the bed, fixed in the tilt frame (the bed slides past it).
    _b.set(r.side * 0.3, bed.deckY - 0.2, r.base.z - bed.pivot.position.z + 0.9);
    _b.applyAxisAngle(new THREE.Vector3(1, 0, 0), -tilt).add(bed.pivot.position);
    _d.subVectors(_b, _a);
    const len = Math.max(0.05, _d.length());
    const q = new THREE.Quaternion().setFromUnitVectors(_up, _d.clone().normalize());
    const barrelLen = Math.min(len, 0.9);
    r.barrel.position.copy(_a).addScaledVector(_d, barrelLen / len / 2);
    r.barrel.quaternion.copy(q);
    r.barrel.scale.set(1, barrelLen, 1);
    r.rod.position.copy(_a).addScaledVector(_d, 0.5);
    r.rod.quaternion.copy(q);
    r.rod.scale.set(1, len, 1);
  }
}
