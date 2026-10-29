local R = require(game.ReplicatedStorage.Steelrise.ItemRegistry)
local c = R.count()
local cats = {}
for _, d in ipairs(R.list) do cats[d.category] = (cats[d.category] or 0) + 1 end
py_print("total=" .. c.total .. " installable=" .. tostring(c.Installable) .. " equipment=" .. tostring(c.Equipment) .. " decorative=" .. tostring(c.Decorative) .. " tool=" .. tostring(c.Tool))
for _, k in ipairs(R.Categories) do py_print("  " .. k .. ": " .. tostring(cats[k])) end
-- build every item once to make sure each has a working model
local Factory = require(game.ReplicatedStorage.Steelrise.ModelFactory)
local bad = 0
for _, d in ipairs(R.list) do
	local bb = Factory.Builder.new(Instance.new("Model")); bb.opts = { installed = true }; local ok, err = pcall(d.build, bb, d, bb.opts)
	if not ok then bad = bad + 1; py_print("BUILD FAIL " .. d.id .. ": " .. tostring(err)) end
end
py_print("build failures: " .. bad)
