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
    g = L.GROUND
    n = int(2 * g / 100.0)
    step = 2 * g / n
    for i in range(n):
        for j in range(n):
            x0, y0 = -g + i * step, -g + j * step
            m.plane('crest_grass', x0, y0, x0 + step, y0 + step, L.Z_GRASS, tile=9.0)
    fld, trk = L.sports_field()
    if fld:
        cx, cy, sx, sy = trk
        lot(m, 'crest_dirt', cx - sx - 34, cy - sy - 30, cx + sx + 34, cy + sy + 30,
            L.Z_GRASS + 0.01, 6.0, 6.0)
        lot(m, 'crest_field', fld[0], fld[1], fld[2], fld[3], L.Z_GRASS + 0.02, 6.4, 6.4)
    pond = L.park_pond()
    if pond:
        lot(m, 'crest_dirt', pond[0] - 6, pond[1] - 6, pond[2] + 6, pond[3] + 6,
            L.Z_GRASS + 0.01, 5.0, 5.0)
        lot(m, 'crest_water', pond[0], pond[1], pond[2], pond[3],
            L.Z_GRASS + 0.03, 12.0, 12.0)
    return m


def track_oval():
    _fld, trk = L.sports_field()
    cx, cy, hx, r = trk
    pts, n = [], 26
    pts.append((cx - hx, cy - r))
    for i in range(n + 1):
        a = -math.pi / 2 + math.pi * i / n
        pts.append((cx + hx + r * math.cos(a), cy + r * math.sin(a)))
    pts.append((cx - hx, cy + r))
    for i in range(n + 1):
        a = math.pi / 2 + math.pi * i / n
        pts.append((cx - hx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def build_roads():
    m = Mesh('roadmesh')
    for (name, pts, w, mat, z, tl, _d) in L.roads():
        m.ribbon(mat, pts, w, z, tex_len=tl)
    _props, lots, pads = L.district_content()
    for (x0, y0, x1, y1, mat) in lots:
        lot(m, mat, x0, y0, x1, y1, L.Z_LOT, 2.7, 5.5)
    for (x0, y0, x1, y1, mat) in pads:
        lot(m, mat, x0, y0, x1, y1, L.Z_LOT, 4.0, 4.0)
    for (x0, y0, x1, y1) in L.sidewalk_runs():
        m.box('crest_concrete', x0, y0, 0.0, x1, y1, L.Z_WALK,
              mat_top='crest_sidewalk', tile=2.0, tile_v=0.6, top_tile=2.5)
    for (x0, y0, x1, y1) in L.driveways(L.houses(random.Random(7))):
        lot(m, 'crest_concrete', x0, y0, x1, y1, L.Z_LOT + 0.002, 3.0, 3.0)
    m.ribbon('crest_track', track_oval(), 9.0, L.Z_GRASS + 0.03, tex_len=9.0)
    # winding paths through every park block
    for (code, bx, by, _i) in L.blocks():
        if code != 'PRK':
            continue
        m.ribbon('crest_sidewalk',
                 [(bx - 130, by - 90), (bx - 60, by - 30), (bx, by + 40),
                  (bx + 70, by + 80), (bx + 130, by + 110)], 3.0,
                 L.Z_GRASS + 0.04, tex_len=3.0)
        m.ribbon('crest_sidewalk',
                 [(bx - 130, by + 110), (bx - 50, by + 60), (bx + 10, by - 20),
                  (bx + 80, by - 70), (bx + 130, by - 110)], 3.0,
                 L.Z_GRASS + 0.04, tex_len=3.0)
    # crosswalks at every arterial crossroads
    for cx in L.ARTERIALS_X:
        for cy in L.ARTERIALS_Y:
            for s in (-1, 1):
                lot(m, 'crest_crosswalk', cx - 8, cy + s * 8.0, cx + 8, cy + s * 11.5,
                    L.Z_EW + 0.004, 4.0, 3.5)
    return m


# ---------------------------------------------------------------- shapes -----
def build_shapes():
    os.makedirs(SHAPEDIR, exist_ok=True)
    made = {}

    def emit(key, mesh):
        made[key] = write_dae(mesh, os.path.join(SHAPEDIR, key + '.dae'))

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
    emit('radio_tower', B.radio_tower(152.0))
    emit('radio_tower_small', B.radio_tower(84.0))
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
    P = []
    props, _lots, _pads = L.district_content()
    P += props
    for (shape, x, y, yaw) in L.houses(random.Random(7)):
        P.append((shape, x, y, yaw, 1.0))
        s = 1.0 if abs(yaw) < 90.0 else -1.0
        mx, my = L.mailbox_spot(x, y, yaw)
        P.append(('mailbox', mx, my, yaw, 1.0))
        if rng.random() < 0.45:
            P.append(('shed', x + rng.uniform(-4, 4), y + s * 9.0,
                      rng.uniform(0, 360), 1.0))
    for (kind, x, y, yaw) in L.trees(random.Random(3)):
        P.append(('%s_%d' % (kind, rng.randrange(1, 4)), x, y, yaw,
                  rng.uniform(0.82, 1.28)))
    for (shape, x, y, yaw) in L.streetlights():
        P.append((shape, x, y, yaw, 1.0))
    for (shape, x, y, yaw) in L.signals():
        P.append((shape, x, y, yaw, 1.0))
    for (shape, x, y, yaw, sc) in L.guardrails():
        P.append((shape, x, y, yaw, max(0.7, sc)))
    P.append(('overpass_sign', 0, L.RING_Y - 52, 0, 1.0))
    P.append(('overpass_sign', 0, -L.RING_Y + 52, 180, 1.0))
    P.append(('overpass_sign', L.RING_X - 52, 0, 270, 1.0))
    P.append(('overpass_sign', -L.RING_X + 52, 0, 90, 1.0))
    return P


def rotmat(yaw_deg):
    a = math.radians(yaw_deg)
    c, s = math.cos(a), math.sin(a)
    return [round(c, 6), round(s, 6), 0.0, round(-s, 6), round(c, 6), 0.0, 0.0, 0.0, 1.0]


SPAWNS = [
    ('spawn_main_street', -140.0, 6.5, 270.0, 'Main Street'),
    ('spawn_apartments', -268.0, 420.0, 0.0, 'Crestwood Apartments'),
    ('spawn_school', -750.0, 566.0, 270.0, 'Crestwood High School'),
    ('spawn_radio', 450.0, -286.5, 90.0, 'KRST 98.7 Radio'),
    ('spawn_beltway', 0.0, -L.RING_Y + 4.5, 270.0, 'Beltway'),
]


def write_level_json():
    """Root scene file declares MissionGroup; every object lives beneath it."""
    root = os.path.join(ROOT, 'main')
    os.makedirs(root, exist_ok=True)
    with open(os.path.join(root, 'items.level.json'), 'w') as f:
        f.write(json.dumps({'class': 'SimGroup', 'name': 'MissionGroup',
                            'persistentId': pid()}, separators=(',', ':')) + '\n')

    items = []

    def add(o):
        o.setdefault('persistentId', pid())
        o['__parent'] = 'MissionGroup'
        items.append(o)

    add({'class': 'LevelInfo', 'name': 'theLevelInfo', 'position': [0, 0, 0],
         'nearClip': 0.1, 'visibleDistance': 3200,
         'fogColor': [0.72, 0.78, 0.86, 1.0], 'fogDensity': 0.0003,
         'fogDensityOffset': 40, 'fogAtmosphereHeight': 1000,
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
         'castShadows': True, 'shadowDistance': 1600, 'shadowSoftness': 0.16,
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
        add({'class': 'TSStatic', 'name': '%s_%04d' % (shape, counts[shape]),
             'position': [round(x, 3), round(y, 3), 0.0],
             'rotationMatrix': rotmat(yaw), 'scale': [sc, sc, sc],
             'shapeName': SPATH + shape + '.dae',
             'collisionType': 'Visible Mesh Final',
             'decalType': 'Visible Mesh Final',
             'allowPlayerStep': True, 'useInstanceRenderData': True,
             'instanceColor': [1, 1, 1, 1]})

    # Buried, non-rendering decal roads carrying the AI navigation graph.
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

    d = os.path.join(root, 'MissionGroup')
    os.makedirs(d, exist_ok=True)
    with open(os.path.join(d, 'items.level.json'), 'w') as f:
        for o in items:
            f.write(json.dumps(o, separators=(',', ':')) + '\n')
    return len(items)


def quat_yaw(deg):
    a = math.radians(deg) / 2.0
    return [0.0, 0.0, round(math.sin(a), 6), round(math.cos(a), 6)]


def write_info():
    size = int(2 * L.GROUND)
    info = {
        'title': 'Crestwood',
        'description': ('An American city built for driving: a 10 km ring beltway '
                        'around the whole town, a 36 block downtown grid, twelve '
                        'suburban streets, the Crestwood Apartments, Crestwood High '
                        'School with its own stadium, and KRST 98.7 with a 152 m '
                        'radio mast you can see from anywhere on the highway.'),
        'preview': 'preview.png',
        'previews': ['preview.png'],
        'authors': 'Built with Claude Code',
        'country': 'USA',
        'biome': 'Temperate',
        'size': [size, size],
        'levelName': LVL,
        'defaultSpawnPointName': 'spawn_main_street',
        'spawnPoints': [
            {'objectname': n, 'translation': [x, y, 0.35], 'rotation': quat_yaw(yaw),
             'preview': 'preview.png', 'previewImg': 'preview.png', 'name': label}
            for (n, x, y, yaw, label) in SPAWNS
        ],
        'minimumVersion': 0,
        'suffix': '',
    }
    with open(os.path.join(ROOT, 'info.json'), 'w') as f:
        json.dump(info, f, indent=2)


# --------------------------------------------------------------- preview -----
PW, PH = 1280, 720
PSCALE = PH / 2900.0


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
    r = max(0.7, width_m * PSCALE / 2.0)
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
    pts = [w2p(x + dx * c - dy * s, y + dx * s + dy * c)
           for (dx, dy) in ((-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2),
                            (-w / 2, d / 2))]
    fill_poly(im, pts, color)


FOOTPRINT = {
    'apartment_a': (54, 20, (196, 168, 128)), 'apartment_b': (46, 20, (196, 168, 128)),
    'leasing_office': (22, 16, (196, 168, 128)), 'pool': (28, 20, (70, 140, 176)),
    'school_main': (92, 62, (172, 92, 70)), 'school_gym': (52, 38, (172, 92, 70)),
    'bleachers': (36, 12, (150, 150, 146)), 'radio_station': (38, 26, (206, 208, 206)),
    'satellite_farm': (24, 6, (170, 174, 178)),
    'office_tower_a': (26, 20, (86, 106, 128)), 'office_tower_b': (24, 24, (86, 106, 128)),
    'office_tower_c': (34, 22, (86, 106, 128)),
    'strip_mall': (88, 28, (188, 176, 150)), 'warehouse': (54, 32, (176, 178, 176)),
    'gas_station': (26, 18, (198, 78, 62)), 'water_tower': (13, 13, (170, 174, 178)),
    'house_a': (20, 11, (214, 216, 210)), 'house_b': (20, 11, (196, 178, 150)),
    'house_c': (20, 11, (168, 128, 106)), 'house_d': (22, 10, (208, 208, 202)),
    'shed': (4, 4, (200, 200, 195)),
}
ROAD_COLOR = {'crest_road_highway': (44, 44, 48), 'crest_road_arterial': (60, 60, 64),
              'crest_road_street': (74, 74, 78), 'crest_road_alley': (88, 88, 90)}


def write_preview():
    im = Img(PW, PH, (96, 122, 62))
    r2 = random.Random(5)
    for _ in range(3000):
        x, y = r2.randrange(PW), r2.randrange(PH)
        o = im.get(x, y)
        d = r2.uniform(-14, 14)
        im.set(x, y, (o[0] + d, o[1] + d, o[2] + d * 0.5))
    for (kind, x, y, _yaw) in L.trees(random.Random(3)):
        px, py = w2p(x, y)
        im.rect(px - 1.3, py - 1.3, px + 1.3, py + 1.3,
                (52, 86, 44) if kind == 'tree_pine' else (68, 104, 50))
    _props, lots, pads = L.district_content()
    for (x0, y0, x1, y1, _m) in lots:
        p0, p1 = w2p(x0, y1), w2p(x1, y0)
        im.rect(p0[0], p0[1], p1[0], p1[1], (78, 78, 80))
    for (x0, y0, x1, y1, _m) in pads:
        p0, p1 = w2p(x0, y1), w2p(x1, y0)
        im.rect(p0[0], p0[1], p1[0], p1[1], (150, 148, 142))
    fld, _trk = L.sports_field()
    if fld:
        p0, p1 = w2p(fld[0], fld[3]), w2p(fld[2], fld[1])
        im.rect(p0[0], p0[1], p1[0], p1[1], (78, 128, 58))
        thick_line(im, track_oval(), 9.0, (146, 60, 46))
    pond = L.park_pond()
    if pond:
        p0, p1 = w2p(pond[0], pond[3]), w2p(pond[2], pond[1])
        im.rect(p0[0], p0[1], p1[0], p1[1], (56, 106, 134))
    for (_n, pts, w, mat, _z, _t, _d) in L.roads():
        thick_line(im, pts, w + 2.0, ROAD_COLOR.get(mat, (76, 76, 78)))
    for (shape, x, y, yaw, _s) in placements():
        f = FOOTPRINT.get(shape)
        if f:
            rot_rect(x, y, f[0], f[1], yaw, f[2], im)
    for (code, bx, by, i) in L.blocks():
        if code == 'RAD' and i in (2, 3):
            px, py = w2p(bx, by)
            im.rect(px - 4, py - 4, px + 4, py + 4, (214, 70, 54))
    for k in range(4):
        im.rect(0, 0, PW, 4, (26, 28, 32))
        im.rect(0, PH - 4, PW, PH, (26, 28, 32))
        im.rect(0, 0, 4, PH, (26, 28, 32))
        im.rect(PW - 4, 0, PW, PH, (26, 28, 32))
    # BeamNG's level selector looks for preview.png; ship the level-named
    # variants too so whichever the UI asks for is present.
    im.save(os.path.join(ROOT, 'preview.png'))
    for alt in ('%s.png' % LVL, '%s_preview.png' % LVL):
        shutil.copyfile(os.path.join(ROOT, 'preview.png'), os.path.join(ROOT, alt))


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
  3. Start the game. Single Player -> Freeroam -> pick "Crestwood".
     First load takes a while as the game caches every mesh.

WHAT IS IN IT
  * 4.4 km x 4.4 km level with a four lane ring beltway, about a 10 km lap.
  * A 36 block city grid with two-lane streets and four-lane arterials.
  * Crestwood Apartments: fifteen walk-up blocks over four city blocks, with
    leasing office, pool, drive loops and parking bays.
  * Crestwood High School: main building, gym, bus loop, staff parking, and a
    stadium with running track, bleachers and goal posts.
  * KRST 98.7 across four blocks: broadcast building, dish farm, a 152 m guyed
    lattice mast and an 84 m backup mast.
  * Twelve residential streets, about 200 houses with garages and driveways.
  * Downtown towers, strip malls, a gas station, freight yards, water towers.

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
    print('textures ...', len(write_textures()))
    print('materials ...', write_materials())
    made = build_shapes()
    print('shapes ... %d meshes, %d triangles'
          % (len(made), sum(t for (_v, t) in made.values())))
    print('scene ...', write_level_json(), 'objects')
    write_info()
    write_preview()
    print('preview ... ok')
    z = pack()
    print('\npacked: %s (%.2f MB)' % (z, os.path.getsize(z) / 1048576.0))


if __name__ == '__main__':
    main()
