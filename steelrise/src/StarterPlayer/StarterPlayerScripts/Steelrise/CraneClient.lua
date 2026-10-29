-- Tower crane on the client.
--
-- Renderer (everyone): poses the slewing assembly, trolley, hook block, hoist
-- falls, slings and the rigged load from the crane's state each frame,
-- smoothing the server's ~12 Hz attribute updates.
--
-- Operator (the player at the controls): simulates the crane at frame rate
-- with acceleration/braking, a damped pendulum for load sway, load-chart and
-- travel limits, ground and collision stops, then streams the state to the
-- server which clamps and republishes it. Also runs the alignment assist,
-- landing, hooking/unhooking and the cab / hook / exterior cameras.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local ContextActionService = game:GetService("ContextActionService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Steelrise")
local Config = require(Shared.Config)
local Registry = require(Shared.ItemRegistry)
local Factory = require(Shared.ModelFactory)
local BuildRules = require(Shared.BuildRules)
local CraneMath = require(Shared.CraneMath)
local Util = require(Shared.Util)
local Remotes = require(Shared.Remotes)

local State = require(script.Parent.State)
local HUD = require(script.Parent.HUD)
local Net = require(script.Parent.Net)
local Audio = require(script.Parent.Audio)

local CraneClient = {}
local player = Players.LocalPlayer
local K = Config.Crane
local S = Config.S

local recs = {} -- crane model -> render record
local op = nil -- operator session
local slingFolder

local function now()
	return workspace:GetServerTimeNow()
end

local function wrap(a)
	return (a + math.pi) % (2 * math.pi) - math.pi
end

---------------------------------------------------------------------------
-- Render records
---------------------------------------------------------------------------

local function getRec(model)
	local rec = recs[model]
	if rec then
		return rec
	end
	if not State.siteDef then
		return nil
	end
	local slew, trolley, hook = model:FindFirstChild("Slew"), model:FindFirstChild("Trolley"), model:FindFirstChild("Hook")
	if not (slew and trolley and hook and slew.PrimaryPart and trolley.PrimaryPart and hook.PrimaryPart) then
		return nil
	end
	local cfg = CraneMath.config(State.siteDef.crane)
	rec = {
		model = model,
		cfg = cfg,
		st = CraneMath.readAttributes(model, CraneMath.defaultState(cfg.def)),
		prev = nil,
		slew = slew,
		trolley = trolley,
		hook = hook,
		cables = model:FindFirstChild("Cables"),
		slings = {},
	}
	local drum = slew:FindFirstChild("WinchDrum")
	rec.sndSlew = Audio.loop("CraneSlewMotor", slew.PrimaryPart)
	rec.sndTrolley = Audio.loop("CraneTrolleyMotor", trolley.PrimaryPart)
	rec.sndHoist = Audio.loop("CraneHoistWinch", drum or slew.PrimaryPart)
	recs[model] = rec
	return rec
end

local function placeCylinder(part, a, b)
	local len = (b - a).Magnitude
	if len < 0.01 then
		part.Transparency = 1
		return
	end
	part.Transparency = 0
	part.Size = Vector3.new(len, part.Size.Y, part.Size.Z)
	part.CFrame = Factory.lookAlong((a + b) / 2, b - a) * CFrame.Angles(0, math.pi / 2, 0)
end

local function loadModelOf(rec)
	local id = rec.model:GetAttribute("LoadId")
	if not id or id == "" or not State.site then
		return nil
	end
	local comps = State.site:FindFirstChild("Components")
	if not comps then
		return nil
	end
	for _, m in ipairs(comps:GetChildren()) do
		if m:GetAttribute("ComponentId") == id then
			return m
		end
	end
	return nil
end

local function rigBlend(rec)
	local t = rec.model:GetAttribute("RigTime") or 0
	return math.clamp((now() - t) / 1.5, 0, 1)
end

-- Current pose of the rigged load (including the pick-up blend).
local function riggedLoadCf(rec, st)
	local offset = rec.model:GetAttribute("RigOffset")
	if typeof(offset) ~= "CFrame" then
		return nil
	end
	local target = CraneMath.loadCf(rec.cfg, st, offset)
	local start = rec.model:GetAttribute("RigStart")
	local a = rigBlend(rec)
	if typeof(start) == "CFrame" and a < 1 then
		local e = a * a * (3 - 2 * a)
		return start:Lerp(target, e), true
	end
	return target, false
end

local function setSling(rec, i, a, b)
	local p = rec.slings[i]
	if not p then
		p = Instance.new("Part")
		p.Name = "Sling"
		p.Shape = Enum.PartType.Cylinder
		p.Size = Vector3.new(1, 0.12, 0.12)
		p.Color = Color3.fromRGB(230, 120, 30)
		p.Material = Enum.Material.Fabric
		p.Anchored = true
		p.CanCollide = false
		p.CanQuery = false
		p.CanTouch = false
		p.CastShadow = false
		p.Parent = slingFolder
		rec.slings[i] = p
	end
	if a then
		placeCylinder(p, a, b)
	else
		p.Transparency = 1
	end
end

local function render(rec, st, dt)
	local cfg = rec.cfg
	rec.slew:PivotTo(CraneMath.slewCf(cfg, st.slew))
	local tcf = CraneMath.trolleyCf(cfg, st)
	rec.trolley:PivotTo(tcf)
	local bcf = CraneMath.blockCf(cfg, st)
	rec.hook:PivotTo(bcf)
	if rec.cables then
		local f1, f2 = rec.cables:FindFirstChild("Fall1"), rec.cables:FindFirstChild("Fall2")
		if f1 and f2 then
			placeCylinder(f1, (tcf * CFrame.new(-0.45, 0.2, 0)).Position, (bcf * CFrame.new(-0.45, 2.9, 0)).Position)
			placeCylinder(f2, (tcf * CFrame.new(0.45, 0.2, 0)).Position, (bcf * CFrame.new(0.45, 2.9, 0)).Position)
		end
	end
	-- load and slings
	local load = loadModelOf(rec)
	local hookPoint = bcf.Position
	if load then
		local def = Registry.get(load:GetAttribute("ItemId"))
		if load:GetAttribute("State") == "Rigged" then
			local cf = riggedLoadCf(rec, st)
			if cf then
				load:PivotTo(cf)
			end
		end
		local pivot = load:GetPivot()
		for i = 1, 2 do
			local lp = def and def.liftPointsS[i]
			if lp then
				setSling(rec, i, hookPoint, pivot * lp)
			else
				setSling(rec, i, nil)
			end
		end
	else
		setSling(rec, 1, nil)
		setSling(rec, 2, nil)
	end
	-- motor sounds follow the motion
	if rec.prev and dt > 0 then
		local vs = math.abs(wrap(st.slew - rec.prev.slew)) / dt
		local vt = math.abs(st.trolley - rec.prev.trolley) / dt
		local vh = math.abs(st.hoist - rec.prev.hoist) / dt
		rec.sndSlew:set(vs / K.SlewMaxSpeed, 0.8 + 0.3 * vs / K.SlewMaxSpeed)
		rec.sndTrolley:set(vt / K.TrolleyMaxSpeed, 0.85 + 0.25 * vt / K.TrolleyMaxSpeed)
		rec.sndHoist:set(vh / K.HoistMaxSpeed, 0.8 + 0.35 * vh / K.HoistMaxSpeed)
		rec.sndSlew:step(dt)
		rec.sndTrolley:step(dt)
		rec.sndHoist:step(dt)
	end
	rec.prev = { slew = st.slew, trolley = st.trolley, hoist = st.hoist }
end

---------------------------------------------------------------------------
-- Operator session
---------------------------------------------------------------------------

local function sinkMovement(on)
	if on then
		ContextActionService:BindActionAtPriority("SR_CraneSink", function()
			return Enum.ContextActionResult.Sink
		end, false, Enum.ContextActionPriority.High.Value + 100, Enum.KeyCode.W, Enum.KeyCode.A, Enum.KeyCode.S, Enum.KeyCode.D, Enum.KeyCode.Space, Enum.KeyCode.Up, Enum.KeyCode.Down, Enum.KeyCode.Left, Enum.KeyCode.Right)
	else
		ContextActionService:UnbindAction("SR_CraneSink")
	end
end

local VIEWS = { Cab = { "Cab", "Hook", "Exterior" }, Remote = { "Player", "Hook", "Exterior" } }

local function setView(view)
	op.view = view
	State.crane.view = view
	local cam = workspace.CurrentCamera
	if view == "Player" then
		cam.CameraType = Enum.CameraType.Custom
		UserInputService.MouseBehavior = Enum.MouseBehavior.Default
	else
		cam.CameraType = Enum.CameraType.Scriptable
		UserInputService.MouseBehavior = view == "Cab" and Enum.MouseBehavior.LockCenter or Enum.MouseBehavior.Default
	end
end

function CraneClient.start(craneId, mode)
	local site = State.site
	local folder = site and site:FindFirstChild("Cranes")
	local model = nil
	for _, m in ipairs(folder and folder:GetChildren() or {}) do
		if m:GetAttribute("CraneId") == craneId or not craneId then
			model = m
		end
	end
	if not model then
		return
	end
	local rec = getRec(model)
	if not rec then
		return
	end
	op = {
		rec = rec,
		mode = mode,
		st = CraneMath.readAttributes(model, rec.st),
		v = { slew = 0, trolley = 0, hoist = 0, rot = 0 },
		sv = { x = 0, z = 0 },
		seq = model:GetAttribute("ResetSeq") or 0,
		sendAcc = 0,
		camYaw = 0,
		camPitch = -0.38,
		orbitYaw = math.rad(30),
		orbitPitch = math.rad(-25),
		orbitDist = 60,
		assist = State.settings.assist,
		lastSolve = 0,
		contactCooldown = 0,
		recoverHold = nil,
		startedAt = os.clock(),
	}
	State.crane.operating = true
	State.crane.id = craneId
	State.crane.mode = mode
	State.crane.assist = op.assist
	sinkMovement(true)
	setView(VIEWS[mode][1])
	HUD.setCrosshair(false)
	HUD.setPrompt(nil)
	State.fire("CraneOperating", true)
end

local function clearGhost()
	if op and op.ghost then
		op.ghost:Destroy()
		op.ghost = nil
		op.ghostDef = nil
	end
end

function CraneClient.stop()
	if not op then
		return
	end
	clearGhost()
	op = nil
	State.crane.operating = false
	State.crane.id = nil
	sinkMovement(false)
	local cam = workspace.CurrentCamera
	cam.CameraType = Enum.CameraType.Custom
	UserInputService.MouseBehavior = Enum.MouseBehavior.Default
	if player.Character then
		for _, p in ipairs(player.Character:GetDescendants()) do
			if p:IsA("BasePart") then
				p.LocalTransparencyModifier = 0
			end
		end
	end
	HUD.setCrane(nil)
	HUD.setCrosshair(State.firstPerson)
	State.fire("CraneOperating", false)
end

function CraneClient.exit()
	if not op then
		return
	end
	task.spawn(function()
		Net.call("Crane", true, "Exit")
	end)
	CraneClient.stop()
end

-- Collision probe around the hook block and the hanging load.
local overlap = OverlapParams.new()
overlap.FilterType = Enum.RaycastFilterType.Include
overlap.RespectCanCollide = true

local function blocked(rec, st, load, loadDef, skipLoad)
	local site = State.site
	overlap.FilterDescendantsInstances = { site.Components, site.Environment, site.Trailers, rec.model.Static }
	local function hits(cf, size, ignore)
		for _, p in ipairs(workspace:GetPartBoundsInBox(cf, size, overlap)) do
			if not (ignore and p:IsDescendantOf(ignore)) and p.Name ~= "StrapHit" then
				local comp = p
				while comp and comp.Parent ~= site.Components do
					comp = comp.Parent
				end
				local stt = comp and comp:GetAttribute("State")
				if not comp or stt ~= "Carried" then
					return true
				end
			end
		end
		return false
	end
	local hookCf = CraneMath.blockCf(rec.cfg, st)
	if hits(hookCf * CFrame.new(0, 1.2, 0), Vector3.new(1.2, 3.4, 1.6), load) then
		return true
	end
	if load and loadDef and not skipLoad then
		local cf = riggedLoadCf(rec, st)
		if cf then
			local size = loadDef.size - Vector3.new(0.5, 0.5, 0.5)
			size = Vector3.new(math.max(size.X, 0.1), math.max(size.Y, 0.1), math.max(size.Z, 0.1))
			if hits(cf * CFrame.new(loadDef.boundsOffset), size, load) then
				return true
			end
		end
	end
	return false
end

-- Lowest point of the hook or load below which nothing may go, and the
-- surface underneath it.
local rayParams = RaycastParams.new()
rayParams.FilterType = Enum.RaycastFilterType.Exclude

local function groundClearance(rec, st, load, loadDef)
	local exclude = { rec.model, workspace.CurrentCamera }
	if load then
		table.insert(exclude, load)
	end
	if player.Character then
		table.insert(exclude, player.Character)
	end
	rayParams.FilterDescendantsInstances = exclude
	local bottom, origin
	if load and loadDef then
		local cf = riggedLoadCf(rec, st)
		local box = cf * CFrame.new(loadDef.boundsOffset)
		local h = loadDef.size / 2
		bottom = math.huge
		for _, sx in ipairs({ -1, 1 }) do
			for _, sy in ipairs({ -1, 1 }) do
				for _, sz in ipairs({ -1, 1 }) do
					bottom = math.min(bottom, (box * Vector3.new(sx * h.X, sy * h.Y, sz * h.Z)).Y)
				end
			end
		end
		origin = box.Position
	else
		local hp = CraneMath.hookPos(rec.cfg, st)
		bottom = hp.Y - 0.6
		origin = hp
	end
	local hit = workspace:Raycast(origin + Vector3.new(0, 2, 0), Vector3.new(0, -400, 0), rayParams)
	local surface = hit and hit.Position.Y or -50
	return bottom - surface
end

local contactSoundAt = 0

local function simulate(dt)
	local rec = op.rec
	local model = rec.model
	local cfg = rec.cfg
	-- server-side reset (recovery)
	local seq = model:GetAttribute("ResetSeq") or 0
	if seq ~= op.seq then
		op.seq = seq
		op.st = CraneMath.readAttributes(model, op.st)
		op.v = { slew = 0, trolley = 0, hoist = 0, rot = 0 }
		op.sv = { x = 0, z = 0 }
	end
	local locked = model:GetAttribute("Locked") == true
	local load = loadModelOf(rec)
	local loadDef = load and Registry.get(load:GetAttribute("ItemId"))
	local hanging = load and load:GetAttribute("State") == "Rigged"
	local blending = hanging and rigBlend(rec) < 1
	local blockedInput = State.uiBlocking
	local function key(k)
		return not blockedInput and UserInputService:IsKeyDown(k)
	end
	local prec = key(Enum.KeyCode.LeftShift) and K.PrecisionFactor or 1
	local slewIn = (key(Enum.KeyCode.A) and 1 or 0) - (key(Enum.KeyCode.D) and 1 or 0)
	local trolleyIn = (key(Enum.KeyCode.W) and 1 or 0) - (key(Enum.KeyCode.S) and 1 or 0)
	local hoistIn = (key(Enum.KeyCode.F) and 1 or 0) - (key(Enum.KeyCode.R) and 1 or 0)
	local rotIn = (key(Enum.KeyCode.Z) and 1 or 0) - (key(Enum.KeyCode.C) and 1 or 0)
	if locked then
		slewIn, trolleyIn, rotIn = 0, 0, 0
		hoistIn = 0
	end
	local hoistMax = hanging and K.HoistLoadedSpeed or K.HoistMaxSpeed
	local v = op.v
	local oldV = { slew = v.slew, trolley = v.trolley }
	v.slew = Util.rampVelocity(v.slew, slewIn * K.SlewMaxSpeed * prec, K.SlewAccel, K.SlewBrake, dt)
	v.trolley = Util.rampVelocity(v.trolley, trolleyIn * K.TrolleyMaxSpeed * prec, K.TrolleyAccel, K.TrolleyBrake, dt)
	v.hoist = Util.rampVelocity(v.hoist, hoistIn * hoistMax * prec, K.HoistAccel, K.HoistBrake, dt)
	v.rot = Util.rampVelocity(v.rot, rotIn * K.LoadRotateSpeed * prec, K.LoadRotateSpeed * 2, K.LoadRotateSpeed * 3, dt)

	-- brake clunk when a fast motion is released
	local fast = math.abs(oldV.slew) > K.SlewMaxSpeed * 0.5 or math.abs(oldV.trolley) > K.TrolleyMaxSpeed * 0.5
	if fast and slewIn == 0 and trolleyIn == 0 and not op.braked then
		op.braked = true
		Audio.play("CraneBrake", rec.slew.PrimaryPart)
	elseif slewIn ~= 0 or trolleyIn ~= 0 then
		op.braked = false
	end

	local st = op.st
	local prev = { slew = st.slew, trolley = st.trolley, hoist = st.hoist, swingX = st.swingX, swingZ = st.swingZ, loadYaw = st.loadYaw }
	st.slew = wrap(st.slew + v.slew * dt)
	st.trolley += v.trolley * dt
	st.hoist += v.hoist * dt
	st.loadYaw = wrap(st.loadYaw + v.rot * dt)

	-- travel limits and load chart
	local maxR = cfg.maxR
	local kg = 0
	if hanging and loadDef then
		kg = loadDef.weightKg + K.RiggingKg
		maxR = math.min(maxR, CraneMath.maxRadiusFor(cfg, kg))
	end
	if st.trolley > maxR then
		if v.trolley > 0 and kg > 0 then
			HUD.flash("LOAD MOMENT LIMIT")
		end
		st.trolley = math.max(maxR, math.min(prev.trolley, maxR))
		v.trolley = math.min(v.trolley, 0)
	elseif st.trolley < cfg.minR then
		st.trolley = cfg.minR
		v.trolley = math.max(v.trolley, 0)
	end
	if st.hoist < cfg.minRope then
		st.hoist = cfg.minRope
		v.hoist = math.max(v.hoist, 0)
	elseif st.hoist > cfg.maxRope then
		st.hoist = cfg.maxRope
		v.hoist = math.min(v.hoist, 0)
	end

	-- pendulum sway in the jib frame (small-angle model, real g at world scale)
	if locked then
		st.swingX, st.swingZ = 0, 0
		op.sv.x, op.sv.z = 0, 0
	else
		local L = math.max(st.hoist + (hanging and K.SlingDrop or 0), 2)
		local g = K.PendulumGravity
		local damping = op.assist and K.SwingDampingAssist or K.SwingDamping
		local aRad = (v.trolley - oldV.trolley) / dt - (v.slew * v.slew) * st.trolley
		local aTan = -((v.slew - oldV.slew) / dt) * st.trolley
		local steps = 4
		local h = dt / steps
		for _ = 1, steps do
			local ax = -(g / L) * st.swingX - aRad - damping * op.sv.x
			local az = -(g / L) * st.swingZ - aTan - damping * op.sv.z
			op.sv.x += ax * h
			op.sv.z += az * h
			st.swingX += op.sv.x * h
			st.swingZ += op.sv.z * h
		end
	end
	CraneMath.sanitize(cfg, st)

	-- ground / deck stop while lowering
	if v.hoist > 0 then
		local clearance = groundClearance(rec, st, hanging and load or nil, loadDef)
		if clearance < 0.15 then
			st.hoist = math.max(cfg.minRope, st.hoist - (0.15 - clearance))
			v.hoist = 0
		end
	end

	-- collision stop
	op.contactCooldown -= dt
	if not blending and blocked(rec, st, hanging and load or nil, loadDef, false) then
		local wasBlocked = blocked(rec, prev, hanging and load or nil, loadDef, false)
		if not wasBlocked then
			st.slew, st.trolley, st.hoist, st.loadYaw = prev.slew, prev.trolley, prev.hoist, prev.loadYaw
			st.swingX, st.swingZ = prev.swingX, prev.swingZ
			op.sv.x, op.sv.z = -op.sv.x * 0.3, -op.sv.z * 0.3
			v.slew, v.trolley, v.hoist, v.rot = 0, 0, 0, 0
			if op.contactCooldown <= 0 then
				op.contactCooldown = 0.6
				HUD.flash("CONTACT")
				local where = hanging and load and load:GetPivot().Position or CraneMath.hookPos(cfg, st)
				if os.clock() - contactSoundAt > 0.5 then
					contactSoundAt = os.clock()
					Audio.play(hanging and "MetalContactHeavy" or "MetalContactLight", where)
				end
			end
		end
	end

	-- stream to the server
	op.sendAcc += dt
	if op.sendAcc >= 1 / K.StreamRate then
		op.sendAcc = 0
		Remotes.get("CraneStream"):FireServer(model:GetAttribute("CraneId"), {
			slew = st.slew,
			trolley = st.trolley,
			hoist = st.hoist,
			swingX = st.swingX,
			swingZ = st.swingZ,
			loadYaw = st.loadYaw,
			seq = op.seq,
		})
	end
	return st, load, loadDef, hanging, locked, prec < 1
end

---------------------------------------------------------------------------
-- Assist, attach candidates, camera
---------------------------------------------------------------------------

local function attachCandidate(rec, st)
	local site = State.site
	local comps = site and site:FindFirstChild("Components")
	if not comps then
		return nil
	end
	local hook = CraneMath.hookPos(rec.cfg, st)
	local best, bestD = nil, math.huge
	for _, m in ipairs(comps:GetChildren()) do
		local stt = m:GetAttribute("State")
		if stt == "Loose" or stt == "Restrained" then
			local def = Registry.get(m:GetAttribute("ItemId"))
			if def then
				local lift = m:GetPivot() * CraneMath.liftCentre(def) + Vector3.new(0, K.SlingDrop, 0)
				local d = (lift - hook).Magnitude
				if d < bestD then
					best, bestD = { model = m, def = def, state = stt }, d
				end
			end
		end
	end
	if best and bestD <= K.AttachRange + 1.5 then
		return best, bestD
	end
	return nil, bestD
end

local function guidance(rec, st, loadCf, target, def)
	local slewCf = CraneMath.slewCf(rec.cfg, st.slew)
	local delta = target.Position - loadCf.Position
	local lv = slewCf:VectorToObjectSpace(delta)
	local lines = {}
	local function m(x)
		return Config.toMeters(math.abs(x))
	end
	if math.abs(lv.X) > 0.15 then
		table.insert(lines, string.format("TROLLEY %s  %.2f m   (%s)", lv.X > 0 and "OUT" or "IN", m(lv.X), lv.X > 0 and "W" or "S"))
	end
	if math.abs(lv.Z) > 0.15 then
		table.insert(lines, string.format("SLEW %s  %.2f m   (%s)", lv.Z > 0 and "RIGHT" or "LEFT", m(lv.Z), lv.Z > 0 and "D" or "A"))
	end
	if math.abs(delta.Y) > 0.15 then
		table.insert(lines, string.format("%s  %.2f m   (%s)", delta.Y < 0 and "LOWER" or "RAISE", m(delta.Y), delta.Y < 0 and "F" or "R"))
	end
	local yawErr = wrap(Util.yawOf(target) - Util.yawOf(loadCf))
	if def.symmetric180 and math.abs(yawErr) > math.pi / 2 then
		yawErr = wrap(yawErr + math.pi)
	end
	if math.abs(yawErr) > math.rad(2) then
		table.insert(lines, string.format("ROTATE %s  %d°   (%s)", yawErr > 0 and "LEFT" or "RIGHT", math.floor(math.deg(math.abs(yawErr)) + 0.5), yawErr > 0 and "Z" or "C"))
	end
	local ang = BuildRules.angleDiff(def, target, loadCf)
	local ready = delta.Magnitude <= K.LandPosTolerance and ang <= K.LandAngleTolerance
	if ready then
		table.insert(lines, 1, "ALIGNED — press ENTER to land and secure")
	end
	return table.concat(lines, "\n"), ready
end

local function updateCamera(dt, st, load)
	local rec = op.rec
	local cam = workspace.CurrentCamera
	local slewCf = CraneMath.slewCf(rec.cfg, st.slew)
	if op.view == "Cab" then
		if not State.uiBlocking then
			UserInputService.MouseBehavior = Enum.MouseBehavior.LockCenter
		end
		local d = UserInputService:GetMouseDelta()
		if not State.uiBlocking then
			op.camYaw = math.clamp(op.camYaw - d.X * 0.0035, -2.4, 2.4)
			op.camPitch = math.clamp(op.camPitch - d.Y * 0.0035, -1.35, 0.6)
		end
		local eye = slewCf * CraneMath.CabEye
		cam.CFrame = CFrame.new(eye) * slewCf.Rotation * CFrame.Angles(0, -math.pi / 2 + op.camYaw, 0) * CFrame.Angles(op.camPitch, 0, 0)
		if player.Character then
			for _, p in ipairs(player.Character:GetDescendants()) do
				if p:IsA("BasePart") then
					p.LocalTransparencyModifier = 1
				end
			end
		end
	elseif op.view == "Hook" then
		local trolley = CraneMath.trolleyCf(rec.cfg, st)
		local hookPos = CraneMath.hookPos(rec.cfg, st)
		local eye = (trolley * CFrame.new(0, -1.8, 2.2)).Position
		local focus = load and load:GetPivot().Position or hookPos
		cam.CFrame = CFrame.lookAt(eye, focus - Vector3.new(0, 6, 0), slewCf.RightVector)
	elseif op.view == "Exterior" then
		if UserInputService:IsMouseButtonPressed(Enum.UserInputType.MouseButton2) then
			UserInputService.MouseBehavior = Enum.MouseBehavior.LockCurrentPosition
			local d = UserInputService:GetMouseDelta()
			op.orbitYaw -= d.X * 0.005
			op.orbitPitch = math.clamp(op.orbitPitch - d.Y * 0.005, -1.4, 0.3)
		else
			UserInputService.MouseBehavior = Enum.MouseBehavior.Default
		end
		local focus = load and load:GetPivot().Position or CraneMath.hookPos(rec.cfg, st)
		local rot = CFrame.Angles(0, op.orbitYaw, 0) * CFrame.Angles(op.orbitPitch, 0, 0)
		local want = CFrame.new(focus) * rot * CFrame.new(0, 0, op.orbitDist)
		cam.CFrame = cam.CFrame:Lerp(want, math.min(dt * 8, 1))
	end
end

local function landNow()
	local rec = op.rec
	local load = loadModelOf(rec)
	if not load or load:GetAttribute("State") ~= "Rigged" then
		State.notify("Nothing hanging to land.", "info")
		return
	end
	local def = Registry.get(load:GetAttribute("ItemId"))
	local loadCf = riggedLoadCf(rec, op.st)
	local target, why = BuildRules.solve(State.world, def, { point = loadCf.Position }, { current = loadCf, excludeModels = { load, rec.model } })
	if not target then
		State.notify(why or "No connection near the load.", "warn")
		return
	end
	task.spawn(function()
		local ok = Net.call("Crane", false, "Land", target)
		if ok then
			op.v = { slew = 0, trolley = 0, hoist = 0, rot = 0 }
			op.sv = { x = 0, z = 0 }
		end
	end)
end

local function hookOrRelease()
	local rec = op.rec
	local load = loadModelOf(rec)
	if load then
		task.spawn(function()
			Net.call("Crane", false, "Release")
		end)
		return
	end
	local cand = attachCandidate(rec, op.st)
	if not cand then
		State.notify("Bring the hook down over a load's rigging points first.", "info")
		return
	end
	task.spawn(function()
		local ok = Net.call("Crane", false, "Attach", cand.model:GetAttribute("ComponentId"))
		if ok then
			op.st.loadYaw = 0
			Audio.play("SlingRattle", cand.model.PrimaryPart)
		end
	end)
end

local RIG_NAMES = { Bridle = "two-leg bridle", Upright = "top lug — hangs plumb", Pitch = "choker — hangs at brace angle" }

local function updateOperatorHud(st, load, loadDef, hanging, locked, precision)
	local rec = op.rec
	local cfg = rec.cfg
	local hookPos = CraneMath.hookPos(cfg, st)
	local kg = loadDef and (loadDef.weightKg + K.RiggingKg) or 0
	local cap = CraneMath.capacityKg(cfg, st.trolley)
	local data = {
		mode = op.mode,
		view = op.view,
		assist = op.assist,
		radiusM = Config.toMeters(st.trolley),
		heightM = Config.toMeters(hookPos.Y),
		slewDeg = math.deg(st.slew),
		loadName = loadDef and loadDef.name or nil,
		loadKg = kg,
		capKg = cap,
		lmi = kg / math.max(cap, 1),
		precision = precision,
	}
	local hints = {}
	if locked and load then
		local mask = load:GetAttribute("Fastened") or ""
		local done = select(2, string.gsub(mask, "1", ""))
		local need = loadDef.minFastenRelease
		if load:GetAttribute("State") == "Installed" or done >= need then
			data.guide = "Connections made. G — unhook."
			data.guideReady = true
		else
			data.guide = string.format("Crane is holding the piece in place.\nFasten %d connection%s (%d/%d done), then unhook with G.\nTip: use the radio remote from the steel or scaffold.", need, need > 1 and "s" or "", done, need)
		end
	elseif hanging then
		data.guide = "Rigging: " .. (RIG_NAMES[loadDef.rigging] or loadDef.rigging)
		if op.assist and op.target then
			local text, ready = guidance(rec, st, riggedLoadCf(rec, st), op.target, loadDef)
			data.guide = (op.targetValid and "" or ("✕ " .. (op.targetReason or "") .. "\n")) .. text
			data.guideReady = ready and op.targetValid
		elseif op.assist and op.targetReason then
			data.guide = op.targetReason
		end
		table.insert(hints, "ENTER land · G set down on ground")
	else
		local cand, d = attachCandidate(rec, st)
		if cand then
			if cand.state == "Restrained" then
				data.guide = cand.def.name .. " — release its cargo straps first."
			else
				data.guide = "G — hook " .. cand.def.name .. "\n(" .. (RIG_NAMES[cand.def.rigging] or cand.def.rigging) .. ", " .. Util.fmtKg(cand.def.weightKg) .. ")"
				data.guideReady = true
			end
		else
			data.guide = d and d < 40 and string.format("Nearest load %.1f m from the hook", Config.toMeters(d)) or "Hook free"
		end
	end
	table.insert(hints, "WASD slew/trolley · R/F hoist · Z/C rotate · Shift fine")
	table.insert(hints, "H assist · V camera · X exit · hold Y recover")
	data.hint = table.concat(hints, "\n")
	HUD.setCrane(data)
end

local function updateAssist(st, load, loadDef, hanging, locked)
	local rec = op.rec
	if not (op.assist and hanging and not locked and loadDef) then
		clearGhost()
		op.target = nil
		op.targetReason = nil
		return
	end
	if os.clock() - op.lastSolve < 0.12 then
		return
	end
	op.lastSolve = os.clock()
	local loadCf = riggedLoadCf(rec, st)
	local target, why = BuildRules.solve(State.world, loadDef, { point = loadCf.Position }, { current = loadCf, excludeModels = { load, rec.model } })
	op.target = target
	op.targetReason = why
	op.targetValid = false
	if target then
		local ok, reason = BuildRules.validate(State.world, loadDef, target, { exclude = { load:GetAttribute("ComponentId") }, excludeModels = { load } })
		op.targetValid = ok
		op.targetReason = reason
		if op.ghostDef ~= loadDef then
			clearGhost()
			op.ghost = Factory.build(loadDef, target, { ghost = true, preview = true })
			op.ghostDef = loadDef
			local h = Instance.new("Highlight")
			h.Name = "H"
			h.FillTransparency = 0.6
			h.OutlineTransparency = 0.1
			h.Parent = op.ghost
			op.ghost.Parent = workspace.CurrentCamera
		end
		op.ghost:PivotTo(target)
		local h = op.ghost:FindFirstChild("H")
		if h then
			h.FillColor = ok and Config.Colors.Valid or Config.Colors.Invalid
			h.OutlineColor = h.FillColor
		end
	else
		clearGhost()
	end
end

---------------------------------------------------------------------------
-- Loop & input
---------------------------------------------------------------------------

function CraneClient.init()
	slingFolder = Instance.new("Folder")
	slingFolder.Name = "SR_Slings"
	slingFolder.Parent = workspace.CurrentCamera

	UserInputService.InputBegan:Connect(function(input, gp)
		if gp or not op then
			return
		end
		local k = input.KeyCode
		if State.uiBlocking then
			return
		end
		if k == Enum.KeyCode.X then
			CraneClient.exit()
		elseif k == Enum.KeyCode.G then
			hookOrRelease()
		elseif k == Enum.KeyCode.Return or k == Enum.KeyCode.KeypadEnter then
			landNow()
		elseif k == Enum.KeyCode.H then
			op.assist = not op.assist
			State.crane.assist = op.assist
		elseif k == Enum.KeyCode.V then
			local views = VIEWS[op.mode]
			local idx = table.find(views, op.view) or 1
			setView(views[idx % #views + 1])
		elseif k == Enum.KeyCode.Y then
			op.recoverHold = os.clock()
		end
	end)
	UserInputService.InputEnded:Connect(function(input)
		if op and input.KeyCode == Enum.KeyCode.Y then
			op.recoverHold = nil
			HUD.setHold(nil)
		end
	end)
	UserInputService.InputChanged:Connect(function(input)
		if op and op.view == "Exterior" and input.UserInputType == Enum.UserInputType.MouseWheel then
			op.orbitDist = math.clamp(op.orbitDist - input.Position.Z * 6, 15, 260)
		end
	end)
	State.on("CraneRecover", function()
		task.spawn(function()
			Net.call("Crane", false, "Recover")
		end)
	end)
	State.on("CraneExit", CraneClient.exit)
	State.on("CraneStart", function(id, mode)
		CraneClient.start(id, mode)
	end)

	RunService:BindToRenderStep("SR_Crane", Enum.RenderPriority.Camera.Value + 1, function(dt)
		local site = State.site
		local folder = site and site:FindFirstChild("Cranes")
		if not folder then
			return
		end
		dt = math.min(dt, 1 / 20)
		for _, model in ipairs(folder:GetChildren()) do
			local rec = getRec(model)
			if rec then
				local st
				if op and op.rec == rec then
					local load, loadDef, hanging, locked, precision
					st, load, loadDef, hanging, locked, precision = simulate(dt)
					render(rec, st, dt)
					updateAssist(st, load, loadDef, hanging, locked)
					updateCamera(dt, st, load)
					updateOperatorHud(st, load, loadDef, hanging, locked, precision)
					if op.recoverHold then
						local a = (os.clock() - op.recoverHold) / 1.2
						HUD.setHold(a)
						if a >= 1 then
							op.recoverHold = nil
							HUD.setHold(nil)
							State.fire("CraneRecover")
						end
					end
				else
					local target = CraneMath.readAttributes(model, rec.st)
					local a = math.min(dt * 10, 1)
					rec.st.slew = wrap(rec.st.slew + wrap(target.slew - rec.st.slew) * a)
					rec.st.loadYaw = wrap(rec.st.loadYaw + wrap(target.loadYaw - rec.st.loadYaw) * a)
					for _, key in ipairs({ "trolley", "hoist", "swingX", "swingZ" }) do
						rec.st[key] += (target[key] - rec.st[key]) * a
					end
					render(rec, rec.st, dt)
				end
				-- operator gone (server cleared it)
				if op and op.rec == rec and os.clock() - op.startedAt > 1.5 and model:GetAttribute("Operator") ~= player.UserId then
					CraneClient.stop()
				end
			end
		end
	end)
end

function CraneClient.reset()
	CraneClient.stop()
	for _, rec in pairs(recs) do
		for _, s in ipairs(rec.slings) do
			s:Destroy()
		end
		for _, snd in ipairs({ rec.sndSlew, rec.sndTrolley, rec.sndHoist }) do
			snd:destroy()
		end
	end
	recs = {}
end

function CraneClient.isOperating()
	return op ~= nil
end

return CraneClient
