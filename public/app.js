// ===================== GAME DATA =====================
const TRADES = {
  'Plumber': {
    icon: '🔧',
    jobs: [
      'A burst pipe is flooding a homeowner\'s basement',
      'Snake and clear a backed-up main sewer line',
      'Replace a dead water heater in a tight utility closet',
      'Rough-in the plumbing for a full bathroom remodel',
      'Fix a leaking kitchen faucet and corroded shutoff valves',
    ],
  },
  'HVAC Tech': {
    icon: '❄️',
    jobs: [
      'AC unit died during a heatwave, customer is sweating bullets',
      'Furnace won\'t ignite in the dead of winter',
      'Install brand new ductwork in a finished attic',
      'Track down a refrigerant leak on a split system',
      'Service a commercial rooftop unit at a strip mall',
    ],
  },
  'Roofer': {
    icon: '🏠',
    jobs: [
      'Tear off and re-shingle an entire two-story house',
      'Patch a major leak after a storm before it rains again',
      'Replace a flat roof membrane on a commercial building',
      'Tear off old gutters and hang new ones',
      'Emergency tarp a roof after a tree came through it',
    ],
  },
  'Electrician': {
    icon: '⚡',
    jobs: [
      'Upgrade an old 100-amp panel to 200 amp',
      'Troubleshoot a dead circuit that keeps tripping',
      'Wire a new room addition from scratch',
      'Install a 240V EV charger in a garage',
      'Chase down a bad neutral causing lights to flicker',
    ],
  },
  'Carpenter': {
    icon: '🔨',
    jobs: [
      'Frame and build a new backyard deck',
      'Build and install custom kitchen cabinets',
      'Tear out and replace a rotted bathroom subfloor',
      'Hang interior doors and run trim through a whole house',
      'Frame interior walls to finish a basement',
    ],
  },
  'Welder': {
    icon: '🔥',
    jobs: [
      'Repair a cracked trailer frame before it fails',
      'Fabricate and install a steel stair railing',
      'Pipe welding on a busy industrial job site',
      'Fix broken farm equipment out in a field',
      'Weld up a structural steel beam for an addition',
    ],
  },
  'Mason': {
    icon: '🧱',
    jobs: [
      'Lay a brick retaining wall along a driveway',
      'Rebuild a crumbling chimney up on the roof',
      'Pour and finish a new concrete driveway',
      'Install stone veneer across the front of a house',
      'Lay a block foundation wall for a new build',
    ],
  },
  'Painter': {
    icon: '🎨',
    jobs: [
      'Repaint an entire house exterior in two days',
      'Knock out a commercial office interior overnight',
      'Strip, sand, and refinish kitchen cabinets',
      'Power wash and stain a big backyard deck',
      'Patch, texture, and match drywall after a leak',
    ],
  },
  'Landscaper': {
    icon: '🌳',
    jobs: [
      'Rip out a dead lawn and lay fresh sod',
      'Take down a huge tree leaning over a house',
      'Build a paver patio with a fire pit',
      'Trench and install a full irrigation system',
      'Storm cleanup — haul off downed limbs and debris',
    ],
  },
  'Solar Panel Installer': {
    icon: '☀️',
    jobs: [
      'Mount a full rooftop solar array on a two-story house',
      'Wire the panels into a new inverter and main panel',
      'Install a battery backup system in the garage',
      'Troubleshoot an existing array that stopped producing',
      'Run a ground-mount solar install out in a field',
    ],
  },
};

const RANKS = ['Apprentice', 'Journeyman', 'Senior Tech', 'Lead / Foreman', 'Master', 'Owner-Operator'];

const VANS = [
  'A beat-to-hell Ford E-350 with 280k miles, check-engine light always on',
  'A brand-new decked-out Mercedes Sprinter, spotless and loaded',
  'A Ram ProMaster with a roof ladder rack and shelving in back',
  'A rusted-out Chevy Express cargo van that smells like grease',
  'A Ford Transit with custom shelving and the company logo wrapped on it',
];

// ===================== STATE =====================
const SAVE_KEY = 'tws_saved_shift_v1';
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || ('ontouchstart' in window);

let step = 0;
const STEPS = ['trade', 'rank', 'crew', 'job', 'van', 'company'];

let cfg = {
  trade: null,
  rank: null,
  crew: [],
  job: null,
  van: null,
  company: '',
  companyDesc: '',
};

let history = [];
let isStreaming = false;
let shiftStarted = false;

// ===================== ELEMENTS =====================
const setupEl = document.getElementById('setup');
const gameEl = document.getElementById('game');
const stepWrap = document.getElementById('stepWrap');
const progressEl = document.getElementById('progress');
const backBtn = document.getElementById('backBtn');
const nextBtn = document.getElementById('nextBtn');
const loadSavedBtn = document.getElementById('loadSavedBtn');

const chatArea = document.getElementById('chatArea');
const messagesEl = document.getElementById('messages');
const shiftBanner = document.getElementById('shiftBanner');
const startShiftBtn = document.getElementById('startShiftBtn');
const input = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const enterHint = document.getElementById('enterHint');

const hdrTitle = document.getElementById('hdrTitle');
const hdrSub = document.getElementById('hdrSub');
const crewBtn = document.getElementById('crewBtn');
const saveBtn = document.getElementById('saveBtn');
const quitBtn = document.getElementById('quitBtn');

const crewModal = document.getElementById('crewModal');
const crewEditList = document.getElementById('crewEditList');
const addCrewBtn = document.getElementById('addCrewBtn');
const saveCrewBtn = document.getElementById('saveCrewBtn');
const closeCrewBtn = document.getElementById('closeCrewBtn');

// ===================== WIZARD =====================
function renderProgress() {
  progressEl.innerHTML = STEPS.map((_, i) =>
    `<span class="dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}"></span>`
  ).join('');
}

function renderStep() {
  renderProgress();
  const name = STEPS[step];
  let html = '';

  if (name === 'trade') {
    html = `<h2 class="step-title">Pick your trade</h2>
      <div class="grid">${Object.entries(TRADES).map(([t, d]) =>
        `<button class="card ${cfg.trade === t ? 'selected' : ''}" data-trade="${t}">
          <span class="card-icon">${d.icon}</span><span>${t}</span>
        </button>`).join('')}</div>`;
  } else if (name === 'rank') {
    html = `<h2 class="step-title">What's your rank?</h2>
      <p class="step-help">You're a ${cfg.trade}. How high up the ladder?</p>
      <div class="grid two">${RANKS.map(r =>
        `<button class="card ${cfg.rank === r ? 'selected' : ''}" data-rank="${r}">${r}</button>`).join('')}</div>`;
  } else if (name === 'crew') {
    html = `<h2 class="step-title">Build your crew</h2>
      <p class="step-help">Add your coworkers and describe each one. The AI plays them.</p>
      <div id="crewBuild" class="crew-edit-list"></div>
      <button class="btn ghost full" id="crewAddInline">+ Add crew member</button>`;
  } else if (name === 'job') {
    html = `<h2 class="step-title">Today's job</h2>
      <p class="step-help">Pick a preset or write your own.</p>
      <div class="grid">${TRADES[cfg.trade].jobs.map(j =>
        `<button class="card job ${cfg.job === j ? 'selected' : ''}" data-job="${escAttr(j)}">${escHtml(j)}</button>`).join('')}</div>
      <input class="text-input" id="customJob" placeholder="…or type your own job" value="${!TRADES[cfg.trade].jobs.includes(cfg.job) && cfg.job ? escAttr(cfg.job) : ''}">`;
  } else if (name === 'van') {
    html = `<h2 class="step-title">Pick your van</h2>
      <div class="grid">${VANS.map((v, i) =>
        `<button class="card van ${cfg.van === v ? 'selected' : ''}" data-van="${i}">🚐 ${escHtml(v)}</button>`).join('')}</div>`;
  } else if (name === 'company') {
    html = `<h2 class="step-title">Your company</h2>
      <p class="step-help">Name it and describe it however you want.</p>
      <input class="text-input" id="companyName" placeholder="Company name (e.g. Big Mike's Plumbing)" value="${escAttr(cfg.company)}">
      <textarea class="text-input area" id="companyDesc" placeholder="Describe the company — vibe, reputation, the boss, whatever">${escHtml(cfg.companyDesc)}</textarea>`;
  }

  stepWrap.innerHTML = html;
  wireStep(name);
  backBtn.style.visibility = step === 0 ? 'hidden' : 'visible';
  nextBtn.textContent = step === STEPS.length - 1 ? 'Start ▶' : 'Next';
  loadSavedBtn.hidden = !(step === 0 && localStorage.getItem(SAVE_KEY));
}

function wireStep(name) {
  if (name === 'trade') {
    stepWrap.querySelectorAll('[data-trade]').forEach(b =>
      b.onclick = () => {
        if (cfg.trade !== b.dataset.trade) { cfg.job = null; } // reset job if trade changed
        cfg.trade = b.dataset.trade;
        renderStep();
      });
  } else if (name === 'rank') {
    stepWrap.querySelectorAll('[data-rank]').forEach(b =>
      b.onclick = () => { cfg.rank = b.dataset.rank; renderStep(); });
  } else if (name === 'crew') {
    renderCrewBuilder(document.getElementById('crewBuild'));
    document.getElementById('crewAddInline').onclick = () => {
      cfg.crew.push({ name: '', desc: '' });
      renderCrewBuilder(document.getElementById('crewBuild'));
    };
  } else if (name === 'job') {
    stepWrap.querySelectorAll('[data-job]').forEach(b =>
      b.onclick = () => {
        cfg.job = b.dataset.job;
        document.getElementById('customJob').value = '';
        renderStep();
      });
    document.getElementById('customJob').oninput = (e) => {
      if (e.target.value.trim()) {
        cfg.job = e.target.value.trim();
        stepWrap.querySelectorAll('.card.job').forEach(c => c.classList.remove('selected'));
      }
    };
  } else if (name === 'van') {
    stepWrap.querySelectorAll('[data-van]').forEach(b =>
      b.onclick = () => { cfg.van = VANS[+b.dataset.van]; renderStep(); });
  } else if (name === 'company') {
    document.getElementById('companyName').oninput = (e) => cfg.company = e.target.value;
    document.getElementById('companyDesc').oninput = (e) => cfg.companyDesc = e.target.value;
  }
}

function renderCrewBuilder(container) {
  if (!cfg.crew.length) cfg.crew.push({ name: '', desc: '' });
  container.innerHTML = cfg.crew.map((c, i) => `
    <div class="crew-row">
      <div class="crew-row-head">
        <span class="crew-num">#${i + 1}</span>
        <button class="icon-btn small" data-del="${i}">✕</button>
      </div>
      <input class="text-input" data-cname="${i}" placeholder="Crew member name" value="${escAttr(c.name)}">
      <textarea class="text-input area" data-cdesc="${i}" placeholder="Describe them — personality, attitude, how they talk">${escHtml(c.desc)}</textarea>
    </div>`).join('');
  container.querySelectorAll('[data-cname]').forEach(el =>
    el.oninput = e => cfg.crew[+el.dataset.cname].name = e.target.value);
  container.querySelectorAll('[data-cdesc]').forEach(el =>
    el.oninput = e => cfg.crew[+el.dataset.cdesc].desc = e.target.value);
  container.querySelectorAll('[data-del]').forEach(el =>
    el.onclick = () => { cfg.crew.splice(+el.dataset.del, 1); renderCrewBuilder(container); });
}

function canAdvance() {
  const name = STEPS[step];
  if (name === 'trade') return !!cfg.trade;
  if (name === 'rank') return !!cfg.rank;
  if (name === 'crew') return cfg.crew.some(c => c.name.trim());
  if (name === 'job') return !!(cfg.job && cfg.job.trim());
  if (name === 'van') return !!cfg.van;
  if (name === 'company') return !!cfg.company.trim();
  return true;
}

nextBtn.onclick = () => {
  if (!canAdvance()) {
    nextBtn.classList.add('shake');
    setTimeout(() => nextBtn.classList.remove('shake'), 400);
    return;
  }
  if (step === STEPS.length - 1) {
    cfg.crew = cfg.crew.filter(c => c.name.trim());
    startGame();
  } else {
    step++;
    renderStep();
  }
};

backBtn.onclick = () => { if (step > 0) { step--; renderStep(); } };

loadSavedBtn.onclick = () => {
  const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
  if (!saved) return;
  cfg = saved.cfg;
  history = saved.history || [];
  shiftStarted = saved.shiftStarted || false;
  startGame(true);
};

// ===================== GAME =====================
function startGame(resuming = false) {
  setupEl.hidden = true;
  gameEl.hidden = false;
  hdrTitle.textContent = `${cfg.rank} ${cfg.trade}`;
  hdrSub.textContent = cfg.company;
  enterHint.textContent = isMobile
    ? 'Return makes a new line — tap ▶ to send.'
    : 'Enter to send · Shift+Enter for a new line.';

  if (resuming) {
    messagesEl.innerHTML = '';
    history.forEach(m => appendMessage(m.role, m.content));
    if (shiftStarted) shiftBanner.hidden = true;
  } else {
    history = [];
    shiftStarted = false;
    messagesEl.innerHTML = '';
    shiftBanner.hidden = false;
  }
  scrollToBottom();
}

startShiftBtn.onclick = () => startShift();

function startShift() {
  if (shiftStarted) return;
  shiftStarted = true;
  shiftBanner.hidden = true;
  const crewNames = cfg.crew.map(c => c.name).join(', ') || 'your crew';
  sendToAI(`[SHIFT START: I just pulled up to the shop in ${cfg.van.split(',')[0]}. My crew (${crewNames}) is showing up for the job: ${cfg.job}. Have them arrive and greet me, in character. Remember — no narration, just the crew talking.]`, '*clocks in and rolls up to the shop*');
}

// ===================== CHAT =====================
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 160) + 'px';
  sendBtn.disabled = !input.value.trim() || isStreaming;
});

// iPhone / mobile: Return must NOT send — let it make a newline.
// Desktop keeps Enter-to-send (Shift+Enter = newline).
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
    e.preventDefault();
    if (!sendBtn.disabled) handleSend();
  }
});

sendBtn.addEventListener('click', handleSend);

function handleSend() {
  const text = input.value.trim();
  if (!text || isStreaming) return;
  input.value = '';
  input.style.height = 'auto';

  // Slash commands
  if (text === '/startshift') {
    if (!shiftStarted) startShift();
    return;
  }
  sendToAI(text);
}

async function sendToAI(text, displayText) {
  if (isStreaming) return;
  shiftBanner.hidden = true;
  isStreaming = true;
  sendBtn.disabled = true;
  sendBtn.classList.add('loading');

  history.push({ role: 'user', content: text });
  appendMessage('user', displayText || text);

  const { bubble, cursor } = createAssistantBubble();
  scrollToBottom();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history, gameConfig: cfg }),
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
            bubble.innerHTML = `<div class="error-msg">${escHtml(parsed.error)}</div>`;
            cursor.remove();
            break;
          }
          if (parsed.text) {
            assistantText += parsed.text;
            bubble.innerHTML = renderText(assistantText);
            bubble.appendChild(cursor);
            scrollToBottom();
          }
        } catch {}
      }
    }
    cursor.remove();
    if (assistantText) {
      history.push({ role: 'assistant', content: assistantText });
      bubble.innerHTML = renderText(assistantText);
    }
    autosave();
  } catch (err) {
    cursor.remove();
    bubble.innerHTML = `<div class="error-msg">Connection error: ${escHtml(err.message)}</div>`;
  }

  isStreaming = false;
  sendBtn.classList.remove('loading');
  sendBtn.disabled = !input.value.trim();
  scrollToBottom();
}

function appendMessage(role, content) {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = role === 'user' ? escHtml(content) : renderText(content);
  div.appendChild(bubble);
  messagesEl.appendChild(div);
  return bubble;
}

function createAssistantBubble() {
  const div = document.createElement('div');
  div.className = 'message assistant';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  const cursor = document.createElement('span');
  cursor.className = 'typing-cursor';
  bubble.appendChild(cursor);
  div.appendChild(bubble);
  messagesEl.appendChild(div);
  return { bubble, cursor };
}

function scrollToBottom() { chatArea.scrollTop = chatArea.scrollHeight; }

// ===================== CREW MODAL =====================
crewBtn.onclick = () => {
  renderCrewEditor();
  crewModal.hidden = false;
};
closeCrewBtn.onclick = () => { crewModal.hidden = true; };
addCrewBtn.onclick = () => {
  cfg.crew.push({ name: '', desc: '' });
  renderCrewEditor();
};
saveCrewBtn.onclick = () => {
  cfg.crew = cfg.crew.filter(c => c.name.trim());
  crewModal.hidden = true;
  autosave();
};
function renderCrewEditor() { renderCrewBuilder(crewEditList); }

// ===================== SAVE / LOAD =====================
function autosave() {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ cfg, history, shiftStarted, ts: Date.now() }));
}
saveBtn.onclick = () => {
  autosave();
  saveBtn.textContent = '✅';
  setTimeout(() => (saveBtn.textContent = '💾'), 1200);
};
quitBtn.onclick = () => {
  if (!confirm('End shift and go back to setup? Your shift is saved — you can load it again.')) return;
  autosave();
  gameEl.hidden = true;
  setupEl.hidden = false;
  step = 0;
  renderStep();
};

// ===================== RENDER / UTIL =====================
function escHtml(str = '') {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function escAttr(str = '') { return escHtml(str); }

function renderText(text) {
  let html = escHtml(text);
  // emphasize *actions* in asterisks
  html = html.replace(/\*([^*\n]+)\*/g, '<span class="action">*$1*</span>');
  return html.replace(/\n/g, '<br>');
}

// ===================== INIT =====================
renderStep();
