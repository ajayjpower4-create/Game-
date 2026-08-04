# 🚧 Construction Highway Simulator

Build construction scenes on real US highways — in blocky, low-poly Roblox-style 3D.

Every state in the US is in the game, each with its real highways modeled from
real-world map data: real route numbers and shields, real control cities, real
lane counts (yes, the Katy Freeway in Texas has 8 lanes each way), posted speed
limits, and scenery that matches the real setting — desert mesas on I-10 in
Arizona, sound walls and skyscrapers on the 405 in LA, snowy peaks on I-70 in
Colorado, bayou cypress on I-10 in Louisiana.

## How to play

```bash
npm install
npm start
```

Then open **http://localhost:3000**.

1. **Pick your state** — all 50 states.
2. **Pick your highway** — real interstates, US routes and state highways with
   accurate shields, lane counts and terrain. Every state also has two special
   venues: its most famous **🌉 long bridge** (a real water crossing) and a
   **🏪 downtown Main Street** lined with shops.
3. **Pick your vest** — every state has its own designs, including the official
   state DOT crew vest (Caltrans, TxDOT, PennDOT...) and a custom State Pride
   vest in your state's colors.
4. **Spawn in** as a blocky construction worker and set up your scene while
   live traffic merges around your lane closures.

## Venues

Besides the open highways, every state adds two hand-built settings to work in:

- **🌉 Long bridges** — each state's real signature water crossing (the
  Chesapeake Bay Bridge in Maryland, the Mackinac Bridge in Michigan, the
  Seven Mile Bridge in Florida, and so on). You're out over open water on a
  full deck with concrete parapets, steel railings, piers marching into the
  water below, expansion joints, a steel through-arch main span with hanger
  cables — and overhead lattice **lane-signal gantries** with green
  down-arrows and **OBEY LANE SIGNALS** placards. Close a lane with cones or
  barriers and the signal over that lane flips to a **red X**, just like the
  real thing. Bridge-specific signs (STAY IN LANE, NO STOPPING ON BRIDGE,
  HIGH WINDS) line the deck.
- **🏪 Downtown Main Street** — a slow two-lane city street with a double-yellow
  centerline, running past storefronts with striped awnings and lit signs
  (Joe's Diner, the pharmacy, the hardware store...), sidewalks with curbs,
  parked cars, hydrants, benches and planter trees, cross-street intersections
  with continental crosswalks, working traffic signals and green street-name
  blade signs — with the town's skyline and residential streets beyond.

## Traffic

Live AI traffic drives the highway and merges around your lane closures. For
roleplay or photos where you want an empty road, press **V** (or use the
pause-menu toggle) to turn AI traffic off; press it again to bring it back.
The setting is saved with your scene.

## Saving your work

Open the pause menu (`Esc`) and click **💾 Save game** any time. It saves
everything — every placed prop, sign, and barricade; every drivable vehicle
(with its position, livery, and custom sign-truck text); the road-breaker
patches you've cut into the pavement; and the time of day — to your browser's
local storage.

Next time you open the game, a **▶ CONTINUE** button appears on the title
screen showing which highway and state you left off on. Click it to load
straight back into your scene exactly as you left it — no rebuilding from
scratch. There's one save slot, and saving again overwrites it.

(The save lives in your browser's local storage, not a file, so it's tied to
this browser on this device — clearing site data will erase it.)

## Controls

| Key | Action |
| --- | --- |
| `W A S D` | Move (hold `Shift` to run) |
| `Space` | Jump |
| Mouse | Look around |
| `B` | Open / close the build menu |
| Left-click | Place selected item |
| `R` / `Shift+R` | Rotate item before placing |
| `[` / `]` | Stretch stretchable props (beams, pipes, ladders, fencing...) |
| `Q` | Deselect item |
| Right-click (or `X`) | Remove the item you're aiming at |
| `E` | Enter / exit a spawned vehicle |
| `W/S` `A/D` `Space` `Shift` | Drive: gas & brake, steer, handbrake, boost |
| `L` | Change the livery of the vehicle you're driving |
| `T` | Change time of day — day / dusk / night |
| `G` | Toggle free cam (fly with `WASD`, `Space`/`Shift` up/down, scroll = speed, hold `Enter` for turbo) |
| `P` | Take a picture — saves a PNG screenshot |
| `Esc` | Pause menu |

## Graphics

Rendering uses an image-based lighting environment (PMREM) so paint, glass and
chrome show real reflections that shift with the time of day, plus ACES tone
mapping and soft shadows. Vehicles are built from rounded, clearcoat-painted
panels with alloy wheels whose tyres spin with travel and whose front wheels
steer. It's still a deliberately blocky, low-poly style — but a much glossier,
more three-dimensional one than pure boxes.

## Driving & physics

Every vehicle in the **Vehicles** tab is drivable (press `E` when close):

- Wheels visibly **spin** with speed and the front wheels **steer**
- A **speedometer** gauge appears while driving
- **Collision** — you can't drive through other vehicles or solid props;
  hitting something bleeds your speed
- Press `L` to change the **livery** — Factory, your uniform colors, hi-vis,
  pearl white or blackout

## Road Breaker & surface tools

The **Tools** tab has rectangle tools — pick one, then click two corners of a
lane and the whole region is transformed:

- **Road Breaker** — demolishes the pavement into exposed dirt, broken asphalt
  chunks, bent rebar and loose gravel
- **Dig Trench** — cuts a real hole in the road: a recessed dirt pit with
  earth walls, an exposed conduit pipe at the bottom, spoil piles and rubble
- **Fresh Asphalt Patch** — lays new blacktop
- **Gravel Pad** — a compacted gravel work pad

Two **line tools** work the same way with a start and end point instead:

- **Barrier Chain** — jersey barriers auto-connect between your two clicks,
  with red chevron reflectors and connector pins
- **Fence Line** — orange safety mesh fencing strings itself post-to-post
  along the whole run, so you don't place panels one at a time

## Drivable DOT fleet

The **Vehicles** tab spawns drivable trucks in classic safety-yellow DOT
livery (inspired by real DOT fleet trucks) — blue reflective dash striping,
your state's Department of Transportation door emblem, DIAL 511 decals,
beacons and light bars. Walk up and press `E` to drive:

- **DOT Crew Pickup** — crew cab fleet pickup
- **Utility Service Truck** — service body with compartment doors and an
  overhead ladder rack
- **Stake Bed Truck** — long-hood cab, chrome grille, stake bed with
  red/white conspicuity striping
- **Custom Sign Truck** — flatbed with a big lit message board; you type
  what it says when you spawn it
- **DOT Dump Truck** and the **Crash Truck (TMA)** are drivable too

## Time of day

Press `T` to cycle day → dusk → night. At night the stars come out, every
car's headlights and taillights turn on, building windows glow, and any
light towers you've placed actually light up the job site.

## What you can build

- **Cones** — skinny cones, fat cones, tall grabber cones, traffic drums,
  delineator posts
- **Barricades** — Type I / II / III barricades (with flashing marker lights),
  A-frames, concrete jersey barriers, water-filled barriers, safety fencing
- **Road signs** — ROAD WORK AHEAD, LEFT/RIGHT LANE CLOSED, MERGE, FLAGGER
  AHEAD, DETOUR, ROAD CLOSED, work zone SPEED LIMIT, END ROAD WORK, ONE LANE
  ROAD, a two-sided STOP/SLOW flagger paddle, and more
- **Equipment** — steel pole bundles, pallets and pallet stacks, sandbags,
  steel road plates, light towers, generators, flashing arrow boards, message
  boards, a mini excavator, and the all-important porta-john — plus a full
  machine yard: skid steer loader, vibratory drum roller, backhoe loader,
  asphalt paver, telehandler, mobile crane on outriggers, towable concrete
  mixer, forklift, articulated boom lift, and a walk-behind trencher
- **DOT fleet** — work truck with beacons, chevrons and your state DOT's door
  decals, tandem dump truck loaded with gravel, crash attenuator (TMA) truck
  with a raised flashing arrow board, and a supervisor SUV with an amber
  light bar
- **Props** — toolboxes, job-site gang boxes, step and extension ladders,
  asphalt buckets and bucket pallets, steel I-beams and columns, rebar
  bundles, concrete pipe, scaffold towers, dirt/gravel/debris piles, water
  cooler, wheelbarrow, cable reels, portable traffic signal, air compressor,
  jackhammer, cut-off saw, survey tripod, flashing beacon stand, PVC pipe
  stacks, shrink-wrapped concrete-bag pallets, water tank, open manhole, and a
  rolling tool cart — plus staged material: cone stacks and cone pallets, a
  loaded flatbed trailer (lumber, pipe and concrete strapped down), lumber and
  plywood stacks, cinder block and brick pallets, crash barrel arrays,
  water-filled barriers, a diesel fuel tank, wire mesh rolls, manhole riser
  rings, precast catch basins, wheel stops, concrete formwork, hot asphalt
  piles, jersey barrier stacks, sign bundle racks, equipment tire stacks and
  wire spool pallets — and beams/pipes/ladders/fencing can be stretched with
  `[` `]`.

## Uniforms

Eight vest designs per state, each rendered with reflective bands, chest
pockets, an ID badge and radio clip, and a domed hard hat: the official DOT
crew orange, hi-vis green, your **State Pride** colors, a black night-crew
vest, a **Flagger** vest with red/silver chevrons across the back, a white
**Supervisor** jacket, a navy **Survey Crew** vest, and a sleeved **Winter
Hi-Vis Jacket**. Sleeved uniforms put the coat color on the arms with a
reflective cuff.

## The world

The highway is 2 km of true American right-hand traffic, lined with billboards
running fake ads (BIG TEX BURGERS, BLOCKY & SONS LAW, SLEEPY PINES MOTEL...),
mile markers set back on the roadside past the guardrail, work-zone speed
limit / exit / distance signs, and reflective delineator posts along the
shoulder. Traffic is simulated — close a lane with cones or barricades and
cars merge out of it (or stop if you close the whole road) — and DOT trucks
roll by in the flow.

> Note: highways are modeled from real-world map knowledge (accurate route
> shields, lane counts, control cities and terrain), not a live Google Maps
> feed — the game runs fully offline with no API keys.

## Tech

Plain Three.js (vendored, no build step) + a tiny Express static server.
All textures — highway shields, road signs, vests, faces — are generated at
runtime on canvas. No external assets.
