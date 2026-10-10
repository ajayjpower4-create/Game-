# Political Election Simulator

Pick any two people — famous or invented — run them through a three-month
campaign, then either rig the map yourself or let Claude Opus call the race.

Everything in it is fiction. The results are invented for play: not a poll, not
a forecast, and not a claim about any real person or real election.

## Running it

```bash
npm install
npm start
```

- Game hub: <http://localhost:3000/> — lists every game
- Building Design Simulator: <http://localhost:3000/building>
- Inspection Simulator: <http://localhost:3000/inspection>
- Election game: <http://localhost:3000/election>
- The original Swerve chatbot: <http://localhost:3000/chat>

Set `ANTHROPIC_API_KEY` before starting if you want Claude to call the
election. Without a key the game falls back to its own built-in model and says
so on the results screen — every screen still works offline.

```bash
ANTHROPIC_API_KEY=sk-ant-... npm start
```

`ELECTION_MODEL` overrides the model (default `claude-opus-4-6`).

## How a game runs

**1 · Draft your candidates.** Pick from the roster of famous names and the
game already knows their name recognition and where the public places them —
no description needed. Choose "someone I made up" instead and you write them
into existence: the description drives how well they poll, so words like
*veteran*, *billionaire*, *activist* or *conservative* actually move numbers.
Each candidate gets a party name and a colour, and you set election day (the
campaign window is the 90 days before it).

**2 · Three months of rallies.** Book each candidate into states across the
window. Where they go moves those states, spills over into the region, and
late rallies hit harder than early ones. "Auto-schedule 8 stops" spreads a
tour across the biggest prizes if you'd rather not click 16 times. Three
rallies each is the minimum to move on.

**3 · The message.** The line they close on, the stump speech behind every
rally, and up to five themes they hammer. Themes decide which states warm to
them — and more than three starts to blur the message.

**4 · Election day.** Two ways to finish:

- **Rig it.** Click through all 51 contests yourself (click once for candidate
  A, again for B, again to clear), then set the final vote totals. The game
  shows what your map *should* be worth — a projection with a plausible range
  for each candidate, based on real turnout baselines per state — and flags it
  when your popular-vote winner isn't your Electoral College winner.
- **Simulate it.** The whole campaign goes to Claude Opus, which calls all 51
  contests and the national popular vote and writes up what happened. State
  margins come from the local model so the returns look like returns.

**5 · The recap.** Winner, Electoral College and popular vote, the full map,
how it happened, both campaigns side by side with every rally they held, the
closest calls, the biggest blowouts and a full state-by-state table. Download
it as JSON, copy it as text, or print it.

## Saving

The game autosaves to your browser on every step and keeps the last eight
checkpoints, so a crash costs you at most the step you were in the middle of.
The Menu button reloads a checkpoint, exports a save file, imports one back, or
wipes everything.

## Layout

| Path | What it is |
| --- | --- |
| `public/election/data.js` | States (electoral votes, turnout, cultural lean, map position), themes, the famous roster |
| `public/election/sim.js` | The local election model — scoring, vote distribution, narrative. Pure functions, shared with the server |
| `public/election/game.js` | Screen flow, save system, all rendering |
| `public/election/style.css` | Styles |
| `server.js` | Routing (game at `/`, chatbot at `/chat`) plus `POST /api/election/simulate`, which prompts Claude and validates what comes back |

The map is a grid cartogram: one tile per state placed roughly where it sits on
a US map, sized the same regardless of area, so Rhode Island is as clickable as
Texas. All 538 electoral votes are the 2024–2030 apportionment.


---

# Inspection Simulator

Write a sixty-page home inspection report without writing sixty paragraphs. At
`/inspection`.

You type the address, the client, the company and the year built. Everything
else in the report is a click.

## Phone or computer

The start screen asks where you are working before anything else, and the pick
changes the layout (never the report). It guesses which one you are on from the
pointer type and window width, and the Menu switches at any time.

- **Phone** — one column, 44-48px tap targets, 16px inputs so iOS doesn't zoom
  on focus, the step rail collapses to a progress bar, menus open as full-screen
  sheets, the Information tables stack label-over-value, and a floating
  *+ Add defect* button follows you down the walkthrough.
- **Computer** — the wide layout: fields side by side, the defect menu on screen
  at once.

A window narrower than 720px gets the compact layout regardless of the pick, so
choosing "computer" on a phone can't strand you in a two-column form.

## How a report gets built

**1 · Intake.** Four screens of buttons and counters: house type, floors,
basement or slab, bedrooms, bathrooms, living rooms, kitchens, garage bays,
attic access, cladding, roof covering, heating, water heater, service amperage,
pipe materials, weather, occupancy, shutoff locations. Those answers fill the
Information table and the standing narrative of all sixteen report sections, and
they generate the room list a defect can be attached to (three bedrooms means
Master, Bedroom 2, Bedroom 3).

**2 · The walkthrough.** *Add defect* → pick the severity (Significant,
Marginal, Minor/FYI) → pick the section → pick the defect off the menu. The
report paragraph and the contractor recommendation come attached. Optionally
choose a location and type your own note; you don't have to type anything.
There are 247 defects in the menu across fourteen inspectable sections, filtered
by severity and searchable by keyword.

**3 · Anything not on the menu.** *Not on the menu…* takes a short title and a
sentence about what you saw, and Claude Sonnet writes the defect paragraph and
the recommendation in the same voice as the rest of the document — third person,
past tense, observation then consequence then recommended correction, no prices,
no guarantees.

**4 · Generate.** Claude summarizes the whole inspection into an overview and a
"what to address first" list, the findings get numbered the way an inspection
report numbers them (`10.1.2` = section ten, first item, second finding on that
item), and the document assembles: cover, table of contents, overview, summary
with a planning budget range, then every section with its Information table, its
standing narrative, and its numbered recommendations.

**5 · The score.** The game part. You are graded out of 100 on how many sections
you touched, how many findings you logged, how many carry a location, and how
many carry your own note — with the specific criticism spelled out ("2 findings
have no location attached").

Copy the report as text, download it as `.txt` or `.json`, or print it to PDF.
It autosaves to the browser on every click, and the Menu exports or imports a
save file.

Without `ANTHROPIC_API_KEY` set, both AI steps fall back to local text and the
report says so on screen — every screen still works offline.
`INSPECTION_MODEL` overrides the model (default `claude-sonnet-5`).

## Layout

| Path | What it is |
| --- | --- |
| `public/inspection/data.js` | The intake form, the sixteen sections, their Information blocks and standing narrative |
| `public/inspection/defects.js` | The defect menu — every canned write-up and recommendation |
| `public/inspection/report.js` | Numbering, summary, cost range, scoring, plain-text rendering. Pure functions |
| `public/inspection/game.js` | Screen flow, the defect picker, the rendered document |
| `server.js` | `POST /api/inspection/defect` (writes a custom defect) and `POST /api/inspection/summarize` (writes the overview) |

Nothing in this report is real. It is a simulator for practicing and drafting,
not a substitute for an inspection by a licensed inspector.


---

# Building Design Simulator

A site editor in real-time 3D. Set a lot, put buildings on it, and then edit
everything — every wall bay, every machine on every roof, every trailer, sign,
booth and tree — under a sun that moves with the clock, in whatever weather
you choose.

Open <http://localhost:3000/building>.

## How it looks

The game renders with WebGL (three.js, served from `node_modules`, so it works
offline):

- **Sun and sky.** A physical sky model with drifting clouds; the sun's
  position follows the time of day (east at dawn, south at noon, west at
  dusk), with warm low light at golden hour and blue hour after sunset. The
  same sky is baked into an environment map, so glass, car paint, water and
  wet tarmac reflect it.
- **Shadows** from a 4K (8K on Ultra) shadow map fitted to the lot, soft-edged,
  plus ambient occlusion in corners, under eaves and between parked cars.
- **Night.** Windows light up from inside (not all of them), lamp heads, wall
  packs, dock lights, canopy downlights and signs glow, the nearest lamps
  throw real light on the ground, every lamp leaves a pool of light on the
  asphalt, and bloom softens the bright bits. Stars and a moon come out.
- **Weather.** Clear, fair-weather cloud, overcast, rain (falling rain, wet
  reflective ground), thunderstorm (with lightning), fog, and snow (falling
  snow, white roofs and ground). **Seasons** recolour every tree.
- **Materials** are generated at start-up as tileable textures with normal
  and roughness maps, measured in feet: precast panels with joints, ribbed
  metal, brick in running bond, stone, render, timber boards, composite
  cassettes, membrane and standing-seam roofs, tiles, asphalt, concrete with
  joints, block paving, grass — with large-scale variation so no repeat shows.
- **Buildings are modelled, not painted**: punched windows with reveals,
  sills and mullions; curtain walls; balconies with glass balustrades;
  shopfronts with canopies; entrances with lit canopies; loading bays with
  dock shelters, bumpers, levellers and dock lights; roll-up doors with
  housings and bollards; open parking decks you can see into; parapets with
  copings; pitched, hipped, monopitch, barrel and sawtooth roofs with eaves,
  gutters and barge boards; rainwater pipes; and wall signs with raised,
  shadowed letters that are lit at night.
- **Around the lot**: rolling fields to a tree-lined horizon with a town in
  the haze, a street with kerbs, footways and markings and its own traffic,
  people walking about, flags that wave and wind turbines that turn.

## Cameras

| Mode | Controls |
| --- | --- |
| **Orbit** (1) — for editing | Drag to orbit · right-drag to pan · wheel zooms at the pointer · WASD slide · Q/E turn · double-click flies to a thing |
| **Drone** (2) | WASD fly · Space up · C down · right-drag or drag to look · wheel sets speed · Shift boosts |
| **Walk** (3) | WASD at eye height · Shift runs · click to look around (Esc frees the mouse) · you cannot walk through walls |

The minimap (top right) shows where you are and which way you face; click it
to go there. Preset views fly the camera to the front, back, sides, overhead,
a corner or street level.

## Everything is an object

Buildings included. Click anything to select it (it gets a glowing outline);
drag it to move it; turn it in 15° or 90° steps, duplicate it, nudge it with
the arrow keys, focus the camera on it, or delete it. Ctrl+Z undoes.

Nothing solid may share ground with anything else solid: drag a trailer into
a wall — or into another trailer — and it springs back, and a placement that
would land on something is refused with a red ghost. Bollards, cones, trees
and signs are scatter and exempt. Buildings go wherever you put them, and
whatever was standing there is pushed out to clear ground. Back a trailer,
box truck or van up near a loading bay and it squares itself onto the bay.

## What you can add

- **49 building models** in five families — sheds and industry (warehouse
  shell, mega shed, storage row, workshop, cold store, plant room, cross-dock,
  sawtooth mill, hangar, high-bay store, data hall, factory, repair garage,
  truck wash, recycling shed, research lab), offices and shops (office block,
  business-park office, tower, retail strip, glass pavilion, big-box store,
  supermarket, car showroom, hotel, shops with flats, medical centre, sports
  hall, car park deck, terrace of units), civic (fire station, school,
  library, chapel, police station), homes (apartment block, townhouses,
  detached house) and small buildings (small office, gatehouse HQ, pitched
  unit, link annex, lodge, kiosk, service-station shop, toilet block,
  greenhouse, barn, substation). Each takes any of seven claddings, six roof
  types, wall/trim/roof colours, a glass roof and a parapet.
- **34 machines**, placed by hand on any roof — or on the ground, where they
  stand on a concrete plinth — and dragged around once they are down:
  packaged and large rooftop units, chiller, cooling tower, condenser bank,
  exhaust fan, mushroom vent, flue, brick chimney, skylight, skylight dome,
  monitor, solar array, green roof, helipad, satellite dish, antenna mast,
  water tank, stair bulkhead, lift overrun, duct run, pipe rack, plant screen,
  a roof sign frame, a VRF condenser, energy recovery unit, kitchen upblast
  fan, boiler flue cluster and pump skid — and five **heavy units** that sit
  on steel dunnage with a grated walkway, handrails and a cat ladder: an air
  handling unit, a big air-cooled chiller, a twin-cell cooling tower, a
  50-ton rooftop unit and a dry cooler bank.
- **10 guard booths**: classic cabin, deep canopy, brick gatehouse, glass
  cube, container booth, twin-lane kiosk, pitched hut, raised lookout, round
  kiosk and a gate office — each lit inside at night, each with a fascia sign
  you write.
- **130 props** — boundary (mesh, palisade and timber fences, walls, guard
  rail, bollards, Jersey barriers, crowd barriers, cones, drums, speed bumps);
  **12 gates** (gate arm, heavy boom with skirt, sliding, cantilever, double
  swing and bi-folding speed gates, road blocker, rising bollards, tyre
  killer, pedestrian gate, turnstile and an entrance portal that carries your
  sign); **side roads** (two-lane road, service lane, bend, T-junction,
  crossroads, roundabout, turning head and zebra crossing — a straight road
  or junction laid across a fence, hedge or boundary wall cuts an opening in
  it, and a road that reaches the street gets a dropped kerb); the **plant
  yard** (louvred plant compound, low wall, screen wall, concrete plinth and a
  pipe bridge, for machinery beside the building); signs (monument, pylon, billboard,
  post and direction signs, stop/speed/parking/accessible signs, traffic
  light, flagpoles); lighting (area lights, double heads, flood masts, street
  lamps, heritage lanterns, bollard lights, CCTV); planting (broadleaf, oak,
  maple, birch, conifer, pine, palm, shrubs, hedges, flower beds, planters,
  boulders, ponds, fountains); yard (dumpsters, skips, compactor, recycling,
  shipping containers, generator, transformer, LPG and oil tanks, IBCs, gas
  cage, silo, water tower, pallets, racking, canopies, solar carport, EV
  chargers, fuel pumps and canopy, bus and smoking shelters, bike racks,
  benches, picnic tables, bins, hydrant, post box, vending machine, portable
  toilet, site cabin, scaffold, wind turbine, phone mast, power pole);
  vehicles (trailer, reefer, tractor unit, box truck, tanker, flatbed, dump
  truck, mixer, bus, van, pickup, SUV, car, hatchback, police car, ambulance,
  fire engine, forklift, excavator, tower crane, mobile crane); and people.

## Ducts and pipes

Six kinds — rectangular duct, round (spiral) duct, insulated flow-and-return
pipes, cable tray, conduit and a gas main. Pick one under **Ducts & pipes**
and click your way along: start on a machine (the run leaves from its top),
on a roof, on a wall or on the ground, and each click adds a corner. Runs
turn square corners by themselves — up first, across at the higher level,
down at the far end — so a duct can leave a rooftop unit, cross the roof,
drop down the wall and run across the yard to the next building. Double-click
or Enter finishes, Backspace takes back the last point, Esc stops. Whatever
is underneath holds a run up: stands on a roof, brackets on a wall, sleepers
on the ground and steel portals over open ground. A selected machine, on a roof or
on the ground, has a "Run duct or pipe from this machine" button, and a
selected run can be extended, shortened, restyled, resized, recoloured or
dragged. Runs follow a building when it moves.

## Doors and entrances

Select a building and open **Doors & entrances**: every door it has is listed
— entrances, steel doors, shopfronts, roll-up and garage doors and loading
bays — with buttons to slide it a bay left or right (round the corner at the
end of a wall), move it round to the next wall, change its type, fly the
camera to it, or take it out (the bay goes back to whatever the rest of that
wall is). Or turn on **door mode** and do it in 3D: click any wall of the
building to put a door there, drag a door along the wall or round a corner to
move it, and click a door to change it or take it out. The path, zebra
crossing, truck court or apron in front of a door moves with it, and the
people walking about head for the new doors.

## Walls, bay by bay

Select a building and its four walls come up as grids — one row per floor,
one column per bay. Pick a brush (window, ribbon glass, curtain wall,
balcony, shopfront, entrance, steel door, loading bay, roll-up door, garage
door, louvre, vent, open deck) and paint bays one at a time; the 3D model
rebuilds as you go. "Look at it" flies the camera to that wall. Doors, docks
and shopfronts only go on the ground floor.

What you put on a wall changes the ground in front of it: loading bays get a
concrete truck court with guide lines that parking keeps clear of, roll-up
doors get an apron, and every entrance gets a path and a zebra crossing.

## The site, the world, the numbers

- **Site** — lot size, and switches for pavement, parking (with accessible
  bays, wheel stops and planted islands), parked cars, markings, the street,
  and grass or gravel. Snap to grid and docks (hold Alt to place freely).
- **World** — time of day (or let the clock run, at four speeds), weather,
  season, traffic and people, and graphics quality (Low, Medium, High, Ultra).
  **Adaptive resolution** (on by default) lowers the render resolution a
  little when frames run long and raises it again when they don't; a step
  that doesn't actually help (say, a 30 fps battery-saver cap) is undone.
  Phones, tablets and small laptops start on Medium.
- **Stats** — floor area, coverage, floor area ratio, parking bays and the
  ratio per 1,000 sq ft, docks, entrances, windows, rooftop and ground
  machines, duct and pipe runs and their length, side road pieces, trees, and
  a rough build cost.
- **Saves** — the site autosaves; keep named copies, open them again, or
  export and import a `.building.json` file.
- **Photo mode** (P) hides the editor; take a picture at screen or double
  resolution. **Measure** draws a line between two points and gives its length.

## Keys

| Key | What it does |
| --- | --- |
| 1 / 2 / 3 | Orbit · Drone · Walk |
| Click / double-click | Select · fly to it |
| R / Shift+R | Turn the selection (or the thing being placed) |
| Arrows | Nudge the selection 2 ft (10 ft with Shift), relative to the camera |
| Delete | Delete the selection |
| F / N | Frame the selection · face north |
| T / L | Run the clock · jump between day and night |
| P / M / G | Photo mode · minimap · snapping |
| Enter / Backspace | Finish a duct or pipe run · take back its last point |
| Esc | Cancel placement or drawing, leave door mode, stop measuring, deselect, or leave Drone/Walk |
| Ctrl+Z / Ctrl+Shift+Z / Ctrl+D / Ctrl+S | Undo · redo · duplicate · saves |

## Layout

| Path | What it is |
| --- | --- |
| `public/building/geom.js` | Plan geometry: footprints, overlap tests, wall frames |
| `public/building/catalog.js` | The object model, catalogues, presets, save migration |
| `public/building/site.js` | Site rules: collisions, eviction, dock snapping, the paving and parking plan, stats |
| `public/building/engine/core.js` | Renderer, sky, sun and moon, weather, post-processing, cameras, picking |
| `public/building/engine/textures.js` | Procedural tileable textures and sign lettering |
| `public/building/engine/materials.js` | PBR materials and the night/wet/snow/season switches |
| `public/building/engine/builder.js` | Builds models from parts and merges them per material |
| `public/building/engine/ground.js` | Terrain, street, paving, truck courts, parking, scenery |
| `public/building/engine/buildings.js` | Buildings: every wall bay, every roof type, signs, roof plant |
| `public/building/engine/props.js` | Props and booths, side roads, gates, plant-yard walls |
| `public/building/engine/runs.js` | Duct and pipe runs, their supports, square-cornered routing |
| `public/building/engine/vehicles.js` | Vehicles |
| `public/building/engine/nature.js` | Trees and people |
| `public/building/engine/world.js` | Keeps the 3D scene in step with the save; parked cars; light pools |
| `public/building/engine/life.js` | Traffic, pedestrians, flags, turbines, rain and snow |
| `public/building/game.js` | The editor: panels, placement, dragging, undo, saves, photo mode |

## Performance

Edits stay quick on big sites: the paving and parking plan is worked out with
a coarse box test before any exact one (about twenty times faster), and a
change rebuilds only the objects it touches. Shadows are redrawn only when
something changes, at most fifteen times a second; the sky's reflection map
is re-baked at most once a second while the clock runs; things too small to
see from where the camera is are skipped (their shadows stay); parked cars
are instanced. The frame-rate counter (World tab) shows frames per second,
draw calls, triangles and the current render scale.

Every site in it is invented. It is a toy for sketching a layout, not a set of
construction documents.
