// ---- Screens & elements ----
const screenJobs = document.getElementById('screenJobs');
const screenSetup = document.getElementById('screenSetup');
const chatArea = document.getElementById('chatArea');
const inputArea = document.getElementById('inputArea');

const messagesEl = document.getElementById('messages');
const input = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const newChatBtn = document.getElementById('newChatBtn');

const backBtn = document.getElementById('backBtn');
const startBtn = document.getElementById('startBtn');
const setupForm = document.getElementById('setupForm');
const setupTitle = document.getElementById('setupTitle');
const setupSub = document.getElementById('setupSub');

// ---- Job setup definitions ----
const JOB_FORMS = {
  garbage: {
    title: 'Garbage Collector',
    sub: 'Build your crew and the haul. Leave anything blank to let the sim decide.',
    fields: [
      { name: 'role', label: 'Your role', type: 'select',
        options: ['Thrower / Loader', 'Truck Driver', 'Crew Lead', 'Rookie', 'Operator (rear/side loader)'],
        allowCustom: true },
      { name: 'crew', label: 'Your crew', type: 'textarea',
        placeholder: "e.g. Big Mike on the wheel, Tina throwing with you, and the new kid Diego who can't find his gloves" },
      { name: 'route', label: "Today's route", type: 'text',
        placeholder: 'e.g. East side residential — 300 stops, narrow alleys, bulk pickup day' },
      { name: 'truck', label: 'The truck (optional)', type: 'text',
        placeholder: 'e.g. Old rear-loader, Unit 14, packer blade sticks in the cold' },
    ],
  },
  gas: {
    title: 'Gas Station Worker',
    sub: 'Set the store and who you work with. Then deal with whoever walks in.',
    fields: [
      { name: 'role', label: 'Your role', type: 'select',
        options: ['Cashier', 'Shift Lead', 'Overnight Clerk', 'Store Manager', 'Stocker / Deli'],
        allowCustom: true },
      { name: 'coworkers', label: 'Who works with you', type: 'textarea',
        placeholder: "e.g. Manager Reggie who's always 'on break', Anika running the deli, nobody else after 11pm" },
      { name: 'layout', label: 'The station layout', type: 'textarea',
        placeholder: 'e.g. 8 pumps, walk-in beer cooler in back, lotto + cig wall behind counter, broken slushie machine, one bathroom with a key' },
      { name: 'shift', label: 'The shift (optional)', type: 'text',
        placeholder: 'e.g. Friday graveyard, 10pm–6am, bar crowd incoming' },
    ],
  },
  construction: {
    title: 'Construction Worker',
    sub: 'Pick the job, the crew, your trade, and the site.',
    fields: [
      { name: 'role', label: 'Your role / trade', type: 'select',
        options: ['General Laborer', 'Carpenter', 'Foreman', 'Equipment Operator', 'Electrician', 'Concrete / Mason', 'Ironworker'],
        allowCustom: true },
      { name: 'project', label: 'The job / project', type: 'textarea',
        placeholder: 'e.g. Pouring foundation for a 3-story apartment block, behind schedule, rain coming Thursday' },
      { name: 'crew', label: 'Your crew', type: 'textarea',
        placeholder: "e.g. Foreman Sal who screams a lot, Jefe the operator, two laborers, and an apprentice who keeps texting" },
      { name: 'location', label: 'Where you\'re working', type: 'text',
        placeholder: 'e.g. Downtown lot squeezed between two buildings, no parking, city inspectors nearby' },
    ],
  },
};

// ---- State ----
let history = [];
let isStreaming = false;
let currentJob = null;
let currentConfig = {};

// ---- Navigation ----
document.querySelectorAll('.job-card').forEach(card => {
  card.addEventListener('click', () => openSetup(card.dataset.job));
});

backBtn.addEventListener('click', () => showScreen('jobs'));
newChatBtn.addEventListener('click', quitToJobs);
startBtn.addEventListener('click', startShift);

function showScreen(name) {
  screenJobs.hidden = name !== 'jobs';
  screenSetup.hidden = name !== 'setup';
  chatArea.hidden = name !== 'chat';
  inputArea.hidden = name !== 'chat';
}

function quitToJobs() {
  history = [];
  messagesEl.innerHTML = '';
  currentJob = null;
  currentConfig = {};
  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;
  isStreaming = false;
  showScreen('jobs');
}

function openSetup(jobKey) {
  const def = JOB_FORMS[jobKey];
  if (!def) return;
  currentJob = jobKey;
  setupTitle.textContent = def.title;
  setupSub.textContent = def.sub;
  setupForm.innerHTML = '';

  def.fields.forEach(field => {
    const wrap = document.createElement('div');
    wrap.className = 'field';

    const label = document.createElement('label');
    label.textContent = field.label;
    label.htmlFor = `f-${field.name}`;
    wrap.appendChild(label);

    if (field.type === 'select') {
      const select = document.createElement('select');
      select.id = `f-${field.name}`;
      select.name = field.name;
      field.options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt; o.textContent = opt;
        select.appendChild(o);
      });
      if (field.allowCustom) {
        const o = document.createElement('option');
        o.value = '__custom__'; o.textContent = 'Something else…';
        select.appendChild(o);
      }
      wrap.appendChild(select);

      if (field.allowCustom) {
        const custom = document.createElement('input');
        custom.type = 'text';
        custom.className = 'custom-input';
        custom.placeholder = 'Type your own role…';
        custom.hidden = true;
        custom.dataset.for = field.name;
        select.addEventListener('change', () => {
          custom.hidden = select.value !== '__custom__';
          if (!custom.hidden) custom.focus();
        });
        wrap.appendChild(custom);
      }
    } else if (field.type === 'textarea') {
      const ta = document.createElement('textarea');
      ta.id = `f-${field.name}`;
      ta.name = field.name;
      ta.rows = 2;
      ta.placeholder = field.placeholder || '';
      wrap.appendChild(ta);
    } else {
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.id = `f-${field.name}`;
      inp.name = field.name;
      inp.placeholder = field.placeholder || '';
      wrap.appendChild(inp);
    }

    setupForm.appendChild(wrap);
  });

  showScreen('setup');
}

function collectConfig() {
  const cfg = {};
  setupForm.querySelectorAll('input, select, textarea').forEach(el => {
    if (el.classList.contains('custom-input')) return;
    let val = el.value.trim();
    if (el.tagName === 'SELECT' && val === '__custom__') {
      const custom = setupForm.querySelector(`.custom-input[data-for="${el.name}"]`);
      val = custom ? custom.value.trim() : '';
    }
    if (val) cfg[el.name] = val;
  });
  return cfg;
}

function startShift() {
  currentConfig = collectConfig();
  history = [];
  messagesEl.innerHTML = '';
  showScreen('chat');

  // Kick off the scene with a hidden opening action.
  const opener = '*clocks in and starts the shift*';
  history.push({ role: 'user', content: opener });
  streamReply();
}

// ---- Chat input ----
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

function sendMessage() {
  const text = input.value.trim();
  if (!text || isStreaming) return;

  history.push({ role: 'user', content: text });
  appendMessage('user', text);

  input.value = '';
  input.style.height = 'auto';
  streamReply();
}

async function streamReply() {
  isStreaming = true;
  sendBtn.disabled = true;
  sendBtn.classList.add('loading');

  const { bubble, cursor } = createAssistantBubble();
  scrollToBottom();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history, job: currentJob, config: currentConfig }),
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
  avatar.textContent = role === 'user' ? 'YOU' : '◆';

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
  avatar.textContent = '◆';

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
