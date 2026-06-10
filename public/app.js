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
      { name: 'route', label: "Today's route", type: 'text',
        placeholder: 'e.g. East side residential — 300 stops, narrow alleys, bulk pickup day' },
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
      { name: 'layout', label: 'The station layout', type: 'textarea',
        placeholder: 'e.g. 8 pumps, walk-in beer cooler in back, lotto + cig wall behind counter, broken slushie machine, one bathroom with a key' },
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
      { name: 'location', label: 'Where you\'re working', type: 'text',
        placeholder: 'e.g. Downtown lot squeezed between two buildings, no parking, city inspectors nearby' },
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
        ] },
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
      { name: 'layout', label: 'Type out your store layout', type: 'textarea',
        placeholder: 'e.g. Double drive-thru lanes, front counter with 3 registers, grill + fry station in back, soft-serve machine by the soda fountain, tiny dining room with 6 booths, drink station, walk-in freezer in back' },
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
      { name: 'location', label: 'Where it goes down', type: 'text',
        placeholder: 'e.g. Downtown, 3am, a bank on a quiet corner with one rent-a-cop' },
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
      { name: 'server', label: 'The server (name + what it\'s about)', type: 'text',
        placeholder: 'e.g. "GamerDen" — a 12k-member gaming server, mostly teens, very active' },
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
      { name: 'area', label: 'Area / shift', type: 'text',
        placeholder: 'e.g. Friday night, Manhattan — Times Square to the West Village, bars letting out' },
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
        const custom = document.createElement('input');
        custom.type = 'text';
        custom.className = 'custom-input';
        custom.placeholder = 'Type your own role…';
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
