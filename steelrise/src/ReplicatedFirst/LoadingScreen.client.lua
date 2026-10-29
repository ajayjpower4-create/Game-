-- STEELRISE loading screen. Runs from ReplicatedFirst before anything else.
--
-- Progress is tied to real work: engine load, server handshake, asset
-- preloading (with per-asset callbacks), site streaming around the menu
-- camera, catalog preparation and the menu reporting ready. Every stage has a
-- timeout so a missing asset or slow server never leaves the player stuck.

local ReplicatedFirst = game:GetService("ReplicatedFirst")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ContentProvider = game:GetService("ContentProvider")
local TweenService = game:GetService("TweenService")
local RunService = game:GetService("RunService")
local StarterGui = game:GetService("StarterGui")

local player = Players.LocalPlayer
pcall(function()
	ReplicatedFirst:RemoveDefaultLoadingScreen()
end)

local CHARCOAL = Color3.fromRGB(24, 26, 29)
local STEEL = Color3.fromRGB(122, 128, 134)
local STEEL_DARK = Color3.fromRGB(58, 62, 67)
local OFFWHITE = Color3.fromRGB(236, 233, 226)
local SAFETY = Color3.fromRGB(255, 194, 14)
local SILHOUETTE = Color3.fromRGB(19, 21, 25)

local function new(class, props)
	local inst = Instance.new(class)
	for k, v in pairs(props) do
		if k ~= "Parent" then
			inst[k] = v
		end
	end
	inst.Parent = props.Parent
	return inst
end

local gui = new("ScreenGui", {
	Name = "SR_Loading",
	IgnoreGuiInset = true,
	ResetOnSpawn = false,
	DisplayOrder = 100,
	ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
	Parent = player:WaitForChild("PlayerGui"),
})
local root = new("CanvasGroup", {
	Size = UDim2.fromScale(1, 1),
	BackgroundColor3 = CHARCOAL,
	BorderSizePixel = 0,
	Parent = gui,
})

---------------------------------------------------------------------------
-- Cinematic background (procedural silhouettes, no image assets required)
---------------------------------------------------------------------------

local sky = new("Frame", { Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.new(1, 1, 1), BorderSizePixel = 0, Parent = root })
new("UIGradient", {
	Rotation = 90,
	Color = ColorSequence.new({
		ColorSequenceKeypoint.new(0, Color3.fromRGB(17, 19, 23)),
		ColorSequenceKeypoint.new(0.5, Color3.fromRGB(40, 44, 52)),
		ColorSequenceKeypoint.new(0.74, Color3.fromRGB(104, 90, 74)),
		ColorSequenceKeypoint.new(0.8, Color3.fromRGB(70, 62, 56)),
		ColorSequenceKeypoint.new(1, Color3.fromRGB(20, 21, 24)),
	}),
	Parent = sky,
})
-- low sun glow
for i, s in ipairs({ 0.55, 0.36, 0.2 }) do
	local glow = new("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.3, 0.74),
		Size = UDim2.fromScale(s, s * 1.6),
		BackgroundColor3 = Color3.fromRGB(255, 196, 120),
		BackgroundTransparency = 0.93 - i * 0.02,
		BorderSizePixel = 0,
		Parent = root,
	})
	new("UICorner", { CornerRadius = UDim.new(0.5, 0), Parent = glow })
end

local scene = new("Frame", { Size = UDim2.new(1.08, 0, 1, 0), Position = UDim2.fromScale(-0.04, 0), BackgroundTransparency = 1, Parent = root })
local rng = Random.new(1987)
-- distant skyline
for i = 0, 28 do
	local w = rng:NextNumber(0.025, 0.055)
	local h = rng:NextNumber(0.06, 0.24)
	new("Frame", {
		AnchorPoint = Vector2.new(0, 1),
		Position = UDim2.fromScale(i * 0.036, 0.8),
		Size = UDim2.fromScale(w, h),
		BackgroundColor3 = Color3.fromRGB(30, 32, 37),
		BorderSizePixel = 0,
		Parent = scene,
	})
end
new("Frame", { AnchorPoint = Vector2.new(0, 1), Position = UDim2.fromScale(0, 1), Size = UDim2.fromScale(1, 0.21), BackgroundColor3 = SILHOUETTE, BorderSizePixel = 0, Parent = scene })

-- steel frame under construction
local frameX, frameW, frameBase = 0.56, 0.3, 0.79
local levels = 5
for c = 0, 4 do
	local h = (c == 4) and 3 or levels
	new("Frame", {
		AnchorPoint = Vector2.new(0.5, 1),
		Position = UDim2.fromScale(frameX + c * frameW / 4, frameBase),
		Size = UDim2.new(0, 4, h * 0.075, 0),
		BackgroundColor3 = SILHOUETTE,
		BorderSizePixel = 0,
		Parent = scene,
	})
end
for l = 1, levels do
	for c = 0, 3 do
		local missing = (l == levels and c >= 2) or (l == levels - 1 and c == 3) or (l >= 4 and c == 3)
		if not missing then
			new("Frame", {
				AnchorPoint = Vector2.new(0, 0.5),
				Position = UDim2.fromScale(frameX + c * frameW / 4, frameBase - l * 0.075),
				Size = UDim2.new(frameW / 4, 0, 0, 3),
				BackgroundColor3 = SILHOUETTE,
				BorderSizePixel = 0,
				Parent = scene,
			})
		end
	end
end

-- tower crane
local mastX = 0.47
new("Frame", { AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.fromScale(mastX, frameBase), Size = UDim2.new(0, 12, 0.62, 0), BackgroundColor3 = SILHOUETTE, BorderSizePixel = 0, Parent = scene })
for k = 0, 22 do
	new("Frame", {
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(mastX, frameBase - 0.012 - k * 0.026),
		Size = UDim2.new(0, 16, 0, 2),
		Rotation = (k % 2 == 0) and 35 or -35,
		BackgroundColor3 = Color3.fromRGB(46, 48, 54),
		BorderSizePixel = 0,
		Parent = scene,
	})
end
local jibY = frameBase - 0.62
new("Frame", { AnchorPoint = Vector2.new(0, 0.5), Position = UDim2.fromScale(mastX - 0.12, jibY), Size = UDim2.new(0.5, 0, 0, 7), BackgroundColor3 = SILHOUETTE, BorderSizePixel = 0, Parent = scene })
new("Frame", { AnchorPoint = Vector2.new(0, 0), Position = UDim2.fromScale(mastX - 0.115, jibY + 0.006), Size = UDim2.fromScale(0.035, 0.05), BackgroundColor3 = SILHOUETTE, BorderSizePixel = 0, Parent = scene })
new("Frame", { AnchorPoint = Vector2.new(0, 0), Position = UDim2.fromScale(mastX + 0.005, jibY + 0.006), Size = UDim2.new(0, 22, 0, 18), BackgroundColor3 = Color3.fromRGB(60, 52, 30), BorderSizePixel = 0, Parent = scene })
local beacon = new("Frame", { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(mastX + 0.38, jibY - 0.008), Size = UDim2.new(0, 5, 0, 5), BackgroundColor3 = Color3.fromRGB(255, 60, 40), BorderSizePixel = 0, Parent = scene })
new("UICorner", { CornerRadius = UDim.new(1, 0), Parent = beacon })
local trolleyX = mastX + 0.27
new("Frame", { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.fromScale(trolleyX, jibY + 0.004), Size = UDim2.new(0, 14, 0, 6), BackgroundColor3 = SILHOUETTE, BorderSizePixel = 0, Parent = scene })
-- GUI rotation pivots on the frame centre, so the pendulum frame is centred
-- on the trolley and everything hangs in its lower half.
local pendulum = new("Frame", {
	AnchorPoint = Vector2.new(0.5, 0.5),
	Position = UDim2.fromScale(trolleyX, jibY + 0.01),
	Size = UDim2.fromScale(0.06, 0.6),
	BackgroundTransparency = 1,
	Parent = scene,
})
new("Frame", { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.new(0, 1, 0.41, 0), BackgroundColor3 = Color3.fromRGB(34, 36, 40), BorderSizePixel = 0, Parent = pendulum })
new("Frame", { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.fromScale(0.5, 0.9), Size = UDim2.new(0, 10, 0, 14), BackgroundColor3 = Color3.fromRGB(70, 58, 26), BorderSizePixel = 0, Parent = pendulum })
new("Frame", { AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0.9, 18), Size = UDim2.new(0, 120, 0, 6), BackgroundColor3 = SILHOUETTE, BorderSizePixel = 0, Parent = pendulum })

-- vignette
for _, v in ipairs({ { 0, 0, 1, 0.25, 90, false }, { 0, 0.75, 1, 0.25, 90, true }, { 0, 0, 0.2, 1, 0, false }, { 0.8, 0, 0.2, 1, 0, true } }) do
	local f = new("Frame", { Position = UDim2.fromScale(v[1], v[2]), Size = UDim2.fromScale(v[3], v[4]), BackgroundColor3 = Color3.new(0, 0, 0), BorderSizePixel = 0, Parent = root })
	new("UIGradient", {
		Rotation = v[5],
		Transparency = v[6] and NumberSequence.new(1, 0.35) or NumberSequence.new(0.35, 1),
		Parent = f,
	})
end

---------------------------------------------------------------------------
-- Logo, progress and tips
---------------------------------------------------------------------------

local logo = new("Frame", { Position = UDim2.new(0, 72, 0.3, 0), Size = UDim2.new(0, 640, 0, 160), BackgroundTransparency = 1, Parent = root })
local mark = new("Frame", { Size = UDim2.new(0, 46, 0, 64), Position = UDim2.new(0, 0, 0, 8), BackgroundTransparency = 1, Parent = logo })
new("Frame", { Size = UDim2.new(1, 0, 0, 10), BackgroundColor3 = SAFETY, BorderSizePixel = 0, Parent = mark })
new("Frame", { Size = UDim2.new(1, 0, 0, 10), Position = UDim2.new(0, 0, 1, -10), BackgroundColor3 = SAFETY, BorderSizePixel = 0, Parent = mark })
new("Frame", { Size = UDim2.new(0, 10, 1, 0), Position = UDim2.new(0.5, -5, 0, 0), BackgroundColor3 = SAFETY, BorderSizePixel = 0, Parent = mark })
new("TextLabel", {
	Text = "STEELRISE",
	Font = Enum.Font.GothamBlack,
	TextSize = 76,
	TextColor3 = OFFWHITE,
	TextXAlignment = Enum.TextXAlignment.Left,
	BackgroundTransparency = 1,
	Position = UDim2.new(0, 64, 0, 0),
	Size = UDim2.new(1, -64, 0, 80),
	Parent = logo,
})
new("Frame", { Position = UDim2.new(0, 66, 0, 90), Size = UDim2.new(0, 120, 0, 3), BackgroundColor3 = SAFETY, BorderSizePixel = 0, Parent = logo })
new("TextLabel", {
	Text = "C O N S T R U C T I O N   S I M U L A T O R",
	Font = Enum.Font.GothamMedium,
	TextSize = 17,
	TextColor3 = STEEL,
	TextXAlignment = Enum.TextXAlignment.Left,
	BackgroundTransparency = 1,
	Position = UDim2.new(0, 66, 0, 102),
	Size = UDim2.new(1, -66, 0, 24),
	Parent = logo,
})

local bottom = new("Frame", { AnchorPoint = Vector2.new(0, 1), Position = UDim2.new(0, 72, 1, -56), Size = UDim2.new(1, -144, 0, 96), BackgroundTransparency = 1, Parent = root })
local stageLabel = new("TextLabel", {
	Text = "PREPARING",
	Font = Enum.Font.GothamBold,
	TextSize = 15,
	TextColor3 = OFFWHITE,
	TextXAlignment = Enum.TextXAlignment.Left,
	BackgroundTransparency = 1,
	Size = UDim2.new(0.7, 0, 0, 20),
	Parent = bottom,
})
local percentLabel = new("TextLabel", {
	Text = "0%",
	Font = Enum.Font.RobotoMono,
	TextSize = 15,
	TextColor3 = SAFETY,
	TextXAlignment = Enum.TextXAlignment.Right,
	BackgroundTransparency = 1,
	Position = UDim2.new(0.7, 0, 0, 0),
	Size = UDim2.new(0.3, 0, 0, 20),
	Parent = bottom,
})
local track = new("Frame", { Position = UDim2.new(0, 0, 0, 28), Size = UDim2.new(1, 0, 0, 4), BackgroundColor3 = STEEL_DARK, BorderSizePixel = 0, Parent = bottom })
local fill = new("Frame", { Size = UDim2.new(0, 0, 1, 0), BackgroundColor3 = SAFETY, BorderSizePixel = 0, Parent = track })
local detailLabel = new("TextLabel", {
	Text = "",
	Font = Enum.Font.RobotoMono,
	TextSize = 13,
	TextColor3 = STEEL,
	TextXAlignment = Enum.TextXAlignment.Left,
	BackgroundTransparency = 1,
	Position = UDim2.new(0, 0, 0, 40),
	Size = UDim2.new(1, 0, 0, 18),
	Parent = bottom,
})
local tipLabel = new("TextLabel", {
	Text = "",
	Font = Enum.Font.Gotham,
	TextSize = 14,
	TextColor3 = Color3.fromRGB(170, 172, 174),
	TextXAlignment = Enum.TextXAlignment.Left,
	BackgroundTransparency = 1,
	Position = UDim2.new(0, 0, 0, 66),
	Size = UDim2.new(1, 0, 0, 20),
	TextTransparency = 0,
	Parent = bottom,
})
new("TextLabel", {
	Text = "PHASE 1 BUILD",
	Font = Enum.Font.RobotoMono,
	TextSize = 12,
	TextColor3 = STEEL_DARK,
	TextXAlignment = Enum.TextXAlignment.Right,
	BackgroundTransparency = 1,
	AnchorPoint = Vector2.new(1, 0),
	Position = UDim2.new(1, -24, 0, 18),
	Size = UDim2.new(0, 300, 0, 16),
	Parent = root,
})

local TIPS = {
	"Heavy steel goes up by crane. Light and medium pieces can be carried by hand.",
	"Release a stack's ratchet straps before you try to lift anything off the truck.",
	"Columns need their four anchor nuts tightened before the crane can let go.",
	"Beams need two seats exactly one bay apart — the preview tells you what's wrong.",
	"Build scaffold as the frame rises: base jacks, uprights, ledgers, then a platform.",
	"Turn on alignment assist (H) in the crane for a target ghost and guidance arrows.",
	"Shift slows every crane motion for fine positioning.",
}

---------------------------------------------------------------------------
-- Animation
---------------------------------------------------------------------------

local t0 = os.clock()
local animConn = RunService.RenderStepped:Connect(function()
	local t = os.clock() - t0
	pendulum.Rotation = math.sin(t * 0.9) * 3.5
	scene.Position = UDim2.new(-0.04 + math.sin(t * 0.05) * 0.02, 0, 0, 0)
	beacon.BackgroundTransparency = (math.floor(t * 1.2) % 2 == 0) and 0 or 0.85
end)

local tipIndex = 0
task.spawn(function()
	while gui.Parent do
		tipIndex = tipIndex % #TIPS + 1
		TweenService:Create(tipLabel, TweenInfo.new(0.4), { TextTransparency = 1 }):Play()
		task.wait(0.4)
		tipLabel.Text = "TIP  ·  " .. TIPS[tipIndex]
		TweenService:Create(tipLabel, TweenInfo.new(0.4), { TextTransparency = 0 }):Play()
		task.wait(5.5)
	end
end)

---------------------------------------------------------------------------
-- Real loading stages
---------------------------------------------------------------------------

local STAGES = {
	{ key = "engine", label = "Initialising engine", weight = 0.1 },
	{ key = "server", label = "Connecting to the site server", weight = 0.12 },
	{ key = "assets", label = "Loading interface and audio", weight = 0.18 },
	{ key = "site", label = "Streaming construction site", weight = 0.38 },
	{ key = "catalog", label = "Preparing component catalog", weight = 0.1 },
	{ key = "menu", label = "Starting interface", weight = 0.12 },
}
local completed = 0
local shown = 0
local target = 0

local function setStage(i, sub, detail)
	local before = 0
	for k = 1, i - 1 do
		before += STAGES[k].weight
	end
	target = math.max(target, before + STAGES[i].weight * math.clamp(sub or 0, 0, 1))
	stageLabel.Text = string.format("%d / %d  ·  %s", i, #STAGES, string.upper(STAGES[i].label))
	if detail then
		detailLabel.Text = detail
	end
end

local barConn = RunService.RenderStepped:Connect(function(dt)
	shown += (target - shown) * math.min(dt * 5, 1)
	fill.Size = UDim2.new(shown, 0, 1, 0)
	percentLabel.Text = string.format("%d%%", math.floor(shown * 100 + 0.5))
end)

local function waitFor(predicate, timeout, onTick)
	local start = os.clock()
	while not predicate() do
		local elapsed = os.clock() - start
		if onTick then
			onTick(elapsed / timeout)
		end
		if elapsed > timeout then
			return false
		end
		task.wait(0.1)
	end
	return true
end

local warnings = {}

-- 1. Engine
setStage(1, 0, "Waiting for game data…")
waitFor(function()
	return game:IsLoaded()
end, 25, function(a)
	setStage(1, a)
end)
setStage(1, 1)
pcall(function()
	StarterGui:SetCoreGuiEnabled(Enum.CoreGuiType.Backpack, false)
end)

-- 2. Server handshake
setStage(2, 0, "Waiting for shared modules and remotes…")
local shared = ReplicatedStorage:WaitForChild("Steelrise", 20)
setStage(2, 0.5)
local remotes = ReplicatedStorage:WaitForChild("SteelriseRemotes", 20)
if not shared or not remotes then
	table.insert(warnings, "server handshake timed out")
end
setStage(2, 1)

-- 3. Assets (fonts + configured audio)
local preload = {}
local probe = Instance.new("TextLabel")
for _, font in ipairs({ Enum.Font.GothamBlack, Enum.Font.GothamBold, Enum.Font.GothamMedium, Enum.Font.Gotham, Enum.Font.RobotoMono }) do
	local l = probe:Clone()
	l.Font = font
	table.insert(preload, l)
end
local audioCount = 0
if shared then
	local okReg, AudioRegistry = pcall(require, shared:WaitForChild("AudioRegistry", 5))
	if okReg and type(AudioRegistry) == "table" then
		for key, e in pairs(AudioRegistry) do
			for _, id in ipairs(e.ids or {}) do
				local s = Instance.new("Sound")
				s.Name = key
				s.SoundId = id
				table.insert(preload, s)
				audioCount += 1
			end
		end
	end
end
-- optional loading ambience (only if an id has been supplied)
local ambience = nil
if shared then
	local okReg, AudioRegistry = pcall(require, shared:WaitForChild("AudioRegistry", 5))
	local entry = okReg and type(AudioRegistry) == "table" and AudioRegistry.LoadingAmbience
	if entry and entry.ids and #entry.ids > 0 then
		ambience = Instance.new("Sound")
		ambience.SoundId = entry.ids[1]
		ambience.Looped = true
		ambience.Volume = 0
		ambience.Parent = game:GetService("SoundService")
		ambience:Play()
		TweenService:Create(ambience, TweenInfo.new(2), { Volume = entry.volume or 0.35 }):Play()
	end
end

local loaded, failed = 0, 0
local total = #preload
setStage(3, 0, string.format("Assets 0/%d", total))
local preloadDone = false
task.spawn(function()
	local ok = pcall(function()
		ContentProvider:PreloadAsync(preload, function(contentId, status)
			loaded += 1
			if status ~= Enum.AssetFetchStatus.Success then
				failed += 1
				warn("[STEELRISE] asset failed to load:", contentId, status)
			end
			setStage(3, loaded / math.max(total, 1), string.format("Assets %d/%d  ·  audio files configured: %d  ·  unavailable: %d", loaded, total, audioCount, failed))
		end)
	end)
	if not ok then
		table.insert(warnings, "asset preload error")
	end
	preloadDone = true
end)
waitFor(function()
	return preloadDone
end, 20)
if failed > 0 then
	table.insert(warnings, failed .. " asset(s) unavailable")
end
if audioCount == 0 then
	detailLabel.Text = "No custom audio configured yet (see docs/AUDIO.md) — continuing."
end
setStage(3, 1)

-- 4. Site streaming
setStage(4, 0, "Waiting for the site to be built…")
local site = nil
waitFor(function()
	site = workspace:FindFirstChild("SteelriseSite")
	return site ~= nil and site:GetAttribute("Ready") == true
end, 30, function(a)
	setStage(4, a * 0.5)
end)
if site then
	local focus = site:FindFirstChild("Focus")
	local pos = focus and focus.Position or Vector3.new(0, 20, 0)
	setStage(4, 0.55, "Streaming geometry around the crane…")
	local done = false
	task.spawn(function()
		pcall(function()
			player:RequestStreamAroundAsync(pos, 15)
		end)
		done = true
	end)
	waitFor(function()
		return done
	end, 16, function(a)
		setStage(4, 0.55 + a * 0.4)
	end)
	local comps = site:FindFirstChild("Components")
	detailLabel.Text = string.format("Site ready  ·  %d components streamed", comps and #comps:GetChildren() or 0)
else
	table.insert(warnings, "site not ready (continuing)")
end
setStage(4, 1)

-- 5. Catalog
setStage(5, 0, "Indexing item registry…")
if shared then
	local okReg, Registry = pcall(require, shared:WaitForChild("ItemRegistry", 5))
	if okReg and type(Registry) == "table" and Registry.count then
		local counts = Registry.count()
		detailLabel.Text = string.format("Catalog: %d items implemented (target %d)", counts.total, Registry.TargetCount or 500)
	else
		table.insert(warnings, "catalog unavailable")
	end
end
setStage(5, 1)

-- 6. Menu
setStage(6, 0, "Waiting for the menu…")
waitFor(function()
	return player:GetAttribute("SR_MenuReady") == true
end, 20, function(a)
	setStage(6, a)
end)
setStage(6, 1)
if #warnings > 0 then
	detailLabel.Text = "Continuing with warnings: " .. table.concat(warnings, "; ")
	task.wait(1.2)
end

task.wait(0.35)
player:SetAttribute("SR_LoaderDone", true)
local fade = TweenService:Create(root, TweenInfo.new(0.9, Enum.EasingStyle.Quad, Enum.EasingDirection.InOut), { GroupTransparency = 1 })
fade:Play()
if ambience then
	TweenService:Create(ambience, TweenInfo.new(1.2), { Volume = 0 }):Play()
	task.delay(1.3, function()
		ambience:Destroy()
	end)
end
fade.Completed:Wait()
animConn:Disconnect()
barConn:Disconnect()
gui:Destroy()
