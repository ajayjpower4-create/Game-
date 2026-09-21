// Connecting a franchise file. The Control Center has one native format (its
// own save) and a best-effort importer for the roster/player dumps the common
// Madden franchise exporters spit out — Companion-app JSON, a flat player
// array, or a CSV. Anything it can't find (a schedule, a depth chart order) it
// builds so the rest of the app has something to stand on.

import { TEAMS, generateFranchise, hash, mulberry32, int } from './league.js';

export const NATIVE_FORMAT = 'gcc-franchise';
export const NATIVE_VERSION = 1;

/* ---------------------------------------------------------------- helpers */

const clean = (s) => String(s ?? '').trim();

const POS_ALIASES = {
  HB: 'RB', HALFBACK: 'RB', FULLBACK: 'FB', QUARTERBACK: 'QB',
  WIDERECEIVER: 'WR', TIGHTEND: 'TE', CENTER: 'C',
  LEFTTACKLE: 'LT', RIGHTTACKLE: 'RT', LEFTGUARD: 'LG', RIGHTGUARD: 'RG',
  DE: 'RE', LEFTEND: 'LE', RIGHTEND: 'RE', OLB: 'ROLB', ILB: 'MLB', LB: 'MLB',
  S: 'FS', SAF: 'FS', FREESAFETY: 'FS', STRONGSAFETY: 'SS', CORNERBACK: 'CB',
  DEFENSIVETACKLE: 'DT', NT: 'DT', K: 'K', P: 'P', PK: 'K',
};

function normalizePos(raw) {
  const key = clean(raw).toUpperCase().replace(/[^A-Z]/g, '');
  if (!key) return 'WR';
  return POS_ALIASES[key] || key;
}

// Match whatever the file calls a team ("KC", "Chiefs", "Kansas City Chiefs").
function matchTeam(raw) {
  const v = clean(raw).toUpperCase();
  if (!v) return null;
  return (
    TEAMS.find((t) => t.id === v) ||
    TEAMS.find((t) => t.name.toUpperCase() === v) ||
    TEAMS.find((t) => `${t.city} ${t.name}`.toUpperCase() === v) ||
    TEAMS.find((t) => v.includes(t.name.toUpperCase())) ||
    TEAMS.find((t) => v.includes(t.city.toUpperCase())) ||
    null
  );
}

const firstKey = (obj, keys, fallback = '') => {
  for (const k of keys) {
    for (const actual of Object.keys(obj)) {
      if (actual.toLowerCase().replace(/[^a-z]/g, '') === k) {
        const v = obj[actual];
        if (v !== undefined && v !== null && v !== '') return v;
      }
    }
  }
  return fallback;
};

/* --------------------------------------------------------------- importing */

function playerFrom(raw, index) {
  const first = clean(firstKey(raw, ['firstname', 'first']));
  const last = clean(firstKey(raw, ['lastname', 'last']));
  const full = clean(firstKey(raw, ['name', 'playername', 'fullname'])) || `${first} ${last}`.trim();
  const [f, ...rest] = full.split(/\s+/);
  const team = matchTeam(firstKey(raw, ['team', 'teamname', 'teamabbr', 'club', 'teamid']));
  const pos = normalizePos(firstKey(raw, ['pos', 'position', 'positionname']));
  const ovr = Number(firstKey(raw, ['ovr', 'overall', 'overallrating', 'playerbestovr'], 70)) || 70;
  const dur = Number(firstKey(raw, ['dur', 'durability', 'injuryrating', 'injury'], 78)) || 78;
  return {
    id: clean(firstKey(raw, ['id', 'rosterid', 'playerid'])) || `IMP-${index}`,
    name: full || `Player ${index + 1}`,
    first: first || f || '',
    last: last || rest.join(' ') || '',
    pos,
    depth: 0,
    team: team ? team.id : null,
    ovr: Math.max(40, Math.min(99, Math.round(ovr))),
    age: Number(firstKey(raw, ['age'], 26)) || 26,
    jersey: Number(firstKey(raw, ['jersey', 'jerseynum', 'number'], 0)) || 0,
    dur: Math.max(40, Math.min(99, Math.round(dur))),
    injury: null,
  };
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const split = (line) => line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)
    .map((c) => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"'))
    .slice(0, -1);
  const head = split(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = split(line);
    return Object.fromEntries(head.map((h, i) => [h, cells[i]]));
  });
}

/** Pull a player array out of whatever shape the file arrived in. */
function findPlayers(data) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  for (const key of ['players', 'rosters', 'roster', 'teamRoster', 'playerList', 'data']) {
    const v = data[key];
    if (Array.isArray(v) && v.length) return v;
    if (v && typeof v === 'object') {
      const flat = Object.values(v).flat();
      if (flat.length && typeof flat[0] === 'object') return flat;
    }
  }
  // Companion-style: { teams: [{ abbr, roster: [...] }] }
  if (Array.isArray(data.teams)) {
    const flat = data.teams.flatMap((t) =>
      (t.roster || t.players || []).map((p) => ({ team: t.abbr || t.name || t.displayName, ...p })));
    if (flat.length) return flat;
  }
  return [];
}

/**
 * Turn a file's contents into a franchise. Returns { franchise, report } where
 * the report is what to tell the user about what actually came across.
 */
export function importFranchise(text, filename = 'franchise file') {
  const notes = [];
  let data = null;
  const trimmed = text.trim();

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try { data = JSON.parse(trimmed); }
    catch (e) { throw new Error(`That file is not readable JSON — ${e.message}`); }
  } else if (trimmed.includes(',')) {
    data = parseCsv(trimmed);
    notes.push('Read as CSV.');
  } else {
    throw new Error('Unrecognized file. Connect a JSON or CSV franchise export.');
  }

  // Native save: restore it whole, including scripted injuries.
  if (data && data.format === NATIVE_FORMAT) {
    const fr = data.franchise;
    fr.source = `${filename} (Control Center save)`;
    notes.push(`Restored a Control Center save from week ${fr.week}.`);
    notes.push(`${fr.injuries.length} scripted injuries came back with it.`);
    return { franchise: fr, report: { notes, imported: countPlayers(fr), teams: fr.teams.length } };
  }

  const rawPlayers = findPlayers(data);
  if (!rawPlayers.length) throw new Error('No players found in that file. Export the roster, not just the settings.');

  // Start from a generated franchise so schedule/anything missing still exists,
  // then overwrite the rosters with what the file actually contained.
  const seedText = `${filename}:${rawPlayers.length}`;
  const fr = generateFranchise(seedText);
  fr.source = filename;
  for (const t of fr.teams) fr.rosters[t.id] = [];

  let placed = 0, orphans = 0;
  const rng = mulberry32(hash(seedText));
  rawPlayers.forEach((raw, i) => {
    const p = playerFrom(raw, i);
    if (!p.team) { p.team = TEAMS[int(rng, 0, TEAMS.length - 1)].id; orphans++; }
    fr.rosters[p.team].push(p);
    placed++;
  });

  // Depth chart: the file's order if it had one, otherwise by overall.
  for (const t of fr.teams) {
    const byPos = {};
    fr.rosters[t.id].sort((a, b) => b.ovr - a.ovr);
    for (const p of fr.rosters[t.id]) {
      byPos[p.pos] = (byPos[p.pos] || 0);
      p.depth = byPos[p.pos]++;
    }
  }

  // A team the file left thin gets topped up with generated bodies so the
  // schedule does not turn into a bunch of ghost matchups. Imported players
  // stay at the top of the depth chart — the file always wins over filler.
  const filler = generateFranchise(seedText + ':filler');
  let topped = 0;
  for (const t of fr.teams) {
    const roster = fr.rosters[t.id];
    if (roster.length >= 46) continue;
    const have = new Set(roster.map((p) => p.pos));
    for (const p of filler.rosters[t.id]) {
      if (roster.length >= 53) break;
      roster.push({ ...p, filler: true, depth: have.has(p.pos) ? p.depth + 4 : p.depth });
    }
    topped++;
  }
  for (const t of fr.teams) {
    const byPos = {};
    fr.rosters[t.id].sort((a, b) => Number(!!a.filler) - Number(!!b.filler) || b.ovr - a.ovr);
    for (const p of fr.rosters[t.id]) { byPos[p.pos] = byPos[p.pos] || 0; p.depth = byPos[p.pos]++; }
  }

  notes.push(`${placed} ${placed === 1 ? 'player' : 'players'} read out of ${filename}.`);
  if (orphans) notes.push(`${orphans} had no readable team and were spread across the league.`);
  if (topped) notes.push(`${topped} teams came up short and were topped up with generated depth.`);
  return { franchise: fr, report: { notes, imported: placed, teams: fr.teams.length } };
}

const countPlayers = (fr) => Object.values(fr.rosters).reduce((a, r) => a + r.length, 0);

/** The native save, ready to be written to disk. */
export function exportFranchise(franchise) {
  return {
    format: NATIVE_FORMAT,
    version: NATIVE_VERSION,
    saved: new Date().toISOString(),
    franchise,
  };
}
