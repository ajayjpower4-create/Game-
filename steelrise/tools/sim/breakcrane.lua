local M = M_RBX
M.isServer = true
-- simulate an engine that rejects some classes the crane uses
local realNew = Instance.new
Instance.new = function(cls, parent)
	if cls == "TrussPart" or cls == "SurfaceGui" then error("simulated engine rejection of " .. cls) end
	return realNew(cls, parent)
end
M.log = function(kind, name, a) if name == "Notify" then py_print("   notify: " .. tostring(a)) end end
local main
for _, d in ipairs(game.ServerScriptService:GetDescendants()) do if d.Name == "Main" then main = d end end
M.runScript(main)
local SS = game.ServerScriptService.Steelrise
local Site = require(SS.SiteService)
local Crane = require(SS.CraneService)
local Comp = require(SS.ComponentService)
local player = Instance.new("Player")
player.Name = "T"; player.UserId = 7; player.DisplayName = "T"
table.insert(M.players, player); player.Parent = game.Players
local ok, msg = Site.handle(player, "Start", "EmptyLand", "new", nil)
py_print("start " .. tostring(ok) .. " " .. tostring(msg))
local crane = workspace.SteelriseSite.Cranes:GetChildren()[1]
py_print("crane model: " .. tostring(crane and crane.Name) .. "  warnings: " .. tostring(crane and crane:GetAttribute("BuildWarnings")))
Comp.equip(player, "TL-REMOTE")
py_print("remote enter: " .. tostring((Crane.enter(player, "1", "Remote"))))
Crane.exit(player)
player.Character.HumanoidRootPart.CFrame = crane.Static.CraneAccess.CFrame
py_print("cab enter: " .. tostring((Crane.enter(player, "1", "Cab"))))
