/* Interiors: what a building's inside is made of.
 *
 * A building keeps its interior as
 *   b.interior = { ceiling, ceilingType, ceilingColor, floor, floorColor,
 *                  wallColor, autoLights, levels: { n: { walls, items, areas } } }
 * with everything measured in feet from the building's own north-west corner
 * (x across its width, y down its depth toward the front), on each storey:
 *   walls  [{ id, a: [x, y], b: [x, y], type, h, color }]
 *   items  [{ id, type, x, y, rot, lift, color, ... }]   (x, y is the centre)
 *   areas  [{ id, x, y, w, d, finish, color }]            (a patch of flooring)
 * Nothing in here draws anything. */

import { buildingHeight, newId } from './catalog.js';

export const WALL_T = 0.6;           // thickness of the outside walls, ft

/* ------------------------------------------------------- partition walls */

export const WALL_TYPES = [
  { id: 'drywall', name: 'Plasterboard wall', icon: '▮', t: 0.42, paint: true },
  { id: 'glass', name: 'Glass partition', icon: '🪟', t: 0.16 },
  { id: 'half', name: 'Half-height wall', icon: '▂', t: 0.42, h: 3.5, paint: true },
  { id: 'block', name: 'Painted blockwork', icon: '🧱', t: 0.66, paint: true },
  { id: 'brick', name: 'Facing brick', icon: '🟫', t: 0.66 },
  { id: 'timber', name: 'Timber slat screen', icon: '𝍪', t: 0.3 },
  { id: 'cubicle', name: 'Cubicle panel', icon: '▦', t: 0.2, h: 5.4, paint: true, colors: ['#7d8791', '#5a6b7d', '#8a7f6e', '#4d6b5a', '#7a4a4a'] },
  { id: 'mesh', name: 'Wire mesh partition', icon: '▩', t: 0.12, h: 8 },
  { id: 'rail', name: 'Glass guard rail', icon: '⎽', t: 0.12, h: 3.5 },
  { id: 'curtain', name: 'Cubicle curtain', icon: '〰️', t: 0.12, h: 6.6, paint: true, colors: ['#a9cbe0', '#c9d9c2', '#e2d2c2', '#d9c2d6', '#9fb6c9'] },
];
export const WALL_BY_ID = Object.fromEntries(WALL_TYPES.map((w) => [w.id, w]));
export const WALL_PAINTS = ['#eceae4', '#f6f5f1', '#d9d4c7', '#c9d3d9', '#b9c7b6', '#d9c9a8', '#a9b3bd', '#8a9aa8', '#5b6670', '#3d434b', '#7a3b3b', '#2f4a6b', '#c9a23a', '#3f6b52'];

/* ---------------------------------------------------------------- items */

export const ITEM_TABS = [
  ['doors', '🚪 Doors'], ['office', '💼 Office'], ['retail', '🛒 Retail'], ['warehouse', '📦 Warehouse'],
  ['dining', '🍽️ Restaurant'], ['kitchen', '🍳 Pro kitchen'], ['school', '🏫 School'], ['medical', '🏥 Medical'],
  ['living', '🛋️ Living'], ['bedroom', '🛏️ Bedroom'], ['home', '🏠 Home kitchen'], ['bath', '🚿 Bath & WC'],
  ['lobby', '🏛️ Lobby'], ['garage', '🔧 Garage & showroom'], ['gym', '🏋️ Gym'], ['lighting', '💡 Lighting'],
  ['decor', '🪴 Décor'], ['people', '🧍 People'],
];

/* Filled in by the furniture modules (each registers the items it can build). */
export const ITEMS = [];
export const ITEM_BY_ID = {};

/** Register items: (tab, id, name, icon, w, d, h, extra). */
export function defineItems(list) {
  for (const [tab, id, name, icon, w, d, h, extra = {}] of list) {
    const spec = { tab, id, name, icon, w, d, h, ...extra };
    if (ITEM_BY_ID[id]) ITEMS.splice(ITEMS.indexOf(ITEM_BY_ID[id]), 1, spec); else ITEMS.push(spec);
    ITEM_BY_ID[id] = spec;
  }
}

/* --------------------------------------------------------------- helpers */

export function ensureInterior(b) {
  if (!b.interior) b.interior = { levels: {} };
  if (!b.interior.levels) b.interior.levels = {};
  return b.interior;
}

export function levelOf(b, n = 0) {
  const it = ensureInterior(b);
  if (!it.levels[n]) it.levels[n] = { walls: [], items: [], areas: [] };
  const L = it.levels[n];
  L.walls = L.walls || [];
  L.items = L.items || [];
  L.areas = L.areas || [];
  return L;
}

/** Does this building have anything inside yet? */
export function hasInterior(b) {
  const it = b && b.interior;
  if (!it || !it.levels) return false;
  return Object.values(it.levels).some((L) => (L.walls && L.walls.length) || (L.items && L.items.length) || (L.areas && L.areas.length));
}

/** Storey height, ceiling height and finishes of a building's rooms. */
export function roomOf(b) {
  const it = b.interior || {};
  const floors = Math.max(1, b.floors || 1);
  const H = buildingHeight(b);
  const fh = H / floors;
  const tall = fh > 14;
  const type = it.ceilingType || (tall ? 'open' : 'tile');
  const most = fh - (type === 'open' ? 0.35 : 0.5);
  const ceil = Math.max(6.8, Math.min(most, it.ceiling || (type === 'open' ? most : Math.min(most, tall ? 12 : 9))));
  return {
    floors, H, fh, ceil, ceilingType: type, ceilMax: most,
    ceilingColor: it.ceilingColor || '#f4f4f1',
    floor: it.floor || (tall ? 'concrete' : 'carpettile'),
    floorColor: it.floorColor || null,
    wallColor: it.wallColor || '#eceae4',
    autoLights: it.autoLights !== false,
  };
}

/** How tall a partition stands: its own height, its type's, or up to the ceiling. */
export function wallHeight(wall, room) {
  const t = WALL_BY_ID[wall.type] || WALL_TYPES[0];
  const top = room.ceilingType === 'open' ? Math.min(room.ceil, Math.max(10, room.ceil)) : room.ceil;
  return Math.min(top, wall.h || t.h || top);
}

export function makeItem(type, x, y, rot = 0, extra = {}) {
  return { id: newId('i'), type, x, y, rot, ...extra };
}

/** The footprint of an item: its catalogue size, or its own if it stretches. */
export function itemSize(it) {
  const s = ITEM_BY_ID[it.type] || { w: 2, d: 2, h: 3 };
  return { w: it.w || s.w, d: s.d, h: s.h };
}

/** Distance from a point to a wall segment, and how far along it the nearest point is. */
export function nearWall(wall, x, y) {
  const dx = wall.b[0] - wall.a[0];
  const dy = wall.b[1] - wall.a[1];
  const L2 = dx * dx + dy * dy || 1e-6;
  const t = Math.max(0, Math.min(1, ((x - wall.a[0]) * dx + (y - wall.a[1]) * dy) / L2));
  const px = wall.a[0] + dx * t;
  const py = wall.a[1] + dy * t;
  return { dist: Math.hypot(x - px, y - py), t, px, py, len: Math.sqrt(L2), ux: dx / Math.sqrt(L2), uy: dy / Math.sqrt(L2) };
}

/** The four outside walls as segments on the inside face, for snapping furniture and doors to. */
export function perimeter(b) {
  const T = WALL_T;
  const w = b.w;
  const d = b.d;
  return [
    { id: 'N', a: [T, d - T], b: [w - T, d - T], type: 'outer', outer: true },
    { id: 'S', a: [w - T, T], b: [T, T], type: 'outer', outer: true },
    { id: 'E', a: [w - T, d - T], b: [w - T, T], type: 'outer', outer: true },
    { id: 'W', a: [T, T], b: [T, d - T], type: 'outer', outer: true },
  ];
}
