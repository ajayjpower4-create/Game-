// Shared tunables. World units are metres.

export const rgb = (r, g, b) => (r << 16) | (g << 8) | b;

export const Config = {
  version: "1.0.0",
  title: "STEELRISE",
  subtitle: "CONSTRUCTION SIMULATOR",
  S: 1, // studs-per-metre in the original design; 1 here (metres everywhere)

  Colors: {
    Charcoal: rgb(24, 26, 29),
    Steel: rgb(122, 128, 134),
    SteelDark: rgb(70, 74, 79),
    OffWhite: rgb(236, 233, 226),
    Safety: rgb(255, 194, 14),
    SafetyDark: rgb(196, 146, 0),
    Valid: rgb(88, 214, 141),
    Invalid: rgb(235, 87, 72),
    Info: rgb(110, 170, 235),
    MillSteel: rgb(86, 90, 95),
    PrimerGray: rgb(118, 121, 124),
    PrimerRed: rgb(122, 58, 46),
    Galvanized: rgb(164, 169, 172),
    Concrete: rgb(168, 165, 158),
    ConcreteDark: rgb(128, 126, 120),
    CraneYellow: rgb(240, 178, 18),
    Rubber: rgb(28, 28, 30),
    Timber: rgb(150, 112, 72),
    StrapOrange: rgb(232, 110, 28),
    Glass: rgb(140, 170, 185),
    HiVis: rgb(208, 255, 40),
  },

  WeightClasses: {
    Light: { maxKg: 25, carry: true, walkSpeed: 3.4, climb: true, label: "Light — carry by hand" },
    Medium: { maxKg: 75, carry: true, walkSpeed: 2.2, climb: false, label: "Medium — carry slowly, no ladders" },
    Heavy: { maxKg: Infinity, carry: false, walkSpeed: 4.0, climb: true, label: "Heavy — crane lift required" },
    Fixed: { maxKg: Infinity, carry: false, walkSpeed: 4.0, climb: true, label: "Fixed equipment" },
  },
  walkSpeed: 4.0,
  sprintSpeed: 6.4,
  gravity: 17,
  jumpSpeed: 5.0,
  stepHeight: 0.42,

  Reach: { Interact: 4.4, Place: 5.4, Fasten: 4.4, CraneCab: 6, EasyPlace: 14 },
  easyCarrySpeed: 2.6,

  Geo: {
    SeatOffset: 0.2,
    CladOffset: 0.24,
    GussetLow: 0.6,
    GussetHighFromTop: 0.9,
    GussetTip: 0.26,
    DeckWidth: 0.75,
    DeckDepth: 0.075,
    SlabTopping: 0.065,
    SlabTop: 0.14,
    PartitionClear: 0.79,
    ParapetHeight: 1.1,
    FootingTop: 0.8,
    ScaffoldBayLong: 2.57,
    ScaffoldBayShort: 1.09,
    ScaffoldBays: [0.73, 1.09, 1.57, 2.07, 2.57, 3.07],
    ScaffoldLift: 2.0,
    ScaffoldJack: 0.3,
    SnapTolerance: 0.03,
  },

  Bays: [3.0, 4.5, 6.0, 7.5, 9.0],
  FloorHeights: [3.0, 3.6, 4.2, 4.5, 4.8],

  Grid: { Ground: 0.5, Fine: 0.1, RotateStep: 90, FreeRotateStep: 15 },

  Crane: {
    SlewMaxSpeed: (7 * Math.PI) / 180,
    SlewAccel: (4 * Math.PI) / 180,
    SlewBrake: (7 * Math.PI) / 180,
    TrolleyMaxSpeed: 2.3,
    TrolleyAccel: 1.3,
    TrolleyBrake: 2.3,
    HoistMaxSpeed: 3.3,
    HoistLoadedSpeed: 1.7,
    HoistAccel: 2.7,
    HoistBrake: 4.7,
    LoadRotateSpeed: (18 * Math.PI) / 180,
    PrecisionFactor: 0.25,
    PendulumGravity: 9.81,
    SwingDamping: 0.1,
    SwingDampingAssist: 0.45,
    SlingDrop: 1.33,
    AttachRange: 1.4,
    LandPosTolerance: 0.55,
    LandAngleTolerance: (14 * Math.PI) / 180,
    RiggingKg: 60,
    WindWarnMs: 12,
    WindStopMs: 15,
    WindForce: 0.0012,
  },

  Delivery: {
    MaxTrailers: 3,
    TrailerMaxKg: 22000,
    BedLength: 16.0,
    BedWidth: 2.5,
    BedHeight: 1.45,
    MaxStackHeight: 2.4,
    ArriveSeconds: 7,
    DepartSeconds: 7,
    MaxLooseComponents: 400,
  },

  Save: { ManualSlots: 3, AutosaveInterval: 180 },

  Graphics: {
    Order: ["Low", "Balanced", "High", "Ultra"],
    Presets: {
      Low: { shadows: false, shadowSize: 1024, pixelRatio: 0.75, post: false, viewDistance: 350, particles: 0.3 },
      Balanced: { shadows: true, shadowSize: 2048, pixelRatio: 1.0, post: true, viewDistance: 600, particles: 0.7 },
      High: { shadows: true, shadowSize: 4096, pixelRatio: 1.0, post: true, viewDistance: 900, particles: 1.0 },
      Ultra: { shadows: true, shadowSize: 4096, pixelRatio: 1.5, post: true, viewDistance: 1400, particles: 1.0 },
    },
  },

  AudioGroups: ["Master", "Machinery", "Tools", "Impacts", "Ambience", "Footsteps", "UI"],

  DefaultSettings: {
    graphics: "Balanced",
    shadows: true,
    post: true,
    particles: true,
    fov: 70,
    thirdPerson: false,
    mouseSensitivity: 1.0,
    assist: true,
    tutorialOn: true,
    easyBuild: true,
    volumes: { Master: 0.8, Machinery: 0.8, Tools: 0.8, Impacts: 0.8, Ambience: 0.6, Footsteps: 0.7, UI: 0.6 },
  },
};

export function weightClassFor(kg) {
  if (kg <= Config.WeightClasses.Light.maxKg) return "Light";
  if (kg <= Config.WeightClasses.Medium.maxKg) return "Medium";
  return "Heavy";
}

export function craneCapacityKg(craneDef, radius) {
  const r = Math.max(radius, 0.1);
  const full = craneDef.maxKg || 8000;
  const fullRadius = craneDef.fullRadiusM || 18;
  return r <= fullRadius ? full : Math.floor((full * fullRadius) / r);
}
