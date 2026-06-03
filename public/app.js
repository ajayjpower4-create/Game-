const chatArea = document.getElementById('chatArea');
const messagesEl = document.getElementById('messages');
const welcome = document.getElementById('welcome');
const input = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const resetBtn = document.getElementById('resetBtn');
const profileBtn = document.getElementById('profileBtn');
const profilePanel = document.getElementById('profilePanel');
const coupleInfoEl = document.getElementById('coupleInfo');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const sessionBadge = document.getElementById('sessionBadge');
const cmdChips = document.getElementById('cmdChips');

let history = [];
let isStreaming = false;
let coupleInfo = '';
let week = 1;
let inSession = false;

// ---- Profile setup ----
saveProfileBtn.addEventListener('click', () => {
  coupleInfo = coupleInfoEl.value.trim();
  profilePanel.classList.remove('open');
  input.focus();
  updateBadge();
});

profileBtn.addEventListener('click', () => {
  profilePanel.classList.toggle('open');
  if (profilePanel.classList.contains('open')) coupleInfoEl.focus();
});

// Open the profile panel by default on load.
profilePanel.classList.add('open');

// ---- Input handling ----
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 200) + 'px';
  sendBtn.disabled = !input.value.trim() || isStreaming;
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) handleSend();
  }
});

sendBtn.addEventListener('click', handleSend);
resetBtn.addEventListener('click', resetAll);

// Command chips below the input.
cmdChips.querySelectorAll('.cmd-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    if (isStreaming) return;
    input.value = chip.dataset.cmd;
    handleSend();
  });
});

function updateBadge() {
  if (inSession) {
    sessionBadge.textContent = `Week ${week} · In session`;
    sessionBadge.className = 'session-badge active';
  } else {
    sessionBadge.textContent = coupleInfo ? `Week ${week} · Not started` : 'Not started';
    sessionBadge.className = 'session-badge';
  }
}

function resetAll() {
  history = [];
  messagesEl.innerHTML = '';
  welcome.style.display = 'flex';
  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;
  isStreaming = false;
  week = 1;
  inSession = false;
  updateBadge();
}

// Decide whether the input is a command or a line of dialogue.
function handleSend() {
  const text = input.value.trim();
  if (!text || isStreaming) return;

  if (text.startsWith('(')) {
    runCommand(text);
  } else {
    sendTurn(text, 'user');
  }
}

// Parse and execute a ( command.
function runCommand(raw) {
  const cmd = raw.slice(1).trim().toLowerCase().replace(/^\(+/, '').trim();
  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;

  if (cmd.startsWith('start') || cmd.startsWith('begin')) {
    if (inSession) {
      addScene(`You're already in session ${week}. Talk to the couple, or use ( end / ( next.`, 'info');
      return;
    }
    inSession = true;
    updateBadge();
    addScene(`Session ${week} — begins`, 'start');
    sendTurn(
      `(The therapist welcomes the couple into the room and begins therapy session #${week}. Settle in and respond in character.)`,
      'stage'
    );
    return;
  }

  if (cmd.startsWith('end') || cmd.startsWith('stop') || cmd.startsWith('close')) {
    if (!inSession) {
      addScene('No session is currently running. Use ( start to begin one.', 'info');
      return;
    }
    inSession = false;
    updateBadge();
    addScene(`Session ${week} — ends`, 'end');
    sendTurn(
      `(The therapist brings session #${week} to a close. Give a natural closing beat showing where each partner is as they gather their things to leave.)`,
      'stage'
    );
    return;
  }

  if (cmd.startsWith('next') || cmd.startsWith('skip') || cmd.startsWith('week')) {
    week += 1;
    inSession = true;
    updateBadge();
    addScene(`One week later — Session ${week}`, 'next');
    sendTurn(
      `(One week has passed. The couple returns for therapy session #${week}. Acknowledge the time that passed — whether they tried what was discussed, what happened during the week, and any shift in mood — then settle in.)`,
      'stage'
    );
    return;
  }

  if (cmd.startsWith('help') || cmd === '?' || cmd === '') {
    addScene(
      '( start — begin the session  •  ( end — end the session  •  ( next — jump to next week  •  anything else is spoken to the couple.',
      'info'
    );
    return;
  }

  addScene(`Unknown command "(${cmd}". Try ( start, ( end, ( next, or ( help.`, 'info');
}

// Send a turn to the model. kind: 'user' (therapist speech) or 'stage' (bracketed direction).
async function sendTurn(text, kind) {
  welcome.style.display = 'none';
  isStreaming = true;
  sendBtn.disabled = true;
  sendBtn.classList.add('loading');

  history.push({ role: 'user', content: text });
  if (kind === 'user') {
    appendMessage('therapist', text);
    input.value = '';
    input.style.height = 'auto';
  }

  const { bubble, cursor } = createCoupleBubble();
  scrollToBottom();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history, coupleInfo }),
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
            bubble.innerHTML = renderMarkdown(coupleText);
            bubble.appendChild(cursor);
            scrollToBottom();
          }
        } catch {}
      }
    }

    cursor.remove();
    if (coupleText) {
      history.push({ role: 'assistant', content: coupleText });
      bubble.innerHTML = renderMarkdown(coupleText);
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

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'therapist' ? '🧑‍⚕️' : '💑';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = role === 'therapist' ? escapeHtml(content) : renderMarkdown(content);

  div.appendChild(avatar);
  div.appendChild(bubble);
  messagesEl.appendChild(div);
  scrollToBottom();
  return bubble;
}

function createCoupleBubble() {
  const div = document.createElement('div');
  div.className = 'message couple';

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = '💑';

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

// A centered scene marker (session start/end/next/info) in the transcript.
function addScene(text, variant) {
  welcome.style.display = 'none';
  const div = document.createElement('div');
  div.className = `scene scene-${variant}`;
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

// Lightweight markdown renderer
function renderMarkdown(text) {
  let html = escapeHtml(text);

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

updateBadge();
