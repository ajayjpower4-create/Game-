'use strict';

// ===================================================================
//  DATA
// ===================================================================
const DRAMAS = [
  { id: 'breakup', emoji: '💔', title: 'The Breakup', desc: 'The school’s power couple just imploded. Everyone’s picking sides.' },
  { id: 'rumor', emoji: '🗣️', title: 'Who Posted That?', desc: 'A screenshot is spreading. Nobody knows who leaked it. Yet.' },
  { id: 'party', emoji: '🎉', title: 'Party Gone Wrong', desc: 'Something happened Saturday night. The whole school is talking.' },
  { id: 'newkid', emoji: '🆕', title: 'New Kid in Town', desc: 'You just transferred in. Everyone’s already got an opinion.' },
  { id: 'cheating', emoji: '😬', title: 'The Cheating Scandal', desc: 'Someone cheated — on a test, or on someone. Maybe both.' },
  { id: 'civilwar', emoji: '⚔️', title: 'Friend Group Civil War', desc: 'Your group is splitting down the middle and you’re in the crossfire.' },
];

const DRAMA_TEXT = {
  breakup: 'The school’s biggest couple just broke up publicly and messily, and the entire school is choosing sides. Allegiances, gossip, and pettiness everywhere.',
  rumor: 'A private screenshot is being passed around the whole school and nobody knows who originally leaked it. Everyone’s paranoid, accusing each other, and the rumor mutates by the hour.',
  party: 'Something went down at a party last weekend that everyone witnessed or heard about. Half the stories don’t match. Reputations are on the line.',
  newkid: 'The player just transferred in. People are sizing them up, cliques are recruiting, and a couple of people have already decided they don’t like the new kid.',
  cheating: 'A cheating scandal is rocking the school — academic, romantic, or both — and the betrayal has the friend groups at each other’s throats.',
  civilwar: 'The player’s own friend group is fracturing into two camps over an old grudge that just blew up, and everyone wants the player to pick a side.',
};

// App definitions. type: 'chats' (messaging) or 'generic' (utility screen).
const APPS = [
  { id: 'messages', name: 'Messages', emoji: '💬', color: '#34c759', type: 'chats' },
  { id: 'sanplat', name: 'Sanplat', emoji: '👻', color: '#fff100', type: 'chats', dark: true },
  { id: 'instalam', name: 'Instalam', emoji: '📸', color: 'linear-gradient(135deg,#f58529,#dd2a7b,#8134af)', type: 'chats', dmOnly: true },
  { id: 'tiklok', name: 'Tiklok', emoji: '🎵', color: '#000', type: 'chats', dmOnly: true },
  { id: 'phone', name: 'Phone', emoji: '📞', color: '#34c759', type: 'generic' },
  { id: 'camera', name: 'Camera', emoji: '📷', color: '#3a3a3c', type: 'generic' },
  { id: 'notes', name: 'Notes', emoji: '📝', color: '#ffd60a', type: 'generic' },
  { id: 'clock', name: 'Clock', emoji: '🕐', color: '#1c1c1e', type: 'generic' },
  { id: 'music', name: 'Music', emoji: '🎶', color: 'linear-gradient(135deg,#fb5c74,#fa233b)', type: 'generic' },
  { id: 'settings', name: 'Settings', emoji: '⚙️', color: '#8e8e93', type: 'generic' },
];

const SAVE_KEY = 'hsds_saves_v1';

// ===================================================================
//  STATE
// ===================================================================
let game = null;        // active game state
let isStreaming = false;
let menu = { grade: '11th', transport: 'walk', drama: 'breakup', friends: [] };
let currentApp = null;  // app id currently open in phone
let currentChat = null; // chat name currently open

const $ = (id) => document.getElementById(id);

// ===================================================================
//  MENU SETUP
// ===================================================================
function initMenu() {
  // drama cards
  const grid = $('dramaGrid');
  grid.innerHTML = '';
  DRAMAS.forEach((d) => {
    const card = document.createElement('button');
    card.className = 'drama-card' + (d.id === menu.drama ? ' active' : '');
    card.dataset.drama = d.id;
    card.innerHTML = `<div class="dc-emoji">${d.emoji}</div><div class="dc-title">${d.title}</div><div class="dc-desc">${d.desc}</div>`;
    card.addEventListener('click', () => {
      menu.drama = d.id;
      grid.querySelectorAll('.drama-card').forEach((c) => c.classList.toggle('active', c.dataset.drama === d.id));
    });
    grid.appendChild(card);
  });

  // grade & transport chips
  bindChips('gradeRow', 'grade');
  bindChips('transportRow', 'transport');

  // friends
  $('addFriendBtn').addEventListener('click', addFriendFromInputs);
  $('friendName').addEventListener('keydown', (e) => { if (e.key === 'Enter') addFriendFromInputs(); });
  $('friendNote').addEventListener('keydown', (e) => { if (e.key === 'Enter') addFriendFromInputs(); });

  $('startBtn').addEventListener('click', startNewGame);
  $('loadBtn').addEventListener('click', () => openSaveModal('load'));
}

function bindChips(rowId, key) {
  const row = $(rowId);
  row.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      menu[key] = chip.dataset[key];
      row.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === chip));
    });
  });
}

function addFriendFromInputs() {
  const name = $('friendName').value.trim();
  if (!name) return;
  const note = $('friendNote').value.trim();
  menu.friends.push({ name, note });
  $('friendName').value = '';
  $('friendNote').value = '';
  renderFriendPills();
}

function renderFriendPills() {
  const list = $('friendList');
  list.innerHTML = '';
  menu.friends.forEach((f, i) => {
    const pill = document.createElement('div');
    pill.className = 'friend-pill';
    pill.innerHTML = `<span>${esc(f.name)}</span>${f.note ? `<span class="fp-note">${esc(f.note)}</span>` : ''}<button>✕</button>`;
    pill.querySelector('button').addEventListener('click', () => { menu.friends.splice(i, 1); renderFriendPills(); });
    list.appendChild(pill);
  });
}

// ===================================================================
//  GAME START / RESTORE
// ===================================================================
function startNewGame() {
  const player = $('playerName').value.trim() || 'You';
  const custom = $('customDrama').value.trim();
  game = {
    player,
    grade: menu.grade,
    dramaId: custom ? 'custom' : menu.drama,
    drama: custom || DRAMA_TEXT[menu.drama] || 'general high school drama',
    friends: menu.friends.slice(),
    transport: menu.transport,
    day: 1,
    time: 'morning',
    location: 'home',
    history: [],     // {role, content, surface}
    chats: [],       // {app, name}
    notes: '',
    savedAt: null,
  };
  initDefaultChats();
  enterGame();
  renderAll();
  kickoffDay(true);
}

function initDefaultChats() {
  // The player already has chats reflecting the drama going on.
  game.chats = [
    { app: 'messages', name: 'Mom 💜' },
    { app: 'messages', name: 'Dad' },
  ];
  const groupName = game.friends.length ? 'the group chat 💀' : 'the squad';
  game.chats.push({ app: 'sanplat', name: groupName });
  game.chats.push({ app: 'sanplat', name: 'who DID that 👀' });
  // a couple of DM-able people on Instalam/Tiklok if friends exist
  game.friends.slice(0, 2).forEach((f) => {
    game.chats.push({ app: 'instalam', name: f.name });
  });
}

function enterGame() {
  $('menuScreen').classList.add('hidden');
  $('gameScreen').classList.remove('hidden');
  updateHeader();
  buildAppGrid();
}

function updateHeader() {
  $('hdrDay').textContent = `Day ${game.day}`;
  $('hdrTime').textContent = `${game.time} · ${game.location}`;
  $('phoneGreeting').textContent = `Day ${game.day}`;
}

// ===================================================================
//  RENDERING THE TRANSCRIPT
// ===================================================================
function renderAll() {
  $('messages').innerHTML = '';
  game.history.forEach((m) => {
    if (m.surface === 'world') {
      appendWorldBubble(m.role, m.content, m.role === 'assistant');
    }
  });
  scrollWorld();
}

function appendWorldBubble(role, content, format) {
  const wrap = document.createElement('div');
  wrap.className = `message ${role}`;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = role === 'assistant' || format ? renderRoleplay(content) : esc(content);
  wrap.appendChild(bubble);
  $('messages').appendChild(wrap);
  return bubble;
}

function appendSystemNote(text) {
  const wrap = document.createElement('div');
  wrap.className = 'message system';
  wrap.innerHTML = `<div class="bubble">${esc(text)}</div>`;
  $('messages').appendChild(wrap);
  scrollWorld();
}

function scrollWorld() {
  const area = $('chatArea');
  area.scrollTop = area.scrollHeight;
}

// ===================================================================
//  SENDING MESSAGES (shared streaming core)
// ===================================================================
function buildApiMessages() {
  const recent = game.history.slice(-60);
  return recent.map((m) => {
    if (m.role === 'user' && m.surface !== 'world') {
      const [appId, chat] = m.surface.split('::');
      const appName = (APPS.find((a) => a.id === appId) || {}).name || appId;
      return { role: 'user', content: `(texting on ${appName}, in chat "${chat}") ${m.content}` };
    }
    return { role: m.role, content: m.content };
  });
}

function currentStateForApi(phone) {
  return {
    drama: game.drama,
    player: game.player,
    grade: game.grade,
    friends: game.friends,
    transport: game.transport,
    day: game.day,
    time: game.time,
    location: game.location,
    phone: phone || null,
  };
}

// Streams a response from the server, calling onDelta(textSoFar) as it grows.
async function streamResponse(phone, onDelta) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: buildApiMessages(), state: currentStateForApi(phone) }),
  });
  if (!res.ok) throw new Error(`Server error: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
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
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data);
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.text) { full += parsed.text; onDelta(full); }
      } catch (e) {
        if (e.message && !e.message.includes('JSON')) throw e;
      }
    }
  }
  return full;
}

// ---- World send ----
async function sendWorld(text) {
  if (isStreaming) return;
  // commands first
  if (text.startsWith('/')) {
    if (handleCommand(text)) return;
  }

  game.history.push({ role: 'user', content: text, surface: 'world' });
  appendWorldBubble('user', text, false);
  scrollWorld();

  isStreaming = true;
  setSending(true);

  const bubble = appendWorldBubble('assistant', '', true);
  const cursor = document.createElement('span');
  cursor.className = 'typing-cursor';
  bubble.appendChild(cursor);
  scrollWorld();

  try {
    const full = await streamResponse(null, (sofar) => {
      bubble.innerHTML = renderRoleplay(sofar);
      scrollWorld();
    });
    bubble.innerHTML = renderRoleplay(full);
    game.history.push({ role: 'assistant', content: full, surface: 'world' });
    autosave();
  } catch (err) {
    bubble.innerHTML = `<div class="error-msg">${esc(err.message)}</div>`;
  }
  isStreaming = false;
  setSending(false);
  scrollWorld();
}

function setSending(on) {
  $('sendBtn').classList.toggle('loading', on);
  $('sendBtn').disabled = on || !$('messageInput').value.trim();
}

// ===================================================================
//  COMMANDS
// ===================================================================
function handleCommand(raw) {
  const cmd = raw.trim().toLowerCase();
  if (cmd === '/phone') { openPhone(); clearInput(); return true; }
  if (cmd === '/save') { openSaveModal('save'); clearInput(); return true; }
  if (cmd === '/menu') { backToMenu(); clearInput(); return true; }
  if (cmd === '/sleep') {
    game.time = 'night';
    updateHeader();
    appendSystemNote(`😴 You crawl into bed. Day ${game.day} is over. Type /next day when you’re ready.`);
    clearInput();
    autosave();
    return true;
  }
  if (cmd === '/next day' || cmd === '/nextday') {
    game.day += 1;
    game.time = 'morning';
    game.location = 'home';
    updateHeader();
    appendSystemNote(`🌅 Day ${game.day}. Your alarm is about to be the least of your problems.`);
    clearInput();
    kickoffDay(false);
    return true;
  }
  return false; // not a command we handle — send as normal text
}

// Parents wake the player. firstDay=true on a fresh start.
function kickoffDay(firstDay) {
  const opener = firstDay
    ? `*it’s the morning of day 1 and I’m still asleep in bed*`
    : `*morning of day ${game.day}, I’m asleep in bed*`;
  // send as a world action without echoing a player command bubble feel:
  game.history.push({ role: 'user', content: opener, surface: 'world' });
  appendWorldBubble('user', opener, false);
  streamWorldKickoff();
}

async function streamWorldKickoff() {
  isStreaming = true;
  setSending(true);
  const bubble = appendWorldBubble('assistant', '', true);
  const cursor = document.createElement('span');
  cursor.className = 'typing-cursor';
  bubble.appendChild(cursor);
  scrollWorld();
  try {
    const full = await streamResponse(null, (s) => { bubble.innerHTML = renderRoleplay(s); scrollWorld(); });
    bubble.innerHTML = renderRoleplay(full);
    game.history.push({ role: 'assistant', content: full, surface: 'world' });
    autosave();
  } catch (err) {
    bubble.innerHTML = `<div class="error-msg">${esc(err.message)}</div>`;
  }
  isStreaming = false;
  setSending(false);
  scrollWorld();
}

function clearInput() {
  const input = $('messageInput');
  input.value = '';
  input.style.height = 'auto';
  $('sendBtn').disabled = true;
}

// ===================================================================
//  PHONE
// ===================================================================
function openPhone() {
  $('phoneClock').textContent = game.time === 'night' ? '11:47' : '8:02';
  showPhoneView('home');
  $('phoneOverlay').classList.remove('hidden');
}
function closePhone() { $('phoneOverlay').classList.add('hidden'); }

function showPhoneView(view) {
  ['phoneHome', 'phoneAppList', 'phoneThread', 'phoneGeneric'].forEach((id) => $(id).classList.add('hidden'));
  const map = { home: 'phoneHome', applist: 'phoneAppList', thread: 'phoneThread', generic: 'phoneGeneric' };
  $(map[view]).classList.remove('hidden');
}

function buildAppGrid() {
  const grid = $('appGrid');
  grid.innerHTML = '';
  APPS.forEach((app) => {
    const icon = document.createElement('div');
    icon.className = 'app-icon';
    const count = app.type === 'chats' ? game.chats.filter((c) => c.app === app.id).length : 0;
    const badge = count ? `<span class="ai-badge">${count}</span>` : '';
    icon.innerHTML = `<div class="ai-tile" style="background:${app.color};${app.dark ? 'color:#000;' : ''}">${app.emoji}${badge}</div><div class="ai-label">${app.name}</div>`;
    icon.addEventListener('click', () => openApp(app.id));
    grid.appendChild(icon);
  });
}

function openApp(appId) {
  const app = APPS.find((a) => a.id === appId);
  currentApp = appId;
  if (app.type === 'chats') {
    $('appListTitle').textContent = app.name;
    renderChatList(app);
    showPhoneView('applist');
  } else {
    openGenericApp(app);
  }
}

function renderChatList(app) {
  const list = $('chatList');
  list.innerHTML = '';
  const chats = game.chats.filter((c) => c.app === app.id);

  if (app.dmOnly) {
    const note = document.createElement('div');
    note.style.cssText = 'padding:12px 16px;color:#888;font-size:12px;border-bottom:1px solid #1a1a1e;';
    note.textContent = `You can’t post on ${app.name} from here — but you can slide into DMs. Tap ＋ to start one.`;
    list.appendChild(note);
  }

  if (!chats.length) {
    const empty = document.createElement('div');
    empty.className = 'slot-empty';
    empty.textContent = 'No chats yet. Tap ＋ to start one.';
    list.appendChild(empty);
  }

  chats.forEach((c) => {
    const last = lastMsgFor(`${app.id}::${c.name}`);
    const row = document.createElement('div');
    row.className = 'chat-row';
    row.innerHTML = `<div class="chat-avatar">${initials(c.name)}</div><div class="chat-meta"><div class="chat-name">${esc(c.name)}</div><div class="chat-preview">${last ? esc(stripFmt(last)) : 'tap to open'}</div></div>`;
    row.addEventListener('click', () => openChat(app.id, c.name));
    list.appendChild(row);
  });
}

function lastMsgFor(surface) {
  for (let i = game.history.length - 1; i >= 0; i--) {
    if (game.history[i].surface === surface) return game.history[i].content;
  }
  return null;
}

function openChat(appId, name) {
  currentApp = appId;
  currentChat = name;
  $('threadTitle').textContent = name;
  renderThread();
  showPhoneView('thread');
  $('phoneInput').focus();
}

function renderThread() {
  const box = $('threadMsgs');
  box.innerHTML = '';
  const surface = `${currentApp}::${currentChat}`;
  game.history.forEach((m) => {
    if (m.surface !== surface) return;
    const div = document.createElement('div');
    div.className = `tmsg ${m.role === 'user' ? 'me' : 'them'}`;
    div.innerHTML = m.role === 'user' ? esc(m.content) : renderRoleplay(m.content);
    box.appendChild(div);
  });
  box.scrollTop = box.scrollHeight;
}

async function sendPhone(text) {
  if (isStreaming || !text.trim()) return;
  const surface = `${currentApp}::${currentChat}`;
  const app = APPS.find((a) => a.id === currentApp);

  game.history.push({ role: 'user', content: text, surface });
  const box = $('threadMsgs');
  const me = document.createElement('div');
  me.className = 'tmsg me';
  me.textContent = text;
  box.appendChild(me);
  box.scrollTop = box.scrollHeight;

  $('phoneInput').value = '';
  isStreaming = true;
  $('phoneSendBtn').disabled = true;

  const them = document.createElement('div');
  them.className = 'tmsg them';
  them.innerHTML = '<span class="typing-cursor"></span>';
  box.appendChild(them);
  box.scrollTop = box.scrollHeight;

  try {
    const phoneCtx = { app: app.name, chat: currentChat };
    const full = await streamResponse(phoneCtx, (s) => { them.innerHTML = renderRoleplay(s); box.scrollTop = box.scrollHeight; });
    them.innerHTML = renderRoleplay(full);
    game.history.push({ role: 'assistant', content: full, surface });
    autosave();
  } catch (err) {
    them.innerHTML = `<div class="error-msg">${esc(err.message)}</div>`;
  }
  isStreaming = false;
  $('phoneSendBtn').disabled = false;
  box.scrollTop = box.scrollHeight;
}

function newChatPrompt() {
  const app = APPS.find((a) => a.id === currentApp);
  const who = prompt(app.dmOnly ? `DM who on ${app.name}? (type a name)` : `New chat name (a person or a group chat):`);
  if (!who || !who.trim()) return;
  const name = who.trim();
  if (!game.chats.some((c) => c.app === currentApp && c.name === name)) {
    game.chats.push({ app: currentApp, name });
  }
  buildAppGrid();
  openChat(currentApp, name);
  autosave();
}

// ---- generic utility apps ----
function openGenericApp(app) {
  currentApp = app.id;
  $('genericTitle').textContent = app.name;
  const body = $('genericBody');
  body.innerHTML = '';

  if (app.id === 'notes') {
    const ta = document.createElement('textarea');
    ta.placeholder = 'your notes, hit lists, secrets…';
    ta.value = game.notes || '';
    ta.addEventListener('input', () => { game.notes = ta.value; });
    ta.addEventListener('blur', autosave);
    body.appendChild(ta);
  } else if (app.id === 'clock') {
    const t = game.time === 'night' ? '11:47 PM' : '8:02 AM';
    body.innerHTML = `<div class="gb-clock">${t}</div><div class="gb-text">Day ${game.day} · ${game.time}</div>`;
  } else if (app.id === 'camera') {
    body.innerHTML = `<div class="gb-big">📷</div><div class="gb-text">Point it at the drama.<br>Take a screenshot of someone’s story if you want — just describe it out loud in the world.</div>`;
  } else if (app.id === 'phone') {
    body.innerHTML = `<div class="gb-big">📞</div><div class="gb-text">Want to actually call someone? Say so out loud in the world (e.g. “*calls Jacob*”) and they’ll pick up.</div>`;
  } else if (app.id === 'music') {
    body.innerHTML = `<div class="gb-big">🎶</div><div class="gb-text">Now playing: whatever fits your mood.<br>Drown them all out.</div>`;
  } else if (app.id === 'settings') {
    body.innerHTML = `<div class="gb-big">⚙️</div><div class="gb-text">Player: ${esc(game.player)}<br>Grade: ${esc(game.grade)}<br>Gets to school by: ${esc(game.transport)}<br>Day ${game.day}</div>`;
  }
  showPhoneView('generic');
}

// ===================================================================
//  SAVE / LOAD
// ===================================================================
function getSaves() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; }
  catch { return {}; }
}
function putSaves(obj) { localStorage.setItem(SAVE_KEY, JSON.stringify(obj)); }

function autosave() {
  if (!game) return;
  const saves = getSaves();
  game.savedAt = Date.now();
  saves['__auto__'] = JSON.parse(JSON.stringify(game));
  putSaves(saves);
}

function saveToSlot(name) {
  const saves = getSaves();
  game.savedAt = Date.now();
  saves[name] = JSON.parse(JSON.stringify(game));
  putSaves(saves);
  toast('Saved ✓');
}

function openSaveModal(mode) {
  const saves = getSaves();
  $('modalTitle').textContent = mode === 'save' ? 'Save your game' : 'Load a saved game';
  const list = $('slotList');
  list.innerHTML = '';

  if (mode === 'save') {
    const row = document.createElement('div');
    row.className = 'slot';
    row.innerHTML = `<div class="slot-info"><div class="slot-title">＋ New save slot</div></div><button class="slot-btn load">save</button>`;
    row.querySelector('button').addEventListener('click', () => {
      const name = prompt('Name this save:', `${DRAMAS.find((d) => d.id === game.dramaId)?.title || 'Save'} — Day ${game.day}`);
      if (name && name.trim()) { saveToSlot(name.trim()); closeModal(); }
    });
    list.appendChild(row);
  }

  const keys = Object.keys(saves);
  if (!keys.length && mode === 'load') {
    list.innerHTML = '<div class="slot-empty">No saved games yet.</div>';
  }

  keys.forEach((key) => {
    const s = saves[key];
    const label = key === '__auto__' ? 'Autosave' : key;
    const sub = `${DRAMAS.find((d) => d.id === s.dramaId)?.title || 'Drama'} · Day ${s.day} · ${timeAgo(s.savedAt)}`;
    const row = document.createElement('div');
    row.className = 'slot';
    row.innerHTML = `<div class="slot-info"><div class="slot-title">${esc(label)}</div><div class="slot-sub">${esc(sub)}</div></div><div class="slot-actions"><button class="slot-btn load">load</button><button class="slot-btn del">🗑</button></div>`;
    row.querySelector('.load').addEventListener('click', () => { loadGame(s); closeModal(); });
    row.querySelector('.del').addEventListener('click', () => {
      const all = getSaves(); delete all[key]; putSaves(all); openSaveModal(mode);
    });
    list.appendChild(row);
  });

  $('modalOverlay').classList.remove('hidden');
}
function closeModal() { $('modalOverlay').classList.add('hidden'); }

function loadGame(saved) {
  game = JSON.parse(JSON.stringify(saved));
  // backfill any missing fields from older saves
  game.chats = game.chats || [];
  game.history = game.history || [];
  game.notes = game.notes || '';
  enterGame();
  renderAll();
  closePhone();
  toast('Loaded ✓');
}

function backToMenu() {
  closePhone();
  closeModal();
  $('gameScreen').classList.add('hidden');
  $('menuScreen').classList.remove('hidden');
  // refresh menu friend pills (kept from last time)
  renderFriendPills();
}

// ===================================================================
//  FORMATTING HELPERS
// ===================================================================
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// Render character lines: "Name: dialogue" → bold name; *action* → italic.
function renderRoleplay(text) {
  let html = esc(text);
  html = html.replace(/\*([^*]+)\*/g, '<span class="action">$1</span>');
  // name labels at start of a line
  html = html.replace(/^([A-Z][\w .'\-]{0,30}):/gm, '<span class="char-name">$1:</span>');
  return html;
}

function stripFmt(text) {
  return String(text).replace(/\*/g, '').replace(/\n+/g, ' ').trim();
}

function initials(name) {
  const clean = name.replace(/[^\w\s]/g, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (!parts.length) return '#';
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

function timeAgo(ts) {
  if (!ts) return 'just now';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1600);
}

// ===================================================================
//  WIRING
// ===================================================================
function wireGame() {
  const input = $('messageInput');
  const sendBtn = $('sendBtn');

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 140) + 'px';
    sendBtn.disabled = !input.value.trim() || isStreaming;
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) submitWorld();
    }
  });
  sendBtn.addEventListener('click', submitWorld);

  $('quickCmds').querySelectorAll('.qc').forEach((b) => {
    b.addEventListener('click', () => {
      const cmd = b.dataset.cmd;
      sendWorld(cmd);
    });
  });

  $('menuBackBtn').addEventListener('click', backToMenu);
  $('saveBtn').addEventListener('click', () => openSaveModal('save'));
  $('phoneToggle').addEventListener('click', openPhone);

  // phone nav
  $('phoneCloseBtn').addEventListener('click', closePhone);
  $('phoneOverlay').addEventListener('click', (e) => { if (e.target === $('phoneOverlay')) closePhone(); });
  document.querySelectorAll('.app-back[data-target="home"]').forEach((b) => b.addEventListener('click', () => showPhoneView('home')));
  $('threadBackBtn').addEventListener('click', () => openApp(currentApp));
  $('newChatBtn').addEventListener('click', newChatPrompt);

  const pInput = $('phoneInput');
  $('phoneSendBtn').addEventListener('click', () => sendPhone(pInput.value));
  pInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendPhone(pInput.value); });

  // modal
  $('modalCloseBtn').addEventListener('click', closeModal);
  $('modalOverlay').addEventListener('click', (e) => { if (e.target === $('modalOverlay')) closeModal(); });
}

function submitWorld() {
  const input = $('messageInput');
  const text = input.value.trim();
  if (!text) return;
  clearInput();
  sendWorld(text);
}

// ===================================================================
//  BOOT
// ===================================================================
initMenu();
wireGame();
