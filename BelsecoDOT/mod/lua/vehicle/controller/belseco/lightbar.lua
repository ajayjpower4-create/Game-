-- Belseco DOT Mega Pack
-- Emergency lightbar controller: escalation levels, flash programs and a
-- rear-facing traffic advisor.
--
-- Everything this controller does is published through electrics values, so any
-- jbeam prop, flexbody glow material or UI app can read the state:
--
--   belseco_lb_mode        0..3  escalation level
--   belseco_lb_pattern     1..n  index into the flash programs below
--   belseco_lb_<channel>   0..1  live per-head output (already dimmed)
--   belseco_ta_mode        0..4  traffic advisor mode
--   belseco_ta_s1 .. s8    0..1  advisor segment output, left to right
--   lightbar               0..2  vanilla compatibility, so stock police
--                                lightbar props flash with our controller
--
-- Author: Belseco Fleet Services

local M = {}

M.type = "auxiliary"
M.relevantDevice = nil
M.defaultOrder = 2000

-- head groups: a "side" step lights the driver or passenger half of the bar
local sideChannels = {
  L = {"frontL", "frontIL", "rearL", "sideL"},
  R = {"frontR", "frontIR", "rearR", "sideR"},
}

local channels = {
  "frontL", "frontIL", "frontR", "frontIR",
  "rearL", "rearR", "sideL", "sideR",
}

-- Flash programs. Each step is {duration in seconds, side}, where side is
-- "L" driver half, "R" passenger half, "B" both, "N" blackout.
local programs = {
  {
    name = "Quad Flash",
    steps = {
      {0.05, "L"}, {0.05, "N"}, {0.05, "L"}, {0.05, "N"},
      {0.05, "L"}, {0.05, "N"}, {0.05, "L"}, {0.18, "N"},
      {0.05, "R"}, {0.05, "N"}, {0.05, "R"}, {0.05, "N"},
      {0.05, "R"}, {0.05, "N"}, {0.05, "R"}, {0.18, "N"},
    },
  },
  {
    name = "Double Flash",
    steps = {
      {0.07, "L"}, {0.07, "N"}, {0.07, "L"}, {0.22, "N"},
      {0.07, "R"}, {0.07, "N"}, {0.07, "R"}, {0.22, "N"},
    },
  },
  {
    name = "Slow Alternate",
    steps = {
      {0.38, "L"}, {0.04, "N"}, {0.38, "R"}, {0.04, "N"},
    },
  },
  {
    name = "Attention All",
    steps = {
      {0.06, "B"}, {0.06, "N"}, {0.06, "B"}, {0.06, "N"},
      {0.06, "B"}, {0.30, "N"},
    },
  },
  {
    name = "Cruise Steady",
    steps = {
      {1.00, "B"},
    },
  },
}

-- brightness applied per escalation level (0 = off, 3 = lane blocking)
local levelBrightness = {0, 0.35, 1.0, 1.0}
-- flash program forced by each escalation level (nil = driver's choice)
local levelProgram = {nil, 5, nil, 4}

local ADVISOR_SEGMENTS = 8
local advisorNames = {"Off", "Left", "Right", "Split", "Wig-Wag"}

local mode = 0
local pattern = 1
local advisorMode = 0

local stepIndex = 1
local stepTimer = 0
local advisorTimer = 0
local advisorStep = 0

local out = {}
local advisorOut = {}

local function clearOutputs()
  for _, c in ipairs(channels) do
    out[c] = 0
  end
  for i = 1, ADVISOR_SEGMENTS do
    advisorOut[i] = 0
  end
end

local function activeProgram()
  local forced = levelProgram[mode + 1]
  return programs[forced or pattern] or programs[1]
end

local function applyStep(side, brightness)
  clearOutputs()
  if side == "N" then return end
  if side == "B" then
    for _, c in ipairs(channels) do
      out[c] = brightness
    end
    return
  end
  for _, c in ipairs(sideChannels[side] or {}) do
    out[c] = brightness
  end
end

-- Traffic advisor: sequential fill from the centre outwards, held, then blanked.
local function updateAdvisor(dt)
  if advisorMode == 0 then return end

  advisorTimer = advisorTimer + dt
  if advisorTimer >= 0.16 then
    advisorTimer = advisorTimer - 0.16
    advisorStep = (advisorStep + 1) % 6
  end

  local half = ADVISOR_SEGMENTS / 2
  local lit = math.min(advisorStep + 1, half)
  local hold = advisorStep >= half

  for i = 1, ADVISOR_SEGMENTS do
    advisorOut[i] = 0
  end

  if advisorMode == 4 then -- wig-wag: alternate halves, no direction implied
    local left = advisorStep % 2 == 0
    for i = 1, ADVISOR_SEGMENTS do
      local isLeft = i <= half
      advisorOut[i] = (isLeft == left) and 1 or 0
    end
    return
  end

  local count = hold and half or lit
  for i = 1, count do
    if advisorMode == 1 or advisorMode == 3 then -- left / split
      advisorOut[half + 1 - i] = 1
    end
    if advisorMode == 2 or advisorMode == 3 then -- right / split
      advisorOut[half + i] = 1
    end
  end
end

local function publish()
  local e = electrics.values
  for _, c in ipairs(channels) do
    e["belseco_lb_" .. c] = out[c] or 0
  end
  for i = 1, ADVISOR_SEGMENTS do
    e["belseco_ta_s" .. i] = advisorOut[i] or 0
  end
  e.belseco_lb_mode = mode
  e.belseco_lb_pattern = pattern
  e.belseco_ta_mode = advisorMode

  -- vanilla compatibility: stock lightbar props read electrics.values.lightbar
  if mode == 0 then
    e.lightbar = 0
  else
    e.lightbar = ((e.belseco_siren_mode or 0) > 0) and 2 or 1
  end
end

local function updateGFX(dt)
  if mode == 0 then
    clearOutputs()
    stepIndex = 1
    stepTimer = 0
    advisorTimer = 0
    advisorStep = 0
    publish()
    return
  end

  local prog = activeProgram()
  local steps = prog.steps
  stepTimer = stepTimer + dt

  local guard = 0
  while stepTimer >= (steps[stepIndex][1] or 0.1) and guard < 32 do
    stepTimer = stepTimer - steps[stepIndex][1]
    stepIndex = stepIndex % #steps + 1
    guard = guard + 1
  end

  applyStep(steps[stepIndex][2], levelBrightness[mode + 1] or 1)
  updateAdvisor(dt)
  publish()
end

-- ---------------------------------------------------------------------------
-- public API - called from inputActions, the UI app and other controllers
-- ---------------------------------------------------------------------------

local function setMode(m)
  mode = math.max(0, math.min(3, math.floor(tonumber(m) or 0)))
  stepIndex = 1
  stepTimer = 0
  if mode == 0 then
    advisorMode = 0
  end
  gui.message({txt = "Lightbar: " .. (mode == 0 and "OFF" or ("LEVEL " .. mode))}, 2, "belseco.lightbar")
end

local function cycleMode()
  setMode((mode + 1) % 4)
end

local function toggle()
  setMode(mode > 0 and 0 or 2)
end

local function setPattern(p)
  pattern = math.max(1, math.min(#programs, math.floor(tonumber(p) or 1)))
  stepIndex = 1
  stepTimer = 0
  gui.message({txt = "Flash pattern: " .. programs[pattern].name}, 2, "belseco.lightbar")
end

local function cyclePattern()
  setPattern(pattern % #programs + 1)
end

local function setAdvisor(m)
  advisorMode = math.max(0, math.min(4, math.floor(tonumber(m) or 0)))
  advisorStep = 0
  advisorTimer = 0
  gui.message({txt = "Traffic advisor: " .. advisorNames[advisorMode + 1]}, 2, "belseco.advisor")
end

local function cycleAdvisor()
  setAdvisor((advisorMode + 1) % 5)
end

local function getState()
  return {
    mode = mode,
    pattern = pattern,
    patternName = programs[pattern].name,
    patternCount = #programs,
    advisor = advisorMode,
    advisorName = advisorNames[advisorMode + 1],
  }
end

local function reset()
  mode = 0
  advisorMode = 0
  stepIndex = 1
  stepTimer = 0
  advisorStep = 0
  advisorTimer = 0
  clearOutputs()
  publish()
end

local function init(jbeamData)
  pattern = jbeamData and jbeamData.defaultPattern or 1
  reset()
end

M.init = init
M.reset = reset
M.updateGFX = updateGFX

M.setMode = setMode
M.cycleMode = cycleMode
M.toggle = toggle
M.setPattern = setPattern
M.cyclePattern = cyclePattern
M.setAdvisor = setAdvisor
M.cycleAdvisor = cycleAdvisor
M.getState = getState
M.programs = programs

return M
