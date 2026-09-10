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

A 4.4 km × 4.4 km level, all of it drivable — a 36-block city grid inside a ring
beltway:

- **Beltway** — a four-lane ring highway right around the city, about a 10 km
  lap, with sweeping corners, guardrail on every curve, green overhead signs at
  the four junctions into town and diagonal ramps at all four corners.
- **Street network** — two-lane residential streets on a 300 m × 280 m grid,
  four-lane arterials on Main Street, Central Avenue and four more spines.
- **Crestwood Apartments** — fifteen four- and three-storey walk-up blocks
  spread over four city blocks, with exterior stair towers, balconies, rooftop
  HVAC, a leasing office, a pool and parking bays on internal drive loops.
- **Crestwood High School** — a two-storey H-plan brick building with a domed
  entrance rotunda and flagpole, a separate gym, a bus loop, staff parking, and
  a stadium: 100 m field, running track, two sets of bleachers and goal posts.
- **KRST 98.7** — a four-block broadcast campus: the station with a glass lobby,
  rooftop studio penthouse and three satellite dishes, a standby generator, a
  dish farm, a **152 m guyed lattice mast** with aviation-orange banding, guy
  anchors and beacons, plus an 84 m backup mast. Visible from anywhere on the
  highway.
- **About 200 houses** across twelve residential streets — four house types, gable
  roofs, attached garages, driveways cut to the kerb, porches, chimneys, sheds
  and mailboxes.
- **Downtown and the rest** — five blocks of office towers with plazas, strip
  malls, a gas station with a lit forecourt canopy, freight yards, water towers,
  two parks with ponds and paths, billboards, bus shelters, traffic signals,
  street lighting and about 2,300 trees.

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

Districts are assigned by a 6×6 code grid in `layout.py` (`CODES`), and each
code has a generator that fills its block. To resize the city, change `XS`/`YS`,
the block centres and that grid — nothing is hand-placed per building.

### Level structure

```
levels/crestwood/info.json                       metadata + spawn points
levels/crestwood/preview.png                     required by the level selector
levels/crestwood/main/items.level.json           root scene file: declares MissionGroup
levels/crestwood/main/MissionGroup/items.level.json   every scene object, one per line
levels/crestwood/art/main.materials.json         material library
levels/crestwood/art/{shapes,textures}/          meshes and textures
```

The root `main/items.level.json` matters: every object in the level declares
`"__parent": "MissionGroup"`, so that group has to exist.

Roads are real geometry rather than terrain decals, so they render and collide
regardless of terrain support; a matching set of hidden `DecalRoad` splines is
buried 5 cm under the asphalt to carry the AI navigation graph for traffic.
Each `.dae` exports its visual node plus a `Col-1` collision node pointing at
the same geometry, so collision works whether the engine uses the visible mesh
or looks for a collision mesh.
