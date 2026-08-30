/* eslint-disable */
/* What can go on a lot, how big it is, and what a fresh site starts as.
 *
 * Everything on the site is an object in `state.objects` — buildings included —
 * so anything can be selected, moved, turned or deleted. */

import { overlaps } from './iso.js';

export const FLOOR_HEIGHT = 13;
export const STALL = { w: 9, d: 18 };

/* ------------------------------------------------------------------ colours */

export const WALL_COLORS = [
  { id: 'concrete', name: 'Precast concrete', hex: '#d8dde3' },
  { id: 'warm', name: 'Warm panel', hex: '#cdb7a4' },
  { id: 'graphite', name: 'Graphite', hex: '#6d747f' },
  { id: 'navy', name: 'Deep navy', hex: '#26364f' },
  { id: 'sand', name: 'Sandstone', hex: '#d9c9a3' },
  { id: 'white', name: 'Bright white', hex: '#f0f2f4' },
  { id: 'brick', name: 'Red brick', hex: '#9c5b47' },
  { id: 'sage', name: 'Sage', hex: '#8f9d89' },
];

export const SIGN_COLORS = [
  { id: 'blue', name: 'Corporate blue', hex: '#1f4f9c' },
  { id: 'navy', name: 'Navy', hex: '#16305c' },
  { id: 'white', name: 'White', hex: '#ffffff' },
  { id: 'black', name: 'Black', hex: '#141821' },
  { id: 'red', name: 'Red', hex: '#c0392b' },
  { id: 'green', name: 'Green', hex: '#1f7a54' },
  { id: 'gold', name: 'Gold', hex: '#c9922b' },
  { id: 'orange', name: 'Orange', hex: '#d2691e' },
];

export const LOGOS = ['🚽', '🚚', '🏢', '📦', '⚙️', '🛠️', '🌐', '⚡', '🛡️', '🍃', '🔩', '🧪', '☕', '🏗️', '★', '◆', '▲', ''];

/* ------------------------------------------------------- wall cell types */

/* A wall is a grid: one row per floor, a fixed number of bays across. Each
 * cell is one of these, and the player sets every one of them by hand. */
export const CELLS = [
  { id: 'blank', name: 'Blank wall', icon: '▢', ground: true, upper: true },
  { id: 'window', name: 'Window', icon: '🪟', ground: true, upper: true },
  { id: 'ribbon', name: 'Ribbon glass', icon: '▭', ground: true, upper: true },
  { id: 'glass', name: 'Full glazing', icon: '⬜', ground: true, upper: true },
  { id: 'dock', name: 'Loading bay', icon: '🚛', ground: true, upper: false },
  { id: 'roll', name: 'Roll-up door', icon: '🔒', ground: true, upper: false },
  { id: 'door', name: 'Entrance', icon: '🚪', ground: true, upper: false },
  { id: 'louvre', name: 'Louvre', icon: '≡', ground: true, upper: true },
  { id: 'vent', name: 'Vent', icon: '◍', ground: true, upper: true },
  { id: 'open', name: 'Open deck', icon: '▤', ground: true, upper: true },
];

export const CELL_IDS = CELLS.map((c) => c.id);

/* --------------------------------------------------------- rooftop machines */

/* 18 pieces of rooftop plant. `art` picks the drawing, the rest is its size in
 * feet. Nothing is placed automatically — the player puts every one down. */
export const ROOF_KIT = [
  { id: 'rtu', name: 'Packaged AC unit', icon: '🔲', w: 8, d: 6, h: 3.4, art: 'rtu' },
  { id: 'rtu-xl', name: 'Large rooftop unit', icon: '⬛', w: 15, d: 9, h: 5, art: 'rtu' },
  { id: 'chiller', name: 'Chiller', icon: '❄️', w: 18, d: 8, h: 6, art: 'chiller' },
  { id: 'cooling', name: 'Cooling tower', icon: '💨', w: 11, d: 11, h: 11, art: 'cooling' },
  { id: 'fan', name: 'Exhaust fan', icon: '🌀', w: 4.4, d: 4.4, h: 2.6, art: 'fan' },
  { id: 'mushroom', name: 'Mushroom vent', icon: '🍄', w: 3.2, d: 3.2, h: 2.2, art: 'mushroom' },
  { id: 'flue', name: 'Flue stack', icon: '🏭', w: 2.4, d: 2.4, h: 11, art: 'flue' },
  { id: 'skylight', name: 'Skylight', icon: '🔆', w: 10, d: 6, h: 1, art: 'skylight' },
  { id: 'monitor', name: 'Skylight monitor', icon: '🔅', w: 24, d: 7, h: 3, art: 'monitor' },
  { id: 'solar', name: 'Solar array', icon: '🔋', w: 22, d: 11, h: 3.6, art: 'solar' },
  { id: 'dish', name: 'Satellite dish', icon: '📡', w: 8, d: 8, h: 6, art: 'dish' },
  { id: 'mast', name: 'Antenna mast', icon: '📶', w: 3, d: 3, h: 24, art: 'mast' },
  { id: 'tank', name: 'Water tank', icon: '🛢️', w: 12, d: 12, h: 16, art: 'tank' },
  { id: 'stair', name: 'Stair bulkhead', icon: '🚪', w: 13, d: 10, h: 9, art: 'bulkhead' },
  { id: 'lift', name: 'Lift overrun', icon: '🛗', w: 11, d: 11, h: 13, art: 'bulkhead' },
  { id: 'duct', name: 'Duct run', icon: '🧱', w: 26, d: 3.4, h: 3, art: 'duct' },
  { id: 'pipes', name: 'Pipe rack', icon: '🧵', w: 20, d: 4, h: 3.4, art: 'pipes' },
  { id: 'screen', name: 'Plant screen', icon: '🚧', w: 22, d: 16, h: 7, art: 'screen' },
];

/* ------------------------------------------------------------ guard booths */

/* 10 booths. `art` picks the shell; every one carries a fascia sign the player
 * can retype, recolour or blank. */
export const BOOTHS = [
  { id: 'classic', name: 'Classic cabin', icon: '🏛️', w: 26, d: 18, h: 10, art: 'classic' },
  { id: 'canopy', name: 'Deep canopy', icon: '⛺', w: 24, d: 16, h: 10, art: 'canopy' },
  { id: 'brick', name: 'Brick gatehouse', icon: '🧱', w: 30, d: 22, h: 11, art: 'brick' },
  { id: 'cube', name: 'Glass cube', icon: '🔷', w: 18, d: 18, h: 11, art: 'cube' },
  { id: 'container', name: 'Container booth', icon: '📦', w: 20, d: 8, h: 9, art: 'container' },
  { id: 'twin', name: 'Twin-lane kiosk', icon: '🚦', w: 34, d: 14, h: 10, art: 'twin' },
  { id: 'hut', name: 'Pitched hut', icon: '🏠', w: 16, d: 14, h: 9, art: 'hut' },
  { id: 'tower', name: 'Raised lookout', icon: '🗼', w: 14, d: 14, h: 20, art: 'tower' },
  { id: 'kiosk', name: 'Round kiosk', icon: '⚪', w: 14, d: 14, h: 10, art: 'kiosk' },
  { id: 'office', name: 'Gate office', icon: '🏢', w: 34, d: 24, h: 13, art: 'office' },
];

/* ------------------------------------------------------------------- props */

/* The props menu. `cat` groups them in the palette; `art` picks the drawing. */
export const PROPS = [
  // boundary
  { id: 'fence', name: 'Fence run', icon: '🚧', cat: 'Boundary', w: 40, d: 1, h: 8, art: 'fence', len: true },
  { id: 'wall', name: 'Boundary wall', icon: '🧱', cat: 'Boundary', w: 40, d: 1.4, h: 7, art: 'wall', len: true },
  { id: 'guardrail', name: 'Guard rail', icon: '➖', cat: 'Boundary', w: 30, d: 0.8, h: 2.6, art: 'guardrail', len: true },
  { id: 'gate', name: 'Gate arm', icon: '⛔', cat: 'Boundary', w: 30, d: 3, h: 5, art: 'gate' },
  { id: 'bollard', name: 'Bollard', icon: '🟡', cat: 'Boundary', w: 1.5, d: 1.5, h: 3.6, art: 'bollard' },
  { id: 'barrier', name: 'Concrete barrier', icon: '🚏', cat: 'Boundary', w: 12, d: 2, h: 3.2, art: 'barrier' },
  { id: 'cone', name: 'Traffic cone', icon: '🔶', cat: 'Boundary', w: 1.6, d: 1.6, h: 2.4, art: 'cone' },
  // signs
  { id: 'monument', name: 'Monument sign', icon: '🪧', cat: 'Signs', w: 26, d: 3, h: 17, art: 'monument', sign: true },
  { id: 'pylon', name: 'Pylon sign', icon: '🛑', cat: 'Signs', w: 14, d: 3, h: 28, art: 'pylon', sign: true },
  { id: 'postsign', name: 'Post sign', icon: '📋', cat: 'Signs', w: 8, d: 0.8, h: 8, art: 'postsign', sign: true },
  { id: 'stopsign', name: 'Stop sign', icon: '🛑', cat: 'Signs', w: 2.6, d: 0.6, h: 8, art: 'stopsign' },
  { id: 'flag', name: 'Flagpole', icon: '🏳️', cat: 'Signs', w: 2, d: 2, h: 34, art: 'flag' },
  // lighting
  { id: 'pole', name: 'Light pole', icon: '💡', cat: 'Lighting', w: 3, d: 3, h: 27, art: 'pole' },
  { id: 'floodmast', name: 'Flood mast', icon: '🔦', cat: 'Lighting', w: 4, d: 4, h: 42, art: 'floodmast' },
  { id: 'bollardlight', name: 'Bollard light', icon: '🔅', cat: 'Lighting', w: 1.4, d: 1.4, h: 4, art: 'bollardlight' },
  // planting
  { id: 'tree', name: 'Broadleaf tree', icon: '🌳', cat: 'Planting', w: 18, d: 18, h: 24, art: 'tree' },
  { id: 'conifer', name: 'Conifer', icon: '🌲', cat: 'Planting', w: 12, d: 12, h: 28, art: 'conifer' },
  { id: 'shrub', name: 'Shrub', icon: '🌿', cat: 'Planting', w: 7, d: 7, h: 4, art: 'shrub' },
  { id: 'hedge', name: 'Hedge run', icon: '🍃', cat: 'Planting', w: 24, d: 4, h: 5, art: 'hedge', len: true },
  { id: 'planter', name: 'Planter', icon: '🪴', cat: 'Planting', w: 6, d: 6, h: 3, art: 'planter' },
  // yard
  { id: 'dumpster', name: 'Dumpster', icon: '🗑️', cat: 'Yard', w: 8, d: 6, h: 5, art: 'dumpster' },
  { id: 'container', name: 'Shipping container', icon: '📦', cat: 'Yard', w: 40, d: 8, h: 9.5, art: 'container' },
  { id: 'generator', name: 'Generator', icon: '⚡', cat: 'Yard', w: 14, d: 6, h: 7, art: 'generator' },
  { id: 'transformer', name: 'Transformer', icon: '🔌', cat: 'Yard', w: 8, d: 8, h: 8, art: 'transformer' },
  { id: 'silo', name: 'Silo', icon: '🏗️', cat: 'Yard', w: 16, d: 16, h: 44, art: 'silo' },
  { id: 'pallets', name: 'Pallet stack', icon: '🟫', cat: 'Yard', w: 8, d: 6, h: 5, art: 'pallets' },
  { id: 'canopy', name: 'Yard canopy', icon: '⛱️', cat: 'Yard', w: 40, d: 24, h: 15, art: 'canopy' },
  { id: 'bikerack', name: 'Bike rack', icon: '🚲', cat: 'Yard', w: 10, d: 3, h: 3, art: 'bikerack' },
  { id: 'bench', name: 'Bench', icon: '🪑', cat: 'Yard', w: 6, d: 2, h: 3, art: 'bench' },
  { id: 'picnic', name: 'Picnic table', icon: '🧺', cat: 'Yard', w: 7, d: 6, h: 3, art: 'picnic' },
  // vehicles
  { id: 'trailer', name: 'Trailer', icon: '🚛', cat: 'Vehicles', w: 8.5, d: 45, h: 17.6, art: 'trailer', vehicle: true },
  { id: 'tractor', name: 'Tractor unit', icon: '🚚', cat: 'Vehicles', w: 8.5, d: 22, h: 13.5, art: 'tractor', vehicle: true, color: true },
  { id: 'boxtruck', name: 'Box truck', icon: '🚐', cat: 'Vehicles', w: 8, d: 26, h: 12.5, art: 'boxtruck', vehicle: true, color: true },
  { id: 'van', name: 'Van', icon: '🚙', cat: 'Vehicles', w: 6.4, d: 17, h: 8, art: 'van', vehicle: true, color: true },
  { id: 'car', name: 'Car', icon: '🚗', cat: 'Vehicles', w: 6, d: 14, h: 5.5, art: 'car', vehicle: true, color: true },
  { id: 'forklift', name: 'Forklift', icon: '🏗️', cat: 'Vehicles', w: 5, d: 9, h: 8, art: 'forklift', vehicle: true },
];

export const PROP_BY_ID = Object.fromEntries(PROPS.map((p) => [p.id, p]));
export const ROOF_BY_ID = Object.fromEntries(ROOF_KIT.map((p) => [p.id, p]));
export const BOOTH_BY_ID = Object.fromEntries(BOOTHS.map((p) => [p.id, p]));

/* -------------------------------------------------------------- buildings */

export const CLADDINGS = [
  { id: 'precast', name: 'Precast panels' },
  { id: 'rib', name: 'Ribbed metal' },
  { id: 'brick', name: 'Brick courses' },
  { id: 'plain', name: 'Plain render' },
];

export const ROOF_TYPES = [
  { id: 'flat', name: 'Flat roof' },
  { id: 'gable', name: 'Pitched roof' },
  { id: 'saw', name: 'Sawtooth' },
];

export const BUILDING_STYLES = {
  shed: { name: 'Warehouse shell', icon: '🏭', w: 380, d: 150, floors: 1, height: 34, cell: 12, blurb: 'Clear-span box. Put loading bays where you want them.' },
  office: { name: 'Office block', icon: '🏢', w: 110, d: 90, floors: 3, height: null, cell: 11, blurb: 'Two to six floors of offices.' },
  small: { name: 'Small building', icon: '🏬', w: 70, d: 50, floors: 2, height: null, cell: 11, blurb: 'A little two or three storey block.' },
  tower: { name: 'Tower', icon: '🏙️', w: 150, d: 110, floors: 12, height: null, cell: 11, blurb: 'Glass high-rise.' },
  row: { name: 'Storage row', icon: '🔒', w: 300, d: 40, floors: 1, height: 11, cell: 10, blurb: 'Single-storey units with roll-up doors both sides.' },
  strip: { name: 'Retail strip', icon: '🛒', w: 300, d: 90, floors: 1, height: 20, cell: 15, blurb: 'Storefront block with a deep sign band.' },
  workshop: {
    name: 'Workshop', icon: '🔧', w: 100, d: 62, floors: 1, height: 24, cell: 12,
    cladding: 'rib', wall: '#b9c2c9', band: '#3f4a57',
    blurb: 'Maintenance shop with roll-up doors and ribbed cladding.',
  },
  pitched: {
    name: 'Pitched unit', icon: '🏘️', w: 84, d: 52, floors: 1, height: 16, cell: 10,
    cladding: 'brick', roofType: 'gable', wall: '#9c5b47', band: '#6d4034', roofColor: '#5d646d',
    blurb: 'Brick unit under a pitched roof.',
  },
  deck: {
    name: 'Car park deck', icon: '🅿️', w: 190, d: 122, floors: 4, height: null, cell: 12,
    cladding: 'plain', wall: '#c6cbd1', band: '#5a636e',
    blurb: 'Open-sided multi-storey parking.',
  },
  cold: {
    name: 'Cold store', icon: '🧊', w: 170, d: 120, floors: 1, height: 46, cell: 12,
    cladding: 'rib', wall: '#eef1f4', band: '#2f5f8a',
    blurb: 'Tall insulated box, almost no openings.',
  },
  pavilion: {
    name: 'Glass pavilion', icon: '🪟', w: 76, d: 54, floors: 1, height: 17, cell: 9,
    cladding: 'plain', wall: '#e7eef3', band: '#4a5a68',
    blurb: 'Fully glazed showroom or reception.',
  },
  plant: {
    name: 'Plant room', icon: '⚙️', w: 64, d: 42, floors: 1, height: 27, cell: 10,
    cladding: 'precast', wall: '#a7adb6', band: '#40484f',
    blurb: 'Louvred energy centre for the back of the site.',
  },
};

let seq = 1;
export const newId = (prefix = 'o') => `${prefix}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
export function seedIds(objects) {
  // Keep generated ids from colliding with a loaded save.
  seq = Math.max(seq, objects.length + 2);
}

/** Blank grid for one wall: rows are floors from the ground up. */
function grid(cols, floors, fill = 'blank') {
  return Array.from({ length: floors }, () => Array.from({ length: cols }, () => fill));
}

export function wallCols(building, face) {
  return (building.walls[face] && building.walls[face][0] ? building.walls[face][0].length : 1);
}

/** A building with its four walls filled in the way that style usually is. */
export function makeBuilding(style, over = {}) {
  const p = BUILDING_STYLES[style] || BUILDING_STYLES.office;
  const b = {
    id: newId('b'),
    kind: 'building',
    style,
    name: p.name,
    x: 0, y: 0, rot: 0,
    w: p.w, d: p.d,
    floors: p.floors,
    height: p.height,          // null = floors * FLOOR_HEIGHT
    wall: p.wall || '#d8dde3',
    band: p.band || '#1f3a63',
    roofColor: p.roofColor || null,
    parapet: true,
    cladding: p.cladding || 'precast',
    roofType: p.roofType || 'flat',
    sign: { on: true, face: 'N', text: '', sub: '', color: '#1f4f9c', logo: '' },
    roofItems: [],
    walls: {},
    ...over,
  };
  const cols = (len) => Math.max(2, Math.round(len / p.cell));
  const cw = cols(b.w);
  const cd = cols(b.d);
  const floors = b.floors;
  b.walls = { N: grid(cw, floors), S: grid(cw, floors), E: grid(cd, floors), W: grid(cd, floors) };

  const fill = (face, row, from, to, type) => {
    const g = b.walls[face][row];
    if (!g) return;
    for (let i = Math.max(0, from); i < Math.min(g.length, to); i++) g[i] = type;
  };

  if (style === 'shed') {
    // Bays across the middle two-thirds of the front, a door at one end.
    fill('N', 0, 2, cw - 2, 'dock');
    fill('N', 0, 0, 1, 'door');
    fill('E', 0, 1, 2, 'roll');
  } else if (style === 'row') {
    fill('N', 0, 0, cw, 'roll');
    fill('S', 0, 0, cw, 'roll');
  } else if (style === 'strip') {
    fill('N', 0, 0, cw, 'glass');
    fill('N', 0, Math.floor(cw / 2), Math.floor(cw / 2) + 1, 'door');
    fill('E', 0, 0, cd, 'blank');
  } else if (style === 'tower') {
    for (let f = 0; f < floors; f++) {
      for (const face of ['N', 'S']) fill(face, f, 0, cw, 'glass');
      for (const face of ['E', 'W']) fill(face, f, 0, cd, 'glass');
    }
    fill('N', 0, Math.floor(cw / 2), Math.floor(cw / 2) + 1, 'door');
  } else if (style === 'workshop') {
    fill('N', 0, 1, cw - 1, 'roll');
    fill('N', 0, 0, 1, 'door');
    fill('S', 0, 1, 3, 'roll');
    fill('E', 0, 1, cd - 1, 'window');
  } else if (style === 'pitched') {
    fill('N', 0, 0, cw, 'window');
    fill('N', 0, Math.floor(cw / 2), Math.floor(cw / 2) + 1, 'door');
    fill('S', 0, 1, cw - 1, 'window');
    fill('E', 0, 1, cd - 1, 'window');
    fill('W', 0, 1, cd - 1, 'window');
    b.parapet = false;
  } else if (style === 'deck') {
    for (let f = 0; f < floors; f++) {
      for (const face of ['N', 'S']) fill(face, f, 0, cw, 'open');
      for (const face of ['E', 'W']) fill(face, f, 0, cd, 'open');
    }
    fill('N', 0, 0, 1, 'door');
    fill('N', 0, Math.floor(cw / 2), Math.floor(cw / 2) + 1, 'roll');
    b.parapet = true;
  } else if (style === 'cold') {
    fill('N', 0, 2, Math.min(cw - 2, 8), 'dock');
    fill('E', 0, 1, 2, 'door');
    fill('W', 0, cd - 3, cd - 2, 'louvre');
  } else if (style === 'pavilion') {
    for (const face of ['N', 'S']) fill(face, 0, 0, cw, 'glass');
    for (const face of ['E', 'W']) fill(face, 0, 0, cd, 'glass');
    fill('N', 0, Math.floor(cw / 2), Math.floor(cw / 2) + 1, 'door');
  } else if (style === 'plant') {
    for (const face of ['N', 'S']) fill(face, 0, 1, cw - 1, 'louvre');
    for (const face of ['E', 'W']) fill(face, 0, 1, cd - 1, 'louvre');
    fill('N', 0, 0, 1, 'door');
  } else {
    // Office-ish: windows everywhere, a door in the middle of the front.
    for (let f = 0; f < floors; f++) {
      for (const face of ['N', 'S']) fill(face, f, 1, cw - 1, 'window');
      for (const face of ['E', 'W']) fill(face, f, 1, cd - 1, 'window');
    }
    fill('N', 0, Math.floor((cw - 1) / 2), Math.floor((cw - 1) / 2) + 1, 'door');
  }
  return b;
}

export const buildingHeight = (b) => (b.height != null ? b.height : b.floors * FLOOR_HEIGHT);

/** The footprint an object occupies on the ground. */
export function footprint(o) {
  if (o.kind === 'building') return { x: o.x, y: o.y, w: o.w, d: o.d, rot: o.rot || 0 };
  const spec = o.kind === 'booth' ? BOOTH_BY_ID[o.design] : PROP_BY_ID[o.type];
  return {
    x: o.x, y: o.y, rot: o.rot || 0,
    w: o.w != null ? o.w : (spec ? spec.w : 8),
    d: o.d != null ? o.d : (spec ? spec.d : 8),
  };
}

export function objHeight(o) {
  if (o.kind === 'building') return buildingHeight(o);
  const spec = o.kind === 'booth' ? BOOTH_BY_ID[o.design] : PROP_BY_ID[o.type];
  return o.h != null ? o.h : (spec ? spec.h : 8);
}

/** Nothing but a building may stand inside a building. */
export function pruneInsideBuildings(objects) {
  const walls = objects.filter((o) => o.kind === 'building').map(footprint);
  return objects.filter((o) => o.kind === 'building' || !walls.some((w) => overlaps(footprint(o), w, -0.5)));
}

/* ------------------------------------------------------------ fresh sites */

export const SITE_PRESETS = {
  warehouse: { name: 'Distribution site', icon: '🏭', lot: { width: 620, depth: 440 }, blurb: 'A shed with loading bays, an office end and a truck court.' },
  campus: { name: 'Office campus', icon: '🏢', lot: { width: 560, depth: 440 }, blurb: 'A tower on a podium with a car park.' },
  storage: { name: 'Storage yard', icon: '🔒', lot: { width: 600, depth: 460 }, blurb: 'Rows of units behind a gate.' },
  retail: { name: 'Retail strip', icon: '🛒', lot: { width: 560, depth: 400 }, blurb: 'A storefront row facing a big lot.' },
  empty: { name: 'Empty lot', icon: '⬜', lot: { width: 560, depth: 420 }, blurb: 'Bare ground. Build it all yourself.' },
};

const prop = (id, x, y, rot = 0, extra = {}) => ({ id: newId('p'), kind: 'prop', type: id, x, y, rot, ...extra });

export function freshState(preset = 'warehouse') {
  const p = SITE_PRESETS[preset] || SITE_PRESETS.warehouse;
  const lot = { ...p.lot };
  const objects = [];
  const cx = lot.width / 2;

  const sign = (text, sub) => ({ on: true, face: 'N', text, sub, color: '#1f4f9c', logo: '🚽' });

  if (preset === 'warehouse') {
    const shed = makeBuilding('shed', { x: cx - 190, y: 46, w: 380, d: 150 });
    shed.sign.on = false;
    const office = makeBuilding('office', {
      x: cx - 190, y: 46, w: 110, d: 164, floors: 3, sign: sign('TOILET PLUS SOLUTIONS', 'SOLUTIONS THAT WORK FOR YOU'),
    });
    objects.push(shed, office);
  } else if (preset === 'campus') {
    const tower = makeBuilding('tower', { x: cx - 75, y: 60, w: 150, d: 110, floors: 12, wall: '#7f8896', sign: sign('TOILET PLUS SOLUTIONS', '') });
    const podium = makeBuilding('small', { x: cx - 97, y: 144, w: 194, d: 52, floors: 1, height: 15, wall: '#8b93a0' });
    podium.sign.on = false;
    objects.push(tower, podium);
  } else if (preset === 'storage') {
    for (let i = 0; i < 3; i++) {
      objects.push(makeBuilding('row', { x: cx - 150, y: 50 + i * 84, w: 300, d: 40 }));
    }
    objects.push(makeBuilding('small', { x: cx - 180, y: 218, w: 60, d: 40, floors: 1, height: 13, sign: sign('TOILET PLUS SOLUTIONS', '') }));
  } else if (preset === 'retail') {
    objects.push(makeBuilding('strip', { x: cx - 150, y: 60, w: 300, d: 90, wall: '#cdb7a4', band: '#5b3a2e', sign: sign('TOILET PLUS SOLUTIONS', 'SOLUTIONS THAT WORK FOR YOU') }));
  }

  // Trailers at the bays — parked outside the wall, where a trailer goes.
  const shed = objects.find((o) => o.style === 'shed');
  if (shed) {
    const cols = shed.walls.N[0].length;
    const cw = shed.w / cols;
    const frontY = shed.y + shed.d;
    for (const col of [12, 15, 18, 21, 24, 27]) {
      if (shed.walls.N[0][col] !== 'dock') continue;
      objects.push({ id: newId('v'), kind: 'prop', type: 'trailer', rot: 0,
        x: shed.x + (col + 0.5) * cw - 4.25, y: frontY + 1.5 });
    }
    for (let i = 0; i < 4; i++) {
      objects.push({ id: newId('v'), kind: 'prop', type: 'trailer', rot: 0,
        x: shed.x + 120 + i * 15, y: frontY + 82 });
    }
    objects.push({ id: newId('v'), kind: 'prop', type: 'tractor', rot: 0, color: '#2c4a7c',
      x: shed.x + shed.w - 60, y: frontY + 96 });
  }

  // A gate, a booth and a sign at the entrance — all editable objects.
  if (preset !== 'empty') {
    const driveX = cx - 150;
    const gateY = lot.depth - 70;
    objects.push({ id: newId('g'), kind: 'booth', design: 'classic', x: driveX - 58, y: gateY - 10, rot: 0,
      sign: { text: 'TOILET PLUS SOLUTIONS', color: '#ffffff', logo: '🚽' } });
    objects.push(prop('gate', driveX - 26, gateY - 2));
    objects.push(prop('monument', driveX + 26, gateY, 90, {
      sign: { text: 'ALL VISITORS MUST CHECK IN AT SECURITY', color: '#ffffff', logo: '🛡️' },
    }));
    for (let i = 0; i < 6; i++) {
      objects.push(prop('bollard', driveX + (i % 2 ? 30 : -30) + (i % 2 ? 1 : -1) * Math.floor(i / 2) * 7, gateY + 16));
    }

    // Perimeter fence along the street, open where the drive crosses.
    for (let x = 10; x < lot.width - 20; x += 62) {
      const w = Math.min(60, lot.width - 10 - x);
      if (x + w > driveX - 30 && x < driveX + 30) continue;
      objects.push({ id: newId('f'), kind: 'prop', type: 'fence', x, y: lot.depth - 3, w, d: 1, rot: 0 });
    }
    // Street trees and lot lighting, kept off the drive.
    for (let x = 24; x < lot.width - 20; x += 58) {
      if (Math.abs(x - driveX) < 42) continue;
      objects.push({ id: newId('t'), kind: 'prop', type: 'tree', x: x - 9, y: lot.depth - 24, rot: 0 });
    }
    for (const px of [lot.width * 0.3, lot.width * 0.55, lot.width * 0.8]) {
      if (Math.abs(px - driveX) < 40) continue;
      objects.push(prop('pole', px - 1.5, lot.depth - 150));
    }
  }

  return {
    v: 3,
    preset,
    lot,
    view: { yaw: 45, pitch: 34, zoom: 1, time: 'day' },
    skin: { wall: '#d8dde3', band: '#1f3a63' },
    site: { pavement: true, parking: true, cars: true, road: true, grass: true, markings: true },
    objects: pruneInsideBuildings(objects),
  };
}

/** Bring a save forward. Anything older than the object model is rebuilt. */
export function normalize(state) {
  if (!state || typeof state !== 'object' || !Array.isArray(state.objects)) {
    const fresh = freshState(state && SITE_PRESETS[state.preset] ? state.preset : 'warehouse');
    if (state && state.lot) fresh.lot = { ...fresh.lot, ...state.lot };
    return fresh;
  }
  const base = freshState('empty');
  const out = {
    ...base,
    ...state,
    lot: { ...base.lot, ...state.lot },
    view: { ...base.view, ...state.view },
    skin: { ...base.skin, ...state.skin },
    site: { ...base.site, ...state.site },
    objects: state.objects.filter(Boolean).map((o) => ({ ...o })),
  };
  for (const o of out.objects) {
    o.rot = Number(o.rot) || 0;
    if (o.kind === 'building') {
      o.walls = o.walls || {};
      o.roofItems = Array.isArray(o.roofItems) ? o.roofItems : [];
      o.sign = { on: true, face: 'N', text: '', sub: '', color: '#1f4f9c', logo: '', ...(o.sign || {}) };
      o.cladding = o.cladding || (BUILDING_STYLES[o.style] || {}).cladding || 'precast';
      o.roofType = o.roofType || (BUILDING_STYLES[o.style] || {}).roofType || 'flat';
      for (const f of ['N', 'E', 'S', 'W']) {
        if (!Array.isArray(o.walls[f]) || !o.walls[f].length) o.walls[f] = grid(4, o.floors || 1);
      }
    }
  }
  // Old saves (and any hand-edited one) can have things standing in a wall.
  out.objects = pruneInsideBuildings(out.objects);
  seedIds(out.objects);
  return out;
}
