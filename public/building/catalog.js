/* What you can put on a lot, and the defaults each thing starts with. */

export const FLOOR_HEIGHT = 13;   // feet, for anything with floors
export const BAY_SPACING = 12;    // feet between dock door centres
export const STALL = { w: 9, d: 18 };

export const BUILDINGS = {
  warehouse: {
    name: 'Warehouse / distribution',
    icon: '🏭',
    blurb: 'Long clear-span box with a row of dock bays and an office end.',
    lot: { width: 620, depth: 420 },
    body: { length: 380, width: 150, height: 34, bays: 14 },
    office: { on: true, floors: 2, side: 'left', length: 110, windows: 'punched' },
    docks: true,
    color: '#d8dde3',
    band: '#1f3a63',
  },
  tower: {
    name: 'Office tower',
    icon: '🏢',
    blurb: 'Glass high-rise on a podium. Floors instead of bays.',
    lot: { width: 520, depth: 430 },
    body: { length: 150, width: 110, height: 0, floors: 12 },
    office: { on: true, floors: 3, side: 'left', length: 90, windows: 'curtain' },
    docks: false,
    color: '#7f8896',
    band: '#1d3557',
  },
  storage: {
    name: 'Storage unit complex',
    icon: '🔒',
    blurb: 'Rows of single-storey units with roll-up doors both sides.',
    lot: { width: 600, depth: 440 },
    body: { length: 300, width: 40, height: 11, bays: 24, rows: 3 },
    office: { on: true, floors: 1, side: 'left', length: 60, windows: 'punched' },
    docks: false,
    color: '#e2e5e8',
    band: '#8a5a20',
  },
  retail: {
    name: 'Retail strip',
    icon: '🛒',
    blurb: 'Low storefront block with a deep sign band across the front.',
    lot: { width: 560, depth: 380 },
    body: { length: 300, width: 90, height: 20, bays: 6 },
    office: { on: false, floors: 2, side: 'right', length: 80, windows: 'ribbon' },
    docks: false,
    color: '#cdb7a4',
    band: '#5b3a2e',
  },
};

export const WALL_COLORS = [
  { id: 'concrete', name: 'Precast concrete', hex: '#d8dde3' },
  { id: 'warm', name: 'Warm panel', hex: '#cdb7a4' },
  { id: 'graphite', name: 'Graphite', hex: '#6d747f' },
  { id: 'navy', name: 'Deep navy', hex: '#26364f' },
  { id: 'sand', name: 'Sandstone', hex: '#d9c9a3' },
  { id: 'white', name: 'Bright white', hex: '#f0f2f4' },
];

export const SIGN_COLORS = [
  { id: 'blue', name: 'Corporate blue', hex: '#1f4f9c' },
  { id: 'navy', name: 'Navy', hex: '#16305c' },
  { id: 'white', name: 'White', hex: '#ffffff' },
  { id: 'black', name: 'Black', hex: '#141821' },
  { id: 'red', name: 'Red', hex: '#c0392b' },
  { id: 'green', name: 'Green', hex: '#1f7a54' },
  { id: 'gold', name: 'Gold', hex: '#c9922b' },
];

export const LOGOS = ['🚽', '🚚', '🏢', '📦', '⚙️', '🛠️', '🌐', '⚡', '🛡️', '🍃', '🔩', '🧪', '☕', '🏗️', '★', '◆', ''];

export const WINDOW_STYLES = [
  { id: 'punched', name: 'Punched openings' },
  { id: 'ribbon', name: 'Ribbon windows' },
  { id: 'curtain', name: 'Full curtain wall' },
];

export function freshState(type = 'warehouse') {
  const p = BUILDINGS[type];
  return {
    v: 1,
    type,
    lot: { ...p.lot },
    body: { ...p.body },
    office: { ...p.office },
    skin: { wall: p.color, band: p.band, windows: p.office.windows },
    entrance: { doors: true, canopy: true, porch: false, steps: true },
    security: { booth: true, gate: true, barricades: 6, fence: true, guard: true },
    signs: {
      wall: { text: 'TOILET PLUS SOLUTIONS', sub: 'SOLUTIONS THAT WORK FOR YOU', color: '#1f4f9c', logo: '🚽' },
      booth: { text: 'TOILET PLUS SOLUTIONS', color: '#ffffff', logo: '🚽' },
      monument: { text: 'ALL VISITORS MUST CHECK IN AT SECURITY', color: '#ffffff', logo: '🛡️', on: true },
    },
    site: { parking: true, trailers: true, cars: true, trees: true, poles: true },
    view: { time: 'day', rot: 0, zoom: 1 },
  };
}

/** Bring a saved state forward if the shape has grown since it was written. */
export function normalize(state) {
  const base = freshState(BUILDINGS[state?.type] ? state.type : 'warehouse');
  if (!state || typeof state !== 'object') return base;
  const merge = (a, b) => (b && typeof b === 'object' && !Array.isArray(b) ? { ...a, ...b } : a);
  return {
    ...base,
    ...state,
    lot: merge(base.lot, state.lot),
    body: merge(base.body, state.body),
    office: merge(base.office, state.office),
    skin: merge(base.skin, state.skin),
    entrance: merge(base.entrance, state.entrance),
    security: merge(base.security, state.security),
    signs: {
      wall: merge(base.signs.wall, state.signs?.wall),
      booth: merge(base.signs.booth, state.signs?.booth),
      monument: merge(base.signs.monument, state.signs?.monument),
    },
    site: merge(base.site, state.site),
    view: merge(base.view, state.view),
  };
}
