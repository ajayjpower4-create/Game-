// Player, nation, club and league names for FC 26, keyed by EA's ids.
//
// A career save only stores names for players the game made or you edited;
// everyone else's name lives in the game's own data. This list (built by
// scripts/build-fc26-names.mjs from a SoFIFA-format FC 26 player list, whose
// ids are EA's ids) fills those in.

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const NAMES_FILE = path.resolve(HERE, '../../../fc26-data/fc26-names.json.gz');

let cache = null;

export function bundledNames() {
  if (cache) return cache;
  try {
    cache = JSON.parse(zlib.gunzipSync(fs.readFileSync(NAMES_FILE)).toString('utf8'));
  } catch {
    cache = { players: {}, nations: {}, clubs: {}, leagues: {} };
  }
  return cache;
}
