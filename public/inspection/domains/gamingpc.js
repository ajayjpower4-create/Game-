/* Gaming PC inspection — buying a used build, or QC on one you just assembled. */

const D = (section, item, sev, title, body, rec) => ({
  id: `pc.${section}.${item}.${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
  section, item, sev, title, body, rec,
});

const TECH = 'Have a qualified technician address this.';
const DIY = 'Owner-serviceable with basic tools.';
const RMA = 'Check warranty status and RMA the part if it is covered.';
const REPLACE = 'Budget for replacing this component.';
const SELLER = 'Ask the seller for the receipt, warranty, or an explanation.';
const CLEAN = 'A cleaning and reassembly service resolves this.';
const BIOS = 'Resolve in BIOS/UEFI or with a firmware update.';
const OS = 'Resolve with a clean operating system install.';
const MONITOR = 'Recommend monitoring under load.';
const SHOP = 'Return to the builder or retailer.';

const INTAKE = [
  {
    id: 'system',
    title: 'The System',
    hint: 'The only part you actually have to type.',
    fields: [
      { id: 'buildName', label: 'System Name / Listing Title', type: 'text', placeholder: 'Ryzen 7 / RTX 4070 gaming build', required: true },
      { id: 'cpu', label: 'CPU', type: 'text', placeholder: 'Ryzen 7 5800X', required: true },
      { id: 'gpu', label: 'Graphics Card', type: 'text', placeholder: 'RTX 4070 12GB', required: true },
      { id: 'motherboard', label: 'Motherboard', type: 'text', placeholder: 'B550 Tomahawk' },
      { id: 'psu', label: 'Power Supply', type: 'text', placeholder: 'Corsair RM750 80+ Gold' },
      { id: 'client', label: 'Client Name', type: 'text', placeholder: 'Liam Powell', required: true },
      { id: 'inspector', label: 'Inspector / Technician', type: 'text', placeholder: 'Your name', required: true },
      { id: 'company', label: 'Shop', type: 'text', placeholder: 'Newtown Road PC Repair', required: true },
      { id: 'date', label: 'Inspection Date', type: 'date', required: true },
      { id: 'askingPrice', label: 'Asking Price ($)', type: 'number', placeholder: '900', width: 'short' },
    ],
  },
  {
    id: 'spec',
    title: 'The Specification',
    hint: 'Click through it — this fills the specification section.',
    fields: [
      { id: 'ramCapacity', label: 'Memory Capacity', type: 'choice', options: ['8GB', '16GB', '32GB', '64GB', '128GB'] },
      { id: 'ramType', label: 'Memory Type', type: 'choice', options: ['DDR4', 'DDR5', 'DDR3 (legacy)'] },
      { id: 'ramSticks', label: 'Memory Sticks Installed', type: 'counter', min: 1, max: 8, value: 2 },
      { id: 'storagePrimary', label: 'Primary Drive', type: 'choice', options: ['NVMe SSD', 'SATA SSD', 'Hard Drive (HDD)'] },
      { id: 'storageCount', label: 'Drives Installed', type: 'counter', min: 1, max: 6, value: 2 },
      { id: 'psuWattage', label: 'PSU Wattage', type: 'choice', options: ['Under 450W', '450-550W', '550-650W', '650-750W', '750-850W', '850W-1000W', 'Over 1000W', 'Not Marked'] },
      { id: 'psuRating', label: 'PSU Efficiency Rating', type: 'choice', options: ['80+ Titanium', '80+ Platinum', '80+ Gold', '80+ Bronze', '80+ White', 'Unrated / Generic'] },
      { id: 'cpuCooler', label: 'CPU Cooling', type: 'choice', options: ['Stock Air Cooler', 'Aftermarket Air Tower', '240mm AIO Liquid', '360mm AIO Liquid', 'Custom Loop'] },
      { id: 'caseFans', label: 'Case Fans Installed', type: 'counter', min: 0, max: 10, value: 3 },
      { id: 'caseType', label: 'Case Type', type: 'choice', options: ['Mid Tower, Mesh Front', 'Mid Tower, Solid Front', 'Full Tower', 'Small Form Factor / ITX', 'Open Frame / Test Bench'] },
      { id: 'os', label: 'Operating System', type: 'choice', options: ['Windows 11', 'Windows 10', 'Linux', 'No OS Installed', 'Unactivated Windows'] },
      { id: 'age', label: 'Approximate Build Age', type: 'choice', options: ['Under 1 year', '1-2 years', '2-4 years', '4-6 years', 'Over 6 years', 'Unknown'] },
    ],
  },
  {
    id: 'method',
    title: 'How You Tested It',
    hint: 'What you ran decides what the report can claim.',
    fields: [
      { id: 'inspectionType', label: 'Inspection Type', type: 'choice', options: ['Pre-purchase (used)', 'New Build QC', 'Fault Diagnosis', 'Upgrade Assessment', 'Warranty Check'] },
      { id: 'opened', label: 'Side Panel Removed?', type: 'choice', options: ['Yes, fully inspected inside', 'Yes, brief look only', 'No, sealed system'] },
      { id: 'poweredOn', label: 'Powered On and Booted?', type: 'choice', options: ['Yes, booted to desktop', 'Yes, POST only', 'No, not powered'] },
      { id: 'stressTest', label: 'Stress Test Run', type: 'choice', options: ['CPU and GPU, 30+ minutes', 'CPU and GPU, short run', 'Gaming workload only', 'None'] },
      { id: 'benchmark', label: 'Benchmark Run', type: 'choice', options: ['Yes, compared against expected scores', 'Yes, no comparison', 'No'] },
      { id: 'smart', label: 'Drive SMART Data Read?', type: 'choice', options: ['Yes', 'No'] },
      { id: 'memtest', label: 'Memory Test Run?', type: 'choice', options: ['Yes, full pass', 'Yes, partial', 'No'] },
      { id: 'thermals', label: 'Thermals Logged?', type: 'choice', options: ['Yes', 'No'] },
      { id: 'ambient', label: 'Ambient Room Temperature', type: 'choice', options: ['Cool (under 20C / 68F)', 'Normal (20-25C / 68-77F)', 'Warm (over 25C / 77F)'] },
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
      ['Side Panel Removed', p.opened],
      ['Powered On', p.poweredOn],
      ['Stress Test', p.stressTest],
      ['Benchmark', p.benchmark],
      ['Memory Test', p.memtest],
      ['Drive SMART Data', p.smart],
      ['Ambient Temperature', p.ambient],
      ['Asking Price', p.askingPrice ? `$${Number(p.askingPrice).toLocaleString('en-US')}` : 'Not stated'],
    ],
    narrative: (p) => [
      {
        title: 'Scope of This Inspection',
        text: 'This is a visual and functional inspection of an assembled computer at a single point '
          + 'in time. Components were identified, the system was powered where possible, and the '
          + 'tests listed above were run. No component was desoldered, no board was inspected under '
          + 'magnification, and no part was tested to destruction. Electronics fail without warning, '
          + 'and a system that passes every test today can fail next week.',
      },
      ...(p.opened === 'No, sealed system' ? [{
        title: 'Limitation — System Not Opened',
        text: 'LMT — The side panel was not removed. Component identification rests on software '
          + 'reporting, which can be spoofed, and the condition of the interior — dust loading, cable '
          + 'routing, thermal paste age, capacitor condition, and physical damage — could not be '
          + 'assessed. An internal inspection is strongly recommended before purchase.',
      }] : []),
      ...(p.stressTest === 'None' ? [{
        title: 'Limitation — No Stress Test',
        text: 'LMT — No sustained load test was run. Thermal throttling, unstable overclocks, power '
          + 'supply faults under load, and marginal cooling only appear once the system has been held '
          + 'at load for twenty minutes or more. A system that idles at the desktop tells you almost '
          + 'nothing about how it behaves in a game.',
      }] : []),
      ...(p.smart === 'No' ? [{
        title: 'Limitation — No Drive Health Data',
        text: 'LMT — SMART data was not read from the storage devices. Drive wear, reallocated '
          + 'sectors, and total bytes written are invisible without it, and a drive at the end of its '
          + 'endurance rating looks identical to a new one from the outside.',
      }] : []),
      {
        title: 'Items Not Covered',
        text: 'EXCL — Not covered: the remaining life of any component, the legitimacy of any '
          + 'software licence beyond its activation state, data recovery or the condition of any data '
          + 'on the drives, the provenance of the parts, and whether any component was previously '
          + 'used for sustained cryptocurrency mining, which cannot be determined with certainty from '
          + 'an inspection.',
      },
    ],
  },
  {
    id: 'spec',
    title: 'Specification & Identification',
    items: [
      { id: 'identity', name: 'Component Identification' },
      { id: 'balance', name: 'System Balance' },
      { id: 'listing', name: 'Listing Accuracy' },
      { id: 'warranty', name: 'Warranty and Provenance' },
    ],
    info: (p) => [
      ['CPU', p.cpu],
      ['Graphics Card', p.gpu],
      ['Motherboard', p.motherboard || 'Not identified'],
      ['Memory', `${p.ramCapacity} ${p.ramType}, ${p.ramSticks} stick(s)`],
      ['Primary Storage', p.storagePrimary],
      ['Drives Installed', String(p.storageCount)],
      ['Power Supply', `${p.psu || 'Not identified'} — ${p.psuWattage}, ${p.psuRating}`],
      ['CPU Cooling', p.cpuCooler],
      ['Case', p.caseType],
      ['Operating System', p.os],
      ['Approximate Age', p.age],
    ],
    narrative: () => [
      {
        title: 'Identification Method',
        text: 'Components were identified from the physical parts where the system was opened, and '
          + 'cross-checked against what the operating system reported. Where the two disagree, the '
          + 'physical part governs and the discrepancy is reported below.',
      },
      {
        title: 'Value Note',
        text: 'FYI — Any comment on price in this report compares the parts against typical used '
          + 'market pricing at the time of inspection. Component prices move constantly, and a fair '
          + 'price this month may not be a fair price next month.',
      },
    ],
  },
  {
    id: 'case',
    title: 'Case, Airflow & Assembly',
    items: [
      { id: 'dust', name: 'Dust and Cleanliness' },
      { id: 'cables', name: 'Cable Management' },
      { id: 'airflow', name: 'Airflow Configuration' },
      { id: 'mounting', name: 'Component Mounting' },
      { id: 'panels', name: 'Panels and Physical Condition' },
      { id: 'standoffs', name: 'Standoffs and Screws' },
    ],
    info: (p) => [
      ['Case Type', p.caseType],
      ['Case Fans Installed', String(p.caseFans)],
    ],
    narrative: () => [
      {
        title: 'Assembly Quality',
        text: 'The interior was examined for assembly quality: whether the board is properly '
          + 'standoffed, whether cables are routed clear of fans, whether every component is screwed '
          + 'down rather than resting in place, and whether the intake and exhaust are configured to '
          + 'actually move air through the case. Poor assembly is not just untidy — it raises '
          + 'temperatures and shortens component life.',
      },
    ],
  },
  {
    id: 'psu',
    title: 'Power Supply',
    items: [
      { id: 'capacity', name: 'Capacity and Headroom' },
      { id: 'quality', name: 'Unit Quality and Age' },
      { id: 'cables', name: 'Power Cables and Connectors' },
      { id: 'condition', name: 'Physical Condition' },
    ],
    info: (p) => [
      ['Rated Wattage', p.psuWattage],
      ['Efficiency Rating', p.psuRating],
      ['Unit', p.psu || 'Not identified'],
    ],
    narrative: () => [
      {
        title: 'Why the Power Supply Matters Most',
        text: 'The power supply is the one component whose failure can take the rest of the system '
          + 'with it. It is also the component builders most often economise on. Capacity, age, '
          + 'efficiency rating, and connector condition were assessed. The unit was not opened, load '
          + 'tested on a bench, or measured for ripple; those tests require equipment beyond the scope '
          + 'of this inspection.',
      },
    ],
  },
  {
    id: 'motherboard',
    title: 'Motherboard',
    items: [
      { id: 'physical', name: 'Board Physical Condition' },
      { id: 'capacitors', name: 'Capacitors and VRM' },
      { id: 'socket', name: 'CPU Socket' },
      { id: 'slots', name: 'Slots and Ports' },
      { id: 'bios', name: 'BIOS / UEFI' },
      { id: 'battery', name: 'CMOS Battery' },
      { id: 'headers', name: 'Front Panel and Headers' },
    ],
    info: (p) => [
      ['Motherboard', p.motherboard || 'Not identified'],
    ],
    narrative: () => [
      {
        title: 'Board Inspection',
        text: 'The board was examined visually for burnt or discoloured areas, bulging or leaking '
          + 'capacitors, damaged sockets and slots, bent pins, and evidence of liquid exposure. A '
          + 'board that boots can still carry damage that limits its life, and a board is the one part '
          + 'that cannot be swapped without dismantling the entire system.',
      },
    ],
  },
  {
    id: 'cpu',
    title: 'CPU & Cooling',
    items: [
      { id: 'cooler', name: 'Cooler Mounting and Condition' },
      { id: 'paste', name: 'Thermal Interface Material' },
      { id: 'temps', name: 'CPU Temperatures' },
      { id: 'clocks', name: 'Clock Behaviour and Throttling' },
      { id: 'overclock', name: 'Overclock and Voltage Settings' },
      { id: 'socket', name: 'Socket and Pins' },
    ],
    info: (p) => [
      ['CPU', p.cpu],
      ['Cooling', p.cpuCooler],
      ['Thermals Logged', p.thermals],
      ['Ambient', p.ambient],
    ],
    narrative: () => [
      {
        title: 'Thermal Assessment',
        text: 'Where a load test was run, CPU package temperature was logged at idle and under '
          + 'sustained load and compared against the manufacturer maximum. Ambient room temperature '
          + 'directly affects every reading in this section — a system tested in a cool room will run '
          + 'hotter in a warm one, and every figure here should be read with the stated ambient in '
          + 'mind.',
      },
    ],
  },
  {
    id: 'memory',
    title: 'Memory',
    items: [
      { id: 'capacity', name: 'Capacity and Configuration' },
      { id: 'speed', name: 'Speed and Profile' },
      { id: 'stability', name: 'Memory Stability' },
      { id: 'seating', name: 'Seating and Slot Population' },
    ],
    info: (p) => [
      ['Capacity', `${p.ramCapacity} ${p.ramType}`],
      ['Sticks Installed', String(p.ramSticks)],
      ['Memory Test', p.memtest],
    ],
    narrative: () => [
      {
        title: 'Memory Testing',
        text: 'Where a memory test was run, the modules were tested for errors. Memory faults present '
          + 'as random crashes, corrupted files, and blue screens that appear to have no pattern, and '
          + 'they are frequently misdiagnosed as software problems for months before anyone tests the '
          + 'memory.',
      },
    ],
  },
  {
    id: 'gpu',
    title: 'Graphics Card',
    items: [
      { id: 'physical', name: 'Card Physical Condition' },
      { id: 'fans', name: 'GPU Fans and Cooler' },
      { id: 'temps', name: 'GPU Temperatures' },
      { id: 'performance', name: 'GPU Performance' },
      { id: 'sag', name: 'Mounting and Sag' },
      { id: 'output', name: 'Display Output' },
      { id: 'history', name: 'Usage History Indicators' },
    ],
    info: (p) => [
      ['Graphics Card', p.gpu],
      ['Benchmark', p.benchmark],
      ['Thermals Logged', p.thermals],
    ],
    narrative: () => [
      {
        title: 'Graphics Card Evaluation',
        text: 'The card was examined physically and, where a benchmark was run, its scores were '
          + 'compared against typical results for the model. A card scoring well below expectation is '
          + 'either thermally limited, power limited, or not the card it claims to be.',
      },
      {
        title: 'Mining History Limitation',
        text: 'LMT — Whether a graphics card was previously used for sustained cryptocurrency '
          + 'mining cannot be determined with certainty from an inspection. Indicators exist — a '
          + 'non-standard BIOS, replaced thermal pads, fan wear inconsistent with the card age, or '
          + 'heavy dust in a card sold as lightly used — and any found are noted below. Absence of '
          + 'indicators is not proof of absence.',
      },
    ],
  },
  {
    id: 'storage',
    title: 'Storage',
    items: [
      { id: 'health', name: 'Drive Health (SMART)' },
      { id: 'capacity', name: 'Capacity and Free Space' },
      { id: 'performance', name: 'Drive Performance' },
      { id: 'data', name: 'Existing Data' },
      { id: 'mounting', name: 'Drive Mounting and Cabling' },
    ],
    info: (p) => [
      ['Primary Drive', p.storagePrimary],
      ['Drives Installed', String(p.storageCount)],
      ['SMART Data Read', p.smart],
    ],
    narrative: () => [
      {
        title: 'Drive Health',
        text: 'Where SMART data was read, drive health was assessed from power-on hours, total bytes '
          + 'written against the drive endurance rating, reallocated and pending sectors, and any '
          + 'logged errors. SMART is an indicator, not a guarantee: drives fail without ever raising a '
          + 'SMART warning, which is why backups exist.',
      },
    ],
  },
  {
    id: 'stability',
    title: 'Stability & Performance',
    items: [
      { id: 'stress', name: 'Sustained Load Behaviour' },
      { id: 'crashes', name: 'Crashes and Errors' },
      { id: 'benchmarks', name: 'Benchmark Results' },
      { id: 'boot', name: 'Boot Behaviour' },
      { id: 'noise', name: 'Noise Under Load' },
    ],
    info: (p) => [
      ['Stress Test', p.stressTest],
      ['Benchmark', p.benchmark],
      ['Powered On', p.poweredOn],
    ],
    narrative: () => [
      {
        title: 'Stability Testing',
        text: 'Where a load test was run, the system was held under combined CPU and GPU load while '
          + 'temperatures, clock speeds, and stability were monitored. Passing a stress test does not '
          + 'guarantee stability in every workload — some faults only appear under specific '
          + 'instruction mixes — but failing one is conclusive.',
      },
    ],
  },
  {
    id: 'software',
    title: 'Operating System & Software',
    items: [
      { id: 'activation', name: 'OS Activation and Licence' },
      { id: 'condition', name: 'OS Condition' },
      { id: 'drivers', name: 'Drivers and Firmware' },
      { id: 'security', name: 'Security and Unwanted Software' },
      { id: 'accounts', name: 'Accounts and Personal Data' },
    ],
    info: (p) => [
      ['Operating System', p.os],
    ],
    narrative: () => [
      {
        title: 'Software Recommendation',
        text: 'On any second-hand system, a clean operating system install is recommended before the '
          + 'machine is used for anything that matters. You do not know what was installed, what was '
          + 'configured, or what is still running on a machine somebody else set up, and a clean '
          + 'install costs an hour and removes all of that doubt.',
      },
    ],
  },
  {
    id: 'peripherals',
    title: 'Ports, Peripherals & Included Items',
    items: [
      { id: 'reario', name: 'Rear I/O Ports' },
      { id: 'frontio', name: 'Front Panel Ports' },
      { id: 'network', name: 'Network and Wireless' },
      { id: 'audio', name: 'Audio' },
      { id: 'included', name: 'Included Accessories' },
    ],
    info: () => [],
    narrative: () => [
      {
        title: 'Port Testing',
        text: 'A representative number of ports were tested with a known-good device. Not every port '
          + 'on every header was exercised, and a port that is not tested is not reported on.',
      },
    ],
  },
  {
    id: 'safety',
    title: 'Electrical Safety',
    items: [
      { id: 'cable', name: 'Mains Cable and Plug' },
      { id: 'grounding', name: 'Grounding' },
      { id: 'modifications', name: 'Modifications' },
      { id: 'liquid', name: 'Liquid Cooling Safety' },
    ],
    info: () => [],
    narrative: () => [
      {
        title: 'Safety Note',
        text: 'A computer is a mains-powered appliance. The power supply contains capacitors that '
          + 'hold a charge after the machine is unplugged and must never be opened by a user. Any '
          + 'finding in this section should be resolved before the system is put into regular use.',
      },
    ],
  },
];

const DEFECTS = [
  /* spec */
  D('spec', 'identity', 'significant', 'Component Does Not Match the Listing',
    'A component installed in the system does not match what was advertised or what the seller stated. This is the single most common problem with used system purchases — a lower-tier graphics card or CPU than described, or less memory than listed. Confirm every component physically before money changes hands.', SELLER),
  D('spec', 'identity', 'marginal', 'Software Reporting Differs From Physical Parts',
    'What the operating system reported did not match the physical components found. Software reporting can be edited, and a modified system information display is a known trick in used system sales. The physical parts govern.', SELLER),
  D('spec', 'balance', 'marginal', 'System Is Heavily CPU Bottlenecked',
    'The processor is significantly weaker than the graphics card, which means the graphics card cannot deliver the frame rates it is capable of. The system will still game acceptably, but the buyer is paying for graphics performance they will not receive until the CPU is upgraded. Factor this into the price.', REPLACE),
  D('spec', 'balance', 'marginal', 'Graphics Card Is the Weak Link',
    'The graphics card is significantly weaker than the rest of the system. For gaming, the graphics card is the component that matters most, and this build will be limited by it. A card upgrade is the single most effective improvement available to this system.', REPLACE),
  D('spec', 'balance', 'minor', 'Memory Capacity Below Current Expectations',
    'FYI — Memory capacity is below what current games and applications comfortably use. Adding memory is inexpensive and is usually the best value upgrade available. Confirm the board has free slots and what speed the existing modules run at before buying.', DIY),
  D('spec', 'listing', 'marginal', 'Asking Price Above Used Market Value',
    'The asking price is above what the components are typically worth on the used market, taking their age and condition into account. The individual part values, not the original build cost, set what a used system is worth. Renegotiation is recommended.', SELLER),
  D('spec', 'warranty', 'minor', 'No Receipts or Warranty Documentation',
    'No purchase receipts or warranty documentation were provided. Most component warranties are honoured against the original purchase, so without receipts any remaining coverage on the graphics card, power supply, or drives is effectively unavailable to a second owner.', SELLER),
  D('spec', 'warranty', 'minor', 'Components Are Out of Warranty',
    'FYI — Based on the build age, the major components are outside their manufacturer warranty periods. Any failure from here is paid for out of pocket. This is normal for a used system and should be reflected in the price.', MONITOR),

  /* case */
  D('case', 'dust', 'marginal', 'Heavy Dust Accumulation Throughout',
    'Heavy dust loading was present on the heatsinks, fans, and filters. Dust insulates every surface it settles on, and a dusty system runs hotter, throttles sooner, and runs its fans faster and louder. A full clean-out with compressed air is recommended, and heavy dust in a system advertised as lightly used is worth asking about.', CLEAN),
  D('case', 'dust', 'minor', 'Dust Filters Clogged',
    'The intake dust filters were clogged, which starves the case of intake air and raises every temperature in the system. Filters should be washed or vacuumed every few months. Cleaning is recommended.', DIY),
  D('case', 'dust', 'minor', 'Pet Hair Present in Cooling System',
    'Pet hair was present in the heatsinks and fans. Hair mats into heatsink fins far more stubbornly than dust and generally requires cooler removal to clear properly. A cleaning service is recommended.', CLEAN),
  D('case', 'cables', 'marginal', 'Cable Contacting a Fan',
    'A cable was routed against a spinning fan. This produces noise, wears through the cable insulation, and can stop the fan entirely — which, on a CPU or GPU cooler, means a thermal shutdown. Rerouting and securing the cable is recommended.', DIY),
  D('case', 'cables', 'minor', 'Cable Management Obstructs Airflow',
    'Cables were routed across the airflow path rather than behind the motherboard tray. This raises temperatures and makes future service harder. Rerouting is recommended.', DIY),
  D('case', 'cables', 'marginal', 'Unused Power Cables Loose Inside the Case',
    'Unused modular power cables were left loose inside the case, where connectors can contact the board or fall into a fan. Removing unused cables from a modular supply is recommended.', DIY),
  D('case', 'airflow', 'marginal', 'Fan Direction Configured Incorrectly',
    'One or more case fans were installed backwards, so that intake and exhaust fight each other rather than moving air through the case. This is a five minute fix that can drop internal temperatures noticeably. Reorienting the affected fans is recommended.', DIY),
  D('case', 'airflow', 'marginal', 'Insufficient Case Ventilation',
    'The case has too few fans, or a restrictive front panel, for the hardware installed in it. Components dump their heat into the case, and if the case cannot exhaust that heat, everything inside slowly cooks. Additional intake and exhaust fans are recommended.', DIY),
  D('case', 'airflow', 'minor', 'Negative Pressure Configuration — Dust Ingress',
    'FYI — The case runs more exhaust than intake, which pulls unfiltered air in through every gap in the chassis and accelerates dust buildup. A slightly positive pressure configuration keeps the interior cleaner. Adding intake is recommended.', DIY),
  D('case', 'mounting', 'significant', 'Component Not Secured — Resting in Place',
    'A component was resting in its slot without being screwed down. An unsecured graphics card or drive moves in transit and can crack a slot, short against the chassis, or fall out entirely. Securing every component before the system is moved is required.', DIY),
  D('case', 'mounting', 'marginal', 'Drive Mounted Without Screws',
    'A storage drive was mounted without its screws or was hanging by its cables. Mechanical hard drives in particular are damaged by vibration and impact. Proper mounting is recommended.', DIY),
  D('case', 'panels', 'minor', 'Case Damage — Cosmetic',
    'Cosmetic damage was present to the case — dents, scratches, a cracked panel, or missing feet. This does not affect function. Repair or replacement as desired.', DIY),
  D('case', 'panels', 'marginal', 'Tempered Glass Panel Cracked',
    'A tempered glass side panel was cracked or chipped. Tempered glass fails all at once rather than progressively, and a chipped panel will eventually shatter. Replacement is recommended.', DIY),
  D('case', 'standoffs', 'significant', 'Motherboard Standoff Missing or Misplaced',
    'A motherboard standoff was missing, or an extra standoff was contacting the underside of the board where no mounting hole exists. A misplaced standoff shorts the board against the chassis and can destroy it. Correction is required before the system is powered again.', TECH),
  D('case', 'standoffs', 'minor', 'Mounting Screws Missing',
    'Mounting screws were missing from the motherboard, expansion slots, or drive cages. Fitting the correct screws is recommended so components are properly supported.', DIY),

  /* psu */
  D('psu', 'capacity', 'significant', 'Power Supply Undersized for the Hardware',
    'The power supply is rated below what the installed components draw at peak. An undersized supply causes shutdowns under load, instability that is easily misdiagnosed as a graphics or memory fault, and, when it fails, can take other components with it. Replacement with an adequately rated unit is required before the system is used under load.', REPLACE),
  D('psu', 'capacity', 'marginal', 'Power Supply Has Minimal Headroom',
    'The power supply is adequate for the current hardware but has little headroom, which rules out a future graphics card upgrade and leaves the unit running near its limit — where it is least efficient and hottest. Budgeting for a larger unit alongside any upgrade is recommended.', REPLACE),
  D('psu', 'quality', 'significant', 'Unrated or Unknown-Brand Power Supply',
    'The power supply is an unrated or generic unit. Units of this class frequently do not deliver their claimed wattage, lack proper over-current and over-voltage protection, and are the most common cause of a failure that damages other components. Replacement with a reputable unit carrying at least an 80+ Bronze rating is strongly recommended.', REPLACE),
  D('psu', 'quality', 'marginal', 'Power Supply Aged Beyond Typical Service Life',
    'AGED — The power supply is beyond the typical service life for the class. The capacitors inside a supply degrade with heat and time whether or not the unit is used, and the supply is the component whose failure is most likely to damage others. Replacement is recommended.', REPLACE),
  D('psu', 'cables', 'significant', 'Mixed Modular Cables From Different Units',
    'The modular cables in use do not appear to be the set supplied with this power supply. Modular cable pinouts are not standardised between manufacturers or even between model ranges, and using the wrong cable can put twelve volts onto a five volt line and destroy every component connected to it. Verify every cable against the correct set before powering the system.', TECH),
  D('psu', 'cables', 'marginal', 'Graphics Card Powered by a Daisy-Chained Cable',
    'The graphics card was powered through a single daisy-chained cable rather than separate cables from the supply. On a high draw card this loads one cable beyond its comfortable rating and causes connector heating and instability under load. Running separate cables is recommended.', DIY),
  D('psu', 'cables', 'significant', 'Power Connector Showing Heat Damage',
    'A power connector showed discolouration, melting, or scorching consistent with heat damage. This indicates a poor connection carrying high current, and it progresses to a fire risk. The affected cable and, where present, the affected component connector must be evaluated and replaced before the system is powered again.', TECH),
  D('psu', 'cables', 'marginal', 'Power Connector Not Fully Seated',
    'A power connector was not fully seated in its socket. A partially seated high current connector arcs and overheats. Reseating every power connector until it clicks is required.', DIY),
  D('psu', 'condition', 'marginal', 'Power Supply Fan Noisy or Not Spinning',
    'The power supply fan was noisy or did not spin under load. A supply that cannot cool itself will fail. Replacement of the unit is recommended — the fan is not a user-serviceable part, because the interior of a supply holds a dangerous charge even when unplugged.', REPLACE),
  D('psu', 'condition', 'minor', 'Power Supply Intake Obstructed',
    'The power supply intake was obstructed, either by its mounting orientation against a carpeted floor or by a blocked filter. Ensuring a clear intake path is recommended.', DIY),

  /* motherboard */
  D('motherboard', 'capacitors', 'significant', 'Bulging or Leaking Capacitors Present',
    'Capacitors on the board were bulging, vented, or leaking. This is unambiguous end-of-life for the board — instability follows, and then failure. Board replacement is required, which on most systems means replacing the CPU and memory as well.', REPLACE),
  D('motherboard', 'physical', 'significant', 'Burn Marks or Scorching on the Board',
    'Burnt or scorched areas were present on the motherboard. Something has already failed electrically. The board must not be powered again until a technician has evaluated it, and replacement should be assumed.', TECH),
  D('motherboard', 'physical', 'marginal', 'Evidence of Liquid Exposure',
    'Residue or corrosion consistent with liquid exposure was present on the board. Liquid damage progresses through continued corrosion long after the board appears to be working. Full evaluation is recommended and replacement should be anticipated.', TECH),
  D('motherboard', 'physical', 'marginal', 'Board Flex or Physical Damage',
    'The board showed flexing, a cracked solder joint area, or physical damage. Cracks in a board propagate and produce faults that appear random. Evaluation is recommended.', TECH),
  D('motherboard', 'socket', 'significant', 'Bent Pins in the CPU Socket',
    'Bent pins were present in the CPU socket or on the processor. Bent pins cause missing memory channels, PCIe lanes that will not train, and no-boot conditions. Straightening is sometimes possible but is delicate work, and the affected part should be assumed damaged until proven otherwise.', TECH),
  D('motherboard', 'slots', 'marginal', 'Damaged Slot or Port',
    'A memory slot, expansion slot, or port was physically damaged. The affected slot should be assumed unusable. Where it is the primary graphics slot, the board needs replacing.', TECH),
  D('motherboard', 'bios', 'marginal', 'BIOS Firmware Significantly Out of Date',
    'The board firmware is well behind the current release. Firmware updates fix memory compatibility, add CPU support, and patch security vulnerabilities. Updating is recommended, following the manufacturer instructions exactly — an interrupted firmware update can leave a board unbootable.', BIOS),
  D('motherboard', 'bios', 'marginal', 'BIOS Settings Left in a Non-Default State',
    'The firmware settings had been modified from defaults in ways that affect stability — altered voltages, disabled safety features, or a partially configured overclock. Resetting to defaults and reconfiguring deliberately is recommended.', BIOS),
  D('motherboard', 'battery', 'minor', 'CMOS Battery Depleted',
    'The CMOS battery is depleted, indicated by the clock resetting and firmware settings being lost at each power off. The battery is a common coin cell and costs very little. Replacement is recommended.', DIY),
  D('motherboard', 'headers', 'minor', 'Front Panel Header Miswired',
    'A front panel header was miswired, leaving a power light, activity light, or reset button inoperative. Rewiring against the board manual is recommended.', DIY),

  /* cpu */
  D('cpu', 'cooler', 'significant', 'CPU Cooler Not Properly Mounted',
    'The CPU cooler was loose, unevenly tensioned, or not making full contact with the processor. A cooler that is not seated properly causes immediate thermal throttling and, in the worst case, shutdown under load. Remounting with fresh thermal paste is required.', TECH),
  D('cpu', 'cooler', 'marginal', 'CPU Cooler Undersized for the Processor',
    'The cooler fitted is not adequate for this processor under sustained load. The system will throttle in anything demanding and will be loud while doing it. A cooler upgrade is recommended.', REPLACE),
  D('cpu', 'cooler', 'marginal', 'AIO Liquid Cooler Pump Noise or Failure',
    'The pump in the all-in-one liquid cooler was noisy, gurgling, or not running. A failed pump means the cooler is not cooling at all, and processor temperatures climb until it throttles or shuts down. AIO coolers are sealed units with a finite life and are replaced rather than repaired. Replacement is recommended.', REPLACE),
  D('cpu', 'cooler', 'marginal', 'AIO Radiator Mounted Below the Pump',
    'The all-in-one radiator was mounted so that the pump sits at the highest point in the loop. Air collects at the highest point, and air in the pump causes noise and eventually pump failure. Remounting so the radiator top is above the pump is recommended.', TECH),
  D('cpu', 'paste', 'marginal', 'Thermal Paste Dried Out',
    'The thermal interface material was dried, cracked, or pumped out from between the processor and cooler. Paste degrades over years and its loss shows up as steadily rising temperatures. Cleaning both surfaces and reapplying fresh paste is recommended.', DIY),
  D('cpu', 'paste', 'minor', 'Thermal Paste Applied Excessively',
    'Thermal paste had been applied far in excess of what is needed and had spread beyond the processor. Excess non-conductive paste is untidy rather than dangerous, but excess of an electrically conductive compound can short components. Cleaning and reapplying correctly is recommended.', DIY),
  D('cpu', 'temps', 'significant', 'CPU Thermal Throttling Under Load',
    'The processor reached its thermal limit and reduced its clock speed during the load test. The system is delivering less performance than the hardware is capable of, and sustained operation at the thermal limit shortens component life. Cooling must be addressed — remount, repaste, better cooler, or better case airflow.', TECH),
  D('cpu', 'temps', 'marginal', 'CPU Temperatures High Under Load',
    'Processor temperatures under load were high but below the throttle point. There is little margin for a warmer room or a dustier system. Improving cooling is recommended.', TECH),
  D('cpu', 'clocks', 'marginal', 'CPU Not Reaching Expected Boost Clocks',
    'The processor did not reach the boost clocks expected for the model. Causes include thermal limits, power delivery limits, and firmware configuration. Diagnosis is recommended, as the buyer is paying for performance that is not being delivered.', BIOS),
  D('cpu', 'overclock', 'marginal', 'Unstable Overclock Configured',
    'An overclock was configured and the system was not stable under sustained load. An unstable overclock produces crashes and file corruption that look like software faults. Resetting to stock settings and validating stability from there is recommended.', BIOS),
  D('cpu', 'overclock', 'minor', 'Overclock Present — History Unknown',
    'FYI — The system was running an overclock configured by the previous owner. Sustained overclocking with elevated voltage ages a processor faster than stock operation. Resetting to defaults on any second-hand system is recommended, both for stability and to know what you actually have.', BIOS),

  /* memory */
  D('memory', 'stability', 'significant', 'Memory Errors Detected During Testing',
    'Errors were detected during memory testing. Faulty memory corrupts data silently — it damages files and installations long before anyone identifies the cause. Isolating the failed module and replacing it is required before the system is used for anything that matters.', REPLACE),
  D('memory', 'seating', 'marginal', 'Memory Not Installed in the Correct Slots',
    'The memory modules were not installed in the slots the board manual specifies for dual channel operation. Running in single channel costs meaningful performance, particularly in games and on integrated graphics. Moving the modules to the correct slots takes two minutes.', DIY),
  D('memory', 'seating', 'marginal', 'Memory Module Not Fully Seated',
    'A memory module was not fully seated in its slot. This produces no-boot conditions and intermittent instability. Reseating until both retention clips engage is recommended.', DIY),
  D('memory', 'speed', 'marginal', 'Memory Running Below Its Rated Speed',
    'The memory was running at the default JEDEC speed rather than its rated profile, because the XMP or EXPO profile has not been enabled in firmware. The buyer paid for faster memory than the system is using. Enabling the profile and validating stability is recommended.', BIOS),
  D('memory', 'capacity', 'marginal', 'Mismatched Memory Modules Installed',
    'The installed modules differ in capacity, speed, or timings. Mismatched memory runs at the speed of the slowest module, can prevent dual channel operation, and is a common source of instability. Fitting a matched kit is recommended.', REPLACE),

  /* gpu */
  D('gpu', 'physical', 'significant', 'Graphics Card Showing Physical or Heat Damage',
    'The graphics card showed burnt areas, damaged components, or a scorched power connector. Do not power the system again until a technician has evaluated the card. Replacement should be assumed.', TECH),
  D('gpu', 'physical', 'marginal', 'Graphics Card Backplate or PCB Warped',
    'The card was visibly warped or bent. Warping stresses the solder joints beneath the GPU die, which is the classic path to a card that works until it suddenly does not. A support bracket is recommended, and the warping should be reported to any buyer.', DIY),
  D('gpu', 'fans', 'marginal', 'Graphics Card Fan Noisy or Not Spinning',
    'A fan on the graphics card was noisy, rattling, or did not spin. Cards run their fans off at idle by design, so this was assessed under load. A card that cannot cool itself throttles and eventually fails. Fan replacement is often possible and far cheaper than replacing the card.', TECH),
  D('gpu', 'fans', 'marginal', 'Graphics Card Fans Replaced With Non-Original Parts',
    'The card fans had been replaced with non-original parts, indicating the originals wore out. Fan wear at this level suggests very heavy sustained use — the usage pattern typical of mining or continuous rendering rather than gaming. Ask the seller directly about the card history.', SELLER),
  D('gpu', 'temps', 'significant', 'Graphics Card Thermal Throttling Under Load',
    'The graphics card reached its thermal limit and reduced clocks during testing. Frame rates drop as the card heats up, so the system performs worst exactly when it is being used hardest. Cleaning, repasting, replacing thermal pads, or improving case airflow is required.', TECH),
  D('gpu', 'temps', 'marginal', 'Graphics Card Memory Junction Temperature High',
    'Memory junction temperature on the graphics card was high under load, typically indicating degraded thermal pads. Replacing the pads is a well-documented service on most cards and restores normal operating temperatures.', TECH),
  D('gpu', 'performance', 'significant', 'Benchmark Scores Well Below Expectation',
    'Benchmark results were materially below typical results for this card. Causes include thermal or power throttling, a card that is not what it claims to be, a modified firmware, or degradation from heavy use. Investigation is required before purchase.', SELLER),
  D('gpu', 'performance', 'marginal', 'Graphics Card Running a Non-Standard Firmware',
    'The card was running a modified or non-standard firmware. Mining operations flash cards to alter power and memory behaviour, and a modified firmware can also mask a hardware problem. Reflashing the manufacturer firmware and re-testing is recommended.', TECH),
  D('gpu', 'sag', 'marginal', 'Graphics Card Sagging in the Slot',
    'The card was sagging noticeably under its own weight. Sustained sag stresses the PCIe slot and the card PCB. A support bracket costs very little and prevents a much more expensive problem.', DIY),
  D('gpu', 'output', 'marginal', 'Display Output Not Functioning',
    'One or more display outputs on the card did not produce a picture with a known-good cable and display. Diagnosis is recommended; a failed output can indicate wider damage to the card.', TECH),
  D('gpu', 'output', 'minor', 'Display Cable Limiting Refresh Rate',
    'FYI — The display cable in use cannot carry the resolution and refresh rate the hardware supports. This is a cable problem, not a hardware problem, and a correctly specified cable resolves it.', DIY),
  D('gpu', 'history', 'marginal', 'Indicators of Sustained Mining or Rendering Use',
    'Indicators consistent with heavy sustained use were present — heavy dust in a card sold as lightly used, replaced thermal pads or fans, a modified firmware, or wear inconsistent with the stated history. This is not proof, and a well-maintained mining card at the right price can be a reasonable buy, but the price should reflect it. Ask the seller directly.', SELLER),

  /* storage */
  D('storage', 'health', 'significant', 'Drive SMART Status Failing',
    'A drive reported a failing SMART status, reallocated sectors, or pending sectors. This drive is at the end of its life and can fail at any time. Replace it, and do not trust any data on it in the meantime.', REPLACE),
  D('storage', 'health', 'marginal', 'SSD Endurance Substantially Consumed',
    'The solid state drive has consumed a substantial share of its rated write endurance. It will continue to work, but it is closer to the end of its life than to the start. Budgeting for replacement, and taking the remaining endurance into account when pricing the system, is recommended.', MONITOR),
  D('storage', 'health', 'marginal', 'Hard Drive High Power-On Hours',
    'AGED — A mechanical hard drive reported very high power-on hours. Mechanical drives are the component most likely to fail in any system, and one that has been spinning for years is on borrowed time. Replacement, or at minimum a verified backup routine, is recommended.', REPLACE),
  D('storage', 'performance', 'marginal', 'Drive Performance Below Expectation',
    'Drive throughput was well below what the drive model should deliver. Causes include a drive fitted in the wrong slot and running at reduced lanes, a full drive with no spare blocks, thermal throttling, or a drive that is not the model claimed. Investigation is recommended.', TECH),
  D('storage', 'performance', 'marginal', 'NVMe Drive in a Bandwidth-Limited Slot',
    'An NVMe drive was installed in a slot that runs at reduced lanes or shares bandwidth with another device, limiting its speed. Moving it to the primary slot is recommended; check the board manual, since populating some slots disables others.', DIY),
  D('storage', 'capacity', 'minor', 'Primary Drive Nearly Full',
    'The primary drive was nearly full. Solid state drives slow down markedly when they run out of spare blocks, and an operating system with no free space behaves badly. Freeing space or adding a drive is recommended.', DIY),
  D('storage', 'capacity', 'marginal', 'System Boots From a Mechanical Hard Drive',
    'The operating system was installed on a mechanical hard drive rather than a solid state drive. This is the single biggest source of a system feeling slow regardless of how fast the rest of it is. Moving the operating system to an SSD is the most cost-effective upgrade available.', REPLACE),
  D('storage', 'data', 'marginal', "Previous Owner's Data Still Present",
    'Personal data belonging to the previous owner was still present on the drives. The system should not be handed over in this state, and a buyer should not accept it: a clean install with the drives fully erased protects both parties.', OS),
  D('storage', 'mounting', 'minor', 'SATA Cable Loose or Poorly Routed',
    'A SATA cable was loose or poorly routed. Loose data cables cause drives to disappear intermittently, which looks exactly like a failing drive. Reseating and securing the cables is recommended.', DIY),

  /* stability */
  D('stability', 'stress', 'significant', 'System Shut Down or Rebooted Under Load',
    'The system shut down or rebooted during the load test. This is most often an inadequate or failing power supply, and sometimes a thermal fault. The system cannot be considered usable until the cause is found. Do not buy this system on a promise that it only happens sometimes.', TECH),
  D('stability', 'crashes', 'significant', 'Blue Screen or Kernel Panic During Testing',
    'The system crashed to a blue screen or kernel panic during testing. Faulty memory, an unstable overclock, a failing drive, or a driver fault are the usual causes. Diagnosis is required before the system is relied upon.', TECH),
  D('stability', 'crashes', 'marginal', 'Application Crashes Under Load',
    'Applications crashed during load testing without taking the system down. This commonly indicates a marginally unstable overclock or a graphics driver fault. Resetting to stock settings and reinstalling drivers is the first step.', BIOS),
  D('stability', 'boot', 'marginal', 'Slow or Inconsistent Boot',
    'The system was slow to POST or booted inconsistently. Causes include memory training on newer platforms, which is normal on the first boots, and failing hardware, which is not. Investigation is recommended where it persists.', TECH),
  D('stability', 'boot', 'significant', 'System Does Not POST',
    'The system did not complete power-on self test. Nothing else in this report can be verified on a system that will not start. Diagnosis is required, and the fault may lie in the board, CPU, memory, or power supply.', TECH),
  D('stability', 'noise', 'marginal', 'Coil Whine Present Under Load',
    'Audible coil whine was present under load. It is electrically harmless and does not indicate a fault, but it can be genuinely irritating in a quiet room and it does not usually improve. It is worth hearing before buying.', MONITOR),
  D('stability', 'noise', 'minor', 'Fan Noise Excessive Under Load',
    'The system was loud under load. Fan curves are usually set far more aggressively than they need to be, and tuning them in firmware often makes a system substantially quieter with no meaningful temperature penalty.', BIOS),
  D('stability', 'noise', 'marginal', 'Fan Bearing Noise Present',
    'A fan produced rattling or grinding consistent with bearing wear. Bearing noise gets worse and ends in a stopped fan. Replacement of the affected fan is recommended.', DIY),

  /* software */
  D('software', 'activation', 'marginal', 'Windows Not Activated',
    'The operating system was not activated. An unactivated installation runs with limited personalisation and persistent watermarks, and the cost of a licence should be factored into the purchase price.', OS),
  D('software', 'activation', 'marginal', 'Licence Provenance Unclear',
    'The operating system licence could not be verified as legitimately transferable. Volume and OEM licences frequently do not transfer with a used system, and grey-market keys are commonly deactivated later. Budgeting for a licence is recommended.', OS),
  D('software', 'condition', 'marginal', 'Operating System Installation Degraded',
    'The operating system installation was cluttered with leftover software, failing updates, or a corrupted profile. On a second-hand system a clean install is faster than repairing someone else configuration and gives a known starting point.', OS),
  D('software', 'security', 'significant', 'Unwanted or Malicious Software Present',
    'Software was present that appears to be malware, a cryptocurrency miner, or a remote access tool. A background miner also explains any unusually heavy wear on the graphics card. Wipe the drives and perform a clean install before the system is used or connected to a network you care about.', OS),
  D('software', 'security', 'marginal', 'Third-Party Software of Unknown Origin Installed',
    'Third-party utilities and modifications of unknown origin were installed. On a machine somebody else configured, a clean install is the only way to know what is running.', OS),
  D('software', 'drivers', 'minor', 'Graphics Drivers Out of Date',
    'The graphics drivers were substantially out of date. Updating is recommended, particularly for recent titles, and a clean driver installation is preferable on a second-hand system.', OS),
  D('software', 'accounts', 'marginal', 'System Locked to a Previous Account',
    'The system was tied to an account belonging to the previous owner, or firmware or drive encryption was locked. A machine that cannot be signed into or reinstalled is not usable. This must be resolved with the seller before purchase.', SELLER),

  /* peripherals */
  D('peripherals', 'reario', 'marginal', 'Rear Port Not Functioning',
    'A rear panel port did not function with a known-good device. Where the failure is on a board-mounted controller, an add-in card is usually cheaper than replacing the board.', TECH),
  D('peripherals', 'frontio', 'minor', 'Front Panel Port Not Functioning',
    'A front panel port did not function. This is commonly a header that has come loose from the board rather than a fault in the port. Reseating the header is recommended.', DIY),
  D('peripherals', 'network', 'marginal', 'Network Connectivity Fault',
    'The wired or wireless network adapter did not connect reliably. Diagnosis is recommended; where the onboard adapter has failed, an inexpensive add-in card resolves it.', TECH),
  D('peripherals', 'audio', 'minor', 'Audio Output Fault',
    'An audio output produced no sound, distorted sound, or persistent noise. Front panel audio headers are a common culprit. Diagnosis is recommended.', TECH),
  D('peripherals', 'included', 'minor', 'Advertised Accessories Not Included',
    'Accessories that formed part of the advertised sale — cables, a keyboard, a mouse, original boxes, or the power cord — were not present. Confirm exactly what is included before agreeing a price.', SELLER),

  /* safety */
  D('safety', 'cable', 'significant', 'Mains Cable Damaged',
    'SFTY — The mains power cable was damaged, frayed, or had a damaged plug. This is a shock and fire hazard. Replace the cable before the system is powered again; it is an inexpensive standard part.', DIY),
  D('safety', 'grounding', 'marginal', 'System Not Properly Grounded',
    'SFTY — The system was connected through an adapter or extension that defeats the earth connection. A computer chassis must be earthed. Correcting the supply arrangement is recommended for safety.', TECH),
  D('safety', 'modifications', 'significant', 'Unsafe Electrical Modification Present',
    'SFTY — A modification was present that bypasses a protective function or joins conductors without proper insulation — a jumped power supply, a spliced cable, or a defeated safety interlock. This must be corrected by a technician before the system is powered again.', TECH),
  D('safety', 'liquid', 'significant', 'Liquid Cooling Leak or Residue Present',
    'A leak or coolant residue was present in the liquid cooling system. Coolant on a powered board destroys components. The system must not be powered until the loop is repaired and every affected surface has been cleaned and verified dry.', TECH),
  D('safety', 'liquid', 'marginal', 'Custom Loop Coolant Degraded',
    'The coolant in the custom loop was discoloured, cloudy, or showed growth or plating in the blocks. Degraded coolant restricts flow through the fine channels in a water block until cooling performance collapses. A full loop drain, clean, and refill is recommended.', TECH),
];

function locations(p) {
  const out = [
    'CPU Socket Area', 'CPU Cooler', 'Graphics Card', 'Memory Slots',
    'Motherboard — VRM Area', 'Motherboard — Rear I/O', 'Power Supply', 'PSU Shroud',
    'Front Intake', 'Rear Exhaust', 'Top Exhaust', 'Front Panel',
    'Primary Drive', 'Secondary Drive', 'Case Interior', 'Behind the Motherboard Tray',
    'Under the Graphics Card',
  ];
  if (p.cpuCooler && p.cpuCooler.includes('AIO')) out.push('AIO Radiator', 'AIO Pump Block');
  if (p.cpuCooler === 'Custom Loop') out.push('Reservoir', 'Water Block', 'Loop Tubing');
  out.push('Throughout the System', 'Multiple Locations');
  return out;
}

export default {
  id: 'gamingpc',
  name: 'Gaming PC',
  icon: '🖥️',
  tagline: 'Used build inspection / new build QC',
  blurb: 'Before you hand over cash for somebody else’s build — or to check over one you just '
    + 'assembled. Thermals, stability, drive health and the power supply nobody looks at.',
  docTitle: 'Computer System Inspection Report',
  subjectLabel: 'System',
  subjectLine: (p) => p.buildName || `${p.cpu} / ${p.gpu}`,
  subjectSub: (p) => `${p.cpu} · ${p.gpu} · ${p.ramCapacity} ${p.ramType} · ${p.psuWattage} ${p.psuRating}`,
  clientLabel: 'Client',
  severities: {
    significant: {
      label: 'Critical — Do Not Run / Major Cost',
      short: 'Critical',
      blurb: 'Unsafe to power on, actively damaging the system, or a repair that changes what the '
        + 'build is worth. Resolve it before money changes hands.',
    },
    marginal: {
      label: 'Needs Attention',
      short: 'Attention',
      blurb: 'A fault or a compromise that costs performance, stability, or component life. It may '
        + 'boot fine today. Most findings land here.',
    },
    minor: {
      label: 'Note / Upgrade Path',
      short: 'Note',
      blurb: 'Maintenance, tuning, cosmetics, and things worth knowing but not worth '
        + 'renegotiating over.',
    },
  },
  costBands: { significant: [150, 900], marginal: [40, 250], minor: [0, 60] },
  costNote: 'Component prices move constantly; check current used and retail pricing before agreeing a number.',
  standardsTitle: 'Scope and Limitations',
  standards: () => 'This was a visual and functional inspection of an assembled computer at a single '
    + 'point in time. No component was desoldered, bench tested, or examined under magnification, and '
    + 'no test was run to destruction. This report is not a warranty, a guarantee of future '
    + 'reliability, or an appraisal of value, and it is provided for the exclusive use of the client '
    + 'named above. Electronics fail without warning, and passing every test in this report does not '
    + 'change that.',
  intake: INTAKE,
  sections: SECTIONS,
  defects: DEFECTS,
  locations,
  sample: {
    buildName: 'Ryzen 7 / RTX 4070 gaming build', cpu: 'Ryzen 7 5800X', gpu: 'RTX 4070 12GB',
    motherboard: 'MSI B550 Tomahawk', psu: 'Corsair RM750', client: 'Liam Powell',
    inspector: 'A. Inspector', company: 'Newtown Road PC Repair', askingPrice: '900',
    ramCapacity: '32GB', ramType: 'DDR4', ramSticks: 2, storagePrimary: 'NVMe SSD',
    storageCount: 2, psuWattage: '650-750W', psuRating: '80+ Gold',
    cpuCooler: '240mm AIO Liquid', caseFans: 3, caseType: 'Mid Tower, Mesh Front',
    os: 'Windows 11', age: '2-4 years', inspectionType: 'Pre-purchase (used)',
    opened: 'Yes, fully inspected inside', poweredOn: 'Yes, booted to desktop',
    stressTest: 'CPU and GPU, 30+ minutes', benchmark: 'Yes, compared against expected scores',
    smart: 'Yes', memtest: 'Yes, full pass', thermals: 'Yes', ambient: 'Normal (20-25C / 68-77F)',
  },
};
