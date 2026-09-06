# GTA V Winch

A winch for single-player GTA V. You pick two points — anywhere on a car, a ped,
a lamppost, or the ground — and a rope connects them. Then you reel it in, pull
with it, tow with it, or cut it. Tow trucks and flatbeds get a real bed lock:
winch a car up onto the deck and it straps down and drives away with you.

Built as a ScriptHookVDotNet 3 script. No trainer, no menu, no dependencies
beyond ScriptHookV and SHVDN.

## Controls

All rebindable in `WinchMod.ini`.

**Mouse first.** Press `J` to turn the winch on, then:

| Input | What it does |
| --- | --- |
| Left click | Set the first point, click again for the second |
| Right click | Cut the rope you are looking at |
| Mouse wheel | Spool in and out |
| `J` again | Turn the winch off |

While the winch is on it takes the mouse, so clicking hooks the rope instead of
firing your weapon and the wheel spools instead of switching weapons. A white
dot marks what you are aiming at, and once the first point is down a line
previews where the rope will go.

Everything is still on the keyboard too, and works whether the winch is on or
off:

| Key | What it does |
| --- | --- |
| `J` | Turn the winch on and off (sets the points directly if you set `MouseSelect = false`) |
| `K` | Cut the rope you are looking at (or clear a half-set point) |
| `Delete` | Cut every rope |
| `U` | Strap the load to a tow bed / release it |
| `Page Up` | Hold to reel in |
| `Page Down` | Hold to pay out |
| `End` | Reload the config without restarting the game |

Prefer the old keyboard-only flow? Set `MouseSelect = false` in the `[Mouse]`
section and `J` goes back to setting the two points itself.

No numpad needed — none of these collide with GTA V's own bindings. To change
them, put any `System.Windows.Forms` key name in the `[Keys]` section of the
ini: letters (`J`), F keys (`F7`), `NumPad0`-`NumPad9`, `PageUp`, `PageDown`,
`Home`, `End`, `Delete`, `OemOpenBrackets` (`[`), `OemMinus` (`-`) and so on.
Steer clear of `Insert` — ScriptHookVDotNet opens its own console with it.

The spool keys act on the line tied to the vehicle you are sitting in; on foot
they act on the line tied to you, otherwise the nearest one. Up to six lines can
be out at once, so you can bridle a load with two ropes and it behaves.

## Towing with it

1. Press `J` to turn the winch on, then click the back of your tow truck. Aim
   near a tow hook or a bumper and the point snaps to the hook.
2. Click the car you want. The rope appears between the exact two points you
   picked.
3. Drive. The car follows, swings in behind you through corners, and drags on
   its own tyres.
4. To load it: back the truck up to the car, roll the wheel (or hold `Page Up`)
   to winch it in, and once it is sitting on the deck it straps itself down.
   `U` releases it.
   Turn off `AutoLockToBed` in the ini if you would rather strap manually.

On foot the same rope works for anything else: anchor a car to a lamppost and
watch it rip the car around, drag a body, hang something off a bridge, tie two
cars together and let them fight it out.

## Why it does not behave like a rubber band

Most rope mods hand the job to `ATTACH_ENTITIES_TO_ROPE` and let the engine's
rope constraint do the towing. That constraint is soft and jittery, which is
where the springy, teleporting, car-flinging behaviour comes from.

Here the native rope is only the visual, and it is deliberately kept about 15%
longer than the winch length (`NativeSlack`) so it acts as a backstop and never
fights what the script is doing. The actual tow is a sequential-impulse
constraint solved every frame in `WinchLine.SolveConstraint`:

- **Slack does nothing.** While the ends are closer than the rope length there
  is no force at all — no phantom pull, no hum.
- **Taut is inelastic.** Once stretched, the solver computes the impulse that
  cancels the separating velocity along the rope, plus a capped Baumgarte term
  (`Beta`) that takes up the overstretch over several frames instead of in one.
- **Mass matters.** The impulse splits between the two ends by inverse mass, so
  a Phantom barely notices a Blista and the Blista gets yanked. Mass is
  estimated from the model's bounding volume, since the game will not hand a
  script a real mass — only the ratio between the ends matters, and the ratio
  is close.
- **Nothing explodes.** Every impulse is clamped so neither end can gain more
  than `MaxDeltaV` in a frame, which is what stops the classic launch-into-orbit
  moment when a rope goes taut at speed.
- **Loads rotate properly.** A share of the impulse (`TorqueAssist`) goes
  through `APPLY_FORCE_TO_ENTITY` at the real attach offset, so a car hooked by
  one corner yaws around that corner instead of sliding sideways. The rest goes
  straight into velocity so the constraint is guaranteed to hold.
- **No crushing.** Reeling in stops pulling once the ends are within
  `NoCrushDistance`, so the load parks against the truck instead of grinding.
- **Ropes can snap.** Past `BreakForce` the line breaks, so anchoring a Phantom
  to a bollard has a consequence.
- **The load actually rolls.** Once the line pulls, a driverless towed car has
  its handbrake released, so it rolls on its wheels instead of skidding on
  locked ones. A roped ped goes to ragdoll instead of skating along upright.
- **The load does not vanish.** Both ends are marked persistent while the rope
  is out, so the game will not stream your towed car away the moment you drive
  off. Cutting the line hands them back to the engine.

The bed lock is the same idea. Rather than teleporting the car onto the deck,
it attaches with the pose the car already has, then smoothstep-glides that pose
onto the resting pose over `BedSettleTime`, with collision between load and
truck switched off so the two do not fight. The result is a car that settles
onto the flatbed instead of snapping to it.

Fixed things stay fixed: hit a lamppost, a bollard or the ground and that end
becomes an infinite-mass anchor (a point on bare ground gets an invisible frozen
prop so the rope has something to hold). Set `TreatPropsAsAnchors = false` if
you would rather drag the street furniture around.

## Download

`dist/WinchMod-v1.0.zip` is the built mod, compiled from this source by the
`Build Winch Mod` GitHub Actions workflow. Unzip it and copy the `scripts`
folder into your GTA V directory so you end up with:

```
GTAV\scripts\WinchMod.dll
GTAV\scripts\WinchMod.ini
```

Every push to `src/` rebuilds it and commits a fresh `dist/WinchMod.dll`, so
the binary in the repo always matches the source next to it.

## Building it yourself

Requires the .NET SDK (or Visual Studio) targeting .NET Framework 4.8.

```
cd src
dotnet build -c Release
```

`ScriptHookVDotNet3` comes from NuGet, so nothing else needs to be on your
machine to compile.

## What you need installed first

- [ScriptHookV](http://www.dev-c.com/gtav/scripthookv/)
- [ScriptHookVDotNet 3](https://github.com/scripthookvdotnet/scripthookvdotnet/releases)
  (v3.6 or newer), which also needs .NET Framework 4.8

Both go in your GTA V folder. Then drop in `scripts\WinchMod.dll` and
`scripts\WinchMod.ini`, load a save, and the hint shows up bottom-left.

## When something goes wrong

The mod writes failures to `scripts\WinchMod.log` with the full stack trace,
and keeps running instead of letting ScriptHookVDotNet kill the script. If
anything misbehaves, that file says what and where.

## Tuning

If towing feels too loose, raise `Beta` toward 0.35. If it feels twitchy, lower
it toward 0.10 and raise `MaxDeltaV` slightly. If loads slide instead of
swinging in behind the truck, raise `TorqueAssist`. If heavy vehicles feel too
light, raise `VehicleDensity`.

Single-player only. This does not touch and is not meant for GTA Online.
