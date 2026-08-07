#!/usr/bin/env python3
"""
Belseco DOT Mega Pack - vehicle configuration (.pc) generator.

Each entry below becomes a spawnable configuration in the vehicle selector.
The configs are deliberately thin: they set the Belseco upfit part and the body
paint, and let BeamNG fill every other slot with the vehicle's defaults, so they
keep working when the base vehicles are updated.

Usage:
    python3 tools/generate_configs.py
"""

import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

WHITE = [0.92, 0.92, 0.90, 1.0]
SAFETY_YELLOW = [0.70, 0.78, 0.02, 1.0]
DOT_ORANGE = [0.85, 0.30, 0.03, 1.0]

# folder, filename, upfit part, paint
CONFIGS = [
    # Image 2 - plain white crew cab fleet truck
    ("pickup", "Belseco Fleet Pickup 214", "belseco_pickup_upfit_white", WHITE),
    # Image 3 - FIRST freeway service patrol truck
    ("pickup", "Belseco FIRST Unit 77", "belseco_pickup_upfit_first", SAFETY_YELLOW),
    ("pickup", "Belseco FIRST Unit 78", "belseco_pickup_upfit_first", SAFETY_YELLOW),
    ("pickup", "Belseco Supervisor 12", "belseco_pickup_upfit_supervisor", WHITE),
    ("pickup", "Belseco TMA Truck 640", "belseco_pickup_upfit_white", WHITE),
    ("pickup", "Belseco Plow Truck 318", "belseco_pickup_upfit_winter", DOT_ORANGE),
    # Image 1 - heavy rescue / incident response body
    ("us_semi", "Belseco Heavy Rescue 401", "belseco_semi_upfit_rescue", WHITE),
    ("us_semi", "Belseco Incident Command 402", "belseco_semi_upfit_command", WHITE),
    ("us_semi", "Belseco FIRST Heavy 88", "belseco_semi_upfit_first", SAFETY_YELLOW),
    ("us_semi", "Belseco Plow Truck 812", "belseco_semi_upfit_winter", DOT_ORANGE),
]


def paint(colour, roughness=0.32):
    return {
        "baseColor": colour,
        "metallic": 0.0,
        "roughness": roughness,
        "clearcoat": 1.0,
        "clearcoatRoughness": 0.05,
    }


def main():
    for vehicle, name, upfit, colour in CONFIGS:
        data = {
            "format": 2,
            "model": vehicle,
            "parts": {
                "paint_design": upfit,
            },
            "vars": {},
            "paints": [paint(colour), paint(colour), paint(colour)],
        }
        path = os.path.join(ROOT, "mod", "vehicles", vehicle, name + ".pc")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            json.dump(data, f, indent=2)
            f.write("\n")
        print("wrote %s" % os.path.relpath(path, ROOT))


if __name__ == "__main__":
    main()
