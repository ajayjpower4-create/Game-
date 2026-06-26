const chatArea = document.getElementById('chatArea');
const messagesEl = document.getElementById('messages');
const welcome = document.getElementById('welcome');
const input = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const newChatBtn = document.getElementById('newChatBtn');
const startBtn = document.getElementById('startBtn');
const saveBtn = document.getElementById('saveBtn');
const loadBtn = document.getElementById('loadBtn');

const SAVE_KEY = 'kotw-save';
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

let history = [];
let isStreaming = false;
let autosaveTimer = null;

// Auto-resize textarea
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 200) + 'px';
  sendBtn.disabled = !input.value.trim() || isStreaming;
});

// Send on Enter (Shift+Enter for newline). On iPhone, the return key never
// sends — it only inserts a newline; the King must tap the send button.
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !isIOS) {
    e.preventDefault();
    if (!sendBtn.disabled) sendMessage();
  }
});

sendBtn.addEventListener('click', sendMessage);
newChatBtn.addEventListener('click', resetChat);
startBtn.addEventListener('click', startGame);
saveBtn.addEventListener('click', saveGame);
loadBtn.addEventListener('click', loadGame);

function resetChat() {
  history = [];
  messagesEl.innerHTML = '';
  welcome.style.display = 'flex';
  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;
  isStreaming = false;
  stopAutosave();
}

function startGame() {
  welcome.style.display = 'none';
  startAutosave();
  history.push({ role: 'user', content: '[GAME START]' });

  const { bubble, cursor } = createAssistantBubble();
  scrollToBottom();
  streamAssistantReply(bubble, cursor);
}

function startAutosave() {
  stopAutosave();
  autosaveTimer = setInterval(saveGame, 3 * 60 * 1000);
}

function stopAutosave() {
  if (autosaveTimer) clearInterval(autosaveTimer);
  autosaveTimer = null;
}

function saveGame() {
  if (!history.length) return;
  localStorage.setItem(SAVE_KEY, JSON.stringify(history));
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return;

  try {
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved) || !saved.length) return;

    history = saved;
    messagesEl.innerHTML = '';
    welcome.style.display = 'none';

    for (const msg of saved) {
      if (msg.role === 'user' && msg.content === '[GAME START]') continue;
      const bubble = appendMessage(msg.role, msg.content);
      if (msg.role === 'assistant') bubble.innerHTML = renderMarkdown(msg.content);
    }

    startAutosave();
    scrollToBottom();
  } catch {}
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text || isStreaming) return;

  welcome.style.display = 'none';

  // Add user message
  history.push({ role: 'user', content: text });
  appendMessage('user', text);

  input.value = '';
  input.style.height = 'auto';

  // Create assistant bubble
  const { bubble, cursor } = createAssistantBubble();
  scrollToBottom();
  await streamAssistantReply(bubble, cursor);
}

async function streamAssistantReply(bubble, cursor) {
  isStreaming = true;
  sendBtn.disabled = true;
  sendBtn.classList.add('loading');

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

function appendMessage(role, content) {
  const div = document.createElement('div');
  div.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'user' ? 'U' : '◈';

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
  avatar.textContent = '◈';

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

  // Code blocks
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code>${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold & italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Blockquote
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // Unordered list
  html = html.replace(/^[*\-] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]+?<\/li>)(?!\s*<li>)/g, '<ul>$1</ul>');

  // Ordered list
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr>');

  // Paragraphs (double newlines)
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
