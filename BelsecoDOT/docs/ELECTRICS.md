# Electrics reference

Every controller in this pack publishes its state to `electrics.values` and
never touches a prop directly. Anything that can read an electrics value — a
jbeam prop, a glow material, a UI app, another mod — can therefore drive itself
off the pack without any code changes.

Values are refreshed every graphics frame.

## Lightbar — `belseco/lightbar.lua`

| Value | Range | Meaning |
| --- | --- | --- |
| `belseco_lb_mode` | 0–3 | Off, cruise, warning, lane blocking |
| `belseco_lb_pattern` | 1–5 | Selected flash program |
| `belseco_lb_frontL` | 0–1 | Driver-side outboard front head |
| `belseco_lb_frontIL` | 0–1 | Driver-side inboard front head |
| `belseco_lb_frontIR` | 0–1 | Passenger-side inboard front head |
| `belseco_lb_frontR` | 0–1 | Passenger-side outboard front head |
| `belseco_lb_sideL` / `sideR` | 0–1 | Side heads |
| `belseco_lb_rearL` / `rearR` | 0–1 | Rear heads |
| `belseco_ta_mode` | 0–4 | Advisor: off, left, right, split, wig-wag |
| `belseco_ta_s1` … `s8` | 0/1 | Advisor segments, left to right |
| `lightbar` | 0–2 | **Vanilla compatibility.** 0 off, 1 lights, 2 lights + siren |

Head values are already dimmed for the current level: at level 1 an "on" head
reads `0.35`, not `1`. Use the value directly as brightness.

## Siren — `belseco/siren.lua`

| Value | Range | Meaning |
| --- | --- | --- |
| `belseco_siren_mode` | 0–4 | Off, wail, yelp, phaser, hi-lo |
| `belseco_siren_vol` | 0–1 | Live output level, including air-horn ducking |
| `belseco_airhorn` | 0/1 | Air horn held |
| `belseco_backup_alarm` | 0/1 | Reversing alarm, automatic in reverse gear |
| `siren` | 0/1 | Vanilla-friendly flag |

The reversing alarm needs no binding — it follows the gear selector. Disable it
per part with `"backupAlarm": false` in the siren controller's jbeam options.

## Arrow board — `belseco/arrowboard.lua`

| Value | Range | Meaning |
| --- | --- | --- |
| `belseco_ab_mode` | 0–6 | Off, four corner, caution bar, left, right, double, flashing |
| `belseco_ab_deploy` | 0–1 | Mast position; 0 stowed, 1 fully up |
| `belseco_ab_l1` … `l15` | 0/1 | Individual lamps |

Lamp numbering matches the physical board:

```
 1   2   3   4   5
 6   7   8   9  10
11  12  13  14  15
```

## Auxiliary lighting — `belseco/auxlights.lua`

| Value | Range | Meaning |
| --- | --- | --- |
| `belseco_aux_sceneL` / `sceneR` / `sceneRear` | 0/1 | Scene floods |
| `belseco_aux_takedown` | 0/1 | Take-down lights |
| `belseco_aux_alleyL` / `alleyR` | 0/1 | Alley lights |
| `belseco_aux_ground` | 0/1 | Ground / step lights |
| `belseco_aux_beacon` | 0/1 | Roof beacons |
| `belseco_aux_wigwag` | 0/1 | Wig-wags enabled |
| `belseco_aux_wigwagL` / `wigwagR` | 0/1 | Live alternating output |
| `belseco_aux_workArea` | 0/1 | Work area floods |
| `belseco_aux_load` | amps | Total auxiliary draw |
| `belseco_batt_soc` | 0–1 | Battery state of charge |

## Winter operations — `belseco/plow.lua`

| Value | Range | Meaning |
| --- | --- | --- |
| `belseco_plow_lift` | 0–1 | 0 is down on the road, 1 is stowed |
| `belseco_plow_angle` | −1–1 | Negative casts left |
| `belseco_plow_float` | 0/1 | Float mode |
| `belseco_spreader_on` | 0/1 | Spreader running |
| `belseco_spreader_rate` | 0–1 | Normalised gate opening |
| `belseco_spinner` | 0–1 | Spinner disc speed, spools up and coasts down |
| `belseco_prewet` | 0/1 | Pre-wet system |
| `belseco_hopper` | 0–1 | Material remaining |

## Console — `belseco/console.lua`

| Value | Range | Meaning |
| --- | --- | --- |
| `belseco_master` | 0/1 | Upfit master power |
| `belseco_sw_1` … `sw_16` | 0/1 | Switch panel rocker positions |

## Vehicle Lua globals

The console controller publishes three globals into the vehicle's Lua VM so
keybinds and UI apps never need to know the controller lookup API:

```lua
belsecoAction(name, value)   -- e.g. belsecoAction('lightbar.cycle')
belsecoPreset(name)          -- e.g. belsecoPreset('blockLeft')
belsecoState()               -- full state table, used by the console app
```

Guard them the way the shipped bindings do, so a vehicle without the upfit is a
no-op rather than an error:

```lua
if belsecoAction then belsecoAction('siren.toggle') end
```

Action names are the keys of the `actions` table in `console.lua`; preset names
are the keys of `presets`.
