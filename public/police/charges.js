/* Police Form Maker — charge book.
   Codes follow a made-up state code: VC = Vehicle Code, PC = Penal Code,
   HS = Health & Safety, MC = Municipal Code, PR = Parks, FW = Fireworks,
   FC = Fire Code, BP = Business & Professions, HN = Harbors & Navigation,
   FG = Fish & Game, DR = Drone ordinance, ED = Education / minors,
   SW = Solid Waste. Fines are base fines before fees.

   Infraction rows:  "Title|fine"  or  "Title|fine|C"  (C = correctable / fix-it)
   Arrest rows:      "Title|class|fine|months"  (class F or M, months L = life) */
(function () {
  const traffic = [], other = [], arrest = [];

  function rowsOf(src) {
    return Array.isArray(src) ? src : src.split('\n').map(s => s.trim()).filter(Boolean);
  }
  function add(list, kind, prefix, ch, cat, src) {
    let n = 0;
    for (const r of rowsOf(src)) {
      n++;
      const p = r.split('|');
      const code = prefix + ' ' + ch + '-' + String(n).padStart(3, '0');
      const id = kind[0] + ':' + code;
      if (kind === 'arrest') {
        arrest.push({ id, code, kind, cat, title: p[0], cls: p[1], fine: +p[2], months: p[3] === 'L' ? -1 : +p[3] });
      } else {
        list.push({ id, code, kind, cat, title: p[0], fine: +p[1], fix: p[2] === 'C' });
      }
    }
  }
  const T = (prefix, ch, cat, src) => add(traffic, 'traffic', prefix, ch, cat, src);
  const O = (prefix, ch, cat, src) => add(other, 'other', prefix, ch, cat, src);
  const A = (prefix, ch, cat, src) => add(arrest, 'arrest', prefix, ch, cat, src);
  const r5 = n => Math.round(n / 5) * 5;

  /* ===================================================== TRAFFIC ===== */

  const zones = [
    ['in a residential district', 1], ['in a business district', 1], ['on a city street', 1],
    ['on a two-lane rural highway', 1], ['on a divided state highway', 1], ['on an interstate or freeway', 1],
    ['in a school zone with children present', 2], ['in an active work zone with workers present', 2],
    ['in a construction zone, no workers present', 1.25], ['in a posted park or playground zone', 1.5]
  ];
  const tiers = [['1–5', 100], ['6–10', 150], ['11–15', 200], ['16–20', 250], ['21–25', 300],
    ['26–30', 375], ['31–40', 475], ['41–50', 600], ['51 or more', 800]];
  const speed = [];
  for (const [z, m] of zones) for (const [t, f] of tiers) speed.push(`Speeding ${t} mph over the limit ${z}|${r5(f * m)}`);
  speed.push(...rowsOf(`
    Unsafe speed for conditions — rain or wet roadway|238
    Unsafe speed for conditions — fog or reduced visibility|238
    Unsafe speed for conditions — snow or ice|238
    Unsafe speed for conditions — heavy traffic|238
    Unsafe speed for conditions — darkness|238
    Unsafe speed for conditions — sharp curve|238
    Unsafe speed for conditions — hillcrest or blind approach|238
    Unsafe speed for conditions — smoke or blowing dust|238
    Unsafe speed for conditions — standing water|238
    Unsafe speed for conditions — pedestrians present|238
    Exceeding 55 mph while towing a trailer|238
    Exceeding 55 mph in a truck with three or more axles|238
    Exceeding 100 mph|900
    Driving below the posted minimum speed|150
    Impeding traffic by driving too slowly|150
    Failure to use a turnout with five or more vehicles following|150
    Failure to reduce speed approaching an intersection|200
    Failure to reduce speed approaching a railroad crossing|200
    Failure to reduce speed approaching a stopped emergency vehicle|300
    Excessive speed on a bridge, causeway or tunnel|238
    Speeding in a posted senior citizen zone|300
    Speeding in a posted hospital zone|300
    Exceeding 25 mph with tire chains installed|200
    Exceeding 15 mph in an alley|150
    Exceeding 15 mph near a railroad crossing with no clear view|200
    Exceeding 15 mph at a blind uncontrolled intersection|200
    Exceeding a variable (electronic) speed limit|238`));
  T('VC', 1, 'Speed', speed);

  T('VC', 2, 'Signals, signs & right-of-way', `
    Failure to stop at a stop sign|238
    Failure to stop at the limit line (rolling stop)|238
    Stopping past the limit line at a stop sign|150
    Failure to stop for a steady red signal|490
    Failure to stop for a red signal before turning right|490
    Right turn on red where posted "No Turn on Red"|238
    Left turn on red where prohibited|490
    Failure to stop for a flashing red signal|238
    Failure to proceed with caution at a flashing yellow signal|150
    Failure to obey a lane-use control signal|238
    Failure to obey a traffic control device|238
    Failure to obey a posted regulatory sign|200
    Failure to obey a "Do Not Enter" sign|238
    Failure to obey a "Wrong Way" sign|238
    Failure to obey a "One Way" sign|238
    Failure to obey a "No U-Turn" sign|238
    Failure to obey a "No Left Turn" sign|238
    Failure to obey a "No Right Turn" sign|238
    Failure to obey a "Keep Right" sign|200
    Failure to obey a "Stop Here on Red" sign|150
    Failure to obey a ramp meter signal|238
    Failure to obey an officer directing traffic|238
    Failure to obey a flagger in a work zone|300
    Failure to obey a school crossing guard|238
    Driving around a "Road Closed" barricade|300
    Driving through a transit safety zone|200
    Driving over a fire hose without consent|238
    Failure to yield at a yield sign|238
    Failure to yield at an uncontrolled intersection|238
    Failure to yield at a T-intersection|238
    Failure to yield when turning left|238
    Failure to yield when entering from a private driveway|238
    Failure to yield when entering a road from an alley|238
    Failure to yield when merging onto a freeway|238
    Failure to yield to traffic already in a roundabout|238
    Failure to yield to a pedestrian in a marked crosswalk|238
    Failure to yield to a pedestrian in an unmarked crosswalk|238
    Failure to yield to a blind pedestrian with a white cane or guide dog|490
    Failure to yield to a pedestrian on a sidewalk when leaving a driveway|238
    Passing a vehicle stopped for a pedestrian at a crosswalk|490
    Failure to yield to an emergency vehicle with lights and siren|490
    Failure to yield to a transit bus re-entering traffic|200
    Failure to yield to a funeral procession|200
    Failure to yield to a horse rider or animal-drawn vehicle|200
    Failure to yield to a bicyclist in a bike lane when turning|238
    Failure to yield to a pedestrian when turning on a green signal|238
    Entering an intersection without room to clear (blocking the box)|238
    Blocking an intersection on a red signal|238
    Failure to stop before crossing a sidewalk from a driveway|150
    Failure to stop when emerging from an alley|150
    Driving the wrong way on a one-way street|238
    Driving on the wrong side of a divided highway|490
    Driving left of center on a curve|238
    Driving left of center on a two-lane road|238
    Crossing a median or divider|300
    Crossing a double solid yellow line|238
    Crossing a painted gore area|238
    Crossing double solid white lines into an express lane|490
    Failure to keep right when driving slower than traffic|200
    Failure to drive within a single lane (weaving)|238
    Straddling lane lines|200`);

  T('VC', 3, 'Turns, passing & lane use', `
    Unsafe lane change|238
    Lane change without signaling|238
    Changing lanes within an intersection|200
    Changing lanes across a solid white line|200
    Failure to signal a turn|238
    Failure to signal 100 feet before turning|238
    Failure to signal when leaving a parked position|150
    Failure to signal a stop or sudden slowdown|150
    Improper hand signal|100
    Unsafe turn|238
    Improper right turn (wide right turn)|238
    Improper left turn (cutting the corner)|238
    Left turn from the wrong lane|238
    Right turn from the wrong lane|238
    Improper use of a center turn lane|238
    Driving in a two-way left-turn lane for more than 200 feet|238
    Illegal U-turn in a business district|238
    Illegal U-turn in a residential district with traffic approaching|238
    Illegal U-turn across a divided highway median|238
    Illegal U-turn in front of a fire station|238
    Illegal U-turn where the view is obstructed|238
    Illegal U-turn on a freeway|490
    Illegal U-turn at a signal where prohibited|238
    Unsafe passing on the left|238
    Unsafe passing on the right|238
    Passing on the right by leaving the paved roadway|238
    Passing on the shoulder|238
    Passing in a no-passing zone|238
    Passing on a hill or curve with obstructed view|238
    Passing within 100 feet of an intersection|238
    Passing within 100 feet of a railroad crossing|238
    Passing within 100 feet of a bridge, viaduct or tunnel|238
    Failure to return to the right lane after passing|200
    Increasing speed while being passed|200
    Cutting in too closely after passing|238
    Passing a bicyclist with less than 3 feet of clearance|238
    Following too closely (tailgating)|238
    Following a fire engine within 300 feet|238
    Following too closely while towing|238
    Following too closely in a caravan of trucks|238
    Continuous use of the left lane when not passing|200
    Driving in a bicycle lane|238
    Driving in a bus-only lane|238
    Driving in a transit-only lane during restricted hours|238
    Driving on the shoulder|238
    Driving on a sidewalk|238
    Driving on a bike path or trail|238
    Cutting through a parking lot or gas station to avoid a signal|200
    HOV lane — single occupant|490
    HOV lane — fewer occupants than the posted minimum (3+)|490
    Unsafe backing|238
    Backing on a freeway|490
    Backing farther than necessary|150
    Unsafe start from a stopped position|238
    Unsafe start from a parked position|238
    Coasting downhill in neutral|150
    Traveling the wrong direction in a roundabout|238
    Entering a freeway other than at a ramp|490
    Exiting a freeway other than at a ramp|490
    Stopping on a freeway except in an emergency|238`);

  T('VC', 4, 'Driver conduct & distracted driving', `
    Handheld phone while driving — talking|162
    Handheld phone while driving — texting|162
    Handheld phone while driving — browsing or apps|162
    Handheld phone while driving — watching video|238
    Handheld phone while driving — second offense within 36 months|285
    Handheld phone in a school zone|300
    Handheld phone in a work zone|300
    Any wireless device use while driving under age 18|162
    Wireless device use while driving a commercial vehicle|500
    Wireless device use while driving a school bus or transit vehicle|500
    Video screen visible to the driver while moving|238
    Headphones or earplugs in both ears while driving|200
    Driving with an obstructed view (passengers or cargo)|200
    More than three persons in the front seat|150
    Driving with a pet on the driver's lap|150
    Unsecured animal in an open pickup bed|200
    Allowing a passenger to ride in a pickup bed|200
    Allowing a passenger to ride on the outside of a vehicle|238
    Riding on the outside of a vehicle|150
    Opening a vehicle door into traffic|200
    Leaving a door open on the traffic side longer than necessary|150
    Leaving a vehicle unattended with the engine running|150
    Leaving a child under 6 unattended in a vehicle|300
    Leaving an animal unattended in a hot vehicle|300
    Unnecessary use of the horn|100
    Unnecessary tire squeal or burnout|238
    Careless driving|238
    Inattentive driving|238
    Smoking in a vehicle with a minor present|100
    Open container of alcohol in vehicle — driver|238
    Open container of alcohol in vehicle — passenger|238
    Drinking an alcoholic beverage while driving|238
    Open container of cannabis in a vehicle|238
    Smoking cannabis while driving|238
    Smoking cannabis as a passenger in a moving vehicle|238
    Driver under 21 with BAC of 0.01–0.04% (zero tolerance)|238
    Driver under 21 transporting alcohol without a parent|238
    Failure to report a collision to the DMV within 10 days|150
    Failure to move a vehicle out of traffic after a minor collision|150
    Following an emergency vehicle to its call|238
    Driving through a funeral procession or parade|200
    Carrying a passenger in a towed trailer|200
    Towing a person on a sled, skateboard or bicycle|238`);

  T('VC', 5, 'Parking & stopping', `
    Parking within 15 feet of a fire hydrant|150
    Parking in a red zone|100
    Parking in a fire lane|200
    Parking in a disabled space without a placard|350
    Parking in a disabled-access aisle (striped area)|350
    Misuse of a disabled parking placard|500
    Parking in a crosswalk|100
    Parking within 20 feet of a crosswalk at an intersection|75
    Parking within 30 feet of a stop sign|75
    Parking within 50 feet of a railroad crossing|100
    Parking on a sidewalk|75
    Parking in a bike lane|100
    Double parking|100
    Blocking a private driveway|75
    Blocking a public alley|75
    Parking in a bus stop|250
    Parking in a loading zone|75
    Parking in a passenger loading (white) zone|75
    Parking in a commercial (yellow) zone|75
    Parking in a taxi zone|75
    Parking in a no-parking zone|75
    Parking in a tow-away zone|100
    Parking during posted street-sweeping hours|65
    Expired parking meter|50
    Feeding a parking meter beyond the posted time limit|50
    Overtime parking in a time-limited zone|50
    Parking without a permit in a residential permit district|75
    Parking facing against traffic|50
    Parking more than 18 inches from the curb|50
    Parking outside marked space lines|50
    Parking in an EV charging space while not charging|100
    Parking on a freeway shoulder for a non-emergency|238
    Parking on a rural roadway when the shoulder is available|100
    Parking in an intersection|100
    Parking on a bridge or overpass|100
    Parking in a tunnel|100
    Parking on the traveled portion of a highway|100
    Parking within 15 feet of a fire station driveway|100
    Parking on a hill without curbing the wheels|50
    Parking on a public street for more than 72 hours|100
    Parking a vehicle displayed for sale on a public street|75
    Parking a commercial vehicle over 10,000 lbs on a residential street|100
    Parking a trailer or RV on a public street overnight|75
    Parking an inoperable vehicle on a public street|100
    Parking on posted private property without consent|75
    Parking on a public parkway strip or lawn|50
    Parking in a public park after hours|75
    Parking in a school zone during school hours|100
    Parking in a reserved government vehicle space|75
    Parking in a carpool or vanpool space|75
    Stopping or standing in a no-stopping zone|100
    Stopping on railroad tracks|238
    Angle parking where parallel parking is required|50
    Parking so as to obstruct traffic|100
    Parking on the left side of a two-way street|50
    Parking on a median|75
    Car parked in a motorcycle-only space|50
    Full-size vehicle in a compact-only space|35
    Abandoning a vehicle on a highway|300`);

  T('VC', 6, 'Registration & license plates', `
    Expired registration — 1 to 30 days|75|C
    Expired registration — 31 to 90 days|125|C
    Expired registration — 91 days to 6 months|175|C
    Expired registration — 6 months to 1 year|238|C
    Expired registration — more than 1 year|300
    Unregistered vehicle (never registered in this state)|300
    Out-of-state registration after 20 days of residency|238
    Current registration tab not displayed|75|C
    Registration tab on the wrong plate or corner|50|C
    Registration card not in vehicle|50|C
    No front license plate displayed|75|C
    No rear license plate displayed|125|C
    License plate not securely fastened|50|C
    License plate obscured by dirt, snow or debris|75|C
    Tinted or reflective license plate cover|100|C
    License plate frame covering the state name or tabs|75|C
    License plate displayed inside the vehicle window|75|C
    License plate blocked by a bike rack, hitch or cargo|75|C
    Expired temporary operating permit|125|C
    Displaying a temporary permit not issued to the vehicle|300
    Displaying a plate issued to another vehicle|490
    Displaying expired dealer plates|125
    Dealer plate used by a non-dealer|300
    Disabled-veteran plate used by an unqualified person|300
    Failure to notify DMV of a change of ownership within 5 days|100
    Failure to transfer title within 10 days|100
    Failure to update the registration address|100
    Unregistered trailer|125|C
    Trailer plate not displayed|75|C
    Motorcycle plate not mounted horizontally|50|C
    Off-highway vehicle without an OHV sticker|125
    Unregistered moped|75|C
    Failure to surrender plates after cancellation|125
    Novelty or fictitious license plate|238
    Plate-blocking spray or anti-camera plate cover|300
    License plate flipper or rotating plate device|500`);

  T('VC', 7, 'Driver’s license', `
    Driver's license not in possession|75|C
    Failure to present a driver's license on demand|100
    Expired driver's license — less than 30 days|75|C
    Expired driver's license — 30 days to 6 months|125|C
    Expired driver's license — more than 6 months|238
    Driving without a valid license (never licensed)|300
    Out-of-state license after 10 days of residency|200
    License restriction — corrective lenses not worn|238
    License restriction — daylight driving only|238
    License restriction — automatic transmission only|150
    License restriction — no freeway driving|200
    Vehicle not covered by the license class|300
    Motorcycle without an M1 / M2 endorsement|300
    Learner permit — no licensed adult 25 or older present|238
    Learner permit — driving between 11 p.m. and 5 a.m.|238
    Provisional license — driving between 11 p.m. and 5 a.m.|238
    Provisional license — passengers under 20 with no adult|238
    Provisional license — using any wireless device|162
    Permitting an unlicensed person to drive|300
    Permitting a minor to drive without a license|300
    Employing an unlicensed driver|300
    Failure to notify DMV of an address change within 10 days|100
    Failure to notify DMV of a name change|100
    Possessing more than one driver's license|300
    Displaying a canceled or suspended license|300
    Lending a driver's license to another person|300
    Using a driver's license issued to another person|490
    Failure to surrender a suspended license|150
    Unsigned driver's license|50|C
    Foreign license used after one year of residency|200
    Motorcycle permit — riding at night|238
    Motorcycle permit — riding on a freeway|238
    Motorcycle permit — carrying a passenger|238`);

  T('VC', 8, 'Insurance & financial responsibility', `
    No proof of insurance — first offense|300|C
    No proof of insurance — second offense within 3 years|600
    Uninsured vehicle|800
    Expired insurance policy|500
    Liability coverage below the state minimum|500
    False or fraudulent proof of insurance|1000
    Failure to give insurance information after a collision|300
    Rideshare driving without commercial coverage|500
    Failure to maintain an SR-22 filing|500
    Insurance card not in vehicle|75|C`);

  T('VC', 9, 'Seat belts & child restraints', `
    Driver not wearing a seat belt|162
    Front passenger 16 or older not wearing a seat belt|162
    Rear passenger 16 or older not wearing a seat belt|162
    Passenger under 16 not buckled (driver responsible)|238
    Seat belt worn behind the back or under the arm|162
    Child under 2 not in a rear-facing car seat|490
    Child under 8 not in a child restraint system|490
    Child under 8 seated in the front seat|490
    Rear-facing child seat in front of an active airbag|490
    Child restraint improperly installed|300|C
    Expired or recalled child restraint|200|C
    Child under 4'9" without a booster seat|490
    Second child-restraint offense|1000
    Taxi or rideshare driver allowing an unrestrained child|490
    Seat belt removed or inoperable|200|C
    More passengers than seat belts|238
    Bus driver not wearing a seat belt|238
    Commercial driver not wearing a seat belt|238
    Passenger riding in the cargo area of an SUV or van|200`);

  T('VC', 10, 'Vehicle equipment', `
    Inadequate service brakes|238|C
    Parking brake inoperable|150|C
    Brake fluid leak|150|C
    Brake warning light illuminated|100|C
    Trailer over 3,000 lbs without brakes|238|C
    Trailer breakaway device missing|200|C
    Excessive play in the steering wheel|200|C
    Vehicle lowered below the bottom of the wheel rims|200|C
    Vehicle lifted beyond the legal frame height|200|C
    Broken or sagging suspension spring|150|C
    Front bumper missing|150|C
    Rear bumper missing|150|C
    Bumper height exceeds the legal limit|150|C
    Tire tread less than 2/32 inch|150|C
    Tire with exposed cords or belts|200|C
    Tire with a sidewall bulge or separation|200|C
    Mismatched tire sizes on the same axle|100|C
    Studded tires used out of season|150
    Tires extending beyond the fenders without flaps|100|C
    Missing lug nuts|150|C
    Spinner hubcaps or projecting wheel ornaments|100|C
    Cracked windshield obstructing the driver's view|100|C
    Shattered or missing windshield|200|C
    Object hanging from the rearview mirror|75|C
    Sticker or sign obstructing the windshield|75|C
    Windshield wipers inoperable|100|C
    Windshield wipers missing|100|C
    Windshield washer inoperable|50|C
    Defroster inoperable|75|C
    Broken side window with sharp edges|100|C
    Rear view obstructed without two side mirrors|100|C
    Rearview mirror missing|100|C
    Left side mirror missing or broken|100|C
    Right side mirror missing (rear view obstructed)|100|C
    Truck convex mirrors missing|150|C
    Horn inoperable|75|C
    Siren or musical horn on a non-emergency vehicle|200|C
    Train horn or air horn louder than permitted|200|C
    No muffler|150|C
    Muffler cutout or bypass installed|200|C
    Modified exhaust over 95 decibels|200|C
    Leaking exhaust system|100|C
    Excessive smoke from the tailpipe|200|C
    "Rolling coal" smoke emissions|500
    Expired smog certification|150|C
    Catalytic converter removed|500|C
    Tampered emissions control device|500|C
    Oxygen sensor defeat device|300|C
    Fenders or mudguards missing|100|C
    Mud flaps missing (truck or trailer)|100|C
    Hood not securely latched|100|C
    Driver door inoperable|100|C
    Trunk lid tied down or unsecured|75|C
    Floor pan rusted through|150|C
    Fuel tank cap missing|75|C
    Fuel leak|200|C
    Oil or coolant dripping onto the roadway|100|C
    Sharp protruding body damage|100|C
    Speedometer inoperable|100|C
    Odometer inoperable|100|C
    Driver seat not securely anchored|100|C
    Airbag removed (warning light on)|200|C
    Counterfeit or nonfunctional airbag installed|500
    Towing without safety chains|200|C
    Improper trailer coupling|200|C
    Trailer without rear reflectors|100|C
    Radar or laser jammer installed|500
    Traffic signal preemption device (unauthorized)|1000
    Engine blower or air scoop extending above the hood|150|C
    Nitrous oxide connected to the engine on a highway|200
    Unsafe vehicle — general condition|238|C
    Missing equipment required for highway use|200|C`);

  T('VC', 11, 'Window tint & visibility', `
    Front side window tint below 70% light transmittance|162|C
    Front side window tint below 35% light transmittance|200|C
    Front side window tint below 20% ("limo" tint)|238|C
    Windshield tint below the AS-1 line|162|C
    Full windshield tint|238|C
    Rear window tint without two side mirrors|162|C
    Mirrored or reflective window tint|200|C
    Red, amber or blue window tint|200|C
    Window tint certificate missing|75|C
    Tinted headlight covers|150|C
    Tinted taillight covers|150|C
    Blacked-out brake light lenses|150|C
    Snow or ice not cleared from windows|150
    Fogged windows obstructing the view|100
    Signs or posters in the windows obstructing the view|75|C
    Curtains or shades on the front windows while driving|100|C
    Phone mount in a prohibited windshield area|75|C
    Dash camera mounted outside the permitted area|75|C`);

  const lamps = [];
  for (const [lamp, f] of [['Headlamp', 100], ['Taillamp', 100], ['Brake lamp', 100]]) {
    for (const side of ['left', 'right']) lamps.push(`${lamp} inoperable — ${side}|${f}|C`);
    lamps.push(`${lamp}s inoperable — both|${f * 2}|C`);
  }
  for (const side of ['left', 'right']) lamps.push(`Front turn signal inoperable — ${side}|75|C`, `Rear turn signal inoperable — ${side}|75|C`);
  lamps.push(...rowsOf(`
    Center high-mount stop lamp inoperable|75|C
    License plate lamp inoperable|75|C
    Side marker lamp inoperable|75|C
    Clearance lamps inoperable (vehicle over 80 inches wide)|100|C
    No headlamps from sunset to sunrise|238
    No headlamps with visibility under 1,000 feet|238
    No headlamps while windshield wipers are in use|162
    Failure to dim high beams for oncoming traffic|162
    Failure to dim high beams when following within 300 feet|162
    Driving with parking lamps only|162
    Headlamps misaimed (blinding)|100|C
    Unapproved HID / LED bulbs in halogen housings|150|C
    Headlamps of a color other than white|150|C
    Red lamp visible from the front|238|C
    Blue lamp on a non-emergency vehicle|300|C
    Flashing lamps on a non-emergency vehicle|200|C
    Emergency-style light bar on a civilian vehicle|300|C
    Strobe lights on a civilian vehicle|200|C
    Underglow or neon lighting lit while driving|150|C
    Lamp of an unapproved color|150|C
    Spotlight aimed at oncoming traffic|150
    More than two spotlights|100|C
    Fog lamps used in clear weather causing glare|100
    Auxiliary off-road lamps lit on a public road|100|C
    Backup lamps lit while moving forward|75|C
    Hazard lamps used while driving (non-emergency)|100
    Failure to use hazard lamps when disabled on a highway|100
    Roof light bar not covered on a public road|150|C
    Lighted or animated sign on the vehicle exterior|150|C
    Trailer without taillamps|150|C
    Trailer without brake lamps|150|C
    Trailer without turn signals|150|C
    Trailer without a license plate lamp|75|C`));
  T('VC', 12, 'Lighting', lamps);

  const weight = [];
  const wtTiers = [['1–1,000', 100], ['1,001–2,000', 200], ['2,001–3,000', 300], ['3,001–4,000', 400],
    ['4,001–5,000', 550], ['5,001–7,500', 800], ['7,501–10,000', 1100], ['10,001–15,000', 1500], ['15,001 or more', 2500]];
  for (const w of ['gross vehicle weight', 'single axle weight', 'tandem axle weight', 'steering axle weight']) {
    for (const [t, f] of wtTiers) weight.push(`Overweight — ${w} exceeded by ${t} lbs|${f}`);
  }
  weight.push(...rowsOf(`
    Over height — over 14 feet without a permit|500
    Over width — over 8 feet 6 inches without a permit|500
    Over length — single vehicle over 40 feet|500
    Over length — combination over 65 feet|500
    Load overhang more than 4 feet in front|300
    Load overhang more than 4 feet behind without a red flag|300
    Oversize load without an "Oversize Load" banner|300
    Oversize load without a required escort vehicle|1000
    Oversize load moving outside permitted hours|500
    Oversize load off the permitted route|1000
    No oversize / overweight permit|1000
    Oversize permit not carried in the vehicle|200|C
    Driving beyond the 11-hour driving limit|1000
    Driving beyond the 14-hour on-duty window|1000
    Driving beyond the 60 / 70-hour weekly limit|1000
    Failure to take a 30-minute break|500
    No record of duty status (logbook)|1000
    Record of duty status not current|500
    False record of duty status|2500
    Electronic logging device not installed|1000
    Electronic logging device tampered with|2500
    Commercial vehicle without a CDL|1500
    Wrong CDL class for the vehicle|1000
    No hazardous materials endorsement|1500
    No tank vehicle endorsement|1000
    No double / triple trailer endorsement|1000
    No passenger endorsement|1000
    No school bus endorsement|1500
    Expired medical examiner's certificate|500|C
    Medical certificate not in possession|150|C
    Driving while disqualified from commercial driving|2500
    Driving in violation of an out-of-service order — driver|2500
    Driving in violation of an out-of-service order — vehicle|2500
    Failure to stop at an open weigh station|500
    Bypassing a weigh station|500
    USDOT number not displayed|500
    Operating without motor carrier authority|1500
    Truck in a restricted (left) lane|238
    Truck off the designated truck route|500
    Truck on a parkway or truck-prohibited road|500
    Brakes out of adjustment (commercial)|500|C
    Audible air brake leak|500|C
    Low air warning device inoperable|300|C
    Fifth wheel improperly secured|500
    No fire extinguisher (commercial)|150|C
    No warning triangles or flares|150|C
    Failure to place warning devices when stopped|300
    Radar detector in a commercial vehicle|500
    Cargo not secured with tiedowns|500
    Insufficient number of tiedowns|500
    Damaged tiedowns or straps|300|C
    Annual inspection decal missing or expired|300|C
    Hazmat — no placards displayed|1500
    Hazmat — wrong placards displayed|1000
    Hazmat — no shipping papers|1000
    Hazmat — shipping papers not within reach|500
    Hazmat — no emergency response information|500
    Hazmat — leaking container|2500
    Hazmat — parked within 5 feet of the roadway|500
    Hazmat — smoking within 25 feet of the vehicle|500
    Hazmat — failure to stop at a railroad crossing|1500
    Bus over seating capacity|500
    Bus emergency exit obstructed|500|C
    Charter bus without a passenger manifest|200`));
  T('VC', 13, 'Commercial vehicles', weight);

  T('VC', 14, 'Loads & towing', `
    Unsecured load spilling or leaking|300
    Items falling from a vehicle|300
    Uncovered load of sand, gravel or dirt|300
    Load extending more than 3 feet past the left fender|200
    Load extending past the right fender|200
    Load extending more than 4 feet behind without a red flag|200
    Load obstructing the driver's view|200
    Load blocking lamps or the license plate|150|C
    Dragging chains or objects on the roadway|200
    Towing more than one trailer (non-commercial)|238
    Tow bar longer than 15 feet|200
    License class does not cover the towing combination|300
    Ladder or lumber unsecured on the roof|300
    Mattress or furniture unsecured on the roof|300
    Mud or debris tracked onto the roadway|300`);

  T('VC', 15, 'Motorcycles', `
    Operator without a DOT-compliant helmet|238
    Passenger without a DOT-compliant helmet|238
    Novelty helmet without DOT certification|238
    Handlebars more than 6 inches above shoulder height|200|C
    No passenger footrests|150|C
    Passenger seated in front of the operator|200
    Carrying a passenger without a passenger seat|200
    Operator not seated astride the seat|150
    Riding a wheelie|300
    Carrying a package that prevents both hands on the bars|150
    Unsafe lane splitting|238
    Lane splitting more than 10 mph faster than traffic|238
    Riding more than two abreast in one lane|150
    Headlamp not lit while riding|162|C
    Motorcycle without mirrors|100|C
    Straight pipes / no muffler|200|C
    Exhaust without an EPA label|200|C
    Holding onto another vehicle while riding|238
    Moped on a freeway|238
    Riding a motorcycle on a sidewalk|238`);

  T('VC', 16, 'Bicycles, e-bikes & scooters', `
    Bicycle — no white front lamp at night|100|C
    Bicycle — no red rear reflector|100|C
    Bicycle — no pedal or side reflectors|100|C
    Bicycle — no working brake|100|C
    Bicycle — riding against traffic|100
    Bicycle — riding on a sidewalk in a business district|100
    Bicycle — failure to stop at a stop sign|238
    Bicycle — failure to stop at a red signal|238
    Bicycle — headphones in both ears|100
    Bicycle — rider under 18 without a helmet|25
    Bicycle — passenger without a proper seat|100
    Bicycle — holding onto a moving vehicle|100
    Bicycle — riding on a freeway|238
    Bicycle — failure to ride as far right as practicable|100
    Bicycle — riding more than two abreast|100
    Bicycle — handlebars above the shoulders|100|C
    Bicycle — riding under the influence|250
    Electric scooter — rider under 18 without a helmet|25
    Electric scooter — riding on a sidewalk|100
    Electric scooter — carrying a passenger|100
    Electric scooter — no driver's license or permit|100
    Electric scooter — exceeding 15 mph|100
    Electric scooter — on a road over 25 mph outside a bike lane|200
    Electric scooter — left lying on a sidewalk|100
    E-bike — Class 3 rider under 16|100
    E-bike — Class 3 on a bike path|100
    E-bike — modified to exceed 28 mph|200
    Skateboarding in a roadway where prohibited|100
    Roller skating in a roadway where prohibited|50
    Hoverboard or electric unicycle in a roadway|100`);

  T('VC', 17, 'Pedestrians', `
    Crossing against a "Don't Walk" signal|196
    Crossing against a red signal|196
    Jaywalking between signal-controlled intersections|196
    Failure to yield to vehicles outside a crosswalk|196
    Stepping off a curb into the path of a vehicle|196
    Walking on a freeway|238
    Walking in the roadway when a sidewalk is available|100
    Walking on the wrong side of a rural road|100
    Hitchhiking in the roadway|100
    Soliciting business from vehicle occupants in the roadway|150
    Pedestrian under the influence in the roadway|200
    Crossing railroad tracks with the gates down|300
    Walking on a bridge where pedestrians are prohibited|100
    Failure to obey a crossing guard|100
    Sitting or lying in the roadway|150`);

  T('VC', 18, 'Railroad crossings', `
    Failure to stop for an approaching train|490
    Driving around lowered crossing gates|490
    Driving through flashing crossing signals|490
    Bus failing to stop at a railroad crossing|500
    School bus failing to stop at a railroad crossing|1000
    Shifting gears while crossing the tracks (commercial)|300
    Entering a crossing without room to clear the tracks|490
    Failure to obey a railroad flagger|300
    Crossing tracks away from a designated crossing|300
    Failure to stop for a light-rail signal|490
    Turning in front of a light-rail vehicle|490`);

  T('VC', 19, 'School buses & emergency vehicles', `
    Passing a school bus with red lights flashing — same direction|700
    Passing a school bus with red lights flashing — opposite direction|700
    Passing a stopped school bus — second offense|1000
    School bus driver failing to activate red lights|300
    School bus driver failing to escort children across|300
    Failure to move over for a stopped emergency vehicle|490
    Failure to slow down for a stopped emergency vehicle|490
    Failure to move over for a stopped tow truck|490
    Failure to move over for a highway maintenance or utility vehicle|490
    Failure to move over for a disabled vehicle with hazards on|238
    Parking within 500 feet of a fire to watch|200
    Driving into a block where an emergency vehicle is stopped|200
    Interfering with an emergency vehicle response|490
    Unauthorized use of an emergency siren|490
    Passing a transit bus loading passengers|238`);

  T('VC', 20, 'Littering, noise & emissions', `
    Littering from a vehicle|500
    Throwing a lit cigarette from a vehicle|500
    Dumping waste from a vehicle on a highway|1000
    Discharging sewage or wastewater onto a roadway|500
    Vehicle fluids spilled on the roadway|300
    Amplified sound system audible at 50 feet|200
    Amplified sound system in a residential area at night|300
    Excessive engine revving in a residential area|200
    Engine compression (jake) brake where posted|300
    Commercial vehicle idling more than 5 minutes|300
    Idling near a school more than 30 seconds|100`);

  T('VC', 21, 'Off-highway vehicles & golf carts', `
    ATV on a public street|238
    Dirt bike on a public street|238
    Golf cart outside a designated golf-cart zone|150
    Golf cart at night without lamps|150|C
    Golf cart driven by an unlicensed person|200
    Low-speed vehicle on a road over 35 mph|200
    Snowmobile on a plowed highway|200
    Off-highway vehicle without a spark arrester|150|C
    Off-highway vehicle on private land without consent|200
    Off-highway vehicle in a closed area|300
    Child under 14 driving an ATV unsupervised|200
    Passenger on a single-rider ATV|200
    Go-kart or minibike on a public street|200
    Farm tractor without a slow-moving vehicle emblem|150|C
    Driving on a beach where prohibited|200`);

  T('VC', 22, 'Tolls & express lanes', `
    Toll evasion — failure to pay|100
    Toll evasion — repeat violation|250
    Toll lane without a transponder|100
    Express lane without a transponder|100
    Misdeclared occupancy on a switchable transponder|200
    Crossing toll lane barriers|200
    Obscuring a license plate to evade tolls|500
    Stolen or altered toll transponder|500
    Toll bridge — failure to pay|100
    Stopping or backing up in a toll plaza|150`);

  T('VC', 23, 'Winter & mountain driving', `
    No tire chains carried in a chain-control area|200
    Failure to install chains when required|200
    Commercial vehicle failing to chain up when required|500
    Driving past a chain-control checkpoint without chains|300
    Installing or removing chains in a traffic lane|150
    Failure to clear snow from the vehicle roof|150
    Driving on a closed mountain pass|300`);

  /* ============================================== OTHER INFRACTIONS == */

  O('MC', 1, 'Noise & nuisance', `
    Loud party disturbing neighbors|250
    Amplified music audible past the property line after 10 p.m.|250
    Construction noise outside permitted hours|500
    Leaf blower used outside permitted hours|100
    Gas-powered leaf blower in a ban zone|100
    Car alarm sounding more than 20 minutes|100
    Unreasonable noise from a business|500
    Outdoor speakers without a permit|250
    False alarm — 3rd in 12 months|100
    False alarm — 5th or more in 12 months|250
    Truck loading noise before 7 a.m.|250
    Ice cream truck chimes outside permitted hours|100
    Shouting in a residential area late at night|150
    Loud musical instruments at night|150
    Livestock noise in a residential zone|100
    Generator noise at a residence|150
    Nuisance property — repeated police calls|500
    Rooftop or balcony party over the noise limit|250`);

  O('MC', 2, 'Public conduct', `
    Open container of alcohol in public|250
    Drinking alcohol in public|250
    Public urination|300
    Spitting on a public sidewalk|100
    Littering on a public street|250
    Littering cigarette butts|100
    Loitering in a posted no-loitering area|150
    Loitering on school grounds|250
    Loitering at an ATM|150
    Sitting or lying on a sidewalk during business hours|100
    Camping on a public sidewalk|100
    Sleeping in a vehicle where prohibited|100
    Panhandling within 20 feet of an ATM or bus stop|100
    Feeding pigeons where prohibited|100
    Posting handbills on utility poles|100
    Shopping cart left on public property|100
    Removing a shopping cart from store premises|100
    Climbing on a public statue or monument|150
    Swimming in a public fountain|100
    Skateboarding in a posted downtown district|100
    Bicycle riding in a pedestrian mall|100
    Smoking in a public building|250
    Smoking within 20 feet of a building entrance|100
    Smoking at a bus stop or transit shelter|100
    Vaping in a smoke-free public area|100
    Smoking in an outdoor dining area|100
    Eating or drinking on a transit vehicle|100
    Fare evasion on public transit|250
    Playing loud music on a transit vehicle|100
    Riding between transit cars|250
    Ticket scalping on public property|250
    Street performing without a permit in a permit zone|100
    Car washing with runoff into a storm drain|100
    Personal property blocking a public sidewalk|100`);

  O('MC', 3, 'Animal control', `
    Dog off leash in a public area|150
    Dog off leash outside a designated park area|150
    Unlicensed dog|75|C
    Unlicensed cat (where required)|50|C
    Dog not vaccinated for rabies|150|C
    Rabies tag not displayed|50|C
    Failure to pick up dog waste|100
    Barking dog — persistent noise|100
    Animal at large|150
    Livestock loose on a roadway|250
    More than the allowed number of pets|150
    Livestock or poultry in a residential zone|150
    Rooster in a residential zone|150
    Failure to spay or neuter where required|200|C
    Dog not microchipped|100|C
    Selling animals on a public street|250
    Pet dog in a restaurant (not a service animal)|100
    Dog on a beach where prohibited|150
    Failure to confine a dog in heat|100
    No shelter for an outdoor dog|250
    Tethering a dog for more than 3 hours|250
    Feeding feral cats where prohibited|100
    Failure to report an animal bite|200
    Wild animal kept without a permit|500
    Beekeeping without a permit|100
    Misrepresenting a pet as a service animal|250
    Violating dangerous-dog restrictions|500`);

  O('PR', 1, 'Parks & beaches', `
    In a park after closing hours|100
    Camping outside a designated campsite|200
    Fire outside a designated fire ring|250
    Alcohol in a park where prohibited|150
    Glass container on a beach|100
    Feeding wildlife in a park|150
    Littering in a park|250
    Vehicle on a park trail|200
    Bicycle on a closed trail|150
    Swimming in a prohibited area|150
    Swimming where posted with no lifeguard on duty|100
    Surfing in a designated swimming area|100
    Jumping or diving from a pier|250
    Fishing from a pier where prohibited|100
    Damaging plants or trees in a park|250
    Removing rocks, plants or artifacts from a park|250
    Leaving a campfire unattended|500
    Exceeding campsite occupancy|100
    Failure to pay a park day-use fee|100
    Park parking pass not displayed|75
    Amplified music in a park without a permit|150
    Organized event in a park without a permit|300
    Golfing outside a golf area|100
    Metal detecting without a permit|100
    Drone launched in a park where prohibited|250
    Horseback riding off designated trails|150
    Smoking on a public beach|100
    Grilling on a beach outside designated areas|100
    Sleeping on a beach overnight|100
    Entering a closed wildlife-nesting area|250
    Tampering with park equipment|250
    Adult in a playground without a child|100
    Vending in a park without a permit|250
    Skateboarding outside a designated skate area|100
    Oversized tent or shade structure on a beach|100`);

  O('HS', 10, 'Alcohol, tobacco & cannabis', `
    Minor in possession of alcohol|250
    Minor in possession of tobacco or vape products|75
    Minor attempting to buy alcohol|250
    Minor attempting to buy tobacco|75
    Person under 21 in possession of cannabis (under 28.5 g)|100
    Smoking cannabis in a public place|100
    Smoking cannabis where tobacco smoking is banned|250
    Open container of cannabis in public|100
    Adult in possession of cannabis on school grounds|250
    Growing more than six cannabis plants (infraction level)|250
    Cannabis plants visible from a public place|250
    Possession of drug paraphernalia (infraction level)|100
    Selling tobacco without a retail license|500
    Selling flavored tobacco where banned|500
    Selling single cigarettes|250
    No age-of-sale sign posted|200
    Self-service tobacco display|250
    Bar serving after legal hours|500
    Liquor license not posted|200
    Drinking alcohol in a vehicle in a parking lot|250
    Drinking alcohol on a public beach|150
    Alcohol at a school event|250
    Nitrous oxide canisters for recreational use|250`);

  O('FW', 1, 'Fireworks', `
    Possession of illegal fireworks (under 25 lbs)|500
    Setting off illegal fireworks|1000
    Setting off legal fireworks outside permitted dates|250
    Fireworks in a high fire-hazard zone|1000
    Fireworks in a park or on a beach|500
    Selling fireworks without a permit|1000
    Selling fireworks to a minor|1000
    Minor in possession of fireworks|250
    Fireworks within 100 feet of a gas station|1000
    Releasing a sky lantern|250`);

  O('FC', 1, 'Fire code', `
    Open burning without a permit|500
    Burning trash or yard waste|500
    Recreational fire on a no-burn day|250
    Failure to keep 100 feet of defensible space|500|C
    Dry brush on a vacant lot (fire hazard)|250|C
    Blocked fire exit|500|C
    Locked or chained fire exit|1000|C
    Over the posted occupancy limit|1000
    Expired fire extinguisher in a business|150|C
    Inoperable smoke alarm in a rental unit|250|C
    Extension cords used as permanent wiring|150|C
    Barbecue on an apartment balcony|100
    Propane stored indoors|250|C
    Discarding lit tobacco in a fire-hazard area|500
    Spark-producing equipment in a fire zone|500
    Fire lane blocked on private property|250|C`);

  O('MC', 4, 'Property maintenance & code enforcement', `
    Overgrown weeds or grass|150|C
    Junk or debris in a front yard|150|C
    Inoperable vehicle stored in a yard|150|C
    Vehicle parked on a front lawn|100|C
    RV or boat stored in the front setback|100|C
    Trash bins left at the curb outside collection hours|50|C
    No trash collection service|100|C
    Graffiti not removed within 10 days|150|C
    Broken windows on a vacant building|250|C
    Vacant property not registered|500|C
    Building without a permit|500|C
    Fence over the height limit|150|C
    Unpermitted garage conversion|500|C
    Unpermitted short-term rental|500
    Garage sale without a permit|50
    More than four garage sales in a year|100
    Signs posted in the public right-of-way|100
    Banner or sign without a permit|100|C
    Damaged sidewalk not repaired by the owner|200|C
    Tree branches obstructing a sidewalk|100|C
    Pool not fenced or gated|500|C
    Green or stagnant swimming pool|250|C
    Illegal dumping on private property|500
    Home business without a permit|150|C
    Overcrowded residential unit|500|C
    Watering during restricted hours|100
    Sprinkler runoff onto the street|100
    Hosing down a driveway|100`);

  O('BP', 1, 'Business & licensing', `
    Business operating without a license|500|C
    Expired business license|250|C
    Business license not posted|100|C
    Street vending without a permit|250
    Food truck without a health permit|500
    Food truck parked past the time limit|150
    Selling goods on a sidewalk without a permit|250
    Door-to-door sales without a permit|250
    Soliciting at a "No Soliciting" residence|100
    Taxi without a city permit|500
    Rideshare pickup in a prohibited zone|150
    Pedicab without a permit|250
    Mobile car-wash runoff into a storm drain|250
    Restaurant health grade not posted|250
    Sidewalk dining without a permit|250
    Sandwich-board sign blocking a sidewalk|100
    Paid-admission event without a permit|500
    Commercial filming without a permit|500
    Pawnshop failing to report transactions|500
    Secondhand dealer without a license|500
    Tattoo shop without a health permit|500`);

  O('HN', 1, 'Boating & watercraft', `
    No life jacket for each person aboard|150
    Child under 13 without a life jacket on a moving boat|150
    Personal watercraft operator without a life jacket|150
    Expired vessel registration|150|C
    Registration numbers not displayed|100|C
    No boater education card|100|C
    Over 5 mph within 100 feet of swimmers|200
    Creating a wake in a no-wake zone|200
    No navigation lights between sunset and sunrise|200|C
    No throwable flotation device|100|C
    No fire extinguisher aboard|100|C
    No horn or whistle aboard|75|C
    Overloading past the capacity plate|250
    Riding on the bow or gunwale while underway|150
    Towing a water-skier without an observer|200
    Water-skiing between sunset and sunrise|200
    Personal watercraft operator under 16|200
    Personal watercraft operated at night|200
    Wake jumping within 100 feet of another vessel|250
    Mooring to a navigation buoy|200
    Discharging sewage from a vessel|500
    Anchoring in a navigation channel|150
    No diver-down flag displayed|100
    Boat in a swim-only area|200
    Negligent operation of a vessel|300
    Failure to report a boating accident|250
    Unmuffled boat exhaust|150|C`);

  O('FG', 1, 'Fish & game', `
    Fishing without a valid license|250
    Fishing license not in possession|100|C
    Over the daily bag limit|300
    Undersized fish in possession|250
    Fishing during a closed season|500
    Fishing in a closed area|500
    Too many rods in use|150
    Live bait where prohibited|150
    No steelhead or sturgeon report card|150
    Catch not recorded on a report card|150
    Snagging fish|300
    Taking lobster without a report card|250
    Taking shellfish during a quarantine|500
    Over the shellfish limit|500
    Unmarked crab traps|250
    Hunting license not in possession|150|C
    No hunter orange worn|150
    Harvested deer not tagged|500
    Hunting within 150 yards of an occupied home|500
    Shooting from a public road|500
    Lead ammunition where prohibited|500
    Hunting waterfowl without a duck stamp|250
    Over the waterfowl bag limit|500
    Hunting or fishing on posted land without permission|500
    Leaving game to waste in the field|500
    Feeding big game animals|250
    Releasing aquarium fish or plants into public waters|500
    Transporting live fish without a permit|500`);

  O('DR', 1, 'Drones & aircraft', `
    Drone over a crowd or event|500
    Drone within 5 miles of an airport without authorization|1000
    Drone above 400 feet|500
    Drone at night without anti-collision lighting|250
    Drone beyond visual line of sight|250
    Drone over an emergency scene|1000
    Drone over a stadium during an event|1000
    Drone over a jail or prison|1000
    Unregistered drone over 0.55 lbs|250|C
    Drone without Remote ID|250|C
    Drone over private property without consent|250
    Helicopter landing in a non-designated area|1000`);

  O('ED', 1, 'Minors, curfew & schools', `
    Juvenile curfew violation (10 p.m. to 5 a.m.)|100
    Truancy during school hours|100
    Habitual truancy|250
    Parent allowing a minor to violate curfew|250
    Minor buying spray paint|100
    Selling spray paint to a minor|250
    Selling a laser pointer to a minor|100
    Minor with a laser pointer on school grounds|100
    Skateboarding on school grounds after hours|100
    On school grounds after hours without permission|250
    Vape on school grounds|100`);

  O('SW', 1, 'Solid waste & environment', `
    Illegal dumping (under 1 cubic yard)|500
    Illegal dumping of tires|1000
    Illegal dumping of mattresses or furniture|500
    Dumping into a storm drain|1000
    Recyclables in the wrong bin (repeat)|50
    Scavenging from recycling bins|100
    Organic waste not separated (business)|250|C
    Improper disposal of household hazardous waste|500
    Improper disposal of motor oil|500
    Improper disposal of batteries or electronics|250
    Single-use plastic bag violation (retailer)|250
    Foam food container violation (vendor)|250
    Blowing leaves or debris into the street|100`);

  /* ============================================== ARREST CHARGES ===== */

  A('PC', 1, 'Homicide', `
    Murder, first degree (premeditated)|F|0|L
    Murder, first degree (felony murder)|F|0|L
    Murder, first degree (lying in wait)|F|0|L
    Murder, first degree (by torture)|F|0|L
    Murder, first degree (of a peace officer)|F|0|L
    Murder, first degree (by poison)|F|0|L
    Murder, first degree (by explosive)|F|0|L
    Murder, first degree (drive-by shooting)|F|0|L
    Murder, second degree|F|0|180
    Murder, second degree (implied malice DUI)|F|0|180
    Murder for hire|F|0|L
    Solicitation of murder|F|10000|108
    Attempted murder (premeditated)|F|10000|L
    Attempted murder|F|10000|108
    Attempted murder of a peace officer|F|10000|L
    Conspiracy to commit murder|F|10000|L
    Voluntary manslaughter|F|10000|132
    Involuntary manslaughter|F|10000|48
    Vehicular manslaughter — gross negligence|F|10000|72
    Vehicular manslaughter — ordinary negligence|M|1000|12
    Gross vehicular manslaughter while intoxicated|F|10000|120
    Vehicular manslaughter while intoxicated|F|10000|48
    Vehicular manslaughter during a speed contest|F|10000|120
    Vehicular manslaughter in a staged collision|F|10000|120
    Assisting a suicide|F|10000|36
    Failure to report a death|M|1000|12
    Mutilation of human remains|F|10000|48
    Unlawful disposal of human remains|M|1000|12`);

  const assaultBase = [
    ['Simple assault', 'M', 1000, 6], ['Battery', 'M', 2000, 6],
    ['Battery causing serious bodily injury', 'F', 10000, 48],
    ['Assault with a deadly weapon (non-firearm)', 'F', 10000, 48],
    ['Assault with force likely to cause great bodily injury', 'F', 10000, 48],
    ['Assault with a firearm', 'F', 10000, 72]
  ];
  const victims = [
    ['', 1], [' on a peace officer', 2], [' on a firefighter', 1.75], [' on an EMT or paramedic', 1.75],
    [' on a custodial officer', 1.75], [' on a transit operator', 1.5], [' on a school employee', 1.5],
    [' on a hospital emergency worker', 1.5], [' on an elder (65 or older)', 1.5], [' on a dependent adult', 1.5],
    [' on a child under 14', 2], [' on a pregnant person', 1.75], [' on a sports official', 1.25],
    [' on a code enforcement officer', 1.25], [' on a highway worker', 1.5], [' on a judge or court officer', 2]
  ];
  const assault = [];
  for (const [t, c, f, m] of assaultBase) for (const [v, x] of victims) {
    const mo = Math.round(m * x);
    assault.push(`${t}${v}|${c}|${f}|${c === 'M' ? Math.min(12, mo) : mo}`);
  }
  assault.push(...rowsOf(`
    Assault with a semiautomatic firearm|F|10000|108
    Assault with a machine gun or assault weapon|F|10000|144
    Mayhem|F|10000|96
    Aggravated mayhem|F|10000|L
    Torture|F|10000|L
    Assault with a caustic chemical (acid attack)|F|10000|48
    Assault with a stun gun or taser|F|10000|36
    Assault with intent to commit a felony|F|10000|72
    Poisoning food or drink|F|10000|96
    Drugging a person to commit a felony|F|10000|48
    Battery by gassing (bodily fluids) in custody|F|5000|48
    Throwing an object at an occupied vehicle|F|5000|36
    Pointing a laser at an aircraft|F|5000|36
    Pointing a laser at a peace officer|M|2000|6
    Hazing|M|1000|12
    Hazing causing serious bodily injury|F|5000|36
    Strangulation|F|10000|48
    Unlawful use of tear gas on a person|F|5000|36
    Assault by a public officer under color of authority|F|5000|36`));
  A('PC', 2, 'Assault & battery', assault);

  A('PC', 3, 'Kidnapping & restraint', `
    Kidnapping|F|10000|96
    Kidnapping for ransom or extortion|F|0|L
    Kidnapping during a carjacking|F|0|L
    Kidnapping to commit robbery|F|0|L
    Kidnapping to commit a sex offense|F|0|L
    Kidnapping of a child under 14|F|10000|132
    Attempted kidnapping|F|10000|48
    False imprisonment|M|1000|12
    False imprisonment by violence or menace|F|5000|36
    False imprisonment of a hostage|F|10000|96
    False imprisonment of an elder or dependent adult|F|5000|48
    Child abduction (custody deprivation)|F|10000|48
    Luring a child into a vehicle|F|10000|36
    Holding a person in involuntary servitude|F|10000|144
    Posing as a kidnapper to extort money|F|10000|48`);

  A('PC', 4, 'Sex offenses', `
    Rape by force or fear|F|10000|96
    Rape of an intoxicated or unconscious person|F|10000|96
    Spousal rape|F|10000|96
    Rape in concert|F|10000|120
    Sexual battery|M|2000|6
    Sexual battery by restraint|F|10000|48
    Sexual battery on an institutionalized person|F|10000|48
    Sexual assault with a foreign object|F|10000|96
    Assault with intent to commit rape|F|10000|72
    Unlawful sexual intercourse with a minor|F|10000|36
    Lewd act with a child under 14|F|10000|96
    Continuous sexual abuse of a child|F|10000|192
    Annoying or molesting a child|M|5000|12
    Contacting a minor to commit a sex offense|F|10000|36
    Arranging a meeting with a minor for lewd purposes|F|10000|48
    Possession of child sexual abuse material|F|10000|36
    Distribution of child sexual abuse material|F|10000|96
    Indecent exposure|M|1000|6
    Indecent exposure with a prior conviction|F|5000|36
    Sending harmful matter to a minor online|F|10000|36
    Peeping (invasion of privacy)|M|2000|6
    Secretly recording a person undressed|M|2000|12
    Distributing intimate images without consent|M|2000|6
    Failure to register as a sex offender|F|10000|36
    Failure to update sex offender registration|M|1000|12
    Registered sex offender loitering near a school|M|1000|6
    Registered sex offender living near a school|M|1000|6
    Incest|F|10000|36`);

  A('PC', 5, 'Robbery', `
    Robbery, first degree (inhabited dwelling)|F|10000|108
    Robbery, first degree (transit operator or passenger)|F|10000|108
    Robbery, first degree (at an ATM)|F|10000|108
    Robbery, second degree|F|10000|60
    Armed robbery with a firearm|F|10000|180
    Armed robbery with a deadly weapon (non-firearm)|F|10000|96
    Strong-arm robbery (no weapon)|F|10000|60
    Bank robbery|F|10000|120
    Pharmacy robbery|F|10000|96
    Convenience store robbery|F|10000|72
    Jewelry store robbery|F|10000|96
    Armored car robbery|F|10000|120
    Robbery of a delivery driver|F|10000|72
    Home-invasion robbery in concert|F|10000|108
    Attempted robbery|F|10000|36
    Attempted armed robbery|F|10000|60
    Conspiracy to commit robbery|F|10000|60
    Purse snatching by force|F|10000|60
    Robbery of an elder (65 or older)|F|10000|84
    Extortion by threat|F|10000|48
    Takeover robbery (occupants restrained)|F|10000|120`);

  A('PC', 6, 'Domestic violence, family & children', `
    Domestic battery|M|2000|12
    Corporal injury to a spouse or cohabitant|F|6000|48
    Corporal injury to a spouse with a prior|F|10000|60
    Corporal injury to a spouse causing great bodily injury|F|10000|108
    Domestic violence by strangulation|F|10000|48
    Battery on a dating partner|M|2000|12
    Battery on a former spouse|M|2000|12
    Battery on the parent of one's child|M|2000|12
    Violation of a domestic violence restraining order|M|1000|12
    Violation of a restraining order causing injury|F|5000|36
    Violation of a criminal protective order|M|1000|12
    Violation of an emergency protective order|M|1000|12
    Violation of a civil harassment restraining order|M|1000|12
    Violation of a gun violence restraining order|M|1000|12
    Preventing a victim from calling 911|M|1000|12
    Destroying a phone to stop a 911 call|M|1000|12
    Elder abuse likely to cause great bodily harm|F|10000|48
    Elder abuse not likely to cause great bodily harm|M|6000|12
    Elder abuse causing death|F|10000|84
    Dependent adult abuse|F|10000|48
    Child abuse — willful harm or injury|F|10000|72
    Child endangerment likely to cause great bodily harm|F|10000|72
    Child endangerment not likely to cause great bodily harm|M|1000|12
    Child neglect (failure to provide)|M|2000|12
    Corporal injury on a child|F|6000|72
    Assault on a child causing death|F|10000|L
    Child abandonment|M|2000|12
    Child left in a vehicle and injured|M|2000|12
    Failure to pay court-ordered child support|M|2000|12
    Contributing to the delinquency of a minor|M|2500|12
    Violation of a child custody order|M|1000|12
    Bigamy|F|10000|36
    Mandated reporter failing to report child abuse|M|1000|6
    Furnishing alcohol to a minor|M|1000|6
    Furnishing cannabis to a minor|F|5000|36
    Selling tobacco to a minor|M|1000|6
    Hosting an underage drinking party|M|1000|6
    Tattooing a minor|M|1000|6
    Employing a minor in a hazardous job|M|1000|6
    Parent failing to compel school attendance|M|2000|12
    Harboring a runaway minor|M|1000|6`);

  A('PC', 7, 'Threats, stalking & harassment', `
    Criminal threats|F|10000|36
    Criminal threats with a deadly weapon|F|10000|48
    Threatening a public official|F|10000|36
    Threatening a school or school employee|F|10000|36
    Threatening a witness or victim|F|10000|36
    Bomb threat|F|10000|36
    Threatening a peace officer|F|10000|36
    Terrorist threats|F|10000|48
    Stalking|F|10000|60
    Stalking in violation of a restraining order|F|10000|48
    Cyberstalking|F|10000|36
    Harassment by telephone|M|1000|6
    Harassment by electronic communication|M|1000|6
    Repeated annoying phone calls|M|1000|6
    Obscene or threatening communications|M|1000|6
    Doxxing to incite harm|M|1000|12
    Hate crime — interference with civil rights by force|M|5000|12
    Hate crime — threat against a protected group|M|5000|12
    Terrorizing with a burning cross or symbol|F|10000|36
    Swatting (false report causing an emergency response)|F|10000|36
    Credible threat of mass violence|F|10000|48
    Intimidating a reproductive health provider|M|25000|12
    Disrupting a religious service|M|1000|6`);

  A('PC', 8, 'Burglary & trespass', `
    Burglary, first degree (residential)|F|10000|72
    Burglary, first degree (occupied home — hot prowl)|F|10000|72
    Burglary, second degree (commercial)|F|10000|36
    Burglary of a vehicle|F|10000|36
    Auto burglary — window smash|F|10000|36
    Burglary of a storage unit|F|10000|36
    Burglary of a garage|F|10000|36
    Burglary of a construction site|F|10000|36
    Burglary of a pharmacy|F|10000|36
    Burglary of a firearms dealer|F|10000|48
    Burglary of a church|F|10000|36
    Burglary of a school|F|10000|36
    Burglary of a boat|F|10000|36
    Burglary of a railroad car|F|10000|36
    Shoplifting (entering a store to steal under $950)|M|1000|6
    Attempted burglary|F|5000|36
    Possession of burglary tools|M|1000|6
    Possession of a bump key with intent|M|1000|6
    Possession of a vehicle entry tool with intent|M|1000|6
    Prowling / peeking in windows|M|1000|6
    Trespassing on posted property|M|1000|6
    Trespassing — refusing to leave|M|1000|6
    Trespassing in an occupied residence|M|1000|12
    Aggravated trespass (with a threat)|M|2000|12
    Trespassing on school grounds|M|1000|6
    Trespassing on railroad property|M|1000|6
    Trespassing in an airport secure area|M|1000|12
    Trespassing on critical infrastructure|F|10000|36
    Trespassing on a military installation|M|2000|6
    Trespassing on farmland|M|1000|6
    Trespassing on a construction site|M|1000|6
    Trespassing in a closed park after a warning|M|1000|6
    Entering a closed disaster area|M|1000|6
    Squatting in a dwelling|M|1000|6
    Breaking into a vacant building|M|1000|6
    Looting during a state of emergency|F|10000|36
    Unauthorized entry into a dwelling|M|1000|6
    Trespassing to obstruct a business|M|1000|6`);

  const theftTypes = ['Theft', 'Retail theft', 'Embezzlement by an employee', 'Theft by false pretenses',
    'Theft of services', 'Theft of lost or mislaid property', 'Theft from a vehicle',
    'Theft from an elder or dependent adult', 'Theft of construction equipment or tools',
    'Theft of scrap metal or copper wire', 'Diversion of construction funds', 'Theft of farm products'];
  const valueTiers = [['under $950', 'M', 1000, 6], ['$950 to $9,999', 'F', 5000, 16], ['$10,000 to $49,999', 'F', 10000, 36],
    ['$50,000 to $199,999', 'F', 10000, 48], ['$200,000 or more', 'F', 10000, 72]];
  const theft = [];
  for (const t of theftTypes) for (const [v, c, f, m] of valueTiers) theft.push(`${t} — value ${v}|${c}|${f}|${m}`);
  theft.push(...rowsOf(`
    Grand theft from a person (pickpocketing)|F|5000|36
    Grand theft of a firearm|F|10000|36
    Grand theft of livestock|F|5000|36
    Grand theft of a dog|F|5000|36
    Package theft from a porch|M|1000|12
    Mail theft|F|5000|36
    Organized retail theft|F|10000|36
    Organized retail theft — leader or recruiter|F|10000|48
    Petty theft with a prior|M|1000|12
    Theft of electricity (illegal tap)|M|1000|6
    Theft of cable or internet service|M|1000|6
    Theft of trade secrets|F|10000|36
    Gas drive-off|M|1000|6
    Dine and dash (defrauding a restaurant)|M|1000|6
    Failure to return rented property|M|1000|6
    Failure to return a rental vehicle|F|5000|36
    Bicycle theft|M|1000|6
    Theft of a cemetery plaque or memorial|F|5000|36
    Cargo theft|F|10000|48
    Theft from a railroad car|F|10000|48
    Receiving stolen property — under $950|M|1000|6
    Receiving stolen property — $950 or more|F|10000|36
    Receiving a stolen vehicle|F|10000|36
    Receiving a stolen firearm|F|10000|36
    Selling stolen property (fencing)|F|10000|36
    Operating a fencing operation|F|10000|48
    Possession of stolen mail|M|1000|12`));
  A('PC', 9, 'Theft & stolen property', theft);

  A('PC', 10, 'Vehicle theft & vehicle crimes', `
    Grand theft auto|F|10000|36
    Unlawful taking of a vehicle (joyriding)|F|5000|36
    Unlawful taking of a vehicle with a prior|F|10000|48
    Carjacking|F|10000|108
    Carjacking with a firearm|F|10000|180
    Attempted carjacking|F|10000|54
    Catalytic converter theft|F|5000|36
    Unlicensed possession of a used catalytic converter|M|1000|6
    Operating a chop shop|F|50000|60
    Altering or removing a VIN|F|10000|36
    Possession of a vehicle with an altered VIN|F|10000|36
    Tampering with a vehicle|M|1000|6
    Theft of vehicle parts|M|1000|6
    Odometer tampering|M|5000|12
    Selling a vehicle with a rolled-back odometer|F|10000|36
    Unlicensed vehicle dealing (curbstoning)|M|5000|12
    False information on a vehicle registration|M|1000|12
    Forged registration or temporary tag|F|5000|36
    Stolen or false plates to avoid identification|M|1000|6
    Aircraft theft|F|10000|48
    Boat theft|F|10000|36
    Predatory towing|M|2500|6
    Removing a vehicle from impound without authority|M|1000|6`);

  A('PC', 11, 'Arson & explosives', `
    Arson of an inhabited structure|F|10000|96
    Arson of a structure|F|10000|72
    Arson of forest land|F|10000|72
    Arson of property or a vehicle|F|10000|36
    Arson causing great bodily injury|F|10000|108
    Arson of a place of worship|F|10000|96
    Arson during a state of emergency|F|10000|108
    Aggravated arson|F|10000|L
    Arson to defraud an insurer|F|50000|72
    Attempted arson|F|10000|36
    Unlawfully causing a fire|M|1000|6
    Unlawfully causing a fire to an inhabited structure|F|10000|48
    Unlawfully causing a fire resulting in injury|F|10000|72
    Possession of an incendiary device|F|10000|36
    Possession of flammable materials to commit arson|F|10000|36
    Possession of a destructive device|F|10000|36
    Possession of a destructive device near a public building|F|10000|72
    Exploding a destructive device to injure|F|10000|L
    Explosion causing death|F|0|L
    Manufacturing an explosive device|F|10000|72
    Possession of explosives without a permit|F|10000|48
    Illegal transport of explosives|F|10000|48
    Selling a destructive device|F|10000|48
    Possession of a hoax destructive device|M|1000|12
    Placing a hoax bomb to cause fear|F|10000|36
    Throwing a Molotov cocktail|F|10000|72
    Setting fire to an occupied vehicle|F|10000|108
    Possession of over 25 lbs of dangerous fireworks|F|50000|36
    Selling dangerous fireworks|F|50000|36
    Fireworks causing a wildfire|F|10000|48
    Setting a fire in a jail or prison|F|10000|36`);

  const vandTypes = ['Vandalism', 'Graffiti vandalism', 'Vandalism of a vehicle', 'Vandalism of a place of worship',
    'Vandalism of a cemetery or memorial', 'Vandalism of a school', 'Vandalism of government property',
    'Vandalism of a utility or communications facility'];
  const vandTiers = [['under $400', 'M', 1000, 6], ['$400 to $9,999', 'F', 10000, 36], ['$10,000 or more', 'F', 50000, 48]];
  const vand = [];
  for (const t of vandTypes) for (const [v, c, f, m] of vandTiers) vand.push(`${t} — damage ${v}|${c}|${f}|${m}`);
  vand.push(...rowsOf(`
    Possession of graffiti tools with intent|M|1000|6
    Graffiti on a freeway structure|M|1000|12
    Etching or scratching windows|M|1000|6
    Defacing a public monument or statue|M|2000|12
    Destroying a traffic control device|M|1000|12
    Damaging railroad property|F|10000|36
    Damaging a power line or utility pole|F|10000|36
    Damaging an electric vehicle charger|M|1000|6
    Disabling a fire alarm or sprinkler|M|1000|12
    Damaging a jail cell or facility|F|10000|36
    Destroying crops or orchard trees|M|1000|6
    Damaging a dam or levee|F|10000|36
    Tampering with a fire hydrant|M|1000|6`));
  A('PC', 12, 'Vandalism & property damage', vand);

  A('PC', 13, 'Fraud, forgery & impersonation', `
    Forgery|F|10000|36
    Forgery of a check|F|10000|36
    Forgery of a deed or title|F|10000|36
    Forgery of a prescription|F|10000|36
    Forgery of a government seal|F|10000|36
    Forgery of a will|F|10000|36
    Forgery of a driver's license or ID card|F|10000|36
    Forging signatures on a petition|M|1000|12
    Possession of a forged document with intent|F|10000|36
    Passing a forged check|F|10000|36
    Possession of check-making equipment with intent|F|10000|36
    Bad check (insufficient funds) under $950|M|1000|12
    Bad check (insufficient funds) $950 or more|F|10000|36
    Writing a check on a closed account|F|10000|36
    Counterfeiting currency|F|10000|36
    Possession of counterfeit currency|F|10000|36
    Passing counterfeit currency|F|10000|36
    Counterfeit brand-name goods under $950|M|5000|12
    Counterfeit brand-name goods $950 or more|F|100000|36
    Selling counterfeit tickets|M|5000|12
    Counterfeit disabled parking placard|M|1000|6
    Credit card fraud — using a stolen card|F|10000|36
    Credit card fraud — using an expired or revoked card|M|1000|12
    Credit card fraud — making counterfeit cards|F|10000|36
    Possession of a card skimmer|F|10000|36
    Installing a skimmer on an ATM or gas pump|F|10000|36
    Theft of card account information|F|10000|36
    Identity theft|F|10000|36
    Identity theft with a prior|F|10000|48
    Possession of personal information of 10 or more people|F|10000|36
    Identity theft of a deceased person|F|10000|36
    Synthetic identity fraud|F|10000|36
    False impersonation of another person|F|10000|36
    Impersonating a peace officer|M|2000|12
    Impersonating a peace officer to commit a felony|F|10000|36
    Impersonating a firefighter or EMT|M|2000|12
    Impersonating a public official|M|2000|12
    Impersonating a utility worker to gain entry|M|2000|12
    Possession of an unauthorized police badge|M|2000|6
    Police-style lights used to impersonate an officer|M|2000|12
    Insurance fraud — false auto claim|F|50000|60
    Insurance fraud — staged collision|F|50000|60
    Insurance fraud — false health claim|F|50000|60
    Insurance fraud — workers' compensation|F|150000|60
    Insurance fraud — false theft report|F|50000|60
    Insurance fraud — false property damage claim|F|50000|60
    Welfare fraud|F|10000|36
    Unemployment insurance fraud|F|20000|36
    EBT / food stamp fraud|F|10000|36
    Disability benefits fraud|F|10000|36
    Medicaid / Medicare provider fraud|F|50000|60
    Elder financial abuse|F|10000|48
    Real estate fraud|F|50000|60
    Mortgage fraud|F|50000|60
    Deed theft (title fraud)|F|50000|60
    Contracting without a license|M|5000|6
    Contractor fraud — deposit taken, no work done|F|10000|36
    Home repair fraud against an elder|F|10000|48
    Notary fraud|F|10000|36
    Immigration consultant fraud|F|10000|36
    Fake charity solicitation|F|10000|36
    Disaster relief fraud|F|10000|36
    Lottery or sweepstakes scam|F|10000|36
    Romance scam|F|10000|36
    Price gouging during a state of emergency|M|10000|12
    Using a fake ID|M|1000|6
    Possession of a fake ID|M|1000|6
    Manufacturing fake IDs|F|10000|36
    Selling fake IDs|F|10000|36
    Filing a false document with a public office|F|10000|36
    Filing a fraudulent lien|F|10000|36`);

  A('PC', 14, 'White collar & computer crime', `
    Money laundering — under $50,000|F|250000|48
    Money laundering — $50,000 to $150,000|F|250000|60
    Money laundering — $150,000 to $1 million|F|250000|72
    Money laundering — $1 million or more|F|500000|96
    Structuring cash deposits to avoid reporting|F|250000|36
    Wire fraud|F|250000|60
    Mail fraud|F|250000|60
    Securities fraud|F|1000000|60
    Ponzi or pyramid scheme|F|1000000|60
    Insider trading|F|1000000|60
    Tax evasion|F|100000|36
    Failure to file a tax return|M|25000|12
    Sales tax evasion|F|20000|36
    Payroll tax fraud|F|50000|36
    Bank fraud|F|1000000|60
    Check kiting|F|10000|36
    Commercial bribery|F|10000|36
    Price fixing or bid rigging|F|1000000|36
    Concealing assets in bankruptcy|F|250000|60
    Cryptocurrency investment fraud|F|250000|60
    Unlicensed money transmitting|F|25000|36
    Unauthorized computer access (hacking)|F|10000|36
    Computer access to commit fraud|F|10000|36
    Spreading malware|F|10000|36
    Ransomware / computer extortion|F|10000|48
    Denial-of-service attack|F|10000|36
    Theft of computer data|F|10000|36
    Unauthorized use of another person's online account|M|5000|12
    Phishing for personal information|F|10000|36
    SIM swapping|F|10000|36
    Creating a false online impersonation|M|1000|12
    Wiretapping|F|10000|36
    Recording a confidential conversation|M|2500|12
    Hidden GPS tracker on another person's vehicle|M|1000|6
    Installing stalkerware on another person's phone|M|2500|12
    Possession of a cell phone jammer|M|1000|6
    Unauthorized access to a police database|F|10000|36
    Selling stolen personal data|F|10000|36
    Selling pirated media for profit|F|250000|60
    Recording a movie in a theater|M|2500|12
    Gift card draining fraud|F|10000|36`);

  const drugs = [
    ['cannabis', 1, { poss: 'Possession of cannabis over the legal limit (more than 28.5 g)', mfg: 'Unlicensed cultivation of cannabis (more than six plants)' }],
    ['cannabis concentrate', 1, { poss: 'Possession of cannabis concentrate over the legal limit (more than 8 g)', mfg: 'Manufacturing cannabis concentrate with a volatile solvent' }],
    ['psilocybin mushrooms', 1, { mfg: 'Cultivating psilocybin mushrooms' }],
    ['anabolic steroids', 1, {}],
    ['codeine-promethazine syrup', 2, {}],
    ['non-prescribed alprazolam (Xanax)', 2, { mfg: 'Manufacturing counterfeit alprazolam pills' }],
    ['non-prescribed oxycodone', 2, { mfg: 'Manufacturing counterfeit oxycodone pills' }],
    ['non-prescribed hydrocodone', 2, { mfg: 'Manufacturing counterfeit hydrocodone pills' }],
    ['non-prescribed morphine', 2, {}],
    ['non-prescribed amphetamine (Adderall)', 2, { mfg: 'Manufacturing counterfeit amphetamine pills' }],
    ['MDMA (ecstasy)', 2, {}], ['LSD', 2, {}], ['ketamine', 2, {}], ['GHB', 2, {}],
    ['mescaline or peyote', 2, {}], ['DMT', 2, {}],
    ['synthetic cannabinoids (spice)', 2, {}], ['synthetic cathinones (bath salts)', 2, {}],
    ['PCP', 3, {}], ['cocaine', 3, {}], ['cocaine base (crack)', 3, {}], ['heroin', 3, {}],
    ['methamphetamine', 3, { mfg: 'Manufacturing methamphetamine (meth lab)' }],
    ['xylazine (tranq)', 3, {}],
    ['fentanyl', 4, {}], ['carfentanil or a fentanyl analogue', 4, {}]
  ];
  const drugRows = [];
  const P = (lv, arr) => arr[lv - 1];
  for (const [d, lv, o] of drugs) {
    const possCls = lv === 4 ? 'F' : 'M';
    drugRows.push(`${o.poss || 'Possession of ' + d}|${possCls}|${P(lv, [1000, 1000, 2000, 10000])}|${P(lv, [6, 12, 12, 36])}`);
    drugRows.push(`Possession of ${d} for sale|F|${P(lv, [10000, 20000, 20000, 50000])}|${P(lv, [24, 36, 48, 60])}`);
    drugRows.push(`Sale or distribution of ${d}|F|${P(lv, [10000, 20000, 50000, 50000])}|${P(lv, [36, 48, 60, 84])}`);
    drugRows.push(`Transporting ${d} for sale|F|${P(lv, [10000, 20000, 50000, 50000])}|${P(lv, [36, 48, 60, 84])}`);
    drugRows.push(`${o.mfg || 'Manufacturing ' + d}|F|${P(lv, [10000, 50000, 50000, 100000])}|${P(lv, [36, 60, 84, 108])}`);
    drugRows.push(`Trafficking ${d} — over 1 kg|F|${P(lv, [100000, 250000, 500000, 1000000])}|${P(lv, [60, 96, 144, 180])}`);
    drugRows.push(`Possession of ${d} while armed with a loaded firearm|F|10000|${P(lv, [36, 36, 48, 60])}`);
  }
  A('HS', 1, 'Controlled substances', drugRows);

  A('HS', 2, 'Other drug offenses', `
    Under the influence of a controlled substance|M|1000|12
    Possession of drug paraphernalia|M|1000|6
    Possession of a methamphetamine pipe|M|1000|6
    Possession of an unidentified controlled substance (pending lab)|M|1000|6
    Possession of a dangerous drug without a prescription|M|1000|6
    Possession of a pill press|F|10000|36
    Possession of ephedrine or pseudoephedrine to manufacture|F|10000|48
    Possession of fentanyl precursor chemicals|F|10000|60
    Possession of a controlled substance in jail|F|10000|36
    Bringing drugs into a jail or prison|F|10000|48
    Selling drugs to a minor|F|50000|108
    Using a minor to sell or transport drugs|F|50000|108
    Selling drugs within 1,000 feet of a school|F|50000|72
    Selling drugs near a park or youth center|F|50000|60
    Maintaining a drug house|F|10000|36
    Renting property for drug manufacturing|F|10000|36
    Maintaining a fortified drug house|F|10000|48
    Doctor shopping (obtaining prescriptions by fraud)|F|10000|36
    Running a pill mill|F|50000|60
    Diversion of controlled substances by a health worker|F|50000|60
    Possession of an imitation drug for sale|M|1000|12
    Selling a fake drug as a real one|M|1000|12
    Furnishing nitrous oxide for intoxication|M|1000|6
    Huffing toxic vapors|M|1000|6
    Distribution of a controlled substance resulting in death|F|50000|240
    Possession of drug proceeds over $100,000|F|250000|48
    Conspiracy to distribute controlled substances|F|50000|60
    Continuing criminal drug enterprise (kingpin)|F|1000000|L
    Operating an unlicensed cannabis dispensary|M|5000|6
    Adult possession of cannabis on school grounds|M|500|6`);

  const prohibited = ['a convicted felon', 'a person convicted of domestic violence', 'a person under a restraining order',
    'a person under a mental-health prohibition', 'a person under 18', 'a person addicted to narcotics',
    'a person with an outstanding felony warrant', 'a probationer with a firearm ban'];
  const weapons = rowsOf(`
    Carrying a concealed firearm without a permit|M|1000|12
    Carrying a concealed firearm in a vehicle|M|1000|12
    Carrying a loaded firearm in public|M|1000|12
    Carrying a loaded firearm in a vehicle|M|1000|12
    Carrying a loaded firearm as an active gang member|F|10000|36
    Carrying a concealed stolen firearm|F|10000|36
    Carrying a firearm in a government building|M|1000|12
    Carrying a firearm on school grounds|F|10000|60
    Carrying a firearm at a polling place|M|1000|12
    Carrying a firearm in an airport secure area|F|10000|36
    Carrying a firearm while intoxicated|M|1000|6
    Openly carrying an unloaded handgun|M|1000|6
    Openly carrying an unloaded long gun|M|1000|6`);
  for (const p of prohibited) weapons.push(`Possession of a firearm by ${p}|F|10000|36`);
  for (const p of prohibited) weapons.push(`Possession of ammunition by ${p}|F|5000|16`);
  weapons.push(...rowsOf(`
    Possession of a machine gun|F|10000|36
    Possession of a short-barreled rifle|F|10000|36
    Possession of a short-barreled shotgun|F|10000|36
    Possession of a firearm silencer|F|10000|36
    Possession of an assault weapon|F|10000|36
    Manufacturing an assault weapon|F|10000|96
    Possession of a large-capacity magazine|M|1000|6
    Selling large-capacity magazines|F|10000|12
    Possession of a machine-gun conversion device (auto sear)|F|10000|48
    Possession of an unserialized firearm (ghost gun)|M|1000|12
    Manufacturing a ghost gun without a license|F|10000|36
    Possession of a 3D-printed firearm|F|10000|36
    Possession of an undetectable firearm|F|10000|36
    Possession of armor-piercing ammunition|F|10000|36
    Possession of a firearm with an obliterated serial number|F|10000|36
    Altering a firearm serial number|F|10000|36
    Straw purchase of a firearm|F|10000|36
    False information on a firearm purchase|F|10000|36
    Selling firearms without a dealer license|F|10000|36
    Firearms trafficking|F|50000|120
    Selling a firearm to a minor|F|10000|36
    Selling a firearm to a prohibited person|F|10000|36
    Unsafe storage — child accessed a firearm|M|5000|12
    Unsafe storage — child accessed a firearm and caused injury|F|10000|36
    Failure to report a lost or stolen firearm|M|1000|6
    Brandishing a firearm|M|1000|12
    Brandishing a firearm at a peace officer|F|10000|36
    Brandishing a firearm at a school or daycare|M|1000|12
    Brandishing a deadly weapon (non-firearm)|M|1000|6
    Brandishing a replica firearm|M|1000|6
    Grossly negligent discharge of a firearm|F|10000|36
    Discharging a firearm within city limits|M|1000|12
    Shooting at an inhabited dwelling or occupied vehicle|F|10000|84
    Shooting at an unoccupied vehicle or building|F|10000|36
    Shooting from a motor vehicle|F|10000|96
    Drive-by shooting at a person|F|10000|108
    Celebratory gunfire|F|10000|36
    Shooting at an aircraft|F|10000|96
    Possession of a switchblade over 2 inches|M|1000|6
    Possession of brass knuckles|M|1000|6
    Possession of a blackjack or sap|M|1000|6
    Carrying a concealed dirk or dagger|M|1000|12
    Possession of a cane sword|M|1000|6
    Possession of a belt-buckle knife|M|1000|6
    Possession of a ballistic knife|F|10000|36
    Possession of throwing stars|M|1000|6
    Possession of a zip gun|F|10000|36
    Knife on school grounds|M|2000|12
    Weapon in a courthouse|M|1000|12
    Weapon in a jail or prison|F|10000|36
    Possession of tear gas by a felon|F|5000|36
    Possession of a stun gun by a felon|M|1000|6
    Possession of body armor by a violent felon|F|10000|36
    Wearing body armor during a violent felony|F|10000|48
    Lending a firearm to an unauthorized person|M|1000|6
    BB gun on school grounds|M|1000|6
    Pointing a laser sight at a person|M|1000|6
    Carrying a firearm at a public demonstration|M|1000|12`));
  A('PC', 15, 'Weapons', weapons);

  A('VC', 30, 'DUI & serious traffic offenses', `
    DUI — alcohol, first offense|M|2000|6
    DUI — alcohol, second offense within 10 years|M|2000|12
    DUI — alcohol, third offense within 10 years|M|2000|12
    DUI — fourth offense within 10 years|F|5000|36
    DUI — with a prior felony DUI|F|5000|36
    DUI — blood alcohol 0.08% or higher|M|2000|6
    DUI — blood alcohol 0.15% or higher (aggravated)|M|2000|12
    DUI — blood alcohol 0.20% or higher|M|2000|12
    DUI — drugs|M|2000|6
    DUI — combined alcohol and drugs|M|2000|6
    DUI — prescription medication|M|2000|6
    DUI — cannabis|M|2000|6
    DUI — causing injury|F|5000|36
    DUI — causing great bodily injury|F|5000|72
    DUI — injuring multiple victims|F|5000|72
    DUI — child under 14 in the vehicle|M|2000|12
    DUI — commercial driver (0.04% or higher)|M|2000|6
    DUI — driver under 21 (0.05% or higher)|M|1000|6
    DUI — rideshare or taxi driver with passengers (0.04%)|M|2000|6
    DUI — while on a suspended license|M|2000|12
    DUI — wrong-way driving|M|2000|12
    DUI — 30 mph or more over the limit|M|2000|12
    DUI — refusing a chemical test|M|2000|6
    Boating under the influence|M|2000|6
    Boating under the influence causing injury|F|5000|36
    Flying an aircraft under the influence|F|5000|36
    Off-highway vehicle under the influence|M|2000|6
    Driving without a required ignition interlock|M|1000|12
    Tampering with an ignition interlock|M|1000|12
    Having someone else blow into an ignition interlock|M|1000|6
    Hit and run — property damage|M|1000|6
    Hit and run — unattended vehicle, no note left|M|1000|6
    Hit and run — injury|F|10000|36
    Hit and run — death or permanent injury|F|10000|48
    Evading a peace officer|M|1000|12
    Felony evading — reckless driving|F|10000|36
    Evading a peace officer driving the wrong way|F|10000|36
    Evading a peace officer causing injury|F|10000|84
    Evading a peace officer causing death|F|10000|120
    Reckless driving|M|1000|3
    Reckless driving causing injury|M|1000|6
    Reckless driving causing great bodily injury|F|10000|36
    Reckless driving in a parking lot|M|1000|3
    Speed contest / street racing|M|1000|3
    Speed contest causing injury|F|10000|36
    Exhibition of speed|M|500|3
    Participating in a sideshow / street takeover|M|1000|6
    Organizing a sideshow / street takeover|M|1000|12
    Spectating at a sideshow|M|1000|3
    Blocking a highway for a speed contest|M|1000|3
    Driving on a suspended license — DUI related|M|1000|6
    Driving on a suspended license — failure to appear|M|1000|6
    Driving on a suspended license — negligent operator points|M|1000|6
    Driving on a suspended license — no insurance|M|1000|6
    Driving on a revoked license|M|1000|6
    Driving on a revoked license — habitual traffic offender|M|2000|12
    Driving on a suspended license — second offense|M|2000|12
    Unlicensed driving — third offense|M|1000|6
    Driving a commercial vehicle while disqualified|M|2500|12
    Vehicular assault|F|10000|36
    Assault with a deadly weapon — motor vehicle (road rage)|F|10000|48
    Ramming a police vehicle|F|10000|48
    Leaving the scene of a boating accident|F|10000|36
    Allowing an intoxicated person to drive your vehicle|M|1000|6
    Transporting a person in a vehicle trunk|M|1000|3`);

  A('PC', 16, 'Public order, vice & trafficking', `
    Public intoxication|M|1000|6
    Fighting in public|M|400|3
    Loud and unreasonable noise (disturbing the peace)|M|400|3
    Offensive words likely to provoke violence|M|400|3
    Lodging without permission|M|1000|6
    Loitering for drug activity|M|1000|6
    Disturbing the peace|M|400|3
    Disturbing a public meeting|M|1000|6
    Disturbing a school|M|1000|6
    Disrupting a funeral or memorial|M|1000|6
    Failure to disperse|M|1000|6
    Unlawful assembly|M|1000|6
    Rout|M|1000|6
    Riot|M|1000|12
    Inciting a riot|M|1000|12
    Inciting a riot causing injury|F|10000|36
    Riot in a jail or prison|F|10000|36
    Rioting while armed|F|10000|36
    Obstructing a sidewalk or street|M|1000|6
    Blocking a highway during a protest|M|1000|6
    Aggressive panhandling|M|1000|6
    Lewd conduct in public|M|1000|6
    Public sexual activity|M|1000|6
    Loitering for prostitution|M|1000|6
    Prostitution|M|1000|6
    Soliciting prostitution|M|1000|6
    Soliciting a minor for prostitution|F|10000|36
    Pimping|F|10000|72
    Pandering|F|10000|72
    Pandering a minor|F|10000|96
    Keeping a house of prostitution|M|1000|12
    Human trafficking — forced labor|F|500000|144
    Human trafficking — commercial sex|F|500000|240
    Human trafficking of a minor|F|500000|L
    Massage business used for prostitution|M|5000|12
    Unlicensed massage business|M|1000|6
    Distributing obscene matter|M|1000|6
    Distributing harmful matter to a minor|F|10000|36
    Wearing a mask to evade identification during a crime|M|1000|6
    Cruising where posted (repeat circuits)|M|500|3
    Interfering with railroad operations|M|1000|6
    Unlawful camping after a warning|M|1000|6
    Maintaining a public nuisance|M|1000|6
    Running onto a sports field|M|1000|6
    Throwing an object onto a playing field|M|1000|6
    Ticket scalping at an event|M|1000|6
    Fare evasion — repeat|M|1000|6
    Walking on transit tracks|M|1000|6
    Interfering with a transit operator|M|1000|6`);

  A('PC', 17, 'Obstruction & offenses against justice', `
    Resisting, delaying or obstructing a peace officer|M|1000|12
    Resisting arrest with force or violence|F|10000|36
    Resisting arrest causing injury to an officer|F|10000|48
    Taking a weapon from a peace officer|F|10000|36
    Attempting to take a weapon from a peace officer|M|1000|12
    Obstructing an officer by threats or violence|F|10000|36
    Obstructing a firefighter or EMT|M|1000|12
    Interfering at a crime scene|M|1000|6
    Giving false identification to a peace officer|M|1000|6
    False report of a crime|M|1000|6
    False 911 call|M|1000|12
    False report of a bomb|F|10000|36
    Misuse of 911|M|1000|6
    False report of child abuse|M|1000|6
    Knowingly false complaint against an officer|M|1000|6
    Perjury|F|10000|48
    Subornation of perjury|F|10000|48
    Dissuading a witness|F|10000|36
    Dissuading a witness by force or threat|F|10000|48
    Bribing a witness|F|10000|36
    Witness accepting a bribe|F|10000|36
    Jury tampering|F|10000|36
    Bribing a juror|F|10000|48
    Destroying or concealing evidence|M|1000|6
    Planting false evidence|F|10000|60
    Accessory after the fact|F|5000|36
    Harboring a fugitive|F|5000|36
    Aiding an escape|F|10000|36
    Compounding a crime|M|1000|12
    Contempt of court|M|1000|6
    Refusing to testify (criminal contempt)|M|1000|6
    Failure to appear — misdemeanor|M|1000|6
    Failure to appear — felony|F|10000|36
    Bail jumping|F|10000|36
    Failure to appear on a signed promise (citation)|M|1000|6
    Probation violation|M|0|6
    Parole violation|F|0|12
    Violation of post-release supervision|M|0|6
    Removing an ankle monitor|M|1000|12
    Outstanding misdemeanor warrant|M|0|0
    Outstanding felony warrant|F|0|0
    Fugitive from another state (extradition)|F|0|0
    Bench warrant — unpaid fines|M|0|0
    Retaliating against a witness or victim|F|10000|48
    Unlawful contact with a juror|M|1000|6
    Refusing to aid an officer when ordered|M|1000|6
    Interfering with a police dog|M|1000|12
    Injuring a police dog or horse|F|10000|36
    Unauthorized use of a police radio frequency|M|1000|6
    Using a police scanner during a crime|M|1000|6`);

  A('PC', 18, 'Escape & custody', `
    Escape from county jail|F|10000|36
    Escape from county jail by force or violence|F|10000|72
    Escape from state prison|F|10000|48
    Escape from state prison by force or violence|F|10000|72
    Escape from an officer after arrest|F|10000|36
    Escape from work furlough or a community program|F|5000|36
    Escape from a juvenile facility|M|1000|12
    Escape from a hospital while in custody|F|10000|36
    Failure to return from temporary release|F|5000|36
    Attempted escape|F|5000|36
    Possession of escape tools in custody|F|5000|36
    Bringing a cell phone into a jail or prison|M|5000|6
    Inmate possession of a cell phone|M|1000|6
    Bringing alcohol into a jail|M|1000|6
    Bringing a weapon into a jail|F|10000|48
    Inmate possession of a weapon (shank)|F|10000|48
    Battery by an inmate on a non-inmate|F|10000|48
    Holding a hostage in a correctional facility|F|10000|L
    Unauthorized communication with an inmate|M|1000|6
    Smuggling tobacco into a prison|M|1000|6
    Drone delivery of contraband to a jail|F|10000|36`);

  A('PC', 19, 'Government, corruption & elections', `
    Bribing a public official|F|10000|48
    Public official accepting a bribe|F|10000|48
    Bribing a peace officer|F|10000|48
    Peace officer accepting a bribe|F|10000|48
    Bribing a judge|F|10000|48
    Embezzlement of public funds|F|10000|48
    Misappropriation of public funds|F|10000|48
    Conflict of interest in a public contract|F|10000|36
    Extortion under color of office|F|10000|48
    Official misconduct|M|1000|12
    Falsifying public records|F|10000|36
    Destroying public records|F|10000|36
    Official leaking confidential information|M|1000|12
    Peace officer filing a false report|F|10000|36
    Voting more than once|F|10000|36
    Voting while ineligible|F|10000|36
    Voter registration fraud|F|10000|36
    Tampering with a ballot or ballot box|F|10000|48
    Voter intimidation|F|10000|36
    Electioneering within 100 feet of a polling place|M|1000|6
    Buying or selling votes|F|10000|36
    Misuse of campaign funds|F|10000|36
    Election officer misconduct|F|10000|36
    Tampering with voting machines|F|10000|48
    Threatening an election worker|F|10000|36
    Treason against the state|F|0|L
    Material support for terrorism|F|0|180
    Terrorism with a weapon of mass destruction|F|0|L
    Possession of a weapon of mass destruction|F|10000|144`);

  A('PC', 20, 'Organized crime, gangs & gambling', `
    Active participation in a criminal street gang|F|10000|36
    Recruiting a minor into a gang|F|10000|36
    Gang recruitment by force or threat|F|10000|48
    Racketeering (criminal enterprise)|F|250000|240
    Conspiracy to commit racketeering|F|250000|240
    Gang extortion|F|10000|48
    Loan sharking|F|10000|36
    Collecting debts by force|F|10000|48
    Protection racket (extorting a business)|F|10000|48
    Leading a criminal organization|F|250000|240
    Operating an illegal gambling house|M|5000|12
    Bookmaking|F|5000|36
    Possession of an illegal slot machine|M|1000|6
    Operating an illegal sweepstakes cafe|M|5000|6
    Running an illegal lottery|M|1000|12
    Cheating at a casino game|F|10000|36
    Using a cheating device while gambling|F|10000|36
    Unlawful gambling|M|1000|6
    Running an underground poker game|M|5000|12
    Fixing a sporting event (sports bribery)|F|10000|60
    Smuggling people for profit|F|250000|120
    Smuggling untaxed cigarettes|F|50000|36`);

  A('PC', 21, 'Animal & wildlife crimes', `
    Animal cruelty — intentional|F|20000|36
    Animal cruelty — neglect (no food or water)|M|20000|12
    Animal cruelty — torture|F|20000|36
    Maliciously killing a pet|F|20000|36
    Animal abandonment|M|1000|6
    Dogfighting — organizing or participating|F|50000|60
    Dogfighting — spectator|M|5000|6
    Cockfighting — organizing|F|25000|12
    Cockfighting — spectator|M|1000|6
    Possession of a dog for fighting|F|50000|36
    Animal left in a hot vehicle and injured|M|1000|6
    Owner of a dangerous dog that injured someone|M|10000|12
    Owner of a dog that killed a person|F|10000|48
    Poisoning an animal|F|20000|36
    Injuring or killing a guide or service dog|M|10000|12
    Poaching a deer|M|5000|12
    Poaching an elk|M|10000|12
    Poaching a bear|M|10000|12
    Poaching a bighorn sheep|M|10000|12
    Poaching a mountain lion|M|10000|12
    Taking an endangered species|F|50000|12
    Killing a bald or golden eagle|M|100000|12
    Killing a migratory bird|M|15000|6
    Hunting without a license|M|1000|6
    Hunting during a closed season|M|1000|6
    Spotlighting deer at night|M|1000|6
    Shooting wildlife from a vehicle|M|1000|6
    Selling wildlife parts|F|40000|12
    Commercial fishing without a license|M|5000|6
    Taking abalone for sale|F|40000|12
    Overharvesting fish for sale|M|5000|6
    Gross overlimit (three times the bag limit)|M|5000|12
    Exotic animal kept without a permit|M|10000|6
    Releasing an invasive species|M|5000|6
    Hunting while intoxicated|M|1000|6
    Trapping without a license|M|1000|6
    Using poison to take fish|M|5000|12
    Using explosives to take fish|F|10000|36
    Harassing marine mammals|M|10000|12
    Killing a wild horse or burro|F|2000|12`);

  A('HS', 3, 'Environmental, health & licensing crimes', `
    Illegal dumping — commercial quantity|M|5000|6
    Illegal dumping of hazardous waste|F|100000|36
    Transporting hazardous waste without a license|F|50000|36
    Illegal disposal of medical waste|F|50000|36
    Discharging pollutants into a waterway|F|25000|12
    Knowingly discharging oil into water|F|50000|36
    Burning tires or hazardous materials|M|10000|12
    Asbestos removal without a permit|F|50000|36
    Operating an illegal landfill|F|50000|36
    Selling adulterated food|M|1000|12
    Selling food after a closure order|M|1000|6
    Selling counterfeit medicine|F|10000|36
    Practicing medicine without a license|F|10000|36
    Practicing dentistry without a license|F|10000|36
    Operating an unlicensed pharmacy|F|10000|36
    Unlicensed cosmetic injections|F|10000|36
    Unlicensed veterinary practice|M|5000|12
    Violating a public health order|M|1000|6
    Tampering with consumer products|F|10000|60
    Water theft from a fire hydrant|M|1000|6
    Illegal cannabis grow on public land|F|50000|36
    Illegal water diversion for cultivation|M|10000|12
    Clear-cutting trees without a permit|M|10000|6
    Mining without a permit|M|10000|6
    Wildfire caused by negligent equipment use|M|10000|12`);

  A('PC', 22, 'Attempt, conspiracy & solicitation', `
    Attempted rape|F|10000|48
    Attempted grand theft|F|5000|18
    Attempted auto theft|F|5000|18
    Attempted identity theft|F|5000|18
    Attempted extortion|F|5000|24
    Attempted bribery|F|5000|24
    Attempted possession of drugs for sale|F|5000|18
    Attempted sale of a controlled substance|F|5000|24
    Attempted mayhem|F|10000|48
    Attempted forgery|F|5000|18
    Attempted human trafficking|F|10000|72
    Attempted vehicle burglary|F|5000|18
    Attempted residential burglary|F|5000|36
    Attempted commercial burglary|F|5000|18
    Attempted voluntary manslaughter|F|10000|66
    Conspiracy to commit a felony|F|10000|36
    Conspiracy to commit a misdemeanor|M|1000|12
    Conspiracy to commit burglary|F|10000|36
    Conspiracy to commit kidnapping|F|10000|96
    Conspiracy to commit arson|F|10000|72
    Conspiracy to commit fraud|F|10000|36
    Conspiracy to commit identity theft|F|10000|36
    Conspiracy to obstruct justice|F|10000|36
    Conspiracy to commit assault|F|10000|36
    Conspiracy to commit theft|F|10000|36
    Conspiracy to commit carjacking|F|10000|108
    Conspiracy to commit insurance fraud|F|50000|60
    Conspiracy to commit money laundering|F|250000|60
    Conspiracy to escape|F|10000|36
    Conspiracy to commit terrorism|F|0|L
    Conspiracy to commit voter fraud|F|10000|36
    Solicitation to commit robbery|F|10000|36
    Solicitation to commit burglary|F|10000|36
    Solicitation to commit carjacking|F|10000|36
    Solicitation to commit kidnapping|F|10000|36
    Solicitation to commit arson|F|10000|36
    Solicitation to commit assault with a deadly weapon|F|10000|36
    Solicitation to sell drugs|F|10000|36
    Solicitation to commit perjury|F|10000|36
    Solicitation to commit grand theft|F|10000|36
    Aiding and abetting a felony|F|10000|36
    Aiding and abetting a misdemeanor|M|1000|6
    Concealing a known felony (misprision)|M|1000|6`);

  A('PC', 23, 'Miscellaneous offenses', `
    Drone flight over a jail or prison|M|1000|6
    Interfering with a flight crew|F|10000|60
    Trespassing on an airport runway|M|1000|6
    Carrying a weapon onto an aircraft|F|10000|60
    Hoax distress call to the Coast Guard|F|10000|36
    Using a drone to spy on a person|M|1000|6
    Selling human organs|F|50000|60
    Tampering with a gas, electric or water meter|M|1000|6
    Practicing law without a license|M|1000|12
    Sabotaging the power grid|F|10000|36
    Cutting a fiber-optic or phone line|F|10000|36
    Pulling a false fire alarm|M|1000|12
    Tampering with an aircraft smoke detector|M|2000|6
    Radio interference with aviation|F|10000|36
    Removing items from a grave|F|10000|36
    Possession of artifacts taken from a grave|F|10000|36
    Removing historic artifacts from public land|M|5000|12
    Selling alcohol without a license (bootlegging)|M|1000|6
    Unlicensed distilling (moonshining)|M|5000|12
    Selling alcohol to an obviously intoxicated person|M|1000|6
    Licensee selling alcohol after hours|M|1000|6
    Interfering with a lifeguard|M|1000|6
    Entering a wildfire evacuation zone|M|1000|6`);

  window.PFM_CHARGES = { traffic, other, arrest };
})();
