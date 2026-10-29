-- Procedural geometry for every catalog item.
--
-- Every component is a Model whose PrimaryPart is an invisible "Root" part at
-- the item's local origin. All parts are anchored; components are moved with
-- Model:PivotTo (installed steel never simulates). Hand carrying temporarily
-- welds the parts to the character on the server.
--
-- Builders work in metres in item-local space; the factory converts to studs.

local Config = require(script.Parent.Config)
local Util = require(script.Parent.Util)

local S = Config.S
local C = Config.Colors
local M = Enum.Material

local Factory = {}

local Builder = {}
Builder.__index = Builder

-- b:box(name, sizeMeters, cframeMeters, color, material, flags)
-- flags: nc = no collision, ns = no shadow, tr = transparency, refl = reflectance,
--        shape = Enum.PartType, nq = not queryable
local function applyFlags(p, flags)
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
	end
end

-- CFrame.lookAt with a safe up vector for (near) vertical directions.
local function lookAlong(pos, dir)
	local up = Vector3.yAxis
	if dir.Magnitude > 0 and math.abs(dir.Unit.Y) > 0.98 then
		up = Vector3.xAxis
	end
	return CFrame.lookAt(pos, pos + dir, up)
end
Factory.lookAlong = lookAlong

local function toStuds(cf)
	local x, y, z, r00, r01, r02, r10, r11, r12, r20, r21, r22 = cf:GetComponents()
	return CFrame.new(x * S, y * S, z * S, r00, r01, r02, r10, r11, r12, r20, r21, r22)
end

function Builder.new(model, tint)
	local self = setmetatable({}, Builder)
	self.model = model
	self.tint = tint or 0
	return self
end

function Builder:_tint(color)
	if self.tint == 0 or not color then
		return color
	end
	local h, s, v = color:ToHSV()
	return Color3.fromHSV(h, s, Util.clamp(v * (1 + self.tint), 0, 1))
end

function Builder:box(name, size, cf, color, material, flags)
	local p = Instance.new("Part")
	p.Name = name
	p.Anchored = true
	p.Size = Vector3.new(math.max(size.X * S, 0.02), math.max(size.Y * S, 0.02), math.max(size.Z * S, 0.02))
	p.CFrame = toStuds(cf)
	p.Color = self:_tint(color or C.MillSteel)
	p.Material = material or M.Metal
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.CanTouch = false
	applyFlags(p, flags)
	if flags and flags.shape then
		p.Shape = flags.shape
	end
	p.Parent = self.model
	return p
end

-- Cylinder along local X of `cf` (Roblox cylinders run along X).
function Builder:cylX(name, length, diameter, cf, color, material, flags)
	local f = flags and Util.shallowCopy(flags) or {}
	f.shape = Enum.PartType.Cylinder
	return self:box(name, Vector3.new(length, diameter, diameter), cf, color, material, f)
end

-- Vertical cylinder centred at `pos` (metres).
function Builder:cylY(name, length, diameter, pos, color, material, flags)
	return self:cylX(name, length, diameter, CFrame.new(pos) * CFrame.Angles(0, 0, math.pi / 2), color, material, flags)
end

-- Cylinder (tube) between two points.
function Builder:tube(name, a, b, diameter, color, material, flags)
	local mid = (a + b) / 2
	local dir = b - a
	local len = dir.Magnitude
	local cf = lookAlong(mid, dir) * CFrame.Angles(0, math.pi / 2, 0)
	return self:cylX(name, len, diameter, cf, color, material, flags)
end

-- Rectangular bar between two points.
function Builder:bar(name, a, b, w, h, color, material, flags)
	local mid = (a + b) / 2
	local len = (b - a).Magnitude
	local cf = lookAlong(mid, b - a)
	return self:box(name, Vector3.new(w, h, len), cf, color, material, flags)
end

function Builder:wedge(name, size, cf, color, material, flags)
	local p = Instance.new("WedgePart")
	p.Name = name
	p.Anchored = true
	p.Size = Vector3.new(size.X * S, size.Y * S, size.Z * S)
	p.CFrame = toStuds(cf)
	p.Color = self:_tint(color or C.MillSteel)
	p.Material = material or M.Metal
	p.CanTouch = false
	applyFlags(p, flags)
	p.Parent = self.model
	return p
end

function Builder:sphere(name, diameter, pos, color, material, flags)
	local f = flags and Util.shallowCopy(flags) or {}
	f.shape = Enum.PartType.Ball
	return self:box(name, Vector3.new(diameter, diameter, diameter), CFrame.new(pos), color, material, f)
end

-- Wide-flange (W) shape. axis "X": length along X (beams). axis "Y": columns,
-- flanges face +/-X.
function Builder:wShape(prefix, length, p, cf, color, material)
	local d, bf, tf, tw = p.d, p.bf, p.tf, p.tw
	if p.axis == "Y" then
		self:box(prefix .. "FlangeA", Vector3.new(tf, length, bf), cf * CFrame.new(d / 2 - tf / 2, 0, 0), color, material)
		self:box(prefix .. "FlangeB", Vector3.new(tf, length, bf), cf * CFrame.new(-d / 2 + tf / 2, 0, 0), color, material)
		self:box(prefix .. "Web", Vector3.new(d - 2 * tf, length, tw), cf, color, material)
	else
		self:box(prefix .. "TopFlange", Vector3.new(length, tf, bf), cf * CFrame.new(0, d / 2 - tf / 2, 0), color, material)
		self:box(prefix .. "BottomFlange", Vector3.new(length, tf, bf), cf * CFrame.new(0, -d / 2 + tf / 2, 0), color, material)
		self:box(prefix .. "Web", Vector3.new(length, d - 2 * tf, tw), cf, color, material)
	end
end

-- Hollow structural section (square tube) along X.
function Builder:hss(prefix, length, w, t, cf, color, material)
	self:box(prefix .. "T", Vector3.new(length, t, w), cf * CFrame.new(0, w / 2 - t / 2, 0), color, material)
	self:box(prefix .. "B", Vector3.new(length, t, w), cf * CFrame.new(0, -w / 2 + t / 2, 0), color, material)
	self:box(prefix .. "L", Vector3.new(length, w - 2 * t, t), cf * CFrame.new(0, 0, w / 2 - t / 2), color, material)
	self:box(prefix .. "R", Vector3.new(length, w - 2 * t, t), cf * CFrame.new(0, 0, -w / 2 + t / 2), color, material)
end

-- Small painted stencil mark (piece mark) - a thin off-white plate.
function Builder:stencil(cf, w, h)
	return self:box("Stencil", Vector3.new(w, h, 0.002), cf, C.OffWhite, M.SmoothPlastic, { nc = true, ns = true })
end

Factory.Builder = Builder

---------------------------------------------------------------------------
-- Model assembly
---------------------------------------------------------------------------

local function makeRoot(model)
	local root = Instance.new("Part")
	root.Name = "Root"
	root.Size = Vector3.new(0.2, 0.2, 0.2)
	root.Transparency = 1
	root.Anchored = true
	root.CanCollide = false
	root.CanQuery = false
	root.CanTouch = false
	root.CastShadow = false
	root.CFrame = CFrame.new()
	root.Parent = model
	model.PrimaryPart = root
	return root
end

-- Builds the model for a registry definition at the origin, then pivots it.
-- opts: { tint = number, installed = bool, ghost = bool, preview = bool }
function Factory.build(def, cf, opts)
	opts = opts or {}
	local model = Instance.new("Model")
	model.Name = def.id
	makeRoot(model)
	local b = Builder.new(model, opts.tint or 0)
	b.opts = opts
	local ok, err = pcall(def.build, b, def, opts)
	if not ok then
		warn("[STEELRISE] builder failed for", def.id, err)
		b:box("Fallback", def.sizeM, CFrame.new(0, def.originBottom and def.sizeM.Y / 2 or 0, 0), C.Invalid, M.SmoothPlastic)
	end
	if opts.ghost then
		Factory.makeGhost(model)
	end
	if cf then
		model:PivotTo(cf)
	end
	return model
end

function Factory.makeGhost(model)
	for _, p in ipairs(model:GetDescendants()) do
		if p:IsA("BasePart") then
			p.CanCollide = false
			p.CanQuery = false
			p.CanTouch = false
			p.CastShadow = false
			p.Anchored = true
			if p.Name ~= "Root" and not p:IsA("TrussPart") then
				p.Transparency = math.max(p.Transparency, 0.45)
				p.Material = M.SmoothPlastic
			end
			if p:IsA("TrussPart") then
				p.Transparency = 1
			end
		elseif p:IsA("SurfaceGui") or p:IsA("Light") or p:IsA("ParticleEmitter") or p:IsA("Sound") then
			p:Destroy()
		end
	end
end

-- Fastener visuals. Created when a component is placed; a fastener becomes
-- visible once it has been tightened/welded. Index order matches def.fasteners.
function Factory.addFasteners(model, def, mask)
	local folder = model:FindFirstChild("Fasteners")
	if folder then
		folder:Destroy()
	end
	if not def.fasteners or #def.fasteners == 0 then
		return
	end
	folder = Instance.new("Folder")
	folder.Name = "Fasteners"
	folder.Parent = model
	local rootCf = model:GetPivot()
	for i, f in ipairs(def.fasteners) do
		local done = mask and string.sub(mask, i, i) == "1"
		local p = Instance.new("Part")
		p.Name = "F" .. i
		p.Anchored = true
		p.CanCollide = false
		p.CanTouch = false
		p.CastShadow = false
		p.TopSurface = Enum.SurfaceType.Smooth
		p.BottomSurface = Enum.SurfaceType.Smooth
		local pos = f.pos * S
		local normal = f.normal or Vector3.new(0, 0, 1)
		local local_cf = lookAlong(pos, normal)
		if f.type == "Weld" then
			p.Size = Vector3.new(0.16, 0.16, 0.06)
			p.Color = Color3.fromRGB(58, 56, 54)
			p.Material = M.Metal
		elseif f.type == "Wedge" then
			p.Size = Vector3.new(0.06, 0.22, 0.12)
			p.Color = C.SteelDark
			p.Material = M.Metal
		else
			-- Hex nut + washer read as a short cylinder (axis along the normal)
			p.Shape = Enum.PartType.Cylinder
			p.Size = Vector3.new(0.12, 0.17, 0.17)
			local_cf = local_cf * CFrame.Angles(0, math.pi / 2, 0)
			p.Color = Color3.fromRGB(62, 64, 66)
			p.Material = M.Metal
		end
		p.CFrame = rootCf * local_cf
		p.Transparency = done and 0 or 1
		p:SetAttribute("Index", i)
		p:SetAttribute("Type", f.type)
		p.Parent = folder
	end
end

function Factory.setFastenerVisible(model, index, visible)
	local folder = model:FindFirstChild("Fasteners")
	local p = folder and folder:FindFirstChild("F" .. index)
	if p then
		p.Transparency = visible and 0 or 1
	end
end

-- Simplified box stand-in used by menu previews and blueprint ghosts.
function Factory.proxy(def, cf, color, transparency)
	local p = Instance.new("Part")
	p.Name = def.id
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.CastShadow = false
	p.Material = M.SmoothPlastic
	p.Color = color or def.proxyColor or C.Steel
	p.Transparency = transparency or 0
	local size = def.sizeM * S
	p.Size = size
	p.CFrame = cf * CFrame.new(def.boundsOffsetM * S)
	return p
end

return Factory
