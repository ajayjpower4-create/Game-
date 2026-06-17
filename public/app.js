const chatArea = document.getElementById('chatArea');
const messagesEl = document.getElementById('messages');
const welcome = document.getElementById('welcome');
const input = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const newGameBtn = document.getElementById('newGameBtn');
const beginBtn = document.getElementById('beginBtn');
const dayPill = document.getElementById('dayPill');
const shiftPill = document.getElementById('shiftPill');
const cmdRow = document.getElementById('cmdRow');

// Computer overlay
const computerOverlay = document.getElementById('computerOverlay');
const computerChip = document.getElementById('computerChip');
const computerClose = document.getElementById('computerClose');

const SAVE_KEY = 'villas-lincoln-save-v1';
const AUTOSAVE_EVERY = 5; // save automatically after every 5 messages

let history = [];
let isStreaming = false;
let day = 1;
let onShift = false;
let msgCountSinceSave = 0;

// ---------------------------------------------------------------------------
//  Save / load  (auto-saves so the player never loses their day/week)
// ---------------------------------------------------------------------------
function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ history, day, onShift }));
    msgCountSinceSave = 0;
  } catch {}
}

function maybeAutosave() {
  msgCountSinceSave++;
  if (msgCountSinceSave >= AUTOSAVE_EVERY) saveGame();
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.history) || data.history.length === 0) return false;
    history = data.history;
    day = data.day || 1;
    onShift = !!data.onShift;
    welcome.style.display = 'none';
    for (const m of history) {
      appendMessage(m.role, m.content);
    }
    updateHud();
    scrollToBottom();
    return true;
  } catch {
    return false;
  }
}

function updateHud() {
  dayPill.textContent = `Day ${day}`;
  if (onShift) {
    shiftPill.textContent = 'On Shift';
    shiftPill.classList.remove('shift-off');
    shiftPill.classList.add('shift-on');
  } else {
    shiftPill.textContent = 'Off Shift';
    shiftPill.classList.add('shift-off');
    shiftPill.classList.remove('shift-on');
  }
}

// ---------------------------------------------------------------------------
//  Input handling
//  NOTE: The return/enter key intentionally does NOT send the message
//  (so the iPhone return button just adds a new line). Use the ➤ button.
// ---------------------------------------------------------------------------
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 200) + 'px';
  sendBtn.disabled = !input.value.trim() || isStreaming;
});

// Deliberately do not send on Enter — return key inserts a newline only.

sendBtn.addEventListener('click', () => sendMessage());
newGameBtn.addEventListener('click', resetGame);
beginBtn.addEventListener('click', () => {
  sendMessage('I pull up to the front gate of The Villas at Lincoln Apartments in my car and roll down my window for the security guards.');
});

// Command chips
cmdRow.querySelectorAll('.cmd-chip[data-cmd]').forEach(btn => {
  btn.addEventListener('click', () => sendMessage(btn.dataset.cmd));
});

// Computer overlay open/close
computerChip.addEventListener('click', openComputer);
computerClose.addEventListener('click', closeComputer);
computerOverlay.addEventListener('click', (e) => {
  if (e.target === computerOverlay) closeComputer();
});
document.querySelectorAll('.app-tile').forEach(tile => {
  tile.addEventListener('click', () => {
    closeComputer();
    sendMessage(`/Computer ${tile.dataset.app}`);
  });
});

function openComputer() {
  if (isStreaming) return;
  computerOverlay.hidden = false;
}
function closeComputer() {
  computerOverlay.hidden = true;
}

function resetGame() {
  if (!confirm('Start a brand new game? This erases your saved progress.')) return;
  history = [];
  day = 1;
  onShift = false;
  msgCountSinceSave = 0;
  messagesEl.innerHTML = '';
  welcome.style.display = 'flex';
  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;
  isStreaming = false;
  try { localStorage.removeItem(SAVE_KEY); } catch {}
  updateHud();
}

// Adjust game state from slash commands the player issues
function applyCommandState(text) {
  const t = text.trim().toLowerCase();
  if (t === '/start shift') { onShift = true; updateHud(); }
  else if (t === '/end shift') { onShift = false; updateHud(); }
  else if (t === '/nextday') { day++; onShift = false; updateHud(); }
}

// ---------------------------------------------------------------------------
//  Send a turn
// ---------------------------------------------------------------------------
async function sendMessage(forcedText) {
  const text = (forcedText !== undefined ? forcedText : input.value).trim();
  if (!text || isStreaming) return;

  welcome.style.display = 'none';
  isStreaming = true;
  sendBtn.disabled = true;
  sendBtn.classList.add('loading');

  applyCommandState(text);

  history.push({ role: 'user', content: text });
  appendMessage('user', text);
  maybeAutosave();

  if (forcedText === undefined) {
    input.value = '';
    input.style.height = 'auto';
  }

  const { bubble, cursor } = createAssistantBubble();
  scrollToBottom();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history }),
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
            bubble.innerHTML = renderMarkdown(assistantText);
            bubble.appendChild(cursor);
            scrollToBottom();
          }
        } catch {}
      }
    }

    cursor.remove();
    if (assistantText) {
      history.push({ role: 'assistant', content: assistantText });
      bubble.innerHTML = renderMarkdown(assistantText);
      maybeAutosave();
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

// ---------------------------------------------------------------------------
//  Rendering
// ---------------------------------------------------------------------------
function appendMessage(role, content) {
  const div = document.createElement('div');
  div.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'user' ? 'YOU' : '🏢';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = role === 'user' ? escapeHtml(content) : renderMarkdown(content);

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
  avatar.textContent = '🏢';

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

// ---------------------------------------------------------------------------
//  Boot
// ---------------------------------------------------------------------------
// Save before the tab closes so nothing is lost between autosaves.
window.addEventListener('beforeunload', saveGame);

loadGame();
updateHud();
