#!/usr/bin/env python3
"""Build the Crestwood BeamNG.drive level and pack it into an installable zip."""
import os, sys, math, json, shutil, uuid, random, zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from png import Img                      # noqa: E402
import textures as TX                    # noqa: E402
import buildings as B                    # noqa: E402
import layout as L                       # noqa: E402
from mesh import Mesh, write_dae         # noqa: E402

OUT = os.path.abspath(os.path.join(HERE, '..', 'build'))
DIST = os.path.abspath(os.path.join(HERE, '..', 'dist'))
LVL = L.LEVEL
ROOT = os.path.join(OUT, 'levels', LVL)
ART = os.path.join(ROOT, 'art')
TEXDIR = os.path.join(ART, 'textures')
SHAPEDIR = os.path.join(ART, 'shapes')
TPATH = '/levels/%s/art/textures/' % LVL
SPATH = '/levels/%s/art/shapes/' % LVL

rng = random.Random(20240915)


def pid():
    return str(uuid.uuid4())


# ------------------------------------------------------------- materials -----
# name -> (texture key, roughness, metallic, emissive)
MATS = [
    ('crest_grass', 'grass', 1.0, 0.0, False),
    ('crest_dirt', 'dirt', 1.0, 0.0, False),
    ('crest_asphalt', 'asphalt', 0.92, 0.0, False),
    ('crest_concrete', 'concrete', 0.9, 0.0, False),
    ('crest_sidewalk', 'sidewalk', 0.9, 0.0, False),
    ('crest_track', 'track', 0.95, 0.0, False),
    ('crest_field', 'field', 1.0, 0.0, False),
    ('crest_water', 'water', 0.15, 0.0, False),
    ('crest_road_highway', 'road_highway', 0.86, 0.0, False),
    ('crest_road_arterial', 'road_arterial', 0.86, 0.0, False),
    ('crest_road_street', 'road_street', 0.88, 0.0, False),
    ('crest_road_alley', 'road_alley', 0.92, 0.0, False),
    ('crest_parking', 'parking', 0.9, 0.0, False),
    ('crest_crosswalk', 'crosswalk', 0.88, 0.0, False),
    ('crest_brick', 'brick', 0.94, 0.0, False),
    ('crest_stucco', 'stucco', 0.92, 0.0, False),
    ('crest_apartment_wall', 'apartment_wall', 0.85, 0.0, False),
    ('crest_school_wall', 'school_wall', 0.9, 0.0, False),
    ('crest_house_wall', 'house_wall', 0.88, 0.0, False),
    ('crest_house_wall_b', 'house_wall_b', 0.88, 0.0, False),
    ('crest_house_wall_c', 'house_wall_c', 0.9, 0.0, False),
    ('crest_house_wall_plain', 'house_wall_plain', 0.88, 0.0, False),
    ('crest_office_wall', 'office_wall', 0.35, 0.1, False),
    ('crest_industrial', 'industrial_wall', 0.6, 0.35, False),
    ('crest_radio_wall', 'radio_wall', 0.8, 0.0, False),
    ('crest_shingle', 'shingle', 0.95, 0.0, False),
    ('crest_shingle_brown', 'shingle_brown', 0.95, 0.0, False),
    ('crest_flat_roof', 'flat_roof', 0.95, 0.0, False),
    ('crest_metal', 'metal', 0.45, 0.55, False),
    ('crest_metal_red', 'metal_red', 0.5, 0.3, False),
    ('crest_glass', 'glass_dark', 0.12, 0.2, False),
    ('crest_garage', 'garage_door', 0.6, 0.2, False),
    ('crest_door', 'door', 0.7, 0.0, False),
    ('crest_bark', 'bark', 0.98, 0.0, False),
    ('crest_leaves', 'leaves', 0.98, 0.0, False),
    ('crest_pine', 'pine_leaves', 0.98, 0.0, False),
    ('crest_sign', 'sign_radio', 0.6, 0.1, False),
    ('crest_sign_green', 'sign_green', 0.6, 0.1, False),
    ('crest_signal', 'signal', 0.6, 0.1, True),
    ('crest_lamp', 'lamp', 0.4, 0.0, True),
    ('crest_beacon', 'beacon', 0.5, 0.0, True),
]


def write_textures():
    os.makedirs(TEXDIR, exist_ok=True)
    used = sorted({t for (_n, t, _r, _m, _e) in MATS})
    for key in used:
        TX.ALL[key]().save(os.path.join(TEXDIR, key + '.png'))
    return used


def write_materials():
    out = {}
    for (name, tex, rough, metal, emis) in MATS:
        p = TPATH + tex + '.png'
        stage = {
            'baseColorMap': p,
            'colorMap': p,
            'roughnessFactor': rough,
            'metallicFactor': metal,
            'baseColorFactor': [1, 1, 1, 1],
            'useAnisotropic': True,
        }
        if emis:
            stage['emissive'] = True
            stage['glow'] = True
            stage['emissiveFactor'] = [1, 1, 1]
        out[name] = {
            'name': name,
            'mapTo': name,
            'class': 'Material',
            'persistentId': pid(),
            'Stages': [stage, {}, {}, {}],
            'version': 1.5,
            'materialTag0': 'beamng',
            'materialTag1': 'crestwood',
            'translucent': False,
            'castShadows': True,
            'alphaRef': 0,
            'alphaTest': False,
            'doubleSided': False,
        }
    with open(os.path.join(ART, 'main.materials.json'), 'w') as f:
        json.dump(out, f, indent=2)
    return len(out)


# ------------------------------------------------------------ ground mesh ----
def lot(m, mat, x0, y0, x1, y1, z, tu, tv):
    m.quad(mat, (x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z),
           (0, 0), ((x1 - x0) / tu, 0), ((x1 - x0) / tu, (y1 - y0) / tv),
           (0, (y1 - y0) / tv))


def build_ground():
    m = Mesh('groundmesh')
    n, g = 26, L.GROUND
    step = 2 * g / n
    for i in range(n):
        for j in range(n):
            x0, y0 = -g + i * step, -g + j * step
            m.plane('crest_grass', x0, y0, x0 + step, y0 + step, L.Z_GRASS, tile=9.0)
    # sports field and its running track infill
    lot(m, 'crest_dirt', -232, 356, -48, 444, L.Z_GRASS + 0.01, 6.0, 6.0)
    lot(m, 'crest_field', -190, 375, -90, 425, L.Z_GRASS + 0.02, 6.4, 6.4)
    # park pond
    lot(m, 'crest_dirt', -466, 124, -384, 181, L.Z_GRASS + 0.01, 5.0, 5.0)
    lot(m, 'crest_water', -460, 130, -390, 175, L.Z_GRASS + 0.03, 12.0, 12.0)
    return m


def track_oval():
    pts, cx0, cx1, cy, r = [], -190.0, -90.0, 400.0, 35.0
    pts.append((cx0, cy - r))
    n = 24
    for i in range(n + 1):
        a = -math.pi / 2 + math.pi * i / n
        pts.append((cx1 + r * math.cos(a), cy + r * math.sin(a)))
    pts.append((cx0, cy + r))
    for i in range(n + 1):
        a = math.pi / 2 + math.pi * i / n
        pts.append((cx0 + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def build_roads():
    m = Mesh('roadmesh')
    for (name, pts, w, mat, z, tl, _d) in L.roads():
        m.ribbon(mat, pts, w, z, tex_len=tl)
    for (x0, y0, x1, y1, mat) in L.parking_lots():
        tu, tv = (2.7, 5.5) if mat == 'crest_parking' else (4.0, 4.0)
        lot(m, mat, x0, y0, x1, y1, L.Z_LOT, tu, tv)
    for (x0, y0, x1, y1, mat) in L.concrete_pads():
        lot(m, mat, x0, y0, x1, y1, L.Z_LOT, 4.0, 4.0)
    # kerbed sidewalks
    for (x0, y0, x1, y1) in L.sidewalk_runs():
        m.box('crest_concrete', x0, y0, 0.0, x1, y1, L.Z_WALK,
              mat_top='crest_sidewalk', tile=2.0, tile_v=0.6, top_tile=2.5)
    # driveways
    hs = L.houses(random.Random(7))
    for (x0, y0, x1, y1) in L.driveways(hs):
        lot(m, 'crest_concrete', x0, y0, x1, y1, L.Z_LOT + 0.002, 3.0, 3.0)
    # running track
    m.ribbon('crest_track', track_oval(), 9.0, L.Z_GRASS + 0.03, tex_len=9.0)
    # park paths
    m.ribbon('crest_sidewalk', [(-540, 30), (-470, 90), (-420, 160), (-350, 210),
                                (-300, 245)], 3.0, L.Z_GRASS + 0.04, tex_len=3.0)
    m.ribbon('crest_sidewalk', [(-540, 240), (-470, 200), (-430, 120), (-360, 60),
                                (-300, 20)], 3.0, L.Z_GRASS + 0.04, tex_len=3.0)
    # crosswalks at the four central intersections
    for (cx, cy) in ((0, 0), (280, 0), (-280, 0), (0, 260), (0, -260)):
        lot(m, 'crest_crosswalk', cx - 8, cy - 11.5, cx + 8, cy - 8.0,
            L.Z_EW + 0.004, 4.0, 3.5)
        lot(m, 'crest_crosswalk', cx - 8, cy + 8.0, cx + 8, cy + 11.5,
            L.Z_EW + 0.004, 4.0, 3.5)
    return m


# ---------------------------------------------------------------- shapes -----
def build_shapes():
    os.makedirs(SHAPEDIR, exist_ok=True)
    made = {}

    def emit(key, mesh):
        p = os.path.join(SHAPEDIR, key + '.dae')
        v, t = write_dae(mesh, p)
        made[key] = (v, t)

    emit('ground', build_ground())
    emit('roads', build_roads())
    emit('apartment_a', B.apartment_block(54, 16, 4, 'apartmenta'))
    emit('apartment_b', B.apartment_block(46, 16, 3, 'apartmentb'))
    emit('leasing_office', B.leasing_office())
    emit('pool', B.pool())
    emit('school_main', B.school_main())
    emit('school_gym', B.school_gym())
    emit('bleachers', B.bleachers())
    emit('goal_post', B.goal_post())
    emit('radio_station', B.radio_station())
    emit('radio_tower', B.radio_tower(118.0))
    emit('satellite_farm', B.satellite_farm())
    for i in range(4):
        emit('house_%s' % 'abcd'[i], B.house(i, seed=i))
    emit('shed', B.shed())
    emit('mailbox', B.mailbox())
    emit('office_tower_a', B.office_tower(8, 26, 20, 'officea'))
    emit('office_tower_b', B.office_tower(12, 24, 24, 'officeb'))
    emit('office_tower_c', B.office_tower(5, 34, 22, 'officec'))
    emit('strip_mall', B.strip_mall())
    emit('warehouse', B.warehouse())
    emit('gas_station', B.gas_station())
    emit('water_tower', B.water_tower())
    emit('billboard', B.billboard())
    emit('bus_shelter', B.bus_shelter())
    emit('dumpster', B.dumpster())
    emit('streetlight', B.streetlight())
    emit('traffic_light', B.traffic_light())
    emit('bench', B.bench())
    emit('guardrail', B.guardrail(24.0))
    emit('overpass_sign', B.overpass_sign())
    for i in range(3):
        emit('tree_oak_%d' % (i + 1), B.tree_oak(i * 13 + 1))
        emit('tree_pine_%d' % (i + 1), B.tree_pine(i * 17 + 1))
    return made


# ------------------------------------------------------------- placements ---
def placements():
    """(shape, x, y, yaw_degrees, scale) for every TSStatic in the level."""
    P = []

    # ---- apartment complex (north east) ----
    for (shape, x, y, yaw) in L.apartments():
        P.append((shape, x, y, yaw, 1.0))
    P.append(('leasing_office', 60, 281, 0, 1.0))
    P.append(('pool', 330, 470, 0, 1.0))
    for (x, y) in ((124, 310), (124, 492), (404, 310), (404, 492)):
        P.append(('dumpster', x, y, rng.uniform(0, 360), 1.0))
    for (x, y) in ((200, 293), (200, 507), (480, 293), (480, 507)):
        P.append(('streetlight', x, y, 90, 1.0))

    # ---- school campus (north west) ----
    P.append(('school_main', -420, 410, 0, 1.0))
    P.append(('school_gym', -505, 468, 0, 1.0))
    P.append(('bus_shelter', -420, 296, 180, 1.0))
    P.append(('billboard', -300, 300, 200, 1.0))
    for x in (-480, -440, -400, -360):
        P.append(('streetlight', x, 348, 0, 1.0))

    # ---- athletics field ----
    P.append(('bleachers', -140, 345, 180, 1.0))
    P.append(('bleachers', -140, 455, 0, 1.0))
    P.append(('goal_post', -190, 400, 90, 1.0))
    P.append(('goal_post', -90, 400, 270, 1.0))
    for (x, y) in ((-236, 356), (-44, 356), (-236, 444), (-44, 444)):
        P.append(('streetlight', x, y, math.degrees(math.atan2(400 - y, -140 - x)) + 90, 1.0))

    # ---- radio station (south east) ----
    P.append(('radio_station', 350, -320, 180, 1.0))
    P.append(('radio_tower', 470, -430, 0, 1.0))
    P.append(('satellite_farm', 330, -400, 0, 1.0))
    P.append(('billboard', 300, -246, 0, 1.0))
    for (x, y) in ((300, -276), (420, -276), (500, -276)):
        P.append(('streetlight', x, y, 0, 1.0))
    P.append(('dumpster', 372, -300, 12, 1.0))

    # ---- downtown / civic ----
    P.append(('office_tower_b', -220, 205, 0, 1.0))
    P.append(('office_tower_a', -150, 210, 0, 1.0))
    P.append(('office_tower_c', -70, 205, 0, 1.0))
    P.append(('office_tower_a', 240, 205, 0, 1.0))
    P.append(('strip_mall', 140, 205, 0, 1.0))
    for x in range(-250, -20, 46):
        P.append(('bench', x, 172, 0, 1.0))
    P.append(('bus_shelter', -60, 12, 0, 1.0))
    P.append(('bus_shelter', 60, -12, 180, 1.0))

    # ---- fuel + freight ----
    P.append(('gas_station', 350, 100, 0, 1.0))
    P.append(('warehouse', 450, 210, 0, 1.0))
    P.append(('billboard', 540, 30, 250, 1.0))
    P.append(('warehouse', 370, -200, 180, 1.0))
    P.append(('warehouse', 490, -200, 180, 1.0))
    P.append(('water_tower', 330, -70, 0, 1.0))
    for (x, y) in ((320, -150), (420, -150), (520, -150)):
        P.append(('dumpster', x, y, rng.uniform(0, 360), 1.0))

    # ---- shopping centre ----
    P.append(('strip_mall', 140, -215, 180, 1.0))
    P.append(('billboard', 30, -30, 160, 1.0))

    # ---- housing ----
    hs = L.houses(random.Random(7))
    for (shape, x, y, yaw) in hs:
        P.append((shape, x, y, yaw, 1.0))
        s = 1.0 if abs(yaw) < 90.0 else -1.0
        mx, my = L.mailbox_spot(x, y, yaw)
        P.append(('mailbox', mx, my, yaw, 1.0))
        if rng.random() < 0.45:
            P.append(('shed', x + rng.uniform(-4, 4), y + s * 9.0, rng.uniform(0, 360), 1.0))

    # ---- park ----
    for (x, y, yaw) in ((-480, 200, 200), (-400, 210, 160), (-360, 90, 20),
                        (-470, 60, 340), (-330, 160, 120)):
        P.append(('bench', x, y, yaw, 1.0))

    # ---- trees ----
    for (kind, x, y, yaw) in L.trees(random.Random(3)):
        v = rng.randrange(1, 4)
        P.append(('%s_%d' % (kind, v), x, y, yaw, rng.uniform(0.82, 1.28)))

    # ---- streetscape ----
    for (shape, x, y, yaw) in L.streetlights():
        P.append((shape, x, y, yaw, 1.0))
    for (shape, x, y, yaw) in L.signals():
        P.append((shape, x, y, yaw, 1.0))
    for (shape, x, y, yaw, sc) in L.guardrails():
        P.append((shape, x, y, yaw, max(0.7, sc)))

    # ---- highway signage at the four junctions ----
    P.append(('overpass_sign', 0, L.RING_Y - 46, 0, 1.0))
    P.append(('overpass_sign', 0, -L.RING_Y + 46, 180, 1.0))
    P.append(('overpass_sign', L.RING_X - 46, 0, 270, 1.0))
    P.append(('overpass_sign', -L.RING_X + 46, 0, 90, 1.0))
    return P


def rotmat(yaw_deg):
    a = math.radians(yaw_deg)
    c, s = math.cos(a), math.sin(a)
    return [round(c, 6), round(s, 6), 0.0, round(-s, 6), round(c, 6), 0.0, 0.0, 0.0, 1.0]


SPAWNS = [
    ('spawn_main_street', -70.0, 6.0, 90.0, 'Main Street'),
    ('spawn_apartments', 190.0, 390.0, 0.0, 'Crestwood Apartments'),
    ('spawn_school', -410.0, 320.0, 90.0, 'Crestwood High School'),
    ('spawn_radio', 380.0, -285.0, 90.0, 'KRST 98.7 Radio'),
    ('spawn_highway', -6.0, -L.RING_Y + 6.0, 90.0, 'Beltway'),
]


def write_level_json():
    items = []

    def add(o):
        o.setdefault('persistentId', pid())
        o['__parent'] = 'MissionGroup'
        items.append(o)

    add({'class': 'LevelInfo', 'name': 'theLevelInfo', 'position': [0, 0, 0],
         'nearClip': 0.1, 'visibleDistance': 2600,
         'fogColor': [0.72, 0.78, 0.86, 1.0], 'fogDensity': 0.00035,
         'fogDensityOffset': 40, 'fogAtmosphereHeight': 900,
         'canvasClearColor': [0.55, 0.65, 0.78, 1.0],
         'ambientLightBlendPhase': 1, 'gravity': -9.81,
         'levelName': 'Crestwood', 'accuTexture': ''})

    add({'class': 'ScatterSky', 'name': 'sunsky', 'position': [0, 0, 0],
         'azimuth': 152.0, 'elevation': 47.0, 'brightness': 1.05,
         'skyBrightness': 26.0, 'sunSize': 1.0, 'exposure': 1.0,
         'colorize': [1, 1, 1, 1], 'sunScale': [1, 0.99, 0.95, 1],
         'ambientScale': [0.62, 0.67, 0.78, 1], 'fogScale': [1, 1, 1, 1],
         'nightColor': [0.03, 0.035, 0.05, 1],
         'mieScattering': 0.0022, 'rayleighScattering': 0.0035,
         'castShadows': True, 'shadowDistance': 1400, 'shadowSoftness': 0.16,
         'numSplits': 4, 'logWeight': 0.98, 'texSize': 1024,
         'attenuationRatio': [0, 0, 1], 'flareScale': 0.35})

    add({'class': 'TimeOfDay', 'name': 'tod', 'position': [0, 0, 0],
         'axisTilt': 23.44, 'dayLength': 1800, 'dayScale': 1.0,
         'nightScale': 1.6, 'play': False, 'startTime': 0.16,
         'azimuthOverride': 0.0})

    for key, name in (('ground', 'crestwood_ground'), ('roads', 'crestwood_roads')):
        add({'class': 'TSStatic', 'name': name, 'position': [0, 0, 0],
             'rotationMatrix': rotmat(0), 'scale': [1, 1, 1],
             'shapeName': SPATH + key + '.dae',
             'collisionType': 'Visible Mesh Final',
             'decalType': 'Visible Mesh Final',
             'allowPlayerStep': True, 'useInstanceRenderData': True,
             'instanceColor': [1, 1, 1, 1]})

    counts = {}
    for (shape, x, y, yaw, sc) in placements():
        counts[shape] = counts.get(shape, 0) + 1
        add({'class': 'TSStatic', 'name': '%s_%03d' % (shape, counts[shape]),
             'position': [round(x, 3), round(y, 3), 0.0],
             'rotationMatrix': rotmat(yaw), 'scale': [sc, sc, sc],
             'shapeName': SPATH + shape + '.dae',
             'collisionType': 'Visible Mesh Final',
             'decalType': 'Visible Mesh Final',
             'allowPlayerStep': True, 'useInstanceRenderData': True,
             'instanceColor': [1, 1, 1, 1]})

    # Buried, non-rendering decal roads: they carry the AI navigation graph so
    # traffic and the race AI can use the street network.
    for (name, pts, w, _mat, z, tl, driv) in L.roads():
        nodes = [[round(px, 3), round(py, 3), round(z - 0.05, 3), round(w, 2)]
                 for (px, py) in pts]
        add({'class': 'DecalRoad', 'name': 'ai_' + name, 'position': list(nodes[0][:3]),
             'nodes': nodes, 'Material': 'crest_road_street',
             'material': 'crest_road_street', 'textureLength': tl,
             'breakAngle': 3.0, 'renderPriority': 10, 'improvedSpline': True,
             'overObjects': False, 'drivability': driv, 'hidden': True,
             'startEndFade': [0, 0], 'distanceFade': [1000, 1000],
             'useTemplate': False, 'oneWay': False, 'flipDirection': False})

    for (name, x, y, yaw, _label) in SPAWNS:
        add({'class': 'SpawnSphere', 'name': name,
             'position': [x, y, 0.35], 'rotationMatrix': rotmat(yaw),
             'scale': [1, 1, 1], 'radius': 1.0, 'sphereWeight': 1.0,
             'indoorWeight': 1.0, 'outdoorWeight': 1.0, 'autoSpawn': False,
             'dataBlock': 'SpawnSphereMarker', 'spawnClass': 'BeamNGVehicle',
             'spawnProperties': ''})

    d = os.path.join(ROOT, 'main', 'MissionGroup')
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, 'items.level.json'), 'w') as f:
        for o in items:
            f.write(json.dumps(o, separators=(',', ':')) + '\n')
    return len(items)


def quat_yaw(deg):
    a = math.radians(deg) / 2.0
    return [0.0, 0.0, round(math.sin(a), 6), round(math.cos(a), 6)]


def write_info():
    info = {
        'title': 'Crestwood',
        'description': ('An American city built for driving: a ring beltway around '
                        'the whole town, a downtown grid, five suburban housing '
                        'streets, the Crestwood Apartments, Crestwood High School '
                        'with its own stadium, and KRST 98.7 with a 118 m radio '
                        'mast you can see from the highway.'),
        'previews': ['crestwood_preview.png'],
        'authors': 'Built with Claude Code',
        'country': 'USA',
        'biome': 'Temperate',
        'size': [2700, 2700],
        'levelName': LVL,
        'defaultSpawnPointName': 'spawn_main_street',
        'spawnPoints': [
            {'objectname': n, 'translation': [x, y, 0.35], 'rotation': quat_yaw(yaw),
             'preview': 'crestwood_preview.png', 'previewImg': 'crestwood_preview.png',
             'name': label}
            for (n, x, y, yaw, label) in SPAWNS
        ],
        'minimumVersion': 0,
        'suffix': '',
    }
    with open(os.path.join(ROOT, 'info.json'), 'w') as f:
        json.dump(info, f, indent=2)


# --------------------------------------------------------------- preview -----
PW, PH = 1280, 720
PSCALE = PH / 1600.0


def w2p(x, y):
    return (PW / 2 + x * PSCALE, PH / 2 - y * PSCALE)


def fill_poly(im, pts, color):
    ys = [p[1] for p in pts]
    for yy in range(max(0, int(min(ys))), min(im.h, int(max(ys)) + 1)):
        xs = []
        n = len(pts)
        for i in range(n):
            (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % n]
            if (y0 <= yy < y1) or (y1 <= yy < y0):
                xs.append(x0 + (yy - y0) * (x1 - x0) / (y1 - y0))
        xs.sort()
        for k in range(0, len(xs) - 1, 2):
            im.rect(int(xs[k]), yy, int(xs[k + 1]) + 1, yy + 1, color)


def thick_line(im, pts, width_m, color):
    r = max(0.8, width_m * PSCALE / 2.0)
    for i in range(len(pts) - 1):
        a, b = w2p(*pts[i]), w2p(*pts[i + 1])
        d = math.hypot(b[0] - a[0], b[1] - a[1])
        n = max(1, int(d))
        for k in range(n + 1):
            t = k / n
            cx, cy = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
            im.rect(cx - r, cy - r, cx + r + 1, cy + r + 1, color)


def rot_rect(x, y, w, d, yaw, color, im):
    a = math.radians(yaw)
    c, s = math.cos(a), math.sin(a)
    pts = []
    for (dx, dy) in ((-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2)):
        pts.append(w2p(x + dx * c - dy * s, y + dx * s + dy * c))
    fill_poly(im, pts, color)


FOOTPRINT = {
    'apartment_a': (54, 20, (196, 168, 128)), 'apartment_b': (46, 20, (196, 168, 128)),
    'leasing_office': (22, 16, (196, 168, 128)), 'pool': (28, 20, (70, 140, 176)),
    'school_main': (92, 62, (172, 92, 70)), 'school_gym': (52, 38, (172, 92, 70)),
    'bleachers': (36, 12, (150, 150, 146)),
    'radio_station': (38, 26, (206, 208, 206)),
    'satellite_farm': (24, 6, (170, 174, 178)),
    'office_tower_a': (26, 20, (86, 106, 128)), 'office_tower_b': (24, 24, (86, 106, 128)),
    'office_tower_c': (34, 22, (86, 106, 128)),
    'strip_mall': (88, 28, (188, 176, 150)), 'warehouse': (54, 32, (176, 178, 176)),
    'gas_station': (26, 18, (198, 78, 62)), 'water_tower': (13, 13, (170, 174, 178)),
    'house_a': (20, 11, (214, 216, 210)), 'house_b': (20, 11, (196, 178, 150)),
    'house_c': (20, 11, (168, 128, 106)), 'house_d': (22, 10, (208, 208, 202)),
    'shed': (4, 4, (200, 200, 195)),
}
ROAD_COLOR = {'crest_road_highway': (48, 48, 52), 'crest_road_arterial': (62, 62, 66),
              'crest_road_street': (72, 72, 76), 'crest_road_alley': (86, 86, 88)}


def write_preview():
    im = Img(PW, PH, (96, 122, 62))
    rng2 = random.Random(5)
    for _ in range(2600):
        x, y = rng2.randrange(PW), rng2.randrange(PH)
        o = im.get(x, y)
        d = rng2.uniform(-14, 14)
        im.set(x, y, (o[0] + d, o[1] + d, o[2] + d * 0.5))
    # trees
    for (kind, x, y, _yaw) in L.trees(random.Random(3)):
        px, py = w2p(x, y)
        c = (52, 86, 44) if kind == 'tree_pine' else (68, 104, 50)
        im.rect(px - 1.6, py - 1.6, px + 1.6, py + 1.6, c)
    # lots
    for (x0, y0, x1, y1, _m) in L.parking_lots():
        p0, p1 = w2p(x0, y1), w2p(x1, y0)
        im.rect(p0[0], p0[1], p1[0], p1[1], (78, 78, 80))
    for (x0, y0, x1, y1, _m) in L.concrete_pads():
        p0, p1 = w2p(x0, y1), w2p(x1, y0)
        im.rect(p0[0], p0[1], p1[0], p1[1], (150, 148, 142))
    # sports field
    p0, p1 = w2p(-190, 425), w2p(-90, 375)
    im.rect(p0[0], p0[1], p1[0], p1[1], (78, 128, 58))
    thick_line(im, track_oval(), 9.0, (146, 60, 46))
    # roads
    for (_n, pts, w, mat, _z, _t, _d) in L.roads():
        thick_line(im, pts, w + 1.0, ROAD_COLOR.get(mat, (76, 76, 78)))
    # buildings
    for (shape, x, y, yaw, _s) in placements():
        f = FOOTPRINT.get(shape)
        if not f:
            continue
        rot_rect(x, y, f[0], f[1], yaw, f[2], im)
    # radio mast + its guy anchors
    px, py = w2p(470, -430)
    for r in (62 * PSCALE,):
        for k in range(3):
            a = math.radians(90 + k * 120)
            im.rect(px + r * math.cos(a) - 2, py - r * math.sin(a) - 2,
                    px + r * math.cos(a) + 2, py - r * math.sin(a) + 2, (140, 140, 140))
    im.rect(px - 4, py - 4, px + 4, py + 4, (214, 70, 54))
    # frame
    im.rect(0, 0, PW, 4, (26, 28, 32))
    im.rect(0, PH - 4, PW, PH, (26, 28, 32))
    im.rect(0, 0, 4, PH, (26, 28, 32))
    im.rect(PW - 4, 0, PW, PH, (26, 28, 32))
    im.save(os.path.join(ROOT, 'crestwood_preview.png'))


# ------------------------------------------------------------------ pack -----
READ_ME = """CRESTWOOD - a BeamNG.drive level
================================

INSTALL
  1. Open BeamNG.drive once so the user folder exists.
  2. Put Crestwood_City.zip (this whole zip, do NOT unpack it) into:
       Windows : Documents\\BeamNG.drive\\<version>\\mods\\
       Linux   : ~/.local/share/BeamNG.drive/<version>/mods/
       macOS   : ~/Library/Application Support/BeamNG.drive/<version>/mods/
     <version> is the game version folder, e.g. 0.36
  3. Start the game. Single Player -> New Game / Freeroam -> pick "Crestwood".
     First load takes a little longer while the game caches the meshes.

WHAT IS IN IT
  * A four lane ring beltway around the entire city (about 6 km lap).
  * Crestwood Apartments: ten walk-up blocks, leasing office, pool, parking.
  * Crestwood High School: two storey building, gym, stadium with a running
    track, bleachers and goal posts, bus loop and staff parking.
  * KRST 98.7: broadcast building with roof dishes plus a 118 m guyed lattice
    mast with aviation banding and beacons.
  * Five residential streets, ninety houses with garages, driveways and sheds.
  * Downtown: office towers, strip malls, a gas station, freight yards and a
    water tower.

SPAWN POINTS
  Main Street (default), Crestwood Apartments, Crestwood High School,
  KRST 98.7 Radio, Beltway.

UNINSTALL
  Delete the zip from the mods folder.
"""


def pack():
    os.makedirs(DIST, exist_ok=True)
    with open(os.path.join(ROOT, 'README.txt'), 'w') as f:
        f.write(READ_ME)
    zpath = os.path.join(DIST, 'Crestwood_City.zip')
    if os.path.exists(zpath):
        os.remove(zpath)
    with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for base, _dirs, files in os.walk(OUT):
            for fn in sorted(files):
                full = os.path.join(base, fn)
                z.write(full, os.path.relpath(full, OUT))
    return zpath


def main():
    if os.path.exists(OUT):
        shutil.rmtree(OUT)
    os.makedirs(ART, exist_ok=True)
    print('textures ...', end=' ', flush=True)
    print(len(write_textures()))
    print('materials ...', end=' ', flush=True)
    print(write_materials())
    print('shapes ...', end=' ', flush=True)
    made = build_shapes()
    tris = sum(t for (_v, t) in made.values())
    print('%d meshes, %d triangles' % (len(made), tris))
    print('scene ...', end=' ', flush=True)
    print(write_level_json(), 'objects')
    write_info()
    print('preview ...', end=' ', flush=True)
    write_preview()
    print('ok')
    z = pack()
    print('\npacked: %s (%.2f MB)' % (z, os.path.getsize(z) / 1048576.0))


if __name__ == '__main__':
    main()
