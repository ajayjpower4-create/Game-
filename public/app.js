/* =====================================================================
   Layout Maker — draw floor plans of anything.
   Pure client-side. No build step, no server. Persists to localStorage.
   ===================================================================== */

(() => {
  'use strict';

  // ---------- Constants ----------------------------------------------------

  const STORAGE_KEY = 'layout-maker:project:v1';
  const CELL = 24; // world pixels per grid cell (before zoom)

  const LOT_SIZES = [
    // Standard lots
    { key: 'small',   name: 'Small',                   cols: 16,  rows: 12,  group: 'Standard lots', note: 'A room or two' },
    { key: 'medium',  name: 'Medium',                  cols: 24,  rows: 18,  group: 'Standard lots', note: 'Café / small shop' },
    { key: 'xmedium', name: 'Extra Medium',            cols: 30,  rows: 22,  group: 'Standard lots', note: 'Restaurant' },
    { key: 'large',   name: 'Large',                   cols: 38,  rows: 26,  group: 'Standard lots', note: 'House / office' },
    { key: 'xl',      name: 'Extra Large',             cols: 46,  rows: 32,  group: 'Standard lots', note: 'Big house' },
    { key: 'xxl',     name: 'Extra Extra Large',       cols: 56,  rows: 38,  group: 'Standard lots', note: 'Supermarket' },
    { key: 'xxxl',    name: 'Extra Extra Extra Large', cols: 68,  rows: 46,  group: 'Standard lots', note: 'Store block' },
    { key: 'xxxxl',   name: 'Extra ×4 Large',          cols: 82,  rows: 56,  group: 'Standard lots', note: 'Department store' },

    // Big builds — business & institutional scale
    { key: 'long-business', name: 'Long Business', cols: 104, rows: 28,  group: 'Big builds', note: 'Strip mall / long storefront' },
    { key: 'warehouse',     name: 'Warehouse',     cols: 92,  rows: 62,  group: 'Big builds', note: 'Warehouse / distribution' },
    { key: 'superstore',    name: 'Superstore',    cols: 116, rows: 76,  group: 'Big builds', note: 'Big-box superstore' },
    { key: 'school',        name: 'School',        cols: 128, rows: 86,  group: 'Big builds', note: 'Elementary / middle school' },
    { key: 'high-school',   name: 'High School',   cols: 156, rows: 106, group: 'Big builds', note: 'High school campus' },
    { key: 'mall',          name: 'Shopping Mall', cols: 180, rows: 98,  group: 'Big builds', note: 'Mall / large complex' },
    { key: 'campus',        name: 'Mega Campus',   cols: 212, rows: 142, group: 'Big builds', note: 'University / industrial park' },

    // Estates & land — property / grounds scale
    { key: 'mansion',    name: 'Mansion & Grounds', cols: 260, rows: 180, group: 'Estates & land', note: 'Estate house + gardens' },
    { key: 'resort',     name: 'Resort',            cols: 340, rows: 230, group: 'Estates & land', note: 'Hotel resort + grounds' },
    { key: 'stadium',    name: 'Stadium Complex',   cols: 300, rows: 300, group: 'Estates & land', note: 'Arena + parking' },
    { key: 'golf',       name: 'Golf Course',       cols: 560, rows: 360, group: 'Estates & land', note: '18-hole course' },
    { key: 'airport',    name: 'Airport',           cols: 680, rows: 440, group: 'Estates & land', note: 'Terminals + runways' },
    { key: 'town',       name: 'Small Town',        cols: 820, rows: 560, group: 'Estates & land', note: 'Streets & blocks' },
  ];

  // Curated palette — successive rooms cycle through these.
  const PALETTE = [
    '#6db3d8', '#c79a5b', '#a8c0d0', '#7bb389', '#8b95d6', '#d88a8a',
    '#e0b84a', '#74c3a8', '#b79ad6', '#d6a0b8', '#9aa0a8', '#7f8fb5',
    '#e08a5a', '#8ec06b', '#5b8cff', '#d86c78', '#57c2c2', '#c9b06a',
  ];

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const uid = () => Math.random().toString(36).slice(2, 9);

  // ---------- State --------------------------------------------------------

  /** @type {any} */
  let project = null;      // { name, lot:{key,name,cols,rows}, floors:[], activeFloor, colorIndex }
  let selectedId = null;   // selected room id (on active floor)
  let tool = 'select';

  // view transform
  let view = { scale: 1, offX: 0, offY: 0 };

  // interaction scratch
  let drag = null;         // active drag descriptor
  let polyPoints = null;   // array of {x,y} while drawing a polygon
  let hoverHandle = null;

  // undo/redo — snapshots of floors+activeFloor JSON
  let undoStack = [];
  let redoStack = [];

  // ---------- DOM ----------------------------------------------------------

  const $ = (id) => document.getElementById(id);
  const startScreen  = $('start-screen');
  const editorScreen = $('editor-screen');
  const sizeGrid     = $('size-grid');
  const canvas       = $('canvas');
  const canvasWrap   = $('canvas-wrap');
  const ctx          = canvas.getContext('2d');

  // =====================================================================
  //  START SCREEN
  // =====================================================================

  function buildSizeGrid() {
    sizeGrid.innerHTML = '';
    const order = [];
    const byGroup = new Map();
    for (const s of LOT_SIZES) {
      if (!byGroup.has(s.group)) { byGroup.set(s.group, []); order.push(s.group); }
      byGroup.get(s.group).push(s);
    }
    for (const g of order) {
      const title = document.createElement('h3');
      title.className = 'size-group-title';
      title.textContent = g;
      sizeGrid.appendChild(title);

      const row = document.createElement('div');
      row.className = 'size-grid-row';
      for (const s of byGroup.get(g)) {
        const card = document.createElement('button');
        card.className = 'size-card';
        // preview fill proportions reflect the lot's aspect ratio
        const big = Math.max(s.cols, s.rows);
        const wPct = Math.round((s.cols / big) * 82);
        const hPct = Math.round((s.rows / big) * 82);
        card.innerHTML = `
          <div class="sc-preview"><div class="sc-fill" style="width:${wPct}%;height:${hPct}%"></div></div>
          <div class="sc-name">${s.name}</div>
          <div class="sc-dims">${s.cols} × ${s.rows} cells</div>
          ${s.note ? `<div class="sc-note">${s.note}</div>` : ''}`;
        card.addEventListener('click', () => startNewProject(s));
        row.appendChild(card);
      }
      sizeGrid.appendChild(row);
    }
  }

  function startNewProject(size) {
    project = {
      name: 'Untitled Layout',
      lot: { key: size.key, name: size.name, cols: size.cols, rows: size.rows },
      floors: [{ id: uid(), name: 'Ground Floor', rooms: [] }],
      activeFloor: 0,
      colorIndex: 0,
    };
    selectedId = null;
    undoStack = []; redoStack = [];
    enterEditor();
    save();
  }

  function refreshResumeButton() {
    const btn = $('load-saved-btn');
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      btn.hidden = false;
      try {
        const p = JSON.parse(raw);
        btn.textContent = `Resume "${p.name || 'saved layout'}"`;
      } catch { /* ignore */ }
    } else {
      btn.hidden = true;
    }
  }

  // =====================================================================
  //  EDITOR ENTRY
  // =====================================================================

  function enterEditor() {
    startScreen.hidden = true;
    editorScreen.hidden = false;
    $('project-name').value = project.name;
    $('lot-badge').textContent = `${project.lot.name} · ${project.lot.cols}×${project.lot.rows}`;
    setTool('select');
    resizeCanvas();
    zoomToFit();
    renderFloors();
    renderRoomList();
    renderInspector();
    updateUndoButtons();
  }

  function goHome() {
    save();
    editorScreen.hidden = true;
    startScreen.hidden = false;
    refreshResumeButton();
  }

  // =====================================================================
  //  HELPERS: geometry / active floor
  // =====================================================================

  const activeFloor = () => project.floors[project.activeFloor];
  const rooms = () => activeFloor().rooms;
  const selectedRoom = () => rooms().find((r) => r.id === selectedId) || null;

  const worldW = () => project.lot.cols * CELL;
  const worldH = () => project.lot.rows * CELL;

  // screen <-> world
  const toWorld = (sx, sy) => ({
    x: (sx - view.offX) / view.scale,
    y: (sy - view.offY) / view.scale,
  });
  const snap = (v) => Math.round(v / CELL) * CELL;

  // rect helpers (rooms of type 'rect' store x,y,w,h in world px)
  function roomBounds(r) {
    if (r.type === 'poly') {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of r.points) {
        minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
      }
      return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    }
    return { x: r.x, y: r.y, w: r.w, h: r.h };
  }

  function pointInRoom(r, wx, wy) {
    if (r.type === 'poly') return pointInPoly(r.points, wx, wy);
    return wx >= r.x && wx <= r.x + r.w && wy >= r.y && wy <= r.y + r.h;
  }

  function pointInPoly(pts, x, y) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
      const intersect = ((yi > y) !== (yj > y)) &&
        (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  // topmost room at a world point
  function roomAt(wx, wy) {
    const rs = rooms();
    for (let i = rs.length - 1; i >= 0; i--) {
      if (pointInRoom(rs[i], wx, wy)) return rs[i];
    }
    return null;
  }

  const HANDLE = 8; // screen px
  function resizeHandles(r) {
    const b = roomBounds(r);
    return [
      { id: 'nw', x: b.x,         y: b.y },
      { id: 'n',  x: b.x + b.w/2, y: b.y },
      { id: 'ne', x: b.x + b.w,   y: b.y },
      { id: 'e',  x: b.x + b.w,   y: b.y + b.h/2 },
      { id: 'se', x: b.x + b.w,   y: b.y + b.h },
      { id: 's',  x: b.x + b.w/2, y: b.y + b.h },
      { id: 'sw', x: b.x,         y: b.y + b.h },
      { id: 'w',  x: b.x,         y: b.y + b.h/2 },
    ];
  }

  function handleAt(sx, sy, r) {
    for (const h of resizeHandles(r)) {
      const hs = { x: h.x * view.scale + view.offX, y: h.y * view.scale + view.offY };
      if (Math.abs(sx - hs.x) <= HANDLE && Math.abs(sy - hs.y) <= HANDLE) return h;
    }
    return null;
  }

  // =====================================================================
  //  RENDERING
  // =====================================================================

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvasWrap.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function zoomToFit() {
    const rect = canvasWrap.getBoundingClientRect();
    const pad = 60;
    const sx = (rect.width - pad) / worldW();
    const sy = (rect.height - pad) / worldH();
    view.scale = clamp(Math.min(sx, sy), 0.02, 4);
    view.offX = (rect.width - worldW() * view.scale) / 2;
    view.offY = (rect.height - worldH() * view.scale) / 2;
    draw();
  }

  function zoomBy(factor) {
    const rect = canvasWrap.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    const before = toWorld(cx, cy);
    view.scale = clamp(view.scale * factor, 0.02, 6);
    view.offX = cx - before.x * view.scale;
    view.offY = cy - before.y * view.scale;
    draw();
  }

  function draw() {
    const rect = canvasWrap.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    // lot background
    const ox = view.offX, oy = view.offY, s = view.scale;
    ctx.save();
    ctx.fillStyle = '#0f1420';
    ctx.fillRect(ox, oy, worldW() * s, worldH() * s);

    // grid — thin out lines on big lots / low zoom so they stay legible,
    // and only iterate over cells currently in view for performance.
    const cellPx = CELL * s;
    const step = cellPx >= 6 ? 1 : Math.ceil(6 / cellPx);
    const c0 = Math.max(0, Math.floor((-ox) / cellPx / step) * step);
    const c1 = Math.min(project.lot.cols, Math.ceil((rect.width - ox) / cellPx));
    const r0 = Math.max(0, Math.floor((-oy) / cellPx / step) * step);
    const r1 = Math.min(project.lot.rows, Math.ceil((rect.height - oy) / cellPx));
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = c0; c <= c1; c += step) {
      const x = Math.round(ox + c * cellPx) + 0.5;
      ctx.moveTo(x, Math.max(oy, 0)); ctx.lineTo(x, Math.min(oy + worldH() * s, rect.height));
    }
    for (let r = r0; r <= r1; r += step) {
      const y = Math.round(oy + r * cellPx) + 0.5;
      ctx.moveTo(Math.max(ox, 0), y); ctx.lineTo(Math.min(ox + worldW() * s, rect.width), y);
    }
    ctx.stroke();

    // lot border
    ctx.strokeStyle = 'rgba(91,140,255,0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(ox, oy, worldW() * s, worldH() * s);

    // rooms
    for (const r of rooms()) drawRoom(r);

    // in-progress polygon
    if (polyPoints && polyPoints.length) drawPolyDraft();

    ctx.restore();

    // selection chrome (screen space)
    const sel = selectedRoom();
    if (sel && tool === 'select') drawSelection(sel);
  }

  function drawRoom(r) {
    const s = view.scale, ox = view.offX, oy = view.offY;
    ctx.save();
    ctx.beginPath();
    if (r.type === 'poly') {
      r.points.forEach((p, i) => {
        const x = ox + p.x * s, y = oy + p.y * s;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.closePath();
    } else {
      ctx.rect(ox + r.x * s, oy + r.y * s, r.w * s, r.h * s);
    }
    ctx.fillStyle = r.color;
    ctx.globalAlpha = 0.92;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.stroke();

    // label
    const b = roomBounds(r);
    const cx = ox + (b.x + b.w / 2) * s;
    const cy = oy + (b.y + b.h / 2) * s;
    ctx.fillStyle = pickTextColor(r.color);
    ctx.font = `600 ${clamp(13 * s, 10, 16)}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    wrapText(r.name || 'Room', cx, cy, b.w * s - 8, clamp(15 * s, 12, 18));
    ctx.restore();
  }

  function drawPolyDraft() {
    const s = view.scale, ox = view.offX, oy = view.offY;
    ctx.save();
    ctx.beginPath();
    polyPoints.forEach((p, i) => {
      const x = ox + p.x * s, y = oy + p.y * s;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    if (drag && drag.type === 'poly-cursor') {
      ctx.lineTo(ox + drag.cur.x * s, oy + drag.cur.y * s);
    }
    ctx.strokeStyle = '#5b8cff';
    ctx.lineWidth = 2;
    ctx.stroke();
    for (const p of polyPoints) {
      ctx.beginPath();
      ctx.arc(ox + p.x * s, oy + p.y * s, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    }
    ctx.restore();
  }

  function drawSelection(r) {
    const s = view.scale, ox = view.offX, oy = view.offY;
    const b = roomBounds(r);
    ctx.save();
    ctx.strokeStyle = '#5b8cff';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(ox + b.x * s, oy + b.y * s, b.w * s, b.h * s);
    ctx.setLineDash([]);
    if (r.type === 'rect') {
      for (const h of resizeHandles(r)) {
        const x = ox + h.x * s, y = oy + h.y * s;
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#5b8cff';
        ctx.fillRect(x - 4, y - 4, 8, 8);
        ctx.strokeRect(x - 4, y - 4, 8, 8);
      }
    }
    ctx.restore();
  }

  function wrapText(text, cx, cy, maxW, lineH) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
      else line = test;
    }
    if (line) lines.push(line);
    const startY = cy - ((lines.length - 1) * lineH) / 2;
    lines.forEach((ln, i) => ctx.fillText(ln, cx, startY + i * lineH));
  }

  function pickTextColor(hex) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substr(0, 2), 16);
    const g = parseInt(c.substr(2, 2), 16);
    const b = parseInt(c.substr(4, 2), 16);
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.6 ? 'rgba(20,25,35,0.9)' : 'rgba(255,255,255,0.95)';
  }

  // =====================================================================
  //  TOOLS
  // =====================================================================

  function setTool(t) {
    tool = t;
    cancelPoly();
    document.querySelectorAll('.tool[data-tool]').forEach((el) =>
      el.classList.toggle('active', el.dataset.tool === t));
    $('poly-hint').hidden = t !== 'poly';
    canvas.style.cursor = t === 'select' ? 'default' : 'crosshair';
    draw();
  }

  // =====================================================================
  //  POINTER INTERACTION
  // =====================================================================

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    const p = getPos(e);
    const w = toWorld(p.x, p.y);

    // pan with middle mouse or space-less right? use middle button
    if (e.button === 1) {
      drag = { type: 'pan', startX: p.x, startY: p.y, offX: view.offX, offY: view.offY };
      return;
    }

    if (tool === 'select') {
      const sel = selectedRoom();
      if (sel && sel.type === 'rect') {
        const h = handleAt(p.x, p.y, sel);
        if (h) {
          pushUndo();
          drag = { type: 'resize', handle: h.id, room: sel, orig: { ...roomBounds(sel) } };
          return;
        }
      }
      const hit = roomAt(w.x, w.y);
      if (hit) {
        selectRoom(hit.id);
        pushUndo();
        const b = roomBounds(hit);
        drag = { type: 'move', room: hit, dx: w.x - b.x, dy: w.y - b.y, moved: false };
      } else {
        selectRoom(null);
        drag = { type: 'pan', startX: p.x, startY: p.y, offX: view.offX, offY: view.offY };
      }
    } else if (tool === 'rect') {
      const sx = snap(w.x), sy = snap(w.y);
      pushUndo();
      drag = { type: 'draw-rect', x0: sx, y0: sy, x1: sx, y1: sy };
    } else if (tool === 'poly') {
      const sx = snap(w.x), sy = snap(w.y);
      if (!polyPoints) polyPoints = [];
      // finish if clicking near first point
      if (polyPoints.length >= 3) {
        const first = polyPoints[0];
        const ds = Math.hypot((sx - first.x) * view.scale, (sy - first.y) * view.scale);
        if (ds < 12) { finishPoly(); return; }
      }
      polyPoints.push({ x: sx, y: sy });
      drag = { type: 'poly-cursor', cur: { x: sx, y: sy } };
      draw();
    } else if (tool === 'erase') {
      const hit = roomAt(w.x, w.y);
      if (hit) { pushUndo(); deleteRoom(hit.id); }
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = getPos(e);
    const w = toWorld(p.x, p.y);

    if (!drag) {
      // hover cursor feedback for resize handles
      if (tool === 'select') {
        const sel = selectedRoom();
        if (sel && sel.type === 'rect') {
          const h = handleAt(p.x, p.y, sel);
          canvas.style.cursor = h ? handleCursor(h.id) : (roomAt(w.x, w.y) ? 'move' : 'default');
        }
      }
      return;
    }

    if (drag.type === 'pan') {
      view.offX = drag.offX + (p.x - drag.startX);
      view.offY = drag.offY + (p.y - drag.startY);
      draw();
    } else if (drag.type === 'draw-rect') {
      drag.x1 = snap(w.x); drag.y1 = snap(w.y);
      draw();
      // live preview
      drawRectPreview(drag);
    } else if (drag.type === 'move') {
      const nb = { x: snap(w.x - drag.dx), y: snap(w.y - drag.dy) };
      moveRoomTo(drag.room, nb.x, nb.y);
      drag.moved = true;
      draw();
    } else if (drag.type === 'resize') {
      applyResize(drag, snap(w.x), snap(w.y));
      draw();
    } else if (drag.type === 'poly-cursor') {
      drag.cur = { x: w.x, y: w.y };
      draw();
    }
  });

  canvas.addEventListener('pointerup', (e) => {
    if (!drag) return;
    if (drag.type === 'draw-rect') {
      const x = Math.min(drag.x0, drag.x1), y = Math.min(drag.y0, drag.y1);
      const wdt = Math.abs(drag.x1 - drag.x0), hgt = Math.abs(drag.y1 - drag.y0);
      if (wdt >= CELL && hgt >= CELL) {
        addRoom({ type: 'rect', x, y, w: wdt, h: hgt });
      } else {
        popUndo(); // nothing drawn
      }
    } else if (drag.type === 'move') {
      if (!drag.moved) popUndo();
      else { markDirty(); save(); }
    } else if (drag.type === 'resize') {
      markDirty(); save();
    }
    if (drag.type !== 'poly-cursor') drag = null;
    draw();
  });

  canvas.addEventListener('dblclick', () => { if (tool === 'poly') finishPoly(); });

  // wheel zoom
  canvasWrap.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = getPos(e);
    const before = toWorld(p.x, p.y);
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    view.scale = clamp(view.scale * factor, 0.02, 6);
    view.offX = p.x - before.x * view.scale;
    view.offY = p.y - before.y * view.scale;
    draw();
  }, { passive: false });

  function handleCursor(id) {
    return { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
      ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize' }[id] || 'default';
  }

  function drawRectPreview(d) {
    const s = view.scale, ox = view.offX, oy = view.offY;
    const x = Math.min(d.x0, d.x1), y = Math.min(d.y0, d.y1);
    const wdt = Math.abs(d.x1 - d.x0), hgt = Math.abs(d.y1 - d.y0);
    ctx.save();
    ctx.fillStyle = 'rgba(91,140,255,0.18)';
    ctx.strokeStyle = '#5b8cff';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.fillRect(ox + x * s, oy + y * s, wdt * s, hgt * s);
    ctx.strokeRect(ox + x * s, oy + y * s, wdt * s, hgt * s);
    ctx.restore();
  }

  function applyResize(d, mx, my) {
    const r = d.room, o = d.orig;
    let x = o.x, y = o.y, w = o.w, h = o.h;
    const H = d.handle;
    if (H.includes('w')) { const nx = Math.min(mx, o.x + o.w - CELL); w = o.x + o.w - nx; x = nx; }
    if (H.includes('e')) { w = Math.max(CELL, mx - o.x); }
    if (H.includes('n')) { const ny = Math.min(my, o.y + o.h - CELL); h = o.y + o.h - ny; y = ny; }
    if (H.includes('s')) { h = Math.max(CELL, my - o.y); }
    // keep inside lot
    x = clamp(x, 0, worldW() - CELL);
    y = clamp(y, 0, worldH() - CELL);
    w = clamp(w, CELL, worldW() - x);
    h = clamp(h, CELL, worldH() - y);
    Object.assign(r, { x, y, w, h });
    renderInspector();
  }

  function moveRoomTo(r, nx, ny) {
    const b = roomBounds(r);
    nx = clamp(nx, 0, worldW() - b.w);
    ny = clamp(ny, 0, worldH() - b.h);
    const dx = nx - b.x, dy = ny - b.y;
    if (r.type === 'poly') {
      r.points = r.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    } else {
      r.x = nx; r.y = ny;
    }
    renderInspector();
  }

  // =====================================================================
  //  POLYGON
  // =====================================================================

  function finishPoly() {
    if (!polyPoints || polyPoints.length < 3) { cancelPoly(); return; }
    pushUndo();
    addRoom({ type: 'poly', points: polyPoints.slice() });
    polyPoints = null;
    drag = null;
    draw();
  }
  function cancelPoly() {
    polyPoints = null;
    if (drag && drag.type === 'poly-cursor') drag = null;
    draw();
  }

  // =====================================================================
  //  ROOM CRUD
  // =====================================================================

  function nextColor() {
    const c = PALETTE[project.colorIndex % PALETTE.length];
    project.colorIndex++;
    return c;
  }

  function addRoom(shape) {
    const room = Object.assign({ id: uid(), name: '', color: nextColor() }, shape);
    room.name = `Room ${rooms().length + 1}`;
    rooms().push(room);
    selectRoom(room.id);
    setTool('select');
    renderRoomList();
    markDirty(); save();
    // focus name input for quick naming
    const ni = $('room-name');
    if (ni) { ni.focus(); ni.select(); }
  }

  function deleteRoom(id) {
    const i = rooms().findIndex((r) => r.id === id);
    if (i < 0) return;
    rooms().splice(i, 1);
    if (selectedId === id) selectRoom(null);
    renderRoomList();
    markDirty(); save(); draw();
  }

  function duplicateRoom(id) {
    const r = rooms().find((x) => x.id === id);
    if (!r) return;
    pushUndo();
    const copy = JSON.parse(JSON.stringify(r));
    copy.id = uid();
    copy.name = r.name + ' copy';
    copy.color = nextColor();
    moveRoomShift(copy, CELL, CELL);
    rooms().push(copy);
    selectRoom(copy.id);
    renderRoomList();
    markDirty(); save(); draw();
  }

  function moveRoomShift(r, dx, dy) {
    if (r.type === 'poly') r.points = r.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    else { r.x += dx; r.y += dy; }
  }

  function selectRoom(id) {
    selectedId = id;
    renderInspector();
    renderRoomList();
    draw();
  }

  // =====================================================================
  //  RIGHT PANEL RENDER
  // =====================================================================

  function renderFloors() {
    const list = $('floor-list');
    list.innerHTML = '';
    project.floors.forEach((f, idx) => {
      const li = document.createElement('li');
      li.className = 'floor-item' + (idx === project.activeFloor ? ' active' : '');
      const name = document.createElement('span');
      name.className = 'floor-name';
      name.textContent = f.name;
      li.appendChild(name);

      // room count
      const count = document.createElement('span');
      count.style.cssText = 'font-size:11px;color:var(--text-faint)';
      count.textContent = f.rooms.length;
      li.appendChild(count);

      if (project.floors.length > 1) {
        const del = document.createElement('button');
        del.className = 'floor-del';
        del.textContent = '✕';
        del.title = 'Delete floor';
        del.addEventListener('click', (e) => { e.stopPropagation(); deleteFloor(idx); });
        li.appendChild(del);
      }

      li.addEventListener('click', () => switchFloor(idx));
      name.addEventListener('dblclick', (e) => { e.stopPropagation(); renameFloor(li, name, idx); });
      list.appendChild(li);
    });
  }

  function renameFloor(li, nameEl, idx) {
    const input = document.createElement('input');
    input.className = 'rename-input';
    input.value = project.floors[idx].name;
    li.replaceChild(input, nameEl);
    input.focus(); input.select();
    const commit = () => {
      project.floors[idx].name = input.value.trim() || project.floors[idx].name;
      renderFloors(); markDirty(); save();
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') { input.value = project.floors[idx].name; input.blur(); }
    });
  }

  function switchFloor(idx) {
    if (idx === project.activeFloor) return;
    project.activeFloor = idx;
    selectRoom(null);
    cancelPoly();
    renderFloors();
    renderRoomList();
    draw();
    markDirty(); save();
  }

  function addFloor() {
    const n = project.floors.length + 1;
    project.floors.push({ id: uid(), name: `Floor ${n}`, rooms: [] });
    project.activeFloor = project.floors.length - 1;
    selectRoom(null);
    renderFloors(); renderRoomList(); draw();
    markDirty(); save();
  }

  function deleteFloor(idx) {
    if (project.floors.length <= 1) return;
    if (!confirm(`Delete "${project.floors[idx].name}" and its rooms?`)) return;
    project.floors.splice(idx, 1);
    project.activeFloor = clamp(project.activeFloor, 0, project.floors.length - 1);
    selectRoom(null);
    renderFloors(); renderRoomList(); draw();
    markDirty(); save();
  }

  function renderRoomList() {
    const list = $('room-list');
    list.innerHTML = '';
    if (!rooms().length) {
      const li = document.createElement('li');
      li.className = 'hint-text';
      li.textContent = 'No rooms yet on this floor.';
      list.appendChild(li);
      return;
    }
    rooms().forEach((r) => {
      const li = document.createElement('li');
      li.className = 'room-item' + (r.id === selectedId ? ' selected' : '');
      const sw = document.createElement('span');
      sw.className = 'room-swatch';
      sw.style.background = r.color;
      const label = document.createElement('span');
      label.className = 'room-name-label';
      label.textContent = r.name || 'Room';
      li.appendChild(sw); li.appendChild(label);
      li.addEventListener('click', () => { setTool('select'); selectRoom(r.id); });
      list.appendChild(li);
    });
  }

  function renderInspector() {
    const r = selectedRoom();
    $('no-selection').hidden = !!r;
    $('room-fields').hidden = !r;
    if (!r) return;
    $('room-name').value = r.name;
    $('room-color').value = r.color;
    renderSwatches(r.color);
    const b = roomBounds(r);
    const cw = Math.round(b.w / CELL), ch = Math.round(b.h / CELL);
    $('room-dims').textContent = r.type === 'poly'
      ? `Polygon · ${r.points.length} points · ${cw}×${ch} cells`
      : `${cw} × ${ch} cells`;
  }

  function renderSwatches(active) {
    const box = $('swatches');
    box.innerHTML = '';
    PALETTE.forEach((c) => {
      const sw = document.createElement('button');
      sw.className = 'swatch' + (c.toLowerCase() === (active || '').toLowerCase() ? ' active' : '');
      sw.style.background = c;
      sw.addEventListener('click', () => setRoomColor(c));
      box.appendChild(sw);
    });
  }

  function setRoomColor(c) {
    const r = selectedRoom(); if (!r) return;
    r.color = c;
    renderInspector(); renderRoomList(); draw();
    markDirty(); save();
  }

  // =====================================================================
  //  UNDO / REDO
  // =====================================================================

  function snapshot() {
    return JSON.stringify({ floors: project.floors, activeFloor: project.activeFloor, colorIndex: project.colorIndex });
  }
  function pushUndo() {
    undoStack.push(snapshot());
    if (undoStack.length > 60) undoStack.shift();
    redoStack = [];
    updateUndoButtons();
  }
  function popUndo() { undoStack.pop(); updateUndoButtons(); } // discard last (no-op action)

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    restore(undoStack.pop());
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    restore(redoStack.pop());
  }
  function restore(str) {
    const s = JSON.parse(str);
    project.floors = s.floors;
    project.activeFloor = clamp(s.activeFloor, 0, s.floors.length - 1);
    project.colorIndex = s.colorIndex ?? project.colorIndex;
    selectedId = null;
    renderFloors(); renderRoomList(); renderInspector(); draw();
    updateUndoButtons(); markDirty(); save();
  }
  function updateUndoButtons() {
    $('undo-btn').disabled = !undoStack.length;
    $('redo-btn').disabled = !redoStack.length;
  }

  // =====================================================================
  //  PERSISTENCE
  // =====================================================================

  let dirtyTimer = null;
  function markDirty() {
    const el = $('save-status');
    el.textContent = 'Saving…';
    el.classList.add('dirty');
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
      clearTimeout(dirtyTimer);
      dirtyTimer = setTimeout(() => {
        const el = $('save-status');
        el.textContent = 'Saved';
        el.classList.remove('dirty');
      }, 250);
    } catch (e) { /* storage may be full/blocked */ }
  }

  function loadSaved() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    try {
      project = JSON.parse(raw);
      if (!project.floors || !project.lot) return false;
      project.activeFloor = clamp(project.activeFloor || 0, 0, project.floors.length - 1);
      project.colorIndex = project.colorIndex || 0;
      selectedId = null;
      undoStack = []; redoStack = [];
      enterEditor();
      return true;
    } catch { return false; }
  }

  // =====================================================================
  //  IMPORT / EXPORT
  // =====================================================================

  function exportJSON() {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `${(project.name || 'layout').replace(/\s+/g, '-').toLowerCase()}.json`);
  }

  function importJSON(file, thenEnter) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const p = JSON.parse(reader.result);
        if (!p.floors || !p.lot) throw new Error('bad');
        project = p;
        project.activeFloor = clamp(project.activeFloor || 0, 0, project.floors.length - 1);
        project.colorIndex = project.colorIndex || 0;
        selectedId = null; undoStack = []; redoStack = [];
        if (thenEnter) enterEditor(); else {
          $('project-name').value = project.name;
          $('lot-badge').textContent = `${project.lot.name} · ${project.lot.cols}×${project.lot.rows}`;
          zoomToFit(); renderFloors(); renderRoomList(); renderInspector();
        }
        save();
      } catch {
        alert('That file is not a valid Layout Maker layout.');
      }
    };
    reader.readAsText(file);
  }

  function exportPNG() {
    // render current floor to an offscreen canvas at nice resolution.
    // Cap the output so huge lots (golf course / town scale) stay within the
    // browser's max canvas dimensions instead of failing to export.
    const pad = 40;
    const MAX_SIDE = 8000;
    const fullW = worldW() + pad * 2, fullH = worldH() + pad * 2;
    const scale = Math.min(2, MAX_SIDE / fullW, MAX_SIDE / fullH);
    const oc = document.createElement('canvas');
    oc.width = (worldW() + pad * 2) * scale;
    oc.height = (worldH() + pad * 2) * scale;
    const g = oc.getContext('2d');
    g.scale(scale, scale);
    g.fillStyle = '#12151c';
    g.fillRect(0, 0, oc.width, oc.height);
    g.translate(pad, pad);

    // lot bg + grid
    g.fillStyle = '#0f1420';
    g.fillRect(0, 0, worldW(), worldH());
    g.strokeStyle = 'rgba(255,255,255,0.05)';
    g.lineWidth = 1;
    g.beginPath();
    for (let c = 0; c <= project.lot.cols; c++) { g.moveTo(c * CELL, 0); g.lineTo(c * CELL, worldH()); }
    for (let r = 0; r <= project.lot.rows; r++) { g.moveTo(0, r * CELL); g.lineTo(worldW(), r * CELL); }
    g.stroke();

    for (const r of rooms()) {
      g.beginPath();
      if (r.type === 'poly') {
        r.points.forEach((p, i) => i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y));
        g.closePath();
      } else g.rect(r.x, r.y, r.w, r.h);
      g.fillStyle = r.color; g.fill();
      g.lineWidth = 2; g.strokeStyle = 'rgba(0,0,0,0.35)'; g.stroke();
      const b = roomBounds(r);
      g.fillStyle = pickTextColor(r.color);
      g.font = '600 13px "Segoe UI", system-ui, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      // simple centered label (no wrap in export for brevity)
      g.fillText(r.name || 'Room', b.x + b.w / 2, b.y + b.h / 2);
    }

    // title
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.font = '600 14px "Segoe UI", system-ui, sans-serif';
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillText(`${project.name} — ${activeFloor().name}`, 2, -14);

    oc.toBlob((blob) => {
      downloadBlob(blob, `${(project.name || 'layout')}-${activeFloor().name}.png`.replace(/\s+/g, '-').toLowerCase());
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // =====================================================================
  //  EVENT WIRING
  // =====================================================================

  function wireEvents() {
    // tools
    document.querySelectorAll('.tool[data-tool]').forEach((el) =>
      el.addEventListener('click', () => setTool(el.dataset.tool)));

    $('undo-btn').addEventListener('click', undo);
    $('redo-btn').addEventListener('click', redo);
    $('zoom-in-btn').addEventListener('click', () => zoomBy(1.2));
    $('zoom-out-btn').addEventListener('click', () => zoomBy(1 / 1.2));
    $('zoom-fit-btn').addEventListener('click', zoomToFit);

    $('home-btn').addEventListener('click', goHome);
    $('add-floor-btn').addEventListener('click', addFloor);

    $('project-name').addEventListener('input', (e) => {
      project.name = e.target.value || 'Untitled Layout';
      markDirty(); save();
    });

    $('room-name').addEventListener('input', (e) => {
      const r = selectedRoom(); if (!r) return;
      r.name = e.target.value;
      renderRoomList(); draw(); markDirty(); save();
    });
    $('room-color').addEventListener('input', (e) => setRoomColor(e.target.value));
    $('delete-room-btn').addEventListener('click', () => {
      if (selectedId) { pushUndo(); deleteRoom(selectedId); }
    });
    $('duplicate-room-btn').addEventListener('click', () => selectedId && duplicateRoom(selectedId));

    $('export-json-btn').addEventListener('click', exportJSON);
    $('export-png-btn').addEventListener('click', exportPNG);
    $('import-file').addEventListener('change', (e) => {
      if (e.target.files[0]) importJSON(e.target.files[0], false);
      e.target.value = '';
    });
    $('import-file-start').addEventListener('change', (e) => {
      if (e.target.files[0]) importJSON(e.target.files[0], true);
      e.target.value = '';
    });
    $('load-saved-btn').addEventListener('click', () => loadSaved());

    window.addEventListener('resize', resizeCanvas);

    // keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (editorScreen.hidden) return;
      const typing = /INPUT|TEXTAREA/.test(document.activeElement.tagName);
      if (typing) {
        if (e.key === 'Escape') document.activeElement.blur();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
      switch (e.key.toLowerCase()) {
        case 'v': setTool('select'); break;
        case 'r': setTool('rect'); break;
        case 'p': setTool('poly'); break;
        case 'e': setTool('erase'); break;
        case 'delete': case 'backspace':
          if (selectedId) { pushUndo(); deleteRoom(selectedId); } break;
        case 'escape': cancelPoly(); selectRoom(null); break;
        case 'enter': if (tool === 'poly') finishPoly(); break;
      }
    });
  }

  // =====================================================================
  //  BOOT
  // =====================================================================

  function init() {
    buildSizeGrid();
    wireEvents();
    refreshResumeButton();
  }

  init();
})();
