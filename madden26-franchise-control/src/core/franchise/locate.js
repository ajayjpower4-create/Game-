// Finds the Madden franchise files already on this PC, so nobody has to go
// hunting for them. Madden keeps each franchise as a file named CAREER-<league>
// inside "Documents\Madden NFL <year>\settings".
//
// The catch on Windows is that "Documents" moves. OneDrive takes it over on
// most machines now, business accounts put it under "OneDrive - Company", and
// a redirected profile can put it somewhere else again. So look in every place
// it is known to live rather than assuming one path.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const MADDEN_YEARS = [27, 26, 25];
const FRANCHISE_NAME = /^CAREER/i;

export function documentsCandidates(home = os.homedir(), env = process.env) {
  const out = [];
  const add = (p) => { if (p && !out.includes(p)) out.push(p); };
  const underBase = (base) => { add(path.join(base, 'Documents')); add(path.join(base, 'My Documents')); };

  underBase(home);
  // OneDrive, personal or business ("OneDrive - Contoso").
  try {
    for (const entry of fs.readdirSync(home, { withFileTypes: true })) {
      if (entry.isDirectory() && /^OneDrive/i.test(entry.name)) underBase(path.join(home, entry.name));
    }
  } catch { /* home not readable; the env vars below may still help */ }
  for (const key of ['OneDrive', 'OneDriveConsumer', 'OneDriveCommercial']) if (env[key]) underBase(env[key]);
  if (env.USERPROFILE && env.USERPROFILE !== home) underBase(env.USERPROFILE);
  // A redirected Documents folder can sit on another drive entirely.
  if (env.HOMEDRIVE && env.HOMEPATH) underBase(path.join(env.HOMEDRIVE, env.HOMEPATH));
  return out;
}

// Every "Madden NFL <year>\settings" folder that exists on this machine.
export function settingsDirs({ home, env, years = MADDEN_YEARS } = {}) {
  const found = [];
  for (const docs of documentsCandidates(home, env)) {
    for (const year of years) {
      const dir = path.join(docs, `Madden NFL ${year}`, 'settings');
      try {
        if (fs.statSync(dir).isDirectory()) found.push({ dir, year });
      } catch { /* not on this machine */ }
    }
  }
  return found;
}

function describe(filePath, year) {
  const stat = fs.statSync(filePath);
  const name = path.basename(filePath);
  // "CAREER-MYLEAGUE" is the league the user named in game.
  const label = name.replace(FRANCHISE_NAME, '').replace(/^[-_\s]+/, '').trim();
  return {
    path: filePath,
    name,
    league: label || name,
    year,
    size: stat.size,
    modified: stat.mtime.toISOString(),
  };
}

// Franchise saves in one folder, newest first. Madden also writes settings and
// roster files here, so only CAREER files count, and a real franchise is never
// tiny.
export function franchiseFilesIn(dir, year = null) {
  const out = [];
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (!entry.isFile() || !FRANCHISE_NAME.test(entry.name)) continue;
    try {
      const info = describe(path.join(dir, entry.name), year);
      if (info.size > 64 * 1024) out.push(info);
    } catch { /* vanished or locked while listing */ }
  }
  return out.sort((a, b) => b.modified.localeCompare(a.modified));
}

// Everything findable on this PC, plus any folders the caller knows about
// (previously opened files, a custom install).
export function findFranchiseFiles({ home, env, years, extraDirs = [] } = {}) {
  const dirs = settingsDirs({ home, env, years });
  const searched = [];
  const files = [];
  const seenDir = new Set();
  const seenFile = new Set();
  for (const { dir, year } of [...dirs, ...extraDirs.map((d) => ({ dir: d, year: null }))]) {
    const key = path.resolve(dir).toLowerCase();
    if (seenDir.has(key)) continue;
    seenDir.add(key);
    searched.push(dir);
    for (const f of franchiseFilesIn(dir, year)) {
      const fileKey = path.resolve(f.path).toLowerCase();
      if (seenFile.has(fileKey)) continue;
      seenFile.add(fileKey);
      files.push(f);
    }
  }
  files.sort((a, b) => b.modified.localeCompare(a.modified));
  return { files, searched };
}
