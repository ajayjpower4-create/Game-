// Tower crane kinematics (metres / radians).
//   slew     : jib heading about the mast
//   trolley  : trolley radius from the mast centre along the jib
//   hoist    : rope length from the trolley sheaves to the hook point
//   swingX/Z : pendulum offset of the hook point in the jib frame
//   loadYaw  : load rotation about the hook (taglines / rotator)

import { CF, V3, v, VY, VX, clamp, wrapAngle } from "../core/math.js";
import { Config, craneCapacityKg } from "../core/config.js";

const K = Config.Crane;

export const TrolleyY = 0.5 / 3; // sheave point under the jib
export const JibBottomY = 2.0 / 3;
export const JibHeight = 4.5 / 3;
export const JibWidth = 3.6 / 3;
export const MastWidth = 4.8 / 3;
export const CabOffset = v(1.2 / 3, -1.4 / 3, 5.0 / 3); // cab centre beside the jib root
export const CabEye = v(1.8 / 3, -0.4 / 3, 5.0 / 3); // operator eye point
export const HookBlockHeight = 1.0;

export function craneConfig(def) {
  const base = def.posM;
  const height = def.heightM;
  return {
    base,
    height,
    pivot: base.add(v(0, height, 0)),
    jib: def.jibM,
    counter: def.counterM,
    minR: 4,
    maxR: def.jibM - 1.5,
    minRope: 4 / 3,
    maxRope: height + TrolleyY - 1 / 3,
    maxKg: def.maxKg,
    fullRadiusM: def.fullRadiusM,
    def,
  };
}

export function defaultState(def) {
  return { slew: ((def.slewDeg || 0) * Math.PI) / 180, trolley: def.jibM * 0.45, hoist: 20 / 3, swingX: 0, swingZ: 0, loadYaw: 0 };
}

export const slewCf = (cfg, slew) => CF.from(cfg.pivot).mul(CF.angles(0, slew, 0));
export const trolleyCf = (cfg, st) => slewCf(cfg, st.slew).mul(CF.at(st.trolley, TrolleyY, 0));

export function hookPos(cfg, st) {
  const s = slewCf(cfg, st.slew);
  const trolley = s.point(v(st.trolley, TrolleyY, 0));
  const swing = s.vecToWorld(v(st.swingX || 0, 0, st.swingZ || 0));
  const rope = st.hoist;
  const horiz = swing.len;
  const drop = Math.sqrt(Math.max(rope * rope - horiz * horiz, 0.001));
  return trolley.add(swing).sub(v(0, drop, 0));
}

export const hookCf = (cfg, st) => CF.from(hookPos(cfg, st)).mul(CF.angles(0, st.slew, 0));

// hook block frame, tilted along the rope
export function blockCf(cfg, st) {
  const hook = hookPos(cfg, st);
  const trolley = trolleyCf(cfg, st).pos;
  let up = trolley.sub(hook);
  up = up.len < 0.003 ? VY : up.unit();
  let fwd = CF.angles(0, st.slew, 0).look;
  let right = fwd.cross(up);
  right = right.len < 0.003 ? VX : right.unit();
  fwd = up.cross(right);
  return CF.fromMatrix(hook, right, up, fwd.neg());
}

export const loadCf = (cfg, st, rigOffset) => hookCf(cfg, st).mul(CF.angles(0, st.loadYaw || 0, 0)).mul(rigOffset);

export function liftCentre(def) {
  let sum = new V3();
  for (const p of def.liftPoints) sum = sum.add(p);
  return sum.div(Math.max(def.liftPoints.length, 1));
}

// load pose relative to the hook frame, by rigging mode
export function rigOffset(def, loadCfNow, hookCfNow) {
  let rel;
  if (def.rigging === "Upright") rel = new CF();
  else if (def.rigging === "Pitch") rel = CF.angles(0, 0, def.pitch || 0);
  else rel = hookCfNow.rot.inverse().mul(loadCfNow.rot);
  const t = v(0, -K.SlingDrop, 0).sub(rel.vecToWorld(liftCentre(def)));
  return CF.from(t).mul(rel);
}

export const capacityKg = (cfg, radius) => craneCapacityKg(cfg, radius);

// largest trolley radius that can carry `kg`
export function maxRadiusFor(cfg, kg) {
  if (kg <= 0) return cfg.maxR;
  if (kg > cfg.maxKg) return 0;
  return clamp((cfg.maxKg * cfg.fullRadiusM) / kg, cfg.minR, cfg.maxR);
}

export function sanitize(cfg, st) {
  st.trolley = clamp(st.trolley, cfg.minR, cfg.maxR);
  st.hoist = clamp(st.hoist, cfg.minRope, cfg.maxRope);
  const maxSwing = st.hoist * 0.35;
  st.swingX = clamp(st.swingX || 0, -maxSwing, maxSwing);
  st.swingZ = clamp(st.swingZ || 0, -maxSwing, maxSwing);
  st.slew = wrapAngle(st.slew);
  st.loadYaw = wrapAngle(st.loadYaw);
  return st;
}
