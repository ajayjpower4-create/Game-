// ---------- Elements ----------
const screens = {
  side: document.getElementById('screenSide'),
  calling: document.getElementById('screenCalling'),
  answering: document.getElementById('screenAnswering'),
  call: document.getElementById('screenCall'),
};
const chooseCalling = document.getElementById('chooseCalling');
const chooseAnswering = document.getElementById('chooseAnswering');
const calleeInput = document.getElementById('calleeInput');
const startCallingBtn = document.getElementById('startCallingBtn');
const wantsInput = document.getElementById('wantsInput');
const roleInput = document.getElementById('roleInput');
const startAnsweringBtn = document.getElementById('startAnsweringBtn');

const callName = document.getElementById('callName');
const callAvatar = document.getElementById('callAvatar');
const callStatus = document.getElementById('callStatus');
const endCallBtn = document.getElementById('endCallBtn');
const transcript = document.getElementById('transcript');
const messagesEl = document.getElementById('messages');
const input = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const holdHint = document.getElementById('holdHint');

const holdBanner = document.getElementById('holdBanner');
const holdMusicLabel = document.getElementById('holdMusicLabel');
const resumeBtn = document.getElementById('resumeBtn');
const musicModal = document.getElementById('musicModal');
const customMusicInput = document.getElementById('customMusicInput');
const confirmMusicBtn = document.getElementById('confirmMusicBtn');
const cancelMusicBtn = document.getElementById('cancelMusicBtn');

const openPanelBtn = document.getElementById('openPanelBtn');
const closePanelBtn = document.getElementById('closePanelBtn');
const truthPanel = document.getElementById('truthPanel');
const panelBackdrop = document.getElementById('panelBackdrop');
const truthList = document.getElementById('truthList');
const truthInput = document.getElementById('truthInput');
const addTruthBtn = document.getElementById('addTruthBtn');
const truthCount = document.getElementById('truthCount');

const askModal = document.getElementById('askModal');
const askClaim = document.getElementById('askClaim');
const askTrueBtn = document.getElementById('askTrueBtn');
const askFalseBtn = document.getElementById('askFalseBtn');
const askCustomInput = document.getElementById('askCustomInput');
const askCustomBtn = document.getElementById('askCustomBtn');

// ---------- State ----------
const SAVE_KEY = 'callsim.save.v1';

function blankState() {
  return {
    scenario: null,        // { mode, callee?, playerRole?, callerWants? }
    history: [],           // API messages: { role, content }
    display: [],           // UI log: { kind: 'them'|'you'|'event'|'ruling', text }
    facts: [],             // established truths — the only reality they get
    pendingAsk: null,      // a claim waiting on the player's ruling
    onHold: false,
    holdMusic: '',
  };
}

let state = blankState();
let isStreaming = false;

// Detect iPhone/iPad so the Return key never sends messages there
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

// ---------- Persistence ----------
function saveCall() {
  try {
    if (state.scenario && state.history.length > 0) {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    }
  } catch {}
}

function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch {}
}

function loadCall() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    if (!saved || !saved.scenario || !Array.isArray(saved.history)) return false;
    state = {
      scenario: saved.scenario,
      history: saved.history,
      display: Array.isArray(saved.display) ? saved.display : [],
      facts: Array.isArray(saved.facts) ? saved.facts : [],
      pendingAsk: typeof saved.pendingAsk === 'string' ? saved.pendingAsk : null,
      onHold: !!saved.onHold,
      holdMusic: saved.holdMusic || '',
    };
    return true;
  } catch {
    return false;
  }
}

// ---------- Screen helpers ----------
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.add('hidden'));
  screens[name].classList.remove('hidden');
}

function otherPartyName() {
  if (!state.scenario) return 'Unknown';
  return state.scenario.mode === 'calling' ? state.scenario.callee : 'Incoming Caller';
}

function refreshCallHeader() {
  callName.textContent = otherPartyName();
  callAvatar.textContent = state.scenario && state.scenario.mode === 'calling' ? '📱' : '📳';
  if (state.onHold) {
    callStatus.textContent = `On hold — ${state.holdMusic}`;
    callStatus.classList.add('status-hold');
  } else {
    callStatus.textContent = isStreaming ? '…' : 'On call';
    callStatus.classList.remove('status-hold');
  }
}

function refreshHoldUI() {
  const answering = state.scenario && state.scenario.mode === 'answering';
  const blocked = state.onHold || !!state.pendingAsk;
  holdHint.classList.toggle('hidden', !answering || blocked);
  holdBanner.classList.toggle('hidden', !state.onHold);
  holdMusicLabel.textContent = state.holdMusic;
  input.disabled = blocked;
  if (state.pendingAsk) input.placeholder = 'Waiting on your ruling…';
  else if (state.onHold) input.placeholder = 'They’re on hold…';
  else input.placeholder = 'Say something…';
  refreshSendBtn();
  refreshCallHeader();
}

function refreshSendBtn() {
  sendBtn.disabled = !input.value.trim() || isStreaming || state.onHold || !!state.pendingAsk;
  refreshPanelBusy();
}

// ---------- Rendering ----------
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Only formatting in a call: *short actions* shown as italics
function renderLine(text) {
  return escapeHtml(text).replace(/\*([^*\n]+)\*/g, '<em class="action">$1</em>');
}

// ---------- Ruling requests ----------
// They can't invent facts, so instead they emit [[ASK: ...]] at the end of a
// message. The marker is never shown on the call — it becomes a popup.
const ASK_RE = /\[\[ASK:\s*([\s\S]*?)\]\]/;
const ASK_OPEN = '[[';

// What the player actually hears: everything before the marker starts. Cutting
// at the first "[[" also hides a marker that is still mid-stream.
function spokenPart(text) {
  const i = text.indexOf(ASK_OPEN);
  return (i === -1 ? text : text.slice(0, i)).trim();
}

function extractAsk(text) {
  const m = text.match(ASK_RE);
  if (m) return m[1].trim();
  // Ran out of tokens mid-marker — salvage the claim anyway
  const i = text.indexOf('[[ASK:');
  if (i !== -1) return text.slice(i + 6).replace(/\]+$/, '').trim();
  return null;
}

function appendBubble(kind, text) {
  const div = document.createElement('div');
  if (kind === 'event' || kind === 'ruling') {
    div.className = kind === 'ruling' ? 'event-line ruling' : 'event-line';
    div.textContent = text;
  } else {
    div.className = `line ${kind === 'you' ? 'you' : 'them'}`;
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerHTML = renderLine(text);
    div.appendChild(bubble);
  }
  messagesEl.appendChild(div);
  scrollToBottom();
  return div;
}

function renderFullTranscript() {
  messagesEl.innerHTML = '';
  for (const item of state.display) appendBubble(item.kind, item.text);
}

function scrollToBottom() {
  transcript.scrollTop = transcript.scrollHeight;
}

// ---------- Core game flow ----------
async function requestReply() {
  isStreaming = true;
  refreshSendBtn();
  refreshCallHeader();

  const line = document.createElement('div');
  line.className = 'line them';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  const cursor = document.createElement('span');
  cursor.className = 'typing-cursor';
  bubble.appendChild(cursor);
  line.appendChild(bubble);
  messagesEl.appendChild(line);
  scrollToBottom();

  let text = '';
  try {
    // Retry the connection a few times: a sleeping free-tier server or a
    // flaky mobile connection makes the first attempt die with "Load failed".
    let res;
    for (let attempt = 0; ; attempt++) {
      try {
        res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scenario: { ...state.scenario, facts: state.facts },
            messages: state.history,
          }),
        });
        break;
      } catch (e) {
        if (attempt >= 2) throw e;
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const l of lines) {
        if (!l.startsWith('data: ')) continue;
        const data = l.slice(6).trim();
        if (data === '[DONE]') break;
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) throw new Error(parsed.error);
          if (parsed.text) {
            text += parsed.text;
            bubble.innerHTML = renderLine(spokenPart(text));
            bubble.appendChild(cursor);
            scrollToBottom();
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }

    cursor.remove();
    const raw = text.trim();
    const spoken = spokenPart(raw);
    const ask = extractAsk(raw);

    if (spoken) {
      bubble.innerHTML = renderLine(spoken);
      state.display.push({ kind: 'them', text: spoken });
    } else {
      line.remove();
    }
    // The marker stays in history so they remember what they asked
    if (raw) state.history.push({ role: 'assistant', content: raw });

    if (ask) {
      state.pendingAsk = ask;
      saveCall();
      openAskModal();
    } else {
      saveCall();
    }
  } catch (err) {
    cursor.remove();
    const isNetwork = err instanceof TypeError ||
      /load failed|failed to fetch|network/i.test(err.message);
    const friendly = isNetwork
      ? 'Connection dropped — the server may have been waking up.'
      : err.message;
    bubble.innerHTML = `<span class="error-msg">📵 ${escapeHtml(friendly)}</span>`;
    const retryBtn = document.createElement('button');
    retryBtn.className = 'retry-btn';
    retryBtn.textContent = 'Tap to retry';
    retryBtn.addEventListener('click', () => {
      line.remove();
      requestReply();
    });
    bubble.appendChild(retryBtn);
    // The user's last message stays in history, so retrying re-asks for the reply
  }

  isStreaming = false;
  refreshSendBtn();
  refreshCallHeader();
}

function pushEvent(text, { silent = false } = {}) {
  state.history.push({ role: 'user', content: `[${text}]` });
  if (!silent) {
    state.display.push({ kind: 'event', text });
    appendBubble('event', text);
  }
  saveCall();
}

async function startCall(scenario) {
  state = { ...blankState(), scenario };
  showScreen('call');
  messagesEl.innerHTML = '';
  renderTruths();
  refreshHoldUI();

  if (scenario.mode === 'calling') {
    pushEvent('The phone rings. You pick up.');
  } else {
    pushEvent('The call connects. Your call has just been answered.');
  }
  await requestReply();
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text || isStreaming || state.onHold) return;

  // /Holdtheline command (answering mode only)
  if (/^\/holdtheline$/i.test(text)) {
    input.value = '';
    autoResize();
    if (state.scenario.mode !== 'answering') {
      appendBubble('event', 'You can only put someone on hold when you’re the one answering the call.');
      return;
    }
    openMusicModal();
    return;
  }

  input.value = '';
  autoResize();
  state.history.push({ role: 'user', content: text });
  state.display.push({ kind: 'you', text });
  appendBubble('you', text);
  saveCall();
  await requestReply();
}

// ---------- Hold the line ----------
function openMusicModal() {
  customMusicInput.value = '';
  confirmMusicBtn.disabled = true;
  musicModal.classList.remove('hidden');
}

function closeMusicModal() {
  musicModal.classList.add('hidden');
}

async function putOnHold(music) {
  closeMusicModal();
  state.onHold = true;
  state.holdMusic = music;
  state.display.push({ kind: 'event', text: `You put them on hold. ${music} starts playing.` });
  appendBubble('event', `You put them on hold. ${music} starts playing.`);
  state.history.push({ role: 'user', content: `[You are being put on hold. ${music} hold music starts playing in your ear.]` });
  saveCall();
  refreshHoldUI();
  await requestReply();
  refreshHoldUI();
}

async function takeOffHold() {
  if (isStreaming) return;
  const music = state.holdMusic;
  state.onHold = false;
  state.holdMusic = '';
  state.display.push({ kind: 'event', text: 'You take them off hold.' });
  appendBubble('event', 'You take them off hold.');
  state.history.push({ role: 'user', content: `[You are taken off hold after waiting and listening to ${music} hold music. The line is live again.]` });
  saveCall();
  refreshHoldUI();
  await requestReply();
}

// ---------- Established truths ----------
function renderTruths() {
  truthCount.textContent = state.facts.length;
  truthList.innerHTML = '';

  if (state.facts.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'truth-empty';
    empty.textContent = 'Nothing is true yet. Add something below and it becomes fact — or wait for them to ask you for a ruling.';
    truthList.appendChild(empty);
    return;
  }

  state.facts.forEach((fact, i) => {
    const item = document.createElement('div');
    item.className = 'truth-item';

    const text = document.createElement('div');
    text.className = 'truth-text';
    text.textContent = fact;

    const del = document.createElement('button');
    del.className = 'truth-del';
    del.textContent = '✕';
    del.title = 'Take this back';
    del.addEventListener('click', () => removeFact(i));

    item.append(text, del);
    truthList.appendChild(item);
  });
}

// Facts live in the system prompt, so they apply from the next reply onward.
// A history note pins them to this moment in the call as well.
function addFact(fact, { announce } = { announce: true }) {
  state.facts.push(fact);
  renderTruths();
  if (announce) {
    logRuling(`New truth: ${fact}`);
    state.history.push({ role: 'user', content: `[DIRECTOR: From now on this is absolutely true, and always was — ${fact}]` });
  }
  saveCall();
}

function removeFact(i) {
  const [fact] = state.facts.splice(i, 1);
  renderTruths();
  if (fact && state.history.length > 0) {
    logRuling(`Taken back: ${fact}`);
    state.history.push({ role: 'user', content: `[DIRECTOR: Strike this from reality — it is not true and never was: ${fact}. Never refer to it again.]` });
  }
  saveCall();
}

function logRuling(text) {
  state.display.push({ kind: 'ruling', text });
  appendBubble('ruling', text);
}

function openPanel() {
  renderTruths();
  truthPanel.classList.remove('hidden');
  panelBackdrop.classList.remove('hidden');
  refreshPanelBusy();
}

function closePanel() {
  truthPanel.classList.add('hidden');
  panelBackdrop.classList.add('hidden');
}

function refreshPanelBusy() {
  truthPanel.classList.toggle('busy', isStreaming);
  addTruthBtn.disabled = !truthInput.value.trim() || isStreaming;
}

// ---------- Ruling popup ----------
function openAskModal() {
  askClaim.textContent = state.pendingAsk;
  askCustomInput.value = '';
  askCustomBtn.disabled = true;
  askModal.classList.remove('hidden');
  refreshHoldUI();
}

function closeAskModal() {
  askModal.classList.add('hidden');
}

async function applyRuling(kind, customText) {
  const claim = state.pendingAsk;
  if (!claim) return;
  state.pendingAsk = null;
  closeAskModal();

  let fact, note, label;
  if (kind === 'true') {
    fact = claim;
    note = `[DIRECTOR RULING — this is TRUE, permanently and always was: ${claim}]`;
    label = `Ruled true: ${claim}`;
  } else if (kind === 'false') {
    fact = `It is NOT true that: ${claim}`;
    note = `[DIRECTOR RULING — this is FALSE. It is not real and never happened: ${claim}. Drop it and never bring it up again.]`;
    label = `Ruled false: ${claim}`;
  } else {
    fact = customText;
    note = `[DIRECTOR RULING — what you asked about is not how it is. This is what is actually true, permanently: ${customText}]`;
    label = `Ruled: ${customText}`;
  }

  addFact(fact, { announce: false });
  logRuling(label);
  state.history.push({ role: 'user', content: note });
  saveCall();
  refreshHoldUI();
  await requestReply();
}

// ---------- Setup wiring ----------
chooseCalling.addEventListener('click', () => { showScreen('calling'); calleeInput.focus(); });
chooseAnswering.addEventListener('click', () => { showScreen('answering'); wantsInput.focus(); });

document.querySelectorAll('.back-btn[data-back]').forEach(btn => {
  btn.addEventListener('click', () => showScreen('side'));
});

calleeInput.addEventListener('input', () => {
  startCallingBtn.disabled = !calleeInput.value.trim();
});
function checkAnsweringReady() {
  startAnsweringBtn.disabled = !wantsInput.value.trim() || !roleInput.value.trim();
}
wantsInput.addEventListener('input', checkAnsweringReady);
roleInput.addEventListener('input', checkAnsweringReady);

startCallingBtn.addEventListener('click', () => {
  startCall({ mode: 'calling', callee: calleeInput.value.trim() });
});
startAnsweringBtn.addEventListener('click', () => {
  startCall({
    mode: 'answering',
    callerWants: wantsInput.value.trim(),
    playerRole: roleInput.value.trim(),
  });
});

endCallBtn.addEventListener('click', () => {
  if (!confirm('End this call? The saved call will be deleted.')) return;
  clearSave();
  state = blankState();
  closePanel();
  closeAskModal();
  renderTruths();
  messagesEl.innerHTML = '';
  calleeInput.value = '';
  wantsInput.value = '';
  roleInput.value = '';
  startCallingBtn.disabled = true;
  startAnsweringBtn.disabled = true;
  showScreen('side');
});

// ---------- Input wiring ----------
function autoResize() {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 160) + 'px';
}

input.addEventListener('input', () => {
  autoResize();
  refreshSendBtn();
});

// Enter-to-send is desktop-only. On iPhone/iPad the Return key must NOT send —
// it just makes a new line, so sending only happens via the send button.
if (!isIOS) {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) sendMessage();
    }
  });
}

sendBtn.addEventListener('click', sendMessage);

// ---------- Hold modal wiring ----------
document.querySelectorAll('.music-chip').forEach(chip => {
  chip.addEventListener('click', () => putOnHold(chip.dataset.music));
});
customMusicInput.addEventListener('input', () => {
  confirmMusicBtn.disabled = !customMusicInput.value.trim();
});
confirmMusicBtn.addEventListener('click', () => {
  const music = customMusicInput.value.trim();
  if (music) putOnHold(music);
});
cancelMusicBtn.addEventListener('click', closeMusicModal);
resumeBtn.addEventListener('click', takeOffHold);
musicModal.addEventListener('click', (e) => {
  if (e.target === musicModal) closeMusicModal();
});

// ---------- Truths panel wiring ----------
openPanelBtn.addEventListener('click', openPanel);
closePanelBtn.addEventListener('click', closePanel);
panelBackdrop.addEventListener('click', closePanel);

truthInput.addEventListener('input', refreshPanelBusy);
addTruthBtn.addEventListener('click', () => {
  const fact = truthInput.value.trim();
  if (!fact || isStreaming) return;
  truthInput.value = '';
  addFact(fact);
  refreshPanelBusy();
});

// ---------- Ruling wiring ----------
// No dismiss: they're waiting on a ruling, and every option settles it.
askTrueBtn.addEventListener('click', () => applyRuling('true'));
askFalseBtn.addEventListener('click', () => applyRuling('false'));
askCustomInput.addEventListener('input', () => {
  askCustomBtn.disabled = !askCustomInput.value.trim();
});
askCustomBtn.addEventListener('click', () => {
  const custom = askCustomInput.value.trim();
  if (custom) applyRuling('custom', custom);
});

// Keep the server awake while the game is open: free-tier hosts spin down
// after ~15 idle minutes and the next request fails with "Load failed".
setInterval(() => {
  if (document.visibilityState === 'visible') {
    fetch('/api/ping').catch(() => {});
  }
}, 4 * 60 * 1000);

// Save when leaving the page so the call resumes next visit
window.addEventListener('pagehide', saveCall);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveCall();
});

// ---------- Boot: resume a saved call if one exists ----------
if (loadCall()) {
  showScreen('call');
  renderFullTranscript();
  renderTruths();
  refreshHoldUI();
  // A ruling they were waiting on survives a reload
  if (state.pendingAsk) openAskModal();
} else {
  renderTruths();
  showScreen('side');
}
