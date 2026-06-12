// ===================== Contagion Lab — client =====================

// Speed presets: real seconds it takes one in-sim day to pass.
const SPEEDS = {
  pause: null,
  slow: 14,
  normal: 7,
  fast: 3,
};

const state = {
  virus: null,
  world: { day: 0, phase: 'Outbreak', totalCases: 0, totalDeaths: 0, r0: 0, countries: [] },
  speed: 'normal',
  dayProgress: 0,      // 0..1 within the current day
  lastTick: 0,
  rafId: null,
  busy: false,         // true while waiting on the AI
  pendingEvents: [],   // big events queued for the next report
  pendingEdits: null,  // virus edits queued for the next report
};

// ---------- element helpers ----------
const $ = (id) => document.getElementById(id);

// ===================== SETUP =====================
$('v-infectivity').addEventListener('input', (e) => $('infVal').textContent = e.target.value);
$('v-lethality').addEventListener('input', (e) => $('lethVal').textContent = e.target.value);

$('launchBtn').addEventListener('click', () => {
  const name = $('v-name').value.trim() || 'Unnamed Pathogen';
  state.virus = {
    name,
    type: $('v-type').value,
    origin: $('v-origin').value.trim() || 'Unknown',
    transmission: $('v-transmission').value.trim() || 'Airborne',
    infectivity: Number($('v-infectivity').value),
    lethality: Number($('v-lethality').value),
    incubationDays: Number($('v-incubation').value),
    mutationRate: $('v-mutation').value,
    symptoms: $('v-symptoms').value.trim() || 'fever, fatigue',
    notes: $('v-notes').value.trim(),
  };

  $('setup').classList.add('hidden');
  $('sim').classList.remove('hidden');
  $('simName').textContent = state.virus.name;

  hydrateEditor();
  renderWorld();
  // First report: patient zero.
  state.pendingEvents.push(`Patient zero identified in ${state.virus.origin}. The outbreak begins.`);
  runStep(1);
  startClock();
});

// ===================== LIVE EDITOR =====================
function hydrateEditor() {
  $('e-name').value = state.virus.name;
  $('e-transmission').value = state.virus.transmission;
  $('e-infectivity').value = state.virus.infectivity;
  $('e-lethality').value = state.virus.lethality;
  $('e-symptoms').value = state.virus.symptoms;
  $('e-notes').value = state.virus.notes;
  $('eInfVal').textContent = state.virus.infectivity;
  $('eLethVal').textContent = state.virus.lethality;
}
$('e-infectivity').addEventListener('input', (e) => $('eInfVal').textContent = e.target.value);
$('e-lethality').addEventListener('input', (e) => $('eLethVal').textContent = e.target.value);

$('applyEdits').addEventListener('click', () => {
  const updated = {
    name: $('e-name').value.trim() || state.virus.name,
    transmission: $('e-transmission').value.trim() || state.virus.transmission,
    infectivity: Number($('e-infectivity').value),
    lethality: Number($('e-lethality').value),
    symptoms: $('e-symptoms').value.trim() || state.virus.symptoms,
    notes: $('e-notes').value.trim(),
  };
  // Describe what changed so the AI can react.
  const changes = [];
  if (updated.name !== state.virus.name) changes.push(`renamed to "${updated.name}"`);
  if (updated.transmission !== state.virus.transmission) changes.push(`transmission changed to ${updated.transmission}`);
  if (updated.infectivity !== state.virus.infectivity) changes.push(`infectivity now ${updated.infectivity}%`);
  if (updated.lethality !== state.virus.lethality) changes.push(`lethality now ${updated.lethality}%`);
  if (updated.symptoms !== state.virus.symptoms) changes.push(`symptoms now ${updated.symptoms}`);
  if (updated.notes !== state.virus.notes) changes.push(`notes: ${updated.notes}`);

  Object.assign(state.virus, updated);
  $('simName').textContent = state.virus.name;

  if (changes.length) {
    state.pendingEdits = changes.join('; ');
    flashGhost($('applyEdits'), '✓ Queued');
  }
});

// ===================== EVENTS =====================
$('eventBtn').addEventListener('click', injectEvent);
$('eventInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) injectEvent();
});
document.querySelectorAll('.hint').forEach((h) => {
  h.addEventListener('click', () => {
    $('eventInput').value = h.dataset.event;
    injectEvent();
  });
});

function injectEvent() {
  const text = $('eventInput').value.trim();
  if (!text) return;
  state.pendingEvents.push(text);
  $('eventInput').value = '';
  addNews({ day: state.world.day, headline: 'Event injected', report: text, tags: [] }, 'event');
  // An injected event triggers an immediate report (unless one is already running).
  if (!state.busy) runStep(1);
}

// ===================== TIME / CLOCK =====================
document.querySelectorAll('.tbtn[data-speed]').forEach((b) => {
  b.addEventListener('click', () => setSpeed(b.dataset.speed));
});
$('stepBtn').addEventListener('click', () => { if (!state.busy) runStep(1); });

function setSpeed(speed) {
  state.speed = speed;
  document.querySelectorAll('.tbtn[data-speed]').forEach((b) =>
    b.classList.toggle('active', b.dataset.speed === speed));
  updateTimebarLabel();
}

function startClock() {
  state.lastTick = performance.now();
  const loop = (now) => {
    const dt = (now - state.lastTick) / 1000;
    state.lastTick = now;
    const secPerDay = SPEEDS[state.speed];
    if (secPerDay && !state.busy) {
      state.dayProgress += dt / secPerDay;
      if (state.dayProgress >= 1) {
        state.dayProgress = 0;
        runStep(1);
      }
    }
    renderTimebar();
    state.rafId = requestAnimationFrame(loop);
  };
  state.rafId = requestAnimationFrame(loop);
}

function renderTimebar() {
  const pct = state.busy ? 100 : Math.min(100, state.dayProgress * 100);
  $('timebarFill').style.width = pct + '%';
}
function updateTimebarLabel() {
  const el = $('timebarLabel');
  if (state.busy) { el.textContent = 'Generating report…'; return; }
  if (state.speed === 'pause') { el.textContent = `Paused — Day ${state.world.day}`; return; }
  el.textContent = `Day ${state.world.day} → ${state.world.day + 1}  (${state.speed})`;
}

// ===================== SIMULATION STEP =====================
async function runStep(daysElapsed) {
  if (state.busy) return;
  state.busy = true;
  updateTimebarLabel();
  renderTimebar();

  const events = state.pendingEvents.splice(0);
  const edits = state.pendingEdits;
  state.pendingEdits = null;

  const thinking = addThinking();

  try {
    const res = await fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        virus: state.virus,
        world: state.world,
        daysElapsed,
        events,
        edits,
      }),
    });
    const data = await res.json();
    thinking.remove();

    if (!res.ok || data.error) {
      showError(data.error || `Server error ${res.status}`);
      // Put events back so they aren't lost.
      state.pendingEvents.unshift(...events);
      return;
    }

    applyResult(data, daysElapsed, events.length > 0);
  } catch (err) {
    thinking.remove();
    showError('Network error — could not reach the simulation engine.');
    state.pendingEvents.unshift(...events);
  } finally {
    state.busy = false;
    updateTimebarLabel();
  }
}

function applyResult(data, daysElapsed, fromEvent) {
  const w = data.world || {};
  state.world.day += daysElapsed;
  state.world.phase = w.phase || state.world.phase;
  state.world.totalCases = num(w.totalCases, state.world.totalCases);
  state.world.totalDeaths = num(w.totalDeaths, state.world.totalDeaths);
  state.world.r0 = num(w.r0, state.world.r0);
  if (Array.isArray(w.countries)) {
    state.world.countries = w.countries
      .filter((c) => c && c.name)
      .sort((a, b) => num(b.cases, 0) - num(a.cases, 0))
      .slice(0, 18);
  }

  const tags = (data.newCountries || []).filter(Boolean).map((c) => `🌍 ${c}`);
  const kind = fromEvent ? 'event' : (state.world.phase === 'Pandemic' || state.world.totalDeaths > 0 ? 'alert' : 'news');
  addNews({
    day: state.world.day,
    headline: data.headline || 'Situation update',
    report: data.report || '',
    tags,
  }, fromEvent ? 'event' : (kind === 'alert' ? 'alert' : 'news'));

  renderStats();
  renderWorld();
}

// ===================== RENDER: stats & countries =====================
function renderStats() {
  $('statDay').textContent = state.world.day;
  $('statCases').textContent = fmt(state.world.totalCases);
  $('statDeaths').textContent = fmt(state.world.totalDeaths);
  $('statCountries').textContent = state.world.countries.length;
  $('statR0').textContent = state.world.r0 ? state.world.r0.toFixed(1) : '—';
  const badge = $('phaseBadge');
  badge.textContent = state.world.phase;
}

const knownCountries = new Set();
function renderWorld() {
  const box = $('countries');
  if (!state.world.countries.length) {
    box.innerHTML = '<p class="muted empty">No confirmed cases yet…</p>';
    return;
  }
  box.innerHTML = '';
  for (const c of state.world.countries) {
    const isNew = !knownCountries.has(c.name);
    knownCountries.add(c.name);
    const el = document.createElement('div');
    el.className = 'country' + (isNew ? ' flash' : '');
    const status = (c.status || 'Spreading').replace(/[^A-Za-z]/g, '');
    el.innerHTML = `
      <div class="country-top">
        <span class="country-name">${esc(c.name)}</span>
        <span class="country-status s-${status}">${esc(c.status || 'Spreading')}</span>
      </div>
      <div class="country-nums">
        <span class="c">Cases <b>${fmt(c.cases)}</b></span>
        <span class="d">Deaths <b>${fmt(c.deaths)}</b></span>
      </div>`;
    box.appendChild(el);
  }
}

// ===================== RENDER: news feed =====================
function addNews({ day, headline, report, tags }, kind = 'news') {
  const feed = $('news');
  const el = document.createElement('div');
  el.className = `news-item ${kind}`;
  const tagHtml = (tags && tags.length)
    ? `<div class="news-tags">${tags.map((t) => `<span class="news-tag">${esc(t)}</span>`).join('')}</div>`
    : '';
  el.innerHTML = `
    <div class="news-meta">
      <span class="news-day">Day ${day}${kind === 'event' ? ' · Event' : ''}</span>
      <span class="news-time">${clockTime()}</span>
    </div>
    <div class="news-headline">${esc(headline)}</div>
    <div class="news-body">${esc(report)}</div>
    ${tagHtml}`;
  feed.prepend(el);
}

function addThinking() {
  const feed = $('news');
  const el = document.createElement('div');
  el.className = 'thinking';
  el.innerHTML = 'The newsroom is analyzing the outbreak<span class="dots"></span>';
  feed.prepend(el);
  return el;
}

function showError(msg) {
  const feed = $('news');
  const el = document.createElement('div');
  el.className = 'error-banner';
  el.textContent = '⚠ ' + msg;
  feed.prepend(el);
  setTimeout(() => el.remove(), 6000);
}

// ===================== utils =====================
function num(v, fallback) { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
function fmt(n) { return Number(n || 0).toLocaleString('en-US'); }
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function clockTime() {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
function flashGhost(btn, text) {
  const orig = btn.textContent;
  btn.textContent = text;
  setTimeout(() => (btn.textContent = orig), 1200);
}
