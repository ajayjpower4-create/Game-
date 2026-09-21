// The tracker's memory. Every time a franchise file is opened, the per-game
// lines it holds are folded into a history file kept beside the app's own
// data. Madden rolls old games out of the save; this does not — once the
// tracker has seen a game, it keeps it.

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

let baseDir = null;

function setBaseDir(dir) { baseDir = dir; }

const idFor = (filePath) => crypto.createHash('sha1').update(String(filePath)).digest('hex').slice(0, 12);

async function historyPath(filePath) {
  const dir = path.join(baseDir, 'tracker');
  await fs.mkdir(dir, { recursive: true });
  return path.join(dir, `${idFor(filePath)}.json`);
}

async function loadHistory(filePath) {
  try { return JSON.parse(await fs.readFile(await historyPath(filePath), 'utf8')); }
  catch { return { file: filePath, games: [], lines: {}, updated: null }; }
}

async function saveHistory(filePath, history) {
  history.updated = new Date().toISOString();
  await fs.writeFile(await historyPath(filePath), JSON.stringify(history), 'utf8');
  return history;
}

/**
 * Fold a fresh read into the history. Lines are keyed by game row + player, so
 * opening the same save repeatedly changes nothing, and a game that has since
 * dropped out of the file stays recorded.
 */
function foldIn(history, { lines, teamGames, week, year }) {
  const seen = new Set();
  for (const line of lines) {
    const key = `${year || 0}:${line.gameRow ?? 'x'}:${line.playerId}:${line.kind}`;
    history.lines[key] = { ...line, year, seenAt: Date.now() };
    seen.add(`${year || 0}:${line.gameRow ?? 'x'}`);
  }
  const games = new Map((history.games || []).map((g) => [g.key, g]));
  for (const key of seen) {
    const gameRow = Number(key.split(':')[1]);
    games.set(key, { key, gameRow, year, week: games.has(key) ? games.get(key).week : week });
  }
  history.games = [...games.values()];
  history.teamGames = { ...(history.teamGames || {}), ...(teamGames || {}) };
  history.counts = {
    games: history.games.length,
    lines: Object.keys(history.lines).length,
  };
  return history;
}

/** Everything the tracker holds for a franchise, ready for the UI. */
function readOut(history) {
  return {
    games: history.games || [],
    lines: Object.values(history.lines || {}),
    teamGames: history.teamGames || {},
    counts: history.counts || { games: 0, lines: 0 },
    updated: history.updated,
  };
}

module.exports = { setBaseDir, loadHistory, saveHistory, foldIn, readOut, historyPath };
