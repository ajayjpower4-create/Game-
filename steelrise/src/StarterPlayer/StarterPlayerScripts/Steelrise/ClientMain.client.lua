-- STEELRISE client bootstrap: builds the interface, binds the current site,
-- switches between menu and play, routes global keys and tool selection.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local StarterGui = game:GetService("StarterGui")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Steelrise")
local Config = require(Shared.Config)
local Sites = require(Shared.Sites)
local BuildRules = require(Shared.BuildRules)
local Registry = require(Shared.ItemRegistry)
local Remotes = require(Shared.Remotes)
local Util = require(Shared.Util)

local here = script.Parent
local State = require(here.State)
local UIKit = require(here.UIKit)
local Audio = require(here.Audio)
local Net = require(here.Net)
local Settings = require(here.Settings)
local HUD = require(here.HUD)
local MainMenu = require(here.MainMenu)
local Catalog = require(here.Catalog)
local View = require(here.View)
local Interaction = require(here.Interaction)
local Placement = require(here.Placement)
local CraneClient = require(here.CraneClient)
local TrailerAnim = require(here.TrailerAnim)
local Blueprint = require(here.Blueprint)
local FX = require(here.FX)
local Footsteps = require(here.Footsteps)
local Tutorial = require(here.Tutorial)

local player = Players.LocalPlayer

pcall(function()
	StarterGui:SetCoreGuiEnabled(Enum.CoreGuiType.Backpack, false)
end)

-- Settings and favourites first, so every panel is built with the player's values.
do
	local ok, _, info = Net.call("Menu", true, "Info")
	if ok and info then
		local merged = Util.withDefaults(info.settings, Config.DefaultSettings)
		for k, v in pairs(merged) do
			State.settings[k] = v
		end
		State.favorites = info.favorites or {}
		State.crane.assist = State.settings.assist
		State.menuInfo = info
	end
end

Audio.init(State.settings.volumes)
UIKit.setClickSound(function()
	Audio.play("UIClick")
end)

HUD.build()
MainMenu.build()
Catalog.build()
Interaction.init()
Placement.init()
CraneClient.init()
TrailerAnim.init()
Blueprint.init()
FX.init()
Footsteps.init()
Tutorial.init()

Remotes.get("Notify").OnClientEvent:Connect(function(text, kind)
	HUD.notify(text, kind)
end)
Remotes.get("Progress").OnClientEvent:Connect(function(kind, data)
	State.fire("Progress", kind, data)
end)

---------------------------------------------------------------------------
-- Site binding
---------------------------------------------------------------------------

local siteConns = {}

local function bindSite(folder)
	for _, c in ipairs(siteConns) do
		c:Disconnect()
	end
	siteConns = {}
	State.site = folder
	State.siteDef = Sites.get(folder:GetAttribute("SiteId"))
	State.world = BuildRules.newWorld(folder)
	CraneClient.reset()
	TrailerAnim.reset()
	local comps = folder:WaitForChild("Components", 10)
	local function watch(m)
		table.insert(siteConns, m:GetAttributeChangedSignal("State"):Connect(function()
			State.world:markDirty()
			Blueprint.markDirty()
		end))
	end
	if comps then
		for _, m in ipairs(comps:GetChildren()) do
			watch(m)
		end
		table.insert(siteConns, comps.ChildAdded:Connect(function(m)
			watch(m)
			State.world:markDirty()
			Blueprint.markDirty()
		end))
		table.insert(siteConns, comps.ChildRemoved:Connect(function()
			State.world:markDirty()
			Blueprint.markDirty()
		end))
	end
	table.insert(siteConns, folder:GetAttributeChangedSignal("Blueprint"):Connect(function()
		Blueprint.markDirty()
		HUD.refreshBlueprintButtons()
	end))
	Settings.apply()
	Blueprint.markDirty()
	HUD.refreshBlueprintButtons()
	State.fire("SiteChanged", State.siteDef)
end

local function tryBind(folder)
	if folder.Name ~= "SteelriseSite" then
		return
	end
	task.spawn(function()
		local t = os.clock()
		while folder.Parent and folder:GetAttribute("Ready") ~= true and os.clock() - t < 30 do
			task.wait(0.1)
		end
		if folder.Parent then
			bindSite(folder)
		end
	end)
end

workspace.ChildAdded:Connect(tryBind)
local existing = workspace:FindFirstChild("SteelriseSite")
if existing then
	tryBind(existing)
end

---------------------------------------------------------------------------
-- Menu camera (slow cinematic orbit over the live site)
---------------------------------------------------------------------------

local orbit = 0
RunService:BindToRenderStep("SR_MenuCam", Enum.RenderPriority.Camera.Value + 2, function(dt)
	if State.mode ~= "Menu" and State.mode ~= "Loading" then
		return
	end
	local cam = workspace.CurrentCamera
	cam.CameraType = Enum.CameraType.Scriptable
	local def = State.siteDef
	local focus = Vector3.new(0, 20, 0)
	local radius = 260
	if def then
		local c = def.crane.posM * Config.S
		focus = Vector3.new(c.X, def.crane.heightM * Config.S * 0.35, c.Z)
		radius = math.max(def.lotM.X, def.lotM.Z) * Config.S * 0.75 + 60
	end
	orbit += dt * 0.025
	local pos = focus + Vector3.new(math.cos(orbit) * radius, radius * 0.38, math.sin(orbit) * radius)
	cam.CFrame = CFrame.lookAt(pos, focus)
	cam.FieldOfView = 50
end)

---------------------------------------------------------------------------
-- Modes
---------------------------------------------------------------------------

local function selectTool(id)
	if State.mode ~= "Play" then
		return
	end
	if State.crane.operating then
		if State.crane.mode == "Remote" and id ~= "TL-REMOTE" then
			CraneClient.exit()
		elseif State.crane.mode == "Remote" and id == "TL-REMOTE" then
			CraneClient.exit()
			return
		else
			return
		end
	end
	if State.carrying and id ~= "TL-HANDS" then
		State.notify("Put down what you're carrying first.", "info")
		return
	end
	State.tool = id
	HUD.setTool(id)
	task.spawn(function()
		Net.call("Build", true, "Equip", id)
		if id == "TL-REMOTE" then
			local ok, msg, data = Net.call("Crane", true, "Remote", nil)
			if ok then
				CraneClient.start(data and data.craneId, "Remote")
			elseif msg then
				State.notify(msg, "warn")
			end
		end
	end)
end
State.on("SelectTool", selectTool)

local function enterMenu()
	State.mode = "Menu"
	CraneClient.stop()
	Interaction.clear()
	if Catalog.isOpen() then
		Catalog.toggle(false)
	end
	HUD.openPause(false)
	HUD.show(false)
	HUD.setTutorial(nil)
	State.tutorialActive = false
	player.CameraMode = Enum.CameraMode.Classic
	UserInputService.MouseBehavior = Enum.MouseBehavior.Default
	UserInputService.MouseIconEnabled = true
	MainMenu.show()
end

local function enterPlay(data)
	State.mode = "Play"
	MainMenu.hide()
	HUD.show(true)
	local cam = workspace.CurrentCamera
	cam.CameraType = Enum.CameraType.Custom
	cam.FieldOfView = State.settings.fov
	local function onChar(char)
		local hum = char:WaitForChild("Humanoid", 10)
		if hum then
			cam.CameraSubject = hum
		end
		View.setFirstPerson(not State.settings.thirdPerson)
		HUD.setCrosshair(State.firstPerson)
		State.tool = "TL-HANDS"
		HUD.setTool("TL-HANDS")
	end
	if player.Character then
		task.spawn(onChar, player.Character)
	end
	Settings.apply()
	HUD.setTool("TL-HANDS")
	local siteId = data and data.siteId
	if siteId == "EmptyLand" and State.lastStartMode == "new" and not State.settings.tutorialDone then
		task.delay(1.5, Tutorial.start)
	else
		local def = Sites.get(siteId or "")
		if def then
			State.notify(def.name .. " — " .. def.stageText, "info")
		end
	end
end

player.CharacterAdded:Connect(function(char)
	if State.mode == "Play" then
		local hum = char:WaitForChild("Humanoid", 10)
		workspace.CurrentCamera.CameraSubject = hum
		workspace.CurrentCamera.CameraType = Enum.CameraType.Custom
		View.setFirstPerson(State.firstPerson)
		State.tool = "TL-HANDS"
		HUD.setTool("TL-HANDS")
	end
end)

State.on("EnteredSite", enterPlay)
State.on("ReturnToMenu", function()
	task.spawn(function()
		Net.call("Site", true, "Menu")
	end)
	enterMenu()
end)
State.on("ViewPreference", function(third)
	if State.mode == "Play" then
		View.setFirstPerson(not third)
		HUD.setCrosshair(State.firstPerson)
	end
end)
State.on("CraneOperating", function(on)
	HUD.setCrosshair(not on and State.firstPerson)
end)

---------------------------------------------------------------------------
-- Global keys
---------------------------------------------------------------------------

local TOOL_KEYS = {
	[Enum.KeyCode.One] = 1,
	[Enum.KeyCode.Two] = 2,
	[Enum.KeyCode.Three] = 3,
	[Enum.KeyCode.Four] = 4,
	[Enum.KeyCode.Five] = 5,
}

UserInputService.InputBegan:Connect(function(input, gp)
	if gp or State.mode ~= "Play" then
		return
	end
	local k = input.KeyCode
	if k == Enum.KeyCode.Tab then
		if not State.crane.operating or State.crane.mode == "Remote" then
			HUD.openPause(false)
			Catalog.toggle()
		end
	elseif k == Enum.KeyCode.P then
		if Catalog.isOpen() then
			Catalog.toggle(false)
		end
		HUD.openPause()
	elseif k == Enum.KeyCode.F1 then
		HUD.toggleHelp()
	elseif State.uiBlocking then
		return
	elseif k == Enum.KeyCode.J then
		HUD.toggleTasks()
	elseif k == Enum.KeyCode.B then
		Blueprint.toggle()
	elseif k == Enum.KeyCode.V and not State.crane.operating then
		View.toggle()
		HUD.setCrosshair(State.firstPerson)
	elseif TOOL_KEYS[k] then
		local id = Registry.ToolOrder[TOOL_KEYS[k]]
		if id then
			selectTool(id)
		end
	end
end)

-- Overlays (catalog, site menu, help) contain a Modal button, which frees the
-- mouse even in first person; nothing else to do here.

---------------------------------------------------------------------------
-- Start
---------------------------------------------------------------------------

task.spawn(function()
	if State.menuInfo then
		MainMenu.refresh(State.menuInfo)
	end
	State.mode = "Menu"
	player:SetAttribute("SR_MenuReady", true)
	while not player:GetAttribute("SR_LoaderDone") do
		task.wait(0.1)
	end
	enterMenu()
end)
