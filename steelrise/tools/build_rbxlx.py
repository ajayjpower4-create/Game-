#!/usr/bin/env python3
"""Builds dist/STEELRISE.rbxlx from default.project.json without Rojo.

Follows Rojo's file conventions: *.server.lua -> Script, *.client.lua ->
LocalScript, other *.lua -> ModuleScript, directories -> Folder.

Usage (from the steelrise folder):  python3 tools/build_rbxlx.py
"""
import json
import os
import sys
from xml.sax.saxutils import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "dist", "STEELRISE.rbxlx")

# property value -> (xml tag, text)
ENUMS = {("Lighting", "Technology"): {"Legacy": 0, "Voxel": 1, "Compatibility": 2, "ShadowMap": 3, "Future": 4}}
INT_PROPS = {"StreamingMinRadius", "StreamingTargetRadius"}

_ref = [0]


def ref():
    _ref[0] += 1
    return "RBX%08X" % _ref[0]


def cdata(text):
    return "<![CDATA[" + text.replace("]]>", "]]]]><![CDATA[>") + "]]>"


def prop_xml(cls, name, value):
    if (cls, name) in ENUMS:
        return '<token name="%s">%d</token>' % (name, ENUMS[(cls, name)][value])
    if isinstance(value, bool):
        return '<bool name="%s">%s</bool>' % (name, "true" if value else "false")
    if isinstance(value, (int, float)):
        tag = "int" if name in INT_PROPS else "float"
        return '<%s name="%s">%s</%s>' % (tag, name, value, tag)
    return '<string name="%s">%s</string>' % (name, escape(str(value)))


def item(cls, name, props=None, source=None, children=()):
    lines = ['<Item class="%s" referent="%s">' % (cls, ref()), "<Properties>"]
    lines.append('<string name="Name">%s</string>' % escape(name))
    for k, v in (props or {}).items():
        lines.append(prop_xml(cls, k, v))
    if source is not None:
        lines.append('<ProtectedString name="Source">%s</ProtectedString>' % cdata(source))
    lines.append("</Properties>")
    lines.extend(children)
    lines.append("</Item>")
    return "\n".join(lines)


def from_path(path, name=None):
    full = os.path.join(ROOT, path)
    if os.path.isdir(full):
        kids = [from_path(os.path.join(path, f)) for f in sorted(os.listdir(full))]
        kids = [k for k in kids if k]
        return item("Folder", name or os.path.basename(full), children=kids)
    base = os.path.basename(full)
    if not base.endswith(".lua"):
        return None
    with open(full, encoding="utf-8") as fh:
        src = fh.read()
    if base.endswith(".server.lua"):
        cls, stem = "Script", base[: -len(".server.lua")]
    elif base.endswith(".client.lua"):
        cls, stem = "LocalScript", base[: -len(".client.lua")]
    else:
        cls, stem = "ModuleScript", base[: -len(".lua")]
    return item(cls, name or stem, source=src)


def node(name, spec):
    cls = spec.get("$className", "Folder")
    if "$path" in spec:
        built = from_path(spec["$path"], name)
        if cls == "Folder" or "$className" not in spec:
            return built
    children = [node(k, v) for k, v in spec.items() if not k.startswith("$")]
    return item(cls, name, props=spec.get("$properties"), children=children)


def main():
    with open(os.path.join(ROOT, "default.project.json"), encoding="utf-8") as fh:
        project = json.load(fh)
    services = [node(k, v) for k, v in project["tree"].items() if not k.startswith("$")]
    xml = (
        '<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" '
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
        'xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">\n'
        + "\n".join(services)
        + "\n</roblox>\n"
    )
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(xml)
    print("wrote", OUT, "(%d bytes)" % len(xml.encode("utf-8")))


if __name__ == "__main__":
    sys.exit(main())
