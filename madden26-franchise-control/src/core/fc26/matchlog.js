// The Match Log: the matches you play, with what FC shows after the final
// whistle but never writes to the save (score, scorers and assists with
// minutes, cards, injuries, the team stats, player ratings, man of the
// match). From it come the stats FC does not keep: goals and assists per 90,
// clean sheets, when goals come, scoring first, comebacks and leads lost,
// late winners, xG against goals, streaks, partnerships and injuries.

const r1 = (x) => (Number.isFinite(x) ? Math.round(x * 10) / 10 : null);
const r2 = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : null);
const num = (v) => (v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v));

export const GOAL_TYPES = { open: 'Open play', header: 'Header', penalty: 'Penalty', freekick: 'Free kick', longshot: 'Long shot', counter: 'Counter attack', setpiece: 'Corner / set piece', owngoal: 'Own goal' };
export const CARD_TYPES = { yellow: 'Yellow', secondyellow: 'Second yellow', red: 'Red' };
export const TEAM_STATS = [
  ['possession', 'Possession %'], ['shots', 'Shots'], ['shotsOnTarget', 'Shots on target'], ['xg', 'Expected goals (xG)'], ['passes', 'Passes'],
  ['passAccuracy', 'Pass accuracy %'], ['tackles', 'Tackles'], ['interceptions', 'Interceptions'], ['saves', 'Saves'], ['fouls', 'Fouls'], ['corners', 'Corners'], ['offsides', 'Offsides'],
];
export const PERIODS = ['1-15', '16-30', '31-45+', '46-60', '61-75', '76-90+', 'Extra time'];

function period(minute) {
  if (minute <= 15) return 0;
  if (minute <= 30) return 1;
  if (minute <= 45) return 2;
  if (minute <= 60) return 3;
  if (minute <= 75) return 4;
  if (minute <= 90) return 5;
  return 6;
}
// "45+2" sorts after 45 and before 46.
const order = (e) => (Number(e.minute) || 0) + (Number(e.added) || 0) / 100;
export const minuteText = (e) => (e.minute == null ? '' : `${e.minute}${e.added ? `+${e.added}` : ''}'`);

// Clean up a match sent from the form. Throws on anything that does not add up.
export function normalizeMatch(m, { clubId = null } = {}) {
  const goalsFor = num(m.goalsFor);
  const goalsAgainst = num(m.goalsAgainst);
  if (!m.date || !/^\d{4}-\d{2}-\d{2}$/.test(m.date)) throw new Error('Pick the date of the match.');
  if (goalsFor == null || goalsAgainst == null || goalsFor < 0 || goalsAgainst < 0) throw new Error('Enter the final score.');
  if (!m.opponentId && !String(m.opponentName || '').trim()) throw new Error('Pick the opponent.');
  const minuteOf = (x) => { const v = num(x.minute); if (v == null || v < 0 || v > 130) throw new Error('Every goal, card and injury needs a minute between 0 and 130.'); return v; };
  const goals = (m.goals || []).filter((g) => g && (g.playerId || g.name || g.type === 'owngoal' || (g.minute !== '' && g.minute != null))).map((g) => ({
    side: g.side === 'against' ? 'against' : 'for',
    minute: minuteOf(g),
    added: num(g.added) || 0,
    playerId: num(g.playerId),
    assistId: num(g.assistId),
    name: String(g.name || '').trim() || null,
    type: GOAL_TYPES[g.type] ? g.type : 'open',
  }));
  const listedFor = goals.filter((g) => g.side === 'for').length;
  const listedAgainst = goals.filter((g) => g.side === 'against').length;
  if (listedFor > goalsFor) throw new Error(`${listedFor} goals are listed for your side but the score says ${goalsFor}.`);
  if (listedAgainst > goalsAgainst) throw new Error(`${listedAgainst} goals are listed for the opponent but the score says ${goalsAgainst}.`);
  for (const g of goals) if (g.assistId && g.assistId === g.playerId) throw new Error('A player cannot assist his own goal.');
  const cards = (m.cards || []).filter((c) => c && (c.playerId || c.name)).map((c) => ({ side: c.side === 'against' ? 'against' : 'for', minute: minuteOf(c), added: num(c.added) || 0, playerId: num(c.playerId), name: String(c.name || '').trim() || null, color: CARD_TYPES[c.color] ? c.color : 'yellow' }));
  const injuries = (m.injuries || []).filter((i) => i && i.playerId).map((i) => ({ minute: minuteOf(i), added: num(i.added) || 0, playerId: num(i.playerId), injury: String(i.injury || '').trim() || 'Injury', weeks: num(i.weeks), days: num(i.days) }));
  const stats = {};
  for (const [key] of TEAM_STATS) {
    const us = num(m.stats && m.stats[key] && m.stats[key][0]);
    const them = num(m.stats && m.stats[key] && m.stats[key][1]);
    if (us != null || them != null) stats[key] = [us, them];
  }
  if (stats.possession && stats.possession[0] != null && stats.possession[1] == null) stats.possession[1] = 100 - stats.possession[0];
  const players = (m.players || []).filter((p) => p && p.playerId && (num(p.minutes) > 0 || num(p.rating) > 0)).map((p) => ({ playerId: num(p.playerId), minutes: num(p.minutes), rating: num(p.rating), started: p.started !== false && p.started !== 'false', position: p.position || null }));
  for (const p of players) if (p.rating != null && (p.rating < 0 || p.rating > 10)) throw new Error('Player ratings go from 0 to 10.');
  return {
    id: m.id || `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    clubId: num(m.clubId) || clubId,
    date: m.date,
    competition: String(m.competition || '').trim() || 'League',
    opponentId: num(m.opponentId),
    opponentName: String(m.opponentName || '').trim() || null,
    venue: ['home', 'away', 'neutral'].includes(m.venue) ? m.venue : 'home',
    goalsFor,
    goalsAgainst,
    extraTime: Boolean(m.extraTime),
    penalties: num(m.penaltiesFor) != null && num(m.penaltiesAgainst) != null ? { for: num(m.penaltiesFor), against: num(m.penaltiesAgainst) } : null,
    goals: goals.sort((a, b) => order(a) - order(b)),
    cards: cards.sort((a, b) => order(a) - order(b)),
    injuries,
    stats,
    players,
    motmId: num(m.motmId),
    notes: String(m.notes || '').slice(0, 2000),
    createdAt: m.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const resultOf = (m) => (m.goalsFor > m.goalsAgainst ? 'W' : m.goalsFor < m.goalsAgainst ? 'L' : m.penalties ? (m.penalties.for > m.penalties.against ? 'W' : 'L') : 'D');
// League-style result: a shootout counts as a draw for points.
const pointsOf = (m) => (m.goalsFor > m.goalsAgainst ? 3 : m.goalsFor < m.goalsAgainst ? 0 : 1);

// The score as the match went, goal by goal. Only goals with a minute count,
// so the story is only told when every goal of the match is listed.
function scoreline(m) {
  const complete = m.goals.filter((g) => g.side === 'for').length === m.goalsFor && m.goals.filter((g) => g.side === 'against').length === m.goalsAgainst;
  if (!complete) return null;
  let us = 0;
  let them = 0;
  const steps = [];
  for (const g of m.goals) {
    if (g.side === 'for') us++; else them++;
    steps.push({ goal: g, us, them });
  }
  return steps;
}

// Facts about one match for its summary.
export function matchStory(m, name = (id) => `#${id}`) {
  const steps = scoreline(m);
  const lines = [];
  const res = resultOf(m);
  const facts = { scoredFirst: null, concededFirst: null, cameFromBehind: false, ledAndDidNotWin: false, lateWinner: null, lateEqualizer: null, lateConceded: null, biggestLead: 0, biggestDeficit: 0 };
  if (steps && steps.length) {
    facts.scoredFirst = steps[0].goal.side === 'for';
    facts.concededFirst = !facts.scoredFirst;
    for (const s of steps) {
      facts.biggestLead = Math.max(facts.biggestLead, s.us - s.them);
      facts.biggestDeficit = Math.max(facts.biggestDeficit, s.them - s.us);
    }
    facts.cameFromBehind = facts.biggestDeficit > 0 && res === 'W';
    facts.ledAndDidNotWin = facts.biggestLead > 0 && res !== 'W';
    // The goal that put us ahead for good, and the one that levelled late.
    let decider = null;
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      if (s.goal.side === 'for' && s.us > s.them && (i === 0 || steps[i - 1].us <= steps[i - 1].them) && steps.slice(i).every((x) => x.us > x.them)) decider = s;
    }
    if (res === 'W' && decider && order(decider.goal) >= 85) facts.lateWinner = decider.goal;
    const last = steps[steps.length - 1];
    if (last.us === last.them && last.goal.side === 'for' && order(last.goal) >= 85) facts.lateEqualizer = last.goal;
    if (last.goal.side === 'against' && order(last.goal) >= 85 && res !== 'W') facts.lateConceded = last.goal;
  }
  const scorers = new Map();
  for (const g of m.goals) if (g.side === 'for' && g.playerId && g.type !== 'owngoal') scorers.set(g.playerId, (scorers.get(g.playerId) || 0) + 1);
  for (const [pid, n] of scorers) if (n >= 3) lines.push(`Hat-trick for ${name(pid)}${n > 3 ? ` (${n} goals)` : ''}.`);
  for (const [pid, n] of scorers) if (n === 2) lines.push(`Brace for ${name(pid)}.`);
  const assists = new Map();
  for (const g of m.goals) if (g.side === 'for' && g.assistId) assists.set(g.assistId, (assists.get(g.assistId) || 0) + 1);
  for (const [pid, n] of assists) if (n >= 2) lines.push(`${n} assists for ${name(pid)}.`);
  if (facts.cameFromBehind) lines.push(`Came back from ${facts.biggestDeficit} down to win.`);
  if (facts.ledAndDidNotWin) lines.push(`Led by ${facts.biggestLead} and ${res === 'D' ? 'drew' : 'lost'}.`);
  if (facts.lateWinner) lines.push(`Late winner: ${facts.lateWinner.playerId ? name(facts.lateWinner.playerId) : 'own goal'} ${minuteText(facts.lateWinner)}.`);
  if (facts.lateEqualizer) lines.push(`Late equaliser: ${facts.lateEqualizer.playerId ? name(facts.lateEqualizer.playerId) : 'own goal'} ${minuteText(facts.lateEqualizer)}.`);
  if (facts.lateConceded) lines.push(`Conceded late (${minuteText(facts.lateConceded)}).`);
  if (m.goalsAgainst === 0) lines.push('Clean sheet.');
  for (const c of m.cards) if (c.side === 'for' && c.color !== 'yellow') lines.push(`${c.color === 'red' ? 'Red card' : 'Sent off for a second yellow'}: ${c.playerId ? name(c.playerId) : c.name} ${minuteText(c)}.`);
  for (const i of m.injuries) lines.push(`${name(i.playerId)} injured ${minuteText(i)} (${i.injury}${i.weeks ? `, ${i.weeks} week${i.weeks === 1 ? '' : 's'}` : i.days ? `, ${i.days} days` : ''}).`);
  const s = m.stats;
  if (s.xg && s.xg[0] != null && s.xg[1] != null) {
    if (m.goalsFor - s.xg[0] >= 1.5) lines.push(`Clinical: ${m.goalsFor} goals from ${s.xg[0]} xG.`);
    if (s.xg[0] - m.goalsFor >= 1.5) lines.push(`Wasteful: ${m.goalsFor} goal${m.goalsFor === 1 ? '' : 's'} from ${s.xg[0]} xG.`);
    if (res !== 'W' && s.xg[0] > s.xg[1] + 1) lines.push(`Deserved more: xG ${s.xg[0]} to ${s.xg[1]}.`);
    if (res === 'W' && s.xg[1] > s.xg[0] + 1) lines.push(`Rode their luck: xG ${s.xg[0]} to ${s.xg[1]}.`);
  }
  if (m.penalties) lines.push(`${m.penalties.for > m.penalties.against ? 'Won' : 'Lost'} ${m.penalties.for}-${m.penalties.against} on penalties.`);
  return { result: res, facts, lines, complete: Boolean(steps) };
}

function streaks(matches) {
  const kinds = {
    wins: (m) => resultOf(m) === 'W',
    unbeaten: (m) => resultOf(m) !== 'L',
    losses: (m) => resultOf(m) === 'L',
    winless: (m) => resultOf(m) !== 'W',
    scoring: (m) => m.goalsFor > 0,
    cleanSheets: (m) => m.goalsAgainst === 0,
  };
  const out = {};
  for (const [k, test] of Object.entries(kinds)) {
    let cur = 0;
    let best = 0;
    for (const m of matches) {
      cur = test(m) ? cur + 1 : 0;
      best = Math.max(best, cur);
    }
    out[k] = { current: cur, best };
  }
  return out;
}

function blankRecord() {
  return { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 };
}
function addRecord(r, m) {
  r.played++;
  const res = m.goalsFor > m.goalsAgainst ? 'W' : m.goalsFor < m.goalsAgainst ? 'L' : 'D';
  if (res === 'W') r.won++; else if (res === 'L') r.lost++; else r.drawn++;
  r.gf += m.goalsFor;
  r.ga += m.goalsAgainst;
  r.points += pointsOf(m);
}
const finishRecord = (r) => ({ ...r, gd: r.gf - r.ga, ppg: r.played ? r2(r.points / r.played) : null, winPct: r.played ? Math.round((r.won / r.played) * 100) : null });

// Minutes for a player in a match: the log first, then the save's rating
// for that date.
function minutesIn(m, pid, saveRating) {
  const p = m.players.find((x) => x.playerId === pid);
  if (p && Number.isFinite(p.minutes)) return p.minutes;
  const s = saveRating(pid, m.date);
  return s && Number.isFinite(s.minutes) ? s.minutes : null;
}

// Everything the log adds up to. `career` (optional) supplies names, the
// save's ratings and minutes, and the league table for opponent strength.
export function logStats(matches, { career = null, competition = null } = {}) {
  const list = matches.filter((m) => !competition || m.competition === competition).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  const name = (id) => (career && career.players[id] ? career.players[id].name : `Player #${id}`);
  const ratingIndex = new Map();
  if (career) for (const r of career.ratings) ratingIndex.set(`${r.playerId}|${r.date}`, r);
  const saveRating = (pid, date) => ratingIndex.get(`${pid}|${date}`) || null;

  const total = blankRecord();
  const venue = { home: blankRecord(), away: blankRecord(), neutral: blankRecord() };
  const byComp = new Map();
  const team = {
    cleanSheets: 0, failedToScore: 0, bothScored: 0,
    scoredFirst: blankRecord(), concededFirst: blankRecord(), cameFromBehind: 0, pointsFromBehind: 0, ledAndDidNotWin: 0, pointsDroppedFromAhead: 0,
    lateWinners: 0, lateEqualizers: 0, lateConceded: 0, goalsFor: Array(PERIODS.length).fill(0), goalsAgainst: Array(PERIODS.length).fill(0),
    goalTypesFor: {}, goalTypesAgainst: {}, yellows: 0, reds: 0, penaltiesWon: 0, penaltyShootouts: { won: 0, lost: 0 },
  };
  const sums = {};
  const strength = { top: blankRecord(), middle: blankRecord(), bottom: blankRecord() };
  const players = new Map();
  const P = (pid) => {
    if (!players.has(pid)) players.set(pid, { playerId: pid, apps: 0, starts: 0, minutes: 0, minutesKnown: 0, goals: 0, assists: 0, penalties: 0, headers: 0, freeKicks: 0, longShots: 0, braces: 0, hatTricks: 0, yellows: 0, reds: 0, motm: 0, ratings: [], cleanSheets: 0, won: 0, drawn: 0, lost: 0, injuries: [] });
    return players.get(pid);
  };
  const pairs = new Map();
  const injuries = [];
  let biggestWin = null;
  let heaviestDefeat = null;
  let mostGoals = null;

  for (const m of list) {
    addRecord(total, m);
    addRecord(venue[m.venue] || venue.home, m);
    if (!byComp.has(m.competition)) byComp.set(m.competition, blankRecord());
    addRecord(byComp.get(m.competition), m);
    const res = resultOf(m);
    if (m.goalsAgainst === 0) team.cleanSheets++;
    if (m.goalsFor === 0) team.failedToScore++;
    if (m.goalsFor > 0 && m.goalsAgainst > 0) team.bothScored++;
    if (m.penalties) team.penaltyShootouts[m.penalties.for > m.penalties.against ? 'won' : 'lost']++;
    const story = matchStory(m, name);
    if (story.complete && m.goals.length) {
      if (story.facts.scoredFirst) addRecord(team.scoredFirst, m); else addRecord(team.concededFirst, m);
      if (story.facts.biggestDeficit > 0 && res !== 'L') { if (res === 'W') team.cameFromBehind++; team.pointsFromBehind += pointsOf(m); }
      if (story.facts.biggestLead > 0 && res !== 'W') { team.ledAndDidNotWin++; team.pointsDroppedFromAhead += 3 - pointsOf(m); }
      if (story.facts.lateWinner) team.lateWinners++;
      if (story.facts.lateEqualizer) team.lateEqualizers++;
      if (story.facts.lateConceded) team.lateConceded++;
    }
    for (const g of m.goals) {
      // Stoppage time stays in its half: 45+2 is first half, 90+3 is 76-90+.
      (g.side === 'for' ? team.goalsFor : team.goalsAgainst)[period(Number(g.minute) || 0)]++;
      const types = g.side === 'for' ? team.goalTypesFor : team.goalTypesAgainst;
      types[g.type] = (types[g.type] || 0) + 1;
    }
    const margin = m.goalsFor - m.goalsAgainst;
    if (margin > 0 && (!biggestWin || margin > biggestWin.margin || (margin === biggestWin.margin && m.goalsFor > biggestWin.match.goalsFor))) biggestWin = { margin, match: m };
    if (margin < 0 && (!heaviestDefeat || margin < heaviestDefeat.margin)) heaviestDefeat = { margin, match: m };
    if (!mostGoals || m.goalsFor + m.goalsAgainst > mostGoals.goals) mostGoals = { goals: m.goalsFor + m.goalsAgainst, match: m };
    for (const [key] of TEAM_STATS) {
      const v = m.stats[key];
      if (!v) continue;
      sums[key] ||= { us: 0, them: 0, nUs: 0, nThem: 0, goalsUs: 0, goalsThem: 0 };
      if (v[0] != null) { sums[key].us += v[0]; sums[key].nUs++; sums[key].goalsUs += m.goalsFor; }
      if (v[1] != null) { sums[key].them += v[1]; sums[key].nThem++; sums[key].goalsThem += m.goalsAgainst; }
    }
    // Opponent strength from where they sit in their league table.
    if (career && m.opponentId && career.clubs[m.opponentId]) {
      const lg = career.clubs[m.opponentId].leagueId;
      const rows = career.standings[lg] || [];
      const row = rows.find((r) => r.clubId === m.opponentId);
      if (row && rows.length >= 6 && rows.some((r) => r.played > 0)) {
        const third = rows.length / 3;
        addRecord(row.position <= third ? strength.top : row.position > rows.length - third ? strength.bottom : strength.middle, m);
      }
    }
    // Players
    const involved = new Set([...m.players.map((p) => p.playerId), ...m.goals.filter((g) => g.side === 'for').flatMap((g) => [g.playerId, g.assistId]).filter(Boolean)]);
    if (career) for (const r of career.ratings) if (r.date === m.date && career.players[r.playerId] && career.players[r.playerId].clubId === (m.clubId || career.userClubId)) involved.add(r.playerId);
    const scored = new Map();
    for (const pid of involved) {
      const p = P(pid);
      const entry = m.players.find((x) => x.playerId === pid);
      const mins = minutesIn(m, pid, saveRating);
      if (mins === 0) continue;
      p.apps++;
      if (!entry || entry.started) p.starts++;
      if (mins != null) { p.minutes += mins; p.minutesKnown++; }
      const rating = entry && entry.rating != null ? entry.rating : saveRating(pid, m.date) ? saveRating(pid, m.date).rating : null;
      if (rating != null) p.ratings.push(rating);
      if (res === 'W') p.won++; else if (res === 'L') p.lost++; else p.drawn++;
      const group = career && career.players[pid] ? career.players[pid].group : null;
      if (m.goalsAgainst === 0 && (group === 'GK' || group === 'DEF') && (mins == null || mins >= 60)) p.cleanSheets++;
    }
    for (const g of m.goals) {
      if (g.side !== 'for') continue;
      if (g.playerId && g.type !== 'owngoal') {
        const p = P(g.playerId);
        p.goals++;
        if (g.type === 'penalty') p.penalties++;
        if (g.type === 'header') p.headers++;
        if (g.type === 'freekick') p.freeKicks++;
        if (g.type === 'longshot') p.longShots++;
        scored.set(g.playerId, (scored.get(g.playerId) || 0) + 1);
        if (g.assistId) {
          P(g.assistId).assists++;
          const key = `${g.assistId}>${g.playerId}`;
          pairs.set(key, (pairs.get(key) || 0) + 1);
        }
      }
    }
    for (const [pid, n] of scored) { if (n === 2) P(pid).braces++; if (n >= 3) P(pid).hatTricks++; }
    for (const c of m.cards) {
      if (c.side !== 'for') continue;
      if (c.color === 'yellow') team.yellows++; else team.reds++;
      if (c.playerId) { if (c.color === 'yellow') P(c.playerId).yellows++; else P(c.playerId).reds++; }
    }
    if (m.motmId) P(m.motmId).motm++;
    for (const i of m.injuries) {
      const back = i.weeks ? addDays(m.date, i.weeks * 7) : i.days ? addDays(m.date, i.days) : null;
      const item = { playerId: i.playerId, name: name(i.playerId), date: m.date, minute: minuteText(i), injury: i.injury, weeks: i.weeks, days: i.days, back, matchId: m.id, opponent: opponentLabel(m, career) };
      injuries.push(item);
      P(i.playerId).injuries.push(item);
    }
  }

  const teamGoals = total.gf;
  const playerRows = [...players.values()].filter((p) => p.apps || p.goals || p.assists).map((p) => {
    const g90 = p.minutesKnown && p.minutes ? r2((p.goals / p.minutes) * 90) : null;
    const a90 = p.minutesKnown && p.minutes ? r2((p.assists / p.minutes) * 90) : null;
    const ga = p.goals + p.assists;
    const cp = career && career.players[p.playerId];
    return {
      playerId: p.playerId,
      name: name(p.playerId),
      position: cp ? cp.position : null,
      group: cp ? cp.group : null,
      apps: p.apps, starts: p.starts, minutes: p.minutesKnown ? p.minutes : null,
      goals: p.goals, assists: p.assists, ga, penalties: p.penalties, headers: p.headers, freeKicks: p.freeKicks, longShots: p.longShots, braces: p.braces, hatTricks: p.hatTricks,
      goalsPer90: g90, assistsPer90: a90, gaPer90: g90 != null ? r2(g90 + a90) : null,
      minutesPerGA: ga && p.minutesKnown ? Math.round(p.minutes / ga) : null,
      shareOfGoals: teamGoals ? Math.round((ga / teamGoals) * 100) : null,
      yellows: p.yellows, reds: p.reds, motm: p.motm,
      avgRating: p.ratings.length ? r2(p.ratings.reduce((a, b) => a + b, 0) / p.ratings.length) : null,
      cleanSheets: p.cleanSheets,
      record: `${p.won}-${p.drawn}-${p.lost}`,
      winPct: p.apps ? Math.round((p.won / p.apps) * 100) : null,
      injuries: p.injuries.length,
    };
  });
  const stat = (key) => {
    const s = sums[key];
    if (!s) return null;
    return { us: s.nUs ? r2(s.us / s.nUs) : null, them: s.nThem ? r2(s.them / s.nThem) : null, totalUs: r2(s.us), totalThem: r2(s.them), matches: Math.max(s.nUs, s.nThem), goalsUs: s.goalsUs, goalsThem: s.goalsThem };
  };
  const shots = stat('shots');
  const onTarget = stat('shotsOnTarget');
  const xg = stat('xg');
  const today = career && career.date ? career.date : new Date().toISOString().slice(0, 10);
  return {
    matches: list.length,
    record: finishRecord(total),
    venue: Object.fromEntries(Object.entries(venue).map(([k, v]) => [k, finishRecord(v)])),
    competitions: [...byComp.entries()].map(([k, v]) => ({ competition: k, ...finishRecord(v) })),
    form: list.slice(-6).map((m) => ({ id: m.id, date: m.date, result: resultOf(m), score: `${m.goalsFor}-${m.goalsAgainst}`, opponent: opponentLabel(m, career) })),
    streaks: streaks(list),
    team: {
      ...team,
      scoredFirst: finishRecord(team.scoredFirst),
      concededFirst: finishRecord(team.concededFirst),
      cleanSheetPct: list.length ? Math.round((team.cleanSheets / list.length) * 100) : null,
    },
    periods: PERIODS,
    averages: Object.fromEntries(TEAM_STATS.map(([k]) => [k, stat(k)]).filter(([, v]) => v)),
    finishing: {
      conversion: shots && shots.totalUs ? Math.round((shots.goalsUs / shots.totalUs) * 100) : null,
      conversionAgainst: shots && shots.totalThem ? Math.round((shots.goalsThem / shots.totalThem) * 100) : null,
      onTargetPct: shots && onTarget && shots.totalUs ? Math.round((onTarget.totalUs / shots.totalUs) * 100) : null,
      xgFor: xg ? xg.totalUs : null,
      xgAgainst: xg ? xg.totalThem : null,
      goalsMinusXg: xg && xg.totalUs != null ? r2(xg.goalsUs - xg.totalUs) : null,
      xgaMinusGoalsAgainst: xg && xg.totalThem != null ? r2(xg.totalThem - xg.goalsThem) : null,
    },
    strength: Object.fromEntries(Object.entries(strength).map(([k, v]) => [k, finishRecord(v)])),
    extremes: {
      biggestWin: biggestWin ? summary(biggestWin.match, career) : null,
      heaviestDefeat: heaviestDefeat ? summary(heaviestDefeat.match, career) : null,
      mostGoals: mostGoals ? summary(mostGoals.match, career) : null,
    },
    players: playerRows.sort((a, b) => b.ga - a.ga || b.goals - a.goals || (b.avgRating || 0) - (a.avgRating || 0)),
    partnerships: [...pairs.entries()].map(([k, n]) => { const [a, s] = k.split('>').map(Number); return { assistId: a, scorerId: s, assister: name(a), scorer: name(s), goals: n }; }).sort((a, b) => b.goals - a.goals).slice(0, 10),
    injuries: injuries.map((i) => ({ ...i, out: Boolean(i.back && i.back > today) })).sort((a, b) => b.date.localeCompare(a.date)),
  };
}

function addDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function opponentLabel(m, career) {
  if (m.opponentId && career && career.clubs[m.opponentId]) return career.clubs[m.opponentId].name;
  return m.opponentName || (m.opponentId ? `Club ${m.opponentId}` : 'Opponent');
}

export function summary(m, career) {
  return { id: m.id, date: m.date, competition: m.competition, opponent: opponentLabel(m, career), venue: m.venue, score: `${m.goalsFor}-${m.goalsAgainst}`, result: resultOf(m), penalties: m.penalties };
}

// One match, ready to show: the story, scorers, cards and stats with names.
export function matchView(m, career) {
  const name = (id) => (career && career.players[id] ? career.players[id].name : id ? `Player #${id}` : null);
  const story = matchStory(m, (id) => name(id) || `#${id}`);
  return {
    ...summary(m, career),
    match: m,
    story,
    goals: m.goals.map((g) => ({ ...g, minuteText: minuteText(g), scorer: g.side === 'for' ? (g.type === 'owngoal' ? `Own goal${g.name ? ` (${g.name})` : ''}` : name(g.playerId) || g.name || 'Unknown') : g.name || (g.type === 'owngoal' ? 'Own goal' : opponentLabel(m, career)), assister: g.assistId ? name(g.assistId) : null, typeLabel: GOAL_TYPES[g.type] })),
    cards: m.cards.map((c) => ({ ...c, minuteText: minuteText(c), who: c.playerId ? name(c.playerId) : c.name, colorLabel: CARD_TYPES[c.color] })),
    injuries: m.injuries.map((i) => ({ ...i, minuteText: minuteText(i), who: name(i.playerId) })),
    players: m.players.map((p) => ({ ...p, name: name(p.playerId) })).sort((a, b) => (b.rating || 0) - (a.rating || 0)),
    motm: m.motmId ? name(m.motmId) : null,
    stats: TEAM_STATS.filter(([k]) => m.stats[k]).map(([k, label]) => ({ key: k, label, us: m.stats[k][0], them: m.stats[k][1] })),
  };
}
