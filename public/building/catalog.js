/* What can go on a lot, how big it is, and what a fresh site starts as.
 *
 * Everything on the site is an object in `state.objects` — buildings included —
 * so anything can be selected, moved, turned or deleted. Sizes are in feet. */

import { overlaps } from './geom.js';

export const FLOOR_HEIGHT = 13;
export const STALL = { w: 9, d: 18 };

/* ------------------------------------------------------------------ colours */

export const WALL_COLORS = [
  { id: 'concrete', name: 'Precast concrete', hex: '#d8dde3' },
  { id: 'white', name: 'Bright white', hex: '#f0f2f4' },
  { id: 'warm', name: 'Warm panel', hex: '#cdb7a4' },
  { id: 'sand', name: 'Sandstone', hex: '#d9c9a3' },
  { id: 'cream', name: 'Cream render', hex: '#ece3cf' },
  { id: 'silver', name: 'Silver metal', hex: '#b9c2c9' },
  { id: 'graphite', name: 'Graphite', hex: '#6d747f' },
  { id: 'charcoal', name: 'Charcoal', hex: '#3d434b' },
  { id: 'navy', name: 'Deep navy', hex: '#26364f' },
  { id: 'teal', name: 'Teal', hex: '#2f6b6d' },
  { id: 'sage', name: 'Sage', hex: '#8f9d89' },
  { id: 'brick', name: 'Red brick', hex: '#9c5b47' },
  { id: 'buff', name: 'Buff brick', hex: '#c4a27a' },
  { id: 'timber', name: 'Barn red', hex: '#8d4a3c' },
  { id: 'cedar', name: 'Cedar', hex: '#9a6b47' },
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
  { id: 'teal', name: 'Teal', hex: '#13867d' },
  { id: 'purple', name: 'Purple', hex: '#6a3d9a' },
];

export const VEHICLE_COLORS = ['#d9dde2', '#1d2735', '#7d2f2f', '#1e2229', '#f1f2f4', '#35543f', '#8d5a24', '#2c4a7c', '#9aa3ad', '#5b2a43', '#c9a227', '#3e6fb0'];

export const LOGOS = ['🚽', '🚚', '🏢', '📦', '⚙️', '🛠️', '🌐', '⚡', '🛡️', '🍃', '🔩', '🧪', '☕', '🏗️', '🏥', '🛒', '⛽', '🚒', '★', '◆', '▲', ''];

/* ------------------------------------------------------- wall cell types */

/* A wall is a grid: one row per floor, a fixed number of bays across. Each
 * cell is one of these, and the player sets every one of them by hand. */
export const CELLS = [
  { id: 'blank', name: 'Blank wall', icon: '▢', ground: true, upper: true },
  { id: 'window', name: 'Window', icon: '🪟', ground: true, upper: true },
  { id: 'ribbon', name: 'Ribbon glass', icon: '▭', ground: true, upper: true },
  { id: 'glass', name: 'Curtain wall', icon: '⬜', ground: true, upper: true },
  { id: 'balcony', name: 'Balcony', icon: '🏙️', ground: true, upper: true },
  { id: 'shopfront', name: 'Shopfront', icon: '🏪', ground: true, upper: false },
  { id: 'door', name: 'Entrance', icon: '🚪', ground: true, upper: false },
  { id: 'firedoor', name: 'Steel door', icon: '🚷', ground: true, upper: false },
  { id: 'dock', name: 'Loading bay', icon: '🚛', ground: true, upper: false },
  { id: 'roll', name: 'Roll-up door', icon: '🔒', ground: true, upper: false },
  { id: 'garage', name: 'Garage door', icon: '🏠', ground: true, upper: false },
  { id: 'louvre', name: 'Louvre', icon: '≡', ground: true, upper: true },
  { id: 'vent', name: 'Vent', icon: '◍', ground: true, upper: true },
  { id: 'open', name: 'Open deck', icon: '▤', ground: true, upper: true },
];

export const CELL_IDS = CELLS.map((c) => c.id);

/* --------------------------------------------------------- rooftop machines */

/* Rooftop plant. Nothing is placed automatically unless a model ships with it
 * — the player puts every piece down, on any roof. Sizes in feet. */
export const ROOF_KIT = [
  { id: 'rtu', name: 'Packaged AC unit', icon: '🔲', w: 8, d: 6, h: 3.4 },
  { id: 'rtu-xl', name: 'Large rooftop unit', icon: '⬛', w: 15, d: 9, h: 5 },
  { id: 'chiller', name: 'Chiller', icon: '❄️', w: 18, d: 8, h: 6 },
  { id: 'cooling', name: 'Cooling tower', icon: '💨', w: 11, d: 11, h: 11 },
  { id: 'condensers', name: 'Condenser bank', icon: '🧊', w: 16, d: 4, h: 3 },
  { id: 'fan', name: 'Exhaust fan', icon: '🌀', w: 4.4, d: 4.4, h: 2.6 },
  { id: 'mushroom', name: 'Mushroom vent', icon: '🍄', w: 3.2, d: 3.2, h: 2.2 },
  { id: 'flue', name: 'Flue stack', icon: '🏭', w: 2.4, d: 2.4, h: 11 },
  { id: 'chimney', name: 'Brick chimney', icon: '🧱', w: 7, d: 7, h: 48 },
  { id: 'skylight', name: 'Skylight', icon: '🔆', w: 10, d: 6, h: 1 },
  { id: 'dome', name: 'Skylight dome', icon: '🔵', w: 6, d: 6, h: 2.4 },
  { id: 'monitor', name: 'Skylight monitor', icon: '🔅', w: 24, d: 7, h: 3 },
  { id: 'solar', name: 'Solar array', icon: '🔋', w: 22, d: 11, h: 3.6 },
  { id: 'greenroof', name: 'Green roof', icon: '🌱', w: 30, d: 20, h: 1 },
  { id: 'helipad', name: 'Helipad', icon: '🚁', w: 44, d: 44, h: 1.4 },
  { id: 'dish', name: 'Satellite dish', icon: '📡', w: 8, d: 8, h: 6 },
  { id: 'mast', name: 'Antenna mast', icon: '📶', w: 3, d: 3, h: 24 },
  { id: 'tank', name: 'Water tank', icon: '🛢️', w: 12, d: 12, h: 16 },
  { id: 'stair', name: 'Stair bulkhead', icon: '🚪', w: 13, d: 10, h: 9 },
  { id: 'lift', name: 'Lift overrun', icon: '🛗', w: 11, d: 11, h: 13 },
  { id: 'duct', name: 'Duct run', icon: '🧵', w: 26, d: 3.4, h: 3 },
  { id: 'pipes', name: 'Pipe rack', icon: '〰️', w: 20, d: 4, h: 3.4 },
  { id: 'screen', name: 'Plant screen', icon: '🚧', w: 22, d: 16, h: 7 },
  { id: 'billboard', name: 'Roof sign frame', icon: '🪧', w: 30, d: 3, h: 12 },
  // Heavy plant: big enough to need its own steel to stand on.
  { id: 'ahu', name: 'Air handling unit', icon: '🏭', w: 42, d: 12, h: 11, big: true },
  { id: 'chiller-xl', name: 'Big air-cooled chiller', icon: '🧊', w: 44, d: 9, h: 9, big: true },
  { id: 'tower-twin', name: 'Twin-cell cooling tower', icon: '🌫️', w: 30, d: 15, h: 17, big: true },
  { id: 'rtu-mega', name: '50-ton rooftop unit', icon: '🟦', w: 30, d: 10, h: 8, big: true },
  { id: 'drycooler', name: 'Dry cooler bank', icon: '🌀', w: 38, d: 10, h: 8, big: true },
  // Smaller kit.
  { id: 'vrf', name: 'VRF condenser', icon: '❄️', w: 6, d: 3, h: 6 },
  { id: 'erv', name: 'Energy recovery unit', icon: '♻️', w: 12, d: 6, h: 5 },
  { id: 'kitchenfan', name: 'Kitchen upblast fan', icon: '🍳', w: 5, d: 5, h: 4.5 },
  { id: 'boilerflues', name: 'Boiler flue cluster', icon: '🔥', w: 7, d: 7, h: 15 },
  { id: 'pumpskid', name: 'Pump skid', icon: '⚙️', w: 10, d: 6, h: 4 },
];

/* Ductwork and pipework, drawn as runs from point to point. */
export const RUNS = [
  { id: 'duct', name: 'Rectangular duct', icon: '▭', size: 3, color: '#b8bfc6' },
  { id: 'spiral', name: 'Round duct', icon: '◯', size: 2.4, color: '#c3c9cf' },
  { id: 'pipes', name: 'Insulated pipes', icon: '〰️', size: 2, color: '#d9dde1' },
  { id: 'tray', name: 'Cable tray', icon: '🔌', size: 2, color: '#8d949b' },
  { id: 'conduit', name: 'Conduit bundle', icon: '➰', size: 1, color: '#9aa1a8' },
  { id: 'gas', name: 'Gas main', icon: '🟨', size: 0.8, color: '#e2b31b' },
];
export const RUN_BY_ID = Object.fromEntries(RUNS.map((r) => [r.id, r]));

/* ------------------------------------------------------------ guard booths */

export const BOOTHS = [
  { id: 'classic', name: 'Classic cabin', icon: '🏛️', w: 26, d: 18, h: 10 },
  { id: 'canopy', name: 'Deep canopy', icon: '⛺', w: 24, d: 16, h: 10 },
  { id: 'brick', name: 'Brick gatehouse', icon: '🧱', w: 30, d: 22, h: 11 },
  { id: 'cube', name: 'Glass cube', icon: '🔷', w: 18, d: 18, h: 11 },
  { id: 'container', name: 'Container booth', icon: '📦', w: 20, d: 8, h: 9 },
  { id: 'twin', name: 'Twin-lane kiosk', icon: '🚦', w: 34, d: 14, h: 10 },
  { id: 'hut', name: 'Pitched hut', icon: '🏠', w: 16, d: 14, h: 9 },
  { id: 'tower', name: 'Raised lookout', icon: '🗼', w: 14, d: 14, h: 20 },
  { id: 'kiosk', name: 'Round kiosk', icon: '⚪', w: 14, d: 14, h: 10 },
  { id: 'office', name: 'Gate office', icon: '🏢', w: 34, d: 24, h: 13 },
];

/* ------------------------------------------------------------------- props */

/* The props menu. `solid` things cannot share ground with each other or stand
 * inside a building; scatter (signs, cones, planting, people) can. `len` props
 * stretch along their length; `light` props light the site after dark. */
const P = (cat, id, name, icon, w, d, h, extra = {}) => ({ cat, id, name, icon, w, d, h, ...extra });

export const PROPS = [
  // boundary
  P('Boundary', 'fence', 'Mesh fence', '🚧', 40, 1, 8, { len: true }),
  P('Boundary', 'palisade', 'Palisade fence', '🔱', 40, 1, 8, { len: true }),
  P('Boundary', 'woodfence', 'Timber fence', '🪵', 40, 0.8, 6, { len: true }),
  P('Boundary', 'wall', 'Boundary wall', '🧱', 40, 1.4, 7, { len: true, solid: true }),
  P('Boundary', 'guardrail', 'Guard rail', '➖', 30, 0.8, 2.6, { len: true }),
  // gates
  P('Gates', 'gate', 'Gate arm', '⛔', 30, 3, 5),
  P('Gates', 'heavyboom', 'Heavy boom with skirt', '🚧', 30, 3, 6),
  P('Gates', 'slidegate', 'Sliding gate', '🚪', 32, 1.4, 7, { len: true }),
  P('Gates', 'cantilever', 'Cantilever gate', '➡️', 34, 2, 8.5, { len: true }),
  P('Gates', 'swinggate', 'Double swing gates', '🚪', 24, 1.6, 8, { len: true }),
  P('Gates', 'bifold', 'Bi-folding speed gate', '🪗', 22, 2, 8),
  P('Gates', 'wedge', 'Road blocker', '🛑', 12, 7, 3, { solid: true }),
  P('Gates', 'risingbollards', 'Rising bollards', '🟠', 14, 2, 3.4),
  P('Gates', 'tyrekiller', 'Tyre killer', '🦔', 14, 2.6, 0.6),
  P('Gates', 'pedgate', 'Pedestrian gate', '🚶', 7, 2, 8),
  P('Gates', 'turnstile', 'Turnstile', '🎫', 6, 4, 7.5, { solid: true }),
  P('Gates', 'archgate', 'Entrance portal', '⛩️', 42, 4, 22, { sign: true }),
  P('Boundary', 'bollard', 'Bollard', '🟡', 1.5, 1.5, 3.6),
  P('Boundary', 'barrier', 'Concrete barrier', '🚏', 12, 2, 3.2, { solid: true }),
  P('Boundary', 'crowdbarrier', 'Crowd barrier', '🚥', 8, 1.6, 3.6),
  P('Boundary', 'cone', 'Traffic cone', '🔶', 1.6, 1.6, 2.4),
  P('Boundary', 'drum', 'Traffic drum', '🛢️', 2, 2, 3.4),
  P('Boundary', 'speedbump', 'Speed bump', '〰️', 24, 3, 0.35, { len: true }),
  // roads
  P('Roads', 'road', 'Two-lane road', '🛣️', 80, 26, 0.3, { len: true, road: true }),
  P('Roads', 'lane', 'Service lane', '➖', 80, 14, 0.3, { len: true, road: true }),
  P('Roads', 'bend', 'Road bend', '↪️', 60, 60, 0.3, { road: true }),
  P('Roads', 'tee', 'T-junction', '⊥', 40, 40, 0.3, { road: true }),
  P('Roads', 'cross', 'Crossroads', '➕', 40, 40, 0.3, { road: true }),
  P('Roads', 'roundabout', 'Roundabout', '🔄', 110, 110, 0.3, { road: true }),
  P('Roads', 'culdesac', 'Turning head', '⭕', 70, 70, 0.3, { road: true }),
  P('Roads', 'zebra', 'Zebra crossing', '🦓', 26, 10, 0.1),
  // plant yard
  P('Plant yard', 'plantyard', 'Plant compound', '🔲', 44, 26, 8),
  P('Plant yard', 'lowwall', 'Low wall', '🧱', 30, 1.2, 4.5, { len: true, solid: true }),
  P('Plant yard', 'screenwall', 'Louvred screen', '🟫', 30, 1, 8, { len: true, solid: true }),
  P('Plant yard', 'plantpad', 'Concrete plinth', '⬜', 24, 14, 0.8),
  P('Plant yard', 'pipebridge', 'Pipe bridge', '🌉', 40, 6, 16, { len: true }),
  // signs
  P('Signs', 'monument', 'Monument sign', '🪧', 26, 3, 17, { sign: true, solid: true }),
  P('Signs', 'pylon', 'Pylon sign', '🛑', 14, 3, 28, { sign: true }),
  P('Signs', 'billboard', 'Billboard', '📰', 40, 3, 34, { sign: true }),
  P('Signs', 'postsign', 'Post sign', '📋', 8, 0.8, 8, { sign: true }),
  P('Signs', 'dirsign', 'Direction sign', '↗️', 6, 0.6, 9, { sign: true }),
  P('Signs', 'stopsign', 'Stop sign', '🛑', 2.6, 0.6, 8),
  P('Signs', 'speedsign', 'Speed limit sign', '🔢', 2.4, 0.6, 8),
  P('Signs', 'parksign', 'Parking sign', '🅿️', 2.4, 0.6, 8),
  P('Signs', 'adasign', 'Accessible bay sign', '♿', 2, 0.6, 7),
  P('Signs', 'trafficlight', 'Traffic light', '🚦', 2, 2, 16, { light: true }),
  P('Signs', 'flag', 'Flagpole', '🏳️', 2, 2, 34, { anim: true }),
  P('Signs', 'flags3', 'Three flagpoles', '🎌', 16, 2, 34, { anim: true }),
  // lighting
  P('Lighting', 'pole', 'Light pole', '💡', 3, 3, 27, { light: true }),
  P('Lighting', 'pole2', 'Double light pole', '🔆', 3, 3, 30, { light: true }),
  P('Lighting', 'floodmast', 'Flood mast', '🔦', 4, 4, 42, { light: true }),
  P('Lighting', 'streetlamp', 'Street lamp', '🏮', 2, 6, 24, { light: true }),
  P('Lighting', 'heritage', 'Heritage lamp', '🕯️', 2, 2, 13, { light: true }),
  P('Lighting', 'bollardlight', 'Bollard light', '🔅', 1.4, 1.4, 4, { light: true }),
  P('Lighting', 'cctv', 'CCTV pole', '📹', 2, 2, 20),
  // planting
  P('Planting', 'tree', 'Broadleaf tree', '🌳', 18, 18, 26),
  P('Planting', 'oak', 'Big oak', '🌳', 30, 30, 38),
  P('Planting', 'maple', 'Maple', '🍁', 20, 20, 28),
  P('Planting', 'birch', 'Birch', '🌿', 12, 12, 30),
  P('Planting', 'conifer', 'Conifer', '🌲', 12, 12, 30),
  P('Planting', 'pine', 'Tall pine', '🌲', 14, 14, 46),
  P('Planting', 'palm', 'Palm', '🌴', 12, 12, 30),
  P('Planting', 'shrub', 'Shrub', '🌿', 7, 7, 4),
  P('Planting', 'hedge', 'Hedge run', '🍃', 24, 4, 5, { len: true }),
  P('Planting', 'flowerbed', 'Flower bed', '🌷', 14, 6, 1.6),
  P('Planting', 'planter', 'Planter', '🪴', 6, 6, 3),
  P('Planting', 'rock', 'Boulder', '🪨', 6, 5, 3.2),
  P('Planting', 'pond', 'Pond', '💧', 40, 26, 0.3),
  P('Planting', 'fountain', 'Fountain', '⛲', 16, 16, 7, { solid: true }),
  // yard
  P('Yard', 'dumpster', 'Dumpster', '🗑️', 8, 6, 5, { solid: true }),
  P('Yard', 'skip', 'Skip', '🟨', 12, 6, 5, { solid: true }),
  P('Yard', 'compactor', 'Waste compactor', '🗜️', 20, 8, 8, { solid: true }),
  P('Yard', 'recycling', 'Recycling bins', '♻️', 12, 4, 4.5, { solid: true }),
  P('Yard', 'container', 'Shipping container', '📦', 40, 8, 9.5, { solid: true, color: true }),
  P('Yard', 'containers', 'Container stack', '🧱', 40, 8, 19, { solid: true }),
  P('Yard', 'generator', 'Generator', '⚡', 14, 6, 7, { solid: true }),
  P('Yard', 'transformer', 'Transformer', '🔌', 8, 8, 8, { solid: true }),
  P('Yard', 'lpg', 'LPG tank', '🛢️', 18, 6, 7, { solid: true }),
  P('Yard', 'oiltank', 'Oil tank', '🛢️', 10, 10, 12, { solid: true }),
  P('Yard', 'ibc', 'IBC tanks', '🧴', 9, 4, 4.4, { solid: true }),
  P('Yard', 'gascage', 'Gas cylinder cage', '🧯', 6, 4, 7, { solid: true }),
  P('Yard', 'silo', 'Silo', '🏗️', 16, 16, 44, { solid: true }),
  P('Yard', 'watertower', 'Water tower', '🗼', 24, 24, 70, { solid: true }),
  P('Yard', 'pallets', 'Pallet stack', '🟫', 8, 6, 5, { solid: true }),
  P('Yard', 'racking', 'Pallet racking', '🗄️', 30, 4, 16, { solid: true, len: true }),
  P('Yard', 'canopy', 'Yard canopy', '⛱️', 40, 24, 15, { solid: true }),
  P('Yard', 'carport', 'Solar carport', '🔋', 36, 18, 11, { solid: true }),
  P('Yard', 'evcharger', 'EV charger', '🔌', 2, 1.4, 5.5),
  P('Yard', 'fuelisland', 'Fuel pumps', '⛽', 14, 4, 6.5, { solid: true }),
  P('Yard', 'fuelcanopy', 'Fuel canopy', '🛖', 70, 40, 18, { light: true }),
  P('Yard', 'busshelter', 'Bus shelter', '🚏', 12, 5, 9, { solid: true }),
  P('Yard', 'smokeshelter', 'Smoking shelter', '🚬', 10, 6, 8, { solid: true }),
  P('Yard', 'bikerack', 'Bike rack', '🚲', 10, 3, 3),
  P('Yard', 'bench', 'Bench', '🪑', 6, 2, 3),
  P('Yard', 'picnic', 'Picnic table', '🧺', 7, 6, 3),
  P('Yard', 'trashcan', 'Litter bin', '🗑️', 2, 2, 3.4),
  P('Yard', 'hydrant', 'Fire hydrant', '🧯', 1.4, 1.4, 2.8),
  P('Yard', 'mailbox', 'Post box', '📮', 2, 2, 4.6),
  P('Yard', 'vending', 'Vending machine', '🥤', 3.2, 3, 6.2, { solid: true }),
  P('Yard', 'portaloo', 'Portable toilet', '🚽', 4, 4, 7.6, { solid: true }),
  P('Yard', 'cabin', 'Site cabin', '🏚️', 32, 10, 9, { solid: true }),
  P('Yard', 'scaffold', 'Scaffold tower', '🪜', 8, 6, 20, { solid: true }),
  P('Yard', 'turbine', 'Wind turbine', '🌬️', 14, 14, 180, { solid: true, anim: true }),
  P('Yard', 'phonemast', 'Phone mast', '📶', 10, 10, 90, { solid: true }),
  P('Yard', 'powerpole', 'Power pole', '🔌', 3, 6, 36),
  // vehicles
  P('Vehicles', 'trailer', 'Trailer', '🚛', 8.5, 48, 13.5, { vehicle: true, solid: true, color: true }),
  P('Vehicles', 'reefer', 'Reefer trailer', '❄️', 8.5, 53, 13.5, { vehicle: true, solid: true }),
  P('Vehicles', 'tractor', 'Tractor unit', '🚚', 8.5, 22, 13, { vehicle: true, solid: true, color: true }),
  P('Vehicles', 'boxtruck', 'Box truck', '🚐', 8, 26, 12.5, { vehicle: true, solid: true, color: true }),
  P('Vehicles', 'tanker', 'Tanker', '🚛', 8.5, 46, 12, { vehicle: true, solid: true }),
  P('Vehicles', 'flatbed', 'Flatbed with load', '🛻', 8.5, 48, 9.5, { vehicle: true, solid: true }),
  P('Vehicles', 'dumptruck', 'Dump truck', '🚚', 8.5, 26, 11, { vehicle: true, solid: true, color: true }),
  P('Vehicles', 'mixer', 'Cement mixer', '🚛', 8.5, 30, 12.5, { vehicle: true, solid: true }),
  P('Vehicles', 'bus', 'Bus', '🚌', 8.4, 40, 10.5, { vehicle: true, solid: true, color: true }),
  P('Vehicles', 'van', 'Van', '🚙', 6.6, 18, 8, { vehicle: true, solid: true, color: true }),
  P('Vehicles', 'pickup', 'Pickup', '🛻', 6.6, 18, 6.2, { vehicle: true, solid: true, color: true }),
  P('Vehicles', 'suv', 'SUV', '🚙', 6.4, 16, 6, { vehicle: true, solid: true, color: true }),
  P('Vehicles', 'car', 'Car', '🚗', 6, 15, 4.8, { vehicle: true, solid: true, color: true }),
  P('Vehicles', 'hatch', 'Hatchback', '🚗', 5.8, 13, 4.9, { vehicle: true, solid: true, color: true }),
  P('Vehicles', 'police', 'Police car', '🚓', 6.2, 16, 5.4, { vehicle: true, solid: true }),
  P('Vehicles', 'ambulance', 'Ambulance', '🚑', 7.4, 21, 9.5, { vehicle: true, solid: true }),
  P('Vehicles', 'firetruck', 'Fire engine', '🚒', 8.4, 32, 11, { vehicle: true, solid: true }),
  P('Vehicles', 'forklift', 'Forklift', '🏗️', 4.4, 10, 7.4, { vehicle: true, solid: true }),
  P('Vehicles', 'excavator', 'Excavator', '🚜', 10, 28, 12, { vehicle: true, solid: true }),
  P('Vehicles', 'crane', 'Tower crane', '🏗️', 16, 16, 160, { solid: true }),
  P('Vehicles', 'mobilecrane', 'Mobile crane', '🏗️', 9, 40, 14, { vehicle: true, solid: true }),
  // people
  P('People', 'worker', 'Worker', '👷', 2, 1.4, 5.8),
  P('People', 'visitor', 'Visitor', '🧍', 2, 1.4, 5.7),
  P('People', 'guard', 'Security guard', '💂', 2, 1.4, 5.9),
  P('People', 'group', 'Group of people', '👥', 8, 6, 5.8),
];

export const PROP_BY_ID = Object.fromEntries(PROPS.map((p) => [p.id, p]));
export const ROOF_BY_ID = Object.fromEntries(ROOF_KIT.map((p) => [p.id, p]));
export const BOOTH_BY_ID = Object.fromEntries(BOOTHS.map((p) => [p.id, p]));
export const PROP_CATS = [...new Set(PROPS.map((p) => p.cat))];

/* -------------------------------------------------------------- buildings */

export const CLADDINGS = [
  { id: 'precast', name: 'Precast panels' },
  { id: 'rib', name: 'Ribbed metal' },
  { id: 'brick', name: 'Brick' },
  { id: 'render', name: 'Smooth render' },
  { id: 'stone', name: 'Stone blocks' },
  { id: 'timber', name: 'Timber boards' },
  { id: 'composite', name: 'Composite panels' },
];

export const ROOF_TYPES = [
  { id: 'flat', name: 'Flat' },
  { id: 'gable', name: 'Pitched' },
  { id: 'hip', name: 'Hipped' },
  { id: 'mono', name: 'Monopitch' },
  { id: 'barrel', name: 'Barrel arch' },
  { id: 'saw', name: 'Sawtooth' },
];

export const BUILDING_GROUPS = ['Sheds & industry', 'Offices & shops', 'Civic', 'Homes', 'Small buildings'];

/* A recipe paints a model's walls: [faces, rows, from, to, cell]. Faces are any
 * of N/E/S/W (N is the front). Rows are 'all', 'g' (ground), 'u' (upper) or a
 * floor number. Columns count from the viewer's left; negative counts from the
 * right; 'mid' is the middle bay; `to` is exclusive and defaults to from + 1.
 * The cell may be a list, cycled across the columns. */
const r = (faces, rows, a, b, cell) => ({ faces, rows, a, b, cell });
const ALL = 'all';

const S = (group, name, icon, size, look, recipe, extra = {}) => ({
  group, name, icon, ...size, ...look, recipe, ...extra,
});

export const BUILDING_STYLES = {
  /* ---- sheds & industry ---- */
  shed: S('Sheds & industry', 'Warehouse shell', '🏭', { w: 380, d: 150, floors: 1, height: 34, cell: 12 },
    { cladding: 'precast', wall: '#d8dde3', band: '#1f3a63' },
    [r('N', 'g', 2, -2, 'dock'), r('N', 'g', -1, null, 'firedoor'), r('E', 'g', 1, null, 'roll'), r('W', 'g', 1, null, 'firedoor')],
    { blurb: 'Clear-span box. Put loading bays where you want them.' }),
  megashed: S('Sheds & industry', 'Mega shed', '🏬', { w: 560, d: 280, floors: 1, height: 44, cell: 12 },
    { cladding: 'composite', wall: '#e3e7eb', band: '#164a7a' },
    [r('N', 'g', 3, -3, 'dock'), r('S', 'g', 3, -3, 'dock'), r('N', 'g', 1, null, 'door'), r('EW', 'g', 2, null, 'roll')],
    { blurb: 'Half a million square feet of distribution.', roof: [['monitor', 0.25, 0.3], ['monitor', 0.5, 0.3], ['monitor', 0.75, 0.3], ['monitor', 0.25, 0.7], ['monitor', 0.5, 0.7], ['monitor', 0.75, 0.7]] }),
  row: S('Sheds & industry', 'Storage row', '🔒', { w: 300, d: 40, floors: 1, height: 11, cell: 10 },
    { cladding: 'rib', wall: '#e2e5e8', band: '#c25b1d' },
    [r('NS', 'g', 0, -0, 'roll')], { blurb: 'Single-storey units with roll-up doors both sides.' }),
  workshop: S('Sheds & industry', 'Workshop', '🔧', { w: 100, d: 62, floors: 1, height: 24, cell: 12 },
    { cladding: 'rib', wall: '#b9c2c9', band: '#3f4a57' },
    [r('N', 'g', 1, -1, 'roll'), r('N', 'g', 0, null, 'door'), r('S', 'g', 1, 3, 'roll'), r('E', 'g', 1, -1, 'window')],
    { blurb: 'Maintenance shop with roll-up doors.' }),
  cold: S('Sheds & industry', 'Cold store', '🧊', { w: 170, d: 120, floors: 1, height: 46, cell: 12 },
    { cladding: 'composite', wall: '#eef1f4', band: '#2f5f8a' },
    [r('N', 'g', 2, 8, 'dock'), r('E', 'g', 1, null, 'firedoor'), r('W', 'g', -3, null, 'louvre')],
    { blurb: 'Tall insulated box, almost no openings.', roof: [['condensers', 0.3, 0.2], ['condensers', 0.6, 0.2], ['chiller', 0.5, 0.75]] }),
  plant: S('Sheds & industry', 'Plant room', '⚙️', { w: 64, d: 42, floors: 1, height: 27, cell: 10 },
    { cladding: 'precast', wall: '#a7adb6', band: '#40484f' },
    [r('NSEW', 'g', 1, -1, 'louvre'), r('N', 'g', 0, null, 'firedoor')],
    { blurb: 'Louvred energy centre.', roof: [['flue', 0.3, 0.5], ['flue', 0.45, 0.5], ['fan', 0.75, 0.5]] }),
  crossdock: S('Sheds & industry', 'Cross-dock', '↔️', { w: 320, d: 70, floors: 1, height: 30, cell: 12 },
    { cladding: 'precast', wall: '#d3d9df', band: '#204b73' },
    [r('NS', 'g', 1, -1, 'dock'), r('E', 'g', 0, null, 'door')], { blurb: 'Narrow terminal with bays down both sides.' }),
  mill: S('Sheds & industry', 'Sawtooth mill', '🪚', { w: 260, d: 160, floors: 1, height: 28, cell: 13 },
    { cladding: 'brick', roofType: 'saw', wall: '#9c5b47', band: '#5e3529' },
    [r('NSEW', 'g', ALL, null, 'window'), r('N', 'g', 1, 3, 'roll'), r('N', 'g', 'mid', null, 'door')],
    { blurb: 'Old brick factory under north lights.' }),
  hangar: S('Sheds & industry', 'Hangar', '🛩️', { w: 210, d: 150, floors: 1, height: 40, cell: 15 },
    { cladding: 'rib', roofType: 'barrel', wall: '#b9c2c9', band: '#3f4a57', parapet: false },
    [r('N', 'g', ALL, null, 'roll'), r('E', 'g', 1, null, 'firedoor')], { blurb: 'Arched shed with a full-width door.' }),
  highbay: S('Sheds & industry', 'High-bay store', '🗼', { w: 130, d: 110, floors: 1, height: 95, cell: 13 },
    { cladding: 'composite', wall: '#eef1f4', band: '#2f5f8a' },
    [r('N', 'g', 1, 4, 'dock'), r('E', 'g', 0, null, 'firedoor')], { blurb: 'Automated warehouse — very tall, almost blank.' }),
  datacentre: S('Sheds & industry', 'Data hall', '🖥️', { w: 190, d: 130, floors: 1, height: 36, cell: 12 },
    { cladding: 'composite', wall: '#8f97a1', band: '#2f5f8a' },
    [r('NSEW', 'g', 1, -1, 'louvre'), r('N', 'g', 0, null, 'door'), r('S', 'g', 1, 3, 'roll')],
    { blurb: 'Blank box banded with louvres.', roof: [['chiller', 0.2, 0.3], ['chiller', 0.45, 0.3], ['chiller', 0.7, 0.3], ['chiller', 0.2, 0.7], ['chiller', 0.45, 0.7], ['chiller', 0.7, 0.7]] }),
  factory: S('Sheds & industry', 'Factory', '🏭', { w: 220, d: 140, floors: 1, height: 32, cell: 12 },
    { cladding: 'precast', wall: '#cfd3d6', band: '#8a2b2b' },
    [r('NSEW', 'g', 1, -1, 'ribbon'), r('N', 'g', 2, 4, 'roll'), r('N', 'g', 'mid', null, 'door'), r('S', 'g', 2, 5, 'dock')],
    { blurb: 'Production hall with a chimney.', roof: [['chimney', 0.85, 0.3], ['flue', 0.3, 0.4], ['rtu-xl', 0.5, 0.6], ['fan', 0.2, 0.7]] }),
  garage: S('Sheds & industry', 'Repair garage', '🔩', { w: 96, d: 52, floors: 1, height: 20, cell: 16 },
    { cladding: 'render', wall: '#e8e4dc', band: '#d2691e' },
    [r('N', 'g', 0, -1, 'roll'), r('N', 'g', -1, null, 'door'), r('E', 'g', 1, -1, 'window')], { blurb: 'Vehicle workshop with service bays.' }),
  truckwash: S('Sheds & industry', 'Truck wash', '🚿', { w: 110, d: 34, floors: 1, height: 26, cell: 14 },
    { cladding: 'rib', wall: '#c9d6df', band: '#1c6fb4' },
    [r('EW', 'g', ALL, null, 'roll'), r('NS', 'g', ALL, null, 'ribbon')], { blurb: 'Drive-through wash bay.' }),
  recycling: S('Sheds & industry', 'Recycling shed', '♻️', { w: 180, d: 110, floors: 1, height: 34, cell: 15 },
    { cladding: 'rib', wall: '#8d9a8a', band: '#2f5d3a' },
    [r('N', 'g', ALL, null, 'open'), r('EW', 'g', 1, -1, 'louvre')], { blurb: 'Open-fronted bulk handling shed.' }),
  lab: S('Sheds & industry', 'Research lab', '🧪', { w: 140, d: 90, floors: 3, height: null, cell: 12 },
    { cladding: 'render', wall: '#f0f2f4', band: '#13867d' },
    [r('NSEW', ALL, ALL, null, 'ribbon'), r('N', 'g', 'mid', null, 'door')],
    { blurb: 'Three floors of labs with fume extracts.', roof: [['fan', 0.2, 0.3], ['fan', 0.35, 0.3], ['fan', 0.5, 0.3], ['flue', 0.7, 0.4], ['rtu-xl', 0.5, 0.7]] }),

  /* ---- offices & shops ---- */
  office: S('Offices & shops', 'Office block', '🏢', { w: 110, d: 90, floors: 3, height: null, cell: 11 },
    { cladding: 'precast', wall: '#d8dde3', band: '#1f3a63' },
    [r('NSEW', ALL, 1, -1, 'window'), r('N', 'g', 'mid', null, 'door')], { blurb: 'Two to six floors of offices.', roof: [['rtu', 0.3, 0.5], ['rtu', 0.6, 0.5]] }),
  officepark: S('Offices & shops', 'Business-park office', '🏙️', { w: 160, d: 100, floors: 3, height: null, cell: 10 },
    { cladding: 'composite', wall: '#bfc6cd', band: '#26364f' },
    [r('NS', ALL, ALL, null, 'glass'), r('EW', ALL, 1, -1, 'ribbon'), r('N', 'g', 'mid', null, 'door')],
    { blurb: 'Glazed front and back, banded ends.', roof: [['rtu-xl', 0.3, 0.5], ['rtu-xl', 0.65, 0.5], ['stair', 0.85, 0.3]] }),
  tower: S('Offices & shops', 'Tower', '🏙️', { w: 150, d: 110, floors: 12, height: null, cell: 11 },
    { cladding: 'composite', wall: '#7f8896', band: '#1d3557' },
    [r('NSEW', ALL, ALL, null, 'glass'), r('N', 'g', 'mid', null, 'door')],
    { blurb: 'Glass high-rise.', roof: [['lift', 0.5, 0.5], ['cooling', 0.25, 0.3], ['cooling', 0.75, 0.3], ['mast', 0.8, 0.8]] }),
  strip: S('Offices & shops', 'Retail strip', '🛒', { w: 300, d: 90, floors: 1, height: 20, cell: 15 },
    { cladding: 'render', wall: '#cdb7a4', band: '#5b3a2e' },
    [r('N', 'g', ALL, null, 'shopfront'), r('N', 'g', 'mid', null, 'door'), r('S', 'g', 1, -1, 'firedoor')],
    { blurb: 'Storefront row with a deep sign band.', roof: [['rtu', 0.2, 0.5], ['rtu', 0.4, 0.5], ['rtu', 0.6, 0.5], ['rtu', 0.8, 0.5]] }),
  pavilion: S('Offices & shops', 'Glass pavilion', '🪟', { w: 76, d: 54, floors: 1, height: 17, cell: 9 },
    { cladding: 'render', wall: '#e7eef3', band: '#4a5a68' },
    [r('NSEW', 'g', ALL, null, 'glass'), r('N', 'g', 'mid', null, 'door')], { blurb: 'Fully glazed showroom or reception.' }),
  bigbox: S('Offices & shops', 'Big-box store', '🏪', { w: 240, d: 180, floors: 1, height: 32, cell: 15 },
    { cladding: 'composite', wall: '#cdb7a4', band: '#7a3f34' },
    [r('N', 'g', 3, -3, 'shopfront'), r('N', 'g', 'mid', null, 'door'), r('S', 'g', 1, 4, 'dock')],
    { blurb: 'Single large unit with a service yard.', roof: [['rtu-xl', 0.3, 0.4], ['rtu-xl', 0.7, 0.4], ['rtu', 0.5, 0.7]] }),
  supermarket: S('Offices & shops', 'Supermarket', '🛍️', { w: 260, d: 190, floors: 1, height: 28, cell: 13 },
    { cladding: 'render', wall: '#ece3cf', band: '#1f7a54' },
    [r('N', 'g', 1, -1, 'shopfront'), r('N', 'g', 3, null, 'door'), r('N', 'g', -4, null, 'door'), r('S', 'g', 1, 3, 'dock'), r('E', 'g', 1, null, 'firedoor')],
    { blurb: 'Food hall with a glazed front and service docks.', roof: [['condensers', 0.3, 0.8], ['condensers', 0.6, 0.8], ['rtu-xl', 0.3, 0.4], ['rtu-xl', 0.7, 0.4]] }),
  showroom: S('Offices & shops', 'Car showroom', '🚘', { w: 120, d: 70, floors: 1, height: 24, cell: 10 },
    { cladding: 'composite', wall: '#3d434b', band: '#c0392b' },
    [r('N', 'g', ALL, null, 'glass'), r('E', 'g', ALL, null, 'glass'), r('W', 'g', 0, 3, 'glass'), r('N', 'g', 'mid', null, 'door'), r('S', 'g', 1, 3, 'roll')],
    { blurb: 'Glass corner showroom with workshop doors behind.' }),
  hotel: S('Offices & shops', 'Hotel', '🏨', { w: 150, d: 60, floors: 8, height: null, cell: 10 },
    { cladding: 'render', wall: '#ece3cf', band: '#7a5a2e' },
    [r('NS', ALL, ALL, null, 'window'), r('EW', ALL, 1, -1, 'window'), r('N', 'g', ALL, null, 'shopfront'), r('N', 'g', 'mid', null, 'door')],
    { blurb: 'Eight floors of rooms over a glazed lobby.', roof: [['lift', 0.5, 0.5], ['rtu', 0.25, 0.5], ['rtu', 0.75, 0.5]] }),
  mixeduse: S('Offices & shops', 'Shops with flats', '🏘️', { w: 120, d: 50, floors: 4, height: null, cell: 10 },
    { cladding: 'brick', wall: '#c4a27a', band: '#3d434b' },
    [r('N', 'g', ALL, null, 'shopfront'), r('N', 'g', 1, null, 'door'), r('N', 'u', ALL, null, ['window', 'balcony']), r('S', ALL, ALL, null, 'window'), r('EW', 'u', 1, -1, 'window')],
    { blurb: 'Ground-floor shops under three floors of flats.' }),
  medical: S('Offices & shops', 'Medical centre', '🏥', { w: 130, d: 80, floors: 3, height: null, cell: 10 },
    { cladding: 'render', wall: '#f0f2f4', band: '#1f7a54' },
    [r('NS', ALL, ALL, null, 'ribbon'), r('EW', ALL, 1, -1, 'window'), r('N', 'g', 'mid', null, 'door')],
    { blurb: 'Clinic with ribbon glazing.', roof: [['rtu', 0.3, 0.5], ['rtu', 0.7, 0.5], ['helipad', 0.5, 0.5]] }),
  sportshall: S('Offices & shops', 'Sports hall', '🏸', { w: 160, d: 110, floors: 1, height: 36, cell: 13 },
    { cladding: 'composite', roofType: 'barrel', wall: '#9fb0bf', band: '#26364f', parapet: false },
    [r('EW', 'g', ALL, null, 'ribbon'), r('N', 'g', 'mid', null, 'door'), r('S', 'g', 1, null, 'firedoor')], { blurb: 'Arched gym hall.' }),
  deck: S('Offices & shops', 'Car park deck', '🅿️', { w: 190, d: 122, floors: 4, height: null, cell: 12 },
    { cladding: 'render', wall: '#c6cbd1', band: '#5a636e' },
    [r('NSEW', ALL, ALL, null, 'open'), r('N', 'g', 0, null, 'door')], { blurb: 'Open-sided multi-storey parking.', roof: [['stair', 0.05, 0.1], ['lift', 0.95, 0.9]] }),
  terrace: S('Offices & shops', 'Terrace of units', '🏘️', { w: 230, d: 60, floors: 1, height: 18, cell: 12 },
    { cladding: 'brick', roofType: 'gable', wall: '#b07a5e', band: '#5e3529', roofColor: '#5d646d', parapet: false },
    [r('N', 'g', ALL, null, ['window', 'door', 'window']), r('S', 'g', 1, -1, 'window')], { blurb: 'A row of small units under one roof.' }),

  /* ---- civic ---- */
  firestation: S('Civic', 'Fire station', '🚒', { w: 120, d: 70, floors: 2, height: 32, cell: 15 },
    { cladding: 'brick', wall: '#9c5b47', band: '#c0392b' },
    [r('N', 'g', 0, 4, 'roll'), r('N', 'g', -2, null, 'door'), r('N', 'u', ALL, null, 'window'), r('EW', ALL, 1, -1, 'window'), r('S', 'g', 0, 4, 'roll')],
    { blurb: 'Appliance bays under a crew floor.', roof: [['mast', 0.85, 0.2], ['lift', 0.9, 0.7]] }),
  school: S('Civic', 'School', '🏫', { w: 220, d: 70, floors: 2, height: null, cell: 11 },
    { cladding: 'brick', wall: '#c4a27a', band: '#1f4f9c' },
    [r('NS', ALL, ALL, null, 'window'), r('N', 'g', 'mid', null, 'door'), r('EW', ALL, 1, -1, 'window'), r('E', 'g', 0, null, 'firedoor')],
    { blurb: 'Two floors of classrooms.', roof: [['solar', 0.3, 0.5], ['solar', 0.55, 0.5], ['rtu', 0.8, 0.5]] }),
  library: S('Civic', 'Library', '📚', { w: 100, d: 80, floors: 2, height: null, cell: 10 },
    { cladding: 'stone', wall: '#d9c9a3', band: '#3d434b' },
    [r('N', ALL, 1, -1, 'glass'), r('N', 'g', 'mid', null, 'door'), r('EW', ALL, 1, -1, 'window')], { blurb: 'Stone block with a glazed front.' }),
  chapel: S('Civic', 'Chapel', '⛪', { w: 50, d: 90, floors: 1, height: 22, cell: 10 },
    { cladding: 'stone', roofType: 'gable', wall: '#d2c4a6', band: '#6d6457', roofColor: '#4d535b', parapet: false },
    [r('EW', 'g', 1, -1, 'window'), r('N', 'g', 'mid', null, 'door')], { blurb: 'Steep-roofed stone chapel.' }),
  police: S('Civic', 'Police station', '🚓', { w: 110, d: 70, floors: 2, height: null, cell: 11 },
    { cladding: 'precast', wall: '#c6ccd2', band: '#16305c' },
    [r('NSEW', ALL, 1, -1, 'window'), r('N', 'g', 'mid', null, 'door'), r('E', 'g', 0, 2, 'roll')], { blurb: 'Two-storey station with a vehicle bay.', roof: [['mast', 0.8, 0.3], ['rtu', 0.4, 0.5]] }),

  /* ---- homes ---- */
  apartments: S('Homes', 'Apartment block', '🏢', { w: 120, d: 55, floors: 5, height: null, cell: 10 },
    { cladding: 'render', wall: '#ece3cf', band: '#7a5a2e' },
    [r('NS', ALL, ALL, null, ['window', 'balcony']), r('EW', ALL, 1, -1, 'window'), r('N', 'g', 'mid', null, 'door')],
    { blurb: 'Five floors of flats with balconies.', roof: [['lift', 0.5, 0.5], ['solar', 0.25, 0.5]] }),
  townhouses: S('Homes', 'Townhouses', '🏘️', { w: 100, d: 36, floors: 3, height: null, cell: 10 },
    { cladding: 'brick', roofType: 'gable', wall: '#9c5b47', band: '#3d434b', roofColor: '#4d535b', parapet: false },
    [r('N', 'g', ALL, null, ['door', 'window']), r('N', 'u', ALL, null, 'window'), r('S', ALL, ALL, null, 'window')], { blurb: 'A row of three-storey houses.' }),
  house: S('Homes', 'Detached house', '🏡', { w: 46, d: 36, floors: 2, height: null, cell: 9 },
    { cladding: 'render', roofType: 'hip', wall: '#f0ece2', band: '#5d646d', roofColor: '#5a3e36', parapet: false },
    [r('N', 'g', 0, null, 'garage'), r('N', 'g', 2, null, 'door'), r('N', 'g', 3, null, 'window'), r('N', 'u', ALL, null, 'window'), r('S', ALL, ALL, null, 'window'), r('EW', ALL, 1, -1, 'window')],
    { blurb: 'Two-storey house with a garage.' }),

  /* ---- small buildings ---- */
  small: S('Small buildings', 'Small office', '🏬', { w: 70, d: 50, floors: 2, height: null, cell: 11 },
    { cladding: 'precast', wall: '#d8dde3', band: '#1f3a63' },
    [r('NSEW', ALL, 1, -1, 'window'), r('N', 'g', 'mid', null, 'door')], { blurb: 'A little two or three storey block.' }),
  gatehouse: S('Small buildings', 'Gatehouse HQ', '🛂', { w: 60, d: 36, floors: 2, height: null, cell: 10 },
    { cladding: 'composite', wall: '#3d434b', band: '#c9922b' },
    [r('N', ALL, ALL, null, 'glass'), r('EW', ALL, 1, -1, 'window'), r('N', 'g', 'mid', null, 'door')], { blurb: 'Security HQ with a glazed control room.' }),
  pitched: S('Small buildings', 'Pitched unit', '🏘️', { w: 84, d: 52, floors: 1, height: 16, cell: 10 },
    { cladding: 'brick', roofType: 'gable', wall: '#9c5b47', band: '#6d4034', roofColor: '#5d646d', parapet: false },
    [r('N', 'g', ALL, null, 'window'), r('N', 'g', 'mid', null, 'door'), r('S', 'g', 1, -1, 'window'), r('EW', 'g', 1, -1, 'window')], { blurb: 'Brick unit under a pitched roof.' }),
  annex: S('Small buildings', 'Link annex', '➖', { w: 96, d: 28, floors: 2, height: null, cell: 12 },
    { cladding: 'precast', wall: '#d8dde3', band: '#1f3a63' },
    [r('NS', ALL, ALL, null, 'ribbon'), r('N', 'g', 0, null, 'door')], { blurb: 'Narrow block for joining two buildings.' }),
  lodge: S('Small buildings', 'Lodge', '🏡', { w: 62, d: 46, floors: 2, height: null, cell: 10 },
    { cladding: 'brick', roofType: 'gable', wall: '#9c5b47', band: '#6d4034', roofColor: '#5d646d', parapet: false },
    [r('NS', ALL, ALL, null, 'window'), r('EW', ALL, 1, -1, 'window'), r('N', 'g', 'mid', null, 'door')], { blurb: 'Two storeys of brick under a pitched roof.' }),
  kiosk: S('Small buildings', 'Kiosk', '🥤', { w: 28, d: 22, floors: 1, height: 12, cell: 7 },
    { cladding: 'render', wall: '#e7eef3', band: '#1f7a54' },
    [r('NSEW', 'g', ALL, null, 'glass'), r('N', 'g', 'mid', null, 'door')], { blurb: 'Tiny glazed counter or coffee stop.' }),
  stationshop: S('Small buildings', 'Service-station shop', '⛽', { w: 64, d: 40, floors: 1, height: 15, cell: 8 },
    { cladding: 'composite', wall: '#f0f2f4', band: '#c0392b' },
    [r('N', 'g', ALL, null, 'shopfront'), r('N', 'g', 'mid', null, 'door'), r('S', 'g', 1, null, 'firedoor')], { blurb: 'Forecourt shop.', roof: [['condensers', 0.5, 0.75]] }),
  toilets: S('Small buildings', 'Toilet block', '🚻', { w: 40, d: 24, floors: 1, height: 12, cell: 8 },
    { cladding: 'brick', wall: '#9c5b47', band: '#1f4f9c' },
    [r('N', 'g', 1, null, 'door'), r('N', 'g', -2, null, 'door'), r('NSEW', 'g', ALL, null, 'vent'), r('N', 'g', 1, null, 'door'), r('N', 'g', -2, null, 'door')],
    { blurb: 'Public washrooms. Toilet Plus would approve.', roof: [['mushroom', 0.3, 0.5], ['mushroom', 0.7, 0.5]] }),
  greenhouse: S('Small buildings', 'Greenhouse', '🌱', { w: 70, d: 34, floors: 1, height: 10, cell: 7 },
    { cladding: 'render', roofType: 'gable', roofGlass: true, wall: '#e7eef3', band: '#9aa3ad', parapet: false },
    [r('NSEW', 'g', ALL, null, 'glass'), r('E', 'g', 'mid', null, 'door')], { blurb: 'Glass from the ground to the ridge.' }),
  barn: S('Small buildings', 'Barn', '🚜', { w: 120, d: 74, floors: 1, height: 20, cell: 12 },
    { cladding: 'timber', roofType: 'gable', wall: '#8d4a3c', band: '#4a3a30', roofColor: '#5f666f', parapet: false },
    [r('N', 'g', ALL, null, 'window'), r('N', 'g', 'mid', null, 'roll'), r('S', 'g', 'mid', null, 'roll')], { blurb: 'Big doors, big roof, timber walls.' }),
  substation: S('Small buildings', 'Substation', '🔌', { w: 44, d: 32, floors: 1, height: 18, cell: 8 },
    { cladding: 'brick', wall: '#9c5b47', band: '#6d4034' },
    [r('NSEW', 'g', 1, -1, 'louvre'), r('N', 'g', 0, null, 'firedoor')], { blurb: 'Louvred brick house for switchgear.' }),
};

/* -------------------------------------------------------- ids and grids */

let seq = 1;
export const newId = (prefix = 'o') => `${prefix}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
export function seedIds(objects) {
  seq = Math.max(seq, objects.length + 2);
}

function grid(cols, floors, fill = 'blank') {
  return Array.from({ length: floors }, () => Array.from({ length: cols }, () => fill));
}

export function wallCols(building, face) {
  return (building.walls[face] && building.walls[face][0] ? building.walls[face][0].length : 1);
}

export const buildingHeight = (b) => (b.height != null ? b.height : b.floors * FLOOR_HEIGHT);

/** Paint a recipe onto a building's wall grids. */
function applyRecipe(b, recipe) {
  const floors = b.floors;
  for (const rule of recipe || []) {
    for (const face of rule.faces) {
      const g = b.walls[face];
      if (!g) continue;
      const cols = g[0].length;
      const rows = rule.rows === ALL ? [...Array(floors).keys()]
        : rule.rows === 'g' ? [0]
          : rule.rows === 'u' ? [...Array(floors).keys()].slice(1)
            : [Math.min(floors - 1, +rule.rows)];
      const mid = Math.floor((cols - 1) / 2);
      const at = (v, end) => {
        if (v === ALL) return end ? cols : 0;
        if (v === 'mid') return end ? mid + 1 : mid;
        if (v === null || v === undefined) return null;
        if (Object.is(v, -0)) return cols;
        return v < 0 ? cols + v : v;
      };
      const a = rule.a === ALL ? 0 : at(rule.a, false);
      let z = rule.a === ALL ? cols : at(rule.b, true);
      if (z === null) z = a + 1;
      for (const row of rows) {
        for (let c = Math.max(0, a); c < Math.min(cols, z); c++) {
          const cell = Array.isArray(rule.cell) ? rule.cell[(c - a) % rule.cell.length] : rule.cell;
          // Doors, docks and shopfronts belong on the ground floor only.
          const spec = CELLS.find((k) => k.id === cell);
          if (row > 0 && spec && !spec.upper) continue;
          g[row][c] = cell;
        }
      }
    }
  }
}

/** A building with its walls filled in the way that model usually is. */
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
    height: p.height,
    wall: p.wall || '#d8dde3',
    band: p.band || '#1f3a63',
    roofColor: p.roofColor || null,
    roofGlass: !!p.roofGlass,
    parapet: p.parapet !== false,
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
  b.walls = { N: grid(cw, b.floors), S: grid(cw, b.floors), E: grid(cd, b.floors), W: grid(cd, b.floors) };
  applyRecipe(b, p.recipe);
  if (p.roof && !over.roofItems) {
    b.roofItems = p.roof.map(([type, fx, fy, rot = 0]) => ({ type, dx: fx * b.w, dy: fy * b.d, rot }));
  }
  return b;
}

/** The footprint an object occupies on the ground. */
export function footprint(o) {
  if (o.kind === 'building') return { x: o.x, y: o.y, w: o.w, d: o.d, rot: o.rot || 0 };
  if (o.kind === 'run') {
    // The ground a duct or pipe run passes over: the box round its points.
    const pts = o.points && o.points.length ? o.points : [{ x: 0, y: 0 }];
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const pad = (o.size || 2) / 2 + 1;
    const x0 = Math.min(...xs) - pad;
    const y0 = Math.min(...ys) - pad;
    return { x: x0, y: y0, w: Math.max(...xs) + pad - x0, d: Math.max(...ys) + pad - y0, rot: 0 };
  }
  const spec = o.kind === 'booth' ? BOOTH_BY_ID[o.design] : o.kind === 'plant' ? ROOF_BY_ID[o.type] : PROP_BY_ID[o.type];
  return {
    x: o.x, y: o.y, rot: o.rot || 0,
    w: o.w != null ? o.w : (spec ? spec.w : 8),
    d: o.d != null ? o.d : (spec ? spec.d : 8),
  };
}

export function objHeight(o) {
  if (o.kind === 'building') return buildingHeight(o);
  if (o.kind === 'run') return Math.max(1, ...(o.points || []).map((p) => p.z || 0));
  const spec = o.kind === 'booth' ? BOOTH_BY_ID[o.design] : o.kind === 'plant' ? ROOF_BY_ID[o.type] : PROP_BY_ID[o.type];
  return o.h != null ? o.h : (spec ? spec.h : 8);
}

/** Nothing solid may stand inside a building. */
export function pruneInsideBuildings(objects) {
  const walls = objects.filter((o) => o.kind === 'building').map(footprint);
  return objects.filter((o) => {
    if (o.kind === 'building' || o.kind === 'run') return true;
    const spec = o.kind === 'booth' || o.kind === 'plant' ? { solid: true } : PROP_BY_ID[o.type];
    if (!spec || !spec.solid) return true;
    return !walls.some((w) => overlaps(footprint(o), w, -0.5));
  });
}

/* ------------------------------------------------------------ fresh sites */

export const SITE_PRESETS = {
  warehouse: { name: 'Distribution site', icon: '🏭', lot: { width: 620, depth: 440 }, blurb: 'A shed with loading bays, an office end and a truck court.' },
  logistics: { name: 'Logistics hub', icon: '🚛', lot: { width: 920, depth: 640 }, blurb: 'A mega shed with docks on both sides and a yard full of trailers.' },
  business: { name: 'Business park', icon: '🏙️', lot: { width: 760, depth: 560 }, blurb: 'Glass offices, a parking deck and a lake.' },
  campus: { name: 'Office tower', icon: '🏢', lot: { width: 560, depth: 440 }, blurb: 'A tower on a podium with a car park.' },
  station: { name: 'Service station', icon: '⛽', lot: { width: 440, depth: 340 }, blurb: 'Forecourt, canopy, pumps, chargers and a shop.' },
  town: { name: 'Town block', icon: '🏘️', lot: { width: 720, depth: 520 }, blurb: 'Flats, shops, a school and houses.' },
  storage: { name: 'Storage yard', icon: '🔒', lot: { width: 600, depth: 460 }, blurb: 'Rows of units behind a gate.' },
  retail: { name: 'Retail strip', icon: '🛒', lot: { width: 560, depth: 400 }, blurb: 'A storefront row facing a big lot.' },
  empty: { name: 'Empty lot', icon: '⬜', lot: { width: 560, depth: 420 }, blurb: 'Bare ground. Build it all yourself.' },
};

const prop = (type, x, y, rot = 0, extra = {}) => ({ id: newId('p'), kind: 'prop', type, x, y, rot, ...extra });
const sign = (text, sub = '', color = '#1f4f9c', logo = '🚽') => ({ on: true, face: 'N', text, sub, color, logo });

/** The things every site gets at its entrance and along its street edge. */
function dress(objects, lot, driveX, opts = {}) {
  const gateY = lot.depth - 70;
  if (opts.gate !== false) {
    objects.push({ id: newId('g'), kind: 'booth', design: opts.booth || 'classic', x: driveX - 58, y: gateY - 10, rot: 0,
      sign: { text: opts.boothText || 'SECURITY', color: '#ffffff', logo: '🛡️' } });
    objects.push(prop('gate', driveX - 26, gateY - 2));
    for (let i = 0; i < 6; i++) {
      objects.push(prop('bollard', driveX + (i % 2 ? 30 : -30) + (i % 2 ? 1 : -1) * Math.floor(i / 2) * 7, gateY + 16));
    }
    objects.push(prop('guard', driveX - 16, gateY + 4));
  }
  objects.push(prop('monument', driveX + 30, gateY + 8, 90, {
    sign: { text: opts.monument || 'ALL VISITORS MUST CHECK IN AT SECURITY', color: '#ffffff', logo: opts.logo || '🛡️' },
  }));
  // Fence along the street, open where the drive crosses it.
  if (opts.fence !== false) {
    for (let x = 10; x < lot.width - 20; x += 62) {
      const w = Math.min(60, lot.width - 10 - x);
      if (x + w > driveX - 30 && x < driveX + 30) continue;
      objects.push({ id: newId('f'), kind: 'prop', type: opts.fenceType || 'fence', x, y: lot.depth - 3, w, d: 1, rot: 0 });
    }
  }
  // Street trees and lamps along the footway.
  for (let x = 24; x < lot.width - 20; x += 58) {
    if (Math.abs(x - driveX) < 42) continue;
    objects.push(prop(opts.streetTree || 'tree', x - 9, lot.depth - 26));
  }
  for (let x = 60; x < lot.width; x += 140) {
    if (Math.abs(x - driveX) < 30) continue;
    objects.push(prop('streetlamp', x, lot.depth + 5, 180));
  }
  // A belt of planting down the sides and along the back.
  if (opts.belt !== false) {
    for (let y = 30; y < lot.depth - 60; y += 46) {
      objects.push(prop(y % 92 ? 'conifer' : 'birch', 2, y));
      objects.push(prop(y % 92 ? 'birch' : 'conifer', lot.width - 14, y));
    }
  }
}

function lightTheYard(objects, lot, xs, y) {
  for (const x of xs) objects.push(prop('pole', x - 1.5, y));
}

export function freshState(preset = 'warehouse') {
  const p = SITE_PRESETS[preset] || SITE_PRESETS.warehouse;
  const lot = { ...p.lot };
  const objects = [];
  const cx = lot.width / 2;

  if (preset === 'warehouse') {
    const shed = makeBuilding('shed', { x: cx - 190, y: 46, w: 380, d: 150 });
    shed.sign.on = false;
    shed.roofItems = [['skylight', 0.35, 0.3], ['skylight', 0.55, 0.3], ['skylight', 0.75, 0.3], ['skylight', 0.35, 0.7], ['skylight', 0.55, 0.7], ['skylight', 0.75, 0.7], ['rtu', 0.9, 0.5]]
      .map(([type, fx, fy]) => ({ type, dx: fx * 380, dy: fy * 150, rot: 0 }));
    const office = makeBuilding('office', { x: cx - 190, y: 46, w: 110, d: 164, floors: 3, sign: sign('TOILET PLUS SOLUTIONS', 'SOLUTIONS THAT WORK FOR YOU') });
    objects.push(shed, office);
    const cols = shed.walls.N[0].length;
    const cw = shed.w / cols;
    // Blank wall across the top floor where the name goes, as on the real thing.
    const oc = office.walls.N[0].length;
    for (let c = 2; c < oc - 2; c++) office.walls.N[2][c] = 'blank';
    // The office end is built across the front of the shed: no bays behind it.
    const hidden = Math.ceil((office.w + 6) / cw);
    for (let c = 0; c < hidden; c++) shed.walls.N[0][c] = 'blank';
    for (let c = hidden; c < hidden + 2; c++) if (shed.walls.N[0][c] === 'dock') shed.walls.N[0][c] = 'blank';
    for (const col of [12, 14, 15, 18, 21, 22, 25, 27]) {
      if (shed.walls.N[0][col] !== 'dock') continue;
      objects.push({ id: newId('v'), kind: 'prop', type: col % 3 ? 'trailer' : 'reefer', rot: 180, x: shed.x + (col + 0.5) * cw - 4.25, y: shed.y + shed.d + 1.5 });
    }
    for (let i = 0; i < 4; i++) objects.push({ id: newId('v'), kind: 'prop', type: 'trailer', rot: 180, x: shed.x + 140 + i * 15, y: shed.y + shed.d + 82 });
    objects.push({ id: newId('v'), kind: 'prop', type: 'tractor', rot: 0, color: '#2c4a7c', x: shed.x + shed.w - 70, y: shed.y + shed.d + 96 });
    objects.push(prop('forklift', shed.x + shed.w - 40, shed.y + shed.d + 30, 35));
    objects.push(prop('worker', shed.x + shed.w - 52, shed.y + shed.d + 22));
    objects.push(prop('dumpster', shed.x + shed.w + 12, shed.y + 20));
    objects.push(prop('dumpster', shed.x + shed.w + 12, shed.y + 32));
    objects.push(prop('flags3', cx - 160, lot.depth - 118));
    dress(objects, lot, cx - 150);
    lightTheYard(objects, lot, [lot.width * 0.3, lot.width * 0.55, lot.width * 0.8], lot.depth - 150);
  } else if (preset === 'logistics') {
    const shed = makeBuilding('megashed', { x: 180, y: 130, sign: sign('TOILET PLUS LOGISTICS', 'NATIONAL DISTRIBUTION CENTRE', '#164a7a', '🚚') });
    objects.push(shed);
    const gh = makeBuilding('gatehouse', { x: 60, y: 470, sign: sign('GATEHOUSE', '', '#ffffff', '🛂') });
    objects.push(gh);
    const cols = shed.walls.N[0].length;
    const cw = shed.w / cols;
    for (let col = 3; col < cols - 3; col += 2) {
      if (col % 6 === 1) continue;
      objects.push({ id: newId('v'), kind: 'prop', type: col % 4 ? 'trailer' : 'reefer', rot: 180, x: shed.x + (col + 0.5) * cw - 4.25, y: shed.y + shed.d + 1.5 });
    }
    // The back docks face north, so their trailers point the other way.
    for (let col = 4; col < cols - 4; col += 3) {
      const t = (col + 0.5) * cw;
      objects.push({ id: newId('v'), kind: 'prop', type: 'trailer', rot: 0, x: shed.x + shed.w - t - 4.25, y: shed.y - 49.5 });
    }
    for (let i = 0; i < 6; i++) objects.push({ id: newId('v'), kind: 'prop', type: i % 2 ? 'tanker' : 'flatbed', rot: 90, x: 30 + i * 0, y: 160 + i * 14 });
    for (let i = 0; i < 3; i++) objects.push({ id: newId('v'), kind: 'prop', type: 'tractor', rot: 0, color: ['#c0392b', '#2c4a7c', '#f1f2f4'][i], x: 520 + i * 30, y: 455 });
    objects.push(prop('turbine', lot.width - 60, 40));
    objects.push(prop('watertower', 70, 40));
    objects.push(prop('truckwash' === 'x' ? 'x' : 'compactor', shed.x + shed.w + 14, 300));
    dress(objects, lot, 200, { booth: 'twin', monument: 'GOODS IN — ALL DRIVERS REPORT TO GATEHOUSE', logo: '🚚', fenceType: 'palisade' });
    lightTheYard(objects, lot, [260, 420, 580, 740], 470);
    objects.push(prop('floodmast', 140, 60), prop('floodmast', lot.width - 120, 60));
  } else if (preset === 'business') {
    const a = makeBuilding('officepark', { x: 80, y: 60, sign: sign('TOILET PLUS SOLUTIONS', 'HEAD OFFICE', '#1f4f9c') });
    const b2 = makeBuilding('officepark', { x: 300, y: 60, w: 140, cladding: 'composite', wall: '#8d97a3', sign: sign('NORTHGATE HOUSE', '', '#ffffff', '◆') });
    const c = makeBuilding('small', { x: 500, y: 70, floors: 3, sign: sign('STUDIO 3', '', '#1f7a54', '★') });
    const deck = makeBuilding('deck', { x: 520, y: 210, w: 170, d: 110, floors: 3 });
    objects.push(a, b2, c, deck);
    objects.push(prop('pond', 120, 230, 0, { w: 120, d: 60 }));
    objects.push(prop('fountain', 172, 252));
    for (let i = 0; i < 7; i++) objects.push(prop(i % 2 ? 'birch' : 'maple', 80 + i * 26, 310 + (i % 2) * 8));
    for (let i = 0; i < 4; i++) objects.push(prop('bench', 110 + i * 30, 300));
    objects.push(prop('flags3', 300, 200));
    objects.push(prop('bikerack', 250, 185), prop('busshelter', 430, lot.depth - 20, 180));
    for (let i = 0; i < 6; i++) objects.push(prop('evcharger', 460 + i * 9, 200, 180));
    dress(objects, lot, 380, { booth: 'cube', monument: 'NORTHGATE BUSINESS PARK', logo: '◆', fence: false, streetTree: 'maple' });
    lightTheYard(objects, lot, [120, 260, 640], lot.depth - 130);
  } else if (preset === 'campus') {
    const tower = makeBuilding('tower', { x: cx - 75, y: 60, w: 150, d: 110, floors: 12, wall: '#7f8896', sign: sign('TOILET PLUS SOLUTIONS', '') });
    const podium = makeBuilding('small', { x: cx - 97, y: 144, w: 194, d: 52, floors: 1, height: 15, wall: '#8b93a0' });
    podium.sign.on = false;
    podium.walls.N[0] = podium.walls.N[0].map(() => 'glass');
    objects.push(tower, podium);
    objects.push(prop('flags3', cx - 8, 230));
    dress(objects, lot, cx - 150, { booth: 'cube' });
    lightTheYard(objects, lot, [lot.width * 0.3, lot.width * 0.55, lot.width * 0.8], lot.depth - 150);
  } else if (preset === 'station') {
    const shop = makeBuilding('stationshop', { x: 300, y: 50, sign: sign('TOILET PLUS EXPRESS', '24 HOURS', '#c0392b', '⛽') });
    const wash = makeBuilding('truckwash', { x: 60, y: 46, w: 90, d: 30, sign: sign('CAR WASH', '', '#1c6fb4', '💧') });
    objects.push(shop, wash);
    objects.push(prop('fuelcanopy', 150, 150, 0));
    for (let i = 0; i < 3; i++) objects.push(prop('fuelisland', 166 + i * 20, 168, 90));
    for (let i = 0; i < 4; i++) objects.push(prop('evcharger', 70 + i * 10, 120, 0));
    objects.push(prop('pylon', 30, lot.depth - 60, 0, { sign: { text: 'UNLEADED 1.49 DIESEL 1.55', color: '#ffffff', logo: '⛽' } }));
    objects.push(prop('car', 175, 180, 90, { color: '#c0392b' }), prop('suv', 195, 196, 90, { color: '#1d2735' }), prop('hatch', 215, 180, 90, { color: '#f1f2f4' }));
    objects.push(prop('vending', 290, 92), prop('trashcan', 296, 98), prop('recycling', 380, 50));
    objects.push(prop('airpump' === 'x' ? 'x' : 'mailbox', 280, 100));
    dress(objects, lot, 320, { gate: false, fence: false, monument: 'WELCOME', belt: false });
    objects.push(prop('streetlamp', 100, lot.depth - 40), prop('streetlamp', 260, lot.depth - 40));
  } else if (preset === 'town') {
    objects.push(makeBuilding('apartments', { x: 40, y: 40, sign: sign('ELM COURT', '', '#3d434b', '★') }));
    objects.push(makeBuilding('mixeduse', { x: 190, y: 50, sign: sign('CORNER STORES', '', '#ffffff', '🛒') }));
    objects.push(makeBuilding('school', { x: 360, y: 40, sign: sign('NORTH STREET SCHOOL', '', '#1f4f9c', '★') }));
    objects.push(makeBuilding('townhouses', { x: 40, y: 190 }));
    objects.push(makeBuilding('townhouses', { x: 40, y: 260 }));
    objects.push(makeBuilding('house', { x: 200, y: 200 }), makeBuilding('house', { x: 270, y: 200 }));
    objects.push(makeBuilding('library', { x: 400, y: 180, sign: sign('LIBRARY', '', '#3d434b', '📚') }));
    objects.push(makeBuilding('chapel', { x: 600, y: 60 }));
    for (let i = 0; i < 10; i++) objects.push(prop(['oak', 'maple', 'birch'][i % 3], 520 + (i % 4) * 34, 210 + Math.floor(i / 4) * 40));
    objects.push(prop('busshelter', 300, lot.depth - 20, 180), prop('mailbox', 170, lot.depth - 30), prop('hydrant', 330, lot.depth - 28));
    objects.push(prop('bench', 560, 330), prop('bench', 600, 330), prop('fountain', 580, 300), prop('playground' === 'x' ? 'x' : 'picnic', 540, 350));
    dress(objects, lot, 250, { gate: false, fence: false, monument: 'NORTH STREET', logo: '★', streetTree: 'maple', belt: false });
  } else if (preset === 'storage') {
    for (let i = 0; i < 3; i++) objects.push(makeBuilding('row', { x: cx - 150, y: 50 + i * 84, w: 300, d: 40 }));
    objects.push(makeBuilding('small', { x: cx - 230, y: 218, w: 60, d: 40, floors: 1, height: 13, sign: sign('TOILET PLUS STORAGE', '', '#c25b1d', '🔒') }));
    objects.push(prop('van', cx + 170, 150, 90, { color: '#f1f2f4' }), prop('cctv', cx + 160, 40), prop('cctv', cx - 165, 300));
    dress(objects, lot, cx - 150, { fenceType: 'palisade' });
    lightTheYard(objects, lot, [lot.width * 0.3, lot.width * 0.55, lot.width * 0.8], lot.depth - 150);
  } else if (preset === 'retail') {
    objects.push(makeBuilding('strip', { x: cx - 150, y: 60, sign: sign('TOILET PLUS SOLUTIONS', 'SOLUTIONS THAT WORK FOR YOU') }));
    objects.push(prop('trolleybay' === 'x' ? 'x' : 'bikerack', cx - 40, 170), prop('recycling', cx + 170, 70));
    dress(objects, lot, cx - 150, { booth: 'kiosk', fence: false });
    lightTheYard(objects, lot, [lot.width * 0.3, lot.width * 0.55, lot.width * 0.8], lot.depth - 150);
  }

  return {
    v: 4,
    preset,
    lot,
    view: {},
    env: { hour: 15.5, weather: 'clear', season: 'summer', cycle: false, traffic: true, people: true },
    skin: { wall: '#d8dde3', band: '#1f3a63' },
    site: { pavement: true, parking: true, cars: true, road: true, grass: true, markings: true },
    objects: pruneInsideBuildings(objects.filter((o) => o.type !== 'x')),
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
    view: { ...(state.view || {}) },
    env: { ...base.env, ...(state.env || {}) },
    skin: { ...base.skin, ...state.skin },
    site: { ...base.site, ...state.site },
    objects: state.objects.filter(Boolean).map((o) => ({ ...o })),
  };
  // Day/night used to be a switch; it is a clock now.
  if (!state.env && state.view && state.view.time === 'night') out.env.hour = 22;
  const migrateWalls = (state.v || 0) < 4;
  for (const o of out.objects) {
    o.rot = Number(o.rot) || 0;
    if (o.kind === 'building') {
      const style = BUILDING_STYLES[o.style] || {};
      o.walls = o.walls || {};
      o.roofItems = Array.isArray(o.roofItems) ? o.roofItems : [];
      o.sign = { on: true, face: 'N', text: '', sub: '', color: '#1f4f9c', logo: '', ...(o.sign || {}) };
      o.cladding = o.cladding === 'plain' ? 'render' : (o.cladding || style.cladding || 'precast');
      o.roofType = o.roofType || style.roofType || 'flat';
      if (o.roofGlass == null) o.roofGlass = !!style.roofGlass;
      for (const f of ['N', 'E', 'S', 'W']) {
        if (!Array.isArray(o.walls[f]) || !o.walls[f].length) o.walls[f] = grid(4, o.floors || 1);
        // Walls used to be counted from the other end; keep every door where it was.
        if (migrateWalls) o.walls[f] = o.walls[f].map((row) => [...row].reverse());
      }
    }
  }
  out.v = 4;
  out.objects = pruneInsideBuildings(out.objects);
  seedIds(out.objects);
  return out;
}
