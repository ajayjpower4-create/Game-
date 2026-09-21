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

export function seasonTotals(league, engine, tracker, { stage = 'reg', teamId = null } = {}) {
  const games = engine.playedGames(league, { stage: stage === 'all' ? null : stage, teamId });
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
      tt.penalties += t.penalties.summary.penalties;
      tt.penaltyYards += t.penalties.summary.yards;
      tt.offPlays += t.snaps.summary.offPlays;
      tt.defPlays += t.snaps.summary.defPlays;

      for (const b of t.blocking.blockers) {
        const cur = accumulate(blockers, b, ['snaps', 'passBlockSnaps', 'runBlockSnaps', 'pressuresAllowed', 'hurriesAllowed', 'hitsAllowed', 'sacksAllowed', 'nearSacksAllowed', 'cleanPassSnaps', 'pancakes'], { teamId: tid });
        cur._hold = (cur._hold || 0) + b.avgTimeHeld * Math.max(1, b.passBlockSnaps);
        cur._holdW = (cur._holdW || 0) + Math.max(1, b.passBlockSnaps);
        cur._grade = (cur._grade || 0) + b.blockGrade;
      }
      for (const r of t.passRush.players) accumulate(rushers, r, ['snaps', 'passRushSnaps', 'pressures', 'hurries', 'hits', 'sacks', 'missedSacks', 'nearSacks'], { teamId: tid });
      for (const s of t.snaps.players) accumulate(snaps, s, ['offSnaps', 'defSnaps', 'stSnaps'], { teamId: tid });
      for (const r of t.receiving.players) accumulate(receivers, r, ['snaps', 'targets', 'catches', 'drops', 'yards', 'tds', 'yac'], { teamId: tid });
      for (const r of t.tackling.players) accumulate(tacklers, r, ['snaps', 'tackles', 'assists', 'tacklesForLoss', 'sacks', 'forcedFumbles', 'bigHits', 'missedTackles', 'tackleAttempts', 'catchesAllowed', 'deflections'], { teamId: tid });
      for (const r of t.penalties.players) {
        const cur = accumulate(penalties, r, ['penalties', 'yards'], { teamId: tid });
        cur.types ||= {};
        for (const ty of r.types) cur.types[ty.type] = (cur.types[ty.type] || 0) + 1;
      }
    }
  }

  const blockerRows = [...blockers.values()].map((b) => ({
    ...b,
    avgTimeHeld: b._holdW ? Math.round((b._hold / b._holdW) * 100) / 100 : null,
    blockGrade: b.games ? Math.round(b._grade / b.games) : null,
    passBlockEfficiency: b.passBlockSnaps ? Math.round((100 - ((b.sacksAllowed + b.hitsAllowed * 0.75 + b.hurriesAllowed * 0.75) / b.passBlockSnaps) * 100) * 100) / 100 : null,
    pancakeRate: b.runBlockSnaps ? Math.round((b.pancakes / b.runBlockSnaps) * 1000) / 10 : 0,
    _hold: undefined, _holdW: undefined, _grade: undefined,
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

  const top = (rows, key, n = 10, filter = () => true) => rows.filter(filter).slice().sort((a, b) => (b[key] || 0) - (a[key] || 0)).slice(0, n);
  const bottom = (rows, key, n = 10, filter = () => true) => rows.filter(filter).slice().sort((a, b) => (a[key] || 0) - (b[key] || 0)).slice(0, n);

  return {
    stage,
    teamId,
    games: games.length,
    teams: teamTotals,
    blocking: { players: blockerRows.sort((a, b) => (b.blockGrade || 0) - (a.blockGrade || 0)) },
    passRush: { players: rusherRows.sort((a, b) => b.pressures - a.pressures) },
    snaps: { players: snapRows.sort((a, b) => b.total - a.total) },
    receiving: { players: receiverRows.sort((a, b) => b.targets - a.targets) },
    tackling: { players: tacklerRows.sort((a, b) => b.missedTackles - a.missedTackles) },
    penalties: { players: penaltyRows.sort((a, b) => b.penalties - a.penalties || b.yards - a.yards) },
    leaders: {
      bestBlockers: top(blockerRows, 'blockGrade', 10, (b) => b.passBlockSnaps >= 20),
      mostPressuresAllowed: top(blockerRows, 'pressuresAllowed'),
      mostSacksAllowed: top(blockerRows, 'sacksAllowed'),
      mostPancakes: top(blockerRows, 'pancakes'),
      longestHold: top(blockerRows, 'avgTimeHeld', 10, (b) => b.passBlockSnaps >= 20),
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
