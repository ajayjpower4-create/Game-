# Belseco DOT Mega Pack

A BeamNG.drive fleet pack for the **Belseco Department of Transportation**, built
around the three trucks in the reference photos and branded **Vapid** as the
upfitter.

| Reference | Unit | Base vehicle | Configurations |
| --- | --- | --- | --- |
| White walk-around rescue body | Vapid Heavy Rescue / Incident Command | `us_semi` (T-Series) | Heavy Rescue 401, Incident Command 402, FIRST Heavy 88, Plow Truck 812 |
| White crew cab fleet pickup | Vapid Fleet Pickup | `pickup` (D-Series) | Fleet Pickup 214, Supervisor 12, TMA Truck 640 |
| Yellow/blue FIRST service truck | Vapid FIRST Unit | `pickup` (D-Series) | FIRST Unit 77, FIRST Unit 78, Plow Truck 318 |

Ten spawnable configurations, five liveries, and a full interactive upfit shared
by all of them.

---

## What actually works right now

Everything in this list is code and data in this repository, and runs the moment
you install the zip:

- **Emergency lightbar** — four escalation levels (off / cruise / warning / lane
  blocking) and five flash programs (quad flash, double flash, slow alternate,
  attention-all, steady). Level 1 dims the bar to 35% the way a real cruise mode
  does; levels 2 and 3 force their own programs.
- **Siren** — wail, yelp, phaser and hi-lo, all synthesised as seamless loops by
  `tools/generate_sounds.py`, plus a momentary air horn that ducks the tone
  underneath it and an automatic reversing alarm. Volume ramps in and out so
  tone changes never click.
- **Rear traffic advisor** — eight segments, sequencing left / right / split /
  wig-wag.
- **Arrow board** — a real 15-lamp board in a 5×3 grid with sequenced arrows,
  four-corner and bar caution modes, on a mast that raises and stows over 2.6 s.
  Lamps refuse to light until the mast is up.
- **Scene lighting** — ten fixtures (floods, take-downs, alley lights, ground
  lights, beacons, headlight wig-wags, work-area floods) on a metered electrical
  load. Run them with the engine off and the battery goes down; the console
  warns you before you flatten it.
- **Winter operations** — plow raise/lower/float, blade angle, and a hopper
  spreader metered in pounds per lane mile against real road speed, so a fast
  highway run empties the hopper faster than a slow residential loop.
- **Response presets** — one button each for TRAVEL, RESPONDING, ON SCENE,
  LANE BLOCK MERGE LEFT and LANE BLOCK MERGE RIGHT, which set the whole truck
  coherently instead of leaving you to flip nine switches.
- **Three ways to drive all of it** — the in-game *Belseco Fleet Console* UI app,
  33 bindable keyboard/controller actions, and the cab switch panel props.

## What still needs 3D work

This pack ships **no 3D meshes**, because meshes cannot be authored from a
terminal. Concretely, that means:

- The liveries are real, generated textures, but they are painted in UV space
  without the game's UV templates, so stripes and lettering will not land
  perfectly on every panel until you nudge them. `tools/generate_skins.py` makes
  that a one-number edit rather than a repaint, and the pack includes a
  **UV guide grid** livery you can fit to a truck to read off exactly which UV
  coordinates land where.
- Lightbars, arrow boards, plows and switch panels have **no visible geometry
  yet**. Their logic, state and electrics are complete and running — what is
  missing is the mesh to hang on them.
  `mod/vehicles/pickup/belseco_pickup_equipment.jbeam.template` is the wiring
  diagram: fill in mesh names and node names, rename it to `.jbeam`, and the
  hardware lights up with no changes to any code.
- Until then, the controllers also drive the stock `lightbar` electrics value,
  so any vanilla or third-party lightbar part fitted to the truck flashes with
  the pack's own patterns.

See [`docs/ASSET_CHECKLIST.md`](docs/ASSET_CHECKLIST.md) for the full list of
what to model and what to verify against your installed copy of the game.

---

## Install

```bash
./build.sh
```

Copy `dist/BelsecoDOT.zip` into your BeamNG mods folder:

- Windows: `%USERPROFILE%\Documents\BeamNG.drive\<version>\mods\`
- Linux: `~/.local/share/BeamNG.drive/<version>/mods/`

Launch the game, then spawn any configuration whose name starts with *Belseco*,
and enable the **Belseco Fleet Console** app from the UI app selector.

Full details, including how to bind keys, are in
[`docs/INSTALL.md`](docs/INSTALL.md) and [`docs/CONTROLS.md`](docs/CONTROLS.md).

---

## Layout

```
BelsecoDOT/
├── build.sh                  builds dist/BelsecoDOT.zip
├── tools/                    generators - rerun these, don't hand-edit output
│   ├── generate_skins.py     livery textures + UV guide
│   ├── generate_sounds.py    siren tones and air horn
│   ├── generate_materials.py skin material definitions
│   └── generate_configs.py   spawnable .pc configurations
├── docs/
│   ├── INSTALL.md
│   ├── CONTROLS.md           every keybind and console control
│   ├── ELECTRICS.md          every electrics value the pack publishes
│   └── ASSET_CHECKLIST.md    the remaining 3D and verification work
└── mod/                      the zip contents
    ├── info.json
    ├── art/sound/belseco/    generated siren audio
    ├── lua/vehicle/controller/belseco/
    │   ├── lightbar.lua      escalation levels, flash programs, advisor
    │   ├── siren.lua         tones, air horn, volume ramping
    │   ├── arrowboard.lua    15-lamp board and mast
    │   ├── auxlights.lua     scene lighting and electrical load
    │   ├── plow.lua          plow and metered spreader
    │   └── console.lua       master power, presets, switch panel, dispatch
    ├── ui/modules/apps/belsecoFleetConsole/
    └── vehicles/{pickup,us_semi}/
```

## Design notes

- **One dispatch point.** The UI app, the keybinds and the switch panel all call
  `belsecoAction(name, value)` / `belsecoPreset(name)` in the vehicle's Lua VM.
  There is exactly one place that decides what a control does, so the app and
  the keys can never disagree.
- **Everything is an electrics value.** No controller talks to a prop directly.
  That is what makes the equipment template work without touching any code.
- **Thin configurations.** The `.pc` files set the upfit part and the paint and
  let BeamNG fill every other slot with vehicle defaults, so they survive base
  game updates.
- **Generated, not hand-maintained.** Textures, audio, materials and configs all
  come from scripts in `tools/`. Edit the script, run `./build.sh`.

## Attribution

*Belseco* and its Department of Transportation are fictional, and *Vapid* is used
as a fictional vehicle brand. The liveries are original artwork generated by the
scripts in this repository and reference no real agency's markings; the FIRST
wordmark stands for the equally fictional Freeway Incident Response Safety Team.
All audio is synthesised from scratch — no sampled material is included.
