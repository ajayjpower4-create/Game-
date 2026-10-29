-- Tower crane kinematics shared by the server (validation, landing checks)
-- and every client (rendering, operator prediction).
--
-- State (all studs / radians):
--   slew     : jib heading about the mast
--   trolley  : trolley radius from the mast centre along the jib
--   hoist    : rope length from the trolley sheaves to the hook point
--   swingX/Z : pendulum offset of the hook point in the jib frame
--   loadYaw  : load rotation about the hook (taglines/rotator)

local Config = require(script.Parent.Config)
local Util = require(script.Parent.Util)

local S = Config.S

local CraneMath = {}

-- Geometry offsets relative to the slewing pivot (top of mast), studs.
CraneMath.TrolleyY = 0.5 -- sheave point under the jib
CraneMath.JibBottomY = 2.0
CraneMath.JibHeight = 4.5
CraneMath.JibWidth = 3.6
CraneMath.MastWidth = 4.8
CraneMath.CabOffset = Vector3.new(1.2, -1.4, 4.4) -- cab centre, beside the jib root
CraneMath.CabEye = Vector3.new(1.8, -0.4, 4.4) -- operator eye point inside the cab
CraneMath.HookBlockHeight = 3.0 -- hook point to the top of the block

function CraneMath.config(craneDef)
	local cfg = {}
	cfg.base = craneDef.posM * S
	cfg.height = craneDef.heightM * S
	cfg.pivot = cfg.base + Vector3.new(0, cfg.height, 0)
	cfg.jib = craneDef.jibM * S
	cfg.counter = craneDef.counterM * S
	cfg.minR = 4 * S
	cfg.maxR = cfg.jib - 1.5 * S
	cfg.minRope = 4
	cfg.maxRope = cfg.height + CraneMath.TrolleyY - 1
	cfg.maxKg = craneDef.maxKg
	cfg.fullRadiusM = craneDef.fullRadiusM
	cfg.def = craneDef
	return cfg
end

function CraneMath.defaultState(craneDef)
	return {
		slew = math.rad(craneDef.slewDeg or 0),
		trolley = craneDef.jibM * S * 0.45,
		hoist = 20,
		swingX = 0,
		swingZ = 0,
		loadYaw = 0,
	}
end

function CraneMath.slewCf(cfg, slew)
	return CFrame.new(cfg.pivot) * CFrame.Angles(0, slew, 0)
end

function CraneMath.trolleyCf(cfg, st)
	return CraneMath.slewCf(cfg, st.slew) * CFrame.new(st.trolley, CraneMath.TrolleyY, 0)
end

function CraneMath.hookPos(cfg, st)
	local slewCf = CraneMath.slewCf(cfg, st.slew)
	local trolley = (slewCf * CFrame.new(st.trolley, CraneMath.TrolleyY, 0)).Position
	local swing = slewCf:VectorToWorldSpace(Vector3.new(st.swingX or 0, 0, st.swingZ or 0))
	-- keep rope length constant as the pendulum swings out
	local rope = st.hoist
	local horiz = swing.Magnitude
	local drop = math.sqrt(math.max(rope * rope - horiz * horiz, 0.01))
	return trolley + swing - Vector3.new(0, drop, 0)
end

-- Hook point CFrame (yaw follows the jib).
function CraneMath.hookCf(cfg, st)
	return CFrame.new(CraneMath.hookPos(cfg, st)) * CFrame.Angles(0, st.slew, 0)
end

-- Hook block visual CFrame, tilted along the rope.
function CraneMath.blockCf(cfg, st)
	local hook = CraneMath.hookPos(cfg, st)
	local trolley = CraneMath.trolleyCf(cfg, st).Position
	local up = (trolley - hook)
	if up.Magnitude < 0.01 then
		up = Vector3.yAxis
	end
	up = up.Unit
	local fwd = CFrame.Angles(0, st.slew, 0).LookVector
	local right = fwd:Cross(up)
	if right.Magnitude < 0.01 then
		right = Vector3.xAxis
	end
	right = right.Unit
	fwd = up:Cross(right)
	return CFrame.fromMatrix(hook, right, up, -fwd)
end

function CraneMath.loadCf(cfg, st, rigOffset)
	return CraneMath.hookCf(cfg, st) * CFrame.Angles(0, st.loadYaw or 0, 0) * rigOffset
end

-- Average of an item's lift points (local studs).
function CraneMath.liftCentre(def)
	local sum = Vector3.zero
	for _, p in ipairs(def.liftPointsS) do
		sum += p
	end
	return sum / math.max(#def.liftPointsS, 1)
end

-- Load pose relative to the hook frame, chosen by the item's rigging mode.
function CraneMath.rigOffset(def, loadCf, hookCf)
	local rel
	if def.rigging == "Upright" then
		rel = CFrame.new()
	elseif def.rigging == "Pitch" then
		rel = CFrame.Angles(0, 0, def.pitch or 0)
	else
		rel = hookCf.Rotation:Inverse() * loadCf.Rotation
	end
	local lift = CraneMath.liftCentre(def)
	local t = Vector3.new(0, -Config.Crane.SlingDrop, 0) - rel:VectorToWorldSpace(lift)
	return CFrame.new(t) * rel
end

function CraneMath.capacityKg(cfg, radius)
	return Config.craneCapacityKg(cfg, radius)
end

-- Largest trolley radius that can carry `kg`.
function CraneMath.maxRadiusFor(cfg, kg)
	if kg <= 0 then
		return cfg.maxR
	end
	local full = cfg.maxKg
	local fr = cfg.fullRadiusM
	if kg > full then
		return 0
	end
	local rM = full * fr / kg
	return Util.clamp(rM * S, cfg.minR, cfg.maxR)
end

-- Encode/decode state into model attributes.
CraneMath.Keys = { "slew", "trolley", "hoist", "swingX", "swingZ", "loadYaw" }

function CraneMath.writeAttributes(model, st)
	for _, k in ipairs(CraneMath.Keys) do
		model:SetAttribute("S_" .. k, st[k])
	end
end

function CraneMath.readAttributes(model, fallback)
	local st = {}
	for _, k in ipairs(CraneMath.Keys) do
		st[k] = model:GetAttribute("S_" .. k) or (fallback and fallback[k]) or 0
	end
	return st
end

function CraneMath.sanitize(cfg, st)
	st.trolley = Util.clamp(st.trolley, cfg.minR, cfg.maxR)
	st.hoist = Util.clamp(st.hoist, cfg.minRope, cfg.maxRope)
	local maxSwing = st.hoist * 0.35
	st.swingX = Util.clamp(st.swingX or 0, -maxSwing, maxSwing)
	st.swingZ = Util.clamp(st.swingZ or 0, -maxSwing, maxSwing)
	st.slew = (st.slew + math.pi) % (2 * math.pi) - math.pi
	st.loadYaw = (st.loadYaw + math.pi) % (2 * math.pi) - math.pi
	return st
end

return CraneMath
