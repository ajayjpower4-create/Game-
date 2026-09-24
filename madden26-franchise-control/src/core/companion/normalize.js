// Turns the JSON the Madden Companion App POSTs (its "Export" feature pulls
// your franchise from the EA cloud and sends it to a URL you give it) into the
// same league model the franchise-file reader produces.
//
// Export URL shapes, exactly as the app sends them:
//   POST {base}/{platform}/{leagueId}/leagueteams                      leagueTeamInfoList
//   POST {base}/{platform}/{leagueId}/standings                        teamStandingInfoList
//   POST {base}/{platform}/{leagueId}/week/{stage}/{week}/schedules    gameScheduleInfoList
//   POST {base}/{platform}/{leagueId}/week/{stage}/{week}/passing      playerPassingStatInfoList
//   POST {base}/{platform}/{leagueId}/week/{stage}/{week}/rushing      playerRushingStatInfoList
//   POST {base}/{platform}/{leagueId}/week/{stage}/{week}/receiving    playerReceivingStatInfoList
//   POST {base}/{platform}/{leagueId}/week/{stage}/{week}/defense      playerDefensiveStatInfoList
//   POST {base}/{platform}/{leagueId}/week/{stage}/{week}/kicking      playerKickingStatInfoList
//   POST {base}/{platform}/{leagueId}/week/{stage}/{week}/punting      playerPuntingStatInfoList
//   POST {base}/{platform}/{leagueId}/week/{stage}/{week}/teamstats    teamStatInfoList
//   POST {base}/{platform}/{leagueId}/team/{teamId}/roster             rosterInfoList
//   POST {base}/{platform}/{leagueId}/freeagents/roster                rosterInfoList

const LIST_KEYS = {
  leagueteams: ['leagueTeamInfoList'],
  standings: ['teamStandingInfoList'],
  schedules: ['gameScheduleInfoList'],
  passing: ['playerPassingStatInfoList'],
  rushing: ['playerRushingStatInfoList'],
  receiving: ['playerReceivingStatInfoList'],
  defense: ['playerDefensiveStatInfoList'],
  kicking: ['playerKickingStatInfoList'],
  punting: ['playerPuntingStatInfoList'],
  teamstats: ['teamStatInfoList'],
  roster: ['rosterInfoList'],
};

export const WEEKLY_KINDS = ['schedules', 'passing', 'rushing', 'receiving', 'defense', 'kicking', 'punting', 'teamstats'];

// Work out what an export request is from its URL path (after the base URL).
export function classifyPath(segments) {
  const s = segments.filter(Boolean);
  if (s.length < 3) return null;
  const [platform, leagueId, ...rest] = s;
  if (rest[0] === 'leagueteams') return { platform, leagueId, kind: 'leagueteams' };
  if (rest[0] === 'standings') return { platform, leagueId, kind: 'standings' };
  if (rest[0] === 'week' && rest.length >= 4) {
    const kind = rest[3];
    if (!WEEKLY_KINDS.includes(kind)) return null;
    return { platform, leagueId, kind, stage: rest[1], week: Number(rest[2]) };
  }
  if (rest[0] === 'team' && rest[2] === 'roster') return { platform, leagueId, kind: 'roster', teamId: rest[1] };
  if (rest[0] === 'freeagents' && rest[1] === 'roster') return { platform, leagueId, kind: 'roster', teamId: 'freeagents' };
  return null;
}

export function extractList(kind, body) {
  if (!body || typeof body !== 'object') return [];
  for (const k of LIST_KEYS[kind] || []) if (Array.isArray(body[k])) return body[k];
  // Be forgiving: take the first array in the payload.
  for (const v of Object.values(body)) if (Array.isArray(v)) return v;
  return [];
}

const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);

export function stageIndexToStage(stageIndex) {
  return n(stageIndex) === 0 ? 'pre' : 'reg';
}

export function weekTypeFor(stageIndex, weekIndex) {
  if (n(stageIndex) === 0) return 'PreSeason';
  const w = n(weekIndex);
  if (w === 18) return 'WildcardPlayoff';
  if (w === 19) return 'DivisionalPlayoff';
  if (w === 20) return 'ConferencePlayoff';
  if (w === 22) return 'SuperBowl';
  if (w === 21) return 'ProBowl';
  return 'RegularSeason';
}

// Companion rating names -> the tool's rating keys
const RATINGS = {
  playerBestOvr: 'ovr', speedRating: 'speed', accelRating: 'accel', agilityRating: 'agility', strengthRating: 'strength', awareRating: 'awareness',
  catchRating: 'catch', cITRating: 'cit', specCatchRating: 'specCatch', releaseRating: 'release', shortRouteRunRating: 'shortRoute',
  mediumRouteRunRating: 'medRoute', deepRouteRunRating: 'deepRoute', carryRating: 'carry', breakTackleRating: 'breakTackle', truckRating: 'truck',
  jukeMoveRating: 'juke', bCVRating: 'bcv', passBlockRating: 'passBlock', passBlockPowerRating: 'passBlockPower', passBlockFinesseRating: 'passBlockFinesse',
  runBlockRating: 'runBlock', runBlockPowerRating: 'runBlockPower', runBlockFinesseRating: 'runBlockFinesse', impactBlockRating: 'impactBlock',
  leadBlockRating: 'leadBlock', tackleRating: 'tackle', hitPowerRating: 'hitPower', pursuitRating: 'pursuit', playRecRating: 'playRec',
  powerMovesRating: 'powerMoves', finesseMovesRating: 'finesseMoves', blockShedRating: 'blockShed', manCoverRating: 'manCover', zoneCoverRating: 'zoneCover',
  pressRating: 'press', throwPowerRating: 'throwPower', throwAccRating: 'throwAcc', throwUnderPressureRating: 'throwUnderPressure',
  injuryRating: 'injury', toughRating: 'toughness', staminaRating: 'stamina', breakSackRating: 'breakSack',
  kickAccRating: 'kickAcc', kickPowerRating: 'kickPower',
};

export function normalizeRosterPlayer(p) {
  const ratings = {};
  for (const [k, v] of Object.entries(RATINGS)) if (k in p) ratings[v] = n(p[k]);
  const rosterId = p.rosterId != null ? String(p.rosterId) : `${p.firstName}-${p.lastName}-${p.position}`;
  return {
    playerId: `r${rosterId}`,
    rosterId,
    teamId: p.isFreeAgent || !p.teamId ? null : `c${p.teamId}`,
    firstName: p.firstName || '',
    lastName: p.lastName || '',
    fullName: `${p.firstName || ''} ${p.lastName || ''}`.trim(),
    position: p.position,
    jerseyNum: n(p.jerseyNum),
    age: n(p.age),
    yearsPro: n(p.yearsPro),
    overall: n(p.playerBestOvr),
    devTrait: p.devTrait,
    contractStatus: p.isFreeAgent ? 'FreeAgent' : p.isOnPracticeSquad ? 'PracticeSquad' : 'Signed',
    ratings,
    injury: {
      status: n(p.injuryLength) > 0 || p.isOnIR ? 'Injured' : 'Uninjured',
      type: p.injuryType,
      weeksTotal: n(p.injuryLength),
      onIR: Boolean(p.isOnIR),
    },
    portraitId: p.portraitId,
    career: null,
  };
}

// Canonical per-game stat line keys match the franchise-file field names so
// the stats engine only deals with one shape.
export function normalizeStatRow(kind, row) {
  const key = { scheduleId: String(row.scheduleId), rosterId: row.rosterId != null ? String(row.rosterId) : null, teamId: row.teamId != null ? String(row.teamId) : null, fullName: row.fullName };
  switch (kind) {
    case 'passing':
      return { ...key, category: 'offense', line: { PASSATTEMPTS: n(row.passAtt), PASSCOMPLETED: n(row.passComp), PASSYARDS: n(row.passYds), PASSTDS: n(row.passTDs), PASSINTS: n(row.passInts), PASSSACKED: n(row.passSacks), PASSLONGEST: n(row.passLongest) } };
    case 'rushing':
      return { ...key, category: 'offense', line: { RUSHATTEMPTS: n(row.rushAtt), RUSHYARDS: n(row.rushYds), RUSHTDS: n(row.rushTDs), RUSHBROKENTACKLES: n(row.rushBrokenTackles), RUSHFUMBLES: n(row.rushFum), RUSHLONGEST: n(row.rushLongest), RUSHYARDSAFTER1STHIT: n(row.rushYdsAfterContact), RUSH20YARDRUNS: n(row.rush20PlusYds) } };
    case 'receiving':
      return { ...key, category: 'offense', line: { RECEIVECATCHES: n(row.recCatches), RECEIVEDROPS: n(row.recDrops), RECEIVEYARDS: n(row.recYds), RECEIVETDS: n(row.recTDs), RECEIVELONGEST: n(row.recLongest), RECEIVEYARDSAFTER: n(row.recYdsAfterCatch != null ? row.recYdsAfterCatch : row.recYacYds), RECCATCHPCT: n(row.recCatchPct) } };
    case 'defense':
      return { ...key, category: 'defense', line: { DEFTACKLES: n(row.defTotalTackles), DLINESACKS: n(row.defSacks), DSECINTS: n(row.defInts), DEFPASSDEFLECTIONS: n(row.defDeflections), DLINEFORCEDFUMBLES: n(row.defForcedFum), DLINEFUMBLERECOVERIES: n(row.defFumRec), CTHALLOWED: n(row.defCatchAllowed), DLINESAFETIES: n(row.defSafeties), DSECINTRETURNYARDS: n(row.defIntReturnYds), DEFTDS: n(row.defTDs) } };
    case 'kicking':
      return { ...key, category: 'kicking', line: { KICKFGATTEMPTS: n(row.fGAtt), KICKFGMADE: n(row.fGMade), KICKEPATTEMPTS: n(row.xpAtt), KICKEPMADE: n(row.xpMade), KICKNUMKICKOFFS: n(row.kickoffAtt), KICKFGLONGEST: n(row.fGLongest) } };
    case 'punting':
      return { ...key, category: 'kicking', line: { PUNTATTEMPTS: n(row.puntAtt), PUNTYARDS: n(row.puntYds), PUNTIN20: n(row.puntsIn20), PUNTNETYARDS: n(row.puntNetYds), PUNTLONGEST: n(row.puntLongest) } };
    default:
      return null;
  }
}

export function normalizeTeamStatRow(row) {
  return {
    scheduleId: String(row.scheduleId),
    teamId: String(row.teamId),
    line: {
      PENALTIES: n(row.penalties),
      PENALTYYARDS: n(row.penaltyYds),
      SACKS: n(row.defSacks),
      SACKSALLOWED: n(row.offSacks),
      OFFYARDS: n(row.offTotalYds),
      OFFPASSYARDS: n(row.offPassYds),
      OFFRUSHYARDS: n(row.offRushYds),
      TOTALYARDS: n(row.offTotalYds),
      FIRSTDOWNS: n(row.off1stDowns),
      THIRDDOWNS: n(row.off3rdDownAtt),
      THIRDDOWNCONV: n(row.off3rdDownConv),
      FOURTHDOWNS: n(row.off4thDownAtt),
      FOURTHDOWNCONV: n(row.off4thDownConv),
      PASSTDS: n(row.offPassTDs),
      RUSHTDS: n(row.offRushTDs),
      PASSINTS: n(row.offIntsLost),
      FUMBLESLOST: n(row.offFumLost),
      FORCEDFUMBLES: n(row.defForcedFum),
      FUMBLEREC: n(row.defFumRec),
      DEFPASSYARDS: n(row.defPassYds),
      DEFRUSHYARDS: n(row.defRushYds),
      GIVEAWAYS: n(row.tOGiveaways),
      TAKEAWAYS: n(row.tOTakeaways),
      OFFREDZONES: n(row.offRedZones),
      OFFREDZONETDS: n(row.offRedZoneTDs),
    },
  };
}

export function normalizeSchedule(row) {
  const stageIndex = n(row.stageIndex);
  const weekIndex = n(row.weekIndex);
  const status = n(row.status);
  const hasScore = n(row.homeScore) > 0 || n(row.awayScore) > 0;
  return {
    gameId: `s${row.scheduleId}`,
    scheduleId: String(row.scheduleId),
    stage: stageIndexToStage(stageIndex),
    weekType: weekTypeFor(stageIndex, weekIndex),
    week: weekIndex,
    seasonYear: n(row.seasonIndex),
    homeTeamId: `c${row.homeTeamId}`,
    awayTeamId: `c${row.awayTeamId}`,
    homeScore: n(row.homeScore),
    awayScore: n(row.awayScore),
    status: status !== 1 && (status >= 2 || hasScore) ? 'played' : 'unplayed',
    gameStatus: status,
    isGameOfTheWeek: Boolean(row.isGameOfTheWeek),
  };
}

export function normalizeTeam(t) {
  return {
    teamId: `c${t.teamId}`,
    companionTeamId: String(t.teamId),
    abbr: t.abbrName,
    city: t.cityName,
    nick: t.nickName || t.displayName,
    displayName: `${t.cityName || ''} ${t.displayName || t.nickName || ''}`.trim(),
    division: t.divName,
    logoId: t.logoId,
    overall: n(t.ovrRating),
    userName: t.userName || null,
    userControlled: Boolean(t.userName),
    injuryCount: n(t.injuryCount),
  };
}
