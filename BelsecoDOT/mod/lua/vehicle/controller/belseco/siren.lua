-- Belseco DOT Mega Pack
-- Siren / air horn controller.
--
-- Plays the generated tones in art/sound/belseco.  Tone changes are ramped so
-- the speaker never clicks, and the air horn is a momentary override that
-- ducks whatever tone is running underneath it.
--
-- Electrics published:
--   belseco_siren_mode   0..4  (off, wail, yelp, phaser, hi-lo)
--   belseco_siren_vol    0..1  live output level, useful for prop animation
--   belseco_airhorn      0/1
--   siren                0/1   vanilla-friendly flag
--
-- Author: Belseco Fleet Services

local M = {}

M.type = "auxiliary"
M.relevantDevice = nil
M.defaultOrder = 2010

local SOUND_DIR = "/art/sound/belseco/"

local tones = {
  {name = "Wail", file = "siren_wail.wav"},
  {name = "Yelp", file = "siren_yelp.wav"},
  {name = "Phaser", file = "siren_phaser.wav"},
  {name = "Hi-Lo", file = "siren_hilo.wav"},
}

local mode = 0
local lastTone = 1
local sources = {}
local airhornSource = nil
local airhornActive = false
local airhornTimer = 0

local backupSource = nil
local backupEnabled = true
local backupPlaying = false

local volume = 0
local targetVolume = 0
local maxVolume = 1.0
local rampRate = 6.0

local soundNodeId = 0

local function createSource(file)
  if not obj or not obj.createSFXSource2 then return nil end
  local ok, id = pcall(obj.createSFXSource2, obj, SOUND_DIR .. file, "AudioDefaultLoop3D", "belsecoSiren", soundNodeId, 0)
  if ok then return id end
  return nil
end

local function stopAll()
  for _, id in pairs(sources) do
    if id then
      obj:setVolume(id, 0)
      obj:stopSFX(id)
    end
  end
end

local function applyAudio()
  local activeIndex = mode
  for i, id in pairs(sources) do
    if id then
      local wanted = (i == activeIndex) and volume * maxVolume or 0
      obj:setVolume(id, wanted)
    end
  end
  if airhornSource then
    obj:setVolume(airhornSource, airhornActive and maxVolume or 0)
  end
end

local function updateGFX(dt)
  targetVolume = mode > 0 and 1 or 0

  -- the air horn ducks the tone underneath it so both stay intelligible
  local duck = airhornActive and 0.35 or 1.0

  local goal = targetVolume * duck
  if volume < goal then
    volume = math.min(goal, volume + rampRate * dt)
  elseif volume > goal then
    volume = math.max(goal, volume - rampRate * dt)
  end

  if airhornActive then
    airhornTimer = airhornTimer - dt
    if airhornTimer <= 0 then
      airhornActive = false
      if airhornSource then obj:stopSFX(airhornSource) end
    end
  end

  applyAudio()

  -- reversing alarm, the way every piece of DOT equipment is fitted
  local reversing = backupEnabled and (electrics.values.gearIndex or 0) < 0
  if reversing ~= backupPlaying then
    backupPlaying = reversing
    if backupSource then
      if reversing then
        obj:setVolume(backupSource, 0.75 * maxVolume)
        obj:playSFX(backupSource)
      else
        obj:stopSFX(backupSource)
      end
    end
  end

  local e = electrics.values
  e.belseco_siren_mode = mode
  e.belseco_siren_vol = volume
  e.belseco_airhorn = airhornActive and 1 or 0
  e.belseco_backup_alarm = backupPlaying and 1 or 0
  e.siren = mode > 0 and 1 or 0
end

-- ---------------------------------------------------------------------------
-- public API
-- ---------------------------------------------------------------------------

local function setMode(m)
  m = math.max(0, math.min(#tones, math.floor(tonumber(m) or 0)))
  if m == mode then return end

  if mode > 0 and sources[mode] then
    obj:setVolume(sources[mode], 0)
  end
  mode = m
  if mode > 0 then
    lastTone = mode
    if sources[mode] then
      obj:setVolume(sources[mode], 0)
      obj:playSFX(sources[mode])
    end
    gui.message({txt = "Siren: " .. tones[mode].name}, 2, "belseco.siren")
  else
    stopAll()
    volume = 0
    gui.message({txt = "Siren: OFF"}, 2, "belseco.siren")
  end
end

-- tap the tone button: off -> last used tone -> off
local function toggle()
  setMode(mode > 0 and 0 or lastTone)
end

local function cycleTone()
  if mode == 0 then
    setMode(lastTone)
  else
    setMode(mode % #tones + 1)
  end
end

local function airhorn(down)
  if down == false then
    airhornActive = false
    if airhornSource then obj:stopSFX(airhornSource) end
    return
  end
  airhornActive = true
  airhornTimer = 1.55
  if airhornSource then
    obj:setVolume(airhornSource, maxVolume)
    obj:playSFX(airhornSource)
  end
end

local function getState()
  return {
    mode = mode,
    toneName = mode > 0 and tones[mode].name or "Off",
    toneCount = #tones,
    volume = volume,
    airhorn = airhornActive,
  }
end

local function initSounds(jbeamData)
  soundNodeId = 0
  local nodeName = jbeamData and jbeamData.soundNode
  if nodeName and beamstate and beamstate.nodeNameMap and beamstate.nodeNameMap[nodeName] then
    soundNodeId = beamstate.nodeNameMap[nodeName]
  end

  for i, tone in ipairs(tones) do
    sources[i] = createSource(tone.file)
  end
  airhornSource = createSource("airhorn.wav")
  backupSource = createSource("backup_alarm.wav")

  maxVolume = jbeamData and jbeamData.volume or 1.0
  if jbeamData and jbeamData.backupAlarm ~= nil then
    backupEnabled = jbeamData.backupAlarm and true or false
  end
end

local function reset()
  mode = 0
  volume = 0
  airhornActive = false
  airhornTimer = 0
  backupPlaying = false
  stopAll()
  if airhornSource then obj:stopSFX(airhornSource) end
  if backupSource then obj:stopSFX(backupSource) end
end

local function init(jbeamData)
  reset()
end

M.init = init
M.initSounds = initSounds
M.resetSounds = initSounds
M.reset = reset
M.updateGFX = updateGFX

M.setMode = setMode
M.toggle = toggle
M.cycleTone = cycleTone
M.airhorn = airhorn
M.getState = getState

return M
