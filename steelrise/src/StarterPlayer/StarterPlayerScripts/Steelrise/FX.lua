-- Effects and positional audio for server-announced events (bolting,
-- welding, setting steel, straps, trucks), the local welding arc while the
-- player holds the stinger, machine loops for running equipment and the
-- site ambience beds.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local Debris = game:GetService("Debris")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Steelrise")
local Registry = require(Shared.ItemRegistry)
local Remotes = require(Shared.Remotes)

local State = require(script.Parent.State)
local Audio = require(script.Parent.Audio)

local FX = {}
local player = Players.LocalPlayer

local function anchorAt(pos)
	local a = Instance.new("Attachment")
	a.WorldPosition = pos
	a.Parent = workspace.Terrain
	Debris:AddItem(a, 3)
	return a
end

local function sparks(pos, amount, color)
	local scale = State.particleScale or 0.7
	if scale <= 0 then
		return
	end
	local a = anchorAt(pos)
	local e = Instance.new("ParticleEmitter")
	e.Rate = 0
	e.Lifetime = NumberRange.new(0.25, 0.6)
	e.Speed = NumberRange.new(6, 16)
	e.SpreadAngle = Vector2.new(70, 70)
	e.Acceleration = Vector3.new(0, -60, 0)
	e.Drag = 2
	e.LightEmission = 1
	e.LightInfluence = 0
	e.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.12), NumberSequenceKeypoint.new(1, 0) })
	e.Color = ColorSequence.new(color or Color3.fromRGB(255, 214, 140), Color3.fromRGB(255, 140, 40))
	e.Squash = NumberSequence.new(1.5)
	e.Parent = a
	e:Emit(math.max(1, math.floor(amount * scale)))
	local light = Instance.new("PointLight")
	light.Range = 10
	light.Brightness = 3
	light.Color = Color3.fromRGB(190, 210, 255)
	light.Parent = a
	task.delay(0.12, function()
		light.Enabled = false
	end)
end

local function dust(pos)
	local scale = State.particleScale or 0.7
	if scale <= 0 then
		return
	end
	local a = anchorAt(pos)
	local e = Instance.new("ParticleEmitter")
	e.Rate = 0
	e.Lifetime = NumberRange.new(0.6, 1.2)
	e.Speed = NumberRange.new(1, 3)
	e.SpreadAngle = Vector2.new(80, 20)
	e.Color = ColorSequence.new(Color3.fromRGB(150, 140, 126))
	e.Transparency = NumberSequence.new(0.5, 1)
	e.Size = NumberSequence.new(0.6, 2)
	e.LightInfluence = 1
	e.Parent = a
	e:Emit(math.floor(10 * scale))
end

local HANDLERS = {
	Bolt = function(pos)
		Audio.play("ImpactWrench", pos)
	end,
	Wedge = function(pos)
		Audio.play("HammerWedge", pos)
		sparks(pos, 3, Color3.fromRGB(255, 240, 200))
	end,
	Weld = function(pos)
		Audio.play("WeldArc", pos)
		sparks(pos, 18)
	end,
	Set = function(pos, itemId)
		local def = Registry.get(itemId or "")
		if def and def.tags.Concrete then
			Audio.play("ConcreteSet", pos)
			dust(pos)
		elseif def and def.tags.Scaffold then
			Audio.play("ScaffoldClank", pos)
		else
			Audio.play("SteelSet", pos)
		end
	end,
	Strap = function(pos)
		Audio.play("StrapRelease", pos)
	end,
	Rig = function(pos)
		Audio.play("SlingRattle", pos)
	end,
	Unhook = function(pos)
		Audio.play("SlingRattle", pos, 0.7)
	end,
	Drop = function(pos, itemId)
		local def = Registry.get(itemId or "")
		Audio.play(def and def.weightKg > 200 and "MetalContactHeavy" or "MetalContactLight", pos)
		if def and def.weightKg > 500 then
			dust(pos)
		end
	end,
	Pickup = function(pos)
		Audio.play("PickUp", pos)
	end,
	Dismantle = function(pos)
		Audio.play("ImpactWrench", pos, 0.8)
	end,
	TruckDepart = function(pos)
		Audio.play("TruckAirBrake", pos)
	end,
	TruckArrive = function() end,
	Pour = function(pos)
		Audio.play("ConcretePour", pos)
		dust(pos)
	end,
	Screed = function(pos)
		Audio.play("PowerTrowel", pos)
	end,
	Toggle = function(pos)
		Audio.play("UIClick", pos)
	end,
}

---------------------------------------------------------------------------
-- Machine loops for running equipment
---------------------------------------------------------------------------

local machineLoops = {}

local function updateMachines(dt)
	local site = State.site
	local comps = site and site:FindFirstChild("Components")
	local seen = {}
	if comps then
		for _, m in ipairs(comps:GetChildren()) do
			local def = Registry.get(m:GetAttribute("ItemId") or "")
			if def and def.functional == "Engine" then
				seen[m] = true
				local loop = machineLoops[m]
				if not loop then
					loop = Audio.loop("GeneratorLoop", m.PrimaryPart)
					machineLoops[m] = loop
				end
				loop:set(m:GetAttribute("On") and 1 or 0, 1)
				loop:step(dt)
			end
		end
	end
	for m, loop in pairs(machineLoops) do
		if not seen[m] then
			loop:destroy()
			machineLoops[m] = nil
		end
	end
end

---------------------------------------------------------------------------
-- Ambience
---------------------------------------------------------------------------

local ambience = {}

local function ambienceFor(style)
	for _, h in pairs(ambience) do
		h:destroy()
	end
	ambience = {}
	ambience.wind = Audio.loop("WindLoop")
	ambience.windHigh = Audio.loop("WindHighLoop")
	ambience.site = Audio.loop("DistantConstruction")
	if style == "Downtown" or style == "CityCenter" or style == "HighRise" then
		ambience.city = Audio.loop("CityTraffic")
	elseif style == "Waterfront" then
		ambience.city = Audio.loop("Harbour")
	end
end

local function updateAmbience(dt)
	if not ambience.wind then
		return
	end
	local playing = State.mode == "Play"
	local cam = workspace.CurrentCamera
	local height = cam and cam.CFrame.Position.Y or 0
	local high = math.clamp((height - 30) / 120, 0, 1)
	local windMs = State.site and State.site:GetAttribute("WindSpeed") or 6
	local gust = math.clamp(windMs / 10, 0.3, 1.4)
	ambience.wind:set(playing and (0.6 + 0.4 * (1 - high)) * gust or 0.3)
	ambience.windHigh:set(playing and high * gust or 0)
	ambience.site:set(playing and 0.8 or 0.4)
	if ambience.city then
		ambience.city:set(playing and 0.8 or 0.4)
	end
	for _, h in pairs(ambience) do
		h:step(dt)
	end
end

---------------------------------------------------------------------------
-- Local welding arc while holding the stinger on a weld spot
---------------------------------------------------------------------------

local weldPart = nil
local weldAcc = 0

function FX.init()
	Remotes.get("FX").OnClientEvent:Connect(function(kind, pos, extra)
		local h = HANDLERS[kind]
		if h and typeof(pos) == "Vector3" then
			h(pos, extra)
		end
	end)
	State.on("LocalWeldStart", function(part)
		weldPart = part
	end)
	State.on("LocalWeldStop", function()
		weldPart = nil
	end)
	State.on("SiteChanged", function(def)
		ambienceFor(def and def.style)
	end)
	RunService.Heartbeat:Connect(function(dt)
		updateMachines(dt)
		updateAmbience(dt)
		if weldPart and weldPart.Parent then
			weldAcc += dt
			if weldAcc > 0.08 then
				weldAcc = 0
				sparks(weldPart.Position, 4)
			end
		end
	end)
end

return FX
