-- Belseco DOT Mega Pack
-- Auxiliary lighting: scene floods, take-downs, alley lights, beacons, ground
-- lights and headlight wig-wags.
--
-- Also runs a very simple electrical load model.  Every fixture draws current;
-- with the engine off the load pulls the battery down and the console warns you
-- before you flatten it on scene.  This is deliberately forgiving - it is a
-- gameplay flavour system, not a simulation of the truck's charging circuit.
--
-- Electrics published:
--   belseco_aux_<key>   0/1 per fixture (wig-wags output their live flash state)
--   belseco_aux_load    total draw in amps
--   belseco_batt_soc    0..1 remaining battery charge
--
-- Author: Belseco Fleet Services

local M = {}

M.type = "auxiliary"
M.relevantDevice = nil
M.defaultOrder = 2030

-- key, label, current draw in amps
local fixtures = {
  {key = "sceneL", label = "Scene Flood - Left", amps = 9},
  {key = "sceneR", label = "Scene Flood - Right", amps = 9},
  {key = "sceneRear", label = "Scene Flood - Rear", amps = 12},
  {key = "takedown", label = "Take-Down Lights", amps = 8},
  {key = "alleyL", label = "Alley Light - Left", amps = 4},
  {key = "alleyR", label = "Alley Light - Right", amps = 4},
  {key = "ground", label = "Ground / Step Lights", amps = 2},
  {key = "beacon", label = "Roof Beacons", amps = 6},
  {key = "wigwag", label = "Headlight Wig-Wags", amps = 5},
  {key = "workArea", label = "Work Area Floods", amps = 15},
}

local state = {}
local wigwagPhase = 0
local wigwagSide = false

local BATTERY_AH = 210        -- two group-31 batteries, roughly
local charge = 1.0

local function totalLoad()
  local amps = 0
  for _, f in ipairs(fixtures) do
    if state[f.key] then
      amps = amps + f.amps
    end
  end
  return amps
end

local function engineRunning()
  local rpm = electrics.values.rpm or 0
  return rpm > 200
end

local function publish()
  local e = electrics.values
  for _, f in ipairs(fixtures) do
    if f.key == "wigwag" then
      -- wig-wags alternate, so publish two channels instead of one
      local on = state.wigwag and true or false
      e.belseco_aux_wigwagL = (on and wigwagSide) and 1 or 0
      e.belseco_aux_wigwagR = (on and not wigwagSide) and 1 or 0
      e.belseco_aux_wigwag = on and 1 or 0
    else
      e["belseco_aux_" .. f.key] = state[f.key] and 1 or 0
    end
  end
  e.belseco_aux_load = totalLoad()
  e.belseco_batt_soc = charge
end

local function updateGFX(dt)
  if state.wigwag then
    wigwagPhase = wigwagPhase + dt
    if wigwagPhase >= 0.42 then
      wigwagPhase = wigwagPhase - 0.42
      wigwagSide = not wigwagSide
    end
  end

  -- Drain is compressed 60x so it plays out over minutes rather than hours:
  -- one minute of game time costs an hour's worth of amp-hours.
  local amps = totalLoad()
  if engineRunning() then
    charge = math.min(1, charge + dt * 0.02)   -- alternator wins easily
  else
    charge = math.max(0, charge - (amps / BATTERY_AH) * (dt / 60))
  end

  publish()
end

-- ---------------------------------------------------------------------------
-- public API
-- ---------------------------------------------------------------------------

local function set(key, value)
  for _, f in ipairs(fixtures) do
    if f.key == key then
      state[key] = value and true or false
      gui.message({txt = f.label .. ": " .. (state[key] and "ON" or "OFF")}, 2, "belseco.aux." .. key)
      return
    end
  end
end

local function toggle(key)
  set(key, not state[key])
end

local function allOff()
  for _, f in ipairs(fixtures) do
    state[f.key] = false
  end
  gui.message({txt = "Auxiliary lighting off"}, 2, "belseco.aux")
end

-- one-touch on-scene package: floods, alleys, ground lights and beacons
local function scenePackage(on)
  for _, key in ipairs({"sceneL", "sceneR", "sceneRear", "alleyL", "alleyR", "ground", "beacon", "workArea"}) do
    state[key] = on and true or false
  end
  gui.message({txt = on and "Scene lighting deployed" or "Scene lighting stowed"}, 2, "belseco.aux")
end

local function getState()
  local list = {}
  for i, f in ipairs(fixtures) do
    list[i] = {key = f.key, label = f.label, amps = f.amps, on = state[f.key] and true or false}
  end
  return {
    fixtures = list,
    load = totalLoad(),
    charge = charge,
    charging = engineRunning(),
    lowBattery = charge < 0.35 and not engineRunning(),
  }
end

local function reset()
  for _, f in ipairs(fixtures) do
    state[f.key] = false
  end
  charge = 1.0
  wigwagPhase = 0
  wigwagSide = false
  publish()
end

local function init(jbeamData)
  reset()
end

M.init = init
M.reset = reset
M.updateGFX = updateGFX

M.set = set
M.toggle = toggle
M.allOff = allOff
M.scenePackage = scenePackage
M.getState = getState
M.fixtures = fixtures

return M
