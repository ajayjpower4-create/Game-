-- Loads a site: terrain, lighting, environment, crane, the starting stage of
-- the building (or a save), starter deliveries and the scaffold kit. Also
-- tracks blueprint progress for the task panel.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")

local Shared = ReplicatedStorage:WaitForChild("Steelrise")
local Config = require(Shared.Config)
local Registry = require(Shared.ItemRegistry)
local Sites = require(Shared.Sites)
local BuildRules = require(Shared.BuildRules)
local CraneMath = require(Shared.CraneMath)
local Util = require(Shared.Util)
local Remotes = require(Shared.Remotes)

local WorldFactory = require(script.Parent.WorldFactory)
local Packing = require(script.Parent.Packing)

local S = Config.S

local SiteService = {}
local Services
SiteService.current = nil

local function notifyAll(text, kind)
	Remotes.get("Notify"):FireAllClients(text, kind or "info")
end

function SiteService.init(services)
	Services = services
end

local function newFolder(parent, name)
	local f = Instance.new("Folder")
	f.Name = name
	f.Parent = parent
	return f
end

---------------------------------------------------------------------------
-- Blueprint progress
---------------------------------------------------------------------------

local function posKey(itemId, p)
	return itemId .. "@" .. math.floor(p.X * 2 + 0.5) .. "," .. math.floor(p.Y * 2 + 0.5) .. "," .. math.floor(p.Z * 2 + 0.5)
end

local PHASE_VERB = {
	footing = "Set footing",
	column = "Erect column",
	beam = "Hang beam",
	gusset = "Bolt gusset plate",
	brace = "Install brace",
	deck = "Lay deck sheet",
	facade = "Hang facade unit",
}

function SiteService.recountProgress()
	local site = SiteService.current
	if not site then
		return
	end
	local entries = site.blueprintEntries
	if not entries or #entries == 0 then
		site.folder:SetAttribute("BPInstalled", 0)
		site.folder:SetAttribute("BPTotal", 0)
		site.folder:SetAttribute("NextTask", "Free build — order materials from the catalog (Tab) and build anywhere on the lot.")
		return
	end
	local installed = {}
	for _, m in ipairs(Services.Components.all()) do
		if m:GetAttribute("State") == "Installed" then
			installed[posKey(m:GetAttribute("ItemId"), m:GetPivot().Position)] = true
		end
	end
	local done = 0
	local nextE = nil
	for _, e in ipairs(entries) do
		if installed[posKey(e.item, e.cf.Position)] then
			done += 1
		elseif not nextE then
			nextE = e
		end
	end
	site.folder:SetAttribute("BPInstalled", done)
	site.folder:SetAttribute("BPTotal", #entries)
	if nextE then
		local def = Registry.get(nextE.item)
		local where = nextE.phase == "footing" and string.format("grid %s%d", string.char(65 + nextE.i), nextE.j + 1)
			or string.format("level %d, grid %s%d", nextE.level, string.char(65 + nextE.i), nextE.j + 1)
		site.folder:SetAttribute("NextTask", string.format("%s — %s (%s)", PHASE_VERB[nextE.phase] or "Install", def and def.name or nextE.item, where))
	else
		site.folder:SetAttribute("NextTask", "Blueprint complete. Outstanding work!")
	end
end

function SiteService.onComponentInstalled()
	if SiteService.current then
		SiteService.current.dirty = true
		SiteService.recountProgress()
	end
end

function SiteService.onComponentRemoved()
	if SiteService.current then
		SiteService.current.dirty = true
		SiteService.recountProgress()
	end
end

function SiteService.setBlueprint(blueprintId)
	local site = SiteService.current
	if not site then
		return false, "No site."
	end
	local grid = Sites.blueprintGrid(site.def, blueprintId)
	site.blueprint = grid and (blueprintId or "Site") or nil
	site.blueprintEntries = grid and Sites.sortEntries(Sites.layout(grid)) or nil
	site.folder:SetAttribute("Blueprint", site.blueprint or "")
	SiteService.recountProgress()
	return true
end

---------------------------------------------------------------------------
-- Loading
---------------------------------------------------------------------------

local function unload()
	Services.Crane.clearAll()
	Services.Delivery.clearAll()
	Services.Components.clearAll()
	for _, p in ipairs(Players:GetPlayers()) do
		if p.Character then
			local hrp = p.Character:FindFirstChild("HumanoidRootPart")
			if hrp then
				hrp.Anchored = false
			end
			if Services.Components.carried(p) then
				Services.Components.dropCarried(p, true)
			end
		end
	end
	local old = workspace:FindFirstChild("SteelriseSite")
	if old then
		old:Destroy()
	end
	SiteService.current = nil
end

local function spawnLaydown(site, requests)
	if not requests or #requests == 0 then
		return
	end
	local list = {}
	for _, r in ipairs(requests) do
		table.insert(list, { id = r[1], qty = r[2] })
	end
	local ld = site.def.laydownM
	local frame = CFrame.new(ld.center.X * S, 0, ld.center.Z * S)
	local placed, extras = Packing.pack(list, ld.size.X * S, ld.size.Z * S, 1.2 * S, {})
	for _, d in ipairs(extras.dunnage) do
		local p = Instance.new("Part")
		p.Name = "Dunnage"
		p.Size = d.size
		p.CFrame = frame * d.cf
		p.Anchored = true
		p.Color = Config.Colors.Timber
		p.Material = Enum.Material.Wood
		p.Parent = site.folder.Environment
	end
	for _, pl in ipairs(placed) do
		Services.Components.spawn(pl.id, frame * pl.cf, "Loose", {})
	end
end

function SiteService.load(siteId, saveData, host)
	local def = Sites.get(siteId)
	if not def then
		return false, "Unknown site."
	end
	unload()
	local folder = Instance.new("Folder")
	folder.Name = "SteelriseSite"
	folder:SetAttribute("SiteId", siteId)
	folder:SetAttribute("Ready", false)
	local mn, mx = Sites.boundsStuds(def)
	folder:SetAttribute("BoundsMin", mn)
	folder:SetAttribute("BoundsMax", mx)
	local env = newFolder(folder, "Environment")
	newFolder(folder, "Components")
	newFolder(folder, "Trailers")
	newFolder(folder, "Cranes")
	folder.Parent = workspace

	local site = {
		id = siteId,
		def = def,
		folder = folder,
		host = host,
		dirty = false,
	}
	site.world = BuildRules.newWorld(folder)
	SiteService.current = site

	-- Each build step is isolated: a failure in one part of the world is
	-- logged (and reported to the host) instead of aborting the whole site.
	local failures = {}
	local function step(label, fn, ...)
		local ok, err = xpcall(fn, debug.traceback, ...)
		if not ok then
			warn("[STEELRISE] site build step '" .. label .. "' failed:", err)
			table.insert(failures, label .. ": " .. (string.match(tostring(err), "^[^\n]+") or tostring(err)))
		end
		return ok
	end
	site.buildFailures = failures

	step("lighting", WorldFactory.applyLighting, def)
	step("terrain", WorldFactory.buildTerrain, def)
	step("fencing", WorldFactory.buildFencing, def, env)
	step("site dressing", WorldFactory.buildSiteDressing, def, env)
	local surroundings = newFolder(folder, "Surroundings")
	step("surroundings", WorldFactory.buildSurroundings, def, surroundings)

	-- crane
	step("tower crane", function()
		local craneModel, cfg = WorldFactory.buildCrane(def.crane, "1")
		craneModel.Parent = folder.Cranes
		Services.Crane.register("1", craneModel, cfg)
	end)

	step("materials", function()
		if saveData then
			for _, c in ipairs(saveData.components or {}) do
				local cf = Util.arrayToCf(c.c)
				if cf and Registry.get(c.t) then
					Services.Components.spawn(c.t, cf, c.s or "Loose", {
						id = c.i,
						fastened = c.f,
						supportedBy = c.sb,
						restraint = c.r,
						trailer = c.tr,
						on = c.on,
					})
				end
			end
			Services.Delivery.restore(saveData.trailers)
			Services.Crane.restore(saveData.cranes)
			Services.Delivery.refreshAll()
		else
			-- starting stage of the building
			local stageModels = {}
			for _, e in ipairs(Sites.stageEntries(def)) do
				local m = Services.Components.spawn(e.item, e.cf, "Installed", {})
				if m then
					table.insert(stageModels, m)
				end
			end
			site.world:markDirty()
			for _, m in ipairs(stageModels) do
				local ids = BuildRules.supportsOf(site.world, Registry.get(m:GetAttribute("ItemId")), m:GetPivot(), m:GetAttribute("ComponentId"))
				m:SetAttribute("SupportedBy", table.concat(ids, ","))
			end
			-- first work package on a truck, scaffold kit in the yard
			if def.starter then
				if def.starter.trailer then
					local reqs = {}
					for _, r in ipairs(def.starter.trailer) do
						table.insert(reqs, { id = r[1], qty = r[2] })
					end
					Services.Delivery.spawnLoaded(1, reqs)
				end
				spawnLaydown(site, def.starter.laydown)
			else
				-- next work package from the blueprint
				local pending = {}
				local entries = Sites.sortEntries(Sites.layout(def.grid))
				local stage = {}
				for _, e in ipairs(Sites.stageEntries(def)) do
					stage[e.key] = true
				end
				local counts, order = {}, {}
				local n = 0
				for _, e in ipairs(entries) do
					if not stage[e.key] and e.phase ~= "deck" and e.phase ~= "gusset" then
						if not counts[e.item] then
							counts[e.item] = 0
							table.insert(order, e.item)
						end
						counts[e.item] += 1
						n += 1
						if n >= 10 then
							break
						end
					end
				end
				for _, id in ipairs(order) do
					table.insert(pending, { id = id, qty = counts[id] })
				end
				if #pending > 0 then
					Services.Delivery.spawnLoaded(1, pending)
				end
				spawnLaydown(site, {
					{ "CON-GUSSET-350", 4 },
					{ "SC-BASEJACK", 4 },
					{ "SC-STD-2000", 8 },
					{ "SC-LEDGER-2570", 6 },
					{ "SC-LEDGER-1090", 6 },
					{ "SC-DECK-2570", 2 },
					{ "SC-LADDER-27", 1 },
				})
			end
		end
	end)

	local bp = saveData and saveData.blueprint or (def.grid and "Site" or nil)
	step("blueprint", SiteService.setBlueprint, bp)
	folder:SetAttribute("Ready", true)
	folder:SetAttribute("Host", host and host.UserId or 0)
	-- keep player streaming focused on the site while in menus
	for _, p in ipairs(Players:GetPlayers()) do
		if not p.Character then
			p.ReplicationFocus = SiteService.focusPart()
		end
	end
	return true
end

-- Invisible part at the site centre used as the replication focus for menus.
function SiteService.focusPart()
	local site = SiteService.current
	if not site then
		return nil
	end
	local f = site.folder:FindFirstChild("Focus")
	if not f then
		f = Instance.new("Part")
		f.Name = "Focus"
		f.Anchored = true
		f.CanCollide = false
		f.CanQuery = false
		f.Transparency = 1
		f.Size = Vector3.new(1, 1, 1)
		f.CFrame = CFrame.new(site.def.crane.posM * S + Vector3.new(0, 20, 0))
		f.Parent = site.folder
	end
	return f
end

function SiteService.spawnCharacter(player)
	local site = SiteService.current
	if not site then
		return
	end
	player:LoadCharacter()
	local character = player.Character or player.CharacterAdded:Wait()
	local hrp = character:WaitForChild("HumanoidRootPart", 10)
	if hrp then
		local p = site.def.spawnM * S
		hrp.CFrame = CFrame.new(p + Vector3.new(0, 4, 0)) * CFrame.Angles(0, math.rad(180), 0)
	end
	player.ReplicationFocus = nil
	pcall(Services.Components.equip, player, "TL-HANDS")
	local hum = character:FindFirstChildOfClass("Humanoid")
	if hum then
		hum.Died:Connect(function()
			task.delay(4, function()
				-- respawn on site unless the player went back to the menu meanwhile
				if player.Parent and SiteService.current and player.Character == character then
					SiteService.spawnCharacter(player)
				end
			end)
		end)
	end
end

---------------------------------------------------------------------------
-- Remote handlers
---------------------------------------------------------------------------

function SiteService.handle(player, action, a, b, c)
	if action == "Start" then
		local siteId, mode, slot = a, b, c
		local site = SiteService.current
		local hostPresent = site and site.host and site.host.Parent and site.host ~= player
		if hostPresent and mode ~= "join" then
			return false, site.host.DisplayName .. " is hosting this server's site — use Join."
		end
		if mode == "continue" then
			local data, why = Services.Save.loadSlot(player, slot)
			if not data then
				return false, why
			end
			if site and site.host == player then
				Services.Save.saveSlot(player, Config.Save.AutosaveSlot, true)
			end
			local ok, err = SiteService.load(data.site, data, player)
			if not ok then
				return false, err
			end
		elseif mode == "join" then
			if not site then
				return false, "No site is running yet."
			end
		else
			if not Sites.get(siteId) then
				return false, "Unknown site."
			end
			if site and site.host == player then
				Services.Save.saveSlot(player, Config.Save.AutosaveSlot, true)
			end
			local ok, err = SiteService.load(siteId, nil, player)
			if not ok then
				return false, err
			end
		end
		-- (re)spawn everyone who is already on site so nobody stands in the old world
		for _, p in ipairs(Players:GetPlayers()) do
			if p.Character and p ~= player then
				task.spawn(SiteService.spawnCharacter, p)
			end
		end
		SiteService.spawnCharacter(player)
		local cur = SiteService.current
		cur.dirty = true
		if cur.buildFailures and #cur.buildFailures > 0 then
			Remotes.get("Notify"):FireClient(player, "Some of the site failed to build (the game still works): " .. table.concat(cur.buildFailures, " | "), "warn")
		end
		return true, nil, { siteId = cur.id, host = cur.host and cur.host.UserId or 0 }
	elseif action == "Blueprint" then
		local site = SiteService.current
		if not site or site.host ~= player then
			return false, "Only the host can change the blueprint."
		end
		return SiteService.setBlueprint(a ~= "" and a or nil)
	elseif action == "Menu" then
		if Services.Crane.isOperating(player) then
			Services.Crane.exit(player)
		end
		if Services.Components.carried(player) then
			Services.Components.dropCarried(player, true)
		end
		if player.Character then
			player.Character:Destroy()
			player.Character = nil
		end
		player.ReplicationFocus = SiteService.focusPart()
		return true
	end
	return false, "Unknown action."
end

function SiteService.menuInfo(player)
	local site = SiteService.current
	local meta = Services.Save.meta(player)
	local counts = Registry.count()
	return {
		currentSite = site and site.id or nil,
		host = site and site.host and site.host.UserId or 0,
		hostName = site and site.host and site.host.DisplayName or nil,
		slots = meta.slots,
		lastSlot = meta.lastSlot,
		settings = meta.settings,
		favorites = meta.favorites,
		persistent = Services.Save.isPersistent(),
		itemCount = counts.total,
		itemTarget = Registry.TargetCount,
	}
end

return SiteService
