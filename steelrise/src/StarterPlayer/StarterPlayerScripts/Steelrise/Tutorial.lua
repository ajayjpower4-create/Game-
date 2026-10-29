-- Short playable tutorial on the Empty Land site: unload, rig, lift, land,
-- bolt, unhook, carry scaffold, save. Each step advances on real gameplay
-- events from the server, never on a timer.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Steelrise")

local State = require(script.Parent.State)
local HUD = require(script.Parent.HUD)
local Net = require(script.Parent.Net)
local Settings = require(script.Parent.Settings)
local View = require(script.Parent.View)

local Tutorial = {}
local player = Players.LocalPlayer
local index = 0
local steps

local function itemIs(data, prefix)
	return data and type(data.item) == "string" and string.sub(data.item, 1, #prefix) == prefix
end

steps = {
	{
		text = "Welcome to STEELRISE. Walk to the flatbed truck parked in unloading bay 1.",
		check = function()
			local site = State.site
			local trailers = site and site:FindFirstChild("Trailers")
			local root = View.rootPosition()
			if not trailers or not root then
				return false
			end
			for _, t in ipairs(trailers:GetChildren()) do
				if (t:GetPivot().Position - root).Magnitude < 40 then
					return true
				end
			end
			return false
		end,
	},
	{ text = "Every stack is strapped down. Aim at an orange ratchet strap and press E to release it.", event = "StrapReleased" },
	{ text = "Take the crane: equip the radio remote (5) to work from the ground, or press E at the yellow access gate at the base of the mast to sit in the cab.", event = "CraneEntered" },
	{
		text = "Fly the hook over a precast footing — A/D slew, W/S trolley, R/F hoist, Shift for fine control. When the crane panel says “G — hook”, press G.",
		event = "Rigged",
		match = function(d)
			return itemIs(d, "FT-")
		end,
	},
	{
		text = "Lift it clear (R), swing it to the yellow blueprint outline and lower it (F). Assist (H) shows a target ghost and directions. Press ENTER when it reads ALIGNED.",
		event = "Landed",
		match = function(d)
			return itemIs(d, "FT-")
		end,
	},
	{ text = "Footings are grouted, not bolted — press G to unhook.", event = "Unhooked" },
	{
		text = "Next, a column. It is lifted by its top lug so it hangs plumb. Hook one, land it on the footing (ENTER).",
		event = "Landed",
		match = function(d)
			return itemIs(d, "COL-")
		end,
	},
	{
		text = "The crane holds it while you bolt it down. Leave the controls (X), equip the impact wrench (2) and hold the left mouse button on each yellow anchor nut.",
		event = "Installed",
		match = function(d)
			return itemIs(d, "COL-")
		end,
	},
	{ text = "Column is fastened. Take the controls again (5 or the cab) and unhook it with G.", event = "Unhooked" },
	{
		text = "Scaffold time. In the laydown yard, pick up a base jack (E) and place it on the ground next to the frame (left click).",
		event = "Placed",
		match = function(d)
			return itemIs(d, "SC-BASEJACK")
		end,
	},
	{ text = "Good. Keep building: uprights on jacks, ledgers between rosettes (hammer them tight with 3), then a platform deck. Press P and save to a slot to finish the tutorial.", local_event = "Saved" },
}

local function show()
	local s = steps[index]
	if not s then
		return
	end
	HUD.setTutorial(s.text, index, #steps, Tutorial.skip)
end

local function finish(skipped)
	index = 0
	State.tutorialActive = false
	HUD.setTutorial(nil)
	State.settings.tutorialDone = true
	Settings.save()
	State.notify(skipped and "Tutorial skipped — F1 shows every control." or "Tutorial complete. The site is yours.", "success")
end

local function advance()
	index += 1
	if index > #steps then
		finish(false)
	else
		show()
	end
end

function Tutorial.skip()
	finish(true)
end

function Tutorial.start()
	State.tutorialActive = true
	index = 0
	task.spawn(function()
		Net.call("Site", true, "Blueprint", "StarterFrame")
	end)
	advance()
end

function Tutorial.init()
	State.on("Progress", function(kind, data)
		if not State.tutorialActive then
			return
		end
		local s = steps[index]
		if s and s.event == kind and (not s.match or s.match(data)) then
			advance()
		end
	end)
	State.on("Saved", function()
		local s = steps[index]
		if State.tutorialActive and s and s.local_event == "Saved" then
			advance()
		end
	end)
	RunService.Heartbeat:Connect(function()
		local s = steps[index]
		if State.tutorialActive and s and s.check and s.check() then
			advance()
		end
	end)
end

return Tutorial
