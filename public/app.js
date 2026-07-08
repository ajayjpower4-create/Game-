// ===== Criminal Simulator =====

const SAVE_KEY = 'criminal-simulator-save';

// On touch devices (iPhone etc.) the return key must NOT send —
// it just makes a new line. Sending is only via the send button.
const IS_TOUCH = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// ---- state ----
let state = {
  phase: 'title',          // title | setup | game
  step: 'country',         // current wizard step
  setup: {
    country: '',
    hasCompound: false,
    compoundSize: '',
    compoundContents: '',
    crime: '',
    crew: [],              // [{name, role, personality}]
    vehicles: '',
    tools: '',
  },
  crewAnswers: { size: '', bond: '', strength: '', temper: '' },
  messages: [],            // [{role, content}]
};

let isStreaming = false;

// ---- elements ----
const $ = id => document.getElementById(id);
const screens = {
  title: $('screen-title'),
  setup: $('screen-setup'),
  game: $('screen-game'),
};

// ---- save / load ----
function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    flashAutosave();
  } catch (e) { /* storage full or blocked — game keeps running */ }
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

function flashAutosave() {
  const note = $('autosaveNote');
  if (!note) return;
  note.classList.add('show');
  clearTimeout(flashAutosave._t);
  flashAutosave._t = setTimeout(() => note.classList.remove('show'), 1200);
}

// ---- screen / step routing ----
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
  state.phase = name;
}

const STEP_ORDER = ['country', 'compound', 'compoundDetails', 'crime', 'crewChoice', 'crewOwn', 'crewAuto', 'crewReview', 'vehicles', 'tools'];
const PROGRESS_STEPS = ['country', 'compound', 'crime', 'crew', 'vehicles', 'tools'];

function showStep(name) {
  document.querySelectorAll('.step').forEach(s => s.classList.add('hidden'));
  const el = document.querySelector(`.step[data-step="${name}"]`);
  if (el) el.classList.remove('hidden');
  state.step = name;
  renderProgress(name);
  save();
}

function renderProgress(step) {
  const map = { country: 0, compound: 1, compoundDetails: 1, crime: 2, crewChoice: 3, crewOwn: 3, crewAuto: 3, crewReview: 3, vehicles: 4, tools: 5 };
  const idx = map[step] ?? 0;
  $('setupProgress').innerHTML = PROGRESS_STEPS
    .map((s, i) => `<span class="dot ${i < idx ? 'done' : ''} ${i === idx ? 'now' : ''}"></span>`)
    .join('');
}

// ---- title screen ----
$('btnNewGame').addEventListener('click', () => {
  localStorage.removeItem(SAVE_KEY);
  state = {
    phase: 'setup',
    step: 'country',
    setup: { country: '', hasCompound: false, compoundSize: '', compoundContents: '', crime: '', crew: [], vehicles: '', tools: '' },
    crewAnswers: { size: '', bond: '', strength: '', temper: '' },
    messages: [],
  };
  showScreen('setup');
  showStep('country');
});

$('btnContinue').addEventListener('click', () => {
  const saved = load();
  if (!saved) return;
  state = saved;
  if (state.phase === 'game') {
    showScreen('game');
    restoreGame();
  } else {
    showScreen('setup');
    showStep(state.step || 'country');
    restoreWizardInputs();
  }
});

// ---- chip groups: single-select ----
function wireChips(containerId, onPick) {
  const box = $(containerId);
  box.addEventListener('click', e => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    box.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
    chip.classList.add('selected');
    onPick(chip.dataset.value);
  });
}

// ---- step: country ----
wireChips('countryChips', v => {
  state.setup.country = v;
  $('countryInput').value = '';
  $('btnCountryNext').disabled = false;
  save();
});
$('countryInput').addEventListener('input', () => {
  const v = $('countryInput').value.trim();
  if (v) {
    document.querySelectorAll('#countryChips .chip').forEach(c => c.classList.remove('selected'));
    state.setup.country = v;
  }
  $('btnCountryNext').disabled = !state.setup.country;
});
$('btnCountryNext').addEventListener('click', () => showStep('compound'));

// ---- step: compound yes/no ----
$('btnCompoundYes').addEventListener('click', () => {
  state.setup.hasCompound = true;
  showStep('compoundDetails');
});
$('btnCompoundNo').addEventListener('click', () => {
  state.setup.hasCompound = false;
  state.setup.compoundSize = '';
  state.setup.compoundContents = '';
  showStep('crime');
});

// ---- step: compound details ----
wireChips('sizeChips', v => {
  state.setup.compoundSize = v;
  checkCompoundReady();
  save();
});
$('compoundContentsInput').addEventListener('input', checkCompoundReady);
function checkCompoundReady() {
  state.setup.compoundContents = $('compoundContentsInput').value.trim();
  $('btnCompoundNext').disabled = !(state.setup.compoundSize && state.setup.compoundContents);
}
$('btnCompoundNext').addEventListener('click', () => showStep('crime'));

// ---- step: crime ----
wireChips('crimeChips', v => {
  state.setup.crime = v;
  $('crimeInput').value = '';
  $('btnCrimeNext').disabled = false;
  save();
});
$('crimeInput').addEventListener('input', () => {
  const v = $('crimeInput').value.trim();
  if (v) {
    document.querySelectorAll('#crimeChips .chip').forEach(c => c.classList.remove('selected'));
    state.setup.crime = v;
  }
  $('btnCrimeNext').disabled = !state.setup.crime;
});
$('btnCrimeNext').addEventListener('click', () => showStep('crewChoice'));

// ---- step: crew choice ----
$('btnCrewOwn').addEventListener('click', () => showStep('crewOwn'));
$('btnCrewAuto').addEventListener('click', () => showStep('crewAuto'));

// ---- step: crew manual ----
$('crewOwnInput').addEventListener('input', () => {
  $('btnCrewOwnNext').disabled = !$('crewOwnInput').value.trim();
});
$('btnCrewOwnNext').addEventListener('click', () => {
  const lines = $('crewOwnInput').value.split('\n').map(l => l.trim()).filter(Boolean);
  state.setup.crew = lines.map(line => {
    const parts = line.split(/\s*[-–—]\s*/);
    return {
      name: parts[0] || 'Unknown',
      role: parts[1] || 'crew member',
      personality: parts.slice(2).join(' - ') || 'loud and unpredictable',
    };
  });
  renderCrewList();
  showStep('crewReview');
});

// ---- step: crew auto (the questions) ----
wireChips('crewSizeChips', v => { state.crewAnswers.size = v; checkCrewAutoReady(); });
wireChips('crewBondChips', v => { state.crewAnswers.bond = v; checkCrewAutoReady(); });
wireChips('crewStrengthChips', v => { state.crewAnswers.strength = v; checkCrewAutoReady(); });
wireChips('crewTemperChips', v => { state.crewAnswers.temper = v; checkCrewAutoReady(); });
function checkCrewAutoReady() {
  const a = state.crewAnswers;
  $('btnGenerateCrew').disabled = !(a.size && a.bond && a.strength && a.temper);
  save();
}

async function generateCrew() {
  const btn = $('btnGenerateCrew');
  const regen = $('btnRegenCrew');
  btn.disabled = true; regen.disabled = true;
  btn.textContent = 'DEALING...'; regen.textContent = 'DEALING...';
  try {
    const res = await fetch('/api/generate-crew', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...state.crewAnswers,
        country: state.setup.country,
        crime: state.setup.crime,
      }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    state.setup.crew = data.crew;
    renderCrewList();
    showStep('crewReview');
  } catch (err) {
    alert(err.message || 'Could not generate crew. Try again.');
  } finally {
    btn.disabled = false; regen.disabled = false;
    btn.textContent = 'GENERATE CREW'; regen.textContent = 'REROLL';
  }
}
$('btnGenerateCrew').addEventListener('click', generateCrew);
$('btnRegenCrew').addEventListener('click', () => {
  // reroll only makes sense for auto-generated crews
  const a = state.crewAnswers;
  if (a.size && a.bond && a.strength && a.temper) generateCrew();
  else showStep('crewOwn');
});

function renderCrewList() {
  $('crewList').innerHTML = state.setup.crew.map(c => `
    <div class="crew-card">
      <div class="crew-name">${esc(c.name)}</div>
      <div class="crew-role">${esc(c.role)}</div>
      <div class="crew-personality">${esc(c.personality)}</div>
    </div>
  `).join('');
}

$('btnCrewAccept').addEventListener('click', () => showStep('vehicles'));

// ---- step: vehicles ----
$('btnVehiclesNext').addEventListener('click', () => {
  state.setup.vehicles = $('vehiclesInput').value.trim();
  showStep('tools');
});

// ---- step: tools -> start game ----
$('btnStartGame').addEventListener('click', () => {
  state.setup.tools = $('toolsInput').value.trim();
  state.messages = [];
  showScreen('game');
  setupHud();
  save();
  appendSystemNote('Your crew is here. You talk first, boss.');
});

// ---- restore helpers ----
function restoreWizardInputs() {
  $('compoundContentsInput').value = state.setup.compoundContents || '';
  $('vehiclesInput').value = state.setup.vehicles || '';
  $('toolsInput').value = state.setup.tools || '';
  if (state.setup.crew.length) renderCrewList();
}

function restoreGame() {
  setupHud();
  $('messages').innerHTML = '';
  state.messages.forEach(m => {
    if (m.role === 'user') appendUserBubble(m.content);
    else appendCrewMessage(m.content);
  });
  scrollToBottom();
}

function setupHud() {
  $('hudCrime').textContent = state.setup.crime ? cap(state.setup.crime) : 'Criminal Simulator';
  $('hudCountry').textContent = state.setup.country + (state.setup.hasCompound ? ' · ' + cap(state.setup.compoundSize) : '');
}

// ---- game chat ----
const input = $('messageInput');
const sendBtn = $('sendBtn');
const messagesEl = $('messages');
const chatArea = $('chatArea');

input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 160) + 'px';
  sendBtn.disabled = !input.value.trim() || isStreaming;
});

// Enter-to-send is desktop only. On iPhone / any touch device the
// return key just inserts a newline and never sends.
input.addEventListener('keydown', e => {
  if (IS_TOUCH) return;
  if (e.key === 'Enter' && !e.shiftKey) {
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
  sendBtn.disabled = true;
  sendToCrew(text);
}

async function sendToCrew(text) {
  isStreaming = true;
  state.messages.push({ role: 'user', content: text });
  appendUserBubble(text);
  save(); // auto-save every message
  scrollToBottom();

  const typing = appendTyping();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: state.messages, setup: state.setup }),
    });

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';
    let buffer = '';
    let container = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop();
      for (const part of parts) {
        if (!part.startsWith('data: ')) continue;
        const payload = part.slice(6);
        if (payload === '[DONE]') continue;
        let data;
        try { data = JSON.parse(payload); } catch { continue; }
        if (data.error) throw new Error(data.error);
        if (data.text) {
          full += data.text;
          if (!container) {
            typing.remove();
            container = document.createElement('div');
            container.className = 'crew-msg';
            messagesEl.appendChild(container);
          }
          renderCrewLines(container, full);
          scrollToBottom();
        }
      }
    }

    typing.remove();
    if (full) {
      state.messages.push({ role: 'assistant', content: full });
      save(); // auto-save every message
    }
  } catch (err) {
    typing.remove();
    appendSystemNote(err.message || 'Connection lost. Say that again, boss.');
  } finally {
    isStreaming = false;
    sendBtn.disabled = !input.value.trim();
  }
}

// ---- rendering ----
function esc(s) {
  const d = document.createElement('div');
  d.textContent = s ?? '';
  return d.innerHTML;
}

function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function appendUserBubble(text) {
  const el = document.createElement('div');
  el.className = 'user-msg';
  el.innerHTML = `<div class="bubble">${esc(text)}</div>`;
  messagesEl.appendChild(el);
}

// Parse "NAME: dialogue" lines into styled speaker bubbles
function renderCrewLines(container, raw) {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  let html = '';
  for (const line of lines) {
    const m = line.match(/^([A-Za-zÀ-ÿ0-9 .'"-]{1,30}):\s*(.+)$/s);
    if (m) {
      html += `<div class="crew-line">
        <span class="speaker">${esc(m[1].toUpperCase())}</span>
        <span class="dialogue">${formatDialogue(m[2])}</span>
      </div>`;
    } else {
      html += `<div class="crew-line"><span class="dialogue">${formatDialogue(line)}</span></div>`;
    }
  }
  container.innerHTML = html;
}

// *actions* rendered in italics
function formatDialogue(text) {
  return esc(text).replace(/\*([^*]+)\*/g, '<em class="action">$1</em>');
}

function appendCrewMessage(raw) {
  const container = document.createElement('div');
  container.className = 'crew-msg';
  messagesEl.appendChild(container);
  renderCrewLines(container, raw);
}

function appendTyping() {
  const el = document.createElement('div');
  el.className = 'typing';
  el.innerHTML = '<span></span><span></span><span></span>';
  messagesEl.appendChild(el);
  scrollToBottom();
  return el;
}

function appendSystemNote(text) {
  const el = document.createElement('div');
  el.className = 'system-note';
  el.textContent = text;
  messagesEl.appendChild(el);
  scrollToBottom();
}

function scrollToBottom() {
  chatArea.scrollTop = chatArea.scrollHeight;
}

// ---- new game from inside the game ----
$('btnNewGameInGame').addEventListener('click', () => {
  if (!confirm('Start a new game? Your current run will be wiped.')) return;
  localStorage.removeItem(SAVE_KEY);
  location.reload();
});

// ---- boot ----
(function boot() {
  const saved = load();
  if (saved && (saved.phase === 'game' || saved.phase === 'setup')) {
    $('btnContinue').classList.remove('hidden');
  }
  showScreen('title');
})();
