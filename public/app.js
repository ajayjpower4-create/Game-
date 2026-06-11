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
const newChatBtn = document.getElementById('newChatBtn');
const startSessionBtn = document.getElementById('startSessionBtn');
const endSessionBtn = document.getElementById('endSessionBtn');
const sessionTitle = document.getElementById('sessionTitle');
const sessionSub = document.getElementById('sessionSub');

// ===== State =====
let config = { aiRole: null, therapyType: 'both', persona: '' };
let history = [];
let isStreaming = false;

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
    personaHint.textContent = 'Type in their details — name, personality, style, backstory. Leave blank for a blunt, no-bullshit therapist.';
    personaInput.placeholder = 'e.g. Dr. Marcus Vale, 50s, ex-Marine turned therapist. Gruff, swears constantly, zero patience for excuses but secretly deeply caring...';
  } else if (config.aiRole === 'client') {
    personaLabel.textContent = "Describe your client's persona";
    personaHint.textContent = "Type in their persona — name, age, what brought them in, their attitude and struggles. Leave blank for a defensive, short-fused client.";
    personaInput.placeholder = 'e.g. Jordan, 24, anger issues after losing a job. Hot-headed, defensive, swears when cornered, blames everyone else but is secretly scared...';
  }
}

// ===== Start the session =====
startBtn.addEventListener('click', startSession);

function startSession() {
  if (!config.aiRole) {
    roleChoice.classList.add('nudge');
    setTimeout(() => roleChoice.classList.remove('nudge'), 500);
    return;
  }

  config.persona = personaInput.value.trim();
  history = [];
  messagesEl.innerHTML = '';

  // Header info
  const aiIs = config.aiRole === 'therapist' ? 'AI Therapist' : 'AI Client';
  const youAre = config.aiRole === 'therapist' ? "You're the client" : "You're the therapist";
  sessionTitle.textContent = aiIs;
  sessionSub.textContent = `${youAre} · ${TYPE_LABELS[config.therapyType]}`;

  setup.hidden = true;
  chatScreen.hidden = false;
  input.placeholder = config.aiRole === 'therapist'
    ? 'Talk to your therapist...'
    : 'Talk to your client...';
  updateControls();
  input.focus();
}

// ===== Start / End session buttons =====
startSessionBtn.addEventListener('click', () => {
  if (isStreaming || history.length > 0) return;
  const opener = config.aiRole === 'therapist'
    ? '(The session begins. Open it — greet your client and get things started in your own voice. Spoken words only.)'
    : "(The session begins. You've just walked in and sat down. Say your first thing. Spoken words only.)";
  history.push({ role: 'user', content: opener });
  streamReply();
});

endSessionBtn.addEventListener('click', () => {
  if (isStreaming || history.length === 0) return;
  const closer = config.aiRole === 'therapist'
    ? '(The session is ending now. Wrap it up — give your client your closing thoughts, any takeaway or homework, and say goodbye, all in your own voice. Spoken words only.)'
    : '(The session is ending now. Wrap it up — say your closing thoughts and goodbye in your own voice. Spoken words only.)';
  history.push({ role: 'user', content: closer });
  streamReply();
});

function updateControls() {
  const started = history.length > 0;
  startSessionBtn.disabled = started || isStreaming;
  endSessionBtn.disabled = !started || isStreaming;
}

// ===== Reset =====
newChatBtn.addEventListener('click', () => {
  if (isStreaming) return;
  config = { aiRole: null, therapyType: config.therapyType, persona: '' };
  history = [];
  messagesEl.innerHTML = '';
  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;
  // reset role highlight
  [...roleChoice.children].forEach(c => c.classList.remove('active'));
  chatScreen.hidden = true;
  setup.hidden = false;
});

// ===== Input handling =====
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 200) + 'px';
  sendBtn.disabled = !input.value.trim() || isStreaming;
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) sendMessage();
  }
});

sendBtn.addEventListener('click', sendMessage);

async function sendMessage() {
  const text = input.value.trim();
  if (!text || isStreaming) return;

  history.push({ role: 'user', content: text });
  appendMessage('user', text);

  input.value = '';
  input.style.height = 'auto';

  await streamReply();
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
