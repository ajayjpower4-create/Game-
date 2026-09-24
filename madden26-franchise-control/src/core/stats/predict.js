// Matchup preview: the blocking model run forward, for use while you play.
//
// For any game, played or not, it lines up each offense against the other
// defense the way the blocking model does (right end on left tackle, and so on),
// projects every blocker's pressures and sacks allowed, flags the matchups
// that will get the quarterback hit, and turns that into plain game-plan tips
// for both sides of the ball.
//
// It only uses what was known before kickoff: ratings, each player's steady
// form, and how he did in this league's earlier games. For a game that has
// been played, the real sacks are shown next to the projection.

import { teamContext, rating, offense } from './context.js';
import { STARTERS, OLINE } from '../positions.js';
import { blockerProfile, rusherProfile, pairWinProb, playerForm, qbAdjust, sackConversion, buildPairs, affinityKey, MODEL } from './blocking.js';

const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const logit = (p) => Math.log(p / (1 - p));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r1 = (v) => Math.round(v * 10) / 10;

const PASS_BLOCK_SHARE = { LT: 1, LG: 1, C: 1, RG: 1, RT: 1, TE: 0.38, HB: 0.22, FB: 0.55 };
const RUSH_SNAP_SHARE = { LE: 1, RE: 1, DT: 1, LOLB: 0.7, ROLB: 0.7, MLB: 0.22, SS: 0.06, FS: 0.04, CB: 0.03 };
const OFF_POS = ['QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT'];
const DEF_POS = ['LE', 'RE', 'DT', 'LOLB', 'MLB', 'ROLB', 'CB', 'FS', 'SS'];
const SIDE_OF = { LT: 'left', LG: 'left', C: 'middle', RG: 'right', RT: 'right' };

function gameOrder(g) {
  return ({ pre: 0, reg: 1, post: 2 }[g.stage] ?? 3) * 100 + g.week;
}

// Who is expected to play: the real lineup for a played game, otherwise the
// healthy starters on the roster.
function lineup(league, gameId, teamId, oppId, side, played) {
  if (played) {
    const ctx = teamContext(league, gameId, teamId, oppId);
    return ctx.people.filter((x) => (side === 'off' ? OFF_POS : DEF_POS).includes(x.player.position) && (!x.entry || !x.entry.snapsRecorded || x.entry.snaps > 0));
  }
  const want = side === 'off' ? OFF_POS : DEF_POS;
  const out = [];
  for (const pos of want) {
    const n = pos === 'TE' ? 2 : pos === 'HB' ? 1 : STARTERS[pos] || 1;
    const healthy = Object.values(league.players)
      .filter((p) => p.teamId === teamId && p.position === pos && !(p.injury && p.injury.status === 'Injured' && (p.injury.weeksTotal || 0) > 0))
      .sort((a, b) => (b.overall || 0) - (a.overall || 0))
      .slice(0, n);
    healthy.forEach((p, i) => out.push({ player: p, entry: null, played: false, share: pos === 'TE' && i === 1 ? 0.4 : 1 }));
  }
  return out;
}

// Season-to-date volume: the average dropbacks and carries in earlier games.
function volume(league, teamId, beforeOrder, engine, tracker) {
  const games = Object.values(league.games).filter((g) => g.status === 'played' && gameOrder(g) < beforeOrder && (g.homeTeamId === teamId || g.awayTeamId === teamId));
  if (!games.length) return { dropbacks: 36, rushes: 26, games: 0 };
  let db = 0;
  let ru = 0;
  for (const g of games) {
    const t = engine.game(league, g.gameId, tracker).teams[teamId];
    if (!t) continue;
    db += t.plays.dropbacks;
    ru += t.plays.rushAttempts;
  }
  return { dropbacks: Math.max(18, db / games.length), rushes: Math.max(12, ru / games.length), games: games.length };
}

// How each player has done so far compared with what his ratings expected,
// in log-odds, shrunk hard toward zero when there is little to go on.
function seasonForm(league, beforeOrder, engine, tracker) {
  const obs = new Map();
  for (const g of Object.values(league.games)) {
    if (g.status !== 'played' || gameOrder(g) >= beforeOrder) continue;
    const res = engine.game(league, g.gameId, tracker);
    for (const t of Object.values(res.teams)) {
      for (const b of t.blocking.blockers) {
        const o = obs.get(b.playerId) || { got: 0, exp: 0, n: 0 };
        o.got += b.pressuresAllowed; o.exp += b.expectedPressures || 0; o.n += 1;
        obs.set(b.playerId, o);
      }
      for (const r of t.blocking.passRush) {
        const o = obs.get(r.playerId) || { got: 0, exp: 0, n: 0 };
        o.got += r.pressures; o.exp += r.expectedPressures || 0; o.n += 1;
        obs.set(r.playerId, o);
      }
    }
  }
  const form = new Map();
  for (const [pid, o] of obs) form.set(pid, { adj: clamp(0.5 * Math.log((o.got + 2) / (o.exp + 2)), -0.6, 0.6), games: o.n, got: o.got, exp: r1(o.exp) });
  return form;
}

function risk(lossPct, expPressures) {
  if (lossPct >= 13 || expPressures >= 4.5) return 'Critical';
  if (lossPct >= 9 || expPressures >= 3) return 'High';
  if (lossPct >= 6 || expPressures >= 1.8) return 'Medium';
  return 'Low';
}

function moveName(r, b) {
  return r.power - b.power >= r.finesse - b.finesse ? 'power' : 'finesse';
}

function sideProjection({ league, gameId, offTeam, defTeam, played, engine, tracker, form, calib, beforeOrder }) {
  const offPeople = lineup(league, gameId, offTeam, defTeam, 'off', played);
  const defPeople = lineup(league, gameId, defTeam, offTeam, 'def', played);
  const vol = volume(league, offTeam, beforeOrder, engine, tracker);
  const oppVol = volume(league, defTeam, beforeOrder, engine, tracker);
  const dropbacks = Math.round(vol.games ? vol.dropbacks : 36);
  const rushes = Math.round(vol.games ? vol.rushes : 26);
  const f = (pid) => (form.get(pid) || { adj: 0 }).adj;
  const steady = (pid) => playerForm(league.leagueId, pid);

  const qbX = offPeople.filter((x) => x.player.position === 'QB').sort((a, b) => (offense(b).PASSATTEMPTS || 0) - (offense(a).PASSATTEMPTS || 0) || (b.player.overall || 0) - (a.player.overall || 0))[0];
  const qb = qbX ? qbX.player : null;

  // On-field share: real snaps when the game was played, starters otherwise.
  const share = (x, plays) => (x.entry && x.entry.snapsRecorded ? Math.min(1, x.entry.snaps / Math.max(1, plays)) : x.share ?? 1);
  const offPlays = played ? Math.max(1, ...offPeople.map((x) => (x.entry && x.entry.snapsRecorded ? x.entry.snaps : 0))) : 60;

  const blockers = offPeople
    .filter((x) => PASS_BLOCK_SHARE[x.player.position] !== undefined)
    .map((x) => ({ x, playerId: x.player.playerId, name: x.player.fullName, position: x.player.position, overall: x.player.overall, passBlockSnaps: dropbacks * share(x, offPlays) * PASS_BLOCK_SHARE[x.player.position], profile: blockerProfile(x.player) }))
    .filter((b) => b.passBlockSnaps >= 1);
  const rushers = defPeople
    .filter((x) => RUSH_SNAP_SHARE[x.player.position] !== undefined)
    .map((x) => ({ x, playerId: x.player.playerId, name: x.player.fullName, position: x.player.position, overall: x.player.overall, passRushSnaps: dropbacks * share(x, offPlays) * RUSH_SNAP_SHARE[x.player.position], profile: rusherProfile(x.player) }))
    .filter((r) => r.passRushSnaps >= 0.5);
  const raw = rushers.reduce((s, r) => s + r.passRushSnaps, 0);
  if (raw > 0) for (const r of rushers) r.passRushSnaps *= (MODEL.rushersPerDropback * dropbacks) / raw;
  const dts = rushers.filter((r) => r.position === 'DT').sort((a, b) => b.passRushSnaps - a.passRushSnaps);
  for (const r of rushers) r.affinity = affinityKey(r.position, dts.length >= 2 ? dts.indexOf(r) + 1 : 0);

  const offset = calib && Number.isFinite(calib.repOffset) ? calib.repOffset : 0;
  const teamAdj = qbAdjust(qb);
  const pairs = buildPairs(rushers, blockers);
  for (const pr of pairs) {
    pr.p = pairWinProb(pr.r.profile, pr.b.profile, teamAdj + offset + steady(pr.r.playerId) - steady(pr.b.playerId) + f(pr.r.playerId) - f(pr.b.playerId));
    pr.exp = pr.reps * pr.p;
  }
  const finish = (() => { let w = 0; let s = 0; for (const pr of pairs) { w += pr.reps; s += pr.reps * pr.r.profile.finish; } return w ? s / w : 70; })();
  const q = sackConversion(qb, finish, calib && calib.sackBase ? calib.sackBase : MODEL.sackBase);
  const expPressures = pairs.reduce((s, pr) => s + pr.exp, 0) + dropbacks * MODEL.unblockedRate;

  const blockerRows = blockers.map((b) => {
    const row = pairs.filter((pr) => pr.b === b).sort((a, c) => c.reps - a.reps);
    const exp = row.reduce((s, pr) => s + pr.exp, 0);
    const reps = row.reduce((s, pr) => s + pr.reps, 0);
    const loss = reps ? exp / reps : 0;
    const main = row[0];
    const fm = form.get(b.playerId);
    return {
      playerId: b.playerId,
      name: b.name,
      position: b.position,
      overall: b.overall,
      passBlock: Math.round(rating(b.x.player, 'passBlock')),
      faces: main ? { playerId: main.r.playerId, name: main.r.name, position: main.r.position, overall: main.r.overall, move: moveName(main.r.profile, b.profile), winPct: r1(main.p * 100) } : null,
      holdPct: r1((1 - loss) * 100),
      lossPct: r1(loss * 100),
      predictedPressures: r1(exp),
      predictedSacks: r1(exp * q),
      risk: risk(loss * 100, exp),
      seasonForm: fm ? { games: fm.games, allowed: fm.got, expected: fm.exp } : null,
    };
  }).sort((a, b) => b.predictedPressures - a.predictedPressures);

  const rusherRows = rushers.map((r) => {
    const row = pairs.filter((pr) => pr.r === r).sort((a, c) => c.reps - a.reps);
    const exp = row.reduce((s, pr) => s + pr.exp, 0);
    const main = row[0];
    const best = row.filter((pr) => pr.reps >= 1).sort((a, c) => c.p - a.p)[0];
    const brief = (pr) => (pr ? { playerId: pr.b.playerId, name: pr.b.name, position: pr.b.position, winPct: r1(pr.p * 100), move: moveName(r.profile, pr.b.profile) } : null);
    return {
      playerId: r.playerId,
      name: r.name,
      position: r.position,
      overall: r.overall,
      passRushSnaps: Math.round(r.passRushSnaps),
      predictedPressures: r1(exp),
      predictedSacks: r1(exp * q),
      faces: brief(main),
      bestMatchup: brief(best),
    };
  }).sort((a, b) => b.predictedPressures - a.predictedPressures);

  // Run lanes: the offensive linemen on each side against the front's block
  // shedding, with the league's own run baseline.
  // One man per spot: whoever played the most there (or the starter).
  const topAt = (list, pos, n, key) => list.filter((x) => pos(x)).sort((a, b) => key(b) - key(a)).slice(0, n);
  const starters = OLINE.flatMap((pos) => topAt(blockers, (b) => b.position === pos, 1, (b) => b.passBlockSnaps));
  const front = ['LE', 'RE', 'DT', 'LOLB', 'MLB', 'ROLB'].flatMap((pos) => topAt(defPeople, (x) => x.player.position === pos, pos === 'DT' ? 2 : 1, (x) => share(x, offPlays) * 100 + (x.player.overall || 0) / 100));
  const shedOf = (x) => 0.7 * rating(x.player, 'blockShed') + 0.3 * rating(x.player, 'strength');
  const laneDefenders = { left: ['RE', 'ROLB', 'DT'], middle: ['DT', 'MLB'], right: ['LE', 'LOLB', 'DT'] };
  const lanes = ['left', 'middle', 'right'].map((side) => {
    const bl = starters.filter((b) => SIDE_OF[b.position] === side || (side === 'middle' && ['LG', 'RG'].includes(b.position)));
    const df = front.filter((x) => laneDefenders[side].includes(x.player.position));
    if (!bl.length) return null;
    const bRun = bl.reduce((s, b) => s + b.profile.run, 0) / bl.length;
    const dShed = df.length ? df.reduce((s, x) => s + shedOf(x), 0) / df.length : 70;
    const win = sigmoid(logit(MODEL.runBase) + (0.55 * (bRun - dShed)) / 10);
    return { side, blockers: bl.map((b) => `${b.position} ${b.name}`), defenders: df.map((x) => `${x.player.position} ${x.player.fullName}`), winPct: r1(win * 100) };
  }).filter(Boolean).sort((a, b) => b.winPct - a.winPct);

  return {
    offense: offTeam,
    defense: defTeam,
    basis: { dropbacks, rushes, fromGames: vol.games, defenseGames: oppVol.games, lineup: played ? 'players who actually played' : 'healthy starters on the current roster' },
    qb: qb ? { playerId: qb.playerId, name: qb.fullName, breakSack: rating(qb, 'breakSack', 65), throwUnderPressure: rating(qb, 'throwUnderPressure', 70), awareness: rating(qb, 'awareness', 70) } : null,
    predicted: { pressures: r1(expPressures), pressureRate: r1((expPressures / Math.max(1, dropbacks)) * 100), sacks: r1(expPressures * q), sackPerPressure: r1(q * 100) },
    blockers: blockerRows,
    rushers: rusherRows,
    runLanes: lanes,
  };
}

function lanePhrase(side, their = false) {
  if (side === 'middle') return their ? 'inside' : 'between the tackles';
  return `to ${their ? 'their' : 'the'} ${side}`;
}

function offenseTips(s, avgRep) {
  const tips = [];
  const ol = s.blockers.filter((b) => OLINE.includes(b.position));
  const worst = ol.slice().sort((a, b) => b.predictedPressures - a.predictedPressures || b.lossPct - a.lossPct)[0];
  const hasTE = s.blockers.some((b) => b.position === 'TE');
  if (worst && worst.faces && (worst.risk === 'High' || worst.risk === 'Critical')) {
    const side = SIDE_OF[worst.position];
    const help = side === 'middle' ? 'Slide the protection to him or keep a back in to double' : `Chip with ${hasTE ? 'the tight end' : 'a back'} or slide the protection to the ${side}`;
    tips.push(`Help ${worst.position} ${worst.name} against ${worst.faces.position} ${worst.faces.name}. His ${worst.faces.move} rush wins ${worst.faces.winPct}% of reps (league average ${avgRep}%), about ${worst.predictedPressures} pressures over a game. ${help}.`);
    const second = ol.find((b) => b !== worst && (b.risk === 'High' || b.risk === 'Critical'));
    if (second && second.faces) tips.push(`Second problem spot: ${second.position} ${second.name} vs ${second.faces.position} ${second.faces.name} (${second.faces.winPct}% per rep).`);
  } else if (worst) {
    tips.push(`Your line matches up well. The most pressure should come off ${worst.position} ${worst.name}, and even that is only about ${worst.predictedPressures} over a game.`);
  }
  // Backs and tight ends who cannot hold up should run routes instead.
  const leaky = s.blockers.filter((b) => !OLINE.includes(b.position) && b.faces && b.lossPct >= avgRep * 1.4).sort((a, b) => b.lossPct - a.lossPct)[0];
  if (leaky) tips.push(`Keep ${leaky.position} ${leaky.name} out of pass protection when ${leaky.faces.position} ${leaky.faces.name} blitzes. He loses ${leaky.lossPct}% of those reps; send him on a route or check to max protect.`);
  const pr = s.predicted.pressureRate;
  const qbName = s.qb ? s.qb.name : 'your quarterback';
  if (pr >= 42) tips.push(`Expect heat: about ${s.predicted.pressures} pressures on ${s.basis.dropbacks} dropbacks. Lean on quick throws, screens and max protection.${s.qb && s.qb.throwUnderPressure < 72 ? ` ${qbName}'s throw under pressure is only ${s.qb.throwUnderPressure}.` : ''}`);
  else if (pr <= 28) tips.push(`The pocket should hold up (${pr}% projected pressure). Take your shots downfield.`);
  if (s.qb && s.qb.breakSack <= 60) tips.push(`${qbName} rarely slips a sack: ${s.predicted.sackPerPressure}% of pressures project to become sacks. Get the ball out on time.`);
  else if (s.qb && s.qb.breakSack >= 85) tips.push(`${qbName} escapes well: extend plays and roll out when the edge collapses.`);
  const lane = s.runLanes[0];
  const bad = s.runLanes[s.runLanes.length - 1];
  if (lane) tips.push(`Run ${lanePhrase(lane.side)}: ${lane.blockers.join(', ')} win ${lane.winPct}% of run blocks there${bad && bad !== lane && lane.winPct - bad.winPct >= 4 ? `, versus ${bad.winPct}% ${bad.side === 'middle' ? 'up the middle' : `to the ${bad.side}`}` : ''}.`);
  return tips;
}

function defenseTips(s, avgRep) {
  const tips = [];
  // The single best one-on-one, among rushers who are out there enough to matter.
  const regular = s.rushers.filter((r) => r.faces && r.passRushSnaps >= s.basis.dropbacks * 0.3);
  const best = regular.slice().sort((a, b) => b.faces.winPct - a.faces.winPct)[0];
  if (best) {
    const m = best.faces;
    const edge = m.winPct >= avgRep ? `win ${m.winPct}% of reps, above the league's ${avgRep}%` : `still win ${m.winPct}% of reps (league average ${avgRep}%), the best you have here`;
    tips.push(`Your best rush is ${best.position} ${best.name} against ${m.position} ${m.name}: his ${m.move} moves ${edge}. Keep him on that side, or send a blitz through that gap.`);
  }
  const weak = s.blockers.filter((b) => OLINE.includes(b.position)).sort((a, b) => a.holdPct - b.holdPct)[0];
  if (weak && (!best || best.faces.playerId !== weak.playerId)) tips.push(`Their weakest pass protector is ${weak.position} ${weak.name} (holds ${weak.holdPct}% of reps). Line your best rusher up over him.`);
  const leaky = s.blockers.filter((b) => !OLINE.includes(b.position) && b.faces && b.lossPct >= avgRep * 1.4).sort((a, b) => b.lossPct - a.lossPct)[0];
  if (leaky) tips.push(`Blitz at ${leaky.position} ${leaky.name} when he stays in to block: he loses ${leaky.lossPct}% of those reps.`);
  if (s.qb && s.qb.breakSack <= 60) tips.push(`${s.qb.name} struggles to escape: get home and it is a sack about ${s.predicted.sackPerPressure}% of the time.`);
  else if (s.qb && s.qb.breakSack >= 85) tips.push(`${s.qb.name} slips out of pressure. Rush in lanes and keep a spy on him.`);
  const lane = s.runLanes[0];
  if (lane) tips.push(`They will want to run ${lanePhrase(lane.side, true)} (${lane.winPct}% run-block win rate). Stack that side.`);
  return tips;
}

export function predictGame(league, engine, tracker, gameId) {
  const game = league.games[gameId];
  if (!game) throw new Error(`Unknown game ${gameId}`);
  const played = game.status === 'played';
  const beforeOrder = gameOrder(game);
  const calib = engine.calibration(league);
  const form = seasonForm(league, beforeOrder, engine, tracker);
  const avgRep = r1((calib.repWinRate || 0.085) * 100);
  const teams = {};
  for (const [off, def] of [[game.homeTeamId, game.awayTeamId], [game.awayTeamId, game.homeTeamId]]) {
    const s = sideProjection({ league, gameId, offTeam: off, defTeam: def, played, engine, tracker, form, calib, beforeOrder });
    teams[off] = { ...s, offenseTips: offenseTips(s, avgRep), defenseTipsForOpponent: defenseTips(s, avgRep) };
  }
  // What really happened, for a played game.
  if (played) {
    const res = engine.game(league, gameId, tracker);
    for (const [teamId, t] of Object.entries(res.teams)) {
      if (!teams[teamId]) continue;
      teams[teamId].actual = { sacks: t.blocking.summary.sacksAllowed, pressures: t.blocking.summary.pressuresAllowed, pressureSource: t.blocking.summary.pressureSource, dropbacks: t.blocking.summary.dropbacks };
    }
  }
  return { gameId, played, label: game.label, homeTeamId: game.homeTeamId, awayTeamId: game.awayTeamId, leagueRepWinPct: avgRep, teams, formGames: [...form.values()].reduce((m, x) => Math.max(m, x.games), 0) };
}
