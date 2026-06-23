// ===========================================================================
// Family Simulator — front-end game logic
// ===========================================================================

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const STATES = ['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'];
const SAVE_INDEX = 'familysim:saves';

// ---- game state ----------------------------------------------------------
let setupData = blankSetup();
let game = null;        // active game object (setup + runtime + history)
let isStreaming = false;

function blankSetup() {
  return {
    rank: '', playerName: '', familyClass: '',
    partner: null, kids: [], relatives: [],
    usState: 'California', landType: '', pets: [],
  };
}

// ---- element refs --------------------------------------------------------
const $ = (id) => document.getElementById(id);
const setupEl = $('setup'), gameEl = $('game');
const steps = [...document.querySelectorAll('.step')];
const progressBar = $('progressBar');
let stepIndex = 0;

// ===========================================================================
// SETUP WIZARD
// ===========================================================================
function goToStep(i) {
  stepIndex = Math.max(0, Math.min(steps.length - 1, i));
  steps.forEach(s => s.classList.toggle('active', +s.dataset.step === stepIndex));
  progressBar.style.width = `${(stepIndex / (steps.length - 1)) * 100}%`;
  setupEl.querySelector('.setup-inner').scrollTop = 0;
}

document.querySelectorAll('[data-next]').forEach(b => b.addEventListener('click', () => goToStep(stepIndex + 1)));
document.querySelectorAll('[data-prev]').forEach(b => b.addEventListener('click', () => goToStep(stepIndex - 1)));

$('startNew').addEventListener('click', () => { setupData = blankSetup(); goToStep(1); });
$('loadSaved').addEventListener('click', openLoadModal);

// --- single-select choice helper ---
function wireChoices(containerId, onPick) {
  const c = $(containerId);
  c.querySelectorAll('.choice').forEach(btn => {
    btn.addEventListener('click', () => {
      c.querySelectorAll('.choice').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      onPick(btn.dataset.val, btn);
    });
  });
}

// Step 1 — rank
wireChoices('rankChoices', (val) => { setupData.rank = val; $('rankNext').disabled = false; });
$('playerName').addEventListener('input', e => setupData.playerName = e.target.value.trim());

// Step 2 — class
wireChoices('classChoices', (val) => { setupData.familyClass = val; $('classNext').disabled = false; });

// Step 3 — partner
wireChoices('partnerToggle', (val) => {
  const isPartner = val === 'partnered';
  $('partnerForm').classList.toggle('hidden', !isPartner);
  $('partnerNext').disabled = false;
  if (!isPartner) setupData.partner = null;
});
function syncPartner() {
  if ($('partnerForm').classList.contains('hidden')) return;
  setupData.partner = {
    relation: $('partnerRelation').value,
    name: $('partnerName').value.trim(),
    desc: $('partnerDesc').value.trim(),
  };
}
['partnerRelation','partnerName','partnerDesc'].forEach(id => $(id).addEventListener('input', syncPartner));

// Step 4 / 5 / 7 — repeatable member rows
function memberRow(listId, fields, store) {
  const list = $(listId);
  const row = document.createElement('div');
  row.className = 'member-card';
  const obj = {};
  store.push(obj);

  fields.forEach(f => {
    const wrap = document.createElement('label');
    wrap.className = 'field inline';
    const span = document.createElement('span'); span.textContent = f.label;
    let inp;
    if (f.type === 'textarea') { inp = document.createElement('textarea'); inp.rows = 2; }
    else inp = document.createElement('input');
    inp.placeholder = f.placeholder || '';
    inp.maxLength = f.max || 200;
    inp.addEventListener('input', () => obj[f.key] = inp.value.trim());
    wrap.append(span, inp);
    row.appendChild(wrap);
  });

  const del = document.createElement('button');
  del.className = 'del-btn'; del.textContent = '✕ remove';
  del.addEventListener('click', () => {
    const i = store.indexOf(obj);
    if (i > -1) store.splice(i, 1);
    row.remove();
  });
  row.appendChild(del);
  list.appendChild(row);
}

$('addKid').addEventListener('click', () => memberRow('kidsList', [
  { key: 'name', label: 'Name', placeholder: 'e.g. Jake' },
  { key: 'age', label: 'Age', placeholder: 'e.g. 14', max: 12 },
  { key: 'desc', label: 'Describe', placeholder: 'Personality, attitude…', type: 'textarea', max: 400 },
], setupData.kids));

$('addRelative').addEventListener('click', () => memberRow('relativesList', [
  { key: 'relation', label: 'Relation', placeholder: 'grandma, uncle, aunt, nephew…' },
  { key: 'name', label: 'Name', placeholder: 'e.g. Aunt Carol' },
  { key: 'desc', label: 'Describe', placeholder: 'Personality, attitude…', type: 'textarea', max: 400 },
], setupData.relatives));

$('addPet').addEventListener('click', () => memberRow('petsList', [
  { key: 'kind', label: 'Type', placeholder: 'dog, cat, goat…' },
  { key: 'name', label: 'Name', placeholder: 'e.g. Rex' },
  { key: 'desc', label: 'Describe', placeholder: 'optional', type: 'textarea', max: 300 },
], setupData.pets));

// Step 6 — place
const stateSel = $('usState');
STATES.forEach(s => { const o = document.createElement('option'); o.textContent = s; if (s === 'California') o.selected = true; stateSel.appendChild(o); });
stateSel.addEventListener('change', () => setupData.usState = stateSel.value);
wireChoices('landChoices', (val) => {
  const custom = val === 'custom';
  $('landCustom').classList.toggle('hidden', !custom);
  setupData.landType = custom ? ($('landCustom').value.trim() || 'somewhere unusual') : val;
  $('placeNext').disabled = false;
});
$('landCustom').addEventListener('input', e => setupData.landType = e.target.value.trim() || 'somewhere unusual');

// Finish setup -> start game
$('finishSetup').addEventListener('click', () => {
  syncPartner();
  // prune empty members
  setupData.kids = setupData.kids.filter(k => k.name);
  setupData.relatives = setupData.relatives.filter(r => r.name);
  setupData.pets = setupData.pets.filter(p => p.name);
  startGame(newGameFromSetup(setupData));
});

// ===========================================================================
// GAME RUNTIME
// ===========================================================================
function newGameFromSetup(s) {
  return {
    id: 'sim_' + Date.now().toString(36),
    createdAt: Date.now(),
    setup: structuredClone(s),
    dayCount: 1,            // day 1 == Monday
    activeCharacter: '',    // '' means the player's rank character
    history: [],            // {role, content}
  };
}

function rosterFor(g) {
  // List of human family members the player can control.
  const s = g.setup;
  const list = [];
  const selfLabel = s.playerName ? `${s.playerName} (the ${s.rank})` : `the ${s.rank}`;
  list.push({ id: 'self', label: selfLabel });
  if (s.partner && s.partner.name) list.push({ id: 'partner', label: `${s.partner.name} (your ${s.partner.relation})` });
  s.kids.forEach((k, i) => list.push({ id: 'kid' + i, label: `${k.name} (kid)` }));
  s.relatives.forEach((r, i) => list.push({ id: 'rel' + i, label: `${r.name} (${r.relation})` }));
  return list;
}

function activeLabel(g) {
  const roster = rosterFor(g);
  const found = roster.find(r => r.id === (g.activeCharacter || 'self'));
  return (found || roster[0]).label;
}

function dayName(g) { return DAYS[(g.dayCount - 1) % 7]; }
function weekNum(g) { return Math.floor((g.dayCount - 1) / 7) + 1; }

function familyPayload(g) {
  const s = g.setup;
  return {
    rank: s.rank,
    playerName: s.playerName,
    familyClass: s.familyClass,
    usState: s.usState,
    landType: s.landType,
    partner: s.partner,
    kids: s.kids,
    relatives: s.relatives,
    pets: s.pets,
    activeCharacter: activeLabel(g),
    day: dayName(g),
    dayCount: g.dayCount,
  };
}

function startGame(g) {
  game = g;
  setupEl.classList.add('hidden');
  gameEl.classList.remove('hidden');
  $('familyTitle').textContent = (g.setup.playerName ? g.setup.playerName + "'s" : 'Your') + ' family';
  refreshCharSwitch();
  refreshDayPill();
  messagesEl.innerHTML = '';
  if (g.history.length === 0) {
    appendSystemNote(`It's ${dayName(g)} morning. You're playing ${activeLabel(g)}. Say or do something to bring the house to life.`);
  } else {
    g.history.forEach(m => renderHistoryMessage(m));
  }
  scrollToBottom();
  input.focus();
}

function refreshCharSwitch() {
  const sel = $('charSwitch');
  sel.innerHTML = '';
  rosterFor(game).forEach(r => {
    const o = document.createElement('option');
    o.value = r.id; o.textContent = '🎭 ' + r.label;
    if (r.id === (game.activeCharacter || 'self')) o.selected = true;
    sel.appendChild(o);
  });
}

function refreshDayPill() {
  $('dayPill').textContent = `${dayName(game)} · Day ${game.dayCount} · Week ${weekNum(game)}`;
}

// ---- character switching ----
$('charSwitch').addEventListener('change', (e) => {
  const id = e.target.value;
  game.activeCharacter = id === 'self' ? '' : id;
  appendSystemNote(`You're now playing ${activeLabel(game)}.`);
  scrollToBottom();
});

// ===========================================================================
// CHAT
// ===========================================================================
const chatArea = $('chatArea');
const messagesEl = $('messages');
const input = $('messageInput');
const sendBtn = $('sendBtn');

input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 160) + 'px';
  sendBtn.disabled = !input.value.trim() || isStreaming;
});
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!sendBtn.disabled) handleSend(); }
});
sendBtn.addEventListener('click', handleSend);

function handleSend() {
  const text = input.value.trim();
  if (!text || isStreaming) return;
  input.value = ''; input.style.height = 'auto'; sendBtn.disabled = true;

  // command parsing
  const lower = text.toLowerCase();
  if (lower === '/save') { saveGame(); return; }
  if (lower === '/switch') { $('charSwitch').focus(); appendSystemNote('Use the 🎭 dropdown up top to switch family member.'); return; }
  if (lower === '/sleep' || lower.startsWith('/sleep ')) { doSleep(text); return; }
  if (lower === '/wake-up' || lower === '/wakeup' || lower.startsWith('/wake-up ')) { doWake(text); return; }

  sendToFamily(text);
}

function doSleep(raw) {
  game.dayCount += 1;
  refreshDayPill();
  appendSystemNote(`😴 ${activeLabel(game)} goes to bed. The house sleeps… It's now ${dayName(game)}, Day ${game.dayCount}.`);
  const extra = raw.replace(/^\/sleep\s*/i, '').trim();
  sendToFamily(`*I head to bed and go to sleep for the night.*${extra ? ' ' + extra : ''}`);
}

function doWake(raw) {
  appendSystemNote(`☀️ ${dayName(game)} morning — ${activeLabel(game)} wakes up.`);
  const extra = raw.replace(/^\/wake-?up\s*/i, '').trim();
  sendToFamily(`*I wake up and get out of bed.*${extra ? ' ' + extra : ''}`);
}

async function sendToFamily(text) {
  isStreaming = true; sendBtn.disabled = true; sendBtn.classList.add('loading');

  game.history.push({ role: 'user', content: text });
  appendMessage('user', text);

  const { bubble, cursor } = createAssistantBubble();
  scrollToBottom();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: game.history, family: familyPayload(game) }),
    });
    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let acc = '', buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n'); buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') break;
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) { bubble.innerHTML = `<div class="error-msg">${escapeHtml(parsed.error)}</div>`; cursor.remove(); break; }
          if (parsed.text) { acc += parsed.text; bubble.innerHTML = renderFamily(acc); bubble.appendChild(cursor); scrollToBottom(); }
        } catch {}
      }
    }
    cursor.remove();
    if (acc) { game.history.push({ role: 'assistant', content: acc }); bubble.innerHTML = renderFamily(acc); }
    autosave();
  } catch (err) {
    cursor.remove();
    bubble.innerHTML = `<div class="error-msg">Connection error: ${escapeHtml(err.message)}</div>`;
  }

  isStreaming = false; sendBtn.classList.remove('loading');
  sendBtn.disabled = !input.value.trim();
  scrollToBottom();
}

// ---- rendering ----
function renderHistoryMessage(m) {
  if (m.role === 'user') appendMessage('user', m.content);
  else { const { bubble } = createAssistantBubble(); bubble.innerHTML = renderFamily(m.content); }
}

function appendMessage(role, content) {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'user' ? '🧍' : '👨‍👩‍👧';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = role === 'user' ? renderPlayer(content) : renderFamily(content);
  div.append(avatar, bubble);
  messagesEl.appendChild(div);
  scrollToBottom();
  return bubble;
}

function createAssistantBubble() {
  const div = document.createElement('div');
  div.className = 'message assistant';
  const avatar = document.createElement('div');
  avatar.className = 'avatar'; avatar.textContent = '👨‍👩‍👧';
  const bubble = document.createElement('div'); bubble.className = 'bubble';
  const cursor = document.createElement('span'); cursor.className = 'typing-cursor';
  bubble.appendChild(cursor);
  div.append(avatar, bubble);
  messagesEl.appendChild(div);
  return { bubble, cursor };
}

function appendSystemNote(text) {
  const div = document.createElement('div');
  div.className = 'system-note';
  div.textContent = text;
  messagesEl.appendChild(div);
}

// Player line: italicize *actions*, keep it simple.
function renderPlayer(text) {
  return escapeHtml(text).replace(/\*(.+?)\*/g, '<em class="action">$1</em>');
}

// Family line: highlight NAME: speaker labels and *actions*.
function renderFamily(text) {
  let html = escapeHtml(text);
  html = html.replace(/\*(.+?)\*/g, '<em class="action">$1</em>');
  html = html.replace(/^([A-Z][A-Z '\-]{1,24}):/gm, '<span class="speaker">$1:</span>');
  return html.split(/\n{2,}/).map(b => `<p>${b.replace(/\n/g, '<br>')}</p>`).join('');
}

function scrollToBottom() { chatArea.scrollTop = chatArea.scrollHeight; }
function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

// ===========================================================================
// MENU + COMMANDS
// ===========================================================================
$('menuBtn').addEventListener('click', () => $('menu').classList.toggle('hidden'));
document.addEventListener('click', (e) => {
  if (!$('menu').contains(e.target) && e.target !== $('menuBtn')) $('menu').classList.add('hidden');
});
$('menu').querySelectorAll('[data-cmd]').forEach(b => b.addEventListener('click', () => {
  $('menu').classList.add('hidden');
  const cmd = b.dataset.cmd;
  if (isStreaming) return;
  if (cmd === '/sleep') doSleep('/sleep');
  if (cmd === '/wake-up') doWake('/wake-up');
}));
$('saveBtn').addEventListener('click', () => { $('menu').classList.add('hidden'); saveGame(); });
$('exportBtn').addEventListener('click', () => { $('menu').classList.add('hidden'); exportSave(); });
$('quitBtn').addEventListener('click', () => {
  $('menu').classList.add('hidden');
  if (confirm('Quit to the main menu? Save first if you want to keep this family.')) {
    gameEl.classList.add('hidden'); setupEl.classList.remove('hidden');
    setupData = blankSetup(); resetWizard(); goToStep(0);
  }
});

function resetWizard() {
  document.querySelectorAll('.choice.selected').forEach(c => c.classList.remove('selected'));
  ['rankNext','classNext','partnerNext','placeNext'].forEach(id => $(id).disabled = true);
  ['playerName','partnerName','partnerDesc','landCustom'].forEach(id => $(id).value = '');
  ['kidsList','relativesList','petsList'].forEach(id => $(id).innerHTML = '');
  $('partnerForm').classList.add('hidden');
  $('landCustom').classList.add('hidden');
}

// ===========================================================================
// SAVE / LOAD  (localStorage slots + file export/import)
// ===========================================================================
function readIndex() { try { return JSON.parse(localStorage.getItem(SAVE_INDEX)) || {}; } catch { return {}; } }
function writeIndex(idx) { localStorage.setItem(SAVE_INDEX, JSON.stringify(idx)); }

function saveGame() {
  if (!game) return;
  const idx = readIndex();
  idx[game.id] = {
    id: game.id,
    name: (game.setup.playerName ? game.setup.playerName + "'s" : 'My') + ' family',
    class: game.setup.familyClass,
    day: dayName(game), dayCount: game.dayCount,
    savedAt: Date.now(),
    data: game,
  };
  writeIndex(idx);
  toast('💾 Game saved!');
}
function autosave() { if (game) saveGame(); }

function exportSave() {
  if (!game) return;
  const blob = new Blob([JSON.stringify(game, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${game.id}.familysim.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('⬇️ Save file downloaded');
}

// Load modal
function openLoadModal() {
  const idx = readIndex();
  const slots = Object.values(idx).sort((a, b) => b.savedAt - a.savedAt);
  const list = $('slotList');
  list.innerHTML = '';
  if (!slots.length) {
    list.innerHTML = '<p class="muted">No saved games in this browser. Import a save file instead.</p>';
  }
  slots.forEach(slot => {
    const row = document.createElement('div');
    row.className = 'slot';
    row.innerHTML = `<div><strong>${escapeHtml(slot.name)}</strong>
      <span class="muted tiny">${escapeHtml(slot.class)} · ${slot.day}, Day ${slot.dayCount} · ${new Date(slot.savedAt).toLocaleString()}</span></div>`;
    const play = document.createElement('button'); play.className = 'mini-btn'; play.textContent = '▶ Play';
    play.addEventListener('click', () => { $('loadModal').classList.add('hidden'); startGame(slot.data); });
    const del = document.createElement('button'); del.className = 'mini-btn danger'; del.textContent = '🗑';
    del.addEventListener('click', () => { const i = readIndex(); delete i[slot.id]; writeIndex(i); openLoadModal(); });
    row.append(play, del);
    list.appendChild(row);
  });
  const imp = document.createElement('button');
  imp.className = 'mini-btn'; imp.textContent = '📂 Import save file…';
  imp.addEventListener('click', () => $('importFile').click());
  list.appendChild(imp);
  $('loadModal').classList.remove('hidden');
}
$('closeLoad').addEventListener('click', () => $('loadModal').classList.add('hidden'));
$('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const g = JSON.parse(reader.result);
      if (!g.setup || !g.history) throw new Error('not a Family Simulator save');
      $('loadModal').classList.add('hidden');
      startGame(g);
      saveGame();
    } catch (err) { toast('⚠️ Bad save file'); }
  };
  reader.readAsText(file);
});

// ---- toast ----
let toastTimer;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 2200);
}

// boot
goToStep(0);
