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
  const base = ticketRatings(cand).axis;
  const themes = (cand.themes || []).map((id) => THEME_BY_ID[id]).filter(Boolean);
  if (!themes.length) return base;
  const themeAxis = themes.reduce((n, t) => n + t.axis, 0) / themes.length;
  return clamp(base * 0.55 + themeAxis * 0.45, -1, 1);
}

/* --------------------------------------------------------------- the ticket */

// A running mate is rated exactly the way the top of the ticket is.
function vpAsCandidate(cand) {
  const vp = cand.vp || {};
  return {
    name: vp.name || '',
    party: cand.party,
    famous: vp.kind ? vp.kind === 'famous' : !!vp.famous,
    star: vp.star,
    axis: vp.axis,
    description: vp.description,
  };
}

export function hasRunningMate(cand) {
  return Boolean(cand.vp && (cand.vp.name || '').trim());
}

// Where the whole ticket sits. The running mate pulls it and, if they reach
// across the axis, widens the coalition the ticket can win from.
export function ticketRatings(cand) {
  const top = candidateRatings(cand);
  if (!hasRunningMate(cand)) {
    return { star: top.star, axis: top.axis, top, vp: null, balance: 0, balanceBonus: 0 };
  }
  const vp = candidateRatings(vpAsCandidate(cand));
  const balance = clamp(Math.abs(top.axis - vp.axis), 0, 1.4);
  return {
    star: clamp(top.star * 0.85 + vp.star * 0.15, 0, 1),
    axis: clamp(top.axis * 0.78 + vp.axis * 0.22, -1, 1),
    top,
    vp,
    balance,
    // Peaks on a genuinely complementary pick: a clone of yourself adds
    // nothing, and a wildly mismatched pair just reads as incoherent.
    balanceBonus: 0.09 * Math.sin((balance / 1.4) * Math.PI),
  };
}

// Home-state advantage — the top of the ticket is worth more of it than the
// running mate, and the running mate's region warms a little too.
function homeBonus(cand, st) {
  let bonus = 0;
  if (cand.homeState === st.code) bonus += 0.10;
  const vpHome = cand.vp && cand.vp.homeState;
  if (vpHome && hasRunningMate(cand)) {
    if (vpHome === st.code) bonus += 0.06;
    else if (STATE_BY_CODE[vpHome]?.region === st.region) bonus += 0.02;
  }
  return bonus;
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
// more the closer they land to election day. A running mate on the stump draws
// a smaller crowd than the top of the ticket, but covers ground the top can't.
const VP_RALLY_WEIGHT = 0.62;

function rallyMap(cand, game) {
  const start = game.campaignStart;
  const end = game.electionDate;
  const span = Math.max(1, daysBetween(start, end));
  const local = {};
  const regional = {};
  let national = 0;
  const bySpeaker = { top: 0, vp: 0 };

  for (const rally of cand.rallies || []) {
    const st = STATE_BY_CODE[rally.state];
    if (!st) continue;
    const speaker = rally.who === 'vp' && hasRunningMate(cand) ? 'vp' : 'top';
    const progress = clamp(daysBetween(start, rally.date) / span, 0, 1);
    const recency = 0.65 + progress * 0.7; // late rallies hit harder
    const crowdPull = rally.note && rally.note.trim().length > 12 ? 1.12 : 1;
    const weight = recency * crowdPull * (speaker === 'vp' ? VP_RALLY_WEIGHT : 1);
    bySpeaker[speaker] += 1;
    local[st.code] = (local[st.code] || 0) + weight;
    regional[st.region] = (regional[st.region] || 0) + weight;
    national += weight;
  }

  return { local, regional, national, bySpeaker };
}

/* ---------------------------------------------------------------- scoring */

// Returns a per-state score difference (positive = candidate A ahead) plus the
// campaign summary numbers the recap screen shows.
export function scoreCampaign(game) {
  const a = game.candidates.a;
  const b = game.candidates.b;
  const axisA = effectiveAxis(a);
  const axisB = effectiveAxis(b);
  const ticketA = ticketRatings(a);
  const ticketB = ticketRatings(b);
  const msgA = messageStrength(a);
  const msgB = messageStrength(b);
  const rA = rallyMap(a, game);
  const rB = rallyMap(b, game);

  const rng = mulberry32(hash32(`${game.id}|${a.name}|${b.name}|${game.electionDate}`));
  const nationalSwing = (rng() - 0.5) * 0.16; // the year's mood, same for every state

  const diffs = {};
  for (const st of STATES) {
    // Alignment: how close each ticket sits to the state's culture.
    const alignA = 1 - Math.abs(axisA - st.lean) / 2;
    const alignB = 1 - Math.abs(axisB - st.lean) / 2;

    const groundA = Math.sqrt(rA.local[st.code] || 0) * 0.085
      + Math.sqrt(rA.regional[st.region] || 0) * 0.022
      + Math.sqrt(rA.national) * 0.012;
    const groundB = Math.sqrt(rB.local[st.code] || 0) * 0.085
      + Math.sqrt(rB.regional[st.region] || 0) * 0.022
      + Math.sqrt(rB.national) * 0.012;

    const scoreA = alignA * 1.45 + ticketA.star * 0.5 + msgA * 0.35
      + groundA + ticketA.balanceBonus + homeBonus(a, st);
    const scoreB = alignB * 1.45 + ticketB.star * 0.5 + msgB * 0.35
      + groundB + ticketB.balanceBonus + homeBonus(b, st);

    // A fixed quirk per state, so two similar candidates still get a textured map.
    const localNoise = (mulberry32(hash32(`${game.id}|${st.code}`))() - 0.5) * 0.30;
    diffs[st.code] = scoreA - scoreB + nationalSwing + localNoise;
  }

  const side = (cand, ticket, rallies) => ({
    axis: effectiveAxis(cand),
    star: ticket.star,
    message: messageStrength(cand),
    rallies: (cand.rallies || []).length,
    ground: rallies,
    ticket,
    homeState: cand.homeState || null,
    vpHomeState: (hasRunningMate(cand) && cand.vp.homeState) || null,
  });

  return {
    diffs,
    profile: { a: side(a, ticketA, rA), b: side(b, ticketB, rB) },
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

// "Ohio", "Ohio and Michigan", "Ohio, Michigan and Iowa"
function listOf(items) {
  if (items.length < 2) return items[0] || '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function localNarrative(game, result, profile) {
  const a = game.candidates.a;
  const b = game.candidates.b;
  const win = result.winner === 'tie' ? null : game.candidates[result.winner];
  const lose = result.winner === 'tie' ? null : game.candidates[result.winner === 'a' ? 'b' : 'a'];
  const evWin = result.winner === 'tie' ? 269 : result.ev[result.winner];
  const gap = Math.abs(result.popular.a - result.popular.b);

  const ticketOf = (c) => (hasRunningMate(c) ? `${c.name} and ${c.vp.name}` : c.name);

  const headline = result.winner === 'tie'
    ? `Deadlock: ${a.name} and ${b.name} split the Electoral College 269–269`
    : hasRunningMate(win)
      ? `${win.name} and ${win.vp.name} win with ${evWin} electoral votes`
      : `${win.name} wins the presidency with ${evWin} electoral votes`;

  const summary = result.winner === 'tie'
    ? `After three months of rallies, neither ${a.name} nor ${b.name} could clear ${EV_TO_WIN}. The election goes to the House.`
    : `${ticketOf(win)} beat ${ticketOf(lose)} ${result.ev[result.winner]}–${result.ev[result.winner === 'a' ? 'b' : 'a']} in the Electoral College`
      + `${result.splitDecision
        ? `, despite losing the popular vote by ${gap.toLocaleString('en-US')} ballots`
        : ` and by ${gap.toLocaleString('en-US')} votes nationally`}. `
      + `The campaign turned on ${result.closest.slice(0, 2).map((s) => s.name).join(' and ')}, `
      + `where the margin came in under ${Math.max(0.1, result.closest[1]?.marginPct || 1).toFixed(1)}%.`;

  const homes = homeStateReport(game, result);
  const moments = [];
  const allRallies = [
    ...(a.rallies || []).map((r) => ({ ...r, side: 'a' })),
    ...(b.rallies || []).map((r) => ({ ...r, side: 'b' })),
  ].sort((x, y) => x.date.localeCompare(y.date));

  const speakerName = (r) => {
    const c = game.candidates[r.side];
    return r.who === 'vp' && hasRunningMate(c) ? c.vp.name : c.name;
  };

  if (allRallies[0]) {
    const r = allRallies[0];
    moments.push({
      date: r.date,
      text: `${speakerName(r)} opens the campaign in ${STATE_BY_CODE[r.state]?.name || r.state}.`,
    });
  }
  const mid = allRallies[Math.floor(allRallies.length / 2)];
  if (mid) {
    moments.push({
      date: mid.date,
      text: `Midway through, ${speakerName(mid)} draws a crowd in ${STATE_BY_CODE[mid.state]?.name || mid.state} and the race tightens.`,
    });
  }
  const last = allRallies[allRallies.length - 1];
  if (last) {
    moments.push({
      date: last.date,
      text: `The final rally lands in ${STATE_BY_CODE[last.state]?.name || last.state} — ${speakerName(last)} closes on "${(game.candidates[last.side].slogan || 'the message').trim()}".`,
    });
  }
  // Losing your own home state is the humiliation the papers lead with.
  for (const side of ['a', 'b']) {
    for (const home of homes[side]) {
      if (home.won) continue;
      moments.push({
        date: game.electionDate,
        text: `${home.who} loses ${home.name} — their own home state — by ${home.marginPct.toFixed(1)}%.`,
      });
    }
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
    const stops = p.ground.bySpeaker;
    let text = `${ticketOf(c)} held ${p.rallies} ${p.rallies === 1 ? 'rally' : 'rallies'}`;
    if (hasRunningMate(c) && stops.vp) {
      text += ` — ${stops.top} with ${c.name} on stage, ${stops.vp} with ${c.vp.name} —`;
    }
    text += ` and carried ${states.length} ${states.length === 1 ? 'state' : 'states'} `
      + `for ${result.ev[side]} electoral votes. `;
    const mine = homes[side];
    if (mine.length) {
      const label = (hm) => hm.name + (hm.role === 'vp' ? ` (${hm.who}'s home state)` : '');
      const held = mine.filter((hm) => hm.won).map(label);
      const lost = mine.filter((hm) => !hm.won).map(label);
      const clauses = [
        held.length ? `held ${listOf(held)}` : null,
        lost.length ? `lost ${listOf(lost)}` : null,
      ].filter(Boolean);
      text += `They ${clauses.join(' but ')}. `;
    }
    text += `Name recognition ${Math.round(p.star * 100)}/100, message strength ${Math.round(p.message * 100)}/100`;
    if (hasRunningMate(c) && p.ticket.balance > 0.45) {
      text += `, and the ticket reached across the aisle to pick up moderates`;
    }
    return `${text}.`;
  };

  return { headline, summary, keyMoments: moments, notes: { a: note('a'), b: note('b') } };
}

/* --------------------------------------------------- rigged-mode projections */

// Did each ticket hold the states it came from? The recap and the narrative
// both lead with this, because losing your own home state is a story.
export function homeStateReport(game, result) {
  const out = { a: [], b: [] };
  for (const side of ['a', 'b']) {
    const cand = game.candidates[side];
    const entries = [
      { role: 'top', who: cand.name, code: cand.homeState },
      hasRunningMate(cand)
        ? { role: 'vp', who: cand.vp.name, code: cand.vp.homeState }
        : null,
    ].filter((e) => e && e.code && STATE_BY_CODE[e.code]);

    const seen = new Set();
    for (const entry of entries) {
      if (seen.has(entry.code)) continue; // same home state for both halves
      seen.add(entry.code);
      const margin = result.margins.find((m) => m.code === entry.code);
      if (!margin) continue;
      out[side].push({
        ...entry,
        name: STATE_BY_CODE[entry.code].name,
        ev: STATE_BY_CODE[entry.code].ev,
        won: margin.winner === side,
        marginPct: margin.marginPct,
      });
    }
  }
  return out;
}

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
