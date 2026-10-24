// Draws a UV template (the outline of every panel as it lies on the texture) from a
// vehicle's Collada (.dae) 3D model, using only the parts that wear the paint material.
const UVMap = (() => {
  const nums = (t) => { const s = t.trim(); return s ? s.split(/\s+/).map(Number) : []; };
  const kids = (el, name) => [...el.children].filter((c) => c.localName === name);
  const all = (el, name) => el.getElementsByTagNameNS('*', name);
  // "pickup_main-material", "pickup_main.001" and "pickup_main" all mean pickup_main.
  const norm = (s) => String(s || '').toLowerCase().replace(/\.\d{3}$/, '').replace(/[-_.]?(material|mat)$/, '');

  // Returns { pts: [u, v, u, v, ...], sizes: [corners per polygon] }, or null when the model
  // has nothing with one of `materialNames`.
  function fromCollada(text, materialNames) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) return null;
    const matName = new Map();
    for (const m of all(doc, 'material')) matName.set(m.getAttribute('id'), m.getAttribute('name') || m.getAttribute('id'));
    const bound = new Map();
    for (const im of all(doc, 'instance_material')) {
      const target = (im.getAttribute('target') || '').replace(/^#/, '');
      bound.set(im.getAttribute('symbol'), matName.get(target) || target);
    }
    const want = new Set(materialNames.map(norm));
    const matches = (sym) => [sym, bound.get(sym), matName.get(sym)].some((n) => n && want.has(norm(n)));

    const pts = [];
    const sizes = [];
    for (const mesh of all(doc, 'mesh')) {
      const sources = new Map();
      for (const src of kids(mesh, 'source')) {
        const fa = all(src, 'float_array')[0];
        if (!fa) continue;
        const acc = all(src, 'accessor')[0];
        sources.set(src.getAttribute('id'), { data: nums(fa.textContent), stride: +(acc && acc.getAttribute('stride')) || 2 });
      }
      for (const prim of [...mesh.children].filter((c) => c.localName === 'triangles' || c.localName === 'polylist' || c.localName === 'polygons')) {
        if (!matches(prim.getAttribute('material'))) continue;
        const inputs = kids(prim, 'input');
        const stride = Math.max(0, ...inputs.map((i) => +i.getAttribute('offset') || 0)) + 1;
        const tc = inputs.filter((i) => i.getAttribute('semantic') === 'TEXCOORD')
          .sort((a, b) => (+a.getAttribute('set') || 0) - (+b.getAttribute('set') || 0))[0];
        const src = tc && sources.get((tc.getAttribute('source') || '').replace(/^#/, ''));
        if (!src) continue;
        const off = +tc.getAttribute('offset') || 0;
        const vc = kids(prim, 'vcount')[0];
        const vcount = vc ? nums(vc.textContent) : null;
        for (const p of kids(prim, 'p')) {
          const idx = nums(p.textContent);
          const corners = Math.floor(idx.length / stride);
          let k = 0;
          const emit = (n) => {
            sizes.push(n);
            for (let j = 0; j < n; j++, k++) {
              const t = idx[k * stride + off] * src.stride;
              pts.push(src.data[t], src.data[t + 1]);
            }
          };
          if (prim.localName === 'triangles') for (let c = 0; c + 3 <= corners; c += 3) emit(3);
          else if (prim.localName === 'polygons') emit(corners);
          else if (vcount) for (const n of vcount) { if (k + n > corners) break; emit(n); }
        }
      }
    }
    return sizes.length ? { pts, sizes } : null;
  }

  // parts: results of fromCollada. Panels are light gray on white. Panel edges are dark;
  // the mesh lines inside a panel are faint, so the outlines read clearly. Everything is
  // drawn in small batches: one huge path is very slow to fill.
  function draw(parts, w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    const BATCH = 300;
    const edges = new Map();
    let path = new Path2D(), inPath = 0;
    ctx.fillStyle = '#e3e7ed';
    for (const { pts, sizes } of parts) {
      let k = 0;
      for (const n of sizes) {
        let su = Infinity, sv = Infinity;
        for (let j = 0; j < n; j++) { su = Math.min(su, pts[(k + j) * 2]); sv = Math.min(sv, pts[(k + j) * 2 + 1]); }
        su = Math.floor(su); // tiled UVs fold back onto the texture
        sv = Math.floor(sv);
        const xy = [];
        for (let j = 0; j < n; j++, k++) {
          // V points up in the model and down in the picture
          xy.push(Math.round((pts[k * 2] - su) * w * 8) / 8, Math.round((1 - (pts[k * 2 + 1] - sv)) * h * 8) / 8);
        }
        for (let j = 0; j < n; j++) {
          const a = j * 2, b = ((j + 1) % n) * 2;
          if (j) path.lineTo(xy[a], xy[a + 1]); else path.moveTo(xy[a], xy[a + 1]);
          const p1 = xy[a] + ',' + xy[a + 1], p2 = xy[b] + ',' + xy[b + 1];
          const key = p1 < p2 ? p1 + ' ' + p2 : p2 + ' ' + p1;
          const e = edges.get(key);
          if (e) e[4]++; else edges.set(key, [xy[a], xy[a + 1], xy[b], xy[b + 1], 1]);
        }
        path.closePath();
        if (++inPath >= BATCH) { ctx.fill(path); path = new Path2D(); inPath = 0; }
      }
    }
    if (inPath) ctx.fill(path);

    const strokeEdges = (wantOuter, width, color) => {
      ctx.lineWidth = width;
      ctx.strokeStyle = color;
      let pth = new Path2D(), m = 0;
      for (const [x1, y1, x2, y2, count] of edges.values()) {
        if ((count === 1) !== wantOuter) continue;
        pth.moveTo(x1, y1);
        pth.lineTo(x2, y2);
        if (++m >= BATCH * 3) { ctx.stroke(pth); pth = new Path2D(); m = 0; }
      }
      if (m) ctx.stroke(pth);
    };
    ctx.lineCap = 'round';
    if (edges.size < 150000) strokeEdges(false, Math.max(1, w / 4096), '#c3c9d2');
    strokeEdges(true, Math.max(1.5, w / 1365), '#2f343d');
    return c;
  }

  return { fromCollada, draw };
})();
