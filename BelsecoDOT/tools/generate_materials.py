#!/usr/bin/env python3
"""
Belseco DOT Mega Pack - skin material generator.

BeamNG resolves a skin by looking for a material called

    <baseMaterialName>.skin.<skinName>

so a skin only shows up on the panels whose *base* material name we match.
Those base names belong to the game's own vehicle files, which this pack does
not ship, so they live in BASE_MATERIALS below as an editable list.

If a livery only paints part of a truck in game, open the World Editor's
Material Editor, click the panel that stayed the wrong colour, copy the material
name, add it to the list for that vehicle and re-run this script.

Usage:
    python3 tools/generate_materials.py
"""

import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Best-guess vanilla base material names, ordered most to least likely.
# Extra names cost nothing: a material that matches no mesh is simply unused.
# The vanilla body material is usually named after the vehicle itself, with no
# suffix - BeamNG's own documentation uses "pickup.skin.ambulance" as its
# example, which means the D-Series body material is plain "pickup". The
# suffixed names below are extra coverage for panels split onto their own
# materials; a material that matches no mesh is simply unused, so casting a wide
# net costs nothing but file size.
BASE_MATERIALS = {
    "pickup": [
        "pickup",
        "pickup_body",
        "pickup_bed",
        "pickup_bedside",
        "pickup_doors",
        "pickup_cab",
        "pickup_fenders",
        "pickup_bumpers",
        "pickup_canopy",
        "pickup_utility",
        "pickup_flatbed",
    ],
    "us_semi": [
        "us_semi",
        "us_semi_body",
        "us_semi_cab",
        "us_semi_doors",
        "us_semi_hood",
        "us_semi_fenders",
        "us_semi_sleeper",
        "us_semi_bumper",
        "us_semi_fueltank",
        "us_semi_chassis",
    ],
}

# skin name -> (texture file, roughness, metallic, clearcoat)
SKINS = {
    "belseco_white": ("belseco_white.png", 0.32, 0.0, 1.0),
    "belseco_fleet_plain": ("belseco_fleet_plain.png", 0.38, 0.0, 0.8),
    "belseco_first": ("belseco_first.png", 0.34, 0.0, 1.0),
    "belseco_orange": ("belseco_orange.png", 0.40, 0.0, 0.7),
    "belseco_chevron": ("belseco_chevron.png", 0.55, 0.0, 0.2),
    "belseco_uvguide": ("belseco_uvguide.png", 0.90, 0.0, 0.0),
}

# only these liveries are generated per vehicle (matches generate_skins.py)
PER_VEHICLE = {
    "pickup": ["belseco_white", "belseco_fleet_plain", "belseco_first",
               "belseco_orange", "belseco_chevron", "belseco_uvguide"],
    "us_semi": ["belseco_white", "belseco_first", "belseco_orange",
                "belseco_chevron", "belseco_uvguide"],
}


def material(vehicle, base, skin):
    texture, roughness, metallic, clearcoat = SKINS[skin]
    name = "%s.skin.%s" % (base, skin)
    return name, {
        "name": name,
        "mapTo": name,
        "class": "Material",
        "activeLayers": 1,
        "Stages": [
            {
                "baseColorMap": "/vehicles/%s/%s" % (vehicle, texture),
                "roughnessFactor": roughness,
                "metallicFactor": metallic,
                "clearCoatFactor": clearcoat,
                "clearCoatRoughnessFactor": 0.05,
                "ambientOcclusion": [1.0, 1.0, 1.0, 1.0],
            },
            {},
            {},
            {},
        ],
        "materialTag0": "beamng",
        "materialTag1": "vehicle",
        "version": 1.5,
    }


def main():
    for vehicle, skins in PER_VEHICLE.items():
        out = {}
        for skin in skins:
            for base in BASE_MATERIALS[vehicle]:
                name, definition = material(vehicle, base, skin)
                out[name] = definition
        path = os.path.join(ROOT, "mod", "vehicles", vehicle, "belseco_skins.materials.json")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            json.dump(out, f, indent=2, sort_keys=True)
            f.write("\n")
        print("wrote %s (%d materials)" % (os.path.relpath(path, ROOT), len(out)))


if __name__ == "__main__":
    main()
