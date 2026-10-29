-- In-game interface: crosshair, contextual prompts, hold progress, placement
-- status, tool hotbar, task panel with deliveries, toasts, crane panel,
-- help overlay, pause/site menu and the tutorial card.

local Players = game:GetService("Players")
local HttpService = game:GetService("HttpService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Steelrise")
local Config = require(Shared.Config)
local Registry = require(Shared.ItemRegistry)
local Sites = require(Shared.Sites)
local Util = require(Shared.Util)

local State = require(script.Parent.State)
local UIKit = require(script.Parent.UIKit)
local Net = require(script.Parent.Net)
local Settings = require(script.Parent.Settings)
local Audio = require(script.Parent.Audio)

local C = Config.Colors
local F = UIKit.Font

local HUD = {}
local gui
local ui = {}

---------------------------------------------------------------------------
-- Toasts
---------------------------------------------------------------------------

local TOAST_COLORS = {
	info = C.Info,
	success = C.Valid,
	warn = C.Safety,
	error = C.Invalid,
	save = C.Steel,
}

function HUD.notify(text, kind)
	if not gui or not text or text == "" then
		return
	end
	kind = kind or "info"
	local t = UIKit.new("Frame", {
		BackgroundColor3 = C.Panel,
		BackgroundTransparency = 0.05,
		BorderSizePixel = 0,
		Size = UDim2.new(1, 0, 0, 0),
		AutomaticSize = Enum.AutomaticSize.Y,
		LayoutOrder = -math.floor(os.clock() * 100),
		Parent = ui.toasts,
	})
	UIKit.corner(t, 5)
	UIKit.new("Frame", { BackgroundColor3 = TOAST_COLORS[kind] or C.Info, BorderSizePixel = 0, Size = UDim2.new(0, 4, 1, 0), Parent = t })
	local l = UIKit.label(t, text, 15, F.Medium, C.OffWhite, { Size = UDim2.new(1, -24, 0, 0), Position = UDim2.new(0, 16, 0, 0), AutomaticSize = Enum.AutomaticSize.Y })
	UIKit.padding(l, 0, 9, 0, 9)
	if kind == "error" or kind == "warn" then
		Audio.play("UIError")
	else
		Audio.play("UINotify")
	end
	task.delay(kind == "warn" and 5 or 4, function()
		if t.Parent then
			UIKit.tween(t, 0.4, { BackgroundTransparency = 1 })
			UIKit.tween(l, 0.4, { TextTransparency = 1 })
			task.wait(0.45)
			t:Destroy()
		end
	end)
	local items = {}
	for _, c in ipairs(ui.toasts:GetChildren()) do
		if c:IsA("Frame") then
			table.insert(items, c)
		end
	end
	if #items > 5 then
		table.sort(items, function(a, b)
			return a.LayoutOrder > b.LayoutOrder
		end)
		items[1]:Destroy()
	end
end

---------------------------------------------------------------------------
-- Prompts, hold ring, placement status
---------------------------------------------------------------------------

local lastPromptKey = nil

function HUD.setPrompt(list)
	-- rebuild only when the content changes (called every frame)
	local key = ""
	for _, p in ipairs(list or {}) do
		key ..= (p.key or "") .. "|" .. (p.text or "") .. "|" .. (p.sub or "") .. "|" .. tostring(p.disabled) .. ";"
	end
	if key == lastPromptKey then
		return
	end
	lastPromptKey = key
	for _, c in ipairs(ui.prompt:GetChildren()) do
		if c:IsA("Frame") then
			c:Destroy()
		end
	end
	if not list or #list == 0 then
		ui.prompt.Visible = false
		return
	end
	ui.prompt.Visible = true
	for i, p in ipairs(list) do
		local row = UIKit.new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, p.sub and 40 or 26), LayoutOrder = i, Parent = ui.prompt })
		if p.key then
			local k = UIKit.new("TextLabel", {
				Text = p.key,
				Font = F.Bold,
				TextSize = 14,
				TextColor3 = C.Charcoal,
				BackgroundColor3 = p.disabled and C.Steel or C.Safety,
				Size = UDim2.new(0, math.max(26, #p.key * 9 + 12), 0, 24),
				Parent = row,
			})
			UIKit.corner(k, 4)
		end
		local x = p.key and math.max(26, #p.key * 9 + 12) + 10 or 0
		UIKit.label(row, p.text, 16, F.Bold, p.disabled and C.Muted or C.OffWhite, { Position = UDim2.new(0, x, 0, 0), Size = UDim2.new(1, -x, 0, 24) })
		if p.sub then
			UIKit.label(row, p.sub, 13, F.Body, p.subColor or C.Muted, { Position = UDim2.new(0, x, 0, 22), Size = UDim2.new(1, -x, 0, 16) })
		end
	end
end

function HUD.setHold(fraction)
	ui.hold.Visible = fraction ~= nil
	if fraction then
		ui.holdFill.Size = UDim2.new(math.clamp(fraction, 0, 1), 0, 1, 0)
	end
end

function HUD.setPlacement(info)
	ui.place.Visible = info ~= nil
	if not info then
		return
	end
	ui.placeTitle.Text = info.title or ""
	ui.placeStatus.Text = info.valid and ("✓  " .. (info.okText or "Valid placement — click to set")) or ("✕  " .. (info.reason or "Can't place here"))
	ui.placeStatus.TextColor3 = info.valid and C.Valid or C.Invalid
	ui.placeBar.BackgroundColor3 = info.valid and C.Valid or C.Invalid
	ui.placeHints.Text = info.hints or ""
end

function HUD.setCrosshair(visible)
	ui.cross.Visible = visible
end

---------------------------------------------------------------------------
-- Hotbar
---------------------------------------------------------------------------

function HUD.setTool(id)
	for toolId, slot in pairs(ui.slots) do
		local on = toolId == id
		slot.BackgroundColor3 = on and C.SteelDark or C.Panel
		slot:FindFirstChildOfClass("UIStroke").Color = on and C.Safety or C.SteelDark
		slot:FindFirstChildOfClass("UIStroke").Thickness = on and 2 or 1
	end
	local def = Registry.get(id)
	ui.toolName.Text = def and string.upper(def.name) or ""
end

---------------------------------------------------------------------------
-- Task panel
---------------------------------------------------------------------------

local function refreshTasks()
	local site = State.site
	if not site then
		return
	end
	local def = State.siteDef
	ui.siteName.Text = def and string.upper(def.name) or ""
	local done, total = site:GetAttribute("BPInstalled") or 0, site:GetAttribute("BPTotal") or 0
	local bp = site:GetAttribute("Blueprint") or ""
	if total > 0 then
		ui.progressText.Text = string.format("%s  ·  %d / %d installed", bp == "Site" and "Building" or ("Blueprint: " .. bp), done, total)
		ui.progressFill.Size = UDim2.new(done / total, 0, 1, 0)
		ui.progressBar.Visible = true
	else
		ui.progressText.Text = "Free build"
		ui.progressBar.Visible = false
	end
	ui.nextTask.Text = site:GetAttribute("NextTask") or ""
	-- deliveries
	local lines = {}
	local trailers = site:FindFirstChild("Trailers")
	if trailers then
		for _, t in ipairs(trailers:GetChildren()) do
			local manifest = t:GetAttribute("Manifest")
			local ok, list = pcall(function()
				return HttpService:JSONDecode(manifest or "[]")
			end)
			local bay = t:GetAttribute("Bay") or 0
			if ok and #list > 0 then
				local parts = {}
				for i, e in ipairs(list) do
					if i <= 3 then
						table.insert(parts, e.qty .. "× " .. (Registry.get(e.id) and Registry.get(e.id).name:gsub(" —.*", "") or e.id))
					end
				end
				if #list > 3 then
					table.insert(parts, "+" .. (#list - 3) .. " more")
				end
				local label = t:GetAttribute("Kind") == "rail" and "Railcar" or "Bay"
				table.insert(lines, string.format("%s %d  ·  %s", label, bay, table.concat(parts, ", ")))
			elseif t:GetAttribute("DepartAt") == 0 then
				if t:GetAttribute("Kind") == "rail" then
					table.insert(lines, string.format("Railcar %d  ·  empty — leaves on its own shortly", bay))
				else
					table.insert(lines, string.format("Bay %d  ·  empty — E at the cab to release the truck", bay))
				end
			end
		end
	end
	ui.deliveries.Text = #lines > 0 and table.concat(lines, "\n") or "No trucks on site — order materials with Tab."
	local carrying = State.carrying
	if carrying and carrying.Parent then
		local d = Registry.get(carrying:GetAttribute("ItemId"))
		ui.carry.Text = d and ("Carrying: " .. d.name .. "  (" .. Util.fmtKg(d.weightKg) .. ")") or ""
	else
		ui.carry.Text = ""
	end
end

function HUD.toggleTasks()
	ui.tasks.Visible = not ui.tasks.Visible
end

---------------------------------------------------------------------------
-- Crane panel
---------------------------------------------------------------------------

function HUD.setCrane(d)
	ui.crane.Visible = d ~= nil
	if not d then
		return
	end
	ui.craneMode.Text = string.format("%s  ·  %s VIEW  ·  ASSIST %s", d.mode == "Remote" and "RADIO REMOTE" or "CAB", string.upper(d.view or ""), d.assist and "ON" or "OFF")
	ui.craneRows.Radius.Text = string.format("%.1f m", d.radiusM)
	ui.craneRows.Height.Text = string.format("%.1f m", d.heightM)
	ui.craneRows.Slew.Text = string.format("%03d°", math.floor(d.slewDeg % 360))
	ui.craneRows.Load.Text = d.loadName and (d.loadName .. "  " .. Util.fmtKg(d.loadKg)) or "— hook free —"
	ui.craneRows.Capacity.Text = Util.fmtKg(d.capKg) .. " at radius"
	local wind = d.windMs or 0
	ui.craneRows.Wind.Text = string.format("%.1f m/s%s", wind, wind > Config.Crane.WindStopMs and "  — LIFTING STOPPED" or (wind > Config.Crane.WindWarnMs and "  — HIGH" or ""))
	ui.craneRows.Wind.TextColor3 = wind > Config.Crane.WindStopMs and C.Invalid or (wind > Config.Crane.WindWarnMs and C.Safety or C.OffWhite)
	local lmi = math.clamp(d.lmi or 0, 0, 1.2)
	ui.lmiFill.Size = UDim2.new(math.min(lmi, 1), 0, 1, 0)
	ui.lmiFill.BackgroundColor3 = lmi < 0.8 and C.Valid or (lmi < 0.95 and C.Safety or C.Invalid)
	ui.lmiText.Text = string.format("LOAD MOMENT %d%%", math.floor(lmi * 100 + 0.5))
	ui.craneGuide.Text = d.guide or ""
	ui.craneGuide.TextColor3 = d.guideReady and C.Valid or C.OffWhite
	ui.craneHint.Text = d.hint or ""
	ui.craneSpeed.Text = d.precision and "PRECISION" or ""
end

function HUD.flash(text)
	ui.flash.Text = text
	ui.flash.Visible = true
	ui.flash.TextTransparency = 0
	task.delay(0.9, function()
		UIKit.tween(ui.flash, 0.4, { TextTransparency = 1 })
	end)
end

---------------------------------------------------------------------------
-- Tutorial card
---------------------------------------------------------------------------

function HUD.setTutorial(text, step, total, onSkip)
	ui.tutorial.Visible = text ~= nil
	if not text then
		return
	end
	ui.tutText.Text = text
	ui.tutStep.Text = string.format("TUTORIAL  ·  STEP %d / %d", step, total)
	ui.tutSkipHandler = onSkip
end

---------------------------------------------------------------------------
-- Help overlay & pause menu
---------------------------------------------------------------------------

function HUD.toggleHelp()
	ui.help.Visible = not ui.help.Visible
end

local function refreshSlots()
	local info = State.menuInfo or {}
	for slot, row in pairs(ui.slotRows) do
		local s = info.slots and info.slots[tostring(slot)]
		if s then
			local site = Sites.get(s.site)
			row.info.Text = string.format("%s  ·  %s  ·  %d/%d installed", site and site.name or s.site, os.date("%b %d %H:%M", s.savedAt or 0), s.installed or 0, s.total or 0)
		else
			row.info.Text = "Empty"
		end
		UIKit.setDisabled(row.load, s == nil)
	end
end

function HUD.openPause(open)
	if open == nil then
		open = not ui.pause.Visible
	end
	ui.pause.Visible = open
	State.uiBlocking = open or (State.catalogOpen == true)
	State.fire("UIBlocking", State.uiBlocking)
	if open then
		local ok, _, info = Net.call("Menu", true, "Info")
		if ok then
			State.menuInfo = info
		end
		refreshSlots()
		HUD.showPauseTab("Site")
	end
end

function HUD.showPauseTab(name)
	for n, f in pairs(ui.pauseTabs) do
		f.Visible = n == name
	end
end

local function buildPause()
	local overlay = UIKit.new("Frame", { BackgroundColor3 = Color3.new(0, 0, 0), BackgroundTransparency = 0.45, BorderSizePixel = 0, Size = UDim2.fromScale(1, 1), Visible = false, ZIndex = 20, Parent = gui })
	overlay.Active = true
	UIKit.new("TextButton", { Modal = true, BackgroundTransparency = 1, Text = "", Size = UDim2.new(0, 1, 0, 1), Parent = overlay })
	ui.pause = overlay
	local panel = UIKit.panel(overlay, { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.new(0, 760, 0, 600) })
	UIKit.padding(panel, 20)
	UIKit.label(panel, "SITE MENU", 24, F.Display, C.OffWhite, { Size = UDim2.new(1, 0, 0, 30) })
	local tabs = UIKit.new("Frame", { BackgroundTransparency = 1, Position = UDim2.new(0, 0, 0, 40), Size = UDim2.new(1, 0, 0, 36), Parent = panel })
	UIKit.list(tabs, Enum.FillDirection.Horizontal, 6)
	ui.pauseTabs = {}
	local body = UIKit.new("Frame", { BackgroundTransparency = 1, Position = UDim2.new(0, 0, 0, 88), Size = UDim2.new(1, 0, 1, -88), Parent = panel })
	for i, name in ipairs({ "Site", "Settings", "Controls" }) do
		local b = UIKit.button(tabs, string.upper(name), { size = UDim2.new(0, 140, 1, 0), textSize = 15 })
		b.LayoutOrder = i
		b.MouseButton1Click:Connect(function()
			HUD.showPauseTab(name)
		end)
		ui.pauseTabs[name] = UIKit.new("Frame", { BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), Visible = false, Parent = body })
	end
	local resume = UIKit.button(tabs, "RESUME  (P)", { style = "primary", size = UDim2.new(0, 160, 1, 0), textSize = 15 })
	resume.LayoutOrder = 9
	resume.MouseButton1Click:Connect(function()
		HUD.openPause(false)
	end)

	-- Site tab: saves, blueprint, exit
	local site = ui.pauseTabs.Site
	UIKit.list(site, nil, 8)
	UIKit.label(site, "SAVE SLOTS", 13, F.Bold, C.Safety, { LayoutOrder = 1 })
	ui.slotRows = {}
	for slot = 0, Config.Save.ManualSlots do
		local row = UIKit.new("Frame", { BackgroundColor3 = C.CharcoalLight, BorderSizePixel = 0, Size = UDim2.new(1, 0, 0, 46), LayoutOrder = 2 + slot, Parent = site })
		UIKit.corner(row, 5)
		UIKit.padding(row, 12, 6, 8, 6)
		UIKit.label(row, slot == 0 and "AUTOSAVE" or ("SLOT " .. slot), 14, F.Bold, C.OffWhite, { Size = UDim2.new(0, 110, 1, 0) })
		local info = UIKit.label(row, "", 13, F.Body, C.Muted, { Position = UDim2.new(0, 110, 0, 0), Size = UDim2.new(1, -340, 1, 0) })
		local load = UIKit.button(row, "LOAD", { size = UDim2.new(0, 100, 1, 0), textSize = 14 })
		load.AnchorPoint = Vector2.new(1, 0)
		load.Position = UDim2.new(1, slot == 0 and 0 or -108, 0, 0)
		load.MouseButton1Click:Connect(function()
			if load:GetAttribute("Disabled") then
				return
			end
			HUD.openPause(false)
			HUD.notify("Loading saved site…", "save")
			local ok, msg, data = Net.call("Site", true, "Start", nil, "continue", slot)
			if ok then
				State.fire("EnteredSite", data)
			else
				HUD.notify(msg or "Load failed.", "error")
			end
		end)
		if slot > 0 then
			local save = UIKit.button(row, "SAVE", { style = "primary", size = UDim2.new(0, 100, 1, 0), textSize = 14 })
			save.AnchorPoint = Vector2.new(1, 0)
			save.Position = UDim2.new(1, 0, 0, 0)
			save.MouseButton1Click:Connect(function()
				HUD.notify("Saving…", "save")
				local ok = Net.call("Save", false, "Save", slot)
				if ok then
					State.fire("Saved", slot)
					local okInfo, _, info2 = Net.call("Menu", true, "Info")
					if okInfo then
						State.menuInfo = info2
						refreshSlots()
					end
				end
			end)
		end
		ui.slotRows[slot] = { info = info, load = load }
	end
	UIKit.label(site, "BLUEPRINT GUIDE", 13, F.Bold, C.Safety, { LayoutOrder = 10 })
	ui.bpRow = UIKit.new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 38), LayoutOrder = 11, Parent = site })
	UIKit.list(ui.bpRow, Enum.FillDirection.Horizontal, 6)
	UIKit.label(site, "TIME OF DAY (HOST)", 13, F.Bold, C.Safety, { LayoutOrder = 12 })
	local tod = UIKit.new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 34), LayoutOrder = 13, Parent = site })
	UIKit.list(tod, Enum.FillDirection.Horizontal, 6)
	for i, t in ipairs({ { "Morning", 8.2 }, { "Midday", 12.5 }, { "Afternoon", 16.3 }, { "Dusk", 19.0 }, { "Night", 22.5 } }) do
		local b = UIKit.button(tod, t[1], { size = UDim2.new(0, 110, 1, 0), textSize = 13 })
		b.LayoutOrder = i
		b.MouseButton1Click:Connect(function()
			Net.call("Site", false, "TimeOfDay", t[2])
		end)
	end
	local bottom = UIKit.new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 44), LayoutOrder = 20, Parent = site })
	local menuBtn = UIKit.button(bottom, "RETURN TO MAIN MENU", { style = "danger", size = UDim2.new(0, 260, 1, 0) })
	menuBtn.MouseButton1Click:Connect(function()
		HUD.openPause(false)
		State.fire("ReturnToMenu")
	end)

	Settings.buildPanel(ui.pauseTabs.Settings)
end

function HUD.refreshBlueprintButtons()
	for _, c in ipairs(ui.bpRow:GetChildren()) do
		if c:IsA("TextButton") then
			c:Destroy()
		end
	end
	local def = State.siteDef
	if not def then
		return
	end
	local options = {}
	if def.grid then
		table.insert(options, { id = "Site", name = "Site building" })
	end
	for _, bp in ipairs(def.blueprints or {}) do
		table.insert(options, { id = bp.id, name = bp.name })
	end
	table.insert(options, { id = "", name = "None (free build)" })
	local current = State.site and State.site:GetAttribute("Blueprint") or ""
	for i, o in ipairs(options) do
		local b = UIKit.button(ui.bpRow, o.name, { style = o.id == current and "primary" or "secondary", size = UDim2.new(0, 0, 1, 0), textSize = 13 })
		b.AutomaticSize = Enum.AutomaticSize.X
		UIKit.padding(b, 12, 0, 12, 0)
		b.LayoutOrder = i
		b.MouseButton1Click:Connect(function()
			local ok = Net.call("Site", false, "Blueprint", o.id)
			if ok then
				task.wait(0.2)
				HUD.refreshBlueprintButtons()
			end
		end)
	end
end

---------------------------------------------------------------------------
-- Construction
---------------------------------------------------------------------------

function HUD.build()
	gui = UIKit.screen("SR_HUD", 5)
	gui.Enabled = false
	State.notify = HUD.notify

	-- crosshair
	ui.cross = UIKit.new("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.new(0, 6, 0, 6), BackgroundColor3 = C.OffWhite, BorderSizePixel = 0, Parent = gui })
	UIKit.corner(ui.cross, 3)
	UIKit.stroke(ui.cross, C.Charcoal, 1, 0.3)

	-- prompt
	ui.prompt = UIKit.new("Frame", { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 30, 0.5, 26), Size = UDim2.new(0, 380, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundTransparency = 1, Visible = false, Parent = gui })
	UIKit.list(ui.prompt, nil, 4)

	-- hold progress
	ui.hold = UIKit.new("Frame", { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0.5, 14), Size = UDim2.new(0, 60, 0, 4), BackgroundColor3 = C.SteelDark, BorderSizePixel = 0, Visible = false, Parent = gui })
	ui.holdFill = UIKit.new("Frame", { BackgroundColor3 = C.Safety, BorderSizePixel = 0, Size = UDim2.new(0, 0, 1, 0), Parent = ui.hold })

	-- placement status
	ui.place = UIKit.panel(gui, { AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -112), Size = UDim2.new(0, 560, 0, 78), Visible = false })
	ui.placeBar = UIKit.new("Frame", { BackgroundColor3 = C.Valid, BorderSizePixel = 0, Size = UDim2.new(0, 4, 1, 0), Parent = ui.place })
	ui.placeTitle = UIKit.label(ui.place, "", 14, F.Bold, C.OffWhite, { Position = UDim2.new(0, 16, 0, 6), Size = UDim2.new(1, -24, 0, 18), TextTruncate = Enum.TextTruncate.AtEnd })
	ui.placeStatus = UIKit.label(ui.place, "", 14, F.Medium, C.Valid, { Position = UDim2.new(0, 16, 0, 26), Size = UDim2.new(1, -24, 0, 18), TextTruncate = Enum.TextTruncate.AtEnd })
	ui.placeHints = UIKit.label(ui.place, "", 12, F.Mono, C.Muted, { Position = UDim2.new(0, 16, 0, 50), Size = UDim2.new(1, -24, 0, 18), TextTruncate = Enum.TextTruncate.AtEnd })

	-- hotbar
	local bar = UIKit.new("Frame", { AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -24), Size = UDim2.new(0, #Registry.ToolOrder * 76, 0, 66), BackgroundTransparency = 1, Parent = gui })
	UIKit.list(bar, Enum.FillDirection.Horizontal, 8, Enum.HorizontalAlignment.Center)
	ui.slots = {}
	local shortNames = { ["TL-HANDS"] = "HANDS", ["TL-IMPACT"] = "WRENCH", ["TL-HAMMER"] = "HAMMER", ["TL-WELDER"] = "WELDER", ["TL-REMOTE"] = "REMOTE", ["TL-POUR"] = "POUR", ["TL-TROWEL"] = "TROWEL" }
	for i, id in ipairs(Registry.ToolOrder) do
		local slot = UIKit.new("TextButton", { AutoButtonColor = false, Text = "", BackgroundColor3 = C.Panel, BackgroundTransparency = 0.1, BorderSizePixel = 0, Size = UDim2.new(0, 68, 0, 66), LayoutOrder = i, Parent = bar })
		UIKit.corner(slot, 6)
		UIKit.stroke(slot, C.SteelDark, 1, 0)
		UIKit.label(slot, tostring(i), 12, F.Mono, C.Safety, { Position = UDim2.new(0, 6, 0, 2), Size = UDim2.new(0, 20, 0, 14) })
		local vp = UIKit.new("ViewportFrame", { BackgroundTransparency = 1, Size = UDim2.new(1, -12, 0, 36), Position = UDim2.new(0, 6, 0, 10), Ambient = Color3.fromRGB(150, 150, 150), LightDirection = Vector3.new(-1, -1, -1), Parent = slot })
		task.spawn(function()
			local def = Registry.get(id)
			local m = require(Shared.ModelFactory).build(def, CFrame.new(), { preview = true })
			m.Parent = vp
			UIKit.frameModel(vp, m, 40, 20, 0.9)
		end)
		UIKit.label(slot, shortNames[id] or id, 11, F.Bold, C.OffWhite, { AnchorPoint = Vector2.new(0, 1), Position = UDim2.new(0, 0, 1, -3), Size = UDim2.new(1, 0, 0, 14), TextXAlignment = Enum.TextXAlignment.Center })
		slot.MouseButton1Click:Connect(function()
			State.fire("SelectTool", id)
		end)
		ui.slots[id] = slot
	end
	ui.toolName = UIKit.label(gui, "", 12, F.Bold, C.Muted, { AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -94), Size = UDim2.new(0, 400, 0, 16), TextXAlignment = Enum.TextXAlignment.Center })

	-- task panel
	ui.tasks = UIKit.panel(gui, { Position = UDim2.new(0, 20, 0, 20), Size = UDim2.new(0, 360, 0, 0), AutomaticSize = Enum.AutomaticSize.Y })
	UIKit.padding(ui.tasks, 14, 12, 14, 12)
	UIKit.list(ui.tasks, nil, 5)
	ui.siteName = UIKit.label(ui.tasks, "", 14, F.Display, C.OffWhite, { LayoutOrder = 1 })
	ui.progressText = UIKit.label(ui.tasks, "", 12, F.Medium, C.Muted, { LayoutOrder = 2, Size = UDim2.new(1, 0, 0, 16) })
	ui.progressBar = UIKit.new("Frame", { BackgroundColor3 = C.SteelDark, BorderSizePixel = 0, Size = UDim2.new(1, 0, 0, 4), LayoutOrder = 3, Parent = ui.tasks })
	ui.progressFill = UIKit.new("Frame", { BackgroundColor3 = C.Safety, BorderSizePixel = 0, Size = UDim2.new(0, 0, 1, 0), Parent = ui.progressBar })
	UIKit.label(ui.tasks, "NEXT", 11, F.Bold, C.Safety, { LayoutOrder = 4, Size = UDim2.new(1, 0, 0, 14) })
	ui.nextTask = UIKit.label(ui.tasks, "", 13, F.Medium, C.OffWhite, { LayoutOrder = 5, Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y })
	UIKit.label(ui.tasks, "DELIVERIES", 11, F.Bold, C.Safety, { LayoutOrder = 6, Size = UDim2.new(1, 0, 0, 14) })
	ui.deliveries = UIKit.label(ui.tasks, "", 12, F.Body, C.OffWhite, { LayoutOrder = 7, Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y })
	ui.carry = UIKit.label(ui.tasks, "", 12, F.Bold, C.Info, { LayoutOrder = 8, Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y })
	UIKit.label(ui.tasks, "Tab catalog · P site menu · F1 help · J hide", 11, F.Mono, C.SteelDark, { LayoutOrder = 9, Size = UDim2.new(1, 0, 0, 14) })

	-- toasts
	-- toasts get their own always-enabled screen so messages show in the menu too
	local toastGui = UIKit.screen("SR_Toasts", 60)
	ui.toasts = UIKit.new("Frame", { AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -20, 0, 20), Size = UDim2.new(0, 420, 0, 400), BackgroundTransparency = 1, Parent = toastGui })
	UIKit.list(ui.toasts, nil, 6)

	-- crane panel
	ui.crane = UIKit.panel(gui, { AnchorPoint = Vector2.new(1, 0.5), Position = UDim2.new(1, -20, 0.55, 0), Size = UDim2.new(0, 330, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, Visible = false })
	UIKit.padding(ui.crane, 14, 12, 14, 12)
	UIKit.list(ui.crane, nil, 4)
	UIKit.label(ui.crane, "TOWER CRANE", 15, F.Display, C.Safety, { LayoutOrder = 1 })
	ui.craneMode = UIKit.label(ui.crane, "", 11, F.Mono, C.Muted, { LayoutOrder = 2, Size = UDim2.new(1, 0, 0, 14) })
	ui.craneRows = {}
	for i, row in ipairs({ "Radius", "Height", "Slew", "Load", "Capacity", "Wind" }) do
		local r = UIKit.new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 20), LayoutOrder = 2 + i, Parent = ui.crane })
		UIKit.label(r, string.upper(row), 12, F.Bold, C.Muted, { Size = UDim2.new(0, 90, 1, 0) })
		ui.craneRows[row] = UIKit.label(r, "", 14, F.Mono, C.OffWhite, { Position = UDim2.new(0, 90, 0, 0), Size = UDim2.new(1, -90, 1, 0), TextTruncate = Enum.TextTruncate.AtEnd })
	end
	ui.lmiText = UIKit.label(ui.crane, "", 11, F.Bold, C.Muted, { LayoutOrder = 10, Size = UDim2.new(1, 0, 0, 14) })
	local lmi = UIKit.new("Frame", { BackgroundColor3 = C.SteelDark, BorderSizePixel = 0, Size = UDim2.new(1, 0, 0, 8), LayoutOrder = 11, Parent = ui.crane })
	ui.lmiFill = UIKit.new("Frame", { BackgroundColor3 = C.Valid, BorderSizePixel = 0, Size = UDim2.new(0, 0, 1, 0), Parent = lmi })
	ui.craneSpeed = UIKit.label(ui.crane, "", 11, F.Bold, C.Safety, { LayoutOrder = 12, Size = UDim2.new(1, 0, 0, 14) })
	ui.craneGuide = UIKit.label(ui.crane, "", 14, F.Medium, C.OffWhite, { LayoutOrder = 13, Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y })
	ui.craneHint = UIKit.label(ui.crane, "", 12, F.Mono, C.Muted, { LayoutOrder = 14, Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y })
	local btnRow = UIKit.new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 34), LayoutOrder = 15, Parent = ui.crane })
	UIKit.list(btnRow, Enum.FillDirection.Horizontal, 6)
	local recover = UIKit.button(btnRow, "RECOVER LOAD", { size = UDim2.new(0.5, -3, 1, 0), textSize = 13 })
	recover.MouseButton1Click:Connect(function()
		State.fire("CraneRecover")
	end)
	local exit = UIKit.button(btnRow, "EXIT  (X)", { style = "danger", size = UDim2.new(0.5, -3, 1, 0), textSize = 13 })
	exit.MouseButton1Click:Connect(function()
		State.fire("CraneExit")
	end)

	ui.flash = UIKit.label(gui, "", 22, F.Display, C.Invalid, { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.36), Size = UDim2.new(0, 500, 0, 30), TextXAlignment = Enum.TextXAlignment.Center, Visible = false })

	-- tutorial card
	ui.tutorial = UIKit.panel(gui, { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 20), Size = UDim2.new(0, 560, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, Visible = false })
	UIKit.padding(ui.tutorial, 16, 12, 16, 12)
	UIKit.list(ui.tutorial, nil, 4)
	ui.tutStep = UIKit.label(ui.tutorial, "", 11, F.Bold, C.Safety, { LayoutOrder = 1, Size = UDim2.new(1, 0, 0, 14) })
	ui.tutText = UIKit.label(ui.tutorial, "", 15, F.Medium, C.OffWhite, { LayoutOrder = 2, Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y })
	local skip = UIKit.button(ui.tutorial, "SKIP TUTORIAL", { style = "ghost", size = UDim2.new(0, 140, 0, 26), textSize = 12 })
	skip.LayoutOrder = 3
	skip.MouseButton1Click:Connect(function()
		if ui.tutSkipHandler then
			ui.tutSkipHandler()
		end
	end)

	-- help overlay
	ui.help = UIKit.new("Frame", { BackgroundColor3 = C.Charcoal, BackgroundTransparency = 0.12, BorderSizePixel = 0, Size = UDim2.fromScale(1, 1), Visible = false, ZIndex = 15, Parent = gui })
	UIKit.new("TextButton", { Modal = true, BackgroundTransparency = 1, Text = "", Size = UDim2.new(0, 1, 0, 1), Parent = ui.help })
	local helpPanel = UIKit.new("Frame", { BackgroundTransparency = 1, AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.new(0, 760, 0.86, 0), Parent = ui.help })
	UIKit.label(helpPanel, "CONTROLS  ·  F1 TO CLOSE", 20, F.Display, C.Safety, { Size = UDim2.new(1, 0, 0, 30) })
	local helpBody = UIKit.new("Frame", { BackgroundTransparency = 1, Position = UDim2.new(0, 0, 0, 40), Size = UDim2.new(1, 0, 1, -40), Parent = helpPanel })
	require(script.Parent.MainMenu).buildControlsList(helpBody)

	buildPause()
	require(script.Parent.MainMenu).buildControlsList(ui.pauseTabs.Controls)

	task.spawn(function()
		while true do
			task.wait(0.5)
			if gui.Enabled then
				pcall(refreshTasks)
			end
		end
	end)
	return gui
end

function HUD.show(on)
	gui.Enabled = on
	if on then
		HUD.refreshBlueprintButtons()
	end
end

return HUD
