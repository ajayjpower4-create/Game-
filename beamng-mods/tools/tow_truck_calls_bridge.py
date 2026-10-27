"""Runs the Tow Truck Calls Lua in the fake BeamNG from test_tow_truck_calls.py
and talks JSON lines on stdin/stdout, so the browser test can drive the real
Lua from the UI app.

    in:  {"lua": "<lua code>"}
    out: {"state": <latest TowTruckCallsState or null>, "toasts": [...], "err": null}
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import test_tow_truck_calls as t  # noqa: E402

lua, g = t.new_game()
t.setup_world(lua)
seen_hooks = 0
seen_toasts = 0

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    req = json.loads(line)
    err = None
    try:
        lua.execute(req["lua"])
    except Exception as e:  # report, keep running
        err = str(e)
    n_hooks, n_toasts = lua.eval("#sim.hooks"), lua.eval("#sim.toasts")
    last = None
    for i in range(n_hooks, seen_hooks, -1):
        if lua.eval(f"sim.hooks[{i}].name") == "TowTruckCallsState":
            last = t.py(lua.eval(f"sim.hooks[{i}].data"))
            break
    toasts = [t.py(lua.eval(f"sim.toasts[{i}]")) for i in range(seen_toasts + 1, n_toasts + 1)]
    out = {"state": last, "toasts": toasts, "err": err}
    seen_hooks, seen_toasts = n_hooks, n_toasts
    sys.stdout.write(json.dumps(out) + "\n")
    sys.stdout.flush()
