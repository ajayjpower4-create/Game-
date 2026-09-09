# Crestwood — a BeamNG.drive level

`dist/Crestwood_City.zip` is the finished mod. Drop the **whole zip** (don't
unpack it) into your BeamNG mods folder:

| OS | Path |
| --- | --- |
| Windows | `Documents\BeamNG.drive\<version>\mods\` |
| Linux | `~/.local/share/BeamNG.drive/<version>/mods/` |
| macOS | `~/Library/Application Support/BeamNG.drive/<version>/mods/` |

`<version>` is the game version folder, e.g. `0.36`. Then launch the game and
pick **Crestwood** under Freeroam. The first load is slower because the engine
caches every `.dae` into its own `.cdae` format.

## What's in the map

A 2.7 km × 2.7 km level, all of it drivable:

- **Beltway** — a four-lane divided ring highway right around the city, roughly
  a 6 km lap, with banked-looking sweeping corners, guardrail on every curve and
  green overhead signs at the four junctions into town.
- **Crestwood Apartments** — ten four- and three-storey walk-up blocks with
  exterior stair towers, balconies, rooftop HVAC, a leasing office, a pool and
  six parking bays served by an internal drive loop.
- **Crestwood High School** — a two-storey H-plan brick building with a domed
  entrance rotunda and flagpole, a separate gym, a bus loop, staff parking, and
  a stadium: 100 m field, running track, two sets of bleachers and goal posts.
- **KRST 98.7** — broadcast building with a glass lobby, rooftop studio
  penthouse and three satellite dishes, a standby generator, a dish farm, and a
  **118 m guyed lattice mast** with aviation-orange banding, three guy anchors
  and beacons. You can see it from the highway.
- **Ninety houses** across five residential streets — four house types, gable
  roofs, attached garages, driveways cut to the kerb, porches, chimneys, sheds
  and mailboxes.
- **Downtown and the rest** — office towers, two strip malls, a gas station with
  a lit forecourt canopy, freight warehouses, a water tower, billboards, bus
  shelters, traffic signals, street lighting and about 1,300 trees.

Five spawn points: Main Street (default), the apartments, the school, the radio
station and the beltway.

## Rebuilding it

Everything — geometry, textures, materials, the scene tree — is generated from
scratch by Python with no third-party dependencies:

```bash
python3 tools/build_map.py
```

That writes the level tree to `build/` and repacks `dist/Crestwood_City.zip`.

| File | Job |
| --- | --- |
| `tools/png.py` | PNG encoder and a small drawing canvas |
| `tools/textures.py` | The 41 procedural textures (brick, siding, road markings, …) |
| `tools/mesh.py` | Mesh primitives and the COLLADA `.dae` exporter |
| `tools/buildings.py` | Every building and prop |
| `tools/layout.py` | Road network, districts, placement rules |
| `tools/build_map.py` | Ties it together: shapes, materials, scene, preview, zip |

Roads are real geometry rather than terrain decals, so they render and collide
regardless of terrain support; a matching set of hidden `DecalRoad` splines is
buried 5 cm under the asphalt to carry the AI navigation graph for traffic.
Each `.dae` exports its visual node plus a `Col-1` collision node pointing at
the same geometry, so collision works whether the engine uses the visible mesh
or looks for a collision mesh.
