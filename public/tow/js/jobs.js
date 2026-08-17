// Dispatch. Over a hundred hand-written calls, the step chain each one turns
// into, and the runner that tracks where you are in it.
import { makeRng } from './util.js';

/* -------------------------------------------------------------- the scenes */
// [id, vehicle, type, where, basePay, caller, dispatch line, extras?]
const S = (id, vehicle, type, where, pay, caller, text, extras = {}) =>
  ({ id, vehicle, type, where, pay, caller, text, ...extras });

export const SCENES = [
  /* ---- dead batteries and jump starts ---- */
  S('jump_civia_bagel', 'civia', 'jump', 'street', 95, 'Dana R.', 'Silver Civia, dead battery outside the bagel place on Front Street. She left the dome light on all night.', { shop: 'delgado' }),
  S('jump_accolade_lot', 'accolade', 'jump', 'street', 90, 'Marcus T.', 'Kestrel Accolade in a metered spot, turns over once and quits. Wants it jumped and hauled before the meter runs.', {}),
  S('jump_corsair_office', 'corsair', 'jump', 'street', 110, 'Priya S.', 'Meridian Corsair, five years on the same battery. Dead in the office lot, she has a flight at six.', { shop: 'meridian' }),
  S('jump_cab_shift', 'cab', 'jump', 'street', 120, 'Yellow Cab #414', 'Cab died mid-shift. Driver says the alternator light has been on for a week. Jump it and take it in.', { shop: 'harborpoint' }),
  S('jump_ranger_cold', 'ranger', 'jump', 'street', 130, 'Ed K.', 'Bricktown Ranger will not crank. Cold soak overnight, no lights at all on the dash.', {}),
  S('jump_sprite_school', 'sprite', 'jump', 'street', 88, 'Ms. Halloran', 'Kestrel Sprite dead in the school pickup line. Everyone is honking at her. Please hurry.', { shop: 'delgado' }),
  S('jump_pip_alley', 'pip', 'jump', 'street', 84, 'Sung-min P.', 'Little Nomura Pip wedged in an alley off Cannery Row, battery flat. Tight space, watch your mirrors.', {}),
  S('jump_voyage_soccer', 'voyage', 'jump', 'street', 105, 'Coach Bianchi', 'Minivan full of soccer gear, no crank. Kids are fine, the van is not.', { shop: 'northgate' }),
  S('jump_estate_dog', 'estate', 'jump', 'street', 100, 'Renata V.', 'Volan Estate dead outside the dog park. She swears it started fine this morning.', {}),
  S('jump_trek_jobsite', 'trek', 'jump', 'street', 115, 'Sal from Ironbridge', 'Nomura Trek at a job site, ran the winch off the battery all day. Jump and haul.', { shop: 'ironbridge' }),
  S('jump_interceptor', 'interceptor', 'jump', 'street', 165, 'SPD Fleet', 'Unit 22 down with a dead battery. Fleet wants it jumped and brought to their contract shop.', { shop: 'meridian' }),
  S('jump_regal_funeral', 'regal', 'jump', 'street', 135, 'Mr. Okonjo', 'Brookvale Regal, 1980s barge, dead outside a funeral home. Owner is very particular about the paint.', { shop: 'delgado' }),

  /* ---- dead cars, straight flatbed loads ---- */
  S('dead_fairlane_starter', 'fairlane', 'flatbed', 'street', 145, 'Bea L.', 'Fairlane LX, starter is gone — jump box will not touch it. Straight winch job.', { shop: 'delgado' }),
  S('dead_volans40_timing', 'volans40', 'flatbed', 'street', 150, 'Tomas H.', 'Volan S40 lost the timing belt on Union Street. Do not try to crank it, just load it.', { shop: 'harborpoint' }),
  S('dead_rove_trans', 'rove', 'flatbed', 'street', 160, 'Angela D.', 'Nomura Rove will not select a gear. Transmission shop wants it on the deck, not dragged.', { shop: 'lakeside' }),
  S('dead_cascade_overheat', 'cascade', 'flatbed', 'street', 155, 'Kwame A.', 'Cascade Sport blew the upper hose, steam everywhere. Let it cool, then load it.', { shop: 'meridian' }),
  S('dead_vantorra_clutch', 'vantorra', 'flatbed', 'street', 195, 'Nico B.', 'Vantorra GT, clutch pedal on the floor. Low car — take it slow on the approach angle.', { shop: 'harborpoint' }),
  S('dead_veloce_lowclear', 'veloce', 'flatbed', 'street', 320, 'Mr. Ashford', 'Apex Veloce. Four inches of ground clearance and a very nervous owner. Do not scrape it.', { shop: 'harborpoint' }),
  S('dead_makoz3_belt', 'makoz3', 'flatbed', 'street', 175, 'Julie F.', 'Mako Z3 threw the serpentine belt. Steering went heavy, she pulled into a bus stop.', {}),
  S('dead_fury_fuelpump', 'fury', 'flatbed', 'street', 185, 'Ray "Duke" M.', 'Bronson Fury, fuel pump quit at the light. Owner is standing on the corner with the keys.', { shop: 'meridian' }),
  S('dead_diplomat_electrical', 'diplomat', 'flatbed', 'street', 180, 'Carla J.', 'Diplomat R/T, complete electrical failure. Wipers came on by themselves and then nothing.', {}),
  S('dead_solstice_topdown', 'solstice', 'flatbed', 'street', 170, 'Fiona G.', 'Solstice Roadster stalled with the top down and it is going to rain. Load it before it gets soaked.', { shop: 'delgado' }),
  S('dead_summit_alternator', 'summit', 'flatbed', 'street', 190, 'The Voss family', 'Summit XL, alternator cooked. Big SUV, use the long straps.', { shop: 'northgate' }),
  S('dead_trailmark_axle', 'trailmark', 'flatbed', 'street', 200, 'Peter O.', 'Trailmark wagon making a grinding noise from the front left. Sounds like a CV joint letting go.', { shop: 'delgado' }),
  S('dead_landmaster_starter', 'landmaster', 'flatbed', 'street', 210, 'Hank R.', 'Landmaster 90, old and stubborn. Starter clicks, nothing more. He wants it at the 4x4 shop.', { shop: 'ironbridge' }),
  S('dead_workhorse_barn', 'workhorse', 'flatbed', 'street', 165, 'June P.', 'Fairlane Workhorse pickup, has not run since spring. Tires hold air, brakes do not.', { shop: 'ironbridge' }),
  S('dead_haul150_diesel', 'haul150', 'flatbed', 'street', 230, 'Contractor — Bo', 'Haul 150 with a fuel issue, loaded with tools. Heavier than it looks.', { shop: 'ironbridge' }),
  S('dead_cargo250_fleet', 'cargo250', 'flatbed', 'street', 245, 'Fleet dispatch', 'Cargo 250 van dead on route. Fleet says take it to their contract shop, keys under the mat.', { shop: 'route9' }),
  S('dead_parcel_route', 'parcel', 'flatbed', 'street', 255, 'Parcel Post', 'Delivery van died mid-route, packages still inside. Driver stays with the load.', { shop: 'route9' }),
  S('dead_stretch_prom', 'stretch', 'flatbed', 'street', 340, 'Elite Limo', 'Brookvale Stretch broke down with a prom party inside. Long car — you will need the whole deck.', { shop: 'meridian' }),
  S('dead_shuttle_route', 'shuttle', 'flatbed', 'street', 380, 'Transit Authority', 'Shuttle bus down at a stop. Air system dumped. Heavy truck job, take the big rollback if you have it.', { shop: 'route9' }),
  S('dead_sundae_summer', 'sundae', 'flatbed', 'street', 220, 'Sundae Cruiser', 'Ice cream truck quit with a freezer full of inventory. The jingle is still playing. It will not stop.', { shop: 'route9' }),

  /* ---- collisions ---- */
  S('crash_fender_meridian', 'corsair', 'crash', 'street', 240, 'SPD Traffic', 'Fender bender at Meridian and 4th. Corsair took the hit up front, not drivable. Radiator is down.', { damage: 'front', shop: 'meridian' }),
  S('crash_rearend_light', 'civia', 'crash', 'street', 225, 'SPD Traffic', 'Rear-ender at the light. Civia got sandwiched, trunk is folded, wheels still roll.', { damage: 'rear', shop: 'meridian' }),
  S('crash_tbone_union', 'ranger', 'crash', 'street', 285, 'SPD Traffic', 'T-bone at Union Street. Ranger caught it in the driver door. Occupants out and walking.', { damage: 'side', shop: 'meridian' }),
  S('crash_rollover_ramp', 'rove', 'crash', 'highway', 420, 'State Police', 'Rollover on the Exit 3 ramp. Vehicle is on its side, lane is closed. Cones out before you touch anything.', { damage: 'rollover', shop: 'meridian', cones: true }),
  S('crash_pileup_beltway', 'accolade', 'crash', 'highway', 360, 'State Police', 'Three-car pileup on the beltway, we need the little one off the shoulder first. Traffic is live.', { damage: 'front', cones: true, shop: 'meridian' }),
  S('crash_guardrail', 'sprite', 'crash', 'highway', 330, 'State Police', 'Sprite kissed the guardrail at Exit 6. Front left is folded into the tire. Will not roll straight.', { damage: 'front', flats: ['FL'], cones: true }),
  S('crash_intersection_cab', 'cab', 'crash', 'street', 260, 'SPD Traffic', 'Cab and a delivery van tangled downtown. Cab is ours, van has its own service.', { damage: 'side', shop: 'harborpoint' }),
  S('crash_parkinglot_low', 'volans40', 'crash', 'lot', 195, 'Northgate Mall security', 'Low-speed hit in the mall lot. Bumper is hanging and dragging. Owner just wants it gone.', { damage: 'front', shop: 'northgate' }),
  S('crash_curb_strike', 'estate', 'crash', 'street', 230, 'Amara Q.', 'Hit a curb hard avoiding a dog. Wheel is bent in, car pulls hard right. Not drivable.', { damage: 'front', flats: ['FR'], shop: 'delgado' }),
  S('crash_deer_beltway', 'trailmark', 'crash', 'highway', 315, 'State Police', 'Deer strike on the beltway. Hood is up over the windshield, radiator gone. No injuries.', { damage: 'front', cones: true, shop: 'meridian' }),
  S('crash_hydrant', 'diplomat', 'crash', 'street', 300, 'SPD Traffic', 'Driver took out a hydrant on Prospect. Water is off now. Front end is soaked and folded.', { damage: 'front', shop: 'meridian' }),
  S('crash_pole_night', 'fury', 'crash', 'street', 340, 'SPD Traffic', 'Muscle car versus light pole. Pole won. Driver is being checked out, car goes to collision.', { damage: 'front', shop: 'meridian' }),
  S('crash_backedinto', 'summit', 'crash', 'lot', 210, 'Grocery manager', 'Somebody backed into a Summit and left. Rear quarter is caved, tailgate will not close.', { damage: 'rear', shop: 'meridian' }),
  S('crash_van_dock', 'cargo250', 'crash', 'street', 290, 'Warehouse foreman', 'Van rolled off the dock lip. Rear is sitting low and the frame looks tweaked.', { damage: 'rear', shop: 'ironbridge' }),
  S('crash_boxtruck_bridge', 'box450', 'crash', 'street', 480, 'SPD Traffic', 'Box truck met a low bridge on Ironbridge. Roof peeled back. It is heavy — bring the big deck.', { damage: 'front', shop: 'route9', heavy: true }),
  S('crash_taxi_rear', 'cab', 'crash', 'street', 245, 'Yellow Cab #207', 'Cab rear-ended at a crosswalk. Trunk is accordioned, both rear tires rub.', { damage: 'rear', flats: ['RL'], shop: 'harborpoint' }),
  S('crash_multi_ramp', 'trek', 'crash', 'highway', 350, 'State Police', 'Pickup spun on the wet ramp and hit the barrier backwards. Shoulder is narrow, be careful.', { damage: 'rear', cones: true, shop: 'route9' }),
  S('crash_side_alley', 'pip', 'crash', 'street', 190, 'Roshan D.', 'Somebody clipped the Pip in an alley and took the mirror and the door with them.', { damage: 'side', shop: 'delgado' }),
  S('crash_bike_down', 'ravello', 'crash', 'street', 260, 'SPD Traffic', 'Motorcycle down at an intersection. Rider is up and angry. Bike needs to go on the deck, gently.', { damage: 'side', shop: 'harborpoint' }),
  S('crash_rollover_ditch', 'landmaster', 'crash', 'street', 430, 'County Sheriff', 'Old 4x4 on its side in the ditch off Lakeside. Winch it upright and load it.', { damage: 'rollover', shop: 'ironbridge' }),

  /* ---- recoveries and winch-outs ---- */
  S('winch_ditch_snow', 'ranger', 'winchout', 'street', 280, 'Doug W.', 'Slid off into the ditch on the shoulder. Not damaged, just stuck to the axles.', { shop: 'northgate' }),
  S('winch_mud_lot', 'trailhawk', 'winchout', 'lot', 260, 'Site foreman', 'Trailhawk buried to the frame in a muddy lot. Owner already tried to drive it out. Twice.', { shop: 'ironbridge' }),
  S('winch_curb_hung', 'veloce', 'winchout', 'street', 340, 'Mr. Ashford', 'Exotic hung up on a kerb, both front wheels off the ground. Do not tow it forward, lift it.', { shop: 'harborpoint' }),
  S('winch_beach_ramp', 'haul150', 'winchout', 'street', 300, 'Marina office', 'Truck and trailer got stuck on the boat ramp. Trailer is off — just the truck.', { shop: 'route9' }),
  S('winch_snowbank', 'voyage', 'winchout', 'street', 250, 'Nadia K.', 'Plow buried her minivan in a snowbank overnight. Dig, hook, and pull.', { shop: 'northgate' }),
  S('winch_garage_stuck', 'stretch', 'winchout', 'lot', 380, 'Parking garage manager', 'Limo wedged on a garage ramp, cannot go forward or back. Very tight overhead.', { shop: 'meridian' }),
  S('winch_offroad_trail', 'landmaster', 'winchout', 'street', 320, 'Trail club', 'Landmaster off the fire road, high-centred on a rock. Long pull, watch your angle.', { shop: 'ironbridge' }),
  S('winch_flood_underpass', 'corsair', 'winchout', 'street', 290, 'SPD Traffic', 'Driver went through the flooded underpass. Water is down, car is dead and full of mud.', { shop: 'meridian' }),
  S('winch_construction', 'crest2500', 'winchout', 'street', 360, 'Site foreman', 'Heavy pickup dropped a rear wheel into a trench. Careful with the frame, it is a new truck.', { shop: 'ironbridge', heavy: true }),
  S('winch_median', 'cascade', 'winchout', 'highway', 330, 'State Police', 'Crossover in the median on the beltway. Cones first — traffic is not slowing down.', { cones: true, shop: 'meridian' }),

  /* ---- lockouts (no tow) ---- */
  S('lock_keys_trunk', 'corsair', 'lockout', 'street', 75, 'Mei L.', 'Keys locked in the trunk with the groceries. She is very calm about it, which is unusual.', { noTow: true }),
  S('lock_running_car', 'summit', 'lockout', 'lot', 85, 'Trevor S.', 'Locked out with the engine running and the dog inside. Dog is fine. Trevor is not.', { noTow: true }),
  S('lock_gas_station', 'sprite', 'lockout', 'street', 70, 'Ola A.', 'Locked out at the pumps, blocking the island. Station wants it moved either way.', { noTow: true }),
  S('lock_hospital', 'voyage', 'lockout', 'lot', 80, 'Nurse Ramirez', 'Locked out at the end of a double shift. Please be quick, she is asleep on her feet.', { noTow: true }),
  S('lock_beach', 'estate', 'lockout', 'street', 78, 'The Halvorsens', 'Keys locked in, kids in swimsuits, meter about to expire. Classic Saturday.', { noTow: true }),
  S('lock_work_van', 'cargo250', 'lockout', 'street', 95, 'Plumber — Nate', 'Work van locked with the motor running and every tool he owns inside.', { noTow: true }),
  S('lock_cab_fare', 'cab', 'lockout', 'street', 90, 'Yellow Cab #118', 'Cabbie locked himself out at a fare pickup. Meter is still running, apparently.', { noTow: true }),
  S('lock_interceptor', 'interceptor', 'lockout', 'street', 110, 'SPD Fleet', 'Officer locked the keys in the cruiser. Do not tell anyone. That is part of the fee.', { noTow: true }),

  /* ---- tires ---- */
  S('tire_flat_beltway', 'civia', 'tire', 'highway', 140, 'Sanjay P.', 'Flat right front on the beltway shoulder. No spare in the trunk. Change it or haul it.', { flats: ['FR'], cones: true, shop: 'northgate' }),
  S('tire_blowout_rear', 'corsair', 'tire', 'highway', 160, 'Grace N.', 'Rear blowout at speed, shredded down to the belt. She is shaken but fine.', { flats: ['RL'], cones: true, shop: 'northgate' }),
  S('tire_two_flats', 'accolade', 'tire', 'street', 175, 'Owen B.', 'Hit the same pothole twice, somehow. Both passenger side tires are flat.', { flats: ['FR', 'RR'], shop: 'northgate' }),
  S('tire_locked_lugs', 'rove', 'tire', 'street', 155, 'Delia M.', 'Flat tire, locking lug nut key is missing. Bring the impact wrench and your patience.', { flats: ['FL'], shop: 'northgate' }),
  S('tire_curbrash', 'makoz3', 'tire', 'street', 165, 'Ivan T.', 'Sidewall gash from a kerb. Low profile tire, wheel might be bent too.', { flats: ['FL'], shop: 'harborpoint' }),
  S('tire_dually_truck', 'crest2500', 'tire', 'street', 210, 'Hauler — Fitz', 'Inside dually is flat on a loaded pickup. Heavy work, take your time.', { flats: ['RR'], shop: 'route9', heavy: true }),
  S('tire_school_run', 'voyage', 'tire', 'street', 145, 'Bridget C.', 'Flat in the school pickup lane. Four kids, one spare, no jack.', { flats: ['RL'], shop: 'northgate' }),
  S('tire_bike_rear', 'ravello', 'tire', 'street', 130, 'Rider — Kai', 'Rear tire down on a motorcycle. It has to go on the deck, it will not roll far.', { flats: ['RL'], shop: 'harborpoint' }),
  S('tire_slashed_lot', 'diplomat', 'tire', 'lot', 190, 'Lot attendant', 'Two tires slashed overnight in the lot. Owner wants it towed, not patched.', { flats: ['FL', 'RL'], shop: 'meridian' }),
  S('tire_shoulder_night', 'estate', 'tire', 'highway', 175, 'Marta E.', 'Flat on the shoulder after dark. She is standing well off the road. Light it up before you get out.', { flats: ['RR'], cones: true, shop: 'northgate' }),

  /* ---- out of fuel ---- */
  S('fuel_beltway', 'civia', 'fuel', 'highway', 85, 'Jamie L.', 'Ran it dry on the beltway. Gauge has been broken for a year. Two gallons should do it.', { noTow: true, cones: true }),
  S('fuel_diesel_wrong', 'haul150', 'fuel', 'street', 160, 'Contractor — Bo', 'Put gasoline in the diesel. It ran for a mile and quit. This one gets towed.', { shop: 'ironbridge' }),
  S('fuel_empty_lot', 'fairlane', 'fuel', 'lot', 90, 'Hal W.', 'Out of gas in the grocery lot, cart still full. Bring the can.', { noTow: true }),
  S('fuel_bridge', 'cab', 'fuel', 'street', 95, 'Yellow Cab #302', 'Cab out of fuel on the bridge approach. Blocking a lane, so make it fast.', { noTow: true, cones: true }),
  S('fuel_night_shift', 'trek', 'fuel', 'street', 100, 'Reggie D.', 'Ran dry heading home from third shift. Half a mile from the station, of course.', { noTow: true }),
  S('fuel_delivery_van', 'parcel', 'fuel', 'street', 120, 'Parcel Post', 'Delivery van dry with forty stops left. Fuel it and they will handle the rest.', { noTow: true }),

  /* ---- repossessions and impounds ---- */
  S('repo_quiet_street', 'diplomat', 'repo', 'street', 300, 'Skyville Credit Union', 'Recovery order. Silver Diplomat, six payments behind. Owner is not home. Be quick and be quiet.', { shop: 'impound', quiet: true }),
  S('repo_apartment_lot', 'rove', 'repo', 'lot', 280, 'Harbor Financial', 'Repo in an apartment lot. Do not block anyone in, and do not make a scene.', { shop: 'impound', quiet: true }),
  S('repo_night_driveway', 'summit', 'repo', 'street', 340, 'Northgate Lending', 'Voluntary surrender that stopped being voluntary. Keys are not coming. Winch it.', { shop: 'impound', quiet: true }),
  S('repo_workvan', 'cargo250', 'repo', 'street', 320, 'Fleet Leasing', 'Lease default on a work van. Tools inside stay with the van, per the order.', { shop: 'impound', quiet: true }),
  S('impound_expired', 'accolade', 'illegal', 'street', 180, 'Parking Authority', 'Expired registration, eleven months. Tagged and ready for the impound lot.', { shop: 'impound' }),
  S('impound_firelane', 'summit', 'illegal', 'lot', 200, 'Fire Marshal', 'Parked across a fire lane at the mall. Marshal is standing there waiting for you.', { shop: 'impound' }),
  S('impound_hydrant', 'vantorra', 'illegal', 'street', 210, 'Parking Authority', 'Sports car parked on a hydrant. Owner has four unpaid tickets. Take it in.', { shop: 'impound' }),
  S('impound_handicap', 'fury', 'illegal', 'lot', 195, 'Parking Authority', 'No permit in a handicap space, third time this month. They want it gone.', { shop: 'impound' }),
  S('impound_snowroute', 'estate', 'illegal', 'street', 185, 'Parking Authority', 'Parked on a declared snow route. Plow cannot get through until it moves.', { shop: 'impound' }),
  S('impound_abandoned', 'rustbucket', 'illegal', 'street', 165, 'Parking Authority', 'Abandoned for three weeks, flat tires and a broken window. Nobody is coming for it.', { shop: 'impound', flats: ['FL', 'RR'], damage: 'side' }),
  S('impound_alley_block', 'box450', 'illegal', 'street', 260, 'Business owner', 'Box truck blocking an alley behind a restaurant. Deliveries cannot get in.', { shop: 'impound', heavy: true }),
  S('impound_meter_marathon', 'pip', 'illegal', 'street', 150, 'Parking Authority', 'Same meter for nine days. Even the meter maid feels bad about it.', { shop: 'impound' }),
  S('impound_loadingzone', 'voyage', 'illegal', 'street', 175, 'Parking Authority', 'Minivan in a loading zone at the peak of lunch rush. Take it to the lot.', { shop: 'impound' }),
  S('impound_bike_walk', 'ravello', 'illegal', 'street', 140, 'Parking Authority', 'Motorcycle chained to a bike rack on the sidewalk. Bolt cutters are in the box.', { shop: 'impound' }),

  /* ---- highway and heavy work ---- */
  S('hwy_stall_lane', 'fairlane', 'flatbed', 'highway', 260, 'State Police', 'Stalled in the right lane of the beltway. This is a live lane — cones and amber before you step out.', { cones: true, shop: 'meridian' }),
  S('hwy_shoulder_overheat', 'summit', 'flatbed', 'highway', 245, 'Rina P.', 'Overheated on the shoulder past Exit 2. Temp needle buried, she shut it off in time.', { cones: true, shop: 'northgate' }),
  S('hwy_blown_engine', 'fury', 'flatbed', 'highway', 300, 'Duke M.', 'Big noise, big smoke, then nothing. Oil all over the shoulder. Bring the absorbent.', { cones: true, shop: 'meridian' }),
  S('hwy_trailer_less', 'crest2500', 'flatbed', 'highway', 340, 'Hauler — Fitz', 'Heavy pickup down on the beltway, trailer already recovered. Just the truck now.', { cones: true, shop: 'route9', heavy: true }),
  S('hwy_box_breakdown', 'box450', 'flatbed', 'highway', 460, 'Fleet dispatch', 'Box truck dead on the beltway deck. Full load. This needs the heavy rollback.', { cones: true, shop: 'route9', heavy: true }),
  S('hwy_shuttle_down', 'shuttle', 'flatbed', 'highway', 520, 'Transit Authority', 'Shuttle down in a live lane with passengers aboard. Police are on scene holding traffic.', { cones: true, shop: 'route9', heavy: true }),
  S('hwy_ramp_stall', 'sprite', 'flatbed', 'highway', 210, 'Ari W.', 'Stalled halfway up the Exit 5 ramp. Rolling backwards is a real risk here. Chock it.', { cones: true, shop: 'delgado' }),
  S('hwy_debris_damage', 'volans40', 'flatbed', 'highway', 265, 'State Police', 'Ran over a ladder on the beltway. Undercarriage is torn up, fluid trail behind it.', { cones: true, damage: 'front', shop: 'meridian' }),

  /* ---- specialty and odd calls ---- */
  S('odd_wrong_fuel_lot', 'rove', 'flatbed', 'lot', 190, 'Station manager', 'Customer filled a gas crossover with diesel and drove it forty feet. Now it is ours.', { shop: 'lakeside' }),
  S('odd_car_in_pool', 'accolade', 'winchout', 'lot', 420, 'Homeowner — Vic', 'Car rolled through a fence and into a drained pool. Yes, really. Long winch, awkward angle.', { damage: 'front', shop: 'meridian' }),
  S('odd_stuck_garage', 'cargo250', 'winchout', 'lot', 300, 'Garage attendant', 'Van hit the clearance bar and is jammed under it. Nobody can get in or out.', { damage: 'front', shop: 'ironbridge' }),
  S('odd_show_car', 'solstice', 'flatbed', 'lot', 280, 'Concours committee', 'Show car with no interest in starting. Soft straps only, and do not touch the paint.', { shop: 'harborpoint' }),
  S('odd_auction_run', 'rustbucket', 'flatbed', 'lot', 150, 'Auction yard', 'Auction pickup. No keys, no brakes, no title yet. Winch it on and go.', { flats: ['RR'], shop: 'impound' }),
  S('odd_dealer_transfer', 'corsair', 'flatbed', 'lot', 200, 'Meridian Motors', 'Dealer transfer, brand new car with a dead battery on the lot. Careful, it is unsold inventory.', { shop: 'meridian' }),
  S('odd_race_day', 'vantorra', 'flatbed', 'lot', 310, 'Track steward', 'Track day ended early. Car is fine, driver is not. Load it and take it home.', { shop: 'harborpoint' }),
  S('odd_movie_set', 'stretch', 'flatbed', 'street', 360, 'Location manager', 'Picture car needed on set an hour ago. It does not run. It never ran.', { shop: 'meridian' }),
  S('odd_ice_cream_melt', 'sundae', 'winchout', 'street', 240, 'Sundae Cruiser', 'Ice cream truck slid off a gravel shoulder. Freezer is thawing. The jingle continues.', { shop: 'route9' }),
  S('odd_bike_rack', 'ravello', 'flatbed', 'street', 175, 'Rider — Kai', 'Bike will not start after sitting all winter. Wheel chock and soft straps, please.', { shop: 'harborpoint' }),
  S('odd_two_for_one', 'pip', 'flatbed', 'lot', 210, 'Body shop', 'Small car, small money, but the shop has three more if this goes well.', { shop: 'meridian' }),
  S('odd_vagabond_van', 'vagabond', 'flatbed', 'street', 230, 'Sammy R.', 'Old panel van, home-built everything. Runs on hope. Currently out of hope.', { shop: 'ironbridge' }),
  S('odd_hearse_hurry', 'stretch', 'flatbed', 'street', 330, 'Funeral director', 'Long black car will not start, and there is a service in forty minutes. No pressure.', { shop: 'delgado' }),
  S('odd_food_truck', 'sundae', 'flatbed', 'lot', 250, 'Food truck owner', 'Truck died at a festival, generator still running. Kill it before you load it.', { shop: 'route9' }),
  S('odd_taxi_fleet_three', 'cab', 'flatbed', 'lot', 215, 'Yellow Cab yard', 'Fleet has three dead cabs. Take the worst one first, they will call back for the rest.', { shop: 'harborpoint' }),
  S('odd_snow_plow_hit', 'civia', 'crash', 'street', 250, 'City Public Works', 'Plow clipped a parked car overnight. City is paying. Photograph everything.', { damage: 'side', shop: 'meridian' }),
  S('odd_flooded_basement', 'accolade', 'winchout', 'lot', 340, 'Property manager', 'Garage flooded and the car sat in it for a day. Do not try to start it, just pull it.', { shop: 'lakeside' }),
  S('odd_parade_route', 'regal', 'illegal', 'street', 200, 'Event staff', 'Parade starts in an hour and this car is on the route. Owner is unreachable.', { shop: 'impound' }),
  S('odd_charging_spot', 'veloce', 'illegal', 'lot', 230, 'Property manager', 'Blocking the only charging spot for six hours. The complaints are piling up.', { shop: 'impound' }),
  S('odd_test_drive', 'trailhawk', 'winchout', 'street', 290, 'Dealer — Kim', 'Salesperson took a customer off-road on a test drive. It went how you would expect.', { shop: 'ironbridge' }),
  S('odd_moving_day', 'workhorse', 'flatbed', 'street', 195, 'Moving crew', 'Old pickup loaded with furniture quit halfway through a move. Load stays on it.', { shop: 'ironbridge' }),
  S('odd_driveway_slide', 'summit', 'winchout', 'street', 265, 'Homeowner — Pat', 'SUV slid down an icy driveway and stopped against a mailbox. Mailbox lost.', { damage: 'rear', shop: 'northgate' }),
  S('odd_late_night_bar', 'fury', 'illegal', 'lot', 220, 'Bar owner', 'Left in the lot after close, third night running. Owner wants it towed before opening.', { shop: 'impound' }),
  S('odd_ferry_line', 'estate', 'flatbed', 'street', 240, 'Ferry terminal', 'Car died in the ferry queue. Everyone behind it is furious. Boat leaves in twenty.', { shop: 'harborpoint' }),
  S('odd_bridge_stall', 'voyage', 'flatbed', 'street', 255, 'SPD Traffic', 'Minivan stalled on the bridge span. Narrow shoulder, high wind, take the amber all the way up.', { cones: true, shop: 'meridian' }),
  S('odd_construction_zone', 'trek', 'flatbed', 'street', 235, 'Site foreman', 'Pickup dead inside an active work zone. Flaggers will hold traffic for you.', { cones: true, shop: 'ironbridge' }),
  S('odd_dealer_lot_dead', 'landmaster', 'flatbed', 'lot', 225, 'Dealer — Kim', 'Trade-in that will not start, sitting in the middle of the display row. Move it out.', { shop: 'ironbridge' }),
  S('odd_impound_release', 'diplomat', 'flatbed', 'lot', 200, 'Impound clerk', 'Released from impound but it will not run. Take it to the shop the owner picked.', { shop: 'meridian' }),
  S('odd_track_trailer', 'makoz3', 'flatbed', 'lot', 270, 'Track steward', 'Blown motor at a track day. It is going to the import shop, not the track shop.', { shop: 'harborpoint' }),
  S('odd_grocery_runaway', 'cascade', 'crash', 'lot', 205, 'Grocery manager', 'Car rolled out of a parking space into a cart corral. Nobody was in it. It is fine.', { damage: 'front', shop: 'meridian' }),
  S('odd_snowbank_plow', 'sprite', 'winchout', 'street', 230, 'Angela D.', 'Plow packed her in solid. Front bumper is under two feet of ice.', { shop: 'northgate' }),
  S('odd_church_lot', 'regal', 'jump', 'lot', 120, 'Deacon Wells', 'Old Regal will not start after service. He would rather not hold up coffee hour.', { shop: 'delgado' }),
  S('odd_marina_ramp', 'crest2500', 'winchout', 'street', 350, 'Marina office', 'Truck slid on the ramp with the boat still hooked. Boat is out, truck is not.', { shop: 'route9', heavy: true }),
  S('odd_alley_wedge', 'parcel', 'winchout', 'street', 280, 'Delivery dispatch', 'Van wedged between a dumpster and a wall. No damage yet. Emphasis on yet.', { shop: 'route9' }),
  S('odd_school_bus_lot', 'shuttle', 'flatbed', 'lot', 420, 'Transit yard', 'Shuttle will not start in the yard. Big, heavy, and blocking two other buses.', { shop: 'route9', heavy: true }),
  S('odd_first_car', 'rustbucket', 'flatbed', 'street', 160, 'Teenager — Milo', 'First car, first breakdown, second week. He is taking it hard. Be nice.', { shop: 'delgado' }),
  S('odd_rain_stall', 'civia', 'flatbed', 'street', 185, 'Dana R.', 'Same Civia as last week, now hydrolocked from the flooded intersection. She is embarrassed.', { shop: 'delgado' }),
  S('odd_valet_mixup', 'veloce', 'lockout', 'lot', 130, 'Valet manager', 'Valet locked the keys in a very expensive car. He would like this handled discreetly.', { noTow: true }),
  S('odd_gate_blocked', 'haul150', 'illegal', 'lot', 215, 'Warehouse foreman', 'Pickup parked across the loading gate. Nobody in or out until it moves.', { shop: 'impound' }),
  S('odd_beach_sand', 'trailhawk', 'winchout', 'street', 300, 'Beach patrol', 'Buried to the diffs in soft sand past the dune line. Long, slow pull.', { shop: 'ironbridge' }),
  S('odd_car_show_dead', 'fairlane', 'jump', 'lot', 125, 'Show organizer', 'Show car with a dead battery and a trophy to collect. Jump it and load it.', { shop: 'delgado' }),
  S('odd_uturn_curb', 'corsair', 'crash', 'street', 245, 'SPD Traffic', 'Illegal U-turn ended on the kerb. Both passenger wheels are off the ground.', { damage: 'side', shop: 'meridian' }),
  S('odd_night_repo_lot', 'trek', 'repo', 'lot', 310, 'Skyville Credit Union', 'Recovery in an unlit lot after hours. Amber on, get it up, get out.', { shop: 'impound', quiet: true }),
  S('odd_delivery_double', 'parcel', 'illegal', 'street', 190, 'Parking Authority', 'Double parked on a bus route for two hours. Transit is filing complaints.', { shop: 'impound' }),
  S('odd_transmission_drop', 'estate', 'flatbed', 'street', 250, 'Renata V.', 'Wagon dropped its transmission fluid across two blocks. Do not roll it far.', { shop: 'lakeside' }),
  S('odd_farm_truck', 'workhorse', 'winchout', 'street', 270, 'Farmer — Ellis', 'Old truck sank into the field access. Chains, not straps, for the pull.', { shop: 'ironbridge' }),
  S('odd_electric_dead', 'cascade', 'flatbed', 'street', 230, 'Simone R.', 'Battery at zero, no charge, no crank. Neutral only with the override. Take it slow.', { shop: 'lakeside' }),
  S('odd_double_flat_hwy', 'summit', 'tire', 'highway', 280, 'The Voss family', 'Two flats on the beltway from the same pothole. Nobody has two spares.', { flats: ['FR', 'RR'], cones: true, shop: 'northgate' }),
  S('odd_night_crash_pole', 'accolade', 'crash', 'street', 290, 'SPD Traffic', 'Single car into a utility pole after midnight. Power crew is on the way, wait for their clear.', { damage: 'front', shop: 'meridian' }),
  S('odd_pickup_bed_load', 'haul150', 'crash', 'street', 300, 'SPD Traffic', 'Loaded pickup rear-ended at a light. Bed is buckled, tailgate is in the road.', { damage: 'rear', shop: 'ironbridge' }),
  S('odd_alley_bike', 'ravello', 'winchout', 'street', 180, 'Rider — Kai', 'Bike dropped in an alley and jammed under a stoop. Lift it out, do not drag it.', { shop: 'harborpoint' }),
  S('odd_last_call', 'diplomat', 'flatbed', 'street', 265, 'Carla J.', 'Same Diplomat, same electrical gremlin, third time this month. She has stopped laughing.', { shop: 'meridian' }),
];

export const SCENE_COUNT = SCENES.length;

/* ------------------------------------------------------------- step chains */

const STEP_TEXT = {
  cones: 'Set out safety cones behind the scene',
  jumpbox: 'Get the jump box from a utility compartment',
  hood: 'Open the hood',
  clamps: 'Clamp the jump box onto the battery',
  crank: 'Start the car',
  bed_down: 'Tilt the bed down',
  drive_on: 'Drive the car up onto the deck',
  hook: 'Pull the winch hook out and attach it',
  winch: 'Winch the vehicle onto the deck',
  bed_up: 'Bring the bed back up',
  straps: 'Strap the vehicle down — 4 ratchet straps, tight',
  deliver: 'Deliver to the shop',
  drop: 'Unload at the shop',
  unlock: 'Get the door open',
  fuel: 'Put fuel in the tank',
  tire_off: 'Take the flat tire off',
  spare_on: 'Fit the spare',
  righting: 'Winch the vehicle back onto its wheels',
};

export function stepsFor(scene) {
  const s = [];
  const add = (id, text) => s.push({ id, text: text || STEP_TEXT[id], done: false });
  if (scene.cones) add('cones');
  switch (scene.type) {
    case 'jump':
      add('jumpbox'); add('hood'); add('clamps'); add('crank');
      add('bed_down'); add('drive_on'); add('bed_up'); add('straps');
      add('deliver'); add('drop');
      break;
    case 'lockout':
      add('unlock');
      break;
    case 'fuel':
      add('fuel');
      if (!scene.noTow) { add('bed_down'); add('hook'); add('winch'); add('bed_up'); add('straps'); add('deliver'); add('drop'); }
      break;
    case 'tire':
      add('tire_off');
      if (scene.noTow) add('spare_on');
      else { add('bed_down'); add('hook'); add('winch'); add('bed_up'); add('straps'); add('deliver'); add('drop'); }
      break;
    case 'winchout':
      add('bed_down'); add('hook');
      if (scene.damage === 'rollover') add('righting');
      add('winch'); add('bed_up'); add('straps'); add('deliver'); add('drop');
      break;
    case 'crash':
      if (scene.damage === 'rollover') { add('bed_down'); add('hook'); add('righting'); add('winch'); }
      else { add('bed_down'); add('hook'); add('winch'); }
      add('bed_up'); add('straps'); add('deliver'); add('drop');
      break;
    case 'repo':
    case 'illegal':
    case 'flatbed':
    default:
      add('bed_down'); add('hook'); add('winch'); add('bed_up'); add('straps'); add('deliver'); add('drop');
  }
  return s;
}

/* ---------------------------------------------------------------- dispatch */

const CALL_OPENERS = [
  'Dispatch to any available unit —',
  'Got one for you —',
  'You up? Call came in —',
  'Next call —',
  'Take this when you can —',
  'Customer waiting —',
];

export class Dispatch {
  constructor(city, rng = makeRng(Date.now() & 0xffff)) {
    this.city = city;
    this.rng = rng;
    this.used = new Set();
    this.pending = null;      // offered but not accepted
    this.active = null;
    this.completed = [];
    this.declined = 0;
    this.earnings = 0;
    this.nextCallAt = 60;     // first call lands about a minute in
    this.clock = 0;
  }

  pickScene(prefer) {
    const pool = SCENES.filter((s) => !this.used.has(s.id) && (!prefer || s.type === prefer));
    const list = pool.length ? pool : SCENES.filter((s) => !prefer || s.type === prefer);
    if (!list.length) { this.used.clear(); return SCENES[Math.floor(this.rng() * SCENES.length)]; }
    return list[Math.floor(this.rng() * list.length)];
  }

  makeOffer(scene) {
    scene = scene || this.pickScene();
    const where = scene.where === 'highway' ? 'highway' : 'street';
    const site = this.city.randomJobSite(this.rng, where);
    let shop = this.city.shops.find((s) => s.id === scene.shop);
    if (!shop) shop = this.city.shops[Math.floor(this.rng() * this.city.shops.length)];
    const steps = stepsFor(scene);
    const offer = {
      scene, site, shop, steps, stepIndex: 0,
      opener: CALL_OPENERS[Math.floor(this.rng() * CALL_OPENERS.length)],
      pay: Math.round(scene.pay * (0.9 + this.rng() * 0.35)),
      startedAt: this.clock,
      id: scene.id + '-' + Math.floor(this.rng() * 1e5),
    };
    this.pending = offer;
    this.used.add(scene.id);
    return offer;
  }

  accept() {
    if (!this.pending) return null;
    this.active = this.pending;
    this.active.acceptedAt = this.clock;
    this.pending = null;
    return this.active;
  }

  decline() {
    this.pending = null;
    this.declined++;
    this.nextCallAt = this.clock + 25;
  }

  currentStep() {
    const a = this.active;
    if (!a) return null;
    return a.steps[a.stepIndex] || null;
  }

  hasStep(id) {
    const a = this.active;
    return !!a && a.steps.some((s) => s.id === id);
  }

  isCurrent(id) {
    const s = this.currentStep();
    return !!s && s.id === id;
  }

  // Complete a step. Out-of-order completions are allowed for anything the
  // player can legitimately do early (cones, bed, straps).
  complete(id) {
    const a = this.active;
    if (!a) return false;
    const i = a.steps.findIndex((s) => s.id === id && !s.done);
    if (i < 0) return false;
    a.steps[i].done = true;
    while (a.stepIndex < a.steps.length && a.steps[a.stepIndex].done) a.stepIndex++;
    return true;
  }

  undo(id) {
    const a = this.active;
    if (!a) return;
    const i = a.steps.findIndex((s) => s.id === id);
    if (i >= 0 && a.steps[i].done) {
      a.steps[i].done = false;
      a.stepIndex = Math.min(a.stepIndex, i);
    }
  }

  get progress() {
    const a = this.active;
    if (!a) return 0;
    return a.steps.filter((s) => s.done).length / a.steps.length;
  }

  finish({ damagePenalty = 0, weatherBonus = 1, timeTaken = 0 } = {}) {
    const a = this.active;
    if (!a) return null;
    const speedBonus = timeTaken > 0 && timeTaken < 180 ? 1.15 : timeTaken < 360 ? 1.0 : 0.9;
    const gross = a.pay * weatherBonus * speedBonus;
    const net = Math.max(20, Math.round(gross - damagePenalty));
    const record = {
      id: a.id, title: a.scene.text, caller: a.scene.caller,
      shop: a.shop.name, pay: net, type: a.scene.type, timeTaken,
    };
    this.completed.push(record);
    this.earnings += net;
    this.active = null;
    this.nextCallAt = this.clock + 45 + this.rng() * 45;
    return record;
  }

  abandon() {
    if (!this.active) return;
    this.active = null;
    this.nextCallAt = this.clock + 40;
  }

  update(dt, { busy }) {
    this.clock += dt;
    if (busy || this.pending || this.active) return null;
    if (this.clock >= this.nextCallAt) {
      return this.makeOffer();
    }
    return null;
  }
}

export const SCENE_TYPE_LABEL = {
  jump: 'Jump start', flatbed: 'Flatbed tow', crash: 'Collision recovery',
  winchout: 'Winch-out recovery', lockout: 'Lockout', tire: 'Tire change',
  fuel: 'Fuel delivery', repo: 'Repossession', illegal: 'Parking enforcement',
};
