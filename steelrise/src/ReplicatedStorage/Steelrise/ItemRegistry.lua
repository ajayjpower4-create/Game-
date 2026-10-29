-- The reusable item registry behind the catalog, deliveries, placement rules,
-- crane rigging and saves. Every entry here has a working model builder and a
-- defined behaviour; nothing is listed that cannot be delivered and used.
--
-- Units inside definitions are METRES; derived stud values are added by add().
--
-- Kinds:
--   Point   : one plug that seats on a compatible socket (column on footing)
--   Span    : two plugs that seat on two sockets a fixed distance apart (beam)
--   Surface : rests across supports with tagged parts below both ends (deck)
--   Rest    : stands on terrain or any upward surface (footing, props)
--   Tool    : hotbar equipment, never delivered

local Config = require(script.Parent.Config)
local Factory = require(script.Parent.ModelFactory)

local C = Config.Colors
local M = Enum.Material
local G = Config.Geo
local S = Config.S
local V = Vector3.new
local CF = CFrame.new

local Registry = {}
Registry.items = {}
Registry.list = {}

Registry.Categories = {
	"Structural Steel",
	"Concrete & Foundations",
	"Walls & Roofing",
	"Windows & Doors",
	"Scaffolding",
	"Connections & Rigging",
	"Tools",
	"Machinery",
	"Electrical, Plumbing & HVAC",
	"Site Safety",
	"Site Furnishings",
}

Registry.Classes = {
	Installable = "Installable component",
	Equipment = "Functional equipment",
	Decorative = "Decorative prop",
	Tool = "Hand tool",
}

local DIRS = {
	{ name = "+X", v = V(1, 0, 0) },
	{ name = "-X", v = V(-1, 0, 0) },
	{ name = "+Z", v = V(0, 0, 1) },
	{ name = "-Z", v = V(0, 0, -1) },
}

local function look(pos, dir)
	return Factory.lookAlong(pos, dir)
end

local function mToStudsCf(cf)
	local x, y, z, r00, r01, r02, r10, r11, r12, r20, r21, r22 = cf:GetComponents()
	return CFrame.new(x * S, y * S, z * S, r00, r01, r02, r10, r11, r12, r20, r21, r22)
end

local function set(list)
	local t = {}
	for _, v in ipairs(list or {}) do
		t[v] = true
	end
	return t
end

local function add(def)
	assert(def.id and not Registry.items[def.id], "duplicate or missing id " .. tostring(def.id))
	def.class = def.class or "Installable"
	def.tags = set(def.tags)
	def.overlapIgnore = set(def.overlapIgnore)
	def.boundsOffsetM = def.boundsOffsetM or V(0, def.originBottom and def.sizeM.Y / 2 or 0, 0)
	def.size = def.sizeM * S
	def.boundsOffset = def.boundsOffsetM * S
	def.weightClass = def.weightClass or Config.weightClassFor(def.weightKg or 0)
	def.handling = Config.WeightClasses[def.weightClass].label
	def.deliverable = def.class ~= "Tool" and def.deliverable ~= false
	def.fasteners = def.fasteners or {}
	def.minFastenRelease = def.minFastenRelease or math.min(2, #def.fasteners)
	def.rigging = def.rigging or "Bridle"
	def.transport = def.transport or CFrame.new()
	def.rotStep = def.rotStep or 90
	for _, list in ipairs({ def.plugs or {}, def.sockets or {}, def.requireSockets or {} }) do
		for _, s in ipairs(list) do
			s.cfS = mToStudsCf(s.cf)
			if s.accepts then
				s.acceptSet = set(s.accepts)
			end
		end
	end
	def.plugs = def.plugs or {}
	def.sockets = def.sockets or {}
	def.liftPoints = def.liftPoints or { V(0, def.sizeM.Y / 2 + (def.originBottom and def.sizeM.Y / 2 or 0), 0) }
	def.liftPointsS = {}
	for i, p in ipairs(def.liftPoints) do
		def.liftPointsS[i] = p * S
	end
	if def.kind == "Span" and #def.plugs == 2 then
		local a, b = def.plugs[1].cfS.Position, def.plugs[2].cfS.Position
		def.spanVector = b - a
		def.spanLength = (b - a).Magnitude
	end
	Registry.items[def.id] = def
	table.insert(Registry.list, def)
	return def
end

---------------------------------------------------------------------------
-- Steel profiles (metres, kg/m) — AISC W-shapes and HSS
---------------------------------------------------------------------------

local BEAMS = {
	{ name = "W8×18", d = 0.207, bf = 0.133, tf = 0.0084, tw = 0.0058, kgm = 26.8 },
	{ name = "W10×26", d = 0.262, bf = 0.147, tf = 0.0112, tw = 0.0066, kgm = 38.7 },
	{ name = "W12×26", d = 0.310, bf = 0.165, tf = 0.0097, tw = 0.0058, kgm = 38.7 },
	{ name = "W14×22", d = 0.349, bf = 0.127, tf = 0.0085, tw = 0.0058, kgm = 32.7 },
	{ name = "W16×31", d = 0.403, bf = 0.140, tf = 0.0112, tw = 0.0070, kgm = 46.1 },
	{ name = "W18×35", d = 0.450, bf = 0.152, tf = 0.0108, tw = 0.0076, kgm = 52.1 },
	{ name = "W21×44", d = 0.526, bf = 0.165, tf = 0.0114, tw = 0.0089, kgm = 65.5 },
	{ name = "W24×55", d = 0.599, bf = 0.178, tf = 0.0128, tw = 0.0100, kgm = 81.8 },
	{ name = "W27×84", d = 0.678, bf = 0.253, tf = 0.0163, tw = 0.0117, kgm = 125.0 },
	{ name = "W30×99", d = 0.753, bf = 0.266, tf = 0.0170, tw = 0.0132, kgm = 147.0 },
}

local COLUMNS = {
	{ name = "W8×31", d = 0.203, bf = 0.203, tf = 0.0110, tw = 0.0072, kgm = 46.1 },
	{ name = "W10×49", d = 0.253, bf = 0.254, tf = 0.0142, tw = 0.0086, kgm = 72.9 },
	{ name = "W12×65", d = 0.308, bf = 0.305, tf = 0.0154, tw = 0.0099, kgm = 96.7 },
	{ name = "W14×90", d = 0.356, bf = 0.369, tf = 0.0180, tw = 0.0112, kgm = 134.0 },
	{ name = "W14×120", d = 0.368, bf = 0.373, tf = 0.0239, tw = 0.0150, kgm = 179.0 },
}

Registry.BeamProfiles = BEAMS
Registry.ColumnProfiles = COLUMNS

local function fmtLen(m)
	return string.format("%.1f m", m)
end

local function idLen(m)
	return tostring(math.floor(m * 1000 + 0.5))
end

---------------------------------------------------------------------------
-- Columns
---------------------------------------------------------------------------

local function buildColumn(b, def, opts)
	local p, L = def.profile, def.lengthM
	local col = C.PrimerGray
	local bp = def.basePlateM
	local shaftLen = L - 0.025 - 0.012
	b:wShape("Shaft", shaftLen, { d = p.d, bf = p.bf, tf = p.tf, tw = p.tw, axis = "Y" }, CF(0, -L / 2 + 0.025 + shaftLen / 2, 0), col)
	b:box("BasePlate", V(bp, 0.025, bp), CF(0, -L / 2 + 0.0125, 0), C.MillSteel)
	b:box("CapPlate", V(p.d + 0.02, 0.012, p.bf + 0.02), CF(0, L / 2 - 0.006, 0), col)
	local r = G.SeatOffset
	local tabH = 0.24
	local tabY = L / 2 - 0.08 - tabH / 2
	for _, sx in ipairs({ 1, -1 }) do
		local x0, x1 = p.d / 2, r + 0.07
		b:box("ShearTab", V(x1 - x0, tabH, 0.01), CF(sx * (x0 + x1) / 2, tabY, 0.009), col, nil, { nc = true })
	end
	for _, sz in ipairs({ 1, -1 }) do
		local z0, z1 = p.tw / 2, r + 0.07
		b:box("ShearTab", V(0.01, tabH, z1 - z0), CF(0.009, tabY, sz * (z0 + z1) / 2), col, nil, { nc = true })
	end
	if not opts.installed then
		b:box("LiftLug", V(0.02, 0.12, 0.14), CF(0, L / 2 + 0.06, 0), C.MillSteel, nil, { nc = true })
	end
	b:stencil(CF(p.d / 2 + 0.001, -L / 2 + 0.9, 0) * CFrame.Angles(0, math.pi / 2, 0), 0.16, 0.05)
end

local function columnSockets(L)
	local sockets = {
		{ type = "ColumnTop", cf = CF(0, L / 2, 0) },
	}
	for _, d in ipairs(DIRS) do
		table.insert(sockets, { type = "BeamSeat", cf = look(V(0, L / 2, 0) + d.v * G.SeatOffset, d.v) })
		table.insert(sockets, { type = "GussetMount", cf = look(V(0, -L / 2 + G.GussetLow, 0) + d.v * G.SeatOffset, d.v) })
		table.insert(sockets, { type = "GussetMount", cf = look(V(0, L / 2 - G.GussetHighFromTop, 0) + d.v * G.SeatOffset, d.v) })
		table.insert(sockets, { type = "CladSeat", multi = true, cf = look(V(0, -L / 2, 0) + d.v * G.CladOffset, d.v) })
		table.insert(sockets, { type = "ParapetSeat", multi = true, cf = look(V(0, L / 2 + G.SlabTop, 0) + d.v * G.CladOffset, d.v) })
	end
	-- partitions stand on the finished floor along the grid lines
	table.insert(sockets, { type = "PartitionSeat", multi = true, cf = CF(0, -L / 2 + G.SlabTop, 0) })
	return sockets
end

for _, prof in ipairs(COLUMNS) do
	for _, L in ipairs(Config.FloorHeights) do
		local bp = math.max(prof.d, prof.bf) + 0.15
		local a = bp / 2 - 0.06
		add({
			id = "COL-" .. prof.name:gsub("×", "x") .. "-" .. idLen(L),
			name = "Steel Column " .. prof.name .. " — " .. fmtLen(L),
			category = "Structural Steel",
			kind = "Point",
			tags = { "Column", "Steel", "Structural" },
			profile = prof,
			lengthM = L,
			basePlateM = bp,
			weightKg = prof.kgm * L + 25,
			sizeM = V(bp, L, bp),
			description = string.format(
				"Wide-flange column for a %.1f m storey. Seats on a footing or splices onto the column below; shop-welded shear tabs take beams on all four faces. Lifted by its top lug so it hangs plumb.",
				L
			),
			build = buildColumn,
			plugs = { { type = "ColumnBottom", accepts = { "FootingTop", "ColumnTop" }, cf = CF(0, -L / 2, 0) } },
			sockets = columnSockets(L),
			fasteners = {
				{ type = "Bolt", pos = V(a, -L / 2 + 0.04, a), normal = V(0, 1, 0) },
				{ type = "Bolt", pos = V(-a, -L / 2 + 0.04, a), normal = V(0, 1, 0) },
				{ type = "Bolt", pos = V(a, -L / 2 + 0.04, -a), normal = V(0, 1, 0) },
				{ type = "Bolt", pos = V(-a, -L / 2 + 0.04, -a), normal = V(0, 1, 0) },
			},
			minFastenRelease = 4,
			liftPoints = { V(0, L / 2 + 0.1, 0) },
			rigging = "Upright",
			transport = CFrame.Angles(0, 0, math.pi / 2),
			proxyColor = C.PrimerGray,
		})
	end
end

---------------------------------------------------------------------------
-- Beams
---------------------------------------------------------------------------

local function buildBeam(b, def)
	local p, len = def.profile, def.lengthM
	b:wShape("Beam", len, { d = p.d, bf = p.bf, tf = p.tf, tw = p.tw }, CF(), C.PrimerGray)
	b:stencil(CF(len / 2 - 0.6, 0, -p.tw / 2 - 0.001), 0.18, 0.05)
end

for _, prof in ipairs(BEAMS) do
	for _, bay in ipairs(Config.Bays) do
		local len = bay - 2 * G.SeatOffset
		local n = prof.d > 0.45 and 4 or 3
		local fasteners = {}
		for _, sx in ipairs({ -1, 1 }) do
			for k = 0, n - 1 do
				table.insert(fasteners, {
					type = "Bolt",
					pos = V(sx * (len / 2 - 0.045), (k - (n - 1) / 2) * 0.075, -(prof.tw / 2 + 0.012)),
					normal = V(0, 0, -1),
				})
			end
		end
		add({
			id = "BM-" .. prof.name:gsub("×", "x") .. "-" .. idLen(bay),
			name = "Steel Beam " .. prof.name .. " — " .. fmtLen(bay) .. " bay",
			category = "Structural Steel",
			kind = "Span",
			tags = { "Beam", "Steel", "Structural" },
			profile = prof,
			lengthM = len,
			bayM = bay,
			weightKg = prof.kgm * len,
			sizeM = V(len, prof.d, prof.bf),
			description = string.format(
				"%s floor beam for a %.1f m column-to-column bay (%.2f m cut length). Bolts to the column shear tabs at both ends; deck spans between parallel beams.",
				prof.name,
				bay,
				len
			),
			build = buildBeam,
			plugs = {
				{ type = "BeamEnd", accepts = { "BeamSeat" }, cf = CF(-len / 2, prof.d / 2, 0) },
				{ type = "BeamEnd", accepts = { "BeamSeat" }, cf = CF(len / 2, prof.d / 2, 0) },
			},
			fasteners = fasteners,
			minFastenRelease = 2,
			liftPoints = { V(-len / 4, prof.d / 2, 0), V(len / 4, prof.d / 2, 0) },
			rigging = "Bridle",
			symmetric180 = true,
			proxyColor = C.PrimerGray,
		})
	end
end

---------------------------------------------------------------------------
-- Gusset plate and braces
---------------------------------------------------------------------------

add({
	id = "CON-GUSSET-350",
	name = "Brace Gusset Plate 350 mm",
	category = "Connections & Rigging",
	kind = "Point",
	tags = { "Plate", "Steel", "Connection" },
	weightKg = 17,
	sizeM = V(0.12, 0.32, 0.36),
	boundsOffsetM = V(0, 0, -0.18),
	description = "Shop-cut gusset with a bolted clip angle. Bolts to a column gusset mount and provides the seat a diagonal brace connects to.",
	build = function(b)
		b:box("Plate", V(0.016, 0.32, 0.36), CF(0, 0, -0.18), C.PrimerGray)
		b:box("ClipA", V(0.12, 0.28, 0.01), CF(0, 0, -0.005), C.PrimerGray)
		b:box("ClipB", V(0.01, 0.28, 0.06), CF(0.013, 0, -0.03), C.PrimerGray, nil, { nc = true })
	end,
	plugs = { { type = "GussetBack", accepts = { "GussetMount" }, cf = CF() } },
	sockets = { { type = "BraceSeat", cf = look(V(0, 0, -G.GussetTip), V(0, 0, -1)) } },
	fasteners = {
		{ type = "Bolt", pos = V(0.04, 0.08, -0.016), normal = V(0, 0, -1) },
		{ type = "Bolt", pos = V(0.04, -0.08, -0.016), normal = V(0, 0, -1) },
		{ type = "Bolt", pos = V(-0.04, 0.08, -0.016), normal = V(0, 0, -1) },
		{ type = "Bolt", pos = V(-0.04, -0.08, -0.016), normal = V(0, 0, -1) },
	},
	minFastenRelease = 0,
	rotStep = 360,
	transport = CFrame.Angles(math.pi / 2, 0, 0),
	proxyColor = C.PrimerGray,
})

for _, bay in ipairs(Config.Bays) do
	for _, L in ipairs(Config.FloorHeights) do
		local horiz = bay - 2 * (G.SeatOffset + G.GussetTip)
		local vert = L - G.GussetLow - G.GussetHighFromTop
		local Lb = math.sqrt(horiz * horiz + vert * vert)
		local w = 0.102
		add({
			id = "BR-HSS4-" .. idLen(bay) .. "-" .. idLen(L),
			name = "Diagonal Brace HSS 4×4 — " .. fmtLen(bay) .. " × " .. fmtLen(L),
			category = "Structural Steel",
			kind = "Span",
			tags = { "Brace", "Steel", "Structural" },
			lengthM = Lb,
			pitch = math.atan2(vert, horiz),
			weightKg = 17.3 * Lb,
			sizeM = V(Lb + 0.24, w, w + 0.04),
			description = string.format(
				"Square HSS diagonal with slotted knife plates for a %.1f m bay and %.1f m storey. Runs from a low gusset on one column to a high gusset on the next.",
				bay,
				L
			),
			build = function(b2)
				b2:hss("Tube", Lb - 0.6, w, 0.0064, CF(), C.PrimerGray)
				for _, sx in ipairs({ -1, 1 }) do
					b2:box("KnifePlate", V(0.42, 0.09, 0.016), CF(sx * (Lb / 2 - 0.09), 0, 0.016), C.PrimerGray)
					b2:box("EndCap", V(0.01, w, w), CF(sx * (Lb / 2 - 0.3), 0, 0), C.PrimerGray, nil, { nc = true })
				end
			end,
			plugs = {
				{ type = "BraceEnd", accepts = { "BraceSeat" }, cf = CF(-Lb / 2, 0, 0) },
				{ type = "BraceEnd", accepts = { "BraceSeat" }, cf = CF(Lb / 2, 0, 0) },
			},
			fasteners = {
				{ type = "Bolt", pos = V(-Lb / 2 + 0.02, 0, 0.034), normal = V(0, 0, 1) },
				{ type = "Bolt", pos = V(-Lb / 2 + 0.1, 0, 0.034), normal = V(0, 0, 1) },
				{ type = "Bolt", pos = V(Lb / 2 - 0.02, 0, 0.034), normal = V(0, 0, 1) },
				{ type = "Bolt", pos = V(Lb / 2 - 0.1, 0, 0.034), normal = V(0, 0, 1) },
			},
			minFastenRelease = 2,
			liftPoints = { V(-Lb / 4, w / 2, 0), V(Lb / 4, w / 2, 0) },
			rigging = "Pitch",
			symmetric180 = false,
			proxyColor = C.PrimerGray,
		})
	end
end

---------------------------------------------------------------------------
-- Metal deck and floor plate (Surface)
---------------------------------------------------------------------------

for _, bay in ipairs(Config.Bays) do
	local W = G.DeckWidth
	add({
		id = "DK-15B-" .. idLen(bay),
		name = "Composite Metal Deck 1.5\" — " .. fmtLen(bay),
		category = "Structural Steel",
		kind = "Surface",
		originBottom = true,
		tags = { "Deck", "Steel", "Floor" },
		overlapIgnore = { "Column" },
		weightKg = 10 * W * bay,
		sizeM = V(bay, G.DeckDepth, W),
		description = string.format(
			"Galvanised 1.5\" fluted deck sheet, %.2f m cover width, spanning %.1f m between two parallel beams. Puddle-welded to the beam flanges.",
			W,
			bay
		),
		build = function(b)
			b:box("TopSheet", V(bay, 0.012, W), CF(0, G.DeckDepth - 0.006, 0), C.Galvanized)
			for k = -2, 2 do
				b:box("Rib", V(bay, G.DeckDepth - 0.012, 0.05), CF(0, (G.DeckDepth - 0.012) / 2, k * 0.15), C.Galvanized, nil, { ns = true })
			end
		end,
		surface = { supportTags = { Beam = true }, tile = W },
		fasteners = {
			{ type = "Weld", pos = V(-bay / 2 + 0.1, G.DeckDepth, 0.2), normal = V(0, 1, 0) },
			{ type = "Weld", pos = V(-bay / 2 + 0.1, G.DeckDepth, -0.2), normal = V(0, 1, 0) },
			{ type = "Weld", pos = V(bay / 2 - 0.1, G.DeckDepth, 0.2), normal = V(0, 1, 0) },
			{ type = "Weld", pos = V(bay / 2 - 0.1, G.DeckDepth, -0.2), normal = V(0, 1, 0) },
		},
		minFastenRelease = 0,
		liftPoints = { V(-bay / 4, G.DeckDepth, 0), V(bay / 4, G.DeckDepth, 0) },
		proxyColor = C.Galvanized,
	})
	add({
		id = "PL-CHK8-" .. idLen(bay),
		name = "Checker Floor Plate 8 mm — " .. fmtLen(bay),
		category = "Structural Steel",
		kind = "Surface",
		originBottom = true,
		tags = { "Plate", "Steel", "Floor" },
		overlapIgnore = { "Column" },
		weightKg = 63 * W * bay,
		sizeM = V(bay, 0.05, W),
		description = string.format(
			"8 mm raised-pattern steel plate with two flat-bar stiffeners, %.1f m long. Welded across beams for walkways, platforms and plant decks.",
			bay
		),
		build = function(b)
			b:box("Plate", V(bay, 0.008, W), CF(0, 0.046, 0), C.SteelDark, M.DiamondPlate)
			b:box("Stiffener", V(bay - 0.3, 0.042, 0.01), CF(0, 0.021, 0.2), C.SteelDark, nil, { ns = true })
			b:box("Stiffener", V(bay - 0.3, 0.042, 0.01), CF(0, 0.021, -0.2), C.SteelDark, nil, { ns = true })
			b:box("Bearer", V(0.06, 0.042, W), CF(-bay / 2 + 0.03, 0.021, 0), C.SteelDark, nil, { ns = true })
			b:box("Bearer", V(0.06, 0.042, W), CF(bay / 2 - 0.03, 0.021, 0), C.SteelDark, nil, { ns = true })
		end,
		surface = { supportTags = { Beam = true }, tile = W },
		fasteners = {
			{ type = "Weld", pos = V(-bay / 2 + 0.06, 0.05, 0.25), normal = V(0, 1, 0) },
			{ type = "Weld", pos = V(-bay / 2 + 0.06, 0.05, -0.25), normal = V(0, 1, 0) },
			{ type = "Weld", pos = V(bay / 2 - 0.06, 0.05, 0.25), normal = V(0, 1, 0) },
			{ type = "Weld", pos = V(bay / 2 - 0.06, 0.05, -0.25), normal = V(0, 1, 0) },
		},
		minFastenRelease = 2,
		liftPoints = { V(-bay / 4, 0.05, 0), V(bay / 4, 0.05, 0) },
		proxyColor = C.SteelDark,
	})
end

---------------------------------------------------------------------------
-- Wall panels and curtain wall (Span with face normal)
---------------------------------------------------------------------------

local function panelFasteners(bay, H)
	return {
		{ type = "Bolt", pos = V(-bay / 2 + 0.2, 0.25, -0.02), normal = V(0, 0, -1) },
		{ type = "Bolt", pos = V(bay / 2 - 0.2, 0.25, -0.02), normal = V(0, 0, -1) },
		{ type = "Bolt", pos = V(-bay / 2 + 0.2, H - 0.25, -0.02), normal = V(0, 0, -1) },
		{ type = "Bolt", pos = V(bay / 2 - 0.2, H - 0.25, -0.02), normal = V(0, 0, -1) },
	}
end

local function panelPlugs(bay)
	return {
		{ type = "CladEnd", accepts = { "CladSeat" }, cf = CF(-bay / 2, 0, 0) },
		{ type = "CladEnd", accepts = { "CladSeat" }, cf = CF(bay / 2, 0, 0) },
	}
end

for _, bay in ipairs(Config.Bays) do
	for _, H in ipairs(Config.FloorHeights) do
		local w = bay - 0.02
		local h = H - 0.02
		add({
			id = "WP-IMP-" .. idLen(bay) .. "-" .. idLen(H),
			name = "Insulated Metal Wall Panel — " .. fmtLen(bay) .. " × " .. fmtLen(H),
			category = "Walls & Roofing",
			kind = "Span",
			faceNormal = true,
			tags = { "WallPanel", "Facade" },
			weightKg = 15 * bay * H,
			sizeM = V(w, h, 0.12),
			boundsOffsetM = V(0, H / 2, 0.06),
			description = "Factory-assembled insulated metal panel unit with vertical rib profile. Hangs on the outside face of two columns and bolts back through clip angles.",
			build = function(b)
				b:box("Skin", V(w, h, 0.08), CF(0, H / 2, 0.04), Color3.fromRGB(184, 189, 193))
				local n = math.floor(w / 1.0)
				for k = 0, n do
					local x = -w / 2 + 0.1 + k * (w - 0.2) / math.max(n, 1)
					b:box("Rib", V(0.035, h, 0.025), CF(x, H / 2, 0.0925), Color3.fromRGB(176, 181, 186), nil, { ns = true, nc = true })
				end
				b:box("Flashing", V(w, 0.05, 0.12), CF(0, H - 0.035, 0.06), C.SteelDark, nil, { nc = true })
				b:box("Sill", V(w, 0.05, 0.12), CF(0, 0.035, 0.06), C.SteelDark, nil, { nc = true })
			end,
			plugs = panelPlugs(bay),
			fasteners = panelFasteners(bay, H),
			minFastenRelease = 2,
			liftPoints = { V(-bay / 4, H, 0.06), V(bay / 4, H, 0.06) },
			rigging = "Bridle",
			proxyColor = Color3.fromRGB(184, 189, 193),
		})
		add({
			id = "CW-UNIT-" .. idLen(bay) .. "-" .. idLen(H),
			name = "Curtain Wall Unit (glazed) — " .. fmtLen(bay) .. " × " .. fmtLen(H),
			category = "Windows & Doors",
			kind = "Span",
			faceNormal = true,
			tags = { "Window", "Facade" },
			weightKg = 36 * bay * H,
			sizeM = V(w, h, 0.15),
			boundsOffsetM = V(0, H / 2, 0.075),
			description = "Unitised aluminium curtain wall with insulated vision glass and a dark spandrel at the slab edge. Hung from two columns and bolted back from inside.",
			build = function(b)
				local alu = Color3.fromRGB(58, 62, 66)
				b:box("Spandrel", V(w - 0.04, 0.9, 0.03), CF(0, 0.47, 0.06), Color3.fromRGB(34, 38, 42), M.Glass, { refl = 0.1 })
				local glass = b:box("Vision", V(w - 0.04, h - 0.96, 0.024), CF(0, 0.92 + (h - 0.96) / 2, 0.075), C.Glass, M.Glass, { tr = 0.45, refl = 0.15 })
				glass.CastShadow = false
				local n = math.max(1, math.floor(w / 1.5 + 0.5))
				for k = 0, n do
					local x = -w / 2 + 0.03 + k * (w - 0.06) / n
					b:box("Mullion", V(0.06, h, 0.15), CF(x, H / 2, 0.075), alu)
				end
				b:box("Head", V(w, 0.08, 0.15), CF(0, H - 0.05, 0.075), alu)
				b:box("Transom", V(w, 0.06, 0.15), CF(0, 0.92, 0.075), alu)
				b:box("SillFrame", V(w, 0.08, 0.15), CF(0, 0.05, 0.075), alu)
			end,
			plugs = panelPlugs(bay),
			fasteners = panelFasteners(bay, H),
			minFastenRelease = 2,
			liftPoints = { V(-bay / 4, H, 0.075), V(bay / 4, H, 0.075) },
			rigging = "Bridle",
			proxyColor = C.Glass,
		})
	end
end

---------------------------------------------------------------------------
-- Footings
---------------------------------------------------------------------------

for _, size in ipairs({ 1.5, 2.0, 2.5, 3.0 }) do
	add({
		id = "FT-PRECAST-" .. idLen(size),
		name = string.format("Precast Pad Footing %.1f m with Anchor Rods", size),
		category = "Concrete & Foundations",
		kind = "Rest",
		originBottom = true,
		tags = { "Footing", "Concrete", "Structural" },
		rest = { terrainOnly = true, grid = Config.Grid.Ground },
		weightKg = 2400 * (size * size * 0.45 + 0.55 * 0.55 * 0.35),
		sizeM = V(size, G.FootingTop, size),
		description = string.format(
			"Precast %.1f m pad with a pedestal and four cast-in anchor rods. Set on prepared grade; columns seat on its top and are bolted down with anchor nuts.",
			size
		),
		build = function(b, def)
			local tint = Color3.fromRGB(170, 167, 160)
			b:box("Pad", V(size, 0.45, size), CF(0, 0.225, 0), tint, M.Concrete)
			b:box("Pedestal", V(0.55, 0.35, 0.55), CF(0, 0.45 + 0.175, 0), Color3.fromRGB(160, 157, 150), M.Concrete)
			b:box("Grout", V(0.5, 0.012, 0.5), CF(0, G.FootingTop - 0.006, 0), Color3.fromRGB(120, 118, 112), M.Concrete, { nc = true })
			for _, sx in ipairs({ 1, -1 }) do
				for _, sz in ipairs({ 1, -1 }) do
					b:cylY("AnchorRod", 0.14, 0.025, V(sx * 0.2, G.FootingTop + 0.06, sz * 0.2), C.MillSteel, M.Metal, { nc = true, ns = true })
				end
				b:box("LiftLoop", V(0.03, 0.08, 0.16), CF(sx * (size / 2 - 0.2), 0.49, 0), C.MillSteel, M.Metal, { nc = true, ns = true })
			end
		end,
		sockets = { { type = "FootingTop", cf = CF(0, G.FootingTop, 0) } },
		liftPoints = { V(-(size / 2 - 0.2), 0.5, 0), V(size / 2 - 0.2, 0.5, 0) },
		rigging = "Bridle",
		proxyColor = C.Concrete,
	})
end

---------------------------------------------------------------------------
-- Scaffolding (modular ring-lock)
---------------------------------------------------------------------------

local GALV = C.Galvanized
local TUBE = 0.048

add({
	id = "SC-BASEJACK",
	name = "Scaffold Base Jack 0.3 m",
	category = "Scaffolding",
	kind = "Rest",
	originBottom = true,
	tags = { "Scaffold" },
	rest = { grid = 0.05, lattice = true },
	weightKg = 5.5,
	sizeM = V(0.15, G.ScaffoldJack, 0.15),
	description = "Adjustable screw jack with a 150 mm base plate. Every scaffold starts here; snaps to the bay lattice of nearby jacks.",
	build = function(b)
		b:box("BasePlate", V(0.15, 0.008, 0.15), CF(0, 0.004, 0), GALV)
		b:cylY("Screw", G.ScaffoldJack - 0.008, 0.034, V(0, 0.008 + (G.ScaffoldJack - 0.008) / 2, 0), C.SteelDark, M.Metal, { ns = true })
		b:cylY("Nut", 0.03, 0.07, V(0, G.ScaffoldJack - 0.06, 0), Color3.fromRGB(200, 70, 40), M.Metal, { ns = true, nc = true })
	end,
	sockets = { { type = "ScafNode", cf = CF(0, G.ScaffoldJack, 0) } },
	rotStep = 360,
	transport = CFrame.Angles(0, 0, math.pi / 2),
	proxyColor = GALV,
})

for _, H in ipairs({ 2.0, 1.0, 0.5, 1.5, 3.0 }) do
	local rosettes = {}
	local sockets = { { type = "ScafStdTop", cf = CF(0, H, 0) } }
	for k = 1, math.floor(H / 0.5 + 0.5) do
		local y = k * 0.5
		table.insert(rosettes, y)
		table.insert(sockets, { type = "ScafRosette", multi = true, cf = CF(0, y, 0) })
	end
	add({
		id = "SC-STD-" .. idLen(H),
		name = string.format("Scaffold Upright %.1f m", H),
		category = "Scaffolding",
		kind = "Point",
		originBottom = true,
		tags = { "Scaffold", "ScaffoldUpright" },
		weightKg = 5.5 * H,
		sizeM = V(0.12, H, 0.12),
		description = "Galvanised standard with rosettes every 0.5 m and a spigot. Seats on a base jack or on top of another upright.",
		build = function(b)
			b:cylY("Tube", H, TUBE, V(0, H / 2, 0), GALV)
			b:cylY("Spigot", 0.22, 0.038, V(0, H + 0.11, 0), GALV, M.Metal, { nc = true, ns = true })
			for _, y in ipairs(rosettes) do
				b:cylY("Rosette", 0.01, 0.124, V(0, y, 0), GALV, M.Metal, { nc = true, ns = true })
			end
		end,
		plugs = { { type = "ScafStdBottom", accepts = { "ScafNode", "ScafStdTop" }, cf = CF() } },
		sockets = sockets,
		rotStep = 360,
		transport = CFrame.Angles(0, 0, math.pi / 2),
		proxyColor = GALV,
	})
end

local function ledgerDef(id, name, len, plugType, extraDesc, buildExtra, tags)
	local wedge = plugType == "ScafLedgerEnd"
	return add({
		id = id,
		name = name,
		category = "Scaffolding",
		kind = "Span",
		tags = tags or { "Scaffold", "ScaffoldLedger" },
		weightKg = 3.6 * len + 0.6,
		sizeM = V(len - 0.1, 0.06, 0.06),
		description = extraDesc,
		build = function(b)
			b:cylX("Tube", len - 0.1, TUBE, CF(), GALV)
			for _, sx in ipairs({ -1, 1 }) do
				b:box("Head", V(0.06, 0.08, 0.05), CF(sx * (len / 2 - 0.04), 0, 0), GALV, M.Metal, { nc = true, ns = true })
			end
			if buildExtra then
				buildExtra(b, len)
			end
		end,
		plugs = {
			{ type = plugType, accepts = { "ScafRosette" }, cf = CF(-len / 2, 0, 0) },
			{ type = plugType, accepts = { "ScafRosette" }, cf = CF(len / 2, 0, 0) },
		},
		fasteners = wedge and {
			{ type = "Wedge", pos = V(-len / 2 + 0.035, 0.07, 0), normal = V(0, 1, 0) },
			{ type = "Wedge", pos = V(len / 2 - 0.035, 0.07, 0), normal = V(0, 1, 0) },
		} or {},
		minFastenRelease = 0,
		symmetric180 = true,
		transport = CFrame.new(),
		proxyColor = GALV,
	})
end

ledgerDef("SC-LEDGER-2570", "Scaffold Ledger 2.57 m", G.ScaffoldBayLong, "ScafLedgerEnd",
	"Horizontal ledger for the long side of a bay. Wedge heads drop into the rosettes and are hammered tight; also used as guardrails at 0.5 m and 1.0 m above a platform.")
ledgerDef("SC-LEDGER-1090", "Scaffold Ledger 1.09 m", G.ScaffoldBayShort, "ScafLedgerEnd",
	"Short transom ledger across the width of a bay. Carries platform ends; doubles as an end guardrail.")
ledgerDef("SC-TOE-2570", "Scaffold Toe Board 2.57 m", G.ScaffoldBayLong, "ScafToeEnd",
	"Timber toe board that clips between two uprights at platform level to stop tools and fittings falling.",
	function(b, len)
		b:box("Board", V(len - 0.1, 0.15, 0.025), CF(0, 0.135, 0), Color3.fromRGB(176, 140, 92), M.WoodPlanks)
	end, { "Scaffold", "ScaffoldToeBoard" })
ledgerDef("SC-TOE-1090", "Scaffold Toe Board 1.09 m", G.ScaffoldBayShort, "ScafToeEnd",
	"Short timber toe board for the end of a bay.",
	function(b, len)
		b:box("Board", V(len - 0.1, 0.15, 0.025), CF(0, 0.135, 0), Color3.fromRGB(176, 140, 92), M.WoodPlanks)
	end, { "Scaffold", "ScaffoldToeBoard" })

-- the other standard ring-lock bay lengths
for _, len in ipairs({ 0.73, 1.57, 2.07, 3.07 }) do
	local tag = tostring(math.floor(len * 1000 + 0.5))
	ledgerDef("SC-LEDGER-" .. tag, string.format("Scaffold Ledger %.2f m", len), len, "ScafLedgerEnd",
		string.format("Horizontal ring-lock ledger for a %.2f m bay; wedges hammered into the rosettes.", len))
	ledgerDef("SC-TOE-" .. tag, string.format("Scaffold Toe Board %.2f m", len), len, "ScafToeEnd",
		string.format("Timber toe board for a %.2f m bay edge.", len),
		function(b, l)
			b:box("Board", V(l - 0.1, 0.15, 0.025), CF(0, 0.135, 0), Color3.fromRGB(176, 140, 92), M.WoodPlanks)
		end, { "Scaffold", "ScaffoldToeBoard" })
end

for _, spec in ipairs({ { G.ScaffoldBayLong, "2570" }, { G.ScaffoldBayShort, "1090" }, { 2.07, "2070" }, { 3.07, "3070" } }) do
	local bay, tag = spec[1], spec[2]
	local Ld = math.sqrt(bay * bay + G.ScaffoldLift * G.ScaffoldLift)
	add({
		id = "SC-DIAG-" .. tag,
		name = string.format("Scaffold Diagonal Brace %.2f × 2.0 m", bay),
		category = "Scaffolding",
		kind = "Span",
		tags = { "Scaffold", "ScaffoldBrace" },
		weightKg = 3.4 * Ld,
		sizeM = V(Ld - 0.1, 0.06, 0.06),
		pitch = math.atan2(G.ScaffoldLift, bay),
		description = "Diagonal that stiffens a bay face, running from a rosette on one upright to the rosette 2.0 m higher on the next.",
		build = function(b)
			b:cylX("Tube", Ld - 0.1, TUBE, CF(), GALV)
			for _, sx in ipairs({ -1, 1 }) do
				b:box("Head", V(0.07, 0.06, 0.05), CF(sx * (Ld / 2 - 0.04), 0, 0), GALV, M.Metal, { nc = true, ns = true })
			end
		end,
		plugs = {
			{ type = "ScafDiagEnd", accepts = { "ScafRosette" }, cf = CF(-Ld / 2, 0, 0) },
			{ type = "ScafDiagEnd", accepts = { "ScafRosette" }, cf = CF(Ld / 2, 0, 0) },
		},
		fasteners = {
			{ type = "Wedge", pos = V(-Ld / 2 + 0.04, 0.06, 0), normal = V(0, 1, 0) },
			{ type = "Wedge", pos = V(Ld / 2 - 0.04, 0.06, 0), normal = V(0, 1, 0) },
		},
		minFastenRelease = 0,
		rigging = "Pitch",
		proxyColor = GALV,
	})
end

for _, spec in ipairs({ { G.ScaffoldBayLong, G.ScaffoldBayShort, "2570" }, { G.ScaffoldBayShort, G.ScaffoldBayShort, "1090" }, { 2.07, G.ScaffoldBayShort, "2070" }, { 3.07, G.ScaffoldBayShort, "3070" } }) do
	local a, w, tag = spec[1], spec[2], spec[3]
	local planks = math.max(1, math.floor((w - 0.05) / 0.32))
	local deckW = planks * 0.32
	add({
		id = "SC-DECK-" .. tag,
		name = string.format("Scaffold Platform Deck %.2f × %.2f m", a, w),
		category = "Scaffolding",
		kind = "Span",
		tags = { "Scaffold", "ScaffoldDeck" },
		weightKg = 19 * planks * a / 2.57,
		sizeM = V(a - 0.08, 0.05, deckW),
		boundsOffsetM = V(0, 0.055, 0),
		description = "Steel plank platform that hooks over the ledgers of a complete bay. Needs an upright at all four corners. Walkable working level.",
		build = function(b)
			for k = 1, planks do
				local z = -deckW / 2 + 0.16 + (k - 1) * 0.32
				b:box("Plank", V(a - 0.08, 0.05, 0.31), CF(0, 0.055, z), GALV, M.DiamondPlate)
			end
			for _, sx in ipairs({ -1, 1 }) do
				b:box("Hook", V(0.04, 0.03, deckW), CF(sx * (a / 2 - 0.05), 0.035, 0), GALV, M.Metal, { nc = true, ns = true })
			end
		end,
		plugs = {
			{ type = "ScafDeckCorner", accepts = { "ScafRosette" }, cf = CF(-a / 2, 0, -w / 2) },
			{ type = "ScafDeckCorner", accepts = { "ScafRosette" }, cf = CF(a / 2, 0, w / 2) },
		},
		requireSockets = {
			{ type = "ScafRosette", cf = CF(a / 2, 0, -w / 2) },
			{ type = "ScafRosette", cf = CF(-a / 2, 0, w / 2) },
		},
		minFastenRelease = 0,
		symmetric180 = true,
		proxyColor = GALV,
	})
end

add({
	id = "SC-LADDER-27",
	name = "Scaffold Access Ladder 2.7 m",
	category = "Scaffolding",
	kind = "Rest",
	originBottom = true,
	tags = { "Scaffold", "Ladder" },
	rest = { grid = 0.05 },
	allowFree = true,
	weightKg = 12,
	sizeM = V(0.5, 8 / S, 0.08),
	description = "Aluminium access ladder. Stand it against the outside of a scaffold bay (leave the guardrail open there) to climb between lifts.",
	build = function(b)
		local H = 8 / S
		local alu = Color3.fromRGB(196, 199, 202)
		b:box("RailL", V(0.05, H, 0.07), CF(-0.22, H / 2, 0), alu)
		b:box("RailR", V(0.05, H, 0.07), CF(0.22, H / 2, 0), alu)
		local y = 0.25
		while y < H - 0.1 do
			b:cylX("Rung", 0.4, 0.03, CF(0, y, 0), alu, M.Metal, { nc = true, ns = true })
			y = y + 0.28
		end
		local truss = Instance.new("TrussPart")
		truss.Name = "ClimbTruss"
		truss.Size = Vector3.new(2, 8, 2)
		truss.CFrame = CFrame.new(0, 4, 0)
		truss.Transparency = 1
		truss.Anchored = true
		truss.CanQuery = false
		truss.CanTouch = true
		truss.CastShadow = false
		truss.Style = Enum.Style.NoSupports
		truss.Parent = b.model
	end,
	rotStep = 90,
	transport = CFrame.Angles(0, 0, math.pi / 2),
	proxyColor = Color3.fromRGB(196, 199, 202),
})

---------------------------------------------------------------------------
-- Connections & rigging equipment
---------------------------------------------------------------------------

add({
	id = "RG-SPREADER-4",
	name = "Spreader Bar 4 m",
	category = "Connections & Rigging",
	class = "Equipment",
	kind = "Rest",
	originBottom = true,
	tags = { "Rigging" },
	rest = { grid = 0.1 },
	allowFree = true,
	weightKg = 180,
	sizeM = V(4.0, 0.3, 0.25),
	description = "Fabricated spreader beam with end lugs. Stored on site for long or flexible lifts; place it in the laydown area.",
	build = function(b)
		b:hss("Bar", 3.8, 0.2, 0.01, CF(0, 0.2, 0), C.CraneYellow)
		for _, sx in ipairs({ -1, 1 }) do
			b:box("Lug", V(0.12, 0.12, 0.03), CF(sx * 1.9, 0.33, 0), C.CraneYellow)
			b:box("Foot", V(0.1, 0.1, 0.25), CF(sx * 1.6, 0.05, 0), C.Timber, M.Wood)
		end
	end,
	proxyColor = C.CraneYellow,
})

add({
	id = "RG-BOLTCRATE",
	name = "Structural Bolt Crate (A325, pallet)",
	category = "Connections & Rigging",
	class = "Equipment",
	kind = "Rest",
	originBottom = true,
	tags = { "Pallet" },
	rest = { grid = 0.1 },
	allowFree = true,
	weightKg = 640,
	sizeM = V(1.2, 0.9, 1.0),
	description = "Pallet of bolt, nut and washer kegs. Keep it near the work face — the crane can set it on a finished deck.",
	build = function(b)
		b:box("Pallet", V(1.2, 0.14, 1.0), CF(0, 0.07, 0), C.Timber, M.WoodPlanks)
		for _, x in ipairs({ -0.3, 0.3 }) do
			for _, z in ipairs({ -0.25, 0.25 }) do
				b:cylY("Keg", 0.7, 0.42, V(x, 0.14 + 0.35, z), Color3.fromRGB(64, 68, 72), M.Metal)
				b:cylY("Lid", 0.02, 0.43, V(x, 0.85, z), C.Safety, M.SmoothPlastic, { nc = true, ns = true })
			end
		end
		b:box("Strap", V(1.22, 0.03, 0.04), CF(0, 0.6, 0), C.StrapOrange, M.Fabric, { nc = true, ns = true })
	end,
	proxyColor = Color3.fromRGB(64, 68, 72),
})

---------------------------------------------------------------------------
-- Machinery (functional equipment)
---------------------------------------------------------------------------

add({
	id = "MC-LIGHTTOWER",
	name = "Mobile Light Tower (4 × LED)",
	category = "Machinery",
	class = "Equipment",
	kind = "Rest",
	originBottom = true,
	tags = { "Machine" },
	rest = { grid = 0.1 },
	allowFree = true,
	functional = "Light",
	weightKg = 950,
	sizeM = V(1.4, 7.0, 2.6),
	description = "Diesel light tower with a telescopic mast and four LED floods. Press E to switch it on for dusk work.",
	build = function(b)
		local y = C.CraneYellow
		b:box("Body", V(1.2, 1.1, 1.9), CF(0, 0.9, 0), y)
		b:box("Grille", V(1.21, 0.4, 0.6), CF(0, 1.0, 0.5), C.SteelDark, M.DiamondPlate, { nc = true })
		b:box("Drawbar", V(0.1, 0.1, 1.0), CF(0, 0.45, -1.3), C.SteelDark)
		for _, sx in ipairs({ 1, -1 }) do
			b:cylX("Wheel", 0.2, 0.65, CF(sx * 0.7, 0.33, 0.2), C.Rubber, M.SmoothPlastic)
			b:box("Outrigger", V(0.08, 0.6, 0.08), CF(sx * 0.55, 0.3, -0.85), C.SteelDark)
		end
		b:box("Mast", V(0.16, 5.4, 0.16), CF(0, 4.15, -0.4), Color3.fromRGB(190, 192, 195))
		b:box("LampBar", V(1.3, 0.08, 0.1), CF(0, 6.85, -0.4), C.SteelDark)
		for k, x in ipairs({ -0.45, -0.15, 0.15, 0.45 }) do
			local lamp = b:box("Lamp" .. k, V(0.26, 0.3, 0.12), CF(x, 6.6, -0.32) * CFrame.Angles(math.rad(-25), 0, 0), C.Charcoal)
			local lens = b:box("Lens" .. k, V(0.22, 0.24, 0.01), CF(x, 6.6, -0.32) * CFrame.Angles(math.rad(-25), 0, 0) * CF(0, 0, -0.065), Color3.fromRGB(230, 230, 220), M.Glass, { nc = true, ns = true })
			lens:SetAttribute("Lens", true)
			if k == 2 or k == 3 then
				local light = Instance.new("SpotLight")
				light.Name = "Flood"
				light.Angle = 80
				light.Range = 60
				light.Brightness = 3
				light.Color = Color3.fromRGB(255, 244, 228)
				light.Face = Enum.NormalId.Front
				light.Shadows = true
				light.Enabled = false
				light.Parent = lamp
			end
		end
	end,
	proxyColor = C.CraneYellow,
})

add({
	id = "MC-GENERATOR-60",
	name = "Site Generator 60 kVA",
	category = "Machinery",
	class = "Equipment",
	kind = "Rest",
	originBottom = true,
	tags = { "Machine" },
	rest = { grid = 0.1 },
	allowFree = true,
	functional = "Engine",
	weightKg = 1450,
	sizeM = V(1.1, 1.5, 2.6),
	description = "Canopied diesel generator powering welders and site lighting. Press E to start or stop it.",
	build = function(b)
		b:box("Skid", V(1.1, 0.15, 2.6), CF(0, 0.075, 0), C.SteelDark)
		b:box("Canopy", V(1.05, 1.25, 2.45), CF(0, 0.775, 0), Color3.fromRGB(46, 84, 64))
		b:box("Louvre", V(1.06, 0.6, 0.5), CF(0, 0.8, 0.9), C.SteelDark, M.DiamondPlate, { nc = true })
		b:box("Panel", V(0.4, 0.4, 0.02), CF(0.2, 1.0, -1.235), C.Charcoal, M.SmoothPlastic, { nc = true })
		b:cylY("Exhaust", 0.35, 0.08, V(-0.3, 1.57, -0.6), C.SteelDark, M.Metal, { nc = true })
		b:box("LiftEye", V(0.08, 0.12, 0.2), CF(0, 1.46, 0), C.SteelDark, M.Metal, { nc = true })
	end,
	proxyColor = Color3.fromRGB(46, 84, 64),
})

add({
	id = "MC-WELDER-CART",
	name = "Engine-Driven Welder on Cart",
	category = "Machinery",
	class = "Equipment",
	kind = "Rest",
	originBottom = true,
	tags = { "Machine" },
	rest = { grid = 0.1 },
	allowFree = true,
	functional = "Engine",
	weightKg = 260,
	sizeM = V(0.7, 1.0, 1.3),
	description = "Portable welding power source with leads and a stinger hook. Press E to run it; welding on deck reads more convincingly with it running nearby.",
	build = function(b)
		b:box("Case", V(0.65, 0.65, 1.1), CF(0, 0.55, 0), Color3.fromRGB(176, 40, 32))
		b:box("Panel", V(0.4, 0.3, 0.02), CF(0, 0.6, -0.56), C.Charcoal, M.SmoothPlastic, { nc = true })
		for _, sx in ipairs({ 1, -1 }) do
			b:cylX("Wheel", 0.08, 0.3, CF(sx * 0.36, 0.15, 0.35), C.Rubber, M.SmoothPlastic)
		end
		b:box("Handle", V(0.6, 0.03, 0.03), CF(0, 1.0, -0.6), C.SteelDark, M.Metal, { nc = true })
		b:cylY("LeadCoil", 0.12, 0.36, V(0, 0.94, 0.25), C.Rubber, M.SmoothPlastic, { nc = true })
	end,
	proxyColor = Color3.fromRGB(176, 40, 32),
})

---------------------------------------------------------------------------
-- Electrical / plumbing / HVAC (temporary services)
---------------------------------------------------------------------------

add({
	id = "EL-DISTBOARD",
	name = "Temporary Power Distribution Board",
	category = "Electrical, Plumbing & HVAC",
	class = "Equipment",
	kind = "Rest",
	originBottom = true,
	tags = { "Electrical" },
	rest = { grid = 0.1 },
	allowFree = true,
	functional = "Light",
	weightKg = 48,
	sizeM = V(0.6, 1.3, 0.35),
	description = "Weatherproof site distribution board on a stand with RCD-protected outlets. Press E to energise (status lamp).",
	build = function(b)
		b:box("Stand", V(0.5, 0.6, 0.3), CF(0, 0.3, 0), C.SteelDark)
		local box = b:box("Cabinet", V(0.6, 0.7, 0.35), CF(0, 0.95, 0), Color3.fromRGB(230, 120, 30), M.SmoothPlastic)
		box.Name = "Lamp1"
		for k = 0, 2 do
			b:box("Socket", V(0.12, 0.12, 0.03), CF(-0.15 + k * 0.15, 0.75, -0.18), Color3.fromRGB(40, 90, 200), M.SmoothPlastic, { nc = true })
		end
		local lens = b:box("Lens1", V(0.06, 0.06, 0.01), CF(0.2, 1.2, -0.18), Color3.fromRGB(60, 220, 90), M.Glass, { nc = true, ns = true })
		lens:SetAttribute("Lens", true)
		local light = Instance.new("PointLight")
		light.Name = "Flood"
		light.Range = 4
		light.Brightness = 1
		light.Color = Color3.fromRGB(80, 255, 120)
		light.Enabled = false
		light.Parent = box
	end,
	proxyColor = Color3.fromRGB(230, 120, 30),
})

add({
	id = "EL-CABLEREEL",
	name = "Cable Reel 50 m (16 A)",
	category = "Electrical, Plumbing & HVAC",
	class = "Decorative",
	kind = "Rest",
	originBottom = true,
	tags = { "Electrical" },
	rest = { grid = 0.05 },
	allowFree = true,
	weightKg = 14,
	sizeM = V(0.45, 0.45, 0.3),
	description = "Yellow site extension reel. Decorative prop for dressing work faces.",
	build = function(b)
		b:cylX("Drum", 0.22, 0.32, CF(0, 0.22, 0) * CFrame.Angles(0, math.pi / 2, 0), C.Rubber, M.SmoothPlastic)
		for _, sz in ipairs({ -0.12, 0.12 }) do
			b:cylX("Flange", 0.02, 0.42, CF(0, 0.22, sz) * CFrame.Angles(0, math.pi / 2, 0), C.Safety, M.SmoothPlastic)
		end
		b:box("Frame", V(0.04, 0.44, 0.3), CF(0.2, 0.22, 0), C.SteelDark, M.Metal, { nc = true })
	end,
	proxyColor = C.Safety,
})

---------------------------------------------------------------------------
-- Site safety
---------------------------------------------------------------------------

add({
	id = "SF-CONE-700",
	name = "Traffic Cone 700 mm",
	category = "Site Safety",
	class = "Decorative",
	kind = "Rest",
	originBottom = true,
	tags = { "Safety" },
	rest = { grid = 0.05 },
	allowFree = true,
	weightKg = 3.2,
	sizeM = V(0.38, 0.7, 0.38),
	description = "Reflective PVC traffic cone for marking exclusion zones under the crane.",
	build = function(b)
		local o = Color3.fromRGB(240, 92, 24)
		b:box("Base", V(0.38, 0.04, 0.38), CF(0, 0.02, 0), C.Rubber, M.SmoothPlastic)
		local segs = 5
		for k = 0, segs - 1 do
			local t = k / segs
			local d = 0.28 - 0.22 * t
			local band = (k == 2 or k == 3)
			b:cylY("Cone", 0.66 / segs, d, V(0, 0.04 + (k + 0.5) * 0.66 / segs, 0), band and C.OffWhite or o, M.SmoothPlastic, { ns = k > 2 })
		end
	end,
	proxyColor = Color3.fromRGB(240, 92, 24),
})

add({
	id = "SF-BARRICADE",
	name = "Steel Sawhorse Barricade",
	category = "Site Safety",
	class = "Decorative",
	kind = "Rest",
	originBottom = true,
	tags = { "Safety" },
	rest = { grid = 0.05 },
	allowFree = true,
	weightKg = 11,
	sizeM = V(1.5, 1.0, 0.6),
	description = "Striped barricade rail on folding legs.",
	build = function(b)
		for k, y in ipairs({ 0.92, 0.6 }) do
			b:box("Rail" .. k, V(1.5, 0.18, 0.025), CF(0, y, 0), C.OffWhite, M.SmoothPlastic)
			for s = 0, 3 do
				b:box("Stripe", V(0.18, 0.18, 0.027), CF(-0.6 + s * 0.4, y, 0) * CFrame.Angles(0, 0, math.rad(35)), Color3.fromRGB(240, 92, 24), M.SmoothPlastic, { nc = true, ns = true })
			end
		end
		for _, sx in ipairs({ -0.65, 0.65 }) do
			b:bar("Leg", V(sx, 1.0, 0), V(sx, 0, 0.28), 0.04, 0.04, C.SteelDark)
			b:bar("Leg", V(sx, 1.0, 0), V(sx, 0, -0.28), 0.04, 0.04, C.SteelDark)
		end
	end,
	proxyColor = C.OffWhite,
})

add({
	id = "SF-JERSEY-3",
	name = "Concrete Jersey Barrier 3 m",
	category = "Site Safety",
	class = "Decorative",
	kind = "Rest",
	originBottom = true,
	tags = { "Safety", "Concrete" },
	rest = { grid = 0.1 },
	allowFree = true,
	weightKg = 1800,
	sizeM = V(3.0, 0.81, 0.6),
	description = "Precast safety-shape barrier for separating the delivery lane from the work zone.",
	build = function(b)
		local c = Color3.fromRGB(176, 173, 166)
		b:box("Foot", V(3.0, 0.3, 0.6), CF(0, 0.15, 0), c, M.Concrete)
		b:wedge("SlopeA", V(3.0, 0.3, 0.18), CF(0, 0.45, 0.21) * CFrame.Angles(0, math.pi, 0), c, M.Concrete)
		b:wedge("SlopeB", V(3.0, 0.3, 0.18), CF(0, 0.45, -0.21), c, M.Concrete)
		b:box("Core", V(3.0, 0.3, 0.24), CF(0, 0.45, 0), c, M.Concrete)
		b:box("Top", V(3.0, 0.21, 0.2), CF(0, 0.705, 0), c, M.Concrete)
	end,
	liftPoints = { V(-0.9, 0.81, 0), V(0.9, 0.81, 0) },
	proxyColor = Color3.fromRGB(176, 173, 166),
})

add({
	id = "SF-SIGN-PPE",
	name = "Site Safety Sign Board",
	category = "Site Safety",
	class = "Decorative",
	kind = "Rest",
	originBottom = true,
	tags = { "Safety" },
	rest = { grid = 0.05 },
	allowFree = true,
	weightKg = 9,
	sizeM = V(0.9, 1.6, 0.4),
	description = "Free-standing PPE sign: hard hats, hi-vis and boots required beyond this point.",
	build = function(b)
		local board = b:box("Board", V(0.9, 0.6, 0.02), CF(0, 1.3, 0), C.OffWhite, M.SmoothPlastic)
		b:box("Post", V(0.05, 1.0, 0.05), CF(0, 0.5, 0.02), C.SteelDark)
		b:box("Foot", V(0.5, 0.06, 0.4), CF(0, 0.03, 0), C.Rubber, M.SmoothPlastic)
		if not b.opts.preview then
			local gui = Instance.new("SurfaceGui")
			gui.Face = Enum.NormalId.Front
			gui.PixelsPerStud = 40
			gui.LightInfluence = 1
			gui.Parent = board
			local t = Instance.new("TextLabel")
			t.Size = UDim2.fromScale(1, 1)
			t.BackgroundColor3 = Color3.fromRGB(0, 110, 60)
			t.TextColor3 = Color3.new(1, 1, 1)
			t.Font = Enum.Font.GothamBlack
			t.TextScaled = true
			t.Text = "HARD HATS\nHI-VIS & BOOTS\nREQUIRED"
			t.Parent = gui
		end
	end,
	proxyColor = Color3.fromRGB(0, 110, 60),
})

add({
	id = "SF-EXTINGUISHER",
	name = "Fire Extinguisher Point",
	category = "Site Safety",
	class = "Decorative",
	kind = "Rest",
	originBottom = true,
	tags = { "Safety" },
	rest = { grid = 0.05 },
	allowFree = true,
	weightKg = 22,
	sizeM = V(0.5, 1.2, 0.3),
	description = "Stand with a CO2 and a dry-powder extinguisher. Required near hot work.",
	build = function(b)
		b:box("Board", V(0.5, 1.2, 0.03), CF(0, 0.6, 0.12), Color3.fromRGB(200, 30, 30), M.SmoothPlastic)
		b:cylY("Ext1", 0.55, 0.15, V(-0.12, 0.38, 0), Color3.fromRGB(205, 30, 30), M.SmoothPlastic)
		b:cylY("Ext2", 0.55, 0.15, V(0.12, 0.38, 0), Color3.fromRGB(205, 30, 30), M.SmoothPlastic)
		b:box("Band", V(0.155, 0.08, 0.155), CF(0.12, 0.5, 0), C.Charcoal, M.SmoothPlastic, { nc = true, ns = true })
	end,
	proxyColor = Color3.fromRGB(200, 30, 30),
})

add({
	id = "SF-FIRSTAID",
	name = "First Aid & Eyewash Station",
	category = "Site Safety",
	class = "Decorative",
	kind = "Rest",
	originBottom = true,
	tags = { "Safety" },
	rest = { grid = 0.05 },
	allowFree = true,
	weightKg = 18,
	sizeM = V(0.6, 1.5, 0.3),
	description = "Wall-board station with a first aid cabinet and eyewash bottles.",
	build = function(b)
		b:box("Board", V(0.6, 1.0, 0.03), CF(0, 1.0, 0.12), Color3.fromRGB(0, 130, 70), M.SmoothPlastic)
		b:box("Cabinet", V(0.45, 0.35, 0.15), CF(0, 1.2, 0.03), C.OffWhite, M.SmoothPlastic)
		b:box("Cross", V(0.12, 0.04, 0.005), CF(0, 1.2, -0.05), Color3.fromRGB(0, 130, 70), M.SmoothPlastic, { nc = true, ns = true })
		b:box("CrossV", V(0.04, 0.12, 0.005), CF(0, 1.2, -0.05), Color3.fromRGB(0, 130, 70), M.SmoothPlastic, { nc = true, ns = true })
		b:box("Post", V(0.05, 0.5, 0.05), CF(0, 0.25, 0.12), C.SteelDark)
		b:box("Foot", V(0.5, 0.05, 0.3), CF(0, 0.025, 0.05), C.Rubber, M.SmoothPlastic)
	end,
	proxyColor = Color3.fromRGB(0, 130, 70),
})

add({
	id = "SF-FENCE-35",
	name = "Temporary Fence Panel 3.5 m",
	category = "Site Safety",
	class = "Decorative",
	kind = "Rest",
	originBottom = true,
	tags = { "Safety", "Fence" },
	rest = { grid = 0.1 },
	allowFree = true,
	weightKg = 24,
	sizeM = V(3.5, 2.0, 0.6),
	description = "Mesh fence panel with rubber feet. Use it to close off a laydown area or the crane swing zone.",
	build = function(b)
		local galv = C.Galvanized
		b:box("Mesh", V(3.4, 1.9, 0.02), CF(0, 1.05, 0), galv, M.DiamondPlate, { tr = 0.55, ns = true })
		b:cylY("PostL", 2.0, 0.04, V(-1.72, 1.08, 0), galv)
		b:cylY("PostR", 2.0, 0.04, V(1.72, 1.08, 0), galv)
		b:cylX("RailT", 3.45, 0.035, CF(0, 2.04, 0), galv, M.Metal, { nc = true })
		b:cylX("RailB", 3.45, 0.035, CF(0, 0.12, 0), galv, M.Metal, { nc = true })
		for _, sx in ipairs({ -1.72, 1.72 }) do
			b:box("Foot", V(0.2, 0.12, 0.6), CF(sx, 0.06, 0), C.Rubber, M.SmoothPlastic)
		end
	end,
	proxyColor = C.Galvanized,
})

---------------------------------------------------------------------------
-- Site furnishings
---------------------------------------------------------------------------

add({
	id = "FN-PALLET",
	name = "Timber Pallet 1.2 × 1.0 m",
	category = "Site Furnishings",
	class = "Decorative",
	kind = "Rest",
	originBottom = true,
	tags = { "Pallet" },
	rest = { grid = 0.05 },
	allowFree = true,
	weightKg = 22,
	sizeM = V(1.2, 0.144, 1.0),
	description = "Empty four-way pallet; useful for staging small parts off the mud.",
	build = function(b)
		local t = C.Timber
		for k = -3, 3 do
			b:box("Top", V(1.2, 0.022, 0.1), CF(0, 0.133, k * 0.145), t, M.WoodPlanks)
		end
		for _, z in ipairs({ -0.45, 0, 0.45 }) do
			b:box("Stringer", V(1.2, 0.078, 0.1), CF(0, 0.083, z), t, M.WoodPlanks)
			b:box("Bottom", V(1.2, 0.022, 0.1), CF(0, 0.011, z), t, M.WoodPlanks)
		end
	end,
	proxyColor = C.Timber,
})

add({
	id = "FN-DUNNAGE",
	name = "Timber Dunnage 100 × 100 × 2400",
	category = "Site Furnishings",
	class = "Decorative",
	kind = "Rest",
	originBottom = true,
	tags = { "Timber" },
	rest = { grid = 0.05 },
	allowFree = true,
	weightKg = 14,
	sizeM = V(2.4, 0.1, 0.1),
	description = "Hardwood bearer for keeping steel off the ground in the laydown area.",
	build = function(b)
		b:box("Timber", V(2.4, 0.1, 0.1), CF(0, 0.05, 0), C.Timber, M.Wood)
	end,
	proxyColor = C.Timber,
})

add({
	id = "FN-GANGBOX",
	name = "Steel Gang Box",
	category = "Site Furnishings",
	class = "Decorative",
	kind = "Rest",
	originBottom = true,
	tags = { "Storage" },
	rest = { grid = 0.05 },
	allowFree = true,
	weightKg = 70,
	sizeM = V(1.2, 0.75, 0.65),
	description = "Lockable jobsite tool chest for the connecting crew.",
	build = function(b)
		b:box("Body", V(1.2, 0.62, 0.65), CF(0, 0.38, 0), Color3.fromRGB(32, 86, 160))
		b:box("Lid", V(1.22, 0.08, 0.67), CF(0, 0.73, 0), Color3.fromRGB(28, 76, 142))
		b:box("Skid", V(1.2, 0.07, 0.6), CF(0, 0.035, 0), C.SteelDark)
		b:box("Hasp", V(0.08, 0.1, 0.02), CF(0, 0.62, -0.335), C.Galvanized, M.Metal, { nc = true, ns = true })
	end,
	proxyColor = Color3.fromRGB(32, 86, 160),
})

add({
	id = "FN-GASCAGE",
	name = "Gas Cylinder Cage (O₂ / Acetylene)",
	category = "Site Furnishings",
	class = "Decorative",
	kind = "Rest",
	originBottom = true,
	tags = { "Storage" },
	rest = { grid = 0.05 },
	allowFree = true,
	weightKg = 320,
	sizeM = V(1.2, 1.9, 0.8),
	description = "Ventilated mesh cage holding cutting gas cylinders, segregated by type.",
	build = function(b)
		local g = C.Galvanized
		b:box("Floor", V(1.2, 0.05, 0.8), CF(0, 0.025, 0), g, M.DiamondPlate)
		b:box("Roof", V(1.2, 0.04, 0.8), CF(0, 1.88, 0), g)
		for _, sx in ipairs({ -0.58, 0.58 }) do
			for _, sz in ipairs({ -0.38, 0.38 }) do
				b:box("Post", V(0.04, 1.85, 0.04), CF(sx, 0.95, sz), g)
			end
		end
		b:box("MeshBack", V(1.2, 1.8, 0.02), CF(0, 0.95, 0.39), g, M.DiamondPlate, { tr = 0.5, ns = true })
		b:box("MeshFront", V(1.2, 1.8, 0.02), CF(0, 0.95, -0.39), g, M.DiamondPlate, { tr = 0.5, ns = true })
		for k, x in ipairs({ -0.35, -0.1, 0.15, 0.38 }) do
			local col = k <= 2 and Color3.fromRGB(240, 240, 240) or Color3.fromRGB(150, 30, 40)
			b:cylY("Cylinder", 1.4, 0.22, V(x, 0.75, 0), col, M.SmoothPlastic, { nc = true })
		end
	end,
	proxyColor = C.Galvanized,
})

add({
	id = "FN-TOILET",
	name = "Portable Toilet",
	category = "Site Furnishings",
	class = "Decorative",
	kind = "Rest",
	originBottom = true,
	tags = { "Welfare" },
	rest = { grid = 0.05 },
	allowFree = true,
	weightKg = 85,
	weightClass = "Heavy",
	sizeM = V(1.12, 2.3, 1.2),
	description = "Single-unit portable toilet with a lifting frame on the roof.",
	build = function(b)
		local c = Color3.fromRGB(28, 98, 168)
		b:box("Base", V(1.12, 0.1, 1.2), CF(0, 0.05, 0), Color3.fromRGB(40, 40, 44), M.SmoothPlastic)
		b:box("Walls", V(1.1, 2.0, 1.15), CF(0, 1.1, 0), c, M.SmoothPlastic)
		b:box("Roof", V(1.16, 0.18, 1.22), CF(0, 2.19, 0), C.OffWhite, M.SmoothPlastic)
		b:box("Door", V(0.7, 1.8, 0.02), CF(0, 1.0, -0.585), Color3.fromRGB(24, 86, 150), M.SmoothPlastic, { nc = true })
		b:box("Vacant", V(0.1, 0.04, 0.01), CF(0.25, 1.1, -0.6), Color3.fromRGB(50, 200, 80), M.SmoothPlastic, { nc = true, ns = true })
	end,
	liftPoints = { V(0, 2.3, 0) },
	proxyColor = Color3.fromRGB(28, 98, 168),
})

add({
	id = "FN-DUMPSTER-15",
	name = "Roll-off Dumpster 15 yd³",
	category = "Site Furnishings",
	class = "Decorative",
	kind = "Rest",
	originBottom = true,
	tags = { "Waste" },
	rest = { grid = 0.1 },
	allowFree = true,
	weightKg = 1900,
	sizeM = V(2.3, 1.5, 5.4),
	description = "Steel roll-off container for scrap and packaging.",
	build = function(b)
		local c = Color3.fromRGB(46, 92, 58)
		b:box("Floor", V(2.3, 0.1, 5.4), CF(0, 0.15, 0), c)
		b:box("SideA", V(0.08, 1.35, 5.4), CF(1.11, 0.85, 0), c)
		b:box("SideB", V(0.08, 1.35, 5.4), CF(-1.11, 0.85, 0), c)
		b:box("EndA", V(2.3, 1.35, 0.08), CF(0, 0.85, 2.66), c)
		b:box("EndB", V(2.3, 1.35, 0.08), CF(0, 0.85, -2.66), c)
		for _, sx in ipairs({ 0.8, -0.8 }) do
			b:box("Rail", V(0.15, 0.1, 5.4), CF(sx, 0.05, 0), C.SteelDark)
		end
		for k = -2, 2 do
			b:box("Rib", V(2.42, 0.06, 0.12), CF(0, 1.2, k * 1.1), c, M.Metal, { nc = true, ns = true })
		end
		b:box("Debris", V(2.0, 0.4, 3.0), CF(0, 0.4, 0.5), Color3.fromRGB(110, 96, 80), M.Pebble, { nc = true })
	end,
	liftPoints = { V(-1.0, 1.5, -2.6), V(1.0, 1.5, 2.6) },
	proxyColor = Color3.fromRGB(46, 92, 58),
})

add({
	id = "FN-OFFICE-6",
	name = "Site Office Container 6 m",
	category = "Site Furnishings",
	class = "Decorative",
	kind = "Rest",
	originBottom = true,
	tags = { "Welfare" },
	rest = { grid = 0.1 },
	allowFree = true,
	weightKg = 3200,
	sizeM = V(6.06, 2.6, 2.44),
	description = "Insulated site office with windows and a door. Set it with the crane on level ground.",
	build = function(b)
		local c = Color3.fromRGB(226, 226, 220)
		b:box("Body", V(6.06, 2.5, 2.44), CF(0, 1.3, 0), c, M.Metal)
		for k = -3, 3 do
			b:box("Rib", V(0.06, 2.4, 2.46), CF(k * 0.85, 1.3, 0), Color3.fromRGB(214, 214, 208), M.Metal, { nc = true, ns = true })
		end
		b:box("Skid", V(6.06, 0.15, 2.44), CF(0, 0.075, 0), C.SteelDark)
		b:box("Door", V(0.9, 2.0, 0.03), CF(2.2, 1.15, -1.23), Color3.fromRGB(70, 74, 80), M.Metal, { nc = true })
		for _, x in ipairs({ -1.8, 0.2 }) do
			b:box("Window", V(1.2, 0.9, 0.03), CF(x, 1.55, -1.23), C.Glass, M.Glass, { nc = true, tr = 0.2, refl = 0.2 })
			b:box("Bars", V(1.25, 0.04, 0.04), CF(x, 1.55, -1.25), C.SteelDark, M.Metal, { nc = true, ns = true })
		end
		b:box("Step", V(1.0, 0.25, 0.6), CF(2.2, 0.125, -1.55), C.SteelDark, M.DiamondPlate)
		b:box("AC", V(0.7, 0.45, 0.25), CF(-2.4, 2.0, 1.35), C.OffWhite, M.SmoothPlastic)
	end,
	liftPoints = { V(-2.9, 2.6, -1.1), V(2.9, 2.6, 1.1) },
	proxyColor = Color3.fromRGB(226, 226, 220),
})

add({
	id = "FN-BENCH",
	name = "Break Table with Benches",
	category = "Site Furnishings",
	class = "Decorative",
	kind = "Rest",
	originBottom = true,
	tags = { "Welfare" },
	rest = { grid = 0.05 },
	allowFree = true,
	weightKg = 45,
	sizeM = V(1.8, 0.75, 1.5),
	description = "Galvanised picnic table for the crew's break area.",
	build = function(b)
		local w = C.Timber
		b:box("Top", V(1.8, 0.05, 0.75), CF(0, 0.73, 0), w, M.WoodPlanks)
		for _, sz in ipairs({ -0.62, 0.62 }) do
			b:box("Bench", V(1.8, 0.04, 0.26), CF(0, 0.44, sz), w, M.WoodPlanks)
		end
		for _, sx in ipairs({ -0.7, 0.7 }) do
			b:box("Frame", V(0.05, 0.05, 1.5), CF(sx, 0.4, 0), C.Galvanized)
			b:box("LegA", V(0.05, 0.7, 0.05), CF(sx, 0.37, 0.2), C.Galvanized)
			b:box("LegB", V(0.05, 0.7, 0.05), CF(sx, 0.37, -0.2), C.Galvanized)
		end
	end,
	proxyColor = C.Timber,
})

---------------------------------------------------------------------------
-- Building content (slabs, roofing, envelope, interiors, stairs, MEP)
---------------------------------------------------------------------------

require(script.Parent.ItemsBuilding)({
	add = add,
	look = look,
	CF = CF,
	V = V,
	G = G,
	C = C,
	M = M,
	S = S,
	Config = Config,
	idLen = idLen,
	fmtLen = fmtLen,
	panelPlugs = panelPlugs,
	panelFasteners = panelFasteners,
})

require(script.Parent.ItemsSite)({ add = add, CF = CF, V = V, C = C, M = M })

---------------------------------------------------------------------------
-- Tools (hotbar). Models are used for the hand-held visual and catalog.
---------------------------------------------------------------------------

Registry.ToolOrder = { "TL-HANDS", "TL-IMPACT", "TL-HAMMER", "TL-WELDER", "TL-REMOTE", "TL-POUR", "TL-TROWEL" }

add({
	id = "TL-HANDS",
	name = "Gloved Hands",
	category = "Tools",
	class = "Tool",
	kind = "Tool",
	hotkey = 1,
	weightKg = 0,
	sizeM = V(0.2, 0.2, 0.2),
	description = "Pick up, carry, release straps and place components.",
	build = function(b)
		b:box("Glove", V(0.1, 0.06, 0.18), CF(), C.HiVis, M.Fabric)
	end,
})

add({
	id = "TL-IMPACT",
	name = "1\" Impact Wrench",
	category = "Tools",
	class = "Tool",
	kind = "Tool",
	hotkey = 2,
	fastens = "Bolt",
	weightKg = 9,
	sizeM = V(0.12, 0.3, 0.38),
	description = "Cordless high-torque impact wrench. Hold the mouse on a bolt position to run up and snug the nut.",
	build = function(b)
		b:box("Body", V(0.1, 0.12, 0.26), CF(0, 0.05, 0), Color3.fromRGB(220, 160, 20), M.SmoothPlastic)
		b:box("Grip", V(0.06, 0.18, 0.07), CF(0, -0.08, 0.06), C.Charcoal, M.SmoothPlastic)
		b:box("Battery", V(0.1, 0.07, 0.13), CF(0, -0.19, 0.05), C.Charcoal, M.SmoothPlastic)
		b:cylX("Anvil", 0.12, 0.05, CF(0, 0.05, -0.18) * CFrame.Angles(0, math.pi / 2, 0), C.SteelDark, M.Metal)
		b:cylX("Socket", 0.07, 0.065, CF(0, 0.05, -0.27) * CFrame.Angles(0, math.pi / 2, 0), Color3.fromRGB(30, 30, 32), M.Metal)
	end,
})

add({
	id = "TL-HAMMER",
	name = "Scaffold Hammer",
	category = "Tools",
	class = "Tool",
	kind = "Tool",
	hotkey = 3,
	fastens = "Wedge",
	weightKg = 1.2,
	sizeM = V(0.05, 0.35, 0.15),
	description = "Drives ring-lock wedges tight. Hold the mouse on a ledger wedge.",
	build = function(b)
		b:box("Handle", V(0.035, 0.32, 0.03), CF(0, 0, 0), Color3.fromRGB(200, 60, 30), M.SmoothPlastic)
		b:box("Head", V(0.04, 0.04, 0.14), CF(0, 0.17, -0.02), C.SteelDark, M.Metal)
	end,
})

add({
	id = "TL-WELDER",
	name = "Stick Welder Stinger",
	category = "Tools",
	class = "Tool",
	kind = "Tool",
	hotkey = 4,
	fastens = "Weld",
	weightKg = 1.5,
	sizeM = V(0.06, 0.08, 0.4),
	description = "Electrode holder on welding leads. Hold the mouse on a puddle-weld spot; wear the hood — sparks are kept restrained.",
	build = function(b)
		b:box("Holder", V(0.045, 0.045, 0.22), CF(0, 0, 0.05), Color3.fromRGB(30, 30, 32), M.SmoothPlastic)
		b:box("Jaw", V(0.03, 0.03, 0.06), CF(0, 0, -0.09), Color3.fromRGB(180, 140, 60), M.Metal)
		b:cylX("Rod", 0.18, 0.006, CF(0, -0.03, -0.17) * CFrame.Angles(0, math.pi / 2, math.rad(35)), Color3.fromRGB(120, 110, 100), M.Metal)
	end,
})

add({
	id = "TL-REMOTE",
	name = "Crane Radio Remote",
	category = "Tools",
	class = "Tool",
	kind = "Tool",
	hotkey = 5,
	weightKg = 1.8,
	sizeM = V(0.22, 0.12, 0.16),
	description = "Belly-box radio remote for the tower crane. Equip it to operate the crane from the ground or the steel while you stay at the connection.",
	build = function(b)
		b:box("Box", V(0.22, 0.08, 0.15), CF(), C.Safety, M.SmoothPlastic)
		b:box("Panel", V(0.18, 0.01, 0.11), CF(0, 0.045, 0), C.Charcoal, M.SmoothPlastic)
		b:cylY("StickL", 0.06, 0.015, V(-0.05, 0.07, 0), C.Charcoal, M.SmoothPlastic)
		b:cylY("StickR", 0.06, 0.015, V(0.05, 0.07, 0), C.Charcoal, M.SmoothPlastic)
		b:box("EStop", V(0.03, 0.02, 0.03), CF(0.08, 0.055, -0.05), Color3.fromRGB(210, 30, 30), M.SmoothPlastic)
	end,
})

add({
	id = "TL-POUR",
	name = "Concrete Pump Hose",
	category = "Tools",
	class = "Tool",
	kind = "Tool",
	hotkey = 6,
	pours = true,
	weightKg = 0,
	sizeM = V(0.2, 0.2, 0.9),
	description = "End hose of the line pump. Aim at a fully decked, welded bay and hold the mouse to place the slab concrete.",
	build = function(b)
		b:cylX("Hose", 0.8, 0.13, CF(0, 0, -0.1) * CFrame.Angles(0, math.pi / 2, 0), Color3.fromRGB(30, 30, 32), M.SmoothPlastic)
		b:cylX("Coupling", 0.1, 0.16, CF(0, 0, 0.32) * CFrame.Angles(0, math.pi / 2, 0), C.Galvanized, M.Metal)
		b:box("Handle", V(0.04, 0.2, 0.04), CF(0, -0.12, 0.1), C.Safety, M.SmoothPlastic)
	end,
})

add({
	id = "TL-TROWEL",
	name = "Bull Float & Trowel",
	category = "Tools",
	class = "Tool",
	kind = "Tool",
	hotkey = 7,
	fastens = "Screed",
	weightKg = 3,
	sizeM = V(0.3, 0.1, 0.9),
	description = "Finishes freshly poured concrete. Hold the mouse on each of the four finishing marks; the slab cures when all are done.",
	build = function(b)
		b:box("Float", V(0.28, 0.02, 0.6), CF(0, -0.05, -0.2), Color3.fromRGB(170, 176, 182), M.Metal)
		b:box("Pole", V(0.03, 0.03, 0.7), CF(0, 0.05, 0.25) * CFrame.Angles(math.rad(-15), 0, 0), C.Safety, M.SmoothPlastic)
	end,
})

---------------------------------------------------------------------------
-- Queries
---------------------------------------------------------------------------

function Registry.get(id)
	return Registry.items[id]
end

function Registry.count()
	local counts = { total = 0 }
	for _, def in ipairs(Registry.list) do
		counts.total += 1
		counts[def.class] = (counts[def.class] or 0) + 1
	end
	return counts
end

Registry.TargetCount = 500

function Registry.search(query, category, favorites, favoritesOnly)
	query = string.lower(query or "")
	local out = {}
	for _, def in ipairs(Registry.list) do
		local okCat = (not category or category == "All" or def.category == category)
		local okFav = (not favoritesOnly) or (favorites and favorites[def.id])
		local okQuery = query == ""
			or string.find(string.lower(def.name), query, 1, true)
			or string.find(string.lower(def.category), query, 1, true)
			or string.find(string.lower(def.id), query, 1, true)
		if okCat and okFav and okQuery then
			table.insert(out, def)
		end
	end
	return out
end

-- Human-readable dimension string (L × W × H in metres).
function Registry.dimensionsText(def)
	local s = def.sizeM
	return string.format("%.2f × %.2f × %.2f m", s.X, s.Z, s.Y)
end

-- Find the beam/brace/panel that fits a given bay and storey; used by
-- blueprints and site layouts.
function Registry.find(kind, a, b, c)
	if kind == "column" then
		return "COL-" .. a:gsub("×", "x") .. "-" .. idLen(b)
	elseif kind == "beam" then
		return "BM-" .. a:gsub("×", "x") .. "-" .. idLen(b)
	elseif kind == "brace" then
		return "BR-HSS4-" .. idLen(a) .. "-" .. idLen(b)
	elseif kind == "deck" then
		return "DK-15B-" .. idLen(a)
	elseif kind == "wall" then
		return "WP-IMP-" .. idLen(a) .. "-" .. idLen(b)
	elseif kind == "curtain" then
		return "CW-UNIT-" .. idLen(a) .. "-" .. idLen(b)
	elseif kind == "footing" then
		return "FT-PRECAST-" .. idLen(a)
	end
	return nil
end

return Registry
