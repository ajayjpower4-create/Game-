"""Every prop and building in Crestwood. Origin of each mesh is the centre of
its footprint at ground level, so a TSStatic just drops onto the terrain."""
import math, random
from mesh import Mesh

# texture tiling in metres: (across, up)
T_APT = (4.0, 3.0)
T_SCHOOL = (5.0, 3.5)
T_HOUSE = (3.0, 3.0)
T_OFFICE = (4.0, 3.5)
T_RADIO = (5.0, 3.5)


# ------------------------------------------------------------ apartments -----
def apartment_block(length=54.0, depth=16.0, floors=4, name='apartment_a'):
    m = Mesh(name)
    hx, hy = length / 2.0, depth / 2.0
    fh = 3.0
    h = floors * fh
    # main body
    m.box('crest_apartment_wall', -hx, -hy, 0, hx, hy, h,
          mat_top='crest_flat_roof', tile=T_APT[0], tile_v=T_APT[1], top_tile=4.0)
    # parapet
    m.box('crest_stucco', -hx - 0.25, -hy - 0.25, h, hx + 0.25, hy + 0.25, h + 0.9,
          mat_top='crest_stucco', tile=2.0, tile_v=2.0, top_tile=2.0)
    m.box('crest_flat_roof', -hx, -hy, h + 0.05, hx, hy, h + 0.1, top_tile=4.0)
    # ground floor entrance bay
    m.box('crest_brick', -5.0, -hy - 1.6, 0, 5.0, -hy, 3.6,
          mat_top='crest_flat_roof', tile=2.0, tile_v=2.0, top_tile=2.0)
    m.box('crest_glass', -3.2, -hy - 1.7, 0.2, 3.2, -hy - 1.58, 3.0, tile=2.0, tile_v=2.0)
    # entrance canopy
    m.box('crest_metal', -6.0, -hy - 3.4, 3.6, 6.0, -hy, 3.9, tile=2.0, tile_v=2.0)
    m.strut('crest_metal', (-5.4, -hy - 3.1, 0), (-5.4, -hy - 3.1, 3.6), 0.09)
    m.strut('crest_metal', (5.4, -hy - 3.1, 0), (5.4, -hy - 3.1, 3.6), 0.09)
    # exterior stair towers at both ends
    for sx in (-1, 1):
        x = sx * (hx - 3.0)
        m.box('crest_concrete', x - 2.4, hy - 0.2, 0, x + 2.4, hy + 3.2, h + 0.4,
              mat_top='crest_flat_roof', tile=3.0, tile_v=3.0, top_tile=2.0)
        for f in range(floors):
            z = f * fh + 1.1
            m.box('crest_metal', x - 2.3, hy + 2.9, z, x + 2.3, hy + 3.3, z + 0.12, tile=2.0)
    # balcony slabs, back side
    for f in range(1, floors):
        z = f * fh
        m.box('crest_concrete', -hx + 2.0, hy, z, hx - 2.0, hy + 1.6, z + 0.25,
              tile=2.0, tile_v=2.0, top_tile=2.0)
        m.box('crest_metal', -hx + 2.0, hy + 1.45, z + 0.25, hx - 2.0, hy + 1.6, z + 1.2,
              tile=2.0, tile_v=2.0)
    # rooftop HVAC + stair head
    r = random.Random(len(name) + floors)
    for i in range(4):
        cx = -hx + 6 + i * (length - 12) / 3.0
        m.box('crest_metal', cx - 1.4, -2.0, h + 0.95, cx + 1.4, 1.4, h + 2.3,
              tile=2.0, tile_v=2.0, top_tile=2.0)
    m.box('crest_stucco', hx - 9, -3, h + 0.95, hx - 4, 2, h + 3.4,
          mat_top='crest_flat_roof', tile=2.0, tile_v=2.0, top_tile=2.0)
    return m


def leasing_office():
    m = Mesh('leasingoffice')
    m.box('crest_stucco', -11, -8, 0, 11, 8, 4.2, mat_top='crest_flat_roof',
          tile=2.0, tile_v=2.0, top_tile=3.0)
    m.box('crest_brick', -11.3, -8.3, 0, 11.3, 8.3, 1.1, tile=2.0, tile_v=2.0, top=False)
    m.box('crest_glass', -7, -8.35, 1.2, 7, -8.2, 3.6, tile=2.0, tile_v=2.0)
    m.box('crest_metal', -8.5, -12.0, 4.2, 8.5, -8.0, 4.6, tile=2.0, tile_v=2.0)
    for x in (-7.6, 0.0, 7.6):
        m.strut('crest_metal', (x, -11.5, 0), (x, -11.5, 4.2), 0.12)
    m.box('crest_stucco', -11.6, -8.6, 4.2, 11.6, 8.6, 5.0, mat_top='crest_flat_roof',
          tile=2.0, tile_v=2.0, top_tile=3.0)
    return m


def pool():
    m = Mesh('pool')
    m.box('crest_concrete', -14, -10, 0, 14, 10, 0.35, tile=3.0, top_tile=3.0)
    m.box('crest_water', -10, -6.5, 0.05, 10, 6.5, 0.3, mat_top='crest_water',
          tile=4.0, top_tile=6.0)
    for x in range(-13, 14, 2):
        m.strut('crest_metal', (x, -10.2, 0.35), (x, -10.2, 1.5), 0.05)
        m.strut('crest_metal', (x, 10.2, 0.35), (x, 10.2, 1.5), 0.05)
    m.strut('crest_metal', (-13.5, -10.2, 1.45), (13.5, -10.2, 1.45), 0.06)
    m.strut('crest_metal', (-13.5, 10.2, 1.45), (13.5, 10.2, 1.45), 0.06)
    return m


# ---------------------------------------------------------------- school -----
def school_main():
    """Two storey brick school, H footprint, with an entrance rotunda."""
    m = Mesh('schoolmain')
    h = 8.4
    # front bar
    m.box('crest_school_wall', -46, -11, 0, 46, 0, h, mat_top='crest_flat_roof',
          tile=T_SCHOOL[0], tile_v=T_SCHOOL[1], top_tile=4.0)
    # two rear wings
    for sx in (-1, 1):
        x0 = sx * 46 - sx * 18
        a, b = min(x0, sx * 46), max(x0, sx * 46)
        m.box('crest_school_wall', a, 0, 0, b, 34, h, mat_top='crest_flat_roof',
              tile=T_SCHOOL[0], tile_v=T_SCHOOL[1], top_tile=4.0)
        m.box('crest_brick', a - 0.3, -0.0, h, b + 0.3, 34.3, h + 0.9,
              mat_top='crest_brick', tile=2.0, tile_v=2.0, top_tile=2.0)
    # connector at back of courtyard
    m.box('crest_school_wall', -28, 26, 0, 28, 34, h, mat_top='crest_flat_roof',
          tile=T_SCHOOL[0], tile_v=T_SCHOOL[1], top_tile=4.0)
    # parapet on the front bar
    m.box('crest_brick', -46.3, -11.3, h, 46.3, 0.3, h + 1.0, mat_top='crest_brick',
          tile=2.0, tile_v=2.0, top_tile=2.0)
    # entrance rotunda
    m.cylinder('crest_brick', 0, -13.5, 0, h + 1.6, 8.0, 8.0, seg=16, tile=3.0)
    m.cone('crest_metal', 0, -13.5, h + 1.6, h + 5.2, 8.4, seg=16, tile=3.0)
    m.box('crest_glass', -5.2, -21.6, 0.3, 5.2, -21.4, 5.4, tile=2.0, tile_v=2.0)
    m.box('crest_concrete', -7, -24.5, 0, 7, -21.4, 0.4, tile=3.0, top_tile=3.0)
    # entrance canopy
    m.box('crest_metal', -7.5, -27.5, 5.4, 7.5, -21.0, 5.8, tile=2.0, tile_v=2.0)
    for x in (-6.4, 0.0, 6.4):
        m.strut('crest_metal', (x, -27.0, 0.4), (x, -27.0, 5.4), 0.13)
    # rooftop units
    for i in range(6):
        cx = -38 + i * 15
        m.box('crest_metal', cx - 1.8, -8, h + 1.05, cx + 1.8, -3, h + 2.5,
              tile=2.0, tile_v=2.0, top_tile=2.0)
    # flagpole
    m.cylinder('crest_metal', 14, -26, 0, 14.0, 0.18, 0.12, seg=8, tile=2.0)
    m.disc('crest_metal', 14, -26, 14.0, 0.2)
    return m


def school_gym():
    m = Mesh('schoolgym')
    m.box('crest_industrial', -26, -19, 0, 26, 19, 11.5, mat_top='crest_metal',
          tile=3.0, tile_v=3.0, top_tile=3.0)
    m.box('crest_brick', -26.3, -19.3, 0, 26.3, 19.3, 3.2, tile=2.0, tile_v=2.0, top=False)
    m.box('crest_metal', -26.6, -19.6, 11.5, 26.6, 19.6, 12.3, mat_top='crest_metal',
          tile=3.0, tile_v=3.0, top_tile=3.0)
    # clerestory windows
    m.box('crest_glass', -22, -19.4, 8.4, 22, -19.25, 10.6, tile=3.0, tile_v=3.0)
    m.box('crest_glass', -22, 19.25, 8.4, 22, 19.4, 10.6, tile=3.0, tile_v=3.0)
    # double doors
    m.box('crest_metal', -4, -19.7, 0, 4, -19.3, 3.0, tile=2.0, tile_v=2.0)
    return m


def bleachers():
    m = Mesh('bleachers')
    rows = 9
    for i in range(rows):
        z = 0.55 + i * 0.55
        y = -6.0 + i * 1.0
        m.box('crest_concrete', -18, y, z - 0.55, 18, y + 1.0, z,
              tile=3.0, tile_v=2.0, top_tile=3.0)
        m.box('crest_metal', -18, y + 0.05, z, 18, y + 0.85, z + 0.08, tile=3.0)
    m.strut('crest_metal', (-18, 3.2, 0), (-18, 3.2, 6.4), 0.1)
    m.strut('crest_metal', (18, 3.2, 0), (18, 3.2, 6.4), 0.1)
    m.strut('crest_metal', (-18, 3.2, 6.3), (18, 3.2, 6.3), 0.08)
    return m


def goal_post():
    m = Mesh('goalpost')
    m.cylinder('crest_metal_red', 0, 0, 0, 3.2, 0.14, seg=8, tile=2.0)
    m.strut('crest_metal_red', (0, 0, 3.2), (0, 0, 5.0), 0.12)
    m.strut('crest_metal_red', (-2.9, 0, 5.0), (2.9, 0, 5.0), 0.1)
    m.strut('crest_metal_red', (-2.9, 0, 5.0), (-2.9, 0, 9.0), 0.1)
    m.strut('crest_metal_red', (2.9, 0, 5.0), (2.9, 0, 9.0), 0.1)
    return m


# ---------------------------------------------------------- radio station -----
def radio_station():
    m = Mesh('radiostation')
    m.box('crest_radio_wall', -19, -13, 0, 19, 13, 7.4, mat_top='crest_flat_roof',
          tile=T_RADIO[0], tile_v=T_RADIO[1], top_tile=4.0)
    m.box('crest_concrete', -19.4, -13.4, 0, 19.4, 13.4, 1.2, tile=3.0, tile_v=3.0, top=False)
    m.box('crest_concrete', -19.5, -13.5, 7.4, 19.5, 13.5, 8.3, mat_top='crest_flat_roof',
          tile=3.0, tile_v=3.0, top_tile=3.0)
    # glass lobby
    m.box('crest_glass', -8, -13.6, 1.2, 8, -13.35, 6.4, tile=3.0, tile_v=3.0)
    m.box('crest_metal', -9.5, -18.0, 6.4, 9.5, -13.0, 6.9, tile=2.0, tile_v=2.0)
    for x in (-8.2, 0.0, 8.2):
        m.strut('crest_metal', (x, -17.4, 0), (x, -17.4, 6.4), 0.13)
    # station callsign sign above the entrance
    m.box('crest_sign', -7, -13.75, 8.4, 7, -13.55, 12.0, tile=14.0, tile_v=3.6)
    m.strut('crest_metal', (-6.5, -13.6, 8.3), (-6.5, -13.6, 12.0), 0.1)
    m.strut('crest_metal', (6.5, -13.6, 8.3), (6.5, -13.6, 12.0), 0.1)
    # rooftop dishes and studio penthouse
    m.box('crest_concrete', 6, 2, 8.35, 16, 11, 11.4, mat_top='crest_flat_roof',
          tile=3.0, tile_v=3.0, top_tile=3.0)
    for i, (dx, dy, rr) in enumerate(((-13, 7, 2.0), (-7, 8, 1.4), (-1, 7.5, 1.7))):
        m.cylinder('crest_metal', dx, dy, 8.35, 8.35 + 1.1, 0.22, seg=8, tile=2.0)
        m.strut('crest_metal', (dx, dy, 9.45), (dx - rr * 0.5, dy - rr * 0.9, 9.45 + rr), 0.12)
        m.cylinder('crest_metal', dx - rr * 0.5, dy - rr * 0.9, 9.45 + rr, 9.45 + rr + 0.25,
                   rr, rr * 0.86, seg=14, tile=2.0)
    # backup generator + fuel tank
    m.box('crest_metal', -17, 6, 0, -11, 12, 2.6, tile=2.0, tile_v=2.0, top_tile=2.0)
    m.cylinder('crest_metal', -6.5, 11, 0, 2.4, 1.5, seg=12, tile=2.0)
    return m


def radio_tower(height=118.0):
    """Guyed lattice mast, red/white aviation banding, beacon on top."""
    m = Mesh('radiotower')
    levels = 20
    base_w, top_w = 4.6, 1.1
    zs = [height * i / levels for i in range(levels + 1)]
    ws = [base_w + (top_w - base_w) * (i / levels) for i in range(levels + 1)]

    def corners(i):
        w = ws[i]
        return [(-w, -w, zs[i]), (w, -w, zs[i]), (w, w, zs[i]), (-w, w, zs[i])]

    def band(i):
        # seven aviation bands, alternating orange-red and white
        t = zs[i] / height
        return 'crest_metal_red' if int(t * 7) % 2 == 0 else 'crest_metal'

    for i in range(levels):
        c0, c1 = corners(i), corners(i + 1)
        mat = band(i)
        for k in range(4):
            m.strut(mat, c0[k], c1[k], 0.17, tile=2.0)          # legs
            j = (k + 1) % 4
            m.strut(mat, c1[k], c1[j], 0.11, tile=2.0)          # horizontal frame
            m.strut(mat, c0[k], c1[j], 0.085, tile=2.0)         # diagonal brace
            m.strut(mat, c0[j], c1[k], 0.085, tile=2.0)
    # base pads
    for (sx, sy) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        m.box('crest_concrete', sx * base_w - 1.2, sy * base_w - 1.2, 0,
              sx * base_w + 1.2, sy * base_w + 1.2, 1.0, tile=2.0, tile_v=2.0, top_tile=2.0)
    # top mast + beacons
    m.cylinder('crest_metal', 0, 0, height, height + 9.0, 0.28, 0.14, seg=8, tile=2.0)
    for z in (height * 0.34, height * 0.66, height + 9.0):
        m.cylinder('crest_beacon', 0, 0, z, z + 0.7, 0.42, seg=8, tile=1.0)
    # guy wires down to three anchors
    for a in range(3):
        ang = math.radians(90 + a * 120)
        ax, ay = 62 * math.cos(ang), 62 * math.sin(ang)
        m.box('crest_concrete', ax - 1.3, ay - 1.3, 0, ax + 1.3, ay + 1.3, 0.9,
              tile=2.0, tile_v=2.0, top_tile=2.0)
        for zt in (height * 0.42, height * 0.72, height * 0.98):
            m.strut('crest_metal', (ax, ay, 0.9), (0, 0, zt), 0.055, tile=6.0)
    return m


def satellite_farm():
    m = Mesh('satfarm')
    for i in range(3):
        x = -8 + i * 8
        m.box('crest_concrete', x - 1.6, -1.6, 0, x + 1.6, 1.6, 0.4,
              tile=2.0, tile_v=2.0, top_tile=2.0)
        m.cylinder('crest_metal', x, 0, 0.4, 2.2, 0.24, seg=8, tile=2.0)
        m.strut('crest_metal', (x, 0, 2.2), (x, -1.6, 4.4), 0.16)
        m.cylinder('crest_metal', x, -1.6, 4.4, 4.7, 2.4, 2.1, seg=16, tile=3.0)
    return m


# ---------------------------------------------------------------- houses -----
def house(variant=0, seed=0):
    """Suburban single family home. Variants differ in footprint and cladding."""
    r = random.Random(seed * 7919 + variant)
    wall = ['crest_house_wall', 'crest_house_wall_b', 'crest_house_wall_c'][variant % 3]
    roof = 'crest_shingle' if variant % 2 == 0 else 'crest_shingle_brown'
    m = Mesh('house%s' % 'abcd'[variant % 4])

    two_storey = variant % 4 in (1, 2)
    w, d = (13.0, 10.5) if variant % 4 != 3 else (15.0, 9.0)
    h = 6.1 if two_storey else 3.3
    hx, hy = w / 2, d / 2

    m.box(wall, -hx, -hy, 0.35, hx, hy, h, top=False, tile=T_HOUSE[0], tile_v=T_HOUSE[1])
    m.box('crest_concrete', -hx - 0.2, -hy - 0.2, 0, hx + 0.2, hy + 0.2, 0.35,
          tile=2.0, tile_v=2.0, top=False)
    ridge = h + (2.9 if two_storey else 2.5)
    m.gable_roof(roof, -hx, -hy, hx, hy, h, ridge, 'x' if variant % 2 == 0 else 'y',
                 overhang=0.55, tile=2.0, soffit_mat=wall)

    # attached garage
    gw, gd = 6.4, 6.6
    gx = hx + gw / 2 - 0.1
    m.box(wall, hx - 0.2, -hy, 0.35, gx + gw / 2, -hy + gd, 3.2, top=False,
          tile=T_HOUSE[0], tile_v=T_HOUSE[1])
    m.gable_roof(roof, hx - 0.2, -hy, gx + gw / 2, -hy + gd, 3.2, 4.5, 'y',
                 overhang=0.45, tile=2.0, soffit_mat=wall)
    m.box('crest_garage', gx - gw / 2 + 0.4, -hy - 0.16, 0.35, gx + gw / 2 - 0.4,
          -hy - 0.02, 2.8, tile=3.0, tile_v=2.6)

    # front porch
    m.box('crest_concrete', -3.4, -hy - 2.4, 0, 1.6, -hy, 0.4,
          tile=2.0, tile_v=2.0, top_tile=2.0)
    m.box('crest_door', -1.6, -hy - 0.14, 0.4, -0.2, -hy - 0.02, 2.5, tile=1.6, tile_v=2.2)
    m.box(roof, -3.8, -hy - 2.8, 3.0, 2.0, -hy, 3.3, tile=2.0, tile_v=2.0, top_tile=2.0)
    m.strut(wall, (-3.4, -hy - 2.4, 0.4), (-3.4, -hy - 2.4, 3.0), 0.11)
    m.strut(wall, (1.6, -hy - 2.4, 0.4), (1.6, -hy - 2.4, 3.0), 0.11)

    # chimney
    if r.random() < 0.55:
        cx = -hx + 1.6
        m.box('crest_brick', cx - 0.75, 0.6, h - 1.0, cx + 0.75, 2.1, ridge + 1.3,
              mat_top='crest_brick', tile=1.5, tile_v=1.5, top_tile=1.5)
    return m


def shed():
    m = Mesh('shed')
    m.box('crest_house_wall_plain', -2.2, -1.8, 0, 2.2, 1.8, 2.3, top=False,
          tile=2.0, tile_v=2.0)
    m.gable_roof('crest_shingle', -2.2, -1.8, 2.2, 1.8, 2.3, 3.2, 'x', 0.3, 2.0)
    return m


def mailbox():
    m = Mesh('mailbox')
    m.cylinder('crest_metal', 0, 0, 0, 1.1, 0.06, seg=6, tile=1.0)
    m.box('crest_metal', -0.14, -0.28, 1.1, 0.14, 0.28, 1.35, tile=1.0, tile_v=1.0,
          top_tile=1.0)
    return m


# ------------------------------------------------------- downtown / misc -----
def office_tower(floors=8, w=26.0, d=20.0, name='officetower'):
    m = Mesh(name)
    h = floors * 3.5
    hx, hy = w / 2, d / 2
    m.box('crest_office_wall', -hx, -hy, 0, hx, hy, h, mat_top='crest_flat_roof',
          tile=T_OFFICE[0], tile_v=T_OFFICE[1], top_tile=4.0)
    m.box('crest_concrete', -hx - 0.4, -hy - 0.4, 0, hx + 0.4, hy + 0.4, 4.2,
          tile=3.0, tile_v=3.0, top=False)
    m.box('crest_glass', -hx + 2, -hy - 0.5, 0.4, hx - 2, -hy - 0.36, 3.6,
          tile=3.0, tile_v=3.0)
    m.box('crest_concrete', -hx - 0.5, -hy - 0.5, h, hx + 0.5, hy + 0.5, h + 1.1,
          mat_top='crest_flat_roof', tile=3.0, tile_v=3.0, top_tile=3.0)
    m.box('crest_concrete', -6, -5, h + 1.15, 4, 5, h + 4.2, mat_top='crest_flat_roof',
          tile=3.0, tile_v=3.0, top_tile=3.0)
    for i in range(3):
        m.box('crest_metal', 7 + i * 4, -4, h + 1.15, 10 + i * 4, 2, h + 2.4,
              tile=2.0, tile_v=2.0, top_tile=2.0)
    return m


def strip_mall():
    m = Mesh('stripmall')
    m.box('crest_stucco', -44, -14, 0, 44, 14, 5.6, mat_top='crest_flat_roof',
          tile=3.0, tile_v=3.0, top_tile=4.0)
    m.box('crest_stucco', -44.5, -14.5, 5.6, 44.5, 14.5, 7.0, mat_top='crest_flat_roof',
          tile=3.0, tile_v=3.0, top_tile=3.0)
    for i in range(6):
        x = -40 + i * 14.5
        m.box('crest_glass', x, -14.6, 0.3, x + 11, -14.42, 4.2, tile=3.0, tile_v=3.0)
        m.box('crest_metal_red' if i % 2 == 0 else 'crest_metal',
              x - 0.4, -14.8, 4.3, x + 11.4, -14.5, 5.4, tile=3.0, tile_v=1.2)
    m.box('crest_metal', -44, -19.5, 5.6, 44, -14.0, 6.0, tile=3.0, tile_v=3.0)
    for i in range(8):
        x = -41 + i * 11.7
        m.strut('crest_metal', (x, -19.0, 0), (x, -19.0, 5.6), 0.13)
    return m


def warehouse(w=54.0, d=32.0):
    m = Mesh('warehouse')
    hx, hy = w / 2, d / 2
    m.box('crest_industrial', -hx, -hy, 0, hx, hy, 10.0, mat_top='crest_metal',
          tile=3.0, tile_v=3.0, top_tile=4.0)
    m.box('crest_concrete', -hx - 0.3, -hy - 0.3, 0, hx + 0.3, hy + 0.3, 1.4,
          tile=3.0, tile_v=3.0, top=False)
    m.box('crest_metal', -hx - 0.5, -hy - 0.5, 10.0, hx + 0.5, hy + 0.5, 10.7,
          mat_top='crest_metal', tile=3.0, tile_v=3.0, top_tile=4.0)
    for i in range(4):
        x = -hx + 8 + i * 12
        m.box('crest_garage', x, -hy - 0.42, 1.4, x + 5.0, -hy - 0.28, 5.6,
              tile=5.0, tile_v=4.2)
        m.box('crest_concrete', x - 0.8, -hy - 3.4, 0, x + 5.8, -hy, 1.4,
              tile=2.0, tile_v=2.0, top_tile=2.0)
    return m


def gas_station():
    m = Mesh('gasstation')
    m.box('crest_stucco', -13, -9, 0, 13, 9, 4.4, mat_top='crest_flat_roof',
          tile=3.0, tile_v=3.0, top_tile=3.0)
    m.box('crest_glass', -11, -9.15, 0.4, 11, -9.0, 3.4, tile=3.0, tile_v=3.0)
    m.box('crest_metal_red', -13.4, -9.4, 4.4, 13.4, 9.4, 5.6, mat_top='crest_flat_roof',
          tile=3.0, tile_v=1.2, top_tile=3.0)
    # forecourt canopy
    m.box('crest_metal', -18, -34, 5.4, 18, -14, 6.4, mat_top='crest_metal',
          tile=4.0, tile_v=1.0, top_tile=4.0)
    m.box('crest_metal_red', -18.2, -34.2, 6.4, 18.2, -13.8, 6.9, tile=4.0, tile_v=0.6)
    for (px, py) in ((-13, -30), (13, -30), (-13, -18), (13, -18)):
        m.strut('crest_metal', (px, py, 0), (px, py, 5.4), 0.28)
        m.box('crest_concrete', px - 3.2, py - 1.1, 0, px + 3.2, py + 1.1, 0.25,
              tile=2.0, tile_v=2.0, top_tile=2.0)
        for s in (-1.6, 1.6):
            m.box('crest_metal', px + s - 0.55, py - 0.45, 0.25, px + s + 0.55,
                  py + 0.45, 1.5, tile=1.0, tile_v=1.0, top_tile=1.0)
    # price sign
    m.strut('crest_metal', (20, -28, 0), (20, -28, 8.0), 0.22)
    m.box('crest_sign', 17.5, -28.2, 5.6, 22.5, -27.9, 8.6, tile=5.0, tile_v=3.0)
    return m


def water_tower():
    m = Mesh('watertower')
    for (sx, sy) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        m.strut('crest_metal', (sx * 5.2, sy * 5.2, 0), (sx * 1.9, sy * 1.9, 22.0), 0.2)
    for z in (6.0, 12.0, 18.0):
        t = z / 22.0
        w = 5.2 + (1.9 - 5.2) * t
        c = [(-w, -w, z), (w, -w, z), (w, w, z), (-w, w, z)]
        for k in range(4):
            m.strut('crest_metal', c[k], c[(k + 1) % 4], 0.11)
    m.cylinder('crest_metal', 0, 0, 22.0, 31.0, 6.4, 5.6, seg=16, tile=3.0, cap_top=True)
    m.cone('crest_metal', 0, 0, 31.0, 34.0, 6.0, seg=16, tile=3.0)
    m.cone('crest_metal', 0, 0, 22.4, 19.5, 6.3, seg=16, tile=3.0)
    m.cylinder('crest_beacon', 0, 0, 34.0, 34.8, 0.35, seg=6, tile=1.0)
    return m


def billboard():
    m = Mesh('billboard')
    m.strut('crest_metal', (-3.5, 0, 0), (-3.5, 0, 8.0), 0.24)
    m.strut('crest_metal', (3.5, 0, 0), (3.5, 0, 8.0), 0.24)
    m.box('crest_sign', -7.0, -0.22, 5.4, 7.0, 0.0, 9.4, tile=14.0, tile_v=4.0)
    m.box('crest_metal', -7.1, 0.0, 5.3, 7.1, 0.18, 9.5, tile=4.0, tile_v=4.0)
    return m


def bus_shelter():
    m = Mesh('busshelter')
    m.box('crest_concrete', -2.6, -1.3, 0, 2.6, 1.3, 0.12, tile=2.0, top_tile=2.0)
    m.box('crest_glass', -2.5, 1.15, 0.12, 2.5, 1.28, 2.3, tile=2.0, tile_v=2.0)
    m.box('crest_metal', -2.8, -1.5, 2.3, 2.8, 1.5, 2.5, mat_top='crest_metal',
          tile=2.0, tile_v=2.0, top_tile=2.0)
    for (px, py) in ((-2.5, -1.2), (2.5, -1.2), (-2.5, 1.2), (2.5, 1.2)):
        m.strut('crest_metal', (px, py, 0.12), (px, py, 2.3), 0.07)
    m.box('crest_metal', -2.2, 0.6, 0.5, 2.2, 1.1, 0.6, tile=2.0, top_tile=2.0)
    return m


def dumpster():
    m = Mesh('dumpster')
    m.box('crest_metal_red', -1.6, -1.0, 0.25, 1.6, 1.0, 1.5, mat_top='crest_metal_red',
          tile=1.5, tile_v=1.2, top_tile=1.5)
    m.box('crest_metal', -1.65, -1.05, 1.5, 1.65, 1.05, 1.62, tile=1.5, top_tile=1.5)
    return m


# ------------------------------------------------------------- streetscape ---
def streetlight(arm=3.2, h=9.0):
    m = Mesh('streetlight')
    m.cylinder('crest_metal', 0, 0, 0, 0.5, 0.28, 0.22, seg=8, tile=1.0)
    m.cylinder('crest_metal', 0, 0, 0.5, h, 0.17, 0.12, seg=8, tile=2.0)
    m.strut('crest_metal', (0, 0, h - 0.1), (0, -arm, h + 0.7), 0.11)
    m.box('crest_lamp', -0.35, -arm - 0.75, h + 0.4, 0.35, -arm + 0.35, h + 0.72,
          mat_top='crest_metal', tile=1.0, tile_v=1.0, top_tile=1.0)
    return m


def traffic_light():
    m = Mesh('trafficlight')
    m.cylinder('crest_metal', 0, 0, 0, 6.5, 0.19, 0.15, seg=8, tile=2.0)
    m.strut('crest_metal', (0, 0, 6.3), (0, -7.0, 6.6), 0.12)
    for i, y in enumerate((-2.4, -4.6, -6.6)):
        m.box('crest_signal', -0.24, y - 0.28, 5.35, 0.24, y + 0.28, 6.45,
              mat_top='crest_metal', tile=0.6, tile_v=1.2, top_tile=0.6)
    return m


def tree_oak(seed=0):
    r = random.Random(seed)
    m = Mesh('treeoak')
    h = r.uniform(3.0, 4.6)
    m.cylinder('crest_bark', 0, 0, 0, h, r.uniform(0.32, 0.46), 0.3, seg=7, tile=1.5)
    cr = r.uniform(3.0, 4.4)
    m.cylinder('crest_leaves', 0, 0, h - 0.4, h + cr * 1.15, cr, cr * 0.35,
               seg=9, tile=3.0, cap_top=False, rot=r.uniform(0, 1))
    m.cone('crest_leaves', 0, 0, h + cr * 1.05, h + cr * 1.9, cr * 0.55, seg=9, tile=3.0)
    m.cylinder('crest_leaves', 0, 0, h - 1.1, h + 0.6, cr * 0.75, cr * 0.95,
               seg=9, tile=3.0, cap_top=False, rot=r.uniform(0, 1))
    return m


def tree_pine(seed=0):
    r = random.Random(seed + 500)
    m = Mesh('treepine')
    h = r.uniform(1.6, 2.4)
    m.cylinder('crest_bark', 0, 0, 0, h + 1.0, 0.34, 0.24, seg=6, tile=1.5)
    top = r.uniform(11.0, 15.0)
    layers = 4
    for i in range(layers):
        z0 = h + i * (top - h) / (layers + 0.6)
        rr = r.uniform(2.6, 3.4) * (1.0 - i * 0.19)
        m.cone('crest_pine', 0, 0, z0, z0 + (top - h) / layers * 1.45, rr, seg=8, tile=3.0)
    return m


def bench():
    m = Mesh('bench')
    m.box('crest_bark', -0.9, -0.22, 0.45, 0.9, 0.22, 0.52, tile=1.0, top_tile=1.0)
    m.box('crest_bark', -0.9, 0.2, 0.52, 0.9, 0.28, 1.05, tile=1.0, top_tile=1.0)
    for x in (-0.75, 0.75):
        m.box('crest_metal', x - 0.05, -0.25, 0, x + 0.05, 0.25, 0.45,
              tile=0.6, top_tile=0.6)
    return m


def guardrail(length=24.0):
    m = Mesh('guardrail')
    n = int(length / 4.0)
    for i in range(n + 1):
        x = -length / 2 + i * 4.0
        m.strut('crest_metal', (x, 0, 0), (x, 0, 0.78), 0.09)
    m.box('crest_metal', -length / 2, -0.09, 0.5, length / 2, 0.09, 0.82,
          mat_top='crest_metal', tile=3.0, tile_v=0.5, top_tile=3.0)
    return m


def overpass_sign():
    m = Mesh('overpasssign')
    for x in (-9.0, 9.0):
        m.cylinder('crest_metal', x, 0, 0, 8.4, 0.26, 0.2, seg=8, tile=2.0)
    m.strut('crest_metal', (-9.0, 0, 8.2), (9.0, 0, 8.2), 0.16)
    m.box('crest_sign_green', -7.5, -0.16, 5.4, 7.5, 0.0, 8.2, tile=15.0, tile_v=2.8)
    return m
