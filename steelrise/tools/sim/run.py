"""Runs STEELRISE server code inside a mocked Roblox engine (Lua 5.4 via lupa)."""
import json, os, re, sys
from lupa import lua54

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = sys.argv[1]
SCENARIO = sys.argv[2] if len(sys.argv) > 2 else "server"

COMPOUND = re.compile(r'^(\s*)([A-Za-z_][\w\.\[\]"\':#]*?)\s*(\+|-|\*|/|\.\.|%)=\s*(.+?)\s*$', re.M)


def luau_to_lua(src):
    return COMPOUND.sub(lambda m: f"{m.group(1)}{m.group(2)} = {m.group(2)} {m.group(3)} ({m.group(4)})", src)


lua = lua54.LuaRuntime(unpack_returned_tuples=True)
lua.execute(open(os.path.join(HERE, "rbx.lua")).read().replace("local M = {}", "M_RBX = {}\nlocal M = M_RBX", 1).replace("return M\n", ""))

sources = {}


def load_source(path):
    with open(path, encoding="utf-8") as fh:
        return luau_to_lua(fh.read())


lua.globals().py_source = lambda p: load_source(p)
lua.globals().py_print = print
lua.globals().py_json_encode = lambda s: s
lua.execute(r'''
local M = M_RBX
local new = M.Instance_new
game = new("DataModel"); game.Name = "Game"
M.services = {}
local function svc(name, cls)
  local s = new(cls or name, game); s.Name = name; M.services[name] = s; return s
end
workspace = svc("Workspace")
M.workspace = workspace
local terrain = new("Terrain", workspace); terrain.Name = "Terrain"
workspace.Gravity = 196.2
svc("ReplicatedStorage"); svc("ReplicatedFirst"); svc("ServerScriptService"); svc("StarterPlayer")
svc("Lighting"); svc("SoundService"); svc("TweenService"); svc("ContentProvider"); svc("Debris"); svc("StarterGui")
local players = svc("Players")
M.players = {}
local rs = svc("RunService")
rs.IsServer = function() return M.isServer end
rs.IsClient = function() return not M.isServer end
rs.IsStudio = function() return true end
rs.BindToRenderStep = function() end
local http = svc("HttpService")
local guid = 0
http.GenerateGUID = function() guid = guid + 1; return string.format("guid-%06d", guid) end
http.JSONEncode = function(self, t) return "json" end
http.JSONDecode = function(self, s) return {} end
local ds = svc("DataStoreService")
ds.GetDataStore = function() error("DataStore API not available in mock") end
game.BindToClose = function() end
local tween = M.services.TweenService
tween.Create = function() return { Play = function() end, Completed = M.signal() } end
local debris = M.services.Debris
debris.AddItem = function() end

-- workspace queries: flat ground at y = 0 counts as Terrain
workspace.Raycast = function(self, origin, dir, params)
  if dir.Y < 0 and origin.Y >= 0 and origin.Y + dir.Y <= 0 then
    local t = -origin.Y / dir.Y
    local pos = origin + dir * t
    return { Instance = terrain, Position = Vector3.new(pos.X, 0, pos.Z), Normal = Vector3.yAxis, Distance = (dir * t).Magnitude, Material = Enum.Material.Ground }
  end
  return nil
end
workspace.GetPartBoundsInBox = function(self, cf, size, params)
  assert(typeof(cf) == "CFrame" and typeof(size) == "Vector3", "GetPartBoundsInBox args")
  return {}
end
workspace.GetServerTimeNow = function() return os.clock() end

-- task
local delayed = {}
task = {
  spawn = function(f, ...) local co = coroutine.create(f); local ok, err = coroutine.resume(co, ...); if not ok then error(err, 0) end; return co end,
  defer = function(f, ...) return task.spawn(f, ...) end,
  delay = function(t, f, ...) table.insert(delayed, { f = f, args = { ... } }) end,
  wait = function(t) if coroutine.isyieldable() then coroutine.yield() end return t or 0 end,
}
M.delayed = delayed
tick = os.clock
time = os.clock

-- build the script tree
local function addScript(parent, cls, name, path)
  local s = new(cls, parent); s.Name = name; rawget(s, "_p")._path = path; return s
end
M.addScript = addScript
local cache = {}
function require(mod)
  if cache[mod] ~= nil then return cache[mod] end
  local path = rawget(mod, "_p")._path
  assert(path, "require on non-module " .. tostring(mod))
  local env = setmetatable({ script = mod }, { __index = _G, __newindex = function(t, k, v) error("assignment to global '" .. k .. "' in " .. path, 2) end })
  local fn, err = load(py_source(path), "@" .. path:match("[^/]+/[^/]+$"), "t", env)
  if not fn then error(err) end
  local result = fn()
  cache[mod] = result
  return result
end
function M.runScript(s)
  local path = rawget(s, "_p")._path
  local env = setmetatable({ script = s }, { __index = _G, __newindex = function(t, k, v) error("assignment to global '" .. k .. "' in " .. path, 2) end })
  local fn, err = load(py_source(path), "@" .. path:match("[^/]+/[^/]+$"), "t", env)
  if not fn then error(err) end
  return fn()
end
''')

# mirror default.project.json
project = json.load(open(os.path.join(PROJ, "default.project.json")))
G = lua.globals()
add = G.M_RBX.addScript
scripts = []


def build(parent, path):
    full = os.path.join(PROJ, path)
    for f in sorted(os.listdir(full)):
        p = os.path.join(full, f)
        if os.path.isdir(p):
            folder = G.Instance.new("Folder", parent)
            folder.Name = f
            build(folder, os.path.join(path, f))
        elif f.endswith(".server.lua"):
            scripts.append(("server", add(parent, "Script", f[:-11], p)))
        elif f.endswith(".client.lua"):
            scripts.append(("client", add(parent, "LocalScript", f[:-11], p)))
        elif f.endswith(".lua"):
            add(parent, "ModuleScript", f[:-4], p)


def svc(name):
    return G.M_RBX.services[name]


for name, spec in project["tree"].items():
    if name.startswith("$"):
        continue
    for child, cspec in spec.items():
        if child.startswith("$") or "$path" not in cspec and not any(not k.startswith("$") for k in cspec):
            continue
        target = svc(name)
        if "$path" in cspec:
            folder = G.Instance.new("Folder", target)
            folder.Name = child
            fp = os.path.join(PROJ, cspec["$path"])
            if os.path.isdir(fp):
                build(folder, cspec["$path"])
            else:
                folder.Parent = None
                kind = "LocalScript" if fp.endswith(".client.lua") else ("Script" if fp.endswith(".server.lua") else "ModuleScript")
                add(target, kind, child, fp)
        else:
            sub = G.Instance.new(cspec.get("$className", "Folder"), target)
            sub.Name = child
            for gc, gspec in cspec.items():
                if gc.startswith("$"):
                    continue
                folder = G.Instance.new("Folder", sub)
                folder.Name = gc
                build(folder, gspec["$path"])

G.M_RBX.isServer = True
lua.execute(open(os.path.join(HERE, SCENARIO + ".lua")).read())
