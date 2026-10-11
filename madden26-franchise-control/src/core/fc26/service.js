// Keeps FC 26 careers open and their own data on disk: the Match Log and any
// names you give players the save has no name for. Saves are only ever read.

import fs from 'node:fs';
import path from 'node:path';
import { readStable } from '../franchise/savefile.js';
import { hashString } from '../rng.js';
import { readCareer } from './career.js';

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
  fs.renameSync(tmp, file);
}

export class FcService {
  constructor(dataDir) {
    this.root = path.join(dataDir, 'fc26');
    fs.mkdirSync(this.root, { recursive: true });
    this.open_ = new Map();
  }

  keyFor(filePath) {
    return `fc-${hashString(path.resolve(filePath)).toString(16)}`;
  }

  dir(key) {
    return path.join(this.root, String(key).replace(/[^a-zA-Z0-9_.-]/g, '_'));
  }

  list() {
    return fs.readdirSync(this.root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => ({ careerKey: d.name, ...readJson(path.join(this.root, d.name, 'meta.json'), {}) })).filter((m) => m.filePath).sort((a, b) => (b.openedAt || '').localeCompare(a.openedAt || ''));
  }

  meta(key) {
    return readJson(path.join(this.dir(key), 'meta.json'), null);
  }

  names(key) {
    return readJson(path.join(this.dir(key), 'names.json'), {});
  }

  setName(key, playerId, name) {
    const all = this.names(key);
    const clean = String(name || '').trim().slice(0, 60);
    if (clean) all[playerId] = clean; else delete all[playerId];
    writeJson(path.join(this.dir(key), 'names.json'), all);
    const o = this.open_.get(key);
    if (o) this.open_.delete(key);
    return all;
  }

  matches(key) {
    return readJson(path.join(this.dir(key), 'matchlog.json'), { matches: [] }).matches;
  }

  saveMatches(key, list) {
    writeJson(path.join(this.dir(key), 'matchlog.json'), { matches: list });
  }

  // Read a save and remember it.
  open(filePath) {
    if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
    const key = this.keyFor(filePath);
    const { buf, stat } = readStable(filePath);
    const career = readCareer(buf, { fileName: path.basename(filePath), customNames: this.names(key) });
    career.filePath = filePath;
    career.careerKey = key;
    career.savedAt = stat.mtime.toISOString();
    const club = career.userClubId ? career.clubs[career.userClubId].name : null;
    const prev = this.meta(key) || {};
    writeJson(path.join(this.dir(key), 'meta.json'), { ...prev, filePath, name: path.basename(filePath), club, kind: career.kind, seasonLabel: career.seasonLabel, date: career.date, openedAt: new Date().toISOString() });
    this.open_.set(key, { career, mtime: stat.mtimeMs });
    while (this.open_.size > 3) this.open_.delete(this.open_.keys().next().value);
    return career;
  }

  // The career for a key, read again if the save changed on disk.
  get(key) {
    const meta = this.meta(key);
    if (!meta) throw new Error('Unknown FC 26 career');
    const o = this.open_.get(key);
    let mtime = null;
    try { mtime = fs.statSync(meta.filePath).mtimeMs; } catch { /* gone */ }
    if (o && (mtime == null || mtime === o.mtime)) return o.career;
    if (mtime == null) throw new Error(`The save ${meta.name} is not at ${meta.filePath} any more. Open it again from the Connect page.`);
    return this.open(meta.filePath);
  }

  forget(key) {
    this.open_.delete(key);
    fs.rmSync(this.dir(key), { recursive: true, force: true });
  }
}
