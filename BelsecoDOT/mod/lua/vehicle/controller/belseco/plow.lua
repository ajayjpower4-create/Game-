-- Belseco DOT Mega Pack
-- Winter operations: front plow and hopper spreader.
--
-- The plow blade and the spreader are exposed as continuous electrics so the
-- jbeam props (hydraulic rams, blade pivot, spinner disc) can be animated
-- directly from them.  Material use is metered the way a real ground-speed
-- controlled spreader meters it: pounds per lane mile, scaled by road speed, so
-- the hopper empties faster on a long fast run than on a slow residential loop.
--
-- Electrics published:
--   belseco_plow_lift     0..1   blade height, 0 = down on the road
--   belseco_plow_angle   -1..1   blade angle, negative = casting left
--   belseco_plow_float    0/1    float mode, blade follows the road surface
--   belseco_spreader_on   0/1
--   belseco_spreader_rate 0..1   normalised gate opening
--   belseco_spinner       0..1   spinner disc speed, drive a spinning prop
--   belseco_prewet        0/1
--   belseco_hopper        0..1   material remaining
--
-- Author: Belseco Fleet Services

local M = {}

M.type = "auxiliary"
M.relevantDevice = nil
M.defaultOrder = 2040

local lift = 1          -- stowed
local liftTarget = 1
local LIFT_TIME = 1.8

local angle = 0
local angleTarget = 0
local ANGLE_TIME = 2.4

local float = false

local spreaderOn = false
local rateStep = 4       -- 1..10 controller detent
local RATE_MAX = 10
local prewet = false
local spinner = 0

local HOPPER_CAPACITY = 9500      -- pounds of material
local hopper = HOPPER_CAPACITY
local LB_PER_LANE_MILE = 300      -- at full gate

local function moveToward(current, target, dt, time)
  if current < target then
    return math.min(target, current + dt / time)
  elseif current > target then
    return math.max(target, current - dt / time)
  end
  return current
end

local function publish()
  local e = electrics.values
  e.belseco_plow_lift = lift
  e.belseco_plow_angle = angle
  e.belseco_plow_float = float and 1 or 0
  e.belseco_spreader_on = spreaderOn and 1 or 0
  e.belseco_spreader_rate = spreaderOn and (rateStep / RATE_MAX) or 0
  e.belseco_spinner = spinner
  e.belseco_prewet = prewet and 1 or 0
  e.belseco_hopper = hopper / HOPPER_CAPACITY
end

local function updateGFX(dt)
  lift = moveToward(lift, liftTarget, dt, LIFT_TIME)
  angle = moveToward(angle, angleTarget, dt, ANGLE_TIME)

  -- spinner spools up and coasts down rather than snapping
  local spinnerTarget = (spreaderOn and hopper > 0) and (0.35 + 0.65 * rateStep / RATE_MAX) or 0
  spinner = moveToward(spinner, spinnerTarget, dt, 0.9)

  if spreaderOn and hopper > 0 then
    local speedMs = math.abs(electrics.values.wheelspeed or 0)
    local milesThisFrame = speedMs * dt / 1609.34
    hopper = math.max(0, hopper - milesThisFrame * LB_PER_LANE_MILE * (rateStep / RATE_MAX))
    if hopper <= 0 then
      spreaderOn = false
      gui.message({txt = "Hopper empty - spreader stopped"}, 4, "belseco.plow")
    end
  end

  publish()
end

-- ---------------------------------------------------------------------------
-- public API
-- ---------------------------------------------------------------------------

local function setLift(v)
  liftTarget = math.max(0, math.min(1, tonumber(v) or 0))
  if liftTarget > 0.5 then float = false end
end

local function toggleLift()
  setLift(liftTarget > 0.5 and 0 or 1)
  gui.message({txt = liftTarget > 0.5 and "Plow up" or "Plow down"}, 2, "belseco.plow")
end

local function setAngle(v)
  angleTarget = math.max(-1, math.min(1, tonumber(v) or 0))
end

local function angleLeft()
  setAngle(angleTarget - 0.5)
  gui.message({txt = "Blade angle: " .. string.format("%+.0f%%", angleTarget * 100)}, 2, "belseco.plow")
end

local function angleRight()
  setAngle(angleTarget + 0.5)
  gui.message({txt = "Blade angle: " .. string.format("%+.0f%%", angleTarget * 100)}, 2, "belseco.plow")
end

local function toggleFloat()
  float = not float
  if float then liftTarget = 0 end
  gui.message({txt = "Plow float: " .. (float and "ON" or "OFF")}, 2, "belseco.plow")
end

local function toggleSpreader()
  if hopper <= 0 then
    gui.message({txt = "Hopper empty - reload at the yard"}, 3, "belseco.plow")
    return
  end
  spreaderOn = not spreaderOn
  gui.message({txt = "Spreader: " .. (spreaderOn and ("ON - rate " .. rateStep) or "OFF")}, 2, "belseco.plow")
end

local function setRate(v)
  rateStep = math.max(1, math.min(RATE_MAX, math.floor(tonumber(v) or 1)))
  gui.message({txt = "Spread rate: " .. rateStep .. "/" .. RATE_MAX}, 2, "belseco.plow")
end

local function rateUp() setRate(rateStep + 1) end
local function rateDown() setRate(rateStep - 1) end

local function togglePrewet()
  prewet = not prewet
  gui.message({txt = "Pre-wet: " .. (prewet and "ON" or "OFF")}, 2, "belseco.plow")
end

local function reload()
  hopper = HOPPER_CAPACITY
  gui.message({txt = "Hopper reloaded"}, 2, "belseco.plow")
end

local function getState()
  return {
    lift = lift,
    liftTarget = liftTarget,
    angle = angle,
    float = float,
    spreaderOn = spreaderOn,
    rate = rateStep,
    rateMax = RATE_MAX,
    prewet = prewet,
    hopper = hopper / HOPPER_CAPACITY,
    hopperLb = math.floor(hopper),
  }
end

local function reset()
  lift = 1
  liftTarget = 1
  angle = 0
  angleTarget = 0
  float = false
  spreaderOn = false
  prewet = false
  spinner = 0
  hopper = HOPPER_CAPACITY
  publish()
end

local function init(jbeamData)
  reset()
end

M.init = init
M.reset = reset
M.updateGFX = updateGFX

M.setLift = setLift
M.toggleLift = toggleLift
M.setAngle = setAngle
M.angleLeft = angleLeft
M.angleRight = angleRight
M.toggleFloat = toggleFloat
M.toggleSpreader = toggleSpreader
M.setRate = setRate
M.rateUp = rateUp
M.rateDown = rateDown
M.togglePrewet = togglePrewet
M.reload = reload
M.getState = getState

return M
