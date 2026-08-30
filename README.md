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

A site editor. Set a lot, put buildings on it, and then edit everything —
every wall bay, every machine on every roof, every trailer, sign, booth and
tree. The camera flies around it like a drone.

Open <http://localhost:3000/building>.

## The camera

Drag the view to orbit all the way around the site, shift-drag to pan, and the
wheel to zoom from an overview down to standing between the trailers. Tilt runs
from 6° (street level) to 86° (straight down), and the View tab has jumps for
front, back, left, right, overhead, street level and a low drone angle.

## Everything is an object

Buildings included. Click anything in the view to select it; then turn it in
15° or 90° steps, duplicate it, nudge it with the arrow keys, drag it around,
or delete it. Ctrl+Z undoes. So the security sign facing the wrong way can be
turned to face the right way — or deleted and done again.

Nothing but a building may stand inside a building: drag a trailer into a wall
and it springs back, and a placement that would land inside one is refused with
the footprint drawn in red.

## What you can add

The Add tab holds the catalogue. Pick a thing, then click the ground to drop
it; shift-click keeps the tool armed for a run of fence or bollards.

- **Buildings** — twelve models: warehouse shell, office block, small 2–3
  storey building, tower, storage row, retail strip, workshop, pitched unit,
  car park deck, cold store, glass pavilion and plant room. Put as many on the
  lot as you like. Each one also takes a cladding (precast panels, ribbed
  metal, brick courses, plain render) and a roof (flat, pitched, sawtooth), so
  the same box can read as a shed, a brick unit or a glazed showroom.
- **Roof plant** — 18 machines: packaged AC units, large rooftop units, a
  chiller, cooling tower, exhaust fan, mushroom vent, flue stack, skylight,
  skylight monitor, solar array, satellite dish, antenna mast, water tank,
  stair bulkhead, lift overrun, duct run, pipe rack and a louvred plant screen.
  None of it appears on its own — you place every piece, on any roof, and drag
  it around up there.
- **Booths** — 10 designs: classic cabin, deep canopy, brick gatehouse, glass
  cube, container booth, twin-lane kiosk, pitched hut, raised lookout, round
  kiosk and a full gate office. Each carries a fascia sign you write yourself.
- **Props** — fences and walls by the run, guard rails, gate arms, bollards,
  barriers, cones, monument/pylon/post signs, stop signs, flagpoles, light
  poles, flood masts, bollard lights, trees, conifers, shrubs, hedges,
  planters, dumpsters, containers, generators, transformers, silos, pallet
  stacks, yard canopies, bike racks, benches, picnic tables.
- **Vehicles** — trailers, tractor units, box trucks, vans, cars, forklifts.

## Walls, bay by bay

Select a building and its four walls come up as grids: one row per floor, one
column per bay. Pick a brush — window, ribbon glass, full glazing, loading bay,
roll-up door, entrance, louvre, vent — and paint the bays one at a time, or
fill and clear a whole wall. Add and remove bays across a wall, change the
floor count, and the openings follow. Loading bays and doors are ground floor
only, because that is where they go.

What you put on a wall changes the ground in front of it: a run of loading bays
gets a poured concrete apron and a truck court that parking will not encroach
on, and an entrance gets a path and a crossing.

## The site

Lot size, and toggles for pavement, parking, parked cars, road markings, the
street and grass. The parking lays itself out around whatever is on the lot —
add a building in the middle of the car park and the bays re-flow around it.

## How it draws

One SVG, rebuilt on every change, with cast shadows swept along the sun vector,
precast joints and ribbed siding, glazing that reflects sky by day and lights
up cell by cell at night, roofs with coping and membrane seams, and a night
palette where pole heads pool light on the asphalt and dock lamps wash the wall
above every bay.

Painter ordering compares objects pairwise rather than by a single depth
number — a 380-foot shed has a corner nearer the camera than a trailer parked
in front of its other end, and a single number gets that backwards.

While the camera or a slider is moving the scene draws in a cheap pass; the
detail comes back when you let go.

## Keys

| Key | What it does |
| --- | --- |
| Drag / shift-drag / wheel | Orbit · pan · zoom |
| Click | Select · click empty ground to deselect |
| R / Shift+R | Turn the selection (or the thing being placed) |
| Arrows | Nudge 2 ft, or 10 ft with shift |
| Delete | Delete the selection |
| Esc | Cancel placement, or deselect |
| Ctrl+Z / Ctrl+Shift+Z | Undo · redo |

## Layout

| Path | What it is |
| --- | --- |
| `public/building/iso.js` | Projection with free yaw/pitch/zoom and unprojection, lit prisms, cast-shadow hulls, wall faces, overlap tests |
| `public/building/catalog.js` | The object model, item catalogues, presets, save migration, and the rule that nothing stands inside a building |
| `public/building/parts.js` | Every drawable piece: wall openings, the 18 machines, the 10 booths, props and vehicles |
| `public/building/scene.js` | Site assembly, ground and marking, depth sort, hit shapes, day/night palette |
| `public/building/game.js` | The editor: camera, selection, dragging, placement, wall and roof editors, undo |

Every site in it is invented. It is a toy for sketching a layout, not a set of
construction documents.
