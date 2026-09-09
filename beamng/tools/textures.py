"""Procedural textures for the Crestwood level."""
import math, random
from png import Img

S = 256  # default texture size


def _r(seed):
    return random.Random(seed)


# ---------------------------------------------------------------- ground -----
def grass():
    rng = _r(11)
    im = Img(S, S, (86, 112, 54))
    im.blotches(70, 26, (104, 130, 62), rng, 0.5)
    im.blotches(50, 20, (72, 95, 44), rng, 0.5)
    im.blotches(25, 12, (118, 124, 66), rng, 0.4)
    for _ in range(9000):
        x, y = rng.randrange(S), rng.randrange(S)
        o = im.get(x, y)
        d = rng.uniform(-22, 22)
        im.set(x, y, (o[0] + d, o[1] + d * 1.15, o[2] + d * 0.6))
    return im


def dirt():
    rng = _r(12)
    im = Img(S, S, (124, 104, 78))
    im.blotches(60, 24, (142, 120, 90), rng, 0.5)
    im.blotches(40, 18, (104, 86, 62), rng, 0.5)
    im.noise(14, rng)
    return im


def asphalt(base=62):
    rng = _r(13)
    im = Img(S, S, (base, base + 2, base + 4))
    im.blotches(45, 30, (base + 14, base + 15, base + 16), rng, 0.35)
    im.blotches(35, 22, (base - 12, base - 11, base - 10), rng, 0.4)
    for _ in range(14000):
        x, y = rng.randrange(S), rng.randrange(S)
        o = im.get(x, y)
        d = rng.uniform(-26, 26)
        im.set(x, y, (o[0] + d, o[1] + d, o[2] + d))
    return im


def concrete():
    rng = _r(14)
    im = Img(S, S, (168, 166, 160))
    im.blotches(40, 28, (182, 180, 174), rng, 0.35)
    im.blotches(30, 20, (150, 148, 144), rng, 0.4)
    im.noise(10, rng)
    # expansion joints every half tile
    im.rect(0, S // 2 - 1, S, S // 2 + 1, (138, 136, 132))
    im.rect(S // 2 - 1, 0, S // 2 + 1, S, (138, 136, 132))
    return im


def sidewalk():
    rng = _r(15)
    im = Img(S, S, (178, 176, 170))
    im.blotches(35, 24, (190, 188, 183), rng, 0.3)
    im.noise(9, rng)
    for k in (0, S // 4, S // 2, 3 * S // 4):
        im.rect(0, k, S, k + 2, (146, 144, 140))
    im.rect(0, 0, 2, S, (146, 144, 140))
    return im


def track():
    rng = _r(16)
    im = Img(S, S, (158, 62, 48))
    im.blotches(40, 26, (172, 74, 58), rng, 0.35)
    im.noise(9, rng)
    im.rect(0, 0, 4, S, (232, 232, 228))
    im.rect(S - 4, 0, S, S, (232, 232, 228))
    return im


# ------------------------------------------------------------------ walls -----
def brick(c=(146, 74, 58), mortar=(196, 190, 180)):
    rng = _r(21)
    im = Img(S, S, mortar)
    rows, cols = 16, 8
    bh, bw = S // rows, S // cols
    for r in range(rows):
        off = (bw // 2) if r % 2 else 0
        for cix in range(cols + 1):
            x0 = cix * bw + off - bw
            shade = rng.uniform(-20, 20)
            im.rect_wrap(x0 + 1, r * bh + 1, x0 + bw - 1, r * bh + bh - 1,
                         (c[0] + shade, c[1] + shade * 0.8, c[2] + shade * 0.7))
    im.noise(7, rng)
    return im


def stucco(c=(206, 194, 168)):
    rng = _r(22)
    im = Img(S, S, c)
    im.blotches(50, 26, (c[0] + 14, c[1] + 13, c[2] + 12), rng, 0.35)
    im.blotches(35, 18, (c[0] - 16, c[1] - 15, c[2] - 14), rng, 0.35)
    im.noise(8, rng)
    return im


def siding(c=(212, 214, 208)):
    rng = _r(23)
    im = Img(S, S, c)
    lap = S // 16
    for i in range(16):
        y = i * lap
        im.rect(0, y, S, y + 1, (c[0] - 40, c[1] - 40, c[2] - 40))
        im.rect(0, y + 1, S, y + 3, (c[0] - 16, c[1] - 16, c[2] - 16))
    im.noise(5, rng)
    return im


def _window(im, x0, y0, x1, y1, glass=(58, 78, 96), frame=(238, 238, 234), rng=None):
    im.rect(x0 - 3, y0 - 3, x1 + 3, y1 + 3, frame)
    im.rect(x0, y0, x1, y1, glass)
    # sky gradient + a highlight streak so glass does not read as flat paint
    h = max(1, y1 - y0)
    for y in range(int(y0), int(y1)):
        t = (y - y0) / h
        c = (glass[0] + (1 - t) * 46, glass[1] + (1 - t) * 50, glass[2] + (1 - t) * 54)
        im.rect(x0, y, x1, y + 1, c)
    mid = (x0 + x1) // 2
    im.rect(mid - 1, y0, mid + 1, y1, frame)
    if rng and rng.random() < 0.45:
        im.rect(x0 + 2, y0 + 2, x0 + (x1 - x0) // 3, y1 - 2,
                (glass[0] + 60, glass[1] + 62, glass[2] + 66))


def apartment_wall():
    """One tile == 4 m wide x 3 m tall: one unit window + balcony rail."""
    rng = _r(24)
    im = stucco((198, 172, 132))
    im.rect(0, 0, S, 8, (172, 148, 112))          # floor band
    _window(im, 30, 40, 118, 150, (54, 74, 92), (240, 238, 232), rng)
    _window(im, 146, 40, 226, 150, (54, 74, 92), (240, 238, 232), rng)
    # balcony railing across the lower third
    im.rect(0, 176, S, 182, (120, 120, 124))
    im.rect(0, 214, S, 220, (120, 120, 124))
    for x in range(6, S, 16):
        im.rect(x, 176, x + 4, 220, (132, 132, 136))
    return im


def school_wall():
    """One tile == 5 m wide x 3.5 m tall: brick base with a wide classroom window."""
    rng = _r(25)
    im = brick((152, 82, 62))
    im.rect(0, 0, S, 10, (206, 200, 188))
    _window(im, 24, 46, 232, 158, (60, 82, 100), (232, 230, 224), rng)
    im.rect(20, 160, 236, 170, (206, 200, 188))
    return im


def house_wall():
    """One tile == 3 m wide x 3 m tall: lap siding with one window."""
    rng = _r(26)
    im = siding((214, 216, 210))
    _window(im, 74, 62, 182, 168, (62, 80, 96), (250, 250, 248), rng)
    im.rect(66, 170, 190, 178, (236, 236, 232))
    return im


def house_wall_plain():
    return siding((214, 216, 210))


def house_wall_b():
    rng = _r(27)
    im = siding((186, 168, 140))
    _window(im, 74, 62, 182, 168, (62, 80, 96), (250, 250, 248), rng)
    im.rect(66, 170, 190, 178, (240, 238, 232))
    return im


def house_wall_c():
    rng = _r(28)
    im = brick((138, 96, 78))
    _window(im, 74, 62, 182, 168, (62, 80, 96), (244, 244, 240), rng)
    return im


def office_wall():
    """Glass curtain wall, tile == 4 m x 3.5 m."""
    rng = _r(29)
    im = Img(S, S, (48, 60, 74))
    for gy in range(2):
        for gx in range(2):
            x0, y0 = gx * 128 + 8, gy * 128 + 8
            _window(im, x0, y0, x0 + 112, y0 + 112, (46, 66, 88), (150, 156, 162), rng)
    im.rect(0, 0, S, 6, (128, 132, 138))
    im.rect(0, 128, S, 134, (128, 132, 138))
    return im


def industrial_wall():
    rng = _r(30)
    im = Img(S, S, (176, 178, 176))
    for x in range(0, S, 16):
        im.rect(x, 0, x + 2, S, (150, 152, 150))
        im.rect(x + 2, 0, x + 4, S, (196, 198, 196))
    im.noise(7, rng)
    return im


def radio_wall():
    rng = _r(31)
    im = Img(S, S, (198, 200, 198))
    im.blotches(40, 24, (210, 212, 210), rng, 0.3)
    im.rect(0, 0, S, 6, (150, 154, 158))
    _window(im, 18, 60, 238, 168, (48, 68, 88), (86, 90, 96), rng)
    im.noise(6, rng)
    return im


# ------------------------------------------------------------------ roofs -----
def shingle():
    rng = _r(41)
    im = Img(S, S, (72, 72, 76))
    rows = 16
    rh = S // rows
    for r in range(rows):
        off = (S // 16) if r % 2 else 0
        shade = rng.uniform(-10, 10)
        im.rect(0, r * rh, S, r * rh + rh - 2,
                (72 + shade, 72 + shade, 76 + shade))
        im.rect(0, r * rh + rh - 2, S, r * rh + rh, (50, 50, 54))
        for t in range(0, S, S // 8):
            im.rect_wrap(t + off, r * rh, t + off + 2, r * rh + rh, (58, 58, 62))
    im.noise(8, rng)
    return im


def shingle_brown():
    rng = _r(42)
    im = shingle()
    for y in range(S):
        for x in range(S):
            o = im.get(x, y)
            im.set(x, y, (o[0] * 1.35, o[1] * 1.05, o[2] * 0.8))
    im.noise(6, rng)
    return im


def flat_roof():
    rng = _r(43)
    im = Img(S, S, (108, 108, 104))
    im.blotches(45, 26, (122, 122, 118), rng, 0.35)
    im.blotches(30, 18, (92, 92, 90), rng, 0.4)
    im.noise(10, rng)
    for k in (0, S // 2):
        im.rect(0, k, S, k + 3, (86, 86, 84))
    return im


def metal():
    rng = _r(44)
    im = Img(S, S, (170, 174, 178))
    im.blotches(35, 22, (188, 192, 196), rng, 0.3)
    im.noise(12, rng)
    return im


def metal_red():
    rng = _r(45)
    im = Img(S, S, (188, 52, 44))
    im.noise(11, rng)
    return im


def glass_dark():
    rng = _r(46)
    im = Img(S, S, (40, 56, 72))
    for y in range(S):
        t = y / S
        im.rect(0, y, S, y + 1, (40 + (1 - t) * 40, 56 + (1 - t) * 44, 72 + (1 - t) * 48))
    im.noise(5, rng)
    return im


# ------------------------------------------------------------------ roads -----
def _road(width_m, length_m, lanes, center='double_yellow', edge=True, size=512):
    """U spans the road width, V spans length_m of road."""
    rng = _r(51)
    im = Img(size, size, (60, 61, 63))
    im.blotches(60, 40, (74, 75, 77), rng, 0.3)
    im.blotches(45, 30, (48, 49, 51), rng, 0.35)
    for _ in range(30000):
        x, y = rng.randrange(size), rng.randrange(size)
        o = im.get(x, y)
        d = rng.uniform(-24, 24)
        im.set(x, y, (o[0] + d, o[1] + d, o[2] + d))

    ppm = size / width_m           # pixels per metre across
    ppm_v = size / length_m        # pixels per metre along
    white = (226, 226, 220)
    yellow = (222, 180, 44)

    def stripe_x(x_m, w_m, color, dashed=False, dash=3.0, gap=9.0):
        x0 = int((x_m + width_m / 2) * ppm)
        x1 = max(x0 + 1, int((x_m + w_m + width_m / 2) * ppm))
        if not dashed:
            im.rect(x0, 0, x1, size, color)
            return
        y = 0.0
        while y < length_m:
            im.rect(x0, int(y * ppm_v), x1, int(min(length_m, y + dash) * ppm_v), color)
            y += dash + gap

    if edge:
        stripe_x(-width_m / 2 + 0.35, 0.15, white)
        stripe_x(width_m / 2 - 0.5, 0.15, white)

    if center == 'double_yellow':
        stripe_x(-0.28, 0.13, yellow)
        stripe_x(0.15, 0.13, yellow)
    elif center == 'dashed_yellow':
        stripe_x(-0.07, 0.14, yellow, dashed=True)
    elif center == 'none':
        pass

    # interior lane dividers
    if lanes >= 4:
        half = width_m / 2
        lane_w = (width_m - 1.6) / lanes
        for i in range(1, lanes):
            if i == lanes // 2:
                continue
            x = -half + 0.8 + i * lane_w
            stripe_x(x, 0.14, white, dashed=True)
    return im


def road_highway():
    # 16 m, four lanes, 12 m dash cycle
    return _road(16.0, 12.0, 4, 'double_yellow')


def road_arterial():
    return _road(14.0, 12.0, 4, 'double_yellow')


def road_street():
    return _road(9.0, 12.0, 2, 'dashed_yellow')


def road_alley():
    return _road(6.0, 12.0, 2, 'none', edge=False)


def parking():
    """One tile == 5.5 m deep x 2.7 m wide stall."""
    rng = _r(52)
    im = asphalt(66)
    im.rect(0, 0, 4, S, (222, 222, 216))
    im.rect(0, 0, S, 4, (222, 222, 216))
    return im


def crosswalk():
    rng = _r(53)
    im = asphalt(64)
    for x in range(0, S, 42):
        im.rect(x, 0, x + 22, S, (226, 226, 220))
    return im


def field():
    """Football field: grass with yard lines every tile."""
    rng = _r(54)
    im = grass()
    for y in range(S):
        for x in range(S):
            o = im.get(x, y)
            im.set(x, y, (o[0] * 0.92, o[1] * 1.05, o[2] * 0.9))
    im.rect(0, 0, 3, S, (236, 236, 230))
    return im


def water():
    rng = _r(55)
    im = Img(S, S, (44, 92, 118))
    im.blotches(40, 26, (58, 112, 140), rng, 0.4)
    im.noise(8, rng)
    return im


def bark():
    rng = _r(56)
    im = Img(S, S, (86, 68, 52))
    for x in range(0, S, 7):
        im.rect(x, 0, x + 3, S, (72, 56, 42))
    im.noise(12, rng)
    return im


def leaves():
    rng = _r(57)
    im = Img(S, S, (58, 92, 44))
    im.blotches(80, 22, (76, 116, 52), rng, 0.55)
    im.blotches(50, 16, (44, 72, 34), rng, 0.5)
    im.noise(14, rng)
    return im


def pine_leaves():
    rng = _r(58)
    im = Img(S, S, (40, 72, 46))
    im.blotches(70, 20, (52, 92, 56), rng, 0.5)
    im.blotches(40, 14, (30, 56, 36), rng, 0.5)
    im.noise(12, rng)
    return im


def sign_radio():
    rng = _r(59)
    im = Img(S, S, (24, 32, 56))
    im.rect(10, 10, S - 10, S - 10, (232, 232, 228))
    im.rect(18, 18, S - 18, S - 18, (24, 32, 56))
    # blocky "K R S T" band
    letters = [(30, 92), (78, 140), (126, 188), (174, 236)]
    for i, (x0, x1) in enumerate(letters):
        im.rect(x0, 96, x1, 160, (226, 74, 48) if i % 2 == 0 else (238, 238, 232))
    return im


ALL = {
    'grass': grass, 'dirt': dirt, 'asphalt': asphalt, 'concrete': concrete, 'sidewalk': sidewalk,
    'track': track, 'brick': brick, 'stucco': stucco, 'apartment_wall': apartment_wall,
    'school_wall': school_wall, 'house_wall': house_wall, 'house_wall_b': house_wall_b,
    'house_wall_c': house_wall_c, 'house_wall_plain': house_wall_plain,
    'office_wall': office_wall, 'industrial_wall': industrial_wall,
    'radio_wall': radio_wall, 'shingle': shingle, 'shingle_brown': shingle_brown,
    'flat_roof': flat_roof, 'metal': metal, 'metal_red': metal_red,
    'glass_dark': glass_dark, 'road_highway': road_highway,
    'road_arterial': road_arterial, 'road_street': road_street,
    'road_alley': road_alley, 'parking': parking, 'crosswalk': crosswalk,
    'field': field, 'water': water, 'bark': bark, 'leaves': leaves,
    'pine_leaves': pine_leaves, 'sign_radio': sign_radio,
}


# ------------------------------------------------------------ extra bits -----
def garage_door():
    rng = _r(61)
    im = Img(S, S, (222, 222, 218))
    for i in range(8):
        y = i * (S // 8)
        im.rect(0, y, S, y + 3, (176, 176, 172))
        im.rect(0, y + 3, S, y + 8, (202, 202, 198))
        for x in range(6, S, 62):
            im.rect(x, y + 10, x + 50, y + (S // 8) - 6, (232, 232, 228))
    im.noise(5, rng)
    return im


def door():
    rng = _r(62)
    im = Img(S, S, (96, 58, 40))
    for x in range(0, S, 9):
        im.rect(x, 0, x + 3, S, (82, 48, 34))
    im.rect(24, 24, 232, 118, (74, 44, 30))
    im.rect(24, 140, 232, 232, (74, 44, 30))
    im.rect(196, 124, 216, 136, (216, 190, 120))
    im.noise(9, rng)
    return im


def beacon():
    im = Img(64, 64, (236, 70, 48))
    return im


def lamp():
    im = Img(64, 64, (252, 244, 206))
    return im


def signal():
    im = Img(64, 128, (44, 46, 48))
    im.rect(8, 6, 56, 38, (226, 62, 44))
    im.rect(8, 48, 56, 80, (198, 170, 40))
    im.rect(8, 90, 56, 122, (60, 198, 96))
    return im


def sign_green():
    rng = _r(63)
    im = Img(S, S, (24, 92, 56))
    im.rect(8, 8, S - 8, S - 8, (24, 92, 56))
    im.rect(10, 10, S - 10, 14, (238, 238, 232))
    im.rect(10, S - 14, S - 10, S - 10, (238, 238, 232))
    im.rect(10, 10, 14, S - 10, (238, 238, 232))
    im.rect(S - 14, 10, S - 10, S - 10, (238, 238, 232))
    for i, (x0, x1) in enumerate(((36, 74), (86, 124), (136, 174), (186, 224))):
        im.rect(x0, 96, x1, 150, (238, 238, 232))
    im.noise(4, rng)
    return im


ALL.update({
    'garage_door': garage_door, 'door': door, 'beacon': beacon, 'lamp': lamp,
    'signal': signal, 'sign_green': sign_green,
})
