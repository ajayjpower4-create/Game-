const chatArea = document.getElementById('chatArea');
const messagesEl = document.getElementById('messages');
const input = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const newChatBtn = document.getElementById('newChatBtn');
const inputArea = document.getElementById('inputArea');

const setup = document.getElementById('setup');
const setupBtn = document.getElementById('setupBtn');
const setupCancel = document.getElementById('setupCancel');
const detailToggle = document.getElementById('detailToggle');
const detailFields = document.getElementById('detailFields');
const editCharBtn = document.getElementById('editCharBtn');

const statusEl = document.getElementById('status');
const statusRole = document.getElementById('statusRole');
const statusDay = document.getElementById('statusDay');

// Character fields: id -> profile key
const CHAR_FIELDS = {
  rankInput: 'rank',
  nameInput: 'name',
  yearsInput: 'years',
  subjectInput: 'subject',
  ageInput: 'age',
  baseInput: 'base',
  reputationInput: 'reputation',
  aboutInput: 'about',
};
// Human labels used when telling the AI about the character
const CHAR_LABELS = {
  years: 'Years working at Harford',
  subject: 'Subject / department',
  age: 'Age',
  base: 'Based in',
  reputation: 'Reputation',
  about: 'Background',
};

const STORAGE_KEY = 'harford-save-v1';

let history = [];
let isStreaming = false;
let day = 1;
let profile = { rank: '', name: '' };
let editingCharacter = false;

// Detect touch/phone devices: on these, the on-screen "return" key should NOT
// send the message (it inserts a newline instead — you send with the button).
const IS_MOBILE = (() => {
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  return iOS || /Android|Mobile/i.test(ua) || coarse;
})();

// ---- Persistence ----------------------------------------------------------
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile, day, history }));
  } catch {}
}

function clearState() {
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.profile || !data.profile.name || !Array.isArray(data.history)) return null;
    return data;
  } catch { return null; }
}

function restoreSavedGame(data) {
  profile = data.profile;
  day = data.day || 1;
  history = data.history;
  enterPlayMode();
  messagesEl.innerHTML = '';
  for (const m of history) {
    if (m.role === 'user' || m.role === 'assistant') appendMessage(m.role, m.content);
  }
  scrollToBottom();
}

function enterPlayMode() {
  setup.style.display = 'none';
  chatArea.hidden = false;
  inputArea.hidden = false;
  statusEl.hidden = false;
  editCharBtn.hidden = false;
  statusRole.textContent = `${profile.name} · ${profile.rank}`;
  statusDay.textContent = `Day ${day}`;
}

// ---- Character setup ------------------------------------------------------
detailToggle.addEventListener('click', () => {
  const open = !detailFields.hidden;
  detailFields.hidden = open;
  detailToggle.querySelector('.chev').textContent = open ? '▸' : '▾';
});

function openSetup({ edit } = { edit: false }) {
  editingCharacter = !!edit;
  for (const [id, key] of Object.entries(CHAR_FIELDS)) {
    const el = document.getElementById(id);
    if (el) el.value = profile[key] || '';
  }
  // Show the detail section straight away if any of it is already filled in.
  const hasDetail = Object.keys(CHAR_LABELS).some(k => profile[k]);
  detailFields.hidden = !hasDetail;
  detailToggle.querySelector('.chev').textContent = hasDetail ? '▾' : '▸';

  setupBtn.textContent = edit ? 'Save character' : 'Start the day';
  setupCancel.hidden = !edit;
  setup.style.display = 'flex';
  document.getElementById('rankInput').focus();
}

function readCharacterForm() {
  const p = {};
  for (const [id, key] of Object.entries(CHAR_FIELDS)) {
    const el = document.getElementById(id);
    p[key] = el ? el.value.trim() : '';
  }
  return p;
}

// A bracketed block of facts the AI must treat as true.
function characterFacts(p, { day: d } = {}) {
  const bits = [`I am ${p.name}, and my rank at Harford Secondary is ${p.rank}`];
  for (const [key, label] of Object.entries(CHAR_LABELS)) {
    if (p[key]) bits.push(`${label}: ${p[key]}`);
  }
  let text = `(${bits.join('. ')}. ` +
    `This role and every one of these details is an established fact at Harford — ` +
    `the post exists, it always has, and I hold it.`;
  if (d) {
    text += ` It is Day ${d}, the very start of the school day — students arriving / tutor time.)`;
  } else {
    text += ')';
  }
  return text;
}

setupBtn.addEventListener('click', submitSetup);
setupCancel.addEventListener('click', () => {
  if (profile.name) { setup.style.display = 'none'; editingCharacter = false; }
});
editCharBtn.addEventListener('click', () => openSetup({ edit: true }));

['rankInput', 'nameInput'].forEach(id => {
  document.getElementById(id).addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); submitSetup(); }
  });
});

function submitSetup() {
  const p = readCharacterForm();
  if (!p.rank) { document.getElementById('rankInput').focus(); return; }
  if (!p.name) { document.getElementById('nameInput').focus(); return; }

  if (editingCharacter) {
    profile = p;
    editingCharacter = false;
    setup.style.display = 'none';
    statusRole.textContent = `${p.name} · ${p.rank}`;
    saveState();
    // Tell the world about the change so characters stay consistent.
    const update = characterFacts(p) +
      ' *I carry on with my day.*';
    history.push({ role: 'user', content: update });
    appendMessage('user', update);
    saveState();
    streamAssistant();
    return;
  }

  profile = p;
  day = 1;
  history = [];
  messagesEl.innerHTML = '';
  enterPlayMode();

  const opener = characterFacts(p, { day: 1 }) +
    ' *I walk into the building to start my day.*';
  history.push({ role: 'user', content: opener });
  appendMessage('user', opener);
  saveState();
  streamAssistant();
  input.focus();
}

// ---- Input handling -------------------------------------------------------
input.addEventListener('input', () => {
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 200) + 'px';
  sendBtn.disabled = !input.value.trim() || isStreaming;
});

input.addEventListener('keydown', (e) => {
  // On phones/tablets the return key must never send — let it add a newline.
  if (IS_MOBILE) return;
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!sendBtn.disabled) sendMessage();
  }
});

sendBtn.addEventListener('click', sendMessage);
newChatBtn.addEventListener('click', resetToSetup);

document.querySelectorAll('.quick').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.action === 'lookup') { openLookup(); return; }
    if (isStreaming) return;
    if (btn.dataset.action === 'nextday') { input.value = '/nextday'; }
    else input.value = btn.dataset.text;
    input.dispatchEvent(new Event('input'));
    sendMessage();
  });
});

function resetToSetup() {
  clearState();
  history = [];
  messagesEl.innerHTML = '';
  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;
  isStreaming = false;
  chatArea.hidden = true;
  inputArea.hidden = true;
  statusEl.hidden = true;
  editCharBtn.hidden = true;
  day = 1;
  openSetup({ edit: false });
}

async function sendMessage() {
  let text = input.value.trim();
  if (!text || isStreaming) return;

  // /computerstudent — opens the student information system.
  const lookup = text.match(/^\/computerstudent\b\s*(.*)$/i);
  if (lookup) {
    input.value = '';
    input.style.height = 'auto';
    sendBtn.disabled = true;
    openLookup(lookup[1].trim());
    return;
  }

  // /nextday advances the school day and injects a clear day marker.
  if (/^\/nextday\b/i.test(text)) {
    day += 1;
    statusDay.textContent = `Day ${day}`;
    text =
      `(A new school day begins — this is Day ${day} at Harford Secondary. ` +
      `It is the very start of the day: 8:20am, students arriving, then tutor ` +
      `time and registration.) *I arrive at school to start Day ${day}.*`;
    appendDayDivider(day);
  }

  history.push({ role: 'user', content: text });
  appendMessage('user', text);

  input.value = '';
  input.style.height = 'auto';

  saveState();
  streamAssistant();
}

async function streamAssistant() {
  isStreaming = true;
  sendBtn.disabled = true;
  sendBtn.classList.add('loading');

  const { bubble, cursor } = createAssistantBubble();
  scrollToBottom();

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
      saveState();
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

/* =========================================================================
   Student Information System (interactive lookup)
   ========================================================================= */
const modal = document.getElementById('lookupModal');
const sisSearch = document.getElementById('sisSearch');
const sisResults = document.getElementById('sisResults');
const resultsCount = document.getElementById('resultsCount');
const filterPanel = document.getElementById('filterPanel');
const filtersToggle = document.getElementById('filtersToggle');
const filtersCount = document.getElementById('filtersCount');

let STUDENTS = null;      // loaded lazily on first open
let FACETS = null;
let indexPromise = null;
const RENDER_CAP = 150;

const F = {
  q: '', years: new Set(), grade: '', att: '', beh: new Set(),
  sen: '', flags: new Set(), best: '', weak: '', house: '', form: '', sort: 'name',
};

const GRADE_BANDS = {
  top:   { label: 'Top 7+',      test: g => g >= 7 },
  upper: { label: 'Upper 5–7',   test: g => g >= 5 && g < 7 },
  mid:   { label: 'Middle 3–5',  test: g => g >= 3 && g < 5 },
  low:   { label: 'Low under 3', test: g => g < 3 },
};
const ATT_BANDS = {
  low:  { label: 'Under 90%', test: a => a < 90 },
  mid:  { label: '90–95%',    test: a => a >= 90 && a < 95 },
  high: { label: '95%+',      test: a => a >= 95 },
};
const SEN_OPTS = {
  ehcp: { label: 'EHCP',        test: s => s.sen_status === 'EHCP' },
  k:    { label: 'SEN Support', test: s => s.sen_status === 'SEN Support (K)' },
  none: { label: 'No SEN',      test: s => !s.sen_status || s.sen_status === 'None' },
};
const FLAG_OPTS = {
  PP:   { label: 'Pupil Premium', test: s => s.pupil_premium === 'Yes' },
  EAL:  { label: 'EAL',           test: s => s.eal && s.eal !== 'No' },
  ATT:  { label: 'Att. concern',  test: s => s.attendance_concern === 'True' },
  EBSA: { label: 'EBSA',          test: s => s.emotionally_based_school_avoidance === 'True' },
};

function openLookup(prefill = '') {
  modal.hidden = false;
  document.body.classList.add('modal-open');
  if (prefill) { F.q = prefill; sisSearch.value = prefill; }
  loadIndex().then(() => { applyFilters(); if (!IS_MOBILE) sisSearch.focus(); });
}

function closeLookup() {
  modal.hidden = true;
  document.body.classList.remove('modal-open');
}

document.getElementById('lookupClose').addEventListener('click', closeLookup);
modal.addEventListener('click', e => { if (e.target === modal) closeLookup(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !modal.hidden) closeLookup();
});

filtersToggle.addEventListener('click', () => {
  const open = !filterPanel.hidden;
  filterPanel.hidden = open;
  filtersToggle.querySelector('.chev').textContent = open ? '▸' : '▾';
});

function loadIndex() {
  if (indexPromise) return indexPromise;
  resultsCount.textContent = 'Loading student records…';
  indexPromise = fetch('/api/students/index')
    .then(r => { if (!r.ok) throw new Error(`Server error: ${r.status}`); return r.json(); })
    .then(data => {
      // Rows arrive as arrays against a shared field list — zip them up.
      const f = data.fields;
      STUDENTS = data.rows.map(row => {
        const o = {};
        f.forEach((key, i) => { o[key] = row[i]; });
        o._grade = parseFloat(o.avg_working_grade) || 0;
        o._att = parseFloat(o.attendance_pct) || 0;
        o._beh = parseInt(o.behaviour_points, 10) || 0;
        o._search = `${o.name} ${o.id} ${o.form} ${o.house}`.toLowerCase();
        return o;
      });
      FACETS = data.facets;
      buildFilterUI();
    })
    .catch(err => {
      resultsCount.textContent = '';
      sisResults.innerHTML = `<div class="error-msg">Couldn't load student records: ${escapeHtml(err.message)}</div>`;
      indexPromise = null;
    });
  return indexPromise;
}

function chipRow(container, options, isActive, onToggle) {
  container.innerHTML = '';
  for (const { value, label } of options) {
    const b = document.createElement('button');
    b.className = 'chip' + (isActive(value) ? ' on' : '');
    b.textContent = label;
    b.addEventListener('click', () => { onToggle(value); refreshChips(); applyFilters(); });
    container.appendChild(b);
  }
}

function fillSelect(sel, values, anyLabel) {
  sel.innerHTML = `<option value="">${anyLabel}</option>` +
    values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
}

let chipsBuilt = false;
function buildFilterUI() {
  if (chipsBuilt) return;
  chipsBuilt = true;
  fillSelect(document.getElementById('fBest'), FACETS.subjects, 'Any subject');
  fillSelect(document.getElementById('fWeak'), FACETS.subjects, 'Any subject');
  fillSelect(document.getElementById('fHouse'), FACETS.houses, 'Any house');
  fillSelect(document.getElementById('fForm'), FACETS.forms, 'Any form');

  const bind = (id, key) => document.getElementById(id).addEventListener('change', e => {
    F[key] = e.target.value; applyFilters();
  });
  bind('fBest', 'best'); bind('fWeak', 'weak'); bind('fHouse', 'house'); bind('fForm', 'form');
  document.getElementById('fSort').addEventListener('change', e => { F.sort = e.target.value; applyFilters(); });

  refreshChips();
}

function refreshChips() {
  chipRow(document.getElementById('fYear'),
    FACETS.years.map(y => ({ value: y, label: `Year ${y}` })),
    v => F.years.has(v),
    v => { F.years.has(v) ? F.years.delete(v) : F.years.add(v); });

  chipRow(document.getElementById('fGrade'),
    Object.entries(GRADE_BANDS).map(([value, b]) => ({ value, label: b.label })),
    v => F.grade === v,
    v => { F.grade = F.grade === v ? '' : v; });

  chipRow(document.getElementById('fAtt'),
    Object.entries(ATT_BANDS).map(([value, b]) => ({ value, label: b.label })),
    v => F.att === v,
    v => { F.att = F.att === v ? '' : v; });

  chipRow(document.getElementById('fBeh'),
    FACETS.behaviour_tiers.map(t => ({ value: t, label: t })),
    v => F.beh.has(v),
    v => { F.beh.has(v) ? F.beh.delete(v) : F.beh.add(v); });

  chipRow(document.getElementById('fSen'),
    Object.entries(SEN_OPTS).map(([value, o]) => ({ value, label: o.label })),
    v => F.sen === v,
    v => { F.sen = F.sen === v ? '' : v; });

  chipRow(document.getElementById('fFlags'),
    Object.entries(FLAG_OPTS).map(([value, o]) => ({ value, label: o.label })),
    v => F.flags.has(v),
    v => { F.flags.has(v) ? F.flags.delete(v) : F.flags.add(v); });
}

let searchTimer;
sisSearch.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { F.q = sisSearch.value.trim().toLowerCase(); applyFilters(); }, 120);
});

document.getElementById('clearFilters').addEventListener('click', () => {
  F.q = ''; F.years.clear(); F.grade = ''; F.att = ''; F.beh.clear();
  F.sen = ''; F.flags.clear(); F.best = ''; F.weak = ''; F.house = ''; F.form = '';
  sisSearch.value = '';
  ['fBest', 'fWeak', 'fHouse', 'fForm'].forEach(id => { document.getElementById(id).value = ''; });
  refreshChips();
  applyFilters();
});

document.querySelectorAll('.preset').forEach(btn => {
  btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
});

function applyPreset(name) {
  document.getElementById('clearFilters').click();
  const presets = {
    top:        () => { F.grade = 'top'; },
    y11maths:   () => { F.years.add('11'); F.best = 'Maths'; F.grade = 'top'; F.sort = 'grade_desc'; },
    attendance: () => { F.att = 'low'; F.sort = 'att_asc'; },
    send:       () => { F.sen = 'ehcp'; },
    behaviour:  () => { F.beh.add('poor'); F.sort = 'beh_desc'; },
    pp:         () => { F.flags.add('PP'); },
  };
  (presets[name] || (() => {}))();
  document.getElementById('fBest').value = F.best;
  document.getElementById('fSort').value = F.sort;
  if (filterPanel.hidden) filtersToggle.click();
  refreshChips();
  applyFilters();
}

function activeFilterCount() {
  return F.years.size + F.beh.size + F.flags.size +
    (F.grade ? 1 : 0) + (F.att ? 1 : 0) + (F.sen ? 1 : 0) +
    (F.best ? 1 : 0) + (F.weak ? 1 : 0) + (F.house ? 1 : 0) + (F.form ? 1 : 0);
}

function matches(s) {
  if (F.q && !s._search.includes(F.q)) return false;
  if (F.years.size && !F.years.has(s.year)) return false;
  if (F.grade && !GRADE_BANDS[F.grade].test(s._grade)) return false;
  if (F.att && !ATT_BANDS[F.att].test(s._att)) return false;
  if (F.beh.size && !F.beh.has(s.behaviour_tier)) return false;
  if (F.sen && !SEN_OPTS[F.sen].test(s)) return false;
  for (const flag of F.flags) if (!FLAG_OPTS[flag].test(s)) return false;
  if (F.best && s.best_subject !== F.best) return false;
  if (F.weak && s.weakest_subject !== F.weak) return false;
  if (F.house && s.house !== F.house) return false;
  if (F.form && s.form !== F.form) return false;
  return true;
}

const SORTERS = {
  name: (a, b) => a.name.localeCompare(b.name),
  grade_desc: (a, b) => b._grade - a._grade,
  grade_asc: (a, b) => a._grade - b._grade,
  att_asc: (a, b) => a._att - b._att,
  beh_desc: (a, b) => b._beh - a._beh,
  year: (a, b) => (+a.year - +b.year) || a.form.localeCompare(b.form) || a.name.localeCompare(b.name),
};

function applyFilters() {
  if (!STUDENTS) return;
  const n = activeFilterCount();
  filtersCount.hidden = n === 0;
  filtersCount.textContent = n;

  const found = STUDENTS.filter(matches).sort(SORTERS[F.sort] || SORTERS.name);
  const shown = found.slice(0, RENDER_CAP);

  resultsCount.textContent = found.length === 0
    ? 'No students match'
    : `${found.length} student${found.length === 1 ? '' : 's'}` +
      (found.length > shown.length ? ` — showing first ${shown.length}` : '');

  if (!found.length) {
    sisResults.innerHTML = `<p class="sis-empty">Nothing matches those filters. Try clearing a few.</p>`;
    return;
  }

  sisResults.innerHTML = shown.map(rowHtml).join('');
  sisResults.querySelectorAll('.sis-row').forEach(row => {
    row.addEventListener('click', () => toggleRecord(row, row.dataset.id));
  });
}

function badges(s) {
  const out = [];
  if (s.sen_status && s.sen_status !== 'None') out.push(`<span class="badge sen">${escapeHtml(s.sen_status)}</span>`);
  if (s.pupil_premium === 'Yes') out.push('<span class="badge">PP</span>');
  if (s.eal && s.eal !== 'No') out.push('<span class="badge">EAL</span>');
  if (s.attendance_concern === 'True') out.push('<span class="badge warn">Att</span>');
  if (s.emotionally_based_school_avoidance === 'True') out.push('<span class="badge warn">EBSA</span>');
  return out.join('');
}

function rowHtml(s) {
  const attClass = s._att < 90 ? 'bad' : s._att < 95 ? 'mid' : 'good';
  const behClass = s.behaviour_tier === 'poor' ? 'bad'
    : s.behaviour_tier === 'mixed' ? 'mid'
    : s.behaviour_tier === 'good' ? 'good' : '';
  return `
    <div class="sis-row" data-id="${escapeHtml(s.id)}">
      <div class="row-main">
        <div class="row-name">${escapeHtml(s.name)}</div>
        <div class="row-meta">Y${escapeHtml(s.year)} · ${escapeHtml(s.form)} · ${escapeHtml(s.house)} · ${escapeHtml(s.id)}</div>
        <div class="row-badges">${badges(s)}</div>
      </div>
      <div class="row-stats">
        <span class="stat"><em>Grade</em>${escapeHtml(s.avg_working_grade)}</span>
        <span class="stat ${attClass}"><em>Att</em>${escapeHtml(s.attendance_pct)}%</span>
        <span class="stat ${behClass}"><em>Beh</em>${escapeHtml(s.behaviour_points)}</span>
      </div>
      <div class="row-detail" hidden></div>
    </div>`;
}

async function toggleRecord(row, id) {
  const panel = row.querySelector('.row-detail');
  if (!panel.hidden) { panel.hidden = true; row.classList.remove('open'); return; }
  row.classList.add('open');
  panel.hidden = false;
  if (panel.dataset.loaded) return;

  panel.innerHTML = '<p class="sis-empty">Opening record…</p>';
  try {
    const res = await fetch(`/api/student?q=${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    const data = await res.json();
    const s = data.results && data.results[0];
    if (!s) { panel.innerHTML = '<p class="sis-empty">Record not found.</p>'; return; }
    panel.innerHTML = recordHtml(s);
    panel.dataset.loaded = '1';
    panel.querySelector('.bring-btn').addEventListener('click', e => {
      e.stopPropagation();
      bringIntoScene(s);
    });
  } catch (err) {
    panel.innerHTML = `<div class="error-msg">${escapeHtml(err.message)}</div>`;
  }
}

function field(label, value) {
  if (value === undefined || value === null || value === '' || value === 'None') return '';
  return `<div class="sis-field"><span class="sis-k">${label}</span><span class="sis-v">${escapeHtml(String(value))}</span></div>`;
}

function recordHtml(s) {
  const grid = [
    field('Tutor', s.tutor),
    field('DOB', `${s.dob} (age ${s.age_sept})`),
    field('Heritage', s.heritage),
    field('Home language', s.home_language),
    field('Reading age', s.reading_age),
    field('Best subject', s.best_subject),
    field('Weakest subject', s.weakest_subject),
    field('Attendance', `${s.attendance_pct}% · ${s.lates_this_term} lates`),
    field('Behaviour', `${s.behaviour_points} pts · ${s.detentions} detentions · ${s.suspensions} susp.`),
    field('SEN', s.sen_status && s.sen_status !== 'None'
      ? `${s.sen_status}${s.sen_primary_need ? ' — ' + s.sen_primary_need : ''}` : ''),
  ].filter(Boolean).join('');

  return `
    <div class="sis-grid">${grid}</div>
    ${s.description ? `<div class="sis-notes"><span class="sis-k">Notes</span>${escapeHtml(s.description)}</div>` : ''}
    <button class="bring-btn" type="button">📣 Call ${escapeHtml(s.name.split(' ')[0])} into the scene</button>`;
}

function bringIntoScene(s) {
  closeLookup();
  const text = `*I send for ${s.name} (Year ${s.year}, ${s.form}) and have them come to me.*`;
  input.value = text;
  input.dispatchEvent(new Event('input'));
  input.focus();
}

/* ===================== chat rendering helpers ============================ */
function appendDayDivider(n) {
  const div = document.createElement('div');
  div.className = 'day-divider';
  div.innerHTML = `<span>Day ${n}</span>`;
  messagesEl.appendChild(div);
}

function appendMessage(role, content) {
  const div = document.createElement('div');
  div.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = role === 'user' ? '🧑‍🏫' : '🏫';

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
  avatar.textContent = '🏫';

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
  return String(str)
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

// ---- Boot: restore a saved game if one exists -----------------------------
(function init() {
  const saved = loadState();
  if (saved) restoreSavedGame(saved);
  else openSetup({ edit: false });
})();
