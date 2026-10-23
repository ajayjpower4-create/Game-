-- Screeching Brakes - game engine side.
-- Loads the screech script into every vehicle (stock or modded), keeps the
-- settings, remembers which sound each vehicle uses, and talks to the UI app.
--
-- Console commands (open the console with the ~ key):
--   screechingBrakes.setVehicleSound("truck")   -- "car", "truck", "auto", "off" or "default"
--   screechingBrakes.setDefaultSound("car")     -- sound for vehicles you have not picked one for
--   screechingBrakes.toggleEnabled()
--   screechingBrakes.testSound()

local M = {}

local SETTINGS_FILE = "settings/screechingBrakes.json"
local VE_NAME = "screechingBrakesVE"
local VE_DIR = "lua/vehicle/extensions/screechingBrakes"
local SOUNDS = { car = true, truck = true, auto = true, off = true }
local SOUND_LABELS = { car = "Car screech", truck = "Truck screech", auto = "Auto (by weight)", off = "Off" }
local CYCLE = { car = "truck", truck = "off", off = "car", auto = "car" }

local settings = {
  enabled = true,
  defaultSound = "car",
  volume = 0.8,
  sensitivity = 0.35,
  allVehicles = false,
  perModel = {},
}

local saveTimer = nil
local ensureTimer = 0

local function clamp(x, a, b) return math.min(math.max(x, a), b) end

local function toast(msg)
  guihooks.trigger("toastrMsg", { type = "info", title = "Screeching Brakes", msg = msg })
end

local function loadSettings()
  local ok, data = pcall(jsonReadFile, SETTINGS_FILE)
  if not ok or type(data) ~= "table" then return end
  if type(data.enabled) == "boolean" then settings.enabled = data.enabled end
  if SOUNDS[data.defaultSound] then settings.defaultSound = data.defaultSound end
  if type(data.volume) == "number" then settings.volume = clamp(data.volume, 0, 1) end
  if type(data.sensitivity) == "number" then settings.sensitivity = clamp(data.sensitivity, 0.02, 0.95) end
  if type(data.allVehicles) == "boolean" then settings.allVehicles = data.allVehicles end
  if type(data.perModel) == "table" then
    for model, sound in pairs(data.perModel) do
      if SOUNDS[sound] then settings.perModel[model] = sound end
    end
  end
end

local function saveSettings()
  pcall(jsonWriteFile, SETTINGS_FILE, settings, true)
end

local function saveSoon()
  saveTimer = 1
end

local function modelOf(veh)
  local ok, name = pcall(function() return veh:getJBeamFilename() end)
  return ok and name or "unknown"
end

local function soundForModel(model)
  return settings.perModel[model] or settings.defaultSound
end

local function playerVehicle()
  return be:getPlayerVehicle(0)
end

local function isActive(veh, playerId)
  if not settings.enabled then return false end
  if soundForModel(modelOf(veh)) == "off" then return false end
  return settings.allVehicles or veh:getID() == playerId
end

local function ensureLoadedCmd()
  return string.format("if rawget(_G, %q) == nil then extensions.loadModulesInDirectory(%q) end", VE_NAME, VE_DIR)
end

local function configCmd(active, sound)
  return string.format("local m = rawget(_G, %q); if m then m.setConfig(%s, %q, %.3f, %.3f) end",
    VE_NAME, tostring(active), sound, settings.volume, settings.sensitivity)
end

local function pushVehicle(veh, playerId, loadIfNeeded)
  if not veh then return end
  local active = isActive(veh, playerId)
  if active and loadIfNeeded then veh:queueLuaCommand(ensureLoadedCmd()) end
  veh:queueLuaCommand(configCmd(active, soundForModel(modelOf(veh))))
end

local function forEachVehicle(fn)
  local ok, vehicles = pcall(getAllVehicles)
  if not ok or type(vehicles) ~= "table" then
    local veh = playerVehicle()
    if veh then fn(veh) end
    return
  end
  for _, veh in ipairs(vehicles) do fn(veh) end
end

local function pushAll()
  local pv = playerVehicle()
  local pid = pv and pv:getID()
  forEachVehicle(function(veh) pushVehicle(veh, pid, true) end)
end

local function sendState()
  local veh = playerVehicle()
  local model = veh and modelOf(veh) or nil
  guihooks.trigger("ScreechingBrakesState", {
    enabled = settings.enabled,
    defaultSound = settings.defaultSound,
    volume = settings.volume,
    sensitivity = settings.sensitivity,
    allVehicles = settings.allVehicles,
    vehicleModel = model,
    vehicleSound = model and (settings.perModel[model] or "default") or "default",
    effectiveSound = model and soundForModel(model) or settings.defaultSound,
  })
end

local function changed()
  saveSoon()
  pushAll()
  sendState()
end

-- UI app / keybinding / console API --------------------------------------------

local function requestState()
  sendState()
end

local function setEnabled(on)
  settings.enabled = on and true or false
  changed()
end

local function toggleEnabled()
  setEnabled(not settings.enabled)
  toast(settings.enabled and "Screeching brakes ON" or "Screeching brakes OFF")
end

local function setDefaultSound(sound)
  if not SOUNDS[sound] then return end
  settings.defaultSound = sound
  changed()
end

-- Picks the sound for the vehicle you are driving. It is remembered for that
-- vehicle (every config of the same model) from now on. "default" forgets it.
local function setVehicleSound(sound)
  local veh = playerVehicle()
  if not veh then return end
  local model = modelOf(veh)
  if sound == "default" then
    settings.perModel[model] = nil
  elseif SOUNDS[sound] then
    settings.perModel[model] = sound
  else
    return
  end
  changed()
end

local function cycleVehicleSound()
  local veh = playerVehicle()
  if not veh then return end
  local nextSound = CYCLE[soundForModel(modelOf(veh))] or "car"
  setVehicleSound(nextSound)
  toast("This vehicle: " .. SOUND_LABELS[nextSound])
end

local function setVolume(value)
  settings.volume = clamp(tonumber(value) or settings.volume, 0, 1)
  changed()
end

local function setSensitivity(value)
  settings.sensitivity = clamp(tonumber(value) or settings.sensitivity, 0.02, 0.95)
  changed()
end

local function setAllVehicles(on)
  settings.allVehicles = on and true or false
  changed()
end

local function testSound(sound)
  local veh = playerVehicle()
  if not veh then return end
  local choice = sound or soundForModel(modelOf(veh))
  if choice == "off" then choice = "car" end
  veh:queueLuaCommand(ensureLoadedCmd())
  veh:queueLuaCommand(string.format("local m = rawget(_G, %q); if m then m.previewSound(%q, 1.6) end", VE_NAME, choice))
end

-- Called by a vehicle once the screech script has loaded inside it.
local function onVehicleReady(vehId)
  local veh = be:getObjectByID(vehId)
  if not veh then return end
  local pv = playerVehicle()
  pushVehicle(veh, pv and pv:getID(), false)
end

-- Game hooks ---------------------------------------------------------------------

local function onExtensionLoaded()
  loadSettings()
  pushAll()
end

local function onExtensionUnloaded()
  forEachVehicle(function(veh) veh:queueLuaCommand(configCmd(false, "off")) end)
  if saveTimer then saveSettings() end
end

local function onVehicleSpawned(vehId)
  local veh = be:getObjectByID(vehId)
  if not veh then return end
  local pv = playerVehicle()
  pushVehicle(veh, pv and pv:getID(), true)
  sendState()
end

local function onVehicleSwitched(oldId, newId)
  pushAll()
  sendState()
end

local function onUpdate(dtReal)
  dtReal = dtReal or 0
  if saveTimer then
    saveTimer = saveTimer - dtReal
    if saveTimer <= 0 then
      saveTimer = nil
      saveSettings()
    end
  end
  -- Vehicles that get reloaded (Ctrl+R) lose their scripts, so check every couple of seconds.
  ensureTimer = ensureTimer + dtReal
  if ensureTimer >= 2 then
    ensureTimer = 0
    local pv = playerVehicle()
    local pid = pv and pv:getID()
    forEachVehicle(function(veh)
      if isActive(veh, pid) then veh:queueLuaCommand(ensureLoadedCmd()) end
    end)
  end
end

M.onExtensionLoaded = onExtensionLoaded
M.onExtensionUnloaded = onExtensionUnloaded
M.onVehicleSpawned = onVehicleSpawned
M.onVehicleSwitched = onVehicleSwitched
M.onUpdate = onUpdate

M.onVehicleReady = onVehicleReady
M.requestState = requestState
M.setEnabled = setEnabled
M.toggleEnabled = toggleEnabled
M.setDefaultSound = setDefaultSound
M.setVehicleSound = setVehicleSound
M.cycleVehicleSound = cycleVehicleSound
M.setVolume = setVolume
M.setSensitivity = setSensitivity
M.setAllVehicles = setAllVehicles
M.testSound = testSound

return M
