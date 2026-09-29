// League-wide tables for the weekly recap: power rankings, the playoff
// picture, big performances, fantasy points and season leaders to date.
//
// Records, points and stats are counted straight from the saved results and
// box scores. The power rankings and the game of the week are this tool's own
// formulas, and say so; the playoff picture uses simplified tiebreakers.

const STAGE_RANK = { pre: 0, reg: 1, post: 2 };

export const DIVISIONS = {
  'AFC East': ['BUF', 'MIA', 'NE', 'NYJ'],
  'AFC North': ['BAL', 'CIN', 'CLE', 'PIT'],
  'AFC South': ['HOU', 'IND', 'JAX', 'TEN'],
  'AFC West': ['DEN', 'KC', 'LAC', 'LV'],
  'NFC East': ['DAL', 'NYG', 'PHI', 'WAS'],
  'NFC North': ['CHI', 'DET', 'GB', 'MIN'],
  'NFC South': ['ATL', 'CAR', 'NO', 'TB'],
  'NFC West': ['ARI', 'LAR', 'SEA', 'SF'],
};
const DIVISION_OF = Object.fromEntries(Object.entries(DIVISIONS).flatMap(([d, list]) => list.map((a) => [a, d])));

export function divisionOf(team) {
  return (team && (team.division || DIVISION_OF[team.abbr])) || null;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Every team's results in one part of the season, up to and including a week.
export function results(league, stage, seasonYear, throughWeek) {
  const out = {};
  for (const id of Object.keys(league.teams)) out[id] = { teamId: id, w: 0, l: 0, t: 0, pf: 0, pa: 0, games: [] };
  const games = Object.values(league.games)
    .filter((g) => g.status === 'played' && g.stage === stage && (g.seasonYear ?? seasonYear) === seasonYear && g.week <= throughWeek)
    .sort((a, b) => a.week - b.week);
  for (const g of games) {
    for (const [me, them, mine, theirs] of [[g.homeTeamId, g.awayTeamId, g.homeScore, g.awayScore], [g.awayTeamId, g.homeTeamId, g.awayScore, g.homeScore]]) {
      const r = out[me];
      if (!r) continue;
      r.pf += mine;
      r.pa += theirs;
      const res = mine > theirs ? 'W' : mine < theirs ? 'L' : 'T';
      if (res === 'W') r.w++; else if (res === 'L') r.l++; else r.t++;
      r.games.push({ week: g.week, res, opp: them, pf: mine, pa: theirs });
    }
  }
  for (const r of Object.values(out)) {
    const gp = r.w + r.l + r.t;
    r.gp = gp;
    r.pct = gp ? (r.w + r.t / 2) / gp : 0;
    r.diff = r.pf - r.pa;
    r.text = `${r.w}-${r.l}${r.t ? `-${r.t}` : ''}`;
  }
  return out;
}

// ---------------------------------------------------------------- power rankings

// The tool's formula, on a 0-100 scale:
//   40% record, 30% point differential per game, 15% last three games,
//   15% Madden's team rating. Before anyone has played, rating only.
export function powerRankings(league, stage, seasonYear, week) {
  const now = results(league, stage, seasonYear, week);
  const prev = results(league, stage, seasonYear, week - 1);
  const score = (res) => {
    const rows = Object.values(res).map((r) => {
      const t = league.teams[r.teamId] || {};
      const rating = clamp(((t.overall || 70) - 60) * 2.5, 0, 100);
      // No games yet: an even record and form, so the rating decides where
      // he sits among teams that have played.
      if (!r.gp) return { ...r, power: 0.85 * 50 + 0.15 * rating, parts: { rating: Math.round(rating) } };
      const last = r.games.slice(-3);
      const lastPct = last.reduce((s, x) => s + (x.res === 'W' ? 1 : x.res === 'T' ? 0.5 : 0), 0) / last.length;
      const lastDiff = last.reduce((s, x) => s + x.pf - x.pa, 0) / last.length;
      const record = r.pct * 100;
      const diff = 50 + clamp(r.diff / r.gp, -20, 20) * 2.5;
      const form = lastPct * 70 + (50 + clamp(lastDiff, -20, 20) * 2.5) * 0.3;
      return { ...r, power: 0.4 * record + 0.3 * diff + 0.15 * form + 0.15 * rating, parts: { record: Math.round(record), diff: Math.round(diff), form: Math.round(form), rating: Math.round(rating) } };
    });
    rows.sort((a, b) => b.power - a.power || b.diff - a.diff || (league.teams[b.teamId].overall || 0) - (league.teams[a.teamId].overall || 0));
    rows.forEach((r, i) => { r.rank = i + 1; });
    return rows;
  };
  const cur = score(now);
  const last = new Map(score(prev).map((r) => [r.teamId, r.rank]));
  return cur.map((r) => {
    const t = league.teams[r.teamId] || {};
    const was = last.get(r.teamId);
    const lastGame = r.games[r.games.length - 1];
    return {
      rank: r.rank,
      teamId: r.teamId,
      abbr: t.abbr,
      name: t.displayName,
      record: r.text,
      diff: r.diff,
      overall: t.overall || null,
      power: Math.round(r.power * 10) / 10,
      move: week > 0 && was ? was - r.rank : 0,
      lastResult: lastGame && lastGame.week === week ? `${lastGame.res} ${lastGame.pf}-${lastGame.pa} vs ${(league.teams[lastGame.opp] || {}).abbr || '?'}` : 'No game this week',
      parts: r.parts,
    };
  });
}

// ---------------------------------------------------------------- playoff picture

// Division leaders get seeds 1-4, the next three best records are wild cards.
// Ties: winning percentage, then head-to-head when exactly two teams are
// tied, then point differential. The NFL uses more tiebreakers than this.
export function playoffPicture(league, seasonYear, week) {
  const res = results(league, 'reg', seasonYear, week);
  const h2h = (a, b) => {
    const games = res[a].games.filter((x) => x.opp === b);
    return games.reduce((s, x) => s + (x.res === 'W' ? 1 : x.res === 'L' ? -1 : 0), 0);
  };
  const order = (list) => list.slice().sort((a, b) => {
    if (b.pct !== a.pct) return b.pct - a.pct;
    const tied = list.filter((x) => x.pct === a.pct);
    if (tied.length === 2) { const hh = h2h(a.teamId, b.teamId); if (hh) return -hh; }
    return b.diff - a.diff || (league.teams[a.teamId].abbr || '').localeCompare(league.teams[b.teamId].abbr || '');
  });
  const confs = {};
  for (const r of Object.values(res)) {
    const t = league.teams[r.teamId];
    const div = divisionOf(t);
    if (!div) continue;
    const conf = div.split(' ')[0];
    ((confs[conf] ||= {})[div] ||= []).push({ ...r, abbr: t.abbr, name: t.displayName, division: div });
  }
  const out = [];
  for (const [conf, divs] of Object.entries(confs).sort(([a], [b]) => a.localeCompare(b))) {
    if (Object.keys(divs).length < 2) continue;
    const leaders = Object.values(divs).map((list) => order(list)[0]);
    const seeded = order(leaders).map((r, i) => ({ ...r, seed: i + 1, how: 'Division leader' }));
    const leaderIds = new Set(leaders.map((r) => r.teamId));
    const rest = order(Object.values(divs).flat().filter((r) => !leaderIds.has(r.teamId)));
    const wild = rest.slice(0, 3).map((r, i) => ({ ...r, seed: 5 + i, how: 'Wild card' }));
    const hunt = rest.slice(3, 6).map((r) => ({ ...r, seed: null, how: 'In the hunt' }));
    out.push({ conference: conf, teams: [...seeded, ...wild, ...hunt].map((r) => ({ seed: r.seed, how: r.how, teamId: r.teamId, abbr: r.abbr, name: r.name, division: r.division, record: r.text, diff: r.diff })) });
  }
  return out;
}

// ---------------------------------------------------------------- players

const OFF = (e) => (e && e.offense) || {};
const DEF = (e) => (e && e.defense) || {};
const RET = (e) => (e && e.returns) || {};

// PPR fantasy points from the recorded box score.
export function fantasyPoints(e) {
  const o = OFF(e);
  const r = RET(e);
  const d = DEF(e);
  return Math.round(((o.PASSYARDS || 0) / 25 + (o.PASSTDS || 0) * 4 - (o.PASSINTS || 0) * 2
    + (o.RUSHYARDS || 0) / 10 + (o.RUSHTDS || 0) * 6
    + (o.RECEIVECATCHES || 0) + (o.RECEIVEYARDS || 0) / 10 + (o.RECEIVETDS || 0) * 6
    - (o.RUSHFUMBLES || 0) * 2 + ((r.KRETTDS || 0) + (r.PRETTDS || 0) + (d.DSECINTTDS || 0)) * 6) * 10) / 10;
}

export function bigPerformances(league, gameIds) {
  const out = [];
  for (const gid of gameIds) {
    for (const e of Object.values(league.playerGameStats[gid] || {})) {
      const p = league.players[e.playerId];
      const who = { playerId: e.playerId, name: p ? p.fullName : 'Unknown player', position: p ? p.position : '', teamId: e.teamId || (p || {}).teamId || null, gameId: gid };
      const o = OFF(e);
      const d = DEF(e);
      const r = RET(e);
      const push = (text, weight) => out.push({ ...who, text, weight });
      if ((o.PASSYARDS || 0) >= 300) push(`${o.PASSYARDS} passing yards`, o.PASSYARDS / 10);
      if ((o.PASSTDS || 0) >= 3) push(`${o.PASSTDS} touchdown passes`, o.PASSTDS * 10);
      if ((o.RUSHYARDS || 0) >= 100) push(`${o.RUSHYARDS} rushing yards on ${o.RUSHATTEMPTS} carries`, o.RUSHYARDS / 4);
      if ((o.RUSHTDS || 0) >= 2) push(`${o.RUSHTDS} rushing touchdowns`, o.RUSHTDS * 12);
      if ((o.RECEIVEYARDS || 0) >= 100) push(`${o.RECEIVECATCHES} catches for ${o.RECEIVEYARDS} yards`, o.RECEIVEYARDS / 4);
      if ((o.RECEIVETDS || 0) >= 2) push(`${o.RECEIVETDS} touchdown catches`, o.RECEIVETDS * 12);
      const allPurpose = (o.RUSHYARDS || 0) + (o.RECEIVEYARDS || 0) + (r.KRETYARDS || 0) + (r.PRETYARDS || 0);
      if (allPurpose >= 175 && (o.RUSHYARDS || 0) < 100 && (o.RECEIVEYARDS || 0) < 100) push(`${allPurpose} all-purpose yards`, allPurpose / 6);
      const sacks = (d.DLINESACKS || 0) + (d.DLINEHALFSACK || 0) * 0.5;
      if (sacks >= 2) push(`${sacks} sacks`, sacks * 14);
      if ((d.DSECINTS || 0) >= 2) push(`${d.DSECINTS} interceptions`, d.DSECINTS * 16);
      if ((d.DEFTACKLES || 0) >= 12) push(`${d.DEFTACKLES} tackles`, d.DEFTACKLES * 2);
      if ((r.KRETTDS || 0) + (r.PRETTDS || 0) > 0) push(`${(r.KRETTDS || 0) + (r.PRETTDS || 0)} return touchdown${(r.KRETTDS || 0) + (r.PRETTDS || 0) > 1 ? 's' : ''}`, 30);
    }
  }
  return out.sort((a, b) => b.weight - a.weight);
}

export function fantasyLeaders(league, gameIds, n = 10) {
  const rows = [];
  for (const gid of gameIds) {
    for (const e of Object.values(league.playerGameStats[gid] || {})) {
      const pts = fantasyPoints(e);
      if (pts <= 0) continue;
      const p = league.players[e.playerId];
      rows.push({ playerId: e.playerId, name: p ? p.fullName : 'Unknown player', position: p ? p.position : '', teamId: e.teamId || (p || {}).teamId || null, gameId: gid, points: pts });
    }
  }
  return rows.sort((a, b) => b.points - a.points).slice(0, n);
}

// Totals from the first game of this part of the season through this week.
export function seasonLeaders(league, stage, seasonYear, week, n = 5) {
  const gameIds = Object.values(league.games).filter((g) => g.status === 'played' && g.stage === stage && (g.seasonYear ?? seasonYear) === seasonYear && g.week <= week).map((g) => g.gameId);
  const tot = new Map();
  for (const gid of gameIds) {
    for (const e of Object.values(league.playerGameStats[gid] || {})) {
      const p = league.players[e.playerId];
      const t = tot.get(e.playerId) || { playerId: e.playerId, name: p ? p.fullName : 'Unknown player', position: p ? p.position : '', teamId: (p || {}).teamId || e.teamId || null, games: 0, passYds: 0, passTD: 0, rushYds: 0, rushTD: 0, recYds: 0, rec: 0, recTD: 0, sacks: 0, ints: 0, tackles: 0, fantasy: 0 };
      const o = OFF(e);
      const d = DEF(e);
      t.games += 1;
      t.passYds += o.PASSYARDS || 0; t.passTD += o.PASSTDS || 0;
      t.rushYds += o.RUSHYARDS || 0; t.rushTD += o.RUSHTDS || 0;
      t.recYds += o.RECEIVEYARDS || 0; t.rec += o.RECEIVECATCHES || 0; t.recTD += o.RECEIVETDS || 0;
      t.sacks += (d.DLINESACKS || 0) + (d.DLINEHALFSACK || 0) * 0.5; t.ints += d.DSECINTS || 0; t.tackles += d.DEFTACKLES || 0;
      t.fantasy = Math.round((t.fantasy + fantasyPoints(e)) * 10) / 10;
      tot.set(e.playerId, t);
    }
  }
  const all = [...tot.values()];
  const top = (key) => all.filter((x) => x[key] > 0).sort((a, b) => b[key] - a[key]).slice(0, n).map((x) => ({ ...x, value: x[key] }));
  return {
    games: gameIds.length,
    passing: top('passYds'), rushing: top('rushYds'), receiving: top('recYds'),
    touchdowns: all.map((x) => ({ ...x, td: x.rushTD + x.recTD })).filter((x) => x.td > 0).sort((a, b) => b.td - a.td).slice(0, n).map((x) => ({ ...x, value: x.td })),
    sacks: top('sacks'), interceptions: top('ints'), tackles: top('tackles'), fantasy: top('fantasy'),
  };
}

// ---------------------------------------------------------------- teams of the week

export function teamAwards(league, games) {
  const rows = [];
  for (const g of games) {
    for (const [me, opp] of [[g.homeTeamId, g.awayTeamId], [g.awayTeamId, g.homeTeamId]]) {
      const t = (league.teamGameStats[g.gameId] || {})[me] || {};
      const o = (league.teamGameStats[g.gameId] || {})[opp] || {};
      rows.push({ teamId: me, gameId: g.gameId, points: me === g.homeTeamId ? g.homeScore : g.awayScore, allowed: me === g.homeTeamId ? g.awayScore : g.homeScore, yards: t.OFFYARDS ?? t.TOTALYARDS ?? null, yardsAllowed: o.OFFYARDS ?? o.TOTALYARDS ?? null, takeaways: t.TAKEAWAYS ?? null, sacks: t.SACKS ?? null });
    }
  }
  const best = (key, low = false) => rows.filter((r) => r[key] != null).sort((a, b) => (low ? a[key] - b[key] : b[key] - a[key]))[0] || null;
  const name = (r) => (r ? { ...r, abbr: (league.teams[r.teamId] || {}).abbr, name: (league.teams[r.teamId] || {}).displayName } : null);
  return {
    mostPoints: name(best('points')),
    mostYards: name(best('yards')),
    fewestYardsAllowed: name(best('yardsAllowed', true)),
    fewestPointsAllowed: name(best('allowed', true)),
    mostTakeaways: name(best('takeaways')),
    mostSacks: name(best('sacks')),
  };
}

// ---------------------------------------------------------------- game of the week

// Next week's best matchup by the tool's measure: both teams' records, how
// close their ratings are, and how good they are.
export function gameOfTheWeek(league, upcomingGames, recordNow, ranks) {
  if (!upcomingGames.length) return null;
  const rankOf = new Map((ranks || []).map((r) => [r.teamId, r.rank]));
  const scored = upcomingGames.map((g) => {
    const a = league.teams[g.awayTeamId] || {};
    const h = league.teams[g.homeTeamId] || {};
    const ra = recordNow && recordNow[g.awayTeamId];
    const rh = recordNow && recordNow[g.homeTeamId];
    const pct = ra && rh && ra.gp && rh.gp ? (ra.pct + rh.pct) / 2 : 0.5;
    const close = 100 - Math.abs((a.overall || 70) - (h.overall || 70)) * 6;
    const quality = ((a.overall || 70) + (h.overall || 70)) / 2;
    const rankBoost = rankOf.size ? (64 - (rankOf.get(g.awayTeamId) || 32) - (rankOf.get(g.homeTeamId) || 32)) : 0;
    return { g, score: pct * 60 + close * 0.3 + quality * 0.5 + rankBoost * 0.5, ra, rh, a, h };
  }).sort((x, y) => y.score - x.score);
  const top = scored[0];
  const why = [];
  if (top.ra && top.rh && top.ra.gp) why.push(`${top.a.abbr} ${top.ra.text} vs ${top.h.abbr} ${top.rh.text}`);
  if (top.a.overall && top.h.overall) why.push(`team ratings ${top.a.overall} and ${top.h.overall}`);
  if (rankOf.size) why.push(`power ranks #${rankOf.get(top.g.awayTeamId)} and #${rankOf.get(top.g.homeTeamId)}`);
  return { gameId: top.g.gameId, label: top.g.label, away: top.a.abbr, home: top.h.abbr, awayName: top.a.displayName, homeName: top.h.displayName, why: why.join('; ') };
}

export { STAGE_RANK };
