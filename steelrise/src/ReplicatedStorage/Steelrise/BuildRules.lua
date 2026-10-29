-- Shared construction rules: socket index, snapping solver and placement
-- validation. The client uses solve() to drive the placement preview; the
-- server re-runs validate() on every placement/landing before accepting it,
-- so both sides explain failures with the same words.

local Config = require(script.Parent.Config)
local Registry = require(script.Parent.ItemRegistry)
local Util = require(script.Parent.Util)

local S = Config.S
local TOL = Config.Geo.SnapTolerance
local CELL = 6
local UP = Vector3.yAxis

local BuildRules = {}

BuildRules.SocketNames = {
	FootingTop = "a footing top",
	ColumnTop = "the top of a column",
	BeamSeat = "a beam seat on a column face",
	GussetMount = "a gusset mount on a column face",
	BraceSeat = "a gusset plate seat",
	CladSeat = "the outside face line of two columns",
	ScafNode = "a scaffold base jack",
	ScafStdTop = "the top of a scaffold upright",
	ScafRosette = "a rosette on a scaffold upright",
}

BuildRules.SupportStates = { Placed = true, Installed = true }
BuildRules.SolidStates = { Placed = true, Installed = true, Loose = true, Restrained = true }

local function friendlyAccepts(acceptSet)
	local names = {}
	for t in pairs(acceptSet or {}) do
		table.insert(names, BuildRules.SocketNames[t] or t)
	end
	table.sort(names)
	return table.concat(names, " or ")
end

---------------------------------------------------------------------------
-- World access (works on server and client)
---------------------------------------------------------------------------

local World = {}
World.__index = World

function BuildRules.newWorld(siteFolder)
	local self = setmetatable({}, World)
	self.site = siteFolder
	self.components = siteFolder:WaitForChild("Components", 10)
	self.environment = siteFolder:WaitForChild("Environment", 10)
	self.dirty = true
	self._index = nil
	self.overlap = OverlapParams.new()
	self.overlap.FilterType = Enum.RaycastFilterType.Include
	self.overlap.FilterDescendantsInstances = { self.components, self.environment }
	self.overlap.RespectCanCollide = true
	self.ray = RaycastParams.new()
	self.ray.FilterType = Enum.RaycastFilterType.Include
	self.ray.FilterDescendantsInstances = { self.components, self.environment, workspace.Terrain }
	self.ray.IgnoreWater = false
	return self
end

function World:markDirty()
	self.dirty = true
end

function World:bounds()
	local mn = self.site:GetAttribute("BoundsMin")
	local mx = self.site:GetAttribute("BoundsMax")
	return mn, mx
end

-- Component record from a model (or any descendant part).
function World:record(inst)
	local model = inst
	while model and model.Parent ~= self.components do
		model = model.Parent
	end
	if not model or not model:IsA("Model") then
		return nil
	end
	local def = Registry.get(model:GetAttribute("ItemId") or "")
	if not def or not model.PrimaryPart then
		return nil
	end
	return {
		id = model:GetAttribute("ComponentId"),
		def = def,
		cf = model:GetPivot(),
		state = model:GetAttribute("State"),
		model = model,
	}
end

function World:records()
	local out = {}
	for _, model in ipairs(self.components:GetChildren()) do
		local r = self:record(model)
		if r and r.id then
			table.insert(out, r)
		end
	end
	return out
end

local function cellKey(x, y, z)
	return math.floor(x / CELL) .. "," .. math.floor(y / CELL) .. "," .. math.floor(z / CELL)
end

function World:index()
	if not self.dirty and self._index then
		return self._index
	end
	local idx = { cells = {}, list = {} }
	local recs = self:records()
	for _, r in ipairs(recs) do
		if BuildRules.SupportStates[r.state] then
			for _, s in ipairs(r.def.sockets) do
				local wcf = r.cf * s.cfS
				local p = wcf.Position
				local sock = {
					type = s.type,
					cf = wcf,
					pos = p,
					owner = r.id,
					ownerName = r.def.name,
					multi = s.multi,
					provisional = r.state ~= "Installed",
				}
				local k = cellKey(p.X, p.Y, p.Z)
				idx.cells[k] = idx.cells[k] or {}
				table.insert(idx.cells[k], sock)
				table.insert(idx.list, sock)
			end
		end
	end
	self._index = idx
	self.dirty = false
	-- occupancy from plugs of placed/installed components
	for _, r in ipairs(recs) do
		if BuildRules.SupportStates[r.state] then
			for _, plug in ipairs(r.def.plugs) do
				local wp = (r.cf * plug.cfS).Position
				for _, s in ipairs(self:query(wp, TOL * 2)) do
					if not s.multi and plug.acceptSet[s.type] and s.owner ~= r.id then
						s.occupiedBy = r.id
					end
				end
			end
		end
	end
	return idx
end

function World:query(pos, radius)
	local idx = self._index or self:index()
	local out = {}
	local r = math.ceil(radius / CELL)
	local cx, cy, cz = math.floor(pos.X / CELL), math.floor(pos.Y / CELL), math.floor(pos.Z / CELL)
	for x = cx - r, cx + r do
		for y = cy - r, cy + r do
			for z = cz - r, cz + r do
				local list = idx.cells[x .. "," .. y .. "," .. z]
				if list then
					for _, s in ipairs(list) do
						if (s.pos - pos).Magnitude <= radius then
							table.insert(out, s)
						end
					end
				end
			end
		end
	end
	return out
end

function World:raycast(origin, dir, exclude)
	local params = self.ray
	if exclude and #exclude > 0 then
		params = RaycastParams.new()
		params.FilterType = Enum.RaycastFilterType.Include
		params.FilterDescendantsInstances = { self.components, self.environment, workspace.Terrain }
		params.IgnoreWater = false
		-- Include lists cannot subtract; filter results instead.
		local result = workspace:Raycast(origin, dir, params)
		local guard = 0
		while result and guard < 8 do
			local skip = false
			for _, m in ipairs(exclude) do
				if result.Instance:IsDescendantOf(m) then
					skip = true
					break
				end
			end
			if not skip then
				return result
			end
			guard += 1
			local travelled = (result.Position - origin).Magnitude + 0.01
			local remaining = dir.Magnitude - travelled
			if remaining <= 0 then
				return nil
			end
			origin = result.Position + dir.Unit * 0.01
			dir = dir.Unit * remaining
			result = workspace:Raycast(origin, dir, params)
		end
		return result
	end
	return workspace:Raycast(origin, dir, params)
end

---------------------------------------------------------------------------
-- Orientation helpers
---------------------------------------------------------------------------

local function frameFrom(dir)
	local f1 = dir.Unit
	local f3 = f1:Cross(UP)
	if f3.Magnitude < 1e-4 then
		f3 = Vector3.zAxis
	end
	f3 = f3.Unit
	local f2 = f3:Cross(f1)
	return CFrame.fromMatrix(Vector3.zero, f1, f2, f3)
end

-- CFrame placing local plug points pA,pB onto world points a,b.
local function spanCf(pA, pB, a, b)
	local R = frameFrom(b - a) * frameFrom(pB - pA):Inverse()
	return CFrame.new(a) * R * CFrame.new(-pA)
end

BuildRules.spanCf = spanCf

-- Candidate CFrame for a Point item rotated `angle` about its socket.
local function s_cf(sock, angle, plug)
	return sock.cf * CFrame.Angles(0, angle, 0) * plug.cfS:Inverse()
end

function BuildRules.angleDiff(def, cfA, cfB)
	local d = Util.angleBetween(cfA, cfB)
	if def.symmetric180 then
		local flipped = cfB * CFrame.Angles(0, math.pi, 0)
		d = math.min(d, Util.angleBetween(cfA, flipped))
	end
	return d
end

---------------------------------------------------------------------------
-- Validation
---------------------------------------------------------------------------

-- Returns ok, reason, info { mates = {ids}, supports = {ids} }
-- opts: { exclude = {ids}, excludeModels = {models}, actorPos = Vector3, reach = studs, ignoreOverlap = bool }
function BuildRules.validate(world, def, cf, opts)
	opts = opts or {}
	local info = { mates = {}, supports = {} }
	local excl = {}
	for _, id in ipairs(opts.exclude or {}) do
		excl[id] = true
	end

	if def.kind == "Tool" then
		return false, "Tools are equipped from the hotbar, not placed.", info
	end

	-- Reach
	if opts.actorPos and opts.reach then
		local dist = (cf.Position - opts.actorPos).Magnitude
		if dist > opts.reach then
			return false, string.format("Out of reach (%.1f m) — move closer.", Config.toMeters(dist)), info
		end
	end

	-- Site boundary
	local mn, mx = world:bounds()
	if mn and mx then
		local p = cf.Position
		if p.X < mn.X or p.Z < mn.Z or p.X > mx.X or p.Z > mx.Z then
			return false, "Outside the site boundary.", info
		end
	end

	world:index()

	local function matchSocket(plug, wcf)
		local wp = wcf.Position
		local near = world:query(wp, 2.5)
		local best, bestD, wrong = nil, math.huge, nil
		for _, s in ipairs(near) do
			local d = (s.pos - wp).Magnitude
			if plug.acceptSet[s.type] then
				if d <= TOL and d < bestD then
					best, bestD = s, d
				end
			elseif d <= 1.0 and not excl[s.owner] then
				wrong = s
			end
		end
		if not best then
			if wrong then
				return nil, string.format("Wrong connection type: this needs %s, not %s.", friendlyAccepts(plug.acceptSet), BuildRules.SocketNames[wrong.type] or wrong.type)
			end
			return nil, string.format("Missing support: needs %s here.", friendlyAccepts(plug.acceptSet))
		end
		if best.occupiedBy and not excl[best.occupiedBy] then
			return nil, "That connection is already used by another component."
		end
		if best.provisional then
			return nil, string.format("Supporting %s isn't fastened yet — finish its connections first.", best.ownerName)
		end
		return best
	end

	if def.kind == "Point" then
		local plug = def.plugs[1]
		local wcf = cf * plug.cfS
		local s, why = matchSocket(plug, wcf)
		if not s then
			return false, why, info
		end
		if wcf.UpVector:Dot(s.cf.UpVector) < 0.995 then
			return false, "Not plumb with its connection — rotate it upright.", info
		end
		if def.rotStep >= 360 and wcf.LookVector:Dot(s.cf.LookVector) < 0.99 then
			return false, "Not aligned with its connection face.", info
		end
		table.insert(info.mates, s.owner)
	elseif def.kind == "Span" then
		local used = {}
		local matched = {}
		for i, plug in ipairs(def.plugs) do
			local wcf = cf * plug.cfS
			local s, why = matchSocket(plug, wcf)
			if not s then
				return false, (i == 1 and "First end: " or "Second end: ") .. why, info
			end
			if used[s] then
				return false, "Both ends land on the same connection.", info
			end
			used[s] = true
			matched[i] = s
			if def.faceNormal then
				local front = cf:VectorToWorldSpace(Vector3.zAxis)
				if front:Dot(s.cf.LookVector) < 0.95 then
					return false, "Panel faces the wrong way — it must hang on the outside face of the columns.", info
				end
			end
			table.insert(info.mates, s.owner)
		end
		local expected = spanCf(def.plugs[1].cfS.Position, def.plugs[2].cfS.Position, matched[1].pos, matched[2].pos)
		if Util.angleBetween(expected, cf) > 0.05 then
			return false, "Twisted out of line with its connections.", info
		end
		for _, req in ipairs(def.requireSockets or {}) do
			local wp = (cf * req.cfS).Position
			local found = false
			for _, s in ipairs(world:query(wp, TOL * 2)) do
				if s.type == req.type then
					found = true
					table.insert(info.mates, s.owner)
					break
				end
			end
			if not found then
				return false, "Missing support: needs an upright with a rosette at every corner of the bay.", info
			end
		end
	elseif def.kind == "Surface" then
		if cf.UpVector.Y < 0.999 then
			return false, "Floor sheets must lie level.", info
		end
		local half = def.size.X / 2 - 0.09
		local exclude = opts.excludeModels
		for i, sx in ipairs({ -1, 1 }) do
			local origin = cf * Vector3.new(sx * half, 0.6, 0)
			local hit = world:raycast(origin, Vector3.new(0, -1.6, 0), exclude)
			local rec = hit and world:record(hit.Instance)
			local okTag = false
			if rec then
				for tag in pairs(def.surface.supportTags) do
					if rec.def.tags[tag] then
						okTag = true
					end
				end
			end
			local endName = i == 1 and "one end" or "the other end"
			if not rec or not okTag then
				return false, string.format("Missing support at %s: it must bear on a beam %.1f m from the first.", endName, def.sizeM.X), info
			end
			if math.abs(hit.Position.Y - cf.Position.Y) > 0.12 then
				return false, "Not bearing on the beam flange — lower it onto the steel.", info
			end
			if rec.state ~= "Installed" then
				return false, string.format("Supporting %s isn't fastened yet.", rec.def.name), info
			end
			table.insert(info.supports, rec.id)
		end
	elseif def.kind == "Rest" then
		if cf.UpVector.Y < 0.999 then
			return false, "It has to stand upright.", info
		end
		local center = cf.Position
		local hit = world:raycast(center + Vector3.new(0, 0.6, 0), Vector3.new(0, -1.4, 0), opts.excludeModels)
		if not hit then
			return false, "Missing support: nothing solid underneath.", info
		end
		if math.abs(hit.Position.Y - center.Y) > 0.15 then
			return false, "Not resting on the surface.", info
		end
		if hit.Normal.Y < 0.94 then
			return false, "Ground is too steep here.", info
		end
		local rec = world:record(hit.Instance)
		if def.rest and def.rest.terrainOnly and hit.Instance ~= workspace.Terrain then
			return false, "Footings must be set on prepared ground, not on other materials.", info
		end
		if rec then
			if rec.state ~= "Installed" then
				return false, "Can only be set down on installed structure or the ground.", info
			end
			table.insert(info.supports, rec.id)
		end
		-- corner support (no hanging off a deck edge)
		local hx, hz = def.size.X / 2 * 0.85, def.size.Z / 2 * 0.85
		local misses = 0
		for _, c in ipairs({ { hx, hz }, { -hx, hz }, { hx, -hz }, { -hx, -hz } }) do
			local o = cf * Vector3.new(c[1], 0.6, c[2])
			local h = world:raycast(o, Vector3.new(0, -1.4, 0), opts.excludeModels)
			if not h or math.abs(h.Position.Y - center.Y) > 0.4 then
				misses += 1
			end
		end
		if misses >= 2 then
			return false, "Missing support: it would overhang an edge.", info
		end
	end

	-- Overlap
	if not opts.ignoreOverlap then
		for _, id in ipairs(info.mates) do
			excl[id] = true
		end
		for _, id in ipairs(info.supports) do
			excl[id] = true
		end
		local shrink = Vector3.new(0.14, 0.14, 0.14)
		local size = def.size - shrink
		size = Vector3.new(math.max(size.X, 0.05), math.max(size.Y, 0.05), math.max(size.Z, 0.05))
		local boxCf = cf * CFrame.new(def.boundsOffset)
		local parts = workspace:GetPartBoundsInBox(boxCf, size, world.overlap)
		for _, p in ipairs(parts) do
			if p.Parent and p.Parent.Name ~= "Fasteners" then
				local rec = world:record(p)
				if rec then
					local ignore = excl[rec.id] or not BuildRules.SolidStates[rec.state]
					if not ignore then
						for tag in pairs(def.overlapIgnore) do
							if rec.def.tags[tag] then
								ignore = true
							end
						end
					end
					if not ignore then
						return false, "Overlaps " .. rec.def.name .. ".", info
					end
				elseif p:IsDescendantOf(world.environment) then
					return false, "Overlaps site equipment (" .. (p.Parent and p.Parent.Name or p.Name) .. ").", info
				end
			end
		end
	end

	return true, nil, info
end

---------------------------------------------------------------------------
-- Solver: find the snapped CFrame for an item from an aim
---------------------------------------------------------------------------

-- aim: { point = Vector3, hit = Instance?, normal = Vector3? }
-- opts: { rot = int steps, free = bool, nudge = Vector3 (studs), current = CFrame (crane landing),
--         excludeModels = {models} }
-- returns cf or nil, hintReason
function BuildRules.solve(world, def, aim, opts)
	opts = opts or {}
	world:index()
	local kind = def.kind
	if kind == "Point" then
		local plug = def.plugs[1]
		local ref = aim.point
		if opts.current then
			ref = (opts.current * plug.cfS).Position
		end
		local best, bestD, wrong = nil, 3.5, nil
		for _, s in ipairs(world:query(ref, 3.5)) do
			local d = (s.pos - ref).Magnitude
			if plug.acceptSet[s.type] then
				if not s.occupiedBy and d < bestD then
					best, bestD = s, d
				end
			elseif not wrong then
				wrong = s
			end
		end
		if not best then
			if wrong then
				return nil, string.format("Wrong connection type: needs %s.", friendlyAccepts(plug.acceptSet))
			end
			return nil, string.format("Aim at %s.", friendlyAccepts(plug.acceptSet))
		end
		local step = math.rad(def.rotStep >= 360 and 0 or def.rotStep)
		local k = opts.rot or 0
		if opts.current and step > 0 then
			local bestA, bestK = math.huge, 0
			for kk = 0, math.floor(2 * math.pi / step + 0.5) - 1 do
				local cand = s_cf(best, step * kk, plug)
				local a = Util.angleBetween(cand, opts.current)
				if a < bestA then
					bestA, bestK = a, kk
				end
			end
			k = bestK
		end
		return best.cf * CFrame.Angles(0, step * k, 0) * plug.cfS:Inverse()
	elseif kind == "Span" then
		local pA, pB = def.plugs[1].cfS.Position, def.plugs[2].cfS.Position
		local L = (pB - pA).Magnitude
		local ref = aim.point
		if opts.current then
			ref = opts.current * ((pA + pB) / 2)
		end
		local radius = L / 2 + 4
		local cands = {}
		for _, s in ipairs(world:query(ref, radius)) do
			if def.plugs[1].acceptSet[s.type] and (s.multi or not s.occupiedBy) then
				table.insert(cands, s)
			end
		end
		local best, bestScore = nil, math.huge
		local sawPairDist = nil
		for i = 1, #cands do
			for j = 1, #cands do
				if i ~= j then
					local a, b = cands[i], cands[j]
					local w = b.pos - a.pos
					local dist = w.Magnitude
					if dist > 0.5 and math.abs(dist - L) <= TOL * 1.5 then
						local inclination = math.asin(Util.clamp(w.Y / dist, -1, 1))
						local wantPitch = def.pitch or 0
						local okPitch = math.abs(math.abs(inclination) - wantPitch) < math.rad(3)
						if okPitch then
							local cf = spanCf(pA, pB, a.pos, b.pos)
							local ok = true
							if def.faceNormal then
								local front = cf:VectorToWorldSpace(Vector3.zAxis)
								ok = front:Dot(a.cf.LookVector) > 0.95 and front:Dot(b.cf.LookVector) > 0.95
							end
							if ok and def.requireSockets then
								for _, req in ipairs(def.requireSockets) do
									local wp = (cf * req.cfS).Position
									local found = false
									for _, s in ipairs(world:query(wp, TOL * 2)) do
										if s.type == req.type then
											found = true
											break
										end
									end
									if not found then
										ok = false
										break
									end
								end
							end
							if ok then
								local mid = (a.pos + b.pos) / 2
								local score = (mid - ref).Magnitude
								if opts.current then
									score += BuildRules.angleDiff(def, cf, opts.current) * 8
								end
								if score < bestScore then
									best, bestScore = cf, score
								end
							end
						end
					elseif dist > 0.5 and math.abs(w.Y) < 0.2 then
						if not sawPairDist or math.abs(dist - L) < math.abs(sawPairDist - L) then
							sawPairDist = dist
						end
					end
				end
			end
		end
		if not best then
			if #cands == 0 then
				return nil, string.format("Aim between two connections: needs %s at both ends.", friendlyAccepts(def.plugs[1].acceptSet))
			end
			if sawPairDist then
				return nil, string.format("Missing support: needs two seats %.2f m apart (nearest pair is %.2f m).", Config.toMeters(L), Config.toMeters(sawPairDist))
			end
			return nil, string.format("Missing support: no second seat %.2f m away.", Config.toMeters(L))
		end
		return best
	elseif kind == "Surface" then
		local rec, anchorPoint
		if opts.current then
			local half = def.size.X / 2 - 0.09
			for _, sx in ipairs({ -1, 1 }) do
				local o = opts.current * Vector3.new(sx * half, 0.5, 0)
				local hit = world:raycast(o, Vector3.new(0, -8, 0), opts.excludeModels)
				local r = hit and world:record(hit.Instance)
				if r and r.def.tags.Beam then
					rec, anchorPoint = r, o
					break
				end
			end
		else
			rec = aim.hit and world:record(aim.hit)
			anchorPoint = aim.point
		end
		if not rec or not rec.def.tags.Beam then
			return nil, "Aim at the top flange of an installed beam."
		end
		local beamCf = rec.cf
		local ax = beamCf.XVector
		ax = Vector3.new(ax.X, 0, ax.Z)
		if ax.Magnitude < 0.5 then
			return nil, "That beam is not level."
		end
		ax = ax.Unit
		local d = rec.def.sizeM.Y * S
		local top = beamCf.Position + Vector3.new(0, d / 2, 0)
		local s = ax:Cross(UP).Unit
		if (anchorPoint - top):Dot(s) < 0 then
			s = -s
		end
		local seat = Config.Geo.SeatOffset * S
		local fullLen = rec.def.size.X + 2 * seat
		local t0 = top - ax * (fullLen / 2)
		local W = def.surface.tile * S
		local tAim = (anchorPoint - t0):Dot(ax)
		local t = (math.floor(tAim / W) + 0.5) * W
		t = Util.clamp(t, W / 2, fullLen - W / 2)
		local L = def.size.X
		local pos = t0 + ax * t + s * (L / 2)
		pos = Vector3.new(pos.X, top.Y, pos.Z)
		return CFrame.fromMatrix(pos, s, UP, s:Cross(UP))
	elseif kind == "Rest" then
		local p = aim.point
		if opts.current then
			local hit = world:raycast(opts.current.Position + Vector3.new(0, 1, 0), Vector3.new(0, -80, 0), opts.excludeModels)
			if not hit then
				return nil, "No ground below the load."
			end
			p = hit.Position
		end
		local yaw
		if opts.current then
			yaw = Util.yawOf(opts.current)
			if not def.allowFree then
				yaw = Util.round(yaw, math.rad(90))
			end
		else
			local step = opts.free and Config.Grid.FreeRotateStep or 90
			if def.rotStep >= 360 then
				step = 0
			end
			yaw = math.rad(step * (opts.rot or 0))
		end
		local snapped = false
		if def.rest and def.rest.lattice and not opts.free then
			local bestNode, bestD = nil, 30
			for _, s in ipairs(world:query(p, 30)) do
				if s.type == "ScafNode" and math.abs(s.pos.Y - Config.Geo.ScaffoldJack * S - p.Y) < 2 then
					local dd = (Vector3.new(s.pos.X, 0, s.pos.Z) - Vector3.new(p.X, 0, p.Z)).Magnitude
					if dd < bestD then
						bestNode, bestD = s, dd
					end
				end
			end
			if bestNode then
				local A, B = Config.Geo.ScaffoldBayLong * S, Config.Geo.ScaffoldBayShort * S
				local dx, dz = p.X - bestNode.pos.X, p.Z - bestNode.pos.Z
				local function snapAxis(v)
					local options = { Util.round(v, A), Util.round(v, B) }
					return math.abs(options[1] - v) <= math.abs(options[2] - v) and options[1] or options[2]
				end
				p = Vector3.new(bestNode.pos.X + snapAxis(dx), p.Y, bestNode.pos.Z + snapAxis(dz))
				snapped = true
			end
		end
		if not snapped and not opts.free then
			local g = ((def.rest and def.rest.grid) or Config.Grid.Ground) * S
			p = Vector3.new(Util.round(p.X, g), p.Y, Util.round(p.Z, g))
		end
		if opts.nudge then
			p += Vector3.new(opts.nudge.X, 0, opts.nudge.Z)
		end
		-- settle on whatever is under the snapped point
		local hit = world:raycast(p + Vector3.new(0, 3, 0), Vector3.new(0, -8, 0), opts.excludeModels)
		if hit then
			p = Vector3.new(p.X, hit.Position.Y, p.Z)
		end
		return CFrame.new(p) * CFrame.Angles(0, yaw, 0)
	end
	return nil, "This item can't be placed."
end

-- Ids of the components an item at `cf` connects to or bears on (any state).
-- Used to rebuild support links for pre-built site stages.
function BuildRules.supportsOf(world, def, cf, selfId)
	world:index()
	local ids, seen = {}, {}
	local function add(id)
		if id and id ~= selfId and not seen[id] then
			seen[id] = true
			table.insert(ids, id)
		end
	end
	for _, plug in ipairs(def.plugs) do
		local wp = (cf * plug.cfS).Position
		for _, s in ipairs(world:query(wp, TOL * 2)) do
			if plug.acceptSet[s.type] then
				add(s.owner)
				break
			end
		end
	end
	if def.kind == "Surface" then
		local half = def.size.X / 2 - 0.09
		for _, sx in ipairs({ -1, 1 }) do
			local hit = world:raycast(cf * Vector3.new(sx * half, 0.6, 0), Vector3.new(0, -1.6, 0))
			local rec = hit and world:record(hit.Instance)
			if rec then
				add(rec.id)
			end
		end
	elseif def.kind == "Rest" then
		local hit = world:raycast(cf.Position + Vector3.new(0, 0.6, 0), Vector3.new(0, -1.4, 0))
		local rec = hit and world:record(hit.Instance)
		if rec then
			add(rec.id)
		end
	end
	return ids
end

-- Components that rest on / connect to `id` (blocking dismantle).
function BuildRules.dependents(world, id)
	local out = {}
	for _, model in ipairs(world.components:GetChildren()) do
		local sup = model:GetAttribute("SupportedBy")
		if sup and BuildRules.SupportStates[model:GetAttribute("State")] then
			for other in string.gmatch(sup, "[^,]+") do
				if other == id then
					table.insert(out, model)
					break
				end
			end
		end
	end
	return out
end

return BuildRules
