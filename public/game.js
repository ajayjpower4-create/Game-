const setupArea = document.getElementById('setupArea');
const setupPanel = document.getElementById('setupPanel');
const chatArea = document.getElementById('chatArea');
const messagesEl = document.getElementById('messages');
const inputBar = document.getElementById('inputBar');
const input = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const newGameBtn = document.getElementById('newGameBtn');

const SAVE_KEY = 'gdsim_save_v2';
const START_SIGNAL = '[START SIMULATION]';

// On iPhone/iPad the return key must NOT send — it just makes a new line.
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const RANKS = ['Owner', 'Head Developer', 'Developer', 'Discord Server Staff', 'Discord Mod'];
const RC_VIBES = ['Professional', 'Casual', 'Total chaos'];
const RC_AMOUNTS = ['Just the basics', 'A normal amount', 'A ton'];
const STAFF_VIBES = ['Professional', 'Chill', 'Chaotic', 'Drama-filled', 'A mix'];
const YES_NO = ['Yes', 'No'];

const INFO_FIELDS = [
  ['title', 'Game title', 'e.g. Blockfall Tycoon'],
  ['about', "What's it about / genre", 'e.g. zombie survival tycoon'],
  ['daily', 'Daily players', 'e.g. 40,000'],
  ['platform', 'Platform', 'e.g. Roblox, PC, mobile'],
  ['age', "How long it's been out", 'e.g. 2 years'],
  ['money', 'Free or paid? How does it make money?', 'e.g. free, sells gamepasses'],
  ['problem', 'Biggest problem right now', 'e.g. hackers everywhere'],
];

function freshState() {
  return {
    step: 0,
    started: false,
    rank: '',
    serverCount: 0,
    servers: [],
    rcMode: '',
    rcAnswers: { vibe: '', amount: '', mustHaves: '' },
    rolesChannels: '',
    staffMode: '',
    staffAnswers: { count: '', vibe: '', names: '', shady: '' },
    staff: '',
    info: { title: '', about: '', daily: '', platform: '', age: '', money: '', problem: '' },
    history: [],
  };
}

let state = freshState();
let isStreaming = false;

init();

function init() {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (saved && typeof saved === 'object') state = Object.assign(freshState(), saved);
  } catch {}

  if (state.started) {
    showChat();
  } else {
    renderStep();
  }
}

function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {}
}

function setupPayload() {
  return {
    rank: state.rank,
    servers: state.servers,
    rcAnswers: state.rcAnswers,
    rolesChannels: state.rolesChannels,
    staffAnswers: state.staffAnswers,
    staff: state.staff,
    info: state.info,
  };
}

newGameBtn.addEventListener('click', () => {
  if ((state.started || state.step > 0 || state.rank) &&
      !confirm('Start a new game? Your current save will be deleted.')) return;
  localStorage.removeItem(SAVE_KEY);
  state = freshState();
  isStreaming = false;
  messagesEl.innerHTML = '';
  chatArea.classList.add('hidden');
  inputBar.classList.add('hidden');
  setupArea.classList.remove('hidden');
  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;
  renderStep();
});

/* ============================= SETUP WIZARD ============================= */

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function el(tag, className, html) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function chipRow(options, selected, onPick) {
  const row = el('div', 'chip-row');
  options.forEach(opt => {
    const b = el('button', 'chip' + (opt === selected ? ' selected' : ''), esc(opt));
    b.type = 'button';
    b.addEventListener('click', () => {
      row.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
      b.classList.add('selected');
      onPick(opt);
    });
    row.appendChild(b);
  });
  return row;
}

function navRow(panel, { backTo, nextLabel, canNext, onNext }) {
  const row = el('div', 'nav-row');
  if (backTo !== undefined) {
    const back = el('button', 'btn-back', 'Back');
    back.type = 'button';
    back.addEventListener('click', () => { state.step = backTo; save(); renderStep(); });
    row.appendChild(back);
  }
  const next = el('button', 'btn-next', nextLabel || 'Continue');
  next.type = 'button';
  next.disabled = !canNext();
  next.addEventListener('click', () => { if (canNext()) onNext(); });
  row.appendChild(next);
  panel.appendChild(row);
  return () => { next.disabled = !canNext(); };
}

function renderStep() {
  setupPanel.innerHTML = '';
  [renderRankStep, renderServersStep, renderRolesStep, renderStaffStep, renderInfoStep][state.step]();
  setupArea.scrollTop = 0;
}

/* --- Step 1: rank --- */
function renderRankStep() {
  const p = setupPanel;
  p.appendChild(el('div', 'step-label', 'STEP 1 OF 5'));
  p.appendChild(el('h2', 'step-title', 'Pick your rank'));
  p.appendChild(el('p', 'step-sub', "What are you on this game's team?"));

  let refresh = () => {};
  const isCustom = state.rank && !RANKS.includes(state.rank);

  const custom = el('input', 'text-input');
  custom.type = 'text';
  custom.placeholder = 'Or type any other dev rank...';
  if (isCustom) custom.value = state.rank;

  const chips = chipRow(RANKS, isCustom ? null : state.rank, val => {
    state.rank = val;
    custom.value = '';
    save();
    refresh();
  });
  p.appendChild(chips);

  custom.addEventListener('input', () => {
    state.rank = custom.value.trim();
    if (state.rank) chips.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
    save();
    refresh();
  });
  p.appendChild(custom);

  refresh = navRow(p, {
    canNext: () => !!state.rank,
    onNext: () => { state.step = 1; save(); renderStep(); },
  });
}

/* --- Step 2: servers --- */
function renderServersStep() {
  const p = setupPanel;
  p.appendChild(el('div', 'step-label', 'STEP 2 OF 5'));
  p.appendChild(el('h2', 'step-title', 'Your Discord servers'));
  p.appendChild(el('p', 'step-sub', 'How many Discord servers does the game have? (2–5)'));

  let refresh = () => {};
  p.appendChild(chipRow(['2', '3', '4', '5'], state.serverCount ? String(state.serverCount) : null, val => {
    state.serverCount = Number(val);
    state.servers = state.servers.slice(0, state.serverCount);
    while (state.servers.length < state.serverCount) state.servers.push('');
    save();
    renderInputs();
    refresh();
  }));

  const inputsWrap = el('div', 'server-inputs');
  p.appendChild(inputsWrap);

  function renderInputs() {
    inputsWrap.innerHTML = '';
    for (let i = 0; i < state.serverCount; i++) {
      const field = el('label', 'field');
      field.appendChild(el('span', 'field-label', `What is server ${i + 1} for?`));
      const inp = el('input', 'text-input');
      inp.type = 'text';
      inp.placeholder = i === 0
        ? 'e.g. public server for players and mods'
        : 'e.g. private server for devs and the owner';
      inp.value = state.servers[i] || '';
      inp.addEventListener('input', () => {
        state.servers[i] = inp.value;
        save();
        refresh();
      });
      field.appendChild(inp);
      inputsWrap.appendChild(field);
    }
  }
  renderInputs();

  refresh = navRow(p, {
    backTo: 0,
    canNext: () => state.serverCount >= 2 && state.servers.length === state.serverCount &&
      state.servers.every(s => s.trim()),
    onNext: () => { state.step = 2; save(); renderStep(); },
  });
}

/* --- Steps 3 & 4 share the type-or-generate pattern --- */
function renderGenerateStep(cfg) {
  const p = setupPanel;
  p.appendChild(el('div', 'step-label', cfg.stepLabel));
  p.appendChild(el('h2', 'step-title', cfg.title));
  p.appendChild(el('p', 'step-sub', cfg.sub));

  let refresh = () => {};
  p.appendChild(chipRow(["I'll type them", 'AI auto-generate'],
    cfg.getMode() === 'type' ? "I'll type them" : cfg.getMode() === 'ai' ? 'AI auto-generate' : null,
    val => {
      cfg.setMode(val === 'AI auto-generate' ? 'ai' : 'type');
      save();
      renderBody();
      refresh();
    }));

  const body = el('div', 'gen-body');
  p.appendChild(body);

  function renderBody() {
    body.innerHTML = '';
    const mode = cfg.getMode();
    if (!mode) return;

    let ta, errEl;

    if (mode === 'ai') {
      cfg.questions(body);
      const genRow = el('div', 'gen-row');
      const genBtn = el('button', 'btn-generate', cfg.getText().trim() ? '↻ Regenerate' : '✨ Generate');
      genBtn.type = 'button';
      genBtn.addEventListener('click', async () => {
        genBtn.disabled = true;
        genBtn.textContent = 'Generating...';
        try {
          const res = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: cfg.genType, setup: setupPayload() }),
          });
          const data = await res.json();
          if (!res.ok || data.error) throw new Error(data.error || `Server error: ${res.status}`);
          cfg.setText(data.text.trim());
          save();
          ta.value = cfg.getText();
          errEl.textContent = '';
        } catch (err) {
          errEl.textContent = err.message;
        }
        genBtn.textContent = cfg.getText().trim() ? '↻ Regenerate' : '✨ Generate';
        genBtn.disabled = false;
        refresh();
      });
      genRow.appendChild(genBtn);
      body.appendChild(genRow);
      errEl = el('div', 'gen-error');
      body.appendChild(errEl);
    }

    body.appendChild(el('div', 'field-label',
      mode === 'ai' ? 'Generated result (you can edit it):' : cfg.typeLabel));
    ta = el('textarea', 'big-textarea');
    ta.placeholder = cfg.typePlaceholder;
    ta.value = cfg.getText();
    ta.addEventListener('input', () => { cfg.setText(ta.value); save(); refresh(); });
    body.appendChild(ta);
  }
  renderBody();

  refresh = navRow(p, {
    backTo: cfg.backTo,
    canNext: () => !!cfg.getMode() && !!cfg.getText().trim(),
    onNext: cfg.onNext,
  });
}

function questionChips(body, label, options, get, set) {
  body.appendChild(el('div', 'field-label', label));
  body.appendChild(chipRow(options, get(), val => { set(val); save(); }));
}

function questionText(body, label, placeholder, get, set) {
  const field = el('label', 'field');
  field.appendChild(el('span', 'field-label', label));
  const inp = el('input', 'text-input');
  inp.type = 'text';
  inp.placeholder = placeholder;
  inp.value = get();
  inp.addEventListener('input', () => { set(inp.value); save(); });
  field.appendChild(inp);
  body.appendChild(field);
}

/* --- Step 3: roles & channels --- */
function renderRolesStep() {
  renderGenerateStep({
    stepLabel: 'STEP 3 OF 5',
    title: 'Roles & channels',
    sub: 'Set up the roles and channels for each server — type them yourself or let the AI generate them.',
    genType: 'roles',
    backTo: 1,
    getMode: () => state.rcMode,
    setMode: m => { state.rcMode = m; },
    getText: () => state.rolesChannels,
    setText: t => { state.rolesChannels = t; },
    typeLabel: 'Type the roles and channels for each server:',
    typePlaceholder: 'Server 1:\nRoles: Owner, Dev, Mod, Member...\nChannels: #announcements, #general, #bug-reports...\n\nServer 2:\n...',
    questions(body) {
      questionChips(body, "What's the vibe of the servers?", RC_VIBES,
        () => state.rcAnswers.vibe, v => { state.rcAnswers.vibe = v; });
      questionChips(body, 'How many roles?', RC_AMOUNTS,
        () => state.rcAnswers.amount, v => { state.rcAnswers.amount = v; });
      questionText(body, 'Any must-have channels or roles? (optional)', 'e.g. a #leaks channel, a QA Tester role',
        () => state.rcAnswers.mustHaves, v => { state.rcAnswers.mustHaves = v; });
    },
    onNext: () => { state.step = 3; save(); renderStep(); },
  });
}

/* --- Step 4: staff team --- */
function renderStaffStep() {
  renderGenerateStep({
    stepLabel: 'STEP 4 OF 5',
    title: 'The staff team',
    sub: 'Pick everybody — the devs, admins, mods, all of it, for every server. Type them or let the AI generate them.',
    genType: 'staff',
    backTo: 2,
    getMode: () => state.staffMode,
    setMode: m => { state.staffMode = m; },
    getText: () => state.staff,
    setText: t => { state.staff = t; },
    typeLabel: 'Type every staff member (username — rank — personality):',
    typePlaceholder: 'Server 1:\nxXDevKingXx — Head Developer — cocky, always late\nmoderatorMike — Mod — power hungry\n...',
    questions(body) {
      questionText(body, 'Roughly how many staff members total?', 'e.g. 12',
        () => state.staffAnswers.count, v => { state.staffAnswers.count = v; });
      questionChips(body, "What's the team like?", STAFF_VIBES,
        () => state.staffAnswers.vibe, v => { state.staffAnswers.vibe = v; });
      questionText(body, 'Any names you want included? (optional)', 'e.g. Jake, pixelqueen',
        () => state.staffAnswers.names, v => { state.staffAnswers.names = v; });
      questionChips(body, 'Should some staff be lazy, bad at their job, or shady?', YES_NO,
        () => state.staffAnswers.shady, v => { state.staffAnswers.shady = v; });
    },
    onNext: () => { state.step = 4; save(); renderStep(); },
  });
}

/* --- Step 5: game info --- */
function renderInfoStep() {
  const p = setupPanel;
  p.appendChild(el('div', 'step-label', 'STEP 5 OF 5'));
  p.appendChild(el('h2', 'step-title', 'About the game'));
  p.appendChild(el('p', 'step-sub', 'Last step — the game itself.'));

  let refresh = () => {};
  INFO_FIELDS.forEach(([key, label, placeholder]) => {
    const field = el('label', 'field');
    field.appendChild(el('span', 'field-label', label));
    const inp = el('input', 'text-input');
    inp.type = 'text';
    inp.placeholder = placeholder;
    inp.value = state.info[key] || '';
    inp.addEventListener('input', () => {
      state.info[key] = inp.value;
      save();
      refresh();
    });
    field.appendChild(inp);
    p.appendChild(field);
  });

  refresh = navRow(p, {
    backTo: 3,
    nextLabel: '▶ Start Game',
    canNext: () => INFO_FIELDS.every(([key]) => (state.info[key] || '').trim()),
    onNext: startGame,
  });
}

/* ================================ CHAT ================================ */

function startGame() {
  state.started = true;
  save();
  showChat();
}

function showChat() {
  setupArea.classList.add('hidden');
  chatArea.classList.remove('hidden');
  inputBar.classList.remove('hidden');
  messagesEl.innerHTML = '';
  for (const m of state.history) {
    if (m.role === 'user' && m.content === START_SIGNAL) continue;
    appendMessage(m.role, m.content);
  }
  scrollToBottom();

  const last = state.history[state.history.length - 1];
  if (!state.history.length) {
    // Fresh game: hidden kick-off signal so the staff message first.
    streamTurn(START_SIGNAL, true);
  } else if (last.role === 'user' && !isStreaming) {
    // Reloaded mid-reply: finish the pending turn.
    streamTurn(null, false);
  }
}

// Auto-resize textarea
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 160) + 'px';
  sendBtn.disabled = !input.value.trim() || isStreaming;
});

// Enter sends on desktop only (Shift+Enter for newline). On iPhone the return
// key is left alone so it inserts a newline instead of sending.
input.addEventListener('keydown', (e) => {
  if (isIOS) return;
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) sendMessage();
  }
});

sendBtn.addEventListener('click', sendMessage);

function sendMessage() {
  const text = input.value.trim();
  if (!text || isStreaming) return;
  input.value = '';
  input.style.height = 'auto';
  streamTurn(text, false);
}

// text: user message to add (null = reply to existing history). hidden: don't render it.
async function streamTurn(text, hidden) {
  if (isStreaming) return;
  isStreaming = true;
  sendBtn.disabled = true;
  sendBtn.classList.add('loading');

  if (text !== null) {
    state.history.push({ role: 'user', content: text });
    save();
    if (!hidden) appendMessage('user', text);
  }

  const { bubble, cursor } = createAssistantBubble();
  scrollToBottom();

  try {
    const res = await fetch('/api/game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: state.history, setup: setupPayload() }),
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
            bubble.innerHTML = `<div class="error-msg">${esc(parsed.error)}</div>`;
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
      state.history.push({ role: 'assistant', content: assistantText });
      save();
      bubble.innerHTML = renderMarkdown(assistantText);
    }
  } catch (err) {
    cursor.remove();
    bubble.innerHTML = `<div class="error-msg">Connection error: ${esc(err.message)}</div>`;
  }

  isStreaming = false;
  sendBtn.classList.remove('loading');
  sendBtn.disabled = !input.value.trim();
  scrollToBottom();
}

function appendMessage(role, content) {
  const div = el('div', `message ${role}`);
  const avatar = el('div', 'avatar', role === 'user' ? 'U' : '🎮');
  const bubble = el('div', 'bubble');
  bubble.innerHTML = role === 'user' ? esc(content) : renderMarkdown(content);
  div.appendChild(avatar);
  div.appendChild(bubble);
  messagesEl.appendChild(div);
  scrollToBottom();
  return bubble;
}

function createAssistantBubble() {
  const div = el('div', 'message assistant');
  const avatar = el('div', 'avatar', '🎮');
  const bubble = el('div', 'bubble');
  const cursor = el('span', 'typing-cursor');
  bubble.appendChild(cursor);
  div.appendChild(avatar);
  div.appendChild(bubble);
  messagesEl.appendChild(div);
  return { bubble, cursor };
}

function scrollToBottom() {
  chatArea.scrollTop = chatArea.scrollHeight;
}

// Lightweight markdown renderer
function renderMarkdown(text) {
  let html = esc(text);

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
