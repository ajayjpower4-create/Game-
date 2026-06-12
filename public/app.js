// ---- Screens & elements ----
const screenJobs = document.getElementById('screenJobs');
const screenSetup = document.getElementById('screenSetup');
const chatArea = document.getElementById('chatArea');
const inputArea = document.getElementById('inputArea');

const messagesEl = document.getElementById('messages');
const input = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const newChatBtn = document.getElementById('newChatBtn');

const backBtn = document.getElementById('backBtn');
const startBtn = document.getElementById('startBtn');
const setupForm = document.getElementById('setupForm');
const setupTitle = document.getElementById('setupTitle');
const setupSub = document.getElementById('setupSub');

const shiftActions = document.getElementById('shiftActions');
const saveBtn = document.getElementById('saveBtn');
const recapBtn = document.getElementById('recapBtn');
const toast = document.getElementById('toast');
const resumeBanner = document.getElementById('resumeBanner');
const resumeMeta = document.getElementById('resumeMeta');
const resumeBtn = document.getElementById('resumeBtn');
const discardBtn = document.getElementById('discardBtn');

const setupDropzone = document.getElementById('setupDropzone');
const setupImageInput = document.getElementById('setupImageInput');
const setupThumbs = document.getElementById('setupThumbs');
const attachBtn = document.getElementById('attachBtn');
const chatImageInput = document.getElementById('chatImageInput');
const pendingThumbs = document.getElementById('pendingThumbs');

const SAVE_KEY = 'otc_saved_shift';
const MAX_IMAGES = 6;       // per setup / per message
const MAX_DIM = 1280;       // px — downscale big photos before sending

// Images attached during setup / pending on the next chat message
let setupImages = [];
let pendingImages = [];

// ---- Job setup definitions ----
const JOB_FORMS = {
  garbage: {
    title: 'Garbage Collector',
    sub: 'Build your crew and the haul. Leave anything blank to let the sim decide.',
    fields: [
      { name: 'role', label: 'Your role', type: 'select',
        options: ['Thrower / Loader', 'Truck Driver', 'Crew Lead', 'Rookie', 'Operator (rear/side loader)'],
        allowCustom: true },
      { name: 'crew', label: 'Your crew', type: 'textarea',
        placeholder: "e.g. Big Mike on the wheel, Tina throwing with you, and the new kid Diego who can't find his gloves" },
      { name: 'route', label: "Today's route", type: 'select',
        options: [
          'Dense city residential — narrow streets, alleys, parked cars everywhere',
          'Suburban neighborhoods — long driveways, lots of stops, cul-de-sacs',
          'Downtown commercial — dumpsters behind restaurants and shops',
          'Rural route — spread out, long drives between stops',
          'Apartment complexes — shared dumpsters, tight access',
        ], allowCustom: true, customPlaceholder: 'Describe your own route…' },
      { name: 'truck', label: 'The truck (optional)', type: 'text',
        placeholder: 'e.g. Old rear-loader, Unit 14, packer blade sticks in the cold' },
    ],
  },
  gas: {
    title: 'Gas Station Worker',
    sub: 'Set the store and who you work with. Then deal with whoever walks in.',
    fields: [
      { name: 'role', label: 'Your role', type: 'select',
        options: ['Cashier', 'Shift Lead', 'Overnight Clerk', 'Store Manager', 'Stocker / Deli'],
        allowCustom: true },
      { name: 'coworkers', label: 'Who works with you', type: 'textarea',
        placeholder: "e.g. Manager Reggie who's always 'on break', Anika running the deli, nobody else after 11pm" },
      { name: 'layout', label: 'The station layout', type: 'select',
        options: [
          'Small corner store — 4 pumps, one register, cramped aisles',
          'Big truck stop — 12+ pumps, diesel lanes, showers, huge store',
          'Standard suburban station — 8 pumps, walk-in cooler, lotto counter',
          'City station — busy foot traffic, bulletproof glass at night',
          'Highway rest-stop station — fast food combo, huge parking, tourists',
        ], allowCustom: true, customMultiline: true,
        customPlaceholder: 'Describe your own station layout…' },
      { name: 'shift', label: 'The shift (optional)', type: 'text',
        placeholder: 'e.g. Friday graveyard, 10pm–6am, bar crowd incoming' },
    ],
  },
  construction: {
    title: 'Construction Worker',
    sub: 'Pick the job, the crew, your trade, and the site.',
    fields: [
      { name: 'role', label: 'Your role / trade', type: 'select',
        options: ['General Laborer', 'Carpenter', 'Foreman', 'Equipment Operator', 'Electrician', 'Concrete / Mason', 'Ironworker'],
        allowCustom: true },
      { name: 'project', label: 'The job / project', type: 'textarea',
        placeholder: 'e.g. Pouring foundation for a 3-story apartment block, behind schedule, rain coming Thursday' },
      { name: 'crew', label: 'Your crew', type: 'textarea',
        placeholder: "e.g. Foreman Sal who screams a lot, Jefe the operator, two laborers, and an apprentice who keeps texting" },
      { name: 'location', label: 'Where you\'re working', type: 'select',
        options: [
          'Downtown high-rise site — cranes, tight lot, city inspectors',
          'Suburban housing development — multiple homes going up at once',
          'Road / highway construction — lanes closed, flaggers, heavy machinery',
          'Commercial building — strip mall or office, steel and concrete',
          'Residential remodel — one house, smaller crew',
        ], allowCustom: true, customPlaceholder: 'Describe your own work site…' },
    ],
  },
  restaurant: {
    title: 'Restaurant Worker',
    sub: 'Name the place, pick your rank, choose a layout, set the menu and your coworkers.',
    fields: [
      { name: 'name', label: 'Restaurant name', type: 'text',
        placeholder: "e.g. The Copper Skillet" },
      { name: 'role', label: 'Your rank', type: 'select',
        options: ['Dishwasher', 'Busser', 'Host / Hostess', 'Food Runner', 'Server', 'Bartender',
          'Line Cook', 'Sous Chef', 'Head Chef', 'Kitchen Manager', 'General Manager', 'Owner'],
        allowCustom: true },
      { name: 'layout', label: 'Pick a layout', type: 'select',
        options: [
          'Cozy bistro — ~12 tables, open kitchen, small bar, one tight server station',
          'Upscale fine dining — white tablecloths, ~20 tables, full bar, private dining room, big pro kitchen in back',
          'Busy family diner — counter seats + booths, big flat-top grill, drink station, walk-in cooler in back',
          'Trendy gastropub — central bar, communal high-tops, patio seating, tight galley kitchen',
          'Big banquet-style spot — 50+ tables, multiple server stations, long expo line, huge kitchen with a separate prep area',
        ], allowCustom: true, customMultiline: true,
        customPlaceholder: 'Describe your own restaurant layout…' },
      { name: 'menu', label: 'The menu', type: 'textarea',
        placeholder: 'e.g. Italian-American — wood-fired pizzas, fresh pasta, a few steaks, big wine list, tiramisu' },
      { name: 'coworkers', label: 'Who works with you', type: 'textarea',
        placeholder: "e.g. Chef Marco who throws pans, Lena the veteran server, a new busser named Ty, bartender Roni" },
    ],
  },
  fastfood: {
    title: 'Fast Food Worker',
    sub: 'Name the place, pick your rank, then type out your own store layout however you want.',
    fields: [
      { name: 'name', label: 'Restaurant name', type: 'text',
        placeholder: "e.g. Burger Barn" },
      { name: 'role', label: 'Your rank', type: 'select',
        options: ['Crew Member', 'Cashier', 'Cook / Grill', 'Drive-Thru', 'Shift Lead', 'Assistant Manager', 'General Manager'],
        allowCustom: true },
      { name: 'layout', label: 'The store layout', type: 'select',
        options: [
          'Classic burger joint — double drive-thru, front counter, small dining room',
          'Fried chicken spot — big fryers, walk-up counter, drive-thru',
          'Taco place — assembly line, drive-thru, late-night crowd',
          'Pizza counter — ovens, carryout + delivery, a few tables',
          'Mall food-court stall — no drive-thru, walk-up only, lunch rush',
        ], allowCustom: true, customMultiline: true,
        customPlaceholder: 'Type out your own store layout however you want…' },
      { name: 'menu', label: 'The menu', type: 'textarea',
        placeholder: 'e.g. Smash burgers, crispy chicken sandwich, fries, nuggets, shakes, $5 combo deals' },
      { name: 'coworkers', label: 'Who works with you', type: 'textarea',
        placeholder: "e.g. Manager Dee who's always counting the drawer, Marcus on grill, two crew members, and the drive-thru is short-staffed" },
    ],
  },
  crime: {
    title: 'Criminal',
    sub: 'A fictional, GTA-style crime story. Set up the score, then play it out.',
    fields: [
      { name: 'role', label: 'Your role in the crew', type: 'select',
        options: ['Mastermind', 'Getaway Driver / Wheelman', 'Muscle / Enforcer', 'Hacker', 'Lookout', 'Safecracker', 'Gunman', 'Con Artist'],
        allowCustom: true },
      { name: 'job', label: "The score you're pulling", type: 'select',
        options: ['Bank heist', 'Jewelry store robbery', 'Armored truck hit', 'Casino job', 'Warehouse break-in', 'Drug deal', 'Car boost ring', 'Stick-up'],
        allowCustom: true },
      { name: 'location', label: 'Where it goes down', type: 'select',
        options: [
          'Downtown bank, 3am, quiet street with one rent-a-cop',
          'Jewelry store in a busy shopping district, broad daylight',
          'Armored truck — hit it at a depot stop',
          'Casino back office — cameras everywhere',
          'Warehouse on the docks — a fence\'s contact on the inside',
        ], allowCustom: true, customPlaceholder: 'Describe your own score location…' },
      { name: 'crew', label: 'Your crew', type: 'textarea',
        placeholder: "e.g. Vince the hothead on guns, Lola driving, Doc the inside man who's getting cold feet" },
      { name: 'car', label: 'The car', type: 'text',
        placeholder: 'e.g. Blacked-out Dodge Charger, stolen plates, scanner on the dash' },
      { name: 'tools', label: 'Guns & tools', type: 'textarea',
        placeholder: 'e.g. Two pistols, a shotgun, zip ties, a duffel, bolt cutters, burner phones, a thermal lance for the safe' },
    ],
  },
  school: {
    title: 'Teacher / School Worker',
    sub: 'Name the school, pick your rank, set the details. A full staff is already there.',
    fields: [
      { name: 'name', label: 'School name', type: 'text',
        placeholder: 'e.g. Lincoln Heights High' },
      { name: 'role', label: 'Your rank / role', type: 'select',
        options: ['Substitute Teacher', "Teacher's Aide", 'Elementary Teacher', 'Middle School Teacher',
          'High School Teacher', 'Coach / PE Teacher', 'School Counselor', 'Librarian', 'School Nurse',
          'Custodian / Janitor', 'Cafeteria Staff', 'Security / Resource Officer', 'Vice Principal',
          'Principal', 'Superintendent'],
        allowCustom: true },
      { name: 'level', label: 'Level', type: 'select',
        options: ['Elementary', 'Middle School', 'High School', 'K-12', 'Private', 'Charter', 'College'],
        allowCustom: true },
      { name: 'subject', label: 'Subject / area (optional)', type: 'text',
        placeholder: 'e.g. 10th grade Biology' },
      { name: 'students', label: 'Notable students or parents (optional)', type: 'textarea',
        placeholder: "e.g. Jayden the class clown, Mia who's always on her phone, and a parent, Mrs. Cole, who emails about everything" },
    ],
  },
  discord: {
    title: 'Discord Mod',
    sub: "Set up your server. You'll type what you post in the chat; the AI plays everyone else.",
    fields: [
      { name: 'server', label: 'The server', type: 'select',
        options: [
          'Big gaming server — 12k members, mostly teens, very active',
          'Small tight-knit community — a few hundred regulars',
          'Anime / hobby server — tons of channels, emoji spam',
          'Crypto / NFT server — scams and shills everywhere',
          'Edgy meme server — people constantly pushing the rules',
        ], allowCustom: true, customMultiline: true,
        customPlaceholder: 'Describe your own server (name + what it\'s about)…' },
      { name: 'role', label: 'Your mod rank', type: 'select',
        options: ['Trial Mod / Helper', 'Moderator', 'Senior Mod', 'Admin', 'Owner', 'Bot Manager'],
        allowCustom: true },
      { name: 'channels', label: 'Channels', type: 'textarea',
        placeholder: 'e.g. #general, #memes, #voice-chat, #off-topic, #mod-log, #report-here' },
      { name: 'members', label: 'Notable members', type: 'textarea',
        placeholder: 'e.g. xX_Sniper_Xx who spams, a chill regular named bee, a troll on an alt, and another mod, Kayla' },
      { name: 'rules', label: 'Server rules (optional)', type: 'text',
        placeholder: 'e.g. No spam, no slurs, keep NSFW out of general, English only' },
    ],
  },
  taxi: {
    title: 'NYC Taxi / Rideshare Driver',
    sub: 'Pick who you drive for and your ride. Then hit the streets.',
    fields: [
      { name: 'company', label: 'Who you drive for', type: 'select',
        options: ['Yellow Cab (NYC medallion)', 'Uber', 'Lyft', 'Via', 'Independent / gypsy cab'],
        allowCustom: true },
      { name: 'vehicle', label: 'Your vehicle', type: 'text',
        placeholder: 'e.g. Beat-up Toyota Camry with 200k miles and a check-engine light' },
      { name: 'area', label: 'Area / shift', type: 'select',
        options: [
          'Friday night Manhattan — bar crowd, Times Square gridlock',
          'Morning rush — airport runs (JFK/LGA), business commuters',
          'Rainy weekday — everyone wants a ride, surge pricing',
          'Late-night outer boroughs — Brooklyn/Queens, long fares',
          'Tourist daytime — sightseers, slow traffic, big tips',
        ], allowCustom: true, customPlaceholder: 'Describe your own area / shift…' },
    ],
  },
  warehouse: {
    title: 'Warehouse Worker',
    sub: 'Name the warehouse, pick your rank & duties, set the staff. Photos strongly recommended!',
    fields: [
      { name: 'name', label: 'Warehouse name', type: 'text',
        placeholder: 'e.g. Apex Distribution Center #7' },
      { name: 'role', label: 'Your rank / role', type: 'select',
        options: ['Picker / Packer', 'Forklift Operator', 'Loader / Dock Worker', 'Receiver', 'Inventory / Cycle Counter',
          'Lead / Line Lead', 'Shift Supervisor', 'Warehouse Manager'],
        allowCustom: true },
      { name: 'setting', label: 'Type of warehouse', type: 'select',
        options: [
          'Massive e-commerce fulfillment center — miles of racks, conveyors',
          'Cold-storage freezer warehouse — sub-zero, heavy gear',
          'Small distribution depot — forklifts, loading dock, tight crew',
          'Retail backroom / big-box store — restocking, pallets',
          'Auto-parts / industrial warehouse — heavy, bulky items',
        ], allowCustom: true, customPlaceholder: 'Describe your own warehouse…' },
      { name: 'duties', label: 'What you do here', type: 'textarea',
        placeholder: 'e.g. Picking orders off a scanner, racing the rate, loading trucks at the dock' },
      { name: 'staff', label: 'Staff / who works with you', type: 'textarea',
        placeholder: "e.g. Supervisor Karen riding the numbers, Tank on the forklift, Lil D who's always late, two temps" },
    ],
  },
  scientist: {
    title: 'Scientist',
    sub: 'Pick your lab, your field of science, and the gear you have.',
    fields: [
      { name: 'lab', label: 'The lab you work in', type: 'select',
        options: [
          'University research lab — grad students, tight grant budget',
          'Big pharma lab — sleek, corporate, lots of equipment',
          'Government / forensics lab — strict protocols',
          'Biotech startup — move fast, break the centrifuge',
          'Chemistry teaching lab — students everywhere',
        ], allowCustom: true, customPlaceholder: 'Describe your own lab…' },
      { name: 'field', label: 'The science you do', type: 'select',
        options: ['Molecular Biology / Genetics', 'Chemistry', 'Microbiology', 'Physics', 'Neuroscience',
          'Pharmacology', 'Forensics', 'Materials Science', 'Environmental Science'],
        allowCustom: true },
      { name: 'tools', label: 'Equipment & tools you have', type: 'textarea',
        placeholder: 'e.g. PCR machine, centrifuge, fume hood, -80 freezer, a temperamental mass spec' },
      { name: 'staff', label: 'Lab mates / coworkers (optional)', type: 'textarea',
        placeholder: "e.g. Dr. Voss the demanding PI, postdoc Priya, a grad student named Eli who broke the centrifuge" },
    ],
  },
  sports: {
    title: 'Sports Player',
    sub: 'Pick the sport, your position, league and coach. Your team is preset for you.',
    fields: [
      { name: 'sport', label: 'The sport', type: 'select',
        options: ['Basketball', 'Football', 'Soccer', 'Baseball', 'Hockey', 'Boxing / MMA', 'Tennis', 'Rugby'],
        allowCustom: true },
      { name: 'position', label: 'Your position / role', type: 'text',
        placeholder: 'e.g. Point guard, starting QB, striker, closer...' },
      { name: 'league', label: 'The league', type: 'text',
        placeholder: 'e.g. The NBA, a college team, a scrappy semi-pro league' },
      { name: 'coach', label: 'Your coach', type: 'text',
        placeholder: 'e.g. Coach Reeves — old-school, screams a lot, secretly believes in you' },
    ],
  },
  plumber: {
    title: 'Plumber',
    sub: 'Pick your rank, what you\'re working on, your crew, and where the job is.',
    fields: [
      { name: 'role', label: 'Your rank', type: 'select',
        options: ['Apprentice', 'Journeyman Plumber', 'Master Plumber', 'Pipefitter', 'Foreman', 'Owner / Contractor'],
        allowCustom: true },
      { name: 'job', label: "What you're working on", type: 'select',
        options: [
          'Burst pipe emergency flooding a house',
          'New-construction rough-in (running all the pipe)',
          'Clogged main sewer line backing up',
          'Water heater install / replacement',
          'Commercial bathroom remodel',
          'Leaky faucets and small repairs all day',
        ], allowCustom: true, customPlaceholder: 'Describe your own job…' },
      { name: 'location', label: 'Where the job is', type: 'select',
        options: [
          'A family\'s home — anxious homeowner watching you',
          'Apartment complex — angry tenants, old pipes',
          'New construction site — working with the other trades',
          'Restaurant kitchen — grease, deadlines, health inspector',
          'Office / commercial building — after-hours work',
        ], allowCustom: true, customPlaceholder: 'Describe your own job site…' },
      { name: 'crew', label: 'Your crew', type: 'textarea',
        placeholder: "e.g. Old-timer Stan who's seen it all, an apprentice named Kev who's useless, you on the wrench" },
    ],
  },
  busdriver: {
    title: 'Bus Driver',
    sub: 'Pick the kind of bus, your city, and your route.',
    fields: [
      { name: 'busType', label: 'What you drive', type: 'select',
        options: ['MTA city bus', 'School bus', 'Coach / charter bus', 'Transit articulated (bendy) bus'],
        allowCustom: true },
      { name: 'city', label: 'Your city', type: 'select',
        options: ['New York City', 'Chicago', 'Los Angeles', 'A small town', 'A college town'],
        allowCustom: true, customPlaceholder: 'Type your own city…' },
      { name: 'route', label: 'Your route', type: 'select',
        options: [
          'Busy downtown line — packed, every stop, all day',
          'School run — picking up kids in the morning, dropping off after',
          'Express / commuter route — highway stretches, rush hour',
          'Late-night line — drunks, empty streets, weird passengers',
          'Suburban loop — quiet, regulars, long route',
        ], allowCustom: true, customPlaceholder: 'Describe your own route…' },
    ],
  },
  pilot: {
    title: 'Airplane Pilot',
    sub: 'Pick your airline, your rank, your co-pilot, and your plane. The rest of the crew is preset.',
    fields: [
      { name: 'airline', label: 'Your airline', type: 'select',
        options: ['Delta', 'American Airlines', 'United', 'Southwest', 'JetBlue', 'A budget airline', 'Private charter'],
        allowCustom: true },
      { name: 'role', label: 'Your rank', type: 'select',
        options: ['Captain (Pilot)', 'First Officer (Co-Pilot)', 'Flight Attendant', 'Flight Engineer'],
        allowCustom: true },
      { name: 'copilot', label: 'Your co-pilot', type: 'text',
        placeholder: 'e.g. First Officer Dana Cole — calm, dry sense of humor, 8 years flying' },
      { name: 'plane', label: 'Your plane', type: 'select',
        options: ['Boeing 737', 'Airbus A320', 'Boeing 777 (long-haul)', 'Regional jet (CRJ)', 'Private jet (Gulfstream)'],
        allowCustom: true },
    ],
  },
  office: {
    title: 'Office Worker',
    sub: 'Pick your office, your rank, the type of work, and the vibe of the place.',
    fields: [
      { name: 'company', label: 'What office you work at', type: 'text',
        placeholder: 'e.g. Hollerith Insurance, a mid-size firm downtown' },
      { name: 'role', label: 'Your rank', type: 'select',
        options: ['Intern', 'Junior Associate', 'Analyst', 'Manager', 'Senior Manager', 'Director', 'VP', 'Executive'],
        allowCustom: true },
      { name: 'workType', label: 'Type of office work', type: 'select',
        options: ['Sales', 'Marketing', 'Accounting / Finance', 'HR', 'IT / Tech support', 'Customer service', 'Data entry', 'Management'],
        allowCustom: true },
      { name: 'layout', label: 'The office', type: 'select',
        options: [
          'Open-plan cubicle farm — fluorescent lights, no privacy',
          'Corporate high-rise — glass offices, strict dress code',
          'Small startup office — beanbags, ping-pong, chaos',
          'Cramped back office — too many people, one printer',
          'Mostly remote — occasional days in a half-empty office',
        ], allowCustom: true, customPlaceholder: 'Describe your own office…' },
    ],
  },
};

// For the resume banner
const JOB_TITLES = Object.fromEntries(Object.entries(JOB_FORMS).map(([k, v]) => [k, v.title]));

// ---- State ----
let history = [];
let isStreaming = false;
let currentJob = null;
let currentConfig = {};

// ---- Navigation ----
document.querySelectorAll('.job-card').forEach(card => {
  card.addEventListener('click', () => openSetup(card.dataset.job));
});

backBtn.addEventListener('click', () => showScreen('jobs'));
newChatBtn.addEventListener('click', quitToJobs);
startBtn.addEventListener('click', startShift);
saveBtn.addEventListener('click', saveShift);
recapBtn.addEventListener('click', recapShift);
resumeBtn.addEventListener('click', resumeShift);
discardBtn.addEventListener('click', discardSave);

// ---- Image attachments ----
setupDropzone.addEventListener('click', () => setupImageInput.click());
setupImageInput.addEventListener('change', (e) => addFiles(e.target.files, setupImages, renderSetupThumbs).then(() => { setupImageInput.value = ''; }));
attachBtn.addEventListener('click', () => chatImageInput.click());
chatImageInput.addEventListener('change', (e) => addFiles(e.target.files, pendingImages, renderPendingThumbs).then(() => { chatImageInput.value = ''; }));

// Read, downscale and base64-encode image files into the target array.
async function addFiles(fileList, target, render) {
  const files = Array.from(fileList || []).filter(f => f.type.startsWith('image/'));
  for (const file of files) {
    if (target.length >= MAX_IMAGES) { showToast(`Max ${MAX_IMAGES} photos.`); break; }
    try {
      const part = await fileToImagePart(file);
      target.push(part);
    } catch {
      showToast('Couldn\'t read that image.');
    }
  }
  render();
}

function fileToImagePart(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        const scale = Math.min(1, MAX_DIM / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        resolve({ media_type: 'image/jpeg', data: dataUrl.split(',')[1], url: dataUrl });
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function renderSetupThumbs() { renderThumbs(setupThumbs, setupImages, renderSetupThumbs); }
function renderPendingThumbs() {
  renderThumbs(pendingThumbs, pendingImages, renderPendingThumbs);
  if (typeof updateSendState === 'function') updateSendState();
}

function renderThumbs(container, arr, rerender) {
  container.innerHTML = '';
  arr.forEach((img, idx) => {
    const t = document.createElement('div');
    t.className = 'thumb';
    t.innerHTML = `<img src="${img.url || `data:${img.media_type};base64,${img.data}`}" alt="photo">` +
      `<button type="button" class="thumb-x" title="Remove">✕</button>`;
    t.querySelector('.thumb-x').addEventListener('click', () => { arr.splice(idx, 1); rerender(); });
    container.appendChild(t);
  });
}

// Build message content: a plain string, or content blocks when images are attached.
function buildContent(text, images) {
  if (!images || !images.length) return text;
  const blocks = images.map(img => ({
    type: 'image',
    source: { type: 'base64', media_type: img.media_type, data: img.data },
  }));
  blocks.push({ type: 'text', text });
  return blocks;
}

// Pull display text + image parts back out of a stored message (string or blocks).
function extractParts(content) {
  if (typeof content === 'string') return { text: content, images: [] };
  if (Array.isArray(content)) {
    const text = content.filter(b => b.type === 'text').map(b => b.text).join(' ');
    const images = content.filter(b => b.type === 'image' && b.source)
      .map(b => ({ media_type: b.source.media_type, data: b.source.data }));
    return { text, images };
  }
  return { text: '', images: [] };
}

function showScreen(name) {
  screenJobs.hidden = name !== 'jobs';
  screenSetup.hidden = name !== 'setup';
  chatArea.hidden = name !== 'chat';
  inputArea.hidden = name !== 'chat';
  shiftActions.hidden = name !== 'chat';
  if (name === 'jobs') refreshResumeBanner();
}

function quitToJobs() {
  history = [];
  messagesEl.innerHTML = '';
  currentJob = null;
  currentConfig = {};
  pendingImages = [];
  renderPendingThumbs();
  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;
  isStreaming = false;
  showScreen('jobs');
}

function openSetup(jobKey) {
  const def = JOB_FORMS[jobKey];
  if (!def) return;
  currentJob = jobKey;
  setupImages = [];
  renderSetupThumbs();
  setupTitle.textContent = def.title;
  setupSub.textContent = def.sub;
  setupForm.innerHTML = '';

  def.fields.forEach(field => {
    const wrap = document.createElement('div');
    wrap.className = 'field';

    const label = document.createElement('label');
    label.textContent = field.label;
    label.htmlFor = `f-${field.name}`;
    wrap.appendChild(label);

    if (field.type === 'select') {
      const select = document.createElement('select');
      select.id = `f-${field.name}`;
      select.name = field.name;
      field.options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt; o.textContent = opt;
        select.appendChild(o);
      });
      if (field.allowCustom) {
        const o = document.createElement('option');
        o.value = '__custom__'; o.textContent = 'Something else…';
        select.appendChild(o);
      }
      wrap.appendChild(select);

      if (field.allowCustom) {
        const custom = document.createElement(field.customMultiline ? 'textarea' : 'input');
        if (field.customMultiline) custom.rows = 2; else custom.type = 'text';
        custom.className = 'custom-input';
        custom.placeholder = field.customPlaceholder || 'Type your own…';
        custom.hidden = true;
        custom.dataset.for = field.name;
        select.addEventListener('change', () => {
          custom.hidden = select.value !== '__custom__';
          if (!custom.hidden) custom.focus();
        });
        wrap.appendChild(custom);
      }
    } else if (field.type === 'textarea') {
      const ta = document.createElement('textarea');
      ta.id = `f-${field.name}`;
      ta.name = field.name;
      ta.rows = 2;
      ta.placeholder = field.placeholder || '';
      wrap.appendChild(ta);
    } else {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.id = `f-${field.name}`;
      inp.name = field.name;
      inp.placeholder = field.placeholder || '';
      wrap.appendChild(inp);
    }

    setupForm.appendChild(wrap);
  });

  showScreen('setup');
}

function collectConfig() {
  const cfg = {};
  setupForm.querySelectorAll('input, select, textarea').forEach(el => {
    if (el.classList.contains('custom-input')) return;
    let val = el.value.trim();
    if (el.tagName === 'SELECT' && val === '__custom__') {
      const custom = setupForm.querySelector(`.custom-input[data-for="${el.name}"]`);
      val = custom ? custom.value.trim() : '';
    }
    if (val) cfg[el.name] = val;
  });
  return cfg;
}

function startShift() {
  currentConfig = collectConfig();
  if (setupImages.length) currentConfig._hasImages = true;
  pendingImages = [];
  renderPendingThumbs();
  history = [];
  messagesEl.innerHTML = '';
  showScreen('chat');

  // Kick off the scene with a hidden opening action, attaching any setup photos.
  const openerText = setupImages.length
    ? '*clocks in and starts the shift* (Photos of my real workplace are attached — use them for the layout.)'
    : '*clocks in and starts the shift*';
  history.push({ role: 'user', content: buildContent(openerText, setupImages) });
  setupImages = [];
  renderSetupThumbs();
  streamReply();
}

// ---- Chat input ----
function updateSendState() {
  sendBtn.disabled = isStreaming || (!input.value.trim() && !pendingImages.length);
}

input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 200) + 'px';
  updateSendState();
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) sendMessage();
  }
});

sendBtn.addEventListener('click', sendMessage);

function sendMessage() {
  const text = input.value.trim();
  if ((!text && !pendingImages.length) || isStreaming) return;

  const imgs = pendingImages.slice();
  history.push({ role: 'user', content: buildContent(text || '*shows this*', imgs) });
  appendMessage('user', text, imgs);

  pendingImages = [];
  renderPendingThumbs();
  input.value = '';
  input.style.height = 'auto';
  streamReply();
}

// ---- Save / Resume ----
function saveShift() {
  if (!currentJob) return;
  try {
    const payload = {
      job: currentJob,
      config: currentConfig,
      history,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    showToast('Shift saved — your crew is locked in.');
  } catch {
    showToast('Could not save (storage full or blocked).');
  }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.job || !Array.isArray(data.history)) return null;
    return data;
  } catch {
    return null;
  }
}

function refreshResumeBanner() {
  const save = loadSave();
  if (!save) { resumeBanner.hidden = true; return; }
  const title = JOB_TITLES[save.job] || 'a shift';
  const when = new Date(save.savedAt).toLocaleString();
  resumeMeta.textContent = `${title} · saved ${when}`;
  resumeBanner.hidden = false;
}

function resumeShift() {
  const save = loadSave();
  if (!save) { refreshResumeBanner(); return; }
  currentJob = save.job;
  currentConfig = save.config || {};
  history = save.history.slice();
  pendingImages = [];
  renderPendingThumbs();
  messagesEl.innerHTML = '';
  // Re-render the conversation (skip the hidden opener action).
  history.forEach((m, i) => {
    const { text, images } = extractParts(m.content);
    if (i === 0 && m.role === 'user' && text.startsWith('*clocks in')) return;
    appendMessage(m.role, text, images);
  });
  showScreen('chat');
  input.focus();
}

function discardSave() {
  localStorage.removeItem(SAVE_KEY);
  refreshResumeBanner();
}

// ---- Recap ----
async function recapShift() {
  if (!currentJob || isStreaming) return;
  isStreaming = true;
  recapBtn.disabled = true;
  sendBtn.disabled = true;

  const { card, body } = createRecapCard();
  scrollToBottom();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history, job: currentJob, config: currentConfig, mode: 'recap' }),
    });
    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') break;
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) { body.innerHTML = `<div class="error-msg">${escapeHtml(parsed.error)}</div>`; break; }
          if (parsed.text) { text += parsed.text; body.innerHTML = renderMarkdown(text); scrollToBottom(); }
        } catch {}
      }
    }
  } catch (err) {
    body.innerHTML = `<div class="error-msg">Recap failed: ${escapeHtml(err.message)}</div>`;
  }

  isStreaming = false;
  recapBtn.disabled = false;
  updateSendState();
  scrollToBottom();
}

function createRecapCard() {
  const card = document.createElement('div');
  card.className = 'recap-card';
  const head = document.createElement('div');
  head.className = 'recap-head';
  head.textContent = '📋 Shift recap';
  const body = document.createElement('div');
  body.className = 'recap-body';
  body.innerHTML = '<span class="typing-cursor"></span>';
  card.appendChild(head);
  card.appendChild(body);
  messagesEl.appendChild(card);
  return { card, body };
}

let toastTimer = null;
function showToast(msg) {
  toast.textContent = msg;
  toast.hidden = false;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => { toast.hidden = true; }, 250);
  }, 2200);
}

async function streamReply() {
  isStreaming = true;
  sendBtn.disabled = true;
  sendBtn.classList.add('loading');

  const { bubble, cursor } = createAssistantBubble();
  scrollToBottom();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history, job: currentJob, config: currentConfig }),
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let assistantText = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') break;

        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            bubble.innerHTML = `<div class="error-msg">${escapeHtml(parsed.error)}</div>`;
            cursor.remove();
            break;
          }
          if (parsed.text) {
            assistantText += parsed.text;
            bubble.innerHTML = renderMarkdown(assistantText);
            bubble.appendChild(cursor);
            scrollToBottom();
          }
        } catch {}
      }
    }

    cursor.remove();
    if (assistantText) {
      history.push({ role: 'assistant', content: assistantText });
      bubble.innerHTML = renderMarkdown(assistantText);
    }
  } catch (err) {
    cursor.remove();
    bubble.innerHTML = `<div class="error-msg">Connection error: ${escapeHtml(err.message)}</div>`;
  }

  isStreaming = false;
  sendBtn.classList.remove('loading');
  updateSendState();
  scrollToBottom();
}

function appendMessage(role, content, images = []) {
  const div = document.createElement('div');
  div.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'user' ? 'YOU' : '◆';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  if (images && images.length) {
    const grid = document.createElement('div');
    grid.className = 'msg-images';
    images.forEach(img => {
      const el = document.createElement('img');
      el.src = img.url || `data:${img.media_type};base64,${img.data}`;
      el.alt = 'attached photo';
      grid.appendChild(el);
    });
    bubble.appendChild(grid);
  }
  if (content) {
    const textEl = document.createElement('div');
    textEl.innerHTML = role === 'user' ? escapeHtml(content) : renderMarkdown(content);
    bubble.appendChild(textEl);
  }

  div.appendChild(avatar);
  div.appendChild(bubble);
  messagesEl.appendChild(div);
  scrollToBottom();
  return bubble;
}

function createAssistantBubble() {
  const div = document.createElement('div');
  div.className = 'message assistant';

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = '◆';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  const cursor = document.createElement('span');
  cursor.className = 'typing-cursor';
  bubble.appendChild(cursor);

  div.appendChild(avatar);
  div.appendChild(bubble);
  messagesEl.appendChild(div);
  return { bubble, cursor };
}

function scrollToBottom() {
  chatArea.scrollTop = chatArea.scrollHeight;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Lightweight markdown renderer
function renderMarkdown(text) {
  let html = escapeHtml(text);

  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  html = html.replace(/^[*\-] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]+?<\/li>)(?!\s*<li>)/g, '<ul>$1</ul>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  html = html.replace(/^---$/gm, '<hr>');

  html = html
    .split(/\n\n+/)
    .map(block => {
      if (/^<(h[123]|ul|ol|pre|blockquote|hr)/.test(block.trim())) return block;
      const lines = block.replace(/\n/g, '<br>');
      return `<p>${lines}</p>`;
    })
    .join('\n');

  return html;
}

// ---- Init ----
refreshResumeBanner();
