/* Every drawable piece: wall openings, rooftop plant, guard booths, props and
 * vehicles. Each one is written in feet and drawn through the isometric kit,
 * so all of it survives an arbitrary camera and an arbitrary heading. */

import {
  drawBox, boxFaces, poly, line, pad, ellipse, sphere, cylinder, gableRoof, topFace,
  faceText, mixHex, rgba, clamp, corners, DEG,
} from './iso.js';

const rand = (seed) => {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
};

/* ------------------------------------------------------------ wall cladding */

/** Ribbed metal siding — profiled sheet, for sheds, cold stores and trailers. */
export function ribs(face, { step = 3.5, detail }) {
  if (!detail) return '';
  let out = '';
  for (let t = step; t < face.len - 0.5; t += step) {
    out += face.quad(t, t + 0.28, 0, face.height, { fill: 'rgba(255,255,255,.13)', stroke: 'none' });
    out += face.quad(t + 0.28, t + 0.5, 0, face.height, { fill: 'rgba(20,28,40,.1)', stroke: 'none' });
  }
  return out;
}

/* ------------------------------------------------------------ wall openings */

/** One cell of a wall grid. `t0..t1` is its slice of the wall, `h0..h1` its floor. */
export function drawCell(face, o) {
  const { type, t0, t1, h0, h1, night, detail, band, tag } = o;
  const w = t1 - t0;
  const mid = (t0 + t1) / 2;
  const fh = h1 - h0;
  const glass = night ? 'url(#glassLit)' : 'url(#glassDay)';
  const reveal = 'rgba(16,24,36,.42)';
  let s = '';

  if (type === 'window') {
    const ww = Math.min(w * 0.62, 8);
    const wh = Math.min(fh * 0.5, 6.4);
    const b = h0 + fh * 0.32;
    s += face.quad(mid - ww / 2 - 0.7, mid + ww / 2 + 0.7, b - 0.5, b + wh + 0.6, { fill: reveal, stroke: 'none' });
    s += face.quad(mid - ww / 2, mid + ww / 2, b, b + wh, { fill: glass, stroke: 'rgba(16,28,42,.45)', 'stroke-width': 0.35 });
    if (detail) {
      s += face.quad(mid - ww / 2 - 1, mid + ww / 2 + 1, b - 0.9, b, { fill: 'rgba(255,255,255,.55)', stroke: 'none' });
      s += face.quad(mid - 0.13, mid + 0.13, b, b + wh, { fill: 'rgba(255,255,255,.35)', stroke: 'none' });
    }
  } else if (type === 'ribbon') {
    const b = h0 + fh * 0.34;
    const wh = Math.min(fh * 0.46, 6);
    s += face.quad(t0, t1, b - 0.5, b + wh + 0.5, { fill: reveal, stroke: 'none' });
    s += face.quad(t0, t1, b, b + wh, { fill: glass, stroke: 'none' });
    if (detail) {
      for (let t = t0 + 3; t < t1 - 0.5; t += 4) s += face.quad(t, t + 0.22, b, b + wh, { fill: 'rgba(255,255,255,.4)', stroke: 'none' });
      s += face.quad(t0, t1, b - 1, b, { fill: 'rgba(255,255,255,.45)', stroke: 'none' });
    }
  } else if (type === 'glass') {
    s += face.quad(t0, t1, h0 + 0.5, h1 - 0.5, { fill: night ? '#111825' : '#5f7f9b', stroke: 'none' });
    s += face.quad(t0 + 0.35, t1 - 0.35, h0 + fh * 0.22, h1 - 0.9, { fill: glass, stroke: 'none' });
    if (detail) {
      s += face.quad(t0, t1, h0 + 0.5, h0 + fh * 0.22, { fill: night ? '#151d2b' : mixHex(band, 0.92), stroke: 'none' });
      s += face.quad(t1 - 0.35, t1, h0, h1, { fill: rgba('#e6ebf0', night ? 0.25 : 0.6), stroke: 'none' });
      s += face.quad(t0, t1, h0 + fh * 0.22, h0 + fh * 0.22 + 0.25, { fill: 'rgba(255,255,255,.35)', stroke: 'none' });
    }
  } else if (type === 'dock' || type === 'roll') {
    const dh = Math.min(type === 'dock' ? 13.5 : 9.5, fh - 1);
    const dw = Math.min(type === 'dock' ? 9.5 : w - 1.6, w - 1.4);
    const a = mid - dw / 2;
    const b = mid + dw / 2;
    if (type === 'dock' && detail) s += face.quad(a - 1.7, b + 1.7, dh, Math.min(fh, dh + 2), { fill: 'rgba(16,24,36,.5)', stroke: 'none' });
    s += face.quad(a - 0.9, b + 0.9, h0, h0 + dh + 0.9, { fill: reveal, stroke: 'none' });
    s += face.quad(a, b, h0, h0 + dh, { fill: night ? '#161c26' : '#48515d', stroke: 'rgba(12,18,26,.6)', 'stroke-width': 0.4 });
    if (detail) {
      for (let h = 1.4; h < dh - 0.4; h += 2.1) {
        s += face.quad(a, b, h0 + h, h0 + h + 0.42, { fill: 'rgba(255,255,255,.15)', stroke: 'none' });
        s += face.quad(a, b, h0 + h + 0.42, h0 + h + 0.8, { fill: 'rgba(0,0,0,.14)', stroke: 'none' });
      }
      s += face.quad(a, b, h0 + dh - 1.2, h0 + dh, { fill: 'rgba(0,0,0,.28)', stroke: 'none' });
    }
    if (type === 'dock') {
      s += face.quad(a - 1.1, a - 0.1, h0, h0 + 3.6, { fill: '#1b2029', stroke: 'none' });
      s += face.quad(b + 0.1, b + 1.1, h0, h0 + 3.6, { fill: '#1b2029', stroke: 'none' });
      if (detail && tag != null) {
        s += faceText(face, { t: mid, h: h0 + dh + 2.6, text: String(tag), size: 1.9, color: night ? 'rgba(255,225,170,.9)' : 'rgba(255,255,255,.85)', weight: 700 });
      }
    }
    // A wall pack over every door — the light goes where the work is.
    if (night) {
      s += face.quad(mid - 0.8, mid + 0.8, h0 + dh + 1.6, h0 + dh + 2.3, { fill: '#ffdf9e', stroke: 'none' });
      s += face.quad(a - 3.5, b + 3.5, h0, h0 + dh + 2, { fill: 'url(#wallLamp)', stroke: 'none' });
    }
  } else if (type === 'door') {
    const dw = Math.min(w * 0.8, 15);
    const a = mid - dw / 2;
    const b = mid + dw / 2;
    s += face.quad(a - 0.9, b + 0.9, h0, h0 + 12.6, { fill: reveal, stroke: 'none' });
    s += face.quad(a, b, h0, h0 + 11.8, { fill: night ? '#1a2534' : '#6f96b4', stroke: 'rgba(14,22,34,.6)', 'stroke-width': 0.4 });
    s += face.quad(a + 0.4, b - 0.4, h0 + 0.3, h0 + 9.5, { fill: glass, stroke: 'none' });
    if (detail) {
      s += face.quad(mid - 0.35, mid + 0.35, h0, h0 + 9.5, { fill: '#e9ecef', stroke: 'none' });
      s += face.quad(a, b, h0 + 9.5, h0 + 10.1, { fill: '#e9ecef', stroke: 'none' });
      s += face.quad(mid - 3.4, mid - 3, h0 + 3.4, h0 + 5.4, { fill: '#dfe4ea', stroke: 'none' });
      s += face.quad(mid + 3, mid + 3.4, h0 + 3.4, h0 + 5.4, { fill: '#dfe4ea', stroke: 'none' });
      s += face.quad(a - 2.6, b + 2.6, h0 + 12.6, h0 + 14.2, { fill: night ? '#2a3446' : '#dfe3e8', stroke: 'rgba(14,22,34,.4)', 'stroke-width': 0.4 });
    }
    if (night) s += face.quad(a - 4, b + 4, h0, h0 + 14, { fill: 'url(#wallLamp)', stroke: 'none' });
  } else if (type === 'louvre') {
    const a = t0 + w * 0.16;
    const b = t1 - w * 0.16;
    const lo = h0 + fh * 0.3;
    const hi = h0 + fh * 0.78;
    s += face.quad(a - 0.5, b + 0.5, lo - 0.5, hi + 0.5, { fill: reveal, stroke: 'none' });
    s += face.quad(a, b, lo, hi, { fill: night ? '#232a35' : '#7b838d', stroke: 'none' });
    for (let h = lo + 0.4; h < hi - 0.2; h += 1.1) {
      s += face.quad(a, b, h, h + 0.55, { fill: 'rgba(255,255,255,.22)', stroke: 'none' });
    }
  } else if (type === 'open') {
    // An open-sided deck: the void, its upstand and the slab edge above it.
    const up = Math.min(3.4, fh * 0.3);
    s += face.quad(t0, t1, h0 + up, h1 - 1.3, { fill: night ? '#0d121b' : '#2a313b', stroke: 'none' });
    if (night) s += face.quad(t0, t1, h0 + up, h1 - 1.3, { fill: 'url(#wallLamp)', stroke: 'none' });
    if (detail) {
      s += face.quad(t0, t1, h0 + up - 0.45, h0 + up, { fill: 'rgba(255,255,255,.32)', stroke: 'none' });
      s += face.quad(t0, t1, h0 + up + 1.4, h0 + up + 1.7, { fill: 'rgba(255,255,255,.18)', stroke: 'none' });
    }
    s += face.quad(t0, t1, h1 - 1.3, h1, { fill: band, stroke: 'none' });
  } else if (type === 'vent') {
    const r = Math.min(w * 0.22, fh * 0.22, 2.4);
    s += face.quad(mid - r, mid + r, h0 + fh * 0.45 - r, h0 + fh * 0.45 + r, { fill: night ? '#252c37' : '#8e969f', stroke: 'rgba(16,24,36,.5)', 'stroke-width': 0.4 });
    s += face.quad(mid - r * 0.6, mid + r * 0.6, h0 + fh * 0.45 - r * 0.6, h0 + fh * 0.45 + r * 0.6, { fill: 'rgba(16,24,36,.45)', stroke: 'none' });
  }
  return s;
}

/* ---------------------------------------------------------- rooftop plant */

const boxAt = (o, z0, z1, scale = 1) => ({
  x: o.x + (o.w * (1 - scale)) / 2, y: o.y + (o.d * (1 - scale)) / 2,
  w: o.w * scale, d: o.d * scale, rot: o.rot, z0, z1,
});

/** One piece of rooftop machinery, sitting on the roof at height z. */
export function drawRoofItem(cam, o, z, ctx) {
  const { night, detail } = ctx;
  const metal = night ? '#3d434d' : '#aeb5bd';
  const dark = night ? '#2b313a' : '#8b939c';
  const r = rand(o.seed || 3);
  const box = (z0, z1, s = 1) => boxAt(o, z + z0, z + z1, s);
  let out = '';

  switch (o.art) {
    case 'rtu':
      out += drawBox(cam, box(0.5, o.h), { color: metal, roof: mixHex(metal, 1.1), stroke: 'rgba(20,28,40,.45)' });
      out += drawBox(cam, box(0, 0.5, 0.92), { color: dark, crisp: true, stroke: 'none' });
      out += topFace(cam, box(0, o.h, 0.62), { fill: 'rgba(20,28,40,.35)', stroke: 'none' });
      if (detail) {
        out += drawBox(cam, { ...box(o.h, o.h + 0.5, 0.5), rot: o.rot }, { color: mixHex(metal, 0.8), crisp: true, stroke: 'none' });
      }
      break;
    case 'chiller': {
      out += drawBox(cam, box(0, 1.2, 0.96), { color: dark, crisp: true, stroke: 'none' });
      out += drawBox(cam, box(1.2, o.h), {
        color: metal, roof: mixHex(metal, 1.05), stroke: 'rgba(20,28,40,.45)',
        decorate: (f) => (f.len > o.d + 1 ? '' : ''),
      });
      const n = Math.max(2, Math.round(o.w / 6));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const c = corners(o);
        const px = c[0][0] + (c[1][0] - c[0][0]) * t + (c[3][0] - c[0][0]) * 0.5;
        const py = c[0][1] + (c[1][1] - c[0][1]) * t + (c[3][1] - c[0][1]) * 0.5;
        out += ellipse(cam, px, py, 2.2, 2.2, { fill: 'rgba(20,28,40,.45)', stroke: 'none' }, z + o.h + 0.05);
      }
      break;
    }
    case 'cooling':
      out += drawBox(cam, box(0, o.h * 0.72), { color: metal, roof: dark, stroke: 'rgba(20,28,40,.45)' });
      out += drawBox(cam, box(o.h * 0.72, o.h, 0.72), { color: mixHex(metal, 0.92), roof: dark, stroke: 'rgba(20,28,40,.45)' });
      out += ellipse(cam, o.x + o.w / 2, o.y + o.d / 2, o.w * 0.26, o.d * 0.26, { fill: 'rgba(16,22,32,.6)', stroke: 'none' }, z + o.h + 0.06);
      break;
    case 'fan':
      out += cylinder(cam, { x: o.x + o.w / 2, y: o.y + o.d / 2, r: o.w / 2, z0: z, z1: z + o.h }, { color: metal });
      out += ellipse(cam, o.x + o.w / 2, o.y + o.d / 2, o.w * 0.34, o.d * 0.34, { fill: 'rgba(16,22,32,.55)', stroke: 'none' }, z + o.h + 0.05);
      break;
    case 'mushroom':
      out += cylinder(cam, { x: o.x + o.w / 2, y: o.y + o.d / 2, r: o.w * 0.28, z0: z, z1: z + o.h * 0.6 }, { color: metal });
      out += ellipse(cam, o.x + o.w / 2, o.y + o.d / 2, o.w * 0.5, o.d * 0.5, { fill: mixHex(metal, 1.05), stroke: 'rgba(20,28,40,.4)', 'stroke-width': 0.5 }, z + o.h);
      break;
    case 'flue':
      out += cylinder(cam, { x: o.x + o.w / 2, y: o.y + o.d / 2, r: o.w * 0.4, z0: z, z1: z + o.h }, { color: mixHex(metal, 0.9) });
      out += cylinder(cam, { x: o.x + o.w / 2, y: o.y + o.d / 2, r: o.w * 0.5, z0: z + o.h - 0.6, z1: z + o.h }, { color: dark });
      break;
    case 'skylight':
      out += drawBox(cam, box(0, 0.5), { color: dark, crisp: true, stroke: 'none' });
      out += topFace(cam, box(0, o.h), {
        fill: night ? 'rgba(255,214,150,.55)' : 'rgba(238,246,252,.92)',
        stroke: 'rgba(30,40,55,.35)', 'stroke-width': 0.5,
      });
      break;
    case 'monitor': {
      out += drawBox(cam, box(0, o.h), {
        color: metal, roof: mixHex(metal, 1.12), stroke: 'rgba(20,28,40,.4)',
        decorate: (f) => f.quad(1, f.len - 1, o.h * 0.3, o.h - 0.4, {
          fill: night ? 'url(#glassLit)' : 'url(#glassDay)', stroke: 'none',
        }),
      });
      break;
    }
    case 'solar': {
      const rows = 3;
      const c = corners(o);
      for (let i = 0; i < rows; i++) {
        const f0 = i / rows;
        const f1 = (i + 0.72) / rows;
        const p = (fx, fy, h) => [
          c[0][0] + (c[1][0] - c[0][0]) * fx + (c[3][0] - c[0][0]) * fy,
          c[0][1] + (c[1][1] - c[0][1]) * fx + (c[3][1] - c[0][1]) * fy,
          z + h,
        ];
        out += poly(cam, [p(0.02, f0, 1.2), p(0.98, f0, 1.2), p(0.98, f1, o.h), p(0.02, f1, o.h)], {
          fill: night ? '#1b2532' : '#27405c', stroke: 'rgba(200,220,240,.5)', 'stroke-width': 0.4,
        });
        out += poly(cam, [p(0.02, f0, 0), p(0.02, f0, 1.2), p(0.02, f1, o.h), p(0.02, f1, 0)], { fill: 'rgba(20,28,40,.3)', stroke: 'none' });
      }
      break;
    }
    case 'dish':
      out += drawBox(cam, box(0, 1, 0.5), { color: dark, crisp: true, stroke: 'none' });
      out += drawBox(cam, { x: o.x + o.w / 2 - 0.4, y: o.y + o.d / 2 - 0.4, w: 0.8, d: 0.8, rot: 0, z0: z + 1, z1: z + o.h * 0.55 }, { color: metal, crisp: true, stroke: 'none' });
      out += sphere(cam, o.x + o.w / 2, o.y + o.d / 2, z + o.h, o.w * 0.45, o.d * 0.45, {
        fill: night ? '#4b525c' : '#e4e8ec', stroke: 'rgba(20,28,40,.45)', 'stroke-width': 0.6,
      });
      break;
    case 'mast': {
      const cxp = o.x + o.w / 2;
      const cyp = o.y + o.d / 2;
      out += drawBox(cam, box(0, 1.2, 0.8), { color: dark, crisp: true, stroke: 'none' });
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.4;
        out += line(cam, [cxp + Math.cos(a) * o.w * 0.4, cyp + Math.sin(a) * o.d * 0.4, z + 1.2], [cxp, cyp, z + o.h], { stroke: metal, 'stroke-width': 1.1 });
      }
      out += line(cam, [cxp, cyp, z + 1.2], [cxp, cyp, z + o.h], { stroke: mixHex(metal, 0.9), 'stroke-width': 1.6 });
      if (night) out += ellipse(cam, cxp, cyp, 0.9, 0.9, { fill: '#ff6a5a' }, z + o.h);
      break;
    }
    case 'tank': {
      const cxp = o.x + o.w / 2;
      const cyp = o.y + o.d / 2;
      const legTop = z + o.h * 0.35;
      for (const [lx, ly] of corners({ ...o, w: o.w * 0.6, d: o.d * 0.6, x: o.x + o.w * 0.2, y: o.y + o.d * 0.2 })) {
        out += drawBox(cam, { x: lx - 0.5, y: ly - 0.5, w: 1, d: 1, rot: 0, z0: z, z1: legTop }, { color: dark, crisp: true, stroke: 'none' });
      }
      out += cylinder(cam, { x: cxp, y: cyp, r: o.w * 0.42, z0: legTop, z1: z + o.h }, { color: mixHex(metal, 1.02) });
      break;
    }
    case 'bulkhead':
      out += drawBox(cam, box(0, o.h), {
        color: ctx.wall || metal, roof: dark, ao: 1.4, stroke: 'rgba(20,28,40,.4)',
        decorate: (f) => (f.id === 'N'
          ? f.quad(f.len * 0.32, f.len * 0.68, 0, Math.min(7, o.h - 1), { fill: night ? '#1a212c' : '#5c646f', stroke: 'none' })
          : ''),
      });
      break;
    case 'duct': {
      out += drawBox(cam, box(0, 1, 0.3), { color: dark, crisp: true, stroke: 'none' });
      out += drawBox(cam, box(1, o.h), {
        color: mixHex(metal, 1.04), roof: mixHex(metal, 1.14), stroke: 'rgba(20,28,40,.35)',
        decorate: (f) => {
          if (!detail || f.len < o.d + 1) return '';
          let q = '';
          for (let t = 2; t < f.len - 1; t += 4) q += f.quad(t, t + 0.5, 0, f.height, { fill: 'rgba(20,28,40,.18)', stroke: 'none' });
          return q;
        },
      });
      break;
    }
    case 'pipes': {
      const c = corners(o);
      const p = (fx, fy, h) => [
        c[0][0] + (c[1][0] - c[0][0]) * fx + (c[3][0] - c[0][0]) * fy,
        c[0][1] + (c[1][1] - c[0][1]) * fx + (c[3][1] - c[0][1]) * fy,
        z + h,
      ];
      for (let i = 0; i < 4; i++) {
        const fy = 0.2 + i * 0.2;
        out += line(cam, p(0.02, fy, o.h * (0.4 + i * 0.15)), p(0.98, fy, o.h * (0.4 + i * 0.15)), {
          stroke: [metal, dark, mixHex(metal, 0.86), mixHex(metal, 1.1)][i], 'stroke-width': 1.6, 'stroke-linecap': 'round',
        });
      }
      for (const fx of [0.1, 0.5, 0.9]) {
        out += line(cam, p(fx, 0.2, 0), p(fx, 0.8, 0), { stroke: dark, 'stroke-width': 1.2 });
        out += line(cam, p(fx, 0.5, 0), p(fx, 0.5, o.h), { stroke: dark, 'stroke-width': 1.2 });
      }
      break;
    }
    case 'screen': {
      // A louvred screen wall that hides plant behind it.
      const inner = boxAt(o, z, z + o.h * 0.55, 0.62);
      out += drawBox(cam, inner, { color: metal, roof: dark, crisp: true, stroke: 'rgba(20,28,40,.4)' });
      const faces = boxFaces(cam, box(0, o.h));
      for (const f of [...faces].sort((a, b) => a.depth - b.depth)) {
        out += f.quad(0, f.len, 0, f.height, { fill: rgba(night ? '#39414d' : '#aab2bb', 0.82), stroke: 'rgba(20,28,40,.4)', 'stroke-width': 0.5 });
        for (let h = 0.6; h < f.height - 0.3; h += 1.3) {
          out += f.quad(0, f.len, h, h + 0.6, { fill: 'rgba(255,255,255,.16)', stroke: 'none' });
        }
      }
      break;
    }
    default:
      out += drawBox(cam, box(0, o.h), { color: metal, roof: dark });
  }
  return out;
}

/* ------------------------------------------------------------ guard booths */

export function drawBooth(cam, o, ctx) {
  const { night, detail, band = '#16305c' } = ctx;
  const shell = night ? '#39414d' : '#e8ebee';
  const roofC = night ? '#2b313a' : '#cfd4da';
  const glassFill = night ? 'url(#glassLit)' : 'url(#glassDay)';
  const h = o.h;
  const B = (z0, z1, s = 1) => boxAt(o, z0, z1, s);

  const glazeAll = (f) => {
    if (f.id === 'S') return f.quad(f.len / 2 - 1.8, f.len / 2 + 1.8, 0, 6.8, { fill: night ? '#232a33' : '#c4cad1', stroke: 'none' });
    let q = f.quad(1.6, f.len - 1.6, h * 0.34, h * 0.78, { fill: 'rgba(16,24,36,.35)', stroke: 'none' });
    q += f.quad(2, f.len - 2, h * 0.36, h * 0.75, { fill: glassFill, stroke: 'rgba(16,24,36,.5)', 'stroke-width': 0.35 });
    if (detail) {
      q += f.quad(2, f.len - 2, h * 0.32, h * 0.36, { fill: 'rgba(255,255,255,.6)', stroke: 'none' });
      q += f.quad(f.len / 2 - 0.15, f.len / 2 + 0.15, h * 0.36, h * 0.75, { fill: 'rgba(230,236,242,.85)', stroke: 'none' });
    }
    return q;
  };

  let out = '';
  let fasciaBox = null;

  switch (o.art) {
    case 'classic':
      out += drawBox(cam, B(0, 1.1, 1.06), { color: night ? '#3a3f48' : '#b9bec6', stroke: 'rgba(20,28,40,.4)' });
      out += drawBox(cam, B(1.1, h), { color: shell, roof: roofC, ao: 1.6, decorate: glazeAll });
      fasciaBox = B(h - 1.1, h + 2.6, 1.14);
      break;
    case 'canopy':
      out += drawBox(cam, B(0, h), { color: shell, roof: roofC, ao: 1.6, decorate: glazeAll });
      // Wide flat canopy on posts, reaching over the lane.
      out += drawBox(cam, { x: o.x - 3, y: o.y - 16, w: o.w + 6, d: o.d + 22, rot: o.rot, z0: h + 1.4, z1: h + 3 }, {
        color: mixHex(band, night ? 0.6 : 1), roof: mixHex(band, night ? 0.7 : 1.14), stroke: 'rgba(14,20,30,.5)',
      });
      for (const [px, py] of corners({ x: o.x - 2, y: o.y - 15, w: o.w + 4, d: o.d + 20, rot: o.rot })) {
        out += drawBox(cam, { x: px - 0.7, y: py - 0.7, w: 1.4, d: 1.4, rot: 0, z0: 0, z1: h + 1.4 }, { color: night ? '#6b727c' : '#dfe3e8', crisp: true, stroke: 'none' });
      }
      fasciaBox = { x: o.x - 3, y: o.y - 16, w: o.w + 6, d: o.d + 22, rot: o.rot, z0: h + 1.4, z1: h + 3 };
      break;
    case 'brick':
      out += drawBox(cam, B(0, h), {
        color: night ? '#4a3a34' : '#9c5b47', roof: night ? '#2f2724' : '#6d4034', ao: 2,
        decorate: (f) => {
          let q = glazeAll(f);
          if (detail) for (let hh = 1; hh < f.height - 0.5; hh += 1.1) q += f.quad(0, f.len, hh, hh + 0.12, { fill: 'rgba(255,255,255,.12)', stroke: 'none' });
          return q;
        },
      });
      out += gableRoof(cam, { ...B(h, h + 0.4, 1.12) }, { color: night ? '#3a3138' : '#6f5a52', rise: 4.5, along: 'w' });
      fasciaBox = B(h - 2.6, h - 0.2, 1.02);
      break;
    case 'cube':
      out += drawBox(cam, B(0, 1, 1.08), { color: night ? '#333a44' : '#aeb5bd', stroke: 'none' });
      out += drawBox(cam, B(1, h), {
        color: night ? '#2b3746' : '#93b3c9', roof: night ? '#20293a' : '#b9c6d0', ao: 1,
        decorate: (f) => f.quad(0.8, f.len - 0.8, 0.8, f.height - 0.8, { fill: glassFill, stroke: 'rgba(16,24,36,.45)', 'stroke-width': 0.4 }),
      });
      fasciaBox = B(h, h + 2.2, 1.1);
      break;
    case 'container':
      out += drawBox(cam, B(0, 0.8, 0.96), { color: '#2b323d', crisp: true, stroke: 'none' });
      out += drawBox(cam, B(0.8, h), {
        color: night ? '#2f4a52' : '#3e7f8c', roof: night ? '#26383e' : '#356d78', ao: 1.2,
        decorate: (f) => {
          let q = '';
          for (let t = 1.5; t < f.len - 0.5; t += 2.6) q += f.quad(t, t + 1.1, 0, f.height, { fill: 'rgba(255,255,255,.1)', stroke: 'none' });
          q += glazeAll(f);
          return q;
        },
      });
      fasciaBox = B(h - 2.4, h - 0.4, 1.01);
      break;
    case 'twin':
      out += drawBox(cam, B(0, h), { color: shell, roof: roofC, ao: 1.6, decorate: glazeAll });
      out += drawBox(cam, { x: o.x - 4, y: o.y - 5, w: o.w + 8, d: o.d + 10, rot: o.rot, z0: h - 0.6, z1: h + 2.8 }, {
        color: mixHex(band, night ? 0.6 : 1), roof: mixHex(band, night ? 0.7 : 1.14), stroke: 'rgba(14,20,30,.5)',
      });
      fasciaBox = { x: o.x - 4, y: o.y - 5, w: o.w + 8, d: o.d + 10, rot: o.rot, z0: h - 0.6, z1: h + 2.8 };
      break;
    case 'hut':
      out += drawBox(cam, B(0, h), { color: night ? '#4a4237' : '#d8c9a8', roof: '#8d6a4a', ao: 1.4, decorate: glazeAll });
      out += gableRoof(cam, B(h, h + 0.3, 1.18), { color: night ? '#43312a' : '#8d5a45', rise: 5, along: 'd' });
      fasciaBox = B(h - 2.6, h - 0.4, 1.02);
      break;
    case 'tower':
      // A raised cabin on a stair core.
      out += drawBox(cam, B(0, h * 0.52, 0.58), { color: night ? '#333a44' : '#b9bec6', roof: roofC, ao: 1.6 });
      out += drawBox(cam, B(h * 0.52, h), { color: shell, roof: roofC, decorate: glazeAll });
      fasciaBox = B(h, h + 2.4, 1.12);
      break;
    case 'kiosk': {
      const cxp = o.x + o.w / 2;
      const cyp = o.y + o.d / 2;
      out += cylinder(cam, { x: cxp, y: cyp, r: o.w * 0.46, z0: 0, z1: h * 0.34 }, { color: night ? '#3a4049' : '#c3c9d0' });
      out += cylinder(cam, { x: cxp, y: cyp, r: o.w * 0.44, z0: h * 0.34, z1: h * 0.8 }, { color: night ? '#2b3746' : '#8fb2c8' });
      out += cylinder(cam, { x: cxp, y: cyp, r: o.w * 0.52, z0: h * 0.8, z1: h }, { color: mixHex(band, night ? 0.6 : 1) });
      fasciaBox = { x: cxp - o.w * 0.52, y: cyp - o.d * 0.52, w: o.w * 1.04, d: o.d * 1.04, rot: o.rot, z0: h * 0.8, z1: h };
      break;
    }
    case 'office':
      out += drawBox(cam, B(0, h), {
        color: shell, roof: roofC, ao: 2,
        decorate: (f) => {
          let q = glazeAll(f);
          if (f.id === 'N' && detail) q += f.quad(f.len - 6, f.len - 2.4, 0, 7.2, { fill: night ? '#232a33' : '#aeb6bf', stroke: 'none' });
          return q;
        },
      });
      fasciaBox = B(h, h + 3.2, 1.08);
      break;
    default:
      out += drawBox(cam, B(0, h), { color: shell, roof: roofC, decorate: glazeAll });
      fasciaBox = B(h, h + 2.4, 1.1);
  }

  // The fascia sign every booth carries.
  if (fasciaBox) {
    const sg = o.sign || {};
    const capColor = mixHex(band, night ? 0.55 : 1);
    out += drawBox(cam, fasciaBox, { color: capColor, roof: night ? '#1d222a' : '#2b323c', stroke: 'rgba(14,20,30,.5)' });
    const text = `${sg.logo ? sg.logo + '  ' : ''}${sg.text || ''}`.trim();
    if (text) {
      for (const f of boxFaces(cam, fasciaBox)) {
        if (!f.visible) continue;
        const size = clamp((f.len * 0.82) / (0.58 * Math.max(9, text.length)), 0.9, f.height * 0.62);
        out += faceText(f, {
          t: f.len / 2, h: (f.height - size * 0.72) / 2, text, size,
          color: night ? mixHex(sg.color || '#fff', 1.4) : (sg.color || '#fff'), glow: night,
        });
      }
    }
  }
  if (night) out += ellipse(cam, o.x + o.w / 2, o.y + o.d / 2 + 6, 26, 15, { fill: 'url(#pool)' });
  return out;
}

/* ------------------------------------------------------------------- props */

/** The object's local x axis, as a line through its middle. */
function axis(o) {
  const a = (o.rot || 0) * DEG;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const cx = o.x + o.w / 2;
  const cy = o.y + o.d / 2;
  const half = o.w / 2;
  return { cx, cy, ca, sa, p0: [cx - ca * half, cy - sa * half], p1: [cx + ca * half, cy + sa * half] };
}

const wallQuad = (cam, p0, p1, z0, z1, style) =>
  poly(cam, [[p0[0], p0[1], z1], [p1[0], p1[1], z1], [p1[0], p1[1], z0], [p0[0], p0[1], z0]], style);

/** Sign text on every visible face of a panel. */
function panelText(cam, box, sign, ctx, opts = {}) {
  const { night } = ctx;
  const { maxLines = 5, wrapAt = 17, weight = 700 } = opts;
  if (!sign || (!sign.text && !sign.logo)) return '';
  const ink = night ? mixHex(sign.color || '#fff', 1.45) : (sign.color || '#fff');
  const words = String(sign.text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > wrapAt) { lines.push(cur.trim()); cur = w; } else cur += ' ' + w;
  }
  if (cur.trim()) lines.push(cur.trim());
  let out = '';
  for (const f of boxFaces(cam, box)) {
    if (!f.visible || f.len < box.z1 - box.z0) continue;   // the long faces only
    const room = f.height;
    const size = clamp(Math.min((f.len * 0.86) / (0.58 * Math.max(8, Math.max(...lines.map((l) => l.length), 8))), room / (lines.length + (sign.logo ? 2.2 : 0.9))), 0.8, 6);
    let y = room - size * (sign.logo ? 0.6 : 1.1);
    if (sign.logo) {
      y -= size * 1.5;
      out += faceText(f, { t: f.len / 2, h: y, text: sign.logo, size: size * 1.7, color: ink, glow: night });
      y -= size * 0.5;
    }
    for (const ln of lines.slice(0, maxLines)) {
      y -= size * 0.78;
      out += faceText(f, { t: f.len / 2, h: y, text: ln, size, color: ink, glow: night, weight });
      y -= size * 0.42;
    }
  }
  return out;
}

export function drawProp(cam, o, ctx) {
  const { night, detail, pal } = ctx;
  const h = o.h;
  const B = (z0, z1, s = 1) => boxAt(o, z0, z1, s);
  const ax = axis(o);
  const metal = night ? '#3a4049' : '#98a0ab';
  let out = '';

  switch (o.art) {
    /* ---- boundary ---- */
    case 'fence': {
      const n = Math.max(1, Math.round(o.w / 10));
      for (let i = 0; i < n; i++) {
        const a = [ax.p0[0] + (ax.p1[0] - ax.p0[0]) * (i / n), ax.p0[1] + (ax.p1[1] - ax.p0[1]) * (i / n)];
        const b = [ax.p0[0] + (ax.p1[0] - ax.p0[0]) * ((i + 1) / n), ax.p0[1] + (ax.p1[1] - ax.p0[1]) * ((i + 1) / n)];
        out += wallQuad(cam, a, b, 0, h, { fill: 'url(#mesh)', stroke: 'none' });
        out += line(cam, [a[0], a[1], h - 0.2], [b[0], b[1], h - 0.2], { stroke: night ? '#20242c' : '#2f343c', 'stroke-width': 1.4 });
        out += line(cam, [a[0], a[1], h * 0.5], [b[0], b[1], h * 0.5], { stroke: rgba('#2f343c', 0.5), 'stroke-width': 0.9 });
      }
      for (let i = 0; i <= n; i++) {
        const p = [ax.p0[0] + (ax.p1[0] - ax.p0[0]) * (i / n), ax.p0[1] + (ax.p1[1] - ax.p0[1]) * (i / n)];
        out += drawBox(cam, { x: p[0] - 0.35, y: p[1] - 0.35, w: 0.7, d: 0.7, rot: 0, z0: 0, z1: h + 0.6 }, { color: night ? '#20242c' : '#2f343c', crisp: true, stroke: 'none' });
      }
      break;
    }
    case 'wall':
      out += drawBox(cam, B(0, h), { color: night ? '#4a4038' : '#b3a595', roof: night ? '#5a5048' : '#cabfaf', ao: 1.4 });
      break;
    case 'guardrail':
      out += wallQuad(cam, ax.p0, ax.p1, h * 0.55, h, { fill: night ? '#5a626c' : '#c6ccd3', stroke: 'rgba(20,28,40,.4)', 'stroke-width': 0.4 });
      for (let i = 0; i <= Math.round(o.w / 8); i++) {
        const p = [ax.p0[0] + (ax.p1[0] - ax.p0[0]) * (i / Math.round(o.w / 8)), ax.p0[1] + (ax.p1[1] - ax.p0[1]) * (i / Math.round(o.w / 8))];
        out += drawBox(cam, { x: p[0] - 0.3, y: p[1] - 0.3, w: 0.6, d: 0.6, rot: 0, z0: 0, z1: h }, { color: metal, crisp: true, stroke: 'none' });
      }
      break;
    case 'gate': {
      out += drawBox(cam, { x: ax.p0[0] - 1.4, y: ax.p0[1] - 1.4, w: 2.8, d: 2.8, rot: o.rot, z0: 0, z1: h }, {
        color: night ? '#8a9099' : '#e6e9ec', roof: night ? '#9aa0a8' : '#f2f4f6', stroke: 'rgba(20,28,40,.45)',
      });
      const seg = 10;
      for (let i = 0; i < seg; i++) {
        const t0 = i / seg;
        const t1 = (i + 0.92) / seg;
        const a = [ax.p0[0] + (ax.p1[0] - ax.p0[0]) * t0, ax.p0[1] + (ax.p1[1] - ax.p0[1]) * t0];
        const b = [ax.p0[0] + (ax.p1[0] - ax.p0[0]) * t1, ax.p0[1] + (ax.p1[1] - ax.p0[1]) * t1];
        const z = h * 0.78 + i * 0.28;
        out += wallQuad(cam, a, b, z, z + 0.8, { fill: i % 2 ? '#c0392b' : '#f4f6f8', stroke: 'rgba(20,28,40,.35)', 'stroke-width': 0.3 });
      }
      break;
    }
    case 'bollard':
      out += cylinder(cam, { x: ax.cx, y: ax.cy, r: 0.75, z0: 0, z1: h }, { color: night ? '#8d7422' : '#e5aa1f' });
      out += cylinder(cam, { x: ax.cx, y: ax.cy, r: 0.8, z0: h * 0.7, z1: h * 0.82 }, { color: night ? '#c9cdd2' : '#f2f4f6' });
      break;
    case 'barrier':
      out += drawBox(cam, B(0, h * 0.35), { color: night ? '#565c64' : '#c9ced5', stroke: 'rgba(20,28,40,.4)' });
      out += drawBox(cam, B(h * 0.35, h, 0.68), { color: night ? '#5e646d' : '#d3d8de', roof: night ? '#6b717a' : '#e0e4e9', stroke: 'rgba(20,28,40,.4)' });
      break;
    case 'cone':
      out += drawBox(cam, B(0, 0.3, 1), { color: '#c8410f', crisp: true, stroke: 'none' });
      out += cylinder(cam, { x: ax.cx, y: ax.cy, r: 0.55, z0: 0.3, z1: h * 0.6 }, { color: '#e2530f' });
      out += cylinder(cam, { x: ax.cx, y: ax.cy, r: 0.3, z0: h * 0.6, z1: h }, { color: '#e2530f' });
      out += cylinder(cam, { x: ax.cx, y: ax.cy, r: 0.45, z0: h * 0.52, z1: h * 0.64 }, { color: '#f0f2f4' });
      break;

    /* ---- signs ---- */
    case 'monument': {
      const base = { x: o.x, y: o.y, w: o.w, d: o.d + 2.4, rot: o.rot, z0: 0, z1: h * 0.2 };
      const panel = { x: o.x + o.w * 0.06, y: o.y, w: o.w * 0.88, d: o.d, rot: o.rot, z0: h * 0.2, z1: h };
      const shellC = mixHex((o.sign && o.sign.color) === '#ffffff' ? '#16305c' : ((o.sign && o.sign.color) || '#16305c'), night ? 0.5 : 0.82);
      out += drawBox(cam, base, { color: night ? '#3c4149' : '#9aa1aa', roof: night ? '#4a5058' : '#b4bac1', ao: 1 });
      out += drawBox(cam, panel, { color: shellC, roof: mixHex(shellC, 1.2), ao: 1.2 });
      if (detail) {
        for (const f of boxFaces(cam, panel)) {
          if (f.visible && f.len > panel.z1 - panel.z0) {
            out += f.quad(1, f.len - 1, 0.8, f.height - 0.8, { fill: 'rgba(255,255,255,.08)', stroke: 'rgba(255,255,255,.32)', 'stroke-width': 0.3 });
          }
        }
      }
      out += panelText(cam, panel, o.sign, ctx);
      if (night) out += ellipse(cam, ax.cx, ax.cy, 13, 8, { fill: 'url(#pool)' });
      break;
    }
    case 'pylon': {
      const post = { x: ax.cx - 1.6, y: ax.cy - 1.6, w: 3.2, d: 3.2, rot: o.rot, z0: 0, z1: h * 0.62 };
      const panel = { x: o.x, y: o.y, w: o.w, d: o.d, rot: o.rot, z0: h * 0.55, z1: h };
      out += drawBox(cam, post, { color: night ? '#3c4149' : '#8f97a1', ao: 1.2 });
      const shellC = mixHex((o.sign && o.sign.color) === '#ffffff' ? '#16305c' : ((o.sign && o.sign.color) || '#16305c'), night ? 0.5 : 0.82);
      out += drawBox(cam, panel, { color: shellC, roof: mixHex(shellC, 1.2) });
      out += panelText(cam, panel, o.sign, ctx, { wrapAt: 12 });
      break;
    }
    case 'postsign': {
      const panel = { x: o.x, y: o.y, w: o.w, d: 0.5, rot: o.rot, z0: h * 0.42, z1: h };
      for (const t of [0.22, 0.78]) {
        const p = [ax.p0[0] + (ax.p1[0] - ax.p0[0]) * t, ax.p0[1] + (ax.p1[1] - ax.p0[1]) * t];
        out += drawBox(cam, { x: p[0] - 0.3, y: p[1] - 0.3, w: 0.6, d: 0.6, rot: 0, z0: 0, z1: h * 0.5 }, { color: metal, crisp: true, stroke: 'none' });
      }
      const shellC = mixHex((o.sign && o.sign.color) === '#ffffff' ? '#16305c' : ((o.sign && o.sign.color) || '#16305c'), night ? 0.5 : 0.9);
      out += drawBox(cam, panel, { color: shellC, roof: mixHex(shellC, 1.15) });
      out += panelText(cam, panel, o.sign, ctx, { wrapAt: 14, maxLines: 3 });
      break;
    }
    case 'stopsign': {
      const panel = { x: ax.cx - o.w / 2, y: ax.cy - 0.25, w: o.w, d: 0.5, rot: o.rot, z0: h * 0.55, z1: h };
      out += drawBox(cam, { x: ax.cx - 0.25, y: ax.cy - 0.25, w: 0.5, d: 0.5, rot: 0, z0: 0, z1: h }, { color: metal, crisp: true, stroke: 'none' });
      out += drawBox(cam, panel, { color: night ? '#7d2a22' : '#c0392b', roof: '#8e2f24', crisp: true });
      for (const f of boxFaces(cam, panel)) {
        if (f.visible && f.len > 1) {
          out += faceText(f, { t: f.len / 2, h: f.height * 0.32, text: 'STOP', size: f.height * 0.42, color: '#fff', weight: 800 });
        }
      }
      break;
    }
    case 'flag': {
      out += drawBox(cam, { x: ax.cx - 1.2, y: ax.cy - 1.2, w: 2.4, d: 2.4, rot: 0, z0: 0, z1: 1.4 }, { color: night ? '#3c4149' : '#b9bec6', crisp: true, stroke: 'none' });
      out += cylinder(cam, { x: ax.cx, y: ax.cy, r: 0.32, z0: 1.4, z1: h }, { color: night ? '#6f757e' : '#e2e6ea' });
      const fl = { x: ax.cx, y: ax.cy - 0.15, w: 9, d: 0.3, rot: o.rot, z0: h - 7, z1: h - 1.4 };
      out += drawBox(cam, fl, { color: (o.sign && o.sign.color) || '#1f4f9c', crisp: true, stroke: 'rgba(20,28,40,.3)' });
      break;
    }

    /* ---- lighting ---- */
    case 'pole':
      if (night) out += ellipse(cam, ax.cx, ax.cy + 4, 34, 19, { fill: 'url(#pool)' });
      out += drawBox(cam, { x: ax.cx - 1.3, y: ax.cy - 1.3, w: 2.6, d: 2.6, rot: o.rot, z0: 0, z1: 2.2 }, { color: night ? '#2a2f37' : '#8d939b', crisp: true, stroke: 'none' });
      out += cylinder(cam, { x: ax.cx, y: ax.cy, r: 0.55, z0: 2.2, z1: h }, { color: night ? '#333a44' : '#767d86' });
      out += drawBox(cam, { x: ax.cx - 0.5, y: ax.cy + 0.5, w: 1, d: 4.5, rot: o.rot, z0: h - 0.8, z1: h }, { color: night ? '#333a44' : '#767d86', crisp: true, stroke: 'none' });
      out += drawBox(cam, { x: ax.cx - 2.2, y: ax.cy + 3.6, w: 4.4, d: 3.4, rot: o.rot, z0: h - 1.8, z1: h - 0.6 }, {
        color: night ? '#ffe6ad' : '#6f767f', roof: night ? '#4a4f58' : '#878e97', crisp: true, stroke: 'none',
      });
      if (night) out += `<g filter="url(#lampGlow)">${ellipse(cam, ax.cx, ax.cy + 5.3, 3.4, 2, { fill: '#fff0c8' }, h - 1.7)}</g>`;
      break;
    case 'floodmast': {
      if (night) out += ellipse(cam, ax.cx, ax.cy, 60, 34, { fill: 'url(#pool)' });
      out += drawBox(cam, { x: ax.cx - 2, y: ax.cy - 2, w: 4, d: 4, rot: 0, z0: 0, z1: 3 }, { color: night ? '#2a2f37' : '#8d939b', crisp: true, stroke: 'none' });
      out += cylinder(cam, { x: ax.cx, y: ax.cy, r: 0.8, z0: 3, z1: h }, { color: night ? '#333a44' : '#767d86' });
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        out += drawBox(cam, { x: ax.cx + Math.cos(a) * 3 - 1.4, y: ax.cy + Math.sin(a) * 3 - 1, w: 2.8, d: 2, rot: o.rot, z0: h - 3, z1: h - 1 }, {
          color: night ? '#ffe6ad' : '#5e646d', crisp: true, stroke: 'none',
        });
      }
      if (night) out += `<g filter="url(#lampGlow)">${ellipse(cam, ax.cx, ax.cy, 5, 3, { fill: '#fff0c8' }, h - 2)}</g>`;
      break;
    }
    case 'bollardlight':
      out += cylinder(cam, { x: ax.cx, y: ax.cy, r: 0.7, z0: 0, z1: h }, { color: night ? '#2f353d' : '#7f868f' });
      out += cylinder(cam, { x: ax.cx, y: ax.cy, r: 0.75, z0: h - 0.9, z1: h - 0.2 }, { color: night ? '#ffe6ad' : '#e4e8ec' });
      if (night) out += ellipse(cam, ax.cx, ax.cy, 9, 5, { fill: 'url(#pool)' });
      break;

    /* ---- planting ---- */
    case 'tree': {
      const r = rand(o.seedn || 4);
      const sc = o.w / 18;
      out += cylinder(cam, { x: ax.cx, y: ax.cy, r: 0.85 * sc, z0: 0, z1: h * 0.42 }, { color: pal.trunk });
      for (const [dx, dy, rx, ry, fill] of [
        [0, 0, 9, 7, pal.leaf], [-3.2, -1.6, 6.4, 4.8, pal.leafHi], [3.4, 1.8, 5.6, 4.2, mixHex(pal.leaf, 0.86)],
      ]) {
        out += sphere(cam, ax.cx + dx * sc, ax.cy + dy * sc, h * 0.42 + (5.5 + r() * 0.8) * sc, rx * sc, ry * sc * 1.15, {
          fill, stroke: 'rgba(16,34,20,.35)', 'stroke-width': 0.6,
        });
      }
      break;
    }
    case 'conifer': {
      const sc = o.w / 12;
      out += cylinder(cam, { x: ax.cx, y: ax.cy, r: 0.7 * sc, z0: 0, z1: h * 0.2 }, { color: pal.trunk });
      for (let i = 0; i < 4; i++) {
        const z = h * (0.16 + i * 0.2);
        const rr = (5.5 - i * 1.1) * sc;
        out += sphere(cam, ax.cx, ax.cy, z + rr * 0.9, rr, rr * 0.95, {
          fill: i % 2 ? pal.leafHi : pal.leaf, stroke: 'rgba(16,34,20,.3)', 'stroke-width': 0.5,
        });
      }
      break;
    }
    case 'shrub':
      out += sphere(cam, ax.cx, ax.cy, h * 0.62, o.w * 0.5, o.d * 0.46, { fill: pal.leafHi, stroke: 'rgba(16,34,20,.3)', 'stroke-width': 0.5 });
      out += sphere(cam, ax.cx - o.w * 0.16, ax.cy + o.d * 0.1, h * 0.82, o.w * 0.3, o.d * 0.28, { fill: mixHex(pal.leafHi, 1.12), stroke: 'none' });
      break;
    case 'hedge':
      out += drawBox(cam, B(0, h), { color: pal.leaf, roof: pal.leafHi, stroke: 'rgba(16,34,20,.35)' });
      break;
    case 'planter':
      out += drawBox(cam, B(0, h * 0.75), { color: night ? '#4a4139' : '#b8ac9b', roof: night ? '#2f2a24' : '#6f6558', ao: 0.8 });
      out += sphere(cam, ax.cx, ax.cy, h * 0.95, o.w * 0.36, o.d * 0.32, { fill: pal.leafHi, stroke: 'none' });
      break;

    /* ---- yard ---- */
    case 'dumpster':
      out += drawBox(cam, B(0, h * 0.82), { color: night ? '#2f4a52' : '#3e7f8c', roof: night ? '#26383e' : '#356d78', ao: 1 });
      out += drawBox(cam, { ...B(h * 0.82, h, 1.04), }, { color: night ? '#26383e' : '#2f5f69', crisp: true, stroke: 'none' });
      break;
    case 'container':
      out += drawBox(cam, B(0, h), {
        color: o.color || (night ? '#5a3a34' : '#a8503f'),
        roof: mixHex(o.color || '#a8503f', night ? 0.7 : 1.08), ao: 1,
        decorate: (f) => {
          let q = '';
          if (detail) for (let t = 1.5; t < f.len - 0.5; t += 2.4) q += f.quad(t, t + 1.1, 0.4, f.height - 0.4, { fill: 'rgba(255,255,255,.09)', stroke: 'none' });
          if (f.len < o.w * 0.6) q += f.quad(0.5, f.len - 0.5, 0.4, f.height - 0.4, { fill: 'rgba(20,28,40,.22)', stroke: 'none' });
          return q;
        },
      });
      break;
    case 'generator':
      out += drawBox(cam, B(0, 0.8, 1.02), { color: '#2b323d', crisp: true, stroke: 'none' });
      out += drawBox(cam, B(0.8, h), {
        color: night ? '#37424e' : '#5f6a76', roof: night ? '#2c343d' : '#6f7a86', ao: 1,
        decorate: (f) => {
          let q = '';
          for (let hh = 1; hh < f.height - 1; hh += 0.9) q += f.quad(1, f.len - 1, hh, hh + 0.4, { fill: 'rgba(255,255,255,.14)', stroke: 'none' });
          return q;
        },
      });
      out += cylinder(cam, { x: o.x + o.w * 0.15, y: o.y + o.d * 0.5, r: 0.5, z0: h, z1: h + 3 }, { color: '#2f353d' });
      break;
    case 'transformer':
      out += drawBox(cam, B(0, 0.6, 1.06), { color: '#454b54', crisp: true, stroke: 'none' });
      out += drawBox(cam, B(0.6, h * 0.85), { color: night ? '#3f4a44' : '#7d8a80', roof: night ? '#333c37' : '#8d998f', ao: 1 });
      for (const fx of [0.3, 0.5, 0.7]) {
        out += cylinder(cam, { x: o.x + o.w * fx, y: o.y + o.d * 0.5, r: 0.5, z0: h * 0.85, z1: h }, { color: night ? '#5a5f66' : '#d8dce0' });
      }
      break;
    case 'silo': {
      out += cylinder(cam, { x: ax.cx, y: ax.cy, r: o.w * 0.45, z0: 0, z1: h * 0.82 }, { color: night ? '#585f68' : '#cfd5db' });
      out += cylinder(cam, { x: ax.cx, y: ax.cy, r: o.w * 0.3, z0: h * 0.82, z1: h }, { color: night ? '#4b525a' : '#b6bdc4' });
      if (detail) {
        for (let z = 6; z < h * 0.8; z += 8) {
          out += ellipse(cam, ax.cx, ax.cy, o.w * 0.45, o.w * 0.45, { fill: 'none', stroke: 'rgba(20,28,40,.18)', 'stroke-width': 0.8 }, z);
        }
      }
      break;
    }
    case 'pallets': {
      const r = rand(o.seedn || 9);
      for (let i = 0; i < 4; i++) {
        out += drawBox(cam, { x: o.x + r() * 0.6, y: o.y + r() * 0.6, w: o.w - 1, d: o.d - 1, rot: o.rot, z0: i * (h / 4), z1: (i + 0.86) * (h / 4) }, {
          color: i % 2 ? (night ? '#6a533a' : '#c49a68') : (night ? '#5d4a34' : '#b08c5e'), crisp: true, stroke: 'rgba(20,28,40,.35)',
        });
      }
      break;
    }
    case 'canopy': {
      for (const [px, py] of corners({ x: o.x + 1.5, y: o.y + 1.5, w: o.w - 3, d: o.d - 3, rot: o.rot })) {
        out += drawBox(cam, { x: px - 0.8, y: py - 0.8, w: 1.6, d: 1.6, rot: 0, z0: 0, z1: h - 1.6 }, { color: night ? '#5a626c' : '#c8ced5', crisp: true, stroke: 'none' });
      }
      out += drawBox(cam, B(h - 1.6, h), { color: night ? '#39414d' : '#dfe3e8', roof: night ? '#454d59' : '#eef1f4', stroke: 'rgba(14,20,30,.45)' });
      break;
    }
    case 'bikerack':
      for (let i = 0; i < 4; i++) {
        const t = 0.12 + i * 0.25;
        const p = [ax.p0[0] + (ax.p1[0] - ax.p0[0]) * t, ax.p0[1] + (ax.p1[1] - ax.p0[1]) * t];
        out += drawBox(cam, { x: p[0] - 0.2, y: p[1] - o.d / 2, w: 0.4, d: o.d, rot: o.rot, z0: h * 0.6, z1: h }, { color: metal, crisp: true, stroke: 'none' });
        out += drawBox(cam, { x: p[0] - 0.2, y: p[1] - o.d / 2, w: 0.4, d: 0.4, rot: o.rot, z0: 0, z1: h }, { color: metal, crisp: true, stroke: 'none' });
        out += drawBox(cam, { x: p[0] - 0.2, y: p[1] + o.d / 2 - 0.4, w: 0.4, d: 0.4, rot: o.rot, z0: 0, z1: h }, { color: metal, crisp: true, stroke: 'none' });
      }
      break;
    case 'bench':
      out += drawBox(cam, B(h * 0.5, h * 0.68), { color: night ? '#5d4a34' : '#b98f5e', crisp: true, stroke: 'rgba(20,28,40,.3)' });
      out += drawBox(cam, { x: o.x, y: o.y + o.d - 0.5, w: o.w, d: 0.5, rot: o.rot, z0: h * 0.68, z1: h }, { color: night ? '#5d4a34' : '#b98f5e', crisp: true, stroke: 'none' });
      for (const t of [0.12, 0.88]) {
        const p = [ax.p0[0] + (ax.p1[0] - ax.p0[0]) * t, ax.p0[1] + (ax.p1[1] - ax.p0[1]) * t];
        out += drawBox(cam, { x: p[0] - 0.25, y: p[1] - 0.25, w: 0.5, d: 0.5, rot: 0, z0: 0, z1: h * 0.5 }, { color: metal, crisp: true, stroke: 'none' });
      }
      break;
    case 'picnic':
      out += drawBox(cam, { x: o.x, y: o.y + o.d * 0.3, w: o.w, d: o.d * 0.4, rot: o.rot, z0: h * 0.7, z1: h * 0.82 }, { color: night ? '#5d4a34' : '#b98f5e', crisp: true, stroke: 'rgba(20,28,40,.3)' });
      for (const fy of [0.06, 0.78]) {
        out += drawBox(cam, { x: o.x, y: o.y + o.d * fy, w: o.w, d: o.d * 0.16, rot: o.rot, z0: h * 0.42, z1: h * 0.52 }, { color: night ? '#54432f' : '#a67f52', crisp: true, stroke: 'none' });
      }
      break;

    /* ---- vehicles ---- */
    case 'trailer': {
      const body = { x: o.x, y: o.y, w: o.w, d: o.d, rot: o.rot, z0: 4.4, z1: h };
      out += drawBox(cam, body, {
        color: o.color || (night ? '#8f959e' : '#eef1f4'),
        roof: mixHex(o.color || '#eef1f4', night ? 0.82 : 0.95),
        stroke: 'rgba(20,28,40,.4)',
        decorate: (f) => {
          let q = '';
          if (detail && f.len > o.w + 1) for (let t = 3; t < f.len - 1; t += 4) q += f.quad(t, t + 0.3, 0, f.height, { fill: 'rgba(255,255,255,.13)', stroke: 'none' });
          if (f.id === 'N') {
            q += f.quad(0.6, f.len - 0.6, 0.4, f.height - 0.6, { fill: night ? '#7b818a' : '#e2e6ea', stroke: 'rgba(20,28,40,.35)', 'stroke-width': 0.3 });
            q += f.quad(f.len / 2 - 0.15, f.len / 2 + 0.15, 0.4, f.height - 0.6, { fill: 'rgba(20,28,40,.4)', stroke: 'none' });
          }
          return q;
        },
      });
      out += drawBox(cam, { x: o.x + 0.6, y: o.y + 1, w: o.w - 1.2, d: o.d - 2, rot: o.rot, z0: 3.5, z1: 4.4 }, { color: '#2b323d', crisp: true, stroke: 'none' });
      const wheelAt = (fy) => {
        const c = corners({ x: o.x, y: o.y + o.d * fy, w: o.w + 0.6, d: 3, rot: o.rot });
        const mx = (c[0][0] + c[2][0]) / 2;
        const my = (c[0][1] + c[2][1]) / 2;
        return drawBox(cam, { x: mx - (o.w + 0.6) / 2, y: my - 1.5, w: o.w + 0.6, d: 3, rot: o.rot, z0: 0, z1: 3.5 }, { color: '#171b22', crisp: true, stroke: 'none' });
      };
      out += wheelAt(0.08) + wheelAt(0.17);
      out += drawBox(cam, { x: o.x + 1.5, y: o.y + o.d * 0.72, w: o.w - 3, d: 1.6, rot: o.rot, z0: 0, z1: 3.5 }, { color: '#39414d', crisp: true, stroke: 'none' });
      break;
    }
    case 'tractor': {
      const col = o.color || '#2c4a7c';
      out += drawBox(cam, { x: o.x + 0.4, y: o.y + 1, w: o.w - 0.8, d: o.d - 2, rot: o.rot, z0: 2.6, z1: 4 }, { color: '#2b323d', crisp: true, stroke: 'none' });
      out += drawBox(cam, { x: o.x, y: o.y + o.d * 0.42, w: o.w, d: o.d * 0.5, rot: o.rot, z0: 4, z1: h }, {
        color: col, roof: mixHex(col, 1.2), stroke: 'rgba(20,28,40,.45)',
        decorate: (f) => (f.id === 'N' ? f.quad(1, f.len - 1, h * 0.42, h * 0.66, { fill: night ? '#1b2534' : '#8fb0c8', stroke: 'none' }) : ''),
      });
      out += drawBox(cam, { x: o.x + 0.6, y: o.y, w: o.w - 1.2, d: o.d * 0.42, rot: o.rot, z0: 4, z1: 9.4 }, { color: mixHex(col, 0.92), roof: mixHex(col, 1.05), stroke: 'rgba(20,28,40,.45)' });
      for (const fy of [0.06, 0.55, 0.72]) {
        out += drawBox(cam, { x: o.x - 0.3, y: o.y + o.d * fy, w: o.w + 0.6, d: 3, rot: o.rot, z0: 0, z1: 3.4 }, { color: '#171b22', crisp: true, stroke: 'none' });
      }
      if (night) out += ellipse(cam, ax.cx, o.y - 2, 9, 5, { fill: 'url(#pool)' });
      break;
    }
    case 'boxtruck': {
      const col = o.color || '#e8ebee';
      out += drawBox(cam, { x: o.x, y: o.y, w: o.w, d: o.d * 0.72, rot: o.rot, z0: 3.4, z1: h }, {
        color: col, roof: mixHex(col, 0.94), stroke: 'rgba(20,28,40,.4)',
        decorate: (f) => (f.id === 'N' ? f.quad(0.7, f.len - 0.7, 0.5, f.height - 0.7, { fill: mixHex(col, 0.9), stroke: 'none' }) : ''),
      });
      out += drawBox(cam, { x: o.x + 0.4, y: o.y + o.d * 0.72, w: o.w - 0.8, d: o.d * 0.28, rot: o.rot, z0: 2.4, z1: 8.6 }, {
        color: mixHex(col, 0.86), roof: mixHex(col, 1.02), stroke: 'rgba(20,28,40,.45)',
        decorate: (f) => f.quad(0.8, f.len - 0.8, 3, 5.4, { fill: night ? '#1b2534' : '#8fb0c8', stroke: 'none' }),
      });
      for (const fy of [0.82, 0.16]) {
        out += drawBox(cam, { x: o.x - 0.25, y: o.y + o.d * fy, w: o.w + 0.5, d: 2.6, rot: o.rot, z0: 0, z1: 2.9 }, { color: '#171b22', crisp: true, stroke: 'none' });
      }
      break;
    }
    case 'van': {
      const col = o.color || '#dfe3e8';
      out += drawBox(cam, { x: o.x, y: o.y, w: o.w, d: o.d, rot: o.rot, z0: 1.3, z1: h }, {
        color: col, roof: mixHex(col, 1.06), stroke: 'rgba(20,28,40,.45)',
        decorate: (f) => (f.len > o.w + 1
          ? f.quad(f.len * 0.6, f.len - 1, f.height * 0.45, f.height - 0.8, { fill: night ? '#1b2534' : 'url(#glassDay)', stroke: 'none' })
          : f.quad(0.8, f.len - 0.8, f.height * 0.45, f.height - 0.8, { fill: night ? '#1b2534' : 'url(#glassDay)', stroke: 'none' })),
      });
      for (const fy of [0.12, 0.72]) {
        out += drawBox(cam, { x: o.x - 0.2, y: o.y + o.d * fy, w: o.w + 0.4, d: 2.2, rot: o.rot, z0: 0, z1: 1.7 }, { color: '#15181e', crisp: true, stroke: 'none' });
      }
      break;
    }
    case 'car': {
      const col = o.color || '#c8ccd2';
      for (const fy of [0.14, 0.68]) {
        out += drawBox(cam, { x: o.x - 0.15, y: o.y + o.d * fy, w: o.w + 0.3, d: 2.2, rot: o.rot, z0: 0.15, z1: 1.5 }, { color: '#15181e', crisp: true, stroke: 'none' });
      }
      out += drawBox(cam, { x: o.x + 0.35, y: o.y + 0.5, w: o.w - 0.7, d: o.d - 1, rot: o.rot, z0: 1.15, z1: 3.9 }, {
        color: col, roof: mixHex(col, 1.1), stroke: 'rgba(16,22,32,.55)',
        decorate: (f) => (detail && f.len > o.w + 1 ? f.quad(1.5, f.len - 1.5, f.height - 1.1, f.height - 0.5, { fill: 'rgba(255,255,255,.22)', stroke: 'none' }) : ''),
      });
      out += drawBox(cam, { x: o.x + 0.75, y: o.y + o.d * 0.26, w: o.w - 1.5, d: o.d * 0.44, rot: o.rot, z0: 3.9, z1: h }, {
        color: night ? '#1c2634' : mixHex(col, 0.8), roof: mixHex(col, 1.06), stroke: 'rgba(16,22,32,.5)',
        decorate: (f) => f.quad(0.3, f.len - 0.3, 0.2, f.height - 0.3, { fill: night ? '#141c28' : 'url(#glassDay)', stroke: 'none' }),
      });
      if (night) out += ellipse(cam, ax.cx, o.y - 1, 5, 2.6, { fill: 'rgba(255,236,190,.16)' });
      break;
    }
    case 'forklift':
      out += drawBox(cam, { x: o.x, y: o.y + o.d * 0.3, w: o.w, d: o.d * 0.6, rot: o.rot, z0: 1, z1: 4.2 }, { color: '#d8a012', roof: '#e8b52c', stroke: 'rgba(20,28,40,.45)' });
      out += drawBox(cam, { x: o.x + 0.6, y: o.y + o.d * 0.35, w: o.w - 1.2, d: o.d * 0.3, rot: o.rot, z0: 4.2, z1: h }, { color: '#2b323d', crisp: true, stroke: 'none' });
      out += drawBox(cam, { x: o.x + 0.8, y: o.y, w: 0.6, d: 0.6, rot: o.rot, z0: 0, z1: h * 0.9 }, { color: '#4a515c', crisp: true, stroke: 'none' });
      out += drawBox(cam, { x: o.x + o.w - 1.4, y: o.y, w: 0.6, d: 0.6, rot: o.rot, z0: 0, z1: h * 0.9 }, { color: '#4a515c', crisp: true, stroke: 'none' });
      for (const fy of [0.28, 0.72]) {
        out += drawBox(cam, { x: o.x - 0.2, y: o.y + o.d * fy, w: o.w + 0.4, d: 1.8, rot: o.rot, z0: 0, z1: 1.6 }, { color: '#15181e', crisp: true, stroke: 'none' });
      }
      break;

    default:
      out += drawBox(cam, B(0, h), { color: '#9aa1aa' });
  }
  return out;
}
