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
try("Rail delivery on Office4", function()
	assert(Site.handle(player, "Start", "Office4", "new", nil))
	local ok, msg = Delivery.request(player, "BM-W21x44-9000", 10, "rail")
	py_print("   " .. tostring(ok) .. " " .. tostring(msg))
	assert(ok, msg)
	local cars = 0
	for _, t in ipairs(workspace.SteelriseSite.Trailers:GetChildren()) do
		if t:GetAttribute("Kind") == "rail" then cars = cars + 1 end
	end
	py_print("   railcars=" .. cars)
	local ok2, msg2 = Delivery.request(player, "BM-W21x44-9000", 2, "rail")
	py_print("   second: " .. tostring(ok2) .. " " .. tostring(msg2))
	local ok3, msg3 = Delivery.request(player, "BM-W21x44-9000", 2, "rail")
	py_print("   third: " .. tostring(ok3) .. " " .. tostring(msg3))
	local snap = Save.snapshot()
	local rail = 0
	for _, t in ipairs(snap.trailers) do if t.kind == "rail" then rail = rail + 1 end end
	py_print("   saved railcars=" .. rail)
end)
try("Rail delivery refused on Empty Land", function()
	assert(Site.handle(player, "Start", "EmptyLand", "new", nil))
	local ok, msg = Delivery.request(player, "BM-W16x31-6000", 2, "rail")
	py_print("   " .. tostring(ok) .. " " .. tostring(msg))
	assert(not ok)
end)
try("Pour and finish a slab on Office3 level 2", function()
	local fakeT = 1000
	os.clock = function() fakeT = fakeT + 0.5 return fakeT end
	assert(Site.handle(player, "Start", "Office3", "new", nil))
	local BuildRules = require(game.ReplicatedStorage.Steelrise.BuildRules)
	local world = Site.current.world
	-- the real mock raycast only knows the ground; give it the components for this test
	local deck
	for _, m in ipairs(workspace.SteelriseSite.Components:GetChildren()) do
		if m:GetAttribute("ItemId"):sub(1, 3) == "DK-" and m:GetPivot().Y > 20 and m:GetAttribute("State") == "Installed" then deck = m break end
	end
	assert(deck, "no level-2 deck")
	local def, cf, why = BuildRules.solveSlab(world, { point = deck:GetPivot().Position, hit = deck.PrimaryPart })
	py_print("   solveSlab: " .. tostring(def and def.id) .. " " .. tostring(why))
	assert(def, why)
	Components.equip(player, "TL-POUR")
	player.Character.HumanoidRootPart.CFrame = cf + Vector3.new(0, 3, 0)
	local ok, msg = Components.pour(player, def.id, cf)
	py_print("   pour: " .. tostring(ok) .. " " .. tostring(msg))
	assert(ok, msg)
	local slab
	for _, m in ipairs(workspace.SteelriseSite.Components:GetChildren()) do
		if m:GetAttribute("ItemId") == def.id and m:GetAttribute("State") == "Placed" then slab = m end
	end
	local ok2, msg2 = Components.pour(player, def.id, cf)
	py_print("   pour again: " .. tostring(ok2) .. " " .. tostring(msg2))
	assert(not ok2)
	Components.equip(player, "TL-TROWEL")
	local id = slab:GetAttribute("ComponentId")
	for i = 1, 4 do
		local fp = slab:GetPivot() * (def.fasteners[i].pos * 3)
		player.Character.HumanoidRootPart.CFrame = CFrame.new(fp + Vector3.new(0, 3, 0))
		os_clock_bump = (os_clock_bump or 0) + 1
		local okf, mf = Components.fasten(player, id, i)
		if not okf then py_print("   fasten " .. i .. ": " .. tostring(mf)) end
	end
	py_print("   slab state: " .. tostring(slab:GetAttribute("State")) .. " colour R=" .. string.format("%.2f", slab.Concrete.Color.R))
end)
try("Run delayed callbacks", function()
	for _, d in ipairs(M.delayed) do d.f(table.unpack(d.args)) end
end)
