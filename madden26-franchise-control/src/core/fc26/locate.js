// Finds FC 26 career saves and squad files on this PC. FC keeps them in a
// "settings" folder, either under Documents ("FC 26") or under the local
// app data folder ("EA SPORTS FC 26"), and OneDrive can move Documents.
// Career saves have "Career" in their name; squad files start with "Squads".

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { documentsCandidates } from '../franchise/locate.js';

const FOLDER_NAMES = ['FC 26', 'EA SPORTS FC 26', 'EA SPORTS FC™ 26', 'EA SPORTS FC 26 Demo'];

export function fcSettingsDirs({ home = os.homedir(), env = process.env } = {}) {
  const bases = [...documentsCandidates(home, env)];
  const local = env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
  bases.push(local);
  const out = [];
  for (const base of bases) {
    for (const name of FOLDER_NAMES) {
      const dir = path.join(base, name, 'settings');
      try {
        if (fs.statSync(dir).isDirectory() && !out.includes(dir)) out.push(dir);
      } catch { /* not here */ }
    }
  }
  return out;
}

export function fcKind(name) {
  if (/career/i.test(name)) return 'career';
  if (/^squads/i.test(name)) return 'squads';
  return null;
}

export function fcFilesIn(dir) {
  const out = [];
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const kind = fcKind(e.name);
    if (!e.isFile() || !kind) continue;
    try {
      const st = fs.statSync(path.join(dir, e.name));
      if (st.size < 100 * 1024) continue;
      out.push({ path: path.join(dir, e.name), name: e.name, kind, size: st.size, modified: st.mtime.toISOString() });
    } catch { /* vanished */ }
  }
  return out;
}

export function findFcSaves({ home, env, extraDirs = [] } = {}) {
  const dirs = [...fcSettingsDirs({ home, env }), ...extraDirs];
  const seen = new Set();
  const files = [];
  const searched = [];
  for (const d of dirs) {
    const key = path.resolve(d).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    searched.push(d);
    files.push(...fcFilesIn(d));
  }
  files.sort((a, b) => (a.kind === b.kind ? b.modified.localeCompare(a.modified) : a.kind === 'career' ? -1 : 1));
  return { files, searched };
}
