-- Safe wrappers around the STEELRISE remotes.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Steelrise")
local Remotes = require(Shared.Remotes)
local State = require(script.Parent.State)

local Net = {}

-- Invokes a RemoteFunction; returns ok, message, data. Failures with a
-- message are shown as a warning toast unless `quiet`.
function Net.call(name, quiet, ...)
	local remote = Remotes.get(name)
	if not remote then
		return false, "Not connected."
	end
	local results = table.pack(pcall(remote.InvokeServer, remote, ...))
	if not results[1] then
		warn("[STEELRISE] remote", name, "failed:", results[2])
		if not quiet and State.notify then
			State.notify("Connection problem — try again.", "error")
		end
		return false, "Connection problem."
	end
	local ok, msg, data = results[2], results[3], results[4]
	if not ok and msg and not quiet and State.notify then
		State.notify(msg, "warn")
	elseif ok and msg and not quiet and State.notify then
		State.notify(msg, "success")
	end
	return ok, msg, data
end

function Net.event(name)
	return Remotes.get(name)
end

return Net
