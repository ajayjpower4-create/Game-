const chatArea = document.getElementById('chatArea');
const messagesEl = document.getElementById('messages');
const input = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const inputArea = document.getElementById('inputArea');
const headerActions = document.getElementById('headerActions');
const gameInfo = document.getElementById('gameInfo');
const saveBtn = document.getElementById('saveBtn');
const newGameBtn = document.getElementById('newGameBtn');
const toast = document.getElementById('toast');

const screens = {
  title: document.getElementById('screen-title'),
  name: document.getElementById('screen-name'),
  rank: document.getElementById('screen-rank'),
  pool: document.getElementById('screen-pool'),
  team: document.getElementById('screen-team'),
};

const SAVE_KEY = 'lifeguard-simulator-save';

const RANKS = [
  { name: 'Rookie Lifeguard', desc: 'First summer on the stand. Everything is new and everyone knows it.', teams: ['Splash Squad', 'The Minnows'] },
  { name: 'Lifeguard', desc: 'Certified and on rotation. You know the drill by now.', teams: ['Red Whistle Crew', 'Tower 3 Team'] },
  { name: 'Senior Lifeguard', desc: 'You run the deep end and train the rookies.', teams: ['Deep End Unit', 'The Wave Breakers'] },
  { name: 'Head Lifeguard', desc: 'The whole deck answers to you.', teams: ['Command Crew', 'The Old Guard'] },
];

const POOLS = [
  { name: 'Sunny Palms Community Pool', desc: 'Packed neighborhood pool. Screaming kids everywhere.' },
  { name: 'Big Splash Water Park', desc: 'Slides, a wave pool, and pure chaos.' },
  { name: 'Crystal Cove Beach Club', desc: 'Ritzy members-only club with very demanding families.' },
  { name: 'Ridgemont Rec Center', desc: 'Indoor pool. Echoes, chlorine, and swim lessons.' },
  { name: 'Grand Cabana Resort Pool', desc: 'Tourists, a swim-up bar, and sunburned dads.' },
  { name: 'Lakeside Public Pool', desc: 'Old city pool that has seen better days.' },
];

// On iPhone/iPad the Return key must NOT send messages — it just makes a new line.
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.userAgent.includes('Mac') && navigator.maxTouchPoints > 1);

let setup = { name: '', rank: '', pool: '', team: '' };
let history = [];
let isStreaming = false;

// ---------- Setup wizard ----------

function showScreen(key) {
  Object.values(screens).forEach(s => { s.hidden = true; });
  if (key) screens[key].hidden = false;
}

document.getElementById('btnNewGame').addEventListener('click', () => showScreen('name'));

const btnContinue = document.getElementById('btnContinue');
if (localStorage.getItem(SAVE_KEY)) btnContinue.hidden = false;
btnContinue.addEventListener('click', () => {
  const save = loadGame();
  if (save) startGame(save.setup, save.history);
});

const nameInput = document.getElementById('nameInput');
const btnNameNext = document.getElementById('btnNameNext');
nameInput.addEventListener('input', () => {
  btnNameNext.disabled = !nameInput.value.trim();
});
nameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !isIOS && nameInput.value.trim()) btnNameNext.click();
});
btnNameNext.addEventListener('click', () => {
  setup.name = nameInput.value.trim();
  buildCards('rankGrid', RANKS, (rank) => {
    setup.rank = rank.name;
    showScreen('pool');
  });
  showScreen('rank');
});

buildCards('poolGrid', POOLS, (pool) => {
  setup.pool = pool.name;
  const rank = RANKS.find(r => r.name === setup.rank);
  const teams = rank.teams.map(t => ({ name: t, desc: `One of the two ${rank.name} crews.` }));
  buildCards('teamGrid', teams, (team) => {
    setup.team = team.name;
    startGame(setup, []);
  });
  showScreen('team');
});

function buildCards(gridId, items, onPick) {
  const grid = document.getElementById(gridId);
  grid.innerHTML = '';
  items.forEach(item => {
    const btn = document.createElement('button');
    btn.className = 'choice-card';
    btn.innerHTML = `<span class="choice-name">${escapeHtml(item.name)}</span><span class="choice-desc">${escapeHtml(item.desc)}</span>`;
    btn.addEventListener('click', () => onPick(item));
    grid.appendChild(btn);
  });
}

// ---------- Game ----------

function startGame(gameSetup, gameHistory) {
  setup = gameSetup;
  history = gameHistory;
  showScreen(null);
  messagesEl.hidden = false;
  inputArea.hidden = false;
  headerActions.hidden = false;
  gameInfo.textContent = `${setup.name} · ${setup.rank} · ${setup.pool} · ${setup.team}`;

  messagesEl.innerHTML = '';
  appendSystemNote(`You're the ${setup.rank} on duty at ${setup.pool} with the ${setup.team}. Say or do something — everybody at the pool will react. You can hit Save any time; the game also saves itself when you leave.`);
  for (const m of history) appendMessage(m.role, m.content);

  saveGame();
  input.focus();
  scrollToBottom();
}

function resetGame() {
  localStorage.removeItem(SAVE_KEY);
  setup = { name: '', rank: '', pool: '', team: '' };
  history = [];
  isStreaming = false;
  messagesEl.innerHTML = '';
  messagesEl.hidden = true;
  inputArea.hidden = true;
  headerActions.hidden = true;
  nameInput.value = '';
  btnNameNext.disabled = true;
  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;
  btnContinue.hidden = true;
  showScreen('title');
}

newGameBtn.addEventListener('click', () => {
  if (history.length && !confirm('Start a new game? Your current save will be erased.')) return;
  resetGame();
});

// ---------- Saving ----------

function saveGame() {
  if (!setup.name) return;
  localStorage.setItem(SAVE_KEY, JSON.stringify({ setup, history, savedAt: Date.now() }));
}

function loadGame() {
  try {
    const save = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (save && save.setup && save.setup.name && Array.isArray(save.history)) return save;
  } catch {}
  return null;
}

saveBtn.addEventListener('click', () => {
  saveGame();
  showToast('Game saved');
});

// Auto-save when the player leaves or switches away
window.addEventListener('pagehide', saveGame);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveGame();
});

let toastTimer;
function showToast(text) {
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2000);
}

// ---------- Chat ----------

input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 200) + 'px';
  sendBtn.disabled = !input.value.trim() || isStreaming;
});

// Enter sends on desktop only. On iPhone/iPad, Return just adds a new line
// and never sends — use the send button instead.
input.addEventListener('keydown', (e) => {
  if (isIOS) return;
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) sendMessage();
  }
});

sendBtn.addEventListener('click', sendMessage);

async function sendMessage() {
  const text = input.value.trim();
  if (!text || isStreaming) return;

  isStreaming = true;
  sendBtn.disabled = true;
  sendBtn.classList.add('loading');

  history.push({ role: 'user', content: text });
  appendMessage('user', text);

  input.value = '';
  input.style.height = 'auto';

  const { bubble, cursor } = createAssistantBubble();
  scrollToBottom();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history, setup }),
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
            bubble.innerHTML = renderDialogue(assistantText);
            bubble.appendChild(cursor);
            scrollToBottom();
          }
        } catch {}
      }
    }

    cursor.remove();
    if (assistantText) {
      history.push({ role: 'assistant', content: assistantText });
      bubble.innerHTML = renderDialogue(assistantText);
      saveGame();
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

function appendSystemNote(text) {
  const div = document.createElement('div');
  div.className = 'system-note';
  div.textContent = text;
  messagesEl.appendChild(div);
}

function appendMessage(role, content) {
  const div = document.createElement('div');
  div.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'user' ? (setup.name[0] || 'U').toUpperCase() : '🛟';

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = role === 'user' ? escapeHtml(content) : renderDialogue(content);

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
  avatar.textContent = '🛟';

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

// Renders character dialogue: bolds "NAME:" speaker labels and italicizes *actions*.
function renderDialogue(text) {
  let html = escapeHtml(text);
  html = html.replace(/\*([^*\n]+)\*/g, '<em class="action">$1</em>');
  html = html.replace(/^([A-Z][A-Z0-9 .&#039;\-]{0,30}):/gm, '<strong class="speaker">$1:</strong>');
  return html.replace(/\n/g, '<br>');
}
