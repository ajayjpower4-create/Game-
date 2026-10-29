-- Phase 4 catalog content: rigging gear, site machinery, safety equipment and
-- site furnishings. Each has its own model and behaviour (Rest placement,
-- carry/crane handling by weight; equipment marked functional can be
-- switched on with F).

return function(R)
	local add, CF, V = R.add, R.CF, R.V
	local C, M = R.C, R.M

	local YEL = C.CraneYellow
	local DARK = Color3.fromRGB(40, 42, 46)
	local RUBBER = C.Rubber
	local GLASS = Color3.fromRGB(40, 52, 60)

	local function prop(def)
		def.kind = "Rest"
		def.originBottom = true
		def.rest = def.rest or { grid = 0.05 }
		def.allowFree = true
		def.class = def.class or "Decorative"
		def.tags = def.tags or { "Prop" }
		return add(def)
	end

	local function wheelsAt(b, xs, zs, dia, width)
		for _, x in ipairs(xs) do
			for _, z in ipairs(zs) do
				b:cylX("Wheel", width, dia, CF(x, dia / 2, z) * CFrame.Angles(0, math.pi / 2, 0), RUBBER, M.SmoothPlastic, { ns = true })
			end
		end
	end

	-------------------------------------------------------------------------
	-- Rigging
	-------------------------------------------------------------------------
	for _, L in ipairs({ 2, 6, 8 }) do
		prop({
			id = "RG-SPREADER-" .. L,
			name = string.format("Spreader Bar %d m", L),
			category = "Connections & Rigging",
			class = "Equipment",
			tags = { "Rigging" },
			weightKg = 45 * L + 20,
			sizeM = V(L, 0.35, 0.3),
			description = string.format("Fabricated %d m spreader beam with end lugs for long or flexible lifts. Store it in the laydown yard.", L),
			build = function(b)
				b:hss("Bar", L - 0.2, 0.22, 0.01, CF(0, 0.22, 0), YEL)
				for _, sx in ipairs({ -1, 1 }) do
					b:box("Lug", V(0.14, 0.14, 0.03), CF(sx * (L / 2 - 0.1), 0.36, 0), YEL)
					b:box("Foot", V(0.1, 0.11, 0.3), CF(sx * (L / 2 - 0.4), 0.055, 0), C.Timber, M.Wood)
				end
			end,
		})
	end
	for _, s in ipairs({ { "12", 0.18, 6 }, { "25", 0.28, 18 } }) do
		prop({
			id = "RG-SHACKLE-" .. s[1] .. "T",
			name = "Bow Shackle " .. s[1] .. " t",
			category = "Connections & Rigging",
			class = "Equipment",
			tags = { "Rigging" },
			weightKg = s[3],
			sizeM = V(s[2], s[2] * 1.4, 0.06),
			description = "Galvanised bow shackle with safety bolt, nut and cotter pin for connecting slings to lifting points.",
			build = function(b)
				local h = s[2]
				b:box("BowL", V(0.035, h, 0.035), CF(-h / 3, h * 0.7, 0), C.Galvanized)
				b:box("BowR", V(0.035, h, 0.035), CF(h / 3, h * 0.7, 0), C.Galvanized)
				b:box("BowTop", V(h * 0.75, 0.035, 0.035), CF(0, h * 1.2, 0), C.Galvanized)
				b:cylX("Pin", h * 0.95, 0.04, CF(0, 0.03, 0), Color3.fromRGB(200, 60, 40))
			end,
		})
	end
	prop({
		id = "RG-CHAINSLING-4L",
		name = "Four-Leg Chain Sling 7 t",
		category = "Connections & Rigging",
		class = "Equipment",
		tags = { "Rigging" },
		weightKg = 62,
		sizeM = V(0.9, 0.25, 0.9),
		description = "Grade 80 chain sling with master link and four hooks, coiled on the ground ready for the next pick.",
		build = function(b)
			b:cylX("Coil", 0.18, 0.75, CF(0, 0.09, 0) * CFrame.Angles(0, 0, math.pi / 2), Color3.fromRGB(70, 70, 72))
			b:box("MasterLink", V(0.25, 0.04, 0.12), CF(0, 0.2, 0), DARK)
			for k = 0, 3 do
				local a = k * math.pi / 2
				b:box("Hook", V(0.08, 0.06, 0.12), CF(math.cos(a) * 0.38, 0.05, math.sin(a) * 0.38), YEL)
			end
		end,
	})
	prop({
		id = "RG-WIRESLINGS",
		name = "Wire Rope Sling Set (rack)",
		category = "Connections & Rigging",
		class = "Equipment",
		tags = { "Rigging" },
		weightKg = 48,
		sizeM = V(1.2, 1.6, 0.5),
		description = "Rigging rack with tagged wire-rope slings of several lengths. Inspect before every lift.",
		build = function(b)
			b:box("Post", V(0.08, 1.6, 0.08), CF(-0.55, 0.8, 0), YEL)
			b:box("Post", V(0.08, 1.6, 0.08), CF(0.55, 0.8, 0), YEL)
			b:box("Rail", V(1.2, 0.08, 0.08), CF(0, 1.55, 0), YEL)
			b:box("Foot", V(1.2, 0.06, 0.5), CF(0, 0.03, 0), DARK)
			for k = 0, 4 do
				b:box("Sling", V(0.04, 1.2, 0.04), CF(-0.4 + k * 0.2, 0.95, 0.06), Color3.fromRGB(90, 90, 94), M.Metal, { nc = true })
			end
		end,
	})
	for _, bk in ipairs({ { "1M3", 1.0, 480 }, { "2M3", 2.0, 760 } }) do
		local sz = bk[2] ^ (1 / 3)
		prop({
			id = "RG-BUCKET-" .. bk[1],
			name = string.format("Concrete Bucket %.0f m³ (crane)", bk[2]),
			category = "Connections & Rigging",
			class = "Equipment",
			tags = { "Rigging", "Concrete" },
			weightKg = bk[3],
			sizeM = V(sz + 0.2, sz + 0.6, sz + 0.2),
			description = "Crane-hung concrete bucket with a hand-lever discharge gate, for pours the pump can't reach.",
			build = function(b)
				b:cylX("Body", sz, sz + 0.1, CF(0, 0.6 + sz / 2, 0) * CFrame.Angles(0, 0, math.pi / 2), Color3.fromRGB(110, 112, 116))
				b:box("Cone", V(sz * 0.6, 0.5, sz * 0.6), CF(0, 0.35, 0), Color3.fromRGB(100, 102, 106))
				b:box("Gate", V(0.3, 0.1, 0.3), CF(0, 0.08, 0), YEL)
				b:box("Bail", V(sz + 0.2, 0.08, 0.08), CF(0, sz + 0.7, 0), YEL)
				for _, sx in ipairs({ -1, 1 }) do
					b:box("Leg", V(0.08, 0.6, 0.08), CF(sx * sz * 0.4, 0.3, sx * sz * 0.4), DARK)
				end
			end,
			liftPoints = { V(0, sz + 0.75, 0) },
		})
	end
	prop({
		id = "RG-MANBASKET",
		name = "Crane Personnel Basket (2 person)",
		category = "Connections & Rigging",
		class = "Equipment",
		tags = { "Rigging", "Safety" },
		weightKg = 240,
		sizeM = V(1.6, 2.6, 1.2),
		description = "Engineered man-riding basket with four-leg bridle, gate and anchor points.",
		build = function(b)
			b:box("Floor", V(1.6, 0.08, 1.2), CF(0, 0.04, 0), C.Galvanized, M.DiamondPlate)
			for _, sx in ipairs({ -0.78, 0.78 }) do
				for _, sz in ipairs({ -0.58, 0.58 }) do
					b:box("Post", V(0.06, 1.1, 0.06), CF(sx, 0.6, sz), YEL)
					b:bar("Bridle", V(sx, 1.15, sz), V(0, 2.55, 0), 0.03, 0.03, Color3.fromRGB(90, 90, 94), M.Metal, { nc = true })
				end
			end
			b:box("Rail", V(1.6, 0.06, 0.06), CF(0, 1.15, 0.58), YEL)
			b:box("Rail", V(1.6, 0.06, 0.06), CF(0, 1.15, -0.58), YEL)
			b:box("Mesh", V(1.6, 1.0, 0.02), CF(0, 0.6, 0.6), C.Galvanized, M.DiamondPlate, { tr = 0.5, nc = true })
		end,
		liftPoints = { V(0, 2.6, 0) },
	})

	-------------------------------------------------------------------------
	-- Machinery (static equipment and parked plant)
	-------------------------------------------------------------------------
	prop({
		id = "MC-MINIEX",
		name = "Mini Excavator 3 t",
		category = "Machinery",
		class = "Decorative",
		tags = { "Machine" },
		weightKg = 3200,
		sizeM = V(3.6, 2.5, 1.6),
		description = "Parked compact excavator with a digging bucket. Crane it into place or leave it in the yard.",
		build = function(b)
			b:box("TrackL", V(2.0, 0.4, 0.3), CF(0, 0.2, -0.6), RUBBER, M.SmoothPlastic)
			b:box("TrackR", V(2.0, 0.4, 0.3), CF(0, 0.2, 0.6), RUBBER, M.SmoothPlastic)
			b:box("Body", V(1.6, 0.7, 1.5), CF(-0.1, 0.8, 0), YEL)
			b:box("Cab", V(0.8, 1.1, 0.8), CF(0.2, 1.7, 0.3), YEL)
			b:box("Glass", V(0.82, 0.7, 0.82), CF(0.2, 1.85, 0.3), GLASS, M.Glass, { tr = 0.3, nc = true })
			b:bar("Boom", V(0.7, 1.2, -0.3), V(1.6, 2.3, -0.3), 0.18, 0.18, YEL)
			b:bar("Stick", V(1.6, 2.3, -0.3), V(2.1, 0.8, -0.3), 0.14, 0.14, YEL)
			b:box("Bucket", V(0.45, 0.4, 0.55), CF(2.1, 0.45, -0.3), DARK)
			b:box("Blade", V(0.1, 0.35, 1.5), CF(-1.15, 0.25, 0), DARK)
		end,
	})
	prop({
		id = "MC-SKIDSTEER",
		name = "Skid Steer Loader",
		category = "Machinery",
		class = "Decorative",
		tags = { "Machine" },
		weightKg = 2900,
		sizeM = V(3.2, 2.0, 1.7),
		description = "Wheeled skid steer with a bucket — site clean-up and gravel moves.",
		build = function(b)
			wheelsAt(b, { -0.6, 0.6 }, { -0.75, 0.75 }, 0.75, 0.3)
			b:box("Body", V(1.8, 0.9, 1.2), CF(0, 0.85, 0), YEL)
			b:box("Cab", V(1.0, 0.9, 1.1), CF(0.1, 1.6, 0), DARK, M.Metal)
			b:box("Glass", V(0.02, 0.7, 0.9), CF(0.62, 1.6, 0), GLASS, M.Glass, { tr = 0.3, nc = true })
			b:box("Arm", V(1.6, 0.12, 0.12), CF(0.3, 1.5, 0.65), YEL)
			b:box("Arm", V(1.6, 0.12, 0.12), CF(0.3, 1.5, -0.65), YEL)
			b:box("Bucket", V(0.5, 0.5, 1.7), CF(1.35, 0.35, 0), DARK)
		end,
	})
	prop({
		id = "MC-SCISSOR",
		name = "Electric Scissor Lift 8 m",
		category = "Machinery",
		class = "Decorative",
		tags = { "Machine" },
		weightKg = 2200,
		sizeM = V(2.5, 2.3, 1.2),
		description = "Slab scissor lift (stowed) for ceiling and MEP work on finished floors.",
		build = function(b)
			wheelsAt(b, { -0.9, 0.9 }, { -0.5, 0.5 }, 0.38, 0.15)
			b:box("Chassis", V(2.4, 0.5, 1.1), CF(0, 0.45, 0), Color3.fromRGB(32, 92, 168))
			for k = 0, 2 do
				b:bar("Scissor", V(-0.9, 0.7 + k * 0.4, 0.5), V(0.9, 1.1 + k * 0.4, 0.5), 0.08, 0.08, YEL, M.Metal, { nc = true })
				b:bar("Scissor", V(0.9, 0.7 + k * 0.4, 0.5), V(-0.9, 1.1 + k * 0.4, 0.5), 0.08, 0.08, YEL, M.Metal, { nc = true })
			end
			b:box("Deck", V(2.5, 0.1, 1.2), CF(0, 1.95, 0), Color3.fromRGB(32, 92, 168))
			b:box("Rail", V(2.5, 0.05, 0.05), CF(0, 2.3, 0.58), YEL, M.Metal, { nc = true })
			b:box("Rail", V(2.5, 0.05, 0.05), CF(0, 2.3, -0.58), YEL, M.Metal, { nc = true })
		end,
	})
	prop({
		id = "MC-TELEHANDLER",
		name = "Telehandler 4 t / 17 m",
		category = "Machinery",
		class = "Decorative",
		tags = { "Machine" },
		weightKg = 11000,
		sizeM = V(6.0, 2.5, 2.4),
		description = "Parked telescopic handler with pallet forks. (Driving it is planned for a later update.)",
		build = function(b)
			wheelsAt(b, { -1.6, 1.6 }, { -1.0, 1.0 }, 1.2, 0.5)
			b:box("Frame", V(4.6, 0.7, 1.6), CF(0, 0.95, 0), YEL)
			b:box("Cab", V(1.4, 1.4, 0.9), CF(0.2, 1.9, -0.75), DARK)
			b:box("Glass", V(1.2, 1.0, 0.02), CF(0.2, 2.0, -1.21), GLASS, M.Glass, { tr = 0.3, nc = true })
			b:bar("Boom", V(-1.8, 2.0, 0.3), V(2.6, 1.3, 0.3), 0.45, 0.45, YEL)
			b:box("Carriage", V(0.2, 0.9, 1.2), CF(2.85, 0.9, 0.3), DARK)
			b:box("Fork", V(1.1, 0.05, 0.12), CF(3.4, 0.5, -0.05), DARK)
			b:box("Fork", V(1.1, 0.05, 0.12), CF(3.4, 0.5, 0.65), DARK)
		end,
	})
	prop({
		id = "MC-FORKLIFT",
		name = "Rough-Terrain Forklift",
		category = "Machinery",
		class = "Decorative",
		tags = { "Machine" },
		weightKg = 6000,
		sizeM = V(4.2, 2.6, 2.1),
		description = "Parked rough-terrain forklift with a tall mast.",
		build = function(b)
			wheelsAt(b, { -1.1, 1.0 }, { -0.85, 0.85 }, 1.0, 0.4)
			b:box("Body", V(3.0, 0.9, 1.6), CF(-0.2, 1.0, 0), Color3.fromRGB(220, 110, 30))
			b:box("Cage", V(1.2, 1.2, 1.2), CF(-0.3, 2.0, 0), DARK, M.Metal, { tr = 0.2 })
			b:box("Mast", V(0.2, 2.6, 1.0), CF(1.4, 1.3, 0), DARK)
			b:box("Fork", V(1.1, 0.06, 0.12), CF(2.0, 0.3, -0.35), DARK)
			b:box("Fork", V(1.1, 0.06, 0.12), CF(2.0, 0.3, 0.35), DARK)
		end,
	})
	prop({
		id = "MC-MIXERTRUCK",
		name = "Ready-Mix Concrete Truck",
		category = "Machinery",
		class = "Decorative",
		tags = { "Machine" },
		weightKg = 12000,
		sizeM = V(9.0, 3.7, 2.5),
		description = "Parked transit mixer with a rotating drum and chute. Pours themselves are made with the pump hose.",
		build = function(b)
			wheelsAt(b, { -3.4, 1.4, 2.8 }, { -1.0, 1.0 }, 1.05, 0.35)
			b:box("Frame", V(8.5, 0.4, 1.0), CF(0, 0.9, 0), DARK)
			b:box("Cab", V(1.9, 1.9, 2.4), CF(-3.4, 2.0, 0), Color3.fromRGB(236, 236, 232))
			b:box("Windshield", V(0.02, 0.8, 2.1), CF(-4.36, 2.4, 0), GLASS, M.Glass, { nc = true })
			b:cylX("Drum", 4.6, 2.2, CF(1.2, 2.4, 0) * CFrame.Angles(0, 0, math.rad(12)), Color3.fromRGB(230, 200, 60))
			b:box("Chute", V(1.2, 0.12, 0.4), CF(4.1, 2.0, 0) * CFrame.Angles(0, 0, math.rad(-25)), DARK)
		end,
	})
	prop({
		id = "MC-COMPRESSOR",
		name = "Towable Air Compressor 185 cfm",
		category = "Machinery",
		class = "Equipment",
		functional = "Engine",
		tags = { "Machine" },
		weightKg = 1100,
		sizeM = V(3.4, 1.4, 1.6),
		description = "Diesel air compressor for pneumatic tools. F to start or stop.",
		build = function(b)
			wheelsAt(b, { 0.2 }, { -0.75, 0.75 }, 0.6, 0.2)
			b:box("Canopy", V(2.0, 1.0, 1.3), CF(0.3, 0.9, 0), YEL)
			b:box("Drawbar", V(1.2, 0.08, 0.08), CF(-1.2, 0.5, 0), DARK)
			b:box("Panel", V(0.02, 0.4, 0.6), CF(1.31, 1.0, 0), DARK, M.SmoothPlastic, { nc = true })
		end,
	})
	prop({
		id = "MC-COMPACTOR",
		name = "Plate Compactor",
		category = "Machinery",
		class = "Decorative",
		tags = { "Machine" },
		weightKg = 88,
		sizeM = V(1.0, 1.0, 0.5),
		description = "Vibratory plate for compacting gravel sub-base.",
		build = function(b)
			b:box("Plate", V(0.6, 0.08, 0.5), CF(0, 0.04, 0), DARK)
			b:box("Engine", V(0.4, 0.35, 0.35), CF(0, 0.3, 0), Color3.fromRGB(200, 60, 30))
			b:bar("Handle", V(-0.2, 0.4, 0), V(-0.55, 0.95, 0), 0.04, 0.04, DARK)
		end,
	})
	prop({
		id = "MC-SAW",
		name = "Walk-Behind Concrete Saw",
		category = "Machinery",
		class = "Decorative",
		tags = { "Machine" },
		weightKg = 120,
		sizeM = V(1.4, 1.0, 0.6),
		description = "Flat saw for cutting control joints in cured slabs.",
		build = function(b)
			wheelsAt(b, { -0.4, 0.4 }, { -0.25, 0.25 }, 0.25, 0.06)
			b:box("Frame", V(1.0, 0.25, 0.5), CF(0, 0.3, 0), Color3.fromRGB(220, 110, 30))
			b:cylX("Blade", 0.02, 0.5, CF(0.5, 0.3, 0.28) * CFrame.Angles(0, math.pi / 2, 0), C.Galvanized)
			b:bar("Handle", V(-0.4, 0.45, 0), V(-0.75, 0.95, 0), 0.04, 0.04, DARK)
		end,
	})

	-------------------------------------------------------------------------
	-- Site safety
	-------------------------------------------------------------------------
	prop({
		id = "SF-EDGEGUARD-25",
		name = "Edge Protection Barrier 2.5 m",
		category = "Site Safety",
		tags = { "Safety", "Fence" },
		weightKg = 22,
		sizeM = V(2.5, 1.2, 0.5),
		description = "Free-standing mesh edge barrier for open slab edges and stair openings. Solid — you can't walk through it.",
		build = function(b)
			b:box("Mesh", V(2.4, 1.0, 0.02), CF(0, 0.65, 0), C.Galvanized, M.DiamondPlate, { tr = 0.5 })
			b:box("TopRail", V(2.5, 0.05, 0.05), CF(0, 1.17, 0), C.Safety)
			for _, sx in ipairs({ -1.2, 1.2 }) do
				b:box("Post", V(0.05, 1.2, 0.05), CF(sx, 0.6, 0), C.Safety)
				b:box("Foot", V(0.2, 0.08, 0.5), CF(sx, 0.04, 0), DARK)
			end
		end,
	})
	prop({
		id = "SF-HARDHAT",
		name = "PPE Station (hard hats & vests)",
		category = "Site Safety",
		tags = { "Safety" },
		weightKg = 30,
		sizeM = V(1.2, 1.8, 0.4),
		description = "Visitor PPE rack with hard hats, hi-vis vests and safety glasses.",
		build = function(b)
			b:box("Board", V(1.2, 1.2, 0.04), CF(0, 1.1, 0.15), C.OffWhite, M.SmoothPlastic)
			b:box("Legs", V(1.1, 0.5, 0.05), CF(0, 0.25, 0.15), DARK)
			for k = 0, 2 do
				b:box("Hat", V(0.25, 0.14, 0.28), CF(-0.35 + k * 0.35, 1.4, 0.02), k == 1 and C.OffWhite or C.Safety, M.SmoothPlastic, { nc = true })
				b:box("Vest", V(0.25, 0.35, 0.02), CF(-0.35 + k * 0.35, 0.95, 0.11), C.HiVis, M.Fabric, { nc = true })
			end
		end,
	})
	prop({
		id = "SF-EYEWASH",
		name = "Emergency Shower & Eyewash",
		category = "Site Safety",
		tags = { "Safety" },
		weightKg = 45,
		sizeM = V(0.8, 2.3, 0.8),
		description = "Self-contained emergency drench shower with eyewash bowl.",
		build = function(b)
			b:box("Base", V(0.6, 0.05, 0.6), CF(0, 0.025, 0), C.Safety)
			b:cylY("Pipe", 2.2, 0.06, V(0, 1.1, 0), C.HiVis)
			b:box("Arm", V(0.6, 0.05, 0.05), CF(0.3, 2.2, 0), C.HiVis)
			b:cylY("Head", 0.08, 0.3, V(0.55, 2.15, 0), C.HiVis)
			b:cylY("Bowl", 0.08, 0.3, V(0.2, 1.0, 0), C.HiVis)
		end,
	})
	prop({
		id = "SF-WARNLIGHT",
		name = "Amber Warning Beacon on Stand",
		category = "Site Safety",
		class = "Equipment",
		functional = "Light",
		tags = { "Safety" },
		weightKg = 8,
		sizeM = V(0.4, 1.5, 0.4),
		description = "Battery amber beacon for crane exclusion zones. F to switch on.",
		build = function(b)
			b:box("Foot", V(0.4, 0.05, 0.4), CF(0, 0.025, 0), DARK)
			b:box("Pole", V(0.04, 1.3, 0.04), CF(0, 0.7, 0), DARK)
			local lamp = b:box("Lamp1", V(0.18, 0.2, 0.18), CF(0, 1.42, 0), Color3.fromRGB(255, 170, 20), M.SmoothPlastic)
			local lens = b:box("Lens1", V(0.16, 0.16, 0.16), CF(0, 1.42, 0), Color3.fromRGB(255, 170, 20), M.Glass, { nc = true })
			lens:SetAttribute("Lens", true)
			local light = Instance.new("PointLight")
			light.Name = "Flood"
			light.Range = 12
			light.Brightness = 2
			light.Color = Color3.fromRGB(255, 170, 40)
			light.Enabled = false
			light.Parent = lamp
		end,
	})
	prop({
		id = "SF-SPILLKIT",
		name = "Spill Kit Bin",
		category = "Site Safety",
		tags = { "Safety" },
		weightKg = 25,
		sizeM = V(0.7, 0.9, 0.6),
		description = "Wheelie bin of absorbent pads and booms for fuel and hydraulic spills.",
		build = function(b)
			b:box("Bin", V(0.7, 0.85, 0.6), CF(0, 0.45, 0), Color3.fromRGB(230, 200, 30), M.SmoothPlastic)
			b:box("Lid", V(0.72, 0.05, 0.62), CF(0, 0.9, 0), Color3.fromRGB(200, 170, 20), M.SmoothPlastic)
		end,
	})
	prop({
		id = "SF-MUSTER",
		name = "Muster Point Sign",
		category = "Site Safety",
		tags = { "Safety" },
		weightKg = 12,
		sizeM = V(0.9, 2.2, 0.4),
		description = "Green emergency assembly-point sign on a post.",
		build = function(b)
			local board = b:box("Board", V(0.9, 0.7, 0.03), CF(0, 1.85, 0), Color3.fromRGB(0, 130, 70), M.SmoothPlastic)
			b:box("Post", V(0.06, 1.5, 0.06), CF(0, 0.75, 0.03), DARK)
			b:box("Foot", V(0.5, 0.06, 0.4), CF(0, 0.03, 0), RUBBER, M.SmoothPlastic)
			if not b.opts.preview then
				local gui = Instance.new("SurfaceGui")
				gui.Face = Enum.NormalId.Front
				gui.PixelsPerStud = 40
				gui.LightInfluence = 1
				gui.Parent = board
				local t = Instance.new("TextLabel")
				t.Size = UDim2.fromScale(1, 1)
				t.BackgroundTransparency = 1
				t.TextColor3 = Color3.new(1, 1, 1)
				t.Font = Enum.Font.GothamBlack
				t.TextScaled = true
				t.Text = "MUSTER\nPOINT"
				t.Parent = gui
			end
		end,
	})
	prop({
		id = "SF-WHEELSTOP",
		name = "Rubber Wheel Stop",
		category = "Site Safety",
		tags = { "Safety" },
		weightKg = 9,
		sizeM = V(1.8, 0.12, 0.15),
		description = "Recycled-rubber wheel stop for the delivery bays.",
		build = function(b)
			b:box("Stop", V(1.8, 0.12, 0.15), CF(0, 0.06, 0), RUBBER, M.SmoothPlastic)
			b:box("Stripe", V(0.3, 0.122, 0.152), CF(0, 0.06, 0), C.Safety, M.SmoothPlastic, { nc = true, ns = true })
		end,
	})
	prop({
		id = "SF-WATERBARRIER",
		name = "Water-Filled Barrier 2 m",
		category = "Site Safety",
		tags = { "Safety" },
		weightKg = 22,
		sizeM = V(2.0, 0.8, 0.45),
		description = "Interlocking plastic barrier (shown empty) for pedestrian routes.",
		build = function(b)
			b:box("Body", V(2.0, 0.65, 0.4), CF(0, 0.33, 0), Color3.fromRGB(230, 70, 30), M.SmoothPlastic)
			b:box("Top", V(1.9, 0.15, 0.25), CF(0, 0.72, 0), Color3.fromRGB(230, 70, 30), M.SmoothPlastic)
		end,
	})
	prop({
		id = "SF-NETTING",
		name = "Debris Netting Roll",
		category = "Site Safety",
		tags = { "Safety" },
		weightKg = 18,
		sizeM = V(1.5, 0.4, 0.4),
		description = "Roll of scaffold debris netting.",
		build = function(b)
			b:cylX("Roll", 1.5, 0.4, CF(0, 0.2, 0), Color3.fromRGB(40, 120, 60), M.Fabric)
		end,
	})

	-------------------------------------------------------------------------
	-- Site furnishings
	-------------------------------------------------------------------------
	for _, c in ipairs({ { "20", 6.06, 2300 }, { "40", 12.19, 3800 } }) do
		prop({
			id = "FN-CONTAINER-" .. c[1],
			name = "Storage Container " .. c[1] .. " ft",
			category = "Site Furnishings",
			tags = { "Storage" },
			weightKg = c[3],
			sizeM = V(c[2], 2.6, 2.44),
			description = "Corrugated steel storage container for tools and small materials.",
			build = function(b)
				local L = c[2]
				b:box("Body", V(L, 2.6, 2.44), CF(0, 1.3, 0), Color3.fromRGB(46, 84, 128), M.Metal)
				for k = 0, math.floor(L / 0.6) do
					b:box("Corrugation", V(0.08, 2.4, 2.46), CF(-L / 2 + 0.3 + k * 0.6, 1.3, 0), Color3.fromRGB(40, 76, 118), M.Metal, { nc = true, ns = true })
				end
				b:box("Doors", V(0.04, 2.4, 2.3), CF(L / 2 + 0.02, 1.3, 0), Color3.fromRGB(40, 76, 118), M.Metal, { nc = true })
				for _, sz in ipairs({ -0.4, 0.4 }) do
					b:box("LockBar", V(0.05, 2.3, 0.05), CF(L / 2 + 0.06, 1.3, sz), C.Galvanized, M.Metal, { nc = true, ns = true })
				end
			end,
			liftPoints = { V(-c[2] / 2 + 0.1, 2.6, -1.1), V(c[2] / 2 - 0.1, 2.6, 1.1) },
		})
	end
	prop({
		id = "FN-TOOLTRAILER",
		name = "Enclosed Tool Trailer",
		category = "Site Furnishings",
		tags = { "Storage" },
		weightKg = 1400,
		sizeM = V(4.8, 2.4, 2.1),
		description = "Single-axle enclosed trailer stocked with hand tools and consumables.",
		build = function(b)
			wheelsAt(b, { 0.3 }, { -1.0, 1.0 }, 0.7, 0.2)
			b:box("Box", V(3.8, 1.9, 2.0), CF(0.4, 1.4, 0), C.OffWhite, M.Metal)
			b:wedge("Nose", V(2.0, 1.9, 0.5), CF(-1.75, 1.4, 0) * CFrame.Angles(0, -math.pi / 2, 0), C.OffWhite, M.Metal)
			b:box("Tongue", V(1.0, 0.08, 0.08), CF(-2.3, 0.5, 0), DARK)
		end,
	})
	prop({
		id = "FN-WATERCOOLER",
		name = "Water Cooler on Table",
		category = "Site Furnishings",
		tags = { "Welfare" },
		weightKg = 30,
		sizeM = V(0.8, 1.3, 0.6),
		description = "Insulated water jug and cups for heat-stress breaks.",
		build = function(b)
			b:box("Table", V(0.8, 0.05, 0.6), CF(0, 0.8, 0), C.Timber, M.WoodPlanks)
			for _, x in ipairs({ -0.35, 0.35 }) do
				b:box("Leg", V(0.04, 0.8, 0.5), CF(x, 0.4, 0), DARK)
			end
			b:cylY("Jug", 0.45, 0.32, V(0, 1.05, 0), Color3.fromRGB(220, 60, 40), M.SmoothPlastic)
		end,
	})
	prop({
		id = "FN-HANDWASH",
		name = "Portable Hand-Wash Station",
		category = "Site Furnishings",
		tags = { "Welfare" },
		weightKg = 40,
		sizeM = V(0.9, 1.4, 0.7),
		description = "Foot-pump twin basin hand-wash station.",
		build = function(b)
			b:box("Body", V(0.9, 1.0, 0.7), CF(0, 0.5, 0), C.OffWhite, M.SmoothPlastic)
			b:box("Splash", V(0.9, 0.4, 0.06), CF(0, 1.2, 0.32), C.OffWhite, M.SmoothPlastic)
		end,
	})
	prop({
		id = "FN-SHELTER",
		name = "Break Shelter Canopy 3 × 3 m",
		category = "Site Furnishings",
		tags = { "Welfare" },
		weightKg = 60,
		sizeM = V(3.0, 2.6, 3.0),
		description = "Pop-up canopy for the crew's shaded break area.",
		build = function(b)
			for _, sx in ipairs({ -1.45, 1.45 }) do
				for _, sz in ipairs({ -1.45, 1.45 }) do
					b:box("Leg", V(0.05, 2.4, 0.05), CF(sx, 1.2, sz), C.Galvanized)
				end
			end
			b:box("Roof", V(3.0, 0.05, 3.0), CF(0, 2.45, 0), Color3.fromRGB(32, 80, 140), M.Fabric)
			b:wedge("Peak", V(3.0, 0.2, 1.5), CF(0, 2.57, -0.75), Color3.fromRGB(32, 80, 140), M.Fabric, { nc = true })
		end,
	})
	prop({
		id = "FN-REBARBUNDLE",
		name = "Rebar Bundle (decorative)",
		category = "Site Furnishings",
		tags = { "Storage" },
		weightKg = 900,
		sizeM = V(6.0, 0.35, 0.5),
		description = "Bundle of #5 reinforcing bars on timbers — set dressing for the laydown yard.",
		build = function(b)
			for _, x in ipairs({ -2, 2 }) do
				b:box("Timber", V(0.1, 0.1, 0.6), CF(x, 0.05, 0), C.Timber, M.Wood)
			end
			for i = 0, 2 do
				for j = 0, 3 do
					b:cylX("Bar", 6.0, 0.05, CF(0, 0.13 + i * 0.07, -0.15 + j * 0.1), Color3.fromRGB(110, 70, 50))
				end
			end
		end,
	})
	prop({
		id = "FN-PLYSTACK",
		name = "Plywood Stack (formwork)",
		category = "Site Furnishings",
		tags = { "Storage" },
		weightKg = 640,
		sizeM = V(2.44, 0.7, 1.22),
		description = "Stack of 18 mm formply sheets on bearers.",
		build = function(b)
			b:box("Bearers", V(2.3, 0.1, 1.2), CF(0, 0.05, 0), C.Timber, M.Wood)
			b:box("Sheets", V(2.44, 0.6, 1.22), CF(0, 0.4, 0), Color3.fromRGB(196, 150, 100), M.WoodPlanks)
		end,
	})
	prop({
		id = "FN-SANDBAGS",
		name = "Sandbag Stack",
		category = "Site Furnishings",
		tags = { "Storage" },
		weightKg = 300,
		sizeM = V(1.2, 0.5, 0.8),
		description = "Sandbags for weighting signs and barriers.",
		build = function(b)
			for i = 0, 2 do
				for j = 0, 1 do
					b:box("Bag", V(0.55, 0.15, 0.35), CF(-0.3 + j * 0.6 - (i % 2) * 0.1, 0.08 + i * 0.16, 0), Color3.fromRGB(180, 160, 110), M.Fabric)
					b:box("Bag", V(0.55, 0.15, 0.35), CF(-0.3 + j * 0.6 - (i % 2) * 0.1, 0.08 + i * 0.16, 0.38), Color3.fromRGB(176, 156, 106), M.Fabric)
				end
			end
		end,
	})
	prop({
		id = "FN-BINS",
		name = "Segregated Waste Bins (3)",
		category = "Site Furnishings",
		tags = { "Waste" },
		weightKg = 45,
		sizeM = V(2.2, 1.1, 0.8),
		description = "Colour-coded bins for metal, timber and general waste.",
		build = function(b)
			for k, col in ipairs({ Color3.fromRGB(60, 100, 170), Color3.fromRGB(120, 80, 50), Color3.fromRGB(60, 60, 64) }) do
				b:box("Bin", V(0.65, 1.0, 0.75), CF(-0.75 + (k - 1) * 0.75, 0.5, 0), col, M.SmoothPlastic)
			end
		end,
	})
end
