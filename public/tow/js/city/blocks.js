// Buildings: downtown towers, East Coast brick mid-rises and rowhouses with
// stoops, storefronts with signs and awnings, the eight mechanic shops,
// landmarks, parks, parking lots and a gas station.
import * as THREE from 'three';
import * as F from './facades.js';
import * as TX from '../textures.js';
import { Buckets, hquad, wall, boxAt, cylAt } from './geom.js';
import { SHOPS, PLACES, SIDEWALK, CURB, GRID, halfWidthAt, BAY_X } from './layout.js';
import { Rng, makeCanvas, canvasTexture, roundRect, fitText } from '../util.js';

const BUSINESSES = [
  ["Rizzo's Pizza", '#b71c1c'], ['Liberty Deli', '#1b5e20'], ['Main St Pharmacy', '#0d47a1'], ['Golden Dragon', '#b8860b'],
  ['Spin City Laundromat', '#00838f'], ['Bayview Bagels', '#6d4c41'], ['Skyville Savings', '#1a237e'], ['Harbor Hardware', '#e65100'],
  ["Tony's Barber Shop", '#263238'], ['Cafe Milano', '#3e2723'], ['Dollar Depot', '#2e7d32'], ['Corner Bodega 24/7', '#c62828'],
  ['Atlas Insurance', '#37474f'], ['Lucky Nails', '#ad1457'], ['Metro Wireless', '#4527a0'], ["Joe's Shoe Repair", '#5d4037'],
  ['Bella Vista Bakery', '#880e4f'], ['Express Cleaners', '#01579b'], ['The Book Nook', '#33691e'], ['Pho Saigon', '#bf360c'],
  ['Taco Loco', '#f57f17'], ['Smile Dental', '#006064'], ['Liquor Locker', '#311b92'], ['Iron Gym', '#212121'],
  ['Blue Moon Tavern', '#1a237e'], ["Kim's Market", '#2e7d32'], ['Sushi Zen', '#b71c1c'], ['Pet Palace', '#6a1b9a'],
  ['First Federal Bank', '#0d47a1'], ['Urban Threads', '#424242'], ['Halal Grill', '#1b5e20'], ['Little Italy Pasta', '#2e7d32'],
  ['Philly Cheesesteaks', '#c62828'], ['Moe\'s Tattoo', '#000000'], ['QuickFix Phones', '#455a64'], ['Green Leaf Florist', '#388e3c'],
  ['Cheap Tires', '#f9a825'], ['Ocean Fish Market', '#0277bd'], ['Rite Price Grocery', '#d32f2f'], ['Skyline Cafe', '#4e342e'],
];

export function buildBlocks(root, physics, blocks, env) {
  const rng = new Rng(4242);
  const b = new Buckets();
  const atlas = new F.SignAtlas(4, 40);
  const solids = [];      // building footprints for colliders/minimap
  const roofItems = [];
  const parkingSpots = []; // {x,z,rot} where parked cars may sit
  const treeSpots = [];    // {x,z,s}
  const benchSpots = [];
  const aprons = [];

  // ---- materials (one per facade style; everything merges by material)
  const mats = {};
  const mk = (key, set, extra = {}) => (mats[key] ||= F.facadeMaterial(set, extra));
  const brickColors = ['#8a3b2a', '#6e4a35', '#a3765a', '#4f3b33', '#9c5434', '#7a2e24'];
  brickColors.forEach((c, i) => {
    mk('brick' + i, F.brickFacade(c, i + 1, i % 3));
    mk('rowg' + i, F.rowhouseGround(c, i + 11));
  });
  mk('glass0', F.glassCurtain([52, 88, 112], 4));
  mk('glass1', F.glassCurtain([70, 96, 92], 5));
  mk('glass2', F.glassCurtain([86, 92, 104], 6));
  mk('conc0', F.concreteOffice(170, 7));
  mk('conc1', F.concreteOffice(140, 8));
  mk('stucco0', F.stuccoFacade('#d9cdb5', 11));
  mk('stucco1', F.stuccoFacade('#c8c4bc', 12));
  mk('store0', F.storefront('#2b2d30', 2));
  mk('store1', F.storefront('#5b3a1e', 3));
  mk('store2', F.storefront('#1f3b5a', 4));
  mk('corr0', F.corrugated('#9aa3a8', 3));
  mk('corr1', F.corrugated('#b5a58c', 4));
  mk('cinder', F.cinderBlock('#d9d6cf', 5));
  mk('cinder1', F.cinderBlock('#c9c3b5', 6));
  const roofSet = F.gravelRoof();
  mats.roof = new THREE.MeshStandardMaterial({ ...roofSet, roughness: 0.95 });
  mats.trim = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.8 });
  mats.darkTrim = new THREE.MeshStandardMaterial({ color: 0x2b2c2f, roughness: 0.6, metalness: 0.3 });
  mats.metal = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.4, metalness: 0.8 });
  mats.hvac = new THREE.MeshStandardMaterial({ color: 0xa9adb1, roughness: 0.55, metalness: 0.6 });
  mats.wood = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.85 });
  mats.stone = new THREE.MeshStandardMaterial({ ...TX.concrete(31, [1, 0.98, 0.93], 200), roughness: 0.75 });
  mats.grass = env.parkGrass;
  mats.asphalt = env.lotAsphalt;
  mats.paint = env.white;
  mats.sidewalk = env.sidewalk;
  mats.water = new THREE.MeshPhysicalMaterial({ color: 0x2c4a5a, roughness: 0.08, metalness: 0.1, clearcoat: 1 });
  const awningMats = ['#b71c1c', '#1b5e20', '#0d47a1', '#4e342e', '#212121', '#e65100'].map((c) => awningMaterial(c));
  const rollDoor = rollupDoorMaterial();

  // ---------------------------------------------------- building helpers
  // A box building from y=CURB to top, facade on all walls. ground: {mat, h,
  // faces:'nesw' subset} gives the street-facing ground floor its own look.
  const building = (x0, z0, x1, z1, h, wallKey, opts = {}) => {
    const y0 = CURB;
    const gH = opts.groundH ?? 0;
    const groundFaces = opts.groundFaces ?? '';
    const uT = opts.uTile ?? F.BAY, vT = opts.vTile ?? F.FLOOR;
    const walls = {
      n: [x1, z0, x0, z0], e: [x1, z1, x1, z0], s: [x0, z1, x1, z1], w: [x0, z0, x0, z1],
    };
    for (const [f, [ax, az, bx, bz]] of Object.entries(walls)) {
      if (gH > 0) {
        const gKey = groundFaces.includes(f) ? opts.groundKey : wallKey;
        b.add(gKey, mats[gKey], wall(ax, az, bx, bz, y0, y0 + gH, opts.groundUTile ?? (groundFaces.includes(f) ? 4.0 : uT), groundFaces.includes(f) ? gH : vT));
      }
      b.add(wallKey, mats[wallKey], wall(ax, az, bx, bz, y0 + gH, y0 + h, uT, vT));
    }
    b.add('roof', mats.roof, hquad(x0, z0, x1, z1, y0 + h, 4));
    // Parapet cap.
    if (opts.parapet !== false) {
      const t = 0.25, ph = 0.5, top = y0 + h;
      const capMat = opts.capKey ?? 'trim';
      b.add(capMat, mats[capMat], boxAt(x1 - x0 + 0.3, ph, t, (x0 + x1) / 2, top + ph / 2, z0 + t / 2 - 0.15));
      b.add(capMat, mats[capMat], boxAt(x1 - x0 + 0.3, ph, t, (x0 + x1) / 2, top + ph / 2, z1 - t / 2 + 0.15));
      b.add(capMat, mats[capMat], boxAt(t, ph, z1 - z0, x0 + t / 2 - 0.15, top + ph / 2, (z0 + z1) / 2));
      b.add(capMat, mats[capMat], boxAt(t, ph, z1 - z0, x1 - t / 2 + 0.15, top + ph / 2, (z0 + z1) / 2));
    }
    if (opts.cornice) {
      const top = y0 + h - 0.6;
      b.add('trim', mats.trim, boxAt(x1 - x0 + 0.7, 0.45, z1 - z0 + 0.7, (x0 + x1) / 2, top, (z0 + z1) / 2));
    }
    // Roof clutter.
    if (opts.roofStuff !== false && h > 7) {
      const n = 1 + rng.int(0, 2);
      for (let i = 0; i < n; i++) {
        const w = 1.5 + rng.next() * 2.5, d = 1.2 + rng.next() * 2;
        const x = x0 + 2 + rng.next() * Math.max(0.1, x1 - x0 - 4 - w), z = z0 + 2 + rng.next() * Math.max(0.1, z1 - z0 - 4 - d);
        b.add('hvac', mats.hvac, boxAt(w, 1.2, d, x + w / 2, y0 + h + 0.6, z + d / 2));
      }
      if (opts.waterTower && rng.chance(0.55)) waterTower(b, mats, (x0 + x1) / 2 + rng.range(-3, 3), y0 + h, (z0 + z1) / 2 + rng.range(-3, 3));
    }
    solids.push({ x0, z0, x1, z1, h: y0 + h });
    physics?.box((x0 + x1) / 2, (y0 + h) / 2, (z0 + z1) / 2, (x1 - x0) / 2, (y0 + h) / 2, (z1 - z0) / 2);
  };

  // Street-facing sign over a storefront on face f of a footprint.
  const storeSign = (x0, z0, x1, z1, f, y, text, color) => {
    const uv = atlas.add(text.toUpperCase(), { bg: color });
    const inset = 0.08;
    let ax, az, bx, bz;
    if (f === 'n') { ax = x1 - 0.6; az = z0 - inset; bx = x0 + 0.6; bz = z0 - inset; }
    if (f === 's') { ax = x0 + 0.6; az = z1 + inset; bx = x1 - 0.6; bz = z1 + inset; }
    if (f === 'e') { ax = x1 + inset; az = z1 - 0.6; bx = x1 + inset; bz = z0 + 0.6; }
    if (f === 'w') { ax = x0 - inset; az = z0 + 0.6; bx = x0 - inset; bz = z1 - 0.6; }
    const len = Math.hypot(bx - ax, bz - az);
    const w = Math.min(len, 7.5), cxm = (ax + bx) / 2, czm = (az + bz) / 2;
    const dx = (bx - ax) / len, dz = (bz - az) / len;
    const g = wall(cxm - dx * w / 2, czm - dz * w / 2, cxm + dx * w / 2, czm + dz * w / 2, y, y + 0.85, 1, 1);
    const u = g.attributes.uv;
    u.setXY(0, uv[0], uv[1]); u.setXY(1, uv[2], uv[1]); u.setXY(2, uv[2], uv[3]); u.setXY(3, uv[0], uv[3]);
    b.add('signs', atlas.material, g);
    // Awning under the sign.
    if (rng.chance(0.55)) {
      const am = rng.pick(awningMats);
      const nx = -dz, nz = dx; // outward normal for this wall direction
      const yA = y - 0.15, out = 1.3;
      const ga = new THREE.BufferGeometry();
      const p0 = [cxm - dx * w / 2, yA, czm - dz * w / 2], p1 = [cxm + dx * w / 2, yA, czm + dz * w / 2];
      const p2 = [p1[0] + nx * out, yA - 0.7, p1[2] + nz * out], p3 = [p0[0] + nx * out, yA - 0.7, p0[2] + nz * out];
      ga.setAttribute('position', new THREE.Float32BufferAttribute([...p0, ...p1, ...p2, ...p3], 3));
      ga.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, w / 1.5, 1, w / 1.5, 0, 0, 0], 2));
      ga.setIndex([0, 2, 1, 0, 3, 2]);
      ga.computeVertexNormals();
      if (ga.attributes.normal.getY(0) < 0) ga.setIndex([0, 1, 2, 0, 2, 3]);
      ga.computeVertexNormals();
      b.add('awning' + am.uuid, am, ga);
    }
  };

  // --------------------------------------------------------- per block
  const nearest = (list, blk) => list.filter((p) => p.x > blk.x0 && p.x < blk.x1 && p.z > blk.z0 && p.z < blk.z1);
  let bizIdx = 0;
  const nextBiz = () => BUSINESSES[bizIdx++ % BUSINESSES.length];

  for (const blk of blocks) {
    // Lot rectangle inside the sidewalks.
    const L = { x0: blk.x0 + SIDEWALK, x1: blk.x1 - SIDEWALK, z0: blk.z0 + SIDEWALK, z1: blk.z1 - SIDEWALK };
    const ring = Math.max(Math.abs(blk.cx), Math.abs(blk.cz));
    const zone = ring < 200 ? 'downtown' : ring < 330 ? 'midtown' : 'outer';
    const excl = [];
    // Sidewalk trees along the curb.
    if (zone !== 'downtown' || rng.chance(0.4)) {
      for (const side of ['n', 's', 'e', 'w']) {
        const along = side === 'n' || side === 's';
        const a0 = along ? blk.x0 + 6 : blk.z0 + 6, a1 = along ? blk.x1 - 6 : blk.z1 - 6;
        for (let a = a0; a < a1; a += 11 + rng.next() * 4) {
          const off = 1.1;
          const p = side === 'n' ? { x: a, z: blk.z0 + off } : side === 's' ? { x: a, z: blk.z1 - off } : side === 'w' ? { x: blk.x0 + off, z: a } : { x: blk.x1 - off, z: a };
          treeSpots.push({ ...p, s: 0.8 + rng.next() * 0.4, y: CURB, pit: true });
        }
      }
    }

    const shops = nearest(SHOPS, blk);
    for (const s of shops) excl.push(buildShop(s));
    const places = nearest(PLACES, blk);
    let special = null;
    for (const p of places) special = p;

    if (special?.kind === 'park') { park(L, special); continue; }
    if (special?.kind === 'civic') { cityHall(L); continue; }
    if (special?.kind === 'station') { station(L); continue; }
    if (special?.kind === 'hospital') { hospital(L); continue; }
    if (special?.kind === 'school') { school(L); continue; }
    if (special?.kind === 'store') { bigBox(L, special); continue; }

    if (zone === 'downtown') downtownBlock(L, excl);
    else if (zone === 'midtown') perimeterBlock(L, excl, 'midtown');
    else perimeterBlock(L, excl, 'outer');
  }

  // ----------------------------------------------------------- downtown
  function downtownBlock(L, excl) {
    const mx = (L.x0 + L.x1) / 2, mz = (L.z0 + L.z1) / 2;
    const quads = [[L.x0, L.z0, mx, mz], [mx, L.z0, L.x1, mz], [L.x0, mz, mx, L.z1], [mx, mz, L.x1, L.z1]];
    const mode = rng.int(0, 2);
    if (mode === 0) {
      // One big tower on a plinth with a plaza.
      const inset = 6 + rng.next() * 6;
      const h = 90 + rng.next() * 110;
      tower(L.x0 + inset, L.z0 + inset, L.x1 - inset, L.z1 - inset, h);
      plaza(L);
      return;
    }
    for (const [x0, z0, x1, z1] of quads) {
      if (excl.some((e) => overlaps(e, { x0, z0, x1, z1 }))) continue;
      const r = rng.next();
      const pad = 1.5;
      if (r < 0.55) tower(x0 + pad, z0 + pad, x1 - pad, z1 - pad, 45 + rng.next() * 100);
      else midrise(x0 + pad, z0 + pad, x1 - pad, z1 - pad, 6 + rng.int(0, 6), 'nsew');
    }
  }

  function tower(x0, z0, x1, z1, h) {
    const key = rng.pick(['glass0', 'glass1', 'glass2', 'conc0', 'conc1']);
    const isGlass = key.startsWith('glass');
    building(x0, z0, x1, z1, h, key, {
      groundH: 6.0, groundKey: rng.pick(['store0', 'store2']), groundFaces: 'nesw', groundUTile: 5,
      uTile: isGlass ? 1.6 : F.BAY, vTile: F.FLOOR, capKey: 'darkTrim', roofStuff: true,
    });
    // Mechanical penthouse and maybe a spire.
    const px0 = x0 + (x1 - x0) * 0.25, px1 = x1 - (x1 - x0) * 0.25, pz0 = z0 + (z1 - z0) * 0.25, pz1 = z1 - (z1 - z0) * 0.25;
    building(px0, pz0, px1, pz1, h + 5, 'conc1', { uTile: 6, vTile: 5, roofStuff: false, parapet: false });
    if (h > 150) b.add('metal', mats.metal, cylAt(0.25, 0.5, 18, (x0 + x1) / 2, CURB + h + 5 + 9, (z0 + z1) / 2, 8));
  }

  function midrise(x0, z0, x1, z1, floors, storeFaces) {
    const key = rng.pick(['brick0', 'brick1', 'brick2', 'brick3', 'brick4', 'brick5', 'stucco0', 'stucco1', 'conc0']);
    const h = 4.2 + (floors - 1) * F.FLOOR;
    building(x0, z0, x1, z1, h, key, {
      groundH: 4.2, groundKey: rng.pick(['store0', 'store1', 'store2']), groundFaces: storeFaces, cornice: key.startsWith('brick'),
      waterTower: key.startsWith('brick') && floors >= 6,
    });
    for (const f of storeFaces) {
      if (rng.chance(0.85)) {
        const [name, col] = nextBiz();
        storeSign(x0, z0, x1, z1, f, CURB + 3.1, name, col);
      }
    }
  }

  // Buildings along all four street faces; corners belong to N/S runs.
  function perimeterBlock(L, excl, zone) {
    const D = zone === 'midtown' ? 22 : 14;
    const runs = [
      { f: 'n', a0: L.x0, a1: L.x1, fixed: L.z0, axis: 'x' },
      { f: 's', a0: L.x0, a1: L.x1, fixed: L.z1, axis: 'x' },
      { f: 'w', a0: L.z0 + D, a1: L.z1 - D, fixed: L.x0, axis: 'z' },
      { f: 'e', a0: L.z0 + D, a1: L.z1 - D, fixed: L.x1, axis: 'z' },
    ];
    for (const r of runs) {
      let a = r.a0;
      while (a < r.a1 - 4) {
        const corner = a === r.a0 || r.a1 - a < 14;
        let w;
        if (zone === 'outer') w = corner ? Math.min(r.a1 - a, 12 + rng.next() * 4) : 5.6 + rng.int(0, 2) * 0.6;
        else w = Math.min(r.a1 - a, 14 + rng.next() * 16);
        if (r.a1 - a - w < 5) w = r.a1 - a;
        const fp = footprint(r, a, a + w, D);
        a += w;
        if (excl.some((e) => overlaps(e, fp))) continue;
        if (zone === 'outer' && !corner && w < 8) rowhouse(fp, r.f);
        else if (zone === 'outer') midrise(fp.x0, fp.z0, fp.x1, fp.z1, 2 + rng.int(0, 1), r.f);
        else midrise(fp.x0, fp.z0, fp.x1, fp.z1, 4 + rng.int(0, 4), r.f);
      }
    }
    // Interior: alley parking.
    const inner = { x0: L.x0 + D + 2, z0: L.z0 + D + 2, x1: L.x1 - D - 2, z1: L.z1 - D - 2 };
    if (inner.x1 - inner.x0 > 10 && inner.z1 - inner.z0 > 10 && !excl.some((e) => overlaps(e, inner))) {
      b.add('asphalt', mats.asphalt, hquad(inner.x0, inner.z0, inner.x1, inner.z1, CURB + 0.01, 8));
    }
  }

  function footprint(r, a0, a1, D) {
    if (r.axis === 'x') return r.f === 'n' ? { x0: a0, x1: a1, z0: r.fixed, z1: r.fixed + D } : { x0: a0, x1: a1, z0: r.fixed - D, z1: r.fixed };
    return r.f === 'w' ? { x0: r.fixed, x1: r.fixed + D, z0: a0, z1: a1 } : { x0: r.fixed - D, x1: r.fixed, z0: a0, z1: a1 };
  }

  // Brick rowhouse with a stoop: three stories, cornice, door on the street.
  function rowhouse(fp, f) {
    const ci = rng.int(0, brickColors.length - 1);
    const wallKey = 'brick' + ci;
    const front = 0.0;
    const h = 3 * F.FLOOR + 0.4;
    // Set back 1.6 m so the stoop sits in front without hitting the sidewalk curb.
    const setback = 1.6;
    const g = { ...fp };
    if (f === 'n') g.z0 += setback; if (f === 's') g.z1 -= setback; if (f === 'w') g.x0 += setback; if (f === 'e') g.x1 -= setback;
    building(g.x0, g.z0, g.x1, g.z1, h, wallKey, {
      groundH: F.FLOOR, groundKey: 'rowg' + ci, groundFaces: f, groundUTile: 6.4, cornice: true, roofStuff: rng.chance(0.3),
    });
    // Stoop: 4 steps toward the street at the door (left part of the facade).
    const steps = 4;
    for (let i = 0; i < steps; i++) {
      const sh = (F.FLOOR * 0.3) * (1 - i / steps), depth = setback * ((i + 1) / steps);
      let x, z, w = 1.5, d = depth;
      const doorAlong = 1.35;
      if (f === 'n') { x = g.x1 - doorAlong; z = g.z0 - depth / 2; }
      if (f === 's') { x = g.x0 + doorAlong; z = g.z1 + depth / 2; }
      if (f === 'w') { x = g.x0 - depth / 2; z = g.z0 + doorAlong; [w, d] = [d, w]; }
      if (f === 'e') { x = g.x1 + depth / 2; z = g.z1 - doorAlong; [w, d] = [d, w]; }
      b.add('stone', mats.stone, boxAt(w, sh, d, x, CURB + sh / 2, z));
    }
  }

  function plaza(L) {
    const cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2;
    for (let i = 0; i < 6; i++) treeSpots.push({ x: L.x0 + 3 + rng.next() * (L.x1 - L.x0 - 6), z: rng.chance(0.5) ? L.z0 + 3 : L.z1 - 3, s: 1, y: CURB });
    benchSpots.push({ x: cx, z: L.z0 + 3, rot: 0 }, { x: cx, z: L.z1 - 3, rot: Math.PI });
  }

  function park(L, place) {
    b.add('grass', mats.grass, hquad(L.x0 - 1, L.z0 - 1, L.x1 + 1, L.z1 + 1, CURB + 0.01, 6));
    const cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2;
    // Cross paths.
    b.add('sidewalk', mats.sidewalk, hquad(cx - 2.5, L.z0 - 1, cx + 2.5, L.z1 + 1, CURB + 0.02, 3));
    b.add('sidewalk', mats.sidewalk, hquad(L.x0 - 1, cz - 2.5, L.x1 + 1, cz + 2.5, CURB + 0.02, 3));
    // Fountain.
    b.add('stone', mats.stone, cylAt(7, 7.3, 0.6, cx, CURB + 0.3, cz, 40));
    b.add('water', mats.water, cylAt(6.4, 6.4, 0.05, cx, CURB + 0.58, cz, 40));
    b.add('stone', mats.stone, cylAt(0.6, 0.9, 2.6, cx, CURB + 1.5, cz, 16));
    b.add('stone', mats.stone, cylAt(1.8, 0.4, 0.4, cx, CURB + 2.9, cz, 24));
    physics?.cylinder(cx, CURB + 0.3, cz, 7.3, 0.3);
    for (let i = 0; i < 26; i++) {
      const x = L.x0 + 4 + rng.next() * (L.x1 - L.x0 - 8), z = L.z0 + 4 + rng.next() * (L.z1 - L.z0 - 8);
      if (Math.abs(x - cx) < 5 || Math.abs(z - cz) < 5) continue;
      if (Math.hypot(x - cx, z - cz) < 11) continue;
      treeSpots.push({ x, z, s: 1 + rng.next() * 0.6, y: CURB });
    }
    for (const [dx, dz, r] of [[0, -9, 0], [0, 9, Math.PI], [-9, 0, Math.PI / 2], [9, 0, -Math.PI / 2]]) benchSpots.push({ x: cx + dx, z: cz + dz, rot: r });
    // Park sign.
    const uv = atlas.add(place.name.toUpperCase(), { bg: '#2e5d34' });
    signBoard(cx + 9, L.z0 - 0.5, uv, 0);
  }

  function signBoard(x, z, uv, rotY, w = 4, h = 0.8, y = CURB + 0.9) {
    const g = new THREE.PlaneGeometry(w, h);
    const u = g.attributes.uv;
    u.setXY(0, uv[0], uv[3]); u.setXY(1, uv[2], uv[3]); u.setXY(2, uv[0], uv[1]); u.setXY(3, uv[2], uv[1]);
    g.rotateY(rotY + Math.PI);
    g.translate(x, y, z);
    b.add('signs', atlas.material, g);
    const back = new THREE.BoxGeometry(w + 0.1, h + 0.1, 0.08);
    back.rotateY(rotY);
    back.translate(x + Math.sin(rotY) * 0.05, y, z + Math.cos(rotY) * 0.05);
    b.add('darkTrim', mats.darkTrim, back);
  }

  function cityHall(L) {
    const cx = (L.x0 + L.x1) / 2, cz = (L.z0 + L.z1) / 2;
    const x0 = L.x0 + 14, x1 = L.x1 - 14, z0 = L.z0 + 22, z1 = L.z1 - 18;
    building(x0, z0, x1, z1, 16, 'stucco1', { cornice: true, roofStuff: false, capKey: 'trim' });
    // Portico with columns and a pediment, steps, and a dome.
    for (let i = 0; i < 8; i++) {
      const x = x0 + 6 + i * ((x1 - x0 - 12) / 7);
      b.add('stone', mats.stone, cylAt(0.55, 0.62, 12, x, CURB + 1.2 + 6, z0 - 3.2, 18));
    }
    b.add('stone', mats.stone, boxAt(x1 - x0 - 6, 1.2, 4.6, cx, CURB + 13.8, z0 - 2.6));
    for (let i = 0; i < 4; i++) b.add('stone', mats.stone, boxAt(x1 - x0 - 4, 0.3, 8 - i * 1.6, cx, CURB + 0.15 + i * 0.3, z0 - 4 + i * 0.8));
    const dome = new THREE.SphereGeometry(8, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    dome.translate(cx, CURB + 22, cz);
    b.add('metal', mats.metal, dome);
    b.add('stucco1', mats.stucco1, cylAt(8.4, 8.4, 6, cx, CURB + 19, cz, 32));
    physics?.box(cx, CURB + 4, z0 - 2.6, (x1 - x0) / 2, 4, 2.4);
    const uv = atlas.add('SKYVILLE CITY HALL', { bg: '#37474f' });
    signBoard(cx, L.z0 - 0.5, uv, 0, 6, 1);
    for (let i = 0; i < 8; i++) treeSpots.push({ x: L.x0 + 4 + i * ((L.x1 - L.x0 - 8) / 7), z: L.z0 + 4, s: 0.9, y: CURB });
  }

  function station(L) {
    const x0 = L.x0 + 4, x1 = L.x1 - 4, z0 = L.z0 + 12, z1 = L.z1 - 12;
    building(x0, z0, x1, z1, 18, 'stucco0', { cornice: true, groundH: 7, groundKey: 'store2', groundFaces: 'nesw', groundUTile: 6, roofStuff: false });
    // Clock tower.
    const cx = (x0 + x1) / 2;
    building(cx - 4, z0 - 1, cx + 4, z0 + 7, 34, 'stucco0', { cornice: true, roofStuff: false });
    const clock = new THREE.CircleGeometry(2.2, 32);
    clock.rotateY(Math.PI);
    clock.translate(cx, CURB + 29, z0 - 1.05);
    b.add('clock', clockMaterial(), clock);
    const uv = atlas.add('UNION STATION', { bg: '#263238' });
    signBoard(cx, z0 - 0.2, uv, 0, 10, 1.4, CURB + 8.2);
  }

  function hospital(L) {
    const x0 = L.x0 + 6, x1 = L.x1 - 6, z0 = L.z0 + 8, z1 = L.z1 - 26;
    building(x0, z0, x1, z1, 32, 'conc0', { groundH: 5, groundKey: 'store2', groundFaces: 'nesw', roofStuff: true });
    building(x0 + 10, z1, x1 - 30, z1 + 18, 10, 'stucco1', { roofStuff: false });
    // Helipad.
    b.add('darkTrim', mats.darkTrim, cylAt(7, 7, 0.2, (x0 + x1) / 2, CURB + 32.6, (z0 + z1) / 2, 32));
    const uv = atlas.add('SKYVILLE GENERAL HOSPITAL', { bg: '#0d47a1' });
    signBoard((x0 + x1) / 2, z0 - 0.15, uv, 0, 12, 1.4, CURB + 27);
    const uv2 = atlas.add('EMERGENCY', { bg: '#c62828' });
    signBoard(x0 + 20, z1 + 18.2, uv2, Math.PI, 7, 1.1, CURB + 6);
    parkingLot({ x0: x1 - 28, z0: z1 + 2, x1: x1, z1: L.z1 - 2 });
  }

  function school(L) {
    const x0 = L.x0 + 6, x1 = L.x1 - 6, z0 = L.z0 + 6, z1 = z0 + 26;
    building(x0, z0, x1, z1, 11, 'brick2', { cornice: true, roofStuff: true });
    b.add('grass', mats.grass, hquad(L.x0, z1 + 4, L.x1, L.z1, CURB + 0.01, 6));
    // Running track oval (just the infield shape).
    const uv = atlas.add('SKYVILLE HIGH SCHOOL', { bg: '#7b1fa2', sub: 'HOME OF THE HAWKS' });
    signBoard((x0 + x1) / 2, z0 - 0.15, uv, 0, 12, 2.2, CURB + 8);
    for (let i = 0; i < 10; i++) treeSpots.push({ x: L.x0 + 5 + rng.next() * (L.x1 - L.x0 - 10), z: z1 + 8 + rng.next() * 40, s: 1.1, y: CURB });
  }

  function bigBox(L, place) {
    const name = place.name.replace('ShopRite', 'FreshRite');
    const x0 = L.x0 + 4, x1 = L.x1 - 4, z0 = L.z0 + 4, z1 = z0 + 44;
    building(x0, z0, x1, z1, 9, 'stucco0', { groundH: 4, groundKey: 'store0', groundFaces: 's', roofStuff: true });
    const uv = atlas.add(name.toUpperCase(), { bg: '#c62828' });
    signBoard((x0 + x1) / 2, z1 + 0.15, uv, Math.PI, 16, 2.4, CURB + 7);
    parkingLot({ x0: L.x0, z0: z1 + 3, x1: L.x1, z1: L.z1 });
  }

  function parkingLot(r) {
    b.add('asphalt', mats.asphalt, hquad(r.x0, r.z0, r.x1, r.z1, CURB + 0.01, 8));
    // Stall lines (2.7 m wide, 5.5 m deep) in rows facing a drive aisle.
    const rows = Math.floor((r.z1 - r.z0) / 12);
    for (let row = 0; row < rows; row++) {
      const zA = r.z0 + 1 + row * 12;
      for (let x = r.x0 + 1; x < r.x1 - 2.7; x += 2.7) {
        b.add('paint', mats.paint, hquad(x, zA, x + 0.12, zA + 5.4, CURB + 0.025, 2));
        if (rng.chance(0.45)) parkingSpots.push({ x: x + 1.35, z: zA + 2.8, rot: rng.chance(0.5) ? 0 : Math.PI, y: CURB });
      }
    }
  }

  // ---------------------------------------------------------- the shops
  function buildShop(s) {
    const fx = s.face[0], fz = s.face[1];
    const W = 26, D = 16;               // across the face, depth
    const hx = fx !== 0 ? D / 2 : W / 2, hz = fz !== 0 ? D / 2 : W / 2;
    const x0 = s.x - hx, x1 = s.x + hx, z0 = s.z - hz, z1 = s.z + hz;
    const outside = Math.max(Math.abs(s.x), Math.abs(s.z)) > 600;
    const base = outside ? 0 : CURB;
    const h = 6.5;
    const faceKey = fx > 0 ? 'e' : fx < 0 ? 'w' : fz > 0 ? 's' : 'n';
    // Body.
    const y0 = base;
    const walls = { n: [x1, z0, x0, z0], e: [x1, z1, x1, z0], s: [x0, z1, x1, z1], w: [x0, z0, x0, z1] };
    for (const [f, [ax, az, bx, bz]] of Object.entries(walls)) b.add('cinder', mats.cinder, wall(ax, az, bx, bz, y0, y0 + h, F.BAY, F.FLOOR));
    b.add('roof', mats.roof, hquad(x0, z0, x1, z1, y0 + h, 4));
    // Bay doors on the front face, inset slightly.
    const [ax, az, bx, bz] = walls[faceKey];
    const len = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / len, dz = (bz - az) / len;
    const nx = -dz, nz = dx;
    for (let i = 0; i < 3; i++) {
      const c = 4.5 + i * 6.2;
      const p0x = ax + dx * (c - 2.3) + nx * 0.03, p0z = az + dz * (c - 2.3) + nz * 0.03;
      const p1x = ax + dx * (c + 2.3) + nx * 0.03, p1z = az + dz * (c + 2.3) + nz * 0.03;
      b.add('rolldoor', rollDoor, wall(p0x, p0z, p1x, p1z, y0, y0 + 4.2, 4.6, 4.2));
    }
    // Office door + window at the end.
    const ox = ax + dx * 23.2 + nx * 0.03, oz = az + dz * 23.2 + nz * 0.03;
    b.add('store1', mats.store1, wall(ox - dx * 1.6, oz - dz * 1.6, ox + dx * 1.6, oz + dz * 1.6, y0, y0 + 3, 3.2, 3.0));
    // Big sign band across the top of the front.
    const uv = atlas.add(s.name.toUpperCase(), { bg: s.color, sub: `${s.address}  ·  AUTO REPAIR  ·  TOWING DROP-OFF` });
    const sg = wall(ax + nx * 0.06 + dx * 1, az + nz * 0.06 + dz * 1, bx + nx * 0.06 - dx * 1, bz + nz * 0.06 - dz * 1, y0 + 4.6, y0 + 6.2, 1, 1);
    const u = sg.attributes.uv;
    u.setXY(0, uv[0], uv[1]); u.setXY(1, uv[2], uv[1]); u.setXY(2, uv[2], uv[3]); u.setXY(3, uv[0], uv[3]);
    b.add('signs', atlas.material, sg);
    // Pylon sign near the street.
    const pyx = s.x + fx * 26 + (fz !== 0 ? 11 : 0), pyz = s.z + fz * 26 + (fx !== 0 ? 11 : 0);
    b.add('metal', mats.metal, cylAt(0.15, 0.15, 6, pyx, base + 3, pyz, 10));
    const rot = Math.atan2(fx, fz);
    const uv2 = atlas.add(s.short.toUpperCase(), { bg: s.color, sub: 'TOW DROP-OFF HERE' });
    signBoard(pyx, pyz, uv2, rot + Math.PI, 4, 1.6, base + 6.4);
    signBoard(pyx, pyz, uv2, rot, 4, 1.6, base + 6.4);
    physics?.box(s.x, base + h / 2, s.z, hx, h / 2, hz);
    physics?.cylinder(pyx, base + 3, pyz, 0.18, 3);
    solids.push({ x0, z0, x1, z1, h: base + h, shop: s.id });
    // Forecourt: asphalt + painted drop-off box.
    const fc = { x0: Math.min(x0, x1, s.drop.x - 14), x1: Math.max(x0, x1, s.drop.x + 14), z0: Math.min(z0, z1, s.drop.z - 14), z1: Math.max(z0, z1, s.drop.z + 14) };
    if (fx !== 0) { fc.z0 = s.z - 14; fc.z1 = s.z + 14; fc.x0 = fx > 0 ? x1 : s.drop.x - 12; fc.x1 = fx > 0 ? s.drop.x + 12 : x0; }
    else { fc.x0 = s.x - 14; fc.x1 = s.x + 14; fc.z0 = fz > 0 ? z1 : s.drop.z - 12; fc.z1 = fz > 0 ? s.drop.z + 12 : z0; }
    b.add('asphalt', mats.asphalt, hquad(fc.x0, fc.z0, fc.x1, fc.z1, base + 0.012, 8));
    const zw = fx !== 0 ? 9 : 11, zd = fx !== 0 ? 11 : 9;
    dropBox(s.drop.x, s.drop.z, fx !== 0 ? 10 : 4.5, fx !== 0 ? 4.5 : 10, base + 0.03);
    // A couple of customer cars waiting.
    for (let i = 0; i < 2; i++) {
      const along = (i - 0.5) * 5.5;
      const px = s.x + fx * (hx + 4) + (fz !== 0 ? 8 + along : 0), pz = s.z + fz * (hz + 4) + (fx !== 0 ? 8 + along : 0);
      parkingSpots.push({ x: px, z: pz, rot: Math.atan2(fx, fz), y: base, shop: s.id });
    }
    // Curb-cut apron so vehicles can roll up onto the forecourt.
    if (!outside) {
      const along = fx !== 0 ? s.x : s.z;
      const dirS = fx !== 0 ? fx : fz;
      const street = dirS > 0 ? Math.min(...GRID.filter((g) => g > along)) : Math.max(...GRID.filter((g) => g < along));
      const curb = street - dirS * halfWidthAt(street);
      apron(fx !== 0 ? 'x' : 'z', curb, dirS, fx !== 0 ? s.z : s.x, 7);
    }
    s.lot = fc;
    s.base = base;
    return { x0: Math.min(fc.x0, x0) - 1, x1: Math.max(fc.x1, x1) + 1, z0: Math.min(fc.z0, z0) - 1, z1: Math.max(fc.z1, z1) + 1 };
  }

  // A sloped curb cut: from street level `run` meters out up to the curb top.
  function apron(axis, curb, dirS, center, half) {
    const run = 1.8, yLo = 0.02, yHi = CURB + 0.004;
    // Points: along-axis a, outward coordinate o (toward the street = +dirS).
    const P = (o, a, y) => (axis === 'x' ? [curb + dirS * o, y, a] : [a, y, curb + dirS * o]);
    const q = [P(0, center - half, yHi), P(0, center + half, yHi), P(run, center + half, yLo), P(run, center - half, yLo)];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(q.flat(), 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(q.flatMap((p) => [p[0] / 3, p[2] / 3]), 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.computeVertexNormals();
    if (g.attributes.normal.getY(0) < 0) { g.setIndex([0, 2, 1, 0, 3, 2]); g.computeVertexNormals(); }
    b.add('sidewalk', mats.sidewalk, g);
    if (physics) {
      const pts = [...q.flat(), ...P(0, center - half, 0).concat(P(0, center + half, 0))];
      physics.convex(pts);
    }
    aprons.push({ axis, curb, dirS, center, half });
  }

  function dropBox(cx, cz, w, d, y) {
    const t = 0.18;
    b.add('yellowPaint', env.yellow, hquad(cx - w / 2, cz - d / 2, cx + w / 2, cz - d / 2 + t, y, 2));
    b.add('yellowPaint', env.yellow, hquad(cx - w / 2, cz + d / 2 - t, cx + w / 2, cz + d / 2, y, 2));
    b.add('yellowPaint', env.yellow, hquad(cx - w / 2, cz - d / 2, cx - w / 2 + t, cz + d / 2, y, 2));
    b.add('yellowPaint', env.yellow, hquad(cx + w / 2 - t, cz - d / 2, cx + w / 2, cz + d / 2, y, 2));
    // Diagonal hatching.
    for (let k = -3; k <= 3; k++) {
      const g = new THREE.PlaneGeometry(0.18, Math.min(w, d) * 0.9);
      g.rotateX(-Math.PI / 2);
      g.rotateY(Math.PI / 4);
      g.translate(cx + k * (w / 8), y + 0.001, cz + k * (d / 8) * 0);
      b.add('yellowPaint', env.yellow, g);
    }
  }

  // ------------------------------------------------- outside the grid
  // Gas station on the inner frontage, a few warehouses along the parkway.
  gasStation(-528, 120, 0);
  for (const [x, z, w, d] of [[-150, -660, 40, 26], [180, -665, 36, 24], [660, -140, 24, 40], [665, 360, 26, 44], [-150, 665, 44, 24], [-665, -380, 26, 40], [-665, 380, 24, 36]]) {
    building(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 9 + rng.next() * 4, rng.pick(['corr0', 'corr1']), { uTile: 6, vTile: 6, roofStuff: true, parapet: false });
    b.add('asphalt', mats.asphalt, hquad(x - w / 2 - 8, z - d / 2 - 8, x + w / 2 + 8, z + d / 2 + 8, 0.012, 8));
  }
  function gasStation(cx, cz, rot) {
    b.add('asphalt', mats.asphalt, hquad(cx - 22, cz - 18, cx + 22, cz + 18, 0.012, 8));
    // Canopy on four columns.
    b.add('stucco1', mats.stucco1, boxAt(24, 1.2, 14, cx, 5.6, cz));
    for (const [dx, dz] of [[-10, -5], [10, -5], [-10, 5], [10, 5]]) {
      b.add('metal', mats.metal, cylAt(0.25, 0.25, 5, cx + dx, 2.5, cz + dz, 10));
      physics?.cylinder(cx + dx, 2.5, cz + dz, 0.3, 2.5);
    }
    for (const dx of [-6, 0, 6]) {
      b.add('hvac', mats.hvac, boxAt(1.2, 1.8, 0.6, cx + dx, 0.9, cz));
      physics?.box(cx + dx, 0.9, cz, 0.6, 0.9, 0.3);
    }
    const uv = atlas.add('GAS & GO', { bg: '#c62828', sub: 'REGULAR 3.49  ·  DIESEL 3.99' });
    signBoard(cx, cz - 7.05, uv, 0, 10, 1.1, 5.6);
    building(cx - 8, cz + 10, cx + 8, cz + 17, 4.2, 'stucco0', { groundH: 4.2, groundKey: 'store0', groundFaces: 'n', roofStuff: false });
  }

  // ------------------------------------------------- the bay to the east
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1400, 4400), waterMaterial());
  water.rotation.x = -Math.PI / 2;
  water.position.set(BAY_X + 700, -0.6, 0);
  water.receiveShadow = true;
  root.add(water);
  // Seawall along the shore.
  b.add('stone', mats.stone, boxAt(3, 2.4, 4400, BAY_X + 1.5, -0.4, 0));
  physics?.box(BAY_X + 1.5, 0.3, 0, 1.5, 1.5, 2200);

  const meshes = b.build(root, { name: 'blocks-' });
  return { solids, parkingSpots, treeSpots, benchSpots, aprons, atlas, water, meshes, mats };
}

function overlaps(a, b) {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0;
}

function waterTower(b, mats, x, y, z) {
  for (const [dx, dz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) b.add('wood', mats.wood, cylAt(0.12, 0.12, 4, x + dx, y + 2, z + dz, 6));
  b.add('wood', mats.wood, cylAt(2.1, 2.1, 4.2, x, y + 6.1, z, 20));
  b.add('darkTrim', mats.darkTrim, new THREE.ConeGeometry(2.3, 1.6, 20).translate(x, y + 9.0, z));
}

function awningMaterial(color) {
  const c = makeCanvas(128, 64);
  const g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 128, 64);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (let x = 0; x < 128; x += 32) g.fillRect(x, 0, 14, 64);
  const t = canvasTexture(c, { repeat: true });
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85, side: THREE.DoubleSide });
}

function rollupDoorMaterial() {
  const c = makeCanvas(128, 128);
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, '#c8ccd0'); grad.addColorStop(1, '#a9adb2');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 8) { g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, y, 128, 2); }
  g.fillStyle = 'rgba(40,50,60,0.8)';
  for (let x = 10; x < 118; x += 22) g.fillRect(x, 40, 16, 10);
  const t = canvasTexture(c);
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, metalness: 0.6 });
}

function clockMaterial() {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  g.fillStyle = '#f3efe4'; g.beginPath(); g.arc(128, 128, 126, 0, 7); g.fill();
  g.strokeStyle = '#222'; g.lineWidth = 8; g.stroke();
  g.fillStyle = '#222';
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.fillRect(128 + Math.cos(a) * 100 - 4, 128 + Math.sin(a) * 100 - 4, 8, 8); }
  g.lineWidth = 7; g.beginPath(); g.moveTo(128, 128); g.lineTo(128, 50); g.stroke();
  g.lineWidth = 5; g.beginPath(); g.moveTo(128, 128); g.lineTo(190, 128); g.stroke();
  return new THREE.MeshStandardMaterial({ map: canvasTexture(c), roughness: 0.5 });
}

function waterMaterial() {
  const c = makeCanvas(256, 256);
  const g = c.getContext('2d');
  const img = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const v = 128 + Math.sin(x * 0.2 + Math.sin(y * 0.07) * 3) * 40 + Math.sin(y * 0.13 + x * 0.05) * 30;
    const i = (y * 256 + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const n = canvasTexture(heightToNormalCanvas(c), { repeat: true, srgb: false });
  n.repeat.set(80, 240);
  return new THREE.MeshPhysicalMaterial({ color: 0x22404f, roughness: 0.06, metalness: 0.0, normalMap: n, normalScale: new THREE.Vector2(0.35, 0.35), clearcoat: 0.6 });
}
import { heightToNormal as heightToNormalCanvas } from '../util.js';
