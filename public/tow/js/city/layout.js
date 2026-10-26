// Skyville's plan: the street grid, the elevated I-671 ring with its eight
// diamond interchanges, the outer parkway, named places, the eight mechanic
// shops, and the road graph the GPS and traffic drive on.
//
// Map orientation: north is -z, east is +x. Everything here is plain data
// and math so the builder, the minimap and the router all agree.

export const GRID = [-480, -360, -240, -120, 0, 120, 240, 360, 480];
export const ARTERIAL = new Set([-240, 0, 240]);
export const HW = { arterial: 8, local: 6 };        // pavement half widths
export const SIDEWALK = 4;
export const CURB = 0.15;

// North-south streets (constant x), west → east.
export const NS_NAMES = ['West End Ave', 'Linden St', 'Market St', 'Chestnut St', 'Broad St', 'Walnut St', 'Harbor Blvd', 'Spruce St', 'East End Ave'];
// East-west streets (constant z), north → south.
export const EW_NAMES = ['North Ave', 'Franklin St', 'Liberty Ave', 'Union St', 'Main St', 'Washington St', 'Bayview Blvd', 'Pine St', 'South Ave'];

export const halfWidthAt = (coord) => (ARTERIAL.has(coord) ? HW.arterial : HW.local);

// ----------------------------------------------------------- the I-671 ring
export const RING = { half: 600, radius: 150, deckY: 8, deckThick: 1.1 };
// Lateral offsets from the ring centerline (+ = toward downtown).
export const DECK = {
  median: 0.45,
  innerLanes: [1.6, 5.3, 9.0],   // inner loop lane edges (2 lanes)
  outerLanes: [-1.6, -5.3, -9.0],
  edge: 12.0,                   // shoulder edge; parapet beyond
  parapet: 12.45,
};
const STRAIGHT = RING.half - RING.radius;           // 450
const SEG = STRAIGHT * 2;                           // 900
const ARC = (Math.PI / 2) * RING.radius;            // 235.6
export const RING_LEN = 4 * (SEG + ARC);

// Point on the ring at arc length s (clockwise from the NW end of the north
// side), pushed `off` meters toward the city. Returns {x, z, tx, tz, nx, nz}
// where t is the clockwise tangent and n the inward normal.
export function ringPoint(s, off = 0) {
  s = ((s % RING_LEN) + RING_LEN) % RING_LEN;
  const side = Math.floor(s / (SEG + ARC));
  const r = s - side * (SEG + ARC);
  let x, z, tx, tz;
  if (r < SEG) {
    // North side in canonical frame: from (-450,-600) heading +x.
    x = -STRAIGHT + r; z = -RING.half; tx = 1; tz = 0;
  } else {
    const a = (r - SEG) / RING.radius; // 0..pi/2
    const cx = STRAIGHT, cz = -STRAIGHT;
    // Corner from pointing north (-z) round to pointing east (+x).
    x = cx + Math.sin(a) * RING.radius;
    z = cz - Math.cos(a) * RING.radius;
    tx = Math.cos(a); tz = Math.sin(a);
  }
  // Inward normal for clockwise travel is the tangent rotated to the right.
  let nx = -tz, nz = tx;
  // Rotate the canonical north-side frame to the actual side.
  for (let k = 0; k < side; k++) {
    [x, z] = [-z, x];
    [tx, tz] = [-tz, tx];
    [nx, nz] = [-nz, nx];
  }
  return { x: x + nx * off, z: z + nz * off, tx, tz, nx, nz };
}

// Arc length of the point on a straight side closest to (x,z) — used to place
// interchanges. side: 0 N, 1 E, 2 S, 3 W; u: coordinate along the side in the
// canonical frame (-450..450).
export const sideS = (side, u) => side * (SEG + ARC) + (u + STRAIGHT);

// Canonical frame helpers (north side → actual side).
export function rotK(x, z, k) {
  for (let i = 0; i < k; i++) [x, z] = [-z, x];
  return [x, z];
}

// ---------------------------------------------------------- interchanges
// Exit numbers run clockwise starting at the north side.
export const INTERCHANGES = [
  { exit: 1, side: 0, u: -240, street: 'Market St', dest: 'Downtown · Westside' },
  { exit: 2, side: 0, u: 240, street: 'Harbor Blvd', dest: 'Harbor District' },
  { exit: 3, side: 1, u: -240, street: 'Liberty Ave', dest: 'Midtown · Liberty Sq' },
  { exit: 4, side: 1, u: 240, street: 'Bayview Blvd', dest: 'Bayview · Hospital' },
  { exit: 5, side: 2, u: -240, street: 'Harbor Blvd', dest: 'Southside · Port' },
  { exit: 6, side: 2, u: 240, street: 'Market St', dest: 'Market District' },
  { exit: 7, side: 3, u: -240, street: 'Bayview Blvd', dest: 'Westgate' },
  { exit: 8, side: 3, u: 240, street: 'Liberty Ave', dest: 'North End · Stadium' },
];
// Note: u is along the clockwise direction of each side; on the south side
// clockwise runs west, so u=-240 there is x=+240 (Harbor Blvd). Checked by
// interchangeWorld().
export function interchangeWorld(ic) {
  const [x, z] = rotK(ic.u, -RING.half, ic.side);
  return { x, z };
}

export const RAMP = {
  len: 200,          // diverge/merge distance from the arterial
  flat: 55,          // distance at deck height before descending
  groundAt: 42,      // distance from arterial where it reaches the ground
  endGap: 10.5,      // where it meets the arterial curb (half arterial + 2.5)
  offStart: DECK.edge + 2.9,
  offEnd: 27,        // lateral offset at the ground end
  width: 6.2,
};

// Ramp centerline in the canonical north frame. dir: +1 for inner-loop
// ramps (inner side, traffic heading +u), -1 for outer-loop ramps.
// kind: 'off' or 'on'. Returns an array of [u, y, off] points in travel order.
export function rampCanonical(u0, dir, kind) {
  const pts = [];
  const N = 48;
  const lat = (t) => {
    // t: 0 at the deck end, 1 at the ground end.
    const k = Math.min(1, Math.max(0, (t - 0.18) / 0.5));
    const sm = k * k * (3 - 2 * k);
    return RAMP.offStart + (RAMP.offEnd - RAMP.offStart) * sm;
  };
  const height = (d) => {
    // d: distance from the arterial along u.
    const top = RAMP.len - RAMP.flat, bot = RAMP.groundAt;
    if (d >= top) return RING.deckY;
    if (d <= bot) return 0;
    const k = (d - bot) / (top - bot);
    return RING.deckY * (k * k * (3 - 2 * k));
  };
  for (let i = 0; i <= N; i++) {
    const t = i / N;                        // 0 deck end → 1 ground end
    const d = RAMP.len - (RAMP.len - RAMP.endGap) * t; // distance from arterial
    const side = kind === 'off' ? -dir : dir; // off-ramps are before the arterial in travel direction
    const u = u0 + side * d;
    const off = dir * lat(t);
    pts.push([u, height(d), off]);
  }
  if (kind === 'on') pts.reverse();
  return pts;
}

// World polyline for a ramp: [{x,y,z}] in travel order.
export function rampWorld(ic, dir, kind) {
  return rampCanonical(ic.u, dir, kind).map(([u, y, off]) => {
    const [x, z] = rotK(u, -RING.half + off, ic.side);
    return { x, y, z };
  });
}

// ------------------------------------------------------------ outer road
export const PARKWAY = { half: 720, radius: 150, hw: 7, name: 'Skyville Pkwy' };
export function parkwayPoint(s, off = 0) {
  const straight = PARKWAY.half - PARKWAY.radius;
  const seg = straight * 2, arc = (Math.PI / 2) * PARKWAY.radius;
  const total = 4 * (seg + arc);
  s = ((s % total) + total) % total;
  const side = Math.floor(s / (seg + arc));
  const r = s - side * (seg + arc);
  let x, z, tx, tz;
  if (r < seg) { x = -straight + r; z = -PARKWAY.half; tx = 1; tz = 0; } else {
    const a = (r - seg) / PARKWAY.radius;
    x = straight + Math.sin(a) * PARKWAY.radius; z = -straight - Math.cos(a) * PARKWAY.radius;
    tx = Math.cos(a); tz = Math.sin(a);
  }
  let nx = -tz, nz = tx;
  for (let k = 0; k < side; k++) { [x, z] = [-z, x]; [tx, tz] = [-tz, tx]; [nx, nz] = [-nz, nx]; }
  return { x: x + nx * off, z: z + nz * off, tx, tz, nx, nz };
}
export const PARKWAY_LEN = 4 * ((PARKWAY.half - PARKWAY.radius) * 2 + (Math.PI / 2) * PARKWAY.radius);

// ------------------------------------------------------------- the bay
export const BAY_X = 830; // water east of here

// -------------------------------------------------------- mechanic shops
// lot: center of the shop's property; face: direction the bays open toward
// (the street). drop: center of the painted drop-off zone in front.
export const SHOPS = [
  { id: 'rays', name: "Ray's Auto Repair", short: "Ray's", address: '412 Linden St', x: -405, z: -300, face: [1, 0], color: '#c0392b' },
  { id: 'collision', name: 'Skyville Collision Center', short: 'Collision Ctr', address: '2650 Bayview Blvd', x: 300, z: 280, face: [0, -1], color: '#1f4fa3' },
  { id: 'midtown', name: 'Midtown Tire & Brake', short: 'Midtown Tire', address: '3910 North Ave', x: 300, z: -420, face: [0, -1], color: '#e67e22' },
  { id: 'kowalski', name: 'Kowalski & Sons Garage', short: 'Kowalski & Sons', address: '88 Pine St', x: -60, z: 420, face: [0, -1], color: '#2e7d32' },
  { id: 'eastside', name: 'Eastside Transmission', short: 'Eastside Trans.', address: '1515 East End Ave', x: 410, z: 60, face: [1, 0], color: '#6a1b9a' },
  { id: 'harbor', name: 'Harbor Point Motors', short: 'Harbor Point', address: '7700 Skyville Pkwy S', x: 40, z: 676, face: [0, 1], color: '#00838f' },
  { id: 'quicklane', name: 'Quick Lane Auto Service', short: 'Quick Lane', address: '120 Skyville Pkwy N', x: -60, z: -676, face: [0, -1], color: '#0d47a1' },
  { id: 'beltway', name: 'Beltway Body & Paint', short: 'Beltway Body', address: '5400 Skyville Pkwy W', x: -676, z: 60, face: [-1, 0], color: '#424242' },
];
for (const s of SHOPS) {
  s.drop = { x: s.x + s.face[0] * 20, z: s.z + s.face[1] * 20 };
}

// ------------------------------------------------------------- landmarks
export const PLACES = [
  { name: 'Liberty Square', x: 60, z: -60, kind: 'park' },
  { name: 'Skyville General Hospital', x: 420, z: 300, kind: 'hospital' },
  { name: 'Union Station', x: -180, z: -60, kind: 'station' },
  { name: 'Skyville High School', x: -300, z: 420, kind: 'school' },
  { name: 'ShopRite Supermarket', x: -300, z: 180, kind: 'store' },
  { name: 'City Hall', x: -60, z: 60, kind: 'civic' },
  { name: 'Harbor Mall', x: 180, z: 420, kind: 'store' },
  { name: "Tony's Pizza", x: 180, z: -180, kind: 'food' },
  { name: 'Skyline Diner', x: -420, z: 60, kind: 'food' },
  { name: 'Riverside Park', x: -420, z: -420, kind: 'park' },
];

// Named spawn points (truck starts in the travel lane facing `dir`).
export const SPAWNS = [
  { name: 'Downtown — Broad & Main', x: -5.2, z: 40, dir: [0, 1] },
  { name: "Ray's Auto Repair, Linden St", x: -358.3, z: -260, dir: [0, -1] },
  { name: 'Harbor Blvd at Bayview', x: 234.8, z: 200, dir: [0, 1] },
  { name: 'Liberty Ave by Union Station', x: -200, z: -245.2, dir: [-1, 0] },
  { name: 'I-671 Inner Loop near Exit 2', ring: { s: 900 - 60, off: 3.45 } },
  { name: 'Skyville Pkwy South', parkway: { s: 2 * 1135.62 + 400, off: 3.6 } },
  { name: 'East End Ave & Washington', x: 478.3, z: 160, dir: [0, 1] },
  { name: 'Pine St near the high school', x: -300, z: 358.3, dir: [-1, 0] },
];

// ----------------------------------------------------------- road graph
// Nodes: intersections and highway diverge/merge points. Edges: directed,
// each with a polyline, a name, a speed limit (m/s) and a kind.
export function buildRoadGraph() {
  const nodes = [];
  const edges = [];
  const key = new Map();
  const node = (x, z, y = 0, tag = '') => {
    const k = `${Math.round(x * 10)}|${Math.round(z * 10)}|${Math.round(y)}`;
    if (key.has(k)) return key.get(k);
    const id = nodes.length;
    nodes.push({ id, x, y, z, out: [], tag });
    key.set(k, id);
    return id;
  };
  const edge = (a, b, pts, name, speed, kind, twoWay = false) => {
    const add = (from, to, poly) => {
      let len = 0;
      for (let i = 1; i < poly.length; i++) len += Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y, poly[i].z - poly[i - 1].z);
      const e = { id: edges.length, from, to, pts: poly, name, speed, kind, len };
      edges.push(e);
      nodes[from].out.push(e.id);
    };
    add(a, b, pts);
    if (twoWay) add(b, a, pts.slice().reverse());
  };
  const P = (x, z, y = 0) => ({ x, y, z });
  const mph = (v) => v * 0.44704;

  // Grid streets.
  for (let i = 0; i < GRID.length; i++) {
    for (let j = 0; j < GRID.length - 1; j++) {
      const x = GRID[i], z0 = GRID[j], z1 = GRID[j + 1];
      edge(node(x, z0), node(x, z1), [P(x, z0), P(x, z1)], NS_NAMES[i], mph(ARTERIAL.has(x) ? 35 : 25), 'street', true);
      const z = GRID[i], x0 = GRID[j], x1 = GRID[j + 1];
      edge(node(x0, z), node(x1, z), [P(x0, z), P(x1, z)], EW_NAMES[i], mph(ARTERIAL.has(z) ? 35 : 25), 'street', true);
    }
  }
  // Arterials out under the highway to the parkway, with ramp terminals.
  const termIn = RING.half - RAMP.offEnd, termOut = RING.half + RAMP.offEnd;
  const parkNodes = [];
  for (const ic of INTERCHANGES) {
    const pts = [GRID[GRID.length - 1], termIn, termOut, PARKWAY.half].map((d) => {
      const [x, z] = rotK(ic.u, -d, ic.side);
      return { x, z };
    });
    const ids = pts.map((p) => node(p.x, p.z));
    for (let k = 0; k < 3; k++) edge(ids[k], ids[k + 1], [P(pts[k].x, pts[k].z), P(pts[k + 1].x, pts[k + 1].z)], ic.street, mph(35), 'street', true);
    ic.termInNode = ids[1];
    ic.termOutNode = ids[2];
    ic.parkNode = ids[3];
    parkNodes.push({ id: ids[3], s: parkwayS(pts[3].x, pts[3].z) });
  }
  // Parkway loop (two-way), split at the arterial junctions.
  parkNodes.sort((a, b) => a.s - b.s);
  for (let k = 0; k < parkNodes.length; k++) {
    const a = parkNodes[k], b = parkNodes[(k + 1) % parkNodes.length];
    let s0 = a.s, s1 = b.s;
    if (s1 <= s0) s1 += PARKWAY_LEN;
    const poly = [];
    for (let s = s0; s < s1; s += 12) { const p = parkwayPoint(s); poly.push(P(p.x, p.z)); }
    const pe = parkwayPoint(s1); poly.push(P(pe.x, pe.z));
    edge(a.id, b.id, poly, PARKWAY.name, mph(45), 'street', true);
  }
  // Highway: diverge/merge nodes in clockwise order for each direction.
  const marks = [];
  for (const ic of INTERCHANGES) {
    const s0 = sideS(ic.side, ic.u);
    ic.s = s0;
    // Inner loop (clockwise): off-ramp diverges RAMP.len before, on-ramp merges after.
    marks.push({ s: s0 - RAMP.len, ic, dir: 1, kind: 'off' });
    marks.push({ s: s0 + RAMP.len, ic, dir: 1, kind: 'on' });
    marks.push({ s: s0 + RAMP.len, ic, dir: -1, kind: 'off' });
    marks.push({ s: s0 - RAMP.len, ic, dir: -1, kind: 'on' });
  }
  for (const dir of [1, -1]) {
    const laneOff = dir > 0 ? 5.3 : -5.3; // between the two lanes
    const ms = marks.filter((m) => m.dir === dir).map((m) => ({ ...m, s: ((m.s % RING_LEN) + RING_LEN) % RING_LEN }));
    ms.sort((a, b) => a.s - b.s);
    if (dir < 0) ms.reverse();
    for (const m of ms) {
      const p = ringPoint(m.s, laneOff);
      m.node = node(p.x, p.z, RING.deckY, 'hw');
    }
    for (let k = 0; k < ms.length; k++) {
      const a = ms[k], b = ms[(k + 1) % ms.length];
      const poly = [];
      let s0 = a.s, s1 = b.s;
      if (dir > 0) { if (s1 <= s0) s1 += RING_LEN; for (let s = s0; s < s1; s += 15) { const p = ringPoint(s, laneOff); poly.push(P(p.x, p.z, RING.deckY)); } }
      else { if (s1 >= s0) s1 -= RING_LEN; for (let s = s0; s > s1; s -= 15) { const p = ringPoint(s, laneOff); poly.push(P(p.x, p.z, RING.deckY)); } }
      const pe = ringPoint(s1, laneOff); poly.push(P(pe.x, pe.z, RING.deckY));
      edge(a.node, b.node, poly, dir > 0 ? 'I-671 Inner Loop' : 'I-671 Outer Loop', mph(55), 'highway');
    }
    for (const m of ms) {
      const ramp = rampWorld(m.ic, dir, m.kind);
      const term = dir > 0 ? m.ic.termInNode : m.ic.termOutNode;
      const name = m.kind === 'off' ? `Exit ${m.ic.exit} ramp` : `Ramp to I-671 ${dir > 0 ? 'Inner' : 'Outer'} Loop`;
      if (m.kind === 'off') edge(m.node, term, ramp, name, mph(30), 'ramp');
      else edge(term, m.node, ramp, name, mph(30), 'ramp');
    }
  }
  return { nodes, edges };
}

export function parkwayS(x, z) {
  // Brute-force nearest arc length (only used at build time).
  let best = 0, bd = Infinity;
  for (let s = 0; s < PARKWAY_LEN; s += 2) {
    const p = parkwayPoint(s);
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

export function ringS(x, z) {
  let best = 0, bd = Infinity;
  for (let s = 0; s < RING_LEN; s += 2) {
    const p = ringPoint(s);
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}

// Street name lookup for a point (for the HUD).
export function streetAt(x, z) {
  let best = null, bd = 14;
  for (let i = 0; i < GRID.length; i++) {
    if (Math.abs(x - GRID[i]) < bd && Math.abs(z) <= 490) { bd = Math.abs(x - GRID[i]); best = NS_NAMES[i]; }
    if (Math.abs(z - GRID[i]) < bd && Math.abs(x) <= 490) { bd = Math.abs(z - GRID[i]); best = EW_NAMES[i]; }
  }
  return best;
}
