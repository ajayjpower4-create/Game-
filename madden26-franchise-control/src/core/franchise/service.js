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
    if (this.keepBackups) this.pruneBackups(this.keepBackups);
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

  // Write a planned schedule change (see schedule.js). Each game's teams are
  // checked against what the plan expects before anything is written, the
  // file is re-read afterwards to confirm the new matchups, and the backup is
  // put back if they do not match.
  async applyScheduleChange(plan) {
    if (!this.isOpen) throw new Error('No franchise file is open');
    const backupPath = this.backup();
    const franchise = await openFranchise(this.filePath, { schemaDirectory: this.schemaDirectory });
    const gameT = tableByUniqueIdOrName(franchise, TABLE_IDS.SeasonGame, 'SeasonGame');
    const teamT = tableByUniqueIdOrName(franchise, TABLE_IDS.Team, 'Team');
    await readFields(gameT, ['HomeTeam', 'AwayTeam', 'GameStatus', 'SeasonWeek', 'SeasonWeekType']);
    await readFields(teamT, ['TeamIndex', 'TEAM_TYPE']);
    const rowOf = (teamId) => {
      const t = this.league.teams[teamId];
      if (!t || !Number.isFinite(t.rowIndex)) throw new Error(`Unknown team ${teamId}`);
      return t.rowIndex;
    };
    const refRow = (rec, key) => {
      const r = rec.getReferenceDataByKey(key);
      return r && r.tableId === teamT.header.tableId ? r.rowNumber : null;
    };
    for (const c of plan.changes) {
      const rec = gameT.records[c.rowIndex];
      if (!rec || rec.isEmpty) throw new Error('The franchise file changed since it was opened. Refresh and try again.');
      if (['HomeWon', 'AwayWon', 'Tied'].includes(rec.GameStatus)) throw new Error(`${c.label} has been played since the file was opened.`);
      if (refRow(rec, 'HomeTeam') !== rowOf(c.before.home) || refRow(rec, 'AwayTeam') !== rowOf(c.before.away)) throw new Error('That game no longer has the teams the change was planned for. Refresh and try again.');
    }
    for (const c of plan.changes) {
      const rec = gameT.records[c.rowIndex];
      rec.HomeTeam = teamT.getBinaryReferenceToRecord(rowOf(c.after.home));
      rec.AwayTeam = teamT.getBinaryReferenceToRecord(rowOf(c.after.away));
    }
    await franchise.save();
    await this.refresh();
    const wrong = plan.changes.filter((c) => {
      const g = this.league.games[c.gameId];
      return !g || g.homeTeamId !== c.after.home || g.awayTeamId !== c.after.away;
    });
    if (wrong.length) {
      fs.copyFileSync(backupPath, this.filePath);
      await this.refresh();
      throw new Error('The change did not read back correctly, so the file was put back the way it was.');
    }
    return { backupPath, games: plan.changes.map((c) => this.league.games[c.gameId]) };
  }

  // Backups of the open file, newest first.
  listBackups() {
    if (!this.filePath) return [];
    const dir = this.backupDir || path.join(path.dirname(this.filePath), 'franchise-control-backups');
    if (!fs.existsSync(dir)) return [];
    const base = path.basename(this.filePath);
    return fs.readdirSync(dir)
      .filter((f) => f.startsWith(`${base}.`) && f.endsWith('.bak'))
      .map((f) => { const st = fs.statSync(path.join(dir, f)); return { file: f, path: path.join(dir, f), size: st.size, modified: st.mtime.toISOString() }; })
      .sort((a, b) => b.modified.localeCompare(a.modified));
  }

  // Keep only the newest `keep` backups of the open file.
  pruneBackups(keep) {
    if (!keep || keep < 1) return 0;
    const list = this.listBackups();
    let removed = 0;
    for (const b of list.slice(keep)) { try { fs.unlinkSync(b.path); removed++; } catch { /* in use */ } }
    return removed;
  }

  // Put a backup back in place of the open file (backing up the current one first).
  async restoreBackup(file) {
    if (!this.isOpen) throw new Error('No franchise file is open');
    const b = this.listBackups().find((x) => x.file === file);
    if (!b) throw new Error('That backup is not in the backup folder.');
    const safety = this.backup();
    fs.copyFileSync(b.path, this.filePath);
    await this.refresh();
    return { restored: b, safety };
  }

  fileStatus() {
    if (!this.filePath || !fs.existsSync(this.filePath)) return null;
    const st = fs.statSync(this.filePath);
    return { path: this.filePath, modified: st.mtime.toISOString(), size: st.size, openedAt: this.openedAt };
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
