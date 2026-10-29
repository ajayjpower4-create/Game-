-- Surface-aware footsteps for the local character. Silent until step sounds
-- are supplied in AudioRegistry; once they are, the default running sound is
-- muted so the two don't double up.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")

local State = require(script.Parent.State)
local Audio = require(script.Parent.Audio)

local Footsteps = {}
local player = Players.LocalPlayer

local SURFACE = {
	[Enum.Material.Metal] = "StepSteel",
	[Enum.Material.DiamondPlate] = "StepGrating",
	[Enum.Material.CorrodedMetal] = "StepSteel",
	[Enum.Material.Concrete] = "StepConcrete",
	[Enum.Material.Pavement] = "StepConcrete",
	[Enum.Material.Asphalt] = "StepConcrete",
	[Enum.Material.Slate] = "StepGravel",
	[Enum.Material.Pebble] = "StepGravel",
	[Enum.Material.Ground] = "StepDirt",
	[Enum.Material.Mud] = "StepDirt",
	[Enum.Material.Grass] = "StepDirt",
	[Enum.Material.LeafyGrass] = "StepDirt",
	[Enum.Material.Wood] = "StepWood",
	[Enum.Material.WoodPlanks] = "StepWood",
}

function Footsteps.init()
	local anyConfigured = false
	for _, key in pairs(SURFACE) do
		if Audio.has(key) then
			anyConfigured = true
		end
	end
	if not anyConfigured then
		return
	end
	local acc = 0
	RunService.Heartbeat:Connect(function(dt)
		local c = player.Character
		local hum = c and c:FindFirstChildOfClass("Humanoid")
		local hrp = c and c:FindFirstChild("HumanoidRootPart")
		if not hum or not hrp or State.mode ~= "Play" then
			return
		end
		local running = hrp:FindFirstChild("Running")
		if running and running:IsA("Sound") then
			running.Volume = 0
		end
		local speed = Vector3.new(hrp.AssemblyLinearVelocity.X, 0, hrp.AssemblyLinearVelocity.Z).Magnitude
		if hum.FloorMaterial == Enum.Material.Air or speed < 2 then
			acc = 0.3
			return
		end
		acc += dt
		local interval = math.clamp(5.5 / speed, 0.28, 0.6)
		if acc >= interval then
			acc = 0
			local key = SURFACE[hum.FloorMaterial] or "StepConcrete"
			Audio.play(key, hrp.Position - Vector3.new(0, 2.8, 0), math.clamp(speed / 16, 0.5, 1))
		end
	end)
end

return Footsteps
