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
const youRoleOptions = document.getElementById('youRoleOptions');
const partnerGroup = document.getElementById('partnerGroup');
const partnerRoleOptions = document.getElementById('partnerRoleOptions');
const officeOptions = document.getElementById('officeOptions');
const resumeBanner = document.getElementById('resumeBanner');
const resumeBtn = document.getElementById('resumeBtn');
// Switch modal
const switchBtn = document.getElementById('switchBtn');
const switchModal = document.getElementById('switchModal');
const switchYouOptions = document.getElementById('switchYouOptions');
const switchPartnerGroup = document.getElementById('switchPartnerGroup');
const switchPartnerOptions = document.getElementById('switchPartnerOptions');
const switchConfirm = document.getElementById('switchConfirm');
const switchCancel = document.getElementById('switchCancel');
// Saves modal
const saveBtn = document.getElementById('saveBtn');
const savesBtn = document.getElementById('savesBtn');
const savesModal = document.getElementById('savesModal');
const savesList = document.getElementById('savesList');
const savesClose = document.getElementById('savesClose');

const ROLE_EMOJI = {
  therapist: '🧑‍⚕️', husband: '🤵', wife: '👰', boyfriend: '🧍‍♂️', girlfriend: '🧍‍♀️',
};
const PARTNER_DEFAULT = { husband: 'wife', wife: 'husband', boyfriend: 'girlfriend', girlfriend: 'boyfriend' };
const AUTOSAVE_KEY = 'couch_autosave';
const SAVES_KEY = 'couch_saves';

let history = [];   // model messages
let log = [];       // display events: {t:'me'|'ai'|'scene', text, variant?}
let isStreaming = false;
let coupleInfo = '';
let week = 1;
let inSession = false;
let userRole = 'therapist';
let partnerRole = null;
let office = 'cozy';

// ---------- Generic role-card pickers ----------
function selectCard(container, value, attr) {
  container.querySelectorAll('.role-card').forEach(c => {
    c.classList.toggle('selected', c.dataset[attr] === value);
  });
}

// Setup: "you" role
youRoleOptions.querySelectorAll('.role-card').forEach(card => {
  card.addEventListener('click', () => {
    userRole = card.dataset.role;
    selectCard(youRoleOptions, userRole, 'role');
    syncPartnerGroup(userRole, partnerGroup, partnerRoleOptions);
  });
});
partnerRoleOptions.querySelectorAll('.role-card').forEach(card => {
  card.addEventListener('click', () => { partnerRole = card.dataset.role; selectCard(partnerRoleOptions, partnerRole, 'role'); });
});
officeOptions.querySelectorAll('.role-card').forEach(card => {
  card.addEventListener('click', () => { office = card.dataset.office; selectCard(officeOptions, office, 'office'); applyOffice(); });
});

function syncPartnerGroup(role, groupEl, optionsEl) {
  if (role === 'therapist') {
    groupEl.hidden = true;
    partnerRole = null;
  } else {
    groupEl.hidden = false;
    if (!partnerRole || partnerRole === role) partnerRole = PARTNER_DEFAULT[role];
    selectCard(optionsEl, partnerRole, 'role');
  }
}

function applyOffice() { document.body.dataset.office = office; }

// Default selections
selectCard(youRoleOptions, 'therapist', 'role');
selectCard(officeOptions, 'cozy', 'office');
applyOffice();

// ---------- Begin / setup ----------
saveProfileBtn.addEventListener('click', () => {
  coupleInfo = coupleInfoEl.value.trim();
  profilePanel.classList.remove('open');
  input.focus();
  updateBadge();
  autosave();
});
profileBtn.addEventListener('click', () => {
  profilePanel.classList.toggle('open');
  if (profilePanel.classList.contains('open')) coupleInfoEl.focus();
});
profilePanel.classList.add('open');
refreshResumeBanner();

// ---------- Input ----------
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 200) + 'px';
  sendBtn.disabled = !input.value.trim() || isStreaming;
});
// NOTE: Enter does NOT send. It just makes a new line (default textarea behavior).
// Sending happens only via the Send button or a command chip.
sendBtn.addEventListener('click', handleSend);
resetBtn.addEventListener('click', resetAll);
cmdChips.querySelectorAll('.cmd-chip').forEach(chip => {
  chip.addEventListener('click', () => { if (isStreaming) return; input.value = chip.dataset.cmd; handleSend(); });
});

function roleTitle(r) { return r ? r.charAt(0).toUpperCase() + r.slice(1) : ''; }
function updateBadge() {
  const who = `You: ${roleTitle(userRole)}`;
  sessionBadge.textContent = inSession ? `${who} · Week ${week} · In session` : `${who} · Not started`;
  sessionBadge.className = inSession ? 'session-badge active' : 'session-badge';
}
function userAvatar() { return ROLE_EMOJI[userRole] || '🧑‍⚕️'; }
function aiAvatar() { return userRole === 'therapist' ? '💑' : '🎭'; }

function resetAll() {
  history = []; log = [];
  messagesEl.innerHTML = '';
  welcome.style.display = 'flex';
  input.value = ''; input.style.height = 'auto';
  sendBtn.disabled = true; isStreaming = false;
  week = 1; inSession = false;
  localStorage.removeItem(AUTOSAVE_KEY);
  profilePanel.classList.add('open');
  refreshResumeBanner();
  updateBadge();
}

// ---------- Command handling ----------
function handleSend() {
  const text = input.value.trim();
  if (!text || isStreaming) return;
  if (text.startsWith('/')) runCommand(text);
  else sendTurn(text, 'user');
}

function runCommand(raw) {
  const cmd = raw.slice(1).trim().toLowerCase();
  input.value = ''; input.style.height = 'auto'; sendBtn.disabled = true;

  if (cmd.startsWith('start') || cmd.startsWith('begin')) {
    if (inSession) { addScene(`Already in session ${week}. Talk, or use /end or /next.`, 'info'); return; }
    inSession = true; updateBadge();
    addScene(`Session ${week} — begins`, 'start');
    sendTurn(`(The therapist welcomes everyone in and begins therapy session #${week}.)`, 'stage');
    return;
  }
  if (cmd.startsWith('end') || cmd.startsWith('stop') || cmd.startsWith('close')) {
    if (!inSession) { addScene('No session is running. Use /start.', 'info'); return; }
    inSession = false; updateBadge();
    addScene(`Session ${week} — ends`, 'end');
    sendTurn(`(The therapist brings session #${week} to a close.)`, 'stage');
    return;
  }
  if (cmd.startsWith('next') || cmd.startsWith('skip') || cmd.startsWith('week')) {
    week += 1; inSession = true; updateBadge();
    addScene(`One week later — Session ${week}`, 'next');
    sendTurn(`(One week has passed. Everyone returns for therapy session #${week}.)`, 'stage');
    return;
  }
  if (cmd.startsWith('switch')) { openSwitch(); return; }
  if (cmd.startsWith('save')) { doSave(); return; }
  if (cmd.startsWith('load') || cmd.startsWith('saves')) { openSaves(); return; }
  if (cmd.startsWith('help') || cmd === '?' || cmd === '') {
    addScene('/start · /end · /next · /switch · /save · /saves — anything else is spoken as your character.', 'info');
    return;
  }
  addScene(`Unknown command "/${cmd}". Try /start, /end, /next, /switch, /save, /help.`, 'info');
}

// ---------- Talking to the model ----------
async function sendTurn(text, kind) {
  welcome.style.display = 'none';
  isStreaming = true; sendBtn.disabled = true; sendBtn.classList.add('loading');

  history.push({ role: 'user', content: text });
  if (kind === 'user') {
    appendMessage('therapist', text); log.push({ t: 'me', text });
    input.value = ''; input.style.height = 'auto';
  }

  const { bubble, cursor } = createAiBubble();
  scrollToBottom();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history, coupleInfo, userRole, partnerRole, office }),
    });
    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let aiText = '', buffer = '';
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
          if (parsed.error) { bubble.innerHTML = `<div class="error-msg">${escapeHtml(parsed.error)}</div>`; cursor.remove(); break; }
          if (parsed.text) { aiText += parsed.text; bubble.innerHTML = renderMarkdown(aiText); bubble.appendChild(cursor); scrollToBottom(); }
        } catch {}
      }
    }
    cursor.remove();
    if (aiText) { history.push({ role: 'assistant', content: aiText }); log.push({ t: 'ai', text: aiText }); bubble.innerHTML = renderMarkdown(aiText); }
  } catch (err) {
    cursor.remove();
    bubble.innerHTML = `<div class="error-msg">Connection error: ${escapeHtml(err.message)}</div>`;
  }

  isStreaming = false; sendBtn.classList.remove('loading');
  sendBtn.disabled = !input.value.trim();
  scrollToBottom();
  autosave();
}

// ---------- Rendering ----------
function appendMessage(role, content) {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'therapist' ? userAvatar() : aiAvatar();
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = role === 'therapist' ? escapeHtml(content) : renderMarkdown(content);
  div.appendChild(avatar); div.appendChild(bubble);
  messagesEl.appendChild(div); scrollToBottom();
  return bubble;
}
function createAiBubble() {
  const div = document.createElement('div');
  div.className = 'message couple';
  const avatar = document.createElement('div');
  avatar.className = 'avatar'; avatar.textContent = aiAvatar();
  const bubble = document.createElement('div'); bubble.className = 'bubble';
  const cursor = document.createElement('span'); cursor.className = 'typing-cursor';
  bubble.appendChild(cursor);
  div.appendChild(avatar); div.appendChild(bubble);
  messagesEl.appendChild(div);
  return { bubble, cursor };
}
function addScene(text, variant) {
  welcome.style.display = 'none';
  const div = document.createElement('div');
  div.className = `scene scene-${variant}`;
  div.innerHTML = `<span>${escapeHtml(text)}</span>`;
  messagesEl.appendChild(div); scrollToBottom();
  log.push({ t: 'scene', text, variant });
  autosave();
}
function scrollToBottom() { chatArea.scrollTop = chatArea.scrollHeight; }

// ---------- Switch character mid-session ----------
function openSwitch() {
  selectCard(switchYouOptions, userRole, 'role');
  if (userRole === 'therapist') { switchPartnerGroup.hidden = true; }
  else { switchPartnerGroup.hidden = false; selectCard(switchPartnerOptions, partnerRole, 'role'); }
  switchModal.hidden = false;
}
switchBtn.addEventListener('click', openSwitch);
switchCancel.addEventListener('click', () => { switchModal.hidden = true; });
let pendingRole = null, pendingPartner = null;
switchYouOptions.querySelectorAll('.role-card').forEach(card => {
  card.addEventListener('click', () => {
    pendingRole = card.dataset.role;
    selectCard(switchYouOptions, pendingRole, 'role');
    if (pendingRole === 'therapist') { switchPartnerGroup.hidden = true; pendingPartner = null; }
    else {
      switchPartnerGroup.hidden = false;
      if (!pendingPartner || pendingPartner === pendingRole) pendingPartner = PARTNER_DEFAULT[pendingRole];
      selectCard(switchPartnerOptions, pendingPartner, 'role');
    }
  });
});
switchPartnerOptions.querySelectorAll('.role-card').forEach(card => {
  card.addEventListener('click', () => { pendingPartner = card.dataset.role; selectCard(switchPartnerOptions, pendingPartner, 'role'); });
});
switchConfirm.addEventListener('click', () => {
  const newRole = pendingRole || userRole;
  const newPartner = newRole === 'therapist' ? null : (pendingPartner || PARTNER_DEFAULT[newRole]);
  userRole = newRole; partnerRole = newPartner;
  switchModal.hidden = true;
  pendingRole = null; pendingPartner = null;
  updateBadge();
  // Tell the model who the human is now, so it adjusts who it voices.
  const note = userRole === 'therapist'
    ? `(The person you are talking to is now playing THE THERAPIST. From now on you voice BOTH partners and never the therapist.)`
    : `(The person you are talking to is now playing the ${userRole}. From now on you voice the ${partnerRole} and the therapist, and never the ${userRole}.)`;
  history.push({ role: 'user', content: note });
  addScene(`You are now the ${roleTitle(userRole)}`, 'info');
});

// ---------- Save mode ----------
function snapshot() {
  return { coupleInfo, userRole, partnerRole, office, week, inSession, history, log, ts: Date.now() };
}
function autosave() {
  try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(snapshot())); } catch {}
}
function restore(data) {
  coupleInfo = data.coupleInfo || '';
  userRole = data.userRole || 'therapist';
  partnerRole = data.partnerRole || null;
  office = data.office || 'cozy';
  week = data.week || 1;
  inSession = !!data.inSession;
  history = Array.isArray(data.history) ? data.history : [];
  log = Array.isArray(data.log) ? data.log : [];
  coupleInfoEl.value = coupleInfo;
  applyOffice();
  selectCard(youRoleOptions, userRole, 'role');
  selectCard(officeOptions, office, 'office');
  syncPartnerGroup(userRole, partnerGroup, partnerRoleOptions);
  // Re-render the transcript from the log.
  messagesEl.innerHTML = '';
  welcome.style.display = log.length ? 'none' : 'flex';
  for (const ev of log) {
    if (ev.t === 'me') appendMessage('therapist', ev.text);
    else if (ev.t === 'ai') appendMessage('couple', ev.text);
    else if (ev.t === 'scene') {
      const div = document.createElement('div');
      div.className = `scene scene-${ev.variant}`;
      div.innerHTML = `<span>${escapeHtml(ev.text)}</span>`;
      messagesEl.appendChild(div);
    }
  }
  profilePanel.classList.remove('open');
  updateBadge();
  scrollToBottom();
}
function refreshResumeBanner() {
  const has = !!localStorage.getItem(AUTOSAVE_KEY);
  resumeBanner.hidden = !has;
}
resumeBtn.addEventListener('click', () => {
  const raw = localStorage.getItem(AUTOSAVE_KEY);
  if (raw) { try { restore(JSON.parse(raw)); } catch {} }
});

// Named saves
function getSaves() { try { return JSON.parse(localStorage.getItem(SAVES_KEY)) || []; } catch { return []; } }
function setSaves(arr) { localStorage.setItem(SAVES_KEY, JSON.stringify(arr)); }
function doSave() {
  const def = `${roleTitle(userRole)} · Week ${week}`;
  const name = (prompt('Name this save:', def) || '').trim() || def;
  const saves = getSaves();
  saves.unshift({ id: 'sv_' + Date.now(), name, data: snapshot() });
  setSaves(saves.slice(0, 30));
  addScene(`Saved as "${name}"`, 'info');
}
saveBtn.addEventListener('click', doSave);
savesBtn.addEventListener('click', openSaves);
savesClose.addEventListener('click', () => { savesModal.hidden = true; });
function openSaves() {
  const saves = getSaves();
  savesList.innerHTML = '';
  if (!saves.length) { savesList.innerHTML = '<p class="modal-help">No saved sessions yet. Use Save during a session.</p>'; }
  for (const s of saves) {
    const row = document.createElement('div');
    row.className = 'save-row';
    const when = new Date(s.data.ts || Date.now()).toLocaleString();
    row.innerHTML = `<div class="save-meta"><div class="save-name"></div><div class="save-when"></div></div>`;
    row.querySelector('.save-name').textContent = s.name;
    row.querySelector('.save-when').textContent = when;
    const loadB = document.createElement('button'); loadB.className = 'primary-btn small'; loadB.textContent = 'Load';
    loadB.addEventListener('click', () => { restore(s.data); savesModal.hidden = true; });
    const delB = document.createElement('button'); delB.className = 'ghost-btn'; delB.textContent = 'Delete';
    delB.addEventListener('click', () => { setSaves(getSaves().filter(x => x.id !== s.id)); openSaves(); });
    const actions = document.createElement('div'); actions.className = 'save-actions';
    actions.appendChild(loadB); actions.appendChild(delB);
    row.appendChild(actions);
    savesList.appendChild(row);
  }
  savesModal.hidden = false;
}

// Close modals when tapping the dark backdrop
[switchModal, savesModal].forEach(m => m.addEventListener('click', e => { if (e.target === m) m.hidden = true; }));

// ---------- helpers ----------
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
function renderMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => `<pre><code>${code.trim()}</code></pre>`);
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
  html = html.split(/\n\n+/).map(block => {
    if (/^<(h[123]|ul|ol|pre|blockquote|hr)/.test(block.trim())) return block;
    return `<p>${block.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');
  return html;
}

updateBadge();
