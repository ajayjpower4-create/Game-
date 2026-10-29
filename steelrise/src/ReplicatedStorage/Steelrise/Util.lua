-- Small shared helpers.

local Util = {}

function Util.round(x, step)
	step = step or 1
	return math.floor(x / step + 0.5) * step
end

function Util.clamp(x, a, b)
	if x < a then
		return a
	elseif x > b then
		return b
	end
	return x
end

-- Move `current` toward `target` by at most `maxDelta`.
function Util.approach(current, target, maxDelta)
	if current < target then
		return math.min(current + maxDelta, target)
	end
	return math.max(current - maxDelta, target)
end

-- Rate-limited velocity change: accelerate with `accel`, slow down with `brake`.
function Util.rampVelocity(v, target, accel, brake, dt)
	local slowing = (math.abs(target) < math.abs(v)) or (target * v < 0)
	local rate = slowing and brake or accel
	return Util.approach(v, target, rate * dt)
end

function Util.yawOf(cf)
	local look = cf.LookVector
	return math.atan2(-look.X, -look.Z)
end

-- Smallest angle between two rotations (radians).
function Util.angleBetween(a, b)
	local rel = a.Rotation:Inverse() * b.Rotation
	local _, angle = rel:ToAxisAngle()
	return math.abs(angle)
end

function Util.fmtKg(kg)
	if kg >= 1000 then
		return string.format("%.1f t", kg / 1000)
	end
	return string.format("%d kg", math.floor(kg + 0.5))
end

function Util.fmtM(meters)
	return string.format("%.2f m", meters)
end

-- Serialise a CFrame to a plain array for DataStores.
function Util.cfToArray(cf)
	local c = { cf:GetComponents() }
	for i = 1, #c do
		c[i] = math.floor(c[i] * 10000 + 0.5) / 10000
	end
	return c
end

function Util.arrayToCf(a)
	if type(a) ~= "table" or #a ~= 12 then
		return nil
	end
	return CFrame.new(table.unpack(a))
end

function Util.shallowCopy(t)
	local n = {}
	for k, v in pairs(t) do
		n[k] = v
	end
	return n
end

function Util.deepCopy(t)
	if type(t) ~= "table" then
		return t
	end
	local n = {}
	for k, v in pairs(t) do
		n[k] = Util.deepCopy(v)
	end
	return n
end

-- Fill missing keys in `t` from `defaults` (recursively for tables).
function Util.withDefaults(t, defaults)
	local out = type(t) == "table" and Util.deepCopy(t) or {}
	for k, v in pairs(defaults) do
		if out[k] == nil then
			out[k] = Util.deepCopy(v)
		elseif type(v) == "table" and type(out[k]) == "table" then
			out[k] = Util.withDefaults(out[k], v)
		end
	end
	return out
end

-- Deterministic pseudo-random in [0,1) from integers, used for wear/variation
-- so the same component always looks the same on every client.
function Util.hash01(a, b, c)
	local n = ((a or 0) * 73856093 + (b or 0) * 19349663 + (c or 0) * 83492791) % 4294967296
	n = bit32.bxor(n, bit32.rshift(n, 13))
	n = (n * 1274126177) % 4294967296
	n = bit32.bxor(n, bit32.rshift(n, 16))
	return (n % 100000) / 100000
end

function Util.hashString(s)
	local h = 5381
	for i = 1, #s do
		h = (h * 33 + string.byte(s, i)) % 2147483647
	end
	return h
end

return Util
