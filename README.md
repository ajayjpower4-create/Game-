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

- Election game: <http://localhost:3000/election/>
- Tow Truck Simulator: <http://localhost:3000/tow/>
- The original Swerve chatbot still lives at <http://localhost:3000/>

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
| `server.js` | Static hosting plus `POST /api/election/simulate`, which prompts Claude and validates what comes back |

The map is a grid cartogram: one tile per state placed roughly where it sits on
a US map, sized the same regardless of area, so Rhode Island is as clickable as
Texas. All 538 electoral votes are the 2024–2030 apportionment.

---

# Tow Truck Simulator — Skyville

A 3D shift as a wrecker driver in Skyville, a mid-size East Coast city wrapped
in the elevated I-671 beltway. Dispatch calls, you decide what the job takes:
a jump box, a winch, four straps and a steady hand on the ramp.

Play it at <http://localhost:3000/tow/>. It needs a WebGL2 browser and nothing
else — three.js is served out of `node_modules`, every model, texture and sound
is generated at runtime, and no asset is downloaded from anywhere.

## Before the shift

Six setup screens, each with a live 3D preview:

1. **Your driver** — skin tone, face, hair and colour, build, height.
2. **Clothes** — shirt, trousers, hi-vis vest (four classes), hat, gloves.
3. **Truck** — five rollbacks, from the Kestrel Quickpick to the Ironclad 6600
   heavy. They differ in deck length, capacity, top speed, compartments and cab
   style (two are cab-overs, one is a pickup-chassis wheel-lift).
4. **Livery** — five companies, applied to both doors and both deck skirts with
   the company name, street address and phone number: Flag City Towing, 8563
   West Skyville Road, 671-907-4212, and four more. Each livery specifies white
   or black lettering.
5. **Weather** — clear, overcast, rain, thunderstorm, harbour fog, snow, golden
   hour or the night shift. It sets the light, the hour on the clock and the
   grip under the tyres; the slippery ones pay a 20% hazard bonus.
6. **Where you start** — eight spawn points, including two up on the beltway.

## The shift

Your first call lands about a minute in. It arrives on the radio head unit in
the cab — the screen is live, and the accept/decline buttons on the dash work,
as does <kbd>Y</kbd>/<kbd>N</kbd>. Accept, follow the marker, and work the job.

**160 written calls** across nine kinds of work: jump starts, straight flatbed
tows, collisions (front, rear, side and rollover damage), winch-outs, lockouts,
tyre changes, fuel deliveries, repossessions and parking enforcement. Each names
a caller, a location and which of the eight mechanic shops it goes to.

Every call turns into a checklist you complete with your hands:

- **Jump start** — get the jump box out of a compartment, pop the hood, clamp
  the leads onto the battery in the engine bay, crank it, then get in the car
  and drive it up onto the tilted deck yourself.
- **Winch job** — tilt the bed down, pull the hook out and walk it to the
  casualty, slide under and hook the tow points, then hold the winch lever and
  drag it up the deck. Rollovers get righted first.
- **Strapping** — take a ratchet strap, hook it over a wheel onto a deck ring,
  then hold the left mouse button to ratchet it tight. Four straps. Drive off
  with fewer and the load walks around the deck under braking and cornering —
  and can slide off entirely.
- **Wheels** — take them off with the impact wrench, or by hand if you left the
  wrench in the truck (slower, and it costs you).
- **Scene safety** — highway calls want cones out behind you before you work.

Deliver to the shop the client named, tilt the bed, and the car rolls off. Pay
lands, with bonuses for speed and hazardous weather and deductions for anything
you hit on the way.

## The cab

The interior is modelled and interactive. Sit in it with <kbd>V</kbd> and look
around: the instrument cluster shows speed, gear, odometer, clock and how awake
you are; the radio shows the current call or job; there is a clipboard with the
job sheet, a parking brake lever that moves, a gear selector, a PTO switch, a
coffee cup, and a bag of salt-and-vinegar chips on the passenger seat you can
eat while dispatch talks.

The **ELS panel** is three amber buttons on the centre stack — off, amber
steady, and slow amber flash — driving the roof bar, the deck bar and the side
markers. <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> do the same from the wheel.

## Skyville

- An elevated ring highway on piers with jersey barriers, eight interchanges,
  overhead gantry signs, exit and gore signs, interstate shields, speed limits
  and mile markers.
- A street grid of numbered avenues and named cross streets, with arterials,
  sidewalks, kerbs, lane markings, traffic signals, street-name signs, lamps,
  hydrants, benches, trees and parked cars.
- Districts: a downtown core of towers, midtown, row-house outskirts, an
  industrial quarter and a harbour with piers.
- Eight mechanic shops, each with roll-up bays, a lit sign, a yard and a
  24-hour drop box.
- 38 civilian vehicle models — sedans, coupes, muscle, hatchbacks, wagons, SUVs,
  off-roaders, pickups, vans, a box truck, a food truck, a shuttle bus, a cab, a
  police cruiser, a limo and a motorcycle — each with an openable hood, an
  engine bay with a battery, removable wheels and four damage variants.

## Controls

| | |
| --- | --- |
| <kbd>W A S D</kbd> | drive / walk |
| <kbd>T</kbd> | gear: P → R → N → D |
| <kbd>P</kbd> / <kbd>Space</kbd> | parking brake / handbrake · jump on foot |
| <kbd>F</kbd> | get in or out of the truck |
| <kbd>V</kbd> | cab view ⇄ chase view |
| <kbd>E</kbd> | interact — hold when the meter appears |
| <kbd>Q</kbd> | take the second item from a compartment |
| <kbd>G</kbd> | drop what you are carrying |
| <kbd>LMB</kbd> | hold to ratchet a strap |
| <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> | ELS off / amber / slow flash |
| <kbd>Y</kbd> <kbd>N</kbd> | accept / decline a call |
| <kbd>M</kbd> <kbd>H</kbd> <kbd>Esc</kbd> | map / controls / pause |

## Layout

| Path | What it is |
| --- | --- |
| `public/tow/js/city.js` | Skyville: roads, ring highway, buildings, shops, signage, and the height/collision grids everything drives on |
| `public/tow/js/vehicles.js` | The 38 civilian models and their damage variants |
| `public/tow/js/towtrucks.js` | Five rollbacks, five liveries, the cab interior, deck tilt and ELS |
| `public/tow/js/jobs.js` | The 160 calls, the step chain each one expands into, and dispatch |
| `public/tow/js/equipment.js` | Jump box, straps, winch and cable, wrench, cones — and the load physics |
| `public/tow/js/physics.js` | Truck driving, the on-foot controller, camera rig |
| `public/tow/js/character.js` | The driver: parts, faces, wardrobe |
| `public/tow/js/weather.js`, `audio.js`, `input.js`, `ui.js`, `main.js` | Weather, synthesised sound, input, screens and HUD, and the game loop |

All the brands are invented. Any resemblance to a real tow company, or to a car
you once owned, is a coincidence you are welcome to enjoy.

## Also: the GTA V port

The call-and-delivery half of this game also exists as a GTA V single-player
script mod — same 160 calls, same hook/secure/deliver loop, running on Los
Santos and GTA's own tow trucks with no map edits and no added vehicles.

See [`mods/gtav/LosSantosTowing/`](mods/gtav/LosSantosTowing/README.md).
