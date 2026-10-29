# STEELRISE: Construction Simulator — Roblox (Phases 1–4)

A hands-on steel-construction game for Roblox PC. You receive materials on
flatbed trucks, release the ratchet straps, rig pieces to a working tower
crane, fly them into place with real sway, land them on their connections,
bolt or weld them, unhook, and build scaffolding to reach the next level.
The delivered object *is* the installed object — the same model moves from
the truck deck to the frame.

Everything is built at runtime from engine parts and Roblox built-in
materials, so the place runs with **no uploaded assets**. No audio IDs are
invented: every sound slot is wired up but silent until you supply audio
(see [`docs/AUDIO.md`](docs/AUDIO.md)).

> **How this was tested:** Roblox Studio can't run here, so every script is
> run in `tools/sim` — a Lua mock of the Roblox engine with strict property
> types — which boots the server, loads all eight sites, saves and continues,
> orders truck and rail deliveries, drives the crane, carries, pours and
> trowels a slab, and clicks through loading screen → menu → Play. Models are
> checked with a small software renderer. Engine-specific behaviour (physics,
> streaming, DataStores, real rendering) still needs a Studio pass.

---

## 1. Install and run

### Option 0 — ready-made place file (easiest)

Download [`dist/STEELRISE.rbxlx`](dist/STEELRISE.rbxlx) (on GitHub: open the
file, then the download button), double-click it to open it in Roblox
Studio, and press **Play**. You start in the main menu — click **PLAY** or
**Start New Construction** to spawn on the site.

The file is generated from `src/` by `python3 tools/build_rbxlx.py`; re-run
it after changing any script.

### Option A — Rojo

1. Install [Rojo](https://rojo.space) 7.4 or newer and the Rojo Studio plugin.
2. From this folder:
   ```bash
   rojo build default.project.json -o STEELRISE.rbxlx
   ```
   Open `STEELRISE.rbxlx` in Roblox Studio. (Or run `rojo serve` and click
   *Connect* in the Studio plugin to live-sync into an empty Baseplate.)
3. The project file already sets `Workspace.StreamingEnabled = true`
   (min radius 256, target 1024) and `Lighting.Technology = Future`.
4. **Delete the Baseplate and the default SpawnLocation** if you synced into
   a template — the game builds its own terrain and spawns players itself.
5. For saves that persist: publish the place, then *Game Settings → Security →
   Enable Studio Access to API Services*. Without it the game still works and
   saves for the session only (it tells you so in the menu footer).
6. Press **Play**.

### Option B — manual copy into Studio

Create this hierarchy and paste each file's contents into a script of the
listed type (the name in Studio is the file name without the suffix):

```
ReplicatedFirst
└─ LoadingScreen                LocalScript   src/ReplicatedFirst/LoadingScreen.client.lua
ReplicatedStorage
└─ Steelrise                    Folder
   ├─ Config                    ModuleScript
   ├─ Util                      ModuleScript
   ├─ Remotes                   ModuleScript
   ├─ ModelFactory              ModuleScript
   ├─ ItemRegistry              ModuleScript
   ├─ BuildRules                ModuleScript
   ├─ Sites                     ModuleScript
   ├─ CraneMath                 ModuleScript
   └─ AudioRegistry             ModuleScript
ServerScriptService
└─ Steelrise                    Folder
   ├─ Main                      Script        (Main.server.lua)
   ├─ WorldFactory              ModuleScript
   ├─ Packing                   ModuleScript
   ├─ ComponentService          ModuleScript
   ├─ DeliveryService           ModuleScript
   ├─ CraneService              ModuleScript
   ├─ SaveService               ModuleScript
   └─ SiteService               ModuleScript
StarterPlayer
└─ StarterPlayerScripts
   └─ Steelrise                 Folder
      ├─ ClientMain             LocalScript   (ClientMain.client.lua)
      ├─ State, UIKit, Net, Audio, Settings, View          ModuleScripts
      ├─ MainMenu, HUD, Catalog                            ModuleScripts
      ├─ Interaction, Placement, CraneClient               ModuleScripts
      └─ TrailerAnim, Blueprint, FX, Footsteps, Tutorial   ModuleScripts
```

Then set in Properties: `Workspace.StreamingEnabled = true`,
`StreamingMinRadius = 256`, `StreamingTargetRadius = 1024`,
`Lighting.Technology = Future`, and remove the Baseplate/SpawnLocation.

**Dependencies:** none beyond Roblox itself. No packages, no plugins at
runtime, no HttpService calls (JSON helpers only), no asset uploads.

---

## 2. Controls (keyboard and mouse)

| On foot | |
|---|---|
| WASD / Space | Walk / jump |
| Mouse | Look and aim (first person) · cursor aim (third person) |
| V | First / third-person view |
| E | Interact: pick up, release strap, enter crane cab, release empty truck |
| LMB | Place carried item · **hold** to fasten with the equipped tool · **hold** to pour with the pump hose |
| R · Z / C | Rotate 90° · fine rotate (15° in free placement) |
| T | Free placement (props and equipment only) |
| Arrow keys (+Shift) | Nudge in free placement, 0.1 m (0.5 m) |
| G | Drop carried item |
| Hold X | Dismantle the aimed component (needs its tool) |
| F | Switch equipment on/off (light tower, generator, welder, power board) |
| 1 – 7 | Hands · impact wrench · scaffold hammer · welder · crane radio remote · concrete pump hose · trowel |
| Tab | Catalog & deliveries |
| B | Blueprint ghosts on/off |
| J | Task panel |
| P | Site menu: save slots, load, blueprint, settings, return to menu |
| F1 | Help overlay |

| Crane (cab or radio remote) | |
|---|---|
| A / D | Slew left / right |
| W / S | Trolley out / in |
| R / F | Hoist up / down |
| Z / C | Rotate load (taglines) |
| Shift | Precision mode (25 % speed) |
| G | Hook the load under the hook · unhook |
| Enter | Land the load on its connection |
| H | Alignment assist (target ghost + directions + extra sway damping) |
| V | Camera: cab → hook → exterior (remote: player → hook → exterior) |
| RMB drag · wheel | Orbit / zoom the exterior camera |
| Hold Y | Recover a stuck load to the laydown yard (also a panel button) |
| X | Leave the crane controls |

---

## 3. How the systems fit together

```
ItemRegistry ──► ModelFactory (geometry)        Sites ──► layout(grid) ──► blueprint entries
     │                                             │            │
     ├──► BuildRules (sockets, solve, validate) ◄──┘            └─► starting stage / previews
     │          ▲                    ▲
     │          │ client preview     │ server re-validation
     ▼          │                    │
 Catalog ──► DeliveryService ──► Packing ──► trailer cargo (Restrained)
                                     │
                     straps released ▼
          ComponentService: Loose ─► Carried (hand) ─► Placed ─► Installed
                              └────► Rigged (CraneService) ─┘    (fasteners)
                                                │
                       CraneMath (shared kinematics) ◄── CraneClient (operator sim + render)
                                                │
                                   SaveService snapshot / restore
```

* **Item registry** (`ItemRegistry.lua`) — one definition per item: kind,
  size, weight → handling class, geometry builder, connection plugs/sockets,
  fasteners, lift points, rigging mode, transport pose. Catalog, deliveries,
  placement rules, crane rigging and saves all read the same entry.
* **Model factory** (`ModelFactory.lua`) — builds every item from real
  dimensions (AISC W-shapes, HSS, fluted deck, ring-lock scaffold, precast
  footings). All parts anchored; components move with `PivotTo`.
* **Connections** (`BuildRules.lua`) — installed components publish sockets
  (beam seats, gusset mounts, column tops, rosettes…). Items snap by matching
  their plugs to compatible free sockets: *Point* (column on footing), *Span*
  (beam between two seats exactly one bay apart, braces at their pitch,
  platforms on four uprights), *Surface* (deck bearing on two beams, tiled to
  the deck width) and *Rest* (footings and props on grade/decks, scaffold base
  jacks snapping to the bay lattice). `validate` returns specific reasons:
  overlap, wrong connection type, missing support, unfastened support, out of
  reach, outside the boundary, panel facing the wrong way.
* **Deliveries** (`DeliveryService.lua`, `Packing.lua`) — a request packs the
  order onto one or more 16 m flatbeds by weight (22 t) and space: blocks per
  item type, layers on dunnage, a ratchet strap or two per block. Trucks drive
  into free bays (animated on clients), stacks stay locked until all of their
  straps are released, unloading leaves real gaps, and an empty truck can be
  released (or leaves by itself after two minutes). Deliveries are free.
* **Hand handling** (`ComponentService.lua`) — Light (≤25 kg) and Medium
  (≤75 kg) items are welded to the character server-side (Medium: slower walk,
  no ladders); Heavy items need the crane. You can't pull a piece out from
  under another one.
* **Crane** (`CraneService.lua`, `CraneMath.lua`, `CraneClient.lua`) — a
  flat-top tower crane per site (mast lattice with a climbable ladder, slewing
  unit, cab, triangular jib, counter-jib with winch and counterweights,
  trolley, hook block, hoist falls). The operator's client simulates
  acceleration/braking, a damped pendulum (real g at world scale), load-chart
  radius limits, ground/deck stops and collision stops, and streams state at
  15 Hz; the server clamps each update to speed/travel/load-chart limits and
  publishes it. Attach/land/release/recover are validated on the server.
  Rigging modes: *bridle* (keeps orientation), *top lug* (columns hang plumb),
  *choker* (braces hang at their install pitch). A landed piece stays on the
  hook until its minimum connections are made. One operator per crane.
* **Scaffold** — base jacks, 2.0/1.0 m uprights with rosettes every 0.5 m,
  2.57/1.09 m ledgers (wedges hammered tight), diagonals, full-bay platform
  decks (need four uprights), toe boards and a climbable ladder. Platforms are
  solid walkable parts; extend upward by seating uprights on uprights;
  dismantle in reverse (dependency-checked).
* **Sites** (`Sites.lua`, `SiteService.lua`, `WorldFactory.lua`) — each site is
  a lot, a style (surroundings, lighting), a crane, unloading bays, a laydown
  yard and (for buildings) a column grid. `layout(grid)` expands the grid into
  every footing, column, beam, gusset, brace, deck sheet and facade unit; the
  starting stage is a filter over that list; the rest is shown as blueprint
  ghosts and tracked in the task panel. Menu previews use the same data.
* **Saves** (`SaveService.lua`) — snapshot of every component (id, item,
  pose, state, fasteners, supports, restraint, trailer), trucks with their
  dunnage and strap states, crane pose. Interrupted lifts are saved safely in
  the laydown yard (never duplicated), carried items at the carrier's feet.
  Three manual slots + autosave every 3 minutes (and on leave/shutdown),
  settings and favourites in a separate key.

### Remotes (created by `Remotes.lua` under `ReplicatedStorage.SteelriseRemotes`)

| Name | Type | Calls |
|---|---|---|
| Menu | RemoteFunction | `Info` |
| Site | RemoteFunction | `Start(siteId, "new"/"continue"/"join", slot)`, `Blueprint(id)`, `Menu` |
| Delivery | RemoteFunction | `Request(itemId, qty)`, `Dismiss(trailerId)` |
| Handle | RemoteFunction | `PickUp(id)`, `Drop`, `Place(id, cframe, free)`, `Release(strapId)`, `Toggle(id)` |
| Build | RemoteFunction | `Equip(toolId)`, `Fasten(id, index)`, `Dismantle(id)` |
| Crane | RemoteFunction | `Enter`, `Remote`, `Exit`, `Attach(id)`, `Land(cframe)`, `Release`, `Recover` |
| Save | RemoteFunction | `Save(slot)`, `Settings(table)`, `Favorite(id, on)` |
| CraneStream | UnreliableRemoteEvent | operator → server state stream |
| Notify / FX / Progress | RemoteEvent | toasts · effects/audio · gameplay events |

All functions return `ok, message, data`; the server rate-limits each player.

### Attributes used at runtime

* Component models (`Workspace.SteelriseSite.Components`): `ComponentId`,
  `ItemId`, `State`, `Holder`, `RestraintId`, `TrailerId`, `Fastened` (bit
  string), `SupportedBy` (csv ids), `On` (equipment).
* Crane model: `CraneId`, `S_slew`, `S_trolley`, `S_hoist`, `S_swingX`,
  `S_swingZ`, `S_loadYaw`, `Operator`, `Mode`, `LoadId`, `RigOffset`,
  `RigStart`, `RigTime`, `Locked`, `ResetSeq`.
* Trailer models: `TrailerId`, `Bay`, `ArriveAt`, `DepartAt`, `Manifest`
  (JSON), `Remaining`, `Empty`. Straps: `StrapId`, `Group`, `TrailerId`.
* Site folder: `SiteId`, `Ready`, `BoundsMin/Max`, `Blueprint`,
  `BPInstalled`, `BPTotal`, `NextTask`, `Host`.

---

## 4. Sites

| Site | Grid | Starting stage | Difficulty |
|---|---|---|---|
| Empty Land | free build (+ Starter Frame / Workshop blueprints) | bare graded lot | Beginner |
| Office 1 — Suburban Business Park | 4×3 bays · 7.5 m · 3 storeys | all footings + 4 columns | Beginner |
| Office 2 — Downtown Corner | 3×3 · 6.0 m · 6 storeys | skeleton L1–4 with gaps, street-side deliveries | Standard |
| Office 3 — Waterfront Offices | 5×3 · 7.5 m · 5 storeys | frame L1–3, decks L1–2, glazing started | Standard |
| Office 4 — Industrial District | 6×2 · 9.0 m · 2 storeys | partial L1 frame, metal walls started | Standard |
| Office 5 — City Center Tower | 3×3 · 7.5 m · 12 storeys | frame L1–6, decks L1–5, 70 m mast | Advanced |
| Apartment Building | 5×2 · 6.0 m · 6 storeys | frame + decks L1–3, facade L1 | Standard |
| High-Rise Building | 4×4 · 7.5 m · 20 storeys | frame L1–4, decks L1–3, 100 m mast | Expert |

All eight load into a buildable environment with the structural kit. The
apartment's partitions/balconies/fittings, roofing, slabs and the freight
train are Phase 2+ (below).

---

## 5. Status

### Phase 1 — core loop
* Loading screen with six real stages, timeouts on every stage, procedural
  cinematic background, fade into the menu.
* Main menu with live 3D previews of every site's starting stage.
* Full loop: catalog → delivery → strapped load → release → carry or crane →
  snap/align → land → fasten → unhook; dismantling with dependency checks.
* Tower crane with cab, radio remote, three cameras, sway, load chart,
  collision stops, alignment assist, recovery.
* Placement preview with specific failure reasons; modular scaffold;
  blueprint ghosts and task panel; 3 save slots + autosave; settings;
  tutorial; co-op structure with server validation.

### Phase 2 — vehicles, crane, interface
* New detailed long-hood tractor and 53 ft flatbed (chrome grille, twin
  headlights, fenders, air cleaners, stacks, sleeper, fuel tanks, mirrors,
  planked deck, rub rails, strap winches, air-ride tandem, landing gear) with
  wheels that spin while driving in and out.
* New tower crane model: angle-chord mast with K-lacing, joint plates and
  rest platforms, load-chart board, slewing platform with motors, framed cab,
  jib with walkway and section pins, counter-jib with winch, electrical house
  and hung counterweights, trolley with maintenance basket, hook block with
  swivel and capacity plate.
* Chat window setting: **Small** (default), Normal or Hidden.

### Phase 3 — building content
* **Concrete:** pump hose (6) pours a slab over a fully welded deck bay; the
  trowel (7) finishes four marks and the slab cures from dark to light grey.
* **Roofing:** insulated roof deck on the top floor, parapets, roof hatch,
  skylight.
* **Envelope:** wall panels with personnel doors, window bands, overhead
  doors, precast, thin brick and louvres, plus the curtain wall.
* **Interiors:** demountable partitions (solid / door / glazed) on the
  finished floor; steel stair flights.
* **Balconies** on apartment floors; **MEP** plant (rooftop units, AHU,
  switchboard, transformer, standby generator, fire pump, etc.).
* Blueprints include slabs, roof deck, parapets and balconies.

### Phase 4 — logistics, catalog, weather
* **Rail deliveries** on the Industrial site: choose *Rail* in the catalog;
  a locomotive brings strapped flatcars onto the siding (two spots); unload
  them with the crane; empty cars leave on their own.
* **Catalog: 546 items** (479 installable, 18 functional equipment, 42
  decorative, 7 tools) — more W-shapes, a 3.0 m bay, 3.0 m and 4.8 m storeys,
  larger footings, every standard ring-lock scaffold size, rigging gear,
  machinery, safety equipment and site furnishings. Size variants are real
  geometry changes, never recolours. The grid is virtualised (only on-screen
  cards exist) with a bounded thumbnail cache.
* **Wind:** gusty per-site wind pushes hanging loads (more at height and on
  big light pieces); the crane panel shows it; no new lifts above 15 m/s.
* **Time of day** (site menu, host): morning → night; street lights follow.

### Temporary / procedural assets
* All models are engine parts with built-in materials (Metal, DiamondPlate,
  Concrete, Glass, WoodPlanks, Fabric…). No meshes, textures, decals,
  MaterialVariants or images are used. [`docs/ASSETS.md`](docs/ASSETS.md)
  specifies the meshes/textures that would replace them.
* Sky is the default Roblox sky + dynamic `Clouds`; the loading background is
  drawn with UI frames.
* **Audio is silent** apart from Roblox's default character sounds until you
  fill `AudioRegistry.lua` — 39 slots listed in [`docs/AUDIO.md`](docs/AUDIO.md).

### Untested (needs a Studio pass)
Nothing here has been executed in Roblox. Expect a round of tuning on:
crane feel (speeds, damping, collision box sizes), carry hold offsets,
first-person mouse release on overlays (uses `Modal` buttons), ViewportFrame
framing, terrain surface heights for footings (validation tolerance 0.15
studs), trailer packing visuals, DataStore behaviour, streaming radius with
the 100 m high-rise crane, UI scale at unusual resolutions, wind strength,
the chat window size (TextChatService only), and the train approach speed.

### Performance target
Target: **60 FPS at 1080p** on a mid-range PC — Intel Core i5-10400 or
Ryzen 5 3600, GTX 1660 Super or RX 5600 XT, 16 GB RAM, Roblox graphics
quality Automatic. **Not measured** (no Roblox runtime here). Design choices
toward it: everything installed is anchored (no physics for structure, bolts
are inert parts), the crane is kinematic (no constraint solver), loads move
only while rigged or carried, streaming enabled with atomic component
models and a persistent crane, deck sheets and fasteners use few parts,
catalog/menu previews are lazy (≤48 live thumbnails), blueprint ghosts are
single proxy parts limited to the working level and 450 pieces, preview
decks are merged per bay, tiny details don't cast shadows or collide.
Heaviest starting site (Office 5 / High-Rise) is roughly 5–7k parts.

---

## 6. Testing Phase 1 in Studio — checklist

1. **Loading** — Play: loading stages tick through 1–6 with a moving bar; the
   detail line says no custom audio is configured; it fades into the menu.
   Temporarily rename an `ids` entry to a bad id → loader reports
   "1 asset(s) unavailable" and still continues.
2. **Menu** — camera orbits the crane; Site Selection shows 8 cards with 3D
   previews; Office 2's preview shows a four-level skeleton with gaps; Settings
   sliders change volume/FOV live; Controls and Credits open.
3. **Start Empty Land** — you spawn near a truck in bay 1 with footings,
   columns and beams strapped on the deck and a scaffold kit + deck sheets in
   the laydown yard. Tutorial card appears.
4. **Strap** — aim at an orange strap, E: strap disappears; pieces under it
   become pickable/riggable only when all straps on that stack are off.
5. **Crane** — press 5 (remote) or E at the mast gate (cab). WASD/R/F move
   smoothly with ramp-up and braking; the hook swings when you stop; Shift
   slows everything; V cycles cameras. Drive the hook into the mast or a
   stack → "CONTACT" and the motion stops.
6. **Rig & land a footing** — hover the hook above a footing, G hooks it
   (slings appear, the footing eases under the hook). Lift it off the stack,
   H for assist: a green/red ghost on the nearest grid spot and directions.
   Lower to ground → ENTER lands it. G unhooks.
7. **Column** — hook a column: it swings upright from its top lug. Land on
   the footing (ENTER). Try G before bolting → refused with a count. X out,
   press 2, hold LMB on the four yellow nuts → column turns installed, its
   lifting lug disappears; take the remote again (5), G unhooks.
8. **Beam** — erect a second footing + column 6.0 m away (Starter Frame
   ghosts show where). Hook a W16×31 6.0 m beam; land it between the two
   column tops; bolt both ends with the wrench; unhook. Try a beam on columns
   at the wrong spacing → placement reason names the distance.
9. **Deck & plates** — pick up a deck sheet (Medium, slow walk), aim at the
   installed beam's top flange: ghost tiles to 0.75 m; second beam missing →
   red "Missing support at the other end". Place on two beams, weld with 4.
10. **Scaffold** — carry base jacks (snap to a 2.57 × 1.09 m lattice), seat
   uprights, ledgers between rosettes (hammer wedges with 3), a platform deck,
   a ladder; climb the ladder and walk on the platform. Dismantle a ledger
   under a platform → refused until the platform is removed.
11. **Catalog** — Tab, search "W18", favourite an item, request 4 → a truck
   drives in to a free bay with the order strapped on it; the task panel lists
   it. Unload it fully → E on the cab releases the truck, it drives away.
12. **Recovery** — hook a load, hold Y → it appears in the laydown yard, hook
   resets.
13. **Save/resume** — P → Save to slot 1 while a load hangs on the hook.
   Return to menu → Continue: everything is where it was, partially bolted
   pieces keep their bolts, the hanging load is safely in the laydown yard
   (only once), straps you released stay released.
14. **Other sites** — start Office 1…High-Rise: each loads its starting stage,
   blueprint ghosts show the working level, the first truck carries the next
   work package.
15. **Co-op** (Studio *Test → 2 players*) — player 2 sees "Join"; both see
   the crane move smoothly; only one can operate it; both can bolt.

---

## 7. Remaining work

* Operable vehicles (telehandler, forklift, mobile crane) — currently
  parked props.
* Ground-floor slab-on-grade pours (partitions work from level 2 up).
* Completed-floor consolidation (merge finished floors into fewer parts).
* Licensed audio (all 39 slots are wired and silent); meshes, textures and
  MaterialVariants per `docs/ASSETS.md`.
* Full co-op roles, per-player saves on shared servers, and a measured
  performance pass in Studio with the MicroProfiler.
