"""Crestwood city layout: road network, district grid and prop placement.

The city is a 6x6 block grid inside a ring beltway. Each block is assigned a
district code and a generator fills it, so the map scales by changing the grid
rather than by hand-placing buildings.
"""
import math, random

LEVEL = 'crestwood'
GROUND = 2200.0                  # ground plane half-size -> 4.4 km square
RING_X, RING_Y = 1500.0, 1300.0
RING_R = 400.0
HW_W = 16.0                      # highway width
ART_W = 14.0                     # arterial width
ST_W = 9.0                       # residential / cross street width

Z_NS = 0.000
Z_EW = 0.012
Z_HW = 0.024
Z_LOT = 0.006
Z_GRASS = -0.070
Z_WALK = 0.150

XS = [-900.0, -600.0, -300.0, 0.0, 300.0, 600.0, 900.0]
YS = [-840.0, -560.0, -280.0, 0.0, 280.0, 560.0, 840.0]
BX = [-750.0, -450.0, -150.0, 150.0, 450.0, 750.0]
BY = [-700.0, -420.0, -140.0, 140.0, 420.0, 700.0]
BLOCK_HX, BLOCK_HY = 142.0, 132.0
ARTERIALS_X = (0.0, -600.0, 600.0)
ARTERIALS_Y = (0.0, -560.0, 560.0)

# North at the top. Row r covers BY[5 - r].
CODES = [
    ['SCH', 'ATH', 'APT', 'APT', 'IND', 'IND'],
    ['SCH', 'PRK', 'APT', 'APT', 'RET', 'IND'],
    ['HOU', 'DTN', 'DTN', 'DTN', 'RET', 'PRK'],
    ['HOU', 'DTN', 'DTN', 'RET', 'GAS', 'HOU'],
    ['HOU', 'HOU', 'HOU', 'HOU', 'RAD', 'RAD'],
    ['HOU', 'HOU', 'HOU', 'HOU', 'RAD', 'RAD'],
]


def blocks():
    """[(code, bx, by, nth_of_this_code), ...]"""
    seen, out = {}, []
    for r, row in enumerate(CODES):
        for c, code in enumerate(row):
            i = seen.get(code, 0)
            seen[code] = i + 1
            out.append((code, BX[c], BY[5 - r], i))
    return out


def street_width(v, arterials):
    return ART_W if v in arterials else ST_W


def ring_points(step=9.0):
    ax, ay, r = RING_X - RING_R, RING_Y - RING_R, RING_R
    pts = []

    def arc(cx, cy, a0, a1):
        n = max(3, int(abs(a1 - a0) * r / step))
        for i in range(n + 1):
            a = a0 + (a1 - a0) * i / n
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))

    def line(x0, y0, x1, y1):
        n = max(1, int(math.hypot(x1 - x0, y1 - y0) / step))
        for i in range(1, n + 1):
            pts.append((x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n))

    arc(ax, -ay, -math.pi / 2, 0.0)
    line(RING_X, -ay, RING_X, ay)
    arc(ax, ay, 0.0, math.pi / 2)
    line(ax, RING_Y, -ax, RING_Y)
    arc(-ax, ay, math.pi / 2, math.pi)
    line(-RING_X, ay, -RING_X, -ay)
    arc(-ax, -ay, math.pi, 1.5 * math.pi)
    line(-ax, -RING_Y, ax, -RING_Y)
    pts.append(pts[0])
    return pts


def roads():
    """(name, points, width, material, z, texlen, drivability)"""
    out = [('highway_ring', ring_points(), HW_W, 'crest_road_highway', Z_HW, 12.0, 1.0)]

    # the two spine arterials run right out to the beltway
    out.append(('main_street', [(-RING_X, 0.0), (RING_X, 0.0)], ART_W,
                'crest_road_arterial', Z_EW, 12.0, 0.95))
    out.append(('central_avenue', [(0.0, -RING_Y), (0.0, RING_Y)], ART_W,
                'crest_road_arterial', Z_NS, 12.0, 0.95))

    for i, x in enumerate(XS):
        if x == 0.0:
            continue
        w = street_width(x, ARTERIALS_X)
        mat = 'crest_road_arterial' if w == ART_W else 'crest_road_street'
        end = RING_Y - 60.0 if w == ART_W else YS[-1]
        out.append(('street_ns_%d' % i, [(x, -end), (x, end)], w, mat, Z_NS, 12.0,
                    0.85 if w == ART_W else 0.7))
    for i, y in enumerate(YS):
        if y == 0.0:
            continue
        w = street_width(y, ARTERIALS_Y)
        mat = 'crest_road_arterial' if w == ART_W else 'crest_road_street'
        end = RING_X - 60.0 if w == ART_W else XS[-1]
        out.append(('street_ew_%d' % i, [(-end, y), (end, y)], w, mat, Z_EW, 12.0,
                    0.85 if w == ART_W else 0.7))

    # diagonal ramps linking the grid corners to the beltway
    for (sx, sy, nm) in ((1, 1, 'ne'), (-1, -1, 'sw'), (1, -1, 'se'), (-1, 1, 'nw')):
        out.append(('connector_' + nm,
                    [(sx * 900.0, sy * 840.0), (sx * 1080.0, sy * 990.0),
                     (sx * 1210.0, sy * 1130.0)], ST_W, 'crest_road_street',
                    Z_NS, 12.0, 0.6))

    # back alleys through every housing block
    for (code, bx, by, _i) in blocks():
        if code == 'HOU':
            out.append(('alley_%d_%d' % (int(bx), int(by)),
                        [(bx - 122, by), (bx + 122, by)], 6.0,
                        'crest_road_alley', Z_EW, 12.0, 0.35))

    out.extend(_district_roads())
    return out


def _district_roads():
    R = []
    for (code, bx, by, i) in blocks():
        if code == 'APT':
            R.append(('apt_drive_%d' % i,
                      [(bx - 118, by - 110), (bx - 118, by + 110),
                       (bx + 118, by + 110), (bx + 118, by - 110),
                       (bx - 118, by - 110)], 7.0,
                      'crest_road_alley', Z_LOT + 0.004, 12.0, 0.4))
        elif code == 'SCH' and i == 1:
            R.append(('school_bus_loop',
                      [(bx - 80, by - 120), (bx - 80, by - 40), (bx + 80, by - 40),
                       (bx + 80, by - 120)], 8.0,
                      'crest_road_alley', Z_LOT + 0.004, 12.0, 0.4))
        elif code == 'RAD' and i == 0:
            R.append(('radio_service',
                      [(bx - 110, by + 108), (bx - 110, by - 60), (bx + 40, by - 60)],
                      6.0, 'crest_road_alley', Z_LOT + 0.004, 12.0, 0.35))
        elif code == 'IND':
            R.append(('yard_road_%d' % i,
                      [(bx - 120, by - 100), (bx + 120, by - 100)], 7.0,
                      'crest_road_alley', Z_LOT + 0.004, 12.0, 0.35))
    return R


# ------------------------------------------------------------- districts -----
def _apt(bx, by, i):
    """Walk-up blocks either side of an internal drive loop, with parking bays."""
    P, lots = [], []
    for k, dy in enumerate((88.0, 0.0, -88.0)):
        shape = 'apartment_a' if k != 2 else 'apartment_b'
        P.append((shape, bx - 62, by + dy, 0.0))
    P.append(('apartment_b', bx + 62, by + 46, 90.0))
    P.append(('apartment_a', bx + 62, by - 52, 90.0))
    for x0 in (bx - 108, bx - 22, bx + 86):
        lots.append((x0, by - 100, x0 + 28, by + 100, 'crest_parking'))
    if i == 0:
        P.append(('leasing_office', bx - 100, by - 118, 0.0))
    if i == 3:
        P.append(('pool', bx + 12, by + 92, 0.0))
    for (dx, dy) in ((-118, -104), (-118, 104), (118, -104), (118, 104)):
        P.append(('dumpster', bx + dx * 0.86, by + dy, 0.0))
    for dy in (-118, 118):
        P.append(('streetlight', bx, by + dy, 0.0 if dy > 0 else 180.0))
    return P, lots, []


def _sch(bx, by, i):
    P, lots, pads = [], [], []
    if i == 0:
        P.append(('school_main', bx, by + 12, 0.0))
        P.append(('billboard', bx + 118, by - 118, 200.0))
        lots.append((bx - 120, by - 128, bx + 40, by - 66, 'crest_parking'))
        for x in (bx - 100, bx - 40, bx + 20):
            P.append(('streetlight', x, by - 56, 0.0))
    else:
        P.append(('school_gym', bx - 60, by + 66, 0.0))
        P.append(('warehouse', bx + 74, by + 70, 0.0))
        P.append(('bus_shelter', bx, by - 80, 180.0))
        lots.append((bx - 130, by - 20, bx - 96, by + 120, 'crest_parking'))
        pads.append((bx - 30, by - 124, bx + 130, by - 44, 'crest_concrete'))
        for x in (bx - 60, bx, bx + 60):
            P.append(('streetlight', x, by - 30, 0.0))
    return P, lots, pads


def _ath(bx, by, i):
    P = [('bleachers', bx, by - 66, 180.0), ('bleachers', bx, by + 66, 0.0),
         ('goal_post', bx - 50, by, 90.0), ('goal_post', bx + 50, by, 270.0)]
    for (dx, dy) in ((-96, -76), (96, -76), (-96, 76), (96, 76)):
        P.append(('streetlight', bx + dx, by + dy,
                  math.degrees(math.atan2(-dy, -dx)) + 90))
    pads = [(bx - 132, by + 86, bx - 36, by + 128, 'crest_concrete')]
    return P, [], pads


def _rad(bx, by, i):
    P, lots, pads = [], [], []
    if i == 0:
        P.append(('radio_station', bx - 20, by + 40, 180.0))
        P.append(('billboard', bx - 120, by + 126, 0.0))
        lots.append((bx - 120, by + 84, bx + 40, by + 116, 'crest_parking'))
        for x in (bx - 100, bx - 20, bx + 60):
            P.append(('streetlight', x, by + 74, 180.0))
    elif i == 1:
        P.append(('satellite_farm', bx - 40, by + 40, 0.0))
        P.append(('warehouse', bx + 40, by - 60, 0.0))
        pads.append((bx - 120, by - 10, bx + 10, by + 90, 'crest_concrete'))
    elif i == 2:
        P.append(('radio_tower', bx, by, 0.0))
    else:
        P.append(('radio_tower_small', bx - 30, by + 20, 0.0))
        P.append(('warehouse', bx + 70, by - 80, 0.0))
        P.append(('water_tower', bx + 80, by + 80, 0.0))
    return P, lots, pads


def _dtn(bx, by, i):
    P = []
    kinds = ['office_tower_b', 'office_tower_a', 'office_tower_c']
    for k, (dx, dy) in enumerate(((-92, 66), (-14, 72), (78, 66),
                                  (-92, -60), (10, -66), (92, -60))):
        P.append((kinds[(i + k) % 3], bx + dx, by + dy, 0.0 if dy > 0 else 180.0))
    lots = [(bx - 128, by - 22, bx + 128, by + 22, 'crest_parking')]
    pads = [(bx - 60, by + 96, bx + 60, by + 126, 'crest_concrete')]
    for x in range(int(bx - 60), int(bx + 61), 40):
        P.append(('bench', x, by + 110, 0.0))
    for dx in (-120, 0, 120):
        P.append(('streetlight', bx + dx, by - 126, 0.0))
        P.append(('streetlight', bx + dx, by + 126, 180.0))
    return P, lots, pads


def _ret(bx, by, i):
    P = [('strip_mall', bx, by + 76, 0.0),
         ('office_tower_a', bx + 100, by - 96, 180.0),
         ('billboard', bx - 126, by - 122, 160.0),
         ('bus_shelter', bx - 40, by - 124, 0.0)]
    lots = [(bx - 128, by - 84, bx + 60, by + 40, 'crest_parking')]
    for dx in (-100, -20, 60):
        P.append(('streetlight', bx + dx, by + 48, 180.0))
    return P, lots, []


def _ind(bx, by, i):
    P = [('warehouse', bx - 66, by + 60, 0.0), ('warehouse', bx + 66, by + 60, 0.0),
         ('warehouse', bx - 66, by - 40, 180.0)]
    if i == 0:
        P.append(('water_tower', bx + 92, by - 46, 0.0))
    else:
        P.append(('warehouse', bx + 66, by - 40, 180.0))
    pads = [(bx - 130, by - 130, bx + 130, by - 78, 'crest_concrete')]
    for (dx, dy) in ((-110, -114), (0, -114), (110, -114)):
        P.append(('dumpster', bx + dx, by + dy, 0.0))
    return P, [], pads


def _gas(bx, by, i):
    P = [('gas_station', bx - 40, by + 40, 0.0),
         ('strip_mall', bx + 20, by - 96, 180.0),
         ('billboard', bx + 126, by + 120, 250.0)]
    lots = [(bx - 130, by - 60, bx + 130, by - 20, 'crest_parking')]
    return P, lots, []


def _prk(bx, by, i):
    P = []
    for (dx, dy, yaw) in ((-60, 60, 200), (20, 70, 160), (60, -40, 20),
                          (-50, -60, 340), (90, 30, 120)):
        P.append(('bench', bx + dx, by + dy, yaw))
    for dx in (-120, 0, 120):
        P.append(('streetlight', bx + dx, by - 122, 0.0))
    return P, [], []


def _hou(bx, by, i):
    return [], [], []


DISTRICT = {'APT': _apt, 'SCH': _sch, 'ATH': _ath, 'RAD': _rad, 'DTN': _dtn,
            'RET': _ret, 'IND': _ind, 'GAS': _gas, 'PRK': _prk, 'HOU': _hou}


def district_content():
    """Returns (props, parking lots, concrete pads) for every non-housing block."""
    props, lots, pads = [], [], []
    for (code, bx, by, i) in blocks():
        p, l, d = DISTRICT[code](bx, by, i)
        props += [(s, x, y, yaw, 1.0) for (s, x, y, yaw) in p]
        lots += l
        pads += d
    return props, lots, pads


def sports_field():
    """(field rect, track centreline) for the athletics block."""
    for (code, bx, by, _i) in blocks():
        if code == 'ATH':
            return (bx - 55, by - 28, bx + 55, by + 28), (bx, by, 55.0, 34.0)
    return None, None


def park_pond():
    for (code, bx, by, i) in blocks():
        if code == 'PRK' and i == 0:
            return (bx - 60, by - 34, bx + 44, by + 34)
    return None


# ---------------------------------------------------------------- houses -----
def houses(rng):
    P = []
    for (code, bx, by, _i) in blocks():
        if code != 'HOU':
            continue
        for (yy, yaw) in ((by - 100.0, 0.0), (by + 100.0, 180.0)):
            n = 9
            for k in range(n):
                x = bx - 118.0 + k * (236.0 / (n - 1))
                if abs(x) < 30.0:
                    continue
                v = rng.randrange(4)
                P.append(('house_%s' % 'abcd'[v], x + rng.uniform(-2.5, 2.5),
                          yy + rng.uniform(-1.5, 1.5), yaw + rng.uniform(-1.5, 1.5)))
    return P


def _facing_street(y, s):
    best = None
    for cy in YS:
        hw = street_width(cy, ARTERIALS_Y) / 2
        d = (y - cy) * s
        if d <= 0:
            continue
        if best is None or d < best[0]:
            best = (d, cy, hw)
    if best is None:
        return y - s * 34.0, ST_W / 2
    return best[1], best[2]


def driveways(house_list):
    D = []
    for (shape, x, y, yaw) in house_list:
        s = 1.0 if abs(yaw) < 90.0 else -1.0
        gx = x + 9.6 * (1.0 if s > 0 else -1.0)
        cy, hw = _facing_street(y, s)
        y0, y1 = y - s * 5.4, cy + s * hw
        D.append((min(gx - 3.4, gx + 3.4), min(y0, y1),
                  max(gx - 3.4, gx + 3.4), max(y0, y1)))
    return D


def mailbox_spot(x, y, yaw):
    s = 1.0 if abs(yaw) < 90.0 else -1.0
    cy, hw = _facing_street(y, s)
    return x - 9.0 * s, cy + s * (hw + 2.2)


# ------------------------------------------------------------ streetscape ----
def _road_segments():
    segs = []
    for (_n, pts, w, _m, _z, _t, _d) in roads():
        for i in range(len(pts) - 1):
            segs.append((pts[i], pts[i + 1], w / 2))
    return segs


def _clear_fn(extra=7.0):
    segs = _road_segments()

    def clear(x, y):
        for (a, b, r) in segs:
            dx, dy = b[0] - a[0], b[1] - a[1]
            L2 = dx * dx + dy * dy
            t = 0.0 if L2 == 0 else max(0.0, min(1.0,
                                                 ((x - a[0]) * dx + (y - a[1]) * dy) / L2))
            px, py = a[0] + t * dx, a[1] + t * dy
            rr = r + extra
            if (x - px) ** 2 + (y - py) ** 2 < rr * rr:
                return False
        return True
    return clear


def trees(rng):
    T = []
    clear = _clear_fn()
    for (code, bx, by, _i) in blocks():
        if code == 'PRK':
            for _ in range(190):
                x, y = bx + rng.uniform(-130, 130), by + rng.uniform(-122, 122)
                if clear(x, y):
                    T.append(('tree_oak' if rng.random() < 0.72 else 'tree_pine',
                              x, y, rng.uniform(0, 360)))
        elif code == 'HOU':
            for yy in (by - 126.0, by + 126.0):
                for k in range(11):
                    x = bx - 120 + k * 24.0 + rng.uniform(-3, 3)
                    if clear(x, yy):
                        T.append(('tree_oak', x, yy, rng.uniform(0, 360)))
    for _ in range(1700):
        x = rng.uniform(-RING_X + 40, RING_X - 40)
        y = rng.uniform(-RING_Y + 40, RING_Y - 40)
        if abs(x) < 950 and abs(y) < 890:
            continue
        if clear(x, y):
            T.append(('tree_pine' if rng.random() < 0.55 else 'tree_oak', x, y,
                      rng.uniform(0, 360)))
    for _ in range(1500):
        x = rng.uniform(-GROUND + 60, GROUND - 60)
        y = rng.uniform(-GROUND + 60, GROUND - 60)
        if abs(x) < RING_X + 40 and abs(y) < RING_Y + 40:
            continue
        if clear(x, y):
            T.append(('tree_pine' if rng.random() < 0.6 else 'tree_oak', x, y,
                      rng.uniform(0, 360)))
    return T


def _near_cross(v, vals, r=16.0):
    return any(abs(v - t) < r for t in vals)


def streetlights():
    P = []
    for y in ARTERIALS_Y:
        x = -RING_X + 80
        while x < RING_X - 80:
            if abs(x) < RING_X - 70 and not _near_cross(x, XS):
                P.append(('streetlight', x, y + ART_W / 2 + 3.4, 180.0))
            if abs(x + 60) < RING_X - 70 and not _near_cross(x + 60, XS):
                P.append(('streetlight', x + 60, y - ART_W / 2 - 3.4, 0.0))
            x += 120.0
    for x in ARTERIALS_X:
        y = -RING_Y + 80
        while y < RING_Y - 80:
            if abs(y) < RING_Y - 70 and not _near_cross(y, YS):
                P.append(('streetlight', x + ART_W / 2 + 3.4, y, 270.0))
            if abs(y + 60) < RING_Y - 70 and not _near_cross(y + 60, YS):
                P.append(('streetlight', x - ART_W / 2 - 3.4, y + 60, 90.0))
            y += 120.0
    return P


def signals():
    P = []
    for x in ARTERIALS_X:
        for y in ARTERIALS_Y:
            for (dx, dy, yaw) in ((-13, -13, 0.0), (13, -13, 270.0),
                                  (13, 13, 180.0), (-13, 13, 90.0)):
                P.append(('traffic_light', x + dx, y + dy, yaw))
    return P


def guardrails():
    P = []
    pts = ring_points(step=12.0)
    n = len(pts) - 1
    for i in range(0, n, 2):
        x, y = pts[i]
        nx, ny = pts[(i + 2) % n]
        if abs(abs(x) - RING_X) < 1.0 or abs(abs(y) - RING_Y) < 1.0:
            continue
        ang = math.degrees(math.atan2(ny - y, nx - x))
        Ln = math.hypot(nx - x, ny - y)
        ox, oy = (x + nx) / 2, (y + ny) / 2
        d = math.hypot(ox, oy) or 1.0
        off = HW_W / 2 + 1.6
        P.append(('guardrail', ox + ox / d * off, oy + oy / d * off, ang, Ln / 24.0))
    return P


def sidewalk_runs():
    W, gap, runs = 2.6, 14.0, []

    def segs(vals, lo, hi):
        cuts = [lo] + [v for v in vals if lo < v < hi] + [hi]
        out = []
        for i in range(len(cuts) - 1):
            a = cuts[i] + (gap if i > 0 else 5.0)
            b = cuts[i + 1] - (gap if i < len(cuts) - 2 else 5.0)
            if b - a > 16.0:
                out.append((a, b))
        return out

    for y in ARTERIALS_Y:
        hw = ART_W / 2
        for a, b in segs(XS, -940.0, 940.0):
            for s in (-1, 1):
                yy = y + s * (hw + 0.4)
                runs.append((a, min(yy, yy + s * W), b, max(yy, yy + s * W)))
    for x in ARTERIALS_X:
        hw = ART_W / 2
        for a, b in segs(YS, -880.0, 880.0):
            for s in (-1, 1):
                xx = x + s * (hw + 0.4)
                runs.append((min(xx, xx + s * W), a, max(xx, xx + s * W), b))
    return runs
