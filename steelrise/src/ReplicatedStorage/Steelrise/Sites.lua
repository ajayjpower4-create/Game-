-- Site definitions and the deterministic building layout generator.
--
-- A site's building is described by a column grid. layout(site) expands the
-- grid into a full blueprint (every footing, column, beam, gusset, brace, deck
-- sheet and facade unit with its exact CFrame). The starting stage is a
-- subset of that blueprint installed at load; the rest is what still has to be
-- built. Menu previews are generated from the same data, so a preview always
-- shows the playable starting state.

local Config = require(script.Parent.Config)
local Registry = require(script.Parent.ItemRegistry)
local Factory = require(script.Parent.ModelFactory)
local BuildRules = require(script.Parent.BuildRules)
local Util = require(script.Parent.Util)

local S = Config.S
local G = Config.Geo
local V = Vector3.new

local Sites = {}

local function m(x)
	return x * S
end

-- Trailer bay: CFrame at the road surface under the middle of the bed,
-- bed length along local X, cab toward -X.
local function bay(x, z, yawDeg)
	return CFrame.new(m(x), 0, m(z)) * CFrame.Angles(0, math.rad(yawDeg or 0), 0)
end

-- Railcar spot on the siding: rail head height, deck along +X.
local function railSpot(x, z)
	return CFrame.new(m(x), m(0.4), m(z))
end

Sites.Order = { "EmptyLand", "Office1", "Office2", "Office3", "Office4", "Office5", "Apartment", "HighRise" }

Sites.Defs = {
	EmptyLand = {
		id = "EmptyLand",
		name = "Empty Land",
		subtitle = "Open graded lot",
		description = "A large graded lot with nothing on it. Set out footings anywhere, erect your own frame and scaffold it — or follow the Starter Frame blueprint.",
		stageText = "Bare ground — start from foundations",
		difficulty = "Beginner",
		equipment = { "Tower crane — 50 m jib, 8 t", "Flatbed deliveries (3 bays)", "Scaffold kit in laydown" },
		style = "Rural",
		lotM = V(120, 0, 90),
		lighting = { clock = 9.6, latitude = 38, haze = 0.9, density = 0.3, tint = Color3.fromRGB(255, 248, 238) },
		crane = { posM = V(-6, 0, 3), heightM = 30, jibM = 50, counterM = 14, maxKg = 8000, fullRadiusM = 18, slewDeg = 200 },
		bays = { bay(14, -33), bay(14, -24.5), bay(14, -16) },
		entryM = V(70, 0, -52),
		spawnM = V(22, 0, -40),
		laydownM = { center = V(-24, 0, -30), size = V(22, 0, 14) },
		blueprints = {
			{
				id = "StarterFrame",
				name = "Starter Frame — 2 × 1 bays",
				grid = { originM = V(-36, 0, 14), nx = 2, nz = 1, bayX = 6.0, bayZ = 6.0, floorH = 4.2, floors = 1, column = "W12×65", beam = "W16×31", deck = true, braces = { { "x", 0, 0 } }, facade = nil },
			},
			{
				id = "Workshop",
				name = "Two-Storey Workshop — 3 × 2 bays",
				grid = { originM = V(-48, 0, 14), nx = 3, nz = 2, bayX = 7.5, bayZ = 6.0, floorH = 4.5, floors = 2, column = "W14×90", beam = "W18×35", deck = true, braces = { { "x", 0, 0 }, { "x", 2, 2 } }, facade = "wall" },
			},
		},
		starter = {
			trailer = { { "FT-PRECAST-1500", 6 }, { "COL-W12x65-4200", 6 }, { "BM-W16x31-6000", 7 } },
			laydown = {
				{ "DK-15B-6000", 8 },
				{ "CON-GUSSET-350", 2 },
				{ "SC-BASEJACK", 4 },
				{ "SC-STD-2000", 4 },
				{ "SC-LEDGER-2570", 4 },
				{ "SC-LEDGER-1090", 4 },
				{ "SC-DECK-2570", 1 },
				{ "SC-LADDER-27", 1 },
			},
		},
	},

	Office1 = {
		id = "Office1",
		name = "Office 1 — Suburban Business Park",
		subtitle = "Low-rise office",
		description = "A three-storey office in a landscaped business park. Footings are cast and a few starter columns are standing; the rest of the frame is yours.",
		stageText = "Foundations complete, 4 starter columns",
		difficulty = "Beginner",
		equipment = { "Tower crane — 55 m jib, 8 t", "Flatbed deliveries (3 bays)", "Scaffold kit" },
		style = "Suburban",
		lotM = V(150, 0, 110),
		lighting = { clock = 12.2, latitude = 34, haze = 0.6, density = 0.27, tint = Color3.fromRGB(255, 252, 245) },
		crane = { posM = V(14, 0, 10), heightM = 35, jibM = 55, counterM = 15, maxKg = 8000, fullRadiusM = 20, slewDeg = 160 },
		bays = { bay(30, -40), bay(30, -31.5), bay(30, -23) },
		entryM = V(90, 0, -62),
		spawnM = V(36, 0, -48),
		laydownM = { center = V(-8, 0, -34), size = V(24, 0, 14) },
		grid = { originM = V(-27, 0, -4), nx = 4, nz = 3, bayX = 7.5, bayZ = 7.5, floorH = 4.2, floors = 3, column = "W12×65", beam = "W18×35", deck = true, braces = { { "x", 0, 0 }, { "x", 3, 3 }, { "z", 0, 1 } }, facade = "wall" },
		stage = function(e)
			if e.phase == "footing" then
				return true
			end
			return e.phase == "column" and e.level == 1 and e.i <= 1 and e.j <= 1
		end,
	},

	Office2 = {
		id = "Office2",
		name = "Office 2 — Downtown Corner",
		subtitle = "Mid-rise office",
		description = "A six-storey corner office squeezed between neighbours. The steel skeleton is up four levels with gaps to fill; deliveries stop on the street, so every pick is a crane pick.",
		stageText = "Exposed steel skeleton, levels 1–4",
		difficulty = "Standard",
		equipment = { "Tower crane — 45 m jib, 6 t", "Street-side delivery bay (2)", "Scaffold kit" },
		style = "Downtown",
		lotM = V(46, 0, 42),
		lighting = { clock = 16.4, latitude = 41, haze = 1.6, density = 0.36, tint = Color3.fromRGB(255, 236, 214) },
		crane = { posM = V(16, 0, 14), heightM = 45, jibM = 45, counterM = 13, maxKg = 6000, fullRadiusM = 16, slewDeg = 225 },
		bays = { bay(6, -26), bay(30, 4, 90) },
		entryM = V(-60, 0, -26),
		spawnM = V(-15, 0, -17),
		laydownM = { center = V(-17, 0, -15), size = V(8, 0, 8) },
		grid = { originM = V(-12, 0, -7), nx = 3, nz = 3, bayX = 6.0, bayZ = 6.0, floorH = 4.2, floors = 6, column = "W14×90", beam = "W16×31", deck = true, braces = { { "x", 0, 0 }, { "z", 3, 1 } }, facade = "curtain" },
		stage = function(e)
			if e.phase == "footing" then
				return true
			end
			if e.phase == "column" then
				return e.level <= 4
			end
			if e.phase == "beam" then
				if e.level == 4 then
					return (e.i + e.j) % 3 ~= 0
				end
				return e.level <= 3
			end
			if e.phase == "gusset" or e.phase == "brace" then
				return e.level <= 2
			end
			return false
		end,
	},

	Office3 = {
		id = "Office3",
		name = "Office 3 — Waterfront Offices",
		subtitle = "Large office, facade stage",
		description = "A five-storey waterfront office. Three levels of frame and two floors of deck are in; the glass facade has only just started, leaving the long harbour elevation open.",
		stageText = "Frame L1–3, decks L1–2, facade started",
		difficulty = "Standard",
		equipment = { "Tower crane — 60 m jib, 8 t", "Flatbed deliveries (3 bays)", "Scaffold kit" },
		style = "Waterfront",
		lotM = V(150, 0, 90),
		lighting = { clock = 10.4, latitude = 47, haze = 1.2, density = 0.33, tint = Color3.fromRGB(240, 246, 255) },
		crane = { posM = V(10, 0, 4), heightM = 38, jibM = 60, counterM = 16, maxKg = 8000, fullRadiusM = 20, slewDeg = 150 },
		bays = { bay(40, -32), bay(40, -23.5), bay(15, -32) },
		entryM = V(95, 0, -52),
		spawnM = V(48, 0, -40),
		laydownM = { center = V(-14, 0, -32), size = V(24, 0, 12) },
		grid = { originM = V(-38, 0, -6), nx = 5, nz = 3, bayX = 7.5, bayZ = 7.5, floorH = 4.2, floors = 5, column = "W14×90", beam = "W18×35", deck = true, braces = { { "x", 0, 0 }, { "x", 4, 0 } }, facade = "curtain" },
		stage = function(e)
			if e.phase == "footing" then
				return true
			end
			if e.phase == "column" or e.phase == "beam" or e.phase == "gusset" or e.phase == "brace" then
				return e.level <= 3
			end
			if e.phase == "deck" then
				return e.level <= 2
			end
			if e.phase == "facade" then
				return e.level == 1 and e.side == "-Z" and e.i <= 2
			end
			return false
		end,
	},

	Office4 = {
		id = "Office4",
		name = "Office 4 — Industrial District",
		subtitle = "Wide two-storey office",
		description = "A long, wide office between warehouses and the freight line. Ground-floor framing is incomplete and the metal wall cladding is only on part of the west and south walls.",
		stageText = "Partial frame L1, metal walls started",
		difficulty = "Standard",
		equipment = { "Tower crane — 65 m jib, 10 t", "Flatbed deliveries (3 bays)", "Rail siding — 2 flatcar spots" },
		style = "Industrial",
		lotM = V(170, 0, 110),
		lighting = { clock = 14.8, latitude = 42, haze = 2.0, density = 0.38, tint = Color3.fromRGB(255, 244, 226) },
		crane = { posM = V(6, 0, 14), heightM = 32, jibM = 65, counterM = 17, maxKg = 10000, fullRadiusM = 22, slewDeg = 270 },
		bays = { bay(40, -38), bay(40, -29.5), bay(40, -21) },
		entryM = V(100, 0, -62),
		spawnM = V(50, 0, -46),
		laydownM = { center = V(-20, 0, -34), size = V(26, 0, 14) },
		rail = true,
		railSpots = { railSpot(-14, 63), railSpot(6, 63) },
		grid = { originM = V(-27, 0, -9), nx = 6, nz = 2, bayX = 9.0, bayZ = 9.0, floorH = 4.5, floors = 2, column = "W14×90", beam = "W21×44", deck = true, braces = { { "x", 0, 0 }, { "x", 5, 0 }, { "x", 0, 2 }, { "x", 5, 2 } }, facade = "wall" },
		stage = function(e)
			if e.phase == "footing" then
				return true
			end
			if e.phase == "column" then
				return e.level == 1
			end
			if e.phase == "beam" then
				return e.level == 1 and (e.i <= 3 or e.dir == "z" and e.i == 4)
			end
			if e.phase == "gusset" or e.phase == "brace" then
				return e.level == 1 and e.i == 0
			end
			if e.phase == "facade" then
				return e.level == 1 and ((e.side == "-X") or (e.side == "-Z" and e.i <= 1))
			end
			return false
		end,
	},

	Office5 = {
		id = "Office5",
		name = "Office 5 — City Center Tower",
		subtitle = "Twelve-storey office tower",
		description = "A slender tower in the financial district. Six levels of frame and five floors of deck are complete; the upper floors are open and every member goes up by crane.",
		stageText = "Frame L1–6, decks L1–5, open upper floors",
		difficulty = "Advanced",
		equipment = { "Tower crane — 55 m jib on a 70 m mast", "Street delivery bays (2)", "Scaffold kit" },
		style = "CityCenter",
		lotM = V(60, 0, 56),
		lighting = { clock = 17.6, latitude = 40, haze = 2.2, density = 0.4, tint = Color3.fromRGB(255, 226, 196) },
		crane = { posM = V(17, 0, 16), heightM = 70, jibM = 55, counterM = 15, maxKg = 8000, fullRadiusM = 18, slewDeg = 225 },
		bays = { bay(2, -33), bay(36, 0, 90) },
		entryM = V(-70, 0, -33),
		spawnM = V(-20, 0, -22),
		laydownM = { center = V(-20, 0, -20), size = V(12, 0, 8) },
		grid = { originM = V(-12, 0, -11), nx = 3, nz = 3, bayX = 7.5, bayZ = 7.5, floorH = 4.2, floors = 12, column = "W14×90", beam = "W18×35", deck = true, braces = { { "x", 1, 0 }, { "x", 1, 3 }, { "z", 0, 1 }, { "z", 3, 1 } }, facade = "curtain" },
		stage = function(e)
			if e.phase == "footing" then
				return true
			end
			if e.phase == "column" or e.phase == "beam" or e.phase == "gusset" or e.phase == "brace" then
				return e.level <= 6
			end
			if e.phase == "deck" then
				return e.level <= 5
			end
			if e.phase == "facade" then
				return e.level <= 2
			end
			return false
		end,
	},

	Apartment = {
		id = "Apartment",
		name = "Apartment Building",
		subtitle = "Six-storey residential",
		description = "A long residential block with repeated floor plates. The first three floors are framed and decked; facade units are going on. Interior partitions, balconies and fittings arrive in Phase 2.",
		stageText = "Frame + decks L1–3, facade on L1",
		difficulty = "Standard",
		equipment = { "Tower crane — 55 m jib, 8 t", "Flatbed deliveries (3 bays)", "Scaffold kit" },
		style = "Residential",
		lotM = V(120, 0, 80),
		lighting = { clock = 8.4, latitude = 45, haze = 1.4, density = 0.34, tint = Color3.fromRGB(255, 238, 220) },
		crane = { posM = V(0, 0, 16), heightM = 36, jibM = 55, counterM = 15, maxKg = 8000, fullRadiusM = 20, slewDeg = 180 },
		bays = { bay(26, -28), bay(26, -19.5), bay(0, -28) },
		entryM = V(80, 0, -46),
		spawnM = V(34, 0, -36),
		laydownM = { center = V(-26, 0, -26), size = V(20, 0, 12) },
		grid = { originM = V(-15, 0, -2), nx = 5, nz = 2, bayX = 6.0, bayZ = 6.0, floorH = 3.6, floors = 6, column = "W12×65", beam = "W16×31", deck = true, braces = { { "x", 0, 0 }, { "x", 4, 2 } }, facade = "mixed", balconies = true },
		stage = function(e)
			if e.phase == "footing" then
				return true
			end
			if e.phase == "column" or e.phase == "beam" or e.phase == "deck" or e.phase == "gusset" or e.phase == "brace" then
				return e.level <= 3
			end
			if e.phase == "facade" then
				return e.level == 1
			end
			return false
		end,
	},

	HighRise = {
		id = "HighRise",
		name = "High-Rise Building",
		subtitle = "Twenty-storey tower",
		description = "A large twenty-storey tower built floor by floor. Four levels of frame are standing; lifting materials to the working floor is the job, with long hoists and plenty of sway to manage.",
		stageText = "Frame L1–4, decks L1–3",
		difficulty = "Expert",
		equipment = { "Tower crane — 60 m jib on a 100 m mast", "Flatbed deliveries (3 bays)", "Scaffold kit" },
		style = "HighRise",
		lotM = V(90, 0, 80),
		lighting = { clock = 11.0, latitude = 36, haze = 1.8, density = 0.36, tint = Color3.fromRGB(250, 248, 244) },
		crane = { posM = V(24, 0, 20), heightM = 100, jibM = 60, counterM = 18, maxKg = 10000, fullRadiusM = 22, slewDeg = 210 },
		bays = { bay(16, -32), bay(16, -23.5), bay(40, -10, 90) },
		entryM = V(80, 0, -50),
		spawnM = V(30, 0, -38),
		laydownM = { center = V(36, 0, 34), size = V(12, 0, 10) },
		grid = { originM = V(-15, 0, -14), nx = 4, nz = 4, bayX = 7.5, bayZ = 7.5, floorH = 4.2, floors = 20, column = "W14×90", beam = "W21×44", deck = true, braces = { { "x", 1, 0 }, { "x", 2, 4 }, { "z", 0, 1 }, { "z", 4, 2 } }, facade = "curtain" },
		stage = function(e)
			if e.phase == "footing" then
				return true
			end
			if e.phase == "column" or e.phase == "beam" or e.phase == "gusset" or e.phase == "brace" then
				return e.level <= 4
			end
			if e.phase == "deck" then
				return e.level <= 3
			end
			return false
		end,
	},
}

---------------------------------------------------------------------------
-- Layout generation
---------------------------------------------------------------------------

local SEAT = G.SeatOffset * S

local function gussetCf(colBase, gridPos, dir, high, L)
	local y = high and (colBase + L - G.GussetHighFromTop * S) or (colBase + G.GussetLow * S)
	local pos = V(gridPos.X, y, gridPos.Z) + dir * SEAT
	return Factory.lookAlong(pos, dir)
end

-- Expands a grid into blueprint entries:
-- { key, item, cf, phase, level, i, j, dir, side, group }
function Sites.layout(grid)
	local entries = {}
	local O = grid.originM * S
	local bx, bz = grid.bayX * S, grid.bayZ * S
	local L = grid.floorH * S
	local y0 = G.FootingTop * S
	local colId = Registry.find("column", grid.column, grid.floorH)
	local beamX = Registry.find("beam", grid.beam, grid.bayX)
	local beamZ = Registry.find("beam", grid.beam, grid.bayZ)
	local beamDef = Registry.get(beamX)
	local d = beamDef.profile.d * S
	local footing = Registry.find("footing", grid.bayX >= 9 and 2.0 or 1.5)

	local function gp(i, j)
		return V(O.X + i * bx, 0, O.Z + j * bz)
	end
	local function push(e)
		e.key = e.phase .. ":" .. e.level .. ":" .. e.i .. ":" .. e.j .. ":" .. (e.dir or "") .. ":" .. (e.side or "")
		table.insert(entries, e)
	end

	for i = 0, grid.nx do
		for j = 0, grid.nz do
			push({ phase = "footing", level = 0, i = i, j = j, item = footing, cf = CFrame.new(gp(i, j)) })
		end
	end

	for k = 1, grid.floors do
		local base = y0 + (k - 1) * L
		local top = base + L
		for i = 0, grid.nx do
			for j = 0, grid.nz do
				local p = gp(i, j)
				push({ phase = "column", level = k, i = i, j = j, item = colId, cf = CFrame.new(p.X, base + L / 2, p.Z) })
			end
		end
		-- beams along X
		for i = 0, grid.nx - 1 do
			for j = 0, grid.nz do
				local a, b = gp(i, j), gp(i + 1, j)
				local c = (a + b) / 2
				push({ phase = "beam", level = k, i = i, j = j, dir = "x", item = beamX, cf = CFrame.new(c.X, top - d / 2, c.Z) })
			end
		end
		-- beams along Z
		for i = 0, grid.nx do
			for j = 0, grid.nz - 1 do
				local a, b = gp(i, j), gp(i, j + 1)
				local c = (a + b) / 2
				push({ phase = "beam", level = k, i = i, j = j, dir = "z", item = beamZ, cf = CFrame.new(c.X, top - d / 2, c.Z) * CFrame.Angles(0, math.pi / 2, 0) })
			end
		end
		-- braced bays: { "x", i, j } = bay along X starting at column (i, j)
		for _, br in ipairs(grid.braces or {}) do
			local dirName, bi, bj = br[1], br[2], br[3]
			local a = gp(bi, bj)
			local b = dirName == "x" and gp(bi + 1, bj) or gp(bi, bj + 1)
			local valid = (dirName == "x" and bi < grid.nx and bj <= grid.nz) or (dirName == "z" and bj < grid.nz and bi <= grid.nx)
			if valid then
				local dir = (b - a).Unit
				local gA = gussetCf(base, a, dir, false, L)
				local gB = gussetCf(base, b, -dir, true, L)
				push({ phase = "gusset", level = k, i = bi, j = bj, dir = dirName, side = "A", item = "CON-GUSSET-350", cf = gA })
				push({ phase = "gusset", level = k, i = bi, j = bj, dir = dirName, side = "B", item = "CON-GUSSET-350", cf = gB })
				local braceId = Registry.find("brace", dirName == "x" and grid.bayX or grid.bayZ, grid.floorH)
				local braceDef = Registry.get(braceId)
				if braceDef then
					local seatA = (gA * CFrame.new(0, 0, -G.GussetTip * S)).Position
					local seatB = (gB * CFrame.new(0, 0, -G.GussetTip * S)).Position
					local pA, pB = braceDef.plugs[1].cfS.Position, braceDef.plugs[2].cfS.Position
					push({ phase = "brace", level = k, i = bi, j = bj, dir = dirName, item = braceId, cf = BuildRules.spanCf(pA, pB, seatA, seatB) })
				end
			end
		end
		-- deck sheets spanning X in every bay
		-- the top level is the roof: insulated roof deck, no concrete
		local isRoof = k == grid.floors
		if grid.deck then
			local deckId = isRoof and ("RF-DECK-" .. tostring(math.floor(grid.bayX * 1000 + 0.5))) or Registry.find("deck", grid.bayX)
			local W = G.DeckWidth * S
			local n = math.floor(bz / W + 0.5)
			local slabId = "SL-CIP-" .. math.floor(grid.bayX * 1000 + 0.5) .. "-" .. math.floor(grid.bayZ * 1000 + 0.5)
			for i = 0, grid.nx - 1 do
				for j = 0, grid.nz - 1 do
					local a = gp(i, j)
					for t = 0, n - 1 do
						local pos = V(a.X + bx / 2, top, a.Z + (t + 0.5) * W)
						local e = { phase = "deck", level = k, i = i, j = j, dir = tostring(t), item = deckId, cf = CFrame.new(pos), group = "deck:" .. k .. ":" .. i .. ":" .. j }
						push(e)
					end
					if not isRoof and Registry.get(slabId) then
						push({ phase = "slab", level = k, i = i, j = j, item = slabId, cf = CFrame.new(a.X + bx / 2, top + G.DeckDepth * S, a.Z + bz / 2) })
					end
				end
			end
		end
		-- facade on the four perimeter faces
		if grid.facade then
			local function facadeItem(bayLen, idx)
				local kind = grid.facade
				if kind == "mixed" then
					kind = (idx % 2 == 0) and "curtain" or "wall"
				end
				return Registry.find(kind, bayLen, grid.floorH)
			end
			local rc = G.CladOffset * S
			local faces = {
				{ side = "-Z", n = V(0, 0, -1), along = "x", fixed = 0 },
				{ side = "+Z", n = V(0, 0, 1), along = "x", fixed = grid.nz },
				{ side = "-X", n = V(-1, 0, 0), along = "z", fixed = 0 },
				{ side = "+X", n = V(1, 0, 0), along = "z", fixed = grid.nx },
			}
			for _, f in ipairs(faces) do
				local count = f.along == "x" and grid.nx or grid.nz
				for t = 0, count - 1 do
					local a, b
					if f.along == "x" then
						a, b = gp(t, f.fixed), gp(t + 1, f.fixed)
					else
						a, b = gp(f.fixed, t), gp(f.fixed, t + 1)
					end
					local sa = V(a.X, base, a.Z) + f.n * rc
					local sb = V(b.X, base, b.Z) + f.n * rc
					if (sb - sa):Cross(Vector3.yAxis):Dot(f.n) < 0 then
						sa, sb = sb, sa
					end
					local bayLen = f.along == "x" and grid.bayX or grid.bayZ
					local id = facadeItem(bayLen, t + k)
					local def = Registry.get(id)
					if def then
						local pA, pB = def.plugs[1].cfS.Position, def.plugs[2].cfS.Position
						local ii, jj = t, f.fixed
						if f.along == "z" then
							ii, jj = f.fixed, t
						end
						push({ phase = "facade", level = k, i = ii, j = jj, side = f.side, item = id, cf = BuildRules.spanCf(pA, pB, sa, sb) })
					end
				end
			end
		end
		-- roof parapets on the top level, balconies on residential floors
		local rc = G.CladOffset * S
		local edgeFaces = {
			{ side = "-Z", n = V(0, 0, -1), along = "x", fixed = 0 },
			{ side = "+Z", n = V(0, 0, 1), along = "x", fixed = grid.nz },
			{ side = "-X", n = V(-1, 0, 0), along = "z", fixed = 0 },
			{ side = "+X", n = V(1, 0, 0), along = "z", fixed = grid.nx },
		}
		local function edgeSpan(f, t, y, item, phase, extra)
			local a, b
			if f.along == "x" then
				a, b = gp(t, f.fixed), gp(t + 1, f.fixed)
			else
				a, b = gp(f.fixed, t), gp(f.fixed, t + 1)
			end
			local sa = V(a.X, y, a.Z) + f.n * rc
			local sb = V(b.X, y, b.Z) + f.n * rc
			if (sb - sa):Cross(Vector3.yAxis):Dot(f.n) < 0 then
				sa, sb = sb, sa
			end
			local def = Registry.get(item)
			if def then
				local pA, pB = def.plugs[1].cfS.Position, def.plugs[2].cfS.Position
				local ii, jj = t, f.fixed
				if f.along == "z" then
					ii, jj = f.fixed, t
				end
				push({ phase = phase, level = k, i = ii, j = jj, side = f.side, dir = extra, item = item, cf = BuildRules.spanCf(pA, pB, sa, sb) })
			end
		end
		if isRoof then
			for _, f in ipairs(edgeFaces) do
				local count = f.along == "x" and grid.nx or grid.nz
				local bayLen = f.along == "x" and grid.bayX or grid.bayZ
				for t = 0, count - 1 do
					edgeSpan(f, t, top + G.SlabTop * S, "RF-PARAPET-" .. math.floor(bayLen * 1000 + 0.5), "parapet")
				end
			end
		end
		if grid.balconies and k >= 2 then
			local f = edgeFaces[2]
			for t = 0, grid.nx - 1 do
				if (t + k) % 2 == 0 then
					local style = (t % 4 == 0) and "STEEL" or "GLASS"
					edgeSpan(f, t, base, "BL-CANT-" .. math.floor(grid.bayX * 1000 + 0.5) .. "-" .. style, "balcony")
				end
			end
		end
	end
	return entries
end

-- Build order used for the task panel and "next work package" deliveries.
Sites.PhaseOrder = { footing = 1, column = 2, beam = 3, gusset = 4, brace = 5, deck = 6, slab = 7, facade = 8, balcony = 9, parapet = 10 }

function Sites.sortEntries(entries)
	table.sort(entries, function(a, b)
		if a.level ~= b.level then
			if a.phase == "footing" or b.phase == "footing" then
				return a.phase == "footing" and b.phase ~= "footing"
			end
			return a.level < b.level
		end
		local pa, pb = Sites.PhaseOrder[a.phase], Sites.PhaseOrder[b.phase]
		if pa ~= pb then
			return pa < pb
		end
		return a.key < b.key
	end)
	return entries
end

function Sites.get(id)
	return Sites.Defs[id]
end

-- Main grid of a site, or a blueprint grid for free-build sites.
function Sites.blueprintGrid(site, blueprintId)
	if site.grid and (not blueprintId or blueprintId == "Site") then
		return site.grid
	end
	for _, bp in ipairs(site.blueprints or {}) do
		if bp.id == blueprintId then
			return bp.grid
		end
	end
	return site.grid
end

function Sites.stageEntries(site)
	if not site.grid or not site.stage then
		return {}
	end
	local out = {}
	local entries = Sites.layout(site.grid)
	-- floors whose deck is in the starting stage get their concrete too,
	-- except the newest decked floor (still being worked on)
	local topDeck = 0
	for _, e in ipairs(entries) do
		if e.phase == "deck" and site.stage(e) then
			topDeck = math.max(topDeck, e.level)
		end
	end
	for _, e in ipairs(entries) do
		if e.phase == "slab" then
			if e.level < topDeck then
				table.insert(out, e)
			end
		elseif site.stage(e) then
			table.insert(out, e)
		end
	end
	return out
end

function Sites.boundsStuds(site)
	local half = site.lotM * S / 2
	return V(-half.X, -50, -half.Z), V(half.X, 2000, half.Z)
end

---------------------------------------------------------------------------
-- Preview models (menu ViewportFrames). One proxy per component, decks merged
-- per bay so even the tower previews stay light.
---------------------------------------------------------------------------

local STYLE_GROUND = {
	Rural = Color3.fromRGB(118, 104, 84),
	Suburban = Color3.fromRGB(104, 112, 86),
	Downtown = Color3.fromRGB(96, 96, 98),
	Waterfront = Color3.fromRGB(110, 106, 100),
	Industrial = Color3.fromRGB(102, 98, 92),
	CityCenter = Color3.fromRGB(92, 94, 98),
	Residential = Color3.fromRGB(108, 110, 92),
	HighRise = Color3.fromRGB(96, 98, 100),
}

local function previewPart(model, size, cf, color, transparency, material)
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CastShadow = false
	p.Size = size
	p.CFrame = cf
	p.Color = color
	p.Material = material or Enum.Material.SmoothPlastic
	p.Transparency = transparency or 0
	p.Parent = model
	return p
end

function Sites.buildPreview(siteId)
	local site = Sites.get(siteId)
	local model = Instance.new("Model")
	model.Name = "Preview_" .. siteId
	local lot = site.lotM * S
	previewPart(model, V(lot.X, 1, lot.Z), CFrame.new(0, -0.5, 0), STYLE_GROUND[site.style] or Color3.fromRGB(110, 104, 92), 0, Enum.Material.Ground)
	previewPart(model, V(lot.X + 60, 0.6, 40), CFrame.new(0, -0.6, -lot.Z / 2 - 20), Color3.fromRGB(52, 54, 58))
	-- fence line
	for _, sgn in ipairs({ -1, 1 }) do
		previewPart(model, V(lot.X, 6, 0.3), CFrame.new(0, 3, sgn * lot.Z / 2), Color3.fromRGB(60, 80, 64), 0.3)
		previewPart(model, V(0.3, 6, lot.Z), CFrame.new(sgn * lot.X / 2, 3, 0), Color3.fromRGB(60, 80, 64), 0.3)
	end
	-- installed starting stage
	local groups = {}
	for _, e in ipairs(Sites.stageEntries(site)) do
		local def = Registry.get(e.item)
		if def then
			if e.group then
				groups[e.group] = groups[e.group] or { cfs = {}, def = def }
				table.insert(groups[e.group].cfs, e.cf)
			else
				local p = Factory.proxy(def, e.cf)
				p.Parent = model
			end
		end
	end
	for _, g in pairs(groups) do
		local n = #g.cfs
		local first, last = g.cfs[1], g.cfs[n]
		local mid = (first.Position + last.Position) / 2
		local width = (last.Position - first.Position).Magnitude + Config.Geo.DeckWidth * S
		previewPart(model, V(g.def.size.X, 0.4, width), CFrame.new(mid + V(0, 0.2, 0)), Config.Colors.Galvanized)
	end
	-- the unbuilt remainder as a faint outline of the finished building
	if site.grid then
		local grid = site.grid
		local O = grid.originM * S
		local w, dpt = grid.nx * grid.bayX * S, grid.nz * grid.bayZ * S
		local h = grid.floors * grid.floorH * S
		local outline = previewPart(model, V(w, h, dpt), CFrame.new(O.X + w / 2, G.FootingTop * S + h / 2, O.Z + dpt / 2), Config.Colors.Info, 0.88)
		outline.Name = "Outline"
	end
	-- crane silhouette
	local c = site.crane
	local base = c.posM * S
	local H = c.heightM * S
	local yellow = Config.Colors.CraneYellow
	previewPart(model, V(6, H, 6), CFrame.new(base.X, H / 2, base.Z), yellow, 0, Enum.Material.Metal)
	local slew = CFrame.new(base.X, H + 3, base.Z) * CFrame.Angles(0, math.rad(c.slewDeg or 0), 0)
	previewPart(model, V(c.jibM * S, 4, 4), slew * CFrame.new(c.jibM * S / 2, 0, 0), yellow, 0, Enum.Material.Metal)
	previewPart(model, V(c.counterM * S, 4, 5), slew * CFrame.new(-c.counterM * S / 2, 0, 0), yellow, 0, Enum.Material.Metal)
	previewPart(model, V(6, 6, 8), slew * CFrame.new(-c.counterM * S + 3, -2, 0), Color3.fromRGB(150, 150, 146), 0, Enum.Material.Concrete)
	-- trailer bays
	for _, b in ipairs(site.bays) do
		previewPart(model, V(Config.Delivery.BedLength * S, 4, 8), b * CFrame.new(0, 2.5, 0), Color3.fromRGB(70, 74, 80))
	end
	-- neighbours by style
	local rng = Random.new(Util.hashString(siteId))
	local neighbourH = {
		Rural = { 0, 0 },
		Suburban = { 20, 45 },
		Downtown = { 90, 220 },
		Waterfront = { 30, 80 },
		Industrial = { 30, 50 },
		CityCenter = { 150, 330 },
		Residential = { 25, 60 },
		HighRise = { 120, 300 },
	}
	local range = neighbourH[site.style] or { 0, 0 }
	if range[2] > 0 then
		for k = 1, 10 do
			local ang = (k / 10) * math.pi * 2
			local r = math.max(lot.X, lot.Z) / 2 + 60 + rng:NextNumber(0, 60)
			local bh = rng:NextNumber(range[1], range[2])
			local pos = V(math.cos(ang) * r, bh / 2, math.sin(ang) * r)
			if pos.Z > -lot.Z / 2 - 30 or site.style ~= "Waterfront" then
				previewPart(model, V(rng:NextNumber(40, 80), bh, rng:NextNumber(40, 80)), CFrame.new(pos), Color3.fromRGB(120, 124, 130), 0.1)
			end
		end
	end
	if site.style == "Waterfront" then
		previewPart(model, V(lot.X + 400, 0.5, 300), CFrame.new(0, -1, lot.Z / 2 + 150), Color3.fromRGB(40, 70, 88), 0.1, Enum.Material.Glass)
	end
	model.PrimaryPart = model:FindFirstChildWhichIsA("BasePart")
	return model
end

return Sites
