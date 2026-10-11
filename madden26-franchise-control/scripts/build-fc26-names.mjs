// Builds fc26-data/fc26-names.json.gz from a SoFIFA-style FC 26 player CSV
// (player_id, short_name, long_name, nationality_id, nationality_name,
// club_team_id, club_name, league_id, league_name). SoFIFA ids are EA's
// player, club and league ids, so these names line up with a career save.
//
//   node scripts/build-fc26-names.mjs players.csv
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') quoted = false; else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/build-fc26-names.mjs players.csv'); process.exit(1); }
const [head, ...rows] = parseCsv(fs.readFileSync(file, 'utf8'));
const col = (n) => head.indexOf(n);
const id = (v) => (v === '' || v == null ? null : String(Math.round(Number(v))));
const out = { source: path.basename(file), players: {}, nations: {}, clubs: {}, leagues: {} };
for (const r of rows) {
  const pid = id(r[col('player_id')]);
  if (!pid) continue;
  out.players[pid] = [r[col('short_name')], r[col('long_name')], Number(id(r[col('nationality_id')])) || 0];
  const nid = id(r[col('nationality_id')]);
  if (nid) out.nations[nid] = r[col('nationality_name')];
  const cid = id(r[col('club_team_id')]);
  if (cid && r[col('club_name')]) out.clubs[cid] = r[col('club_name')];
  const lid = id(r[col('league_id')]);
  if (lid && r[col('league_name')]) out.leagues[lid] = r[col('league_name')];
}
const dest = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fc26-data/fc26-names.json.gz');
fs.writeFileSync(dest, zlib.gzipSync(JSON.stringify(out), { level: 9 }));
console.log(`${Object.keys(out.players).length} players, ${Object.keys(out.nations).length} nations, ${Object.keys(out.clubs).length} clubs, ${Object.keys(out.leagues).length} leagues -> ${dest} (${fs.statSync(dest).size} bytes)`);
