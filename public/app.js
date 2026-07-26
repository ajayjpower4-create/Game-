const chatArea = document.getElementById('chatArea');
const messagesEl = document.getElementById('messages');
const input = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const newChatBtn = document.getElementById('newChatBtn');
const inputArea = document.getElementById('inputArea');

const setup = document.getElementById('setup');
const rankInput = document.getElementById('rankInput');
const nameInput = document.getElementById('nameInput');
const setupBtn = document.getElementById('setupBtn');

const statusEl = document.getElementById('status');
const statusRole = document.getElementById('statusRole');
const statusDay = document.getElementById('statusDay');

let history = [];
let isStreaming = false;
let day = 1;
let profile = { rank: '', name: '' };

// ---- Setup / game start ---------------------------------------------------
setupBtn.addEventListener('click', startGame);
[rankInput, nameInput].forEach(el => {
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); startGame(); }
  });
});

function startGame() {
  const rank = rankInput.value.trim();
  const name = nameInput.value.trim();
  if (!rank) { rankInput.focus(); return; }
  if (!name) { nameInput.focus(); return; }

  profile = { rank, name };
  day = 1;
  history = [];
  messagesEl.innerHTML = '';

  setup.style.display = 'none';
  chatArea.hidden = false;
  inputArea.hidden = false;
  statusEl.hidden = false;
  statusRole.textContent = `${name} · ${rank}`;
  statusDay.textContent = 'Day 1';

  // Seed the roleplay. This user turn establishes who the player is and asks
  // the world to kick off the school day in-character (no narration).
  const opener =
    `(I am ${name}, and my rank at Harford Secondary is ${rank}. ` +
    `It is Day 1, the very start of the school day — students arriving / tutor time.) ` +
    `*I walk into the building to start my day.*`;

  history.push({ role: 'user', content: opener });
  appendMessage('user', opener);
  streamAssistant();
  input.focus();
}

// ---- Input handling -------------------------------------------------------
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
newChatBtn.addEventListener('click', resetToSetup);

document.querySelectorAll('.quick').forEach(btn => {
  btn.addEventListener('click', () => {
    if (isStreaming) return;
    input.value = btn.dataset.text;
    input.dispatchEvent(new Event('input'));
    sendMessage();
  });
});

function resetToSetup() {
  history = [];
  messagesEl.innerHTML = '';
  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;
  isStreaming = false;
  chatArea.hidden = true;
  inputArea.hidden = true;
  statusEl.hidden = true;
  setup.style.display = 'flex';
  rankInput.value = profile.rank || '';
  nameInput.value = profile.name || '';
  rankInput.focus();
}

async function sendMessage() {
  let text = input.value.trim();
  if (!text || isStreaming) return;

  // /nextday advances the school day and injects a clear day marker.
  if (/^\/nextday\b/i.test(text)) {
    day += 1;
    statusDay.textContent = `Day ${day}`;
    text =
      `(A new school day begins — this is Day ${day} at Harford Secondary. ` +
      `It is the very start of the day: 8:20am, students arriving, then tutor ` +
      `time and registration.) *I arrive at school to start Day ${day}.*`;
    appendDayDivider(day);
  }

  history.push({ role: 'user', content: text });
  appendMessage('user', text);

  input.value = '';
  input.style.height = 'auto';

  streamAssistant();
}

async function streamAssistant() {
  isStreaming = true;
  sendBtn.disabled = true;
  sendBtn.classList.add('loading');

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

function appendDayDivider(n) {
  const div = document.createElement('div');
  div.className = 'day-divider';
  div.innerHTML = `<span>Day ${n}</span>`;
  messagesEl.appendChild(div);
}

function appendMessage(role, content) {
  const div = document.createElement('div');
  div.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'user' ? '🧑‍🏫' : '🏫';

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
  avatar.textContent = '🏫';

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
