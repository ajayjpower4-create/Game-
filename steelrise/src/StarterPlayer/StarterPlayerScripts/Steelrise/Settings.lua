-- Applies player settings (graphics, audio, controls) locally and builds the
-- settings panel used by both the main menu and the pause menu.

local Lighting = game:GetService("Lighting")
local UserInputService = game:GetService("UserInputService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Steelrise")
local Config = require(Shared.Config)

local State = require(script.Parent.State)
local UIKit = require(script.Parent.UIKit)
local Audio = require(script.Parent.Audio)
local Net = require(script.Parent.Net)

local C = Config.Colors
local Settings = {}

-- Roblox chat window size. Works with TextChatService (the default chat);
-- silently does nothing if the experience uses the legacy chat.
local CHAT_SIZES = {
	Small = { w = 0.6, h = 0.5, text = 13, bg = 0.55 },
	Normal = { w = 1.0, h = 1.0, text = 15, bg = 0.3 },
}

function Settings.applyChat(mode)
	pcall(function()
		local TextChatService = game:GetService("TextChatService")
		local win = TextChatService:FindFirstChildOfClass("ChatWindowConfiguration")
		local bar = TextChatService:FindFirstChildOfClass("ChatInputBarConfiguration")
		local size = CHAT_SIZES[mode]
		if win then
			win.Enabled = mode ~= "Hidden"
			if size then
				win.WidthScale = size.w
				win.HeightScale = size.h
				win.TextSize = size.text
				win.BackgroundTransparency = size.bg
			end
		end
		if bar then
			bar.Enabled = mode ~= "Hidden"
			if size then
				bar.TextSize = size.text
			end
		end
	end)
end

function Settings.apply()
	local s = State.settings
	Settings.applyChat(s.chat or "Small")
	local preset = Config.Graphics.Presets[s.graphics] or Config.Graphics.Presets.Balanced
	local post = s.post and preset.post
	for _, name in ipairs({ "SR_Bloom", "SR_SunRays", "SR_Grade" }) do
		local e = Lighting:FindFirstChild(name)
		if e then
			e.Enabled = post
		end
	end
	local dof = Lighting:FindFirstChild("SR_DOF")
	if dof then
		dof.Enabled = post and (s.graphics == "High" or s.graphics == "Ultra")
	end
	Lighting.GlobalShadows = s.shadows and preset.shadows
	local atm = Lighting:FindFirstChildOfClass("Atmosphere")
	if atm then
		local base = State.siteDef and State.siteDef.lighting and State.siteDef.lighting.density or 0.32
		atm.Density = base * (preset.atmosphere / 0.32)
	end
	State.particleScale = s.particles and preset.particles or 0
	State.detailDistance = preset.detailDistance
	if workspace.CurrentCamera then
		workspace.CurrentCamera.FieldOfView = s.fov
	end
	UserInputService.MouseDeltaSensitivity = s.mouseSensitivity
	Audio.setVolumes(s.volumes)
end

local saveQueued = false
function Settings.save()
	if saveQueued then
		return
	end
	saveQueued = true
	task.delay(1.5, function()
		saveQueued = false
		Net.call("Save", true, "Settings", State.settings)
	end)
end

local function changed()
	Settings.apply()
	Settings.save()
end

local function section(parent, title, order)
	local l = UIKit.label(parent, title, 13, UIKit.Font.Bold, C.Safety, { LayoutOrder = order, Size = UDim2.new(1, 0, 0, 26) })
	return l
end

-- Builds the settings controls into a scrolling frame.
function Settings.buildPanel(parent)
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
	UIKit.padding(scroll, 4, 4, 14, 4)
	UIKit.list(scroll, nil, 8)
	local s = State.settings
	local order = 0
	local function nxt()
		order += 1
		return order
	end
	section(scroll, "GRAPHICS", nxt())
	local seg = UIKit.segmented(scroll, "Quality preset", Config.Graphics.Order, s.graphics, function(v)
		s.graphics = v
		changed()
	end)
	seg.LayoutOrder = nxt()
	UIKit.toggle(scroll, "Shadows", s.shadows, function(v)
		s.shadows = v
		changed()
	end).LayoutOrder = nxt()
	UIKit.toggle(scroll, "Post-processing (bloom, sun rays, grading, depth of field)", s.post, function(v)
		s.post = v
		changed()
	end).LayoutOrder = nxt()
	UIKit.toggle(scroll, "Particles (welding sparks, dust)", s.particles, function(v)
		s.particles = v
		changed()
	end).LayoutOrder = nxt()
	local fov = UIKit.slider(scroll, "Field of view", s.fov, 60, 95, 1, function(v)
		s.fov = v
		changed()
	end, function(v)
		return v .. "°"
	end)
	fov.LayoutOrder = nxt()

	section(scroll, "CONTROLS", nxt())
	local sens = UIKit.slider(scroll, "Mouse sensitivity", s.mouseSensitivity, 0.2, 2.5, 0.05, function(v)
		s.mouseSensitivity = v
		changed()
	end, function(v)
		return string.format("%.2f", v)
	end)
	sens.LayoutOrder = nxt()
	UIKit.toggle(scroll, "Start in third-person view", s.thirdPerson, function(v)
		s.thirdPerson = v
		changed()
		State.fire("ViewPreference", v)
	end).LayoutOrder = nxt()
	UIKit.toggle(scroll, "Crane alignment assist on by default", s.assist, function(v)
		s.assist = v
		State.crane.assist = v
		changed()
	end).LayoutOrder = nxt()

	local chat = UIKit.segmented(scroll, "Chat window", { "Small", "Normal", "Hidden" }, s.chat or "Small", function(v)
		s.chat = v
		changed()
	end)
	chat.LayoutOrder = nxt()

	section(scroll, "AUDIO", nxt())
	for _, g in ipairs(Config.AudioGroups) do
		local row = UIKit.slider(scroll, g == "Master" and "Master volume" or g, s.volumes[g] or 0.8, 0, 1, 0.05, function(v)
			s.volumes[g] = v
			changed()
		end, function(v)
			return math.floor(v * 100 + 0.5) .. "%"
		end)
		row.LayoutOrder = nxt()
	end
	return scroll
end

Lighting.ChildAdded:Connect(function()
	task.defer(Settings.apply)
end)

return Settings
