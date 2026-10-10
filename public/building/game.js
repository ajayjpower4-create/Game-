/* Building Design Simulator — the editor.
 *
 * A real-time 3D site: orbit it, fly it like a drone or walk it at eye level;
 * click anything to select it, drag it to move it, and edit buildings wall by
 * wall and roof by roof. The clock, the weather and the season all change the
 * light, and the site keeps its own traffic and people. */

import {
  SITE_PRESETS, BUILDING_STYLES, BUILDING_GROUPS, ROOF_KIT, BOOTHS, PROPS, PROP_BY_ID, ROOF_BY_ID, BOOTH_BY_ID,
  CELLS, CLADDINGS, ROOF_TYPES, WALL_COLORS, SIGN_COLORS, LOGOS, freshState, normalize, makeBuilding,
  buildingHeight, wallCols, newId, PROP_CATS, RUNS, RUN_BY_ID,
} from './catalog.js';
import { footprint, isClear, bounds, buildingsOf, snapToDock, evictFrom, siteStats, isSolid, runLength } from './site.js';
import { contains, corners, overlaps, toLocal as planLocal, toWorld as planWorld, wallFrames, clamp, DEG } from './geom.js';
import { Engine, WEATHER, QUALITY } from './engine/core.js';
import { World, modelFor, place as placeModel, releaseModel, makeUnder } from './engine/world.js';
import { Life } from './engine/life.js';
import { roofItemModel, roofSurfaceY } from './engine/buildings.js';
import { buildRun, squarePath } from './engine/runs.js';
import * as THREE from 'three';

const SAVE_KEY = 'building-sim:v4';
const OLD_KEYS = ['building-sim:v3', 'building-sim:v2', 'building-sim'];
const SLOTS_KEY = 'building-sim:slots';
const PREFS_KEY = 'building-sim:prefs';

const app = document.getElementById('app');
const tools = document.getElementById('tools');
const crumb = document.getElementById('crumb');

const prefs = loadPrefs();
let state = load();
let screen = state ? 'build' : 'start';
if (!state) state = freshState('warehouse');

const ui = {
  tab: 'add',
  selected: null,
  pending: null,
  ghost: null,
  wall: 'N',
  paint: 'window',
  cat: 'Buildings',
  hint: '',
  measure: null,       // { a, b } plan points while measuring
  draw: null,          // a duct or pipe run being drawn
  doors: null,         // { id } while placing doors on a building in 3D
  doorType: 'door',    // what door mode puts in
  ortho: true,         // runs turn square corners
  speed: 1,
};
let pendingStart = { preset: 'warehouse', lot: { ...SITE_PRESETS.warehouse.lot } };
const undoStack = [];
const redoStack = [];

let engine = null;
let world = null;
let life = null;
let slowWarned = false;

/* ------------------------------------------------------------- persistence */

function loadPrefs() {
  // Phones, tablets and small laptops start on Medium; anything can be changed in the World tab.
  const weak = (navigator.hardwareConcurrency || 8) <= 4 || !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  const base = { quality: weak ? 'medium' : 'high', minimap: true, snap: true, autoRes: true };
  try { return { ...base, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; } catch { return base; }
}
function savePrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* private mode */ }
}
function load() {
  try {
    for (const key of [SAVE_KEY, ...OLD_KEYS]) {
      const raw = localStorage.getItem(key);
      if (raw) return normalize(JSON.parse(raw));
    }
  } catch { /* corrupt save: start again */ }
  return null;
}
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* private mode */ }
}
let saveTimer;
function queueSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 400);
}
function snapshot() {
  undoStack.push(JSON.stringify({ objects: state.objects, lot: state.lot, site: state.site }));
  if (undoStack.length > 80) undoStack.shift();
  redoStack.length = 0;
}
function restore(stack, other) {
  if (!stack.length) return;
  other.push(JSON.stringify({ objects: state.objects, lot: state.lot, site: state.site }));
  const snap = JSON.parse(stack.pop());
  state.objects = snap.objects;
  state.lot = snap.lot;
  state.site = snap.site;
  if (!state.objects.some((o) => o.id === (ui.selected || '').split('#')[0])) ui.selected = null;
  commit();
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
const snapXY = (v, step = 2) => Math.round(v / step) * step;
const fmt = (n) => Math.round(n).toLocaleString();
const hourLabel = (h) => {
  const hh = Math.floor(h) % 24;
  const mm = Math.floor((h - Math.floor(h)) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

/** Offset of a plan point from a building's unrotated top-left corner. */
function roofLocal(b, x, y) {
  const [lx, ly] = planLocal(footprint(b), x, y);
  return { dx: lx + b.w / 2, dy: ly + b.d / 2 };
}

/**
 * Put an object down at a plan position: snapped, kept near the lot, and — for
 * a lorry backed up near a loading bay — squared up to the bay.
 */
function place(o, x, y, opts = {}) {
  const snap = opts.snap !== false && prefs.snap;
  const fp = footprint(o);
  let nx = snap ? snapXY(x) : x;
  let ny = snap ? snapXY(y) : y;
  const margin = 34;
  const bb = bounds({ ...fp, x: nx, y: ny });
  const w = bb.x1 - bb.x0;
  const d = bb.y1 - bb.y0;
  nx = clamp(bb.x0, -margin, state.lot.width + margin - w) + (nx - bb.x0);
  ny = clamp(bb.y0, -margin, state.lot.depth + margin - d) + (ny - bb.y0);
  o.x = nx;
  o.y = ny;
  if (snap && o.kind === 'prop') {
    const spec = PROP_BY_ID[o.type];
    if (spec && spec.vehicle && !['car', 'hatch', 'suv', 'police', 'forklift', 'excavator'].includes(o.type)) {
      const spot = snapToDock(state, o);
      if (spot) Object.assign(o, spot);
    }
  }
}

/* ------------------------------------------------------------ start screen */

function startScreen() {
  screen = 'start';
  if (engine) engine.paused = true;
  document.body.classList.remove('in-build');
  const cards = Object.entries(SITE_PRESETS).map(([id, p]) => `
    <button class="card${pendingStart.preset === id ? ' on' : ''}" data-act="pick-preset" data-value="${id}">
      <span class="icon">${p.icon}</span><strong>${esc(p.name)}</strong><p>${esc(p.blurb)}</p>
    </button>`).join('');
  const slots = Object.entries(loadSlots());
  app.innerHTML = `<div class="start">
    <h1>Start a site</h1>
    <p class="lede">Pick a starting point. Everything on it — buildings included — can be moved, turned,
      edited or deleted afterwards. The site is drawn in real 3D: sun, shadows, weather and night lighting.</p>
    <div class="cards">${cards}</div>
    <div class="divider"></div>
    <h2>Lot size</h2>
    <div class="field"><label for="lw">Frontage<b>${pendingStart.lot.width} ft</b></label>
      <input id="lw" type="range" min="240" max="1200" step="20" value="${pendingStart.lot.width}" data-act="lot-w"></div>
    <div class="field"><label for="ld">Depth<b>${pendingStart.lot.depth} ft</b></label>
      <input id="ld" type="range" min="240" max="900" step="20" value="${pendingStart.lot.depth}" data-act="lot-d"></div>
    <p class="hint" id="acres">${(pendingStart.lot.width * pendingStart.lot.depth / 43560).toFixed(2)} acres.</p>
    <div class="row">
      <button class="btn primary" data-act="break-ground">Break ground →</button>
      ${load() ? '<button class="btn" data-act="resume">Back to my site</button>' : ''}
    </div>
    ${slots.length ? `<div class="divider"></div><h2>Saved sites</h2><ul class="objlist">${slots.map(([name, s]) => `
      <li><span>💾 ${esc(name)} <small>${new Date(s.savedAt).toLocaleString()}</small></span>
      <span><button class="btn tiny" data-act="slot-load" data-value="${esc(name)}">Open</button></span></li>`).join('')}</ul>` : ''}
  </div>`;
  tools.innerHTML = '';
  crumb.textContent = 'Pick a lot, drop a building, sign it';
}

/* ------------------------------------------------------------ build screen */

const TABS = [['add', '➕ Add'], ['edit', '✏️ Edit'], ['site', '🗺️ Site'], ['world', '🌤️ World'], ['stats', '📊 Stats'], ['saves', '💾 Saves']];

function buildScreen() {
  screen = 'build';
  document.body.classList.add('in-build');
  app.innerHTML = `<div class="workshop">
    <div class="stage" id="stage"></div>
    <div class="loading" id="loading"><div class="spinner"></div><p>Pouring concrete and mixing paint…</p></div>
    <div class="hud tl">
      <div class="seg" id="camModes">
        <button data-act="cam" data-value="orbit" title="Orbit and edit (1)">🛰️<span class="lbl"> Orbit</span></button>
        <button data-act="cam" data-value="drone" title="Fly like a drone (2)">🚁<span class="lbl"> Drone</span></button>
        <button data-act="cam" data-value="walk" title="Walk the site (3)">🚶<span class="lbl"> Walk</span></button>
      </div>
      <div class="seg small">
        ${['aerial', 'front', 'corner', 'back', 'left', 'right', 'top', 'street'].map((v) => `<button data-act="view" data-value="${v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}
      </div>
    </div>
    <div class="hud tr">
      <canvas id="minimap" width="220" height="170" title="Click to go there"></canvas>
      <div class="compass" id="compass" title="Face north (N)" data-act="north"><span id="needle">▲</span><i>N</i></div>
    </div>
    <div class="hud bottom" id="timebar"></div>
    <div class="hintbar" id="hintbar"></div>
    <div class="measure-label" id="measureLabel"></div>
    <div class="fps" id="fps"></div>
    <aside class="panel" id="panel">
      <div class="tabs">${TABS.map(([id, label]) => `<button data-act="tab" data-value="${id}" class="${ui.tab === id ? 'active' : ''}">${label}</button>`).join('')}
        <button class="collapse" data-act="panel-toggle" title="Hide or show the panel">⇥</button></div>
      <div class="panel-body" id="panelBody"></div>
    </aside>
    <div class="photo-bar" id="photoBar">
      <button class="btn primary" data-act="photo-shoot">📸 Take photo</button>
      <button class="btn" data-act="photo-shoot" data-value="2">📸 ×2 resolution</button>
      <button class="btn" data-act="photo">Exit photo mode</button>
    </div>
  </div>`;
  tools.innerHTML = `
    <button class="btn sq" data-act="undo" title="Undo (Ctrl+Z)">↶</button>
    <button class="btn sq" data-act="redo" title="Redo (Ctrl+Shift+Z)">↷</button>
    <button class="btn" data-act="measure" title="Measure a distance">📏 Measure</button>
    <button class="btn" data-act="photo" title="Hide the editor and take pictures (P)">📷 Photo</button>
    <button class="btn" data-act="tab" data-value="saves">💾 Save</button>
    <button class="btn ghost" data-act="restart">New site</button>`;

  const stage = document.getElementById('stage');
  const first = !engine;
  if (!engine) {
    engine = new Engine(stage, { quality: prefs.quality });
    world = new World(engine);
    life = new Life(engine, world);
    engine.keyFilter = (k) => !(engine.mode === 'orbit' && ui.selected && k.startsWith('Arrow'));
    engine.blocked = walkBlocked;
    engine.autoRes = prefs.autoRes !== false;
    engine.onSlow = () => {
      if (prefs.quality === 'low' || slowWarned) return;
      slowWarned = true;
      flashHint('Running slowly — try a lower Graphics quality in the World tab');
    };
    engine.addTicker(tick);
  } else {
    stage.appendChild(engine.renderer.domElement);
    engine.host = stage;
    engine.resizeObserver.disconnect();
    engine.resizeObserver.observe(stage);
    engine.paused = false;
  }
  bindStage(stage);
  // Let the loading card paint before the first (heavy) build.
  setTimeout(() => {
    engine.setLot(state.lot);
    engine.setEnv(state.env);
    life.traffic = state.env.traffic !== false;
    life.people = state.env.people !== false;
    const t0 = performance.now();
    syncWorld(true);
    if (first) engine.snapView('corner');
    document.getElementById('loading')?.classList.add('done');
    if (prefs.debug) console.log('first build', Math.round(performance.now() - t0), 'ms');
  }, 30);
  drawPanel();
  drawTimebar();
  drawHud();
}

/* ---------------------------------------------------------- the 3D world */

let lastPlanSig = '';
function syncWorld(force = false) {
  if (!world) return;
  engine.setLot(state.lot);
  const plan = world.sync(state);
  const sig = JSON.stringify([plan.road, plan.walks.map((w) => [Math.round(w.rect.x), Math.round(w.rect.y)]), state.lot, state.site.road]);
  if (force || sig !== lastPlanSig) {
    lastPlanSig = sig;
    life.setup(state, plan);
  }
  refreshSelection();
  drawMinimap(true);
  crumb.textContent = `${state.objects.length} objects · ${state.lot.width}×${state.lot.depth} ft lot · ${(state.lot.width * state.lot.depth / 43560).toFixed(2)} acres`;
}

/** Save, rebuild what changed, redraw the panel. */
function commit({ panel = true } = {}) {
  save();
  syncWorld();
  if (panel) drawPanel();
  drawHud();
}

let syncQueued = false;
function queueSync() {
  if (syncQueued) return;
  syncQueued = true;
  setTimeout(() => { syncQueued = false; syncWorld(); }, 90);
}

function refreshSelection() {
  if (!engine) return;
  const roof = selectedRoof();
  let target = null;
  if (roof) {
    const g = world.get(roof.b.id);
    if (g) g.traverse((c) => { if (c.userData.pick && c.userData.pick.roof === roof.idx) target = c; });
  } else if (ui.selected) {
    target = world.get(ui.selected);
  }
  engine.setSelection(target ? [target] : []);
  if (ui.doors && ui.selected !== ui.doors.id) { ui.doors = null; drawDoorMark(null); drawHud(); }
  drawFootprint();
}

/* Outline on the ground: where the selection or the ghost stands. */
let footLine = null;
function drawFootprint() {
  if (!engine) return;
  if (footLine) { engine.helpers.remove(footLine); footLine.geometry.dispose(); footLine = null; }
  const o = ui.pending ? (ui.ghost && ui.ghost.ground ? ui.ghost.plant : ui.pending.obj) : selected();
  if (!o || (ui.pending && ui.pending.kind === 'roof' && !(ui.ghost && ui.ghost.ground))) return;
  const fp = footprint(o);
  const a = fp.rot * DEG;
  const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].map(([sx, sy]) => {
    const lx = (sx * fp.w) / 2;
    const ly = (sy * fp.d) / 2;
    return new THREE.Vector3(fp.x + fp.w / 2 + lx * Math.cos(a) - ly * Math.sin(a), 0.6, fp.y + fp.d / 2 + lx * Math.sin(a) + ly * Math.cos(a));
  });
  const ok = !ui.pending || (ui.ghost && ui.ghost.ok);
  footLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: ok ? (ui.pending ? 0x5fd08a : 0x46b4ff) : 0xf0524d, depthTest: false, transparent: true }));
  footLine.renderOrder = 10;
  engine.helpers.add(footLine);
}

/* ---------------------------------------------------------------- ghosts */

let ghostModel = null;
let ghostKey = '';
let ghostOk = null;

function dropGhost() {
  if (!ghostModel) return;
  engine.helpers.remove(ghostModel);
  releaseModel(ghostModel);
  ghostModel = null;
  ghostKey = '';
}

function updateGhost() {
  if (!engine) return;
  const p = ui.pending;
  if (!p || !ui.ghost) {
    dropGhost();
    drawFootprint();
    return;
  }
  const onGround = p.kind === 'roof' && ui.ghost.ground;
  const key = `${p.kind}:${p.key}:${onGround ? 'ground' : 'roof'}`;
  if (key !== ghostKey) {
    dropGhost();
    ghostModel = p.kind === 'roof' && !onGround ? roofItemModel(p.key).finish(new THREE.Group()) : modelFor({ ...(onGround ? ui.ghost.plant : p.obj), id: 'ghost' });
    ghostKey = key;
    ghostOk = null;
    engine.helpers.add(ghostModel);
  }
  if (ghostOk !== ui.ghost.ok) {
    Engine.ghostify(ghostModel, ui.ghost.ok);
    ghostOk = ui.ghost.ok;
  }
  if (onGround) {
    placeModel(ghostModel, ui.ghost.plant);
    ghostModel.position.y += 0.05;
  } else if (p.kind === 'roof') {
    ghostModel.position.set(ui.ghost.x, ui.ghost.z + 0.05, ui.ghost.y);
    ghostModel.rotation.y = -(p.obj.rot || 0) * DEG;
  } else {
    placeModel(ghostModel, p.obj);
    ghostModel.position.y += 0.05;
  }
  drawFootprint();
}

/* --------------------------------------------------------------- the HUD */

function drawHud() {
  if (screen !== 'build') return;
  document.querySelectorAll('#camModes button').forEach((b) => b.classList.toggle('on', engine && b.dataset.value === engine.mode));
  const hb = document.getElementById('hintbar');
  if (hb) {
    const blocked = ui.pending && ui.ghost && !ui.ghost.ok;
    let text = ui.hint;
    if (!text) {
      if (engine && engine.mode === 'drone') text = 'Drone: WASD fly · Space up · C down · right-drag or click to look · wheel sets speed · Shift boosts · 1 returns to Orbit';
      else if (engine && engine.mode === 'walk') text = 'Walking: WASD to walk · Shift to run · click to look around (Esc frees the mouse) · 1 returns to Orbit';
      else if (ui.draw) {
        const n = ui.draw.points.length;
        const L = runLength({ points: ui.draw.points });
        text = n ? `${(RUN_BY_ID[ui.draw.style] || {}).name}: ${n} points, ${Math.round(L)} ft · click to continue · double-click or Enter to finish · Backspace undoes a point · Esc stops`
          : `${(RUN_BY_ID[ui.draw.style] || {}).name}: click a machine, roof, wall or the ground to start`;
      } else if (ui.doors) {
        const b = byId(ui.doors.id);
        const name = cellSpec(ui.doorType).name.toLowerCase();
        text = `Doors on ${b ? b.name : 'this building'}: click a wall to add ${/^[aeiou]/.test(name) ? 'an' : 'a'} ${name} · drag a door to move it · click a door to change or remove it · Esc when done`;
      } else if (ui.measure) text = ui.measure.b ? 'Measured. Click again to start a new line · Esc to stop measuring' : 'Click two points on the ground to measure between them · Esc to stop';
      else if (ui.pending) text = blocked ? (ui.pending.kind === 'roof' ? 'Point at a roof to put this on it' : 'Blocked — something solid is already there') : `Placing ${ui.pending.name} · click to drop · Shift-click to keep placing · R turns it · Esc cancels`;
      else text = 'Drag to orbit · right-drag to pan · wheel zooms · click to select · drag a selected thing to move it · double-click to fly to it';
    }
    hb.textContent = text;
    hb.classList.toggle('warn', !!ui.pending || !!ui.doors);
    hb.classList.toggle('bad', !!blocked);
  }
}

function drawTimebar() {
  const bar = document.getElementById('timebar');
  if (!bar) return;
  const env = state.env;
  bar.innerHTML = `
    <button class="btn sq ${env.cycle ? 'on' : ''}" data-act="cycle" title="Let time run (T)">${env.cycle ? '⏸' : '▶'}</button>
    <span class="clock" id="clock">${env.hour >= 6 && env.hour < 19.5 ? '☀️' : '🌙'} ${hourLabel(env.hour)}</span>
    <input type="range" id="hour" min="0" max="23.99" step="0.05" value="${env.hour}" data-act="hour" aria-label="Time of day">
    <span class="sep"></span>
    ${Object.entries(WEATHER).map(([id, w]) => `<button class="chip icon ${env.weather === id ? 'on' : ''}" data-act="weather" data-value="${id}" title="${w.name}">${w.icon}</button>`).join('')}`;
}

function updateClock() {
  const c = document.getElementById('clock');
  if (c) c.textContent = `${state.env.hour >= 6 && state.env.hour < 19.5 ? '☀️' : '🌙'} ${hourLabel(state.env.hour)}`;
  const r = document.getElementById('hour');
  if (r && document.activeElement !== r) r.value = state.env.hour;
}

/* -------------------------------------------------------------- minimap */

let mapDirty = true;
let mapT = 0;
function drawMinimap(force = false) {
  const cv = document.getElementById('minimap');
  if (!cv || !engine) return;
  cv.style.display = prefs.minimap ? '' : 'none';
  if (!prefs.minimap) return;
  if (force) mapDirty = true;
  const g = cv.getContext('2d');
  const W = cv.width;
  const H = cv.height;
  const L = state.lot;
  const pad = 10;
  const s = Math.min((W - pad * 2) / L.width, (H - pad * 2) / (L.depth + 70));
  const ox = (W - L.width * s) / 2;
  const oy = pad;
  const X = (x) => ox + x * s;
  const Y = (y) => oy + y * s;
  g.clearRect(0, 0, W, H);
  g.fillStyle = 'rgba(12,18,30,.82)';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#3c5a35';
  g.fillRect(X(0), Y(0), L.width * s, L.depth * s);
  const plan = world.plan;
  if (plan) {
    g.fillStyle = '#4b5059';
    g.fillRect(X(plan.pave.x0), Y(plan.pave.y0), (plan.pave.x1 - plan.pave.x0) * s, (plan.pave.y1 - plan.pave.y0) * s);
    g.fillStyle = '#2b2f36';
    g.fillRect(0, Y(plan.road.y0), W, (plan.road.y1 - plan.road.y0) * s);
  }
  const poly = (o, fill) => {
    const fp = footprint(o);
    const a = fp.rot * DEG;
    g.beginPath();
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy], i) => {
      const lx = (sx * fp.w) / 2;
      const ly = (sy * fp.d) / 2;
      const px = X(fp.x + fp.w / 2 + lx * Math.cos(a) - ly * Math.sin(a));
      const py = Y(fp.y + fp.d / 2 + lx * Math.sin(a) + ly * Math.cos(a));
      if (i) g.lineTo(px, py); else g.moveTo(px, py);
    });
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  };
  for (const o of state.objects) {
    if (o.kind === 'building') poly(o, o.wall || '#d8dde3');
    else if (o.kind === 'booth') poly(o, '#6f7cff');
    else if (o.kind === 'plant') poly(o, '#9fb3c8');
    else if (o.kind === 'run') {
      g.strokeStyle = '#ffb547';
      g.lineWidth = 1.5;
      g.beginPath();
      (o.points || []).forEach((p, i) => (i ? g.lineTo(X(p.x), Y(p.y)) : g.moveTo(X(p.x), Y(p.y))));
      g.stroke();
    } else if ((PROP_BY_ID[o.type] || {}).road) poly(o, '#2b2f36');
    else {
      const spec = PROP_BY_ID[o.type] || {};
      if (spec.vehicle) poly(o, '#c8ccd2');
      else if (spec.solid || spec.len) poly(o, '#8b939c');
      else if (spec.cat === 'Planting') { const f = footprint(o); g.fillStyle = '#5f8f4a'; g.beginPath(); g.arc(X(f.x + f.w / 2), Y(f.y + f.d / 2), Math.max(1.5, (f.w * s) / 2.5), 0, Math.PI * 2); g.fill(); }
    }
  }
  const sel = selected();
  if (sel) { g.strokeStyle = '#46b4ff'; g.lineWidth = 2; const f = footprint(sel); g.strokeRect(X(f.x) - 2, Y(f.y) - 2, f.w * s + 4, f.d * s + 4); }
  // Where the camera is and which way it looks.
  const cam = engine.camera.position;
  const h = engine.heading;
  const cx = clamp(X(cam.x), 4, W - 4);
  const cy = clamp(Y(cam.z), 4, H - 4);
  g.save();
  g.translate(cx, cy);
  g.rotate(h);
  g.fillStyle = 'rgba(143,227,192,.25)';
  g.beginPath(); g.moveTo(0, 0); g.lineTo(-22, -40); g.lineTo(22, -40); g.closePath(); g.fill();
  g.fillStyle = '#8fe3c0';
  g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(-5, 5); g.closePath(); g.fill();
  g.restore();
  mapDirty = false;
  cv.dataset.scale = s;
  cv.dataset.ox = ox;
  cv.dataset.oy = oy;
}

/* ------------------------------------------------------------- per frame */

function tick(dt) {
  if (screen !== 'build') return;
  // The clock runs when asked: an hour of game time every eight seconds.
  if (state.env.cycle) {
    state.env.hour = (state.env.hour + (dt / 8) * ui.speed) % 24;
    engine.setEnv({ hour: state.env.hour });
    updateClock();
    queueSave();
  }
  const needle = document.getElementById('needle');
  if (needle) needle.style.transform = `rotate(${-engine.heading}rad)`;
  mapT += dt;
  if (mapT > 0.25) { mapT = 0; drawMinimap(); }
  const fps = document.getElementById('fps');
  if (fps && prefs.debug) {
    const i = engine.info;
    fps.textContent = `${Math.round(i.fps)} fps · ${i.calls} calls · ${(i.triangles / 1e6).toFixed(2)}M tris · ${Math.round(i.scale * 100)}% res`;
  }
  if (ui.measure && ui.measure.b) positionMeasureLabel();
}

/* --------------------------------------------------------------- panels */

const CATS = ['Buildings', 'Roads', 'Machinery', 'Ducts & pipes', 'Plant yard', 'Gates', 'Booths', ...PROP_CATS.filter((c) => !['Roads', 'Plant yard', 'Gates'].includes(c))];

function itemButton(kind, key, icon, name, armed) {
  return `<button class="item${armed ? ' on' : ''}" data-act="arm" data-kind="${kind}" data-key="${key}" title="${esc(name)}">
    <span class="ic">${icon}</span><span class="nm">${esc(name)}</span></button>`;
}

function addPanel() {
  const armedKey = ui.pending ? `${ui.pending.kind}:${ui.pending.key}` : '';
  const isArmed = (kind, key) => armedKey === `${kind}:${key}`;
  let items = '';
  if (ui.cat === 'Buildings') {
    items = BUILDING_GROUPS.map((group) => {
      const list = Object.entries(BUILDING_STYLES).filter(([, b]) => b.group === group);
      return `<h3 class="famhead">${esc(group)} <small>${list.length}</small></h3>
        <div class="grid-items">${list.map(([id, b]) => itemButton('building', id, b.icon, b.name, isArmed('building', id))).join('')}</div>`;
    }).join('');
  } else if (ui.cat === 'Machinery') {
    const big = ROOF_KIT.filter((m) => m.big);
    const small = ROOF_KIT.filter((m) => !m.big);
    items = `<p class="hint">Point at a roof to put it up there, or at the ground to set it on a concrete plinth —
      build a plant compound or low wall round it from <b>Plant yard</b>.</p>
      <h3 class="famhead">Heavy plant <small>on its own steel</small></h3>
      <div class="grid-items">${big.map((m) => itemButton('roof', m.id, m.icon, m.name, isArmed('roof', m.id))).join('')}</div>
      <h3 class="famhead">Rooftop kit <small>${small.length}</small></h3>
      <div class="grid-items">${small.map((m) => itemButton('roof', m.id, m.icon, m.name, isArmed('roof', m.id))).join('')}</div>`;
  } else if (ui.cat === 'Ducts & pipes') {
    items = `<p class="hint">Pick a kind, then click to lay it out: on a machine to connect to it, across a roof, on a wall to
      run down the side, on the ground, or onto another building. Double-click or Enter to finish, Backspace to take back a point,
      Esc to stop. Stands, wall straps, sleepers and pipe-bridge steel are added for you.</p>
      <div class="grid-items">${RUNS.map((r) => `<button class="item${ui.draw && ui.draw.style === r.id ? ' on' : ''}" data-act="draw" data-key="${r.id}" title="${esc(r.name)}">
        <span class="ic">${r.icon}</span><span class="nm">${esc(r.name)}</span></button>`).join('')}</div>
      <div class="toggles" style="margin-top:10px">
        <button class="toggle${ui.ortho ? ' on' : ''}" data-act="ortho"><span>Square corners<br><small>Rise, run level, then drop — like real ductwork</small></span><span class="pill">${ui.ortho ? 'On' : 'Off'}</span></button>
        <button class="toggle${ui.runHigh ? ' on' : ''}" data-act="runhigh"><span>Over the ground: on a pipe bridge<br><small>Off: on sleepers at ground level</small></span><span class="pill">${ui.runHigh ? 'On' : 'Off'}</span></button>
      </div>`;
  } else if (ui.cat === 'Booths') {
    items = `<div class="grid-items">${BOOTHS.map((b) => itemButton('booth', b.id, b.icon, b.name, isArmed('booth', b.id))).join('')}</div>`;
  } else {
    items = `<div class="grid-items">${PROPS.filter((p) => p.cat === ui.cat).map((p) => itemButton('prop', p.id, p.icon, p.name, isArmed('prop', p.id))).join('')}</div>`;
  }
  const count = Object.keys(BUILDING_STYLES).length;
  return `<h2>Add to the site</h2>
    <p class="hint">${count} building models, ${PROPS.length} props, ${BOOTHS.length} guard booths, ${ROOF_KIT.length} machines and
      ${RUNS.length} kinds of duct and pipe. Pick one, then click the view.</p>
    <div class="chips catrow">${CATS.map((c) => `<button class="chip${ui.cat === c ? ' on' : ''}" data-act="cat" data-value="${c}">${c}</button>`).join('')}</div>
    ${items}
    ${ui.pending ? `<p class="note">Placing <b>${esc(ui.pending.name)}</b> — click the view. <button class="btn tiny" data-act="cancel">Cancel</button></p>` : ''}`;
}

function signFields(prefix, sign, opts = {}) {
  return `
    <div class="field"><label for="${prefix}-text">Sign text</label>
      <input id="${prefix}-text" type="text" maxlength="60" value="${esc(sign.text || '')}" data-act="sign" data-key="text" placeholder="Type a name"></div>
    ${opts.sub ? `<div class="field"><label for="${prefix}-sub">Tagline</label>
      <input id="${prefix}-sub" type="text" maxlength="60" value="${esc(sign.sub || '')}" data-act="sign" data-key="sub" placeholder="Optional"></div>` : ''}
    ${opts.size ? `<div class="field"><label for="${prefix}-size">Letter size<b>${Math.round((sign.size || 1) * 100)}%</b></label>
      <input id="${prefix}-size" type="range" min="0.4" max="2.5" step="0.05" value="${sign.size || 1}" data-act="sign-num" data-key="size"></div>` : ''}
    <div class="field"><label>Font colour</label><div class="chips">
      ${SIGN_COLORS.map((c) => `<button class="chip swatch${sign.color === c.hex ? ' on' : ''}" style="background:${c.hex}" title="${c.name}" data-act="sign" data-key="color" data-value="${c.hex}"></button>`).join('')}
    </div></div>
    ${opts.bg ? `<div class="field"><label>Panel colour</label><div class="chips">
      ${['#1d2c44', '#16305c', '#1f4f9c', '#c0392b', '#1f7a54', '#141821', '#f4f4f0', '#c9922b'].map((c) => `<button class="chip swatch${(sign.bg || '') === c ? ' on' : ''}" style="background:${c}" data-act="sign" data-key="bg" data-value="${c}"></button>`).join('')}
    </div></div>` : ''}
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
    <p class="hint">Paint one bay at a time — the 3D view updates as you go. Doors, docks and shopfronts go on the ground floor
      (or use door mode above to place them straight onto the building).</p>
    <div class="chips">${['N', 'E', 'S', 'W'].map((f) => `<button class="chip${face === f ? ' on' : ''}" data-act="wall" data-value="${f}">${label[f]}</button>`).join('')}
      <button class="chip" data-act="look-wall" title="Fly the camera to this wall">👁 Look at it</button></div>
    <div class="field" style="margin-top:12px"><label>Brush</label><div class="chips">
      ${CELLS.map((c) => `<button class="chip${ui.paint === c.id ? ' on' : ''}" data-act="paint" data-value="${c.id}">${c.icon} ${c.name}</button>`).join('')}
    </div></div>
    <div class="wallwrap"><div class="wallgrid" style="grid-template-columns:repeat(${cols},minmax(19px,1fr))">${cells}</div></div>
    <div class="row tight">
      <button class="btn tiny" data-act="bays" data-value="-1">− bay</button>
      <button class="btn tiny" data-act="bays" data-value="1">+ bay</button>
      <span class="mini">${cols} bays across · ${(b[face === 'N' || face === 'S' ? 'w' : 'd'] / cols).toFixed(1)} ft each</span>
    </div>
    <div class="row tight">
      <button class="btn tiny" data-act="fillwall">Fill wall with brush</button>
      <button class="btn tiny" data-act="fillrow">Fill ground floor</button>
      <button class="btn tiny" data-act="clearwall">Clear wall</button>
    </div>`;
}

function doorEditor(b) {
  const on = ui.doors && ui.doors.id === b.id;
  const list = doorsOf(b);
  const brush = cellSpec(ui.doorType);
  const items = list.map((d) => {
    const c = cellSpec(d.type);
    const at = `data-face="${d.face}" data-col="${d.col}"`;
    return `<li><span><button class="linkish" data-act="door-look" ${at} title="Fly to it">${c.icon} ${c.name}</button>
      <small class="sub">${FACE_NAME[d.face]} wall · bay ${d.col + 1}</small></span>
      <span>
        <button class="btn tiny" data-act="door-slide" ${at} data-value="-1" title="Slide one bay left">◀</button>
        <button class="btn tiny" data-act="door-slide" ${at} data-value="1" title="Slide one bay right">▶</button>
        <button class="btn tiny" data-act="door-wall" ${at} title="Move it round to the next wall">⤾</button>
        ${d.type !== ui.doorType ? `<button class="btn tiny" data-act="door-swap" ${at} title="Make it a ${esc(brush.name)}">${brush.icon}</button>` : ''}
        <button class="btn tiny danger" data-act="door-del" ${at} title="Take it out">✕</button>
      </span></li>`;
  }).join('');
  return `<h3>Doors &amp; entrances</h3>
    <p class="hint">Turn on door mode, then click any wall of this building in the 3D view to put a door there. Drag a door
      to slide it along the wall or round a corner; click one to change it to the type below or, if it already is, take it out.</p>
    <div class="row tight"><button class="btn${on ? ' primary' : ''}" data-act="door-mode">${on ? '✓ Done with doors' : '🚪 Place &amp; move doors in 3D'}</button></div>
    <div class="field" style="margin-top:10px"><label>Door type</label><div class="chips">
      ${DOOR_TYPES.map((id) => { const c = cellSpec(id); return `<button class="chip${ui.doorType === id ? ' on' : ''}" data-act="door-type" data-value="${id}">${c.icon} ${c.name}</button>`; }).join('')}
    </div></div>
    ${items ? `<ul class="objlist scroll">${items}</ul>` : '<p class="note">No doors yet — nobody can get in!</p>'}`;
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
  return `<h3>Roof plant</h3>
    <p class="hint">Pick a machine, then click this building's roof. Drag machines around up there once they are down.</p>
    <div class="grid-items small">${ROOF_KIT.map((m) => itemButton('roof', m.id, m.icon, m.name,
      ui.pending && ui.pending.kind === 'roof' && ui.pending.key === m.id)).join('')}</div>
    ${list ? `<ul class="objlist">${list}</ul>` : '<p class="note">Nothing on this roof yet.</p>'}`;
}

function buildingPanel(b) {
  const H = buildingHeight(b);
  const single = b.floors === 1;
  const style = BUILDING_STYLES[b.style] || {};
  return `<h2>${style.icon || '🏢'} ${esc(b.name)}</h2>
    <p class="hint">${fmt(b.w)} × ${fmt(b.d)} ft · ${b.floors} floor${b.floors > 1 ? 's' : ''} · ${Math.round(H)} ft tall · ${fmt(b.w * b.d * b.floors)} sq ft</p>
    ${objActions(b)}
    <div class="field"><label for="p-name">Name</label>
      <input id="p-name" type="text" maxlength="40" value="${esc(b.name)}" data-act="rename"></div>
    <div class="field"><label for="p-w">Width<b>${fmt(b.w)} ft</b></label>
      <input id="p-w" type="range" min="16" max="800" step="2" value="${Math.round(b.w)}" data-act="num" data-key="w"></div>
    <div class="field"><label for="p-d">Depth<b>${fmt(b.d)} ft</b></label>
      <input id="p-d" type="range" min="16" max="500" step="2" value="${Math.round(b.d)}" data-act="num" data-key="d"></div>
    <div class="field"><label for="p-floors">Floors<b>${b.floors}</b></label>
      <input id="p-floors" type="range" min="1" max="40" step="1" value="${b.floors}" data-act="num" data-key="floors"></div>
    ${single ? `<div class="field"><label for="p-height">Wall height<b>${Math.round(H)} ft</b></label>
      <input id="p-height" type="range" min="9" max="110" step="1" value="${Math.round(H)}" data-act="num" data-key="height"></div>` : ''}
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
    <div class="field"><label>Roof colour</label><div class="chips">
      ${['#c9cdd2', '#8d949c', '#5d646d', '#3d434b', '#5a3e36', '#7d2f2f', '#2f4a3a', '#2c4a7c'].map((c) => `<button class="chip swatch${(b.roofColor || '') === c ? ' on' : ''}" style="background:${c}" data-act="set" data-key="roofColor" data-value="${c}"></button>`).join('')}
    </div></div>
    <div class="toggles">
      <button class="toggle${b.parapet !== false ? ' on' : ''}" data-act="toggle" data-key="parapet"><span>Parapet</span><span class="pill">${b.parapet !== false ? 'On' : 'Off'}</span></button>
      <button class="toggle${b.roofGlass ? ' on' : ''}" data-act="toggle-true" data-key="roofGlass"><span>Glass roof</span><span class="pill">${b.roofGlass ? 'On' : 'Off'}</span></button>
    </div>
    <div class="divider"></div>
    ${doorEditor(b)}
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
    ${signFields('b', b.sign, { sub: true, size: true })}`;
}

function boothPanel(o) {
  return `<h2>${(BOOTH_BY_ID[o.design] || {}).icon || '🛂'} Guard booth</h2>
    <p class="hint">Ten designs, all lit inside at night. Turn it to face the lane.</p>
    ${objActions(o)}
    <div class="field"><label>Design</label><div class="grid-items small">
      ${BOOTHS.map((b) => `<button class="item${o.design === b.id ? ' on' : ''}" data-act="set" data-key="design" data-value="${b.id}">
        <span class="ic">${b.icon}</span><span class="nm">${esc(b.name)}</span></button>`).join('')}
    </div></div>
    <div class="divider"></div>
    <h3>Fascia sign</h3>
    ${signFields('g', o.sign || {}, { bg: true })}`;
}

function propPanel(o) {
  const spec = PROP_BY_ID[o.type] || {};
  return `<h2>${spec.icon || ''} ${esc(spec.name || o.type)}</h2>
    <p class="hint">${esc(spec.cat || '')}${spec.solid ? ' · solid — nothing else can stand here' : ''}${spec.vehicle ? ' · backs onto loading bays by itself' : ''}</p>
    ${objActions(o)}
    ${spec.len ? `<div class="field"><label for="p-len">Length<b>${fmt(o.w != null ? o.w : spec.w)} ft</b></label>
      <input id="p-len" type="range" min="6" max="300" step="2" value="${Math.round(o.w != null ? o.w : spec.w)}" data-act="num" data-key="w"></div>` : ''}
    ${['pond', 'flowerbed', 'plantyard', 'plantpad'].includes(o.type) ? `<div class="field"><label for="p-w2">Width<b>${fmt(o.w || spec.w)} ft</b></label>
      <input id="p-w2" type="range" min="6" max="200" step="2" value="${Math.round(o.w || spec.w)}" data-act="num" data-key="w"></div>
      <div class="field"><label for="p-d2">Depth<b>${fmt(o.d || spec.d)} ft</b></label>
      <input id="p-d2" type="range" min="4" max="160" step="2" value="${Math.round(o.d || spec.d)}" data-act="num" data-key="d"></div>` : ''}
    ${spec.color || ['dumpster', 'skip', 'flag'].includes(o.type) ? `<div class="field"><label>Colour</label><div class="chips">
      ${['#d9dde2', '#1d2735', '#7d2f2f', '#1e2229', '#f1f2f4', '#35543f', '#8d5a24', '#2c4a7c', '#c0392b', '#c9a227', '#b5482f', '#1f5b8a'].map((c) => `<button class="chip swatch${o.color === c ? ' on' : ''}" style="background:${c}" data-act="set" data-key="color" data-value="${c}"></button>`).join('')}
    </div></div>` : ''}
    ${spec.sign ? `<div class="divider"></div><h3>Sign</h3>${signFields('s', o.sign || {}, { bg: true, sub: o.type === 'billboard' || o.type === 'monument' })}` : ''}`;
}

function plantPanel(o) {
  const spec = ROOF_BY_ID[o.type] || {};
  return `<h2>${spec.icon || '⚙️'} ${esc(spec.name || o.type)}</h2>
    <p class="hint">On the ground, on a concrete plinth${spec.big ? ' — heavy plant' : ''} · ${fmt(spec.w)} × ${fmt(spec.d)} ft.
      Put a plant compound or low wall round it from the Plant yard shelf.</p>
    ${objActions(o)}
    <button class="btn primary" data-act="duct-from" style="margin-top:4px">〰️ Run duct or pipe from this machine</button>`;
}

function runPanel(o) {
  const spec = RUN_BY_ID[o.style] || RUNS[0];
  const pts = o.points || [];
  const L = runLength(o);
  const colours = [['#b8bfc6', 'Galvanised'], ['#e9ecee', 'White'], ['#8d949b', 'Grey'], ['#2b3036', 'Black'], ['#c0392b', 'Red'], ['#e2b31b', 'Yellow'], ['#2f6b4a', 'Green'], ['#2c5f8a', 'Blue']];
  return `<h2>${spec.icon} ${esc(spec.name)}</h2>
    <p class="hint">${pts.length} points · ${fmt(L)} ft long · from ${fmt(pts[0] ? pts[0].z : 0)} ft to ${fmt(pts.length ? pts[pts.length - 1].z : 0)} ft up.</p>
    <div class="row tight">
      <button class="btn" data-act="run-extend">➕ Extend</button>
      <button class="btn" data-act="run-pop">↶ Last point</button>
      <button class="btn" data-act="dup">Duplicate</button>
      <button class="btn" data-act="focus">🎯 Focus</button>
      <button class="btn danger" data-act="delete">Delete</button>
    </div>
    <div class="field"><label>Kind</label><div class="chips">
      ${RUNS.map((r) => `<button class="chip${o.style === r.id ? ' on' : ''}" data-act="set" data-key="style" data-value="${r.id}">${r.icon} ${r.name}</button>`).join('')}
    </div></div>
    <div class="field"><label for="r-size">Size<b>${(o.size || spec.size).toFixed(1)} ft</b></label>
      <input id="r-size" type="range" min="0.6" max="6" step="0.1" value="${o.size || spec.size}" data-act="num" data-key="size"></div>
    <div class="field"><label>Finish</label><div class="chips">
      ${colours.map(([c, n]) => `<button class="chip swatch${(o.color || spec.color) === c ? ' on' : ''}" style="background:${c}" title="${n}" data-act="set" data-key="color" data-value="${c}"></button>`).join('')}
    </div></div>
    <p class="note">Drag it to move the whole run. It moves with a building you move or turn. Stands on roofs, straps
      down walls, sleepers on the ground and steel portals over open ground are worked out for you.</p>`;
}

function roofItemPanel(sel) {
  const spec = ROOF_BY_ID[sel.item.type] || {};
  return `<h2>${spec.icon || ''} ${esc(spec.name || sel.item.type)}</h2>
    <p class="hint">On the roof of ${esc(sel.b.name)} · drag it around up there.</p>
    <div class="row tight">
      <button class="btn" data-act="rot" data-value="-15">↺ 15°</button>
      <button class="btn" data-act="rot" data-value="15">↻ 15°</button>
      <button class="btn" data-act="rot" data-value="90">↻ 90°</button>
      <button class="btn" data-act="dup">Duplicate</button>
      <button class="btn danger" data-act="delete">Delete</button>
    </div>
    <button class="btn primary" data-act="duct-from" style="margin-top:4px">〰️ Run duct or pipe from this machine</button>
    <p class="note"><button class="linkish" data-act="select" data-value="${sel.b.id}">← Back to ${esc(sel.b.name)}</button></p>`;
}

function objActions(o) {
  return `<div class="row tight">
      <button class="btn" data-act="rot" data-value="-15">↺ 15°</button>
      <button class="btn" data-act="rot" data-value="15">↻ 15°</button>
      <button class="btn" data-act="rot" data-value="90">↻ 90°</button>
      <button class="btn" data-act="dup">Duplicate</button>
      <button class="btn" data-act="focus">🎯 Focus</button>
      <button class="btn danger" data-act="delete">Delete</button>
    </div>
    <p class="note">At ${Math.round(o.x)}, ${Math.round(o.y)} ft · turned ${Math.round(((o.rot || 0) % 360 + 360) % 360)}°.
      Drag it in the view, or nudge with the arrow keys (Shift for 10 ft).</p>`;
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
    <p class="hint">The ground under everything. Paving, parking and markings lay themselves out around what you build.</p>
    <div class="field"><label for="s-w">Lot frontage<b>${state.lot.width} ft</b></label>
      <input id="s-w" type="range" min="240" max="1200" step="20" value="${state.lot.width}" data-act="lot" data-key="width"></div>
    <div class="field"><label for="s-d">Lot depth<b>${state.lot.depth} ft</b></label>
      <input id="s-d" type="range" min="240" max="900" step="20" value="${state.lot.depth}" data-act="lot" data-key="depth"></div>
    <div class="toggles">
      ${t('pavement', 'Pavement', 'Paves around whatever you have built')}
      ${t('parking', 'Parking bays', 'Lays out around buildings and truck courts')}
      ${t('cars', 'Parked cars')}
      ${t('markings', 'Road markings', 'Bay lines, crossings, arrows, dock guides')}
      ${t('road', 'Street, footways and traffic')}
      ${t('grass', 'Grass (off = gravel)')}
    </div>
    <div class="divider"></div>
    <div class="toggles">
      <button class="toggle${prefs.snap ? ' on' : ''}" data-act="pref" data-key="snap"><span>Snap to grid and docks<br><small>Hold Alt while dragging to place freely</small></span><span class="pill">${prefs.snap ? 'On' : 'Off'}</span></button>
    </div>
    <p class="note">On the lot: ${Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(' · ') || 'nothing yet'}.</p>
    <div class="row tight">
      <button class="btn tiny" data-act="measure">📏 Measure</button>
      <button class="btn tiny danger" data-act="clear-props">Delete every prop</button>
    </div>`;
}

function worldPanel() {
  const env = state.env;
  const times = [['Dawn', 6.3], ['Morning', 9], ['Noon', 12.5], ['Afternoon', 15.5], ['Golden hour', 18.2], ['Dusk', 19.4], ['Night', 22.5], ['Midnight', 0.5]];
  const t = (key, label) => `<button class="toggle${env[key] !== false ? ' on' : ''}" data-act="env-toggle" data-key="${key}"><span>${label}</span><span class="pill">${env[key] !== false ? 'On' : 'Off'}</span></button>`;
  return `<h2>World</h2>
    <p class="hint">The sun follows the clock — shadows swing round, the sky warms at dusk, and after dark the buildings,
      lamps and signs light up.</p>
    <div class="field"><label for="w-hour">Time of day<b>${hourLabel(env.hour)}</b></label>
      <input id="w-hour" type="range" min="0" max="23.99" step="0.05" value="${env.hour}" data-act="hour"></div>
    <div class="chips">${times.map(([n, h]) => `<button class="chip" data-act="set-hour" data-value="${h}">${n}</button>`).join('')}</div>
    <div class="field" style="margin-top:14px"><label>Clock speed</label><div class="chips">
      ${[[0.25, 'Slow'], [1, 'Normal'], [4, 'Fast'], [16, 'Time-lapse']].map(([s, n]) => `<button class="chip${ui.speed === s ? ' on' : ''}" data-act="speed" data-value="${s}">${n}</button>`).join('')}
      <button class="chip${env.cycle ? ' on' : ''}" data-act="cycle">${env.cycle ? '⏸ Stop' : '▶ Run'}</button>
    </div></div>
    <div class="field"><label>Weather</label><div class="chips">
      ${Object.entries(WEATHER).map(([id, w]) => `<button class="chip${env.weather === id ? ' on' : ''}" data-act="weather" data-value="${id}">${w.icon} ${w.name}</button>`).join('')}
    </div></div>
    <div class="field"><label>Season</label><div class="chips">
      ${['spring', 'summer', 'autumn', 'winter'].map((s) => `<button class="chip${env.season === s ? ' on' : ''}" data-act="season" data-value="${s}">${{ spring: '🌸', summer: '🌳', autumn: '🍂', winter: '❄️' }[s]} ${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}
    </div></div>
    <div class="toggles">${t('traffic', 'Traffic on the street')}${t('people', 'People walking about')}</div>
    <div class="divider"></div>
    <h3>Graphics</h3>
    <div class="field"><label>Quality</label><div class="chips">
      ${Object.entries(QUALITY).map(([id, q]) => `<button class="chip${prefs.quality === id ? ' on' : ''}" data-act="quality" data-value="${id}">${q.name}</button>`).join('')}
    </div></div>
    <p class="note">High adds ambient occlusion and 4K shadows; Ultra adds 8K shadows and supersampling. Adaptive resolution
      keeps things smooth on its own; drop to Medium or Low if the view still stutters.</p>
    <div class="toggles">
      <button class="toggle${prefs.minimap ? ' on' : ''}" data-act="pref" data-key="minimap"><span>Minimap</span><span class="pill">${prefs.minimap ? 'On' : 'Off'}</span></button>
      <button class="toggle${prefs.autoRes ? ' on' : ''}" data-act="pref" data-key="autoRes" title="Lowers the render resolution a little when frames run long, and raises it again when they don't"><span>Adaptive resolution</span><span class="pill">${prefs.autoRes ? 'On' : 'Off'}</span></button>
      <button class="toggle${prefs.debug ? ' on' : ''}" data-act="pref" data-key="debug"><span>Frame rate counter</span><span class="pill">${prefs.debug ? 'On' : 'Off'}</span></button>
    </div>
    <div class="divider"></div>
    <h3>Camera</h3>
    <p class="note">Orbit: drag to turn, right-drag to pan, wheel to zoom, WASD to slide, Q/E to turn.<br>
      Drone (2): WASD to fly, Space/C up and down, right-drag to look, wheel sets speed.<br>
      Walk (3): WASD at eye level, click to look around. 1 returns to Orbit. P for photo mode.</p>`;
}

const RATES = { 'Sheds & industry': 95, 'Offices & shops': 210, Civic: 260, Homes: 180, 'Small buildings': 160 };

function statsPanel() {
  const plan = world ? world.plan : null;
  const s = plan ? siteStats(state, plan) : null;
  if (!s) return '<h2>Stats</h2><p class="hint">Loading…</p>';
  let cost = 0;
  for (const b of buildingsOf(state)) cost += b.w * b.d * b.floors * (RATES[(BUILDING_STYLES[b.style] || {}).group] || 150);
  cost += s.stalls * 3200 + plan.aprons.length * 60000 + s.props * 1500 + s.booths * 45000 + s.roofItems * 18000;
  for (const b of buildingsOf(state)) for (const it of b.roofItems || []) if ((ROOF_BY_ID[it.type] || {}).big) cost += 240000;
  for (const o of state.objects) if (o.kind === 'plant') cost += (ROOF_BY_ID[o.type] || {}).big ? 250000 : 20000;
  cost += s.runLength * 140 + s.roads * 45000;
  const pave = (plan.pave.x1 - plan.pave.x0) * (plan.pave.y1 - plan.pave.y0);
  cost += pave * 6;
  const row = (k, v) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`;
  return `<h2>Site stats</h2>
    <p class="hint">What a planner would ask about this layout.</p>
    <div class="stats">
      ${row('Lot', `${fmt(s.lotArea)} sq ft · ${(s.lotArea / 43560).toFixed(2)} ac`)}
      ${row('Buildings', s.buildings)}
      ${row('Footprint', `${fmt(s.footprintArea)} sq ft`)}
      ${row('Floor area', `${fmt(s.floorArea)} sq ft`)}
      ${row('Site coverage', `${(s.coverage * 100).toFixed(1)}%`)}
      ${row('Floor area ratio', (s.floorArea / s.lotArea).toFixed(2))}
      ${row('Parking bays', `${s.stalls} (${s.adaStalls} accessible)`)}
      ${row('Bays per 1,000 sq ft', s.floorArea ? (s.stalls / (s.floorArea / 1000)).toFixed(2) : '—')}
      ${row('Loading docks', s.docks)}
      ${row('Entrances', s.doors)}
      ${row('Windows', s.windows)}
      ${row('Guard booths', s.booths)}
      ${row('Rooftop machines', s.roofItems)}
      ${row('Machines on the ground', s.groundPlant)}
      ${row('Duct and pipe runs', s.runs ? `${s.runs} · ${fmt(s.runLength)} ft` : '0')}
      ${row('Side road pieces', s.roads)}
      ${row('Trees', s.trees)}
      ${row('Props', s.props)}
      ${row('Paving', `${fmt(pave)} sq ft`)}
    </div>
    <div class="cost"><span>Rough build cost</span><b>$${(cost / 1e6).toFixed(2)}M</b></div>
    <p class="note">Costs are ballpark: per square foot by building type, plus paving, parking, docks, booths and rooftop plant.</p>`;
}

function loadSlots() {
  try { return JSON.parse(localStorage.getItem(SLOTS_KEY) || '{}'); } catch { return {}; }
}
function saveSlots(slots) {
  try { localStorage.setItem(SLOTS_KEY, JSON.stringify(slots)); return true; } catch { return false; }
}

function savesPanel() {
  const slots = Object.entries(loadSlots()).sort((a, b) => b[1].savedAt - a[1].savedAt);
  return `<h2>Saves</h2>
    <p class="hint">Your site autosaves as you work. Keep named copies here, or export a file to share or back up.</p>
    <div class="field"><label for="slotName">Save as</label>
      <div class="row tight"><input id="slotName" type="text" maxlength="40" placeholder="My distribution centre" value="${esc(ui.slotName || '')}">
      <button class="btn primary" data-act="slot-save">Save</button></div></div>
    ${slots.length ? `<ul class="objlist">${slots.map(([name, s]) => `<li>
      <span>💾 ${esc(name)}<br><small>${new Date(s.savedAt).toLocaleString()} · ${s.state.objects.length} objects</small></span>
      <span><button class="btn tiny" data-act="slot-load" data-value="${esc(name)}">Open</button>
      <button class="btn tiny danger" data-act="slot-del" data-value="${esc(name)}">✕</button></span></li>`).join('')}</ul>` : '<p class="note">No saved copies yet.</p>'}
    <div class="divider"></div>
    <div class="row tight">
      <button class="btn" data-act="export">⬇️ Export file</button>
      <label class="btn">⬆️ Import file<input type="file" id="importFile" accept=".json,application/json" hidden></label>
      <button class="btn" data-act="photo">📷 Photo mode</button>
    </div>`;
}

function drawPanel() {
  const body = document.getElementById('panelBody');
  if (!body) return;
  let html = '';
  if (ui.tab === 'add') html = addPanel();
  else if (ui.tab === 'site') html = sitePanel();
  else if (ui.tab === 'world') html = worldPanel();
  else if (ui.tab === 'stats') html = statsPanel();
  else if (ui.tab === 'saves') html = savesPanel();
  else {
    const roof = selectedRoof();
    const o = selected();
    if (roof) html = roofItemPanel(roof);
    else if (!o) html = '<h2>Nothing selected</h2><p class="hint">Click anything in the view — a building, a booth, a trailer, a sign, a machine on a roof — to edit it, turn it or delete it.</p>';
    else if (o.kind === 'building') html = buildingPanel(o);
    else if (o.kind === 'booth') html = boothPanel(o);
    else if (o.kind === 'plant') html = plantPanel(o);
    else if (o.kind === 'run') html = runPanel(o);
    else html = propPanel(o);
  }
  // Keep the scroll position while editing one thing; start at the top for a new one.
  const key = `${ui.tab}|${ui.selected}`;
  const scroll = key === drawPanel.key ? body.scrollTop : 0;
  drawPanel.key = key;
  body.innerHTML = html;
  body.scrollTop = scroll;
  document.querySelectorAll('.tabs button[data-act="tab"]').forEach((btn) => btn.classList.toggle('active', btn.dataset.value === ui.tab));
}

/* ------------------------------------------------------------- grid edits */

function setFloors(b, n) {
  n = clamp(Math.round(n), 1, 40);
  for (const f of ['N', 'E', 'S', 'W']) {
    const g = b.walls[f];
    const cols = g[0] ? g[0].length : 4;
    while (g.length > n) g.pop();
    while (g.length < n) {
      const top = g[g.length - 1] || [];
      g.push(Array.from({ length: cols }, (_, c) => {
        const t = top[c] || 'blank';
        return CELLS.find((k) => k.id === t)?.upper ? t : (b.style === 'tower' ? 'glass' : 'window');
      }));
    }
  }
  b.floors = n;
  if (b.height != null && n > 1) b.height = null;
}

function setBays(b, face, n) {
  const g = b.walls[face];
  n = clamp(Math.round(n), 1, 80);
  for (const row of g) {
    while (row.length > n) row.pop();
    while (row.length < n) row.push('blank');
  }
}

/* ------------------------------------------------------------------- doors */

/* Doors live in the ground row of each wall grid like any other bay, so the
 * model, the paths to them, the truck aprons and the stats all follow a door
 * wherever it is moved. */
const DOOR_TYPES = ['door', 'firedoor', 'shopfront', 'roll', 'garage', 'dock'];
const FACES = ['N', 'E', 'S', 'W'];   // clockwise, so "right" along a wall leads to the next one
const FACE_NAME = { N: 'Front', E: 'Right', S: 'Back', W: 'Left' };
const isDoor = (t) => DOOR_TYPES.includes(t);
const cellSpec = (id) => CELLS.find((c) => c.id === id) || CELLS[0];

/** Every door on a building's ground floor, wall by wall. */
function doorsOf(b) {
  const out = [];
  for (const face of FACES) {
    ((b.walls[face] || [])[0] || []).forEach((type, col) => { if (isDoor(type)) out.push({ face, col, type }); });
  }
  return out;
}

/** What a bay becomes when its door is taken out: whatever most of that wall's ground floor is. */
function plainCell(b, face) {
  const count = {};
  for (const t of (b.walls[face] || [])[0] || []) if (!isDoor(t)) count[t] = (count[t] || 0) + 1;
  const best = Object.entries(count).sort((a, z) => z[1] - a[1])[0];
  return best ? best[0] : 'blank';
}

/** Swap two ground-floor bays (a door moving takes the other bay's place). */
function swapBays(b, a, z) {
  const ra = b.walls[a.face][0];
  const rz = b.walls[z.face][0];
  [ra[a.col], rz[z.col]] = [rz[z.col], ra[a.col]];
}

/** The ground-floor bay of a building's wall under the pointer, if any. Any
 *  height on the wall counts, so tall sheds are as easy to hit as houses. */
const _dRay = new THREE.Vector3();
function bayAt(ev, b) {
  const ray = engine.rayFrom(ev).ray;
  const H = buildingHeight(b);
  let best = null;
  for (const [face, f] of Object.entries(wallFrames(footprint(b)))) {
    const nx = f.n[0];
    const nz = f.n[1];
    const facing = ray.direction.x * nx + ray.direction.z * nz;
    if (facing >= -1e-4) continue;    // seen from behind
    // Distance along the ray to the wall plane.
    const k = ((f.o[0] - ray.origin.x) * nx + (f.o[1] - ray.origin.z) * nz) / facing;
    if (k <= 0) continue;
    const p = _dRay.copy(ray.origin).addScaledVector(ray.direction, k);
    if (p.y < -1 || p.y > H + 1) continue;
    const t = (p.x - f.o[0]) * f.u[0] + (p.z - f.o[1]) * f.u[1];
    if (t < 0 || t > f.len) continue;
    if (best && best.k < k) continue;
    const cols = wallCols(b, face);
    best = { face, col: clamp(Math.floor(t / (f.len / cols)), 0, cols - 1), k, f, cols };
  }
  return best;
}

/** A see-through slab over the bay the pointer is on. */
let doorMark = null;
function drawDoorMark(b, bay, color = 0x5fd08a) {
  if (!engine) return;
  if (!doorMark) {
    doorMark = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false }));
    doorMark.renderOrder = 5;
    doorMark.userData.noPick = true;
    engine.helpers.add(doorMark);
  }
  if (!b || !bay) { doorMark.visible = false; return; }
  const f = bay.f || wallFrames(footprint(b))[bay.face];
  const cols = bay.cols || wallCols(b, bay.face);
  const cw = f.len / cols;
  const t = (bay.col + 0.5) * cw;
  const h = Math.min(16, buildingHeight(b) / Math.max(1, b.floors));
  doorMark.scale.set(Math.max(1, cw - 0.4), h, 0.8);
  doorMark.position.set(f.o[0] + f.u[0] * t + f.n[0] * 0.6, h / 2, f.o[1] + f.u[1] * t + f.n[1] * 0.6);
  doorMark.rotation.set(0, Math.atan2(-f.u[1], f.u[0]), 0);
  doorMark.material.color.set(color);
  doorMark.visible = true;
}

function setDoorMode(b) {
  ui.doors = b ? { id: b.id } : null;
  if (b) {
    if (ui.pending) { ui.pending = null; ui.ghost = null; updateGhost(); }
    if (ui.draw) cancelDraw();
    if (ui.measure) stopMeasure();
  }
  drawDoorMark(null);
  drawPanel();
  drawHud();
}

/** Put the brush's door in a bay — or, clicking a door, change it or take it out. */
function clickBay(b, bay) {
  const row = b.walls[bay.face][0];
  const now = row[bay.col];
  const brush = cellSpec(ui.doorType);
  snapshot();
  if (now === ui.doorType) {
    row[bay.col] = plainCell(b, bay.face);
    flashHint(`${brush.name} taken out of the ${FACE_NAME[bay.face].toLowerCase()} wall`);
  } else {
    row[bay.col] = ui.doorType;
    flashHint(`${brush.name} added — ${FACE_NAME[bay.face].toLowerCase()} wall, bay ${bay.col + 1}`);
  }
  commit();
  drawDoorMark(b, bay, isDoor(row[bay.col]) ? 0x46b4ff : 0x5fd08a);
}

/** The bay `step` along from this one, round the corners of the building. */
function stepBay(b, face, col, step) {
  let f = FACES.indexOf(face);
  let c = col + step;
  for (let guard = 0; guard < 8; guard++) {
    const cols = wallCols(b, FACES[f]);
    if (c >= cols) { c -= cols; f = (f + 1) % 4; continue; }
    if (c < 0) { f = (f + 3) % 4; c += wallCols(b, FACES[f]); continue; }
    break;
  }
  return { face: FACES[f], col: c };
}

/* ------------------------------------------------------------- side roads */

/* A straight road or junction laid across a fence, hedge or boundary wall cuts
 * an opening in it, so a side road can run in from the street. */
const CUTTABLE = new Set(['fence', 'palisade', 'woodfence', 'guardrail', 'hedge', 'wall']);
const CUTTERS = new Set(['road', 'lane', 'tee', 'cross']);
const cutsFences = (o) => o && o.kind === 'prop' && CUTTERS.has(o.type);

/** Is this spot free for it? Fences don't stop a road that will cut through them. */
function clearFor(o, ignoreId = null) {
  if (!cutsFences(o)) return isClear(state, footprint(o), ignoreId, o.kind);
  const objects = state.objects.filter((x) => !(x.kind === 'prop' && CUTTABLE.has(x.type)));
  return isClear({ ...state, objects }, footprint(o), ignoreId, o.kind);
}

/** Split every fence the road crosses into the pieces either side of it. */
function cutFences(road) {
  if (!cutsFences(road)) return 0;
  const rf = footprint(road);
  const rc = corners(rf);
  let cut = 0;
  for (const o of [...state.objects]) {
    if (o.kind !== 'prop' || !CUTTABLE.has(o.type)) continue;
    const f = footprint(o);
    if (!overlaps(rf, f)) continue;
    const a = (f.rot || 0) * DEG;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const sx = f.x + f.w / 2 - (ux * f.w) / 2;
    const sy = f.y + f.d / 2 - (uy * f.w) / 2;
    const ts = rc.map(([px, py]) => (px - sx) * ux + (py - sy) * uy);
    const t0 = Math.max(0, Math.min(...ts) - 1);
    const t1 = Math.min(f.w, Math.max(...ts) + 1);
    if (t1 <= t0) continue;
    state.objects.splice(state.objects.indexOf(o), 1);
    for (const [p, q] of [[0, t0], [t1, f.w]]) {
      const L = q - p;
      if (L < 4) continue;
      const mx = sx + (ux * (p + q)) / 2;
      const my = sy + (uy * (p + q)) / 2;
      state.objects.push({ ...JSON.parse(JSON.stringify(o)), id: newId('p'), w: L, x: mx - L / 2, y: my - f.d / 2 });
    }
    cut += 1;
  }
  return cut;
}

/* --------------------------------------------------------------- placement */

function armItem(kind, key) {
  const make = () => {
    if (kind === 'building') {
      const b = makeBuilding(key);
      b.sign.on = false;
      return b;
    }
    if (kind === 'booth') return { id: 'ghost', kind: 'booth', design: key, rot: 0, x: 0, y: 0, sign: { text: 'SECURITY', color: '#ffffff', logo: '🛡️' } };
    if (kind === 'roof') return { id: 'ghost', kind: 'roof', type: key, rot: 0, x: 0, y: 0 };
    const spec = PROP_BY_ID[key];
    return {
      id: 'ghost', kind: 'prop', type: key, rot: 0, x: 0, y: 0, ...(spec.len ? { w: spec.w, d: spec.d } : {}),
      ...(spec.sign ? { sign: { text: key === 'monument' ? 'ALL VISITORS MUST CHECK IN AT SECURITY' : 'SIGN', color: '#ffffff', logo: '' } } : {}),
    };
  };
  const names = { building: (BUILDING_STYLES[key] || {}).name, booth: (BOOTH_BY_ID[key] || {}).name, roof: (ROOF_BY_ID[key] || {}).name, prop: (PROP_BY_ID[key] || {}).name };
  if (engine && engine.mode !== 'orbit') setCam('orbit');
  ui.pending = { kind, key, name: names[kind] || key, obj: make() };
  ui.selected = null;
  ui.ghost = null;
  ui.measure = null;
  refreshSelection();
  updateGhost();
  drawPanel();
  drawHud();
}

/** Which roof is under the pointer, and where on it. */
function roofHit(ev) {
  const hit = engine.pick(ev);
  if (!hit) return null;
  const b = byId(hit.id);
  if (!b || b.kind !== 'building') return null;
  const x = hit.point.x;
  const y = hit.point.z;
  if (!contains(footprint(b), x, y)) return null;
  const { dx, dy } = roofLocal(b, x, y);
  return { b, x, y, z: roofSurfaceY(b, dx, dy), dx, dy };
}

function ghostAt(ev) {
  const p = ui.pending;
  if (!p) return null;
  const o = p.obj;
  if (p.kind === 'roof') {
    const hit = roofHit(ev);
    if (!hit) {
      // Off the roof, a machine goes on the ground, on its own plinth.
      const g = engine.groundAt(ev);
      if (!g) return null;
      const spec = ROOF_BY_ID[p.key];
      const plant = { kind: 'plant', type: p.key, rot: o.rot || 0, x: 0, y: 0 };
      place(plant, g.x - spec.w / 2, g.y - spec.d / 2, { snap: !ev.altKey });
      return { ok: isClear(state, footprint(plant), null, 'plant'), ground: true, plant, x: plant.x, y: plant.y, z: 0 };
    }
    ui.roofTarget = hit.b;
    return { ok: true, x: hit.x, y: hit.y, z: hit.z, dx: hit.dx, dy: hit.dy };
  }
  const g = engine.groundAt(ev);
  if (!g) return null;
  const fp = footprint(o);
  place(o, g.x - fp.w / 2, g.y - fp.d / 2, { snap: !ev.altKey });
  return { ok: clearFor(o), x: o.x, y: o.y, z: 0 };
}

function placeGhost(ev) {
  const p = ui.pending;
  if (!p || !ui.ghost) return;
  if (!ui.ghost.ok) {
    flashHint('Something solid is already there.');
    return;
  }
  snapshot();
  if (p.kind === 'roof' && ui.ghost.ground) {
    const plant = { ...ui.ghost.plant, id: newId('m') };
    state.objects.push(plant);
    ui.selected = plant.id;
  } else if (p.kind === 'roof') {
    const b = ui.roofTarget;
    if (!b) return;
    const spec = ROOF_BY_ID[p.key];
    b.roofItems.push({ type: p.key, dx: clamp(ui.ghost.dx, spec.w / 2, b.w - spec.w / 2), dy: clamp(ui.ghost.dy, spec.d / 2, b.d - spec.d / 2), rot: (p.obj.rot || 0) - (b.rot || 0) });
    ui.selected = `${b.id}#${b.roofItems.length - 1}`;
  } else {
    const copy = JSON.parse(JSON.stringify(p.obj));
    copy.id = newId(p.kind[0]);
    state.objects.push(copy);
    ui.selected = copy.id;
    if (cutFences(copy)) flashHint('Cut an opening in the fence for the road.');
    if (copy.kind === 'building') {
      const shoved = evictFrom(state, copy);
      if (shoved) flashHint(`Moved ${shoved} thing${shoved > 1 ? 's' : ''} out of the way.`);
    }
  }
  if (!ev.shiftKey) {
    ui.pending = null;
    ui.ghost = null;
    ui.tab = 'edit';
  } else {
    ui.selected = null;
  }
  updateGhost();
  commit();
}

let hintTimer;
function flashHint(text) {
  ui.hint = text;
  drawHud();
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => { ui.hint = ''; drawHud(); }, 2600);
}

/* -------------------------------------------------------------- the stage */

let drag = null;     // { mode, id, start, from, moved }
let press = null;    // { x, y, button } where a click started

function bindStage(stage) {
  if (stage.dataset.bound) return;
  stage.dataset.bound = '1';
  stage.addEventListener('pointerdown', onDown, true);
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('dblclick', onDoubleClick);
  stage.addEventListener('contextmenu', (ev) => ev.preventDefault());
  document.getElementById('minimap')?.addEventListener('click', onMinimap);
}
window.addEventListener('pointerup', onUp);
window.addEventListener('pointercancel', onUp);

function onDown(ev) {
  if (!engine || engine.mode !== 'orbit') return;
  press = { x: ev.clientX, y: ev.clientY, button: ev.button, shift: ev.shiftKey, alt: ev.altKey };
  engine.controls.enabled = true;
  if (ev.button !== 0 || ui.pending || ui.measure || ui.draw) return;
  const hit = engine.pick(ev);
  const doorB = ui.doors && byId(ui.doors.id);
  if (doorB) {
    // Door mode: a press on a door grabs it; a press anywhere else on this
    // building leaves the camera free (a click there adds a door).
    const bay = bayAt(ev, doorB);
    const near = bay && (!hit || hit.id === doorB.id || hit.distance > bay.k - 2);
    if (near) {
      const door = isDoor(doorB.walls[bay.face][0][bay.col]);
      if (door) engine.controls.enabled = false;
      drag = { mode: 'door', id: doorB.id, from: { face: bay.face, col: bay.col }, at: { face: bay.face, col: bay.col }, door, moved: false };
      return;
    }
    if (hit && hit.id === doorB.id) return;
  }
  if (!hit) return;
  const id = hit.roof != null ? `${hit.id}#${hit.roof}` : hit.id;
  // A press on an object grabs it rather than spinning the world.
  engine.controls.enabled = false;
  const wasSelected = ui.selected === id;
  ui.selected = id;
  const roof = selectedRoof();
  if (roof) {
    const y = roofSurfaceY(roof.b, roof.item.dx, roof.item.dy);
    drag = { mode: 'roof', roof, y, start: engine.groundAt(ev, y), from: { dx: roof.item.dx, dy: roof.item.dy }, moved: false };
  } else {
    const o = byId(id);
    if (o && o.kind === 'run') drag = { mode: 'run', id, start: engine.groundAt(ev, 0), from: o.points.map((p) => ({ ...p })), moved: false };
    else if (o) drag = { mode: 'move', id, start: engine.groundAt(ev, 0), from: { x: o.x, y: o.y }, moved: false };
  }
  if (!wasSelected) {
    ui.tab = 'edit';
    refreshSelection();
    drawPanel();
  }
}

let hoverT = 0;
function onMove(ev) {
  if (!engine || engine.mode !== 'orbit') return;
  if (drag && press) {
    if (drag.mode === 'door' && !drag.door) return;    // orbiting
    const dist = Math.hypot(ev.clientX - press.x, ev.clientY - press.y);
    if (!drag.moved && dist < 5) return;
    if (!drag.moved) { snapshot(); drag.moved = true; }
    if (drag.mode === 'move') {
      const o = byId(drag.id);
      const now = engine.groundAt(ev, 0);
      if (!o || !now || !drag.start) return;
      place(o, drag.from.x + (now.x - drag.start.x), drag.from.y + (now.y - drag.start.y), { snap: !ev.altKey });
      const g = world.get(o.id);
      if (g) placeModel(g, o);
      drag.bad = !clearFor(o, o.id);
      ui.hint = drag.bad ? 'Blocked — it will spring back if you drop it here' : '';
      drawFootprint();
      if (footLine && drag.bad) footLine.material.color.set(0xf0524d);
      engine.shadowDirty = true;
      drawHud();
    } else if (drag.mode === 'door') {
      const b = byId(drag.id);
      const bay = b && bayAt(ev, b);
      if (!bay) return;
      drawDoorMark(b, bay, 0x46b4ff);
      if (bay.face === drag.at.face && bay.col === drag.at.col) return;
      // The door takes the new bay; whatever was there fills the old one.
      swapBays(b, drag.at, bay);
      drag.at = { face: bay.face, col: bay.col };
      syncWorld();
      ui.hint = `Moving the ${cellSpec(b.walls[bay.face][0][bay.col]).name.toLowerCase()} — ${FACE_NAME[bay.face].toLowerCase()} wall, bay ${bay.col + 1}`;
      drawHud();
    } else if (drag.mode === 'run') {
      const o = byId(drag.id);
      const now = engine.groundAt(ev, 0);
      if (!o || !now || !drag.start) return;
      let dx = now.x - drag.start.x;
      let dy = now.y - drag.start.y;
      if (prefs.snap && !ev.altKey) { dx = Math.round(dx); dy = Math.round(dy); }
      o.points = drag.from.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
      const g = world.get(o.id);
      if (g) g.position.set(dx, 0, dy);
      engine.shadowDirty = true;
    } else if (drag.mode === 'roof') {
      const { roof } = drag;
      const now = engine.groundAt(ev, drag.y);
      if (!now || !drag.start) return;
      const a = roofLocal(roof.b, now.x, now.y);
      const b0 = roofLocal(roof.b, drag.start.x, drag.start.y);
      const spec = ROOF_BY_ID[roof.item.type] || { w: 8, d: 6 };
      roof.item.dx = clamp(drag.from.dx + (a.dx - b0.dx), spec.w / 2 + 0.5, roof.b.w - spec.w / 2 - 0.5);
      roof.item.dy = clamp(drag.from.dy + (a.dy - b0.dy), spec.d / 2 + 0.5, roof.b.d - spec.d / 2 - 0.5);
      // Move the machine itself without rebuilding the building.
      const g = world.get(roof.b.id);
      if (g) {
        g.traverse((c) => {
          if (c.userData.pick && c.userData.pick.roof === roof.idx) {
            c.position.set(roof.item.dx - roof.b.w / 2, roofSurfaceY(roof.b, roof.item.dx, roof.item.dy), roof.item.dy - roof.b.d / 2);
          }
        });
      }
      engine.shadowDirty = true;
    }
    return;
  }
  if (ui.draw) {
    const now = performance.now();
    if (now - drawT < 45) return;
    drawT = now;
    drawDraw(runPointAt(ev));
    return;
  }
  if (ui.pending) {
    ui.ghost = ghostAt(ev);
    updateGhost();
    drawHud();
    return;
  }
  if (ui.measure && ui.measure.a && !ui.measure.b) {
    const g = engine.groundAt(ev);
    if (g) drawMeasure(ui.measure.a, g, true);
    return;
  }
  // Hover: a pointer hand over things that can be picked.
  const now = performance.now();
  if (ev.buttons || now - hoverT < (ui.doors ? 40 : 90)) return;
  hoverT = now;
  const doorB = ui.doors && byId(ui.doors.id);
  if (doorB) {
    const bay = bayAt(ev, doorB);
    const door = bay && isDoor(doorB.walls[bay.face][0][bay.col]);
    drawDoorMark(doorB, bay, door ? 0x46b4ff : 0x5fd08a);
    engine.renderer.domElement.style.cursor = door ? 'grab' : bay ? 'copy' : '';
    return;
  }
  const hit = engine.pick(ev);
  engine.renderer.domElement.style.cursor = hit ? 'pointer' : '';
}

function onUp(ev) {
  if (!engine) return;
  const wasClick = press && Math.hypot(ev.clientX - press.x, ev.clientY - press.y) < 5 && press.button === 0;
  engine.controls.enabled = true;
  if (drag && drag.mode === 'door') {
    const b = byId(drag.id);
    const d = drag;
    drag = null;
    press = null;
    if (!b) return;
    if (d.moved) {
      ui.hint = '';
      if (d.at.face !== d.from.face || d.at.col !== d.from.col) {
        flashHint(`Door moved to the ${FACE_NAME[d.at.face].toLowerCase()} wall, bay ${d.at.col + 1}`);
      }
      commit();
    } else if (wasClick) clickBay(b, d.from);
    return;
  }
  if (drag) {
    if (drag.moved) {
      if (drag.mode === 'move') {
        const o = byId(drag.id);
        if (o && o.kind === 'building') {
          carryRuns({ ...footprint(o), x: drag.from.x, y: drag.from.y }, footprint(o));
          const shoved = evictFrom(state, o);
          if (shoved) flashHint(`Moved ${shoved} thing${shoved > 1 ? 's' : ''} out of the way.`);
        } else if (o && !clearFor(o, o.id)) {
          o.x = drag.from.x;
          o.y = drag.from.y;
          flashHint('Put back — that spot is taken.');
        } else if (cutFences(o)) flashHint('Cut an opening in the fence for the road.');
      }
      ui.hint = ui.hint.startsWith('Blocked') ? '' : ui.hint;
      drag = null;
      press = null;
      commit();
      return;
    }
    drag = null;
  }
  if (wasClick && screen === 'build' && ev.target === engine.renderer.domElement) {
    if (ui.draw) {
      const p = runPointAt(ev);
      if (p) addDrawPoint(p);
    } else if (ui.pending) {
      ui.ghost = ghostAt(ev);
      placeGhost(ev);
    } else if (ui.measure) {
      const g = engine.groundAt(ev);
      if (g) {
        if (!ui.measure.a || ui.measure.b) ui.measure = { a: g, b: null };
        else { ui.measure.b = g; drawMeasure(ui.measure.a, g, false); }
        drawHud();
      }
    } else if (!engine.pick(ev)) {
      if (ui.selected) {
        ui.selected = null;
        refreshSelection();
        drawPanel();
      }
    }
  }
  press = null;
}

function onDoubleClick(ev) {
  if (ui.draw) { finishDraw(); return; }
  if (!engine || engine.mode !== 'orbit' || ui.pending) return;
  const hit = engine.pick(ev);
  if (hit) focusOn(byId(hit.id));
  else {
    const g = engine.groundAt(ev);
    if (g) engine.flyTo({ x: g.x, z: g.y, dist: 160 });
  }
}

function onMinimap(ev) {
  const cv = ev.currentTarget;
  const r = cv.getBoundingClientRect();
  const s = +cv.dataset.scale;
  const x = ((ev.clientX - r.left) * (cv.width / r.width) - +cv.dataset.ox) / s;
  const y = ((ev.clientY - r.top) * (cv.height / r.height) - +cv.dataset.oy) / s;
  if (engine.mode === 'orbit') engine.flyTo({ x, z: y, ms: 700 });
  else {
    engine.camera.position.x = x;
    engine.camera.position.z = y;
  }
}

function focusOn(o) {
  if (!o) return;
  const fp = footprint(o);
  const size = Math.max(fp.w, fp.d, o.kind === 'building' ? buildingHeight(o) : 10);
  engine.flyTo({ x: fp.x + fp.w / 2, y: o.kind === 'building' ? buildingHeight(o) * 0.35 : 2, z: fp.y + fp.d / 2, dist: size * 1.7 + 30, pitch: 24 * DEG });
}

function walkBlocked(x, z) {
  for (const o of state.objects) {
    if (!isSolid(o)) continue;
    const fp = footprint(o);
    if (contains({ ...fp, x: fp.x - 1.2, y: fp.y - 1.2, w: fp.w + 2.4, d: fp.d + 2.4 }, x, z)) return true;
  }
  return false;
}

function setCam(mode) {
  if (mode !== 'orbit' && ui.draw) cancelDraw();
  engine.lockOnClick = mode === 'walk';
  engine.setMode(mode);
  if (mode !== 'orbit') {
    ui.pending = null;
    ui.ghost = null;
    updateGhost();
  }
  drawHud();
}

/* ----------------------------------------------------------------- measure */

let measureLine = null;
function drawMeasure(a, b, live) {
  if (measureLine) { engine.helpers.remove(measureLine); measureLine.geometry.dispose(); }
  const pts = [new THREE.Vector3(a.x, 0.8, a.y), new THREE.Vector3(b.x, 0.8, b.y)];
  measureLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xffd34d, depthTest: false }));
  measureLine.renderOrder = 11;
  engine.helpers.add(measureLine);
  ui.measureText = `${Math.hypot(b.x - a.x, b.y - a.y).toFixed(1)} ft`;
  ui.measureMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  positionMeasureLabel();
  void live;
}
function positionMeasureLabel() {
  const el = document.getElementById('measureLabel');
  if (!el || !ui.measureMid) return;
  const p = engine.toScreen(ui.measureMid.x, 3, ui.measureMid.y);
  el.style.display = ui.measure ? 'block' : 'none';
  el.style.transform = `translate(${p.x}px, ${p.y}px)`;
  el.textContent = ui.measureText;
}
function stopMeasure() {
  ui.measure = null;
  if (measureLine) { engine.helpers.remove(measureLine); measureLine = null; }
  const el = document.getElementById('measureLabel');
  if (el) el.style.display = 'none';
  drawHud();
}

/* --------------------------------------------------------- ducts and pipes */

let drawGhost = null;
let drawT = 0;
const half = (v) => Math.round(v * 2) / 2;

function armDraw(style, { points = [], extend = null, size = null, color = null } = {}) {
  const spec = RUN_BY_ID[style] || RUNS[0];
  if (engine.mode !== 'orbit') setCam('orbit');
  ui.pending = null;
  ui.ghost = null;
  updateGhost();
  if (ui.measure) stopMeasure();
  ui.draw = { style, size: size || spec.size, color: color || spec.color, points: points.map((p) => ({ ...p })), extend };
  ui.selected = null;
  refreshSelection();
  drawDraw(null);
  drawPanel();
  drawHud();
}

/** Where a click puts the next point: on whatever was clicked, standing off
 *  it by half the duct and a little clearance; or out on the ground. */
function runPointAt(ev) {
  const d = ui.draw;
  const hit = engine.pick(ev);
  if (hit && hit.normal) {
    const n = hit.normal;
    const off = d.size / 2 + (n.y > 0.6 ? 1.5 : 0.5);
    return { x: half(hit.point.x + n.x * off), y: half(hit.point.z + n.z * off), z: Math.max(d.size / 2 + 0.3, half(hit.point.y + n.y * off)) };
  }
  const g = engine.groundAt(ev);
  return g ? { x: half(g.x), y: half(g.y), z: d.size / 2 + (ui.runHigh ? 15 : 1.2) } : null;
}

function extendPath(points, p) {
  if (!points.length) return [p];
  const last = points[points.length - 1];
  if (ui.ortho) return squarePath(last, p);
  return Math.hypot(p.x - last.x, p.y - last.y, p.z - last.z) > 0.05 ? [p] : [];
}

function drawDraw(candidate) {
  if (drawGhost) { engine.helpers.remove(drawGhost); releaseModel(drawGhost); drawGhost = null; }
  const d = ui.draw;
  if (!d) return;
  const pts = [...d.points];
  if (candidate) pts.push(...extendPath(pts, candidate));
  if (pts.length >= 2) {
    drawGhost = buildRun({ style: d.style, size: d.size, color: d.color, points: pts }, makeUnder(state)).finish(new THREE.Group());
  } else if (pts.length === 1) {
    drawGhost = new THREE.Group();
    const dot = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.8, d.size * 0.6), 14, 10));
    dot.position.set(pts[0].x, pts[0].z, pts[0].y);
    drawGhost.add(dot);
  } else return;
  drawGhost.userData = { disposables: [] };
  Engine.ghostify(drawGhost, true);
  engine.helpers.add(drawGhost);
}

function addDrawPoint(p) {
  const d = ui.draw;
  d.points.push(...extendPath(d.points, p));
  drawDraw(null);
  drawHud();
}

function finishDraw() {
  const d = ui.draw;
  if (!d) return;
  ui.draw = null;
  drawDraw(null);
  if (d.points.length < 2) {
    flashHint('A run needs at least two points.');
    drawPanel();
    return;
  }
  snapshot();
  const ext = d.extend ? byId(d.extend) : null;
  if (ext) {
    ext.points = d.points;
    ui.selected = ext.id;
  } else {
    const run = { id: newId('r'), kind: 'run', style: d.style, size: d.size, color: d.color, points: d.points };
    state.objects.push(run);
    ui.selected = run.id;
  }
  ui.tab = 'edit';
  commit();
}

function cancelDraw() {
  ui.draw = null;
  drawDraw(null);
  drawPanel();
  drawHud();
}

/** The top of the selected machine, roof-mounted or on the ground. */
function machineTop() {
  const roof = selectedRoof();
  if (roof) {
    const spec = ROOF_BY_ID[roof.item.type] || { h: 3 };
    const [x, y] = planWorld(footprint(roof.b), roof.item.dx - roof.b.w / 2, roof.item.dy - roof.b.d / 2);
    return { x, y, z: roofSurfaceY(roof.b, roof.item.dx, roof.item.dy) + (spec.big ? 2.6 : 0) + spec.h };
  }
  const o = selected();
  if (o && o.kind === 'plant') {
    const spec = ROOF_BY_ID[o.type] || { h: 3 };
    const f = footprint(o);
    return { x: f.x + f.w / 2, y: f.y + f.d / 2, z: (spec.big ? 0.8 : 0.5) + spec.h };
  }
  return null;
}

/** Ducts and pipes on or against a building go where the building goes. */
function carryRuns(before, after) {
  const grown = { ...before, x: before.x - 3, y: before.y - 3, w: before.w + 6, d: before.d + 6 };
  for (const r of state.objects) {
    if (r.kind !== 'run') continue;
    for (const p of r.points || []) {
      if (!contains(grown, p.x, p.y)) continue;
      const [lx, ly] = planLocal(before, p.x, p.y);
      const [wx, wy] = planWorld(after, lx, ly);
      p.x = wx;
      p.y = wy;
    }
  }
}

function shiftRun(o, dx, dy) {
  for (const p of o.points || []) { p.x += dx; p.y += dy; }
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
  commit();
}

function rotateSelected(deg) {
  const roof = selectedRoof();
  snapshot();
  if (roof) roof.item.rot = ((roof.item.rot || 0) + deg) % 360;
  else {
    const o = selected();
    if (!o) return;
    if (o.kind === 'run') { undoStack.pop(); return flashHint('Ducts and pipes follow their points — drag them, or extend them.'); }
    const before = footprint(o);
    o.rot = (((o.rot || 0) + deg) % 360 + 360) % 360;
    if (o.kind === 'building') { carryRuns(before, footprint(o)); evictFrom(state, o); }
    else if (!isClear(state, footprint(o), o.id, o.kind)) {
      o.rot = (((o.rot || 0) - deg) % 360 + 360) % 360;
      flashHint('No room to turn it there — drag it clear first.');
    }
  }
  commit();
}

function exportFile() {
  const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(ui.slotName || 'site').replace(/[^\w-]+/g, '-').toLowerCase()}.building.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function importFile(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const next = normalize(JSON.parse(r.result));
      snapshot();
      state = next;
      ui.selected = null;
      engine.setEnv(state.env);
      commit();
      engine.snapView('corner');
      flashHint('Site imported.');
    } catch {
      flashHint('That file is not a site save.');
    }
  };
  r.readAsText(file);
}

function setPhoto(on) {
  document.body.classList.toggle('photo', on);
  ui.photo = on;
  if (on) { engine.setSelection([]); if (footLine) footLine.visible = false; } else { refreshSelection(); }
}

function shoot(scale = 1) {
  const r = engine.renderer;
  const old = r.getPixelRatio();
  // Photos always use the full resolution, whatever adaptive scaling is doing.
  const want = engine.baseRatio * scale;
  const resize = (ratio) => {
    r.setPixelRatio(ratio);
    engine.composer.setPixelRatio(ratio);
    engine.composer.setSize(engine.host.clientWidth, engine.host.clientHeight);
  };
  if (Math.abs(want - old) > 0.01) resize(want);
  const url = engine.capture('image/png');
  if (Math.abs(want - old) > 0.01) resize(old);
  const a = document.createElement('a');
  a.href = url;
  a.download = `site-${hourLabel(state.env.hour).replace(':', '')}.png`;
  a.click();
}

function applyAction(el, ev) {
  const act = el.dataset.act;
  const key = el.dataset.key;
  const value = el.dataset.value;
  const o = selected();

  switch (act) {
    case 'tab': ui.tab = value; document.getElementById('panel')?.classList.remove('collapsed'); return drawPanel();
    case 'panel-toggle': document.getElementById('panel')?.classList.toggle('collapsed'); return;
    case 'cat': ui.cat = value; return drawPanel();
    case 'arm': return armItem(el.dataset.kind, el.dataset.key);
    case 'cancel': ui.pending = null; ui.ghost = null; updateGhost(); drawPanel(); return drawHud();
    case 'select': ui.selected = value; refreshSelection(); return drawPanel();
    case 'wall': ui.wall = value; return drawPanel();
    case 'look-wall': {
      if (!o || o.kind !== 'building') return;
      const fp = footprint(o);
      const yawFor = { N: 0, E: 90, S: 180, W: -90 }[ui.wall] - (o.rot || 0);
      return engine.flyTo({ x: fp.x + fp.w / 2, y: buildingHeight(o) * 0.4, z: fp.y + fp.d / 2, dist: Math.max(fp.w, fp.d) * 1.2 + 40, yaw: yawFor * DEG, pitch: 12 * DEG });
    }
    case 'paint': ui.paint = value; return drawPanel();
    case 'door-mode': {
      if (!o || o.kind !== 'building') return;
      return setDoorMode(ui.doors && ui.doors.id === o.id ? null : o);
    }
    case 'door-type': ui.doorType = value; drawPanel(); return drawHud();
    case 'door-slide':
    case 'door-wall':
    case 'door-swap':
    case 'door-del':
    case 'door-look': {
      if (!o || o.kind !== 'building') return;
      const face = el.dataset.face;
      const col = +el.dataset.col;
      if (!o.walls[face] || !isDoor(o.walls[face][0][col])) return;
      if (act === 'door-look') {
        const f = wallFrames(footprint(o))[face];
        const t = (col + 0.5) * (f.len / wallCols(o, face));
        const yaw = { N: 0, E: 90, S: 180, W: -90 }[face] - (o.rot || 0);
        drawDoorMark(o, { face, col }, 0x46b4ff);
        if (!ui.doors) setTimeout(() => { if (!ui.doors) drawDoorMark(null); }, 2600);
        return engine.flyTo({ x: f.o[0] + f.u[0] * t, y: 6, z: f.o[1] + f.u[1] * t, dist: 70, yaw: yaw * DEG, pitch: 14 * DEG });
      }
      snapshot();
      const here = { face, col };
      if (act === 'door-slide') swapBays(o, here, stepBay(o, face, col, +value));
      else if (act === 'door-wall') {
        // Same place along the next wall round.
        const next = FACES[(FACES.indexOf(face) + 1) % 4];
        const n = wallCols(o, next);
        swapBays(o, here, { face: next, col: clamp(Math.round(((col + 0.5) / wallCols(o, face)) * n - 0.5), 0, n - 1) });
      } else if (act === 'door-swap') o.walls[face][0][col] = ui.doorType;
      else o.walls[face][0][col] = plainCell(o, face);
      return commit();
    }
    case 'cell': {
      if (!o || o.kind !== 'building') return;
      const row = +el.dataset.row;
      const col = +el.dataset.col;
      const spec = CELLS.find((c) => c.id === ui.paint) || CELLS[0];
      if (row > 0 && !spec.upper) return flashHint(`${spec.name} only goes on the ground floor.`);
      snapshot();
      o.walls[el.dataset.face][row][col] = o.walls[el.dataset.face][row][col] === ui.paint ? 'blank' : ui.paint;
      return commit();
    }
    case 'bays': {
      if (!o || o.kind !== 'building') return;
      snapshot();
      setBays(o, ui.wall, wallCols(o, ui.wall) + (+value));
      return commit();
    }
    case 'fillwall':
    case 'fillrow': {
      if (!o || o.kind !== 'building') return;
      const spec = CELLS.find((c) => c.id === ui.paint) || CELLS[0];
      snapshot();
      o.walls[ui.wall].forEach((row, i) => {
        if (i > 0 && (!spec.upper || act === 'fillrow')) return;
        for (let c = 0; c < row.length; c++) row[c] = ui.paint;
      });
      return commit();
    }
    case 'clearwall': {
      if (!o || o.kind !== 'building') return;
      snapshot();
      o.walls[ui.wall].forEach((row) => { for (let c = 0; c < row.length; c++) row[c] = 'blank'; });
      return commit();
    }
    case 'pick-roof': ui.selected = `${o.id}#${value}`; refreshSelection(); return drawPanel();
    case 'roof-rot': {
      if (!o) return;
      snapshot();
      o.roofItems[+value].rot = ((o.roofItems[+value].rot || 0) + 45) % 360;
      return commit();
    }
    case 'roof-del': {
      if (!o) return;
      snapshot();
      o.roofItems.splice(+value, 1);
      return commit();
    }
    case 'rot': return rotateSelected(+value);
    case 'delete': return deleteSelected();
    case 'focus': return focusOn(o || (selectedRoof() || {}).b);
    case 'dup': {
      const roof = selectedRoof();
      snapshot();
      if (roof) {
        const spec = ROOF_BY_ID[roof.item.type] || { w: 8 };
        roof.b.roofItems.push({ ...roof.item, dx: clamp(roof.item.dx + spec.w + 2, spec.w / 2, roof.b.w - spec.w / 2) });
        ui.selected = `${roof.b.id}#${roof.b.roofItems.length - 1}`;
        return commit();
      }
      if (!o) return;
      const copy = JSON.parse(JSON.stringify(o));
      copy.id = newId(o.kind[0]);
      const fp = footprint(o);
      if (o.kind === 'run') shiftRun(copy, Math.max(4, (copy.size || 2) * 2), Math.max(4, (copy.size || 2) * 2));
      else place(copy, o.x + (o.kind === 'building' ? fp.w + 30 : Math.max(6, fp.w + 4)), o.y, { snap: false });
      state.objects.push(copy);
      if (copy.kind === 'building') evictFrom(state, copy);
      ui.selected = copy.id;
      return commit();
    }
    case 'set': {
      if (!o) return;
      snapshot();
      o[key] = value;
      return commit();
    }
    case 'toggle': {
      if (!o) return;
      snapshot();
      o[key] = o[key] === false;
      return commit();
    }
    case 'toggle-true': {
      if (!o) return;
      snapshot();
      o[key] = !o[key];
      return commit();
    }
    case 'signtoggle': {
      if (!o) return;
      snapshot();
      o.sign.on = !o.sign.on;
      return commit();
    }
    case 'sign': {
      if (!o || value === undefined) return;
      snapshot();
      o.sign = { ...(o.sign || {}), [key]: value };
      return commit();
    }
    case 'site': {
      snapshot();
      state.site[key] = !state.site[key];
      return commit();
    }
    case 'pref': {
      prefs[key] = !prefs[key];
      savePrefs();
      if (key === 'minimap') drawMinimap(true);
      if (key === 'debug') { const f = document.getElementById('fps'); if (f) f.textContent = ''; }
      if (key === 'autoRes') engine.setAutoRes(prefs.autoRes);
      return drawPanel();
    }
    case 'clear-props': {
      if (!confirm('Delete every prop, booth and vehicle? Buildings stay.')) return;
      snapshot();
      state.objects = state.objects.filter((x) => x.kind === 'building');
      ui.selected = null;
      return commit();
    }
    case 'draw': return ui.draw && ui.draw.style === key ? cancelDraw() : armDraw(key);
    case 'ortho': ui.ortho = !ui.ortho; return drawPanel();
    case 'runhigh': ui.runHigh = !ui.runHigh; return drawPanel();
    case 'duct-from': {
      const top = machineTop();
      if (!top) return;
      ui.cat = 'Ducts & pipes';
      ui.tab = 'add';
      return armDraw('duct', { points: [{ ...top, z: top.z + RUN_BY_ID.duct.size * 0.33 + 0.4 }] });
    }
    case 'run-extend': {
      if (!o || o.kind !== 'run') return;
      ui.tab = 'add';
      ui.cat = 'Ducts & pipes';
      return armDraw(o.style, { points: o.points, extend: o.id, size: o.size, color: o.color });
    }
    case 'run-pop': {
      if (!o || o.kind !== 'run' || o.points.length <= 2) return flashHint('A run needs at least two points — delete it instead.');
      snapshot();
      o.points.pop();
      return commit();
    }
    case 'cam': return setCam(value);
    case 'view': if (engine.mode !== 'orbit') setCam('orbit'); return engine.view(value);
    case 'north': {
      if (engine.mode !== 'orbit') return;
      const c = engine.controls;
      const d = engine.camera.position.distanceTo(c.target);
      return engine.flyTo({ x: c.target.x, y: c.target.y, z: c.target.z, dist: d, yaw: 0 });
    }
    case 'hour': return;
    case 'set-hour': {
      state.env.hour = +value;
      engine.setEnv({ hour: state.env.hour });
      updateClock();
      save();
      return drawPanel();
    }
    case 'cycle': state.env.cycle = !state.env.cycle; save(); drawTimebar(); return drawPanel();
    case 'speed': ui.speed = +value; if (!state.env.cycle) state.env.cycle = true; drawTimebar(); return drawPanel();
    case 'weather': state.env.weather = value; engine.setEnv({ weather: value }); save(); drawTimebar(); return drawPanel();
    case 'season': state.env.season = value; engine.setEnv({ season: value }); save(); return drawPanel();
    case 'env-toggle': {
      state.env[key] = state.env[key] === false;
      life.traffic = state.env.traffic !== false;
      life.people = state.env.people !== false;
      save();
      return drawPanel();
    }
    case 'quality': {
      prefs.quality = value;
      savePrefs();
      engine.setQuality(value);
      return drawPanel();
    }
    case 'measure':
      if (ui.measure) return stopMeasure();
      ui.pending = null;
      updateGhost();
      ui.measure = { a: null, b: null };
      if (engine.mode !== 'orbit') setCam('orbit');
      return drawHud();
    case 'photo': return setPhoto(!ui.photo);
    case 'photo-shoot': return shoot(+(value || 1));
    case 'undo': return restore(undoStack, redoStack);
    case 'redo': return restore(redoStack, undoStack);
    case 'slot-save': {
      const name = (document.getElementById('slotName')?.value || '').trim() || `Site ${new Date().toLocaleDateString()}`;
      const slots = loadSlots();
      slots[name] = { savedAt: Date.now(), state };
      ui.slotName = name;
      if (!saveSlots(slots)) return flashHint('Could not save — browser storage is full.');
      flashHint(`Saved “${name}”.`);
      return drawPanel();
    }
    case 'slot-load': {
      const s = loadSlots()[value];
      if (!s) return;
      state = normalize(JSON.parse(JSON.stringify(s.state)));
      ui.slotName = value;
      ui.selected = null;
      undoStack.length = 0;
      redoStack.length = 0;
      save();
      if (screen !== 'build') return buildScreen();
      engine.setEnv(state.env);
      commit();
      engine.snapView('corner');
      return flashHint(`Opened “${value}”.`);
    }
    case 'slot-del': {
      if (!confirm(`Delete the saved site “${value}”?`)) return;
      const slots = loadSlots();
      delete slots[value];
      saveSlots(slots);
      return screen === 'build' ? drawPanel() : startScreen();
    }
    case 'export': return exportFile();
    case 'restart':
      if (!confirm('Start a new site? Your current one stays in the autosave until you break ground.')) return;
      pendingStart = { preset: state.preset || 'warehouse', lot: { ...state.lot } };
      return startScreen();
    case 'resume': {
      const s = load();
      if (s) state = s;
      return buildScreen();
    }
    case 'pick-preset':
      pendingStart.preset = value;
      pendingStart.lot = { ...SITE_PRESETS[value].lot };
      return startScreen();
    case 'break-ground': {
      state = freshState(pendingStart.preset);
      state.lot = { ...pendingStart.lot };
      ui.selected = null;
      ui.tab = 'add';
      undoStack.length = 0;
      redoStack.length = 0;
      save();
      buildScreen();
      if (engine) setTimeout(() => engine.snapView('corner'), 60);
      return;
    }
    default:
  }
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el || el.tagName === 'INPUT') return;
  applyAction(el, ev);
});

document.addEventListener('change', (ev) => {
  const el = ev.target;
  if (el.id === 'importFile' && el.files && el.files[0]) { importFile(el.files[0]); el.value = ''; return; }
  if (!el.dataset?.act) return;
  const act = el.dataset.act;
  const o = selected();
  if (o && o.kind === 'building' && act === 'num') evictFrom(state, o);
  if (['num', 'lot', 'sign', 'sign-num', 'rename'].includes(act)) {
    save();
    syncWorld();
    drawPanel();
  } else if (act === 'hour') {
    save();
  }
});

let editSnapT = 0;
document.addEventListener('input', (ev) => {
  const el = ev.target;
  const act = el.dataset.act;
  if (!act) return;
  const num = Number(el.value);
  const label = document.querySelector(`label[for="${el.id}"] b`);
  // One undo step per gesture, not one per pixel of slider travel.
  const once = () => { const now = performance.now(); if (now - editSnapT > 900) snapshot(); editSnapT = now; };

  if (act === 'lot-w' || act === 'lot-d') {
    pendingStart.lot[act === 'lot-w' ? 'width' : 'depth'] = num;
    if (label) label.textContent = `${num} ft`;
    const ac = document.getElementById('acres');
    if (ac) ac.textContent = `${(pendingStart.lot.width * pendingStart.lot.depth / 43560).toFixed(2)} acres.`;
    return;
  }
  if (act === 'hour') {
    state.env.hour = num;
    engine.setEnv({ hour: num });
    updateClock();
    const other = document.getElementById(el.id === 'hour' ? 'w-hour' : 'hour');
    if (other) other.value = num;
    const wl = document.querySelector('label[for="w-hour"] b');
    if (wl) wl.textContent = hourLabel(num);
    return queueSave();
  }
  if (act === 'lot') {
    once();
    state.lot[el.dataset.key] = num;
    if (label) label.textContent = `${num} ft`;
    queueSave();
    return queueSync();
  }
  if (act === 'num') {
    const o = selected();
    if (!o) return;
    once();
    const key = el.dataset.key;
    if (key === 'floors') setFloors(o, num);
    else if (key === 'height') o.height = num;
    else o[key] = num;
    if (label) label.textContent = key === 'floors' ? String(num) : `${Math.round(num)} ft`;
    queueSave();
    return queueSync();
  }
  if (act === 'rename') {
    const o = selected();
    if (!o) return;
    o.name = el.value;
    return queueSave();
  }
  if (act === 'sign' || act === 'sign-num') {
    const o = selected();
    if (!o) return;
    once();
    o.sign = { ...(o.sign || {}), [el.dataset.key]: act === 'sign-num' ? num : el.value };
    if (act === 'sign-num' && label) label.textContent = `${Math.round(num * 100)}%`;
    queueSave();
    return queueSync();
  }
});

document.addEventListener('keydown', (ev) => {
  if (screen !== 'build' || ev.target.matches('input, textarea, select')) return;
  const step = ev.shiftKey ? 10 : 2;
  const key = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
  if (ui.draw) {
    if (ev.key === 'Escape') return cancelDraw();
    if (ev.key === 'Enter') { ev.preventDefault(); return finishDraw(); }
    if (ev.key === 'Backspace' || ev.key === 'Delete') {
      ev.preventDefault();
      if (ui.draw.points.length) ui.draw.points.pop();
      drawDraw(null);
      return drawHud();
    }
  }
  if (ev.key === 'Escape') {
    if (ui.photo) return setPhoto(false);
    if (engine.mode !== 'orbit' && !document.pointerLockElement) return setCam('orbit');
    if (ui.measure) return stopMeasure();
    if (ui.doors) return setDoorMode(null);
    if (ui.pending) { ui.pending = null; ui.ghost = null; updateGhost(); drawPanel(); return drawHud(); }
    ui.selected = null;
    refreshSelection();
    return drawPanel();
  }
  if ((ev.ctrlKey || ev.metaKey) && key === 'z') { ev.preventDefault(); return ev.shiftKey ? restore(redoStack, undoStack) : restore(undoStack, redoStack); }
  if ((ev.ctrlKey || ev.metaKey) && key === 'y') { ev.preventDefault(); return restore(redoStack, undoStack); }
  if ((ev.ctrlKey || ev.metaKey) && key === 'd') { ev.preventDefault(); return applyAction({ dataset: { act: 'dup' } }); }
  if ((ev.ctrlKey || ev.metaKey) && key === 's') { ev.preventDefault(); ui.tab = 'saves'; return drawPanel(); }
  if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
  if (key === '1') return setCam('orbit');
  if (key === '2') return setCam('drone');
  if (key === '3') return setCam('walk');
  if (key === 'p') return setPhoto(!ui.photo);
  if (key === 't') return applyAction({ dataset: { act: 'cycle' } });
  if (key === 'n' && engine.mode === 'orbit') return applyAction({ dataset: { act: 'north' } });
  if (key === 'l') {
    state.env.hour = state.env.hour >= 6.5 && state.env.hour < 19 ? 21.5 : 13;
    engine.setEnv({ hour: state.env.hour });
    updateClock();
    return save();
  }
  if (key === 'm') { prefs.minimap = !prefs.minimap; savePrefs(); return drawMinimap(true); }
  if (key === 'g') { prefs.snap = !prefs.snap; savePrefs(); flashHint(`Snapping ${prefs.snap ? 'on' : 'off'}.`); return; }
  if (engine.mode !== 'orbit') return;
  if (ev.key === 'Delete' || ev.key === 'Backspace') { if (ui.selected) { deleteSelected(); ev.preventDefault(); } return; }
  if (key === 'r') {
    if (ui.pending) {
      ui.pending.obj.rot = ((ui.pending.obj.rot || 0) + (ev.shiftKey ? -15 : 15) + 360) % 360;
      if (ui.ghost && ui.pending.kind !== 'roof') ui.ghost.ok = isClear(state, footprint(ui.pending.obj), null, ui.pending.obj.kind);
      return updateGhost();
    }
    return rotateSelected(ev.shiftKey ? -15 : 15);
  }
  if (key === 'f') return focusOn(selected() || (selectedRoof() || {}).b);
  const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (arrows[ev.key] && ui.selected) {
    ev.preventDefault();
    const [ax, ay] = arrows[ev.key];
    // Nudge relative to the way the camera faces.
    const h = engine.heading;
    const dx = Math.round((ax * Math.cos(h) - ay * Math.sin(h)) * step);
    const dy = Math.round((ax * Math.sin(h) + ay * Math.cos(h)) * step);
    const roof = selectedRoof();
    const o = selected();
    snapshot();
    if (roof) { roof.item.dx += dx; roof.item.dy += dy; } else if (o && o.kind === 'run') {
      shiftRun(o, dx, dy);
    } else if (o) {
      const was = { x: o.x, y: o.y };
      const before = footprint(o);
      place(o, o.x + dx, o.y + dy, { snap: false });
      if (o.kind !== 'building' && !isClear(state, footprint(o), o.id, o.kind)) {
        o.x = was.x;
        o.y = was.y;
        flashHint('Blocked — something solid is in the way.');
      }
      if (o.kind === 'building') { carryRuns(before, footprint(o)); evictFrom(state, o); }
    }
    commit({ panel: false });
  }
});

window.addEventListener('beforeunload', save);

// The top bar wraps on narrow screens; the 3D view starts wherever it ends.
const topbar = document.querySelector('.topbar');
if (topbar && 'ResizeObserver' in window) {
  new ResizeObserver(() => document.documentElement.style.setProperty('--top', `${topbar.offsetHeight}px`)).observe(topbar);
}

if (screen === 'build') buildScreen(); else startScreen();
