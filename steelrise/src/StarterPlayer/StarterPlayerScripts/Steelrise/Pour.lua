-- Concrete placement with the pump hose: previews the slab for the aimed
-- deck bay (green/red with the reason) and pours it while the mouse is held.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Steelrise")
local Config = require(Shared.Config)
local Factory = require(Shared.ModelFactory)
local BuildRules = require(Shared.BuildRules)

local State = require(script.Parent.State)
local HUD = require(script.Parent.HUD)
local Net = require(script.Parent.Net)
local View = require(script.Parent.View)

local Pour = {}
local player = Players.LocalPlayer
local POUR_TIME = 2.5

local ghost, ghostDef, highlight
local target = nil -- { def, cf, valid, reason }
local holdStart = nil
local busy = false
local acc = 0
local shown = false

local function active()
	return State.mode == "Play" and State.tool == "TL-POUR" and not State.uiBlocking and not State.crane.operating and not State.carrying
end

local function clearGhost()
	if ghost then
		ghost:Destroy()
	end
	ghost, ghostDef, highlight = nil, nil, nil
end

local function update(dt)
	if not active() then
		if shown then
			shown = false
			clearGhost()
			target = nil
			holdStart = nil
			HUD.setHold(nil)
			if not State.carrying then
				HUD.setPlacement(nil)
			end
		end
		return
	end
	shown = true
	acc += dt
	if acc >= 1 / 20 then
		acc = 0
		local hit = View.cast(Config.Reach.Place + 20)
		local def, cf, reason
		if hit then
			def, cf, reason = BuildRules.solveSlab(State.world, { point = hit.Position, hit = hit.Instance })
		else
			reason = "Aim at the metal deck of a floor bay."
		end
		local valid = false
		if def and cf then
			local ok, why = BuildRules.validate(State.world, def, cf, { excludeModels = { player.Character } })
			valid, reason = ok, why
			if ghostDef ~= def then
				clearGhost()
				ghost = Factory.build(def, cf, { ghost = true, preview = true })
				ghostDef = def
				highlight = Instance.new("Highlight")
				highlight.FillTransparency = 0.6
				highlight.OutlineTransparency = 0.1
				highlight.Parent = ghost
				ghost.Parent = workspace.CurrentCamera
			end
			ghost:PivotTo(cf + Vector3.new(0, 0.05, 0))
			highlight.FillColor = valid and Config.Colors.Valid or Config.Colors.Invalid
			highlight.OutlineColor = highlight.FillColor
			target = { def = def, cf = cf, valid = valid, reason = reason }
		else
			clearGhost()
			target = nil
		end
		HUD.setPlacement({
			title = def and ("Pour: " .. def.name) or "Concrete pump hose",
			valid = valid,
			okText = "Bay ready — hold the left mouse button to pour",
			reason = reason,
			hints = "Hold LMB pour · 7 trowel to finish · 1 hands",
		})
	end
	if holdStart then
		if not target or not target.valid then
			holdStart = nil
			HUD.setHold(nil)
			return
		end
		local a = (os.clock() - holdStart) / POUR_TIME
		HUD.setHold(a)
		if a >= 1 and not busy then
			holdStart = nil
			HUD.setHold(nil)
			busy = true
			local t = target
			task.spawn(function()
				Net.call("Build", false, "Pour", t.def.id, t.cf)
				busy = false
			end)
		end
	end
end

function Pour.init()
	UserInputService.InputBegan:Connect(function(input, gp)
		if gp or not active() then
			return
		end
		if input.UserInputType == Enum.UserInputType.MouseButton1 then
			if target and target.valid then
				holdStart = os.clock()
				State.fire("LocalPourStart", target.cf.Position)
			elseif target then
				State.notify(target.reason or "Can't pour here.", "warn")
			end
		end
	end)
	UserInputService.InputEnded:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.MouseButton1 and holdStart then
			holdStart = nil
			HUD.setHold(nil)
		end
	end)
	RunService.RenderStepped:Connect(update)
end

return Pour
