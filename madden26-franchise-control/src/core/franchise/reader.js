// Reads a Madden NFL 26 PC franchise file into the tool's league model using
// the madden-franchise library. Everything here is read-only; writes live in
// injuries.js / service.js.
//
// What the file gives us that the in-game UI never shows:
//   - DOWNSPLAYED on every per-game stat row = real snap counts per player
//   - OLINEPANCAKES / OLINESACKSALLOWED on offensive-line rows
//   - DEFPRESSURES / DEFTARGETS / STOPS / STUFFS on career defensive rows
//   - PRESSURES / TARGETS / ROUTESRUN on career offensive rows
//   - InjuryCache on each game: the injuries the game itself handed out

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const BUNDLED_SCHEMA_DIR = path.resolve(HERE, '../../../schemas');

export const TABLE_IDS = {
  Player: 1612938518,
  SeasonGame: 1607878349,
  SeasonInfo: 3123991521,
  Team: 637929298,
  TeamStats: 1731088851,
  Injury: 452971723,
  GameOLineStats: 2067273102,
  GameOffensiveStats: 3937354187,
  GameDefensiveStats: 698792022,
  UnpublishedGameStats: 1307057589,
};

export const PLAYER_RATING_FIELDS = [
  'OverallRating', 'SpeedRating', 'AccelerationRating', 'AgilityRating', 'StrengthRating', 'AwarenessRating',
  'CatchingRating', 'CatchInTrafficRating', 'SpectacularCatchRating', 'ReleaseRating', 'ShortRouteRunningRating',
  'MediumRouteRunningRating', 'DeepRouteRunningRating', 'CarryingRating', 'BreakTackleRating', 'TruckingRating',
  'JukeMoveRating', 'BCVisionRating', 'PassBlockRating', 'PassBlockPowerRating', 'PassBlockFinesseRating',
  'RunBlockRating', 'RunBlockPowerRating', 'RunBlockFinesseRating', 'ImpactBlockingRating', 'LeadBlockRating',
  'TackleRating', 'HitPowerRating', 'PursuitRating', 'PlayRecognitionRating', 'PowerMovesRating',
  'FinesseMovesRating', 'BlockSheddingRating', 'ManCoverageRating', 'ZoneCoverageRating', 'PressRating',
  'ThrowPowerRating', 'ThrowAccuracyRating', 'ThrowUnderPressureRating', 'InjuryRating', 'ToughnessRating',
  'StaminaRating', 'BreakSackRating', 'KickAccuracyRating', 'KickPowerRating',
];

// Companion-app style rating keys so the stats engine sees one shape.
const RATING_KEY_MAP = {
  OverallRating: 'ovr', SpeedRating: 'speed', AccelerationRating: 'accel', AgilityRating: 'agility', StrengthRating: 'strength',
  AwarenessRating: 'awareness', CatchingRating: 'catch', CatchInTrafficRating: 'cit', SpectacularCatchRating: 'specCatch',
  ReleaseRating: 'release', ShortRouteRunningRating: 'shortRoute', MediumRouteRunningRating: 'medRoute', DeepRouteRunningRating: 'deepRoute',
  CarryingRating: 'carry', BreakTackleRating: 'breakTackle', TruckingRating: 'truck', JukeMoveRating: 'juke', BCVisionRating: 'bcv',
  PassBlockRating: 'passBlock', PassBlockPowerRating: 'passBlockPower', PassBlockFinesseRating: 'passBlockFinesse',
  RunBlockRating: 'runBlock', RunBlockPowerRating: 'runBlockPower', RunBlockFinesseRating: 'runBlockFinesse',
  ImpactBlockingRating: 'impactBlock', LeadBlockRating: 'leadBlock', TackleRating: 'tackle', HitPowerRating: 'hitPower',
  PursuitRating: 'pursuit', PlayRecognitionRating: 'playRec', PowerMovesRating: 'powerMoves', FinesseMovesRating: 'finesseMoves',
  BlockSheddingRating: 'blockShed', ManCoverageRating: 'manCover', ZoneCoverageRating: 'zoneCover', PressRating: 'press',
  ThrowPowerRating: 'throwPower', ThrowAccuracyRating: 'throwAcc', ThrowUnderPressureRating: 'throwUnderPressure',
  InjuryRating: 'injury', ToughnessRating: 'toughness', StaminaRating: 'stamina', BreakSackRating: 'breakSack',
  KickAccuracyRating: 'kickAcc', KickPowerRating: 'kickPower',
};

const PLAYER_INFO_FIELDS = [
  'FirstName', 'LastName', 'Position', 'TeamIndex', 'ContractStatus', 'JerseyNum', 'Age', 'YearsPro', 'TraitDevelopment',
  'InjuryStatus', 'InjuryType', 'InjurySeverity', 'InjurySide', 'MinInjuryDuration', 'MaxInjuryDuration', 'TotalInjuryDuration',
  'IsInjuredReserve', 'LatestInjuryWeek', 'LatestInjuryStage', 'LatestInjuryYear', 'WasPreviouslyInjured',
  'CurrentYearSeasonEndingInjuryWeek', 'GameStats', 'SeasonStats', 'CareerStats', 'PLYR_PORTRAIT', 'PresentationId',
];

// Key plays the game logs for every game it plays or sims. Codes decoded from
// the saves themselves: each pair shares a quarter and clock.
export const KEY_PLAY = {
  4: 'intThrown', // QB threw an interception (secondary: the defender)
  7: 'tdPass', // QB threw a touchdown (secondary: the receiver)
  21: 'tdCatch', // receiver caught a touchdown (secondary: the QB)
  30: 'tdRun', // ball carrier ran it in
  56: 'fumbleRecovery', // defender came up with the ball
  59: 'sack', // defender sacked the QB (secondary: the QB)
  64: 'intMade', // defender intercepted (secondary: the QB)
  84: 'fieldGoal', // kicker made a field goal; yards is the distance
};

export const PLAYER_READ_FIELDS = [...PLAYER_INFO_FIELDS, ...PLAYER_RATING_FIELDS];

const ROSTER_STATUSES = new Set(['Signed', 'Drafted', 'Expiring', 'PracticeSquad', 'Extended', 'Restructured', 'RestrictedFreeAgents', 'FreeAgent']);
const PLAYED_STATUSES = new Set(['HomeWon', 'AwayWon', 'Tied', 'StatsReported']);

export async function loadFranchiseLibrary() {
  const mod = await import('madden-franchise');
  return mod.default || mod.FranchiseFile || mod;
}

export async function openFranchise(filePath, { schemaDirectory } = {}) {
  const Franchise = await loadFranchiseLibrary();
  const settings = { schemaDirectory: schemaDirectory || BUNDLED_SCHEMA_DIR, autoUnempty: false };
  return Franchise.create(filePath, settings);
}

// Field names a table can read. The offset table is only built once records
// are read, so fall back to the schema before that.
export function fieldNames(table) {
  if (table.offsetTable && table.offsetTable.length) return new Set(table.offsetTable.map((o) => o.name));
  const attrs = table.schema && table.schema.attributes ? table.schema.attributes : [];
  return new Set(attrs.map((a) => a.name));
}

export function readFields(table, wanted) {
  const available = fieldNames(table);
  if (!available.size) return table.readRecords(wanted);
  return table.readRecords(wanted.filter((f) => available.has(f)));
}

export function tableByUniqueIdOrName(franchise, uniqueId, name) {
  let t = null;
  try { t = franchise.getTableByUniqueId(uniqueId); } catch { t = null; }
  if (t && t.name === name) return t;
  const all = franchise.getAllTablesByName(name) || [];
  if (!all.length) return null;
  return all.reduce((best, cur) => (!best || cur.header.recordCapacity > best.header.recordCapacity ? cur : best), null);
}

function refOf(record, key) {
  try {
    const r = record.getReferenceDataByKey(key);
    if (!r || !r.tableId) return null;
    return r;
  } catch {
    return null;
  }
}

function stageOf(weekType) {
  if (weekType === 'PreSeason') return 'pre';
  if (weekType === 'RegularSeason') return 'reg';
  if (weekType === 'OffSeason') return 'off';
  return 'post';
}

export const WEEK_TYPE_LABEL = {
  PreSeason: 'Preseason',
  RegularSeason: 'Week',
  WildcardPlayoff: 'Wild Card',
  DivisionalPlayoff: 'Divisional Round',
  ConferencePlayoff: 'Conference Championship',
  SuperBowl: 'Super Bowl',
  ProBowl: 'Pro Bowl',
  PostSeason: 'Postseason',
  OffSeason: 'Offseason',
};

export function gameLabel(game) {
  if (game.weekType === 'RegularSeason' || game.weekType === 'PreSeason') return `${WEEK_TYPE_LABEL[game.weekType]} ${game.week + 1}`;
  return WEEK_TYPE_LABEL[game.weekType] || `Week ${game.week + 1}`;
}

class TableCache {
  constructor(franchise) {
    this.f = franchise;
    this.loaded = new Map();
  }
  async table(tableId) {
    if (this.loaded.has(tableId)) return this.loaded.get(tableId);
    const t = this.f.getTableById(tableId);
    if (!t) return null;
    if (!t.recordsRead) await t.readRecords();
    this.loaded.set(tableId, t);
    return t;
  }
  async record(ref) {
    if (!ref) return null;
    const t = await this.table(ref.tableId);
    if (!t) return null;
    const rec = t.records[ref.rowNumber];
    if (!rec || rec.isEmpty) return null;
    return { table: t, record: rec };
  }
  // Array tables hold references in fields named <Type>0..<Type>N.
  async arrayRefs(ref) {
    const hit = await this.record(ref);
    if (!hit) return [];
    const { record } = hit;
    const keys = Object.keys(record.fields);
    const n = Number.isFinite(record.arraySize) ? record.arraySize : keys.length;
    const out = [];
    for (let i = 0; i < Math.min(n, keys.length); i++) {
      const r = refOf(record, keys[i]);
      if (r) out.push(r);
    }
    return out;
  }
}

function numberOr(v, d = 0) {
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
}

function pickStat(record, keys) {
  const out = {};
  for (const k of keys) if (k in record.fields) out[k] = numberOr(record[k]);
  return out;
}

const OFF_KEYS = ['DOWNSPLAYED', 'GAMESSTARTED', 'PASSATTEMPTS', 'PASSCOMPLETED', 'PASSYARDS', 'PASSTDS', 'PASSINTS', 'PASSSACKED', 'PASSLONGEST',
  'RUSHATTEMPTS', 'RUSHYARDS', 'RUSHTDS', 'RUSHBROKENTACKLES', 'RUSHFUMBLES', 'RUSHLONGEST', 'RUSHYARDSAFTER1STHIT', 'RUSH20YARDRUNS',
  'RECEIVECATCHES', 'RECEIVEDROPS', 'RECEIVEYARDS', 'RECEIVETDS', 'RECEIVELONGEST', 'RECEIVEYARDSAFTER'];
const DEF_KEYS = ['DOWNSPLAYED', 'GAMESSTARTED', 'DEFTACKLES', 'ASSDEFTACKLES', 'DEFTACKLESFORLOSS', 'DLINESACKS', 'DLINEHALFSACK', 'BIGHITS', 'CTHALLOWED',
  'DEFPASSDEFLECTIONS', 'DLINEBLOCKS', 'DLINEFORCEDFUMBLES', 'DLINEFUMBLERECOVERIES', 'DSECINTS', 'DSECINTRETURNYARDS', 'DSECINTTDS', 'DLINESAFETIES'];
const OL_KEYS = ['DOWNSPLAYED', 'GAMESSTARTED', 'OLINEPANCAKES', 'OLINESACKSALLOWED', 'GAMERATING'];
const KICK_KEYS = ['DOWNSPLAYED', 'KICKFGATTEMPTS', 'KICKFGMADE', 'KICKEPATTEMPTS', 'KICKEPMADE', 'PUNTATTEMPTS', 'PUNTYARDS', 'PUNTIN20', 'KICKNUMKICKOFFS'];
const TEAM_KEYS = ['PENALTIES', 'PENALTYYARDS', 'SACKS', 'SACKSALLOWED', 'PASSATTEMPTS', 'RUSHATTEMPTS', 'OFFYARDS', 'OFFPASSYARDS', 'OFFRUSHYARDS', 'TOTALYARDS',
  'FIRSTDOWNS', 'THIRDDOWNS', 'THIRDDOWNCONV', 'FOURTHDOWNS', 'FOURTHDOWNCONV', 'PASSDEFLECTIONS', 'TACKLESFORLOSS', 'POSSESSIONTIME', 'GIVEAWAYS', 'TAKEAWAYS',
  'PASSTDS', 'RUSHTDS', 'PASSINTS', 'FUMBLESLOST', 'FORCEDFUMBLES', 'FUMBLEREC', 'DEFPASSYARDS', 'DEFRUSHYARDS', 'PASSESTIPPED', 'OFFREDZONES', 'OFFREDZONETDS'];

function categorize(tableName) {
  if (/OLine/.test(tableName)) return 'oline';
  if (/Offensive/.test(tableName)) return 'offense';
  if (/Defensive/.test(tableName)) return 'defense';
  if (/Kicking/.test(tableName)) return 'kicking';
  return 'other';
}

function statLine(category, record) {
  if (category === 'oline') return pickStat(record, OL_KEYS);
  if (category === 'offense') return pickStat(record, OFF_KEYS);
  if (category === 'defense') return pickStat(record, DEF_KEYS);
  if (category === 'kicking') return pickStat(record, KICK_KEYS);
  return { DOWNSPLAYED: numberOr(record.DOWNSPLAYED) };
}

// Main entry: turn an open franchise file into the league model used by the
// stats engine and the UI.
export async function readLeague(franchise, { leagueId, sourceName } = {}) {
  const cache = new TableCache(franchise);
  const warnings = [];

  // Season info
  const seasonInfoT = tableByUniqueIdOrName(franchise, TABLE_IDS.SeasonInfo, 'SeasonInfo');
  await seasonInfoT.readRecords();
  const si = seasonInfoT.records[0];
  const season = {
    calendarYear: numberOr(si.CurrentSeasonYear),
    year: numberOr(si.CurrentYear),
    week: numberOr(si.CurrentWeek),
    weekType: si.CurrentWeekType,
    stage: si.CurrentStage,
    regularSeasonWeeks: numberOr(si.NflseasonWeekCount, 18),
    preseasonWeeks: numberOr(si.PreseasonWeekCount, 3),
  };

  // Teams
  const teamT = tableByUniqueIdOrName(franchise, TABLE_IDS.Team, 'Team');
  await readFields(teamT, ['DisplayName', 'ShortName', 'LongName', 'NickName', 'TeamIndex', 'TEAM_TYPE', 'TEAM_LOGO', 'TEAM_RATINGOVR', 'TEAM_RATINGOL', 'TEAM_RATINGDL', 'TEAM_RATINGDEF', 'TEAM_RATINGOFF', 'IsUserManaged']);
  const teams = {};
  const teamRowToId = new Map();
  for (const r of teamT.records) {
    if (r.isEmpty) continue;
    if (r.TEAM_TYPE !== 'Current') continue;
    const teamId = `t${r.TeamIndex}`;
    teams[teamId] = {
      teamId,
      teamIndex: r.TeamIndex,
      abbr: r.ShortName,
      city: r.LongName,
      nick: r.DisplayName,
      displayName: `${r.LongName} ${r.DisplayName}`,
      overall: numberOr(r.TEAM_RATINGOVR),
      olRating: numberOr(r.TEAM_RATINGOL),
      dlRating: numberOr(r.TEAM_RATINGDL),
      userControlled: Boolean(r.IsUserManaged),
    };
    teamRowToId.set(r.index, teamId);
  }
  const teamIdForRef = (ref) => (ref && ref.tableId === teamT.header.tableId ? teamRowToId.get(ref.rowNumber) || null : null);

  // Players
  const playerT = tableByUniqueIdOrName(franchise, TABLE_IDS.Player, 'Player');
  await readFields(playerT, PLAYER_READ_FIELDS);
  const availableFields = fieldNames(playerT);
  const players = {};
  const playerRowToId = new Map();
  for (const r of playerT.records) {
    if (r.isEmpty) continue;
    if (!ROSTER_STATUSES.has(r.ContractStatus)) continue;
    const onTeam = r.TeamIndex >= 0 && r.TeamIndex < 32;
    if (!onTeam && r.ContractStatus !== 'FreeAgent') continue;
    const playerId = `p${r.index}`;
    const ratings = {};
    for (const f of PLAYER_RATING_FIELDS) if (availableFields.has(f)) ratings[RATING_KEY_MAP[f]] = numberOr(r[f]);
    players[playerId] = {
      playerId,
      rowIndex: r.index,
      teamId: onTeam ? `t${r.TeamIndex}` : null,
      firstName: r.FirstName,
      lastName: r.LastName,
      fullName: `${r.FirstName} ${r.LastName}`,
      position: r.Position,
      jerseyNum: numberOr(r.JerseyNum),
      age: numberOr(r.Age),
      yearsPro: numberOr(r.YearsPro),
      overall: numberOr(r.OverallRating),
      devTrait: r.TraitDevelopment,
      contractStatus: r.ContractStatus,
      ratings,
      injury: {
        status: r.InjuryStatus,
        type: r.InjuryType,
        severity: r.InjurySeverity,
        side: r.InjurySide,
        weeksMin: numberOr(r.MinInjuryDuration),
        weeksMax: numberOr(r.MaxInjuryDuration),
        weeksTotal: numberOr(r.TotalInjuryDuration),
        onIR: Boolean(r.IsInjuredReserve),
        week: numberOr(r.LatestInjuryWeek),
        stage: r.LatestInjuryStage,
        year: numberOr(r.LatestInjuryYear),
        wasPreviouslyInjured: Boolean(r.WasPreviouslyInjured),
      },
      career: null,
      _refs: { gameStats: refOf(r, 'GameStats'), seasonStats: refOf(r, 'SeasonStats'), careerStats: refOf(r, 'CareerStats') },
    };
    playerRowToId.set(r.index, playerId);
  }
  const playerIdForRef = (ref) => (ref && ref.tableId === playerT.header.tableId ? playerRowToId.get(ref.rowNumber) || null : null);

  // The key-play log names players by PresentationId. Map every player row,
  // including ones since cut or retired, so an old play still has a name.
  const byPresentation = new Map();
  if (availableFields.has('PresentationId')) {
    for (const r of playerT.records) {
      if (r.isEmpty || !r.PresentationId) continue;
      byPresentation.set(r.PresentationId, { playerId: playerRowToId.get(r.index) || null, name: `${r.FirstName} ${r.LastName}`, position: r.Position });
    }
  }

  // Career extras (pressures, targets, stops) when the file has them
  for (const p of Object.values(players)) {
    const hit = await cache.record(p._refs.careerStats).catch(() => null);
    if (!hit) continue;
    const rec = hit.record;
    const career = {};
    for (const k of ['DOWNSPLAYED', 'GAMESPLAYED', 'PRESSURES', 'TARGETS', 'ROUTESRUN', 'DEFPRESSURES', 'DEFTARGETS', 'STOPS', 'STUFFS', 'OLINEPANCAKES', 'OLINESACKSALLOWED', 'RECEIVECATCHES', 'RECEIVEDROPS', 'DEFTACKLES', 'DLINESACKS']) {
      if (k in rec.fields) career[k] = numberOr(rec[k]);
    }
    if (Object.keys(career).length) p.career = career;
  }

  // Schedule
  const gameT = tableByUniqueIdOrName(franchise, TABLE_IDS.SeasonGame, 'SeasonGame');
  await gameT.readRecords();
  const games = {};
  const gameRowToId = new Map();
  for (const r of gameT.records) {
    if (r.isEmpty) continue;
    const homeTeamId = teamIdForRef(refOf(r, 'HomeTeam'));
    const awayTeamId = teamIdForRef(refOf(r, 'AwayTeam'));
    if (!homeTeamId || !awayTeamId) continue; // Pro Bowl and placeholder rows
    if (r.SeasonWeekType === 'OffSeason' || r.SeasonWeekType === 'ProBowl') continue;
    const gameId = `g${r.index}`;
    const played = PLAYED_STATUSES.has(r.GameStatus);
    games[gameId] = {
      gameId,
      rowIndex: r.index,
      stage: stageOf(r.SeasonWeekType),
      weekType: r.SeasonWeekType,
      week: numberOr(r.SeasonWeek),
      seasonYear: numberOr(r.SeasonYear),
      homeTeamId,
      awayTeamId,
      homeScore: numberOr(r.HomeScore),
      awayScore: numberOr(r.AwayScore),
      status: played ? 'played' : 'unplayed',
      gameStatus: r.GameStatus,
      isSimmed: Boolean(r.IsSimmed),
      published: Boolean(r.HasBeenPublished),
      quarterLengthSec: (numberOr(r.QuarterLengthMins, 15) || 15) * 60,
      _refs: {
        scoring: refOf(r, 'ScoringSummaries'),
        playTracker: refOf(r, 'PlayTracker'),
        injuryCache: refOf(r, 'InjuryCache'),
        homeStats: refOf(r, 'HomePlayerStatCache'),
        awayStats: refOf(r, 'AwayPlayerStatCache'),
        homeTeamStats: refOf(r, 'HomeTeamStatCache'),
        awayTeamStats: refOf(r, 'AwayTeamStatCache'),
      },
    };
    games[gameId].label = gameLabel(games[gameId]);
    gameRowToId.set(r.index, gameId);
  }
  const gameIdForRef = (ref) => (ref && ref.tableId === gameT.header.tableId ? gameRowToId.get(ref.rowNumber) || null : null);

  // Per-game team stats, player stats, injuries and key plays
  const teamGameStats = {};
  const playerGameStats = {};
  const gameInjuries = {};
  const gamePlays = {};
  const seen = new Set();
  // The key-play log names teams by TeamIndex + 1.
  const teamForLogId = (id) => (Number.isFinite(id) && id > 0 && teams[`t${id - 1}`] ? `t${id - 1}` : null);
  const personFor = (presId) => {
    if (!presId) return null;
    const hit = byPresentation.get(presId);
    return hit ? { playerId: hit.playerId, name: hit.name, position: hit.position } : null;
  };

  const addPlayerLine = (gameId, playerId, category, line, teamId) => {
    const k = `${gameId}|${playerId}|${category}`;
    if (seen.has(k)) return;
    seen.add(k);
    playerGameStats[gameId] ||= {};
    playerGameStats[gameId][playerId] ||= { playerId, teamId: teamId || (players[playerId] ? players[playerId].teamId : null), snaps: 0, snapsRecorded: false };
    const entry = playerGameStats[gameId][playerId];
    if (teamId && !entry.teamId) entry.teamId = teamId;
    entry[category] = line;
    if (typeof line.DOWNSPLAYED === 'number') {
      entry.snaps = Math.max(entry.snaps, line.DOWNSPLAYED);
      entry.snapsRecorded = true;
    }
  };

  for (const g of Object.values(games)) {
    if (g.status !== 'played') continue;
    for (const sideKey of ['homeTeamStats', 'awayTeamStats']) {
      const hit = await cache.record(g._refs[sideKey]).catch(() => null);
      if (!hit) continue;
      const teamId = sideKey === 'homeTeamStats' ? g.homeTeamId : g.awayTeamId;
      teamGameStats[g.gameId] ||= {};
      teamGameStats[g.gameId][teamId] = pickStat(hit.record, TEAM_KEYS);
    }
    for (const sideKey of ['homeStats', 'awayStats']) {
      let refs = [];
      try { refs = await cache.arrayRefs(g._refs[sideKey]); } catch (e) { warnings.push(`stat cache ${g.gameId}: ${e.message}`); }
      for (const ref of refs) {
        const hit = await cache.record(ref).catch(() => null);
        if (!hit) continue;
        const playerId = playerIdForRef(refOf(hit.record, 'Player'));
        const statHit = await cache.record(refOf(hit.record, 'GameStats')).catch(() => null);
        if (!playerId || !statHit) continue;
        const category = categorize(statHit.table.name);
        addPlayerLine(g.gameId, playerId, category, statLine(category, statHit.record), sideKey === 'homeStats' ? g.homeTeamId : g.awayTeamId);
      }
    }
    // Key plays and the scoring timeline
    const plays = [];
    try {
      const tracker = await cache.record(g._refs.playTracker);
      const refs = tracker ? await cache.arrayRefs(refOf(tracker.record, 'TrackedPlayList')) : [];
      for (const ref of refs) {
        const hit = await cache.record(ref).catch(() => null);
        if (!hit) continue;
        const x = hit.record;
        const type = KEY_PLAY[x.SimPlayerStat] || null;
        if (!type) continue;
        // The ids describe possession after the play, so a turnover flips them.
        const offTeam = teamForLogId(x.OffensiveTeamId);
        const defTeam = teamForLogId(x.DefensiveTeamId);
        const primaryTeam = ['sack', 'intThrown'].includes(type) ? defTeam : offTeam;
        plays.push({
          quarter: numberOr(x.Quarter),
          clockSec: Math.max(0, Math.round(numberOr(x.Timestamp))),
          type,
          code: x.SimPlayerStat,
          teamId: primaryTeam,
          primary: personFor(x.PrimaryPlayerId),
          secondary: personFor(x.SecondaryPlayerId),
          count: numberOr(x.StatValue, 1),
          yards: Math.round(numberOr(x.ScoreYards)),
        });
      }
    } catch (e) {
      warnings.push(`key plays ${g.gameId}: ${e.message}`);
    }
    const scoring = [];
    try {
      const refs = await cache.arrayRefs(g._refs.scoring);
      for (const ref of refs) {
        const hit = await cache.record(ref).catch(() => null);
        if (!hit) continue;
        const x = hit.record;
        scoring.push({ quarter: numberOr(x.Quarter), clockSec: Math.max(0, numberOr(x.TimeStampInSec)), homeAfter: numberOr(x.HomeCurrentScore), awayAfter: numberOr(x.AwayCurrentScore) });
      }
    } catch (e) {
      warnings.push(`scoring ${g.gameId}: ${e.message}`);
    }
    if (plays.length || scoring.length) gamePlays[g.gameId] = { quarterLengthSec: g.quarterLengthSec, plays, scoring };

    // Injuries the game itself produced
    let injRefs = [];
    try { injRefs = await cache.arrayRefs(g._refs.injuryCache); } catch { injRefs = []; }
    for (const ref of injRefs) {
      const hit = await cache.record(ref).catch(() => null);
      if (!hit) continue;
      const playerId = playerIdForRef(refOf(hit.record, 'Player'));
      gameInjuries[g.gameId] ||= [];
      gameInjuries[g.gameId].push({
        playerId,
        type: hit.record.Type,
        severity: hit.record.Severity,
        weeksMin: numberOr(hit.record.MinDuration),
        weeksMax: numberOr(hit.record.MaxDuration),
        gameTeam: numberOr(hit.record.GameTeam),
        source: 'game',
      });
    }
  }

  // Published per-game stats hang off each player once the week closes.
  for (const p of Object.values(players)) {
    let refs = [];
    try { refs = await cache.arrayRefs(p._refs.gameStats); } catch { refs = []; }
    for (const ref of refs) {
      const hit = await cache.record(ref).catch(() => null);
      if (!hit) continue;
      const gameId = gameIdForRef(refOf(hit.record, 'SeasonGame'));
      if (!gameId) continue;
      const category = categorize(hit.table.name);
      addPlayerLine(gameId, p.playerId, category, statLine(category, hit.record));
    }
  }

  for (const p of Object.values(players)) delete p._refs;
  for (const g of Object.values(games)) delete g._refs;

  return {
    leagueId: leagueId || 'franchise-file',
    name: sourceName || 'Franchise file',
    source: 'franchise',
    season,
    teams,
    players,
    games,
    teamGameStats,
    playerGameStats,
    gameInjuries,
    gamePlays,
    warnings,
    capabilities: { snapsRecorded: true, pancakesRecorded: true, injuryTool: true, playByPlay: true },
  };
}
