-- Server authority for tower cranes.
--
-- The operator's client simulates the crane at frame rate (smooth controls,
-- sway, collision stops) and streams its state ~15 Hz. The server clamps every
-- update to the crane's speed limits, travel limits and load chart, publishes
-- it as attributes for everyone else, and validates every attach, landing and
-- release against its own copy of the state.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local Shared = ReplicatedStorage:WaitForChild("Steelrise")
local Config = require(Shared.Config)
local Registry = require(Shared.ItemRegistry)
local CraneMath = require(Shared.CraneMath)
local BuildRules = require(Shared.BuildRules)
local Util = require(Shared.Util)
local Remotes = require(Shared.Remotes)

local CraneService = {}
local Services
local cranes = {} -- id -> rec

local K = Config.Crane

local function notify(player, text, kind)
	Remotes.get("Notify"):FireClient(player, text, kind or "info")
end

local function fx(kind, pos, extra)
	Remotes.get("FX"):FireAllClients(kind, pos, extra)
end

local function now()
	return workspace:GetServerTimeNow()
end

function CraneService.register(id, model, cfg)
	local rec = {
		id = id,
		model = model,
		cfg = cfg,
		st = CraneMath.defaultState(cfg.def),
		operator = nil,
		mode = nil,
		lastStream = os.clock(),
	}
	cranes[id] = rec
	CraneMath.writeAttributes(model, rec.st)
	model:SetAttribute("Locked", false)
	return rec
end

function CraneService.clearAll()
	for _, rec in pairs(cranes) do
		if rec.operator then
			CraneService.exit(rec.operator)
		end
	end
	cranes = {}
end

function CraneService.get(id)
	return cranes[id]
end

function CraneService.first()
	for _, rec in pairs(cranes) do
		return rec
	end
	return nil
end

local function recOf(player)
	for _, rec in pairs(cranes) do
		if rec.operator == player then
			return rec
		end
	end
	return nil
end

function CraneService.isOperating(player)
	return recOf(player) ~= nil
end

function CraneService.holds(model)
	local id = model:GetAttribute("ComponentId")
	for _, rec in pairs(cranes) do
		if rec.loadId == id then
			return true
		end
	end
	return false
end

local function loadModel(rec)
	return rec.loadId and Services.Components.get(rec.loadId)
end

local function loadKg(rec)
	local m = loadModel(rec)
	if not m then
		return 0
	end
	return Services.Components.def(m).weightKg + K.RiggingKg
end

local function publish(rec)
	CraneMath.writeAttributes(rec.model, rec.st)
end

local function setOperator(rec, player, mode)
	rec.operator = player
	rec.mode = mode
	rec.model:SetAttribute("Operator", player and player.UserId or 0)
	rec.model:SetAttribute("Mode", mode or "")
	rec.lastStream = os.clock()
end

---------------------------------------------------------------------------
-- Operator entry / exit
---------------------------------------------------------------------------

local function nearAccess(rec, hrp)
	local static = rec.model:FindFirstChild("Static")
	if not static then
		return false
	end
	for _, name in ipairs({ "CraneAccess", "CraneAccessTop" }) do
		local p = static:FindFirstChild(name)
		if p and (p.Position - hrp.Position).Magnitude <= Config.Reach.CraneCab + p.Size.Magnitude / 2 then
			return true
		end
	end
	return false
end

function CraneService.enter(player, id, mode)
	local rec = cranes[id] or CraneService.first()
	if not rec then
		return false, "No crane on this site."
	end
	local hrp = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	if not hrp then
		return false, "No character."
	end
	if Services.Components.carried(player) then
		return false, "Put down what you're carrying first."
	end
	if rec.operator and rec.operator ~= player and rec.operator.Parent then
		return false, rec.operator.DisplayName .. " is operating this crane."
	end
	if mode == "Remote" then
		if Services.Components.equipped(player) ~= "TL-REMOTE" then
			return false, "Equip the crane radio remote (5)."
		end
		local d = (Vector3.new(hrp.Position.X, 0, hrp.Position.Z) - Vector3.new(rec.cfg.base.X, 0, rec.cfg.base.Z)).Magnitude
		if d > K.RemoteRange then
			return false, "Out of radio range."
		end
	else
		if not nearAccess(rec, hrp) and rec.operator ~= player then
			return false, "Go to the crane access gate at the mast base (or climb to the top)."
		end
		hrp.Anchored = true
	end
	setOperator(rec, player, mode)
	Remotes.get("Progress"):FireAllClients("CraneEntered", { by = player.UserId, mode = mode })
	return true, nil, { craneId = rec.id, mode = mode }
end

function CraneService.exit(player)
	local rec = recOf(player)
	if not rec then
		return false, "Not operating a crane."
	end
	local mode = rec.mode
	setOperator(rec, nil, nil)
	if mode == "Cab" then
		local hrp = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
		if hrp then
			local base = rec.cfg.base
			hrp.CFrame = CFrame.new(base + Vector3.new(0, 3.5, -(CraneMath.MastWidth / 2 + 5)))
			hrp.Anchored = false
		end
	end
	return true
end

---------------------------------------------------------------------------
-- State stream
---------------------------------------------------------------------------

local function limit(old, new, rate, dt)
	local m = rate * dt * 1.6 + 0.05
	return old + Util.clamp(new - old, -m, m)
end

function CraneService.onStream(player, id, data)
	local rec = cranes[id]
	if not rec or rec.operator ~= player or type(data) ~= "table" then
		return
	end
	for _, k in ipairs(CraneMath.Keys) do
		if type(data[k]) ~= "number" or data[k] ~= data[k] then
			return
		end
	end
	if (data.seq or 0) < (rec.model:GetAttribute("ResetSeq") or 0) then
		return -- stale stream from before a recovery reset
	end
	local t = os.clock()
	local dt = Util.clamp(t - rec.lastStream, 0.01, 0.5)
	rec.lastStream = t
	local old = rec.st
	local st = {}
	if rec.locked then
		st.slew, st.trolley, st.loadYaw = old.slew, old.trolley, old.loadYaw
		-- allow only slacking off the hoist a little while the crane holds a set piece
		st.hoist = Util.clamp(data.hoist, old.hoist - 0.05, old.hoist + 1.0)
		st.swingX, st.swingZ = 0, 0
	else
		local dSlew = ((data.slew - old.slew + math.pi) % (2 * math.pi)) - math.pi
		st.slew = old.slew + Util.clamp(dSlew, -(K.SlewMaxSpeed * dt * 1.6 + 0.01), K.SlewMaxSpeed * dt * 1.6 + 0.01)
		st.trolley = limit(old.trolley, data.trolley, K.TrolleyMaxSpeed, dt)
		st.hoist = limit(old.hoist, data.hoist, K.HoistMaxSpeed, dt)
		st.loadYaw = limit(old.loadYaw, data.loadYaw, K.LoadRotateSpeed, dt)
		st.swingX, st.swingZ = data.swingX, data.swingZ
		local kg = loadKg(rec)
		if kg > 0 then
			local maxR = CraneMath.maxRadiusFor(rec.cfg, kg)
			if st.trolley > maxR and st.trolley > old.trolley then
				st.trolley = math.max(old.trolley, maxR)
			end
		end
	end
	rec.st = CraneMath.sanitize(rec.cfg, st)
	publish(rec)
end

---------------------------------------------------------------------------
-- Rigging
---------------------------------------------------------------------------

local function unrig(rec)
	local m = loadModel(rec)
	if m then
		m.ModelStreamingMode = Enum.ModelStreamingMode.Atomic
		m:SetAttribute("Holder", "")
	end
	rec.loadId = nil
	rec.rigOffset = nil
	rec.locked = false
	rec.model:SetAttribute("LoadId", "")
	rec.model:SetAttribute("Locked", false)
end

function CraneService.attach(player, componentId)
	local rec = recOf(player)
	if not rec then
		return false, "You're not at the crane controls."
	end
	if rec.loadId then
		return false, "Something is already on the hook."
	end
	local model = Services.Components.get(componentId)
	if not model then
		return false, "Nothing to hook."
	end
	local def = Services.Components.def(model)
	local state = model:GetAttribute("State")
	if state == "Restrained" then
		return false, "Release the cargo straps on that stack first."
	end
	if state ~= "Loose" then
		return false, "Only loose materials can be rigged."
	end
	local tid = model:GetAttribute("TrailerId")
	if tid ~= "" and Services.Delivery.isArriving(tid) then
		return false, "Wait for the truck to stop."
	end
	local hook = CraneMath.hookPos(rec.cfg, rec.st)
	local liftWorld = model:GetPivot() * CraneMath.liftCentre(def)
	local target = liftWorld + Vector3.new(0, K.SlingDrop, 0)
	local spread = 0
	for _, p in ipairs(def.liftPointsS) do
		spread = math.max(spread, (p - CraneMath.liftCentre(def)).Magnitude)
	end
	if (hook - target).Magnitude > K.AttachRange + 1.5 + spread * 0.25 then
		return false, "Bring the hook over the rigging points first."
	end
	local kg = def.weightKg + K.RiggingKg
	local cap = CraneMath.capacityKg(rec.cfg, rec.st.trolley)
	if kg > cap then
		return false, string.format("Over the load chart: %s at this radius, capacity %s. Trolley in closer.", Util.fmtKg(kg), Util.fmtKg(cap))
	end
	local blocker = Services.Components.stackedOnTop(model)
	if blocker then
		return false, "Take the " .. blocker .. " off the top of the stack first."
	end
	local hookCf = CraneMath.hookCf(rec.cfg, rec.st)
	rec.rigOffset = CraneMath.rigOffset(def, model:GetPivot(), hookCf)
	rec.st.loadYaw = 0
	rec.loadId = componentId
	rec.rigTime = now()
	rec.locked = false
	model.ModelStreamingMode = Enum.ModelStreamingMode.Persistent
	model:SetAttribute("RestraintId", "")
	Services.Delivery.onRemovedFromTrailer(model)
	Services.Components.setState(model, "Rigged")
	model:SetAttribute("Holder", "crane:" .. rec.id)
	rec.model:SetAttribute("RigOffset", rec.rigOffset)
	rec.model:SetAttribute("RigStart", model:GetPivot())
	rec.model:SetAttribute("RigTime", rec.rigTime)
	rec.model:SetAttribute("Locked", false)
	rec.model:SetAttribute("LoadId", componentId)
	publish(rec)
	fx("Rig", liftWorld, nil)
	Remotes.get("Progress"):FireAllClients("Rigged", { id = componentId, item = def.id, by = player.UserId })
	return true
end

function CraneService.currentLoadCf(rec)
	if not rec.loadId or not rec.rigOffset then
		return nil
	end
	return CraneMath.loadCf(rec.cfg, rec.st, rec.rigOffset)
end

function CraneService.land(player, target)
	local rec = recOf(player)
	if not rec then
		return false, "You're not at the crane controls."
	end
	if typeof(target) ~= "CFrame" then
		return false, "Bad target."
	end
	local model = loadModel(rec)
	if not model or rec.locked then
		return false, "No hanging load to land."
	end
	if now() - (rec.rigTime or 0) < 1.4 then
		return false, "Let the load settle on the slings first."
	end
	local def = Services.Components.def(model)
	local loadCf = CraneService.currentLoadCf(rec)
	local dPos = (target.Position - loadCf.Position).Magnitude
	local ang = BuildRules.angleDiff(def, target, loadCf)
	if dPos > K.LandPosTolerance then
		return false, string.format("Still %.1f m from the connection — bring it closer.", Config.toMeters(dPos))
	end
	if ang > K.LandAngleTolerance then
		return false, string.format("Rotate the load to line up (%d° off).", math.floor(math.deg(ang) + 0.5))
	end
	local ok, why, info = BuildRules.validate(Services.Components.world(), def, target, {
		exclude = { rec.loadId },
		excludeModels = { model },
	})
	if not ok then
		return false, why
	end
	Services.Components.commitPlacement(model, target, info)
	rec.locked = true
	rec.st.swingX, rec.st.swingZ = 0, 0
	rec.model:SetAttribute("Locked", true)
	publish(rec)
	fx("Set", target.Position, def.id)
	Remotes.get("Progress"):FireAllClients("Landed", { id = rec.loadId, item = def.id, by = player.UserId })
	local need = def.minFastenRelease
	if need > 0 then
		notify(player, string.format("Landed. Fasten at least %d connection%s, then unhook (G).", need, need > 1 and "s" or ""), "info")
	end
	return true
end

-- Lowest point of a load box in world space.
local function bottomY(def, cf)
	local box = cf * CFrame.new(def.boundsOffset)
	local h = def.size / 2
	local low = math.huge
	for _, sx in ipairs({ -1, 1 }) do
		for _, sy in ipairs({ -1, 1 }) do
			for _, sz in ipairs({ -1, 1 }) do
				low = math.min(low, (box * Vector3.new(sx * h.X, sy * h.Y, sz * h.Z)).Y)
			end
		end
	end
	return low
end

function CraneService.release(player)
	local rec = recOf(player)
	if not rec then
		return false, "You're not at the crane controls."
	end
	local model = loadModel(rec)
	if not model then
		unrig(rec)
		return false, "Nothing on the hook."
	end
	local def = Services.Components.def(model)
	if rec.locked then
		local state = model:GetAttribute("State")
		local done = Services.Components.fastenedCount(model)
		if state == "Placed" and done < def.minFastenRelease then
			return false, string.format("Fasten at least %d connection%s before unhooking (%d done).", def.minFastenRelease, def.minFastenRelease > 1 and "s" or "", done)
		end
		unrig(rec)
		fx("Unhook", model:GetPivot().Position, nil)
		Remotes.get("Progress"):FireAllClients("Unhooked", { id = model:GetAttribute("ComponentId"), item = def.id, by = player.UserId })
		return true, "Rigging released."
	end
	local loadCf = CraneService.currentLoadCf(rec)
	local w = Services.Components.world()
	local hit = w:raycast(loadCf.Position + Vector3.new(0, 2, 0), Vector3.new(0, -200, 0), { model })
	local groundY = hit and hit.Position.Y or 0
	if bottomY(def, loadCf) - groundY > 1.6 then
		return false, "Lower it until it sits on the ground or a deck before unhooking."
	end
	local pose = Services.Components.restingPose(model, loadCf.Position, Util.yawOf(CFrame.Angles(0, rec.st.slew + rec.st.loadYaw, 0)), { model })
	model:PivotTo(pose)
	Services.Components.setState(model, "Loose")
	unrig(rec)
	fx("Drop", pose.Position, def.id)
	Remotes.get("Progress"):FireAllClients("Unhooked", { id = model:GetAttribute("ComponentId"), item = def.id, by = player.UserId })
	return true, "Load set down."
end

-- Finds a free resting pose for `model` in the laydown yard.
function CraneService.recoveryPose(model)
	local site = Services.Site.current
	local def = Services.Components.def(model)
	local ld = site.def.laydownM
	local c = ld.center * Config.S
	local size = ld.size * Config.S
	local params = OverlapParams.new()
	params.FilterType = Enum.RaycastFilterType.Include
	params.FilterDescendantsInstances = { site.folder.Components, site.folder.Environment }
	params.RespectCanCollide = true
	local step = 3
	for gz = -size.Z / 2 + 2, size.Z / 2 - 2, step do
		for gx = -size.X / 2 + 2, size.X / 2 - 2, step do
			local p = c + Vector3.new(gx, 0, gz)
			local pose = Services.Components.restingPose(model, p, 0, { model })
			local box, offset = Services.Packing.transportBox(def)
			local parts = workspace:GetPartBoundsInBox(CFrame.new(pose.Position + offset), box - Vector3.new(0.2, 0.2, 0.2), params)
			local clear = true
			for _, part in ipairs(parts) do
				if not part:IsDescendantOf(model) and part.Name ~= "Dunnage" then
					clear = false
					break
				end
			end
			if clear then
				return pose
			end
		end
	end
	return Services.Components.restingPose(model, c, 0, { model })
end

function CraneService.recover(player)
	local rec = recOf(player) or CraneService.first()
	if not rec then
		return false, "No crane."
	end
	local isHost = Services.Site.current and Services.Site.current.host == player
	if rec.operator and rec.operator ~= player and not isHost then
		return false, "Only the operator or the site host can recover the load."
	end
	local model = loadModel(rec)
	local msg = "Hook recovered."
	if model then
		local state = model:GetAttribute("State")
		if state ~= "Installed" then
			local def = Services.Components.def(model)
			model:PivotTo(CraneService.recoveryPose(model))
			model:SetAttribute("Fastened", string.rep("0", #def.fasteners))
			model:SetAttribute("SupportedBy", "")
			local f = model:FindFirstChild("Fasteners")
			if f then
				f:Destroy()
			end
			Services.Components.setState(model, "Loose")
			msg = def.name .. " returned to the laydown yard."
		end
		unrig(rec)
	end
	rec.st.hoist = math.min(rec.st.hoist, 24)
	rec.st.swingX, rec.st.swingZ, rec.st.loadYaw = 0, 0, 0
	rec.model:SetAttribute("ResetSeq", (rec.model:GetAttribute("ResetSeq") or 0) + 1)
	publish(rec)
	return true, msg
end

function CraneService.onComponentInstalled(model)
	for _, rec in pairs(cranes) do
		if rec.loadId == model:GetAttribute("ComponentId") and rec.operator then
			notify(rec.operator, "All connections made — unhook with G.", "success")
		end
	end
end

---------------------------------------------------------------------------
-- Remote handler and housekeeping
---------------------------------------------------------------------------

function CraneService.handle(player, action, a)
	if not Services.Site.current then
		return false, "No site loaded."
	end
	if action == "Enter" then
		return CraneService.enter(player, a, "Cab")
	elseif action == "Remote" then
		return CraneService.enter(player, a, "Remote")
	elseif action == "Exit" then
		return CraneService.exit(player)
	elseif action == "Attach" then
		return CraneService.attach(player, a)
	elseif action == "Release" then
		return CraneService.release(player)
	elseif action == "Land" then
		return CraneService.land(player, a)
	elseif action == "Recover" then
		return CraneService.recover(player)
	end
	return false, "Unknown action."
end

function CraneService.serialize()
	local out = {}
	for id, rec in pairs(cranes) do
		out[id] = { slew = rec.st.slew, trolley = rec.st.trolley, hoist = rec.st.hoist }
	end
	return out
end

function CraneService.restore(data)
	for id, s in pairs(data or {}) do
		local rec = cranes[id]
		if rec and type(s) == "table" then
			rec.st.slew = tonumber(s.slew) or rec.st.slew
			rec.st.trolley = tonumber(s.trolley) or rec.st.trolley
			rec.st.hoist = tonumber(s.hoist) or rec.st.hoist
			CraneMath.sanitize(rec.cfg, rec.st)
			publish(rec)
		end
	end
end

function CraneService.init(services)
	Services = services
	Remotes.get("CraneStream").OnServerEvent:Connect(CraneService.onStream)
	local function release(player)
		local rec = recOf(player)
		if rec then
			setOperator(rec, nil, nil)
		end
	end
	Players.PlayerRemoving:Connect(release)
	Players.PlayerAdded:Connect(function(player)
		player.CharacterRemoving:Connect(function()
			release(player)
		end)
	end)
	for _, player in ipairs(Players:GetPlayers()) do
		player.CharacterRemoving:Connect(function()
			release(player)
		end)
	end
	-- keep cab operators seated in the slewing cab
	local acc = 0
	RunService.Heartbeat:Connect(function(dt)
		acc += dt
		if acc < 0.2 then
			return
		end
		acc = 0
		for _, rec in pairs(cranes) do
			if rec.operator and rec.mode == "Cab" then
				local hrp = rec.operator.Character and rec.operator.Character:FindFirstChild("HumanoidRootPart")
				if hrp then
					local cab = CraneMath.slewCf(rec.cfg, rec.st.slew) * CFrame.new(CraneMath.CabOffset) * CFrame.new(0.2, -0.6, 0) * CFrame.Angles(0, -math.pi / 2, 0)
					hrp.Anchored = true
					hrp.CFrame = cab
				end
			end
		end
	end)
end

return CraneService
