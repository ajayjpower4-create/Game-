// The Control Center's own tracking layer.
//
// Madden stores a thin set of numbers. This module takes the per-game lines
// the app records — every player's snaps, pancakes, sacks allowed, catches,
// drops, tackles, plus the team's own per-game line — and derives the things
// Madden never writes down: pass-protection load, pressure rate, blown-block
// share, broken tackles the defense gave up, penalty load per game.
//
// Two rules hold everywhere in here:
//   1. A number that came out of the file is EXACT and labelled that way.
//   2. A number this module computes is TRACKED, and its formula is written on
//      the row so nobody has to guess where it came from.

export const EXACT = 'exact';
export const TRACKED = 'tracked';

const r1 = (n) => Math.round(n * 10) / 10;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const sum = (arr, fn) => arr.reduce((a, x) => a + (fn(x) || 0), 0);

/* --------------------------------------------------------------- one game */

/**
 * Everything the tracker knows about one team in one game.
 *
 * @param lines      that team's per-player lines for the game
 * @param teamStat   that team's own line for the game (penalties, sacks…)
 * @param oppLines   the opponent's per-player lines, which is where the
 *                   broken tackles against this defense come from
 */
export function trackGame({ lines = [], teamStat = null, oppLines = [] }) {
  const blocking = lines.filter((l) => l.kind === 'blocking');
  const offense = lines.filter((l) => l.kind === 'offense');
  const defense = lines.filter((l) => l.kind === 'defense');

  // How much passing the offense actually did: attempts plus the times the QB
  // went down. Both are in the file.
  const passAtt = sum(offense, (l) => l.passAtt);
  const sacksTaken = sum(offense, (l) => l.passSacked) || (teamStat ? teamStat.SACKSALLOWED : 0);
  const dropbacks = passAtt + sacksTaken;
  const rushAtt = sum(offense, (l) => l.rushAtt) || (teamStat ? teamStat.RUSHATTEMPTS : 0);
  const offSnaps = Math.max(1, dropbacks + rushAtt);
  const maxSnaps = Math.max(1, ...blocking.map((l) => l.snaps), ...offense.map((l) => l.snaps));

  /* ---- blocking ---- */
  const blockRows = blocking.map((l) => {
    const share = clamp(l.snaps / maxSnaps, 0, 1);
    const passReps = Math.round(dropbacks * share);
    const runReps = Math.round(rushAtt * share);
    const reps = Math.max(1, passReps + runReps);

    // Pressure rate: how often a pass rep ended with his quarterback on the
    // ground. Sacks allowed and pass reps are both real, so this ratio is too.
    const sackRate = passReps ? l.sacksAllowed / passReps : 0;
    const pancakeRate = runReps ? l.pancakes / runReps : 0;

    // Pass-protection score, the tracker's own number: a clean game starts at
    // 88 and has to be earned upward, charged for every sack he gave up
    // against his share of the dropbacks, credited for pancakes, nudged by
    // Madden's own grade for the game.
    // The pancake credit is capped: on a run-light game the rate can spike on
    // three carries and would otherwise drown out the protection it is meant
    // to season.
    const score = clamp(
      88 - sackRate * 100 * 3.5 + Math.min(10, pancakeRate * 100 * 0.25) + (l.grade - 70) * 0.25,
      0, 99,
    );

    return {
      playerId: l.playerId, name: l.name, pos: l.pos, team: l.team, gameRow: l.gameRow,
      snaps: l.snaps, grade: l.grade,
      pancakes: l.pancakes, sacksAllowed: l.sacksAllowed,          // exact
      passReps, runReps, reps,                                      // tracked
      sackRate: r1(sackRate * 100),
      pancakeRate: r1(pancakeRate * 100),
      score: Math.round(score),
      formula: 'score = 88 − (sacks allowed ÷ pass reps) × 350 + pancake credit (capped at 10) + (game grade − 70) ÷ 4',
    };
  });

  /* ---- receiving ---- */
  const catchRows = offense
    .filter((l) => l.catches || l.drops)
    .map((l) => {
      const thrownAt = l.catches + l.drops;      // the floor on targets: both exact
      return {
        playerId: l.playerId, name: l.name, pos: l.pos, team: l.team, gameRow: l.gameRow,
        snaps: l.snaps, catches: l.catches, drops: l.drops, yards: l.recYards, yac: l.yac, tds: l.recTds,
        thrownAt,
        dropRate: thrownAt ? r1((l.drops / thrownAt) * 100) : 0,
        yardsPerCatch: l.catches ? r1(l.recYards / l.catches) : 0,
        targetShare: dropbacks ? r1((thrownAt / dropbacks) * 100) : 0,
        formula: 'thrown at = catches + drops (Madden does not store targets); drop % = drops ÷ thrown at',
      };
    });

  /* ---- defense ---- */
  // Broken tackles the opponent's ball carriers racked up are exactly the
  // tackles this defense missed. The team total is real; splitting it across
  // defenders is the tracker's own weighting, by how much each man was on the
  // field and how often he was in on a tackle.
  const brokenAgainst = sum(oppLines.filter((l) => l.kind === 'offense'), (l) => l.brokenTackles);
  const weightOf = (l) => (l.tackles + l.assists) * 2 + l.snaps / 10;
  const weightTotal = Math.max(1, sum(defense, weightOf));

  const defRows = defense.map((l) => {
    const combined = l.tackles + l.assists;
    const missedShare = brokenAgainst * (weightOf(l) / weightTotal);
    const attempts = combined + missedShare;
    return {
      playerId: l.playerId, name: l.name, pos: l.pos, team: l.team, gameRow: l.gameRow,
      snaps: l.snaps, grade: l.grade,
      tackles: l.tackles, assists: l.assists, combined, tfl: l.tfl, sacks: l.sacks,
      pbu: l.pbu, ints: l.ints, bigHits: l.bigHits, catchesAllowed: l.catchesAllowed,   // exact
      missedTackles: r1(missedShare),                                                    // tracked
      missRate: attempts ? r1((missedShare / attempts) * 100) : 0,
      tacklesPerSnap: l.snaps ? r1((combined / l.snaps) * 100) : 0,
      formula: `team gave up ${brokenAgainst} broken tackles; split by (tackles × 2 + snaps ÷ 10)`,
    };
  });

  /* ---- team ---- */
  // Named teamLine, not team: callers tag their rows with a team id and a
  // stray `team` key here would quietly clobber it.
  const teamLine = teamStat ? {
    penalties: teamStat.PENALTIES || 0,
    penaltyYards: teamStat.PENALTYYARDS || 0,
    sacks: teamStat.SACKS || 0,
    sacksAllowed: teamStat.SACKSALLOWED || 0,
    yards: teamStat.OFFYARDS || 0,
    thirdDownConv: teamStat.THIRDDOWNCONV || 0,
    thirdDowns: teamStat.THIRDDOWNS || 0,
    giveaways: teamStat.GIVEAWAYS || 0,
    takeaways: teamStat.TAKEAWAYS || 0,
    brokenTacklesAllowed: brokenAgainst,
    penaltyYardsPerFlag: teamStat.PENALTIES ? r1(teamStat.PENALTYYARDS / teamStat.PENALTIES) : 0,
    flagsPerSnap: r1((teamStat.PENALTIES || 0) / offSnaps * 100),
  } : null;

  return {
    dropbacks, rushAtt, offSnaps, sacksTaken,
    blocking: blockRows, receiving: catchRows, defense: defRows, teamLine,
  };
}

/* ------------------------------------------------------------ many games */

/** Roll a set of tracked games up per player, keeping exact and tracked apart. */
export function accumulate(games, category) {
  const out = new Map();
  for (const g of games) {
    for (const row of g[category] || []) {
      if (!out.has(row.playerId)) {
        out.set(row.playerId, { playerId: row.playerId, name: row.name, pos: row.pos, team: row.team, games: 0, rows: [] });
      }
      const acc = out.get(row.playerId);
      acc.games++;
      acc.rows.push(row);
      for (const [key, value] of Object.entries(row)) {
        if (typeof value !== 'number' || key === 'gameRow') continue;
        acc[key] = (acc[key] || 0) + value;
      }
    }
  }
  // Rates have to be recomputed off the totals, not averaged.
  for (const acc of out.values()) {
    if (category === 'blocking') {
      acc.sackRate = acc.passReps ? r1((acc.sacksAllowed / acc.passReps) * 100) : 0;
      acc.pancakeRate = acc.runReps ? r1((acc.pancakes / acc.runReps) * 100) : 0;
      acc.score = Math.round(acc.rows.reduce((a, r) => a + r.score, 0) / acc.rows.length);
      acc.grade = Math.round(acc.grade / acc.games);
    }
    if (category === 'receiving') {
      acc.dropRate = acc.thrownAt ? r1((acc.drops / acc.thrownAt) * 100) : 0;
      acc.yardsPerCatch = acc.catches ? r1(acc.yards / acc.catches) : 0;
    }
    if (category === 'defense') {
      acc.missedTackles = r1(acc.missedTackles);
      const attempts = acc.combined + acc.missedTackles;
      acc.missRate = attempts ? r1((acc.missedTackles / attempts) * 100) : 0;
      acc.grade = Math.round(acc.grade / acc.games);
    }
  }
  return [...out.values()];
}

/**
 * Merge freshly read game lines into whatever the tracker already held. A game
 * is identified by its SeasonGame row, so re-reading the same save twice does
 * not double anything, and a game that has since aged out of the file stays in
 * the history.
 */
export function mergeHistory(history, incoming) {
  const byKey = new Map((history || []).map((g) => [g.key, g]));
  for (const game of incoming) {
    byKey.set(game.key, { ...(byKey.get(game.key) || {}), ...game });
  }
  return [...byKey.values()].sort((a, b) => (a.week - b.week) || String(a.key).localeCompare(String(b.key)));
}

/** Group raw lines into per-game, per-team buckets the tracker can chew on. */
export function bucketLines(lines) {
  const games = new Map();
  for (const line of lines) {
    const key = `${line.gameRow ?? 'x'}`;
    if (!games.has(key)) games.set(key, new Map());
    const teams = games.get(key);
    if (!teams.has(line.team)) teams.set(line.team, []);
    teams.get(line.team).push(line);
  }
  return games;
}
