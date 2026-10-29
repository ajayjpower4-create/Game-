-- Owns every physical material/component instance on the site and its
-- state machine:
--
--   Restrained -> Loose -> Carried | Rigged -> Placed -> Installed
--                   ^________________________________________|  (dismantle)
--
-- The delivered model IS the installed model: the same Model instance moves
-- through every state, so nothing is duplicated or swapped.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")

local Shared = ReplicatedStorage:WaitForChild("Steelrise")
local Config = require(Shared.Config)
local Registry = require(Shared.ItemRegistry)
local Factory = require(Shared.ModelFactory)
local BuildRules = require(Shared.BuildRules)
local Util = require(Shared.Util)
local Remotes = require(Shared.Remotes)

local ComponentService = {}
local Services

local byId = {} -- id -> model
local carrying = {} -- player -> model
local equipped = {} -- player -> toolId
local lastFasten = {} -- player -> time
local changed = Instance.new("BindableEvent")
ComponentService.Changed = changed.Event

local function notify(player, text, kind)
	Remotes.get("Notify"):FireClient(player, text, kind or "info")
end

local function fx(kind, pos, extra)
	Remotes.get("FX"):FireAllClients(kind, pos, extra)
end

function ComponentService.init(services)
	Services = services
	Players.PlayerRemoving:Connect(function(player)
		ComponentService.dropCarried(player, true)
		equipped[player] = nil
		lastFasten[player] = nil
	end)
end

function ComponentService.folder()
	local site = Services.Site.current
	return site and site.folder:FindFirstChild("Components")
end

function ComponentService.world()
	return Services.Site.current and Services.Site.current.world
end

function ComponentService.get(id)
	local m = byId[id]
	if m and m.Parent then
		return m
	end
	byId[id] = nil
	return nil
end

function ComponentService.def(model)
	return Registry.get(model:GetAttribute("ItemId"))
end

function ComponentService.all()
	local out = {}
	for id, m in pairs(byId) do
		if m.Parent then
			table.insert(out, m)
		else
			byId[id] = nil
		end
	end
	return out
end

function ComponentService.clearAll()
	for _, m in pairs(byId) do
		m:Destroy()
	end
	byId = {}
	for player in pairs(carrying) do
		carrying[player] = nil
	end
end

local function markWorldDirty()
	local w = ComponentService.world()
	if w then
		w:markDirty()
	end
end

local function fire(kind, model, player)
	changed:Fire(kind, model, player)
	Remotes.get("Progress"):FireAllClients(kind, {
		id = model and model:GetAttribute("ComponentId"),
		item = model and model:GetAttribute("ItemId"),
		state = model and model:GetAttribute("State"),
		by = player and player.UserId or 0,
	})
end

function ComponentService.setState(model, state)
	model:SetAttribute("State", state)
	markWorldDirty()
end

-- Creates a component model. opts: { id, fastened (mask), supportedBy, restraint, trailer, on }
function ComponentService.spawn(itemId, cf, state, opts)
	opts = opts or {}
	local def = Registry.get(itemId)
	if not def then
		warn("[STEELRISE] unknown item", itemId)
		return nil
	end
	local id = opts.id or HttpService:GenerateGUID(false)
	local tint = (Util.hash01(Util.hashString(id), 3, 7) - 0.5) * 0.09
	local model = Factory.build(def, cf, { tint = tint, installed = state == "Installed" })
	model.Name = def.id
	model.ModelStreamingMode = Enum.ModelStreamingMode.Atomic
	model:SetAttribute("ComponentId", id)
	model:SetAttribute("ItemId", def.id)
	model:SetAttribute("State", state)
	model:SetAttribute("Holder", "")
	model:SetAttribute("RestraintId", opts.restraint or "")
	model:SetAttribute("TrailerId", opts.trailer or "")
	model:SetAttribute("SupportedBy", opts.supportedBy or "")
	local n = #def.fasteners
	local mask = opts.fastened or string.rep(state == "Installed" and "1" or "0", n)
	model:SetAttribute("Fastened", mask)
	if state == "Placed" or state == "Installed" then
		Factory.addFasteners(model, def, mask)
	end
	if def.functional then
		model:SetAttribute("On", opts.on and true or false)
		ComponentService.applyFunctional(model)
	end
	model.Parent = ComponentService.folder()
	byId[id] = model
	markWorldDirty()
	return model
end

function ComponentService.destroy(model)
	local id = model:GetAttribute("ComponentId")
	byId[id] = nil
	model:Destroy()
	markWorldDirty()
end

function ComponentService.fastenedCount(model)
	local mask = model:GetAttribute("Fastened") or ""
	local _, n = string.gsub(mask, "1", "")
	return n
end

---------------------------------------------------------------------------
-- Tools
---------------------------------------------------------------------------

local function handOf(character)
	return character:FindFirstChild("RightHand") or character:FindFirstChild("Right Arm")
end

function ComponentService.equipped(player)
	return equipped[player] or "TL-HANDS"
end

function ComponentService.equip(player, toolId)
	local def = Registry.get(toolId or "")
	if not def or def.kind ~= "Tool" then
		return false, "Unknown tool."
	end
	equipped[player] = toolId
	local character = player.Character
	if character then
		local old = character:FindFirstChild("SR_Tool")
		if old then
			old:Destroy()
		end
		local hand = handOf(character)
		if hand and toolId ~= "TL-HANDS" then
			local model = Factory.build(def, nil, { preview = true })
			model.Name = "SR_Tool"
			local rootPart = model.PrimaryPart
			local grip = hand.CFrame * CFrame.new(0, -hand.Size.Y / 2 - 0.25, -0.2)
			model:PivotTo(grip)
			for _, p in ipairs(model:GetDescendants()) do
				if p:IsA("BasePart") then
					p.Anchored = false
					p.CanCollide = false
					p.CanQuery = false
					p.CanTouch = false
					p.Massless = true
					if p ~= rootPart then
						local w = Instance.new("WeldConstraint")
						w.Part0 = rootPart
						w.Part1 = p
						w.Parent = p
					end
				end
			end
			local w = Instance.new("WeldConstraint")
			w.Part0 = hand
			w.Part1 = rootPart
			w.Parent = rootPart
			model.Parent = character
		end
	end
	return true
end

---------------------------------------------------------------------------
-- Hand carrying
---------------------------------------------------------------------------

local function setCarryPhysics(model, carried)
	for _, p in ipairs(model:GetDescendants()) do
		if p:IsA("BasePart") then
			if carried then
				p:SetAttribute("_cc", p.CanCollide)
				p:SetAttribute("_cq", p.CanQuery)
				p.CanCollide = false
				p.CanQuery = false
				p.Massless = true
				p.Anchored = false
			else
				p.Anchored = true
				p.Massless = false
				local cc, cq = p:GetAttribute("_cc"), p:GetAttribute("_cq")
				if cc ~= nil then
					p.CanCollide = cc
				end
				if cq ~= nil then
					p.CanQuery = cq
				end
				p:SetAttribute("_cc", nil)
				p:SetAttribute("_cq", nil)
			end
		end
	end
	local welds = model:FindFirstChild("CarryWelds")
	if welds then
		welds:Destroy()
	end
end

-- Distance from a point to a component's bounding box.
function ComponentService.distanceTo(model, point)
	local def = ComponentService.def(model)
	local cf = model:GetPivot() * CFrame.new(def.boundsOffset)
	local lp = cf:PointToObjectSpace(point)
	local h = def.size / 2
	local clamped = Vector3.new(Util.clamp(lp.X, -h.X, h.X), Util.clamp(lp.Y, -h.Y, h.Y), Util.clamp(lp.Z, -h.Z, h.Z))
	return (lp - clamped).Magnitude
end

local function hrpOf(player)
	local c = player.Character
	return c and c:FindFirstChild("HumanoidRootPart"), c and c:FindFirstChildOfClass("Humanoid")
end

function ComponentService.carried(player)
	local m = carrying[player]
	if m and m.Parent then
		return m
	end
	carrying[player] = nil
	return nil
end

local function trailerBusy(model)
	local tid = model:GetAttribute("TrailerId")
	if tid and tid ~= "" and Services.Delivery.isArriving(tid) then
		return true
	end
	return false
end

function ComponentService.pickUp(player, id)
	local model = ComponentService.get(id)
	if not model then
		return false, "That item no longer exists."
	end
	local def = ComponentService.def(model)
	local hrp, hum = hrpOf(player)
	if not hrp then
		return false, "No character."
	end
	if ComponentService.carried(player) then
		return false, "You're already carrying something — place or drop it first (G)."
	end
	if Services.Crane.isOperating(player) then
		return false, "Leave the crane controls first."
	end
	local state = model:GetAttribute("State")
	if state == "Restrained" then
		return false, "Secured by cargo straps — release the strap first."
	end
	if state ~= "Loose" then
		return false, "Only loose materials can be picked up."
	end
	if trailerBusy(model) then
		return false, "The truck is still pulling in."
	end
	local wc = Config.WeightClasses[def.weightClass]
	if not wc.carry then
		return false, string.format("Too heavy to carry (%s) — use the crane.", Util.fmtKg(def.weightKg))
	end
	if ComponentService.distanceTo(model, hrp.Position) > Config.Reach.Interact then
		return false, "Out of reach — move closer."
	end
	-- nothing stacked on top
	local blocker = ComponentService.stackedOnTop(model)
	if blocker then
		return false, "Take the " .. blocker .. " off the top of the stack first."
	end
	setCarryPhysics(model, true)
	local longest = math.max(def.size.X, def.size.Y, def.size.Z)
	local hold
	if longest > 5 then
		-- shoulder carry, longest axis along the walking direction
		local axis = CFrame.new()
		if longest == def.size.X then
			axis = CFrame.Angles(0, math.pi / 2, 0)
		elseif longest == def.size.Y then
			axis = CFrame.Angles(-math.pi / 2, 0, 0)
		end
		hold = hrp.CFrame * CFrame.new(1.1, 1.6, 0) * axis * CFrame.new(-def.boundsOffset)
	else
		local depth = math.max(def.size.X, def.size.Z) / 2
		hold = hrp.CFrame * CFrame.new(0, 0.2, -(depth + 1.4)) * CFrame.new(-def.boundsOffset)
	end
	model:PivotTo(hold)
	local welds = Instance.new("Folder")
	welds.Name = "CarryWelds"
	welds.Parent = model
	local root = model.PrimaryPart
	for _, p in ipairs(model:GetDescendants()) do
		if p:IsA("BasePart") and p ~= root then
			local w = Instance.new("WeldConstraint")
			w.Part0 = root
			w.Part1 = p
			w.Parent = welds
		end
	end
	local w = Instance.new("WeldConstraint")
	w.Part0 = hrp
	w.Part1 = root
	w.Parent = welds
	model:SetAttribute("State", "Carried")
	model:SetAttribute("Holder", tostring(player.UserId))
	Services.Delivery.onRemovedFromTrailer(model)
	model:SetAttribute("TrailerId", "")
	carrying[player] = model
	if hum then
		hum.WalkSpeed = wc.walkSpeed
	end
	markWorldDirty()
	fx("Pickup", root.Position, def.id)
	fire("PickedUp", model, player)
	return true
end

-- Returns the name of a loose item resting on top of `model`, if any.
function ComponentService.stackedOnTop(model)
	local def = ComponentService.def(model)
	local cf = model:GetPivot() * CFrame.new(def.boundsOffset)
	-- which local axis points up, and how tall the box is in world space
	local up = cf:VectorToObjectSpace(Vector3.yAxis)
	local halfY = math.abs(up.X) * def.size.X / 2 + math.abs(up.Y) * def.size.Y / 2 + math.abs(up.Z) * def.size.Z / 2
	local ax, ay, az = math.abs(up.X), math.abs(up.Y), math.abs(up.Z)
	local probe = Vector3.new(
		ax >= ay and ax >= az and 0.5 or def.size.X * 0.8,
		ay > ax and ay >= az and 0.5 or def.size.Y * 0.8,
		az > ax and az > ay and 0.5 or def.size.Z * 0.8
	)
	local params = OverlapParams.new()
	params.FilterType = Enum.RaycastFilterType.Include
	params.FilterDescendantsInstances = { ComponentService.folder() }
	local box = cf.Rotation + (cf.Position + Vector3.new(0, halfY + 0.35, 0))
	local parts = workspace:GetPartBoundsInBox(box, probe, params)
	for _, p in ipairs(parts) do
		if not p:IsDescendantOf(model) then
			local other = p
			while other and other.Parent ~= ComponentService.folder() do
				other = other.Parent
			end
			if other and other ~= model then
				local st = other:GetAttribute("State")
				if st == "Loose" or st == "Restrained" then
					return Registry.get(other:GetAttribute("ItemId")).name
				end
			end
		end
	end
	return nil
end

-- Lay an item down in its transport pose on whatever is below `point`.
function ComponentService.restingPose(model, point, yaw, excludeModels)
	local def = ComponentService.def(model)
	local w = ComponentService.world()
	local hit = w:raycast(point + Vector3.new(0, 4, 0), Vector3.new(0, -60, 0), excludeModels)
	local groundY = hit and hit.Position.Y or 0
	local R = CFrame.Angles(0, yaw, 0) * def.transport
	local box, offset = Services.Packing.transportBox(def)
	local rotOffset = CFrame.Angles(0, yaw, 0):VectorToWorldSpace(offset)
	local centre = Vector3.new(point.X, groundY + box.Y / 2 + 0.02, point.Z)
	return CFrame.new(centre - rotOffset) * R
end

function ComponentService.dropCarried(player, silent)
	local model = ComponentService.carried(player)
	if not model then
		return false, "Not carrying anything."
	end
	local def = ComponentService.def(model)
	local hrp, hum = hrpOf(player)
	local pos = model:GetPivot().Position
	local yaw = hrp and Util.yawOf(hrp.CFrame) or 0
	setCarryPhysics(model, false)
	local excl = { model }
	if player.Character then
		table.insert(excl, player.Character)
	end
	local base = hrp and (hrp.CFrame * CFrame.new(0, 0, -(math.min(def.size.X, def.size.Z) / 2 + 2))).Position or pos
	model:PivotTo(ComponentService.restingPose(model, base, yaw, excl))
	model:SetAttribute("State", "Loose")
	model:SetAttribute("Holder", "")
	carrying[player] = nil
	if hum then
		hum.WalkSpeed = Config.WalkSpeed
	end
	markWorldDirty()
	if not silent then
		fx("Drop", model.PrimaryPart.Position, def.id)
	end
	fire("Dropped", model, player)
	return true
end

-- Commits a component to a validated pose. `holderInfo` decides the new state.
function ComponentService.commitPlacement(model, cf, info)
	local def = ComponentService.def(model)
	model:PivotTo(cf)
	local ids = {}
	for _, id in ipairs(info.mates or {}) do
		table.insert(ids, id)
	end
	for _, id in ipairs(info.supports or {}) do
		table.insert(ids, id)
	end
	model:SetAttribute("SupportedBy", table.concat(ids, ","))
	local needs = #def.fasteners > 0
	model:SetAttribute("Fastened", string.rep("0", #def.fasteners))
	model:SetAttribute("State", needs and "Placed" or "Installed")
	model:SetAttribute("RestraintId", "")
	model:SetAttribute("TrailerId", "")
	Factory.addFasteners(model, def, model:GetAttribute("Fastened"))
	markWorldDirty()
	if not needs then
		ComponentService.onInstalled(model)
	end
end

function ComponentService.place(player, id, cf, free)
	local model = ComponentService.carried(player)
	if not model or model:GetAttribute("ComponentId") ~= id then
		return false, "You're not carrying that."
	end
	if typeof(cf) ~= "CFrame" then
		return false, "Bad placement."
	end
	local def = ComponentService.def(model)
	if free and not def.allowFree then
		return false, "Free placement isn't available for structural members."
	end
	local hrp, hum = hrpOf(player)
	local excl = { model }
	if player.Character then
		table.insert(excl, player.Character)
	end
	local ok, why, info = BuildRules.validate(ComponentService.world(), def, cf, {
		exclude = { id },
		excludeModels = excl,
		actorPos = hrp and hrp.Position,
		reach = Config.Reach.Place,
	})
	if not ok then
		return false, why
	end
	setCarryPhysics(model, false)
	carrying[player] = nil
	if hum then
		hum.WalkSpeed = Config.WalkSpeed
	end
	model:SetAttribute("Holder", "")
	ComponentService.commitPlacement(model, cf, info)
	fx("Set", cf.Position, def.id)
	fire("Placed", model, player)
	return true
end

---------------------------------------------------------------------------
-- Fastening, installing, dismantling
---------------------------------------------------------------------------

function ComponentService.onInstalled(model)
	local def = ComponentService.def(model)
	model:SetAttribute("State", "Installed")
	-- cut off the column lifting lug once it is bolted down
	local lug = model:FindFirstChild("LiftLug")
	if lug then
		lug:Destroy()
	end
	-- finished concrete cures from wet dark grey to light grey
	if def.tags.Slab then
		local concrete = model:FindFirstChild("Concrete")
		if concrete then
			concrete.Color = Color3.fromRGB(176, 174, 168)
			concrete.Reflectance = 0
		end
	end
	markWorldDirty()
	fire("Installed", model, nil)
	if Services.Site then
		Services.Site.onComponentInstalled(model, def)
	end
end

function ComponentService.fasten(player, id, index)
	local model = ComponentService.get(id)
	if not model then
		return false, "That component no longer exists."
	end
	local def = ComponentService.def(model)
	if model:GetAttribute("State") ~= "Placed" then
		return false, "Only placed components need fastening."
	end
	local f = def.fasteners[index]
	if not f then
		return false, "No fastener there."
	end
	local mask = model:GetAttribute("Fastened") or ""
	if string.sub(mask, index, index) == "1" then
		return false, "Already tight."
	end
	local tool = Registry.get(ComponentService.equipped(player))
	if not tool or tool.fastens ~= f.type then
		local need = ({ Bolt = "the impact wrench (2)", Wedge = "the scaffold hammer (3)", Weld = "the welder (4)", Screed = "the trowel (7)" })[f.type]
		return false, "Wrong tool — this needs " .. (need or f.type) .. "."
	end
	local hrp = hrpOf(player)
	local wp = model:GetPivot() * (f.pos * Config.S)
	if not hrp or (hrp.Position - wp).Magnitude > Config.Reach.Fasten then
		return false, "Out of reach — get closer to the connection (scaffold or deck)."
	end
	local now = os.clock()
	if lastFasten[player] and now - lastFasten[player] < 0.3 then
		return false, nil
	end
	lastFasten[player] = now
	mask = string.sub(mask, 1, index - 1) .. "1" .. string.sub(mask, index + 1)
	model:SetAttribute("Fastened", mask)
	Factory.setFastenerVisible(model, index, true)
	fx(f.type, wp, def.id)
	if not string.find(mask, "0", 1, true) then
		ComponentService.onInstalled(model)
		Services.Crane.onComponentInstalled(model)
	end
	fire("Fastened", model, player)
	return true
end

function ComponentService.dismantle(player, id)
	local model = ComponentService.get(id)
	if not model then
		return false, "That component no longer exists."
	end
	local def = ComponentService.def(model)
	local state = model:GetAttribute("State")
	if state ~= "Installed" and state ~= "Placed" then
		return false, "Nothing to dismantle."
	end
	if Services.Crane.holds(model) then
		return false, "The crane is still holding it — unhook first."
	end
	local hrp = hrpOf(player)
	if not hrp or ComponentService.distanceTo(model, hrp.Position) > Config.Reach.Interact then
		return false, "Out of reach."
	end
	if #def.fasteners > 0 then
		local tool = Registry.get(ComponentService.equipped(player))
		if not tool or tool.fastens ~= def.fasteners[1].type then
			local need = ({ Bolt = "impact wrench (2)", Wedge = "scaffold hammer (3)", Weld = "welder (4)", Screed = "trowel (7)" })[def.fasteners[1].type]
			return false, "Equip the " .. (need or "right tool") .. " to undo its connections."
		end
	end
	local deps = BuildRules.dependents(ComponentService.world(), model:GetAttribute("ComponentId"))
	if #deps > 0 then
		return false, "Remove what it supports first: " .. Registry.get(deps[1]:GetAttribute("ItemId")).name .. "."
	end
	model:SetAttribute("State", "Loose")
	model:SetAttribute("SupportedBy", "")
	model:SetAttribute("Fastened", string.rep("0", #def.fasteners))
	local folder = model:FindFirstChild("Fasteners")
	if folder then
		folder:Destroy()
	end
	markWorldDirty()
	fx("Dismantle", model:GetPivot().Position, def.id)
	fire("Dismantled", model, player)
	Services.Site.onComponentRemoved(model)
	return true
end

---------------------------------------------------------------------------
-- Concrete: the pump hose places a slab over a fully decked bay
---------------------------------------------------------------------------

function ComponentService.pour(player, itemId, cf)
	if ComponentService.equipped(player) ~= "TL-POUR" then
		return false, "Equip the concrete pump hose (6)."
	end
	local def = Registry.get(itemId or "")
	if not def or def.kind ~= "Slab" or typeof(cf) ~= "CFrame" then
		return false, "Nothing to pour there."
	end
	local hrp = hrpOf(player)
	if not hrp then
		return false, "No character."
	end
	local d = (Vector3.new(hrp.Position.X, cf.Position.Y, hrp.Position.Z) - cf.Position).Magnitude
	if d > math.max(def.size.X, def.size.Z) / 2 + Config.Reach.Place or math.abs(hrp.Position.Y - cf.Position.Y) > 12 then
		return false, "Out of reach — stand on or next to the bay you're pouring."
	end
	local ok, why, info = BuildRules.validate(ComponentService.world(), def, cf, { excludeModels = { player.Character } })
	if not ok then
		return false, why
	end
	local model = ComponentService.spawn(itemId, cf, "Placed", { supportedBy = table.concat(info.supports, ",") })
	fx("Pour", cf.Position, def.id)
	fire("Poured", model, player)
	return true, "Concrete placed — finish it with the trowel (7) at the four marks."
end

---------------------------------------------------------------------------
-- Functional equipment (lights, engines)
---------------------------------------------------------------------------

function ComponentService.applyFunctional(model)
	local on = model:GetAttribute("On") == true
	for _, d in ipairs(model:GetDescendants()) do
		if d:IsA("Light") then
			d.Enabled = on
		elseif d:IsA("BasePart") and d:GetAttribute("Lens") then
			d.Material = on and Enum.Material.Neon or Enum.Material.Glass
		end
	end
end

function ComponentService.toggle(player, id)
	local model = ComponentService.get(id)
	if not model then
		return false, "Gone."
	end
	local def = ComponentService.def(model)
	if not def.functional then
		return false, "Nothing to switch on."
	end
	local st = model:GetAttribute("State")
	if st ~= "Installed" and st ~= "Loose" then
		return false, "Set it down first."
	end
	local hrp = hrpOf(player)
	if not hrp or ComponentService.distanceTo(model, hrp.Position) > Config.Reach.Interact then
		return false, "Out of reach."
	end
	model:SetAttribute("On", not model:GetAttribute("On"))
	ComponentService.applyFunctional(model)
	fx("Toggle", model:GetPivot().Position, model:GetAttribute("On"))
	return true
end

---------------------------------------------------------------------------
-- Remote handlers
---------------------------------------------------------------------------

function ComponentService.handle(player, action, a, b, c)
	if not Services.Site.current then
		return false, "No site loaded."
	end
	if action == "PickUp" then
		return ComponentService.pickUp(player, a)
	elseif action == "Drop" then
		return ComponentService.dropCarried(player)
	elseif action == "Place" then
		return ComponentService.place(player, a, b, c == true)
	elseif action == "Release" then
		return Services.Delivery.releaseStrap(player, a)
	elseif action == "Toggle" then
		return ComponentService.toggle(player, a)
	end
	return false, "Unknown action."
end

function ComponentService.build(player, action, a, b)
	if action == "Equip" then
		return ComponentService.equip(player, a)
	end
	if not Services.Site.current then
		return false, "No site loaded."
	end
	if action == "Fasten" then
		return ComponentService.fasten(player, a, tonumber(b) or 0)
	elseif action == "Dismantle" then
		return ComponentService.dismantle(player, a)
	elseif action == "Pour" then
		return ComponentService.pour(player, a, b)
	end
	return false, "Unknown action."
end

return ComponentService
