// ---------- Setup screen elements ----------
const setup = document.getElementById('setup');
const sessionEl = document.getElementById('session');
const typeCards = document.querySelectorAll('.type-card');
const therapyGrid = document.getElementById('therapyGrid');
const castHeading = document.getElementById('castHeading');
const castHint = document.getElementById('castHint');
const castContainer = document.getElementById('castContainer');
const addPersonBtn = document.getElementById('addPersonBtn');
const startBtn = document.getElementById('startBtn');
const savedBlock = document.getElementById('savedBlock');
const savedList = document.getElementById('savedList');

// ---------- Session screen elements ----------
const chatArea = document.getElementById('chatArea');
const messagesEl = document.getElementById('messages');
const input = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const backBtn = document.getElementById('backBtn');
const headerMain = document.getElementById('headerMain');
const headerSub = document.getElementById('headerSub');
const saveStatus = document.getElementById('saveStatus');
const switchBtn = document.getElementById('switchBtn');
const switchSheet = document.getElementById('switchSheet');
const sheetBackdrop = document.getElementById('sheetBackdrop');
const switchList = document.getElementById('switchList');
const closeSheet = document.getElementById('closeSheet');

const THERAPY_LABELS = {
  depression: 'Depression', anger: 'Anger', adhd: 'ADHD', anxiety: 'Anxiety',
  vaping: 'Vaping', speech: 'Speech', autism: 'Autism',
  relationship: 'Relationship', grief: 'Grief', trust: 'Trust',
};

const MODES = {
  solo: { room: '1-on-1', pWord: 'Client', min: 1, max: 1, addable: false },
  couples: { room: 'Couples', pWord: 'Partner', min: 2, max: 2, addable: false },
  friends: { room: 'Friend group', pWord: 'Friend', min: 2, max: 6, addable: true },
};

// Quick-pick descriptions to prefill a character's box.
const PRESETS = {
  therapist: [
    { name: 'Dr. Calm', desc: 'a warm, soft-spoken therapist who is endlessly patient and gently validates everyone' },
    { name: 'Drill Sergeant', desc: 'a blunt, no-nonsense therapist who dishes out brutal tough love and refuses to coddle anyone' },
    { name: 'The Hippie', desc: 'a laid-back therapist who rambles about energy and feelings but is somehow weirdly profound' },
    { name: 'Burnt-Out Vet', desc: 'a therapist of 30 years, jaded and sarcastic, who just says what they really think' },
    { name: 'Eager Intern', desc: 'a nervous intern fresh out of school who quotes textbooks and tries way too hard' },
  ],
  participant: [
    { name: 'The Denier', desc: 'insists nothing is wrong and is only here because someone forced them to come' },
    { name: 'The Oversharer', desc: 'has zero filter and trauma-dumps every detail of their life right away' },
    { name: 'The Tough One', desc: "acts like they don't need help and deflects everything with bravado and jokes" },
    { name: 'The Crier', desc: 'fragile, tears up constantly, and apologizes for everything' },
    { name: 'The Know-It-All', desc: "has googled everything and keeps arguing with the therapist's methods" },
    { name: 'The Peacemaker', desc: 'desperately tries to keep everyone happy and hates any conflict in the room' },
  ],
};

let mode = null;
let selectedTherapies = [];
let cast = [];            // { id, role:'therapist'|'participant', name, desc, owner:'ai'|'user' }
let activeCharId = null;  // the character the user is currently speaking as
let history = [];
let isStreaming = false;
let weekNumber = 1;
let sessionActive = false;
let currentSaveId = null;

function genId() {
  return 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ================= Saved sessions (localStorage) =================
const STORE_KEY = 'tss_saves_v2';

function loadSaves() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; } catch { return []; }
}
function persistSaves(arr) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(arr)); } catch {}
}

function autoSave() {
  if (!currentSaveId) return;
  const saves = loadSaves();
  const entry = {
    id: currentSaveId, mode, therapies: selectedTherapies, cast,
    activeCharId, weekNumber, sessionActive, history, updatedAt: Date.now(),
  };
  const idx = saves.findIndex((s) => s.id === currentSaveId);
  if (idx >= 0) saves[idx] = entry; else saves.push(entry);
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
  if (!saves.length) { savedBlock.classList.add('hidden'); return; }
  savedBlock.classList.remove('hidden');
  saves.forEach((s) => {
    const row = document.createElement('div');
    row.className = 'saved-item';

    const info = document.createElement('button');
    info.className = 'saved-info';
    const roomName = (MODES[s.mode] || MODES.solo).room;
    const ts = (s.therapies || []).map((t) => THERAPY_LABELS[t]).join(', ');
    const state = s.sessionActive ? 'in session' : 'between sessions';
    info.innerHTML = `<span class="saved-title">${roomName} · Week ${s.weekNumber}</span>`
      + `<span class="saved-sub">${escapeHtml(ts)} · ${state} · ${timeAgo(s.updatedAt)}</span>`;
    info.addEventListener('click', () => resumeSave(s.id));

    const del = document.createElement('button');
    del.className = 'saved-del';
    del.setAttribute('aria-label', 'Delete saved session');
    del.textContent = '✕';
    del.addEventListener('click', (e) => { e.stopPropagation(); deleteSave(s.id); });

    row.appendChild(info);
    row.appendChild(del);
    savedList.appendChild(row);
  });
}

function resumeSave(id) {
  const save = loadSaves().find((s) => s.id === id);
  if (!save) return;
  currentSaveId = save.id;
  mode = save.mode;
  selectedTherapies = save.therapies || [];
  cast = save.cast || [];
  activeCharId = save.activeCharId || (cast.find((c) => c.owner === 'user') || {}).id || null;
  weekNumber = save.weekNumber || 1;
  sessionActive = !!save.sessionActive;
  history = save.history || [];

  messagesEl.innerHTML = '';
  renderHistory();
  addSystemDivider(`Resumed — Week ${weekNumber}${sessionActive ? '' : ' (between sessions)'}`);
  if (!sessionActive) addSystemDivider('Add events, then /next week, then /startsession.');

  setup.classList.add('hidden');
  sessionEl.classList.remove('hidden');
  updateHeader();
  updatePlaceholder();
  input.focus();
}

// ================= Setup: session type =================
typeCards.forEach((card) => {
  card.addEventListener('click', () => {
    mode = card.dataset.mode;
    typeCards.forEach((c) => c.classList.toggle('selected', c === card));
    initCast();
    refreshStartBtn();
  });
});

function nameFor(role, ordinal) {
  const cfg = MODES[mode];
  if (role === 'therapist') return 'Therapist';
  return cfg.max > 1 ? `${cfg.pWord} ${ordinal}` : cfg.pWord;
}

function initCast() {
  const cfg = MODES[mode];
  cast = [{ id: genId(), role: 'therapist', name: '', desc: '', owner: 'ai' }];
  for (let i = 0; i < cfg.min; i++) {
    cast.push({ id: genId(), role: 'participant', name: '', desc: '', owner: i === 0 ? 'user' : 'ai' });
  }
  activeCharId = (cast.find((c) => c.owner === 'user') || {}).id || null;
  castHeading.textContent = '3. The people in the room';
  renderCast();
}

function participantIndex(charId) {
  const parts = cast.filter((c) => c.role === 'participant');
  return parts.findIndex((c) => c.id === charId) + 1;
}

function renderCast() {
  const cfg = MODES[mode];
  castHint.textContent = mode === 'solo'
    ? 'Describe both people. You can switch who you play once you start.'
    : `Describe everyone. You can switch which character you play mid-session (🎭).`;
  castContainer.innerHTML = '';

  cast.forEach((c) => {
    const isTherapist = c.role === 'therapist';
    const label = isTherapist ? 'Therapist' : `${cfg.pWord}${cfg.max > 1 ? ' ' + participantIndex(c.id) : ''}`;
    const presets = isTherapist ? PRESETS.therapist : PRESETS.participant;
    const removable = !isTherapist && cfg.addable && cast.filter((x) => x.role === 'participant').length > cfg.min;

    const card = document.createElement('div');
    card.className = 'person-card';
    card.innerHTML = `
      <div class="person-top">
        <span class="person-label">${label}</span>
        <div class="owner-toggle" data-id="${c.id}">
          <button type="button" data-owner="ai" class="${c.owner === 'ai' ? 'on' : ''}">AI 🤖</button>
          <button type="button" data-owner="user" class="${c.owner === 'user' ? 'on' : ''}">You 🧑</button>
        </div>
        ${removable ? `<button type="button" class="person-remove" data-id="${c.id}">✕</button>` : ''}
      </div>
      <input type="text" class="person-name" data-id="${c.id}" maxlength="60" placeholder="Name" value="${escapeAttr(c.name)}">
      <div class="person-presets">
        ${presets.map((p) => `<button type="button" class="mini-chip" data-desc="${escapeAttr(p.desc)}">${escapeHtml(p.name)}</button>`).join('')}
      </div>
      <textarea class="person-desc" data-id="${c.id}" rows="2" placeholder="Describe them in your own words — no length limit">${escapeHtml(c.desc)}</textarea>
    `;
    castContainer.appendChild(card);

    // Wire up
    const nameEl = card.querySelector('.person-name');
    nameEl.addEventListener('input', () => { c.name = nameEl.value; refreshStartBtn(); });

    const descEl = card.querySelector('.person-desc');
    descEl.addEventListener('input', () => { c.desc = descEl.value; refreshStartBtn(); });

    card.querySelectorAll('.mini-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        descEl.value = chip.dataset.desc;
        c.desc = chip.dataset.desc;
        refreshStartBtn();
      });
    });

    card.querySelectorAll('.owner-toggle button').forEach((btn) => {
      btn.addEventListener('click', () => {
        setOwner(c.id, btn.dataset.owner);
        renderCast();
        refreshStartBtn();
      });
    });

    const rm = card.querySelector('.person-remove');
    if (rm) rm.addEventListener('click', () => removeParticipant(c.id));
  });

  addPersonBtn.classList.toggle('hidden', !cfg.addable
    || cast.filter((c) => c.role === 'participant').length >= cfg.max);
}

// Keep at least one AI-owned and one user-owned character.
function setOwner(id, owner) {
  const c = cast.find((x) => x.id === id);
  if (!c || c.owner === owner) return;
  const wouldLeaveNoAi = owner === 'user' && cast.filter((x) => x.owner === 'ai').length <= 1;
  const wouldLeaveNoUser = owner === 'ai' && cast.filter((x) => x.owner === 'user').length <= 1;
  if (wouldLeaveNoAi || wouldLeaveNoUser) return;
  c.owner = owner;
  if (owner === 'user' && !cast.find((x) => x.id === activeCharId && x.owner === 'user')) {
    activeCharId = id;
  }
  if (owner === 'ai' && activeCharId === id) {
    activeCharId = (cast.find((x) => x.owner === 'user') || {}).id || null;
  }
}

function removeParticipant(id) {
  cast = cast.filter((c) => c.id !== id);
  if (activeCharId === id) activeCharId = (cast.find((c) => c.owner === 'user') || {}).id || null;
  renderCast();
  refreshStartBtn();
}

addPersonBtn.addEventListener('click', () => {
  const cfg = MODES[mode];
  if (cast.filter((c) => c.role === 'participant').length >= cfg.max) return;
  cast.push({ id: genId(), role: 'participant', name: '', desc: '', owner: 'ai' });
  renderCast();
  refreshStartBtn();
});

// ================= Setup: focuses =================
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
  const ok = mode
    && selectedTherapies.length > 0
    && cast.length > 0
    && cast.every((c) => c.name.trim() && c.desc.trim())
    && cast.some((c) => c.owner === 'user')
    && cast.some((c) => c.owner === 'ai');
  startBtn.disabled = !ok;
}

startBtn.addEventListener('click', startSession);
backBtn.addEventListener('click', exitToSetup);

// ================= Session lifecycle =================
function activeChar() { return cast.find((c) => c.id === activeCharId); }
function activeName() { const c = activeChar(); return c ? c.name : 'You'; }

function startSession() {
  if (startBtn.disabled) return;
  activeCharId = (cast.find((c) => c.owner === 'user') || {}).id || null;
  history = [];
  messagesEl.innerHTML = '';
  weekNumber = 1;
  sessionActive = true;
  currentSaveId = genId();
  setup.classList.add('hidden');
  sessionEl.classList.remove('hidden');
  updateHeader();
  updatePlaceholder();

  addSystemDivider(`Week 1 — ${MODES[mode].room} session begins`);
  addSystemDivider(`You're playing ${activeName()}. Tap 🎭 to switch · /end to finish`);

  history.push({ role: 'user', content: openerFor(1) });
  streamResponse();
  input.focus();
}

function openerFor(week) {
  if (week === 1) {
    return `(The first ${MODES[mode].room} session begins. Everyone has just sat down. Open the scene and speak first, voicing the characters you control.)`;
  }
  return `(It is now week ${week}. A new session begins with the same people. Take into account anything that happened between sessions, then open the scene, voicing the characters you control. Speak first.)`;
}

function updateHeader() {
  headerMain.textContent = `${MODES[mode].room} · Week ${weekNumber}`;
  headerSub.textContent = `You: ${activeName()}`;
}

function updatePlaceholder() {
  if (!sessionActive) {
    input.placeholder = 'Between sessions — type what happened, or /next week then /startsession';
    return;
  }
  input.placeholder = `Speak as ${activeName()}...   (🎭 switch · /end finish)`;
}

function exitToSetup() {
  if (isStreaming) return;
  autoSave();
  sessionEl.classList.add('hidden');
  setup.classList.remove('hidden');
  renderSavedList();
  input.value = '';
  currentSaveId = null;
}

// ================= Commands =================
async function handleCommand(raw) {
  const cmd = raw.trim();
  const lower = cmd.toLowerCase().replace(/\s+/g, ' ');

  if (lower === '/end') {
    if (!sessionActive) { addSystemDivider('No session running. Type /startsession to begin one.'); return; }
    history.push({ role: 'user', content: "(End the session for today. Give brief in-character closings from the characters you voice, then stop.)" });
    await streamResponse();
    sessionActive = false;
    addSystemDivider(`— End of week ${weekNumber} session —`);
    addSystemDivider('Type any events that happened, then /next week, then /startsession.');
    updatePlaceholder();
    autoSave();
    return;
  }

  if (lower === '/next week' || lower === '/nextweek' || lower === '/next') {
    if (sessionActive) { addSystemDivider('Finish the current session first with /end.'); return; }
    weekNumber += 1;
    addSystemDivider(`A week passes... → Week ${weekNumber}`);
    addSystemDivider('Add any events, then /startsession to begin.');
    updateHeader();
    autoSave();
    return;
  }

  if (lower === '/startsession' || lower === '/start session' || lower === '/start') {
    if (sessionActive) { addSystemDivider('A session is already in progress.'); return; }
    sessionActive = true;
    updatePlaceholder();
    updateHeader();
    addSystemDivider(`Week ${weekNumber} session begins`);
    history.push({ role: 'user', content: openerFor(weekNumber) });
    await streamResponse();
    return;
  }

  if (lower.startsWith('/event')) {
    const text = cmd.slice(6).trim();
    if (!text) { addSystemDivider('Usage: /event something that happened'); return; }
    recordEvent(text);
    return;
  }

  if (lower === '/switch' || lower === '/play') { openSwitchSheet(); return; }

  if (lower === '/help') {
    addSystemDivider('Commands:  /end · /next week · /startsession · /event <text> · /switch');
    return;
  }

  addSystemDivider('Unknown command. Try:  /end · /next week · /startsession · /event · /switch');
}

function recordEvent(text) {
  history.push({ role: 'user', content: `(Between sessions — the user reports this happened: "${text}")` });
  addEventBubble(text);
  autoSave();
}

// ================= Character switching =================
switchBtn.addEventListener('click', openSwitchSheet);
closeSheet.addEventListener('click', closeSwitchSheet);
sheetBackdrop.addEventListener('click', closeSwitchSheet);

function openSwitchSheet() { renderSwitchList(); switchSheet.classList.remove('hidden'); }
function closeSwitchSheet() { switchSheet.classList.add('hidden'); }

function renderSwitchList() {
  switchList.innerHTML = '';
  cast.forEach((c) => {
    const row = document.createElement('div');
    row.className = 'switch-row' + (c.id === activeCharId ? ' active' : '');
    const roleLabel = c.role === 'therapist' ? 'Therapist' : MODES[mode].pWord;
    row.innerHTML = `
      <div class="switch-info">
        <span class="switch-name">${escapeHtml(c.name || '(unnamed)')}</span>
        <span class="switch-role">${roleLabel} · voiced by ${c.owner === 'user' ? 'You' : 'AI'}</span>
      </div>
      <div class="switch-controls">
        <div class="owner-toggle" data-id="${c.id}">
          <button type="button" data-owner="ai" class="${c.owner === 'ai' ? 'on' : ''}">AI</button>
          <button type="button" data-owner="user" class="${c.owner === 'user' ? 'on' : ''}">You</button>
        </div>
        <button type="button" class="play-btn ${c.id === activeCharId ? 'current' : ''}" data-id="${c.id}" ${c.owner !== 'user' ? 'disabled' : ''}>
          ${c.id === activeCharId ? 'Playing' : 'Play'}
        </button>
      </div>
    `;
    switchList.appendChild(row);

    row.querySelectorAll('.owner-toggle button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const prevOwner = c.owner;
        setOwner(c.id, btn.dataset.owner);
        if (c.owner !== prevOwner) announceOwnership(c);
        renderSwitchList();
      });
    });

    row.querySelector('.play-btn').addEventListener('click', () => {
      if (c.owner !== 'user') return;
      if (activeCharId === c.id) return;
      activeCharId = c.id;
      announceActive();
      renderSwitchList();
    });
  });
}

// Notify the AI that the user is now speaking as a different character.
function announceActive() {
  updateHeader();
  updatePlaceholder();
  if (!sessionActive) return;
  const name = activeName();
  history.push({ role: 'user', content: `(The user is now speaking as ${name}. You no longer voice ${name} — the user controls that character. Do not write dialogue for ${name}.)` });
  addSystemDivider(`🎭 You're now playing ${name}`);
  autoSave();
}

function announceOwnership(c) {
  updateHeader();
  updatePlaceholder();
  if (!sessionActive) return;
  const who = c.owner === 'user'
    ? `The user now controls ${c.name}; you no longer voice that character.`
    : `You (the assistant) now voice ${c.name} again.`;
  history.push({ role: 'user', content: `(Cast change: ${who})` });
  addSystemDivider(`🎭 ${c.name} → played by ${c.owner === 'user' ? 'You' : 'the AI'}`);
  autoSave();
}

// ================= Input handling =================
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 160) + 'px';
  sendBtn.disabled = !input.value.trim() || isStreaming;
});

// The return key (incl. iPhone) inserts a newline. Messages send only via the button.
sendBtn.addEventListener('click', sendMessage);

async function sendMessage() {
  const text = input.value.trim();
  if (!text || isStreaming) return;

  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;

  if (text.startsWith('/')) { await handleCommand(text); return; }

  if (!sessionActive) { recordEvent(text); return; }

  const name = activeName();
  history.push({ role: 'user', content: `${name}: ${text}` });
  appendMessage('user', text, name);
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
        mode,
        therapies: selectedTherapies,
        cast: cast.map((c) => ({ id: c.id, role: c.role, name: c.name, desc: c.desc, owner: c.owner })),
        activeCharId,
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

// ================= Rendering =================
function appendMessage(role, content, name) {
  const div = document.createElement('div');
  div.className = `message ${role}`;

  const col = document.createElement('div');
  col.className = 'msg-col';

  if (name) {
    const tag = document.createElement('div');
    tag.className = 'speaker-tag';
    tag.textContent = name;
    col.appendChild(tag);
  }

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = role === 'user' ? renderText(content) : renderText(content);

  col.appendChild(bubble);
  div.appendChild(col);
  messagesEl.appendChild(div);
  scrollToBottom();
  return bubble;
}

function createAssistantBubble() {
  const div = document.createElement('div');
  div.className = 'message assistant';

  const col = document.createElement('div');
  col.className = 'msg-col';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  const cursor = document.createElement('span');
  cursor.className = 'typing-cursor';
  bubble.appendChild(cursor);

  col.appendChild(bubble);
  div.appendChild(col);
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

function addEventBubble(text) {
  const div = document.createElement('div');
  div.className = 'event-note';
  div.innerHTML = `<span>📌 Between sessions: ${escapeHtml(text)}</span>`;
  messagesEl.appendChild(div);
  scrollToBottom();
}

// Rebuild transcript from saved history.
function renderHistory() {
  history.forEach((m) => {
    if (m.role === 'assistant') { appendMessage('assistant', m.content); return; }
    const t = m.content;
    const ev = t.match(/^\(Between sessions — the user reports this happened: "([\s\S]*)"\)$/);
    if (ev) { addEventBubble(ev[1]); return; }
    if (/^\(.*\)$/s.test(t.trim())) return; // stage direction — skip
    const um = t.match(/^([^:\n]{1,60}):\s([\s\S]*)$/);
    if (um) appendMessage('user', um[2], um[1]);
    else appendMessage('user', t);
  });
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

function escapeAttr(str) {
  return escapeHtml(str);
}

// Render dialogue: style *action beats*, and "Name:" speaker labels at line start.
function renderText(text) {
  let html = escapeHtml(text);
  html = html.replace(/\*([^*]+)\*/g, '<span class="action">$1</span>');
  html = html.replace(/(^|\n)([^\n:]{1,40}):(?=\s)/g, '$1<span class="speaker">$2:</span>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

// Show saved sessions on first load.
renderSavedList();
