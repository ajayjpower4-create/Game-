-- Saves and settings.
--
-- Keys per player:  u<UserId>:meta            settings, favourites, slot summaries
--                   u<UserId>:slot<n>         site snapshot (0 = autosave, 1..3 manual)
--
-- If DataStores are unavailable (Studio without "Enable Studio Access to API
-- Services", or an outage) everything falls back to an in-memory store for the
-- session and the player is told that saves will not persist.

local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Steelrise")
local Config = require(Shared.Config)
local Util = require(Shared.Util)
local Remotes = require(Shared.Remotes)

local SaveService = {}
local Services

local store = nil
local persistent = false
local memory = {}
local metaCache = {}
local lastSave = {}

local function notify(player, text, kind)
	Remotes.get("Notify"):FireClient(player, text, kind or "info")
end

local function key(player, suffix)
	return "u" .. player.UserId .. ":" .. suffix
end

local function rawGet(k)
	if persistent then
		local ok, value = pcall(function()
			return store:GetAsync(k)
		end)
		if ok then
			return value, true
		end
		warn("[STEELRISE] DataStore read failed:", value)
		return memory[k], false
	end
	return memory[k], true
end

local function rawSet(k, value)
	memory[k] = value
	if persistent then
		local ok, err = pcall(function()
			store:UpdateAsync(k, function()
				return value
			end)
		end)
		if not ok then
			warn("[STEELRISE] DataStore write failed:", err)
			return false, "Cloud save failed — kept for this session only. (" .. tostring(err) .. ")"
		end
	end
	return true
end

function SaveService.init(services)
	Services = services
	local ok, result = pcall(function()
		return DataStoreService:GetDataStore(Config.Save.StoreName)
	end)
	if ok and result then
		store = result
		-- probe once so Studio without API access falls back cleanly
		local probeOk = pcall(function()
			store:GetAsync("probe")
		end)
		persistent = probeOk
	end
	if not persistent then
		warn("[STEELRISE] DataStores unavailable — saves are session-only. In Studio enable Game Settings > Security > Enable Studio Access to API Services.")
	end
	Players.PlayerRemoving:Connect(function(player)
		local site = Services.Site.current
		if site and site.host == player then
			SaveService.saveSlot(player, Config.Save.AutosaveSlot, true)
		end
		metaCache[player] = nil
		lastSave[player] = nil
	end)
	game:BindToClose(function()
		local site = Services.Site.current
		if site and site.host and site.host.Parent then
			SaveService.saveSlot(site.host, Config.Save.AutosaveSlot, true)
		end
	end)
	task.spawn(function()
		while true do
			task.wait(Config.Save.AutosaveInterval)
			local site = Services.Site.current
			if site and site.host and site.host.Parent and site.dirty then
				Remotes.get("Notify"):FireClient(site.host, "Autosaving…", "save")
				local okSave, msg = SaveService.saveSlot(site.host, Config.Save.AutosaveSlot, true)
				Remotes.get("Notify"):FireClient(site.host, okSave and "Autosaved" or msg, okSave and "save" or "warn")
			end
		end
	end)
end

function SaveService.isPersistent()
	return persistent
end

function SaveService.meta(player)
	if metaCache[player] then
		return metaCache[player]
	end
	local data = rawGet(key(player, "meta"))
	local meta = Util.withDefaults(data, { settings = Config.DefaultSettings, favorites = {}, slots = {}, lastSlot = -1 })
	meta.settings = Util.withDefaults(meta.settings, Config.DefaultSettings)
	metaCache[player] = meta
	return meta
end

local function writeMeta(player)
	return rawSet(key(player, "meta"), metaCache[player])
end

---------------------------------------------------------------------------
-- Snapshot
---------------------------------------------------------------------------

function SaveService.snapshot()
	local site = Services.Site.current
	local comps = {}
	for _, m in ipairs(Services.Components.all()) do
		local state = m:GetAttribute("State")
		local cf = m:GetPivot()
		local entry = {
			i = m:GetAttribute("ComponentId"),
			t = m:GetAttribute("ItemId"),
			s = state,
			f = m:GetAttribute("Fastened"),
			sb = m:GetAttribute("SupportedBy"),
			r = m:GetAttribute("RestraintId"),
			tr = m:GetAttribute("TrailerId"),
			on = m:GetAttribute("On") or nil,
		}
		if state == "Rigged" then
			-- an interrupted lift is restored safely in the laydown yard
			cf = Services.Crane.recoveryPose(m)
			entry.s = "Loose"
			entry.r, entry.tr = "", ""
		elseif state == "Carried" then
			local holder = tonumber(m:GetAttribute("Holder"))
			local p = holder and Players:GetPlayerByUserId(holder)
			local hrp = p and p.Character and p.Character:FindFirstChild("HumanoidRootPart")
			local base = hrp and hrp.Position or cf.Position
			cf = Services.Components.restingPose(m, base, 0, { m, p and p.Character })
			entry.s = "Loose"
		end
		entry.c = Util.cfToArray(cf)
		table.insert(comps, entry)
	end
	return {
		v = 1,
		site = site.id,
		blueprint = site.blueprint,
		savedAt = os.time(),
		progress = { installed = site.folder:GetAttribute("BPInstalled") or 0, total = site.folder:GetAttribute("BPTotal") or 0 },
		components = comps,
		trailers = Services.Delivery.serialize(),
		cranes = Services.Crane.serialize(),
	}
end

function SaveService.saveSlot(player, slot, silent)
	local site = Services.Site.current
	if not site then
		return false, "No site to save."
	end
	if site.host ~= player then
		return false, "Only the site host's progress is saved."
	end
	slot = math.clamp(math.floor(tonumber(slot) or 0), 0, Config.Save.ManualSlots)
	local t = os.clock()
	if not silent and lastSave[player] and t - lastSave[player] < Config.Save.MinSaveGap then
		return false, "Saved a moment ago — wait a few seconds."
	end
	lastSave[player] = t
	local snap = SaveService.snapshot()
	local ok, err = rawSet(key(player, "slot" .. slot), snap)
	local meta = SaveService.meta(player)
	meta.slots[tostring(slot)] = {
		site = snap.site,
		savedAt = snap.savedAt,
		installed = snap.progress.installed,
		total = snap.progress.total,
		count = #snap.components,
	}
	meta.lastSlot = slot
	writeMeta(player)
	site.dirty = false
	if not ok then
		return false, err
	end
	local where = slot == 0 and "autosave" or ("slot " .. slot)
	return true, persistent and ("Saved to " .. where .. ".") or ("Saved to " .. where .. " (this session only — DataStores unavailable).")
end

function SaveService.loadSlot(player, slot)
	local meta = SaveService.meta(player)
	if slot == nil or slot == "latest" then
		slot = meta.lastSlot
	end
	slot = tonumber(slot)
	if not slot or slot < 0 then
		return nil, "No saved construction found."
	end
	local data = rawGet(key(player, "slot" .. slot))
	if type(data) ~= "table" or not data.site then
		return nil, "That save slot is empty."
	end
	return data
end

function SaveService.handle(player, action, a, b)
	if action == "Save" then
		return SaveService.saveSlot(player, a, false)
	elseif action == "Settings" then
		if type(a) ~= "table" then
			return false, "Bad settings."
		end
		local meta = SaveService.meta(player)
		meta.settings = Util.withDefaults(a, Config.DefaultSettings)
		task.spawn(writeMeta, player)
		return true
	elseif action == "Favorite" then
		local meta = SaveService.meta(player)
		if type(a) == "string" and #a < 64 then
			meta.favorites[a] = b and true or nil
			task.spawn(writeMeta, player)
		end
		return true
	end
	return false, "Unknown action."
end

return SaveService
