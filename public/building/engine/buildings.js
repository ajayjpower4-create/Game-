/* Buildings in 3D.
 *
 * Every wall is built bay by bay from the wall grid the player paints: blank
 * panels, punched windows with real reveals and sills, ribbon glazing, curtain
 * walls with mullions, balconies, shopfronts, entrances with canopies, steel
 * doors, loading bays with dock seals, bumpers and levellers, roll-up doors
 * with their housings, garage doors, louvres, vents and open parking decks.
 * Then the roof — flat behind a parapet, pitched, hipped, monopitch, barrel
 * or sawtooth — the player's rooftop machines, the wall sign with raised
 * letters, rainwater pipes, and wall-pack lights that come on at night.
 *
 * Models are built in the building's own frame: x across the front, z toward
 * the front (the N wall faces +z), y up, origin at the footprint centre. */

import * as THREE from 'three';
import { Builder, cylGeo } from './builder.js';
import * as M from './materials.js';
import { signTexture } from './textures.js';
import { buildingHeight, ROOF_BY_ID } from '../catalog.js';

const DEG = Math.PI / 180;
export const PARAPET = 3.5;

/* ----------------------------------------------------------------- frames */

export function localFrames(w, d) {
  const hx = w / 2;
  const hz = d / 2;
  return {
    N: { o: [-hx, hz], u: [1, 0], n: [0, 1], len: w },
    S: { o: [hx, -hz], u: [-1, 0], n: [0, -1], len: w },
    E: { o: [hx, hz], u: [0, -1], n: [1, 0], len: d },
    W: { o: [-hx, -hz], u: [0, 1], n: [-1, 0], len: d },
  };
}

/** Draws on one wall: s runs along it from the viewer's left, h is height, and
 *  depth is measured outward from the wall plane (negative = recessed). */
class Face {
  constructor(b, f) {
    this.b = b;
    this.f = f;
    this.rotY = Math.atan2(-f.u[1], f.u[0]);
  }

  p(s, h, dp = 0) {
    const f = this.f;
    return [f.o[0] + f.u[0] * s + f.n[0] * dp, h, f.o[1] + f.u[1] * s + f.n[1] * dp];
  }

  /** A quad facing out of the wall. UVs are in feet unless `unit`. */
  rect(mat, s0, s1, h0, h1, dp = 0, unit = false) {
    if (s1 - s0 < 0.02 || h1 - h0 < 0.02) return;
    const uv = unit ? [0, 0, 1, 0, 1, 1, 0, 1] : [s0, h0, s1, h0, s1, h1, s0, h1];
    this.b.quad(mat, this.p(s0, h0, dp), this.p(s1, h0, dp), this.p(s1, h1, dp), this.p(s0, h1, dp), uv);
  }

  /** A quad facing back into the building (the inside of a parapet). */
  rectIn(mat, s0, s1, h0, h1, dp) {
    if (s1 - s0 < 0.02 || h1 - h0 < 0.02) return;
    this.b.quad(mat, this.p(s1, h0, dp), this.p(s0, h0, dp), this.p(s0, h1, dp), this.p(s1, h1, dp), [s1, h0, s0, h0, s0, h1, s1, h1]);
  }

  /** A box spanning s0..s1, h0..h1 and depth d0..d1. */
  box(mat, s0, s1, h0, h1, d0, d1) {
    if (s1 - s0 < 0.01 || h1 - h0 < 0.01 || d1 - d0 < 0.01) return;
    const f = this.f;
    const sm = (s0 + s1) / 2;
    const dm = (d0 + d1) / 2;
    this.b.box(mat, s1 - s0, h1 - h0, d1 - d0, f.o[0] + f.u[0] * sm + f.n[0] * dm, (h0 + h1) / 2, f.o[1] + f.u[1] * sm + f.n[1] * dm, [0, this.rotY, 0]);
  }

  post(mat, r, s, h0, h1, dp) {
    const [x, , z] = this.p(s, 0, dp);
    this.b.post(mat, r, h1 - h0, x, h0, z, 10);
  }

  /** Wall around an opening within a bay, plus the reveals into it. */
  punch(mat, c, o, recess, revealMat = mat) {
    this.rect(mat, c.s0, c.s1, c.h0, o.h0);
    this.rect(mat, c.s0, c.s1, o.h1, c.h1);
    this.rect(mat, c.s0, o.s0, o.h0, o.h1);
    this.rect(mat, o.s1, c.s1, o.h0, o.h1);
    if (recess <= 0) return;
    const r = recess;
    const q = (a, b2, cc, d) => this.b.quad(revealMat, a, b2, cc, d);
    if (o.s0 > c.s0 + 0.01) q(this.p(o.s0, o.h0, 0), this.p(o.s0, o.h0, -r), this.p(o.s0, o.h1, -r), this.p(o.s0, o.h1, 0));
    if (o.s1 < c.s1 - 0.01) q(this.p(o.s1, o.h0, -r), this.p(o.s1, o.h0, 0), this.p(o.s1, o.h1, 0), this.p(o.s1, o.h1, -r));
    if (o.h0 > 0.05) q(this.p(o.s0, o.h0, 0), this.p(o.s1, o.h0, 0), this.p(o.s1, o.h0, -r), this.p(o.s0, o.h0, -r));
    q(this.p(o.s0, o.h1, -r), this.p(o.s1, o.h1, -r), this.p(o.s1, o.h1, 0), this.p(o.s0, o.h1, 0));
  }

  /** Glass in a frame, with mullions and transoms, set back by `dp`. */
  glazing(glassMat, s0, s1, h0, h1, dp, { cols = 1, rows = 1, frame = 0.22, frameMat = M.frame(true), proud = 0.12 } = {}) {
    this.rect(glassMat, s0, s1, h0, h1, dp, true);
    const fd0 = dp;
    const fd1 = dp + proud;
    this.box(frameMat, s0, s1, h0, h0 + frame, fd0, fd1);
    this.box(frameMat, s0, s1, h1 - frame, h1, fd0, fd1);
    this.box(frameMat, s0, s0 + frame, h0, h1, fd0, fd1);
    this.box(frameMat, s1 - frame, s1, h0, h1, fd0, fd1);
    for (let i = 1; i < cols; i++) {
      const s = s0 + ((s1 - s0) * i) / cols;
      this.box(frameMat, s - frame / 2, s + frame / 2, h0, h1, fd0, fd1);
    }
    for (let j = 1; j < rows; j++) {
      const h = h0 + ((h1 - h0) * j) / rows;
      this.box(frameMat, s0, s1, h - frame / 2, h + frame / 2, fd0, fd1);
    }
  }
}

/* ------------------------------------------------------------- helpers */

function hash(...parts) {
  let h = 2166136261;
  for (const p of parts.join('|')) h = Math.imul(h ^ p.charCodeAt(0), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

const CLEAN = new Set(['precast', 'composite', 'rib', 'render']);

function roofKind(b) {
  if (b.roofGlass) return 'glass';
  if (b.roofType === 'flat') return 'membrane';
  if ((b.roofType === 'gable' || b.roofType === 'hip') && ['brick', 'render', 'stone'].includes(b.cladding) && b.w * b.d < 30000) return 'tiles';
  return 'seam';
}

function roofMaterial(b) {
  const k = roofKind(b);
  if (k === 'glass') return M.clearGlass('#cfe3ea');
  if (k === 'membrane') return M.roof('membrane', b.roofColor || '#c9cdd2');
  return M.roof(k, b.roofColor || (k === 'tiles' ? '#5d646d' : '#8d949c'));
}

/** How tall the roof rises above the eaves, for each roof type. */
export function roofRise(b) {
  const span = Math.min(b.w, b.d);
  switch (b.roofType) {
    case 'gable':
    case 'hip': {
      const pitch = b.style === 'chapel' ? 48 : span < 80 ? 32 : span < 140 ? 22 : 12;
      return (span / 2) * Math.tan(pitch * DEG);
    }
    case 'mono': return Math.min(14, span * 0.12);
    case 'barrel': return span * 0.2;
    case 'saw': return Math.min(14, Math.max(8, b.d / 12));
    default: return 0;
  }
}

/** Height of the roof surface over a point given from the footprint's top-left (plan feet). */
export function roofSurfaceY(b, dx, dy) {
  const H = buildingHeight(b);
  if (!b.roofType || b.roofType === 'flat') return H;
  const rise = roofRise(b);
  const x = dx - b.w / 2;
  const z = dy - b.d / 2;
  const alongX = b.w >= b.d;
  const across = alongX ? z : x;
  const along = alongX ? x : z;
  const half = (alongX ? b.d : b.w) / 2;
  const halfLong = (alongX ? b.w : b.d) / 2;
  switch (b.roofType) {
    case 'gable': return H + rise * (1 - Math.abs(across) / half);
    case 'hip': {
      const t = Math.min(1 - Math.abs(across) / half, (halfLong - Math.abs(along)) / half);
      return H + rise * Math.max(0, t);
    }
    case 'mono': return H + rise * (z / b.d + 0.5);
    case 'barrel': {
      const k = Math.abs(across) / half;
      return H + rise * Math.sqrt(Math.max(0, 1 - k * k));
    }
    case 'saw': return H + rise * 0.5;
    default: return H;
  }
}

/* ------------------------------------------------------------------ bays */

/** One bay of one floor of one wall. */
function bay(F, type, c, ctx) {
  const { wallMat, fh, floor } = ctx;
  const sc = (c.s0 + c.s1) / 2;
  const cw = c.s1 - c.s0;
  const tall = fh > 18;
  const lit = () => {
    const v = hash(ctx.id, ctx.face, floor, Math.round(c.s0));
    return v < 0.58 ? M.glassLit(Math.floor(v * 5.2) % 3) : M.glass();
  };
  const light = (s, h, out = 14, power = 650, range = 80) => {
    F.box(M.painted('#2b3036', 0.5), s - 0.6, s + 0.6, h - 0.45, h + 0.45, 0, 0.7);
    F.box(M.lamp('#ffe2b0', 5), s - 0.45, s + 0.45, h - 0.5, h - 0.42, 0.08, 0.62);
    const p = F.p(s, h - 0.6, 0.9);
    const t = F.p(s, 0, out);
    ctx.lights.push({ x: p[0], y: p[1], z: p[2], tx: t[0], tz: t[2], color: '#ffd9a8', power, range, angle: 68 });
  };

  switch (type) {
    case 'window': {
      const w = Math.min(cw * 0.62, tall ? 10 : 8);
      const sill = tall ? 4 : fh * 0.3;
      const hgt = tall ? Math.min(fh * 0.55, fh - 8) : fh * 0.47;
      const o = { s0: sc - w / 2, s1: sc + w / 2, h0: c.h0 + sill, h1: c.h0 + sill + hgt };
      F.punch(wallMat, c, o, 0.55);
      F.glazing(lit(), o.s0, o.s1, o.h0, o.h1, -0.55, { cols: w > 5 ? 2 : 1, rows: tall ? 3 : 1 });
      F.box(M.concrete('#bdbab3'), o.s0 - 0.35, o.s1 + 0.35, o.h0 - 0.32, o.h0, -0.55, 0.28);
      return;
    }
    case 'ribbon': {
      const sill = tall ? 6 : fh * 0.33;
      const hgt = tall ? Math.min(7, fh - 10) : fh * 0.42;
      const o = { s0: c.s0, s1: c.s1, h0: c.h0 + sill, h1: c.h0 + sill + hgt };
      F.punch(wallMat, c, o, 0.3);
      F.glazing(lit(), o.s0, o.s1, o.h0, o.h1, -0.3, { cols: Math.max(1, Math.round(cw / 5)), frame: 0.18 });
      return;
    }
    case 'glass': {
      F.rect(M.spandrel(), c.s0, c.s1, c.h0, c.h0 + 1.3, -0.1);
      F.glazing(lit(), c.s0, c.s1, c.h0 + 1.3, c.h1, -0.1, { cols: cw > 7 ? 2 : 1, frame: 0.2, proud: 0.32 });
      return;
    }
    case 'balcony': {
      const w = cw * 0.62;
      const o = { s0: sc - w / 2, s1: sc + w / 2, h0: c.h0, h1: c.h0 + Math.min(fh - 2.6, 8.4) };
      F.punch(wallMat, c, o, 0.45);
      F.glazing(lit(), o.s0, o.s1, o.h0, o.h1, -0.45, { cols: 2, rows: 1 });
      if (floor > 0) {
        F.box(M.concrete('#cfccc4'), c.s0 + 0.5, c.s1 - 0.5, c.h0 - 0.6, c.h0, 0, 4.6);
        F.box(M.metal('#5b6168', 0.45), c.s0 + 0.6, c.s1 - 0.6, c.h0 + 3.4, c.h0 + 3.6, 4.2, 4.5);
        F.rect(M.clearGlass(), c.s0 + 0.7, c.s1 - 0.7, c.h0, c.h0 + 3.4, 4.35);
        F.box(M.metal('#5b6168', 0.45), c.s0 + 0.5, c.s0 + 0.7, c.h0, c.h0 + 3.6, 0.2, 4.5);
        F.box(M.metal('#5b6168', 0.45), c.s1 - 0.7, c.s1 - 0.5, c.h0, c.h0 + 3.6, 0.2, 4.5);
      }
      return;
    }
    case 'shopfront': {
      const top = Math.min(c.h0 + fh - 3, c.h0 + 12);
      const o = { s0: c.s0 + 0.5, s1: c.s1 - 0.5, h0: c.h0 + 1.3, h1: top };
      F.punch(wallMat, c, o, 0.5);
      F.glazing(lit(), o.s0, o.s1, o.h0, o.h1, -0.5, { cols: Math.max(2, Math.round(cw / 5)), rows: 1, frameMat: M.frame(false) });
      F.box(M.frame(false), o.s0, o.s1, o.h0 + (o.h1 - o.h0) * 0.78, o.h0 + (o.h1 - o.h0) * 0.78 + 0.25, -0.5, -0.32);
      // A stall riser and a slim canopy over the glass.
      F.box(M.band(ctx.band), c.s0, c.s1, top + 0.4, top + 1.0, 0, 3.2);
      F.box(M.lamp('#fff1d6', 3), c.s0 + 1, c.s1 - 1, top + 0.36, top + 0.42, 0.6, 2.8);
      if (hash(ctx.id, c.s0) < 0.35) {
        const p = F.p(sc, top + 0.3, 2.4);
        ctx.lights.push({ x: p[0], y: p[1], z: p[2], tx: p[0], tz: p[2], color: '#fff0d8', power: 260, range: 40, angle: 80 });
      }
      return;
    }
    case 'door': {
      const w = Math.min(cw * 0.78, 9.5);
      const hgt = Math.min(9, fh * 0.72);
      const o = { s0: sc - w / 2, s1: sc + w / 2, h0: c.h0, h1: c.h0 + hgt };
      F.punch(wallMat, c, o, 0.9, M.band(ctx.band));
      const door = c.h0 + Math.min(7.4, hgt - 1);
      F.glazing(M.glassLit(1), o.s0, o.s1, o.h0, o.h1, -0.9, { cols: 4, rows: 1, frameMat: M.frame(false), frame: 0.28 });
      F.box(M.frame(false), o.s0, o.s1, door, door + 0.3, -0.9, -0.72);
      F.box(M.chrome(), sc - 0.25, sc - 0.15, c.h0 + 3, c.h0 + 4.6, -0.75, -0.55);
      F.box(M.chrome(), sc + 0.15, sc + 0.25, c.h0 + 3, c.h0 + 4.6, -0.75, -0.55);
      // Canopy with downlights.
      const ch = o.h1 + 1.2;
      F.box(M.band(ctx.band), o.s0 - 2, o.s1 + 2, ch, ch + 0.9, 0, 5.5);
      F.box(M.lamp('#fff3dc', 4), sc - 1.4, sc - 0.6, ch - 0.05, ch, 2.4, 3.2);
      F.box(M.lamp('#fff3dc', 4), sc + 0.6, sc + 1.4, ch - 0.05, ch, 2.4, 3.2);
      const p = F.p(sc, ch - 0.2, 3);
      const t = F.p(sc, 0, 7);
      ctx.lights.push({ x: p[0], y: p[1], z: p[2], tx: t[0], tz: t[2], color: '#fff1d9', power: 520, range: 50, angle: 75 });
      // Mat well.
      F.box(M.rubber(), o.s0 + 0.5, o.s1 - 0.5, 0, 0.06, 0, 4);
      return;
    }
    case 'firedoor': {
      const w = 3.6;
      const o = { s0: sc - w / 2, s1: sc + w / 2, h0: c.h0, h1: c.h0 + 7.4 };
      F.punch(wallMat, c, o, 0.35);
      F.rect(M.painted(ctx.dark, 0.45), o.s0, o.s1, o.h0, o.h1, -0.35);
      F.box(M.metal('#c9ced3', 0.3), sc + 0.9, sc + 1.4, c.h0 + 3.3, c.h0 + 3.5, -0.35, -0.15);
      F.box(M.painted('#3a3f45', 0.5), o.s0 - 0.6, o.s1 + 0.6, o.h1 + 0.5, o.h1 + 0.75, 0, 1.6);
      light(sc, o.h1 + 2.2, 10, 300, 40);
      return;
    }
    case 'dock': {
      const w = Math.min(9, cw - 2);
      const sill = 4;
      const top = Math.min(c.h0 + sill + 10, c.h1 - 2);
      const o = { s0: sc - w / 2, s1: sc + w / 2, h0: c.h0 + sill, h1: top };
      F.punch(wallMat, c, o, 0.5);
      F.rect(M.doorPanel(ctx.door), o.s0, o.s1, o.h0, o.h1, -0.5);
      F.box(M.metal('#9aa1a8', 0.5), o.s0, o.s1, o.h0 + 1.6, o.h0 + 2.3, -0.5, -0.38);  // vision strip
      F.rect(M.glass(), o.s0 + 1, o.s1 - 1, o.h0 + 1.75, o.h0 + 2.15, -0.37);
      // Dock shelter: black fabric frame around the opening.
      F.box(M.rubber(), o.s0 - 1.3, o.s0, o.h0 - 0.4, o.h1 + 0.4, 0, 1.6);
      F.box(M.rubber(), o.s1, o.s1 + 1.3, o.h0 - 0.4, o.h1 + 0.4, 0, 1.6);
      F.box(M.rubber(), o.s0 - 1.3, o.s1 + 1.3, o.h1, o.h1 + 1.4, 0, 1.6);
      F.box(M.paint('#e7b416'), o.s0 - 1.3, o.s1 + 1.3, o.h1 + 0.6, o.h1 + 0.8, 1.6, 1.62);
      // Leveller lip, bumpers and wheel guides.
      F.box(M.metal('#6f767d', 0.6), o.s0 + 0.6, o.s1 - 0.6, c.h0 + sill - 0.25, c.h0 + sill, 0, 0.9);
      F.box(M.rubber(), o.s0 + 0.2, o.s0 + 1.2, c.h0 + 2.4, c.h0 + 3.8, 0, 0.55);
      F.box(M.rubber(), o.s1 - 1.2, o.s1 - 0.2, c.h0 + 2.4, c.h0 + 3.8, 0, 0.55);
      F.box(M.painted('#e7b416', 0.5), o.s0 - 0.4, o.s0 - 0.1, 0, 0.8, 0.2, 9);
      F.box(M.painted('#e7b416', 0.5), o.s1 + 0.1, o.s1 + 0.4, 0, 0.8, 0.2, 9);
      // Dock light on its arm.
      F.box(M.painted('#33383e', 0.5), o.s1 + 1.6, o.s1 + 1.9, c.h0 + 8.5, c.h0 + 9, 0, 3);
      F.box(M.lamp('#fff4d6', 4), o.s1 + 1.4, o.s1 + 2.1, c.h0 + 8.2, c.h0 + 8.5, 2.4, 3.2);
      // Lit by a wall pack over the door.
      light(sc, o.h1 + 3.2, 18, 700, 90);
      return;
    }
    case 'roll': {
      const w = Math.min(cw * 0.8, 14);
      const hgt = Math.min(fh * 0.72, 16);
      const o = { s0: sc - w / 2, s1: sc + w / 2, h0: c.h0, h1: c.h0 + hgt };
      F.punch(wallMat, c, o, 0.3);
      F.rect(M.doorPanel(ctx.door), o.s0, o.s1, o.h0, o.h1, -0.3);
      F.box(M.metal('#8a9299', 0.45), o.s0 - 0.25, o.s0 + 0.1, o.h0, o.h1, -0.3, 0.2);
      F.box(M.metal('#8a9299', 0.45), o.s1 - 0.1, o.s1 + 0.25, o.h0, o.h1, -0.3, 0.2);
      if (hgt + 2 < fh) F.box(M.painted(ctx.door, 0.5), o.s0 - 0.5, o.s1 + 0.5, o.h1, o.h1 + 1.7, 0, 1.4);
      F.post(M.painted('#e7b416', 0.45), 0.35, o.s0 - 1.1, 0, 4, 1.4);
      F.post(M.painted('#e7b416', 0.45), 0.35, o.s1 + 1.1, 0, 4, 1.4);
      if (fh > 12) light(sc, Math.min(o.h1 + 3.4, c.h1 - 1), 14, 500, 70);
      return;
    }
    case 'garage': {
      const w = Math.min(cw * 0.82, 9);
      const o = { s0: sc - w / 2, s1: sc + w / 2, h0: c.h0, h1: c.h0 + 7.4 };
      F.punch(wallMat, c, o, 0.35, M.painted('#f2f2ee', 0.5));
      F.rect(M.doorPanel('#e9e9e4'), o.s0, o.s1, o.h0, o.h1, -0.35);
      for (let k = 1; k < 4; k++) F.box(M.painted('#d9d9d3', 0.6), o.s0, o.s1, o.h0 + k * 1.85 - 0.06, o.h0 + k * 1.85 + 0.06, -0.35, -0.3);
      light(sc + w / 2 + 1, o.h1 + 1, 8, 220, 30);
      return;
    }
    case 'louvre': {
      const w = Math.min(cw * 0.72, 9);
      const h0 = tall ? 4 : fh * 0.22;
      const h1 = tall ? Math.min(fh - 4, 14) : fh * 0.75;
      const o = { s0: sc - w / 2, s1: sc + w / 2, h0: c.h0 + h0, h1: c.h0 + h1 };
      F.punch(wallMat, c, o, 0.25);
      F.rect(M.louvre(), o.s0, o.s1, o.h0, o.h1, -0.25);
      F.box(M.frame(false), o.s0 - 0.2, o.s1 + 0.2, o.h0 - 0.2, o.h0, -0.25, 0.05);
      F.box(M.frame(false), o.s0 - 0.2, o.s1 + 0.2, o.h1, o.h1 + 0.2, -0.25, 0.05);
      return;
    }
    case 'vent': {
      const h = c.h0 + (tall ? 12 : fh * 0.68);
      const o = { s0: sc - 1.3, s1: sc + 1.3, h0: h, h1: h + 2.6 };
      F.punch(wallMat, c, o, 0.15);
      F.rect(M.louvre(), o.s0, o.s1, o.h0, o.h1, -0.15);
      F.box(M.frame(false), o.s0 - 0.15, o.s1 + 0.15, o.h1, o.h1 + 0.25, -0.1, 0.5);
      return;
    }
    case 'open': {
      const o = { s0: c.s0 + 0.9, s1: c.s1 - 0.9, h0: c.h0 + 3.4, h1: c.h1 - 1.6 };
      F.punch(wallMat, c, o, 0);
      const deep = 14;
      // The deck inside: floor, soffit, back wall and columns.
      F.box(M.concrete('#a9a8a2'), c.s0, c.s1, c.h0 - 0.5, c.h0 + 0.3, -deep, -0.05);
      F.rect(M.interiorDark(), o.s0, o.s1, c.h0 + 0.3, c.h1, -deep);
      F.box(M.concrete('#8f8e89'), c.s0, c.s1, c.h1 - 1.6, c.h1 - 0.9, -deep, -0.05);
      F.box(M.concrete('#b4b2ab'), c.s0, c.s0 + 0.9, c.h0, c.h1, -deep, -0.05);
      F.box(M.lamp('#f3f6ff', 2.2), sc - 2, sc + 2, c.h1 - 1.75, c.h1 - 1.6, -8, -6);
      F.box(M.metal('#9da3a9', 0.4), o.s0, o.s1, o.h0 - 0.1, o.h0 + 0.15, 0, 0.25);
      return;
    }
    case 'blank':
    default:
      F.rect(wallMat, c.s0, c.s1, c.h0, c.h1);
  }
}

/* ------------------------------------------------------------------ walls */

const GROUND_ONLY = new Set(['door', 'firedoor', 'dock', 'roll', 'garage', 'shopfront']);

function walls(b, B, ctx, H, fh, top) {
  const frames = localFrames(b.w, b.d);
  for (const face of ['N', 'E', 'S', 'W']) {
    const f = frames[face];
    const F = new Face(B, f);
    const grid = b.walls[face] || [['blank']];
    const cols = Math.max(1, (grid[0] || []).length);
    const cw = f.len / cols;
    ctx.face = face;
    for (let r = 0; r < b.floors; r++) {
      const row = grid[Math.min(r, grid.length - 1)] || [];
      for (let c = 0; c < cols; c++) {
        let type = row[c] || 'blank';
        if (r > 0 && GROUND_ONLY.has(type)) type = type === 'shopfront' ? 'window' : 'blank';
        ctx.floor = r;
        bay(F, type, { s0: c * cw, s1: (c + 1) * cw, h0: r * fh, h1: (r + 1) * fh }, ctx);
      }
    }
    // Wall above the top floor to the parapet or eaves.
    if (top > H) F.rect(ctx.wallMat, 0, f.len, H, top);
    ctx.faces[face] = { F, f, cols, cw, grid };
  }
}

/* ------------------------------------------------------------------ roofs */

function flatRoof(b, B, ctx, H) {
  const hx = b.w / 2;
  const hz = b.d / 2;
  const P = b.parapet ? PARAPET : 0;
  const inset = b.parapet ? 0.8 : 0;
  const deck = H + 0.02;
  // Roof membrane (or glass).
  B.quad(roofMaterial(b), [-hx + inset, deck, hz - inset], [hx - inset, deck, hz - inset], [hx - inset, deck, -hz + inset], [-hx + inset, deck, -hz + inset],
    [-hx, hz, hx, hz, hx, -hz, -hx, -hz]);
  const frames = localFrames(b.w, b.d);
  const coping = M.metal(ctx.coping, 0.4);
  for (const face of ['N', 'E', 'S', 'W']) {
    const f = frames[face];
    const F = new Face(B, f);
    if (P) {
      F.rectIn(ctx.wallMat, 0, f.len, H, H + P, -inset);
      F.box(coping, -0.15, f.len + 0.15, H + P, H + P + 0.3, -inset - 0.1, 0.2);
    } else {
      F.box(coping, -0.1, f.len + 0.1, H - 1.1, H + 0.25, -0.2, 0.25);
    }
    // The corporate stripe under the coping on clean modern cladding.
    if (CLEAN.has(b.cladding) && b.style !== 'deck') F.box(M.band(b.band), 0, f.len, H + P - 2.2, H + P - 0.5, 0, 0.12);
  }
  // Roof hatches and a walkway on big roofs, for scale.
  if (b.w * b.d > 20000) {
    B.slab(M.concrete('#b9b6ae'), Math.min(60, b.w * 0.4), 0.2, 3, 0, deck, 0);
    B.box(M.painted('#5d646c', 0.5), 3, 1.2, 3, b.w * 0.3, deck + 0.6, -b.d * 0.3);
  }
}

/** Pitched roofs are built with the ridge along "a" and the slope across "c";
 *  `map` turns that frame into the building's own. */
function pitchedRoof(b, B, ctx, H) {
  const alongX = b.w >= b.d;
  const L = alongX ? b.w : b.d;
  const S = alongX ? b.d : b.w;
  const map = alongX ? (a, y, c) => [a, y, c] : (a, y, c) => [c, y, -a];
  const rise = roofRise(b);
  const hl = L / 2;
  const hs = S / 2;
  const e = 1.6;                         // eaves overhang
  const slope = rise / hs;
  const eaveY = H - e * slope;
  const mat = roofMaterial(b);
  const fascia = M.painted(ctx.trim, 0.5);
  const q = (m, a, bb, c, d, uv) => B.quad(m, map(...a), map(...bb), map(...c), map(...d), uv);
  const slopeLen = Math.hypot(hs + e, rise + e * slope);
  const T = b.roofType;

  if (T === 'gable') {
    // Two slopes (front +c, back -c), overhanging the gable ends too.
    q(mat, [-hl - e, eaveY, hs + e], [hl + e, eaveY, hs + e], [hl + e, H + rise, 0], [-hl - e, H + rise, 0], [0, 0, L + 2 * e, 0, L + 2 * e, slopeLen, 0, slopeLen]);
    q(mat, [hl + e, eaveY, -hs - e], [-hl - e, eaveY, -hs - e], [-hl - e, H + rise, 0], [hl + e, H + rise, 0], [0, 0, L + 2 * e, 0, L + 2 * e, slopeLen, 0, slopeLen]);
    // Undersides.
    q(M.painted('#d9d6cf', 0.8), [-hl - e, H + rise - 0.4, 0], [hl + e, H + rise - 0.4, 0], [hl + e, eaveY - 0.4, hs + e], [-hl - e, eaveY - 0.4, hs + e]);
    q(M.painted('#d9d6cf', 0.8), [hl + e, H + rise - 0.4, 0], [-hl - e, H + rise - 0.4, 0], [-hl - e, eaveY - 0.4, -hs - e], [hl + e, eaveY - 0.4, -hs - e]);
    // Gable-end walls.
    for (const sgn of [1, -1]) {
      const a = sgn * hl;
      const tri = sgn > 0
        ? [[a, H, hs], [a, H, -hs], [a, H + rise, 0]]
        : [[a, H, -hs], [a, H, hs], [a, H + rise, 0]];
      triangle(B, ctx.wallMat, tri.map((p) => map(...p)), alongX);
      // Barge boards.
      for (const side of [1, -1]) {
        const p0 = map(a + sgn * e * 0.9, eaveY, side * (hs + e));
        const p1 = map(a + sgn * e * 0.9, H + rise, 0);
        B.tube(fascia, p0, p1, 0.35, 4);
      }
    }
    // Fascia and gutters along the eaves.
    for (const side of [1, -1]) {
      const p0 = map(-hl - e, eaveY - 0.2, side * (hs + e));
      const p1 = map(hl + e, eaveY - 0.2, side * (hs + e));
      B.tube(fascia, p0, p1, 0.45, 6);
      B.tube(M.painted('#3d4248', 0.4), map(-hl - e, eaveY - 0.5, side * (hs + e + 0.4)), map(hl + e, eaveY - 0.5, side * (hs + e + 0.4)), 0.35, 8);
    }
    // Ridge cap.
    B.tube(M.roof(roofKind(b) === 'glass' ? 'seam' : roofKind(b), b.roofColor), map(-hl - e, H + rise + 0.1, 0), map(hl + e, H + rise + 0.1, 0), 0.5, 6);
    return;
  }

  if (T === 'hip') {
    const r = Math.max(0, hl - hs);       // half the ridge length
    const top = H + rise;
    const E = e;
    // Front and back trapezoids.
    q(mat, [-hl - E, eaveY, hs + E], [hl + E, eaveY, hs + E], [r, top, 0], [-r, top, 0]);
    q(mat, [hl + E, eaveY, -hs - E], [-hl - E, eaveY, -hs - E], [-r, top, 0], [r, top, 0]);
    // End triangles.
    triangle(B, mat, [map(hl + E, eaveY, hs + E), map(hl + E, eaveY, -hs - E), map(r, top, 0)], null, true);
    triangle(B, mat, [map(-hl - E, eaveY, -hs - E), map(-hl - E, eaveY, hs + E), map(-r, top, 0)], null, true);
    // Soffit.
    q(M.painted('#d9d6cf', 0.8), [-hl - E, eaveY - 0.3, -hs - E], [hl + E, eaveY - 0.3, -hs - E], [hl + E, eaveY - 0.3, hs + E], [-hl - E, eaveY - 0.3, hs + E]);
    for (const [p0, p1] of [
      [[-hl - E, hs + E], [hl + E, hs + E]], [[hl + E, -hs - E], [-hl - E, -hs - E]],
      [[hl + E, hs + E], [hl + E, -hs - E]], [[-hl - E, -hs - E], [-hl - E, hs + E]],
    ]) {
      B.tube(fascia, map(p0[0], eaveY - 0.2, p0[1]), map(p1[0], eaveY - 0.2, p1[1]), 0.45, 6);
    }
    B.tube(M.roof(roofKind(b), b.roofColor), map(-r, top + 0.1, 0), map(r, top + 0.1, 0), 0.45, 6);
    return;
  }

  if (T === 'barrel') {
    const segs = 16;
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const t = -1 + (2 * i) / segs;
      const c = t * (hs + 0.8);
      pts.push([c, H + rise * Math.sqrt(Math.max(0, 1 - t * t)) + (Math.abs(t) > 0.999 ? 0 : 0)]);
    }
    let acc = 0;
    for (let i = 0; i < segs; i++) {
      const [c0, y0] = pts[i];
      const [c1, y1] = pts[i + 1];
      const len = Math.hypot(c1 - c0, y1 - y0);
      // Faces outward and up: winding runs along +a then up the curve toward -c.
      q(mat, [-hl - 1, y1, c1], [hl + 1, y1, c1], [hl + 1, y0, c0], [-hl - 1, y0, c0], [0, acc + len, L + 2, acc + len, L + 2, acc, 0, acc]);
      acc += len;
    }
    // Arched end walls.
    for (const sgn of [1, -1]) {
      const shape = [];
      for (let i = 0; i <= segs; i++) {
        const t = -1 + (2 * i) / segs;
        shape.push([t * hs, H + rise * Math.sqrt(Math.max(0, 1 - t * t))]);
      }
      for (let i = 0; i < segs; i++) {
        const [c0, y0] = shape[i];
        const [c1, y1] = shape[i + 1];
        const tri = sgn > 0 ? [[sgn * hl, H, c1], [sgn * hl, H, c0], [sgn * hl, y0, c0], [sgn * hl, y1, c1]] : [[sgn * hl, H, c0], [sgn * hl, H, c1], [sgn * hl, y1, c1], [sgn * hl, y0, c0]];
        B.quad(ctx.wallMat, ...tri.map((p) => map(...p)));
      }
    }
    for (const side of [1, -1]) B.tube(M.painted('#3d4248', 0.4), map(-hl - 1, H + 0.3, side * (hs + 0.9)), map(hl + 1, H + 0.3, side * (hs + 0.9)), 0.4, 8);
    return;
  }

  if (T === 'mono') {
    // High at the front (+z in the building frame) regardless of ridge axis.
    const hx = b.w / 2;
    const hz = b.d / 2;
    const yF = H + rise;
    const yB = H;
    B.quad(mat, [-hx - e, yF + 0.2, hz + e], [hx + e, yF + 0.2, hz + e], [hx + e, yB - e * (rise / b.d) + 0.2, -hz - e], [-hx - e, yB - e * (rise / b.d) + 0.2, -hz - e]);
    const F = localFrames(b.w, b.d);
    new Face(B, F.N).rect(ctx.wallMat, 0, b.w, H, yF);
    triangle(B, ctx.wallMat, [[hx, H, hz], [hx, H, -hz], [hx, yF, hz]], true);
    triangle(B, ctx.wallMat, [[-hx, H, -hz], [-hx, H, hz], [-hx, yF, hz]], true);
    B.tube(fascia, [-hx - e, yF, hz + e], [hx + e, yF, hz + e], 0.5, 6);
    B.tube(M.painted('#3d4248', 0.4), [-hx - e, yB - 0.5, -hz - e - 0.3], [hx + e, yB - 0.5, -hz - e - 0.3], 0.4, 8);
    return;
  }

  if (T === 'saw') {
    // Teeth along z: steep glazed faces look north (−z), long slopes face south.
    const hx = b.w / 2;
    const hz = b.d / 2;
    const n = Math.max(2, Math.round(b.d / 32));
    const p = b.d / n;
    const glassMat = M.glassLit(2);
    for (let i = 0; i < n; i++) {
      const z0 = -hz + i * p;
      const z1 = z0 + p;
      const top = H + rise;
      B.quad(glassMat, [hx, H, z0], [-hx, H, z0], [-hx, top, z0], [hx, top, z0], [0, 0, 1, 0, 1, 1, 0, 1]);
      B.quad(mat, [-hx - 0.5, H, z1], [hx + 0.5, H, z1], [hx + 0.5, top + 0.15, z0 - 0.1], [-hx - 0.5, top + 0.15, z0 - 0.1]);
      for (let x = -hx + 8; x < hx - 2; x += 8) B.box(M.frame(true), 0.3, rise, 0.3, x, H + rise / 2, z0 - 0.1);
      triangle(B, ctx.wallMat, [[hx, H, z1], [hx, H, z0], [hx, top, z0]], true);
      triangle(B, ctx.wallMat, [[-hx, H, z0], [-hx, H, z1], [-hx, top, z0]], true);
    }
  }
}

/** A flat triangle; set `wallUV` for wall textures that should run level. */
function triangle(B, mat, pts, wallUV = false) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array(pts.flat());
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const a = new THREE.Vector3(...pts[0]);
  const bb = new THREE.Vector3(...pts[1]);
  const c = new THREE.Vector3(...pts[2]);
  const n = new THREE.Vector3().crossVectors(bb.clone().sub(a), c.clone().sub(a)).normalize();
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([n.x, n.y, n.z, n.x, n.y, n.z, n.x, n.y, n.z]), 3));
  // UVs: horizontal distance along the wall and height.
  const horiz = Math.abs(n.x) > Math.abs(n.z) ? (p) => p[2] : (p) => p[0];
  const uv = wallUV !== null ? pts.flatMap((p) => [horiz(p), p[1]]) : pts.flatMap((p) => [p[0], p[2]]);
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
  g.setIndex([0, 1, 2]);
  B.add(g, mat);
}

/* -------------------------------------------------------------- rainwater */

function downpipes(b, B, ctx, H) {
  if (!CLEAN.has(b.cladding) && b.cladding !== 'brick') return;
  if (b.roofType !== 'flat' || H < 14) return;
  const mat = M.painted(ctx.trim, 0.45);
  for (const face of ['N', 'S', 'E', 'W']) {
    const info = ctx.faces[face];
    if (!info) continue;
    const { F, cols, cw, grid } = info;
    const row = grid[0] || [];
    const every = Math.max(2, Math.round(60 / cw));
    for (let c = every; c < cols; c += every) {
      if ((row[c - 1] || 'blank') !== 'blank' || (row[c] || 'blank') !== 'blank') continue;
      const s = c * cw;
      F.box(mat, s - 0.3, s + 0.3, 0.6, H - 1.5, 0.15, 0.75);
      F.box(mat, s - 0.6, s + 0.6, H - 1.8, H - 0.6, 0, 0.9);
      F.box(mat, s - 0.35, s + 0.35, 0, 0.6, 0.15, 1.2);
    }
  }
}

/* ------------------------------------------------------------------- sign */

const measureCtx = document.createElement('canvas').getContext('2d');
const floors = (b) => Math.max(1, b.floors || 1);

/** Roughly where each kind of opening starts within its floor. */
function openingBottom(type, fh) {
  const tall = fh > 18;
  switch (type) {
    case 'window': return tall ? 4 : fh * 0.3;
    case 'ribbon': return tall ? 6 : fh * 0.33;
    case 'dock': return 3.5;
    case 'louvre': return tall ? 4 : fh * 0.22;
    case 'vent': return tall ? 12 : fh * 0.68;
    default: return 0;
  }
}

/** Roughly how high an opening of each kind reaches within its floor. */
function openingTop(type, fh) {
  const tall = fh > 18;
  switch (type) {
    case 'blank': return -1;
    case 'window': return tall ? 4 + Math.min(fh * 0.55, fh - 8) : fh * 0.77;
    case 'ribbon': return tall ? 6 + Math.min(7, fh - 10) : fh * 0.75;
    case 'dock': return 16;
    case 'roll': return Math.min(fh * 0.72, 16) + 2;
    case 'door': return Math.min(9, fh * 0.72) + 2.2;
    case 'firedoor': return 10;
    case 'garage': return 9;
    case 'shopfront': return Math.min(fh - 3, 12) + 1;
    case 'louvre': return tall ? Math.min(fh - 4, 14) : fh * 0.75;
    case 'vent': return (tall ? 12 : fh * 0.68) + 3;
    case 'balcony': return Math.min(fh - 2.6, 8.4);
    default: return fh;
  }
}

/** Width over height of the lettering as signTexture lays it out. */
function signAspect(text, sub, logo) {
  const fam = '"Helvetica Neue", Helvetica, Arial, sans-serif';
  measureCtx.font = `800 100px ${fam}`;
  const main = (measureCtx.measureText(text || ' ').width + (logo ? 125 : 0)) / 100;
  if (!sub) return Math.max(1.2, (main * 0.6) / 0.92);
  measureCtx.font = `600 100px ${fam}`;
  const small = (measureCtx.measureText(sub).width * 1.12) / 100;
  return Math.max(1.2, Math.max(main * 0.46, small * 0.2) / 0.92);
}

function wallSign(b, B, ctx, H, fh) {
  const s = b.sign || {};
  if (!s.on || (!s.text && !s.logo)) return null;
  const info = ctx.faces[s.face || 'N'];
  if (!info) return null;
  const { F, f, cols, cw, grid } = info;
  const aspect = signAspect(s.text, s.sub, s.logo);
  const size = Math.max(0.4, Math.min(2.5, s.size || 1));
  const P = (!b.roofType || b.roofType === 'flat') && b.parapet ? PARAPET : 0;
  const n = floors(b);
  // Single-storey sheds carry their name high on the blank upper wall; taller
  // buildings carry it in the band above the top-floor windows.
  let hgt;
  let cy;
  if (n === 1) {
    hgt = Math.min(13, Math.max(3, H * 0.17)) * size;
    cy = Math.max(hgt / 2 + 9, H + P - hgt / 2 - 2.6);
  } else {
    hgt = Math.min(10, fh * 0.62) * size;
    cy = H - fh / 2 + 0.6;
  }
  let wid = hgt * aspect;
  if (wid > f.len * 0.84) {
    wid = f.len * 0.84;
    hgt = wid / aspect;
  }
  const sc = f.len / 2;
  // A backing panel when there are openings behind the letters.
  const c0 = Math.max(0, Math.floor((sc - wid / 2) / cw));
  const c1 = Math.min(cols - 1, Math.floor((sc + wid / 2) / cw));
  let busy = false;
  for (let r = 0; r < n; r++) {
    const row = grid[Math.min(r, grid.length - 1)] || [];
    const base = r * fh;
    for (let c = c0; c <= c1; c++) {
      const t = row[c] || 'blank';
      if (t === 'blank') continue;
      const lo = base + openingBottom(t, fh);
      const hi = base + openingTop(t, fh);
      if (hi > cy - hgt / 2 - 0.4 && lo < cy + hgt / 2 + 0.4) busy = true;
    }
  }
  if (busy) F.box(ctx.panelMat, sc - wid / 2 - 2, sc + wid / 2 + 2, cy - hgt / 2 - 1, cy + hgt / 2 + 1, 0, 0.45);
  const off = busy ? 0.5 : 0.05;
  const texH = Math.max(96, Math.min(512, Math.round(2048 / aspect)));
  const tex = signTexture({ text: s.text || '', sub: s.sub || '', logo: s.logo || '', color: s.color || '#1f4f9c', width: 2048, height: texH });
  const face = M.signFace(tex);
  const shade = new THREE.MeshBasicMaterial({ map: tex, color: 0x000000, transparent: true, opacity: 0.45, alphaTest: 0.1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  // The letters stand off the wall; a soft offset copy reads as their shadow.
  F.rect(shade, sc - wid / 2 + 0.12, sc + wid / 2 + 0.12, cy - hgt / 2 - 0.16, cy + hgt / 2 - 0.16, off + 0.06, true);
  F.rect(face, sc - wid / 2, sc + wid / 2, cy - hgt / 2, cy + hgt / 2, off + 0.32, true);
  return [tex, face, shade];
}

/* ------------------------------------------------------------ roof plant */

/** A fan: shroud ring with a dark well and a guard. */
function fanTop(B, x, y, z, r) {
  B.cyl(M.metal('#9aa2aa', 0.4), r, r, 0.6, x, y + 0.3, z, { seg: 18, open: true });
  B.cyl(M.rubber(), r * 0.96, r * 0.96, 0.05, x, y + 0.2, z, { seg: 18 });
  B.cyl(M.metal('#5d646b', 0.5), r * 0.18, r * 0.18, 0.3, x, y + 0.35, z, { seg: 10 });
  for (let k = 0; k < 3; k++) B.box(M.metal('#5d646b', 0.5), r * 1.9, 0.08, 0.12, x, y + 0.58, z, [0, (k * Math.PI) / 3, 0]);
}

/* ------------------------------------------------------------ heavy plant */

/** Structural steel ("dunnage") that heavy plant stands on, with a grated
 *  service walkway and handrail along one side. Returns the deck height. */
function dunnage(B, w, d) {
  const lift = 2.6;
  const steel = M.painted('#4d545c', 0.55);
  const nx = Math.max(2, Math.round(w / 12) + 1);
  for (let i = 0; i < nx; i++) {
    const x = -w / 2 + 1 + ((w - 2) * i) / (nx - 1);
    for (const z of [-d / 2 + 0.8, d / 2 - 0.8]) {
      B.box(steel, 0.7, lift, 0.7, x, lift / 2, z);
      B.box(M.rubber(), 1.4, 0.12, 1.4, x, 0.06, z);
    }
  }
  // Beams: two long girders, cross members at every column line.
  for (const z of [-d / 2 + 0.8, d / 2 - 0.8]) B.box(steel, w + 1, 0.8, 0.5, 0, lift - 0.4, z);
  for (let i = 0; i < nx; i++) B.box(steel, 0.45, 0.7, d - 1, -w / 2 + 1 + ((w - 2) * i) / (nx - 1), lift - 0.35, 0);
  // Walkway on the +z side, with a handrail and a cat ladder down.
  const grate = M.metal('#7d858c', 0.55);
  B.box(grate, w, 0.15, 3, 0, lift - 0.05, d / 2 + 1.5);
  for (let x = -w / 2; x <= w / 2 + 0.01; x += Math.max(4, w / Math.round(w / 6))) {
    B.box(M.painted('#e7b416', 0.45), 0.15, 3.6, 0.15, x, lift + 1.8, d / 2 + 3);
    B.box(steel, 0.4, lift, 0.4, x, lift / 2, d / 2 + 3);
  }
  B.box(M.painted('#e7b416', 0.45), w, 0.15, 0.15, 0, lift + 3.6, d / 2 + 3);
  B.box(M.painted('#e7b416', 0.45), w, 0.12, 0.12, 0, lift + 1.9, d / 2 + 3);
  for (const sx of [-1, 1]) B.box(M.painted('#e7b416', 0.45), 0.12, lift, 0.12, -w / 2 - 0.6 + sx * 0.6, lift / 2, d / 2 + 2.2);
  for (let y = 0.5; y < lift; y += 0.9) B.box(M.painted('#e7b416', 0.45), 1.2, 0.08, 0.08, -w / 2 - 0.6, y, d / 2 + 2.2);
  return lift;
}

/** A row of big condenser fans on top of a unit. */
function fanRow(B, x0, x1, y, z, n, r) {
  for (let i = 0; i < n; i++) fanTop(B, x0 + ((x1 - x0) * (i + 0.5)) / n, y, z, r);
}

/** Access doors with handles down one side of an air handler. */
function doors(B, w, h, z, n) {
  const door = M.painted('#bfc4c9', 0.45);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (w * (i + 0.5)) / n;
    B.box(door, w / n - 1.2, h - 2, 0.08, x, h / 2, z);
    B.box(M.metal('#5d646b', 0.4), 0.15, 0.6, 0.12, x + w / n / 2 - 1.2, h / 2, z + 0.05);
    B.box(M.metal('#5d646b', 0.4), 0.15, 0.6, 0.12, x + w / n / 2 - 1.2, h / 2 + 1.5, z + 0.05);
  }
}

function bigUnit(B, type, w, d, h) {
  const unit = M.painted('#d3d7db', 0.42);
  const seam = M.painted('#aeb4ba', 0.5);
  const dark = M.painted('#7d848b', 0.5);
  switch (type) {
    case 'ahu': {
      // Sections: intake, filters, coils, fan, discharge — each its own casing.
      const sec = [0.12, 0.18, 0.2, 0.28, 0.22];
      let x = -w / 2;
      sec.forEach((f, i) => {
        const len = w * f;
        const hh = i === 3 ? h : h - 0.8;
        B.slab(unit, len - 0.15, hh, d, x + len / 2, 0, 0);
        B.box(seam, 0.25, hh + 0.1, d + 0.1, x + len, hh / 2, 0);
        x += len;
      });
      doors(B, w * 0.9, h - 1.5, d / 2 + 0.05, 7);
      // Weather hood and louvres on the intake end, a duct stub off the top.
      B.box(M.louvre(), 0.1, h * 0.7, d * 0.8, -w / 2 - 0.05, h * 0.45, 0);
      B.box(unit, 2, 0.3, d * 0.9, -w / 2 - 1, h * 0.85, 0, [0, 0, -0.35]);
      B.slab(unit, 6, 3, d * 0.6, w * 0.32, h, 0);
      B.box(seam, w, 0.4, d + 0.3, 0, h - 0.2, 0);
      B.slab(dark, 3, 4, 1.4, w * 0.36, 0, -d / 2 - 0.7);
      break;
    }
    case 'chiller-xl': {
      B.slab(dark, w, 1, d, 0, 0, 0);
      for (const sz of [-1, 1]) B.box(M.louvre(), w - 0.6, h - 2.6, 0.12, 0, 1 + (h - 2.6) / 2, sz * d * 0.42, [sz * 0.16, 0, 0]);
      for (let x = -w / 2 + 4; x < w / 2; x += 5.5) B.box(unit, 0.3, h - 1.2, d * 0.95, x, 1 + (h - 1.2) / 2, 0);
      B.slab(unit, w, 0.5, d, 0, h - 0.6, 0);
      fanRow(B, -w / 2 + 3, w / 2 - 6, h - 0.1, -d * 0.24, 7, 1.8);
      fanRow(B, -w / 2 + 3, w / 2 - 6, h - 0.1, d * 0.24, 7, 1.8);
      // Control panel at one end.
      B.slab(unit, 5, h - 1, d, w / 2 - 2.5, 1, 0);
      B.box(M.painted('#3a3f45', 0.5), 0.1, 2.4, 2, w / 2 + 0.05, h * 0.55, 0);
      break;
    }
    case 'tower-twin': {
      for (const sx of [-1, 1]) {
        const cx = sx * w / 4;
        B.slab(unit, w / 2 - 0.4, h * 0.55, d, cx, 0, 0);
        for (const [rx, rz, ry] of [[cx, d / 2 + 0.06, 0], [cx, -d / 2 - 0.06, 0]]) B.box(M.louvre(), w / 2 - 1.4, h * 0.3, 0.1, rx, h * 0.22, rz, [0, ry, 0]);
        B.box(M.louvre(), 0.1, h * 0.3, d - 1.4, cx + sx * (w / 4 - 0.15), h * 0.22, 0);
        B.slab(seam, w / 2 - 0.4, 0.4, d, cx, h * 0.55, 0);
        B.cyl(unit, d * 0.36, d * 0.42, h * 0.38, cx, h * 0.55 + h * 0.19 + 0.4, 0, { seg: 26 });
        B.cyl(M.rubber(), d * 0.33, d * 0.33, 0.06, cx, h + 0.42, 0, { seg: 26 });
        B.cyl(M.metal('#5d646b', 0.5), 0.4, 0.4, 0.5, cx, h + 0.3, 0, { seg: 10 });
      }
      // Top deck handrail and a stair.
      for (const sz of [-1, 1]) B.box(M.painted('#e7b416', 0.45), w, 0.12, 0.12, 0, h * 0.55 + 3.6, sz * (d / 2 - 0.1));
      for (let i = 0; i < 10; i++) B.box(M.metal('#8a9198', 0.4), 2.6, 0.15, 0.9, w / 2 + 1.6, 0.4 + i * (h * 0.55 / 10), -d / 2 + 1 + i * 0.9);
      break;
    }
    case 'rtu-mega': {
      B.slab(M.painted('#6d737a', 0.6), w + 0.6, 0.8, d + 0.6, 0, 0, 0);
      B.slab(unit, w, h - 0.8, d, 0, 0.8, 0);
      for (let x = -w / 2 + w * 0.12; x < w / 2; x += w * 0.25) B.box(seam, 0.2, h - 0.8, d + 0.08, x, 0.8 + (h - 0.8) / 2, 0);
      for (const sz of [-1, 1]) B.box(M.louvre(), w * 0.4, h * 0.5, 0.08, w * 0.22, h * 0.5, sz * (d / 2 + 0.04));
      fanRow(B, w * 0.02, w * 0.48, h, 0, 3, 2);
      B.box(unit, 3, 0.3, d * 0.9, -w / 2 - 1.5, h * 0.8, 0, [0, 0, -0.4]);
      B.box(M.louvre(), 0.08, h * 0.45, d * 0.8, -w / 2 - 0.05, h * 0.5, 0);
      B.slab(dark, w * 0.3, 0.6, d * 0.8, -w * 0.2, h, 0);
      break;
    }
    case 'drycooler': {
      // V-bank: two inclined coil faces meeting at a ridge, fans along the top.
      for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.box(M.metal('#8a9198', 0.45), 0.5, h * 0.35, 0.5, x * (w / 2 - 0.5), h * 0.17, z * (d / 2 - 0.5));
      B.slab(dark, w, 0.6, d, 0, h * 0.33, 0);
      for (const sz of [-1, 1]) B.box(M.louvre(), w - 0.4, (h * 0.6) / Math.cos(0.42), 0.15, 0, h * 0.33 + h * 0.3, sz * d * 0.25, [-sz * 0.42, 0, 0]);
      B.slab(unit, w, 0.5, d * 0.92, 0, h - 0.5, 0);
      for (const sx of [-1, 1]) B.box(unit, 0.2, h * 0.62, d * 0.9, sx * w / 2, h * 0.64, 0);
      fanRow(B, -w / 2 + 1, w / 2 - 1, h, 0, 6, 2.1);
      break;
    }
    default:
      B.slab(unit, w, h, d, 0, 0, 0);
  }
}

export function roofItemModel(type, { ground = false } = {}) {
  const B = new Builder();
  const spec = ROOF_BY_ID[type] || { w: 8, d: 6, h: 3 };
  const { w, d, h } = spec;
  if (spec.big) {
    // Heavy plant stands on steel on a roof, on a concrete plinth on the ground.
    let lift = 0.8;
    if (ground) B.slab(M.concrete('#bdb9b1'), w + 3, 0.8, d + 3, 0, 0, 0);
    else lift = dunnage(B, w, d);
    const U = new Builder();
    bigUnit(U, type, w, d, h);
    for (const [m, geos] of U.parts) for (const g of geos) B.add(g, m, { pos: [0, lift, 0] });
    return B;
  }
  if (ground) {
    // Small kit on the ground sits on its own pad.
    const P = roofItemModel(type);
    B.slab(M.concrete('#bdb9b1'), w + 1.6, 0.5, d + 1.6, 0, 0, 0);
    for (const [m, geos] of P.parts) for (const g of geos) B.add(g, m, { pos: [0, 0.5, 0] });
    return B;
  }
  const unit = M.painted('#c9cdd1', 0.45);
  const unitDark = M.painted('#8d949b', 0.5);
  const steel = M.metal('#8a9198', 0.45);
  const curb = M.painted('#6d737a', 0.6);
  switch (type) {
    case 'rtu': {
      B.slab(curb, w + 0.6, 0.8, d + 0.6, 0, 0, 0);
      B.slab(unit, w, h - 0.8, d, 0, 0.8, 0);
      B.box(M.louvre(), 0.06, h * 0.45, d * 0.8, w / 2 + 0.03, h * 0.5, 0);
      B.box(M.louvre(), w * 0.45, h * 0.45, 0.06, -w * 0.2, h * 0.5, d / 2 + 0.03);
      fanTop(B, w * 0.22, h, 0, 1.2);
      B.slab(unitDark, w * 0.35, 0.3, d * 0.8, -w * 0.25, h, 0);
      break;
    }
    case 'rtu-xl': {
      B.slab(curb, w + 0.8, 1, d + 0.8, 0, 0, 0);
      B.slab(unit, w, h - 1, d, 0, 1, 0);
      for (const sx of [-1, 1]) B.box(M.louvre(), w * 0.42, h * 0.5, 0.06, sx * w * 0.24, h * 0.55, d / 2 + 0.03);
      B.box(M.louvre(), w * 0.42, h * 0.5, 0.06, w * 0.24, h * 0.55, -d / 2 - 0.03);
      fanTop(B, w * 0.15, h, 0, 1.6);
      fanTop(B, w * 0.36, h, 0, 1.6);
      B.slab(unitDark, w * 0.4, 0.5, d * 0.85, -w * 0.25, h, 0);
      break;
    }
    case 'chiller': {
      B.slab(steel, w, 0.6, d, 0, 0, 0);
      B.slab(unit, w, 1.6, d, 0, 0.6, 0);
      // V-coils down each side, fans along the top.
      for (const sz of [-1, 1]) {
        B.box(M.louvre(), w * 0.96, h - 2.4, 0.08, 0, 2.2 + (h - 2.4) / 2, sz * d * 0.47, [sz * 0.12, 0, 0]);
      }
      B.slab(unitDark, w, 0.3, d, 0, h - 0.3, 0);
      for (let i = 0; i < 4; i++) fanTop(B, -w / 2 + w * (i + 0.5) / 4, h, 0, Math.min(d * 0.4, 2.2));
      break;
    }
    case 'cooling': {
      B.slab(steel, w, 0.6, d, 0, 0, 0);
      B.slab(unit, w, h * 0.65, d, 0, 0.6, 0);
      for (const [rx, rz, ry] of [[0, d / 2 + 0.03, 0], [0, -d / 2 - 0.03, 0], [w / 2 + 0.03, 0, Math.PI / 2], [-w / 2 - 0.03, 0, Math.PI / 2]]) {
        B.box(M.louvre(), w * 0.86, h * 0.3, 0.06, rx, h * 0.28, rz, [0, ry, 0]);
      }
      B.cyl(unit, w * 0.36, w * 0.42, h * 0.32, 0, h * 0.65 + h * 0.16 + 0.6, 0, { seg: 22 });
      B.cyl(M.rubber(), w * 0.33, w * 0.33, 0.05, 0, h + 0.55, 0, { seg: 22 });
      B.post(steel, 0.12, 4, w / 2 - 0.3, h * 0.6, d / 2 - 0.3);
      break;
    }
    case 'condensers': {
      for (let i = 0; i < 4; i++) {
        const x = -w / 2 + w * (i + 0.5) / 4;
        B.slab(steel, w / 4 - 0.6, 0.4, d, x, 0, 0);
        B.slab(unit, w / 4 - 0.8, h - 0.4, d - 0.4, x, 0.4, 0);
        B.cyl(M.rubber(), 1.1, 1.1, 0.06, x, h * 0.55, d / 2 - 0.15, { rot: [Math.PI / 2, 0, 0], seg: 16 });
        B.box(M.metal('#5d646b', 0.5), 2.2, 0.1, 0.1, x, h * 0.55, d / 2 - 0.08);
      }
      break;
    }
    case 'fan': {
      B.slab(curb, w * 0.8, 0.8, w * 0.8, 0, 0, 0);
      B.cyl(unit, w * 0.32, w * 0.36, 1.2, 0, 1.4, 0, { seg: 18 });
      B.cyl(unit, w * 0.5, w * 0.2, 0.6, 0, h - 0.3, 0, { seg: 18 });
      B.cyl(M.louvre(), w * 0.3, w * 0.3, 0.6, 0, 2.2, 0, { seg: 18 });
      break;
    }
    case 'mushroom': {
      B.cyl(curb, w * 0.3, w * 0.3, 0.8, 0, 0.4, 0, { seg: 14 });
      B.cyl(unit, w * 0.18, w * 0.18, h - 0.8, 0, 0.8 + (h - 0.8) / 2, 0, { seg: 14 });
      B.sphere(unit, w * 0.48, 0, h - 0.4, 0, { sy: 0.45, seg: 16 });
      break;
    }
    case 'flue': {
      B.cyl(steel, 0.9, 1.1, h, 0, h / 2, 0, { seg: 14 });
      B.cyl(M.metal('#3b3f44', 0.5), 1.15, 1.15, 0.6, 0, h - 1.5, 0, { seg: 14 });
      B.cyl(M.rubber(), 0.85, 0.85, 0.05, 0, h + 0.01, 0, { seg: 14 });
      B.cyl(steel, 1.4, 1.4, 0.15, 0, h + 0.9, 0, { seg: 14 });
      for (const [a, b2] of [[0.6, 0.6], [-0.6, 0.6]]) B.box(steel, 0.08, 0.9, 0.08, a, h + 0.45, b2);
      break;
    }
    case 'chimney': {
      const brick = M.wall('brick', '#8f4f3c');
      B.add(cylGeo(w * 0.32, w * 0.5, h, 4).rotateY(Math.PI / 4), brick, { pos: [0, h / 2, 0] });
      for (const y of [h * 0.3, h * 0.6, h - 1.5]) {
        const rr = w * (0.5 - 0.18 * (y / h)) + 0.25;
        B.add(cylGeo(rr, rr, 0.8, 4).rotateY(Math.PI / 4), M.concrete('#b8b2a8'), { pos: [0, y, 0] });
      }
      B.cyl(M.rubber(), w * 0.2, w * 0.2, 0.1, 0, h + 0.02, 0, { seg: 10 });
      B.post(M.lamp('#ff3b30', 3), 0.25, 0.5, w * 0.3, h, 0);
      break;
    }
    case 'skylight': {
      B.slab(curb, w, 0.8, d, 0, 0, 0);
      B.slab(M.clearGlass('#9fc0cc'), w - 0.6, 0.25, d - 0.6, 0, 0.8, 0);
      B.slab(M.glassLit(2), w - 0.8, 0.05, d - 0.8, 0, 0.82, 0);
      for (let i = 1; i < 4; i++) B.box(M.frame(false), 0.15, 0.3, d - 0.6, -w / 2 + (w * i) / 4, 0.95, 0);
      break;
    }
    case 'dome': {
      B.slab(curb, w, 0.9, d, 0, 0, 0);
      B.sphere(M.clearGlass('#dfe9ec'), w * 0.42, 0, 0.9, 0, { sy: 0.38, seg: 18 });
      B.slab(M.glassLit(0), w * 0.8, 0.05, d * 0.8, 0, 0.92, 0);
      break;
    }
    case 'monitor': {
      // A raised glazed lantern along the roof.
      B.slab(curb, w, 0.8, d, 0, 0, 0);
      const s = new THREE.Shape();
      s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(d * 0.18, h - 0.8); s.lineTo(-d * 0.18, h - 0.8); s.closePath();
      B.extrude(M.glassLit(2), s, w - 0.4, { pos: [-(w - 0.4) / 2, 0.8, 0], rot: [0, Math.PI / 2, 0] });
      for (let i = 0; i <= 6; i++) B.box(M.frame(false), 0.18, h - 0.7, d * 0.95, -w / 2 + 0.3 + ((w - 0.6) * i) / 6, 0.8 + (h - 0.8) / 2, 0);
      B.slab(M.roof('seam', '#9aa1a8'), w - 0.2, 0.15, d * 0.4, 0, h, 0);
      break;
    }
    case 'solar': {
      // Two rows of tilted panels on racks.
      const panel = M.solarPanel();
      const rows = 2;
      for (let r = 0; r < rows; r++) {
        const z = -d / 2 + d * (r + 0.5) / rows;
        const tilt = 0.32;
        B.box(panel, w, 0.12, d / rows * 0.82, 0, 1.5 + r * 0, z, [tilt, 0, 0]);
        for (let i = 0; i <= 6; i++) {
          B.box(M.frame(false), 0.08, 0.14, d / rows * 0.82, -w / 2 + (w * i) / 6, 1.56, z, [tilt, 0, 0]);
        }
        for (const x of [-w / 2 + 1, 0, w / 2 - 1]) {
          B.box(steel, 0.2, 2.2, 0.2, x, 1.1, z - d / rows * 0.3);
          B.box(steel, 0.2, 1, 0.2, x, 0.5, z + d / rows * 0.3);
        }
      }
      break;
    }
    case 'greenroof': {
      B.slab(M.concrete('#9a978f'), w, 0.6, d, 0, 0, 0);
      B.slab(M.grass('#c6d7a5'), w - 1, 0.25, d - 1, 0, 0.6, 0);
      for (let i = 0; i < 18; i++) {
        const a = i * 2.4;
        B.sphere(M.leaves(i % 3), 0.9 + (i % 4) * 0.25, Math.cos(a) * w * 0.35 * ((i % 5) / 5 + 0.3), 0.9, Math.sin(a) * d * 0.35 * ((i % 3) / 3 + 0.3), { sy: 0.6, seg: 8 });
      }
      break;
    }
    case 'helipad': {
      B.slab(steel, w, 0.6, d, 0, 0, 0);
      B.slab(M.concrete('#7c8186'), w - 0.4, 0.4, d - 0.4, 0, 0.6, 0);
      const ring = new THREE.RingGeometry(w * 0.34, w * 0.37, 48).rotateX(-Math.PI / 2);
      B.add(ring, M.painted('#f4d03f', 0.6), { pos: [0, 1.02, 0] });
      const hm = M.paint('#ffffff');
      B.slab(hm, 1.6, 0.02, 12, -3.5, 1.01, 0);
      B.slab(hm, 1.6, 0.02, 12, 3.5, 1.01, 0);
      B.slab(hm, 7, 0.02, 1.6, 0, 1.01, 0);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        B.post(M.lamp('#7dff9a', 4), 0.3, 0.6, Math.cos(a) * w * 0.45, 1, Math.sin(a) * w * 0.45);
      }
      for (const sx of [-1, 1]) B.box(M.painted('#e7b416', 0.5), 0.2, 3, w, sx * (w / 2 + 2), 1.5, 0);
      break;
    }
    case 'dish': {
      B.slab(curb, 3, 0.6, 3, 0, 0, 0);
      B.post(steel, 0.25, 3, 0, 0.6, 0);
      const dish = new THREE.SphereGeometry(w * 0.45, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.32);
      B.add(dish, M.painted('#e9ecee', 0.4), { pos: [0, 3.8 - w * 0.45 * Math.cos(Math.PI * 0.32), -0.6], rot: [-0.7, 0, 0] });
      B.tube(steel, [0, 3.6, -0.6], [0, 5.4, 1.6], 0.06);
      B.box(M.painted('#3a3f45', 0.5), 0.5, 0.5, 0.7, 0, 5.5, 1.8);
      break;
    }
    case 'mast': {
      B.slab(curb, 3, 0.6, 3, 0, 0, 0);
      for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [0, 0.6]]) B.tube(steel, [x, 0.6, z], [x * 0.3, h, z * 0.3], 0.08, 5);
      for (let y = 2; y < h; y += 2.5) {
        const k = 1 - (y / h) * 0.7;
        B.tube(steel, [-0.6 * k, y, -0.6 * k], [0.6 * k, y + 1.2, -0.6 * k], 0.04, 4);
        B.tube(steel, [0.6 * k, y, -0.6 * k], [0, y + 1.2, 0.6 * k], 0.04, 4);
      }
      for (let i = 0; i < 3; i++) B.box(M.painted('#e9ecee', 0.4), 0.5, 3.2, 0.25, Math.cos(i * 2.1) * 0.6, h * 0.8, Math.sin(i * 2.1) * 0.6, [0, i * 2.1, 0]);
      B.sphere(M.signal('#ff2a1f', 3), 0.3, 0, h + 0.3, 0, { seg: 8 });
      break;
    }
    case 'tank': {
      const legs = h * 0.35;
      for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.post(steel, 0.3, legs, x * w * 0.32, 0, z * w * 0.32);
      B.tube(steel, [-w * 0.32, legs * 0.5, -w * 0.32], [w * 0.32, legs * 0.5, w * 0.32], 0.12);
      B.tube(steel, [w * 0.32, legs * 0.5, -w * 0.32], [-w * 0.32, legs * 0.5, w * 0.32], 0.12);
      B.slab(steel, w * 0.85, 0.4, w * 0.85, 0, legs, 0);
      B.cyl(M.wood('#7a5a3f'), w * 0.45, w * 0.47, h - legs - 2, 0, legs + 0.4 + (h - legs - 2) / 2, 0, { seg: 24 });
      for (let k = 1; k < 4; k++) B.cyl(steel, w * 0.48, w * 0.48, 0.25, 0, legs + 0.4 + ((h - legs - 2) * k) / 4, 0, { seg: 24, open: true });
      B.cone(M.roof('seam', '#6d747c'), w * 0.5, 2, 0, h - 0.6, 0, 24);
      break;
    }
    case 'stair':
    case 'lift': {
      const mat = M.wall('render', '#d9dcdf');
      B.slab(mat, w, h, d, 0, 0, 0);
      B.slab(M.metal('#8c939a', 0.4), w + 0.6, 0.4, d + 0.6, 0, h, 0);
      B.slab(M.roof('membrane', '#b9bdc2'), w - 0.2, 0.05, d - 0.2, 0, h + 0.4, 0);
      if (type === 'stair') {
        B.box(M.painted('#4a5058', 0.45), 3.4, 7.2, 0.15, 0, 3.6, d / 2 + 0.05);
        B.box(M.lamp('#fff1cc', 4), 0.8, 0.4, 0.4, 0, 7.8, d / 2 + 0.25);
      } else {
        B.box(M.louvre(), 3, 2, 0.08, 0, h - 2.5, d / 2 + 0.04);
      }
      break;
    }
    case 'duct': {
      for (let x = -w / 2 + 2; x <= w / 2 - 2; x += 6) B.slab(steel, 0.3, 1.2, d, x, 0, 0);
      B.slab(M.metal('#b8bfc6', 0.3), w, h - 1.2, d - 0.6, 0, 1.2, 0);
      for (let x = -w / 2 + 3; x < w / 2; x += 3) B.box(M.metal('#9aa1a8', 0.35), 0.15, h - 1.0, d - 0.4, x, 1.2 + (h - 1.2) / 2, 0);
      B.cyl(M.metal('#b8bfc6', 0.3), 1, 1, 2.2, w / 2 - 1, h + 1, 0, { seg: 12 });
      break;
    }
    case 'pipes': {
      for (let x = -w / 2 + 1; x <= w / 2 - 1; x += 6) {
        B.box(steel, 0.25, h, 0.25, x, h / 2, -d / 2 + 0.4);
        B.box(steel, 0.25, h, 0.25, x, h / 2, d / 2 - 0.4);
        B.box(steel, 0.25, 0.25, d, x, h - 0.4, 0);
      }
      const cols = ['#b8bfc6', '#c0392b', '#2f6b9a'];
      [-1, 0, 1].forEach((k, i) => B.tube(M.painted(cols[i], 0.35), [-w / 2, h - 0.1, k * d * 0.3], [w / 2, h - 0.1, k * d * 0.3], 0.35, 10));
      break;
    }
    case 'screen': {
      // Louvred screen around a plant well.
      const panel = M.louvre();
      for (const [x, z, ry, len] of [[0, d / 2, 0, w], [0, -d / 2, 0, w], [w / 2, 0, Math.PI / 2, d], [-w / 2, 0, Math.PI / 2, d]]) {
        B.box(panel, len, h - 0.8, 0.2, x, 0.8 + (h - 0.8) / 2, z, [0, ry, 0]);
        B.box(steel, len, 0.3, 0.35, x, h, z, [0, ry, 0]);
      }
      for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) B.post(steel, 0.2, h + 0.2, x * w / 2, 0, z * d / 2);
      B.slab(unit, w * 0.4, 3, d * 0.4, -w * 0.15, 0, 0);
      break;
    }
    case 'billboard': {
      for (let x = -w / 2 + 2; x <= w / 2 - 2; x += 7) {
        B.tube(steel, [x, 0, -1], [x, h, 0], 0.18, 6);
        B.tube(steel, [x, 0, 1], [x, h * 0.6, 0], 0.15, 6);
      }
      B.box(M.painted('#2c3138', 0.5), w, h * 0.55, 0.4, 0, h * 0.68, 0.3);
      B.box(steel, w, 0.3, 1.2, 0, h * 0.38, 0.8);
      break;
    }
    case 'vrf': {
      B.slab(curb, w + 0.4, 0.5, d + 0.4, 0, 0, 0);
      B.slab(unit, w, h - 0.5, d, 0, 0.5, 0);
      for (const sz of [-1, 1]) B.box(M.louvre(), w * 0.9, h * 0.65, 0.06, 0, h * 0.45, sz * (d / 2 + 0.03));
      fanTop(B, -w / 4, h, 0, 1.25);
      fanTop(B, w / 4, h, 0, 1.25);
      B.box(M.metal('#5d646b', 0.4), 0.8, 0.8, 0.3, w / 2 - 0.6, 1, d / 2 + 0.15);
      break;
    }
    case 'erv': {
      B.slab(curb, w + 0.6, 0.8, d + 0.6, 0, 0, 0);
      B.slab(unit, w, h - 0.8, d, 0, 0.8, 0);
      for (const sx of [-1, 1]) {
        B.box(unit, 2, 2.2, d * 0.7, sx * (w / 2 + 1), h * 0.6, 0, [0, 0, sx * 0.25]);
        B.box(M.louvre(), 0.06, 1.6, d * 0.6, sx * (w / 2 + 1.9), h * 0.55, 0);
      }
      B.box(unitDark, w * 0.5, 0.2, d * 0.9, 0, h + 0.1, 0);
      break;
    }
    case 'kitchenfan': {
      B.slab(curb, w, 1.4, d, 0, 0, 0);
      B.cyl(unitDark, w * 0.42, w * 0.42, 1.2, 0, 2, 0, { seg: 20 });
      B.cyl(unit, w * 0.22, w * 0.46, 1, 0, 3.1, 0, { seg: 20, open: true });
      B.cyl(M.rubber(), w * 0.2, w * 0.2, 0.05, 0, 3.4, 0, { seg: 20 });
      B.box(M.metal('#5d646b', 0.4), 1.2, 0.8, 0.8, w / 2 + 0.4, 1.4, 0);
      B.slab(M.painted('#3a3f45', 0.6), 1.6, 0.4, 1.2, w / 2 + 0.4, 0, 0);
      break;
    }
    case 'boilerflues': {
      B.slab(curb, w, 0.8, d, 0, 0, 0);
      [[-1.6, -1.6, 1], [1.6, -1.6, 0.85], [-1.6, 1.6, 0.75], [1.6, 1.6, 0.9]].forEach(([x, z, k]) => {
        const hh = h * k;
        B.cyl(steel, 0.6, 0.7, hh, x, hh / 2 + 0.8, z, { seg: 12 });
        B.cyl(M.metal('#3b3f44', 0.5), 0.8, 0.8, 0.4, x, hh * 0.6, z, { seg: 12 });
        B.cyl(steel, 1.1, 1.1, 0.12, x, hh + 1.4, z, { seg: 12 });
        for (const [a, b2] of [[0.5, 0.5], [-0.5, -0.5]]) B.box(steel, 0.06, 0.6, 0.06, x + a, hh + 1.1, z + b2);
      });
      B.tube(steel, [-1.6, h * 0.6, -1.6], [-w * 1.2, 0, -w * 1.2], 0.04, 3);
      B.tube(steel, [1.6, h * 0.6, 1.6], [w * 1.2, 0, w * 1.2], 0.04, 3);
      break;
    }
    case 'pumpskid': {
      B.slab(M.painted('#4d545c', 0.55), w, 0.5, d, 0, 0, 0);
      for (const x of [-w / 4, w / 4]) {
        B.cyl(M.painted('#2c5f8a', 0.4), 0.9, 0.9, 2.6, x, 1.6, 0, { rot: [0, 0, Math.PI / 2], seg: 16 });
        B.cyl(M.painted('#2c5f8a', 0.4), 0.7, 0.7, 1.4, x + 1.6, 1.6, 0, { rot: [0, 0, Math.PI / 2], seg: 14 });
        B.slab(M.painted('#2c5f8a', 0.4), 1.2, 1, 1.2, x - 0.8, 0.5, 0);
      }
      B.tube(M.painted('#c0392b', 0.4), [-w / 2, 3.2, -d / 4], [w / 2, 3.2, -d / 4], 0.35, 10);
      B.tube(M.painted('#2c5f8a', 0.4), [-w / 2, 3.2, d / 4], [w / 2, 3.2, d / 4], 0.35, 10);
      for (const x of [-w / 4, w / 4]) {
        B.tube(M.painted('#c0392b', 0.4), [x, 2.4, 0], [x, 3.2, -d / 4], 0.25, 8);
        B.tube(M.painted('#2c5f8a', 0.4), [x, 2.4, 0], [x, 3.2, d / 4], 0.25, 8);
      }
      B.slab(M.painted('#3a3f45', 0.5), 1.4, 3, 1, w / 2 - 0.7, 0.5, d / 2 - 0.5);
      break;
    }
    default:
      B.slab(unit, w, h, d, 0, 0, 0);
  }
  return B;
}

/* ------------------------------------------------------------------ build */

/**
 * The whole building as a group in its own frame (the caller positions it).
 * group.userData.lights holds its night lights in that frame;
 * group.userData.disposables, textures and materials made just for it.
 */
export function buildBuilding(b) {
  const group = new THREE.Group();
  const B = new Builder();
  const H = buildingHeight(b);
  const floors = Math.max(1, b.floors || 1);
  const fh = H / floors;
  const flat = !b.roofType || b.roofType === 'flat';
  const top = flat && b.parapet ? H + PARAPET : H;
  const wallMat = M.wall(b.cladding || 'precast', b.wall || '#d8dde3');
  const wallCol = new THREE.Color(b.wall || '#d8dde3');
  const hsl = {};
  wallCol.getHSL(hsl);
  const ctx = {
    id: b.id,
    wallMat,
    panelMat: M.wall(CLEAN.has(b.cladding) ? b.cladding : 'composite', b.wall || '#d8dde3'),
    band: b.band || '#1f3a63',
    coping: hsl.l > 0.5 ? '#9ea6ae' : '#5c636b',
    trim: hsl.l > 0.45 ? '#7d858e' : '#3f454c',
    door: hsl.l > 0.5 ? '#a9b1b9' : '#7b838c',
    dark: hsl.l > 0.5 ? '#5f6b78' : '#2f353c',
    fh,
    lights: [],
    faces: {},
  };

  walls(b, B, ctx, H, fh, top);
  if (flat) flatRoof(b, B, ctx, H);
  else pitchedRoof(b, B, ctx, H);
  downpipes(b, B, ctx, H);
  const signBits = wallSign(b, B, ctx, H, fh);

  // A plinth line where the walls meet the ground hides any gap with the paving.
  B.slab(M.concrete('#9c9a94'), b.w + 0.6, 0.35, b.d + 0.6, 0, -0.1, 0);

  B.finish(group);
  group.userData.lights = ctx.lights.filter((l) => l.power > 0);
  group.userData.disposables = signBits || [];

  // Rooftop machines, each one pickable on its own.
  (b.roofItems || []).forEach((it, i) => {
    const m = roofItemModel(it.type);
    const g = m.finish(new THREE.Group());
    const y = roofSurfaceY(b, it.dx, it.dy);
    g.position.set(it.dx - b.w / 2, y, it.dy - b.d / 2);
    g.rotation.y = -(it.rot || 0) * DEG;
    g.userData.pick = { id: b.id, roof: i };
    group.add(g);
  });
  return group;
}
