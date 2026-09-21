// Advanced blocking and pass-rush stats for one team in one game.
//
// Recorded by Madden 26 and used as-is when present: sacks allowed per blocker
// and pancakes (franchise file only), sacks per defender, team sacks allowed,
// snap counts. Everything else (pressures, hurries, QB hits, near sacks, who
// beat whom, time to pressure) is reconstructed from those numbers and the
// players' ratings with a seeded random stream, and replaced by Game Tracker
// events whenever the user logged the real thing.

import { makeRng, apportion } from '../rng.js';
import { isBlocker, isPassRusher, OLINE } from '../positions.js';
import { rating, offense, defense, oline, snapCount } from './context.js';

const PASS_BLOCK_SHARE = { LT: 1, LG: 1, C: 1, RG: 1, RT: 1, TE: 0.38, HB: 0.22, FB: 0.55 };
const RUN_BLOCK_SHARE = { LT: 1, LG: 1, C: 1, RG: 1, RT: 1, TE: 0.85, HB: 0.1, FB: 0.9 };
const BEATEN_FACTOR = { LT: 1.35, RT: 1.3, LG: 1.0, RG: 1.0, C: 0.75, TE: 0.7, HB: 1.1, FB: 0.8 };
const RUSH_FACTOR = { LE: 1.4, RE: 1.45, DT: 1.0, LOLB: 1.05, ROLB: 1.05, MLB: 0.3, SS: 0.08, FS: 0.05, CB: 0.05 };
const RUSH_SNAP_SHARE = { LE: 1, RE: 1, DT: 1, LOLB: 0.7, ROLB: 0.7, MLB: 0.22, SS: 0.06, FS: 0.04, CB: 0.03 };

function passBlockRating(p) {
  return Math.max(rating(p, 'passBlock'), (rating(p, 'passBlockPower') + rating(p, 'passBlockFinesse')) / 2);
}
function runBlockRating(p) {
  return Math.max(rating(p, 'runBlock'), (rating(p, 'runBlockPower') + rating(p, 'runBlockFinesse')) / 2);
}
function passRushRating(p) {
  return Math.max(rating(p, 'powerMoves'), rating(p, 'finesseMoves'));
}

export function blockingForTeam({ league, gameId, ctx, oppCtx, overrides = {}, oppOverrides = {} }) {
  const rng = makeRng('blocking', league.leagueId, gameId, ctx.teamId);
  const { dropbacks, rushAttempts, offPlays } = ctx;

  // --- who blocks, and how many snaps each one blocked
  const blockers = ctx.people
    .filter((x) => isBlocker(x.player.position))
    .map((x) => {
      const pos = x.player.position;
      const { snaps, recorded } = snapCount(ctx, x, offPlays);
      const snapPct = offPlays ? Math.min(1, snaps / offPlays) : 0;
      return {
        x,
        playerId: x.player.playerId,
        name: x.player.fullName,
        position: pos,
        snaps,
        snapsRecorded: recorded,
        passBlockSnaps: Math.round(dropbacks * snapPct * (PASS_BLOCK_SHARE[pos] || 0)),
        runBlockSnaps: Math.round(rushAttempts * snapPct * (RUN_BLOCK_SHARE[pos] || 0)),
        pbr: passBlockRating(x.player),
        rbr: runBlockRating(x.player),
      };
    })
    .filter((b) => b.passBlockSnaps > 0 || b.runBlockSnaps > 0 || oline(b.x).OLINEPANCAKES > 0);

  // --- who rushes on the other side
  const rushers = oppCtx.people
    .filter((x) => isPassRusher(x.player.position) || ['SS', 'FS', 'CB'].includes(x.player.position))
    .map((x) => {
      const pos = x.player.position;
      const { snaps, recorded } = snapCount(oppCtx, x, offPlays); // defense plays = this offense's plays
      const snapPct = offPlays ? Math.min(1, snaps / offPlays) : 0;
      const d = defense(x);
      return {
        x,
        playerId: x.player.playerId,
        name: x.player.fullName,
        position: pos,
        snaps,
        snapsRecorded: recorded,
        passRushSnaps: Math.round(dropbacks * snapPct * (RUSH_SNAP_SHARE[pos] || 0)),
        prr: passRushRating(x.player),
        sacks: (d.DLINESACKS || 0) + (d.DLINEHALFSACK || 0) * 0.5,
      };
    })
    .filter((r) => r.passRushSnaps > 0 || r.sacks > 0);

  // --- team pressure total
  const olStrength = weightedAvg(blockers.filter((b) => OLINE.includes(b.position)), (b) => b.pbr, (b) => b.passBlockSnaps) || 65;
  const topRush = rushers.slice().sort((a, b) => b.prr - a.prr).slice(0, 4);
  const rushStrength = topRush.length ? topRush.reduce((s, r) => s + r.prr, 0) / topRush.length : 65;
  const trackedRush = oppOverrides.passRush || null;
  const trackedBlock = overrides.blocking || null;

  let sacksAllowed = ctx.sacksAllowed;
  const recordedSacksPerBlocker = new Map(blockers.map((b) => [b.playerId, oline(b.x).OLINESACKSALLOWED || 0]));
  const recordedSackSum = [...recordedSacksPerBlocker.values()].reduce((a, b) => a + b, 0);
  if (recordedSackSum > sacksAllowed) sacksAllowed = recordedSackSum;

  let pressures;
  let hits;
  let hurries;
  let pressureSource;
  if (trackedRush && Object.keys(trackedRush).length) {
    const totals = Object.values(trackedRush).reduce((a, r) => ({ p: a.p + r.pressures, h: a.h + r.hits, hu: a.hu + r.hurries, s: a.s + r.sacks }), { p: 0, h: 0, hu: 0, s: 0 });
    pressures = Math.max(totals.p, sacksAllowed);
    hits = totals.h;
    hurries = totals.hu;
    if (totals.s > sacksAllowed) sacksAllowed = totals.s;
    pressureSource = 'tracked';
  } else {
    const rate = clamp(0.33 + 0.0045 * (rushStrength - olStrength) + rng.gaussian(0, 0.03), 0.12, 0.6);
    pressures = Math.max(sacksAllowed, Math.round(dropbacks * rate));
    const nonSack = pressures - sacksAllowed;
    hits = rng.binomial(nonSack, 0.32);
    hurries = nonSack - hits;
    pressureSource = 'reconstructed';
  }
  const nearSacks = hits + Math.round(hurries * 0.3); // QB had a hand on him or slipped away

  // --- assign sacks to blockers
  let sacksByBlocker;
  if (recordedSackSum > 0 || league.capabilities.pancakesRecorded) {
    sacksByBlocker = blockers.map((b) => recordedSacksPerBlocker.get(b.playerId) || 0);
    const missing = sacksAllowed - recordedSackSum;
    if (missing > 0) {
      const extra = apportion(missing, blockers.map((b) => beatenWeight(b)), rng);
      sacksByBlocker = sacksByBlocker.map((v, i) => v + extra[i]);
    }
  } else if (trackedBlock) {
    sacksByBlocker = blockers.map((b) => (trackedBlock[b.playerId] ? trackedBlock[b.playerId].sacksAllowed : 0));
  } else {
    sacksByBlocker = apportion(sacksAllowed, blockers.map((b) => beatenWeight(b)), rng);
  }

  // --- assign hits & hurries to blockers
  let hitsByBlocker;
  let hurriesByBlocker;
  if (trackedBlock && Object.keys(trackedBlock).length) {
    hitsByBlocker = blockers.map((b) => (trackedBlock[b.playerId] ? trackedBlock[b.playerId].hitsAllowed : 0));
    hurriesByBlocker = blockers.map((b) => (trackedBlock[b.playerId] ? trackedBlock[b.playerId].hurriesAllowed : 0));
  } else {
    hitsByBlocker = apportion(hits, blockers.map((b) => beatenWeight(b)), rng);
    hurriesByBlocker = apportion(hurries, blockers.map((b) => beatenWeight(b)), rng);
  }

  // --- pancakes
  const pancakesByBlocker = blockers.map((b) => {
    const tracked = overrides.pancakes && overrides.pancakes[b.playerId];
    if (tracked != null) return { value: tracked, source: 'tracked' };
    const recorded = oline(b.x).OLINEPANCAKES;
    if (league.capabilities.pancakesRecorded && typeof recorded === 'number') return { value: recorded, source: 'recorded' };
    const p = clamp(0.018 + Math.max(0, Math.max(b.rbr, rating(b.x.player, 'impactBlock')) - 68) * 0.0016, 0.005, 0.07);
    const trials = b.runBlockSnaps + Math.round(b.passBlockSnaps * 0.25);
    return { value: makeRng('pancake', league.leagueId, gameId, b.playerId).binomial(trials, p), source: 'reconstructed' };
  });

  // --- time to pressure / time held
  const blockerRows = blockers.map((b, i) => {
    const sacksA = sacksByBlocker[i] || 0;
    const hitsA = hitsByBlocker[i] || 0;
    const hurriesA = hurriesByBlocker[i] || 0;
    const pressuresA = sacksA + hitsA + hurriesA;
    const prng = makeRng('hold', league.leagueId, gameId, b.playerId);
    const avgHold = clamp(2.05 + (b.pbr - 62) * 0.028 + prng.gaussian(0, 0.12), 1.4, 4.2);
    const timeToPressure = pressuresA > 0 ? clamp(avgHold - 0.35 + prng.gaussian(0, 0.15), 1.0, 4.0) : null;
    const pbe = b.passBlockSnaps > 0 ? 100 - ((sacksA + hitsA * 0.75 + hurriesA * 0.75) / b.passBlockSnaps) * 100 : null;
    const pancakes = pancakesByBlocker[i].value;
    const pancakeRate = b.runBlockSnaps > 0 ? pancakes / b.runBlockSnaps : 0;
    const rawGrade = 55 + (pbe == null ? 0 : (pbe - 93) * 2.2) + pancakeRate * 250 + (avgHold - 2.4) * 8 - sacksA * 4;
    // Small samples pull toward average so a two-snap blocker cannot top the board.
    const confidence = Math.min(1, (b.passBlockSnaps + b.runBlockSnaps) / 30);
    const grade = clamp(60 + (rawGrade - 60) * confidence, 0, 99);
    return {
      playerId: b.playerId,
      name: b.name,
      position: b.position,
      snaps: b.snaps,
      passBlockSnaps: b.passBlockSnaps,
      runBlockSnaps: b.runBlockSnaps,
      pressuresAllowed: pressuresA,
      hurriesAllowed: hurriesA,
      hitsAllowed: hitsA,
      sacksAllowed: sacksA,
      nearSacksAllowed: hitsA + Math.round(hurriesA * 0.3),
      cleanPassSnaps: Math.max(0, b.passBlockSnaps - pressuresA),
      pancakes,
      pancakeRate: round2(pancakeRate * 100),
      avgTimeHeld: round2(avgHold),
      timeToPressure: timeToPressure == null ? null : round2(timeToPressure),
      passBlockEfficiency: pbe == null ? null : round2(pbe),
      blockGrade: Math.round(grade),
      source: {
        snaps: b.snapsRecorded ? 'recorded' : 'reconstructed',
        sacksAllowed: recordedSackSum > 0 ? 'recorded' : trackedBlock ? 'tracked' : 'reconstructed',
        pressures: trackedBlock && Object.keys(trackedBlock).length ? 'tracked' : pressureSource,
        pancakes: pancakesByBlocker[i].source,
        timing: 'reconstructed',
      },
    };
  });

  // --- credit rushers
  let rusherRows;
  if (trackedRush && Object.keys(trackedRush).length) {
    rusherRows = rushers.map((r) => {
      const t = trackedRush[r.playerId] || { pressures: 0, hurries: 0, hits: 0, sacks: 0, missedSacks: 0, beat: {} };
      const sacks = Math.max(r.sacks, t.sacks);
      return rusherRow(r, { sacks, hits: t.hits, hurries: t.hurries, missedSacks: t.missedSacks, beat: t.beat, source: 'tracked' });
    });
  } else {
    const nonSackHits = apportion(hits, rushers.map((r) => rushWeight(r)), rng);
    const nonSackHurries = apportion(hurries, rushers.map((r) => rushWeight(r)), rng);
    rusherRows = rushers.map((r, i) => {
      const prng = makeRng('missed-sack', league.leagueId, gameId, r.playerId);
      const missedSacks = prng.binomial(nonSackHits[i], 0.55) + prng.binomial(nonSackHurries[i], 0.12);
      // who did he beat? weighted by blockers that faced his side most
      const beat = {};
      const total = nonSackHits[i] + nonSackHurries[i] + r.sacks;
      if (total > 0 && blockerRows.length) {
        const weights = blockerRows.map((b) => matchupWeight(r.position, b.position) * Math.max(1, b.pressuresAllowed));
        const dist = apportion(Math.round(total), weights, prng);
        dist.forEach((v, j) => { if (v > 0) beat[blockerRows[j].playerId] = v; });
      }
      return rusherRow(r, { sacks: r.sacks, hits: nonSackHits[i], hurries: nonSackHurries[i], missedSacks, beat, source: pressureSource });
    });
  }

  const matchups = [];
  for (const r of rusherRows) for (const [blockerId, count] of Object.entries(r.beat)) {
    const b = blockerRows.find((x) => x.playerId === blockerId);
    if (b) matchups.push({ rusherId: r.playerId, rusher: r.name, rusherPos: r.position, blockerId, blocker: b.name, blockerPos: b.position, wins: count });
  }
  matchups.sort((a, b) => b.wins - a.wins);

  blockerRows.sort((a, b) => b.blockGrade - a.blockGrade);
  rusherRows.sort((a, b) => b.pressures - a.pressures || b.sacks - a.sacks);

  return {
    teamId: ctx.teamId,
    summary: {
      dropbacks,
      rushAttempts,
      pressuresAllowed: pressures,
      hurriesAllowed: hurries,
      hitsAllowed: hits,
      sacksAllowed,
      nearSacksAllowed: nearSacks,
      pressureRate: dropbacks ? round2((pressures / dropbacks) * 100) : 0,
      pancakes: blockerRows.reduce((s, b) => s + b.pancakes, 0),
      olPassBlockRating: Math.round(olStrength),
      oppPassRushRating: Math.round(rushStrength),
      pressureSource,
      bestBlocker: (() => { const q = blockerRows.find((b) => b.passBlockSnaps + b.runBlockSnaps >= Math.min(20, Math.round(offPlays * 0.3))) || blockerRows[0]; return q ? { playerId: q.playerId, name: q.name, position: q.position, grade: q.blockGrade, pressuresAllowed: q.pressuresAllowed, pancakes: q.pancakes } : null; })(),
      mostBeaten: blockerRows.slice().sort((a, b) => b.pressuresAllowed - a.pressuresAllowed)[0] || null,
    },
    blockers: blockerRows,
    passRush: rusherRows, // the OPPONENT's rushers against this offense
    matchups: matchups.slice(0, 12),
  };
}

function rusherRow(r, { sacks, hits, hurries, missedSacks, beat, source }) {
  const pressures = sacks + hits + hurries;
  return {
    playerId: r.playerId,
    name: r.name,
    position: r.position,
    snaps: r.snaps,
    passRushSnaps: r.passRushSnaps,
    pressures,
    hurries,
    hits,
    sacks,
    missedSacks,
    nearSacks: hits + Math.round(hurries * 0.3),
    winRate: r.passRushSnaps ? round2((pressures / r.passRushSnaps) * 100) : 0,
    beat,
    source: { sacks: 'recorded', pressures: source, snaps: r.snapsRecorded ? 'recorded' : 'reconstructed' },
  };
}

function beatenWeight(b) {
  return b.passBlockSnaps * Math.exp(-(b.pbr - 70) / 11) * (BEATEN_FACTOR[b.position] || 1);
}
function rushWeight(r) {
  return r.passRushSnaps * Math.exp((r.prr - 70) / 11) * (RUSH_FACTOR[r.position] || 0.2);
}
function matchupWeight(rusherPos, blockerPos) {
  const edge = ['LE', 'RE', 'LOLB', 'ROLB'].includes(rusherPos);
  if (edge) return ['LT', 'RT'].includes(blockerPos) ? 3 : ['TE', 'HB', 'FB'].includes(blockerPos) ? 1.2 : 0.5;
  if (rusherPos === 'DT') return ['LG', 'RG', 'C'].includes(blockerPos) ? 3 : 0.4;
  return ['C', 'LG', 'RG', 'HB', 'FB'].includes(blockerPos) ? 1.5 : 0.7;
}
function weightedAvg(items, val, weight) {
  let s = 0;
  let w = 0;
  for (const it of items) { s += val(it) * weight(it); w += weight(it); }
  return w ? s / w : null;
}
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
function round2(v) {
  return Math.round(v * 100) / 100;
}
