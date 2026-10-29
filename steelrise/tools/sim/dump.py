import json, subprocess, sys, os
here = os.path.dirname(os.path.abspath(__file__))
what, views_json, out = sys.argv[1], sys.argv[2], sys.argv[3]
src = open(os.path.join(here, "dump.lua")).read().replace('DUMP_WHAT or "truck"', f'"{what}"')
open(os.path.join(here, "_dump.lua"), "w").write(src)
r = subprocess.run([sys.executable, os.path.join(here, "run.py"), os.path.abspath(os.path.join(here, "..", "..")), "_dump"], capture_output=True, text=True)
line = [l for l in r.stdout.splitlines() if l.startswith("DUMP:")]
if not line:
    print(r.stdout[-3000:], r.stderr[-3000:]); sys.exit(1)
parts = json.loads(line[0][5:])
print(len(parts), "parts")
views = json.loads(views_json)
for i, v in enumerate(views):
    v["out"] = out.replace(".png", f"_{i}.png")
json.dump({"parts": parts, "views": views}, open(os.path.join(here, "_scene.json"), "w"))
subprocess.run([sys.executable, os.path.join(here, "render.py"), os.path.join(here, "_scene.json")])
