// ===== Elements =====
const setup = document.getElementById('setup');
const chatScreen = document.getElementById('chatScreen');
const roleChoice = document.getElementById('roleChoice');
const typeChoice = document.getElementById('typeChoice');
const personaLabel = document.getElementById('personaLabel');
const personaHint = document.getElementById('personaHint');
const personaInput = document.getElementById('personaInput');
const startBtn = document.getElementById('startBtn');

const chatArea = document.getElementById('chatArea');
const messagesEl = document.getElementById('messages');
const input = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const setupBtn = document.getElementById('setupBtn');
const startSessionBtn = document.getElementById('startSessionBtn');
const endSessionBtn = document.getElementById('endSessionBtn');
const nextWeekBtn = document.getElementById('nextWeekBtn');
const presetWrap = document.getElementById('presetWrap');
const presetGrid = document.getElementById('presetGrid');
const sessionTitle = document.getElementById('sessionTitle');
const sessionSub = document.getElementById('sessionSub');

// ===== State =====
let config = { aiRole: null, therapyType: 'both', persona: '' };
let history = [];
let isStreaming = false;
let weekNum = 1;
let sessionActive = false;

const TYPE_LABELS = { anger: 'Anger management', adhd: 'ADHD', both: 'Anger management & ADHD' };

// ===== Setup: role selection =====
roleChoice.addEventListener('click', (e) => {
  const btn = e.target.closest('.choice');
  if (!btn) return;
  config.aiRole = btn.dataset.role;
  [...roleChoice.children].forEach(c => c.classList.toggle('active', c === btn));
  updatePersonaCopy();
});

// ===== Setup: therapy type selection =====
typeChoice.addEventListener('click', (e) => {
  const btn = e.target.closest('.choice');
  if (!btn) return;
  config.therapyType = btn.dataset.type;
  [...typeChoice.children].forEach(c => c.classList.toggle('active', c === btn));
});

function updatePersonaCopy() {
  if (config.aiRole === 'therapist') {
    personaLabel.textContent = 'Describe your therapist';
    personaHint.textContent = 'Type in their details — name, personality, style, backstory. Pick a preset below, or leave blank for a blunt, no-bullshit therapist.';
    personaInput.placeholder = 'e.g. Dr. Marcus Vale, 50s, ex-Marine turned therapist. Gruff, swears constantly, zero patience for excuses but secretly deeply caring...';
    presetWrap.hidden = false;
  } else if (config.aiRole === 'client') {
    personaLabel.textContent = "Describe your client's persona";
    personaHint.textContent = "Type in their persona — name, age, what brought them in, their attitude and struggles. Leave blank for a defensive, short-fused client.";
    personaInput.placeholder = 'e.g. Jordan, 24, anger issues after losing a job. Hot-headed, defensive, swears when cornered, blames everyone else but is secretly scared...';
    presetWrap.hidden = true;
    [...presetGrid.children].forEach(c => c.classList.remove('active'));
  }
}

// ===== Preset therapists =====
const PRESET_THERAPISTS = [
  {
    name: 'Dr. Marcus Vale',
    tag: 'Ex-Marine · tough love',
    persona: 'Dr. Marcus Vale, late 50s, ex-Marine turned therapist. Gruff, blunt, swears like a drill sergeant. Zero patience for excuses or self-pity, but underneath the hard shell he genuinely gives a damn and wants you to win. Pushes hard, calls out bullshit immediately, hands you concrete no-nonsense tools.',
  },
  {
    name: 'Dr. Lena Cross',
    tag: 'Sharp · dark humor',
    persona: 'Dr. Lena Cross, 40s, razor-sharp and sarcastic with a pitch-black sense of humor. Brutally honest, drops f-bombs casually, cuts through denial with a scalpel. Warm in a prickly way — she roasts you because she sees your potential. Fast, smart, never coddles.',
  },
  {
    name: '"Coach" Rome',
    tag: 'High-energy · street-smart',
    persona: 'Marcus "Coach" Rome, 30s, high-energy street-smart former boxer turned counselor. Talks fast and loud, full of slang and cursing, hypes you up like a corner coach but holds you dead accountable. Raw, real, motivational — gets in your face when you slack but celebrates every win.',
  },
  {
    name: 'Dr. Sufjan Patel',
    tag: 'Calm · deadpan',
    persona: 'Dr. Sufjan Patel, 50s, calm and deadpan with dry wit. Speaks slowly and deliberately, swears sparingly but precisely for effect. Unshakeable, sees right through your bullshit and names it quietly. Patient but firm — makes you sit with the uncomfortable truth.',
  },
];

function renderPresets() {
  PRESET_THERAPISTS.forEach(p => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'preset';
    btn.innerHTML = `<span class="preset-name"></span><span class="preset-tag"></span>`;
    btn.querySelector('.preset-name').textContent = p.name;
    btn.querySelector('.preset-tag').textContent = p.tag;
    btn.addEventListener('click', () => {
      // Picking a preset means the AI is the therapist.
      config.aiRole = 'therapist';
      [...roleChoice.children].forEach(c => c.classList.toggle('active', c.dataset.role === 'therapist'));
      updatePersonaCopy();
      personaInput.value = p.persona;
      [...presetGrid.children].forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
    });
    presetGrid.appendChild(btn);
  });
}
renderPresets();

// ===== Start the session =====
startBtn.addEventListener('click', startSession);

function startSession() {
  if (!config.aiRole) {
    roleChoice.classList.add('nudge');
    setTimeout(() => roleChoice.classList.remove('nudge'), 500);
    return;
  }

  config.persona = personaInput.value.trim();
  weekNum = 1;
  sessionActive = false;
  history = [];
  messagesEl.innerHTML = '';

  setup.hidden = true;
  chatScreen.hidden = false;
  input.placeholder = 'Say something… or /startsession, /end, /next week';

  updateHeader();
  updateControls();
  appendNotice(`Week ${weekNum}. Type /startsession or hit Start to begin.`);
  input.focus();
}

function updateHeader() {
  const aiIs = config.aiRole === 'therapist' ? 'AI Therapist' : 'AI Client';
  const youAre = config.aiRole === 'therapist' ? "you're the client" : "you're the therapist";
  sessionTitle.textContent = `Week ${weekNum} · ${aiIs}`;
  sessionSub.textContent = `${youAre} · ${TYPE_LABELS[config.therapyType]}`;
}

// A small centered status line in the transcript (week markers, hints).
function appendNotice(text) {
  const div = document.createElement('div');
  div.className = 'notice';
  div.textContent = text;
  messagesEl.appendChild(div);
  scrollToBottom();
}

// ===== Session commands (also wired to the buttons) =====
function startSessionCmd() {
  if (isStreaming) return;
  if (sessionActive) { appendNotice('A session is already in progress.'); return; }
  sessionActive = true;
  const opener = config.aiRole === 'therapist'
    ? `(Week ${weekNum} therapy session begins now — a clean slate, no memory of earlier weeks. Open it: greet your client and get things started in your own voice. Spoken words only.)`
    : `(Week ${weekNum} therapy session begins now — a clean slate, no memory of earlier weeks. You've just walked in and sat down. Say your first thing. Spoken words only.)`;
  history.push({ role: 'user', content: opener });
  streamReply();
}

function endSessionCmd() {
  if (isStreaming) return;
  if (!sessionActive) { appendNotice('No active session to end.'); return; }
  sessionActive = false;
  const closer = config.aiRole === 'therapist'
    ? '(The session is ending now. Wrap it up — give your client your closing thoughts, any takeaway or homework, and say goodbye, all in your own voice. Spoken words only.)'
    : '(The session is ending now. Wrap it up — say your closing thoughts and goodbye in your own voice. Spoken words only.)';
  history.push({ role: 'user', content: closer });
  streamReply();
}

function nextWeekCmd() {
  if (isStreaming) return;
  weekNum++;
  sessionActive = false;
  history = []; // clean slate — the AI carries no memory into the new week
  updateHeader();
  updateControls();
  appendNotice(`— Week ${weekNum} — Type /startsession to begin.`);
  input.focus();
}

startSessionBtn.addEventListener('click', startSessionCmd);
endSessionBtn.addEventListener('click', endSessionCmd);
nextWeekBtn.addEventListener('click', nextWeekCmd);

function updateControls() {
  startSessionBtn.disabled = sessionActive || isStreaming;
  endSessionBtn.disabled = !sessionActive || isStreaming;
  nextWeekBtn.disabled = isStreaming;
}

// ===== Setup: change therapist / persona / focus =====
setupBtn.addEventListener('click', () => {
  if (isStreaming) return;
  config = { aiRole: null, therapyType: config.therapyType, persona: '' };
  history = [];
  sessionActive = false;
  messagesEl.innerHTML = '';
  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;
  // reset selections
  [...roleChoice.children].forEach(c => c.classList.remove('active'));
  [...presetGrid.children].forEach(c => c.classList.remove('active'));
  presetWrap.hidden = true;
  chatScreen.hidden = true;
  setup.hidden = false;
});

// ===== Input handling =====
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 200) + 'px';
  sendBtn.disabled = !input.value.trim() || isStreaming;
});

// Note: Enter/Return inserts a newline (it does NOT send). Send is via the
// button only, so the iPhone return key won't fire off a message.

sendBtn.addEventListener('click', sendMessage);

async function sendMessage() {
  const text = input.value.trim();
  if (!text || isStreaming) return;

  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;

  // Slash commands control the session instead of talking to the AI.
  if (text.startsWith('/')) {
    handleCommand(text);
    return;
  }

  // Free-typing implicitly starts the session if it isn't going yet.
  if (!sessionActive) sessionActive = true;
  history.push({ role: 'user', content: text });
  appendMessage('user', text);

  await streamReply();
}

function handleCommand(raw) {
  const cmd = raw.slice(1).trim().toLowerCase().replace(/\s+/g, ' ');
  if (['start', 'startsession', 'start session', 'begin'].includes(cmd)) {
    startSessionCmd();
  } else if (['end', 'endsession', 'end session', 'stop'].includes(cmd)) {
    endSessionCmd();
  } else if (['next', 'next week', 'nextweek', 'next session'].includes(cmd)) {
    nextWeekCmd();
  } else if (cmd === 'help' || cmd === 'commands') {
    appendNotice('Commands:  /startsession  ·  /end  ·  /next week');
  } else {
    appendNotice(`Unknown command "/${cmd}". Try /startsession, /end, or /next week.`);
  }
}

// ===== Stream a reply from the AI character =====
async function streamReply() {
  isStreaming = true;
  sendBtn.disabled = true;
  sendBtn.classList.add('loading');
  updateControls();

  const { bubble, cursor } = createAssistantBubble();
  scrollToBottom();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history, config }),
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
    const clean = stripNarration(assistantText);
    if (clean) {
      history.push({ role: 'assistant', content: clean });
      bubble.innerHTML = renderText(clean);
    } else {
      bubble.parentElement.remove();
    }
  } catch (err) {
    cursor.remove();
    bubble.innerHTML = `<div class="error-msg">Connection error: ${escapeHtml(err.message)}</div>`;
  }

  isStreaming = false;
  sendBtn.classList.remove('loading');
  sendBtn.disabled = !input.value.trim();
  updateControls();
  scrollToBottom();
}

// ===== Rendering =====
function aiAvatarChar() {
  return config.aiRole === 'therapist' ? 'T' : 'C';
}
function userAvatarChar() {
  return config.aiRole === 'therapist' ? 'C' : 'T';
}

function appendMessage(role, content) {
  const div = document.createElement('div');
  div.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'user' ? userAvatarChar() : aiAvatarChar();

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = role === 'user' ? renderText(content) : renderText(content);

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
  avatar.textContent = aiAvatarChar();

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

// Strip any stage direction / action narration the model slips in, so only
// the spoken words remain.
function stripNarration(text) {
  return text
    .replace(/\*[^*\n]*\*/g, '')        // *leans back*, *sighs*
    .replace(/_[^_\n]*_/g, '')          // _underscored actions_
    .replace(/\[[^\]\n]*\]/g, '')       // [pauses], [stage directions]
    .replace(/[ \t]{2,}/g, ' ')         // collapse double spaces left behind
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    .trim();
}

// Plain spoken dialogue — strip narration, escape, turn newlines into paragraphs.
function renderText(text) {
  return escapeHtml(stripNarration(text))
    .split(/\n\n+/)
    .map(block => `<p>${block.replace(/\n/g, '<br>')}</p>`)
    .join('');
}
