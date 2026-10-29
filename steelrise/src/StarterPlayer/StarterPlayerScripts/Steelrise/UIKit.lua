-- Interface building blocks in the STEELRISE style: charcoal panels, steel
-- gray dividers, off-white text and safety-yellow accents.

local Players = game:GetService("Players")
local TweenService = game:GetService("TweenService")
local UserInputService = game:GetService("UserInputService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Steelrise")
local Config = require(Shared.Config)

local C = Config.Colors
local UIKit = {}
UIKit.C = C

UIKit.Font = {
	Display = Enum.Font.GothamBlack,
	Bold = Enum.Font.GothamBold,
	Medium = Enum.Font.GothamMedium,
	Body = Enum.Font.Gotham,
	Mono = Enum.Font.RobotoMono,
}

local clickSound = nil
function UIKit.setClickSound(fn)
	clickSound = fn
end

function UIKit.new(className, props, children)
	local inst = Instance.new(className)
	for k, v in pairs(props or {}) do
		if k ~= "Parent" then
			inst[k] = v
		end
	end
	for _, child in ipairs(children or {}) do
		child.Parent = inst
	end
	if props and props.Parent then
		inst.Parent = props.Parent
	end
	return inst
end

function UIKit.corner(inst, r)
	return UIKit.new("UICorner", { CornerRadius = UDim.new(0, r or 6), Parent = inst })
end

function UIKit.stroke(inst, color, thickness, transparency)
	return UIKit.new("UIStroke", {
		Color = color or C.SteelDark,
		Thickness = thickness or 1,
		Transparency = transparency or 0,
		ApplyStrokeMode = Enum.ApplyStrokeMode.Border,
		Parent = inst,
	})
end

function UIKit.padding(inst, l, t, r, b)
	return UIKit.new("UIPadding", {
		PaddingLeft = UDim.new(0, l or 8),
		PaddingTop = UDim.new(0, t or l or 8),
		PaddingRight = UDim.new(0, r or l or 8),
		PaddingBottom = UDim.new(0, b or t or l or 8),
		Parent = inst,
	})
end

function UIKit.list(inst, dir, pad, halign, valign)
	return UIKit.new("UIListLayout", {
		FillDirection = dir or Enum.FillDirection.Vertical,
		Padding = UDim.new(0, pad or 6),
		SortOrder = Enum.SortOrder.LayoutOrder,
		HorizontalAlignment = halign or Enum.HorizontalAlignment.Left,
		VerticalAlignment = valign or Enum.VerticalAlignment.Top,
		Parent = inst,
	})
end

function UIKit.tween(inst, t, props, style, dir)
	local tw = TweenService:Create(inst, TweenInfo.new(t, style or Enum.EasingStyle.Quad, dir or Enum.EasingDirection.Out), props)
	tw:Play()
	return tw
end

-- Root ScreenGui with automatic scale for 720p..1440p.
function UIKit.screen(name, order)
	local gui = UIKit.new("ScreenGui", {
		Name = name,
		ResetOnSpawn = false,
		IgnoreGuiInset = true,
		ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
		DisplayOrder = order or 0,
		Parent = Players.LocalPlayer:WaitForChild("PlayerGui"),
	})
	local scale = UIKit.new("UIScale", { Parent = gui })
	local function update()
		local cam = workspace.CurrentCamera
		local h = cam and cam.ViewportSize.Y or 1080
		scale.Scale = math.clamp(h / 1000, 0.7, 1.35)
	end
	update()
	if workspace.CurrentCamera then
		workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize"):Connect(update)
	end
	return gui
end

function UIKit.panel(parent, props)
	local f = UIKit.new("Frame", {
		BackgroundColor3 = C.Panel,
		BackgroundTransparency = 0.08,
		BorderSizePixel = 0,
		Parent = parent,
	})
	for k, v in pairs(props or {}) do
		f[k] = v
	end
	UIKit.corner(f, 6)
	UIKit.stroke(f, C.SteelDark, 1, 0.3)
	return f
end

function UIKit.label(parent, text, size, font, color, props)
	local l = UIKit.new("TextLabel", {
		BackgroundTransparency = 1,
		Text = text or "",
		TextSize = size or 16,
		Font = font or UIKit.Font.Body,
		TextColor3 = color or C.OffWhite,
		TextXAlignment = Enum.TextXAlignment.Left,
		TextYAlignment = Enum.TextYAlignment.Center,
		Size = UDim2.new(1, 0, 0, (size or 16) + 6),
		TextWrapped = true,
		Parent = parent,
	})
	for k, v in pairs(props or {}) do
		l[k] = v
	end
	return l
end

-- Primary / secondary / ghost buttons.
function UIKit.button(parent, text, opts)
	opts = opts or {}
	local style = opts.style or "secondary"
	local bg = style == "primary" and C.Safety or (style == "danger" and C.Invalid or C.CharcoalLight)
	local fg = style == "primary" and C.Charcoal or C.OffWhite
	local b = UIKit.new("TextButton", {
		AutoButtonColor = false,
		BackgroundColor3 = bg,
		BackgroundTransparency = style == "ghost" and 1 or 0,
		BorderSizePixel = 0,
		Text = text,
		TextSize = opts.textSize or 17,
		Font = opts.font or UIKit.Font.Bold,
		TextColor3 = fg,
		Size = opts.size or UDim2.new(1, 0, 0, 42),
		TextXAlignment = opts.align or Enum.TextXAlignment.Center,
		Parent = parent,
	})
	if opts.align == Enum.TextXAlignment.Left then
		UIKit.padding(b, 16, 0, 8, 0)
	end
	UIKit.corner(b, 5)
	local stroke = UIKit.stroke(b, style == "primary" and C.SafetyDark or C.SteelDark, 1, style == "ghost" and 1 or 0.2)
	local base = bg
	b.MouseEnter:Connect(function()
		if b:GetAttribute("Disabled") then
			return
		end
		UIKit.tween(b, 0.12, { BackgroundColor3 = style == "primary" and Color3.fromRGB(255, 210, 70) or C.SteelDark, BackgroundTransparency = 0 })
		stroke.Color = C.Safety
	end)
	b.MouseLeave:Connect(function()
		UIKit.tween(b, 0.18, { BackgroundColor3 = base, BackgroundTransparency = style == "ghost" and 1 or 0 })
		stroke.Color = style == "primary" and C.SafetyDark or C.SteelDark
	end)
	b.MouseButton1Down:Connect(function()
		if clickSound and not b:GetAttribute("Disabled") then
			clickSound()
		end
	end)
	return b
end

function UIKit.setDisabled(button, disabled)
	button:SetAttribute("Disabled", disabled)
	button.TextTransparency = disabled and 0.6 or 0
	button.Active = not disabled
	button.AutoButtonColor = false
end

function UIKit.divider(parent)
	return UIKit.new("Frame", {
		BackgroundColor3 = C.SteelDark,
		BorderSizePixel = 0,
		Size = UDim2.new(1, 0, 0, 1),
		BackgroundTransparency = 0.3,
		Parent = parent,
	})
end

function UIKit.chip(parent, text, color)
	local f = UIKit.new("TextLabel", {
		BackgroundColor3 = color or C.SteelDark,
		Text = text,
		TextSize = 13,
		Font = UIKit.Font.Bold,
		TextColor3 = color == C.Safety and C.Charcoal or C.OffWhite,
		AutomaticSize = Enum.AutomaticSize.X,
		Size = UDim2.new(0, 0, 0, 22),
		Parent = parent,
	})
	UIKit.padding(f, 8, 0, 8, 0)
	UIKit.corner(f, 11)
	return f
end

-- Horizontal slider. onChange(value) fires while dragging.
function UIKit.slider(parent, labelText, value, min, max, step, onChange, fmt)
	local row = UIKit.new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 44), Parent = parent })
	local label = UIKit.label(row, labelText, 15, UIKit.Font.Medium, C.OffWhite, { Size = UDim2.new(0.5, 0, 0, 20) })
	local valueLabel = UIKit.label(row, "", 14, UIKit.Font.Mono, C.Muted, {
		Size = UDim2.new(0.5, 0, 0, 20),
		Position = UDim2.new(0.5, 0, 0, 0),
		TextXAlignment = Enum.TextXAlignment.Right,
	})
	local track = UIKit.new("Frame", {
		BackgroundColor3 = C.SteelDark,
		BorderSizePixel = 0,
		Size = UDim2.new(1, 0, 0, 6),
		Position = UDim2.new(0, 0, 0, 30),
		Parent = row,
	})
	UIKit.corner(track, 3)
	local fill = UIKit.new("Frame", { BackgroundColor3 = C.Safety, BorderSizePixel = 0, Size = UDim2.new(0, 0, 1, 0), Parent = track })
	UIKit.corner(fill, 3)
	local knob = UIKit.new("Frame", {
		BackgroundColor3 = C.OffWhite,
		BorderSizePixel = 0,
		Size = UDim2.new(0, 16, 0, 16),
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.new(0, 0, 0.5, 0),
		Parent = track,
	})
	UIKit.corner(knob, 8)
	local current = value
	local function render()
		local a = (current - min) / (max - min)
		fill.Size = UDim2.new(a, 0, 1, 0)
		knob.Position = UDim2.new(a, 0, 0.5, 0)
		valueLabel.Text = fmt and fmt(current) or tostring(current)
	end
	local function setFromX(x)
		local a = math.clamp((x - track.AbsolutePosition.X) / math.max(track.AbsoluteSize.X, 1), 0, 1)
		local v = min + a * (max - min)
		v = math.floor(v / step + 0.5) * step
		v = math.clamp(v, min, max)
		if v ~= current then
			current = v
			render()
			onChange(v)
		end
	end
	local dragging = false
	local hit = UIKit.new("TextButton", {
		BackgroundTransparency = 1,
		Text = "",
		Size = UDim2.new(1, 0, 0, 24),
		Position = UDim2.new(0, 0, 0, 22),
		Parent = row,
	})
	hit.MouseButton1Down:Connect(function(x)
		dragging = true
		setFromX(x)
	end)
	UserInputService.InputChanged:Connect(function(input)
		if dragging and input.UserInputType == Enum.UserInputType.MouseMovement then
			setFromX(input.Position.X)
		end
	end)
	UserInputService.InputEnded:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.MouseButton1 then
			dragging = false
		end
	end)
	render()
	return row, function(v)
		current = v
		render()
	end
end

function UIKit.toggle(parent, labelText, value, onChange)
	local row = UIKit.new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 32), Parent = parent })
	UIKit.label(row, labelText, 15, UIKit.Font.Medium, C.OffWhite, { Size = UDim2.new(1, -60, 1, 0) })
	local sw = UIKit.new("TextButton", {
		AutoButtonColor = false,
		Text = "",
		Size = UDim2.new(0, 46, 0, 24),
		AnchorPoint = Vector2.new(1, 0.5),
		Position = UDim2.new(1, 0, 0.5, 0),
		BorderSizePixel = 0,
		Parent = row,
	})
	UIKit.corner(sw, 12)
	local dot = UIKit.new("Frame", { Size = UDim2.new(0, 18, 0, 18), AnchorPoint = Vector2.new(0, 0.5), BorderSizePixel = 0, BackgroundColor3 = C.OffWhite, Parent = sw })
	UIKit.corner(dot, 9)
	local on = value
	local function render()
		sw.BackgroundColor3 = on and C.Safety or C.SteelDark
		UIKit.tween(dot, 0.12, { Position = on and UDim2.new(1, -21, 0.5, 0) or UDim2.new(0, 3, 0.5, 0) })
	end
	sw.MouseButton1Click:Connect(function()
		on = not on
		render()
		if clickSound then
			clickSound()
		end
		onChange(on)
	end)
	render()
	return row
end

function UIKit.segmented(parent, labelText, options, value, onChange)
	local row = UIKit.new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 58), Parent = parent })
	UIKit.label(row, labelText, 15, UIKit.Font.Medium, C.OffWhite, { Size = UDim2.new(1, 0, 0, 20) })
	local bar = UIKit.new("Frame", { BackgroundColor3 = C.Charcoal, BorderSizePixel = 0, Size = UDim2.new(1, 0, 0, 32), Position = UDim2.new(0, 0, 0, 24), Parent = row })
	UIKit.corner(bar, 5)
	UIKit.list(bar, Enum.FillDirection.Horizontal, 0)
	local buttons = {}
	local current = value
	local function render()
		for opt, b in pairs(buttons) do
			b.BackgroundColor3 = opt == current and C.Safety or C.Charcoal
			b.TextColor3 = opt == current and C.Charcoal or C.OffWhite
		end
	end
	for i, opt in ipairs(options) do
		local b = UIKit.new("TextButton", {
			AutoButtonColor = false,
			Text = opt,
			Font = UIKit.Font.Bold,
			TextSize = 14,
			BorderSizePixel = 0,
			Size = UDim2.new(1 / #options, 0, 1, 0),
			LayoutOrder = i,
			Parent = bar,
		})
		UIKit.corner(b, 5)
		buttons[opt] = b
		b.MouseButton1Click:Connect(function()
			current = opt
			render()
			if clickSound then
				clickSound()
			end
			onChange(opt)
		end)
	end
	render()
	return row
end

-- Frames a model inside a ViewportFrame camera.
function UIKit.frameModel(viewport, model, yawDeg, pitchDeg, distScale)
	local cam = viewport.CurrentCamera
	if not cam then
		cam = Instance.new("Camera")
		cam.FieldOfView = 30
		cam.Parent = viewport
		viewport.CurrentCamera = cam
	end
	local cf, size = model:GetAttribute("BBCf"), model:GetAttribute("BBSize")
	if not cf then
		cf, size = model:GetBoundingBox()
		model:SetAttribute("BBCf", cf)
		model:SetAttribute("BBSize", size)
	end
	local radius = size.Magnitude / 2
	local dist = radius / math.tan(math.rad(cam.FieldOfView / 2)) * (distScale or 1.05)
	local rot = CFrame.Angles(0, math.rad(yawDeg or 35), 0) * CFrame.Angles(math.rad(-(pitchDeg or 22)), 0, 0)
	cam.CFrame = CFrame.new(cf.Position) * rot * CFrame.new(0, 0, dist)
	return cam
end

return UIKit
