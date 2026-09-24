// Advanced blocking and pass-rush stats for one offense in one game (model v2).
//
// What Madden records and this uses as fact: sacks (per team and per
// defender), sacks allowed and pancakes per lineman in franchise files, snap
// counts, and for every carry the yards gained before and after first contact.
// Everything else is estimated, and every number says which it is.
//
// How the estimate works
//   1. Alignment. Each rusher mostly faces one blocker: a right end rushes the
//      left tackle, a left end the right tackle, tackles work the guards and
//      center, linebackers and defensive backs are picked up by backs and tight
//      ends. Reps are split by these alignments and by who was on the field.
//   2. Per-rep odds. A rusher beats his blocker on a rep with a probability set
//      by the matching move ratings: power moves against power blocking,
//      finesse moves against finesse blocking, whichever the rusher is better
//      at. Every player also carries a steady "form" of his own, so the same
//      guard is not great one week and awful the next for no reason.
//   3. Anchoring on sacks. The ratings give an expected pressure count. Madden
//      recorded how many sacks there really were, and how often a pressure
//      turns into a sack depends on the quarterback's escape ability and the
//      rushers' finishing. The final pressure count is the ratings estimate
//      updated by those real sacks, so a line that gave up six sacks allowed
//      more pressure than its ratings say.
//   4. Run blocking comes from recorded yards before contact, compared with
//      the league's own average, then shared by each blocker's run-block
//      matchup with the defensive front.
//   Tracked events from the Game Tracker replace the estimate outright.

import { makeRng, apportion, hashString } from '../rng.js';
import { isBlocker, OLINE } from '../positions.js';
import { rating, defense, oline, snapCount } from './context.js';

const logit = (p) => Math.log(p / (1 - p));
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round2 = (v) => Math.round(v * 100) / 100;

export const MODEL = {
  version: 2,
  repBase: logit(0.085), // average rusher vs average blocker, one rep
  repSlope: 0.75, // per 10 rating points of edge
  formSd: 0.12, // a player's steady form, in log-odds
  gameSd: 0.1, // game-to-game wobble
  sackBase: 0.19, // share of pressures that become sacks, average QB
  surpriseSplit: 0.5, // share of an unexpected sack count blamed on pressure (the rest on the QB holding it)
  surpriseSmoothing: 1.5,
  unblockedRate: 0.015, // free rushers per dropback (busted protections)
  rushersPerDropback: 4.4,
  runBase: 0.7, // run-block reps won by an average blocker
};

const PASS_BLOCK_SHARE = { LT: 1, LG: 1, C: 1, RG: 1, RT: 1, TE: 0.38, HB: 0.22, FB: 0.55 };
const RUN_BLOCK_SHARE = { LT: 1, LG: 1, C: 1, RG: 1, RT: 1, TE: 0.85, HB: 0.1, FB: 0.9 };
const RUSH_SNAP_SHARE = { LE: 1, RE: 1, DT: 1, LOLB: 0.7, ROLB: 0.7, MLB: 0.22, SS: 0.06, FS: 0.04, CB: 0.03 };
const FRONT = ['LE', 'RE', 'DT', 'LOLB', 'MLB', 'ROLB'];

// Who a rusher mostly lines up against, by position.
const AFFINITY = {
  RE: { LT: 0.72, LG: 0.08, TE: 0.1, HB: 0.06, FB: 0.04 },
  ROLB: { LT: 0.55, TE: 0.18, HB: 0.15, LG: 0.08, FB: 0.04 },
  LE: { RT: 0.72, RG: 0.08, TE: 0.1, HB: 0.06, FB: 0.04 },
  LOLB: { RT: 0.55, TE: 0.18, HB: 0.15, RG: 0.08, FB: 0.04 },
  DT1: { LG: 0.5, C: 0.35, RG: 0.1, HB: 0.05 },
  DT2: { RG: 0.5, C: 0.35, LG: 0.1, HB: 0.05 },
  DT: { C: 0.4, LG: 0.3, RG: 0.3 },
  MLB: { C: 0.3, HB: 0.35, LG: 0.15, RG: 0.15, FB: 0.05 },
  DB: { HB: 0.55, TE: 0.3, LT: 0.05, RT: 0.05, FB: 0.05 },
};

export function affinityKey(position, dtSlot = 0) {
  if (position === 'DT') return dtSlot === 1 ? 'DT1' : dtSlot === 2 ? 'DT2' : 'DT';
  if (['SS', 'FS', 'CB'].includes(position)) return 'DB';
  return AFFINITY[position] ? position : null;
}

export function blockerProfile(p) {
  const pb = rating(p, 'passBlock');
  const pbp = rating(p, 'passBlockPower', pb);
  const pbf = rating(p, 'passBlockFinesse', pb);
  const rb = Math.max(rating(p, 'runBlock'), (rating(p, 'runBlockPower') + rating(p, 'runBlockFinesse')) / 2);
  return {
    power: 0.55 * pbp + 0.25 * pb + 0.2 * rating(p, 'strength'),
    finesse: 0.55 * pbf + 0.25 * pb + 0.2 * rating(p, 'agility'),
    run: 0.6 * rb + 0.2 * rating(p, 'strength') + 0.2 * rating(p, 'impactBlock'),
    impact: rating(p, 'impactBlock'),
  };
}

export function rusherProfile(p) {
  const edge = ['LE', 'RE', 'LOLB', 'ROLB'].includes(p.position);
  return {
    power: 0.6 * rating(p, 'powerMoves') + 0.2 * rating(p, 'strength') + 0.2 * rating(p, 'blockShed'),
    finesse: 0.6 * rating(p, 'finesseMoves') + 0.25 * rating(p, edge ? 'speed' : 'accel') + 0.15 * rating(p, 'blockShed'),
    shed: 0.7 * rating(p, 'blockShed') + 0.3 * rating(p, 'strength'),
    finish: 0.5 * rating(p, 'tackle') + 0.3 * rating(p, 'hitPower') + 0.2 * rating(p, 'pursuit'),
    hitPower: rating(p, 'hitPower'),
  };
}

// Chance a rusher beats a blocker on one pass-rush rep. The rusher leans on
// whichever of his moves works better against this blocker.
export function pairWinProb(r, b, adj = 0) {
  const dPow = r.power - b.power;
  const dFin = r.finesse - b.finesse;
  const edge = 0.7 * Math.max(dPow, dFin) + 0.3 * ((dPow + dFin) / 2);
  return sigmoid(MODEL.repBase + (MODEL.repSlope * edge) / 10 + adj);
}

// A player's steady form, the same every week of a league.
export function playerForm(leagueId, playerId) {
  return makeRng('form', leagueId, playerId).gaussian(0, MODEL.formSd);
}

export function qbAdjust(qb) {
  if (!qb) return 0;
  return -0.006 * (rating(qb, 'awareness', 72) - 75) - 0.004 * (rating(qb, 'throwUnderPressure', 72) - 75);
}

export function sackConversion(qb, finish = 70, base = MODEL.sackBase) {
  const escape = qb ? rating(qb, 'breakSack', 65) : 65;
  return clamp(sigmoid(logit(base) - 0.025 * (escape - 70) + 0.015 * (finish - 70)), 0.06, 0.5);
}

function escapeRate(qb, finish = 70) {
  const escape = qb ? rating(qb, 'breakSack', 65) : 65;
  return clamp(0.45 + 0.012 * (escape - 70) - 0.006 * (finish - 70), 0.2, 0.8);
}

function stochRound(x, rng) {
  const f = Math.floor(x);
  return f + (rng.next() < x - f ? 1 : 0);
}

// Reps between every rusher and every blocker, from alignments and snaps.
export function buildPairs(rushers, blockers, { repsKey = 'passRushSnaps', blockKey = 'passBlockSnaps' } = {}) {
  const byPos = new Map();
  for (const b of blockers) {
    if (!(b[blockKey] > 0)) continue;
    if (!byPos.has(b.position)) byPos.set(b.position, []);
    byPos.get(b.position).push(b);
  }
  const pairs = [];
  for (const r of rushers) {
    const aff = AFFINITY[r.affinity] || AFFINITY.MLB;
    const present = Object.entries(aff).filter(([pos]) => byPos.has(pos));
    const total = present.reduce((s, [, w]) => s + w, 0);
    if (!total) continue;
    for (const [pos, w] of present) {
      const group = byPos.get(pos);
      const groupSnaps = group.reduce((s, b) => s + b[blockKey], 0) || 1;
      for (const b of group) {
        const reps = r[repsKey] * (w / total) * (b[blockKey] / groupSnaps);
        if (reps > 0) pairs.push({ r, b, reps });
      }
    }
  }
  return pairs;
}

// Who blocked, who rushed, and every rusher-blocker pair with its reps and
// uncalibrated log-odds. Shared by the game model and the league calibration
// so both see exactly the same matchups.
export function setupMatchups({ league, gameId, ctx, oppCtx, gameScript = 0 }) {
  const { dropbacks, rushAttempts, offPlays } = ctx;
  const gameAdj = (pid) => makeRng('game-form', league.leagueId, gameId, pid).gaussian(0, MODEL.gameSd);
  const form = (pid) => playerForm(league.leagueId, pid);
  const qb = ctx.qb;

  // ---------- blockers on the field
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
        profile: blockerProfile(x.player),
        form: form(x.player.playerId) + gameAdj(x.player.playerId),
      };
    })
    .filter((b) => b.passBlockSnaps > 0 || b.runBlockSnaps > 0 || oline(b.x).OLINEPANCAKES > 0 || oline(b.x).OLINESACKSALLOWED > 0);

  // ---------- rushers on the other side
  const dts = [];
  const rushers = oppCtx.people
    .filter((x) => RUSH_SNAP_SHARE[x.player.position] !== undefined)
    .map((x) => {
      const pos = x.player.position;
      const { snaps, recorded } = snapCount(oppCtx, x, offPlays); // defensive snaps = this offense's plays
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
        recordedSacks: (d.DLINESACKS || 0) + (d.DLINEHALFSACK || 0) * 0.5,
        profile: rusherProfile(x.player),
        form: form(x.player.playerId) + gameAdj(x.player.playerId),
      };
    })
    .filter((r) => r.passRushSnaps > 0 || r.recordedSacks > 0);
  // A defense sends about 4.4 rushers per dropback; scale the raw shares to
  // that so a 4-3 and a 3-4 both come out right.
  const rawReps = rushers.reduce((s, r) => s + r.passRushSnaps, 0);
  if (rawReps > 0 && dropbacks > 0) {
    const scale = (MODEL.rushersPerDropback * dropbacks) / rawReps;
    for (const r of rushers) r.passRushSnaps = Math.round(r.passRushSnaps * scale);
  }
  for (const r of rushers.filter((x) => x.position === 'DT').sort((a, b) => b.passRushSnaps - a.passRushSnaps)) dts.push(r);
  for (const r of rushers) r.affinity = affinityKey(r.position, dts.length >= 2 ? dts.indexOf(r) + 1 : 0);

  const teamAdj = qbAdjust(qb) + 0.15 * clamp(gameScript, 0, 1);
  const pairs = buildPairs(rushers, blockers);
  for (const pr of pairs) pr.logit = logit(pairWinProb(pr.r.profile, pr.b.profile, teamAdj + pr.r.form - pr.b.form));
  return { blockers, rushers, pairs, qb };
}

// Solve for the offset that makes the league's average rep produce the target
// pressure rate: about 38 rusher wins per 100 dropbacks, the NFL norm.
export function calibrateReps(samples, target = (0.38 - MODEL.unblockedRate) / MODEL.rushersPerDropback) {
  const W = samples.reduce((s, x) => s + x.reps, 0);
  if (!W) return 0;
  const mean = (d) => samples.reduce((s, x) => s + x.reps * sigmoid(x.logit + d), 0) / W;
  let lo = -5;
  let hi = 5;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (mean(mid) > target) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

export function blockingForTeam({ league, gameId, ctx, oppCtx, overrides = {}, oppOverrides = {}, calib = null, gameScript = 0 }) {
  const rng = makeRng('blocking-v2', league.leagueId, gameId, ctx.teamId);
  const { dropbacks, rushAttempts, offPlays } = ctx;
  const { blockers, rushers, pairs, qb } = setupMatchups({ league, gameId, ctx, oppCtx, gameScript });
  const offset = calib && Number.isFinite(calib.repOffset) ? calib.repOffset : 0;

  // A matchup logged in the Game Tracker happened, whatever the alignment
  // model says (a stunt, a slide the wrong way): give it a rep of its own.
  for (const [rid, t] of Object.entries(oppOverrides.passRush || {})) {
    const r = rushers.find((x) => x.playerId === rid);
    for (const bid of Object.keys((t && t.beat) || {})) {
      const b = blockers.find((x) => x.playerId === bid);
      if (!r || !b || pairs.some((pr) => pr.r === r && pr.b === b)) continue;
      pairs.push({ r, b, reps: 1, logit: logit(pairWinProb(r.profile, b.profile, qbAdjust(qb) + r.form - b.form)) });
    }
  }

  // ---------- per-pair odds, calibrated to the league
  for (const pr of pairs) pr.p = sigmoid(pr.logit + offset);
  const unblocked = dropbacks * MODEL.unblockedRate;
  const expected = pairs.reduce((s, pr) => s + pr.reps * pr.p, 0) + unblocked;

  // ---------- sacks: recorded team total, split to the rushers who got them
  let sacks = ctx.sacksAllowed;
  const recordedBlockerSacks = new Map(blockers.map((b) => [b.playerId, oline(b.x).OLINESACKSALLOWED || 0]));
  const recordedBlockerTotal = [...recordedBlockerSacks.values()].reduce((a, b) => a + b, 0);
  const rusherSackTotal = rushers.reduce((s, r) => s + r.recordedSacks, 0);
  sacks = Math.max(sacks, recordedBlockerTotal, Math.round(rusherSackTotal));

  const finishAvg = (() => {
    let w = 0;
    let s = 0;
    for (const pr of pairs) { w += pr.reps; s += pr.reps * pr.r.profile.finish; }
    return w ? s / w : 70;
  })();
  const q = sackConversion(qb, finishAvg, calib && calib.sackBase ? calib.sackBase : MODEL.sackBase);
  const escape = escapeRate(qb, finishAvg);

  // Tracked pass-rush events for this game replace the estimate.
  const trackedRush = oppOverrides.passRush && Object.keys(oppOverrides.passRush).length ? oppOverrides.passRush : null;
  const trackedBlock = overrides.blocking && Object.keys(overrides.blocking).length ? overrides.blocking : null;
  let pressureSource;
  let nonSack;
  if (trackedRush) {
    const t = Object.values(trackedRush).reduce((a, r) => ({ p: a.p + r.pressures, s: a.s + r.sacks }), { p: 0, s: 0 });
    sacks = Math.max(sacks, t.s);
    nonSack = Math.max(0, t.p - t.s);
    pressureSource = 'tracked';
  } else {
    // Ratings say `expected` pressures and `expected * q` sacks. When the real
    // sack count differs, part of the surprise is more (or less) pressure and
    // part is the quarterback holding the ball (or getting it out), so only
    // part of it moves the pressure count.
    const expSacks = expected * q;
    const surprise = (sacks + MODEL.surpriseSmoothing) / (expSacks + MODEL.surpriseSmoothing);
    const total = Math.max(sacks, expected * surprise ** MODEL.surpriseSplit);
    nonSack = stochRound(total - sacks, rng);
    pressureSource = 'reconstructed';
  }
  nonSack = Math.max(0, Math.min(nonSack, Math.max(0, dropbacks - sacks)));

  // Sacks per rusher: what was recorded, then any team sacks nobody was
  // credited with, shared by who was winning.
  const rusherSacks = new Map(rushers.map((r) => [r.playerId, Math.floor(r.recordedSacks)]));
  let halves = rushers.filter((r) => r.recordedSacks % 1 !== 0).sort((a, b) => b.passRushSnaps - a.passRushSnaps);
  let credited = [...rusherSacks.values()].reduce((a, b) => a + b, 0);
  for (const r of halves) { if (credited >= sacks) break; rusherSacks.set(r.playerId, rusherSacks.get(r.playerId) + 1); credited++; }
  if (credited < sacks && rushers.length) {
    const winW = rushers.map((r) => pairs.filter((pr) => pr.r === r).reduce((s, pr) => s + pr.reps * pr.p, 0));
    const extra = apportion(sacks - credited, winW, rng);
    rushers.forEach((r, i) => rusherSacks.set(r.playerId, rusherSacks.get(r.playerId) + extra[i]));
  }
  if (trackedRush) for (const r of rushers) if (trackedRush[r.playerId]) rusherSacks.set(r.playerId, Math.max(rusherSacks.get(r.playerId), trackedRush[r.playerId].sacks));

  // ---------- who gave up each sack
  const pairStats = new Map(pairs.map((pr) => [pr, { sacks: 0, hits: 0, hurries: 0, missed: 0 }]));
  const cap = new Map(recordedBlockerSacks);
  const blockerSackTotals = new Map(blockers.map((b) => [b.playerId, 0]));
  const hasRecordedBlame = recordedBlockerTotal > 0;
  for (const r of rushers) {
    const row = pairs.filter((pr) => pr.r === r);
    // A sack logged in the Game Tracker names the blocker who got beaten.
    const loggedBeat = trackedRush && trackedRush[r.playerId] ? { ...(trackedRush[r.playerId].beat || {}) } : {};
    for (let n = 0; n < (rusherSacks.get(r.playerId) || 0); n++) {
      if (!row.length) break;
      // With recorded sacks allowed, charge the blocker who has one left to
      // give; otherwise the one this rusher was beating most.
      let best = null;
      let bestScore = -1;
      for (const pr of row) {
        const left = cap.get(pr.b.playerId) || 0;
        const logged = (loggedBeat[pr.b.playerId] || 0) > 0 ? 1000 : 1;
        const score = pr.reps * pr.p * logged * (hasRecordedBlame ? (left > 0 ? 10 + left : 0.01) : 1);
        if (score > bestScore) { bestScore = score; best = pr; }
      }
      if (loggedBeat[best.b.playerId] > 0) loggedBeat[best.b.playerId]--;
      pairStats.get(best).sacks++;
      blockerSackTotals.set(best.b.playerId, blockerSackTotals.get(best.b.playerId) + 1);
      if (hasRecordedBlame) cap.set(best.b.playerId, Math.max(0, (cap.get(best.b.playerId) || 0) - 1));
    }
  }
  if (trackedBlock) {
    for (const b of blockers) if (trackedBlock[b.playerId]) blockerSackTotals.set(b.playerId, trackedBlock[b.playerId].sacksAllowed);
  }

  // ---------- non-sack pressures shared across the matchups
  let pairPress;
  let unblockedCount = 0;
  if (trackedRush) {
    // Use who-beat-whom where the tracker has it, the matchups elsewhere.
    pairPress = pairs.map(() => 0);
    for (const r of rushers) {
      const t = trackedRush[r.playerId];
      if (!t) continue;
      const row = pairs.map((pr, i) => (pr.r === r ? i : -1)).filter((i) => i >= 0);
      let rest = Math.max(0, t.pressures - t.sacks);
      for (const [bid, cnt] of Object.entries(t.beat || {})) {
        const i = row.find((j) => pairs[j].b.playerId === bid);
        // The logged beats already spent on sacks are not pressures too.
        const take = i === undefined ? 0 : Math.min(cnt - pairStats.get(pairs[i]).sacks, rest);
        if (i !== undefined && take > 0) { pairPress[i] += take; rest -= take; }
      }
      if (rest > 0 && row.length) apportion(rest, row.map((i) => pairs[i].reps * pairs[i].p), rng).forEach((v, k) => { pairPress[row[k]] += v; });
    }
  } else {
    const alloc = apportion(nonSack, [...pairs.map((pr) => pr.reps * pr.p), unblocked], rng);
    pairPress = alloc.slice(0, pairs.length);
    unblockedCount = alloc[pairs.length] || 0;
  }
  // Busted protections: the blitzer gets the credit, no blocker the blame.
  const BLITZ = { MLB: 3, LOLB: 2, ROLB: 2, SS: 1.5, FS: 1.2, CB: 1, DT: 0.3, LE: 0.3, RE: 0.3 };
  const freeBy = new Map();
  if (unblockedCount > 0 && rushers.length) {
    apportion(unblockedCount, rushers.map((r) => (BLITZ[r.position] || 0.3) * Math.max(1, r.passRushSnaps)), rng).forEach((v, i) => {
      if (!v) return;
      const fr = makeRng('free', league.leagueId, gameId, rushers[i].playerId);
      const hits = fr.binomial(v, 0.4);
      freeBy.set(rushers[i].playerId, { hits, hurries: v - hits, missed: fr.binomial(hits, escape) });
    });
  }
  pairs.forEach((pr, i) => {
    const st = pairStats.get(pr);
    const hitShare = clamp(0.28 + 0.004 * (pr.r.profile.hitPower - 70), 0.15, 0.45);
    const pr2 = makeRng('pair', league.leagueId, gameId, pr.r.playerId, pr.b.playerId);
    st.hits = pr2.binomial(pairPress[i], hitShare);
    st.hurries = pairPress[i] - st.hits;
    st.missed = pr2.binomial(st.hits, escape);
  });

  // Blame from tracked events wins for the blockers it names.
  const trackedBlame = (b) => (trackedBlock && trackedBlock[b.playerId]) || null;

  // ---------- run blocking
  const ybc = ctx.run.carries ? ctx.run.yardsBeforeContact / ctx.run.carries : null;
  const ybcMean = calib && calib.ybcMean != null ? calib.ybcMean : 1.9;
  const ybcSd = calib && calib.ybcSd ? calib.ybcSd : 0.9;
  const ybcZ = ybc == null ? 0 : clamp((ybc - ybcMean) / ybcSd, -2.5, 2.5) * (ctx.run.carries / (ctx.run.carries + 8));
  const front = oppCtx.people.filter((x) => FRONT.includes(x.player.position));
  const frontShed = (() => {
    let w = 0;
    let s = 0;
    for (const x of front) {
      const { snaps } = snapCount(oppCtx, x, offPlays);
      const sh = 0.7 * rating(x.player, 'blockShed') + 0.3 * rating(x.player, 'strength');
      w += snaps;
      s += snaps * sh;
    }
    return w ? s / w : 70;
  })();

  // ---------- blocker rows
  const blockerRows = blockers.map((b) => {
    const row = pairs.filter((pr) => pr.b === b);
    const agg = row.reduce((a, pr) => { const st = pairStats.get(pr); return { hits: a.hits + st.hits, hurries: a.hurries + st.hurries, missed: a.missed + st.missed, reps: a.reps + pr.reps, lossExp: a.lossExp + pr.reps * pr.p }; }, { hits: 0, hurries: 0, missed: 0, reps: 0, lossExp: 0 });
    const tb = trackedBlame(b);
    const sacksA = blockerSackTotals.get(b.playerId) || 0;
    const hitsA = tb ? tb.hitsAllowed : agg.hits;
    const hurriesA = tb ? tb.hurriesAllowed : agg.hurries;
    const pressuresA = sacksA + hitsA + hurriesA;
    const pAvg = agg.reps ? agg.lossExp / agg.reps : 0.085;
    const hr = makeRng('hold-v2', league.leagueId, gameId, b.playerId);
    const avgHold = clamp(3.55 - 13 * pAvg + hr.gaussian(0, 0.08), 1.4, 4.2);
    const timeToPressure = pressuresA > 0 ? clamp(avgHold - 0.45 + hr.gaussian(0, 0.12), 1.1, 3.8) : null;
    const pbe = b.passBlockSnaps > 0 ? 100 - ((sacksA + (hitsA + hurriesA) * 0.75) / b.passBlockSnaps) * 100 : null;

    // Run blocking
    const rw = clamp(sigmoid(logit(MODEL.runBase) + (0.55 * (b.profile.run - frontShed)) / 10 + 0.35 * ybcZ + 0.8 * b.form), 0.25, 0.97);
    const runLost = b.runBlockSnaps ? makeRng('runlost', league.leagueId, gameId, b.playerId).binomial(b.runBlockSnaps, 1 - rw) : 0;
    const trackedPancakes = overrides.pancakes && overrides.pancakes[b.playerId];
    const recordedPancakes = oline(b.x).OLINEPANCAKES;
    let pancakes;
    let pancakeSource;
    if (trackedPancakes != null) { pancakes = trackedPancakes; pancakeSource = 'tracked'; }
    else if (league.capabilities.pancakesRecorded && typeof recordedPancakes === 'number') { pancakes = recordedPancakes; pancakeSource = 'recorded'; }
    else {
      const rate = clamp(0.02 + 0.0018 * (b.profile.impact - 70) + 0.012 * ybcZ + 0.02 * (rw - MODEL.runBase), 0.004, 0.07);
      pancakes = makeRng('pancake-v2', league.leagueId, gameId, b.playerId).binomial(b.runBlockSnaps + Math.round(b.passBlockSnaps * 0.25), rate);
      pancakeSource = 'reconstructed';
    }

    // Grades on a 0-99 scale, 60 is an average day, small samples pulled in.
    const weightedPress = b.passBlockSnaps ? (sacksA + 0.8 * hitsA + 0.6 * hurriesA) / b.passBlockSnaps : 0;
    const shrink = (g, n, k) => clamp(60 + (g - 60) * (n / (n + k)), 0, 99);
    const passRaw = b.passBlockSnaps ? clamp(60 + (0.06 - weightedPress) * 600 - sacksA * 3, 0, 99) : null;
    const runRaw = b.runBlockSnaps ? clamp(60 + (rw - MODEL.runBase) * 180 + pancakes * 3, 0, 99) : null;
    const n = b.passBlockSnaps + b.runBlockSnaps;
    const raw = n ? ((passRaw ?? 60) * b.passBlockSnaps + (runRaw ?? 60) * b.runBlockSnaps) / n : 60;
    const grade = shrink(raw, n, 15);
    const passGrade = passRaw == null ? null : shrink(passRaw, b.passBlockSnaps, 10);
    const runGrade = runRaw == null ? null : shrink(runRaw, b.runBlockSnaps, 10);

    // Who he saw most on pass downs.
    const main = row.slice().sort((a, c) => c.reps - a.reps)[0] || null;
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
      nearSacksAllowed: tb ? Math.round(hitsA * escape) : agg.missed,
      cleanPassSnaps: Math.max(0, b.passBlockSnaps - pressuresA),
      expectedPressures: round2(agg.lossExp),
      repLossRate: round2(pAvg * 100),
      pancakes,
      pancakeRate: b.runBlockSnaps ? round2((pancakes / b.runBlockSnaps) * 100) : 0,
      runBlockWinRate: b.runBlockSnaps ? round2(rw * 100) : null,
      runRepsLost: runLost,
      avgTimeHeld: round2(avgHold),
      timeToPressure: timeToPressure == null ? null : round2(timeToPressure),
      passBlockEfficiency: pbe == null ? null : round2(pbe),
      passGrade: passGrade == null ? null : Math.round(passGrade),
      runGrade: runGrade == null ? null : Math.round(runGrade),
      blockGrade: Math.round(grade),
      faced: main ? { playerId: main.r.playerId, name: main.r.name, position: main.r.position, winPct: round2((1 - main.p) * 100) } : null,
      source: {
        snaps: b.snapsRecorded ? 'recorded' : 'reconstructed',
        sacksAllowed: tb ? 'tracked' : hasRecordedBlame ? 'recorded' : sacks ? 'reconstructed' : 'recorded',
        pressures: tb ? 'tracked' : pressureSource,
        pancakes: pancakeSource,
        timing: 'reconstructed',
        run: ybc == null ? 'reconstructed' : 'recorded + reconstructed',
      },
    };
  });

  // ---------- rusher rows
  const rusherRows = rushers.map((r) => {
    const row = pairs.filter((pr) => pr.r === r);
    const agg = row.reduce((a, pr) => { const st = pairStats.get(pr); return { hits: a.hits + st.hits, hurries: a.hurries + st.hurries, missed: a.missed + st.missed, exp: a.exp + pr.reps * pr.p }; }, { hits: 0, hurries: 0, missed: 0, exp: 0 });
    const t = trackedRush && trackedRush[r.playerId];
    const free = freeBy.get(r.playerId) || { hits: 0, hurries: 0, missed: 0 };
    const sk = rusherSacks.get(r.playerId) || 0;
    const hits = t ? t.hits : agg.hits + free.hits;
    const hurries = t ? t.hurries : agg.hurries + free.hurries;
    const missed = t ? t.missedSacks : agg.missed + free.missed;
    const pressures = sk + hits + hurries;
    const beat = {};
    for (const pr of row) {
      const st = pairStats.get(pr);
      const c = st.sacks + st.hits + st.hurries;
      if (c > 0) beat[pr.b.playerId] = (beat[pr.b.playerId] || 0) + c;
    }
    return {
      playerId: r.playerId,
      name: r.name,
      position: r.position,
      snaps: r.snaps,
      passRushSnaps: r.passRushSnaps,
      pressures,
      hurries,
      hits,
      sacks: r.recordedSacks > sk ? r.recordedSacks : sk,
      missedSacks: missed,
      nearSacks: missed,
      expectedPressures: round2(agg.exp),
      unblockedPressures: free.hits + free.hurries,
      winRate: r.passRushSnaps ? round2((pressures / r.passRushSnaps) * 100) : 0,
      beat,
      source: { sacks: 'recorded', pressures: t ? 'tracked' : pressureSource, snaps: r.snapsRecorded ? 'recorded' : 'reconstructed' },
    };
  });

  // ---------- who beat whom, and who gave up each rusher's sacks
  const matchups = [];
  const sackBlame = {};
  for (const pr of pairs) {
    const st = pairStats.get(pr);
    const wins = st.sacks + st.hits + st.hurries;
    if (st.sacks) (sackBlame[pr.r.playerId] ||= []).push({ playerId: pr.b.playerId, name: pr.b.name, position: pr.b.position, count: st.sacks });
    if (!wins) continue;
    matchups.push({ rusherId: pr.r.playerId, rusher: pr.r.name, rusherPos: pr.r.position, blockerId: pr.b.playerId, blocker: pr.b.name, blockerPos: pr.b.position, wins, sacks: st.sacks, reps: Math.round(pr.reps), winPct: round2(pr.p * 100) });
  }
  for (const list of Object.values(sackBlame)) list.sort((a, b) => b.count - a.count);
  matchups.sort((a, b) => b.sacks * 2 + b.wins - (a.sacks * 2 + a.wins));

  blockerRows.sort((a, b) => b.blockGrade - a.blockGrade);
  rusherRows.sort((a, b) => b.pressures - a.pressures || b.sacks - a.sacks);
  const totalHits = rusherRows.reduce((s, r) => s + r.hits, 0);
  const totalHurries = rusherRows.reduce((s, r) => s + r.hurries, 0);
  const teamPressures = sacks + totalHits + totalHurries;
  const olRows = blockerRows.filter((b) => OLINE.includes(b.position));
  const olPB = (() => { let w = 0; let s = 0; for (const b of blockers.filter((x) => OLINE.includes(x.position))) { w += b.passBlockSnaps; s += b.passBlockSnaps * (b.profile.power + b.profile.finesse) / 2; } return w ? s / w : 65; })();
  const rushPR = (() => { let w = 0; let s = 0; for (const r of rushers) { w += r.passRushSnaps; s += r.passRushSnaps * Math.max(r.profile.power, r.profile.finesse); } return w ? s / w : 65; })();
  const qualified = blockerRows.filter((b) => b.passBlockSnaps + b.runBlockSnaps >= Math.min(20, Math.round(offPlays * 0.3)));
  const best = qualified[0] || blockerRows[0] || null;
  const worst = blockerRows.slice().sort((a, b) => b.pressuresAllowed - a.pressuresAllowed || b.sacksAllowed - a.sacksAllowed)[0] || null;
  const runRows = olRows.filter((b) => b.runBlockSnaps > 0);

  return {
    teamId: ctx.teamId,
    summary: {
      dropbacks,
      rushAttempts,
      pressuresAllowed: teamPressures,
      hurriesAllowed: totalHurries,
      hitsAllowed: totalHits,
      sacksAllowed: sacks,
      nearSacksAllowed: rusherRows.reduce((s, r) => s + r.missedSacks, 0),
      pressureRate: dropbacks ? round2((teamPressures / dropbacks) * 100) : 0,
      expectedPressures: round2(expected),
      sackPerPressure: round2(q * 100),
      pancakes: blockerRows.reduce((s, b) => s + b.pancakes, 0),
      yardsBeforeContact: ybc == null ? null : round2(ybc),
      leagueYardsBeforeContact: round2(ybcMean),
      runBlockWinRate: runRows.length ? round2(runRows.reduce((s, b) => s + (b.runBlockWinRate || 0) * b.runBlockSnaps, 0) / Math.max(1, runRows.reduce((s, b) => s + b.runBlockSnaps, 0))) : null,
      olPassBlockRating: Math.round(olPB),
      oppPassRushRating: Math.round(rushPR),
      unblockedPressures: rusherRows.reduce((s, r) => s + (r.unblockedPressures || 0), 0),
      pressureSource,
      bestBlocker: best ? { playerId: best.playerId, name: best.name, position: best.position, grade: best.blockGrade, pressuresAllowed: best.pressuresAllowed, pancakes: best.pancakes } : null,
      mostBeaten: worst,
      model: 'v2',
    },
    blockers: blockerRows,
    passRush: rusherRows, // the OPPONENT's rushers against this offense
    matchups: matchups.slice(0, 16),
    sackBlame,
  };
}

// Stable id for a rusher/blocker pair, used by the matchup predictor.
export function pairKey(rusherId, blockerId) {
  return hashString(`${rusherId}>${blockerId}`).toString(36);
}
