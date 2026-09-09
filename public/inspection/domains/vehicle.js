/* Pre-purchase vehicle inspection. */

const D = (section, item, sev, title, body, rec) => ({
  id: `veh.${section}.${item}.${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
  section, item, sev, title, body, rec,
});

const MECH = 'Contact a qualified mechanic.';
const TIRE = 'Contact a qualified tire shop.';
const BRAKE = 'Contact a qualified brake specialist.';
const BODY = 'Contact a qualified body shop.';
const TRANS = 'Contact a qualified transmission specialist.';
const ELEC = 'Contact a qualified automotive electrical specialist.';
const EXHAUST = 'Contact a qualified exhaust shop.';
const GLASS = 'Contact a qualified auto glass shop.';
const ALIGN = 'Contact a qualified alignment shop.';
const DEALER = 'Contact a franchise dealer for this make.';
const SELLER = 'Ask the seller for records or an explanation.';
const MONITOR = 'Recommend monitoring.';
const DIY = 'Owner-serviceable or a quick shop visit.';

const INTAKE = [
  {
    id: 'vehicle',
    title: 'The Vehicle',
    hint: 'The only part you actually have to type.',
    fields: [
      { id: 'year', label: 'Model Year', type: 'number', placeholder: '2016', required: true, width: 'short' },
      { id: 'make', label: 'Make', type: 'text', placeholder: 'Toyota', required: true },
      { id: 'model', label: 'Model', type: 'text', placeholder: '4Runner SR5', required: true },
      { id: 'vin', label: 'VIN', type: 'text', placeholder: 'JTEBU5JR4G5xxxxxx', required: true },
      { id: 'mileage', label: 'Odometer Reading', type: 'number', placeholder: '128400', required: true },
      { id: 'color', label: 'Colour', type: 'text', placeholder: 'Magnetic Grey' },
      { id: 'client', label: 'Client Name', type: 'text', placeholder: 'Liam Powell', required: true },
      { id: 'inspector', label: 'Inspector / Technician', type: 'text', placeholder: 'Your name', required: true },
      { id: 'company', label: 'Shop', type: 'text', placeholder: 'Newtown Road Automotive', required: true },
      { id: 'date', label: 'Inspection Date', type: 'date', required: true },
    ],
  },
  {
    id: 'spec',
    title: 'The Specification',
    hint: 'Click through it — this fills the identification section.',
    fields: [
      { id: 'body', label: 'Body Style', type: 'choice', options: ['Sedan', 'Hatchback', 'Coupe', 'SUV / Crossover', 'Pickup Truck', 'Minivan', 'Wagon', 'Convertible'] },
      { id: 'doors', label: 'Doors', type: 'counter', min: 2, max: 5, value: 4 },
      { id: 'seats', label: 'Seats', type: 'counter', min: 2, max: 9, value: 5 },
      { id: 'fuel', label: 'Fuel Type', type: 'choice', options: ['Gasoline', 'Diesel', 'Hybrid', 'Plug-in Hybrid', 'Battery Electric'] },
      { id: 'engine', label: 'Engine', type: 'choice', options: ['3 or 4 Cylinder', 'V6', 'V8', 'Turbocharged 4 Cylinder', 'Turbocharged 6 Cylinder', 'Electric Motor(s)'] },
      { id: 'transmission', label: 'Transmission', type: 'choice', options: ['Automatic', 'Manual', 'CVT', 'Dual Clutch', 'Single Speed (EV)'] },
      { id: 'drivetrain', label: 'Drivetrain', type: 'choice', options: ['Front Wheel Drive', 'Rear Wheel Drive', 'All Wheel Drive', 'Part-Time 4WD'] },
      { id: 'titleStatus', label: 'Title Status', type: 'choice', options: ['Clean', 'Salvage', 'Rebuilt', 'Flood', 'Lemon Law Buyback', 'Not Provided'] },
      { id: 'owners', label: 'Owners on Record', type: 'choice', options: ['1', '2', '3', '4 or more', 'Unknown'] },
      { id: 'records', label: 'Service Records', type: 'choice', options: ['Complete', 'Partial', 'None Provided'] },
      { id: 'accidents', label: 'Reported Accidents', type: 'choice', options: ['None Reported', 'One Reported', 'Multiple Reported', 'History Not Available'] },
    ],
  },
  {
    id: 'method',
    title: 'How You Inspected It',
    hint: 'What you were able to do decides what the report can claim.',
    fields: [
      { id: 'inspectionType', label: 'Inspection Type', type: 'choice', options: ['Pre-purchase', 'Trade-in Appraisal', 'Post-repair Verification', 'Fleet / Annual', 'Safety Inspection'] },
      { id: 'lift', label: 'Raised on a Lift?', type: 'choice', options: ['Yes, full lift', 'Partially, floor jack only', 'No, ground level only'] },
      { id: 'roadTest', label: 'Road Test', type: 'choice', options: ['Yes, mixed roads and highway', 'Yes, low speed only', 'Not performed'] },
      { id: 'scanTool', label: 'OBD-II Scan Performed?', type: 'choice', options: ['Yes', 'No'] },
      { id: 'codes', label: 'Stored Codes Found', type: 'choice', options: ['None', 'Pending codes only', 'Active codes present', 'Not scanned'] },
      { id: 'coldStart', label: 'Cold Start Observed?', type: 'choice', options: ['Yes', 'No, engine was warm on arrival'] },
      { id: 'paintMeter', label: 'Paint Depth Gauge Used?', type: 'choice', options: ['Yes', 'No'] },
      { id: 'weather', label: 'Weather at Inspection', type: 'choice', options: ['Clear, Dry', 'Overcast, Dry', 'Rain', 'Snow / Ice'] },
      { id: 'location', label: 'Inspection Location', type: 'choice', options: ['Shop / Lift Bay', 'Dealer Lot', 'Private Residence', 'Roadside / Parking Lot'] },
    ],
  },
];

const SECTIONS = [
  {
    id: 'info',
    title: 'Inspection Information',
    items: [],
    info: (p) => [
      ['Inspection Type', p.inspectionType],
      ['Odometer at Inspection', `${Number(p.mileage || 0).toLocaleString('en-US')} miles`],
      ['Inspection Location', p.location],
      ['Weather', p.weather],
      ['Raised on a Lift', p.lift],
      ['Road Test', p.roadTest],
      ['OBD-II Scan', p.scanTool],
      ['Cold Start Observed', p.coldStart],
    ],
    narrative: (p) => [
      {
        title: 'Scope of This Inspection',
        text: 'This is a visual and functional inspection of an assembled used vehicle carried out at a '
          + 'single point in time. Nothing was disassembled, no component was removed, and no part was '
          + 'tested to destruction. A vehicle is a machine with thousands of wearing parts, and a '
          + 'condition that is not present or detectable on the day of inspection may appear the '
          + 'following week. This report is not a warranty, a guarantee, or a valuation.',
      },
      ...(p.lift === 'No, ground level only' ? [{
        title: 'Limitation — No Lift Access',
        text: 'LMT — The vehicle was not raised on a lift. The undercarriage, exhaust, subframe, '
          + 'suspension components, and the underside of the drivetrain could only be viewed from '
          + 'ground level. Corrosion, leaks, and impact damage are routinely found in exactly these '
          + 'areas. A lift inspection is strongly recommended before purchase.',
      }] : []),
      ...(p.roadTest === 'Not performed' ? [{
        title: 'Limitation — No Road Test',
        text: 'LMT — A road test was not performed. Transmission shift quality, drivetrain noise, '
          + 'brake performance under load, alignment pull, and most driveability faults can only be '
          + 'evaluated while driving. Any claim about how this vehicle drives is outside the scope of '
          + 'this report.',
      }] : []),
      ...(p.coldStart === 'No, engine was warm on arrival' ? [{
        title: 'Limitation — Engine Warm on Arrival',
        text: 'LMT — The engine was already at operating temperature when the vehicle was presented. '
          + 'Cold start behaviour — startup rattle, timing chain noise, blue or white smoke on '
          + 'ignition, and hard starting — could not be evaluated. Where a seller warms a vehicle '
          + 'before an inspection, a second look at a genuine cold start is recommended.',
      }] : []),
      {
        title: 'Items Not Covered',
        text: 'EXCL — Not covered by this inspection: the accuracy of the odometer, open recalls '
          + 'beyond those disclosed, the remaining life of any wearing component, hidden collision '
          + 'repair concealed beneath body filler or fresh paint, internal engine and transmission '
          + 'condition, the operation of aftermarket accessories, and anything requiring disassembly '
          + 'to evaluate.',
      },
    ],
  },
  {
    id: 'identity',
    title: 'Vehicle Identification & History',
    items: [
      { id: 'vin', name: 'VIN and Labels' },
      { id: 'title', name: 'Title and Records' },
      { id: 'recalls', name: 'Recalls' },
      { id: 'odometer', name: 'Odometer' },
    ],
    info: (p) => [
      ['Year / Make / Model', `${p.year} ${p.make} ${p.model}`],
      ['VIN', p.vin],
      ['Body Style', `${p.body}, ${p.doors} door`],
      ['Engine / Fuel', `${p.engine}, ${p.fuel}`],
      ['Transmission', p.transmission],
      ['Drivetrain', p.drivetrain],
      ['Title Status', p.titleStatus],
      ['Owners on Record', p.owners],
      ['Service Records', p.records],
      ['Reported Accidents', p.accidents],
    ],
    narrative: () => [
      {
        title: 'Identification Check',
        text: 'The VIN on the dash, the door jamb label, and the paperwork presented were compared for '
          + 'agreement. A mismatch, a missing label, or a label showing signs of removal is reported '
          + 'below where found.',
      },
      {
        title: 'History Report Limitation',
        text: 'LMT — Any history information in this report comes from what the seller provided and '
          + 'from commercial history services. Those services only know what was reported to them. An '
          + 'accident settled privately, without an insurance claim or a police report, will not '
          + 'appear on any history report and is invisible to it.',
      },
    ],
  },
  {
    id: 'roadtest',
    title: 'Road Test',
    items: [
      { id: 'startup', name: 'Starting and Idle' },
      { id: 'acceleration', name: 'Acceleration and Power' },
      { id: 'shifting', name: 'Shift Quality' },
      { id: 'braking', name: 'Braking Under Road Conditions' },
      { id: 'tracking', name: 'Tracking and Alignment' },
      { id: 'noise', name: 'Noise, Vibration, Harshness' },
      { id: 'cruise', name: 'Cruise Control and Driver Aids' },
    ],
    info: (p) => [
      ['Road Test Performed', p.roadTest],
      ['Stored Codes', p.codes],
    ],
    narrative: () => [
      {
        title: 'Road Test Method',
        text: 'Where performed, the road test covered low speed manoeuvring, moderate and full-throttle '
          + 'acceleration, braking from speed, and steady highway cruising. The vehicle was driven with '
          + 'the audio system off and a window down for part of the test so that noises could be heard.',
      },
      {
        title: 'Intermittent Faults',
        text: 'LMT — Driveability faults are frequently intermittent and temperature dependent. A '
          + 'road test of twenty to thirty minutes cannot reproduce a fault that appears once a week or '
          + 'only after an hour of driving. No representation is made about behaviour outside the road '
          + 'test performed.',
      },
    ],
  },
  {
    id: 'engine',
    title: 'Engine & Engine Bay',
    items: [
      { id: 'oil', name: 'Engine Oil' },
      { id: 'leaks', name: 'Engine Oil Leaks' },
      { id: 'belts', name: 'Belts and Pulleys' },
      { id: 'mounts', name: 'Engine Mounts' },
      { id: 'intake', name: 'Air Intake and Filter' },
      { id: 'noise', name: 'Engine Noise' },
      { id: 'smoke', name: 'Exhaust Smoke' },
      { id: 'wiring', name: 'Engine Bay Wiring and Hoses' },
    ],
    info: (p) => [
      ['Engine', `${p.engine}, ${p.fuel}`],
      ['Cold Start Observed', p.coldStart],
    ],
    narrative: () => [
      {
        title: 'Engine Evaluation Limits',
        text: 'EXCL — The internal condition of the engine is not visible and is excluded. '
          + 'Compression and leak-down testing, oil analysis, and borescope inspection of the cylinders '
          + 'are separate services that were not performed unless stated. An engine that runs smoothly '
          + 'on the day of inspection can still carry internal wear that only a teardown would reveal.',
      },
      {
        title: 'Fluid Condition',
        text: 'Fluid levels and appearance were checked where a dipstick or sight glass allowed. '
          + 'Colour and smell are indicators, not measurements. Where a fluid looked wrong for its '
          + 'service interval it is reported below.',
      },
    ],
  },
  {
    id: 'drivetrain',
    title: 'Transmission & Drivetrain',
    items: [
      { id: 'fluid', name: 'Transmission Fluid' },
      { id: 'operation', name: 'Transmission Operation' },
      { id: 'clutch', name: 'Clutch (Manual)' },
      { id: 'axles', name: 'CV Joints and Axles' },
      { id: 'driveshaft', name: 'Driveshaft and Differentials' },
      { id: 'transfer', name: 'Transfer Case / AWD System' },
    ],
    info: (p) => [
      ['Transmission', p.transmission],
      ['Drivetrain', p.drivetrain],
    ],
    narrative: () => [
      {
        title: 'Transmission Limitation',
        text: 'EXCL — Automatic transmissions are sealed assemblies whose internal condition cannot '
          + 'be assessed without disassembly or specialist diagnostic equipment. Shift quality on a '
          + 'road test is the only practical indicator available during a pre-purchase inspection, and '
          + 'a transmission that shifts acceptably today can still fail without warning.',
      },
    ],
  },
  {
    id: 'cooling',
    title: 'Cooling System',
    items: [
      { id: 'coolant', name: 'Coolant Condition and Level' },
      { id: 'radiator', name: 'Radiator and Condenser' },
      { id: 'hoses', name: 'Hoses and Clamps' },
      { id: 'waterpump', name: 'Water Pump' },
      { id: 'fans', name: 'Cooling Fans' },
      { id: 'temp', name: 'Operating Temperature' },
    ],
    info: () => [],
    narrative: () => [
      {
        title: 'Cooling System Note',
        text: 'The cooling system was inspected cold where possible and observed at operating '
          + 'temperature. The system was not pressure tested unless stated. Overheating is one of the '
          + 'few faults that turns a running engine into a replacement engine in a matter of minutes, '
          + 'so any finding in this section deserves attention before the vehicle is driven far.',
      },
    ],
  },
  {
    id: 'brakes',
    title: 'Brakes',
    items: [
      { id: 'pads', name: 'Brake Pads and Shoes' },
      { id: 'rotors', name: 'Rotors and Drums' },
      { id: 'lines', name: 'Brake Lines and Hoses' },
      { id: 'fluid', name: 'Brake Fluid' },
      { id: 'parking', name: 'Parking Brake' },
      { id: 'abs', name: 'ABS and Stability Systems' },
      { id: 'calipers', name: 'Calipers and Hardware' },
    ],
    info: () => [],
    narrative: () => [
      {
        title: 'Brake Measurement',
        text: 'Where the wheels were removed or the components were visible, friction material was '
          + 'measured or estimated and rotor surfaces were examined for scoring, lipping, and heat '
          + 'checking. Where wheels were not removed, the measurement is an estimate through the wheel '
          + 'and should be confirmed on a lift.',
      },
    ],
  },
  {
    id: 'suspension',
    title: 'Suspension & Steering',
    items: [
      { id: 'shocks', name: 'Shocks and Struts' },
      { id: 'bushings', name: 'Bushings and Control Arms' },
      { id: 'balljoints', name: 'Ball Joints and Tie Rods' },
      { id: 'springs', name: 'Springs' },
      { id: 'steering', name: 'Steering Rack and Pump' },
      { id: 'wheelbearings', name: 'Wheel Bearings' },
      { id: 'alignment', name: 'Alignment' },
    ],
    info: () => [],
    narrative: () => [
      {
        title: 'Suspension Wear',
        text: 'Suspension and steering components wear gradually, and a vehicle that feels normal to a '
          + 'driver who has owned it for years may still have significant wear. Components were checked '
          + 'for play, torn boots, leaking dampers, and corrosion where visible.',
      },
    ],
  },
  {
    id: 'tires',
    title: 'Tires & Wheels',
    items: [
      { id: 'tread', name: 'Tread Depth' },
      { id: 'wear', name: 'Wear Pattern' },
      { id: 'age', name: 'Tire Age' },
      { id: 'damage', name: 'Tire Damage' },
      { id: 'wheels', name: 'Wheels' },
      { id: 'spare', name: 'Spare and Tools' },
      { id: 'tpms', name: 'TPMS' },
    ],
    info: () => [],
    narrative: () => [
      {
        title: 'Tread and Age',
        text: 'Tread depth was measured with a gauge at multiple points across each tire. Tires are '
          + 'legally worn out at 2/32 inch and lose meaningful wet weather grip well before that. Tire '
          + 'age was read from the four digit DOT date code; rubber hardens and cracks with age '
          + 'regardless of tread remaining, and tires over six years old are generally recommended for '
          + 'replacement even if they look new.',
      },
    ],
  },
  {
    id: 'exhaust',
    title: 'Exhaust & Emissions',
    items: [
      { id: 'pipes', name: 'Exhaust Pipes and Muffler' },
      { id: 'cat', name: 'Catalytic Converter' },
      { id: 'sensors', name: 'Oxygen Sensors' },
      { id: 'evap', name: 'EVAP System' },
      { id: 'dpf', name: 'DPF / DEF (Diesel)' },
      { id: 'readiness', name: 'Emissions Readiness' },
    ],
    info: (p) => [
      ['Fuel Type', p.fuel],
      ['Stored Codes', p.codes],
    ],
    narrative: () => [
      {
        title: 'Emissions Testing',
        text: 'This inspection does not constitute a state emissions test. Where an OBD-II scan was '
          + 'performed, stored and pending codes and the readiness monitor status were noted. A vehicle '
          + 'whose monitors have been recently cleared will not pass an emissions test until it has '
          + 'been driven long enough for the monitors to re-run.',
      },
    ],
  },
  {
    id: 'electrical',
    title: 'Electrical & Battery',
    items: [
      { id: 'battery', name: 'Battery' },
      { id: 'charging', name: 'Charging System' },
      { id: 'starter', name: 'Starting System' },
      { id: 'wiring', name: 'Wiring and Grounds' },
      { id: 'accessories', name: 'Powered Accessories' },
      { id: 'hv', name: 'High Voltage System (Hybrid / EV)' },
    ],
    info: (p) => [
      ['Fuel Type', p.fuel],
    ],
    narrative: (p) => [
      {
        title: 'Electrical Testing',
        text: 'The battery was tested for state of charge and, where equipment allowed, cranking '
          + 'capacity. Charging voltage was measured at idle. Powered accessories were operated through '
          + 'their normal controls.',
      },
      ...(p.fuel === 'Hybrid' || p.fuel === 'Plug-in Hybrid' || p.fuel === 'Battery Electric' ? [{
        title: 'High Voltage Battery Limitation',
        text: 'LMT — The state of health of the high voltage traction battery is the single largest '
          + 'financial variable in a used hybrid or electric vehicle, and it cannot be determined from '
          + 'a visual inspection or a generic scan tool. A manufacturer-level battery health report '
          + 'from a franchise dealer is strongly recommended before purchase. Any range or capacity '
          + 'figure in this report is an observation from the vehicle display, not a measurement.',
      }] : []),
    ],
  },
  {
    id: 'body',
    title: 'Body, Paint & Frame',
    items: [
      { id: 'paint', name: 'Paint Condition and Depth' },
      { id: 'panels', name: 'Panel Fit and Gaps' },
      { id: 'rust', name: 'Corrosion' },
      { id: 'frame', name: 'Frame and Structure' },
      { id: 'glassbody', name: 'Doors, Hood and Trunk' },
      { id: 'trim', name: 'Exterior Trim' },
      { id: 'flood', name: 'Water and Flood Indicators' },
    ],
    info: (p) => [
      ['Paint Depth Gauge Used', p.paintMeter],
      ['Reported Accidents', p.accidents],
      ['Title Status', p.titleStatus],
    ],
    narrative: (p) => [
      {
        title: 'Repair History Indicators',
        text: 'Panel gaps, paint texture, overspray, replaced fasteners, and mismatched finish were '
          + 'examined as indicators of past repair. Not all repair is bad repair — a properly repaired '
          + 'panel can be entirely sound. The purpose of reporting it is so that the buyer knows what '
          + 'they are buying and can price it accordingly.',
      },
      ...(p.paintMeter === 'No' ? [{
        title: 'Limitation — No Paint Depth Gauge',
        text: 'LMT — A paint depth gauge was not used. Body filler and repainted panels can be '
          + 'invisible to the eye under good paint. Findings in this section are based on visual '
          + 'indicators only.',
      }] : []),
    ],
  },
  {
    id: 'glass',
    title: 'Glass, Lights & Wipers',
    items: [
      { id: 'windshield', name: 'Windshield' },
      { id: 'otherglass', name: 'Side and Rear Glass' },
      { id: 'headlights', name: 'Headlights' },
      { id: 'otherlights', name: 'Other Exterior Lighting' },
      { id: 'wipers', name: 'Wipers and Washers' },
      { id: 'mirrors', name: 'Mirrors' },
    ],
    info: () => [],
    narrative: () => [
      {
        title: 'Lighting Check',
        text: 'All exterior lighting was operated: headlights on both beams, running lights, turn '
          + 'signals, hazards, brake lights including the centre lamp, reverse lights, and plate '
          + 'lights. Any lamp not operating is reported below.',
      },
    ],
  },
  {
    id: 'interior',
    title: 'Interior & Controls',
    items: [
      { id: 'seats', name: 'Seats and Upholstery' },
      { id: 'belts', name: 'Seat Belts' },
      { id: 'airbags', name: 'Airbags and SRS' },
      { id: 'dash', name: 'Dashboard and Warning Lights' },
      { id: 'infotainment', name: 'Infotainment and Audio' },
      { id: 'windows', name: 'Windows and Locks' },
      { id: 'odours', name: 'Odours and Cleanliness' },
      { id: 'keys', name: 'Keys and Remotes' },
    ],
    info: (p) => [
      ['Seats', String(p.seats)],
      ['Odometer Reading', `${Number(p.mileage || 0).toLocaleString('en-US')} miles`],
    ],
    narrative: () => [
      {
        title: 'Interior Wear Versus Mileage',
        text: 'Interior wear was compared against the indicated mileage. A steering wheel, shift knob, '
          + 'and driver seat bolster that are worn far beyond what the odometer suggests is a reason to '
          + 'ask questions and to verify the mileage against service records.',
      },
    ],
  },
  {
    id: 'hvac',
    title: 'Climate Control',
    items: [
      { id: 'ac', name: 'Air Conditioning' },
      { id: 'heat', name: 'Heater' },
      { id: 'blower', name: 'Blower and Vents' },
      { id: 'cabinfilter', name: 'Cabin Air Filter' },
      { id: 'controls', name: 'Climate Controls' },
    ],
    info: () => [],
    narrative: () => [
      {
        title: 'Climate System Note',
        text: 'The air conditioning was operated and vent temperature was compared against ambient. '
          + 'The system was not evacuated, weighed, or pressure tested. Air conditioning performance '
          + 'varies with ambient temperature and humidity, and a system that is low on refrigerant is '
          + 'low because it is leaking somewhere.',
      },
    ],
  },
  {
    id: 'undercarriage',
    title: 'Undercarriage & Leaks',
    items: [
      { id: 'leaks', name: 'Fluid Leaks' },
      { id: 'underrust', name: 'Undercarriage Corrosion' },
      { id: 'skid', name: 'Impact and Skid Damage' },
      { id: 'fuel', name: 'Fuel System' },
      { id: 'mounts', name: 'Subframe and Mounts' },
    ],
    info: (p) => [
      ['Raised on a Lift', p.lift],
    ],
    narrative: () => [
      {
        title: 'Leak Classification',
        text: 'Leaks are reported as seepage (damp, no drip forming), a leak (drip forming, wet '
          + 'surrounding area), or an active leak (dripping onto the ground). Seepage on an older '
          + 'engine is common and often monitored rather than repaired; an active leak of any fluid '
          + 'should be identified and corrected.',
      },
    ],
  },
];

const DEFECTS = [
  /* identity */
  D('identity', 'vin', 'significant', 'VIN Mismatch Between Label and Paperwork',
    'The VIN shown on the vehicle did not match the VIN on the paperwork presented, or a VIN label showed signs of tampering or removal. This must be resolved before any money changes hands. Do not proceed with the purchase until the discrepancy is explained and verified through the title office or law enforcement.', SELLER),
  D('identity', 'title', 'significant', 'Branded Title — Salvage or Rebuilt',
    'The title carries a salvage or rebuilt brand, meaning an insurer previously declared the vehicle a total loss. A branded vehicle can be perfectly serviceable, but it carries substantially reduced resale value, may be difficult or expensive to insure, and the quality of the repair work is unknown. Confirm what the damage was, who repaired it, and how the vehicle was re-certified.', SELLER),
  D('identity', 'title', 'marginal', 'Service Records Not Provided',
    'No service records were provided for the vehicle. Without records there is no way to confirm that timing belts, transmission services, coolant changes, or other interval maintenance were performed. Where records cannot be produced, budgeting to perform all major interval services on purchase is the safe assumption.', SELLER),
  D('identity', 'recalls', 'marginal', 'Open Safety Recall Present',
    'One or more open safety recalls were identified for this VIN. Recall work is performed at no charge by a franchise dealer for the make. Having the open recalls completed before regular use of the vehicle is recommended.', DEALER),
  D('identity', 'odometer', 'significant', 'Odometer Reading Inconsistent With Records or Wear',
    'The indicated mileage is inconsistent with the wear observed on the vehicle and/or with the mileage recorded in the documents presented. Odometer tampering is a fraud and a felony. Verify the mileage history through service records and title history before proceeding.', SELLER),
  D('identity', 'odometer', 'minor', 'High Mileage for Age',
    'FYI — The mileage is high relative to the age of the vehicle. Highway miles are gentler on a vehicle than the same distance in city driving, and a well-maintained high mileage vehicle can outlast a neglected low mileage one, but wear items will come due sooner and resale value is affected.', MONITOR),

  /* road test */
  D('roadtest', 'startup', 'marginal', 'Hard Starting — Extended Crank',
    'The engine required an extended crank before starting. This can be caused by a failing fuel pump or check valve, a weak battery, worn plugs, or a sensor fault. Diagnosis is recommended before purchase, as the causes range from inexpensive to significant.', MECH),
  D('roadtest', 'startup', 'marginal', 'Rough or Unstable Idle',
    'The engine idled roughly or the idle speed hunted up and down. Common causes include vacuum leaks, dirty throttle bodies, failing ignition components, and misfires. Diagnosis with a scan tool is recommended.', MECH),
  D('roadtest', 'acceleration', 'significant', 'Loss of Power / Limp Mode',
    'The vehicle lost power during acceleration or entered a reduced power (limp) mode during the road test. This indicates the engine management system has detected a fault it considers serious. Do not purchase this vehicle without a full diagnosis of the cause.', MECH),
  D('roadtest', 'acceleration', 'marginal', 'Hesitation Under Acceleration',
    'The vehicle hesitated or stumbled under acceleration. Causes range from fuel delivery and ignition faults to sensor problems. Diagnosis is recommended.', MECH),
  D('roadtest', 'shifting', 'significant', 'Transmission Slipping',
    'The transmission slipped during the road test — engine speed rose without a corresponding increase in road speed. Slipping indicates internal clutch or band wear and generally leads to rebuild or replacement, which is among the most expensive repairs a vehicle can need. Evaluation by a transmission specialist is strongly recommended before purchase.', TRANS),
  D('roadtest', 'shifting', 'marginal', 'Harsh or Delayed Shifts',
    'Shifts were harsh, delayed, or accompanied by a flare between gears. This can be as simple as degraded fluid or as involved as internal wear or a failing solenoid. Evaluation by a transmission specialist is recommended before purchase.', TRANS),
  D('roadtest', 'shifting', 'marginal', 'CVT Shudder Present',
    'A shudder was felt from the continuously variable transmission under light acceleration. CVT shudder frequently indicates belt or pulley wear and these units are typically replaced rather than repaired. Evaluation by a specialist familiar with this transmission is recommended before purchase.', TRANS),
  D('roadtest', 'braking', 'significant', 'Brake Pedal Soft or Sinking',
    'SFTY — The brake pedal felt soft or continued to sink under steady pressure. This indicates air in the system, a fluid leak, or a failing master cylinder. Do not drive the vehicle further until this is repaired.', BRAKE),
  D('roadtest', 'braking', 'marginal', 'Brake Pulsation Under Braking',
    'A pulsation was felt through the pedal or steering wheel under braking, indicating rotor thickness variation or warping. Machining or replacement of the affected rotors is recommended.', BRAKE),
  D('roadtest', 'braking', 'marginal', 'Vehicle Pulls Under Braking',
    'SFTY — The vehicle pulled to one side under braking, indicating a sticking caliper, a collapsed hose, or uneven friction material. Diagnosis and repair is recommended for safety.', BRAKE),
  D('roadtest', 'tracking', 'marginal', 'Vehicle Pulls While Driving',
    'The vehicle pulled to one side while driving on a level road. This can be alignment, uneven tire wear, or a dragging brake. An alignment check with correction as needed is recommended.', ALIGN),
  D('roadtest', 'tracking', 'minor', 'Steering Wheel Off Centre',
    'The steering wheel was off centre while driving straight. This is typically corrected during a four wheel alignment.', ALIGN),
  D('roadtest', 'noise', 'marginal', 'Vibration at Highway Speed',
    'A vibration was present at highway speed. Wheel balance is the most common cause; bent wheels, tire defects, worn driveline components, and warped rotors also produce vibration at speed. Diagnosis starting with a road force balance is recommended.', TIRE),
  D('roadtest', 'noise', 'marginal', 'Drivetrain Whine or Hum',
    'A whine or hum was audible from the drivetrain that varied with road speed. Wheel bearings, differentials, and transmissions all produce speed-dependent noise. Diagnosis on a lift is recommended.', MECH),
  D('roadtest', 'noise', 'minor', 'Suspension Noise Over Bumps',
    'A knock or clunk was audible from the suspension over bumps. Sway bar links and bushings are the usual sources and are inexpensive; ball joints and control arm bushings are more involved. Diagnosis on a lift is recommended.', MECH),
  D('roadtest', 'cruise', 'minor', 'Cruise Control Inoperative',
    'The cruise control did not engage or would not hold speed. Repairs as desired are recommended.', MECH),
  D('roadtest', 'cruise', 'marginal', 'Driver Assistance System Fault',
    'A driver assistance system — lane keeping, blind spot monitoring, adaptive cruise, or collision warning — reported a fault or was disabled. These systems rely on cameras and radar that require calibration after windshield replacement or body repair, and calibration is not inexpensive. Diagnosis is recommended.', DEALER),

  /* engine */
  D('engine', 'oil', 'marginal', 'Engine Oil — Overdue for Service',
    'The engine oil was dark, thin, and/or below the recommended level, indicating the service interval has been exceeded. An oil and filter change is recommended, and the condition of the oil is a fair indicator of how the rest of the vehicle has been maintained.', DIY),
  D('engine', 'oil', 'significant', 'Engine Oil — Coolant Contamination',
    'The engine oil showed a milky or foamy appearance consistent with coolant intrusion. This commonly indicates a failed head gasket or a cracked head or block, and is among the most expensive faults a used vehicle can carry. Do not purchase this vehicle without a full engine diagnosis including a block test.', MECH),
  D('engine', 'oil', 'marginal', 'Engine Oil — Low Level',
    'The engine oil level was below the minimum mark on the dipstick. Either the engine consumes oil or it leaks, and the owner is not checking it. Determining which is recommended before purchase.', MECH),
  D('engine', 'leaks', 'marginal', 'Valve Cover Gasket Seepage',
    'Oil seepage was present at the valve cover gasket. This is a common wear item and a moderate repair. Replacement of the gasket is recommended before the seepage progresses to a drip onto hot exhaust components.', MECH),
  D('engine', 'leaks', 'significant', 'Rear Main Seal Leak',
    'An oil leak was present at the rear of the engine consistent with a rear main seal failure. Access requires removal of the transmission, which makes an inexpensive part into a significant labour bill. Evaluation with a quote is recommended before purchase.', MECH),
  D('engine', 'leaks', 'marginal', 'Oil Pan Gasket Leak',
    'An oil leak was present at the oil pan gasket. Repair is recommended, and on some engines the pan cannot be dropped without lifting the engine or subframe, so a quote before purchase is advised.', MECH),
  D('engine', 'belts', 'marginal', 'Serpentine Belt — Cracked / Glazed',
    'The serpentine belt was cracked, glazed, or missing material. A belt failure disables the charging system, power steering, and in most cases the water pump. Replacement is recommended.', MECH),
  D('engine', 'belts', 'significant', 'Timing Belt Service Overdue',
    'The vehicle is at or beyond the timing belt replacement interval with no record of the service having been performed. On an interference engine, a timing belt failure destroys the engine. Confirming the service history or performing the service before regular use is strongly recommended.', MECH),
  D('engine', 'belts', 'marginal', 'Pulley or Tensioner Noise',
    'A bearing noise was audible from an accessory pulley or belt tensioner. Replacement of the affected component is recommended before the bearing seizes and takes the belt with it.', MECH),
  D('engine', 'mounts', 'marginal', 'Engine Mount — Collapsed or Torn',
    'An engine or transmission mount was collapsed, torn, or leaking fluid. Worn mounts transmit vibration into the cabin and allow the engine to move under load, which stresses hoses, lines, and the exhaust. Replacement is recommended.', MECH),
  D('engine', 'intake', 'minor', 'Air Filter — Dirty',
    'The engine air filter was dirty. Replacement is recommended as routine maintenance.', DIY),
  D('engine', 'intake', 'marginal', 'Intake Ducting — Cracked or Disconnected',
    'The intake ducting was cracked or improperly seated, allowing unmetered air into the engine. This causes driveability faults and can trigger a check engine light. Repair or replacement is recommended.', MECH),
  D('engine', 'noise', 'significant', 'Engine Knock Present',
    'A knocking noise was present from the engine that varied with engine speed. A deep knock from the bottom end typically indicates bearing failure and means the engine requires rebuilding or replacement. Do not purchase this vehicle without a full engine diagnosis.', MECH),
  D('engine', 'noise', 'marginal', 'Timing Chain Rattle on Startup',
    'A rattle was present from the timing chain area on startup. This indicates a stretched chain or a worn tensioner and, left alone, eventually results in a jumped chain and a destroyed engine on interference designs. Evaluation with a quote is recommended before purchase.', MECH),
  D('engine', 'noise', 'marginal', 'Valvetrain Tick Present',
    'A tick was audible from the top of the engine consistent with valvetrain noise. Causes range from an overdue oil change through collapsed lifters to worn cam followers. Diagnosis is recommended.', MECH),
  D('engine', 'smoke', 'significant', 'Blue Smoke From Exhaust',
    'Blue smoke was observed from the exhaust, indicating the engine is burning oil. Worn valve seals, worn rings, or a failed turbocharger seal are the usual causes, and all are significant repairs. Do not purchase without a compression and leak-down test.', MECH),
  D('engine', 'smoke', 'significant', 'White Smoke From Exhaust',
    'Persistent white smoke with a sweet smell was observed from the exhaust, indicating coolant is entering the combustion chamber. This typically means a head gasket, head, or block failure. Do not purchase without a full engine diagnosis including a block test.', MECH),
  D('engine', 'smoke', 'marginal', 'Black Smoke From Exhaust',
    'Black smoke was observed from the exhaust, indicating the engine is running rich. Causes include failing sensors, leaking injectors, and fuel pressure faults. Diagnosis is recommended, and a rich condition will eventually damage the catalytic converter.', MECH),
  D('engine', 'wiring', 'marginal', 'Rodent Damage to Wiring or Hoses',
    'Damage consistent with rodent activity was present to wiring insulation or hoses in the engine bay. Rodent damage is frequently more extensive than the visible portion and can be expensive to trace. Full evaluation of the affected harness is recommended.', ELEC),
  D('engine', 'wiring', 'marginal', 'Vacuum Hose — Cracked or Disconnected',
    'A vacuum hose was cracked, brittle, or disconnected. Vacuum leaks cause rough idle, driveability faults, and check engine lights. Replacement of the affected hoses is recommended.', MECH),

  /* drivetrain */
  D('drivetrain', 'fluid', 'marginal', 'Transmission Fluid — Burnt or Dark',
    'The transmission fluid was dark and/or smelled burnt. This indicates the fluid has been overheated and the clutch material inside is wearing. A service may help, but on a high mileage unit with badly degraded fluid a service can also precipitate failure. Evaluation by a transmission specialist before purchase is recommended.', TRANS),
  D('drivetrain', 'fluid', 'marginal', 'Transmission Fluid Leak',
    'A leak was present at the transmission — commonly the pan gasket, an axle seal, or a cooler line. Repair is recommended, as running a transmission low on fluid destroys it.', TRANS),
  D('drivetrain', 'operation', 'marginal', 'Delayed Engagement Into Gear',
    'The transmission was slow to engage when shifted into drive or reverse. Delayed engagement typically indicates internal wear or low fluid pressure. Evaluation by a specialist is recommended before purchase.', TRANS),
  D('drivetrain', 'clutch', 'marginal', 'Clutch — Slipping or High Engagement Point',
    'The clutch slipped under load and/or engaged very high in the pedal travel, indicating the friction disc is worn. Clutch replacement is a labour-intensive repair. Evaluation with a quote is recommended before purchase.', MECH),
  D('drivetrain', 'axles', 'marginal', 'CV Boot — Torn / Grease Slung',
    'A CV joint boot was torn and grease had been slung onto surrounding components. Once the boot is open the joint loses its grease, takes in road grit, and fails. Replacement of the boot or the axle is recommended.', MECH),
  D('drivetrain', 'axles', 'marginal', 'CV Joint — Clicking on Turns',
    'A clicking noise was present from a CV joint while turning under load, indicating the joint is worn. Axle replacement is recommended.', MECH),
  D('drivetrain', 'driveshaft', 'marginal', 'Differential Leak',
    'A leak was present at a differential cover or pinion seal. Repair with a fluid service is recommended.', MECH),
  D('drivetrain', 'transfer', 'marginal', 'AWD / 4WD System Did Not Engage',
    'The four wheel drive or all wheel drive system did not engage when selected. Causes include actuator failure, vacuum faults, and internal transfer case wear. Diagnosis is recommended, particularly where the vehicle is being bought for its all wheel drive.', MECH),

  /* cooling */
  D('cooling', 'coolant', 'significant', 'Coolant — Oil Contamination',
    'The coolant showed an oily film or sludge consistent with oil intrusion, which typically indicates head gasket, oil cooler, or transmission cooler failure. Do not purchase this vehicle without a full diagnosis.', MECH),
  D('cooling', 'coolant', 'marginal', 'Coolant — Low Level',
    'The coolant level was below the minimum mark. Coolant does not get consumed, so a low level means it is going somewhere. Pressure testing the cooling system to locate the loss is recommended.', MECH),
  D('cooling', 'coolant', 'minor', 'Coolant — Discoloured / Overdue',
    'The coolant was discoloured or contaminated with rust, indicating the service interval has been exceeded. A cooling system flush and refill with the correct specification coolant is recommended.', MECH),
  D('cooling', 'radiator', 'marginal', 'Radiator — Leak or Damage',
    'A leak, damaged fins, or a damaged end tank was present at the radiator. Repair or replacement is recommended before the vehicle is driven any distance.', MECH),
  D('cooling', 'hoses', 'marginal', 'Coolant Hose — Soft, Swollen or Cracked',
    'A coolant hose was soft, swollen, or cracked. A burst hose empties the cooling system in seconds and an overheated engine can be a destroyed engine. Replacement is recommended.', MECH),
  D('cooling', 'waterpump', 'significant', 'Water Pump — Leaking or Bearing Noise',
    'The water pump was leaking from its weep hole and/or its bearing was audibly worn. Replacement is recommended before failure, and on many engines the pump is driven by the timing belt or chain, which makes this the right time to do that service as well.', MECH),
  D('cooling', 'fans', 'marginal', 'Cooling Fan — Did Not Operate',
    'The cooling fan did not operate when the engine reached temperature or when the air conditioning was engaged. This results in overheating in traffic. Diagnosis and repair is recommended.', MECH),
  D('cooling', 'temp', 'significant', 'Engine Overheated During Inspection',
    'The engine temperature rose above the normal operating range during the inspection. An overheating engine must not be driven. Full diagnosis of the cooling system is required, and the engine should be evaluated for damage already sustained.', MECH),

  /* brakes */
  D('brakes', 'pads', 'significant', 'Brake Pads — Worn Below Minimum',
    'SFTY — The brake friction material was worn to or below the minimum specification. Continued use risks damage to the rotors and a loss of braking performance. Replacement is required before the vehicle is driven regularly.', BRAKE),
  D('brakes', 'pads', 'marginal', 'Brake Pads — Approaching Minimum',
    'The brake friction material was low and will require replacement soon. Budgeting for a brake service in the near term is recommended.', BRAKE),
  D('brakes', 'pads', 'marginal', 'Brake Pads — Uneven Wear Side to Side',
    'Friction material thickness differed significantly between sides, indicating a sticking caliper or seized slide pins. Servicing the affected caliper along with the pad replacement is recommended.', BRAKE),
  D('brakes', 'rotors', 'marginal', 'Rotors — Scored or Lipped',
    'The rotor surfaces were scored or had developed a pronounced edge lip, indicating wear at or near the discard thickness. Replacement with the pads is recommended.', BRAKE),
  D('brakes', 'rotors', 'marginal', 'Rotors — Heavy Surface Rust',
    'Heavy rust was present on the rotor surfaces, consistent with a vehicle that has sat for an extended period. Light surface rust cleans up with use; pitting does not. Evaluation after a short drive is recommended.', BRAKE),
  D('brakes', 'lines', 'significant', 'Brake Line — Corroded or Leaking',
    'SFTY — A brake line or hose was heavily corroded, damaged, or leaking. A brake line failure is a total loss of braking on that circuit. The vehicle should not be driven until this is repaired.', BRAKE),
  D('brakes', 'fluid', 'marginal', 'Brake Fluid — Dark / Moisture Contaminated',
    'The brake fluid was dark or tested high for moisture content. Brake fluid absorbs water from the air, which lowers its boiling point and corrodes the system internally. A flush with fresh fluid to specification is recommended.', BRAKE),
  D('brakes', 'parking', 'marginal', 'Parking Brake — Ineffective',
    'SFTY — The parking brake did not hold the vehicle or required excessive travel. Adjustment or repair is recommended for safety.', BRAKE),
  D('brakes', 'abs', 'marginal', 'ABS Warning Light Illuminated',
    'SFTY — The ABS warning light was illuminated, meaning the anti-lock system has disabled itself. Base braking remains but the anti-lock and, on most vehicles, the stability control functions are inoperative. Diagnosis and repair is recommended.', BRAKE),
  D('brakes', 'calipers', 'marginal', 'Caliper — Seized or Sticking',
    'A caliper was seized or sticking, indicated by uneven pad wear, excess heat at that wheel, and/or a pull under braking. Caliper replacement or service is recommended.', BRAKE),

  /* suspension */
  D('suspension', 'shocks', 'marginal', 'Shock / Strut — Leaking',
    'A shock absorber or strut was leaking oil, meaning it has lost its damping. Worn dampers lengthen stopping distances, allow the tires to skip over bumps, and accelerate tire wear. Replacement in pairs across the axle is recommended.', MECH),
  D('suspension', 'shocks', 'minor', 'Shocks / Struts — Worn',
    'The dampers showed signs of wear consistent with mileage, without visible leakage. Replacement as desired is recommended for ride quality and handling.', MECH),
  D('suspension', 'bushings', 'marginal', 'Control Arm Bushing — Cracked or Deteriorated',
    'A control arm bushing was cracked, split, or deteriorated. Worn bushings allow alignment to shift under load, produce clunks, and wear tires. Replacement of the affected component is recommended.', MECH),
  D('suspension', 'balljoints', 'significant', 'Ball Joint — Excessive Play',
    'SFTY — A ball joint had excessive play. A ball joint failure separates the suspension from the wheel and causes an immediate loss of control. Replacement is required before the vehicle is driven.', MECH),
  D('suspension', 'balljoints', 'marginal', 'Tie Rod End — Play Present',
    'SFTY — Play was present in a tie rod end, which affects steering precision and tire wear and eventually fails. Replacement with an alignment afterwards is recommended.', MECH),
  D('suspension', 'springs', 'significant', 'Coil Spring — Broken',
    'SFTY — A coil spring was broken. A broken spring can contact and cut the tire. Replacement in pairs across the axle is required before the vehicle is driven.', MECH),
  D('suspension', 'steering', 'marginal', 'Power Steering — Leak Present',
    'A leak was present at the power steering rack, pump, or lines. Running the system low causes pump failure and a loss of assist. Repair is recommended.', MECH),
  D('suspension', 'steering', 'marginal', 'Steering — Excessive Free Play',
    'SFTY — Excessive free play was present at the steering wheel before the wheels responded. Diagnosis of the source — rack, coupling, or linkage — with repair as needed is recommended for safety.', MECH),
  D('suspension', 'wheelbearings', 'marginal', 'Wheel Bearing — Noise or Play',
    'A wheel bearing was noisy and/or had play. A failed bearing can seize or allow the hub to separate. Replacement is recommended.', MECH),
  D('suspension', 'alignment', 'minor', 'Alignment — Recommended',
    'Tire wear and road test behaviour indicated the alignment is out of specification. A four wheel alignment is recommended, and is worth performing after any suspension component replacement.', ALIGN),

  /* tires */
  D('tires', 'tread', 'significant', 'Tire — Worn Below Legal Minimum',
    'SFTY — One or more tires were worn to or below 2/32 inch, which is below the legal minimum in most jurisdictions and provides very little wet weather grip. Replacement is required.', TIRE),
  D('tires', 'tread', 'marginal', 'Tires — Low Tread Remaining',
    'The tires had limited tread remaining and will require replacement in the near term. Budgeting for a set of tires should be factored into the purchase price.', TIRE),
  D('tires', 'wear', 'marginal', 'Tire Wear — Uneven / Inner or Outer Edge',
    'Uneven wear was present across the tread, typically on an inside or outside edge. This indicates an alignment fault or a worn suspension component. Correcting the underlying cause before fitting new tires is recommended, or the new tires will wear the same way.', ALIGN),
  D('tires', 'wear', 'marginal', 'Tire Wear — Cupping / Scalloping',
    'Cupped or scalloped wear was present on the tread, which usually indicates worn dampers or an out-of-balance assembly. Diagnosis of the cause along with tire replacement is recommended.', TIRE),
  D('tires', 'wear', 'marginal', 'Tires — Mismatched Across an Axle',
    'The tires fitted differed in brand, model, or size across an axle. Mismatched tires affect handling and braking balance, and on an all wheel drive vehicle differing rolling diameters can damage the drivetrain. Fitting a matched set is recommended.', TIRE),
  D('tires', 'age', 'marginal', 'Tires — Aged Beyond Service Life',
    'AGED — The DOT date codes indicate the tires are more than six years old. Rubber hardens and develops cracks with age regardless of tread depth, and aged tires lose grip and are more prone to failure. Replacement is recommended.', TIRE),
  D('tires', 'damage', 'significant', 'Tire — Sidewall Damage or Bulge',
    'SFTY — A bulge, cut, or other structural damage was present in a tire sidewall. This is an imminent blowout risk and the tire must be replaced before the vehicle is driven.', TIRE),
  D('tires', 'damage', 'marginal', 'Tire — Improper Repair Present',
    'A tire carried an improper repair — a plug without an interior patch, or a repair in the shoulder or sidewall where repairs are not permitted. Replacement of the affected tire is recommended.', TIRE),
  D('tires', 'wheels', 'marginal', 'Wheel — Bent or Damaged',
    'A wheel was bent, cracked, or curbed to the point of affecting the bead seal. This causes vibration and slow leaks. Repair or replacement is recommended.', TIRE),
  D('tires', 'spare', 'minor', 'Spare Tire or Tools Missing',
    'The spare tire, jack, or lug wrench was missing or the spare was flat. Replacing the missing equipment is recommended so the vehicle can be recovered from a puncture.', DIY),
  D('tires', 'tpms', 'minor', 'TPMS Warning Light Illuminated',
    'The tire pressure monitoring light was illuminated. This can be a genuinely low tire, a failed sensor, or a sensor battery at end of life. Diagnosis is recommended.', TIRE),

  /* exhaust */
  D('exhaust', 'pipes', 'marginal', 'Exhaust Leak Present',
    'SFTY — An exhaust leak was present ahead of or beneath the cabin. Exhaust gas contains carbon monoxide, and a leak forward of the cabin can allow it inside. Repair is recommended.', EXHAUST),
  D('exhaust', 'pipes', 'marginal', 'Exhaust — Heavy Corrosion',
    'Heavy corrosion was present on the exhaust system with perforation either present or imminent. Replacement of the affected sections is recommended.', EXHAUST),
  D('exhaust', 'pipes', 'minor', 'Exhaust Hanger — Broken',
    'An exhaust hanger was broken, allowing the system to sag and contact the underbody. Replacement is recommended before the movement cracks a joint.', EXHAUST),
  D('exhaust', 'cat', 'significant', 'Catalytic Converter — Failed or Missing',
    'The catalytic converter has failed, been removed, or has been replaced with a straight pipe. The vehicle will not pass an emissions test in this condition, and converter replacement is expensive. Evaluation with a quote is recommended before purchase.', EXHAUST),
  D('exhaust', 'sensors', 'marginal', 'Oxygen Sensor Fault Code Stored',
    'An oxygen sensor fault code was stored. Sensor faults affect fuel trim and emissions and, left alone, can damage the catalytic converter. Diagnosis and repair is recommended.', MECH),
  D('exhaust', 'evap', 'marginal', 'EVAP System Fault Code Stored',
    'An EVAP system code was stored. Causes range from a loose or failed fuel cap to a cracked purge line or a failed valve. The vehicle will not pass an emissions test with an active EVAP code. Diagnosis is recommended.', MECH),
  D('exhaust', 'dpf', 'significant', 'Diesel Particulate Filter — Restricted or Fault Present',
    'A diesel particulate filter fault was present or the filter was restricted, typically from a service life of short trips that never allow a regeneration cycle to complete. DPF replacement is a major expense. Evaluation by a diesel specialist is recommended before purchase.', MECH),
  D('exhaust', 'readiness', 'marginal', 'Emissions Monitors Not Ready',
    'The OBD-II readiness monitors were incomplete, indicating that the fault memory was recently cleared. The vehicle cannot pass an emissions test until the monitors have re-run, and clearing codes immediately before a sale can conceal an active fault. Re-scanning after a drive cycle is recommended.', MECH),

  /* electrical */
  D('electrical', 'battery', 'marginal', 'Battery — Failed Load Test',
    'The battery failed a load test or showed a low state of health. Replacement is recommended.', DIY),
  D('electrical', 'battery', 'minor', 'Battery Terminals — Corroded',
    'Corrosion was present on the battery terminals, which causes hard starting and charging faults. Cleaning and protecting the terminals is recommended.', DIY),
  D('electrical', 'battery', 'marginal', 'Battery — Not Secured',
    'The battery was not properly secured in its tray. An unsecured battery can move, short against the body, and cause a fire. Securing it properly is recommended.', DIY),
  D('electrical', 'charging', 'marginal', 'Charging System — Voltage Out of Range',
    'Charging voltage was outside the normal range at idle, indicating an alternator or regulator fault. Diagnosis and repair is recommended, as a vehicle that is not charging will strand the driver.', ELEC),
  D('electrical', 'starter', 'marginal', 'Starter — Slow Crank or Intermittent Engagement',
    'The starter cranked slowly or engaged intermittently. Diagnosis to separate a starter fault from a battery or cable fault is recommended.', ELEC),
  D('electrical', 'wiring', 'marginal', 'Aftermarket Wiring — Improperly Installed',
    'SFTY — Aftermarket wiring was present that was spliced without proper connectors, unfused, or run without protection. Improper wiring is a fire risk and a common source of parasitic battery drain. Correction by a qualified installer is recommended.', ELEC),
  D('electrical', 'accessories', 'minor', 'Powered Accessory Inoperative',
    'A powered accessory — a window, mirror, seat, or similar — did not operate at normal controls. Repairs as desired are recommended.', ELEC),
  D('electrical', 'hv', 'significant', 'Hybrid / EV Battery — Degradation or Fault Indicated',
    'The high voltage battery reported a fault, showed significantly reduced capacity, or displayed range well below the original specification. Traction battery replacement is the single largest expense in these vehicles. A manufacturer battery health report is strongly recommended before purchase.', DEALER),
  D('electrical', 'hv', 'minor', 'Hybrid / EV — Battery Health Report Recommended',
    'FYI — No manufacturer battery health report was available for this vehicle. Because the traction battery is the most expensive component in the vehicle and its condition cannot be judged visually, obtaining a dealer battery health report before purchase is strongly recommended.', DEALER),

  /* body */
  D('body', 'paint', 'marginal', 'Paint — Repainted Panel Detected',
    'Paint depth readings and/or visual indicators showed that a panel has been refinished. Refinishing accompanies collision repair, but also rust repair and vandalism repair. Asking the seller what was repaired and reviewing any history report is recommended.', SELLER),
  D('body', 'paint', 'minor', 'Paint — Clear Coat Failure',
    'The clear coat was peeling or failing on one or more panels. This is cosmetic but progresses, and repair means refinishing the panel. Repair as desired is recommended.', BODY),
  D('body', 'paint', 'minor', 'Paint — Chips and Scratches',
    'Chips and scratches were present in the finish consistent with normal use. Touching up chips is recommended to prevent rust from forming at the exposed metal.', DIY),
  D('body', 'panels', 'marginal', 'Panel Gaps — Uneven',
    'Panel gaps were uneven or inconsistent side to side, which indicates a panel has been replaced or realigned after an impact. Further evaluation of the repair quality is recommended.', BODY),
  D('body', 'rust', 'significant', 'Corrosion — Structural / Perforating',
    'Perforating corrosion was present in a structural area such as a rocker panel, frame rail, subframe mount, or suspension mounting point. Structural rust compromises crash performance and is expensive to repair properly. Evaluation by a body shop before purchase is strongly recommended.', BODY),
  D('body', 'rust', 'marginal', 'Corrosion — Surface Rust Present',
    'Surface rust was present on body panels and/or underbody components. Surface rust that has not perforated can be arrested if addressed. Treatment is recommended before it progresses.', BODY),
  D('body', 'frame', 'significant', 'Frame or Unibody Damage Present',
    'Evidence of frame or unibody damage was present, including kinked rails, repaired sections, or measurable misalignment. A structurally repaired vehicle may not perform as designed in a subsequent collision. Evaluation on a frame machine at a body shop is strongly recommended before purchase.', BODY),
  D('body', 'glassbody', 'minor', 'Door / Hood / Trunk — Does Not Latch or Align',
    'A door, hood, or trunk lid did not latch properly or was misaligned. Adjustment is recommended, and misalignment can also be an indicator of past repair.', BODY),
  D('body', 'flood', 'significant', 'Flood Damage Indicators Present',
    'Indicators consistent with flood exposure were present — silt in recesses, water lines, corrosion on interior fasteners or under carpet, or a musty odour. Flood vehicles suffer progressive electrical failures for the rest of their lives. Do not purchase without a full evaluation and a title history check.', SELLER),
  D('body', 'trim', 'minor', 'Exterior Trim — Damaged or Missing',
    'Exterior trim was damaged, faded, or missing. Replacement as desired is recommended.', BODY),

  /* glass */
  D('glass', 'windshield', 'marginal', 'Windshield — Crack Present',
    'A crack was present in the windshield. Cracks spread with temperature change and vibration, a cracked windshield fails inspection in most jurisdictions, and on vehicles with camera-based driver aids replacement requires recalibration. Replacement is recommended.', GLASS),
  D('glass', 'windshield', 'minor', 'Windshield — Chips Present',
    'Chips were present in the windshield. Repairing a chip early is inexpensive and prevents it from becoming a crack. Repair is recommended.', GLASS),
  D('glass', 'otherglass', 'minor', 'Glass — Aftermarket Replacement Noted',
    'FYI — One or more glass panels were aftermarket replacements rather than original. This is common and not a defect in itself, but replaced glass can indicate a break-in or an impact. Asking the seller is recommended.', SELLER),
  D('glass', 'headlights', 'marginal', 'Headlight — Inoperative',
    'SFTY — A headlight did not operate on one or both beams. Repair is recommended for safety and to pass inspection.', DIY),
  D('glass', 'headlights', 'minor', 'Headlight Lens — Hazed / Yellowed',
    'The headlight lenses were hazed or yellowed, which substantially reduces light output at night. Restoration or replacement is recommended.', DIY),
  D('glass', 'otherlights', 'marginal', 'Exterior Lamp — Inoperative',
    'SFTY — An exterior lamp — brake light, turn signal, reverse or plate lamp — did not operate. Repair is recommended for safety and to pass inspection.', DIY),
  D('glass', 'otherlights', 'minor', 'Lamp Housing — Moisture Intrusion',
    'Moisture was present inside a lamp housing, indicating a failed seal. This corrodes the contacts over time. Repair or replacement is recommended.', DIY),
  D('glass', 'wipers', 'minor', 'Wiper Blades — Worn',
    'The wiper blades were worn, streaking, or torn. Replacement is recommended as routine maintenance.', DIY),
  D('glass', 'wipers', 'minor', 'Washer System — Inoperative',
    'The windshield washer system did not spray. Causes include an empty reservoir, a failed pump, or blocked nozzles. Repair is recommended.', DIY),
  D('glass', 'mirrors', 'minor', 'Mirror — Damaged or Inoperative',
    'A mirror was damaged, loose, or its adjustment was inoperative. Repair as desired is recommended.', DIY),

  /* interior */
  D('interior', 'dash', 'significant', 'Check Engine Light Illuminated',
    'The check engine light was illuminated with active fault codes stored. An illuminated check engine light means the engine management system has detected a fault, the vehicle will not pass an emissions test, and the cause can be anything from a loose fuel cap to a failing catalytic converter. Full diagnosis before purchase is required.', MECH),
  D('interior', 'dash', 'marginal', 'Warning Light Illuminated',
    'A warning light was illuminated on the instrument cluster. Diagnosis of the underlying fault is recommended before purchase.', MECH),
  D('interior', 'dash', 'significant', 'Warning Lights Do Not Illuminate on Startup',
    'One or more warning lamps did not illuminate during the bulb check at startup, meaning the lamp has been removed or disabled. This is a common way of concealing an airbag, ABS, or engine fault from a buyer. Full diagnosis is required before purchase.', MECH),
  D('interior', 'airbags', 'significant', 'Airbag / SRS Warning Light Illuminated',
    'SFTY — The airbag warning light was illuminated, meaning the supplemental restraint system has disabled itself and the airbags may not deploy in a collision. Diagnosis and repair before the vehicle is used is required.', DEALER),
  D('interior', 'airbags', 'significant', 'Airbag — Evidence of Prior Deployment',
    'Evidence of prior airbag deployment and replacement was present. Deployment means a significant impact, and improperly replaced or counterfeit airbag modules do not protect occupants. Verification that the system was properly restored with genuine components is required.', DEALER),
  D('interior', 'belts', 'significant', 'Seat Belt — Damaged or Will Not Retract',
    'SFTY — A seat belt was cut, frayed, or would not retract or latch properly. Belts are the primary restraint. Replacement of the affected assembly is required.', DEALER),
  D('interior', 'seats', 'minor', 'Upholstery — Wear or Damage',
    'Wear, staining, or damage was present to the upholstery. Repair or replacement as desired is recommended.', BODY),
  D('interior', 'infotainment', 'minor', 'Infotainment — Fault or Inoperative Function',
    'The infotainment system had an inoperative function or displayed a fault. Repair as desired is recommended; note that factory head unit replacement is expensive on modern vehicles.', DEALER),
  D('interior', 'windows', 'minor', 'Window or Lock — Inoperative',
    'A power window or door lock did not operate at normal controls. Repair as desired is recommended.', ELEC),
  D('interior', 'odours', 'marginal', 'Odour — Musty / Water Intrusion Suspected',
    'A musty odour was present in the cabin, and/or damp carpet or headliner was found. Water intrusion through a sunroof drain, cowl seal, or door membrane causes corrosion, electrical faults, and mould. Locating and correcting the source is recommended.', MECH),
  D('interior', 'odours', 'minor', 'Odour — Smoke Present',
    'FYI — A cigarette smoke odour was present in the cabin. This is difficult to remove entirely and affects resale value.', MONITOR),
  D('interior', 'keys', 'minor', 'Only One Key Provided',
    'Only one key or remote was provided. Replacement keys for modern vehicles require programming and are expensive. Negotiating a second key as part of the sale is recommended.', SELLER),

  /* hvac */
  D('hvac', 'ac', 'marginal', 'Air Conditioning — Not Cooling',
    'The air conditioning did not produce cold air. Causes range from a low refrigerant charge caused by a leak, through a failed compressor, to an electrical fault. Diagnosis is recommended, and a system that is low is low because it leaks.', MECH),
  D('hvac', 'ac', 'minor', 'Air Conditioning — Weak Cooling',
    'The air conditioning cooled, but vent temperature was higher than expected for the ambient conditions. Performance testing with a leak check is recommended.', MECH),
  D('hvac', 'heat', 'marginal', 'Heater — Not Producing Heat',
    'The heater did not produce heat. Causes include low coolant, a stuck thermostat, a blocked heater core, or a blend door fault. Diagnosis is recommended — and a heater core leak also puts coolant into the cabin carpet.', MECH),
  D('hvac', 'blower', 'marginal', 'Blower Motor — Inoperative on Some Speeds',
    'The blower motor did not operate on all speeds, typically a failed resistor pack. Repair is recommended.', MECH),
  D('hvac', 'cabinfilter', 'minor', 'Cabin Air Filter — Dirty',
    'The cabin air filter was dirty. Replacement is recommended as routine maintenance.', DIY),
  D('hvac', 'controls', 'minor', 'Climate Control — Function Inoperative',
    'A climate control function did not respond at normal controls. Diagnosis and repair as desired is recommended.', MECH),

  /* undercarriage */
  D('undercarriage', 'leaks', 'marginal', 'Fluid Leak — Active Drip Present',
    'An active leak was dripping from the vehicle. The fluid, its source, and its rate should be identified and the leak corrected. Any active leak of oil, coolant, brake fluid, or fuel is worth resolving before purchase.', MECH),
  D('undercarriage', 'leaks', 'minor', 'Fluid Seepage — Monitoring Recommended',
    'Seepage was present without a drip forming. Seepage on an older vehicle is common. Monitoring the area and checking fluid levels regularly is recommended.', MONITOR),
  D('undercarriage', 'underrust', 'marginal', 'Undercarriage — Heavy Corrosion',
    'Heavy corrosion was present on underbody components, consistent with a vehicle from a region that salts its roads. Beyond the corrosion itself, seized fasteners make every future repair on this vehicle longer and more expensive. Evaluation is recommended.', MECH),
  D('undercarriage', 'underrust', 'minor', 'Undercoating Applied — Conceals Underbody',
    'LMT — Undercoating or a similar coating had been applied to the underbody, which limits visual evaluation of the metal beneath it. Coating is sometimes preventative and sometimes applied to conceal corrosion. The condition of any concealed metal is excluded from this inspection.', MONITOR),
  D('undercarriage', 'skid', 'marginal', 'Impact Damage to Underbody',
    'Impact damage was present to underbody components — a crushed pan, scraped subframe, or damaged shield — consistent with the vehicle having struck something. Evaluation of the affected components is recommended.', MECH),
  D('undercarriage', 'fuel', 'significant', 'Fuel Leak or Fuel Odour Present',
    'SFTY — A fuel leak or a strong fuel odour was present. A fuel leak is a fire hazard. The vehicle should not be driven until the source is identified and repaired.', MECH),
  D('undercarriage', 'mounts', 'marginal', 'Subframe Mount — Corroded or Damaged',
    'A subframe mount was corroded or damaged. These mounts carry the suspension loads into the body. Evaluation with repair as needed is recommended.', BODY),
];

function locations(p) {
  const out = [
    'Front Left (Driver Front)', 'Front Right (Passenger Front)',
    'Rear Left', 'Rear Right', 'Front Axle', 'Rear Axle',
    'Engine Bay', 'Undercarriage — Front', 'Undercarriage — Rear',
    'Driver Side', 'Passenger Side', 'Front of Vehicle', 'Rear of Vehicle',
    'Cabin — Front', 'Cabin — Rear', 'Trunk / Cargo Area', 'Roof',
  ];
  if (p.body === 'Pickup Truck') out.push('Bed', 'Tailgate');
  out.push('Throughout the Vehicle', 'Multiple Locations');
  return out;
}

export default {
  id: 'vehicle',
  name: 'Used Car',
  icon: '🚗',
  tagline: 'Pre-purchase vehicle inspection',
  blurb: 'The inspection you wish you had paid for before buying it. Sixteen sections from the '
    + 'road test to the undercarriage, with the limitations spelled out.',
  docTitle: 'Pre-Purchase Vehicle Inspection Report',
  subjectLabel: 'Vehicle',
  subjectLine: (p) => `${p.year || ''} ${p.make || ''} ${p.model || ''}`.trim(),
  subjectSub: (p) => `VIN ${p.vin} · ${Number(p.mileage || 0).toLocaleString('en-US')} miles · `
    + `${p.engine}, ${p.transmission} · ${p.titleStatus} title`,
  clientLabel: 'Client',
  severities: {
    significant: {
      label: 'Major — Unsafe or Major Expense',
      short: 'Major',
      blurb: 'Unsafe to drive, or a repair large enough to change what the vehicle is worth. '
        + 'Resolve it before money changes hands.',
    },
    marginal: {
      label: 'Needs Repair',
      short: 'Repair',
      blurb: 'A fault or a worn component that needs attention. The vehicle may drive fine today; '
        + 'this is what it will cost you shortly. Most findings land here.',
    },
    minor: {
      label: 'Advisory / Maintenance',
      short: 'Advisory',
      blurb: 'Routine maintenance, cosmetic wear, and things worth knowing but not worth '
        + 'renegotiating over.',
    },
  },
  costBands: { significant: [700, 4500], marginal: [150, 900], minor: [0, 200] },
  costNote: 'Parts and labour vary widely by make and region; a shop quote governs.',
  standardsTitle: 'Scope and Limitations',
  standards: () => 'This was a visual and functional inspection of a used vehicle at a single point '
    + 'in time. Nothing was disassembled and no component was tested to destruction. This report is '
    + 'not a warranty, a guarantee of future reliability, or an appraisal of value, and it is '
    + 'provided for the exclusive use of the client named above. A vehicle that inspects well can '
    + 'still develop a fault the week after it is purchased.',
  intake: INTAKE,
  sections: SECTIONS,
  defects: DEFECTS,
  locations,
  sample: {
    year: '2016', make: 'Toyota', model: '4Runner SR5', vin: 'JTEBU5JR4G5123456',
    mileage: '128400', color: 'Magnetic Grey', client: 'Liam Powell',
    inspector: 'A. Inspector', company: 'Newtown Road Automotive',
    body: 'SUV / Crossover', doors: 4, seats: 5, fuel: 'Gasoline', engine: 'V6',
    transmission: 'Automatic', drivetrain: 'Part-Time 4WD', titleStatus: 'Clean',
    owners: '2', records: 'Partial', accidents: 'One Reported',
    inspectionType: 'Pre-purchase', lift: 'Yes, full lift', roadTest: 'Yes, mixed roads and highway',
    scanTool: 'Yes', codes: 'None', coldStart: 'Yes', paintMeter: 'Yes',
    weather: 'Clear, Dry', location: 'Shop / Lift Bay',
  },
};
