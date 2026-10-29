-- Server-side builders for site environments, the tower crane and the
-- delivery truck. Everything is made from engine parts and built-in
-- materials so the place runs without any uploaded assets; see
-- docs/ASSETS.md for the meshes/textures that would raise fidelity further.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Lighting = game:GetService("Lighting")

local Shared = ReplicatedStorage:WaitForChild("Steelrise")
local Config = require(Shared.Config)
local CraneMath = require(Shared.CraneMath)
local Util = require(Shared.Util)

local S = Config.S
local C = Config.Colors
local M = Enum.Material
local V = Vector3.new
local CF = CFrame.new

local WorldFactory = {}

local function m(x)
	return x * S
end

-- Part helper in STUDS.
local function P(parent, name, size, cf, color, material, flags)
	local p = Instance.new("Part")
	p.Name = name
	p.Anchored = true
	p.Size = size
	p.CFrame = cf
	p.Color = color or C.Steel
	p.Material = material or M.SmoothPlastic
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
		if flags.shape then
			p.Shape = flags.shape
		end
	end
	p.Parent = parent
	return p
end
WorldFactory.P = P

local function cyl(parent, name, length, dia, cf, color, material, flags)
	local f = flags and Util.shallowCopy(flags) or {}
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

-- Bar between two points (studs).
local function bar(parent, name, a, b, w, color, material, flags)
	local len = (b - a).Magnitude
	return P(parent, name, V(w, w, len), lookAlong((a + b) / 2, b - a), color, material, flags)
end

local function surfaceText(part, face, text, bg, fg, font)
	local gui = Instance.new("SurfaceGui")
	gui.Face = face
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	gui.PixelsPerStud = 20
	gui.LightInfluence = 1
	gui.Parent = part
	local t = Instance.new("TextLabel")
	t.Size = UDim2.fromScale(1, 1)
	t.BackgroundColor3 = bg or C.Charcoal
	t.BackgroundTransparency = bg and 0 or 1
	t.TextColor3 = fg or C.OffWhite
	t.Font = font or Enum.Font.GothamBlack
	t.TextScaled = true
	t.Text = text
	t.Parent = gui
	local pad = Instance.new("UIPadding")
	pad.PaddingLeft = UDim.new(0.04, 0)
	pad.PaddingRight = UDim.new(0.04, 0)
	pad.PaddingTop = UDim.new(0.08, 0)
	pad.PaddingBottom = UDim.new(0.08, 0)
	pad.Parent = t
	return gui
end

---------------------------------------------------------------------------
-- Lighting
---------------------------------------------------------------------------

function WorldFactory.applyLighting(site)
	local L = site.lighting or {}
	Lighting.ClockTime = L.clock or 12
	Lighting.GeographicLatitude = L.latitude or 40
	Lighting.Brightness = 2.4
	Lighting.EnvironmentDiffuseScale = 1
	Lighting.EnvironmentSpecularScale = 1
	Lighting.ExposureCompensation = 0.05
	Lighting.ShadowSoftness = 0.15
	Lighting.GlobalShadows = true
	Lighting.Ambient = Color3.fromRGB(34, 36, 40)
	Lighting.OutdoorAmbient = Color3.fromRGB(126, 128, 134)
	Lighting.ColorShift_Top = L.tint or Color3.fromRGB(255, 248, 240)

	for _, child in ipairs(Lighting:GetChildren()) do
		if child:GetAttribute("Steelrise") then
			child:Destroy()
		end
	end
	local function tag(inst)
		inst:SetAttribute("Steelrise", true)
		inst.Parent = Lighting
		return inst
	end
	local atm = Instance.new("Atmosphere")
	atm.Density = L.density or 0.32
	atm.Offset = 0.22
	atm.Color = Color3.fromRGB(198, 205, 214)
	atm.Decay = Color3.fromRGB(104, 112, 124)
	atm.Glare = 0.18
	atm.Haze = L.haze or 1.2
	tag(atm)
	local sky = Instance.new("Sky")
	sky.CelestialBodiesShown = true
	sky.SunAngularSize = 14
	sky.StarCount = 1500
	tag(sky)
	local bloom = Instance.new("BloomEffect")
	bloom.Name = "SR_Bloom"
	bloom.Intensity = 0.5
	bloom.Size = 22
	bloom.Threshold = 1.7
	tag(bloom)
	local rays = Instance.new("SunRaysEffect")
	rays.Name = "SR_SunRays"
	rays.Intensity = 0.045
	rays.Spread = 0.55
	tag(rays)
	local cc = Instance.new("ColorCorrectionEffect")
	cc.Name = "SR_Grade"
	cc.Brightness = 0.01
	cc.Contrast = 0.07
	cc.Saturation = -0.06
	cc.TintColor = L.tint or Color3.fromRGB(255, 250, 244)
	tag(cc)
	local dof = Instance.new("DepthOfFieldEffect")
	dof.Name = "SR_DOF"
	dof.FarIntensity = 0.12
	dof.FocusDistance = 200
	dof.InFocusRadius = 50
	dof.NearIntensity = 0
	dof.Enabled = true
	tag(dof)

	local clouds = workspace.Terrain:FindFirstChildOfClass("Clouds") or Instance.new("Clouds")
	clouds.Cover = 0.42
	clouds.Density = 0.55
	clouds.Color = Color3.fromRGB(240, 240, 238)
	clouds.Parent = workspace.Terrain
end

---------------------------------------------------------------------------
-- Terrain
---------------------------------------------------------------------------

function WorldFactory.buildTerrain(site)
	local T = workspace.Terrain
	T:Clear()
	local lot = site.lotM * S
	local extent = V(lot.X + 900, 0, lot.Z + 900)
	-- base grade: top surface exactly at y = 0
	local baseMat = (site.style == "Rural" or site.style == "Suburban" or site.style == "Residential") and M.Grass or M.Pavement
	T:FillBlock(CF(0, -8, 0), V(extent.X, 16, extent.Z), baseMat)
	-- the lot itself: compacted dirt with mud patches and gravel bands
	T:FillBlock(CF(0, -8, 0), V(lot.X, 16, lot.Z), M.Ground)
	local rng = Random.new(Util.hashString(site.id))
	for _ = 1, 10 do
		local px = rng:NextNumber(-lot.X / 2 + 20, lot.X / 2 - 20)
		local pz = rng:NextNumber(-lot.Z / 2 + 20, lot.Z / 2 - 20)
		local sz = rng:NextNumber(18, 40)
		T:FillBlock(CF(px, -4, pz), V(sz, 8, sz * rng:NextNumber(0.6, 1.4)), M.Mud)
	end
	-- haul road from the gate to the trailer bays
	for _, b in ipairs(site.bays) do
		local p = b.Position
		if math.abs(p.X) < lot.X / 2 and math.abs(p.Z) < lot.Z / 2 then
			T:FillBlock(b * CF(0, -4, 0), V(m(24), 8, m(5)), M.Slate)
		end
	end
	-- crane pad and laydown
	local cb = site.crane.posM * S
	T:FillBlock(CF(cb.X, -4, cb.Z), V(m(9), 8, m(9)), M.Concrete)
	local ld = site.laydownM
	T:FillBlock(CF(ld.center.X * S, -4, ld.center.Z * S), V(ld.size.X * S, 8, ld.size.Z * S), M.Slate)
	-- street along the south edge (and east edge for corner lots)
	local roadZ = -lot.Z / 2 - m(9)
	T:FillBlock(CF(0, -4, roadZ), V(extent.X, 8, m(14)), M.Asphalt)
	T:FillBlock(CF(0, -4, -lot.Z / 2 - m(1.2)), V(extent.X, 8, m(2.4)), M.Concrete)
	if site.style == "Downtown" or site.style == "CityCenter" or site.style == "HighRise" then
		local roadX = lot.X / 2 + m(9)
		T:FillBlock(CF(roadX, -4, 0), V(m(14), 8, extent.Z), M.Asphalt)
		T:FillBlock(CF(lot.X / 2 + m(1.2), -4, 0), V(m(2.4), 8, extent.Z), M.Concrete)
	end
	if site.style == "Waterfront" then
		local waterZ = lot.Z / 2 + m(14) + 300
		T:FillBlock(CF(0, -8, waterZ), V(extent.X, 16, 600), M.Air)
		T:FillBlock(CF(0, -12, waterZ), V(extent.X, 8, 600), M.Mud)
		T:FillBlock(CF(0, -5, waterZ), V(extent.X, 6, 600), M.Water)
		T:FillBlock(CF(0, -4, lot.Z / 2 + m(6)), V(extent.X, 8, m(12)), M.Pavement)
	end
	if site.rail then
		T:FillBlock(CF(0, -4, lot.Z / 2 + m(8)), V(extent.X, 8, m(8)), M.Slate)
	end
end

---------------------------------------------------------------------------
-- Fencing, gate and site dressing
---------------------------------------------------------------------------

local function fenceRun(folder, a, b, screen, gateFrom, gateTo)
	local dir = (b - a)
	local len = dir.Magnitude
	local unit = dir.Unit
	local panel = m(3.5)
	local n = math.max(1, math.floor(len / panel + 0.5))
	local step = len / n
	local h = m(2.0)
	local runStart = nil
	local function closeRun(endT)
		if runStart and endT > runStart + 0.5 then
			local pA = a + unit * runStart
			local pB = a + unit * endT
			local mid = (pA + pB) / 2
			local seg = (pB - pA).Magnitude
			local cfm = lookAlong(mid + V(0, h / 2 + 0.3, 0), unit) * CFrame.Angles(0, math.pi / 2, 0)
			P(folder, "FenceMesh", V(seg, h, 0.08), cfm, C.Galvanized, M.DiamondPlate, { tr = 0.6, ns = true })
			P(folder, "FenceRail", V(seg, 0.12, 0.12), cfm * CF(0, h / 2, 0), C.Galvanized, M.Metal, { nc = true })
			if screen then
				local scr = P(folder, "Windscreen", V(seg, h * 0.82, 0.05), cfm * CF(0, -h * 0.05, -0.1), Color3.fromRGB(32, 64, 46), M.Fabric, { tr = 0.08 })
				scr.CastShadow = true
			end
		end
		runStart = nil
	end
	for k = 0, n do
		local t = k * step
		local inGate = gateFrom and t > gateFrom and t < gateTo
		if not inGate then
			local p = a + unit * t
			cyl(folder, "FencePost", h + 0.4, 0.16, CF(p + V(0, h / 2 + 0.3, 0)) * CFrame.Angles(0, 0, math.pi / 2), C.Galvanized, M.Metal)
			P(folder, "FenceFoot", V(m(0.6), 0.45, m(0.2)), lookAlong(p + V(0, 0.22, 0), unit) * CFrame.Angles(0, math.pi / 2, 0), Color3.fromRGB(40, 42, 44), M.SmoothPlastic, { ns = true })
			if not runStart then
				runStart = t
			end
		else
			closeRun(t - step)
		end
	end
	closeRun(len)
end

function WorldFactory.buildFencing(site, folder)
	local lot = site.lotM * S
	local hx, hz = lot.X / 2, lot.Z / 2
	local screened = site.style ~= "Rural"
	-- gate on the south side, covering the bay x-range of internal bays
	local gateCentre = 0
	local count = 0
	for _, b in ipairs(site.bays) do
		if math.abs(b.Position.Z) < hz then
			gateCentre += b.Position.X
			count += 1
		end
	end
	gateCentre = count > 0 and gateCentre / count or 0
	local gateW = m(14)
	local southA, southB = V(-hx, 0, -hz), V(hx, 0, -hz)
	local gFrom = (gateCentre - gateW / 2) - (-hx)
	local gTo = gFrom + gateW
	if count == 0 then
		-- street-side deliveries: a narrow personnel gate only
		gFrom, gTo = hx - m(10), hx - m(6)
	end
	fenceRun(folder, southA, southB, screened, gFrom, gTo)
	fenceRun(folder, V(hx, 0, -hz), V(hx, 0, hz), screened)
	fenceRun(folder, V(hx, 0, hz), V(-hx, 0, hz), screened and site.style ~= "Waterfront")
	fenceRun(folder, V(-hx, 0, hz), V(-hx, 0, -hz), screened)

	-- gate signage
	local gx = -hx + (gFrom + gTo) / 2
	local signPost = P(folder, "GateSignPost", V(0.4, m(3.2), 0.4), CF(gx + gateW / 2 + 2, m(1.6), -hz - 1.5), C.SteelDark, M.Metal)
	signPost.CastShadow = true
	local board = P(folder, "GateSign", V(m(2.8), m(1.6), 0.15), CF(gx + gateW / 2 + 2, m(2.6), -hz - 1.6), C.OffWhite, M.SmoothPlastic)
	surfaceText(board, Enum.NormalId.Front, "STEELRISE\nCONSTRUCTION SITE\nPPE REQUIRED · DELIVERIES REPORT TO GATE", C.Charcoal, C.Safety)
	for k = 0, 3 do
		local banner = P(folder, "Banner", V(m(6), m(1.4), 0.06), CF(-hx + m(12) + k * m(26), m(1.3), -hz - 0.25), C.Charcoal, M.Fabric, { nc = true })
		if -hx + m(12) + k * m(26) < gx - gateW or -hx + m(12) + k * m(26) > gx + gateW then
			surfaceText(banner, Enum.NormalId.Front, "STEELRISE  ·  HARD HAT AREA", C.Charcoal, C.Safety)
		else
			banner:Destroy()
		end
	end
end

local function tree(folder, pos, rng, scale)
	scale = scale or 1
	local h = rng:NextNumber(5, 9) * scale
	cyl(folder, "Trunk", m(h * 0.45), m(0.3), CF(pos + V(0, m(h * 0.22), 0)) * CFrame.Angles(0, 0, math.pi / 2), Color3.fromRGB(86, 66, 48), M.Wood)
	local leaf = Color3.fromRGB(62 + rng:NextInteger(-8, 8), 92 + rng:NextInteger(-10, 10), 52)
	P(folder, "Canopy", V(m(h * 0.55), m(h * 0.6), m(h * 0.55)), CF(pos + V(0, m(h * 0.68), 0)), leaf, M.LeafyGrass, { shape = Enum.PartType.Ball, nc = true })
end

local function car(folder, cf, rng)
	local colours = { Color3.fromRGB(180, 180, 184), Color3.fromRGB(30, 32, 36), Color3.fromRGB(150, 24, 28), Color3.fromRGB(40, 70, 130), Color3.fromRGB(230, 230, 228) }
	local col = colours[rng:NextInteger(1, #colours)]
	P(folder, "CarBody", V(m(4.6), m(0.8), m(1.8)), cf * CF(0, m(0.6), 0), col, M.Metal, { refl = 0.05 })
	P(folder, "CarCabin", V(m(2.4), m(0.6), m(1.6)), cf * CF(-m(0.2), m(1.3), 0), Color3.fromRGB(40, 48, 56), M.Glass, { refl = 0.1 })
	for _, sx in ipairs({ -1.5, 1.4 }) do
		for _, sz in ipairs({ -0.85, 0.85 }) do
			cyl(folder, "Wheel", m(0.25), m(0.66), cf * CF(m(sx), m(0.33), m(sz)) * CFrame.Angles(0, math.pi / 2, 0), C.Rubber, M.SmoothPlastic, { ns = true })
		end
	end
end

-- Generic building massing with window bands.
local function building(folder, pos, w, d, h, kind, rng)
	local body, band
	if kind == "glass" then
		body = Color3.fromRGB(70, 92, 108)
		band = Color3.fromRGB(150, 170, 182)
	elseif kind == "brick" then
		body = Color3.fromRGB(140, 86, 66)
		band = Color3.fromRGB(46, 54, 62)
	elseif kind == "warehouse" then
		body = Color3.fromRGB(176, 180, 182)
		band = Color3.fromRGB(120, 124, 128)
	else
		body = Color3.fromRGB(196, 190, 178)
		band = Color3.fromRGB(56, 66, 76)
	end
	local mat = kind == "glass" and M.Glass or (kind == "brick" and M.Brick or (kind == "warehouse" and M.Metal or M.Concrete))
	local main = P(folder, "Building", V(w, h, d), CF(pos + V(0, h / 2, 0)), body, mat, { refl = kind == "glass" and 0.12 or 0 })
	main.CastShadow = true
	if kind == "warehouse" then
		local ribs = math.floor(w / m(2))
		for k = 0, ribs do
			P(folder, "Rib", V(0.3, h - 1, d + 0.3), CF(pos + V(-w / 2 + k * w / ribs, h / 2, 0)), band, M.Metal, { nc = true, ns = true })
		end
		P(folder, "Roof", V(w + 1, 1, d + 1), CF(pos + V(0, h + 0.5, 0)), Color3.fromRGB(120, 112, 100), M.CorrodedMetal)
		P(folder, "Door", V(m(5), m(5), 0.4), CF(pos + V(0, m(2.5), -d / 2 - 0.2)), Color3.fromRGB(70, 90, 120), M.Metal, { nc = true })
		return main
	end
	local floorH = m(3.6)
	local floors = math.floor(h / floorH)
	local stride = math.max(1, math.ceil(floors / 28))
	for f = 1, floors - 1, stride do
		local y = f * floorH - floorH * 0.45
		P(folder, "Band", V(w + 0.2, floorH * 0.5 * stride, d + 0.2), CF(pos + V(0, y + floorH * 0.25 * (stride - 1), 0)), band, M.Glass, { nc = true, ns = true, refl = 0.15 })
	end
	P(folder, "Parapet", V(w + 0.6, 1.2, d + 0.6), CF(pos + V(0, h + 0.6, 0)), body, mat, { nc = true })
	if h > m(12) then
		P(folder, "Plant", V(w * 0.4, m(2.5), d * 0.4), CF(pos + V(rng:NextNumber(-w * 0.2, w * 0.2), h + m(1.25), 0)), Color3.fromRGB(150, 150, 146), M.Metal)
	end
	return main
end

local function house(folder, pos, yaw, rng)
	local w, d, h = m(rng:NextNumber(9, 12)), m(rng:NextNumber(8, 10)), m(rng:NextNumber(5.5, 7))
	local cf = CF(pos) * CFrame.Angles(0, yaw, 0)
	local wall = ({ Color3.fromRGB(214, 206, 190), Color3.fromRGB(176, 120, 92), Color3.fromRGB(200, 204, 206) })[rng:NextInteger(1, 3)]
	P(folder, "House", V(w, h, d), cf * CF(0, h / 2, 0), wall, M.Brick)
	local roof = Color3.fromRGB(70, 66, 64)
	local wa = Instance.new("WedgePart")
	wa.Anchored = true
	wa.Size = V(w + 1, m(2.2), d / 2 + 0.5)
	wa.CFrame = cf * CF(0, h + m(1.1), -d / 4 - 0.25) * CFrame.Angles(0, math.pi, 0)
	wa.Color = roof
	wa.Material = M.Slate
	wa.Parent = folder
	local wb = wa:Clone()
	wb.CFrame = cf * CF(0, h + m(1.1), d / 4 + 0.25)
	wb.Parent = folder
	for k = -1, 1 do
		P(folder, "Window", V(m(1.2), m(1.3), 0.2), cf * CF(k * w / 3, h * 0.6, -d / 2 - 0.05), C.Glass, M.Glass, { nc = true, refl = 0.2 })
	end
end

function WorldFactory.buildSurroundings(site, folder)
	local lot = site.lotM * S
	local hx, hz = lot.X / 2, lot.Z / 2
	local rng = Random.new(Util.hashString(site.id) + 7)
	local style = site.style

	-- street furniture along the south street
	local roadZ = -hz - m(9)
	local lineCount = math.floor((lot.X + 400) / m(9))
	for k = 0, lineCount do
		local x = -lot.X / 2 - 200 + k * m(9)
		P(folder, "LaneMark", V(m(3), 0.06, m(0.15)), CF(x, 0.03, roadZ), Color3.fromRGB(232, 226, 210), M.SmoothPlastic, { nc = true, ns = true, nq = true })
	end
	for k = -3, 3 do
		local x = k * m(30)
		local pole = cyl(folder, "LampPost", m(8), m(0.2), CF(x, m(4), roadZ - m(7.5)) * CFrame.Angles(0, 0, math.pi / 2), C.SteelDark, M.Metal)
		local head = P(folder, "LampHead", V(m(0.6), m(0.2), m(1.4)), CF(x, m(8), roadZ - m(6.9)), C.SteelDark, M.Metal, { nc = true })
		if (site.lighting.clock or 12) > 17 or (site.lighting.clock or 12) < 7 then
			local l = Instance.new("SpotLight")
			l.Face = Enum.NormalId.Bottom
			l.Range = 40
			l.Angle = 110
			l.Brightness = 2
			l.Color = Color3.fromRGB(255, 214, 160)
			l.Parent = head
		end
		pole.CastShadow = true
	end

	-- Points on a rectangle grown `r` beyond the lot, so nothing lands inside it.
	local function ring(count, inner, outer, fn)
		for k = 1, count do
			local ang = (k / count) * math.pi * 2 + rng:NextNumber(-0.1, 0.1)
			local r = rng:NextNumber(inner, outer)
			local dx, dz = math.cos(ang), math.sin(ang)
			local t = math.min((hx + r) / math.max(math.abs(dx), 1e-3), (hz + r) / math.max(math.abs(dz), 1e-3))
			local p = V(dx * t, 0, dz * t)
			-- keep the south street and its far sidewalk clear
			if p.Z < -hz + m(2) and p.Z > roadZ - m(32) then
				p = V(p.X, 0, roadZ - m(32) - rng:NextNumber(0, m(10)))
			end
			fn(p, ang)
		end
	end

	if style == "Rural" then
		for _ = 1, 26 do
			local p = V(rng:NextNumber(-hx - 300, hx + 300), 0, rng:NextNumber(hz + 20, hz + 300))
			tree(folder, p, rng)
		end
		for _ = 1, 10 do
			tree(folder, V(rng:NextNumber(-hx - 200, -hx - 20), 0, rng:NextNumber(-hz, hz)), rng)
		end
	elseif style == "Suburban" then
		ring(7, m(30), m(55), function(p)
			building(folder, p, m(rng:NextNumber(28, 44)), m(rng:NextNumber(18, 26)), m(rng:NextNumber(8, 14)), "concrete", rng)
		end)
		for k = 1, 18 do
			car(folder, CF(-hx + m(10) + k * m(3.2), 0, roadZ - m(18)) * CFrame.Angles(0, math.pi / 2, 0), rng)
		end
		for _ = 1, 30 do
			tree(folder, V(rng:NextNumber(-hx - 150, hx + 150), 0, rng:NextNumber(hz + 10, hz + 160)), rng, 1.1)
		end
	elseif style == "Downtown" or style == "CityCenter" or style == "HighRise" then
		local lo, hi = 30, 90
		if style == "CityCenter" then
			lo, hi = 60, 160
		elseif style == "HighRise" then
			lo, hi = 50, 140
		end
		-- tight neighbours on the north and west sides of the lot
		building(folder, V(0, 0, hz + m(10)), lot.X, m(18), m(rng:NextNumber(lo * 0.5, lo)), "brick", rng)
		building(folder, V(-hx - m(10), 0, 0), m(18), lot.Z, m(rng:NextNumber(lo * 0.6, lo * 1.2)), "concrete", rng)
		ring(16, m(42), m(100), function(p)
			local kind = rng:NextNumber() < 0.5 and "glass" or "concrete"
			building(folder, p, m(rng:NextNumber(24, 40)), m(rng:NextNumber(24, 40)), m(rng:NextNumber(lo, hi)), kind, rng)
		end)
		for k = 1, 10 do
			car(folder, CF(-hx + k * m(6), 0, roadZ - m(3.2)) * CFrame.Angles(0, math.pi / 2, 0), rng)
		end
	elseif style == "Waterfront" then
		P(folder, "QuayWall", V(lot.X + 900, m(3), m(1)), CF(0, -m(1.5), hz + m(12.5)), Color3.fromRGB(150, 146, 138), M.Concrete)
		for k = -6, 6 do
			cyl(folder, "Bollard", m(0.7), m(0.4), CF(k * m(14), m(0.35), hz + m(11)) * CFrame.Angles(0, 0, math.pi / 2), C.SteelDark, M.Metal)
		end
		building(folder, V(hx + m(30), 0, 0), m(30), m(40), m(26), "glass", rng)
		building(folder, V(-hx - m(30), 0, -m(5)), m(34), m(30), m(22), "concrete", rng)
		building(folder, V(-hx - m(70), 0, m(10)), m(28), m(28), m(34), "glass", rng)
		for k = 1, 2 do
			local hull = P(folder, "Boat", V(m(16), m(2.5), m(5)), CF(k * m(40) - m(60), m(0.3), hz + m(30) + k * m(10)), C.OffWhite, M.SmoothPlastic)
			hull.CastShadow = true
			P(folder, "Wheelhouse", V(m(5), m(2.2), m(3.6)), hull.CFrame * CF(m(2), m(2.3), 0), Color3.fromRGB(46, 56, 70), M.Glass, { nc = true })
		end
	elseif style == "Industrial" then
		building(folder, V(-hx - m(36), 0, m(10)), m(60), m(46), m(12), "warehouse", rng)
		building(folder, V(hx + m(40), 0, -m(4)), m(64), m(52), m(14), "warehouse", rng)
		building(folder, V(m(30), 0, hz + m(45)), m(90), m(40), m(11), "warehouse", rng)
		-- rail siding (freight train arrives in phase 2)
		local railZ = hz + m(8)
		for _, dz in ipairs({ -0.72, 0.72 }) do
			P(folder, "Rail", V(lot.X + 600, m(0.15), m(0.07)), CF(0, m(0.32), railZ + m(dz)), Color3.fromRGB(110, 100, 92), M.Metal)
		end
		for k = 0, math.floor((lot.X + 600) / m(2.4)) do
			P(folder, "Sleeper", V(m(0.25), m(0.15), m(2.6)), CF(-(lot.X + 600) / 2 + k * m(2.4), m(0.18), railZ), Color3.fromRGB(70, 60, 50), M.Wood, { ns = true })
		end
		for k = 0, 5 do
			local c = ({ Color3.fromRGB(160, 50, 40), Color3.fromRGB(40, 90, 140), Color3.fromRGB(200, 140, 40) })[k % 3 + 1]
			P(folder, "Container", V(m(12.2), m(2.6), m(2.45)), CF(-hx - m(20) + (k % 3) * m(13), m(1.3) + math.floor(k / 3) * m(2.6), -hz - m(30)), c, M.Metal)
		end
	elseif style == "Residential" then
		for k = 0, 9 do
			house(folder, V(-hx + m(8) + k * m(14), 0, hz + m(14)), 0, rng)
			house(folder, V(-hx + m(8) + k * m(14), 0, roadZ - m(16)), math.pi, rng)
		end
		for _ = 1, 24 do
			tree(folder, V(rng:NextNumber(-hx - 100, hx + 100), 0, rng:NextNumber(hz + 26, hz + 120)), rng)
		end
	end
end

-- Welfare area, laydown dunnage and crane exclusion zone.
function WorldFactory.buildSiteDressing(site, folder)
	local lot = site.lotM * S
	local hx, hz = lot.X / 2, lot.Z / 2
	local ld = site.laydownM
	local lc = ld.center * S
	for k = 0, 5 do
		P(folder, "Dunnage", V(ld.size.X * S * 0.8, m(0.1), m(0.12)), CF(lc.X, m(0.05), lc.Z - ld.size.Z * S * 0.35 + k * ld.size.Z * S * 0.14), C.Timber, M.Wood, { ns = true })
	end
	-- crane exclusion barriers
	local cb = site.crane.posM * S
	for _, off in ipairs({ V(1, 0, 1), V(-1, 0, 1), V(1, 0, -1), V(-1, 0, -1) }) do
		local p = cb + off * m(5.2)
		P(folder, "CraneBarrier", V(m(2), m(1), m(0.5)), CF(p + V(0, m(0.5), 0)) * CFrame.Angles(0, math.rad(45 * off.X * off.Z), 0), Color3.fromRGB(240, 92, 24), M.SmoothPlastic)
	end
	-- crane signage
	local sign = P(folder, "CraneSign", V(m(1.6), m(1.1), 0.12), CF(cb + V(m(5.2), m(1.6), 0)) * CFrame.Angles(0, math.pi / 2, 0), C.Safety, M.SmoothPlastic)
	surfaceText(sign, Enum.NormalId.Front, "DANGER\nOVERHEAD LOADS", C.Safety, C.Charcoal)
	P(folder, "CraneSignPost", V(0.3, m(1.2), 0.3), CF(cb + V(m(5.25), m(0.6), 0)), C.SteelDark, M.Metal)
	-- welfare corner (avoids bays, laydown and the building grid)
	local corner = V(-hx + m(8), 0, -hz + m(6))
	if site.style == "Downtown" or site.style == "CityCenter" then
		corner = V(-hx + m(4), 0, hz - m(4))
	end
	local office = P(folder, "SiteOffice", V(m(6.06), m(2.6), m(2.44)), CF(corner + V(0, m(1.3), 0)), Color3.fromRGB(226, 226, 220), M.Metal)
	office.CastShadow = true
	P(folder, "OfficeWindow", V(m(1.2), m(0.9), 0.1), CF(corner + V(-m(1), m(1.6), m(1.23))), C.Glass, M.Glass, { nc = true, refl = 0.2 })
	P(folder, "OfficeDoor", V(m(0.9), m(2), 0.1), CF(corner + V(m(2.2), m(1.1), m(1.23))), Color3.fromRGB(70, 74, 80), M.Metal, { nc = true })
	local plate = P(folder, "OfficeSign", V(m(2.4), m(0.5), 0.08), CF(corner + V(0, m(2.3), m(1.25))), C.Charcoal, M.SmoothPlastic, { nc = true })
	surfaceText(plate, Enum.NormalId.Back, "SITE OFFICE", C.Charcoal, C.Safety)
	for k = 0, 1 do
		local tp = corner + V(m(4.6) + k * m(1.3), 0, 0)
		P(folder, "Toilet", V(m(1.1), m(2.3), m(1.2)), CF(tp + V(0, m(1.15), 0)), Color3.fromRGB(28, 98, 168), M.SmoothPlastic)
	end
	local skip = corner + V(m(10), 0, 0)
	P(folder, "Skip", V(m(5.4), m(1.5), m(2.3)), CF(skip + V(0, m(0.75), 0)), Color3.fromRGB(46, 92, 58), M.Metal)
end

---------------------------------------------------------------------------
-- Tower crane
---------------------------------------------------------------------------

function WorldFactory.buildCrane(craneDef, id)
	return require(script.Parent.CraneFactory).build(craneDef, id)
end

---------------------------------------------------------------------------
-- Truck + flatbed trailer
---------------------------------------------------------------------------

-- Local frame: origin at road level under the middle of the bed, bed along +X,
-- tractor toward -X. Returns the model and the bed-top height in studs.
function WorldFactory.buildTrailer(bayCf, rngSeed)
	return require(script.Parent.VehicleFactory).buildTruck(bayCf, rngSeed)
end

return WorldFactory
