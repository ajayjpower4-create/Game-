/* Building Design Simulator — a site editor.
 *
 * The camera orbits freely, every object on the lot can be picked up, turned
 * or thrown away, and buildings are edited wall by wall and roof by roof. */

import {
  SITE_PRESETS, BUILDING_STYLES, ROOF_KIT, BOOTHS, PROPS, PROP_BY_ID, ROOF_BY_ID, BOOTH_BY_ID,
  CELLS, CLADDINGS, ROOF_TYPES, WALL_COLORS, SIGN_COLORS, LOGOS, FLOOR_HEIGHT, freshState, normalize, makeBuilding,
  buildingHeight, wallCols, newId,
} from './catalog.js';
import { render, frame, fitCamera, footprint, objHeight, isClear, bounds, buildingsOf } from './scene.js';
import { contains, corners, clamp } from './iso.js';

const SAVE_KEY = 'building-sim:v3';
const app = document.getElementById('app');
const tools = document.getElementById('tools');
const crumb = document.getElementById('crumb');

let state = load() || freshState('warehouse');
let screen = load() ? 'build' : 'start';
const ui = {
  tab: 'build',
  selected: null,
  hover: null,
  pending: null,      // an item armed for placement
  ghost: null,        // where it would land
  wall: 'N',
  paint: 'window',
  cat: 'Buildings',
  pointer: null,
  hint: '',
};
let pendingStart = { preset: 'warehouse', lot: { ...SITE_PRESETS.warehouse.lot } };
const undoStack = [];
const redoStack = [];

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
// Typing never fires `change` until the field loses focus, so edits are saved
// as they are made rather than waiting for a blur that may not come.
let saveTimer;
function queueSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 400);
}
function snapshot() {
  undoStack.push(JSON.stringify({ objects: state.objects, lot: state.lot, site: state.site }));
  if (undoStack.length > 60) undoStack.shift();
  redoStack.length = 0;
}
function restore(stack, other) {
  if (!stack.length) return;
  other.push(JSON.stringify({ objects: state.objects, lot: state.lot, site: state.site }));
  const snap = JSON.parse(stack.pop());
  state.objects = snap.objects;
  state.lot = snap.lot;
  state.site = snap.site;
  if (!state.objects.some((o) => o.id === ui.selected)) ui.selected = null;
  save();
  drawAll();
}

/* ----------------------------------------------------------------- helpers */

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const byId = (id) => state.objects.find((o) => o.id === id);
const selected = () => (ui.selected && !ui.selected.includes('#') ? byId(ui.selected) : null);
const selectedRoof = () => {
  if (!ui.selected || !ui.selected.includes('#')) return null;
  const [bid, idx] = ui.selected.split('#');
  const b = byId(bid);
  return b && b.roofItems[+idx] ? { b, idx: +idx, item: b.roofItems[+idx] } : null;
};
const specOf = (o) => (o.kind === 'booth' ? BOOTH_BY_ID[o.design] : o.kind === 'prop' ? PROP_BY_ID[o.type] : null);

function stageSize() {
  const stage = document.getElementById('stage');
  if (!stage) return { w: 900, h: 600 };
  const r = stage.getBoundingClientRect();
  return { w: Math.max(320, Math.round(r.width)), h: Math.max(240, Math.round(r.height)) };
}

/** Screen point -> world point on the plane at height z. */
function worldAt(ev, z = 0) {
  const stage = document.getElementById('stage');
  const r = stage.getBoundingClientRect();
  const cam = fitCamera(state, stageSize());
  return cam.unproject(ev.clientX - r.left, ev.clientY - r.top, z);
}

/** The building whose roof is under the pointer, tallest first. */
function roofUnder(ev) {
  const list = [...buildingsOf(state)].sort((a, b) => buildingHeight(b) - buildingHeight(a));
  for (const b of list) {
    const h = buildingHeight(b);
    const [x, y] = worldAt(ev, h);
    if (contains(footprint(b), x, y)) return { b, x, y, h };
  }
  return null;
}

/** Local (unrotated) offset of a world point inside a building. */
function toLocal(b, x, y) {
  const a = -(b.rot || 0) * Math.PI / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const dx = x - (b.x + b.w / 2);
  const dy = y - (b.y + b.d / 2);
  return { dx: dx * ca - dy * sa + b.w / 2, dy: dx * sa + dy * ca + b.d / 2 };
}

const snapXY = (v, step = 2) => Math.round(v / step) * step;

/* ------------------------------------------------------------- start screen */

function startScreen() {
  const cards = Object.entries(SITE_PRESETS).map(([id, p]) => `
    <button class="card${pendingStart.preset === id ? ' on' : ''}" data-act="pick-preset" data-value="${id}">
      <span class="icon">${p.icon}</span><strong>${esc(p.name)}</strong><p>${esc(p.blurb)}</p>
    </button>`).join('');
  app.innerHTML = `<div class="start">
    <h1>Start a site</h1>
    <p class="lede">Pick something to start from — you can add, move, turn and delete everything on it
      afterwards, including the buildings.</p>
    <div class="cards">${cards}</div>
    <div class="divider"></div>
    <h2>Lot size</h2>
    <div class="field"><label for="lw">Frontage<b>${pendingStart.lot.width} ft</b></label>
      <input id="lw" type="range" min="240" max="1000" step="20" value="${pendingStart.lot.width}" data-act="lot-w"></div>
    <div class="field"><label for="ld">Depth<b>${pendingStart.lot.depth} ft</b></label>
      <input id="ld" type="range" min="240" max="800" step="20" value="${pendingStart.lot.depth}" data-act="lot-d"></div>
    <p class="hint">${(pendingStart.lot.width * pendingStart.lot.depth / 43560).toFixed(2)} acres.</p>
    <button class="btn primary" data-act="break-ground">Break ground →</button>
  </div>`;
  tools.innerHTML = '';
  crumb.textContent = 'Orbit, zoom, place, edit';
}

/* ------------------------------------------------------------ build screen */

const TABS = [['build', 'Add'], ['selected', 'Selected'], ['site', 'Site'], ['view', 'View']];

function buildScreen() {
  app.innerHTML = `<div class="workshop">
    <div class="stagewrap">
      <div class="stage" id="stage"></div>
      <div class="stagehud">
        <div class="camrow">
          <button class="btn sq" data-act="orbit" data-value="-30" title="Orbit left">↺</button>
          <button class="btn sq" data-act="orbit" data-value="30" title="Orbit right">↻</button>
          <button class="btn sq" data-act="tilt" data-value="8" title="Tilt down">▾</button>
          <button class="btn sq" data-act="tilt" data-value="-8" title="Tilt up">▴</button>
          <button class="btn sq" data-act="zoom" data-value="1.25" title="Zoom in">+</button>
          <button class="btn sq" data-act="zoom" data-value="0.8" title="Zoom out">−</button>
          <button class="btn sq" data-act="cam-reset" title="Reset view">⟲</button>
        </div>
        <span class="readout" id="readout"></span>
      </div>
      <div class="hintbar" id="hintbar"></div>
    </div>
    <div class="panel">
      <div class="tabs">${TABS.map(([id, label]) => `<button data-act="tab" data-value="${id}" class="${ui.tab === id ? 'active' : ''}">${label}</button>`).join('')}</div>
      <div class="panel-body" id="panelBody"></div>
    </div>
  </div>`;
  tools.innerHTML = `
    <button class="btn sq" data-act="undo" title="Undo (Ctrl+Z)">↶</button>
    <button class="btn sq" data-act="redo" title="Redo">↷</button>
    <button class="btn ${state.view.time === 'night' ? 'on' : ''}" data-act="time">${state.view.time === 'night' ? '🌙 Night' : '☀️ Day'}</button>
    <button class="btn" data-act="png">Save image</button>
    <button class="btn ghost" data-act="restart">New site</button>`;
  crumb.textContent = `${state.objects.length} objects · ${state.lot.width}×${state.lot.depth} ft lot`;
  bindStage();
  drawAll();
}

function drawAll() {
  drawPanel();
  drawStage();
}

let framePending = false;
let settleTimer;
function scheduleStage(fast) {
  if (framePending) return;
  framePending = true;
  requestAnimationFrame(() => { framePending = false; drawStage(fast); });
}

function drawStage(fast = false) {
  const stage = document.getElementById('stage');
  if (!stage) return;
  // The cheap pass drops shadows, texture and the hit shapes, so the view must
  // always settle back to the full one — a text field never fires `change`
  // until it loses focus, and an un-settled stage is not clickable.
  clearTimeout(settleTimer);
  if (fast) settleTimer = setTimeout(() => drawStage(false), 220);
  const size = stageSize();
  const scene = render(state, size, { fast, selected: ui.selected, hover: ui.hover, ghost: ui.ghost });
  stage.innerHTML = frame(state, size, scene.svg);
  const readout = document.getElementById('readout');
  if (readout) {
    readout.textContent = `${Math.round(state.view.yaw)}° · tilt ${Math.round(state.view.pitch)}° · ${(state.view.zoom || 1).toFixed(2)}×`;
  }
  const hb = document.getElementById('hintbar');
  if (hb) {
    const blocked = ui.pending && ui.ghost && !ui.ghost.ok;
    hb.textContent = ui.hint || (ui.pending
      ? (blocked
        ? (ui.pending.kind === 'roof' ? 'Hover a roof to put this on' : 'Blocked — that spot is inside a building')
        : `Placing ${ui.pending.name} · click to drop · shift-click to keep placing · R turns it · Esc cancels`)
      : 'Drag to orbit · shift-drag to pan · wheel to zoom · click anything to select');
    hb.classList.toggle('warn', !!ui.pending);
    hb.classList.toggle('bad', !!blocked);
  }
  const t = tools.querySelector('[data-act="time"]');
  if (t) {
    t.textContent = state.view.time === 'night' ? '🌙 Night' : '☀️ Day';
    t.classList.toggle('on', state.view.time === 'night');
  }
}

/* ------------------------------------------------------------------ panels */

const CATS = ['Buildings', 'Roof plant', 'Booths', 'Boundary', 'Signs', 'Lighting', 'Planting', 'Yard', 'Vehicles'];

function itemButton(kind, key, icon, name, armed) {
  return `<button class="item${armed ? ' on' : ''}" data-act="arm" data-kind="${kind}" data-key="${key}" title="${esc(name)}">
    <span class="ic">${icon}</span><span class="nm">${esc(name)}</span></button>`;
}

function palettePanel() {
  const armedKey = ui.pending ? `${ui.pending.kind}:${ui.pending.key}` : '';
  const isArmed = (kind, key) => armedKey === `${kind}:${key}`;
  let items = '';
  if (ui.cat === 'Buildings') {
    items = Object.entries(BUILDING_STYLES).map(([id, b]) => itemButton('building', id, b.icon, b.name, isArmed('building', id))).join('');
  } else if (ui.cat === 'Roof plant') {
    items = ROOF_KIT.map((m) => itemButton('roof', m.id, m.icon, m.name, isArmed('roof', m.id))).join('');
  } else if (ui.cat === 'Booths') {
    items = BOOTHS.map((b) => itemButton('booth', b.id, b.icon, b.name, isArmed('booth', b.id))).join('');
  } else {
    items = PROPS.filter((p) => p.cat === ui.cat).map((p) => itemButton('prop', p.id, p.icon, p.name, isArmed('prop', p.id))).join('');
  }
  return `<h2>Add to the site</h2>
    <p class="hint">Pick a thing, then click the ground to drop it. Roof machines go on a roof.</p>
    <div class="chips catrow">${CATS.map((c) => `<button class="chip${ui.cat === c ? ' on' : ''}" data-act="cat" data-value="${c}">${c}</button>`).join('')}</div>
    <div class="grid-items">${items}</div>
    ${ui.pending ? `<p class="note">Placing <b>${esc(ui.pending.name)}</b> — click the view. <button class="btn tiny" data-act="cancel">Cancel</button></p>` : ''}`;
}

function signFields(prefix, sign, opts = {}) {
  return `
    <div class="field"><label for="${prefix}-text">Sign text</label>
      <input id="${prefix}-text" type="text" maxlength="46" value="${esc(sign.text || '')}" data-act="sign" data-key="text" placeholder="Type a name"></div>
    ${opts.sub ? `<div class="field"><label for="${prefix}-sub">Tagline</label>
      <input id="${prefix}-sub" type="text" maxlength="46" value="${esc(sign.sub || '')}" data-act="sign" data-key="sub" placeholder="Optional"></div>` : ''}
    <div class="field"><label>Font colour</label><div class="chips">
      ${SIGN_COLORS.map((c) => `<button class="chip swatch${sign.color === c.hex ? ' on' : ''}" style="background:${c.hex}" title="${c.name}" data-act="sign" data-key="color" data-value="${c.hex}"></button>`).join('')}
    </div></div>
    <div class="field"><label>Logo</label><div class="chips">
      ${LOGOS.map((l) => `<button class="chip glyph${(sign.logo || '') === l ? ' on' : ''}" data-act="sign" data-key="logo" data-value="${l}">${l || '—'}</button>`).join('')}
    </div></div>`;
}

function wallEditor(b) {
  const face = ui.wall;
  const g = b.walls[face];
  const cols = wallCols(b, face);
  const label = { N: 'Front', E: 'Right', S: 'Back', W: 'Left' };
  let cells = '';
  for (let row = g.length - 1; row >= 0; row--) {
    for (let col = 0; col < cols; col++) {
      const t = g[row][col];
      const spec = CELLS.find((c) => c.id === t) || CELLS[0];
      cells += `<button class="cell${t !== 'blank' ? ' filled' : ''}" data-act="cell" data-face="${face}" data-row="${row}" data-col="${col}"
        title="Floor ${row + 1}, bay ${col + 1}: ${spec.name}">${t === 'blank' ? '' : spec.icon}</button>`;
    }
  }
  return `
    <h3>Walls</h3>
    <p class="hint">Paint one bay at a time. Doors and loading bays only go on the ground floor.</p>
    <div class="chips">${['N', 'E', 'S', 'W'].map((f) => `<button class="chip${face === f ? ' on' : ''}" data-act="wall" data-value="${f}">${label[f]}</button>`).join('')}</div>
    <div class="field" style="margin-top:12px"><label>Brush</label><div class="chips">
      ${CELLS.map((c) => `<button class="chip${ui.paint === c.id ? ' on' : ''}" data-act="paint" data-value="${c.id}">${c.icon} ${c.name}</button>`).join('')}
    </div></div>
    <div class="wallwrap"><div class="wallgrid" style="grid-template-columns:repeat(${cols},minmax(19px,1fr))">${cells}</div></div>
    <div class="row tight">
      <button class="btn tiny" data-act="bays" data-value="-1">− bay</button>
      <button class="btn tiny" data-act="bays" data-value="1">+ bay</button>
      <span class="mini">${cols} bays across</span>
    </div>
    <div class="row tight">
      <button class="btn tiny" data-act="fillwall">Fill wall with brush</button>
      <button class="btn tiny" data-act="clearwall">Clear wall</button>
    </div>`;
}

function roofEditor(b) {
  const list = (b.roofItems || []).map((it, i) => {
    const spec = ROOF_BY_ID[it.type];
    return `<li class="${ui.selected === `${b.id}#${i}` ? 'on' : ''}">
      <button class="linkish" data-act="pick-roof" data-value="${i}">${spec ? spec.icon : '▫'} ${esc(spec ? spec.name : it.type)}</button>
      <span>
        <button class="btn tiny" data-act="roof-rot" data-value="${i}">↻</button>
        <button class="btn tiny danger" data-act="roof-del" data-value="${i}">✕</button>
      </span></li>`;
  }).join('');
  return `<h3>Roof</h3>
    <p class="hint">Pick a machine, then click this building's roof. Nothing appears up there unless you put it there.</p>
    <div class="grid-items small">${ROOF_KIT.map((m) => itemButton('roof', m.id, m.icon, m.name,
      ui.pending && ui.pending.kind === 'roof' && ui.pending.key === m.id)).join('')}</div>
    ${list ? `<ul class="objlist">${list}</ul>` : '<p class="note">Nothing on this roof yet.</p>'}`;
}

function buildingPanel(b) {
  const H = buildingHeight(b);
  const single = b.floors === 1;
  return `<h2>${esc(b.name)}</h2>
    <p class="hint">${Math.round(b.w)} × ${Math.round(b.d)} ft · ${b.floors} floor${b.floors > 1 ? 's' : ''} · ${Math.round(H)} ft tall</p>
    ${objActions(b)}
    <div class="field"><label for="p-w">Width<b>${Math.round(b.w)} ft</b></label>
      <input id="p-w" type="range" min="20" max="600" step="5" value="${Math.round(b.w)}" data-act="num" data-key="w"></div>
    <div class="field"><label for="p-d">Depth<b>${Math.round(b.d)} ft</b></label>
      <input id="p-d" type="range" min="20" max="400" step="5" value="${Math.round(b.d)}" data-act="num" data-key="d"></div>
    <div class="field"><label for="p-floors">Floors<b>${b.floors}</b></label>
      <input id="p-floors" type="range" min="1" max="30" step="1" value="${b.floors}" data-act="num" data-key="floors"></div>
    ${single ? `<div class="field"><label for="p-height">Wall height<b>${Math.round(H)} ft</b></label>
      <input id="p-height" type="range" min="9" max="70" step="1" value="${Math.round(H)}" data-act="num" data-key="height"></div>` : ''}
    <div class="field"><label>Wall colour</label><div class="chips">
      ${WALL_COLORS.map((c) => `<button class="chip swatch${b.wall === c.hex ? ' on' : ''}" style="background:${c.hex}" title="${c.name}" data-act="set" data-key="wall" data-value="${c.hex}"></button>`).join('')}
    </div></div>
    <div class="field"><label>Trim colour</label><div class="chips">
      ${SIGN_COLORS.map((c) => `<button class="chip swatch${b.band === c.hex ? ' on' : ''}" style="background:${c.hex}" title="${c.name}" data-act="set" data-key="band" data-value="${c.hex}"></button>`).join('')}
    </div></div>
    <div class="field"><label>Cladding</label><div class="chips">
      ${CLADDINGS.map((c) => `<button class="chip${(b.cladding || 'precast') === c.id ? ' on' : ''}" data-act="set" data-key="cladding" data-value="${c.id}">${c.name}</button>`).join('')}
    </div></div>
    <div class="field"><label>Roof</label><div class="chips">
      ${ROOF_TYPES.map((c) => `<button class="chip${(b.roofType || 'flat') === c.id ? ' on' : ''}" data-act="set" data-key="roofType" data-value="${c.id}">${c.name}</button>`).join('')}
    </div></div>
    <div class="toggles"><button class="toggle${b.parapet !== false ? ' on' : ''}" data-act="toggle" data-key="parapet">
      <span>Parapet band</span><span class="pill">${b.parapet !== false ? 'On' : 'Off'}</span></button></div>
    <div class="divider"></div>
    ${wallEditor(b)}
    <div class="divider"></div>
    ${roofEditor(b)}
    <div class="divider"></div>
    <h3>Sign</h3>
    <div class="toggles"><button class="toggle${b.sign.on ? ' on' : ''}" data-act="signtoggle">
      <span>Name on the wall</span><span class="pill">${b.sign.on ? 'On' : 'Off'}</span></button></div>
    <div class="field" style="margin-top:10px"><label>Which wall</label><div class="chips">
      ${['N', 'E', 'S', 'W'].map((f) => `<button class="chip${b.sign.face === f ? ' on' : ''}" data-act="sign" data-key="face" data-value="${f}">${{ N: 'Front', E: 'Right', S: 'Back', W: 'Left' }[f]}</button>`).join('')}
    </div></div>
    ${signFields('b', b.sign, { sub: true })}`;
}

function boothPanel(o) {
  return `<h2>Guard booth</h2>
    <p class="hint">Ten designs. Turn it to face the way you want.</p>
    ${objActions(o)}
    <div class="field"><label>Design</label><div class="grid-items small">
      ${BOOTHS.map((b) => `<button class="item${o.design === b.id ? ' on' : ''}" data-act="set" data-key="design" data-value="${b.id}">
        <span class="ic">${b.icon}</span><span class="nm">${esc(b.name)}</span></button>`).join('')}
    </div></div>
    <div class="divider"></div>
    <h3>Fascia sign</h3>
    ${signFields('g', o.sign || {})}`;
}

function propPanel(o) {
  const spec = PROP_BY_ID[o.type] || {};
  return `<h2>${esc(spec.name || o.type)}</h2>
    <p class="hint">${esc(spec.cat || '')}</p>
    ${objActions(o)}
    ${spec.len ? `<div class="field"><label for="p-len">Length<b>${Math.round(o.w != null ? o.w : spec.w)} ft</b></label>
      <input id="p-len" type="range" min="8" max="200" step="2" value="${Math.round(o.w != null ? o.w : spec.w)}" data-act="num" data-key="w"></div>` : ''}
    ${spec.color ? `<div class="field"><label>Colour</label><div class="chips">
      ${['#c8ccd2', '#26374f', '#7d2f2f', '#1e2229', '#e9ebee', '#35543f', '#8d5a24', '#2c4a7c'].map((c) => `<button class="chip swatch${o.color === c ? ' on' : ''}" style="background:${c}" data-act="set" data-key="color" data-value="${c}"></button>`).join('')}
    </div></div>` : ''}
    ${spec.sign ? `<div class="divider"></div><h3>Sign</h3>${signFields('s', o.sign || {})}` : ''}`;
}

function roofItemPanel(sel) {
  const spec = ROOF_BY_ID[sel.item.type] || {};
  return `<h2>${esc(spec.name || sel.item.type)}</h2>
    <p class="hint">On the roof of ${esc(sel.b.name)} · drag it around up there.</p>
    <div class="row tight">
      <button class="btn" data-act="rot" data-value="-15">↺ 15°</button>
      <button class="btn" data-act="rot" data-value="15">↻ 15°</button>
      <button class="btn danger" data-act="delete">Delete</button>
    </div>
    <p class="note">Click the building itself to get back to its walls and roof list.</p>`;
}

function objActions(o) {
  return `<div class="row tight">
      <button class="btn" data-act="rot" data-value="-15">↺ 15°</button>
      <button class="btn" data-act="rot" data-value="15">↻ 15°</button>
      <button class="btn" data-act="rot" data-value="90">↻ 90°</button>
      <button class="btn" data-act="dup">Duplicate</button>
      <button class="btn danger" data-act="delete">Delete</button>
    </div>
    <p class="note">At ${Math.round(o.x)}, ${Math.round(o.y)} ft · turned ${Math.round(((o.rot || 0) % 360 + 360) % 360)}°.
      Drag it in the view, or nudge with the arrow keys.</p>`;
}

function sitePanel() {
  const counts = {};
  for (const o of state.objects) {
    const k = o.kind === 'building' ? 'buildings' : o.kind === 'booth' ? 'booths' : (PROP_BY_ID[o.type] || {}).cat || 'props';
    counts[k] = (counts[k] || 0) + 1;
  }
  const t = (key, label, hint) => `<button class="toggle${state.site[key] ? ' on' : ''}" data-act="site" data-key="${key}">
    <span>${label}${hint ? `<br><small>${hint}</small>` : ''}</span><span class="pill">${state.site[key] ? 'On' : 'Off'}</span></button>`;
  return `<h2>Site</h2>
    <p class="hint">The ground under everything. Buildings and props are objects — add them from the Add tab.</p>
    <div class="field"><label for="s-w">Lot frontage<b>${state.lot.width} ft</b></label>
      <input id="s-w" type="range" min="240" max="1000" step="20" value="${state.lot.width}" data-act="lot" data-key="width"></div>
    <div class="field"><label for="s-d">Lot depth<b>${state.lot.depth} ft</b></label>
      <input id="s-d" type="range" min="240" max="800" step="20" value="${state.lot.depth}" data-act="lot" data-key="depth"></div>
    <div class="toggles">
      ${t('pavement', 'Pavement', 'Paves around whatever you have built')}
      ${t('parking', 'Parking bays', 'Lays out around buildings and truck courts')}
      ${t('cars', 'Parked cars')}
      ${t('markings', 'Road markings', 'Crossings at doors, arrows at the gate')}
      ${t('road', 'Street and footway')}
      ${t('grass', 'Grass texture')}
    </div>
    <div class="divider"></div>
    <p class="note">On the lot: ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(' · ') || 'nothing yet'}.</p>
    <button class="btn tiny danger" data-act="clear-props">Delete every prop</button>`;
}

function viewPanel() {
  const v = state.view;
  const preset = (name, yaw, pitch, zoom) => `<button class="chip" data-act="campreset" data-value="${yaw},${pitch},${zoom}">${name}</button>`;
  return `<h2>Camera</h2>
    <p class="hint">Fly around it. Drag the view to orbit, shift-drag to pan, wheel to zoom.</p>
    <div class="field"><label for="v-yaw">Compass<b>${Math.round(v.yaw)}°</b></label>
      <input id="v-yaw" type="range" min="0" max="359" step="1" value="${Math.round(v.yaw)}" data-act="view" data-key="yaw"></div>
    <div class="field"><label for="v-pitch">Tilt<b>${Math.round(v.pitch)}°</b></label>
      <input id="v-pitch" type="range" min="6" max="86" step="1" value="${Math.round(v.pitch)}" data-act="view" data-key="pitch"></div>
    <div class="field"><label for="v-zoom">Zoom<b>${(v.zoom || 1).toFixed(2)}×</b></label>
      <input id="v-zoom" type="range" min="0.4" max="6" step="0.05" value="${v.zoom || 1}" data-act="view" data-key="zoom"></div>
    <div class="field"><label>Jump to</label><div class="chips">
      ${preset('Front', 45, 34, 1)}${preset('Back', 225, 34, 1)}${preset('Left', 135, 34, 1)}${preset('Right', 315, 34, 1)}
      ${preset('Overhead', 45, 84, 1)}${preset('Street level', 20, 9, 2.2)}${preset('Drone', 60, 20, 1.8)}
    </div></div>
    <div class="toggles"><button class="toggle${state.view.time === 'night' ? ' on' : ''}" data-act="time">
      <span>Night</span><span class="pill">${state.view.time === 'night' ? 'On' : 'Off'}</span></button></div>`;
}

function drawPanel() {
  const body = document.getElementById('panelBody');
  if (!body) return;
  let html = '';
  if (ui.tab === 'build') html = palettePanel();
  else if (ui.tab === 'site') html = sitePanel();
  else if (ui.tab === 'view') html = viewPanel();
  else {
    const roof = selectedRoof();
    const o = selected();
    if (roof) html = roofItemPanel(roof);
    else if (!o) html = '<h2>Nothing selected</h2><p class="hint">Click anything in the view — a building, a booth, a trailer, a sign — to edit it, turn it or delete it.</p>';
    else if (o.kind === 'building') html = buildingPanel(o);
    else if (o.kind === 'booth') html = boothPanel(o);
    else html = propPanel(o);
  }
  body.innerHTML = html;
  document.querySelectorAll('.tabs button').forEach((btn) => btn.classList.toggle('active', btn.dataset.value === ui.tab));
}

/* ------------------------------------------------------------- grid edits */

function setFloors(b, n) {
  n = clamp(Math.round(n), 1, 30);
  for (const f of ['N', 'E', 'S', 'W']) {
    const g = b.walls[f];
    const cols = g[0] ? g[0].length : 4;
    while (g.length > n) g.pop();
    while (g.length < n) g.push(Array.from({ length: cols }, () => (b.style === 'tower' ? 'glass' : 'window')));
  }
  b.floors = n;
  if (b.height != null && n > 1) b.height = null;   // floors take over from a set wall height
}

function setBays(b, face, n) {
  const g = b.walls[face];
  const cols = g[0] ? g[0].length : 1;
  n = clamp(Math.round(n), 1, 60);
  for (const row of g) {
    while (row.length > n) row.pop();
    while (row.length < n) row.push('blank');
  }
  return n !== cols;
}

/* --------------------------------------------------------------- placement */

function armItem(kind, key) {
  const make = () => {
    if (kind === 'building') {
      const b = makeBuilding(key, { wall: state.skin.wall, band: state.skin.band });
      b.sign.on = false;
      return b;
    }
    if (kind === 'booth') return { id: 'ghost', kind: 'booth', design: key, rot: 0, x: 0, y: 0, sign: { text: 'SECURITY', color: '#ffffff', logo: '🛡️' } };
    if (kind === 'roof') return { id: 'ghost', kind: 'roof', type: key, rot: 0, x: 0, y: 0 };
    const spec = PROP_BY_ID[key];
    return { id: 'ghost', kind: 'prop', type: key, rot: 0, x: 0, y: 0, w: spec.w, d: spec.d, ...(spec.sign ? { sign: { text: 'SIGN', color: '#ffffff', logo: '' } } : {}) };
  };
  const names = {
    building: (BUILDING_STYLES[key] || {}).name,
    booth: (BOOTH_BY_ID[key] || {}).name,
    roof: (ROOF_BY_ID[key] || {}).name,
    prop: (PROP_BY_ID[key] || {}).name,
  };
  ui.pending = { kind, key, name: names[kind] || key, obj: make() };
  ui.selected = null;
  ui.ghost = null;
  drawAll();
}

function ghostAt(ev) {
  const p = ui.pending;
  if (!p) return null;
  const o = p.obj;
  if (p.kind === 'roof') {
    const hit = roofUnder(ev);
    const spec = ROOF_BY_ID[p.key];
    if (!hit) {
      const [x, y] = worldAt(ev, 0);
      o.x = x - spec.w / 2; o.y = y - spec.d / 2;
      return { obj: o, ok: false, z: 0 };
    }
    o.x = hit.x - spec.w / 2; o.y = hit.y - spec.d / 2;
    ui.roofTarget = hit.b;
    return { obj: o, ok: true, z: hit.h };
  }
  const [x, y] = worldAt(ev, 0);
  const fp = footprint(o);
  o.x = snapXY(x - fp.w / 2);
  o.y = snapXY(y - fp.d / 2);
  const ok = o.kind === 'building' ? true : isClear(state, footprint(o));
  return { obj: o, ok, z: 0 };
}

function placeGhost() {
  const p = ui.pending;
  if (!p || !ui.ghost) return;
  if (!ui.ghost.ok && p.kind !== 'building') {
    ui.hint = p.kind === 'roof' ? 'That is not over a roof.' : 'That would sit inside a building.';
    drawStage();
    return;
  }
  snapshot();
  if (p.kind === 'roof') {
    const b = ui.roofTarget;
    if (!b) return;
    const spec = ROOF_BY_ID[p.key];
    const local = toLocal(b, p.obj.x + spec.w / 2, p.obj.y + spec.d / 2);
    b.roofItems.push({ type: p.key, dx: local.dx, dy: local.dy, rot: p.obj.rot - (b.rot || 0) });
    ui.selected = `${b.id}#${b.roofItems.length - 1}`;
  } else {
    const copy = JSON.parse(JSON.stringify(p.obj));
    copy.id = newId(p.kind[0]);
    state.objects.push(copy);
    ui.selected = copy.id;
  }
  ui.hint = '';
  save();
  // Shift keeps the tool armed so a run of fence or bollards is quick.
  if (!ui.shift) { ui.pending = null; ui.ghost = null; ui.tab = 'selected'; }
  drawAll();
}

/* -------------------------------------------------------------- the stage */

let drag = null;

function bindStage() {
  const stage = document.getElementById('stage');
  if (!stage) return;
  stage.addEventListener('pointerdown', onDown);
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerleave', () => { ui.hover = null; });
  stage.addEventListener('wheel', onWheel, { passive: false });
  window.addEventListener('pointerup', onUp);
}

function onDown(ev) {
  ev.preventDefault();
  const stage = document.getElementById('stage');
  stage.setPointerCapture?.(ev.pointerId);
  ui.shift = ev.shiftKey;
  if (ui.pending) {
    ui.ghost = ghostAt(ev);
    placeGhost();
    return;
  }
  const hit = ev.target.closest?.('[data-id]');
  if (hit && !ev.shiftKey) {
    const id = hit.dataset.id;
    ui.selected = id;
    ui.tab = 'selected';
    const roof = selectedRoof();
    if (roof) {
      const w = worldAt(ev, buildingHeight(roof.b));
      drag = { mode: 'roof', roof, start: w, from: { dx: roof.item.dx, dy: roof.item.dy }, moved: false };
    } else {
      const o = byId(id);
      const w = worldAt(ev, 0);
      drag = { mode: 'move', id, start: w, from: { x: o.x, y: o.y }, moved: false };
    }
    snapshot();
    drawAll();
    return;
  }
  drag = {
    mode: ev.shiftKey || ev.button === 1 ? 'pan' : 'orbit',
    sx: ev.clientX, sy: ev.clientY,
    yaw: state.view.yaw, pitch: state.view.pitch,
    panX: state.view.panX || 0, panY: state.view.panY || 0,
    world: worldAt(ev, 0), moved: false,
  };
  if (!hit) { ui.selected = null; drawPanel(); }
}

function onMove(ev) {
  if (!drag) {
    if (ui.pending) {
      ui.ghost = ghostAt(ev);
      scheduleStage(true);
      return;
    }
    const hit = ev.target.closest?.('[data-id]');
    const id = hit ? hit.dataset.id : null;
    if (id !== ui.hover) { ui.hover = id; scheduleStage(true); }
    return;
  }
  drag.moved = true;
  if (drag.mode === 'orbit') {
    state.view.yaw = (drag.yaw - (ev.clientX - drag.sx) * 0.42 + 360) % 360;
    state.view.pitch = clamp(drag.pitch + (ev.clientY - drag.sy) * 0.28, 6, 86);
    scheduleStage(true);
  } else if (drag.mode === 'pan') {
    // Keep the ground point that was grabbed under the pointer.
    state.view.panX = drag.panX;
    state.view.panY = drag.panY;
    const now = worldAt(ev, 0);
    state.view.panX = drag.panX + (drag.world[0] - now[0]);
    state.view.panY = drag.panY + (drag.world[1] - now[1]);
    scheduleStage(true);
  } else if (drag.mode === 'move') {
    const o = byId(drag.id);
    if (!o) return;
    const now = worldAt(ev, 0);
    o.x = snapXY(drag.from.x + (now[0] - drag.start[0]));
    o.y = snapXY(drag.from.y + (now[1] - drag.start[1]));
    ui.badDrop = o.kind !== 'building' && !isClear(state, footprint(o), o.id);
    ui.hint = ui.badDrop ? 'That would sit inside a building — it will spring back.' : '';
    scheduleStage(true);
  } else if (drag.mode === 'roof') {
    const { roof } = drag;
    const now = worldAt(ev, buildingHeight(roof.b));
    const local = toLocal(roof.b, now[0], now[1]);
    const startLocal = toLocal(roof.b, drag.start[0], drag.start[1]);
    const spec = ROOF_BY_ID[roof.item.type] || { w: 8, d: 6 };
    roof.item.dx = clamp(drag.from.dx + (local.dx - startLocal.dx), spec.w / 2 + 1, roof.b.w - spec.w / 2 - 1);
    roof.item.dy = clamp(drag.from.dy + (local.dy - startLocal.dy), spec.d / 2 + 1, roof.b.d - spec.d / 2 - 1);
    scheduleStage(true);
  }
}

function onUp() {
  if (!drag) return;
  if (drag.mode === 'move' && drag.moved) {
    const o = byId(drag.id);
    if (o && o.kind !== 'building' && !isClear(state, footprint(o), o.id)) {
      o.x = drag.from.x;
      o.y = drag.from.y;
      ui.hint = 'Put back — that spot is inside a building.';
    } else {
      ui.hint = '';
    }
    save();
  } else if ((drag.mode === 'roof' || drag.mode === 'move') && !drag.moved) {
    undoStack.pop();   // a click that only selected does not need an undo step
  } else if (drag.mode === 'roof') {
    save();
  }
  ui.badDrop = false;
  drag = null;
  drawAll();
}

function onWheel(ev) {
  ev.preventDefault();
  state.view.zoom = clamp((state.view.zoom || 1) * Math.pow(1.0016, -ev.deltaY), 0.4, 6);
  scheduleStage(true);
  clearTimeout(onWheel.t);
  onWheel.t = setTimeout(() => { save(); drawStage(); }, 160);
}

/* ----------------------------------------------------------------- actions */

function deleteSelected() {
  const roof = selectedRoof();
  snapshot();
  if (roof) {
    roof.b.roofItems.splice(roof.idx, 1);
    ui.selected = roof.b.id;
  } else if (ui.selected) {
    state.objects = state.objects.filter((o) => o.id !== ui.selected);
    ui.selected = null;
  }
  save();
  drawAll();
}

function rotateSelected(deg) {
  const roof = selectedRoof();
  snapshot();
  if (roof) roof.item.rot = ((roof.item.rot || 0) + deg) % 360;
  else {
    const o = selected();
    if (!o) return;
    o.rot = (((o.rot || 0) + deg) % 360 + 360) % 360;
    if (o.kind !== 'building' && !isClear(state, footprint(o), o.id)) o.rot = (((o.rot || 0) - deg) % 360 + 360) % 360;
  }
  save();
  drawAll();
}

function applyAction(el, ev) {
  const act = el.dataset.act;
  const key = el.dataset.key;
  const value = el.dataset.value;
  const o = selected();

  switch (act) {
    case 'tab': ui.tab = value; return drawPanel();
    case 'cat': ui.cat = value; return drawPanel();
    case 'arm': return armItem(el.dataset.kind, el.dataset.key);
    case 'cancel': ui.pending = null; ui.ghost = null; return drawAll();
    case 'wall': ui.wall = value; return drawPanel();
    case 'paint': ui.paint = value; return drawPanel();
    case 'cell': {
      if (!o || o.kind !== 'building') return;
      const row = +el.dataset.row;
      const col = +el.dataset.col;
      const spec = CELLS.find((c) => c.id === ui.paint) || CELLS[0];
      if (row > 0 && !spec.upper) { ui.hint = `${spec.name} only goes on the ground floor.`; return drawStage(); }
      snapshot();
      o.walls[el.dataset.face][row][col] = o.walls[el.dataset.face][row][col] === ui.paint ? 'blank' : ui.paint;
      save();
      return drawAll();
    }
    case 'bays': {
      if (!o || o.kind !== 'building') return;
      snapshot();
      setBays(o, ui.wall, wallCols(o, ui.wall) + (+value));
      save();
      return drawAll();
    }
    case 'fillwall': {
      if (!o || o.kind !== 'building') return;
      const spec = CELLS.find((c) => c.id === ui.paint) || CELLS[0];
      snapshot();
      o.walls[ui.wall].forEach((row, i) => {
        if (i > 0 && !spec.upper) return;
        for (let c = 0; c < row.length; c++) row[c] = ui.paint;
      });
      save();
      return drawAll();
    }
    case 'clearwall': {
      if (!o || o.kind !== 'building') return;
      snapshot();
      o.walls[ui.wall].forEach((row) => { for (let c = 0; c < row.length; c++) row[c] = 'blank'; });
      save();
      return drawAll();
    }
    case 'pick-roof': ui.selected = `${o.id}#${value}`; return drawAll();
    case 'roof-rot': {
      if (!o) return;
      snapshot();
      o.roofItems[+value].rot = ((o.roofItems[+value].rot || 0) + 45) % 360;
      save();
      return drawAll();
    }
    case 'roof-del': {
      if (!o) return;
      snapshot();
      o.roofItems.splice(+value, 1);
      save();
      return drawAll();
    }
    case 'rot': return rotateSelected(+value);
    case 'delete': return deleteSelected();
    case 'dup': {
      if (!o) return;
      snapshot();
      const copy = JSON.parse(JSON.stringify(o));
      copy.id = newId(o.kind[0]);
      copy.x += 14;
      copy.y += 14;
      state.objects.push(copy);
      ui.selected = copy.id;
      save();
      return drawAll();
    }
    case 'set': {
      if (!o) return;
      snapshot();
      o[key] = value;
      save();
      return drawAll();
    }
    case 'toggle': {
      if (!o) return;
      snapshot();
      o[key] = o[key] === false;
      save();
      return drawAll();
    }
    case 'signtoggle': {
      if (!o) return;
      snapshot();
      o.sign.on = !o.sign.on;
      save();
      return drawAll();
    }
    case 'sign': {
      if (!o || value === undefined) return;
      snapshot();
      o.sign = { ...(o.sign || {}), [key]: value };
      save();
      return drawAll();
    }
    case 'site': {
      snapshot();
      state.site[key] = !state.site[key];
      save();
      return drawAll();
    }
    case 'clear-props': {
      if (!confirm('Delete every prop, booth and vehicle? Buildings stay.')) return;
      snapshot();
      state.objects = state.objects.filter((x) => x.kind === 'building');
      ui.selected = null;
      save();
      return drawAll();
    }
    case 'campreset': {
      const [yaw, pitch, zoom] = value.split(',').map(Number);
      Object.assign(state.view, { yaw, pitch, zoom, panX: 0, panY: 0 });
      save();
      return drawAll();
    }
    case 'orbit': state.view.yaw = ((state.view.yaw + +value) % 360 + 360) % 360; save(); return drawAll();
    case 'tilt': state.view.pitch = clamp(state.view.pitch + +value, 6, 86); save(); return drawAll();
    case 'zoom': state.view.zoom = clamp((state.view.zoom || 1) * +value, 0.4, 6); save(); return drawAll();
    case 'cam-reset': Object.assign(state.view, { yaw: 45, pitch: 34, zoom: 1, panX: 0, panY: 0 }); save(); return drawAll();
    case 'time': state.view.time = state.view.time === 'night' ? 'day' : 'night'; save(); return drawAll();
    case 'undo': return restore(undoStack, redoStack);
    case 'redo': return restore(redoStack, undoStack);
    case 'png': return savePng();
    case 'restart':
      if (!confirm('Start a new site? This clears the current one.')) return;
      localStorage.removeItem(SAVE_KEY);
      pendingStart = { preset: state.preset || 'warehouse', lot: { ...state.lot } };
      screen = 'start';
      return startScreen();
    case 'pick-preset':
      pendingStart.preset = value;
      pendingStart.lot = { ...SITE_PRESETS[value].lot };
      return startScreen();
    case 'break-ground':
      state = freshState(pendingStart.preset);
      state.lot = { ...pendingStart.lot };
      ui.selected = null;
      ui.tab = 'build';
      screen = 'build';
      save();
      return buildScreen();
    default:
  }
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.tagName === 'INPUT') return;
  applyAction(el, ev);
});

document.addEventListener('input', (ev) => {
  const el = ev.target;
  const act = el.dataset.act;
  if (!act) return;
  const num = Number(el.value);

  if (act === 'lot-w' || act === 'lot-d') {
    pendingStart.lot[act === 'lot-w' ? 'width' : 'depth'] = num;
    const b = el.previousElementSibling?.querySelector('b');
    if (b) b.textContent = `${num} ft`;
    return;
  }
  if (act === 'view') {
    state.view[el.dataset.key] = num;
    const b = document.querySelector(`label[for="${el.id}"] b`);
    if (b) b.textContent = el.dataset.key === 'zoom' ? `${num.toFixed(2)}×` : `${Math.round(num)}°`;
    queueSave();
    return scheduleStage(true);
  }
  if (act === 'lot') {
    state.lot[el.dataset.key] = num;
    const b = document.querySelector(`label[for="${el.id}"] b`);
    if (b) b.textContent = `${num} ft`;
    queueSave();
    return scheduleStage(true);
  }
  if (act === 'num') {
    const o = selected();
    if (!o) return;
    const key = el.dataset.key;
    if (key === 'floors') setFloors(o, num);
    else if (key === 'height') o.height = num;
    else o[key] = num;
    const b = document.querySelector(`label[for="${el.id}"] b`);
    if (b) b.textContent = key === 'floors' ? String(num) : `${Math.round(num)} ft`;
    queueSave();
    return scheduleStage(true);
  }
  if (act === 'sign') {
    const o = selected();
    if (!o) return;
    o.sign = { ...(o.sign || {}), [el.dataset.key]: el.value };
    queueSave();
    return scheduleStage(true);
  }
});

document.addEventListener('change', (ev) => {
  if (!ev.target.dataset?.act) return;
  save();
  drawStage(false);
  if (ev.target.dataset.act === 'num') drawPanel();
});

document.addEventListener('keydown', (ev) => {
  if (ev.target.matches('input, textarea')) return;
  const step = ev.shiftKey ? 10 : 2;
  const nudge = (dx, dy) => {
    const roof = selectedRoof();
    const o = selected();
    if (!roof && !o) return;
    snapshot();
    if (roof) { roof.item.dx += dx; roof.item.dy += dy; }
    else {
      o.x += dx; o.y += dy;
      if (o.kind !== 'building' && !isClear(state, footprint(o), o.id)) { o.x -= dx; o.y -= dy; }
    }
    save();
    drawAll();
    ev.preventDefault();
  };
  if (ev.key === 'Escape') {
    if (ui.pending) { ui.pending = null; ui.ghost = null; } else ui.selected = null;
    return drawAll();
  }
  if (ev.key === 'Delete' || ev.key === 'Backspace') { if (ui.selected) { deleteSelected(); ev.preventDefault(); } return; }
  if (ev.key === 'r' || ev.key === 'R') {
    if (ui.pending) { ui.pending.obj.rot = ((ui.pending.obj.rot || 0) + (ev.shiftKey ? -15 : 15)) % 360; return drawStage(true); }
    return rotateSelected(ev.shiftKey ? -15 : 15);
  }
  if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'z') {
    ev.preventDefault();
    return ev.shiftKey ? restore(redoStack, undoStack) : restore(undoStack, redoStack);
  }
  if (ev.key === 'ArrowLeft') return nudge(-step, 0);
  if (ev.key === 'ArrowRight') return nudge(step, 0);
  if (ev.key === 'ArrowUp') return nudge(0, -step);
  if (ev.key === 'ArrowDown') return nudge(0, step);
});

/* ------------------------------------------------------------------ export */

async function savePng() {
  const svg = document.querySelector('#stage svg');
  if (!svg) return;
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
    canvas.width = w * 2;
    canvas.height = h * 2;
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'site.png';
    a.click();
  } catch {
    alert('This browser would not rasterise the view. Try a screenshot instead.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (screen === 'build') drawStage(); }, 150);
});

if (screen === 'build') buildScreen(); else startScreen();
