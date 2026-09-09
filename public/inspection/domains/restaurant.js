/* Food service health inspection. */

const D = (section, item, sev, title, body, rec) => ({
  id: `fs.${section}.${item}.${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
  section, item, sev, title, body, rec,
});

const NOW = 'Correct on site, during this inspection.';
const REINSPECT = 'Correct immediately; a follow-up inspection will verify.';
const TRAIN = 'Retrain staff and document the training.';
const PROCEDURE = 'Establish a written procedure and monitor it.';
const REPAIR = 'Repair or replace the equipment.';
const PEST = 'Engage a licensed pest control operator.';
const PLUMBER = 'Engage a licensed plumber.';
const DISCARD = 'Discard the affected product.';
const NOTE = 'Advisory — correct by the next routine inspection.';

const INTAKE = [
  {
    id: 'establishment',
    title: 'The Establishment',
    hint: 'The only part you actually have to type.',
    fields: [
      { id: 'name', label: 'Establishment Name', type: 'text', placeholder: 'Newtown Road Diner', required: true },
      { id: 'address', label: 'Street Address', type: 'text', placeholder: '8329 Newtown Rd', required: true },
      { id: 'city', label: 'City', type: 'text', placeholder: 'Pikesville', required: true },
      { id: 'state', label: 'State', type: 'text', placeholder: 'MD', required: true, width: 'short' },
      { id: 'permit', label: 'Permit Number', type: 'text', placeholder: 'FS-2024-01188', required: true },
      { id: 'client', label: 'Person in Charge', type: 'text', placeholder: 'Liam Powell', required: true },
      { id: 'inspector', label: 'Inspector', type: 'text', placeholder: 'Your name', required: true },
      { id: 'company', label: 'Health Department', type: 'text', placeholder: 'County Health Department', required: true },
      { id: 'date', label: 'Inspection Date', type: 'date', required: true },
    ],
  },
  {
    id: 'operation',
    title: 'The Operation',
    hint: 'Click through it — this sets the risk category.',
    fields: [
      { id: 'type', label: 'Establishment Type', type: 'choice', options: ['Full Service Restaurant', 'Quick Service / Counter', 'Cafe / Coffee Shop', 'Bar / Tavern', 'Bakery', 'Food Truck / Mobile', 'School / Institutional Kitchen', 'Grocery with Prepared Food'] },
      { id: 'riskCategory', label: 'Risk Category', type: 'choice', options: ['Category 1 — Prepackaged only', 'Category 2 — Limited preparation', 'Category 3 — Extensive preparation', 'Category 4 — Complex processes / highly susceptible population'] },
      { id: 'seats', label: 'Seating Capacity', type: 'choice', options: ['No seating', 'Under 25', '25-50', '50-100', '100-250', 'Over 250'] },
      { id: 'staff', label: 'Staff on Duty', type: 'counter', min: 1, max: 40, value: 8 },
      { id: 'service', label: 'Service Style', type: 'choice', options: ['Cooked to order', 'Cook-chill / Reheat', 'Buffet / Self Service', 'Catering / Off-site', 'Raw or Undercooked Menu Items'] },
      { id: 'water', label: 'Water Supply', type: 'choice', options: ['Public Water', 'Private Well'] },
      { id: 'sewage', label: 'Sewage Disposal', type: 'choice', options: ['Public Sewer', 'Septic System'] },
      { id: 'cfpm', label: 'Certified Food Protection Manager Present?', type: 'choice', options: ['Yes, on site with certificate', 'Certified but not on site', 'No certified manager'] },
    ],
  },
  {
    id: 'visit',
    title: 'The Visit',
    hint: 'How and when you inspected.',
    fields: [
      { id: 'inspectionType', label: 'Inspection Type', type: 'choice', options: ['Routine', 'Follow-up / Re-inspection', 'Complaint Investigation', 'Pre-operational', 'Foodborne Illness Investigation'] },
      { id: 'announced', label: 'Announced?', type: 'choice', options: ['Unannounced', 'Announced'] },
      { id: 'timeOfDay', label: 'Time of Visit', type: 'choice', options: ['Before service', 'During lunch service', 'During dinner service', 'After service / Closing'] },
      { id: 'thermometer', label: 'Thermometer Calibrated?', type: 'choice', options: ['Yes, verified on site', 'No'] },
      { id: 'lastInspection', label: 'Previous Inspection Result', type: 'choice', options: ['No violations', 'Violations corrected', 'Repeat violations outstanding', 'First inspection'] },
      { id: 'permitStatus', label: 'Permit Status', type: 'choice', options: ['Current and posted', 'Current, not posted', 'Expired', 'Not produced'] },
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
      ['Announced', p.announced],
      ['Time of Visit', p.timeOfDay],
      ['Establishment Type', p.type],
      ['Risk Category', p.riskCategory],
      ['Seating Capacity', p.seats],
      ['Staff on Duty', String(p.staff)],
      ['Service Style', p.service],
      ['Permit Status', p.permitStatus],
      ['Previous Result', p.lastInspection],
      ['Thermometer Calibrated', p.thermometer],
    ],
    narrative: () => [
      {
        title: 'Purpose of This Inspection',
        text: 'This inspection assesses compliance with the applicable food code at the time of the '
          + 'visit. It is a snapshot: it records what was observed during the hours the inspector was '
          + 'present and cannot speak to practice at any other time. The person in charge is '
          + 'responsible for compliance at all times the establishment operates.',
      },
      {
        title: 'How Violations Are Classified',
        text: 'Priority items are those that directly control a hazard known to cause foodborne '
          + 'illness — cooking, cooling, holding temperatures, handwashing, and cross-contamination. '
          + 'Priority foundation items support those controls, such as equipment, thermometers, and '
          + 'training. Core items are general sanitation, facility maintenance, and good retail '
          + 'practice. Priority violations require immediate correction and generally trigger a '
          + 'follow-up inspection.',
      },
      {
        title: 'Person in Charge',
        text: 'The findings in this report were reviewed with the person in charge at the conclusion '
          + 'of the inspection. Items corrected on site during the visit are noted as such and remain '
          + 'recorded, because correction during an inspection does not erase the fact that the '
          + 'condition occurred.',
      },
    ],
  },
  {
    id: 'management',
    title: 'Management & Employee Health',
    items: [
      { id: 'pic', name: 'Person in Charge' },
      { id: 'cfpm', name: 'Certified Food Protection Manager' },
      { id: 'illness', name: 'Employee Health Policy' },
      { id: 'reporting', name: 'Illness Reporting' },
      { id: 'permit', name: 'Permit and Postings' },
    ],
    info: (p) => [
      ['Certified Food Protection Manager', p.cfpm],
      ['Permit Status', p.permitStatus],
    ],
    narrative: () => [
      {
        title: 'Active Managerial Control',
        text: 'The person in charge must be able to demonstrate knowledge of the food safety risks in '
          + 'this operation and must actively control them, rather than relying on an inspection to '
          + 'find problems. Knowledge was assessed by asking about the specific hazards in the '
          + 'processes this establishment uses.',
      },
    ],
  },
  {
    id: 'hygiene',
    title: 'Handwashing & Personal Hygiene',
    items: [
      { id: 'handwash', name: 'Handwashing Practice' },
      { id: 'sinks', name: 'Handwashing Sinks' },
      { id: 'supplies', name: 'Handwashing Supplies' },
      { id: 'gloves', name: 'Gloves and Bare Hand Contact' },
      { id: 'hygiene', name: 'Personal Cleanliness' },
      { id: 'eating', name: 'Eating, Drinking and Smoking' },
    ],
    info: () => [],
    narrative: () => [
      {
        title: 'Why This Section Comes First',
        text: 'Contaminated hands are among the most frequently identified contributing factors in '
          + 'foodborne illness outbreaks. Handwashing was observed directly during service rather '
          + 'than assessed from the facilities alone — a fully stocked hand sink that nobody uses '
          + 'controls nothing.',
      },
    ],
  },
  {
    id: 'temperature',
    title: 'Time & Temperature Control',
    items: [
      { id: 'cooking', name: 'Cooking Temperatures' },
      { id: 'coldholding', name: 'Cold Holding' },
      { id: 'hotholding', name: 'Hot Holding' },
      { id: 'cooling', name: 'Cooling' },
      { id: 'reheating', name: 'Reheating' },
      { id: 'thawing', name: 'Thawing' },
      { id: 'datemarking', name: 'Date Marking' },
      { id: 'thermometers', name: 'Thermometers' },
    ],
    info: (p) => [
      ['Service Style', p.service],
      ['Thermometer Calibrated', p.thermometer],
    ],
    narrative: () => [
      {
        title: 'Temperature Control',
        text: 'Time and temperature control for safety foods must be held at or below 41F, or at or '
          + 'above 135F. The range between those figures is where bacteria multiply fastest. All '
          + 'temperatures recorded in this report were taken with a calibrated probe thermometer at '
          + 'the point of measurement stated.',
      },
      {
        title: 'Cooling — the Step Most Often Missed',
        text: 'Cooked food must cool from 135F to 70F within two hours, and from 135F to 41F within a '
          + 'total of six hours. Cooling is the single most commonly mishandled step in food service, '
          + 'because a deep covered container of hot food left in a walk-in can stay in the hazard '
          + 'zone overnight while appearing to have been refrigerated properly.',
      },
    ],
  },
  {
    id: 'source',
    title: 'Food Source, Storage & Protection',
    items: [
      { id: 'source', name: 'Approved Source' },
      { id: 'receiving', name: 'Receiving Condition' },
      { id: 'storage', name: 'Dry and Cold Storage' },
      { id: 'protection', name: 'Food Protection' },
      { id: 'shellfish', name: 'Shellfish and Fish Records' },
      { id: 'consumer', name: 'Consumer Advisory' },
      { id: 'allergen', name: 'Allergen Awareness' },
    ],
    info: (p) => [
      ['Service Style', p.service],
      ['Risk Category', p.riskCategory],
    ],
    narrative: () => [
      {
        title: 'Approved Source',
        text: 'All food must come from an approved, regulated source. Home-prepared food, food from '
          + 'an unlicensed supplier, and undocumented donations cannot be served to the public '
          + 'regardless of how it was handled after arrival.',
      },
    ],
  },
  {
    id: 'contamination',
    title: 'Cross-Contamination Control',
    items: [
      { id: 'raw', name: 'Raw and Ready-to-Eat Separation' },
      { id: 'surfaces', name: 'Food Contact Surfaces' },
      { id: 'utensils', name: 'In-Use Utensils' },
      { id: 'cloths', name: 'Wiping Cloths' },
      { id: 'ice', name: 'Ice and Ice Machines' },
    ],
    info: () => [],
    narrative: () => [
      {
        title: 'Separation',
        text: 'Raw animal products must be stored and handled so that they cannot contaminate '
          + 'ready-to-eat food — below and away from it in storage, on separate equipment during '
          + 'preparation, with cleaning and sanitising between tasks.',
      },
    ],
  },
  {
    id: 'sanitation',
    title: 'Cleaning & Sanitizing',
    items: [
      { id: 'warewash', name: 'Warewashing' },
      { id: 'sanitizer', name: 'Sanitizer Concentration' },
      { id: 'threecomp', name: 'Three-Compartment Sink' },
      { id: 'equipmentclean', name: 'Equipment Cleanliness' },
      { id: 'testkit', name: 'Test Kits' },
    ],
    info: () => [],
    narrative: () => [
      {
        title: 'Sanitizing',
        text: 'Cleaning removes soil; sanitizing reduces the organisms that remain. Both are '
          + 'required, in that order. Sanitizer concentration was measured with an appropriate test '
          + 'kit — too weak does not sanitize, and too strong is a chemical hazard in its own right.',
      },
    ],
  },
  {
    id: 'equipment',
    title: 'Equipment & Utensils',
    items: [
      { id: 'condition', name: 'Equipment Condition' },
      { id: 'approved', name: 'Approved Equipment' },
      { id: 'storage', name: 'Utensil Storage' },
      { id: 'singleuse', name: 'Single-Use Articles' },
      { id: 'ventilation', name: 'Ventilation and Hoods' },
    ],
    info: () => [],
    narrative: () => [
      {
        title: 'Equipment Standards',
        text: 'Food equipment must be commercially rated, durable, non-absorbent, and cleanable. '
          + 'Domestic equipment, bare wood, cracked plastic, and improvised repairs cannot be properly '
          + 'cleaned and are not acceptable in a commercial kitchen.',
      },
    ],
  },
  {
    id: 'plumbing',
    title: 'Water, Plumbing & Waste',
    items: [
      { id: 'water', name: 'Water Supply' },
      { id: 'backflow', name: 'Backflow Prevention' },
      { id: 'drainage', name: 'Drainage and Sewage' },
      { id: 'grease', name: 'Grease Management' },
      { id: 'garbage', name: 'Garbage and Refuse' },
      { id: 'toilets', name: 'Toilet Facilities' },
    ],
    info: (p) => [
      ['Water Supply', p.water],
      ['Sewage Disposal', p.sewage],
    ],
    narrative: () => [
      {
        title: 'Cross-Connection Control',
        text: 'The potable water system must be protected from contamination by backflow. Every '
          + 'connection where water could be drawn back into the supply — hose bibs, dish machines, '
          + 'carbonators, mop sinks — requires appropriate protection.',
      },
    ],
  },
  {
    id: 'pests',
    title: 'Pest Control',
    items: [
      { id: 'evidence', name: 'Evidence of Pests' },
      { id: 'exclusion', name: 'Exclusion' },
      { id: 'program', name: 'Pest Control Program' },
      { id: 'animals', name: 'Animals on Premises' },
    ],
    info: () => [],
    narrative: () => [
      {
        title: 'Pest Management',
        text: 'The premises must be maintained free of insects, rodents, and other pests. Evidence '
          + 'was looked for in the places pests actually live — behind and beneath equipment, in dry '
          + 'storage, along wall and floor junctions, and at the refuse area — rather than only in '
          + 'the open floor space.',
      },
    ],
  },
  {
    id: 'facilities',
    title: 'Physical Facilities',
    items: [
      { id: 'floors', name: 'Floors, Walls and Ceilings' },
      { id: 'lighting', name: 'Lighting' },
      { id: 'ventilationfac', name: 'Ventilation' },
      { id: 'dressing', name: 'Dressing Areas and Storage' },
      { id: 'outer', name: 'Outer Openings and Premises' },
    ],
    info: () => [],
    narrative: () => [
      {
        title: 'Facility Maintenance',
        text: 'Surfaces throughout the establishment must be smooth, durable, and easily cleanable, '
          + 'and must be kept clean and in good repair. A damaged surface cannot be cleaned properly, '
          + 'and it harbours both soil and pests.',
      },
    ],
  },
  {
    id: 'chemicals',
    title: 'Chemicals & Toxic Items',
    items: [
      { id: 'storage', name: 'Chemical Storage' },
      { id: 'labelling', name: 'Labelling' },
      { id: 'approved', name: 'Approved Chemicals' },
      { id: 'pesticides', name: 'Pesticides' },
    ],
    info: () => [],
    narrative: () => [
      {
        title: 'Chemical Control',
        text: 'Toxic materials must be stored so they cannot contaminate food, equipment, utensils, '
          + 'or single-use articles — which in practice means below and away from all of them, in '
          + 'labelled containers, and only chemicals approved for use in a food establishment.',
      },
    ],
  },
];

const DEFECTS = [
  /* management */
  D('management', 'pic', 'marginal', 'Person in Charge Could Not Demonstrate Knowledge',
    'The person in charge was unable to demonstrate knowledge of the food safety hazards specific to this operation and the controls used to manage them. The person in charge is required to be able to do so at all times the establishment is in operation.', TRAIN),
  D('management', 'pic', 'significant', 'No Person in Charge Present',
    'No person in charge was present during operating hours. A person in charge with the authority to direct staff and correct violations must be present at all times the establishment is open.', REINSPECT),
  D('management', 'cfpm', 'marginal', 'No Certified Food Protection Manager',
    'The establishment could not demonstrate that a certified food protection manager is employed as required for its risk category. Certification of at least one manager is required, and the certificate must be available for review.', PROCEDURE),
  D('management', 'illness', 'significant', 'No Employee Health Policy in Place',
    'The establishment had no employee health policy, and staff could not state which symptoms and diagnoses require them to be excluded or restricted from work. An ill food handler is one of the most direct routes to an outbreak. A written policy with documented staff acknowledgement is required.', PROCEDURE),
  D('management', 'illness', 'significant', 'Ill Employee Working With Food',
    'An employee exhibiting symptoms requiring exclusion — vomiting, diarrhea, jaundice, a sore throat with fever, or an infected uncovered wound — was working with food or food contact surfaces. The employee must be excluded or restricted immediately in accordance with the food code.', NOW),
  D('management', 'reporting', 'marginal', 'Employee Illness Reporting Agreements Not Documented',
    'Employee reporting agreements were not documented or were not available for review. Documentation that each food employee has been informed of their reporting obligations is required.', PROCEDURE),
  D('management', 'permit', 'marginal', 'Permit Not Posted',
    'The current permit was not posted in public view as required. Posting is required so that the public can see the establishment is permitted and current.', NOTE),
  D('management', 'permit', 'significant', 'Operating Without a Current Permit',
    'The establishment was operating with an expired permit, or no permit could be produced. Operating without a valid permit is grounds for closure. This must be resolved with the health department immediately.', REINSPECT),

  /* hygiene */
  D('hygiene', 'handwash', 'significant', 'Employee Did Not Wash Hands When Required',
    'A food employee was observed failing to wash hands at a point where handwashing is required — after handling raw animal food, after touching the face or body, after using the restroom, after handling soiled equipment, or before donning gloves. Handwashing was corrected and demonstrated at the time of inspection.', NOW),
  D('hygiene', 'handwash', 'marginal', 'Improper Handwashing Technique',
    'Handwashing was observed but did not meet the required procedure — insufficient duration, water not warm, soap not used, or hands dried on clothing. Retraining on the full procedure is required.', TRAIN),
  D('hygiene', 'sinks', 'significant', 'Handwashing Sink Blocked or Used for Other Purposes',
    'A handwashing sink was blocked, was being used to store equipment, or was being used as a dump sink. A hand sink must be kept accessible and used for no purpose other than handwashing. Corrected at the time of inspection.', NOW),
  D('hygiene', 'sinks', 'significant', 'Handwashing Sink Not Accessible Where Required',
    'No handwashing sink was available in a work area where one is required, or the nearest sink was too far from the work area to be used as intended. Installation of a conveniently located hand sink is required.', REINSPECT),
  D('hygiene', 'supplies', 'marginal', 'Handwashing Sink Lacking Soap or Towels',
    'A handwashing sink was not supplied with soap, single-use towels or an approved drying device. A hand sink without supplies does not get used. Corrected at the time of inspection.', NOW),
  D('hygiene', 'supplies', 'marginal', 'No Hot Water at Handwashing Sink',
    'The handwashing sink did not supply water at the required minimum temperature. Repair is required.', REPAIR),
  D('hygiene', 'gloves', 'significant', 'Bare Hand Contact With Ready-to-Eat Food',
    'An employee handled ready-to-eat food with bare hands. Ready-to-eat food must be handled with suitable utensils or single-use gloves. Corrected at the time of inspection and the affected product discarded.', DISCARD),
  D('hygiene', 'gloves', 'marginal', 'Gloves Not Changed Between Tasks',
    'Single-use gloves were worn continuously across tasks, including between raw and ready-to-eat food. Gloves are not a substitute for handwashing and must be changed, with hands washed, at every point handwashing would otherwise be required.', TRAIN),
  D('hygiene', 'hygiene', 'marginal', 'Hair Restraints Not Worn',
    'Food employees were not wearing effective hair restraints while preparing food or handling clean equipment.', TRAIN),
  D('hygiene', 'hygiene', 'marginal', 'Jewellery Worn on Hands or Arms',
    'Food employees were wearing jewellery on the hands or arms other than a plain ring. Jewellery cannot be cleaned properly, harbours organisms, and can fall into food.', TRAIN),
  D('hygiene', 'eating', 'marginal', 'Employee Eating or Drinking in a Food Preparation Area',
    'An employee was eating, or drinking from an unapproved container, in a food preparation or warewashing area. Employee beverages must be in a covered container with a straw or lid and stored so they cannot contaminate food or surfaces.', TRAIN),

  /* temperature */
  D('temperature', 'cooking', 'significant', 'Food Not Cooked to the Required Temperature',
    'A time and temperature control for safety food was not cooked to its required minimum internal temperature. Cooking is the primary kill step for pathogens in raw animal products. The product was returned to cooking and the temperature verified before service.', NOW),
  D('temperature', 'coldholding', 'significant', 'Cold Holding Above 41F',
    'Time and temperature control for safety food was held above 41F in cold holding. The affected product was assessed and, where the duration in the hazard zone could not be established, discarded. The unit must hold product at or below 41F before it is used again.', DISCARD),
  D('temperature', 'hotholding', 'significant', 'Hot Holding Below 135F',
    'Time and temperature control for safety food was held below 135F in hot holding. Hot holding equipment is designed to hold food already at temperature, not to bring it up to temperature. The affected product was assessed and disposition determined at the time of inspection.', DISCARD),
  D('temperature', 'cooling', 'significant', 'Improper Cooling — Time and Temperature Not Met',
    'Cooked food was not cooled from 135F to 70F within two hours and to 41F within six hours total, or was being cooled by a method that cannot achieve those rates — deep containers, tightly covered, or placed hot into a full walk-in. Cooling is the most commonly mishandled step in food service. Written cooling procedures with logged temperatures are required.', PROCEDURE),
  D('temperature', 'cooling', 'marginal', 'Cooling Method Not Adequate',
    'Food was being cooled in a manner unlikely to meet the required cooling rate, although the product was still within its cooling window at the time of measurement. Shallow pans, ice baths, ice wands, or a blast chiller are required, with the product loosely covered until it reaches 41F.', PROCEDURE),
  D('temperature', 'reheating', 'significant', 'Improper Reheating for Hot Holding',
    'Food reheated for hot holding did not reach 165F within two hours. Reheating must be rapid and must be done on equipment capable of it — hot holding equipment is not.', NOW),
  D('temperature', 'thawing', 'marginal', 'Improper Thawing',
    'Food was being thawed at room temperature or by another unapproved method. Thawing must be done under refrigeration, under running water at 70F or below, as part of the cooking process, or in a microwave with cooking immediately following.', TRAIN),
  D('temperature', 'datemarking', 'marginal', 'Date Marking Missing or Incorrect',
    'Ready-to-eat time and temperature control for safety food held more than 24 hours was not date marked, or was marked beyond the seven day limit. Product held beyond seven days at 41F must be discarded.', DISCARD),
  D('temperature', 'datemarking', 'significant', 'Food Held Beyond the Date Marking Limit',
    'Ready-to-eat food was found held beyond its seven day date marking limit. The affected product was discarded at the time of inspection.', DISCARD),
  D('temperature', 'thermometers', 'marginal', 'No Probe Thermometer Available',
    'No probe thermometer was available, or the one available was not accurate. Temperature cannot be managed if it is not measured. An accurate, properly scaled probe thermometer is required and must be calibrated regularly.', PROCEDURE),
  D('temperature', 'thermometers', 'marginal', 'Cold Holding Unit Has No Thermometer',
    'A refrigeration unit had no ambient thermometer, or the thermometer was not readable or not accurate. Each unit must have a thermometer located in the warmest part of the unit.', REPAIR),

  /* source */
  D('source', 'source', 'significant', 'Food From an Unapproved Source',
    'Food was present that did not come from an approved, regulated source — home prepared items, an unlicensed supplier, or product with no traceable origin. This product may not be served and was removed from service at the time of inspection.', DISCARD),
  D('source', 'receiving', 'marginal', 'Product Received in Poor Condition',
    'Food was accepted or held in a damaged, dented, swollen, or otherwise compromised container. Product in this condition must be segregated and returned or discarded rather than placed into stock.', DISCARD),
  D('source', 'storage', 'marginal', 'Food Stored on the Floor',
    'Food or single-use articles were stored directly on the floor. Storage must be at least six inches above the floor to allow cleaning beneath and to keep product out of splash.', NOW),
  D('source', 'storage', 'marginal', 'Food Stored Uncovered',
    'Food in storage was uncovered or inadequately protected from contamination. Corrected at the time of inspection.', NOW),
  D('source', 'protection', 'marginal', 'Food Not Protected on Display',
    'Food on display or on a self-service line was not protected by a sneeze guard, effective barrier, or suitable packaging.', REPAIR),
  D('source', 'protection', 'significant', 'Food Contaminated by an Overhead Source',
    'Food or a food contact surface was contaminated, or was positioned to be contaminated, by an overhead source — condensate from a refrigeration unit, a leaking pipe, or a ceiling in disrepair. The affected product was discarded and the source must be corrected before the area is used again.', REINSPECT),
  D('source', 'shellfish', 'marginal', 'Shellstock Tags Not Retained',
    'Shellstock identification tags were not retained for 90 days as required, or were not kept in order. These tags are the only trace back to the harvest area if illness is later linked to the product.', PROCEDURE),
  D('source', 'consumer', 'marginal', 'Consumer Advisory Not Provided',
    'The menu offers raw or undercooked animal products without the required consumer advisory disclosing the item and reminding consumers of the risk. The advisory must appear on the menu.', PROCEDURE),
  D('source', 'allergen', 'marginal', 'Staff Could Not Describe Allergen Controls',
    'Staff were unable to describe how major food allergens are identified and controlled, or how an allergen request is handled. Allergen training and a documented procedure are required.', TRAIN),

  /* contamination */
  D('contamination', 'raw', 'significant', 'Raw Animal Food Stored Above Ready-to-Eat Food',
    'Raw animal food was stored above or beside ready-to-eat food, allowing drip contamination. Storage must be ordered by required cooking temperature, with ready-to-eat food on top. Corrected at the time of inspection.', NOW),
  D('contamination', 'raw', 'significant', 'Cross-Contamination During Preparation',
    'Raw animal food was prepared on a surface or with equipment subsequently used for ready-to-eat food without cleaning and sanitizing between uses. The affected product was discarded and the surfaces were cleaned and sanitized.', DISCARD),
  D('contamination', 'surfaces', 'marginal', 'Food Contact Surface Soiled',
    'A food contact surface in use was visibly soiled. Food contact surfaces must be cleaned and sanitized before use, between raw and ready-to-eat tasks, and at least every four hours during continuous use.', NOW),
  D('contamination', 'surfaces', 'marginal', 'Cutting Boards Scored and Stained',
    'Cutting boards were deeply scored, stained, or pitted beyond the point of effective cleaning. Resurfacing or replacement is required.', REPAIR),
  D('contamination', 'utensils', 'marginal', 'In-Use Utensils Improperly Stored',
    'In-use utensils were stored in standing water below 135F, in the product with the handle in contact with food, or on a soiled surface. Utensils must be stored in the product with the handle above the rim, on a clean surface, or in running or hot water.', TRAIN),
  D('contamination', 'cloths', 'marginal', 'Wiping Cloths Not Stored in Sanitizer',
    'Wiping cloths were left on work surfaces rather than held in sanitizer solution between uses. A damp cloth left out spreads contamination across every surface it touches.', NOW),
  D('contamination', 'ice', 'marginal', 'Ice Machine Soiled',
    'The interior of the ice machine was soiled with mould or slime. Ice is a food. The machine must be cleaned and sanitized on a documented schedule.', REPAIR),
  D('contamination', 'ice', 'marginal', 'Ice Scoop Improperly Stored',
    'The ice scoop was stored in the ice with the handle buried, or on an unclean surface. The scoop must be stored on a clean, protected surface or in the ice with the handle above the ice.', NOW),

  /* sanitation */
  D('sanitation', 'sanitizer', 'significant', 'Sanitizer Concentration Below Requirement',
    'The sanitizer solution in use tested below the required concentration. Below the effective range, the solution does not sanitize, and every surface treated with it has not been sanitized. The solution was remade and verified with a test kit at the time of inspection.', NOW),
  D('sanitation', 'sanitizer', 'marginal', 'Sanitizer Concentration Above Requirement',
    'The sanitizer solution tested above the maximum concentration, which is a chemical hazard on food contact surfaces and does not improve sanitizing. Solutions must be mixed to the manufacturer specification and verified with a test kit.', NOW),
  D('sanitation', 'testkit', 'marginal', 'No Sanitizer Test Kit Available',
    'No test kit appropriate to the sanitizer in use was available. Concentration cannot be managed without one. A test kit is required and must be used at each change of solution.', PROCEDURE),
  D('sanitation', 'warewash', 'marginal', 'Dish Machine Not Achieving Required Temperature or Concentration',
    'The warewashing machine did not reach the required wash or rinse temperature, or did not dispense sanitizer at the required concentration. Until it is repaired and verified, warewashing must be done manually in the three-compartment sink.', REPAIR),
  D('sanitation', 'threecomp', 'marginal', 'Improper Manual Warewashing Procedure',
    'The three-compartment sink was not set up or used correctly — missing a step, no sanitizer, or no air drying. The required sequence is wash, rinse, sanitize, then air dry.', TRAIN),
  D('sanitation', 'threecomp', 'marginal', 'Equipment Towel Dried After Sanitizing',
    'Cleaned and sanitized equipment was being towel dried, which recontaminates the surface. Equipment must be air dried.', TRAIN),
  D('sanitation', 'equipmentclean', 'marginal', 'Non-Food Contact Surfaces Soiled',
    'Non-food contact surfaces — equipment exteriors, shelving, gaskets, and the areas beneath and behind equipment — had accumulated soil and grease. These surfaces must be kept clean at a frequency that prevents accumulation.', REPAIR),

  /* equipment */
  D('equipment', 'condition', 'marginal', 'Equipment in Disrepair',
    'Equipment was damaged, had torn gaskets, or was otherwise in disrepair such that it cannot be properly cleaned or cannot hold temperature. Repair or replacement is required.', REPAIR),
  D('equipment', 'approved', 'marginal', 'Domestic Equipment in Commercial Use',
    'Domestic-grade equipment was in use in a commercial operation. Domestic equipment is not constructed to be cleaned or to perform at commercial duty and is not approved for this use.', REPAIR),
  D('equipment', 'storage', 'marginal', 'Clean Equipment Improperly Stored',
    'Clean equipment and utensils were stored in a manner allowing contamination — unprotected, inverted onto a soiled surface, or in a wet nesting stack.', NOW),
  D('equipment', 'singleuse', 'marginal', 'Single-Use Articles Reused or Improperly Stored',
    'Single-use articles were being reused, or were stored unprotected. Single-use items cannot be effectively cleaned and must not be reused.', TRAIN),
  D('equipment', 'ventilation', 'marginal', 'Hood System Soiled or Filters Missing',
    'The exhaust hood was heavily soiled with grease, or filters were missing or not in place. Beyond sanitation this is a fire hazard, and hood cleaning by a qualified service on a documented schedule is required.', REPAIR),

  /* plumbing */
  D('plumbing', 'backflow', 'significant', 'No Backflow Prevention at a Cross-Connection',
    'A cross-connection was present without approved backflow protection — a hose submerged in a sink, a missing air gap, or an unprotected connection. Backflow can draw contamination directly into the potable water supply serving the building. Immediate correction is required.', PLUMBER),
  D('plumbing', 'drainage', 'significant', 'Sewage Backup or Discharge Present',
    'Sewage was backing up or discharging within the establishment. This is an imminent health hazard. The affected area must be closed, cleaned, and sanitized, and the establishment may not operate in the affected area until the fault is corrected.', REINSPECT),
  D('plumbing', 'drainage', 'marginal', 'No Air Gap at a Required Drain',
    'A drain line requiring an air gap discharged directly into a floor drain or sink without one. Indirect waste connections must maintain a proper air gap.', PLUMBER),
  D('plumbing', 'water', 'marginal', 'Insufficient Hot Water',
    'The establishment could not supply hot water at the required temperature and volume to all fixtures during operation. Repair or capacity upgrade is required.', PLUMBER),
  D('plumbing', 'grease', 'marginal', 'Grease Trap Not Maintained',
    'The grease interceptor was overfull or had not been serviced on a documented schedule, creating an odour and backup risk. Servicing with records retained is required.', PLUMBER),
  D('plumbing', 'garbage', 'marginal', 'Refuse Area Not Maintained',
    'The refuse area was unclean, containers were uncovered or overflowing, or the enclosure was in disrepair. An unmanaged refuse area is the most common thing drawing pests to a food establishment.', REPAIR),
  D('plumbing', 'toilets', 'marginal', 'Toilet Facilities Not Properly Maintained',
    'Toilet facilities were unclean, lacked supplies, or the door was not self-closing. Toilet rooms must be kept clean, supplied, and separated from food areas by a self-closing door.', REPAIR),

  /* pests */
  D('pests', 'evidence', 'significant', 'Evidence of Rodent Activity',
    'Rodent droppings, gnawing, or nesting material were present. Rodents contaminate food and surfaces continuously as they move. Immediate treatment by a licensed pest control operator, together with cleaning and sanitizing of all affected areas and disposal of exposed food, is required.', PEST),
  D('pests', 'evidence', 'significant', 'Live Insect Infestation Present',
    'A live insect infestation — roaches, flies breeding on site, or stored product pests — was observed. Immediate treatment by a licensed operator with a follow-up inspection is required.', PEST),
  D('pests', 'evidence', 'marginal', 'Flies Present in Food Areas',
    'Flies were present in food preparation or service areas. Correction of the source, together with exclusion at doors and windows, is required.', PEST),
  D('pests', 'exclusion', 'marginal', 'Gaps Allowing Pest Entry',
    'Gaps were present at doors, walls, or utility penetrations through which pests can enter. Sealing all openings and fitting door sweeps is required.', REPAIR),
  D('pests', 'exclusion', 'marginal', 'Outer Door Propped Open Without Screening',
    'An outer door was propped open without screening, giving pests unrestricted access. Outer openings must be protected whenever they are open.', NOW),
  D('pests', 'program', 'marginal', 'No Pest Control Program Documented',
    'No records of a pest control program were available. A licensed operator servicing the premises on a schedule, with reports retained on site, is required.', PEST),
  D('pests', 'animals', 'marginal', 'Unauthorised Animal on the Premises',
    'An animal other than a permitted service animal was present in a food area. Correction is required.', NOW),

  /* facilities */
  D('facilities', 'floors', 'marginal', 'Floors, Walls or Ceilings in Disrepair',
    'Floor, wall, or ceiling surfaces were damaged, missing tiles, or otherwise not smooth and cleanable. Damaged surfaces cannot be cleaned properly and harbour soil and pests. Repair is required.', REPAIR),
  D('facilities', 'floors', 'marginal', 'Floors Soiled — Accumulated Debris',
    'Floors had accumulated soil and food debris, particularly beneath and behind equipment. Cleaning to a schedule that reaches these areas is required.', REPAIR),
  D('facilities', 'lighting', 'marginal', 'Inadequate Lighting',
    'Lighting was below the required intensity in a food preparation, warewashing, or storage area. Soil is not seen in poor light, and areas that are not seen do not get cleaned.', REPAIR),
  D('facilities', 'lighting', 'marginal', 'Light Shielding Missing',
    'Light fixtures over food or food contact surfaces were not shielded or shatter-resistant. A broken lamp above an open food area is a physical hazard.', REPAIR),
  D('facilities', 'ventilationfac', 'marginal', 'Inadequate Ventilation — Condensate or Grease Accumulation',
    'Ventilation was inadequate, resulting in condensate or grease accumulating on surfaces. Correction is required to prevent that accumulation dripping onto food or equipment.', REPAIR),
  D('facilities', 'dressing', 'marginal', 'Personal Items Stored in Food Areas',
    'Employee personal belongings, clothing, or medications were stored in food preparation or storage areas. A designated area away from food, equipment, and single-use articles is required.', NOW),
  D('facilities', 'outer', 'marginal', 'Premises Not Maintained',
    'The exterior premises were littered, or unused equipment was accumulating outside. Both harbour pests and both are within the scope of the permit.', REPAIR),

  /* chemicals */
  D('chemicals', 'storage', 'significant', 'Chemicals Stored Above or Beside Food',
    'Toxic materials were stored above or beside food, equipment, utensils, or single-use articles. Chemical contamination of food is immediate and serious. Corrected at the time of inspection by relocating the chemicals below and away from all food and food contact items.', NOW),
  D('chemicals', 'labelling', 'marginal', 'Working Container Not Labelled',
    'A working container of a chemical was not labelled with its common name. An unlabelled spray bottle in a kitchen is how a cleaning chemical ends up on a food surface, or in a food.', NOW),
  D('chemicals', 'approved', 'marginal', 'Unapproved Chemical in Use',
    'A chemical not approved for use in a food establishment was in use. Only chemicals approved for food service application may be used, and they must be used according to their label directions.', NOW),

  /* core items / good retail practice */
  D('management', 'permit', 'minor', 'Inspection Report Not Posted',
    'The most recent inspection report was not posted or made available to the public as required locally. Posting is required so that customers can see the establishment\'s inspection history.', NOTE),
  D('hygiene', 'hygiene', 'minor', 'Employee Outer Clothing Soiled',
    'Food employees were wearing visibly soiled outer clothing. Clean outer clothing is required at the start of each shift and when it becomes soiled during service.', NOTE),
  D('hygiene', 'sinks', 'minor', 'Handwashing Signage Not Posted',
    'A handwashing sign was not posted at a handwashing sink used by food employees. Signage is required at each hand sink.', NOTE),
  D('temperature', 'thermometers', 'minor', 'No Temperature Logs Maintained',
    'No routine temperature logs were maintained for refrigeration units or hot holding. Logs are not required in every jurisdiction, but they are the simplest way for a person in charge to demonstrate active managerial control and to catch a failing unit before product is lost.', PROCEDURE),
  D('source', 'storage', 'minor', 'Stock Rotation Not Practised',
    'Product was not being rotated first in, first out, with older stock behind newer. Poor rotation leads directly to product held past its date marking limit.', NOTE),
  D('source', 'storage', 'minor', 'Bulk Container Not Labelled',
    'A bulk food container holding product removed from its original packaging was not labelled with the common name of the food. Labelling is required for any food not identifiable from its appearance.', NOTE),
  D('contamination', 'surfaces', 'minor', 'Can Opener Blade Soiled',
    'The can opener blade and mount had accumulated residue. This is one of the most frequently missed food contact surfaces in a commercial kitchen and it should be on the daily cleaning list.', NOTE),
  D('sanitation', 'equipmentclean', 'minor', 'Refrigeration Gaskets Soiled',
    'Refrigeration door gaskets had accumulated soil and debris. Gaskets should be cleaned on a routine schedule; soiled gaskets also seal poorly, which costs the unit its holding temperature.', NOTE),
  D('sanitation', 'warewash', 'minor', 'Dish Machine Data Plate Not Followed',
    'The warewashing machine was not being operated in accordance with its data plate — incorrect cycle, pressure, or chemical. Operating to the data plate is required for the machine to sanitize as designed.', TRAIN),
  D('equipment', 'condition', 'minor', 'Equipment Not Sealed or Spaced for Cleaning',
    'Equipment was neither sealed to the adjoining surface nor spaced far enough from it to allow cleaning between. The gap behind equipment is where soil and pests accumulate unseen.', REPAIR),
  D('equipment', 'ventilation', 'minor', 'Hood Filters Loose or Poorly Fitted',
    'Hood filters were loose or poorly fitted, allowing grease-laden air past them. Properly fitted filters are required.', REPAIR),
  D('plumbing', 'garbage', 'minor', 'Refuse Container Lids Left Open',
    'Outdoor refuse container lids were left open. Closed lids are the single cheapest pest control measure available to a food establishment.', NOTE),
  D('facilities', 'floors', 'minor', 'Ceiling Tiles Missing or Stained',
    'Ceiling tiles were missing, displaced, or water stained. Stained tiles also indicate a leak above that has not been traced.', REPAIR),
  D('facilities', 'outer', 'minor', 'Mop Not Stored to Air Dry',
    'The wet mop was not hung to air dry after use. A mop left standing in a bucket grows organisms and spreads them over every floor it touches next.', NOTE),
  D('chemicals', 'labelling', 'minor', 'Material Safety Documentation Not Available',
    'Safety data sheets for the chemicals in use were not available on site. These are required for employee safety and should be kept where staff can reach them.', PROCEDURE),

  D('chemicals', 'pesticides', 'significant', 'Unapproved Pesticide Application',
    'Pesticides were present or had been applied by someone other than a licensed applicator, or a product not approved for food establishments was in use. Pesticide application in a food establishment must be carried out by a licensed operator. Remove the product and engage a licensed operator.', PEST),
];

function locations(p) {
  const out = [
    'Kitchen — Cook Line', 'Kitchen — Prep Area', 'Kitchen — Warewashing', 'Walk-in Cooler',
    'Walk-in Freezer', 'Reach-in Cooler', 'Dry Storage', 'Service Line / Pass',
    'Bar Area', 'Wait Station', 'Hand Sink — Kitchen', 'Three-Compartment Sink',
    'Ice Machine', 'Employee Restroom', 'Public Restroom', 'Refuse Area / Dumpster Enclosure',
    'Receiving Area', 'Exterior Premises',
  ];
  if (p.service === 'Buffet / Self Service') out.push('Buffet Line', 'Self-Service Area');
  if (p.type === 'Food Truck / Mobile') out.push('Mobile Unit — Interior', 'Mobile Unit — Exterior', 'Commissary');
  out.push('Throughout the Establishment', 'Multiple Locations');
  return out;
}

export default {
  id: 'restaurant',
  name: 'Restaurant',
  icon: '🍽️',
  tagline: 'Food service health inspection',
  blurb: 'The one that closes kitchens. Temperature control, handwashing, cross-contamination and '
    + 'pests, written the way a health department writes it.',
  docTitle: 'Food Service Establishment Inspection Report',
  subjectLabel: 'Establishment',
  subjectLine: (p) => `${p.name || ''}${p.address ? ` — ${p.address}` : ''}`
    + `${p.city ? `, ${p.city}` : ''}${p.state ? `, ${p.state}` : ''}`,
  subjectSub: (p) => `${p.type} · ${p.riskCategory} · permit ${p.permit} · ${p.staff} staff on duty`,
  clientLabel: 'Person in Charge',
  severities: {
    significant: {
      label: 'Priority Violation (Critical)',
      short: 'Priority',
      blurb: 'Directly controls a hazard known to cause foodborne illness — temperature, '
        + 'handwashing, cross-contamination, chemicals. Correct immediately; triggers a follow-up '
        + 'inspection.',
    },
    marginal: {
      label: 'Priority Foundation Violation',
      short: 'Foundation',
      blurb: 'Supports the controls above — equipment, thermometers, procedures, training, '
        + 'facilities. Correct within the stated timeframe. Most violations land here.',
    },
    minor: {
      label: 'Core Item / Good Retail Practice',
      short: 'Core',
      blurb: 'General sanitation, maintenance, and good practice. Correct by the next routine '
        + 'inspection.',
    },
  },
  costBands: null,
  costNote: '',
  standardsTitle: 'Compliance and Follow-Up',
  standards: () => 'This inspection assessed compliance with the applicable food code at the time of '
    + 'the visit and reflects conditions observed during that visit only. Priority violations require '
    + 'immediate correction and generally trigger a follow-up inspection; priority foundation '
    + 'violations must be corrected within the stated timeframe; core items are to be corrected by '
    + 'the next routine inspection. Repeat violations may result in enforcement action, including '
    + 'permit suspension. The person in charge is responsible for compliance at all times the '
    + 'establishment operates, not only when an inspector is present.',
  intake: INTAKE,
  sections: SECTIONS,
  defects: DEFECTS,
  locations,
  sample: {
    name: 'Newtown Road Diner', address: '8329 Newtown Rd', city: 'Pikesville', state: 'MD',
    permit: 'FS-2026-01188', client: 'Liam Powell', inspector: 'A. Inspector',
    company: 'County Health Department', type: 'Full Service Restaurant',
    riskCategory: 'Category 3 — Extensive preparation', seats: '50-100', staff: 8,
    service: 'Cooked to order', water: 'Public Water', sewage: 'Public Sewer',
    cfpm: 'Yes, on site with certificate', inspectionType: 'Routine', announced: 'Unannounced',
    timeOfDay: 'During lunch service', thermometer: 'Yes, verified on site',
    lastInspection: 'Violations corrected', permitStatus: 'Current and posted',
  },
};
