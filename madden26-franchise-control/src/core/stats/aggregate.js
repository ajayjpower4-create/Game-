// Season totals and leaderboards built from per-game results.

const SUM = (rows, key) => rows.reduce((s, r) => s + (r[key] || 0), 0);

function accumulate(map, row, keys, extra) {
  const cur = map.get(row.playerId) || { playerId: row.playerId, name: row.name, position: row.position, teamId: extra.teamId, games: 0, ...Object.fromEntries(keys.map((k) => [k, 0])), sources: {} };
  cur.games += 1;
  for (const k of keys) cur[k] += row[k] || 0;
  if (row.source) for (const [k, v] of Object.entries(row.source)) cur.sources[k] = cur.sources[k] === undefined || cur.sources[k] === v ? v : 'mixed';
  map.set(row.playerId, cur);
  return cur;
}

export function seasonTotals(league, engine, tracker, { stage = 'reg', teamId = null, week = null } = {}) {
  const wk = week === '' || week == null ? null : Number(week);
  return engine.memo(`season|${engine.leagueKey(league, tracker)}|${stage}|${teamId || ''}|${wk ?? ''}`, () => computeTotals(league, engine, tracker, { stage, teamId, week: wk }));
}

function computeTotals(league, engine, tracker, { stage, teamId, week }) {
  const games = engine.playedGames(league, { stage: stage === 'all' ? null : stage, teamId, week });
  const blockers = new Map();
  const rushers = new Map();
  const snaps = new Map();
  const receivers = new Map();
  const tacklers = new Map();
  const penalties = new Map();
  const teamTotals = {};

  for (const g of games) {
    const result = engine.game(league, g.gameId, tracker);
    for (const [tid, t] of Object.entries(result.teams)) {
      if (teamId && tid !== teamId) continue;
      const tt = (teamTotals[tid] ||= { teamId: tid, games: 0, pressuresAllowed: 0, sacksAllowed: 0, pancakes: 0, pressures: 0, sacks: 0, missedSacks: 0, missedTackles: 0, drops: 0, targets: 0, penalties: 0, penaltyYards: 0, offPlays: 0, defPlays: 0 });
      tt.games += 1;
      tt.pressuresAllowed += t.blocking.summary.pressuresAllowed;
      tt.sacksAllowed += t.blocking.summary.sacksAllowed;
      tt.pancakes += t.blocking.summary.pancakes;
      tt.pressures += t.passRush.summary.pressures;
      tt.sacks += t.passRush.summary.sacks;
      tt.missedSacks += t.passRush.summary.missedSacks;
      tt.missedTackles += t.tackling.summary.missedTackles;
      tt.drops += t.receiving.summary.drops;
      tt.targets += t.receiving.summary.targets;
      tt.throwaways = (tt.throwaways || 0) + (t.receiving.summary.throwaways || 0);
      tt.penalties += t.penalties.summary.penalties;
      tt.penaltyYards += t.penalties.summary.yards;
      tt.offPlays += t.snaps.summary.offPlays;
      tt.defPlays += t.snaps.summary.defPlays;

      for (const b of t.blocking.blockers) {
        const cur = accumulate(blockers, b, ['snaps', 'passBlockSnaps', 'runBlockSnaps', 'pressuresAllowed', 'hurriesAllowed', 'hitsAllowed', 'sacksAllowed', 'nearSacksAllowed', 'cleanPassSnaps', 'pancakes', 'expectedPressures', 'runRepsLost', 'penalties'], { teamId: tid });
        cur._hold = (cur._hold || 0) + (b.avgTimeHeld || 0) * Math.max(1, b.passBlockSnaps);
        cur._holdW = (cur._holdW || 0) + Math.max(1, b.passBlockSnaps);
        // Grades are averaged by the snaps they cover, so a 70-snap start
        // counts for more than a 6-snap cameo.
        const w = Math.max(1, b.passBlockSnaps + b.runBlockSnaps);
        cur._grade = (cur._grade || 0) + b.blockGrade * w;
        cur._gradeW = (cur._gradeW || 0) + w;
        if (b.passGrade != null) { cur._pg = (cur._pg || 0) + b.passGrade * Math.max(1, b.passBlockSnaps); cur._pgW = (cur._pgW || 0) + Math.max(1, b.passBlockSnaps); }
        if (b.runGrade != null) { cur._rg = (cur._rg || 0) + b.runGrade * Math.max(1, b.runBlockSnaps); cur._rgW = (cur._rgW || 0) + Math.max(1, b.runBlockSnaps); }
        (cur.weekly ||= []).push({ gameId: g.gameId, stage: g.stage, week: g.week, label: g.label, grade: b.blockGrade, pressuresAllowed: b.pressuresAllowed, sacksAllowed: b.sacksAllowed });
      }
      for (const r of t.passRush.players) accumulate(rushers, r, ['snaps', 'passRushSnaps', 'pressures', 'hurries', 'hits', 'sacks', 'missedSacks', 'nearSacks'], { teamId: tid });
      for (const s of t.snaps.players) accumulate(snaps, s, ['offSnaps', 'defSnaps', 'stSnaps'], { teamId: tid });
      for (const r of t.receiving.players) accumulate(receivers, r, ['snaps', 'targets', 'catches', 'drops', 'yards', 'tds', 'yac', 'airYards'], { teamId: tid });
      for (const r of t.tackling.players) accumulate(tacklers, r, ['snaps', 'tackles', 'assists', 'tacklesForLoss', 'sacks', 'forcedFumbles', 'bigHits', 'missedTackles', 'missedRun', 'missedPass', 'tackleAttempts', 'catchesAllowed', 'deflections'], { teamId: tid });
      for (const r of t.penalties.players) {
        const cur = accumulate(penalties, r, ['penalties', 'yards'], { teamId: tid });
        cur.types ||= {};
        for (const ty of r.types) cur.types[ty.type] = (cur.types[ty.type] || 0) + 1;
      }
    }
  }

  const blockerRows = [...blockers.values()].map(({ _hold, _holdW, _grade, _gradeW, _pg, _pgW, _rg, _rgW, ...b }) => ({
    ...b,
    expectedPressures: Math.round(b.expectedPressures * 10) / 10,
    avgTimeHeld: _holdW ? Math.round((_hold / _holdW) * 100) / 100 : null,
    blockGrade: _gradeW ? Math.round(_grade / _gradeW) : null,
    passGrade: _pgW ? Math.round(_pg / _pgW) : null,
    runGrade: _rgW ? Math.round(_rg / _rgW) : null,
    passBlockEfficiency: b.passBlockSnaps ? Math.round((100 - ((b.sacksAllowed + b.hitsAllowed * 0.75 + b.hurriesAllowed * 0.75) / b.passBlockSnaps) * 100) * 100) / 100 : null,
    pressureRate: b.passBlockSnaps ? Math.round((b.pressuresAllowed / b.passBlockSnaps) * 1000) / 10 : 0,
    runBlockWinRate: b.runBlockSnaps ? Math.round((1 - b.runRepsLost / b.runBlockSnaps) * 1000) / 10 : null,
    pancakeRate: b.runBlockSnaps ? Math.round((b.pancakes / b.runBlockSnaps) * 1000) / 10 : 0,
    weekly: (b.weekly || []).sort((x, y) => ({ pre: 0, reg: 1, post: 2 }[x.stage] ?? 3) - ({ pre: 0, reg: 1, post: 2 }[y.stage] ?? 3) || x.week - y.week),
  }));
  const rusherRows = [...rushers.values()].map((r) => ({ ...r, winRate: r.passRushSnaps ? Math.round((r.pressures / r.passRushSnaps) * 1000) / 10 : 0 }));
  const snapRows = [...snaps.values()].map((s) => {
    const tt = teamTotals[s.teamId] || {};
    const plays = s.offSnaps ? tt.offPlays : tt.defPlays;
    return { ...s, total: s.offSnaps + s.defSnaps + s.stSnaps, snapPct: plays ? Math.round(((s.offSnaps + s.defSnaps) / plays) * 1000) / 10 : 0 };
  });
  const receiverRows = [...receivers.values()].map((r) => ({ ...r, catchRate: r.targets ? Math.round((r.catches / r.targets) * 1000) / 10 : 0, dropRate: r.catches + r.drops ? Math.round((r.drops / (r.catches + r.drops)) * 1000) / 10 : 0, yardsPerTarget: r.targets ? Math.round((r.yards / r.targets) * 10) / 10 : 0 }));
  const tacklerRows = [...tacklers.values()].map((r) => ({ ...r, missRate: r.tackleAttempts ? Math.round((r.missedTackles / r.tackleAttempts) * 1000) / 10 : 0 }));
  const penaltyRows = [...penalties.values()];

  const minSnaps = week == null ? 20 : 8;
  const top = (rows, key, n = 10, filter = () => true) => rows.filter(filter).slice().sort((a, b) => (b[key] || 0) - (a[key] || 0)).slice(0, n);
  const bottom = (rows, key, n = 10, filter = () => true) => rows.filter(filter).slice().sort((a, b) => (a[key] || 0) - (b[key] || 0)).slice(0, n);

  return {
    stage,
    teamId,
    week,
    games: games.length,
    teams: teamTotals,
    blocking: { players: blockerRows.sort((a, b) => (b.blockGrade || 0) - (a.blockGrade || 0)) },
    passRush: { players: rusherRows.sort((a, b) => b.pressures - a.pressures) },
    snaps: { players: snapRows.sort((a, b) => b.total - a.total) },
    receiving: { players: receiverRows.sort((a, b) => b.targets - a.targets) },
    tackling: { players: tacklerRows.sort((a, b) => b.missedTackles - a.missedTackles) },
    penalties: { players: penaltyRows.sort((a, b) => b.penalties - a.penalties || b.yards - a.yards) },
    leaders: {
      bestBlockers: top(blockerRows, 'blockGrade', 10, (b) => b.passBlockSnaps >= minSnaps),
      worstBlockers: bottom(blockerRows, 'blockGrade', 10, (b) => b.passBlockSnaps >= minSnaps),
      bestRunBlockers: top(blockerRows, 'runGrade', 10, (b) => b.runBlockSnaps >= minSnaps * 0.75),
      mostPressuresAllowed: top(blockerRows, 'pressuresAllowed'),
      mostSacksAllowed: top(blockerRows, 'sacksAllowed'),
      mostPancakes: top(blockerRows, 'pancakes'),
      longestHold: top(blockerRows, 'avgTimeHeld', 10, (b) => b.passBlockSnaps >= minSnaps),
      mostPressures: top(rusherRows, 'pressures'),
      mostSacks: top(rusherRows, 'sacks'),
      mostMissedSacks: top(rusherRows, 'missedSacks'),
      mostSnaps: top(snapRows, 'total'),
      mostTargets: top(receiverRows, 'targets'),
      mostDrops: top(receiverRows, 'drops'),
      worstDropRate: top(receiverRows, 'dropRate', 10, (r) => r.targets >= 10),
      mostMissedTackles: top(tacklerRows, 'missedTackles'),
      worstMissRate: top(tacklerRows, 'missRate', 10, (r) => r.tackleAttempts >= 10),
      surestTacklers: bottom(tacklerRows, 'missRate', 10, (r) => r.tackleAttempts >= 15),
      mostPenalties: top(penaltyRows, 'penalties'),
      mostPenaltyYards: top(penaltyRows, 'yards'),
    },
  };
}

const STAGE_RANK = { pre: 0, reg: 1, post: 2 };
const weekKey = (g) => `${g.stage}:${g.week}`;

// Blocking, week by week, for one team: every blocker's grade, pressures and
// sacks allowed in each game, next to his season line.
export function blockingByWeek(league, engine, tracker, { stage = 'reg', teamId }) {
  return engine.memo(`bweek|${engine.leagueKey(league, tracker)}|${stage}|${teamId}`, () => {
    const games = engine.playedGames(league, { stage: stage === 'all' ? null : stage, teamId })
      .sort((a, b) => (STAGE_RANK[a.stage] ?? 3) - (STAGE_RANK[b.stage] ?? 3) || a.week - b.week);
    const weeks = games.map((g) => {
      const opp = g.homeTeamId === teamId ? g.awayTeamId : g.homeTeamId;
      const t = engine.game(league, g.gameId, tracker).teams[teamId];
      const s = t ? t.blocking.summary : null;
      return {
        key: weekKey(g),
        gameId: g.gameId,
        stage: g.stage,
        week: g.week,
        label: g.label,
        opponent: (league.teams[opp] || {}).abbr || '?',
        home: g.homeTeamId === teamId,
        team: s ? { dropbacks: s.dropbacks, pressuresAllowed: s.pressuresAllowed, sacksAllowed: s.sacksAllowed, pressureRate: s.pressureRate, expectedPressures: s.expectedPressures, pancakes: s.pancakes, runBlockWinRate: s.runBlockWinRate, yardsBeforeContact: s.yardsBeforeContact, bestBlocker: s.bestBlocker, mostBeaten: s.mostBeaten } : null,
      };
    });
    const totals = seasonTotals(league, engine, tracker, { stage, teamId });
    const players = totals.blocking.players
      .filter((b) => b.teamId === teamId && b.passBlockSnaps + b.runBlockSnaps >= 5)
      .map((b) => ({
        playerId: b.playerId,
        name: b.name,
        position: b.position,
        games: b.games,
        season: { blockGrade: b.blockGrade, passGrade: b.passGrade, runGrade: b.runGrade, pressuresAllowed: b.pressuresAllowed, sacksAllowed: b.sacksAllowed, pancakes: b.pancakes, pressureRate: b.pressureRate },
        weeks: Object.fromEntries(b.weekly.map((w) => [`${w.stage}:${w.week}`, w])),
        trend: trendOf(b.weekly),
      }));
    return { stage, teamId, weeks, players };
  });
}

// Up, down or steady over the last three games compared with the ones before.
function trendOf(weekly) {
  if (weekly.length < 4) return null;
  const recent = weekly.slice(-3);
  const before = weekly.slice(0, -3);
  const avg = (xs) => xs.reduce((s, x) => s + x.grade, 0) / xs.length;
  const d = Math.round(avg(recent) - avg(before));
  return { delta: d, direction: d >= 4 ? 'up' : d <= -4 ? 'down' : 'steady' };
}

// Everything the tool knows about one player, game by game.
export function playerLog(league, engine, tracker, playerId) {
  return engine.memo(`plog|${engine.leagueKey(league, tracker)}|${playerId}`, () => {
    const games = engine.playedGames(league, {})
      .sort((a, b) => (STAGE_RANK[a.stage] ?? 3) - (STAGE_RANK[b.stage] ?? 3) || a.week - b.week);
    const rows = [];
    for (const g of games) {
      const res = engine.game(league, g.gameId, tracker);
      for (const [tid, t] of Object.entries(res.teams)) {
        const find = (list) => (list || []).find((x) => x.playerId === playerId) || null;
        const snaps = find(t.snaps.players);
        const blocking = find(t.blocking.blockers);
        const passRush = find(t.passRush.players);
        const receiving = find(t.receiving.players);
        const tackling = find(t.tackling.players);
        const penalties = find(t.penalties.players);
        if (!snaps && !blocking && !passRush && !receiving && !tackling && !penalties) continue;
        if (snaps && !(snaps.offSnaps + snaps.defSnaps + snaps.stSnaps) && !blocking && !passRush && !receiving && !tackling && !penalties) continue;
        const opp = g.homeTeamId === tid ? g.awayTeamId : g.homeTeamId;
        const mine = g.homeTeamId === tid ? g.homeScore : g.awayScore;
        const theirs = g.homeTeamId === tid ? g.awayScore : g.homeScore;
        rows.push({
          gameId: g.gameId,
          stage: g.stage,
          week: g.week,
          label: g.label,
          teamId: tid,
          opponent: (league.teams[opp] || {}).abbr || '?',
          home: g.homeTeamId === tid,
          result: `${mine > theirs ? 'W' : mine < theirs ? 'L' : 'T'} ${mine}-${theirs}`,
          snaps, blocking, passRush, receiving, tackling, penalties,
        });
        break;
      }
    }
    return rows;
  });
}
