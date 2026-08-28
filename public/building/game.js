/* Building Design Simulator — pick a lot, place a building, shape it, sign it. */

import { BUILDINGS, WALL_COLORS, SIGN_COLORS, LOGOS, WINDOW_STYLES, FLOOR_HEIGHT, freshState, normalize } from './catalog.js';
import { render, frame, layout } from './scene.js';

const SAVE_KEY = 'building-sim:v1';
const app = document.getElementById('app');
const tools = document.getElementById('tools');
const crumb = document.getElementById('crumb');

let state = load() || freshState('warehouse');
let screen = load() ? 'build' : 'start';
let tab = 'building';
let pending = { type: 'warehouse', lot: { ...BUILDINGS.warehouse.lot } };

/* ------------------------------------------------------------- persistence */

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? normalize(JSON.parse(raw)) : null;
  } catch { return null; }
}
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* private mode */ }
}

/* ------------------------------------------------------------ state access */

function get(path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), state);
}
function set(path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => o[k], state);
  target[last] = value;
  save();
  draw();
}

/* --------------------------------------------------------------- controls */

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function range(label, path, { min, max, step = 1, unit = '', fmt } = {}) {
  const v = get(path);
  const shown = fmt ? fmt(v) : `${v}${unit}`;
  return `<div class="field">
    <label for="c-${path}">${esc(label)}<b>${esc(shown)}</b></label>
    <input id="c-${path}" type="range" min="${min}" max="${max}" step="${step}" value="${v}" data-path="${path}" data-kind="num">
  </div>`;
}

function chips(label, path, options, { swatch = false, glyph = false } = {}) {
  const v = get(path);
  const cls = swatch ? ' swatch' : glyph ? ' glyph' : '';
  const body = options.map((o) => {
    const on = String(o.value) === String(v) ? ' on' : '';
    const style = swatch ? ` style="background:${esc(o.value)}"` : '';
    const title = swatch ? ` title="${esc(o.label)}" aria-label="${esc(o.label)}"` : '';
    return `<button class="chip${cls}${on}" data-path="${path}" data-kind="pick" data-value="${esc(o.value)}"${style}${title}>${swatch ? '' : esc(o.label || '—')}</button>`;
  }).join('');
  return `<div class="field"><label>${esc(label)}</label><div class="chips">${body}</div></div>`;
}

function toggle(label, path, hint = '') {
  const on = !!get(path);
  return `<button class="toggle${on ? ' on' : ''}" data-path="${path}" data-kind="toggle">
    <span>${esc(label)}${hint ? `<br><small style="color:#6a798f">${esc(hint)}</small>` : ''}</span>
    <span class="pill">${on ? 'On' : 'Off'}</span>
  </button>`;
}

function textField(label, path, placeholder = '') {
  return `<div class="field">
    <label for="c-${path}">${esc(label)}</label>
    <input id="c-${path}" type="text" value="${esc(get(path) ?? '')}" placeholder="${esc(placeholder)}" data-path="${path}" data-kind="text" maxlength="46">
  </div>`;
}

/* ------------------------------------------------------------ start screen */

function startScreen() {
  const cards = Object.entries(BUILDINGS).map(([id, b]) => `
    <button class="card${pending.type === id ? ' on' : ''}" data-act="pick-type" data-value="${id}">
      <span class="icon">${b.icon}</span>
      <strong>${esc(b.name)}</strong>
      <p>${esc(b.blurb)}</p>
    </button>`).join('');

  app.innerHTML = `<div class="start">
    <h1>Start a new site</h1>
    <p class="lede">First set the lot, then pick what goes on it. Everything after this is editable — floors,
      bays, doors, security, signage, day or night.</p>
    <div class="cards">${cards}</div>
    <div class="divider"></div>
    <h2>Lot size</h2>
    <div class="field">
      <label for="lw">Frontage (along the street)<b>${pending.lot.width} ft</b></label>
      <input id="lw" type="range" min="240" max="900" step="20" value="${pending.lot.width}" data-act="lot-w">
    </div>
    <div class="field">
      <label for="ld">Depth (back from the street)<b>${pending.lot.depth} ft</b></label>
      <input id="ld" type="range" min="240" max="700" step="20" value="${pending.lot.depth}" data-act="lot-d">
    </div>
    <p class="hint">That is ${(pending.lot.width * pending.lot.depth / 43560).toFixed(2)} acres.</p>
    <button class="btn primary" data-act="break-ground">Break ground →</button>
  </div>`;
  tools.innerHTML = '';
  crumb.textContent = 'Pick a lot, drop a building, sign it';
}

/* ------------------------------------------------------------------ panels */

const TABS = [
  ['building', 'Building'],
  ['office', 'Office'],
  ['entrance', 'Entrance'],
  ['security', 'Security'],
  ['text', 'Text & logos'],
  ['site', 'Site'],
  ['lot', 'Lot'],
];

function panelFor(which) {
  const t = state.type;
  if (which === 'lot') {
    return `<h2>Lot</h2><p class="hint">The ground you get to build on. The building re-centres itself.</p>
      ${range('Frontage', 'lot.width', { min: 240, max: 900, step: 20, unit: ' ft' })}
      ${range('Depth', 'lot.depth', { min: 240, max: 700, step: 20, unit: ' ft' })}
      <p class="hint">${(state.lot.width * state.lot.depth / 43560).toFixed(2)} acres.
        Front yard in front of the building: ${Math.round(layout(state).yard)} ft.</p>
      <div class="divider"></div>
      ${chips('Building type', 'type', Object.entries(BUILDINGS).map(([id, b]) => ({ value: id, label: `${b.icon} ${b.name}` })))}
      <p class="note">Switching type re-presets the massing. Your signage and lot stay put.</p>`;
  }

  if (which === 'building') {
    const sizeFields = `
      ${range('Length', 'body.length', { min: 60, max: Math.max(120, state.lot.width - 60), step: 10, unit: ' ft' })}
      ${range('Depth', 'body.width', { min: 30, max: Math.max(60, state.lot.depth - 180), step: 10, unit: ' ft' })}`;
    let extra = '';
    if (t === 'tower') {
      extra = range('Floors', 'body.floors', { min: 2, max: 30, step: 1, fmt: (v) => `${v} · ${v * FLOOR_HEIGHT} ft` });
    } else if (t === 'warehouse') {
      extra = range('Dock bays', 'body.bays', { min: 0, max: 40, step: 1 }) +
        range('Clear height', 'body.height', { min: 18, max: 60, step: 2, unit: ' ft' });
    } else if (t === 'storage') {
      extra = range('Doors per row', 'body.bays', { min: 6, max: 40, step: 1 }) +
        range('Rows of units', 'body.rows', { min: 1, max: 5, step: 1 }) +
        range('Unit height', 'body.height', { min: 9, max: 16, step: 1, unit: ' ft' });
    } else {
      extra = range('Tenant units', 'body.bays', { min: 2, max: 14, step: 1 }) +
        range('Parapet height', 'body.height', { min: 14, max: 32, step: 2, unit: ' ft' });
    }
    return `<h2>${esc(BUILDINGS[t].name)}</h2><p class="hint">${esc(BUILDINGS[t].blurb)}</p>
      ${sizeFields}${extra}
      <div class="divider"></div>
      ${chips('Wall colour', 'skin.wall', WALL_COLORS.map((c) => ({ value: c.hex, label: c.name })), { swatch: true })}
      ${chips('Trim / band', 'skin.band', SIGN_COLORS.map((c) => ({ value: c.hex, label: c.name })), { swatch: true })}
      <p class="note">Footprint: ${Math.round(state.body.length * state.body.width).toLocaleString()} sq ft.</p>`;
  }

  if (which === 'office') {
    if (t === 'tower') {
      return `<h2>Office</h2><p class="hint">A tower is all office — the floor count lives on the Building tab.
        The podium at its base carries the entrance.</p>
        ${chips('Glazing', 'skin.windows', WINDOW_STYLES.map((w) => ({ value: w.id, label: w.name })))}`;
    }
    return `<h2>Office section</h2>
      <p class="hint">Raise one end of the building into two or three floors of office, then glaze it.</p>
      <div class="toggles">${toggle('Office section', 'office.on', 'Turn part of the shell into offices')}</div>
      <div class="divider"></div>
      ${range('Floors', 'office.floors', { min: 1, max: 6, step: 1, fmt: (v) => `${v} · ${v * FLOOR_HEIGHT} ft` })}
      ${range('How much of the building', 'office.length', { min: 30, max: Math.max(40, state.body.length - 20), step: 10, unit: ' ft' })}
      ${chips('Which end', 'office.side', [{ value: 'left', label: 'Left end' }, { value: 'right', label: 'Right end' }])}
      ${chips('Windows', 'skin.windows', WINDOW_STYLES.map((w) => ({ value: w.id, label: w.name })))}`;
  }

  if (which === 'entrance') {
    return `<h2>Entrance</h2><p class="hint">Front doors go on the office end, facing the street.</p>
      <div class="toggles">
        ${toggle('Front doors', 'entrance.doors', 'Glazed double doors with a transom')}
        ${toggle('Canopy over the doors', 'entrance.canopy')}
        ${toggle('Porch', 'entrance.porch', 'Raised slab and columns out front')}
        ${toggle('Steps and walk', 'entrance.steps')}
      </div>`;
  }

  if (which === 'security') {
    return `<h2>Security</h2><p class="hint">The booth sits beside the drive; the gate arm crosses it.</p>
      <div class="toggles">
        ${toggle('Guard booth', 'security.booth', 'Main entrance check-in')}
        ${toggle('Gate arm', 'security.gate')}
        ${toggle('Perimeter fence', 'security.fence', 'Runs the street frontage, open at the drive')}
        ${toggle('Guard and visitor', 'security.guard')}
      </div>
      <div class="divider"></div>
      ${range('Barricades / bollards', 'security.barricades', { min: 0, max: 24, step: 2 })}`;
  }

  if (which === 'site') {
    return `<h2>Site</h2><p class="hint">The parking lot lays itself out around whatever you have built.</p>
      <div class="toggles">
        ${toggle('Parking lot', 'site.parking', 'Striped stalls, auto-placed')}
        ${toggle('Parked cars', 'site.cars')}
        ${toggle('Trailers at the docks', 'site.trailers')}
        ${toggle('Light poles', 'site.poles', 'They actually light the lot at night')}
        ${toggle('Trees and landscaping', 'site.trees')}
      </div>`;
  }

  // Text & logos
  return `<h2>Text &amp; logos</h2>
    <p class="hint">Click any surface in the view to jump straight to its text, or edit them here.</p>
    <h3 style="font-size:14px;color:var(--dim)">Building wall</h3>
    ${textField('Sign text', 'signs.wall.text', 'COMPANY NAME')}
    ${textField('Tagline underneath', 'signs.wall.sub', 'Optional strapline')}
    ${chips('Font colour', 'signs.wall.color', SIGN_COLORS.map((c) => ({ value: c.hex, label: c.name })), { swatch: true })}
    ${chips('Logo', 'signs.wall.logo', LOGOS.map((l) => ({ value: l, label: l })), { glyph: true })}
    <div class="divider"></div>
    <h3 style="font-size:14px;color:var(--dim)">Security booth</h3>
    ${textField('Booth fascia', 'signs.booth.text', 'COMPANY NAME')}
    ${chips('Font colour', 'signs.booth.color', SIGN_COLORS.map((c) => ({ value: c.hex, label: c.name })), { swatch: true })}
    ${chips('Logo', 'signs.booth.logo', LOGOS.map((l) => ({ value: l, label: l })), { glyph: true })}
    <div class="divider"></div>
    <h3 style="font-size:14px;color:var(--dim)">Monument sign</h3>
    <div class="toggles">${toggle('Sign at the drive', 'signs.monument.on')}</div>
    <div style="height:12px"></div>
    ${textField('Sign text', 'signs.monument.text', 'ALL VISITORS MUST CHECK IN')}
    ${chips('Font colour', 'signs.monument.color', SIGN_COLORS.map((c) => ({ value: c.hex, label: c.name })), { swatch: true })}
    ${chips('Logo', 'signs.monument.logo', LOGOS.map((l) => ({ value: l, label: l })), { glyph: true })}`;
}

/* ------------------------------------------------------------ build screen */

function buildScreen() {
  app.innerHTML = `<div class="workshop">
    <div>
      <div class="stage" id="stage"></div>
      <div class="stagebar" style="position:static;padding-top:10px">
        <button class="btn" data-act="rotate">↻ Rotate view</button>
        <button class="btn" data-act="zoom-out">−</button>
        <button class="btn" data-act="zoom-in">+</button>
        <span class="readout" id="readout"></span>
      </div>
    </div>
    <div class="panel">
      <div class="tabs">${TABS.map(([id, label]) => `<button data-act="tab" data-value="${id}" class="${tab === id ? 'active' : ''}">${label}</button>`).join('')}</div>
      <div class="panel-body" id="panelBody"></div>
    </div>
  </div>`;
  tools.innerHTML = `
    <button class="btn ${state.view.time === 'night' ? 'on' : ''}" data-act="time">${state.view.time === 'night' ? '🌙 Night' : '☀️ Day'}</button>
    <button class="btn" data-act="png">Save image</button>
    <button class="btn ghost" data-act="restart">New site</button>`;
  crumb.textContent = `${BUILDINGS[state.type].name} · ${state.lot.width}×${state.lot.depth} ft lot`;
  draw();
}

function draw() {
  const body = document.getElementById('panelBody');
  if (body) body.innerHTML = panelFor(tab);
  const stage = document.getElementById('stage');
  if (!stage) return;
  const rect = stage.getBoundingClientRect();
  const size = { w: Math.max(320, Math.round(rect.width)), h: Math.max(240, Math.round(rect.height)) };
  const scene = render(state, size);
  stage.innerHTML = frame(state, size, scene.svg);
  const L = scene.layout;
  const readout = document.getElementById('readout');
  if (readout) {
    const bits = [`${state.lot.width}×${state.lot.depth} ft lot`, `${Math.round(state.body.length)}×${Math.round(state.body.width)} ft building`];
    if (state.type === 'tower') bits.push(`${state.body.floors} floors`);
    else if (L.dockRun) bits.push(`${L.dockRun.bays} dock bays`);
    if (state.office.on && state.type !== 'tower') bits.push(`${state.office.floors}-floor office`);
    if (L.stalls) bits.push(`${L.stalls.length} stalls`);
    readout.textContent = bits.join(' · ');
  }
  const t = tools.querySelector('[data-act="time"]');
  if (t) {
    t.textContent = state.view.time === 'night' ? '🌙 Night' : '☀️ Day';
    t.classList.toggle('on', state.view.time === 'night');
  }
}

/* ---------------------------------------------------------------- actions */

function applyType(id) {
  const preset = BUILDINGS[id];
  state.type = id;
  state.body = { ...preset.body };
  state.office = { ...preset.office };
  state.skin = { ...state.skin, wall: preset.color, windows: preset.office.windows };
  // Keep the lot at least big enough for the preset it just received.
  state.lot.width = Math.max(state.lot.width, preset.body.length + 120);
  state.lot.depth = Math.max(state.lot.depth, preset.body.width + 220);
  save();
  buildScreen();
}

async function savePng() {
  const svg = document.querySelector('#stage svg');
  if (!svg) return;
  const scale = 2;
  const w = svg.viewBox.baseVal.width;
  const h = svg.viewBox.baseVal.height;
  const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `site-${state.type}.png`;
    a.click();
  } catch {
    alert('This browser would not rasterise the view. Try a screenshot instead.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

document.addEventListener('click', (e) => {
  // Clicking a surface in the view is the fast way into its text.
  const hot = e.target.closest('.hot');
  if (hot) {
    tab = 'text';
    buildScreen();
    const field = document.getElementById(`c-signs.${hot.dataset.sign}.text`);
    if (field) { field.focus(); field.select(); }
    return;
  }

  const el = e.target.closest('[data-act], [data-kind]');
  if (!el) return;
  const act = el.dataset.act;
  const kind = el.dataset.kind;

  if (kind === 'toggle') return set(el.dataset.path, !get(el.dataset.path));
  if (kind === 'pick') {
    if (el.dataset.path === 'type') return applyType(el.dataset.value);
    return set(el.dataset.path, el.dataset.value);
  }

  switch (act) {
    case 'pick-type':
      pending.type = el.dataset.value;
      pending.lot = { ...BUILDINGS[el.dataset.value].lot };
      return startScreen();
    case 'break-ground':
      state = freshState(pending.type);
      state.lot = { ...pending.lot };
      tab = 'building';
      screen = 'build';
      save();
      return buildScreen();
    case 'tab':
      tab = el.dataset.value;
      document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b === el));
      return draw();
    case 'rotate':
      state.view.rot = (state.view.rot + 1) % 4;
      return set('view.rot', state.view.rot);
    case 'zoom-in':
      return set('view.zoom', Math.min(2.2, (state.view.zoom || 1) + 0.15));
    case 'zoom-out':
      return set('view.zoom', Math.max(0.6, (state.view.zoom || 1) - 0.15));
    case 'time':
      return set('view.time', state.view.time === 'night' ? 'day' : 'night');
    case 'png':
      return savePng();
    case 'restart':
      if (!confirm('Start a new site? This clears the current design.')) return;
      localStorage.removeItem(SAVE_KEY);
      pending = { type: state.type, lot: { ...state.lot } };
      screen = 'start';
      return startScreen();
    default:
  }
});

// The lot sliders on the start screen write to `pending`, not to the design.
document.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.act === 'lot-w' || el.dataset.act === 'lot-d') {
    pending.lot[el.dataset.act === 'lot-w' ? 'width' : 'depth'] = Number(el.value);
    const label = el.previousElementSibling?.querySelector('b');
    if (label) label.textContent = `${el.value} ft`;
    return;
  }
  if (!el.dataset.path) return;
  const value = el.dataset.kind === 'num' ? Number(el.value) : el.value;
  const path = el.dataset.path;
  const keys = path.split('.');
  const last = keys.pop();
  keys.reduce((o, k) => o[k], state)[last] = value;
  save();
  // Redraw the view without rebuilding the panel, so focus and caret survive.
  drawStageOnly();
  const label = document.querySelector(`label[for="c-${CSS.escape(path)}"] b`);
  if (label && el.dataset.kind === 'num') label.textContent = labelFor(path, value);
});

function labelFor(path, value) {
  if (path === 'body.floors' || path === 'office.floors') return `${value} · ${value * FLOOR_HEIGHT} ft`;
  if (path.startsWith('lot.') || path === 'body.length' || path === 'body.width' || path === 'body.height' || path === 'office.length') return `${value} ft`;
  return String(value);
}

function drawStageOnly() {
  const stage = document.getElementById('stage');
  if (!stage) return;
  const rect = stage.getBoundingClientRect();
  const size = { w: Math.max(320, Math.round(rect.width)), h: Math.max(240, Math.round(rect.height)) };
  const scene = render(state, size);
  stage.innerHTML = frame(state, size, scene.svg);
  const readout = document.getElementById('readout');
  if (readout) {
    const L = scene.layout;
    const bits = [`${state.lot.width}×${state.lot.depth} ft lot`, `${Math.round(state.body.length)}×${Math.round(state.body.width)} ft building`];
    if (state.type === 'tower') bits.push(`${state.body.floors} floors`);
    else if (L.dockRun) bits.push(`${L.dockRun.bays} dock bays`);
    if (L.stalls) bits.push(`${L.stalls.length} stalls`);
    readout.textContent = bits.join(' · ');
  }
}

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (screen === 'build') drawStageOnly(); }, 150);
});

screen === 'build' ? buildScreen() : startScreen();
