-- Screeching Brakes - vehicle side.
-- Runs inside each vehicle (stock or modded). It reads the brake pedal and the
-- vehicle speed from electrics, and plays a looping screech that gets louder the
-- harder you brake. The game engine side (lua/ge/extensions/screechingBrakes.lua)
-- loads this into vehicles and tells it which sound to use.

local M = {}

local GLOBAL_NAME = "screechingBrakesVE"

local SOUND_FILES = {
  car   = { "art/sound/screechingBrakes/car_screech.ogg",   "art/sound/screechingBrakes/car_screech.wav" },
  truck = { "art/sound/screechingBrakes/truck_screech.ogg", "art/sound/screechingBrakes/truck_screech.wav" },
}

-- looping 3D sound settings to try, in order
local LOOP_DESCRIPTIONS = { "AudioDefaultLoop3D", "AudioCloseLoop3D" }

-- "auto" uses the truck sound for vehicles at least this heavy
local TRUCK_MASS_KG = 5000

local min, max, abs = math.min, math.max, math.abs

local cfg = { active = false, sound = "car", volume = 0.8, threshold = 0.35 }

local sources = {}
local failed = {}
local playingKind = nil
local level = 0
local previewTime = 0
local previewKind = nil
local soundNode = nil
local massKg = nil

local function clamp(x, a, b) return min(max(x, a), b) end

local function smoothstep(a, b, x)
  local t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
end

local function getSoundNode()
  if soundNode then return soundNode end
  soundNode = 0
  pcall(function()
    local ref = v.data.refNodes[0].ref
    if ref then soundNode = ref end
  end)
  return soundNode
end

local function vehicleMass()
  if massKg then return massKg end
  local total = 0
  pcall(function()
    for _, n in pairs(v.data.nodes) do total = total + (n.nodeWeight or 0) end
  end)
  massKg = total
  return total
end

local function resolveKind(choice)
  if choice == "car" or choice == "truck" then return choice end
  if choice == "auto" then return vehicleMass() >= TRUCK_MASS_KG and "truck" or "car" end
  return nil
end

local function validId(ok, id)
  return ok and id ~= nil and id ~= -1
end

local function createSource(kind)
  if sources[kind] then return sources[kind] end
  if failed[kind] or not SOUND_FILES[kind] then return nil end
  local name = "screechingBrakes_" .. kind
  local node = getSoundNode()
  for _, file in ipairs(SOUND_FILES[kind]) do
    for _, desc in ipairs(LOOP_DESCRIPTIONS) do
      local ok, id = pcall(function() return obj:createSFXSource(file, desc, name, node) end)
      if not validId(ok, id) then
        ok, id = pcall(function() return obj:createSFXSource2(file, desc, name, node, 0) end)
      end
      if validId(ok, id) then
        sources[kind] = id
        return id
      end
    end
  end
  failed[kind] = true
  log("E", "screechingBrakes", "Could not load the " .. kind .. " screech sound")
  return nil
end

local function stopPlaying()
  local id = playingKind and sources[playingKind]
  if id then pcall(function() obj:stopSFX(id) end) end
  playingKind = nil
end

-- How loud the screech should be right now (0..1) and its pitch.
local function brakeLevel(kind)
  local e = electrics.values
  local brake = max(e.brake or 0, (e.parkingbrake or 0) * 0.9)
  local speed = abs(e.airspeed or e.wheelspeed or 0)
  if brake <= cfg.threshold or speed < 0.5 then return 0, 1 end

  local pedal = clamp((brake - cfg.threshold) / max(0.05, 1 - cfg.threshold), 0, 1)
  pedal = 0.35 + 0.65 * pedal
  if kind == "truck" then
    -- air brakes squeal hardest at low speed, all the way down to a stop
    return pedal * smoothstep(0.5, 3, speed), 0.97 + 0.06 * clamp(speed / 25, 0, 1)
  end
  -- tires screech louder and a little higher the faster you are going
  return pedal * smoothstep(1, 9, speed), 0.92 + 0.14 * clamp(speed / 30, 0, 1)
end

local function updateGFX(dt)
  local kind, target, pitch = nil, 0, 1
  if previewTime > 0 then
    previewTime = previewTime - dt
    kind, target = previewKind, 1
  elseif cfg.active then
    kind = resolveKind(cfg.sound)
    if kind then target, pitch = brakeLevel(kind) end
  end

  local rate = target > level and 12 or 5
  level = level + (target - level) * min(1, rate * dt)
  if target == 0 and level < 0.005 then level = 0 end

  if level > 0 and kind then
    local id = createSource(kind)
    if not id then return end
    local volume = level * cfg.volume
    pcall(function() obj:setVolumePitch(id, volume, pitch) end)
    if playingKind ~= kind then
      stopPlaying()
      pcall(function() obj:playSFX(id) end)
      playingKind = kind
    end
  elseif playingKind then
    stopPlaying()
  end
end

-- Called by the game engine side whenever the settings change.
local function setConfig(active, sound, volume, threshold)
  cfg.active = active and true or false
  cfg.sound = sound or cfg.sound
  cfg.volume = clamp(tonumber(volume) or cfg.volume, 0, 1)
  cfg.threshold = clamp(tonumber(threshold) or cfg.threshold, 0.02, 0.95)
  local kind = cfg.active and resolveKind(cfg.sound)
  if kind then createSource(kind) end -- load it now so the first stop is not silent
end

-- Plays the sound for a moment without braking, for the "Test" button.
local function previewSound(sound, seconds)
  previewKind = resolveKind(sound) or resolveKind(cfg.sound) or "car"
  createSource(previewKind)
  previewTime = tonumber(seconds) or 1.5
end

local function onReset()
  stopPlaying()
  level = 0
  previewTime = 0
end

local function onExtensionLoaded()
  rawset(_G, GLOBAL_NAME, M)
  obj:queueGameEngineLua(string.format("if screechingBrakes then screechingBrakes.onVehicleReady(%d) end", obj:getID()))
end

local function onExtensionUnloaded()
  stopPlaying()
  for _, id in pairs(sources) do
    pcall(function() obj:deleteSFXSource(id) end)
  end
  sources = {}
  if rawget(_G, GLOBAL_NAME) == M then rawset(_G, GLOBAL_NAME, nil) end
end

M.onExtensionLoaded = onExtensionLoaded
M.onExtensionUnloaded = onExtensionUnloaded
M.onReset = onReset
M.updateGFX = updateGFX
M.setConfig = setConfig
M.previewSound = previewSound

-- The game engine side reaches this script through this global.
rawset(_G, GLOBAL_NAME, M)

return M
