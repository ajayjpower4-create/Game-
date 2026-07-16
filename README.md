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
| `Q` | Deselect item |
| Right-click (or `X`) | Remove the item you're aiming at |
| `G` | Toggle free cam (fly with `WASD`, `Space`/`Shift` up/down, scroll = speed) |
| `P` | Take a picture — saves a PNG screenshot |
| `Esc` | Pause menu |

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

The highway is 2 km of true American right-hand traffic, lined with billboards
running fake ads (BIG TEX BURGERS, BLOCKY & SONS LAW, SLEEPY PINES MOTEL...).
Traffic is simulated — close a lane with cones or barricades and cars merge out
of it (or stop if you close the whole road) — and DOT trucks roll by in the
flow.

## Tech

Plain Three.js (vendored, no build step) + a tiny Express static server.
All textures — highway shields, road signs, vests, faces — are generated at
runtime on canvas. No external assets.
