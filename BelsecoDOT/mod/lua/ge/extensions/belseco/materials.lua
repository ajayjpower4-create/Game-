-- Belseco DOT Mega Pack - material name diagnostic.
--
-- A skin only appears on the panels whose *base* material name it matches, and
-- those names belong to the base game, not to this pack. Rather than guess,
-- this prints the real list from your installed copy of the game.
--
-- Open the console with the tilde key and run:
--
--     extensions.load('belseco_materials')
--     belseco_materials.dump('pickup')
--     belseco_materials.dump('us_semi')
--
-- Then paste the output into tools/generate_materials.py (BASE_MATERIALS) and
-- rebuild. `belseco_materials.check('pickup')` additionally reports which of the
-- names this pack currently targets actually exist.

local M = {}

-- the names this pack's skins are currently generated against
local targeted = {
  pickup = {
    "pickup", "pickup_body", "pickup_bed", "pickup_bedside", "pickup_doors",
    "pickup_cab", "pickup_fenders", "pickup_bumpers", "pickup_canopy",
    "pickup_utility", "pickup_flatbed",
  },
  us_semi = {
    "us_semi", "us_semi_body", "us_semi_cab", "us_semi_doors", "us_semi_hood",
    "us_semi_fenders", "us_semi_sleeper", "us_semi_bumper", "us_semi_fueltank",
    "us_semi_chassis",
  },
}

local function collect(vehicleDir)
  local dir = "/vehicles/" .. vehicleDir .. "/"
  local ok, files = pcall(function()
    return FS:findFiles(dir, "*.materials.json", -1, true, false)
  end)
  if not ok or not files then
    log("E", "belseco", "could not list " .. dir .. " - is the vehicle folder named something else?")
    return nil
  end

  local names = {}
  local seen = {}
  for _, file in ipairs(files) do
    local okRead, data = pcall(jsonReadFile, file)
    if okRead and type(data) == "table" then
      for key, _ in pairs(data) do
        -- skip skin materials, including our own, and keep only base names
        if type(key) == "string" and not key:find("%.skin%.") and not seen[key] then
          seen[key] = true
          table.insert(names, key)
        end
      end
    end
  end
  table.sort(names)
  return names, files
end

local function dump(vehicleDir)
  vehicleDir = vehicleDir or "pickup"
  local names, files = collect(vehicleDir)
  if not names then return end

  print("")
  print("=== Belseco: base material names for /vehicles/" .. vehicleDir .. "/ ===")
  print("(" .. #files .. " materials file(s), " .. #names .. " materials)")
  for _, name in ipairs(names) do
    print("  " .. name)
  end
  print("=== copy the body/paint ones into BASE_MATERIALS in tools/generate_materials.py ===")
  print("")
  return names
end

-- Report whether the names this pack targets actually exist, which is the
-- fastest way to tell a livery bug from a texture bug.
local function check(vehicleDir)
  vehicleDir = vehicleDir or "pickup"
  local names = collect(vehicleDir)
  if not names then return end

  local exists = {}
  for _, n in ipairs(names) do exists[n] = true end

  local hits, misses = {}, {}
  for _, n in ipairs(targeted[vehicleDir] or {}) do
    table.insert(exists[n] and hits or misses, n)
  end

  print("")
  print("=== Belseco: skin targeting check for " .. vehicleDir .. " ===")
  print("MATCHED (" .. #hits .. "): " .. (#hits > 0 and table.concat(hits, ", ") or "none"))
  print("NOT FOUND (" .. #misses .. "): " .. (#misses > 0 and table.concat(misses, ", ") or "none"))
  if #hits == 0 then
    print("No matches - that is why the livery is not showing. Run dump('" .. vehicleDir .. "')")
    print("and use the real names instead.")
  end
  print("")
  return hits, misses
end

M.dump = dump
M.check = check

return M
