-- Phase 3 building content: cast-in-place slabs, roofing, wall panel
-- variants with doors and windows, interior partitions, balconies, stairs
-- and mechanical / electrical / plumbing equipment.
--
-- Called from ItemRegistry with its helpers (all definitions in METRES).

return function(R)
	local add, look, CF, V = R.add, R.look, R.CF, R.V
	local G, C, M, S, Config = R.G, R.C, R.M, R.S, R.Config
	local idLen, fmtLen = R.idLen, R.fmtLen
	local panelPlugs, panelFasteners = R.panelPlugs, R.panelFasteners

	local CONCRETE_WET = Color3.fromRGB(104, 102, 98)
	local CONCRETE = Color3.fromRGB(176, 174, 168)
	local DARK = Color3.fromRGB(44, 46, 50)
	local PANEL = Color3.fromRGB(184, 189, 193)
	local GYP = Color3.fromRGB(226, 224, 218)
	local ALU = Color3.fromRGB(150, 156, 162)

	local function anchors(w, d, h)
		return {
			{ type = "Bolt", pos = V(-w / 2 + 0.08, h or 0.02, -d / 2 + 0.08), normal = V(0, 1, 0) },
			{ type = "Bolt", pos = V(w / 2 - 0.08, h or 0.02, -d / 2 + 0.08), normal = V(0, 1, 0) },
			{ type = "Bolt", pos = V(-w / 2 + 0.08, h or 0.02, d / 2 - 0.08), normal = V(0, 1, 0) },
			{ type = "Bolt", pos = V(w / 2 - 0.08, h or 0.02, d / 2 - 0.08), normal = V(0, 1, 0) },
		}
	end

	---------------------------------------------------------------------------
	-- Cast-in-place composite slab (poured with the pump hose, finished with
	-- the trowel). One item per bay size; the slab IS the poured concrete.
	---------------------------------------------------------------------------
	for _, bx in ipairs(Config.Bays) do
		for _, bz in ipairs(Config.Bays) do
			add({
				id = "SL-CIP-" .. idLen(bx) .. "-" .. idLen(bz),
				name = string.format("Composite Slab Pour %.1f × %.1f m (140 mm)", bx, bz),
				category = "Concrete & Foundations",
				kind = "Slab",
				originBottom = true,
				deliverable = false,
				tags = { "Slab", "Concrete", "Floor" },
				overlapIgnore = { "Column", "Deck", "Beam" },
				weightKg = 2400 * bx * bz * 0.1,
				sizeM = V(bx, G.SlabTopping, bz),
				description = string.format(
					"Normal-weight concrete placed over a fully welded %.1f × %.1f m bay of metal deck with the pump hose (6), then floated and trowelled at four points (7). Cures from dark grey to light grey once finished.",
					bx,
					bz
				),
				build = function(b, def, opts)
					local col = opts.installed and CONCRETE or CONCRETE_WET
					local slab = b:box("Concrete", V(bx - 0.02, G.SlabTopping, bz - 0.02), CF(0, G.SlabTopping / 2, 0), col, M.Concrete)
					if not opts.installed then
						slab.Reflectance = 0.06
					end
				end,
				fasteners = {
					{ type = "Screed", pos = V(-bx / 4, G.SlabTopping, -bz / 4), normal = V(0, 1, 0) },
					{ type = "Screed", pos = V(bx / 4, G.SlabTopping, -bz / 4), normal = V(0, 1, 0) },
					{ type = "Screed", pos = V(-bx / 4, G.SlabTopping, bz / 4), normal = V(0, 1, 0) },
					{ type = "Screed", pos = V(bx / 4, G.SlabTopping, bz / 4), normal = V(0, 1, 0) },
				},
				minFastenRelease = 0,
				bayX = bx,
				bayZ = bz,
				proxyColor = CONCRETE,
			})
		end
	end

	---------------------------------------------------------------------------
	-- Roofing: insulated roof deck, parapets, hatch and skylight
	---------------------------------------------------------------------------
	for _, bay in ipairs(Config.Bays) do
		local W = G.DeckWidth
		add({
			id = "RF-DECK-" .. idLen(bay),
			name = "Roof Deck with Insulation & Membrane — " .. fmtLen(bay),
			category = "Walls & Roofing",
			kind = "Surface",
			originBottom = true,
			tags = { "Deck", "Roof", "Floor" },
			overlapIgnore = { "Column" },
			weightKg = 22 * W * bay,
			sizeM = V(bay, G.SlabTop, W),
			description = "Type B roof deck sheet with tapered insulation board and a mechanically fastened single-ply membrane, spanning between two roof beams. Medium weight — carry it across the roof.",
			build = function(b)
				for k = -2, 2 do
					b:box("Rib", V(bay, 0.06, 0.05), CF(0, 0.03, k * 0.15), C.Galvanized, M.Metal, { ns = true })
				end
				b:box("Insulation", V(bay, 0.06, W), CF(0, 0.09, 0), Color3.fromRGB(214, 196, 150), M.SmoothPlastic, { ns = true })
				b:box("Membrane", V(bay, 0.02, W), CF(0, G.SlabTop - 0.01, 0), Color3.fromRGB(226, 228, 228), M.SmoothPlastic)
				b:box("Seam", V(bay, 0.006, 0.05), CF(0, G.SlabTop + 0.002, W / 2 - 0.03), Color3.fromRGB(200, 202, 202), M.SmoothPlastic, { nc = true, ns = true })
			end,
			surface = { supportTags = { Beam = true }, tile = W },
			fasteners = {
				{ type = "Bolt", pos = V(-bay / 2 + 0.1, G.SlabTop, 0.2), normal = V(0, 1, 0) },
				{ type = "Bolt", pos = V(bay / 2 - 0.1, G.SlabTop, -0.2), normal = V(0, 1, 0) },
			},
			minFastenRelease = 0,
			proxyColor = Color3.fromRGB(226, 228, 228),
		})
		add({
			id = "RF-PARAPET-" .. idLen(bay),
			name = "Roof Parapet Panel 1.1 m — " .. fmtLen(bay),
			category = "Walls & Roofing",
			kind = "Span",
			faceNormal = true,
			tags = { "Parapet", "Facade", "Roof" },
			weightKg = 18 * bay * G.ParapetHeight,
			sizeM = V(bay - 0.02, G.ParapetHeight, 0.25),
			boundsOffsetM = V(0, G.ParapetHeight / 2, 0.125),
			description = "Insulated parapet panel with a pressed metal coping, hung on the outside of the roof edge between two columns. Doubles as the roof edge guard.",
			build = function(b)
				local w = bay - 0.02
				b:box("Panel", V(w, G.ParapetHeight - 0.08, 0.1), CF(0, (G.ParapetHeight - 0.08) / 2, 0.05), PANEL, M.Metal)
				b:box("Coping", V(w, 0.08, 0.32), CF(0, G.ParapetHeight - 0.04, 0.06), Color3.fromRGB(120, 124, 128), M.Metal)
				b:box("Backer", V(w, G.ParapetHeight - 0.2, 0.04), CF(0, G.ParapetHeight / 2 - 0.05, -0.08), Color3.fromRGB(200, 200, 196), M.SmoothPlastic, { ns = true })
			end,
			plugs = {
				{ type = "ParapetEnd", accepts = { "ParapetSeat" }, cf = CF(-bay / 2, 0, 0) },
				{ type = "ParapetEnd", accepts = { "ParapetSeat" }, cf = CF(bay / 2, 0, 0) },
			},
			fasteners = {
				{ type = "Bolt", pos = V(-bay / 2 + 0.25, 0.3, -0.02), normal = V(0, 0, -1) },
				{ type = "Bolt", pos = V(bay / 2 - 0.25, 0.3, -0.02), normal = V(0, 0, -1) },
			},
			minFastenRelease = 2,
			liftPoints = { V(-bay / 4, G.ParapetHeight, 0.05), V(bay / 4, G.ParapetHeight, 0.05) },
			proxyColor = PANEL,
		})
	end

	add({
		id = "RF-HATCH",
		name = "Roof Access Hatch 0.9 × 1.2 m",
		category = "Windows & Doors",
		kind = "Rest",
		originBottom = true,
		tags = { "Roof" },
		rest = { grid = 0.05 },
		allowFree = true,
		weightKg = 68,
		sizeM = V(1.2, 0.35, 0.9),
		description = "Galvanised curb-mounted roof hatch with a gas-strut lid and safety rail post.",
		build = function(b)
			b:box("Curb", V(1.2, 0.3, 0.9), CF(0, 0.15, 0), C.Galvanized, M.Metal)
			b:box("Lid", V(1.24, 0.05, 0.94), CF(0, 0.325, 0), Color3.fromRGB(150, 154, 158), M.Metal)
			b:box("RailPost", V(0.05, 1.0, 0.05), CF(0.55, 0.8, 0.4), C.Safety, M.Metal, { nc = true, ns = true })
		end,
		fasteners = anchors(1.2, 0.9),
		minFastenRelease = 0,
		proxyColor = C.Galvanized,
	})
	add({
		id = "RF-SKYLIGHT",
		name = "Curb Skylight 1.2 × 1.2 m",
		category = "Windows & Doors",
		kind = "Rest",
		originBottom = true,
		tags = { "Roof", "Window" },
		rest = { grid = 0.05 },
		allowFree = true,
		weightKg = 55,
		sizeM = V(1.2, 0.45, 1.2),
		description = "Domed polycarbonate skylight on an insulated curb.",
		build = function(b)
			b:box("Curb", V(1.2, 0.3, 1.2), CF(0, 0.15, 0), Color3.fromRGB(220, 220, 216), M.Metal)
			b:box("Dome", V(1.1, 0.12, 1.1), CF(0, 0.36, 0), C.Glass, M.Glass, { tr = 0.35, refl = 0.2 })
			b:box("DomeTop", V(0.8, 0.08, 0.8), CF(0, 0.44, 0), C.Glass, M.Glass, { tr = 0.35, refl = 0.2, nc = true })
		end,
		fasteners = anchors(1.2, 1.2),
		minFastenRelease = 0,
		proxyColor = C.Glass,
	})

	---------------------------------------------------------------------------
	-- Wall panel variants (same hanging rules as the insulated panels)
	---------------------------------------------------------------------------
	local function wallVariant(code, label, desc, cat, kgPerM2, buildFn, onlyBays)
		for _, bay in ipairs(Config.Bays) do
			if not onlyBays or onlyBays[bay] then
				for _, H in ipairs(Config.FloorHeights) do
					local w, h = bay - 0.02, H - 0.02
					add({
						id = code .. "-" .. idLen(bay) .. "-" .. idLen(H),
						name = label .. " — " .. fmtLen(bay) .. " × " .. fmtLen(H),
						category = cat or "Walls & Roofing",
						kind = "Span",
						faceNormal = true,
						tags = { "WallPanel", "Facade" },
						weightKg = kgPerM2 * bay * H,
						sizeM = V(w, h, 0.16),
						boundsOffsetM = V(0, H / 2, 0.08),
						description = desc,
						build = function(b)
							buildFn(b, w, h, H, bay)
						end,
						plugs = panelPlugs(bay),
						fasteners = panelFasteners(bay, H),
						minFastenRelease = 2,
						liftPoints = { V(-bay / 4, H, 0.06), V(bay / 4, H, 0.06) },
						rigging = "Bridle",
						proxyColor = PANEL,
					})
				end
			end
		end
	end

	local function ribs(b, w, h, H, z, color)
		local n = math.floor(w / 1.0)
		for k = 0, n do
			b:box("Rib", V(0.035, h, 0.025), CF(-w / 2 + 0.1 + k * (w - 0.2) / math.max(n, 1), H / 2, z), color, nil, { ns = true, nc = true })
		end
	end

	wallVariant("WP-DOOR", "Metal Wall Panel with Personnel Door", "Insulated metal panel unit with a factory-fitted steel personnel door, frame, closer and canopy. Hangs on the outside face of two columns.", "Windows & Doors", 17, function(b, w, h, H)
		local dw, dh = 1.0, 2.2
		local dx = -w / 2 + 1.0
		b:box("SkinLeft", V(dx - dw / 2 + w / 2, h, 0.08), CF((-w / 2 + dx - dw / 2) / 2, H / 2, 0.04), PANEL, M.Metal)
		b:box("SkinRight", V(w / 2 - (dx + dw / 2), h, 0.08), CF((dx + dw / 2 + w / 2) / 2, H / 2, 0.04), PANEL, M.Metal)
		b:box("SkinOver", V(dw, h - dh, 0.08), CF(dx, dh + (h - dh) / 2, 0.04), PANEL, M.Metal)
		b:box("Door", V(dw - 0.08, dh - 0.04, 0.05), CF(dx, (dh - 0.04) / 2, 0.06), Color3.fromRGB(72, 92, 112), M.Metal)
		b:box("Frame", V(dw + 0.1, 0.06, 0.12), CF(dx, dh, 0.06), DARK, M.Metal, { nc = true })
		b:box("Handle", V(0.14, 0.03, 0.04), CF(dx + 0.35, 1.05, 0.1), Color3.fromRGB(200, 200, 200), M.Metal, { nc = true, ns = true })
		b:box("Canopy", V(dw + 0.4, 0.05, 0.6), CF(dx, dh + 0.25, 0.35), DARK, M.Metal, { nc = true })
		ribs(b, w, h, H, 0.0925, Color3.fromRGB(176, 181, 186))
	end)
	wallVariant("WP-WINBAND", "Metal Wall Panel with Window Band", "Insulated metal panel unit with a continuous ribbon window at desk height — the typical low-rise office elevation.", "Windows & Doors", 22, function(b, w, h, H)
		b:box("SkinLow", V(w, 1.0, 0.08), CF(0, 0.5, 0.04), PANEL, M.Metal)
		b:box("SkinHigh", V(w, h - 2.2, 0.08), CF(0, 2.2 + (h - 2.2) / 2, 0.04), PANEL, M.Metal)
		local g = b:box("Glazing", V(w - 0.04, 1.2, 0.03), CF(0, 1.6, 0.05), C.Glass, M.Glass, { tr = 0.4, refl = 0.15 })
		g.CastShadow = false
		local n = math.max(1, math.floor(w / 1.5 + 0.5))
		for k = 0, n do
			b:box("Mullion", V(0.06, 1.24, 0.1), CF(-w / 2 + 0.03 + k * (w - 0.06) / n, 1.6, 0.06), DARK, M.Metal, { nc = true })
		end
		b:box("Sill", V(w, 0.06, 0.16), CF(0, 0.99, 0.08), DARK, M.Metal, { nc = true })
	end)
	wallVariant("WP-PRECAST", "Precast Concrete Wall Panel", "Architectural precast panel with sandblasted finish and horizontal reveals. Heavy — set it with the crane.", nil, 360, function(b, w, h, H)
		b:box("Precast", V(w, h, 0.15), CF(0, H / 2, 0.075), Color3.fromRGB(196, 192, 182), M.Concrete)
		for k = 1, 3 do
			b:box("Reveal", V(w, 0.03, 0.01), CF(0, k * H / 4, 0.152), Color3.fromRGB(150, 146, 138), M.Concrete, { nc = true, ns = true })
		end
	end)
	wallVariant("WP-BRICK", "Brick Veneer Wall Panel", "Thin-brick precast panel with a cast stone sill course — residential and civic elevations.", nil, 300, function(b, w, h, H)
		b:box("Brick", V(w, h - 0.15, 0.14), CF(0, (h - 0.15) / 2 + 0.15, 0.07), Color3.fromRGB(150, 82, 62), M.Brick)
		b:box("CastStone", V(w, 0.15, 0.16), CF(0, 0.075, 0.08), Color3.fromRGB(214, 206, 188), M.Concrete)
	end)
	wallVariant("WP-LOUVRE", "Louvre Wall Panel", "Extruded aluminium storm louvre for plant rooms and generator enclosures.", nil, 14, function(b, w, h, H)
		b:box("Frame", V(w, h, 0.04), CF(0, H / 2, 0.02), DARK, M.Metal)
		local n = math.floor(h / 0.15)
		for k = 1, n - 1 do
			b:box("Blade", V(w - 0.1, 0.03, 0.12), CF(0, k * h / n, 0.08) * CFrame.Angles(math.rad(-35), 0, 0), ALU, M.Metal, { nc = true, ns = true })
		end
	end)
	wallVariant("WP-OHDOOR", "Metal Wall Panel with Overhead Door", "Insulated panel unit framing a 4 m wide sectional overhead door for deliveries and plant.", "Windows & Doors", 20, function(b, w, h, H)
		local dw, dh = 4.0, math.min(H - 0.6, 3.6)
		b:box("SkinLeft", V((w - dw) / 2, h, 0.08), CF(-w / 2 + (w - dw) / 4, H / 2, 0.04), PANEL, M.Metal)
		b:box("SkinRight", V((w - dw) / 2, h, 0.08), CF(w / 2 - (w - dw) / 4, H / 2, 0.04), PANEL, M.Metal)
		b:box("SkinOver", V(dw, h - dh, 0.08), CF(0, dh + (h - dh) / 2, 0.04), PANEL, M.Metal)
		for k = 0, 5 do
			b:box("DoorSection", V(dw - 0.06, dh / 6 - 0.02, 0.05), CF(0, k * dh / 6 + dh / 12, 0.05), Color3.fromRGB(210, 212, 214), M.Metal)
		end
		b:box("Hood", V(dw + 0.2, 0.3, 0.3), CF(0, dh + 0.15, 0.2), DARK, M.Metal, { nc = true })
	end, { [6.0] = true, [7.5] = true, [9.0] = true })

	---------------------------------------------------------------------------
	-- Interior partitions (demountable, hand-carried) on the finished floor
	---------------------------------------------------------------------------
	local function partition(code, label, desc, buildFn)
		for _, bay in ipairs(Config.Bays) do
			for _, H in ipairs(Config.FloorHeights) do
				local ph = H - G.PartitionClear
				local w = bay - 0.42
				add({
					id = code .. "-" .. idLen(bay) .. "-" .. idLen(H),
					name = label .. " — " .. fmtLen(bay) .. " bay, " .. fmtLen(H) .. " storey",
					category = "Walls & Roofing",
					kind = "Span",
					tags = { "Partition", "Interior" },
					overlapIgnore = { "Slab" },
					weightKg = 70,
					weightClass = "Medium",
					sizeM = V(w, ph, 0.12),
					boundsOffsetM = V(0, ph / 2, 0),
					description = desc,
					build = function(b)
						buildFn(b, w, ph)
					end,
					plugs = {
						{ type = "PartitionEnd", accepts = { "PartitionSeat" }, cf = CF(-bay / 2, 0, 0) },
						{ type = "PartitionEnd", accepts = { "PartitionSeat" }, cf = CF(bay / 2, 0, 0) },
					},
					fasteners = {
						{ type = "Bolt", pos = V(-w / 2 + 0.1, 0.03, 0.07), normal = V(0, 0, 1) },
						{ type = "Bolt", pos = V(w / 2 - 0.1, 0.03, 0.07), normal = V(0, 0, 1) },
					},
					minFastenRelease = 0,
					symmetric180 = true,
					proxyColor = GYP,
				})
			end
		end
	end
	partition("PT-SOLID", "Demountable Partition (solid)", "Aluminium-framed demountable partition with gypsum faces, spanning between two columns along a grid line. Seats on the finished slab.", function(b, w, ph)
		b:box("Track", V(w, 0.05, 0.12), CF(0, 0.025, 0), ALU, M.Metal)
		b:box("Board", V(w, ph - 0.1, 0.1), CF(0, ph / 2, 0), GYP, M.SmoothPlastic)
		b:box("Head", V(w, 0.05, 0.12), CF(0, ph - 0.025, 0), ALU, M.Metal)
	end)
	partition("PT-DOOR", "Demountable Partition with Door", "Demountable partition with a hung timber door set and lever handles.", function(b, w, ph)
		local dw, dh = 0.95, 2.15
		b:box("Track", V(w, 0.05, 0.12), CF(0, 0.025, 0), ALU, M.Metal)
		b:box("BoardL", V(w / 2 - dw / 2, ph - 0.1, 0.1), CF(-w / 4 - dw / 4, ph / 2, 0), GYP, M.SmoothPlastic)
		b:box("BoardR", V(w / 2 - dw / 2, ph - 0.1, 0.1), CF(w / 4 + dw / 4, ph / 2, 0), GYP, M.SmoothPlastic)
		b:box("BoardOver", V(dw, ph - dh - 0.05, 0.1), CF(0, dh + (ph - dh) / 2, 0), GYP, M.SmoothPlastic)
		b:box("Door", V(dw - 0.06, dh - 0.02, 0.045), CF(0, dh / 2, 0.02), Color3.fromRGB(150, 110, 72), M.Wood, { nc = true })
		b:box("Lever", V(0.12, 0.02, 0.03), CF(0.32, 1.05, 0.06), ALU, M.Metal, { nc = true, ns = true })
		b:box("Head", V(w, 0.05, 0.12), CF(0, ph - 0.025, 0), ALU, M.Metal)
	end)
	partition("PT-GLAZED", "Glazed Office Partition", "Full-height frameless glazed partition with aluminium head and floor tracks.", function(b, w, ph)
		b:box("Track", V(w, 0.05, 0.12), CF(0, 0.025, 0), ALU, M.Metal)
		local g = b:box("Glass", V(w - 0.02, ph - 0.1, 0.02), CF(0, ph / 2, 0), C.Glass, M.Glass, { tr = 0.55, refl = 0.15 })
		g.CastShadow = false
		local n = math.max(1, math.floor(w / 1.2 + 0.5))
		for k = 1, n - 1 do
			b:box("Joint", V(0.02, ph - 0.1, 0.03), CF(-w / 2 + k * w / n, ph / 2, 0), ALU, M.Metal, { nc = true, ns = true })
		end
		b:box("Head", V(w, 0.05, 0.12), CF(0, ph - 0.025, 0), ALU, M.Metal)
		b:box("Manifestation", V(w - 0.1, 0.06, 0.022), CF(0, 1.2, 0), Color3.fromRGB(240, 240, 240), M.SmoothPlastic, { nc = true, ns = true })
	end)

	---------------------------------------------------------------------------
	-- Balconies: precast cantilever slab with railing, hung at floor level
	---------------------------------------------------------------------------
	for _, bay in ipairs(Config.Bays) do
		for _, style in ipairs({ { "GLASS", "glass balustrade" }, { "STEEL", "steel picket railing" } }) do
			local w = bay - 0.1
			local depth = 1.6
			add({
				id = "BL-CANT-" .. idLen(bay) .. "-" .. style[1],
				name = string.format("Cantilever Balcony %.1f m with %s", bay, style[2]),
				category = "Walls & Roofing",
				kind = "Span",
				faceNormal = true,
				tags = { "Balcony", "Facade" },
				weightKg = 2400 * w * depth * 0.2 + 120,
				sizeM = V(w, 1.3, depth),
				boundsOffsetM = V(0, 0.55, 0.2 + depth / 2),
				description = "Precast balcony slab on thermally broken cantilever brackets bolted to the floor edge between two columns, with " .. style[2] .. ".",
				build = function(b)
					local z0 = 0.2
					b:box("Slab", V(w, 0.2, depth), CF(0, G.SlabTop - 0.1, z0 + depth / 2), Color3.fromRGB(196, 192, 184), M.Concrete)
					b:box("Drip", V(w, 0.04, 0.04), CF(0, G.SlabTop - 0.22, z0 + depth - 0.03), Color3.fromRGB(170, 166, 158), M.Concrete, { nc = true, ns = true })
					for _, sx in ipairs({ -1, 1 }) do
						b:box("Bracket", V(0.15, 0.25, 0.4), CF(sx * (w / 2 - 0.4), G.SlabTop - 0.32, z0 + 0.1), DARK, M.Metal, { nc = true, ns = true })
					end
					local railY = G.SlabTop + 0.55
					if style[1] == "GLASS" then
						local g = b:box("Glass", V(w - 0.1, 1.0, 0.02), CF(0, railY, z0 + depth - 0.08), C.Glass, M.Glass, { tr = 0.45, refl = 0.2 })
						g.CastShadow = false
						for _, sx in ipairs({ -1, 1 }) do
							local sg = b:box("SideGlass", V(0.02, 1.0, depth - 0.15), CF(sx * (w / 2 - 0.05), railY, z0 + depth / 2), C.Glass, M.Glass, { tr = 0.45, refl = 0.2 })
							sg.CastShadow = false
						end
						b:box("Handrail", V(w - 0.1, 0.05, 0.06), CF(0, railY + 0.52, z0 + depth - 0.08), ALU, M.Metal, { nc = true })
					else
						b:box("Handrail", V(w - 0.1, 0.06, 0.06), CF(0, railY + 0.52, z0 + depth - 0.08), DARK, M.Metal)
						b:box("BottomRail", V(w - 0.1, 0.04, 0.04), CF(0, G.SlabTop + 0.1, z0 + depth - 0.08), DARK, M.Metal, { nc = true, ns = true })
						local n = math.floor((w - 0.1) / 0.12)
						for k = 0, n, 2 do
							b:box("Picket", V(0.02, 0.95, 0.02), CF(-w / 2 + 0.05 + k * (w - 0.1) / n, railY, z0 + depth - 0.08), DARK, M.Metal, { nc = true, ns = true })
						end
					end
				end,
				plugs = panelPlugs(bay),
				fasteners = {
					{ type = "Bolt", pos = V(-bay / 2 + 0.45, G.SlabTop - 0.2, 0.3), normal = V(0, 1, 0) },
					{ type = "Bolt", pos = V(bay / 2 - 0.45, G.SlabTop - 0.2, 0.3), normal = V(0, 1, 0) },
				},
				minFastenRelease = 2,
				liftPoints = { V(-bay / 4, G.SlabTop, 0.95), V(bay / 4, G.SlabTop, 0.95) },
				proxyColor = Color3.fromRGB(196, 192, 184),
			})
		end
	end

	---------------------------------------------------------------------------
	-- Steel stairs (one storey per flight). A hidden ramp gives smooth walking.
	---------------------------------------------------------------------------
	for _, H in ipairs(Config.FloorHeights) do
		for _, width in ipairs({ 1.0, 1.2 }) do
			local run = H / math.tan(math.rad(37))
			local steps = math.floor(H / 0.18 + 0.5)
			add({
				id = "ST-FLIGHT-" .. idLen(H) .. "-" .. idLen(width),
				name = string.format("Steel Stair Flight %.1f m rise, %.1f m wide", H, width),
				category = "Structural Steel",
				kind = "Rest",
				originBottom = true,
				tags = { "Stair", "Steel" },
				rest = { grid = 0.1 },
				allowFree = true,
				weightKg = 160 * H + 60 * width,
				sizeM = V(run + 0.3, H, width + 0.1),
				boundsOffsetM = V(run / 2, H / 2, 0),
				description = string.format(
					"Channel-stringer stair with checker-plate treads and handrails rising %.1f m over %.1f m. Leave a deck opening above it and anchor it to the floor.",
					H,
					run
				),
				build = function(b)
					local ang = math.atan2(H, run)
					local len = math.sqrt(H * H + run * run)
					for _, sz in ipairs({ -1, 1 }) do
						b:box("Stringer", V(len, 0.25, 0.06), CF(run / 2, H / 2, sz * (width / 2)) * CFrame.Angles(0, 0, ang), C.PrimerGray, M.Metal, { nc = true })
						b:box("Handrail", V(len, 0.05, 0.05), CF(run / 2, H / 2 + 0.95, sz * (width / 2 + 0.02)) * CFrame.Angles(0, 0, ang), C.Safety, M.Metal, { nc = true, ns = true })
						for k = 0, 3 do
							local t = (k + 0.5) / 4
							b:box("RailPost", V(0.04, 0.95, 0.04), CF(run * t, H * t + 0.47, sz * (width / 2 + 0.02)), C.Safety, M.Metal, { nc = true, ns = true })
						end
					end
					for k = 1, steps do
						local x = (k - 0.5) * run / steps
						local y = k * H / steps - 0.02
						b:box("Tread", V(run / steps + 0.03, 0.03, width), CF(x, y, 0), C.SteelDark, M.DiamondPlate, { nc = true })
					end
					-- smooth walking surface (invisible)
					local ramp = b:wedge("WalkRamp", V(width, H, run), CF(run / 2, H / 2, 0) * CFrame.Angles(0, math.pi / 2, 0), C.SteelDark, M.SmoothPlastic, { tr = 1, ns = true })
					ramp.CanQuery = false
				end,
				fasteners = {
					{ type = "Bolt", pos = V(0.1, 0.02, -width / 2 + 0.05), normal = V(0, 1, 0) },
					{ type = "Bolt", pos = V(0.1, 0.02, width / 2 - 0.05), normal = V(0, 1, 0) },
				},
				minFastenRelease = 0,
				liftPoints = { V(run * 0.25, H * 0.25 + 0.3, 0), V(run * 0.75, H * 0.75 + 0.3, 0) },
				proxyColor = C.PrimerGray,
			})
		end
	end

	---------------------------------------------------------------------------
	-- Mechanical, electrical and plumbing equipment (anchored with 4 bolts)
	---------------------------------------------------------------------------
	local function equipment(id, name, cat, kg, size, desc, buildFn, functional)
		add({
			id = id,
			name = name,
			category = cat,
			kind = "Rest",
			originBottom = true,
			tags = { "MEP" },
			rest = { grid = 0.1 },
			allowFree = true,
			functional = functional,
			weightKg = kg,
			sizeM = size,
			description = desc,
			build = buildFn,
			fasteners = anchors(size.X, size.Z),
			minFastenRelease = 0,
			liftPoints = { V(-size.X / 4, size.Y, 0), V(size.X / 4, size.Y, 0) },
			proxyColor = Color3.fromRGB(200, 202, 204),
		})
	end
	local MEP = "Electrical, Plumbing & HVAC"
	for _, rtu in ipairs({ { 5, 2.4, 1.4, 1.1, 640 }, { 10, 3.4, 1.8, 1.3, 1250 }, { 20, 5.0, 2.3, 1.6, 2300 } }) do
		local tons, L, W, H, kg = table.unpack(rtu)
		equipment("ME-RTU-" .. tons, string.format("Rooftop Packaged Unit %d ton", tons), MEP, kg, V(L, H, W),
			string.format("%d ton packaged heating/cooling unit on a roof curb. Lift it onto the roof with the crane and anchor it.", tons),
			function(b)
				b:box("Curb", V(L, 0.3, W), CF(0, 0.15, 0), C.Galvanized, M.Metal)
				b:box("Cabinet", V(L, H - 0.3, W), CF(0, 0.3 + (H - 0.3) / 2, 0), Color3.fromRGB(214, 214, 208), M.Metal)
				b:box("CoilGrille", V(L * 0.4, H * 0.5, 0.02), CF(L * 0.25, H * 0.55, W / 2 + 0.01), DARK, M.DiamondPlate, { nc = true, ns = true })
				local n = tons >= 10 and 2 or 1
				for k = 1, n do
					b:cylY("Fan", 0.1, W * 0.6, V(-L / 2 + k * L / (n + 1), H + 0.05, 0), DARK, M.Metal, { nc = true })
				end
			end)
	end
	equipment("ME-AHU", "Air Handling Unit 10 000 m³/h", MEP, 1900, V(4.0, 2.0, 1.8), "Modular indoor air handler with filter, coil and fan sections.", function(b)
		for k = 0, 3 do
			b:box("Section", V(0.98, 1.9, 1.8), CF(-1.5 + k, 1.0, 0), Color3.fromRGB(190, 196, 200), M.Metal)
		end
		b:box("Base", V(4.0, 0.1, 1.8), CF(0, 0.05, 0), DARK, M.Metal)
		b:box("Duct", V(0.8, 0.8, 0.6), CF(1.6, 2.4, 0), C.Galvanized, M.Metal)
	end)
	equipment("ME-CONDENSER", "Air-Cooled Condensing Unit", MEP, 420, V(1.6, 1.4, 1.0), "Split-system condensing unit with a top-discharge fan.", function(b)
		b:box("Body", V(1.6, 1.3, 1.0), CF(0, 0.75, 0), Color3.fromRGB(220, 220, 216), M.Metal)
		b:box("Coil", V(1.5, 1.0, 0.02), CF(0, 0.75, 0.51), DARK, M.DiamondPlate, { nc = true, ns = true })
		b:cylY("Fan", 0.1, 0.8, V(0, 1.45, 0), DARK, M.Metal, { nc = true })
	end)
	equipment("ME-EXHFAN", "Roof Exhaust Fan (mushroom)", MEP, 85, V(1.0, 0.9, 1.0), "Centrifugal upblast exhaust fan on a roof curb.", function(b)
		b:box("Curb", V(1.0, 0.35, 1.0), CF(0, 0.175, 0), C.Galvanized, M.Metal)
		b:cylY("Hood", 0.4, 0.95, V(0, 0.6, 0), C.Galvanized, M.Metal)
		b:cylY("Cap", 0.1, 1.0, V(0, 0.85, 0), C.Galvanized, M.Metal)
	end)
	equipment("EL-SWITCHBOARD", "Main Switchboard 2000 A", MEP, 1100, V(3.2, 2.3, 0.8), "Free-standing low-voltage switchboard with metering section. Switch it on with F.", function(b)
		for k = 0, 3 do
			local cab = b:box("Cabinet" .. k, V(0.78, 2.2, 0.8), CF(-1.2 + k * 0.8, 1.15, 0), Color3.fromRGB(206, 208, 204), M.Metal)
			if k == 0 then
				cab.Name = "Lamp1"
			end
			b:box("Door", V(0.7, 2.0, 0.02), CF(-1.2 + k * 0.8, 1.15, -0.41), Color3.fromRGB(196, 198, 194), M.Metal, { nc = true, ns = true })
		end
		local lens = b:box("Lens1", V(0.06, 0.06, 0.01), CF(-1.2, 2.0, -0.42), Color3.fromRGB(60, 220, 90), M.Glass, { nc = true, ns = true })
		lens:SetAttribute("Lens", true)
		local light = Instance.new("PointLight")
		light.Name = "Flood"
		light.Range = 6
		light.Brightness = 1
		light.Color = Color3.fromRGB(80, 255, 120)
		light.Enabled = false
		light.Parent = b.model:FindFirstChild("Lamp1")
		b:box("Plinth", V(3.2, 0.1, 0.8), CF(0, 0.05, 0), DARK, M.Metal)
	end, "Light")
	equipment("EL-TRANSFORMER", "Pad-Mounted Transformer 1500 kVA", MEP, 4800, V(2.2, 1.9, 2.0), "Utility pad-mount transformer in a tamper-resistant green enclosure.", function(b)
		b:box("Pad", V(2.4, 0.2, 2.2), CF(0, 0.1, 0), CONCRETE, M.Concrete)
		b:box("Tank", V(2.0, 1.6, 1.8), CF(0, 1.0, 0), Color3.fromRGB(70, 102, 72), M.Metal)
		for k = -3, 3 do
			b:box("Fin", V(0.04, 1.2, 0.3), CF(k * 0.28, 1.0, 1.05), Color3.fromRGB(62, 94, 64), M.Metal, { nc = true, ns = true })
		end
	end)
	equipment("EL-GENSET-STANDBY", "Standby Generator 500 kW (enclosed)", MEP, 6500, V(5.5, 2.4, 1.9), "Permanent standby diesel generator in a weatherproof enclosure. F to test-run.", function(b)
		b:box("Base", V(5.5, 0.4, 1.9), CF(0, 0.2, 0), DARK, M.Metal)
		b:box("Enclosure", V(5.4, 2.0, 1.8), CF(0, 1.4, 0), Color3.fromRGB(196, 198, 194), M.Metal)
		b:box("Louvre", V(1.0, 1.4, 0.02), CF(2.2, 1.4, 0.91), DARK, M.DiamondPlate, { nc = true, ns = true })
		b:cylY("Muffler", 0.6, 0.3, V(-1.8, 2.7, 0), C.SteelDark, M.Metal, { nc = true })
	end, "Engine")
	equipment("PL-WATERHEATER", "Commercial Water Heater 400 L", MEP, 320, V(0.9, 2.0, 0.9), "Gas-fired storage water heater with flue and relief valve.", function(b)
		b:cylY("Tank", 1.8, 0.85, V(0, 0.95, 0), Color3.fromRGB(70, 110, 160), M.Metal)
		b:cylY("Flue", 0.4, 0.2, V(0, 2.05, 0), C.Galvanized, M.Metal, { nc = true })
	end)
	equipment("PL-FIREPUMP", "Fire Pump Skid 750 gpm", MEP, 1700, V(3.0, 1.4, 1.2), "Horizontal split-case fire pump with electric driver and controller.", function(b)
		b:box("Skid", V(3.0, 0.15, 1.2), CF(0, 0.075, 0), DARK, M.Metal)
		b:cylX("Motor", 1.0, 0.7, CF(-0.8, 0.6, 0), Color3.fromRGB(200, 40, 34), M.Metal)
		b:box("PumpCase", V(0.9, 0.8, 0.8), CF(0.5, 0.55, 0), Color3.fromRGB(200, 40, 34), M.Metal)
		b:cylX("Suction", 0.6, 0.3, CF(0.5, 0.55, 0.6) * CFrame.Angles(0, math.pi / 2, 0), Color3.fromRGB(200, 40, 34), M.Metal, { nc = true })
		b:box("Controller", V(0.6, 1.2, 0.3), CF(1.2, 0.75, -0.4), Color3.fromRGB(200, 40, 34), M.Metal)
	end)
	equipment("PL-BACKFLOW", "Backflow Preventer Assembly", MEP, 260, V(2.0, 1.2, 0.6), "Reduced-pressure backflow assembly with isolation valves on a stand.", function(b)
		b:cylX("Body", 1.8, 0.25, CF(0, 0.9, 0), Color3.fromRGB(60, 120, 200), M.Metal)
		for _, x in ipairs({ -0.7, 0.7 }) do
			b:box("Stand", V(0.08, 0.8, 0.5), CF(x, 0.4, 0), DARK, M.Metal)
			b:cylY("Valve", 0.35, 0.12, V(x * 0.8, 1.15, 0), Color3.fromRGB(200, 40, 34), M.Metal, { nc = true })
		end
	end)
	equipment("ME-CABLETRAY-3", "Ladder Cable Tray Section 3 m", MEP, 18, V(3.0, 0.15, 0.6), "Galvanised ladder-type cable tray section on floor stands for risers and plant rooms.", function(b)
		for _, sz in ipairs({ -1, 1 }) do
			b:box("SideRail", V(3.0, 0.1, 0.03), CF(0, 0.1, sz * 0.285), C.Galvanized, M.Metal)
		end
		for k = 0, 9 do
			b:box("Rung", V(0.03, 0.02, 0.57), CF(-1.35 + k * 0.3, 0.06, 0), C.Galvanized, M.Metal, { nc = true, ns = true })
		end
	end)
	equipment("ME-DUCT-RISER", "Ductwork Riser Section 600 × 400", MEP, 40, V(0.6, 3.0, 0.4), "Galvanised rectangular duct riser section with flanged joints.", function(b)
		b:box("Duct", V(0.6, 3.0, 0.4), CF(0, 1.5, 0), C.Galvanized, M.Metal)
		for _, y in ipairs({ 0.05, 2.95 }) do
			b:box("Flange", V(0.66, 0.06, 0.46), CF(0, y, 0), C.Galvanized, M.Metal, { nc = true, ns = true })
		end
	end)
	equipment("PL-PIPESPOOL", "Pipe Spool Rack (steel pipe)", MEP, 900, V(3.2, 1.2, 1.2), "Fabricated steel pipe spools strapped to a skid, ready to hoist to the floor.", function(b)
		b:box("Skid", V(3.2, 0.12, 1.2), CF(0, 0.06, 0), C.Timber, M.Wood)
		for i = 0, 2 do
			for j = 0, 2 do
				b:cylX("Pipe", 3.0, 0.3, CF(0, 0.3 + i * 0.32, -0.36 + j * 0.36), Color3.fromRGB(70, 74, 78), M.Metal)
			end
		end
	end)
end
