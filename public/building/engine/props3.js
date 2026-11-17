/* Construction props: the signs round the works, temporary fencing and
 * barriers, and the materials stacked on a site. Same contract as the other
 * prop builders — (B, o, { w, d, h }, ctx), in the prop's own frame, x across,
 * y up, z toward its front, standing on y = 0. */

import * as THREE from 'three';
import { cylGeo } from './builder.js';
import * as M from './materials.js';
import { rng, signTexture, safetyTexture } from './textures.js';

const PI = Math.PI;

const steel = (r = 0.5) => M.metal('#9aa1a8', r);
const galv = () => M.metal('#b9bfc4', 0.45);
const orange = () => M.painted('#e2601c', 0.5);
const white = () => M.painted('#f1f2f0', 0.5);
const lumber = () => M.sheet('timber', '#e0c08a');

/** A face showing a texture, upright, facing +z. */
function signFace(B, tex, w, h, x, y, z, rot = null) {
  const g = new THREE.PlaneGeometry(w, h);
  B.add(g, M.signFace(tex), { pos: [x, y, z], rot });
}

/** A diamond road-works sign on a post. */
function diamond(B, tex, size, y, z = 0) {
  const g = new THREE.PlaneGeometry(size, size).rotateZ(PI / 4);
  B.add(g, M.signFace(tex), { pos: [0, y, z + 0.08] });
  B.box(M.painted('#2b2f36', 0.6), size * 0.74, size * 0.74, 0.12, 0, y, z, [0, 0, PI / 4]);
}

const roadworkTex = (text) => signTexture({ text, color: '#1d1f22', bg: '#e8820f', width: 512, height: 512, weight: 900 });

export const SITE = {
  /* ------------------------------------------------------------- signs */

  projectboard(B, o, { w, d, h }) {
    // A hoarding board naming the job, on timber posts with raking struts.
    const sg = o.sign || {};
    const post = M.wood('#a07a52');
    const face = h * 0.64;
    const top = h - 0.3;
    for (const sx of [-1, 1]) B.box(post, 0.55, h, 0.55, sx * (w / 2 - 1.1), h / 2, 0);
    B.box(M.sheet('plywood', '#dfc896'), w, face, 0.3, 0, top - face / 2, -0.1);
    const bg = sg.bg || o.color || '#1f4f9c';
    B.box(M.painted(bg, 0.45), w - 0.5, face - 0.5, 0.12, 0, top - face / 2, 0.1);
    signFace(B, signTexture({
      text: sg.text || 'NEW DISTRIBUTION CENTRE',
      sub: sg.sub || 'A PROJECT BY NORTHGATE CONSTRUCTION',
      color: sg.color || '#ffffff',
      bg,
      width: 1024,
      height: 420,
    }), w - 1, face - 1.1, 0, top - face / 2, 0.18);
    for (const sx of [-1, 1]) B.tube(post, [sx * (w / 2 - 1.1), h * 0.5, -0.3], [sx * (w / 2 - 1.1), 0.25, -3], 0.28, 5);
  },

  siteboard(B, o, { w, d, h }) {
    // The safety board at the gate: hard hat, hi-vis, boots, no entry.
    const sg = o.sign || {};
    for (const sx of [-1, 1]) B.box(galv(), 0.28, h, 0.28, sx * (w / 2 - 0.5), h / 2, 0);
    const face = h * 0.72;
    const top = h - 0.3;
    B.box(white(), w, face, 0.16, 0, top - face / 2, 0);
    B.box(M.painted('#c0392b', 0.5), w, face * 0.2, 0.2, 0, top - face * 0.1, 0);
    signFace(B, safetyTexture({ head: sg.text || 'SITE SAFETY', text: sg.sub || 'HARD HAT · HI-VIS · BOOTS|REPORT TO SITE OFFICE|NO UNAUTHORISED ENTRY', bg: '#f1f2f0', color: '#1d1f22', aspect: face / w }), w - 0.3, face - 0.2, 0, top - face / 2, 0.11);
  },

  roadsign(B, o, { w, d, h }) {
    const v = o.variant || 'works';
    const words = { works: 'ROAD|WORK|AHEAD', detour: 'DETOUR|➜', closed: 'ROAD|CLOSED', flag: 'FLAGGER|AHEAD' }[v] || 'ROAD|WORK';
    B.box(M.painted('#55585d', 0.5), 0.26, h - 1, 0.26, 0, (h - 1) / 2, 0);
    B.box(M.metal('#8a8f96', 0.5), 1.6, 0.14, 1.6, 0, 0.07, 0);
    diamond(B, roadworkTex(words), w * 0.96, h - w * 0.52);
    for (const sx of [-1, 1]) B.box(orange(), 0.2, 0.9, 0.2, sx * 0.9, 0.45, 0.4);
  },

  arrowboard(B, o, { w, d, h }) {
    // A trailer-mounted arrow board, lamps lit in an arrow.
    const body = M.painted('#e2b31b', 0.45);
    B.box(body, w - 0.6, 1, d - 1.5, 0, 1.5, -0.2);
    for (const sx of [-1, 1]) {
      B.add(cylGeo(1, 1, 0.7, 14).rotateZ(PI / 2), M.tyre(), { pos: [sx * (w / 2 - 0.4), 1, -0.4] });
      B.box(M.metal('#8a8f96', 0.5), 0.35, 1.6, 0.35, sx * (w / 2 - 1), 0.8, d / 2 - 1);
    }
    B.box(M.metal('#8a8f96', 0.5), 0.4, 0.4, d - 1, 0, 1.4, 0.4);
    B.box(M.metal('#8a8f96', 0.5), 0.3, 0.3, 2, 0, 1.3, -d / 2 + 0.4);
    B.box(M.painted('#2b2f36', 0.6), w, h - 3.6, 0.4, 0, h - (h - 3.6) / 2 - 0.2, -0.4);
    // The lamps: a left-pointing arrow of amber bulbs.
    const lamp = M.signal('#ffb01a', 2.4);
    const dull = M.plastic('#5a4a22', 0.5);
    const cols = 15;
    const rows = 5;
    for (let c = 0; c < cols; c++) for (let rI = 0; rI < rows; rI++) {
      const x = -w / 2 + 0.5 + (c * (w - 1)) / (cols - 1);
      const y = h - (h - 3.6) - 0.2 + 0.4 + (rI * (h - 4.4)) / (rows - 1);
      const mid = (rows - 1) / 2;
      const on = (c < 5 && Math.abs(rI - mid) <= c * 0.6) || (c >= 5 && Math.abs(rI - mid) < 0.6);
      B.add(cylGeo(0.17, 0.17, 0.1, 8).rotateX(PI / 2), on ? lamp : dull, { pos: [x, y, -0.18] });
    }
    B.box(M.painted('#55585d', 0.6), 1.2, 1.6, 1.2, w / 2 - 1.2, 2.6, -d / 2 + 1.2);
  },

  /* ----------------------------------------------------- temporary works */

  sitefence(B, o, { w, d, h }, ctx) {
    // Heras fencing: welded mesh panels in rubber feet, with a printed banner.
    const panels = Math.max(1, Math.round(w / 11.5));
    const pw = w / panels;
    const r = rng((ctx && ctx.seed) || 11);
    for (let i = 0; i < panels; i++) {
      const x = -w / 2 + pw * (i + 0.5);
      for (const sx of [-1, 1]) B.box(galv(), 0.12, h, 0.12, x + sx * (pw / 2 - 0.2), h / 2, 0);
      B.box(galv(), pw - 0.4, 0.12, 0.12, x, h - 0.06, 0);
      B.box(galv(), pw - 0.4, 0.12, 0.12, x, 0.3, 0);
      B.quad(M.meshFence(), [x - pw / 2 + 0.2, 0.36, 0], [x + pw / 2 - 0.2, 0.36, 0], [x + pw / 2 - 0.2, h - 0.12, 0], [x - pw / 2 + 0.2, h - 0.12, 0], [0, 0, (pw - 0.4) / 2.5, 0, (pw - 0.4) / 2.5, (h - 0.5) / 2.5, 0, (h - 0.5) / 2.5]);
      B.box(M.rubber(), 1.6, 0.35, 2.6, x, 0.17, 0);
      if (o.banner !== false && r() < 0.5) {
        B.box(M.painted(o.color || '#1f4f9c', 0.5), pw - 0.5, h * 0.4, 0.07, x, h * 0.55, 0.06);
        signFace(B, signTexture({ text: (o.sign && o.sign.text) || 'KEEP OUT', color: '#ffffff', bg: o.color || '#1f4f9c', width: 512, height: 220 }), pw - 0.8, h * 0.34, x, h * 0.55, 0.11);
      }
    }
  },

  hoardingrun(B, o, { w, d, h }) {
    // Solid plywood hoarding on posts, with a painted band along the top.
    const board = M.sheet('plywood', '#dfc896');
    for (let x = -w / 2 + 1; x <= w / 2; x += 8) B.box(M.wood('#a07a52'), 0.5, h, 0.5, x, h / 2, -0.25);
    B.box(board, w, h - 0.4, 0.3, 0, (h - 0.4) / 2 + 0.4, 0);
    B.box(M.painted(o.color || '#1f4f9c', 0.5), w, h * 0.22, 0.36, 0, h - h * 0.11, 0);
    B.box(M.painted(o.color || '#1f4f9c', 0.5), w, 0.5, 0.36, 0, 0.65, 0);
    for (let i = 0; i < Math.floor(w / 26); i++) {
      signFace(B, signTexture({ text: (o.sign && o.sign.text) || 'SAFETY FIRST', color: '#ffffff', bg: o.color || '#1f4f9c', width: 768, height: 256 }), 14, h * 0.2, -w / 2 + 16 + i * 26, h - h * 0.11, 0.19);
    }
    for (let x = -w / 2 + 4; x <= w / 2; x += 16) B.tube(M.wood('#a07a52'), [x, h * 0.6, -0.4], [x, 0.3, -3.4], 0.26, 5);
  },

  barricade(B, o, { w, d, h }) {
    // A Type III barricade: three striped rails with lamps on top.
    for (const sx of [-1, 1]) {
      B.box(white(), 0.4, h, 0.3, sx * (w / 2 - 0.5), h / 2, 0.5, [0.18, 0, 0]);
      B.box(white(), 0.4, h, 0.3, sx * (w / 2 - 0.5), h / 2, -0.5, [-0.18, 0, 0]);
      B.box(M.rubber(), 0.7, 0.3, d, sx * (w / 2 - 0.5), 0.15, 0);
    }
    for (let i = 0; i < 3; i++) {
      const y = h - 0.5 - i * (h / 3.4);
      B.box(white(), w, 0.9, 0.16, 0, y, 0.1);
      // Diagonal stripes, slat by slat, clipped to the rail.
      for (let k = -w / 2; k < w / 2; k += 1.1) {
        const sw = Math.min(0.55, (w / 2 - k) * 0.9);
        if (sw < 0.08) break;
        B.box(orange(), sw, 1.28, 0.03, k + 0.3, y, 0.2, [0, 0, -0.72]);
      }
    }
    for (const sx of [-1, 1]) B.add(cylGeo(0.2, 0.2, 0.25, 10), M.signal('#ffb01a', 2), { pos: [sx * (w / 2 - 0.5), h + 0.2, 0] });
  },

  trenchbox(B, o, { w, d, h }) {
    // An open trench with a shoring box and spoil along one side.
    B.box(M.dirt('#6f5c42'), w, h, d, 0, -h / 2 + 0.1, 0);
    for (const sz of [-1, 1]) {
      B.box(M.painted('#e2b31b', 0.5), w, h - 0.5, 0.5, 0, -(h - 0.5) / 2 + 0.3, sz * (d / 2 - 0.25));
      for (let i = 0; i < 2; i++) B.box(M.metal('#8a8f96', 0.5), w - 1, 0.5, 0.6, 0, -1 - i * 2.2, sz * (d / 2 - 0.25));
    }
    for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) {
      B.add(cylGeo(0.3, 0.3, d - 1.2, 10).rotateX(PI / 2), M.metal('#c9ced3', 0.4), { pos: [sx * (w / 2 - 1.5), -1 - i * 2.2, 0] });
    }
    // Spoil heap and the pipe waiting to go in.
    for (let i = 0; i < 4; i++) B.cone(M.dirt('#7a6448'), 3 + i * 0.2, 2.6, -w / 2 - 3.5, 0, -d / 2 + 4 + i * (d / 4.4), 9);
    B.add(cylGeo(1.2, 1.2, d - 2, 14).rotateX(PI / 2), M.plastic('#2e6f8e', 0.6), { pos: [w / 2 + 3, 1.2, 0] });
    // Guard rail round the open hole.
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) B.box(orange(), 0.2, 3.6, 0.2, sx * (w / 2 - 0.3), 1.8, sz * (d / 2 - 0.3));
    for (const sz of [-1, 1]) for (const y of [1.4, 3.2]) B.box(orange(), w, 0.16, 0.16, 0, y, sz * (d / 2 - 0.3));
  },

  rebarcage(B, o, { w, d, h }) {
    // Bundles of reinforcing bar on bearers, and a made-up cage beside them.
    const bar = M.metal('#9a6a4a', 0.85);
    for (const sz of [-1, 1]) B.box(M.wood('#8a6b4a'), w - 1, 0.5, 0.6, 0, 0.25, sz * (d / 2 - 1.2));
    let y = 0.5;
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 7; i++) {
        B.add(cylGeo(0.14, 0.14, w - 0.5, 7).rotateZ(PI / 2), bar, { pos: [0, y + 0.14, -d / 2 + 1.4 + i * ((d - 2.8) / 6)] });
      }
      y += 0.3;
    }
    for (let i = 0; i < 5; i++) {
      B.add(cylGeo(0.1, 0.1, w - 1, 6).rotateZ(PI / 2), bar, { pos: [0, h - 0.4, -d / 2 + 2 + i * 1.2] });
      B.add(cylGeo(0.1, 0.1, w - 1, 6).rotateZ(PI / 2), bar, { pos: [0, h - 1.8, -d / 2 + 2 + i * 1.2] });
    }
    for (let i = 0; i < 9; i++) {
      const x = -w / 2 + 0.8 + i * ((w - 1.6) / 8);
      B.box(bar, 0.1, 1.5, 0.1, x, h - 1.1, -d / 2 + 2);
      B.box(bar, 0.1, 1.5, 0.1, x, h - 1.1, -d / 2 + 6.8);
      B.add(cylGeo(0.08, 0.08, 5, 6).rotateX(PI / 2), bar, { pos: [x, h - 0.4, -d / 2 + 4.4] });
    }
  },

  blockcube(B, o, { w, d, h }) {
    // Banded cubes of blockwork or brick on pallets.
    const brick = (o.variant || 'block') === 'brick';
    const mat = brick ? M.brickMat('#9c5b47') : M.concrete('#b4b2ac');
    const unit = brick ? 0.65 : 0.72;
    for (const sx of [-1, 1]) {
      const px = sx * (w / 4);
      // Pallet.
      for (let i = 0; i < 3; i++) B.box(M.wood('#b08a5a'), w / 2 - 0.4, 0.3, 0.45, px, 0.15, -d / 2 + 0.5 + i * ((d - 1) / 2));
      B.box(M.wood('#b08a5a'), w / 2 - 0.4, 0.15, d - 0.6, px, 0.38, 0);
      const rows = Math.max(2, Math.round((h - 0.5) / unit));
      for (let rI = 0; rI < rows; rI++) {
        for (let c = 0; c < 3; c++) {
          B.box(mat, (w / 2 - 0.5) / 3 - 0.04, unit - 0.05, d - 0.7, px - (w / 2 - 0.5) / 2 + ((w / 2 - 0.5) / 3) * (c + 0.5), 0.45 + rI * unit + unit / 2, 0);
        }
      }
      B.box(M.plastic('#2b2f36', 0.7), w / 2 - 0.3, 0.08, 0.08, px, 0.45 + rows * unit * 0.6, d / 2 - 0.4);
      B.box(M.plastic('#dfe3e8', 0.6), w / 2 - 0.35, rows * unit, 0.03, px, 0.45 + (rows * unit) / 2, d / 2 - 0.32);
    }
  },

  pipestack(B, o, { w, d, h }) {
    // Concrete or plastic pipes stacked in a pyramid behind chocks.
    const plastic = (o.variant || 'concrete') === 'plastic';
    const mat = plastic ? M.plastic(o.color || '#2e6f8e', 0.6) : M.concrete('#b0aea7');
    const rad = plastic ? 0.95 : 1.4;
    let rows = Math.max(2, Math.floor(h / (rad * 1.7)));
    for (let rI = 0; rI < rows; rI++) {
      const n = Math.max(1, Math.floor((w - 1) / (rad * 2)) - rI);
      for (let i = 0; i < n; i++) {
        const x = -((n - 1) * rad * 2) / 2 + i * rad * 2;
        const y = rad + rI * rad * 1.72;
        B.add(cylGeo(rad, rad, d - 0.5, 16).rotateX(PI / 2), mat, { pos: [x, y, 0] });
        if (!plastic) B.add(cylGeo(rad * 0.72, rad * 0.72, d - 0.4, 14).rotateX(PI / 2), M.concrete('#8a8882'), { pos: [x, y, 0] });
      }
    }
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) B.box(M.wood('#8a6b4a'), 0.5, 1, 1.4, sx * (w / 2 - 0.4), 0.5, sz * (d / 2 - 0.9));
  },

  sandpile(B, o, { w, d, h }) {
    // A heap of aggregate inside precast bay walls.
    const sand = (o.variant || 'sand') === 'sand' ? M.dirt('#c9b183') : M.gravel();
    B.cone(sand, w / 2, h, 0, 0, 0, 18);
    const r = rng(Math.round(w * 13 + h * 7));
    for (let i = 0; i < 5; i++) {
      const t = 0.15 + r() * 0.5;
      B.cone(sand, (w / 2) * (0.5 - t * 0.3), h * (0.5 - t * 0.3), (r() - 0.5) * w * 0.3, h * t * 0.4, (r() - 0.5) * d * 0.3, 10);
    }
    for (const sx of [-1, 1]) {
      B.box(M.concrete('#a9a8a2'), 0.7, h * 0.7, d, sx * (w / 2 + 0.4), h * 0.35, 0);
      B.box(M.concrete('#a9a8a2'), 0.7, 0.9, 2.4, sx * (w / 2 + 0.4), h * 0.35, 0);
    }
    B.box(M.concrete('#a9a8a2'), w + 1.4, h * 0.7, 0.7, 0, h * 0.35, -d / 2 - 0.4);
  },

  cementbags(B, o, { w, d, h }) {
    // Bagged cement on a pallet under a tarpaulin, part open.
    for (let i = 0; i < 3; i++) B.box(M.wood('#b08a5a'), w, 0.3, 0.45, 0, 0.15, -d / 2 + 0.4 + i * ((d - 0.8) / 2));
    B.box(M.wood('#b08a5a'), w, 0.16, d, 0, 0.38, 0);
    const r = rng(23);
    const rows = Math.max(3, Math.round((h - 0.6) / 0.5));
    for (let rI = 0; rI < rows; rI++) {
      for (let i = 0; i < 2; i++) {
        const turn = (rI % 2) * PI / 2;
        B.box(M.plastic('#d9d4c7', 0.9), turn ? d - 0.5 : w / 2 - 0.2, 0.44, turn ? w / 2 - 0.2 : d - 0.5,
          turn ? 0 : -w / 4 + i * (w / 2), 0.5 + rI * 0.47, turn ? -d / 4 + i * (d / 2) : 0, [0, turn, 0]);
      }
    }
    B.box(M.plastic('#2e6f8e', 0.8), w + 0.4, 0.12, d + 0.4, 0, 0.5 + rows * 0.47, 0, [0.04, 0, 0]);
    for (const sx of [-1, 1]) B.box(M.plastic('#2e6f8e', 0.8), 0.12, rows * 0.3, d + 0.4, sx * (w / 2 + 0.2), 0.5 + rows * 0.37, 0);
    void r;
  },

  mixerstation(B, o, { w, d, h }) {
    // A site mixer, a wheelbarrow and a water butt.
    const frame = M.painted('#e2601c', 0.5);
    for (const sx of [-1, 1]) {
      B.box(frame, 0.25, h - 1.4, 0.25, sx * (w / 2 - 1.4), (h - 1.4) / 2, -1);
      B.add(cylGeo(0.9, 0.9, 0.4, 12).rotateZ(PI / 2), M.tyre(), { pos: [sx * (w / 2 - 1.4), 0.9, 1.2] });
    }
    B.box(frame, w - 2.6, 0.25, 3, 0, 1.4, 0);
    // The drum, tipped forward on its yoke.
    const drum = M.painted('#e9eaea', 0.4);
    B.add(cylGeo(1.5, 1.9, 2.4, 18), drum, { pos: [0, h - 1.4, 0.2], rot: [0.5, 0, 0] });
    B.add(cylGeo(1.1, 1.5, 1, 18), drum, { pos: [0, h - 0.5, 1.2], rot: [0.5, 0, 0] });
    B.box(M.painted('#2b2f36', 0.6), 1.6, 1.4, 1.6, -(w / 2 - 1.2), h - 2, -0.6);
    // A barrow parked beside it.
    B.box(M.painted('#2e6f8e', 0.5), 2.2, 1, 3.4, w / 2 + 1.4, 1.5, 0, [0.2, 0, 0]);
    B.add(cylGeo(0.6, 0.6, 0.3, 12).rotateZ(PI / 2), M.tyre(), { pos: [w / 2 + 1.4, 0.6, 1.8] });
    for (const sx of [-1, 1]) B.tube(M.metal('#8a8f96', 0.5), [w / 2 + 1.4 + sx * 0.9, 1.2, 1.4], [w / 2 + 1.4 + sx * 0.9, 2, -2.2], 0.1, 5);
  },

  toolstore(B, o, { w, d, h }) {
    // A steel vanity-type store with its doors ajar and kit inside.
    const body = M.painted(o.color || '#e2b31b', 0.45);
    B.box(body, w, h, d, 0, h / 2, 0);
    B.box(M.metal('#8a8f96', 0.5), w + 0.2, 0.35, d + 0.2, 0, h, 0);
    for (let i = 0; i < 4; i++) B.box(M.metal('#8a8f96', 0.55), w, 0.14, 0.14, 0, 1 + i * ((h - 1.6) / 3), d / 2 + 0.07);
    B.box(M.painted('#2b2f36', 0.6), w * 0.5, h - 1.2, 0.12, -w * 0.24, (h - 1.2) / 2 + 0.3, d / 2 + 0.08);
    B.box(M.painted('#2b2f36', 0.6), w * 0.42, h - 1.2, 0.12, w * 0.3, (h - 1.2) / 2 + 0.3, d / 2 + 0.5, [0, -0.5, 0]);
    B.box(M.metal('#c9ced3', 0.3), 0.5, 0.9, 0.5, 0, h * 0.5, d / 2 + 0.2);
    for (const sx of [-1, 1]) B.box(M.wood('#8a6b4a'), 1.2, 0.6, 1.2, sx * (w / 2 + 1.2), 0.3, -d / 2 - 0.8);
  },

  lightmast(B, o, { w, d, h }, ctx) {
    // A towable lighting tower, mast up, four lamps on the head.
    const body = M.painted(o.color || '#e2b31b', 0.45);
    B.box(body, w - 0.5, 1.6, d - 2.5, 0, 1.4, -0.5);
    for (const sx of [-1, 1]) {
      B.add(cylGeo(0.85, 0.85, 0.6, 12).rotateZ(PI / 2), M.tyre(), { pos: [sx * (w / 2 - 0.3), 0.85, -0.5] });
      for (const sz of [-1, 1]) {
        B.box(M.metal('#8a8f96', 0.5), 0.45, 0.45, 2.6, sx * (w / 2 - 0.2), 1.1, sz * (d / 2 - 1.6));
        B.box(M.metal('#8a8f96', 0.5), 0.9, 0.3, 0.9, sx * (w / 2 + 0.9), 0.15, sz * (d / 2 - 1.6));
      }
    }
    B.box(M.painted('#2b2f36', 0.6), w - 1.6, 2, 2.4, 0, 2.6, -d / 2 + 1.6);
    B.box(M.metal('#8a8f96', 0.5), 0.3, 0.3, 2.4, 0, 1.4, d / 2 - 0.8);
    // The mast in three stages, and the head.
    const mastTop = h - 1.2;
    B.add(cylGeo(0.4, 0.5, mastTop * 0.5, 10), M.metal('#9aa1a8', 0.45), { pos: [0, 2.4 + mastTop * 0.25, 0.4] });
    B.add(cylGeo(0.3, 0.38, mastTop * 0.45, 10), M.metal('#b9bfc4', 0.4), { pos: [0, 2.4 + mastTop * 0.62, 0.4] });
    B.box(M.metal('#8a8f96', 0.5), 5.4, 0.3, 0.4, 0, mastTop + 1.2, 0.4);
    for (let i = 0; i < 4; i++) {
      const x = -2 + i * 1.35;
      B.box(M.painted('#2b2f36', 0.5), 1.2, 0.9, 0.5, x, mastTop + 0.85, 0.4, [0.35, 0, 0]);
      B.box(M.lamp('#fff3d8', 9), 1, 0.7, 0.1, x, mastTop + 0.75, 0.68, [0.35, 0, 0]);
    }
    if (ctx && ctx.lights) ctx.lights.push({ x: 0, y: mastTop + 0.6, z: 0.9, tx: 0, tz: 40, color: '#fff3d8', power: 2200, range: 190, angle: 86, pool: 1 });
  },
};

void [signFace, white, lumber, steel];
