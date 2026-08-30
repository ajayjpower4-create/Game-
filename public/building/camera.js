/* The camera.
 *
 * It orbits a target point on the ground rather than the middle of the lot, so
 * zoom goes toward the cursor, panning drags the ground under your finger, and
 * the site does not change size when you swing round it — the scale is fixed
 * against the lot's own diagonal, not against whatever the outline happens to
 * measure at the current heading.
 *
 * Everything is damped: a flick keeps moving and eases off, and the preset
 * views fly rather than cut. */

import { makeCamera, clamp, DEG } from './iso.js';

export const PITCH_MIN = 4;
export const PITCH_MAX = 88;
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 12;

export function viewOf(state) {
  const v = state.view || (state.view = {});
  if (v.tx == null) v.tx = state.lot.width / 2 + (v.panX || 0);
  if (v.ty == null) v.ty = state.lot.depth / 2 + (v.panY || 0);
  if (v.yaw == null) v.yaw = 45;
  if (v.pitch == null) v.pitch = 34;
  if (v.zoom == null) v.zoom = 1;
  return v;
}

/**
 * Pixels per foot at zoom 1. It depends on the lot and the tilt but never on
 * the heading, which is what keeps an orbit from pumping the scene in and out.
 */
export function baseScale(state, size) {
  const v = viewOf(state);
  const k = Math.sin(v.pitch * DEG);
  const kz = Math.cos(v.pitch * DEG);
  const r = Math.hypot(state.lot.width + 150, state.lot.depth + 190) / 2;
  const tall = 90;
  const sx = size.w / (2 * r);
  const sy = size.h / (2 * r * k + tall * kz);
  return Math.max(0.02, Math.min(sx, sy) * 0.95);
}

export function fitCamera(state, size) {
  const v = viewOf(state);
  const scale = baseScale(state, size) * clamp(v.zoom, ZOOM_MIN, ZOOM_MAX);
  return makeCamera({
    yaw: v.yaw,
    pitch: v.pitch,
    scale,
    cx: v.tx,
    cy: v.ty,
    ox: size.w / 2,
    // Lift the look-at point as the camera drops toward the horizon, so a low
    // angle fills the frame with site rather than with sky.
    oy: size.h * (0.5 - 0.13 * Math.max(0, Math.cos(v.pitch * DEG) - 0.45)),
  });
}

const shortestTurn = (from, to) => from + (((to - from) % 360) + 540) % 360 - 180;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/**
 * Input for the camera: orbit, pan, zoom-to-cursor, pinch, keys, and flights.
 * The host owns the pointer events and hands over the ones it does not want
 * for itself, so dragging an object and dragging the world never fight.
 */
export function createRig({ getState, getSize, redraw, save }) {
  const pointers = new Map();
  let mode = null;            // 'orbit' | 'pan' | 'pinch'
  let last = null;
  let pinch = null;
  let vel = { yaw: 0, pitch: 0 };
  let glide = null;
  let flight = null;
  let raf = 0;
  let settle = 0;

  const view = () => viewOf(getState());

  const groundAt = (clientX, clientY, rect) => {
    const cam = fitCamera(getState(), getSize());
    return cam.unproject(clientX - rect.left, clientY - rect.top, 0);
  };

  /** Move the target so the world point `world` sits under the given pixel. */
  function anchor(world, clientX, clientY, rect) {
    const v = view();
    const now = groundAt(clientX, clientY, rect);
    v.tx += world[0] - now[0];
    v.ty += world[1] - now[1];
    clampTarget();
  }

  function clampTarget() {
    const s = getState();
    const v = view();
    // Keep the lot within reach — you can look off the edge, but not lose it.
    const mx = s.lot.width * 0.9 + 200;
    const my = s.lot.depth * 0.9 + 200;
    v.tx = clamp(v.tx, -mx + s.lot.width / 2, mx + s.lot.width / 2);
    v.ty = clamp(v.ty, -my + s.lot.depth / 2, my + s.lot.depth / 2);
  }

  function tick() {
    raf = 0;
    let live = false;
    const v = view();

    if (flight) {
      const t = Math.min(1, (performance.now() - flight.t0) / flight.ms);
      const e = easeOut(t);
      v.yaw = flight.from.yaw + (flight.to.yaw - flight.from.yaw) * e;
      v.pitch = flight.from.pitch + (flight.to.pitch - flight.from.pitch) * e;
      v.zoom = flight.from.zoom + (flight.to.zoom - flight.from.zoom) * e;
      v.tx = flight.from.tx + (flight.to.tx - flight.from.tx) * e;
      v.ty = flight.from.ty + (flight.to.ty - flight.from.ty) * e;
      if (t >= 1) { flight = null; v.yaw = ((v.yaw % 360) + 360) % 360; } else live = true;
    } else if (!mode && (Math.abs(vel.yaw) > 0.02 || Math.abs(vel.pitch) > 0.02)) {
      // Let a flick coast to a stop.
      v.yaw = (v.yaw - vel.yaw + 360) % 360;
      v.pitch = clamp(v.pitch + vel.pitch, PITCH_MIN, PITCH_MAX);
      vel.yaw *= 0.88;
      vel.pitch *= 0.88;
      live = true;
    } else if (!mode && glide) {
      const v2 = view();
      v2.tx += glide.x;
      v2.ty += glide.y;
      glide.x *= 0.86;
      glide.y *= 0.86;
      if (Math.abs(glide.x) < 0.05 && Math.abs(glide.y) < 0.05) glide = null; else live = true;
      clampTarget();
    }

    redraw(true);
    if (live) raf = requestAnimationFrame(tick);
    else finish();
  }

  function kick() {
    clearTimeout(settle);
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function finish() {
    clearTimeout(settle);
    settle = setTimeout(() => { redraw(false); save(); }, 90);
  }

  return {
    /** Start a camera drag. `kind` is 'orbit' or 'pan'. */
    down(ev, kind, rect) {
      pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      flight = null;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        mode = 'pinch';
        pinch = {
          dist: Math.hypot(a.x - b.x, a.y - b.y),
          zoom: view().zoom,
          world: groundAt((a.x + b.x) / 2, (a.y + b.y) / 2, rect),
        };
        return;
      }
      mode = kind;
      vel = { yaw: 0, pitch: 0 };
      glide = null;
      last = { x: ev.clientX, y: ev.clientY, world: groundAt(ev.clientX, ev.clientY, rect), t: performance.now() };
    },

    move(ev, rect) {
      if (!mode) return false;
      if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      const v = view();

      if (mode === 'pinch' && pointers.size >= 2) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        v.zoom = clamp(pinch.zoom * (dist / Math.max(12, pinch.dist)), ZOOM_MIN, ZOOM_MAX);
        anchor(pinch.world, (a.x + b.x) / 2, (a.y + b.y) / 2, rect);
        kick();
        return true;
      }

      const dx = ev.clientX - last.x;
      const dy = ev.clientY - last.y;
      if (mode === 'orbit') {
        const dYaw = dx * 0.34;
        const dPitch = dy * 0.26;
        v.yaw = (v.yaw - dYaw + 360) % 360;
        v.pitch = clamp(v.pitch + dPitch, PITCH_MIN, PITCH_MAX);
        vel = { yaw: dYaw * 0.55, pitch: dPitch * 0.55 };
      } else {
        const before = { tx: v.tx, ty: v.ty };
        anchor(last.world, ev.clientX, ev.clientY, rect);
        glide = { x: (v.tx - before.tx) * 0.6, y: (v.ty - before.ty) * 0.6 };
      }
      last = { x: ev.clientX, y: ev.clientY, world: last.world, t: performance.now() };
      kick();
      return true;
    },

    up(ev) {
      pointers.delete(ev.pointerId);
      if (pointers.size < 2 && mode === 'pinch') mode = null;
      if (pointers.size === 0) mode = null;
      if (!mode) kick();
    },

    wheel(ev, rect) {
      const v = view();
      flight = null;
      const world = groundAt(ev.clientX, ev.clientY, rect);
      v.zoom = clamp(v.zoom * Math.pow(1.0022, -ev.deltaY), ZOOM_MIN, ZOOM_MAX);
      anchor(world, ev.clientX, ev.clientY, rect);
      kick();
    },

    /** Fly to a view. Any of yaw/pitch/zoom/tx/ty may be left out. */
    flyTo(to, ms = 480) {
      const v = view();
      const from = { yaw: v.yaw, pitch: v.pitch, zoom: v.zoom, tx: v.tx, ty: v.ty };
      flight = {
        t0: performance.now(),
        ms,
        from,
        to: {
          yaw: to.yaw == null ? from.yaw : shortestTurn(from.yaw, to.yaw),
          pitch: clamp(to.pitch == null ? from.pitch : to.pitch, PITCH_MIN, PITCH_MAX),
          zoom: clamp(to.zoom == null ? from.zoom : to.zoom, ZOOM_MIN, ZOOM_MAX),
          tx: to.tx == null ? from.tx : to.tx,
          ty: to.ty == null ? from.ty : to.ty,
        },
      };
      kick();
    },

    /** Frame one footprint: centre on it and zoom so it fills the view. */
    focus(fp, size) {
      const state = getState();
      const span = Math.max(fp.w, fp.d, 40);
      const r = Math.hypot(state.lot.width + 150, state.lot.depth + 190) / 2;
      this.flyTo({
        tx: fp.x + fp.w / 2,
        ty: fp.y + fp.d / 2,
        zoom: clamp((r * 1.5) / span, 0.6, 6),
      });
    },

    nudge(part, amount) {
      const v = view();
      flight = null;
      if (part === 'yaw') v.yaw = (v.yaw + amount + 360) % 360;
      if (part === 'pitch') v.pitch = clamp(v.pitch + amount, PITCH_MIN, PITCH_MAX);
      if (part === 'zoom') v.zoom = clamp(v.zoom * amount, ZOOM_MIN, ZOOM_MAX);
      kick();
    },

    /** Pan in screen terms — the keys move the ground the way you expect. */
    slide(sx, sy) {
      const v = view();
      const a = v.yaw * DEG;
      const step = 26 / Math.max(0.3, v.zoom);
      v.tx += (sx * Math.cos(a) + sy * Math.sin(a)) * step;
      v.ty += (-sx * Math.sin(a) + sy * Math.cos(a)) * step;
      clampTarget();
      kick();
    },

    get busy() { return !!mode || !!flight; },
    cancel() { mode = null; flight = null; glide = null; vel = { yaw: 0, pitch: 0 }; pointers.clear(); },
  };
}
