-- Tow Truck Calls for BeamNG.drive
--
-- Tow calls come in over the radio at random. Accept one in the Tow Dispatch
-- app and the car is spawned on a road somewhere on the map. Drive your own
-- tow truck there, load the car with your truck's bed / wheel lift / winch,
-- win the strap-down minigames, tow it anywhere you like and press DONE to
-- get paid.
--
-- UI app: ui/modules/apps/TowTruckCalls. It talks to this file through
-- bngApi.engineLua('towTruckCalls.<function>(...)') and listens for the
-- 'TowTruckCallsState' hook.

local M = {}

local HOOK = 'TowTruckCallsState'
local SAVE_FILE = '/settings/towTruckCalls.json'
local LOG_TAG = 'towTruckCalls'

-- Tuning. Meters, seconds, dollars.
local FIRST_CALL_DELAY = 12        -- after loading a map
local CALL_GAP_MIN, CALL_GAP_MAX = 30, 75
local MAX_OFFERS = 3
local OFFER_TTL = 150
local SPAWN_MIN, SPAWN_MAX = 180, 1500
local ARRIVE_DIST = 35             -- "on scene" once you are this close
local WITH_TRUCK_GAP = 2.0         -- car body within this of the truck body counts as loaded / hooked up
local HITCH_GAP = 0.8              -- a vehicle this close to the truck is hitched to it (trailer)
local STOPPED = 0.6                -- m/s
local MIN_TOW = 100                -- must tow the car at least this far before DONE
local DRIFT_LIMIT = 4.0            -- car moved this far from where it was strapped on the truck = it came loose
local LOST_DIST = 18
local LOST_TIME = 1.2
local DROP_DIST = 25               -- DONE works with the car unloaded next to the truck
local RAISED = 0.18                -- car body lifted this much = on a bed or a wheel lift
local PER_MILE = 25
local METERS_PER_MILE = 1609.344

local CALL_TYPES = {
  {id = 'breakdown', label = 'Breakdown',      base = 140, setup = 'dead',   desc = 'Engine quit on the side of the road. Customer is waiting with the car.'},
  {id = 'flat',      label = 'Flat tire',      base = 115, setup = 'flat',   desc = 'Blew a tire and the spare is flat too.'},
  {id = 'nogas',     label = 'Out of gas',     base = 100, setup = 'fuel',   desc = 'Ran the tank dry. Wants it towed home.'},
  {id = 'battery',   label = 'Dead battery',   base = 105, setup = 'dead',   desc = "Won't crank. Needs to go to a shop."},
  {id = 'accident',  label = 'Accident',       base = 215, setup = 'wreck',  desc = 'Crashed and not drivable. Police are on scene.'},
  {id = 'impound',   label = 'Police impound', base = 165, setup = 'parked', desc = 'Illegally parked. PD wants it hauled off.'},
  {id = 'repo',      label = 'Repossession',   base = 240, setup = 'parked', desc = 'Bank repo. Grab it before the owner comes out.'},
  {id = 'abandoned', label = 'Abandoned car',  base = 125, setup = 'parked', desc = 'Been sitting there for weeks. City wants it gone.'},
}

local FIRST_NAMES = {'Mike', 'Linda', 'Jake', 'Tasha', 'Carlos', 'Brenda', 'Dwayne', 'Kayla', 'Earl', 'Maria',
  'Tyler', 'Denise', 'Hank', 'Ashley', 'Marcus', 'Shelby', 'Ray', 'Tina', 'Bobby', 'Crystal', 'Luis', 'Megan'}
local LAST_NAMES = {'Johnson', 'Miller', 'Garcia', 'Davis', 'Rodriguez', 'Wilson', 'Anderson', 'Thomas', 'Moore',
  'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris', 'Clark', 'Lewis', 'Walker', 'Hall', 'Young'}

-- Used when the game's vehicle list can't be read. Missing ones are skipped.
local FALLBACK_MODELS = {'covet', 'vivace', 'pessima', 'midsize', 'sunburst2', 'sunburst', 'fullsize', 'legran',
  'moonhawk', 'barstow', 'burnside', 'bluebuck', 'etk800', 'etkc', 'etki', 'bastion', 'lansdale', 'wendover',
  'miramar', 'pickup', 'roamer', 'hopper', 'sbr', 'bx', 'autobello'}
-- Too big, too small or not a road car.
local SKIP_MODELS = {semi = true, us_semi = true, citybus = true, racetruck = true, rockbouncer = true, atv = true,
  utv = true, unicycle = true, md_series = true, dryvan = true, flatbed = true, tanker = true, cargotrailer = true,
  tsfb = true, pigeon = true, wigeon = true, lansdale_trailer = true}

local S = {
  duty = true,
  bank = 0,
  jobsDone = 0,
  towedMeters = 0,
  session = 0,
  offers = {},
  job = nil,
  nextId = 1,
  callTimer = FIRST_CALL_DELAY,
  truckId = nil,
  pushTimer = 0,
  result = nil,
  resultToken = 0,
  removals = {},
  pool = nil,
  loaded = false,
}

-- Helpers -----------------------------------------------------------------------------------------

local function logMsg(level, msg)
  if log then pcall(log, level, LOG_TAG, msg) end
end

local function hdist(a, b)
  local dx, dy = a.x - b.x, a.y - b.y
  return math.sqrt(dx * dx + dy * dy)
end

local function plain(v)
  return {x = v.x, y = v.y, z = v.z}
end

local function compass(dx, dy)
  local a = math.deg(math.atan2(dx, dy)) % 360
  local names = {'N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'}
  return names[math.floor((a + 22.5) / 45) % 8 + 1]
end

local function pick(list)
  return list[math.random(#list)]
end

local function toast(kind, title, msg, ms)
  pcall(function()
    guihooks.trigger('toastrMsg', {type = kind, title = title, msg = msg, config = {timeOut = ms or 5000}})
  end)
end

local function getVeh(id)
  if not id then return nil end
  local veh
  if getObjectByID then
    veh = getObjectByID(id)
  elseif be then
    veh = be:getObjectByID(id)
  end
  return veh
end

local function playerVeh()
  if getPlayerVehicle then return getPlayerVehicle(0) end
  if be and be.getPlayerVehicle then return be:getPlayerVehicle(0) end
end

local function vehId(veh)
  local ok, id = pcall(function() return veh:getID() end)
  return ok and id or nil
end

local function isWalker(veh)
  local ok, name = pcall(function() return veh:getJBeamFilename() end)
  return ok and name == 'unicycle'
end

-- Center, axes and half size of a vehicle's body.
local function frameOf(veh)
  local ok, f = pcall(function()
    local box = veh:getSpawnWorldOOBB()
    return {c = vec3(box:getCenter()), r = vec3(box:getAxis(0)), f = vec3(box:getAxis(1)),
      u = vec3(box:getAxis(2)), he = vec3(box:getHalfExtents())}
  end)
  if ok and f then return f end
  local p = vec3(veh:getPosition())
  local fwd = vec3(veh:getDirectionVector())
  local up = vec3(veh:getDirectionVectorUp())
  return {c = p, r = fwd:cross(up), f = fwd, u = up, he = vec3(1, 2.4, 0.8)}
end

local function speedOf(veh)
  local id = vehId(veh)
  local o = id and map and map.objects and map.objects[id]
  if o and o.vel then return vec3(o.vel):length() end
  local ok, v = pcall(function() return vec3(veh:getVelocity()):length() end)
  return ok and v or 0
end

local function damageOf(id)
  local o = id and map and map.objects and map.objects[id]
  return (o and tonumber(o.damage)) or 0
end

local function groundZ(x, y, z)
  local ok, h = pcall(function() return be:getSurfaceHeightBelow(vec3(x, y, z)) end)
  if ok and type(h) == 'number' and h > -1e5 and h < 1e5 then return h end
end

local function cameraPos()
  local ok, p = pcall(function() return vec3(core_camera.getPosition()) end)
  if ok and p then return p end
end

-- Where the player is: their vehicle, or the camera if they have none.
local function playerPos()
  local pv = playerVeh()
  if pv then return vec3(pv:getPosition()) end
  return cameraPos()
end

local function units()
  local ok, u = pcall(function() return settings.getValue('uiUnitLength') end)
  if ok and u == 'metric' then return 'metric' end
  return 'imperial'
end

-- No calls during scenarios, missions or in the menus.
local function otherGameplayRunning()
  local busy = false
  pcall(function()
    if scenario_scenarios and scenario_scenarios.getScenario and scenario_scenarios.getScenario() then busy = true end
  end)
  pcall(function()
    local mm = gameplay_missions_missionManager
    if mm and mm.getForegroundMissionId and mm.getForegroundMissionId() then busy = true end
  end)
  return busy
end

local function inLevel()
  local ok, id = pcall(function() return getCurrentLevelIdentifier() end)
  if ok then return id ~= nil and id ~= '' end
  local ok2, f = pcall(function() return getMissionFilename() end)
  return ok2 and f ~= nil and f ~= ''
end

-- Saving --------------------------------------------------------------------------------------------

local function loadSave()
  local ok, data = pcall(jsonReadFile, SAVE_FILE)
  if ok and type(data) == 'table' then
    S.bank = tonumber(data.bank) or 0
    S.jobsDone = tonumber(data.jobsDone) or 0
    S.towedMeters = tonumber(data.towedMeters) or 0
    if data.duty ~= nil then S.duty = data.duty == true end
  end
end

local function save()
  pcall(jsonWriteFile, SAVE_FILE, {bank = S.bank, jobsDone = S.jobsDone, towedMeters = S.towedMeters, duty = S.duty}, true)
end

-- GPS route and the beacon over the car -----------------------------------------------------------

local function setRoute(pos)
  if not core_groundMarkers then return end
  local ok, err = pcall(function()
    if core_groundMarkers.setPath then
      if pos then
        core_groundMarkers.setPath(vec3(pos.x, pos.y, pos.z), {clearPathOnReachingTarget = false})
      else
        core_groundMarkers.setPath(nil)
      end
    elseif core_groundMarkers.setFocus then
      core_groundMarkers.setFocus(pos and vec3(pos.x, pos.y, pos.z) or nil)
    end
  end)
  if not ok then logMsg('W', 'GPS route failed: ' .. tostring(err)) end
end

-- The cars --------------------------------------------------------------------------------------------

local function modelName(model)
  local ok, name = pcall(function()
    local m = core_vehicles.getModel(model)
    local info = m and m.model
    if info and info.Name then return ((info.Brand and (info.Brand .. ' ')) or '') .. info.Name end
  end)
  if ok and name then return name end
  return model:sub(1, 1):upper() .. model:sub(2)
end

local function modelExists(model)
  local ok, yes = pcall(function()
    local m = core_vehicles.getModel(model)
    return m ~= nil and m.model ~= nil and next(m.model) ~= nil
  end)
  if ok then return yes end
  local ok2, dir = pcall(function() return FS:directoryExists('/vehicles/' .. model .. '/') end)
  return ok2 and dir
end

-- Cars and light trucks from the game's own list, weighted by how common they are.
local function buildPool()
  local pool, total = {}, 0
  pcall(function()
    local gen = rawget(_G, 'util_configListGenerator')
    if not gen and extensions and extensions.load then
      extensions.load('util_configListGenerator')
      gen = rawget(_G, 'util_configListGenerator')
    end
    if not gen or not gen.getEligibleVehicles then return end
    for _, info in ipairs(gen.getEligibleVehicles(false, false) or {}) do
      local model = info.model_key
      local kind = info.Type
      local body = tostring(info['Body Style'] or '')
      local okType = kind == 'Car' or (kind == 'Truck' and (body == 'Pickup' or body == 'SUV'))
      if model and info.key and okType and not SKIP_MODELS[model] and not info.isAuxiliary and body ~= 'Bus' then
        local weight = tonumber(info.adjustedPopulation) or tonumber(info.Population) or 1
        if weight > 0 then
          local name = ((info.Brand and (info.Brand .. ' ')) or '') .. (info.Name or model)
          pool[#pool + 1] = {model = model, config = info.key, name = name, weight = weight}
          total = total + weight
        end
      end
    end
  end)
  if #pool == 0 then
    for _, model in ipairs(FALLBACK_MODELS) do
      if modelExists(model) then
        pool[#pool + 1] = {model = model, name = modelName(model), weight = 1}
        total = total + 1
      end
    end
  end
  pool.total = total
  logMsg('I', 'car pool: ' .. #pool .. ' vehicles')
  return pool
end

local function pickCar()
  if not S.pool or #S.pool == 0 then S.pool = buildPool() end
  local pool = S.pool
  if #pool == 0 then return nil end
  local r = math.random() * pool.total
  for _, c in ipairs(pool) do
    r = r - c.weight
    if r <= 0 then return c end
  end
  return pool[#pool]
end

local function spotIsClear(pos, radius)
  if not (map and map.objects) then return true end
  for _, o in pairs(map.objects) do
    if o.pos and hdist(o.pos, pos) < radius then return false end
  end
  return true
end

-- A random spot on the right-hand shoulder of a road, SPAWN_MIN..SPAWN_MAX from the player.
local function pickRoadSpot(origin)
  local m = map and map.getMap and map.getMap()
  local nodes = m and m.nodes
  if not nodes then return nil end
  local cands = {}
  for name, n in pairs(nodes) do
    if n.pos and (n.radius or 0) >= 2.4 then
      local d = hdist(n.pos, origin)
      if d > SPAWN_MIN and d < SPAWN_MAX and math.abs(n.pos.z - origin.z) < 120 then
        for other, link in pairs(n.links or {}) do
          local o = nodes[other]
          if o and o.pos and (link.drivability or 1) >= 0.5 and not link.hiddenInNavi and hdist(o.pos, n.pos) > 12 then
            cands[#cands + 1] = {n, o}
          end
        end
      end
    end
  end
  for _ = 1, math.min(40, #cands) do
    local c = cands[math.random(#cands)]
    local a, b = c[1], c[2]
    local t = 0.25 + math.random() * 0.5
    local dx, dy = b.pos.x - a.pos.x, b.pos.y - a.pos.y
    local len = math.sqrt(dx * dx + dy * dy)
    local fx, fy = dx / len, dy / len
    local rx, ry = fy, -fx                                   -- right of travel
    local radius = (a.radius or 3) + ((b.radius or 3) - (a.radius or 3)) * t
    local side = math.max(0, radius - 1.4)
    local x = a.pos.x + dx * t + rx * side
    local y = a.pos.y + dy * t + ry * side
    local roadZ = a.pos.z + (b.pos.z - a.pos.z) * t
    local z = groundZ(x, y, roadZ + 2) or roadZ
    if math.abs(z - roadZ) < 2.5 and spotIsClear({x = x, y = y}, 9) then
      return {pos = {x = x, y = y, z = z}, dir = {x = fx, y = fy, z = 0}}
    end
  end
end

-- Maps with no road network: somewhere near the player on open ground.
local function pickOpenSpot(origin)
  for _ = 1, 20 do
    local ang = math.random() * math.pi * 2
    local d = 120 + math.random() * 180
    local x, y = origin.x + math.sin(ang) * d, origin.y + math.cos(ang) * d
    local z = groundZ(x, y, origin.z + 60)
    if z and math.abs(z - origin.z) < 25 and spotIsClear({x = x, y = y}, 9) then
      return {pos = {x = x, y = y, z = z}, dir = {x = math.cos(ang), y = -math.sin(ang), z = 0}}
    end
  end
end

-- Calls ------------------------------------------------------------------------------------------------

local function makeOffer()
  local origin = playerPos()
  if not origin then return nil end
  local spot = pickRoadSpot(origin) or pickOpenSpot(origin)
  if not spot then return nil end
  local car = pickCar()
  if not car then return nil end
  local ct = pick(CALL_TYPES)
  local offer = {
    id = S.nextId,
    type = ct,
    caller = pick(FIRST_NAMES) .. ' ' .. pick(LAST_NAMES),
    model = car.model, config = car.config, vehicle = car.name,
    pos = spot.pos, dir = spot.dir,
    pay = ct.base + math.random(0, 6) * 5,
    ttl = OFFER_TTL,
  }
  S.nextId = S.nextId + 1
  return offer
end

local function addOffer(quiet)
  if #S.offers >= MAX_OFFERS then return false end
  local offer = makeOffer()
  if not offer then return false end
  table.insert(S.offers, offer)
  if not quiet then
    local origin = playerPos()
    local where = origin and string.format(' (%s)', compass(offer.pos.x - origin.x, offer.pos.y - origin.y)) or ''
    toast('info', 'Tow call: ' .. offer.type.label, offer.vehicle .. where .. ' - open Tow Dispatch to accept', 6000)
  end
  return true
end

local function findOffer(id)
  for i, o in ipairs(S.offers) do
    if o.id == id then return o, i end
  end
end

-- The job ----------------------------------------------------------------------------------------------

-- Once the car has settled: broken-down cars get the brake, ignition and hazards set.
local function prepCar(veh, job)
  local cmds = {"pcall(function() input.event('parkingbrake', 1, 1) end)"}
  local setup = job.type.setup
  if setup ~= 'parked' then
    cmds[#cmds + 1] = 'pcall(function() electrics.setIgnitionLevel(0) end)'
    cmds[#cmds + 1] = 'pcall(function() electrics.set_warn_signal(1) end)'
  end
  if setup == 'flat' or setup == 'wreck' then
    local tires = setup == 'wreck' and 2 or 1
    cmds[#cmds + 1] = 'pcall(function() local ids = {} for i in pairs(wheels.wheelRotators) do ids[#ids + 1] = i end '
      .. 'for _ = 1, math.min(' .. tires .. ', #ids) do beamstate.deflateTire(table.remove(ids, math.random(#ids))) end end)'
  end
  pcall(function() veh:queueLuaCommand(table.concat(cmds, ' ')) end)
  if setup == 'fuel' and core_vehicleBridge then
    pcall(function()
      core_vehicleBridge.requestValue(veh, function(response)
        local tanks = response and (response.result or response)
        tanks = type(tanks) == 'table' and (tanks[1] or tanks) or {}
        for _, tank in pairs(tanks) do
          if type(tank) == 'table' and tank.name and (tank.energyType == 'gasoline' or tank.energyType == 'diesel') then
            core_vehicleBridge.executeAction(veh, 'setEnergyStorageEnergy', tank.name, 0)
          end
        end
      end, 'energyStorage')
    end)
  end
  job.carBrake = true
end

local function setCarBrake(job, on)
  local veh = getVeh(job.vid)
  if not veh then return end
  pcall(function() veh:queueLuaCommand("input.event('parkingbrake', " .. (on and 1 or 0) .. ', 1)') end)
  job.carBrake = on
end

-- Ghost it and lift it clear of the truck before deleting, so the truck doesn't get kicked.
local function removeCar(vid)
  local veh = getVeh(vid)
  if not veh then return end
  pcall(function() veh:queueLuaCommand('obj:setGhostEnabled(true); obj:setVelocity(0,0,0); obj:setAngularVelocity(0,0,0)') end)
  table.insert(S.removals, {vid = vid, t = 0, lifted = false})
end

local function updateRemovals(dt)
  for i = #S.removals, 1, -1 do
    local r = S.removals[i]
    r.t = r.t + dt
    local veh = getVeh(r.vid)
    if not veh then
      table.remove(S.removals, i)
    elseif not r.lifted and r.t > 0.15 then
      r.lifted = true
      pcall(function()
        local p = veh:getPosition()
        local rot = quat(0, 0, 1, 0) * quat(veh:getRefNodeRotation())
        veh:setPositionRotation(p.x, p.y, p.z + 60, rot.x, rot.y, rot.z, rot.w)
      end)
    elseif r.t > 0.5 then
      pcall(function() veh:delete() end)
      table.remove(S.removals, i)
    end
  end
end

-- The truck is whatever the player last drove that isn't the customer's car or the walking unicycle.
local function rememberTruck()
  local pv = playerVeh()
  if not pv or isWalker(pv) then return end
  local id = vehId(pv)
  if id and not (S.job and S.job.vid == id) then S.truckId = id end
end

local function getTruck()
  local t = getVeh(S.truckId)
  if t and not (S.job and S.job.vid == S.truckId) then return t end
end

local function inCustomerCar()
  local pv = playerVeh()
  return pv ~= nil and S.job ~= nil and vehId(pv) == S.job.vid
end

local function heightAboveGround(c)
  local g = groundZ(c.x, c.y, c.z + 0.3)
  return g and (c.z - g) or nil
end

-- Gap between two vehicle bodies seen from above, 0 when they overlap.
local function pointGap(f, p)
  local d = p - f.c
  local dx = math.max(math.abs(d:dot(f.r)) - f.he.x, 0)
  local dy = math.max(math.abs(d:dot(f.f)) - f.he.y, 0)
  return math.sqrt(dx * dx + dy * dy)
end

local function bodyPoints(f)
  local pts = {f.c}
  for _, sx in ipairs({-1, 1}) do
    for _, sy in ipairs({-1, 1}) do
      pts[#pts + 1] = f.c + f.r * (sx * f.he.x) + f.f * (sy * f.he.y)
    end
  end
  return pts
end

local function bodyGap(a, b)
  local g = math.huge
  for _, p in ipairs(bodyPoints(b)) do g = math.min(g, pointGap(a, p)) end
  for _, p in ipairs(bodyPoints(a)) do g = math.min(g, pointGap(b, p)) end
  return g
end

-- Car relative to the vehicle carrying it: offset in that vehicle's frame and the gap between them.
local function relative(carrier, car)
  local tf, cf = frameOf(carrier), frameOf(car)
  local d = cf.c - tf.c
  return {x = d:dot(tf.r), y = d:dot(tf.f), z = d:dot(tf.u), gap = bodyGap(tf, cf), dist = d:length()}
end

-- The truck plus anything hitched to it (a car trailer, a dolly).
local function rigOf(truck)
  local rig = {truck}
  if not (map and map.objects) then return rig end
  local tf, tid = frameOf(truck), vehId(truck)
  for id in pairs(map.objects) do
    if id ~= tid and not (S.job and id == S.job.vid) then
      local v = getVeh(id)
      if v and not isWalker(v) and bodyGap(tf, frameOf(v)) < HITCH_GAP then rig[#rig + 1] = v end
    end
  end
  return rig
end

-- Which part of the rig the car is on or hooked to.
local function nearestCarrier(truck, car)
  local best, bestRel
  for _, v in ipairs(rigOf(truck)) do
    local rel = relative(v, car)
    if not bestRel or rel.gap < bestRel.gap then best, bestRel = v, rel end
  end
  return best, bestRel
end

local function endJob(reason, kind)
  local job = S.job
  if not job then return end
  S.job = nil
  setRoute(nil)
  if reason then toast(kind or 'warning', 'Tow Dispatch', reason, 6000) end
end

local function payFor(job, towed)
  local lines = {}
  local function add(label, amount)
    if amount ~= 0 then lines[#lines + 1] = {label = label, amount = amount} end
  end
  add(job.type.label .. ' call', job.pay)
  local distPay = math.floor(towed / METERS_PER_MILE * PER_MILE + 0.5)
  add('Mileage', distPay)
  if job.responseTime then
    if job.responseTime < 120 then add('Fast response', 25) elseif job.responseTime < 240 then add('Quick response', 10) end
  end
  local q = job.quality or 60
  add(string.format('Straps (%d%%)', q), math.floor(job.pay * 0.25 * (q - 60) / 40 + 0.5))
  if (job.losses or 0) > 0 then add('Load came loose x' .. job.losses, -math.floor(job.pay * 0.2 * job.losses + 0.5)) end
  local dmg = math.max(0, damageOf(job.vid) - (job.damage0 or 0))
  if dmg > 1 then add('Damage to the car', -math.min(math.floor(dmg * 0.02 + 0.5), math.floor((job.pay + distPay) * 0.5))) end
  local total = 0
  for _, l in ipairs(lines) do total = total + l.amount end
  total = math.max(25, total)
  return total, lines
end

local function payPlayer(amount, label)
  S.bank = S.bank + amount
  S.session = S.session + amount
  pcall(function()
    if career_career and career_career.isActive and career_career.isActive() and career_modules_playerAttributes then
      career_modules_playerAttributes.addAttributes({money = amount}, {tags = {'gameplay'}, label = label})
    end
  end)
end

local function updateJob(dt)
  local job = S.job
  job.age = job.age + dt
  local car = getVeh(job.vid)
  if not car then
    endJob("The customer's car is gone. Job cancelled.")
    return
  end
  if job.prepIn then
    job.prepIn = job.prepIn - dt
    if job.prepIn <= 0 then
      job.prepIn = nil
      prepCar(car, job)
    end
  end
  local cf = frameOf(car)
  job.carPos = cf.c
  if not job.baseHeight and job.age > 3 then
    job.baseHeight = heightAboveGround(cf.c)
    job.damage0 = damageOf(job.vid)
  end
  local pp = playerPos()
  job.playerDist = pp and hdist(pp, cf.c) or 0
  job.bearing = pp and compass(cf.c.x - pp.x, cf.c.y - pp.y) or ''

  local truck = getTruck()
  job.truckSpeed = truck and speedOf(truck) or 0
  job.canStrap, job.canDone, job.hint = false, false, nil

  if job.phase == 'enroute' then
    job.hint = 'Drive to the car. Follow the GPS arrows.'
    if job.playerDist < ARRIVE_DIST then
      job.phase = 'onscene'
      job.responseTime = job.age
      job.damage0 = damageOf(job.vid)   -- after the flat tires etc. we did ourselves
      setRoute(nil)
      toast('info', 'On scene', 'Load the ' .. job.vehicle .. ' on your truck, then strap it down.', 6000)
    end
  end

  if job.phase == 'onscene' then
    if not truck then
      job.hint = 'Get in your tow truck.'
    else
      local _, rel = nearestCarrier(truck, car)
      local carSpeed = speedOf(car)
      if rel.gap > WITH_TRUCK_GAP then
        job.hint = 'Load the car on your truck (bed, wheel lift or winch). Car brake is ' .. (job.carBrake and 'ON' or 'OFF') .. '.'
      elseif job.truckSpeed > STOPPED or carSpeed > STOPPED then
        job.hint = 'Stop the truck to strap the car down.'
      else
        job.canStrap = true
        job.hint = 'Car is with your truck. Strap it down.'
      end
      local h = job.baseHeight and heightAboveGround(cf.c)
      local raised = h and (h - job.baseHeight) > RAISED
      if job.canStrap and raised then
        job.readyTime = (job.readyTime or 0) + dt
        if job.readyTime > 1.5 and not job.prompted then
          job.prompted = true
          job.strapToken = job.strapToken + 1
        end
      else
        job.readyTime = 0
      end
    end
  elseif job.phase == 'secured' then
    local carrier = getVeh(job.carrierId) or truck
    local rel = carrier and truck and relative(carrier, car)
    local drift = rel and math.sqrt((rel.x - job.rel0.x) ^ 2 + (rel.y - job.rel0.y) ^ 2 + (rel.z - job.rel0.z) ^ 2) or 1e9
    local loose = not rel or drift > DRIFT_LIMIT or rel.dist > LOST_DIST
    -- Only while driving: unloading the car at the drop-off before pressing DONE is fine.
    if loose and job.truckSpeed > 2 then
      job.lostTime = job.lostTime + dt
    else
      job.lostTime = 0
    end
    job.towed = job.pickup and hdist(cf.c, job.pickup) or 0
    if job.lostTime > LOST_TIME then
      job.phase = 'onscene'
      job.quality = nil
      job.losses = (job.losses or 0) + 1
      job.prompted = false
      job.lostTime = 0
      toast('error', 'The car came loose!', 'Go back, load it again and re-strap it. That will cost you.', 7000)
    elseif inCustomerCar() then
      job.hint = "Get out of the customer's car."
    elseif job.truckSpeed > 1 then
      job.hint = 'Tow it anywhere on the map, stop, then press DONE.'
    elseif job.towed < MIN_TOW then
      job.hint = 'Tow it somewhere first. Drive it away from the pickup spot.'
    elseif not rel or rel.dist > DROP_DIST then
      job.hint = 'The car has to be with your truck to finish the job.'
    else
      job.canDone = true
      job.hint = 'Press DONE to drop it off and get paid.'
    end
  end
end

-- UI state ------------------------------------------------------------------------------------------------

local function pushState()
  local origin = playerPos()
  local offers = {}
  for _, o in ipairs(S.offers) do
    offers[#offers + 1] = {
      id = o.id, typeId = o.type.id, typeLabel = o.type.label, desc = o.type.desc, caller = o.caller,
      vehicle = o.vehicle, pay = o.pay, ttl = math.max(0, math.floor(o.ttl)), ttlMax = OFFER_TTL,
      dist = origin and hdist(origin, o.pos) or 0,
      dir = origin and compass(o.pos.x - origin.x, o.pos.y - origin.y) or '',
    }
  end
  local job
  if S.job then
    local j = S.job
    job = {
      id = j.id, typeId = j.type.id, typeLabel = j.type.label, desc = j.type.desc, caller = j.caller,
      vehicle = j.vehicle, pay = j.pay, phase = j.phase, dist = j.playerDist or 0, dir = j.bearing or '',
      towed = j.towed or 0, minTow = MIN_TOW, quality = j.quality, losses = j.losses or 0,
      canStrap = j.canStrap, canDone = j.canDone, hint = j.hint, carBrake = j.carBrake,
      strapToken = j.strapToken, truckSpeed = j.truckSpeed or 0,
    }
  end
  pcall(function()
    guihooks.trigger(HOOK, {
      duty = S.duty, bank = S.bank, jobsDone = S.jobsDone, session = S.session, towedMeters = S.towedMeters,
      offers = offers, job = job, result = S.result, units = units(), inLevel = inLevel(),
    })
  end)
end

-- Called from the UI app ----------------------------------------------------------------------------------

function M.requestState()
  pushState()
end

function M.toggleDuty()
  S.duty = not S.duty
  if not S.duty then S.offers = {} end
  S.callTimer = 6
  save()
  toast('info', 'Tow Dispatch', S.duty and 'You are ON DUTY. Calls are coming.' or 'You are OFF DUTY. No new calls.', 3000)
  pushState()
end

function M.requestCall()
  if not S.duty then S.duty = true; save() end
  if not inLevel() then return end
  if not addOffer(false) then
    toast('warning', 'Tow Dispatch', #S.offers >= MAX_OFFERS and 'You already have ' .. MAX_OFFERS .. ' calls waiting.' or 'No spot for a call near you right now. Try again in a moment.', 4000)
  end
  pushState()
end

function M.accept(id)
  id = tonumber(id)
  local offer, index = findOffer(id)
  if not offer then return pushState() end
  if S.job then
    toast('warning', 'Tow Dispatch', 'Finish the job you have first.', 3000)
    return pushState()
  end
  table.remove(S.offers, index)
  local dir = vec3(offer.dir.x, offer.dir.y, 0)
  local opts = {
    pos = vec3(offer.pos.x, offer.pos.y, offer.pos.z + 0.3),
    rot = quat(0, 0, 1, 0) * quatFromDir(-dir, vec3(0, 0, 1)),
    autoEnterVehicle = false,
    cling = true,
  }
  if offer.config then opts.config = offer.config end
  local ok, veh = pcall(core_vehicles.spawnNewVehicle, offer.model, opts)
  if not ok or not veh then
    logMsg('E', 'spawning ' .. tostring(offer.model) .. ' failed: ' .. tostring(veh))
    toast('error', 'Tow Dispatch', 'The car for that call could not be spawned. Call dropped.', 5000)
    return pushState()
  end
  local pv = playerVeh()
  if pv and vehId(pv) == vehId(veh) and S.truckId then
    pcall(function() be:enterVehicle(0, getVeh(S.truckId)) end)   -- never put the player in the customer's car
  end
  S.job = {
    id = offer.id, type = offer.type, caller = offer.caller, vehicle = offer.vehicle, model = offer.model,
    pay = offer.pay, vid = vehId(veh), phase = 'enroute', age = 0, prepIn = 1.5, pickup = offer.pos,
    strapToken = 0, lostTime = 0, losses = 0, carBrake = true,
  }
  setRoute(offer.pos)
  toast('success', 'Call accepted', offer.caller .. "'s " .. offer.vehicle .. '. Follow the GPS.', 4000)
  pushState()
end

function M.decline(id)
  local _, index = findOffer(tonumber(id))
  if index then table.remove(S.offers, index) end
  pushState()
end

function M.routeToCar()
  if S.job and S.job.carPos then setRoute(S.job.carPos) end
end

function M.toggleCarBrake()
  if S.job then setCarBrake(S.job, not S.job.carBrake) end
  pushState()
end

-- The strap minigame was won. quality: 0..100
function M.strapsDone(quality)
  local job = S.job
  if not job or job.phase ~= 'onscene' then return pushState() end
  local truck, car = getTruck(), getVeh(job.vid)
  if not truck or not car then return pushState() end
  local carrier, rel = nearestCarrier(truck, car)
  if rel.gap > WITH_TRUCK_GAP + 1 or speedOf(truck) > 1.5 then
    toast('warning', 'Straps', 'The car has to be on your truck and the truck stopped.', 4000)
    return pushState()
  end
  job.phase = 'secured'
  job.quality = math.max(0, math.min(100, math.floor(tonumber(quality) or 60)))
  job.carrierId = vehId(carrier)
  job.rel0 = {x = rel.x, y = rel.y, z = rel.z}
  job.lostTime = 0
  job.canStrap = false
  job.hint = 'Tow it anywhere on the map, stop, then press DONE.'
  setCarBrake(job, true)
  toast('success', 'Load secured', 'Tow it anywhere and press DONE.', 4000)
  pushState()
end

function M.done()
  local job = S.job
  if not job then return pushState() end
  if not job.canDone then
    toast('warning', 'Not yet', job.hint or 'Strap the car down and tow it somewhere first.', 4000)
    return pushState()
  end
  local towed = job.towed or 0
  local total, lines = payFor(job, towed)
  payPlayer(total, 'Tow job: ' .. job.vehicle)
  S.jobsDone = S.jobsDone + 1
  S.towedMeters = S.towedMeters + towed
  S.resultToken = S.resultToken + 1
  S.result = {token = S.resultToken, total = total, lines = lines, vehicle = job.vehicle, caller = job.caller, towed = towed}
  save()
  local vid = job.vid
  S.job = nil
  setRoute(nil)
  removeCar(vid)
  pcall(function() ui_message(string.format('Tow job complete: +$%d', total), 6, 'towTruckCalls', 'check') end)
  toast('success', 'JOB DONE  +$' .. total, job.vehicle .. ' dropped off. Nice work.', 6000)
  S.callTimer = math.min(S.callTimer, 15)
  pushState()
end

function M.cancel()
  local job = S.job
  if not job then return pushState() end
  if inCustomerCar() and getTruck() then
    pcall(function() be:enterVehicle(0, getTruck()) end)
  end
  local vid = job.vid
  endJob('Job cancelled.', 'info')
  removeCar(vid)
  pushState()
end

function M.resetStats()
  S.bank, S.jobsDone, S.towedMeters, S.session = 0, 0, 0, 0
  save()
  pushState()
end

-- Game hooks ------------------------------------------------------------------------------------------------

local function clearAll()
  S.offers = {}
  S.job = nil
  S.removals = {}
  S.pool = nil
  S.truckId = nil
  S.callTimer = FIRST_CALL_DELAY
end

function M.onExtensionLoaded()
  math.randomseed(os.time())
  loadSave()
  S.loaded = true
  pushState()
end

function M.onExtensionUnloaded()
  setRoute(nil)
end

function M.onClientStartMission()
  clearAll()
  pushState()
end

function M.onClientEndMission()
  clearAll()
  setRoute(nil)
  pushState()
end

function M.onVehicleDestroyed(vid)
  if S.truckId == vid then S.truckId = nil end
  if S.job and S.job.vid == vid then
    endJob("The customer's car was removed. Job cancelled.")
    pushState()
  end
end

function M.onVehicleSwitched()
  rememberTruck()
end

function M.onUpdate(dtReal, dtSim)
  dtReal = dtReal or 0
  updateRemovals(dtReal)
  local dt = dtSim or dtReal
  if dt > 0 and inLevel() then
    rememberTruck()

    for i = #S.offers, 1, -1 do
      local o = S.offers[i]
      o.ttl = o.ttl - dt
      if o.ttl <= 0 then table.remove(S.offers, i) end
    end

    if S.duty and not otherGameplayRunning() then
      S.callTimer = S.callTimer - dt * (S.job and 0.5 or 1)
      if S.callTimer <= 0 then
        S.callTimer = CALL_GAP_MIN + math.random() * (CALL_GAP_MAX - CALL_GAP_MIN)
        addOffer(false)
      end
    end

    if S.job then updateJob(dt) end
  end

  S.pushTimer = S.pushTimer - dtReal
  if S.pushTimer <= 0 then
    S.pushTimer = (S.job or #S.offers > 0) and 0.25 or 1
    pushState()
  end
end

-- Beacon over the customer's car until it is strapped down.
function M.onPreRender()
  local job = S.job
  if not job or not job.carPos or job.phase == 'secured' or not debugDrawer then return end
  pcall(function()
    local base = vec3(job.carPos.x, job.carPos.y, job.carPos.z + 1.2)
    local top = base + vec3(0, 0, job.phase == 'enroute' and 40 or 6)
    local pulse = 0.75 + 0.25 * math.sin(os.clock() * 4)
    debugDrawer:drawCylinder(base, top, 0.25, ColorF(1, 0.62, 0.05, 0.75 * pulse))
    debugDrawer:drawCylinder(base, top, 0.5, ColorF(1, 0.62, 0.05, 0.2))
    debugDrawer:drawTextAdvanced(base + vec3(0, 0, 1.2), 'TOW: ' .. job.vehicle, ColorF(1, 1, 1, 1), true, false, ColorI(0, 0, 0, 190))
  end)
end

-- For the console / testing.
M.state = S
M.CALL_TYPES = CALL_TYPES

return M
