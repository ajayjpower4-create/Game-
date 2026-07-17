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
   accurate shields, lane counts and terrain.
3. **Pick your vest** — every state has its own designs, including the official
   state DOT crew vest (Caltrans, TxDOT, PennDOT...) and a custom State Pride
   vest in your state's colors.
4. **Spawn in** as a blocky construction worker and set up your scene while
   live traffic merges around your lane closures.

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
- **Dig Trench** — opens a recessed dirt trench with spoil piles and conduit
- **Fresh Asphalt Patch** — lays new blacktop
- **Gravel Pad** — a compacted gravel work pad

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
  boards, a mini excavator, and the all-important porta-john
- **DOT fleet** — work truck with beacons, chevrons and your state DOT's door
  decals, tandem dump truck loaded with gravel, crash attenuator (TMA) truck
  with a raised flashing arrow board, and a supervisor SUV with an amber
  light bar
- **Props** — toolboxes, job-site gang boxes, step and extension ladders,
  asphalt buckets and bucket pallets, steel I-beams and columns, rebar
  bundles, concrete pipe, scaffold towers, dirt/gravel/debris piles, water
  cooler, wheelbarrow, cable reels, portable traffic signal, air compressor,
  jackhammer, cut-off saw, survey tripod, flashing beacon stand, PVC pipe
  stacks, concrete-bag pallets, water tank, open manhole, and a rolling tool
  cart — and beams/pipes/ladders/fencing can be stretched with `[` `]`.

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
