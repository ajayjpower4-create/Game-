// ===== Business Simulator =====
// NOTE: There is intentionally NO Enter/Return-to-send handler.
// The return key only inserts a newline; messages send via the send button.

const $ = id => document.getElementById(id);

const screens = {
  home: $('homeScreen'),
  setup: $('setupScreen'),
  game: $('gameScreen'),
};

const SAVES_KEY = 'bizsim_saves';

let currentSave = null;   // { id, createdAt, updatedAt, profile, messages }
let isStreaming = false;

// ---------- Saves (localStorage) ----------

function loadSaves() {
  try {
    return JSON.parse(localStorage.getItem(SAVES_KEY)) || {};
  } catch {
    return {};
  }
}

function persistSave() {
  if (!currentSave) return;
  currentSave.updatedAt = Date.now();
  const saves = loadSaves();
  saves[currentSave.id] = currentSave;
  localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
  flashAutosave();
}

function deleteSave(id) {
  const saves = loadSaves();
  delete saves[id];
  localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
  renderSavesList();
}

function flashAutosave() {
  const tag = $('autosaveTag');
  tag.classList.add('show');
  clearTimeout(flashAutosave._t);
  flashAutosave._t = setTimeout(() => tag.classList.remove('show'), 1500);
}

// Auto-save whenever the player leaves the page / backgrounds the app
window.addEventListener('pagehide', () => { if (currentSave) persistSave(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && currentSave) persistSave();
});

// ---------- Screen switching ----------

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.add('hidden'));
  screens[name].classList.remove('hidden');
  window.scrollTo(0, 0);
}

// ---------- Home ----------

function renderSavesList() {
  const saves = Object.values(loadSaves()).sort((a, b) => b.updatedAt - a.updatedAt);
  const list = $('savesList');
  list.innerHTML = '';
  $('savesEmpty').style.display = saves.length ? 'none' : 'block';

  for (const save of saves) {
    const card = document.createElement('div');
    card.className = 'save-card';

    const info = document.createElement('div');
    info.className = 'save-info';
    const b = save.profile.business || {};
    info.innerHTML =
      `<strong>${escapeHtml(b.name || 'Unnamed business')}</strong>` +
      `<span>${escapeHtml(b.type || '')} · ${escapeHtml(b.location || '')}</span>` +
      `<span class="save-date">Last played ${new Date(save.updatedAt).toLocaleString()}</span>`;

    const actions = document.createElement('div');
    actions.className = 'save-actions';

    const playBtn = document.createElement('button');
    playBtn.className = 'btn btn-primary btn-small';
    playBtn.textContent = 'Play';
    playBtn.addEventListener('click', () => openGame(save));

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-danger btn-small';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => {
      if (confirm(`Delete "${b.name || 'this business'}" forever?`)) deleteSave(save.id);
    });

    actions.appendChild(playBtn);
    actions.appendChild(delBtn);
    card.appendChild(info);
    card.appendChild(actions);
    list.appendChild(card);
  }
}

$('newGameBtn').addEventListener('click', startSetup);

// ---------- Setup wizard ----------

const TOTAL_STEPS = 4;
const STEP_TITLES = ['Create Your Character', 'Create Your Business', 'Pick Your Staff', 'Final Details'];
let setupStep = 1;
let setupData = null;

function startSetup() {
  setupStep = 1;
  setupData = {
    character: {},
    business: {},
    staffMode: null,
    staff: null,
  };
  // reset inputs
  ['charName', 'charAge', 'charDetails', 'bizName', 'bizType', 'staffRoles',
   'staffNotes', 'staffManualText', 'bizHours', 'bizBudget', 'bizExtra']
    .forEach(id => { $(id).value = ''; });
  $('staffCount').value = 4;
  $('staffVibe').selectedIndex = 0;
  $('staffExp').selectedIndex = 0;
  $('staffRoster').innerHTML = '';
  document.querySelectorAll('#locationChoices .choice, #staffModeChoices .choice')
    .forEach(c => c.classList.remove('selected'));
  $('staffAutoPanel').classList.add('hidden');
  $('staffManualPanel').classList.add('hidden');
  renderSetupStep();
  showScreen('setup');
}

function renderSetupStep() {
  document.querySelectorAll('.setup-step').forEach(el => {
    el.classList.toggle('hidden', Number(el.dataset.step) !== setupStep);
  });
  $('setupTitle').textContent = STEP_TITLES[setupStep - 1];
  $('setupNextBtn').textContent = setupStep === TOTAL_STEPS ? '🚀 Open For Business' : 'Next →';
  $('stepDots').innerHTML = Array.from({ length: TOTAL_STEPS }, (_, i) =>
    `<span class="dot${i + 1 === setupStep ? ' active' : ''}"></span>`).join('');
  hideSetupError();
}

function showSetupError(msg) {
  const el = $('setupError');
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideSetupError() {
  $('setupError').classList.add('hidden');
}

$('setupBackBtn').addEventListener('click', () => {
  if (setupStep > 1) {
    setupStep--;
    renderSetupStep();
  } else {
    showScreen('home');
    renderSavesList();
  }
});

// Location choices
document.querySelectorAll('#locationChoices .choice').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#locationChoices .choice').forEach(c => c.classList.remove('selected'));
    btn.classList.add('selected');
    setupData.business.location = btn.dataset.value;
  });
});

// Staff mode choices
document.querySelectorAll('#staffModeChoices .choice').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#staffModeChoices .choice').forEach(c => c.classList.remove('selected'));
    btn.classList.add('selected');
    setupData.staffMode = btn.dataset.value;
    $('staffAutoPanel').classList.toggle('hidden', btn.dataset.value !== 'auto');
    $('staffManualPanel').classList.toggle('hidden', btn.dataset.value !== 'manual');
  });
});

// Staff generation
$('generateStaffBtn').addEventListener('click', async () => {
  const btn = $('generateStaffBtn');
  btn.disabled = true;
  btn.textContent = 'Generating...';
  hideSetupError();
  try {
    const res = await fetch('/api/generate-staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business: {
          name: $('bizName').value.trim(),
          type: $('bizType').value.trim(),
          location: setupData.business.location || '',
        },
        count: $('staffCount').value,
        roles: $('staffRoles').value.trim(),
        vibe: $('staffVibe').value,
        experience: $('staffExp').value,
        notes: $('staffNotes').value.trim(),
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || `Server error ${res.status}`);
    setupData.staff = data.staff;
    renderStaffRoster(data.staff);
  } catch (err) {
    showSetupError(`Couldn't generate staff: ${err.message}`);
  }
  btn.disabled = false;
  btn.textContent = '🎲 Regenerate Staff';
});

function renderStaffRoster(staff) {
  const roster = $('staffRoster');
  roster.innerHTML = '';
  for (const s of staff) {
    const card = document.createElement('div');
    card.className = 'staff-card';
    card.innerHTML =
      `<strong>${escapeHtml(s.name)}</strong> <span class="staff-meta">${escapeHtml(String(s.age))} · ${escapeHtml(s.role)}</span>` +
      `<p>${escapeHtml(s.personality)}</p>`;
    roster.appendChild(card);
  }
}

// Next / finish
$('setupNextBtn').addEventListener('click', () => {
  if (!validateStep(setupStep)) return;
  if (setupStep < TOTAL_STEPS) {
    setupStep++;
    renderSetupStep();
  } else {
    finishSetup();
  }
});

function validateStep(step) {
  hideSetupError();
  if (step === 1) {
    const name = $('charName').value.trim();
    const age = $('charAge').value.trim();
    if (!name) return showSetupError('Give your character a name.'), false;
    if (!age) return showSetupError('How old are you?'), false;
    setupData.character = { name, age, details: $('charDetails').value.trim() };
  }
  if (step === 2) {
    const name = $('bizName').value.trim();
    const type = $('bizType').value.trim();
    if (!name) return showSetupError('Name your business.'), false;
    if (!type) return showSetupError('What kind of business is it?'), false;
    if (!setupData.business.location) return showSetupError('Pick a location.'), false;
    setupData.business.name = name;
    setupData.business.type = type;
  }
  if (step === 3) {
    if (!setupData.staffMode) return showSetupError('Pick how you want to staff up.'), false;
    if (setupData.staffMode === 'auto') {
      if (!setupData.staff || !setupData.staff.length)
        return showSetupError('Generate your staff first.'), false;
    } else {
      const text = $('staffManualText').value.trim();
      if (!text) return showSetupError('Type in your staff (or switch to auto-generate).'), false;
      setupData.staff = text;
    }
  }
  if (step === 4) {
    const hours = $('bizHours').value.trim();
    const budget = $('bizBudget').value.trim();
    if (!hours) return showSetupError('Set your opening hours.'), false;
    if (!budget) return showSetupError('Set your starting budget.'), false;
    setupData.business.hours = hours;
    setupData.business.budget = budget;
    setupData.business.extra = $('bizExtra').value.trim();
  }
  return true;
}

function finishSetup() {
  const profile = {
    character: setupData.character,
    business: setupData.business,
    staff: setupData.staff,
  };
  currentSave = {
    id: 'save_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    profile,
    messages: [],
  };
  persistSave();
  openGame(currentSave);

  // Kick off the first day — hidden prompt the player never sees.
  const kickoff = `(Game start. It's opening morning at ${profile.business.name}. I just unlocked the doors and my staff are here for the first day. Have them react to me, the owner. Remember: no narration, characters only.)`;
  sendMessage(kickoff, { hidden: true });
}

// ---------- Game ----------

const chatArea = $('chatArea');
const messagesEl = $('messages');
const input = $('messageInput');
const sendBtn = $('sendBtn');

function openGame(save) {
  currentSave = save;
  const b = save.profile.business || {};
  $('gameBizName').textContent = b.name || 'Business';
  $('gameBizSub').textContent = [b.type, b.location].filter(Boolean).join(' · ');
  messagesEl.innerHTML = '';
  for (const m of save.messages) {
    if (m.hidden) continue;
    appendMessage(m.role, m.content);
  }
  input.value = '';
  autoresize();
  sendBtn.disabled = true;
  isStreaming = false;
  showScreen('game');
  scrollToBottom();
}

$('exitGameBtn').addEventListener('click', () => {
  persistSave();
  currentSave = null;
  showScreen('home');
  renderSavesList();
});

// Textarea autoresize + send button state.
// Return/Enter is NOT bound to send — it just makes a newline.
input.addEventListener('input', () => {
  autoresize();
  sendBtn.disabled = !input.value.trim() || isStreaming;
});

function autoresize() {
  input.style.height = 'auto';
  // scrollHeight is 0 while the game screen is hidden — leave height auto then
  if (input.scrollHeight > 0) {
    input.style.height = Math.min(input.scrollHeight, 160) + 'px';
  }
}

sendBtn.addEventListener('click', () => {
  const text = input.value.trim();
  if (!text || isStreaming) return;
  input.value = '';
  autoresize();
  sendMessage(text);
});

async function sendMessage(text, opts = {}) {
  if (!currentSave || isStreaming) return;
  isStreaming = true;
  sendBtn.disabled = true;

  currentSave.messages.push({ role: 'user', content: text, hidden: !!opts.hidden });
  if (!opts.hidden) appendMessage('user', text);
  persistSave();

  const bubble = createAssistantBubble();
  scrollToBottom();

  let assistantText = '';
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        profile: currentSave.profile,
        messages: currentSave.messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
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
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            bubble.innerHTML = `<div class="error-msg">${escapeHtml(parsed.error)}</div>`;
          }
          if (parsed.text) {
            assistantText += parsed.text;
            bubble.innerHTML = renderDialogue(assistantText);
            scrollToBottom();
          }
        } catch {}
      }
    }

    if (assistantText) {
      currentSave.messages.push({ role: 'assistant', content: assistantText });
      bubble.innerHTML = renderDialogue(assistantText);
      persistSave();
    } else if (!bubble.innerHTML) {
      bubble.innerHTML = '<div class="error-msg">No response — try again.</div>';
    }
  } catch (err) {
    bubble.innerHTML = `<div class="error-msg">Connection error: ${escapeHtml(err.message)}</div>`;
  }

  isStreaming = false;
  sendBtn.disabled = !input.value.trim();
  scrollToBottom();
}

function appendMessage(role, content) {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = role === 'user' ? escapeHtml(content) : renderDialogue(content);
  div.appendChild(bubble);
  messagesEl.appendChild(div);
  return bubble;
}

function createAssistantBubble() {
  const div = document.createElement('div');
  div.className = 'message assistant';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  div.appendChild(bubble);
  messagesEl.appendChild(div);
  return bubble;
}

function scrollToBottom() {
  chatArea.scrollTop = chatArea.scrollHeight;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Render character dialogue: "Name: line" gets a highlighted name,
// *actions* get italic styling. No markdown — this is a roleplay chat.
function renderDialogue(text) {
  const lines = escapeHtml(text).split('\n');
  return lines.map(line => {
    if (!line.trim()) return '';
    let html = line.replace(/\*([^*]+)\*/g, '<em class="action">*$1*</em>');
    const m = html.match(/^([A-Za-z][\w .'&#;-]{0,30}):\s(.*)$/);
    if (m) {
      html = `<span class="char-name">${m[1]}:</span> ${m[2]}`;
    }
    return `<p class="dline">${html}</p>`;
  }).join('');
}

// ---------- Init ----------
renderSavesList();
showScreen('home');
