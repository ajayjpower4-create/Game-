/* ------------------------------------------------------------------------
 * NFL Franchise Simulator — the model
 *
 * Pure functions only. No DOM, no fetch, no globals — the browser imports it
 * for the game and the server imports it to sanity-check anything the AI
 * writes. Everything the franchise does (rosters, schedule, practice, game
 * day, contracts, trades, media) can run start to finish with no network.
 * ---------------------------------------------------------------------- */

import {
  TEAMS, TEAM_BY_CODE, DIVISIONS, ROSTER_SHAPE, POSITION_ORDER, POSITION_WEIGHT,
  OFFENSE_POS, DEFENSE_POS, FIRST_NAMES, LAST_NAMES, COLLEGES, INJURY_TYPES,
  PRACTICE_TYPES, POSITION_PAY_SCALE, SALARY_CAP,
} from './data.js';

/* ------------------------------------------------------------------ rng */

export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function rng() {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFrom(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

export function shuffle(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/* -------------------------------------------------------------- rosters */

const JERSEY_RANGES = {
  QB: [1, 19], RB: [20, 49], WR: [1, 19], TE: [80, 89],
  LT: [70, 79], LG: [60, 69], C: [50, 59], RG: [60, 69], RT: [70, 79],
  EDGE: [90, 99], DT: [90, 99], LB: [40, 59], CB: [20, 39], S: [20, 39],
  K: [1, 9], P: [1, 9], LS: [40, 49],
};

// Backups sit this far below the starter tier, by group.
const DEPTH_DROP = {
  QB: [0, 14, 22], RB: [0, 6, 12, 18], WR: [0, 4, 8, 13, 18, 22, 26],
  TE: [0, 8, 14], OL: [0, 12], DL: [0, 5, 10, 16, 21], LB: [0, 6, 12, 17, 21],
  DB: [0, 4, 9, 14, 19], ST: [0],
};

function newName(rng, used) {
  for (let i = 0; i < 60; i += 1) {
    const name = `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
    if (!used.has(name)) { used.add(name); return name; }
  }
  return `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)} Jr.`;
}

export function contractFor(pos, ovr, age, rng) {
  const scale = POSITION_PAY_SCALE[pos] ?? 1;
  const over = Math.max(0, ovr - 62);
  // Money curves hard at the top — a 95 costs many times what an 80 costs.
  const base = (0.7 + ((over / 37) ** 2) * 15) * scale;
  const jitter = 0.85 + (rng ? rng() * 0.35 : 0.17);
  // Nobody plays for less than the league minimum.
  const apy = Math.max(1.15, Math.round(base * jitter * 10) / 10);
  let years = ovr >= 88 ? 5 : ovr >= 80 ? 4 : ovr >= 72 ? 3 : 2;
  if (age >= 31) years = Math.max(1, years - 2);
  else if (age >= 29) years = Math.max(2, years - 1);
  const left = rng ? Math.max(1, randInt(rng, 1, years)) : years;
  return {
    years,
    yearsLeft: left,
    apy,
    guaranteed: Math.round(apy * years * (ovr >= 85 ? 0.62 : ovr >= 75 ? 0.4 : 0.18) * 10) / 10,
  };
}

let uid = 0;
export function resetUid(n = 0) { uid = n; }

export function buildRoster(teamCode, seed) {
  const team = TEAM_BY_CODE[teamCode];
  const rng = makeRng(seed ?? seedFrom(`roster-${teamCode}`));
  const used = new Set();
  const jerseys = new Set();
  const players = [];

  const core = team.roster.map((row) => {
    const [pos, name, ovr, age] = row.split('|');
    return { pos, name, ovr: Number(ovr), age: Number(age) };
  });
  core.forEach((p) => used.add(p.name));

  const takeJersey = (pos) => {
    const [lo, hi] = JERSEY_RANGES[pos] || [1, 99];
    for (let i = 0; i < 120; i += 1) {
      const n = randInt(rng, lo, hi);
      if (!jerseys.has(n)) { jerseys.add(n); return n; }
    }
    for (let n = 1; n < 100; n += 1) if (!jerseys.has(n)) { jerseys.add(n); return n; }
    return 0;
  };

  const make = (pos, name, ovr, age, real) => {
    uid += 1;
    const c = contractFor(pos, ovr, age, rng);
    return {
      id: `p${uid}`,
      name,
      pos,
      ovr: clamp(Math.round(ovr), 50, 99),
      age,
      exp: Math.max(0, age - 22),
      jersey: takeJersey(pos),
      college: pick(rng, COLLEGES),
      real: !!real,
      injury: null,
      status: 'active',
      fatigue: 0,
      sharpness: 55,
      morale: 72,
      reps: 0,
      practiceNotes: 0,
      season: { gp: 0, snaps: 0, pass: 0, rush: 0, rec: 0, td: 0, tackles: 0, sacks: 0, ints: 0 },
      contract: c,
      team: teamCode,
    };
  };

  for (const slot of ROSTER_SHAPE) {
    const drops = DEPTH_DROP[slot.group] || [0, 8, 14, 18, 22];
    const realAtPos = core.filter((p) => p.pos === slot.pos);
    for (let i = 0; i < slot.count; i += 1) {
      const real = realAtPos[i];
      if (real) {
        players.push(make(real.pos, real.name, real.ovr, real.age, true));
      } else {
        // Generated depth hangs off whatever the last real player was worth,
        // but a ceiling per depth slot keeps a star's backup from inheriting
        // his rating — nobody's QB2 is an 84.
        const anchor = realAtPos.length ? realAtPos[realAtPos.length - 1].ovr : 74;
        const drop = drops[Math.min(i, drops.length - 1)] || 20;
        const ceiling = i === 0 ? 80 : i === 1 ? 75 : i === 2 ? 71 : 68;
        const ovr = clamp(Math.min(anchor - drop, ceiling) + randInt(rng, -3, 3), 52, 84);
        const age = randInt(rng, 22, 30);
        players.push(make(slot.pos, newName(rng, used), ovr, age, false));
      }
    }
  }

  // Real players listed beyond the shape (extra TE/QB rows) still make the team.
  const counted = new Set();
  players.forEach((p) => counted.add(p.name));
  core.forEach((p) => {
    if (!counted.has(p.name)) players.push(make(p.pos, p.name, p.ovr, p.age, true));
  });

  players.sort(byDepth);
  return players;
}

export function byDepth(a, b) {
  const pa = POSITION_ORDER.indexOf(a.pos);
  const pb = POSITION_ORDER.indexOf(b.pos);
  if (pa !== pb) return pa - pb;
  return b.ovr - a.ovr;
}

export function isAvailable(p) {
  return p.status === 'active' && (!p.injury || p.injury.weeksOut <= 0);
}

export function depthChart(roster) {
  const chart = {};
  for (const slot of ROSTER_SHAPE) {
    chart[slot.pos] = roster
      .filter((p) => p.pos === slot.pos)
      .sort((a, b) => b.ovr - a.ovr);
  }
  return chart;
}

export function starters(roster, { healthyOnly = true } = {}) {
  const chart = depthChart(roster);
  const out = [];
  for (const slot of ROSTER_SHAPE) {
    const pool = healthyOnly ? chart[slot.pos].filter(isAvailable) : chart[slot.pos];
    const need = slot.pos === 'WR' ? 3 : slot.pos === 'EDGE' || slot.pos === 'DT' ? 2
      : slot.pos === 'LB' ? 2 : slot.pos === 'CB' ? 3 : slot.pos === 'S' ? 2 : 1;
    out.push(...(pool.length ? pool : chart[slot.pos]).slice(0, need));
  }
  return out;
}

/** Team strength on a Madden-ish 0-100 scale, split by side of the ball. */
export function teamStrength(roster, { healthyOnly = true } = {}) {
  const line = starters(roster, { healthyOnly });
  const side = (positions) => {
    let num = 0; let den = 0;
    for (const p of line) {
      if (!positions.includes(p.pos)) continue;
      const w = POSITION_WEIGHT[p.pos] ?? 1;
      const form = ((p.sharpness ?? 55) - 55) * 0.06 - (p.fatigue ?? 0) * 0.05;
      num += (p.ovr + form) * w;
      den += w;
    }
    return den ? num / den : 70;
  };
  const off = side(OFFENSE_POS);
  const def = side(DEFENSE_POS);
  return { off, def, overall: (off + def) / 2 };
}

export function capUsed(roster) {
  return Math.round(roster.reduce((s, p) => s + (p.contract?.apy || 0), 0) * 10) / 10;
}

export function capSpace(roster) {
  return Math.round((SALARY_CAP - capUsed(roster)) * 10) / 10;
}

/* ------------------------------------------------------------- schedule */

const AFC = () => TEAMS.filter((t) => t.conf === 'AFC');
const NFC = () => TEAMS.filter((t) => t.conf === 'NFC');

function divisionTeams(conf, div) {
  return TEAMS.filter((t) => t.conf === conf && t.div === div);
}

/** Deterministic "last year's finish" order inside a division. */
function divisionOrder(conf, div, ratings) {
  return divisionTeams(conf, div)
    .slice()
    .sort((a, b) => (ratings[b.code] ?? 70) - (ratings[a.code] ?? 70))
    .map((t) => t.code);
}

const INTRA_PAIRINGS = [
  [['East', 'North'], ['South', 'West']],
  [['East', 'South'], ['North', 'West']],
  [['East', 'West'], ['North', 'South']],
];

/**
 * The 272-game matchup set, built on the real NFL formula:
 * 6 divisional, 4 vs one division in conference, 4 vs one division out of
 * conference, 2 same-place finishers in conference, 1 out of conference.
 */
export function buildMatchups(year, ratings) {
  const games = [];
  const seen = new Set();
  const add = (home, away) => {
    const key = `${home}@${away}`;
    if (seen.has(key)) return;
    seen.add(key);
    games.push({ home, away });
  };

  const order = {};
  for (const conf of ['AFC', 'NFC']) {
    for (const div of DIVISIONS) order[`${conf}-${div}`] = divisionOrder(conf, div, ratings);
  }
  const rankOf = (code) => {
    const t = TEAM_BY_CODE[code];
    return order[`${t.conf}-${t.div}`].indexOf(code);
  };

  // 1. Division games, home and away.
  for (const conf of ['AFC', 'NFC']) {
    for (const div of DIVISIONS) {
      const ts = divisionTeams(conf, div).map((t) => t.code);
      for (let i = 0; i < ts.length; i += 1) {
        for (let j = i + 1; j < ts.length; j += 1) {
          add(ts[i], ts[j]);
          add(ts[j], ts[i]);
        }
      }
    }
  }

  // 2. Intra-conference division block (4 games).
  const intra = INTRA_PAIRINGS[year % 3];
  const intraPartner = {};
  for (const [d1, d2] of intra) { intraPartner[d1] = d2; intraPartner[d2] = d1; }
  for (const conf of ['AFC', 'NFC']) {
    for (const [d1, d2] of intra) {
      const a = order[`${conf}-${d1}`];
      const b = order[`${conf}-${d2}`];
      a.forEach((home, i) => b.forEach((away, j) => {
        // Antisymmetric home rule: 2 home / 2 away for everybody.
        if ((i + j) % 2 === 0) add(home, away); else add(away, home);
      }));
    }
  }

  // 3. Inter-conference division block (4 games).
  const shift = year % 4;
  const interPartner = {};
  DIVISIONS.forEach((d, i) => {
    const partner = DIVISIONS[(i + shift) % 4];
    interPartner[d] = partner;
    const a = order[`AFC-${d}`];
    const b = order[`NFC-${partner}`];
    a.forEach((home, i2) => b.forEach((away, j) => {
      if ((i2 + j) % 2 === 0) add(home, away); else add(away, home);
    }));
  });

  // 4. Same-place finishers: the two in-conference divisions not already played.
  for (const conf of ['AFC', 'NFC']) {
    DIVISIONS.forEach((d) => {
      const skip = new Set([d, intraPartner[d]]);
      DIVISIONS.filter((o) => !skip.has(o)).forEach((other) => {
        if (DIVISIONS.indexOf(other) < DIVISIONS.indexOf(d)) return; // once per pair
        const a = order[`${conf}-${d}`];
        const b = order[`${conf}-${other}`];
        a.forEach((code, rank) => {
          const opp = b[rank];
          const homeFirst = (rank + year + DIVISIONS.indexOf(d)) % 2 === 0;
          if (homeFirst) add(code, opp); else add(opp, code);
        });
      });
    });
  }

  // 5. The 17th game: cross-conference same-place finisher, different rotation.
  DIVISIONS.forEach((d, i) => {
    const partner = DIVISIONS[(i + shift + 1) % 4];
    const a = order[`AFC-${d}`];
    const b = order[`NFC-${partner}`];
    a.forEach((code, rank) => {
      const opp = b[rank];
      const afcHome = (year + rank) % 2 === 0;
      if (afcHome) add(code, opp); else add(opp, code);
    });
  });

  return balanceHomeGames(games);
}

/** Nudge every team toward 8 or 9 home dates without duplicating a fixture. */
function balanceHomeGames(games) {
  const count = {};
  TEAMS.forEach((t) => { count[t.code] = 0; });
  games.forEach((g) => { count[g.home] += 1; });
  const key = (g) => `${g.home}@${g.away}`;
  const existing = new Set(games.map(key));

  for (let pass = 0; pass < 20; pass += 1) {
    let changed = false;
    for (const g of games) {
      if (count[g.home] - count[g.away] < 2) continue;
      const flipped = `${g.away}@${g.home}`;
      if (existing.has(flipped)) continue;
      existing.delete(key(g));
      count[g.home] -= 1;
      count[g.away] += 1;
      const h = g.home;
      g.home = g.away;
      g.away = h;
      existing.add(key(g));
      changed = true;
    }
    if (!changed) break;
  }
  return games;
}

/** Assign a matchup set to 18 weeks with one bye each, weeks 5-14. */
export function assignWeeks(games, rngSeed, weeks = 18) {
  const codes = TEAMS.map((t) => t.code);
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const rng = makeRng(rngSeed + attempt * 7919);
    const byeWindow = attempt < 360 ? [5, 14] : [3, 16];
    const byeWeeks = [];
    const span = byeWindow[1] - byeWindow[0] + 1;
    const weekPool = shuffle(rng, Array.from({ length: span }, (_, i) => byeWindow[0] + i));
    const chosen = weekPool.slice(0, 8).sort((a, b) => a - b);
    const teamsShuffled = shuffle(rng, codes);
    const byeWeek = {};
    chosen.forEach((w, i) => {
      teamsShuffled.slice(i * 4, i * 4 + 4).forEach((code) => { byeWeek[code] = w; });
      byeWeeks.push(w);
    });

    const capacity = Array.from({ length: weeks + 1 }, () => 16);
    chosen.forEach((w) => { capacity[w] = 14; });

    const busy = Array.from({ length: weeks + 1 }, () => new Set());
    const placed = new Array(games.length).fill(-1);
    const idx = shuffle(rng, games.map((_, i) => i));

    const domain = (gi) => {
      const g = games[gi];
      const out = [];
      for (let w = 1; w <= weeks; w += 1) {
        if (capacity[w] <= 0) continue;
        if (byeWeek[g.home] === w || byeWeek[g.away] === w) continue;
        if (busy[w].has(g.home) || busy[w].has(g.away)) continue;
        out.push(w);
      }
      return out;
    };

    // Bail out of a bad bye draw quickly — a fresh draw is cheaper than a
    // deep backtrack through one that does not want to solve.
    let nodes = 0;
    const budget = 4000 + attempt * 250;
    const solve = (remaining) => {
      if (!remaining.length) return true;
      if (nodes > budget) return false;
      nodes += 1;
      let best = -1; let bestDom = null;
      for (const gi of remaining) {
        const d = domain(gi);
        if (d.length === 0) return false;
        if (!bestDom || d.length < bestDom.length) { best = gi; bestDom = d; }
        if (d.length === 1) break;
      }
      const rest = remaining.filter((g) => g !== best);
      for (const w of shuffle(rng, bestDom)) {
        const g = games[best];
        busy[w].add(g.home); busy[w].add(g.away); capacity[w] -= 1; placed[best] = w;
        if (solve(rest)) return true;
        busy[w].delete(g.home); busy[w].delete(g.away); capacity[w] += 1; placed[best] = -1;
      }
      return false;
    };

    if (solve(idx)) {
      return {
        weeks: Array.from({ length: weeks }, (_, i) => games
          .map((g, gi) => (placed[gi] === i + 1 ? { ...g } : null))
          .filter(Boolean)),
        byeWeek,
      };
    }
  }
  return null;
}

/** Preseason: three weeks, everybody plays, nobody plays the same team twice. */
export function buildPreseason(rngSeed, weeks = 3) {
  const codes = TEAMS.map((t) => t.code);
  const rng = makeRng(rngSeed);
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const met = new Set();
    const out = [];
    let ok = true;
    for (let w = 0; w < weeks && ok; w += 1) {
      const pool = shuffle(rng, codes);
      const wk = [];
      while (pool.length) {
        const a = pool.shift();
        let found = -1;
        for (let i = 0; i < pool.length; i += 1) {
          const key = [a, pool[i]].sort().join('-');
          if (!met.has(key)) { found = i; break; }
        }
        if (found < 0) { ok = false; break; }
        const b = pool.splice(found, 1)[0];
        met.add([a, b].sort().join('-'));
        wk.push(w % 2 === 0 ? { home: a, away: b } : { home: b, away: a });
      }
      out.push(wk);
    }
    if (ok) return out;
  }
  return null;
}

export function buildSchedule({ year, seed, ratings }) {
  const matchups = buildMatchups(year, ratings);
  const assigned = assignWeeks(matchups, seed);
  const preseason = buildPreseason(seed + 13);
  if (!assigned || !preseason) return null;
  return {
    year,
    seed,
    preseason,
    regular: assigned.weeks,
    byeWeek: assigned.byeWeek,
  };
}

export function validateSchedule(sched) {
  const problems = [];
  const counts = {};
  const seenWeek = {};
  TEAMS.forEach((t) => { counts[t.code] = 0; seenWeek[t.code] = new Set(); });
  sched.regular.forEach((wk, i) => {
    const week = i + 1;
    const teams = new Set();
    wk.forEach((g) => {
      [g.home, g.away].forEach((c) => {
        if (teams.has(c)) problems.push(`${c} double-booked in week ${week}`);
        teams.add(c);
        counts[c] += 1;
        seenWeek[c].add(week);
      });
    });
  });
  Object.entries(counts).forEach(([code, n]) => {
    if (n !== 17) problems.push(`${code} has ${n} games`);
  });
  return problems;
}

export function teamSchedule(sched, code) {
  const rows = [];
  sched.preseason.forEach((wk, i) => {
    const g = wk.find((m) => m.home === code || m.away === code);
    if (g) rows.push({ phase: 'preseason', week: i + 1, ...g, opp: g.home === code ? g.away : g.home, home: g.home === code });
  });
  sched.regular.forEach((wk, i) => {
    const g = wk.find((m) => m.home === code || m.away === code);
    if (g) rows.push({ phase: 'regular', week: i + 1, opp: g.home === code ? g.away : g.home, home: g.home === code });
    else rows.push({ phase: 'regular', week: i + 1, opp: null, home: false, bye: true });
  });
  return rows;
}

export function gameFor(sched, phase, week, code) {
  const list = phase === 'preseason' ? sched.preseason : sched.regular;
  const wk = list[week - 1] || [];
  const g = wk.find((m) => m.home === code || m.away === code);
  if (!g) return null;
  return { ...g, opp: g.home === code ? g.away : g.home, isHome: g.home === code };
}

/* --------------------------------------------------------------- ratings */

/** Baseline strength for every team, used for schedule seeding and AI games. */
export function leagueRatings(rosters) {
  const out = {};
  TEAMS.forEach((t) => {
    const r = rosters[t.code];
    out[t.code] = r ? teamStrength(r, { healthyOnly: false }).overall : 70;
  });
  return out;
}

/* -------------------------------------------------------------- game sim */

const SCORE_STEPS = [0, 3, 6, 7, 10, 13, 14, 16, 17, 20, 21, 23, 24, 27, 28, 30, 31, 34, 35, 38, 41, 45];

function scoreFromMargin(rng, quality, isPreseason) {
  const base = isPreseason ? 17 : 22.5;
  // Wide variance on purpose: the best team in the league still loses six.
  const raw = base + (quality - 74) * 0.8 + (rng() - 0.5) * 26;
  const target = clamp(raw, 0, 52);
  let best = SCORE_STEPS[0];
  let bestGap = Infinity;
  for (const s of SCORE_STEPS) {
    const gap = Math.abs(s - target) + rng() * 2.2;
    if (gap < bestGap) { bestGap = gap; best = s; }
  }
  return best;
}

/** Sim a game between two rosters. Used for every game the player isn't in. */
export function simGame(homeRoster, awayRoster, { rng, preseason = false, homeField = 2.2 }) {
  const h = teamStrength(homeRoster);
  const a = teamStrength(awayRoster);
  // Quality sits around 74 for an average offense against an average defense.
  const hQuality = 74 + (h.off - a.def) * 0.95 + homeField;
  const aQuality = 74 + (a.off - h.def) * 0.95;
  let hs = scoreFromMargin(rng, hQuality, preseason);
  let as = scoreFromMargin(rng, aQuality, preseason);
  if (hs === as && rng() < 0.88) {
    // Overtime: somebody usually wins it.
    if (rng() < 0.52 + (h.overall - a.overall) * 0.01) hs += rng() < 0.55 ? 3 : 6;
    else as += rng() < 0.55 ? 3 : 6;
  }
  return { homeScore: hs, awayScore: as };
}

export function simWeek(state, phase, week, { skipTeam }) {
  const list = phase === 'preseason' ? state.schedule.preseason : state.schedule.regular;
  const wk = list[week - 1] || [];
  const rng = makeRng(seedFrom(`${state.schedule.seed}-${phase}-${week}`));
  const results = [];
  for (const g of wk) {
    if (g.home === skipTeam || g.away === skipTeam) continue;
    const homeRoster = rosterFor(state, g.home);
    const awayRoster = rosterFor(state, g.away);
    const { homeScore, awayScore } = simGame(homeRoster, awayRoster, { rng, preseason: phase === 'preseason' });
    results.push({ ...g, homeScore, awayScore, phase, week, simmed: true });
  }
  return results;
}

/** The player's roster is live; every other team uses its generated baseline. */
export function rosterFor(state, code) {
  if (code === state.teamId) return state.roster;
  if (!state.aiRosters) state.aiRosters = {};
  if (!state.aiRosters[code]) state.aiRosters[code] = buildRoster(code, seedFrom(`roster-${code}-${state.schedule?.seed ?? 1}`));
  return state.aiRosters[code];
}

/* ------------------------------------------------------------- standings */

export function blankRecord() {
  return { w: 0, l: 0, t: 0, pf: 0, pa: 0, divW: 0, divL: 0, streak: 0 };
}

export function applyResult(standings, result) {
  if (result.phase !== 'regular') return standings;
  const h = standings[result.home] || (standings[result.home] = blankRecord());
  const a = standings[result.away] || (standings[result.away] = blankRecord());
  h.pf += result.homeScore; h.pa += result.awayScore;
  a.pf += result.awayScore; a.pa += result.homeScore;
  const sameDiv = TEAM_BY_CODE[result.home].conf === TEAM_BY_CODE[result.away].conf
    && TEAM_BY_CODE[result.home].div === TEAM_BY_CODE[result.away].div;
  if (result.homeScore > result.awayScore) {
    h.w += 1; a.l += 1;
    h.streak = h.streak >= 0 ? h.streak + 1 : 1;
    a.streak = a.streak <= 0 ? a.streak - 1 : -1;
    if (sameDiv) { h.divW += 1; a.divL += 1; }
  } else if (result.awayScore > result.homeScore) {
    a.w += 1; h.l += 1;
    a.streak = a.streak >= 0 ? a.streak + 1 : 1;
    h.streak = h.streak <= 0 ? h.streak - 1 : -1;
    if (sameDiv) { a.divW += 1; h.divL += 1; }
  } else {
    h.t += 1; a.t += 1; h.streak = 0; a.streak = 0;
  }
  return standings;
}

export function winPct(rec) {
  const g = rec.w + rec.l + rec.t;
  return g ? (rec.w + rec.t * 0.5) / g : 0;
}

export function sortedDivision(standings, conf, div) {
  return divisionTeams(conf, div)
    .map((t) => ({ team: t, rec: standings[t.code] || blankRecord() }))
    .sort((x, y) => winPct(y.rec) - winPct(x.rec)
      || (y.rec.divW - y.rec.divL) - (x.rec.divW - x.rec.divL)
      || (y.rec.pf - y.rec.pa) - (x.rec.pf - x.rec.pa));
}

export function conferenceSeeds(standings, conf) {
  const winners = DIVISIONS.map((d) => sortedDivision(standings, conf, d)[0]);
  winners.sort((x, y) => winPct(y.rec) - winPct(x.rec) || (y.rec.pf - y.rec.pa) - (x.rec.pf - x.rec.pa));
  const rest = TEAMS.filter((t) => t.conf === conf && !winners.some((w) => w.team.code === t.code))
    .map((t) => ({ team: t, rec: standings[t.code] || blankRecord() }))
    .sort((x, y) => winPct(y.rec) - winPct(x.rec) || (y.rec.pf - y.rec.pa) - (x.rec.pf - x.rec.pa));
  return [...winners, ...rest.slice(0, 3)];
}

/* -------------------------------------------------------------- practice */

export function rollInjury(rng, severityBias = 0) {
  const roll = rng();
  const pool = roll < 0.04 + severityBias * 0.02
    ? INJURY_TYPES.filter((t) => t.max >= 20)
    : INJURY_TYPES.filter((t) => t.max < 20);
  const type = pick(rng, pool.length ? pool : INJURY_TYPES);
  return { type: type.label, weeksOut: randInt(rng, type.min, type.max) };
}

/**
 * Run one practice. Injuries / absences / big plays are whatever the user
 * typed in — this only applies the consequences.
 */
export function applyPractice(state, input) {
  const type = PRACTICE_TYPES.find((t) => t.id === input.typeId) || PRACTICE_TYPES[0];
  const rng = makeRng(seedFrom(`prac-${state.teamId}-${state.phase}-${state.week}-${state.day}-${input.typeId}`));
  const log = [];
  const absent = new Set(input.absences.map((a) => a.playerId));
  const hurt = new Map(input.injuries.map((i) => [i.playerId, i]));

  for (const p of state.roster) {
    if (!isAvailable(p)) {
      // Rehab work: sitting out heals.
      if (p.injury) {
        p.injury.daysHealed = (p.injury.daysHealed || 0) + 1 + (type.heal || 0);
        if (p.injury.daysHealed >= 7) {
          p.injury.daysHealed = 0;
          p.injury.weeksOut = Math.max(0, p.injury.weeksOut - 1);
          if (p.injury.weeksOut === 0) {
            log.push(`${p.pos} ${p.name} was cleared and returned to practice.`);
            p.injury = null;
            p.sharpness = clamp(p.sharpness - 8, 20, 99);
          }
        }
      }
      continue;
    }
    if (absent.has(p.id)) {
      p.morale = clamp(p.morale - 3, 0, 100);
      p.sharpness = clamp(p.sharpness - 2.5, 20, 99);
      continue;
    }
    const stEmph = type.stEmphasis && ['K', 'P', 'LS'].includes(p.pos);
    const gain = type.sharpness * (stEmph ? 1.8 : 1) * (0.85 + rng() * 0.4);
    p.sharpness = clamp(p.sharpness + gain, 20, 99);
    p.fatigue = clamp(p.fatigue + type.fatigue * (0.8 + rng() * 0.5), 0, 100);
    p.morale = clamp(p.morale + (type.chemistry || 0) * 0.6 - (p.fatigue > 70 ? 1.5 : 0), 0, 100);
    p.reps += type.pads ? 2 : 1;
    // Young players actually develop when the reps are real.
    if (type.develop && p.age <= 25 && rng() < 0.05 * type.develop) {
      p.ovr = clamp(p.ovr + 1, 50, 99);
      log.push(`${p.pos} ${p.name} took a step — overall up to ${p.ovr}.`);
    }
  }

  for (const [id, inj] of hurt) {
    const p = state.roster.find((x) => x.id === id);
    if (!p) continue;
    p.injury = { type: inj.type, weeksOut: inj.weeksOut, when: `${state.phase} wk ${state.week} day ${state.day}`, daysHealed: 0, source: 'practice' };
    p.status = inj.weeksOut >= 12 ? 'ir' : 'active';
    p.morale = clamp(p.morale - 6, 0, 100);
    log.push(`${p.pos} ${p.name} — ${inj.type}, out ${inj.weeksOut} week${inj.weeksOut === 1 ? '' : 's'}.`);
  }

  for (const a of input.absences) {
    const p = state.roster.find((x) => x.id === a.playerId);
    if (p) log.push(`${p.pos} ${p.name} did not practice — ${a.reason}.`);
  }

  for (const b of input.bigPlays) {
    const p = b.playerId ? state.roster.find((x) => x.id === b.playerId) : null;
    if (p) {
      p.morale = clamp(p.morale + (b.good ? 4 : -4), 0, 100);
      p.sharpness = clamp(p.sharpness + (b.good ? 2.5 : -2), 20, 99);
      p.practiceNotes += 1;
    }
    log.push(b.text);
  }

  return { type, log };
}

/* ------------------------------------------------------------- game day */

const YARD_SPLIT = { WR: 0.46, TE: 0.19, RB: 0.21, other: 0.14 };

/** Build a plausible box score around the score the user typed in. */
export function generateBoxScore(state, { lineup, teamScore, oppScore, scheme, opp, isHome, phase, week }) {
  const rng = makeRng(seedFrom(`box-${state.teamId}-${phase}-${week}-${teamScore}-${oppScore}`));
  const active = lineup.filter((p) => isAvailable(p));
  const chart = depthChart(active);
  const pickTop = (pos, n) => (chart[pos] || []).slice(0, n);

  const qb = pickTop('QB', 1)[0];
  const rbs = pickTop('RB', 3);
  const wrs = pickTop('WR', 4);
  const tes = pickTop('TE', 2);

  const pass = scheme === 'air' ? 1.35 : scheme === 'ground' ? 0.65 : scheme === 'vertical' ? 1.15 : 1;
  const totalPass = Math.round((190 + teamScore * 6.2 + rng() * 90) * pass);
  const totalRush = Math.round((70 + teamScore * 2.4 + rng() * 70) * (scheme === 'ground' ? 1.7 : 1));
  const tds = Math.max(0, Math.round((teamScore - (teamScore % 7 === 3 ? 3 : 0)) / 7));

  const lines = [];
  if (qb) {
    const att = Math.round(totalPass / (6.6 + rng() * 1.6));
    const cmp = Math.round(att * (0.56 + (qb.ovr - 70) * 0.004 + rng() * 0.08));
    lines.push({
      id: qb.id, name: qb.name, pos: 'QB',
      line: `${cmp}/${att}, ${totalPass} yds, ${Math.max(0, Math.round(tds * 0.62))} TD, ${rng() < 0.42 ? 1 : 0} INT`,
      pass: totalPass, td: Math.max(0, Math.round(tds * 0.62)),
    });
  }
  let rushLeft = totalRush;
  rbs.forEach((rb, i) => {
    const share = i === 0 ? 0.62 : i === 1 ? 0.26 : 0.12;
    const yds = Math.round(rushLeft * share);
    const carries = Math.max(1, Math.round(yds / (3.4 + rng() * 2)));
    lines.push({ id: rb.id, name: rb.name, pos: 'RB', line: `${carries} car, ${yds} yds${rng() < 0.3 ? ', 1 TD' : ''}`, rush: yds });
  });
  rushLeft = 0;
  const recPool = [...wrs.map((p) => [p, YARD_SPLIT.WR / wrs.length]), ...tes.map((p) => [p, YARD_SPLIT.TE / tes.length]), ...rbs.slice(0, 2).map((p) => [p, YARD_SPLIT.RB / 2])];
  const norm = recPool.reduce((s, [, w]) => s + w, 0) || 1;
  recPool.forEach(([p, w]) => {
    const yds = Math.round(totalPass * (w / norm) * (0.75 + rng() * 0.5));
    if (yds < 8) return;
    const rec = Math.max(1, Math.round(yds / (9 + rng() * 6)));
    lines.push({ id: p.id, name: p.name, pos: p.pos, line: `${rec} rec, ${yds} yds`, rec: yds });
  });

  const defenders = [...pickTop('LB', 2), ...pickTop('S', 2), ...pickTop('CB', 2), ...pickTop('EDGE', 2), ...pickTop('DT', 1)];
  const defLines = defenders.map((d) => {
    const tackles = randInt(rng, 2, ['LB', 'S'].includes(d.pos) ? 11 : 7);
    const sacks = ['EDGE', 'DT'].includes(d.pos) && rng() < 0.42 ? (rng() < 0.3 ? 2 : 1) : 0;
    const ints = ['CB', 'S'].includes(d.pos) && rng() < 0.14 ? 1 : 0;
    const bits = [`${tackles} tkl`];
    if (sacks) bits.push(`${sacks} sack${sacks > 1 ? 's' : ''}`);
    if (ints) bits.push('1 INT');
    return { id: d.id, name: d.name, pos: d.pos, line: bits.join(', '), tackles, sacks, ints };
  });

  return { offense: lines, defense: defLines, totalPass, totalRush };
}

export function applyGameToPlayers(state, { lineup, box, injuries, won }) {
  const active = new Set(lineup.map((p) => p.id));
  for (const p of state.roster) {
    if (!active.has(p.id)) continue;
    p.season.gp += 1;
    p.fatigue = clamp(p.fatigue + 14, 0, 100);
    p.sharpness = clamp(p.sharpness + 2, 20, 99);
    p.morale = clamp(p.morale + (won ? 3 : -2), 0, 100);
  }
  for (const line of box.offense) {
    const p = state.roster.find((x) => x.id === line.id);
    if (!p) continue;
    p.season.pass += line.pass || 0;
    p.season.rush += line.rush || 0;
    p.season.rec += line.rec || 0;
    p.season.td += line.td || 0;
  }
  for (const line of box.defense) {
    const p = state.roster.find((x) => x.id === line.id);
    if (!p) continue;
    p.season.tackles += line.tackles || 0;
    p.season.sacks += line.sacks || 0;
    p.season.ints += line.ints || 0;
  }
  for (const inj of injuries) {
    const p = state.roster.find((x) => x.id === inj.playerId);
    if (!p) continue;
    p.injury = { type: inj.type, weeksOut: inj.weeksOut, when: `${state.phase} wk ${state.week}`, daysHealed: 0, source: 'game' };
    p.status = inj.weeksOut >= 12 ? 'ir' : 'active';
    p.morale = clamp(p.morale - 5, 0, 100);
  }
}

/** Weekly tick: injuries heal, legs come back, nobody stays sharp for free. */
export function advanceWeekHealth(state) {
  const returned = [];
  for (const p of state.roster) {
    p.fatigue = clamp(p.fatigue - 12, 0, 100);
    p.sharpness = clamp(p.sharpness - 1.5, 20, 99);
    if (p.injury) {
      p.injury.weeksOut = Math.max(0, p.injury.weeksOut - 1);
      p.injury.daysHealed = 0;
      if (p.injury.weeksOut === 0) {
        returned.push(p);
        p.injury = null;
        if (p.status === 'ir') p.status = 'active';
      }
    }
  }
  return returned;
}

/* ---------------------------------------------------------------- trades */

export function tradeValue(p) {
  const prime = p.age <= 26 ? 1.18 : p.age <= 29 ? 1.0 : p.age <= 32 ? 0.72 : 0.45;
  const base = ((p.ovr - 55) ** 2.1) / 22;
  const posMult = { QB: 1.9, EDGE: 1.35, CB: 1.3, WR: 1.25, LT: 1.25, DT: 1.15, S: 0.95, LB: 0.95, RB: 0.8, TE: 0.9, K: 0.35, P: 0.25, LS: 0.15 };
  const inj = p.injury ? Math.max(0.25, 1 - p.injury.weeksOut * 0.06) : 1;
  return Math.round(base * prime * (posMult[p.pos] ?? 1) * inj * 10) / 10;
}

export const PICK_VALUE = { 1: 34, 2: 18, 3: 10, 4: 6, 5: 3.5, 6: 2, 7: 1 };

export function pickLabel(pick) {
  const r = pick.round;
  const suffix = r === 1 ? 'st' : r === 2 ? 'nd' : r === 3 ? 'rd' : 'th';
  return `${pick.year} ${r}${suffix}`;
}

export function defaultPicks(year) {
  const out = [];
  for (let y = year; y < year + 2; y += 1) {
    for (let r = 1; r <= 7; r += 1) out.push({ id: `pk-${y}-${r}`, year: y, round: r });
  }
  return out;
}

export function evaluateTrade({ giving, getting }) {
  const g1 = giving.reduce((s, x) => s + x.value, 0);
  const g2 = getting.reduce((s, x) => s + x.value, 0);
  const diff = g2 - g1;
  const pct = g1 + g2 === 0 ? 0 : diff / Math.max(1, (g1 + g2) / 2);
  let verdict;
  if (pct > 0.35) verdict = 'They hang up. You are asking for far too much.';
  else if (pct > 0.12) verdict = 'They push back — you would need to add to this.';
  else if (pct > -0.12) verdict = 'Fair. The other GM takes this call.';
  else if (pct > -0.35) verdict = 'They accept quickly. You paid over the odds.';
  else verdict = 'They accept before you finish the sentence. That is a fleecing — theirs.';
  return { give: Math.round(g1 * 10) / 10, get: Math.round(g2 * 10) / 10, accepted: pct <= 0.12, verdict };
}

/* ----------------------------------------------------------- local media */

const HEADLINE_WIN = [
  '{team} handle {opp}, {ts}-{os}',
  '{team} take care of business in {ts}-{os} win over {opp}',
  '{star} leads {team} past {opp}',
  'Statement game: {team} {ts}, {opp} {os}',
];
const HEADLINE_LOSS = [
  '{opp} beat {team} {os}-{ts}',
  '{team} fall to {opp}, questions follow',
  'Another one gets away: {opp} {os}, {team} {ts}',
  '{team} flat in {os}-{ts} loss to {opp}',
];
const COLUMN_WIN = [
  'The offense finally looked like the version the coaching staff has been describing since the spring.',
  'It was not always pretty, but the {team} took the ball away twice and never gave the game back.',
  'Three straight scoring drives in the middle of the game decided this one, and the sideline knew it.',
];
const COLUMN_LOSS = [
  'The third-down defense has been an issue for weeks and it cost them again here.',
  'You can survive one of those drops. You cannot survive four.',
  'The staff will say the plan was fine. The tape says the plan asked too much of the interior line.',
];
const TAKES = [
  'Radio row is already asking whether the {team} are contenders or pretenders.',
  'A national panel spent six minutes arguing about the {team} playcalling and reached no conclusion whatsoever.',
  'One anonymous rival scout, on the {team}: "They are exactly who their record says they are."',
  'The beat is reporting the locker room is fine. The locker room always says the locker room is fine.',
];

export function localMedia(context) {
  const rng = makeRng(seedFrom(JSON.stringify(context).slice(0, 400)));
  const items = [];
  const team = context.teamName;
  const fill = (s) => s
    .replaceAll('{team}', team)
    .replaceAll('{opp}', context.opp || 'the visitors')
    .replaceAll('{ts}', context.teamScore ?? '')
    .replaceAll('{os}', context.oppScore ?? '')
    .replaceAll('{star}', context.star || 'the offense');

  if (context.lastResult) {
    const won = context.lastResult.won;
    items.push({
      outlet: 'ESPN',
      kind: 'headline',
      headline: fill(pick(rng, won ? HEADLINE_WIN : HEADLINE_LOSS)),
      body: fill(pick(rng, won ? COLUMN_WIN : COLUMN_LOSS)),
    });
    items.push({
      outlet: 'The Athletic',
      kind: 'column',
      headline: `What the ${team} learned in week ${context.week}`,
      body: fill(pick(rng, won ? COLUMN_WIN : COLUMN_LOSS)),
    });
  }
  if (context.practice) {
    items.push({
      outlet: 'Local Beat Writer',
      kind: 'practice report',
      headline: `Practice report: ${context.practice.type}`,
      body: context.practice.notes?.length
        ? context.practice.notes.slice(0, 3).join(' ')
        : `${team} went ${context.practice.type.toLowerCase()} today. Nothing new on the injury front.`,
    });
  }
  if (context.injuries?.length) {
    items.push({
      outlet: 'NFL Network',
      kind: 'injury',
      headline: `${team} injury update`,
      body: context.injuries.slice(0, 4).map((i) => `${i.name} (${i.type}) is out ${i.weeksOut} week${i.weeksOut === 1 ? '' : 's'}.`).join(' '),
    });
  }
  items.push({ outlet: 'Sports Radio', kind: 'hot take', headline: 'Around the league', body: fill(pick(rng, TAKES)) });
  return items;
}

/** Guard rails for anything the AI returns before it reaches the feed. */
export function sanitizeMediaItems(raw, limit = 8) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, limit).map((item) => ({
    outlet: String(item?.outlet || 'League Media').slice(0, 60),
    kind: String(item?.kind || 'report').slice(0, 40),
    headline: String(item?.headline || '').slice(0, 200),
    body: String(item?.body || '').slice(0, 1200),
  })).filter((i) => i.headline || i.body);
}

export const SIM_VERSION = 1;
