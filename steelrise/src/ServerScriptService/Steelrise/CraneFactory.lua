-- Flat-top tower crane, modelled on modern 8–10 t city cranes.
--
-- Contract used by CraneService / CraneClient (do not rename):
--   Model "TowerCrane_<id>" with attribute CraneId and children
--     Static  : foundation, mast, ladder, CraneAccess / CraneAccessTop parts
--     Slew    : moves as one (PrimaryPart "Root" at the slewing pivot, jib
--               along local +X); WinchDrum (attr Sound), CabDoor (attr CraneInteract)
--     Trolley : PrimaryPart "Root" at the sheave point (CraneMath.TrolleyY)
--     Hook    : PrimaryPart "Root" at the hook bowl (CraneMath.hookCf)
--     Cables  : Fall1, Fall2 (reshaped every frame by clients)
-- All dimensions in studs unless m() is used (3 studs = 1 m).

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Steelrise")
local Config = require(Shared.Config)
local CraneMath = require(Shared.CraneMath)

local S = Config.S
local C = Config.Colors
local M = Enum.Material
local V = Vector3.new
local CF = CFrame.new

local CraneFactory = {}

local YELLOW = Color3.fromRGB(242, 182, 16)
local YELLOW_DARK = Color3.fromRGB(206, 150, 10)
local GREY = Color3.fromRGB(72, 76, 82)
local DARK = Color3.fromRGB(34, 36, 40)
local WHITE = Color3.fromRGB(232, 232, 228)
local GLASS = Color3.fromRGB(120, 150, 165)
local GRATE = Color3.fromRGB(96, 100, 104)
local CONCRETE = Color3.fromRGB(156, 154, 148)
local ROPE = Color3.fromRGB(46, 46, 48)

local function m(x)
	return x * S
end

local function P(parent, name, size, cf, color, material, flags)
	local p = Instance.new((flags and flags.wedge) and "WedgePart" or "Part")
	p.Name = name
	p.Anchored = true
	p.Size = size
	p.CFrame = cf
	p.Color = color
	p.Material = material or M.Metal
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.CanTouch = false
	if flags then
		if flags.nc then
			p.CanCollide = false
		end
		if flags.ns then
			p.CastShadow = false
		end
		if flags.nq then
			p.CanQuery = false
		end
		if flags.tr then
			p.Transparency = flags.tr
		end
		if flags.refl then
			p.Reflectance = flags.refl
		end
		if flags.shape and not flags.wedge then
			p.Shape = flags.shape
		end
	end
	p.Parent = parent
	return p
end

local function cyl(parent, name, length, dia, cf, color, material, flags)
	local f = {}
	for k, v in pairs(flags or {}) do
		f[k] = v
	end
	f.shape = Enum.PartType.Cylinder
	return P(parent, name, V(length, dia, dia), cf, color, material, f)
end

local function lookAlong(pos, dir)
	local up = Vector3.yAxis
	if math.abs(dir.Unit.Y) > 0.98 then
		up = Vector3.xAxis
	end
	return CFrame.lookAt(pos, pos + dir, up)
end

-- square bar between two points
local function bar(parent, name, a, b, w, color, material, flags)
	local len = (b - a).Magnitude
	return P(parent, name, V(w, w, len), lookAlong((a + b) / 2, b - a), color, material, flags)
end

-- round tube between two points
local function tube(parent, name, a, b, dia, color, material, flags)
	local len = (b - a).Magnitude
	return cyl(parent, name, len, dia, lookAlong((a + b) / 2, b - a) * CFrame.Angles(0, math.pi / 2, 0), color, material, flags)
end

local function signUnsafe(part, face, text, bg, fg)
	local gui = Instance.new("SurfaceGui")
	gui.Face = face
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	gui.PixelsPerStud = 24
	gui.LightInfluence = 1
	gui.Parent = part
	local t = Instance.new("TextLabel")
	t.Size = UDim2.fromScale(1, 1)
	t.BackgroundColor3 = bg
	t.TextColor3 = fg
	t.Font = Enum.Font.GothamBlack
	t.TextScaled = true
	t.Text = text
	t.Parent = gui
	return gui
end

-- Signs are decoration: never let one stop the crane from building.
local function sign(...)
	local ok, err = pcall(signUnsafe, ...)
	if not ok then
		warn("[STEELRISE] crane sign skipped:", err)
	end
end

---------------------------------------------------------------------------
-- Static: foundation and mast
---------------------------------------------------------------------------

local function buildStatic(model, cfg)
	local static = Instance.new("Model")
	static.Name = "Static"
	static.Parent = model
	local base = cfg.base
	local Wm = CraneMath.MastWidth
	local half = Wm / 2 - 0.3

	-- foundation block with chamfer and four cast-in fixing angles
	P(static, "Foundation", V(m(7), m(0.6), m(7)), CF(base + V(0, m(0.3), 0)), CONCRETE, M.Concrete)
	P(static, "FoundationTop", V(m(6.6), m(0.06), m(6.6)), CF(base + V(0, m(0.63), 0)), Color3.fromRGB(146, 144, 138), M.Concrete, { nc = true })
	for _, sx in ipairs({ -1, 1 }) do
		for _, sz in ipairs({ -1, 1 }) do
			local c = base + V(sx * half, 0, sz * half)
			P(static, "FixingAngle", V(1.1, m(1.1), 1.1), CF(c + V(0, m(0.65) + m(0.55), 0)), YELLOW_DARK, M.Metal)
			P(static, "FixingPlate", V(2.2, 0.25, 2.2), CF(c + V(0, m(0.66), 0)), DARK, M.Metal, { nc = true })
			for _, bx in ipairs({ -0.75, 0.75 }) do
				for _, bz in ipairs({ -0.75, 0.75 }) do
					cyl(static, "AnchorNut", 0.25, 0.3, CF(c + V(bx, m(0.66) + 0.2, bz)) * CFrame.Angles(0, 0, math.pi / 2), DARK, M.Metal, { nc = true, ns = true })
				end
			end
		end
	end

	-- mast: angle-section chords, Z-laced faces, joint plates every section
	local mastBottom = base.Y + m(1.2)
	local mastTop = cfg.pivot.Y - 1.0
	local mastH = mastTop - mastBottom
	for _, sx in ipairs({ -1, 1 }) do
		for _, sz in ipairs({ -1, 1 }) do
			local cx, cz = base.X + sx * half, base.Z + sz * half
			-- an angle = two plates at right angles
			P(static, "ChordA", V(0.6, mastH, 0.16), CF(cx - sx * 0.22, mastBottom + mastH / 2, cz), YELLOW, M.Metal)
			P(static, "ChordB", V(0.16, mastH, 0.6), CF(cx, mastBottom + mastH / 2, cz - sz * 0.22), YELLOW, M.Metal)
		end
	end
	local section = m(3)
	local nSec = math.max(1, math.floor(mastH / section + 0.5))
	section = mastH / nSec
	local corners = { V(-half, 0, -half), V(half, 0, -half), V(half, 0, half), V(-half, 0, half) }
	for k = 0, nSec - 1 do
		local y0 = mastBottom + k * section
		local y1 = y0 + section
		for f = 1, 4 do
			local a, b = corners[f], corners[f % 4 + 1]
			local entry = (k == 0 and f == 1)
			local function at(v, y)
				return V(base.X + v.X, y, base.Z + v.Z)
			end
			if not entry then
				-- K-lacing: two diagonals meeting at mid-height of the far edge
				local mid = (y0 + y1) / 2
				bar(static, "Lacing", at(a, y0 + 0.4), at(b, mid), 0.24, YELLOW, M.Metal, { ns = true })
				bar(static, "Lacing", at(b, mid), at(a, y1 - 0.4), 0.24, YELLOW, M.Metal, { ns = true })
				bar(static, "Strut", at(b, mid) - (b - a) * 0.0, at(a, mid), 0.18, YELLOW, M.Metal, { ns = true })
			end
			bar(static, "Girt", at(a, y0 + 0.15), at(b, y0 + 0.15), 0.22, YELLOW, M.Metal, { ns = true, nc = entry })
		end
		-- bolted section joint: four fish plates
		if k > 0 then
			for _, c in ipairs(corners) do
				P(static, "FishPlate", V(0.9, 0.9, 0.9), CF(base.X + c.X, y0, base.Z + c.Z), YELLOW_DARK, M.Metal, { nc = true, ns = true })
			end
		end
		-- rest platform every fourth section (half grating, ladder side open)
		if k > 0 and k % 4 == 0 then
			P(static, "RestPlatform", V(Wm - 0.8, 0.15, (Wm - 0.8) / 2 - 1.1), CF(base.X, y0 + 0.2, base.Z + (Wm - 0.8) / 4 + 0.55), GRATE, M.DiamondPlate, { ns = true })
		end
	end
	-- climbing ladder inside the mast (climbable)
	local okLadder, ladderErr = pcall(function()
		local truss = Instance.new("TrussPart")
		truss.Name = "MastLadder"
		truss.Anchored = true
		truss.Size = V(2, 2 * math.max(1, math.floor(mastH / 2)), 2)
		truss.CFrame = CF(base.X, mastBottom + truss.Size.Y / 2, base.Z - 0.6)
		truss.Color = Color3.fromRGB(196, 198, 202)
		truss.Material = M.Metal
		truss.Parent = static
		pcall(function()
			truss.Style = Enum.Style.AlternateSupports
		end)
	end)
	if not okLadder then
		warn("[STEELRISE] mast ladder skipped:", ladderErr)
	end

	-- landing at the mast top (ring around the ladder opening)
	local ringOuter = Wm + 2.4
	local ringW = (ringOuter - 2.6) / 2
	for _, s in ipairs({ -1, 1 }) do
		P(static, "TopPlatform", V(ringW, 0.3, ringOuter), CF(base.X + s * (1.3 + ringW / 2), mastTop - 0.2, base.Z), GRATE, M.DiamondPlate)
		P(static, "TopPlatform", V(2.6, 0.3, ringW), CF(base.X, mastTop - 0.2, base.Z + s * (1.3 + ringW / 2)), GRATE, M.DiamondPlate)
		P(static, "TopRail", V(ringOuter, 0.18, 0.18), CF(base.X, mastTop + 3.2, base.Z + s * (ringOuter / 2)), YELLOW, M.Metal, { nc = true })
		P(static, "TopRail", V(0.18, 0.18, ringOuter), CF(base.X + s * (ringOuter / 2), mastTop + 3.2, base.Z), YELLOW, M.Metal, { nc = true })
		for _, t in ipairs({ -1, 1 }) do
			P(static, "TopPost", V(0.18, 3.4, 0.18), CF(base.X + s * ringOuter / 2, mastTop + 1.5, base.Z + t * ringOuter / 2), YELLOW, M.Metal, { nc = true, ns = true })
		end
	end
	local topAccess = P(static, "CraneAccessTop", V(Wm + 2, 5, Wm + 2), CF(base.X, mastTop + 2.4, base.Z), YELLOW, M.Metal, { tr = 1, nc = true })
	topAccess:SetAttribute("CraneInteract", "Access")
	cyl(static, "SlewRing", 0.8, Wm + 1.0, CF(cfg.pivot - V(0, 0.6, 0)) * CFrame.Angles(0, 0, math.pi / 2), DARK, M.Metal, { nc = true })

	-- access gate, safety sign and load chart at the base
	local gateZ = -(Wm / 2 + 1.2)
	local access = P(static, "CraneAccess", V(Wm + 1, m(2.4), 1), CF(base + V(0, m(0.65) + m(1.2), gateZ)), YELLOW, M.Metal, { tr = 0.85, nc = true })
	access:SetAttribute("CraneInteract", "Access")
	for _, s in ipairs({ -1, 1 }) do
		P(static, "GatePost", V(0.25, m(2.2), 0.25), CF(base + V(s * (Wm / 2 + 0.6), m(0.65) + m(1.1), gateZ)), YELLOW, M.Metal, { ns = true })
	end
	P(static, "GateRail", V(Wm + 1.2, 0.2, 0.2), CF(base + V(0, m(0.65) + m(2.2), gateZ)), YELLOW, M.Metal, { nc = true, ns = true })
	local gateSign = P(static, "AccessSign", V(2.6, 1.5, 0.1), CF(base + V(0, m(1.9), gateZ - 0.15)), C.Safety, M.SmoothPlastic, { nc = true })
	sign(gateSign, Enum.NormalId.Front, "CRANE ACCESS\nAUTHORISED OPERATORS", C.Safety, C.Charcoal)
	local chart = P(static, "LoadChart", V(2.6, 2.0, 0.1), CF(base + V(Wm / 2 + 0.9, m(1.8), 0)) * CFrame.Angles(0, -math.pi / 2, 0), WHITE, M.SmoothPlastic, { nc = true })
	local lines = { string.format("LOAD CHART  %d t", math.floor(cfg.maxKg / 1000 + 0.5)) }
	for _, r in ipairs({ cfg.fullRadiusM, 30, 40, 50, 60 }) do
		if m(r) <= cfg.maxR + 1 then
			table.insert(lines, string.format("%2d m  %5.1f t", r, Config.craneCapacityKg(cfg, m(r)) / 1000))
		end
	end
	sign(chart, Enum.NormalId.Front, table.concat(lines, "\n"), WHITE, C.Charcoal)
	return static
end

---------------------------------------------------------------------------
-- Slewing assembly: platform, cab, jib, counter-jib
---------------------------------------------------------------------------

local function buildSlew(model, cfg)
	local slew = Instance.new("Model")
	slew.Name = "Slew"
	slew.Parent = model
	local frame = CF(cfg.pivot)
	local function sp(name, size, localCf, color, material, flags)
		return P(slew, name, size, frame * localCf, color, material, flags)
	end
	local function sbar(name, a, b, w, color, flags)
		return bar(slew, name, frame * a, frame * b, w, color or YELLOW, M.Metal, flags)
	end
	local root = sp("Root", V(0.4, 0.4, 0.4), CF(), YELLOW, M.Metal, { tr = 1, nc = true, nq = true, ns = true })
	slew.PrimaryPart = root
	local Wm = CraneMath.MastWidth
	local jy, jh, jw = CraneMath.JibBottomY, CraneMath.JibHeight, CraneMath.JibWidth

	-- slewing ring, platform and machinery
	cyl(slew, "Turntable", 1.0, Wm + 0.8, frame * CF(0, 0.3, 0) * CFrame.Angles(0, 0, math.pi / 2), YELLOW, M.Metal, { nc = true })
	cyl(slew, "RingGear", 0.35, Wm + 1.1, frame * CF(0, -0.05, 0) * CFrame.Angles(0, 0, math.pi / 2), DARK, M.Metal, { nc = true, ns = true })
	sp("SlewPlatform", V(Wm + 2.2, 1.4, Wm + 1.4), CF(0, 1.2, 0), YELLOW, M.Metal, { nc = true })
	sp("PlatformDeck", V(Wm + 3.4, 0.15, Wm + 3.0), CF(0, 1.98, 0), GRATE, M.DiamondPlate, { nc = true })
	for _, sz in ipairs({ -1, 1 }) do
		cyl(slew, "SlewMotor", 1.6, 0.9, frame * CF(-1.4, 2.8, sz * 1.6) * CFrame.Angles(0, 0, math.pi / 2), GREY, M.Metal, { nc = true })
		sp("SlewGearbox", V(1.0, 0.7, 1.0), CF(-1.4, 1.95, sz * 1.6), DARK, M.Metal, { nc = true, ns = true })
	end
	sp("ElectricalBox", V(1.6, 2.4, 1.0), CF(-2.0, 3.2, -0.2), WHITE, M.Metal, { nc = true })
	-- jib root / heel pins
	for _, sz in ipairs({ -1, 1 }) do
		sp("JibHeel", V(2.4, 2.2, 0.5), CF(2.2, jy + 0.6, sz * jw / 2), YELLOW_DARK, M.Metal, { nc = true })
		cyl(slew, "HeelPin", 0.9, 0.5, frame * CF(2.2, jy + 0.4, sz * jw / 2) * CFrame.Angles(0, math.pi / 2, 0), GREY, M.Metal, { nc = true, ns = true })
	end
	-- anemometer and beacon on a mast above the platform
	sp("AnemometerMast", V(0.18, 7, 0.18), CF(0.5, jy + jh + 2.5, -1.2), YELLOW, M.Metal, { nc = true, ns = true })
	sp("AnemometerArm", V(1.2, 0.08, 0.08), CF(0.5, jy + jh + 6.0, -1.2), GREY, M.Metal, { nc = true, ns = true })
	for _, dx in ipairs({ -0.6, 0.6 }) do
		P(slew, "Cup", V(0.3, 0.3, 0.3), frame * CF(0.5 + dx, jy + jh + 6.0, -1.2), WHITE, M.SmoothPlastic, { nc = true, ns = true, shape = Enum.PartType.Ball })
	end
	local topLight = sp("TopBeacon", V(0.45, 0.45, 0.45), CF(0.5, jy + jh + 6.3, -1.2), Color3.fromRGB(255, 40, 30), M.Neon, { nc = true, ns = true })
	topLight.Shape = Enum.PartType.Ball

	-- jib: triangular lattice with walkway, section pins and tip
	local jibStart, jibEnd = 2.4, cfg.jib
	local jl = jibEnd - jibStart
	for _, sz in ipairs({ -1, 1 }) do
		-- bottom chords are the trolley rails: a box with a running flange
		sp("JibChord", V(jl, 0.55, 0.55), CF(jibStart + jl / 2, jy, sz * jw / 2), YELLOW, M.Metal, { nc = true })
		sp("RailFlange", V(jl, 0.12, 0.9), CF(jibStart + jl / 2, jy + 0.33, sz * jw / 2), YELLOW_DARK, M.Metal, { nc = true, ns = true })
	end
	sp("JibTopChord", V(jl, 0.5, 0.5), CF(jibStart + jl / 2, jy + jh, 0), YELLOW, M.Metal, { nc = true })
	sp("Walkway", V(jl - 1, 0.1, 0.9), CF(jibStart + jl / 2, jy - 0.35, -jw / 2 - 0.75), GRATE, M.DiamondPlate, { nc = true, ns = true })
	sp("WalkwayRail", V(jl - 1, 0.1, 0.1), CF(jibStart + jl / 2, jy + 2.4, -jw / 2 - 1.15), YELLOW, M.Metal, { nc = true, ns = true })
	local bayLen = 9
	local nb = math.floor(jl / bayLen)
	for k = 0, nb - 1 do
		local x0 = jibStart + k * bayLen
		local xm = x0 + bayLen / 2
		local x1 = x0 + bayLen
		for _, sz in ipairs({ -1, 1 }) do
			sbar("JibLace", V(x0, jy + 0.2, sz * jw / 2), V(xm, jy + jh - 0.1, 0), 0.24, YELLOW, { nc = true, ns = true })
			sbar("JibLace", V(xm, jy + jh - 0.1, 0), V(x1, jy + 0.2, sz * jw / 2), 0.24, YELLOW, { nc = true, ns = true })
		end
		sbar("JibTie", V(x0, jy, -jw / 2), V(x0, jy, jw / 2), 0.2, YELLOW, { nc = true, ns = true })
		sbar("JibPlanBrace", V(x0, jy, -jw / 2), V(x1, jy, jw / 2), 0.16, YELLOW, { nc = true, ns = true })
		if k % 3 == 0 and k > 0 then
			for _, sz in ipairs({ -1, 1 }) do
				sp("SectionPin", V(0.7, 0.9, 0.9), CF(x0, jy, sz * jw / 2), YELLOW_DARK, M.Metal, { nc = true, ns = true })
			end
			sp("SectionPinTop", V(0.7, 0.8, 0.8), CF(x0, jy + jh, 0), YELLOW_DARK, M.Metal, { nc = true, ns = true })
		end
		-- walkway handrail posts
		sp("RailPost", V(0.1, 2.5, 0.1), CF(x0, jy + 1.15, -jw / 2 - 1.15), YELLOW, M.Metal, { nc = true, ns = true })
	end
	sp("JibTip", V(0.8, jh + 0.6, jw + 0.6), CF(jibEnd, jy + jh / 2, 0), YELLOW, M.Metal, { nc = true })
	sp("TipBuffer", V(0.6, 0.6, jw), CF(jibEnd - 0.7, jy - 0.1, 0), DARK, M.SmoothPlastic, { nc = true, ns = true })
	local tipLight = sp("AviationLight", V(0.5, 0.5, 0.5), CF(jibEnd, jy + jh + 0.6, 0), Color3.fromRGB(255, 40, 30), M.Neon, { nc = true, ns = true })
	tipLight.Shape = Enum.PartType.Ball
	-- trolley drive rope and hoist rope running along the jib
	tube(slew, "TrolleyRope", frame * V(jibStart + 0.5, jy - 0.15, 0.35), frame * V(jibEnd - 0.8, jy - 0.15, 0.35), 0.07, ROPE, M.Metal, { nc = true, ns = true, nq = true })
	tube(slew, "HoistRope", frame * V(-8, jy + 2.6, 0), frame * V(jibEnd - 0.8, jy - 0.15, -0.35), 0.08, ROPE, M.Metal, { nc = true, ns = true, nq = true })

	-- counter-jib: twin girders, walkway, winch, electrics, counterweights
	local cl = cfg.counter
	for _, sz in ipairs({ -1, 1 }) do
		sp("CounterGirder", V(cl, 1.4, 0.7), CF(-cl / 2 - 1.5, jy + 0.5, sz * 1.9), YELLOW, M.Metal, { nc = true })
		sp("Handrail", V(cl, 0.15, 0.15), CF(-cl / 2 - 1.5, jy + 3.6, sz * 2.75), YELLOW, M.Metal, { nc = true, ns = true })
		sp("MidRail", V(cl, 0.1, 0.1), CF(-cl / 2 - 1.5, jy + 2.4, sz * 2.75), YELLOW, M.Metal, { nc = true, ns = true })
		local posts = math.max(2, math.floor(cl / 5))
		for k = 0, posts do
			sp("RailPost", V(0.15, 2.4, 0.15), CF(-2 - k * (cl - 2) / posts, jy + 2.4, sz * 2.75), YELLOW, M.Metal, { nc = true, ns = true })
		end
		sbar("CounterTie", V(-1.5, jy + 3.2, sz * 1.9), V(-cl * 0.6, jy + 1.2, sz * 1.9), 0.25, YELLOW, { nc = true, ns = true })
	end
	for k = 0, math.floor(cl / 3) do
		sp("CounterCross", V(0.3, 0.3, 3.8), CF(-1.5 - k * 3, jy - 0.1, 0), YELLOW, M.Metal, { nc = true, ns = true })
	end
	sp("CounterWalkway", V(cl, 0.15, 5.0), CF(-cl / 2 - 1.5, jy + 1.25, 0), GRATE, M.DiamondPlate, { nc = true })
	-- hoist winch: motor, gearbox, drum with rope wraps, brake
	local wx = -7.5
	cyl(slew, "WinchMotor", 2.2, 1.4, frame * CF(wx, jy + 2.2, -1.6) * CFrame.Angles(0, math.pi / 2, 0), GREY, M.Metal, { nc = true })
	sp("WinchGearbox", V(1.6, 1.6, 1.0), CF(wx, jy + 2.2, -0.15), DARK, M.Metal, { nc = true })
	local drum = cyl(slew, "WinchDrum", 2.6, 1.7, frame * CF(wx, jy + 2.2, 1.7) * CFrame.Angles(0, math.pi / 2, 0), YELLOW_DARK, M.Metal, { nc = true })
	drum:SetAttribute("Sound", "Hoist")
	cyl(slew, "DrumRope", 2.2, 1.85, frame * CF(wx, jy + 2.2, 1.7) * CFrame.Angles(0, math.pi / 2, 0), ROPE, M.Metal, { nc = true, ns = true })
	for _, dz in ipairs({ 0.3, 3.1 }) do
		cyl(slew, "DrumFlange", 0.15, 2.2, frame * CF(wx, jy + 2.2, dz) * CFrame.Angles(0, math.pi / 2, 0), YELLOW, M.Metal, { nc = true, ns = true })
	end
	sp("WinchFrame", V(3.0, 0.4, 5.2), CF(wx, jy + 1.35, 0.4), DARK, M.Metal, { nc = true, ns = true })
	sp("ElectricHouse", V(3.0, 2.6, 2.4), CF(-12.5, jy + 2.6, -0.9), WHITE, M.Metal, { nc = true })
	sp("HouseDoor", V(1.0, 2.0, 0.05), CF(-12.5, jy + 2.4, -2.13), Color3.fromRGB(200, 200, 196), M.Metal, { nc = true, ns = true })
	sp("HouseRoof", V(3.2, 0.15, 2.6), CF(-12.5, jy + 3.95, -0.9), GREY, M.Metal, { nc = true, ns = true })
	-- counterweights: concrete slabs hung from the tail with steel straps
	local slabs = 5
	local slabT = 1.0
	local tailX = -cl - 1.5
	for k = 0, slabs - 1 do
		local x = tailX + 0.6 + k * (slabT + 0.08)
		sp("Counterweight", V(slabT, m(2.4), 4.6), CF(x, jy - m(0.55), 0), CONCRETE, M.Concrete, { nc = true })
		sp("LiftEye", V(0.3, 0.4, 0.15), CF(x, jy + m(0.67), 1.6), DARK, M.Metal, { nc = true, ns = true })
	end
	for _, sz in ipairs({ -1, 1 }) do
		sp("WeightStrap", V(slabs * 1.1 + 0.4, 0.3, 0.12), CF(tailX + 0.6 + (slabs - 1) * 0.54, jy + 0.9, sz * 2.35), DARK, M.Metal, { nc = true, ns = true })
	end
	sp("TailRail", V(0.15, 0.15, 5.6), CF(tailX - 0.2, jy + 3.6, 0), YELLOW, M.Metal, { nc = true, ns = true })
	-- branding plates on the counter-jib railing
	for _, sz in ipairs({ -1, 1 }) do
		local brand = sp("Brand", V(cl * 0.42, 1.6, 0.12), CF(-cl / 2 - 1.5, jy + 3.0, sz * 2.85), C.Charcoal, M.Metal, { nc = true, ns = true })
		sign(brand, sz > 0 and Enum.NormalId.Back or Enum.NormalId.Front, "STEELRISE", C.Charcoal, YELLOW)
	end

	-- operator cab: framed glazing, roof AC, wiper, access platform
	local co = CraneMath.CabOffset
	local cabCf = frame * CF(co)
	local function cp(name, size, localCf, color, material, flags)
		return P(slew, name, size, cabCf * localCf, color, material, flags)
	end
	cp("CabFloor", V(3.8, 0.25, 3.2), CF(0, -2.25, 0), DARK, M.DiamondPlate, { nc = true })
	cp("CabRoof", V(4.0, 0.3, 3.4), CF(0, 2.25, 0), WHITE, M.Metal, { nc = true })
	cp("CabBack", V(0.2, 4.4, 3.2), CF(-1.9, 0, 0), WHITE, M.Metal, { nc = true })
	cp("CabSideIn", V(3.8, 4.4, 0.2), CF(0, 0, -1.6), WHITE, M.Metal, { nc = true })
	cp("CabSideLow", V(3.8, 1.3, 0.2), CF(0, -1.55, 1.6), WHITE, M.Metal, { nc = true })
	local side = cp("CabSideGlass", V(3.2, 2.7, 0.06), CF(0.1, 0.7, 1.6), GLASS, M.Glass, { nc = true, tr = 0.45, refl = 0.15, ns = true })
	side.CanQuery = false
	local front = cp("CabFrontGlass", V(0.06, 4.0, 3.0), CF(1.9, 0, 0) * CFrame.Angles(0, 0, math.rad(-8)), GLASS, M.Glass, { nc = true, tr = 0.5, refl = 0.12, ns = true })
	front.CanQuery = false
	cp("CabFloorGlass", V(1.4, 0.06, 2.6), CF(1.1, -2.1, 0), GLASS, M.Glass, { nc = true, tr = 0.55, ns = true, nq = true })
	-- window frames
	for _, z in ipairs({ -1.55, 0, 1.55 }) do
		cp("FrontFrame", V(0.15, 4.0, 0.12), CF(1.92, 0, z) * CFrame.Angles(0, 0, math.rad(-8)), DARK, M.Metal, { nc = true, ns = true })
	end
	cp("FrontSill", V(0.2, 0.15, 3.2), CF(1.95, -1.95, 0), DARK, M.Metal, { nc = true, ns = true })
	cp("FrontHead", V(0.2, 0.15, 3.2), CF(1.65, 1.95, 0), DARK, M.Metal, { nc = true, ns = true })
	cp("SideMullion", V(0.12, 2.7, 0.12), CF(0.1, 0.7, 1.62), DARK, M.Metal, { nc = true, ns = true })
	cp("Wiper", V(0.05, 1.6, 0.06), CF(2.02, -0.6, 0.4) * CFrame.Angles(math.rad(25), 0, 0), DARK, M.Metal, { nc = true, ns = true })
	cp("RoofAC", V(1.2, 0.5, 1.0), CF(-0.9, 2.65, 0), WHITE, M.Metal, { nc = true })
	cp("Seat", V(1.0, 0.3, 1.0), CF(0.1, -1.3, 0), C.Charcoal, M.Fabric, { nc = true })
	cp("SeatBack", V(0.25, 1.4, 1.0), CF(-0.45, -0.6, 0), C.Charcoal, M.Fabric, { nc = true })
	cp("ConsoleL", V(0.9, 0.7, 0.35), CF(0.5, -1.0, -0.8), C.Charcoal, M.SmoothPlastic, { nc = true })
	cp("ConsoleR", V(0.9, 0.7, 0.35), CF(0.5, -1.0, 0.8), C.Charcoal, M.SmoothPlastic, { nc = true })
	local screen = cp("Display", V(0.06, 0.5, 0.8), CF(1.5, -0.2, -0.9), Color3.fromRGB(20, 60, 80), M.Neon, { nc = true, ns = true })
	screen.Transparency = 0.2
	local door = cp("CabDoor", V(3.6, 4.0, 0.3), CF(0, 0, -1.75), YELLOW, M.Metal, { tr = 0.9, nc = true })
	door:SetAttribute("CraneInteract", "Cab")
	cp("CabWalk", V(3.4, 0.15, 2.0), CF(0, -2.3, -2.6), GRATE, M.DiamondPlate, { nc = true, ns = true })
	return slew
end

---------------------------------------------------------------------------
-- Trolley and hook block
---------------------------------------------------------------------------

local function buildTrolley(model, cfg, st)
	local trolley = Instance.new("Model")
	trolley.Name = "Trolley"
	trolley.Parent = model
	local tcf = CraneMath.trolleyCf(cfg, st)
	local root = P(trolley, "Root", V(0.3, 0.3, 0.3), tcf, YELLOW, M.Metal, { tr = 1, nc = true, nq = true, ns = true })
	trolley.PrimaryPart = root
	local jw = CraneMath.JibWidth
	P(trolley, "Frame", V(3.4, 0.7, jw + 0.9), tcf * CF(0, 1.0, 0), YELLOW, M.Metal, { nc = true })
	for _, sx in ipairs({ -1.3, 1.3 }) do
		for _, sz in ipairs({ -1, 1 }) do
			cyl(trolley, "Wheel", 0.35, 0.65, tcf * CF(sx, 1.85, sz * jw / 2) * CFrame.Angles(0, math.pi / 2, 0), DARK, M.Metal, { nc = true, ns = true })
			P(trolley, "WheelBracket", V(0.9, 0.9, 0.15), tcf * CF(sx, 1.6, sz * (jw / 2 + 0.3)), YELLOW_DARK, M.Metal, { nc = true, ns = true })
		end
	end
	for _, sx in ipairs({ -0.55, 0.55 }) do
		cyl(trolley, "Sheave", 0.3, 1.0, tcf * CF(sx, 0.25, 0) * CFrame.Angles(0, math.pi / 2, 0), DARK, M.Metal, { nc = true, ns = true })
		P(trolley, "SheaveGuard", V(1.1, 0.8, 0.12), tcf * CF(sx, 0.3, 0.25), YELLOW, M.Metal, { nc = true, ns = true })
	end
	-- maintenance basket hanging off one side
	local bcf = tcf * CF(0, -0.8, -(jw / 2 + 1.4))
	P(trolley, "BasketFloor", V(2.2, 0.1, 1.2), bcf * CF(0, -1.2, 0), GRATE, M.DiamondPlate, { nc = true, ns = true })
	for _, sx in ipairs({ -1.05, 1.05 }) do
		for _, sz in ipairs({ -0.55, 0.55 }) do
			P(trolley, "BasketPost", V(0.1, 2.6, 0.1), bcf * CF(sx, 0, sz), YELLOW, M.Metal, { nc = true, ns = true })
		end
	end
	P(trolley, "BasketRail", V(2.2, 0.1, 0.1), bcf * CF(0, 0, -0.55), YELLOW, M.Metal, { nc = true, ns = true })
	P(trolley, "BasketRail", V(2.2, 0.1, 0.1), bcf * CF(0, 0, 0.55), YELLOW, M.Metal, { nc = true, ns = true })
	return trolley
end

local function buildHook(model, cfg, st)
	local hook = Instance.new("Model")
	hook.Name = "Hook"
	hook.Parent = model
	local hcf = CraneMath.hookCf(cfg, st)
	local root = P(hook, "Root", V(0.3, 0.3, 0.3), hcf, YELLOW, M.Metal, { tr = 1, nc = true, nq = true, ns = true })
	hook.PrimaryPart = root
	-- block body with striped side plates and a capacity plate
	P(hook, "Block", V(1.3, 2.0, 1.6), hcf * CF(0, 1.9, 0), YELLOW, M.Metal, { nc = true })
	for _, sz in ipairs({ -1, 1 }) do
		P(hook, "SidePlate", V(1.6, 2.3, 0.12), hcf * CF(0, 1.95, sz * 0.86), YELLOW, M.Metal, { nc = true })
		for k = 0, 3 do
			P(hook, "Stripe", V(0.3, 2.2, 0.03), hcf * CF(-0.6 + k * 0.4, 1.95, sz * 0.93) * CFrame.Angles(0, 0, math.rad(30)), k % 2 == 0 and C.Charcoal or YELLOW, M.SmoothPlastic, { nc = true, ns = true })
		end
	end
	local plate = P(hook, "CapacityPlate", V(0.9, 0.45, 0.04), hcf * CF(0, 1.3, 0.95), WHITE, M.SmoothPlastic, { nc = true, ns = true })
	sign(plate, Enum.NormalId.Back, string.format("SWL %d t", math.floor(cfg.maxKg / 1000 + 0.5)), WHITE, C.Charcoal)
	for _, dz in ipairs({ -0.35, 0.35 }) do
		cyl(hook, "BlockSheave", 0.25, 1.2, hcf * CF(0, 2.9, dz) * CFrame.Angles(0, math.pi / 2, 0), DARK, M.Metal, { nc = true, ns = true })
	end
	-- swivel, shank and forged hook with safety latch
	cyl(hook, "Swivel", 0.35, 0.7, hcf * CF(0, 0.85, 0) * CFrame.Angles(0, 0, math.pi / 2), DARK, M.Metal, { nc = true })
	cyl(hook, "Shank", 0.6, 0.38, hcf * CF(0, 0.45, 0) * CFrame.Angles(0, 0, math.pi / 2), GREY, M.Metal, { nc = true })
	local bowl = { { -0.32, 0.1, -25 }, { -0.22, -0.25, -60 }, { 0.05, -0.38, 0 }, { 0.3, -0.25, 60 }, { 0.38, 0.05, 90 } }
	for i, seg in ipairs(bowl) do
		P(hook, "HookBowl" .. i, V(0.32, 0.26, 0.3), hcf * CF(seg[1], seg[2], 0) * CFrame.Angles(0, 0, math.rad(seg[3])), YELLOW, M.Metal, { nc = true })
	end
	P(hook, "HookBack", V(0.3, 0.55, 0.3), hcf * CF(-0.34, 0.32, 0), YELLOW, M.Metal, { nc = true })
	P(hook, "Latch", V(0.06, 0.6, 0.08), hcf * CF(0.05, 0.2, 0) * CFrame.Angles(0, 0, math.rad(-40)), DARK, M.Metal, { nc = true, ns = true })
	return hook
end

---------------------------------------------------------------------------

---------------------------------------------------------------------------
-- Minimal fallbacks: plain blocks with the same names and pivots, used for
-- any section whose detailed build fails, so the crane always works.
---------------------------------------------------------------------------

local function fallbackStatic(model, cfg)
	local static = Instance.new("Model")
	static.Name = "Static"
	static.Parent = model
	local base = cfg.base
	local Wm = CraneMath.MastWidth
	local mastTop = cfg.pivot.Y - 1.0
	P(static, "Foundation", V(m(7), m(0.6), m(7)), CF(base + V(0, m(0.3), 0)), CONCRETE, M.Concrete)
	P(static, "Mast", V(Wm, mastTop - base.Y - m(0.6), Wm), CF(base.X, (mastTop + base.Y + m(0.6)) / 2, base.Z), YELLOW, M.Metal, { tr = 0.3 })
	local access = P(static, "CraneAccess", V(Wm + 1, m(2.4), 1), CF(base + V(0, m(1.8), -(Wm / 2 + 1.2))), YELLOW, M.Metal, { tr = 0.6, nc = true })
	access:SetAttribute("CraneInteract", "Access")
	local top = P(static, "CraneAccessTop", V(Wm + 2, 5, Wm + 2), CF(base.X, mastTop + 2.4, base.Z), YELLOW, M.Metal, { tr = 1, nc = true })
	top:SetAttribute("CraneInteract", "Access")
	return static
end

local function fallbackSlew(model, cfg)
	local slew = Instance.new("Model")
	slew.Name = "Slew"
	slew.Parent = model
	local frame = CF(cfg.pivot)
	local root = P(slew, "Root", V(0.4, 0.4, 0.4), frame, YELLOW, M.Metal, { tr = 1, nc = true, nq = true, ns = true })
	slew.PrimaryPart = root
	local jy, jh = CraneMath.JibBottomY, CraneMath.JibHeight
	P(slew, "Jib", V(cfg.jib - 2.4, jh, CraneMath.JibWidth), frame * CF(2.4 + (cfg.jib - 2.4) / 2, jy + jh / 2, 0), YELLOW, M.Metal, { nc = true, tr = 0.4 })
	P(slew, "CounterJib", V(cfg.counter, 1.4, 4), frame * CF(-cfg.counter / 2 - 1.5, jy + 0.5, 0), YELLOW, M.Metal, { nc = true })
	P(slew, "Counterweight", V(5, m(2.4), 4.6), frame * CF(-cfg.counter, jy - m(0.55), 0), CONCRETE, M.Concrete, { nc = true })
	local drum = P(slew, "WinchDrum", V(2, 2, 2), frame * CF(-7.5, jy + 2.2, 1.7), YELLOW_DARK, M.Metal, { nc = true })
	drum:SetAttribute("Sound", "Hoist")
	local cab = frame * CF(CraneMath.CabOffset)
	P(slew, "Cab", V(3.8, 4.4, 3.2), cab, WHITE, M.Metal, { nc = true, tr = 0.5 })
	local door = P(slew, "CabDoor", V(3.6, 4.0, 0.3), cab * CF(0, 0, -1.75), YELLOW, M.Metal, { tr = 0.9, nc = true })
	door:SetAttribute("CraneInteract", "Cab")
	return slew
end

local function fallbackTrolley(model, cfg, st)
	local trolley = Instance.new("Model")
	trolley.Name = "Trolley"
	trolley.Parent = model
	local tcf = CraneMath.trolleyCf(cfg, st)
	trolley.PrimaryPart = P(trolley, "Root", V(0.3, 0.3, 0.3), tcf, YELLOW, M.Metal, { tr = 1, nc = true, nq = true, ns = true })
	P(trolley, "Frame", V(3.4, 1.2, CraneMath.JibWidth + 0.9), tcf * CF(0, 0.9, 0), YELLOW, M.Metal, { nc = true })
	return trolley
end

local function fallbackHook(model, cfg, st)
	local hook = Instance.new("Model")
	hook.Name = "Hook"
	hook.Parent = model
	local hcf = CraneMath.hookCf(cfg, st)
	hook.PrimaryPart = P(hook, "Root", V(0.3, 0.3, 0.3), hcf, YELLOW, M.Metal, { tr = 1, nc = true, nq = true, ns = true })
	P(hook, "Block", V(1.3, 2.0, 1.6), hcf * CF(0, 1.9, 0), YELLOW, M.Metal, { nc = true })
	P(hook, "HookBowl", V(0.9, 0.5, 0.3), hcf * CF(0, -0.1, 0), YELLOW, M.Metal, { nc = true })
	return hook
end

function CraneFactory.build(craneDef, id)
	local cfg = CraneMath.config(craneDef)
	local model = Instance.new("Model")
	model.Name = "TowerCrane_" .. id
	model:SetAttribute("CraneId", id)
	pcall(function()
		model.ModelStreamingMode = Enum.ModelStreamingMode.Persistent
	end)
	local st = CraneMath.defaultState(craneDef)
	local warnings = {}

	-- each section is built in isolation; a failure falls back to plain blocks
	local function section(name, detailed, fallback, ...)
		local ok, result = pcall(detailed, model, cfg, ...)
		if ok and result and result.Parent == model then
			return result
		end
		local msg = tostring(result)
		warn("[STEELRISE] crane section '" .. name .. "' failed, using a simple version:", msg)
		table.insert(warnings, name .. ": " .. (string.match(msg, "^[^\n]+") or msg))
		local partial = model:FindFirstChild(name)
		if partial then
			partial:Destroy()
		end
		return fallback(model, cfg, ...)
	end

	section("Static", buildStatic, fallbackStatic)
	local slew = section("Slew", buildSlew, fallbackSlew)
	pcall(function()
		slew:PivotTo(CraneMath.slewCf(cfg, st.slew))
	end)
	section("Trolley", buildTrolley, fallbackTrolley, st)
	section("Hook", buildHook, fallbackHook, st)

	local cables = Instance.new("Folder")
	cables.Name = "Cables"
	cables.Parent = model
	local tcf = CraneMath.trolleyCf(cfg, st)
	local bcf = CraneMath.blockCf(cfg, st)
	for k, dx in ipairs({ -0.45, 0.45 }) do
		local a = (tcf * CF(dx, 0.2, 0)).Position
		local b = (bcf * CF(dx, 2.9, 0)).Position
		local c = tube(cables, "Fall" .. k, a, b, 0.1, ROPE, M.Metal, { nc = true, ns = true, nq = true })
		c.CanQuery = false
	end

	CraneMath.writeAttributes(model, st)
	model:SetAttribute("Operator", 0)
	model:SetAttribute("LoadId", "")
	model:SetAttribute("ResetSeq", 0)
	if #warnings > 0 then
		model:SetAttribute("BuildWarnings", table.concat(warnings, " | "))
	end
	model.PrimaryPart = slew.PrimaryPart
	return model, cfg
end

return CraneFactory
