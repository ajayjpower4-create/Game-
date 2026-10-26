// The vehicles of Skyville. Dimensions are the real cars' published
// length / width / height / wheelbase / tire sizes; body proportions come from
// a per-style template the overrides then shape (hood length, roof, glass).
// Only the tow trucks have interiors — these all get dark privacy-style glass.

// Fractions of length for hood / windshield / roof / backlight, measured
// back from the nose, plus fractions of height for the body lines.
const STYLES = {
  sedan: { hood: 0.255, ws: 0.2, roof: 0.25, back: 0.135, nose: 0.46, hoodH: 0.645, belt: 0.665, beltR: 0.7, deck: 0.7, tail: 0.675, gc: 0.14, fo: 0.205 },
  hatch: { hood: 0.24, ws: 0.2, roof: 0.33, back: 0.14, nose: 0.45, hoodH: 0.62, belt: 0.64, beltR: 0.68, deck: 0.68, tail: 0.66, gc: 0.14, fo: 0.21 },
  coupe: { hood: 0.31, ws: 0.19, roof: 0.18, back: 0.18, nose: 0.43, hoodH: 0.64, belt: 0.67, beltR: 0.72, deck: 0.72, tail: 0.69, gc: 0.12, fo: 0.2 },
  suv: { hood: 0.235, ws: 0.15, roof: 0.47, back: 0.075, nose: 0.53, hoodH: 0.645, belt: 0.665, beltR: 0.7, deck: 0.7, tail: 0.68, gc: 0.19, fo: 0.19 },
  wagon: { hood: 0.24, ws: 0.18, roof: 0.43, back: 0.07, nose: 0.47, hoodH: 0.62, belt: 0.64, beltR: 0.67, deck: 0.67, tail: 0.655, gc: 0.2, fo: 0.2 },
  pickup: { hood: 0.215, ws: 0.115, roof: 0.2, back: 0.02, nose: 0.6, hoodH: 0.67, belt: 0.685, beltR: 0.685, deck: 0.5, tail: 0.5, gc: 0.21, fo: 0.155 },
  minivan: { hood: 0.17, ws: 0.2, roof: 0.52, back: 0.07, nose: 0.48, hoodH: 0.58, belt: 0.61, beltR: 0.64, deck: 0.64, tail: 0.62, gc: 0.15, fo: 0.19 },
  van: { hood: 0.115, ws: 0.1, roof: 0.75, back: 0.02, nose: 0.38, hoodH: 0.44, belt: 0.47, beltR: 0.49, deck: 0.49, tail: 0.47, gc: 0.17, fo: 0.155 },
};

function make(style, o) {
  const t = STYLES[style];
  const L = o.L, H = o.H, L2 = L / 2;
  const z = (f) => L2 - f * L;
  const hood = o.hood ?? t.hood, ws = o.ws ?? t.ws, roof = o.roof ?? t.roof, back = o.back ?? t.back;
  const spec = {
    style: style === 'wagon' ? 'wagon' : style,
    fo: (o.fo ?? t.fo) * L,
    gc: o.gc ?? t.gc,
    noseY: (o.nose ?? t.nose) * H,
    hoodY: (o.hoodH ?? t.hoodH) * H,
    beltF: (o.belt ?? t.belt) * H,
    beltR: (o.beltR ?? t.beltR) * H,
    deckY: (o.deck ?? t.deck) * H,
    tailY: (o.tail ?? t.tail) * H,
    zW: z(hood),
    zR1: z(hood + ws),
    zR2: z(hood + ws + roof),
    zB: z(hood + ws + roof + back),
  };
  spec.hoodFront = L2 - (o.hoodLip ?? 0.2);
  if (style === 'pickup') {
    spec.bedY = (o.bedY ?? 0.5) * H;
    spec.bedRail = (o.rail ?? 0.69) * H;
    spec.deckY = spec.bedY;
    spec.tailY = spec.bedRail;
  }
  if (style === 'van') {
    spec.sideGlass = [[spec.zW - 0.95, spec.zW - 0.08]];
    spec.rearGlass = false;
  }
  const out = Object.assign(spec, o);
  out.fo = (o.fo ?? t.fo) * L;
  delete out.hood; delete out.ws; delete out.roof; delete out.back; delete out.nose; delete out.hoodH;
  delete out.belt; delete out.deck; delete out.tail; delete out.rail; delete out.hoodLip;
  if (o.beltR !== undefined) out.beltR = o.beltR * H;
  if (o.bedY !== undefined) out.bedY = o.bedY * H;
  return out;
}

const R = (dia_in, sidewall_mm, width_mm) => {
  // Tire radius in meters from rim diameter (in), aspect sidewall (mm) and width.
  const rim = (dia_in * 0.0254) / 2;
  return { tireR: +(rim + sidewall_mm / 1000).toFixed(3), rimR: +(rim + 0.004).toFixed(3), tireW: width_mm / 1000 };
};

export const CATALOG = [
  // ------------------------------------------------------------- sedans
  { id: 'civic', make: 'Honda', model: 'Civic', ...make('sedan', { L: 4.674, W: 1.802, H: 1.415, wb: 2.735, ...R(18, 94, 235), head: 'swept', grille: 'mesh', rim: 'split5', rimColor: 0x2b2d30, cornerF: 0.44, cornerR: 0.4, back: 0.16, roof: 0.22, deck: 0.71, lightBarRear: false }) },
  { id: 'accord', make: 'Honda', model: 'Accord', ...make('sedan', { L: 4.971, W: 1.862, H: 1.45, wb: 2.83, ...R(19, 94, 235), head: 'swept', grille: 'mesh', rim: 'spoke5', back: 0.17, roof: 0.21, cornerF: 0.46 }) },
  { id: 'corolla', make: 'Toyota', model: 'Corolla', ...make('sedan', { L: 4.63, W: 1.78, H: 1.435, wb: 2.7, ...R(16, 113, 205), head: 'swept', grille: 'mesh', rim: 'steel', rimColor: 0x8f949b }) },
  { id: 'camry', make: 'Toyota', model: 'Camry', ...make('sedan', { L: 4.88, W: 1.84, H: 1.445, wb: 2.825, ...R(18, 96, 235), head: 'swept', grille: 'bars', rim: 'multi', cornerF: 0.48 }) },
  { id: 'altima', make: 'Nissan', model: 'Altima', ...make('sedan', { L: 4.9, W: 1.85, H: 1.44, wb: 2.825, ...R(17, 110, 215), head: 'swept', grille: 'chrome', rim: 'spoke6' }) },
  { id: 'sentra', make: 'Nissan', model: 'Sentra', ...make('sedan', { L: 4.64, W: 1.815, H: 1.45, wb: 2.71, ...R(17, 110, 205), head: 'swept', grille: 'chrome', rim: 'split5' }) },
  { id: 'elantra', make: 'Hyundai', model: 'Elantra', ...make('sedan', { L: 4.675, W: 1.825, H: 1.415, wb: 2.72, ...R(17, 107, 225), head: 'swept', grille: 'mesh', rim: 'multi', lightBarRear: true, back: 0.17, roof: 0.2 }) },
  { id: 'sonata', make: 'Hyundai', model: 'Sonata', ...make('sedan', { L: 4.9, W: 1.86, H: 1.445, wb: 2.84, ...R(18, 101, 235), head: 'swept', grille: 'mesh', rim: 'spoke5', lightBarRear: true, back: 0.18, roof: 0.19 }) },
  { id: 'k5', make: 'Kia', model: 'K5', ...make('sedan', { L: 4.905, W: 1.86, H: 1.445, wb: 2.85, ...R(18, 101, 235), head: 'swept', grille: 'mesh', rim: 'split5', lightBarRear: true, back: 0.18, roof: 0.19 }) },
  { id: 'malibu', make: 'Chevrolet', model: 'Malibu', ...make('sedan', { L: 4.933, W: 1.854, H: 1.462, wb: 2.829, ...R(17, 110, 225), head: 'swept', grille: 'bars', rim: 'spoke6' }) },
  { id: 'fusion', make: 'Ford', model: 'Fusion', ...make('sedan', { L: 4.871, W: 1.852, H: 1.473, wb: 2.85, ...R(17, 110, 235), head: 'swept', grille: 'bars', rim: 'spoke5' }) },
  { id: 'charger', make: 'Dodge', model: 'Charger', ...make('sedan', { L: 5.04, W: 1.905, H: 1.479, wb: 3.05, ...R(19, 101, 245), head: 'rect', grille: 'mesh', rim: 'spoke5', rimColor: 0x1d1e20, hood: 0.28, belt: 0.69, beltR: 0.72, cornerF: 0.3, cornerR: 0.3, lightBarRear: true, dualExhaust: true }) },
  { id: 'impala', make: 'Chevrolet', model: 'Impala', ...make('sedan', { L: 5.113, W: 1.854, H: 1.496, wb: 2.837, ...R(18, 96, 235), head: 'swept', grille: 'bars', rim: 'multi' }) },
  { id: 'bmw3', make: 'BMW', model: '3 Series', ...make('sedan', { L: 4.709, W: 1.827, H: 1.442, wb: 2.851, ...R(18, 90, 225), head: 'swept', grille: 'slots', grilleBox: { w: 0.62, h: 0.17, y: 0.56 }, rim: 'split5', rimColor: 0xa8adb4, fo: 0.17, hood: 0.27, dualExhaust: true }) },
  { id: 'cclass', make: 'Mercedes-Benz', model: 'C-Class', ...make('sedan', { L: 4.751, W: 1.82, H: 1.438, wb: 2.865, ...R(18, 90, 225), head: 'swept', grille: 'chrome', rim: 'multi', fo: 0.175, hood: 0.27 }) },
  { id: 'model3', make: 'Tesla', model: 'Model 3', ...make('sedan', { L: 4.72, W: 1.85, H: 1.441, wb: 2.875, ...R(18, 92, 235), head: 'swept', grille: 'none', rim: 'mesh', rimColor: 0x6d7076, hood: 0.2, ws: 0.24, roof: 0.21, back: 0.19, nose: 0.42, hoodH: 0.6, sunroof: true, plateFront: false, pillarsBlack: true }) },
  { id: 'jetta', make: 'Volkswagen', model: 'Jetta', ...make('sedan', { L: 4.702, W: 1.799, H: 1.459, wb: 2.686, ...R(16, 114, 205), head: 'rect', grille: 'bars', rim: 'spoke5' }) },
  { id: 'lexuses', make: 'Lexus', model: 'ES', ...make('sedan', { L: 4.975, W: 1.865, H: 1.445, wb: 2.87, ...R(18, 96, 235), head: 'swept', grille: 'slots', grilleBox: { w: 0.9, h: 0.32, y: 0.5 }, rim: 'multi' }) },
  { id: 'impreza', make: 'Subaru', model: 'Impreza', ...make('sedan', { L: 4.625, W: 1.775, H: 1.455, wb: 2.67, ...R(17, 110, 205), head: 'swept', grille: 'mesh', rim: 'spoke5' }) },
  { id: 'crownvic', make: 'Ford', model: 'Crown Victoria', ...make('sedan', { L: 5.385, W: 1.988, H: 1.468, wb: 2.913, ...R(17, 105, 235), head: 'rect', grille: 'chrome', rim: 'steel', rimColor: 0xb7bbc1, cornerF: 0.25, cornerR: 0.22, topR: 0.09, roof: 0.24, back: 0.12, hood: 0.26, tumble: 0.16 }) },

  // ------------------------------------------------------------ hatches
  { id: 'golf', make: 'Volkswagen', model: 'Golf', ...make('hatch', { L: 4.284, W: 1.789, H: 1.456, wb: 2.636, ...R(17, 101, 225), head: 'rect', grille: 'bars', rim: 'spoke5', tailShape: 'wide' }) },
  { id: 'fit', make: 'Honda', model: 'Fit', ...make('hatch', { L: 4.064, W: 1.694, H: 1.524, wb: 2.53, ...R(16, 98, 185), head: 'swept', grille: 'mesh', rim: 'steel', rimColor: 0x8f949b, hood: 0.19, ws: 0.24, roof: 0.33, nose: 0.43 }) },
  { id: 'prius', make: 'Toyota', model: 'Prius', ...make('hatch', { L: 4.6, W: 1.78, H: 1.43, wb: 2.75, ...R(17, 105, 195), head: 'swept', grille: 'closed', rim: 'multi', ws: 0.27, roof: 0.18, back: 0.2, nose: 0.42, tailShape: 'wide', lightBarRear: true }) },
  { id: 'mini', make: 'MINI', model: 'Cooper', ...make('hatch', { L: 3.876, W: 1.727, H: 1.414, wb: 2.495, ...R(16, 107, 195), head: 'round', grille: 'mesh', rim: 'spoke5', tailShape: 'tall', cornerF: 0.36, cornerR: 0.25, tumble: 0.12, roof: 0.4, ws: 0.17, back: 0.1, pillarsBlack: true }) },
  { id: 'bolt', make: 'Chevrolet', model: 'Bolt', ...make('hatch', { L: 4.145, W: 1.765, H: 1.611, wb: 2.6, ...R(17, 101, 215), head: 'swept', grille: 'closed', rim: 'split5', hood: 0.18, ws: 0.24 }) },

  // ------------------------------------------------------ coupes / sports
  { id: 'mustang', make: 'Ford', model: 'Mustang', ...make('coupe', { L: 4.811, W: 1.916, H: 1.397, wb: 2.72, ...R(19, 98, 255), head: 'swept', grille: 'mesh', grilleBox: { w: 0.86, h: 0.22, y: 0.55 }, rim: 'spoke5', rimColor: 0x1d1e20, tailShape: 'tall', dualExhaust: true, cornerF: 0.36, hood: 0.33 }) },
  { id: 'camaro', make: 'Chevrolet', model: 'Camaro', ...make('coupe', { L: 4.783, W: 1.897, H: 1.349, wb: 2.811, ...R(20, 89, 245), head: 'rect', grille: 'mesh', rim: 'split5', rimColor: 0x26282b, belt: 0.73, beltR: 0.76, deck: 0.76, dualExhaust: true, spoiler: true }) },
  { id: 'challenger', make: 'Dodge', model: 'Challenger', ...make('coupe', { L: 5.027, W: 1.923, H: 1.45, wb: 2.946, ...R(20, 89, 245), head: 'quad', grille: 'mesh', grilleBox: { w: 1.4, h: 0.2, y: 0.66 }, rim: 'spoke5', rimColor: 0x1d1e20, cornerF: 0.18, cornerR: 0.2, topR: 0.08, hood: 0.32, back: 0.15, tailShape: 'wide', lightBarRear: true, dualExhaust: true }) },
  { id: 'miata', make: 'Mazda', model: 'MX-5 Miata', ...make('coupe', { L: 3.915, W: 1.735, H: 1.235, wb: 2.31, ...R(17, 92, 205), head: 'swept', grille: 'mesh', rim: 'spoke5', rimColor: 0x2a2c2f, ws: 0.17, roof: 0.14, back: 0.1, hood: 0.36, cornerF: 0.45 }) },

  // --------------------------------------------------------------- SUVs
  { id: 'rav4', make: 'Toyota', model: 'RAV4', ...make('suv', { L: 4.6, W: 1.855, H: 1.7, wb: 2.69, ...R(18, 113, 225), head: 'swept', grille: 'mesh', rim: 'spoke5', roofRails: true, cornerF: 0.32, cornerR: 0.25 }) },
  { id: 'crv', make: 'Honda', model: 'CR-V', ...make('suv', { L: 4.694, W: 1.866, H: 1.69, wb: 2.7, ...R(19, 101, 235), head: 'swept', grille: 'mesh', rim: 'split5', tailShape: 'tall' }) },
  { id: 'explorer', make: 'Ford', model: 'Explorer', ...make('suv', { L: 5.05, W: 2.004, H: 1.775, wb: 3.025, ...R(20, 101, 255), head: 'swept', grille: 'bars', rim: 'spoke6', roofRails: true, dualExhaust: true }) },
  { id: 'tahoe', make: 'Chevrolet', model: 'Tahoe', ...make('suv', { L: 5.352, W: 2.058, H: 1.927, wb: 3.071, ...R(20, 118, 275), head: 'rect', grille: 'chrome', grilleBox: { w: 1.1, h: 0.36, y: 1.0 }, rim: 'spoke6', cornerF: 0.22, cornerR: 0.18, topR: 0.09, roofRails: true, gc: 0.23, tailShape: 'tall', tread: 2, hood: 0.215 }) },
  { id: 'grandcherokee', make: 'Jeep', model: 'Grand Cherokee', ...make('suv', { L: 4.914, W: 1.968, H: 1.792, wb: 2.964, ...R(20, 101, 265), head: 'rect', grille: 'slots', rim: 'spoke5', roofRails: true, tailShape: 'wide' }) },
  { id: 'wrangler', make: 'Jeep', model: 'Wrangler', ...make('suv', { L: 4.785, W: 1.875, H: 1.868, wb: 3.008, ...R(17, 165, 255), head: 'round', grille: 'slots', grilleBox: { w: 0.84, h: 0.36, y: 0.99 }, headlight: { w: 0.24, h: 0.24, x: 0.57, y: 1.01 }, rim: 'steel', rimColor: 0x1d1e20, cornerF: 0.08, cornerR: 0.08, topR: 0.05, botR: 0.03, tuck: 0.02, tumble: 0.04, ws: 0.08, hood: 0.24, roof: 0.53, back: 0.03, nose: 0.6, hoodH: 0.6, belt: 0.63, beltR: 0.63, tail: 0.61, gc: 0.27, spare: true, tailShape: 'tall', taillight: { w: 0.16, h: 0.22, y: 0.82 }, tread: 2, crown: 0.005, roofCrown: 0.004, plateRearY: 0.62 }) },
  { id: 'rogue', make: 'Nissan', model: 'Rogue', ...make('suv', { L: 4.648, W: 1.84, H: 1.699, wb: 2.705, ...R(19, 101, 235), head: 'swept', grille: 'chrome', rim: 'multi', roofRails: true }) },
  { id: 'modely', make: 'Tesla', model: 'Model Y', ...make('suv', { L: 4.751, W: 1.921, H: 1.624, wb: 2.89, ...R(19, 101, 255), head: 'swept', grille: 'none', rim: 'mesh', rimColor: 0x6d7076, hood: 0.2, ws: 0.24, roof: 0.27, back: 0.16, nose: 0.45, sunroof: true, plateFront: false, pillarsBlack: true, cornerF: 0.5 }) },
  { id: 'escape', make: 'Ford', model: 'Escape', ...make('suv', { L: 4.585, W: 1.882, H: 1.679, wb: 2.71, ...R(18, 113, 225), head: 'swept', grille: 'mesh', rim: 'spoke5', cornerF: 0.45 }) },
  { id: 'escalade', make: 'Cadillac', model: 'Escalade', ...make('suv', { L: 5.382, W: 2.06, H: 1.948, wb: 3.071, ...R(22, 101, 275), head: 'slim', headlight: { w: 0.5, h: 0.08 }, grille: 'chrome', grilleBox: { w: 1.1, h: 0.44, y: 0.95 }, rim: 'multi', rimColor: 0xd9dce1, cornerF: 0.2, cornerR: 0.16, topR: 0.09, gc: 0.22, tailShape: 'tall', taillight: { w: 0.12, h: 0.55, y: 1.2 } }) },
  { id: 'outback', make: 'Subaru', model: 'Outback', ...make('wagon', { L: 4.87, W: 1.855, H: 1.67, wb: 2.745, ...R(18, 102, 225), head: 'swept', grille: 'mesh', rim: 'spoke5', rimColor: 0x55585d, roofRails: true }) },
  { id: 'tucson', make: 'Hyundai', model: 'Tucson', ...make('suv', { L: 4.63, W: 1.865, H: 1.665, wb: 2.755, ...R(19, 101, 235), head: 'slim', grille: 'mesh', rim: 'multi', lightBarRear: true }) },

  // ------------------------------------------------------------ pickups
  { id: 'f150', make: 'Ford', model: 'F-150', ...make('pickup', { L: 5.885, W: 2.03, H: 1.96, wb: 3.683, ...R(18, 140, 265), head: 'rect', grille: 'bars', grilleBox: { w: 1.15, h: 0.42, y: 1.05 }, headlight: { w: 0.3, h: 0.22, x: 0.79, y: 1.08 }, rim: 'spoke6', cornerF: 0.18, cornerR: 0.06, topR: 0.08, roof: 0.21, tread: 2, tailShape: 'tall', taillight: { w: 0.14, h: 0.3, y: 1.08, x: 0.93 }, chromeBumper: true, plateRearY: 0.62 }) },
  { id: 'silverado', make: 'Chevrolet', model: 'Silverado 1500', ...make('pickup', { L: 5.885, W: 2.063, H: 1.917, wb: 3.745, ...R(20, 125, 275), head: 'slim', headlight: { w: 0.36, h: 0.1, x: 0.8, y: 1.15 }, grille: 'chrome', grilleBox: { w: 1.2, h: 0.45, y: 1.0 }, rim: 'spoke6', cornerF: 0.16, cornerR: 0.06, topR: 0.08, tread: 2, tailShape: 'tall', taillight: { w: 0.14, h: 0.3, y: 1.06, x: 0.95 }, chromeBumper: true, plateRearY: 0.62 }) },
  { id: 'ram1500', make: 'Ram', model: '1500', ...make('pickup', { L: 5.817, W: 2.085, H: 1.971, wb: 3.569, ...R(20, 110, 275), head: 'rect', grille: 'mesh', grilleBox: { w: 1.25, h: 0.44, y: 1.04 }, headlight: { w: 0.32, h: 0.18, x: 0.8, y: 1.1 }, rim: 'spoke5', cornerF: 0.2, cornerR: 0.06, topR: 0.09, tread: 2, tailShape: 'tall', taillight: { w: 0.14, h: 0.3, y: 1.08, x: 0.96 }, chromeBumper: true, plateRearY: 0.62 }) },
  { id: 'tacoma', make: 'Toyota', model: 'Tacoma', ...make('pickup', { L: 5.392, W: 1.91, H: 1.793, wb: 3.235, ...R(17, 158, 265), head: 'swept', grille: 'slots', grilleBox: { w: 0.95, h: 0.34, y: 0.94 }, rim: 'spoke6', rimColor: 0x2b2d30, cornerF: 0.28, cornerR: 0.06, tread: 2, tailShape: 'tall', taillight: { w: 0.13, h: 0.26, y: 0.97, x: 0.88 }, plateRearY: 0.6 }) },

  // --------------------------------------------------------------- vans
  { id: 'odyssey', make: 'Honda', model: 'Odyssey', ...make('minivan', { L: 5.212, W: 1.994, H: 1.735, wb: 3.0, ...R(18, 110, 235), head: 'swept', grille: 'mesh', rim: 'spoke5', pillarsBlack: true }) },
  { id: 'pacifica', make: 'Chrysler', model: 'Pacifica', ...make('minivan', { L: 5.173, W: 2.022, H: 1.777, wb: 3.089, ...R(18, 111, 235), head: 'swept', grille: 'mesh', rim: 'multi', roofRails: true, lightBarRear: true }) },
  { id: 'transit', make: 'Ford', model: 'Transit', ...make('van', { L: 5.981, W: 2.059, H: 2.537, wb: 3.75, ...R(16, 154, 235), head: 'swept', headlight: { w: 0.42, h: 0.22, x: 0.74, y: 1.0 }, grille: 'bars', grilleBox: { w: 1.0, h: 0.32, y: 0.85 }, rim: 'steel', rimColor: 0x9ea3a9, cornerF: 0.32, cornerR: 0.06, topR: 0.16, tumble: 0.1, tailShape: 'tall', taillight: { w: 0.12, h: 0.42, y: 1.05, x: 0.94 }, plateRearY: 0.6 }) },
  { id: 'sprinter', make: 'Mercedes-Benz', model: 'Sprinter', ...make('van', { L: 5.931, W: 2.02, H: 2.616, wb: 3.665, ...R(16, 154, 235), head: 'swept', headlight: { w: 0.4, h: 0.2, x: 0.74, y: 1.02 }, grille: 'bars', grilleBox: { w: 0.85, h: 0.32, y: 0.86 }, rim: 'steel', rimColor: 0x9ea3a9, cornerF: 0.3, cornerR: 0.06, topR: 0.18, tumble: 0.12, tailShape: 'tall', taillight: { w: 0.12, h: 0.42, y: 1.05, x: 0.93 }, plateRearY: 0.6 }) },
];

export const BY_ID = Object.fromEntries(CATALOG.map((c) => [c.id, c]));

export const displayName = (c) => `${c.make} ${c.model}`;
