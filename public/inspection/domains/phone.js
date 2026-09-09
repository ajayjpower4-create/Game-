/* Used phone inspection — buying, selling, or grading a trade-in. */

const D = (section, item, sev, title, body, rec) => ({
  id: `ph.${section}.${item}.${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
  section, item, sev, title, body, rec,
});

const REPAIR = 'Quote a repair before agreeing a price.';
const AUTH = 'Manufacturer or authorised service centre only.';
const SELLER = 'Ask the seller to resolve this before any money changes hands.';
const CARRIER = 'Verify with the carrier before purchase.';
const WALK = 'Recommend walking away from this one.';
const DEDUCT = 'Deduct from the offer.';
const NOTE = 'Note it on the grade.';
const WIPE = 'Resolve with a full factory reset.';

const INTAKE = [
  {
    id: 'device',
    title: 'The Device',
    hint: 'The only part you actually have to type.',
    fields: [
      { id: 'make', label: 'Make', type: 'text', placeholder: 'Apple', required: true },
      { id: 'model', label: 'Model', type: 'text', placeholder: 'iPhone 14 Pro', required: true },
      { id: 'imei', label: 'IMEI / Serial', type: 'text', placeholder: '35xxxxxxxxxxxxx', required: true },
      { id: 'storage', label: 'Storage', type: 'choice', options: ['64GB', '128GB', '256GB', '512GB', '1TB'] },
      { id: 'client', label: 'Client Name', type: 'text', placeholder: 'Liam Powell', required: true },
      { id: 'inspector', label: 'Inspector', type: 'text', placeholder: 'Your name', required: true },
      { id: 'company', label: 'Shop', type: 'text', placeholder: 'Newtown Road Mobile', required: true },
      { id: 'date', label: 'Inspection Date', type: 'date', required: true },
      { id: 'askingPrice', label: 'Asking Price ($)', type: 'number', placeholder: '450', width: 'short' },
    ],
  },
  {
    id: 'status',
    title: 'Status & History',
    hint: 'Click through it — this fills the identification section.',
    fields: [
      { id: 'carrier', label: 'Carrier Status', type: 'choice', options: ['Unlocked', 'Locked to a Carrier', 'Financed / Not Paid Off', 'Unknown'] },
      { id: 'blacklist', label: 'IMEI Blacklist Check', type: 'choice', options: ['Clean', 'Reported Lost or Stolen', 'Not Checked'] },
      { id: 'activationLock', label: 'Activation / Account Lock', type: 'choice', options: ['Removed, signed out', 'Still signed in', 'Locked, owner unavailable'] },
      { id: 'age', label: 'Approximate Age', type: 'choice', options: ['Under 1 year', '1-2 years', '2-3 years', '3-5 years', 'Over 5 years'] },
      { id: 'batteryHealth', label: 'Reported Battery Health', type: 'choice', options: ['Above 90%', '85-90%', '80-85%', 'Below 80%', 'Not Reported / Unavailable'] },
      { id: 'repairs', label: 'Repair History', type: 'choice', options: ['None known, all original parts', 'Screen replaced', 'Battery replaced', 'Multiple parts replaced', 'Unknown'] },
      { id: 'accessories', label: 'Included Accessories', type: 'choice', options: ['Box, cable and case', 'Cable only', 'Nothing included'] },
      { id: 'os', label: 'Software Status', type: 'choice', options: ['Current version', 'One version behind', 'No longer receiving updates', 'Modified / Jailbroken / Rooted'] },
    ],
  },
  {
    id: 'method',
    title: 'How You Checked It',
    hint: 'What you tested decides what the report can claim.',
    fields: [
      { id: 'inspectionType', label: 'Inspection Type', type: 'choice', options: ['Pre-purchase (used)', 'Trade-in Grading', 'Insurance Assessment', 'Repair Intake'] },
      { id: 'poweredOn', label: 'Powered On?', type: 'choice', options: ['Yes, fully booted', 'Yes, but would not complete setup', 'No, would not power on'] },
      { id: 'diagnostics', label: 'Diagnostic App Run?', type: 'choice', options: ['Yes', 'No'] },
      { id: 'simTest', label: 'Tested With a Live SIM?', type: 'choice', options: ['Yes', 'No'] },
      { id: 'chargeTest', label: 'Charge Test Performed?', type: 'choice', options: ['Yes, wired and wireless', 'Yes, wired only', 'No'] },
      { id: 'lighting', label: 'Inspection Lighting', type: 'choice', options: ['Bright, direct light', 'Normal indoor light', 'Poor light'] },
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
      ['Powered On', p.poweredOn],
      ['Diagnostic App Run', p.diagnostics],
      ['Live SIM Test', p.simTest],
      ['Charge Test', p.chargeTest],
      ['Inspection Lighting', p.lighting],
      ['Asking Price', p.askingPrice ? `$${Number(p.askingPrice).toLocaleString('en-US')}` : 'Not stated'],
    ],
    narrative: (p) => [
      {
        title: 'Scope of This Inspection',
        text: 'This is a visual and functional inspection of an assembled handset at a single point in '
          + 'time. The device was not opened, and no internal component was tested. A phone is a sealed '
          + 'assembly, and internal corrosion, a swelling battery, or a partially failed connector can '
          + 'be entirely invisible from the outside until it is not.',
      },
      ...(p.lighting === 'Poor light' ? [{
        title: 'Limitation — Poor Lighting',
        text: 'LMT — The inspection was carried out in poor light. Fine scratches, display '
          + 'discolouration, dead pixels, and hairline cracks are routinely invisible except under '
          + 'bright direct light. Re-inspection in good light before purchase is recommended.',
      }] : []),
      ...(p.simTest === 'No' ? [{
        title: 'Limitation — No Live SIM Test',
        text: 'LMT — The device was not tested with a live SIM. Calling, mobile data, and the '
          + 'cellular antennas could not be verified. A handset that does everything else perfectly can '
          + 'still have a failed cellular modem, which makes it a very expensive iPod.',
      }] : []),
      {
        title: 'Items Not Covered',
        text: 'EXCL — Not covered: the remaining life of the battery or any component, whether the '
          + 'device is subject to a finance agreement not disclosed by the seller, the legitimacy of '
          + 'any part fitted during a prior repair, water resistance (which is never restored after a '
          + 'device is opened), and any data on the device.',
      },
    ],
  },
  {
    id: 'identity',
    title: 'Identification & Lock Status',
    items: [
      { id: 'imei', name: 'IMEI and Blacklist' },
      { id: 'carrier', name: 'Carrier Lock' },
      { id: 'account', name: 'Account / Activation Lock' },
      { id: 'finance', name: 'Finance Status' },
    ],
    info: (p) => [
      ['Make and Model', `${p.make} ${p.model}`],
      ['IMEI / Serial', p.imei],
      ['Storage', p.storage],
      ['Carrier Status', p.carrier],
      ['Blacklist Check', p.blacklist],
      ['Activation Lock', p.activationLock],
      ['Approximate Age', p.age],
      ['Repair History', p.repairs],
    ],
    narrative: () => [
      {
        title: 'Check This First',
        text: 'The lock and blacklist checks are the ones that decide whether the handset is worth '
          + 'anything at all. A blacklisted or account-locked phone is a paperweight regardless of how '
          + 'good the screen looks, and no amount of repair changes that. Verify the IMEI against a '
          + 'blacklist service and confirm the previous owner has signed out completely before any '
          + 'money changes hands.',
      },
    ],
  },
  {
    id: 'display',
    title: 'Display',
    items: [
      { id: 'glass', name: 'Glass Condition' },
      { id: 'panel', name: 'Panel Condition' },
      { id: 'touch', name: 'Touch Response' },
      { id: 'brightness', name: 'Brightness and Colour' },
      { id: 'truetone', name: 'Display Features' },
    ],
    info: () => [],
    narrative: () => [
      {
        title: 'Display Testing',
        text: 'The display was examined at full brightness on a white screen and a black screen, which '
          + 'is how dead pixels, backlight bleed, burn-in, and pressure marks become visible. Touch was '
          + 'tested across the whole panel including the edges, where digitiser faults usually appear '
          + 'first.',
      },
    ],
  },
  {
    id: 'body',
    title: 'Body & Frame',
    items: [
      { id: 'frame', name: 'Frame Condition' },
      { id: 'back', name: 'Rear Glass / Back Panel' },
      { id: 'bend', name: 'Flatness and Bend' },
      { id: 'seams', name: 'Seams and Seals' },
    ],
    info: (p) => [
      ['Repair History', p.repairs],
    ],
    narrative: () => [
      {
        title: 'Cosmetic Grading',
        text: 'Cosmetic condition is graded on how it presents in bright light at arm\'s length: '
          + 'excellent (no visible marks), good (light marks visible on inspection), fair (visible '
          + 'marks at a glance), or poor (damage that affects use). Cosmetic condition does not affect '
          + 'function but drives a large part of resale value.',
      },
    ],
  },
  {
    id: 'battery',
    title: 'Battery & Charging',
    items: [
      { id: 'health', name: 'Battery Health' },
      { id: 'swelling', name: 'Battery Swelling' },
      { id: 'charging', name: 'Wired Charging' },
      { id: 'wireless', name: 'Wireless Charging' },
      { id: 'drain', name: 'Drain Behaviour' },
    ],
    info: (p) => [
      ['Reported Battery Health', p.batteryHealth],
      ['Charge Test', p.chargeTest],
    ],
    narrative: () => [
      {
        title: 'Battery Note',
        text: 'A phone battery is a consumable. Capacity declines from the day the device is '
          + 'manufactured, and a battery is generally considered due for replacement below 80% of its '
          + 'original capacity. Where the handset reports a health figure it is recorded here; that '
          + 'figure is the device\'s own estimate, not a measurement, and it can be manipulated by a '
          + 'non-genuine replacement.',
      },
    ],
  },
  {
    id: 'cameras',
    title: 'Cameras',
    items: [
      { id: 'rear', name: 'Rear Cameras' },
      { id: 'front', name: 'Front Camera' },
      { id: 'lens', name: 'Lens Glass' },
      { id: 'stabilisation', name: 'Focus and Stabilisation' },
      { id: 'flash', name: 'Flash' },
    ],
    info: () => [],
    narrative: () => [
      {
        title: 'Camera Testing',
        text: 'Each camera was used to take a photograph and a short video at every available focal '
          + 'length, and the results were examined at full size. Dust behind a lens, a failed '
          + 'stabiliser, and a camera that will not focus are all invisible until you look at the '
          + 'output rather than the preview.',
      },
    ],
  },
  {
    id: 'audio',
    title: 'Audio, Buttons & Ports',
    items: [
      { id: 'speakers', name: 'Speakers' },
      { id: 'mics', name: 'Microphones' },
      { id: 'earpiece', name: 'Earpiece' },
      { id: 'buttons', name: 'Buttons and Switches' },
      { id: 'port', name: 'Charging Port' },
      { id: 'haptics', name: 'Haptics' },
    ],
    info: () => [],
    narrative: () => [
      {
        title: 'Audio Testing',
        text: 'Speakers were tested with music at full volume, the earpiece on a call or a voice '
          + 'recording, and each microphone with a recording played back. Modern handsets have several '
          + 'microphones and a failure in one of them shows up only in specific uses, such as video '
          + 'recording or noise cancellation on calls.',
      },
    ],
  },
  {
    id: 'connectivity',
    title: 'Connectivity & Sensors',
    items: [
      { id: 'cellular', name: 'Cellular' },
      { id: 'wifi', name: 'Wi-Fi and Bluetooth' },
      { id: 'biometrics', name: 'Fingerprint / Face Unlock' },
      { id: 'sensors', name: 'Sensors' },
      { id: 'gps', name: 'Location and NFC' },
    ],
    info: (p) => [
      ['Live SIM Test', p.simTest],
    ],
    narrative: () => [
      {
        title: 'Sensor Testing',
        text: 'Where a diagnostic app was run, the proximity, ambient light, accelerometer, gyroscope, '
          + 'and compass sensors were exercised. Sensor faults are subtle in daily use — a screen that '
          + 'does not blank against your ear, or a compass that will not settle — and they are '
          + 'frequently not disclosed because the seller never noticed.',
      },
    ],
  },
  {
    id: 'integrity',
    title: 'Water Damage & Repair History',
    items: [
      { id: 'water', name: 'Water Damage Indicators' },
      { id: 'parts', name: 'Non-Genuine Parts' },
      { id: 'evidence', name: 'Evidence of Opening' },
      { id: 'warranty', name: 'Warranty Status' },
    ],
    info: (p) => [
      ['Repair History', p.repairs],
      ['Approximate Age', p.age],
    ],
    narrative: () => [
      {
        title: 'Why Repair History Matters',
        text: 'A properly performed repair with genuine parts is not a defect. A repair with '
          + 'non-genuine parts frequently is: aftermarket displays lose colour accuracy and touch '
          + 'features, aftermarket batteries do not report health honestly, and once a phone has been '
          + 'opened its water resistance is gone regardless of what the original rating was.',
      },
    ],
  },
  {
    id: 'software',
    title: 'Software & Data',
    items: [
      { id: 'version', name: 'Software Version and Support' },
      { id: 'reset', name: 'Reset and Personal Data' },
      { id: 'modified', name: 'Modified Software' },
      { id: 'apps', name: 'Unwanted Software' },
    ],
    info: (p) => [
      ['Software Status', p.os],
      ['Accessories Included', p.accessories],
    ],
    narrative: () => [
      {
        title: 'Support Lifetime',
        text: 'A handset that no longer receives security updates should be priced accordingly. It '
          + 'will keep working, but unpatched vulnerabilities accumulate, and banking and payment apps '
          + 'progressively stop supporting older releases.',
      },
    ],
  },
];

const DEFECTS = [
  D('identity', 'imei', 'significant', 'IMEI Blacklisted — Reported Lost or Stolen',
    'The IMEI returned as blacklisted. A blacklisted handset cannot be activated on a carrier network and cannot be delisted by a buyer. It is worth nothing beyond parts, and it may be somebody else\'s stolen property. Do not buy this device.', WALK),
  D('identity', 'imei', 'marginal', 'IMEI Not Verified',
    'The IMEI was not checked against a blacklist service. This check takes thirty seconds and is the single most important thing to do before handing over money. Verify before purchase.', CARRIER),
  D('identity', 'imei', 'significant', 'IMEI Does Not Match the Device Labelling',
    'The IMEI reported in software did not match the IMEI on the SIM tray, the packaging, or the device labelling. This indicates a replaced board or a device assembled from parts. Do not proceed until the discrepancy is explained.', WALK),
  D('identity', 'carrier', 'marginal', 'Handset Locked to a Carrier',
    'The handset is locked to a carrier network. It will only work with that carrier until it is unlocked, and unlocking generally requires the original account holder to request it. Confirm the unlock before purchase or price the device as carrier-locked.', CARRIER),
  D('identity', 'account', 'significant', 'Activation Lock Still Active',
    'The device is still tied to the previous owner\'s account. In this state it cannot be set up, reset, or used by anyone else, and no repair shop or manufacturer will remove the lock for a second-hand buyer. The seller must sign out completely and remove the device from their account in front of you.', SELLER),
  D('identity', 'account', 'marginal', 'Previous Owner Still Signed In',
    'The previous owner was still signed in on the device. A device handed over in this state can be remotely locked or wiped afterwards. A complete sign-out and factory reset must be performed before the sale completes.', SELLER),
  D('identity', 'finance', 'significant', 'Device Subject to an Unpaid Finance Agreement',
    'The handset appears to be under an active finance or instalment agreement. If the seller stops paying, the carrier blacklists the device — after you have bought it. Confirm the device is paid off in full before purchase.', CARRIER),

  D('display', 'glass', 'significant', 'Display Glass Cracked',
    'The display glass was cracked. Beyond appearance, a cracked screen admits moisture and dust to the panel beneath and the edges are sharp. Screen replacement is one of the more expensive repairs on a phone. Quote the repair before agreeing a price.', REPAIR),
  D('display', 'glass', 'minor', 'Display Glass — Light Scratches',
    'Light scratches were present on the display glass, visible in direct light but not affecting use. This is normal wear and affects the cosmetic grade only.', NOTE),
  D('display', 'glass', 'marginal', 'Display Glass — Deep Scratches or Chips',
    'Deep scratches or chipping were present on the display glass, visible in use. Function is unaffected but the cosmetic grade drops materially, and chips at the edge can propagate into cracks.', DEDUCT),
  D('display', 'panel', 'significant', 'Display — Dead Zone or Panel Failure',
    'The display showed a dead area, a spreading black or discoloured patch, or lines across the panel. The panel has failed and will get worse. Replacement is required.', REPAIR),
  D('display', 'panel', 'marginal', 'Display — Burn-In / Image Retention',
    'Image retention was visible on the panel, typically a faint ghost of the status bar or keyboard. This is permanent on OLED displays and cannot be repaired short of panel replacement. It is most visible on grey backgrounds.', DEDUCT),
  D('display', 'panel', 'marginal', 'Display — Pressure Marks or Discolouration',
    'Pressure marks or discoloured patches were visible on a white background, indicating the panel has been squeezed or impacted. These usually spread over time.', DEDUCT),
  D('display', 'panel', 'minor', 'Display — Dead Pixels',
    'One or more dead or stuck pixels were visible. A small number is cosmetic and does not spread on most panels.', NOTE),
  D('display', 'touch', 'significant', 'Touch — Unresponsive Areas',
    'The touchscreen did not respond in one or more areas. An unresponsive strip along an edge makes the keyboard unusable. Digitiser or display replacement is required.', REPAIR),
  D('display', 'touch', 'marginal', 'Touch — Ghost Input',
    'The display registered touches that were not made. Ghost input makes a phone genuinely unusable at random moments and usually indicates a failing digitiser or a poorly fitted aftermarket display.', REPAIR),
  D('display', 'brightness', 'marginal', 'Display — Uneven Brightness or Colour Tint',
    'Brightness or colour was uneven across the panel. This is common on aftermarket displays and on aged panels.', DEDUCT),
  D('display', 'truetone', 'minor', 'Display Features Disabled After Repair',
    'Adaptive colour or brightness features were unavailable, which typically indicates the display was replaced without transferring the original components. Function is otherwise unaffected but it confirms a non-original display.', NOTE),

  D('body', 'frame', 'marginal', 'Frame — Dents or Heavy Wear',
    'Dents, deep scuffing, or heavy wear were present on the frame, consistent with the device having been dropped. Check carefully for related internal faults — a phone hard enough to dent has been hit hard enough to disturb what is inside.', DEDUCT),
  D('body', 'frame', 'minor', 'Frame — Light Scuffs',
    'Light scuffing was present on the frame edges and corners. Normal wear affecting the cosmetic grade only.', NOTE),
  D('body', 'back', 'marginal', 'Rear Glass Cracked',
    'The rear glass was cracked. On many models the rear glass is bonded to the frame and replacing it costs nearly as much as a screen. Quote the repair before agreeing a price.', REPAIR),
  D('body', 'bend', 'significant', 'Frame Bent or Device Not Flat',
    'The device was bent or did not sit flat on a level surface. A bent frame stresses the display and the board, and it means the internal seals no longer seat. This generally does not get repaired economically.', WALK),
  D('body', 'seams', 'marginal', 'Display or Back Panel Lifting at the Seam',
    'The display or back panel was lifting away from the frame. This is most often caused by a swelling battery pushing the assembly apart, which is a hazard. Have it opened and assessed before the device is charged again.', AUTH),
  D('body', 'seams', 'minor', 'Adhesive Residue at the Seams',
    'Adhesive residue was visible at the seams, indicating the device has been opened. Water resistance should be assumed to be gone.', NOTE),

  D('battery', 'health', 'marginal', 'Battery Health Below Replacement Threshold',
    'The reported battery health was below the 80% threshold at which replacement is generally recommended. The device will not last a full day and will shut down unexpectedly under load or in cold weather. Factor a battery replacement into the price.', REPAIR),
  D('battery', 'health', 'minor', 'Battery Health Reduced',
    'FYI — Battery health was reduced but above the replacement threshold. This is normal for the age of the device. Expect replacement to be needed within the next year or two.', NOTE),
  D('battery', 'health', 'marginal', 'Battery Health Not Reported',
    'The device did not report a battery health figure, which usually means a non-genuine battery has been fitted. A battery that will not report its own health also cannot be trusted on its charge cycle count or its safety circuitry.', DEDUCT),
  D('battery', 'swelling', 'significant', 'Battery Swelling Present',
    'SFTY — The battery is swelling, indicated by a lifting display or back panel or a device that rocks on a flat surface. A swollen lithium battery is a fire risk, must not be charged, and must not be punctured. Have it replaced by a competent repairer before the device is used again.', AUTH),
  D('battery', 'charging', 'significant', 'Device Will Not Charge',
    'The device did not charge with a known-good cable and adapter. Causes range from a dirty or damaged port through to a board-level fault, and the difference in repair cost between those is enormous. Diagnosis before purchase is required.', REPAIR),
  D('battery', 'charging', 'marginal', 'Charging Intermittent or Slow',
    'Charging was intermittent or noticeably slower than expected. A worn or lint-filled port is the usual cause and is often resolved by a careful clean; a failing charge circuit is not.', REPAIR),
  D('battery', 'wireless', 'marginal', 'Wireless Charging Inoperative',
    'Wireless charging did not work with a known-good charger. This commonly indicates a damaged coil after a rear glass repair.', REPAIR),
  D('battery', 'drain', 'marginal', 'Excessive Battery Drain',
    'The battery drained rapidly during the inspection, well beyond what the reported health would suggest. Causes include a failing battery, a fault keeping the device awake, or software installed by the previous owner. A factory reset and re-test is the first step.', WIPE),

  D('cameras', 'rear', 'significant', 'Rear Camera Inoperative',
    'A rear camera did not function or produced no image. Camera modules are a moderate repair on most models, and on some they are tied to other functions. Quote before agreeing a price.', REPAIR),
  D('cameras', 'rear', 'marginal', 'Camera Image Shows Spots or Haze',
    'Photographs showed spots or haze consistent with dust or moisture behind the lens. Once dust is inside the module it does not leave without opening the device.', REPAIR),
  D('cameras', 'front', 'marginal', 'Front Camera Fault',
    'The front camera did not function correctly. On devices where the front camera assembly also carries face unlock hardware, this can affect biometrics as well.', REPAIR),
  D('cameras', 'lens', 'marginal', 'Camera Lens Glass Cracked',
    'The glass covering a camera lens was cracked. This shows up as flare and softness in every photograph taken with that lens. The lens cover is often replaceable separately from the module.', REPAIR),
  D('cameras', 'stabilisation', 'marginal', 'Camera Will Not Focus or Rattles',
    'A camera would not hold focus and/or produced a rattle when the device was shaken, indicating a damaged autofocus or stabilisation assembly. Module replacement is required.', REPAIR),
  D('cameras', 'flash', 'minor', 'Flash Inoperative',
    'The camera flash did not fire. Minor, but on many models the flash shares an assembly with a sensor.', REPAIR),

  D('audio', 'speakers', 'marginal', 'Speaker Distorted or Silent',
    'A speaker was distorted, crackling, or silent at volume. Blocked speaker mesh is sometimes the cause and cleans up; a failed driver does not.', REPAIR),
  D('audio', 'mics', 'marginal', 'Microphone Fault',
    'A microphone did not record or recorded at very low level. Modern handsets use several microphones, and a fault in one may only appear during video recording or on calls with noise cancellation.', REPAIR),
  D('audio', 'earpiece', 'marginal', 'Earpiece Speaker Fault',
    'The earpiece produced no sound or distorted sound on a call, making the device unusable for calls held to the ear.', REPAIR),
  D('audio', 'buttons', 'marginal', 'Button Unresponsive or Sticking',
    'A physical button was unresponsive, sticking, or required excessive pressure. Where the power or volume button has failed, everyday use is genuinely affected.', REPAIR),
  D('audio', 'port', 'marginal', 'Charging Port Damaged or Loose',
    'The charging port was damaged, loose, or the cable did not seat firmly. Port replacement is a common and reasonably priced repair on most models.', REPAIR),
  D('audio', 'port', 'minor', 'Charging Port Contaminated With Lint',
    'The charging port was full of pocket lint, which is the single most common cause of a phone that "will not charge". Careful cleaning with a non-metallic tool usually resolves it entirely.', NOTE),
  D('audio', 'haptics', 'minor', 'Haptics Weak or Inoperative',
    'The vibration motor was weak or did not operate. Minor in isolation, but it can also indicate a device that has been dropped hard.', REPAIR),

  D('connectivity', 'cellular', 'significant', 'No Cellular Service',
    'The device would not register on a network with a known-good active SIM. A failed cellular modem or antenna makes the handset a wifi-only device and is frequently not economically repairable. Do not buy without a live SIM test.', WALK),
  D('connectivity', 'cellular', 'marginal', 'Weak Cellular Reception',
    'The device held a noticeably weaker signal than a comparison handset in the same location, indicating antenna damage — common after a frame impact or a poorly performed repair.', REPAIR),
  D('connectivity', 'wifi', 'marginal', 'Wi-Fi or Bluetooth Fault',
    'Wi-Fi or Bluetooth would not enable, would not hold a connection, or showed very short range. This is usually a board-level fault and is often uneconomic to repair.', REPAIR),
  D('connectivity', 'biometrics', 'marginal', 'Fingerprint or Face Unlock Inoperative',
    'The biometric unlock did not function or could not be enrolled. On several models this hardware is paired to the board at manufacture and cannot be restored by a third-party repair at any price.', AUTH),
  D('connectivity', 'sensors', 'marginal', 'Sensor Fault Detected',
    'A sensor — proximity, ambient light, accelerometer, gyroscope, or compass — failed testing. Symptoms are subtle: a screen that stays lit against your ear, automatic brightness that does nothing, or navigation that will not orient.', REPAIR),
  D('connectivity', 'gps', 'marginal', 'GPS or NFC Inoperative',
    'Location services would not acquire a fix, or contactless payment hardware did not respond. Where NFC has failed, the device cannot be used for contactless payment at all.', REPAIR),

  D('integrity', 'water', 'significant', 'Water Damage Indicator Triggered',
    'The liquid contact indicator had been triggered, confirming the device has been exposed to liquid. Liquid damage progresses through internal corrosion for months afterwards, faults appear unpredictably, and no warranty covers it. Price accordingly or walk away.', WALK),
  D('integrity', 'water', 'marginal', 'Corrosion Visible at the Port or SIM Tray',
    'Corrosion was visible at the charging port or in the SIM tray, indicating liquid exposure regardless of what the indicator shows. Expect further faults to develop.', DEDUCT),
  D('integrity', 'parts', 'marginal', 'Non-Genuine Parts Fitted',
    'The device reported, or physically showed, non-genuine replacement parts. Aftermarket displays and batteries are frequently well below original specification, and non-genuine parts can disable features and complicate any later authorised repair.', DEDUCT),
  D('integrity', 'parts', 'marginal', 'Repair History Not Disclosed',
    'Evidence of a prior repair was present that the seller had not disclosed. What else was done during that repair, and by whom, is unknown. Ask directly and price with the uncertainty in mind.', SELLER),
  D('integrity', 'evidence', 'marginal', 'Device Has Been Opened — Water Resistance Void',
    'The device has been opened, indicated by damaged screws, adhesive residue, or a lifting seam. Water resistance is not restored by a repair unless the seals are properly replaced, and it is generally safest to assume the device now has none.', NOTE),
  D('integrity', 'warranty', 'minor', 'Out of Manufacturer Warranty',
    'FYI — The device is outside its manufacturer warranty. Any failure from here is paid for out of pocket. Normal for a used handset and reflected in the price.', NOTE),

  D('software', 'version', 'marginal', 'No Longer Receiving Security Updates',
    'The device is past the end of its software support window and no longer receives security updates. It will keep working, but unpatched vulnerabilities accumulate and banking and payment apps progressively drop support for older releases. Price accordingly.', NOTE),
  D('software', 'reset', 'significant', 'Device Not Reset — Personal Data Present',
    'The device still contained the previous owner\'s data and accounts. It must not change hands in this state — for their privacy and for your protection. A full factory reset with all accounts signed out is required before the sale completes.', SELLER),
  D('software', 'modified', 'marginal', 'Modified System Software',
    'The device was running modified system software (jailbroken or rooted). This voids warranty, blocks security updates, and causes banking and payment apps to refuse to run. Restoring to stock software before purchase is recommended.', WIPE),
  D('software', 'apps', 'marginal', 'Unwanted or Monitoring Software Present',
    'Software was present consistent with monitoring or unwanted background activity. A full factory reset is required before the device is used.', WIPE),
];

function locations() {
  return [
    'Display', 'Display — Top Edge', 'Display — Bottom Edge', 'Display — Corner',
    'Rear Glass', 'Frame — Left', 'Frame — Right', 'Frame — Top', 'Frame — Bottom',
    'Corner — Top Left', 'Corner — Top Right', 'Corner — Bottom Left', 'Corner — Bottom Right',
    'Charging Port', 'SIM Tray', 'Rear Camera Array', 'Front Camera', 'Speaker Grille',
    'Throughout the Device', 'Multiple Locations',
  ];
}

export default {
  id: 'phone',
  name: 'Used Phone',
  icon: '📱',
  tagline: 'Pre-purchase and trade-in grading',
  blurb: 'The checks that decide whether a second-hand handset is a bargain or a brick — blacklist, '
    + 'activation lock, battery health, and the panel faults you only see in bright light.',
  docTitle: 'Device Inspection & Grading Report',
  subjectLabel: 'Device',
  subjectLine: (p) => `${p.make || ''} ${p.model || ''}`.trim(),
  subjectSub: (p) => `${p.storage} · IMEI ${p.imei} · ${p.carrier} · battery ${p.batteryHealth}`,
  clientLabel: 'Client',
  severities: {
    significant: {
      label: 'Fails — Do Not Buy at Any Price',
      short: 'Fails',
      blurb: 'Locked, blacklisted, unsafe, or broken beyond economic repair. Walk away or resolve '
        + 'it with the seller first.',
    },
    marginal: {
      label: 'Deduct — Needs Repair',
      short: 'Deduct',
      blurb: 'A fault or a worn part that costs money to put right. Price it in. Most findings '
        + 'land here.',
    },
    minor: {
      label: 'Cosmetic / Note',
      short: 'Note',
      blurb: 'Wear that affects the grade but not the function, and things worth knowing.',
    },
  },
  costBands: { significant: [120, 500], marginal: [40, 180], minor: [0, 30] },
  costNote: 'Repair pricing varies by model and by whether genuine parts are used.',
  standardsTitle: 'Scope and Limitations',
  standards: () => 'This was a visual and functional inspection of a sealed handset at a single point '
    + 'in time. The device was not opened and no internal component was tested. This report is not a '
    + 'warranty, a guarantee of future reliability, or a valuation, and it is provided for the '
    + 'exclusive use of the client named above. Internal corrosion and battery condition in '
    + 'particular can be entirely invisible from the outside.',
  intake: INTAKE,
  sections: SECTIONS,
  defects: DEFECTS,
  locations,
  sample: {
    make: 'Apple', model: 'iPhone 14 Pro', imei: '356789102345678', storage: '256GB',
    client: 'Liam Powell', inspector: 'A. Inspector', company: 'Newtown Road Mobile',
    askingPrice: '450', carrier: 'Unlocked', blacklist: 'Clean',
    activationLock: 'Removed, signed out', age: '2-3 years', batteryHealth: '80-85%',
    repairs: 'Screen replaced', accessories: 'Cable only', os: 'Current version',
    inspectionType: 'Pre-purchase (used)', poweredOn: 'Yes, fully booted', diagnostics: 'Yes',
    simTest: 'Yes', chargeTest: 'Yes, wired and wireless', lighting: 'Bright, direct light',
  },
};
