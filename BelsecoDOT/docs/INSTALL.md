# Installing the Belseco DOT Mega Pack

## 1. Build the zip

```bash
cd BelsecoDOT
./build.sh
```

The script regenerates the textures, audio, materials and configurations, then
packs `mod/` into `dist/BelsecoDOT.zip`. The zip's contents sit at its root
(`vehicles/`, `lua/`, `ui/`, `art/`, `info.json`), which is what BeamNG expects —
do **not** wrap them in an extra folder.

If you do not have Python or `zip` available, you can also zip the *contents* of
`mod/` by hand with any archiver. Everything under `mod/` is already generated
and committed.

## 2. Drop it in the mods folder

| Platform | Path |
| --- | --- |
| Windows | `%USERPROFILE%\Documents\BeamNG.drive\<version>\mods\` |
| Linux | `~/.local/share/BeamNG.drive/<version>/mods/` |
| macOS (Proton/Wine) | wherever your prefix maps `Documents\BeamNG.drive` |

`<version>` is the game version folder, e.g. `0.36`.

Start the game. The mod appears in **Repository → My Mods** as *Belseco DOT Mega
Pack*. If it does not, use **Manage Mods → Refresh**.

## 3. Spawn a truck

Vehicle selector → filter by `Belseco`. Ten configurations:

| Configuration | Base | Notes |
| --- | --- | --- |
| Belseco Heavy Rescue 401 | T-Series | White fleet livery, full upfit |
| Belseco Incident Command 402 | T-Series | Attention-all flash program by default |
| Belseco FIRST Heavy 88 | T-Series | Safety yellow FIRST livery |
| Belseco Plow Truck 812 | T-Series | Winter equipment |
| Belseco Fleet Pickup 214 | D-Series | Plain white crew cab |
| Belseco FIRST Unit 77 / 78 | D-Series | FIRST freeway service patrol |
| Belseco Supervisor 12 | D-Series | Unmarked, lightbar + siren only |
| Belseco TMA Truck 640 | D-Series | Arrow board focused |
| Belseco Plow Truck 318 | D-Series | Winter equipment |

You can also fit the upfit to any D-Series or T-Series you already have: open the
parts menu and pick a **Vapid … Upfit** part in the *Paint Design* slot. The
liveries are also available on their own as *livery only* parts if you want the
paint without the equipment.

## 4. Turn on the console app

While in a vehicle, open the UI app editor (default `Esc → UI Apps`, or the
wrench icon), and add **Belseco Fleet Console**. It docks anywhere and is
380×520 px by default.

If the app says *"No Belseco upfit detected"*, the vehicle does not have a
Belseco upfit part fitted — pick one in the parts menu.

## 5. Bind keys (optional but recommended)

`Options → Controls → Bindings`, filter for `Belseco`. There are 33 actions,
listed in [CONTROLS.md](CONTROLS.md). They are registered as *vehicle specific*
bindings, so they only appear while a Belseco-equipped vehicle is loaded.

A comfortable starter set:

| Key | Action |
| --- | --- |
| `K` | Lightbar Level |
| `Shift+K` | Flash Pattern |
| `L` | Siren On/Off |
| `Shift+L` | Siren Tone |
| `H` | Air Horn |
| `J` | Traffic Advisor |
| `O` | Arrow Board Display |
| `Shift+O` | Arrow Board Mast |
| `P` | Scene Lighting Package |
| `1`–`5` on the numpad | the five response presets |

## Troubleshooting

**The truck spawns in plain paint.** The skin materials have to match the base
material names of your game version. Open the World Editor's Material Editor,
click the panel that stayed unpainted, copy its material name into
`BASE_MATERIALS` in `tools/generate_materials.py`, and rebuild. This is expected
one-time setup and is explained in [ASSET_CHECKLIST.md](ASSET_CHECKLIST.md).

**No lights are visible.** That is expected until equipment meshes exist — see
the "What still needs 3D work" section of the top-level README. All the logic is
running; you can confirm it from the console app, which shows live state, and
from the arrow board lamp preview, which blinks in step with the real board.

**No siren audio.** Check that `art/sound/belseco/*.wav` made it into the zip. If
your setup prefers Ogg Vorbis, convert them and update `SOUND_DIR` /file names in
`mod/lua/vehicle/controller/belseco/siren.lua`:

```bash
for f in mod/art/sound/belseco/*.wav; do ffmpeg -i "$f" "${f%.wav}.ogg"; done
```
