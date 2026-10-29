-- Main menu: Play, Continue Construction, Site Selection, Settings, Controls,
-- Credits. Site cards render live 3D previews generated from the same layout
-- data the server uses to build each site's starting stage.

local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Steelrise")
local Config = require(Shared.Config)
local Sites = require(Shared.Sites)

local State = require(script.Parent.State)
local UIKit = require(script.Parent.UIKit)
local Net = require(script.Parent.Net)
local Settings = require(script.Parent.Settings)

local C = Config.Colors
local F = UIKit.Font

local MainMenu = {}
local gui, nav, content, footer, busyOverlay
local panels = {}
local navButtons = {}
local selectedSite = "EmptyLand"
local detail = {}
local previewsBuilt = false
local spin = 0

local DIFF_COLOR = {
	Beginner = Color3.fromRGB(70, 150, 96),
	Standard = Color3.fromRGB(70, 120, 180),
	Advanced = Color3.fromRGB(196, 120, 40),
	Expert = Color3.fromRGB(180, 56, 50),
}

local function timeAgo(t)
	if not t then
		return ""
	end
	local d = os.time() - t
	if d < 90 then
		return "just now"
	elseif d < 3600 then
		return math.floor(d / 60) .. " min ago"
	elseif d < 86400 then
		return math.floor(d / 3600) .. " h ago"
	end
	return math.floor(d / 86400) .. " days ago"
end

local function showPanel(name)
	for n, p in pairs(panels) do
		p.Visible = n == name
	end
	content.Visible = name ~= nil
	for n, b in pairs(navButtons) do
		local bar = b:FindFirstChild("Indicator")
		if bar then
			bar.Visible = n == name
		end
	end
	if name == "Sites" then
		MainMenu.buildPreviews()
	end
end

local function setBusy(text)
	busyOverlay.Visible = text ~= nil
	busyOverlay.Label.Text = text or ""
end

local function start(siteId, mode, slot)
	setBusy(mode == "continue" and "Restoring your construction site…" or (mode == "join" and "Joining site…" or "Preparing " .. (Sites.get(siteId or "") and Sites.get(siteId).name or "site") .. "…"))
	local ok, msg, data = Net.call("Site", true, "Start", siteId, mode, slot)
	if not ok then
		local why = msg or "Couldn't start the site."
		State.notify(why, "error")
		setBusy("Couldn't start the site:\n" .. why)
		task.wait(5)
		setBusy(nil)
		return
	end
	setBusy(nil)
	State.lastStartMode = mode
	State.fire("EnteredSite", data)
end

---------------------------------------------------------------------------
-- Building blocks
---------------------------------------------------------------------------

local function navButton(text, key, order, onClick)
	local b = UIKit.button(nav, text, { style = "ghost", align = Enum.TextXAlignment.Left, size = UDim2.new(1, 0, 0, 46), textSize = 18 })
	b.LayoutOrder = order
	local bar = UIKit.new("Frame", {
		Name = "Indicator",
		BackgroundColor3 = C.Safety,
		BorderSizePixel = 0,
		Size = UDim2.new(0, 4, 0.6, 0),
		Position = UDim2.new(0, 0, 0.2, 0),
		Visible = false,
		Parent = b,
	})
	bar.ZIndex = 2
	b.MouseButton1Click:Connect(function()
		if not b:GetAttribute("Disabled") then
			onClick()
		end
	end)
	navButtons[key] = b
	return b
end

local function panelFrame(name, title)
	local p = UIKit.new("Frame", { Name = name, BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), Visible = false, Parent = content })
	UIKit.label(p, title, 26, F.Display, C.OffWhite, { Size = UDim2.new(1, 0, 0, 34) })
	UIKit.new("Frame", { BackgroundColor3 = C.Safety, BorderSizePixel = 0, Size = UDim2.new(0, 60, 0, 3), Position = UDim2.new(0, 0, 0, 38), Parent = p })
	local body = UIKit.new("Frame", { Name = "Body", BackgroundTransparency = 1, Position = UDim2.new(0, 0, 0, 56), Size = UDim2.new(1, 0, 1, -56), Parent = p })
	panels[name] = p
	return body
end

local function makeViewport(parent, props)
	local vp = UIKit.new("ViewportFrame", {
		BackgroundColor3 = Color3.fromRGB(42, 46, 52),
		BorderSizePixel = 0,
		Ambient = Color3.fromRGB(120, 124, 132),
		LightColor = Color3.fromRGB(255, 244, 228),
		LightDirection = Vector3.new(-0.6, -1, -0.4),
		Parent = parent,
	})
	for k, v in pairs(props or {}) do
		vp[k] = v
	end
	local grad = UIKit.new("UIGradient", {
		Rotation = 90,
		Color = ColorSequence.new(Color3.fromRGB(150, 160, 172), Color3.fromRGB(90, 90, 92)),
		Parent = vp,
	})
	grad.Enabled = true
	return vp
end

---------------------------------------------------------------------------
-- Site selection
---------------------------------------------------------------------------

local cardViewports = {}

local function updateDetail()
	local site = Sites.get(selectedSite)
	detail.title.Text = string.upper(site.name)
	detail.subtitle.Text = site.subtitle
	detail.desc.Text = site.description
	detail.stage.Text = site.stageText
	for _, ch in ipairs(detail.chips:GetChildren()) do
		if ch:IsA("TextLabel") then
			ch:Destroy()
		end
	end
	UIKit.chip(detail.chips, string.upper(site.difficulty), DIFF_COLOR[site.difficulty])
	if site.grid then
		UIKit.chip(detail.chips, site.grid.floors .. " STOREYS")
		UIKit.chip(detail.chips, string.format("%d × %d BAYS", site.grid.nx, site.grid.nz))
	else
		UIKit.chip(detail.chips, "FREE BUILD")
	end
	UIKit.chip(detail.chips, string.format("LOT %d × %d m", site.lotM.X, site.lotM.Z))
	detail.equipment.Text = "•  " .. table.concat(site.equipment, "\n•  ")
	-- slot for this site?
	local info = State.menuInfo or {}
	local slotFor = nil
	for k, s in pairs(info.slots or {}) do
		if s.site == selectedSite and (not slotFor or (s.savedAt or 0) > (info.slots[slotFor].savedAt or 0)) then
			slotFor = k
		end
	end
	detail.slot = slotFor
	detail.continueBtn.Visible = slotFor ~= nil
	if slotFor then
		local s = info.slots[slotFor]
		detail.continueBtn.Text = string.format("CONTINUE  ·  %s %s · %s", slotFor == "0" and "AUTOSAVE" or ("SLOT " .. slotFor), "", timeAgo(s.savedAt))
	end
	local hostOther = info.currentSite and info.host ~= 0 and info.host ~= game:GetService("Players").LocalPlayer.UserId
	detail.joinBtn.Visible = hostOther == true
	if hostOther then
		detail.joinBtn.Text = "JOIN " .. string.upper(info.hostName or "HOST") .. "'S SITE"
	end
	UIKit.setDisabled(detail.startBtn, hostOther == true)
	-- big preview
	local vp = detail.viewport
	for _, ch in ipairs(vp:GetChildren()) do
		if ch:IsA("Model") then
			ch:Destroy()
		end
	end
	local model = Sites.buildPreview(selectedSite)
	model.Parent = vp
	detail.model = model
	UIKit.frameModel(vp, model, 35, 26, 0.72)
	for id, card in pairs(cardViewports) do
		local stroke = card.Parent:FindFirstChildOfClass("UIStroke")
		if stroke then
			stroke.Color = id == selectedSite and C.Safety or C.SteelDark
			stroke.Thickness = id == selectedSite and 2 or 1
		end
	end
	navButtons.Play.Text = "PLAY  —  " .. string.upper(site.name)
end

function MainMenu.buildPreviews()
	if previewsBuilt then
		return
	end
	previewsBuilt = true
	for id, vp in pairs(cardViewports) do
		task.spawn(function()
			local model = Sites.buildPreview(id)
			model.Parent = vp
			UIKit.frameModel(vp, model, 40, 28, 0.7)
		end)
		task.wait()
	end
end

local function buildSitesPanel()
	local body = panelFrame("Sites", "SITE SELECTION")
	local list = UIKit.new("ScrollingFrame", {
		BackgroundTransparency = 1,
		BorderSizePixel = 0,
		Size = UDim2.new(0.46, -10, 1, 0),
		CanvasSize = UDim2.new(),
		AutomaticCanvasSize = Enum.AutomaticSize.Y,
		ScrollBarThickness = 4,
		ScrollBarImageColor3 = C.Steel,
		Parent = body,
	})
	UIKit.new("UIGridLayout", {
		CellSize = UDim2.new(0.5, -8, 0, 150),
		CellPadding = UDim2.new(0, 8, 0, 8),
		SortOrder = Enum.SortOrder.LayoutOrder,
		Parent = list,
	})
	for i, id in ipairs(Sites.Order) do
		local site = Sites.get(id)
		local card = UIKit.new("TextButton", { AutoButtonColor = false, Text = "", BackgroundColor3 = C.CharcoalLight, BorderSizePixel = 0, LayoutOrder = i, Parent = list })
		UIKit.corner(card, 6)
		UIKit.stroke(card, C.SteelDark, 1, 0)
		local vp = makeViewport(card, { Size = UDim2.new(1, -8, 1, -44), Position = UDim2.new(0, 4, 0, 4) })
		UIKit.corner(vp, 4)
		cardViewports[id] = vp
		UIKit.label(card, site.name, 14, F.Bold, C.OffWhite, { Position = UDim2.new(0, 8, 1, -40), Size = UDim2.new(1, -16, 0, 18), TextTruncate = Enum.TextTruncate.AtEnd })
		UIKit.label(card, site.stageText, 12, F.Body, C.Muted, { Position = UDim2.new(0, 8, 1, -21), Size = UDim2.new(1, -16, 0, 16), TextTruncate = Enum.TextTruncate.AtEnd })
		local dot = UIKit.new("Frame", { BackgroundColor3 = DIFF_COLOR[site.difficulty], BorderSizePixel = 0, Size = UDim2.new(0, 8, 0, 8), Position = UDim2.new(1, -16, 0, 10), Parent = card })
		UIKit.corner(dot, 4)
		card.MouseButton1Click:Connect(function()
			selectedSite = id
			updateDetail()
		end)
	end

	local pane = UIKit.panel(body, { Size = UDim2.new(0.54, -6, 1, 0), Position = UDim2.new(0.46, 6, 0, 0) })
	UIKit.padding(pane, 14)
	detail.viewport = makeViewport(pane, { Size = UDim2.new(1, 0, 0.42, 0) })
	UIKit.corner(detail.viewport, 4)
	local info = UIKit.new("Frame", { BackgroundTransparency = 1, Position = UDim2.new(0, 0, 0.42, 10), Size = UDim2.new(1, 0, 0.58, -10), Parent = pane })
	UIKit.list(info, nil, 6)
	detail.title = UIKit.label(info, "", 22, F.Display, C.OffWhite, { LayoutOrder = 1, Size = UDim2.new(1, 0, 0, 26) })
	detail.subtitle = UIKit.label(info, "", 14, F.Medium, C.Safety, { LayoutOrder = 2, Size = UDim2.new(1, 0, 0, 18) })
	detail.chips = UIKit.new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 24), LayoutOrder = 3, Parent = info })
	UIKit.list(detail.chips, Enum.FillDirection.Horizontal, 6)
	detail.desc = UIKit.label(info, "", 14, F.Body, C.OffWhite, { LayoutOrder = 4, Size = UDim2.new(1, 0, 0, 54), TextYAlignment = Enum.TextYAlignment.Top })
	local stageRow = UIKit.new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 20), LayoutOrder = 5, Parent = info })
	UIKit.label(stageRow, "STARTING STAGE", 12, F.Bold, C.Muted, { Size = UDim2.new(0, 130, 1, 0) })
	detail.stage = UIKit.label(stageRow, "", 14, F.Medium, C.OffWhite, { Position = UDim2.new(0, 130, 0, 0), Size = UDim2.new(1, -130, 1, 0) })
	UIKit.label(info, "AVAILABLE EQUIPMENT", 12, F.Bold, C.Muted, { LayoutOrder = 6, Size = UDim2.new(1, 0, 0, 16) })
	detail.equipment = UIKit.label(info, "", 13, F.Body, C.OffWhite, { LayoutOrder = 7, Size = UDim2.new(1, 0, 0, 52), TextYAlignment = Enum.TextYAlignment.Top })
	local buttons = UIKit.new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 92), LayoutOrder = 8, Parent = info })
	UIKit.list(buttons, nil, 6)
	detail.startBtn = UIKit.button(buttons, "START NEW CONSTRUCTION", { style = "primary" })
	detail.startBtn.LayoutOrder = 1
	detail.startBtn.MouseButton1Click:Connect(function()
		if not detail.startBtn:GetAttribute("Disabled") then
			start(selectedSite, "new")
		end
	end)
	detail.continueBtn = UIKit.button(buttons, "CONTINUE", {})
	detail.continueBtn.LayoutOrder = 2
	detail.continueBtn.MouseButton1Click:Connect(function()
		if detail.slot then
			start(nil, "continue", tonumber(detail.slot))
		end
	end)
	detail.joinBtn = UIKit.button(buttons, "JOIN", {})
	detail.joinBtn.LayoutOrder = 3
	detail.joinBtn.MouseButton1Click:Connect(function()
		start(nil, "join")
	end)
end

---------------------------------------------------------------------------
-- Controls & credits
---------------------------------------------------------------------------

MainMenu.ControlRows = {
	{ "ON FOOT", nil },
	{ "WASD / Space", "Walk / jump" },
	{ "Mouse", "Look and aim (first person) · aim with cursor (third person)" },
	{ "V", "First / third-person view" },
	{ "E", "Interact: pick up, release strap, enter crane, release truck" },
	{ "LMB", "Place carried item · hold to fasten with the equipped tool" },
	{ "R  ·  Z / C", "Rotate 90°  ·  fine rotate" },
	{ "T", "Free placement (props and equipment)" },
	{ "Arrow keys", "Nudge in free placement (Shift = coarse)" },
	{ "G", "Drop carried item" },
	{ "Hold X", "Dismantle the aimed component (with its tool)" },
	{ "F", "Switch equipment on / off" },
	{ "1 – 7", "Hands · wrench · hammer · welder · crane remote · pump hose · trowel" },
	{ "Tab", "Catalog & deliveries" },
	{ "B", "Blueprint ghosts on / off" },
	{ "J", "Task panel" },
	{ "P", "Site menu: save, load, settings" },
	{ "F1", "Help overlay" },
	{ "CRANE", nil },
	{ "A / D", "Slew left / right" },
	{ "W / S", "Trolley out / in" },
	{ "R / F", "Hoist up / down" },
	{ "Z / C", "Rotate load" },
	{ "Shift", "Precision (slow) mode" },
	{ "G", "Hook nearby load · unhook" },
	{ "Enter", "Land load on its connection" },
	{ "H", "Alignment assist on / off" },
	{ "V", "Camera: cab · hook · exterior" },
	{ "RMB drag · wheel", "Orbit / zoom exterior camera" },
	{ "Hold Y", "Recover a stuck load to the laydown yard" },
	{ "X", "Leave the crane controls" },
}

function MainMenu.buildControlsList(parent)
	local scroll = UIKit.new("ScrollingFrame", {
		BackgroundTransparency = 1,
		BorderSizePixel = 0,
		Size = UDim2.fromScale(1, 1),
		CanvasSize = UDim2.new(),
		AutomaticCanvasSize = Enum.AutomaticSize.Y,
		ScrollBarThickness = 4,
		ScrollBarImageColor3 = C.Steel,
		Parent = parent,
	})
	UIKit.list(scroll, nil, 2)
	for i, row in ipairs(MainMenu.ControlRows) do
		if row[2] == nil then
			UIKit.label(scroll, row[1], 13, F.Bold, C.Safety, { LayoutOrder = i, Size = UDim2.new(1, 0, 0, 30), TextYAlignment = Enum.TextYAlignment.Bottom })
		else
			local r = UIKit.new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 24), LayoutOrder = i, Parent = scroll })
			local key = UIKit.label(r, row[1], 14, F.Mono, C.OffWhite, { Size = UDim2.new(0, 170, 1, 0) })
			key.TextXAlignment = Enum.TextXAlignment.Left
			UIKit.label(r, row[2], 14, F.Body, C.Muted, { Position = UDim2.new(0, 176, 0, 0), Size = UDim2.new(1, -176, 1, 0) })
		end
	end
	return scroll
end

local function buildCredits()
	local body = panelFrame("Credits", "CREDITS")
	local text = table.concat({
		"STEELRISE: Construction Simulator — Phase 1 build " .. Config.Version,
		"",
		"Design, systems and procedural assets: generated for this project with Claude Code.",
		"All geometry is built at runtime from engine parts and Roblox built-in materials.",
		"",
		"Audio: no third-party audio is bundled. Sound slots are listed in docs/AUDIO.md and",
		"stay silent until audio the experience is licensed to play is supplied.",
		"",
		"Real-world references: AISC W-shape and HSS section properties; ring-lock scaffold",
		"bay sizes; flat-top tower crane proportions and load-chart behaviour.",
	}, "\n")
	UIKit.label(body, text, 15, F.Body, C.OffWhite, { Size = UDim2.new(1, 0, 1, 0), TextYAlignment = Enum.TextYAlignment.Top })
end

---------------------------------------------------------------------------
-- Construction
---------------------------------------------------------------------------

function MainMenu.build()
	gui = UIKit.screen("SR_Menu", 10)
	gui.Enabled = false

	local shade = UIKit.new("Frame", { BackgroundColor3 = C.Charcoal, BorderSizePixel = 0, Size = UDim2.new(0.62, 0, 1, 0), Parent = gui })
	UIKit.new("UIGradient", { Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.05), NumberSequenceKeypoint.new(0.55, 0.35), NumberSequenceKeypoint.new(1, 1) }), Parent = shade })

	-- logo
	local logo = UIKit.new("Frame", { BackgroundTransparency = 1, Position = UDim2.new(0, 64, 0, 56), Size = UDim2.new(0, 420, 0, 90), Parent = gui })
	local mark = UIKit.new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(0, 30, 0, 42), Position = UDim2.new(0, 0, 0, 6), Parent = logo })
	UIKit.new("Frame", { BackgroundColor3 = C.Safety, BorderSizePixel = 0, Size = UDim2.new(1, 0, 0, 7), Parent = mark })
	UIKit.new("Frame", { BackgroundColor3 = C.Safety, BorderSizePixel = 0, Size = UDim2.new(1, 0, 0, 7), Position = UDim2.new(0, 0, 1, -7), Parent = mark })
	UIKit.new("Frame", { BackgroundColor3 = C.Safety, BorderSizePixel = 0, Size = UDim2.new(0, 7, 1, 0), Position = UDim2.new(0.5, -3, 0, 0), Parent = mark })
	UIKit.label(logo, "STEELRISE", 46, F.Display, C.OffWhite, { Position = UDim2.new(0, 42, 0, 0), Size = UDim2.new(1, -42, 0, 52) })
	UIKit.label(logo, "C O N S T R U C T I O N   S I M U L A T O R", 12, F.Medium, C.Steel, { Position = UDim2.new(0, 44, 0, 54), Size = UDim2.new(1, -44, 0, 16) })

	nav = UIKit.new("Frame", { BackgroundTransparency = 1, Position = UDim2.new(0, 56, 0, 200), Size = UDim2.new(0, 330, 0, 420), Parent = gui })
	UIKit.list(nav, nil, 4)
	local play = navButton("PLAY", "Play", 1, function()
		local info = State.menuInfo or {}
		if info.currentSite and info.host ~= 0 and info.host ~= game:GetService("Players").LocalPlayer.UserId then
			start(nil, "join")
		else
			start(selectedSite, "new")
		end
	end)
	play.TextColor3 = C.Safety
	navButton("CONTINUE CONSTRUCTION", "Continue", 2, function()
		start(nil, "continue", "latest")
	end)
	local contInfo = UIKit.label(nav, "", 12, F.Body, C.Muted, { LayoutOrder = 3, Size = UDim2.new(1, -16, 0, 14), Position = UDim2.new(0, 16, 0, 0) })
	UIKit.padding(contInfo, 16, 0, 0, 0)
	MainMenu.contInfo = contInfo
	navButton("SITE SELECTION", "Sites", 4, function()
		showPanel("Sites")
	end)
	navButton("SETTINGS", "Settings", 5, function()
		showPanel("Settings")
	end)
	navButton("CONTROLS", "Controls", 6, function()
		showPanel("Controls")
	end)
	navButton("CREDITS", "Credits", 7, function()
		showPanel("Credits")
	end)

	content = UIKit.panel(gui, { Position = UDim2.new(0, 420, 0, 72), Size = UDim2.new(1, -470, 1, -150), Visible = false })
	content.BackgroundTransparency = 0.04
	UIKit.padding(content, 22)
	local close = UIKit.button(content, "✕", { style = "ghost", size = UDim2.new(0, 34, 0, 34), textSize = 18 })
	close.AnchorPoint = Vector2.new(1, 0)
	close.Position = UDim2.new(1, 0, 0, 0)
	close.ZIndex = 5
	close.MouseButton1Click:Connect(function()
		showPanel(nil)
	end)

	buildSitesPanel()
	Settings.buildPanel(panelFrame("Settings", "SETTINGS"))
	MainMenu.buildControlsList(panelFrame("Controls", "CONTROLS"))
	buildCredits()

	footer = UIKit.label(gui, "", 12, F.Mono, C.Muted, { AnchorPoint = Vector2.new(0, 1), Position = UDim2.new(0, 64, 1, -24), Size = UDim2.new(1, -128, 0, 16) })

	busyOverlay = UIKit.new("Frame", { BackgroundColor3 = C.Charcoal, BackgroundTransparency = 0.25, BorderSizePixel = 0, Size = UDim2.fromScale(1, 1), Visible = false, ZIndex = 50, Parent = gui })
	local bl = UIKit.label(busyOverlay, "", 20, F.Bold, C.OffWhite, { Name = "Label", AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.new(0, 900, 0, 200), TextXAlignment = Enum.TextXAlignment.Center, TextYAlignment = Enum.TextYAlignment.Center })
	bl.ZIndex = 51
	busyOverlay.Active = true

	updateDetail()
	RunService.RenderStepped:Connect(function(dt)
		if not gui.Enabled or not content.Visible or not panels.Sites.Visible then
			return
		end
		spin += dt * 6
		if detail.model and detail.viewport.CurrentCamera then
			UIKit.frameModel(detail.viewport, detail.model, 35 + spin, 26, 0.72)
		end
	end)
	return gui
end

function MainMenu.refresh(info)
	State.menuInfo = info
	local slot = info and info.lastSlot
	local s = info and info.slots and slot and info.slots[tostring(slot)]
	local cont = navButtons.Continue
	UIKit.setDisabled(cont, s == nil)
	if s then
		local site = Sites.get(s.site)
		MainMenu.contInfo.Text = string.format("%s · %s · %d/%d installed", site and site.name or s.site, timeAgo(s.savedAt), s.installed or 0, s.total or 0)
	else
		MainMenu.contInfo.Text = "No saved construction yet"
	end
	footer.Text = string.format(
		"v%s   ·   catalog %d / %d items implemented   ·   %s",
		Config.Version,
		info and info.itemCount or 0,
		info and info.itemTarget or 500,
		(info and info.persistent) and "cloud saves on" or "session-only saves (DataStores unavailable)"
	)
	if info and info.currentSite and info.host ~= 0 and info.host ~= game:GetService("Players").LocalPlayer.UserId then
		navButtons.Play.Text = "PLAY  —  JOIN " .. string.upper(info.hostName or "HOST")
	end
	updateDetail()
end

function MainMenu.show()
	gui.Enabled = true
	showPanel(nil)
	local ok, _, info = Net.call("Menu", true, "Info")
	if ok and info then
		MainMenu.refresh(info)
	end
end

function MainMenu.hide()
	gui.Enabled = false
end

return MainMenu
