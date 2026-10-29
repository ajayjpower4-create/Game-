-- Client-side shared state and a tiny event bus between controllers.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Steelrise")
local Config = require(Shared.Config)
local Util = require(Shared.Util)

local State = {
	mode = "Loading", -- Loading | Menu | Play
	settings = Util.deepCopy(Config.DefaultSettings),
	favorites = {},
	menuInfo = nil,
	site = nil, -- workspace.SteelriseSite
	siteDef = nil,
	world = nil, -- BuildRules world
	tool = "TL-HANDS",
	carrying = nil,
	firstPerson = true,
	uiBlocking = false, -- catalog / pause menu open
	crane = { operating = false, id = nil, mode = nil, view = "Cab", assist = true },
	tutorialActive = false,
	lastStartMode = nil,
}

local handlers = {}

function State.on(name, fn)
	handlers[name] = handlers[name] or {}
	table.insert(handlers[name], fn)
end

function State.fire(name, ...)
	for _, fn in ipairs(handlers[name] or {}) do
		task.spawn(fn, ...)
	end
end

return State
