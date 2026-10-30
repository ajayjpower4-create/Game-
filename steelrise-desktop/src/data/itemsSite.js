// Ported from ItemsSite.lua. Called by items.js with its helpers.
import { CF, V3, v, rad, clamp } from "../core/math.js";
import { Config, rgb, weightClassFor } from "../core/config.js";
import { $add, $sub, $mul, $div, $unm, $fmt, $gsub, $assert } from "../core/lua.js";

export default function (R) {
  let [add, CF, v] = [R.add, R.CF, R.V];
  let [C, M] = [R.C, R.M];
  let YEL = C.CraneYellow;
  let DARK = rgb(40, 42, 46);
  let RUBBER = C.Rubber;
  let GLASS = rgb(40, 52, 60);
  function prop(def) {
    def.kind = "Rest";
    def.originBottom = true;
    def.rest = (def.rest || { grid: 0.05 });
    def.allowFree = true;
    def.class = (def.class || "Decorative");
    def.tags = (def.tags || ["Prop"]);
    return add(def);
  }
  function wheelsAt(b, xs, zs, dia, width) {
    for (const x of xs) {
      for (const z of zs) {
        b.cylX("Wheel", width, dia, $mul(CF.at(x, dia / 2, z), CF.angles(0, Math.PI / 2, 0)), RUBBER, "SmoothPlastic", { ns: true });
      }
    }
  }
  for (const L of [2, 6, 8]) {
    prop({ id: "RG-SPREADER-" + L, name: $fmt("Spreader Bar %d m", L), category: "Connections & Rigging", class: "Equipment", tags: ["Rigging"], weightKg: 45 * L + 20, sizeM: v(L, 0.35, 0.3), description: $fmt("Fabricated %d m spreader beam with end lugs for long or flexible lifts. Store it in the laydown yard.", L), build: (b) => {
      b.hss("Bar", L - 0.2, 0.22, 0.01, CF.at(0, 0.22, 0), YEL);
      for (const sx of [-1, 1]) {
        b.box("Lug", v(0.14, 0.14, 0.03), CF.at(sx * (L / 2 - 0.1), 0.36, 0), YEL);
        b.box("Foot", v(0.1, 0.11, 0.3), CF.at(sx * (L / 2 - 0.4), 0.055, 0), C.Timber, "Wood");
      }
    } });
  }
  for (const s of [["12", 0.18, 6], ["25", 0.28, 18]]) {
    prop({ id: "RG-SHACKLE-" + s[0] + "T", name: "Bow Shackle " + s[0] + " t", category: "Connections & Rigging", class: "Equipment", tags: ["Rigging"], weightKg: s[2], sizeM: v(s[1], $mul(s[1], 1.4), 0.06), description: "Galvanised bow shackle with safety bolt, nut and cotter pin for connecting slings to lifting points.", build: (b) => {
      let h = s[1];
      b.box("BowL", v(0.035, h, 0.035), CF.at(-h / 3, h * 0.7, 0), C.Galvanized);
      b.box("BowR", v(0.035, h, 0.035), CF.at(h / 3, h * 0.7, 0), C.Galvanized);
      b.box("BowTop", v(h * 0.75, 0.035, 0.035), CF.at(0, h * 1.2, 0), C.Galvanized);
      b.cylX("Pin", h * 0.95, 0.04, CF.at(0, 0.03, 0), rgb(200, 60, 40));
    } });
  }
  prop({ id: "RG-CHAINSLING-4L", name: "Four-Leg Chain Sling 7 t", category: "Connections & Rigging", class: "Equipment", tags: ["Rigging"], weightKg: 62, sizeM: v(0.9, 0.25, 0.9), description: "Grade 80 chain sling with master link and four hooks, coiled on the ground ready for the next pick.", build: (b) => {
    b.cylX("Coil", 0.18, 0.75, $mul(CF.at(0, 0.09, 0), CF.angles(0, 0, Math.PI / 2)), rgb(70, 70, 72));
    b.box("MasterLink", v(0.25, 0.04, 0.12), CF.at(0, 0.2, 0), DARK);
    for (let k = 0; k <= 3; k += 1) {
      let a = k * Math.PI / 2;
      b.box("Hook", v(0.08, 0.06, 0.12), CF.at(Math.cos(a) * 0.38, 0.05, Math.sin(a) * 0.38), YEL);
    }
  } });
  prop({ id: "RG-WIRESLINGS", name: "Wire Rope Sling Set (rack)", category: "Connections & Rigging", class: "Equipment", tags: ["Rigging"], weightKg: 48, sizeM: v(1.2, 1.6, 0.5), description: "Rigging rack with tagged wire-rope slings of several lengths. Inspect before every lift.", build: (b) => {
    b.box("Post", v(0.08, 1.6, 0.08), CF.at(-0.55, 0.8, 0), YEL);
    b.box("Post", v(0.08, 1.6, 0.08), CF.at(0.55, 0.8, 0), YEL);
    b.box("Rail", v(1.2, 0.08, 0.08), CF.at(0, 1.55, 0), YEL);
    b.box("Foot", v(1.2, 0.06, 0.5), CF.at(0, 0.03, 0), DARK);
    for (let k = 0; k <= 4; k += 1) {
      b.box("Sling", v(0.04, 1.2, 0.04), CF.at(-0.4 + k * 0.2, 0.95, 0.06), rgb(90, 90, 94), "Metal", { nc: true });
    }
  } });
  for (const bk of [["1M3", 1.0, 480], ["2M3", 2.0, 760]]) {
    let sz = Math.pow(bk[1], 1 / 3);
    prop({ id: "RG-BUCKET-" + bk[0], name: $fmt("Concrete Bucket %.0f m³ (crane)", bk[1]), category: "Connections & Rigging", class: "Equipment", tags: ["Rigging", "Concrete"], weightKg: bk[2], sizeM: v(sz + 0.2, sz + 0.6, sz + 0.2), description: "Crane-hung concrete bucket with a hand-lever discharge gate, for pours the pump can't reach.", build: (b) => {
      b.cylX("Body", sz, sz + 0.1, $mul(CF.at(0, 0.6 + sz / 2, 0), CF.angles(0, 0, Math.PI / 2)), rgb(110, 112, 116));
      b.box("Cone", v(sz * 0.6, 0.5, sz * 0.6), CF.at(0, 0.35, 0), rgb(100, 102, 106));
      b.box("Gate", v(0.3, 0.1, 0.3), CF.at(0, 0.08, 0), YEL);
      b.box("Bail", v(sz + 0.2, 0.08, 0.08), CF.at(0, sz + 0.7, 0), YEL);
      for (const sx of [-1, 1]) {
        b.box("Leg", v(0.08, 0.6, 0.08), CF.at(sx * sz * 0.4, 0.3, sx * sz * 0.4), DARK);
      }
    }, liftPoints: [v(0, sz + 0.75, 0)] });
  }
  prop({ id: "RG-MANBASKET", name: "Crane Personnel Basket (2 person)", category: "Connections & Rigging", class: "Equipment", tags: ["Rigging", "Safety"], weightKg: 240, sizeM: v(1.6, 2.6, 1.2), description: "Engineered man-riding basket with four-leg bridle, gate and anchor points.", build: (b) => {
    b.box("Floor", v(1.6, 0.08, 1.2), CF.at(0, 0.04, 0), C.Galvanized, "DiamondPlate");
    for (const sx of [-0.78, 0.78]) {
      for (const sz of [-0.58, 0.58]) {
        b.box("Post", v(0.06, 1.1, 0.06), CF.at(sx, 0.6, sz), YEL);
        b.bar("Bridle", v(sx, 1.15, sz), v(0, 2.55, 0), 0.03, 0.03, rgb(90, 90, 94), "Metal", { nc: true });
      }
    }
    b.box("Rail", v(1.6, 0.06, 0.06), CF.at(0, 1.15, 0.58), YEL);
    b.box("Rail", v(1.6, 0.06, 0.06), CF.at(0, 1.15, -0.58), YEL);
    b.box("Mesh", v(1.6, 1.0, 0.02), CF.at(0, 0.6, 0.6), C.Galvanized, "DiamondPlate", { tr: 0.5, nc: true });
  }, liftPoints: [v(0, 2.6, 0)] });
  prop({ id: "MC-MINIEX", name: "Mini Excavator 3 t", category: "Machinery", class: "Decorative", tags: ["Machine"], weightKg: 3200, sizeM: v(3.6, 2.5, 1.6), description: "Parked compact excavator with a digging bucket. Crane it into place or leave it in the yard.", build: (b) => {
    b.box("TrackL", v(2.0, 0.4, 0.3), CF.at(0, 0.2, -0.6), RUBBER, "SmoothPlastic");
    b.box("TrackR", v(2.0, 0.4, 0.3), CF.at(0, 0.2, 0.6), RUBBER, "SmoothPlastic");
    b.box("Body", v(1.6, 0.7, 1.5), CF.at(-0.1, 0.8, 0), YEL);
    b.box("Cab", v(0.8, 1.1, 0.8), CF.at(0.2, 1.7, 0.3), YEL);
    b.box("Glass", v(0.82, 0.7, 0.82), CF.at(0.2, 1.85, 0.3), GLASS, "Glass", { tr: 0.3, nc: true });
    b.bar("Boom", v(0.7, 1.2, -0.3), v(1.6, 2.3, -0.3), 0.18, 0.18, YEL);
    b.bar("Stick", v(1.6, 2.3, -0.3), v(2.1, 0.8, -0.3), 0.14, 0.14, YEL);
    b.box("Bucket", v(0.45, 0.4, 0.55), CF.at(2.1, 0.45, -0.3), DARK);
    b.box("Blade", v(0.1, 0.35, 1.5), CF.at(-1.15, 0.25, 0), DARK);
  } });
  prop({ id: "MC-SKIDSTEER", name: "Skid Steer Loader", category: "Machinery", class: "Decorative", tags: ["Machine"], weightKg: 2900, sizeM: v(3.2, 2.0, 1.7), description: "Wheeled skid steer with a bucket — site clean-up and gravel moves.", build: (b) => {
    wheelsAt(b, [-0.6, 0.6], [-0.75, 0.75], 0.75, 0.3);
    b.box("Body", v(1.8, 0.9, 1.2), CF.at(0, 0.85, 0), YEL);
    b.box("Cab", v(1.0, 0.9, 1.1), CF.at(0.1, 1.6, 0), DARK, "Metal");
    b.box("Glass", v(0.02, 0.7, 0.9), CF.at(0.62, 1.6, 0), GLASS, "Glass", { tr: 0.3, nc: true });
    b.box("Arm", v(1.6, 0.12, 0.12), CF.at(0.3, 1.5, 0.65), YEL);
    b.box("Arm", v(1.6, 0.12, 0.12), CF.at(0.3, 1.5, -0.65), YEL);
    b.box("Bucket", v(0.5, 0.5, 1.7), CF.at(1.35, 0.35, 0), DARK);
  } });
  prop({ id: "MC-SCISSOR", name: "Electric Scissor Lift 8 m", category: "Machinery", class: "Decorative", tags: ["Machine"], weightKg: 2200, sizeM: v(2.5, 2.3, 1.2), description: "Slab scissor lift (stowed) for ceiling and MEP work on finished floors.", build: (b) => {
    wheelsAt(b, [-0.9, 0.9], [-0.5, 0.5], 0.38, 0.15);
    b.box("Chassis", v(2.4, 0.5, 1.1), CF.at(0, 0.45, 0), rgb(32, 92, 168));
    for (let k = 0; k <= 2; k += 1) {
      b.bar("Scissor", v(-0.9, 0.7 + k * 0.4, 0.5), v(0.9, 1.1 + k * 0.4, 0.5), 0.08, 0.08, YEL, "Metal", { nc: true });
      b.bar("Scissor", v(0.9, 0.7 + k * 0.4, 0.5), v(-0.9, 1.1 + k * 0.4, 0.5), 0.08, 0.08, YEL, "Metal", { nc: true });
    }
    b.box("Deck", v(2.5, 0.1, 1.2), CF.at(0, 1.95, 0), rgb(32, 92, 168));
    b.box("Rail", v(2.5, 0.05, 0.05), CF.at(0, 2.3, 0.58), YEL, "Metal", { nc: true });
    b.box("Rail", v(2.5, 0.05, 0.05), CF.at(0, 2.3, -0.58), YEL, "Metal", { nc: true });
  } });
  prop({ id: "MC-TELEHANDLER", name: "Telehandler 4 t / 17 m", category: "Machinery", class: "Decorative", tags: ["Machine"], weightKg: 11000, sizeM: v(6.0, 2.5, 2.4), description: "Parked telescopic handler with pallet forks. (Driving it is planned for a later update.)", build: (b) => {
    wheelsAt(b, [-1.6, 1.6], [-1.0, 1.0], 1.2, 0.5);
    b.box("Frame", v(4.6, 0.7, 1.6), CF.at(0, 0.95, 0), YEL);
    b.box("Cab", v(1.4, 1.4, 0.9), CF.at(0.2, 1.9, -0.75), DARK);
    b.box("Glass", v(1.2, 1.0, 0.02), CF.at(0.2, 2.0, -1.21), GLASS, "Glass", { tr: 0.3, nc: true });
    b.bar("Boom", v(-1.8, 2.0, 0.3), v(2.6, 1.3, 0.3), 0.45, 0.45, YEL);
    b.box("Carriage", v(0.2, 0.9, 1.2), CF.at(2.85, 0.9, 0.3), DARK);
    b.box("Fork", v(1.1, 0.05, 0.12), CF.at(3.4, 0.5, -0.05), DARK);
    b.box("Fork", v(1.1, 0.05, 0.12), CF.at(3.4, 0.5, 0.65), DARK);
  } });
  prop({ id: "MC-FORKLIFT", name: "Rough-Terrain Forklift", category: "Machinery", class: "Decorative", tags: ["Machine"], weightKg: 6000, sizeM: v(4.2, 2.6, 2.1), description: "Parked rough-terrain forklift with a tall mast.", build: (b) => {
    wheelsAt(b, [-1.1, 1.0], [-0.85, 0.85], 1.0, 0.4);
    b.box("Body", v(3.0, 0.9, 1.6), CF.at(-0.2, 1.0, 0), rgb(220, 110, 30));
    b.box("Cage", v(1.2, 1.2, 1.2), CF.at(-0.3, 2.0, 0), DARK, "Metal", { tr: 0.2 });
    b.box("Mast", v(0.2, 2.6, 1.0), CF.at(1.4, 1.3, 0), DARK);
    b.box("Fork", v(1.1, 0.06, 0.12), CF.at(2.0, 0.3, -0.35), DARK);
    b.box("Fork", v(1.1, 0.06, 0.12), CF.at(2.0, 0.3, 0.35), DARK);
  } });
  prop({ id: "MC-MIXERTRUCK", name: "Ready-Mix Concrete Truck", category: "Machinery", class: "Decorative", tags: ["Machine"], weightKg: 12000, sizeM: v(9.0, 3.7, 2.5), description: "Parked transit mixer with a rotating drum and chute. Pours themselves are made with the pump hose.", build: (b) => {
    wheelsAt(b, [-3.4, 1.4, 2.8], [-1.0, 1.0], 1.05, 0.35);
    b.box("Frame", v(8.5, 0.4, 1.0), CF.at(0, 0.9, 0), DARK);
    b.box("Cab", v(1.9, 1.9, 2.4), CF.at(-3.4, 2.0, 0), rgb(236, 236, 232));
    b.box("Windshield", v(0.02, 0.8, 2.1), CF.at(-4.36, 2.4, 0), GLASS, "Glass", { nc: true });
    b.cylX("Drum", 4.6, 2.2, $mul(CF.at(1.2, 2.4, 0), CF.angles(0, 0, rad(12))), rgb(230, 200, 60));
    b.box("Chute", v(1.2, 0.12, 0.4), $mul(CF.at(4.1, 2.0, 0), CF.angles(0, 0, rad(-25))), DARK);
  } });
  prop({ id: "MC-COMPRESSOR", name: "Towable Air Compressor 185 cfm", category: "Machinery", class: "Equipment", functional: "Engine", tags: ["Machine"], weightKg: 1100, sizeM: v(3.4, 1.4, 1.6), description: "Diesel air compressor for pneumatic tools. F to start or stop.", build: (b) => {
    wheelsAt(b, [0.2], [-0.75, 0.75], 0.6, 0.2);
    b.box("Canopy", v(2.0, 1.0, 1.3), CF.at(0.3, 0.9, 0), YEL);
    b.box("Drawbar", v(1.2, 0.08, 0.08), CF.at(-1.2, 0.5, 0), DARK);
    b.box("Panel", v(0.02, 0.4, 0.6), CF.at(1.31, 1.0, 0), DARK, "SmoothPlastic", { nc: true });
  } });
  prop({ id: "MC-COMPACTOR", name: "Plate Compactor", category: "Machinery", class: "Decorative", tags: ["Machine"], weightKg: 88, sizeM: v(1.0, 1.0, 0.5), description: "Vibratory plate for compacting gravel sub-base.", build: (b) => {
    b.box("Plate", v(0.6, 0.08, 0.5), CF.at(0, 0.04, 0), DARK);
    b.box("Engine", v(0.4, 0.35, 0.35), CF.at(0, 0.3, 0), rgb(200, 60, 30));
    b.bar("Handle", v(-0.2, 0.4, 0), v(-0.55, 0.95, 0), 0.04, 0.04, DARK);
  } });
  prop({ id: "MC-SAW", name: "Walk-Behind Concrete Saw", category: "Machinery", class: "Decorative", tags: ["Machine"], weightKg: 120, sizeM: v(1.4, 1.0, 0.6), description: "Flat saw for cutting control joints in cured slabs.", build: (b) => {
    wheelsAt(b, [-0.4, 0.4], [-0.25, 0.25], 0.25, 0.06);
    b.box("Frame", v(1.0, 0.25, 0.5), CF.at(0, 0.3, 0), rgb(220, 110, 30));
    b.cylX("Blade", 0.02, 0.5, $mul(CF.at(0.5, 0.3, 0.28), CF.angles(0, Math.PI / 2, 0)), C.Galvanized);
    b.bar("Handle", v(-0.4, 0.45, 0), v(-0.75, 0.95, 0), 0.04, 0.04, DARK);
  } });
  prop({ id: "SF-EDGEGUARD-25", name: "Edge Protection Barrier 2.5 m", category: "Site Safety", tags: ["Safety", "Fence"], weightKg: 22, sizeM: v(2.5, 1.2, 0.5), description: "Free-standing mesh edge barrier for open slab edges and stair openings. Solid — you can't walk through it.", build: (b) => {
    b.box("Mesh", v(2.4, 1.0, 0.02), CF.at(0, 0.65, 0), C.Galvanized, "DiamondPlate", { tr: 0.5 });
    b.box("TopRail", v(2.5, 0.05, 0.05), CF.at(0, 1.17, 0), C.Safety);
    for (const sx of [-1.2, 1.2]) {
      b.box("Post", v(0.05, 1.2, 0.05), CF.at(sx, 0.6, 0), C.Safety);
      b.box("Foot", v(0.2, 0.08, 0.5), CF.at(sx, 0.04, 0), DARK);
    }
  } });
  prop({ id: "SF-HARDHAT", name: "PPE Station (hard hats & vests)", category: "Site Safety", tags: ["Safety"], weightKg: 30, sizeM: v(1.2, 1.8, 0.4), description: "Visitor PPE rack with hard hats, hi-vis vests and safety glasses.", build: (b) => {
    b.box("Board", v(1.2, 1.2, 0.04), CF.at(0, 1.1, 0.15), C.OffWhite, "SmoothPlastic");
    b.box("Legs", v(1.1, 0.5, 0.05), CF.at(0, 0.25, 0.15), DARK);
    for (let k = 0; k <= 2; k += 1) {
      b.box("Hat", v(0.25, 0.14, 0.28), CF.at(-0.35 + k * 0.35, 1.4, 0.02), (((k === 1) && C.OffWhite) || C.Safety), "SmoothPlastic", { nc: true });
      b.box("Vest", v(0.25, 0.35, 0.02), CF.at(-0.35 + k * 0.35, 0.95, 0.11), C.HiVis, "Fabric", { nc: true });
    }
  } });
  prop({ id: "SF-EYEWASH", name: "Emergency Shower & Eyewash", category: "Site Safety", tags: ["Safety"], weightKg: 45, sizeM: v(0.8, 2.3, 0.8), description: "Self-contained emergency drench shower with eyewash bowl.", build: (b) => {
    b.box("Base", v(0.6, 0.05, 0.6), CF.at(0, 0.025, 0), C.Safety);
    b.cylY("Pipe", 2.2, 0.06, v(0, 1.1, 0), C.HiVis);
    b.box("Arm", v(0.6, 0.05, 0.05), CF.at(0.3, 2.2, 0), C.HiVis);
    b.cylY("Head", 0.08, 0.3, v(0.55, 2.15, 0), C.HiVis);
    b.cylY("Bowl", 0.08, 0.3, v(0.2, 1.0, 0), C.HiVis);
  } });
  prop({ id: "SF-WARNLIGHT", name: "Amber Warning Beacon on Stand", category: "Site Safety", class: "Equipment", functional: "Light", tags: ["Safety"], weightKg: 8, sizeM: v(0.4, 1.5, 0.4), description: "Battery amber beacon for crane exclusion zones. F to switch on.", build: (b) => {
    b.box("Foot", v(0.4, 0.05, 0.4), CF.at(0, 0.025, 0), DARK);
    b.box("Pole", v(0.04, 1.3, 0.04), CF.at(0, 0.7, 0), DARK);
    let lamp = b.box("Lamp1", v(0.18, 0.2, 0.18), CF.at(0, 1.42, 0), rgb(255, 170, 20), "SmoothPlastic");
    let lens = b.box("Lens1", v(0.16, 0.16, 0.16), CF.at(0, 1.42, 0), rgb(255, 170, 20), "Glass", { nc: true });
    lens.lens = true;
    b.light(lamp, { type: "point", range: 4, brightness: 2, color: rgb(255, 170, 40) });
  } });
  prop({ id: "SF-SPILLKIT", name: "Spill Kit Bin", category: "Site Safety", tags: ["Safety"], weightKg: 25, sizeM: v(0.7, 0.9, 0.6), description: "Wheelie bin of absorbent pads and booms for fuel and hydraulic spills.", build: (b) => {
    b.box("Bin", v(0.7, 0.85, 0.6), CF.at(0, 0.45, 0), rgb(230, 200, 30), "SmoothPlastic");
    b.box("Lid", v(0.72, 0.05, 0.62), CF.at(0, 0.9, 0), rgb(200, 170, 20), "SmoothPlastic");
  } });
  prop({ id: "SF-MUSTER", name: "Muster Point Sign", category: "Site Safety", tags: ["Safety"], weightKg: 12, sizeM: v(0.9, 2.2, 0.4), description: "Green emergency assembly-point sign on a post.", build: (b) => {
    let board = b.box("Board", v(0.9, 0.7, 0.03), CF.at(0, 1.85, 0), rgb(0, 130, 70), "SmoothPlastic");
    b.box("Post", v(0.06, 1.5, 0.06), CF.at(0, 0.75, 0.03), DARK);
    b.box("Foot", v(0.5, 0.06, 0.4), CF.at(0, 0.03, 0), RUBBER, "SmoothPlastic");
    if (!(b.opts.preview)) {
      b.sign(board, "MUSTER\nPOINT", undefined, 0xffffff);
    }
  } });
  prop({ id: "SF-WHEELSTOP", name: "Rubber Wheel Stop", category: "Site Safety", tags: ["Safety"], weightKg: 9, sizeM: v(1.8, 0.12, 0.15), description: "Recycled-rubber wheel stop for the delivery bays.", build: (b) => {
    b.box("Stop", v(1.8, 0.12, 0.15), CF.at(0, 0.06, 0), RUBBER, "SmoothPlastic");
    b.box("Stripe", v(0.3, 0.122, 0.152), CF.at(0, 0.06, 0), C.Safety, "SmoothPlastic", { nc: true, ns: true });
  } });
  prop({ id: "SF-WATERBARRIER", name: "Water-Filled Barrier 2 m", category: "Site Safety", tags: ["Safety"], weightKg: 22, sizeM: v(2.0, 0.8, 0.45), description: "Interlocking plastic barrier (shown empty) for pedestrian routes.", build: (b) => {
    b.box("Body", v(2.0, 0.65, 0.4), CF.at(0, 0.33, 0), rgb(230, 70, 30), "SmoothPlastic");
    b.box("Top", v(1.9, 0.15, 0.25), CF.at(0, 0.72, 0), rgb(230, 70, 30), "SmoothPlastic");
  } });
  prop({ id: "SF-NETTING", name: "Debris Netting Roll", category: "Site Safety", tags: ["Safety"], weightKg: 18, sizeM: v(1.5, 0.4, 0.4), description: "Roll of scaffold debris netting.", build: (b) => {
    b.cylX("Roll", 1.5, 0.4, CF.at(0, 0.2, 0), rgb(40, 120, 60), "Fabric");
  } });
  for (const c of [["20", 6.06, 2300], ["40", 12.19, 3800]]) {
    prop({ id: "FN-CONTAINER-" + c[0], name: "Storage Container " + c[0] + " ft", category: "Site Furnishings", tags: ["Storage"], weightKg: c[2], sizeM: v(c[1], 2.6, 2.44), description: "Corrugated steel storage container for tools and small materials.", build: (b) => {
      let L = c[1];
      b.box("Body", v(L, 2.6, 2.44), CF.at(0, 1.3, 0), rgb(46, 84, 128), "Metal");
      for (let k = 0; k <= Math.floor(L / 0.6); k += 1) {
        b.box("Corrugation", v(0.08, 2.4, 2.46), CF.at(-L / 2 + 0.3 + k * 0.6, 1.3, 0), rgb(40, 76, 118), "Metal", { nc: true, ns: true });
      }
      b.box("Doors", v(0.04, 2.4, 2.3), CF.at(L / 2 + 0.02, 1.3, 0), rgb(40, 76, 118), "Metal", { nc: true });
      for (const sz of [-0.4, 0.4]) {
        b.box("LockBar", v(0.05, 2.3, 0.05), CF.at(L / 2 + 0.06, 1.3, sz), C.Galvanized, "Metal", { nc: true, ns: true });
      }
    }, liftPoints: [v($add($div($unm(c[1]), 2), 0.1), 2.6, -1.1), v($sub($div(c[1], 2), 0.1), 2.6, 1.1)] });
  }
  prop({ id: "FN-TOOLTRAILER", name: "Enclosed Tool Trailer", category: "Site Furnishings", tags: ["Storage"], weightKg: 1400, sizeM: v(4.8, 2.4, 2.1), description: "Single-axle enclosed trailer stocked with hand tools and consumables.", build: (b) => {
    wheelsAt(b, [0.3], [-1.0, 1.0], 0.7, 0.2);
    b.box("Box", v(3.8, 1.9, 2.0), CF.at(0.4, 1.4, 0), C.OffWhite, "Metal");
    b.wedge("Nose", v(2.0, 1.9, 0.5), $mul(CF.at(-1.75, 1.4, 0), CF.angles(0, -Math.PI / 2, 0)), C.OffWhite, "Metal");
    b.box("Tongue", v(1.0, 0.08, 0.08), CF.at(-2.3, 0.5, 0), DARK);
  } });
  prop({ id: "FN-WATERCOOLER", name: "Water Cooler on Table", category: "Site Furnishings", tags: ["Welfare"], weightKg: 30, sizeM: v(0.8, 1.3, 0.6), description: "Insulated water jug and cups for heat-stress breaks.", build: (b) => {
    b.box("Table", v(0.8, 0.05, 0.6), CF.at(0, 0.8, 0), C.Timber, "WoodPlanks");
    for (const x of [-0.35, 0.35]) {
      b.box("Leg", v(0.04, 0.8, 0.5), CF.at(x, 0.4, 0), DARK);
    }
    b.cylY("Jug", 0.45, 0.32, v(0, 1.05, 0), rgb(220, 60, 40), "SmoothPlastic");
  } });
  prop({ id: "FN-HANDWASH", name: "Portable Hand-Wash Station", category: "Site Furnishings", tags: ["Welfare"], weightKg: 40, sizeM: v(0.9, 1.4, 0.7), description: "Foot-pump twin basin hand-wash station.", build: (b) => {
    b.box("Body", v(0.9, 1.0, 0.7), CF.at(0, 0.5, 0), C.OffWhite, "SmoothPlastic");
    b.box("Splash", v(0.9, 0.4, 0.06), CF.at(0, 1.2, 0.32), C.OffWhite, "SmoothPlastic");
  } });
  prop({ id: "FN-SHELTER", name: "Break Shelter Canopy 3 × 3 m", category: "Site Furnishings", tags: ["Welfare"], weightKg: 60, sizeM: v(3.0, 2.6, 3.0), description: "Pop-up canopy for the crew's shaded break area.", build: (b) => {
    for (const sx of [-1.45, 1.45]) {
      for (const sz of [-1.45, 1.45]) {
        b.box("Leg", v(0.05, 2.4, 0.05), CF.at(sx, 1.2, sz), C.Galvanized);
      }
    }
    b.box("Roof", v(3.0, 0.05, 3.0), CF.at(0, 2.45, 0), rgb(32, 80, 140), "Fabric");
    b.wedge("Peak", v(3.0, 0.2, 1.5), CF.at(0, 2.57, -0.75), rgb(32, 80, 140), "Fabric", { nc: true });
  } });
  prop({ id: "FN-REBARBUNDLE", name: "Rebar Bundle (decorative)", category: "Site Furnishings", tags: ["Storage"], weightKg: 900, sizeM: v(6.0, 0.35, 0.5), description: "Bundle of #5 reinforcing bars on timbers — set dressing for the laydown yard.", build: (b) => {
    for (const x of [-2, 2]) {
      b.box("Timber", v(0.1, 0.1, 0.6), CF.at(x, 0.05, 0), C.Timber, "Wood");
    }
    for (let i = 0; i <= 2; i += 1) {
      for (let j = 0; j <= 3; j += 1) {
        b.cylX("Bar", 6.0, 0.05, CF.at(0, 0.13 + i * 0.07, -0.15 + j * 0.1), rgb(110, 70, 50));
      }
    }
  } });
  prop({ id: "FN-PLYSTACK", name: "Plywood Stack (formwork)", category: "Site Furnishings", tags: ["Storage"], weightKg: 640, sizeM: v(2.44, 0.7, 1.22), description: "Stack of 18 mm formply sheets on bearers.", build: (b) => {
    b.box("Bearers", v(2.3, 0.1, 1.2), CF.at(0, 0.05, 0), C.Timber, "Wood");
    b.box("Sheets", v(2.44, 0.6, 1.22), CF.at(0, 0.4, 0), rgb(196, 150, 100), "WoodPlanks");
  } });
  prop({ id: "FN-SANDBAGS", name: "Sandbag Stack", category: "Site Furnishings", tags: ["Storage"], weightKg: 300, sizeM: v(1.2, 0.5, 0.8), description: "Sandbags for weighting signs and barriers.", build: (b) => {
    for (let i = 0; i <= 2; i += 1) {
      for (let j = 0; j <= 1; j += 1) {
        b.box("Bag", v(0.55, 0.15, 0.35), CF.at(-0.3 + j * 0.6 - i % 2 * 0.1, 0.08 + i * 0.16, 0), rgb(180, 160, 110), "Fabric");
        b.box("Bag", v(0.55, 0.15, 0.35), CF.at(-0.3 + j * 0.6 - i % 2 * 0.1, 0.08 + i * 0.16, 0.38), rgb(176, 156, 106), "Fabric");
      }
    }
  } });
  prop({ id: "FN-BINS", name: "Segregated Waste Bins (3)", category: "Site Furnishings", tags: ["Waste"], weightKg: 45, sizeM: v(2.2, 1.1, 0.8), description: "Colour-coded bins for metal, timber and general waste.", build: (b) => {
    for (const [$i_k, col] of ([rgb(60, 100, 170), rgb(120, 80, 50), rgb(60, 60, 64)]).entries()) { const k = $i_k + 1;
      b.box("Bin", v(0.65, 1.0, 0.75), CF.at(-0.75 + (k - 1) * 0.75, 0.5, 0), col, "SmoothPlastic");
    }
  } });
}
