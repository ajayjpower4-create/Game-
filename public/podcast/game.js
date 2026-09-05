import { TEAMS, HOSTS, TOPICS } from './data.js';

/* --------------------------------------------------------------- state */

const KEY = 'podcast-sim-v1';
const HOST_COLORS = ['#8fe3c0', '#ffd479', '#ff9ec4', '#9fd0ff', '#d6b3ff'];

const blank = () => ({
  v: 1,
  name: '', show: '', team: TEAMS[24], side: '', lang: 'raw',
  hosts: [],
  episodes: [],
  screen: 'setup',
});

let state = load() || blank();
let streaming = false;
let pendingCite = '';

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.v === 1 ? parsed : null;
  } catch { return null; }
}

// Every mutation goes through here, so a dead phone loses nothing.
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* full or private mode */ }
}

const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
};

const ep = () => state.episodes[state.episodes.length - 1];
const hostByName = (name) =>
  state.hosts.find((h) => h.name.toLowerCase() === String(name).toLowerCase());
const initials = (name) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

/* -------------------------------------------------------------- screens */

const SCREENS = ['setup', 'draft', 'stats', 'topics', 'studio', 'recap'];

function show(name) {
  state.screen = name;
  save();
  for (const s of SCREENS) $(`#screen-${s}`).hidden = s !== name;
  if (name === 'studio') {
    renderStudio();
    requestAnimationFrame(() => { $('#feed').scrollTop = $('#feed').scrollHeight; });
  }
  if (name === 'draft') renderHosts();
  if (name === 'topics') renderTopics();
  window.scrollTo(0, 0);
}

/* ---------------------------------------------------------------- setup */

const teamSelect = $('#in-team');
for (const t of TEAMS) teamSelect.append(new Option(t, t));

function syncSetupButton() {
  $('#btn-to-draft').disabled = !($('#in-name').value.trim() && state.side);
}

$('#in-name').addEventListener('input', (e) => { state.name = e.target.value; save(); syncSetupButton(); });
$('#in-show').addEventListener('input', (e) => { state.show = e.target.value; save(); });
teamSelect.addEventListener('change', (e) => { state.team = e.target.value; save(); });
$('#in-lang').addEventListener('change', (e) => { state.lang = e.target.value; save(); });

$('#pick-side').addEventListener('click', (e) => {
  const btn = e.target.closest('.pick');
  if (!btn) return;
  state.side = btn.dataset.side;
  save();
  for (const b of document.querySelectorAll('#pick-side .pick')) b.classList.toggle('on', b === btn);
  syncSetupButton();
});

$('#btn-to-draft').addEventListener('click', () => {
  state.name = $('#in-name').value.trim();
  state.show = $('#in-show').value.trim() || 'The Snap Count';
  state.team = teamSelect.value;
  state.lang = $('#in-lang').value;
  if (!state.hosts.length) rollHosts();
  save();
  show('draft');
});

/* ---------------------------------------------------------------- hosts */

// Exactly one co-host always rides with the player; the other two pick their
// own side, so the desk can be 2-on-2 or a 3-on-1 pile-on.
function rollHosts() {
  const pool = [...HOSTS].sort(() => Math.random() - 0.5).slice(0, 3);
  state.hosts = pool.map((h, i) => ({
    ...h,
    color: HOST_COLORS[i % HOST_COLORS.length],
    stance: i === 0 ? 'with' : (Math.random() < 0.5 ? 'with' : 'against'),
  }));
  // Guarantee at least one voice on the other side of the table.
  if (state.hosts.every((h) => h.stance === 'with')) state.hosts[2].stance = 'against';
  save();
}

function stanceLabel(host) {
  const fan = state.side === 'fan';
  if (host.stance === 'with') return fan ? `Rides for the ${state.team}` : `Hates them as much as you do`;
  return fan ? `Not buying the ${state.team}` : `Defends the ${state.team}`;
}

function renderHosts() {
  const box = $('#host-cards');
  box.replaceChildren();
  for (const h of state.hosts) {
    const card = el('div', 'host-card');
    const av = el('div', 'av', initials(h.name));
    av.style.background = h.color;
    const body = el('div');
    body.append(el('h3', null, h.name), el('p', null, h.persona));
    const tag = el('span', `stance ${h.stance === 'with' ? 'with' : 'against'}`, stanceLabel(h));
    body.append(tag);
    card.append(av, body);
    box.append(card);
  }
}

$('#btn-reroll').addEventListener('click', () => { rollHosts(); renderHosts(); });
$('#btn-to-stats').addEventListener('click', () => {
  if (!state.episodes.length) newEpisode();
  fillStatsScreen();
  show('stats');
});

/* ---------------------------------------------------------------- stats */

function newEpisode() {
  state.episodes.push({
    n: state.episodes.length + 1,
    slug: '', stats: '', topics: [], messages: [], ended: false, recap: null,
  });
  save();
}

function fillStatsScreen() {
  const e = ep();
  $('#stats-title').textContent = e.n === 1 ? 'The stat sheet' : `Episode ${e.n} — new stat sheet`;
  $('#in-slug').value = e.slug;
  $('#in-stats').value = e.stats;
  syncStatsButton();
}

function syncStatsButton() { $('#btn-to-topics').disabled = !$('#in-stats').value.trim(); }

$('#in-slug').addEventListener('input', (e) => { ep().slug = e.target.value; save(); });
$('#in-stats').addEventListener('input', (e) => { ep().stats = e.target.value; save(); syncStatsButton(); });
$('#btn-to-topics').addEventListener('click', () => {
  const e = ep();
  e.slug = $('#in-slug').value.trim() || `Episode ${e.n}`;
  e.stats = $('#in-stats').value;
  save();
  show('topics');
});

/* --------------------------------------------------------------- topics */

function renderTopics() {
  const box = $('#topic-chips');
  box.replaceChildren();
  const custom = ep().topics.filter((t) => !TOPICS.includes(t));
  for (const t of [...TOPICS, ...custom]) {
    const chip = el('button', 'chip', t);
    chip.type = 'button';
    chip.classList.toggle('on', ep().topics.includes(t));
    chip.addEventListener('click', () => {
      const list = ep().topics;
      const at = list.indexOf(t);
      if (at >= 0) list.splice(at, 1); else list.push(t);
      save();
      renderTopics();
    });
    box.append(chip);
  }
  $('#btn-go-live').disabled = ep().topics.length === 0;
}

$('#btn-add-topic').addEventListener('click', () => {
  const input = $('#in-topic');
  const value = input.value.trim();
  if (!value) return;
  if (!ep().topics.includes(value)) ep().topics.push(value);
  input.value = '';
  save();
  renderTopics();
});
$('#in-topic').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); $('#btn-add-topic').click(); }
});

$('#btn-go-live').addEventListener('click', () => {
  const e = ep();
  if (!e.messages.length) {
    e.messages.push({ who: '_note', text: `You're live on ${state.show} — Episode ${e.n}. Do the intro.` });
    save();
  }
  show('studio');
});

/* --------------------------------------------------------------- studio */

function renderStudio() {
  const e = ep();
  $('#bar-show').textContent = state.show;
  $('#bar-ep').textContent = `Episode ${e.n}${e.slug ? ` — ${e.slug}` : ''}`;
  const strip = $('#rundown-strip');
  strip.replaceChildren();
  for (const t of e.topics) strip.append(el('span', null, t));
  renderFeed();
}

function renderFeed() {
  const feed = $('#feed');
  feed.replaceChildren();
  for (const m of ep().messages) feed.append(lineNode(m));
  feed.scrollTop = feed.scrollHeight;
}

function lineNode(m) {
  if (m.who === '_note') {
    const note = el('div', 'note-line');
    note.append(el('span', null, m.text));
    return note;
  }
  const mine = m.who === '_me';
  const row = el('div', `line ${mine ? 'me' : ''}`);
  const who = mine ? state.name : m.who;
  const av = el('div', 'av', initials(who || '??'));
  av.style.background = mine ? '#6f7cff' : (hostByName(m.who)?.color || '#9fb0c9');
  const body = el('div', 'body');
  body.append(el('div', 'who', who));
  const bubble = el('div', 'bubble');
  if (m.cite) bubble.append(el('span', 'cite', m.cite));
  bubble.append(document.createTextNode(m.text));
  body.append(bubble);
  row.append(av, body);
  return row;
}

/* composer */

const say = $('#in-say');
const autosize = () => { say.style.height = 'auto'; say.style.height = `${Math.min(say.scrollHeight, 140)}px`; };
say.addEventListener('input', autosize);
say.addEventListener('keydown', (e) => {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  if (e.key === 'Enter' && !e.shiftKey && !coarse) { e.preventDefault(); $('#composer').requestSubmit(); }
});

$('#composer').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = say.value.trim();
  if ((!text && !pendingCite) || streaming) return;
  const msg = { who: '_me', text };
  if (pendingCite) msg.cite = pendingCite;
  ep().messages.push(msg);
  pendingCite = '';
  $('#quote-bar').hidden = true;
  say.value = '';
  autosize();
  save();
  renderFeed();
  runTurn();
});

/* ------------------------------------------------------------ the turn */

// The model only ever writes host dialogue. Anything that shows up without a
// "NAME:" prefix gets glued onto whoever spoke last, and stage directions get
// thrown out — this show is audio only.
function parseHostLines(raw) {
  const names = state.hosts.map((h) => h.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const re = new RegExp(`(?:^|\\n)\\s*(${names})\\s*:\\s*`, 'gi');
  const out = [];
  let match, last = null, cursor = 0;
  while ((match = re.exec(raw)) !== null) {
    if (last) out.push({ who: last, text: raw.slice(cursor, match.index) });
    last = hostByName(match[1])?.name || match[1];
    cursor = re.lastIndex;
  }
  if (last) out.push({ who: last, text: raw.slice(cursor) });
  else if (raw.trim()) out.push({ who: state.hosts[0].name, text: raw });
  return out
    .map((m) => ({ who: m.who, text: cleanLine(m.text) }))
    .filter((m) => m.text);
}

function cleanLine(text) {
  return text
    .replace(/\*[^*\n]{0,120}\*/g, '')       // *leans into the mic* — no narration
    .replace(/^\s*[\[(][^\]\n)]{0,120}[\])]\s*/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

// Host turns collapse into one assistant message so the model sees the show
// the same way it wrote it.
function apiHistory() {
  const turns = [];
  for (const m of ep().messages) {
    if (m.who === '_note') continue;
    if (m.who === '_me') {
      const said = m.cite ? `[pulls up the stat sheet] "${m.cite}"\n${m.text}` : m.text;
      turns.push({ role: 'user', content: said });
    } else {
      const line = `${m.who}: ${m.text}`;
      const prev = turns[turns.length - 1];
      if (prev && prev.role === 'assistant') prev.content += `\n${line}`;
      else turns.push({ role: 'assistant', content: line });
    }
  }
  if (!turns.length || turns[0].role !== 'user') {
    turns.unshift({ role: 'user', content: `${state.name} settles into the guest chair.` });
  }
  return turns;
}

function priorEpisodes() {
  return state.episodes.slice(0, -1).map((e) => ({
    n: e.n,
    slug: e.slug,
    topics: e.topics,
    recap: e.recap?.overview || '',
    lines: e.messages.filter((m) => m.who !== '_note').slice(-10)
      .map((m) => `${m.who === '_me' ? state.name : m.who}: ${m.text}`),
  }));
}

async function runTurn() {
  streaming = true;
  $('#btn-send').disabled = true;
  const feed = $('#feed');
  const typing = el('div', 'typing', 'the desk is talking…');
  feed.append(typing);
  feed.scrollTop = feed.scrollHeight;

  const live = el('div');
  feed.append(live);
  let raw = '';

  const paint = () => {
    live.replaceChildren();
    for (const m of parseHostLines(raw)) live.append(lineNode(m));
    feed.scrollTop = feed.scrollHeight;
  };

  try {
    const res = await fetch('/api/podcast/turn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        setup: {
          user: state.name, show: state.show, team: state.team,
          side: state.side, language: state.lang, hosts: state.hosts,
        },
        episode: { n: ep().n, slug: ep().slug, stats: ep().stats, topics: ep().topics },
        prior: priorEpisodes(),
        history: apiHistory(),
      }),
    });

    if (!res.ok || !res.body) throw new Error(`server said ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop();
      for (const part of parts) {
        const payload = part.replace(/^data: /, '').trim();
        if (!payload || payload === '[DONE]') continue;
        let data;
        try { data = JSON.parse(payload); } catch { continue; }
        if (data.error) throw new Error(data.error);
        if (data.text) { raw += data.text; paint(); }
      }
    }

    const lines = parseHostLines(raw);
    if (!lines.length) throw new Error('the desk went silent');
    ep().messages.push(...lines);
    save();
  } catch (err) {
    ep().messages.push({ who: '_note', text: `Mic cut out: ${err.message}. Say it again.` });
    save();
  } finally {
    typing.remove();
    live.remove();
    streaming = false;
    $('#btn-send').disabled = false;
    renderFeed();
  }
}

/* ---------------------------------------------------------- stat drawer */

function openDrawer(node) { node.hidden = false; }
function closeDrawer(node) { node.hidden = true; }

// Buckets a pasted sheet gets filed into. A chip only shows up if the sheet
// actually has lines in that bucket, so a receiving-only sheet doesn't offer a
// "Special teams" filter that returns nothing.
const SHEET_GROUPS = [
  { key: 'qb', label: 'QB', re: /\bq\.?b\b|quarterback|pass(ing|er|es)?\b|comp(letion|s)?\b|\btd\b.*\bint\b/i },
  { key: 'rb', label: 'Run game', re: /\br\.?b\b|running back|rush(ing|es|er)?\b|carr(y|ies)\b|\bypc\b|fullback/i },
  { key: 'rec', label: 'Pass catchers', re: /\bw\.?r\b|\bt\.?e\b|wide receiver|tight end|rec(eption|eiving|s)\b|target(s|ed)?\b|drop(s|ped)?\b/i },
  { key: 'ol', label: 'O-line', re: /\bo\.?l\b|o-?line|offensive line|\b[lr][tg]\b|center\b|guard\b|tackle allowed|pressure(s)? allowed|sack(s)? allowed|penalt/i },
  { key: 'def', label: 'Defense', re: /\bd\.?[lb]\b|\bl\.?b\b|\bc\.?b\b|\bd\.?e\b|\bd\.?t\b|safet(y|ies)|defen(se|sive)|sack(s)?\b|tackle(s)?\b|\bint(erception)?s?\b|coverage|blitz|forced fumble|\bpbu\b|takeaway/i },
  { key: 'st', label: 'Special teams', re: /special teams|kicker|\bpunt|\bf\.?g\b|field goal|extra point|\bxp\b|kickoff|return(er|s|ed)?\b|long snap/i },
  { key: 'inj', label: 'Injuries', re: /injur|\bi\.?r\b|hamstring|questionable|doubtful|\bout\b.*(week|game|season)|\bacl\b|concussion|ankle|groin|strain|surger/i },
  { key: 'rook', label: 'Rookies', re: /rookie|\budfa\b|draft(ed)? pick|\b[1-7](st|nd|rd|th) round|undrafted/i },
  { key: 'cut', label: 'Roster moves', re: /\bcut\b|wa[iy]ve|released?\b|\b53\b|practice squad|depth chart|trade|signed?\b|claim/i },
  { key: 'num', label: 'Has numbers', re: /\d/ },
];

// A heading is a label, not a stat — it files the lines under it and can't be
// quoted at the desk.
function isHeading(line) {
  if (/^[#=\-*_\s]+$/.test(line)) return true;
  const bare = line.replace(/^[#>*\-\s]+/, '').replace(/[:\-=]+$/, '').trim();
  if (!bare || bare.length > 40) return false;
  if (/^[#>]/.test(line)) return true;
  if (/:$/.test(line.trim()) && !/\d/.test(bare)) return true;
  return bare === bare.toUpperCase() && /[A-Z]/.test(bare) && !/\d/.test(bare);
}

function indexSheet(text) {
  const rows = [];
  let section = '';
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (isHeading(line)) {
      section = line.replace(/^[#>*\-\s]+/, '').replace(/[:\-=]+$/, '').trim();
      continue;
    }
    rows.push({
      line,
      section,
      groups: SHEET_GROUPS.filter((g) => g.re.test(line) || (section && g.re.test(section)))
        .map((g) => g.key),
    });
  }
  return rows;
}

let sheetFilters = { search: '', picked: new Set(), sheet: '' };

function resetSheetFilters() { sheetFilters = { search: '', picked: new Set(), sheet: ep().stats }; }

function sheetChipDefs(rows) {
  const sections = [];
  for (const r of rows) {
    if (r.section && !sections.includes(r.section)) sections.push(r.section);
  }
  const defs = sections.length > 1
    ? sections.map((name) => ({ id: `s:${name}`, label: name }))
    : [];

  const setOf = (test) => rows.reduce((acc, r, i) => (test(r) ? acc.add(i) : acc), new Set());
  const sectionSets = defs.map((d) => setOf((r) => r.section === d.id.slice(2)));
  const same = (a, b) => a.size === b.size && [...a].every((i) => b.has(i));

  for (const g of SHEET_GROUPS) {
    const hits = setOf((r) => r.groups.includes(g.key));
    // A group that catches nothing, catches everything, or catches exactly what
    // a section chip already catches is a chip nobody needs.
    if (!hits.size || hits.size === rows.length) continue;
    if (sectionSets.some((sec) => same(sec, hits))) continue;
    defs.push({ id: `g:${g.key}`, label: g.label });
  }
  return defs;
}

function matchesFilters(row) {
  const terms = sheetFilters.search.toLowerCase().split(/\s+/).filter(Boolean);
  const hay = `${row.line} ${row.section}`.toLowerCase();
  if (!terms.every((t) => hay.includes(t))) return false;
  if (!sheetFilters.picked.size) return true;
  // Chips are an OR: any picked bucket the line belongs to keeps it.
  for (const id of sheetFilters.picked) {
    if (id.startsWith('s:') && row.section === id.slice(2)) return true;
    if (id.startsWith('g:') && row.groups.includes(id.slice(2))) return true;
  }
  return false;
}

function renderSheet() {
  const rows = indexSheet(ep().stats);
  const chipBox = $('#sheet-chips');
  chipBox.replaceChildren();
  for (const def of sheetChipDefs(rows)) {
    const chip = el('button', 'chip', def.label);
    chip.type = 'button';
    chip.classList.toggle('on', sheetFilters.picked.has(def.id));
    chip.addEventListener('click', () => {
      if (sheetFilters.picked.has(def.id)) sheetFilters.picked.delete(def.id);
      else sheetFilters.picked.add(def.id);
      renderSheet();
    });
    chipBox.append(chip);
  }
  if (sheetFilters.picked.size || sheetFilters.search) {
    const clear = el('button', 'chip clear', 'Clear filters');
    clear.type = 'button';
    clear.addEventListener('click', () => {
      sheetFilters.picked.clear();
      sheetFilters.search = '';
      $('#in-sheet-search').value = '';
      $('#btn-search-clear').hidden = true;
      renderSheet();
    });
    chipBox.append(clear);
  }

  const box = $('#sheet-lines');
  box.replaceChildren();
  const hits = rows.filter(matchesFilters);
  const filtered = sheetFilters.picked.size || sheetFilters.search;

  $('#sheet-count').textContent = !rows.length
    ? 'Nothing on the sheet yet.'
    : filtered
      ? `${hits.length} of ${rows.length} lines`
      : 'Tap a line to throw it in their face.';

  if (!hits.length) {
    box.append(el('p', 'hint', rows.length ? 'Nothing on the sheet matches that.' : 'Nothing on the sheet yet.'));
    return;
  }

  let section = null;
  for (const row of hits) {
    if (row.section !== section) {
      section = row.section;
      if (section) box.append(el('div', 'sheet-section', section));
    }
    const btn = el('button', null, row.line);
    btn.type = 'button';
    btn.addEventListener('click', () => {
      pendingCite = row.line;
      $('#quote-text').textContent = row.line;
      $('#quote-bar').hidden = false;
      closeDrawer($('#drawer'));
      say.focus();
    });
    box.append(btn);
  }
}

$('#btn-sheet').addEventListener('click', () => {
  // A new episode means a new sheet, so old filters don't carry over.
  if (sheetFilters.sheet !== ep().stats) resetSheetFilters();
  $('#in-sheet-search').value = sheetFilters.search;
  $('#btn-search-clear').hidden = !sheetFilters.search;
  renderSheet();
  openDrawer($('#drawer'));
});

$('#in-sheet-search').addEventListener('input', (e) => {
  sheetFilters.search = e.target.value.trim();
  $('#btn-search-clear').hidden = !e.target.value;
  renderSheet();
});
$('#btn-search-clear').addEventListener('click', () => {
  sheetFilters.search = '';
  $('#in-sheet-search').value = '';
  $('#btn-search-clear').hidden = true;
  renderSheet();
  $('#in-sheet-search').focus();
});

$('#btn-drawer-close').addEventListener('click', () => closeDrawer($('#drawer')));
$('#btn-quote-clear').addEventListener('click', () => {
  pendingCite = '';
  $('#quote-bar').hidden = true;
});
$('#btn-edit-stats').addEventListener('click', () => {
  closeDrawer($('#drawer'));
  fillStatsScreen();
  show('stats');
});
for (const d of [$('#drawer'), $('#menu')]) {
  d.addEventListener('click', (e) => { if (e.target === d) closeDrawer(d); });
}

/* ----------------------------------------------------------------- menu */

$('#btn-menu').addEventListener('click', () => {
  $('#menu-show').textContent = state.show;
  const body = $('#menu-body');
  body.replaceChildren();
  body.append(el('h4', null, 'You'));
  body.append(el('p', null, `${state.name} — ${state.side === 'fan'
    ? `${state.team} fan` : `can't stand the ${state.team}`}`));
  body.append(el('h4', null, 'The desk'));
  for (const h of state.hosts) body.append(el('p', null, `${h.name} — ${stanceLabel(h)}`));
  body.append(el('h4', null, 'Episodes'));
  for (const e of state.episodes) {
    body.append(el('div', 'ep-row',
      `Ep ${e.n} — ${e.slug || 'untitled'}${e.ended ? '' : ' (live)'}`));
  }
  openDrawer($('#menu'));
});
$('#btn-menu-close').addEventListener('click', () => closeDrawer($('#menu')));

$('#btn-reset').addEventListener('click', () => {
  if (!confirm('Delete the whole show — hosts, episodes, everything?')) return;
  state = blank();
  save();
  location.reload();
});

/* ---------------------------------------------------------------- recap */

$('#btn-end-ep').addEventListener('click', async () => {
  closeDrawer($('#menu'));
  const e = ep();
  e.ended = true;
  save();
  $('#recap-title').textContent = `Episode ${e.n} is a wrap`;
  $('#recap-sub').textContent = 'Pulling the rundown…';
  $('#recap-box').replaceChildren();
  show('recap');

  let recap = null;
  try {
    const res = await fetch('/api/podcast/recap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        setup: { user: state.name, show: state.show, team: state.team, side: state.side, hosts: state.hosts },
        episode: { n: e.n, slug: e.slug, stats: e.stats, topics: e.topics },
        transcript: e.messages.filter((m) => m.who !== '_note')
          .map((m) => `${m.who === '_me' ? state.name : m.who}: ${m.text}`),
      }),
    });
    if (res.ok) recap = await res.json();
  } catch { /* fall through to the local rundown */ }

  e.recap = recap || {
    overview: `${state.show} Episode ${e.n}${e.slug ? ` — ${e.slug}` : ''}. `
      + `${e.messages.filter((m) => m.who === '_me').length} takes from ${state.name}.`,
    hits: e.topics.map((t) => `Covered: ${t}`),
    next: ['Bring the next stat sheet.'],
  };
  save();
  renderRecap(e);
});

function renderRecap(e) {
  $('#recap-sub').textContent = `${state.show} — ${e.slug || `Episode ${e.n}`}`;
  const box = $('#recap-box');
  box.replaceChildren();
  box.append(el('h4', null, 'The episode'), el('p', null, e.recap.overview || ''));
  if (e.recap.hits?.length) {
    box.append(el('h4', null, 'What got said'));
    const ul = el('ul');
    for (const h of e.recap.hits) ul.append(el('li', null, h));
    box.append(ul);
  }
  if (e.recap.next?.length) {
    box.append(el('h4', null, 'Next episode'));
    const ul = el('ul');
    for (const n of e.recap.next) ul.append(el('li', null, n));
    box.append(ul);
  }
}

$('#btn-back-studio').addEventListener('click', () => show('studio'));
$('#btn-next-ep').addEventListener('click', () => {
  newEpisode();
  fillStatsScreen();
  show('stats');
});

/* ----------------------------------------------------------- back links */

for (const btn of document.querySelectorAll('[data-goto]')) {
  btn.addEventListener('click', () => show(btn.dataset.goto));
}

/* ----------------------------------------------------------------- boot */

$('#in-name').value = state.name;
$('#in-show').value = state.show;
teamSelect.value = state.team;
$('#in-lang').value = state.lang;
for (const b of document.querySelectorAll('#pick-side .pick')) b.classList.toggle('on', b.dataset.side === state.side);
syncSetupButton();

if (state.episodes.length) {
  fillStatsScreen();
  const resume = ep().ended && state.screen === 'recap' ? 'recap' : state.screen;
  show(SCREENS.includes(resume) ? resume : 'studio');
  if (resume === 'recap' && ep().recap) renderRecap(ep());
} else {
  show(state.hosts.length && state.screen === 'draft' ? 'draft' : 'setup');
}
