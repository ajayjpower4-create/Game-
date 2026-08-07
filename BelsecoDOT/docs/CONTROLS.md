# Controls

Every function is reachable three ways: the **Belseco Fleet Console** UI app, a
**bindable key**, and the **cab switch panel** (once switch meshes exist). All
three route through the same dispatcher in `console.lua`, so they always agree.

## Bindable actions

Bind these under `Options → Controls → Bindings`, filter `Belseco`.

### Master

| Action | Effect |
| --- | --- |
| Upfit Master | Kills or restores power to every upfit system. With master off, no other control responds. |
| All Systems Off | Panic-off: lightbar, siren, advisor, arrow board, scene lighting. Leaves master on. |

### Lightbar and advisor

| Action | Effect |
| --- | --- |
| Lightbar Level | Off → 1 cruise (35% output) → 2 warning → 3 lane blocking |
| Lightbar On/Off | Straight to level 2 and back |
| Flash Pattern | Quad flash → double flash → slow alternate → attention all → steady |
| Traffic Advisor | Off → left → right → split → wig-wag |

Levels 2 and 3 override the flash pattern with their own program; level 1 always
runs steady at reduced output. Setting the lightbar to off also clears the
advisor.

### Siren

| Action | Effect |
| --- | --- |
| Siren On/Off | Toggles using the last tone you selected |
| Siren Tone | Wail → yelp → phaser → hi-lo |
| Air Horn | Momentary while held; ducks the siren tone to 35% |

The siren also drives the vanilla `lightbar` electrics value to 2, so stock
lightbar parts show their siren-active state.

The **reversing alarm** is automatic — it follows the gear selector and needs no
binding.

### Arrow board

| Action | Effect |
| --- | --- |
| Arrow Board Mast | Raise or stow, 2.6 s travel |
| Arrow Board Display | Off → four corner → caution bar → left → right → double → flashing caution |

Selecting a display automatically raises the mast. Stowing the mast blanks the
board, and lamps stay dark below 90% mast travel, so you cannot drive down the
road showing an arrow.

### Scene lighting

| Action | Effect |
| --- | --- |
| Scene Lighting Package | Floods, alley lights, ground lights, beacons and work floods together |
| Auxiliary Lighting Off | All fixtures off, lightbar keeps running |
| Take-Down Lights | Forward-facing take-downs |
| Alley Light Left / Right | Side-facing alley lights |
| Rear Scene Flood | Rear work light |
| Roof Beacons | Rotating beacons |
| Headlight Wig-Wags | Alternating headlight flash, 0.42 s per side |
| Work Area Floods | The big 15 A floods |

### Winter operations

Only present on the Plow Truck configurations.

| Action | Effect |
| --- | --- |
| Plow Raise/Lower | 1.8 s travel |
| Plow Float Mode | Blade follows the road surface; forces the blade down |
| Plow Angle Left / Right | ±50% per press, 2.4 s full travel |
| Spreader On/Off | Refuses to start with an empty hopper |
| Spread Rate + / − | Ten detents, 300 lb per lane mile at full gate |
| Pre-Wet System | Toggles the brine pre-wet |

### Response presets

| Preset | Sets |
| --- | --- |
| Travel | Everything off |
| Responding | Lightbar 2, wail, wig-wags, take-downs |
| On Scene | Lightbar 3, siren off, full scene package |
| Lane Block Merge Left | Lightbar 3, advisor left, arrow board left, scene package |
| Lane Block Merge Right | Lightbar 3, advisor right, arrow board right, scene package |

## Console app

Four tabs:

- **LIGHTS** — lightbar levels, flash pattern, advisor, siren tones, air horn
  (press and hold), and the five presets.
- **BOARD** — a live 5×3 lamp preview that blinks in step with the real board, a
  mast position meter, and the seven display modes.
- **WINTER** — plow and spreader controls, blade angle readout, hopper gauge in
  pounds, and a reload button. Hidden on trucks without winter equipment.
- **PANEL** — the 16-position switch panel, aux electrical load in amps, and the
  battery state of charge.

The `MASTER` button at the top lights red when master power is **off**.

## Switch panel order

`console.lua` publishes `belseco_sw_1` … `belseco_sw_16` in this order, which is
the order the physical rockers should be modelled in:

| # | Switch | # | Switch |
| --- | --- | --- | --- |
| 1 | MASTER | 9 | TAKEDN |
| 2 | BAR | 10 | ALLEY L |
| 3 | SIREN | 11 | ALLEY R |
| 4 | ADVISOR | 12 | GROUND |
| 5 | ARROW | 13 | BEACON |
| 6 | SCN L | 14 | WIGWAG |
| 7 | SCN R | 15 | WORK |
| 8 | SCN RR | 16 | SPRDR |
