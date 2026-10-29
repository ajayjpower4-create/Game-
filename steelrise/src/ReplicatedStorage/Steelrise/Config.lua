-- STEELRISE shared configuration. Every tunable number lives here so the
-- server, the client and the shared rules agree on the same values.

local Config = {}

Config.Version = "0.1.0-phase1"
Config.GameTitle = "STEELRISE"
Config.Subtitle = "CONSTRUCTION SIMULATOR"

-- World scale: 3 studs per metre (a default 5.2-stud avatar reads as ~1.73 m).
Config.S = 3

function Config.m(meters)
	return meters * Config.S
end

function Config.toMeters(studs)
	return studs / Config.S
end

Config.Colors = {
	Charcoal = Color3.fromRGB(24, 26, 29),
	CharcoalLight = Color3.fromRGB(36, 39, 43),
	Panel = Color3.fromRGB(30, 33, 37),
	Steel = Color3.fromRGB(122, 128, 134),
	SteelDark = Color3.fromRGB(70, 74, 79),
	OffWhite = Color3.fromRGB(236, 233, 226),
	Muted = Color3.fromRGB(150, 154, 158),
	Safety = Color3.fromRGB(255, 194, 14),
	SafetyDark = Color3.fromRGB(196, 146, 0),
	Valid = Color3.fromRGB(88, 214, 141),
	Invalid = Color3.fromRGB(235, 87, 72),
	Info = Color3.fromRGB(110, 170, 235),

	-- Material colours used by the model factory
	MillSteel = Color3.fromRGB(86, 90, 95),
	PrimerGray = Color3.fromRGB(118, 121, 124),
	PrimerRed = Color3.fromRGB(122, 58, 46),
	Galvanized = Color3.fromRGB(164, 169, 172),
	Concrete = Color3.fromRGB(168, 165, 158),
	ConcreteDark = Color3.fromRGB(128, 126, 120),
	CraneYellow = Color3.fromRGB(240, 178, 18),
	Rubber = Color3.fromRGB(28, 28, 30),
	Timber = Color3.fromRGB(150, 112, 72),
	StrapOrange = Color3.fromRGB(232, 110, 28),
	Glass = Color3.fromRGB(140, 170, 185),
	HiVis = Color3.fromRGB(208, 255, 40),
}

-- Weight classes decide how an item can be handled.
--   Light   : one person, normal walking, can climb ladders while carrying
--   Medium  : one person, slow walking, no ladders
--   Heavy   : crane (or later: telehandler) only
--   Fixed   : not movable once delivered (site equipment)
Config.WeightClasses = {
	Light = { maxKg = 25, carry = true, walkSpeed = 14, climb = true, label = "Light — carry by hand" },
	Medium = { maxKg = 75, carry = true, walkSpeed = 9, climb = false, label = "Medium — carry slowly, no ladders" },
	Heavy = { maxKg = math.huge, carry = false, walkSpeed = 16, climb = true, label = "Heavy — crane lift required" },
	Fixed = { maxKg = math.huge, carry = false, walkSpeed = 16, climb = true, label = "Fixed equipment" },
}

function Config.weightClassFor(kg)
	if kg <= Config.WeightClasses.Light.maxKg then
		return "Light"
	elseif kg <= Config.WeightClasses.Medium.maxKg then
		return "Medium"
	end
	return "Heavy"
end

Config.WalkSpeed = 16

Config.Reach = {
	Interact = 13, -- studs from the character to the thing being used
	Place = 16, -- studs from the character to a hand-placement target
	Fasten = 13,
	CraneCab = 18, -- distance to the crane access ladder to climb in
}

-- Geometry shared by columns, beams, gussets, braces and panels (metres).
Config.Geo = {
	SeatOffset = 0.20, -- beam seat / gusset mount distance from column centre
	CladOffset = 0.24, -- cladding back face distance from column centre
	GussetLow = 0.60, -- gusset mount height above column base
	GussetHighFromTop = 0.90, -- gusset mount depth below column top
	GussetTip = 0.26, -- brace seat distance from gusset back edge
	DeckWidth = 0.75, -- every bay length is a multiple of this
	DeckDepth = 0.075,
	SlabTopping = 0.065, -- concrete above the deck ribs
	SlabTop = 0.14, -- finished floor above top of steel (deck + topping)
	PartitionClear = 0.79, -- partition height below the storey height (slab + beam zone)
	ParapetHeight = 1.1,
	FootingTop = 0.80, -- top of a precast footing above grade
	ScaffoldBayLong = 2.57,
	ScaffoldBayShort = 1.09,
	ScaffoldBays = { 0.73, 1.09, 1.57, 2.07, 2.57, 3.07 }, -- standard ring-lock bay lengths
	ScaffoldLift = 2.0,
	ScaffoldJack = 0.30, -- base-jack node height above the ground
	SnapTolerance = 0.08, -- studs
}

Config.Bays = { 3.0, 4.5, 6.0, 7.5, 9.0 }
Config.FloorHeights = { 3.0, 3.6, 4.2, 4.5, 4.8 }

Config.Grid = {
	Ground = 0.5, -- metres, default ground grid
	Fine = 0.1, -- metres, fine adjustment nudge
	RotateStep = 90,
	FreeRotateStep = 15,
}

Config.Crane = {
	SlewMaxSpeed = math.rad(7), -- rad/s
	SlewAccel = math.rad(4),
	SlewBrake = math.rad(7),
	TrolleyMaxSpeed = 7, -- studs/s
	TrolleyAccel = 4,
	TrolleyBrake = 7,
	HoistMaxSpeed = 10, -- studs/s, unloaded
	HoistLoadedSpeed = 5,
	HoistAccel = 8,
	HoistBrake = 14,
	LoadRotateSpeed = math.rad(18),
	PrecisionFactor = 0.25,
	PendulumGravity = 9.81 * 3, -- studs/s² (real g at world scale)
	SwingDamping = 0.10,
	SwingDampingAssist = 0.45,
	SlingDrop = 4.0, -- studs from hook to the rigging point
	AttachRange = 4.0, -- hook to lift point
	LandPosTolerance = 1.6, -- studs between hanging load and its target to land
	LandAngleTolerance = math.rad(14),
	RiggingKg = 60,
	StreamRate = 15, -- Hz, operator -> server
	AttributeRate = 12, -- Hz, server -> everyone
	RemoteRange = 600, -- studs from the mast for the radio remote
	WindWarnMs = 12, -- crane panel warning
	WindStopMs = 15, -- no new lifts above this
	WindForce = 0.0035, -- pendulum push per (m/s)² at full exposure
}

-- Capacity chart: full capacity inside FullRadius, then falls off with the
-- load moment. Both values in metres/kg so the HUD reads like a real chart.
function Config.craneCapacityKg(craneDef, radiusStuds)
	local r = math.max(Config.toMeters(radiusStuds), 0.1)
	local full = craneDef.maxKg or 8000
	local fullRadius = craneDef.fullRadiusM or 18
	if r <= fullRadius then
		return full
	end
	return math.floor(full * fullRadius / r)
end

Config.Delivery = {
	MaxTrailers = 3,
	TrailerMaxKg = 22000,
	BedLength = 16.0, -- metres
	BedWidth = 2.5,
	BedHeight = 1.45, -- deck height above the road
	MaxStackHeight = 2.4,
	ArriveSeconds = 7,
	DepartSeconds = 7,
	MaxLooseComponents = 400,
}

Config.Save = {
	StoreName = "SteelriseSaves_v1",
	ManualSlots = 3,
	AutosaveSlot = 0,
	AutosaveInterval = 180,
	MinSaveGap = 8, -- seconds between saves per player (DataStore budget)
}

Config.Graphics = {
	Default = "Balanced",
	Presets = {
		Low = { shadows = false, post = false, atmosphere = 0.25, particles = 0.3, detailDistance = 250 },
		Balanced = { shadows = true, post = true, atmosphere = 0.32, particles = 0.7, detailDistance = 450 },
		High = { shadows = true, post = true, atmosphere = 0.36, particles = 1.0, detailDistance = 800 },
		Ultra = { shadows = true, post = true, atmosphere = 0.38, particles = 1.0, detailDistance = 1600 },
	},
	Order = { "Low", "Balanced", "High", "Ultra" },
}

Config.AudioGroups = { "Master", "Machinery", "Tools", "Impacts", "Ambience", "Footsteps", "UI" }

Config.DefaultSettings = {
	graphics = "Balanced",
	shadows = true,
	post = true,
	particles = true,
	fov = 70,
	thirdPerson = false,
	mouseSensitivity = 1.0,
	assist = true,
	chat = "Small",
	tutorialDone = false,
	volumes = { Master = 0.8, Machinery = 0.8, Tools = 0.8, Impacts = 0.8, Ambience = 0.6, Footsteps = 0.7, UI = 0.6 },
}

return Config
