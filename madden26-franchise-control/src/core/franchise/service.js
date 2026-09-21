// Owns the currently opened franchise file: opening, refreshing the league
// model, and applying injuries with a timestamped backup first.

import fs from 'node:fs';
import path from 'node:path';
import { openFranchise, readLeague, tableByUniqueIdOrName, readFields, TABLE_IDS, PLAYER_READ_FIELDS } from './reader.js';
import { planInjury, applyPlanToRecord, healFields } from './injuries.js';
import { hashString } from '../rng.js';

export class FranchiseService {
  constructor({ schemaDirectory, backupDir } = {}) {
    this.schemaDirectory = schemaDirectory || null;
    this.backupDir = backupDir || null;
    this.filePath = null;
    this.league = null;
    this.openedAt = null;
  }

  get isOpen() {
    return Boolean(this.filePath && this.league);
  }

  leagueIdFor(filePath) {
    return `file-${hashString(path.resolve(filePath)).toString(16)}`;
  }

  async open(filePath) {
    if (!fs.existsSync(filePath)) throw new Error(`Franchise file not found: ${filePath}`);
    const franchise = await openFranchise(filePath, { schemaDirectory: this.schemaDirectory });
    if (franchise.gameYear && franchise.gameYear !== 26) {
      // Still works for 25/27 saves, but the tool is tuned for 26.
      // eslint-disable-next-line no-console
      console.warn(`Opened a Madden ${franchise.gameYear} file; tool is built for Madden 26.`);
    }
    const league = await readLeague(franchise, { leagueId: this.leagueIdFor(filePath), sourceName: path.basename(filePath) });
    league.filePath = filePath;
    league.gameYear = franchise.gameYear;
    league.schema = franchise.schemaList && franchise.schemaList.meta ? { ...franchise.schemaList.meta } : null;
    this.filePath = filePath;
    this.league = league;
    this.openedAt = new Date().toISOString();
    return league;
  }

  async refresh() {
    if (!this.filePath) throw new Error('No franchise file is open');
    return this.open(this.filePath);
  }

  close() {
    this.filePath = null;
    this.league = null;
  }

  backup() {
    const dir = this.backupDir || path.join(path.dirname(this.filePath), 'franchise-control-backups');
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dest = path.join(dir, `${path.basename(this.filePath)}.${stamp}.bak`);
    fs.copyFileSync(this.filePath, dest);
    return dest;
  }

  // Apply a planned injury to the open file. `expectedName` guards against
  // writing to the wrong row if the file changed on disk since it was read.
  async applyInjury({ playerId, gameId, injuryKey, weeks, side, placeOnIR, salt }) {
    if (!this.isOpen) throw new Error('No franchise file is open');
    const player = this.league.players[playerId];
    if (!player) throw new Error(`Unknown player ${playerId}`);
    const game = gameId ? this.league.games[gameId] : null;
    const stage = game ? (game.weekType === 'PreSeason' ? 'PreSeason' : 'NFLSeason') : this.league.season.stage;
    const plan = planInjury({
      leagueId: this.league.leagueId,
      gameId: gameId || 'no-game',
      player,
      injuryKey,
      weeks,
      side,
      week: game ? game.week : this.league.season.week,
      stage,
      year: this.league.season.year,
      placeOnIR,
      salt,
    });
    const backupPath = this.backup();
    const franchise = await openFranchise(this.filePath, { schemaDirectory: this.schemaDirectory });
    const playerT = tableByUniqueIdOrName(franchise, TABLE_IDS.Player, 'Player');
    await readFields(playerT, PLAYER_READ_FIELDS);
    const record = playerT.records[player.rowIndex];
    if (!record || record.isEmpty || record.FirstName !== player.firstName || record.LastName !== player.lastName) {
      throw new Error('The franchise file changed since it was opened. Re-open it and try again.');
    }
    const written = applyPlanToRecord(record, plan);
    await franchise.save();
    await this.refresh();
    return { plan, written, backupPath };
  }

  async heal(playerId) {
    if (!this.isOpen) throw new Error('No franchise file is open');
    const player = this.league.players[playerId];
    if (!player) throw new Error(`Unknown player ${playerId}`);
    const backupPath = this.backup();
    const franchise = await openFranchise(this.filePath, { schemaDirectory: this.schemaDirectory });
    const playerT = tableByUniqueIdOrName(franchise, TABLE_IDS.Player, 'Player');
    await readFields(playerT, PLAYER_READ_FIELDS);
    const record = playerT.records[player.rowIndex];
    if (!record || record.isEmpty || record.LastName !== player.lastName) throw new Error('The franchise file changed since it was opened. Re-open it and try again.');
    const fields = healFields();
    const written = {};
    for (const [k, v] of Object.entries(fields)) if (k in record.fields) { record[k] = v; written[k] = record[k]; }
    await franchise.save();
    await this.refresh();
    return { written, backupPath };
  }
}
