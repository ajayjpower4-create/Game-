# Los Santos Towing — a GTA V single-player script mod

The call-and-delivery half of the Skyville tow truck game, moved into GTA V.
Clock on, dispatch rings, you drive out, hook it, chain it down, deliver it to a
garage and get paid. 160 written calls, nine kinds of work.

**It is a script and nothing else.** No map edits, no added vehicles, no
replaced files, no OpenIV. It uses GTA V's own tow trucks (`towtruck`,
`towtruck2`, `flatbed`), GTA V's own civilian cars for the casualties, and Los
Santos exactly as Rockstar shipped it. Everything it spawns, it also deletes.

Single player only. Do not use it in GTA Online.

## Installing

1. [ScriptHookV](http://www.dev-c.com/gtav/scripthookv/) — `ScriptHookV.dll` and
   `dinput8.dll` into the GTA V folder.
2. [ScriptHookVDotNet 3](https://github.com/scripthookvdotnet/scripthookvdotnet/releases)
   — `ScriptHookVDotNet.asi` and `ScriptHookVDotNet3.dll` into the GTA V folder.
   The mod is built against 3.6.0.
3. Copy `LosSantosTowing.dll` and `LosSantosTowing.ini` into `GTA V\scripts\`
   (create the folder if it is not there).
4. Start the game. Press **F5** to clock on.

Re-load scripts without restarting with **Insert** (SHVDN's reload key).

## Building it yourself

Needs the .NET SDK; it targets .NET Framework 4.8 and pulls
`ScriptHookVDotNet3` and the net48 reference assemblies from NuGet, so it builds
on Windows, macOS or Linux:

```bash
cd mods/gtav/LosSantosTowing
dotnet build -c Release
# -> bin/Release/LosSantosTowing.dll
```

## Playing it

| Key | |
| --- | --- |
| **F5** | clock on — fades you to the yard with a truck. Again to clock off |
| **Shift + M** | the towing menu |
| **Y** / **N** | accept or pass the call that is ringing |
| **E** | the context action — hook, chain, crank, drop. Hold it when the prompt says hold |
| **L** | amber lights: off → steady → slow flash |
| **F6** | have a stock tow truck sent out to you |
| **F11** | move the nearest drop-off to where you are standing |

### The menu

**Shift + M** opens it; arrow keys move, **Enter** picks, **Backspace** closes.
From there you can request a call instead of waiting for one, accept or turn
down the call that is ringing, drop the job you are on, cycle the amber lights,
have a truck brought to you, switch which truck the yard hands you, repair and
clean it, teleport to the yard or straight to the call, move the yard or a
drop-off to where you are standing, toggle the garage blips, and check what the
shift has earned so far.

A shift runs like this:

1. **F5** to clock on. The screen fades and you arrive at the yard with a tow
   truck beside you, keys in it. Grey blips appear on the eight drop-offs.
2. About a minute later dispatch calls: who it is, what happened, what it pays
   and which shop it goes to. **Y** takes it — or open the menu and request one
   right away rather than waiting.
3. The casualty spawns on a real street somewhere between 250 m and 1.4 km away,
   with a route blip. It is dressed to match the call — crumpled front end, flat
   tyres, on its roof, locked, dry tank, dead battery.
4. Work the checklist in the top-left. Most jobs are: back the truck up, **E**
   to hook, get out and chain the load down (four holds of **E**), then drive it
   to the green garage blip and **E** to drop it.
5. Roadside jobs finish on scene — lockouts, fuel drops and tyre changes never
   need the truck at all.

### The jobs

| Kind | What you actually do |
| --- | --- |
| Jump start | Grab the pack off your truck, pop the hood, hold **E** to clamp it on, hold **E** to crank. Then hook it, or just drive the customer's car in yourself — both count. |
| Tow / repo / parking enforcement | Hook, chain, deliver. |
| Collision | Same, with the car already wrecked. Rollovers get rolled back onto their wheels first. |
| Recovery | Same, off the road and awkward. |
| Lockout | Hold **E** at the door. No tow, straight fee. |
| Fuel delivery | Hold **E** at the tank. Some of them still need towing afterwards. |
| Tyre change | Hold **E** to get the flat off, again to fit the spare. |

Highway calls want two cones out before you start.

**Securing the load matters.** Drive off with fewer than four chains on and hard
braking or a fast corner can drop the car off the back — you re-hook it and lose
$60 off the ticket. Turn it off with `UnsecuredLoadsFall = False`.

Pay scales with how fast you finish, goes up 20% in rain, fog or snow, and comes
down for anything you crash into on the way.

### The amber lights

GTA V's tow trucks have no light bar, and this mod adds no models — so the ELS
runs on the truck's own hazards: **off**, **both on steady**, or the **slow
alternating wig-wag**. Same three modes as the browser game, same key habit.

### Drop-offs

Eight of them, at real garages: Los Santos Customs at Burton, La Mesa and the
airport, Benny's, Beeker's on Route 68, Paleto Bay, the Davis impound lot, and a
yard in Cypress Flats. The coordinates in the ini are a starting point — if a
marker sits in a wall or two feet off the forecourt, stand where you want it and
press **F11**. It rewrites that entry and keeps it.

## What did and did not come over from the browser game

**Came over:** all 160 calls (rewritten for Los Santos geography and GTA's own
vehicles), the nine job types and their step chains, the hook → secure → deliver
→ drop loop, the unsecured-load mechanic, cones on freeway calls, the roadside
fixes, the three-mode amber, and pay with speed, weather and damage factored in.

**Did not:** Skyville itself, the five custom rollbacks, the modelled cab
interior, the character creator and liveries. All of those are models and a map,
which is exactly what "no new assets, no map edits" rules out. If you want a
custom rollback with a working deck, that is a separate asset mod — an .yft
built in a 3D tool and installed through OpenIV — and this script will happily
tow with it, since it treats anything with a boom as a tow truck.

## Honest caveat

This was written and compile-checked against ScriptHookVDotNet 3.6.0, but it has
never been run inside GTA V — there is no copy of the game where it was built.
It is confirmed to load and run under RAGE Plugin Hook.
Every API and native it calls was verified to exist in the SHVDN assembly, and
the logic follows the same flow as the browser game it came from, but expect to
tune numbers in the ini (drop radii, garage coordinates) on your first shift,
and check `ScriptHookVDotNet.log` if a script errors out.

## Layout

| File | |
| --- | --- |
| `src/Calls.cs` | The 160 dispatch calls |
| `src/Steps.cs` | Which checklist each kind of call turns into |
| `src/Job.cs` | One live call: casualty, blips, progress, payout |
| `src/Rig.cs` | Hooking, unhooking, the amber lights, wrecking a car to order |
| `src/Garages.cs` | The eight drop-offs and the capture key |
| `src/Main.cs` | Dispatch timing, the interactions, delivery, the menu contents |
| `src/Menu.cs` | The menu itself, drawn with the game's own rect and text natives |
| `src/Yard.cs` | Clocking on at the yard: fade, teleport, truck |
| `src/Hud.cs` | Notifications, the checklist, prompts, markers |
| `src/Config.cs` | Everything in the ini |
