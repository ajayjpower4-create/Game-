SCREECHING BRAKES for BeamNG.drive
==================================
Adds a car tire screech and a truck air-brake screech that you can put on
ANY vehicle: stock cars, trucks and modded vehicles.

INSTALL
-------
1. Put ScreechingBrakes.zip into your BeamNG "mods" folder. Do NOT unzip it.
   How to find the mods folder: start the BeamNG.drive launcher, click
   "Manage User Folder", then "Open in Explorer", then open "mods".
2. Start the game. The mod is on right away. Every vehicle you drive
   screeches when you brake (the car sound by default).

PICK THE CAR OR TRUCK SOUND
---------------------------
Option 1: the in-game app (easiest)
  - Open the UI Apps menu (Esc > UI Apps > Add App) and add "Screeching Brakes".
  - "This vehicle": pick Car, Truck, Auto or Off for the vehicle you are
    driving. It is remembered for that vehicle from then on, even modded ones.
  - "Default for every other vehicle": the sound for vehicles you have not
    picked one for.
  - Auto = truck sound for heavy vehicles (5 tons and up), car sound for the rest.
  - Volume, and "Starts at" = how hard you need to press the brake.
  - "AI and traffic vehicles screech too" lets the other cars on the road screech.
  - "Test car" / "Test truck" play the sound once.

Option 2: keyboard keys
  Options > Controls > Bindings, search for "Screeching", and set keys for:
    Screeching Brakes: On / Off
    Screeching Brakes: Car / Truck / Off   (switches the vehicle you drive)
    Screeching Brakes: Test sound

Option 3: the console (~ key)
  screechingBrakes.setVehicleSound("truck")    -- "car", "truck", "auto", "off" or "default"
  screechingBrakes.setDefaultSound("car")
  screechingBrakes.toggleEnabled()

Settings are saved in your user folder: settings/screechingBrakes.json

HOW IT SOUNDS
-------------
Car:   tires screech when you brake hard. Louder the harder you brake and
       the faster you go.
Truck: high air-brake squeal that keeps going until you stop.

UNINSTALL
---------
Turn it off in the in-game Mods menu, or delete ScreechingBrakes.zip from
the mods folder.

NO SOUND?
---------
- Check that the mod is turned on in the Mods menu and that the app says ON.
- Press "Test car" in the app. If you hear nothing, open the console (~)
  and look for lines that start with "screechingBrakes". Those tell you what
  went wrong.
