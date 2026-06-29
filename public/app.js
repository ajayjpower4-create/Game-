// --- Setup screen elements ---
const setup = document.getElementById('setup');
const session = document.getElementById('session');
const roleCards = document.querySelectorAll('.role-card');
const therapyGrid = document.getElementById('therapyGrid');
const personalityInput = document.getElementById('personalityInput');
const personalityHeading = document.getElementById('personalityHeading');
const charCount = document.getElementById('charCount');
const presetGrid = document.getElementById('presetGrid');
const presetLabel = document.getElementById('presetLabel');
const savedBlock = document.getElementById('savedBlock');
const savedList = document.getElementById('savedList');
const saveStatus = document.getElementById('saveStatus');

// Preset characters for whichever role the AI is playing.
const PRESETS = {
  therapist: [
    { name: 'Dr. Calm', desc: 'a warm, soft-spoken therapist who is endlessly patient and gently validates everything you say' },
    { name: 'Drill Sergeant', desc: 'a blunt, no-nonsense therapist who dishes out brutal tough love and refuses to coddle you' },
    { name: 'The Hippie', desc: 'a laid-back therapist who rambles about energy, the universe, and feelings, but is somehow weirdly profound' },
    { name: 'Burnt-Out Vet', desc: 'a therapist who has done this for 30 years, is jaded and sarcastic, and just says what they really think' },
    { name: 'Eager Intern', desc: 'a nervous intern fresh out of school who quotes textbooks constantly and tries way too hard to help' },
  ],
  client: [
    { name: 'The Denier', desc: 'a client who insists nothing is wrong and is only here because someone forced them to come' },
    { name: 'The Oversharer', desc: 'a client with zero filter who trauma-dumps every detail of their life right away' },
    { name: 'The Tough Guy', desc: "a client who acts like they don't need help and deflects everything with bravado and jokes" },
    { name: 'The Crier', desc: 'a fragile client who tears up constantly and apologizes for everything' },
    { name: 'The Know-It-All', desc: "a client who has googled everything and keeps arguing with the therapist's methods" },
  ],
};
const startBtn = document.getElementById('startBtn');

// --- Session screen elements ---
const chatArea = document.getElementById('chatArea');
const messagesEl = document.getElementById('messages');
const input = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const backBtn = document.getElementById('backBtn');
const headerMain = document.getElementById('headerMain');
const headerSub = document.getElementById('headerSub');

const THERAPY_LABELS = {
  depression: 'Depression',
  anger: 'Anger issues',
  adhd: 'ADHD',
  anxiety: 'Anxiety',
  vaping: 'Vaping',
  speech: 'Speech',
  autism: 'Autism',
};

let selectedRole = null;
let selectedTherapies = [];
let history = [];
let isStreaming = false;
let weekNumber = 1;
let sessionActive = false;
let currentSaveId = null;

// ---------- Saved sessions (localStorage) ----------
const STORE_KEY = 'tss_saves_v1';

function loadSaves() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || [];
  } catch {
    return [];
  }
}

function persistSaves(arr) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(arr));
  } catch {}
}

function genId() {
  return 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Snapshot the live session into its save slot. Called after every turn.
function autoSave() {
  if (!currentSaveId) return;
  const saves = loadSaves();
  const entry = {
    id: currentSaveId,
    role: selectedRole,
    therapies: selectedTherapies,
    personality: personalityInput.value.trim(),
    weekNumber,
    sessionActive,
    history,
    updatedAt: Date.now(),
  };
  const idx = saves.findIndex((s) => s.id === currentSaveId);
  if (idx >= 0) saves[idx] = entry;
  else saves.push(entry);
  persistSaves(saves);
  flashSaved();
}

function flashSaved() {
  saveStatus.textContent = 'Saved ✓';
  saveStatus.classList.add('show');
  clearTimeout(flashSaved._t);
  flashSaved._t = setTimeout(() => saveStatus.classList.remove('show'), 1400);
}

function deleteSave(id) {
  persistSaves(loadSaves().filter((s) => s.id !== id));
  renderSavedList();
}

function timeAgo(ts) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function renderSavedList() {
  const saves = loadSaves().sort((a, b) => b.updatedAt - a.updatedAt);
  savedList.innerHTML = '';
  if (!saves.length) {
    savedBlock.classList.add('hidden');
    return;
  }
  savedBlock.classList.remove('hidden');
  saves.forEach((s) => {
    const row = document.createElement('div');
    row.className = 'saved-item';

    const info = document.createElement('button');
    info.className = 'saved-info';
    const roleName = s.role === 'therapist' ? 'You: Therapist' : 'You: Client';
    const ts = (s.therapies || []).map((t) => THERAPY_LABELS[t]).join(', ');
    const state = s.sessionActive ? 'in session' : 'between sessions';
    info.innerHTML = `<span class="saved-title">Week ${s.weekNumber} · ${roleName}</span>`
      + `<span class="saved-sub">${escapeHtml(ts)} · ${state} · ${timeAgo(s.updatedAt)}</span>`;
    info.addEventListener('click', () => resumeSave(s.id));

    const del = document.createElement('button');
    del.className = 'saved-del';
    del.setAttribute('aria-label', 'Delete saved session');
    del.textContent = '✕';
    del.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteSave(s.id);
    });

    row.appendChild(info);
    row.appendChild(del);
    savedList.appendChild(row);
  });
}

function resumeSave(id) {
  const save = loadSaves().find((s) => s.id === id);
  if (!save) return;

  currentSaveId = save.id;
  selectedRole = save.role;
  selectedTherapies = save.therapies || [];
  personalityInput.value = save.personality || '';
  weekNumber = save.weekNumber || 1;
  sessionActive = !!save.sessionActive;
  history = save.history || [];

  const aiRole = selectedRole === 'therapist' ? 'the Client' : 'the Therapist';
  headerMain.textContent = `You: ${selectedRole === 'therapist' ? 'Therapist' : 'Client'}`;
  headerSub.textContent = `AI: ${aiRole} · ${selectedTherapies.map((t) => THERAPY_LABELS[t]).join(', ')}`;

  messagesEl.innerHTML = '';
  renderHistory();
  addSystemDivider(`Resumed — Week ${weekNumber}${sessionActive ? '' : ' (between sessions)'}`);
  if (!sessionActive) addSystemDivider('Type /next week, then /startsession to continue.');

  setup.classList.add('hidden');
  session.classList.remove('hidden');
  updatePlaceholder();
  input.focus();
}

// Re-draw the chat transcript from saved history, skipping the bracketed
// stage-direction prompts we inject (openers / closing cues).
function renderHistory() {
  history.forEach((m) => {
    if (m.role === 'user') {
      if (/^\(.*\)$/s.test(m.content.trim())) return;
      appendMessage('user', m.content);
    } else if (m.role === 'assistant') {
      appendMessage('assistant', m.content);
    }
  });
}

// ---------- Setup interactions ----------
roleCards.forEach((card) => {
  card.addEventListener('click', () => {
    selectedRole = card.dataset.role;
    roleCards.forEach((c) => c.classList.toggle('selected', c === card));
    // The AI plays the opposite role — label the personality step accordingly.
    personalityHeading.textContent = selectedRole === 'therapist'
      ? "3. The client's personality"
      : "3. The therapist's personality";
    renderPresets();
    refreshStartBtn();
  });
});

function renderPresets() {
  presetGrid.innerHTML = '';
  if (!selectedRole) {
    presetLabel.classList.add('hidden');
    return;
  }
  const aiRole = selectedRole === 'therapist' ? 'client' : 'therapist';
  presetLabel.classList.remove('hidden');
  PRESETS[aiRole].forEach((p) => {
    const btn = document.createElement('button');
    btn.className = 'therapy-chip preset-chip';
    btn.textContent = p.name;
    btn.addEventListener('click', () => {
      personalityInput.value = p.desc;
      charCount.textContent = p.desc.length;
      presetGrid.querySelectorAll('.preset-chip')
        .forEach((c) => c.classList.toggle('selected', c === btn));
      refreshStartBtn();
    });
    presetGrid.appendChild(btn);
  });
}

personalityInput.addEventListener('input', () => {
  charCount.textContent = personalityInput.value.length;
  presetGrid.querySelectorAll('.preset-chip').forEach((c) => c.classList.remove('selected'));
  refreshStartBtn();
});

therapyGrid.querySelectorAll('.therapy-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    const t = chip.dataset.therapy;
    if (selectedTherapies.includes(t)) {
      selectedTherapies = selectedTherapies.filter((x) => x !== t);
      chip.classList.remove('selected');
    } else {
      selectedTherapies.push(t);
      chip.classList.add('selected');
    }
    refreshStartBtn();
  });
});

function refreshStartBtn() {
  startBtn.disabled = !selectedRole || selectedTherapies.length === 0 || !personalityInput.value.trim();
}

startBtn.addEventListener('click', startSession);
backBtn.addEventListener('click', endSession);

function startSession() {
  if (startBtn.disabled) return;

  // The user is one role; the AI plays the other.
  const aiRole = selectedRole === 'therapist' ? 'the Client' : 'the Therapist';
  headerMain.textContent = `You: ${selectedRole === 'therapist' ? 'Therapist' : 'Client'}`;
  headerSub.textContent = `AI: ${aiRole} · ${selectedTherapies.map((t) => THERAPY_LABELS[t]).join(', ')}`;

  history = [];
  messagesEl.innerHTML = '';
  weekNumber = 1;
  sessionActive = true;
  currentSaveId = genId();
  setup.classList.add('hidden');
  session.classList.remove('hidden');
  updatePlaceholder();

  addSystemDivider(`Week 1 — session begins`);
  addSystemDivider(`Tip: type /end to finish the session, /next week, then /startsession`);

  history.push({ role: 'user', content: openerFor(1) });
  streamResponse();
  input.focus();
}

function openerFor(week) {
  if (week === 1) {
    return selectedRole === 'therapist'
      ? '(The first session begins. The client has just sat down. Speak first, in character.)'
      : '(The first session begins. The client has just sat down across from you. Speak first, in character.)';
  }
  return `(It is now week ${week} of therapy. A new weekly session begins and the same two people sit back down. Greet them and pick up naturally, referencing earlier sessions where it fits. Speak first, in character.)`;
}

function updatePlaceholder() {
  if (!sessionActive) {
    input.placeholder = 'Session over — type /next week, then /startsession';
    return;
  }
  input.placeholder = selectedRole === 'therapist'
    ? 'Talk to your client...   (/end to finish)'
    : "Talk to your therapist...   (/end to finish)";
}

// The back button saves and returns to setup — the thread stays in the library.
function endSession() {
  if (isStreaming) return;
  autoSave();
  session.classList.add('hidden');
  setup.classList.remove('hidden');
  renderSavedList();
  input.value = '';
  currentSaveId = null;
}

// Handle the in-game slash commands. Returns nothing; updates state/UI.
async function handleCommand(raw) {
  const cmd = raw.trim().toLowerCase().replace(/\s+/g, ' ');

  if (cmd === '/end') {
    if (!sessionActive) {
      addSystemDivider('No session is running. Type /startsession to begin one.');
      return;
    }
    history.push({ role: 'user', content: "(The session is now ending for today. Give a brief, in-character closing for this week's session, then stop.)" });
    await streamResponse();
    sessionActive = false;
    addSystemDivider(`— End of week ${weekNumber} session —`);
    updatePlaceholder();
    autoSave();
    return;
  }

  if (cmd === '/next week' || cmd === '/nextweek' || cmd === '/next') {
    if (sessionActive) {
      addSystemDivider('Finish the current session first with /end.');
      return;
    }
    weekNumber += 1;
    addSystemDivider(`A week passes... → Week ${weekNumber}`);
    addSystemDivider('Type /startsession to begin the session.');
    autoSave();
    return;
  }

  if (cmd === '/startsession' || cmd === '/start session' || cmd === '/start') {
    if (sessionActive) {
      addSystemDivider('A session is already in progress.');
      return;
    }
    sessionActive = true;
    updatePlaceholder();
    addSystemDivider(`Week ${weekNumber} — session begins`);
    history.push({ role: 'user', content: openerFor(weekNumber) });
    await streamResponse();
    return;
  }

  if (cmd === '/help') {
    addSystemDivider('Commands:  /end · /next week · /startsession');
    return;
  }

  addSystemDivider('Unknown command. Try:  /end · /next week · /startsession');
}

// ---------- Input handling ----------
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 160) + 'px';
  sendBtn.disabled = !input.value.trim() || isStreaming;
});

// Note: Enter / the iPhone return key inserts a newline. Messages are only
// sent by tapping the send button.
sendBtn.addEventListener('click', sendMessage);

async function sendMessage() {
  const text = input.value.trim();
  if (!text || isStreaming) return;

  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;

  // Slash commands drive the session/week flow.
  if (text.startsWith('/')) {
    await handleCommand(text);
    return;
  }

  if (!sessionActive) {
    addSystemDivider('No active session. Type /next week, then /startsession.');
    return;
  }

  history.push({ role: 'user', content: text });
  appendMessage('user', text);
  await streamResponse();
}

async function streamResponse() {
  isStreaming = true;
  sendBtn.disabled = true;
  sendBtn.classList.add('loading');

  const { bubble, cursor } = createAssistantBubble();
  scrollToBottom();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: history,
        role: selectedRole,
        therapies: selectedTherapies,
        personality: personalityInput.value.trim(),
      }),
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
  } catch (err) {
    cursor.remove();
    bubble.innerHTML = `<div class="error-msg">Connection error: ${escapeHtml(err.message)}</div>`;
  }

  isStreaming = false;
  sendBtn.classList.remove('loading');
  sendBtn.disabled = !input.value.trim();
  autoSave();
  scrollToBottom();
}

// ---------- Rendering ----------
function appendMessage(role, content) {
  const div = document.createElement('div');
  div.className = `message ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = role === 'user' ? escapeHtml(content) : renderText(content);

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

function addSystemDivider(text) {
  const div = document.createElement('div');
  div.className = 'session-divider';
  div.innerHTML = `<span>${escapeHtml(text)}</span>`;
  messagesEl.appendChild(div);
  scrollToBottom();
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

// Render character text: *action beats* become styled italics, newlines kept.
function renderText(text) {
  let html = escapeHtml(text);
  html = html.replace(/\*([^*]+)\*/g, '<span class="action">$1</span>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

// Show any previously saved sessions on first load.
renderSavedList();
