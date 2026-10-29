local M = M_RBX
local function try(label, fn, ...)
	local ok, err = xpcall(fn, debug.traceback, ...)
	if ok then
		py_print("OK   " .. label)
	else
		py_print("FAIL " .. label .. "\n" .. tostring(err))
	end
	return ok, err
end

-- boot the server Main script
local main
for _, d in ipairs(game.ServerScriptService:GetDescendants()) do
	if d.Name == "Main" then main = d end
end
M.log = function(kind, name, a, b)
	if name == "Notify" then py_print("   notify: " .. tostring(a) .. " [" .. tostring(b) .. "]") end
end
try("Main.server boot", M.runScript, main)

local SS = game.ServerScriptService.Steelrise
local Site = require(SS.SiteService)
local Components = require(SS.ComponentService)
local Crane = require(SS.CraneService)
local Delivery = require(SS.DeliveryService)
local Save = require(SS.SaveService)

local site = workspace:FindFirstChild("SteelriseSite")
py_print("site after boot: " .. tostring(site and site:GetAttribute("SiteId")) .. " ready=" .. tostring(site and site:GetAttribute("Ready")))

-- a player
local player = Instance.new("Player")
player.Name = "Tester"
player.UserId = 42
player.DisplayName = "Tester"
player.Character = nil
player.ReplicationFocus = nil
table.insert(M.players, player)
player.Parent = game.Players

try("Menu info", function()
	local info = Site.menuInfo(player)
	py_print("   items=" .. info.itemCount)
end)

local Sites = require(game.ReplicatedStorage.Steelrise.Sites)
for _, id in ipairs(Sites.Order) do
	try("Start " .. id, function()
		local ok, msg, data = Site.handle(player, "Start", id, "new", nil)
		if not ok then error("handle returned false: " .. tostring(msg)) end
		local s = workspace:FindFirstChild("SteelriseSite")
		local comps = #s.Components:GetChildren()
		local parts = #s:GetDescendants()
		py_print(("   components=%d  instances=%d  trailers=%d  next=%s"):format(comps, parts, #s.Trailers:GetChildren(), tostring(s:GetAttribute("NextTask"))))
	end)
end

-- gameplay smoke test on Empty Land
try("Start EmptyLand again", function()
	assert(Site.handle(player, "Start", "EmptyLand", "new", nil))
end)
try("Save slot 1", function()
	local ok, msg = Save.saveSlot(player, 1, true)
	py_print("   " .. tostring(ok) .. " " .. tostring(msg))
	assert(ok)
end)
try("Continue slot 1", function()
	local ok, msg = Site.handle(player, "Start", nil, "continue", 1)
	if not ok then error(msg) end
	py_print("   components=" .. #workspace.SteelriseSite.Components:GetChildren())
end)
try("Delivery request", function()
	local ok, msg = Delivery.request(player, "BM-W18x35-7500", 4)
	py_print("   " .. tostring(ok) .. " " .. tostring(msg))
	assert(ok)
end)
try("Crane enter (remote) + attach attempt", function()
	Components.equip(player, "TL-REMOTE")
	local ok, msg = Crane.enter(player, "1", "Remote")
	py_print("   enter " .. tostring(ok) .. " " .. tostring(msg))
	Crane.onStream(player, "1", { slew = 0.1, trolley = 60, hoist = 30, swingX = 0, swingZ = 0, loadYaw = 0, seq = 0 })
	local some
	for _, m in ipairs(workspace.SteelriseSite.Components:GetChildren()) do some = m end
	py_print("   attach: " .. tostring(select(2, Crane.attach(player, some:GetAttribute("ComponentId")))))
	Crane.recover(player)
	Crane.exit(player)
end)
try("Pick up + drop a light item", function()
	local hrp = player.Character.HumanoidRootPart
	for _, m in ipairs(workspace.SteelriseSite.Components:GetChildren()) do
		if m:GetAttribute("ItemId") == "SC-BASEJACK" then
			hrp.CFrame = m:GetPivot() + Vector3.new(0, 3, 2)
			local ok, msg = Components.pickUp(player, m:GetAttribute("ComponentId"))
			py_print("   pickup " .. tostring(ok) .. " " .. tostring(msg))
			if ok then
				local target = CFrame.new(hrp.Position.X + 3, 0, hrp.Position.Z)
				local ok2, msg2 = Components.place(player, m:GetAttribute("ComponentId"), target, false)
				py_print("   place " .. tostring(ok2) .. " " .. tostring(msg2))
				if not ok2 then assert(Components.dropCarried(player)) end
			end
			break
		end
	end
end)
try("Run delayed callbacks", function()
	for _, d in ipairs(M.delayed) do d.f(table.unpack(d.args)) end
end)
