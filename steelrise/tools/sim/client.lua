-- Boots the server, then runs the client scripts against it in one Lua state.
local M = M_RBX
local errors = 0
local function report(label, err)
	errors = errors + 1
	py_print("FAIL " .. label .. "\n" .. tostring(err))
end

-- cooperative scheduler -------------------------------------------------------
local waiting, delayed = {}, {}
local clock = 0
local function resume(co, ...)
	local ok, err = coroutine.resume(co, ...)
	if not ok then report("coroutine", debug.traceback(co, err)) end
end
task = {
	spawn = function(f, ...) local co = type(f) == "thread" and f or coroutine.create(f); resume(co, ...); return co end,
	defer = function(f, ...) return task.spawn(f, ...) end,
	delay = function(t, f, ...) table.insert(delayed, { at = clock + (t or 0), f = f, args = table.pack(...) }) end,
	wait = function(t)
		local co, main = coroutine.running()
		if main then return 0 end
		table.insert(waiting, { co = co, at = clock + (t or 0) })
		coroutine.yield()
		return t or 0
	end,
	cancel = function() end,
}
workspace.GetServerTimeNow = function() return clock end
os.clock = function() return clock end

local frameSignals = {}
local rs = game:GetService("RunService")
for _, n in ipairs({ "Heartbeat", "RenderStepped", "Stepped" }) do frameSignals[n] = rs[n] end
local renderSteps = {}
rs.BindToRenderStep = function(self, name, prio, fn) renderSteps[name] = fn end
rs.UnbindFromRenderStep = function(self, name) renderSteps[name] = nil end

local function pump(frames)
	for _ = 1, frames do
		clock = clock + 1 / 30
		local w = waiting
		waiting = {}
		for _, e in ipairs(w) do
			if e.at <= clock then resume(e.co) else table.insert(waiting, e) end
		end
		local d = delayed
		delayed = {}
		for _, e in ipairs(d) do
			if e.at <= clock then
				task.spawn(e.f, table.unpack(e.args, 1, e.args.n))
			else
				table.insert(delayed, e)
			end
		end
		for name, sig in pairs(frameSignals) do
			for _, h in ipairs(sig.handlers) do
				local ok, err = xpcall(h, debug.traceback, 1 / 30)
				if not ok then report(name .. " handler", err) return end
			end
		end
		for name, fn in pairs(renderSteps) do
			local ok, err = xpcall(fn, debug.traceback, 1 / 30)
			if not ok then report("RenderStep " .. name, err) return end
		end
	end
end

-- remotes call straight through to the server --------------------------------
local Inst = M.Inst
local localPlayer
Inst.InvokeServer = function(self, ...)
	local h = rawget(self, "_p").OnServerInvoke
	assert(h, "no OnServerInvoke for " .. self.Name)
	return h(localPlayer, ...)
end
Inst.FireServer = function(self, ...) self.OnServerEvent:Fire(localPlayer, ...) end
Inst.FireAllClients = function(self, ...) self.OnClientEvent:Fire(...) end
Inst.FireClient = function(self, p, ...) self.OnClientEvent:Fire(...) end
M.log = function() end

-- boot server ----------------------------------------------------------------
M.isServer = true
local main
for _, d in ipairs(game.ServerScriptService:GetDescendants()) do if d.Name == "Main" then main = d end end
local ok, err = xpcall(M.runScript, debug.traceback, main)
if not ok then report("server boot", err) end
M.isServer = false

-- local player & client services ----------------------------------------------
localPlayer = Instance.new("Player")
localPlayer.Name = "Tester"
localPlayer.UserId = 42
localPlayer.DisplayName = "Tester"
local pg = Instance.new("PlayerGui", localPlayer)
pg.Name = "PlayerGui"
table.insert(M.players, localPlayer)
localPlayer.Parent = game.Players
game.Players.LocalPlayer = localPlayer
localPlayer.CameraMode = Enum.CameraMode.Classic
localPlayer.CameraMinZoomDistance = 0.5
localPlayer.CameraMaxZoomDistance = 400
Inst.RequestStreamAroundAsync = function() end

local cam = Instance.new("Camera", workspace)
cam.Name = "Camera"
cam.CFrame = CFrame.new(0, 50, 100)
cam.FieldOfView = 70
cam.ViewportSize = Vector2.new(1920, 1080)
cam.CameraType = Enum.CameraType.Custom
workspace.CurrentCamera = cam
Inst.ViewportPointToRay = function(self, x, y) return { Origin = self.CFrame.Position, Direction = self.CFrame.LookVector } end
Inst.ScreenPointToRay = Inst.ViewportPointToRay

local uis = Instance.new("UserInputService", game)
uis.Name = "UserInputService"
M.services.UserInputService = uis
uis.MouseBehavior = Enum.MouseBehavior.Default
uis.MouseIconEnabled = true
uis.MouseDeltaSensitivity = 1
uis.GetMouseLocation = function() return Vector2.new(960, 540) end
uis.GetMouseDelta = function() return Vector2.new(0, 0) end
uis.IsKeyDown = function() return false end
uis.IsMouseButtonPressed = function() return false end
local cas = Instance.new("ContextActionService", game)
cas.Name = "ContextActionService"
M.services.ContextActionService = cas
cas.BindActionAtPriority = function() end
cas.UnbindAction = function() end
game:GetService("StarterGui").SetCoreGuiEnabled = function() end
game:GetService("StarterGui").SetCore = function() end
local cp = game:GetService("ContentProvider")
cp.PreloadAsync = function(self, list, cb) for _, i in ipairs(list) do if cb then cb("asset", Enum.AssetFetchStatus.Success) end end end
game.IsLoaded = function() return true end
local ts = game:GetService("TweenService")
ts.Create = function(self, inst, info, props) return { Play = function() for k, v in pairs(props) do inst[k] = v end end, Completed = M.signal() } end
local hs = game:GetService("HttpService")
hs.JSONDecode = function() return {} end

-- run client scripts -------------------------------------------------------------
local loading = game.ReplicatedFirst:FindFirstChild("LoadingScreen", true)
task.spawn(function()
	local ok2, e = xpcall(M.runScript, debug.traceback, loading)
	if not ok2 then report("LoadingScreen", e) end
end)
local clientMain
for _, d in ipairs(game.StarterPlayer:GetDescendants()) do if d.Name == "ClientMain" then clientMain = d end end
task.spawn(function()
	local ok2, e = xpcall(M.runScript, debug.traceback, clientMain)
	if not ok2 then report("ClientMain", e) end
end)
pump(200)
py_print("loader done=" .. tostring(localPlayer:GetAttribute("SR_LoaderDone")) .. " menuReady=" .. tostring(localPlayer:GetAttribute("SR_MenuReady")))
local loadingGui = pg:FindFirstChild("SR_Loading")
py_print("loading gui still present: " .. tostring(loadingGui ~= nil))

-- find a button by its text under a gui and click it
local function findText(root, pattern)
	for _, d in ipairs(root:GetDescendants()) do
		local t = rawget(d, "_p").Text
		if type(t) == "string" and t:find(pattern) and rawget(d, "_p").ClassName == "TextButton" then return d end
	end
end
local menu = pg:FindFirstChild("SR_Menu")
py_print("menu enabled=" .. tostring(menu and menu.Enabled))
local play = findText(menu, "^PLAY")
py_print("play button: " .. tostring(play and play.Text))
local okc, errc = xpcall(function() play.MouseButton1Click:Fire() end, debug.traceback)
if not okc then report("click Play", errc) end
pump(120)
local overlayLabel
for _, d in ipairs(menu:GetDescendants()) do if d.Name == "Label" then overlayLabel = d end end
py_print("after Play: menu enabled=" .. tostring(menu.Enabled) .. " busy text=" .. tostring(overlayLabel and overlayLabel.Text))
local hud = pg:FindFirstChild("SR_HUD")
py_print("hud enabled=" .. tostring(hud and hud.Enabled) .. " character=" .. tostring(localPlayer.Character ~= nil))

-- keyboard: open catalog, request delivery, pause menu
local function key(code)
	local ok3, e3 = xpcall(function() uis.InputBegan:Fire({ KeyCode = Enum.KeyCode[code], UserInputType = Enum.UserInputType.Keyboard }, false) end, debug.traceback)
	if not ok3 then report("key " .. code, e3) end
	pump(5)
end
key("Tab")
local cat = pg:FindFirstChild("SR_Catalog")
local order = findText(cat, "REQUEST DELIVERY")
key("Tab")
key("P")
key("P")
key("F1")
key("F1")
key("Two")
key("Five")
pump(60)
key("X")
pump(30)
py_print(("done, %d failure(s)"):format(errors))
