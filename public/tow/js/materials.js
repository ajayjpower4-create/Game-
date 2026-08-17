// Shared material cache. Everything in Skyville is flat-shaded chunky plastic —
// the Roblox look — so materials are cheap and heavily reused.
import * as THREE from 'three';

const cache = new Map();

export function mat(color, opts = {}) {
  const key = color + '|' + JSON.stringify(opts);
  let m = cache.get(key);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: opts.roughness ?? 0.75,
    metalness: opts.metalness ?? 0.05,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    emissive: new THREE.Color(opts.emissive ?? 0x000000),
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    flatShading: opts.flatShading ?? false,
    depthWrite: opts.depthWrite ?? true,
  });
  cache.set(key, m);
  return m;
}

export function paint(color) {
  return mat(color, { roughness: 0.42, metalness: 0.08 });
}

export function glass(tint = 0x111820, opacity = 0.62) {
  return mat(tint, { roughness: 0.08, metalness: 0.2, transparent: true, opacity });
}

export function lightMat(color, intensity = 1.4) {
  return mat(color, { emissive: color, emissiveIntensity: intensity, roughness: 0.3 });
}

export function texMat(texture, opts = {}) {
  return new THREE.MeshStandardMaterial({
    map: texture,
    roughness: opts.roughness ?? 0.85,
    metalness: opts.metalness ?? 0,
    transparent: opts.transparent ?? false,
    emissive: new THREE.Color(opts.emissive ?? 0x000000),
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    emissiveMap: opts.emissiveMap ?? null,
    side: opts.side ?? THREE.FrontSide,
  });
}

/* Common colours used across the city and the fleet. */
export const C = {
  tire: 0x15161a,
  rim: 0xb9bcc4,
  rimDark: 0x54585f,
  chrome: 0xd6dae2,
  steel: 0x8f959e,
  darkSteel: 0x3d4148,
  glassDark: 0x0e141c,
  headlight: 0xfff6dc,
  tail: 0xd21f1f,
  amber: 0xff9a12,
  amberDim: 0x6b3d05,
  plate: 0xf2f3f0,
  road: 0x37383d,
  roadLine: 0xf3e79a,
  concrete: 0x9a9c9a,
  sidewalk: 0xa8a9a4,
  grass: 0x4f7a3a,
  dirt: 0x6b5a42,
  brickRed: 0x8d4f3c,
  brickTan: 0xb9a184,
  glassBuilding: 0x5f7d92,
  roofTar: 0x2f3136,
  signGreen: 0x0d5c33,
  signBlue: 0x123c78,
  white: 0xf5f6f4,
  black: 0x14151a,
  rust: 0x7a4a2a,
};

/* Car paint colours — deliberately saturated, toy-like. */
export const CAR_COLORS = [
  0xc0392b, 0x2874a6, 0x1e8449, 0xf1c40f, 0xd35400, 0x7d3c98,
  0x17202a, 0xecf0f1, 0x839192, 0x1abc9c, 0x2e4053, 0xa93226,
  0x5d6d7e, 0xf39c12, 0x196f3d, 0x76448a, 0xb03a2e, 0xd5d8dc,
];
