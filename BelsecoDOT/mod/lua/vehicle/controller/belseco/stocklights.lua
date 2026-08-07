-- Belseco DOT Mega Pack
-- Stock light fallback.
--
-- The pack ships no equipment meshes, so until a lightbar model exists there is
-- nothing on the roof to flash. This controller borrows the lights the vehicle
-- already has - headlights, high beams, turn signals, fog lights - and drives
-- them from the pack's own patterns, so the warning systems are visible on a
-- completely stock truck.
--
-- It is additive: it never turns a light off below whatever the driver already
-- had on, and it restores that baseline the moment the systems go quiet, so
-- running with headlights on at night still behaves normally.
--
-- Set "stockLightFallback": false in the controller's jbeam options (or press
-- the STOCK button in the console app) to switch it off once you have real
-- lightbar geometry.
--
-- Author: Belseco Fleet Services

local M = {}

M.type = "auxiliary"
M.relevantDevice = nil
-- runs late so it has the current frame's lightbar output to work from, and so
-- its writes land after the vehicle's own light logic for this frame
M.defaultOrder = 9000

local enabled = true

local wasActive = false
local baseLights = 0
local baseLowbeam = 0
local baseHighbeam = 0
local baseFog = 0

local function anySegment(e, from, to)
  for i = from, to do
    if (e["belseco_ta_s" .. i] or 0) > 0 then return true end
  end
  return false
end

local function captureBaseline(e)
  baseLights = e.lights or 0
  baseLowbeam = e.lowbeam or 0
  baseHighbeam = e.highbeam or 0
  baseFog = e.fog or 0
end

local function restoreBaseline(e)
  e.lights = baseLights
  e.lowbeam = baseLowbeam
  e.highbeam = baseHighbeam
  e.fog = baseFog
  e.signal_L = 0
  e.signal_R = 0
end

local function updateGFX(dt)
  local e = electrics.values

  if not enabled then
    if wasActive then
      restoreBaseline(e)
      wasActive = false
    end
    return
  end

  local lbMode = e.belseco_lb_mode or 0
  local taMode = e.belseco_ta_mode or 0
  local wigwag = (e.belseco_aux_wigwag or 0) > 0
  local scene = (e.belseco_aux_sceneL or 0) > 0 or (e.belseco_aux_sceneR or 0) > 0
             or (e.belseco_aux_workArea or 0) > 0 or (e.belseco_aux_takedown or 0) > 0

  local active = lbMode > 0 or taMode > 0 or wigwag or scene

  if not active then
    if wasActive then
      restoreBaseline(e)
      wasActive = false
    end
    return
  end

  if not wasActive then
    captureBaseline(e)
    wasActive = true
  end

  -- Headlight wig-wag: the lightbar's driver-side and passenger-side halves
  -- become the left and right headlight, which reads convincingly from in front
  -- of the truck even without a bar on the roof.
  local left = (e.belseco_lb_frontL or 0) > 0.05 or (e.belseco_aux_wigwagL or 0) > 0
  local right = (e.belseco_lb_frontR or 0) > 0.05 or (e.belseco_aux_wigwagR or 0) > 0
  local anyHead = left or right

  e.lights = math.max(baseLights, (anyHead or scene) and 1 or 0)
  e.lowbeam = math.max(baseLowbeam, (anyHead or scene) and 1 or 0)
  e.highbeam = math.max(baseHighbeam, left and 1 or 0)
  e.lowhighbeam = math.max(e.lowhighbeam or 0, left and 2 or (anyHead and 1 or 0))

  -- Scene package leans on the fog lights for a bit of steady work lighting
  e.fog = math.max(baseFog, scene and 1 or 0)

  -- Turn signals stand in for the rear traffic advisor. With no advisor
  -- selected they alternate with the lightbar instead, which looks like the
  -- rear warning flashers on a real service truck.
  local sigL, sigR
  if taMode > 0 then
    sigL = anySegment(e, 1, 4)
    sigR = anySegment(e, 5, 8)
  else
    sigL = (e.belseco_lb_rearL or 0) > 0.05
    sigR = (e.belseco_lb_rearR or 0) > 0.05
  end
  e.signal_L = sigL and 1 or 0
  e.signal_R = sigR and 1 or 0
end

local function setEnabled(v)
  enabled = v and true or false
  if not enabled then
    restoreBaseline(electrics.values)
    wasActive = false
  end
  gui.message({txt = "Stock light fallback: " .. (enabled and "ON" or "OFF")}, 2, "belseco.stock")
end

local function toggle()
  setEnabled(not enabled)
end

local function getState()
  return {enabled = enabled, active = wasActive}
end

local function reset()
  wasActive = false
  baseLights = 0
  baseLowbeam = 0
  baseHighbeam = 0
  baseFog = 0
end

local function init(jbeamData)
  if jbeamData and jbeamData.stockLightFallback ~= nil then
    enabled = jbeamData.stockLightFallback and true or false
  end
  reset()
end

M.init = init
M.reset = reset
M.updateGFX = updateGFX

M.setEnabled = setEnabled
M.toggle = toggle
M.getState = getState

return M
