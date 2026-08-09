// The local election model. Pure functions only — imported by the browser and
// by the Node server, and used both as the offline simulator and as the source
// of state-by-state margins when Opus returns a national result.

import {
  STATES, STATE_BY_CODE, STATE_CODES, THEME_BY_ID, EV_TO_WIN, daysBetween,
} from './data.js';

/* ---------------------------------------------------------------- helpers */

function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

// Small, deterministic PRNG so the same campaign always produces the same
// election. Re-running a save never silently changes history.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ------------------------------------------------------- candidate ratings */

// Custom candidates get their numbers inferred from what the player wrote
// about them, so a well-drawn nobody can still be a real threat.
const POSITIVE_WORDS = ['popular', 'beloved', 'famous', 'charismatic', 'billionaire', 'viral', 'legend', 'hero', 'star', 'genius', 'war hero', 'veteran', 'doctor', 'inspiring'];
const RIGHT_WORDS = ['conservative', 'republican', 'traditional', 'patriot', 'christian', 'rural', 'gun', 'border', 'libertarian', 'nationalist', 'right-wing'];
const LEFT_WORDS = ['progressive', 'liberal', 'democrat', 'socialist', 'activist', 'green', 'union', 'urban', 'left-wing', 'reformer'];

function countWords(text, words) {
  const low = (text || '').toLowerCase();
  return words.reduce((n, w) => (low.includes(w) ? n + 1 : n), 0);
}

export function candidateRatings(cand) {
  const seed = hash32(`${cand.name}|${cand.party}`);
  const jitter = ((seed % 1000) / 1000 - 0.5) * 0.12;

  if (cand.famous) {
    return {
      star: clamp((cand.star ?? 70) / 100, 0.2, 1),
      axis: clamp((cand.axis ?? 0) + jitter * 0.5, -1, 1),
    };
  }

  const desc = cand.description || '';
  const lengthBonus = clamp(desc.trim().split(/\s+/).filter(Boolean).length / 120, 0, 1) * 0.22;
  const star = clamp(0.32 + lengthBonus + countWords(desc, POSITIVE_WORDS) * 0.035 + jitter, 0.15, 0.95);
  const axis = clamp(
    (countWords(desc, LEFT_WORDS) - countWords(desc, RIGHT_WORDS)) * 0.22 + jitter,
    -1, 1,
  );
  return { star, axis };
}

// Where the candidate ends up once their rally message is taken into account:
// themes drag their public image toward whatever they keep talking about.
export function effectiveAxis(cand) {
  const base = candidateRatings(cand).axis;
  const themes = (cand.themes || []).map((id) => THEME_BY_ID[id]).filter(Boolean);
  if (!themes.length) return base;
  const themeAxis = themes.reduce((n, t) => n + t.axis, 0) / themes.length;
  return clamp(base * 0.55 + themeAxis * 0.45, -1, 1);
}

// How much a message lands: length, specificity and theme reach all help.
export function messageStrength(cand) {
  const msg = `${cand.slogan || ''} ${cand.message || ''}`.trim();
  const words = msg.split(/\s+/).filter(Boolean).length;
  const themes = (cand.themes || []).map((id) => THEME_BY_ID[id]).filter(Boolean);
  const reach = themes.length
    ? themes.reduce((n, t) => n + t.reach, 0) / themes.length
    : 0.45;
  const focus = themes.length === 0 ? 0.5 : themes.length <= 3 ? 1 : 0.85; // scattered messages land softer
  return clamp((0.35 + clamp(words / 60, 0, 1) * 0.4) * reach * focus + 0.15, 0.1, 1);
}

/* ------------------------------------------------------------ rally effects */

// Rallies help most where they happen, spill over into the region, and matter
// more the closer they land to election day.
function rallyMap(cand, game) {
  const start = game.campaignStart;
  const end = game.electionDate;
  const span = Math.max(1, daysBetween(start, end));
  const local = {};
  const regional = {};
  let national = 0;

  for (const rally of cand.rallies || []) {
    const st = STATE_BY_CODE[rally.state];
    if (!st) continue;
    const progress = clamp(daysBetween(start, rally.date) / span, 0, 1);
    const recency = 0.65 + progress * 0.7; // late rallies hit harder
    const crowdPull = rally.note && rally.note.trim().length > 12 ? 1.12 : 1;
    const weight = recency * crowdPull;
    local[st.code] = (local[st.code] || 0) + weight;
    regional[st.region] = (regional[st.region] || 0) + weight;
    national += weight;
  }

  return { local, regional, national };
}

/* ---------------------------------------------------------------- scoring */

// Returns a per-state score difference (positive = candidate A ahead) plus the
// campaign summary numbers the recap screen shows.
export function scoreCampaign(game) {
  const a = game.candidates.a;
  const b = game.candidates.b;
  const axisA = effectiveAxis(a);
  const axisB = effectiveAxis(b);
  const starA = candidateRatings(a).star;
  const starB = candidateRatings(b).star;
  const msgA = messageStrength(a);
  const msgB = messageStrength(b);
  const rA = rallyMap(a, game);
  const rB = rallyMap(b, game);

  const rng = mulberry32(hash32(`${game.id}|${a.name}|${b.name}|${game.electionDate}`));
  const nationalSwing = (rng() - 0.5) * 0.16; // the year's mood, same for every state

  const diffs = {};
  for (const st of STATES) {
    // Alignment: how close each candidate sits to the state's culture.
    const alignA = 1 - Math.abs(axisA - st.lean) / 2;
    const alignB = 1 - Math.abs(axisB - st.lean) / 2;

    const groundA = Math.sqrt(rA.local[st.code] || 0) * 0.085
      + Math.sqrt(rA.regional[st.region] || 0) * 0.022
      + Math.sqrt(rA.national) * 0.012;
    const groundB = Math.sqrt(rB.local[st.code] || 0) * 0.085
      + Math.sqrt(rB.regional[st.region] || 0) * 0.022
      + Math.sqrt(rB.national) * 0.012;

    const scoreA = alignA * 1.45 + starA * 0.5 + msgA * 0.35 + groundA;
    const scoreB = alignB * 1.45 + starB * 0.5 + msgB * 0.35 + groundB;

    // A fixed quirk per state, so two similar candidates still get a textured map.
    const localNoise = (mulberry32(hash32(`${game.id}|${st.code}`))() - 0.5) * 0.30;
    diffs[st.code] = scoreA - scoreB + nationalSwing + localNoise;
  }

  return {
    diffs,
    profile: {
      a: { axis: axisA, star: starA, message: msgA, rallies: (a.rallies || []).length, ground: rA },
      b: { axis: axisB, star: starB, message: msgB, rallies: (b.rallies || []).length, ground: rB },
    },
    nationalSwing,
  };
}

/* -------------------------------------------------------- vote distribution */

// Turns a winner-per-state map into believable vote counts. Margins come from
// the local model, so an Opus-picked map still gets sensible-looking returns.
export function buildStateVotes(game, winners, diffs, targets) {
  const rng = mulberry32(hash32(`${game.id}|votes`));
  const raw = {};

  for (const st of STATES) {
    const winner = winners[st.code] === 'b' ? 'b' : 'a';
    const diff = Math.abs(diffs[st.code] ?? 0);
    // 50.2% in a nail-biter, flattening out around 80% in a home state, so a
    // lopsided matchup doesn't turn every state into a 78% wipeout.
    const share = clamp(0.502 + 0.30 * Math.tanh(diff * 1.1) + rng() * 0.025, 0.502, 0.80);
    const turnout = st.pop * 1000 * (0.92 + rng() * 0.16);
    const win = Math.round(turnout * share);
    const lose = Math.round(turnout * (1 - share));
    raw[st.code] = winner === 'a' ? { a: win, b: lose } : { a: lose, b: win };
  }

  if (targets && targets.a > 0 && targets.b > 0) rescale(raw, targets);

  const totals = { a: 0, b: 0 };
  for (const code of STATE_CODES) {
    totals.a += raw[code].a;
    totals.b += raw[code].b;
  }
  return { stateVotes: raw, popular: totals };
}

// Scale per-state counts so the national totals match `targets` exactly,
// without ever flipping who won a state.
function rescale(raw, targets) {
  for (const side of ['a', 'b']) {
    const sum = STATE_CODES.reduce((n, c) => n + raw[c][side], 0);
    if (!sum) continue;
    const factor = targets[side] / sum;
    for (const code of STATE_CODES) raw[code][side] = Math.round(raw[code][side] * factor);
    // Push the rounding drift into the biggest state so the totals tie out.
    const drift = targets[side] - STATE_CODES.reduce((n, c) => n + raw[c][side], 0);
    if (drift) {
      const biggest = [...STATE_CODES].sort((x, y) => raw[y][side] - raw[x][side])[0];
      raw[biggest][side] += drift;
    }
  }
}

/* ------------------------------------------------------------ result build */

export function tallyEv(winners) {
  const ev = { a: 0, b: 0 };
  for (const st of STATES) {
    if (winners[st.code] === 'b') ev.b += st.ev;
    else if (winners[st.code] === 'a') ev.a += st.ev;
  }
  return ev;
}

export function buildResult(game, winners, diffs, stateVotes, popular, extra = {}) {
  const ev = tallyEv(winners);
  const winner = ev.a === ev.b ? 'tie' : ev.a > ev.b ? 'a' : 'b';
  const margins = STATES.map((st) => {
    const v = stateVotes[st.code];
    const total = v.a + v.b;
    return {
      code: st.code,
      name: st.name,
      ev: st.ev,
      winner: winners[st.code],
      a: v.a,
      b: v.b,
      total,
      marginPct: total ? Math.abs(v.a - v.b) / total * 100 : 0,
    };
  });
  const closest = [...margins].sort((x, y) => x.marginPct - y.marginPct).slice(0, 5);
  const biggest = [...margins].sort((x, y) => y.marginPct - x.marginPct).slice(0, 5);

  return {
    engine: extra.engine || 'local',
    winner,
    ev,
    popular,
    winners,
    stateVotes,
    margins,
    closest,
    biggest,
    splitDecision: winner !== 'tie'
      && ((popular.a > popular.b && winner === 'b') || (popular.b > popular.a && winner === 'a')),
    narrative: extra.narrative || null,
    decidedAt: new Date().toISOString(),
  };
}

/* -------------------------------------------------------- public entry point */

// Full offline simulation: pick every state, then the votes.
export function simulateElection(game) {
  const { diffs, profile } = scoreCampaign(game);
  const winners = {};
  for (const code of STATE_CODES) winners[code] = diffs[code] >= 0 ? 'a' : 'b';
  const { stateVotes, popular } = buildStateVotes(game, winners, diffs);
  const result = buildResult(game, winners, diffs, stateVotes, popular, { engine: 'local' });
  result.narrative = localNarrative(game, result, profile);
  return result;
}

// Merge an Opus-produced map + national vote totals into a full result.
export function applyAiResult(game, ai) {
  const { diffs } = scoreCampaign(game);
  const winners = {};
  for (const code of STATE_CODES) winners[code] = ai.states[code] === 'b' ? 'b' : 'a';
  const targets = { a: Math.round(ai.popular.a), b: Math.round(ai.popular.b) };
  const { stateVotes, popular } = buildStateVotes(game, winners, diffs, targets);
  return buildResult(game, winners, diffs, stateVotes, popular, {
    engine: 'ai',
    narrative: {
      headline: ai.headline,
      summary: ai.summary,
      keyMoments: ai.keyMoments || [],
      notes: ai.notes || {},
    },
  });
}

/* ---------------------------------------------------------------- narrative */

export function localNarrative(game, result, profile) {
  const a = game.candidates.a;
  const b = game.candidates.b;
  const win = result.winner === 'tie' ? null : game.candidates[result.winner];
  const lose = result.winner === 'tie' ? null : game.candidates[result.winner === 'a' ? 'b' : 'a'];
  const evWin = result.winner === 'tie' ? 269 : result.ev[result.winner];
  const gap = Math.abs(result.popular.a - result.popular.b);

  const headline = result.winner === 'tie'
    ? `Deadlock: ${a.name} and ${b.name} split the Electoral College 269–269`
    : `${win.name} wins the presidency with ${evWin} electoral votes`;

  const summary = result.winner === 'tie'
    ? `After three months of rallies, neither ${a.name} nor ${b.name} could clear ${EV_TO_WIN}. The election goes to the House.`
    : `${win.name} beat ${lose.name} ${result.ev[result.winner]}–${result.ev[result.winner === 'a' ? 'b' : 'a']} in the Electoral College`
      + `${result.splitDecision
        ? `, despite losing the popular vote by ${gap.toLocaleString('en-US')} ballots`
        : ` and by ${gap.toLocaleString('en-US')} votes nationally`}. `
      + `The campaign turned on ${result.closest.slice(0, 2).map((s) => s.name).join(' and ')}, `
      + `where the margin came in under ${Math.max(0.1, result.closest[1]?.marginPct || 1).toFixed(1)}%.`;

  const moments = [];
  const allRallies = [
    ...(a.rallies || []).map((r) => ({ ...r, who: 'a' })),
    ...(b.rallies || []).map((r) => ({ ...r, who: 'b' })),
  ].sort((x, y) => x.date.localeCompare(y.date));

  if (allRallies[0]) {
    const r = allRallies[0];
    moments.push({
      date: r.date,
      text: `${game.candidates[r.who].name} opens the campaign in ${STATE_BY_CODE[r.state]?.name || r.state}.`,
    });
  }
  const mid = allRallies[Math.floor(allRallies.length / 2)];
  if (mid) {
    moments.push({
      date: mid.date,
      text: `Midway through, ${game.candidates[mid.who].name} draws a crowd in ${STATE_BY_CODE[mid.state]?.name || mid.state} and the race tightens.`,
    });
  }
  const last = allRallies[allRallies.length - 1];
  if (last) {
    moments.push({
      date: last.date,
      text: `The final rally lands in ${STATE_BY_CODE[last.state]?.name || last.state} — ${game.candidates[last.who].name} closes on "${(game.candidates[last.who].slogan || 'the message').trim()}".`,
    });
  }
  if (result.closest[0]) {
    moments.push({
      date: game.electionDate,
      text: `${result.closest[0].name} is called at ${result.closest[0].marginPct.toFixed(1)}% — the tightest state on the board.`,
    });
  }

  const note = (side) => {
    const c = game.candidates[side];
    const p = profile[side];
    const states = result.margins.filter((m) => m.winner === side);
    return `${c.name} held ${p.rallies} ${p.rallies === 1 ? 'rally' : 'rallies'} and carried ${states.length} `
      + `${states.length === 1 ? 'state' : 'states'} for ${result.ev[side]} electoral votes. `
      + `Name recognition ${Math.round(p.star * 100)}/100, message strength ${Math.round(p.message * 100)}/100.`;
  };

  return { headline, summary, keyMoments: moments, notes: { a: note('a'), b: note('b') } };
}

/* --------------------------------------------------- rigged-mode projections */

// What the vote totals "should" look like given the states the player handed
// out — shown as guidance before they type their own numbers.
export function projectFromAssignment(assignment) {
  const proj = { a: 0, b: 0, ev: { a: 0, b: 0 }, assigned: 0, turnout: 0 };
  for (const st of STATES) {
    const side = assignment[st.code];
    const turnout = st.pop * 1000;
    proj.turnout += turnout;
    if (side !== 'a' && side !== 'b') continue;
    proj.assigned += 1;
    proj.ev[side] += st.ev;
    // A won state normally means ~55% of that state's ballots.
    const win = Math.round(turnout * 0.55);
    const lose = turnout - win;
    proj[side] += win;
    proj[side === 'a' ? 'b' : 'a'] += lose;
  }
  proj.low = { a: Math.round(proj.a * 0.93), b: Math.round(proj.b * 0.93) };
  proj.high = { a: Math.round(proj.a * 1.07), b: Math.round(proj.b * 1.07) };
  return proj;
}
