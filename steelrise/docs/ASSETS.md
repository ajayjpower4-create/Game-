# Asset specifications for higher fidelity

Phase 1 builds everything from engine parts with Roblox built-in materials,
which keeps it runnable without uploads. These are the external assets that
would raise visual quality most, in priority order. All dimensions are in
metres; the game's world scale is **3 studs per metre**.

General rules for meshes:
* Real-world scale, +Y up, pivot where noted, quads triangulated on export,
  FBX. ≤ 10k tris for hero pieces, ≤ 2k for repeated members.
* Provide a simple collision proxy (box/convex) as a separate mesh; set
  `CollisionFidelity = Box` or `Hull` for anything that repeats.
* Two LODs for anything that appears hundreds of times (steel members, deck,
  scaffold): LOD0 full, LOD1 ≈ 25 % triangles; Roblox `RenderFidelity =
  Automatic`.
* PBR via `SurfaceAppearance` (ColorMap, NormalMap, RoughnessMap, MetalnessMap),
  1024² for hero assets, 512² for repeated members, tiling trim sheets
  preferred over unique UVs.

## 1. Material variants (MaterialService) — biggest win, lowest cost
| Variant | Base material | Maps | Notes |
|---|---|---|---|
| SR_PrimedSteel | Metal | 1024² tiling: color, normal, roughness, metalness | grey shop primer with handling scuffs, mill-scale edges |
| SR_MillScale | Metal | 1024² | dark blue-grey mill scale, light rust bloom |
| SR_Galvanized | Metal | 1024² | spangle pattern, white-rust staining |
| SR_ConcreteBoard | Concrete | 1024² | board-formed precast, form-tie holes, chamfer staining |
| SR_ConcreteFresh | Concrete | 1024² | darker, damp |
| SR_CompactedFill | Ground (terrain) | 1024² | tyre ruts, gravel |
| SR_Plywood | WoodPlanks | 1024² | weathered formply |
| SR_CheckerPlate | DiamondPlate | 1024² | 8 mm raised pattern, worn |

## 2. Meshes
| Asset | Pivot | Notes |
|---|---|---|
| W-shape beam end detail (cope + bolt holes), per depth | beam top-flange end | replaces flat ends; fillets between web and flange |
| Shear tab / clip angle set | column face | bolt holes, weld fillet |
| Column base plate + anchor nuts/washers | plate bottom centre | hex nuts, plate washers |
| HSS brace knife-plate end | brace end | slotted tube |
| 1.5" fluted deck sheet 0.75 m × 1 m tile | bottom centre | trapezoidal ribs; tiled along length |
| Ring-lock rosette, wedge head, base jack, spigot | part centre | the scaffold pieces repeat a lot — keep ≤ 300 tris |
| Hex bolt + nut + washer | bearing face | 3 sizes (M20/M24/M30) |
| Tower crane mast section (1.6 m × 3 m) | base centre | lattice with gussets, ladder, rest platform |
| Jib section (3 m), jib tip, counter-jib, cab, slewing unit | section root | flat-top crane, yellow paint with wear |
| Trolley + hook block (with sheaves, latch) | hook bowl | yellow/black stripes as texture |
| Flatbed trailer 16 m, tractor (long-hood) | road level, bed centre | tyres, lights, stake pockets, mud flaps |
| Ratchet strap + ratchet | strap end | flexible strap as segments |
| Temporary fence panel + feet, windscreen | foot centre | mesh as alpha texture |
| Site props: cones, barriers, jersey barrier, gang box, gas cage, toilet, dumpster, site office, light tower, generator | base centre | |

## 3. Textures / decals
* Fence banner and gate sign artwork (STEELRISE wordmark, PPE pictograms),
  2048 × 512.
* Piece-mark stencils (e.g. `B-12`, `C-4`) for steel, white spray texture.
* Crane counter-jib branding panel.
* Loading-screen background art (optional — the procedural one stays as the
  fallback): 1920 × 1080 cinematic site at dusk, charcoal/steel/off-white with
  safety-yellow accents.

## 4. Animation
* Carry pose (two-hand front carry, shoulder carry), impact-wrench hold,
  hammer swing, welding stance, ladder climb — R15 animations uploaded by the
  experience owner.
