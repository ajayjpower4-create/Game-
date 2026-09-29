// Real plays from a box score.
//
// A Companion App / EA export has no play-by-play, but it does record each
// player's longest play, and that is enough to rebuild several real plays
// exactly:
//   - a quarterback's longest completion is the same play as one teammate's
//     longest catch when exactly one teammate's longest catch matches it;
//   - a catch or run was a touchdown when it is logically forced (every catch
//     he made was a touchdown, or his only carry scored);
//   - a defender's touchdown with an interception and no fumble recovery was
//     a pick-six, and one interception gives its return yards;
//   - a kicker's longest field goal, and a lone field goal, are exact.
// Nothing here guesses: when the stats allow more than one reading, the
// sentence says only what is certain.
//
// It also itemizes each team's points (touchdowns, field goals, extra points,
// safeties) and checks them against the final score.

const sumBy = (rows, f) => rows.reduce((s, r) => s + (f(r) || 0), 0);

export function exportPlays(league, gameId) {
  const game = league.games[gameId];
  if (!game || game.status !== 'played') return { plays: [], scoring: null };
  const lines = Object.values(league.playerGameStats[gameId] || {});
  const teamOfLine = (e) => e.teamId || (league.players[e.playerId] || {}).teamId || null;
  const name = (pid) => (league.players[pid] ? league.players[pid].fullName : 'Unknown player');
  const plays = [];
  const covered = new Set(); // playerId|rush|yards, playerId|rec|yards

  for (const teamId of [game.homeTeamId, game.awayTeamId]) {
    const mine = lines.filter((e) => teamOfLine(e) === teamId);
    const off = (e) => e.offense || {};
    // ---- the longest completion, matched to the man who caught it
    const passers = mine.filter((e) => (off(e).PASSLONGEST || 0) > 0);
    for (const qb of passers) {
      const L = off(qb).PASSLONGEST;
      const catchers = mine.filter((e) => e.playerId !== qb.playerId && (off(e).RECEIVELONGEST || 0) === L);
      // Only certain when no other passer could have thrown an L-yard ball.
      const alone = !passers.some((x) => x !== qb && (off(x).PASSLONGEST || 0) >= L);
      if (catchers.length === 1 && alone) {
        const r = catchers[0];
        const ro = off(r);
        const qo = off(qb);
        // A touchdown only when forced: every catch he made scored, or every
        // completion the passer threw scored.
        const td = (ro.RECEIVECATCHES > 0 && ro.RECEIVETDS >= ro.RECEIVECATCHES) || (qo.PASSCOMPLETED > 0 && qo.PASSTDS >= qo.PASSCOMPLETED);
        covered.add(`${r.playerId}|rec|${L}`);
        plays.push({ type: td ? 'Touchdown pass' : 'Long completion', teamId, playerIds: [qb.playerId, r.playerId], yards: L, touchdown: td, exact: true, text: `${name(qb.playerId)} to ${name(r.playerId)}${td ? ` for ${L} yards and a touchdown` : ` for ${L} yards`}, his longest completion of the day.` });
      } else if (L >= 30) {
        plays.push({ type: 'Long completion', teamId, playerIds: [qb.playerId], yards: L, touchdown: false, exact: true, text: `${name(qb.playerId)}'s longest completion goes for ${L} yards.` });
        for (const r of catchers) covered.add(`${r.playerId}|rec|${L}`);
      }
    }
    // ---- touchdowns that are forced by the numbers
    for (const e of mine) {
      const o = off(e);
      if (o.RECEIVECATCHES > 0 && o.RECEIVETDS >= o.RECEIVECATCHES && !covered.has(`${e.playerId}|rec|${o.RECEIVELONGEST}`)) {
        covered.add(`${e.playerId}|rec|${o.RECEIVELONGEST}`);
        plays.push({ type: 'Touchdown catch', teamId, playerIds: [e.playerId], yards: o.RECEIVELONGEST, touchdown: true, exact: true, text: o.RECEIVECATCHES === 1 ? `${name(e.playerId)}'s only catch is a ${o.RECEIVEYARDS}-yard touchdown.` : `Every one of ${name(e.playerId)}'s ${o.RECEIVECATCHES} catches is a touchdown, the longest from ${o.RECEIVELONGEST} yards.` });
      }
      if (o.RUSHATTEMPTS > 0 && o.RUSHTDS >= o.RUSHATTEMPTS) {
        covered.add(`${e.playerId}|rush|${o.RUSHLONGEST}`);
        plays.push({ type: 'Touchdown run', teamId, playerIds: [e.playerId], yards: o.RUSHLONGEST, touchdown: true, exact: true, text: o.RUSHATTEMPTS === 1 ? `${name(e.playerId)}'s only carry is a ${o.RUSHYARDS}-yard touchdown run.` : `${name(e.playerId)} scores on all ${o.RUSHATTEMPTS} of his carries.` });
      } else if ((o.RUSHLONGEST || 0) >= 25) {
        covered.add(`${e.playerId}|rush|${o.RUSHLONGEST}`);
        plays.push({ type: 'Long run', teamId, playerIds: [e.playerId], yards: o.RUSHLONGEST, touchdown: false, exact: true, text: `${name(e.playerId)} breaks off a ${o.RUSHLONGEST}-yard run.` });
      }
    }
    // ---- defense
    for (const e of mine) {
      const d = e.defense || {};
      const tds = (d.DEFTDS || 0) || (d.DSECINTTDS || 0);
      if (tds > 0) {
        const pick = (d.DSECINTS || 0) > 0 && !(d.DLINEFUMBLERECOVERIES > 0);
        const fumble = (d.DLINEFUMBLERECOVERIES || 0) > 0 && !(d.DSECINTS > 0);
        const yards = pick && d.DSECINTS === 1 && d.DSECINTRETURNYARDS ? ` ${d.DSECINTRETURNYARDS} yards` : '';
        plays.push({ type: pick ? 'Pick-six' : fumble ? 'Fumble return touchdown' : 'Defensive touchdown', teamId, playerIds: [e.playerId], yards: pick && d.DSECINTS === 1 ? d.DSECINTRETURNYARDS : null, touchdown: true, exact: true, text: pick ? `${name(e.playerId)} intercepts it and takes it back${yards} for a touchdown.` : fumble ? `${name(e.playerId)} scoops up a fumble and scores.` : `${name(e.playerId)} scores on defense.` });
      } else if ((d.DSECINTS || 0) === 1 && (d.DSECINTRETURNYARDS || 0) >= 30) {
        plays.push({ type: 'Interception return', teamId, playerIds: [e.playerId], yards: d.DSECINTRETURNYARDS, touchdown: false, exact: true, text: `${name(e.playerId)} picks it off and returns it ${d.DSECINTRETURNYARDS} yards.` });
      }
      if ((d.DLINESAFETIES || 0) > 0) plays.push({ type: 'Safety', teamId, playerIds: [e.playerId], yards: null, touchdown: false, exact: true, text: `${name(e.playerId)} records a safety.` });
    }
    // ---- kick and punt returns (franchise files record them)
    for (const e of mine) {
      const r = e.returns || {};
      for (const [k, label] of [['K', 'kickoff'], ['P', 'punt']]) {
        const td = r[`${k}RETTDS`] || 0;
        const att = r[`${k}RETATTEMPTS`] || 0;
        const long = r[`${k}RETLONGEST`] || 0;
        if (td > 0) plays.push({ type: `${label === 'kickoff' ? 'Kick' : 'Punt'} return touchdown`, teamId, playerIds: [e.playerId], yards: td === 1 && att >= 1 ? long : null, touchdown: true, exact: td === 1, text: `${name(e.playerId)} takes a ${label} back${td === 1 ? ` ${long} yards` : ''} for a touchdown${td > 1 ? ` (${td} of them)` : ''}.` });
        else if (long >= 40) plays.push({ type: `Long ${label} return`, teamId, playerIds: [e.playerId], yards: long, touchdown: false, exact: true, text: `${name(e.playerId)} returns a ${label} ${long} yards.` });
      }
    }
    // ---- kicking
    for (const e of mine) {
      const k = e.kicking || {};
      if ((k.KICKFGMADE || 0) === 1 && (k.KICKFGLONGEST || 0) > 0) plays.push({ type: 'Field goal', teamId, playerIds: [e.playerId], yards: k.KICKFGLONGEST, touchdown: false, exact: true, text: `${name(e.playerId)} makes his only field goal, from ${k.KICKFGLONGEST} yards.` });
      else if ((k.KICKFGMADE || 0) > 1 && (k.KICKFGLONGEST || 0) >= 45) plays.push({ type: 'Long field goal', teamId, playerIds: [e.playerId], yards: k.KICKFGLONGEST, touchdown: false, exact: true, text: `${name(e.playerId)} goes ${k.KICKFGMADE} for ${k.KICKFGATTEMPTS}, the longest from ${k.KICKFGLONGEST} yards.` });
    }
  }
  return { plays, covered, scoring: scoringBreakdown(league, gameId) };
}

// How each team got its points, from the recorded stats, checked against the
// final score.
export function scoringBreakdown(league, gameId) {
  const game = league.games[gameId];
  if (!game || game.status !== 'played') return null;
  const lines = Object.values(league.playerGameStats[gameId] || {});
  const teamOfLine = (e) => e.teamId || (league.players[e.playerId] || {}).teamId || null;
  const out = {};
  for (const teamId of [game.homeTeamId, game.awayTeamId]) {
    const mine = lines.filter((e) => teamOfLine(e) === teamId);
    const t = (league.teamGameStats[gameId] || {})[teamId] || {};
    const off = (f) => sumBy(mine, (e) => (e.offense || {})[f]);
    const def = (f) => sumBy(mine, (e) => (e.defense || {})[f]);
    const kick = (f) => sumBy(mine, (e) => (e.kicking || {})[f]);
    const passTD = t.PASSTDS || off('PASSTDS');
    const rushTD = t.RUSHTDS || off('RUSHTDS');
    const defTD = def('DEFTDS') || def('DSECINTTDS');
    const ret = (f) => sumBy(mine, (e) => (e.returns || {})[f]);
    const retTD = ret('KRETTDS') + ret('PRETTDS');
    const fg = kick('KICKFGMADE');
    const fgAtt = kick('KICKFGATTEMPTS');
    const xp = kick('KICKEPMADE');
    const xpAtt = kick('KICKEPATTEMPTS');
    const safeties = def('DLINESAFETIES');
    const final = teamId === game.homeTeamId ? game.homeScore : game.awayScore;
    const tds = passTD + rushTD + defTD + retTD;
    const counted = tds * 6 + fg * 3 + xp + safeties * 2;
    const rest = final - counted;
    // Two-point conversions fill the gap in steps of two, one per touchdown
    // that did not get an extra point.
    const twoPt = rest > 0 && rest % 2 === 0 && rest / 2 <= Math.max(0, tds - xp) ? rest / 2 : 0;
    const unexplained = rest - twoPt * 2;
    const hasKicking = mine.some((e) => e.kicking);
    out[teamId] = { final, passTD, rushTD, defTD, retTD, fg, fgAtt, xp, xpAtt, safeties, twoPt, unexplained: hasKicking ? unexplained : null, complete: hasKicking && unexplained === 0 };
  }
  return out;
}
