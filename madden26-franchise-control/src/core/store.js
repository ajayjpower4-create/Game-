// Small JSON-on-disk store. One folder per league holding the raw Companion
// App exports, the manual game tracker, and the injury log. No database to
// install; everything is plain files the user can back up.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export function defaultDataDir() {
  if (process.env.M26FC_DATA_DIR) return process.env.M26FC_DATA_DIR;
  const base = process.platform === 'win32' ? process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming') : path.join(os.homedir(), '.config');
  return path.join(base, 'Madden26FranchiseControl');
}

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

export class Store {
  constructor(dataDir) {
    this.dataDir = dataDir || defaultDataDir();
    fs.mkdirSync(path.join(this.dataDir, 'leagues'), { recursive: true });
  }

  leagueDir(leagueKey) {
    const safe = String(leagueKey).replace(/[^a-zA-Z0-9_.-]/g, '_');
    return path.join(this.dataDir, 'leagues', safe);
  }

  listLeagues() {
    const root = path.join(this.dataDir, 'leagues');
    return fs
      .readdirSync(root)
      .filter((d) => fs.statSync(path.join(root, d)).isDirectory())
      .map((d) => ({ leagueKey: d, ...readJson(path.join(root, d, 'meta.json'), {}) }));
  }

  getMeta(leagueKey) {
    return readJson(path.join(this.leagueDir(leagueKey), 'meta.json'), null);
  }

  setMeta(leagueKey, meta) {
    const prev = this.getMeta(leagueKey) || {};
    const next = { ...prev, ...meta, updatedAt: new Date().toISOString() };
    writeJson(path.join(this.leagueDir(leagueKey), 'meta.json'), next);
    return next;
  }

  // Raw companion exports are kept by kind and (for weekly kinds) by week.
  getCompanionRaw(leagueKey) {
    return readJson(path.join(this.leagueDir(leagueKey), 'companion.json'), { leagueteams: [], standings: [], rosters: {}, schedules: {}, passing: {}, rushing: {}, receiving: {}, defense: {}, kicking: {}, punting: {}, teamstats: {}, meta: null });
  }

  saveCompanionPayload(leagueKey, info, list) {
    const raw = this.getCompanionRaw(leagueKey);
    if (info.kind === 'leagueteams' || info.kind === 'standings') raw[info.kind] = list;
    else if (info.kind === 'roster') raw.rosters[info.teamId] = list;
    else raw[info.kind][`${info.stage}-${info.week}`] = list;
    raw.meta = { platform: info.platform, leagueId: info.leagueId, lastExportAt: new Date().toISOString(), lastKind: info.kind };
    writeJson(path.join(this.leagueDir(leagueKey), 'companion.json'), raw);
    this.setMeta(leagueKey, { source: 'companion', platform: info.platform, companionLeagueId: info.leagueId, lastExportAt: raw.meta.lastExportAt });
    return raw;
  }

  getTracker(leagueKey) {
    return readJson(path.join(this.leagueDir(leagueKey), 'tracker.json'), { events: [] });
  }

  saveTracker(leagueKey, tracker) {
    writeJson(path.join(this.leagueDir(leagueKey), 'tracker.json'), tracker);
    return tracker;
  }

  getInjuryLog(leagueKey) {
    return readJson(path.join(this.leagueDir(leagueKey), 'injuries.json'), { entries: [] });
  }

  saveInjuryLog(leagueKey, log) {
    writeJson(path.join(this.leagueDir(leagueKey), 'injuries.json'), log);
    return log;
  }

  getSettings() {
    return readJson(path.join(this.dataDir, 'settings.json'), { recentFiles: [], schemaDirectory: null, port: 3826 });
  }

  saveSettings(settings) {
    writeJson(path.join(this.dataDir, 'settings.json'), settings);
    return settings;
  }
}
