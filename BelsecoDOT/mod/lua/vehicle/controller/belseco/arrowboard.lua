-- Belseco DOT Mega Pack
-- 15-lamp arrow board / message board controller.
--
-- Lamp numbering matches the physical board, left to right, top to bottom:
--
--      1   2   3   4   5
--      6   7   8   9  10
--     11  12  13  14  15
--
-- Electrics published:
--   belseco_ab_mode      0..6
--   belseco_ab_deploy    0..1  mast position, animate the mast prop from this
--   belseco_ab_l1 .. l15 0/1   individual lamps
--
-- Author: Belseco Fleet Services

local M = {}

M.type = "auxiliary"
M.relevantDevice = nil
M.defaultOrder = 2020

local LAMPS = 15

-- Sequenced display programs. Each frame is {duration, {lamp indices}}; the
-- board builds the arrow outward then holds it, which is what a real
-- sequential-arrow board does.
local function frames(spec)
  return spec
end

local ALL = {}
for i = 1, LAMPS do ALL[i] = i end

local modes = {
  {
    name = "Off",
    frames = frames({{1.0, {}}}),
  },
  {
    name = "Four Corner Caution",
    frames = frames({
      {0.45, {1, 5, 11, 15}},
      {0.45, {}},
    }),
  },
  {
    name = "Caution Bar",
    frames = frames({
      {0.45, {6, 7, 8, 9, 10}},
      {0.45, {}},
    }),
  },
  {
    name = "Left Arrow",
    frames = frames({
      {0.14, {6, 2, 12}},
      {0.14, {6, 2, 12, 7}},
      {0.14, {6, 2, 12, 7, 8}},
      {0.14, {6, 2, 12, 7, 8, 9}},
      {0.55, {6, 2, 12, 7, 8, 9, 10}},
      {0.16, {}},
    }),
  },
  {
    name = "Right Arrow",
    frames = frames({
      {0.14, {10, 4, 14}},
      {0.14, {10, 4, 14, 9}},
      {0.14, {10, 4, 14, 9, 8}},
      {0.14, {10, 4, 14, 9, 8, 7}},
      {0.55, {10, 4, 14, 9, 8, 7, 6}},
      {0.16, {}},
    }),
  },
  {
    name = "Double Arrow",
    frames = frames({
      {0.16, {8}},
      {0.16, {8, 7, 9}},
      {0.16, {8, 7, 9, 6, 10}},
      {0.55, {8, 7, 9, 6, 10, 2, 12, 4, 14}},
      {0.16, {}},
    }),
  },
  {
    name = "Flashing Caution",
    frames = frames({
      {0.35, ALL},
      {0.35, {}},
    }),
  },
}

local mode = 0
local frameIndex = 1
local frameTimer = 0

local deploy = 0
local deployTarget = 0
local DEPLOY_TIME = 2.6

local lamps = {}

local function clearLamps()
  for i = 1, LAMPS do
    lamps[i] = 0
  end
end

local function publish()
  local e = electrics.values
  for i = 1, LAMPS do
    e["belseco_ab_l" .. i] = lamps[i] or 0
  end
  e.belseco_ab_mode = mode
  e.belseco_ab_deploy = deploy
end

local function updateGFX(dt)
  -- mast movement
  if deploy < deployTarget then
    deploy = math.min(deployTarget, deploy + dt / DEPLOY_TIME)
  elseif deploy > deployTarget then
    deploy = math.max(deployTarget, deploy - dt / DEPLOY_TIME)
  end

  clearLamps()

  -- lamps only energise once the board is up; stowed boards stay dark so you
  -- cannot leave an arrow running while driving down the road
  if mode > 0 and deploy > 0.9 then
    local program = modes[mode + 1]
    local f = program.frames
    frameTimer = frameTimer + dt
    local guard = 0
    while frameTimer >= f[frameIndex][1] and guard < 32 do
      frameTimer = frameTimer - f[frameIndex][1]
      frameIndex = frameIndex % #f + 1
      guard = guard + 1
    end
    for _, lamp in ipairs(f[frameIndex][2]) do
      lamps[lamp] = 1
    end
  end

  publish()
end

-- ---------------------------------------------------------------------------
-- public API
-- ---------------------------------------------------------------------------

local function setMode(m)
  mode = math.max(0, math.min(#modes - 1, math.floor(tonumber(m) or 0)))
  frameIndex = 1
  frameTimer = 0
  -- raising the board is implied by selecting a display
  if mode > 0 then deployTarget = 1 end
  gui.message({txt = "Arrow board: " .. modes[mode + 1].name}, 2, "belseco.arrowboard")
end

local function cycleMode()
  setMode((mode + 1) % #modes)
end

local function setDeploy(v)
  deployTarget = math.max(0, math.min(1, tonumber(v) or 0))
  if deployTarget < 0.5 then
    mode = 0
  end
end

local function toggleDeploy()
  setDeploy(deployTarget > 0.5 and 0 or 1)
  gui.message({txt = deployTarget > 0.5 and "Arrow board raising" or "Arrow board stowing"}, 2, "belseco.arrowboard")
end

local function getState()
  return {
    mode = mode,
    modeName = modes[mode + 1].name,
    modeCount = #modes,
    deploy = deploy,
    deployTarget = deployTarget,
  }
end

local function reset()
  mode = 0
  frameIndex = 1
  frameTimer = 0
  deploy = 0
  deployTarget = 0
  clearLamps()
  publish()
end

local function init(jbeamData)
  reset()
end

M.init = init
M.reset = reset
M.updateGFX = updateGFX

M.setMode = setMode
M.cycleMode = cycleMode
M.setDeploy = setDeploy
M.toggleDeploy = toggleDeploy
M.getState = getState

return M
