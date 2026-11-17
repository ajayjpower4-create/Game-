/* The interior editor.
 *
 * Open a building and its roof comes off: set the ceiling and the finishes,
 * draw partitions wall by wall or a room at a time, lay patches of other
 * flooring, hang doors (they cut their own doorways), and furnish from the
 * shelves — then walk through it at eye level.
 *
 * The editor owns its own pointer, key and panel handling while it is open;
 * game.js hands those over and gets them back on Done. */

import {
  WALL_TYPES, WALL_BY_ID, WALL_PAINTS, ITEM_TABS, ITEMS, ITEM_BY_ID, WALL_T,
  ensureInterior, levelOf, roomOf, wallHeight, makeItem, itemSize, nearWall, perimeter,
} from './interiorlist.js';
import { InteriorView, wallRuns, FLOOR_UP } from './engine/interior.js';
import './engine/furniture.js';
import './engine/furniture-work.js';
import './engine/furniture-home.js';
import { FLOORS, CEILINGS } from './engine/materials.js';
import { POSE_NAMES } from './engine/figures.js';
import { newId } from './catalog.js';
import { footprint } from './site.js';
import { toLocal as planLocal, clamp, DEG } from './geom.js';

const GRID = 0.5;
const snap = (v, g = GRID) => Math.round(v / g) * g;
const HEIGHTS = [[0, 'To the ceiling'], [8, '8 ft'], [7, '7 ft'], [5.4, '5½ ft'], [3.5, '3½ ft']];

export function createInteriorEditor(ctx) {
  const { ui, esc, fmt } = ctx;
  let view = null;
  let drag = null;       // { mode, ... } while the pointer is down on something
  let press = null;
  let ghostRot = 0;
  let blockers = null;   // partitions as solid floor-level runs, for walking

  const I = () => ui.interior;
  const B = () => (I() ? ctx.byId(I().id) : null);
  const L = () => levelOf(B(), I().level);
  const room = () => roomOf(B());

  /* ----------------------------------------------------------- open, close */

  function open(b, level = 0) {
    if (!b || b.kind !== 'building') return;
    ensureInterior(b);
    if (!view) view = new InteriorView(ctx.engine(), ctx.world());
    ui.interior = { id: b.id, level: clamp(level, 0, Math.max(1, b.floors || 1) - 1), tab: 'room', cat: 'office', tool: null, sel: null, view: 'cut', wallType: 'drywall', wallH: 0, wallColor: null, areaFinish: 'ceramic', areaColor: null };
    ui.pending = null;
    ui.tab = 'edit';
    ui.selected = b.id;
    const E = ctx.engine();
    E.setSelection([]);
    if (E.mode !== 'orbit') ctx.setCam('orbit');
    view.open(b, I().level);
    view.setView('cut', false);
    blockers = null;
    frame(900);
    ctx.drawPanel();
    ctx.drawHud();
    ctx.flashHint('Interior open: draw walls, lay floors and furnish. Done when you are finished.');
  }

  /** Bring the orbit camera round to look down into the storey. */
  function frame(ms = 700) {
    const b = B();
    if (!b) return;
    const fp = footprint(b);
    const r = room();
    ctx.engine().flyTo({ x: fp.x + fp.w / 2, y: I().level * r.fh, z: fp.y + fp.d / 2, dist: Math.max(b.w, b.d) * 1.05 + 30, pitch: 52 * DEG, ms });
  }

  function close() {
    if (!I()) return;
    const E = ctx.engine();
    stopWalk(false);
    if (view) view.close();
    ui.interior = null;
    drag = null;
    E.controls.enabled = true;
    ctx.save();
    ctx.syncWorld();
    ctx.drawPanel();
    ctx.drawHud();
  }

  /** After anything changes the data: redraw the model, keep the selection honest. */
  function refresh({ panel = true } = {}) {
    const b = B();
    if (!b) { if (I()) { if (view) view.close(); ui.interior = null; ctx.drawPanel(); } return; }
    I().level = clamp(I().level, 0, Math.max(1, b.floors || 1) - 1);
    blockers = null;
    view.sync(b, I().level);
    const s = I().sel;
    if (s) {
      const lv = L();
      const there = s.kind === 'item' ? lv.items.some((i) => i.id === s.id) : s.kind === 'wall' ? lv.walls.some((w) => w.id === s.id) : lv.areas.some((a) => a.id === s.id);
      if (!there) I().sel = null;
    }
    view.select(I().sel, L());
    if (panel) ctx.drawPanel();
  }

  function commit(opts) {
    ctx.queueSave();
    refresh(opts);
  }

  /* ---------------------------------------------------------------- walking */

  function startWalk() {
    const b = B();
    if (!b) return;
    const E = ctx.engine();
    const r = room();
    setTool(null);
    I().sel = null;
    view.select(null);
    E.walkBase = I().level * r.fh + FLOOR_UP;
    E.blocked = blocked;
    E.setIndoor(1);
    view.setView(I().view, true);
    ctx.setCam('walk');
    // Stand just inside the front door if there is one, else in the middle.
    const row = (b.walls.N || [[]])[0] || [];
    const col = row.indexOf('door');
    let lx = col >= 0 ? ((col + 0.5) * b.w) / row.length : b.w / 2;
    let ly = col >= 0 && I().level === 0 ? b.d - 6 : b.d / 2;
    for (let k = 0; k < 40 && blockedLocal(lx, ly); k++) { lx = clamp(lx + (k % 2 ? 2 : -3) * (1 + k / 6), 2, b.w - 2); ly = clamp(ly - 1.5, 2, b.d - 2); }
    const p = view.toWorld(lx, ly, 0);
    E.camera.position.set(p.x, E.walkBase + 5.6, p.z);
    E.look.yaw = -(b.rot || 0) * DEG;         // facing into the building, away from its front
    E.look.pitch = -0.04;
    E.applyLook();
    E.moved = true;
    ctx.drawPanel();
    ctx.flashHint('Walking inside: W A S D to move, drag to look, Esc to come back out.');
  }

  function stopWalk(redraw = true) {
    const E = ctx.engine();
    if (!E.indoor && E.blocked !== blocked) return;
    E.walkBase = 0;
    E.blocked = ctx.walkBlocked;
    E.setIndoor(0);
    if (view && view.active) view.setView(I() ? I().view : 'cut', false);
    if (redraw && I()) { frame(500); ctx.drawPanel(); }
  }

  /** game.js tells us when the camera mode changes while the interior is open. */
  function camChanged(mode) {
    if (!I()) return;
    if (mode === 'orbit') stopWalk();
    else if (!ctx.engine().indoor) {
      // Walk or drone chosen from the camera buttons: go inside.
      const E = ctx.engine();
      E.walkBase = I().level * room().fh + FLOOR_UP;
      E.blocked = blocked;
      E.setIndoor(1);
      view.setView(I().view, true);
      if (mode === 'walk') startWalk();
    }
  }

  function blockedLocal(x, y) {
    const b = B();
    const m = WALL_T + 0.9;
    if (x < m || y < m || x > b.w - m || y > b.d - m) return true;
    if (!blockers) {
      blockers = [];
      const r = room();
      const lv = L();
      for (const w of lv.walls) {
        const t = (WALL_BY_ID[w.type] || { t: 0.4 }).t;
        const H = wallHeight(w, r);
        const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]) || 1;
        const ux = (w.b[0] - w.a[0]) / len;
        const uy = (w.b[1] - w.a[1]) / len;
        for (const [s0, s1, h0] of wallRuns(w, lv.items, H, t)) {
          if (h0 > 0.05) continue;
          blockers.push({ a: [w.a[0] + ux * s0, w.a[1] + uy * s0], b: [w.a[0] + ux * s1, w.a[1] + uy * s1], r: t / 2 + 0.75 });
        }
      }
      for (const it of lv.items) {
        const spec = ITEM_BY_ID[it.type] || {};
        if (spec.ceil || spec.flat || spec.cut || spec.top || spec.person || spec.wall) continue;
        const s = itemSize(it);
        if (s.h < 1.2 || s.w * s.d < 1.5) continue;
        blockers.push({ box: it, w: s.w, d: s.d });
      }
    }
    for (const k of blockers) {
      if (k.box) {
        const a = (k.box.rot || 0) * DEG;
        const dx = x - k.box.x;
        const dy = y - k.box.y;
        const u = dx * Math.cos(a) + dy * Math.sin(a);
        const v = -dx * Math.sin(a) + dy * Math.cos(a);
        if (Math.abs(u) < k.w / 2 + 0.55 && Math.abs(v) < k.d / 2 + 0.55) return true;
      } else if (nearWall(k, x, y).dist < k.r) return true;
    }
    return false;
  }

  function blocked(wx, wz) {
    const b = B();
    if (!b) return false;
    const [lx, ly] = planLocal(footprint(b), wx, wz);
    return blockedLocal(lx + b.w / 2, ly + b.d / 2);
  }

  /* ------------------------------------------------------------------ tools */

  function setTool(tool) {
    if (!I()) return;
    I().tool = tool;
    drag = null;
    if (view) { view.setGhost(null); view.setGuide(null); }
    ctx.engine().controls.enabled = true;
  }

  /** Where the pointer is on the floor, snapped and kept inside the walls. */
  function floorPoint(ev, { free = false, margin = WALL_T } = {}) {
    const b = B();
    const p = view.floorAt(ev);
    if (!p) return null;
    const g = free || ev.altKey ? 0.05 : GRID;
    return { x: clamp(snap(p.x, g), margin, b.w - margin), y: clamp(snap(p.y, g), margin, b.d - margin), raw: p };
  }

  /** Corners worth snapping a new wall to: ends of walls, and the room's own corners. */
  function snapCorner(p, skipId = null) {
    const b = B();
    let best = null;
    const tryPt = (x, y) => { const d = Math.hypot(p.x - x, p.y - y); if (d < 0.9 && (!best || d < best.d)) best = { x, y, d }; };
    for (const w of L().walls) { if (w.id === skipId) continue; tryPt(w.a[0], w.a[1]); tryPt(w.b[0], w.b[1]); }
    for (const [x, y] of [[WALL_T, WALL_T], [b.w - WALL_T, WALL_T], [b.w - WALL_T, b.d - WALL_T], [WALL_T, b.d - WALL_T]]) tryPt(x, y);
    // And onto the face of the outside walls.
    if (!best) {
      if (Math.abs(p.x - WALL_T) < 0.7) return { x: WALL_T, y: p.y };
      if (Math.abs(p.x - (b.w - WALL_T)) < 0.7) return { x: b.w - WALL_T, y: p.y };
      if (Math.abs(p.y - WALL_T) < 0.7) return { x: p.x, y: WALL_T };
      if (Math.abs(p.y - (b.d - WALL_T)) < 0.7) return { x: p.x, y: b.d - WALL_T };
    }
    return best ? { x: best.x, y: best.y } : p;
  }

  /** Hold a new wall point square (or at 45°) to the one before it. */
  function squared(prev, p, freeAngle) {
    if (!prev || freeAngle) return p;
    const dx = p.x - prev[0];
    const dy = p.y - prev[1];
    const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    const len = Math.hypot(dx, dy);
    const diag = Math.abs(Math.round(ang / (Math.PI / 4))) % 2 === 1;
    const reach = diag ? len : Math.abs(Math.abs(Math.cos(ang)) > 0.5 ? dx : dy);
    return { x: snap(prev[0] + Math.cos(ang) * reach, 0.25), y: snap(prev[1] + Math.sin(ang) * reach, 0.25) };
  }

  /** Put an item where it belongs: doors into walls, wall things against walls, table things on tables. */
  function settle(it, p, { keepRot = false } = {}) {
    const b = B();
    const spec = ITEM_BY_ID[it.type] || {};
    const s = itemSize(it);
    it.x = p.x;
    it.y = p.y;
    const raw = p.raw || p;
    if (spec.cut) {
      // Into the nearest partition, lying along it.
      let best = null;
      for (const w of L().walls) {
        const n = nearWall(w, raw.x, raw.y);
        if (n.dist < 3 && (!best || n.dist < best.n.dist)) best = { w, n };
      }
      if (best) {
        const half = Math.min(s.w / 2, best.n.len / 2);
        const t = clamp(snap(best.n.t * best.n.len, ev0.alt ? 0.05 : 0.25), half, best.n.len - half);
        it.x = best.w.a[0] + best.n.ux * t;
        it.y = best.w.a[1] + best.n.uy * t;
        let rot = Math.atan2(best.n.uy, best.n.ux) / DEG;
        // Keep whichever way round the door already faced.
        const cur = ((it.rot || 0) % 360 + 360) % 360;
        const alt = ((rot + 180) % 360 + 360) % 360;
        rot = ((rot % 360) + 360) % 360;
        it.rot = Math.abs(((cur - alt + 540) % 360) - 180) < Math.abs(((cur - rot + 540) % 360) - 180) ? alt : rot;
        return true;
      }
      return false;
    }
    if (spec.wall) {
      // Back against the nearest wall, facing the room.
      let best = null;
      for (const w of [...perimeter(b), ...L().walls]) {
        const n = nearWall(w, raw.x, raw.y);
        if (n.dist < 3.2 && (!best || n.dist < best.n.dist)) best = { w, n };
      }
      if (best) {
        const { w, n } = best;
        const t = w.outer ? 0 : (WALL_BY_ID[w.type] || { t: 0.4 }).t / 2;
        // Which side of the wall the pointer is on.
        const side = (raw.x - n.px) * -n.uy + (raw.y - n.py) * n.ux >= 0 ? 1 : -1;
        const nx = -n.uy * side;
        const ny = n.ux * side;
        const half = Math.min(s.w / 2, n.len / 2);
        const along = clamp(snap(n.t * n.len, ev0.alt ? 0.05 : 0.25), half, n.len - half);
        it.x = w.a[0] + n.ux * along + nx * (t + 0.02);
        it.y = w.a[1] + n.uy * along + ny * (t + 0.02);
        it.rot = -Math.atan2(nx, ny) / DEG;
        return true;
      }
      return !!spec.free;
    }
    if (spec.top) {
      // Onto whatever surface is under it.
      let lift = 0;
      for (const o of L().items) {
        if (o.id === it.id) continue;
        const os = ITEM_BY_ID[o.type] || {};
        if (!os.surface) continue;
        const sz = itemSize(o);
        const a = (o.rot || 0) * DEG;
        const dx = it.x - o.x;
        const dy = it.y - o.y;
        const u = dx * Math.cos(a) + dy * Math.sin(a);
        const v = -dx * Math.sin(a) + dy * Math.cos(a);
        if (Math.abs(u) <= sz.w / 2 && Math.abs(v) <= sz.d / 2) lift = Math.max(lift, os.surface + (o.lift || 0));
      }
      it.lift = lift;
    }
    if (!keepRot && it.rot == null) it.rot = 0;
    return true;
  }
  const ev0 = { alt: false };

  /* ---------------------------------------------------------------- pointer */

  function down(ev) {
    const E = ctx.engine();
    if (!I() || E.mode !== 'orbit') return;
    press = { x: ev.clientX, y: ev.clientY, button: ev.button };
    E.controls.enabled = true;
    if (ev.button !== 0) return;
    ev0.alt = ev.altKey;
    const tool = I().tool;
    if (tool) {
      if (tool.kind === 'area' || tool.kind === 'room') {
        const p = floorPoint(ev);
        if (!p) return;
        const q = tool.kind === 'room' ? snapCorner(p) : p;
        E.controls.enabled = false;
        drag = { mode: tool.kind, a: [q.x, q.y], b: [q.x, q.y] };
      }
      return;
    }
    const hi = view.pickItem(ev);
    const hw = view.pickWall(ev, L());
    if (hi && (!hw || hi.distance <= hw.distance + 0.3)) {
      const it = L().items.find((i) => i.id === hi.id);
      if (!it) return;
      E.controls.enabled = false;
      const changed = !I().sel || I().sel.id !== it.id;
      I().sel = { kind: 'item', id: it.id };
      const p = view.floorAt(ev);
      drag = { mode: 'item', id: it.id, grab: p ? { dx: it.x - p.x, dy: it.y - p.y } : { dx: 0, dy: 0 }, moved: false };
      view.select(I().sel, L());
      if (changed) ctx.drawPanel();
      return;
    }
    if (hw) {
      const changed = !I().sel || I().sel.id !== hw.wall.id;
      I().sel = { kind: 'wall', id: hw.wall.id };
      view.select(I().sel, L());
      if (changed) ctx.drawPanel();
      drag = { mode: 'wallpick' };
    }
  }

  function move(ev) {
    const E = ctx.engine();
    if (!I() || E.mode !== 'orbit') return;
    ev0.alt = ev.altKey;
    const tool = I().tool;
    if (tool && tool.kind === 'item') {
      const p = floorPoint(ev, { margin: 0.2 });
      if (!p) return view.setGhost(null);
      const it = { ...tool.item, rot: tool.item.rot ?? ghostRot };
      const ok = settle(it, p);
      tool.at = it;
      tool.ok = ok;
      view.setGhost(it, ok);
      return;
    }
    if (tool && tool.kind === 'wall') {
      let p = floorPoint(ev);
      if (!p) return;
      const prev = tool.pts[tool.pts.length - 1];
      p = snapCorner(squared(prev, p, ev.shiftKey));
      tool.cursor = [p.x, p.y];
      view.setGuide(prev ? [prev, tool.cursor] : [[p.x - 0.4, p.y], [p.x + 0.4, p.y]], { h: 0.4 });
      if (prev) ctx.hint(`${(Math.hypot(p.x - prev[0], p.y - prev[1])).toFixed(1)} ft · click to set the corner, double-click or Enter to finish`);
      return;
    }
    if (drag && (drag.mode === 'area' || drag.mode === 'room')) {
      const p = floorPoint(ev);
      if (!p) return;
      const q = drag.mode === 'room' ? snapCorner(p) : p;
      drag.b = [q.x, q.y];
      const [x0, y0] = drag.a;
      const [x1, y1] = drag.b;
      view.setGuide([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], { closed: true, h: drag.mode === 'room' ? 0.4 : 0.12, color: drag.mode === 'room' ? 0x46b4ff : 0x5fd08a });
      ctx.hint(`${Math.abs(x1 - x0).toFixed(1)} × ${Math.abs(y1 - y0).toFixed(1)} ft`);
      return;
    }
    if (drag && drag.mode === 'item') {
      if (!drag.moved && press && Math.hypot(ev.clientX - press.x, ev.clientY - press.y) < 5) return;
      const it = L().items.find((i) => i.id === drag.id);
      const raw = view.floorAt(ev);
      if (!it || !raw) return;
      if (!drag.moved) { ctx.snapshot(); drag.moved = true; }
      const b = B();
      const g = ev.altKey ? 0.05 : 0.25;
      const p = { x: clamp(snap(raw.x + drag.grab.dx, g), 0.2, b.w - 0.2), y: clamp(snap(raw.y + drag.grab.dy, g), 0.2, b.d - 0.2), raw };
      settle(it, p, { keepRot: true });
      view.moveItem(it);
      view.select(I().sel, L());
    }
  }

  function up(ev) {
    const E = ctx.engine();
    if (!I()) return;
    const wasClick = press && Math.hypot(ev.clientX - press.x, ev.clientY - press.y) < 5 && press.button === 0;
    E.controls.enabled = true;
    const tool = I().tool;
    const d = drag;
    drag = null;
    press = null;
    if (E.mode !== 'orbit') return;
    if (d && (d.mode === 'area' || d.mode === 'room')) {
      view.setGuide(null);
      const x0 = Math.min(d.a[0], d.b[0]);
      const y0 = Math.min(d.a[1], d.b[1]);
      const w = Math.abs(d.b[0] - d.a[0]);
      const dd = Math.abs(d.b[1] - d.a[1]);
      if (w < 1.5 || dd < 1.5) return;
      ctx.snapshot();
      if (d.mode === 'area') {
        const a = { id: newId('a'), x: x0, y: y0, w, d: dd, finish: I().areaFinish, color: I().areaColor || null };
        L().areas.push(a);
        I().sel = { kind: 'area', id: a.id };
      } else {
        // Four walls — less any side that already lies on an outside wall.
        const b = B();
        const pts = [[x0, y0], [x0 + w, y0], [x0 + w, y0 + dd], [x0, y0 + dd]];
        const edge = (p, q) => (p[0] === q[0] && (Math.abs(p[0] - WALL_T) < 0.05 || Math.abs(p[0] - (b.w - WALL_T)) < 0.05)) || (p[1] === q[1] && (Math.abs(p[1] - WALL_T) < 0.05 || Math.abs(p[1] - (b.d - WALL_T)) < 0.05));
        for (let i = 0; i < 4; i++) {
          const p = pts[i];
          const q = pts[(i + 1) % 4];
          if (!edge(p, q)) L().walls.push(newWall(p, q));
        }
      }
      return commit();
    }
    if (d && d.mode === 'item') {
      if (d.moved) commit({ panel: false });
      return;
    }
    if (!wasClick) return;
    if (tool && tool.kind === 'item') {
      if (!tool.at || !tool.ok) return ctx.flashHint(ITEM_BY_ID[tool.item.type].cut ? 'A door goes in a partition wall — draw one first, then drop the door on it.' : 'That hangs on a wall — bring it up to one.');
      ctx.snapshot();
      const spec = ITEM_BY_ID[tool.item.type];
      const it = { ...tool.at, id: newId('i') };
      if (spec.seeded) it.seed = 1 + Math.floor(Math.random() * 99999);
      L().items.push(it);
      // Stay armed: the next one differs if it is a person.
      if (spec.seeded) tool.item = { ...tool.item, seed: 1 + Math.floor(Math.random() * 99999) };
      commit({ panel: false });
      return;
    }
    if (tool && tool.kind === 'wall') {
      if (!tool.cursor) return;
      const p = tool.cursor;
      const prev = tool.pts[tool.pts.length - 1];
      if (prev && Math.hypot(p[0] - prev[0], p[1] - prev[1]) > 0.4) {
        ctx.snapshot();
        L().walls.push(newWall(prev, p));
        commit({ panel: false });
      }
      tool.pts.push([p[0], p[1]]);
      return;
    }
    // A click on nothing: a patch of flooring, or deselect.
    if (!d) {
      const p = view.floorAt(ev);
      const a = p && I().tab === 'build' ? [...L().areas].reverse().find((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.d) : null;
      const next = a ? { kind: 'area', id: a.id } : null;
      if (JSON.stringify(next) !== JSON.stringify(I().sel)) {
        I().sel = next;
        view.select(next, L());
        ctx.drawPanel();
      }
    }
  }

  function dbl() {
    if (!I()) return false;
    const tool = I().tool;
    if (tool && tool.kind === 'wall') { tool.pts = []; view.setGuide(null); ctx.hint(''); return true; }
    return true;
  }

  const newWall = (a, b) => ({ id: newId('w'), a: [a[0], a[1]], b: [b[0], b[1]], type: I().wallType, ...(I().wallH ? { h: I().wallH } : {}), ...(I().wallColor ? { color: I().wallColor } : {}) });

  /* ------------------------------------------------------------------- keys */

  function key(ev) {
    if (!I()) return false;
    const E = ctx.engine();
    const k = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
    if (ev.ctrlKey || ev.metaKey) {
      if (k === 'd') { ev.preventDefault(); if (I().sel && I().sel.kind === 'item') action({ dataset: { act: 'in-dup' } }); return true; }
      return false;
    }
    if (k === 'Escape') {
      if (E.mode !== 'orbit') { if (!document.pointerLockElement) ctx.setCam('orbit'); return true; }
      if (I().tool) { setTool(null); ctx.hint(''); ctx.drawPanel(); return true; }
      if (I().sel) { I().sel = null; view.select(null); ctx.drawPanel(); return true; }
      close();
      return true;
    }
    if (E.mode !== 'orbit') return false;
    const tool = I().tool;
    if (k === 'Enter' && tool && tool.kind === 'wall') { tool.pts = []; view.setGuide(null); ctx.hint(''); return true; }
    if (k === 'r') {
      const step = ev.shiftKey ? 15 : 90;
      if (tool && tool.kind === 'item') { ghostRot = (ghostRot + step) % 360; tool.item.rot = ghostRot; if (tool.at) { tool.at.rot = ghostRot; view.setGhost(tool.at, tool.ok); } return true; }
      const s = I().sel;
      if (s && s.kind === 'item') { const it = L().items.find((i) => i.id === s.id); if (it) { ctx.snapshot(); it.rot = ((it.rot || 0) + step) % 360; commit({ panel: false }); } return true; }
      return true;
    }
    if (k === 'Delete' || k === 'Backspace') {
      if (I().sel) { ev.preventDefault(); action({ dataset: { act: 'in-delete' } }); }
      return true;
    }
    if (k.startsWith('Arrow')) {
      const it = I().sel && I().sel.kind === 'item' ? L().items.find((i) => i.id === I().sel.id) : null;
      if (!it) return true;
      ev.preventDefault();
      ctx.snapshot();
      const st = ev.shiftKey ? 1 : 0.25;
      if (k === 'ArrowLeft') it.x -= st;
      if (k === 'ArrowRight') it.x += st;
      if (k === 'ArrowUp') it.y -= st;
      if (k === 'ArrowDown') it.y += st;
      commit({ panel: false });
      return true;
    }
    return false;
  }

  /* ---------------------------------------------------------------- actions */

  function action(el) {
    if (!I()) return;
    const { act, key: k, value } = el.dataset;
    const b = B();
    const it = ensureInterior(b);
    const sel = I().sel;
    const selItem = sel && sel.kind === 'item' ? L().items.find((i) => i.id === sel.id) : null;
    const selWall = sel && sel.kind === 'wall' ? L().walls.find((w) => w.id === sel.id) : null;
    const selArea = sel && sel.kind === 'area' ? L().areas.find((a) => a.id === sel.id) : null;
    switch (act) {
      case 'in-exit': return close();
      case 'in-walk': return startWalk();
      case 'in-frame': return frame();
      case 'in-tab': I().tab = value; setTool(null); return ctx.drawPanel();
      case 'in-cat': I().cat = value; return ctx.drawPanel();
      case 'in-view': I().view = value; view.setView(value, false); return ctx.drawPanel();
      case 'in-level': I().level = clamp(+value, 0, Math.max(1, b.floors || 1) - 1); I().sel = null; setTool(null); refresh(); return frame(500);
      case 'in-room': {
        // A finish or setting of the whole interior.
        ctx.snapshot();
        if (value === '') delete it[k]; else it[k] = k === 'autoLights' ? value === '1' : value;
        if (k === 'floor') delete it.floorColor;
        if (k === 'ceilingType') delete it.ceiling;
        return commit();
      }
      case 'in-arm': {
        const spec = ITEM_BY_ID[k];
        if (!spec) return;
        const on = I().tool && I().tool.kind === 'item' && I().tool.item.type === k;
        if (on) { setTool(null); ctx.hint(''); return ctx.drawPanel(); }
        ghostRot = 0;
        setTool({ kind: 'item', item: { type: k, rot: 0, ...(spec.seeded ? { seed: 1 + Math.floor(Math.random() * 99999) } : {}), ...(spec.text ? { text: spec.text } : {}) } });
        I().sel = null;
        view.select(null);
        ctx.hint(`${spec.name}: click to place, R turns it, Esc when you are done`);
        return ctx.drawPanel();
      }
      case 'in-tool': {
        const on = I().tool && I().tool.kind === value;
        setTool(on ? null : value === 'wall' ? { kind: 'wall', pts: [] } : { kind: value });
        I().sel = null;
        view.select(null);
        ctx.hint(on ? '' : value === 'wall' ? 'Click where the wall starts, then each corner. Double-click or Enter ends it; Shift frees the angle.' : value === 'room' ? 'Drag out a room: its walls go up when you let go.' : 'Drag out the patch of floor to lay.');
        return ctx.drawPanel();
      }
      case 'in-wall': {
        // Sets the brush, and the selected wall if there is one.
        if (k === 'type') { I().wallType = value; I().wallColor = null; }
        if (k === 'h') I().wallH = +value;
        if (k === 'color') I().wallColor = value || null;
        if (selWall) {
          ctx.snapshot();
          if (k === 'type') { selWall.type = value; delete selWall.color; }
          if (k === 'h') { if (+value) selWall.h = +value; else delete selWall.h; }
          if (k === 'color') { if (value) selWall.color = value; else delete selWall.color; }
          return commit();
        }
        return ctx.drawPanel();
      }
      case 'in-area': {
        if (k === 'finish') { I().areaFinish = value; I().areaColor = null; }
        if (k === 'color') I().areaColor = value || null;
        if (selArea) {
          ctx.snapshot();
          if (k === 'finish') { selArea.finish = value; delete selArea.color; }
          if (k === 'color') selArea.color = value;
          return commit();
        }
        return ctx.drawPanel();
      }
      case 'in-set': {
        if (!selItem) return;
        ctx.snapshot();
        if (value === '') delete selItem[k]; else selItem[k] = value;
        return commit();
      }
      case 'in-rot': {
        if (!selItem) return;
        ctx.snapshot();
        selItem.rot = (((selItem.rot || 0) + +value) % 360 + 360) % 360;
        return commit({ panel: false });
      }
      case 'in-reroll': {
        if (!selItem) return;
        ctx.snapshot();
        selItem.seed = 1 + Math.floor(Math.random() * 99999);
        return commit({ panel: false });
      }
      case 'in-dup': {
        if (!selItem) return;
        ctx.snapshot();
        const s = itemSize(selItem);
        const a = (selItem.rot || 0) * DEG;
        const copy = { ...selItem, id: newId('i'), x: clamp(selItem.x + Math.cos(a) * (s.w + 0.25), 0.5, b.w - 0.5), y: clamp(selItem.y + Math.sin(a) * (s.w + 0.25), 0.5, b.d - 0.5) };
        if ((ITEM_BY_ID[copy.type] || {}).seeded) copy.seed = 1 + Math.floor(Math.random() * 99999);
        L().items.push(copy);
        I().sel = { kind: 'item', id: copy.id };
        return commit();
      }
      case 'in-delete': {
        if (!sel) return;
        ctx.snapshot();
        const lv = L();
        if (sel.kind === 'item') lv.items = lv.items.filter((i) => i.id !== sel.id);
        if (sel.kind === 'wall') lv.walls = lv.walls.filter((w) => w.id !== sel.id);
        if (sel.kind === 'area') lv.areas = lv.areas.filter((a) => a.id !== sel.id);
        ensureInterior(b).levels[I().level] = lv;
        I().sel = null;
        return commit();
      }
      case 'in-copy-level': {
        ctx.snapshot();
        const src = JSON.stringify(L());
        for (let n = 0; n < (b.floors || 1); n++) {
          if (n === I().level) continue;
          const c = JSON.parse(src);
          for (const list of [c.walls, c.items, c.areas]) for (const o of list) o.id = newId(o.id[0]);
          it.levels[n] = c;
        }
        ctx.flashHint(`Copied this storey to the other ${b.floors - 1}.`);
        return commit();
      }
      case 'in-clear': {
        ctx.snapshot();
        it.levels[I().level] = { walls: [], items: [], areas: [] };
        I().sel = null;
        return commit();
      }
      default:
    }
  }

  /** Sliders and text boxes. */
  function input(el) {
    if (!I()) return;
    const { act, key: k } = el.dataset;
    const b = B();
    const sel = I().sel;
    const selItem = sel && sel.kind === 'item' ? L().items.find((i) => i.id === sel.id) : null;
    const label = el.closest('.field')?.querySelector('label b');
    if (act === 'in-num') {
      ctx.once();
      const v = +el.value;
      if (k === 'ceiling') { ensureInterior(b).ceiling = v; if (label) label.textContent = `${v} ft`; }
      else if (k === 'level') { I().level = clamp(Math.round(v), 0, (b.floors || 1) - 1); if (label) label.textContent = I().level ? `Storey ${I().level + 1}` : 'Ground floor'; }
      else if (selItem) { selItem[k] = v; if (label) label.textContent = `${Math.round(v * 10) / 10} ft`; }
      ctx.queueSave();
      refresh({ panel: false });
    }
    if (act === 'in-text' && selItem) {
      ctx.once();
      selItem[k] = el.value;
      ctx.queueSave();
      refresh({ panel: false });
    }
  }

  /* ------------------------------------------------------------------ panel */

  const chip = (act, key, value, label, on, extra = '') => `<button class="chip${on ? ' on' : ''}" data-act="${act}" data-key="${key}" data-value="${value}" ${extra}>${label}</button>`;
  const swatch = (act, key, value, on, title = '') => `<button class="chip swatch${on ? ' on' : ''}" style="background:${value}" title="${esc(title)}" data-act="${act}" data-key="${key}" data-value="${value}"></button>`;

  function panel() {
    const b = B();
    if (!b) return '';
    const r = room();
    const walking = ctx.engine().mode !== 'orbit';
    const lvl = I().level;
    const lv = L();
    const head = `<h2>🛋️ Interior <small>${esc(b.name)}</small></h2>
      <p class="hint">${fmt(b.w)} × ${fmt(b.d)} ft · ${r.floors > 1 ? `${lvl ? `storey ${lvl + 1}` : 'ground floor'} of ${r.floors} · ` : ''}${r.ceil.toFixed(1).replace('.0', '')} ft ceilings · ${lv.items.length} thing${lv.items.length === 1 ? '' : 's'}, ${lv.walls.length} wall${lv.walls.length === 1 ? '' : 's'}</p>
      <div class="row tight">
        <button class="btn primary" data-act="in-exit">✓ Done</button>
        ${walking ? '<button class="btn" data-act="cam" data-value="orbit">⤴ Back to the plan</button>' : '<button class="btn" data-act="in-walk">🚶 Walk inside</button>'}
        <button class="btn" data-act="in-frame" title="Look at the whole storey">🎯</button>
      </div>`;
    if (walking) return `${head}<p class="note">W A S D to walk, drag (or click) to look round, Shift to hurry. Esc or the button above brings you back out to carry on editing.</p>`;
    const tabs = `<div class="seg wide">${[['room', '🏠 Room'], ['build', '🧱 Walls & floors'], ['furnish', '🪑 Furnish']].map(([id, label]) => `<button data-act="in-tab" data-value="${id}" class="${I().tab === id ? 'active' : ''}">${label}</button>`).join('')}</div>`;
    const body = I().tab === 'room' ? roomTab(b, r) : I().tab === 'build' ? buildTab(r) : furnishTab();
    return `${head}${tabs}${selPanel(r)}${body}`;
  }

  function roomTab(b, r) {
    const it = b.interior || {};
    const floors = r.floors;
    const fl = FLOORS[r.floor] || FLOORS.concrete;
    return `
      ${floors > 1 ? (floors <= 8
    ? `<div class="field"><label>Storey</label><div class="chips">${Array.from({ length: floors }, (_, n) => chip('in-level', '', n, n ? `${n + 1}` : 'Ground', I().level === n)).join('')}</div></div>`
    : `<div class="field"><label for="in-lv">Storey<b>${I().level ? `Storey ${I().level + 1}` : 'Ground floor'}</b></label><input id="in-lv" type="range" min="0" max="${floors - 1}" step="1" value="${I().level}" data-act="in-num" data-key="level"></div>`) : ''}
      <div class="field"><label>Walls shown</label><div class="chips">
        ${chip('in-view', '', 'cut', 'Cut away to the camera', I().view === 'cut')}${chip('in-view', '', 'up', 'All up', I().view === 'up')}${chip('in-view', '', 'down', 'All down', I().view === 'down')}
      </div></div>
      <div class="divider"></div>
      <div class="field"><label for="in-ceil">Ceiling height<b>${r.ceil} ft</b></label>
        <input id="in-ceil" type="range" min="7" max="${Math.floor(r.ceilMax * 2) / 2}" step="0.5" value="${r.ceil}" data-act="in-num" data-key="ceiling"></div>
      <p class="note">The storey is ${r.fh.toFixed(1)} ft floor to floor; the ceiling can sit anywhere under that. Make the building taller on its own panel for more.</p>
      <div class="field"><label>Ceiling</label><div class="chips">
        ${Object.entries(CEILINGS).map(([id, c]) => chip('in-room', 'ceilingType', id, c.name, r.ceilingType === id)).join('')}
      </div></div>
      <div class="toggles">
        <button class="toggle${r.autoLights ? ' on' : ''}" data-act="in-room" data-key="autoLights" data-value="${r.autoLights ? '0' : '1'}"><span>Ceiling lights laid out for you</span><span class="pill">${r.autoLights ? 'On' : 'Off'}</span></button>
      </div>
      <div class="divider"></div>
      <div class="field"><label>Floor</label><div class="chips">
        ${Object.entries(FLOORS).map(([id, f]) => chip('in-room', 'floor', id, f.name, r.floor === id)).join('')}
      </div></div>
      <div class="field"><label>Floor colour</label><div class="chips">
        ${fl.colors.map((c) => swatch('in-room', 'floorColor', c, (r.floorColor || fl.colors[0]) === c)).join('')}
      </div></div>
      <div class="field"><label>Wall paint</label><div class="chips">
        ${WALL_PAINTS.map((c) => swatch('in-room', 'wallColor', c, r.wallColor === c)).join('')}
      </div></div>
      <div class="divider"></div>
      <div class="row tight">
        ${floors > 1 ? '<button class="btn" data-act="in-copy-level">⧉ Copy this storey to all the others</button>' : ''}
        <button class="btn ghost" data-act="in-clear">Empty this storey</button>
      </div>
      <p class="note">Windows and outside doors come from the building itself — change those on its own panel and they change in here too.${it.levels ? '' : ''}</p>`;
  }

  function buildTab(r) {
    const tool = I().tool;
    const wt = WALL_BY_ID[I().wallType] || WALL_TYPES[0];
    const fin = FLOORS[I().areaFinish] || FLOORS.ceramic;
    const paints = wt.colors || (wt.paint ? WALL_PAINTS : null);
    const doors = ITEMS.filter((i) => i.tab === 'doors');
    return `
      <h3>Partitions</h3>
      <div class="row tight">
        <button class="btn${tool && tool.kind === 'wall' ? ' primary' : ''}" data-act="in-tool" data-value="wall">✏️ Draw walls</button>
        <button class="btn${tool && tool.kind === 'room' ? ' primary' : ''}" data-act="in-tool" data-value="room">▭ Drag out a room</button>
      </div>
      <div class="field"><label>Kind of wall</label><div class="chips">
        ${WALL_TYPES.map((w) => chip('in-wall', 'type', w.id, `${w.icon} ${w.name}`, I().wallType === w.id)).join('')}
      </div></div>
      <div class="field"><label>Height</label><div class="chips">
        ${HEIGHTS.map(([h, name]) => chip('in-wall', 'h', h, name, (I().wallH || 0) === h)).join('')}
      </div></div>
      ${paints ? `<div class="field"><label>Colour</label><div class="chips">
        ${chip('in-wall', 'color', '', 'As the room', !I().wallColor)}${paints.map((c) => swatch('in-wall', 'color', c, I().wallColor === c)).join('')}
      </div></div>` : ''}
      <p class="note">Walls snap to the half foot, to each other's ends and to the outside walls. Click a wall to change or remove it.</p>
      <div class="divider"></div>
      <h3>Doors and openings</h3>
      <div class="grid-items">${doors.map(itemBtn).join('')}</div>
      <p class="note">Drop a door on a partition and it cuts its own doorway; drag it along the wall, or R to turn it round.</p>
      <div class="divider"></div>
      <h3>Flooring</h3>
      <div class="row tight"><button class="btn${tool && tool.kind === 'area' ? ' primary' : ''}" data-act="in-tool" data-value="area">▦ Lay a patch of floor</button></div>
      <div class="field"><label>Finish</label><div class="chips">
        ${Object.entries(FLOORS).map(([id, f]) => chip('in-area', 'finish', id, f.name, I().areaFinish === id)).join('')}
      </div></div>
      <div class="field"><label>Colour</label><div class="chips">
        ${fin.colors.map((c) => swatch('in-area', 'color', c, (I().areaColor || fin.colors[0]) === c)).join('')}
      </div></div>
      <p class="note">The whole storey's floor is set on the Room tab (${esc((FLOORS[r.floor] || {}).name || '')}); patches go over it — tiles in a washroom, timber in a boardroom.</p>`;
  }

  const itemBtn = (s) => {
    const on = I().tool && I().tool.kind === 'item' && I().tool.item.type === s.id;
    return `<button class="item${on ? ' on' : ''}" data-act="in-arm" data-key="${s.id}" title="${esc(s.name)} · ${s.w} × ${s.d} ft"><span class="ic">${s.icon}</span><span class="nm">${esc(s.name)}</span></button>`;
  };

  function furnishTab() {
    const list = ITEMS.filter((i) => i.tab === I().cat);
    return `
      <div class="chips catrow">${ITEM_TABS.filter(([id]) => ITEMS.some((i) => i.tab === id)).map(([id, label]) => `<button class="chip${I().cat === id ? ' on' : ''}" data-act="in-cat" data-value="${id}">${label}</button>`).join('')}</div>
      <div class="grid-items">${list.map(itemBtn).join('')}</div>
      <p class="note">Pick something, then click on the floor. R turns it a quarter (Shift+R a little); wall things find the nearest wall, lights go on the ceiling, and small things sit on whatever table is under them. Click anything placed to move, recolour, copy (Ctrl+D) or delete it.</p>`;
  }

  /** The editor for whatever is selected. */
  function selPanel(r) {
    const sel = I().sel;
    if (!sel) return '';
    const lv = L();
    if (sel.kind === 'item') {
      const it = lv.items.find((i) => i.id === sel.id);
      const spec = it && ITEM_BY_ID[it.type];
      if (!spec) return '';
      const s = itemSize(it);
      return `<div class="selcard"><h3>${spec.icon} ${esc(spec.name)}</h3>
        <div class="row tight">
          <button class="btn" data-act="in-rot" data-value="-15" title="Turn left">↺</button>
          <button class="btn" data-act="in-rot" data-value="15" title="Turn right">↻</button>
          <button class="btn" data-act="in-rot" data-value="90">90°</button>
          <button class="btn" data-act="in-dup">Copy</button>
          <button class="btn danger" data-act="in-delete">Delete</button>
        </div>
        ${spec.colors ? `<div class="field"><label>Finish</label><div class="chips">${spec.colors.map(([c, n]) => swatch('in-set', 'color', c, (it.color || spec.colors[0][0]) === c, n)).join('')}</div></div>` : ''}
        ${spec.colors2 ? `<div class="field"><label>${esc(spec.label2 || 'Second colour')}</label><div class="chips">${spec.colors2.map(([c, n]) => swatch('in-set', 'color2', c, (it.color2 || spec.colors2[0][0]) === c, n)).join('')}</div></div>` : ''}
        ${spec.variants ? `<div class="field"><label>${esc(spec.variantLabel || 'Kind')}</label><div class="chips">${spec.variants.map(([v, n], i) => chip('in-set', 'variant', v, esc(n), (it.variant || spec.variants[0][0]) === v || (!it.variant && i === 0))).join('')}</div></div>` : ''}
        ${spec.text != null ? `<div class="field"><label for="in-txt">Words</label><input id="in-txt" type="text" maxlength="60" value="${esc(it.text ?? spec.text)}" data-act="in-text" data-key="text"></div>` : ''}
        ${spec.len ? `<div class="field"><label for="in-w">Length<b>${Math.round(s.w * 10) / 10} ft</b></label><input id="in-w" type="range" min="${Math.max(1, spec.w * 0.4)}" max="${spec.w * 5}" step="0.5" value="${s.w}" data-act="in-num" data-key="w"></div>` : ''}
        ${spec.person ? `<div class="field"><label>Pose</label><div class="chips">${spec.poses.map((p) => chip('in-set', 'pose', p, POSE_NAMES[p] || p, (it.pose || spec.pose) === p)).join('')}</div></div>
          <div class="field"><button class="btn" data-act="in-reroll">🎲 Someone else</button></div>
          <p class="note">Seated poses sit at chair height: put the person where the chair is.</p>` : ''}
        ${!spec.ceil && !spec.cut && !spec.flat ? `<div class="field"><label for="in-lift">Raised off the floor<b>${Math.round((it.lift || 0) * 10) / 10} ft</b></label><input id="in-lift" type="range" min="0" max="${Math.max(6, Math.floor(r.ceil - 1))}" step="0.25" value="${it.lift || 0}" data-act="in-num" data-key="lift"></div>` : ''}
        <p class="hint">${s.w} × ${s.d} ft, ${s.h} ft high · drag to move · arrows nudge</p>
      </div><div class="divider"></div>`;
    }
    if (sel.kind === 'wall') {
      const w = lv.walls.find((i) => i.id === sel.id);
      if (!w) return '';
      const t = WALL_BY_ID[w.type] || WALL_TYPES[0];
      const paints = t.colors || (t.paint ? WALL_PAINTS : null);
      const len = Math.hypot(w.b[0] - w.a[0], w.b[1] - w.a[1]);
      return `<div class="selcard"><h3>${t.icon} ${esc(t.name)} <small>${len.toFixed(1)} ft long, ${wallHeight(w, r).toFixed(1)} ft high</small></h3>
        <div class="field"><label>Kind</label><div class="chips">${WALL_TYPES.map((x) => chip('in-wall', 'type', x.id, `${x.icon} ${x.name}`, w.type === x.id)).join('')}</div></div>
        <div class="field"><label>Height</label><div class="chips">${HEIGHTS.map(([h, name]) => chip('in-wall', 'h', h, name, (w.h || 0) === h)).join('')}</div></div>
        ${paints ? `<div class="field"><label>Colour</label><div class="chips">${chip('in-wall', 'color', '', 'As the room', !w.color)}${paints.map((c) => swatch('in-wall', 'color', c, w.color === c)).join('')}</div></div>` : ''}
        <div class="row tight"><button class="btn danger" data-act="in-delete">Remove this wall</button></div>
      </div><div class="divider"></div>`;
    }
    const a = lv.areas.find((i) => i.id === sel.id);
    if (!a) return '';
    const f = FLOORS[a.finish] || FLOORS.ceramic;
    return `<div class="selcard"><h3>▦ ${esc(f.name)} <small>${a.w.toFixed(1)} × ${a.d.toFixed(1)} ft</small></h3>
      <div class="field"><label>Finish</label><div class="chips">${Object.entries(FLOORS).map(([id, x]) => chip('in-area', 'finish', id, x.name, a.finish === id)).join('')}</div></div>
      <div class="field"><label>Colour</label><div class="chips">${f.colors.map((c) => swatch('in-area', 'color', c, (a.color || f.colors[0]) === c)).join('')}</div></div>
      <div class="row tight"><button class="btn danger" data-act="in-delete">Take this patch up</button></div>
    </div><div class="divider"></div>`;
  }

  /* -------------------------------------------------------------------- api */

  return {
    open, close, refresh, panel, action, input, key, down, move, up, dbl, camChanged, blocked,
    get active() { return !!I(); },
    /** Each frame: keep the cutaway facing the camera. */
    tick() { if (I() && view && view.active) view.cutaway(); },
    /** The line for the hint bar. */
    status() {
      if (!I()) return '';
      const t = I().tool;
      if (ctx.engine().mode !== 'orbit') return 'Inside · W A S D walks · drag looks · Esc back to the plan';
      if (t && t.kind === 'wall') return 'Drawing walls · click each corner · double-click or Enter ends the run · Esc stops';
      if (t && t.kind === 'room') return 'Drag out a room · Esc stops';
      if (t && t.kind === 'area') return 'Drag out a patch of flooring · Esc stops';
      if (t && t.kind === 'item') return `${ITEM_BY_ID[t.item.type].name} · click to place · R turns · Esc stops`;
      return 'Interior · click to select · drag to move · R turns · Delete removes · Esc or Done to finish';
    },
  };
}
