// The dispatch board: 160 calls, ported from the Skyville browser game and
// re-set in Los Santos with GTA V's own vehicles. Nothing here spawns a custom
// model or touches the map - every VehicleHash below ships with the game.
using GTA;
using System;
using System.Collections.Generic;
using System.Linq;

namespace LosSantosTowing
{
    public enum JobKind { Jump, Flatbed, Crash, Winchout, Lockout, Tire, Fuel, Repo, Illegal }

    public enum Damage { None, Front, Rear, Side, Rollover }

    public sealed class Call
    {
        public string Id;
        public VehicleHash Model;
        public JobKind Kind;
        public int Pay;
        public string Caller;
        public string Text;
        public string Garage;      // preferred drop-off id, null = dispatcher's choice
        public Damage Damage;
        public int Flats;          // how many tyres are down on arrival
        public bool Cones;         // scene must be coned off first
        public bool NoTow;         // roadside fix, the customer keeps the car
        public bool Heavy;         // wants the flatbed rather than the boom
        public bool Quiet;         // repo: do not wake the neighbourhood
        public bool Freeway;       // place it on a freeway node

        public string KindLabel
        {
            get
            {
                switch (Kind)
                {
                    case JobKind.Jump: return "Jump start";
                    case JobKind.Flatbed: return "Tow";
                    case JobKind.Crash: return "Collision recovery";
                    case JobKind.Winchout: return "Recovery";
                    case JobKind.Lockout: return "Lockout";
                    case JobKind.Tire: return "Tyre change";
                    case JobKind.Fuel: return "Fuel delivery";
                    case JobKind.Repo: return "Repossession";
                    default: return "Parking enforcement";
                }
            }
        }
    }

    public static class Calls
    {
        static Call C(string id, VehicleHash model, JobKind kind, int pay, string caller, string text,
            string garage = null, Damage damage = Damage.None, int flats = 0, bool cones = false,
            bool noTow = false, bool heavy = false, bool quiet = false, bool freeway = false)
        {
            return new Call
            {
                Id = id, Model = model, Kind = kind, Pay = pay, Caller = caller, Text = text,
                Garage = garage, Damage = damage, Flats = flats, Cones = cones,
                NoTow = noTow, Heavy = heavy, Quiet = quiet, Freeway = freeway,
            };
        }

        public static readonly Call[] All =
        {
        C("jump_civia_bagel", VehicleHash.Blista, JobKind.Jump, 95, "Dana R.", "Silver Blista, dead battery outside the bagel place on Vespucci Boulevard. She left the dome light on all night.", garage: "burton"),
        C("jump_accolade_lot", VehicleHash.Prairie, JobKind.Jump, 90, "Marcus T.", "Prairie in a metered spot, turns over once and quits. Wants it jumped and hauled before the meter runs."),
        C("jump_corsair_office", VehicleHash.Premier, JobKind.Jump, 110, "Priya S.", "Premier, five years on the same battery. Dead in the office lot, she has a flight at six.", garage: "lamesa"),
        C("jump_cab_shift", VehicleHash.Taxi, JobKind.Jump, 120, "Downtown Cab Co. #414", "Cab died mid-shift. Driver says the alternator light has been on for a week. Jump it and take it in.", garage: "airport"),
        C("jump_ranger_cold", VehicleHash.Landstalker, JobKind.Jump, 130, "Ed K.", "Landstalker will not crank. Cold soak overnight, no lights at all on the dash."),
        C("jump_sprite_school", VehicleHash.Dilettante, JobKind.Jump, 88, "Ms. Halloran", "Dilettante dead in the school pickup line. Everyone is honking at her. Please hurry.", garage: "burton"),
        C("jump_pip_alley", VehicleHash.Panto, JobKind.Jump, 84, "Sung-min P.", "Little Panto wedged in an alley off Cypress Flats, battery flat. Tight space, watch your mirrors."),
        C("jump_voyage_soccer", VehicleHash.Minivan, JobKind.Jump, 105, "Coach Bianchi", "Minivan full of soccer gear, no crank. Kids are fine, the van is not.", garage: "paleto"),
        C("jump_estate_dog", VehicleHash.Regina, JobKind.Jump, 100, "Renata V.", "Regina dead outside the dog park. She swears it started fine this morning."),
        C("jump_trek_jobsite", VehicleHash.Rebel, JobKind.Jump, 115, "Sal from Popular Street", "Rebel at a job site, ran the winch off the battery all day. Jump and haul.", garage: "beekers"),
        C("jump_interceptor", VehicleHash.Police, JobKind.Jump, 165, "LSPD Fleet", "Unit 22 down with a dead battery. Fleet wants it jumped and brought to their contract shop.", garage: "lamesa"),
        C("jump_regal_funeral", VehicleHash.Emperor, JobKind.Jump, 135, "Mr. Okonjo", "Emperor, 1980s barge, dead outside a funeral home. Owner is very particular about the paint.", garage: "burton"),
        C("dead_fairlane_starter", VehicleHash.Stanier, JobKind.Flatbed, 145, "Bea L.", "Stanier, starter is gone - jump box will not touch it. Straight winch job.", garage: "burton"),
        C("dead_volans40_timing", VehicleHash.Asea, JobKind.Flatbed, 150, "Tomas H.", "Asea lost the timing belt on Innocence Boulevard. Do not try to crank it, just load it.", garage: "airport"),
        C("dead_rove_trans", VehicleHash.Habanero, JobKind.Flatbed, 160, "Angela D.", "Habanero will not select a gear. Transmission shop wants it on the deck, not dragged.", garage: "bennys"),
        C("dead_cascade_overheat", VehicleHash.Serrano, JobKind.Flatbed, 155, "Kwame A.", "Serrano blew the upper hose, steam everywhere. Let it cool, then load it.", garage: "lamesa"),
        C("dead_vantorra_clutch", VehicleHash.Coquette, JobKind.Flatbed, 195, "Nico B.", "Coquette, clutch pedal on the floor. Low car - take it slow on the approach angle.", garage: "airport"),
        C("dead_veloce_lowclear", VehicleHash.Voltic, JobKind.Flatbed, 320, "Mr. Ashford", "Voltic. Four inches of ground clearance and a very nervous owner. Do not scrape it.", garage: "airport"),
        C("dead_makoz3_belt", VehicleHash.Penumbra, JobKind.Flatbed, 175, "Julie F.", "Penumbra threw the serpentine belt. Steering went heavy, she pulled into a bus stop."),
        C("dead_fury_fuelpump", VehicleHash.Dominator, JobKind.Flatbed, 185, "Ray \"Duke\" M.", "Dominator, fuel pump quit at the light. Owner is standing on the corner with the keys.", garage: "lamesa"),
        C("dead_diplomat_electrical", VehicleHash.Gauntlet, JobKind.Flatbed, 180, "Carla J.", "Gauntlet, complete electrical failure. Wipers came on by themselves and then nothing."),
        C("dead_solstice_topdown", VehicleHash.Tornado, JobKind.Flatbed, 170, "Fiona G.", "Tornado stalled with the top down and it is going to rain. Load it before it gets soaked.", garage: "burton"),
        C("dead_summit_alternator", VehicleHash.Cavalcade, JobKind.Flatbed, 190, "The Voss family", "Cavalcade, alternator cooked. Big SUV, use the long straps.", garage: "paleto"),
        C("dead_trailmark_axle", VehicleHash.Ingot, JobKind.Flatbed, 200, "Peter O.", "Ingot making a grinding noise from the front left. Sounds like a CV joint letting go.", garage: "burton"),
        C("dead_landmaster_starter", VehicleHash.Dubsta, JobKind.Flatbed, 210, "Hank R.", "Dubsta, old and stubborn. Starter clicks, nothing more. He wants it at the 4x4 shop.", garage: "beekers"),
        C("dead_workhorse_barn", VehicleHash.Rebel2, JobKind.Flatbed, 165, "June P.", "Rebel pickup, has not run since spring. Tires hold air, brakes do not.", garage: "beekers"),
        C("dead_haul150_diesel", VehicleHash.Bison, JobKind.Flatbed, 230, "Contractor - Bo", "Bison with a fuel issue, loaded with tools. Heavier than it looks.", garage: "beekers"),
        C("dead_cargo250_fleet", VehicleHash.Burrito, JobKind.Flatbed, 245, "Fleet dispatch", "Burrito van dead on route. Fleet says take it to their contract shop, keys under the mat.", garage: "beekers"),
        C("dead_parcel_route", VehicleHash.Boxville, JobKind.Flatbed, 255, "Post OP", "Delivery van died mid-route, packages still inside. Driver stays with the load.", garage: "beekers"),
        C("dead_stretch_prom", VehicleHash.Stretch, JobKind.Flatbed, 340, "Vinewood Limo", "Stretch broke down with a prom party inside. Long car - you will need the whole deck.", garage: "lamesa"),
        C("dead_shuttle_route", VehicleHash.Bus, JobKind.Flatbed, 380, "Downtown Transit", "Shuttle bus down at a stop. Air system dumped. Heavy truck job, take the big rollback if you have it.", garage: "beekers"),
        C("dead_sundae_summer", VehicleHash.Taco, JobKind.Flatbed, 220, "Taco Bomb", "Ice cream truck quit with a freezer full of inventory. The jingle is still playing. It will not stop.", garage: "beekers"),
        C("crash_fender_meridian", VehicleHash.Premier, JobKind.Crash, 240, "LSPD Traffic", "Fender bender at Vespucci Boulevard and Prosperity. Premier took the hit up front, not drivable. Radiator is down.", garage: "lamesa", damage: Damage.Front),
        C("crash_rearend_light", VehicleHash.Blista, JobKind.Crash, 225, "LSPD Traffic", "Rear-ender at the light. Blista got sandwiched, trunk is folded, wheels still roll.", garage: "lamesa", damage: Damage.Rear),
        C("crash_tbone_union", VehicleHash.Landstalker, JobKind.Crash, 285, "LSPD Traffic", "T-bone at Innocence Boulevard. Ranger caught it in the driver door. Occupants out and walking.", garage: "lamesa", damage: Damage.Side),
        C("crash_rollover_ramp", VehicleHash.Habanero, JobKind.Crash, 420, "Highway Patrol", "Rollover on the Olympic Freeway on-ramp. Vehicle is on its side, lane is closed. Cones out before you touch anything.", garage: "lamesa", damage: Damage.Rollover, cones: true, freeway: true),
        C("crash_pileup_beltway", VehicleHash.Prairie, JobKind.Crash, 360, "Highway Patrol", "Three-car pileup on the freeway, we need the little one off the shoulder first. Traffic is live.", garage: "lamesa", damage: Damage.Front, cones: true, freeway: true),
        C("crash_guardrail", VehicleHash.Dilettante, JobKind.Crash, 330, "Highway Patrol", "Dilettante kissed the guardrail at the Little Seoul off-ramp. Front left is folded into the tire. Will not roll straight.", damage: Damage.Front, flats: 1, cones: true, freeway: true),
        C("crash_intersection_cab", VehicleHash.Taxi, JobKind.Crash, 260, "LSPD Traffic", "Cab and a delivery van tangled downtown. Cab is ours, van has its own service.", garage: "airport", damage: Damage.Side),
        C("crash_parkinglot_low", VehicleHash.Asea, JobKind.Crash, 195, "Del Perro Plaza security", "Low-speed hit in the mall lot. Bumper is hanging and dragging. Owner just wants it gone.", garage: "paleto", damage: Damage.Front),
        C("crash_curb_strike", VehicleHash.Regina, JobKind.Crash, 230, "Amara Q.", "Hit a curb hard avoiding a dog. Wheel is bent in, car pulls hard right. Not drivable.", garage: "burton", damage: Damage.Front, flats: 1),
        C("crash_deer_beltway", VehicleHash.Ingot, JobKind.Crash, 315, "Highway Patrol", "Deer strike on the freeway. Hood is up over the windshield, radiator gone. No injuries.", garage: "lamesa", damage: Damage.Front, cones: true, freeway: true),
        C("crash_hydrant", VehicleHash.Gauntlet, JobKind.Crash, 300, "LSPD Traffic", "Driver took out a hydrant on Alta Street. Water is off now. Front end is soaked and folded.", garage: "lamesa", damage: Damage.Front),
        C("crash_pole_night", VehicleHash.Dominator, JobKind.Crash, 340, "LSPD Traffic", "Muscle car versus light pole. Pole won. Driver is being checked out, car goes to collision.", garage: "lamesa", damage: Damage.Front),
        C("crash_backedinto", VehicleHash.Cavalcade, JobKind.Crash, 210, "Grocery manager", "Somebody backed into a Cavalcade and left. Rear quarter is caved, tailgate will not close.", garage: "lamesa", damage: Damage.Rear),
        C("crash_van_dock", VehicleHash.Burrito, JobKind.Crash, 290, "Warehouse foreman", "Van rolled off the dock lip. Rear is sitting low and the frame looks tweaked.", garage: "beekers", damage: Damage.Rear),
        C("crash_boxtruck_bridge", VehicleHash.Mule, JobKind.Crash, 480, "LSPD Traffic", "Box truck met a low bridge on Popular Street. Roof peeled back. It is heavy - bring the big deck.", garage: "beekers", damage: Damage.Front, heavy: true),
        C("crash_taxi_rear", VehicleHash.Taxi, JobKind.Crash, 245, "Downtown Cab Co. #207", "Cab rear-ended at a crosswalk. Trunk is accordioned, both rear tires rub.", garage: "airport", damage: Damage.Rear, flats: 1),
        C("crash_multi_ramp", VehicleHash.Rebel, JobKind.Crash, 350, "Highway Patrol", "Pickup spun on the wet ramp and hit the barrier backwards. Shoulder is narrow, be careful.", garage: "beekers", damage: Damage.Rear, cones: true, freeway: true),
        C("crash_side_alley", VehicleHash.Panto, JobKind.Crash, 190, "Roshan D.", "Somebody clipped the Panto in an alley and took the mirror and the door with them.", garage: "burton", damage: Damage.Side),
        C("crash_bike_down", VehicleHash.Bati, JobKind.Crash, 260, "LSPD Traffic", "Motorcycle down at an intersection. Rider is up and angry. Bike needs to go on the deck, gently.", garage: "airport", damage: Damage.Side),
        C("crash_rollover_ditch", VehicleHash.Dubsta, JobKind.Crash, 430, "Blaine County Sheriff", "Old 4x4 on its side in the ditch off the Alamo Sea road. Winch it upright and load it.", garage: "beekers", damage: Damage.Rollover),
        C("winch_ditch_snow", VehicleHash.Landstalker, JobKind.Winchout, 280, "Doug W.", "Slid off into the ditch on the shoulder. Not damaged, just stuck to the axles.", garage: "paleto"),
        C("winch_mud_lot", VehicleHash.Mesa, JobKind.Winchout, 260, "Site foreman", "Mesa buried to the frame in a muddy lot. Owner already tried to drive it out. Twice.", garage: "beekers"),
        C("winch_curb_hung", VehicleHash.Voltic, JobKind.Winchout, 340, "Mr. Ashford", "Exotic hung up on a kerb, both front wheels off the ground. Do not tow it forward, lift it.", garage: "airport"),
        C("winch_beach_ramp", VehicleHash.Bison, JobKind.Winchout, 300, "Marina office", "Truck and trailer got stuck on the boat ramp. Trailer is off - just the truck.", garage: "beekers"),
        C("winch_snowbank", VehicleHash.Minivan, JobKind.Winchout, 250, "Nadia K.", "Plow buried her minivan in a snowbank overnight. Dig, hook, and pull.", garage: "paleto"),
        C("winch_garage_stuck", VehicleHash.Stretch, JobKind.Winchout, 380, "Parking garage manager", "Limo wedged on a garage ramp, cannot go forward or back. Very tight overhead.", garage: "lamesa"),
        C("winch_offroad_trail", VehicleHash.Dubsta, JobKind.Winchout, 320, "Trail club", "Dubsta off the fire road, high-centred on a rock. Long pull, watch your angle.", garage: "beekers"),
        C("winch_flood_underpass", VehicleHash.Premier, JobKind.Winchout, 290, "LSPD Traffic", "Driver went through the flooded underpass. Water is down, car is dead and full of mud.", garage: "lamesa"),
        C("winch_construction", VehicleHash.Sadler, JobKind.Winchout, 360, "Site foreman", "Heavy pickup dropped a rear wheel into a trench. Careful with the frame, it is a new truck.", garage: "beekers", heavy: true),
        C("winch_median", VehicleHash.Serrano, JobKind.Winchout, 330, "Highway Patrol", "Crossover in the median on the freeway. Cones first - traffic is not slowing down.", garage: "lamesa", cones: true, freeway: true),
        C("lock_keys_trunk", VehicleHash.Premier, JobKind.Lockout, 75, "Mei L.", "Keys locked in the trunk with the groceries. She is very calm about it, which is unusual.", noTow: true),
        C("lock_running_car", VehicleHash.Cavalcade, JobKind.Lockout, 85, "Trevor S.", "Locked out with the engine running and the dog inside. Dog is fine. Trevor is not.", noTow: true),
        C("lock_gas_station", VehicleHash.Dilettante, JobKind.Lockout, 70, "Ola A.", "Locked out at the pumps, blocking the island. Station wants it moved either way.", noTow: true),
        C("lock_hospital", VehicleHash.Minivan, JobKind.Lockout, 80, "Nurse Ramirez", "Locked out at the end of a double shift. Please be quick, she is asleep on her feet.", noTow: true),
        C("lock_beach", VehicleHash.Regina, JobKind.Lockout, 78, "The Halvorsens", "Keys locked in, kids in swimsuits, meter about to expire. Classic Saturday.", noTow: true),
        C("lock_work_van", VehicleHash.Burrito, JobKind.Lockout, 95, "Plumber - Nate", "Work van locked with the motor running and every tool he owns inside.", noTow: true),
        C("lock_cab_fare", VehicleHash.Taxi, JobKind.Lockout, 90, "Downtown Cab Co. #118", "Cabbie locked himself out at a fare pickup. Meter is still running, apparently.", noTow: true),
        C("lock_interceptor", VehicleHash.Police, JobKind.Lockout, 110, "LSPD Fleet", "Officer locked the keys in the cruiser. Do not tell anyone. That is part of the fee.", noTow: true),
        C("tire_flat_beltway", VehicleHash.Blista, JobKind.Tire, 140, "Sanjay P.", "Flat right front on the freeway shoulder. No spare in the trunk. Change it or haul it.", garage: "paleto", flats: 1, cones: true, freeway: true),
        C("tire_blowout_rear", VehicleHash.Premier, JobKind.Tire, 160, "Grace N.", "Rear blowout at speed, shredded down to the belt. She is shaken but fine.", garage: "paleto", flats: 1, cones: true, freeway: true),
        C("tire_two_flats", VehicleHash.Prairie, JobKind.Tire, 175, "Owen B.", "Hit the same pothole twice, somehow. Both passenger side tires are flat.", garage: "paleto", flats: 2),
        C("tire_locked_lugs", VehicleHash.Habanero, JobKind.Tire, 155, "Delia M.", "Flat tire, locking lug nut key is missing. Bring the impact wrench and your patience.", garage: "paleto", flats: 1),
        C("tire_curbrash", VehicleHash.Penumbra, JobKind.Tire, 165, "Ivan T.", "Sidewall gash from a kerb. Low profile tire, wheel might be bent too.", garage: "airport", flats: 1),
        C("tire_dually_truck", VehicleHash.Sadler, JobKind.Tire, 210, "Hauler - Fitz", "Inside dually is flat on a loaded pickup. Heavy work, take your time.", garage: "beekers", flats: 1, heavy: true),
        C("tire_school_run", VehicleHash.Minivan, JobKind.Tire, 145, "Bridget C.", "Flat in the school pickup lane. Four kids, one spare, no jack.", garage: "paleto", flats: 1),
        C("tire_bike_rear", VehicleHash.Bati, JobKind.Tire, 130, "Rider - Kai", "Rear tire down on a motorcycle. It has to go on the deck, it will not roll far.", garage: "airport", flats: 1),
        C("tire_slashed_lot", VehicleHash.Gauntlet, JobKind.Tire, 190, "Lot attendant", "Two tires slashed overnight in the lot. Owner wants it towed, not patched.", garage: "lamesa", flats: 2),
        C("tire_shoulder_night", VehicleHash.Regina, JobKind.Tire, 175, "Marta E.", "Flat on the shoulder after dark. She is standing well off the road. Light it up before you get out.", garage: "paleto", flats: 1, cones: true, freeway: true),
        C("fuel_beltway", VehicleHash.Blista, JobKind.Fuel, 85, "Jamie L.", "Ran it dry on the freeway. Gauge has been broken for a year. Two gallons should do it.", cones: true, noTow: true, freeway: true),
        C("fuel_diesel_wrong", VehicleHash.Bison, JobKind.Fuel, 160, "Contractor - Bo", "Put gasoline in the diesel. It ran for a mile and quit. This one gets towed.", garage: "beekers"),
        C("fuel_empty_lot", VehicleHash.Stanier, JobKind.Fuel, 90, "Hal W.", "Out of gas in the grocery lot, cart still full. Bring the can.", noTow: true),
        C("fuel_bridge", VehicleHash.Taxi, JobKind.Fuel, 95, "Downtown Cab Co. #302", "Cab out of fuel on the bridge approach. Blocking a lane, so make it fast.", cones: true, noTow: true),
        C("fuel_night_shift", VehicleHash.Rebel, JobKind.Fuel, 100, "Reggie D.", "Ran dry heading home from third shift. Half a mile from the station, of course.", noTow: true),
        C("fuel_delivery_van", VehicleHash.Boxville, JobKind.Fuel, 120, "Post OP", "Delivery van dry with forty stops left. Fuel it and they will handle the rest.", noTow: true),
        C("repo_quiet_street", VehicleHash.Gauntlet, JobKind.Repo, 300, "Fleeca Bank", "Recovery order. Silver Gauntlet, six payments behind. Owner is not home. Be quick and be quiet.", garage: "impound", quiet: true),
        C("repo_apartment_lot", VehicleHash.Habanero, JobKind.Repo, 280, "Maze Bank", "Repo in an apartment lot. Do not block anyone in, and do not make a scene.", garage: "impound", quiet: true),
        C("repo_night_driveway", VehicleHash.Cavalcade, JobKind.Repo, 340, "Fleeca Bank", "Voluntary surrender that stopped being voluntary. Keys are not coming. Winch it.", garage: "impound", quiet: true),
        C("repo_workvan", VehicleHash.Burrito, JobKind.Repo, 320, "Fleet Leasing", "Lease default on a work van. Tools inside stay with the van, per the order.", garage: "impound", quiet: true),
        C("impound_expired", VehicleHash.Prairie, JobKind.Illegal, 180, "Parking Authority", "Expired registration, eleven months. Tagged and ready for the impound lot.", garage: "impound"),
        C("impound_firelane", VehicleHash.Cavalcade, JobKind.Illegal, 200, "Fire Marshal", "Parked across a fire lane at the mall. Marshal is standing there waiting for you.", garage: "impound"),
        C("impound_hydrant", VehicleHash.Coquette, JobKind.Illegal, 210, "Parking Authority", "Sports car parked on a hydrant. Owner has four unpaid tickets. Take it in.", garage: "impound"),
        C("impound_handicap", VehicleHash.Dominator, JobKind.Illegal, 195, "Parking Authority", "No permit in a handicap space, third time this month. They want it gone.", garage: "impound"),
        C("impound_snowroute", VehicleHash.Regina, JobKind.Illegal, 185, "Parking Authority", "Parked on a declared snow route. Plow cannot get through until it moves.", garage: "impound"),
        C("impound_abandoned", VehicleHash.Emperor2, JobKind.Illegal, 165, "Parking Authority", "Abandoned for three weeks, flat tires and a broken window. Nobody is coming for it.", garage: "impound", damage: Damage.Side, flats: 2),
        C("impound_alley_block", VehicleHash.Mule, JobKind.Illegal, 260, "Business owner", "Box truck blocking an alley behind a restaurant. Deliveries cannot get in.", garage: "impound", heavy: true),
        C("impound_meter_marathon", VehicleHash.Panto, JobKind.Illegal, 150, "Parking Authority", "Same meter for nine days. Even the meter maid feels bad about it.", garage: "impound"),
        C("impound_loadingzone", VehicleHash.Minivan, JobKind.Illegal, 175, "Parking Authority", "Minivan in a loading zone at the peak of lunch rush. Take it to the lot.", garage: "impound"),
        C("impound_bike_walk", VehicleHash.Bati, JobKind.Illegal, 140, "Parking Authority", "Motorcycle chained to a bike rack on the sidewalk. Bolt cutters are in the box.", garage: "impound"),
        C("hwy_stall_lane", VehicleHash.Stanier, JobKind.Flatbed, 260, "Highway Patrol", "Stalled in the right lane of the freeway. This is a live lane - cones and amber before you step out.", garage: "lamesa", cones: true, freeway: true),
        C("hwy_shoulder_overheat", VehicleHash.Cavalcade, JobKind.Flatbed, 245, "Rina P.", "Overheated on the shoulder past the Davis off-ramp. Temp needle buried, she shut it off in time.", garage: "paleto", cones: true, freeway: true),
        C("hwy_blown_engine", VehicleHash.Dominator, JobKind.Flatbed, 300, "Duke M.", "Big noise, big smoke, then nothing. Oil all over the shoulder. Bring the absorbent.", garage: "lamesa", cones: true, freeway: true),
        C("hwy_trailer_less", VehicleHash.Sadler, JobKind.Flatbed, 340, "Hauler - Fitz", "Heavy pickup down on the freeway, trailer already recovered. Just the truck now.", garage: "beekers", cones: true, heavy: true, freeway: true),
        C("hwy_box_breakdown", VehicleHash.Mule, JobKind.Flatbed, 460, "Fleet dispatch", "Box truck dead on the freeway deck. Full load. This needs the heavy rollback.", garage: "beekers", cones: true, heavy: true, freeway: true),
        C("hwy_shuttle_down", VehicleHash.Bus, JobKind.Flatbed, 520, "Downtown Transit", "Shuttle down in a live lane with passengers aboard. Police are on scene holding traffic.", garage: "beekers", cones: true, heavy: true, freeway: true),
        C("hwy_ramp_stall", VehicleHash.Dilettante, JobKind.Flatbed, 210, "Ari W.", "Stalled halfway up the La Puerta Freeway on-ramp. Rolling backwards is a real risk here. Chock it.", garage: "burton", cones: true, freeway: true),
        C("hwy_debris_damage", VehicleHash.Asea, JobKind.Flatbed, 265, "Highway Patrol", "Ran over a ladder on the freeway. Undercarriage is torn up, fluid trail behind it.", garage: "lamesa", damage: Damage.Front, cones: true, freeway: true),
        C("odd_wrong_fuel_lot", VehicleHash.Habanero, JobKind.Flatbed, 190, "Station manager", "Customer filled a gas crossover with diesel and drove it forty feet. Now it is ours.", garage: "bennys"),
        C("odd_car_in_pool", VehicleHash.Prairie, JobKind.Winchout, 420, "Homeowner - Vic", "Car rolled through a fence and into a drained pool. Yes, really. Long winch, awkward angle.", garage: "lamesa", damage: Damage.Front),
        C("odd_stuck_garage", VehicleHash.Burrito, JobKind.Winchout, 300, "Garage attendant", "Van hit the clearance bar and is jammed under it. Nobody can get in or out.", garage: "beekers", damage: Damage.Front),
        C("odd_show_car", VehicleHash.Tornado, JobKind.Flatbed, 280, "Concours committee", "Show car with no interest in starting. Soft straps only, and do not touch the paint.", garage: "airport"),
        C("odd_auction_run", VehicleHash.Emperor2, JobKind.Flatbed, 150, "Auction yard", "Auction pickup. No keys, no brakes, no title yet. Winch it on and go.", garage: "impound", flats: 1),
        C("odd_dealer_transfer", VehicleHash.Premier, JobKind.Flatbed, 200, "Premium Deluxe Motorsport", "Dealer transfer, brand new car with a dead battery on the lot. Careful, it is unsold inventory.", garage: "lamesa"),
        C("odd_race_day", VehicleHash.Coquette, JobKind.Flatbed, 310, "Track steward", "Track day ended early. Car is fine, driver is not. Load it and take it home.", garage: "airport"),
        C("odd_movie_set", VehicleHash.Stretch, JobKind.Flatbed, 360, "Location manager", "Picture car needed on set an hour ago. It does not run. It never ran.", garage: "lamesa"),
        C("odd_ice_cream_melt", VehicleHash.Taco, JobKind.Winchout, 240, "Taco Bomb", "Ice cream truck slid off a gravel shoulder. Freezer is thawing. The jingle continues.", garage: "beekers"),
        C("odd_bike_rack", VehicleHash.Bati, JobKind.Flatbed, 175, "Rider - Kai", "Bike will not start after sitting all winter. Wheel chock and soft straps, please.", garage: "airport"),
        C("odd_two_for_one", VehicleHash.Panto, JobKind.Flatbed, 210, "Body shop", "Small car, small money, but the shop has three more if this goes well.", garage: "lamesa"),
        C("odd_vagabond_van", VehicleHash.Youga, JobKind.Flatbed, 230, "Sammy R.", "Old panel van, home-built everything. Runs on hope. Currently out of hope.", garage: "beekers"),
        C("odd_hearse_hurry", VehicleHash.Stretch, JobKind.Flatbed, 330, "Funeral director", "Long black car will not start, and there is a service in forty minutes. No pressure.", garage: "burton"),
        C("odd_food_truck", VehicleHash.Taco, JobKind.Flatbed, 250, "Food truck owner", "Truck died at a festival, generator still running. Kill it before you load it.", garage: "beekers"),
        C("odd_taxi_fleet_three", VehicleHash.Taxi, JobKind.Flatbed, 215, "Downtown Cab Co. yard", "Fleet has three dead cabs. Take the worst one first, they will call back for the rest.", garage: "airport"),
        C("odd_snow_plow_hit", VehicleHash.Blista, JobKind.Crash, 250, "City Public Works", "Plow clipped a parked car overnight. City is paying. Photograph everything.", garage: "lamesa", damage: Damage.Side),
        C("odd_flooded_basement", VehicleHash.Prairie, JobKind.Winchout, 340, "Property manager", "Garage flooded and the car sat in it for a day. Do not try to start it, just pull it.", garage: "bennys"),
        C("odd_parade_route", VehicleHash.Emperor, JobKind.Illegal, 200, "Event staff", "Parade starts in an hour and this car is on the route. Owner is unreachable.", garage: "impound"),
        C("odd_charging_spot", VehicleHash.Voltic, JobKind.Illegal, 230, "Property manager", "Blocking the only charging spot for six hours. The complaints are piling up.", garage: "impound"),
        C("odd_test_drive", VehicleHash.Mesa, JobKind.Winchout, 290, "Dealer - Kim", "Salesperson took a customer off-road on a test drive. It went how you would expect.", garage: "beekers"),
        C("odd_moving_day", VehicleHash.Rebel2, JobKind.Flatbed, 195, "Moving crew", "Old pickup loaded with furniture quit halfway through a move. Load stays on it.", garage: "beekers"),
        C("odd_driveway_slide", VehicleHash.Cavalcade, JobKind.Winchout, 265, "Homeowner - Pat", "SUV slid down an icy driveway and stopped against a mailbox. Mailbox lost.", garage: "paleto", damage: Damage.Rear),
        C("odd_late_night_bar", VehicleHash.Dominator, JobKind.Illegal, 220, "Bar owner", "Left in the lot after close, third night running. Owner wants it towed before opening.", garage: "impound"),
        C("odd_ferry_line", VehicleHash.Regina, JobKind.Flatbed, 240, "Ferry terminal", "Car died in the Los Santos ferry queue. Everyone behind it is furious. Boat leaves in twenty.", garage: "airport"),
        C("odd_bridge_stall", VehicleHash.Minivan, JobKind.Flatbed, 255, "LSPD Traffic", "Minivan stalled on the bridge span. Narrow shoulder, high wind, take the amber all the way up.", garage: "lamesa", cones: true),
        C("odd_construction_zone", VehicleHash.Rebel, JobKind.Flatbed, 235, "Site foreman", "Pickup dead inside an active work zone. Flaggers will hold traffic for you.", garage: "beekers", cones: true),
        C("odd_dealer_lot_dead", VehicleHash.Dubsta, JobKind.Flatbed, 225, "Dealer - Kim", "Trade-in that will not start, sitting in the middle of the display row. Move it out.", garage: "beekers"),
        C("odd_impound_release", VehicleHash.Gauntlet, JobKind.Flatbed, 200, "Impound clerk", "Released from impound but it will not run. Take it to the shop the owner picked.", garage: "lamesa"),
        C("odd_track_trailer", VehicleHash.Penumbra, JobKind.Flatbed, 270, "Track steward", "Blown motor at a track day. It is going to the import shop, not the track shop.", garage: "airport"),
        C("odd_grocery_runaway", VehicleHash.Serrano, JobKind.Crash, 205, "Grocery manager", "Car rolled out of a parking space into a cart corral. Nobody was in it. It is fine.", garage: "lamesa", damage: Damage.Front),
        C("odd_snowbank_plow", VehicleHash.Dilettante, JobKind.Winchout, 230, "Angela D.", "Plow packed her in solid. Front bumper is under two feet of ice.", garage: "paleto"),
        C("odd_church_lot", VehicleHash.Emperor, JobKind.Jump, 120, "Deacon Wells", "Old Emperor will not start after service. He would rather not hold up coffee hour.", garage: "burton"),
        C("odd_marina_ramp", VehicleHash.Sadler, JobKind.Winchout, 350, "Marina office", "Truck slid on the ramp with the boat still hooked. Boat is out, truck is not.", garage: "beekers", heavy: true),
        C("odd_alley_wedge", VehicleHash.Boxville, JobKind.Winchout, 280, "Delivery dispatch", "Van wedged between a dumpster and a wall. No damage yet. Emphasis on yet.", garage: "beekers"),
        C("odd_school_bus_lot", VehicleHash.Bus, JobKind.Flatbed, 420, "Transit yard", "Shuttle will not start in the yard. Big, heavy, and blocking two other buses.", garage: "beekers", heavy: true),
        C("odd_first_car", VehicleHash.Emperor2, JobKind.Flatbed, 160, "Teenager - Milo", "First car, first breakdown, second week. He is taking it hard. Be nice.", garage: "burton"),
        C("odd_rain_stall", VehicleHash.Blista, JobKind.Flatbed, 185, "Dana R.", "Same Blista as last week, now hydrolocked from the flooded intersection. She is embarrassed.", garage: "burton"),
        C("odd_valet_mixup", VehicleHash.Voltic, JobKind.Lockout, 130, "Valet manager", "Valet locked the keys in a very expensive car. He would like this handled discreetly.", noTow: true),
        C("odd_gate_blocked", VehicleHash.Bison, JobKind.Illegal, 215, "Warehouse foreman", "Pickup parked across the loading gate. Nobody in or out until it moves.", garage: "impound"),
        C("odd_beach_sand", VehicleHash.Mesa, JobKind.Winchout, 300, "Beach patrol", "Buried to the diffs in soft sand past the dune line. Long, slow pull.", garage: "beekers"),
        C("odd_car_show_dead", VehicleHash.Stanier, JobKind.Jump, 125, "Show organizer", "Show car with a dead battery and a trophy to collect. Jump it and load it.", garage: "burton"),
        C("odd_uturn_curb", VehicleHash.Premier, JobKind.Crash, 245, "LSPD Traffic", "Illegal U-turn ended on the kerb. Both passenger wheels are off the ground.", garage: "lamesa", damage: Damage.Side),
        C("odd_night_repo_lot", VehicleHash.Rebel, JobKind.Repo, 310, "Fleeca Bank", "Recovery in an unlit lot after hours. Amber on, get it up, get out.", garage: "impound", quiet: true),
        C("odd_delivery_double", VehicleHash.Boxville, JobKind.Illegal, 190, "Parking Authority", "Double parked on a bus route for two hours. Transit is filing complaints.", garage: "impound"),
        C("odd_transmission_drop", VehicleHash.Regina, JobKind.Flatbed, 250, "Renata V.", "Wagon dropped its transmission fluid across two blocks. Do not roll it far.", garage: "bennys"),
        C("odd_farm_truck", VehicleHash.Rebel2, JobKind.Winchout, 270, "Farmer - Ellis", "Old truck sank into the field access. Chains, not straps, for the pull.", garage: "beekers"),
        C("odd_electric_dead", VehicleHash.Serrano, JobKind.Flatbed, 230, "Simone R.", "Battery at zero, no charge, no crank. Neutral only with the override. Take it slow.", garage: "bennys"),
        C("odd_double_flat_hwy", VehicleHash.Cavalcade, JobKind.Tire, 280, "The Voss family", "Two flats on the freeway from the same pothole. Nobody has two spares.", garage: "paleto", flats: 2, cones: true, freeway: true),
        C("odd_night_crash_pole", VehicleHash.Prairie, JobKind.Crash, 290, "LSPD Traffic", "Single car into a utility pole after midnight. Power crew is on the way, wait for their clear.", garage: "lamesa", damage: Damage.Front),
        C("odd_pickup_bed_load", VehicleHash.Bison, JobKind.Crash, 300, "LSPD Traffic", "Loaded pickup rear-ended at a light. Bed is buckled, tailgate is in the road.", garage: "beekers", damage: Damage.Rear),
        C("odd_alley_bike", VehicleHash.Bati, JobKind.Winchout, 180, "Rider - Kai", "Bike dropped in an alley and jammed under a stoop. Lift it out, do not drag it.", garage: "airport"),
        C("odd_last_call", VehicleHash.Gauntlet, JobKind.Flatbed, 265, "Carla J.", "Same Gauntlet, same electrical gremlin, third time this month. She has stopped laughing.", garage: "lamesa"),        };

        public static int Count { get { return All.Length; } }

        // Picks a call that has not run yet this session, falling back to the
        // whole board once every one of them has been out at least once.
        public static Call Pick(Random rng, HashSet<string> used)
        {
            var pool = All.Where(c => !used.Contains(c.Id)).ToArray();
            if (pool.Length == 0) { used.Clear(); pool = All; }
            return pool[rng.Next(pool.Length)];
        }

        public static Call ById(string id)
        {
            return All.FirstOrDefault(c => c.Id == id);
        }
    }
}
