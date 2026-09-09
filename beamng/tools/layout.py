"""Crestwood city layout: the road network, districts and prop placement."""
import math, random

LEVEL = 'crestwood'
GROUND = 1350.0          # ground plane half-size
RING_X, RING_Y = 900.0, 740.0
RING_R = 240.0           # highway corner radius
HW_W = 16.0              # highway width
ART_W = 14.0             # arterial width
ST_W = 9.0               # residential / cross street width

Z_NS = 0.000             # north-south streets
Z_EW = 0.012             # east-west streets sit fractionally on top
Z_HW = 0.024             # highway wins every junction
Z_LOT = 0.006
Z_GRASS = -0.070
Z_WALK = 0.150

XS = [-560.0, -280.0, 0.0, 280.0, 560.0]
YS = [-520.0, -260.0, 0.0, 260.0, 520.0]
BX = [-420.0, -140.0, 140.0, 420.0]
BY = [-390.0, -130.0, 130.0, 390.0]
BLOCK_HX, BLOCK_HY = 133.0, 123.0


def ring_points(step=8.0):
    """Rounded-rectangle highway loop, counter-clockwise, closed."""
    ax, ay, r = RING_X - RING_R, RING_Y - RING_R, RING_R
    pts = []

    def arc(cx, cy, a0, a1):
        n = max(2, int(abs(a1 - a0) * r / step))
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
    """Every drivable ribbon: (name, points, width, material, z, texlen, drivability)."""
    out = [('highway_ring', ring_points(), HW_W, 'crest_road_highway', Z_HW, 12.0, 1.0)]

    # arterials run all the way out to the ring
    out.append(('main_street', [(-RING_X, 0.0), (RING_X, 0.0)], ART_W,
                'crest_road_arterial', Z_EW, 12.0, 0.9))
    out.append(('central_avenue', [(0.0, -RING_Y), (0.0, RING_Y)], ART_W,
                'crest_road_arterial', Z_NS, 12.0, 0.9))

    for i, x in enumerate(XS):
        if x == 0.0:
            continue
        out.append(('street_ns_%d' % i, [(x, YS[0]), (x, YS[-1])], ST_W,
                    'crest_road_street', Z_NS, 12.0, 0.7))
    for i, y in enumerate(YS):
        if y == 0.0:
            continue
        out.append(('street_ew_%d' % i, [(XS[0], y), (XS[-1], y)], ST_W,
                    'crest_road_street', Z_EW, 12.0, 0.7))

    # connectors from the outer grid corners up to the ring highway
    out.append(('connector_ne', [(560.0, 520.0), (700.0, 620.0), (760.0, 700.0)],
                ST_W, 'crest_road_street', Z_NS, 12.0, 0.6))
    out.append(('connector_sw', [(-560.0, -520.0), (-700.0, -620.0), (-760.0, -700.0)],
                ST_W, 'crest_road_street', Z_NS, 12.0, 0.6))

    # neighbourhood alleys inside the housing blocks
    for bx in (BX[0], BX[1], BX[2]):
        for by in (BY[0],):
            out.append(('alley_%d_%d' % (int(bx), int(by)),
                        [(bx - 110, by), (bx + 110, by)], 6.0,
                        'crest_road_alley', Z_EW, 12.0, 0.35))
    for bx in (BX[0], BX[1]):
        out.append(('alley_%d_%d' % (int(bx), int(BY[1])),
                    [(bx - 110, BY[1]), (bx + 110, BY[1])], 6.0,
                    'crest_road_alley', Z_EW, 12.0, 0.35))

    # apartment complex internal drive
    out.append(('apartment_drive', [(20.0, 300.0), (20.0, 500.0), (540.0, 500.0),
                                    (540.0, 300.0), (20.0, 300.0)], 7.0,
                'crest_road_alley', Z_LOT + 0.004, 12.0, 0.4))
    for dx in (170.0, 450.0):
        out.append(('apartment_drive_%d' % int(dx), [(dx, 300.0), (dx, 500.0)], 7.0,
                    'crest_road_alley', Z_LOT + 0.004, 12.0, 0.4))
    # school bus loop
    out.append(('school_bus_loop', [(-500.0, 290.0), (-500.0, 360.0), (-340.0, 360.0),
                                    (-340.0, 290.0)], 8.0,
                'crest_road_alley', Z_LOT + 0.004, 12.0, 0.4))
    # radio station service road
    out.append(('radio_service', [(300.0, -290.0), (300.0, -430.0), (400.0, -430.0)],
                6.0, 'crest_road_alley', Z_LOT + 0.004, 12.0, 0.35))
    return out


# ------------------------------------------------------------------ lots -----
def parking_lots():
    """(x0, y0, x1, y1, material) rectangles laid flat on the ground."""
    L = []
    # apartment complex: parking bays between the buildings
    for x0 in (30.0, 128.0, 230.0, 310.0, 408.0, 505.0):
        L.append((x0, 305.0, x0 + 34.0, 495.0, 'crest_parking'))
    # school
    L += [(-540, 290, -505, 430, 'crest_parking'),
          (-330, 285, -190, 340, 'crest_parking')]
    # radio station
    L += [(300, -300, 420, -270, 'crest_parking'),
          (430, -300, 500, -270, 'crest_parking')]
    # civic / office block
    L += [(-250, 40, -40, 120, 'crest_parking')]
    # retail block north of Main Street
    L += [(40, 60, 250, 160, 'crest_parking')]
    # shopping centre south of Main Street
    L += [(30, -180, 250, -40, 'crest_parking')]
    return L


def concrete_pads():
    """Plain concrete aprons: plazas, freight yards, school hardstanding, courts."""
    return [(-260, 178, -30, 205, 'crest_concrete'),
            (300, 170, 540, 250, 'crest_concrete'),
            (300, -245, 540, -160, 'crest_concrete'),
            (-548, 440, -470, 508, 'crest_concrete'),
            (-262, 292, -196, 348, 'crest_concrete')]


def sidewalk_runs():
    """(x0,y0,x1,y1) kerbed sidewalk slabs. Broken at every intersection."""
    W = 2.6
    runs = []
    gap = 12.0

    def segs(vals, lo, hi):
        cuts = [lo] + [v for v in vals if lo < v < hi] + [hi]
        out = []
        for i in range(len(cuts) - 1):
            a = cuts[i] + (gap if i > 0 else 4.0)
            b = cuts[i + 1] - (gap if i < len(cuts) - 2 else 4.0)
            if b - a > 14.0:
                out.append((a, b))
        return out

    # along Main Street
    for a, b in segs(XS, -600.0, 600.0):
        for s in (-1, 1):
            y = s * (ART_W / 2 + 0.4)
            runs.append((a, min(y, y + s * W), b, max(y, y + s * W)))
    # along Central Avenue
    for a, b in segs(YS, -600.0, 600.0):
        for s in (-1, 1):
            x = s * (ART_W / 2 + 0.4)
            runs.append((min(x, x + s * W), a, max(x, x + s * W), b))
    # downtown block frontages
    for y in (260.0, -260.0):
        for a, b in segs(XS, -600.0, 600.0):
            for s in (-1, 1):
                yy = y + s * (ST_W / 2 + 0.4)
                runs.append((a, min(yy, yy + s * W), b, max(yy, yy + s * W)))
    for x in (280.0, -280.0):
        for a, b in segs(YS, -560.0, 560.0):
            for s in (-1, 1):
                xx = x + s * (ST_W / 2 + 0.4)
                runs.append((min(xx, xx + s * W), a, max(xx, xx + s * W), b))
    return runs


# ------------------------------------------------------------- districts -----
def apartments():
    """(shape, x, y, yaw) for every apartment building in the complex."""
    P = []
    for bx in (140.0, 420.0):
        P.append(('apartment_a', bx - 45, 480.0, 0.0))
        P.append(('apartment_a', bx - 45, 400.0, 0.0))
        P.append(('apartment_b', bx - 45, 320.0, 0.0))
        P.append(('apartment_b', bx + 75, 440.0, 90.0))
        P.append(('apartment_a', bx + 75, 340.0, 90.0))
    return P


def houses(rng):
    """Two rows of homes per residential block, fronts to the street."""
    P = []
    blocks = [(BX[0], BY[0]), (BX[1], BY[0]), (BX[2], BY[0]),
              (BX[0], BY[1]), (BX[1], BY[1])]
    for (bx, by) in blocks:
        for row, (yy, yaw) in enumerate(((by - 92.0, 0.0), (by + 92.0, 180.0))):
            n = 9
            for i in range(n):
                x = bx - 108.0 + i * (216.0 / (n - 1))
                if abs(x) < 26.0:
                    continue
                v = rng.randrange(4)
                P.append(('house_%s' % 'abcd'[v], x + rng.uniform(-2.5, 2.5),
                          yy + rng.uniform(-1.5, 1.5), yaw + rng.uniform(-1.5, 1.5)))
    return P


def _facing_street(y, s):
    """Centre line and half width of the nearest street in front of a house."""
    best = None
    cands = [(0.0, ART_W / 2)] + [(v, ST_W / 2) for v in YS if v != 0.0]
    for (cy, hw) in cands:
        d = (y - cy) * s
        if d <= 0:
            continue
        if best is None or d < best[0]:
            best = (d, cy, hw)
    if best is None:
        return y - s * 34.0, ST_W / 2
    return best[1], best[2]


def driveways(house_list):
    """A concrete strip from each home's garage out to the kerb."""
    D = []
    for (shape, x, y, yaw) in house_list:
        s = 1.0 if abs(yaw) < 90.0 else -1.0
        gx = x + 9.6 * (1.0 if s > 0 else -1.0)
        cy, hw = _facing_street(y, s)
        y0 = y - s * 5.4
        y1 = cy + s * hw
        D.append((min(gx - 3.4, gx + 3.4), min(y0, y1),
                  max(gx - 3.4, gx + 3.4), max(y0, y1)))
    return D


def mailbox_spot(x, y, yaw):
    s = 1.0 if abs(yaw) < 90.0 else -1.0
    cy, hw = _facing_street(y, s)
    return x - 9.0 * s, cy + s * (hw + 2.2)


def trees(rng):
    """Street trees, park planting and the wooded belt outside the ring."""
    T = []
    road_pts = []
    for (_n, pts, w, _m, _z, _t, _d) in roads():
        for i in range(len(pts) - 1):
            road_pts.append((pts[i], pts[i + 1], w / 2 + 7.0))

    def clear(x, y):
        for (a, b, r) in road_pts:
            dx, dy = b[0] - a[0], b[1] - a[1]
            L2 = dx * dx + dy * dy
            t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((x - a[0]) * dx + (y - a[1]) * dy) / L2))
            px, py = a[0] + t * dx, a[1] + t * dy
            if (x - px) ** 2 + (y - py) ** 2 < r * r:
                return False
        return True

    # city park block
    for _ in range(150):
        x = BX[0] + rng.uniform(-120, 120)
        y = BY[2] + rng.uniform(-110, 110)
        if clear(x, y):
            T.append(('tree_oak' if rng.random() < 0.72 else 'tree_pine', x, y,
                      rng.uniform(0, 360)))
    # verges on residential streets
    for (bx, by) in [(BX[0], BY[0]), (BX[1], BY[0]), (BX[2], BY[0]),
                     (BX[0], BY[1]), (BX[1], BY[1])]:
        for yy in (by - 118.0, by + 118.0):
            for i in range(10):
                x = bx - 110 + i * 24.0 + rng.uniform(-3, 3)
                if clear(x, yy):
                    T.append(('tree_oak', x, yy, rng.uniform(0, 360)))
    # wooded belt between the grid and the highway
    for _ in range(1100):
        x = rng.uniform(-RING_X + 40, RING_X - 40)
        y = rng.uniform(-RING_Y + 40, RING_Y - 40)
        if abs(x) < 600 and abs(y) < 560:
            continue
        if clear(x, y):
            T.append(('tree_pine' if rng.random() < 0.55 else 'tree_oak', x, y,
                      rng.uniform(0, 360)))
    # outside the ring
    for _ in range(900):
        x = rng.uniform(-GROUND + 60, GROUND - 60)
        y = rng.uniform(-GROUND + 60, GROUND - 60)
        if abs(x) < RING_X + 40 and abs(y) < RING_Y + 40:
            continue
        if clear(x, y):
            T.append(('tree_pine' if rng.random() < 0.6 else 'tree_oak', x, y,
                      rng.uniform(0, 360)))
    return T


def streetlights():
    P = []
    x = -RING_X + 60
    while x < RING_X - 60:
        if abs(x) > 30:
            P.append(('streetlight', x, ART_W / 2 + 3.4, 180.0))
            P.append(('streetlight', x + 55, -ART_W / 2 - 3.4, 0.0))
        x += 110.0
    y = -RING_Y + 60
    while y < RING_Y - 60:
        if abs(y) > 30:
            P.append(('streetlight', ART_W / 2 + 3.4, y, 270.0))
            P.append(('streetlight', -ART_W / 2 - 3.4, y + 55, 90.0))
        y += 110.0
    for by in (260.0, -260.0):
        for i in range(9):
            xx = -520.0 + i * 130.0
            if abs(xx) > 40:
                P.append(('streetlight', xx, by + ST_W / 2 + 3.0, 180.0))
    for bxx in (280.0, -280.0):
        for i in range(8):
            yy = -460.0 + i * 130.0
            if abs(yy) > 40:
                P.append(('streetlight', bxx + ST_W / 2 + 3.0, yy, 270.0))
    return P


def signals():
    P = []
    for x in (-280.0, 0.0, 280.0):
        for y in (-260.0, 0.0, 260.0):
            for (dx, dy, yaw) in ((-13, -13, 0.0), (13, -13, 270.0),
                                  (13, 13, 180.0), (-13, 13, 90.0)):
                P.append(('traffic_light', x + dx, y + dy, yaw))
    return P


def guardrails():
    """Barrier along the outside of each highway curve."""
    P = []
    pts = ring_points(step=12.0)
    n = len(pts) - 1
    for i in range(0, n, 2):
        x, y = pts[i]
        nx, ny = pts[(i + 2) % n]
        if abs(abs(x) - RING_X) < 1.0 or abs(abs(y) - RING_Y) < 1.0:
            continue          # straights stay open
        ang = math.degrees(math.atan2(ny - y, nx - x))
        L = math.hypot(nx - x, ny - y)
        ox, oy = (x + nx) / 2, (y + ny) / 2
        d = math.hypot(ox, oy) or 1.0
        px, py = ox / d, oy / d
        off = HW_W / 2 + 1.6
        P.append(('guardrail', ox + px * off, oy + py * off, ang, L / 24.0))
    return P
