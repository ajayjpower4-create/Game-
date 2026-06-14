// --- Setup screen elements ---
const setup = document.getElementById('setup');
const session = document.getElementById('session');
const roleCards = document.querySelectorAll('.role-card');
const therapyGrid = document.getElementById('therapyGrid');
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

// ---------- Setup interactions ----------
roleCards.forEach((card) => {
  card.addEventListener('click', () => {
    selectedRole = card.dataset.role;
    roleCards.forEach((c) => c.classList.toggle('selected', c === card));
    refreshStartBtn();
  });
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
  startBtn.disabled = !selectedRole || selectedTherapies.length === 0;
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
  setup.classList.add('hidden');
  session.classList.remove('hidden');

  input.placeholder = selectedRole === 'therapist'
    ? 'Open the session, doc...'
    : 'Tell your therapist what\'s up...';

  // Seed the conversation so the AI opens in character.
  const opener = selectedRole === 'therapist'
    ? '(The session begins. The client has just sat down. Speak first, in character.)'
    : '(The session begins. The client has just sat down across from you. Speak first, in character.)';

  history.push({ role: 'user', content: opener });
  streamResponse();
  input.focus();
}

function endSession() {
  if (isStreaming) return;
  session.classList.add('hidden');
  setup.classList.remove('hidden');
  history = [];
  input.value = '';
}

// ---------- Input handling ----------
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 160) + 'px';
  sendBtn.disabled = !input.value.trim() || isStreaming;
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
  if (!text || isStreaming) return;

  history.push({ role: 'user', content: text });
  appendMessage('user', text);

  input.value = '';
  input.style.height = 'auto';

  streamResponse();
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
