-- Belseco DOT Mega Pack
-- Cab console: the single entry point the UI app, the keybinds and the
-- in-cab switch props all talk to.
--
-- It owns three things:
--   1. master power - one switch that kills every upfit system at once
--   2. response presets - one button that sets a coherent whole-truck posture
--   3. the switch panel electrics that drive the physical rocker props
--
-- Nothing here duplicates the other controllers' logic; it delegates to them so
-- there is exactly one place that decides how a lightbar or a spreader behaves.
--
-- Author: Belseco Fleet Services

local M = {}

M.type = "auxiliary"
M.relevantDevice = nil
M.defaultOrder = 2100

local master = true

-- switch panel layout, top-left to bottom-right; each entry reports the state
-- of one system so the matching rocker prop can sit in the right position
local switchPanel = {
  {key = "master", label = "MASTER"},
  {key = "lightbar", label = "BAR"},
  {key = "siren", label = "SIREN"},
  {key = "advisor", label = "ADVISOR"},
  {key = "arrowboard", label = "ARROW"},
  {key = "sceneL", label = "SCN L"},
  {key = "sceneR", label = "SCN R"},
  {key = "sceneRear", label = "SCN RR"},
  {key = "takedown", label = "TAKEDN"},
  {key = "alleyL", label = "ALLEY L"},
  {key = "alleyR", label = "ALLEY R"},
  {key = "ground", label = "GROUND"},
  {key = "beacon", label = "BEACON"},
  {key = "wigwag", label = "WIGWAG"},
  {key = "workArea", label = "WORK"},
  {key = "spreader", label = "SPRDR"},
}

local function ctrl(name)
  if controller.getControllerSafe then
    return controller.getControllerSafe(name)
  end
  local ok, c = pcall(controller.getController, name)
  if ok then return c end
  return nil
end

local function lightbar() return ctrl("belsecoLightbar") end
local function siren() return ctrl("belsecoSiren") end
local function arrowboard() return ctrl("belsecoArrowBoard") end
local function aux() return ctrl("belsecoAuxLights") end
local function plow() return ctrl("belsecoPlow") end
local function stock() return ctrl("belsecoStockLights") end

-- ---------------------------------------------------------------------------
-- switch panel state
-- ---------------------------------------------------------------------------

-- Reading the switch panel straight off getState() would build five state
-- tables per switch per frame. Instead the auxiliary fixtures are read from the
-- electrics values they already publish, and the four system switches from a
-- single state fetch each.
local function switchValue(key, lbState, srState, abState, plState)
  local e = electrics.values
  if key == "master" then return master and 1 or 0 end
  if key == "lightbar" then return (lbState and lbState.mode > 0) and 1 or 0 end
  if key == "siren" then return (srState and srState.mode > 0) and 1 or 0 end
  if key == "advisor" then return (lbState and lbState.advisor > 0) and 1 or 0 end
  if key == "arrowboard" then return (abState and abState.mode > 0) and 1 or 0 end
  if key == "spreader" then return (plState and plState.spreaderOn) and 1 or 0 end
  return (e["belseco_aux_" .. key] or 0) > 0 and 1 or 0
end

local function publish()
  local e = electrics.values
  local lb, sr, ab, pl = lightbar(), siren(), arrowboard(), plow()
  local lbState = lb and lb.getState() or nil
  local srState = sr and sr.getState() or nil
  local abState = ab and ab.getState() or nil
  local plState = pl and pl.getState() or nil

  for i, sw in ipairs(switchPanel) do
    e["belseco_sw_" .. i] = switchValue(sw.key, lbState, srState, abState, plState)
  end
  e.belseco_master = master and 1 or 0
end

-- ---------------------------------------------------------------------------
-- presets
-- ---------------------------------------------------------------------------

local function allOff()
  local lb, sr, ab, ax = lightbar(), siren(), arrowboard(), aux()
  if lb then lb.setMode(0) lb.setAdvisor(0) end
  if sr then sr.setMode(0) end
  if ab then ab.setMode(0) ab.setDeploy(0) end
  if ax then ax.allOff() end
end

local presets = {
  travel = function()
    allOff()
    gui.message({txt = "Preset: TRAVEL"}, 2, "belseco.preset")
  end,

  responding = function()
    local lb, sr, ax = lightbar(), siren(), aux()
    if lb then lb.setMode(2) lb.setAdvisor(0) end
    if sr then sr.setMode(1) end
    if ax then
      ax.allOff()
      ax.set("wigwag", true)
      ax.set("takedown", true)
    end
    gui.message({txt = "Preset: RESPONDING"}, 2, "belseco.preset")
  end,

  onScene = function()
    local lb, sr, ax = lightbar(), siren(), aux()
    if lb then lb.setMode(3) end
    if sr then sr.setMode(0) end
    if ax then ax.scenePackage(true) end
    gui.message({txt = "Preset: ON SCENE"}, 2, "belseco.preset")
  end,

  blockLeft = function()
    local lb, ab, ax = lightbar(), arrowboard(), aux()
    if lb then lb.setMode(3) lb.setAdvisor(1) end
    if ab then ab.setDeploy(1) ab.setMode(3) end
    if ax then ax.scenePackage(true) end
    gui.message({txt = "Preset: LANE BLOCK - MERGE LEFT"}, 3, "belseco.preset")
  end,

  blockRight = function()
    local lb, ab, ax = lightbar(), arrowboard(), aux()
    if lb then lb.setMode(3) lb.setAdvisor(2) end
    if ab then ab.setDeploy(1) ab.setMode(4) end
    if ax then ax.scenePackage(true) end
    gui.message({txt = "Preset: LANE BLOCK - MERGE RIGHT"}, 3, "belseco.preset")
  end,

  shutdown = function()
    allOff()
    gui.message({txt = "Preset: SHUT DOWN"}, 2, "belseco.preset")
  end,
}

-- ---------------------------------------------------------------------------
-- dispatch - the one function the UI app and keybinds call
-- ---------------------------------------------------------------------------

local actions = {
  ["master.toggle"] = function()
    master = not master
    if not master then allOff() end
    gui.message({txt = "Upfit master: " .. (master and "ON" or "OFF")}, 2, "belseco.master")
  end,
  ["all.off"] = allOff,
  ["stock.toggle"] = function() local c = stock() if c then c.toggle() end end,

  ["lightbar.cycle"] = function(v) local c = lightbar() if c then c.cycleMode() end end,
  ["lightbar.toggle"] = function() local c = lightbar() if c then c.toggle() end end,
  ["lightbar.mode"] = function(v) local c = lightbar() if c then c.setMode(v) end end,
  ["lightbar.pattern"] = function(v) local c = lightbar() if c then c.setPattern(v) end end,
  ["lightbar.patternCycle"] = function() local c = lightbar() if c then c.cyclePattern() end end,

  ["advisor.cycle"] = function() local c = lightbar() if c then c.cycleAdvisor() end end,
  ["advisor.mode"] = function(v) local c = lightbar() if c then c.setAdvisor(v) end end,

  ["siren.toggle"] = function() local c = siren() if c then c.toggle() end end,
  ["siren.cycle"] = function() local c = siren() if c then c.cycleTone() end end,
  ["siren.mode"] = function(v) local c = siren() if c then c.setMode(v) end end,
  ["siren.airhornDown"] = function() local c = siren() if c then c.airhorn(true) end end,
  ["siren.airhornUp"] = function() local c = siren() if c then c.airhorn(false) end end,

  ["arrowboard.cycle"] = function() local c = arrowboard() if c then c.cycleMode() end end,
  ["arrowboard.mode"] = function(v) local c = arrowboard() if c then c.setMode(v) end end,
  ["arrowboard.deploy"] = function() local c = arrowboard() if c then c.toggleDeploy() end end,

  ["aux.toggle"] = function(v) local c = aux() if c then c.toggle(v) end end,
  ["aux.scene"] = function(v) local c = aux() if c then c.scenePackage(v ~= false and v ~= 0) end end,
  ["aux.off"] = function() local c = aux() if c then c.allOff() end end,

  ["plow.lift"] = function() local c = plow() if c then c.toggleLift() end end,
  ["plow.float"] = function() local c = plow() if c then c.toggleFloat() end end,
  ["plow.left"] = function() local c = plow() if c then c.angleLeft() end end,
  ["plow.right"] = function() local c = plow() if c then c.angleRight() end end,
  ["plow.spreader"] = function() local c = plow() if c then c.toggleSpreader() end end,
  ["plow.rateUp"] = function() local c = plow() if c then c.rateUp() end end,
  ["plow.rateDown"] = function() local c = plow() if c then c.rateDown() end end,
  ["plow.prewet"] = function() local c = plow() if c then c.togglePrewet() end end,
  ["plow.reload"] = function() local c = plow() if c then c.reload() end end,
}

local function action(name, value)
  local fn = actions[name]
  if not fn then
    log("W", "belseco.console", "unknown action: " .. tostring(name))
    return
  end
  -- master off locks everything except the master switch itself
  if not master and name ~= "master.toggle" then
    gui.message({txt = "Upfit master is OFF"}, 2, "belseco.master")
    return
  end
  fn(value)
end

local function preset(name)
  local fn = presets[name]
  if not fn then
    log("W", "belseco.console", "unknown preset: " .. tostring(name))
    return
  end
  if not master then
    gui.message({txt = "Upfit master is OFF"}, 2, "belseco.master")
    return
  end
  fn()
end

-- ---------------------------------------------------------------------------
-- state for the UI app
-- ---------------------------------------------------------------------------

local function uiState()
  local lb, sr, ab, ax, pl = lightbar(), siren(), arrowboard(), aux(), plow()
  local lbState = lb and lb.getState() or nil
  local srState = sr and sr.getState() or nil
  local abState = ab and ab.getState() or nil
  local plState = pl and pl.getState() or nil

  local switches = {}
  for i, sw in ipairs(switchPanel) do
    switches[i] = {
      key = sw.key,
      label = sw.label,
      on = switchValue(sw.key, lbState, srState, abState, plState) > 0,
    }
  end
  return {
    master = master,
    switches = switches,
    lightbar = lbState,
    siren = srState,
    arrowboard = abState,
    aux = ax and ax.getState() or nil,
    plow = plState,
    stock = (function() local c = stock() return c and c.getState() or nil end)(),
  }
end

local function updateGFX(dt)
  publish()
end

local function reset()
  master = true
  publish()
end

local function init(jbeamData)
  reset()

  -- Convenience globals in this vehicle's Lua VM. Keybinds and the UI app call
  -- these instead of controller.getController(...) so they keep working no
  -- matter which controller lookup API a given game version exposes.
  belsecoAction = action
  belsecoPreset = preset
  belsecoState = uiState
end

M.init = init
M.reset = reset
M.updateGFX = updateGFX

M.action = action
M.preset = preset
M.uiState = uiState
M.switchPanel = switchPanel

return M
