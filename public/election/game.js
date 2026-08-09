// Political Election Simulator — screen flow, save system and rendering.

import {
  STATES, STATE_BY_CODE, STATE_CODES, THEMES, THEME_BY_ID, FAMOUS, PARTY_COLORS,
  TOTAL_EV, EV_TO_WIN, fmtNum, fmtDate, addDays, daysBetween, todayIso,
} from './data.js';
import {
  simulateElection, applyAiResult, scoreCampaign, buildStateVotes, buildResult,
  candidateRatings, messageStrength, effectiveAxis, projectFromAssignment, localNarrative,
} from './sim.js';

/* ============================================================ tiny DOM kit */

function h(tag, props, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'value' || k === 'checked' || k === 'disabled') node[k] = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  return add(node, ...kids);
}

// Appending skips nulls, so `condition ? node : null` never prints "null".
function add(node, ...kids) {
  for (const kid of kids.flat(3)) {
    if (kid == null || kid === false || kid === '') continue;
    node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

const $ = (sel) => document.querySelector(sel);
const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); return node; };
const paint = (node, ...kids) => add(clear(node), ...kids);

/* =============================================================== save data */

const SAVE_KEY = 'pes_save_v1';
const MAX_CHECKPOINTS = 8;

function readStore() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(store));
    return true;
  } catch (err) {
    flashSave('Save failed — storage is full or blocked', true);
    console.warn('Save failed', err);
    return false;
  }
}

let saveTimer = null;

// `checkpoint` is set when the player moves to a new step, so a crash never
// costs more than the step they were in the middle of.
function save({ checkpoint = false } = {}) {
  clearTimeout(saveTimer);
  game.updatedAt = new Date().toISOString();
  const store = readStore() || { checkpoints: [] };
  store.game = game;
  if (checkpoint) {
    store.checkpoints = [
      { phase: game.phase, at: game.updatedAt, game: structuredClone(game) },
      ...(store.checkpoints || []).filter((c) => c.phase !== game.phase),
    ].slice(0, MAX_CHECKPOINTS);
  }
  if (writeStore(store)) {
    flashSave(checkpoint ? `Checkpoint saved · ${stepLabel(game.phase)}` : 'Saved');
  }
}

// Debounced autosave for ordinary typing.
function touch() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => save(), 600);
}

let flashTimer = null;
function flashSave(text, isError = false) {
  const el = $('#save-status');
  el.textContent = (isError ? '⚠ ' : '✓ ') + text;
  el.classList.toggle('is-error', isError);
  el.classList.add('is-visible');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => el.classList.remove('is-visible'), 2600);
}

/* ============================================================== game state */

const STEPS = [
  { id: 'candidates', label: 'Candidates' },
  { id: 'rallies', label: 'Rallies' },
  { id: 'message', label: 'Message' },
  { id: 'electionday', label: 'Election day' },
  { id: 'recap', label: 'Recap' },
];

const stepIndex = (phase) => STEPS.findIndex((s) => s.id === phase);
const stepLabel = (phase) => (STEPS.find((s) => s.id === phase) || {}).label || phase;

function blankCandidate(i) {
  return {
    kind: 'famous',
    name: '',
    role: '',
    description: '',
    famous: true,
    star: 70,
    axis: 0,
    party: i === 0 ? 'Independent' : 'The People\'s Ticket',
    color: PARTY_COLORS[i === 0 ? 0 : 1],
    rallies: [],
    slogan: '',
    message: '',
    themes: [],
  };
}

function newGame() {
  const electionDate = addDays(todayIso(), 92);
  return {
    v: 1,
    id: (crypto.randomUUID && crypto.randomUUID()) || `g${Date.now()}`,
    phase: 'candidates',
    visited: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    electionDate,
    campaignStart: addDays(electionDate, -90),
    candidates: { a: blankCandidate(0), b: blankCandidate(1) },
    mode: null,
    rigged: { assignment: {}, votes: { a: null, b: null } },
    result: null,
  };
}

let game = newGame();

const nameOf = (side) => game.candidates[side].name || (side === 'a' ? 'Candidate A' : 'Candidate B');

/* ================================================================= routing */

function show(phase) {
  game.phase = phase;
  const idx = stepIndex(phase);
  if (idx >= 0) game.visited = Math.max(game.visited || 0, idx);

  for (const sec of document.querySelectorAll('.screen')) {
    sec.hidden = sec.dataset.screen !== phase;
  }
  renderSteps();
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (phase === 'candidates') renderCandidates();
  if (phase === 'rallies') renderRallies();
  if (phase === 'message') renderMessage();
  if (phase === 'electionday') renderElectionDay();
  if (phase === 'rigged') renderRigged();
  if (phase === 'recap') renderRecap();
}

// Move to a new step and checkpoint on the way in.
function goto(phase) {
  show(phase);
  save({ checkpoint: true });
}

function renderSteps() {
  const nav = clear($('#steps'));
  if (game.phase === 'start') { nav.hidden = true; return; }
  nav.hidden = false;
  const current = stepIndex(game.phase === 'rigged' || game.phase === 'simulating' ? 'electionday' : game.phase);
  STEPS.forEach((step, i) => {
    const reachable = i <= (game.visited || 0);
    nav.append(h('button', {
      class: `step${i === current ? ' is-current' : ''}${i < current ? ' is-done' : ''}`,
      type: 'button',
      disabled: !reachable,
      onclick: () => reachable && show(step.id === 'recap' && !game.result ? 'electionday' : step.id),
    }, h('span', { class: 'step-num' }, i + 1), step.label));
  });
}

/* ============================================================== Step 1 UI */

function renderCandidates() {
  const wrap = clear($('#candidate-forms'));
  wrap.append(candidateForm('a'), candidateForm('b'));

  const dateInput = $('#election-date');
  dateInput.value = game.electionDate;
  dateInput.min = addDays(todayIso(), 1);
  dateInput.onchange = () => {
    if (!dateInput.value) { dateInput.value = game.electionDate; return; }
    game.electionDate = dateInput.value;
    game.campaignStart = addDays(game.electionDate, -90);
    clampRallies();
    updateWindowHint();
    touch();
  };
  updateWindowHint();
  $('#candidates-error').textContent = '';
}

function updateWindowHint() {
  $('#window-hint').textContent =
    `Campaign window: ${fmtDate(game.campaignStart)} → ${fmtDate(game.electionDate)} (90 days of rallies).`;
}

// Keep every booked rally inside the campaign window if the date moves.
function clampRallies() {
  const first = game.campaignStart;
  const last = addDays(game.electionDate, -1);
  let moved = 0;
  for (const side of ['a', 'b']) {
    for (const r of game.candidates[side].rallies) {
      if (r.date < first) { r.date = first; moved++; }
      else if (r.date > last) { r.date = last; moved++; }
    }
  }
  if (moved) flashSave(`${moved} rall${moved === 1 ? 'y' : 'ies'} moved into the new window`);
}

function candidateForm(side) {
  const c = game.candidates[side];
  const readout = h('div', { class: 'readout' });

  const refresh = () => {
    const r = candidateRatings(c);
    // Message strength belongs to step 3 — here it would only read as broken.
    paint(readout,
      meter('Name recognition', r.star),
      h('p', { class: 'axis-line' },
        'Public read: ', h('strong', {}, axisLabel(effectiveAxis(c)))),
    );
  };

  const nameInput = h('input', {
    type: 'text', value: c.name, placeholder: side === 'a' ? 'e.g. Charlie Kirk' : 'e.g. Taylor Swift',
    oninput: (e) => { c.name = e.target.value; syncFamousPreset(c); refresh(); touch(); },
  });

  const roleInput = h('input', {
    type: 'text', value: c.role, placeholder: 'What are they known for?',
    oninput: (e) => { c.role = e.target.value; touch(); },
  });

  const descBox = h('textarea', {
    rows: 5,
    placeholder: c.kind === 'famous'
      ? 'Optional — anything the public should already believe about them.'
      : 'Who are they? Where are they from, what do they do, why would anyone vote for them? The more you write, the more the model has to work with.',
    oninput: (e) => { c.description = e.target.value; refresh(); touch(); },
  });
  descBox.value = c.description;

  const famousPicker = h('select', {
    onchange: (e) => {
      const pick = FAMOUS.find((f) => f.name === e.target.value);
      if (!pick) return;
      c.name = pick.name;
      c.role = pick.role;
      c.star = pick.star;
      c.axis = pick.axis;
      c.famous = true;
      nameInput.value = pick.name;
      roleInput.value = pick.role;
      refresh();
      touch();
    },
  },
  h('option', { value: '' }, 'Pick from the roster…'),
  FAMOUS.map((f) => h('option', { value: f.name, selected: f.name === c.name }, `${f.name} — ${f.role}`)));

  const kindRow = h('div', { class: 'pill-row' }, ['famous', 'custom'].map((kind) => h('button', {
    type: 'button',
    class: `pill${c.kind === kind ? ' is-on' : ''}`,
    onclick: () => {
      c.kind = kind;
      c.famous = kind === 'famous';
      renderCandidates();
      touch();
    },
  }, kind === 'famous' ? 'Famous person' : 'Someone I made up')));

  const card = h('div', { class: 'card candidate-card', style: `--accent:${c.color}` },
    h('div', { class: 'card-head' },
      h('span', { class: 'swatch', style: `background:${c.color}` }),
      h('h3', {}, side === 'a' ? 'Candidate A' : 'Candidate B')),
    kindRow,
    c.kind === 'famous' ? field('Draft someone', famousPicker) : null,
    field('Name', nameInput),
    field(c.kind === 'famous' ? 'Known for' : 'Title / occupation', roleInput),
    field(c.kind === 'famous' ? 'Notes (optional)' : 'Description (required)', descBox),
    c.kind === 'famous'
      ? h('p', { class: 'hint' }, 'Famous names come pre-loaded — no description needed.')
      : h('p', { class: 'hint' }, 'Unknowns need at least 40 characters. Words like "veteran", "billionaire", "activist" or "conservative" shape how they poll.'),
    field('Party / ticket', h('input', {
      type: 'text', value: c.party,
      oninput: (e) => { c.party = e.target.value; touch(); },
    })),
    h('div', { class: 'field' },
      h('label', {}, 'Colour'),
      h('div', { class: 'color-row' }, PARTY_COLORS.map((col) => h('button', {
        type: 'button',
        class: `color-dot${c.color === col ? ' is-on' : ''}`,
        style: `background:${col}`,
        'aria-label': col,
        onclick: () => { c.color = col; renderCandidates(); touch(); },
      })))),
    readout,
  );

  refresh();
  return card;
}

// Typing a roster name by hand should still pull in their stats.
function syncFamousPreset(c) {
  if (c.kind !== 'famous') return;
  const pick = FAMOUS.find((f) => f.name.toLowerCase() === (c.name || '').trim().toLowerCase());
  if (pick) {
    c.star = pick.star;
    c.axis = pick.axis;
    if (!c.role) c.role = pick.role;
  } else {
    c.star = 70;
    c.axis = 0;
  }
}

function field(label, control) {
  return h('div', { class: 'field' }, h('label', {}, label), control);
}

function meter(label, value01) {
  const pct = Math.round(value01 * 100);
  return h('div', { class: 'meter' },
    h('div', { class: 'meter-top' }, h('span', {}, label), h('span', {}, `${pct}`)),
    h('div', { class: 'meter-track' }, h('div', { class: 'meter-fill', style: `width:${pct}%` })));
}

function axisLabel(axis) {
  if (axis <= -0.6) return 'hard traditionalist';
  if (axis <= -0.25) return 'leans conservative';
  if (axis < 0.25) return 'hard to place — a true independent';
  if (axis < 0.6) return 'leans progressive';
  return 'firmly progressive';
}

function validateCandidates() {
  const problems = [];
  for (const side of ['a', 'b']) {
    const c = game.candidates[side];
    const who = side === 'a' ? 'Candidate A' : 'Candidate B';
    if (!c.name.trim()) problems.push(`${who} needs a name.`);
    if (c.kind === 'custom' && c.description.trim().length < 40) {
      problems.push(`${who} is made up, so they need a description of at least 40 characters.`);
    }
  }
  const a = game.candidates.a.name.trim().toLowerCase();
  const b = game.candidates.b.name.trim().toLowerCase();
  if (a && a === b) problems.push('The two candidates need different names.');
  if (daysBetween(todayIso(), game.electionDate) < 1) problems.push('Election day has to be in the future.');
  return problems;
}

/* ============================================================== Step 2 UI */

function renderRallies() {
  const wrap = clear($('#rally-panels'));
  wrap.append(rallyPanel('a'), rallyPanel('b'));
  $('#rallies-error').textContent = '';
}

function rallyPanel(side) {
  const c = game.candidates[side];
  const first = game.campaignStart;
  const last = addDays(game.electionDate, -1);

  const dateInput = h('input', { type: 'date', min: first, max: last, value: suggestDate(c) });
  const stateSelect = h('select', {},
    h('option', { value: '' }, 'Choose a state…'),
    [...STATES].sort((x, y) => x.name.localeCompare(y.name))
      .map((s) => h('option', { value: s.code }, `${s.name} (${s.ev} EV)`)));
  const noteInput = h('input', { type: 'text', placeholder: 'What happens at this rally? (optional)' });
  const err = h('p', { class: 'error-line' });

  const addRally = () => {
    err.textContent = '';
    if (!dateInput.value || !stateSelect.value) { err.textContent = 'Pick a date and a state.'; return; }
    if (dateInput.value < first || dateInput.value > last) {
      err.textContent = `That date is outside the campaign window (${fmtDate(first)} – ${fmtDate(last)}).`;
      return;
    }
    if (c.rallies.some((r) => r.date === dateInput.value)) {
      err.textContent = `${nameOf(side)} is already booked on ${fmtDate(dateInput.value)}.`;
      return;
    }
    c.rallies.push({ date: dateInput.value, state: stateSelect.value, note: noteInput.value.trim() });
    c.rallies.sort((x, y) => x.date.localeCompare(y.date));
    noteInput.value = '';
    renderRallies();
    touch();
  };

  const list = h('ol', { class: 'rally-list' });
  if (!c.rallies.length) {
    list.append(h('li', { class: 'empty' }, 'No rallies booked yet. Three months is a long time to sit still.'));
  } else {
    let lastMonth = '';
    for (const [i, r] of c.rallies.entries()) {
      const month = r.date.slice(0, 7);
      if (month !== lastMonth) {
        lastMonth = month;
        list.append(h('li', { class: 'month-divider' }, monthLabel(month)));
      }
      const st = STATE_BY_CODE[r.state];
      list.append(h('li', { class: 'rally-item' },
        h('div', { class: 'rally-main' },
          h('span', { class: 'rally-date' }, fmtDate(r.date)),
          h('span', { class: 'rally-state' }, st ? `${st.name} · ${st.ev} EV` : r.state),
          r.note ? h('span', { class: 'rally-note' }, `"${r.note}"`) : null),
        h('button', {
          class: 'x-btn', type: 'button', 'aria-label': 'Remove rally',
          onclick: () => { c.rallies.splice(i, 1); renderRallies(); touch(); },
        }, '×')));
    }
  }

  const stops = new Set(c.rallies.map((r) => r.state));
  const evCovered = [...stops].reduce((n, code) => n + (STATE_BY_CODE[code]?.ev || 0), 0);

  return h('div', { class: 'card rally-card', style: `--accent:${c.color}` },
    h('div', { class: 'card-head' },
      h('span', { class: 'swatch', style: `background:${c.color}` }),
      h('h3', {}, nameOf(side)),
      h('span', { class: 'tag' }, `${c.rallies.length} stops`)),
    h('p', { class: 'hint' }, `Reaching ${stops.size} states · ${evCovered} electoral votes on the trail.`),
    h('div', { class: 'rally-form' },
      field('Date', dateInput),
      field('State', stateSelect),
      field('Rally note', noteInput),
      h('button', { class: 'primary-btn', type: 'button', onclick: addRally }, 'Book rally')),
    err,
    h('div', { class: 'row-actions' },
      h('button', { class: 'ghost-btn', type: 'button', onclick: () => { autoSchedule(side); renderRallies(); touch(); } }, 'Auto-schedule 8 stops'),
      c.rallies.length
        ? h('button', { class: 'ghost-btn danger', type: 'button', onclick: () => { c.rallies = []; renderRallies(); touch(); } }, 'Clear schedule')
        : null),
    list);
}

function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function suggestDate(c) {
  const first = game.campaignStart;
  const last = addDays(game.electionDate, -1);
  if (!c.rallies.length) return addDays(first, 3);
  const latest = c.rallies[c.rallies.length - 1].date;
  const next = addDays(latest, 7);
  return next > last ? last : next;
}

// Spreads eight stops evenly across the window, aimed at the states worth most.
function autoSchedule(side) {
  const c = game.candidates[side];
  const span = daysBetween(game.campaignStart, game.electionDate);
  const targets = [...STATES].sort((x, y) => y.ev - x.ev).slice(0, 14);
  const taken = new Set(c.rallies.map((r) => r.date));
  const picks = [];
  for (let i = 0; i < 8; i++) {
    const st = targets[(i * (side === 'a' ? 1 : 3) + (side === 'a' ? 0 : 1)) % targets.length];
    let date = addDays(game.campaignStart, Math.round((i + 0.5) * (span - 2) / 8));
    while (taken.has(date)) date = addDays(date, 1);
    taken.add(date);
    picks.push({ date, state: st.code, note: '' });
  }
  c.rallies = [...c.rallies, ...picks].sort((x, y) => x.date.localeCompare(y.date));
}

/* ============================================================== Step 3 UI */

function renderMessage() {
  const wrap = clear($('#message-panels'));
  wrap.append(messagePanel('a'), messagePanel('b'));
  $('#message-error').textContent = '';
}

function messagePanel(side) {
  const c = game.candidates[side];
  const readout = h('div', { class: 'readout' });
  const refresh = () => {
    paint(readout,
      meter('Message strength', messageStrength(c)),
      h('p', { class: 'axis-line' }, 'With this message they read as ', h('strong', {}, axisLabel(effectiveAxis(c))), '.'),
      c.themes.length > 3 ? h('p', { class: 'warn-line' }, 'More than three themes and the message starts to blur.') : null,
    );
  };

  const msgBox = h('textarea', {
    rows: 5,
    placeholder: 'The core of every stump speech. What do they promise the crowd?',
    oninput: (e) => { c.message = e.target.value; refresh(); touch(); },
  });
  msgBox.value = c.message;

  const themeGrid = h('div', { class: 'theme-grid' }, THEMES.map((t) => h('button', {
    type: 'button',
    class: `theme-chip${c.themes.includes(t.id) ? ' is-on' : ''}`,
    onclick: () => {
      const at = c.themes.indexOf(t.id);
      if (at >= 0) c.themes.splice(at, 1);
      else if (c.themes.length < 5) c.themes.push(t.id);
      renderMessage();
      touch();
    },
  }, t.label)));

  const card = h('div', { class: 'card', style: `--accent:${c.color}` },
    h('div', { class: 'card-head' },
      h('span', { class: 'swatch', style: `background:${c.color}` }),
      h('h3', {}, nameOf(side)),
      h('span', { class: 'tag' }, `${c.rallies.length} rallies`)),
    field('The line they close on', h('input', {
      type: 'text', value: c.slogan, maxlength: 70,
      placeholder: 'e.g. "Turn the lights back on."',
      oninput: (e) => { c.slogan = e.target.value; refresh(); touch(); },
    })),
    field('Main thing they say at every rally', msgBox),
    h('div', { class: 'field' },
      h('label', {}, `Themes they hammer (${c.themes.length}/5)`),
      themeGrid),
    readout);

  refresh();
  return card;
}

function validateMessage() {
  const problems = [];
  for (const side of ['a', 'b']) {
    const c = game.candidates[side];
    if (c.message.trim().length < 15) problems.push(`${nameOf(side)} needs a stump speech of at least 15 characters.`);
    if (!c.themes.length) problems.push(`${nameOf(side)} needs at least one theme.`);
  }
  return problems;
}

/* ============================================================== Step 4 UI */

function renderElectionDay() {
  const days = daysBetween(todayIso(), game.electionDate);
  $('#electionday-sub').textContent =
    `${fmtDate(game.electionDate)} — ${nameOf('a')} vs ${nameOf('b')}. `
    + `${game.candidates.a.rallies.length + game.candidates.b.rallies.length} rallies behind them`
    + `${days > 0 ? `, ${days} days out` : ''}. How does this end?`;
}

/* ================================================================ the map */

function renderMap(container, { assignment, interactive = false, onPick = null, votes = null }) {
  const grid = clear(container);
  grid.className = 'map';
  const board = h('div', { class: 'map-grid' });

  for (const st of STATES) {
    const side = assignment[st.code];
    const color = side ? game.candidates[side].color : null;
    const v = votes ? votes[st.code] : null;
    const title = [
      `${st.name} — ${st.ev} EV`,
      side ? `Called for ${nameOf(side)}` : 'Not called',
      v ? `${nameOf('a')} ${fmtNum(v.a)} · ${nameOf('b')} ${fmtNum(v.b)}` : `~${fmtNum(st.pop * 1000)} votes cast`,
    ].join('\n');

    const cell = h(interactive ? 'button' : 'div', {
      class: `state${side ? ' is-called' : ''}`,
      type: interactive ? 'button' : null,
      style: `grid-row:${st.row + 1};grid-column:${st.col + 1}${color ? `;--fill:${color}` : ''}`,
      title,
      'aria-label': title.replace(/\n/g, ', '),
      onclick: interactive && onPick ? () => onPick(st.code) : null,
    },
    h('span', { class: 'state-code' }, st.code),
    h('span', { class: 'state-ev' }, st.ev));
    board.append(cell);
  }
  grid.append(board);
  return grid;
}

function evBar(container, ev) {
  const total = TOTAL_EV;
  const bar = clear(container);
  bar.className = 'ev-bar';
  const unassigned = total - ev.a - ev.b;
  bar.append(
    h('div', { class: 'ev-numbers' },
      h('span', { class: 'ev-side', style: `color:${game.candidates.a.color}` },
        h('strong', {}, ev.a), ' ', nameOf('a')),
      h('span', { class: 'ev-mid' }, `${EV_TO_WIN} to win`),
      h('span', { class: 'ev-side right', style: `color:${game.candidates.b.color}` },
        nameOf('b'), ' ', h('strong', {}, ev.b))),
    h('div', { class: 'ev-track' },
      h('div', { class: 'ev-fill', style: `width:${ev.a / total * 100}%;background:${game.candidates.a.color}` }),
      h('div', { class: 'ev-fill neutral', style: `width:${unassigned / total * 100}%` }),
      h('div', { class: 'ev-fill', style: `width:${ev.b / total * 100}%;background:${game.candidates.b.color}` }),
      h('div', { class: 'ev-marker' })),
  );
  return bar;
}

/* ============================================================ Step 5 · rig */

function renderRigged() {
  const assignment = game.rigged.assignment;

  const cycle = (code) => {
    const cur = assignment[code];
    if (!cur) assignment[code] = 'a';
    else if (cur === 'a') assignment[code] = 'b';
    else delete assignment[code];
    renderRigged();
    touch();
  };

  renderMap($('#rig-map'), { assignment, interactive: true, onPick: cycle });
  evBar($('#rig-evbar'), projectFromAssignment(assignment).ev);

  const tools = document.querySelectorAll('[data-action^="rig-all"]');
  tools[0].textContent = `Sweep everything for ${nameOf('a')}`;
  tools[1].textContent = `Sweep everything for ${nameOf('b')}`;

  renderVoteEntry();
  $('#rigged-error').textContent = '';
}

function renderVoteEntry() {
  const assignment = game.rigged.assignment;
  const proj = projectFromAssignment(assignment);
  const unassigned = STATE_CODES.filter((c) => !assignment[c]);
  const wrap = clear($('#vote-entry'));

  if (unassigned.length) {
    wrap.append(h('div', { class: 'callout' },
      h('strong', {}, `${unassigned.length} state${unassigned.length === 1 ? '' : 's'} still uncalled`),
      h('p', {}, `Every contest needs a winner before you can certify: ${unassigned.map((c) => STATE_BY_CODE[c].name).join(', ')}.`)));
    return;
  }

  // Suggest a national vote consistent with the states the player handed out.
  if (game.rigged.votes.a == null) game.rigged.votes.a = proj.a;
  if (game.rigged.votes.b == null) game.rigged.votes.b = proj.b;

  const votes = game.rigged.votes;
  const summary = h('div', { class: 'vote-summary' });

  const refresh = () => {
    const totalVotes = (votes.a || 0) + (votes.b || 0);
    const evWinner = proj.ev.a === proj.ev.b ? null : proj.ev.a > proj.ev.b ? 'a' : 'b';
    const pvWinner = votes.a === votes.b ? null : votes.a > votes.b ? 'a' : 'b';
    paint(summary,
      h('div', { class: 'split-row' },
        sharePill('a', votes.a, totalVotes),
        sharePill('b', votes.b, totalVotes)),
      h('p', { class: 'hint' },
        `Total ballots cast: ${fmtNum(totalVotes)}. `
        + `Nationwide turnout across all 51 contests runs about ${fmtNum(proj.turnout)}.`),
      evWinner && pvWinner && evWinner !== pvWinner
        ? h('p', { class: 'warn-line' },
          `Heads up: ${nameOf(evWinner)} wins the Electoral College while ${nameOf(pvWinner)} wins the popular vote. `
          + 'Legal, dramatic, and it will be flagged in the recap as a split decision.')
        : null,
      Math.abs(totalVotes - proj.turnout) > proj.turnout * 0.35
        ? h('p', { class: 'warn-line' }, 'That total is a long way from plausible turnout — fine if you want a landslide nobody believes.')
        : null,
    );
  };

  const numberField = (side) => {
    const input = h('input', {
      type: 'number', min: 0, step: 1000, value: votes[side],
      oninput: (e) => { votes[side] = Math.max(0, Math.round(Number(e.target.value) || 0)); refresh(); touch(); },
    });
    return h('div', { class: 'field' },
      h('label', {}, `${nameOf(side)} — total votes`),
      input,
      h('div', { class: 'row-actions' },
        h('button', {
          class: 'ghost-btn small', type: 'button',
          onclick: () => { votes[side] = proj[side]; input.value = proj[side]; refresh(); touch(); },
        }, `Use projection (${fmtNum(proj[side])})`)));
  };

  // The biggest states the player just handed out, with what they're worth.
  const prizes = [...STATES].sort((x, y) => y.pop - x.pop).slice(0, 10);

  add(wrap,
    h('h3', {}, 'Now set the vote'),
    h('div', { class: 'callout' },
      h('strong', {}, 'What your map is worth'),
      h('p', {},
        `Based on the ${proj.assigned} states you called, a normal-looking result would be `
        + `${nameOf('a')} ${fmtNum(proj.a)} votes (${fmtNum(proj.low.a)}–${fmtNum(proj.high.a)}) and `
        + `${nameOf('b')} ${fmtNum(proj.b)} votes (${fmtNum(proj.low.b)}–${fmtNum(proj.high.b)}), `
        + `off ${proj.ev.a}–${proj.ev.b} in the Electoral College. `
        + 'Those projections assume the winner of a state takes about 55% of its ballots.')),
    h('div', { class: 'two-col' }, numberField('a'), numberField('b')),
    summary,
    h('details', { class: 'prize-table' },
      h('summary', {}, 'The ten biggest prizes on your map'),
      h('div', { class: 'table-scroll' }, h('table', {},
        h('thead', {}, h('tr', {},
          h('th', {}, 'State'), h('th', {}, 'EV'), h('th', {}, 'Ballots'), h('th', {}, 'Called for'), h('th', {}, 'Worth roughly'))),
        h('tbody', {}, prizes.map((st) => {
          const side = assignment[st.code];
          return h('tr', {},
            h('td', {}, st.name),
            h('td', {}, st.ev),
            h('td', {}, fmtNum(st.pop * 1000)),
            h('td', { style: `color:${game.candidates[side].color}` }, nameOf(side)),
            h('td', {}, `+${fmtNum(Math.round(st.pop * 1000 * 0.1))} net`));
        }))))),
  );
  refresh();
}

function sharePill(side, votes, total) {
  const pct = total ? (votes / total) * 100 : 0;
  return h('div', { class: 'share-pill', style: `--accent:${game.candidates[side].color}` },
    h('span', { class: 'share-name' }, nameOf(side)),
    h('span', { class: 'share-votes' }, fmtNum(votes)),
    h('span', { class: 'share-pct' }, `${pct.toFixed(1)}%`));
}

function certifyRigged() {
  const assignment = game.rigged.assignment;
  const missing = STATE_CODES.filter((c) => !assignment[c]);
  if (missing.length) return [`${missing.length} states still need to be called.`];
  const votes = game.rigged.votes;
  if (!votes.a || !votes.b) return ['Both candidates need a vote total above zero.'];

  const { diffs, profile } = scoreCampaign(game);
  const { stateVotes, popular } = buildStateVotes(game, assignment, diffs, { a: votes.a, b: votes.b });
  const result = buildResult(game, assignment, diffs, stateVotes, popular, { engine: 'rigged' });
  result.narrative = localNarrative(game, result, profile);
  result.narrative.headline = result.winner === 'tie'
    ? result.narrative.headline
    : `${nameOf(result.winner)} takes it — ${result.ev[result.winner]} electoral votes, exactly as ordered`;
  game.result = result;
  game.mode = 'rigged';
  goto('recap');
  return [];
}

/* ========================================================= Step 5 · simulate */

async function runSimulation() {
  show('simulating');
  save({ checkpoint: true });

  const statusEl = $('#sim-status');
  const detailEl = $('#sim-detail');
  const beats = [
    ['Polls closing on the East Coast…', 'Sending the campaign to Claude Opus.'],
    ['First states called…', 'Weighing rallies, message and name recognition.'],
    ['Counting the battlegrounds…', 'The close ones always take longest.'],
  ];
  let beat = 0;
  const ticker = setInterval(() => {
    beat = Math.min(beat + 1, beats.length - 1);
    statusEl.textContent = beats[beat][0];
    detailEl.textContent = beats[beat][1];
  }, 2600);
  statusEl.textContent = beats[0][0];
  detailEl.textContent = beats[0][1];

  let result;
  try {
    const res = await fetch('/api/election/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: simPayload() }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `http_${res.status}`);
    const data = await res.json();
    result = applyAiResult(game, data.result);
    result.engineNote = `Called by ${data.model || 'Claude Opus'}.`;
  } catch (err) {
    result = simulateElection(game);
    result.engineNote = err.message === 'no_api_key'
      ? 'No API key on the server, so the built-in model called this one.'
      : `Model unavailable (${err.message}) — the built-in model called this one.`;
  }
  clearInterval(ticker);

  game.result = result;
  game.mode = 'simulated';
  goto('recap');
}

// Everything the model needs, and nothing it doesn't.
function simPayload() {
  const trim = (side) => {
    const c = game.candidates[side];
    return {
      name: c.name,
      role: c.role,
      famous: c.kind === 'famous',
      description: (c.description || '').slice(0, 1200),
      party: c.party,
      slogan: c.slogan,
      message: (c.message || '').slice(0, 1200),
      themes: c.themes.map((id) => THEME_BY_ID[id]?.label).filter(Boolean),
      rallies: c.rallies.map((r) => ({
        date: r.date,
        state: STATE_BY_CODE[r.state]?.name || r.state,
        code: r.state,
        note: (r.note || '').slice(0, 200),
      })),
    };
  };
  return {
    electionDate: game.electionDate,
    campaignStart: game.campaignStart,
    candidates: { a: trim('a'), b: trim('b') },
  };
}

/* ================================================================== recap */

function renderRecap() {
  const r = game.result;
  const root = clear($('#recap'));
  if (!r) { root.append(h('p', {}, 'No result yet.')); return; }

  const winnerCard = r.winner === 'tie'
    ? h('div', { class: 'winner-banner tie' },
      h('p', { class: 'winner-kicker' }, 'Deadlock'),
      h('h2', {}, '269 – 269'),
      h('p', {}, 'Nobody reached 270. The election goes to the House of Representatives.'))
    : h('div', { class: 'winner-banner', style: `--accent:${game.candidates[r.winner].color}` },
      h('p', { class: 'winner-kicker' }, 'President-elect'),
      h('h2', {}, nameOf(r.winner)),
      h('p', { class: 'winner-sub' },
        `${game.candidates[r.winner].party} · ${r.ev[r.winner]} electoral votes · `
        + `${fmtNum(r.popular[r.winner])} votes (${pct(r.popular[r.winner], r.popular.a + r.popular.b)})`));

  const engineLabel = {
    ai: 'Simulated by Claude Opus',
    local: 'Simulated by the built-in model',
    rigged: 'Hand-called by you',
  }[r.engine] || r.engine;

  add(root,
    winnerCard,
    h('p', { class: 'engine-badge' }, engineLabel, r.engineNote ? ` · ${r.engineNote}` : ''),
    r.splitDecision ? h('p', { class: 'callout split' },
      h('strong', {}, 'Split decision. '),
      `${nameOf(r.winner)} lost the popular vote and won the presidency anyway.`) : null,
  );

  // --- the board
  const evWrap = h('div');
  evBar(evWrap, r.ev);
  const mapWrap = h('div');
  renderMap(mapWrap, { assignment: r.winners, votes: r.stateVotes });
  root.append(section('The board', evWrap, popularBar(r), mapWrap, legend()));

  // --- the story
  if (r.narrative) {
    const moments = h('ol', { class: 'timeline' },
      (r.narrative.keyMoments || []).map((m) => h('li', {},
        h('span', { class: 'tl-date' }, m.date ? fmtDate(m.date) : ''),
        h('span', {}, m.text))));
    root.append(section('How it happened',
      h('h4', { class: 'headline' }, r.narrative.headline || ''),
      h('p', { class: 'summary' }, r.narrative.summary || ''),
      (r.narrative.keyMoments || []).length ? moments : null));
  }

  // --- per-candidate recap
  root.append(section('The campaigns', h('div', { class: 'two-col' }, campaignRecap('a', r), campaignRecap('b', r))));

  // --- state tables
  root.append(section('The states',
    h('div', { class: 'two-col' },
      stateTable('Closest calls', r.closest),
      stateTable('Biggest blowouts', r.biggest)),
    h('details', { class: 'full-table' },
      h('summary', {}, 'Full state-by-state results'),
      h('div', { class: 'table-scroll' }, h('table', {},
        h('thead', {}, h('tr', {},
          h('th', {}, 'State'), h('th', {}, 'EV'), h('th', {}, 'Winner'),
          h('th', {}, nameOf('a')), h('th', {}, nameOf('b')), h('th', {}, 'Margin'))),
        h('tbody', {}, [...r.margins].sort((x, y) => x.name.localeCompare(y.name)).map((m) => h('tr', {},
          h('td', {}, m.name),
          h('td', {}, m.ev),
          h('td', { style: `color:${game.candidates[m.winner].color}` }, nameOf(m.winner)),
          h('td', {}, fmtNum(m.a)),
          h('td', {}, fmtNum(m.b)),
          h('td', {}, `${m.marginPct.toFixed(1)}%`))))))),
  ));

  root.append(h('div', { class: 'row-actions center' },
    h('button', { class: 'ghost-btn', type: 'button', onclick: downloadRecap }, 'Download recap (JSON)'),
    h('button', { class: 'ghost-btn', type: 'button', onclick: copyRecap }, 'Copy recap as text'),
    h('button', { class: 'ghost-btn', type: 'button', onclick: () => window.print() }, 'Print')));
}

function section(title, ...body) {
  return h('section', { class: 'recap-section' }, h('h3', {}, title), ...body);
}

function pct(n, total) {
  return total ? `${((n / total) * 100).toFixed(1)}%` : '0%';
}

function popularBar(r) {
  const total = r.popular.a + r.popular.b;
  return h('div', { class: 'pv-block' },
    h('div', { class: 'pv-head' },
      h('span', {}, 'Popular vote'),
      h('span', {}, `${fmtNum(total)} ballots`)),
    h('div', { class: 'pv-track' },
      h('div', { class: 'pv-fill', style: `width:${(r.popular.a / total) * 100}%;background:${game.candidates.a.color}` }),
      h('div', { class: 'pv-fill', style: `width:${(r.popular.b / total) * 100}%;background:${game.candidates.b.color}` })),
    h('div', { class: 'pv-legend' },
      h('span', {}, `${nameOf('a')} — ${fmtNum(r.popular.a)} (${pct(r.popular.a, total)})`),
      h('span', {}, `${nameOf('b')} — ${fmtNum(r.popular.b)} (${pct(r.popular.b, total)})`)));
}

function legend() {
  return h('div', { class: 'legend' }, ['a', 'b'].map((side) => h('span', { class: 'legend-item' },
    h('span', { class: 'swatch', style: `background:${game.candidates[side].color}` }), nameOf(side))));
}

function campaignRecap(side, r) {
  const c = game.candidates[side];
  const won = r.margins.filter((m) => m.winner === side);
  const best = [...won].sort((x, y) => y.marginPct - x.marginPct)[0];
  const rallyStates = {};
  for (const rally of c.rallies) rallyStates[rally.state] = (rallyStates[rally.state] || 0) + 1;
  const flipped = won.filter((m) => rallyStates[m.code]);

  return h('div', { class: 'card recap-card', style: `--accent:${c.color}` },
    h('div', { class: 'card-head' },
      h('span', { class: 'swatch', style: `background:${c.color}` }),
      h('h3', {}, c.name),
      h('span', { class: 'tag' }, r.winner === side ? 'Winner' : r.winner === 'tie' ? 'Deadlocked' : 'Defeated')),
    h('p', { class: 'hint' }, [c.role, c.party].filter(Boolean).join(' · ')),
    c.description ? h('p', { class: 'bio' }, c.description) : null,
    c.slogan ? h('blockquote', {}, `"${c.slogan}"`) : null,
    c.message ? h('p', { class: 'bio' }, c.message) : null,
    h('div', { class: 'chip-row' }, c.themes.map((id) => h('span', { class: 'chip' }, THEME_BY_ID[id]?.label || id))),
    h('dl', { class: 'stat-grid' },
      stat('Electoral votes', r.ev[side]),
      stat('States carried', won.length),
      stat('Popular vote', fmtNum(r.popular[side])),
      stat('Vote share', pct(r.popular[side], r.popular.a + r.popular.b)),
      stat('Rallies held', c.rallies.length),
      stat('Best state', best ? `${best.name} (+${best.marginPct.toFixed(1)}%)` : '—')),
    h('p', { class: 'hint' },
      `${flipped.length} of the ${c.rallies.length ? new Set(c.rallies.map((x) => x.state)).size : 0} states they rallied in came back for them.`),
    h('details', {},
      h('summary', {}, `Full rally schedule (${c.rallies.length})`),
      h('ol', { class: 'rally-list compact' }, c.rallies.map((rally) => h('li', { class: 'rally-item' },
        h('div', { class: 'rally-main' },
          h('span', { class: 'rally-date' }, fmtDate(rally.date)),
          h('span', { class: 'rally-state' }, STATE_BY_CODE[rally.state]?.name || rally.state),
          rally.note ? h('span', { class: 'rally-note' }, `"${rally.note}"`) : null))))),
    r.narrative?.notes?.[side] ? h('p', { class: 'note-line' }, r.narrative.notes[side]) : null);
}

function stat(label, value) {
  return h('div', { class: 'stat' }, h('dt', {}, label), h('dd', {}, String(value)));
}

function stateTable(title, rows) {
  return h('div', { class: 'card' },
    h('h4', {}, title),
    h('div', { class: 'table-scroll' }, h('table', { class: 'mini-table' },
      h('tbody', {}, rows.map((m) => h('tr', {},
        h('td', {}, m.name),
        h('td', { style: `color:${game.candidates[m.winner].color}` }, nameOf(m.winner)),
        h('td', {}, `${m.marginPct.toFixed(1)}%`),
        h('td', {}, `${m.ev} EV`)))))));
}

/* -------------------------------------------------------- recap exporting */

function recapText() {
  const r = game.result;
  const lines = [];
  lines.push(`POLITICAL ELECTION SIMULATOR — ${fmtDate(game.electionDate)}`);
  lines.push(`${nameOf('a')} (${game.candidates.a.party}) vs ${nameOf('b')} (${game.candidates.b.party})`);
  lines.push('');
  lines.push(r.narrative?.headline || '');
  lines.push('');
  lines.push(`Electoral College: ${nameOf('a')} ${r.ev.a} — ${nameOf('b')} ${r.ev.b} (${EV_TO_WIN} to win)`);
  lines.push(`Popular vote: ${nameOf('a')} ${fmtNum(r.popular.a)} — ${nameOf('b')} ${fmtNum(r.popular.b)}`);
  if (r.splitDecision) lines.push('Split decision: the popular-vote winner lost the Electoral College.');
  lines.push('');
  lines.push(r.narrative?.summary || '');
  lines.push('');
  for (const side of ['a', 'b']) {
    const c = game.candidates[side];
    lines.push(`--- ${c.name} ---`);
    if (c.slogan) lines.push(`"${c.slogan}"`);
    lines.push(`Themes: ${c.themes.map((id) => THEME_BY_ID[id]?.label).join(', ') || 'none'}`);
    lines.push(`Rallies (${c.rallies.length}):`);
    for (const rally of c.rallies) {
      lines.push(`  ${fmtDate(rally.date)} — ${STATE_BY_CODE[rally.state]?.name || rally.state}${rally.note ? ` — "${rally.note}"` : ''}`);
    }
    lines.push(`States carried: ${r.margins.filter((m) => m.winner === side).map((m) => m.code).join(' ')}`);
    lines.push('');
  }
  lines.push('Closest states:');
  for (const m of r.closest) lines.push(`  ${m.name} — ${nameOf(m.winner)} by ${m.marginPct.toFixed(1)}%`);
  lines.push('');
  lines.push('Fictional simulation — not a prediction.');
  return lines.join('\n');
}

function downloadRecap() {
  const blob = new Blob([JSON.stringify({ game, recap: recapText() }, null, 2)], { type: 'application/json' });
  const a = h('a', {
    href: URL.createObjectURL(blob),
    download: `election-${nameOf('a')}-vs-${nameOf('b')}.json`.replace(/\s+/g, '-').toLowerCase(),
  });
  document.body.append(a);
  a.click();
  a.remove();
}

async function copyRecap() {
  try {
    await navigator.clipboard.writeText(recapText());
    flashSave('Recap copied to clipboard');
  } catch {
    flashSave('Clipboard blocked — use the JSON download', true);
  }
}

/* ============================================================ save plumbing */

function refreshContinueButton() {
  const store = readStore();
  const btn = $('#btn-continue');
  const has = store && store.game && store.game.phase && store.game.phase !== 'start';
  btn.hidden = !has;
  if (has) {
    const c = store.game.candidates;
    btn.textContent = `Continue: ${c.a.name || 'Candidate A'} vs ${c.b.name || 'Candidate B'}`;
  }
}

function loadSaved() {
  const store = readStore();
  if (!store?.game) return false;
  game = migrate(store.game);
  show(game.phase === 'simulating' ? 'electionday' : game.phase);
  flashSave('Campaign restored');
  return true;
}

// Keep older saves loadable as the shape grows.
function migrate(g) {
  const base = newGame();
  const merged = { ...base, ...g };
  merged.candidates = {
    a: { ...blankCandidate(0), ...(g.candidates?.a || {}) },
    b: { ...blankCandidate(1), ...(g.candidates?.b || {}) },
  };
  merged.rigged = { assignment: {}, votes: { a: null, b: null }, ...(g.rigged || {}) };
  return merged;
}

function renderCheckpoints() {
  const list = clear($('#checkpoint-list'));
  const store = readStore();
  const points = store?.checkpoints || [];
  if (!points.length) {
    list.append(h('li', { class: 'empty' }, 'No checkpoints yet.'));
    return;
  }
  for (const cp of points) {
    list.append(h('li', {},
      h('span', {}, `${stepLabel(cp.phase)} · ${new Date(cp.at).toLocaleString()}`),
      h('button', {
        class: 'ghost-btn small', type: 'button',
        onclick: () => {
          game = migrate(cp.game);
          closeMenu();
          show(game.phase === 'simulating' ? 'electionday' : game.phase);
          save();
          flashSave(`Rolled back to ${stepLabel(cp.phase)}`);
        },
      }, 'Restore')));
  }
}

function openMenu() { $('#menu-modal').hidden = false; renderCheckpoints(); }
function closeMenu() { $('#menu-modal').hidden = true; }

function exportSave() {
  const blob = new Blob([JSON.stringify(readStore() || { game }, null, 2)], { type: 'application/json' });
  const a = h('a', { href: URL.createObjectURL(blob), download: `election-save-${game.id}.json` });
  document.body.append(a);
  a.click();
  a.remove();
}

function importSave(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      const loaded = parsed.game || parsed;
      if (!loaded.candidates) throw new Error('not a save file');
      game = migrate(loaded);
      writeStore({ game, checkpoints: parsed.checkpoints || [] });
      closeMenu();
      show(game.phase === 'simulating' ? 'electionday' : game.phase);
      flashSave('Save file loaded');
    } catch (err) {
      flashSave(`Could not read that file (${err.message})`, true);
    }
  };
  reader.readAsText(file);
}

/* =================================================================== wiring */

function showErrors(selector, problems) {
  $(selector).textContent = problems.join(' ');
  return problems.length === 0;
}

document.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;

  if (action === 'new-game') {
    game = newGame();
    goto('candidates');
    return;
  }
  if (action === 'continue') { loadSaved(); return; }

  if (action === 'to-rallies') {
    if (showErrors('#candidates-error', validateCandidates())) goto('rallies');
    return;
  }
  if (action === 'to-message') {
    const problems = [];
    for (const side of ['a', 'b']) {
      if (game.candidates[side].rallies.length < 3) {
        problems.push(`${nameOf(side)} needs at least 3 rallies.`);
      }
    }
    if (showErrors('#rallies-error', problems)) goto('message');
    return;
  }
  if (action === 'to-electionday') {
    if (showErrors('#message-error', validateMessage())) goto('electionday');
    return;
  }
  if (action === 'mode-rigged') { game.mode = 'rigged'; goto('rigged'); return; }
  if (action === 'mode-sim') { runSimulation(); return; }

  if (action === 'rig-all-a' || action === 'rig-all-b') {
    const side = action.endsWith('a') ? 'a' : 'b';
    for (const code of STATE_CODES) game.rigged.assignment[code] = side;
    game.rigged.votes = { a: null, b: null };
    renderRigged();
    touch();
    return;
  }
  if (action === 'rig-clear') {
    game.rigged.assignment = {};
    game.rigged.votes = { a: null, b: null };
    renderRigged();
    touch();
    return;
  }
  if (action === 'finish-rigged') { showErrors('#rigged-error', certifyRigged()); return; }

  if (action === 'back') {
    const order = ['candidates', 'rallies', 'message', 'electionday', 'rigged'];
    const idx = order.indexOf(game.phase);
    show(idx > 0 ? order[idx - 1] : 'start');
    return;
  }
  if (action === 'back-to-electionday') { show('electionday'); return; }

  if (action === 'export') { exportSave(); return; }
  if (action === 'import') { $('#import-file').click(); return; }
  if (action === 'wipe') {
    if (confirm('Delete the saved campaign and all checkpoints? This cannot be undone.')) {
      localStorage.removeItem(SAVE_KEY);
      game = newGame();
      closeMenu();
      show('start');
      refreshContinueButton();
      flashSave('Save deleted');
    }
    return;
  }
  if (action === 'close-menu') closeMenu();
});

$('#btn-menu').addEventListener('click', openMenu);
$('#menu-modal').addEventListener('click', (e) => { if (e.target.id === 'menu-modal') closeMenu(); });
$('#import-file').addEventListener('change', (e) => {
  if (e.target.files?.[0]) importSave(e.target.files[0]);
  e.target.value = '';
});
window.addEventListener('beforeunload', () => save());

refreshContinueButton();
show('start');
