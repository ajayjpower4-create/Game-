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

Open <http://localhost:3000/building> — or play the **Windows desktop
version** (a `.exe`, with a mods folder; see "Desktop version and mods" below).

The game opens on a **start menu** over a live 3D view of your site turning
slowly at golden hour: **Continue** goes straight back to the saved site;
**New site** opens the starting points and the lot size; **Load site** lists
your saved sites and imports a `.json` file; **Settings** sets the graphics
quality, adaptive resolution, grid snapping and the minimap; **What's new**
lists the latest additions (and on the desktop version there is a Quit
button). Esc closes a panel. The editor's **New site** button comes back here.

## How it looks

The game renders with WebGL (three.js, served from `node_modules`, so it works
offline):

- **Sun and sky.** A physical sky model with drifting clouds; the sun's
  position follows the time of day (east at dawn, south at noon, west at
  dusk), with warm low light at golden hour and blue hour after sunset. The
  same sky is baked into an environment map, so glass, car paint, water and
  wet tarmac reflect it.
- **Shadows** from a 4K (8K on Ultra and Max) shadow map fitted to the lot,
  soft-edged, plus ambient occlusion in corners, under eaves and between
  parked cars. **Cloud shadows** drift across the site on fair-weather days.
- **Night.** Windows light up from inside (not all of them), lamp heads, wall
  packs, dock lights, canopy downlights and signs glow, the nearest lamps
  throw real light on the ground — and on High and above the closest of them
  cast real shadows of poles, trucks and people — every lamp leaves a pool of
  light on the asphalt, and bloom softens the bright bits. Stars and a moon
  come out.
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
- **Water** moves: fountains throw arcing jets that fall into foaming pools,
  splash pads, wall spouts and reflecting pools run, and ponds sit in planted
  banks with lily pads.
- **Around the lot**: rolling fields to a tree-lined horizon with a town in
  the haze, a street with kerbs, footways and markings and its own traffic,
  people walking about, flags that wave and wind turbines that turn.

### Graphics settings

Five presets in the World tab:

| Preset | What it adds |
| --- | --- |
| Low | 2K shadows, SMAA edge smoothing, 4 night lights |
| Medium | MSAA, bloom, cloud shadows, 6 night lights |
| High | Ambient occlusion, 4K shadows, 2 lamps that cast shadows, light sharpening |
| Ultra | 8K shadows, 16× texture filtering, sharper reflections, 4 shadow-casting lamps |
| **Max** | Renders at 1.5× the screen's resolution (supersampling), 32-sample AO, 16 night lights, 6 shadow-casting lamps with 2K maps, a 1K reflection map |

**Photo mode** adds **depth of field**: what the camera is aimed at stays
sharp and the rest softens as through a real lens.

Past Max, every one of those numbers — and exposure, colour, fog, view
distance and field of view — can be set by a graphics mod (`graphics.json`
in the desktop version's mods folder) or from the browser console:

```js
BuildingSim.graphics({ quality: 'max', shadow: 16384, ss: 2, lampShadows: 10 })
BuildingSim.graphics()       // what is in force
BuildingSim.graphics(null)   // back to the plain preset
```

Settings made from the console are remembered; open the game with `?safe`
on the address (`/building?safe`) to start without them.

The full list of settings is in `desktop/mods-template/README.txt`.

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

- **97 building models** in seven families — sheds and industry (warehouse
  shell, mega shed, storage row, workshop, cold store, plant room, cross-dock,
  sawtooth mill, hangar, high-bay store, data hall, factory, repair garage,
  truck wash, recycling shed, research lab, food factory, print works,
  brewery, timber store, bottling plant, cleanroom fab, trade counter units),
  offices and shops (office block, business-park office, tower, retail strip,
  glass pavilion, big-box store, supermarket, car showroom, hotel, shops with
  flats, medical centre, sports hall, car park deck, terrace of units,
  corporate HQ, brick loft offices, bank branch, drive-thru restaurant, café
  pavilion, shopping mall, fitness centre, tyre and auto centre, car
  dealership, used-car superstore), civic (fire station, school, elementary school, high school,
  library, chapel, police station, hospital, town hall, museum, courthouse,
  university block, ambulance station), homes (apartment block, townhouses,
  detached house, bungalow, semi-detached pair, stone cottage, high-rise
  flats, modern villa, modern farmhouse, colonial house, ranch house,
  craftsman bungalow, garden apartments, podium apartments), hospitality and leisure (motel,
  cinema, bowling and arcade, pub, leisure pool, conference centre),
  transport and utilities (bus depot, railway station, pumping station,
  multi-storey car park, control room) and small buildings (small office,
  gatehouse HQ, pitched unit, link annex, lodge, kiosk, service-station shop,
  toilet block, greenhouse, barn, substation, lock-up garages). Each takes
  any of ten claddings (lap siding, board and batten and split-face block among
  them), six roof types, wall/trim/roof colours, a glass roof
  and a parapet.
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
  50-ton rooftop unit and a dry cooler bank. Casings are galvanised panels
  with seams, screws and weathering; fans sit in shrouds under wire guards.
- **10 guard booths**: classic cabin, deep canopy, brick gatehouse, glass
  cube, container booth, twin-lane kiosk, pitched hut, raised lookout, round
  kiosk and a gate office — each lit inside at night, each with a fascia sign
  you write.
- **282 props** — the new **cars**, **trucks**, **trailers**, **dealership**,
  **paint & drains**, **playground**, **garden tools** and **backyard** shelves
  (see the sections below), plus boundary (mesh, palisade, timber and black
  ornamental steel fences, walls, guard rail, bollards, sleeved pipe bollards in
  six colours, Jersey barriers, crowd barriers, cones, drums, speed bumps);
  **13 gates** (gate arm, heavy boom with skirt, sliding, cantilever, double
  swing and bi-folding speed gates, road blocker, rising bollards, tyre
  killer, pedestrian gate, turnstile, a card and ticket kiosk on its island and
  an entrance portal that carries your sign); **side roads** (two-lane road, service lane, bend, T-junction,
  crossroads, roundabout, turning head and zebra crossing — a straight road
  or junction laid across a fence, hedge or boundary wall cuts an opening in
  it, and a road that reaches the street gets a dropped kerb); the **plant
  yard** (louvred plant compound, low wall, screen wall, concrete plinth and a
  pipe bridge, for machinery beside the building); signs (monument, pylon, billboard,
  post and direction signs, stop/speed/parking/accessible and Do Not Enter
  signs, traffic light, flagpoles, A-board, LED message board, wayfinding totem, entrance
  wall with lettering, feather flag, overhead gantry sign, site rules board,
  site map board, speed display sign and printed hoarding — each with its
  own words and colours); lighting (area lights, double heads, four-head car lot
  lights on round piers, flood masts, street lamps, heritage lanterns, bollard
  lights); **CCTV** (twin-camera
  pole, bullet camera post, dome camera pole, PTZ mast whose camera sweeps
  back and forth, four-camera mast, ANPR camera on an arm, and a mobile CCTV
  tower on a trailer — see below); **parking** (a parking lot you size
  yourself, a small car park, an angled lot, pay station, trolley shelter, car
  park sign, row marker signs and precast wheel stops — see below); **park and leisure** (splash-pad fountain, wall
  fountain, drinking fountain, reflecting pool, steel sculpture, gazebo,
  pergola, playground, basketball court, raised bed, planter with tree, street
  tree in a grate); planting (broadleaf, oak,
  maple, birch, conifer, pine, palm, shrubs, hedges, flower beds, planters,
  boulders, ponds, fountains); yard (weighbridge, storage tent, battery
  storage, cycle shelter, cash machine, news kiosk, parcel lockers, bunded
  fuel tank, mobile yard ramp, lighting tower, site compressor, dumpsters, skips, compactor, recycling,
  shipping containers, generator, transformer, LPG and oil tanks, IBCs, gas
  cage, silo, water tower, pallets, racking, canopies, solar carport, EV
  chargers, fuel pumps and canopy, bus and smoking shelters, bike racks,
  benches, picnic tables, bins, hydrant (red, bronze, yellow, silver, blue or
  green), post box, vending machine, portable
  toilet, site cabin, scaffold, wind turbine, phone mast, power pole);
  vehicles (trailer, reefer, tractor unit, box truck, tanker, flatbed, dump
  truck, mixer, bus, van, pickup, SUV, car, hatchback, police car, ambulance,
  fire engine, forklift, excavator, tower crane, mobile crane, refuse truck,
  scissor lift, site buggy, motorbike, skid steer, camper van); and people.

## Cars and trucks

The **Cars** shelf has twenty-four detailed models, three from each of eight
makes — Toyota Camry, RAV4 and Tacoma, Ford F-150, Mustang and Bronco,
Chevrolet Tahoe, Corvette and Silverado, Honda Civic, Odyssey and CR-V, Tesla
Model 3, Cybertruck and Model Y, BMW 3 Series, X5 and M4, Mercedes-Benz
G-Class, Sprinter and C-Class, Jeep Wrangler, Grand Cherokee and Gladiator — built
at their real lengths, widths, heights and wheelbases. Bodies are lofted from
cross-sections with real wheel arches; each has its own grille, lamps, badges,
mirrors, door shut lines, handles, wipers, plates, wheels of its own design
with tyres, brake discs and calipers, and a cabin you can see through the
glass (seats, dashboard, steering wheel). Fourteen factory paints are a click
away. On High quality and up the parked cars and the traffic are these real
models too.

The **Trucks** shelf has six semi tractors: Freightliner Cascadia, Volvo VNL
860, Mack Anthem and International LT (aero sleepers with roof fairings and
chassis skirts) and the long-nose Peterbilt 389 and Kenworth W900 (chrome
grilles, air cleaners, twin stacks, sun visors). Each has its ladder frame,
leaf-sprung steer axle, air-ride drive tandem on dual wheels, polished
aluminium wheels with hub and nut covers, fuel tanks on straps, steps and
grab handles, the fifth wheel and deck plate with coiled red, blue and green
air lines, quarter fenders, mud flaps, west-coast mirrors, marker lights and a
cab interior.

The **Trailers** shelf has eight 8½ ft wide semi trailers: a 53 ft dry van
(posts, rails, swing doors with lock rods, side skirts), a 53 ft reefer with its
front refrigeration unit and fuel tank, a 48 ft flatbed carrying strapped
lumber behind a headache rack, a 53 ft step deck with steel, a stainless
tanker with dome lids and a catwalk, a two-deck car hauler loaded with six real
cars, a 40 ft container on a gooseneck chassis and an end-dump tub. Each has
landing gear, a sliding tandem on dual wheels, mud flaps, lamps, a rear underride
guard and reflective tape. Park one on its own, or pick a truck and choose a trailer
in its panel to hitch it: the kingpin sits over the fifth wheel and the rig
becomes one object you move and turn together, in any of eight trailer colours.
Makes and models are named only to say what each one is meant to look like;
no manufacturer logos are reproduced.

## The garden brush

**Add → Garden** paints planting straight onto the ground. Pick a plant —
boxwood, azalea, hydrangea, rose, Japanese maple, spreading juniper,
arborvitae, holly, ornamental grass, hosta, lavender, daylilies, variegated
liriope with its purple spikes, bedding flowers, tulips,
boulders or landscape stones — or a ground cover — brown, black or red mulch,
pine straw, river rock or pea gravel — then press and drag. Set the brush size
(1–40 ft) and density; hold **Shift** (or switch on the eraser) to take things
out. Plants keep clear of buildings and of each other, every one a little
different in size, turn and shade, flowering kinds in their own colours.
Thousands of plants cost a few dozen draw calls. Lay mulch first and plant
into it; the planting saves with the site and undoes like anything else.

## Paint and drainage

**Add → Paint & drains** draws on the pavement point by point (double-click
or Enter to finish): a **fire lane** (red stripe with FIRE LANE stencils), a
**red fire-lane kerb** lettered NO PARKING FIRE LANE on both faces, a
**yellow kerb**, white, yellow, double-yellow and dashed lines, a **stop
bar**, a **crosswalk**, a **hatched no-parking zone** (it closes back to its
first point) and a **trench drain** — a slot grate in a concrete haunch.
Square corners keeps lines to 45° steps. Each has its width, paint colour and
(for fire lanes) its own words. Then place **stencils** (any words, | for a
new line, with the usual ones a click away), arrows (ahead, left, right,
ahead-or-left, ahead-or-right), the accessible-bay and EV symbols, and
**drainage**: catch basin grates, kerb inlets with a no-dumping plaque, storm
and sewer manholes with lettered covers, lawn area drains, oil interceptor
lids and a culvert headwall with riprap.

## Dealerships

The **Car dealership** building has a glass showroom behind a tall brand
portal carrying its name, a covered service drive with its sign, and workshop
bays. Its **Dealer display lot** (Add → Dealership) is a lot you size with the
edge handles like any parking lot, plus the stock: arrange the cars **by
brand** (a make to a row), **by body style** (cars, SUVs, trucks and vans),
**by colour** (the whole lot runs through the paint chart) or mixed; stock
every make or just one; cars nose in or nose out; the front row up on display
ramps facing the road; price stickers in the windows; pennant strings round
the lot. Every car on it is a full make and model. The shelf also has a
display ramp, a feature turntable that turns with a car on it, pennant
strings, an air dancer that never stops waving, a pylon sign, a service drive
sign, a key drop box and a tyre rack.

The **Used-car superstore** is built in beige split-face block with smooth
bands: a raised, stepped parapet over a two-tier showroom front, an entrance
tower of block piers under a blue standing-seam gable left open on a white
steel truss, the store's name on a blue brand panel over the street number and
the double doors, blue bollards, and a service wing of full-view glass
overhead doors under a blue band with its sign. Type the store's own name in
**Name on the building** (the dealership and the schools take one too). The
shelf has its lot kit: a **store pylon** (stacked stucco base, lit blue
cabinet with the name and its dashes), **lot direction signs** (one line per
place, each led by an arrow — `< carriers / > service / ^ sales`), **row
marker signs**, a **card and ticket kiosk**, wheel stops, sleeved bollards,
the ornamental fence and four-head lot lights. The model follows the look of a
real store's photos but carries no one's brand: the name is whatever you write.

## Schools, homes, playgrounds and yards

The **elementary school** and **high school** have an entrance tower with
the school's name and a clock, a canopy over the doors and a flag that waves;
the high school's gym rises over its west wing. The **modern farmhouse**
(board and batten, a black metal porch, dormers, shutters, a two-car garage),
**colonial** (pedimented portico, shutters, three dormers, end chimneys),
**ranch** (hipped roof, covered entry, attached garage), **craftsman
bungalow** (deep porch on tapered columns over stone piers), **garden
apartments** (stair breezeway, back balconies, condensers) and **podium
apartments** (shops under five floors of flats, accent panels, a roof
terrace) join the homes.

**Playground**: a play structure (two towers, bridge, tube and wave slides,
climbing wall, fireman's pole), swing set, slide tower, dome climber, monkey
bars, a merry-go-round that turns, seesaw, spring rider, sandbox and a
playground mulch bed — each on its own wood-fibre safety surface.
**Planting** adds mulch beds (any ground cover, in steel edging), stepping
stones and a block retaining wall. **Garden tools**: wheelbarrow, push and
riding mowers, a rack of rakes, shovels, hoe, fork and broom, hose reel,
compost bins, garden shed, watering can, pot plants, birdbath and a gnome.
**Backyard**: fire pit and chairs, barbecue, patio set with umbrella,
trampoline, driveway hoop and a hammock.

## Parking lots you lay out

The site still parks itself if you want it to, but you can draw your own:
add a **Parking lot** (or the small or angled one) from the Parking
category, then drag the white handles on its edges to make it exactly the
size you want — the bays, aisles and planted end islands are worked out
again as you drag, and the hint shows how many bays fit. Its panel sets the
width and depth by number too, the bay angle (90°, 60° or 45°), the bay
width, how many accessible and EV-charging bays (blue and green, with signs
and chargers), how full it is with parked cars, kerbs, lighting, end islands,
the surface (asphalt, concrete, block paving or gravel) and the line colour.
Turn it like anything else. Its bays count in the stats, and "Turn off the
automatic parking" leaves only the lots you made. Ponds, flower beds and the
plant compounds have the same edge handles.

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

## Signs and cameras on buildings

Select a building and open **Signs & cameras** (right under its name). Pick
one of 12 signs — channel letters, a lightbox, a fascia panel, a projecting
blade sign, a logo roundel, neon script, an LED screen, a fabric banner, a
name plaque, a safety notice, a building number or rooftop letters on a steel
frame — or one of 4 wall cameras (bullet, dome, PTZ, turret), then click any
wall of the building in the 3D view to put it there. As many as you like, on
any wall. Drag one to slide it along the wall, up or down, or round the
corner; click one (in or out of placing mode) to edit it: its words and
second line, logo, text and panel colours, size, height on the wall, which
wall it is on, whether it lights up at night, plus nudge, copy and remove.
Delete takes the chosen one down; Esc stops placing. Lit signs, neon and
screens glow after dark. Sites saved before this keep their name signs —
each one becomes channel letters in the same place.

## CCTV

Every camera — on a pole or on a wall — has settings: its **colour** (white,
black, grey, beige, blue, red, green or yellow), **mount height** (a pole goes
from a few feet to 100 ft on the masts), **tilt**, which way it points (turn
the pole, or pan a wall camera), **night vision** (a ring of IR LEDs that glows
red after dark) and **Show what it sees**: a soft see-through cone of its
view, with an adjustable view distance, for planning coverage. A pole camera
can be **mounted on a building wall** (click "Mount it on a building wall",
then the wall), and a wall camera can be **put on a pole** in front of the
wall, keeping its settings.

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
  season, traffic and people, and graphics quality (Low, Medium, High, Ultra,
  Max — see "Graphics settings" above).
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
  resolution, with or without depth of field. **Measure** draws a line
  between two points and gives its length.

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
| Delete (placing signs) | Take down the chosen sign or camera |
| Esc | Cancel placement or drawing, leave door or sign mode, stop measuring, deselect, or leave Drone/Walk |
| Ctrl+Z / Ctrl+Shift+Z / Ctrl+D / Ctrl+S | Undo · redo · duplicate · saves |

## Layout

| Path | What it is |
| --- | --- |
| `public/building/geom.js` | Plan geometry: footprints, overlap tests, wall frames |
| `public/building/catalog.js` | The object model, catalogues, presets, save migration |
| `public/building/site.js` | Site rules: collisions, eviction, dock snapping, the paving and parking plan, stats |
| `public/building/lots.js` | Bays, aisles and islands inside a parking lot you sized, for any bay angle; dealer stock settings |
| `public/building/vehiclelist.js` | The real makes and models: car and truck dimensions |
| `public/building/engine/core.js` | Renderer, sky, sun and moon, weather, post-processing, cameras, picking |
| `public/building/engine/textures.js` | Procedural tileable textures and sign lettering |
| `public/building/engine/materials.js` | PBR materials and the night/wet/snow/season switches |
| `public/building/engine/builder.js` | Builds models from parts and merges them per material |
| `public/building/engine/ground.js` | Terrain, street, paving, truck courts, parking, scenery |
| `public/building/engine/buildings.js` | Buildings: every wall bay, every roof type, signs, roof plant |
| `public/building/engine/props.js` | Props and booths, side roads, gates, plant-yard walls |
| `public/building/engine/runs.js` | Duct and pipe runs, their supports, square-cornered routing |
| `public/building/engine/cameras.js` | CCTV heads, brackets and coverage cones, shared by poles and walls |
| `public/building/engine/vehicles.js` | Vehicles |
| `public/building/engine/cars.js` | The detailed car generator: lofted bodies, wheels, lamps, cabins, the twenty-four models |
| `public/building/engine/trucks.js` | The six semi tractors on a shared chassis, and hitching a trailer to one |
| `public/building/engine/trailers.js` | The eight semi trailers: tandems, landing gear, bodies and loads |
| `public/building/engine/garden.js` | The garden brush: plant models, instancing, ground covers, stamping and erasing |
| `public/building/engine/marks.js` | Pavement markings, painted kerbs, crosswalks, hatching, trench drains, stencil lettering |
| `public/building/engine/props2.js` | Stencils, drainage, dealership, playground, garden-tool and backyard props |
| `public/building/engine/extras.js` | What some building styles add: portals, porches, dormers, garages, breezeways, school towers |
| `public/building/engine/nature.js` | Trees and people |
| `public/building/engine/world.js` | Keeps the 3D scene in step with the save; parked cars; light pools |
| `public/building/engine/life.js` | Traffic, pedestrians, flags, turbines, rain and snow |
| `public/building/game.js` | The editor: panels, placement, dragging, resize handles, undo, saves, photo mode, the mod API |
| `desktop/` | The Windows desktop build (Electron): `main.cjs`, `preload.cjs`, the mods folder template |
| `.github/workflows/desktop.yml` | Builds the `.exe` on GitHub for every change to the game |

## Desktop version and mods

`desktop/` packs the game into a Windows program with Electron: the same
game, run from files inside the app (no server, no internet needed).

**Getting the .exe.** Every push that changes the game runs the "Desktop
build (Windows .exe)" workflow on GitHub; open the run under the
repository's **Actions** tab and download **BuildingDesignSimulator-windows**
from its Artifacts. Inside: `BuildingDesignSimulator-<version>-portable.exe`
(one file, nothing to install — double-click it) and a `.zip` of the same
program as a folder (unzip, run `Building Design Simulator.exe`; starts
faster). Pushing a tag like `v1.1.0` also attaches both to a GitHub release.
Windows SmartScreen may warn that the program is unsigned: "More info", then
"Run anyway".

**Building it yourself** (Node 20 or later):

```bash
npm install                 # in the repository root: fetches three.js
cd desktop
npm install                 # Electron and electron-builder
npm start                   # run it in a window
npm run dist:win            # on Windows: desktop/dist/*.exe and *.zip
npm run dist:win-from-linux # the same from Linux or macOS (no icon baked into the .exe)
```

**Mods.** The first run puts a `mods` folder next to the `.exe` (a second
one lives in `%APPDATA%\Building Design Simulator\mods`); the menu's
**Game → Open mods folder** opens it. In it:

- `graphics.json` overrides the graphics past the in-game Max preset —
  shadow maps up to 16K, supersampling, AO samples, how many lamps cast
  shadows, reflection size, sharpening, fog, exposure, view distance, field of
  view, and `"uncapFps": true` to lift the frame-rate cap. Rename the
  `graphics.example.json` that comes in the folder to start from a
  maxed-out set.
- every `.js` file is loaded as a mod once the game is running. Mods use
  `window.BuildingSim` — the three.js library, the engine (scene, camera,
  sun, renderer), the site's state and catalogue, per-frame and per-edit
  hooks, hints and the graphics settings. `examples/` has three to copy up:
  a cinematic orbit camera (O), a time-lapse (H) and a spinning billboard
  that adds its own 3D model.

F5 reloads the game and re-reads the folder; F12 opens the developer
console, where a broken mod says why. `desktop/mods-template/README.txt` is
the full guide.

## Robustness

Every model is checked as it is assembled: a face with no area (two corners
in the same place) gets a proper normal instead of a zero one. A zero normal
becomes "not a number" in the shader, and bloom spreads that over the whole
screen — which is what used to turn the view black whenever the hangar or the
sports hall (both with barrel roofs) was on screen.

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
