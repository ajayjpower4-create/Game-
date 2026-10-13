BUILDING DESIGN SIMULATOR — MODDING GUIDE
=========================================

This "mods" folder sits next to BuildingDesignSimulator.exe. The game reads it
every time it starts (or when you press F5 / Game > Reload). A second mods
folder in %APPDATA%\Building Design Simulator\mods works the same way; if a
setting is in both, the one next to the .exe wins.

Game > Open mods folder (in the menu bar) opens this folder.
View > Developer tools (F12) shows the console, where mods log errors.


1. MAX GRAPHICS: graphics.json
------------------------------

Rename "graphics.example.json" to "graphics.json" (or make your own) and the
game uses those settings on top of the quality preset — including values past
what the in-game Max preset allows. Lines that start with // are comments.

  "quality"        "low" | "medium" | "high" | "ultra" | "max"  — preset to start on
  "ss"             supersampling: 1 = screen resolution, 2 = render 2x wider and taller (0.5–3)
  "ratio"          cap on the pixel ratio after supersampling (0.5–4)
  "shadow"         sun shadow map size in pixels (512–16384; 16384 needs ~1 GB of video memory)
  "shadowSoftness" blur on shadow edges (0 = hard, 8 = very soft)
  "msaa"           multisample anti-aliasing samples (0–16)
  "smaa"           true for SMAA edge smoothing (use with msaa 0)
  "ao"             ambient occlusion (contact shadows) on/off
  "aoSamples"      ambient occlusion quality (4–64)
  "bloom"          glow around bright lights on/off
  "bloomStrength"  multiplier on the glow (0–4)
  "lights"         how many lamps really light the ground at night (0–32)
  "lampShadows"    how many of those cast shadows (0–16)
  "lampShadowSize" lamp shadow map size (256–4096)
  "aniso"          texture filtering (1–16)
  "sharpen"        image sharpening (0–1)
  "env"            reflection map size (64–2048)
  "clouds"         cloud shadows drifting over the ground (0 = off, 1 = normal, 2 = strong)
  "exposure"       brightness multiplier (0.2–4)
  "saturation"     colour multiplier (0 = black and white, 2 = vivid)
  "vignette"       dark corners (0–1)
  "fog"            haze multiplier (0 = crystal clear, 4 = murky)
  "viewDistance"   how far the camera draws, in feet (2000–60000)
  "fov"            camera field of view in degrees (20–100)
  "autoRes"        false stops the game lowering resolution when frames run slow
  "uncapFps"       true turns off vsync and the frame-rate cap (desktop only;
                   restart the game after changing it)

Mods win over the in-game Quality buttons. The World tab shows which settings
a mod is overriding, with a Reset button for the current session. If a setting
asks too much of your graphics card and the game won't show, rename or delete
graphics.json and press F5.


2. SCRIPT MODS: *.js
--------------------

Every .js file directly in this folder is loaded as a JavaScript module once
the game has started. The "examples" folder has three to copy up here.

A mod talks to the game through window.BuildingSim:

  BuildingSim.THREE          the three.js library
  BuildingSim.engine         renderer, camera, scene, sun, controls
  BuildingSim.world          the 3D models of the site
  BuildingSim.state          the site: lot, objects, weather, time of day
  BuildingSim.catalog        every building style and prop
  BuildingSim.refresh()      rebuild the 3D scene after changing state
  BuildingSim.commit()       save, rebuild and redraw the panels
  BuildingSim.select(id)     select an object
  BuildingSim.onTick(fn)     fn(dt) every frame
  BuildingSim.onChange(fn)   fn(state) after every edit
  BuildingSim.hint(text)     show a message at the bottom of the screen
  BuildingSim.graphics()     read the graphics settings in force
  BuildingSim.graphics({...})  change them (same keys as graphics.json)
  BuildingSim.graphics(null) clear every override

A mod that breaks shows "Mod failed to load" in the game and the reason in
the console (F12). Rename a file to end in .disabled to switch it off.


3. THE CONSOLE
--------------

Everything above also works by hand in the console (F12), and in the web
version of the game in your browser's console, e.g.

  BuildingSim.graphics({ quality: 'max', shadow: 16384, ss: 2 })
