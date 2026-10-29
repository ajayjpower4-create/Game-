# STEELRISE audio slots

No audio is bundled and no asset IDs are invented. Every slot below is wired
into the game and stays silent until you add `rbxassetid://<id>` strings to
its `ids` list in `src/ReplicatedStorage/Steelrise/AudioRegistry.lua`.
Several ids in one list are picked at random per play (one-shot variation).

Use only audio your experience is permitted to play: your own uploads, or
Creator Store audio that is public/shared for use. After uploading, check the
asset's permissions so the experience can load it; the loading screen counts
and reports any id that fails to load and continues without it.

Mix groups (each has its own volume slider): Master, Machinery, Tools,
Impacts, Ambience, Footsteps, UI.

| Slot | Group | Type | Plays when | Suggested source |
|---|---|---|---|---|
| CraneSlewMotor | Machinery | loop, 3D | crane slewing (volume & pitch follow speed) | electric slewing gear whine/hum, 4–8 s seamless |
| CraneTrolleyMotor | Machinery | loop, 3D | trolley travelling | geared motor + wheel rumble |
| CraneHoistWinch | Machinery | loop, 3D | hoisting/lowering (at the winch drum) | winch drum + rope spooling |
| CraneBrake | Machinery | one-shot | a fast slew/trolley motion is released | brake clunk / thunk, 2–3 variations |
| CraneWarningHorn | Machinery | one-shot | reserved (overload / slew warning) | short horn |
| CableCreak | Machinery | one-shot | reserved (heavy sway) | wire rope creak |
| MetalContactHeavy | Impacts | one-shot | heavy load contacts structure | heavy steel clang, 3+ variations |
| MetalContactLight | Impacts | one-shot | hook or light piece contact | lighter clank |
| SteelSet | Impacts | one-shot | steel member landed/set | steel thud on steel |
| ConcreteSet | Impacts | one-shot | footing/concrete set | heavy concrete thump |
| SlingRattle | Impacts | one-shot | hooking / unhooking | chain/shackle rattle |
| StrapRelease | Impacts | one-shot | ratchet strap released | ratchet click + strap whip |
| ScaffoldClank | Impacts | one-shot | scaffold part placed | tube clank |
| PickUp | Impacts | one-shot | item picked up by hand | short gear rustle |
| ImpactWrench | Tools | one-shot | bolt tightened (≈0.6 s burst) | cordless 1" impact wrench rattle |
| HammerWedge | Tools | one-shot | wedge driven | hammer on steel |
| WeldArc | Tools | one-shot | weld made | stick-weld crackle, ~1 s |
| ConcretePour | Tools | one-shot | slab poured with the pump hose | pump surge + concrete slap, ~2 s |
| PowerTrowel | Tools | one-shot | slab finishing mark trowelled | power trowel / float scrape |
| TruckIdle | Machinery | loop, 3D | delivery truck present (louder while driving) | diesel idle |
| TruckAirBrake | Machinery | one-shot | truck stops/leaves | air-brake release |
| TruckReverseBeeper | Machinery | loop | reserved | back-up alarm |
| GeneratorLoop | Machinery | loop, 3D | generator / welder cart switched on | diesel genset drone |
| StepSteel | Footsteps | one-shot | walking on steel/metal | boot on steel |
| StepGrating | Footsteps | one-shot | walking on checker plate / scaffold planks | boot on grating |
| StepConcrete | Footsteps | one-shot | concrete, pavement, asphalt | boot on concrete |
| StepGravel | Footsteps | one-shot | slate/pebble gravel | boot on gravel |
| StepDirt | Footsteps | one-shot | dirt, mud, grass | boot on soil |
| StepWood | Footsteps | one-shot | timber/planks | boot on wood |
| WindLoop | Ambience | loop, 2D | always on site | low wind |
| WindHighLoop | Ambience | loop, 2D | fades in with camera height | gusty high-altitude wind |
| DistantConstruction | Ambience | loop, 2D | always on site | distant site activity bed |
| CityTraffic | Ambience | loop, 2D | Downtown / City Center / High-Rise | city traffic bed |
| Harbour | Ambience | loop, 2D | Waterfront | water lapping, gulls, distant horns |
| LoadingAmbience | Ambience | loop, 2D | loading screen | restrained industrial drone |
| UIClick | UI | one-shot | button press | soft click |
| UINotify | UI | one-shot | toast | soft chime |
| UIError | UI | one-shot | warning toast | low blip |
| UIConfirm | UI | one-shot | reserved | confirm |

Footsteps: once any `Step*` slot has an id, the custom system replaces the
default Roblox running sound (it is muted) and picks the sound by the floor
material under the character.

Suggested loudness: one-shots normalised to about −14 LUFS, loops to about
−20 LUFS; loops must be seamless. Mono for all 3D sounds.
