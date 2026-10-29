-- Single place that defines every network endpoint.
-- The server creates them at boot; clients wait for them.
--
-- Functions (client -> server, returns ok, message, data):
--   Menu      : ("Info") | ("Slots")                     menu data, save summaries
--   Site      : ("Start", siteId, mode, slot)            mode = "new" | "continue" | "join"
--   Delivery  : ("Request", itemId, qty) | ("Dismiss", trailerId)
--   Handle    : ("PickUp", id) | ("Drop") | ("Place", id, cframe, freeMode) | ("Release", strapId)
--   Build     : ("Fasten", id, index) | ("Dismantle", id) | ("Equip", toolId)
--   Crane     : ("Enter", craneId) | ("Remote", craneId) | ("Exit") | ("Attach", componentId)
--               | ("Release") | ("Land", cframe) | ("Recover")
--   Save      : ("Save", slot) | ("Settings", table) | ("Favorite", itemId, on)
-- Events:
--   CraneStream (unreliable, client -> server) : operator state stream
--   Notify      (server -> client)             : (text, kind)
--   FX          (server -> clients)            : (kind, position, extra)
--   Progress    (server -> clients)            : (eventName, data) used by tutorial/task panel

local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Remotes = {}

local FUNCTIONS = { "Menu", "Site", "Delivery", "Handle", "Build", "Crane", "Save" }
local EVENTS = { "Notify", "FX", "Progress" }
local UNRELIABLE = { "CraneStream" }

local folder

local function getFolder()
	if folder then
		return folder
	end
	if RunService:IsServer() then
		folder = ReplicatedStorage:FindFirstChild("SteelriseRemotes")
		if not folder then
			folder = Instance.new("Folder")
			folder.Name = "SteelriseRemotes"
			for _, name in ipairs(FUNCTIONS) do
				local f = Instance.new("RemoteFunction")
				f.Name = name
				f.Parent = folder
			end
			for _, name in ipairs(EVENTS) do
				local e = Instance.new("RemoteEvent")
				e.Name = name
				e.Parent = folder
			end
			for _, name in ipairs(UNRELIABLE) do
				local e = Instance.new("UnreliableRemoteEvent")
				e.Name = name
				e.Parent = folder
			end
			folder.Parent = ReplicatedStorage
		end
	else
		folder = ReplicatedStorage:WaitForChild("SteelriseRemotes", 30)
		if not folder then
			error("[STEELRISE] Remotes folder never replicated - is the server script running?")
		end
	end
	return folder
end

function Remotes.get(name)
	local f = getFolder()
	if RunService:IsServer() then
		return f:FindFirstChild(name)
	end
	return f:WaitForChild(name, 30)
end

function Remotes.init()
	getFolder()
end

return Remotes
