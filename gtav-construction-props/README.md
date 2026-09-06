# Construction Props

A GTA V mod that puts every construction prop in a menu, lets you place them
with the mouse, and saves the result as a scene you can load back later —
without dragging the game's frame rate through the dirt.

Built as a ScriptHookVDotNet 3 script. Single player only.

---

## What it does

- **A browsable catalog** of construction props — barriers, cones, scaffolding,
  pallets, machinery, site cabins, work lights, skips — grouped into categories.
  Highlighting an entry previews it under your cursor immediately.
- **Click-to-place.** The prop rides a ray from the mouse cursor onto whatever
  surface you point at. Left click drops it. Scroll rotates. Ctrl+scroll raises
  and lowers.
- **Paint mode.** Hold the button and drag to lay a run of cones or barriers at
  a fixed spacing.
- **Edit what you placed.** Grab a prop under the cursor and move it, delete it,
  or undo the last 200 edits.
- **Scenes.** Save the site to a JSON file, load it back, keep as many as you
  like. Files are plain text and hand-editable.
- **It does not lag the game out.** This is the whole point — see below.

---

## Why it doesn't tank your FPS

Naïve prop mods spawn every object in the scene as a real entity and leave it
there. Five hundred props later the object pool is full, the physics step is
crawling, and the game stutters every time the streamer touches disk.

This one keeps the scene as *data* and only materialises the part of it you can
actually see:

1. **Spatial streaming.** Placed props live in a 32-metre grid. Only props
   within the stream radius (default 160 m) of the camera exist as entities at
   all. Everything else is a few dozen bytes of struct.
2. **Budgeted spawning.** At most a handful of props are created or destroyed
   per pass (default 4 and 10), nearest first. Nothing ever bulk-spawns, so
   there's no hitch when you round a corner into a dense scene.
3. **Passes on a timer, not per frame.** The streamer thinks every 120 ms by
   default. In between it costs literally nothing.
4. **Asynchronous model loading.** Models are requested and picked up on a later
   pass. The script never blocks on `Model.Request(timeout)` — that blocking
   call is where most mod stutter actually comes from. Models are
   reference-counted and handed back to the streamer once nothing is using them.
5. **No physics cost.** Every placed prop is frozen and non-dynamic. Props past
   the physics radius (default 45 m) keep their geometry but drop collision
   entirely.
6. **A hard entity cap.** Default 600 live props. GTA's object pool is finite
   and shared with the base game; going over it is what makes vehicles and peds
   start failing to spawn. When you exceed the cap the furthest props get shed
   first.
7. **Self-healing.** A rolling slice of live props is checked each pass for
   entities the game culled behind our back, instead of polling all of them.

The upshot: a 3,000-prop scene costs the same as a 300-prop one, because only
the couple of hundred around you are ever real. The Performance menu shows
`Live / Scene` and the pass time in milliseconds so you can watch it work.

---

## Install

1. Install [Script Hook V](http://www.dev-c.com/gtav/scripthookv/) and
   [ScriptHookVDotNet 3](https://github.com/scripthookvdotnet/scripthookvdotnet/releases).
2. Drop `ConstructionProps.dll` into your `GTA V\scripts\` folder.
3. Start the game. The mod creates
   `GTA V\scripts\ConstructionProps\` for its settings and scenes on first run.
4. Press **F5**.

If nothing happens, check `GTA V\scripts\ConstructionProps.log`.

---

## Controls

| Input | Does |
|---|---|
| `F5` | Open / close the menu |
| Arrow keys / numpad | Navigate, `←` `→` change a value |
| `Enter` | Select |
| `Backspace` / `Esc` / right click | Back, or cancel what you're placing |
| **Left click** | Place the prop / confirm a move |
| Hold left click | Paint a run of props (paint mode) |
| Scroll | Rotate (heading) |
| `Shift` + scroll | Pitch |
| `Alt` + scroll | Roll |
| `Ctrl` + scroll | Raise / lower |
| `E` | Grab the prop under the cursor to move it |
| `Delete` | Delete the prop under the cursor |
| `G` | Toggle grid snap |
| `R` | Reset rotation and height offset |
| `F` | Drop the grabbed prop to the ground |
| `Ctrl+Z` / `Ctrl+Y` | Undo / redo |

While the editor is up, attack, aim, weapon switching and the phone are
suppressed so you don't shoot the site you're building. Camera control stays
live.

---

## Settings

`scripts\ConstructionProps\ConstructionProps.ini` is written with defaults on
first run. Everything in `[Streaming]` is also adjustable live from the
Performance menu, which is the easier way to find numbers that suit your rig.

| Key | Default | Meaning |
|---|---|---|
| `Radius` | 160 | Props further than this from the camera are removed from the world (not from the scene). **Lower this first if you're hurting for frames.** |
| `DespawnMargin` | 25 | Hysteresis, so props don't thrash on the boundary |
| `MaxLiveProps` | 600 | Hard entity cap |
| `SpawnsPerPass` | 4 | Spawn budget per pass |
| `DespawnsPerPass` | 10 | Despawn budget per pass |
| `IntervalMs` | 120 | How often the streamer runs |
| `LodDistance` | 300 | Per-entity LOD distance |
| `PhysicsRadius` | 45 | Past this, props keep geometry but lose collision |
| `ModelUnloadGraceMs` | 8000 | How long an unused model is held before release |

Three presets are in the menu: **Potato** (90 m / 250 props), **Balanced** (the
defaults) and **Beefy Rig** (300 m / 1200 props).

`[Editing]` covers snap step, rotate step, paint spacing, whether new props
collide, and whether they're frozen.

---

## Scenes

Saved to `scripts\ConstructionProps\Scenes\<name>.json`:

```json
{
  "name": "docks-yard",
  "version": 1,
  "saved": "2026-09-06 14:02:11",
  "props": [
    {
      "model": "prop_barrier_work01a",
      "pos": [ -412.31, -1024.77, 30.51 ],
      "rot": [ 0, 0, 275 ],
      "collision": true,
      "frozen": true
    }
  ]
}
```

Writes go to a temp file and are renamed into place, so a crash mid-save can't
eat an existing scene. Loading swaps scenes in one step: the old one is
despawned, the new one streams in around you.

---

## Extending the catalog

Drop a `props.json` next to the ini to add your own props. `data/props.json` in
this repo is a worked example. Existing categories are extended; pass
`"replace": true` to wipe the built-in entries in one first.

```json
{
  "categories": [
    { "name": "My Custom Kit", "props": [
        "prop_rub_wheel_01",
        { "label": "Traffic Barrel", "model": "prop_barrier_wat_04a" }
    ]}
  ]
}
```

Model names are validated at runtime. Anything your install doesn't have — a
typo, or a prop from DLC you're missing — is greyed out in the menu and marked
`missing` rather than silently placing nothing.

---

## Building

Needs .NET Framework 4.8 targeting support (Visual Studio 2022, or
`dotnet build` with the 4.8 targeting pack installed).

```
copy ScriptHookVDotNet3.dll gtav-construction-props\lib\
cd gtav-construction-props
dotnet build -c Release
```

Output lands in `bin\Release\ConstructionProps.dll`. `ScriptHookVDotNet3.dll` is
not redistributed here — grab it from the SHVDN release, or take the copy
sitting next to your `GTA5.exe`.

---

## Layout

| File | Job |
|---|---|
| `src/Main.cs` | SHVDN entry point, lifetime, logging |
| `src/Editor.cs` | Menu construction, input routing, undo, scene commands |
| `src/PropStreamer.cs` | The budgeted spawn/despawn engine |
| `src/ModelPool.cs` | Reference-counted async model streaming |
| `src/Scene.cs` | Scene data, spatial grid, save/load |
| `src/Placement.cs` | Cursor ray, ghost preview, snapping, rotation |
| `src/Menu.cs` | Immediate-mode menu drawing and navigation |
| `src/Catalog.cs` | Built-in prop list plus `props.json` merging |
| `src/Json.cs` | Dependency-free JSON reader/writer |
| `src/Config.cs` | ini loading and clamping |
| `src/History.cs` | Bounded undo/redo stack |
| `src/Natives.cs` | Natives called by hash, for SHVDN version tolerance |

---

## Notes and limits

- Single player. Don't take it into GTA Online.
- Props are cleaned up when the script unloads or reloads, so you won't be left
  with orphans after a script reload.
- Placement uses the gameplay camera, so it works in first and third person, but
  not while a cutscene camera is active.
- Undo history is capped at 200 edits and is cleared when you load a scene.
