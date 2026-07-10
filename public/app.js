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

// ---------- State ----------
const SAVE_KEY = 'callsim.save.v1';

let state = {
  scenario: null,          // { mode, callee?, playerRole?, callerWants? }
  history: [],             // API messages: { role, content }
  display: [],             // UI log: { kind: 'them'|'you'|'event', text }
  onHold: false,
  holdMusic: '',
};
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
  holdHint.classList.toggle('hidden', !answering || state.onHold);
  holdBanner.classList.toggle('hidden', !state.onHold);
  holdMusicLabel.textContent = state.holdMusic;
  input.disabled = state.onHold;
  input.placeholder = state.onHold ? 'They’re on hold…' : 'Say something…';
  refreshSendBtn();
  refreshCallHeader();
}

function refreshSendBtn() {
  sendBtn.disabled = !input.value.trim() || isStreaming || state.onHold;
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

function appendBubble(kind, text) {
  const div = document.createElement('div');
  if (kind === 'event') {
    div.className = 'event-line';
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
          body: JSON.stringify({ scenario: state.scenario, messages: state.history }),
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
            bubble.innerHTML = renderLine(text);
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
    if (text) {
      bubble.innerHTML = renderLine(text);
      state.history.push({ role: 'assistant', content: text });
      state.display.push({ kind: 'them', text });
      saveCall();
    } else {
      line.remove();
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
  state = { scenario, history: [], display: [], onHold: false, holdMusic: '' };
  showScreen('call');
  messagesEl.innerHTML = '';
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
  state = { scenario: null, history: [], display: [], onHold: false, holdMusic: '' };
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
  refreshHoldUI();
} else {
  showScreen('side');
}
