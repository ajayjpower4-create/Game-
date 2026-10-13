/* Material library.
 *
 * Physically based materials over the procedural textures, cached by recipe so
 * a thousand windows share one material. Materials that change with the world
 * — glowing at night, darkening in the rain, whitening under snow, turning in
 * autumn — register themselves here, and the engine drives them all at once. */

import * as THREE from 'three';
import { surface, interiorTexture, glowTexture } from './textures.js';

const cache = new Map();
const nightReg = [];   // { mat, key, max }
const wetReg = [];     // { mat, dry }
const snowReg = [];    // { mat, base: Color, snow: Color }
const leafReg = [];    // { mat, kind }
const shinyReg = [];   // materials that carry their own reflection strength

const once = (key, make) => {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
};

function std(opts) {
  return clouds(new THREE.MeshStandardMaterial(opts));
}

/* Shader hooks. A material can carry several (anti-tiling, snow, cloud
 * shadows); each edits the shader in turn and adds to the program key, so
 * materials with the same hooks still share one compiled program. */
const HOOKS = new WeakMap();
function hook(mat, key, fn) {
  let list = HOOKS.get(mat);
  if (!list) {
    list = [];
    HOOKS.set(mat, list);
    mat.onBeforeCompile = (sh, r) => { for (const h of list) h.fn(sh, r); };
    mat.customProgramCacheKey = () => list.map((h) => h.key).join('|');
  }
  if (!list.some((h) => h.key === key)) list.push({ key, fn });
  return mat;
}

/* Cloud shadows: soft patches of shade that drift across the whole site with
 * the wind, darkening only the sunlight (so they read as real shadow, not
 * paint). One shared uniform: offset x, offset z, coverage, strength. */
const CLOUD_U = { value: new THREE.Vector4(0, 0, 0, 0) };
const CLOUD_VERT = `
  {
    vec4 clW = vec4( transformed, 1.0 );
    #ifdef USE_BATCHING
      clW = batchingMatrix * clW;
    #endif
    #ifdef USE_INSTANCING
      clW = instanceMatrix * clW;
    #endif
    vCloudXZ = ( modelMatrix * clW ).xz;
  }`;
const CLOUD_FRAG = `
  uniform vec4 cloudShadow;
  varying vec2 vCloudXZ;
  float clHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
  float clNoise( vec2 p ) {
    vec2 i = floor( p ); vec2 f = fract( p );
    vec2 u = f * f * ( 3.0 - 2.0 * f );
    return mix( mix( clHash( i ), clHash( i + vec2( 1.0, 0.0 ) ), u.x ), mix( clHash( i + vec2( 0.0, 1.0 ) ), clHash( i + vec2( 1.0, 1.0 ) ), u.x ), u.y );
  }
  float cloudShade() {
    if ( cloudShadow.w <= 0.0 ) return 1.0;
    vec2 p = ( vCloudXZ + cloudShadow.xy ) / 520.0;
    float n = clNoise( p ) * 0.55 + clNoise( p * 2.13 + 7.3 ) * 0.3 + clNoise( p * 4.71 + 3.1 ) * 0.15;
    float c = smoothstep( 1.0 - cloudShadow.z - 0.06, 1.0 - cloudShadow.z + 0.1, n );
    return 1.0 - c * cloudShadow.w;
  }`;
const LIGHTS_WITH_CLOUDS = THREE.ShaderChunk.lights_fragment_begin.replace(
  'getDirectionalLightInfo( directionalLight, directLight );',
  'getDirectionalLightInfo( directionalLight, directLight );\n\t\tdirectLight.color *= cloudShade();',
);
function clouds(mat) {
  if (!LIGHTS_WITH_CLOUDS.includes('cloudShade')) return mat;   // a three.js without the hook point
  return hook(mat, 'clouds', (sh) => {
    sh.uniforms.cloudShadow = CLOUD_U;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vCloudXZ;')
      .replace('#include <project_vertex>', `#include <project_vertex>\n${CLOUD_VERT}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${CLOUD_FRAG}`)
      .replace('#include <lights_fragment_begin>', LIGHTS_WITH_CLOUDS);
  });
}

function withSurface(name, extra = {}) {
  const s = surface(name);
  return {
    map: s.map || null,
    normalMap: s.normalMap || null,
    roughnessMap: s.roughnessMap || null,
    ...extra,
  };
}

/* The world's current state, so a material made after the clock or the
 * weather changed starts out matching everything else. */
const NOW = { night: 0, wet: 0, snow: 0, season: 'summer', env: null, envScale: 1 };

const night = (mat, key, max) => { nightReg.push({ mat, key, max }); mat[key] = max * NOW.night; return mat; };
const wet = (mat) => {
  const e = { mat, dry: mat.roughness, base: mat.color.clone() };
  wetReg.push(e);
  applyWet(e, NOW.wet);
  return mat;
};
/* Wet ground darkens and turns glossy. */
function applyWet(e, f) {
  e.mat.roughness = Math.max(0.08, e.dry * (1 - 0.8 * f));
  e.mat.color.copy(e.base).multiplyScalar(1 - 0.38 * f);
}
const shiny = (mat) => {
  clouds(mat);
  shinyReg.push(mat);
  mat.userData.baseEnv = mat.envMapIntensity;
  if (NOW.env) { mat.envMap = NOW.env; mat.envMapIntensity = mat.userData.baseEnv * NOW.envScale; }
  return mat;
};

/**
 * Break up the repeat of a big tiled surface: broad procedural noise, at a far
 * larger scale than the texture itself, varies its colour across the ground so
 * the grid of the tile never shows. (No second texture sample: some drivers
 * bind the wrong texture when one sampler is read twice.)
 */
const NOISE_GLSL = `
  float atHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float atNoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(atHash(i), atHash(i + vec2(1.0, 0.0)), u.x), mix(atHash(i + vec2(0.0, 1.0)), atHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }`;

function antiTile(mat, spanFt = 160, strength = 0.35) {
  const tile = mat.map ? 1 / mat.map.repeat.x : 10;
  return hook(mat, `antiTile|${spanFt}|${strength}|${tile}`, (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE_GLSL}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec2 ft = vMapUv * ${tile.toFixed(4)};
          float m1 = atNoise(ft / ${spanFt.toFixed(1)});
          float m2 = atNoise(ft / ${(spanFt * 0.31).toFixed(1)} + 17.0);
          float m = m1 * 0.65 + m2 * 0.35;
          diffuseColor.rgb *= 1.0 + (m - 0.5) * ${(2 * strength).toFixed(3)};
          // A slight shift in hue as well as brightness, as real ground has.
          float h = atNoise(ft / ${(spanFt * 0.55).toFixed(1)} + 41.0) - 0.5;
          diffuseColor.rgb *= vec3(1.0 + h * ${(0.25 * strength).toFixed(3)}, 1.0, 1.0 - h * ${(0.3 * strength).toFixed(3)});
        }`);
  });
}

/* Snow settles on whatever faces the sky — ground, roofs, the tops of cars
 * and trees — and nowhere else. One shared uniform drives every material. */
const SNOW_U = { value: 0 };
const SNOW_GLSL = `
  {
    vec3 upV = normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
    float facing = dot(normal, upV);
    float cover = snowAmount * smoothstep(0.35, 0.8, facing);
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.92, 0.95), cover);
    roughnessFactor = mix(roughnessFactor, 0.75, cover);
    metalnessFactor = mix(metalnessFactor, 0.0, cover);
  }`;

const snowy = (mat) => {
  snowReg.push({ mat });
  return hook(mat, 'snow', (sh) => {
    sh.uniforms.snowAmount = SNOW_U;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float snowAmount;')
      .replace('#include <lights_physical_fragment>', `${SNOW_GLSL}\n#include <lights_physical_fragment>`);
  });
};

/* ------------------------------------------------------------- buildings */

const CLAD = {
  precast: { surf: 'precast', rough: 0.88, metal: 0 },
  rib: { surf: 'rib', rough: 0.42, metal: 0.55 },
  brick: { surf: 'brick', rough: 0.9, metal: 0 },
  render: { surf: 'render', rough: 0.85, metal: 0 },
  stone: { surf: 'stone', rough: 0.9, metal: 0 },
  timber: { surf: 'timber', rough: 0.8, metal: 0 },
  composite: { surf: 'composite', rough: 0.32, metal: 0.4 },
};

export function wall(cladding, hex) {
  const c = CLAD[cladding] || CLAD.precast;
  return once(`wall|${cladding}|${hex}`, () => std({
    ...withSurface(c.surf), color: new THREE.Color(hex), roughness: c.rough, metalness: c.metal, normalScale: new THREE.Vector2(0.8, 0.8),
  }));
}

/** Plinth and reveals: plain concrete in a tone that sits with the wall. */
export function plinth() {
  return once('plinth', () => std({ ...withSurface('concrete'), color: new THREE.Color('#8f9196'), roughness: 0.92 }));
}

export function band(hex) {
  return once(`band|${hex}`, () => std({ color: new THREE.Color(hex), roughness: 0.38, metalness: 0.55 }));
}

export function glass() {
  return once('glass', () => shiny(new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#1b2a37'), roughness: 0.04, metalness: 0.1,
    envMapIntensity: 1.5, clearcoat: 1, clearcoatRoughness: 0.03, ior: 1.52, specularIntensity: 1,
  })));
}

/** Glass with a room behind it — dark by day, lit at night. */
export function glassLit(variant = 0) {
  return once(`glassLit|${variant}`, () => shiny(night(new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#1b2a37'), roughness: 0.04, metalness: 0.1, envMapIntensity: 1.5,
    clearcoat: 1, clearcoatRoughness: 0.03, emissive: new THREE.Color('#ffffff'),
    emissiveMap: interiorTexture(variant + 1), emissiveIntensity: 0,
  }), 'emissiveIntensity', 0.62)));
}

/** See-through glass for balustrades, bus shelters and canopies. */
export function clearGlass(tint = '#a9c3cf') {
  return once(`clearGlass|${tint}`, () => shiny(new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(tint), roughness: 0.05, metalness: 0, transparent: true, opacity: 0.28,
    depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.2,
  })));
}

/** Photovoltaic panels: deep blue glass over cells. */
export function solarPanel() {
  return once('solar', () => shiny(new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#1b2a44'), roughness: 0.16, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.2,
  })));
}

/** Opaque spandrel glass and dark infill panels. */
export function spandrel() {
  return once('spandrel', () => shiny(new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#2a3440'), roughness: 0.12, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.2,
  })));
}

export function frame(dark = false) {
  return once(`frame|${dark}`, () => std({ color: new THREE.Color(dark ? '#2b3138' : '#a7afb8'), roughness: 0.35, metalness: 0.85 }));
}

export function doorPanel(hex = '#8e98a3') {
  return once(`door|${hex}`, () => std({ ...withSurface('slats'), color: new THREE.Color(hex), roughness: 0.45, metalness: 0.5 }));
}

export function louvre() {
  return once('louvre', () => std({ ...withSurface('louvre'), color: new THREE.Color('#8b939c'), roughness: 0.5, metalness: 0.6 }));
}

/* Moving water: jets and falling sheets share streak textures that the frame
 * loop slides along, so the water visibly flows. */
const flowReg = [];

/** Water in motion. `along` is the texture axis the water runs down: 'u' for
 *  jets drawn as tubes, 'v' for falling sheets and curtains. */
export function waterFlow(along = 'v') {
  return once(`waterFlow|${along}`, () => {
    const a = surface('jet').map.clone();
    a.needsUpdate = true;
    if (along === 'u') { a.rotation = Math.PI / 2; a.center.set(0.5, 0.5); }
    a.repeat.set(along === 'u' ? 1 : 10, along === 'u' ? 2 : 1.5);
    const m = std({
      color: new THREE.Color('#eef8fc'), emissive: new THREE.Color('#b8dcef'), emissiveIntensity: 0.18,
      alphaMap: a, transparent: true, opacity: along === 'u' ? 0.9 : 0.55, depthWrite: false, side: THREE.DoubleSide, roughness: 0.1, metalness: 0,
    });
    flowReg.push({ tex: a, along });
    return m;
  });
}

/** White water where jets land. */
export function foam() {
  return once('foam', () => std({
    color: new THREE.Color('#f4fafc'), alphaMap: surface('foam').map, transparent: true, opacity: 0.85,
    depthWrite: false, roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
  }));
}

/** Slide the water textures on; called once a frame. */
export function flowWater(dt) {
  for (const f of flowReg) {
    if (f.along === 'u') f.tex.offset.y -= dt * 0.9;
    else f.tex.offset.y += dt * 0.9;
  }
}

/** Painted sheet-metal casing for HVAC plant: panel seams, screws and weathering. */
export function hvac(hex = '#c9cdd1') {
  return once(`hvac|${hex}`, () => std({ ...withSurface('hvac'), color: new THREE.Color(hex), roughness: 0.55, metalness: 0.35, normalScale: new THREE.Vector2(0.7, 0.7) }));
}

/** The wire guard over a fan: see-through between the wires. */
export function fanGuard() {
  return once('fanGuard', () => std({
    color: new THREE.Color('#2e3338'), alphaMap: surface('fanguard').map, alphaTest: 0.5, transparent: false,
    metalness: 0.6, roughness: 0.45, side: THREE.DoubleSide,
  }));
}

export function rubber() {
  return once('rubber', () => std({ color: new THREE.Color('#15171b'), roughness: 0.95 }));
}

export function interiorDark() {
  return once('interiorDark', () => std({ color: new THREE.Color('#2a2e34'), roughness: 0.95 }));
}

export function concrete(hex = '#c4c2bb') {
  return once(`concrete|${hex}`, () => snowy(wet(antiTile(std({ ...withSurface('concrete'), color: new THREE.Color(hex), roughness: 0.9 }), 110, 0.16)), '#eef2f5'));
}

export function roof(kind, hex) {
  if (kind === 'membrane') return once(`roof|m|${hex}`, () => snowy(std({ ...withSurface('membrane'), color: new THREE.Color(hex || '#c9cdd2'), roughness: 0.85 })));
  if (kind === 'seam') return once(`roof|s|${hex}`, () => snowy(std({ ...withSurface('seam'), color: new THREE.Color(hex || '#8d949c'), roughness: 0.4, metalness: 0.6 })));
  if (kind === 'tiles') return once(`roof|t|${hex}`, () => snowy(std({ ...withSurface('tiles'), color: new THREE.Color(hex || '#5d646d'), roughness: 0.8 })));
  return roof('membrane', hex);
}

export function gravel() {
  return once('gravel', () => snowy(std({ ...withSurface('asphalt'), color: new THREE.Color('#b7b3aa'), roughness: 1 })));
}

/* ---------------------------------------------------------------- ground */

export function grass(hex = '#ffffff') {
  return once(`grass|${hex}`, () => snowy(antiTile(std({ ...withSurface('grass'), color: new THREE.Color(hex), roughness: 1 }), 140, 0.4), '#f2f5f8'));
}

export function asphalt() {
  return once('asphalt', () => snowy(wet(antiTile(std({ ...withSurface('asphalt'), color: new THREE.Color('#f6f2ec'), roughness: 0.95 }), 140, 0.06)), '#d9dee3'));
}

export function road() {
  return once('road', () => snowy(wet(antiTile(std({ ...withSurface('road'), color: new THREE.Color('#ffffff'), roughness: 0.92 }), 160, 0.2)), '#c9ced3'));
}

export function paving() {
  return once('paving', () => snowy(wet(antiTile(std({ ...withSurface('paving'), color: new THREE.Color('#d6d3cc'), roughness: 0.9 }), 90, 0.15)), '#f0f3f6'));
}

/** Ground beyond the lot: fields and rough grass out to the horizon. */
export function field(hex = '#ffffff') {
  return once(`field|${hex}`, () => snowy(antiTile(std({ ...withSurface('grass'), color: new THREE.Color(hex), roughness: 1 }), 900, 0.55), '#eef2f6'));
}

export function kerb() {
  return once('kerb', () => std({ ...withSurface('concrete'), color: new THREE.Color('#bdbab2'), roughness: 0.9 }));
}

/** Road paint: worn at the edges, alpha-tested so it stays crisp. */
export function paint(hex = '#f4f2ea') {
  return once(`paint|${hex}`, () => wet(std({
    color: new THREE.Color(hex), roughness: 0.65, alphaMap: surface('wear').map, alphaTest: 0.5,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  })));
}

export function water() {
  return once('water', () => shiny(new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#1f3d4a'), roughness: 0.06, metalness: 0.05, normalMap: surface('water').normalMap,
    normalScale: new THREE.Vector2(0.35, 0.35), clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.4,
  })));
}

/* ------------------------------------------------------------ props kit */

export function metal(hex = '#a3abb4', rough = 0.38) {
  return once(`metal|${hex}|${rough}`, () => std({ color: new THREE.Color(hex), roughness: rough, metalness: 0.85 }));
}

export function painted(hex, rough = 0.5) {
  return once(`painted|${hex}|${rough}`, () => std({ color: new THREE.Color(hex), roughness: rough, metalness: 0.15 }));
}

export function plastic(hex, rough = 0.55) {
  return once(`plastic|${hex}|${rough}`, () => std({ color: new THREE.Color(hex), roughness: rough, metalness: 0 }));
}

/** Car paint: metallic base under a clear coat. */
export function carPaint(hex) {
  return once(`car|${hex}`, () => snowy(shiny(new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(hex), roughness: 0.35, metalness: 0.45, clearcoat: 0.8, clearcoatRoughness: 0.08, envMapIntensity: 0.75,
  }))));
}

export function chrome() {
  return once('chrome', () => shiny(std({ color: new THREE.Color('#e8ecef'), roughness: 0.12, metalness: 1, envMapIntensity: 1.2 })));
}

export function tyre() {
  return once('tyre', () => std({ color: new THREE.Color('#1a1b1e'), roughness: 0.9 }));
}

export function vehicleGlass() {
  return once('vglass', () => shiny(new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#0d141b'), roughness: 0.06, metalness: 0.2, clearcoat: 1, envMapIntensity: 0.7,
  })));
}

export function wood(hex = '#9a6b47') {
  return once(`wood|${hex}`, () => std({ ...withSurface('timber'), color: new THREE.Color(hex), roughness: 0.85 }));
}

export function brickMat(hex = '#9c5b47') {
  return wall('brick', hex);
}

export function fabric(hex) {
  return once(`fabric|${hex}`, () => std({ color: new THREE.Color(hex), roughness: 0.92, side: THREE.DoubleSide }));
}

export function meshFence() {
  return once('meshFence', () => std({
    color: new THREE.Color('#7d868f'), metalness: 0.7, roughness: 0.4, alphaMap: surface('mesh').map,
    alphaTest: 0.5, side: THREE.DoubleSide,
  }));
}

/** Something that glows after dark: lamp heads, lit signs, indicator lights. */
export function lamp(hex = '#fff1cc', max = 6) {
  return once(`lamp|${hex}|${max}`, () => night(std({
    color: new THREE.Color('#f4f4f2'), emissive: new THREE.Color(hex), emissiveIntensity: 0, roughness: 0.3,
  }), 'emissiveIntensity', max));
}

/** Always lit — traffic signals, EV charger rings, exit signs. */
export function signal(hex, strength = 2) {
  return once(`signal|${hex}|${strength}`, () => std({
    color: new THREE.Color(hex), emissive: new THREE.Color(hex), emissiveIntensity: strength, roughness: 0.4,
  }));
}

/** A soft pool of light thrown on the ground under a lamp at night. */
export function lightPool(hex = '#ffd99a') {
  return once(`pool|${hex}`, () => night(new THREE.MeshBasicMaterial({
    map: glowTexture(), color: new THREE.Color(hex), transparent: true, opacity: 0,
    blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  }), 'opacity', 0.34));
}

/** Lettering on a sign — lit from within at night. */
export function signFace(texture) {
  const m = std({
    map: texture, transparent: true, alphaTest: 0.05, roughness: 0.4, metalness: 0.1,
    emissive: new THREE.Color('#ffffff'), emissiveMap: texture, emissiveIntensity: 0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  return night(m, 'emissiveIntensity', 0.9);
}

/** Neon tubes: coloured by day, blazing after dark. */
export function neonFace(texture) {
  const mat = std({
    map: texture, transparent: true, alphaTest: 0.04, roughness: 0.3, depthWrite: false,
    emissive: new THREE.Color('#ffffff'), emissiveMap: texture, emissiveIntensity: 0,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  return night(mat, 'emissiveIntensity', 2.6);
}

/** An LED screen: always on, brighter than anything painted. */
export function screenFace(texture) {
  return std({ map: texture, emissive: new THREE.Color('#ffffff'), emissiveMap: texture, emissiveIntensity: 0.85, roughness: 0.22, metalness: 0 });
}

/** A printed or painted face that does not light up (banners, plaques, safety signs). */
export function printFace(texture, { rough = 0.6, metal = 0, side = THREE.FrontSide, cutout = false } = {}) {
  const m = std({ map: texture, roughness: rough, metalness: metal, side });
  if (cutout) {
    // Letters with nothing between them.
    m.transparent = true;
    m.alphaTest = 0.05;
    m.polygonOffset = true;
    m.polygonOffsetFactor = -2;
    m.polygonOffsetUnits = -2;
  }
  return m;
}

/** Clear acrylic, as behind neon tubes. */
export function acrylic() {
  return once('acrylic', () => std({ color: new THREE.Color('#ffffff'), transparent: true, opacity: 0.1, roughness: 0.05, metalness: 0, depthWrite: false }));
}

/** See-through tint for camera coverage cones: strongest at the lens, fading out to the far end. */
export function coverage(hex = '#46b4ff') {
  return once(`coverage|${hex}`, () => {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.55, '#5a5a5a');
    grad.addColorStop(1, '#000000');
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 128);
    const fade = new THREE.CanvasTexture(c);
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(hex), alphaMap: fade, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, fog: true,
    });
  });
}

/* --------------------------------------------------------------- planting */

export const SEASON_LEAF = {
  spring: ['#7fb357', '#9bc46a', '#5f9a48'],
  summer: ['#4f7f3a', '#5e8f45', '#3f6b2f'],
  autumn: ['#c26a2a', '#d99a32', '#a8442a'],
  winter: ['#6d6a5c', '#7b7668', '#5b5a50'],
};

export function leaves(variant = 0) {
  return once(`leaves|${variant}`, () => {
    const m = std({ ...withSurface('leaves'), color: new THREE.Color((SEASON_LEAF[NOW.season] || SEASON_LEAF.summer)[variant % 3]), roughness: 0.85 });
    leafReg.push({ mat: m, variant });
    return snowy(m);
  });
}

export function needles() {
  return once('needles', () => snowy(std({ ...withSurface('leaves'), color: new THREE.Color('#2f4d32'), roughness: 0.9 })));
}

export function bark(hex = '#6b5340') {
  return once(`bark|${hex}`, () => std({ ...withSurface('bark'), color: new THREE.Color(hex), roughness: 0.95 }));
}

/* ----------------------------------------------------- world-wide controls */

/** Forget a one-off material (a sign face) when its object is removed. */
export function release(mat) {
  for (const reg of [nightReg, wetReg, snowReg, leafReg]) {
    for (let i = reg.length - 1; i >= 0; i--) if (reg[i].mat === mat) reg.splice(i, 1);
  }
  const i = shinyReg.indexOf(mat);
  if (i >= 0) shinyReg.splice(i, 1);
}

/** Give the shiny materials their own copy of the sky to reflect. */
export function setEnvMap(texture, scale = 1) {
  NOW.env = texture;
  NOW.envScale = scale;
  for (const m of shinyReg) {
    m.envMap = texture;
    m.envMapIntensity = m.userData.baseEnv * scale;
  }
}

/** 0 = full day, 1 = full night. */
export function setNight(f) {
  NOW.night = f;
  for (const e of nightReg) e.mat[e.key] = e.max * f;
}

/** 0 = dry, 1 = soaked: wet ground turns glossy and reflects. */
export function setWet(f) {
  NOW.wet = f;
  for (const e of wetReg) applyWet(e, f);
}

/**
 * Cloud shadows: where the cloud field has drifted to (feet), how much of the
 * sky is cloud (0–1) and how dark the shade is (0 turns them off).
 */
export function setCloudShadows(x, z, cover, strength) {
  CLOUD_U.value.set(x, z, cover, strength);
}

/** 0 = none, 1 = blanket. */
export function setSnow(f) {
  NOW.snow = f;
  SNOW_U.value = f;
}

export function setSeason(season) {
  NOW.season = season;
  const set = SEASON_LEAF[season] || SEASON_LEAF.summer;
  for (const e of leafReg) e.mat.color.set(set[e.variant % 3]);
}
