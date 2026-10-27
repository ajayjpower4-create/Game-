"""Runs the Tow Truck Calls Lua code in LuaJIT with a fake BeamNG around it.

    python3 test_tow_truck_calls.py <path to tow-truck-calls mod folder>

The fake game has a flat map with a grid of roads, the player's tow truck and
whatever the mod spawns. Commands the mod sends to a vehicle run in a fake
vehicle Lua so the test can see the parking brake, hazards and flat tires.
Plays whole jobs: call comes in, accept, drive there, load, strap, tow, DONE.
"""
import sys
from pathlib import Path

import lupa.luajit21 as lupa

MOD = Path(sys.argv[1] if len(sys.argv) > 1 else Path(__file__).parent.parent / "tow-truck-calls").resolve()
FAILS = []

FAKE_BEAMNG = r"""
-- vec3 / quat ------------------------------------------------------------------
local V = {}
V.__index = V
function vec3(x, y, z)
  if type(x) == 'table' then return setmetatable({x = x.x, y = x.y, z = x.z}, V) end
  return setmetatable({x = x or 0, y = y or 0, z = z or 0}, V)
end
V.__add = function(a, b) return vec3(a.x + b.x, a.y + b.y, a.z + b.z) end
V.__sub = function(a, b) return vec3(a.x - b.x, a.y - b.y, a.z - b.z) end
V.__unm = function(a) return vec3(-a.x, -a.y, -a.z) end
V.__mul = function(a, b)
  if type(a) == 'number' then return vec3(b.x * a, b.y * a, b.z * a) end
  return vec3(a.x * b, a.y * b, a.z * b)
end
function V:dot(b) return self.x * b.x + self.y * b.y + self.z * b.z end
function V:cross(b) return vec3(self.y * b.z - self.z * b.y, self.z * b.x - self.x * b.z, self.x * b.y - self.y * b.x) end
function V:length() return math.sqrt(self:dot(self)) end
function V:squaredLength() return self:dot(self) end
function V:normalized() local l = self:length() return l > 0 and self * (1 / l) or vec3(0, 0, 0) end
function V:distance(b) return (self - b):length() end

local Q = {}
Q.__index = Q
function quat(x, y, z, w)
  if type(x) == 'table' then return setmetatable({x = x.x, y = x.y, z = x.z, w = x.w, dir = x.dir}, Q) end
  return setmetatable({x = x or 0, y = y or 0, z = z or 0, w = w or 1}, Q)
end
Q.__mul = function(a, b)
  local r = quat(a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y, a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w, a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z)
  r.dir = b.dir
  return r
end
function quatFromDir(dir, up) local q = quat(0, 0, 0, 1); q.dir = vec3(dir); return q end
function ColorF(r, g, b, a) return {r, g, b, a} end
function ColorI(r, g, b, a) return {r, g, b, a} end

-- the world ---------------------------------------------------------------------
sim = {vehicles = {}, nextId = 1, player = nil, hooks = {}, toasts = {}, routes = {}, spawns = {}, files = {},
  messages = {}, draws = 0, flatMap = false}

local function groundAt(x, y) return 0 end

-- Roads: a grid every 100 m from -1500 to 1500, 8 m wide.
local nodes = {}
local function nodeName(i, j) return 'n' .. i .. '_' .. j end
for i = -15, 15 do
  for j = -15, 15 do
    nodes[nodeName(i, j)] = {pos = vec3(i * 100, j * 100, 0), radius = 4, links = {}}
  end
end
for i = -15, 15 do
  for j = -15, 15 do
    local n = nodes[nodeName(i, j)]
    if i < 15 then n.links[nodeName(i + 1, j)] = {drivability = 1}; nodes[nodeName(i + 1, j)].links[nodeName(i, j)] = {drivability = 1} end
    if j < 15 then n.links[nodeName(i, j + 1)] = {drivability = 1}; nodes[nodeName(i, j + 1)].links[nodeName(i, j)] = {drivability = 1} end
  end
end
sim.mapData = {nodes = nodes}

map = {objects = {}}
function map.getMap() if sim.flatMap then return {nodes = {}} end return sim.mapData end

-- vehicles ------------------------------------------------------------------------
local Veh = {}
Veh.__index = Veh
function Veh:getID() return self.id end
function Veh:getJBeamFilename() return self.model end
function Veh:getPosition() return vec3(self.pos) end
function Veh:getDirectionVector() return vec3(self.fwd) end
function Veh:getDirectionVectorUp() return vec3(0, 0, 1) end
function Veh:getVelocity() return vec3(self.vel) end
function Veh:getRefNodeRotation() return quat(0, 0, 0, 1) end
function Veh:getSpawnWorldOOBB()
  local v = self
  local right = v.fwd:cross(vec3(0, 0, 1))
  return {
    getCenter = function() return vec3(v.pos) end,
    getHalfExtents = function() return vec3(v.he) end,
    getAxis = function(_, i) if i == 0 then return right elseif i == 1 then return vec3(v.fwd) end return vec3(0, 0, 1) end,
  }
end
function Veh:setPositionRotation(x, y, z) self.pos = vec3(x, y, z); self.lifted = true end
function Veh:delete()
  self.deleted = true
  sim.vehicles[self.id] = nil
  map.objects[self.id] = nil
  if sim.player == self.id then sim.player = nil end
  if towTruckCalls and towTruckCalls.onVehicleDestroyed then towTruckCalls.onVehicleDestroyed(self.id) end
end
-- Vehicle Lua: just enough to see what the mod asked for.
function Veh:queueLuaCommand(cmd)
  local v = self
  v.cmds[#v.cmds + 1] = cmd
  local env = setmetatable({
    input = {event = function(name, value, filter) v.inputs[name] = value end},
    electrics = {setIgnitionLevel = function(l) v.ignition = l end, set_warn_signal = function(on) v.hazards = on end},
    wheels = {wheelRotators = {[0] = {}, [1] = {}, [2] = {}, [3] = {}}},
    beamstate = {deflateTire = function(i) v.flats[#v.flats + 1] = i; v.damage = v.damage + 400 end},
    obj = {setGhostEnabled = function(_, on) v.ghost = on end, setVelocity = function() end, setAngularVelocity = function() end},
  }, {__index = _G})
  local f, err = load(cmd, 'veh', 't', env)
  if not f then error('bad vehicle command: ' .. tostring(err) .. '\n' .. cmd) end
  -- The real game runs these in the vehicle; errors there must not happen either.
  local ok, e = pcall(f)
  if not ok then error('vehicle command failed: ' .. tostring(e) .. '\n' .. cmd) end
end

function sim.addVehicle(model, pos, fwd, he)
  local id = sim.nextId
  sim.nextId = sim.nextId + 1
  local v = setmetatable({id = id, model = model, pos = vec3(pos), fwd = vec3(fwd):normalized(), he = vec3(he),
    vel = vec3(0, 0, 0), cmds = {}, inputs = {}, flats = {}, damage = 0}, Veh)
  sim.vehicles[id] = v
  return v
end

function getObjectByID(id) return sim.vehicles[id] end
function getPlayerVehicle(i) return sim.player and sim.vehicles[sim.player] or nil end
be = {}
function be:getObjectByID(id) return sim.vehicles[id] end
function be:getPlayerVehicle(i) return getPlayerVehicle(i) end
function be:enterVehicle(i, veh) sim.player = veh and veh.id or nil end
function be:getSurfaceHeightBelow(p) local g = groundAt(p.x, p.y) if g <= p.z then return g end return -1e30 end

core_vehicles = {}
sim.models = {covet = {Brand = 'Ibishu', Name = 'Covet'}, pessima = {Brand = 'Ibishu', Name = 'Pessima'},
  fullsize = {Brand = 'Gavril', Name = 'Grand Marshal'}}
function core_vehicles.getModel(m) local info = sim.models[m] return info and {model = info} or {} end
function core_vehicles.spawnNewVehicle(model, opts)
  sim.spawns[#sim.spawns + 1] = {model = model, opts = opts}
  if sim.failSpawn then return nil end
  local fwd = opts.rot and opts.rot.dir and -opts.rot.dir or vec3(0, 1, 0)
  return sim.addVehicle(model, opts.pos + vec3(0, 0, 0.45), fwd, vec3(0.9, 2.2, 0.7))
end

core_groundMarkers = {setPath = function(p, opts) sim.routes[#sim.routes + 1] = p and vec3(p) or 'clear' end}
core_camera = {getPosition = function() return vec3(0, 0, 2) end}
guihooks = {trigger = function(name, data)
  if name == 'toastrMsg' then sim.toasts[#sim.toasts + 1] = data else sim.hooks[#sim.hooks + 1] = {name = name, data = data} end
end}
function ui_message(msg) sim.messages[#sim.messages + 1] = msg end
function log() end
function jsonReadFile(p) return sim.files[p] end
function jsonWriteFile(p, data) sim.files[p] = data return true end
settings = {getValue = function(k) return nil end}
function getCurrentLevelIdentifier() return sim.level end
sim.level = 'west_coast_usa'
extensions = {load = function(name) end}
debugDrawer = {}
function debugDrawer:drawCylinder() sim.draws = sim.draws + 1 end
function debugDrawer:drawTextAdvanced(pos, text) sim.drawText = text end

-- stepping --------------------------------------------------------------------------
function sim.syncObjects()
  map.objects = {}
  for id, v in pairs(sim.vehicles) do map.objects[id] = {pos = vec3(v.pos), vel = vec3(v.vel), damage = v.damage} end
end
function sim.step(dt, n)
  for _ = 1, n or 1 do
    sim.syncObjects()
    towTruckCalls.onUpdate(dt, dt)
    towTruckCalls.onPreRender(dt, dt)
  end
end
-- Drive the truck in a straight line (what it carries comes along: one vehicle or a list).
function sim.drive(truck, to, speed, carried)
  if carried and carried.id then carried = {carried} end
  local dt = 1 / 20
  while true do
    local d = to - truck.pos
    d.z = 0
    local len = d:length()
    if len < 0.01 then break end
    local stepLen = math.min(len, speed * dt)
    local mv = d:normalized() * stepLen
    truck.fwd = d:normalized()
    truck.pos = truck.pos + mv
    truck.vel = d:normalized() * speed
    for _, c in ipairs(carried or {}) do
      c.pos = c.pos + mv
      c.vel = vec3(truck.vel)
      c.fwd = vec3(truck.fwd)
    end
    sim.step(dt)
  end
  truck.vel = vec3(0, 0, 0)
  for _, c in ipairs(carried or {}) do c.vel = vec3(0, 0, 0) end
  sim.step(dt)
end
function sim.lastState() return sim.hooks[#sim.hooks].data end
"""


def check(name, cond, detail=""):
    print(("  ok   " if cond else "  FAIL ") + name + (("   " + str(detail)) if detail and not cond else ""))
    if not cond:
        FAILS.append(name)


def py(v):
    """Lua value -> Python (tables to dict / list)."""
    if lupa.lua_type(v) == "table":
        keys = list(v.keys())
        if keys and all(isinstance(k, int) for k in keys) and sorted(keys) == list(range(1, len(keys) + 1)):
            return [py(v[k]) for k in sorted(keys)]
        return {k: py(v[k]) for k in keys}
    return v


def new_game():
    lua = lupa.LuaRuntime(unpack_returned_tuples=True)
    lua.execute(FAKE_BEAMNG)
    g = lua.globals()
    g.towTruckCalls = lua.execute((MOD / "lua/ge/extensions/towTruckCalls.lua").read_text())
    return lua, g


def setup_world(lua):
    # Player's flatbed: 7 m long, parked on the road at the origin facing north.
    lua.execute("""
      truck = sim.addVehicle('flatbed_truck', vec3(0, 0, 1.0), vec3(0, 1, 0), vec3(1.2, 3.5, 1.1))
      sim.player = truck.id
      towTruckCalls.onExtensionLoaded()
    """)


def state(lua):
    return py(lua.eval("sim.lastState()"))


def toasts(lua):
    return [py(t) for t in py(lua.eval("sim.toasts")) or []]


def force_type(lua, type_id):
    lua.execute(f"""
      for _, ct in ipairs(towTruckCalls.CALL_TYPES) do
        if ct.id == '{type_id}' then towTruckCalls.state.offers[1].type = ct end
      end""")


def first_offer(lua, quiet_wait=13):
    lua.execute(f"sim.step(0.5, {int(quiet_wait * 2)})")
    st = state(lua)
    return st, (st.get("offers") or [None])[0]


def full_job():
    print("\n== Full job: call, accept, drive, load, strap, tow, DONE")
    lua, g = new_game()
    setup_world(lua)
    st = state(lua)
    check("app state on load", st["inLevel"] is True and st["duty"] is True and st["bank"] == 0, st)
    lua.execute("sim.step(0.5, 10)")
    check("no call in the first seconds", len(state(lua).get("offers") or []) == 0)
    st, offer = first_offer(lua, 8)
    check("a call comes in", offer is not None, st)
    check("radio toast for the call", any("Tow call" in t["title"] for t in toasts(lua)), toasts(lua))
    check("call distance in range", 180 <= offer["dist"] <= 1500, offer["dist"])
    for k in ("typeLabel", "vehicle", "caller", "pay", "dir", "ttl", "desc"):
        check("call has " + k, offer.get(k) not in (None, ""), offer)

    # Spot is on the right-hand shoulder of a road (roads at multiples of 100 m, 8 m wide).
    pos = py(lua.eval("towTruckCalls.state.offers[1].pos"))
    off_x, off_y = abs(pos["x"] - round(pos["x"] / 100) * 100), abs(pos["y"] - round(pos["y"] / 100) * 100)
    check("spawn spot is on the road shoulder", min(off_x, off_y) <= 4.0 and min(off_x, off_y) >= 1.5, (pos, off_x, off_y))

    force_type(lua, "flat")
    lua.execute(f"towTruckCalls.accept({offer['id']})")
    spawn = py(lua.eval("sim.spawns[1]"))
    opts = spawn["opts"]
    check("car spawned with the offer's model", spawn["model"] == lua.eval("towTruckCalls.state.job.model"), spawn)
    check("spawn does not put the player in the car", opts["autoEnterVehicle"] is False and lua.eval("sim.player") == lua.eval("truck.id"))
    check("spawn clings to ground", opts["cling"] is True)
    check("spawn faces along the road", abs(abs(opts["rot"]["dir"]["x"]) + abs(opts["rot"]["dir"]["y"]) - 1) < 1e-6, opts["rot"])
    st = state(lua)
    check("job is en route", st["job"]["phase"] == "enroute" and st["job"]["typeLabel"] == "Flat tire", st["job"])
    check("call removed from the list", not st.get("offers"), st.get("offers"))
    check("GPS route set to the car", lua.eval("type(sim.routes[1]) == 'table'"))

    lua.execute("sim.step(0.1, 25)")
    car_id = lua.eval("towTruckCalls.state.job.vid")
    lua.execute(f"car = sim.vehicles[{car_id}]")
    check("car parking brake set", lua.eval("car.inputs.parkingbrake") == 1)
    check("car ignition off + hazards on", lua.eval("car.ignition") == 0 and lua.eval("car.hazards") == 1)
    check("flat tire call deflated one tire", lua.eval("#car.flats") == 1)
    check("beacon drawn over the car", lua.eval("sim.draws") > 0 and "TOW:" in (lua.eval("sim.drawText") or ""))

    # Drive next to the car.
    lua.execute("sim.drive(truck, car.pos + vec3(0, -12, 0.55) + car.fwd * 0, 25)")
    st = state(lua)
    check("on scene when close", st["job"]["phase"] == "onscene", st["job"])
    check("GPS cleared on scene", lua.eval("sim.routes[#sim.routes]") == "clear")
    lua.execute("truck.pos = car.pos + vec3(0, -14, 0.55); sim.step(0.1, 5)")
    st = state(lua)
    check("can't strap before loading", st["job"]["canStrap"] is False and "Load the car" in st["job"]["hint"], st["job"])

    # Load it on the flatbed: car sits on the deck, 1 m up.
    lua.execute("car.pos = truck.pos + vec3(0, -0.5, 1.0); car.fwd = vec3(truck.fwd); sim.step(0.1, 5)")
    st = state(lua)
    check("strap ready once loaded and stopped", st["job"]["canStrap"] is True, st["job"])
    check("no strap pop-up before 1.5 s", st["job"]["strapToken"] == 0)
    lua.execute("sim.step(0.1, 20)")
    check("strap minigame pops up by itself", state(lua)["job"]["strapToken"] == 1)
    lua.execute("sim.step(0.1, 30)")
    check("pops up only once", state(lua)["job"]["strapToken"] == 1)

    lua.execute("truck.vel = vec3(0, 3, 0); sim.step(0.1, 4)")
    st = state(lua)
    check("moving truck blocks strapping", st["job"]["canStrap"] is False and "Stop the truck" in st["job"]["hint"], st["job"])
    lua.execute("truck.vel = vec3(0, 0, 0); sim.step(0.1, 4)")

    check("DONE refused before strapping", lua.eval("towTruckCalls.state.job.canDone") is False)
    lua.execute("towTruckCalls.strapsDone(87)")
    st = state(lua)
    check("load secured after the minigame", st["job"]["phase"] == "secured" and st["job"]["quality"] == 87, st["job"])

    lua.execute("sim.step(0.1, 3)")
    st = state(lua)
    check("DONE needs some towing first", st["job"]["canDone"] is False and "Tow it somewhere" in st["job"]["hint"], st["job"])

    # Tow it 1 mile away in a dog-leg, the car riding on the deck.
    lua.execute("sim.drive(truck, truck.pos + vec3(0, 900, 0), 22, car)")
    lua.execute("sim.drive(truck, truck.pos + vec3(709, 0, 0), 22, car); sim.step(0.1, 3)")
    st = state(lua)
    check("still secured after the tow", st["job"]["phase"] == "secured", st["job"])
    towed = st["job"]["towed"]
    check("towed distance tracked", 1100 < towed < 1200, towed)
    check("DONE allowed when stopped", st["job"]["canDone"] is True, st["job"])

    # Scrape the car a little on the way: costs some of the pay.
    lua.execute("car.damage = car.damage + 1500")
    # Unload it behind the truck before saying DONE: that's fine.
    lua.execute("car.pos = truck.pos + vec3(-9, 0, -0.45); sim.step(0.1, 5)")
    st = state(lua)
    check("unloading at the drop-off is not 'came loose'", st["job"]["phase"] == "secured" and st["job"]["canDone"] is True, st["job"])
    lua.execute("car.pos = truck.pos + vec3(-40, 0, -0.45); sim.step(0.1, 5)")
    st = state(lua)
    check("DONE needs the car near the truck", st["job"]["canDone"] is False and "with your truck" in st["job"]["hint"], st["job"])
    lua.execute("car.pos = truck.pos + vec3(-9, 0, -0.45); sim.step(0.1, 5)")

    lua.execute("sim.player = car.id; sim.step(0.1, 2)")
    check("DONE refused from inside the customer's car", lua.eval("towTruckCalls.state.job.canDone") is False)
    lua.execute("sim.player = truck.id; sim.step(0.1, 2)")

    lua.execute("towTruckCalls.done()")
    st = state(lua)
    res = st.get("result")
    check("job finished", st.get("job") is None)
    check("result pop-up data", res and res["token"] == 1 and res["total"] > 0, res)
    lines = {l["label"]: l["amount"] for l in res["lines"]}
    pay = lua.eval("sim.spawns[1] and 0") or 0
    check("pay has call, mileage, response, straps", any("call" in k for k in lines) and "Mileage" in lines and any("response" in k for k in lines) and any("Straps" in k for k in lines), lines)
    check("total = sum of lines", res["total"] == sum(lines.values()), (res["total"], lines))
    check("damage on the way costs $30", lines.get("Damage to the car") == -30, lines)
    check("bank paid", st["bank"] == res["total"] and st["jobsDone"] == 1 and st["session"] == res["total"], st)
    check("saved to settings", py(lua.eval("sim.files['/settings/towTruckCalls.json']"))["bank"] == res["total"])
    check("job done toast", any("JOB DONE" in t["title"] for t in toasts(lua)))
    check("car ghosted for removal", lua.eval("car.ghost") is True)
    lua.execute("sim.step(0.05, 4)")
    check("car lifted off the truck", lua.eval("car.lifted") is True and lua.eval("car.deleted") is not True)
    lua.execute("sim.step(0.05, 10)")
    check("car deleted", lua.eval("car.deleted") is True)
    check("no 'car removed' warning for our own delete", not any("removed" in (t.get("msg") or "") for t in toasts(lua)), toasts(lua))
    check("truck untouched", lua.eval("truck.deleted") is None and lua.eval("sim.player") == lua.eval("truck.id"))
    print("     paid", res["total"], lines)


def lost_load():
    print("\n== Car comes loose, then the car gets deleted")
    lua, g = new_game()
    setup_world(lua)
    st, offer = first_offer(lua)
    lua.execute(f"towTruckCalls.accept({offer['id']})")
    lua.execute("car = sim.vehicles[towTruckCalls.state.job.vid]; sim.step(0.1, 40)")
    lua.execute("truck.pos = car.pos + vec3(0, -10, 0.55); sim.step(0.1, 3)")
    lua.execute("car.pos = truck.pos + vec3(0, -0.5, 1.0); sim.step(0.1, 5)")
    lua.execute("towTruckCalls.strapsDone(70)")
    check("secured", lua.eval("towTruckCalls.state.job.phase") == "secured")
    # Truck drives off, car stays behind.
    lua.execute("sim.drive(truck, truck.pos + vec3(0, 40, 0), 10)")
    lua.execute("sim.step(0.1, 15)")
    st = state(lua)
    check("lost load detected", st["job"]["phase"] == "onscene" and st["job"]["losses"] == 1, st["job"])
    check("came loose toast", any("loose" in t["title"] for t in toasts(lua)))
    check("strap again needed", st["job"].get("quality") is None)
    lua.execute("car:delete(); sim.step(0.1, 2)")
    st = state(lua)
    check("job cancelled when the car is deleted", st.get("job") is None)
    check("told why", any("removed" in (t.get("msg") or "") for t in toasts(lua)), toasts(lua))


def misc():
    print("\n== Decline, expire, duty, cancel, busy, failed spawn, no roads, fallback cars")
    lua, g = new_game()
    setup_world(lua)
    st, offer = first_offer(lua)
    lua.execute(f"towTruckCalls.decline({offer['id']})")
    check("decline removes the call", not state(lua).get("offers"))
    lua.execute("towTruckCalls.requestCall(); towTruckCalls.requestCall(); towTruckCalls.requestCall(); towTruckCalls.requestCall()")
    check("max 3 calls waiting", len(state(lua)["offers"]) == 3)
    check("full-list warning", any("already have" in (t.get("msg") or "") for t in toasts(lua)))
    lua.execute("towTruckCalls.state.callTimer = 1e9; sim.step(1, 160)")
    check("calls expire", not state(lua).get("offers"))
    lua.execute("towTruckCalls.toggleDuty(); towTruckCalls.state.callTimer = 0; sim.step(1, 100)")
    st = state(lua)
    check("off duty: no calls", st["duty"] is False and not st.get("offers"))
    lua.execute("towTruckCalls.toggleDuty(); sim.step(1, 10)")
    check("back on duty: calls again", len(state(lua).get("offers") or []) >= 1)

    o1 = state(lua)["offers"][0]
    lua.execute(f"towTruckCalls.accept({o1['id']})")
    lua.execute("towTruckCalls.requestCall()")
    o2 = state(lua)["offers"][0]
    lua.execute(f"towTruckCalls.accept({o2['id']})")
    check("can't take two jobs", lua.eval("towTruckCalls.state.job.id") == o1["id"] and any("Finish the job" in (t.get("msg") or "") for t in toasts(lua)))
    lua.execute("car = sim.vehicles[towTruckCalls.state.job.vid]; sim.step(0.1, 5)")
    lua.execute("sim.player = car.id; towTruckCalls.cancel(); sim.step(0.05, 15)")
    check("cancel ends the job", state(lua).get("job") is None)
    check("cancel puts you back in your truck", lua.eval("sim.player") == lua.eval("truck.id"))
    check("cancel removes the car", lua.eval("car.deleted") is True)

    lua.execute("towTruckCalls.requestCall(); sim.failSpawn = true")
    o3 = state(lua)["offers"][-1]
    lua.execute(f"towTruckCalls.accept({o3['id']})")
    check("failed spawn handled", state(lua).get("job") is None and any("could not be spawned" in (t.get("msg") or "") for t in toasts(lua)))
    lua.execute("sim.failSpawn = false")

    # Map without a road network.
    lua.execute("sim.flatMap = true; towTruckCalls.state.offers = {}; towTruckCalls.requestCall()")
    st = state(lua)
    check("calls on maps with no roads", len(st.get("offers") or []) == 1 and 100 < st["offers"][0]["dist"] < 320, st.get("offers"))
    lua.execute("sim.flatMap = false")

    # Car list: fallback list only has models the game knows.
    names = set()
    for _ in range(30):
        lua.execute("towTruckCalls.state.offers = {}; towTruckCalls.requestCall()")
        names.add(state(lua)["offers"][0]["vehicle"])
    check("fallback cars are real models with names", names <= {"Ibishu Covet", "Ibishu Pessima", "Gavril Grand Marshal"} and len(names) >= 2, names)

    # Car list from the game's config list.
    lua2, g2 = new_game()
    lua2.execute("""
      util_configListGenerator = {getEligibleVehicles = function() return {
        {model_key = 'etk800', key = 'base_m', Type = 'Car', Brand = 'ETK', Name = '800-Series', Population = 5},
        {model_key = 'pickup', key = 'd15', Type = 'Truck', ['Body Style'] = 'Pickup', Brand = 'Gavril', Name = 'D-Series', Population = 5},
        {model_key = 'semi', key = 't65', Type = 'Truck', Brand = 'Gavril', Name = 'T-Series', Population = 50},
        {model_key = 'citybus', key = 'base', Type = 'Car', ['Body Style'] = 'Bus', Brand = 'Wentward', Name = 'DT40L', Population = 50},
        {model_key = 'van', key = 'v1', Type = 'Truck', ['Body Style'] = 'Van', Brand = 'Gavril', Name = 'H-Series', Population = 50},
        {model_key = 'covet', key = 'rare', Type = 'Car', Brand = 'Ibishu', Name = 'Covet', Population = 0},
      } end}""")
    setup_world(lua2)
    seen = set()
    for _ in range(40):
        lua2.execute("towTruckCalls.state.offers = {}; towTruckCalls.requestCall()")
        o = py(lua2.eval("towTruckCalls.state.offers[1]"))
        seen.add((o["model"], o["config"], o["vehicle"]))
    check("game car list filtered to cars and pickups", seen == {("etk800", "base_m", "ETK 800-Series"), ("pickup", "d15", "Gavril D-Series")}, seen)
    lua2.execute("towTruckCalls.state.offers = {}; towTruckCalls.requestCall()")
    oid = lua2.eval("towTruckCalls.state.offers[1].id")
    lua2.execute(f"towTruckCalls.accept({oid})")
    check("config passed to spawn", py(lua2.eval("sim.spawns[1]"))["opts"].get("config") in ("base_m", "d15"))

    # Out of the level: nothing happens.
    lua2.execute("towTruckCalls.onClientEndMission(); sim.level = nil; towTruckCalls.state.callTimer = 0; sim.step(1, 30)")
    st = state(lua2)
    check("level unload clears the job", st.get("job") is None and not st.get("offers") and st["inLevel"] is False, st)

    # Saved money is loaded back.
    lua3, g3 = new_game()
    lua3.execute("sim.files['/settings/towTruckCalls.json'] = {bank = 950, jobsDone = 4, towedMeters = 8000, duty = false}")
    setup_world(lua3)
    st = state(lua3)
    check("save loaded", st["bank"] == 950 and st["jobsDone"] == 4 and st["duty"] is False, st)


def wheel_lift():
    print("\n== Wheel lift tow (car behind the truck, front end up, swinging in turns)")
    lua, g = new_game()
    setup_world(lua)
    st, offer = first_offer(lua)
    force_type(lua, "accident")
    lua.execute(f"towTruckCalls.accept({offer['id']})")
    lua.execute("car = sim.vehicles[towTruckCalls.state.job.vid]; sim.step(0.1, 40)")
    check("accident call: two flat tires", lua.eval("#car.flats") == 2)
    # Truck backs up to the car, car hangs off the back, front lifted 0.3 m.
    lua.execute("truck.fwd = vec3(0, 1, 0); truck.pos = car.pos + vec3(0, 6.2, 0.55); car.fwd = vec3(0, 1, 0)")
    lua.execute("car.pos = car.pos + vec3(0, 0, 0.3); sim.step(0.1, 25)")
    st = state(lua)
    check("wheel lift counts as loaded", st["job"]["canStrap"] is True, st["job"])
    check("pop-up on wheel lift", st["job"]["strapToken"] == 1, st["job"])
    lua.execute("towTruckCalls.strapsDone(95)")
    # Car swings 2 m sideways in a turn: still attached.
    lua.execute("car.pos = car.pos + vec3(2.0, 0.5, 0); sim.step(0.1, 20)")
    check("swing in a turn is not 'came loose'", lua.eval("towTruckCalls.state.job.phase") == "secured")


def trailer():
    print("\n== Pickup with a car trailer")
    lua, g = new_game()
    lua.execute("""
      truck = sim.addVehicle('pickup', vec3(0, 0, 1.0), vec3(0, 1, 0), vec3(1.0, 2.7, 0.9))
      trailer = sim.addVehicle('car_trailer', vec3(0, -6.0, 0.7), vec3(0, 1, 0), vec3(1.1, 3.0, 0.4))
      sim.player = truck.id
      towTruckCalls.onExtensionLoaded()""")
    st, offer = first_offer(lua)
    lua.execute(f"towTruckCalls.accept({offer['id']}); car = sim.vehicles[towTruckCalls.state.job.vid]; sim.step(0.1, 40)")
    lua.execute("truck.fwd = vec3(0, 1, 0); trailer.fwd = vec3(0, 1, 0); truck.pos = car.pos + vec3(-3.5, 14, 0.55); trailer.pos = truck.pos + vec3(0, -6.0, -0.3); sim.step(0.1, 5)")
    check("arrived with the trailer", lua.eval("towTruckCalls.state.job.phase") == "onscene")
    st = state(lua)
    check("car beside the trailer is not loaded", st["job"]["canStrap"] is False, st["job"])
    lua.execute("car.pos = trailer.pos + vec3(0, -0.3, 0.8); car.fwd = vec3(0, 1, 0); sim.step(0.1, 25)")
    st = state(lua)
    check("car on the trailer counts as loaded", st["job"]["canStrap"] is True, st["job"])
    check("pop-up for a car on a trailer", st["job"]["strapToken"] == 1, st["job"])
    lua.execute("towTruckCalls.strapsDone(80)")
    check("strapped to the trailer", lua.eval("towTruckCalls.state.job.carrierId") == lua.eval("trailer.id"))
    lua.execute("sim.drive(truck, truck.pos + vec3(0, 500, 0), 20, {trailer, car}); sim.step(0.1, 4)")
    st = state(lua)
    check("still secured after towing on the trailer", st["job"]["phase"] == "secured" and st["job"]["canDone"] is True, st["job"])
    lua.execute("towTruckCalls.done(); sim.step(0.05, 20)")
    st = state(lua)
    check("trailer job paid", st.get("job") is None and st["bank"] > 0, st)
    check("trailer and truck kept, car removed", lua.eval("trailer.deleted") is None and lua.eval("truck.deleted") is None and lua.eval("car.deleted") is True)


def main():
    full_job()
    trailer()
    lost_load()
    misc()
    wheel_lift()
    print()
    if FAILS:
        print(f"{len(FAILS)} FAILED:", FAILS)
        sys.exit(1)
    print("All Tow Truck Calls checks passed.")


if __name__ == "__main__":
    main()
