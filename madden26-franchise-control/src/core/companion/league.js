// Builds the league model from everything the Companion App has exported for
// one league. The raw export lists are kept in the store; this turns them into
// teams / players / games / stats the way reader.js does for a file.

import { normalizeRosterPlayer, normalizeStatRow, normalizeTeamStatRow, normalizeSchedule, normalizeTeam } from './normalize.js';
import { gameLabel } from '../franchise/reader.js';

export function buildLeagueFromCompanion(raw, { leagueKey, name } = {}) {
  const teams = {};
  for (const t of raw.leagueteams || []) {
    const team = normalizeTeam(t);
    teams[team.teamId] = team;
  }
  for (const s of raw.standings || []) {
    const id = `c${s.teamId}`;
    if (!teams[id]) continue;
    teams[id].record = { wins: s.totalWins || 0, losses: s.totalLosses || 0, ties: s.totalTies || 0, seed: s.seed, rank: s.rank };
    if (s.capSpent != null || s.capAvailable != null) teams[id]._capRaw = { total: s.capRoom, spent: s.capSpent, room: s.capAvailable };
    if (s.divisionName) teams[id].division = s.divisionName;
    if (s.conferenceName) teams[id].conference = s.conferenceName;
  }

  const players = {};
  for (const list of Object.values(raw.rosters || {})) {
    for (const p of list) {
      const player = normalizeRosterPlayer(p);
      players[player.playerId] = player;
    }
  }

  applyCompanionMoney(teams, players);

  const games = {};
  for (const list of Object.values(raw.schedules || {})) {
    for (const row of list) {
      const g = normalizeSchedule(row);
      if (!teams[g.homeTeamId] || !teams[g.awayTeamId]) continue;
      g.label = gameLabel(g);
      games[g.gameId] = g;
    }
  }
  const gameIdBySchedule = new Map(Object.values(games).map((g) => [g.scheduleId, g.gameId]));

  const teamGameStats = {};
  for (const list of Object.values(raw.teamstats || {})) {
    for (const row of list) {
      const t = normalizeTeamStatRow(row);
      const gameId = gameIdBySchedule.get(t.scheduleId);
      if (!gameId) continue;
      teamGameStats[gameId] ||= {};
      teamGameStats[gameId][`c${t.teamId}`] = t.line;
    }
  }

  const playerGameStats = {};
  const byRoster = new Map(Object.values(players).map((p) => [p.rosterId, p]));
  for (const kind of ['passing', 'rushing', 'receiving', 'defense', 'kicking', 'punting']) {
    for (const list of Object.values(raw[kind] || {})) {
      for (const row of list) {
        const s = normalizeStatRow(kind, row);
        if (!s) continue;
        const gameId = gameIdBySchedule.get(s.scheduleId);
        if (!gameId) continue;
        let player = s.rosterId ? byRoster.get(s.rosterId) : null;
        if (!player && s.fullName) {
          // Player left the league since; keep the line under a synthetic id.
          const pid = `n${s.fullName.replace(/\s+/g, '_')}`;
          player = players[pid] || (players[pid] = { playerId: pid, rosterId: null, teamId: s.teamId ? `c${s.teamId}` : null, fullName: s.fullName, firstName: s.fullName.split(' ')[0], lastName: s.fullName.split(' ').slice(1).join(' '), position: kind === 'defense' ? 'MLB' : kind === 'passing' ? 'QB' : kind === 'rushing' ? 'HB' : kind === 'receiving' ? 'WR' : 'K', ratings: {}, injury: { status: 'Uninjured' }, overall: 0 });
        }
        if (!player) continue;
        playerGameStats[gameId] ||= {};
        const entry = (playerGameStats[gameId][player.playerId] ||= { playerId: player.playerId, snaps: 0, snapsRecorded: false, teamId: s.teamId ? `c${s.teamId}` : player.teamId });
        entry[s.category] = { ...(entry[s.category] || {}), ...s.line };
      }
    }
  }

  // The companion export has no team pass/rush attempts; add them up from the
  // player lines so the blocking and snap models have a play count.
  for (const [gameId, perPlayer] of Object.entries(playerGameStats)) {
    const totals = {};
    for (const entry of Object.values(perPlayer)) {
      const teamId = entry.teamId || (players[entry.playerId] && players[entry.playerId].teamId);
      if (!teamId) continue;
      const t = (totals[teamId] ||= { PASSATTEMPTS: 0, RUSHATTEMPTS: 0, PASSCOMPLETED: 0, PASSSACKED: 0 });
      const o = entry.offense || {};
      t.PASSATTEMPTS += o.PASSATTEMPTS || 0;
      t.PASSCOMPLETED += o.PASSCOMPLETED || 0;
      t.RUSHATTEMPTS += o.RUSHATTEMPTS || 0;
      t.PASSSACKED += o.PASSSACKED || 0;
    }
    teamGameStats[gameId] ||= {};
    for (const [teamId, t] of Object.entries(totals)) {
      const line = (teamGameStats[gameId][teamId] ||= {});
      if (!line.PASSATTEMPTS) line.PASSATTEMPTS = t.PASSATTEMPTS;
      if (!line.RUSHATTEMPTS) line.RUSHATTEMPTS = t.RUSHATTEMPTS;
      if (!line.PASSCOMPLETED) line.PASSCOMPLETED = t.PASSCOMPLETED;
      if (!line.SACKSALLOWED) line.SACKSALLOWED = t.PASSSACKED;
    }
  }

  // Season position from the latest week that has a schedule
  const played = Object.values(games).filter((g) => g.status === 'played');
  const latest = played.sort((a, b) => (a.stage === b.stage ? b.week - a.week : a.stage === 'reg' ? -1 : 1))[0];
  const season = {
    calendarYear: null,
    year: latest ? latest.seasonYear : 0,
    week: latest ? latest.week : 0,
    weekType: latest ? latest.weekType : 'PreSeason',
    stage: latest && latest.stage === 'pre' ? 'PreSeason' : 'NFLSeason',
    regularSeasonWeeks: 18,
    preseasonWeeks: 3,
  };

  return {
    leagueId: leagueKey,
    name: name || leagueKey,
    source: 'companion',
    season,
    teams,
    players,
    games,
    teamGameStats,
    playerGameStats,
    gameInjuries: {},
    warnings: [],
    salaryCap: companionSalaryCap(teams),
    news: null,
    capabilities: { snapsRecorded: false, pancakesRecorded: false, injuryTool: false, contracts: Object.values(players).some((p) => p.contract), news: false },
    exportInfo: raw.meta || null,
  };
}

// The export's money fields have come in whole dollars, but guard against a
// feed in thousands or in Madden's own $10,000 units: a top cap hit is tens
// of millions of dollars, a team cap hundreds of millions.
export function moneyScale(values, { team = false } = {}) {
  const max = Math.max(0, ...values.filter((v) => Number.isFinite(v)).map(Math.abs));
  if (!max) return 1;
  if (team) return max >= 1e7 ? 1 : max >= 1e5 ? 1000 : 10000;
  return max >= 1e6 ? 1 : max >= 15000 ? 1000 : 10000;
}

function applyCompanionMoney(teams, players) {
  const raws = Object.values(players).map((p) => p._contractRaw).filter(Boolean);
  const k = moneyScale(raws.flatMap((c) => [c.capHit, c.salary]));
  for (const p of Object.values(players)) {
    const c = p._contractRaw;
    delete p._contractRaw;
    if (!c || p.contractStatus === 'FreeAgent') { p.contract = c ? { status: p.contractStatus, length: 0, yearsLeft: 0, capHit: 0, salary: 0, years: [] } : null; continue; }
    p.contract = {
      status: p.contractStatus,
      length: c.length,
      yearsLeft: c.yearsLeft,
      yearIndex: Math.max(0, c.length - c.yearsLeft),
      capHit: c.capHit * k,
      salary: c.salary * k,
      signingBonus: c.bonus * k,
      releaseSavings: c.releaseSavings == null ? null : c.releaseSavings * k,
      releasePenalty: c.releasePenalty == null ? null : c.releasePenalty * k,
      years: [],
      total: null,
      remaining: null,
      remainingBonus: null,
    };
  }
  const caps = Object.values(teams).map((t) => t._capRaw).filter(Boolean);
  const tk = moneyScale(caps.flatMap((c) => [c.total, c.spent, c.room]), { team: true });
  for (const t of Object.values(teams)) {
    const c = t._capRaw;
    delete t._capRaw;
    if (!c) continue;
    // capRoom is the team's whole cap when spent + available add up to it.
    const total = n0(c.total) * tk;
    const spent = n0(c.spent) * tk;
    const room = c.room != null ? n0(c.room) * tk : total - spent;
    const isTotal = total > 0 && Math.abs(total - (spent + room)) <= 0.01 * total;
    t.cap = { teamCap: isTotal ? total : spent + room, spent, room, deadThisYear: null, deadNextYear: null, nextYearRoom: null, rollover: null };
  }
}

function companionSalaryCap(teams) {
  const caps = Object.values(teams).map((t) => t.cap && t.cap.teamCap).filter((v) => v > 0).sort((a, b) => a - b);
  if (caps.length < 8) return null;
  // Every team's cap is the league cap plus its own rollover, so teams with
  // nothing rolled over share the league's number. Take it only when several do.
  const count = new Map();
  for (const v of caps) count.set(v, (count.get(v) || 0) + 1);
  const [cap, agree] = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  return agree >= 3 ? { cap, rule: 'from the exported team caps', teamsAgreeing: agree } : null;
}

function n0(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}
