-- Blueprint ghosts: translucent outlines of what still has to be built on
-- the current working level, with the next member highlighted. Installed
-- members disappear from the ghost set, so the building itself shows
-- progress. Purely local (never replicated).

local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Steelrise")
local Config = require(Shared.Config)
local Registry = require(Shared.ItemRegistry)
local Sites = require(Shared.Sites)
local Factory = require(Shared.ModelFactory)

local State = require(script.Parent.State)
local View = require(script.Parent.View)

local Blueprint = {}
local folder
local entries = nil
local entriesFor = nil
local dirty = true
local visible = true
local MAX_GHOSTS = 450

local function posKey(itemId, p)
	return itemId .. "@" .. math.floor(p.X * 2 + 0.5) .. "," .. math.floor(p.Y * 2 + 0.5) .. "," .. math.floor(p.Z * 2 + 0.5)
end

function Blueprint.markDirty()
	dirty = true
end

function Blueprint.toggle()
	visible = not visible
	dirty = true
	State.notify(visible and "Blueprint ghosts on" or "Blueprint ghosts off", "info")
end

local function rebuild()
	dirty = false
	folder:ClearAllChildren()
	local site = State.site
	if not visible or not site or not State.siteDef or State.mode ~= "Play" then
		return
	end
	local bp = site:GetAttribute("Blueprint") or ""
	if bp == "" then
		entries = nil
		return
	end
	if entriesFor ~= State.siteDef.id .. ":" .. bp then
		local grid = Sites.blueprintGrid(State.siteDef, bp)
		entries = grid and Sites.sortEntries(Sites.layout(grid)) or nil
		entriesFor = State.siteDef.id .. ":" .. bp
	end
	if not entries then
		return
	end
	local built = {}
	local comps = site:FindFirstChild("Components")
	for _, m in ipairs(comps and comps:GetChildren() or {}) do
		local st = m:GetAttribute("State")
		if st == "Installed" or st == "Placed" then
			built[posKey(m:GetAttribute("ItemId"), m:GetPivot().Position)] = st
		end
	end
	-- working level = level of the first unbuilt entry
	local first = nil
	for _, e in ipairs(entries) do
		if built[posKey(e.item, e.cf.Position)] ~= "Installed" then
			first = e
			break
		end
	end
	if not first then
		return
	end
	local lvl = first.level
	local root = View.rootPosition()
	local range = State.detailDistance or 450
	local count = 0
	for _, e in ipairs(entries) do
		local show = (e.level == lvl) or (lvl == 0 and e.level == 1 and e.phase == "column") or (e.level == lvl + 1 and e.phase == "column")
		if show and not built[posKey(e.item, e.cf.Position)] then
			if not root or (e.cf.Position - root).Magnitude < range then
				local def = Registry.get(e.item)
				if def then
					local isNext = e == first
					local p = Factory.proxy(def, e.cf, isNext and Config.Colors.Safety or Config.Colors.Info, isNext and 0.45 or 0.78)
					p.Parent = folder
					count += 1
					if count >= MAX_GHOSTS then
						break
					end
				end
			end
		end
	end
end

function Blueprint.init()
	folder = Instance.new("Folder")
	folder.Name = "SR_Blueprint"
	folder.Parent = workspace.CurrentCamera
	State.on("Progress", function()
		dirty = true
	end)
	local acc = 0
	RunService.Heartbeat:Connect(function(dt)
		acc += dt
		if acc > 1.0 and dirty then
			acc = 0
			rebuild()
		elseif acc > 6 then
			acc = 0
			rebuild()
		end
	end)
end

return Blueprint
