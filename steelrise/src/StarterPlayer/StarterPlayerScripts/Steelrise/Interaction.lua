-- On-foot interaction: what the crosshair is on, contextual prompts, picking
-- up, releasing straps, entering the crane, releasing trucks, switching
-- equipment, and hold-to-fasten / hold-to-dismantle with the equipped tool.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Steelrise")
local Config = require(Shared.Config)
local Registry = require(Shared.ItemRegistry)
local Util = require(Shared.Util)

local State = require(script.Parent.State)
local HUD = require(script.Parent.HUD)
local Net = require(script.Parent.Net)
local View = require(script.Parent.View)
local Audio = require(script.Parent.Audio)

local Interaction = {}
local player = Players.LocalPlayer

local target = nil -- resolved aim target
local hold = nil -- { kind, id, index, start, duration }
local busy = false
local markers = {}
local markerFolder

local HOLD_TIME = { Bolt = 0.55, Wedge = 0.35, Weld = 0.9, Screed = 0.8, Dismantle = 1.2 }
local TOOL_NAME = { Bolt = "impact wrench (2)", Wedge = "scaffold hammer (3)", Weld = "welder (4)", Screed = "trowel (7)" }

local function active()
	return State.mode == "Play" and not State.uiBlocking and not State.crane.operating
end

local function within(pos, extra)
	local root = View.rootPosition()
	return root and (root - pos).Magnitude <= Config.Reach.Interact + (extra or 0)
end

local function resolve(result)
	if not result then
		return nil
	end
	local inst = result.Instance
	if inst:GetAttribute("StrapHit") then
		return { kind = "Strap", strap = inst.Parent, pos = result.Position, dist = result.Distance }
	end
	local craneKind = inst:GetAttribute("CraneInteract")
	if craneKind then
		local model = inst.Parent
		while model and model ~= workspace and not model:GetAttribute("CraneId") do
			model = model.Parent
		end
		return { kind = "Crane", crane = model, pos = result.Position, dist = result.Distance }
	end
	if inst:GetAttribute("TrailerInteract") then
		local m = inst:FindFirstAncestorWhichIsA("Model")
		return { kind = "Truck", trailer = m, pos = result.Position, dist = result.Distance }
	end
	if State.world then
		local rec = State.world:record(inst)
		if rec then
			return { kind = "Component", rec = rec, part = inst, pos = result.Position, dist = result.Distance }
		end
	end
	return nil
end

-- Nearest unfastened fastener of `ftype` on a placed component near `point`.
local function nearestFastener(rec, point, ftype)
	local folder = rec.model:FindFirstChild("Fasteners")
	if not folder then
		return nil
	end
	local best, bestD = nil, 2.2
	for _, f in ipairs(folder:GetChildren()) do
		if f.Transparency > 0.5 and (not ftype or f:GetAttribute("Type") == ftype) then
			local d = (f.Position - point).Magnitude
			if d < bestD then
				best, bestD = f, d
			end
		end
	end
	return best
end

local function toolFastens()
	local def = Registry.get(State.tool)
	return def and def.fastens
end

local function buildPrompt()
	if not target then
		return nil
	end
	local list = {}
	local carrying = State.carrying ~= nil
	if target.kind == "Strap" then
		if within(target.pos, 3) then
			table.insert(list, { key = "E", text = "Release ratchet strap", sub = "Frees every piece in this stack" })
		else
			table.insert(list, { text = "Ratchet strap", sub = "Move closer to release", disabled = true })
		end
	elseif target.kind == "Crane" then
		table.insert(list, { key = "E", text = "Climb into the crane cab", sub = "Or operate from the ground with the radio remote (5)" })
	elseif target.kind == "Truck" then
		local t = target.trailer
		if t and t:GetAttribute("Empty") then
			table.insert(list, { key = "E", text = "Release the empty truck", sub = "Frees the unloading bay" })
		elseif t then
			table.insert(list, { text = "Delivery truck — bay " .. tostring(t:GetAttribute("Bay")), sub = tostring(t:GetAttribute("Remaining") or 0) .. " pieces still on the deck", disabled = true })
		end
	elseif target.kind == "Component" then
		local rec = target.rec
		local def = rec.def
		local sub = string.format("%s  ·  %s", Util.fmtKg(def.weightKg), def.handling)
		if rec.state == "Restrained" then
			table.insert(list, { text = def.name, sub = "Secured by cargo straps — release the strap first", disabled = true })
		elseif rec.state == "Loose" then
			local wc = Config.WeightClasses[def.weightClass]
			if wc.carry and not carrying then
				table.insert(list, { key = "E", text = "Pick up " .. def.name, sub = sub })
			elseif not wc.carry then
				table.insert(list, { text = def.name, sub = "Heavy — rig it with the crane (" .. Util.fmtKg(def.weightKg) .. ")", disabled = true })
			end
		elseif rec.state == "Placed" then
			local need = def.fasteners[1] and def.fasteners[1].type
			local ft = toolFastens()
			local done = 0
			local mask = rec.model:GetAttribute("Fastened") or ""
			for i = 1, #mask do
				if string.sub(mask, i, i) == "1" then
					done += 1
				end
			end
			local progress = string.format("%d / %d connections made", done, #def.fasteners)
			if ft and ft == need then
				local f = nearestFastener(rec, target.pos, ft)
				if f then
					local verb = ({ Weld = "Weld", Wedge = "Drive wedge", Screed = "Trowel finish", Bolt = "Tighten bolt" })[ft] or "Fasten"
					table.insert(list, { key = "Hold LMB", text = verb, sub = def.name .. "  ·  " .. progress })
				else
					table.insert(list, { text = "Aim at a yellow connection marker", sub = def.name .. "  ·  " .. progress, disabled = true })
				end
			else
				table.insert(list, { text = def.name .. " — not fastened", sub = "Equip the " .. (TOOL_NAME[need] or "right tool") .. "  ·  " .. progress, disabled = true, subColor = Config.Colors.Safety })
			end
		elseif rec.state == "Installed" then
			table.insert(list, { text = def.name, sub = "Installed" })
			if not carrying then
				table.insert(list, { key = "Hold X", text = "Dismantle", sub = #def.fasteners > 0 and ("Needs the " .. (TOOL_NAME[def.fasteners[1].type] or "tool")) or nil })
			end
		elseif rec.state == "Rigged" then
			table.insert(list, { text = def.name, sub = "On the crane hook", disabled = true })
		end
		if def.functional and (rec.state == "Installed" or rec.state == "Loose") then
			table.insert(list, { key = "F", text = rec.model:GetAttribute("On") and "Switch off" or "Switch on" })
		end
	end
	return list
end

---------------------------------------------------------------------------
-- Fastener markers
---------------------------------------------------------------------------

local function refreshMarkers()
	if not State.site or State.mode ~= "Play" then
		for _, a in pairs(markers) do
			a:Destroy()
		end
		markers = {}
		return
	end
	local root = View.rootPosition()
	local seen = {}
	local comps = State.site:FindFirstChild("Components")
	if root and comps then
		for _, m in ipairs(comps:GetChildren()) do
			if m:GetAttribute("State") == "Placed" then
				local folder = m:FindFirstChild("Fasteners")
				if folder and (m:GetPivot().Position - root).Magnitude < 70 then
					for _, f in ipairs(folder:GetChildren()) do
						if f.Transparency > 0.5 then
							seen[f] = true
							if not markers[f] then
								local a = Instance.new("SphereHandleAdornment")
								a.Adornee = f
								a.Radius = 0.2
								a.Color3 = Config.Colors.Safety
								a.Transparency = 0.15
								a.AlwaysOnTop = true
								a.ZIndex = 2
								a.Parent = markerFolder
								markers[f] = a
							end
						end
					end
				end
			end
		end
	end
	for f, a in pairs(markers) do
		if not seen[f] then
			a:Destroy()
			markers[f] = nil
		end
	end
end

---------------------------------------------------------------------------
-- Actions
---------------------------------------------------------------------------

local function doAsync(fn)
	if busy then
		return
	end
	busy = true
	task.spawn(function()
		local ok, err = pcall(fn)
		if not ok then
			warn(err)
		end
		busy = false
	end)
end

local function onE()
	if not target then
		return
	end
	if target.kind == "Strap" then
		doAsync(function()
			Net.call("Handle", false, "Release", target.strap:GetAttribute("StrapId"))
		end)
	elseif target.kind == "Crane" then
		local craneId = target.crane and target.crane:GetAttribute("CraneId")
		doAsync(function()
			local ok, _, data = Net.call("Crane", false, "Enter", craneId)
			if ok then
				State.fire("CraneStart", data and data.craneId or craneId, "Cab")
			end
		end)
	elseif target.kind == "Truck" then
		local t = target.trailer
		if t and t:GetAttribute("Empty") then
			doAsync(function()
				Net.call("Delivery", false, "Dismiss", t:GetAttribute("TrailerId"))
			end)
		end
	elseif target.kind == "Component" then
		local rec = target.rec
		if rec.state == "Loose" and not State.carrying and Config.WeightClasses[rec.def.weightClass].carry then
			doAsync(function()
				local ok = Net.call("Handle", false, "PickUp", rec.id)
				if ok then
					Audio.play("PickUp", rec.model.PrimaryPart)
				end
			end)
		end
	end
end

local function onF()
	if target and target.kind == "Component" and target.rec.def.functional then
		local id = target.rec.id
		doAsync(function()
			Net.call("Handle", false, "Toggle", id)
		end)
	end
end

local function startHold(kind)
	if not target or target.kind ~= "Component" then
		return
	end
	local rec = target.rec
	if kind == "Fasten" then
		local ft = toolFastens()
		if not ft or rec.state ~= "Placed" then
			return
		end
		local f = nearestFastener(rec, target.pos, ft)
		if not f then
			return
		end
		hold = { kind = "Fasten", id = rec.id, index = f:GetAttribute("Index"), part = f, start = os.clock(), duration = HOLD_TIME[ft] or 0.6, ftype = ft }
		if ft == "Weld" then
			State.fire("LocalWeldStart", f)
		end
	elseif kind == "Dismantle" then
		if rec.state ~= "Installed" and rec.state ~= "Placed" then
			return
		end
		hold = { kind = "Dismantle", id = rec.id, start = os.clock(), duration = HOLD_TIME.Dismantle }
	end
end

local function cancelHold()
	if hold and hold.ftype == "Weld" then
		State.fire("LocalWeldStop")
	end
	hold = nil
	HUD.setHold(nil)
	local hum = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
	if hum then
		hum.CameraOffset = Vector3.zero
	end
end

local function finishHold()
	local h = hold
	cancelHold()
	if h.kind == "Fasten" then
		task.spawn(function()
			Net.call("Build", true, "Fasten", h.id, h.index)
			-- keep going on the next marker while the button stays down
			if UserInputService:IsMouseButtonPressed(Enum.UserInputType.MouseButton1) and active() then
				task.wait(0.1)
				startHold("Fasten")
			end
		end)
	else
		task.spawn(function()
			Net.call("Build", false, "Dismantle", h.id)
		end)
	end
end

---------------------------------------------------------------------------
-- Loop
---------------------------------------------------------------------------

function Interaction.init()
	markerFolder = Instance.new("Folder")
	markerFolder.Name = "SR_Markers"
	markerFolder.Parent = player:WaitForChild("PlayerGui")

	UserInputService.InputBegan:Connect(function(input, gp)
		if gp or not active() then
			return
		end
		if input.KeyCode == Enum.KeyCode.E then
			onE()
		elseif input.KeyCode == Enum.KeyCode.F then
			onF()
		elseif input.KeyCode == Enum.KeyCode.X and not State.carrying then
			startHold("Dismantle")
		elseif input.UserInputType == Enum.UserInputType.MouseButton1 and not State.carrying then
			startHold("Fasten")
		end
	end)
	UserInputService.InputEnded:Connect(function(input)
		if not hold then
			return
		end
		if (hold.kind == "Fasten" and input.UserInputType == Enum.UserInputType.MouseButton1) or (hold.kind == "Dismantle" and input.KeyCode == Enum.KeyCode.X) then
			cancelHold()
		end
	end)

	local acc = 0
	RunService.RenderStepped:Connect(function(dt)
		acc += dt
		if acc > 0.25 then
			acc = 0
			refreshMarkers()
		end
		if not active() then
			if target then
				target = nil
				HUD.setPrompt(nil)
			end
			if hold then
				cancelHold()
			end
			return
		end
		local exclude = {}
		if State.carrying then
			table.insert(exclude, State.carrying)
		end
		target = resolve(View.cast(40, exclude))
		if target and target.dist > Config.Reach.Interact + 12 then
			target = nil
		end
		HUD.setPrompt(buildPrompt())
		-- hovered marker
		for f, a in pairs(markers) do
			a.Radius = 0.2
			a.Color3 = Config.Colors.Safety
		end
		if target and target.kind == "Component" and target.rec.state == "Placed" then
			local f = nearestFastener(target.rec, target.pos, toolFastens())
			if f and markers[f] then
				markers[f].Radius = 0.3
				markers[f].Color3 = Config.Colors.OffWhite
			end
		end
		if hold then
			-- the aim must stay on the same piece
			if not target or target.kind ~= "Component" or target.rec.id ~= hold.id then
				cancelHold()
				return
			end
			if hold.kind == "Fasten" then
				local f = nearestFastener(target.rec, target.pos, hold.ftype)
				if f ~= hold.part then
					cancelHold()
					return
				end
			end
			local a = (os.clock() - hold.start) / hold.duration
			HUD.setHold(a)
			local hum = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
			if hum and hold.kind == "Fasten" and hold.ftype == "Bolt" then
				hum.CameraOffset = Vector3.new(math.random() - 0.5, math.random() - 0.5, 0) * 0.06
			end
			if a >= 1 then
				finishHold()
			end
		end
	end)
end

function Interaction.clear()
	cancelHold()
	target = nil
	HUD.setPrompt(nil)
end

return Interaction
