/* Copy the game into desktop/app/ for packing: the building game itself, and
 * three.js with only the add-ons the game actually imports (found by
 * following the imports, so a new add-on is picked up on its own). */

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const desktop = resolve(here, '..');
const root = resolve(desktop, '..');
const out = join(desktop, 'app');
const gameSrc = join(root, 'public', 'building');
const threeSrc = existsSync(join(desktop, 'node_modules', 'three')) ? join(desktop, 'node_modules', 'three') : join(root, 'node_modules', 'three');

if (!existsSync(threeSrc)) {
  console.error('three.js is not installed: run "npm install" in the repository root first.');
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// The game, less any test pages (files starting with an underscore).
cpSync(gameSrc, join(out, 'building'), { recursive: true, filter: (src) => !/[\\/]_[^\\/]*$/.test(src) });

// three.js itself.
for (const f of ['three.module.js', 'three.core.js']) {
  mkdirSync(join(out, 'vendor', 'three', 'build'), { recursive: true });
  cpSync(join(threeSrc, 'build', f), join(out, 'vendor', 'three', 'build', f));
}

// The add-ons: start from every "three/addons/..." the game imports and follow
// their relative imports.
const jsm = join(threeSrc, 'examples', 'jsm');
const want = new Set();
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.js')) {
      for (const m of readFileSync(p, 'utf8').matchAll(/from\s+['"]three\/addons\/([^'"]+)['"]/g)) want.add(join(jsm, m[1]));
    }
  }
};
walk(gameSrc);
const done = new Set();
const queue = [...want];
while (queue.length) {
  const file = queue.pop();
  if (done.has(file)) continue;
  done.add(file);
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) queue.push(resolve(dirname(file), m[1]));
  const dest = join(out, 'vendor', 'three', 'examples', 'jsm', relative(jsm, file));
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, text);
}

// The desktop page opens straight into the game.
writeFileSync(join(out, 'index.html'), '<!doctype html><meta http-equiv="refresh" content="0; url=/building/">');

const size = (dir) => readdirSync(dir).reduce((n, f) => { const p = join(dir, f); return n + (statSync(p).isDirectory() ? size(p) : statSync(p).size); }, 0);
console.log(`Game copied to ${relative(root, out)}: ${done.size} three.js add-on files, ${(size(out) / 1048576).toFixed(1)} MB.`);
