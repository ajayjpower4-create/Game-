const chatArea = document.getElementById('chatArea');
const messagesEl = document.getElementById('messages');
const welcome = document.getElementById('welcome');
const input = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const newChatBtn = document.getElementById('newChatBtn');
const profileBtn = document.getElementById('profileBtn');
const profilePanel = document.getElementById('profilePanel');
const coupleInfoEl = document.getElementById('coupleInfo');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const savedNote = document.getElementById('savedNote');
const sessionBadge = document.getElementById('sessionBadge');
const sessionToggleBtn = document.getElementById('sessionToggleBtn');
const nextWeekBtn = document.getElementById('nextWeekBtn');

const PROFILE_KEY = 'therapy.coupleInfo';

let history = [];
let isStreaming = false;
let inSession = false;
let week = 1;

// ---- Couple profile (persisted) -------------------------------------------
coupleInfoEl.value = localStorage.getItem(PROFILE_KEY) || '';

profileBtn.addEventListener('click', () => {
  profilePanel.hidden = !profilePanel.hidden;
  if (!profilePanel.hidden) coupleInfoEl.focus();
});

saveProfileBtn.addEventListener('click', () => {
  localStorage.setItem(PROFILE_KEY, coupleInfoEl.value);
  savedNote.textContent = 'Saved ✓';
  setTimeout(() => { savedNote.textContent = ''; }, 1800);
});

function coupleInfo() {
  return coupleInfoEl.value.trim();
}

// ---- Input wiring ----------------------------------------------------------
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
newChatBtn.addEventListener('click', resetAll);

sessionToggleBtn.addEventListener('click', () => { if (!isStreaming) toggleSession(); });
nextWeekBtn.addEventListener('click', () => { if (!isStreaming) nextWeek(); });

// ---- Commands --------------------------------------------------------------
function sendMessage() {
  const text = input.value.trim();
  if (!text || isStreaming) return;

  // Command: "(" toggles the session (start / end).
  if (text === '(') {
    clearInput();
    toggleSession();
    return;
  }

  // Command: ">" advances to next week's session.
  if (text === '>' || text === '>>' || text.toLowerCase() === '/next') {
    clearInput();
    nextWeek();
    return;
  }

  clearInput();
  runTurn(text, { role: 'therapist' });
}

function toggleSession() {
  if (!inSession) {
    inSession = true;
    updateSessionUI();
    addDivider(`Session ${week} — started`);
    runTurn(`[The therapist welcomes the couple in and begins therapy session #${week}.]`, { silent: true });
  } else {
    inSession = false;
    updateSessionUI();
    addDivider(`Session ${week} — ended`);
    runTurn('[The therapist signals that time is up and gently ends the session for today.]', { silent: true });
  }
}

function nextWeek() {
  week += 1;
  inSession = true;
  updateSessionUI();
  addDivider(`One week later — Session ${week}`);
  runTurn(`[One week has passed. The couple returns for therapy session #${week}.]`, { silent: true });
}

function updateSessionUI() {
  if (inSession) {
    sessionBadge.textContent = `In session · Week ${week}`;
    sessionBadge.classList.add('live');
    sessionToggleBtn.innerHTML = '( End session';
  } else {
    sessionBadge.textContent = week > 1 ? `Between sessions · after Week ${week}` : 'Not in session';
    sessionBadge.classList.remove('live');
    sessionToggleBtn.innerHTML = '( Start session';
  }
}

function clearInput() {
  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;
}

function resetAll() {
  history = [];
  messagesEl.innerHTML = '';
  welcome.style.display = 'flex';
  inSession = false;
  week = 1;
  updateSessionUI();
  clearInput();
  isStreaming = false;
}

// ---- Turn execution --------------------------------------------------------
// `silent` directions (stage cues) are shown as a faint therapist note rather
// than a normal chat bubble.
async function runTurn(text, { silent = false } = {}) {
  welcome.style.display = 'none';
  isStreaming = true;
  sendBtn.disabled = true;
  sendBtn.classList.add('loading');
  setCommandsDisabled(true);

  history.push({ role: 'user', content: text });
  if (silent) {
    appendDirection(text);
  } else {
    appendMessage('user', text);
  }

  const { bubble, cursor } = createCoupleBubble();
  scrollToBottom();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history, coupleInfo: coupleInfo(), week }),
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let coupleText = '';
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
            coupleText += parsed.text;
            bubble.innerHTML = renderDialogue(coupleText);
            bubble.appendChild(cursor);
            scrollToBottom();
          }
        } catch {}
      }
    }

    cursor.remove();
    if (coupleText) {
      history.push({ role: 'assistant', content: coupleText });
      bubble.innerHTML = renderDialogue(coupleText);
    }
  } catch (err) {
    cursor.remove();
    bubble.innerHTML = `<div class="error-msg">Connection error: ${escapeHtml(err.message)}</div>`;
  }

  isStreaming = false;
  sendBtn.classList.remove('loading');
  sendBtn.disabled = !input.value.trim();
  setCommandsDisabled(false);
  scrollToBottom();
}

function setCommandsDisabled(disabled) {
  sessionToggleBtn.disabled = disabled;
  nextWeekBtn.disabled = disabled;
}

// ---- Rendering -------------------------------------------------------------
function appendMessage(role, content) {
  const div = document.createElement('div');
  div.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = 'Dr';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = escapeHtml(content);

  div.appendChild(avatar);
  div.appendChild(bubble);
  messagesEl.appendChild(div);
  scrollToBottom();
  return bubble;
}

function appendDirection(text) {
  const div = document.createElement('div');
  div.className = 'direction';
  div.textContent = text.replace(/^\[|\]$/g, '');
  messagesEl.appendChild(div);
  scrollToBottom();
}

function addDivider(label) {
  const div = document.createElement('div');
  div.className = 'divider';
  div.innerHTML = `<span>${escapeHtml(label)}</span>`;
  messagesEl.appendChild(div);
  scrollToBottom();
}

function createCoupleBubble() {
  const div = document.createElement('div');
  div.className = 'message couple';

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = '❤';

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

// Render the couple's dialogue: highlight "Name:" speaker labels and
// *stage directions* in asterisks.
function renderDialogue(text) {
  return escapeHtml(text)
    .split('\n')
    .map(line => {
      if (!line.trim()) return '';
      let html = line;
      // Speaker label at start of a line: "Name:" or "Name (beat):"
      html = html.replace(/^([A-Z][\w .'-]{0,30}?):/, '<span class="speaker">$1:</span>');
      // *stage directions*
      html = html.replace(/\*([^*]+)\*/g, '<em class="stage">$1</em>');
      return `<p>${html}</p>`;
    })
    .filter(Boolean)
    .join('');
}

updateSessionUI();
