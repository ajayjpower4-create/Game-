-- Every sound the game can play, with its mix group and playback behaviour.
--
-- IMPORTANT: no Roblox asset IDs are invented here. Entries with an empty
-- `ids` list are silent until you supply audio you have rights to use (your
-- own uploads, or Creator Store audio your experience is permitted to play).
-- Paste "rbxassetid://<id>" strings into `ids`; several ids = random
-- variations. See docs/AUDIO.md for the full list of required files.
-- Until then the default Roblox character sounds remain the only audio.

local AudioRegistry = {
	-- Crane
	CraneSlewMotor = { group = "Machinery", ids = {}, loop = true, volume = 0.55, min = 12, max = 260 },
	CraneTrolleyMotor = { group = "Machinery", ids = {}, loop = true, volume = 0.45, min = 10, max = 220 },
	CraneHoistWinch = { group = "Machinery", ids = {}, loop = true, volume = 0.6, min = 12, max = 260 },
	CraneBrake = { group = "Machinery", ids = {}, volume = 0.5, min = 10, max = 200, pitchVar = 0.08 },
	CraneWarningHorn = { group = "Machinery", ids = {}, volume = 0.6, min = 30, max = 500 },
	CableCreak = { group = "Machinery", ids = {}, volume = 0.35, min = 8, max = 120, pitchVar = 0.15 },

	-- Steel handling & impacts
	MetalContactHeavy = { group = "Impacts", ids = {}, volume = 0.8, min = 10, max = 300, pitchVar = 0.12 },
	MetalContactLight = { group = "Impacts", ids = {}, volume = 0.6, min = 6, max = 150, pitchVar = 0.15 },
	SteelSet = { group = "Impacts", ids = {}, volume = 0.7, min = 8, max = 220, pitchVar = 0.08 },
	ConcreteSet = { group = "Impacts", ids = {}, volume = 0.7, min = 8, max = 200, pitchVar = 0.08 },
	SlingRattle = { group = "Impacts", ids = {}, volume = 0.45, min = 6, max = 100, pitchVar = 0.15 },
	StrapRelease = { group = "Impacts", ids = {}, volume = 0.6, min = 6, max = 90, pitchVar = 0.1 },
	ScaffoldClank = { group = "Impacts", ids = {}, volume = 0.55, min = 6, max = 120, pitchVar = 0.18 },
	PickUp = { group = "Impacts", ids = {}, volume = 0.4, min = 4, max = 60, pitchVar = 0.1 },

	-- Tools
	ImpactWrench = { group = "Tools", ids = {}, volume = 0.75, min = 6, max = 160, pitchVar = 0.06 },
	HammerWedge = { group = "Tools", ids = {}, volume = 0.7, min = 6, max = 160, pitchVar = 0.12 },
	WeldArc = { group = "Tools", ids = {}, volume = 0.55, min = 6, max = 120, pitchVar = 0.05 },
	ConcretePour = { group = "Tools", ids = {}, volume = 0.7, min = 8, max = 160, pitchVar = 0.05 },
	PowerTrowel = { group = "Tools", ids = {}, volume = 0.6, min = 6, max = 120, pitchVar = 0.08 },

	-- Vehicles & machines
	TruckIdle = { group = "Machinery", ids = {}, loop = true, volume = 0.5, min = 12, max = 220 },
	TruckAirBrake = { group = "Machinery", ids = {}, volume = 0.7, min = 15, max = 300, pitchVar = 0.05 },
	TruckReverseBeeper = { group = "Machinery", ids = {}, loop = true, volume = 0.45, min = 15, max = 260 },
	GeneratorLoop = { group = "Machinery", ids = {}, loop = true, volume = 0.5, min = 8, max = 160 },

	-- Footsteps by surface
	StepSteel = { group = "Footsteps", ids = {}, volume = 0.45, min = 3, max = 50, pitchVar = 0.1 },
	StepConcrete = { group = "Footsteps", ids = {}, volume = 0.4, min = 3, max = 45, pitchVar = 0.1 },
	StepGravel = { group = "Footsteps", ids = {}, volume = 0.45, min = 3, max = 45, pitchVar = 0.12 },
	StepDirt = { group = "Footsteps", ids = {}, volume = 0.4, min = 3, max = 40, pitchVar = 0.12 },
	StepWood = { group = "Footsteps", ids = {}, volume = 0.4, min = 3, max = 45, pitchVar = 0.1 },
	StepGrating = { group = "Footsteps", ids = {}, volume = 0.5, min = 3, max = 50, pitchVar = 0.12 },

	-- Ambience (2D loops)
	WindLoop = { group = "Ambience", ids = {}, loop = true, volume = 0.35, twoD = true },
	WindHighLoop = { group = "Ambience", ids = {}, loop = true, volume = 0.5, twoD = true },
	DistantConstruction = { group = "Ambience", ids = {}, loop = true, volume = 0.3, twoD = true },
	CityTraffic = { group = "Ambience", ids = {}, loop = true, volume = 0.25, twoD = true },
	Harbour = { group = "Ambience", ids = {}, loop = true, volume = 0.25, twoD = true },
	LoadingAmbience = { group = "Ambience", ids = {}, loop = true, volume = 0.35, twoD = true },

	-- Interface
	UIClick = { group = "UI", ids = {}, volume = 0.4, twoD = true },
	UINotify = { group = "UI", ids = {}, volume = 0.35, twoD = true },
	UIError = { group = "UI", ids = {}, volume = 0.35, twoD = true },
	UIConfirm = { group = "UI", ids = {}, volume = 0.4, twoD = true },
}

return AudioRegistry
