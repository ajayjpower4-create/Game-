// Site definitions and the deterministic building layout generator.
//
// A site's building is described by a column grid. layout(grid) expands the
// grid into a full blueprint (every footing, column, beam, gusset, brace,
// deck sheet and facade unit with its exact frame). The starting stage is a
// subset of that blueprint installed at load; the rest is what still has to
// be built. Menu previews come from the same data.

import { CF, v, VY, rad } from "../core/math.js";
import { Config, rgb } from "../core/config.js";
import { Registry } from "./items.js";
import { spanCf } from "../sim/buildRules.js";

const G = Config.Geo;

// Trailer bay: frame at the road surface under the middle of the bed,
// bed length along local X, cab toward -X.
const bay = (x, z, yawDeg = 0) => CF.at(x, 0, z).mul(CF.angles(0, rad(yawDeg), 0));
// Railcar spot on the siding: rail head height, deck along +X.
const railSpot = (x, z) => CF.at(x, 0.4, z);

export const SiteOrder = ["EmptyLand", "Office1", "Office2", "Office3", "Office4", "Office5", "Apartment", "HighRise"];

export const SiteDefs = {
  EmptyLand: {
    id: "EmptyLand",
    name: "Empty Land",
    subtitle: "Open graded lot",
    description: "A large graded lot with nothing on it. Set out footings anywhere, erect your own frame and scaffold it — or follow the Starter Frame blueprint.",
    stageText: "Bare ground — start from foundations",
    difficulty: "Beginner",
    equipment: ["Tower crane — 50 m jib, 8 t", "Flatbed deliveries (3 bays)", "Scaffold kit in laydown"],
    style: "Rural",
    lotM: v(120, 0, 90),
    lighting: { clock: 9.6, latitude: 38, haze: 0.9, density: 0.3, tint: rgb(255, 248, 238) },
    crane: { posM: v(-6, 0, 3), heightM: 30, jibM: 50, counterM: 14, maxKg: 8000, fullRadiusM: 18, slewDeg: 200 },
    bays: [bay(14, -33), bay(14, -24.5), bay(14, -16)],
    entryM: v(70, 0, -52),
    spawnM: v(22, 0, -40),
    laydownM: { center: v(-24, 0, -30), size: v(22, 0, 14) },
    blueprints: [
      {
        id: "StarterFrame",
        name: "Starter Frame — 2 × 1 bays",
        grid: {
          originM: v(-36, 0, 14),
          nx: 2,
          nz: 1,
          bayX: 6.0,
          bayZ: 6.0,
          floorH: 4.2,
          floors: 1,
          column: "W12×65",
          beam: "W16×31",
          deck: true,
          braces: [["x", 0, 0]],
          facade: undefined,
        },
      },
      {
        id: "Workshop",
        name: "Two-Storey Workshop — 3 × 2 bays",
        grid: {
          originM: v(-48, 0, 14),
          nx: 3,
          nz: 2,
          bayX: 7.5,
          bayZ: 6.0,
          floorH: 4.5,
          floors: 2,
          column: "W14×90",
          beam: "W18×35",
          deck: true,
          braces: [["x", 0, 0], ["x", 2, 2]],
          facade: "wall",
        },
      },
    ],
    starter: {
      trailer: [["FT-PRECAST-1500", 6], ["COL-W12x65-4200", 6], ["BM-W16x31-6000", 7]],
      laydown: [
        ["DK-15B-6000", 8],
        ["CON-GUSSET-350", 2],
        ["SC-BASEJACK", 4],
        ["SC-STD-2000", 4],
        ["SC-LEDGER-2570", 4],
        ["SC-LEDGER-1090", 4],
        ["SC-DECK-2570", 1],
        ["SC-LADDER-27", 1],
      ],
    },
  },
  Office1: {
    id: "Office1",
    name: "Office 1 — Suburban Business Park",
    subtitle: "Low-rise office",
    description: "A three-storey office in a landscaped business park. Footings are cast and a few starter columns are standing; the rest of the frame is yours.",
    stageText: "Foundations complete, 4 starter columns",
    difficulty: "Beginner",
    equipment: ["Tower crane — 55 m jib, 8 t", "Flatbed deliveries (3 bays)", "Scaffold kit"],
    style: "Suburban",
    lotM: v(150, 0, 110),
    lighting: { clock: 12.2, latitude: 34, haze: 0.6, density: 0.27, tint: rgb(255, 252, 245) },
    crane: { posM: v(14, 0, 10), heightM: 35, jibM: 55, counterM: 15, maxKg: 8000, fullRadiusM: 20, slewDeg: 160 },
    bays: [bay(30, -40), bay(30, -31.5), bay(30, -23)],
    entryM: v(90, 0, -62),
    spawnM: v(36, 0, -48),
    laydownM: { center: v(-8, 0, -34), size: v(24, 0, 14) },
    grid: {
      originM: v(-27, 0, -4),
      nx: 4,
      nz: 3,
      bayX: 7.5,
      bayZ: 7.5,
      floorH: 4.2,
      floors: 3,
      column: "W12×65",
      beam: "W18×35",
      deck: true,
      braces: [["x", 0, 0], ["x", 3, 3], ["z", 0, 1]],
      facade: "wall",
    },
    stage: (e) => {
      if ((e.phase === "footing")) {
        return true;
      }
      return ((((e.phase === "column") && (e.level === 1)) && (e.i <= 1)) && (e.j <= 1));
    },
  },
  Office2: {
    id: "Office2",
    name: "Office 2 — Downtown Corner",
    subtitle: "Mid-rise office",
    description: "A six-storey corner office squeezed between neighbours. The steel skeleton is up four levels with gaps to fill; deliveries stop on the street, so every pick is a crane pick.",
    stageText: "Exposed steel skeleton, levels 1–4",
    difficulty: "Standard",
    equipment: ["Tower crane — 45 m jib, 6 t", "Street-side delivery bay (2)", "Scaffold kit"],
    style: "Downtown",
    lotM: v(46, 0, 42),
    lighting: { clock: 16.4, latitude: 41, haze: 1.6, density: 0.36, tint: rgb(255, 236, 214) },
    crane: { posM: v(16, 0, 14), heightM: 45, jibM: 45, counterM: 13, maxKg: 6000, fullRadiusM: 16, slewDeg: 225 },
    bays: [bay(6, -26), bay(30, 4, 90)],
    entryM: v(-60, 0, -26),
    spawnM: v(-15, 0, -17),
    laydownM: { center: v(-17, 0, -15), size: v(8, 0, 8) },
    grid: {
      originM: v(-12, 0, -7),
      nx: 3,
      nz: 3,
      bayX: 6.0,
      bayZ: 6.0,
      floorH: 4.2,
      floors: 6,
      column: "W14×90",
      beam: "W16×31",
      deck: true,
      braces: [["x", 0, 0], ["z", 3, 1]],
      facade: "curtain",
    },
    stage: (e) => {
      if ((e.phase === "footing")) {
        return true;
      }
      if ((e.phase === "column")) {
        return (e.level <= 4);
      }
      if ((e.phase === "beam")) {
        if ((e.level === 4)) {
          return (e.i + e.j) % 3 !== 0;
        }
        return (e.level <= 3);
      }
      if (((e.phase === "gusset") || (e.phase === "brace"))) {
        return (e.level <= 2);
      }
      return false;
    },
  },
  Office3: {
    id: "Office3",
    name: "Office 3 — Waterfront Offices",
    subtitle: "Large office, facade stage",
    description: "A five-storey waterfront office. Three levels of frame and two floors of deck are in; the glass facade has only just started, leaving the long harbour elevation open.",
    stageText: "Frame L1–3, decks L1–2, facade started",
    difficulty: "Standard",
    equipment: ["Tower crane — 60 m jib, 8 t", "Flatbed deliveries (3 bays)", "Scaffold kit"],
    style: "Waterfront",
    lotM: v(150, 0, 90),
    lighting: { clock: 10.4, latitude: 47, haze: 1.2, density: 0.33, tint: rgb(240, 246, 255) },
    crane: { posM: v(10, 0, 4), heightM: 38, jibM: 60, counterM: 16, maxKg: 8000, fullRadiusM: 20, slewDeg: 150 },
    bays: [bay(40, -32), bay(40, -23.5), bay(15, -32)],
    entryM: v(95, 0, -52),
    spawnM: v(48, 0, -40),
    laydownM: { center: v(-14, 0, -32), size: v(24, 0, 12) },
    grid: {
      originM: v(-38, 0, -6),
      nx: 5,
      nz: 3,
      bayX: 7.5,
      bayZ: 7.5,
      floorH: 4.2,
      floors: 5,
      column: "W14×90",
      beam: "W18×35",
      deck: true,
      braces: [["x", 0, 0], ["x", 4, 0]],
      facade: "curtain",
    },
    stage: (e) => {
      if ((e.phase === "footing")) {
        return true;
      }
      if (((((e.phase === "column") || (e.phase === "beam")) || (e.phase === "gusset")) || (e.phase === "brace"))) {
        return (e.level <= 3);
      }
      if ((e.phase === "deck")) {
        return (e.level <= 2);
      }
      if ((e.phase === "facade")) {
        return (((e.level === 1) && (e.side === "-Z")) && (e.i <= 2));
      }
      return false;
    },
  },
  Office4: {
    id: "Office4",
    name: "Office 4 — Industrial District",
    subtitle: "Wide two-storey office",
    description: "A long, wide office between warehouses and the freight line. Ground-floor framing is incomplete and the metal wall cladding is only on part of the west and south walls.",
    stageText: "Partial frame L1, metal walls started",
    difficulty: "Standard",
    equipment: ["Tower crane — 65 m jib, 10 t", "Flatbed deliveries (3 bays)", "Rail siding — 2 flatcar spots"],
    style: "Industrial",
    lotM: v(170, 0, 110),
    lighting: { clock: 14.8, latitude: 42, haze: 2.0, density: 0.38, tint: rgb(255, 244, 226) },
    crane: { posM: v(6, 0, 14), heightM: 32, jibM: 65, counterM: 17, maxKg: 10000, fullRadiusM: 22, slewDeg: 270 },
    bays: [bay(40, -38), bay(40, -29.5), bay(40, -21)],
    entryM: v(100, 0, -62),
    spawnM: v(50, 0, -46),
    laydownM: { center: v(-20, 0, -34), size: v(26, 0, 14) },
    rail: true,
    railSpots: [railSpot(-14, 63), railSpot(6, 63)],
    grid: {
      originM: v(-27, 0, -9),
      nx: 6,
      nz: 2,
      bayX: 9.0,
      bayZ: 9.0,
      floorH: 4.5,
      floors: 2,
      column: "W14×90",
      beam: "W21×44",
      deck: true,
      braces: [["x", 0, 0], ["x", 5, 0], ["x", 0, 2], ["x", 5, 2]],
      facade: "wall",
    },
    stage: (e) => {
      if ((e.phase === "footing")) {
        return true;
      }
      if ((e.phase === "column")) {
        return (e.level === 1);
      }
      if ((e.phase === "beam")) {
        return ((e.level === 1) && ((e.i <= 3) || ((e.dir === "z") && (e.i === 4))));
      }
      if (((e.phase === "gusset") || (e.phase === "brace"))) {
        return ((e.level === 1) && (e.i === 0));
      }
      if ((e.phase === "facade")) {
        return ((e.level === 1) && ((e.side === "-X") || ((e.side === "-Z") && (e.i <= 1))));
      }
      return false;
    },
  },
  Office5: {
    id: "Office5",
    name: "Office 5 — City Center Tower",
    subtitle: "Twelve-storey office tower",
    description: "A slender tower in the financial district. Six levels of frame and five floors of deck are complete; the upper floors are open and every member goes up by crane.",
    stageText: "Frame L1–6, decks L1–5, open upper floors",
    difficulty: "Advanced",
    equipment: ["Tower crane — 55 m jib on a 70 m mast", "Street delivery bays (2)", "Scaffold kit"],
    style: "CityCenter",
    lotM: v(60, 0, 56),
    lighting: { clock: 17.6, latitude: 40, haze: 2.2, density: 0.4, tint: rgb(255, 226, 196) },
    crane: { posM: v(17, 0, 16), heightM: 70, jibM: 55, counterM: 15, maxKg: 8000, fullRadiusM: 18, slewDeg: 225 },
    bays: [bay(2, -33), bay(36, 0, 90)],
    entryM: v(-70, 0, -33),
    spawnM: v(-20, 0, -22),
    laydownM: { center: v(-20, 0, -20), size: v(12, 0, 8) },
    grid: {
      originM: v(-12, 0, -11),
      nx: 3,
      nz: 3,
      bayX: 7.5,
      bayZ: 7.5,
      floorH: 4.2,
      floors: 12,
      column: "W14×90",
      beam: "W18×35",
      deck: true,
      braces: [["x", 1, 0], ["x", 1, 3], ["z", 0, 1], ["z", 3, 1]],
      facade: "curtain",
    },
    stage: (e) => {
      if ((e.phase === "footing")) {
        return true;
      }
      if (((((e.phase === "column") || (e.phase === "beam")) || (e.phase === "gusset")) || (e.phase === "brace"))) {
        return (e.level <= 6);
      }
      if ((e.phase === "deck")) {
        return (e.level <= 5);
      }
      if ((e.phase === "facade")) {
        return (e.level <= 2);
      }
      return false;
    },
  },
  Apartment: {
    id: "Apartment",
    name: "Apartment Building",
    subtitle: "Six-storey residential",
    description: "A long residential block with repeated floor plates. The first three floors are framed and decked; facade units are going on. Interior partitions, balconies and fittings arrive in Phase 2.",
    stageText: "Frame + decks L1–3, facade on L1",
    difficulty: "Standard",
    equipment: ["Tower crane — 55 m jib, 8 t", "Flatbed deliveries (3 bays)", "Scaffold kit"],
    style: "Residential",
    lotM: v(120, 0, 80),
    lighting: { clock: 8.4, latitude: 45, haze: 1.4, density: 0.34, tint: rgb(255, 238, 220) },
    crane: { posM: v(0, 0, 16), heightM: 36, jibM: 55, counterM: 15, maxKg: 8000, fullRadiusM: 20, slewDeg: 180 },
    bays: [bay(26, -28), bay(26, -19.5), bay(0, -28)],
    entryM: v(80, 0, -46),
    spawnM: v(34, 0, -36),
    laydownM: { center: v(-26, 0, -26), size: v(20, 0, 12) },
    grid: {
      originM: v(-15, 0, -2),
      nx: 5,
      nz: 2,
      bayX: 6.0,
      bayZ: 6.0,
      floorH: 3.6,
      floors: 6,
      column: "W12×65",
      beam: "W16×31",
      deck: true,
      braces: [["x", 0, 0], ["x", 4, 2]],
      facade: "mixed",
      balconies: true,
    },
    stage: (e) => {
      if ((e.phase === "footing")) {
        return true;
      }
      if ((((((e.phase === "column") || (e.phase === "beam")) || (e.phase === "deck")) || (e.phase === "gusset")) || (e.phase === "brace"))) {
        return (e.level <= 3);
      }
      if ((e.phase === "facade")) {
        return (e.level === 1);
      }
      return false;
    },
  },
  HighRise: {
    id: "HighRise",
    name: "High-Rise Building",
    subtitle: "Twenty-storey tower",
    description: "A large twenty-storey tower built floor by floor. Four levels of frame are standing; lifting materials to the working floor is the job, with long hoists and plenty of sway to manage.",
    stageText: "Frame L1–4, decks L1–3",
    difficulty: "Expert",
    equipment: ["Tower crane — 60 m jib on a 100 m mast", "Flatbed deliveries (3 bays)", "Scaffold kit"],
    style: "HighRise",
    lotM: v(90, 0, 80),
    lighting: { clock: 11.0, latitude: 36, haze: 1.8, density: 0.36, tint: rgb(250, 248, 244) },
    crane: { posM: v(24, 0, 20), heightM: 100, jibM: 60, counterM: 18, maxKg: 10000, fullRadiusM: 22, slewDeg: 210 },
    bays: [bay(16, -32), bay(16, -23.5), bay(40, -10, 90)],
    entryM: v(80, 0, -50),
    spawnM: v(30, 0, -38),
    laydownM: { center: v(36, 0, 34), size: v(12, 0, 10) },
    grid: {
      originM: v(-15, 0, -14),
      nx: 4,
      nz: 4,
      bayX: 7.5,
      bayZ: 7.5,
      floorH: 4.2,
      floors: 20,
      column: "W14×90",
      beam: "W21×44",
      deck: true,
      braces: [["x", 1, 0], ["x", 2, 4], ["z", 0, 1], ["z", 4, 2]],
      facade: "curtain",
    },
    stage: (e) => {
      if ((e.phase === "footing")) {
        return true;
      }
      if (((((e.phase === "column") || (e.phase === "beam")) || (e.phase === "gusset")) || (e.phase === "brace"))) {
        return (e.level <= 4);
      }
      if ((e.phase === "deck")) {
        return (e.level <= 3);
      }
      return false;
    },
  },
};

function gussetCf(colBase, gridPos, dir, high, L) {
  const y = high ? colBase + L - G.GussetHighFromTop : colBase + G.GussetLow;
  return CF.lookAlong(v(gridPos.x, y, gridPos.z).add(dir.mul(G.SeatOffset)), dir);
}

const FACES = (grid) => [
  { side: "-Z", n: v(0, 0, -1), along: "x", fixed: 0 },
  { side: "+Z", n: v(0, 0, 1), along: "x", fixed: grid.nz },
  { side: "-X", n: v(-1, 0, 0), along: "z", fixed: 0 },
  { side: "+X", n: v(1, 0, 0), along: "z", fixed: grid.nx },
];

const mm = (m) => Math.floor(m * 1000 + 0.5);

// Expands a grid into blueprint entries:
// { key, item, cf, phase, level, i, j, dir, side, group }
export function layout(grid) {
  const entries = [];
  const O = grid.originM;
  const bx = grid.bayX, bz = grid.bayZ, L = grid.floorH;
  const y0 = G.FootingTop;
  const colId = Registry.find("column", grid.column, grid.floorH);
  const beamX = Registry.find("beam", grid.beam, grid.bayX);
  const beamZ = Registry.find("beam", grid.beam, grid.bayZ);
  const d = Registry.get(beamX).profile.d;
  const footing = Registry.find("footing", grid.bayX >= 9 ? 2.0 : 1.5);
  const gp = (i, j) => v(O.x + i * bx, 0, O.z + j * bz);
  const push = (e) => {
    e.key = `${e.phase}:${e.level}:${e.i}:${e.j}:${e.dir || ""}:${e.side || ""}`;
    entries.push(e);
  };

  for (let i = 0; i <= grid.nx; i++) for (let j = 0; j <= grid.nz; j++) push({ phase: "footing", level: 0, i, j, item: footing, cf: CF.from(gp(i, j)) });

  for (let k = 1; k <= grid.floors; k++) {
    const base = y0 + (k - 1) * L;
    const top = base + L;
    for (let i = 0; i <= grid.nx; i++) {
      for (let j = 0; j <= grid.nz; j++) {
        const p = gp(i, j);
        push({ phase: "column", level: k, i, j, item: colId, cf: CF.at(p.x, base + L / 2, p.z) });
      }
    }
    // beams along X
    for (let i = 0; i < grid.nx; i++) {
      for (let j = 0; j <= grid.nz; j++) {
        const c = gp(i, j).add(gp(i + 1, j)).mul(0.5);
        push({ phase: "beam", level: k, i, j, dir: "x", item: beamX, cf: CF.at(c.x, top - d / 2, c.z) });
      }
    }
    // beams along Z
    for (let i = 0; i <= grid.nx; i++) {
      for (let j = 0; j < grid.nz; j++) {
        const c = gp(i, j).add(gp(i, j + 1)).mul(0.5);
        push({ phase: "beam", level: k, i, j, dir: "z", item: beamZ, cf: CF.at(c.x, top - d / 2, c.z).mul(CF.angles(0, Math.PI / 2, 0)) });
      }
    }
    // braced bays: ["x", i, j] = bay along X starting at column (i, j)
    for (const [dirName, bi, bj] of grid.braces || []) {
      const a = gp(bi, bj);
      const b = dirName === "x" ? gp(bi + 1, bj) : gp(bi, bj + 1);
      const valid = (dirName === "x" && bi < grid.nx && bj <= grid.nz) || (dirName === "z" && bj < grid.nz && bi <= grid.nx);
      if (!valid) continue;
      const dir = b.sub(a).unit();
      const gA = gussetCf(base, a, dir, false, L);
      const gB = gussetCf(base, b, dir.neg(), true, L);
      push({ phase: "gusset", level: k, i: bi, j: bj, dir: dirName, side: "A", item: "CON-GUSSET-350", cf: gA });
      push({ phase: "gusset", level: k, i: bi, j: bj, dir: dirName, side: "B", item: "CON-GUSSET-350", cf: gB });
      const braceId = Registry.find("brace", dirName === "x" ? grid.bayX : grid.bayZ, grid.floorH);
      const braceDef = Registry.get(braceId);
      if (braceDef) {
        const seatA = gA.mul(CF.at(0, 0, -G.GussetTip)).pos;
        const seatB = gB.mul(CF.at(0, 0, -G.GussetTip)).pos;
        push({ phase: "brace", level: k, i: bi, j: bj, dir: dirName, item: braceId, cf: spanCf(braceDef.plugs[0].cf.pos, braceDef.plugs[1].cf.pos, seatA, seatB) });
      }
    }
    // deck sheets spanning X in every bay; the top level is the roof
    const isRoof = k === grid.floors;
    if (grid.deck) {
      const deckId = isRoof ? "RF-DECK-" + mm(grid.bayX) : Registry.find("deck", grid.bayX);
      const W = G.DeckWidth;
      const n = Math.floor(bz / W + 0.5);
      const slabId = `SL-CIP-${mm(grid.bayX)}-${mm(grid.bayZ)}`;
      for (let i = 0; i < grid.nx; i++) {
        for (let j = 0; j < grid.nz; j++) {
          const a = gp(i, j);
          for (let t = 0; t < n; t++) {
            push({ phase: "deck", level: k, i, j, dir: String(t), item: deckId, cf: CF.at(a.x + bx / 2, top, a.z + (t + 0.5) * W), group: `deck:${k}:${i}:${j}` });
          }
          if (!isRoof && Registry.get(slabId)) push({ phase: "slab", level: k, i, j, item: slabId, cf: CF.at(a.x + bx / 2, top + G.DeckDepth, a.z + bz / 2) });
        }
      }
    }
    const rc = G.CladOffset;
    const edgeSpan = (f, t, y, item, phase, extra) => {
      const [a, b] = f.along === "x" ? [gp(t, f.fixed), gp(t + 1, f.fixed)] : [gp(f.fixed, t), gp(f.fixed, t + 1)];
      let sa = v(a.x, y, a.z).add(f.n.mul(rc));
      let sb = v(b.x, y, b.z).add(f.n.mul(rc));
      if (sb.sub(sa).cross(VY).dot(f.n) < 0) [sa, sb] = [sb, sa];
      const def = Registry.get(item);
      if (!def) return;
      const [ii, jj] = f.along === "z" ? [f.fixed, t] : [t, f.fixed];
      push({ phase, level: k, i: ii, j: jj, side: f.side, dir: extra, item, cf: spanCf(def.plugs[0].cf.pos, def.plugs[1].cf.pos, sa, sb) });
    };
    // facade on the four perimeter faces
    if (grid.facade) {
      for (const f of FACES(grid)) {
        const count = f.along === "x" ? grid.nx : grid.nz;
        const bayLen = f.along === "x" ? grid.bayX : grid.bayZ;
        for (let t = 0; t < count; t++) {
          let kind = grid.facade;
          if (kind === "mixed") kind = (t + k) % 2 === 0 ? "curtain" : "wall";
          edgeSpan(f, t, base, Registry.find(kind, bayLen, grid.floorH), "facade");
        }
      }
    }
    // roof parapets on the top level, balconies on residential floors
    if (isRoof) {
      for (const f of FACES(grid)) {
        const count = f.along === "x" ? grid.nx : grid.nz;
        const bayLen = f.along === "x" ? grid.bayX : grid.bayZ;
        for (let t = 0; t < count; t++) edgeSpan(f, t, top + G.SlabTop, "RF-PARAPET-" + mm(bayLen), "parapet");
      }
    }
    if (grid.balconies && k >= 2) {
      const f = FACES(grid)[1];
      for (let t = 0; t < grid.nx; t++) {
        if ((t + k) % 2 === 0) edgeSpan(f, t, base, `BL-CANT-${mm(grid.bayX)}-${t % 4 === 0 ? "STEEL" : "GLASS"}`, "balcony");
      }
    }
  }
  return entries;
}

// Build order used for the task panel and "next work package" deliveries.
export const PhaseOrder = { footing: 1, column: 2, beam: 3, gusset: 4, brace: 5, deck: 6, slab: 7, facade: 8, balcony: 9, parapet: 10 };

export function sortEntries(entries) {
  return entries.sort((a, b) => {
    if (a.level !== b.level) {
      if (a.phase === "footing" || b.phase === "footing") return a.phase === "footing" ? -1 : 1;
      return a.level - b.level;
    }
    const pa = PhaseOrder[a.phase], pb = PhaseOrder[b.phase];
    if (pa !== pb) return pa - pb;
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  });
}

export const getSite = (id) => SiteDefs[id];

// Main grid of a site, or a blueprint grid for free-build sites.
export function blueprintGrid(site, blueprintId) {
  if (site.grid && (!blueprintId || blueprintId === "Site")) return site.grid;
  const bp = (site.blueprints || []).find((b) => b.id === blueprintId);
  return bp ? bp.grid : site.grid;
}

export function stageEntries(site) {
  if (!site.grid || !site.stage) return [];
  const entries = layout(site.grid);
  // floors whose deck is in the starting stage get their concrete too,
  // except the newest decked floor (still being worked on)
  let topDeck = 0;
  for (const e of entries) if (e.phase === "deck" && site.stage(e)) topDeck = Math.max(topDeck, e.level);
  return entries.filter((e) => (e.phase === "slab" ? e.level < topDeck : site.stage(e)));
}

export function siteBounds(site) {
  const half = site.lotM.mul(0.5);
  return { min: v(-half.x, -20, -half.z), max: v(half.x, 700, half.z) };
}
