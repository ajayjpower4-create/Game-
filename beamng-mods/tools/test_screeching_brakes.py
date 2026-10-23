"""Runs the Screeching Brakes Lua code in LuaJIT with a fake BeamNG around it.

    python3 test_screeching_brakes.py <path to screeching-brakes mod folder>

The fakes record every sound call, so the test can check that braking starts
the right sound, that it gets louder with the pedal, and that it stops again.
"""
import json
import sys
from pathlib import Path

import lupa.luajit21 as lupa

MOD = Path(sys.argv[1]).resolve()
SETTINGS = {}


class Game:
    def __init__(self):
        self.ge = lupa.LuaRuntime(unpack_returned_tuples=True)
        self.vehicles = {}
        self.player = None
        self.toasts = []
        self.ui_states = []
        g = self.ge.globals()
        game = self

        def json_read(path):
            data = SETTINGS.get(path)
            return self.ge.eval("function(s) return require_json(s) end")(json.dumps(data)) if data else None

        g.require_json = self.ge.eval("""function(s)
            -- tiny decoder good enough for the settings table
            local f = load("return " .. s:gsub('%[', '{'):gsub('%]', '}'):gsub('"([%w_]+)":', '["%1"]='):gsub('null', 'nil'))
            return f()
        end""")
        g.jsonReadFile = json_read
        g.jsonWriteFile = lambda path, data, pretty=None: SETTINGS.__setitem__(path, lua_to_py(data))
        g.log = lambda *a: print("   [GE log]", *a)
        g.trigger_hook = lambda name, data: (self.toasts if name == "toastrMsg" else self.ui_states).append(lua_to_py(data))
        self.ge.execute("guihooks = { trigger = function(name, data) trigger_hook(name, data) end }")
        g.getAllVehicles_py = lambda: self.ge.table_from([v.handle for v in self.vehicles.values()])
        self.ge.execute("function getAllVehicles() return getAllVehicles_py() end")
        g.getPlayer_py = lambda: self.vehicles[self.player].handle if self.player in self.vehicles else None
        g.getById_py = lambda vid: self.vehicles[vid].handle if vid in self.vehicles else None
        self.ge.execute("be = { getPlayerVehicle = function(self, i) return getPlayer_py() end,"
                        " getObjectByID = function(self, id) return getById_py(id) end }")
        source = (MOD / "lua/ge/extensions/screechingBrakes.lua").read_text()
        g.screechingBrakes = self.ge.execute(source)

    def ge_call(self, name, *args):
        return self.ge.globals().screechingBrakes[name](*args)

    def spawn(self, vid, model, mass_per_node=10.0, nodes=100, player=True):
        veh = Vehicle(self, vid, model, mass_per_node, nodes)
        self.vehicles[vid] = veh
        if player:
            old = self.player
            self.player = vid
        self.ge_call("onVehicleSpawned", vid)
        if player and old is not None and old != vid:
            self.ge_call("onVehicleSwitched", old, vid)
        return veh

    def frame(self, dt=1 / 60):
        self.ge_call("onUpdate", dt)
        for veh in list(self.vehicles.values()):
            veh.update(dt)


class Vehicle:
    def __init__(self, game, vid, model, mass_per_node, nodes):
        self.game, self.vid, self.model = game, vid, model
        self.mass_per_node, self.nodes = mass_per_node, nodes
        self.queue = []
        self.boot()
        handle = game.ge.table()
        handle.getID = lambda _self: vid
        handle.getJBeamFilename = lambda _self: model
        handle.queueLuaCommand = lambda _self, cmd: self.queue.append(cmd)
        self.handle = handle

    def boot(self):
        """Fresh vehicle Lua, like a spawn or Ctrl+R."""
        self.lua = lupa.LuaRuntime(unpack_returned_tuples=True)
        self.sounds = {}
        self.events = []
        self.next_id = 100
        self.loaded = []
        g = self.lua.globals()
        g.log = lambda *a: print(f"   [veh {self.vid} log]", *a)

        def create(_obj, file, desc, name, node):
            sid = self.next_id
            self.next_id += 1
            self.sounds[sid] = {"file": file, "desc": desc, "node": node, "playing": False, "vol": None, "pitch": None}
            self.events.append(("create", sid, file))
            return sid

        def set_vp(_obj, sid, vol, pitch):
            self.sounds[sid]["vol"], self.sounds[sid]["pitch"] = vol, pitch

        def play(_obj, sid):
            self.sounds[sid]["playing"] = True
            self.events.append(("play", sid))

        def stop(_obj, sid):
            self.sounds[sid]["playing"] = False
            self.events.append(("stop", sid))

        g.py_create, g.py_setvp, g.py_play, g.py_stop = create, set_vp, play, stop
        g.py_queue_ge = lambda cmd: self.game.ge.execute(cmd)
        self.lua.execute(f"""
            obj = {{
              createSFXSource = function(self, f, d, n, node) return py_create(self, f, d, n, node) end,
              setVolumePitch = function(self, id, vol, p) py_setvp(self, id, vol, p) end,
              playSFX = function(self, id) py_play(self, id) end,
              stopSFX = function(self, id) py_stop(self, id) end,
              deleteSFXSource = function(self, id) end,
              queueGameEngineLua = function(self, cmd) py_queue_ge(cmd) end,
              getID = function(self) return {self.vid} end,
            }}
            electrics = {{ values = {{ brake = 0, parkingbrake = 0, airspeed = 0, wheelspeed = 0 }} }}
            v = {{ data = {{ refNodes = {{ [0] = {{ ref = 7 }} }}, nodes = {{}} }} }}
            for i = 0, {self.nodes - 1} do v.data.nodes[i] = {{ nodeWeight = {self.mass_per_node} }} end
        """)
        g.py_load_dir = self.load_dir
        self.lua.execute("extensions = { loadModulesInDirectory = function(dir) py_load_dir(dir) end }")

    def load_dir(self, directory):
        for f in sorted((MOD / directory).glob("*.lua")):
            mod = self.lua.execute(f.read_text())
            self.loaded.append(f.stem)
            self.module = mod
            mod.onExtensionLoaded()

    def run_queue(self):
        while self.queue:
            self.lua.execute(self.queue.pop(0))

    def update(self, dt):
        self.run_queue()
        if self.loaded:
            self.module.updateGFX(dt)

    def set(self, brake=None, speed=None, parking=None):
        e = self.lua.globals().electrics["values"]
        if brake is not None:
            e["brake"] = brake
        if speed is not None:
            e["airspeed"] = speed
            e["wheelspeed"] = speed
        if parking is not None:
            e["parkingbrake"] = parking

    def playing(self):
        return [(Path(s["file"]).stem, round(s["vol"], 3), round(s["pitch"], 3))
                for s in self.sounds.values() if s["playing"]]


def lua_to_py(value):
    if lupa.lua_type(value) == "table":
        keys = list(value.keys())
        if keys and all(isinstance(k, int) for k in keys):
            return [lua_to_py(value[k]) for k in sorted(keys)]
        return {k: lua_to_py(value[k]) for k in keys}
    return value


failures = []


def check(name, cond, detail=""):
    print(("PASS " if cond else "FAIL ") + name + (f"  ({detail})" if detail else ""))
    if not cond:
        failures.append(name)


def run(game, veh, seconds):
    for _ in range(int(seconds * 60)):
        game.frame()


def main():
    game = Game()
    game.ge_call("onExtensionLoaded")

    car = game.spawn(1, "pickup")
    run(game, car, 0.2)
    check("vehicle script loads into the player vehicle", car.loaded == ["screechingBrakesVE"], car.loaded)
    check("car sound is pre-loaded before the first stop", any(e[0] == "create" and "car_screech" in e[2] for e in car.events))

    car.set(speed=20, brake=0)
    run(game, car, 0.5)
    check("no screech while driving without brakes", car.playing() == [], car.playing())

    car.set(brake=0.2)
    run(game, car, 0.5)
    check("no screech below the 35% pedal threshold", car.playing() == [], car.playing())

    car.set(brake=0.6)
    run(game, car, 0.5)
    mid = car.playing()
    check("car screech plays when braking", len(mid) == 1 and mid[0][0] == "car_screech", mid)

    car.set(brake=1.0)
    run(game, car, 0.5)
    full = car.playing()
    check("harder braking is louder", full and mid and full[0][1] > mid[0][1], f"{mid} -> {full}")
    check("volume stays within the 80% master volume", full and full[0][1] <= 0.8001, full)

    car.set(speed=0.2)
    run(game, car, 1.5)
    check("screech stops once the vehicle has stopped", car.playing() == [], car.playing())

    car.set(speed=15, brake=0)
    run(game, car, 1.0)
    check("screech stops when you let go of the brake", car.playing() == [], car.playing())

    game.ge_call("setVehicleSound", "truck")
    car.set(brake=1.0, speed=10)
    run(game, car, 0.5)
    p = car.playing()
    check("switching this vehicle to the truck sound", len(p) == 1 and p[0][0] == "truck_screech", p)
    run(game, car, 0.7)  # settings are written to disk one second after the last change
    check("choice is remembered per vehicle model", SETTINGS["settings/screechingBrakes.json"]["perModel"].get("pickup") == "truck"
          if "settings/screechingBrakes.json" in SETTINGS else False, SETTINGS)

    game.ge_call("toggleEnabled")
    run(game, car, 1.0)
    check("turning the mod off silences it", car.playing() == [], car.playing())
    check("toggle shows a message", game.toasts and "OFF" in game.toasts[-1]["msg"], game.toasts[-1:])
    game.ge_call("toggleEnabled")
    run(game, car, 0.5)
    check("turning it back on screeches again", len(car.playing()) == 1, car.playing())
    car.set(brake=0)
    run(game, car, 1.0)

    # A heavy modded truck with "auto" as the default
    game.ge_call("setDefaultSound", "auto")
    semi = game.spawn(2, "my_modded_semi", mass_per_node=80, nodes=200, player=True)
    run(game, semi, 0.2)
    semi.set(speed=12, brake=0.9)
    run(game, semi, 0.5)
    p = semi.playing()
    check("auto picks the truck sound for a heavy modded vehicle", len(p) == 1 and p[0][0] == "truck_screech", p)
    car.set(brake=1.0, speed=10)
    run(game, car, 0.5)
    check("the vehicle you left stays quiet (AI/traffic option off)", car.playing() == [], car.playing())
    game.ge_call("setAllVehicles", True)
    run(game, car, 0.5)
    check("AI/traffic option makes other vehicles screech", len(car.playing()) == 1, car.playing())
    game.ge_call("setAllVehicles", False)
    car.set(brake=0)
    semi.set(brake=0)
    run(game, semi, 1.0)

    light = game.spawn(3, "covet", mass_per_node=6, nodes=150, player=True)
    run(game, light, 0.2)
    light.set(speed=25, brake=1.0)
    run(game, light, 0.5)
    p = light.playing()
    check("auto picks the car sound for a light car", len(p) == 1 and p[0][0] == "car_screech", p)
    light.set(brake=0)
    run(game, light, 1.0)

    # Ctrl+R wipes the vehicle Lua; the mod must come back on its own
    light.boot()
    run(game, light, 2.5)
    check("script reloads itself after Ctrl+R", light.loaded == ["screechingBrakesVE"], light.loaded)
    light.set(speed=25, brake=1.0)
    run(game, light, 0.5)
    check("screech works after Ctrl+R", len(light.playing()) == 1, light.playing())
    light.set(brake=0)
    run(game, light, 1.0)

    game.ge_call("testSound", "truck")
    run(game, light, 0.3)
    p = light.playing()
    check("test button plays the truck sound", len(p) == 1 and p[0][0] == "truck_screech", p)
    run(game, light, 2.5)
    check("test sound ends by itself", light.playing() == [], light.playing())

    game.ge_call("cycleVehicleSound")
    check("keybind cycles the sound and says so", "This vehicle" in game.toasts[-1]["msg"], game.toasts[-1])

    game.ge_call("requestState")
    st = game.ui_states[-1]
    check("UI app gets the current vehicle and settings", st["vehicleModel"] == "covet" and st["defaultSound"] == "auto", st)

    # The exact Lua strings the UI app and the keybindings send
    ui_calls = [
        'if screechingBrakes then screechingBrakes.requestState() end',
        'if screechingBrakes then screechingBrakes.setVehicleSound("car") end',
        'if screechingBrakes then screechingBrakes.setDefaultSound("auto") end',
        'if screechingBrakes then screechingBrakes.setVolume(0.55) end',
        'if screechingBrakes then screechingBrakes.setSensitivity(0.35) end',
        'if screechingBrakes then screechingBrakes.setAllVehicles(false) end',
        'if screechingBrakes then screechingBrakes.testSound("truck") end',
    ]
    actions = json.loads((MOD / "lua/ge/extensions/core/input/actions/screechingBrakes.json").read_text())
    ok = True
    for cmd in ui_calls + [a["onDown"] for a in actions.values()]:
        try:
            game.ge.execute(cmd)
        except Exception as exc:  # noqa: BLE001
            ok = False
            print("   bad command:", cmd, exc)
    run(game, light, 0.2)
    check("every UI app button and keybinding command runs", ok)
    game.ge_call("toggleEnabled")  # the keybinding list above toggled it off; turn it back on
    game.ge_call("setVolume", 0.8)
    run(game, light, 2.0)

    # Settings survive a restart
    game2 = Game()
    game2.ge_call("onExtensionLoaded")
    game2.ge_call("requestState")
    check("settings are loaded again after restarting the game",
          game2.ui_states and game2.ui_states[-1]["defaultSound"] == "auto", game2.ui_states[-1:])

    print()
    print("ALL PASSED" if not failures else f"{len(failures)} FAILED: {failures}")
    sys.exit(1 if failures else 0)


main()
