-- Delivery vehicles: a long-hood American tractor with a 53 ft steel-hauling
-- flatbed, and freight railcars for rail-served sites.
--
-- Built in METRES in a local frame and converted to studs. The truck's frame:
-- origin on the road under the middle of the trailer deck, deck along +X,
-- tractor toward -X. Each wheel is its own small Model (PrimaryPart = tyre,
-- axle along the tyre's X axis) inside a "Wheels" folder so clients can spin
-- them while the truck drives.

local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Steelrise")
local Config = require(Shared.Config)

local S = Config.S
local C = Config.Colors
local M = Enum.Material
local V = Vector3.new
local CF = CFrame.new

local VehicleFactory = {}

local CHROME = Color3.fromRGB(206, 210, 214)
local ALU = Color3.fromRGB(176, 180, 184)
local FRAME = Color3.fromRGB(30, 31, 33)
local TIRE = Color3.fromRGB(27, 27, 29)
local GLASS = Color3.fromRGB(34, 44, 52)

local function toStuds(cf)
	local x, y, z, r00, r01, r02, r10, r11, r12, r20, r21, r22 = cf:GetComponents()
	return CFrame.new(x * S, y * S, z * S, r00, r01, r02, r10, r11, r12, r20, r21, r22)
end

-- Builder working in metres. flags: nc, ns, tr, refl, shape, nq, wedge
local function newBuilder(model)
	local b = {}
	function b.part(name, size, cf, color, material, flags, parent)
		local p = Instance.new((flags and flags.wedge) and "WedgePart" or "Part")
		p.Name = name
		p.Anchored = true
		p.Size = V(math.max(size.X * S, 0.02), math.max(size.Y * S, 0.02), math.max(size.Z * S, 0.02))
		p.CFrame = toStuds(cf)
		p.Color = color
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
			if flags.tr then
				p.Transparency = flags.tr
			end
			if flags.refl then
				p.Reflectance = flags.refl
			end
			if flags.nq then
				p.CanQuery = false
			end
			if flags.shape and not flags.wedge then
				p.Shape = flags.shape
			end
		end
		p.Parent = parent or model
		return p
	end
	-- cylinder whose axis runs along local X of `cf`
	function b.cylX(name, length, dia, cf, color, material, flags, parent)
		local f = {}
		for k, v in pairs(flags or {}) do
			f[k] = v
		end
		f.shape = Enum.PartType.Cylinder
		return b.part(name, V(length, dia, dia), cf, color, material, f, parent)
	end
	-- cylinder whose axis runs along world Y / Z
	function b.cylY(name, length, dia, pos, color, material, flags, parent)
		return b.cylX(name, length, dia, CF(pos) * CFrame.Angles(0, 0, math.pi / 2), color, material, flags, parent)
	end
	function b.cylZ(name, length, dia, pos, color, material, flags, parent)
		return b.cylX(name, length, dia, CF(pos) * CFrame.Angles(0, math.pi / 2, 0), color, material, flags, parent)
	end
	return b
end

-- One wheel: tyre, rim, hub and lug ring as a spinning model.
-- side = +1 for the right side (+Z), -1 for the left. dual = twin tyres.
local function wheel(b, wheelsFolder, x, z, side, dual, dia, steer)
	local w = Instance.new("Model")
	w.Name = "Wheel"
	w.Parent = wheelsFolder
	local width = 0.29
	local offsets = dual and { -0.16, 0.16 } or { 0 }
	local tyre = nil
	for i, o in ipairs(offsets) do
		local t = b.cylZ(i == 1 and "Tyre" or "TyreInner", width, dia, V(x, dia / 2, z + side * o), TIRE, M.SmoothPlastic, nil, w)
		if i == 1 then
			tyre = t
		end
		-- tread grooves read as a slightly darker band
		b.cylZ("Tread", width * 0.35, dia + 0.004, V(x, dia / 2, z + side * o), Color3.fromRGB(20, 20, 21), M.SmoothPlastic, { nc = true, ns = true }, w)
	end
	local outer = z + side * (offsets[#offsets] + width / 2)
	local rimColor = steer and CHROME or ALU
	b.cylZ("Rim", 0.03, dia * 0.6, V(x, dia / 2, outer + side * 0.006), rimColor, M.Metal, { nc = true, ns = true, refl = 0.25 }, w)
	b.cylZ("RimLip", 0.02, dia * 0.66, V(x, dia / 2, outer + side * 0.001), CHROME, M.Metal, { nc = true, ns = true, refl = 0.3 }, w)
	b.cylZ("Hub", 0.12, dia * 0.24, V(x, dia / 2, outer + side * 0.05), CHROME, M.Metal, { nc = true, ns = true, refl = 0.35 }, w)
	b.cylZ("LugRing", 0.04, dia * 0.34, V(x, dia / 2, outer + side * 0.025), Color3.fromRGB(150, 152, 156), M.Metal, { nc = true, ns = true }, w)
	for k = 0, 5 do
		local a = k * math.pi / 3
		b.part("Hand", V(0.06, 0.08, 0.012), CF(x + math.cos(a) * dia * 0.21, dia / 2 + math.sin(a) * dia * 0.21, outer + side * 0.012) * CFrame.Angles(0, 0, a), Color3.fromRGB(120, 124, 128), M.Metal, { nc = true, ns = true }, w)
	end
	w.PrimaryPart = tyre
	w:SetAttribute("Radius", dia / 2 * S)
	return w
end

---------------------------------------------------------------------------
-- Truck + flatbed
---------------------------------------------------------------------------

local PAINTS = {
	{ body = Color3.fromRGB(122, 16, 22), stripe = Color3.fromRGB(230, 230, 226) },
	{ body = Color3.fromRGB(236, 236, 232), stripe = Color3.fromRGB(26, 52, 110) },
	{ body = Color3.fromRGB(20, 40, 86), stripe = Color3.fromRGB(196, 198, 202) },
	{ body = Color3.fromRGB(24, 24, 26), stripe = Color3.fromRGB(196, 150, 20) },
	{ body = Color3.fromRGB(28, 78, 52), stripe = Color3.fromRGB(230, 230, 226) },
}

function VehicleFactory.buildTruck(bayCf, seed)
	local rng = Random.new(seed or 1)
	local paint = PAINTS[rng:NextInteger(1, #PAINTS)]
	local model = Instance.new("Model")
	model.Name = "Trailer"
	local root = Instance.new("Part")
	root.Name = "Root"
	root.Size = V(0.4, 0.4, 0.4)
	root.Transparency = 1
	root.Anchored = true
	root.CanCollide = false
	root.CanQuery = false
	root.CanTouch = false
	root.CastShadow = false
	root.CFrame = CF()
	root.Parent = model
	model.PrimaryPart = root
	local b = newBuilder(model)
	local wheels = Instance.new("Folder")
	wheels.Name = "Wheels"
	wheels.Parent = model

	local D = Config.Delivery
	local L, W, H = D.BedLength, D.BedWidth, D.BedHeight
	local WD = 1.04 -- tyre diameter

	------------------------------------------------------------------ trailer
	-- deck: timber planks either side of an aluminium centre strip
	local sideW = (W / 2 - 0.07) - 0.14
	local pw = sideW / 2
	for _, sz in ipairs({ -1, 1 }) do
		for k = 0, 1 do
			local zc = sz * (0.14 + pw * (k + 0.5))
			b.part("DeckPlank", V(L - 0.1, 0.05, pw - 0.015), CF(0, H - 0.025, zc), Color3.fromRGB(124 + k * 6, 96, 68), M.WoodPlanks)
		end
	end
	b.part("DeckCentre", V(L - 0.1, 0.052, 0.28), CF(0, H - 0.026, 0), ALU, M.DiamondPlate)
	-- rub rails with stake pockets and marker lights
	for _, sz in ipairs({ -1, 1 }) do
		b.part("RubRail", V(L, 0.3, 0.07), CF(0, H - 0.15, sz * (W / 2 - 0.035)), ALU, M.Metal, { refl = 0.08 })
		b.part("RailLip", V(L, 0.05, 0.1), CF(0, H - 0.29, sz * (W / 2 - 0.05)), ALU, M.Metal, { nc = true, ns = true })
		local pockets = math.floor(L / 1.2)
		for k = 1, pockets - 1 do
			b.part("StakePocket", V(0.12, 0.13, 0.012), CF(-L / 2 + k * 1.2, H - 0.15, sz * (W / 2 + 0.002)), FRAME, M.Metal, { nc = true, ns = true })
		end
		for k = 0, 3 do
			local m = b.part("Marker", V(0.08, 0.05, 0.02), CF(-L / 2 + 1 + k * (L - 2) / 3, H - 0.22, sz * (W / 2 + 0.01)), Color3.fromRGB(255, 150, 30), M.Neon, { nc = true, ns = true })
			m.Transparency = 0.05
		end
		-- main beams (I-beams under the deck)
		local bz = sz * 0.5
		b.part("BeamTop", V(L - 0.4, 0.02, 0.18), CF(0.2, H - 0.32, bz), FRAME, M.Metal)
		b.part("BeamWeb", V(L - 0.4, 0.42, 0.012), CF(0.2, H - 0.54, bz), FRAME, M.Metal)
		b.part("BeamBottom", V(L - 0.4, 0.02, 0.16), CF(0.2, H - 0.76, bz), FRAME, M.Metal)
	end
	-- crossmembers
	for k = 0, 15 do
		b.part("Crossmember", V(0.06, 0.16, W - 0.2), CF(-L / 2 + 0.5 + k * (L - 1) / 15, H - 0.38, 0), FRAME, M.Metal, { nc = true, ns = true })
	end
	-- strap winches along the driver's side
	for k = 0, 11 do
		local x = -L / 2 + 0.9 + k * (L - 1.8) / 11
		b.cylX("Winch", 0.16, 0.12, CF(x, H - 0.42, W / 2 - 0.12), Color3.fromRGB(70, 72, 76), M.Metal, { nc = true, ns = true })
		b.part("WinchFace", V(0.03, 0.18, 0.18), CF(x + 0.09, H - 0.42, W / 2 - 0.12), Color3.fromRGB(150, 152, 156), M.Metal, { nc = true, ns = true })
	end
	-- landing gear
	for _, sz in ipairs({ -1, 1 }) do
		local x = -L / 2 + 3.4
		b.part("LegOuter", V(0.13, H - 0.85, 0.13), CF(x, (H - 0.85) / 2 + 0.55, sz * 0.62), FRAME, M.Metal)
		b.part("LegInner", V(0.09, 0.5, 0.09), CF(x, 0.3, sz * 0.62), Color3.fromRGB(120, 122, 124), M.Metal)
		b.part("Foot", V(0.3, 0.05, 0.3), CF(x, 0.025, sz * 0.62), FRAME, M.Metal)
	end
	b.part("GearBrace", V(0.05, 0.05, 1.24), CF(-L / 2 + 3.4, 0.9, 0), FRAME, M.Metal, { nc = true })
	b.part("Crank", V(0.03, 0.03, 0.4), CF(-L / 2 + 3.4, 0.95, W / 2 - 0.1), Color3.fromRGB(150, 152, 156), M.Metal, { nc = true, ns = true })
	-- tandem axle, air-ride
	local tAxles = { L / 2 - 2.4, L / 2 - 1.15 }
	for _, ax in ipairs(tAxles) do
		b.cylZ("Axle", W - 0.3, 0.12, V(ax, WD / 2, 0), FRAME, M.Metal, { nc = true, ns = true })
		for _, sz in ipairs({ -1, 1 }) do
			wheel(b, wheels, ax, sz * 0.88, sz, true, WD, false)
			b.cylY("AirBag", 0.25, 0.28, V(ax + 0.3, H - 0.92, sz * 0.5), TIRE, M.SmoothPlastic, { nc = true, ns = true })
			b.part("Hanger", V(0.1, 0.35, 0.08), CF(ax - 0.45, H - 0.95, sz * 0.5), FRAME, M.Metal, { nc = true, ns = true })
		end
	end
	for _, sz in ipairs({ -1, 1 }) do
		b.part("TrailerFender", V(2.5, 0.04, 0.6), CF((tAxles[1] + tAxles[2]) / 2, H - 0.32, sz * 0.95), FRAME, M.Metal, { nc = true, ns = true })
		b.part("Mudflap", V(0.02, 0.6, 0.62), CF(L / 2 - 0.35, 0.55, sz * 0.88), TIRE, M.SmoothPlastic, { nc = true })
	end
	-- rear: ICC bumper, light bar, plate
	b.part("ICCBar", V(0.12, 0.12, W - 0.3), CF(L / 2 - 0.2, 0.62, 0), FRAME, M.Metal, { refl = 0.05 })
	b.part("ICCPost", V(0.08, 0.5, 0.08), CF(L / 2 - 0.25, 0.9, 0.7), FRAME, M.Metal, { nc = true })
	b.part("ICCPost", V(0.08, 0.5, 0.08), CF(L / 2 - 0.25, 0.9, -0.7), FRAME, M.Metal, { nc = true })
	b.part("RearSill", V(0.08, 0.3, W), CF(L / 2 - 0.04, H - 0.15, 0), ALU, M.Metal)
	for _, sz in ipairs({ -1, 1 }) do
		for k = 0, 1 do
			local tl = b.cylX("TailLight", 0.03, 0.12, CF(L / 2 + 0.005, H - 0.18, sz * (W / 2 - 0.2 - k * 0.18)), Color3.fromRGB(210, 22, 22), M.Neon, { nc = true, ns = true })
			tl.Transparency = 0.05
		end
	end
	b.part("Reflector", V(0.012, 0.05, W - 0.6), CF(L / 2 - 0.13, 0.62, 0), Color3.fromRGB(220, 40, 30), M.SmoothPlastic, { nc = true, ns = true })
	b.part("Plate", V(0.01, 0.15, 0.3), CF(L / 2 - 0.1, 0.42, -0.6), Color3.fromRGB(236, 236, 230), M.SmoothPlastic, { nc = true, ns = true })
	b.part("KingpinPlate", V(1.4, 0.04, W - 0.4), CF(-L / 2 + 0.75, H - 0.77, 0), FRAME, M.Metal, { nc = true, ns = true })

	------------------------------------------------------------------ tractor
	local tx = -L / 2 -- front of the trailer
	local body, stripe = paint.body, paint.stripe
	-- frame rails
	for _, sz in ipairs({ -1, 1 }) do
		b.part("FrameRail", V(9.9, 0.27, 0.09), CF(tx - 3.3, 0.92, sz * 0.43), FRAME, M.Metal)
	end
	-- fifth wheel and deck plate
	b.part("FifthWheel", V(1.0, 0.1, 1.1), CF(tx + 0.75, 1.2, 0), FRAME, M.Metal)
	b.part("FifthWheelTop", V(0.9, 0.02, 1.0), CF(tx + 0.75, 1.26, 0), Color3.fromRGB(60, 60, 60), M.Metal, { nc = true, ns = true })
	b.part("DeckPlate", V(1.6, 0.03, 1.3), CF(tx - 1.0, 1.1, 0), ALU, M.DiamondPlate)
	-- drive tandem and steer axle
	local drive = { tx + 0.1, tx + 1.4 }
	for _, ax in ipairs(drive) do
		b.cylZ("DriveAxle", 1.9, 0.18, V(ax, WD / 2, 0), FRAME, M.Metal, { nc = true, ns = true })
		b.part("Diff", V(0.42, 0.42, 0.42), CF(ax, WD / 2, 0), FRAME, M.Metal, { nc = true, ns = true })
		for _, sz in ipairs({ -1, 1 }) do
			wheel(b, wheels, ax, sz * 0.86, sz, true, WD, false)
		end
	end
	local steerX = tx - 7.45
	b.cylZ("SteerAxle", 1.9, 0.14, V(steerX, WD / 2, 0), FRAME, M.Metal, { nc = true, ns = true })
	for _, sz in ipairs({ -1, 1 }) do
		wheel(b, wheels, steerX, sz * 0.98, sz, false, WD, true)
		-- quarter fenders and mud flaps behind the drives
		b.part("QuarterFender", V(1.2, 0.05, 0.62), CF((drive[1] + drive[2]) / 2 - 0.1, WD + 0.12, sz * 0.92) * CFrame.Angles(0, 0, 0), FRAME, M.Metal, { nc = true, ns = true })
		b.part("DriveFlap", V(0.02, 0.62, 0.62), CF(drive[2] + 0.62, 0.55, sz * 0.92), TIRE, M.SmoothPlastic, { nc = true })
		b.part("FlapWeight", V(0.022, 0.08, 0.6), CF(drive[2] + 0.63, 0.28, sz * 0.92), CHROME, M.Metal, { nc = true, ns = true, refl = 0.3 })
	end
	-- fuel tanks with straps, steps
	for _, sz in ipairs({ -1, 1 }) do
		local x = tx - 4.55
		b.cylX("FuelTank", 1.55, 0.64, CF(x, 0.95, sz * 0.86), CHROME, M.Metal, { refl = 0.3 })
		for _, dx in ipairs({ -0.5, 0.5 }) do
			b.cylX("TankStrap", 0.05, 0.66, CF(x + dx, 0.95, sz * 0.86), FRAME, M.Metal, { nc = true, ns = true })
		end
		b.part("TankCap", V(0.1, 0.03, 0.1), CF(x + 0.55, 1.28, sz * 0.86), CHROME, M.Metal, { nc = true, ns = true })
		-- cab step box ahead of the tank, two diamond-plate treads
		b.part("StepBox", V(0.5, 0.62, 0.32), CF(tx - 5.6, 0.83, sz * 0.92), ALU, M.Metal, { refl = 0.15 })
		b.part("Step", V(0.52, 0.04, 0.34), CF(tx - 5.6, 0.68, sz * 0.94), ALU, M.DiamondPlate, { nc = true })
		b.part("Step", V(0.52, 0.04, 0.34), CF(tx - 5.6, 1.14, sz * 0.94), ALU, M.DiamondPlate, { nc = true })
	end
	-- cab (sleeper behind, day cab front)
	local cabX0, cabX1 = tx - 6.0, tx - 4.25 -- cab front .. back
	local slpX0, slpX1 = tx - 4.25, tx - 2.35
	local floorY = 1.15
	b.part("CabBody", V(cabX1 - cabX0, 1.55, 2.0), CF((cabX0 + cabX1) / 2, floorY + 0.775, 0), body, M.Metal, { refl = 0.06 })
	b.part("CabRoof", V(cabX1 - cabX0 - 0.1, 0.14, 1.9), CF((cabX0 + cabX1) / 2 + 0.05, floorY + 1.62, 0), body, M.Metal, { refl = 0.06 })
	b.part("Sleeper", V(slpX1 - slpX0, 2.1, 2.0), CF((slpX0 + slpX1) / 2, floorY + 1.05, 0), body, M.Metal, { refl = 0.06 })
	b.part("SleeperRoof", V(slpX1 - slpX0 - 0.06, 0.1, 1.92), CF((slpX0 + slpX1) / 2, floorY + 2.15, 0), body, M.Metal, { refl = 0.06 })
	-- wedge rises toward the sleeper (local +Z -> world +X)
	b.part("RoofFairing", V(1.9, 0.5, 0.75), CF(cabX1 - 0.375, floorY + 1.94, 0) * CFrame.Angles(0, math.pi / 2, 0), body, M.Metal, { wedge = true })
	-- windshield (split, raked) and visor
	for _, sz in ipairs({ -1, 1 }) do
		b.part("Windshield", V(0.04, 0.72, 0.9), CF(cabX0 - 0.02, floorY + 1.15, sz * 0.47) * CFrame.Angles(0, 0, math.rad(-10)), GLASS, M.Glass, { nc = true, refl = 0.3 })
	end
	b.part("CentrePost", V(0.06, 0.74, 0.06), CF(cabX0 - 0.01, floorY + 1.15, 0) * CFrame.Angles(0, 0, math.rad(-10)), body, M.Metal, { nc = true })
	b.part("Visor", V(0.32, 0.05, 1.95), CF(cabX0 - 0.12, floorY + 1.58, 0) * CFrame.Angles(0, 0, math.rad(8)), body, M.Metal, { nc = true })
	for k = -2, 2 do
		b.part("CabLight", V(0.06, 0.05, 0.1), CF(cabX0 + 0.05, floorY + 1.71, k * 0.3), Color3.fromRGB(255, 160, 30), M.Neon, { nc = true, ns = true })
	end
	-- doors, side windows, sleeper window, stripes, mirrors
	for _, sz in ipairs({ -1, 1 }) do
		local face = sz * 1.0
		b.part("DoorWindow", V(0.8, 0.55, 0.02), CF(cabX0 + 0.75, floorY + 1.15, face + sz * 0.005), GLASS, M.Glass, { nc = true, refl = 0.3 })
		b.part("DoorSeam", V(0.02, 1.3, 0.012), CF(cabX0 + 1.25, floorY + 0.75, face + sz * 0.006), Color3.fromRGB(16, 16, 18), M.SmoothPlastic, { nc = true, ns = true })
		b.part("DoorHandle", V(0.14, 0.03, 0.03), CF(cabX0 + 1.15, floorY + 0.8, face + sz * 0.02), CHROME, M.Metal, { nc = true, ns = true, refl = 0.3 })
		b.part("SleeperWindow", V(0.4, 0.3, 0.02), CF(slpX0 + 0.55, floorY + 1.35, face + sz * 0.005), GLASS, M.Glass, { nc = true, refl = 0.3 })
		b.part("StorageDoor", V(0.6, 0.45, 0.012), CF(slpX0 + 1.2, floorY + 0.3, face + sz * 0.006), body, M.Metal, { nc = true, ns = true })
		b.part("Stripe", V(slpX1 - cabX0 - 0.1, 0.08, 0.01), CF((cabX0 + slpX1) / 2, floorY + 0.55, face + sz * 0.007), stripe, M.SmoothPlastic, { nc = true, ns = true })
		b.part("MirrorArm", V(0.03, 0.03, 0.35), CF(cabX0 + 0.15, floorY + 1.0, sz * 1.17), CHROME, M.Metal, { nc = true, ns = true })
		b.part("Mirror", V(0.05, 0.45, 0.2), CF(cabX0 + 0.12, floorY + 1.1, sz * 1.35), Color3.fromRGB(18, 18, 20), M.SmoothPlastic, { nc = true })
		b.part("MirrorGlass", V(0.006, 0.4, 0.16), CF(cabX0 + 0.15, floorY + 1.1, sz * 1.35), Color3.fromRGB(150, 170, 185), M.Glass, { nc = true, ns = true, refl = 0.5 })
		-- exhaust stack with heat shield
		b.cylY("Stack", 3.0, 0.14, V(slpX1 + 0.12, 2.6, sz * 0.95), CHROME, M.Metal, { nc = true, refl = 0.35 })
		b.cylY("HeatShield", 0.9, 0.2, V(slpX1 + 0.12, 2.0, sz * 0.95), ALU, M.DiamondPlate, { nc = true, ns = true })
		b.part("StackTip", V(0.16, 0.04, 0.16), CF(slpX1 + 0.12, 4.12, sz * 0.95) * CFrame.Angles(0, 0, math.rad(25)), CHROME, M.Metal, { nc = true, ns = true })
		-- air lines to the trailer
		b.cylX("AirLine", 1.4, 0.03, CF(slpX1 + 0.75, 1.75, sz * 0.12) * CFrame.Angles(0, 0, math.rad(-20)), sz > 0 and Color3.fromRGB(180, 30, 30) or Color3.fromRGB(30, 60, 160), M.SmoothPlastic, { nc = true, ns = true })
	end
	-- long hood, fenders, grille, bumper, lights
	local hoodX0, hoodX1 = tx - 8.25, cabX0
	local hoodLen = hoodX1 - hoodX0
	b.part("Hood", V(hoodLen, 0.7, 1.12), CF((hoodX0 + hoodX1) / 2, 1.62, 0), body, M.Metal, { refl = 0.06 })
	b.part("HoodTop", V(hoodLen - 0.1, 0.1, 0.9), CF((hoodX0 + hoodX1) / 2 + 0.05, 2.0, 0), body, M.Metal, { refl = 0.06 })
	b.part("Cowl", V(0.3, 0.25, 1.95), CF(hoodX1 - 0.15, 1.8, 0), body, M.Metal)
	for _, sz in ipairs({ -1, 1 }) do
		b.part("HoodShoulder", V(hoodLen - 0.1, 0.12, 0.12), CF((hoodX0 + hoodX1) / 2 + 0.05, 1.96, sz * 0.5) * CFrame.Angles(math.rad(sz * 35), 0, 0), body, M.Metal, { nc = true })
		-- front fender: a solid crown over the steer tyre that sweeps down to
		-- the bumper in front and to the cab step behind
		local fz = sz * 0.84
		b.part("FenderCrown", V(1.3, 0.3, 0.46), CF(steerX, WD + 0.13, fz), body, M.Metal, { refl = 0.06 })
		-- wedges: local +Z is the tall end, rotate so it meets the crown
		b.part("FenderNose", V(0.46, 0.3, 0.55), CF(steerX - 0.925, WD + 0.13, fz) * CFrame.Angles(0, math.pi / 2, 0), body, M.Metal, { wedge = true, nc = true })
		b.part("FenderTail", V(0.46, 0.3, 0.7), CF(steerX + 1.0, WD + 0.13, fz) * CFrame.Angles(0, -math.pi / 2, 0), body, M.Metal, { wedge = true, nc = true })
		b.part("FenderLiner", V(1.3, 0.04, 0.4), CF(steerX, WD - 0.03, fz), FRAME, M.SmoothPlastic, { nc = true, ns = true })
		-- twin round headlights on the fender
		for k = 0, 1 do
			local hz = sz * (0.72 + k * 0.2)
			b.cylX("HeadlightBucket", 0.16, 0.2, CF(hoodX0 + 0.25, WD + 0.38, hz), CHROME, M.Metal, { nc = true, ns = true, refl = 0.35 })
			local lens = b.cylX("Headlight", 0.02, 0.17, CF(hoodX0 + 0.16, WD + 0.38, hz), Color3.fromRGB(250, 248, 236), M.Neon, { nc = true, ns = true })
			lens.Transparency = 0.1
		end
		-- round air cleaner on the hood side
		b.cylY("AirCleaner", 0.65, 0.45, V(hoodX1 - 0.45, 1.65, sz * 0.82), CHROME, M.Metal, { nc = true, refl = 0.3 })
		b.cylZ("Intake", 0.25, 0.14, V(hoodX1 - 0.45, 1.85, sz * 0.66), CHROME, M.Metal, { nc = true, ns = true })
		b.part("HoodVent", V(0.6, 0.18, 0.012), CF(hoodX0 + 1.2, 1.6, sz * 0.565), Color3.fromRGB(40, 40, 42), M.DiamondPlate, { nc = true, ns = true })
	end
	-- grille: chrome surround with horizontal bars and an emblem
	local gx = hoodX0 - 0.02
	b.part("GrilleSurround", V(0.08, 1.05, 1.08), CF(gx, 1.55, 0), CHROME, M.Metal, { refl = 0.35 })
	b.part("GrilleBack", V(0.02, 0.9, 0.92), CF(gx - 0.035, 1.55, 0), Color3.fromRGB(26, 26, 28), M.Metal, { nc = true, ns = true })
	for k = 0, 8 do
		b.part("GrilleBar", V(0.03, 0.025, 0.9), CF(gx - 0.045, 1.15 + k * 0.1, 0), CHROME, M.Metal, { nc = true, ns = true, refl = 0.35 })
	end
	b.part("Emblem", V(0.03, 0.1, 0.3), CF(gx - 0.05, 2.12, 0), CHROME, M.Metal, { nc = true, ns = true, refl = 0.4 })
	b.part("Bumper", V(0.32, 0.36, 2.45), CF(gx - 0.2, 0.72, 0), CHROME, M.Metal, { refl = 0.35 })
	b.part("BumperStep", V(0.2, 0.04, 2.3), CF(gx - 0.32, 0.92, 0), ALU, M.DiamondPlate, { nc = true, ns = true })
	b.part("TowHook", V(0.08, 0.12, 0.12), CF(gx - 0.38, 0.6, 0.6), Color3.fromRGB(190, 40, 30), M.Metal, { nc = true, ns = true })

	-- sound source and interaction box
	local engine = b.part("Engine", V(1, 0.6, 1), CF(hoodX0 + hoodLen / 2, 1.2, 0), FRAME, M.Metal, { nc = true, tr = 1, nq = true, ns = true })
	engine:SetAttribute("Sound", "TruckIdle")
	local interact = b.part("TruckInteract", V(cabX1 - hoodX0 + 0.3, 2.8, 2.6), CF((hoodX0 + slpX1) / 2, 1.8, 0), C.Steel, M.SmoothPlastic, { tr = 1, nc = true, ns = true })
	interact:SetAttribute("TrailerInteract", "Cab")

	model:PivotTo(bayCf)
	return model, H * S
end

---------------------------------------------------------------------------
-- Freight railcars (phase 4: rail deliveries)
---------------------------------------------------------------------------

-- Bulkhead flatcar, deck along +X. Origin on the rail head under the deck
-- centre. Returns model and deck height (studs).
function VehicleFactory.buildFlatcar(cf, seed)
	local model = Instance.new("Model")
	model.Name = "Flatcar"
	local root = Instance.new("Part")
	root.Name = "Root"
	root.Size = V(0.4, 0.4, 0.4)
	root.Transparency = 1
	root.Anchored = true
	root.CanCollide = false
	root.CanQuery = false
	root.CanTouch = false
	root.CFrame = CF()
	root.Parent = model
	model.PrimaryPart = root
	local b = newBuilder(model)
	local wheels = Instance.new("Folder")
	wheels.Name = "Wheels"
	wheels.Parent = model
	local L, W, H = 18.0, 2.9, 1.25
	local car = Color3.fromRGB(70, 40, 30)
	b.part("Deck", V(L, 0.08, W), CF(0, H - 0.04, 0), Color3.fromRGB(110, 86, 62), M.WoodPlanks)
	b.part("CentreSill", V(L, 0.55, 0.5), CF(0, H - 0.36, 0), car, M.Metal)
	for _, sz in ipairs({ -1, 1 }) do
		b.part("SideSill", V(L, 0.3, 0.08), CF(0, H - 0.2, sz * (W / 2 - 0.04)), car, M.Metal)
		for k = 0, 12 do
			b.part("StakePocket", V(0.1, 0.12, 0.012), CF(-L / 2 + 0.9 + k * (L - 1.8) / 12, H - 0.2, sz * (W / 2 + 0.002)), Color3.fromRGB(40, 24, 18), M.Metal, { nc = true, ns = true })
		end
	end
	for _, sx in ipairs({ -1, 1 }) do
		-- bulkhead
		b.part("Bulkhead", V(0.12, 2.4, W), CF(sx * (L / 2 - 0.06), H + 1.2, 0), car, M.Metal)
		for k = 0, 3 do
			b.part("BulkheadRib", V(0.14, 0.08, W), CF(sx * (L / 2 - 0.06), H + 0.4 + k * 0.6, 0), Color3.fromRGB(56, 32, 24), M.Metal, { nc = true, ns = true })
		end
		-- trucks (bogies)
		local bx = sx * (L / 2 - 2.2)
		b.part("Bolster", V(0.5, 0.3, 2.4), CF(bx, 0.75, 0), Color3.fromRGB(36, 36, 38), M.Metal)
		for _, dx in ipairs({ -0.9, 0.9 }) do
			b.cylZ("WheelAxle", 1.6, 0.14, V(bx + dx, 0.46, 0), Color3.fromRGB(46, 46, 48), M.Metal, { nc = true, ns = true })
			for _, sz in ipairs({ -1, 1 }) do
				local w = Instance.new("Model")
				w.Name = "Wheel"
				w.Parent = wheels
				local t = b.cylZ("RailWheel", 0.14, 0.92, V(bx + dx, 0.46, sz * 0.72), Color3.fromRGB(58, 52, 48), M.Metal, nil, w)
				b.cylZ("Flange", 0.03, 1.0, V(bx + dx, 0.46, sz * 0.64), Color3.fromRGB(58, 52, 48), M.Metal, { nc = true, ns = true }, w)
				w.PrimaryPart = t
				w:SetAttribute("Radius", 0.46 * S)
			end
		end
		for _, sz in ipairs({ -1, 1 }) do
			b.part("SideFrame", V(2.4, 0.3, 0.12), CF(bx, 0.5, sz * 0.86), Color3.fromRGB(36, 36, 38), M.Metal, { nc = true })
			b.cylY("Spring", 0.3, 0.16, V(bx, 0.72, sz * 0.86), Color3.fromRGB(70, 70, 72), M.Metal, { nc = true, ns = true })
		end
		b.part("Coupler", V(0.6, 0.2, 0.25), CF(sx * (L / 2 + 0.3), 0.85, 0), Color3.fromRGB(36, 36, 38), M.Metal)
	end
	local reporting = b.part("Reporting", V(3, 0.25, 0.01), CF(0, H - 0.2, W / 2 + 0.01), Color3.fromRGB(230, 230, 226), M.SmoothPlastic, { nc = true, ns = true })
	reporting.Transparency = 0.1
	model:PivotTo(cf)
	return model, H * S, L * S
end

-- Diesel-electric road switcher. Origin on the rail head at mid-length.
function VehicleFactory.buildLocomotive(cf)
	local model = Instance.new("Model")
	model.Name = "Locomotive"
	local root = Instance.new("Part")
	root.Name = "Root"
	root.Size = V(0.4, 0.4, 0.4)
	root.Transparency = 1
	root.Anchored = true
	root.CanCollide = false
	root.CanQuery = false
	root.CanTouch = false
	root.CFrame = CF()
	root.Parent = model
	model.PrimaryPart = root
	local b = newBuilder(model)
	local wheels = Instance.new("Folder")
	wheels.Name = "Wheels"
	wheels.Parent = model
	local L = 17.0
	local paint = Color3.fromRGB(230, 170, 20)
	local dark = Color3.fromRGB(36, 38, 40)
	b.part("Frame", V(L, 0.45, 3.0), CF(0, 1.35, 0), dark, M.Metal)
	b.part("LongHood", V(10.5, 2.4, 2.4), CF(2.3, 2.8, 0), paint, M.Metal, { refl = 0.05 })
	b.part("Cab", V(3.2, 3.0, 3.0), CF(-4.55, 3.1, 0), paint, M.Metal, { refl = 0.05 })
	b.part("CabRoof", V(3.3, 0.15, 3.05), CF(-4.55, 4.65, 0), dark, M.Metal)
	b.part("ShortHood", V(2.2, 1.9, 2.2), CF(-7.25, 2.55, 0), paint, M.Metal)
	for _, sz in ipairs({ -1, 1 }) do
		b.part("CabWindow", V(1.2, 0.8, 0.02), CF(-4.3, 3.9, sz * 1.51), GLASS, M.Glass, { nc = true, refl = 0.3 })
		b.part("Walkway", V(L - 1, 0.04, 0.3), CF(0, 1.6, sz * 1.35), dark, M.DiamondPlate, { nc = true })
		b.part("Handrail", V(L - 1.5, 0.05, 0.05), CF(0, 2.6, sz * 1.48), paint, M.Metal, { nc = true, ns = true })
		b.part("Stripe", V(L - 0.5, 0.15, 0.012), CF(0, 1.45, sz * 1.505), Color3.fromRGB(20, 20, 22), M.SmoothPlastic, { nc = true, ns = true })
	end
	b.part("Windshield", V(0.02, 0.9, 2.4), CF(-6.16, 3.9, 0), GLASS, M.Glass, { nc = true, refl = 0.3 })
	for k = 0, 3 do
		b.part("Radiator", V(0.9, 0.05, 1.8), CF(5.5 + (k % 2) * 1.0, 4.02, 0), dark, M.DiamondPlate, { nc = true, ns = true })
	end
	b.cylY("ExhaustStack", 0.4, 0.3, V(1.0, 4.15, 0), dark, M.Metal, { nc = true, ns = true })
	local hl = b.cylX("Headlight", 0.03, 0.3, CF(-8.37, 3.2, 0), Color3.fromRGB(250, 248, 236), M.Neon, { nc = true, ns = true })
	hl.Transparency = 0.1
	for _, sx in ipairs({ -1, 1 }) do
		local bx = sx * 5.6
		b.part("TruckFrame", V(3.6, 0.5, 2.4), CF(bx, 0.85, 0), dark, M.Metal)
		for _, dx in ipairs({ -1.3, 0, 1.3 }) do
			for _, sz in ipairs({ -1, 1 }) do
				local w = Instance.new("Model")
				w.Name = "Wheel"
				w.Parent = wheels
				local t = b.cylZ("RailWheel", 0.14, 1.02, V(bx + dx, 0.51, sz * 0.72), Color3.fromRGB(58, 52, 48), M.Metal, nil, w)
				w.PrimaryPart = t
				w:SetAttribute("Radius", 0.51 * S)
			end
		end
		b.part("Pilot", V(0.3, 0.6, 3.0), CF(sx * (L / 2 + 0.1), 1.1, 0), dark, M.Metal)
		b.part("Coupler", V(0.6, 0.2, 0.25), CF(sx * (L / 2 + 0.5), 0.85, 0), dark, M.Metal)
	end
	local fuel = b.part("FuelTank", V(5, 0.8, 2.4), CF(0.5, 0.75, 0), dark, M.Metal)
	fuel.CastShadow = true
	local engine = b.part("Engine", V(1, 1, 1), CF(2, 2.5, 0), dark, M.Metal, { nc = true, tr = 1, nq = true, ns = true })
	engine:SetAttribute("Sound", "TruckIdle")
	model:PivotTo(cf)
	return model, L * S
end

return VehicleFactory
