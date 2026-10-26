// Shared physically based materials. Car paint is a clear-coated metallic
// over the base color; glass, chrome, rubber and plastics each get the
// roughness/metalness a real one has so reflections from the sky read right.
import * as THREE from 'three';
import * as TX from './textures.js';

const paintCache = new Map();
const matCache = new Map();

function once(key, fn) {
  if (!matCache.has(key)) matCache.set(key, fn());
  return matCache.get(key);
}

// Metallic flake paint vs solid paint. `seamMap` darkens the panel gaps.
export function carPaint(color, { metallic = true, seamMap = null, matte = false } = {}) {
  const key = `${color}|${metallic}|${seamMap ? seamMap.uuid : ''}|${matte}`;
  if (paintCache.has(key)) return paintCache.get(key);
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    metalness: metallic ? 0.55 : 0.05,
    roughness: matte ? 0.6 : metallic ? 0.38 : 0.3,
    clearcoat: matte ? 0.0 : 1.0,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.15,
    map: seamMap,
  });
  paintCache.set(key, m);
  return m;
}

export const glassOpaque = () => once('glassOpaque', () => new THREE.MeshPhysicalMaterial({
  color: 0x0b0f14, metalness: 0.0, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02,
  envMapIntensity: 1.6, reflectivity: 0.9,
}));

// See-through glass for tow truck cabs (you can see the interior).
export const glassClear = () => once('glassClear', () => new THREE.MeshPhysicalMaterial({
  color: 0x9fb4c0, metalness: 0, roughness: 0.03, transparent: true, opacity: 0.18,
  envMapIntensity: 1.4, depthWrite: false, side: THREE.DoubleSide,
}));

export const chrome = () => once('chrome', () => new THREE.MeshStandardMaterial({
  color: 0xe8e8ec, metalness: 1, roughness: 0.08, envMapIntensity: 1.3,
}));

export const satinMetal = () => once('satinMetal', () => {
  const b = TX.brushed(3);
  return new THREE.MeshStandardMaterial({
    color: 0xb9bcc2, metalness: 1, roughness: 0.35, normalMap: b.normalMap, roughnessMap: b.roughnessMap,
  });
});

export const darkSteel = () => once('darkSteel', () => {
  const b = TX.brushed(9);
  return new THREE.MeshStandardMaterial({
    color: 0x2b2d31, metalness: 0.85, roughness: 0.5, normalMap: b.normalMap, roughnessMap: b.roughnessMap,
  });
});

export const frameBlack = () => once('frameBlack', () => new THREE.MeshStandardMaterial({
  color: 0x121314, metalness: 0.4, roughness: 0.55,
}));

export const blackTrim = () => once('blackTrim', () => {
  const p = TX.texturedPlastic();
  return new THREE.MeshStandardMaterial({ color: 0x141516, metalness: 0, roughness: 0.62, normalMap: p.normalMap });
});

export const glossBlack = () => once('glossBlack', () => new THREE.MeshPhysicalMaterial({
  color: 0x050506, metalness: 0.2, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05,
}));

export const rubber = () => once('rubber', () => new THREE.MeshStandardMaterial({
  color: 0x18181a, metalness: 0, roughness: 0.92,
}));

export const tireRubber = (pattern = 0) => once('tire' + pattern, () => {
  const t = TX.tireTread(pattern);
  const n = t.normalMap.clone();
  n.needsUpdate = true;
  n.repeat.set(1, 1);
  return new THREE.MeshStandardMaterial({ color: 0x1d1d1f, metalness: 0, roughness: 0.88, normalMap: n, normalScale: new THREE.Vector2(1.2, 1.2) });
});

export const sidewall = () => once('sidewall', () => {
  const t = TX.tireSidewall();
  return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, metalness: 0, roughness: 0.85 });
});

export const alloy = (color = 0xc9ccd1, rough = 0.28) => once('alloy' + color + rough, () => new THREE.MeshPhysicalMaterial({
  color, metalness: 1, roughness: rough, clearcoat: 0.6, clearcoatRoughness: 0.1,
}));

export const brakeDisc = () => once('disc', () => {
  const b = TX.brushed(12);
  return new THREE.MeshStandardMaterial({ color: 0x77736e, metalness: 0.9, roughness: 0.45, normalMap: b.normalMap });
});

export const caliper = (color = 0x2a2a2c) => once('caliper' + color, () => new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.45 }));

export const underbody = () => once('under', () => new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.95 }));

export const plateWhite = () => once('plateWhite', () => new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.4 }));

// Lens materials carry their own emissive so a light can be switched on.
export function lightLens(kind, texture = null) {
  const base = {
    head: { color: 0xdfe6ee, emissive: 0xfff6e0 },
    tail: { color: 0x5c0608, emissive: 0xff1a0d },
    amber: { color: 0x8a4a05, emissive: 0xffa31a },
    reverse: { color: 0xd8d8d8, emissive: 0xffffff },
    red: { color: 0x700000, emissive: 0xff0000 },
    blue: { color: 0x001060, emissive: 0x2050ff },
  }[kind];
  return new THREE.MeshPhysicalMaterial({
    color: base.color, emissive: base.emissive, emissiveIntensity: 0, metalness: 0.1, roughness: 0.08,
    clearcoat: 1, clearcoatRoughness: 0.02, map: texture, emissiveMap: texture, envMapIntensity: 1.4,
  });
}

export const hiVis = (color) => once('hivis' + color, () => new THREE.MeshStandardMaterial({
  color, emissive: color, emissiveIntensity: 0.12, roughness: 0.75,
}));

export const reflectiveTape = () => once('tape', () => new THREE.MeshStandardMaterial({
  color: 0xd9dde0, metalness: 0.6, roughness: 0.25, emissive: 0x444444, emissiveIntensity: 0.2,
}));

export const cloth = (color, rough = 0.85) => once('cloth' + color + rough, () => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 }));

export function std(color, rough = 0.6, metal = 0) {
  return once(`std${color}|${rough}|${metal}`, () => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal }));
}
