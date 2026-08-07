# Asset checklist

What is finished, what needs verifying against your installed copy of the game,
and what still needs modelling. Nothing in this list blocks the pack from
installing and running — the logic is complete and the controllers are live.

---

## 1. Verify against your game version

These are the only places the pack has to guess at names owned by the base game.
Each takes a couple of minutes with the game open.

### Base material names for the liveries

**Why:** BeamNG applies a skin by looking for a material named
`<baseMaterial>.skin.<skinName>`. The base material names belong to the vanilla
vehicles, which this pack does not ship.

**How to check:** spawn a D-Series or T-Series → World Editor (`F11`) → Material
Editor → click a body panel → copy the material name.

**How to fix:** add the name to `BASE_MATERIALS` in
`tools/generate_materials.py`, then `./build.sh`.

Current guesses:

| Vehicle | Names tried |
| --- | --- |
| `pickup` | `pickup_body`, `pickup_bed`, `pickup_bedside`, `pickup_doors`, `pickup_cab`, `pickup_fenders`, `pickup_bumpers`, `pickup_canopy` |
| `us_semi` | `us_semi_body`, `us_semi_cab`, `us_semi_doors`, `us_semi_hood`, `us_semi_fenders`, `us_semi_sleeper`, `us_semi_bumper`, `us_semi_fueltank` |

Extra names are harmless — a material that matches no mesh is simply unused.

### UV placement of the stripes and lettering

**Why:** the liveries are painted in UV space, and the templates that say which
UV region is a door and which is a roof are not public.

**How to check:** fit the **Belseco DOT — UV Guide Grid** livery. It paints a
labelled 20×20 grid of UV coordinates onto the truck, so you can read straight
off the bodywork that, say, the driver's door occupies `0.30`–`0.45` vertically.

**How to fix:** edit the `stripes` and `texts` entries in the `LIVERIES` table in
`tools/generate_skins.py` — each is a UV fraction — then `./build.sh`. No image
editor needed.

### Vehicle folder names

The pack targets `vehicles/pickup` (Gavril D-Series) and `vehicles/us_semi`
(Gavril T-Series). If your version names those folders differently, rename the
two folders under `mod/vehicles/` and update `PER_VEHICLE` /`BASE_MATERIALS` in
`tools/generate_materials.py` and `CONFIGS` in `tools/generate_configs.py`.

### Cab crew configuration

The reference pickup is a crew cab. If your D-Series build does not default to
the four-door cab, add the cab part to the `parts` map in
`tools/generate_configs.py`, e.g. `"pickup_cab": "pickup_cab_crew"`, using the
part name from the parts menu.

---

## 2. Meshes to model

Export to `mod/vehicles/<vehicle>/belseco/*.dae`, then fill in
`mod/vehicles/pickup/belseco_pickup_equipment.jbeam.template` and rename it to
`.jbeam`. The template already lists every prop row, the electrics value that
drives it, and the rotation/translation each one needs.

| Mesh | Drives | Notes |
| --- | --- | --- |
| Lightbar shell + 8 heads | `belseco_lb_*` | Full-width bar; heads are separate meshes so they flash independently |
| Traffic advisor, 8 segments | `belseco_ta_s1..s8` | Rear face of the lightbar, left to right |
| Arrow board panel + 15 lamps | `belseco_ab_l1..l15` | 5×3 grid, lamp 1 top-left |
| Arrow board mast | `belseco_ab_deploy` | Slides 0.55 m up over the travel |
| Cab switch panel + 16 rockers | `belseco_sw_1..16` | Rockers tilt 14°; order is in CONTROLS.md |
| Scene floods, alley lights, take-downs, beacons | `belseco_aux_*` | Ten fixtures, see ELECTRICS.md |
| Plow blade + pivot + rams | `belseco_plow_lift`, `belseco_plow_angle` | Blade lifts 0.42 m and tilts 22°; pivot swings ±26° |
| Spreader hopper + spinner disc | `belseco_spinner` | Spinner rotates continuously, 3600°/unit |
| Walk-around rescue body, roll-up doors | — | Image 1; the body itself, on the T-Series chassis |
| Utility/service body | — | Image 3; the FIRST truck's bed |
| Front push bumper | — | Image 3 |

**Interim behaviour:** the lightbar controller also writes the vanilla
`lightbar` electrics value, so if you fit any existing lightbar part to the
truck, it flashes with this pack's patterns and levels immediately.

---

## 3. Optional polish

- **Ogg audio.** The generated tones are 22.05 kHz WAV. Convert with
  `ffmpeg -i in.wav out.ogg` and update the filenames in `siren.lua` if you
  prefer Vorbis, or re-run `generate_sounds.py --rate 44100` for higher fidelity
  WAVs.
- **Normal and roughness maps** for the liveries. `generate_materials.py`
  currently sets flat roughness/metallic factors; add `normalMap` /
  `roughnessMap` entries to the `Stages` block once you have them.
- **Configuration thumbnails.** BeamNG shows a preview image per `.pc` if a
  matching `.png` sits beside it. Take them in-game with the screenshot tool.
- **Salt/spray particles** from the spreader, via
  `obj:addParticleByNodesRelative` once the spinner has real nodes.
- **Dedicated slots.** The upfits currently occupy the `paint_design` slot so the
  pack never has to modify a vanilla file. If you would rather have livery and
  equipment selectable separately, add a `belseco_equipment` slot to a copy of
  the vehicle's main jbeam part and move the `controller` block there — the
  template already declares that slot type.
