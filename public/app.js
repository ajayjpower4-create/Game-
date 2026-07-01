// ===== Billionaire Simulator =====

const SAVE_KEY = 'billionaire-sim-save-v1';

// Screens
const startScreen = document.getElementById('startScreen');
const setupScreen = document.getElementById('setupScreen');
const gameScreen = document.getElementById('gameScreen');

// Start screen
const newGameBtn = document.getElementById('newGameBtn');
const continueBtn = document.getElementById('continueBtn');
const saveInfo = document.getElementById('saveInfo');

// Wizard
const steps = Array.from(document.querySelectorAll('.step'));
const progressBar = document.getElementById('progressBar');
const backBtn = document.getElementById('backBtn');
const nextBtn = document.getElementById('nextBtn');

// Game
const headerName = document.getElementById('headerName');
const chatArea = document.getElementById('chatArea');
const messagesEl = document.getElementById('messages');
const gameIntro = document.getElementById('gameIntro');
const input = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const saveBtn = document.getElementById('saveBtn');
const menuBtn = document.getElementById('menuBtn');

let profile = null;
let history = [];
let isStreaming = false;

let currentStep = 0;
const wizard = {
  tier: null,
  hasGf: null,
  hasKids: null,
  villa: null,
  jet: null,
  yacht: null,
  cars: null,
};

// ============ START SCREEN ============

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.profile || !Array.isArray(data.history)) return null;
    return data;
  } catch {
    return null;
  }
}

function refreshStartScreen() {
  const save = loadSave();
  if (save) {
    continueBtn.classList.remove('hidden');
    saveInfo.classList.remove('hidden');
    const when = save.savedAt ? new Date(save.savedAt).toLocaleString() : 'unknown';
    saveInfo.textContent = `Saved game: ${save.profile.name} (${save.profile.tier}) — ${when}`;
  } else {
    continueBtn.classList.add('hidden');
    saveInfo.classList.add('hidden');
  }
}

newGameBtn.addEventListener('click', () => {
  const save = loadSave();
  if (save && !confirm('Starting a new game will overwrite your saved game when you play. Continue?')) return;
  showScreen(setupScreen);
  goToStep(0);
});

continueBtn.addEventListener('click', () => {
  const save = loadSave();
  if (!save) return refreshStartScreen();
  profile = save.profile;
  history = save.history;
  startGame(true);
});

function showScreen(screen) {
  for (const s of [startScreen, setupScreen, gameScreen]) s.classList.add('hidden');
  screen.classList.remove('hidden');
}

// ============ SETUP WIZARD ============

function goToStep(n) {
  currentStep = n;
  steps.forEach(s => s.classList.toggle('hidden', Number(s.dataset.step) !== n));
  progressBar.style.width = `${((n + 1) / steps.length) * 100}%`;
  backBtn.textContent = n === 0 ? 'Cancel' : 'Back';
  nextBtn.textContent = n === steps.length - 1 ? 'Start Living Rich' : 'Next';
}

backBtn.addEventListener('click', () => {
  if (currentStep === 0) {
    showScreen(startScreen);
    refreshStartScreen();
  } else {
    goToStep(currentStep - 1);
  }
});

nextBtn.addEventListener('click', () => {
  if (!validateStep(currentStep)) return;
  if (currentStep === steps.length - 1) {
    finishSetup();
  } else {
    goToStep(currentStep + 1);
  }
});

function flash(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

function validateStep(n) {
  switch (n) {
    case 0: {
      const el = document.getElementById('nameInput');
      if (!el.value.trim()) { flash(el); return false; }
      return true;
    }
    case 1:
      if (!wizard.tier) { flash(document.getElementById('tierOptions')); return false; }
      return true;
    case 2: {
      const el = document.getElementById('knownForInput');
      if (!el.value.trim()) { flash(el); return false; }
      return true;
    }
    case 3:
      if (wizard.hasGf === null) { flash(document.getElementById('gfToggle')); return false; }
      if (wizard.hasGf) {
        const el = document.getElementById('gfNameInput');
        if (!el.value.trim()) { flash(el); return false; }
      }
      return true;
    case 4:
      if (wizard.hasKids === null) { flash(document.getElementById('kidsToggle')); return false; }
      if (wizard.hasKids) {
        const names = Array.from(document.querySelectorAll('.kid-name'));
        if (names.length === 0 || names.some(i => !i.value.trim())) {
          if (names.length === 0) addKidRow();
          names.forEach(i => { if (!i.value.trim()) flash(i); });
          return false;
        }
      }
      return true;
    case 5:
      if (!wizard.villa) { flash(document.getElementById('villaOptions')); return false; }
      return true;
    case 6:
      if (!wizard.jet) { flash(document.getElementById('jetOptions')); return false; }
      return true;
    case 7:
      if (!wizard.yacht) { flash(document.getElementById('yachtOptions')); return false; }
      return true;
    case 8:
      if (!wizard.cars) { flash(document.getElementById('carsOptions')); return false; }
      return true;
  }
  return true;
}

// Option-card selection helpers
function wireOptionGroup(containerId, key, onSelect) {
  const container = document.getElementById(containerId);
  container.addEventListener('click', (e) => {
    const card = e.target.closest('.option-card');
    if (!card) return;
    container.querySelectorAll('.option-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    wizard[key] = card.dataset.value;
    if (onSelect) onSelect(card.dataset.value);
  });
}

wireOptionGroup('tierOptions', 'tier');
wireOptionGroup('villaOptions', 'villa');
wireOptionGroup('jetOptions', 'jet');
wireOptionGroup('yachtOptions', 'yacht');
wireOptionGroup('carsOptions', 'cars');

// Girlfriend yes/no
document.getElementById('gfToggle').addEventListener('click', (e) => {
  const card = e.target.closest('.option-card');
  if (!card) return;
  document.querySelectorAll('#gfToggle .option-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  wizard.hasGf = card.dataset.value === 'yes';
  document.getElementById('gfForm').classList.toggle('hidden', !wizard.hasGf);
});

// Kids yes/no
document.getElementById('kidsToggle').addEventListener('click', (e) => {
  const card = e.target.closest('.option-card');
  if (!card) return;
  document.querySelectorAll('#kidsToggle .option-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  wizard.hasKids = card.dataset.value === 'yes';
  document.getElementById('kidsForm').classList.toggle('hidden', !wizard.hasKids);
  if (wizard.hasKids && document.querySelectorAll('.kid-row').length === 0) addKidRow();
});

document.getElementById('addKidBtn').addEventListener('click', addKidRow);

function addKidRow() {
  const list = document.getElementById('kidsList');
  const row = document.createElement('div');
  row.className = 'kid-row';
  row.innerHTML = `
    <div class="kid-row-head">
      <input type="text" class="text-input kid-name" placeholder="Kid's name" maxlength="60" enterkeyhint="done">
      <button class="remove-kid" title="Remove" aria-label="Remove kid">✕</button>
    </div>
    <textarea class="text-input area kid-desc" placeholder="Describe them (e.g. 16, spoiled, wants a Lambo for their birthday...)" maxlength="300" rows="2" enterkeyhint="enter"></textarea>
  `;
  row.querySelector('.remove-kid').addEventListener('click', () => row.remove());
  list.appendChild(row);
}

function finishSetup() {
  const kids = Array.from(document.querySelectorAll('.kid-row')).map(row => ({
    name: row.querySelector('.kid-name').value.trim(),
    description: row.querySelector('.kid-desc').value.trim(),
  })).filter(k => k.name);

  profile = {
    name: document.getElementById('nameInput').value.trim(),
    tier: wizard.tier,
    knownFor: document.getElementById('knownForInput').value.trim(),
    companies: document.getElementById('companiesInput').value.trim(),
    tvShows: document.getElementById('tvShowsInput').value.trim(),
    girlfriend: wizard.hasGf ? {
      name: document.getElementById('gfNameInput').value.trim(),
      description: document.getElementById('gfDescInput').value.trim(),
    } : null,
    kids: wizard.hasKids ? kids : [],
    villa: wizard.villa === 'none' ? null : wizard.villa,
    jet: wizard.jet === 'none' ? null : wizard.jet,
    yacht: wizard.yacht === 'none' ? null : wizard.yacht,
    cars: wizard.cars === 'none' ? null : wizard.cars,
  };

  history = [];
  saveGame();
  startGame(false);
}

// ============ SAVE SYSTEM ============

function saveGame() {
  if (!profile) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      profile,
      history,
      savedAt: Date.now(),
    }));
  } catch { /* storage full or unavailable */ }
}

saveBtn.addEventListener('click', () => {
  saveGame();
  saveBtn.textContent = 'Saved ✓';
  setTimeout(() => { saveBtn.textContent = 'Save'; }, 1500);
});

// Auto-save whenever the user leaves / backgrounds the app (covers iPhone app switch & close)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveGame();
});
window.addEventListener('pagehide', saveGame);

menuBtn.addEventListener('click', () => {
  saveGame();
  showScreen(startScreen);
  refreshStartScreen();
});

// ============ GAME ============

function startGame(restored) {
  headerName.textContent = profile.name;
  messagesEl.innerHTML = '';
  gameIntro.style.display = restored && history.length > 0 ? 'none' : 'block';
  for (const m of history) appendMessage(m.role, m.content);
  showScreen(gameScreen);
  scrollToBottom();
}

// Auto-resize textarea
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 160) + 'px';
  sendBtn.disabled = !input.value.trim() || isStreaming;
});

// NOTE: Enter / the iPhone return key intentionally does NOT send.
// It just inserts a new line — only the send button sends the message.

sendBtn.addEventListener('click', sendMessage);

async function sendMessage() {
  const text = input.value.trim();
  if (!text || isStreaming) return;

  gameIntro.style.display = 'none';
  isStreaming = true;
  sendBtn.disabled = true;
  sendBtn.classList.add('loading');

  history.push({ role: 'user', content: text });
  appendMessage('user', text);

  input.value = '';
  input.style.height = 'auto';

  const { bubble, cursor } = createAssistantBubble();
  scrollToBottom();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile, messages: history }),
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
            bubble.innerHTML = renderDialogue(assistantText);
            bubble.appendChild(cursor);
            scrollToBottom();
          }
        } catch { /* partial line */ }
      }
    }

    cursor.remove();
    if (assistantText) {
      history.push({ role: 'assistant', content: assistantText });
      bubble.innerHTML = renderDialogue(assistantText);
      saveGame();
    }
  } catch (err) {
    cursor.remove();
    bubble.innerHTML = `<div class="error-msg">Connection error: ${escapeHtml(err.message)}</div>`;
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
  bubble.innerHTML = role === 'user' ? renderPlayerText(content) : renderDialogue(content);

  div.appendChild(bubble);
  messagesEl.appendChild(div);
  scrollToBottom();
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

// Player messages: *actions* italicized
function renderPlayerText(text) {
  let html = escapeHtml(text);
  html = html.replace(/\*([^*\n]+)\*/g, '<em class="action">*$1*</em>');
  return html.replace(/\n/g, '<br>');
}

// Character dialogue: "Name: line" gets a styled name, *actions* italicized
function renderDialogue(text) {
  const lines = escapeHtml(text).split('\n');
  const out = [];
  for (let line of lines) {
    if (!line.trim()) continue;
    line = line.replace(/\*([^*\n]+)\*/g, '<em class="action">*$1*</em>');
    const m = line.match(/^([^:<]{1,40}?):\s+(.*)$/);
    if (m) {
      out.push(`<p class="dialogue-line"><span class="char-name">${m[1]}:</span> ${m[2]}</p>`);
    } else {
      out.push(`<p class="dialogue-line">${line}</p>`);
    }
  }
  return out.join('');
}

// ============ INIT ============
refreshStartScreen();
