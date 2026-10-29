-- Minimal Roblox engine mock for running STEELRISE server code in Lua 5.4.
warn = function(...) local t = {} for i = 1, select("#", ...) do t[#t+1] = tostring((select(i, ...))) end print("WARN: " .. table.concat(t, " ")) end
local M = {}

-- bit32 ------------------------------------------------------------------
bit32 = {
	bxor = function(a, b) return (math.floor(a) ~ math.floor(b)) & 0xFFFFFFFF end,
	band = function(a, b) return (math.floor(a) & math.floor(b)) & 0xFFFFFFFF end,
	rshift = function(a, n) return (math.floor(a) & 0xFFFFFFFF) >> n end,
	lshift = function(a, n) return (math.floor(a) << n) & 0xFFFFFFFF end,
}
math.clamp = function(x, a, b) if a > b then error("math.clamp: max < min", 2) end return math.max(a, math.min(b, x)) end
math.atan2 = function(y, x) return math.atan(y, x) end
math.noise = function(x, y, z) return math.sin((x or 0) * 1.7 + (y or 0) * 2.3 + (z or 0)) * 0.5 end
math.sign = function(x) return x > 0 and 1 or (x < 0 and -1 or 0) end
table.find = function(t, v) for i, x in ipairs(t) do if x == v then return i end end return nil end
table.clone = function(t) local n = {} for k, v in pairs(t) do n[k] = v end return n end
unpack = table.unpack
local realFormat = string.format
string.format = function(fmt, ...)
	local args = table.pack(...)
	-- emulate Luau: %d accepts any number that is integral
	local i = 0
	for spec in fmt:gmatch("%%[%-%+ #0]*%d*%.?%d*([%a%%])") do
		if spec ~= "%" then
			i = i + 1
			if spec == "d" and type(args[i]) == "number" then
				if args[i] ~= math.floor(args[i]) then error("string.format %d with non-integer " .. tostring(args[i]), 2) end
				args[i] = math.tointeger(args[i]) or args[i]
			end
		end
	end
	return realFormat(fmt, table.unpack(args, 1, args.n))
end

-- Vector3 ----------------------------------------------------------------
local V3 = {}
V3.__index = function(v, k)
	if k == "X" then return rawget(v, 1) elseif k == "Y" then return rawget(v, 2) elseif k == "Z" then return rawget(v, 3)
	elseif k == "Magnitude" then return math.sqrt(v[1]^2 + v[2]^2 + v[3]^2)
	elseif k == "Unit" then local m = math.sqrt(v[1]^2 + v[2]^2 + v[3]^2); if m == 0 then return Vector3.new(0/0,0/0,0/0) end return Vector3.new(v[1]/m, v[2]/m, v[3]/m)
	end
	return V3[k]
end
function V3.__add(a, b) return Vector3.new(a[1]+b[1], a[2]+b[2], a[3]+b[3]) end
function V3.__sub(a, b) return Vector3.new(a[1]-b[1], a[2]-b[2], a[3]-b[3]) end
function V3.__mul(a, b)
	if type(a) == "number" then return Vector3.new(a*b[1], a*b[2], a*b[3]) end
	if type(b) == "number" then return Vector3.new(a[1]*b, a[2]*b, a[3]*b) end
	return Vector3.new(a[1]*b[1], a[2]*b[2], a[3]*b[3])
end
function V3.__div(a, b)
	if type(b) == "number" then return Vector3.new(a[1]/b, a[2]/b, a[3]/b) end
	return Vector3.new(a[1]/b[1], a[2]/b[2], a[3]/b[3])
end
function V3.__unm(a) return Vector3.new(-a[1], -a[2], -a[3]) end
function V3.__eq(a, b) return a[1]==b[1] and a[2]==b[2] and a[3]==b[3] end
function V3.__tostring(a) return string.format("%g, %g, %g", a[1], a[2], a[3]) end
function V3.Dot(a, b) return a[1]*b[1] + a[2]*b[2] + a[3]*b[3] end
function V3.Cross(a, b) return Vector3.new(a[2]*b[3]-a[3]*b[2], a[3]*b[1]-a[1]*b[3], a[1]*b[2]-a[2]*b[1]) end
function V3.Lerp(a, b, t) return a + (b - a) * t end
Vector3 = {}
function Vector3.new(x, y, z)
	x, y, z = x or 0, y or 0, z or 0
	assert(type(x) == "number" and type(y) == "number" and type(z) == "number", "Vector3.new expects numbers")
	return setmetatable({ x, y, z, __type = "Vector3" }, V3)
end
Vector3.zero = Vector3.new(0,0,0); Vector3.one = Vector3.new(1,1,1)
Vector3.xAxis = Vector3.new(1,0,0); Vector3.yAxis = Vector3.new(0,1,0); Vector3.zAxis = Vector3.new(0,0,1)

local V2 = {}
V2.__index = function(v, k) if k == "Magnitude" then return math.sqrt(v.X^2 + v.Y^2) end return V2[k] end
Vector2 = {}
function Vector2.new(x, y) return setmetatable({ X = x or 0, Y = y or 0, __type = "Vector2" }, V2) end
V2.__add = function(a, b) return Vector2.new(a.X + b.X, a.Y + b.Y) end
V2.__sub = function(a, b) return Vector2.new(a.X - b.X, a.Y - b.Y) end
V2.__mul = function(a, b) if type(a) == "number" then return Vector2.new(a * b.X, a * b.Y) end if type(b) == "number" then return Vector2.new(a.X * b, a.Y * b) end return Vector2.new(a.X * b.X, a.Y * b.Y) end
V2.__div = function(a, b) return Vector2.new(a.X / b, a.Y / b) end
Vector2.zero = Vector2.new(0, 0)

-- CFrame -----------------------------------------------------------------
-- p = {x,y,z}, r = row-major 3x3 {r00..r22}
local CF = {}
local function mk(x, y, z, r)
	return setmetatable({ p = { x, y, z }, r = r, __type = "CFrame" }, CF)
end
local I = { 1,0,0, 0,1,0, 0,0,1 }
local function mmul(a, b)
	local c = {}
	for i = 0, 2 do for j = 0, 2 do
		c[i*3+j+1] = a[i*3+1]*b[j+1] + a[i*3+2]*b[3+j+1] + a[i*3+3]*b[6+j+1]
	end end
	return c
end
local function mv(r, x, y, z)
	return r[1]*x + r[2]*y + r[3]*z, r[4]*x + r[5]*y + r[6]*z, r[7]*x + r[8]*y + r[9]*z
end
local function tr(r) return { r[1], r[4], r[7], r[2], r[5], r[8], r[3], r[6], r[9] } end
CF.__index = function(c, k)
	if k == "Position" then return Vector3.new(c.p[1], c.p[2], c.p[3])
	elseif k == "X" then return c.p[1] elseif k == "Y" then return c.p[2] elseif k == "Z" then return c.p[3]
	elseif k == "Rotation" then return mk(0, 0, 0, c.r)
	elseif k == "RightVector" or k == "XVector" then return Vector3.new(c.r[1], c.r[4], c.r[7])
	elseif k == "UpVector" or k == "YVector" then return Vector3.new(c.r[2], c.r[5], c.r[8])
	elseif k == "ZVector" then return Vector3.new(c.r[3], c.r[6], c.r[9])
	elseif k == "LookVector" then return Vector3.new(-c.r[3], -c.r[6], -c.r[9])
	end
	return CF[k]
end
CF.__mul = function(a, b)
	if getmetatable(b) == CF then
		local x, y, z = mv(a.r, b.p[1], b.p[2], b.p[3])
		return mk(a.p[1]+x, a.p[2]+y, a.p[3]+z, mmul(a.r, b.r))
	elseif getmetatable(b) == V3 then
		local x, y, z = mv(a.r, b[1], b[2], b[3])
		return Vector3.new(a.p[1]+x, a.p[2]+y, a.p[3]+z)
	end
	error("bad CFrame multiply with " .. tostring(b), 2)
end
CF.__add = function(a, v) assert(getmetatable(v) == V3, "CFrame + needs Vector3"); return mk(a.p[1]+v[1], a.p[2]+v[2], a.p[3]+v[3], a.r) end
CF.__sub = function(a, v) return mk(a.p[1]-v[1], a.p[2]-v[2], a.p[3]-v[3], a.r) end
CF.__tostring = function(c) return "CFrame(" .. c.p[1] .. "," .. c.p[2] .. "," .. c.p[3] .. ")" end
function CF.Inverse(c)
	local t = tr(c.r)
	local x, y, z = mv(t, -c.p[1], -c.p[2], -c.p[3])
	return mk(x, y, z, t)
end
function CF.PointToObjectSpace(c, v) return (c:Inverse()) * v end
function CF.PointToWorldSpace(c, v) return c * v end
function CF.VectorToWorldSpace(c, v) local x, y, z = mv(c.r, v[1], v[2], v[3]); return Vector3.new(x, y, z) end
function CF.VectorToObjectSpace(c, v) local x, y, z = mv(tr(c.r), v[1], v[2], v[3]); return Vector3.new(x, y, z) end
function CF.ToObjectSpace(a, b) return a:Inverse() * b end
function CF.GetComponents(c) local r = c.r; return c.p[1], c.p[2], c.p[3], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[8], r[9] end
function CF.Lerp(a, b, t)
	-- good enough for tests: lerp position, keep rotation of nearer end
	local p = a.Position:Lerp(b.Position, t)
	return mk(p[1], p[2], p[3], t < 0.5 and a.r or b.r)
end
function CF.ToAxisAngle(c)
	local r = c.r
	local cosA = math.max(-1, math.min(1, (r[1] + r[5] + r[9] - 1) / 2))
	return Vector3.new(0, 1, 0), math.acos(cosA)
end
CFrame = {}
local function rx(a) local c, s = math.cos(a), math.sin(a); return { 1,0,0, 0,c,-s, 0,s,c } end
local function ry(a) local c, s = math.cos(a), math.sin(a); return { c,0,s, 0,1,0, -s,0,c } end
local function rz(a) local c, s = math.cos(a), math.sin(a); return { c,-s,0, s,c,0, 0,0,1 } end
function CFrame.Angles(x, y, z) return mk(0, 0, 0, mmul(mmul(rx(x), ry(y)), rz(z))) end
CFrame.fromEulerAnglesXYZ = CFrame.Angles
function CFrame.fromMatrix(pos, vx, vy, vz)
	vz = vz or vx:Cross(vy)
	return mk(pos[1], pos[2], pos[3], { vx[1], vy[1], vz[1], vx[2], vy[2], vz[2], vx[3], vy[3], vz[3] })
end
function CFrame.lookAt(at, target, up)
	up = up or Vector3.yAxis
	local look = (target - at).Unit
	local right = look:Cross(up)
	if right.Magnitude < 1e-6 then right = Vector3.xAxis else right = right.Unit end
	local upv = right:Cross(look)
	return CFrame.fromMatrix(at, right, upv, -look)
end
function CFrame.new(a, b, c, ...)
	if a == nil then return mk(0, 0, 0, I) end
	if getmetatable(a) == V3 then
		if b then return CFrame.lookAt(a, b) end
		return mk(a[1], a[2], a[3], I)
	end
	local rest = { ... }
	assert(type(a) == "number" and type(b) == "number" and type(c) == "number", "CFrame.new expects numbers")
	if #rest == 9 then return mk(a, b, c, rest) end
	return mk(a, b, c, I)
end
CFrame.identity = CFrame.new()

-- misc value types --------------------------------------------------------
Color3 = {
	new = function(r, g, b) return { R = r or 0, G = g or 0, B = b or 0, __type = "Color3", ToHSV = function(self) return 0, 0, (self.R + self.G + self.B) / 3 end } end,
}
Color3.fromRGB = function(r, g, b) return Color3.new(r / 255, g / 255, b / 255) end
Color3.fromHSV = function(h, s, v) return Color3.new(v, v, v) end
UDim = { new = function(a, b) return { Scale = a, Offset = b, __type = "UDim" } end }
UDim2 = { new = function(a, b, c, d) return { __type = "UDim2", a, b, c, d } end, fromScale = function(a, b) return { __type = "UDim2" } end, fromOffset = function() return { __type = "UDim2" } end }
NumberSequence = { new = function() return { __type = "NumberSequence" } end }
NumberSequenceKeypoint = { new = function() return {} end }
ColorSequence = { new = function() return { __type = "ColorSequence" } end }
ColorSequenceKeypoint = { new = function() return {} end }
NumberRange = { new = function(a, b) return { Min = a, Max = b or a } end }
TweenInfo = { new = function() return {} end }
Random = { new = function(seed)
	local state = (seed or 1) % 2147483647
	if state <= 0 then state = 1 end
	local r = {}
	local function nxt() state = (state * 16807) % 2147483647; return state / 2147483647 end
	function r:NextNumber(a, b) a = a or 0; b = b or 1; return a + (b - a) * nxt() end
	function r:NextInteger(a, b) return math.floor(a + (b - a + 1) * nxt()) end
	return r
end }
RaycastParams = { new = function() return { FilterDescendantsInstances = {}, __type = "RaycastParams" } end }
OverlapParams = { new = function() return { FilterDescendantsInstances = {}, __type = "OverlapParams" } end }

-- Enum --------------------------------------------------------------------
local enumItemMt = { __tostring = function(e) return "Enum." .. e.EnumType .. "." .. e.Name end }
Enum = setmetatable({}, { __index = function(t, enumName)
	local e = setmetatable({}, { __index = function(et, item)
		local v = setmetatable({ Name = item, EnumType = enumName, Value = 0, __type = "EnumItem" }, enumItemMt)
		rawset(et, item, v)
		return v
	end })
	rawset(t, enumName, e)
	return e
end })

typeof = function(v)
	if type(v) == "table" then
		if getmetatable(v) == M.InstanceMt then return "Instance" end
		if rawget(v, "__type") then return rawget(v, "__type") end
	end
	return type(v)
end

-- Signals --------------------------------------------------------------------
local function signal()
	local s = { handlers = {} }
	function s:Connect(fn) table.insert(self.handlers, fn); return { Disconnect = function() end, Connected = true } end
	function s:Once(fn) return self:Connect(fn) end
	function s:Fire(...) for _, h in ipairs(self.handlers) do h(...) end end
	function s:Wait() return nil end
	return s
end
M.signal = signal

-- Instances ---------------------------------------------------------------------
local Inst = {}
local InstanceMt = {}
M.InstanceMt = InstanceMt
local BASEPART = { Part = true, WedgePart = true, TrussPart = true, MeshPart = true, SpawnLocation = true }
local LIGHT = { SpotLight = true, PointLight = true, SurfaceLight = true }

local DEFAULTS = {
	Anchored = false, CanCollide = true, CanQuery = true, CanTouch = true, CastShadow = true, Transparency = 0,
	Massless = false, Reflectance = 0,
}

PROP_TYPES = {
	Size = { "Vector3", "UDim2" }, Position = { "Vector3", "UDim2" }, CFrame = "CFrame", Color = "Color3",
	Material = "EnumItem", Shape = "EnumItem", Transparency = "number?", Anchored = "boolean", CanCollide = "boolean",
	CanQuery = "boolean", CanTouch = "boolean", CastShadow = "boolean", Massless = "boolean", Reflectance = "number?",
	Name = "string", Text = "string", TextSize = "number?", Font = "EnumItem", BackgroundColor3 = "Color3",
	TextColor3 = "Color3", Brightness = "number?", Range = "number?", Enabled = "boolean", Face = "EnumItem",
	TextXAlignment = "EnumItem", TextYAlignment = "EnumItem", AnchorPoint = "Vector2", CornerRadius = "UDim",
	PaddingLeft = "UDim", PaddingRight = "UDim", PaddingTop = "UDim", PaddingBottom = "UDim", Padding = "UDim",
	Visible = "boolean", ZIndex = "number?", LayoutOrder = "number?", BackgroundTransparency = "number?",
	TextTransparency = "number?", Thickness = "number?", Rotation = "number?", Style = "EnumItem",
	ClockTime = "number?", Density = "number?", Haze = "number?", Glare = "number?", Offset = "number?",
	Intensity = "number?", Threshold = "number?", Spread = "number?", Contrast = "number?", Saturation = "number?",
	TintColor = "Color3", FocusDistance = "number?", InFocusRadius = "number?", FarIntensity = "number?",
	NearIntensity = "number?", Cover = "number?", PrimaryPart = "Instance?", Adornee = "Instance?",
	SoundId = "string", Volume = "number?", Looped = "boolean", PlaybackSpeed = "number?", WalkSpeed = "number?",
	ModelStreamingMode = "EnumItem", PixelsPerStud = "number?", LightInfluence = "number?", SizingMode = "EnumItem",
	TextScaled = "boolean", TextWrapped = "boolean", AutomaticSize = "EnumItem", ScrollBarThickness = "number?",
	CanvasSize = "UDim2", CellSize = "UDim2", CellPadding = "UDim2", FillDirection = "EnumItem", SortOrder = "EnumItem",
	HorizontalAlignment = "EnumItem", VerticalAlignment = "EnumItem", ImageColor3 = "Color3", Ambient = "Color3",
	LightColor = "Color3", LightDirection = "Vector3", Transparency2 = "number?",
}
GUI_DEFAULTS = {
	AbsolutePosition = function() return Vector2.new(0, 0) end,
	AbsoluteSize = function() return Vector2.new(100, 100) end,
	AbsoluteWindowSize = function() return Vector2.new(100, 100) end,
	CanvasPosition = function() return Vector2.new(0, 0) end,
	Visible = true, Enabled = true, Text = "", TextTransparency = 0, BackgroundTransparency = 0,
	LayoutOrder = 0, ZIndex = 1, Rotation = 0, Active = false, Volume = 0.5, PlaybackSpeed = 1, Looped = false,
	CurrentCamera = nil, Thickness = 1, TimePosition = 0, IsPlaying = false,
}
InstanceMt.__index = function(self, k)
	local props = rawget(self, "_p")
	if props[k] ~= nil then return props[k] end
	if Inst[k] then return Inst[k] end
	if k == "Position" and props.CFrame then return props.CFrame.Position end
	if k == "Parent" or k == "Character" or k == "PrimaryPart" or k == "ReplicationFocus" or k == "Adornee" or k == "CurrentCamera" or k == "CameraSubject" or k == "LocalPlayer" then return nil end
	-- children by name
	for _, c in ipairs(rawget(self, "_c")) do
		if rawget(c, "_p").Name == k then return c end
	end
	local cls = props.ClassName
	if BASEPART[cls] then
		if k == "CFrame" then return CFrame.new() end
		if k == "Size" then return Vector3.new(4, 1, 2) end
		if DEFAULTS[k] ~= nil then return DEFAULTS[k] end
		if k == "AssemblyLinearVelocity" then return Vector3.zero end
	end
	if GUI_DEFAULTS[k] ~= nil and not BASEPART[cls] then
		local v = GUI_DEFAULTS[k]
		if type(v) == "function" then return v() end
		return v
	end
	local special = rawget(self, "_special")
	if special and special[k] ~= nil then return special[k] end
	if k:match("^Input") or k:match("Click$") or k:match("Began$") or k:match("Ended$") or k:match("Changed$") or k:match("Added$") or k:match("Removing$") or k:match("Removed$") or k == "Died" or k == "Ended" or k == "Event" or k:match("^On") or k:match("^Mouse") or k == "Completed" or k == "AncestryChanged" or k == "Heartbeat" or k == "RenderStepped" or k == "Stepped" then
		local s = signal()
		props[k] = s
		return s
	end
	if DEFAULTS[k] ~= nil then return DEFAULTS[k] end
	error(("%s.%s is not a valid member (mock)"):format(tostring(props.Name), k), 2)
end
InstanceMt.__newindex = function(self, k, v)
	local props = rawget(self, "_p")
	if k == "Parent" then
		local old = props.Parent
		if old == v then return end
		if old then
			local list = rawget(old, "_c")
			for i, c in ipairs(list) do if c == self then table.remove(list, i) break end end
		end
		props.Parent = v
		if v then
			table.insert(rawget(v, "_c"), self)
			local ca = rawget(v, "_p").ChildAdded
			if ca then ca:Fire(self) end
		end
		return
	end
	if k == "Position" and BASEPART[props.ClassName] then
		local cf = props.CFrame or CFrame.new()
		props.CFrame = cf - cf.Position + v
		return
	end
	if k == "Size" and props.ClassName == "TrussPart" then
		-- trusses snap to 2-stud multiples
		v = Vector3.new(2, math.max(2, math.floor(v.Y / 2 + 0.5) * 2), 2)
	end
	if v ~= nil and type(v) == "number" and v ~= v then error("NaN assigned to " .. k, 2) end
	local want = PROP_TYPES[k]
	local SEQ = { UIGradient = true, ParticleEmitter = true, Beam = true, Trail = true }
	if SEQ[props.ClassName] then want = nil end
	if want then
		local cls = props.ClassName
		if type(want) == "table" and not BASEPART[cls] and not ({ Frame = true, TextLabel = true, TextButton = true, TextBox = true, ScrollingFrame = true, ViewportFrame = true, ImageLabel = true, ImageButton = true, CanvasGroup = true })[cls] then want = nil end
	end
	if want then
		local cls = props.ClassName
		local GUI = { Frame = true, TextLabel = true, TextButton = true, TextBox = true, ScrollingFrame = true, ViewportFrame = true, ImageLabel = true, ImageButton = true, CanvasGroup = true }
		if type(want) == "table" then
			if BASEPART[cls] then want = want[1] elseif GUI[cls] then want = want[2] else want = nil end
		end
		local got = typeof(v)
		if want == "number?" then if got ~= "number" then error(("bad type for %s.%s: %s"):format(cls, k, got), 2) end
		elseif got ~= want and not (want == "Instance?" and (got == "Instance" or v == nil)) then
			error(("bad type for %s.%s: expected %s, got %s"):format(cls, k, want, got), 2)
		end
	end
	if k == "Size" and BASEPART[props.ClassName] and (v.X < 0 or v.Y < 0 or v.Z < 0) then error("negative part size", 2) end
	props[k] = v
end
InstanceMt.__tostring = function(self) return rawget(self, "_p").Name end
InstanceMt.__eq = rawequal

function Instance_new(className, parent)
	local self = setmetatable({ _p = { ClassName = className, Name = className, _attr = {} }, _c = {} }, InstanceMt)
	if parent then self.Parent = parent end
	return self
end
Instance = { new = Instance_new }

function Inst.IsA(self, cls)
	local c = rawget(self, "_p").ClassName
	if c == cls or cls == "Instance" then return true end
	if cls == "BasePart" or cls == "PVInstance" then return BASEPART[c] or (cls == "PVInstance" and c == "Model") or false end
	if cls == "Light" then return LIGHT[c] or false end
	if cls == "GuiObject" then return false end
	return false
end
function Inst.GetChildren(self) local t = {} for i, c in ipairs(rawget(self, "_c")) do t[i] = c end return t end
function Inst.GetDescendants(self)
	local out = {}
	local function rec(n) for _, c in ipairs(rawget(n, "_c")) do table.insert(out, c); rec(c) end end
	rec(self)
	return out
end
function Inst.FindFirstChild(self, name, recursive)
	for _, c in ipairs(rawget(self, "_c")) do if rawget(c, "_p").Name == name then return c end end
	if recursive then for _, c in ipairs(rawget(self, "_c")) do local f = c:FindFirstChild(name, true) if f then return f end end end
	return nil
end
function Inst.WaitForChild(self, name) return self:FindFirstChild(name) end
function Inst.FindFirstChildOfClass(self, cls) for _, c in ipairs(rawget(self, "_c")) do if rawget(c, "_p").ClassName == cls then return c end end return nil end
function Inst.FindFirstChildWhichIsA(self, cls) for _, c in ipairs(rawget(self, "_c")) do if c:IsA(cls) then return c end end return nil end
function Inst.FindFirstAncestorWhichIsA(self, cls) local p = self.Parent while p do if p:IsA(cls) then return p end p = p.Parent end return nil end
function Inst.FindFirstAncestor(self, name) local p = self.Parent while p do if p.Name == name then return p end p = p.Parent end return nil end
function Inst.IsDescendantOf(self, other) local p = self.Parent while p do if p == other then return true end p = p.Parent end return false end
function Inst.Destroy(self)
	for _, c in ipairs(self:GetChildren()) do c:Destroy() end
	self.Parent = nil
	rawget(self, "_p").Destroyed = true
end
function Inst.ClearAllChildren(self) for _, c in ipairs(self:GetChildren()) do c:Destroy() end end
function Inst.Clone(self)
	local n = Instance_new(self.ClassName)
	for k, v in pairs(rawget(self, "_p")) do if k ~= "Parent" and k ~= "_attr" then rawget(n, "_p")[k] = v end end
	for k, v in pairs(rawget(self, "_p")._attr) do rawget(n, "_p")._attr[k] = v end
	for _, c in ipairs(rawget(self, "_c")) do c:Clone().Parent = n end
	return n
end
local ATTR_OK = { string = true, number = true, boolean = true, Vector3 = true, CFrame = true, Color3 = true, ["nil"] = true, Vector2 = true, UDim2 = true }
function Inst.SetAttribute(self, k, v)
	if not ATTR_OK[typeof(v)] then error("SetAttribute: unsupported type " .. typeof(v) .. " for " .. k, 2) end
	if type(v) == "number" and v ~= v then error("SetAttribute NaN " .. k, 2) end
	rawget(self, "_p")._attr[k] = v
end
function Inst.GetAttribute(self, k) return rawget(self, "_p")._attr[k] end
function Inst.GetAttributes(self) return rawget(self, "_p")._attr end
function Inst.GetAttributeChangedSignal(self) return signal() end
function Inst.GetPropertyChangedSignal(self) return signal() end
function Inst.GetPivot(self)
	local p = rawget(self, "_p")
	if BASEPART[p.ClassName] then return self.CFrame end
	if p.ClassName == "Model" then
		if p.PrimaryPart then return p.PrimaryPart.CFrame end
		return p.WorldPivot or CFrame.new()
	end
	error("GetPivot on " .. p.ClassName, 2)
end
function Inst.PivotTo(self, cf)
	assert(typeof(cf) == "CFrame", "PivotTo expects CFrame")
	local cur = self:GetPivot()
	local delta = cf * cur:Inverse()
	local p = rawget(self, "_p")
	if BASEPART[p.ClassName] then self.CFrame = cf return end
	for _, d in ipairs(self:GetDescendants()) do
		if d:IsA("BasePart") then d.CFrame = delta * d.CFrame end
	end
	if not p.PrimaryPart then p.WorldPivot = cf end
end
function Inst.GetBoundingBox(self) return self:GetPivot(), Vector3.new(10, 10, 10) end
function Inst.SetNetworkOwner() end
function Inst.LoadCharacter(self)
	local char = Instance_new("Model")
	char.Name = self.Name
	local hrp = Instance_new("Part", char); hrp.Name = "HumanoidRootPart"; hrp.CFrame = CFrame.new(0, 5, 0); hrp.Size = Vector3.new(2, 2, 1)
	local hand = Instance_new("Part", char); hand.Name = "RightHand"; hand.CFrame = CFrame.new(1, 4, 0); hand.Size = Vector3.new(0.5, 0.5, 0.5)
	local hum = Instance_new("Humanoid", char)
	char.PrimaryPart = hrp
	self.Character = char
	char.Parent = M.workspace
end
function Inst.GetPlayers(self) return M.players end
function Inst.GetPlayerByUserId(self, id) for _, p in ipairs(M.players) do if p.UserId == id then return p end end return nil end
function Inst.GetService(self, name)
	return M.services[name] or error("no service " .. name)
end
function Inst.SetStateEnabled() end
function Inst.ReleaseFocus() end
function Inst.CaptureFocus() end
function Inst.Play() end
function Inst.Fire(self, ...) self.Event:Fire(...) end
function Inst.Stop() end
function Inst.Emit() end
function Inst.FireAllClients(self, ...) M.log("FireAllClients", self.Name, ...) end
function Inst.FireClient(self, player, ...) M.log("FireClient", self.Name, ...) end
function Inst.FireServer() end
function Inst.InvokeServer() end
function Inst.RequestStreamAroundAsync() end

-- Terrain
function Inst.FillBlock(self, cf, size, mat)
	assert(typeof(cf) == "CFrame" and typeof(size) == "Vector3", "FillBlock args")
end
function Inst.Clear() end

M.Inst = Inst
M.log = function() end
M.Instance_new = Instance_new
return M
