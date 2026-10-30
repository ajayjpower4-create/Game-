# STEELRISE: Construction Simulator (Windows desktop)

A standalone Windows game — download one file, double-click it, play. No
Roblox, no installer, no account.

## Get the game

1. Open the repository's **Releases** page on GitHub (or **Actions → STEELRISE
   Windows build → latest run → Artifacts**).
2. Download **STEELRISE.exe** (about 80 MB).
3. Double-click it. Windows SmartScreen may say "Windows protected your PC"
   because the exe is not code-signed: click **More info → Run anyway**.

Saves and settings live in `%APPDATA%\STEELRISE\saves` (autosave every
3 minutes, plus three manual slots from the pause menu). F11 toggles
fullscreen.

## What's in it

- **Eight sites**: Empty Land (free build with two blueprints), four office
  sites from suburban to a 12-storey city tower, an industrial site with a
  rail siding, an apartment block and a 20-storey high-rise. Each starts at
  its own construction stage with a live 3D preview in Site Selection.
- **571 catalog items** (Tab): steel columns/beams/braces in real AISC
  sizes, footings, metal deck, composite and slab-on-grade concrete, wall
  panels, curtain wall, doors and windows, roofing, a full ring-lock
  scaffold system, rigging, machinery, MEP equipment, safety gear and site
  furniture — every one with a real model, weight and handling class.
- **Deliveries**: ordered pieces arrive physically on a flatbed (or railcar
  on the industrial site), stacked on dunnage and held by ratchet straps you
  release one by one.
- **Tower crane**: operate from the cab or with the radio remote. Slew,
  trolley and hoist with acceleration/braking, pendulum load sway, wind
  (lifting stops above 15 m/s), a real load chart with moment limit,
  collision stops, an alignment assist with a target ghost and directions,
  three cameras and hold-Y load recovery.
- **Telehandler**: drive it, pick loose material on the forks, lift, carry,
  set down or land it on its connection.
- **Hands-on building**: placement snaps to real connections and tells you
  exactly why a spot is invalid; bolt with the impact wrench, weld deck,
  hammer scaffold wedges, pour concrete with the pump hose and finish it with
  the trowel; dismantle in reverse order.
- Blueprint progress and "next task" panel, time of day, a first-time
  tutorial on Empty Land, graphics presets (Low → Ultra with shadows,
  ambient occlusion and bloom) and procedural audio for every machine and
  tool.

## Controls

| On foot | |
|---|---|
| Move / sprint / jump | WASD / Shift / Space |
| Interact (pick up, straps, crane gate, telehandler) | E |
| Fasten (hold on a yellow marker) | Left mouse |
| Dismantle (hold) | X |
| Tools | 1 hands · 2 impact wrench · 3 hammer · 4 welder · 5 crane remote · 6 pump hose · 7 trowel |
| First / third person | V |
| Catalog / pause | Tab / Esc |

Carrying: left click place · R rotate · Z/C fine rotate · T free placement ·
arrows nudge · G drop.

Crane: A/D slew · W/S trolley · F/R lower/raise · Z/C rotate load · Shift
fine · G hook/unhook · Enter land · H assist · V camera · hold Y recover · X
leave.

Telehandler: W/S drive · A/D steer · R/F boom · E/Q telescope · G pick up /
set down · Enter land · V camera · X leave.

## Building from source

```
cd steelrise-desktop
npm install
npm test          # headless checks: catalog, all sites, crane + telehandler loops, saves
npm start         # run in Electron
npm run dist:win  # unsigned folder build with @electron/packager
```

The GitHub workflow `.github/workflows/steelrise-windows.yml` runs the tests,
bundles the game and produces the single portable `STEELRISE.exe` on a
Windows runner, then attaches it to a release.

## What was tested, and how

- `npm test` (runs before every Windows build): all 571 items build valid
  geometry; every site loads with no build failures; the full loop on
  Office 1 — release straps, rig a column with the crane, land it on its
  footing, bolt all four anchors, unhook, progress updates, save and
  restore; slab-on-grade pour and trowel finish; telehandler pick up, lift,
  set down; truck and rail orders.
- The ported catalog and site layouts were compared part by part against the
  original Roblox build (identical to rounding).
- Headless Chromium (software rendering) runs of the bundled game: menu,
  site selection, play on several sites, crane cab/exterior views, catalog,
  night lighting, and real keyboard/mouse input for picking up and placing a
  part and driving the telehandler.
- **Not yet tested on a real Windows PC with a GPU.** Frame rate on real
  hardware, pointer lock and fullscreen behaviour in the packaged exe, and
  audio output have only been checked indirectly. Please report anything
  that misbehaves.
