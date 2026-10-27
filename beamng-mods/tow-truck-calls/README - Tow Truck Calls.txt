TOW TRUCK CALLS for BeamNG.drive
================================
Tow calls come in over the radio at random. Accept one in the Tow Dispatch
app and a broken-down car is spawned on a road somewhere on the map. Drive
YOUR OWN tow truck there, load the car, win the strap-down minigames, tow it
anywhere you want, press DONE and get paid.

INSTALL
-------
1. Put TowTruckCalls.zip into your BeamNG "mods" folder. Do NOT unzip it.
   How to find the mods folder: start the BeamNG.drive launcher, click
   "Manage User Folder", then "Open in Explorer", then open "mods".
2. Start the game and load any map in Freeroam (or Career).
3. Add the app: press Esc > UI Apps > Add App, and add "Tow Dispatch"
   (it is in the Gameplay list). Drag it where you want it.

HOW TO PLAY
-----------
1. Get in your tow truck: any flatbed / rollback, wheel-lift tow truck,
   or a pickup or semi with a car trailer. Stock or modded, it works.
2. Calls come in every 30 to 75 seconds while you are ON DUTY. A radio
   pop-up shows at the top of the screen, and the call is listed in the
   Tow Dispatch app. Each call says what happened, which car, who called,
   how far away it is and what it pays. Calls run out after 2.5 minutes.
   Too slow? Press "ASK DISPATCH FOR WORK".
3. Press ACCEPT. The car is spawned on the shoulder of a road and the GPS
   arrows on the road lead you to it. An orange beacon marks the car.
4. On scene: load the car with your truck (bed, wheel lift, winch, push it
   on, whatever your truck can do). The car's parking brake is ON. If you
   need it to roll (wheel lift, winch), press "CAR BRAKE" in the app.
5. When the car is on your truck and you are stopped, the strap minigame
   pops up on its own (or press STRAP DOWN). Four straps, one per wheel:
     HOOK IT  - click when the swinging hook is over the green slot
     RATCHET  - click when the needle is in the green, 4 times
     TENSION  - hold the mouse button to crank, let go in the green band
   Misses lower your strap quality, and that changes your pay.
   You can close it and come back. It pauses if the truck moves.
6. Tow it ANYWHERE on the map (at least about 330 ft from where you picked
   it up). If the car comes off while you drive, you have to load it and
   strap it again, and it costs you.
7. Stop and press DONE. Boom: the car is dropped off, you get paid, and
   the next call comes in. You can unload the car first if you like, as
   long as it is next to your truck.

PAY
---
  Call price        $100 - $270 depending on the call
  Mileage           $25 a mile you towed it
  Fast response     +$25 if you got there in 2 minutes, +$10 in 4
  Straps            up to +25% for perfect straps, less for sloppy ones
  Came loose        -20% of the call price each time
  Damage            if you wreck the customer's car on the way, you pay
Your bank, jobs done and miles towed are saved in your user folder:
settings/towTruckCalls.json
In Career mode the money goes into your career account.

CALL TYPES
----------
Breakdown, Flat tire (tire really is flat), Out of gas (tank really is
empty), Dead battery, Accident (two flat tires), Police impound,
Repossession, Abandoned car. Broken-down cars sit with the hazards on.

CONSOLE (~ key)
---------------
  towTruckCalls.requestCall()     -- get a call right now
  towTruckCalls.toggleDuty()      -- on / off duty
  towTruckCalls.cancel()          -- cancel the job you have
  towTruckCalls.resetStats()      -- bank and jobs back to 0

NOTES
-----
- No calls come in during scenarios or missions.
- You get one job at a time. Cancelling removes the car.
- Off duty = no new calls.

UNINSTALL
---------
Turn it off in the in-game Mods menu, or delete TowTruckCalls.zip from the
mods folder.

NOTHING HAPPENS?
----------------
- Check the mod is turned on in the Mods menu and the app says ON DUTY.
- The app must be added (Esc > UI Apps > Add App > Tow Dispatch).
- Press "ASK DISPATCH FOR WORK". If no call shows, open the console (~)
  and look for lines that start with "towTruckCalls".
