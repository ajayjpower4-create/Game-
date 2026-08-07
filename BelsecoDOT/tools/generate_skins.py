#!/usr/bin/env python3
"""
Belseco DOT Mega Pack - livery texture generator.

Generates the base-colour (albedo) textures used by the pack's BeamNG skins.

Because the pack ships without the game's proprietary UV templates, every livery
is described here as a set of *parametric* bands / text rows in normalised UV
space (0..1).  That means you can slide a stripe onto the right body panel by
editing a number in the LIVERIES table below and re-running this script instead
of repainting a texture by hand.

Usage:
    python3 tools/generate_skins.py                # write all liveries
    python3 tools/generate_skins.py --size 4096    # higher resolution
    python3 tools/generate_skins.py --guide        # also write the UV guide grid

Output goes to mod/vehicles/<vehicle>/<name>.png
"""

import argparse
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

# ---------------------------------------------------------------------------
# Palette - Belseco Department of Transportation fleet standard
# ---------------------------------------------------------------------------
WHITE = (245, 245, 245, 255)
FLEET_WHITE = (252, 252, 250, 255)
DOT_ORANGE = (232, 105, 24, 255)
CHARCOAL = (72, 76, 82, 255)
SAFETY_YELLOW = (206, 220, 0, 255)
DOT_BLUE = (0, 82, 155, 255)
DOT_ORANGE_DEEP = (222, 88, 12, 255)
BLACK = (24, 24, 26, 255)
SILVER = (176, 180, 186, 255)
CHEVRON_RED = (176, 22, 30, 255)


def font(path, px):
    try:
        return ImageFont.truetype(path, px)
    except OSError:
        return ImageFont.load_default()


# ---------------------------------------------------------------------------
# Livery definitions
#
#   base      : fill colour for the whole sheet
#   stripes   : (y, height, colour) in UV fractions - drawn full width
#   texts     : (y, text, colour, size_fraction, spacing_fraction, style)
#   plate     : (y, height) band rendered as diamond-plate aluminium
#   chevrons  : (y, height, colourA, colourB) diagonal traffic chevrons
# ---------------------------------------------------------------------------
LIVERIES = {
    # Image 1 + 2: white fleet body with the charcoal/orange belt stripe
    "belseco_white": {
        "vehicles": ["us_semi", "pickup"],
        "base": FLEET_WHITE,
        "plate": [(0.615, 0.055)],
        "stripes": [
            (0.352, 0.016, CHARCOAL),
            (0.370, 0.026, DOT_ORANGE),
            (0.399, 0.008, CHARCOAL),
            (0.742, 0.014, CHARCOAL),
            (0.758, 0.022, DOT_ORANGE),
        ],
        "texts": [
            (0.300, "BELSECO DOT", DOT_ORANGE, 0.042, 0.34, "bold"),
            (0.412, "DEPARTMENT OF TRANSPORTATION", CHARCOAL, 0.016, 0.30, "reg"),
            (0.690, "BELSECO DOT", DOT_ORANGE, 0.034, 0.40, "bold"),
        ],
    },
    # Image 2: motor-pool plain white, door seal only
    "belseco_fleet_plain": {
        "vehicles": ["pickup"],
        "base": WHITE,
        "stripes": [],
        "texts": [
            (0.335, "BELSECO DOT  •  FLEET SERVICES", CHARCOAL, 0.018, 0.36, "reg"),
        ],
    },
    # Image 3: FIRST - Freeway Incident Response Safety Team
    "belseco_first": {
        "vehicles": ["pickup", "us_semi"],
        "base": SAFETY_YELLOW,
        "stripes": [
            (0.300, 0.014, DOT_BLUE),
            (0.318, 0.098, DOT_BLUE),
            (0.700, 0.070, DOT_BLUE),
        ],
        "texts": [
            (0.348, "F I R S T", WHITE, 0.050, 0.30, "bold"),
            (0.396, "BELSECO DEPARTMENT OF TRANSPORTATION", WHITE, 0.018, 0.32, "bold"),
            (0.432, "FREEWAY INCIDENT RESPONSE SAFETY TEAM", DOT_BLUE, 0.017, 0.32, "reg"),
            (0.715, "FIRST", WHITE, 0.040, 0.36, "bold"),
        ],
    },
    # Winter operations / heavy equipment orange
    "belseco_orange": {
        "vehicles": ["us_semi", "pickup"],
        "base": DOT_ORANGE_DEEP,
        "plate": [(0.615, 0.055)],
        "stripes": [
            (0.352, 0.012, WHITE),
            (0.366, 0.030, CHARCOAL),
            (0.400, 0.012, WHITE),
        ],
        "texts": [
            (0.373, "BELSECO DOT  •  WINTER OPERATIONS", WHITE, 0.022, 0.30, "bold"),
            (0.700, "PLOW  •  KEEP BACK 200 FT", WHITE, 0.026, 0.34, "bold"),
        ],
    },
    # Rear-facing conspicuity panel, applied to tailgates / body rears
    "belseco_chevron": {
        "vehicles": ["us_semi", "pickup"],
        "base": CHEVRON_RED,
        "chevrons": [(0.0, 1.0, CHEVRON_RED, SAFETY_YELLOW)],
        "texts": [],
    },
}


def draw_diamond_plate(img, y0, y1, size):
    """Cheap but convincing brushed diamond-plate band."""
    d = ImageDraw.Draw(img)
    d.rectangle([0, y0, size, y1], fill=SILVER)
    step = max(12, size // 96)
    for y in range(y0, y1, step):
        for x in range(0, size, step):
            off = (step // 2) if ((y - y0) // step) % 2 else 0
            cx, cy = x + off, y + step // 2
            d.polygon(
                [(cx, cy - step // 3), (cx + step // 3, cy), (cx, cy + step // 3), (cx - step // 3, cy)],
                fill=(206, 210, 216, 255),
                outline=(140, 144, 150, 255),
            )
    # brushed horizontal grain
    for y in range(y0, y1, 3):
        d.line([(0, y), (size, y)], fill=(255, 255, 255, 26))


def draw_chevrons(img, y0, y1, ca, cb, size):
    d = ImageDraw.Draw(img)
    d.rectangle([0, y0, size, y1], fill=ca)
    band = max(24, size // 20)
    x = -(y1 - y0)
    idx = 0
    while x < size + (y1 - y0):
        if idx % 2 == 0:
            d.polygon(
                [(x, y1), (x + band, y1), (x + band + (y1 - y0), y0), (x + (y1 - y0), y0)],
                fill=cb,
            )
        x += band
        idx += 1


def draw_text_row(img, spec, size):
    y, text, colour, size_frac, spacing_frac, style = spec
    px = max(8, int(size * size_frac))
    f = font(FONT_BOLD if style == "bold" else FONT_REG, px)
    d = ImageDraw.Draw(img)
    bbox = d.textbbox((0, 0), text, font=f)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    gap = int(size * spacing_frac)
    cy = int(size * y) - th // 2
    x = 0
    while x < size:
        d.text((x, cy), text, font=f, fill=colour)
        x += tw + gap


def render(name, spec, size):
    img = Image.new("RGBA", (size, size), spec["base"])
    for y, h in spec.get("plate", []):
        draw_diamond_plate(img, int(size * y), int(size * (y + h)), size)
    for y, h, ca, cb in spec.get("chevrons", []):
        draw_chevrons(img, int(size * y), int(size * (y + h)), ca, cb, size)
    d = ImageDraw.Draw(img)
    for y, h, colour in spec.get("stripes", []):
        d.rectangle([0, int(size * y), size, int(size * (y + h))], fill=colour)
    for t in spec.get("texts", []):
        draw_text_row(img, t, size)
    return img


def render_guide(size):
    """UV guide sheet - drop it on a vehicle to find where each panel lands."""
    img = Image.new("RGBA", (size, size), (30, 30, 34, 255))
    d = ImageDraw.Draw(img)
    step = size // 20
    f = font(FONT_BOLD, max(10, size // 90))
    for i in range(21):
        p = i * step
        major = i % 5 == 0
        col = (255, 120, 0, 255) if major else (90, 94, 100, 255)
        d.line([(p, 0), (p, size)], fill=col, width=2 if major else 1)
        d.line([(0, p), (size, p)], fill=col, width=2 if major else 1)
    for gy in range(20):
        for gx in range(20):
            d.text(
                (gx * step + 6, gy * step + 6),
                "%.2f\n%.2f" % (gx / 20.0, gy / 20.0),
                font=f,
                fill=(190, 194, 200, 255),
            )
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--size", type=int, default=2048)
    ap.add_argument("--guide", action="store_true", help="also emit the UV guide grid")
    args = ap.parse_args()

    written = []
    for name, spec in LIVERIES.items():
        img = render(name, spec, args.size)
        for vehicle in spec["vehicles"]:
            out = os.path.join(ROOT, "mod", "vehicles", vehicle, "%s.png" % name)
            os.makedirs(os.path.dirname(out), exist_ok=True)
            img.save(out, optimize=True)
            written.append(out)

    if args.guide:
        img = render_guide(args.size)
        for vehicle in ("us_semi", "pickup"):
            out = os.path.join(ROOT, "mod", "vehicles", vehicle, "belseco_uvguide.png")
            img.save(out, optimize=True)
            written.append(out)

    for w in written:
        print("wrote %s (%d KiB)" % (os.path.relpath(w, ROOT), os.path.getsize(w) // 1024))


if __name__ == "__main__":
    main()
