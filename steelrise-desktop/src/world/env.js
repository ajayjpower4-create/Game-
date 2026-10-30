// Site environment: graded ground, roads, fencing and gate, site dressing
// and the neighbourhood around the lot. Ported from the Roblox WorldFactory;
// geometry is authored in studs (3 per metre) like the original and scaled to
// metres at the end.

import { CF, V3, v, rad, Rng, hashString } from "../core/math.js";
import { Config, rgb } from "../core/config.js";
import { $add, $sub, $mul, $div, $unm } from "../core/lua.js";
import { Node } from "./node.js";

const S = 3;
const m = (x) => x * S;
const C = Config.Colors;

function P(node, name, size, cf, color, material, flags = {}) {
  let f = {};
  for (const k of ["nc", "ns", "nq", "tr", "refl"]) if (flags[k]) f[k] = flags[k];
  let p = node.b.box(name, size, cf, color ?? C.Steel, material || "SmoothPlastic", f);
  if (flags.wedge) p.shape = "wedge";
  else if (flags.cyl) p.shape = "cyl";
  else if (flags.ball) p.shape = "ball";
  return p;
}
const cyl = (node, name, length, dia, cf, color, material, flags = {}) => P(node, name, v(length, dia, dia), cf, color, material, { ...flags, cyl: true });
const lookAlong = (pos, dir) => CF.lookAlong(pos, dir);
const bar = (node, name, a, b, w, color, material, flags) => P(node, name, v(w, w, b.sub(a).len), lookAlong(a.add(b).mul(0.5), b.sub(a)), color, material, flags);
const sign = (part, face, text, bg, fg) => envNode.b.sign(part, text, bg, fg, face);
let envNode = null;

function fenceRun(folder, a, b, screen, gateFrom, gateTo) {
  const dir = $sub(b, a);
  const len = dir.len;
  const unit = dir.unit();
  const panel = m(3.5);
  const n = Math.max(1, Math.floor($add($div(len, panel), 0.5)));
  const step = len / n;
  const h = m(2.0);
  let runStart = undefined;
  function closeRun(endT) {
    if ((runStart && (endT > $add(runStart, 0.5)))) {
      const pA = $add(a, $mul(unit, runStart));
      const pB = $add(a, $mul(unit, endT));
      const mid = $div($add(pA, pB), 2);
      const seg = $sub(pB, pA).len;
      const cfm = $mul(lookAlong($add(mid, v(0, $add($div(h, 2), 0.3), 0)), unit), CF.angles(0, Math.PI / 2, 0));
      P(folder, "FenceMesh", v(seg, h, 0.08), cfm, C.Galvanized, "DiamondPlate", { tr: 0.6, ns: true });
      P(folder, "FenceRail", v(seg, 0.12, 0.12), $mul(cfm, CF.at(0, $div(h, 2), 0)), C.Galvanized, "Metal", { nc: true });
      if (screen) {
        const scr = P(folder, "Windscreen", v(seg, $mul(h, 0.82), 0.05), $mul(cfm, CF.at(0, $mul($unm(h), 0.05), -0.1)), rgb(32, 64, 46), "Fabric", { tr: 0.08 });
      }
    }
    runStart = undefined;
  }
  for (let k = 0; k <= n; k += 1) {
    const t = k * step;
    const inGate = ((gateFrom && (t > gateFrom)) && (t < gateTo));
    if (!(inGate)) {
      let p = $add(a, $mul(unit, t));
      cyl(folder, "FencePost", $add(h, 0.4), 0.16, $mul(CF.at($add(p, v(0, $add($div(h, 2), 0.3), 0))), CF.angles(0, 0, Math.PI / 2)), C.Galvanized, "Metal");
      P(folder, "FenceFoot", v(m(0.6), 0.45, m(0.2)), $mul(lookAlong($add(p, v(0, 0.22, 0)), unit), CF.angles(0, Math.PI / 2, 0)), rgb(40, 42, 44), "SmoothPlastic", { ns: true });
      if (!(runStart)) {
        runStart = t;
      }
    } else {
      closeRun(t - step);
    }
  }
  closeRun(len);
}
function buildFencing(site, folder) {
  const lot = site.lotM.mul(S);
  let [hx, hz] = [lot.x / 2, lot.z / 2];
  const screened = (site.style !== "Rural");
  let gateCentre = 0;
  let count = 0;
  for (const b of site.bays) {
    if (Math.abs(b.pos.z * S) < hz) {
      gateCentre = gateCentre + b.pos.x * S;
      count = count + 1;
    }
  }
  gateCentre = (((count > 0) && gateCentre / count) || 0);
  const gateW = m(14);
  const [southA, southB] = [v(-hx, 0, -hz), v(hx, 0, -hz)];
  const gFrom = $sub($sub(gateCentre, $div(gateW, 2)), -hx);
  const gTo = $add(gFrom, gateW);
  if ((count === 0)) {
    [gFrom, gTo] = [$sub(hx, m(10)), $sub(hx, m(6))];
  }
  fenceRun(folder, southA, southB, screened, gFrom, gTo);
  fenceRun(folder, v(hx, 0, -hz), v(hx, 0, hz), screened);
  fenceRun(folder, v(hx, 0, hz), v(-hx, 0, hz), (screened && (site.style !== "Waterfront")));
  fenceRun(folder, v(-hx, 0, hz), v(-hx, 0, -hz), screened);
  const gx = $add(-hx, $div($add(gFrom, gTo), 2));
  const signPost = P(folder, "GateSignPost", v(0.4, m(3.2), 0.4), CF.at($add($add(gx, $div(gateW, 2)), 2), m(1.6), -hz - 1.5), C.SteelDark, "Metal");
  const board = P(folder, "GateSign", v(m(2.8), m(1.6), 0.15), CF.at($add($add(gx, $div(gateW, 2)), 2), m(2.6), -hz - 1.6), C.OffWhite, "SmoothPlastic");
  sign(board, "front", "STEELRISE\nCONSTRUCTION SITE\nPPE REQUIRED · DELIVERIES REPORT TO GATE", C.Charcoal, C.Safety);
  for (let k = 0; k <= 3; k += 1) {
    const banner = P(folder, "Banner", v(m(6), m(1.4), 0.06), CF.at($add($add(-hx, m(12)), $mul(k, m(26))), m(1.3), -hz - 0.25), C.Charcoal, "Fabric", { nc: true });
    if ((($add($add(-hx, m(12)), $mul(k, m(26))) < $sub(gx, gateW)) || ($add($add(-hx, m(12)), $mul(k, m(26))) > $add(gx, gateW)))) {
      sign(banner, "front", "STEELRISE  ·  HARD HAT AREA", C.Charcoal, C.Safety);
    } else {
      folder.b.parts.splice(folder.b.parts.indexOf(banner), 1);
    }
  }
}
function tree(folder, pos, rng, scale) {
  scale = (scale || 1);
  const h = $mul(rng.num(5, 9), scale);
  cyl(folder, "Trunk", m(h * 0.45), m(0.3), $mul(CF.at($add(pos, v(0, m(h * 0.22), 0))), CF.angles(0, 0, Math.PI / 2)), rgb(86, 66, 48), "Wood");
  const leaf = rgb($add(62, rng.int(-8, 8)), $add(92, rng.int(-10, 10)), 52);
  P(folder, "Canopy", v(m(h * 0.55), m(h * 0.6), m(h * 0.55)), CF.at($add(pos, v(0, m(h * 0.68), 0))), leaf, "LeafyGrass", { ball: true, nc: true });
}
function car(folder, cf, rng) {
  const colours = [rgb(180, 180, 184), rgb(30, 32, 36), rgb(150, 24, 28), rgb(40, 70, 130), rgb(230, 230, 228)];
  const col = colours[rng.int(1, (colours).length)];
  P(folder, "CarBody", v(m(4.6), m(0.8), m(1.8)), $mul(cf, CF.at(0, m(0.6), 0)), col, "Metal", { refl: 0.05 });
  P(folder, "CarCabin", v(m(2.4), m(0.6), m(1.6)), $mul(cf, CF.at($unm(m(0.2)), m(1.3), 0)), rgb(40, 48, 56), "Glass", { refl: 0.1 });
  for (const sx of [-1.5, 1.4]) {
    for (const sz of [-0.85, 0.85]) {
      cyl(folder, "Wheel", m(0.25), m(0.66), $mul($mul(cf, CF.at(m(sx), m(0.33), m(sz))), CF.angles(0, Math.PI / 2, 0)), C.Rubber, "SmoothPlastic", { ns: true });
    }
  }
}
function building(folder, pos, w, d, h, kind, rng) {
  let [body, band] = [];
  if ((kind === "glass")) {
    body = rgb(70, 92, 108);
    band = rgb(150, 170, 182);
  } else if ((kind === "brick")) {
    body = rgb(140, 86, 66);
    band = rgb(46, 54, 62);
  } else if ((kind === "warehouse")) {
    body = rgb(176, 180, 182);
    band = rgb(120, 124, 128);
  } else {
    body = rgb(196, 190, 178);
    band = rgb(56, 66, 76);
  }
  const mat = (((kind === "glass") && "Glass") || (((kind === "brick") && "Brick") || (((kind === "warehouse") && "Metal") || "Concrete")));
  const main = P(folder, "Building", v(w, h, d), CF.at($add(pos, v(0, h / 2, 0))), body, mat, { refl: (((kind === "glass") && 0.12) || 0) });
  if ((kind === "warehouse")) {
    const ribs = Math.floor($div(w, m(2)));
    for (let k = 0; k <= ribs; k += 1) {
      P(folder, "Rib", v(0.3, h - 1, $add(d, 0.3)), CF.at($add(pos, v(-w / 2 + k * w / ribs, h / 2, 0))), band, "Metal", { nc: true, ns: true });
    }
    P(folder, "Roof", v(w + 1, 1, $add(d, 1)), CF.at($add(pos, v(0, h + 0.5, 0))), rgb(120, 112, 100), "CorrodedMetal");
    P(folder, "Door", v(m(5), m(5), 0.4), CF.at($add(pos, v(0, m(2.5), $sub($div($unm(d), 2), 0.2)))), rgb(70, 90, 120), "Metal", { nc: true });
    return main;
  }
  const floorH = m(3.6);
  const floors = Math.floor($div(h, floorH));
  const stride = Math.max(1, Math.ceil(floors / 28));
  for (let f = 1; f <= floors - 1; f += stride) {
    let y = $sub($mul(f, floorH), $mul(floorH, 0.45));
    P(folder, "Band", v(w + 0.2, $mul($mul(floorH, 0.5), stride), $add(d, 0.2)), CF.at($add(pos, v(0, $add(y, $mul($mul(floorH, 0.25), stride - 1)), 0))), band, "Glass", { nc: true, ns: true, refl: 0.15 });
  }
  P(folder, "Parapet", v(w + 0.6, 1.2, $add(d, 0.6)), CF.at($add(pos, v(0, h + 0.6, 0))), body, mat, { nc: true });
  if ((h > m(12))) {
    P(folder, "Plant", v(w * 0.4, m(2.5), $mul(d, 0.4)), CF.at($add(pos, v(rng.num(-w * 0.2, w * 0.2), $add(h, m(1.25)), 0))), rgb(150, 150, 146), "Metal");
  }
  return main;
}
function house(folder, pos, yaw, rng) {
  const [w, d, h] = [m(rng.num(9, 12)), m(rng.num(8, 10)), m(rng.num(5.5, 7))];
  const cf = $mul(CF.at(pos), CF.angles(0, yaw, 0));
  const wall = [rgb(214, 206, 190), rgb(176, 120, 92), rgb(200, 204, 206)][rng.int(1, 3) - 1];
  P(folder, "House", v(w, h, d), $mul(cf, CF.at(0, $div(h, 2), 0)), wall, "Brick");
  const roof = rgb(70, 66, 64);
  P(folder, "Roof", v(w + 1, m(2.2), d / 2 + 0.5), cf.mul(CF.at(0, h + m(1.1), -d / 4 - 0.25)).mul(CF.angles(0, Math.PI, 0)), roof, "Slate", { wedge: true });
  P(folder, "Roof", v(w + 1, m(2.2), d / 2 + 0.5), cf.mul(CF.at(0, h + m(1.1), d / 4 + 0.25)), roof, "Slate", { wedge: true });
  for (let k = -1; k <= 1; k += 1) {
    P(folder, "Window", v(m(1.2), m(1.3), 0.2), $mul(cf, CF.at($div($mul(k, w), 3), $mul(h, 0.6), $sub($div($unm(d), 2), 0.05))), C.Glass, "Glass", { nc: true, refl: 0.2 });
  }
}
function buildSurroundings(site, folder) {
  const lot = site.lotM.mul(S);
  let [hx, hz] = [lot.x / 2, lot.z / 2];
  const rng = new Rng(hashString(site.id) + 7);
  const style = site.style;
  const roadZ = $sub(-hz, m(9));
  const lineCount = Math.floor($div(lot.x + 400, m(9)));
  for (let k = 0; k <= lineCount; k += 1) {
    const x = $add(-lot.x / 2 - 200, $mul(k, m(9)));
    P(folder, "LaneMark", v(m(3), 0.06, m(0.15)), CF.at(x, 0.03, roadZ), rgb(232, 226, 210), "SmoothPlastic", { nc: true, ns: true, nq: true });
  }
  for (let k = -3; k <= 3; k += 1) {
    const x = $mul(k, m(30));
    const pole = cyl(folder, "LampPost", m(8), m(0.2), $mul(CF.at(x, m(4), $sub(roadZ, m(7.5))), CF.angles(0, 0, Math.PI / 2)), C.SteelDark, "Metal");
    const head = P(folder, "LampHead", v(m(0.6), m(0.2), m(1.4)), CF.at(x, m(8), $sub(roadZ, m(6.9))), C.SteelDark, "Metal", { nc: true });
    folder.lights.push({ kind: "street", pos: v(x, m(8) - 0.3, roadZ - m(6.9)), color: rgb(255, 214, 160), range: 40, angle: 110 });
  }
  function ring(count, inner, outer, fn) {
    for (let k = 1; k <= count; k += 1) {
      const ang = $add($mul($mul($div(k, count), Math.PI), 2), rng.num(-0.1, 0.1));
      const r = rng.num(inner, outer);
      const [dx, dz] = [Math.cos(ang), Math.sin(ang)];
      const t = Math.min($div($add(hx, r), Math.max(Math.abs(dx), 1e-3)), $div($add(hz, r), Math.max(Math.abs(dz), 1e-3)));
      let p = v(dx * t, 0, dz * t);
      if (((p.z < $add(-hz, m(2))) && (p.z > $sub(roadZ, m(32))))) {
        p = v(p.x, 0, $sub($sub(roadZ, m(32)), rng.num(0, m(10))));
      }
      fn(p, ang);
    }
  }
  if ((style === "Rural")) {
    for (let _ = 1; _ <= 26; _ += 1) {
      let p = v(rng.num(-hx - 300, hx + 300), 0, rng.num(hz + 20, hz + 300));
      tree(folder, p, rng);
    }
    for (let _ = 1; _ <= 10; _ += 1) {
      tree(folder, v(rng.num(-hx - 200, -hx - 20), 0, rng.num(-hz, hz)), rng);
    }
  } else if ((style === "Suburban")) {
    ring(7, m(30), m(55), (p) => {
      building(folder, p, m(rng.num(28, 44)), m(rng.num(18, 26)), m(rng.num(8, 14)), "concrete", rng);
    });
    for (let k = 1; k <= 18; k += 1) {
      car(folder, $mul(CF.at($add($add(-hx, m(10)), $mul(k, m(3.2))), 0, $sub(roadZ, m(18))), CF.angles(0, Math.PI / 2, 0)), rng);
    }
    for (let _ = 1; _ <= 30; _ += 1) {
      tree(folder, v(rng.num(-hx - 150, hx + 150), 0, rng.num(hz + 10, hz + 160)), rng, 1.1);
    }
  } else if ((((style === "Downtown") || (style === "CityCenter")) || (style === "HighRise"))) {
    let [lo, hi] = [30, 90];
    if ((style === "CityCenter")) {
      [lo, hi] = [60, 160];
    } else if ((style === "HighRise")) {
      [lo, hi] = [50, 140];
    }
    building(folder, v(0, 0, $add(hz, m(10))), lot.x, m(18), m(rng.num(lo * 0.5, lo)), "brick", rng);
    building(folder, v($sub(-hx, m(10)), 0, 0), m(18), lot.z, m(rng.num(lo * 0.6, lo * 1.2)), "concrete", rng);
    ring(16, m(42), m(100), (p) => {
      const kind = (((rng.next() < 0.5) && "glass") || "concrete");
      building(folder, p, m(rng.num(24, 40)), m(rng.num(24, 40)), m(rng.num(lo, hi)), kind, rng);
    });
    for (let k = 1; k <= 10; k += 1) {
      car(folder, $mul(CF.at($add(-hx, $mul(k, m(6))), 0, $sub(roadZ, m(3.2))), CF.angles(0, Math.PI / 2, 0)), rng);
    }
  } else if ((style === "Waterfront")) {
    P(folder, "QuayWall", v(lot.x + 900, m(3), m(1)), CF.at(0, $unm(m(1.5)), $add(hz, m(12.5))), rgb(150, 146, 138), "Concrete");
    for (let k = -6; k <= 6; k += 1) {
      cyl(folder, "Bollard", m(0.7), m(0.4), $mul(CF.at($mul(k, m(14)), m(0.35), $add(hz, m(11))), CF.angles(0, 0, Math.PI / 2)), C.SteelDark, "Metal");
    }
    building(folder, v($add(hx, m(30)), 0, 0), m(30), m(40), m(26), "glass", rng);
    building(folder, v($sub(-hx, m(30)), 0, $unm(m(5))), m(34), m(30), m(22), "concrete", rng);
    building(folder, v($sub(-hx, m(70)), 0, m(10)), m(28), m(28), m(34), "glass", rng);
    for (let k = 1; k <= 2; k += 1) {
      const hull = P(folder, "Boat", v(m(16), m(2.5), m(5)), CF.at($sub($mul(k, m(40)), m(60)), m(0.3), $add($add(hz, m(30)), $mul(k, m(10)))), C.OffWhite, "SmoothPlastic");
      P(folder, "Wheelhouse", v(m(5), m(2.2), m(3.6)), $mul(hull.cf, CF.at(m(2), m(2.3), 0)), rgb(46, 56, 70), "Glass", { nc: true });
    }
  } else if ((style === "Industrial")) {
    building(folder, v($sub(-hx, m(36)), 0, m(10)), m(60), m(46), m(12), "warehouse", rng);
    building(folder, v($add(hx, m(40)), 0, $unm(m(4))), m(64), m(52), m(14), "warehouse", rng);
    building(folder, v(m(30), 0, $add(hz, m(45))), m(90), m(40), m(11), "warehouse", rng);
    const railZ = $add(hz, m(8));
    for (const dz of [-0.72, 0.72]) {
      P(folder, "Rail", v(lot.x + 600, m(0.15), m(0.07)), CF.at(0, m(0.32), $add(railZ, m(dz))), rgb(110, 100, 92), "Metal");
    }
    for (let k = 0; k <= Math.floor($div(lot.x + 600, m(2.4))); k += 1) {
      P(folder, "Sleeper", v(m(0.25), m(0.15), m(2.6)), CF.at($add(-(lot.x + 600) / 2, $mul(k, m(2.4))), m(0.18), railZ), rgb(70, 60, 50), "Wood", { ns: true });
    }
    for (let k = 0; k <= 5; k += 1) {
      const c = [rgb(160, 50, 40), rgb(40, 90, 140), rgb(200, 140, 40)][(k % 3 + 1) - 1];
      P(folder, "Container", v(m(12.2), m(2.6), m(2.45)), CF.at($add($sub(-hx, m(20)), $mul(k % 3, m(13))), $add(m(1.3), $mul(Math.floor(k / 3), m(2.6))), $sub(-hz, m(30))), c, "Metal");
    }
  } else if ((style === "Residential")) {
    for (let k = 0; k <= 9; k += 1) {
      house(folder, v($add($add(-hx, m(8)), $mul(k, m(14))), 0, $add(hz, m(14))), 0, rng);
      house(folder, v($add($add(-hx, m(8)), $mul(k, m(14))), 0, $sub(roadZ, m(16))), Math.PI, rng);
    }
    for (let _ = 1; _ <= 24; _ += 1) {
      tree(folder, v(rng.num(-hx - 100, hx + 100), 0, rng.num(hz + 26, hz + 120)), rng);
    }
  }
}
function buildSiteDressing(site, folder) {
  const lot = site.lotM.mul(S);
  const [hx, hz] = [lot.x / 2, lot.z / 2];
  const ld = site.laydownM;
  const lc = ld.center.mul(S);
  for (let k = 0; k <= 5; k += 1) {
    P(folder, "Dunnage", v($mul(ld.size.x * S, 0.8), m(0.1), m(0.12)), CF.at(lc.x, m(0.05), $add($sub(lc.z, $mul(ld.size.z * S, 0.35)), k * ld.size.z * S * 0.14)), C.Timber, "Wood", { ns: true });
  }
  const cb = site.crane.posM.mul(S);
  for (const off of [v(1, 0, 1), v(-1, 0, 1), v(1, 0, -1), v(-1, 0, -1)]) {
    let p = $add(cb, $mul(off, m(5.2)));
    P(folder, "CraneBarrier", v(m(2), m(1), m(0.5)), $mul(CF.at($add(p, v(0, m(0.5), 0))), CF.angles(0, rad(45 * off.x * off.z), 0)), rgb(240, 92, 24), "SmoothPlastic");
  }
  const craneSign = P(folder, "CraneSign", v(m(1.6), m(1.1), 0.12), $mul(CF.at($add(cb, v(m(5.2), m(1.6), 0))), CF.angles(0, Math.PI / 2, 0)), C.Safety, "SmoothPlastic");
  sign(craneSign, "front", "DANGER\nOVERHEAD LOADS", C.Safety, C.Charcoal);
  P(folder, "CraneSignPost", v(0.3, m(1.2), 0.3), CF.at($add(cb, v(m(5.25), m(0.6), 0))), C.SteelDark, "Metal");
  let corner = v($add(-hx, m(8)), 0, $add(-hz, m(6)));
  if (((site.style === "Downtown") || (site.style === "CityCenter"))) {
    corner = v($add(-hx, m(4)), 0, $sub(hz, m(4)));
  }
  const office = P(folder, "SiteOffice", v(m(6.06), m(2.6), m(2.44)), CF.at($add(corner, v(0, m(1.3), 0))), rgb(226, 226, 220), "Metal");
  P(folder, "OfficeWindow", v(m(1.2), m(0.9), 0.1), CF.at($add(corner, v($unm(m(1)), m(1.6), m(1.23)))), C.Glass, "Glass", { nc: true, refl: 0.2 });
  P(folder, "OfficeDoor", v(m(0.9), m(2), 0.1), CF.at($add(corner, v(m(2.2), m(1.1), m(1.23)))), rgb(70, 74, 80), "Metal", { nc: true });
  const plate = P(folder, "OfficeSign", v(m(2.4), m(0.5), 0.08), CF.at($add(corner, v(0, m(2.3), m(1.25)))), C.Charcoal, "SmoothPlastic", { nc: true });
  sign(plate, "back", "SITE OFFICE", C.Charcoal, C.Safety);
  for (let k = 0; k <= 1; k += 1) {
    const tp = $add(corner, v($add(m(4.6), $mul(k, m(1.3))), 0, 0));
    P(folder, "Toilet", v(m(1.1), m(2.3), m(1.2)), CF.at($add(tp, v(0, m(1.15), 0))), rgb(28, 98, 168), "SmoothPlastic");
  }
  const skip = $add(corner, v(m(10), 0, 0));
  P(folder, "Skip", v(m(5.4), m(1.5), m(2.3)), CF.at($add(skip, v(0, m(0.75), 0))), rgb(46, 92, 58), "Metal");
}

// Ground surface patches (top at y = 0, water below). Later layers draw over
// earlier ones. Studs, like the original FillBlock calls.
const GROUND_COLOURS = {
  Grass: rgb(92, 112, 62),
  Pavement: rgb(150, 149, 142),
  Ground: rgb(118, 102, 78),
  Mud: rgb(78, 64, 50),
  Slate: rgb(124, 122, 116),
  Concrete: rgb(166, 163, 156),
  Asphalt: rgb(58, 60, 63),
};

function buildTerrain(site) {
  const patches = [];
  const add = (cf, sx, sz, mat) => patches.push({ cf, sx, sz, mat, color: GROUND_COLOURS[mat] });
  const lot = site.lotM.mul(S);
  const extent = v(lot.x + 900, 0, lot.z + 900);
  const urban = !(site.style === "Rural" || site.style === "Suburban" || site.style === "Residential");
  add(new CF(), extent.x, extent.z, urban ? "Pavement" : "Grass");
  add(new CF(), lot.x, lot.z, "Ground");
  const rng = new Rng(hashString(site.id));
  for (let i = 0; i < 10; i++) {
    const px = rng.num(-lot.x / 2 + 20, lot.x / 2 - 20);
    const pz = rng.num(-lot.z / 2 + 20, lot.z / 2 - 20);
    const sz = rng.num(18, 40);
    add(CF.at(px, 0, pz), sz, sz * rng.num(0.6, 1.4), "Mud");
  }
  for (const b of site.bays) {
    let p = b.pos;
    if (Math.abs(p.x * S) < lot.x / 2 && Math.abs(p.z * S) < lot.z / 2) add(new CF(p.x * S, 0, p.z * S, b.r), m(24), m(5), "Slate");
  }
  const cb = site.crane.posM.mul(S);
  add(CF.at(cb.x, 0, cb.z), m(9), m(9), "Concrete");
  const ld = site.laydownM;
  add(CF.at(ld.center.x * S, 0, ld.center.z * S), ld.size.x * S, ld.size.z * S, "Slate");
  const roadZ = -lot.z / 2 - m(9);
  add(CF.at(0, 0, roadZ), extent.x, m(14), "Asphalt");
  add(CF.at(0, 0, -lot.z / 2 - m(1.2)), extent.x, m(2.4), "Concrete");
  if (site.style === "Downtown" || site.style === "CityCenter" || site.style === "HighRise") {
    add(CF.at(lot.x / 2 + m(9), 0, 0), m(14), extent.z, "Asphalt");
    add(CF.at(lot.x / 2 + m(1.2), 0, 0), m(2.4), extent.z, "Concrete");
  }
  let water = null;
  if (site.style === "Waterfront") {
    add(CF.at(0, 0, lot.z / 2 + m(6)), extent.x, m(12), "Pavement");
    water = { minZ: (lot.z / 2 + m(13)) / S, y: -2 / S, width: extent.x / S };
  }
  if (site.rail) add(CF.at(0, 0, lot.z / 2 + m(8)), extent.x, m(8), "Slate");
  for (const p of patches) {
    p.cf = new CF(p.cf.x / S, 0, p.cf.z / S, p.cf.r);
    p.sx /= S;
    p.sz /= S;
  }
  return { patches, water, extent: extent.mul(1 / S) };
}

// Lighting presets per site (sun position, haze, tint), read by the renderer.
export function isNight(clock) {
  return clock >= 18.3 || clock < 6.6;
}

function toMetres(node) {
  let k = 1 / S;
  for (const p of node.b.parts) {
    p.size = p.size.mul(k);
    p.cf = new CF(p.cf.x * k, p.cf.y * k, p.cf.z * k, p.cf.r);
  }
  for (const l of node.lights) {
    l.pos = l.pos.mul(k);
    l.range *= k;
  }
  return node;
}

// Everything static around the lot. Returns { node, terrain }.
export function buildEnvironment(site) {
  const env = new Node("Environment");
  env.lights = [];
  envNode = env;
  const sur = new Node("Surroundings");
  sur.lights = env.lights;
  buildFencing(site, env);
  buildSiteDressing(site, env);
  buildSurroundings(site, sur);
  envNode = null;
  // surroundings parts go into their own node so the renderer can skip their colliders
  toMetres(env);
  const lights = env.lights;
  sur.lights = [];
  toMetres(sur);
  return { env, surroundings: sur, lights, terrain: buildTerrain(site) };
}
