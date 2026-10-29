-- usage: SCENARIO=dump ; DUMP_WHAT global chooses the model
local M = M_RBX
M.isServer = true
local SS = game.ServerScriptService.Steelrise
local Sites = require(game.ReplicatedStorage.Steelrise.Sites)
local function ser(model)
	local out = {}
	for _, d in ipairs(model:GetDescendants()) do
		if d:IsA("BasePart") then
			local cf = d.CFrame
			local shape = rawget(d, "_p").Shape
			local mat = rawget(d, "_p").Material
			local c = rawget(d, "_p").Color or Color3.new(0.6, 0.6, 0.6)
			local comps = { cf:GetComponents() }
			for i = 1, 12 do comps[i] = string.format("%.4f", comps[i]) end
			table.insert(out, string.format('{"cls":"%s","shape":"%s","mat":"%s","size":[%.4f,%.4f,%.4f],"cf":[%s],"color":[%.3f,%.3f,%.3f],"tr":%.2f}',
				rawget(d, "_p").ClassName, shape and shape.Name or "Block", mat and mat.Name or "Plastic",
				d.Size.X, d.Size.Y, d.Size.Z, table.concat(comps, ","), c.R, c.G, c.B, rawget(d, "_p").Transparency or 0))
		end
	end
	return out
end
local parts = {}
local what = DUMP_WHAT or "truck"
if what == "truck" then
	local VF = require(SS.VehicleFactory)
	local m = VF.buildTruck(CFrame.new(), 3)
	parts = ser(m)
elseif what == "train" then
	local VF = require(SS.VehicleFactory)
	local loco = VF.buildLocomotive(CFrame.new(-60, 0, 0))
	local car = VF.buildFlatcar(CFrame.new(0, 0, 0), 1)
	for _, p in ipairs(ser(loco)) do table.insert(parts, p) end
	for _, p in ipairs(ser(car)) do table.insert(parts, p) end
elseif what:sub(1, 5) == "site:" then
	local main
	for _, d in ipairs(game.ServerScriptService:GetDescendants()) do if d.Name == "Main" then main = d end end
	M.runScript(main)
	local Site = require(SS.SiteService)
	Site.load(what:sub(6), nil, nil)
	parts = ser(workspace.SteelriseSite)
	-- ground plate so the renderer shows the lot
	table.insert(parts, '{"cls":"Part","shape":"Block","mat":"Ground","size":[1400,0.2,1400],"cf":[0,-0.1,0,1,0,0,0,1,0,0,0,1],"color":[0.45,0.42,0.36],"tr":0}')
else
	local WF = require(SS.WorldFactory)
	local def = Sites.get(what).crane
	local m = WF.buildCrane(def, "1")
	parts = ser(m)
end
py_print("DUMP:" .. "[" .. table.concat(parts, ",") .. "]")
