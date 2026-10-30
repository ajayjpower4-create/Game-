// Delivery vehicles: tractor + flatbed trailer, rail flatcar, locomotive.
// Ported from the Roblox VehicleFactory (all metres). Local frame: origin at
// road level under the middle of the bed, bed along +X, tractor toward -X.

import { CF, v, rad, Rng } from "../core/math.js";
import { Config, rgb } from "../core/config.js";
import { $add, $sub, $mul, $div } from "../core/lua.js";
import { Node, partMaker } from "./node.js";

const C = Config.Colors;
const CHROME = rgb(206, 210, 214);
const ALU = rgb(176, 180, 184);
const FRAME = rgb(30, 31, 33);
const TIRE = rgb(27, 27, 29);
const GLASS = rgb(34, 44, 52);

// Road wheel: its own node (frame on the axle) so it can roll.
function wheel(b, wheelsNode, x, z, side, dual, dia, steer) {
  const w = wheelsNode.add(new Node("Wheel", CF.at(x, dia / 2, z).mul(CF.angles(0, Math.PI / 2, 0))));
  const width = 0.29;
  const offsets = dual ? [-0.16, 0.16] : [0];
  offsets.forEach((o, i) => {
    b.cylZ(i === 0 ? "Tyre" : "TyreInner", width, dia, v(x, dia / 2, z + side * o), TIRE, "SmoothPlastic", undefined, w);
    b.cylZ("Tread", width * 0.35, dia + 0.004, v(x, dia / 2, z + side * o), rgb(20, 20, 21), "SmoothPlastic", { nc: true, ns: true }, w);
  });
  const outer = z + side * (offsets[offsets.length - 1] + width / 2);
  b.cylZ("Rim", 0.03, dia * 0.6, v(x, dia / 2, outer + side * 0.006), steer ? CHROME : ALU, "Metal", { nc: true, ns: true, refl: 0.25 }, w);
  b.cylZ("RimLip", 0.02, dia * 0.66, v(x, dia / 2, outer + side * 0.001), CHROME, "Metal", { nc: true, ns: true, refl: 0.3 }, w);
  b.cylZ("Hub", 0.12, dia * 0.24, v(x, dia / 2, outer + side * 0.05), CHROME, "Metal", { nc: true, ns: true, refl: 0.35 }, w);
  b.cylZ("LugRing", 0.04, dia * 0.34, v(x, dia / 2, outer + side * 0.025), rgb(150, 152, 156), "Metal", { nc: true, ns: true }, w);
  for (let k = 0; k <= 5; k++) {
    const a = (k * Math.PI) / 3;
    b.part("Hand", v(0.06, 0.08, 0.012), CF.at(x + Math.cos(a) * dia * 0.21, dia / 2 + Math.sin(a) * dia * 0.21, outer + side * 0.012).mul(CF.angles(0, 0, a)), rgb(120, 124, 128), "Metal", { nc: true, ns: true }, w);
  }
  w.attrs.radius = dia / 2;
  return w;
}

const PAINTS = [
  { body: rgb(122, 16, 22), stripe: rgb(230, 230, 226) },
  { body: rgb(236, 236, 232), stripe: rgb(26, 52, 110) },
  { body: rgb(20, 40, 86), stripe: rgb(196, 198, 202) },
  { body: rgb(24, 24, 26), stripe: rgb(196, 150, 20) },
  { body: rgb(28, 78, 52), stripe: rgb(230, 230, 226) },
];
export function buildTruck(bayCf, seed) {
  const rng = new Rng(seed || 1);
  const paint = PAINTS[rng.int(1, PAINTS.length) - 1];
  const model = new Node("Trailer");
  const b = partMaker(model);
  const wheels = model.add(new Node("Wheels"));
  const D = Config.Delivery;
  let [L, W, H] = [D.BedLength, D.BedWidth, D.BedHeight];
  const WD = 1.04;
  const sideW = W / 2 - 0.07 - 0.14;
  const pw = sideW / 2;
  for (const sz of [-1, 1]) {
    for (let k = 0; k <= 1; k += 1) {
      const zc = sz * (0.14 + pw * (k + 0.5));
      b.part("DeckPlank", v(L - 0.1, 0.05, pw - 0.015), CF.at(0, H - 0.025, zc), rgb(124 + k * 6, 96, 68), "WoodPlanks");
    }
  }
  b.part("DeckCentre", v(L - 0.1, 0.052, 0.28), CF.at(0, H - 0.026, 0), ALU, "DiamondPlate");
  for (const sz of [-1, 1]) {
    b.part("RubRail", v(L, 0.3, 0.07), CF.at(0, H - 0.15, sz * (W / 2 - 0.035)), ALU, "Metal", { refl: 0.08 });
    b.part("RailLip", v(L, 0.05, 0.1), CF.at(0, H - 0.29, sz * (W / 2 - 0.05)), ALU, "Metal", { nc: true, ns: true });
    const pockets = Math.floor(L / 1.2);
    for (let k = 1; k <= pockets - 1; k += 1) {
      b.part("StakePocket", v(0.12, 0.13, 0.012), CF.at(-L / 2 + k * 1.2, H - 0.15, sz * (W / 2 + 0.002)), FRAME, "Metal", { nc: true, ns: true });
    }
    for (let k = 0; k <= 3; k += 1) {
      const m = b.part("Marker", v(0.08, 0.05, 0.02), CF.at(-L / 2 + 1 + k * (L - 2) / 3, H - 0.22, sz * (W / 2 + 0.01)), rgb(255, 150, 30), "Neon", { nc: true, ns: true });
      m.tr = 0.05;
    }
    const bz = sz * 0.5;
    b.part("BeamTop", v(L - 0.4, 0.02, 0.18), CF.at(0.2, H - 0.32, bz), FRAME, "Metal");
    b.part("BeamWeb", v(L - 0.4, 0.42, 0.012), CF.at(0.2, H - 0.54, bz), FRAME, "Metal");
    b.part("BeamBottom", v(L - 0.4, 0.02, 0.16), CF.at(0.2, H - 0.76, bz), FRAME, "Metal");
  }
  for (let k = 0; k <= 15; k += 1) {
    b.part("Crossmember", v(0.06, 0.16, W - 0.2), CF.at(-L / 2 + 0.5 + k * (L - 1) / 15, H - 0.38, 0), FRAME, "Metal", { nc: true, ns: true });
  }
  for (let k = 0; k <= 11; k += 1) {
    const x = -L / 2 + 0.9 + k * (L - 1.8) / 11;
    b.cylX("Winch", 0.16, 0.12, CF.at(x, H - 0.42, W / 2 - 0.12), rgb(70, 72, 76), "Metal", { nc: true, ns: true });
    b.part("WinchFace", v(0.03, 0.18, 0.18), CF.at(x + 0.09, H - 0.42, W / 2 - 0.12), rgb(150, 152, 156), "Metal", { nc: true, ns: true });
  }
  for (const sz of [-1, 1]) {
    const x = -L / 2 + 3.4;
    b.part("LegOuter", v(0.13, H - 0.85, 0.13), CF.at(x, (H - 0.85) / 2 + 0.55, sz * 0.62), FRAME, "Metal");
    b.part("LegInner", v(0.09, 0.5, 0.09), CF.at(x, 0.3, sz * 0.62), rgb(120, 122, 124), "Metal");
    b.part("Foot", v(0.3, 0.05, 0.3), CF.at(x, 0.025, sz * 0.62), FRAME, "Metal");
  }
  b.part("GearBrace", v(0.05, 0.05, 1.24), CF.at(-L / 2 + 3.4, 0.9, 0), FRAME, "Metal", { nc: true });
  b.part("Crank", v(0.03, 0.03, 0.4), CF.at(-L / 2 + 3.4, 0.95, W / 2 - 0.1), rgb(150, 152, 156), "Metal", { nc: true, ns: true });
  const tAxles = [L / 2 - 2.4, L / 2 - 1.15];
  for (const ax of tAxles) {
    b.cylZ("Axle", W - 0.3, 0.12, v(ax, WD / 2, 0), FRAME, "Metal", { nc: true, ns: true });
    for (const sz of [-1, 1]) {
      wheel(b, wheels, ax, sz * 0.88, sz, true, WD, false);
      b.cylY("AirBag", 0.25, 0.28, v($add(ax, 0.3), H - 0.92, sz * 0.5), TIRE, "SmoothPlastic", { nc: true, ns: true });
      b.part("Hanger", v(0.1, 0.35, 0.08), CF.at($sub(ax, 0.45), H - 0.95, sz * 0.5), FRAME, "Metal", { nc: true, ns: true });
    }
  }
  for (const sz of [-1, 1]) {
    b.part("TrailerFender", v(2.5, 0.04, 0.6), CF.at($div($add(tAxles[0], tAxles[1]), 2), H - 0.32, sz * 0.95), FRAME, "Metal", { nc: true, ns: true });
    b.part("Mudflap", v(0.02, 0.6, 0.62), CF.at(L / 2 - 0.35, 0.55, sz * 0.88), TIRE, "SmoothPlastic", { nc: true });
  }
  b.part("ICCBar", v(0.12, 0.12, W - 0.3), CF.at(L / 2 - 0.2, 0.62, 0), FRAME, "Metal", { refl: 0.05 });
  b.part("ICCPost", v(0.08, 0.5, 0.08), CF.at(L / 2 - 0.25, 0.9, 0.7), FRAME, "Metal", { nc: true });
  b.part("ICCPost", v(0.08, 0.5, 0.08), CF.at(L / 2 - 0.25, 0.9, -0.7), FRAME, "Metal", { nc: true });
  b.part("RearSill", v(0.08, 0.3, W), CF.at(L / 2 - 0.04, H - 0.15, 0), ALU, "Metal");
  for (const sz of [-1, 1]) {
    for (let k = 0; k <= 1; k += 1) {
      const tl = b.cylX("TailLight", 0.03, 0.12, CF.at(L / 2 + 0.005, H - 0.18, sz * (W / 2 - 0.2 - k * 0.18)), rgb(210, 22, 22), "Neon", { nc: true, ns: true });
      tl.tr = 0.05;
    }
  }
  b.part("Reflector", v(0.012, 0.05, W - 0.6), CF.at(L / 2 - 0.13, 0.62, 0), rgb(220, 40, 30), "SmoothPlastic", { nc: true, ns: true });
  b.part("Plate", v(0.01, 0.15, 0.3), CF.at(L / 2 - 0.1, 0.42, -0.6), rgb(236, 236, 230), "SmoothPlastic", { nc: true, ns: true });
  b.part("KingpinPlate", v(1.4, 0.04, W - 0.4), CF.at(-L / 2 + 0.75, H - 0.77, 0), FRAME, "Metal", { nc: true, ns: true });
  const tx = -L / 2;
  const [body, stripe] = [paint.body, paint.stripe];
  for (const sz of [-1, 1]) {
    b.part("FrameRail", v(9.9, 0.27, 0.09), CF.at(tx - 3.3, 0.92, sz * 0.43), FRAME, "Metal");
  }
  b.part("FifthWheel", v(1.0, 0.1, 1.1), CF.at(tx + 0.75, 1.2, 0), FRAME, "Metal");
  b.part("FifthWheelTop", v(0.9, 0.02, 1.0), CF.at(tx + 0.75, 1.26, 0), rgb(60, 60, 60), "Metal", { nc: true, ns: true });
  b.part("DeckPlate", v(1.6, 0.03, 1.3), CF.at(tx - 1.0, 1.1, 0), ALU, "DiamondPlate");
  const drive = [tx + 0.1, tx + 1.4];
  for (const ax of drive) {
    b.cylZ("DriveAxle", 1.9, 0.18, v(ax, WD / 2, 0), FRAME, "Metal", { nc: true, ns: true });
    b.part("Diff", v(0.42, 0.42, 0.42), CF.at(ax, WD / 2, 0), FRAME, "Metal", { nc: true, ns: true });
    for (const sz of [-1, 1]) {
      wheel(b, wheels, ax, sz * 0.86, sz, true, WD, false);
    }
  }
  const steerX = tx - 7.45;
  b.cylZ("SteerAxle", 1.9, 0.14, v(steerX, WD / 2, 0), FRAME, "Metal", { nc: true, ns: true });
  for (const sz of [-1, 1]) {
    wheel(b, wheels, steerX, sz * 0.98, sz, false, WD, true);
    b.part("QuarterFender", v(1.2, 0.05, 0.62), $mul(CF.at($sub($div($add(drive[0], drive[1]), 2), 0.1), WD + 0.12, sz * 0.92), CF.angles(0, 0, 0)), FRAME, "Metal", { nc: true, ns: true });
    b.part("DriveFlap", v(0.02, 0.62, 0.62), CF.at($add(drive[1], 0.62), 0.55, sz * 0.92), TIRE, "SmoothPlastic", { nc: true });
    b.part("FlapWeight", v(0.022, 0.08, 0.6), CF.at($add(drive[1], 0.63), 0.28, sz * 0.92), CHROME, "Metal", { nc: true, ns: true, refl: 0.3 });
  }
  for (const sz of [-1, 1]) {
    const x = tx - 4.55;
    b.cylX("FuelTank", 1.55, 0.64, CF.at(x, 0.95, sz * 0.86), CHROME, "Metal", { refl: 0.3 });
    for (const dx of [-0.5, 0.5]) {
      b.cylX("TankStrap", 0.05, 0.66, CF.at(x + dx, 0.95, sz * 0.86), FRAME, "Metal", { nc: true, ns: true });
    }
    b.part("TankCap", v(0.1, 0.03, 0.1), CF.at(x + 0.55, 1.28, sz * 0.86), CHROME, "Metal", { nc: true, ns: true });
    b.part("StepBox", v(0.5, 0.62, 0.32), CF.at(tx - 5.6, 0.83, sz * 0.92), ALU, "Metal", { refl: 0.15 });
    b.part("Step", v(0.52, 0.04, 0.34), CF.at(tx - 5.6, 0.68, sz * 0.94), ALU, "DiamondPlate", { nc: true });
    b.part("Step", v(0.52, 0.04, 0.34), CF.at(tx - 5.6, 1.14, sz * 0.94), ALU, "DiamondPlate", { nc: true });
  }
  const [cabX0, cabX1] = [tx - 6.0, tx - 4.25];
  const [slpX0, slpX1] = [tx - 4.25, tx - 2.35];
  const floorY = 1.15;
  b.part("CabBody", v(cabX1 - cabX0, 1.55, 2.0), CF.at((cabX0 + cabX1) / 2, floorY + 0.775, 0), body, "Metal", { refl: 0.06 });
  b.part("CabRoof", v(cabX1 - cabX0 - 0.1, 0.14, 1.9), CF.at((cabX0 + cabX1) / 2 + 0.05, floorY + 1.62, 0), body, "Metal", { refl: 0.06 });
  b.part("Sleeper", v(slpX1 - slpX0, 2.1, 2.0), CF.at((slpX0 + slpX1) / 2, floorY + 1.05, 0), body, "Metal", { refl: 0.06 });
  b.part("SleeperRoof", v(slpX1 - slpX0 - 0.06, 0.1, 1.92), CF.at((slpX0 + slpX1) / 2, floorY + 2.15, 0), body, "Metal", { refl: 0.06 });
  b.part("RoofFairing", v(1.9, 0.5, 0.75), $mul(CF.at(cabX1 - 0.375, floorY + 1.94, 0), CF.angles(0, Math.PI / 2, 0)), body, "Metal", { wedge: true });
  for (const sz of [-1, 1]) {
    b.part("Windshield", v(0.04, 0.72, 0.9), $mul(CF.at(cabX0 - 0.02, floorY + 1.15, sz * 0.47), CF.angles(0, 0, rad(-10))), GLASS, "Glass", { nc: true, refl: 0.3 });
  }
  b.part("CentrePost", v(0.06, 0.74, 0.06), $mul(CF.at(cabX0 - 0.01, floorY + 1.15, 0), CF.angles(0, 0, rad(-10))), body, "Metal", { nc: true });
  b.part("Visor", v(0.32, 0.05, 1.95), $mul(CF.at(cabX0 - 0.12, floorY + 1.58, 0), CF.angles(0, 0, rad(8))), body, "Metal", { nc: true });
  for (let k = -2; k <= 2; k += 1) {
    b.part("CabLight", v(0.06, 0.05, 0.1), CF.at(cabX0 + 0.05, floorY + 1.71, k * 0.3), rgb(255, 160, 30), "Neon", { nc: true, ns: true });
  }
  for (const sz of [-1, 1]) {
    const face = sz * 1.0;
    b.part("DoorWindow", v(0.8, 0.55, 0.02), CF.at(cabX0 + 0.75, floorY + 1.15, face + sz * 0.005), GLASS, "Glass", { nc: true, refl: 0.3 });
    b.part("DoorSeam", v(0.02, 1.3, 0.012), CF.at(cabX0 + 1.25, floorY + 0.75, face + sz * 0.006), rgb(16, 16, 18), "SmoothPlastic", { nc: true, ns: true });
    b.part("DoorHandle", v(0.14, 0.03, 0.03), CF.at(cabX0 + 1.15, floorY + 0.8, face + sz * 0.02), CHROME, "Metal", { nc: true, ns: true, refl: 0.3 });
    b.part("SleeperWindow", v(0.4, 0.3, 0.02), CF.at(slpX0 + 0.55, floorY + 1.35, face + sz * 0.005), GLASS, "Glass", { nc: true, refl: 0.3 });
    b.part("StorageDoor", v(0.6, 0.45, 0.012), CF.at(slpX0 + 1.2, floorY + 0.3, face + sz * 0.006), body, "Metal", { nc: true, ns: true });
    b.part("Stripe", v(slpX1 - cabX0 - 0.1, 0.08, 0.01), CF.at((cabX0 + slpX1) / 2, floorY + 0.55, face + sz * 0.007), stripe, "SmoothPlastic", { nc: true, ns: true });
    b.part("MirrorArm", v(0.03, 0.03, 0.35), CF.at(cabX0 + 0.15, floorY + 1.0, sz * 1.17), CHROME, "Metal", { nc: true, ns: true });
    b.part("Mirror", v(0.05, 0.45, 0.2), CF.at(cabX0 + 0.12, floorY + 1.1, sz * 1.35), rgb(18, 18, 20), "SmoothPlastic", { nc: true });
    b.part("MirrorGlass", v(0.006, 0.4, 0.16), CF.at(cabX0 + 0.15, floorY + 1.1, sz * 1.35), rgb(150, 170, 185), "Glass", { nc: true, ns: true, refl: 0.5 });
    b.cylY("Stack", 3.0, 0.14, v(slpX1 + 0.12, 2.6, sz * 0.95), CHROME, "Metal", { nc: true, refl: 0.35 });
    b.cylY("HeatShield", 0.9, 0.2, v(slpX1 + 0.12, 2.0, sz * 0.95), ALU, "DiamondPlate", { nc: true, ns: true });
    b.part("StackTip", v(0.16, 0.04, 0.16), $mul(CF.at(slpX1 + 0.12, 4.12, sz * 0.95), CF.angles(0, 0, rad(25))), CHROME, "Metal", { nc: true, ns: true });
    b.cylX("AirLine", 1.4, 0.03, $mul(CF.at(slpX1 + 0.75, 1.75, sz * 0.12), CF.angles(0, 0, rad(-20))), (((sz > 0) && rgb(180, 30, 30)) || rgb(30, 60, 160)), "SmoothPlastic", { nc: true, ns: true });
  }
  const [hoodX0, hoodX1] = [tx - 8.25, cabX0];
  const hoodLen = hoodX1 - hoodX0;
  b.part("Hood", v(hoodLen, 0.7, 1.12), CF.at((hoodX0 + hoodX1) / 2, 1.62, 0), body, "Metal", { refl: 0.06 });
  b.part("HoodTop", v(hoodLen - 0.1, 0.1, 0.9), CF.at((hoodX0 + hoodX1) / 2 + 0.05, 2.0, 0), body, "Metal", { refl: 0.06 });
  b.part("Cowl", v(0.3, 0.25, 1.95), CF.at(hoodX1 - 0.15, 1.8, 0), body, "Metal");
  for (const sz of [-1, 1]) {
    b.part("HoodShoulder", v(hoodLen - 0.1, 0.12, 0.12), $mul(CF.at((hoodX0 + hoodX1) / 2 + 0.05, 1.96, sz * 0.5), CF.angles(rad(sz * 35), 0, 0)), body, "Metal", { nc: true });
    const fz = sz * 0.84;
    b.part("FenderCrown", v(1.3, 0.3, 0.46), CF.at(steerX, WD + 0.13, fz), body, "Metal", { refl: 0.06 });
    b.part("FenderNose", v(0.46, 0.3, 0.55), $mul(CF.at(steerX - 0.925, WD + 0.13, fz), CF.angles(0, Math.PI / 2, 0)), body, "Metal", { wedge: true, nc: true });
    b.part("FenderTail", v(0.46, 0.3, 0.7), $mul(CF.at(steerX + 1.0, WD + 0.13, fz), CF.angles(0, -Math.PI / 2, 0)), body, "Metal", { wedge: true, nc: true });
    b.part("FenderLiner", v(1.3, 0.04, 0.4), CF.at(steerX, WD - 0.03, fz), FRAME, "SmoothPlastic", { nc: true, ns: true });
    for (let k = 0; k <= 1; k += 1) {
      const hz = sz * (0.72 + k * 0.2);
      b.cylX("HeadlightBucket", 0.16, 0.2, CF.at(hoodX0 + 0.25, WD + 0.38, hz), CHROME, "Metal", { nc: true, ns: true, refl: 0.35 });
      const lens = b.cylX("Headlight", 0.02, 0.17, CF.at(hoodX0 + 0.16, WD + 0.38, hz), rgb(250, 248, 236), "Neon", { nc: true, ns: true });
      lens.tr = 0.1;
    }
    b.cylY("AirCleaner", 0.65, 0.45, v(hoodX1 - 0.45, 1.65, sz * 0.82), CHROME, "Metal", { nc: true, refl: 0.3 });
    b.cylZ("Intake", 0.25, 0.14, v(hoodX1 - 0.45, 1.85, sz * 0.66), CHROME, "Metal", { nc: true, ns: true });
    b.part("HoodVent", v(0.6, 0.18, 0.012), CF.at(hoodX0 + 1.2, 1.6, sz * 0.565), rgb(40, 40, 42), "DiamondPlate", { nc: true, ns: true });
  }
  const gx = hoodX0 - 0.02;
  b.part("GrilleSurround", v(0.08, 1.05, 1.08), CF.at(gx, 1.55, 0), CHROME, "Metal", { refl: 0.35 });
  b.part("GrilleBack", v(0.02, 0.9, 0.92), CF.at(gx - 0.035, 1.55, 0), rgb(26, 26, 28), "Metal", { nc: true, ns: true });
  for (let k = 0; k <= 8; k += 1) {
    b.part("GrilleBar", v(0.03, 0.025, 0.9), CF.at(gx - 0.045, 1.15 + k * 0.1, 0), CHROME, "Metal", { nc: true, ns: true, refl: 0.35 });
  }
  b.part("Emblem", v(0.03, 0.1, 0.3), CF.at(gx - 0.05, 2.12, 0), CHROME, "Metal", { nc: true, ns: true, refl: 0.4 });
  b.part("Bumper", v(0.32, 0.36, 2.45), CF.at(gx - 0.2, 0.72, 0), CHROME, "Metal", { refl: 0.35 });
  b.part("BumperStep", v(0.2, 0.04, 2.3), CF.at(gx - 0.32, 0.92, 0), ALU, "DiamondPlate", { nc: true, ns: true });
  b.part("TowHook", v(0.08, 0.12, 0.12), CF.at(gx - 0.38, 0.6, 0.6), rgb(190, 40, 30), "Metal", { nc: true, ns: true });
  const engine = b.part("Engine", v(1, 0.6, 1), CF.at(hoodX0 + hoodLen / 2, 1.2, 0), FRAME, "Metal", { nc: true, tr: 1, nq: true, ns: true });
  engine.engine = true;
  const interact = b.part("TruckInteract", v(cabX1 - hoodX0 + 0.3, 2.8, 2.6), CF.at((hoodX0 + slpX1) / 2, 1.8, 0), C.Steel, "SmoothPlastic", { tr: 1, nc: true, ns: true });
  interact.interact = "Truck";
  model.cf = bayCf;
  return { model, bedTop: H };
}
export function buildFlatcar(cf, seed) {
  const model = new Node("Flatcar");
  const b = partMaker(model);
  const wheels = model.add(new Node("Wheels"));
  const [L, W, H] = [18.0, 2.9, 1.25];
  const car = rgb(70, 40, 30);
  b.part("Deck", v(L, 0.08, W), CF.at(0, H - 0.04, 0), rgb(110, 86, 62), "WoodPlanks");
  b.part("CentreSill", v(L, 0.55, 0.5), CF.at(0, H - 0.36, 0), car, "Metal");
  for (const sz of [-1, 1]) {
    b.part("SideSill", v(L, 0.3, 0.08), CF.at(0, H - 0.2, sz * (W / 2 - 0.04)), car, "Metal");
    for (let k = 0; k <= 12; k += 1) {
      b.part("StakePocket", v(0.1, 0.12, 0.012), CF.at(-L / 2 + 0.9 + k * (L - 1.8) / 12, H - 0.2, sz * (W / 2 + 0.002)), rgb(40, 24, 18), "Metal", { nc: true, ns: true });
    }
  }
  for (const sx of [-1, 1]) {
    b.part("Bulkhead", v(0.12, 2.4, W), CF.at(sx * (L / 2 - 0.06), H + 1.2, 0), car, "Metal");
    for (let k = 0; k <= 3; k += 1) {
      b.part("BulkheadRib", v(0.14, 0.08, W), CF.at(sx * (L / 2 - 0.06), H + 0.4 + k * 0.6, 0), rgb(56, 32, 24), "Metal", { nc: true, ns: true });
    }
    const bx = sx * (L / 2 - 2.2);
    b.part("Bolster", v(0.5, 0.3, 2.4), CF.at(bx, 0.75, 0), rgb(36, 36, 38), "Metal");
    for (const dx of [-0.9, 0.9]) {
      b.cylZ("WheelAxle", 1.6, 0.14, v(bx + dx, 0.46, 0), rgb(46, 46, 48), "Metal", { nc: true, ns: true });
      for (const sz of [-1, 1]) {
        const w = wheels.add(new Node("Wheel", CF.at(bx + dx, 0.46, sz * 0.72).mul(CF.angles(0, Math.PI / 2, 0))));
        b.cylZ("RailWheel", 0.14, 0.92, v(bx + dx, 0.46, sz * 0.72), rgb(58, 52, 48), "Metal", undefined, w);
        b.cylZ("Flange", 0.03, 1.0, v(bx + dx, 0.46, sz * 0.64), rgb(58, 52, 48), "Metal", { nc: true, ns: true }, w);
        w.attrs.radius = 0.46;
      }
    }
    for (const sz of [-1, 1]) {
      b.part("SideFrame", v(2.4, 0.3, 0.12), CF.at(bx, 0.5, sz * 0.86), rgb(36, 36, 38), "Metal", { nc: true });
      b.cylY("Spring", 0.3, 0.16, v(bx, 0.72, sz * 0.86), rgb(70, 70, 72), "Metal", { nc: true, ns: true });
    }
    b.part("Coupler", v(0.6, 0.2, 0.25), CF.at(sx * (L / 2 + 0.3), 0.85, 0), rgb(36, 36, 38), "Metal");
  }
  const reporting = b.part("Reporting", v(3, 0.25, 0.01), CF.at(0, H - 0.2, W / 2 + 0.01), rgb(230, 230, 226), "SmoothPlastic", { nc: true, ns: true });
  reporting.tr = 0.1;
  model.cf = cf;
  return { model, bedTop: H, length: L };
}
export function buildLocomotive(cf) {
  const model = new Node("Locomotive");
  const b = partMaker(model);
  const wheels = model.add(new Node("Wheels"));
  const L = 17.0;
  const paint = rgb(230, 170, 20);
  const dark = rgb(36, 38, 40);
  b.part("Frame", v(L, 0.45, 3.0), CF.at(0, 1.35, 0), dark, "Metal");
  b.part("LongHood", v(10.5, 2.4, 2.4), CF.at(2.3, 2.8, 0), paint, "Metal", { refl: 0.05 });
  b.part("Cab", v(3.2, 3.0, 3.0), CF.at(-4.55, 3.1, 0), paint, "Metal", { refl: 0.05 });
  b.part("CabRoof", v(3.3, 0.15, 3.05), CF.at(-4.55, 4.65, 0), dark, "Metal");
  b.part("ShortHood", v(2.2, 1.9, 2.2), CF.at(-7.25, 2.55, 0), paint, "Metal");
  for (const sz of [-1, 1]) {
    b.part("CabWindow", v(1.2, 0.8, 0.02), CF.at(-4.3, 3.9, sz * 1.51), GLASS, "Glass", { nc: true, refl: 0.3 });
    b.part("Walkway", v(L - 1, 0.04, 0.3), CF.at(0, 1.6, sz * 1.35), dark, "DiamondPlate", { nc: true });
    b.part("Handrail", v(L - 1.5, 0.05, 0.05), CF.at(0, 2.6, sz * 1.48), paint, "Metal", { nc: true, ns: true });
    b.part("Stripe", v(L - 0.5, 0.15, 0.012), CF.at(0, 1.45, sz * 1.505), rgb(20, 20, 22), "SmoothPlastic", { nc: true, ns: true });
  }
  b.part("Windshield", v(0.02, 0.9, 2.4), CF.at(-6.16, 3.9, 0), GLASS, "Glass", { nc: true, refl: 0.3 });
  for (let k = 0; k <= 3; k += 1) {
    b.part("Radiator", v(0.9, 0.05, 1.8), CF.at(5.5 + k % 2 * 1.0, 4.02, 0), dark, "DiamondPlate", { nc: true, ns: true });
  }
  b.cylY("ExhaustStack", 0.4, 0.3, v(1.0, 4.15, 0), dark, "Metal", { nc: true, ns: true });
  const hl = b.cylX("Headlight", 0.03, 0.3, CF.at(-8.37, 3.2, 0), rgb(250, 248, 236), "Neon", { nc: true, ns: true });
  hl.tr = 0.1;
  for (const sx of [-1, 1]) {
    const bx = sx * 5.6;
    b.part("TruckFrame", v(3.6, 0.5, 2.4), CF.at(bx, 0.85, 0), dark, "Metal");
    for (const dx of [-1.3, 0, 1.3]) {
      for (const sz of [-1, 1]) {
        const w = wheels.add(new Node("Wheel", CF.at(bx + dx, 0.51, sz * 0.72).mul(CF.angles(0, Math.PI / 2, 0))));
        b.cylZ("RailWheel", 0.14, 1.02, v(bx + dx, 0.51, sz * 0.72), rgb(58, 52, 48), "Metal", undefined, w);
        w.attrs.radius = 0.51;
      }
    }
    b.part("Pilot", v(0.3, 0.6, 3.0), CF.at(sx * (L / 2 + 0.1), 1.1, 0), dark, "Metal");
    b.part("Coupler", v(0.6, 0.2, 0.25), CF.at(sx * (L / 2 + 0.5), 0.85, 0), dark, "Metal");
  }
  const fuel = b.part("FuelTank", v(5, 0.8, 2.4), CF.at(0.5, 0.75, 0), dark, "Metal");
    const engine = b.part("Engine", v(1, 1, 1), CF.at(2, 2.5, 0), dark, "Metal", { nc: true, tr: 1, nq: true, ns: true });
  engine.engine = true;
  model.cf = cf;
  return { model, length: L };
}
