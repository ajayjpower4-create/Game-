// Reading an actual Madden franchise file.
//
// This leans on `madden-franchise` (bep713), the same parser the community
// franchise tools are built on, which covers Madden 19 through 27. Everything
// here is field names straight out of the Madden 26 schema — no guessing:
//
//   Player   FirstName, LastName, Position, OverallRating, TeamIndex,
//            InjuryType, InjurySeverity, InjuryStatus, TotalInjuryDuration…
//   Team     TeamIndex, DisplayName, LongName, ShortName, Roster
//   SeasonGame        SeasonWeek, HomeTeam, AwayTeam, scores, GameStatus
//   SeasonOLineStats  OLINEPANCAKES, OLINESACKSALLOWED, DOWNSPLAYED
//   SeasonOffensiveStats  RECEIVECATCHES, RECEIVEDROPS, RECEIVEYARDS…
//   SeasonDefensiveStats  DEFTACKLES, DLINESACKS, CTHALLOWED, BIGHITS…
//
// What Madden does NOT keep, so nothing here can invent it: per-blocker
// pressures, "almost sacks", missed tackles, missed sacks, per-player
// penalties. Penalties are team-level only (TeamStats.PENALTIES).

const path = require('path');

let lib = null;
async function getLib() {
  if (!lib) lib = require('madden-franchise');
  return lib;
}

/**
 * Madden 26 and 27 saves are zstd-compressed, and the parser decompresses them
 * with Node's own zlib.zstd… functions, which only exist from Node 22.15. A
 * runtime without them cannot read a 26 file at all, so say that plainly
 * rather than letting it surface as "zstdDecompressSync is not a function".
 */
function checkZstd() {
  const zlib = require('zlib');
  if (typeof zlib.zstdDecompressSync === 'function') return null;
  return `This build runs Node ${process.versions.node}, which has no zstd support. `
    + 'Madden 26 saves are zstd-compressed and cannot be read without it (Node 22.15 or newer).';
}

const PLAYER_FIELDS = [
  'FirstName', 'LastName', 'Position', 'OverallRating', 'Age', 'JerseyNum',
  'TeamIndex', 'InjuryRating', 'InjuryStatus', 'InjuryType', 'InjurySeverity',
  'TotalInjuryDuration', 'MinInjuryDuration', 'MaxInjuryDuration',
  'IsInjuredReserve', 'LatestInjuryWeek', 'LatestInjuryYear',
  'ContractStatus', 'SeasonStats', 'GameStats',
];

const TEAM_FIELDS = ['TeamIndex', 'DisplayName', 'LongName', 'ShortName', 'NickName', 'TEAM_PREFIX_NAME', 'TEAM_TYPE'];

// A franchise file carries far more "teams" than the 32 clubs: practice
// squads (the PRA rows), free agency, the Pro Bowl, old-time and template
// shells. Only TEAM_TYPE 'Current' is a real NFL team.
const REAL_TEAM_TYPE = 'Current';

const GAME_FIELDS = [
  'SeasonWeek', 'SeasonWeekType', 'SeasonYear', 'SeasonGameNum', 'HomeTeam', 'AwayTeam',
  'HomeScore', 'AwayScore', 'GameStatus', 'IsPractice', 'IsSimmed',
];

const GAME_STAT_TABLES = {
  oline: { table: 'GameOLineStats', fields: ['DOWNSPLAYED', 'GAMESSTARTED', 'GAMERATING', 'OLINEPANCAKES', 'OLINESACKSALLOWED', 'SeasonGame', 'OpposingTeam'] },
  offense: { table: 'GameOffensiveStats', fields: ['DOWNSPLAYED', 'GAMESSTARTED', 'GAMERATING', 'RECEIVECATCHES', 'RECEIVEDROPS', 'RECEIVEYARDS', 'RECEIVETDS', 'RECEIVEYARDSAFTER', 'RUSHATTEMPTS', 'RUSHYARDS', 'RUSHBROKENTACKLES', 'PASSATTEMPTS', 'PASSCOMPLETED', 'PASSSACKED', 'SeasonGame', 'OpposingTeam'] },
  defense: { table: 'GameDefensiveStats', fields: ['DOWNSPLAYED', 'GAMESSTARTED', 'GAMERATING', 'DEFTACKLES', 'ASSDEFTACKLES', 'DEFTACKLESFORLOSS', 'DLINESACKS', 'DLINEHALFSACK', 'DEFPASSDEFLECTIONS', 'DSECINTS', 'BIGHITS', 'CTHALLOWED', 'SeasonGame', 'OpposingTeam'] },
};

const TEAM_GAME_FIELDS = [
  'PENALTIES', 'PENALTYYARDS', 'SACKS', 'SACKSALLOWED', 'OFFYARDS', 'OFFPASSYARDS', 'OFFRUSHYARDS',
  'PASSATTEMPTS', 'RUSHATTEMPTS', 'THIRDDOWNS', 'THIRDDOWNCONV', 'TACKLESFORLOSS', 'FORCEDFUMBLES',
  'GIVEAWAYS', 'TAKEAWAYS', 'POSSESSIONTIME', 'FIRSTDOWNS', 'WINS', 'LOSSES',
];

const STAT_TABLES = {
  oline: { table: 'SeasonOLineStats', fields: ['DOWNSPLAYED', 'GAMESPLAYED', 'GAMESSTARTED', 'GAMERATING', 'OLINEPANCAKES', 'OLINESACKSALLOWED', 'SEAS_YEAR'] },
  offense: { table: 'SeasonOffensiveStats', fields: ['DOWNSPLAYED', 'GAMESPLAYED', 'GAMESSTARTED', 'GAMERATING', 'RECEIVECATCHES', 'RECEIVEDROPS', 'RECEIVEYARDS', 'RECEIVETDS', 'RECEIVEYARDSAFTER', 'RECEIVELONGEST', 'RUSHATTEMPTS', 'RUSHYARDS', 'RUSHTDS', 'RUSHBROKENTACKLES', 'RUSHFUMBLES', 'PASSATTEMPTS', 'PASSCOMPLETED', 'PASSYARDS', 'PASSTDS', 'PASSINTS', 'PASSSACKED', 'SEAS_YEAR'] },
  defense: { table: 'SeasonDefensiveStats', fields: ['DOWNSPLAYED', 'GAMESPLAYED', 'GAMESSTARTED', 'GAMERATING', 'DEFTACKLES', 'ASSDEFTACKLES', 'DEFTACKLESFORLOSS', 'DLINESACKS', 'DLINEHALFSACK', 'DEFPASSDEFLECTIONS', 'DSECINTS', 'BIGHITS', 'CTHALLOWED', 'DLINEFORCEDFUMBLES', 'SEAS_YEAR'] },
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Enum fields come back as their name ("KneeACLCompleteTear"); plain fields as
// numbers or strings. Records also throw on fields a file happens not to hold,
// so every read goes through here.
function val(record, key, fallback = null) {
  try {
    const v = record[key];
    return v === undefined || v === null ? fallback : v;
  } catch { return fallback; }
}

function reference(record, key) {
  try {
    const field = record.getFieldByKey(key);
    if (!field || !field.isReference) return null;
    const ref = field.referenceData;
    if (!ref || !ref.tableId) return null;
    return ref;
  } catch { return null; }
}

/**
 * Follow a player's SeasonStats reference to the stat rows behind it. The
 * field points either straight at a stats row or at an array table holding one
 * reference per season, so handle both and keep the newest year.
 */
async function resolveStatRows(file, record, key, cache) {
  const ref = reference(record, key);
  if (!ref) return [];
  const rows = [];
  const visit = async (tableId, rowNumber, depth) => {
    if (depth > 2) return;
    const table = file.getTableById(tableId);
    if (!table) return;
    const name = table.name || (table.header && table.header.name) || '';
    const spec = [...Object.values(STAT_TABLES), ...Object.values(GAME_STAT_TABLES)].find((s) => s.table === name);
    if (spec) {
      if (!cache.read.has(name)) { await table.readRecords(spec.fields); cache.read.add(name); }
      const row = table.records[rowNumber];
      if (row) rows.push({ table: name, row });
      return;
    }
    // An array table: every field on the row is another reference.
    if (!cache.read.has(`arr:${tableId}`)) { await table.readRecords(); cache.read.add(`arr:${tableId}`); }
    const arrayRow = table.records[rowNumber];
    if (!arrayRow || !arrayRow.fields) return;
    for (const field of Object.values(arrayRow.fields)) {
      if (!field.isReference) continue;
      const r = field.referenceData;
      if (r && r.tableId) await visit(r.tableId, r.rowNumber, depth + 1);
    }
  };
  await visit(ref.tableId, ref.rowNumber, 0);
  return rows;
}

const pickStats = (rows, tableName, year) => {
  const mine = rows.filter((r) => r.table === tableName);
  if (!mine.length) return null;
  const forYear = mine.find((r) => num(val(r.row, 'SEAS_YEAR', -1)) === year);
  return (forYear || mine[mine.length - 1]).row;
};

/**
 * Open a franchise file and pull out everything the Control Center shows.
 * Returns { franchise, report } — the report says what was actually found, so
 * nothing has to be taken on faith.
 */
async function openFranchiseFile(filePath, { withStats = true } = {}) {
  const missing = checkZstd();
  if (missing) throw new Error(missing);
  const { create } = await getLib();
  const file = await create(filePath);

  const meta = (file.schema && file.schema.meta) || {};
  const notes = [];
  notes.push(`Madden ${meta.gameYear || '?'} franchise file, schema ${meta.major || '?'}.${meta.minor || '?'}.`);

  /* ---- season ---- */
  let year = 0, week = 1;
  const seasonInfo = file.getTableByName('SeasonInfo');
  if (seasonInfo) {
    await seasonInfo.readRecords(['CurrentSeasonYear', 'CurrentWeek', 'CurrentYear', 'CurrentStage']);
    const s = seasonInfo.records[0];
    if (s) {
      year = num(val(s, 'CurrentSeasonYear', 0)) || num(val(s, 'CurrentYear', 0));
      week = num(val(s, 'CurrentWeek', 0)) + 1;
    }
  }

  /* ---- teams ---- */
  const teamTable = file.getTableByName('Team');
  if (!teamTable) throw new Error('No Team table in that file — it may not be a franchise save.');
  await teamTable.readRecords(TEAM_FIELDS);
  const teams = [];
  const teamByIndex = new Map();
  const teamByRow = new Map();
  for (let row = 0; row < teamTable.records.length; row++) {
    const rec = teamTable.records[row];
    if (!rec || rec.isEmpty) continue;
    const display = String(val(rec, 'DisplayName', '') || '').trim();
    const nick = String(val(rec, 'NickName', '') || val(rec, 'ShortName', '') || '').trim();
    const long = String(val(rec, 'LongName', '') || '').trim();
    const index = num(val(rec, 'TeamIndex', -1));
    const type = String(val(rec, 'TEAM_TYPE', ''));
    if (type && type !== REAL_TEAM_TYPE) continue;      // practice, free agency, Pro Bowl…
    if (index < 0 || (!display && !nick)) continue;
    // Without a readable type, fall back on the name: practice rows are PRA.
    if (!type && /^pra/i.test(String(val(rec, 'ShortName', '')))) continue;
    const team = {
      id: (val(rec, 'ShortName', '') || nick || display || `T${index}`).toString().toUpperCase().slice(0, 4),
      index,
      row,
      city: display,
      name: nick || long || display,
      conf: '', div: '',
    };
    if (teamByIndex.has(index)) continue;
    teamByIndex.set(index, team);
    teamByRow.set(row, team);
    teams.push(team);
  }
  notes.push(`${teams.length} teams.`);

  /* ---- players ---- */
  const playerTable = file.getTableByName('Player');
  if (!playerTable) throw new Error('No Player table in that file.');
  await playerTable.readRecords(PLAYER_FIELDS);

  const rosters = {};
  for (const t of teams) rosters[t.id] = [];
  const cache = { read: new Set() };
  let statHits = 0, playerCount = 0, injured = 0;

  for (let i = 0; i < playerTable.records.length; i++) {
    const rec = playerTable.records[i];
    if (!rec || rec.isEmpty) continue;
    const teamIndex = num(val(rec, 'TeamIndex', -1));
    const team = teamByIndex.get(teamIndex);
    if (!team) continue;                              // free agents and draft classes
    const first = String(val(rec, 'FirstName', '') || '').trim();
    const last = String(val(rec, 'LastName', '') || '').trim();
    if (!first && !last) continue;

    const injuryStatus = String(val(rec, 'InjuryStatus', 'Uninjured'));
    const duration = num(val(rec, 'TotalInjuryDuration', 0));
    const hurt = injuryStatus === 'Injured' || duration > 0;
    if (hurt) injured++;

    const player = {
      id: `R${i}`,
      row: i,
      name: `${first} ${last}`.trim(),
      first, last,
      pos: String(val(rec, 'Position', 'WR')),
      team: team.id,
      teamIndex,
      ovr: num(val(rec, 'OverallRating', 0)),
      age: num(val(rec, 'Age', 0)),
      jersey: num(val(rec, 'JerseyNum', 0)),
      dur: num(val(rec, 'InjuryRating', 0)),
      depth: 0,
      injury: hurt ? {
        typeName: String(val(rec, 'InjuryType', 'Unknown')),
        severity: String(val(rec, 'InjurySeverity', '')),
        gamesOut: duration,
        returnWeek: num(val(rec, 'LatestInjuryWeek', 0)) + duration,
        week: num(val(rec, 'LatestInjuryWeek', 0)),
        ir: val(rec, 'IsInjuredReserve', false) === true,
      } : null,
      stats: null,
    };

    if (withStats) {
      try {
        const rows = await resolveStatRows(file, rec, 'SeasonStats', cache);
        if (rows.length) {
          statHits++;
          const oline = pickStats(rows, 'SeasonOLineStats', year);
          const off = pickStats(rows, 'SeasonOffensiveStats', year);
          const def = pickStats(rows, 'SeasonDefensiveStats', year);
          player.stats = {
            snaps: num(val(oline || off || def, 'DOWNSPLAYED', 0)),
            games: num(val(oline || off || def, 'GAMESPLAYED', 0)),
            started: num(val(oline || off || def, 'GAMESSTARTED', 0)),
            grade: num(val(oline || off || def, 'GAMERATING', 0)),
            pancakes: oline ? num(val(oline, 'OLINEPANCAKES', 0)) : 0,
            sacksAllowed: oline ? num(val(oline, 'OLINESACKSALLOWED', 0)) : 0,
            catches: off ? num(val(off, 'RECEIVECATCHES', 0)) : 0,
            drops: off ? num(val(off, 'RECEIVEDROPS', 0)) : 0,
            recYards: off ? num(val(off, 'RECEIVEYARDS', 0)) : 0,
            recTds: off ? num(val(off, 'RECEIVETDS', 0)) : 0,
            yac: off ? num(val(off, 'RECEIVEYARDSAFTER', 0)) : 0,
            brokenTackles: off ? num(val(off, 'RUSHBROKENTACKLES', 0)) : 0,
            tackles: def ? num(val(def, 'DEFTACKLES', 0)) : 0,
            assists: def ? num(val(def, 'ASSDEFTACKLES', 0)) : 0,
            tfl: def ? num(val(def, 'DEFTACKLESFORLOSS', 0)) : 0,
            sacks: def ? num(val(def, 'DLINESACKS', 0)) + num(val(def, 'DLINEHALFSACK', 0)) / 2 : 0,
            pbu: def ? num(val(def, 'DEFPASSDEFLECTIONS', 0)) : 0,
            ints: def ? num(val(def, 'DSECINTS', 0)) : 0,
            bigHits: def ? num(val(def, 'BIGHITS', 0)) : 0,
            catchesAllowed: def ? num(val(def, 'CTHALLOWED', 0)) : 0,
          };
        }
      } catch { /* this player's stats stay null; the roster still loads */ }
    }

    rosters[team.id].push(player);
    playerCount++;
  }

  for (const t of teams) {
    const byPos = {};
    rosters[t.id].sort((a, b) => b.ovr - a.ovr);
    for (const p of rosters[t.id]) { byPos[p.pos] = byPos[p.pos] || 0; p.depth = byPos[p.pos]++; }
  }
  notes.push(`${playerCount} players on rosters, ${injured} of them hurt.`);
  notes.push(withStats
    ? `Season stats resolved for ${statHits} players.`
    : 'Stats skipped for a faster load.');

  /* ---- schedule ---- */
  const schedule = [];
  const gameTable = file.getTableByName('SeasonGame');
  if (gameTable) {
    await gameTable.readRecords(GAME_FIELDS);
    for (let i = 0; i < gameTable.records.length; i++) {
      const rec = gameTable.records[i];
      if (!rec || rec.isEmpty) continue;
      if (val(rec, 'IsPractice', false) === true) continue;
      const homeRef = reference(rec, 'HomeTeam');
      const awayRef = reference(rec, 'AwayTeam');
      if (!homeRef || !awayRef) continue;
      const weekType = String(val(rec, 'SeasonWeekType', 'RegularSeason'));
      // RegularSeason and the playoff rounds. Preseason, the Pro Bowl and
      // offseason weeks are not games anybody wants in a schedule.
      if (!/^(RegularSeason|WildcardPlayoff|DivisionalPlayoff|ConferencePlayoff|SuperBowl)$/i.test(weekType)) continue;
      const homeTeam = teamByRow.get(homeRef.rowNumber);
      const awayTeam = teamByRow.get(awayRef.rowNumber);
      if (!homeTeam || !awayTeam) continue;      // Pro Bowl and other odd slates
      schedule.push({
        id: `G${i}`,
        row: i,
        week: num(val(rec, 'SeasonWeek', 0)) + 1,
        weekType,
        home: homeTeam.id,
        away: awayTeam.id,
        homeScore: num(val(rec, 'HomeScore', 0)),
        awayScore: num(val(rec, 'AwayScore', 0)),
        status: String(val(rec, 'GameStatus', '')),
        played: /^(AwayWon|HomeWon|Tied|StatsReported)$/i.test(String(val(rec, 'GameStatus', ''))),
      });
    }
    notes.push(`${schedule.length} games on the schedule.`);
  } else {
    notes.push('No schedule table found in this file.');
  }

  return {
    file,
    meta,
    data: { year, week, teams, rosters, schedule },
    report: { notes, players: playerCount, teams: teams.length, statHits, games: schedule.length },
  };
}

module.exports = { openFranchiseFile, PLAYER_FIELDS, STAT_TABLES };

/* ------------------------------------------------------------ writing back */

// Real InjuryType values out of the Madden 26 enum, with plain-English labels
// and the InjurySeverity that goes with each. Weeks is what gets written to
// TotalInjuryDuration — the file counts in weeks out.
const INJURIES = [
  { id: 'KneeACLCompleteTear', label: 'Torn ACL', severity: 'SeasonEnding', weeks: 17 },
  { id: 'AnkleAchillesTear', label: 'Torn Achilles', severity: 'SeasonEnding', weeks: 17 },
  { id: 'KneePCLCompleteTear', label: 'Torn PCL', severity: 'SeasonEnding', weeks: 17 },
  { id: 'KneeMCLCompleteTear', label: 'Torn MCL', severity: 'SeasonEnding', weeks: 16 },
  { id: 'LegBrokenFemur', label: 'Broken Femur', severity: 'SeasonEnding', weeks: 17 },
  { id: 'BackVertebraeBroken', label: 'Broken Vertebrae', severity: 'SeasonEnding', weeks: 17 },
  { id: 'KneeACLPartialTear', label: 'Partially Torn ACL', severity: 'SeveralGames', weeks: 10 },
  { id: 'LegTibiaBroken', label: 'Broken Tibia', severity: 'SeveralGames', weeks: 10 },
  { id: 'LegFibulaBroken', label: 'Broken Fibula', severity: 'SeveralGames', weeks: 8 },
  { id: 'RibCollarboneBroken', label: 'Broken Collarbone', severity: 'SeveralGames', weeks: 7 },
  { id: 'ShoulderRotatorCuffTear', label: 'Torn Rotator Cuff', severity: 'SeveralGames', weeks: 8 },
  { id: 'LegHamstringTear', label: 'Torn Hamstring', severity: 'SeveralGames', weeks: 6 },
  { id: 'KneeCartilageTear', label: 'Torn Knee Cartilage', severity: 'SeveralGames', weeks: 6 },
  { id: 'AnkleBroken', label: 'Broken Ankle', severity: 'SeveralGames', weeks: 8 },
  { id: 'HandWristBroken', label: 'Broken Wrist', severity: 'SeveralGames', weeks: 6 },
  { id: 'FootStressFracture', label: 'Stress Fracture in the Foot', severity: 'SeveralGames', weeks: 6 },
  { id: 'KneeMCLSprain', label: 'MCL Sprain', severity: 'CoupleGames', weeks: 4 },
  { id: 'KneeACLSprain', label: 'ACL Sprain', severity: 'CoupleGames', weeks: 4 },
  { id: 'AnkleHighSprain', label: 'High Ankle Sprain', severity: 'CoupleGames', weeks: 4 },
  { id: 'ShoulderDislocation', label: 'Dislocated Shoulder', severity: 'CoupleGames', weeks: 3 },
  { id: 'RibBrokenRibs', label: 'Broken Ribs', severity: 'CoupleGames', weeks: 3 },
  { id: 'LegHamstringPull', label: 'Pulled Hamstring', severity: 'CoupleGames', weeks: 2 },
  { id: 'LegGroinPull', label: 'Pulled Groin', severity: 'CoupleGames', weeks: 2 },
  { id: 'BackStrain', label: 'Back Strain', severity: 'CoupleGames', weeks: 2 },
  { id: 'FootTurfToe', label: 'Turf Toe', severity: 'CoupleGames', weeks: 2 },
  { id: 'AnkleSprain', label: 'Ankle Sprain', severity: 'GameEnding', weeks: 1 },
  { id: 'HandFingerBroken', label: 'Broken Finger', severity: 'GameEnding', weeks: 1 },
  { id: 'KneeBruise', label: 'Bruised Knee', severity: 'GameEnding', weeks: 1 },
  { id: 'RibBruisedRibs', label: 'Bruised Ribs', severity: 'GameEnding', weeks: 1 },
  { id: 'LegQuadBruise', label: 'Bruised Quad', severity: 'CoupleQtrs', weeks: 0 },
  { id: 'LegCramp', label: 'Cramps', severity: 'CouplePlays', weeks: 0 },
  { id: 'RibWindKnockedOut', label: 'Wind Knocked Out', severity: 'CouplePlays', weeks: 0 },
];

/**
 * Write an injury onto a player and save the file. The caller has already
 * backed the file up — see main.js — because this rewrites the real save.
 */
async function writeInjury(file, { playerRow, injuryId, weeks, week, year, side = 'NA', ir = false }) {
  const injury = INJURIES.find((i) => i.id === injuryId);
  if (!injury) throw new Error(`Unknown injury: ${injuryId}`);

  const playerTable = file.getTableByName('Player');
  await playerTable.readRecords(PLAYER_FIELDS);
  const record = playerTable.records[playerRow];
  if (!record || record.isEmpty) throw new Error('That player is no longer in the file.');

  const weeksOut = Math.max(0, Math.round(weeks ?? injury.weeks));
  const set = (key, value) => { try { record[key] = value; return true; } catch { return false; } };

  const written = {
    InjuryType: set('InjuryType', injury.id),
    InjurySeverity: set('InjurySeverity', injury.severity),
    InjuryStatus: set('InjuryStatus', 'Injured'),
    InjurySide: set('InjurySide', side),
    TotalInjuryDuration: set('TotalInjuryDuration', weeksOut),
    MinInjuryDuration: set('MinInjuryDuration', weeksOut),
    MaxInjuryDuration: set('MaxInjuryDuration', weeksOut),
    LatestInjuryWeek: set('LatestInjuryWeek', Math.max(0, (week || 1) - 1)),
    LatestInjuryYear: set('LatestInjuryYear', year || 0),
    WasPreviouslyInjured: set('WasPreviouslyInjured', true),
    IsInjuredReserve: ir ? set('IsInjuredReserve', true) : false,
  };

  await file.save();
  return {
    player: `${val(record, 'FirstName', '')} ${val(record, 'LastName', '')}`.trim(),
    injury: injury.label,
    weeksOut,
    written: Object.entries(written).filter(([, ok]) => ok).map(([k]) => k),
    skipped: Object.entries(written).filter(([, ok]) => !ok).map(([k]) => k),
  };
}

/** Put a player back on the field: clears the injury fields. */
async function clearInjury(file, playerRow) {
  const playerTable = file.getTableByName('Player');
  await playerTable.readRecords(PLAYER_FIELDS);
  const record = playerTable.records[playerRow];
  if (!record || record.isEmpty) throw new Error('That player is no longer in the file.');
  const set = (key, value) => { try { record[key] = value; } catch { /* field not in this file */ } };
  set('InjuryStatus', 'Uninjured');
  set('TotalInjuryDuration', 0);
  set('MinInjuryDuration', 0);
  set('MaxInjuryDuration', 0);
  set('IsInjuredReserve', false);
  await file.save();
  return true;
}

module.exports.INJURIES = INJURIES;
module.exports.writeInjury = writeInjury;
module.exports.clearInjury = clearInjury;

/* --------------------------------------------------------- per-game reading */

/**
 * Every game line in the file, player by player. Madden keeps these in
 * GameOLineStats / GameOffensiveStats / GameDefensiveStats, one row per player
 * per game, each pointing back at the SeasonGame it belongs to. This is what
 * the tracker records against; it does not rely on the season totals.
 */
async function readGameLines(file, { teams, rosters }) {
  const cache = { read: new Set() };
  const playerTable = file.getTableByName('Player');
  await playerTable.readRecords(PLAYER_FIELDS);

  // Which SeasonGame row a stat line belongs to, so lines can be grouped by game.
  const gameOf = (row) => {
    const ref = reference(row, 'SeasonGame');
    return ref ? ref.rowNumber : null;
  };

  const lines = [];
  let resolved = 0;
  for (const team of teams) {
    for (const player of rosters[team.id] || []) {
      const rec = playerTable.records[player.row];
      if (!rec || rec.isEmpty) continue;
      let rows;
      try { rows = await resolveStatRows(file, rec, 'GameStats', cache); }
      catch { continue; }
      if (!rows.length) continue;
      resolved++;
      for (const { table, row } of rows) {
        const gameRow = gameOf(row);
        const line = {
          playerId: player.id,
          playerRow: player.row,
          name: player.name,
          pos: player.pos,
          team: team.id,
          gameRow,
          snaps: num(val(row, 'DOWNSPLAYED', 0)),
          started: num(val(row, 'GAMESSTARTED', 0)),
          grade: num(val(row, 'GAMERATING', 0)),
        };
        if (table === 'GameOLineStats') {
          line.kind = 'blocking';
          line.pancakes = num(val(row, 'OLINEPANCAKES', 0));
          line.sacksAllowed = num(val(row, 'OLINESACKSALLOWED', 0));
        } else if (table === 'GameOffensiveStats') {
          line.kind = 'offense';
          line.catches = num(val(row, 'RECEIVECATCHES', 0));
          line.drops = num(val(row, 'RECEIVEDROPS', 0));
          line.recYards = num(val(row, 'RECEIVEYARDS', 0));
          line.recTds = num(val(row, 'RECEIVETDS', 0));
          line.yac = num(val(row, 'RECEIVEYARDSAFTER', 0));
          line.rushAtt = num(val(row, 'RUSHATTEMPTS', 0));
          line.rushYards = num(val(row, 'RUSHYARDS', 0));
          line.brokenTackles = num(val(row, 'RUSHBROKENTACKLES', 0));
          line.passAtt = num(val(row, 'PASSATTEMPTS', 0));
          line.passSacked = num(val(row, 'PASSSACKED', 0));
        } else if (table === 'GameDefensiveStats') {
          line.kind = 'defense';
          line.tackles = num(val(row, 'DEFTACKLES', 0));
          line.assists = num(val(row, 'ASSDEFTACKLES', 0));
          line.tfl = num(val(row, 'DEFTACKLESFORLOSS', 0));
          line.sacks = num(val(row, 'DLINESACKS', 0)) + num(val(row, 'DLINEHALFSACK', 0)) / 2;
          line.pbu = num(val(row, 'DEFPASSDEFLECTIONS', 0));
          line.ints = num(val(row, 'DSECINTS', 0));
          line.bigHits = num(val(row, 'BIGHITS', 0));
          line.catchesAllowed = num(val(row, 'CTHALLOWED', 0));
        } else continue;
        lines.push(line);
      }
    }
  }
  return { lines, resolved };
}

/**
 * Per-game team stats — including the penalty counts Madden only keeps at team
 * level. TeamGameStatsRegSeason is an array of TeamStats rows, one per game.
 */
async function readTeamGameStats(file, teams) {
  const teamTable = file.getTableByName('Team');
  await teamTable.readRecords(['TeamGameStatsRegSeason', 'TeamIndex']);
  const cache = { read: new Set() };
  const out = {};

  for (const team of teams) {
    const rec = teamTable.records[team.row];
    if (!rec || rec.isEmpty) continue;
    const ref = reference(rec, 'TeamGameStatsRegSeason');
    if (!ref) continue;
    const arrayTable = file.getTableById(ref.tableId);
    if (!arrayTable) continue;
    try {
      if (!cache.read.has(`arr:${ref.tableId}`)) { await arrayTable.readRecords(); cache.read.add(`arr:${ref.tableId}`); }
      const arrayRow = arrayTable.records[ref.rowNumber];
      if (!arrayRow || !arrayRow.fields) continue;
      const games = [];
      for (const field of Object.values(arrayRow.fields)) {
        if (!field.isReference) continue;
        const r = field.referenceData;
        if (!r || !r.tableId) continue;
        const statTable = file.getTableById(r.tableId);
        if (!statTable) continue;
        if (!cache.read.has(`ts:${r.tableId}`)) { await statTable.readRecords(TEAM_GAME_FIELDS); cache.read.add(`ts:${r.tableId}`); }
        const statRow = statTable.records[r.rowNumber];
        if (!statRow || statRow.isEmpty) continue;
        const game = { week: games.length + 1 };
        let any = false;
        for (const key of TEAM_GAME_FIELDS) {
          const v = num(val(statRow, key, 0));
          game[key] = v;
          if (v) any = true;
        }
        if (any) games.push(game);
      }
      if (games.length) out[team.id] = games;
    } catch { /* this team's per-game stats stay out of the tracker */ }
  }
  return out;
}

module.exports.readGameLines = readGameLines;
module.exports.readTeamGameStats = readTeamGameStats;
module.exports.GAME_STAT_TABLES = GAME_STAT_TABLES;
