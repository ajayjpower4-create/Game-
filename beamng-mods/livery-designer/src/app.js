'use strict';
(() => {
// ============================================================ helpers
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (x, a, b) => Math.min(Math.max(x, a), b);
const DEG = Math.PI / 180;
const uid = () => Math.random().toString(36).slice(2, 10);
const clone = (o) => JSON.parse(JSON.stringify(o));
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (x) => (Math.round(x * 10) / 10).toString();

let toastTimer = 0;
function toast(msg, ms = 2800) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}

function pickFile(accept) {
  return new Promise((resolve) => {
    const inp = $('#fileInput');
    inp.value = '';
    inp.accept = accept || '';
    inp.onchange = () => resolve(inp.files[0] || null);
    inp.click();
  });
}

const readDataURL = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = () => rej(r.error);
  r.readAsDataURL(file);
});

const loadImage = (url) => new Promise((res, rej) => {
  const img = new Image();
  img.onload = () => res(img);
  img.onerror = () => rej(new Error('That picture could not be opened.'));
  img.src = url;
});

const canvasBytes = (canvas) => new Promise((res) => canvas.toBlob((b) => b.arrayBuffer().then((a) => res(new Uint8Array(a))), 'image/png'));

// BeamNG's JSON allows comments and trailing or missing commas.
function parseLoose(src) {
  let i = 0;
  const n = src.length;
  const fail = (m) => { throw new Error(m + ' (line ' + src.slice(0, i).split('\n').length + ')'); };
  const skip = () => {
    for (;;) {
      const c = src[i];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\ufeff') { i++; continue; }
      if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
      return;
    }
  };
  const str = () => {
    if (src[i] !== '"') fail('Expected text in quotes');
    i++;
    let out = '';
    for (;;) {
      const q = src.indexOf('"', i), b = src.indexOf('\\', i);
      if (q < 0) fail('Text is missing its closing quote');
      if (b < 0 || q < b) { out += src.slice(i, q); i = q + 1; return out; }
      out += src.slice(i, b);
      const e = src[b + 1];
      i = b + 2;
      if (e === 'n') out += '\n'; else if (e === 't') out += '\t'; else if (e === 'r') out += '\r';
      else if (e === 'b') out += '\b'; else if (e === 'f') out += '\f';
      else if (e === 'u') { out += String.fromCharCode(parseInt(src.substr(i, 4), 16)); i += 4; } else out += e;
    }
  };
  const value = () => {
    skip();
    const c = src[i];
    if (c === '{') {
      i++;
      const o = {};
      for (;;) {
        skip();
        if (src[i] === ',') { i++; continue; }
        if (src[i] === '}') { i++; return o; }
        if (i >= n) fail('Missing }');
        const k = str();
        skip();
        if (src[i] !== ':') fail('Missing :');
        i++;
        o[k] = value();
      }
    }
    if (c === '[') {
      i++;
      const a = [];
      for (;;) {
        skip();
        if (src[i] === ',') { i++; continue; }
        if (src[i] === ']') { i++; return a; }
        if (i >= n) fail('Missing ]');
        a.push(value());
      }
    }
    if (c === '"') return str();
    const m = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i, i + 40));
    if (m) { i += m[0].length; return parseFloat(m[0]); }
    if (src.startsWith('true', i)) { i += 4; return true; }
    if (src.startsWith('false', i)) { i += 5; return false; }
    if (src.startsWith('null', i)) { i += 4; return null; }
    return fail('Unexpected "' + (c || 'end of file') + '"');
  };
  return value();
}

// ============================================================ model
const FONTS = ['Arial', 'Arial Black', 'Impact', 'Bahnschrift', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Segoe UI',
  'Segoe UI Black', 'Calibri', 'Franklin Gothic Medium', 'Georgia', 'Times New Roman', 'Palatino Linotype',
  'Courier New', 'Consolas', 'Lucida Console', 'Comic Sans MS', 'Segoe Script', 'Gabriola',
  'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy'];
const GENERIC_FONTS = new Set(['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy']);
const SHAPES = { rect: 'Rectangle', ellipse: 'Circle', triangle: 'Triangle', star: 'Star', polygon: 'Hexagon',
  parallelogram: 'Slanted bar', chevron: 'Chevron', arrow: 'Arrow' };
const BLENDS = { 'source-over': 'Normal', multiply: 'Multiply', screen: 'Screen', overlay: 'Overlay', darken: 'Darken',
  lighten: 'Lighten', 'color-dodge': 'Color dodge', 'color-burn': 'Color burn', 'hard-light': 'Hard light',
  'soft-light': 'Soft light', difference: 'Difference', hue: 'Hue', saturation: 'Saturation', color: 'Color', luminosity: 'Luminosity' };

function defaultZones(w, h) {
  return {
    left: { x: Math.round(w * 0.03), y: Math.round(h * 0.04), w: Math.round(w * 0.94), h: Math.round(h * 0.42) },
    right: { x: Math.round(w * 0.03), y: Math.round(h * 0.54), w: Math.round(w * 0.94), h: Math.round(h * 0.42) },
    mirrorPos: true,
    flipContent: false,
  };
}

function newSheet(name, w = 2048, h = 2048) {
  return {
    id: uid(), name, width: w, height: h,
    background: { color: '#ffffff', paint: false },
    template: { assetId: null, name: '', mode: 'overlay', opacity: 0.6, blend: 'multiply' },
    zones: defaultZones(w, h),
    materials: [],
    layers: [],
  };
}

function newProject() {
  return {
    app: 'beamng-livery-designer', version: 1,
    vehicle: { folder: '', skinId: '', displayName: 'My Livery', author: '', slotType: 'paint_design' },
    materialLib: {},
    materialDirs: {},
    fonts: [],
    sheets: [newSheet('Body')],
  };
}

const assets = new Map(); // id -> { url, img }
let P = newProject();
const S = {
  sheet: 0, sel: null, tool: 'select', view: 'full', cams: {},
  shapeKind: 'rect', color: '#d40000', brushSize: 24, stripeWidth: 60,
  clipboard: null, space: false, drag: null, mouse: null, snapLines: [],
};
const sh = () => P.sheets[S.sheet];
const findLayer = (id, s = sh()) => (id ? s.layers.find((l) => l.id === id) : null);
const selLayer = () => findLayer(S.sel);
let verCounter = 1;

function nextName(base) {
  const names = new Set(sh().layers.map((l) => l.name));
  if (!names.has(base)) return base;
  for (let k = 2; ; k++) if (!names.has(base + ' ' + k)) return base + ' ' + k;
}

function baseLayer(type, name) {
  return { id: uid(), type, name: nextName(name), visible: true, locked: false, opacity: 1, blend: 'source-over',
    x: 0, y: 0, rotation: 0, flipX: false, flipY: false,
    shadow: { on: false, color: '#000000', blur: 12, x: 6, y: 6 } };
}

function makeText(x, y, text) {
  const s = sh();
  return Object.assign(baseLayer('text', 'Text'), {
    x, y, text, font: 'Arial Black', size: Math.round(Math.min(s.width, s.height) * 0.06), bold: false, italic: false,
    align: 'center', letterSpacing: 0, lineHeight: 1.1, skew: 0, sx: 1, sy: 1,
    fill: { type: 'solid', color: S.color, color2: '#ffffff', angle: 90, size: 32 },
    outline: { color: '#000000', width: 0 }, outline2: { color: '#ffffff', width: 0 },
  });
}

function makeShape(kind, x, y, w, h, name) {
  return Object.assign(baseLayer('shape', name || SHAPES[kind]), {
    shape: kind, x, y, w, h, radius: 0, points: 5, inner: 0.45, sides: 6, slant: 0.25, thickness: 0.35,
    fill: { type: 'solid', color: S.color, color2: '#ffffff', angle: 0, size: 64 },
    outline: { color: '#000000', width: 0 },
  });
}

function makeImage(assetId, x, y, w, h, name) {
  return Object.assign(baseLayer('image', name || 'Image'), { assetId, x, y, w, h, tint: { on: false, color: '#ffffff' } });
}

function makeBrush() {
  return Object.assign(baseLayer('brush', 'Paint'), { strokes: [], ver: verCounter++ });
}

// ============================================================ assets & fonts
function addAsset(url, img, zipRel) {
  const id = 'a' + uid();
  assets.set(id, { url, img: img || null, zipRel: zipRel || null });
  return id;
}

function assetImg(id) {
  const a = id && assets.get(id);
  if (!a || !a.url) return null;
  if (a.img && a.img.complete && a.img.naturalWidth) return a.img;
  if (!a.img) {
    a.img = new Image();
    a.img.onload = () => { render(); refreshSheetPane(); };
    a.img.src = a.url;
  }
  return null;
}

function waitAsset(id) {
  const a = assets.get(id);
  if (!a || !a.url) return Promise.resolve(null);
  assetImg(id);
  if (a.img.complete && a.img.naturalWidth) return Promise.resolve(a.img);
  return new Promise((res) => { a.img.addEventListener('load', () => res(a.img), { once: true }); a.img.addEventListener('error', () => res(null), { once: true }); });
}

let layoutCache = new WeakMap();
async function registerFont(family, assetId) {
  const a = assets.get(assetId);
  if (!a) return;
  try {
    const face = new FontFace(family, 'url(' + a.url + ')');
    await face.load();
    document.fonts.add(face);
  } catch (e) {
    toast('The font "' + family + '" could not be loaded.');
  }
  layoutCache = new WeakMap();
  render();
}
if (document.fonts && document.fonts.addEventListener) {
  document.fonts.addEventListener('loadingdone', () => { layoutCache = new WeakMap(); render(); });
}

function ddsToURL(buffer) {
  let tex;
  try {
    tex = DDS.decode(buffer);
  } catch (e) {
    if (e.message === 'BC7_DDS') throw new Error('This DDS uses BC7 compression. Open it in paint.net or GIMP, save it as PNG and load the PNG.');
    throw e;
  }
  const c = document.createElement('canvas');
  c.width = tex.width;
  c.height = tex.height;
  c.getContext('2d').putImageData(new ImageData(tex.data, tex.width, tex.height), 0, 0);
  return c.toDataURL('image/png');
}

async function fileToImageURL(file) {
  if (/\.dds$/i.test(file.name)) return ddsToURL(await file.arrayBuffer());
  if (/\.(tga|psd|xcf)$/i.test(file.name)) throw new Error('Save it as a PNG first, then load the PNG.');
  return readDataURL(file);
}

// ============================================================ geometry
const mctx = document.createElement('canvas').getContext('2d');

function fontCSS(L) {
  const fam = GENERIC_FONTS.has(L.font) ? L.font : '"' + String(L.font).replace(/["\\]/g, '') + '", sans-serif';
  return (L.italic ? 'italic ' : '') + (L.bold ? '700 ' : '400 ') + L.size + 'px ' + fam;
}

function lineWidth(ctx, line, spacing) {
  if (!spacing) return ctx.measureText(line).width;
  let w = 0;
  for (const ch of line) w += ctx.measureText(ch).width + spacing;
  return line.length ? w - spacing : 0;
}

function textLayout(L) {
  const key = [L.text, L.font, L.size, L.bold, L.italic, L.letterSpacing, L.lineHeight, L.outline.width, L.outline2.width].join('\u0001');
  const hit = layoutCache.get(L);
  if (hit && hit.key === key) return hit;
  mctx.font = fontCSS(L);
  const lines = String(L.text == null ? '' : L.text).split('\n');
  const widths = lines.map((ln) => lineWidth(mctx, ln, L.letterSpacing || 0));
  const lh = L.size * (L.lineHeight || 1.1);
  const pad = Math.max(0, L.outline.width) + Math.max(0, L.outline2.width);
  const inner = Math.max(L.size * 0.25, ...widths);
  const lay = { key, lines, widths, lh, pad, inner, natW: inner + pad * 2, natH: lh * lines.length + pad * 2 };
  layoutCache.set(L, lay);
  return lay;
}

// Brush layers keep their stroke points relative to (L.x, L.y).
const brushCache = new WeakMap();
function brushBounds(L) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const st of L.strokes) {
    const r = st.size / 2 + 2;
    for (let i = 0; i < st.pts.length; i += 2) {
      minX = Math.min(minX, st.pts[i] - r); maxX = Math.max(maxX, st.pts[i] + r);
      minY = Math.min(minY, st.pts[i + 1] - r); maxY = Math.max(maxY, st.pts[i + 1] + r);
    }
  }
  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1, w: 1, h: 1 };
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function paintStroke(ctx, st) {
  ctx.globalCompositeOperation = st.erase ? 'destination-out' : 'source-over';
  ctx.strokeStyle = ctx.fillStyle = st.erase ? '#000' : st.color;
  ctx.lineWidth = st.size;
  ctx.lineCap = ctx.lineJoin = 'round';
  const p = st.pts;
  ctx.beginPath();
  if (p.length <= 2) { ctx.arc(p[0], p[1], st.size / 2, 0, Math.PI * 2); ctx.fill(); return; }
  ctx.moveTo(p[0], p[1]);
  for (let i = 2; i < p.length - 2; i += 2) ctx.quadraticCurveTo(p[i], p[i + 1], (p[i] + p[i + 2]) / 2, (p[i + 1] + p[i + 3]) / 2);
  ctx.lineTo(p[p.length - 2], p[p.length - 1]);
  ctx.stroke();
}

function brushCanvas(L, pad = 2) {
  let c = brushCache.get(L);
  if (c && c.ver === L.ver) return c;
  const b = brushBounds(L);
  const ox = Math.floor(b.minX - pad), oy = Math.floor(b.minY - pad);
  const cw = Math.max(1, Math.ceil(b.w + pad * 2)), ch = Math.max(1, Math.ceil(b.h + pad * 2));
  const canvas = c && c.canvas.width === cw && c.canvas.height === ch ? c.canvas : document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.translate(-ox, -oy);
  for (const st of L.strokes) paintStroke(ctx, st);
  c = { canvas, ox, oy, ver: L.ver, b };
  brushCache.set(L, c);
  return c;
}

// Adds one point to the stroke being painted and draws just that piece.
function brushAddPoint(L, st, x, y) {
  const n = st.pts.length;
  const px = st.pts[n - 2], py = st.pts[n - 1];
  st.pts.push(x, y);
  L.ver = verCounter++;
  const c = brushCache.get(L);
  const r = st.size / 2 + 2;
  if (!c || x - r < c.ox || y - r < c.oy || x + r > c.ox + c.canvas.width || y + r > c.oy + c.canvas.height) {
    brushCanvas(L, 384);
    return;
  }
  const ctx = c.canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, -c.ox, -c.oy);
  ctx.globalCompositeOperation = st.erase ? 'destination-out' : 'source-over';
  ctx.strokeStyle = st.erase ? '#000' : st.color;
  ctx.lineWidth = st.size;
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(x, y);
  ctx.stroke();
  c.ver = L.ver;
  c.b = brushBounds(L);
}

function layerSize(L) {
  if (L.type === 'text') { const t = textLayout(L); return { w: t.natW * L.sx, h: t.natH * L.sy }; }
  if (L.type === 'brush') { const b = brushBounds(L); return { w: b.w, h: b.h }; }
  return { w: L.w, h: L.h };
}

// Center, size and rotation of a layer in sheet pixels.
function frameOf(L) {
  if (L.type === 'brush') {
    const b = brushBounds(L);
    return { cx: L.x + (b.minX + b.maxX) / 2, cy: L.y + (b.minY + b.maxY) / 2, w: b.w, h: b.h, rot: 0 };
  }
  const s = layerSize(L);
  return { cx: L.x, cy: L.y, w: s.w, h: s.h, rot: L.rotation || 0 };
}

function toLocal(f, x, y) {
  const c = Math.cos(f.rot * DEG), s = Math.sin(f.rot * DEG);
  const dx = x - f.cx, dy = y - f.cy;
  return { x: dx * c + dy * s, y: -dx * s + dy * c };
}

function toWorld(f, lx, ly) {
  const c = Math.cos(f.rot * DEG), s = Math.sin(f.rot * DEG);
  return { x: f.cx + lx * c - ly * s, y: f.cy + lx * s + ly * c };
}

function hitLayer(L, p) {
  const f = frameOf(L);
  const l = toLocal(f, p.x, p.y);
  if (Math.abs(l.x) > f.w / 2 || Math.abs(l.y) > f.h / 2) return false;
  if (L.type === 'shape' && L.shape === 'ellipse') return (4 * l.x * l.x) / (f.w * f.w) + (4 * l.y * l.y) / (f.h * f.h) <= 1;
  if (L.type === 'brush') {
    const c = brushCanvas(L);
    const px = Math.floor(p.x - L.x - c.ox), py = Math.floor(p.y - L.y - c.oy);
    if (px < 0 || py < 0 || px >= c.canvas.width || py >= c.canvas.height) return false;
    return c.canvas.getContext('2d').getImageData(px, py, 1, 1).data[3] > 20;
  }
  return true;
}

// ============================================================ drawing the sheet
const patCache = new Map();
function makeFill(ctx, f, w, h) {
  if (!f || f.type === 'none') return null;
  if (f.type === 'gradient') {
    const a = (f.angle || 0) * DEG, dx = Math.cos(a), dy = Math.sin(a);
    const len = (Math.abs(dx) * w + Math.abs(dy) * h) / 2 || 1;
    const g = ctx.createLinearGradient(-dx * len, -dy * len, dx * len, dy * len);
    g.addColorStop(0, f.color);
    g.addColorStop(1, f.color2);
    return g;
  }
  if (f.type === 'checker' || f.type === 'stripes') {
    const s = Math.max(2, Math.round(f.size || 32));
    const key = f.type + f.color + f.color2 + s;
    let c = patCache.get(key);
    if (!c) {
      c = document.createElement('canvas');
      const x = c.getContext('2d');
      if (f.type === 'checker') {
        c.width = c.height = s * 2;
        x.fillStyle = f.color; x.fillRect(0, 0, s * 2, s * 2);
        x.fillStyle = f.color2; x.fillRect(0, 0, s, s); x.fillRect(s, s, s, s);
      } else {
        c.width = 4; c.height = s * 2;
        x.fillStyle = f.color; x.fillRect(0, 0, 4, s);
        x.fillStyle = f.color2; x.fillRect(0, s, 4, s);
      }
      patCache.set(key, c);
      if (patCache.size > 60) patCache.delete(patCache.keys().next().value);
    }
    const pat = ctx.createPattern(c, 'repeat');
    if (pat.setTransform && window.DOMMatrix) {
      pat.setTransform(f.type === 'checker' ? new DOMMatrix().translate(-w / 2, -h / 2) : new DOMMatrix().rotate(f.angle || 0));
    }
    return pat;
  }
  return f.color;
}

function setShadow(ctx, sd, k) {
  if (sd && sd.on) {
    ctx.shadowColor = sd.color;
    ctx.shadowBlur = sd.blur * k;
    ctx.shadowOffsetX = sd.x * k;
    ctx.shadowOffsetY = sd.y * k;
  }
}
function noShadow(ctx) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; }

function roundRect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function shapePath(ctx, L) {
  const w = L.w, h = L.h, hw = w / 2, hh = h / 2;
  const poly = (pts) => { ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); };
  ctx.beginPath();
  switch (L.shape) {
    case 'ellipse': ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2); break;
    case 'triangle': poly([0, -hh, hw, hh, -hw, hh]); break;
    case 'star': {
      const n = clamp(Math.round(L.points || 5), 3, 40), inner = clamp(L.inner || 0.45, 0.05, 1), pts = [];
      for (let i = 0; i < n * 2; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / n, r = i % 2 ? inner : 1;
        pts.push(Math.cos(a) * hw * r, Math.sin(a) * hh * r);
      }
      poly(pts);
      break;
    }
    case 'polygon': {
      const n = clamp(Math.round(L.sides || 6), 3, 40), pts = [];
      for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / n; pts.push(Math.cos(a) * hw, Math.sin(a) * hh); }
      poly(pts);
      break;
    }
    case 'parallelogram': { const s = clamp(L.slant, -0.9, 0.9) * w; poly([-hw + Math.max(s, 0), -hh, hw + Math.min(s, 0), -hh, hw - Math.max(s, 0), hh, -hw - Math.min(s, 0), hh]); break; }
    case 'chevron': { const t = clamp(L.thickness, 0.05, 0.95) * w; poly([-hw, -hh, -hw + t, -hh, hw, 0, -hw + t, hh, -hw, hh, hw - t, 0]); break; }
    case 'arrow': { const hl = Math.min(w * 0.45, h * 1.2), sh2 = hh * 0.42; poly([-hw, -sh2, hw - hl, -sh2, hw - hl, -hh, hw, 0, hw - hl, hh, hw - hl, sh2, -hw, sh2]); break; }
    default: roundRect(ctx, -hw, -hh, w, h, L.radius || 0);
  }
}

function drawLine(ctx, text, x, y, spacing, mode) {
  const op = mode === 'stroke' ? 'strokeText' : 'fillText';
  if (!spacing) { ctx[op](text, x, y); return; }
  for (const ch of text) { ctx[op](ch, x, y); x += ctx.measureText(ch).width + spacing; }
}

function drawText(ctx, L, k) {
  const t = textLayout(L);
  ctx.scale(L.sx, L.sy);
  if (L.skew) ctx.transform(1, 0, -Math.tan(clamp(L.skew, -60, 60) * DEG), 1, 0, 0);
  ctx.font = fontCSS(L);
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  const top = -(t.lh * t.lines.length) / 2;
  const passes = [];
  const o1 = Math.max(0, L.outline.width), o2 = Math.max(0, L.outline2.width);
  if (o2 > 0) passes.push({ stroke: L.outline2.color, width: 2 * (o1 + o2) });
  if (o1 > 0) passes.push({ stroke: L.outline.color, width: 2 * o1 });
  const fill = makeFill(ctx, L.fill, t.natW, t.natH);
  if (fill) passes.push({ fill });
  setShadow(ctx, L.shadow, k);
  passes.forEach((p, n) => {
    if (n > 0) noShadow(ctx);
    if (p.stroke) { ctx.strokeStyle = p.stroke; ctx.lineWidth = p.width; } else ctx.fillStyle = p.fill;
    t.lines.forEach((line, i) => {
      const w = t.widths[i];
      const x = L.align === 'left' ? -t.inner / 2 : L.align === 'right' ? t.inner / 2 - w : -w / 2;
      drawLine(ctx, line, x, top + t.lh * (i + 0.5), L.letterSpacing || 0, p.stroke ? 'stroke' : 'fill');
    });
  });
}

const tintCache = new WeakMap();
function tinted(img, color) {
  let m = tintCache.get(img);
  if (!m) { m = new Map(); tintCache.set(img, m); }
  let c = m.get(color);
  if (!c) {
    c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    m.set(color, c);
  }
  return c;
}

function drawLayer(ctx, L, k) {
  ctx.save();
  ctx.globalAlpha *= clamp(L.opacity, 0, 1);
  ctx.globalCompositeOperation = L.blend || 'source-over';
  if (L.type === 'brush') {
    const c = brushCanvas(L);
    ctx.drawImage(c.canvas, L.x + c.ox, L.y + c.oy);
    ctx.restore();
    return;
  }
  ctx.translate(L.x, L.y);
  if (L.rotation) ctx.rotate(L.rotation * DEG);
  if (L.flipX || L.flipY) ctx.scale(L.flipX ? -1 : 1, L.flipY ? -1 : 1);
  if (L.type === 'shape') {
    shapePath(ctx, L);
    const fill = makeFill(ctx, L.fill, L.w, L.h);
    setShadow(ctx, L.shadow, k);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); noShadow(ctx); }
    if (L.outline.width > 0) { ctx.strokeStyle = L.outline.color; ctx.lineWidth = L.outline.width; ctx.lineJoin = 'round'; ctx.stroke(); }
  } else if (L.type === 'text') {
    drawText(ctx, L, k);
  } else if (L.type === 'image') {
    const img = assetImg(L.assetId);
    if (img) {
      setShadow(ctx, L.shadow, k);
      ctx.drawImage(L.tint && L.tint.on ? tinted(img, L.tint.color) : img, -L.w / 2, -L.h / 2, L.w, L.h);
    }
  }
  ctx.restore();
}

// opts.guides: draw the template overlay. opts.k: device pixels per sheet pixel.
// opts.transparent: leave the base see-through (paint mode export).
function drawSheet(ctx, s, opts) {
  if (!opts.transparent) { ctx.fillStyle = s.background.color; ctx.fillRect(0, 0, s.width, s.height); }
  const tpl = s.template;
  const timg = tpl.assetId ? assetImg(tpl.assetId) : null;
  if (timg && tpl.mode === 'background') ctx.drawImage(timg, 0, 0, s.width, s.height);
  for (const L of s.layers) if (L.visible) drawLayer(ctx, L, opts.k);
  if (opts.guides && timg && tpl.mode === 'overlay') {
    ctx.save();
    ctx.globalAlpha = tpl.opacity;
    ctx.globalCompositeOperation = tpl.blend || 'source-over';
    ctx.drawImage(timg, 0, 0, s.width, s.height);
    ctx.restore();
  }
}

// ============================================================ view (canvas, cameras, overlays)
const view = $('#view');
const vctx = view.getContext('2d');
let dpr = window.devicePixelRatio || 1;
let renderQueued = false;

function resizeView() {
  const r = $('#canvaswrap').getBoundingClientRect();
  dpr = window.devicePixelRatio || 1;
  view.width = Math.max(1, Math.round(r.width * dpr));
  view.height = Math.max(1, Math.round(r.height * dpr));
  view.style.width = r.width + 'px';
  view.style.height = r.height + 'px';
  render();
}

function regionFor(key) {
  const s = sh();
  if (key === 'left' || key === 'bothL') return s.zones.left;
  if (key === 'right' || key === 'bothR') return s.zones.right;
  return { x: 0, y: 0, w: s.width, h: s.height };
}

function camFor(key, w, h) {
  let c = S.cams[key];
  if (!c || c.sheetId !== sh().id) {
    const r = regionFor(key);
    const pad = key === 'full' || key === 'zones' ? 0.94 : 0.88;
    c = S.cams[key] = { sheetId: sh().id, scale: Math.min(w / Math.max(1, r.w), h / Math.max(1, r.h)) * pad, cx: r.x + r.w / 2, cy: r.y + r.h / 2 };
  }
  return c;
}

function viewports() {
  const W = view.width / dpr, H = view.height / dpr;
  const make = (x, y, w, h, key) => {
    const cam = camFor(key, w, h);
    return { x, y, w, h, key, cam, scale: cam.scale, ox: x + w / 2 - cam.cx * cam.scale, oy: y + h / 2 - cam.cy * cam.scale };
  };
  if (S.view === 'both') {
    const half = (H - 4) / 2;
    return [make(0, 0, W, half, 'bothL'), make(0, half + 4, W, half, 'bothR')];
  }
  return [make(0, 0, W, H, S.view)];
}

const toTex = (vp, x, y) => ({ x: (x - vp.ox) / vp.scale, y: (y - vp.oy) / vp.scale });
const toScr = (vp, x, y) => ({ x: vp.ox + x * vp.scale, y: vp.oy + y * vp.scale });

function vpAt(x, y) {
  for (const vp of S.vps || viewports()) if (x >= vp.x && x <= vp.x + vp.w && y >= vp.y && y <= vp.y + vp.h) return vp;
  return null;
}

function render() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(drawView);
}

function zoneKeyOf(vpKey) {
  if (vpKey === 'left' || vpKey === 'bothL') return 'left';
  if (vpKey === 'right' || vpKey === 'bothR') return 'right';
  return null;
}

function drawView() {
  renderQueued = false;
  const ctx = vctx;
  const s = sh();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0d0e11';
  ctx.fillRect(0, 0, view.width, view.height);
  S.vps = viewports();
  for (const vp of S.vps) {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.beginPath();
    ctx.rect(vp.x, vp.y, vp.w, vp.h);
    ctx.clip();
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(vp.ox + 6, vp.oy + 6, s.width * vp.scale, s.height * vp.scale);
    ctx.setTransform(dpr * vp.scale, 0, 0, dpr * vp.scale, dpr * vp.ox, dpr * vp.oy);
    ctx.imageSmoothingQuality = 'high';
    drawSheet(ctx, s, { guides: true, k: dpr * vp.scale });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawOverlay(ctx, vp);
    ctx.restore();
  }
  if (S.view === 'both') {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#31343c';
    ctx.fillRect(0, S.vps[0].h, view.width / dpr, 4);
  }
  const main = S.vps[0];
  $('#zoomlbl').textContent = Math.round(main.scale * 100) + '%';
  $('#stSize').textContent = 'Sheet ' + s.width + ' × ' + s.height + ' px';
  $('#welcome').classList.toggle('hidden', !!(VZ || s.template.assetId || s.layers.length || S.skipWelcome));
}

function zoneRectScr(vp, z) {
  const a = toScr(vp, z.x, z.y);
  return { x: a.x, y: a.y, w: z.w * vp.scale, h: z.h * vp.scale };
}

function handlesOf(L, vp) {
  const f = frameOf(L);
  const pts = [];
  for (const hy of [-1, 0, 1]) for (const hx of [-1, 0, 1]) {
    if (!hx && !hy) continue;
    const w = toWorld(f, (hx * f.w) / 2, (hy * f.h) / 2);
    pts.push({ hx, hy, ...toScr(vp, w.x, w.y) });
  }
  const top = toWorld(f, 0, -f.h / 2);
  const ts = toScr(vp, top.x, top.y);
  const up = { x: Math.sin(f.rot * DEG), y: -Math.cos(f.rot * DEG) };
  return { f, pts, rot: { x: ts.x + up.x * 26, y: ts.y + up.y * 26 }, top: ts };
}

function strokeFrame(ctx, vp, L, color, dash) {
  const f = frameOf(L);
  ctx.beginPath();
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([a, b], i) => {
    const w = toWorld(f, (a * f.w) / 2, (b * f.h) / 2);
    const p = toScr(vp, w.x, w.y);
    if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
  });
  ctx.closePath();
  ctx.setLineDash(dash || []);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.setLineDash([]);
}

function label(ctx, text, x, y, color) {
  ctx.font = '700 12px "Segoe UI", system-ui, sans-serif';
  const w = ctx.measureText(text).width + 12;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, 20);
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 6, y + 10);
}

function drawOverlay(ctx, vp) {
  const s = sh();
  const sheetTL = toScr(vp, 0, 0);
  ctx.strokeStyle = 'rgba(255,255,255,.18)';
  ctx.lineWidth = 1;
  ctx.strokeRect(sheetTL.x - 0.5, sheetTL.y - 0.5, s.width * vp.scale + 1, s.height * vp.scale + 1);

  const zk = zoneKeyOf(vp.key);
  if (zk) {
    const r = zoneRectScr(vp, s.zones[zk]);
    ctx.fillStyle = 'rgba(8,9,12,.55)';
    ctx.beginPath();
    ctx.rect(vp.x, vp.y, vp.w, vp.h);
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.fill('evenodd');
    ctx.strokeStyle = zk === 'left' ? '#2ec5ff' : '#ff8a2e';
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    label(ctx, zk === 'left' ? 'LEFT SIDE' : 'RIGHT SIDE', vp.x + 10, vp.y + 10, zk === 'left' ? '#1595c8' : '#d96a12');
  } else if (S.view === 'full') {
    for (const key of ['left', 'right']) {
      const r = zoneRectScr(vp, s.zones[key]);
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = key === 'left' ? 'rgba(46,197,255,.55)' : 'rgba(255,138,46,.55)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.setLineDash([]);
      ctx.font = '700 11px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = key === 'left' ? 'rgba(46,197,255,.8)' : 'rgba(255,138,46,.8)';
      ctx.textBaseline = 'top';
      ctx.fillText(key === 'left' ? 'LEFT' : 'RIGHT', r.x + 4, r.y + 4);
    }
  }

  if (S.view === 'zones') {
    for (const key of ['left', 'right']) {
      const r = zoneRectScr(vp, s.zones[key]);
      const col = key === 'left' ? '46,197,255' : '255,138,46';
      ctx.fillStyle = 'rgba(' + col + ',.16)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = 'rgb(' + col + ')';
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      label(ctx, key === 'left' ? 'LEFT SIDE: drag me' : 'RIGHT SIDE: drag me', r.x + 6, r.y + 6, key === 'left' ? '#1595c8' : '#d96a12');
      for (const h of zoneHandles(r)) { ctx.fillStyle = '#fff'; ctx.fillRect(h.x - 5, h.y - 5, 10, 10); ctx.strokeStyle = 'rgb(' + col + ')'; ctx.strokeRect(h.x - 5, h.y - 5, 10, 10); }
    }
    return;
  }

  const L = selLayer();
  if (L && L.visible) {
    const T = L.twin && findLayer(L.twin);
    if (T && T.visible) strokeFrame(ctx, vp, T, L.linked ? '#ffb37a' : 'rgba(255,255,255,.4)', [5, 4]);
    strokeFrame(ctx, vp, L, '#ff6a00');
    if (L.type !== 'brush' && !L.locked) {
      const h = handlesOf(L, vp);
      ctx.strokeStyle = '#ff6a00';
      ctx.beginPath(); ctx.moveTo(h.top.x, h.top.y); ctx.lineTo(h.rot.x, h.rot.y); ctx.stroke();
      ctx.beginPath(); ctx.arc(h.rot.x, h.rot.y, 6, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
      for (const p of h.pts) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(p.x - 4.5, p.y - 4.5, 9, 9);
        ctx.strokeRect(p.x - 4.5, p.y - 4.5, 9, 9);
      }
    }
  }

  for (const g of S.snapLines) {
    ctx.strokeStyle = '#ff3df2';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (g.x != null) { const p = toScr(vp, g.x, 0); ctx.moveTo(p.x, vp.y); ctx.lineTo(p.x, vp.y + vp.h); }
    else { const p = toScr(vp, 0, g.y); ctx.moveTo(vp.x, p.y); ctx.lineTo(vp.x + vp.w, p.y); }
    ctx.stroke();
  }

  if ((S.tool === 'brush' || S.tool === 'eraser') && S.mouse && S.mouse.vp === vp.key) {
    ctx.beginPath();
    ctx.arc(S.mouse.sx, S.mouse.sy, Math.max(1, (S.brushSize / 2) * vp.scale), 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function zoneHandles(r) {
  const out = [];
  for (const hy of [-1, 0, 1]) for (const hx of [-1, 0, 1]) {
    if (!hx && !hy) continue;
    out.push({ hx, hy, x: r.x + ((hx + 1) / 2) * r.w, y: r.y + ((hy + 1) / 2) * r.h });
  }
  return out;
}

// ============================================================ history & autosave
const hist = { stack: [], idx: -1 };
let dirty = false;
let autosaveReady = false;

function snapshot() {
  return JSON.stringify({ vehicle: P.vehicle, materialLib: P.materialLib, fonts: P.fonts, sheets: P.sheets, sheet: S.sheet });
}

function pushHistory() {
  const snap = snapshot();
  if (hist.stack[hist.idx] === snap) return;
  hist.stack = hist.stack.slice(0, hist.idx + 1);
  hist.stack.push(snap);
  if (hist.stack.length > 150) hist.stack.shift();
  hist.idx = hist.stack.length - 1;
  dirty = true;
  updateUndoButtons();
  scheduleAutosave();
  scheduleExportRefresh();
}

function restore(snap) {
  const d = JSON.parse(snap);
  P.vehicle = d.vehicle; P.materialLib = d.materialLib; P.fonts = d.fonts; P.sheets = d.sheets;
  S.sheet = clamp(d.sheet || 0, 0, P.sheets.length - 1);
  if (!findLayer(S.sel)) S.sel = null;
  layoutCache = new WeakMap();
  refreshAll();
  scheduleAutosave();
}

function undo() { if (hist.idx > 0) { hist.idx--; restore(hist.stack[hist.idx]); updateUndoButtons(); } }
function redo() { if (hist.idx < hist.stack.length - 1) { hist.idx++; restore(hist.stack[hist.idx]); updateUndoButtons(); } }
function resetHistory() { hist.stack = [snapshot()]; hist.idx = 0; updateUndoButtons(); }
function updateUndoButtons() {
  $('#btnUndo').disabled = hist.idx <= 0;
  $('#btnRedo').disabled = hist.idx >= hist.stack.length - 1;
}

const DB = {
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('beamng-livery-designer', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  },
  async put(key, val) {
    const db = await DB.open();
    return new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(val, key); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  },
  async get(key) {
    const db = await DB.open();
    return new Promise((res, rej) => { const r = db.transaction('kv').objectStore('kv').get(key); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  },
  async del(key) {
    const db = await DB.open();
    return new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').delete(key); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  },
  async keys() {
    const db = await DB.open();
    return new Promise((res, rej) => { const r = db.transaction('kv').objectStore('kv').getAllKeys(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  },
};

let autosaveTimer = 0;
function hasContent() { return P.sheets.some((s) => s.layers.length || s.template.assetId); }
// Pictures are stored once each under their own key; the project itself only names them.
const savedAssets = new Set();
async function writeAutosave() {
  if (!autosaveReady || !hasContent()) return;
  try {
    for (const id of usedAssetIds()) {
      const a = assets.get(id);
      if (a.url && !savedAssets.has(id)) { await DB.put('asset:' + id, a.url); savedAssets.add(id); }
    }
    await DB.put('autosave', JSON.stringify(projectData(false)));
  } catch (e) { /* storage blocked or full */ }
}

async function restoreAutosave(saved) {
  const data = JSON.parse(saved);
  for (const [id, url] of Object.entries(data.assets || {})) {
    if (url) continue;
    try { data.assets[id] = (await DB.get('asset:' + id)) || null; } catch (e) { /* missing */ }
    if (data.assets[id]) savedAssets.add(id);
  }
  loadProjectData(data);
}

async function pruneSavedAssets() {
  const keep = new Set(usedAssetIds());
  try {
    for (const k of await DB.keys()) if (String(k).startsWith('asset:') && !keep.has(String(k).slice(6))) { await DB.del(k); savedAssets.delete(String(k).slice(6)); }
  } catch (e) { /* storage blocked */ }
}
// Saves about a second after the first change, even while you keep editing.
function scheduleAutosave() {
  if (!autosaveReady || autosaveTimer) return;
  autosaveTimer = setTimeout(() => { autosaveTimer = 0; writeAutosave(); }, 1000);
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') writeAutosave(); });

// ============================================================ project files
function usedAssetIds() {
  const ids = new Set();
  for (const s of P.sheets) {
    if (s.template.assetId) ids.add(s.template.assetId);
    for (const L of s.layers) if (L.type === 'image') ids.add(L.assetId);
  }
  for (const f of P.fonts) ids.add(f.assetId);
  return [...ids].filter((id) => assets.has(id));
}

// withData: include the picture and font data. Without it the pictures are only named.
function projectData(withData) {
  const out = Object.assign({}, P, { assets: {}, zipAssets: {} });
  for (const id of usedAssetIds()) {
    const a = assets.get(id);
    if (a.zipRel) out.zipAssets[id] = a.zipRel;
    out.assets[id] = withData ? a.url : null;
  }
  return out;
}

function projectJSON() {
  return JSON.stringify(projectData(true));
}

// The copy saved inside the mod file. Pictures from the vehicle's own zip are not stored again.
function liveryFileJSON() {
  const out = projectData(true);
  for (const id of Object.keys(out.zipAssets)) delete out.assets[id];
  return JSON.stringify(out);
}

function saveProject() {
  const name = (slug(P.vehicle.displayName) || 'livery') + (P.vehicle.folder ? '_' + slug(P.vehicle.folder) : '') + '.livery.json';
  download(new Blob([projectJSON()], { type: 'application/json' }), name);
  dirty = false;
  toast('Project saved as ' + name);
}

function loadProjectData(data) {
  if (!data || data.app !== 'beamng-livery-designer' || !Array.isArray(data.sheets)) throw new Error('This is not a Livery Designer project.');
  assets.clear();
  const urls = data.assets || {}, fromZip = data.zipAssets || {};
  for (const id of new Set(Object.keys(urls).concat(Object.keys(fromZip)))) assets.set(id, { url: urls[id] || null, img: null, zipRel: fromZip[id] || null });
  delete data.assets;
  delete data.zipAssets;
  P = Object.assign(newProject(), data);
  P.vehicle = Object.assign(newProject().vehicle, P.vehicle);
  for (const s of P.sheets) {
    s.zones = Object.assign(defaultZones(s.width, s.height), s.zones);
    s.template = Object.assign({ assetId: null, name: '', mode: 'overlay', opacity: 0.6, blend: 'multiply' }, s.template);
    s.background = Object.assign({ color: '#ffffff', paint: false }, s.background);
    s.materials = s.materials || [];
  }
  for (const f of P.fonts) registerFont(f.family, f.assetId);
  S.sheet = 0; S.sel = null; S.cams = {}; S.makeMode = null;
  if (VZ && VZ.folder.toLowerCase() !== String(P.vehicle.folder || '').toLowerCase()) VZ = null;
  layoutCache = new WeakMap();
  resetHistory();
  refreshAll();
  dirty = false;
}

async function openProject(file) {
  try {
    loadProjectData(JSON.parse(await file.text()));
    autosaveReady = true;
    toast('Opened ' + file.name);
  } catch (e) {
    toast(e.message || 'That file could not be opened.');
  }
}

// ============================================================ layer actions
function addLayer(L, aboveId) {
  const layers = sh().layers;
  const i = aboveId ? layers.findIndex((l) => l.id === aboveId) : -1;
  if (i >= 0) layers.splice(i + 1, 0, L); else layers.push(L);
  select(L.id);
  pushHistory();
  renderLayerList();
  render();
}

function select(id) {
  S.sel = id;
  renderLayerList();
  buildProps();
  render();
}

function viewCenter() {
  const vp = (S.vps || viewports())[0];
  const p = toTex(vp, vp.x + vp.w / 2, vp.y + vp.h / 2);
  return { x: clamp(p.x, 0, sh().width), y: clamp(p.y, 0, sh().height) };
}

function deleteSelected() {
  const L = selLayer();
  if (!L) return;
  const s = sh();
  const T = L.twin && findLayer(L.twin);
  let both = false;
  if (T) both = confirm('Also delete the copy on the other side?\n\nOK = delete both sides\nCancel = delete only this one');
  s.layers = s.layers.filter((l) => l !== L && !(both && l === T));
  if (T && !both) { delete T.twin; T.linked = false; delete T.side; }
  S.sel = null;
  pushHistory();
  refreshAll();
}

function duplicateSelected() {
  const L = selLayer();
  if (!L) return;
  const C = clone(L);
  C.id = uid();
  C.name = nextName(L.name.replace(/ \d+$/, ''));
  delete C.twin; delete C.side; C.linked = false;
  const off = Math.round(Math.min(sh().width, sh().height) * 0.015);
  C.x += off; C.y += off;
  if (C.type === 'brush') C.ver = verCounter++;
  addLayer(C, L.id);
}

function moveLayer(dir) {
  const L = selLayer();
  if (!L) return;
  const a = sh().layers, i = a.indexOf(L), j = clamp(i + dir, 0, a.length - 1);
  if (i === j) return;
  a.splice(i, 1);
  a.splice(j, 0, L);
  pushHistory();
  renderLayerList();
  render();
}

function copySelected() {
  const L = selLayer();
  if (L) { S.clipboard = clone(L); toast('Copied "' + L.name + '"'); }
}

function pasteLayer() {
  if (!S.clipboard) return;
  const C = clone(S.clipboard);
  C.id = uid();
  C.name = nextName(C.name.replace(/ \d+$/, ''));
  delete C.twin; delete C.side; C.linked = false;
  const off = Math.round(Math.min(sh().width, sh().height) * 0.015);
  C.x += off; C.y += off;
  S.clipboard.x = C.x; S.clipboard.y = C.y;
  if (C.type === 'brush') C.ver = verCounter++;
  addLayer(C, S.sel);
}

async function addImageFromFile(file, at) {
  try {
    const url = await fileToImageURL(file);
    const img = await loadImage(url);
    const id = addAsset(url, img);
    const s = sh();
    const k = Math.min((s.width * 0.35) / img.naturalWidth, (s.height * 0.35) / img.naturalHeight, 1);
    const c = at || viewCenter();
    addLayer(makeImage(id, c.x, c.y, img.naturalWidth * k, img.naturalHeight * k, file.name.replace(/\.[^.]+$/, '').slice(0, 30) || 'Image'), S.sel);
  } catch (e) {
    toast(e.message);
  }
}

// ============================================================ both sides: mirroring and linked copies
function zoneOfPoint(z, x, y) {
  const inside = (r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  const inL = inside(z.left), inR = inside(z.right);
  if (inL !== inR) return inL ? 'left' : 'right';
  const d = (r) => Math.hypot(x - (r.x + r.w / 2), y - (r.y + r.h / 2));
  return d(z.left) <= d(z.right) ? 'left' : 'right';
}

function mapPoint(z, from, x, y) {
  const A = z[from], B = z[from === 'left' ? 'right' : 'left'];
  let u = (x - A.x) / A.w;
  const v = (y - A.y) / A.h;
  if (z.mirrorPos) u = 1 - u;
  return { x: B.x + u * B.w, y: B.y + v * B.h };
}

// Rebuilds L's twin on the other side from L (position, size and every style).
function syncTwin(L, force) {
  if (!L || !L.twin || (!L.linked && !force)) return;
  const s = sh();
  const idx = s.layers.findIndex((l) => l.id === L.twin);
  if (idx < 0) { delete L.twin; L.linked = false; return; }
  const T = s.layers[idx];
  const z = s.zones;
  const from = L.side || zoneOfPoint(z, frameOf(L).cx, frameOf(L).cy);
  const to = from === 'left' ? 'right' : 'left';
  L.side = from;
  const A = z[from], B = z[to];
  const kx = B.w / A.w, ky = B.h / A.h, mir = z.mirrorPos;
  const C = clone(L);
  Object.assign(C, { id: T.id, name: T.name, twin: L.id, side: to, linked: L.linked, visible: T.visible, locked: T.locked });
  const o = mapPoint(z, from, L.x, L.y);
  C.x = o.x; C.y = o.y;
  if (L.type === 'brush') {
    const ks = Math.sqrt(kx * ky);
    C.strokes = L.strokes.map((st) => Object.assign({}, st, { size: st.size * ks, pts: st.pts.map((v, i) => (i % 2 ? v * ky : v * kx * (mir ? -1 : 1))) }));
    C.ver = verCounter++;
  } else {
    if (L.type === 'text') { C.size = L.size * ky; C.sx = (L.sx * kx) / ky; }
    else { C.w = L.w * kx; C.h = L.h * ky; }
    C.rotation = mir ? -L.rotation : L.rotation;
    C.flipX = z.flipContent ? !L.flipX : L.flipX;
  }
  s.layers[idx] = C;
}

function mirrorSelected() {
  const L = selLayer();
  if (!L) { toast('Select something first, then mirror it.'); return; }
  if (L.twin && findLayer(L.twin)) {
    select(L.twin);
    toast('This already has a copy on the other side. It is selected now.');
    return;
  }
  const s = sh();
  const f = frameOf(L);
  const side = zoneOfPoint(s.zones, f.cx, f.cy);
  const other = side === 'left' ? 'right' : 'left';
  const T = clone(L);
  T.id = uid();
  T.name = L.name.replace(/ \((left|right)\)$/, '') + ' (' + other + ')';
  if (!/ \((left|right)\)$/.test(L.name)) L.name += ' (' + side + ')';
  L.side = side; L.twin = T.id; L.linked = true;
  T.side = other; T.twin = L.id; T.linked = true;
  s.layers.splice(s.layers.indexOf(L) + 1, 0, T);
  syncTwin(L, true);
  if (S.view === 'left' || S.view === 'right') setView('both');
  pushHistory();
  refreshAll();
  toast('Copied to the ' + other + ' side. The two copies are linked.');
}

function syncAllTwins() {
  for (const L of sh().layers.slice()) if (L.twin && L.linked && L.side === 'left') syncTwin(L);
}

// ============================================================ sheet actions
function scaleSheet(s, w, h) {
  w = clamp(Math.round(w), 64, 8192);
  h = clamp(Math.round(h), 64, 8192);
  const kx = w / s.width, ky = h / s.height;
  if (kx === 1 && ky === 1) return;
  for (const L of s.layers) {
    L.x *= kx; L.y *= ky;
    if (L.type === 'text') { L.size *= ky; L.sx *= kx / ky; }
    else if (L.type === 'brush') {
      const ks = Math.sqrt(kx * ky);
      L.strokes.forEach((st) => { st.size *= ks; st.pts = st.pts.map((v, i) => (i % 2 ? v * ky : v * kx)); });
      L.ver = verCounter++;
    } else { L.w *= kx; L.h *= ky; }
  }
  for (const key of ['left', 'right']) {
    const r = s.zones[key];
    r.x = Math.round(r.x * kx); r.y = Math.round(r.y * ky); r.w = Math.round(r.w * kx); r.h = Math.round(r.h * ky);
  }
  s.width = w;
  s.height = h;
  S.cams = {};
}

async function loadTemplate(file) {
  if (!file) return;
  try {
    const url = await fileToImageURL(file);
    const img = await loadImage(url);
    const s = sh();
    s.template.assetId = addAsset(url, img);
    s.template.name = file.name;
    s.template.w = img.naturalWidth;
    s.template.h = img.naturalHeight;
    if (s.layers.length === 0) scaleSheet(s, img.naturalWidth, img.naturalHeight);
    else if (img.naturalWidth !== s.width || img.naturalHeight !== s.height) toast('The template is ' + img.naturalWidth + ' × ' + img.naturalHeight + '. Click "Match template" in the Sheet tab to use that size.', 5000);
    S.cams = {};
    pushHistory();
    refreshAll();
    toast('Template loaded. Next: mark the left and right sides with "Set side areas".', 4500);
  } catch (e) {
    toast(e.message, 6000);
  }
}

function collectMaterials(data) {
  const out = {};
  const visit = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const [key, m] of Object.entries(obj)) {
      if (m && typeof m === 'object' && !Array.isArray(m) && (m.class === 'Material' || Array.isArray(m.Stages) || m.mapTo)) {
        out[m.mapTo || m.name || key] = m;
      }
    }
  };
  if (Array.isArray(data)) data.forEach(visit); else visit(data);
  return out;
}

const isPaintable = (m) => m.instanceDiffuse === true || (Array.isArray(m.Stages) && m.Stages.some((st) => st && (st.instanceDiffuse === true || st.colorPaletteMap)));
const isSkin = (name) => /\.skin\./.test(name);

async function loadMaterials(file) {
  if (!file) return;
  let found;
  try { found = collectMaterials(parseLoose(await file.text())); } catch (e) { toast('Could not read that file: ' + e.message, 6000); return; }
  const names = Object.keys(found);
  if (!names.length) { toast('No materials were found in that file.'); return; }
  P.materialLib = Object.assign({}, P.materialLib, found);
  const s = sh();
  if (!s.materials.length) {
    const base = names.filter((n) => !isSkin(n) && isPaintable(found[n]));
    const main = base.filter((n) => /main/i.test(n));
    s.materials = (main.length ? main : base).slice(0, 1);
  }
  if (!P.vehicle.folder) {
    const m = /vehicles\/([^/"]+)\//i.exec(JSON.stringify(found));
    if (m && m[1] !== 'common') P.vehicle.folder = m[1];
  }
  pushHistory();
  refreshAll();
  toast('Loaded ' + names.length + ' materials from ' + file.name);
}

async function readSlotType(file) {
  if (!file) return;
  try {
    const data = parseLoose(await file.text());
    for (const part of Object.values(data)) {
      if (part && part.slotType && part.globalSkin) {
        P.vehicle.slotType = part.slotType;
        pushHistory();
        refreshExportPane();
        toast('Slot type set to "' + part.slotType + '"');
        return;
      }
    }
    const any = Object.values(data).find((p) => p && p.slotType);
    toast(any ? 'That file is not a skin (its slot type is "' + any.slotType + '"). Pick a skin\'s .jbeam.' : 'No slot type found in that file.', 5000);
  } catch (e) {
    toast('Could not read that file: ' + e.message, 6000);
  }
}

// ============================================================ the vehicle file (drag the vehicle's .zip in)
const IMAGE_RE = /\.(png|jpe?g|dds|webp|bmp)$/i;
const COLOR_KEYS = ['baseColorMap', 'colorMap', 'diffuseMap'];
// Folder names of the game's own vehicles. A copy of one of these must never go in the mods folder.
const STOCK_VEHICLES = new Set(['autobello', 'barstow', 'bastion', 'bluebuck', 'bolide', 'burnside', 'bx', 'citybus', 'covet',
  'etk800', 'etkc', 'etki', 'fullsize', 'hopper', 'lansdowne', 'legran', 'md_series', 'midsize', 'midtruck', 'miramar',
  'moonhawk', 'nine', 'pessima', 'pickup', 'racetruck', 'roamer', 'sbr', 'scintilla', 'semi', 'sunburst', 'us_semi',
  'van', 'vivace', 'wendover', 'wigeon', 'wl40', 'utv', 'atv', 'dryvan', 'tanker', 'flatbed', 'cargotrailer']);
let VZ = null; // the vehicle zip that was dragged in (only kept while the app is open)

const joinList = (a) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);

async function eachLimited(items, limit, fn) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      try { await fn(item); } catch (e) { /* an unreadable file is skipped */ }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

function findVehicleFolders(zip) {
  const found = new Map();
  for (const e of zip.entries) {
    const m = /^((?:[^/]+\/)*?)vehicles\/([^/]+)\/(.+)$/i.exec(e.name);
    if (!m || m[2].toLowerCase() === 'common' || e.name.endsWith('/')) continue;
    const base = m[1] + 'vehicles/' + m[2] + '/';
    let f = found.get(base.toLowerCase());
    if (!f) found.set(base.toLowerCase(), (f = { folder: m[2], prefix: m[1], base, files: 0 }));
    if (/\.(jbeam|materials\.json)$/i.test(m[3])) f.files++;
  }
  return [...found.values()].filter((f) => f.files > 0).sort((a, b) => a.prefix.length - b.prefix.length || b.files - a.files);
}

// Finds the zip entry a material's texture path points to. BeamNG paths may or may not
// start with "/", may be relative to the materials file, and .png/.dds get swapped.
function resolveTexture(zip, prefix, dir, path) {
  if (typeof path !== 'string' || !path) return null;
  const p = path.replace(/\\/g, '/').replace(/^\.\//, '');
  const tries = p.startsWith('/') ? [p.slice(1)] : /^vehicles\//i.test(p) ? [p] : [dir.replace(/^\//, '') + p, p];
  for (const t of tries) {
    const stem = t.replace(/\.[^./]+$/, '');
    for (const s of [stem, stem.replace(/\.(color|data|normal)$/i, '')]) {
      for (const ext of [t.slice(stem.length), '.png', '.dds', '.jpg']) {
        const e = zip.byName.get((prefix + s + ext).toLowerCase());
        if (e) return e;
      }
    }
  }
  return null;
}

async function zipImageURL(zip, entry) {
  const bytes = await Zip.read(zip, entry);
  if (/\.dds$/i.test(entry.name)) return ddsToURL(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const type = /\.png$/i.test(entry.name) ? 'image/png' : /\.webp$/i.test(entry.name) ? 'image/webp' : /\.bmp$/i.test(entry.name) ? 'image/bmp' : 'image/jpeg';
  return readDataURL(new Blob([bytes], { type }));
}

// Reads what the app needs from one vehicle folder in the zip: its name, materials,
// the slot type its skins use, the paint material and the best template pictures.
async function analyzeVehicle(zip, f) {
  const base = f.base.toLowerCase();
  const inside = zip.entries.filter((e) => e.lower.startsWith(base) && !e.lower.endsWith('/'));
  const liveryDirs = inside.filter((e) => e.lower.endsWith('.livery')).map((e) => e.lower.slice(0, e.lower.lastIndexOf('/') + 1));
  const own = inside.filter((e) => !liveryDirs.some((d) => e.lower.startsWith(d)));
  const a = { own: own.length, info: null, materials: {}, matDirs: {}, slotType: 'paint_design', slotFound: false, hasSlot: false, mat: null, images: [] };

  const infoEntry = zip.byName.get(base + 'info.json');
  if (infoEntry) { try { a.info = parseLoose(await Zip.readText(zip, infoEntry)); } catch (e) { /* no nice name then */ } }
  const words = a.info ? [a.info.Brand, a.info.Name].filter((x) => typeof x === 'string' && x.trim()) : [];
  a.niceName = words.join(' ') || f.folder;

  await eachLimited(own.filter((e) => e.lower.endsWith('.materials.json')), 6, async (e) => {
    const found = collectMaterials(parseLoose(await Zip.readText(zip, e)));
    const dir = '/' + e.name.slice(f.prefix.length, e.name.lastIndexOf('/') + 1);
    for (const [k, m] of Object.entries(found)) { a.materials[k] = m; a.matDirs[k] = dir; }
  });

  const slots = {};
  await eachLimited(own.filter((e) => e.lower.endsWith('.jbeam') && e.usize < 4e6).slice(0, 1000), 8, async (e) => {
    const text = await Zip.readText(zip, e);
    if (text.includes('"paint_design"')) a.hasSlot = true;
    if (!text.includes('globalSkin')) return;
    for (const part of Object.values(parseLoose(text))) {
      if (part && typeof part === 'object' && part.globalSkin && part.slotType) slots[part.slotType] = (slots[part.slotType] || 0) + 1;
    }
  });
  const best = Object.entries(slots).sort((x, y) => y[1] - x[1])[0];
  if (best) { a.slotType = best[0]; a.slotFound = true; a.hasSlot = true; }

  // The paint material is the one the vehicle's own skins change, or else the paintable "main" one.
  const names = Object.keys(a.materials);
  const byMain = (x, y) => /main/i.test(y) - /main/i.test(x);
  const skinned = {};
  for (const n of names) {
    if (!isSkin(n)) continue;
    const b = n.split('.skin.')[0];
    if (a.materials[b]) skinned[b] = (skinned[b] || 0) + 1;
  }
  a.mat = Object.keys(skinned).sort((x, y) => skinned[y] - skinned[x] || byMain(x, y))[0] || null;
  if (!a.mat) a.mat = names.filter((n) => !isSkin(n) && isPaintable(a.materials[n])).sort(byMain)[0] || null;

  // Template pictures, best first: UV templates, textures the vehicle's own skins use, then the
  // paint material's texture. Textures can live anywhere in the zip, not only in this folder.
  const skinRefs = new Set(), matRefs = new Set(), byLower = new Map();
  const addRefs = (name, into) => {
    const m = a.materials[name];
    if (!m) return;
    for (const st of [m].concat(Array.isArray(m.Stages) ? m.Stages : [])) {
      if (!st) continue;
      for (const k of COLOR_KEYS) {
        const e = resolveTexture(zip, f.prefix, a.matDirs[name] || '/' + f.base.slice(f.prefix.length), st[k]);
        if (e) { into.add(e.lower); byLower.set(e.lower, e); }
      }
    }
  };
  if (a.mat) { addRefs(a.mat, matRefs); for (const n of names) if (n.startsWith(a.mat + '.skin.')) addRefs(n, skinRefs); }

  // BeamNG's menu pictures (default.jpg, one per .pc config, ...) are never the texture.
  const configs = new Set(own.filter((e) => e.lower.endsWith('.pc')).map((e) => e.lower.slice(0, -3)));
  const depth = base.split('/').length;
  const isPreview = (e) => {
    const stem = e.lower.replace(/\.[^./]+$/, '');
    const file = stem.slice(stem.lastIndexOf('/') + 1);
    return file === 'default' || configs.has(stem) || /(preview|thumb|icon|screenshot|banner|logo)/.test(file) ||
      /\/ui\//.test(e.lower) || (/\.jpe?g$/.test(e.lower) && stem.split('/').length === depth);
  };
  const score = (e) => {
    const n = e.lower.slice(e.lower.lastIndexOf('/') + 1);
    let s = 0;
    if (/(skin_?uvs?|uv_?(map|template|layout)|_uvs?\.|template)/.test(n) && !/palette/.test(n)) s += 100;
    if (skinRefs.has(e.lower)) s += 80;
    else if (matRefs.has(e.lower)) s += 60;
    if (/(\.color\.|_d\.|_b\.|_c\.|diffuse|albedo|basecolor)/.test(n)) s += 20;
    if (/(\.normal\.|_nm\.|_n\.|\.data\.|_ao\.|palette|_spec|_rough|_metal|_s\.|_r\.)/.test(n)) s -= 50;
    return s;
  };
  const pool = new Map(own.filter((e) => IMAGE_RE.test(e.name)).map((e) => [e.lower, e]));
  for (const [k, e] of byLower) pool.set(k, e);
  a.candidates = [...pool.values()].map((e) => ({ e, s: score(e), preview: isPreview(e), ref: matRefs.has(e.lower) }))
    .sort((x, y) => x.preview - y.preview || y.s - x.s || x.e.name.localeCompare(y.e.name));
  a.models = own.filter((e) => e.lower.endsWith('.dae') && e.usize > 0).sort((x, y) => y.usize - x.usize);
  return a;
}

function vehicleKind(zip, f) {
  if (zip.entries.some((e) => e.lower.startsWith('mod_info/'))) return 'repo';
  if (!STOCK_VEHICLES.has(f.folder.toLowerCase())) return 'mod';
  return zip.file.name.replace(/\.zip$/i, '').toLowerCase() === f.folder.toLowerCase() ? 'stock' : 'stockpart';
}

const UV_LABEL = 'Panel outlines drawn from the 3D model';
const relName = (e) => (e.lower.startsWith(VZ.base.toLowerCase()) ? e.name.slice(VZ.base.length) : e.name.slice(VZ.prefix.length));

async function decodeCandidate(e) {
  const url = await zipImageURL(VZ.zip, e);
  return { url, img: await loadImage(url), zipRel: e.name.slice(VZ.prefix.length), name: relName(e) };
}

function useTemplate(s, r) {
  const { img } = r;
  s.template.assetId = addAsset(r.url, img, r.zipRel);
  s.template.name = r.name;
  s.template.w = img.naturalWidth;
  s.template.h = img.naturalHeight;
  if (s.layers.length === 0) scaleSheet(s, img.naturalWidth, img.naturalHeight);
  else if (img.naturalWidth !== s.width || img.naturalHeight !== s.height) toast('The template is ' + img.naturalWidth + ' × ' + img.naturalHeight + '. Click "Match template" in the Sheet tab to use that size.', 5000);
  S.cams = {};
  return r.name;
}

async function setTemplateFromZip(s, entry) {
  return useTemplate(s, await decodeCandidate(entry));
}

// Real textures are square-ish powers of two (1024, 2048, 4096...). Menu pictures and screenshots aren't.
const isPow2 = (n) => n >= 256 && (n & (n - 1)) === 0;
function isPlain(img) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0, 32, 32);
  const d = x.getImageData(0, 0, 32, 32).data;
  let sum = 0, sum2 = 0;
  for (let i = 0; i < d.length; i += 4) { const l = d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11; sum += l; sum2 += l * l; }
  const n = d.length / 4;
  return Math.sqrt(Math.max(0, sum2 / n - (sum / n) ** 2)) < 4;
}
const isTexture = (img) => isPow2(img.naturalWidth) && isPow2(img.naturalHeight) && !isPlain(img);

// Outlines of every painted panel, from the vehicle's .dae models. spec = "uv:<materials>@<w>x<h>"
async function uvTemplateURL(spec) {
  const m = /^uv:(.*)@(\d+)x(\d+)$/.exec(spec);
  if (!m || !VZ || !VZ.models.length) return null;
  const mats = m[1].split(',').filter(Boolean);
  const parts = [];
  let total = 0;
  for (const e of VZ.models) {
    if (e.usize > 150e6 || total + e.usize > 400e6) continue;
    total += e.usize;
    try { const r = UVMap.fromCollada(await Zip.readText(VZ.zip, e), mats); if (r) parts.push(r); } catch (err) { /* skip that model */ }
  }
  return parts.length ? UVMap.draw(parts, +m[2], +m[3]).toDataURL('image/png') : null;
}

async function setUVTemplate(s, w, h) {
  const mats = s.materials.length ? s.materials : VZ.mat ? [VZ.mat] : [];
  if (!mats.length) return null;
  const spec = 'uv:' + mats.join(',') + '@' + w + 'x' + h;
  const url = await uvTemplateURL(spec);
  if (!url) return null;
  return useTemplate(s, { url, img: await loadImage(url), zipRel: spec, name: UV_LABEL });
}

async function autoTemplate(s) {
  const cands = VZ.candidates.filter((c) => !c.preview);
  let fallback = null;
  const attempt = async (c) => {
    try { const r = await decodeCandidate(c.e); fallback = fallback || r; return r; } catch (err) { return null; }
  };
  // 1. A UV template picture, or a texture one of the vehicle's own skins uses.
  for (const c of cands.filter((x) => x.s >= 80).slice(0, 6)) {
    const r = await attempt(c);
    if (r && isTexture(r.img)) return useTemplate(s, r);
  }
  // 2. The panel outlines from the 3D model, at the size of the paint texture.
  const own = [];
  for (const c of cands.filter((x) => x.ref).slice(0, 4)) { const r = await attempt(c); if (r) own.push(r); }
  const sized = own.find((r) => isPow2(r.img.naturalWidth) && isPow2(r.img.naturalHeight));
  if (VZ.models.length) {
    toast('Drawing the template from the vehicle\'s 3D model…', 60000);
    const name = await setUVTemplate(s, sized ? sized.img.naturalWidth : 2048, sized ? sized.img.naturalHeight : 2048);
    if (name) return name;
  }
  // 3. The paint texture itself, then any other real texture.
  for (const r of own) if (isTexture(r.img)) return useTemplate(s, r);
  for (const c of cands.filter((x) => x.s > -50 && x.s < 80 && !x.ref).slice(0, 6)) {
    const r = await attempt(c);
    if (r && isTexture(r.img)) return useTemplate(s, r);
  }
  // 4. Anything that opened, as long as it isn't a menu picture.
  return fallback ? useTemplate(s, fallback) : null;
}

// Pictures that came from a vehicle zip are not stored inside the livery; get them back from the zip.
async function fillZipAssets(zip, prefix) {
  for (const a of assets.values()) {
    if (!a.zipRel || a.url) continue;
    if (a.zipRel.startsWith('uv:')) { try { a.url = await uvTemplateURL(a.zipRel); a.img = null; } catch (err) { /* stays missing */ } continue; }
    const e = zip.byName.get((prefix + a.zipRel).toLowerCase());
    if (!e) continue;
    try { a.url = await zipImageURL(zip, e); a.img = null; } catch (err) { /* stays missing */ }
  }
}
const missingZipAssets = () => [...assets.values()].filter((a) => a.zipRel && !a.url).length;

async function applyVehicle(zip, f, a, keep) {
  VZ = Object.assign({ zip, file: zip.file, kind: vehicleKind(zip, f) }, f, a);
  P.materialLib = a.materials;
  P.materialDirs = a.matDirs;
  P.vehicle.folder = f.folder;
  P.vehicle.vehicleName = a.niceName;
  P.vehicle.sourceZip = zip.file.name;
  if (a.slotFound || !keep) P.vehicle.slotType = a.slotType;
  await fillZipAssets(zip, f.prefix);
  const s = P.sheets[0];
  if ((!keep || !s.materials.length) && a.mat) s.materials = [a.mat];
  const cur = s.template.assetId && assets.get(s.template.assetId);
  const tpl = cur && cur.url ? s.template.name : await autoTemplate(s);
  S.makeMode = null;
  pushHistory();
  refreshAll();
  const found = [a.mat && 'paint material', a.hasSlot && 'Paint Design slot'].filter(Boolean);
  toast('Loaded ' + a.niceName + (found.length ? ', with its ' + joinList(found) : '') + '. ' +
    (tpl ? 'Template: ' + tpl + '. Wrong picture? Pick another from the Template list above the canvas.' : 'No template picture was found. Pick one from the Template list above the canvas, or load one in the Sheet tab.'), 9000);
}

function resetDesign() {
  assets.clear();
  P = newProject();
  VZ = null;
  S.sheet = 0; S.sel = null; S.cams = {}; S.makeMode = null;
  layoutCache = new WeakMap();
  resetHistory();
}

async function openZip(file) {
  toast('Reading ' + file.name + '…', 60000);
  try {
    const zip = await Zip.open(file);
    const folders = findVehicleFolders(zip);
    if (!folders.length) { toast('There is no vehicle in "' + file.name + '". A vehicle file has a vehicles\\NAME\\ folder inside it.', 7000); return; }
    let f = folders[0];
    if (folders.length > 1) {
      $('#toast').classList.add('hidden');
      const i = await ask('Which vehicle?', 'This file has more than one vehicle in it. Pick the one you want to make a livery for.', folders.map((x) => x.folder));
      if (i < 0) return;
      f = folders[i];
      toast('Reading ' + file.name + '…', 60000);
    }
    const a = await analyzeVehicle(zip, f);
    const hasVehicle = a.own > 0;
    const mine = zip.entries.filter((e) => /\.livery$/i.test(e.name) && e.lower.startsWith(f.base.toLowerCase()));
    $('#toast').classList.add('hidden');

    let editData = null;
    const list = [];
    for (const e of mine) { try { list.push(JSON.parse(await Zip.readText(zip, e))); } catch (err) { /* not one of ours */ } }
    if (list.length) {
      const btns = list.map((d) => 'Edit "' + ((d.vehicle && d.vehicle.displayName) || 'my livery') + '"');
      if (hasVehicle) btns.push('Make a new livery');
      const i = await ask('Keep editing your livery?', '<b>' + esc(file.name) + '</b> has ' + (list.length === 1 ? 'a livery' : list.length + ' liveries') + ' you made with this app.' + (hasVehicle ? ' Keep working on it, or make a new one?' : ' Pick one to keep working on.'), btns);
      if (i < 0) return;
      if (i < list.length) editData = list[i];
    }
    if (!editData && !hasVehicle) { toast('"' + file.name + '" only has a livery in it, not the vehicle. Drag in the vehicle\'s own .zip file.', 7000); return; }

    if (editData) loadProjectData(editData);
    else if (hasContent()) {
      const i = await ask('Use this vehicle for your design?', 'You already have a design open.', ['Use it for my design', 'Start a new livery']);
      if (i < 0) return;
      if (i === 1) resetDesign();
    }
    autosaveReady = true;
    if (hasVehicle) {
      await applyVehicle(zip, f, a, !!editData || hasContent());
    } else {
      VZ = null;
      refreshAll();
      toast(missingZipAssets() ? 'Your livery is back. Drag the vehicle\'s .zip in too, to see its template again.' : 'Your livery is back.', 7000);
    }
  } catch (e) {
    toast(e.message || 'That file could not be opened.', 7000);
  }
}

// ---------- questions and messages
let askDone = null;
function ask(title, html, buttons) {
  if (askDone) askDone(-1);
  return new Promise((resolve) => {
    $('#askTitle').textContent = title;
    $('#askText').innerHTML = html;
    $('#askBtns').innerHTML = buttons.map((b, i) => '<button class="btn' + (i === 0 ? ' primary' : '') + '" data-i="' + i + '">' + esc(b) + '</button>').join('');
    $('#askModal').classList.remove('hidden');
    askDone = (i) => { askDone = null; $('#askModal').classList.add('hidden'); resolve(i); };
  });
}
$('#askBtns').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b && askDone) askDone(+b.dataset.i); });
$('#askModal').addEventListener('click', (e) => { if (e.target.id === 'askModal' && askDone) askDone(-1); });

// ============================================================ export
function exportInfo() {
  const v = P.vehicle;
  const folder = String(v.folder || '').trim().replace(/[\\/:*?"<>|]+/g, '');
  const skinId = slug(v.skinId) || slug(v.displayName) || 'my_livery';
  const issues = [];
  if (!folder) issues.push({ err: 'Drag the vehicle\'s .zip file into the app first (or type the vehicle folder name under "Vehicle details").' });
  if (VZ && !VZ.hasSlot && folder.toLowerCase() === VZ.folder.toLowerCase()) issues.push({ warn: VZ.niceName + ' doesn\'t seem to have a Paint Design slot, so the livery may not show up in the parts menu. See "Troubleshooting" in the guide.' });
  const multi = P.sheets.length > 1;
  const usedSuffix = new Set();
  const sheets = P.sheets.map((s, i) => {
    let suffix = multi ? slug(s.name) || 'sheet' + (i + 1) : '';
    while (usedSuffix.has(suffix)) suffix += '_' + (i + 1);
    usedSuffix.add(suffix);
    const base = (folder || 'vehicle') + '_skin_' + skinId + (suffix ? '_' + suffix : '');
    const materials = s.materials.length ? s.materials : [(folder || 'vehicle') + '_main'];
    if (!s.materials.length) issues.push({ warn: 'Sheet "' + s.name + '": no material picked, so "' + materials[0] + '" is used. Load the vehicle\'s materials file in the Sheet tab to be sure.' });
    else {
      const missing = s.materials.filter((m) => !P.materialLib[m]);
      if (missing.length) issues.push({ warn: 'Sheet "' + s.name + '": ' + missing.join(', ') + ' was not loaded from the vehicle\'s materials file, so a generic glossy paint is used.' });
    }
    return { sheet: s, color: base + '.color.png', palette: s.background.paint ? base + '_palette.data.png' : null, materials };
  });
  const dir = 'vehicles/' + (folder || 'vehicle') + '/' + skinId + '/';
  return { folder, skinId, dir, sheets, issues, partName: (folder || 'vehicle') + '_skin_' + skinId };
}

function buildJbeam(info) {
  const v = P.vehicle;
  return JSON.stringify({
    [info.partName]: {
      information: { authors: v.author || 'Livery Designer', name: v.displayName || info.skinId, value: 0 },
      slotType: v.slotType || 'paint_design',
      globalSkin: info.skinId,
    },
  }, null, 2) + '\n';
}

const TEXTURE_RE = /\.(dds|png|jpe?g|tga|bmp|webp)$/i;
const ROOT_RE = /^(\/|@|vehicles\/|art\/|core\/|levels\/|assets\/|ui\/|common\/)/i;

// Texture paths relative to the original materials file would break in the livery's folder.
function fixPaths(obj, dir) {
  for (const k of Object.keys(obj)) {
    const val = obj[k];
    if (typeof val === 'string' && TEXTURE_RE.test(val) && !ROOT_RE.test(val)) obj[k] = dir + val.replace(/^\.\//, '');
    else if (val && typeof val === 'object') fixPaths(val, dir);
  }
}

function genericMaterial(name) {
  return {
    name, mapTo: name, class: 'Material', version: 1.5,
    Stages: [
      { baseColorMap: '', metallicFactor: 0.25, roughnessFactor: 0.32, clearCoatFactor: 1, clearCoatRoughnessFactor: 0.04, useAnisotropic: true, instanceDiffuse: true },
      {}, {}, {},
    ],
    dynamicCubemap: true, materialTag0: 'beamng', materialTag1: 'vehicle', translucentBlendOp: 'None',
  };
}

function skinMaterial(baseName, info, entry) {
  const base = P.materialLib[baseName];
  const m = clone(base || genericMaterial(baseName));
  const full = baseName + '.skin.' + info.skinId;
  m.name = full;
  m.mapTo = full;
  m.class = m.class || 'Material';
  delete m.persistentId;
  fixPaths(m, (P.materialDirs && P.materialDirs[baseName]) || '/vehicles/' + (info.folder || 'vehicle') + '/');
  const isPBR = Number(m.version) >= 1.5 || JSON.stringify(m.Stages || []).includes('baseColor');
  if (!Array.isArray(m.Stages) || !m.Stages.length) m.Stages = [{}, {}, {}, {}];
  let idx = m.Stages.findIndex((st) => st && st.colorPaletteMap);
  if (idx < 0) idx = m.Stages.findIndex((st) => st && st.instanceDiffuse === true);
  if (idx < 0) idx = 0;
  const st = m.Stages[idx] = m.Stages[idx] || {};
  const tex = '/' + info.dir + entry.color;
  const key = isPBR ? 'baseColorMap' : ('diffuseMap' in st && !('colorMap' in st) ? 'diffuseMap' : 'colorMap');
  st[key] = tex;
  if (isPBR && Array.isArray(st.baseColorFactor)) st.baseColorFactor = [1, 1, 1, 1];
  if (!isPBR && Array.isArray(st.diffuseColor)) st.diffuseColor = [1, 1, 1, 1];
  if (entry.palette && isPBR) {
    st.colorPaletteMap = '/' + info.dir + entry.palette;
    st.instanceDiffuse = true;
  } else {
    delete st.colorPaletteMap;
    st.instanceDiffuse = false;
  }
  if (m.instanceDiffuse === true) m.instanceDiffuse = false;
  return m;
}

function buildMaterials(info) {
  const out = {};
  for (const entry of info.sheets) for (const name of entry.materials) out[name + '.skin.' + info.skinId] = skinMaterial(name, info, entry);
  return JSON.stringify(out, null, 2) + '\n';
}

async function renderForExport(s, transparent) {
  const ids = [s.template.assetId, ...s.layers.filter((l) => l.type === 'image').map((l) => l.assetId)].filter(Boolean);
  await Promise.all(ids.map(waitAsset));
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  const c = document.createElement('canvas');
  c.width = s.width;
  c.height = s.height;
  drawSheet(c.getContext('2d'), s, { guides: false, k: 1, transparent });
  return c;
}

// Paint mode: empty areas become palette red (= in-game paint color 1) over a white base.
function splitPaint(c) {
  const w = c.width, h = c.height;
  const colorC = document.createElement('canvas');
  colorC.width = w; colorC.height = h;
  const cx = colorC.getContext('2d');
  cx.fillStyle = '#ffffff';
  cx.fillRect(0, 0, w, h);
  cx.drawImage(c, 0, 0);
  const src = c.getContext('2d').getImageData(0, 0, w, h).data;
  const palC = document.createElement('canvas');
  palC.width = w; palC.height = h;
  const px = palC.getContext('2d');
  const pal = px.createImageData(w, h);
  const d = pal.data;
  for (let i = 0; i < d.length; i += 4) { d[i] = 255 - src[i + 3]; d[i + 3] = 255; }
  px.putImageData(pal, 0, 0);
  return { colorC, palC };
}

async function liveryFiles(info) {
  const files = [
    { name: info.dir + info.partName + '.jbeam', data: buildJbeam(info) },
    { name: info.dir + 'skin.materials.json', data: buildMaterials(info) },
  ];
  for (const entry of info.sheets) {
    const paint = entry.sheet.background.paint;
    const c = await renderForExport(entry.sheet, paint);
    if (paint) {
      const { colorC, palC } = splitPaint(c);
      files.push({ name: info.dir + entry.color, data: await canvasBytes(colorC) });
      files.push({ name: info.dir + entry.palette, data: await canvasBytes(palC) });
    } else {
      files.push({ name: info.dir + entry.color, data: await canvasBytes(c) });
    }
  }
  files.push({ name: info.dir + info.skinId + '.livery', data: liveryFileJSON() });
  return files;
}

function canInside() {
  if (!VZ) return { ok: false, why: 'Drag the vehicle\'s .zip file into the app to use this.' };
  if (VZ.kind === 'stock') return { ok: false, why: 'Not for the game\'s own vehicles: a copy of ' + VZ.file.name + ' in your mods folder would break when the game updates.' };
  if (VZ.folder.toLowerCase() !== String(P.vehicle.folder || '').trim().toLowerCase()) return { ok: false, why: 'The vehicle folder under "Vehicle details" doesn\'t match the vehicle in ' + VZ.file.name + '.' };
  if (VZ.zip.zip64) return { ok: false, why: VZ.file.name + ' is too big to rebuild.' };
  return { ok: true };
}

function makeMode() {
  const inside = canInside().ok;
  if (S.makeMode === 'inside' && inside) return 'inside';
  if (S.makeMode === 'separate') return 'separate';
  return inside && VZ.kind === 'mod' ? 'inside' : 'separate';
}

const liveryZipName = (info) => info.skinId + '_' + (info.folder || 'vehicle') + '_livery.zip';

async function makeModFile() {
  refreshExportPane();
  const info = exportInfo();
  const err = info.issues.find((x) => x.err);
  if (err) { setPane('export'); toast(err.err, 6000); return; }
  const mode = makeMode();
  const btn = $('#btnMake');
  btn.disabled = true;
  btn.textContent = 'Making your mod file…';
  try {
    const files = await liveryFiles(info);
    let blob, name;
    if (mode === 'inside') {
      const dir = (VZ.prefix + info.dir).toLowerCase();
      blob = Zip.rebuild(VZ.zip, files.map((x) => ({ name: VZ.prefix + x.name, data: x.data })), (n) => n.toLowerCase().startsWith(dir));
      name = VZ.file.name;
    } else {
      files.push({ name: 'INSTALL - READ ME.txt', data: readme(info) });
      blob = Zip.build(files);
      name = liveryZipName(info);
    }
    download(blob, name);
    dirty = false;
    showDone(mode, name);
  } catch (e) {
    toast('Could not make the mod file: ' + e.message, 7000);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Make mod file';
  }
}

function showDone(mode, name) {
  const livery = esc(P.vehicle.displayName || 'your livery');
  const steps = [
    'Close BeamNG.drive if it is running.',
    'Open your mods folder: in the BeamNG launcher click <b>Manage User Folder</b>, then <b>Open in Explorer</b>, then open <b>mods</b>.',
    mode === 'inside'
      ? 'Drag <b>' + esc(name) + '</b> from your Downloads folder into the mods folder, and pick <b>Replace the file</b> when Windows asks.'
      : 'Drag <b>' + esc(name) + '</b> from your Downloads folder into the mods folder. Leave it as a zip; don\'t unzip it.',
    'Start the game, spawn the vehicle, open <b>Vehicle Config</b> (Ctrl+W) &gt; <b>Parts</b> &gt; <b>Paint Design</b> and pick <b>' + livery + '</b>.',
  ];
  const extra = mode === 'inside'
    ? '<p class="note">If your browser saved it as "' + esc(name.replace(/\.zip$/i, '')) + ' (1).zip", rename it to <b>' + esc(name) + '</b> first, so there is only one copy of the vehicle in your mods folder.</p>'
    : '';
  ask('Your mod file is ready', '<p><b>' + esc(name) + '</b> is in your Downloads folder.</p><ol>' + steps.map((x) => '<li>' + x + '</li>').join('') + '</ol>' + extra +
    '<p class="note">Want to change it later? Drag <b>' + esc(name) + '</b> back into this app and your design comes back, ready to edit.</p>', ['Got it']);
}

async function exportPngs() {
  const info = exportInfo();
  for (const entry of info.sheets) {
    const c = await renderForExport(entry.sheet, entry.sheet.background.paint);
    const bytes = await canvasBytes(entry.sheet.background.paint ? splitPaint(c).colorC : c);
    download(new Blob([bytes], { type: 'image/png' }), entry.color);
  }
}

function readme(info) {
  const v = P.vehicle;
  const name = v.displayName || info.skinId;
  return [
    'Livery: ' + name,
    'For: ' + (v.vehicleName || info.folder) + '   (vehicle folder: ' + info.folder + ')',
    'Made with BeamNG Livery Designer',
    '',
    'HOW TO INSTALL',
    '  1. Put this zip into your BeamNG mods folder. Do NOT unzip it.',
    '     (BeamNG launcher > Manage User Folder > Open in Explorer > mods)',
    '  2. Start the game and spawn the vehicle.',
    '  3. Vehicle Config (Ctrl+W) > Parts > Paint Design > "' + name + '"',
    '',
    'CHANGE IT LATER',
    '  Drag this zip into the Livery Designer app. Your design comes back, ready to edit.',
    '',
    'NOT SHOWING UP?',
    '  - Restart the game after adding the file.',
    '  - The vehicle must be installed too, and its folder must be vehicles\\' + info.folder + '\\',
    '  - If an old version still shows, clear the cache: launcher > Manage User Folder > Clear Cache.',
    '',
  ].join('\r\n');
}

// ============================================================ panels
function setPane(name) {
  $$('#paneltabs button').forEach((b) => b.classList.toggle('on', b.dataset.pane === name));
  $$('.pane').forEach((p) => p.classList.toggle('hidden', p.id !== 'pane-' + name));
  if (name === 'export') refreshExportPane();
  if (name === 'sheet') refreshSheetPane();
}

const ICON = { text: 'T', shape: '■', image: '▣', brush: '✎' };
const SVG_EYE = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const SVG_LOCK = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>';
const SVG_LINK = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#ffb37a" stroke-width="2"><path d="M10 13a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1M14 11a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1"/></svg>';

let dragRowId = null;
function renderLayerList() {
  const list = $('#layerlist');
  const layers = sh().layers;
  if (!layers.length) {
    list.innerHTML = '<div class="empty">No layers yet. Pick a tool on the left (Text, Shape, Stripe, Brush or Image) and click on the sheet.</div>';
  } else {
    list.innerHTML = layers.slice().reverse().map((L) => {
      const side = L.twin && findLayer(L.twin) ? '<span class="side ' + (L.side === 'right' ? 'R' : 'L') + '">' + (L.side === 'right' ? 'R' : 'L') + '</span>' + (L.linked ? SVG_LINK : '') : '';
      return '<div class="layer' + (L.id === S.sel ? ' sel' : '') + '" data-id="' + L.id + '" draggable="true">' +
        '<button class="tg' + (L.visible ? '' : ' off') + '" data-act="vis" title="Show / hide">' + SVG_EYE + '</button>' +
        '<button class="tg' + (L.locked ? '' : ' off') + '" data-act="lock" title="Lock">' + SVG_LOCK + '</button>' +
        '<span class="ico">' + (L.type === 'shape' && L.shape === 'ellipse' ? '●' : ICON[L.type]) + '</span>' +
        '<span class="name">' + esc(L.type === 'text' && /^Text( \d+)?( \((left|right)\))?$/.test(L.name) ? L.name + ': ' + String(L.text).split('\n')[0] : L.name) + '</span>' + side + '</div>';
    }).join('');
  }
  const L = selLayer();
  ['#lyUp', '#lyDown', '#lyDup', '#lyMirror', '#lyDel'].forEach((id) => { $(id).disabled = !L; });
}

$('#layerlist').addEventListener('click', (e) => {
  const row = e.target.closest('.layer');
  if (!row) return;
  const L = findLayer(row.dataset.id);
  const act = e.target.closest('[data-act]');
  if (act && L) {
    if (act.dataset.act === 'vis') L.visible = !L.visible;
    if (act.dataset.act === 'lock') L.locked = !L.locked;
    pushHistory();
    renderLayerList();
    buildProps();
    render();
    return;
  }
  select(row.dataset.id);
});
$('#layerlist').addEventListener('dblclick', (e) => {
  const row = e.target.closest('.layer');
  const L = row && findLayer(row.dataset.id);
  if (!L || e.target.closest('[data-act]')) return;
  const name = prompt('Layer name', L.name);
  if (name) { L.name = name.slice(0, 60); pushHistory(); renderLayerList(); buildProps(); }
});
$('#layerlist').addEventListener('dragstart', (e) => { const row = e.target.closest('.layer'); dragRowId = row && row.dataset.id; });
$('#layerlist').addEventListener('dragover', (e) => {
  const row = e.target.closest('.layer');
  if (!row || !dragRowId) return;
  e.preventDefault();
  $$('.layer', $('#layerlist')).forEach((r) => r.classList.toggle('drag-over', r === row));
});
$('#layerlist').addEventListener('drop', (e) => {
  const row = e.target.closest('.layer');
  $$('.layer').forEach((r) => r.classList.remove('drag-over'));
  if (!row || !dragRowId || row.dataset.id === dragRowId) return;
  e.preventDefault();
  const a = sh().layers;
  const from = a.findIndex((l) => l.id === dragRowId);
  const [L] = a.splice(from, 1);
  const to = a.findIndex((l) => l.id === row.dataset.id);
  a.splice(to + 1, 0, L); // dropped on a row = put it just above that row
  dragRowId = null;
  pushHistory();
  renderLayerList();
  render();
});

// ---------- properties
function getPath(o, path) { return path.split('.').reduce((v, k) => (v == null ? v : v[k]), o); }
function setPath(o, path, val) {
  const ks = path.split('.');
  let t = o;
  for (let i = 0; i < ks.length - 1; i++) { if (t[ks[i]] == null) t[ks[i]] = {}; t = t[ks[i]]; }
  t[ks[ks.length - 1]] = val;
}

function getProp(L, path) {
  if (path === 'x' || path === 'y') return frameOf(L)[path === 'x' ? 'cx' : 'cy'];
  if (path === 'w' || path === 'h') return layerSize(L)[path];
  return getPath(L, path);
}

function setProp(L, path, val) {
  if (path === 'x' || path === 'y') {
    const f = frameOf(L);
    L[path] += val - (path === 'x' ? f.cx : f.cy);
  } else if (path === 'w' || path === 'h') {
    const v = Math.max(1, val);
    if (L.type === 'text') {
      const t = textLayout(L);
      if (path === 'w') L.sx = v / t.natW; else L.sy = v / t.natH;
    } else L[path] = v;
  } else if (path === 'linked') {
    L.linked = val;
    const T = findLayer(L.twin);
    if (T) T.linked = val;
    renderLayerList();
  } else {
    setPath(L, path, val);
  }
}

const field = {
  num: (label, path, step = 1, extra = '') => '<div class="row"><label>' + label + '</label><input type="number" class="grow" data-prop="' + path + '" step="' + step + '" ' + extra + '></div>',
  range: (label, path, min, max, step, scale = 1) => '<div class="row"><label>' + label + '</label><input type="range" class="grow" data-prop="' + path + '" data-scale="' + scale + '" min="' + min + '" max="' + max + '" step="' + step + '"><input type="number" data-prop="' + path + '" data-scale="' + scale + '" min="' + min + '" max="' + max + '" step="' + step + '" style="width:62px"></div>',
  color: (label, path) => '<div class="row"><label>' + label + '</label><input type="color" data-prop="' + path + '"></div>',
  colorWidth: (label, cpath, wpath) => '<div class="row"><label>' + label + '</label><input type="color" data-prop="' + cpath + '"><input type="number" class="grow" data-prop="' + wpath + '" min="0" step="1" title="Thickness"></div>',
  check: (label, path, rebuild) => '<label class="check"><input type="checkbox" data-prop="' + path + '"' + (rebuild ? ' data-rebuild' : '') + '> ' + label + '</label>',
  select: (label, path, opts, rebuild, show) => '<div class="row"' + (show ? ' data-show="' + show + '"' : '') + '><label>' + label + '</label><select class="grow" data-prop="' + path + '"' + (rebuild ? ' data-rebuild' : '') + '>' +
    Object.entries(opts).map(([v, t]) => '<option value="' + esc(v) + '">' + esc(t) + '</option>').join('') + '</select></div>',
};

function fillFields(prefix) {
  return field.select('Fill', prefix + '.type', { solid: 'Solid color', gradient: 'Gradient', checker: 'Checkered', stripes: 'Stripes', none: 'None' }) +
    '<div class="row" data-show="' + prefix + '.type:solid|gradient|checker|stripes"><label>Colors</label><input type="color" data-prop="' + prefix + '.color"><span data-show="' + prefix + '.type:gradient|checker|stripes" style="display:contents"><input type="color" data-prop="' + prefix + '.color2"></span></div>' +
    '<div data-show="' + prefix + '.type:gradient|stripes">' + field.num('Angle', prefix + '.angle', 5) + '</div>' +
    '<div data-show="' + prefix + '.type:checker|stripes">' + field.num('Pattern size', prefix + '.size', 1, 'min="2"') + '</div>';
}

function shadowFields() {
  return field.check('Drop shadow', 'shadow.on') +
    '<div data-show="shadow.on:true">' +
    '<div class="row"><label>Shadow</label><input type="color" data-prop="shadow.color"><input type="number" class="grow" data-prop="shadow.blur" min="0" title="Blur"></div>' +
    '<div class="grid2"><div class="row"><label>x</label><input type="number" data-prop="shadow.x"></div><div class="row"><label>y</label><input type="number" data-prop="shadow.y"></div></div></div>';
}

function fontOptions(current) {
  const list = FONTS.slice();
  for (const f of P.fonts) if (!list.includes(f.family)) list.unshift(f.family);
  if (current && !list.includes(current)) list.unshift(current);
  return list.map((f) => '<option value="' + esc(f) + '">' + esc(f) + '</option>').join('') + '<option value="__other">Other font…</option>';
}

function buildProps() {
  const box = $('#props');
  const L = selLayer();
  if (!L) {
    box.innerHTML = '<h3>Properties</h3><p class="note">Select a layer to change it. Tip: double-click text on the canvas to edit its words.</p>';
    return;
  }
  let h = '<h3>' + esc(L.name) + '</h3>';
  if (L.type === 'text') {
    h += '<div class="row"><label>Text</label><textarea class="grow" rows="3" data-prop="text" id="propText"></textarea></div>' +
      '<div class="row"><label>Font</label><select class="grow" data-prop="font">' + fontOptions(L.font) + '</select></div>' +
      '<div class="btnrow"><button class="btn small" data-do="fontfile">Load font file…</button></div>' +
      field.num('Size', 'size', 1, 'min="1"') +
      '<div class="row"><label>Style</label><span class="grow" style="display:flex;gap:14px"><label class="check" style="margin:0"><input type="checkbox" data-prop="bold"> Bold</label><label class="check" style="margin:0"><input type="checkbox" data-prop="italic"> Italic</label></span></div>' +
      field.select('Align', 'align', { left: 'Left', center: 'Center', right: 'Right' }) +
      field.num('Spacing', 'letterSpacing', 1) + field.num('Line height', 'lineHeight', 0.05, 'min="0.5"') + field.num('Slant °', 'skew', 1) +
      '<h3>Colors</h3>' + fillFields('fill') +
      field.colorWidth('Outline', 'outline.color', 'outline.width') +
      field.colorWidth('Outer outline', 'outline2.color', 'outline2.width') + shadowFields();
  } else if (L.type === 'shape') {
    h += field.select('Shape', 'shape', SHAPES, true) +
      '<div data-show="shape:rect">' + field.num('Corners', 'radius', 1, 'min="0"') + '</div>' +
      '<div data-show="shape:star">' + field.num('Points', 'points', 1, 'min="3" max="40"') + field.num('Inner size', 'inner', 0.05, 'min="0.05" max="1"') + '</div>' +
      '<div data-show="shape:polygon">' + field.num('Sides', 'sides', 1, 'min="3" max="40"') + '</div>' +
      '<div data-show="shape:parallelogram">' + field.num('Slant', 'slant', 0.05, 'min="-0.9" max="0.9"') + '</div>' +
      '<div data-show="shape:chevron">' + field.num('Thickness', 'thickness', 0.05, 'min="0.05" max="0.95"') + '</div>' +
      '<h3>Colors</h3>' + fillFields('fill') + field.colorWidth('Outline', 'outline.color', 'outline.width') + shadowFields();
  } else if (L.type === 'image') {
    h += '<div class="btnrow"><button class="btn small" data-do="replaceimg">Replace picture…</button><button class="btn small" data-do="imgaspect">Original proportions</button></div>' +
      field.check('Recolor to one color', 'tint.on') + '<div data-show="tint.on:true">' + field.color('Color', 'tint.color') + '</div>' + shadowFields();
  } else if (L.type === 'brush') {
    h += '<p class="note">A freehand paint layer. Pick the Brush (B) or Eraser (E) tool to paint on it. Color and size are in the bar above the canvas.</p>' +
      '<div class="btnrow"><button class="btn small danger" data-do="clearpaint">Clear all paint</button></div>';
  }
  h += '<h3>Position</h3><div class="grid2"><div class="row"><label>x</label><input type="number" data-prop="x"></div><div class="row"><label>y</label><input type="number" data-prop="y"></div>';
  if (L.type !== 'brush') h += '<div class="row"><label>w</label><input type="number" data-prop="w" min="1"></div><div class="row"><label>h</label><input type="number" data-prop="h" min="1"></div>';
  h += '</div>';
  if (L.type !== 'brush') {
    h += field.num('Rotation °', 'rotation', 1) +
      '<div class="btnrow"><button class="btn small" data-do="flipx">Flip H</button><button class="btn small" data-do="flipy">Flip V</button>' +
      (L.type === 'text' ? '<button class="btn small" data-do="resetstretch">Undo stretch</button>' : '') +
      '<button class="btn small" data-do="center">Center on its side</button></div>';
  }
  h += '<h3>Look</h3>' + field.range('Opacity %', 'opacity', 0, 100, 1, 100) + field.select('Blend', 'blend', BLENDS);
  if (L.twin && findLayer(L.twin)) {
    h += '<h3>Other side</h3>' + field.check('Linked to the copy on the ' + (L.side === 'left' ? 'right' : 'left') + ' side', 'linked') +
      '<p class="note">While linked, every change here is copied to the other side (mirrored into place).</p>' +
      '<div class="btnrow"><button class="btn small" data-do="gotwin">Select the other side</button></div>';
  }
  box.innerHTML = h;
  refreshProps();
}

function showRule(L, rule) {
  const [path, vals] = rule.split(':');
  return vals.split('|').includes(String(getProp(L, path)));
}

function refreshProps() {
  const L = selLayer();
  if (!L) return;
  for (const el of $$('[data-prop]', $('#props'))) {
    if (el === document.activeElement && el.type !== 'range') continue;
    const v = getProp(L, el.dataset.prop);
    const scale = parseFloat(el.dataset.scale || '1');
    if (el.type === 'checkbox') el.checked = !!v;
    else if (el.type === 'number' || el.type === 'range') el.value = v == null ? '' : fmt(v * scale);
    else el.value = v == null ? '' : v;
  }
  for (const el of $$('[data-show]', $('#props'))) el.classList.toggle('hidden', !showRule(L, el.dataset.show));
}

function readInput(el) {
  if (el.type === 'checkbox') return el.checked;
  if (el.type === 'number' || el.type === 'range') {
    const v = parseFloat(el.value);
    return isNaN(v) ? null : v / parseFloat(el.dataset.scale || '1');
  }
  return el.value;
}

function afterEdit(L) {
  syncTwin(L);
  render();
}

$('#props').addEventListener('input', (e) => {
  const el = e.target.closest('[data-prop]');
  const L = selLayer();
  if (!el || !L || el.tagName === 'SELECT') return;
  const v = readInput(el);
  if (v === null) return;
  setProp(L, el.dataset.prop, v);
  afterEdit(L);
  if (el.dataset.prop === 'text') renderLayerList();
  refreshProps();
});

$('#props').addEventListener('change', async (e) => {
  const el = e.target.closest('[data-prop]');
  const L = selLayer();
  if (!el || !L) return;
  if (el.dataset.prop === 'font' && el.value === '__other') {
    const name = prompt('Type the name of a font installed on your computer (for example "Eurostile"):', L.font);
    if (name && name.trim()) L.font = name.trim();
    buildProps();
  } else {
    const v = readInput(el);
    if (v !== null) setProp(L, el.dataset.prop, v);
  }
  afterEdit(L);
  pushHistory();
  if (el.hasAttribute('data-rebuild')) { if (el.dataset.prop === 'shape') L.name = nextName(SHAPES[L.shape]); buildProps(); renderLayerList(); }
  else refreshProps();
});

$('#props').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-do]');
  const L = selLayer();
  if (!b || !L) return;
  const act = b.dataset.do;
  if (act === 'flipx') L.flipX = !L.flipX;
  else if (act === 'flipy') L.flipY = !L.flipY;
  else if (act === 'resetstretch') { const k = Math.sqrt(L.sx * L.sy); L.size *= k; L.sx = L.sy = 1; }
  else if (act === 'center') {
    const z = sh().zones[L.side || zoneOfPoint(sh().zones, L.x, L.y)];
    L.x = z.x + z.w / 2; L.y = z.y + z.h / 2;
  } else if (act === 'gotwin') { select(L.twin); return; }
  else if (act === 'clearpaint') { if (!confirm('Remove all paint on this layer?')) return; L.strokes = []; L.ver = verCounter++; }
  else if (act === 'imgaspect') { const img = assetImg(L.assetId); if (img) L.h = (L.w * img.naturalHeight) / img.naturalWidth; }
  else if (act === 'replaceimg') {
    const f = await pickFile('image/*,.dds');
    if (!f) return;
    try { const url = await fileToImageURL(f); const img = await loadImage(url); L.assetId = addAsset(url, img); L.h = (L.w * img.naturalHeight) / img.naturalWidth; } catch (err) { toast(err.message); return; }
  } else if (act === 'fontfile') {
    const f = await pickFile('.ttf,.otf,.woff,.woff2');
    if (!f) return;
    const family = f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim().slice(0, 40) || 'Custom font';
    const assetId = addAsset(await readDataURL(f));
    P.fonts = P.fonts.filter((x) => x.family !== family).concat([{ family, assetId }]);
    await registerFont(family, assetId);
    L.font = family;
    buildProps();
    toast('Font "' + family + '" loaded and saved in this project.');
  }
  afterEdit(L);
  pushHistory();
  refreshProps();
});

// ---------- tool options bar
function renderToolopts() {
  const t = S.tool;
  const color = '<label>Color <input type="color" id="toColor" value="' + S.color + '"></label>';
  let h = '';
  if (t === 'select') h = '<span class="hint">Click an item to select it. Drag to move. Corners resize, the round handle rotates. Double-click text to edit it.</span>';
  else if (t === 'hand') h = '<span class="hint">Drag to move around. Mouse wheel zooms. (Holding Space works with any tool.)</span>';
  else if (t === 'text') h = color + '<span class="hint">Click on the sheet where the text should go.</span>';
  else if (t === 'shape') h = '<label>Shape <select id="toShape">' + Object.entries(SHAPES).map(([k, v]) => '<option value="' + k + '"' + (k === S.shapeKind ? ' selected' : '') + '>' + v + '</option>').join('') + '</select></label>' + color + '<span class="hint">Drag on the sheet to draw it. Hold Shift to keep it even.</span>';
  else if (t === 'stripe') h = '<label>Thickness <input type="number" id="toStripe" min="1" value="' + S.stripeWidth + '" style="width:70px"></label>' + color + '<span class="hint">Drag to draw a stripe. Hold Shift to snap the angle.</span>';
  else if (t === 'brush' || t === 'eraser') h = (t === 'brush' ? color : '') + '<label>Size <input type="range" id="toSize" min="1" max="400" value="' + S.brushSize + '"><input type="number" id="toSizeN" min="1" max="2000" value="' + S.brushSize + '" style="width:64px"></label><span class="hint">' + (t === 'brush' ? 'Paints on the selected paint layer, or starts a new one.' : 'Erases on the selected paint layer.') + '</span>';
  else if (t === 'image') h = '<button class="btn small primary" id="toImage">Choose a picture…</button><span class="hint">Or drag a picture onto the sheet, or paste one with Ctrl+V. PNG logos with see-through backgrounds work best.</span>';
  else if (t === 'picker') h = color + '<span class="hint">Click on the sheet to pick up a color. It is used for new items and given to the selected item.</span>';
  $('#toolopts').innerHTML = h;
}

$('#toolopts').addEventListener('input', (e) => {
  if (e.target.id === 'toColor') S.color = e.target.value;
  if (e.target.id === 'toShape') S.shapeKind = e.target.value;
  if (e.target.id === 'toStripe') S.stripeWidth = Math.max(1, parseFloat(e.target.value) || 1);
  if (e.target.id === 'toSize' || e.target.id === 'toSizeN') {
    S.brushSize = clamp(parseFloat(e.target.value) || 1, 1, 2000);
    const other = $(e.target.id === 'toSize' ? '#toSizeN' : '#toSize');
    if (other) other.value = S.brushSize;
    render();
  }
});
$('#toolopts').addEventListener('click', async (e) => {
  if (e.target.id === 'toImage') { const f = await pickFile('image/*,.dds'); if (f) addImageFromFile(f); }
});

function setTool(t) {
  S.tool = t;
  $$('#tools button').forEach((b) => b.classList.toggle('on', b.dataset.tool === t));
  renderToolopts();
  updateCursor();
  render();
}
$('#tools').addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-tool]');
  if (!b) return;
  setTool(b.dataset.tool);
  if (b.dataset.tool === 'image') { const f = await pickFile('image/*,.dds'); if (f) addImageFromFile(f); }
});

// ---------- view bar
function setView(v) {
  S.view = v;
  $$('#viewseg button').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
  $('#btnZones').classList.toggle('on', v === 'zones');
  $('#stHint').textContent = v === 'zones' ? 'Drag the LEFT and RIGHT boxes over the two sides of the vehicle on the template. Pick a view above when you are done.' : '';
  render();
}
$('#viewseg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setView(b.dataset.view); });
$('#btnZones').addEventListener('click', () => setView(S.view === 'zones' ? 'full' : 'zones'));
$('#btnZones2').addEventListener('click', () => setView('zones'));

function zoomBy(f, vp, sx, sy) {
  vp = vp || (S.vps || viewports())[0];
  if (sx == null) { sx = vp.x + vp.w / 2; sy = vp.y + vp.h / 2; }
  const p = toTex(vp, sx, sy);
  const c = vp.cam;
  c.scale = clamp(c.scale * f, 0.01, 40);
  c.cx = p.x - (sx - (vp.x + vp.w / 2)) / c.scale;
  c.cy = p.y - (sy - (vp.y + vp.h / 2)) / c.scale;
  render();
}
function fitView() {
  if (S.view === 'both') { delete S.cams.bothL; delete S.cams.bothR; } else delete S.cams[S.view];
  render();
}
$('#zoomIn').addEventListener('click', () => zoomBy(1.25));
$('#zoomOut').addEventListener('click', () => zoomBy(0.8));
$('#zoomFit').addEventListener('click', fitView);

function renderSheetTabs() {
  $('#sheettabs').innerHTML = P.sheets.length > 1
    ? P.sheets.map((s, i) => '<button class="tab' + (i === S.sheet ? ' on' : '') + '" data-i="' + i + '">' + esc(s.name) + '</button>').join('')
    : '';
}
$('#sheettabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-i]');
  if (!b) return;
  S.sheet = +b.dataset.i;
  S.sel = null;
  refreshAll();
});

// ---------- sheet pane
function refreshSheetPane() {
  const s = sh();
  const t = s.template;
  const img = t.assetId ? assetImg(t.assetId) : null;
  $('#tplInfo').textContent = t.assetId ? (t.name || 'Template') + (img ? ' (' + img.naturalWidth + ' × ' + img.naturalHeight + ')' : '') : 'No template loaded.';
  $('#tplMode').value = t.mode;
  $('#tplOpacity').value = t.opacity;
  $('#tplBlend').value = t.blend;
  $('#bgColor').value = s.background.color;
  $('#bgPaint').checked = s.background.paint;
  $('#bgNote').textContent = s.background.paint ? 'preview of the in-game paint' : '';
  $('#zMirror').value = s.zones.mirrorPos ? '1' : '0';
  $('#zFlip').checked = !!s.zones.flipContent;
  for (const el of $$('[data-zone]')) if (el !== document.activeElement) el.value = Math.round(getPath(s.zones, el.dataset.zone));
  if (document.activeElement !== $('#shW')) $('#shW').value = s.width;
  if (document.activeElement !== $('#shH')) $('#shH').value = s.height;
  if (document.activeElement !== $('#matNames')) $('#matNames').value = s.materials.join(', ');
  const names = Object.keys(P.materialLib || {});
  const base = names.filter((n) => !isSkin(n)).sort((a, b) => (isPaintable(P.materialLib[b]) - isPaintable(P.materialLib[a])) || a.localeCompare(b));
  const skins = names.filter(isSkin);
  $('#matList').classList.toggle('hidden', !base.length);
  $('#matList').innerHTML = base.map((n) => '<label class="check"><input type="checkbox" data-mat="' + esc(n) + '"' + (s.materials.includes(n) ? ' checked' : '') + '> ' + esc(n) + (isPaintable(P.materialLib[n]) ? ' <span class="tag">paint</span>' : '') + '</label>').join('');
  const skinCount = new Set(skins.map((n) => n.split('.skin.')[1])).size;
  $('#matInfo').textContent = names.length ? base.length + ' materials loaded' + (skinCount ? ', and ' + skinCount + ' existing skin' + (skinCount === 1 ? '' : 's') + ', so this vehicle has a Paint Design slot.' : '.') : '';
  $('#btnDelSheet').disabled = P.sheets.length < 2;
  $('#btnMatchTpl').disabled = !img;
  $('#tplPickRow').classList.toggle('hidden', !VZ);
  $('#tplQuickWrap').classList.toggle('hidden', !VZ);
  if (VZ) for (const sel of [$('#tplPick'), $('#tplQuick')]) fillTemplateSelect(sel, t);
}

function fillTemplateSelect(sel, t) {
  const cands = VZ.candidates.slice(0, 300);
  const key = VZ.base + ':' + cands.length + ':' + VZ.models.length;
  if (sel.dataset.key !== key) {
    sel.innerHTML = '<option value="">Pick a template picture…</option>' +
      (VZ.models.length ? '<option value="uv">' + esc(UV_LABEL) + '</option>' : '') +
      cands.map((c) => '<option value="' + esc(c.e.name) + '">' + esc(relName(c.e)) + (c.preview ? ' (menu picture)' : '') + '</option>').join('');
    sel.dataset.key = key;
  }
  const a = t.assetId && assets.get(t.assetId);
  const rel = a && a.zipRel;
  const cur = rel && !rel.startsWith('uv:') && cands.find((c) => c.e.lower === (VZ.prefix + rel).toLowerCase());
  sel.value = rel && rel.startsWith('uv:') ? 'uv' : cur ? cur.e.name : '';
}

async function pickTemplate(value) {
  if (!VZ || !value) return;
  const s = sh();
  toast(value === 'uv' ? 'Drawing the template from the vehicle\'s 3D model…' : 'Opening the picture…', 60000);
  try {
    const name = value === 'uv'
      ? await setUVTemplate(s, isPow2(s.width) ? s.width : 2048, isPow2(s.height) ? s.height : 2048)
      : await setTemplateFromZip(s, VZ.zip.byName.get(value.toLowerCase()));
    if (!name) throw new Error('The 3D model has no panels with this sheet\'s material.');
    pushHistory();
    refreshAll();
    toast('Template: ' + name);
  } catch (err) {
    toast(err.message, 7000);
    refreshSheetPane();
  }
}

$('#btnLoadTpl').addEventListener('click', async () => loadTemplate(await pickFile('image/*,.dds')));
$('#tplPick').addEventListener('change', (e) => pickTemplate(e.target.value));
$('#tplQuick').addEventListener('change', (e) => pickTemplate(e.target.value));
$('#btnClearTpl').addEventListener('click', () => { sh().template.assetId = null; sh().template.name = ''; pushHistory(); refreshSheetPane(); render(); });
$('#tplMode').addEventListener('change', (e) => { sh().template.mode = e.target.value; pushHistory(); render(); });
$('#tplOpacity').addEventListener('input', (e) => { sh().template.opacity = parseFloat(e.target.value); render(); });
$('#tplOpacity').addEventListener('change', pushHistory);
$('#tplBlend').addEventListener('change', (e) => { sh().template.blend = e.target.value; pushHistory(); render(); });
$('#bgColor').addEventListener('input', (e) => { sh().background.color = e.target.value; render(); });
$('#bgColor').addEventListener('change', pushHistory);
$('#bgPaint').addEventListener('change', (e) => { sh().background.paint = e.target.checked; pushHistory(); refreshSheetPane(); });
$('#zMirror').addEventListener('change', (e) => { sh().zones.mirrorPos = e.target.value === '1'; syncAllTwins(); pushHistory(); render(); });
$('#zFlip').addEventListener('change', (e) => { sh().zones.flipContent = e.target.checked; syncAllTwins(); pushHistory(); render(); });
$$('[data-zone]').forEach((el) => {
  el.addEventListener('input', () => {
    const v = parseFloat(el.value);
    if (isNaN(v)) return;
    setPath(sh().zones, el.dataset.zone, /\.(w|h)$/.test(el.dataset.zone) ? Math.max(16, v) : v);
    S.cams = {};
    syncAllTwins();
    render();
  });
  el.addEventListener('change', pushHistory);
});
const applySize = (w, h) => { scaleSheet(sh(), w, h); pushHistory(); refreshAll(); };
$('#shW').addEventListener('change', () => applySize(parseFloat($('#shW').value) || sh().width, sh().height));
$('#shH').addEventListener('change', () => applySize(sh().width, parseFloat($('#shH').value) || sh().height));
$$('[data-size]').forEach((b) => b.addEventListener('click', () => applySize(+b.dataset.size, +b.dataset.size)));
$('#btnMatchTpl').addEventListener('click', () => { const img = assetImg(sh().template.assetId); if (img) applySize(img.naturalWidth, img.naturalHeight); });
$('#btnLoadMat').addEventListener('click', async () => loadMaterials(await pickFile('.json')));
$('#matList').addEventListener('change', (e) => {
  const n = e.target.dataset.mat;
  if (!n) return;
  const s = sh();
  s.materials = e.target.checked ? [...new Set(s.materials.concat(n))] : s.materials.filter((m) => m !== n);
  pushHistory();
  refreshSheetPane();
});
$('#matNames').addEventListener('change', (e) => {
  sh().materials = e.target.value.split(',').map((x) => x.trim()).filter(Boolean);
  pushHistory();
  refreshSheetPane();
});
$('#btnAddSheet').addEventListener('click', () => {
  const name = prompt('Name for the new sheet (for example "Box" or "Trailer"):', 'Sheet ' + (P.sheets.length + 1));
  if (!name) return;
  const s = newSheet(name.slice(0, 30), sh().width, sh().height);
  P.sheets.push(s);
  S.sheet = P.sheets.length - 1;
  S.sel = null;
  pushHistory();
  refreshAll();
  toast('New sheet added. Load its template and pick its material below.');
});
$('#btnRenameSheet').addEventListener('click', () => {
  const name = prompt('Sheet name', sh().name);
  if (name) { sh().name = name.slice(0, 30); pushHistory(); refreshAll(); }
});
$('#btnDelSheet').addEventListener('click', () => {
  if (P.sheets.length < 2 || !confirm('Delete the sheet "' + sh().name + '" and everything on it?')) return;
  P.sheets.splice(S.sheet, 1);
  S.sheet = Math.max(0, S.sheet - 1);
  S.sel = null;
  pushHistory();
  refreshAll();
});

// ---------- export pane
let exportTimer = 0;
function scheduleExportRefresh() { clearTimeout(exportTimer); exportTimer = setTimeout(refreshExportPane, 300); }

function refreshExportPane() {
  const v = P.vehicle;
  const set = (id, val) => { const el = $(id); if (el !== document.activeElement) el.value = val || ''; };
  set('#exFolder', v.folder);
  set('#exName', v.displayName);
  set('#exId', v.skinId);
  set('#exAuthor', v.author);
  set('#exSlot', v.slotType);
  $('#exId').placeholder = slug(v.displayName) || 'my_livery';
  const info = exportInfo();
  const can = canInside();
  const mode = makeMode();
  $('#mkVehicle').innerHTML = VZ
    ? 'Vehicle: <b>' + esc(VZ.niceName) + '</b> <span class="note">from ' + esc(VZ.file.name) + '</span>'
    : v.sourceZip
      ? 'Drag <b>' + esc(v.sourceZip) + '</b> into the app again to put the livery inside it.'
      : 'No vehicle file yet. <b>Drag the vehicle\'s .zip file into the app</b> and everything below is filled in for you.';
  for (const r of $$('input[name=mkMode]')) { r.checked = r.value === mode; r.closest('.choice').classList.toggle('on', r.checked); }
  $('#mkInside').disabled = !can.ok;
  $('#mkInsideRow').classList.toggle('disabled', !can.ok);
  $('#mkInsideNote').innerHTML = can.ok
    ? 'You get a new copy of <b>' + esc(VZ.file.name) + '</b> with your livery built in. Put it in your mods folder and replace the old one.'
    : esc(can.why);
  $('#mkSeparateNote').innerHTML = 'A small extra file, <b>' + esc(liveryZipName(info)) + '</b>, that adds the livery to the vehicle. Works for every vehicle, even the game\'s own ones. Put it in your mods folder next to the vehicle.';
  $('#mkNote').innerHTML = VZ && VZ.kind === 'repo' && mode === 'inside'
    ? '<div class="warn">This vehicle came from the BeamNG mod repository, which can update it and remove your livery. The separate livery file is safer.</div>' : '';
  $('#exIssues').innerHTML = info.issues.map((x) => '<div class="' + (x.err ? 'err' : 'warn') + '">' + esc(x.err || x.warn) + '</div>').join('');
  const lines = [mode === 'inside' && VZ ? VZ.file.name + '  (everything already in it, plus:)' : liveryZipName(info), '  ' + info.dir,
    '    ' + info.partName + '.jbeam', '    skin.materials.json'];
  for (const e of info.sheets) { lines.push('    ' + e.color); if (e.palette) lines.push('    ' + e.palette); }
  lines.push('    ' + info.skinId + '.livery   (your design, so you can edit it later)');
  if (mode !== 'inside') lines.push('  INSTALL - READ ME.txt');
  $('#exFiles').textContent = lines.join('\n');
  $('#exJbeamName').textContent = info.partName + '.jbeam';
  $('#exJbeam').value = buildJbeam(info);
  $('#exMat').value = buildMaterials(info);
}

const bindVehicle = (id, key, transform) => $(id).addEventListener('input', (e) => {
  P.vehicle[key] = transform ? transform(e.target.value) : e.target.value;
  scheduleExportRefresh();
});
bindVehicle('#exFolder', 'folder', (x) => x.trim());
bindVehicle('#exName', 'displayName');
bindVehicle('#exId', 'skinId');
bindVehicle('#exAuthor', 'author');
bindVehicle('#exSlot', 'slotType', (x) => x.trim());
['#exFolder', '#exName', '#exId', '#exAuthor', '#exSlot'].forEach((id) => $(id).addEventListener('change', () => { pushHistory(); refreshExportPane(); }));
$('#exId').addEventListener('change', (e) => { P.vehicle.skinId = slug(e.target.value); e.target.value = P.vehicle.skinId; refreshExportPane(); });
$('#btnReadJbeam').addEventListener('click', async () => readSlotType(await pickFile('.jbeam,.json')));
$('#btnMake').addEventListener('click', makeModFile);
$$('input[name=mkMode]').forEach((r) => r.addEventListener('change', () => { S.makeMode = r.value; refreshExportPane(); }));
$('#btnPng').addEventListener('click', exportPngs);
$$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
  const ta = $('#' + b.dataset.copy);
  try { await navigator.clipboard.writeText(ta.value); } catch (e) { ta.select(); document.execCommand('copy'); }
  toast('Copied');
}));

function renderVehicleChip() {
  const chip = $('#vehChip');
  if (VZ) chip.innerHTML = '<b>&#10003;</b> ' + esc(VZ.niceName);
  else if (P.vehicle.vehicleName) chip.textContent = P.vehicle.vehicleName + ' (vehicle file not loaded)';
  else chip.textContent = 'No vehicle loaded';
  chip.title = VZ ? VZ.file.name : '';
  $('#btnVehicle').textContent = VZ ? 'Change vehicle…' : 'Load vehicle file…';
}

function refreshAll() {
  renderVehicleChip();
  renderSheetTabs();
  renderLayerList();
  buildProps();
  refreshSheetPane();
  refreshExportPane();
  render();
}

// ============================================================ canvas input
function updateCursor() {
  const t = S.tool;
  view.style.cursor = S.space || t === 'hand' ? 'grab' : t === 'select' ? 'default' : t === 'picker' ? 'copy' : t === 'brush' || t === 'eraser' ? 'none' : 'crosshair';
}

function hitHandle(L, vp, sx, sy) {
  if (!L || !L.visible || L.locked || L.type === 'brush') return null;
  const h = handlesOf(L, vp);
  if (Math.hypot(sx - h.rot.x, sy - h.rot.y) <= 9) return { kind: 'rotate', f: h.f };
  for (const p of h.pts) if (Math.abs(sx - p.x) <= 7 && Math.abs(sy - p.y) <= 7) return { kind: 'resize', hx: p.hx, hy: p.hy, f: h.f };
  return null;
}

function topLayerAt(p) {
  const layers = sh().layers;
  for (let i = layers.length - 1; i >= 0; i--) {
    const L = layers[i];
    if (L.visible && !L.locked && hitLayer(L, p)) return L;
  }
  return null;
}

function snapMove(vp, f0, dx, dy) {
  const s = sh();
  const tol = 7 / vp.scale;
  const xs = [s.width / 2, s.zones.left.x + s.zones.left.w / 2, s.zones.right.x + s.zones.right.w / 2];
  const ys = [s.height / 2, s.zones.left.y + s.zones.left.h / 2, s.zones.right.y + s.zones.right.h / 2];
  const cx = f0.cx + dx, cy = f0.cy + dy;
  S.snapLines = [];
  for (const x of xs) if (Math.abs(cx - x) < tol) { dx = x - f0.cx; S.snapLines.push({ x }); break; }
  for (const y of ys) if (Math.abs(cy - y) < tol) { dy = y - f0.cy; S.snapLines.push({ y }); break; }
  return { dx, dy };
}

function startBrush(p) {
  let L = selLayer();
  if (!L || L.type !== 'brush' || L.locked || !L.visible) {
    if (S.tool === 'eraser') { toast('Select a paint layer first. The eraser only works on paint (brush) layers.'); return null; }
    L = makeBrush();
    const layers = sh().layers;
    const i = S.sel ? layers.findIndex((l) => l.id === S.sel) : -1;
    if (i >= 0) layers.splice(i + 1, 0, L); else layers.push(L);
    S.sel = L.id;
    renderLayerList();
    buildProps();
  }
  const st = { erase: S.tool === 'eraser', color: S.color, size: S.brushSize, pts: [p.x - L.x, p.y - L.y] };
  L.strokes.push(st);
  L.ver = verCounter++;
  brushCanvas(L, 384);
  return { kind: 'brush', L, st };
}

view.addEventListener('pointerdown', (e) => {
  const sx = e.offsetX, sy = e.offsetY;
  const vp = vpAt(sx, sy);
  if (!vp) return;
  view.setPointerCapture(e.pointerId);
  const p = toTex(vp, sx, sy);
  if (e.button === 1 || e.button === 2 || (e.button === 0 && (S.space || S.tool === 'hand'))) {
    S.drag = { kind: 'pan', vp, sx, sy, cx: vp.cam.cx, cy: vp.cam.cy };
    view.style.cursor = 'grabbing';
    return;
  }
  if (e.button !== 0) return;

  if (S.view === 'zones') {
    for (const key of ['right', 'left']) {
      const z = sh().zones[key];
      const r = zoneRectScr(vp, z);
      const h = zoneHandles(r).find((q) => Math.abs(q.x - sx) <= 7 && Math.abs(q.y - sy) <= 7);
      const inside = sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h;
      if (h || inside) { S.drag = { kind: 'zone', key, hx: h ? h.hx : 0, hy: h ? h.hy : 0, move: !h, z0: Object.assign({}, z), p0: p, vp }; return; }
    }
    return;
  }

  const tool = S.tool;
  if (tool === 'select') {
    const L = selLayer();
    const hh = hitHandle(L, vp, sx, sy);
    if (hh && hh.kind === 'rotate') { S.drag = { kind: 'rotate', L, f0: hh.f, a0: Math.atan2(p.y - hh.f.cy, p.x - hh.f.cx), rot0: L.rotation || 0, vp }; return; }
    if (hh) { S.drag = { kind: 'resize', L, hx: hh.hx, hy: hh.hy, f0: hh.f, start: clone(L), vp }; return; }
    const hit = topLayerAt(p);
    if (hit) {
      if (hit.id !== S.sel) select(hit.id);
      S.drag = { kind: 'move', L: hit, p0: p, x0: hit.x, y0: hit.y, f0: frameOf(hit), vp };
    } else if (S.sel) select(null);
    return;
  }
  if (tool === 'text') {
    const L = makeText(p.x, p.y, 'YOUR TEXT');
    addLayer(L);
    setTool('select');
    setPane('layers');
    setTimeout(() => { const ta = $('#propText'); if (ta) { ta.focus(); ta.select(); } }, 0);
    return;
  }
  if (tool === 'shape') {
    const L = makeShape(S.shapeKind, p.x, p.y, 1, 1);
    sh().layers.push(L);
    S.sel = L.id;
    S.drag = { kind: 'create', L, p0: p, vp };
    return;
  }
  if (tool === 'stripe') {
    const L = makeShape('rect', p.x, p.y, 1, S.stripeWidth, 'Stripe');
    sh().layers.push(L);
    S.sel = L.id;
    S.drag = { kind: 'stripe', L, p0: p, vp };
    return;
  }
  if (tool === 'brush' || tool === 'eraser') { S.drag = startBrush(p); if (S.drag) S.drag.vp = vp; render(); return; }
  if (tool === 'picker') {
    const c = document.createElement('canvas');
    c.width = c.height = 1;
    const x = c.getContext('2d');
    x.translate(-Math.floor(p.x), -Math.floor(p.y));
    drawSheet(x, sh(), { guides: false, k: 1 });
    const d = x.getImageData(0, 0, 1, 1).data;
    S.color = '#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('');
    const L = selLayer();
    if (L && L.fill) { L.fill.color = S.color; if (L.fill.type === 'none') L.fill.type = 'solid'; afterEdit(L); pushHistory(); refreshProps(); }
    if (L && L.type === 'image' && L.tint) { L.tint.color = S.color; afterEdit(L); pushHistory(); refreshProps(); }
    renderToolopts();
    toast('Picked ' + S.color);
    return;
  }
  if (tool === 'image') pickFile('image/*,.dds').then((f) => f && addImageFromFile(f, p));
});

view.addEventListener('pointermove', (e) => {
  const sx = e.offsetX, sy = e.offsetY;
  const d = S.drag;
  const vp = d ? d.vp : vpAt(sx, sy);
  if (vp) {
    const p = toTex(vp, sx, sy);
    $('#stPos').textContent = 'x ' + Math.round(p.x) + '  y ' + Math.round(p.y);
    S.mouse = { sx, sy, vp: vp.key };
    if (S.tool === 'brush' || S.tool === 'eraser') render();
  }
  if (!d) {
    if (S.tool === 'select' && vp && !S.space && S.view !== 'zones') {
      const hh = hitHandle(selLayer(), vp, sx, sy);
      if (hh && hh.kind === 'rotate') view.style.cursor = 'crosshair';
      else if (hh) {
        const a = ((Math.atan2(hh.hy, hh.hx) / DEG + hh.f.rot) % 180 + 180) % 180;
        view.style.cursor = a < 22.5 || a >= 157.5 ? 'ew-resize' : a < 67.5 ? 'nwse-resize' : a < 112.5 ? 'ns-resize' : 'nesw-resize';
      } else view.style.cursor = topLayerAt(toTex(vp, sx, sy)) ? 'move' : 'default';
    }
    return;
  }
  const p = toTex(d.vp, sx, sy);
  if (d.kind === 'pan') {
    d.vp.cam.cx = d.cx - (sx - d.sx) / d.vp.scale;
    d.vp.cam.cy = d.cy - (sy - d.sy) / d.vp.scale;
  } else if (d.kind === 'move') {
    let dx = p.x - d.p0.x, dy = p.y - d.p0.y;
    if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
    ({ dx, dy } = snapMove(d.vp, d.f0, dx, dy));
    d.L.x = d.x0 + dx;
    d.L.y = d.y0 + dy;
    d.moved = true;
    syncTwin(d.L);
  } else if (d.kind === 'rotate') {
    let r = d.rot0 + (Math.atan2(p.y - d.f0.cy, p.x - d.f0.cx) - d.a0) / DEG;
    if (e.shiftKey) r = Math.round(r / 15) * 15;
    d.L.rotation = ((r % 360) + 540) % 360 - 180;
    d.moved = true;
    syncTwin(d.L);
  } else if (d.kind === 'resize') {
    doResize(d, p, e);
    d.moved = true;
    syncTwin(d.L);
  } else if (d.kind === 'create') {
    let w = Math.abs(p.x - d.p0.x), h = Math.abs(p.y - d.p0.y);
    if (e.shiftKey) w = h = Math.max(w, h);
    d.L.w = Math.max(1, w); d.L.h = Math.max(1, h);
    d.L.x = d.p0.x + (Math.sign(p.x - d.p0.x) * w) / 2;
    d.L.y = d.p0.y + (Math.sign(p.y - d.p0.y) * h) / 2;
    d.moved = true;
  } else if (d.kind === 'stripe') {
    let a = Math.atan2(p.y - d.p0.y, p.x - d.p0.x) / DEG;
    if (e.shiftKey) a = Math.round(a / 15) * 15;
    const len = Math.hypot(p.x - d.p0.x, p.y - d.p0.y);
    d.L.w = Math.max(1, len);
    d.L.rotation = a;
    d.L.x = d.p0.x + (Math.cos(a * DEG) * len) / 2;
    d.L.y = d.p0.y + (Math.sin(a * DEG) * len) / 2;
    d.moved = true;
  } else if (d.kind === 'brush') {
    const st = d.st;
    const lx = p.x - d.L.x, ly = p.y - d.L.y;
    const n = st.pts.length;
    if (Math.hypot(lx - st.pts[n - 2], ly - st.pts[n - 1]) >= Math.max(1, st.size * 0.12)) brushAddPoint(d.L, st, lx, ly);
  } else if (d.kind === 'zone') {
    const z = sh().zones[d.key], z0 = d.z0;
    const dx = p.x - d.p0.x, dy = p.y - d.p0.y;
    if (d.move) { z.x = Math.round(z0.x + dx); z.y = Math.round(z0.y + dy); }
    else {
      let x1 = z0.x, y1 = z0.y, x2 = z0.x + z0.w, y2 = z0.y + z0.h;
      if (d.hx < 0) x1 = Math.min(x2 - 16, z0.x + dx);
      if (d.hx > 0) x2 = Math.max(x1 + 16, x2 + dx);
      if (d.hy < 0) y1 = Math.min(y2 - 16, z0.y + dy);
      if (d.hy > 0) y2 = Math.max(y1 + 16, y2 + dy);
      Object.assign(z, { x: Math.round(x1), y: Math.round(y1), w: Math.round(x2 - x1), h: Math.round(y2 - y1) });
    }
    refreshSheetPane();
  }
  if (d.kind !== 'pan' && d.kind !== 'zone' && d.kind !== 'brush') refreshProps();
  render();
});

function doResize(d, p, e) {
  const { L, hx, hy, f0, start } = d;
  const m = toLocal(f0, p.x, p.y);
  const fromCenter = e.altKey;
  const ax = fromCenter ? 0 : (-hx * f0.w) / 2, ay = fromCenter ? 0 : (-hy * f0.h) / 2;
  let w = f0.w, h = f0.h;
  if (hx) w = Math.max(4, (m.x - ax) * hx * (fromCenter ? 2 : 1));
  if (hy) h = Math.max(4, (m.y - ay) * hy * (fromCenter ? 2 : 1));
  const corner = hx && hy;
  const keep = corner && !e.shiftKey;
  if (keep) { const k = Math.max(w / f0.w, h / f0.h); w = f0.w * k; h = f0.h * k; }
  if (L.type === 'text') {
    if (keep) { L.size = Math.max(1, start.size * (w / f0.w)); L.sx = start.sx; L.sy = start.sy; }
    else { L.size = start.size; L.sx = (start.sx * w) / f0.w; L.sy = (start.sy * h) / f0.h; }
  } else { L.w = w; L.h = h; }
  const c = toWorld(f0, fromCenter ? 0 : ax + (hx * w) / 2, fromCenter ? 0 : ay + (hy * h) / 2);
  L.x = c.x;
  L.y = c.y;
}

function endDrag() {
  const d = S.drag;
  S.drag = null;
  S.snapLines = [];
  if (!d) return;
  updateCursor();
  if (d.kind === 'pan') { render(); return; }
  if (d.kind === 'create' || d.kind === 'stripe') {
    const L = d.L;
    const s = sh();
    const tiny = (d.kind === 'create' ? Math.max(L.w, L.h) : L.w) * d.vp.scale < 4;
    if (tiny) {
      const zk = zoneOfPoint(s.zones, L.x, L.y);
      const z = s.zones[zk];
      if (d.kind === 'create') { L.w = z.w * 0.2; L.h = L.shape === 'rect' || L.shape === 'parallelogram' || L.shape === 'arrow' ? z.h * 0.25 : z.w * 0.2; }
      else { L.w = z.w * 0.8; L.rotation = 0; L.x = z.x + z.w / 2; }
    }
    setTool('select');
    pushHistory();
    renderLayerList();
    buildProps();
  } else if (d.kind === 'brush') {
    brushCanvas(d.L, 2);
    syncTwin(d.L);
    pushHistory();
  } else if (d.kind === 'zone') {
    S.cams = Object.fromEntries(Object.entries(S.cams).filter(([k]) => k === 'zones' || k === 'full'));
    syncAllTwins();
    pushHistory();
  } else if (d.moved) {
    pushHistory();
  }
  refreshProps();
  render();
}
view.addEventListener('pointerup', endDrag);
view.addEventListener('pointercancel', endDrag);
view.addEventListener('pointerleave', () => { S.mouse = null; render(); });
view.addEventListener('contextmenu', (e) => e.preventDefault());
view.addEventListener('wheel', (e) => {
  e.preventDefault();
  const vp = vpAt(e.offsetX, e.offsetY);
  if (!vp) return;
  if (e.shiftKey && !e.ctrlKey) { vp.cam.cx += (e.deltaY || e.deltaX) / vp.scale; render(); return; }
  zoomBy(Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0015)), vp, e.offsetX, e.offsetY);
}, { passive: false });
view.addEventListener('dblclick', (e) => {
  const vp = vpAt(e.offsetX, e.offsetY);
  if (!vp || S.view === 'zones') return;
  const L = topLayerAt(toTex(vp, e.offsetX, e.offsetY));
  if (L && L.type === 'text') {
    select(L.id);
    setPane('layers');
    const ta = $('#propText');
    if (ta) { ta.focus(); ta.select(); }
  }
});

// drag and drop files anywhere on the window
async function handleFiles(files, at) {
  for (const f of files) {
    const n = f.name.toLowerCase();
    if (n.endsWith('.zip')) await openZip(f);
    else if (n.endsWith('.materials.json')) await loadMaterials(f);
    else if (n.endsWith('.jbeam')) await readSlotType(f);
    else if (n.endsWith('.json') || n.endsWith('.livery')) await openProject(f);
    else if (!f.type && !/\.[a-z0-9]+$/.test(n)) toast('Drag in the vehicle\'s .zip file, not a folder.', 5000);
    else if (!VZ && !sh().template.assetId && !sh().layers.length && IMAGE_RE.test(n)) {
      const i = await ask('What is this picture?', '<b>' + esc(f.name) + '</b>', ['It\'s the template (UV map)', 'Add it as a logo or picture']);
      if (i === 0) await loadTemplate(f);
      else if (i === 1) await addImageFromFile(f, at);
    } else await addImageFromFile(f, at);
  }
}

const hasFiles = (e) => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
let dragDepth = 0;
window.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; dragDepth++; $('#dropOverlay').classList.remove('hidden'); });
window.addEventListener('dragleave', (e) => { if (!hasFiles(e)) return; dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) $('#dropOverlay').classList.add('hidden'); });
window.addEventListener('dragover', (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
window.addEventListener('drop', (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth = 0;
  $('#dropOverlay').classList.add('hidden');
  const r = view.getBoundingClientRect();
  const vp = vpAt(e.clientX - r.left, e.clientY - r.top);
  handleFiles([...e.dataTransfer.files], vp ? toTex(vp, e.clientX - r.left, e.clientY - r.top) : null);
});

document.addEventListener('paste', (e) => {
  if (e.target.closest && e.target.closest('input, textarea')) return;
  const items = e.clipboardData ? [...e.clipboardData.items] : [];
  const img = items.find((it) => it.type.startsWith('image/'));
  if (img) {
    const f = img.getAsFile();
    if (f) { e.preventDefault(); addImageFromFile(new File([f], 'Pasted image.png', { type: f.type })); return; }
  }
  if (S.clipboard) { e.preventDefault(); pasteLayer(); }
});

// ============================================================ keyboard
const TOOL_KEYS = { v: 'select', h: 'hand', t: 'text', r: 'shape', l: 'stripe', b: 'brush', e: 'eraser', i: 'image', k: 'picker' };
window.addEventListener('keydown', (e) => {
  const typing = e.target.closest && e.target.closest('input, textarea, select');
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  if (mod && key === 's') { e.preventDefault(); saveProject(); return; }
  if (!$('#askModal').classList.contains('hidden')) { if (e.key === 'Escape' && askDone) askDone(-1); return; }
  if (!$('#guideModal').classList.contains('hidden')) { if (e.key === 'Escape') $('#guideModal').classList.add('hidden'); return; }
  if (typing) { if (e.key === 'Escape') e.target.blur(); return; }
  if (mod && key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
  if (mod && key === 'y') { e.preventDefault(); redo(); return; }
  if (mod && key === 'd') { e.preventDefault(); duplicateSelected(); return; }
  if (mod && key === 'c') { copySelected(); return; }
  if (mod) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); return; }
  if (e.key === ' ') { e.preventDefault(); if (!S.space) { S.space = true; updateCursor(); } return; }
  if (e.key === 'Escape') { select(null); return; }
  if (e.key.startsWith('Arrow')) {
    const L = selLayer();
    if (!L) return;
    e.preventDefault();
    const n = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft') L.x -= n; if (e.key === 'ArrowRight') L.x += n;
    if (e.key === 'ArrowUp') L.y -= n; if (e.key === 'ArrowDown') L.y += n;
    syncTwin(L);
    clearTimeout(S.nudgeTimer);
    S.nudgeTimer = setTimeout(pushHistory, 400);
    refreshProps();
    render();
    return;
  }
  if (TOOL_KEYS[key]) { setTool(TOOL_KEYS[key]); return; }
  if (key === 'm') mirrorSelected();
  else if (key === '[') moveLayer(-1);
  else if (key === ']') moveLayer(1);
  else if (key === '0') fitView();
  else if (key === '+' || key === '=') zoomBy(1.25);
  else if (key === '-') zoomBy(0.8);
  else if (key === '1') setView('full');
  else if (key === '2') setView('left');
  else if (key === '3') setView('right');
  else if (key === '4') setView('both');
});
window.addEventListener('keyup', (e) => { if (e.key === ' ') { S.space = false; updateCursor(); } });
window.addEventListener('blur', () => { S.space = false; });

// ============================================================ top bar & startup
$('#paneltabs').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setPane(b.dataset.pane); });
$('#lyUp').addEventListener('click', () => moveLayer(1));
$('#lyDown').addEventListener('click', () => moveLayer(-1));
$('#lyDup').addEventListener('click', duplicateSelected);
$('#lyMirror').addEventListener('click', mirrorSelected);
$('#lyDel').addEventListener('click', deleteSelected);
$('#btnUndo').addEventListener('click', undo);
$('#btnRedo').addEventListener('click', redo);
$('#btnSave').addEventListener('click', saveProject);
$('#btnOpen').addEventListener('click', async () => { const f = await pickFile('.json'); if (f) openProject(f); });
$('#btnNew').addEventListener('click', () => {
  if (hasContent() && !confirm('Start a new livery? Anything you have not saved will be lost.')) return;
  resetDesign();
  S.skipWelcome = false;
  refreshAll();
  autosaveReady = true;
});
const chooseVehicle = async () => { const f = await pickFile('.zip'); if (f) openZip(f); };
$('#btnVehicle').addEventListener('click', chooseVehicle);
$('#welcomePick').addEventListener('click', chooseVehicle);
$('#welcomeSkip').addEventListener('click', () => { S.skipWelcome = true; render(); });
$('#btnExportTop').addEventListener('click', () => setPane('export'));
const openGuide = () => $('#guideModal').classList.remove('hidden');
$('#btnGuide').addEventListener('click', openGuide);
$('#btnGuide2').addEventListener('click', openGuide);
$('#welcomeGuide').addEventListener('click', (e) => { e.preventDefault(); openGuide(); });
$('#guideModal').addEventListener('click', (e) => { if (e.target.id === 'guideModal' || e.target.closest('[data-close]')) $('#guideModal').classList.add('hidden'); });
window.addEventListener('resize', resizeView);
window.addEventListener('beforeunload', (e) => { if (dirty && hasContent()) { e.preventDefault(); e.returnValue = ''; } });

async function start() {
  setTool('select');
  setView('full');
  resetHistory();
  refreshAll();
  resizeView();
  let saved = null;
  try { saved = await DB.get('autosave'); } catch (e) { /* storage blocked: no autosave */ }
  if (saved) {
    $('#restorebar').classList.remove('hidden');
    $('#btnRestore').onclick = async () => {
      $('#restorebar').classList.add('hidden');
      try {
        await restoreAutosave(saved);
        toast(P.vehicle.sourceZip ? 'Your last livery is back. Drag ' + P.vehicle.sourceZip + ' in again to put it inside the vehicle.' : 'Your last livery is back.', 6000);
      } catch (e) { toast('The saved livery could not be restored.'); }
      autosaveReady = true;
      pruneSavedAssets();
    };
    $('#btnNoRestore').onclick = async () => {
      $('#restorebar').classList.add('hidden');
      try { await DB.del('autosave'); } catch (e) { /* storage blocked */ }
      autosaveReady = true;
      pruneSavedAssets();
      scheduleAutosave();
    };
  } else {
    autosaveReady = true;
  }
}

// For automated tests.
window.LiveryDesigner = { get project() { return P; }, get vehicle() { return VZ; }, state: S, exportInfo, buildJbeam, buildMaterials, parseLoose, select, setView, mirrorSelected, syncTwin, pushHistory, refreshAll, makeText, makeShape, addLayer, assets, loadProjectData, projectJSON, makeMode, openZip };

start();
})();
