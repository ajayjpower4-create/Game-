-- Hand placement of carried components: a transparent ghost snaps to grid or
-- connection points, turns green/red and explains exactly why a placement is
-- invalid. R/Z/C rotate, T toggles free placement for suitable items, arrow
-- keys nudge, LMB sets the piece, G drops it.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Steelrise")
local Config = require(Shared.Config)
local Registry = require(Shared.ItemRegistry)
local Factory = require(Shared.ModelFactory)
local BuildRules = require(Shared.BuildRules)

local State = require(script.Parent.State)
local HUD = require(script.Parent.HUD)
local Net = require(script.Parent.Net)
local View = require(script.Parent.View)

local Placement = {}
local player = Players.LocalPlayer
local S = Config.S

local ghost, ghostDef, highlight
local rot = 0
local free = false
local nudge = Vector3.zero
local lastCf, lastValid, lastReason = nil, false, nil
local placing = false
local solveAcc = 0

local function clearGhost()
	if ghost then
		ghost:Destroy()
	end
	ghost, ghostDef, highlight = nil, nil, nil
	HUD.setPlacement(nil)
end

local function makeGhost(def)
	clearGhost()
	ghostDef = def
	ghost = Factory.build(def, CFrame.new(0, -500, 0), { ghost = true, preview = true })
	ghost.Name = "SR_Ghost"
	highlight = Instance.new("Highlight")
	highlight.FillTransparency = 0.55
	highlight.OutlineTransparency = 0.1
	highlight.DepthMode = Enum.HighlightDepthMode.AlwaysOnTop
	highlight.Parent = ghost
	ghost.Parent = workspace.CurrentCamera
	rot, free, nudge = 0, false, Vector3.zero
end

local function findCarried()
	local site = State.site
	local comps = site and site:FindFirstChild("Components")
	if not comps then
		return nil
	end
	local me = tostring(player.UserId)
	for _, m in ipairs(comps:GetChildren()) do
		if m:GetAttribute("State") == "Carried" and m:GetAttribute("Holder") == me then
			return m
		end
	end
	return nil
end

local function hints(def)
	local h = "LMB place · R rotate · Z/C fine"
	if def.allowFree then
		h ..= " · T free" .. (free and " (ON)" or "")
		if free then
			h ..= " · arrows nudge"
		end
	end
	return h .. " · G drop"
end

local function update(dt)
	local carried = State.carrying
	if not carried or not carried.Parent or State.mode ~= "Play" or State.crane.operating then
		if ghost then
			clearGhost()
		end
		return
	end
	local def = Registry.get(carried:GetAttribute("ItemId"))
	if not def then
		return
	end
	if ghostDef ~= def then
		makeGhost(def)
	end
	if State.uiBlocking then
		ghost:PivotTo(CFrame.new(0, -500, 0))
		HUD.setPlacement(nil)
		return
	end
	solveAcc += dt
	if solveAcc < 1 / 30 then
		return
	end
	solveAcc = 0
	local world = State.world
	local exclude = { carried, ghost }
	local hit = View.cast(Config.Reach.Place + 14, exclude)
	local cf, reason
	if hit then
		local aim = { point = hit.Position, hit = hit.Instance, normal = hit.Normal }
		cf, reason = BuildRules.solve(world, def, aim, { rot = rot, free = free, nudge = nudge * S, excludeModels = { carried, player.Character } })
	else
		reason = "Aim at the ground or a connection."
	end
	local valid = false
	if cf then
		local ok, why = BuildRules.validate(world, def, cf, {
			exclude = { carried:GetAttribute("ComponentId") },
			excludeModels = { carried, player.Character },
			actorPos = View.rootPosition(),
			reach = Config.Reach.Place,
		})
		valid, reason = ok, why
		ghost:PivotTo(cf)
	elseif hit then
		ghost:PivotTo(CFrame.new(hit.Position + Vector3.new(0, def.originBottom and 0 or def.size.Y / 2, 0)) * CFrame.Angles(0, math.rad(90 * rot), 0))
	else
		ghost:PivotTo(CFrame.new(0, -500, 0))
	end
	lastCf, lastValid, lastReason = cf, valid, reason
	highlight.FillColor = valid and Config.Colors.Valid or Config.Colors.Invalid
	highlight.OutlineColor = valid and Config.Colors.Valid or Config.Colors.Invalid
	HUD.setPlacement({
		title = def.name .. (free and "  ·  FREE PLACEMENT" or ""),
		valid = valid,
		reason = reason,
		hints = hints(def),
	})
end

local function place()
	if placing or not State.carrying or not lastCf then
		if lastReason then
			State.notify(lastReason, "warn")
		end
		return
	end
	if not lastValid then
		State.notify(lastReason or "Can't place here.", "warn")
		return
	end
	placing = true
	local id = State.carrying:GetAttribute("ComponentId")
	local cf = lastCf
	task.spawn(function()
		local ok = Net.call("Handle", false, "Place", id, cf, free)
		placing = false
		if ok then
			State.carrying = nil
			clearGhost()
			State.fire("CarryChanged", nil)
		end
	end)
end

function Placement.init()
	UserInputService.InputBegan:Connect(function(input, gp)
		if gp or State.mode ~= "Play" or State.uiBlocking or State.crane.operating or not State.carrying then
			return
		end
		local def = ghostDef
		local k = input.KeyCode
		if input.UserInputType == Enum.UserInputType.MouseButton1 then
			place()
		elseif k == Enum.KeyCode.R then
			-- always a quarter turn; Z/C step 15° in free placement
			rot += free and (90 / Config.Grid.FreeRotateStep) or 1
		elseif k == Enum.KeyCode.Z then
			rot -= 1
		elseif k == Enum.KeyCode.C then
			rot += 1
		elseif k == Enum.KeyCode.T then
			if def and def.allowFree then
				free = not free
				nudge = Vector3.zero
			else
				State.notify("Free placement is only for props and equipment — structure snaps to its connections.", "info")
			end
		elseif k == Enum.KeyCode.G then
			task.spawn(function()
				local ok = Net.call("Handle", false, "Drop")
				if ok then
					State.carrying = nil
					clearGhost()
					State.fire("CarryChanged", nil)
				end
			end)
		elseif free and (k == Enum.KeyCode.Up or k == Enum.KeyCode.Down or k == Enum.KeyCode.Left or k == Enum.KeyCode.Right) then
			local step = UserInputService:IsKeyDown(Enum.KeyCode.LeftShift) and 0.5 or Config.Grid.Fine
			local look = workspace.CurrentCamera.CFrame.LookVector
			local fwd = Vector3.new(look.X, 0, look.Z)
			fwd = fwd.Magnitude > 0 and fwd.Unit or Vector3.zAxis
			local right = fwd:Cross(Vector3.yAxis)
			local d = (k == Enum.KeyCode.Up and fwd) or (k == Enum.KeyCode.Down and -fwd) or (k == Enum.KeyCode.Right and right) or -right
			nudge += d * step
		end
	end)

	-- track what we carry (attribute changes replicate from the server)
	local pollAcc = 0
	RunService.RenderStepped:Connect(function(dt)
		pollAcc += dt
		if pollAcc > 0.2 then
			pollAcc = 0
			local m = findCarried()
			if m ~= State.carrying then
				State.carrying = m
				State.fire("CarryChanged", m)
				local hum = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
				if hum then
					local def = m and Registry.get(m:GetAttribute("ItemId"))
					local canClimb = not def or Config.WeightClasses[def.weightClass].climb
					hum:SetStateEnabled(Enum.HumanoidStateType.Climbing, canClimb)
				end
			end
		end
		update(dt)
	end)
end

return Placement
