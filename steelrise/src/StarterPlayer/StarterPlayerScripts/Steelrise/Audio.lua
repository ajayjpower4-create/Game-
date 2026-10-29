-- Client audio: mix groups with separate volumes, varied one-shots and
-- smooth machinery loops whose pitch/volume follow what the machine is doing.
-- Entries without supplied ids are silent (see AudioRegistry).

local SoundService = game:GetService("SoundService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Steelrise")
local Config = require(Shared.Config)
local AudioRegistry = require(Shared.AudioRegistry)

local Audio = {}
local groups = {}
local rng = Random.new()

function Audio.init(volumes)
	local master = SoundService:FindFirstChild("SR_Master") or Instance.new("SoundGroup")
	master.Name = "SR_Master"
	master.Parent = SoundService
	groups.Master = master
	for _, name in ipairs(Config.AudioGroups) do
		if name ~= "Master" then
			local g = master:FindFirstChild("SR_" .. name) or Instance.new("SoundGroup")
			g.Name = "SR_" .. name
			g.Parent = master
			groups[name] = g
		end
	end
	Audio.setVolumes(volumes or Config.DefaultSettings.volumes)
end

function Audio.setVolumes(volumes)
	for name, g in pairs(groups) do
		local v = volumes[name]
		if v then
			g.Volume = v
		end
	end
end

function Audio.has(key)
	local e = AudioRegistry[key]
	return e ~= nil and #e.ids > 0
end

local function makeSound(key, parent)
	local e = AudioRegistry[key]
	if not e or #e.ids == 0 then
		return nil
	end
	local s = Instance.new("Sound")
	s.Name = "SR_" .. key
	s.SoundId = e.ids[rng:NextInteger(1, #e.ids)]
	s.Volume = e.volume or 0.5
	s.Looped = e.loop == true
	s.SoundGroup = groups[e.group] or groups.Master
	if not e.twoD then
		s.RollOffMode = Enum.RollOffMode.InverseTapered
		s.RollOffMinDistance = e.min or 8
		s.RollOffMaxDistance = e.max or 150
	end
	if e.pitchVar then
		s.PlaybackSpeed = 1 + rng:NextNumber(-e.pitchVar, e.pitchVar)
	end
	s.Parent = parent
	return s
end

-- One-shot. `where` = BasePart/Attachment (positional), Vector3, or nil (2D).
function Audio.play(key, where, volumeScale)
	local e = AudioRegistry[key]
	if not e or #e.ids == 0 then
		return nil
	end
	local parent = SoundService
	local temp = nil
	if typeof(where) == "Vector3" then
		temp = Instance.new("Attachment")
		temp.WorldPosition = where
		temp.Parent = workspace.Terrain
		parent = temp
	elseif typeof(where) == "Instance" then
		parent = where
	end
	local s = makeSound(key, parent)
	if not s then
		if temp then
			temp:Destroy()
		end
		return nil
	end
	s.Volume = s.Volume * (volumeScale or 1)
	s.Ended:Connect(function()
		s:Destroy()
		if temp then
			temp:Destroy()
		end
	end)
	s:Play()
	task.delay(12, function()
		if s.Parent then
			s:Destroy()
		end
		if temp and temp.Parent then
			temp:Destroy()
		end
	end)
	return s
end

-- Machinery loop handle with smoothed level control.
function Audio.loop(key, parent)
	local s = makeSound(key, parent or SoundService)
	local e = AudioRegistry[key]
	local handle = { level = 0, target = 0 }
	if not s then
		function handle:set() end
		function handle:step() end
		function handle:destroy() end
		return handle
	end
	local baseVol = e.volume or 0.5
	s.Volume = 0
	s:Play()
	function handle:set(level, pitch)
		self.target = math.clamp(level, 0, 1.2)
		self.pitch = pitch
	end
	function handle:step(dt)
		self.level += (self.target - self.level) * math.min(dt * 6, 1)
		s.Volume = baseVol * self.level
		if self.pitch then
			s.PlaybackSpeed = s.PlaybackSpeed + (self.pitch - s.PlaybackSpeed) * math.min(dt * 4, 1)
		end
	end
	function handle:destroy()
		s:Destroy()
	end
	return handle
end

-- All sound ids that should be preloaded by the loading screen.
function Audio.preloadList()
	local list = {}
	for key, e in pairs(AudioRegistry) do
		for _, id in ipairs(e.ids) do
			local s = Instance.new("Sound")
			s.Name = key
			s.SoundId = id
			table.insert(list, s)
		end
	end
	return list
end

return Audio
