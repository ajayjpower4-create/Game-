// Flat-top tower crane, modelled on modern 8–10 t city cranes. Ported from
// the Roblox CraneFactory: geometry is authored in studs (3 per metre) like
// the original and scaled to metres when the nodes are finished.
//   Static  : foundation, mast, ladder, access gate (world frame)
//   Slew    : jib, counter-jib, cab; frame at the slewing pivot, jib along +X
//   Trolley : frame at the sheave point
//   Hook    : frame at the hook bowl

import { CF, V3, v, rad } from "../core/math.js";
import { Config, rgb, craneCapacityKg } from "../core/config.js";
import { $add, $sub, $mul, $div, $unm, $fmt } from "../core/lua.js";
import { Node } from "./node.js";

const C = Config.Colors;
const YELLOW = rgb(242, 182, 16);
const YELLOW_DARK = rgb(206, 150, 10);
const GREY = rgb(72, 76, 82);
const DARK = rgb(34, 36, 40);
const WHITE = rgb(232, 232, 228);
const GLASS = rgb(120, 150, 165);
const GRATE = rgb(96, 100, 104);
const CONCRETE = rgb(156, 154, 148);
const ROPE = rgb(46, 46, 48);
export const ROPE_COLOR = ROPE;

const S = 3;
const m = (x) => x * S;
// stud-space constants (the original CraneMath)
const CM = { TrolleyY: 0.5, JibBottomY: 2.0, JibHeight: 4.5, JibWidth: 3.6, MastWidth: 4.8, CabOffset: v(1.2, -1.4, 5.0) };

function P(node, name, size, cf, color, material, flags = {}) {
  let f = {};
  for (const k of ["nc", "ns", "nq", "tr", "refl"]) if (flags[k]) f[k] = flags[k];
  const p = node.b.box(name, size, cf, color, material || "Metal", f);
  if (flags.wedge) p.shape = "wedge";
  else if (flags.cyl) p.shape = "cyl";
  else if (flags.ball) p.shape = "ball";
  p.node = node;
  return p;
}
const cyl = (node, name, length, dia, cf, color, material, flags = {}) => P(node, name, v(length, dia, dia), cf, color, material, { ...flags, cyl: true });
const bar = (node, name, a, b, w, color, material, flags) => P(node, name, v(w, w, b.sub(a).len), CF.lookAlong(a.add(b).mul(0.5), b.sub(a)), color, material, flags);
const tube = (node, name, a, b, dia, color, material, flags) => cyl(node, name, b.sub(a).len, dia, CF.lookAlong(a.add(b).mul(0.5), b.sub(a)).mul(CF.angles(0, Math.PI / 2, 0)), color, material, flags);
const sign = (part, face, text, bg, fg) => part.node.b.sign(part, text, bg, fg, face);

function buildStatic(cfg) {
  const stat = new Node("Static");
  const base = cfg.base;
  const Wm = CM.MastWidth;
  const half = $sub($div(Wm, 2), 0.3);
  P(stat, "Foundation", v(m(7), m(0.6), m(7)), CF.at($add(base, v(0, m(0.3), 0))), CONCRETE, "Concrete");
  P(stat, "FoundationTop", v(m(6.6), m(0.06), m(6.6)), CF.at($add(base, v(0, m(0.63), 0))), rgb(146, 144, 138), "Concrete", { nc: true });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const c = $add(base, v($mul(sx, half), 0, $mul(sz, half)));
      P(stat, "FixingAngle", v(1.1, m(1.1), 1.1), CF.at($add(c, v(0, $add(m(0.65), m(0.55)), 0))), YELLOW_DARK, "Metal");
      P(stat, "FixingPlate", v(2.2, 0.25, 2.2), CF.at($add(c, v(0, m(0.66), 0))), DARK, "Metal", { nc: true });
      for (const bx of [-0.75, 0.75]) {
        for (const bz of [-0.75, 0.75]) {
          cyl(stat, "AnchorNut", 0.25, 0.3, $mul(CF.at($add(c, v(bx, $add(m(0.66), 0.2), bz))), CF.angles(0, 0, Math.PI / 2)), DARK, "Metal", { nc: true, ns: true });
        }
      }
    }
  }
  const mastBottom = $add(base.y, m(1.2));
  const mastTop = cfg.pivot.y - 1.0;
  const mastH = $sub(mastTop, mastBottom);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const [cx, cz] = [$add(base.x, $mul(sx, half)), $add(base.z, $mul(sz, half))];
      P(stat, "ChordA", v(0.6, mastH, 0.16), CF.at($sub(cx, sx * 0.22), $add(mastBottom, $div(mastH, 2)), cz), YELLOW, "Metal");
      P(stat, "ChordB", v(0.16, mastH, 0.6), CF.at(cx, $add(mastBottom, $div(mastH, 2)), $sub(cz, sz * 0.22)), YELLOW, "Metal");
    }
  }
  let section = m(3);
  const nSec = Math.max(1, Math.floor($add($div(mastH, section), 0.5)));
  section = $div(mastH, nSec);
  const corners = [v($unm(half), 0, $unm(half)), v(half, 0, $unm(half)), v(half, 0, half), v($unm(half), 0, half)];
  for (let k = 0; k <= nSec - 1; k += 1) {
    const y0 = $add(mastBottom, $mul(k, section));
    const y1 = $add(y0, section);
    for (let f = 1; f <= 4; f += 1) {
      const [a, b] = [corners[f - 1], corners[(f % 4 + 1) - 1]];
      const entry = ((k === 0) && (f === 1));
      function at(c, y) {
        return v(base.x + c.x, y, base.z + c.z);
      }
      if (!(entry)) {
        const mid = $div($add(y0, y1), 2);
        bar(stat, "Lacing", at(a, $add(y0, 0.4)), at(b, mid), 0.24, YELLOW, "Metal", { ns: true });
        bar(stat, "Lacing", at(b, mid), at(a, $sub(y1, 0.4)), 0.24, YELLOW, "Metal", { ns: true });
        bar(stat, "Strut", $sub(at(b, mid), $mul($sub(b, a), 0.0)), at(a, mid), 0.18, YELLOW, "Metal", { ns: true });
      }
      bar(stat, "Girt", at(a, $add(y0, 0.15)), at(b, $add(y0, 0.15)), 0.22, YELLOW, "Metal", { ns: true, nc: entry });
    }
    if ((k > 0)) {
      for (const c of corners) {
        P(stat, "FishPlate", v(0.9, 0.9, 0.9), CF.at(base.x + c.x, y0, base.z + c.z), YELLOW_DARK, "Metal", { nc: true, ns: true });
      }
    }
    if (((k > 0) && (k % 4 === 0))) {
      P(stat, "RestPlatform", v($sub(Wm, 0.8), 0.15, $sub($div($sub(Wm, 0.8), 2), 1.1)), CF.at(base.x, $add(y0, 0.2), $add($add(base.z, $div($sub(Wm, 0.8), 4)), 0.55)), GRATE, "DiamondPlate", { ns: true });
    }
  }
  // caged mast ladder: visible rails/rungs plus a climbable volume
  const ladH = 2 * Math.max(1, Math.floor(mastH / 2));
  const ladCf = CF.at(base.x, mastBottom + ladH / 2, base.z - 0.6);
  for (const sx of [-0.6, 0.6]) P(stat, "LadderRail", v(0.12, ladH, 0.12), ladCf.mul(CF.at(sx, 0, 0)), rgb(196, 198, 202), "Metal", { nc: true, ns: true });
  for (let y = 0.6; y < ladH; y += 0.9) P(stat, "LadderRung", v(1.2, 0.08, 0.08), ladCf.mul(CF.at(0, -ladH / 2 + y, 0)), rgb(196, 198, 202), "Metal", { nc: true, ns: true });
  stat.b.climb("MastLadder", v(2, ladH, 2), ladCf);
  const ringOuter = $add(Wm, 2.4);
  const ringW = $div($sub(ringOuter, 2.6), 2);
  for (const s of [-1, 1]) {
    P(stat, "TopPlatform", v(ringW, 0.3, ringOuter), CF.at($add(base.x, $mul(s, $add(1.3, $div(ringW, 2)))), mastTop - 0.2, base.z), GRATE, "DiamondPlate");
    P(stat, "TopPlatform", v(2.6, 0.3, ringW), CF.at(base.x, mastTop - 0.2, $add(base.z, $mul(s, $add(1.3, $div(ringW, 2))))), GRATE, "DiamondPlate");
    P(stat, "TopRail", v(ringOuter, 0.18, 0.18), CF.at(base.x, mastTop + 3.2, $add(base.z, $mul(s, $div(ringOuter, 2)))), YELLOW, "Metal", { nc: true });
    P(stat, "TopRail", v(0.18, 0.18, ringOuter), CF.at($add(base.x, $mul(s, $div(ringOuter, 2))), mastTop + 3.2, base.z), YELLOW, "Metal", { nc: true });
    for (const t of [-1, 1]) {
      P(stat, "TopPost", v(0.18, 3.4, 0.18), CF.at($add(base.x, $div($mul(s, ringOuter), 2)), mastTop + 1.5, $add(base.z, $div($mul(t, ringOuter), 2))), YELLOW, "Metal", { nc: true, ns: true });
    }
  }
  const topAccess = P(stat, "CraneAccessTop", v($add(Wm, 2), 5, $add(Wm, 2)), CF.at(base.x, mastTop + 2.4, base.z), YELLOW, "Metal", { tr: 1, nc: true });
  topAccess.interact = "CraneAccess";
  cyl(stat, "SlewRing", 0.8, $add(Wm, 1.0), $mul(CF.at($sub(cfg.pivot, v(0, 0.6, 0))), CF.angles(0, 0, Math.PI / 2)), DARK, "Metal", { nc: true });
  const gateZ = $unm($add($div(Wm, 2), 1.2));
  const access = P(stat, "CraneAccess", v($add(Wm, 1), m(2.4), 1), CF.at($add(base, v(0, $add(m(0.65), m(1.2)), gateZ))), YELLOW, "Metal", { tr: 0.85, nc: true });
  access.interact = "CraneAccess";
  for (const s of [-1, 1]) {
    P(stat, "GatePost", v(0.25, m(2.2), 0.25), CF.at($add(base, v($mul(s, $add($div(Wm, 2), 0.6)), $add(m(0.65), m(1.1)), gateZ))), YELLOW, "Metal", { ns: true });
  }
  P(stat, "GateRail", v($add(Wm, 1.2), 0.2, 0.2), CF.at($add(base, v(0, $add(m(0.65), m(2.2)), gateZ))), YELLOW, "Metal", { nc: true, ns: true });
  const gateSign = P(stat, "AccessSign", v(2.6, 1.5, 0.1), CF.at($add(base, v(0, m(1.9), $sub(gateZ, 0.15)))), C.Safety, "SmoothPlastic", { nc: true });
  sign(gateSign, "front", "CRANE ACCESS\nAUTHORISED OPERATORS", C.Safety, C.Charcoal);
  const chart = P(stat, "LoadChart", v(2.6, 2.0, 0.1), $mul(CF.at($add(base, v($add($div(Wm, 2), 0.9), m(1.8), 0))), CF.angles(0, -Math.PI / 2, 0)), WHITE, "SmoothPlastic", { nc: true });
  const lines = [$fmt("LOAD CHART  %d t", Math.floor($add($div(cfg.maxKg, 1000), 0.5)))];
  for (const r of [cfg.fullRadiusM, 30, 40, 50, 60]) {
    if ((m(r) <= $add(cfg.maxR, 1))) {
      lines.push($fmt("%2d m  %5.1f t", r, $div(craneCapacityKg(cfg, r), 1000)));
    }
  }
  sign(chart, "front", lines.join("\n"), WHITE, C.Charcoal);
  return stat;
}
function buildSlew(cfg) {
  const slew = new Node("Slew");
  const frame = new CF();
  function sp(name, size, localCf, color, material, flags) {
    return P(slew, name, size, $mul(frame, localCf), color, material, flags);
  }
  function sbar(name, a, b, w, color, flags) {
    return bar(slew, name, $mul(frame, a), $mul(frame, b), w, (color || YELLOW), "Metal", flags);
  }
  const Wm = CM.MastWidth;
  const [jy, jh, jw] = [CM.JibBottomY, CM.JibHeight, CM.JibWidth];
  cyl(slew, "Turntable", 1.0, $add(Wm, 0.8), $mul($mul(frame, CF.at(0, 0.3, 0)), CF.angles(0, 0, Math.PI / 2)), YELLOW, "Metal", { nc: true });
  cyl(slew, "RingGear", 0.35, $add(Wm, 1.1), $mul($mul(frame, CF.at(0, -0.05, 0)), CF.angles(0, 0, Math.PI / 2)), DARK, "Metal", { nc: true, ns: true });
  sp("SlewPlatform", v($add(Wm, 2.2), 1.4, $add(Wm, 1.4)), CF.at(0, 1.2, 0), YELLOW, "Metal", { nc: true });
  sp("PlatformDeck", v($add(Wm, 3.4), 0.15, $add(Wm, 3.0)), CF.at(0, 1.98, 0), GRATE, "DiamondPlate", { nc: true });
  for (const sz of [-1, 1]) {
    cyl(slew, "SlewMotor", 1.6, 0.9, $mul($mul(frame, CF.at(-1.4, 2.8, sz * 1.6)), CF.angles(0, 0, Math.PI / 2)), GREY, "Metal", { nc: true });
    sp("SlewGearbox", v(1.0, 0.7, 1.0), CF.at(-1.4, 1.95, sz * 1.6), DARK, "Metal", { nc: true, ns: true });
  }
  sp("ElectricalBox", v(1.6, 2.4, 1.0), CF.at(-2.0, 3.2, -0.2), WHITE, "Metal", { nc: true });
  for (const sz of [-1, 1]) {
    sp("JibHeel", v(2.4, 2.2, 0.5), CF.at(2.2, $add(jy, 0.6), $div($mul(sz, jw), 2)), YELLOW_DARK, "Metal", { nc: true });
    cyl(slew, "HeelPin", 0.9, 0.5, $mul($mul(frame, CF.at(2.2, $add(jy, 0.4), $div($mul(sz, jw), 2))), CF.angles(0, Math.PI / 2, 0)), GREY, "Metal", { nc: true, ns: true });
  }
  sp("AnemometerMast", v(0.18, 7, 0.18), CF.at(0.5, $add($add(jy, jh), 2.5), -1.2), YELLOW, "Metal", { nc: true, ns: true });
  sp("AnemometerArm", v(1.2, 0.08, 0.08), CF.at(0.5, $add($add(jy, jh), 6.0), -1.2), GREY, "Metal", { nc: true, ns: true });
  for (const dx of [-0.6, 0.6]) {
    P(slew, "Cup", v(0.3, 0.3, 0.3), $mul(frame, CF.at(0.5 + dx, $add($add(jy, jh), 6.0), -1.2)), WHITE, "SmoothPlastic", { nc: true, ns: true, ball: true });
  }
  const topLight = sp("TopBeacon", v(0.45, 0.45, 0.45), CF.at(0.5, $add($add(jy, jh), 6.3), -1.2), rgb(255, 40, 30), "Neon", { nc: true, ns: true });
  topLight.shape = "ball";
  const [jibStart, jibEnd] = [2.4, cfg.jib];
  const jl = $sub(jibEnd, jibStart);
  for (const sz of [-1, 1]) {
    sp("JibChord", v(jl, 0.55, 0.55), CF.at($add(jibStart, $div(jl, 2)), jy, $div($mul(sz, jw), 2)), YELLOW, "Metal", { nc: true });
    sp("RailFlange", v(jl, 0.12, 0.9), CF.at($add(jibStart, $div(jl, 2)), $add(jy, 0.33), $div($mul(sz, jw), 2)), YELLOW_DARK, "Metal", { nc: true, ns: true });
  }
  sp("JibTopChord", v(jl, 0.5, 0.5), CF.at($add(jibStart, $div(jl, 2)), $add(jy, jh), 0), YELLOW, "Metal", { nc: true });
  sp("Walkway", v($sub(jl, 1), 0.1, 0.9), CF.at($add(jibStart, $div(jl, 2)), $sub(jy, 0.35), $sub($div($unm(jw), 2), 0.75)), GRATE, "DiamondPlate", { nc: true, ns: true });
  sp("WalkwayRail", v($sub(jl, 1), 0.1, 0.1), CF.at($add(jibStart, $div(jl, 2)), $add(jy, 2.4), $sub($div($unm(jw), 2), 1.15)), YELLOW, "Metal", { nc: true, ns: true });
  const bayLen = 9;
  const nb = Math.floor($div(jl, bayLen));
  for (let k = 0; k <= nb - 1; k += 1) {
    const x0 = jibStart + k * bayLen;
    const xm = x0 + bayLen / 2;
    const x1 = x0 + bayLen;
    for (const sz of [-1, 1]) {
      sbar("JibLace", v(x0, $add(jy, 0.2), $div($mul(sz, jw), 2)), v(xm, $sub($add(jy, jh), 0.1), 0), 0.24, YELLOW, { nc: true, ns: true });
      sbar("JibLace", v(xm, $sub($add(jy, jh), 0.1), 0), v(x1, $add(jy, 0.2), $div($mul(sz, jw), 2)), 0.24, YELLOW, { nc: true, ns: true });
    }
    sbar("JibTie", v(x0, jy, $div($unm(jw), 2)), v(x0, jy, $div(jw, 2)), 0.2, YELLOW, { nc: true, ns: true });
    sbar("JibPlanBrace", v(x0, jy, $div($unm(jw), 2)), v(x1, jy, $div(jw, 2)), 0.16, YELLOW, { nc: true, ns: true });
    if (((k % 3 === 0) && (k > 0))) {
      for (const sz of [-1, 1]) {
        sp("SectionPin", v(0.7, 0.9, 0.9), CF.at(x0, jy, $div($mul(sz, jw), 2)), YELLOW_DARK, "Metal", { nc: true, ns: true });
      }
      sp("SectionPinTop", v(0.7, 0.8, 0.8), CF.at(x0, $add(jy, jh), 0), YELLOW_DARK, "Metal", { nc: true, ns: true });
    }
    sp("RailPost", v(0.1, 2.5, 0.1), CF.at(x0, $add(jy, 1.15), $sub($div($unm(jw), 2), 1.15)), YELLOW, "Metal", { nc: true, ns: true });
  }
  sp("JibTip", v(0.8, $add(jh, 0.6), $add(jw, 0.6)), CF.at(jibEnd, $add(jy, $div(jh, 2)), 0), YELLOW, "Metal", { nc: true });
  sp("TipBuffer", v(0.6, 0.6, jw), CF.at($sub(jibEnd, 0.7), $sub(jy, 0.1), 0), DARK, "SmoothPlastic", { nc: true, ns: true });
  const tipLight = sp("AviationLight", v(0.5, 0.5, 0.5), CF.at(jibEnd, $add($add(jy, jh), 0.6), 0), rgb(255, 40, 30), "Neon", { nc: true, ns: true });
  tipLight.shape = "ball";
  tube(slew, "TrolleyRope", $mul(frame, v(jibStart + 0.5, $sub(jy, 0.15), 0.35)), $mul(frame, v($sub(jibEnd, 0.8), $sub(jy, 0.15), 0.35)), 0.07, ROPE, "Metal", { nc: true, ns: true, nq: true });
  tube(slew, "HoistRope", $mul(frame, v(-8, $add(jy, 2.6), 0)), $mul(frame, v($sub(jibEnd, 0.8), $sub(jy, 0.15), -0.35)), 0.08, ROPE, "Metal", { nc: true, ns: true, nq: true });
  const cl = cfg.counter;
  for (const sz of [-1, 1]) {
    sp("CounterGirder", v(cl, 1.4, 0.7), CF.at($sub($div($unm(cl), 2), 1.5), $add(jy, 0.5), sz * 1.9), YELLOW, "Metal", { nc: true });
    sp("Handrail", v(cl, 0.15, 0.15), CF.at($sub($div($unm(cl), 2), 1.5), $add(jy, 3.6), sz * 2.75), YELLOW, "Metal", { nc: true, ns: true });
    sp("MidRail", v(cl, 0.1, 0.1), CF.at($sub($div($unm(cl), 2), 1.5), $add(jy, 2.4), sz * 2.75), YELLOW, "Metal", { nc: true, ns: true });
    const posts = Math.max(2, Math.floor($div(cl, 5)));
    for (let k = 0; k <= posts; k += 1) {
      sp("RailPost", v(0.15, 2.4, 0.15), CF.at($sub(-2, $div($mul(k, $sub(cl, 2)), posts)), $add(jy, 2.4), sz * 2.75), YELLOW, "Metal", { nc: true, ns: true });
    }
    sbar("CounterTie", v(-1.5, $add(jy, 3.2), sz * 1.9), v($mul($unm(cl), 0.6), $add(jy, 1.2), sz * 1.9), 0.25, YELLOW, { nc: true, ns: true });
  }
  for (let k = 0; k <= Math.floor($div(cl, 3)); k += 1) {
    sp("CounterCross", v(0.3, 0.3, 3.8), CF.at(-1.5 - k * 3, $sub(jy, 0.1), 0), YELLOW, "Metal", { nc: true, ns: true });
  }
  sp("CounterWalkway", v(cl, 0.15, 5.0), CF.at($sub($div($unm(cl), 2), 1.5), $add(jy, 1.25), 0), GRATE, "DiamondPlate", { nc: true });
  const wx = -7.5;
  cyl(slew, "WinchMotor", 2.2, 1.4, $mul($mul(frame, CF.at(wx, $add(jy, 2.2), -1.6)), CF.angles(0, Math.PI / 2, 0)), GREY, "Metal", { nc: true });
  sp("WinchGearbox", v(1.6, 1.6, 1.0), CF.at(wx, $add(jy, 2.2), -0.15), DARK, "Metal", { nc: true });
  const drum = cyl(slew, "WinchDrum", 2.6, 1.7, $mul($mul(frame, CF.at(wx, $add(jy, 2.2), 1.7)), CF.angles(0, Math.PI / 2, 0)), YELLOW_DARK, "Metal", { nc: true });
  drum.drum = true;
  cyl(slew, "DrumRope", 2.2, 1.85, $mul($mul(frame, CF.at(wx, $add(jy, 2.2), 1.7)), CF.angles(0, Math.PI / 2, 0)), ROPE, "Metal", { nc: true, ns: true });
  for (const dz of [0.3, 3.1]) {
    cyl(slew, "DrumFlange", 0.15, 2.2, $mul($mul(frame, CF.at(wx, $add(jy, 2.2), dz)), CF.angles(0, Math.PI / 2, 0)), YELLOW, "Metal", { nc: true, ns: true });
  }
  sp("WinchFrame", v(3.0, 0.4, 5.2), CF.at(wx, $add(jy, 1.35), 0.4), DARK, "Metal", { nc: true, ns: true });
  sp("ElectricHouse", v(3.0, 2.6, 2.4), CF.at(-12.5, $add(jy, 2.6), -0.9), WHITE, "Metal", { nc: true });
  sp("HouseDoor", v(1.0, 2.0, 0.05), CF.at(-12.5, $add(jy, 2.4), -2.13), rgb(200, 200, 196), "Metal", { nc: true, ns: true });
  sp("HouseRoof", v(3.2, 0.15, 2.6), CF.at(-12.5, $add(jy, 3.95), -0.9), GREY, "Metal", { nc: true, ns: true });
  const slabs = 5;
  const slabT = 1.0;
  const tailX = $sub($unm(cl), 1.5);
  for (let k = 0; k <= slabs - 1; k += 1) {
    const x = $add($add(tailX, 0.6), k * (slabT + 0.08));
    sp("Counterweight", v(slabT, m(2.4), 4.6), CF.at(x, $sub(jy, m(0.55)), 0), CONCRETE, "Concrete", { nc: true });
    sp("LiftEye", v(0.3, 0.4, 0.15), CF.at(x, $add(jy, m(0.67)), 1.6), DARK, "Metal", { nc: true, ns: true });
  }
  for (const sz of [-1, 1]) {
    sp("WeightStrap", v(slabs * 1.1 + 0.4, 0.3, 0.12), CF.at($add($add(tailX, 0.6), (slabs - 1) * 0.54), $add(jy, 0.9), sz * 2.35), DARK, "Metal", { nc: true, ns: true });
  }
  sp("TailRail", v(0.15, 0.15, 5.6), CF.at($sub(tailX, 0.2), $add(jy, 3.6), 0), YELLOW, "Metal", { nc: true, ns: true });
  for (const sz of [-1, 1]) {
    const brand = sp("Brand", v($mul(cl, 0.42), 1.6, 0.12), CF.at($sub($div($unm(cl), 2), 1.5), $add(jy, 3.0), sz * 2.85), C.Charcoal, "Metal", { nc: true, ns: true });
    sign(brand, sz > 0 ? "back" : "front", "STEELRISE", C.Charcoal, YELLOW);
  }
  const co = CM.CabOffset;
  const cabCf = $mul(frame, CF.at(co));
  function cp(name, size, localCf, color, material, flags) {
    return P(slew, name, size, $mul(cabCf, localCf), color, material, flags);
  }
  cp("CabFloor", v(3.8, 0.25, 3.2), CF.at(0, -2.25, 0), DARK, "DiamondPlate", { nc: true });
  cp("CabRoof", v(4.0, 0.3, 3.4), CF.at(0, 2.25, 0), WHITE, "Metal", { nc: true });
  cp("CabBack", v(0.2, 4.4, 3.2), CF.at(-1.9, 0, 0), WHITE, "Metal", { nc: true });
  cp("CabSideIn", v(3.8, 4.4, 0.2), CF.at(0, 0, -1.6), WHITE, "Metal", { nc: true });
  cp("CabSideLow", v(3.8, 1.3, 0.2), CF.at(0, -1.55, 1.6), WHITE, "Metal", { nc: true });
  const side = cp("CabSideGlass", v(3.2, 2.7, 0.06), CF.at(0.1, 0.7, 1.6), GLASS, "Glass", { nc: true, tr: 0.45, refl: 0.15, ns: true });
  side.nq = true;
  const front = cp("CabFrontGlass", v(0.06, 4.0, 3.0), $mul(CF.at(1.9, 0, 0), CF.angles(0, 0, rad(-8))), GLASS, "Glass", { nc: true, tr: 0.5, refl: 0.12, ns: true });
  front.nq = true;
  cp("CabFloorGlass", v(1.4, 0.06, 2.6), CF.at(1.1, -2.1, 0), GLASS, "Glass", { nc: true, tr: 0.55, ns: true, nq: true });
  for (const z of [-1.55, 0, 1.55]) {
    cp("FrontFrame", v(0.15, 4.0, 0.12), $mul(CF.at(1.92, 0, z), CF.angles(0, 0, rad(-8))), DARK, "Metal", { nc: true, ns: true });
  }
  cp("FrontSill", v(0.2, 0.15, 3.2), CF.at(1.95, -1.95, 0), DARK, "Metal", { nc: true, ns: true });
  cp("FrontHead", v(0.2, 0.15, 3.2), CF.at(1.65, 1.95, 0), DARK, "Metal", { nc: true, ns: true });
  cp("SideMullion", v(0.12, 2.7, 0.12), CF.at(0.1, 0.7, 1.62), DARK, "Metal", { nc: true, ns: true });
  cp("Wiper", v(0.05, 1.6, 0.06), $mul(CF.at(2.02, -0.6, 0.4), CF.angles(rad(25), 0, 0)), DARK, "Metal", { nc: true, ns: true });
  cp("RoofAC", v(1.2, 0.5, 1.0), CF.at(-0.9, 2.65, 0), WHITE, "Metal", { nc: true });
  cp("Seat", v(1.0, 0.3, 1.0), CF.at(0.1, -1.3, 0), C.Charcoal, "Fabric", { nc: true });
  cp("SeatBack", v(0.25, 1.4, 1.0), CF.at(-0.45, -0.6, 0), C.Charcoal, "Fabric", { nc: true });
  cp("ConsoleL", v(0.9, 0.7, 0.35), CF.at(0.5, -1.0, -0.8), C.Charcoal, "SmoothPlastic", { nc: true });
  cp("ConsoleR", v(0.9, 0.7, 0.35), CF.at(0.5, -1.0, 0.8), C.Charcoal, "SmoothPlastic", { nc: true });
  const screen = cp("Display", v(0.06, 0.5, 0.8), CF.at(1.5, -0.2, -0.9), rgb(20, 60, 80), "Neon", { nc: true, ns: true });
  screen.tr = 0.2;
  const door = cp("CabDoor", v(3.6, 4.0, 0.3), CF.at(0, 0, -1.75), YELLOW, "Metal", { tr: 0.9, nc: true });
  door.interact = "CraneCab";
  cp("CabWalk", v(3.4, 0.15, 2.0), CF.at(0, -2.3, -2.6), GRATE, "DiamondPlate", { nc: true, ns: true });
  return slew;
}
function buildTrolley(cfg) {
  const trolley = new Node("Trolley");
  const tcf = new CF();
  const jw = CM.JibWidth;
  P(trolley, "Frame", v(3.4, 0.7, $add(jw, 0.9)), $mul(tcf, CF.at(0, 1.0, 0)), YELLOW, "Metal", { nc: true });
  for (const sx of [-1.3, 1.3]) {
    for (const sz of [-1, 1]) {
      cyl(trolley, "Wheel", 0.35, 0.65, $mul($mul(tcf, CF.at(sx, 1.85, $div($mul(sz, jw), 2))), CF.angles(0, Math.PI / 2, 0)), DARK, "Metal", { nc: true, ns: true });
      P(trolley, "WheelBracket", v(0.9, 0.9, 0.15), $mul(tcf, CF.at(sx, 1.6, $mul(sz, $add($div(jw, 2), 0.3)))), YELLOW_DARK, "Metal", { nc: true, ns: true });
    }
  }
  for (const sx of [-0.55, 0.55]) {
    cyl(trolley, "Sheave", 0.3, 1.0, $mul($mul(tcf, CF.at(sx, 0.25, 0)), CF.angles(0, Math.PI / 2, 0)), DARK, "Metal", { nc: true, ns: true });
    P(trolley, "SheaveGuard", v(1.1, 0.8, 0.12), $mul(tcf, CF.at(sx, 0.3, 0.25)), YELLOW, "Metal", { nc: true, ns: true });
  }
  const bcf = $mul(tcf, CF.at(0, -0.8, $unm($add($div(jw, 2), 1.4))));
  P(trolley, "BasketFloor", v(2.2, 0.1, 1.2), $mul(bcf, CF.at(0, -1.2, 0)), GRATE, "DiamondPlate", { nc: true, ns: true });
  for (const sx of [-1.05, 1.05]) {
    for (const sz of [-0.55, 0.55]) {
      P(trolley, "BasketPost", v(0.1, 2.6, 0.1), $mul(bcf, CF.at(sx, 0, sz)), YELLOW, "Metal", { nc: true, ns: true });
    }
  }
  P(trolley, "BasketRail", v(2.2, 0.1, 0.1), $mul(bcf, CF.at(0, 0, -0.55)), YELLOW, "Metal", { nc: true, ns: true });
  P(trolley, "BasketRail", v(2.2, 0.1, 0.1), $mul(bcf, CF.at(0, 0, 0.55)), YELLOW, "Metal", { nc: true, ns: true });
  return trolley;
}
function buildHook(cfg) {
  const hook = new Node("Hook");
  const hcf = new CF();
  P(hook, "Block", v(1.3, 2.0, 1.6), $mul(hcf, CF.at(0, 1.9, 0)), YELLOW, "Metal", { nc: true });
  for (const sz of [-1, 1]) {
    P(hook, "SidePlate", v(1.6, 2.3, 0.12), $mul(hcf, CF.at(0, 1.95, sz * 0.86)), YELLOW, "Metal", { nc: true });
    for (let k = 0; k <= 3; k += 1) {
      P(hook, "Stripe", v(0.3, 2.2, 0.03), $mul($mul(hcf, CF.at(-0.6 + k * 0.4, 1.95, sz * 0.93)), CF.angles(0, 0, rad(30))), (((k % 2 === 0) && C.Charcoal) || YELLOW), "SmoothPlastic", { nc: true, ns: true });
    }
  }
  const plate = P(hook, "CapacityPlate", v(0.9, 0.45, 0.04), $mul(hcf, CF.at(0, 1.3, 0.95)), WHITE, "SmoothPlastic", { nc: true, ns: true });
  sign(plate, "back", $fmt("SWL %d t", Math.floor($add($div(cfg.maxKg, 1000), 0.5))), WHITE, C.Charcoal);
  for (const dz of [-0.35, 0.35]) {
    cyl(hook, "BlockSheave", 0.25, 1.2, $mul($mul(hcf, CF.at(0, 2.9, dz)), CF.angles(0, Math.PI / 2, 0)), DARK, "Metal", { nc: true, ns: true });
  }
  cyl(hook, "Swivel", 0.35, 0.7, $mul($mul(hcf, CF.at(0, 0.85, 0)), CF.angles(0, 0, Math.PI / 2)), DARK, "Metal", { nc: true });
  cyl(hook, "Shank", 0.6, 0.38, $mul($mul(hcf, CF.at(0, 0.45, 0)), CF.angles(0, 0, Math.PI / 2)), GREY, "Metal", { nc: true });
  const bowl = [[-0.32, 0.1, -25], [-0.22, -0.25, -60], [0.05, -0.38, 0], [0.3, -0.25, 60], [0.38, 0.05, 90]];
  for (const [$i_i, seg] of (bowl).entries()) { const i = $i_i + 1;
    P(hook, "HookBowl" + i, v(0.32, 0.26, 0.3), $mul($mul(hcf, CF.at(seg[0], seg[1], 0)), CF.angles(0, 0, rad(seg[2]))), YELLOW, "Metal", { nc: true });
  }
  P(hook, "HookBack", v(0.3, 0.55, 0.3), $mul(hcf, CF.at(-0.34, 0.32, 0)), YELLOW, "Metal", { nc: true });
  P(hook, "Latch", v(0.06, 0.6, 0.08), $mul($mul(hcf, CF.at(0.05, 0.2, 0)), CF.angles(0, 0, rad(-40))), DARK, "Metal", { nc: true, ns: true });
  return hook;
}

// stud geometry -> metres
function toMetres(node) {
  let k = 1 / S;
  const scaleCf = (cf) => new CF(cf.x * k, cf.y * k, cf.z * k, cf.r);
  for (const p of node.b.parts) {
    p.size = p.size.mul(k);
    p.cf = scaleCf(p.cf);
    delete p.node;
  }
  for (const c of node.children) {
    c.cf = scaleCf(c.cf);
    toMetres(c);
  }
  return node;
}

// craneDef from the site (metres). Returns the four assemblies.
export function buildCrane(craneDef) {
  const cfg = {
    base: craneDef.posM.mul(S),
    pivot: craneDef.posM.add(v(0, craneDef.heightM, 0)).mul(S),
    jib: craneDef.jibM * S,
    counter: craneDef.counterM * S,
    maxR: (craneDef.jibM - 1.5) * S,
    maxKg: craneDef.maxKg,
    fullRadiusM: craneDef.fullRadiusM,
  };
  return {
    static: toMetres(buildStatic(cfg)),
    slew: toMetres(buildSlew(cfg)),
    trolley: toMetres(buildTrolley(cfg)),
    hook: toMetres(buildHook(cfg)),
  };
}
