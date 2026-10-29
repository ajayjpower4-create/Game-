-- STEELRISE server bootstrap: creates remotes, wires services together and
-- loads the Empty Land site as the menu backdrop.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Steelrise")
local Remotes = require(Shared.Remotes)
Remotes.init()

Players.CharacterAutoLoads = false

local services = {
	Packing = require(script.Parent.Packing),
	Components = require(script.Parent.ComponentService),
	Delivery = require(script.Parent.DeliveryService),
	Crane = require(script.Parent.CraneService),
	Save = require(script.Parent.SaveService),
	Site = require(script.Parent.SiteService),
}

for _, name in ipairs({ "Components", "Delivery", "Crane", "Save", "Site" }) do
	services[name].init(services)
end

-- Per-player request budget so a misbehaving client can't flood the server.
local budget = {}
local function allow(player)
	local t = os.clock()
	local b = budget[player]
	if not b or t - b.t > 1 then
		budget[player] = { t = t, n = 1 }
		return true
	end
	b.n += 1
	return b.n <= 25
end
Players.PlayerRemoving:Connect(function(p)
	budget[p] = nil
end)

local function bind(name, handler)
	Remotes.get(name).OnServerInvoke = function(player, ...)
		if not allow(player) then
			return false, "Slow down."
		end
		local results = table.pack(xpcall(handler, debug.traceback, player, ...))
		if not results[1] then
			warn("[STEELRISE] " .. name .. " error:", results[2])
			local first = string.match(tostring(results[2]), "^[^\n]+") or tostring(results[2])
			return false, "Server error: " .. first
		end
		return table.unpack(results, 2, results.n)
	end
end

bind("Menu", function(player, action)
	if action == "Info" then
		return true, nil, services.Site.menuInfo(player)
	end
	return false, "Unknown action."
end)
bind("Site", services.Site.handle)
bind("Delivery", services.Delivery.handle)
bind("Handle", services.Components.handle)
bind("Build", services.Components.build)
bind("Crane", services.Crane.handle)
bind("Save", services.Save.handle)

Players.PlayerAdded:Connect(function(player)
	player.ReplicationFocus = services.Site.focusPart()
end)

-- Menu backdrop / default site
local ok, err = pcall(services.Site.load, "EmptyLand", nil, nil)
if not ok then
	warn("[STEELRISE] failed to build default site:", err)
end
for _, player in ipairs(Players:GetPlayers()) do
	player.ReplicationFocus = services.Site.focusPart()
end

print("[STEELRISE] server ready")
