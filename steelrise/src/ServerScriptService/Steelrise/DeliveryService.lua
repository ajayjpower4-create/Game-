-- Flatbed deliveries: trucks pull into unloading bays with every ordered
-- piece physically on the deck, stacked on dunnage and held by ratchet
-- straps. Pieces leave visible gaps as they are unloaded; an empty truck can
-- be dismissed to free the bay.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local HttpService = game:GetService("HttpService")

local Shared = ReplicatedStorage:WaitForChild("Steelrise")
local Config = require(Shared.Config)
local Registry = require(Shared.ItemRegistry)
local Util = require(Shared.Util)
local Remotes = require(Shared.Remotes)

local WorldFactory = require(script.Parent.WorldFactory)
local Packing = require(script.Parent.Packing)

local S = Config.S
local D = Config.Delivery

local DeliveryService = {}
local Services
local trailers = {} -- id -> record

local function now()
	return workspace:GetServerTimeNow()
end

local function fx(kind, pos, extra)
	Remotes.get("FX"):FireAllClients(kind, pos, extra)
end

function DeliveryService.init(services)
	Services = services
	task.spawn(function()
		while true do
			task.wait(5)
			for id, t in pairs(trailers) do
				if t.model and t.model.Parent and t.emptySince and not t.departing and now() - t.emptySince > 120 then
					DeliveryService.depart(id)
				end
			end
		end
	end)
end

function DeliveryService.folder()
	return Services.Site.current and Services.Site.current.folder:FindFirstChild("Trailers")
end

function DeliveryService.clearAll()
	for _, t in pairs(trailers) do
		if t.model then
			t.model:Destroy()
		end
	end
	trailers = {}
end

local function bedFrame(t)
	return t.bayCf * CFrame.new(0, t.bedTop, 0)
end

function DeliveryService.isArriving(id)
	local t = trailers[id]
	if not t then
		return false
	end
	return now() < (t.model:GetAttribute("ArriveAt") or 0) + D.ArriveSeconds
end

local function cargoOf(id)
	local out = {}
	for _, m in ipairs(Services.Components.all()) do
		if m:GetAttribute("TrailerId") == id then
			table.insert(out, m)
		end
	end
	return out
end

local function updateManifest(t)
	local counts, order = {}, {}
	for _, m in ipairs(cargoOf(t.id)) do
		local item = m:GetAttribute("ItemId")
		if not counts[item] then
			counts[item] = 0
			table.insert(order, item)
		end
		counts[item] += 1
	end
	local list = {}
	for _, item in ipairs(order) do
		local def = Registry.get(item)
		table.insert(list, { id = item, name = def and def.name or item, qty = counts[item] })
	end
	t.model:SetAttribute("Manifest", HttpService:JSONEncode(list))
	t.model:SetAttribute("Remaining", #cargoOf(t.id))
	if #list == 0 then
		t.model:SetAttribute("Empty", true)
		t.emptySince = t.emptySince or now()
	else
		t.model:SetAttribute("Empty", false)
		t.emptySince = nil
	end
end

local function buildStrap(t, s, strapId)
	local bed = bedFrame(t)
	local model = Instance.new("Model")
	model.Name = "Strap"
	model:SetAttribute("StrapId", strapId)
	model:SetAttribute("Group", s.group)
	model:SetAttribute("TrailerId", t.id)
	local W = math.max(s.width, D.BedWidth * S * 0.5)
	local function part(name, size, cf)
		local p = Instance.new("Part")
		p.Name = name
		p.Size = size
		p.CFrame = bed * cf
		p.Anchored = true
		p.CanCollide = false
		p.CanTouch = false
		p.CastShadow = false
		p.Color = Config.Colors.StrapOrange
		p.Material = Enum.Material.Fabric
		p.Parent = model
		return p
	end
	local bedHalf = D.BedWidth * S / 2
	part("Band", Vector3.new(0.16, 0.06, W + 0.12), CFrame.new(s.x, s.top + 0.04, 0))
	for _, sz in ipairs({ -1, 1 }) do
		local zEdge = sz * (W / 2 + 0.05)
		local a = Vector3.new(s.x, s.top + 0.04, zEdge)
		local b = Vector3.new(s.x, -0.35, sz * (bedHalf + 0.06))
		local len = (b - a).Magnitude
		part("Leg", Vector3.new(0.16, len, 0.06), CFrame.new((a + b) / 2) * CFrame.Angles(math.atan2(a.Z - b.Z, a.Y - b.Y), 0, 0))
	end
	local ratchet = part("Ratchet", Vector3.new(0.3, 0.45, 0.2), CFrame.new(s.x, s.top * 0.45, bedHalf + 0.12))
	ratchet.Color = Color3.fromRGB(150, 152, 156)
	ratchet.Material = Enum.Material.Metal
	local hit = part("StrapHit", Vector3.new(1.2, s.top + 0.6, W + 0.8), CFrame.new(s.x, s.top / 2, 0))
	hit.Transparency = 1
	hit:SetAttribute("StrapHit", true)
	model.PrimaryPart = hit
	model.Parent = t.model:FindFirstChild("Straps")
	return model
end

local function buildLoadExtras(t, extras)
	local bed = bedFrame(t)
	local load = Instance.new("Folder")
	load.Name = "Dunnage"
	load.Parent = t.model
	t.dunnage = extras.dunnage
	for _, d in ipairs(extras.dunnage) do
		local p = Instance.new("Part")
		p.Name = "Dunnage"
		p.Size = d.size
		p.CFrame = bed * d.cf
		p.Anchored = true
		p.CanTouch = false
		p.Color = Config.Colors.Timber
		p.Material = Enum.Material.Wood
		p.Parent = load
	end
	local straps = Instance.new("Folder")
	straps.Name = "Straps"
	straps.Parent = t.model
	t.straps = {}
	for i, s in ipairs(extras.straps) do
		local strapId = s.id or (t.id .. ":S" .. i)
		if not s.released then
			buildStrap(t, s, strapId)
		end
		table.insert(t.straps, { id = strapId, x = s.x, top = s.top, width = s.width, group = s.group, released = s.released or false })
	end
end

function DeliveryService.freeBay()
	local site = Services.Site.current
	if not site then
		return nil
	end
	local used = {}
	for _, t in pairs(trailers) do
		used[t.bay] = true
	end
	for i = 1, math.min(#site.def.bays, D.MaxTrailers) do
		if not used[i] then
			return i
		end
	end
	return nil
end

-- Creates a trailer in bay `bayIndex`. `placed` from Packing (bed-local
-- CFrames) spawns new restrained cargo; pass nil when restoring a save
-- (cargo is restored separately with its saved state).
function DeliveryService.spawnTrailer(bayIndex, placed, extras, opts)
	opts = opts or {}
	local site = Services.Site.current
	local id = opts.id or ("T" .. string.sub(HttpService:GenerateGUID(false), 1, 8))
	local bayCf = site.def.bays[bayIndex]
	local seed = opts.seed or math.random(1, 1e6)
	local model, bedTop = WorldFactory.buildTrailer(bayCf, seed)
	model.Name = "Trailer_" .. id
	model.ModelStreamingMode = Enum.ModelStreamingMode.Atomic
	model:SetAttribute("TrailerId", id)
	model:SetAttribute("Bay", bayIndex)
	model:SetAttribute("ArriveAt", opts.instant and 0 or now())
	model:SetAttribute("DepartAt", 0)
	local t = { id = id, bay = bayIndex, bayCf = bayCf, bedTop = bedTop, model = model, seed = seed }
	trailers[id] = t
	buildLoadExtras(t, extras)
	model.Parent = DeliveryService.folder()
	if placed then
		local bed = bedFrame(t)
		for _, p in ipairs(placed) do
			Services.Components.spawn(p.id, bed * p.cf, "Restrained", { restraint = id .. ":" .. p.group, trailer = id })
		end
	end
	-- straps: group ids need the trailer prefix
	for _, s in ipairs(t.straps) do
		if not string.find(s.group, ":", 1, true) then
			s.group = id .. ":" .. s.group
		end
	end
	for _, strap in ipairs(model.Straps:GetChildren()) do
		local g = strap:GetAttribute("Group")
		if g and not string.find(g, ":", 1, true) then
			strap:SetAttribute("Group", id .. ":" .. g)
		end
	end
	updateManifest(t)
	return t
end

function DeliveryService.request(player, itemId, qty)
	local site = Services.Site.current
	if not site then
		return false, "No site loaded."
	end
	local def = Registry.get(itemId or "")
	if not def or not def.deliverable then
		return false, "That item can't be delivered."
	end
	local maxQty = def.weightClass == "Light" and 40 or (def.weightClass == "Medium" and 16 or 10)
	qty = math.clamp(math.floor(tonumber(qty) or 1), 1, maxQty)
	local loose = 0
	for _, m in ipairs(Services.Components.all()) do
		local st = m:GetAttribute("State")
		if st == "Loose" or st == "Restrained" then
			loose += 1
		end
	end
	if loose + qty > D.MaxLooseComponents then
		return false, string.format("Too much loose material on site (%d). Install or stack what you have first.", loose)
	end
	local remaining = { { id = itemId, qty = qty } }
	local delivered = 0
	local trucks = 0
	while #remaining > 0 do
		local bay = DeliveryService.freeBay()
		if not bay then
			break
		end
		local placed, extras, leftovers = Packing.pack(remaining, D.BedLength * S, D.BedWidth * S, D.MaxStackHeight * S, { maxKg = D.TrailerMaxKg })
		if #placed == 0 then
			if delivered == 0 then
				return false, "That load won't fit on a flatbed."
			end
			break
		end
		DeliveryService.spawnTrailer(bay, placed, extras, {})
		delivered += #placed
		trucks += 1
		remaining = leftovers
	end
	if delivered == 0 then
		return false, "All unloading bays are occupied — unload and dismiss a truck first."
	end
	local msg = string.format("%d × %s on %d truck%s — arriving now.", delivered, def.name, trucks, trucks > 1 and "s" or "")
	if delivered < qty then
		msg ..= string.format(" %d didn't fit: free a bay and order again.", qty - delivered)
	end
	fx("TruckArrive", site.def.bays[1].Position, nil)
	return true, msg
end

-- Starter loads for a fresh site (instant, no drive-in).
function DeliveryService.spawnLoaded(bayIndex, requests)
	local placed, extras = Packing.pack(requests, D.BedLength * S, D.BedWidth * S, D.MaxStackHeight * S, { maxKg = D.TrailerMaxKg })
	return DeliveryService.spawnTrailer(bayIndex, placed, extras, { instant = true })
end

local function findStrap(strapId)
	for _, t in pairs(trailers) do
		local folder = t.model:FindFirstChild("Straps")
		if folder then
			for _, s in ipairs(folder:GetChildren()) do
				if s:GetAttribute("StrapId") == strapId then
					return t, s
				end
			end
		end
	end
	return nil
end

function DeliveryService.releaseStrap(player, strapId)
	local t, strap = findStrap(strapId)
	if not t then
		return false, "Strap already released."
	end
	if DeliveryService.isArriving(t.id) then
		return false, "Wait for the truck to stop."
	end
	local hrp = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	local hit = strap.PrimaryPart
	if not hrp or not hit then
		return false, "No character."
	end
	local lp = hit.CFrame:PointToObjectSpace(hrp.Position)
	local h = hit.Size / 2
	local d = (lp - Vector3.new(math.clamp(lp.X, -h.X, h.X), math.clamp(lp.Y, -h.Y, h.Y), math.clamp(lp.Z, -h.Z, h.Z))).Magnitude
	if d > Config.Reach.Interact then
		return false, "Out of reach — walk up to the trailer."
	end
	local group = strap:GetAttribute("Group")
	for _, s in ipairs(t.straps) do
		if s.id == strapId then
			s.released = true
		end
	end
	local pos = hit.Position
	strap:Destroy()
	fx("Strap", pos, nil)
	-- group free once all of its straps are off
	local held = false
	for _, s in ipairs(t.straps) do
		if s.group == group and not s.released then
			held = true
		end
	end
	if not held then
		for _, m in ipairs(cargoOf(t.id)) do
			if m:GetAttribute("RestraintId") == group then
				m:SetAttribute("RestraintId", "")
				if m:GetAttribute("State") == "Restrained" then
					Services.Components.setState(m, "Loose")
				end
			end
		end
	end
	Remotes.get("Progress"):FireAllClients("StrapReleased", { by = player.UserId })
	return true
end

function DeliveryService.onRemovedFromTrailer(model)
	local tid = model:GetAttribute("TrailerId")
	if tid and tid ~= "" and trailers[tid] then
		model:SetAttribute("TrailerId", "")
		updateManifest(trailers[tid])
	end
end

function DeliveryService.depart(id)
	local t = trailers[id]
	if not t or t.departing then
		return
	end
	t.departing = true
	t.model:SetAttribute("DepartAt", now())
	fx("TruckDepart", t.model:GetPivot().Position, nil)
	task.delay(D.DepartSeconds + 0.5, function()
		if trailers[id] == t then
			trailers[id] = nil
			t.model:Destroy()
		end
	end)
end

function DeliveryService.dismiss(player, id)
	local t = trailers[id]
	if not t then
		return false, "No such truck."
	end
	local left = #cargoOf(id)
	if left > 0 then
		return false, string.format("Unload all materials first (%d left on the deck).", left)
	end
	DeliveryService.depart(id)
	return true, "Truck released."
end

function DeliveryService.handle(player, action, a, b)
	if action == "Request" then
		return DeliveryService.request(player, a, b)
	elseif action == "Dismiss" then
		return DeliveryService.dismiss(player, a)
	end
	return false, "Unknown action."
end

function DeliveryService.serialize()
	local out = {}
	for _, t in pairs(trailers) do
		if not t.departing then
			local dun = {}
			for _, d in ipairs(t.dunnage or {}) do
				table.insert(dun, { cf = Util.cfToArray(d.cf), size = { d.size.X, d.size.Y, d.size.Z } })
			end
			local straps = {}
			for _, s in ipairs(t.straps) do
				table.insert(straps, { id = s.id, x = s.x, top = s.top, width = s.width, group = s.group, released = s.released })
			end
			table.insert(out, { id = t.id, bay = t.bay, seed = t.seed, dunnage = dun, straps = straps })
		end
	end
	return out
end

function DeliveryService.restore(list)
	for _, data in ipairs(list or {}) do
		local dun = {}
		for _, d in ipairs(data.dunnage or {}) do
			local cf = Util.arrayToCf(d.cf)
			if cf then
				table.insert(dun, { cf = cf, size = Vector3.new(d.size[1], d.size[2], d.size[3]) })
			end
		end
		local site = Services.Site.current
		if data.bay and site.def.bays[data.bay] then
			DeliveryService.spawnTrailer(data.bay, nil, { dunnage = dun, straps = data.straps or {} }, { instant = true, id = data.id, seed = data.seed })
		end
	end
end

function DeliveryService.refreshAll()
	for _, t in pairs(trailers) do
		updateManifest(t)
	end
end

return DeliveryService
