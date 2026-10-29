-- Lays out a list of items on a rectangular bed (trailer deck or laydown yard)
-- as stacked blocks on dunnage, the way steel is actually shipped: one block
-- per item type, layers separated by timbers, straps over each block.
--
-- Coordinates are in the bed's local frame: X along the bed, Z across it,
-- Y = 0 at the bed surface. Everything in studs.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Steelrise")
local Config = require(Shared.Config)
local Registry = require(Shared.ItemRegistry)

local S = Config.S

local Packing = {}

local DUNNAGE = 0.1 * S
local GAP = 0.08 * S

-- Rotated bounding size and centre offset for an item in its transport pose.
function Packing.transportBox(def)
	local R = def.transport
	local sx, sy, sz = def.size.X / 2, def.size.Y / 2, def.size.Z / 2
	local rx, ry, rz = R.RightVector, R.UpVector, -R.LookVector
	local hx = math.abs(rx.X) * sx + math.abs(ry.X) * sy + math.abs(rz.X) * sz
	local hy = math.abs(rx.Y) * sx + math.abs(ry.Y) * sy + math.abs(rz.Y) * sz
	local hz = math.abs(rx.Z) * sx + math.abs(ry.Z) * sy + math.abs(rz.Z) * sz
	local offset = R:VectorToWorldSpace(def.boundsOffset)
	return Vector3.new(hx * 2, hy * 2, hz * 2), offset
end

-- requests: array of { id = itemId, qty = n }
-- returns placed = { {id, cf(local)} }, extras = { dunnage = {{cf,size}}, straps = {{cf,size,group}} },
--         leftovers = { {id, qty} }, kg
function Packing.pack(requests, bedLength, bedWidth, maxHeight, opts)
	opts = opts or {}
	local placed, dunnage, straps, leftovers = {}, {}, {}, {}
	local cursor = -bedLength / 2 + 0.3 * S
	local totalKg = 0
	local maxKg = opts.maxKg or math.huge
	local groupN = 0
	-- longest items first so long steel sits at the front of the bed
	local sorted = {}
	for _, r in ipairs(requests) do
		local def = Registry.get(r.id)
		if def and r.qty > 0 then
			table.insert(sorted, { def = def, qty = r.qty })
		end
	end
	table.sort(sorted, function(a, b)
		return a.def.size.Magnitude > b.def.size.Magnitude
	end)
	for _, req in ipairs(sorted) do
		local def = req.def
		local box, offset = Packing.transportBox(def)
		local rot = def.transport
		local x, h, z = box.X, box.Y, box.Z
		if z > bedWidth and x <= bedWidth and z <= bedLength then
			rot = CFrame.Angles(0, math.pi / 2, 0) * rot
			box, offset = Vector3.new(z, h, x), CFrame.Angles(0, math.pi / 2, 0):VectorToWorldSpace(offset)
			x, z = box.X, box.Z
		end
		local across = math.max(1, math.floor((bedWidth + GAP) / (z + GAP)))
		local layers = 1
		if h <= maxHeight / 2 then
			layers = math.max(1, math.floor((maxHeight + 0.001) / (h + DUNNAGE)))
		end
		local remaining = req.qty
		while remaining > 0 do
			if cursor + x > bedLength / 2 + 0.01 then
				break
			end
			groupN += 1
			local group = (opts.prefix or "G") .. groupN
			local inBlock = 0
			local topY = 0
			local xc = cursor + x / 2
			for l = 0, layers - 1 do
				if remaining <= 0 then
					break
				end
				local yBottom = DUNNAGE + l * (h + DUNNAGE)
				-- dunnage under this layer
				for _, fx in ipairs({ -0.3, 0.3 }) do
					table.insert(dunnage, {
						cf = CFrame.new(xc + fx * x, yBottom - DUNNAGE / 2, 0),
						size = Vector3.new(0.12 * S, DUNNAGE, math.min(bedWidth, across * (z + GAP))),
					})
				end
				for a = 0, across - 1 do
					if remaining <= 0 then
						break
					end
					if totalKg + def.weightKg > maxKg then
						break
					end
					local zc = -((across - 1) / 2) * (z + GAP) + a * (z + GAP)
					local centre = Vector3.new(xc, yBottom + h / 2, zc)
					local cf = CFrame.new(centre - offset) * rot
					table.insert(placed, { id = def.id, cf = cf, group = group })
					totalKg += def.weightKg
					remaining -= 1
					inBlock += 1
					topY = yBottom + h
				end
				if totalKg + def.weightKg > maxKg then
					break
				end
			end
			if inBlock == 0 then
				break
			end
			-- straps over the block
			local strapXs = x > 3.5 * S and { xc - x / 4, xc + x / 4 } or { xc }
			for _, sx in ipairs(strapXs) do
				table.insert(straps, { x = sx, top = topY, width = math.min(bedWidth, across * (z + GAP)), group = group })
			end
			cursor += x + GAP * 2
			if totalKg + def.weightKg > maxKg then
				break
			end
		end
		if remaining > 0 then
			table.insert(leftovers, { id = def.id, qty = remaining })
		end
	end
	return placed, { dunnage = dunnage, straps = straps }, leftovers, totalKg
end

return Packing
