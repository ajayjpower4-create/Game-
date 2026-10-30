// Ported from ItemsBuilding.lua. Called by items.js with its helpers.
import { CF, V3, v, rad, clamp } from "../core/math.js";
import { Config, rgb, weightClassFor } from "../core/config.js";
import { $add, $sub, $mul, $div, $unm, $fmt, $gsub, $assert } from "../core/lua.js";

export default function (R) {
  let [add, look, CF, v] = [R.add, R.look, R.CF, R.V];
  let [G, C, M, Config] = [R.G, R.C, R.M, R.Config];
  let [idLen, fmtLen] = [R.idLen, R.fmtLen];
  let [panelPlugs, panelFasteners] = [R.panelPlugs, R.panelFasteners];
  let CONCRETE_WET = rgb(104, 102, 98);
  let CONCRETE = rgb(176, 174, 168);
  let DARK = rgb(44, 46, 50);
  let PANEL = rgb(184, 189, 193);
  let GYP = rgb(226, 224, 218);
  let ALU = rgb(150, 156, 162);
  function anchors(w, d, h) {
    return [{ type: "Bolt", pos: v(-w / 2 + 0.08, (h || 0.02), $add($div($unm(d), 2), 0.08)), normal: v(0, 1, 0) }, { type: "Bolt", pos: v(w / 2 - 0.08, (h || 0.02), $add($div($unm(d), 2), 0.08)), normal: v(0, 1, 0) }, { type: "Bolt", pos: v(-w / 2 + 0.08, (h || 0.02), $sub($div(d, 2), 0.08)), normal: v(0, 1, 0) }, { type: "Bolt", pos: v(w / 2 - 0.08, (h || 0.02), $sub($div(d, 2), 0.08)), normal: v(0, 1, 0) }];
  }
  for (const bx of Config.Bays) {
    for (const bz of Config.Bays) {
      add({ id: "SL-CIP-" + idLen(bx) + "-" + idLen(bz), name: $fmt("Composite Slab Pour %.1f × %.1f m (140 mm)", bx, bz), category: "Concrete & Foundations", kind: "Slab", originBottom: true, deliverable: false, tags: ["Slab", "Concrete", "Floor"], overlapIgnore: ["Column", "Deck", "Beam"], weightKg: 2400 * bx * bz * 0.1, sizeM: v(bx, G.SlabTopping, bz), description: $fmt("Normal-weight concrete placed over a fully welded %.1f × %.1f m bay of metal deck with the pump hose (6), then floated and trowelled at four points (7). Cures from dark grey to light grey once finished.", bx, bz), build: (b, def, opts) => {
        let col = ((opts.installed && CONCRETE) || CONCRETE_WET);
        let slab = b.box("Concrete", v(bx - 0.02, G.SlabTopping, bz - 0.02), CF.at(0, G.SlabTopping / 2, 0), col, "Concrete");
        if (!(opts.installed)) {
          slab.refl = 0.06;
        }
      }, fasteners: [{ type: "Screed", pos: v(-bx / 4, G.SlabTopping, -bz / 4), normal: v(0, 1, 0) }, { type: "Screed", pos: v(bx / 4, G.SlabTopping, -bz / 4), normal: v(0, 1, 0) }, { type: "Screed", pos: v(-bx / 4, G.SlabTopping, bz / 4), normal: v(0, 1, 0) }, { type: "Screed", pos: v(bx / 4, G.SlabTopping, bz / 4), normal: v(0, 1, 0) }], minFastenRelease: 0, bayX: bx, bayZ: bz, proxyColor: CONCRETE });
    }
  }
  // slab-on-grade: ground-floor concrete poured on the compacted lot between
  // the footings, also with the pump hose and trowel
  const SOG = 0.15;
  for (const bx of Config.Bays) {
    for (const bz of Config.Bays) {
      add({ id: "SL-SOG-" + idLen(bx) + "-" + idLen(bz), name: $fmt("Slab-on-Grade Pour %.1f × %.1f m (150 mm)", bx, bz), category: "Concrete & Foundations", kind: "Slab", grade: true, originBottom: true, deliverable: false, tags: ["Slab", "Concrete", "Floor", "Ground"], overlapIgnore: ["Column", "Footing", "Scaffold"], weightKg: 2400 * bx * bz * SOG, sizeM: v(bx, SOG, bz), description: $fmt("Ground-floor slab placed straight on the compacted lot inside a %.1f × %.1f m bay of the building grid with the pump hose (6), then floated and trowelled at four points (7). Aim at the ground inside the bay.", bx, bz), build: (b, def, opts) => {
        const col = opts.installed ? CONCRETE : CONCRETE_WET;
        const slab = b.box("Concrete", v(bx - 0.4, SOG, bz - 0.4), CF.at(0, SOG / 2, 0), col, "Concrete");
        if (!opts.installed) slab.refl = 0.06;
        for (const sx of [-1, 1]) b.box("EdgeForm", v(0.05, SOG + 0.03, bz - 0.4), CF.at(sx * (bx / 2 - 0.22), SOG / 2, 0), C.Timber, "Wood", { nc: true });
        for (const sz of [-1, 1]) b.box("EdgeForm", v(bx - 0.4, SOG + 0.03, 0.05), CF.at(0, SOG / 2, sz * (bz / 2 - 0.22)), C.Timber, "Wood", { nc: true });
      }, fasteners: [-1, 1].flatMap((sz) => [-1, 1].map((sx) => ({ type: "Screed", pos: v((sx * bx) / 4, SOG, (sz * bz) / 4), normal: v(0, 1, 0) }))), minFastenRelease: 0, bayX: bx, bayZ: bz, proxyColor: CONCRETE });
    }
  }
  for (const bay of Config.Bays) {
    let W = G.DeckWidth;
    add({ id: "RF-DECK-" + idLen(bay), name: "Roof Deck with Insulation & Membrane — " + fmtLen(bay), category: "Walls & Roofing", kind: "Surface", originBottom: true, tags: ["Deck", "Roof", "Floor"], overlapIgnore: ["Column"], weightKg: 22 * W * bay, sizeM: v(bay, G.SlabTop, W), description: "Type B roof deck sheet with tapered insulation board and a mechanically fastened single-ply membrane, spanning between two roof beams. Medium weight — carry it across the roof.", build: (b) => {
      for (let k = -2; k <= 2; k += 1) {
        b.box("Rib", v(bay, 0.06, 0.05), CF.at(0, 0.03, k * 0.15), C.Galvanized, "Metal", { ns: true });
      }
      b.box("Insulation", v(bay, 0.06, W), CF.at(0, 0.09, 0), rgb(214, 196, 150), "SmoothPlastic", { ns: true });
      b.box("Membrane", v(bay, 0.02, W), CF.at(0, G.SlabTop - 0.01, 0), rgb(226, 228, 228), "SmoothPlastic");
      b.box("Seam", v(bay, 0.006, 0.05), CF.at(0, G.SlabTop + 0.002, W / 2 - 0.03), rgb(200, 202, 202), "SmoothPlastic", { nc: true, ns: true });
    }, surface: { supportTags: { Beam: true }, tile: W }, fasteners: [{ type: "Bolt", pos: v(-bay / 2 + 0.1, G.SlabTop, 0.2), normal: v(0, 1, 0) }, { type: "Bolt", pos: v(bay / 2 - 0.1, G.SlabTop, -0.2), normal: v(0, 1, 0) }], minFastenRelease: 0, proxyColor: rgb(226, 228, 228) });
    add({ id: "RF-PARAPET-" + idLen(bay), name: "Roof Parapet Panel 1.1 m — " + fmtLen(bay), category: "Walls & Roofing", kind: "Span", faceNormal: true, tags: ["Parapet", "Facade", "Roof"], weightKg: 18 * bay * G.ParapetHeight, sizeM: v(bay - 0.02, G.ParapetHeight, 0.25), boundsOffsetM: v(0, G.ParapetHeight / 2, 0.125), description: "Insulated parapet panel with a pressed metal coping, hung on the outside of the roof edge between two columns. Doubles as the roof edge guard.", build: (b) => {
      let w = bay - 0.02;
      b.box("Panel", v(w, G.ParapetHeight - 0.08, 0.1), CF.at(0, (G.ParapetHeight - 0.08) / 2, 0.05), PANEL, "Metal");
      b.box("Coping", v(w, 0.08, 0.32), CF.at(0, G.ParapetHeight - 0.04, 0.06), rgb(120, 124, 128), "Metal");
      b.box("Backer", v(w, G.ParapetHeight - 0.2, 0.04), CF.at(0, G.ParapetHeight / 2 - 0.05, -0.08), rgb(200, 200, 196), "SmoothPlastic", { ns: true });
    }, plugs: [{ type: "ParapetEnd", accepts: ["ParapetSeat"], cf: CF.at(-bay / 2, 0, 0) }, { type: "ParapetEnd", accepts: ["ParapetSeat"], cf: CF.at(bay / 2, 0, 0) }], fasteners: [{ type: "Bolt", pos: v(-bay / 2 + 0.25, 0.3, -0.02), normal: v(0, 0, -1) }, { type: "Bolt", pos: v(bay / 2 - 0.25, 0.3, -0.02), normal: v(0, 0, -1) }], minFastenRelease: 2, liftPoints: [v(-bay / 4, G.ParapetHeight, 0.05), v(bay / 4, G.ParapetHeight, 0.05)], proxyColor: PANEL });
  }
  add({ id: "RF-HATCH", name: "Roof Access Hatch 0.9 × 1.2 m", category: "Windows & Doors", kind: "Rest", originBottom: true, tags: ["Roof"], rest: { grid: 0.05 }, allowFree: true, weightKg: 68, sizeM: v(1.2, 0.35, 0.9), description: "Galvanised curb-mounted roof hatch with a gas-strut lid and safety rail post.", build: (b) => {
    b.box("Curb", v(1.2, 0.3, 0.9), CF.at(0, 0.15, 0), C.Galvanized, "Metal");
    b.box("Lid", v(1.24, 0.05, 0.94), CF.at(0, 0.325, 0), rgb(150, 154, 158), "Metal");
    b.box("RailPost", v(0.05, 1.0, 0.05), CF.at(0.55, 0.8, 0.4), C.Safety, "Metal", { nc: true, ns: true });
  }, fasteners: anchors(1.2, 0.9), minFastenRelease: 0, proxyColor: C.Galvanized });
  add({ id: "RF-SKYLIGHT", name: "Curb Skylight 1.2 × 1.2 m", category: "Windows & Doors", kind: "Rest", originBottom: true, tags: ["Roof", "Window"], rest: { grid: 0.05 }, allowFree: true, weightKg: 55, sizeM: v(1.2, 0.45, 1.2), description: "Domed polycarbonate skylight on an insulated curb.", build: (b) => {
    b.box("Curb", v(1.2, 0.3, 1.2), CF.at(0, 0.15, 0), rgb(220, 220, 216), "Metal");
    b.box("Dome", v(1.1, 0.12, 1.1), CF.at(0, 0.36, 0), C.Glass, "Glass", { tr: 0.35, refl: 0.2 });
    b.box("DomeTop", v(0.8, 0.08, 0.8), CF.at(0, 0.44, 0), C.Glass, "Glass", { tr: 0.35, refl: 0.2, nc: true });
  }, fasteners: anchors(1.2, 1.2), minFastenRelease: 0, proxyColor: C.Glass });
  function wallVariant(code, label, desc, cat, kgPerM2, buildFn, onlyBays) {
    for (const bay of Config.Bays) {
      if ((!(onlyBays) || onlyBays[bay])) {
        for (const H of Config.FloorHeights) {
          let [w, h] = [bay - 0.02, H - 0.02];
          add({ id: code + "-" + idLen(bay) + "-" + idLen(H), name: label + " — " + fmtLen(bay) + " × " + fmtLen(H), category: (cat || "Walls & Roofing"), kind: "Span", faceNormal: true, tags: ["WallPanel", "Facade"], weightKg: $mul($mul(kgPerM2, bay), H), sizeM: v(w, h, 0.16), boundsOffsetM: v(0, H / 2, 0.08), description: desc, build: (b) => {
            buildFn(b, w, h, H, bay);
          }, plugs: panelPlugs(bay), fasteners: panelFasteners(bay, H), minFastenRelease: 2, liftPoints: [v(-bay / 4, H, 0.06), v(bay / 4, H, 0.06)], rigging: "Bridle", proxyColor: PANEL });
        }
      }
    }
  }
  function ribs(b, w, h, H, z, color) {
    let n = Math.floor(w / 1.0);
    for (let k = 0; k <= n; k += 1) {
      b.box("Rib", v(0.035, h, 0.025), CF.at(-w / 2 + 0.1 + k * (w - 0.2) / Math.max(n, 1), H / 2, z), color, undefined, { ns: true, nc: true });
    }
  }
  wallVariant("WP-DOOR", "Metal Wall Panel with Personnel Door", "Insulated metal panel unit with a factory-fitted steel personnel door, frame, closer and canopy. Hangs on the outside face of two columns.", "Windows & Doors", 17, (b, w, h, H) => {
    let [dw, dh] = [1.0, 2.2];
    let dx = -w / 2 + 1.0;
    b.box("SkinLeft", v(dx - dw / 2 + w / 2, h, 0.08), CF.at((-w / 2 + dx - dw / 2) / 2, H / 2, 0.04), PANEL, "Metal");
    b.box("SkinRight", v(w / 2 - (dx + dw / 2), h, 0.08), CF.at((dx + dw / 2 + w / 2) / 2, H / 2, 0.04), PANEL, "Metal");
    b.box("SkinOver", v(dw, h - dh, 0.08), CF.at(dx, dh + (h - dh) / 2, 0.04), PANEL, "Metal");
    b.box("Door", v(dw - 0.08, dh - 0.04, 0.05), CF.at(dx, (dh - 0.04) / 2, 0.06), rgb(72, 92, 112), "Metal");
    b.box("Frame", v(dw + 0.1, 0.06, 0.12), CF.at(dx, dh, 0.06), DARK, "Metal", { nc: true });
    b.box("Handle", v(0.14, 0.03, 0.04), CF.at(dx + 0.35, 1.05, 0.1), rgb(200, 200, 200), "Metal", { nc: true, ns: true });
    b.box("Canopy", v(dw + 0.4, 0.05, 0.6), CF.at(dx, dh + 0.25, 0.35), DARK, "Metal", { nc: true });
    ribs(b, w, h, H, 0.0925, rgb(176, 181, 186));
  });
  wallVariant("WP-WINBAND", "Metal Wall Panel with Window Band", "Insulated metal panel unit with a continuous ribbon window at desk height — the typical low-rise office elevation.", "Windows & Doors", 22, (b, w, h, H) => {
    b.box("SkinLow", v(w, 1.0, 0.08), CF.at(0, 0.5, 0.04), PANEL, "Metal");
    b.box("SkinHigh", v(w, h - 2.2, 0.08), CF.at(0, 2.2 + (h - 2.2) / 2, 0.04), PANEL, "Metal");
    let g = b.box("Glazing", v(w - 0.04, 1.2, 0.03), CF.at(0, 1.6, 0.05), C.Glass, "Glass", { tr: 0.4, refl: 0.15 });
    g.ns = true;
    let n = Math.max(1, Math.floor(w / 1.5 + 0.5));
    for (let k = 0; k <= n; k += 1) {
      b.box("Mullion", v(0.06, 1.24, 0.1), CF.at(-w / 2 + 0.03 + k * (w - 0.06) / n, 1.6, 0.06), DARK, "Metal", { nc: true });
    }
    b.box("Sill", v(w, 0.06, 0.16), CF.at(0, 0.99, 0.08), DARK, "Metal", { nc: true });
  });
  wallVariant("WP-PRECAST", "Precast Concrete Wall Panel", "Architectural precast panel with sandblasted finish and horizontal reveals. Heavy — set it with the crane.", undefined, 360, (b, w, h, H) => {
    b.box("Precast", v(w, h, 0.15), CF.at(0, H / 2, 0.075), rgb(196, 192, 182), "Concrete");
    for (let k = 1; k <= 3; k += 1) {
      b.box("Reveal", v(w, 0.03, 0.01), CF.at(0, k * H / 4, 0.152), rgb(150, 146, 138), "Concrete", { nc: true, ns: true });
    }
  });
  wallVariant("WP-BRICK", "Brick Veneer Wall Panel", "Thin-brick precast panel with a cast stone sill course — residential and civic elevations.", undefined, 300, (b, w, h, H) => {
    b.box("Brick", v(w, h - 0.15, 0.14), CF.at(0, (h - 0.15) / 2 + 0.15, 0.07), rgb(150, 82, 62), "Brick");
    b.box("CastStone", v(w, 0.15, 0.16), CF.at(0, 0.075, 0.08), rgb(214, 206, 188), "Concrete");
  });
  wallVariant("WP-LOUVRE", "Louvre Wall Panel", "Extruded aluminium storm louvre for plant rooms and generator enclosures.", undefined, 14, (b, w, h, H) => {
    b.box("Frame", v(w, h, 0.04), CF.at(0, H / 2, 0.02), DARK, "Metal");
    let n = Math.floor(h / 0.15);
    for (let k = 1; k <= n - 1; k += 1) {
      b.box("Blade", v(w - 0.1, 0.03, 0.12), $mul(CF.at(0, k * h / n, 0.08), CF.angles(rad(-35), 0, 0)), ALU, "Metal", { nc: true, ns: true });
    }
  });
  wallVariant("WP-OHDOOR", "Metal Wall Panel with Overhead Door", "Insulated panel unit framing a 4 m wide sectional overhead door for deliveries and plant.", "Windows & Doors", 20, (b, w, h, H) => {
    let [dw, dh] = [4.0, Math.min(H - 0.6, 3.6)];
    b.box("SkinLeft", v((w - dw) / 2, h, 0.08), CF.at(-w / 2 + (w - dw) / 4, H / 2, 0.04), PANEL, "Metal");
    b.box("SkinRight", v((w - dw) / 2, h, 0.08), CF.at(w / 2 - (w - dw) / 4, H / 2, 0.04), PANEL, "Metal");
    b.box("SkinOver", v(dw, h - dh, 0.08), CF.at(0, dh + (h - dh) / 2, 0.04), PANEL, "Metal");
    for (let k = 0; k <= 5; k += 1) {
      b.box("DoorSection", v(dw - 0.06, dh / 6 - 0.02, 0.05), CF.at(0, k * dh / 6 + dh / 12, 0.05), rgb(210, 212, 214), "Metal");
    }
    b.box("Hood", v(dw + 0.2, 0.3, 0.3), CF.at(0, dh + 0.15, 0.2), DARK, "Metal", { nc: true });
  }, { [6.0]: true, [7.5]: true, [9.0]: true });
  function partition(code, label, desc, buildFn) {
    for (const bay of Config.Bays) {
      for (const H of Config.FloorHeights) {
        let ph = H - G.PartitionClear;
        let w = bay - 0.42;
        add({ id: code + "-" + idLen(bay) + "-" + idLen(H), name: label + " — " + fmtLen(bay) + " bay, " + fmtLen(H) + " storey", category: "Walls & Roofing", kind: "Span", tags: ["Partition", "Interior"], overlapIgnore: ["Slab"], weightKg: 70, weightClass: "Medium", sizeM: v(w, ph, 0.12), boundsOffsetM: v(0, ph / 2, 0), description: desc, build: (b) => {
          buildFn(b, w, ph);
        }, plugs: [{ type: "PartitionEnd", accepts: ["PartitionSeat"], cf: CF.at(-bay / 2, 0, 0) }, { type: "PartitionEnd", accepts: ["PartitionSeat"], cf: CF.at(bay / 2, 0, 0) }], fasteners: [{ type: "Bolt", pos: v(-w / 2 + 0.1, 0.03, 0.07), normal: v(0, 0, 1) }, { type: "Bolt", pos: v(w / 2 - 0.1, 0.03, 0.07), normal: v(0, 0, 1) }], minFastenRelease: 0, symmetric180: true, proxyColor: GYP });
      }
    }
  }
  partition("PT-SOLID", "Demountable Partition (solid)", "Aluminium-framed demountable partition with gypsum faces, spanning between two columns along a grid line. Seats on the finished slab.", (b, w, ph) => {
    b.box("Track", v(w, 0.05, 0.12), CF.at(0, 0.025, 0), ALU, "Metal");
    b.box("Board", v(w, $sub(ph, 0.1), 0.1), CF.at(0, $div(ph, 2), 0), GYP, "SmoothPlastic");
    b.box("Head", v(w, 0.05, 0.12), CF.at(0, $sub(ph, 0.025), 0), ALU, "Metal");
  });
  partition("PT-DOOR", "Demountable Partition with Door", "Demountable partition with a hung timber door set and lever handles.", (b, w, ph) => {
    let [dw, dh] = [0.95, 2.15];
    b.box("Track", v(w, 0.05, 0.12), CF.at(0, 0.025, 0), ALU, "Metal");
    b.box("BoardL", v(w / 2 - dw / 2, $sub(ph, 0.1), 0.1), CF.at(-w / 4 - dw / 4, $div(ph, 2), 0), GYP, "SmoothPlastic");
    b.box("BoardR", v(w / 2 - dw / 2, $sub(ph, 0.1), 0.1), CF.at(w / 4 + dw / 4, $div(ph, 2), 0), GYP, "SmoothPlastic");
    b.box("BoardOver", v(dw, $sub($sub(ph, dh), 0.05), 0.1), CF.at(0, $add(dh, $div($sub(ph, dh), 2)), 0), GYP, "SmoothPlastic");
    b.box("Door", v(dw - 0.06, dh - 0.02, 0.045), CF.at(0, dh / 2, 0.02), rgb(150, 110, 72), "Wood", { nc: true });
    b.box("Lever", v(0.12, 0.02, 0.03), CF.at(0.32, 1.05, 0.06), ALU, "Metal", { nc: true, ns: true });
    b.box("Head", v(w, 0.05, 0.12), CF.at(0, $sub(ph, 0.025), 0), ALU, "Metal");
  });
  partition("PT-GLAZED", "Glazed Office Partition", "Full-height frameless glazed partition with aluminium head and floor tracks.", (b, w, ph) => {
    b.box("Track", v(w, 0.05, 0.12), CF.at(0, 0.025, 0), ALU, "Metal");
    let g = b.box("Glass", v(w - 0.02, $sub(ph, 0.1), 0.02), CF.at(0, $div(ph, 2), 0), C.Glass, "Glass", { tr: 0.55, refl: 0.15 });
    g.ns = true;
    let n = Math.max(1, Math.floor(w / 1.2 + 0.5));
    for (let k = 1; k <= n - 1; k += 1) {
      b.box("Joint", v(0.02, $sub(ph, 0.1), 0.03), CF.at(-w / 2 + k * w / n, $div(ph, 2), 0), ALU, "Metal", { nc: true, ns: true });
    }
    b.box("Head", v(w, 0.05, 0.12), CF.at(0, $sub(ph, 0.025), 0), ALU, "Metal");
    b.box("Manifestation", v(w - 0.1, 0.06, 0.022), CF.at(0, 1.2, 0), rgb(240, 240, 240), "SmoothPlastic", { nc: true, ns: true });
  });
  for (const bay of Config.Bays) {
    for (const style of [["GLASS", "glass balustrade"], ["STEEL", "steel picket railing"]]) {
      let w = bay - 0.1;
      let depth = 1.6;
      add({ id: "BL-CANT-" + idLen(bay) + "-" + style[0], name: $fmt("Cantilever Balcony %.1f m with %s", bay, style[1]), category: "Walls & Roofing", kind: "Span", faceNormal: true, tags: ["Balcony", "Facade"], weightKg: 2400 * w * depth * 0.2 + 120, sizeM: v(w, 1.3, depth), boundsOffsetM: v(0, 0.55, 0.2 + depth / 2), description: "Precast balcony slab on thermally broken cantilever brackets bolted to the floor edge between two columns, with " + style[1] + ".", build: (b) => {
        let z0 = 0.2;
        b.box("Slab", v(w, 0.2, depth), CF.at(0, G.SlabTop - 0.1, z0 + depth / 2), rgb(196, 192, 184), "Concrete");
        b.box("Drip", v(w, 0.04, 0.04), CF.at(0, G.SlabTop - 0.22, z0 + depth - 0.03), rgb(170, 166, 158), "Concrete", { nc: true, ns: true });
        for (const sx of [-1, 1]) {
          b.box("Bracket", v(0.15, 0.25, 0.4), CF.at(sx * (w / 2 - 0.4), G.SlabTop - 0.32, z0 + 0.1), DARK, "Metal", { nc: true, ns: true });
        }
        let railY = G.SlabTop + 0.55;
        if ((style[0] === "GLASS")) {
          let g = b.box("Glass", v(w - 0.1, 1.0, 0.02), CF.at(0, railY, z0 + depth - 0.08), C.Glass, "Glass", { tr: 0.45, refl: 0.2 });
          g.ns = true;
          for (const sx of [-1, 1]) {
            let sg = b.box("SideGlass", v(0.02, 1.0, depth - 0.15), CF.at(sx * (w / 2 - 0.05), railY, z0 + depth / 2), C.Glass, "Glass", { tr: 0.45, refl: 0.2 });
            sg.ns = true;
          }
          b.box("Handrail", v(w - 0.1, 0.05, 0.06), CF.at(0, railY + 0.52, z0 + depth - 0.08), ALU, "Metal", { nc: true });
        } else {
          b.box("Handrail", v(w - 0.1, 0.06, 0.06), CF.at(0, railY + 0.52, z0 + depth - 0.08), DARK, "Metal");
          b.box("BottomRail", v(w - 0.1, 0.04, 0.04), CF.at(0, G.SlabTop + 0.1, z0 + depth - 0.08), DARK, "Metal", { nc: true, ns: true });
          let n = Math.floor((w - 0.1) / 0.12);
          for (let k = 0; k <= n; k += 2) {
            b.box("Picket", v(0.02, 0.95, 0.02), CF.at(-w / 2 + 0.05 + k * (w - 0.1) / n, railY, z0 + depth - 0.08), DARK, "Metal", { nc: true, ns: true });
          }
        }
      }, plugs: panelPlugs(bay), fasteners: [{ type: "Bolt", pos: v(-bay / 2 + 0.45, G.SlabTop - 0.2, 0.3), normal: v(0, 1, 0) }, { type: "Bolt", pos: v(bay / 2 - 0.45, G.SlabTop - 0.2, 0.3), normal: v(0, 1, 0) }], minFastenRelease: 2, liftPoints: [v(-bay / 4, G.SlabTop, 0.95), v(bay / 4, G.SlabTop, 0.95)], proxyColor: rgb(196, 192, 184) });
    }
  }
  for (const H of Config.FloorHeights) {
    for (const width of [1.0, 1.2]) {
      let run = H / Math.tan(rad(37));
      let steps = Math.floor(H / 0.18 + 0.5);
      add({ id: "ST-FLIGHT-" + idLen(H) + "-" + idLen(width), name: $fmt("Steel Stair Flight %.1f m rise, %.1f m wide", H, width), category: "Structural Steel", kind: "Rest", originBottom: true, tags: ["Stair", "Steel"], rest: { grid: 0.1 }, allowFree: true, weightKg: 160 * H + 60 * width, sizeM: v(run + 0.3, H, width + 0.1), boundsOffsetM: v(run / 2, H / 2, 0), description: $fmt("Channel-stringer stair with checker-plate treads and handrails rising %.1f m over %.1f m. Leave a deck opening above it and anchor it to the floor.", H, run), build: (b) => {
        let ang = Math.atan2(H, run);
        let len = Math.sqrt(H * H + run * run);
        for (const sz of [-1, 1]) {
          b.box("Stringer", v(len, 0.25, 0.06), $mul(CF.at(run / 2, H / 2, sz * width / 2), CF.angles(0, 0, ang)), C.PrimerGray, "Metal", { nc: true });
          b.box("Handrail", v(len, 0.05, 0.05), $mul(CF.at(run / 2, H / 2 + 0.95, sz * (width / 2 + 0.02)), CF.angles(0, 0, ang)), C.Safety, "Metal", { nc: true, ns: true });
          for (let k = 0; k <= 3; k += 1) {
            let t = (k + 0.5) / 4;
            b.box("RailPost", v(0.04, 0.95, 0.04), CF.at(run * t, H * t + 0.47, sz * (width / 2 + 0.02)), C.Safety, "Metal", { nc: true, ns: true });
          }
        }
        for (let k = 1; k <= steps; k += 1) {
          let x = (k - 0.5) * run / steps;
          let y = k * H / steps - 0.02;
          b.box("Tread", v(run / steps + 0.03, 0.03, width), CF.at(x, y, 0), C.SteelDark, "DiamondPlate", { nc: true });
        }
        let ramp = b.wedge("WalkRamp", v(width, H, run), $mul(CF.at(run / 2, H / 2, 0), CF.angles(0, Math.PI / 2, 0)), C.SteelDark, "SmoothPlastic", { tr: 1, ns: true });
        ramp.CanQuery = false;
      }, fasteners: [{ type: "Bolt", pos: v(0.1, 0.02, -width / 2 + 0.05), normal: v(0, 1, 0) }, { type: "Bolt", pos: v(0.1, 0.02, width / 2 - 0.05), normal: v(0, 1, 0) }], minFastenRelease: 0, liftPoints: [v(run * 0.25, H * 0.25 + 0.3, 0), v(run * 0.75, H * 0.75 + 0.3, 0)], proxyColor: C.PrimerGray });
    }
  }
  function equipment(id, name, cat, kg, size, desc, buildFn, functional) {
    add({ id: id, name: name, category: cat, kind: "Rest", originBottom: true, tags: ["MEP"], rest: { grid: 0.1 }, allowFree: true, functional: functional, weightKg: kg, sizeM: size, description: desc, build: buildFn, fasteners: anchors(size.x, size.z), minFastenRelease: 0, liftPoints: [v(-size.x / 4, size.y, 0), v(size.x / 4, size.y, 0)], proxyColor: rgb(200, 202, 204) });
  }
  let MEP = "Electrical, Plumbing & HVAC";
  for (const rtu of [[5, 2.4, 1.4, 1.1, 640], [10, 3.4, 1.8, 1.3, 1250], [20, 5.0, 2.3, 1.6, 2300]]) {
    let [tons, L, W, H, kg] = rtu;
    equipment("ME-RTU-" + tons, $fmt("Rooftop Packaged Unit %d ton", tons), MEP, kg, v(L, H, W), $fmt("%d ton packaged heating/cooling unit on a roof curb. Lift it onto the roof with the crane and anchor it.", tons), (b) => {
      b.box("Curb", v(L, 0.3, W), CF.at(0, 0.15, 0), C.Galvanized, "Metal");
      b.box("Cabinet", v(L, $sub(H, 0.3), W), CF.at(0, $add(0.3, $div($sub(H, 0.3), 2)), 0), rgb(214, 214, 208), "Metal");
      b.box("CoilGrille", v($mul(L, 0.4), $mul(H, 0.5), 0.02), CF.at($mul(L, 0.25), $mul(H, 0.55), $add($div(W, 2), 0.01)), DARK, "DiamondPlate", { nc: true, ns: true });
      let n = (((tons >= 10) && 2) || 1);
      for (let k = 1; k <= n; k += 1) {
        b.cylY("Fan", 0.1, $mul(W, 0.6), v($add($div($unm(L), 2), $div($mul(k, L), n + 1)), $add(H, 0.05), 0), DARK, "Metal", { nc: true });
      }
    });
  }
  equipment("ME-AHU", "Air Handling Unit 10 000 m³/h", MEP, 1900, v(4.0, 2.0, 1.8), "Modular indoor air handler with filter, coil and fan sections.", (b) => {
    for (let k = 0; k <= 3; k += 1) {
      b.box("Section", v(0.98, 1.9, 1.8), CF.at(-1.5 + k, 1.0, 0), rgb(190, 196, 200), "Metal");
    }
    b.box("Base", v(4.0, 0.1, 1.8), CF.at(0, 0.05, 0), DARK, "Metal");
    b.box("Duct", v(0.8, 0.8, 0.6), CF.at(1.6, 2.4, 0), C.Galvanized, "Metal");
  });
  equipment("ME-CONDENSER", "Air-Cooled Condensing Unit", MEP, 420, v(1.6, 1.4, 1.0), "Split-system condensing unit with a top-discharge fan.", (b) => {
    b.box("Body", v(1.6, 1.3, 1.0), CF.at(0, 0.75, 0), rgb(220, 220, 216), "Metal");
    b.box("Coil", v(1.5, 1.0, 0.02), CF.at(0, 0.75, 0.51), DARK, "DiamondPlate", { nc: true, ns: true });
    b.cylY("Fan", 0.1, 0.8, v(0, 1.45, 0), DARK, "Metal", { nc: true });
  });
  equipment("ME-EXHFAN", "Roof Exhaust Fan (mushroom)", MEP, 85, v(1.0, 0.9, 1.0), "Centrifugal upblast exhaust fan on a roof curb.", (b) => {
    b.box("Curb", v(1.0, 0.35, 1.0), CF.at(0, 0.175, 0), C.Galvanized, "Metal");
    b.cylY("Hood", 0.4, 0.95, v(0, 0.6, 0), C.Galvanized, "Metal");
    b.cylY("Cap", 0.1, 1.0, v(0, 0.85, 0), C.Galvanized, "Metal");
  });
  equipment("EL-SWITCHBOARD", "Main Switchboard 2000 A", MEP, 1100, v(3.2, 2.3, 0.8), "Free-standing low-voltage switchboard with metering section. Switch it on with F.", (b) => {
    for (let k = 0; k <= 3; k += 1) {
      let cab = b.box("Cabinet" + k, v(0.78, 2.2, 0.8), CF.at(-1.2 + k * 0.8, 1.15, 0), rgb(206, 208, 204), "Metal");
      if ((k === 0)) {
        cab.name = "Lamp1";
      }
      b.box("Door", v(0.7, 2.0, 0.02), CF.at(-1.2 + k * 0.8, 1.15, -0.41), rgb(196, 198, 194), "Metal", { nc: true, ns: true });
    }
    let lens = b.box("Lens1", v(0.06, 0.06, 0.01), CF.at(-1.2, 2.0, -0.42), rgb(60, 220, 90), "Glass", { nc: true, ns: true });
    lens.lens = true;
    b.light(b.parts.find((p) => p.name === "Lamp1"), { type: "point", range: 2, brightness: 1, color: rgb(80, 255, 120) });
    b.box("Plinth", v(3.2, 0.1, 0.8), CF.at(0, 0.05, 0), DARK, "Metal");
  }, "Light");
  equipment("EL-TRANSFORMER", "Pad-Mounted Transformer 1500 kVA", MEP, 4800, v(2.2, 1.9, 2.0), "Utility pad-mount transformer in a tamper-resistant green enclosure.", (b) => {
    b.box("Pad", v(2.4, 0.2, 2.2), CF.at(0, 0.1, 0), CONCRETE, "Concrete");
    b.box("Tank", v(2.0, 1.6, 1.8), CF.at(0, 1.0, 0), rgb(70, 102, 72), "Metal");
    for (let k = -3; k <= 3; k += 1) {
      b.box("Fin", v(0.04, 1.2, 0.3), CF.at(k * 0.28, 1.0, 1.05), rgb(62, 94, 64), "Metal", { nc: true, ns: true });
    }
  });
  equipment("EL-GENSET-STANDBY", "Standby Generator 500 kW (enclosed)", MEP, 6500, v(5.5, 2.4, 1.9), "Permanent standby diesel generator in a weatherproof enclosure. F to test-run.", (b) => {
    b.box("Base", v(5.5, 0.4, 1.9), CF.at(0, 0.2, 0), DARK, "Metal");
    b.box("Enclosure", v(5.4, 2.0, 1.8), CF.at(0, 1.4, 0), rgb(196, 198, 194), "Metal");
    b.box("Louvre", v(1.0, 1.4, 0.02), CF.at(2.2, 1.4, 0.91), DARK, "DiamondPlate", { nc: true, ns: true });
    b.cylY("Muffler", 0.6, 0.3, v(-1.8, 2.7, 0), C.SteelDark, "Metal", { nc: true });
  }, "Engine");
  equipment("PL-WATERHEATER", "Commercial Water Heater 400 L", MEP, 320, v(0.9, 2.0, 0.9), "Gas-fired storage water heater with flue and relief valve.", (b) => {
    b.cylY("Tank", 1.8, 0.85, v(0, 0.95, 0), rgb(70, 110, 160), "Metal");
    b.cylY("Flue", 0.4, 0.2, v(0, 2.05, 0), C.Galvanized, "Metal", { nc: true });
  });
  equipment("PL-FIREPUMP", "Fire Pump Skid 750 gpm", MEP, 1700, v(3.0, 1.4, 1.2), "Horizontal split-case fire pump with electric driver and controller.", (b) => {
    b.box("Skid", v(3.0, 0.15, 1.2), CF.at(0, 0.075, 0), DARK, "Metal");
    b.cylX("Motor", 1.0, 0.7, CF.at(-0.8, 0.6, 0), rgb(200, 40, 34), "Metal");
    b.box("PumpCase", v(0.9, 0.8, 0.8), CF.at(0.5, 0.55, 0), rgb(200, 40, 34), "Metal");
    b.cylX("Suction", 0.6, 0.3, $mul(CF.at(0.5, 0.55, 0.6), CF.angles(0, Math.PI / 2, 0)), rgb(200, 40, 34), "Metal", { nc: true });
    b.box("Controller", v(0.6, 1.2, 0.3), CF.at(1.2, 0.75, -0.4), rgb(200, 40, 34), "Metal");
  });
  equipment("PL-BACKFLOW", "Backflow Preventer Assembly", MEP, 260, v(2.0, 1.2, 0.6), "Reduced-pressure backflow assembly with isolation valves on a stand.", (b) => {
    b.cylX("Body", 1.8, 0.25, CF.at(0, 0.9, 0), rgb(60, 120, 200), "Metal");
    for (const x of [-0.7, 0.7]) {
      b.box("Stand", v(0.08, 0.8, 0.5), CF.at(x, 0.4, 0), DARK, "Metal");
      b.cylY("Valve", 0.35, 0.12, v(x * 0.8, 1.15, 0), rgb(200, 40, 34), "Metal", { nc: true });
    }
  });
  equipment("ME-CABLETRAY-3", "Ladder Cable Tray Section 3 m", MEP, 18, v(3.0, 0.15, 0.6), "Galvanised ladder-type cable tray section on floor stands for risers and plant rooms.", (b) => {
    for (const sz of [-1, 1]) {
      b.box("SideRail", v(3.0, 0.1, 0.03), CF.at(0, 0.1, sz * 0.285), C.Galvanized, "Metal");
    }
    for (let k = 0; k <= 9; k += 1) {
      b.box("Rung", v(0.03, 0.02, 0.57), CF.at(-1.35 + k * 0.3, 0.06, 0), C.Galvanized, "Metal", { nc: true, ns: true });
    }
  });
  equipment("ME-DUCT-RISER", "Ductwork Riser Section 600 × 400", MEP, 40, v(0.6, 3.0, 0.4), "Galvanised rectangular duct riser section with flanged joints.", (b) => {
    b.box("Duct", v(0.6, 3.0, 0.4), CF.at(0, 1.5, 0), C.Galvanized, "Metal");
    for (const y of [0.05, 2.95]) {
      b.box("Flange", v(0.66, 0.06, 0.46), CF.at(0, y, 0), C.Galvanized, "Metal", { nc: true, ns: true });
    }
  });
  equipment("PL-PIPESPOOL", "Pipe Spool Rack (steel pipe)", MEP, 900, v(3.2, 1.2, 1.2), "Fabricated steel pipe spools strapped to a skid, ready to hoist to the floor.", (b) => {
    b.box("Skid", v(3.2, 0.12, 1.2), CF.at(0, 0.06, 0), C.Timber, "Wood");
    for (let i = 0; i <= 2; i += 1) {
      for (let j = 0; j <= 2; j += 1) {
        b.cylX("Pipe", 3.0, 0.3, CF.at(0, 0.3 + i * 0.32, -0.36 + j * 0.36), rgb(70, 74, 78), "Metal");
      }
    }
  });
}
