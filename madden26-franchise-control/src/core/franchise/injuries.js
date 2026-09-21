// Plans and applies an injury to a player inside a Madden 26 franchise file.
//
// Madden tracks injuries on the Player record: InjuryStatus, InjuryType,
// InjurySeverity, InjurySide, Min/Max/TotalInjuryDuration, the week it
// happened, and the IR flag. This module fills those fields exactly the way the
// game does when its own injury engine hurts somebody, and picks the play in
// the game where the injury "happened" for the tool's injury report.

import { getInjuryType, severityFor, describeDuration } from './injury-catalog.js';
import { makeRng } from '../rng.js';

const PLAY_TYPES_OFFENSE = ['inside run', 'outside zone', 'play-action pass', 'quick slant', 'deep shot', 'screen pass', 'QB scramble', 'draw play', 'RPO', 'goal-line run'];
const PLAY_TYPES_DEFENSE = ['run stop', 'pass rush', 'zone coverage', 'man coverage', 'blitz', 'tackle in space', 'goal-line stand', 'open-field tackle'];
const PLAY_TYPES_SPECIAL = ['kickoff coverage', 'punt return', 'field goal block', 'kickoff return'];

export function isOffensePosition(pos) {
  return ['QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT'].includes(pos);
}

// Picks the random play in the game where the injury happens. Deterministic
// for a given league/game/player so the report never changes after the fact.
export function pickInjuryPlay({ leagueId, gameId, playerId, position, salt = '' }) {
  const rng = makeRng('injury-play', leagueId, gameId, playerId, salt);
  const quarter = rng.weighted([
    { item: 1, weight: 22 },
    { item: 2, weight: 28 },
    { item: 3, weight: 26 },
    { item: 4, weight: 24 },
  ]);
  const secondsLeft = rng.int(0, 899);
  const mm = Math.floor(secondsLeft / 60);
  const ss = secondsLeft % 60;
  const playNumber = rng.int(1, 140);
  const pool = isOffensePosition(position) ? PLAY_TYPES_OFFENSE : ['K', 'P', 'LS'].includes(position) ? PLAY_TYPES_SPECIAL : PLAY_TYPES_DEFENSE;
  const playType = rng.pick(pool);
  const down = rng.int(1, 4);
  const distance = down === 1 ? 10 : rng.int(1, 12);
  const yardLine = rng.int(1, 49);
  const ownSide = rng.next() < 0.5;
  return {
    quarter,
    clock: `${mm}:${String(ss).padStart(2, '0')}`,
    playNumber,
    playType,
    down,
    distance,
    fieldPosition: `${ownSide ? 'own' : 'opp'} ${yardLine}`,
  };
}

// Build the full change set for an injury without touching the file.
export function planInjury({
  leagueId,
  gameId,
  player, // { playerId, firstName, lastName, position }
  injuryKey,
  weeks, // optional override
  side, // 'Left' | 'Right' | 'NA' | undefined
  week, // franchise week the game is in (0-based SeasonWeek)
  stage, // 'PreSeason' | 'NFLSeason' | 'OffSeason'
  year, // SeasonInfo.CurrentYear
  placeOnIR = false,
  salt = '',
}) {
  const type = getInjuryType(injuryKey);
  if (!type) throw new Error(`Unknown injury type: ${injuryKey}`);
  const rng = makeRng('injury-duration', leagueId, gameId, player.playerId, injuryKey, salt);
  const duration = Number.isFinite(weeks) ? Math.max(0, Math.min(63, Math.round(weeks))) : rng.int(type.weeks.min, type.weeks.max);
  const seasonEnding = Boolean(type.seasonEnding) || duration >= 18;
  const chosenSide = type.sided ? (side === 'Left' || side === 'Right' ? side : rng.pick(['Left', 'Right'])) : 'NA';
  const severity = severityFor(duration, { seasonEnding });
  const play = pickInjuryPlay({ leagueId, gameId, playerId: player.playerId, position: player.position, salt });
  // The game lets a player push to come back a little early; keep one week of
  // slack for anything longer than a couple of weeks.
  const minDuration = duration > 2 ? duration - 1 : duration;
  return {
    player: { playerId: player.playerId, name: `${player.firstName} ${player.lastName}`, position: player.position },
    injury: {
      key: type.key,
      name: type.name,
      part: type.part,
      side: chosenSide,
      severity,
      weeks: duration,
      seasonEnding,
      label: describeDuration(duration, seasonEnding),
    },
    play,
    fields: {
      InjuryStatus: 'Injured',
      InjuryType: type.key,
      InjurySeverity: severity,
      InjurySide: chosenSide,
      MinInjuryDuration: minDuration,
      MaxInjuryDuration: duration,
      TotalInjuryDuration: duration,
      WasPreviouslyInjured: true,
      LatestInjuryWeek: Number.isFinite(week) ? week : 0,
      LatestInjuryStage: stage || 'NFLSeason',
      LatestInjuryYear: Number.isFinite(year) ? year : 0,
      IsInjuredReserve: Boolean(placeOnIR && duration >= 4),
      ...(seasonEnding && Number.isFinite(week) ? { CurrentYearSeasonEndingInjuryWeek: week } : {}),
    },
  };
}

// Writes the planned fields onto a madden-franchise Player record. Returns the
// values that were actually written (the library validates enum names).
export function applyPlanToRecord(record, plan) {
  const written = {};
  for (const [key, value] of Object.entries(plan.fields)) {
    if (!(key in record.fields)) continue; // older schema without this field
    record[key] = value;
    written[key] = record[key];
  }
  return written;
}

// Heal a player completely.
export function healFields() {
  return {
    InjuryStatus: 'Uninjured',
    InjuryType: 'Invalid_',
    InjurySeverity: 'Max_',
    InjurySide: 'NA',
    MinInjuryDuration: 0,
    MaxInjuryDuration: 0,
    TotalInjuryDuration: 0,
    IsInjuredReserve: false,
  };
}
