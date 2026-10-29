-- Drive-in / drive-out animation for delivery trucks. The server places a
-- truck at its bay immediately; every client animates it (and its strapped
-- cargo) rolling in from the road and back out, and plays engine audio.

local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Steelrise")
local Config = require(Shared.Config)

local State = require(script.Parent.State)
local Audio = require(script.Parent.Audio)

local TrailerAnim = {}
local D = Config.Delivery
local DIST = 70 * Config.S

local anims = {} -- trailer model -> { final, cargo = {model -> finalCf}, phase, engine }

local function now()
	return workspace:GetServerTimeNow()
end

local function easeOut(t)
	return 1 - (1 - t) ^ 3
end

local function easeIn(t)
	return t * t * t
end

local function cargoOf(site, id)
	local out = {}
	local comps = site:FindFirstChild("Components")
	if comps then
		for _, m in ipairs(comps:GetChildren()) do
			if m:GetAttribute("TrailerId") == id then
				table.insert(out, m)
			end
		end
	end
	return out
end

-- Roll every wheel by the distance travelled since the last frame.
local function spinWheels(a, travelled)
	local wheels = a.model:FindFirstChild("Wheels")
	if not wheels or travelled == 0 then
		return
	end
	for _, w in ipairs(wheels:GetChildren()) do
		local r = w:GetAttribute("Radius")
		if r and r > 0 and w.PrimaryPart then
			w:PivotTo(w:GetPivot() * CFrame.Angles(travelled / r, 0, 0))
		end
	end
end
TrailerAnim.spinWheels = spinWheels

local function moveAll(a, offset)
	spinWheels(a, offset - (a.lastOffset or offset))
	a.lastOffset = offset
	local cf = a.final * CFrame.new(offset, 0, 0)
	a.model:PivotTo(cf)
	local rel = cf * a.final:Inverse()
	for m, finalCf in pairs(a.cargo) do
		if m.Parent and (m:GetAttribute("State") == "Restrained" or m:GetAttribute("State") == "Loose") then
			m:PivotTo(rel * finalCf)
		end
	end
end

function TrailerAnim.init()
	RunService.RenderStepped:Connect(function(dt)
		local site = State.site
		local folder = site and site:FindFirstChild("Trailers")
		if not folder then
			return
		end
		local t = now()
		for _, model in ipairs(folder:GetChildren()) do
			local a = anims[model]
			if not a then
				a = { model = model, final = model:GetPivot(), cargo = {}, phase = "idle" }
				local engine = model:FindFirstChild("Engine")
				a.engine = Audio.loop("TruckIdle", engine)
				anims[model] = a
				model.AncestryChanged:Connect(function()
					if not model.Parent then
						if a.engine then
							a.engine:destroy()
						end
						anims[model] = nil
					end
				end)
			end
			local arriveAt = model:GetAttribute("ArriveAt") or 0
			local departAt = model:GetAttribute("DepartAt") or 0
			local dist = model:GetAttribute("AnimDist") or DIST
			local engineLevel = 0.45
			if departAt > 0 then
				if a.phase ~= "depart" then
					a.phase = "depart"
					a.cargo = {}
					Audio.play("TruckAirBrake", model.PrimaryPart, 0.6)
				end
				local p = math.clamp((t - departAt) / D.DepartSeconds, 0, 1)
				moveAll(a, -easeIn(p) * dist)
				engineLevel = 1
			elseif arriveAt > 0 and t < arriveAt + D.ArriveSeconds then
				if a.phase ~= "arrive" then
					a.phase = "arrive"
					a.cargo = {}
					for _, m in ipairs(cargoOf(site, model:GetAttribute("TrailerId"))) do
						a.cargo[m] = m:GetPivot()
					end
				end
				local p = math.clamp((t - arriveAt) / D.ArriveSeconds, 0, 1)
				moveAll(a, (1 - easeOut(p)) * dist)
				engineLevel = 1 - p * 0.5
			elseif a.phase == "arrive" then
				moveAll(a, 0)
				a.phase = "idle"
				a.cargo = {}
				Audio.play("TruckAirBrake", model.PrimaryPart)
			end
			if a.engine then
				a.engine:set(engineLevel, 0.9 + engineLevel * 0.3)
				a.engine:step(dt)
			end
		end
	end)
end

function TrailerAnim.reset()
	for _, a in pairs(anims) do
		if a.engine then
			a.engine:destroy()
		end
	end
	anims = {}
end

return TrailerAnim
