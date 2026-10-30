// Item registry ported from the Roblox build (ItemRegistry.lua). Definitions
// are in metres; every entry has a working model builder and behaviour.
import { CF, V3, v, rad, clamp } from "../core/math.js";
import { Config, rgb, weightClassFor } from "../core/config.js";
import { $add, $sub, $mul, $div, $unm, $fmt, $gsub, $assert } from "../core/lua.js";
import itemsBuilding from "./itemsBuilding.js";
import itemsSite from "./itemsSite.js";

const C = Config.Colors;
const G = Config.Geo;
const M = new Proxy({}, { get: (_, k) => k });
export const Registry = {};
Registry.items = {};
Registry.list = [];
Registry.Categories = ["Structural Steel", "Concrete & Foundations", "Walls & Roofing", "Windows & Doors", "Scaffolding", "Connections & Rigging", "Tools", "Machinery", "Electrical, Plumbing & HVAC", "Site Safety", "Site Furnishings"];
Registry.Classes = { Installable: "Installable component", Equipment: "Functional equipment", Decorative: "Decorative prop", Tool: "Hand tool" };
let DIRS = [{ name: "+X", v: v(1, 0, 0) }, { name: "-X", v: v(-1, 0, 0) }, { name: "+Z", v: v(0, 0, 1) }, { name: "-Z", v: v(0, 0, -1) }];
function look(pos, dir) {
  return CF.lookAlong(pos, dir);
}
function set(list) {
  let t = {};
  for (const v of (list || [])) {
    t[v] = true;
  }
  return t;
}
function add(def) {
  $assert((def.id && !(Registry.items[def.id])), "duplicate or missing id " + String(def.id));
  def.class = (def.class || "Installable");
  def.tags = set(def.tags);
  def.overlapIgnore = set(def.overlapIgnore);
  def.boundsOffsetM = (def.boundsOffsetM || v(0, ((def.originBottom && def.sizeM.y / 2) || 0), 0));
  def.size = def.sizeM;
  def.boundsOffset = def.boundsOffsetM;
  def.weightClass = (def.weightClass || weightClassFor((def.weightKg || 0)));
  def.handling = Config.WeightClasses[def.weightClass].label;
  def.deliverable = ((def.class !== "Tool") && (def.deliverable !== false));
  def.fasteners = (def.fasteners || []);
  def.minFastenRelease = (def.minFastenRelease || Math.min(2, (def.fasteners).length));
  def.rigging = (def.rigging || "Bridle");
  def.transport = (def.transport || new CF());
  def.rotStep = (def.rotStep || 90);
  for (const list of [(def.plugs || []), (def.sockets || []), (def.requireSockets || [])]) {
    for (const s of list) {
      s.cfS = s.cf;
      if (s.accepts) {
        s.acceptSet = set(s.accepts);
      }
    }
  }
  def.plugs = (def.plugs || []);
  def.sockets = (def.sockets || []);
  def.liftPoints = (def.liftPoints || [v(0, def.sizeM.y / 2 + (((def.originBottom && def.sizeM.y / 2) || 0)), 0)]);
  def.liftPointsS = def.liftPoints;
  if (((def.kind === "Span") && ((def.plugs).length === 2))) {
    let [a, b] = [def.plugs[0].cfS.pos, def.plugs[1].cfS.pos];
    def.spanVector = $sub(b, a);
    def.spanLength = $sub(b, a).len;
  }
  Registry.items[def.id] = def;
  Registry.list.push(def);
  return def;
}
let BEAMS = [{ name: "W8×18", d: 0.207, bf: 0.133, tf: 0.0084, tw: 0.0058, kgm: 26.8 }, { name: "W10×26", d: 0.262, bf: 0.147, tf: 0.0112, tw: 0.0066, kgm: 38.7 }, { name: "W12×26", d: 0.310, bf: 0.165, tf: 0.0097, tw: 0.0058, kgm: 38.7 }, { name: "W14×22", d: 0.349, bf: 0.127, tf: 0.0085, tw: 0.0058, kgm: 32.7 }, { name: "W16×31", d: 0.403, bf: 0.140, tf: 0.0112, tw: 0.0070, kgm: 46.1 }, { name: "W18×35", d: 0.450, bf: 0.152, tf: 0.0108, tw: 0.0076, kgm: 52.1 }, { name: "W21×44", d: 0.526, bf: 0.165, tf: 0.0114, tw: 0.0089, kgm: 65.5 }, { name: "W24×55", d: 0.599, bf: 0.178, tf: 0.0128, tw: 0.0100, kgm: 81.8 }, { name: "W27×84", d: 0.678, bf: 0.253, tf: 0.0163, tw: 0.0117, kgm: 125.0 }, { name: "W30×99", d: 0.753, bf: 0.266, tf: 0.0170, tw: 0.0132, kgm: 147.0 }];
let COLUMNS = [{ name: "W8×31", d: 0.203, bf: 0.203, tf: 0.0110, tw: 0.0072, kgm: 46.1 }, { name: "W10×49", d: 0.253, bf: 0.254, tf: 0.0142, tw: 0.0086, kgm: 72.9 }, { name: "W12×65", d: 0.308, bf: 0.305, tf: 0.0154, tw: 0.0099, kgm: 96.7 }, { name: "W14×90", d: 0.356, bf: 0.369, tf: 0.0180, tw: 0.0112, kgm: 134.0 }, { name: "W14×120", d: 0.368, bf: 0.373, tf: 0.0239, tw: 0.0150, kgm: 179.0 }];
Registry.BeamProfiles = BEAMS;
Registry.ColumnProfiles = COLUMNS;
function fmtLen(m) {
  return $fmt("%.1f m", m);
}
function idLen(m) {
  return String(Math.floor(m * 1000 + 0.5));
}
function buildColumn(b, def, opts) {
  let [p, L] = [def.profile, def.lengthM];
  let col = C.PrimerGray;
  let bp = def.basePlateM;
  let shaftLen = L - 0.025 - 0.012;
  b.wShape("Shaft", shaftLen, { d: p.d, bf: p.bf, tf: p.tf, tw: p.tw, axis: "Y" }, CF.at(0, -L / 2 + 0.025 + shaftLen / 2, 0), col);
  b.box("BasePlate", v(bp, 0.025, bp), CF.at(0, -L / 2 + 0.0125, 0), C.MillSteel);
  b.box("CapPlate", v(p.d + 0.02, 0.012, p.bf + 0.02), CF.at(0, L / 2 - 0.006, 0), col);
  let r = G.SeatOffset;
  let tabH = 0.24;
  let tabY = L / 2 - 0.08 - tabH / 2;
  for (const sx of [1, -1]) {
    let [x0, x1] = [p.d / 2, r + 0.07];
    b.box("ShearTab", v(x1 - x0, tabH, 0.01), CF.at(sx * (x0 + x1) / 2, tabY, 0.009), col, undefined, { nc: true });
  }
  for (const sz of [1, -1]) {
    let [z0, z1] = [p.tw / 2, r + 0.07];
    b.box("ShearTab", v(0.01, tabH, z1 - z0), CF.at(0.009, tabY, sz * (z0 + z1) / 2), col, undefined, { nc: true });
  }
  if (!(opts.installed)) {
    b.box("LiftLug", v(0.02, 0.12, 0.14), CF.at(0, L / 2 + 0.06, 0), C.MillSteel, undefined, { nc: true });
  }
  b.stencil($mul(CF.at(p.d / 2 + 0.001, -L / 2 + 0.9, 0), CF.angles(0, Math.PI / 2, 0)), 0.16, 0.05);
}
function columnSockets(L) {
  let sockets = [{ type: "ColumnTop", cf: CF.at(0, L / 2, 0) }];
  for (const d of DIRS) {
    sockets.push({ type: "BeamSeat", cf: look($add(v(0, L / 2, 0), $mul(d.v, G.SeatOffset)), d.v) });
    sockets.push({ type: "GussetMount", cf: look($add(v(0, -L / 2 + G.GussetLow, 0), $mul(d.v, G.SeatOffset)), d.v) });
    sockets.push({ type: "GussetMount", cf: look($add(v(0, L / 2 - G.GussetHighFromTop, 0), $mul(d.v, G.SeatOffset)), d.v) });
    sockets.push({ type: "CladSeat", multi: true, cf: look($add(v(0, -L / 2, 0), $mul(d.v, G.CladOffset)), d.v) });
    sockets.push({ type: "ParapetSeat", multi: true, cf: look($add(v(0, L / 2 + G.SlabTop, 0), $mul(d.v, G.CladOffset)), d.v) });
  }
  sockets.push({ type: "PartitionSeat", multi: true, cf: CF.at(0, -L / 2 + G.SlabTop, 0) });
  return sockets;
}
for (const prof of COLUMNS) {
  for (const L of Config.FloorHeights) {
    let bp = Math.max(prof.d, prof.bf) + 0.15;
    let a = bp / 2 - 0.06;
    add({ id: "COL-" + $gsub(prof.name, "×", "x") + "-" + idLen(L), name: "Steel Column " + prof.name + " — " + fmtLen(L), category: "Structural Steel", kind: "Point", tags: ["Column", "Steel", "Structural"], profile: prof, lengthM: L, basePlateM: bp, weightKg: prof.kgm * L + 25, sizeM: v(bp, L, bp), description: $fmt("Wide-flange column for a %.1f m storey. Seats on a footing or splices onto the column below; shop-welded shear tabs take beams on all four faces. Lifted by its top lug so it hangs plumb.", L), build: buildColumn, plugs: [{ type: "ColumnBottom", accepts: ["FootingTop", "ColumnTop"], cf: CF.at(0, -L / 2, 0) }], sockets: columnSockets(L), fasteners: [{ type: "Bolt", pos: v(a, -L / 2 + 0.04, a), normal: v(0, 1, 0) }, { type: "Bolt", pos: v(-a, -L / 2 + 0.04, a), normal: v(0, 1, 0) }, { type: "Bolt", pos: v(a, -L / 2 + 0.04, -a), normal: v(0, 1, 0) }, { type: "Bolt", pos: v(-a, -L / 2 + 0.04, -a), normal: v(0, 1, 0) }], minFastenRelease: 4, liftPoints: [v(0, L / 2 + 0.1, 0)], rigging: "Upright", transport: CF.angles(0, 0, Math.PI / 2), proxyColor: C.PrimerGray });
  }
}
function buildBeam(b, def) {
  let [p, len] = [def.profile, def.lengthM];
  b.wShape("Beam", len, { d: p.d, bf: p.bf, tf: p.tf, tw: p.tw }, new CF(), C.PrimerGray);
  b.stencil(CF.at(len / 2 - 0.6, 0, -p.tw / 2 - 0.001), 0.18, 0.05);
}
for (const prof of BEAMS) {
  for (const bay of Config.Bays) {
    let len = bay - 2 * G.SeatOffset;
    let n = (((prof.d > 0.45) && 4) || 3);
    let fasteners = [];
    for (const sx of [-1, 1]) {
      for (let k = 0; k <= n - 1; k += 1) {
        fasteners.push({ type: "Bolt", pos: v(sx * (len / 2 - 0.045), (k - (n - 1) / 2) * 0.075, -(prof.tw / 2 + 0.012)), normal: v(0, 0, -1) });
      }
    }
    add({ id: "BM-" + $gsub(prof.name, "×", "x") + "-" + idLen(bay), name: "Steel Beam " + prof.name + " — " + fmtLen(bay) + " bay", category: "Structural Steel", kind: "Span", tags: ["Beam", "Steel", "Structural"], profile: prof, lengthM: len, bayM: bay, weightKg: prof.kgm * len, sizeM: v(len, prof.d, prof.bf), description: $fmt("%s floor beam for a %.1f m column-to-column bay (%.2f m cut length). Bolts to the column shear tabs at both ends; deck spans between parallel beams.", prof.name, bay, len), build: buildBeam, plugs: [{ type: "BeamEnd", accepts: ["BeamSeat"], cf: CF.at(-len / 2, prof.d / 2, 0) }, { type: "BeamEnd", accepts: ["BeamSeat"], cf: CF.at(len / 2, prof.d / 2, 0) }], fasteners: fasteners, minFastenRelease: 2, liftPoints: [v(-len / 4, prof.d / 2, 0), v(len / 4, prof.d / 2, 0)], rigging: "Bridle", symmetric180: true, proxyColor: C.PrimerGray });
  }
}
add({ id: "CON-GUSSET-350", name: "Brace Gusset Plate 350 mm", category: "Connections & Rigging", kind: "Point", tags: ["Plate", "Steel", "Connection"], weightKg: 17, sizeM: v(0.12, 0.32, 0.36), boundsOffsetM: v(0, 0, -0.18), description: "Shop-cut gusset with a bolted clip angle. Bolts to a column gusset mount and provides the seat a diagonal brace connects to.", build: (b) => {
  b.box("Plate", v(0.016, 0.32, 0.36), CF.at(0, 0, -0.18), C.PrimerGray);
  b.box("ClipA", v(0.12, 0.28, 0.01), CF.at(0, 0, -0.005), C.PrimerGray);
  b.box("ClipB", v(0.01, 0.28, 0.06), CF.at(0.013, 0, -0.03), C.PrimerGray, undefined, { nc: true });
}, plugs: [{ type: "GussetBack", accepts: ["GussetMount"], cf: new CF() }], sockets: [{ type: "BraceSeat", cf: look(v(0, 0, -G.GussetTip), v(0, 0, -1)) }], fasteners: [{ type: "Bolt", pos: v(0.04, 0.08, -0.016), normal: v(0, 0, -1) }, { type: "Bolt", pos: v(0.04, -0.08, -0.016), normal: v(0, 0, -1) }, { type: "Bolt", pos: v(-0.04, 0.08, -0.016), normal: v(0, 0, -1) }, { type: "Bolt", pos: v(-0.04, -0.08, -0.016), normal: v(0, 0, -1) }], minFastenRelease: 0, rotStep: 360, transport: CF.angles(Math.PI / 2, 0, 0), proxyColor: C.PrimerGray });
for (const bay of Config.Bays) {
  for (const L of Config.FloorHeights) {
    let horiz = bay - 2 * (G.SeatOffset + G.GussetTip);
    let vert = L - G.GussetLow - G.GussetHighFromTop;
    let Lb = Math.sqrt(horiz * horiz + vert * vert);
    let w = 0.102;
    add({ id: "BR-HSS4-" + idLen(bay) + "-" + idLen(L), name: "Diagonal Brace HSS 4×4 — " + fmtLen(bay) + " × " + fmtLen(L), category: "Structural Steel", kind: "Span", tags: ["Brace", "Steel", "Structural"], lengthM: Lb, pitch: Math.atan2(vert, horiz), weightKg: 17.3 * Lb, sizeM: v(Lb + 0.24, w, w + 0.04), description: $fmt("Square HSS diagonal with slotted knife plates for a %.1f m bay and %.1f m storey. Runs from a low gusset on one column to a high gusset on the next.", bay, L), build: (b2) => {
      b2.hss("Tube", Lb - 0.6, w, 0.0064, new CF(), C.PrimerGray);
      for (const sx of [-1, 1]) {
        b2.box("KnifePlate", v(0.42, 0.09, 0.016), CF.at(sx * (Lb / 2 - 0.09), 0, 0.016), C.PrimerGray);
        b2.box("EndCap", v(0.01, w, w), CF.at(sx * (Lb / 2 - 0.3), 0, 0), C.PrimerGray, undefined, { nc: true });
      }
    }, plugs: [{ type: "BraceEnd", accepts: ["BraceSeat"], cf: CF.at(-Lb / 2, 0, 0) }, { type: "BraceEnd", accepts: ["BraceSeat"], cf: CF.at(Lb / 2, 0, 0) }], fasteners: [{ type: "Bolt", pos: v(-Lb / 2 + 0.02, 0, 0.034), normal: v(0, 0, 1) }, { type: "Bolt", pos: v(-Lb / 2 + 0.1, 0, 0.034), normal: v(0, 0, 1) }, { type: "Bolt", pos: v(Lb / 2 - 0.02, 0, 0.034), normal: v(0, 0, 1) }, { type: "Bolt", pos: v(Lb / 2 - 0.1, 0, 0.034), normal: v(0, 0, 1) }], minFastenRelease: 2, liftPoints: [v(-Lb / 4, w / 2, 0), v(Lb / 4, w / 2, 0)], rigging: "Pitch", symmetric180: false, proxyColor: C.PrimerGray });
  }
}
for (const bay of Config.Bays) {
  let W = G.DeckWidth;
  add({ id: "DK-15B-" + idLen(bay), name: "Composite Metal Deck 1.5\" — " + fmtLen(bay), category: "Structural Steel", kind: "Surface", originBottom: true, tags: ["Deck", "Steel", "Floor"], overlapIgnore: ["Column"], weightKg: 10 * W * bay, sizeM: v(bay, G.DeckDepth, W), description: $fmt("Galvanised 1.5\" fluted deck sheet, %.2f m cover width, spanning %.1f m between two parallel beams. Puddle-welded to the beam flanges.", W, bay), build: (b) => {
    b.box("TopSheet", v(bay, 0.012, W), CF.at(0, G.DeckDepth - 0.006, 0), C.Galvanized);
    for (let k = -2; k <= 2; k += 1) {
      b.box("Rib", v(bay, G.DeckDepth - 0.012, 0.05), CF.at(0, (G.DeckDepth - 0.012) / 2, k * 0.15), C.Galvanized, undefined, { ns: true });
    }
  }, surface: { supportTags: { Beam: true }, tile: W }, fasteners: [{ type: "Weld", pos: v(-bay / 2 + 0.1, G.DeckDepth, 0.2), normal: v(0, 1, 0) }, { type: "Weld", pos: v(-bay / 2 + 0.1, G.DeckDepth, -0.2), normal: v(0, 1, 0) }, { type: "Weld", pos: v(bay / 2 - 0.1, G.DeckDepth, 0.2), normal: v(0, 1, 0) }, { type: "Weld", pos: v(bay / 2 - 0.1, G.DeckDepth, -0.2), normal: v(0, 1, 0) }], minFastenRelease: 0, liftPoints: [v(-bay / 4, G.DeckDepth, 0), v(bay / 4, G.DeckDepth, 0)], proxyColor: C.Galvanized });
  add({ id: "PL-CHK8-" + idLen(bay), name: "Checker Floor Plate 8 mm — " + fmtLen(bay), category: "Structural Steel", kind: "Surface", originBottom: true, tags: ["Plate", "Steel", "Floor"], overlapIgnore: ["Column"], weightKg: 63 * W * bay, sizeM: v(bay, 0.05, W), description: $fmt("8 mm raised-pattern steel plate with two flat-bar stiffeners, %.1f m long. Welded across beams for walkways, platforms and plant decks.", bay), build: (b) => {
    b.box("Plate", v(bay, 0.008, W), CF.at(0, 0.046, 0), C.SteelDark, "DiamondPlate");
    b.box("Stiffener", v(bay - 0.3, 0.042, 0.01), CF.at(0, 0.021, 0.2), C.SteelDark, undefined, { ns: true });
    b.box("Stiffener", v(bay - 0.3, 0.042, 0.01), CF.at(0, 0.021, -0.2), C.SteelDark, undefined, { ns: true });
    b.box("Bearer", v(0.06, 0.042, W), CF.at(-bay / 2 + 0.03, 0.021, 0), C.SteelDark, undefined, { ns: true });
    b.box("Bearer", v(0.06, 0.042, W), CF.at(bay / 2 - 0.03, 0.021, 0), C.SteelDark, undefined, { ns: true });
  }, surface: { supportTags: { Beam: true }, tile: W }, fasteners: [{ type: "Weld", pos: v(-bay / 2 + 0.06, 0.05, 0.25), normal: v(0, 1, 0) }, { type: "Weld", pos: v(-bay / 2 + 0.06, 0.05, -0.25), normal: v(0, 1, 0) }, { type: "Weld", pos: v(bay / 2 - 0.06, 0.05, 0.25), normal: v(0, 1, 0) }, { type: "Weld", pos: v(bay / 2 - 0.06, 0.05, -0.25), normal: v(0, 1, 0) }], minFastenRelease: 2, liftPoints: [v(-bay / 4, 0.05, 0), v(bay / 4, 0.05, 0)], proxyColor: C.SteelDark });
}
function panelFasteners(bay, H) {
  return [{ type: "Bolt", pos: v(-bay / 2 + 0.2, 0.25, -0.02), normal: v(0, 0, -1) }, { type: "Bolt", pos: v(bay / 2 - 0.2, 0.25, -0.02), normal: v(0, 0, -1) }, { type: "Bolt", pos: v(-bay / 2 + 0.2, H - 0.25, -0.02), normal: v(0, 0, -1) }, { type: "Bolt", pos: v(bay / 2 - 0.2, H - 0.25, -0.02), normal: v(0, 0, -1) }];
}
function panelPlugs(bay) {
  return [{ type: "CladEnd", accepts: ["CladSeat"], cf: CF.at(-bay / 2, 0, 0) }, { type: "CladEnd", accepts: ["CladSeat"], cf: CF.at(bay / 2, 0, 0) }];
}
for (const bay of Config.Bays) {
  for (const H of Config.FloorHeights) {
    let w = bay - 0.02;
    let h = H - 0.02;
    add({ id: "WP-IMP-" + idLen(bay) + "-" + idLen(H), name: "Insulated Metal Wall Panel — " + fmtLen(bay) + " × " + fmtLen(H), category: "Walls & Roofing", kind: "Span", faceNormal: true, tags: ["WallPanel", "Facade"], weightKg: 15 * bay * H, sizeM: v(w, h, 0.12), boundsOffsetM: v(0, H / 2, 0.06), description: "Factory-assembled insulated metal panel unit with vertical rib profile. Hangs on the outside face of two columns and bolts back through clip angles.", build: (b) => {
      b.box("Skin", v(w, h, 0.08), CF.at(0, H / 2, 0.04), rgb(184, 189, 193));
      let n = Math.floor(w / 1.0);
      for (let k = 0; k <= n; k += 1) {
        let x = -w / 2 + 0.1 + k * (w - 0.2) / Math.max(n, 1);
        b.box("Rib", v(0.035, h, 0.025), CF.at(x, H / 2, 0.0925), rgb(176, 181, 186), undefined, { ns: true, nc: true });
      }
      b.box("Flashing", v(w, 0.05, 0.12), CF.at(0, H - 0.035, 0.06), C.SteelDark, undefined, { nc: true });
      b.box("Sill", v(w, 0.05, 0.12), CF.at(0, 0.035, 0.06), C.SteelDark, undefined, { nc: true });
    }, plugs: panelPlugs(bay), fasteners: panelFasteners(bay, H), minFastenRelease: 2, liftPoints: [v(-bay / 4, H, 0.06), v(bay / 4, H, 0.06)], rigging: "Bridle", proxyColor: rgb(184, 189, 193) });
    add({ id: "CW-UNIT-" + idLen(bay) + "-" + idLen(H), name: "Curtain Wall Unit (glazed) — " + fmtLen(bay) + " × " + fmtLen(H), category: "Windows & Doors", kind: "Span", faceNormal: true, tags: ["Window", "Facade"], weightKg: 36 * bay * H, sizeM: v(w, h, 0.15), boundsOffsetM: v(0, H / 2, 0.075), description: "Unitised aluminium curtain wall with insulated vision glass and a dark spandrel at the slab edge. Hung from two columns and bolted back from inside.", build: (b) => {
      let alu = rgb(58, 62, 66);
      b.box("Spandrel", v(w - 0.04, 0.9, 0.03), CF.at(0, 0.47, 0.06), rgb(34, 38, 42), "Glass", { refl: 0.1 });
      let glass = b.box("Vision", v(w - 0.04, h - 0.96, 0.024), CF.at(0, 0.92 + (h - 0.96) / 2, 0.075), C.Glass, "Glass", { tr: 0.45, refl: 0.15 });
      glass.ns = true;
      let n = Math.max(1, Math.floor(w / 1.5 + 0.5));
      for (let k = 0; k <= n; k += 1) {
        let x = -w / 2 + 0.03 + k * (w - 0.06) / n;
        b.box("Mullion", v(0.06, h, 0.15), CF.at(x, H / 2, 0.075), alu);
      }
      b.box("Head", v(w, 0.08, 0.15), CF.at(0, H - 0.05, 0.075), alu);
      b.box("Transom", v(w, 0.06, 0.15), CF.at(0, 0.92, 0.075), alu);
      b.box("SillFrame", v(w, 0.08, 0.15), CF.at(0, 0.05, 0.075), alu);
    }, plugs: panelPlugs(bay), fasteners: panelFasteners(bay, H), minFastenRelease: 2, liftPoints: [v(-bay / 4, H, 0.075), v(bay / 4, H, 0.075)], rigging: "Bridle", proxyColor: C.Glass });
  }
}
for (const size of [1.5, 2.0, 2.5, 3.0]) {
  add({ id: "FT-PRECAST-" + idLen(size), name: $fmt("Precast Pad Footing %.1f m with Anchor Rods", size), category: "Concrete & Foundations", kind: "Rest", originBottom: true, tags: ["Footing", "Concrete", "Structural"], rest: { terrainOnly: true, grid: Config.Grid.Ground }, weightKg: 2400 * (size * size * 0.45 + 0.55 * 0.55 * 0.35), sizeM: v(size, G.FootingTop, size), description: $fmt("Precast %.1f m pad with a pedestal and four cast-in anchor rods. Set on prepared grade; columns seat on its top and are bolted down with anchor nuts.", size), build: (b, def) => {
    let tint = rgb(170, 167, 160);
    b.box("Pad", v(size, 0.45, size), CF.at(0, 0.225, 0), tint, "Concrete");
    b.box("Pedestal", v(0.55, 0.35, 0.55), CF.at(0, 0.45 + 0.175, 0), rgb(160, 157, 150), "Concrete");
    b.box("Grout", v(0.5, 0.012, 0.5), CF.at(0, G.FootingTop - 0.006, 0), rgb(120, 118, 112), "Concrete", { nc: true });
    for (const sx of [1, -1]) {
      for (const sz of [1, -1]) {
        b.cylY("AnchorRod", 0.14, 0.025, v(sx * 0.2, G.FootingTop + 0.06, sz * 0.2), C.MillSteel, "Metal", { nc: true, ns: true });
      }
      b.box("LiftLoop", v(0.03, 0.08, 0.16), CF.at(sx * (size / 2 - 0.2), 0.49, 0), C.MillSteel, "Metal", { nc: true, ns: true });
    }
  }, sockets: [{ type: "FootingTop", cf: CF.at(0, G.FootingTop, 0) }], liftPoints: [v(-(size / 2 - 0.2), 0.5, 0), v(size / 2 - 0.2, 0.5, 0)], rigging: "Bridle", proxyColor: C.Concrete });
}
let GALV = C.Galvanized;
let TUBE = 0.048;
add({ id: "SC-BASEJACK", name: "Scaffold Base Jack 0.3 m", category: "Scaffolding", kind: "Rest", originBottom: true, tags: ["Scaffold"], rest: { grid: 0.05, lattice: true }, weightKg: 5.5, sizeM: v(0.15, G.ScaffoldJack, 0.15), description: "Adjustable screw jack with a 150 mm base plate. Every scaffold starts here; snaps to the bay lattice of nearby jacks.", build: (b) => {
  b.box("BasePlate", v(0.15, 0.008, 0.15), CF.at(0, 0.004, 0), GALV);
  b.cylY("Screw", G.ScaffoldJack - 0.008, 0.034, v(0, 0.008 + (G.ScaffoldJack - 0.008) / 2, 0), C.SteelDark, "Metal", { ns: true });
  b.cylY("Nut", 0.03, 0.07, v(0, G.ScaffoldJack - 0.06, 0), rgb(200, 70, 40), "Metal", { ns: true, nc: true });
}, sockets: [{ type: "ScafNode", cf: CF.at(0, G.ScaffoldJack, 0) }], rotStep: 360, transport: CF.angles(0, 0, Math.PI / 2), proxyColor: GALV });
for (const H of [2.0, 1.0, 0.5, 1.5, 3.0]) {
  let rosettes = [];
  let sockets = [{ type: "ScafStdTop", cf: CF.at(0, H, 0) }];
  for (let k = 1; k <= Math.floor(H / 0.5 + 0.5); k += 1) {
    let y = k * 0.5;
    rosettes.push(y);
    sockets.push({ type: "ScafRosette", multi: true, cf: CF.at(0, y, 0) });
  }
  add({ id: "SC-STD-" + idLen(H), name: $fmt("Scaffold Upright %.1f m", H), category: "Scaffolding", kind: "Point", originBottom: true, tags: ["Scaffold", "ScaffoldUpright"], weightKg: 5.5 * H, sizeM: v(0.12, H, 0.12), description: "Galvanised standard with rosettes every 0.5 m and a spigot. Seats on a base jack or on top of another upright.", build: (b) => {
    b.cylY("Tube", H, TUBE, v(0, H / 2, 0), GALV);
    b.cylY("Spigot", 0.22, 0.038, v(0, H + 0.11, 0), GALV, "Metal", { nc: true, ns: true });
    for (const y of rosettes) {
      b.cylY("Rosette", 0.01, 0.124, v(0, y, 0), GALV, "Metal", { nc: true, ns: true });
    }
  }, plugs: [{ type: "ScafStdBottom", accepts: ["ScafNode", "ScafStdTop"], cf: new CF() }], sockets: sockets, rotStep: 360, transport: CF.angles(0, 0, Math.PI / 2), proxyColor: GALV });
}
function ledgerDef(id, name, len, plugType, extraDesc, buildExtra, tags) {
  let wedge = (plugType === "ScafLedgerEnd");
  return add({ id: id, name: name, category: "Scaffolding", kind: "Span", tags: (tags || ["Scaffold", "ScaffoldLedger"]), weightKg: 3.6 * len + 0.6, sizeM: v(len - 0.1, 0.06, 0.06), description: extraDesc, build: (b) => {
    b.cylX("Tube", len - 0.1, TUBE, new CF(), GALV);
    for (const sx of [-1, 1]) {
      b.box("Head", v(0.06, 0.08, 0.05), CF.at(sx * (len / 2 - 0.04), 0, 0), GALV, "Metal", { nc: true, ns: true });
    }
    if (buildExtra) {
      buildExtra(b, len);
    }
  }, plugs: [{ type: plugType, accepts: ["ScafRosette"], cf: CF.at(-len / 2, 0, 0) }, { type: plugType, accepts: ["ScafRosette"], cf: CF.at(len / 2, 0, 0) }], fasteners: ((wedge && [{ type: "Wedge", pos: v(-len / 2 + 0.035, 0.07, 0), normal: v(0, 1, 0) }, { type: "Wedge", pos: v(len / 2 - 0.035, 0.07, 0), normal: v(0, 1, 0) }]) || []), minFastenRelease: 0, symmetric180: true, transport: new CF(), proxyColor: GALV });
}
ledgerDef("SC-LEDGER-2570", "Scaffold Ledger 2.57 m", G.ScaffoldBayLong, "ScafLedgerEnd", "Horizontal ledger for the long side of a bay. Wedge heads drop into the rosettes and are hammered tight; also used as guardrails at 0.5 m and 1.0 m above a platform.");
ledgerDef("SC-LEDGER-1090", "Scaffold Ledger 1.09 m", G.ScaffoldBayShort, "ScafLedgerEnd", "Short transom ledger across the width of a bay. Carries platform ends; doubles as an end guardrail.");
ledgerDef("SC-TOE-2570", "Scaffold Toe Board 2.57 m", G.ScaffoldBayLong, "ScafToeEnd", "Timber toe board that clips between two uprights at platform level to stop tools and fittings falling.", (b, len) => {
  b.box("Board", v(len - 0.1, 0.15, 0.025), CF.at(0, 0.135, 0), rgb(176, 140, 92), "WoodPlanks");
}, ["Scaffold", "ScaffoldToeBoard"]);
ledgerDef("SC-TOE-1090", "Scaffold Toe Board 1.09 m", G.ScaffoldBayShort, "ScafToeEnd", "Short timber toe board for the end of a bay.", (b, len) => {
  b.box("Board", v(len - 0.1, 0.15, 0.025), CF.at(0, 0.135, 0), rgb(176, 140, 92), "WoodPlanks");
}, ["Scaffold", "ScaffoldToeBoard"]);
for (const len of [0.73, 1.57, 2.07, 3.07]) {
  let tag = String(Math.floor(len * 1000 + 0.5));
  ledgerDef("SC-LEDGER-" + tag, $fmt("Scaffold Ledger %.2f m", len), len, "ScafLedgerEnd", $fmt("Horizontal ring-lock ledger for a %.2f m bay; wedges hammered into the rosettes.", len));
  ledgerDef("SC-TOE-" + tag, $fmt("Scaffold Toe Board %.2f m", len), len, "ScafToeEnd", $fmt("Timber toe board for a %.2f m bay edge.", len), (b, l) => {
    b.box("Board", v($sub(l, 0.1), 0.15, 0.025), CF.at(0, 0.135, 0), rgb(176, 140, 92), "WoodPlanks");
  }, ["Scaffold", "ScaffoldToeBoard"]);
}
for (const spec of [[G.ScaffoldBayLong, "2570"], [G.ScaffoldBayShort, "1090"], [2.07, "2070"], [3.07, "3070"]]) {
  let [bay, tag] = [spec[0], spec[1]];
  let Ld = Math.sqrt(bay * bay + G.ScaffoldLift * G.ScaffoldLift);
  add({ id: "SC-DIAG-" + tag, name: $fmt("Scaffold Diagonal Brace %.2f × 2.0 m", bay), category: "Scaffolding", kind: "Span", tags: ["Scaffold", "ScaffoldBrace"], weightKg: 3.4 * Ld, sizeM: v(Ld - 0.1, 0.06, 0.06), pitch: Math.atan2(G.ScaffoldLift, bay), description: "Diagonal that stiffens a bay face, running from a rosette on one upright to the rosette 2.0 m higher on the next.", build: (b) => {
    b.cylX("Tube", Ld - 0.1, TUBE, new CF(), GALV);
    for (const sx of [-1, 1]) {
      b.box("Head", v(0.07, 0.06, 0.05), CF.at(sx * (Ld / 2 - 0.04), 0, 0), GALV, "Metal", { nc: true, ns: true });
    }
  }, plugs: [{ type: "ScafDiagEnd", accepts: ["ScafRosette"], cf: CF.at(-Ld / 2, 0, 0) }, { type: "ScafDiagEnd", accepts: ["ScafRosette"], cf: CF.at(Ld / 2, 0, 0) }], fasteners: [{ type: "Wedge", pos: v(-Ld / 2 + 0.04, 0.06, 0), normal: v(0, 1, 0) }, { type: "Wedge", pos: v(Ld / 2 - 0.04, 0.06, 0), normal: v(0, 1, 0) }], minFastenRelease: 0, rigging: "Pitch", proxyColor: GALV });
}
for (const spec of [[G.ScaffoldBayLong, G.ScaffoldBayShort, "2570"], [G.ScaffoldBayShort, G.ScaffoldBayShort, "1090"], [2.07, G.ScaffoldBayShort, "2070"], [3.07, G.ScaffoldBayShort, "3070"]]) {
  let [a, w, tag] = [spec[0], spec[1], spec[2]];
  let planks = Math.max(1, Math.floor((w - 0.05) / 0.32));
  let deckW = planks * 0.32;
  add({ id: "SC-DECK-" + tag, name: $fmt("Scaffold Platform Deck %.2f × %.2f m", a, w), category: "Scaffolding", kind: "Span", tags: ["Scaffold", "ScaffoldDeck"], weightKg: $div($mul(19 * planks, a), 2.57), sizeM: v($sub(a, 0.08), 0.05, deckW), boundsOffsetM: v(0, 0.055, 0), description: "Steel plank platform that hooks over the ledgers of a complete bay. Needs an upright at all four corners. Walkable working level.", build: (b) => {
    for (let k = 1; k <= planks; k += 1) {
      let z = -deckW / 2 + 0.16 + (k - 1) * 0.32;
      b.box("Plank", v($sub(a, 0.08), 0.05, 0.31), CF.at(0, 0.055, z), GALV, "DiamondPlate");
    }
    for (const sx of [-1, 1]) {
      b.box("Hook", v(0.04, 0.03, deckW), CF.at($mul(sx, $sub($div(a, 2), 0.05)), 0.035, 0), GALV, "Metal", { nc: true, ns: true });
    }
  }, plugs: [{ type: "ScafDeckCorner", accepts: ["ScafRosette"], cf: CF.at($div($unm(a), 2), 0, -w / 2) }, { type: "ScafDeckCorner", accepts: ["ScafRosette"], cf: CF.at($div(a, 2), 0, w / 2) }], requireSockets: [{ type: "ScafRosette", cf: CF.at($div(a, 2), 0, -w / 2) }, { type: "ScafRosette", cf: CF.at($div($unm(a), 2), 0, w / 2) }], minFastenRelease: 0, symmetric180: true, proxyColor: GALV });
}
add({ id: "SC-LADDER-27", name: "Scaffold Access Ladder 2.7 m", category: "Scaffolding", kind: "Rest", originBottom: true, tags: ["Scaffold", "Ladder"], rest: { grid: 0.05 }, allowFree: true, weightKg: 12, sizeM: v(0.5, 8 / 3, 0.08), description: "Aluminium access ladder. Stand it against the outside of a scaffold bay (leave the guardrail open there) to climb between lifts.", build: (b) => {
  let H = 8 / 3;
  let alu = rgb(196, 199, 202);
  b.box("RailL", v(0.05, H, 0.07), CF.at(-0.22, H / 2, 0), alu);
  b.box("RailR", v(0.05, H, 0.07), CF.at(0.22, H / 2, 0), alu);
  let y = 0.25;
  while ((y < H - 0.1)) {
    b.cylX("Rung", 0.4, 0.03, CF.at(0, y, 0), alu, "Metal", { nc: true, ns: true });
    y = y + 0.28;
  }
  b.climb("ClimbTruss", v(0.67, H, 0.67), CF.at(0, H / 2, 0));
}, rotStep: 90, transport: CF.angles(0, 0, Math.PI / 2), proxyColor: rgb(196, 199, 202) });
add({ id: "RG-SPREADER-4", name: "Spreader Bar 4 m", category: "Connections & Rigging", class: "Equipment", kind: "Rest", originBottom: true, tags: ["Rigging"], rest: { grid: 0.1 }, allowFree: true, weightKg: 180, sizeM: v(4.0, 0.3, 0.25), description: "Fabricated spreader beam with end lugs. Stored on site for long or flexible lifts; place it in the laydown area.", build: (b) => {
  b.hss("Bar", 3.8, 0.2, 0.01, CF.at(0, 0.2, 0), C.CraneYellow);
  for (const sx of [-1, 1]) {
    b.box("Lug", v(0.12, 0.12, 0.03), CF.at(sx * 1.9, 0.33, 0), C.CraneYellow);
    b.box("Foot", v(0.1, 0.1, 0.25), CF.at(sx * 1.6, 0.05, 0), C.Timber, "Wood");
  }
}, proxyColor: C.CraneYellow });
add({ id: "RG-BOLTCRATE", name: "Structural Bolt Crate (A325, pallet)", category: "Connections & Rigging", class: "Equipment", kind: "Rest", originBottom: true, tags: ["Pallet"], rest: { grid: 0.1 }, allowFree: true, weightKg: 640, sizeM: v(1.2, 0.9, 1.0), description: "Pallet of bolt, nut and washer kegs. Keep it near the work face — the crane can set it on a finished deck.", build: (b) => {
  b.box("Pallet", v(1.2, 0.14, 1.0), CF.at(0, 0.07, 0), C.Timber, "WoodPlanks");
  for (const x of [-0.3, 0.3]) {
    for (const z of [-0.25, 0.25]) {
      b.cylY("Keg", 0.7, 0.42, v(x, 0.14 + 0.35, z), rgb(64, 68, 72), "Metal");
      b.cylY("Lid", 0.02, 0.43, v(x, 0.85, z), C.Safety, "SmoothPlastic", { nc: true, ns: true });
    }
  }
  b.box("Strap", v(1.22, 0.03, 0.04), CF.at(0, 0.6, 0), C.StrapOrange, "Fabric", { nc: true, ns: true });
}, proxyColor: rgb(64, 68, 72) });
add({ id: "MC-LIGHTTOWER", name: "Mobile Light Tower (4 × LED)", category: "Machinery", class: "Equipment", kind: "Rest", originBottom: true, tags: ["Machine"], rest: { grid: 0.1 }, allowFree: true, functional: "Light", weightKg: 950, sizeM: v(1.4, 7.0, 2.6), description: "Diesel light tower with a telescopic mast and four LED floods. Press E to switch it on for dusk work.", build: (b) => {
  let y = C.CraneYellow;
  b.box("Body", v(1.2, 1.1, 1.9), CF.at(0, 0.9, 0), y);
  b.box("Grille", v(1.21, 0.4, 0.6), CF.at(0, 1.0, 0.5), C.SteelDark, "DiamondPlate", { nc: true });
  b.box("Drawbar", v(0.1, 0.1, 1.0), CF.at(0, 0.45, -1.3), C.SteelDark);
  for (const sx of [1, -1]) {
    b.cylX("Wheel", 0.2, 0.65, CF.at(sx * 0.7, 0.33, 0.2), C.Rubber, "SmoothPlastic");
    b.box("Outrigger", v(0.08, 0.6, 0.08), CF.at(sx * 0.55, 0.3, -0.85), C.SteelDark);
  }
  b.box("Mast", v(0.16, 5.4, 0.16), CF.at(0, 4.15, -0.4), rgb(190, 192, 195));
  b.box("LampBar", v(1.3, 0.08, 0.1), CF.at(0, 6.85, -0.4), C.SteelDark);
  for (const [$i_k, x] of ([-0.45, -0.15, 0.15, 0.45]).entries()) { const k = $i_k + 1;
    let lamp = b.box("Lamp" + k, v(0.26, 0.3, 0.12), $mul(CF.at(x, 6.6, -0.32), CF.angles(rad(-25), 0, 0)), C.Charcoal);
    let lens = b.box("Lens" + k, v(0.22, 0.24, 0.01), $mul($mul(CF.at(x, 6.6, -0.32), CF.angles(rad(-25), 0, 0)), CF.at(0, 0, -0.065)), rgb(230, 230, 220), "Glass", { nc: true, ns: true });
    lens.lens = true;
    if (((k === 2) || (k === 3))) {
      b.light(lamp, { type: "spot", range: 20, brightness: 3, color: rgb(255, 244, 228), angle: 80, shadows: true });
    }
  }
}, proxyColor: C.CraneYellow });
add({ id: "MC-GENERATOR-60", name: "Site Generator 60 kVA", category: "Machinery", class: "Equipment", kind: "Rest", originBottom: true, tags: ["Machine"], rest: { grid: 0.1 }, allowFree: true, functional: "Engine", weightKg: 1450, sizeM: v(1.1, 1.5, 2.6), description: "Canopied diesel generator powering welders and site lighting. Press E to start or stop it.", build: (b) => {
  b.box("Skid", v(1.1, 0.15, 2.6), CF.at(0, 0.075, 0), C.SteelDark);
  b.box("Canopy", v(1.05, 1.25, 2.45), CF.at(0, 0.775, 0), rgb(46, 84, 64));
  b.box("Louvre", v(1.06, 0.6, 0.5), CF.at(0, 0.8, 0.9), C.SteelDark, "DiamondPlate", { nc: true });
  b.box("Panel", v(0.4, 0.4, 0.02), CF.at(0.2, 1.0, -1.235), C.Charcoal, "SmoothPlastic", { nc: true });
  b.cylY("Exhaust", 0.35, 0.08, v(-0.3, 1.57, -0.6), C.SteelDark, "Metal", { nc: true });
  b.box("LiftEye", v(0.08, 0.12, 0.2), CF.at(0, 1.46, 0), C.SteelDark, "Metal", { nc: true });
}, proxyColor: rgb(46, 84, 64) });
add({ id: "MC-WELDER-CART", name: "Engine-Driven Welder on Cart", category: "Machinery", class: "Equipment", kind: "Rest", originBottom: true, tags: ["Machine"], rest: { grid: 0.1 }, allowFree: true, functional: "Engine", weightKg: 260, sizeM: v(0.7, 1.0, 1.3), description: "Portable welding power source with leads and a stinger hook. Press E to run it; welding on deck reads more convincingly with it running nearby.", build: (b) => {
  b.box("Case", v(0.65, 0.65, 1.1), CF.at(0, 0.55, 0), rgb(176, 40, 32));
  b.box("Panel", v(0.4, 0.3, 0.02), CF.at(0, 0.6, -0.56), C.Charcoal, "SmoothPlastic", { nc: true });
  for (const sx of [1, -1]) {
    b.cylX("Wheel", 0.08, 0.3, CF.at(sx * 0.36, 0.15, 0.35), C.Rubber, "SmoothPlastic");
  }
  b.box("Handle", v(0.6, 0.03, 0.03), CF.at(0, 1.0, -0.6), C.SteelDark, "Metal", { nc: true });
  b.cylY("LeadCoil", 0.12, 0.36, v(0, 0.94, 0.25), C.Rubber, "SmoothPlastic", { nc: true });
}, proxyColor: rgb(176, 40, 32) });
add({ id: "EL-DISTBOARD", name: "Temporary Power Distribution Board", category: "Electrical, Plumbing & HVAC", class: "Equipment", kind: "Rest", originBottom: true, tags: ["Electrical"], rest: { grid: 0.1 }, allowFree: true, functional: "Light", weightKg: 48, sizeM: v(0.6, 1.3, 0.35), description: "Weatherproof site distribution board on a stand with RCD-protected outlets. Press E to energise (status lamp).", build: (b) => {
  b.box("Stand", v(0.5, 0.6, 0.3), CF.at(0, 0.3, 0), C.SteelDark);
  let box = b.box("Cabinet", v(0.6, 0.7, 0.35), CF.at(0, 0.95, 0), rgb(230, 120, 30), "SmoothPlastic");
  box.name = "Lamp1";
  for (let k = 0; k <= 2; k += 1) {
    b.box("Socket", v(0.12, 0.12, 0.03), CF.at(-0.15 + k * 0.15, 0.75, -0.18), rgb(40, 90, 200), "SmoothPlastic", { nc: true });
  }
  let lens = b.box("Lens1", v(0.06, 0.06, 0.01), CF.at(0.2, 1.2, -0.18), rgb(60, 220, 90), "Glass", { nc: true, ns: true });
  lens.lens = true;
  b.light(box, { type: "point", range: 1.33, brightness: 1, color: rgb(80, 255, 120) });
}, proxyColor: rgb(230, 120, 30) });
add({ id: "EL-CABLEREEL", name: "Cable Reel 50 m (16 A)", category: "Electrical, Plumbing & HVAC", class: "Decorative", kind: "Rest", originBottom: true, tags: ["Electrical"], rest: { grid: 0.05 }, allowFree: true, weightKg: 14, sizeM: v(0.45, 0.45, 0.3), description: "Yellow site extension reel. Decorative prop for dressing work faces.", build: (b) => {
  b.cylX("Drum", 0.22, 0.32, $mul(CF.at(0, 0.22, 0), CF.angles(0, Math.PI / 2, 0)), C.Rubber, "SmoothPlastic");
  for (const sz of [-0.12, 0.12]) {
    b.cylX("Flange", 0.02, 0.42, $mul(CF.at(0, 0.22, sz), CF.angles(0, Math.PI / 2, 0)), C.Safety, "SmoothPlastic");
  }
  b.box("Frame", v(0.04, 0.44, 0.3), CF.at(0.2, 0.22, 0), C.SteelDark, "Metal", { nc: true });
}, proxyColor: C.Safety });
add({ id: "SF-CONE-700", name: "Traffic Cone 700 mm", category: "Site Safety", class: "Decorative", kind: "Rest", originBottom: true, tags: ["Safety"], rest: { grid: 0.05 }, allowFree: true, weightKg: 3.2, sizeM: v(0.38, 0.7, 0.38), description: "Reflective PVC traffic cone for marking exclusion zones under the crane.", build: (b) => {
  let o = rgb(240, 92, 24);
  b.box("Base", v(0.38, 0.04, 0.38), CF.at(0, 0.02, 0), C.Rubber, "SmoothPlastic");
  let segs = 5;
  for (let k = 0; k <= segs - 1; k += 1) {
    let t = k / segs;
    let d = 0.28 - 0.22 * t;
    let band = ((k === 2) || (k === 3));
    b.cylY("Cone", 0.66 / segs, d, v(0, 0.04 + (k + 0.5) * 0.66 / segs, 0), ((band && C.OffWhite) || o), "SmoothPlastic", { ns: (k > 2) });
  }
}, proxyColor: rgb(240, 92, 24) });
add({ id: "SF-BARRICADE", name: "Steel Sawhorse Barricade", category: "Site Safety", class: "Decorative", kind: "Rest", originBottom: true, tags: ["Safety"], rest: { grid: 0.05 }, allowFree: true, weightKg: 11, sizeM: v(1.5, 1.0, 0.6), description: "Striped barricade rail on folding legs.", build: (b) => {
  for (const [$i_k, y] of ([0.92, 0.6]).entries()) { const k = $i_k + 1;
    b.box("Rail" + k, v(1.5, 0.18, 0.025), CF.at(0, y, 0), C.OffWhite, "SmoothPlastic");
    for (let s = 0; s <= 3; s += 1) {
      b.box("Stripe", v(0.18, 0.18, 0.027), $mul(CF.at(-0.6 + s * 0.4, y, 0), CF.angles(0, 0, rad(35))), rgb(240, 92, 24), "SmoothPlastic", { nc: true, ns: true });
    }
  }
  for (const sx of [-0.65, 0.65]) {
    b.bar("Leg", v(sx, 1.0, 0), v(sx, 0, 0.28), 0.04, 0.04, C.SteelDark);
    b.bar("Leg", v(sx, 1.0, 0), v(sx, 0, -0.28), 0.04, 0.04, C.SteelDark);
  }
}, proxyColor: C.OffWhite });
add({ id: "SF-JERSEY-3", name: "Concrete Jersey Barrier 3 m", category: "Site Safety", class: "Decorative", kind: "Rest", originBottom: true, tags: ["Safety", "Concrete"], rest: { grid: 0.1 }, allowFree: true, weightKg: 1800, sizeM: v(3.0, 0.81, 0.6), description: "Precast safety-shape barrier for separating the delivery lane from the work zone.", build: (b) => {
  let c = rgb(176, 173, 166);
  b.box("Foot", v(3.0, 0.3, 0.6), CF.at(0, 0.15, 0), c, "Concrete");
  b.wedge("SlopeA", v(3.0, 0.3, 0.18), $mul(CF.at(0, 0.45, 0.21), CF.angles(0, Math.PI, 0)), c, "Concrete");
  b.wedge("SlopeB", v(3.0, 0.3, 0.18), CF.at(0, 0.45, -0.21), c, "Concrete");
  b.box("Core", v(3.0, 0.3, 0.24), CF.at(0, 0.45, 0), c, "Concrete");
  b.box("Top", v(3.0, 0.21, 0.2), CF.at(0, 0.705, 0), c, "Concrete");
}, liftPoints: [v(-0.9, 0.81, 0), v(0.9, 0.81, 0)], proxyColor: rgb(176, 173, 166) });
add({ id: "SF-SIGN-PPE", name: "Site Safety Sign Board", category: "Site Safety", class: "Decorative", kind: "Rest", originBottom: true, tags: ["Safety"], rest: { grid: 0.05 }, allowFree: true, weightKg: 9, sizeM: v(0.9, 1.6, 0.4), description: "Free-standing PPE sign: hard hats, hi-vis and boots required beyond this point.", build: (b) => {
  let board = b.box("Board", v(0.9, 0.6, 0.02), CF.at(0, 1.3, 0), C.OffWhite, "SmoothPlastic");
  b.box("Post", v(0.05, 1.0, 0.05), CF.at(0, 0.5, 0.02), C.SteelDark);
  b.box("Foot", v(0.5, 0.06, 0.4), CF.at(0, 0.03, 0), C.Rubber, "SmoothPlastic");
  if (!(b.opts.preview)) {
    b.sign(board, "HARD HATS\nHI-VIS & BOOTS\nREQUIRED", rgb(0, 110, 60), 0xffffff);
  }
}, proxyColor: rgb(0, 110, 60) });
add({ id: "SF-EXTINGUISHER", name: "Fire Extinguisher Point", category: "Site Safety", class: "Decorative", kind: "Rest", originBottom: true, tags: ["Safety"], rest: { grid: 0.05 }, allowFree: true, weightKg: 22, sizeM: v(0.5, 1.2, 0.3), description: "Stand with a CO2 and a dry-powder extinguisher. Required near hot work.", build: (b) => {
  b.box("Board", v(0.5, 1.2, 0.03), CF.at(0, 0.6, 0.12), rgb(200, 30, 30), "SmoothPlastic");
  b.cylY("Ext1", 0.55, 0.15, v(-0.12, 0.38, 0), rgb(205, 30, 30), "SmoothPlastic");
  b.cylY("Ext2", 0.55, 0.15, v(0.12, 0.38, 0), rgb(205, 30, 30), "SmoothPlastic");
  b.box("Band", v(0.155, 0.08, 0.155), CF.at(0.12, 0.5, 0), C.Charcoal, "SmoothPlastic", { nc: true, ns: true });
}, proxyColor: rgb(200, 30, 30) });
add({ id: "SF-FIRSTAID", name: "First Aid & Eyewash Station", category: "Site Safety", class: "Decorative", kind: "Rest", originBottom: true, tags: ["Safety"], rest: { grid: 0.05 }, allowFree: true, weightKg: 18, sizeM: v(0.6, 1.5, 0.3), description: "Wall-board station with a first aid cabinet and eyewash bottles.", build: (b) => {
  b.box("Board", v(0.6, 1.0, 0.03), CF.at(0, 1.0, 0.12), rgb(0, 130, 70), "SmoothPlastic");
  b.box("Cabinet", v(0.45, 0.35, 0.15), CF.at(0, 1.2, 0.03), C.OffWhite, "SmoothPlastic");
  b.box("Cross", v(0.12, 0.04, 0.005), CF.at(0, 1.2, -0.05), rgb(0, 130, 70), "SmoothPlastic", { nc: true, ns: true });
  b.box("CrossV", v(0.04, 0.12, 0.005), CF.at(0, 1.2, -0.05), rgb(0, 130, 70), "SmoothPlastic", { nc: true, ns: true });
  b.box("Post", v(0.05, 0.5, 0.05), CF.at(0, 0.25, 0.12), C.SteelDark);
  b.box("Foot", v(0.5, 0.05, 0.3), CF.at(0, 0.025, 0.05), C.Rubber, "SmoothPlastic");
}, proxyColor: rgb(0, 130, 70) });
add({ id: "SF-FENCE-35", name: "Temporary Fence Panel 3.5 m", category: "Site Safety", class: "Decorative", kind: "Rest", originBottom: true, tags: ["Safety", "Fence"], rest: { grid: 0.1 }, allowFree: true, weightKg: 24, sizeM: v(3.5, 2.0, 0.6), description: "Mesh fence panel with rubber feet. Use it to close off a laydown area or the crane swing zone.", build: (b) => {
  let galv = C.Galvanized;
  b.box("Mesh", v(3.4, 1.9, 0.02), CF.at(0, 1.05, 0), galv, "DiamondPlate", { tr: 0.55, ns: true });
  b.cylY("PostL", 2.0, 0.04, v(-1.72, 1.08, 0), galv);
  b.cylY("PostR", 2.0, 0.04, v(1.72, 1.08, 0), galv);
  b.cylX("RailT", 3.45, 0.035, CF.at(0, 2.04, 0), galv, "Metal", { nc: true });
  b.cylX("RailB", 3.45, 0.035, CF.at(0, 0.12, 0), galv, "Metal", { nc: true });
  for (const sx of [-1.72, 1.72]) {
    b.box("Foot", v(0.2, 0.12, 0.6), CF.at(sx, 0.06, 0), C.Rubber, "SmoothPlastic");
  }
}, proxyColor: C.Galvanized });
add({ id: "FN-PALLET", name: "Timber Pallet 1.2 × 1.0 m", category: "Site Furnishings", class: "Decorative", kind: "Rest", originBottom: true, tags: ["Pallet"], rest: { grid: 0.05 }, allowFree: true, weightKg: 22, sizeM: v(1.2, 0.144, 1.0), description: "Empty four-way pallet; useful for staging small parts off the mud.", build: (b) => {
  let t = C.Timber;
  for (let k = -3; k <= 3; k += 1) {
    b.box("Top", v(1.2, 0.022, 0.1), CF.at(0, 0.133, k * 0.145), t, "WoodPlanks");
  }
  for (const z of [-0.45, 0, 0.45]) {
    b.box("Stringer", v(1.2, 0.078, 0.1), CF.at(0, 0.083, z), t, "WoodPlanks");
    b.box("Bottom", v(1.2, 0.022, 0.1), CF.at(0, 0.011, z), t, "WoodPlanks");
  }
}, proxyColor: C.Timber });
add({ id: "FN-DUNNAGE", name: "Timber Dunnage 100 × 100 × 2400", category: "Site Furnishings", class: "Decorative", kind: "Rest", originBottom: true, tags: ["Timber"], rest: { grid: 0.05 }, allowFree: true, weightKg: 14, sizeM: v(2.4, 0.1, 0.1), description: "Hardwood bearer for keeping steel off the ground in the laydown area.", build: (b) => {
  b.box("Timber", v(2.4, 0.1, 0.1), CF.at(0, 0.05, 0), C.Timber, "Wood");
}, proxyColor: C.Timber });
add({ id: "FN-GANGBOX", name: "Steel Gang Box", category: "Site Furnishings", class: "Decorative", kind: "Rest", originBottom: true, tags: ["Storage"], rest: { grid: 0.05 }, allowFree: true, weightKg: 70, sizeM: v(1.2, 0.75, 0.65), description: "Lockable jobsite tool chest for the connecting crew.", build: (b) => {
  b.box("Body", v(1.2, 0.62, 0.65), CF.at(0, 0.38, 0), rgb(32, 86, 160));
  b.box("Lid", v(1.22, 0.08, 0.67), CF.at(0, 0.73, 0), rgb(28, 76, 142));
  b.box("Skid", v(1.2, 0.07, 0.6), CF.at(0, 0.035, 0), C.SteelDark);
  b.box("Hasp", v(0.08, 0.1, 0.02), CF.at(0, 0.62, -0.335), C.Galvanized, "Metal", { nc: true, ns: true });
}, proxyColor: rgb(32, 86, 160) });
add({ id: "FN-GASCAGE", name: "Gas Cylinder Cage (O₂ / Acetylene)", category: "Site Furnishings", class: "Decorative", kind: "Rest", originBottom: true, tags: ["Storage"], rest: { grid: 0.05 }, allowFree: true, weightKg: 320, sizeM: v(1.2, 1.9, 0.8), description: "Ventilated mesh cage holding cutting gas cylinders, segregated by type.", build: (b) => {
  let g = C.Galvanized;
  b.box("Floor", v(1.2, 0.05, 0.8), CF.at(0, 0.025, 0), g, "DiamondPlate");
  b.box("Roof", v(1.2, 0.04, 0.8), CF.at(0, 1.88, 0), g);
  for (const sx of [-0.58, 0.58]) {
    for (const sz of [-0.38, 0.38]) {
      b.box("Post", v(0.04, 1.85, 0.04), CF.at(sx, 0.95, sz), g);
    }
  }
  b.box("MeshBack", v(1.2, 1.8, 0.02), CF.at(0, 0.95, 0.39), g, "DiamondPlate", { tr: 0.5, ns: true });
  b.box("MeshFront", v(1.2, 1.8, 0.02), CF.at(0, 0.95, -0.39), g, "DiamondPlate", { tr: 0.5, ns: true });
  for (const [$i_k, x] of ([-0.35, -0.1, 0.15, 0.38]).entries()) { const k = $i_k + 1;
    let col = (((k <= 2) && rgb(240, 240, 240)) || rgb(150, 30, 40));
    b.cylY("Cylinder", 1.4, 0.22, v(x, 0.75, 0), col, "SmoothPlastic", { nc: true });
  }
}, proxyColor: C.Galvanized });
add({ id: "FN-TOILET", name: "Portable Toilet", category: "Site Furnishings", class: "Decorative", kind: "Rest", originBottom: true, tags: ["Welfare"], rest: { grid: 0.05 }, allowFree: true, weightKg: 85, weightClass: "Heavy", sizeM: v(1.12, 2.3, 1.2), description: "Single-unit portable toilet with a lifting frame on the roof.", build: (b) => {
  let c = rgb(28, 98, 168);
  b.box("Base", v(1.12, 0.1, 1.2), CF.at(0, 0.05, 0), rgb(40, 40, 44), "SmoothPlastic");
  b.box("Walls", v(1.1, 2.0, 1.15), CF.at(0, 1.1, 0), c, "SmoothPlastic");
  b.box("Roof", v(1.16, 0.18, 1.22), CF.at(0, 2.19, 0), C.OffWhite, "SmoothPlastic");
  b.box("Door", v(0.7, 1.8, 0.02), CF.at(0, 1.0, -0.585), rgb(24, 86, 150), "SmoothPlastic", { nc: true });
  b.box("Vacant", v(0.1, 0.04, 0.01), CF.at(0.25, 1.1, -0.6), rgb(50, 200, 80), "SmoothPlastic", { nc: true, ns: true });
}, liftPoints: [v(0, 2.3, 0)], proxyColor: rgb(28, 98, 168) });
add({ id: "FN-DUMPSTER-15", name: "Roll-off Dumpster 15 yd³", category: "Site Furnishings", class: "Decorative", kind: "Rest", originBottom: true, tags: ["Waste"], rest: { grid: 0.1 }, allowFree: true, weightKg: 1900, sizeM: v(2.3, 1.5, 5.4), description: "Steel roll-off container for scrap and packaging.", build: (b) => {
  let c = rgb(46, 92, 58);
  b.box("Floor", v(2.3, 0.1, 5.4), CF.at(0, 0.15, 0), c);
  b.box("SideA", v(0.08, 1.35, 5.4), CF.at(1.11, 0.85, 0), c);
  b.box("SideB", v(0.08, 1.35, 5.4), CF.at(-1.11, 0.85, 0), c);
  b.box("EndA", v(2.3, 1.35, 0.08), CF.at(0, 0.85, 2.66), c);
  b.box("EndB", v(2.3, 1.35, 0.08), CF.at(0, 0.85, -2.66), c);
  for (const sx of [0.8, -0.8]) {
    b.box("Rail", v(0.15, 0.1, 5.4), CF.at(sx, 0.05, 0), C.SteelDark);
  }
  for (let k = -2; k <= 2; k += 1) {
    b.box("Rib", v(2.42, 0.06, 0.12), CF.at(0, 1.2, k * 1.1), c, "Metal", { nc: true, ns: true });
  }
  b.box("Debris", v(2.0, 0.4, 3.0), CF.at(0, 0.4, 0.5), rgb(110, 96, 80), "Pebble", { nc: true });
}, liftPoints: [v(-1.0, 1.5, -2.6), v(1.0, 1.5, 2.6)], proxyColor: rgb(46, 92, 58) });
add({ id: "FN-OFFICE-6", name: "Site Office Container 6 m", category: "Site Furnishings", class: "Decorative", kind: "Rest", originBottom: true, tags: ["Welfare"], rest: { grid: 0.1 }, allowFree: true, weightKg: 3200, sizeM: v(6.06, 2.6, 2.44), description: "Insulated site office with windows and a door. Set it with the crane on level ground.", build: (b) => {
  let c = rgb(226, 226, 220);
  b.box("Body", v(6.06, 2.5, 2.44), CF.at(0, 1.3, 0), c, "Metal");
  for (let k = -3; k <= 3; k += 1) {
    b.box("Rib", v(0.06, 2.4, 2.46), CF.at(k * 0.85, 1.3, 0), rgb(214, 214, 208), "Metal", { nc: true, ns: true });
  }
  b.box("Skid", v(6.06, 0.15, 2.44), CF.at(0, 0.075, 0), C.SteelDark);
  b.box("Door", v(0.9, 2.0, 0.03), CF.at(2.2, 1.15, -1.23), rgb(70, 74, 80), "Metal", { nc: true });
  for (const x of [-1.8, 0.2]) {
    b.box("Window", v(1.2, 0.9, 0.03), CF.at(x, 1.55, -1.23), C.Glass, "Glass", { nc: true, tr: 0.2, refl: 0.2 });
    b.box("Bars", v(1.25, 0.04, 0.04), CF.at(x, 1.55, -1.25), C.SteelDark, "Metal", { nc: true, ns: true });
  }
  b.box("Step", v(1.0, 0.25, 0.6), CF.at(2.2, 0.125, -1.55), C.SteelDark, "DiamondPlate");
  b.box("AC", v(0.7, 0.45, 0.25), CF.at(-2.4, 2.0, 1.35), C.OffWhite, "SmoothPlastic");
}, liftPoints: [v(-2.9, 2.6, -1.1), v(2.9, 2.6, 1.1)], proxyColor: rgb(226, 226, 220) });
add({ id: "FN-BENCH", name: "Break Table with Benches", category: "Site Furnishings", class: "Decorative", kind: "Rest", originBottom: true, tags: ["Welfare"], rest: { grid: 0.05 }, allowFree: true, weightKg: 45, sizeM: v(1.8, 0.75, 1.5), description: "Galvanised picnic table for the crew's break area.", build: (b) => {
  let w = C.Timber;
  b.box("Top", v(1.8, 0.05, 0.75), CF.at(0, 0.73, 0), w, "WoodPlanks");
  for (const sz of [-0.62, 0.62]) {
    b.box("Bench", v(1.8, 0.04, 0.26), CF.at(0, 0.44, sz), w, "WoodPlanks");
  }
  for (const sx of [-0.7, 0.7]) {
    b.box("Frame", v(0.05, 0.05, 1.5), CF.at(sx, 0.4, 0), C.Galvanized);
    b.box("LegA", v(0.05, 0.7, 0.05), CF.at(sx, 0.37, 0.2), C.Galvanized);
    b.box("LegB", v(0.05, 0.7, 0.05), CF.at(sx, 0.37, -0.2), C.Galvanized);
  }
}, proxyColor: C.Timber });
itemsBuilding({ add: add, look: look, CF: CF, V: v, G: G, C: C, M: M, Config: Config, idLen: idLen, fmtLen: fmtLen, panelPlugs: panelPlugs, panelFasteners: panelFasteners });
itemsSite({ add: add, CF: CF, V: v, C: C, M: M });
Registry.ToolOrder = ["TL-HANDS", "TL-IMPACT", "TL-HAMMER", "TL-WELDER", "TL-REMOTE", "TL-POUR", "TL-TROWEL"];
add({ id: "TL-HANDS", name: "Gloved Hands", category: "Tools", class: "Tool", kind: "Tool", hotkey: 1, weightKg: 0, sizeM: v(0.2, 0.2, 0.2), description: "Pick up, carry, release straps and place components.", build: (b) => {
  b.box("Glove", v(0.1, 0.06, 0.18), new CF(), C.HiVis, "Fabric");
} });
add({ id: "TL-IMPACT", name: "1\" Impact Wrench", category: "Tools", class: "Tool", kind: "Tool", hotkey: 2, fastens: "Bolt", weightKg: 9, sizeM: v(0.12, 0.3, 0.38), description: "Cordless high-torque impact wrench. Hold the mouse on a bolt position to run up and snug the nut.", build: (b) => {
  b.box("Body", v(0.1, 0.12, 0.26), CF.at(0, 0.05, 0), rgb(220, 160, 20), "SmoothPlastic");
  b.box("Grip", v(0.06, 0.18, 0.07), CF.at(0, -0.08, 0.06), C.Charcoal, "SmoothPlastic");
  b.box("Battery", v(0.1, 0.07, 0.13), CF.at(0, -0.19, 0.05), C.Charcoal, "SmoothPlastic");
  b.cylX("Anvil", 0.12, 0.05, $mul(CF.at(0, 0.05, -0.18), CF.angles(0, Math.PI / 2, 0)), C.SteelDark, "Metal");
  b.cylX("Socket", 0.07, 0.065, $mul(CF.at(0, 0.05, -0.27), CF.angles(0, Math.PI / 2, 0)), rgb(30, 30, 32), "Metal");
} });
add({ id: "TL-HAMMER", name: "Scaffold Hammer", category: "Tools", class: "Tool", kind: "Tool", hotkey: 3, fastens: "Wedge", weightKg: 1.2, sizeM: v(0.05, 0.35, 0.15), description: "Drives ring-lock wedges tight. Hold the mouse on a ledger wedge.", build: (b) => {
  b.box("Handle", v(0.035, 0.32, 0.03), CF.at(0, 0, 0), rgb(200, 60, 30), "SmoothPlastic");
  b.box("Head", v(0.04, 0.04, 0.14), CF.at(0, 0.17, -0.02), C.SteelDark, "Metal");
} });
add({ id: "TL-WELDER", name: "Stick Welder Stinger", category: "Tools", class: "Tool", kind: "Tool", hotkey: 4, fastens: "Weld", weightKg: 1.5, sizeM: v(0.06, 0.08, 0.4), description: "Electrode holder on welding leads. Hold the mouse on a puddle-weld spot; wear the hood — sparks are kept restrained.", build: (b) => {
  b.box("Holder", v(0.045, 0.045, 0.22), CF.at(0, 0, 0.05), rgb(30, 30, 32), "SmoothPlastic");
  b.box("Jaw", v(0.03, 0.03, 0.06), CF.at(0, 0, -0.09), rgb(180, 140, 60), "Metal");
  b.cylX("Rod", 0.18, 0.006, $mul(CF.at(0, -0.03, -0.17), CF.angles(0, Math.PI / 2, rad(35))), rgb(120, 110, 100), "Metal");
} });
add({ id: "TL-REMOTE", name: "Crane Radio Remote", category: "Tools", class: "Tool", kind: "Tool", hotkey: 5, weightKg: 1.8, sizeM: v(0.22, 0.12, 0.16), description: "Belly-box radio remote for the tower crane. Equip it to operate the crane from the ground or the steel while you stay at the connection.", build: (b) => {
  b.box("Box", v(0.22, 0.08, 0.15), new CF(), C.Safety, "SmoothPlastic");
  b.box("Panel", v(0.18, 0.01, 0.11), CF.at(0, 0.045, 0), C.Charcoal, "SmoothPlastic");
  b.cylY("StickL", 0.06, 0.015, v(-0.05, 0.07, 0), C.Charcoal, "SmoothPlastic");
  b.cylY("StickR", 0.06, 0.015, v(0.05, 0.07, 0), C.Charcoal, "SmoothPlastic");
  b.box("EStop", v(0.03, 0.02, 0.03), CF.at(0.08, 0.055, -0.05), rgb(210, 30, 30), "SmoothPlastic");
} });
add({ id: "TL-POUR", name: "Concrete Pump Hose", category: "Tools", class: "Tool", kind: "Tool", hotkey: 6, pours: true, weightKg: 0, sizeM: v(0.2, 0.2, 0.9), description: "End hose of the line pump. Aim at a fully decked, welded bay and hold the mouse to place the slab concrete.", build: (b) => {
  b.cylX("Hose", 0.8, 0.13, $mul(CF.at(0, 0, -0.1), CF.angles(0, Math.PI / 2, 0)), rgb(30, 30, 32), "SmoothPlastic");
  b.cylX("Coupling", 0.1, 0.16, $mul(CF.at(0, 0, 0.32), CF.angles(0, Math.PI / 2, 0)), C.Galvanized, "Metal");
  b.box("Handle", v(0.04, 0.2, 0.04), CF.at(0, -0.12, 0.1), C.Safety, "SmoothPlastic");
} });
add({ id: "TL-TROWEL", name: "Bull Float & Trowel", category: "Tools", class: "Tool", kind: "Tool", hotkey: 7, fastens: "Screed", weightKg: 3, sizeM: v(0.3, 0.1, 0.9), description: "Finishes freshly poured concrete. Hold the mouse on each of the four finishing marks; the slab cures when all are done.", build: (b) => {
  b.box("Float", v(0.28, 0.02, 0.6), CF.at(0, -0.05, -0.2), rgb(170, 176, 182), "Metal");
  b.box("Pole", v(0.03, 0.03, 0.7), $mul(CF.at(0, 0.05, 0.25), CF.angles(rad(-15), 0, 0)), C.Safety, "SmoothPlastic");
} });
Registry.get = function (id) {
  return Registry.items[id];
};
Registry.count = function () {
  let counts = { total: 0 };
  for (const def of Registry.list) {
    counts.total = $add(counts.total, 1);
    counts[def.class] = $add((counts[def.class] || 0), 1);
  }
  return counts;
};
Registry.TargetCount = 500;
Registry.search = function (query, category, favorites, favoritesOnly) {
  query = ((query || "")).toLowerCase();
  let out = [];
  for (const def of Registry.list) {
    let okCat = ((!(category) || (category === "All")) || (def.category === category));
    let okFav = (!(favoritesOnly) || (favorites && favorites[def.id]));
    let okQuery = ((((query === "") || (((def.name).toLowerCase()).indexOf(query) >= 0)) || (((def.category).toLowerCase()).indexOf(query) >= 0)) || (((def.id).toLowerCase()).indexOf(query) >= 0));
    if (((okCat && okFav) && okQuery)) {
      out.push(def);
    }
  }
  return out;
};
Registry.dimensionsText = function (def) {
  let s = def.sizeM;
  return $fmt("%.2f × %.2f × %.2f m", s.x, s.z, s.y);
};
Registry.find = function (kind, a, b, c) {
  if ((kind === "column")) {
    return "COL-" + $gsub(a, "×", "x") + "-" + idLen(b);
  } else if ((kind === "beam")) {
    return "BM-" + $gsub(a, "×", "x") + "-" + idLen(b);
  } else if ((kind === "brace")) {
    return "BR-HSS4-" + idLen(a) + "-" + idLen(b);
  } else if ((kind === "deck")) {
    return "DK-15B-" + idLen(a);
  } else if ((kind === "wall")) {
    return "WP-IMP-" + idLen(a) + "-" + idLen(b);
  } else if ((kind === "curtain")) {
    return "CW-UNIT-" + idLen(a) + "-" + idLen(b);
  } else if ((kind === "footing")) {
    return "FT-PRECAST-" + idLen(a);
  }
  return undefined;
};
