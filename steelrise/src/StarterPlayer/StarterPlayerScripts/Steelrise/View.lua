-- First/third-person view switching and the shared aim ray.

local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")

local State = require(script.Parent.State)

local View = {}
local player = Players.LocalPlayer

function View.setFirstPerson(first)
	State.firstPerson = first
	if first then
		player.CameraMode = Enum.CameraMode.LockFirstPerson
	else
		player.CameraMode = Enum.CameraMode.Classic
		player.CameraMinZoomDistance = 12
		player.CameraMaxZoomDistance = 40
		task.delay(0.1, function()
			if not State.firstPerson then
				player.CameraMinZoomDistance = 4
			end
		end)
	end
end

function View.toggle()
	View.setFirstPerson(not State.firstPerson)
end

-- Ray from the crosshair (first person / locked mouse) or the mouse cursor.
function View.ray()
	local cam = workspace.CurrentCamera
	local pos
	if State.firstPerson or UserInputService.MouseBehavior == Enum.MouseBehavior.LockCenter then
		pos = cam.ViewportSize / 2
	else
		pos = UserInputService:GetMouseLocation()
	end
	local r = cam:ViewportPointToRay(pos.X, pos.Y)
	return r.Origin, r.Direction
end

local params = RaycastParams.new()
params.FilterType = Enum.RaycastFilterType.Exclude

function View.cast(maxDist, extraExclude)
	local origin, dir = View.ray()
	local exclude = { workspace.CurrentCamera }
	if player.Character then
		table.insert(exclude, player.Character)
	end
	for _, e in ipairs(extraExclude or {}) do
		table.insert(exclude, e)
	end
	params.FilterDescendantsInstances = exclude
	return workspace:Raycast(origin, dir * (maxDist or 60), params)
end

function View.rootPosition()
	local c = player.Character
	local hrp = c and c:FindFirstChild("HumanoidRootPart")
	return hrp and hrp.Position
end

return View
