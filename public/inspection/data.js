/* Inspection Simulator — static content library.
 *
 * Everything the report can say is in here so the inspector never has to type a
 * paragraph: sections carry their standing narrative, items carry the defects,
 * and each defect carries its own write-up and recommendation. */

export const SEVERITIES = [
  {
    id: 'significant',
    label: 'Significant Defect',
    short: 'Significant',
    color: '#c0392b',
    blurb: 'Not functional, a serious safety concern, and/or a major expense to correct. '
      + 'Further evaluation and repair by a qualified contractor before the end of the '
      + 'contingency period.',
  },
  {
    id: 'marginal',
    label: 'Marginal Defect',
    short: 'Marginal',
    color: '#d97706',
    blurb: 'A safety hazard, or a functional or installation-related deficiency. It may have '
      + 'worked at the time of inspection, but the defect can lead to further problems. Most '
      + 'defects land here.',
  },
  {
    id: 'minor',
    label: 'Minor Defect, Maintenance Item, or FYI Item',
    short: 'Minor / FYI',
    color: '#2563eb',
    blurb: 'Minor repairs that improve function, recurring maintenance, observations, and '
      + 'recommended upgrades.',
  },
];

export const SEVERITY_BY_ID = Object.fromEntries(SEVERITIES.map((s) => [s.id, s]));

/* ---------------------------------------------------------------- intake */

export const HOUSE_TYPES = [
  'Single Family, Detached',
  'Single Family, Attached (Townhouse)',
  'Semi-Detached / Duplex',
  'Condominium Unit',
  'Multi-Family (2-4 Units)',
  'Manufactured / Modular',
];

export const FOUNDATION_TYPES = [
  'Full Basement, Unfinished',
  'Partially Finished Basement',
  'Finished Basement',
  'Crawl Space',
  'Slab on Grade',
  'Basement and Crawl Space',
];

export const CLADDING_TYPES = [
  'Vinyl Siding', 'Fiber Cement', 'Brick Veneer', 'Wood Siding',
  'Aluminum Siding', 'Stucco', 'Stone Veneer', 'Composite / Engineered Wood',
];

export const ROOF_COVERINGS = [
  'Architectural Composition Shingles', '3-Tab Composition Shingles', 'Metal Panel',
  'Slate', 'Clay / Concrete Tile', 'Flat / Modified Bitumen', 'Wood Shake',
];

export const HEATING_TYPES = [
  'Gas Forced Air Furnace', 'Electric Air Handler / Heat Pump', 'Oil Forced Air Furnace',
  'Hot Water Boiler (Radiators)', 'Electric Baseboard', 'Ductless Mini-Split',
];

export const WATER_HEATER_TYPES = ['Gas', 'Electric', 'Tankless Gas', 'Tankless Electric', 'Heat Pump / Hybrid'];

export const SERVICE_AMPS = ['60amps 120/240VAC', '100amps 120/240VAC', '150amps 120/240VAC', '200amps 120/240VAC', '400amps 120/240VAC'];

export const WATER_PIPE_TYPES = ['Copper', 'CPVC', 'PEX', 'Galvanized Steel', 'Polybutylene', 'Copper and PEX'];

export const DWV_TYPES = ['PVC', 'ABS', 'Cast Iron', 'Cast Iron and PVC', 'Galvanized and PVC'];

export const OCCUPANCY = ['Vacant', 'Occupied, Furnished', 'Occupied, Partially Furnished'];

export const INSPECTION_TYPES = ['Pre-purchase', 'Pre-listing', 'New Construction', '11-Month Warranty', 'Re-Inspection'];

export const WEATHER = ['Clear, Dry', 'Overcast, Dry', 'Light Rain', 'Heavy Rain', 'Snow / Ice Present'];

export const ATTENDANCE = ["Inspector Only", "Inspector, Client(s)", "Inspector, Client(s), Buyer's Agent", "Inspector, Client(s), Buyer's Agent, Seller's Agent"];

export const ROOF_METHODS = ['Walked the Roof Surface', 'Aerial Drone', 'From Ladder at Eaves', 'From Ground Level with Binoculars'];

export const UTILITY_LOCATIONS = ['Basement', 'Crawl Space', 'Garage', 'Exterior', 'Utility Closet', 'Kitchen Cabinet', 'On Interior Meter', 'Attic'];

/* The intake form. Every answer here either fills an Information block in the
 * report or generates the list of rooms the inspector can attach a defect to. */
export const INTAKE = [
  {
    id: 'property',
    title: 'The Property',
    hint: 'The only part you actually have to type.',
    fields: [
      { id: 'address', label: 'Street Address', type: 'text', placeholder: '8329 Newtown Rd', required: true },
      { id: 'city', label: 'City', type: 'text', placeholder: 'Pikesville', required: true },
      { id: 'state', label: 'State', type: 'text', placeholder: 'MD', required: true, width: 'short' },
      { id: 'zip', label: 'ZIP', type: 'text', placeholder: '21208', required: true, width: 'short' },
      { id: 'client', label: 'Client Name', type: 'text', placeholder: 'Liam Powell', required: true },
      { id: 'inspector', label: 'Inspector Name', type: 'text', placeholder: 'Your name', required: true },
      { id: 'company', label: 'Company', type: 'text', placeholder: 'Chesapeake Inspection Associates', required: true },
      { id: 'date', label: 'Inspection Date', type: 'date', required: true },
    ],
  },
  {
    id: 'structure',
    title: 'The Structure',
    hint: 'Click through it — nothing here needs a sentence.',
    fields: [
      { id: 'yearBuilt', label: 'Year Built', type: 'number', placeholder: '1966', required: true, width: 'short' },
      { id: 'houseType', label: 'Type of Building', type: 'choice', options: HOUSE_TYPES },
      { id: 'floors', label: 'Floors Above Grade', type: 'choice', options: ['1', '1.5', '2', '2.5', '3'] },
      { id: 'foundation', label: 'Foundation / Below Grade', type: 'choice', options: FOUNDATION_TYPES },
      { id: 'sqft', label: 'Approx. Square Footage', type: 'choice', options: ['Under 1,000', '1,000 - 1,500', '1,500 - 2,000', '2,000 - 3,000', '3,000 - 4,000', 'Over 4,000'] },
      { id: 'bedrooms', label: 'Bedrooms', type: 'counter', min: 0, max: 8, value: 3 },
      { id: 'fullBaths', label: 'Full Bathrooms', type: 'counter', min: 0, max: 6, value: 2 },
      { id: 'halfBaths', label: 'Half Bathrooms', type: 'counter', min: 0, max: 4, value: 1 },
      { id: 'livingRooms', label: 'Living / Family Rooms', type: 'counter', min: 0, max: 4, value: 2 },
      { id: 'diningRooms', label: 'Dining Rooms', type: 'counter', min: 0, max: 3, value: 1 },
      { id: 'kitchens', label: 'Kitchens', type: 'counter', min: 1, max: 3, value: 1 },
      { id: 'garageBays', label: 'Garage Bays (0 = none)', type: 'counter', min: 0, max: 4, value: 0 },
      { id: 'attic', label: 'Attic', type: 'choice', options: ['Scuttle Hole Access', 'Pull-Down Stairs', 'Walk-Up Stairs', 'No Accessible Attic'] },
      { id: 'laundry', label: 'Laundry Location', type: 'choice', options: ['Basement', 'Main Level', 'Upper Level', 'Garage', 'Kitchen Area', 'Not Present'] },
    ],
  },
  {
    id: 'systems',
    title: 'The Systems',
    hint: 'These fill in the Information blocks for eight sections at once.',
    fields: [
      { id: 'cladding', label: 'Wall Cladding', type: 'choice', options: CLADDING_TYPES },
      { id: 'roofCovering', label: 'Roof Covering', type: 'choice', options: ROOF_COVERINGS },
      { id: 'roofMethod', label: 'Roof Inspection Method', type: 'choice', options: ROOF_METHODS },
      { id: 'heating', label: 'Heating / Cooling', type: 'choice', options: HEATING_TYPES },
      { id: 'hvacYear', label: 'HVAC Manufacture Year', type: 'number', placeholder: '1997', width: 'short' },
      { id: 'waterHeater', label: 'Water Heater', type: 'choice', options: WATER_HEATER_TYPES },
      { id: 'whYear', label: 'Water Heater Manufacture Year', type: 'number', placeholder: '1992', width: 'short' },
      { id: 'whCapacity', label: 'Water Heater Capacity', type: 'choice', options: ['30 Gallons', '40 Gallons', '50 Gallons', '75 Gallons', 'Tankless'] },
      { id: 'service', label: 'Electrical Service', type: 'choice', options: SERVICE_AMPS },
      { id: 'serviceEntrance', label: 'Service Entrance', type: 'choice', options: ['Overhead Service Drop', 'Underground Service Lateral'] },
      { id: 'waterPipes', label: 'Water Distribution Pipes', type: 'choice', options: WATER_PIPE_TYPES },
      { id: 'dwv', label: 'Drain, Waste & Vent Pipes', type: 'choice', options: DWV_TYPES },
      { id: 'fuel', label: 'Fuel Source', type: 'choice', options: ['Natural Gas Meter', 'LP Tank', 'Oil Tank', 'All Electric'] },
      { id: 'sewer', label: 'Waste Disposal', type: 'choice', options: ['Public Sewer', 'Septic System'] },
      { id: 'water', label: 'Water Supply', type: 'choice', options: ['Public Water', 'Private Well'] },
    ],
  },
  {
    id: 'conditions',
    title: 'Conditions & Logistics',
    hint: 'Day-of details for the Inspection Information section.',
    fields: [
      { id: 'inspectionType', label: 'Inspection Type', type: 'choice', options: INSPECTION_TYPES },
      { id: 'attendance', label: 'In Attendance', type: 'choice', options: ATTENDANCE },
      { id: 'occupancy', label: 'Occupancy', type: 'choice', options: OCCUPANCY },
      { id: 'weather', label: 'Weather Conditions', type: 'choice', options: WEATHER },
      { id: 'temp', label: 'Temperature', type: 'choice', options: ['Below 40 Degrees', '40-50 Degrees', '50-60 Degrees', '60-70 Degrees', '70-80 Degrees', 'Above 80 Degrees'] },
      { id: 'rain48', label: 'Precipitation in the Last 48 hrs?', type: 'choice', options: ['No', 'Yes'] },
      { id: 'ground', label: 'Ground Condition', type: 'choice', options: ['Dry', 'Damp', 'Saturated', 'Snow Covered'] },
      { id: 'standards', label: 'Applicable Standards of Practice', type: 'choice', options: ['State of Maryland, InterNACHI', 'State of Tennessee, InterNACHI', 'InterNACHI', 'ASHI'] },
      { id: 'mainDisconnect', label: 'Main Breaker / Service Disconnect Location', type: 'choice', options: UTILITY_LOCATIONS },
      { id: 'waterShutoff', label: 'Water Shutoff Valve Location', type: 'choice', options: UTILITY_LOCATIONS },
      { id: 'fuelShutoff', label: 'Main Fuel Shutoff Location', type: 'choice', options: [...UTILITY_LOCATIONS, 'Not Applicable'] },
    ],
  },
];

/* ------------------------------------------------------------- narrative */

const LIMITATION_BLOCKS = [
  {
    title: 'Inspection Overview',
    text: 'This inspection was performed in substantial compliance with the applicable Standards of '
      + 'Practice. The readily accessible, visually observable, installed systems and components of '
      + 'the structure were inspected. Where a system or component designated in the Standards was '
      + 'present but not inspected, the reason is stated. This inspection is neither technically '
      + 'exhaustive nor quantitative. This report contains observations of those systems and '
      + 'components that were not functioning properly, were significantly deficient, or were unsafe '
      + 'in the inspector’s professional judgment. Every item designated for repair, replacement, '
      + 'maintenance, or further evaluation should be investigated by qualified tradespeople within '
      + 'the client’s contingency period to determine the total cost of the work and to learn of '
      + 'any additional problems that a visual-only inspection could not reveal.',
  },
  {
    title: 'Items Not Inspected and Other Limitations',
    text: 'EXCL — Some items are outside the scope of a home inspection, including but not limited '
      + 'to: fences and gates, pools and spas, outbuildings and detached structures, refrigerators, '
      + 'washers and dryers, storm doors and windows, screens, window AC units, gas furnace heat '
      + 'exchangers, central vacuum systems, water softeners, alarm and intercom systems, and any '
      + 'item that is not a permanently attached component of the home. Subterranean systems are '
      + 'excluded, including sewer lines, septic tanks, water delivery systems, and underground fuel '
      + 'storage tanks. Water and gas shutoff valves are not operated under any circumstances, and '
      + 'any component or appliance found unplugged or shut off is not energized for evaluation.',
  },
  {
    title: 'Recommended Contractors Information',
    text: 'It is strongly recommended that licensed professionals perform the repairs or '
      + 'replacements referenced in this report, and that copies of their invoices be retained for '
      + 'warranty purposes. The term "qualified professional" refers to an individual or company '
      + 'licensed or certified in the field of concern. Contractors performing invasive evaluations '
      + 'may discover additional problems that were not visible at the time of inspection, and their '
      + 'determination as to cause and the best method of repair supersedes the information in this '
      + 'report.',
  },
  {
    title: 'Inaccessible Areas',
    text: 'LMT — References may be made in this report to areas or items that were inaccessible or '
      + 'only partly accessible. No representation can be made regarding conditions concealed in '
      + 'those areas. With access and an opportunity for inspection, reportable conditions or hidden '
      + 'damage may be found. Those conditions are excluded from this inspection.',
  },
  {
    title: 'Repairs Versus Upgrades',
    text: 'This home was inspected against today’s safety and building standards. Some '
      + 'recommendations in this report may not have been required when the home was built and could '
      + 'be considered non-conforming rather than defective. Building standards change for the '
      + 'safety and benefit of occupants, and any repair or upgrade mentioned here should be '
      + 'considered for safety, performance, and the longevity of the home.',
  },
  {
    title: 'Comment Key — Definitions',
    text: 'Deficiencies are placed into three categories. Significant Defects are items that were '
      + 'not functional, represent a serious safety concern, and/or may require a major expense to '
      + 'correct. Marginal Defects are items with a safety hazard or a functional or installation '
      + 'deficiency; they may have been functional at the time of inspection, but the defect may lead '
      + 'to further problems. Minor Defects / Maintenance Items / FYI covers minor repairs, recurring '
      + 'maintenance, observations, and recommended upgrades. Other designations used are LMT '
      + '(limitation), EXCL (excluded), SFTY (safety concern), and AGED (at or near the end of typical '
      + 'service life). The recommendation in the text of each comment matters more than its '
      + 'categorization.',
  },
];

/* ------------------------------------------------------- report sections */

export const SECTIONS = [
  {
    id: 'info',
    title: 'Inspection Information',
    items: [],
    info: (p) => [
      ['In Attendance', p.attendance],
      ['Inspection Type', p.inspectionType],
      ['Type of Building', p.houseType],
      ['Construction Year', p.yearBuilt],
      ['Occupancy', p.occupancy],
      ['Weather Conditions', p.weather],
      ['Temperature at the Time of Inspection', p.temp],
      ['Precipitation in the Last 48 hrs?', p.rain48],
      ['Ground Condition', p.ground],
      ['Applicable Standards of Practice', p.standards],
    ],
    narrative: (p) => [
      {
        title: 'Structure Orientation',
        text: 'For the sake of this inspection the front of the structure is considered the elevation '
          + 'facing the street. References to the left or right of the structure should be construed '
          + 'as standing in the front yard, viewing the front of the structure.',
      },
      ...LIMITATION_BLOCKS,
    ],
  },
  {
    id: 'utilities',
    title: 'Utility Shutoff Locations',
    items: [],
    info: (p) => [
      ['Main Breaker / Service Disconnect Location', p.mainDisconnect],
      ['Water Shutoff Valve Location', p.waterShutoff],
      ['Main Fuel Shutoff Valve Location', p.fuelShutoff],
    ],
    narrative: () => [
      {
        title: 'Electrical Service Disconnect Information',
        text: 'The referenced electrical service disconnect will shut off all power to the home in an '
          + 'emergency, or for servicing.',
      },
      {
        title: 'Water Shutoff Valve Information',
        text: 'The referenced water shutoff valve will shut off the water supply to the home in an '
          + 'emergency, or for servicing. This valve was not operated during the inspection.',
      },
      {
        title: 'Fuel Shutoff Valve Information',
        text: 'The referenced main fuel shutoff valve will shut off the fuel supply to the home in an '
          + 'emergency, or for servicing. This valve was not operated during the inspection.',
      },
    ],
  },
  {
    id: 'grounds',
    title: 'Grounds',
    items: [
      { id: 'driveway', name: 'Driveway and Walkway Condition' },
      { id: 'grading', name: 'Grading / Lot Drainage' },
      { id: 'vegetation', name: 'Vegetation Observations' },
      { id: 'porch', name: 'Porch(es), Steps, and Railings' },
      { id: 'spigots', name: 'Exterior Spigots' },
      { id: 'retaining', name: 'Retaining Walls / Hardscape' },
      { id: 'meter', name: 'Gas Meter / LP Tank / Fuel Source' },
    ],
    info: (p) => [
      ['Driveway Material', 'Concrete'],
      ['Walkway Material', 'Concrete'],
      ['Fuel Source', p.fuel],
      ['Grading/Drainage Conditions', 'Satisfactory Grading'],
    ],
    narrative: () => [
      {
        title: 'Driveway / Walkway Information',
        text: 'The driveway and walkways were inspected to determine their effect on the structure of '
          + 'the home. Visible deficiencies such as cracking, displacement, or other damage are '
          + 'reported as a courtesy. No significant deficiencies were visibly present at the time of '
          + 'inspection unless otherwise noted in this report.',
      },
      {
        title: 'Grading / Drainage Overview',
        text: 'The grounds in contact with the structure were inspected to determine that they were '
          + 'sloped to drain rainwater away from the structure. Soil is recommended to fall roughly '
          + 'six inches over the first ten feet away from the foundation. Where that grade cannot be '
          + 'achieved, swales or drains should be used to divert runoff. No significant grading '
          + 'deficiencies were present unless otherwise noted in this report.',
      },
      {
        title: 'Grading Limitations',
        text: 'LMT — Grading and drainage performance is limited to the conditions existing at the '
          + 'time of inspection only. Heavy rain or other weather may reveal issues that were not '
          + 'visible or foreseeable. Leaks in gutters and downspouts are effectively impossible to '
          + 'detect during dry weather.',
      },
      {
        title: 'Vegetation Information',
        text: 'Vegetation was inspected around the home to confirm adequate clearance from the '
          + 'structure. No significant deficiencies were observed unless otherwise noted in this '
          + 'report.',
      },
      {
        title: 'Spigot(s) Information',
        text: 'The exterior spigots were inspected by operating them where weather permitted, looking '
          + 'for leaks, their attachment to the home, and the presence of anti-siphon devices. No '
          + 'deficiencies were visibly observed unless otherwise noted in this report.',
      },
    ],
  },
  {
    id: 'exterior',
    title: 'Exterior',
    items: [
      { id: 'cladding', name: 'Walls / Cladding' },
      { id: 'trim', name: 'Trim and Wood Components' },
      { id: 'windows', name: 'Window Exteriors' },
      { id: 'doors', name: 'Exterior Doors' },
      { id: 'eaves', name: 'Eaves / Overhangs / Fascia' },
      { id: 'sealant', name: 'Sealant / Paint Overall' },
      { id: 'flashing', name: 'Wall Flashings' },
      { id: 'deck', name: 'Deck / Porch Structure' },
    ],
    info: (p) => [
      ['Cladding Material', p.cladding],
      ['Wall Construction Type', 'Wood Framed'],
      ['Wall Crack(s) Present?', 'Not at Visible Portions'],
      ['Soffit & Fascia Material', 'Aluminum Fascia'],
    ],
    narrative: (p) => [
      {
        title: 'Representative Number Inspected',
        text: 'The Standards of Practice require that a representative sample of exterior components '
          + 'be inspected on each side of the home where multiple pieces make up an item. Height from '
          + 'the ground, vegetation, or other factors may prevent full accessibility of some items.',
      },
      {
        title: 'Wall and Cladding Information',
        text: `The walls and wall cladding (${p.cladding}) were inspected for significant damage, `
          + 'proper flashing, and potential water entry points. No reportable deficiencies were '
          + 'visibly present at the time of inspection unless otherwise noted in this report.',
      },
      {
        title: 'Probing of Wood',
        text: 'Wooden trim, siding, and other wood components were probed where water damage was '
          + 'suspected. Any photograph showing a probe inserted into wood represents water damage or '
          + 'rot to some extent. Hidden damage is always a possibility at these areas.',
      },
      {
        title: 'Windows Information',
        text: 'The exterior components of the windows — trim, flashing, and clearance from grade '
          + '— were inspected for damage and improper installation. No reportable deficiencies '
          + 'were visibly present unless otherwise noted in this report.',
      },
      {
        title: 'Window Screens Information',
        text: 'EXCL — Window screens are not required to be reported on and their presence and '
          + 'condition are excluded from this inspection.',
      },
      {
        title: 'Soffit / Fascia Information',
        text: 'The soffit and fascia were inspected at visible portions for water damage or other '
          + 'significant defects. No reportable conditions were visibly present unless otherwise noted '
          + 'in this report.',
      },
      {
        title: 'Handleset Information',
        text: 'LMT — Deadbolts and door handles are not inspected for functionality with keys, as '
          + 're-keying is recommended for any home purchase. They are reported on only with respect to '
          + 'misalignment preventing latching or locking.',
      },
    ],
  },
  {
    id: 'interior',
    title: 'Interior Areas',
    items: [
      { id: 'windows', name: 'Windows' },
      { id: 'doors', name: 'Interior Doors' },
      { id: 'closets', name: 'Closets' },
      { id: 'walls', name: 'Wall Condition' },
      { id: 'ceilings', name: 'Ceiling Condition' },
      { id: 'floors', name: 'Floor Condition' },
      { id: 'stairs', name: 'Stairs and Railings' },
      { id: 'fireplace', name: 'Fireplace' },
      { id: 'garage', name: 'Garage / Vehicle Door' },
    ],
    info: (p) => [
      ['Window Glazing', Number(p.yearBuilt) < 1980 ? 'Single Pane, Some Double Pane' : 'Double Pane'],
      ['Bedroom Count', String(p.bedrooms)],
      ['Moisture Stains Present on Ceilings', 'Not at Visible Portions'],
    ],
    narrative: () => [
      {
        title: 'Bedroom Locations',
        text: 'Bedrooms are numbered starting with the Master. After walking out of the master '
          + 'bedroom, Bedroom 2 is the first bedroom encountered, Bedroom 3 the next, and so on.',
      },
      {
        title: 'Windows Information',
        text: 'A representative number of windows were operated and inspected for damage, broken '
          + 'glass, and failed seals. Personal belongings may block access to some windows. No '
          + 'reportable deficiencies were present unless otherwise noted in this report.',
      },
      {
        title: 'Glass Seal Failure Limitations',
        text: 'LMT — Reporting on double pane glass seal failure lies beyond the scope of a home '
          + 'inspection, as glass may show no sign of seal failure at the time of inspection and '
          + 'become visible later under different conditions. Any units noted should not be relied '
          + 'upon as a complete listing of affected units.',
      },
      {
        title: 'Surfaces Information',
        text: 'Visible portions of the interior wall, floor, and ceiling surfaces were inspected for '
          + 'indications of moisture intrusion, settlement, and other significant defects. Cosmetic '
          + 'and minor deficiencies are not typically reported on, and any listing of them should not '
          + 'be construed as all-inclusive.',
      },
      {
        title: 'Cracks / Movement Limitations',
        text: 'LMT — Cracks are reported on by their presence, location, and visual condition as '
          + 'existing at the time of inspection only. No professional opinion can be rendered as to a '
          + 'crack’s severity, cause, or recent activity. Only a structural engineer can render '
          + 'judgment on settlement and movement.',
      },
      {
        title: 'Interior Doors Information',
        text: 'A representative number of interior doors were operated to confirm they opened, closed, '
          + 'and latched without binding on jambs or flooring. No reportable conditions were present '
          + 'unless otherwise noted in this report.',
      },
    ],
  },
  {
    id: 'bathrooms',
    title: 'Bathroom(s)',
    items: [
      { id: 'ventilation', name: 'Ventilation' },
      { id: 'cabinets', name: 'Cabinets, Countertops' },
      { id: 'sinks', name: 'Sink(s)' },
      { id: 'undersink', name: 'Undersink Plumbing - Bathroom' },
      { id: 'tub', name: 'Bathtub(s)' },
      { id: 'shower', name: 'Shower(s) and Shower Walls' },
      { id: 'toilet', name: 'Toilet(s)' },
      { id: 'enclosure', name: 'Shower Doors / Enclosures' },
    ],
    info: (p) => [
      ['Full Bathrooms', String(p.fullBaths)],
      ['Half Bathrooms', String(p.halfBaths)],
      ['Ventilation Sources', 'Ventilation Fan(s), Window(s)'],
      ['Undersink Plumbing Visibly Obstructed?', 'No'],
    ],
    narrative: () => [
      {
        title: 'Tub and Shower Drain Information',
        text: 'FYI — Water was run through the tub and shower drains for an extended period and the '
          + 'areas beneath these drains were inspected for indications of leaks. What cannot be '
          + 'replicated is the effect of weight applied to these drains during use, which can strain '
          + 'gaskets and joints. Leaks occurring after the time of inspection are excluded.',
      },
      {
        title: 'Tub and Sink Overflow Limitations',
        text: 'LMT — Tub and sink overflows are not tested due to the high likelihood the gaskets '
          + 'will leak. It should be assumed these overflows are not watertight.',
      },
      {
        title: 'Sinks Information',
        text: 'The sinks were inspected by operating the faucet valves and checking for proper flow and '
          + 'drainage, looking for leaks, and operating the pop-ups. No reportable conditions were '
          + 'observed unless otherwise noted in this report.',
      },
      {
        title: 'Ventilation Information',
        text: 'Bathroom ventilation is reported on by its source. Ventilation fans were tested by '
          + 'operating the switch and listening for proper airflow. Although a window can substitute '
          + 'for a fan, a fan is still recommended because windows are not used in colder months.',
      },
      {
        title: 'Toilet(s) Information',
        text: 'The toilets were flushed to confirm adequate flushing and to determine that no leaks '
          + 'were present at the supply line or tank. No deficiencies were observed unless otherwise '
          + 'noted in this report.',
      },
    ],
  },
  {
    id: 'kitchen',
    title: 'Kitchen',
    items: [
      { id: 'cabinets', name: 'Cabinets, Countertops' },
      { id: 'sink', name: 'Sink(s) and Faucet' },
      { id: 'undersink', name: 'Undersink Plumbing - Kitchen' },
      { id: 'disposal', name: 'Disposal Unit' },
      { id: 'dishwasher', name: 'Dishwasher' },
      { id: 'range', name: 'Oven/Range' },
      { id: 'exhaust', name: 'Exhaust Fan' },
      { id: 'microwave', name: 'Microwave' },
      { id: 'receptacles', name: 'Kitchen Receptacles' },
    ],
    info: () => [
      ['Undersink Plumbing Visibly Obstructed?', 'No'],
      ['Exhaust Fan Type', 'Microwave Exterior Vented'],
      ['Oven/Range Energy Source', 'Electric'],
      ['Range Anti-tip Bracket Presence', 'No'],
    ],
    narrative: () => [
      {
        title: 'Countertop / Cabinets Information',
        text: 'The cabinets and countertops were inspected for significant damage and a representative '
          + 'number of doors and drawers were operated. No reportable conditions were present unless '
          + 'otherwise noted in this report.',
      },
      {
        title: 'Dishwasher Information',
        text: 'The dishwasher was operated through a wash cycle and was functional at the time of '
          + 'inspection. No leaks or standing water were present at the base of the unit at the '
          + 'completion of the cycle. Cleaning efficiency is not tested.',
      },
      {
        title: 'Oven / Range Information',
        text: 'All heating elements or burners were turned to high and the oven was placed into bake '
          + 'mode; heat was produced. Temperature calibration, self-clean, and other functions are not '
          + 'tested.',
      },
      {
        title: 'Disposal Information',
        text: 'The garbage disposal was activated at normal controls to confirm the motor ran, while '
          + 'looking for leaks, an exposed power cord, or heavy rust. The unit is not tested for its '
          + 'ability to grind food waste.',
      },
      {
        title: 'Microwave Information',
        text: 'The microwave was tested by initiating a cook cycle and the unit powered on. Efficiency '
          + 'and other functions are not tested.',
      },
    ],
  },
  {
    id: 'laundry',
    title: 'Laundry',
    items: [
      { id: 'plumbing', name: 'Visible Plumbing - Laundry' },
      { id: 'dryervent', name: 'Dryer Vent' },
      { id: 'electrical', name: 'Laundry Electrical' },
    ],
    info: (p) => [
      ['Laundry Location', p.laundry],
      ['Dryer Energy Source', p.fuel === 'All Electric' ? 'Electric' : 'Gas'],
      ['Dryer Vent Termination Point', 'Exterior'],
    ],
    narrative: () => [
      {
        title: 'Washer / Dryer Present',
        text: 'LMT — A washer and/or dryer was present and may block accessibility of receptacles, '
          + 'plumbing components, and wall and floor surfaces. These appliances are not moved and are '
          + 'not tested for functionality.',
      },
      {
        title: 'Plumbing Information',
        text: 'LMT — The washing machine supply valves and visible portions of the standpipe were '
          + 'visually examined for leaks, but were not operated due to the washer hoses being '
          + 'connected. No indications of deficiencies were present unless otherwise noted.',
      },
      {
        title: 'Dryer Vent Information',
        text: 'The dryer vent was inspected to confirm it terminated to the exterior and that no damage '
          + 'was present at visible portions. It is highly recommended to have the duct cleaned prior '
          + 'to use, as lint buildup is a common cause of home fires.',
      },
    ],
  },
  {
    id: 'hvac',
    title: 'Heating, Cooling',
    items: [
      { id: 'exterior', name: 'Exterior Unit(s)' },
      { id: 'interior', name: 'Interior Unit(s)' },
      { id: 'condensate', name: 'Condensate Drain Pipe' },
      { id: 'gaspipe', name: 'Gas Pipe(s) - HVAC' },
      { id: 'refrigerant', name: 'Refrigerant Lines' },
      { id: 'thermostat', name: 'Thermostat(s)' },
      { id: 'filter', name: 'Air Filter / Return Plenum' },
      { id: 'ductwork', name: 'Visible Ductwork' },
      { id: 'venting', name: 'Combustion Venting - HVAC' },
    ],
    info: (p) => [
      ['Interior Unit Energy Source and Distribution', p.heating],
      ['Interior Unit Location', p.foundation.includes('Basement') ? 'Basement' : 'Utility Closet'],
      ['Manufacture Year', String(p.hvacYear || 'Not Legible')],
      ['Heating Source Present In Each Room', 'Yes'],
      ['Cooling Source Present In Each Room', 'Yes'],
      ['Temperature Differential Cooling Mode', '15-20 Degrees'],
    ],
    narrative: (p) => [
      {
        title: 'HVAC Testing Information',
        text: 'The inspection of the HVAC system is limited to the response of the system at normal '
          + 'operating controls in both heating and cooling modes (weather permitting), a non-invasive '
          + 'visual observation of the equipment, and the removal of access panels made for removal by '
          + 'a homeowner without tools.',
      },
      {
        title: 'HVAC Servicing Information',
        text: 'FYI — Manufacturers and HVAC contractors recommend annual servicing. Failure to '
          + 'service the system annually affects life expectancy and efficiency. Service records '
          + 'should be requested from the seller; if none can be produced, servicing by an HVAC '
          + 'contractor is recommended prior to the end of the contingency period.',
      },
      ...(p.heating.includes('Gas') || p.heating.includes('Oil') ? [{
        title: 'Heat Exchanger Exclusion',
        text: 'EXCL — The heat exchanger is a welded assembly inside the furnace that keeps the '
          + 'products of combustion, including carbon monoxide, separated from the interior air. Heat '
          + 'exchangers are buried inside the equipment, are not visible, and are specifically excluded '
          + 'from a home inspection. Operable carbon monoxide alarms, annual servicing, and planning '
          + 'for replacement on a 15-20 year schedule are recommended.',
      }] : []),
      {
        title: 'Filter / Plenum Information',
        text: 'The return air grille, air filter, and return plenum were inspected at visible portions '
          + 'for gaps, dirty filters, or an accumulation of dust. Changing the filter every 30 days to '
          + '3 months depending on filter type is one of the most important maintenance items an owner '
          + 'can perform.',
      },
      {
        title: 'Ductwork Information',
        text: 'The ductwork was inspected at visible portions for damage, loose connections, and other '
          + 'significant defects. No reportable deficiencies were observed unless otherwise noted.',
      },
    ],
  },
  {
    id: 'waterheater',
    title: 'Water Heater',
    items: [
      { id: 'condition', name: 'Water Heater Condition' },
      { id: 'venting', name: 'Venting' },
      { id: 'gaspipe', name: 'Gas Pipe' },
      { id: 'tpr', name: 'TPR Valve' },
      { id: 'tprpipe', name: 'TPRV Discharge Pipe' },
      { id: 'pipes', name: 'Water Pipes - Water Heater' },
    ],
    info: (p) => [
      ['Energy Source', p.waterHeater],
      ['Capacity', p.whCapacity],
      ['Manufacture Year', String(p.whYear || 'Not Legible')],
      ['Location', p.foundation.includes('Basement') ? 'Basement' : 'Utility Closet'],
      ['Water Temperature', '100-110 Degrees'],
    ],
    narrative: () => [
      {
        title: 'Water Heater Information',
        text: 'The water heater was inspected by examining the overall condition of the unit, its power '
          + 'source, and its water piping, and by confirming that it produced hot water at the time of '
          + 'inspection. The typical life expectancy of a tank water heater is 13-15 years.',
      },
      {
        title: 'Water Temperature Information',
        text: 'FYI — The maximum recommended water temperature at faucets is 120 degrees due to the '
          + 'possibility of scalding. To limit the formation of bacteria in the tank, tank temperatures '
          + 'are recommended between 135-140 degrees. A tempering valve allows both; consult a licensed '
          + 'plumber regarding installation.',
      },
      {
        title: 'TPR Valve Information',
        text: 'A TPR valve was in place. These valves are not tested, because once tested they tend to '
          + 'develop a drip leak. The valve allows the water heater to expel water and pressure if the '
          + 'tank exceeds roughly 150psi or 210 degrees.',
      },
    ],
  },
  {
    id: 'plumbing',
    title: 'Plumbing',
    items: [
      { id: 'pressure', name: 'Water Pressure' },
      { id: 'waterpipes', name: 'Water Pipes' },
      { id: 'dwv', name: 'Drain, Waste, and Vent Pipes (DWV)' },
      { id: 'cleanout', name: 'Main Cleanout' },
      { id: 'sump', name: 'Sump / Ejector Pump' },
      { id: 'flow', name: 'Functional Flow' },
      { id: 'drainage', name: 'Functional Drainage' },
      { id: 'gaspipes', name: 'Gas Pipes' },
      { id: 'regulator', name: 'Pressure Regulator' },
    ],
    info: (p) => [
      ['Water Supply', p.water],
      ['Waste Disposal', p.sewer],
      ['Water Distribution Pipe Material (Visible Portions)', p.waterPipes],
      ['DWV Material Type (Visible Portions)', p.dwv],
      ['Water Pressure (Approx.)', '50-60psi'],
      ['Gas Pipe Material', 'Black Iron'],
      ['Functional Flow', 'Yes'],
    ],
    narrative: () => [
      {
        title: 'Shutoff Valves Operation',
        text: 'EXCL — Homes contain multiple water shutoff valves. These valves are not operated for '
          + 'any reason and their ability to shut off water is excluded from this inspection. Rarely '
          + 'used valves have internal components that become brittle with age and can leak once '
          + 'operated. Have the seller demonstrate the operation of any valve of concern.',
      },
      {
        title: 'Water Distribution Pipes Information',
        text: 'Visible portions of the water distribution pipes were inspected for leaks and other '
          + 'significant deficiencies. No reportable conditions were visually present unless otherwise '
          + 'noted in this report.',
      },
      {
        title: 'Drain, Waste, and Vent Pipes Information',
        text: 'Visible portions of the drain, waste, and vent pipes were inspected for leaks and other '
          + 'significant deficiencies. Sewer camera inspections are recommended for any home regardless '
          + 'of age, because the lateral between the home and the sewer main or septic tank is not '
          + 'visible and may contain damage, blockages, or sagging areas.',
      },
      {
        title: 'Functional Flow and Drainage',
        text: 'Water was run from multiple fixtures simultaneously to gauge that there was no '
          + 'significant reduction in flow, and water was run through all drains for an extended period '
          + 'to determine that functional drainage was occurring. Lived-in conditions cannot be '
          + 'replicated during an inspection.',
      },
    ],
  },
  {
    id: 'electrical',
    title: 'Electrical',
    items: [
      { id: 'entrance', name: 'Service Entrance' },
      { id: 'disconnect', name: 'Service Disconnect' },
      { id: 'amperage', name: 'Service Amperage' },
      { id: 'panel', name: 'Service Equipment / Electrical Panel' },
      { id: 'grounding', name: 'Service Grounding / Bonding' },
      { id: 'branch', name: 'Branch Wiring' },
      { id: 'breakers', name: 'Breakers' },
      { id: 'gfci', name: 'GFCI Protection' },
      { id: 'receptacles', name: 'Receptacles' },
      { id: 'switches', name: 'Switches, Lights' },
      { id: 'smoke', name: 'Smoke Alarms / Detectors' },
      { id: 'co', name: 'CO Detectors' },
    ],
    info: (p) => [
      ['Service Entrance Type', p.serviceEntrance],
      ['Service Amperage', p.service],
      ['Electrical Panel Location', p.mainDisconnect],
      ['Branch Wiring Metal Type', 'Copper'],
      ['AFCI Breakers Present', Number(p.yearBuilt) >= 2008 ? 'Yes' : 'No'],
      ['GEC Present', 'Yes'],
    ],
    narrative: () => [
      {
        title: 'Low Voltage Systems Not Inspected',
        text: 'EXCL — Low voltage systems are not inspected, including but not limited to telephone '
          + 'and telecom wiring, coaxial cable, ethernet, alarm systems, and low voltage lighting.',
      },
      {
        title: 'Electrical Panel Information',
        text: 'The main electrical panel was inspected for wiring deficiencies and damage. No '
          + 'indications of reportable conditions were present at the time of inspection unless '
          + 'otherwise noted in this report.',
      },
      {
        title: 'Branch Wiring Information',
        text: 'The branch wiring was inspected at visible portions for significant deficiencies that '
          + 'could be a fire or safety hazard, including connections made outside of a junction box, '
          + 'wiring terminations, open junction boxes, damage, and improper support. The majority of '
          + 'branch wiring is not visible behind wall and ceiling coverings.',
      },
      {
        title: 'GFCI Information',
        text: 'Ground Fault Circuit Interrupter protection allows a circuit or receptacle to trip if as '
          + 'little as a 5 milliamp differential is detected. This protection is recommended for '
          + 'receptacles within six feet of a sink and anywhere a device could come into contact with '
          + 'water: bathrooms, kitchens, the exterior, garages, laundry rooms, basements, and crawl '
          + 'spaces. GFCI protection is only tested where a visible test/reset device is present.',
      },
      {
        title: 'Receptacle Information',
        text: 'A representative number of receptacles were tested with a polarity tester to confirm '
          + 'proper wiring. 220V/240V receptacles are not tested, as they cannot be tested with a '
          + 'standard tester; only visible deficiencies are reported for those.',
      },
      {
        title: 'Smoke Alarm Information',
        text: 'Smoke alarms are recommended in each sleeping room, outside each sleeping area, and on '
          + 'every level including habitable attics and basements. Replacing the batteries and testing '
          + 'each alarm before spending the first night in the home is recommended.',
      },
    ],
  },
  {
    id: 'attic',
    title: 'Attic, Roof Structure, & Ventilation',
    items: [
      { id: 'access', name: 'Attic Access' },
      { id: 'ventilation', name: 'Ventilation' },
      { id: 'structure', name: 'Roof Structure / Framing' },
      { id: 'sheathing', name: 'Roof Sheathing / Decking' },
      { id: 'insulation', name: 'Insulation' },
      { id: 'exhaust', name: 'Exhaust Fan Vent(s)' },
      { id: 'wiring', name: 'Attic Wiring' },
    ],
    info: (p) => [
      ['Access Type', p.attic],
      ['Inspection Method', p.attic === 'No Accessible Attic' ? 'Not Accessible' : 'From Access Opening'],
      ['Ventilation Types', 'Ridge Exhaust Venting, Soffit Intake Venting'],
      ['Roof Structure Type', Number(p.yearBuilt) >= 1975 ? 'Engineered Trusses' : 'Rafters / Ceiling Joists'],
      ['Insulation Type', 'Loose Fill, Cellulose'],
      ['Indications of Leak(s) Present', 'Not at Visible Portions'],
    ],
    narrative: () => [
      {
        title: 'Accessibility Limitations',
        text: 'FYI — Attics are navigated as safely as possible and all related components are '
          + 'inspected visually from an area that does not put the inspector or the home at risk. The '
          + 'method of inspection depends on accessibility, clearances, insulation levels, stored '
          + 'items, and temperature. Insulation is not moved or disturbed for visual accessibility.',
      },
      {
        title: 'Ventilation Information',
        text: 'Attic ventilation was reported by a visual inspection of the ventilation sources and by '
          + 'looking for indications of improper ventilation. The general default standard is one '
          + 'square foot of ventilation for every 150 square feet of attic area, ideally weighted '
          + 'toward low intake venting at the soffits. Measurements are beyond the scope of a home '
          + 'inspection.',
      },
      {
        title: 'Roof Structure Information',
        text: 'The roof structure was inspected at visible portions for signs of moisture infiltration, '
          + 'damage, or other deficiencies. No reportable conditions or indications of past or present '
          + 'leaks were observed unless otherwise noted in this report.',
      },
      {
        title: 'Insulation Information',
        text: 'The insulation was inspected to determine approximate depth and type. Current energy '
          + 'standards recommend roughly 10-17 inches depending on type to achieve an R-38 rating. '
          + 'Depending on when the home was built, anywhere from 6-14 inches may be present.',
      },
    ],
  },
  {
    id: 'foundation',
    title: 'Basement / Foundation Area',
    items: [
      { id: 'moisture', name: 'Moisture Presence' },
      { id: 'walls', name: 'Foundation Walls' },
      { id: 'framing', name: 'Framing / Floor Structure' },
      { id: 'support', name: 'Floor Structure Support' },
      { id: 'subfloor', name: 'Subfloor' },
      { id: 'slab', name: 'Floor / Slab Condition' },
      { id: 'insulation', name: 'Insulation - Below Grade' },
      { id: 'stairs', name: 'Stairs - Below Grade' },
    ],
    info: (p) => [
      ['Foundation Type', p.foundation],
      ['Foundation Wall Material', Number(p.yearBuilt) < 1980 ? 'CMU Block' : 'Poured Concrete'],
      ['Floor Structure Materials', 'Wood Floor Joists'],
      ['Floor Structure Support Type', 'Steel Columns'],
      ['Subfloor Material', 'Plywood'],
      ['Indications of Moisture at Visible Portions', 'Not at Visible Portions'],
    ],
    narrative: () => [
      {
        title: 'Visual Limitations Information',
        text: 'LMT — Finished ceilings, ductwork, plumbing pipes, insulation, and stored items may '
          + 'block visual accessibility of the floor structure and other areas. The inspection of the '
          + 'foundation area and floor structure is limited to visual portions only.',
      },
      {
        title: 'Moisture Infiltration Information — Areas Below Grade',
        text: 'LMT — Areas below grade were inspected for signs of past or present water intrusion '
          + 'by examining visible portions of the foundation walls, floors, and soil. Only conditions '
          + 'as they existed at the time of inspection can be reported on, and no guarantee can be '
          + 'given that water will not infiltrate this area at a future time. Inquire with the seller '
          + 'as to prior moisture infiltration into areas below grade.',
      },
      {
        title: 'Information / Limitations on Wall Cracks',
        text: 'LMT — Wall cracks are reported on by their presence and visual condition as existing '
          + 'at the time of inspection only. Cracks within normal tolerances are less than 1/8 inch '
          + 'wide with no lateral displacement and no tapering of the crack width. Cracks outside of '
          + 'normal tolerances may be 3/16 inch or greater, contain lateral displacement, be horizontal '
          + 'in orientation, or taper, and will always be recommended for evaluation by a structural '
          + 'engineer. Any crack on a foundation wall below grade should be sealed at a minimum.',
      },
      {
        title: 'Floor Structure Information',
        text: 'Visible portions of the framing and floor structure were inspected for damage or other '
          + 'significant deficiencies. No reportable conditions were visibly present unless otherwise '
          + 'noted in this report.',
      },
    ],
  },
  {
    id: 'roof',
    title: 'Roof',
    items: [
      { id: 'covering', name: 'Roof Surface Condition' },
      { id: 'protrusions', name: 'Vents / Protrusions' },
      { id: 'flashing', name: 'Roof Flashings' },
      { id: 'chimney', name: 'Chimney' },
      { id: 'gutters', name: 'Gutters / Downspouts' },
      { id: 'skylights', name: 'Skylights' },
    ],
    info: (p) => [
      ['Roof Covering Material', p.roofCovering],
      ['Inspection Method', p.roofMethod],
      ['Amount of Roof Safely Walkable', p.roofMethod === 'Walked the Roof Surface' ? '80-100%' : '0%'],
      ['Roof Protrusion Type(s)', 'Plumbing Stack Vent(s), Flue Vent(s)'],
      ['Stage of Life Estimation', 'Second Third of Life'],
    ],
    narrative: (p) => [
      {
        title: 'Roof Limitations',
        text: 'LMT — The inspection of the roof and its covering material is limited to the '
          + 'conditions on the day of the inspection. The roof covering, visible portions of the roof '
          + 'structure from within the attic, and interior ceilings were inspected for indications of '
          + 'current or past leaks. Future conditions and inclement weather may reveal leaks that were '
          + 'not present at the time of inspection.',
      },
      ...(p.roofMethod === 'Aerial Drone' ? [{
        title: 'Inspected by Drone',
        text: 'LMT — An aerial drone was used for the roof evaluation. This method is not as '
          + 'thorough as walking the roof surface and is considered a limited inspection. Comments '
          + 'relating to the roof covering, protrusions, gutters, and chimneys are limited to the '
          + 'perspective of the drone.',
      }] : []),
      {
        title: 'Shingle Life Information',
        text: '3-tab composition shingles typically have a 12-15 year lifespan; architectural '
          + 'composition shingles typically 21-24 years. Lifespan is affected by material quality, the '
          + 'number of layers, structure orientation, roof pitch, climate, shingle color, attic '
          + 'ventilation, and overhanging vegetation. No estimate of remaining service life is given, '
          + 'in accordance with industry Standards of Practice.',
      },
      {
        title: 'Roof Flashing Information & Limitations',
        text: 'LMT — Visible portions of the flashings were inspected for significant deficiencies. '
          + 'Most flashing areas are not visible, as they are covered by the roof covering material '
          + 'and/or wall cladding, and those areas are excluded. Functionality has to be determined by '
          + 'looking for moisture intrusion on ceilings and roof decking.',
      },
      {
        title: 'Gutters and Downspouts Information',
        text: 'The gutters were inspected for proper securement, debris in the channel, standing water, '
          + 'and damage; the downspouts were inspected to confirm they divert rainwater away from the '
          + 'structure. Leaking gutters cannot be diagnosed if rain was not occurring at the time of '
          + 'inspection. Periodic cleaning of the gutter channels is recommended.',
      },
    ],
  },
  {
    id: 'environmental',
    title: 'Environmental Concerns',
    items: [
      { id: 'odors', name: 'Odors Present' },
      { id: 'fungal', name: 'Fungal Growth' },
      { id: 'radon', name: 'Radon' },
      { id: 'asbestos', name: 'Asbestos' },
      { id: 'lead', name: 'Lead Based Paint' },
      { id: 'pests', name: 'Pest / Insect / Wildlife Concerns' },
    ],
    info: (p) => [
      ['Odor(s) Present in the Home', 'No Discernible Odors'],
      ['Fungal Growth Present', 'Not at Visible Portions'],
      ['Radon Level', 'Not Tested'],
      ['Home Built Prior to 1978?', Number(p.yearBuilt) < 1978 ? 'Yes' : 'No'],
    ],
    narrative: (p) => [
      ...(Number(p.yearBuilt) < 1978 ? [{
        title: 'Asbestos and Lead Based Paint Information',
        text: 'Homes built prior to 1978 may contain building components or paint containing asbestos '
          + 'or lead. These materials are not tested for or reported on during a home inspection. If '
          + 'asbestos or lead based paint is a concern, a full environmental inspection is recommended '
          + 'prior to the end of the contingency period.',
      }] : []),
      {
        title: 'Fungal Growth and Mold Information',
        text: 'EXCL — Reporting on the presence of mold is excluded from a home inspection. Where '
          + 'obvious signs of fungal growth are seen, further evaluation and testing will be '
          + 'recommended as a courtesy, but these references should not be construed as an all-'
          + 'inclusive listing.',
      },
      {
        title: 'WDI-Termite Inspection Recommended',
        text: 'EXCL — Inspecting for and reporting on wood destroying insects and organisms — '
          + 'termites, powder post beetles, carpenter ants and bees — is beyond the scope of a home '
          + 'inspection and is excluded. A WDI-Termite inspection by a licensed pest control company is '
          + 'highly recommended prior to the end of the contingency period.',
      },
    ],
  },
];

export const SECTION_BY_ID = Object.fromEntries(SECTIONS.map((s) => [s.id, s]));
