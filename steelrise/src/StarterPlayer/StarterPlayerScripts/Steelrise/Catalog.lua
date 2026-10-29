-- Searchable catalog over the item registry: categories, favourites, lazy
-- 3D thumbnails (only cards scrolled into view get a model, and the oldest
-- are released once the cache is full) and physical delivery requests.

local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Steelrise")
local Config = require(Shared.Config)
local Registry = require(Shared.ItemRegistry)
local Factory = require(Shared.ModelFactory)
local Util = require(Shared.Util)

local State = require(script.Parent.State)
local UIKit = require(script.Parent.UIKit)
local Net = require(script.Parent.Net)

local C = Config.Colors
local F = UIKit.Font

local Catalog = {}
local gui, root, grid, search, detail, countLabel
local category = "All"
local favoritesOnly = false
local selected = nil
local qty = 1
local cards = {} -- id -> { frame, vp, model, lastSeen }
local built = 0
local MAX_THUMBS = 48

local CLASS_COLOR = {
	Installable = C.Safety,
	Equipment = C.Info,
	Decorative = C.Steel,
	Tool = C.Valid,
}

local function thumbModel(def)
	local ok, model = pcall(Factory.build, def, CFrame.new(), { preview = true })
	if ok then
		return model
	end
	return nil
end

local function releaseThumb(c)
	if c.model then
		c.model:Destroy()
		c.model = nil
		built -= 1
	end
end

local function updateThumbs()
	if not root.Visible then
		return
	end
	local winPos, winSize = grid.AbsolutePosition, grid.AbsoluteSize
	local now = os.clock()
	for _, c in pairs(cards) do
		local p, s = c.frame.AbsolutePosition, c.frame.AbsoluteSize
		local visible = c.frame.Visible and p.Y + s.Y > winPos.Y - 100 and p.Y < winPos.Y + winSize.Y + 100
		if visible then
			c.lastSeen = now
			if not c.model and built < MAX_THUMBS + 12 then
				c.model = thumbModel(c.def)
				if c.model then
					built += 1
					c.model.Parent = c.vp
					UIKit.frameModel(c.vp, c.model, 35, 24, 0.95)
				end
			end
		end
	end
	if built > MAX_THUMBS then
		local list = {}
		for _, c in pairs(cards) do
			if c.model then
				table.insert(list, c)
			end
		end
		table.sort(list, function(a, b)
			return (a.lastSeen or 0) < (b.lastSeen or 0)
		end)
		for i = 1, built - MAX_THUMBS do
			if list[i] and now - (list[i].lastSeen or 0) > 0.5 then
				releaseThumb(list[i])
			end
		end
	end
end

local function setDetail(def)
	selected = def
	qty = 1
	for _, c in ipairs(detail.vp:GetChildren()) do
		if c:IsA("Model") then
			c:Destroy()
		end
	end
	if not def then
		detail.body.Visible = false
		return
	end
	detail.body.Visible = true
	local m = thumbModel(def)
	if m then
		m.Parent = detail.vp
		detail.model = m
		UIKit.frameModel(detail.vp, m, 35, 24, 0.9)
	end
	detail.name.Text = def.name
	detail.cat.Text = string.upper(def.category)
	detail.class.Text = string.upper(Registry.Classes[def.class] or def.class)
	detail.class.BackgroundColor3 = CLASS_COLOR[def.class] or C.Steel
	detail.class.TextColor3 = def.class == "Installable" and C.Charcoal or C.OffWhite
	detail.dims.Text = Registry.dimensionsText(def)
	detail.weight.Text = def.weightKg > 0 and (Util.fmtKg(def.weightKg) .. "  ·  " .. def.handling) or def.handling
	local behaviour = ({
		Point = "Seats on one connection point.",
		Span = "Spans between two connection points.",
		Surface = "Bears on two parallel beams.",
		Rest = "Stands on the ground or an installed deck.",
		Tool = "Equip from the hotbar.",
	})[def.kind] or ""
	if #def.fasteners > 0 then
		local kinds = {}
		for _, f in ipairs(def.fasteners) do
			kinds[f.type] = (kinds[f.type] or 0) + 1
		end
		local parts = {}
		for k, n in pairs(kinds) do
			table.insert(parts, n .. " " .. string.lower(k) .. (n > 1 and "s" or ""))
		end
		behaviour ..= "  Fastening: " .. table.concat(parts, ", ") .. "."
	end
	if def.allowFree then
		behaviour ..= "  Free placement available (T)."
	end
	detail.behaviour.Text = behaviour
	detail.desc.Text = def.description or ""
	detail.fav.Text = State.favorites[def.id] and "★ FAVOURITE" or "☆ ADD TO FAVOURITES"
	detail.qtyRow.Visible = def.deliverable
	detail.order.Visible = def.deliverable
	detail.equip.Visible = def.kind == "Tool"
	detail.qty.Text = tostring(qty)
end

local function rebuild()
	local favs = State.favorites
	local list = Registry.search(search.Text, category ~= "Favourites" and category or nil, favs, category == "Favourites")
	local keep = {}
	for i, def in ipairs(list) do
		keep[def.id] = i
	end
	for id, c in pairs(cards) do
		c.frame.Visible = keep[id] ~= nil
		c.frame.LayoutOrder = keep[id] or 0
	end
	countLabel.Text = string.format("%d shown  ·  %d items implemented  ·  target %d", #list, Registry.count().total, Registry.TargetCount)
	task.defer(updateThumbs)
end

local function makeCard(def, order)
	local frame = UIKit.new("TextButton", { AutoButtonColor = false, Text = "", BackgroundColor3 = C.CharcoalLight, BorderSizePixel = 0, LayoutOrder = order, Parent = grid })
	UIKit.corner(frame, 5)
	local stroke = UIKit.stroke(frame, C.SteelDark, 1, 0)
	local vp = UIKit.new("ViewportFrame", {
		BackgroundColor3 = Color3.fromRGB(44, 48, 54),
		BorderSizePixel = 0,
		Size = UDim2.new(1, -8, 0, 86),
		Position = UDim2.new(0, 4, 0, 4),
		Ambient = Color3.fromRGB(130, 132, 138),
		LightColor = Color3.fromRGB(255, 246, 232),
		LightDirection = Vector3.new(-0.5, -1, -0.6),
		Parent = frame,
	})
	UIKit.corner(vp, 4)
	local bar = UIKit.new("Frame", { BackgroundColor3 = CLASS_COLOR[def.class] or C.Steel, BorderSizePixel = 0, Size = UDim2.new(0, 3, 0, 86), Position = UDim2.new(0, 4, 0, 4), Parent = frame })
	bar.ZIndex = 2
	UIKit.label(frame, def.name, 12, F.Medium, C.OffWhite, { Position = UDim2.new(0, 6, 0, 92), Size = UDim2.new(1, -12, 0, 30), TextWrapped = true, TextYAlignment = Enum.TextYAlignment.Top })
	local fav = UIKit.label(frame, "★", 14, F.Bold, C.Safety, { Position = UDim2.new(1, -20, 0, 6), Size = UDim2.new(0, 16, 0, 16), Visible = State.favorites[def.id] == true })
	fav.ZIndex = 3
	frame.MouseButton1Click:Connect(function()
		setDetail(def)
	end)
	frame.MouseEnter:Connect(function()
		stroke.Color = C.Safety
	end)
	frame.MouseLeave:Connect(function()
		stroke.Color = C.SteelDark
	end)
	cards[def.id] = { frame = frame, vp = vp, def = def, fav = fav }
end

function Catalog.build()
	gui = UIKit.screen("SR_Catalog", 8)
	root = UIKit.new("Frame", { BackgroundColor3 = Color3.new(0, 0, 0), BackgroundTransparency = 0.4, BorderSizePixel = 0, Size = UDim2.fromScale(1, 1), Visible = false, Parent = gui })
	root.Active = true
	UIKit.new("TextButton", { Modal = true, BackgroundTransparency = 1, Text = "", Size = UDim2.new(0, 1, 0, 1), Parent = root })
	local panel = UIKit.panel(root, { AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.5), Size = UDim2.new(0.86, 0, 0.84, 0) })
	UIKit.padding(panel, 18)
	UIKit.label(panel, "CATALOG & DELIVERIES", 22, F.Display, C.OffWhite, { Size = UDim2.new(0.5, 0, 0, 28) })
	countLabel = UIKit.label(panel, "", 12, F.Mono, C.Muted, { AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -44, 0, 6), Size = UDim2.new(0.5, 0, 0, 16), TextXAlignment = Enum.TextXAlignment.Right })
	local close = UIKit.button(panel, "✕", { style = "ghost", size = UDim2.new(0, 34, 0, 34), textSize = 18 })
	close.AnchorPoint = Vector2.new(1, 0)
	close.Position = UDim2.new(1, 0, 0, -4)
	close.MouseButton1Click:Connect(function()
		Catalog.toggle(false)
	end)

	-- categories
	local cats = UIKit.new("ScrollingFrame", { BackgroundTransparency = 1, BorderSizePixel = 0, Position = UDim2.new(0, 0, 0, 44), Size = UDim2.new(0, 220, 1, -44), CanvasSize = UDim2.new(), AutomaticCanvasSize = Enum.AutomaticSize.Y, ScrollBarThickness = 3, Parent = panel })
	UIKit.list(cats, nil, 3)
	local catButtons = {}
	local function selectCat(name)
		category = name
		for n, b in pairs(catButtons) do
			b.TextColor3 = n == name and C.Safety or C.OffWhite
		end
		rebuild()
	end
	local allCats = { "All", "Favourites" }
	for _, c in ipairs(Registry.Categories) do
		table.insert(allCats, c)
	end
	for i, name in ipairs(allCats) do
		local n = 0
		for _, def in ipairs(Registry.list) do
			if name == "All" or def.category == name then
				n += 1
			end
		end
		local label = name == "Favourites" and "★ Favourites" or (name .. "  (" .. n .. ")")
		local b = UIKit.button(cats, label, { style = "ghost", align = Enum.TextXAlignment.Left, size = UDim2.new(1, -6, 0, 32), textSize = 14, font = F.Medium })
		b.LayoutOrder = i
		b.MouseButton1Click:Connect(function()
			selectCat(name)
		end)
		catButtons[name] = b
	end

	-- search + grid
	local mid = UIKit.new("Frame", { BackgroundTransparency = 1, Position = UDim2.new(0, 232, 0, 44), Size = UDim2.new(1, -232 - 360, 1, -44), Parent = panel })
	search = UIKit.new("TextBox", {
		PlaceholderText = "Search components, sizes, categories…",
		Text = "",
		ClearTextOnFocus = false,
		Font = F.Medium,
		TextSize = 15,
		TextColor3 = C.OffWhite,
		PlaceholderColor3 = C.Muted,
		BackgroundColor3 = C.Charcoal,
		BorderSizePixel = 0,
		TextXAlignment = Enum.TextXAlignment.Left,
		Size = UDim2.new(1, 0, 0, 36),
		Parent = mid,
	})
	UIKit.corner(search, 5)
	UIKit.padding(search, 12, 0, 12, 0)
	UIKit.stroke(search, C.SteelDark, 1, 0)
	search:GetPropertyChangedSignal("Text"):Connect(rebuild)
	grid = UIKit.new("ScrollingFrame", { BackgroundTransparency = 1, BorderSizePixel = 0, Position = UDim2.new(0, 0, 0, 46), Size = UDim2.new(1, 0, 1, -46), CanvasSize = UDim2.new(), AutomaticCanvasSize = Enum.AutomaticSize.Y, ScrollBarThickness = 4, ScrollBarImageColor3 = C.Steel, Parent = mid })
	UIKit.new("UIGridLayout", { CellSize = UDim2.new(0, 150, 0, 126), CellPadding = UDim2.new(0, 8, 0, 8), SortOrder = Enum.SortOrder.LayoutOrder, Parent = grid })
	grid:GetPropertyChangedSignal("CanvasPosition"):Connect(updateThumbs)
	for i, def in ipairs(Registry.list) do
		makeCard(def, i)
	end

	-- detail
	local dp = UIKit.panel(panel, { AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, 0, 0, 44), Size = UDim2.new(0, 348, 1, -44) })
	UIKit.padding(dp, 12)
	detail = {}
	detail.vp = UIKit.new("ViewportFrame", { BackgroundColor3 = Color3.fromRGB(44, 48, 54), BorderSizePixel = 0, Size = UDim2.new(1, 0, 0, 170), Ambient = Color3.fromRGB(130, 132, 138), LightColor = Color3.fromRGB(255, 246, 232), LightDirection = Vector3.new(-0.5, -1, -0.6), Parent = dp })
	UIKit.corner(detail.vp, 4)
	detail.body = UIKit.new("ScrollingFrame", { BackgroundTransparency = 1, BorderSizePixel = 0, Position = UDim2.new(0, 0, 0, 178), Size = UDim2.new(1, 0, 1, -178), CanvasSize = UDim2.new(), AutomaticCanvasSize = Enum.AutomaticSize.Y, ScrollBarThickness = 3, Visible = false, Parent = dp })
	UIKit.list(detail.body, nil, 6)
	detail.name = UIKit.label(detail.body, "", 17, F.Bold, C.OffWhite, { LayoutOrder = 1, Size = UDim2.new(1, -6, 0, 0), AutomaticSize = Enum.AutomaticSize.Y })
	local chips = UIKit.new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 22), LayoutOrder = 2, Parent = detail.body })
	UIKit.list(chips, Enum.FillDirection.Horizontal, 6)
	detail.class = UIKit.chip(chips, "")
	detail.cat = UIKit.label(detail.body, "", 11, F.Bold, C.Muted, { LayoutOrder = 3, Size = UDim2.new(1, 0, 0, 14) })
	detail.dims = UIKit.label(detail.body, "", 13, F.Mono, C.OffWhite, { LayoutOrder = 4, Size = UDim2.new(1, 0, 0, 16) })
	detail.weight = UIKit.label(detail.body, "", 13, F.Medium, C.Safety, { LayoutOrder = 5, Size = UDim2.new(1, -6, 0, 0), AutomaticSize = Enum.AutomaticSize.Y })
	detail.desc = UIKit.label(detail.body, "", 13, F.Body, C.OffWhite, { LayoutOrder = 6, Size = UDim2.new(1, -6, 0, 0), AutomaticSize = Enum.AutomaticSize.Y })
	detail.behaviour = UIKit.label(detail.body, "", 12, F.Body, C.Muted, { LayoutOrder = 7, Size = UDim2.new(1, -6, 0, 0), AutomaticSize = Enum.AutomaticSize.Y })
	detail.fav = UIKit.button(detail.body, "", { style = "ghost", size = UDim2.new(1, -6, 0, 30), textSize = 13 })
	detail.fav.LayoutOrder = 8
	detail.fav.MouseButton1Click:Connect(function()
		if not selected then
			return
		end
		local on = not State.favorites[selected.id]
		State.favorites[selected.id] = on or nil
		cards[selected.id].fav.Visible = on
		detail.fav.Text = on and "★ FAVOURITE" or "☆ ADD TO FAVOURITES"
		Net.call("Save", true, "Favorite", selected.id, on)
		if category == "Favourites" then
			rebuild()
		end
	end)
	detail.qtyRow = UIKit.new("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, -6, 0, 34), LayoutOrder = 9, Parent = detail.body })
	UIKit.label(detail.qtyRow, "QUANTITY", 12, F.Bold, C.Muted, { Size = UDim2.new(0, 100, 1, 0) })
	local minus = UIKit.button(detail.qtyRow, "−", { size = UDim2.new(0, 34, 1, 0), textSize = 18 })
	minus.Position = UDim2.new(0, 110, 0, 0)
	detail.qty = UIKit.label(detail.qtyRow, "1", 16, F.Mono, C.OffWhite, { Position = UDim2.new(0, 148, 0, 0), Size = UDim2.new(0, 50, 1, 0), TextXAlignment = Enum.TextXAlignment.Center })
	local plus = UIKit.button(detail.qtyRow, "+", { size = UDim2.new(0, 34, 1, 0), textSize = 18 })
	plus.Position = UDim2.new(0, 202, 0, 0)
	minus.MouseButton1Click:Connect(function()
		qty = math.max(1, qty - 1)
		detail.qty.Text = tostring(qty)
	end)
	plus.MouseButton1Click:Connect(function()
		qty = math.min(40, qty + 1)
		detail.qty.Text = tostring(qty)
	end)
	detail.order = UIKit.button(detail.body, "REQUEST DELIVERY", { style = "primary", size = UDim2.new(1, -6, 0, 42) })
	detail.order.LayoutOrder = 10
	detail.order.MouseButton1Click:Connect(function()
		if not selected then
			return
		end
		local ok = Net.call("Delivery", false, "Request", selected.id, qty)
		if ok then
			State.fire("DeliveryRequested", selected.id, qty)
			Catalog.toggle(false)
		end
	end)
	detail.equip = UIKit.button(detail.body, "EQUIP", { size = UDim2.new(1, -6, 0, 38) })
	detail.equip.LayoutOrder = 11
	detail.equip.MouseButton1Click:Connect(function()
		if selected then
			State.fire("SelectTool", selected.id)
			Catalog.toggle(false)
		end
	end)
	UIKit.label(detail.body, "Deliveries are free in this build: no money grind. Trucks park in the unloading bays with every piece strapped on the deck.", 11, F.Body, C.SteelDark, { LayoutOrder = 12, Size = UDim2.new(1, -6, 0, 0), AutomaticSize = Enum.AutomaticSize.Y })

	selectCat("All")
	RunService.Heartbeat:Connect(function(dt)
		if root.Visible and detail.model and detail.vp.CurrentCamera then
			detail.spin = (detail.spin or 0) + dt * 20
			UIKit.frameModel(detail.vp, detail.model, 35 + detail.spin, 24, 0.9)
		end
	end)
	return gui
end

function Catalog.toggle(open)
	if open == nil then
		open = not root.Visible
	end
	root.Visible = open
	State.catalogOpen = open
	State.uiBlocking = open
	State.fire("UIBlocking", open)
	if open then
		rebuild()
		task.delay(0.05, updateThumbs)
	else
		search:ReleaseFocus()
	end
end

function Catalog.isOpen()
	return root and root.Visible
end

return Catalog
