// One-off generator for public/election/us-map.js — the real US state outlines
// the election map draws. Run it only when the map data needs regenerating:
//
//   npm i --no-save us-atlas topojson-client topojson-simplify d3-geo playwright
//   node tools/build-map.mjs [detailRetained]
//
// Source data: us-atlas states-albers-10m (US Census cartographic boundaries,
// already projected with d3's Albers USA, so Alaska and Hawaii sit in insets).
// Output is plain data — the browser needs no projection library at runtime.
import { readFileSync, writeFileSync } from 'fs';
import { feature } from 'topojson-client';
import { presimplify, simplify, quantile } from 'topojson-simplify';
import { geoPath } from 'd3-geo';
import { chromium } from 'playwright';

const FIPS = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT',
  10: 'DE', 11: 'DC', 12: 'FL', 13: 'GA', 15: 'HI', 16: 'ID', 17: 'IL', 18: 'IN',
  19: 'IA', 20: 'KS', 21: 'KY', 22: 'LA', 23: 'ME', 24: 'MD', 25: 'MA', 26: 'MI',
  27: 'MN', 28: 'MS', 29: 'MO', 30: 'MT', 31: 'NE', 32: 'NV', 33: 'NH', 34: 'NJ',
  35: 'NM', 36: 'NY', 37: 'NC', 38: 'ND', 39: 'OH', 40: 'OK', 41: 'OR', 42: 'PA',
  44: 'RI', 45: 'SC', 46: 'SD', 47: 'TN', 48: 'TX', 49: 'UT', 50: 'VT', 51: 'VA',
  53: 'WA', 54: 'WV', 55: 'WI', 56: 'WY',
};

const RETAIN = Number(process.argv[2] || 0.22); // fraction of detail kept
const OUT = new URL('../public/election/us-map.js', import.meta.url);

/* ------------------------------------------------------------ 1 · outlines */

const topo = JSON.parse(readFileSync('node_modules/us-atlas/states-albers-10m.json', 'utf8'));
const thin = simplify(presimplify(topo), quantile(presimplify(topo), RETAIN));
const path = geoPath().digits(1);

// Simplification collapses tiny offshore islands into zero-area rings. They
// draw nothing but bloat the file, so drop any subpath under a pixel across.
function dropSlivers(d) {
  return d.split('M').filter(Boolean).map((sub) => {
    const nums = sub.match(/-?\d+(?:\.\d+)?/g);
    if (!nums) return null;
    const xs = [];
    const ys = [];
    for (let i = 0; i < nums.length - 1; i += 2) {
      xs.push(+nums[i]);
      ys.push(+nums[i + 1]);
    }
    const wide = Math.max(...xs) - Math.min(...xs) >= 1;
    const tall = Math.max(...ys) - Math.min(...ys) >= 1;
    return wide || tall ? `M${sub}` : null;
  }).filter(Boolean).join('');
}

const paths = {};
for (const f of feature(thin, thin.objects.states).features) {
  const code = FIPS[f.id] || FIPS[String(f.id).padStart(2, '0')];
  if (!code) continue; // territories
  const d = dropSlivers(path(f) || '');
  if (d) paths[code] = d;
}
const missing = Object.values(FIPS).filter((c) => !paths[c]);
if (missing.length) throw new Error(`no outline for ${missing.join(' ')}`);

/* ------------------------------------------------------------- 2 · anchors */

// A state's centroid can sit in the ocean (Michigan, Florida, Louisiana), so
// find the most interior point instead — roughly the pole of inaccessibility —
// using the browser's own SVG hit-testing. `clear` is the radius that fits
// there, which tells the renderer whether a label can go inside the state.
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage();
await page.setContent('<svg id="s" viewBox="0 0 975 610" width="975" height="610"></svg>');

const labels = await page.evaluate((shapes) => {
  const svg = document.getElementById('s');
  const NS = 'http://www.w3.org/2000/svg';
  const out = {};

  for (const [code, d] of Object.entries(shapes)) {
    const el = document.createElementNS(NS, 'path');
    el.setAttribute('d', d);
    svg.append(el);
    const box = el.getBBox();
    const probe = svg.createSVGPoint();
    const inside = (x, y) => { probe.x = x; probe.y = y; return el.isPointInFill(probe); };

    const step = Math.max(1.5, Math.min(box.width, box.height) / 18);
    let best = null;
    for (let x = box.x + step / 2; x < box.x + box.width; x += step) {
      for (let y = box.y + step / 2; y < box.y + box.height; y += step) {
        if (!inside(x, y)) continue;
        let clear = 0;
        for (let r = step; r < Math.max(box.width, box.height); r += step) {
          let allIn = true;
          for (let a = 0; a < 8 && allIn; a++) {
            const th = (a * Math.PI) / 4;
            allIn = inside(x + Math.cos(th) * r, y + Math.sin(th) * r);
          }
          if (!allIn) break;
          clear = r;
        }
        if (!best || clear > best.clear) best = { x, y, clear };
      }
    }
    el.remove();
    const round = (n) => Math.round(n * 10) / 10;
    out[code] = best
      ? { x: round(best.x), y: round(best.y), clear: round(best.clear) }
      : { x: round(box.x + box.width / 2), y: round(box.y + box.height / 2), clear: 0 };
  }
  return out;
}, paths);

await browser.close();

/* -------------------------------------------------------------- 3 · output */

const entries = (obj, fmt) => Object.entries(obj).map(([k, v]) => `  ${k}: ${fmt(v)},`).join('\n');

writeFileSync(OUT, `// GENERATED by tools/build-map.mjs — do not edit by hand.
// Real state outlines from us-atlas states-albers-10m (US Census boundaries,
// Albers USA projection), simplified to ${Math.round(RETAIN * 100)}% of detail.
// Coordinates are already projected: the browser just draws them.

export const MAP_WIDTH = 975;
export const MAP_HEIGHT = 610;

// code -> SVG path data
export const US_PATHS = {
${entries(paths, (d) => JSON.stringify(d))}
};

// code -> where a label sits inside the state, and the radius that fits there
// (small \`clear\` means the label has to go outside on a leader line)
export const US_LABELS = {
${entries(labels, (l) => `{ x: ${l.x}, y: ${l.y}, clear: ${l.clear} }`)}
};
`);

const kb = (readFileSync(OUT).length / 1024).toFixed(1);
console.log(`wrote us-map.js — ${Object.keys(paths).length} states, ${kb} KB (retain ${RETAIN})`);
console.log('needs an outside label:', Object.entries(labels)
  .filter(([, l]) => l.clear < 9.5).map(([c]) => c).join(' '));
