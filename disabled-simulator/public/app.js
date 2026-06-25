const CONDITIONS = [
  'ADHD (Attention-Deficit/Hyperactivity Disorder)',
  'Autism Spectrum Disorder',
  'Generalized Anxiety Disorder',
  'Major Depressive Disorder',
  'Obsessive-Compulsive Disorder',
  'Bipolar Disorder',
  'Post-Traumatic Stress Disorder',
  'Schizophrenia',
  'Social Anxiety Disorder',
  'Panic Disorder',
  'Oppositional Defiant Disorder',
  'Borderline Personality Disorder',
  'Tourette Syndrome',
  'Dyslexia',
  'Intellectual Disability (mild)',
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const SAVE_KEY = 'disabledSimSave';

let state = null; // { mode, character, parents, dayIndex, timeOfDay, messages }
let isStreaming = false;
let msgsSinceAutosave = 0;

const screens = {
  title: document.getElementById('screen-title'),
  mode: document.getElementById('screen-mode'),
  character: document.getElementById('screen-character'),
  parents: document.getElementById('screen-parents'),
  game: document.getElementById('screen-game'),
};

function showScreen(name) {
  Object.values(screens).forEach(s => s.hidden = true);
  screens[name].hidden = false;
}

function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.hidden = true; }, 1800);
}

// ---------- Title screen ----------
if (localStorage.getItem(SAVE_KEY)) {
  document.getElementById('btnContinue').style.display = 'inline-block';
}
document.getElementById('btnNewGame').addEventListener('click', () => {
  state = { mode: null, character: {}, parents: [], dayIndex: 0, timeOfDay: 'morning', messages: [] };
  showScreen('mode');
});
document.getElementById('btnContinue').addEventListener('click', () => {
  const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
  state = saved;
  enterGame(false);
});

// ---------- Mode select ----------
document.querySelectorAll('#screen-mode .card').forEach(card => {
  card.addEventListener('click', () => {
    state.mode = card.dataset.mode;
    showScreen('character');
  });
});

// ---------- Character creation ----------
const conditionSelect = document.getElementById('charCondition');
CONDITIONS.forEach(c => {
  const opt = document.createElement('option');
  opt.value = c;
  opt.textContent = c;
  conditionSelect.appendChild(opt);
});

document.getElementById('formCharacter').addEventListener('submit', (e) => {
  e.preventDefault();
  state.character = {
    name: document.getElementById('charName').value.trim(),
    age: document.getElementById('charAge').value,
    grade: document.getElementById('charGrade').value,
    condition: document.getElementById('charCondition').value,
    severity: document.getElementById('charSeverity').value,
    notes: document.getElementById('charNotes').value.trim(),
  };
  showScreen('parents');
});

// ---------- Parent setup ----------
document.getElementById('addParent2').addEventListener('change', (e) => {
  document.getElementById('parent2Fields').hidden = !e.target.checked;
});

document.getElementById('formParents').addEventListener('submit', (e) => {
  e.preventDefault();
  const parents = [{
    name: document.getElementById('p1Name').value.trim(),
    age: document.getElementById('p1Age').value,
    occupation: document.getElementById('p1Occupation').value.trim(),
    trait: document.getElementById('p1Trait').value.trim(),
  }];
  if (document.getElementById('addParent2').checked) {
    parents.push({
      name: document.getElementById('p2Name').value.trim(),
      age: document.getElementById('p2Age').value,
      occupation: document.getElementById('p2Occupation').value.trim(),
      trait: document.getElementById('p2Trait').value.trim(),
    });
  }
  state.parents = parents;
  enterGame(true);
});

// ---------- Game ----------
function enterGame(fresh) {
  showScreen('game');
  document.getElementById('controlPanel').hidden = state.mode !== 'control';
  document.getElementById('dayBadge').textContent = `${DAYS[state.dayIndex]} — ${state.timeOfDay}`;
  document.getElementById('messages').innerHTML = '';
  state.messages.forEach(m => appendMessage(m.role, m.content));
  if (fresh) saveGame(false);
}

['stressSlider', 'anxietySlider', 'angerSlider'].forEach(id => {
  document.getElementById(id).addEventListener('input', (e) => {
    document.getElementById(id.replace('Slider', 'Val')).textContent = e.target.value;
  });
});

document.getElementById('btnQuit').addEventListener('click', () => {
  showScreen('title');
});

document.getElementById('btnSave').addEventListener('click', () => saveGame(true));

function saveGame(notify) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  if (notify) toast('Game saved.');
  document.getElementById('btnContinue').style.display = 'inline-block';
}

const input = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');

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

function buildControlTag() {
  if (state.mode !== 'control') return '';
  const stress = document.getElementById('stressSlider').value;
  const anxiety = document.getElementById('anxietySlider').value;
  const anger = document.getElementById('angerSlider').value;
  const inject = document.getElementById('injectInput').value.trim();
  const voice = document.getElementById('voiceInput').value.trim();
  let tag = `[CONTROL: stress=${stress} anxiety=${anxiety} anger=${anger}]`;
  if (inject) tag += ` [INJECT: ${inject}]`;
  if (voice) tag += ` [VOICE: ${voice}]`;
  document.getElementById('injectInput').value = '';
  document.getElementById('voiceInput').value = '';
  return tag;
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text || isStreaming) return;

  // /sleep and /wakeup advance the loose time-of-day tracker; /save is local-only
  if (text === '/save') {
    saveGame(true);
    input.value = '';
    sendBtn.disabled = true;
    return;
  }

  const controlTag = buildControlTag();
  const outgoing = controlTag ? `${text}\n${controlTag}` : text;

  isStreaming = true;
  sendBtn.disabled = true;
  document.getElementById('gameHint').style.display = 'none';

  state.messages.push({ role: 'user', content: outgoing });
  appendMessage('user', text); // show clean text to the player, not the control tag

  input.value = '';
  input.style.height = 'auto';

  const { row, bubble, cursor } = createAssistantBubble();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: state.messages, gameState: gameStateForServer() }),
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
      state.messages.push({ role: 'assistant', content: assistantText });
      row.remove();
      renderAssistantBlocks(assistantText);
      handleTimeAdvance(text);
      msgsSinceAutosave += 1;
      if (msgsSinceAutosave >= 3) {
        saveGame(false);
        msgsSinceAutosave = 0;
      }
    }
  } catch (err) {
    cursor.remove();
    bubble.innerHTML = `<div class="error-msg">Connection error: ${escapeHtml(err.message)}</div>`;
  }

  isStreaming = false;
  sendBtn.disabled = !input.value.trim();
  scrollToBottom();
}

function handleTimeAdvance(userText) {
  const lower = userText.toLowerCase().trim();
  if (lower.startsWith('/sleep')) {
    state.dayIndex = (state.dayIndex + 1) % DAYS.length;
    state.timeOfDay = 'morning';
  } else if (lower.startsWith('/wakeup')) {
    state.timeOfDay = 'school day';
  }
  document.getElementById('dayBadge').textContent = `${DAYS[state.dayIndex]} — ${state.timeOfDay}`;
}

function gameStateForServer() {
  return {
    mode: state.mode,
    character: state.character,
    parents: state.parents,
    day: `${DAYS[state.dayIndex]}, ${state.timeOfDay}`,
  };
}

function appendMessage(role, content) {
  if (role === 'assistant') {
    renderAssistantBlocks(content);
    return;
  }
  const div = document.createElement('div');
  div.className = `message ${role}`;
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = 'U';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = escapeHtml(content);
  div.appendChild(avatar);
  div.appendChild(bubble);
  document.getElementById('messages').appendChild(div);
  scrollToBottom();
  return bubble;
}

// Parses "Name: dialogue" lines (blank-line separated per speaker) into labeled blocks
function parseSpeakerBlocks(text) {
  const speakerRe = /^([A-Z][A-Za-z.'\- ]{1,28}):\s?(.*)$/;
  const blocks = [];
  let current = null;
  for (const line of text.split('\n')) {
    const m = line.match(speakerRe);
    if (m) {
      if (current) blocks.push(current);
      current = { speaker: m[1].trim(), text: m[2] };
    } else if (current) {
      current.text += (line.trim() ? (current.text ? '\n' : '') + line : '');
    } else {
      current = { speaker: null, text: line };
    }
  }
  if (current) blocks.push(current);
  return blocks.filter(b => b.text.trim() || b.speaker);
}

function renderAssistantBlocks(content) {
  const blocks = parseSpeakerBlocks(content);
  const messagesEl = document.getElementById('messages');
  blocks.forEach(b => {
    const div = document.createElement('div');
    div.className = 'message assistant';
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = b.speaker ? b.speaker.charAt(0).toUpperCase() : '◈';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    if (b.speaker) {
      const label = document.createElement('div');
      label.className = 'speaker-name';
      label.textContent = b.speaker;
      bubble.appendChild(label);
    }
    const textSpan = document.createElement('div');
    textSpan.innerHTML = renderText(b.text.trim());
    bubble.appendChild(textSpan);
    div.appendChild(avatar);
    div.appendChild(bubble);
    messagesEl.appendChild(div);
  });
  scrollToBottom();
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
  cursor.textContent = '▍';
  bubble.appendChild(cursor);
  div.appendChild(avatar);
  div.appendChild(bubble);
  document.getElementById('messages').appendChild(div);
  scrollToBottom();
  return { row: div, bubble, cursor };
}

function scrollToBottom() {
  const area = document.getElementById('chatArea');
  area.scrollTop = area.scrollHeight;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderText(text) {
  let html = escapeHtml(text);
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/\n/g, '<br>');
  return html;
}
