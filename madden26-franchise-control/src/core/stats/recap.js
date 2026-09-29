// The weekly recap: everything that happened across the league in one week.
//
// Accuracy first. Scores, records, standings, stat leaders, injuries, news
// stories, social posts and transactions all come straight from what Madden
// saved. The few items built by this tool (players of the week, the
// advanced-stat notes, highlight wording) say so, and nothing is shown that
// the data cannot back up: an overtime game is called overtime only when the
// play-by-play shows a fifth quarter, an upset only when the loser's team
// rating was clearly higher.

import { getInjuryType } from '../franchise/injury-catalog.js';
import { powerRankings, playoffPicture, bigPerformances, fantasyLeaders, seasonLeaders, teamAwards, gameOfTheWeek, results } from './league-table.js';
import { gameInjuryReport, injuryTypeName, injuryLabel, severityName, outlook, SEVERITY } from '../injuries/game-injuries.js';

const STAGE_RANK = { pre: 0, reg: 1, post: 2 };

// NFL divisions by team abbreviation, for standings from a franchise file
// (the save numbers divisions but does not name them).
const DIVISIONS = {
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

export function prettyInjury(type) {
  const cat = getInjuryType(type);
  if (cat) return cat.name;
  return String(type || 'Injury').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
}

// Madden stamps news and injuries with a season stage and a week. Preseason
// weeks match preseason games; the NFL season counts regular season and
// playoffs on one clock.
function matchesWeek(item, stage, week) {
  if (!item) return false;
  if (stage === 'pre') return item.stage === 'PreSeason' && item.week === week;
  return item.stage === 'NFLSeason' && item.week === week;
}

function record(league, stage, seasonYear, throughWeek) {
  const out = {};
  for (const id of Object.keys(league.teams)) out[id] = { teamId: id, w: 0, l: 0, t: 0, pf: 0, pa: 0, results: [] };
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
      r.results.push({ week: g.week, res, opp: them });
    }
  }
  for (const r of Object.values(out)) {
    const gp = r.w + r.l + r.t;
    r.pct = gp ? (r.w + r.t / 2) / gp : 0;
    r.text = `${r.w}-${r.l}${r.t ? `-${r.t}` : ''}`;
    let streak = 0;
    let kind = null;
    for (let i = r.results.length - 1; i >= 0; i--) {
      const x = r.results[i].res;
      if (kind === null) kind = x;
      if (x !== kind) break;
      streak++;
    }
    r.streak = kind ? { kind, length: streak, text: `${kind}${streak}` } : null;
  }
  return out;
}

function overtime(league, gameId) {
  const gp = league.gamePlays && league.gamePlays[gameId];
  if (!gp) return null; // unknown: no play-by-play
  return (gp.scoring || []).some((s) => s.quarter > 4) || (gp.plays || []).some((p) => p.quarter > 4);
}

const OFF = (e) => (e && e.offense) || {};
const DEF = (e) => (e && e.defense) || {};

function statLine(o, d) {
  const bits = [];
  if (o.PASSATTEMPTS) bits.push(`${o.PASSCOMPLETED || 0}/${o.PASSATTEMPTS}, ${o.PASSYARDS || 0} pass yds, ${o.PASSTDS || 0} TD${o.PASSINTS ? `, ${o.PASSINTS} INT` : ''}`);
  if (o.RUSHATTEMPTS) bits.push(`${o.RUSHATTEMPTS} car, ${o.RUSHYARDS || 0} rush yds${o.RUSHTDS ? `, ${o.RUSHTDS} TD` : ''}`);
  if (o.RECEIVECATCHES) bits.push(`${o.RECEIVECATCHES} rec, ${o.RECEIVEYARDS || 0} yds${o.RECEIVETDS ? `, ${o.RECEIVETDS} TD` : ''}`);
  const tk = (d.DEFTACKLES || 0);
  if (tk || d.DLINESACKS || d.DSECINTS || d.DLINEFORCEDFUMBLES || d.DEFPASSDEFLECTIONS) {
    const parts = [`${tk} tkl`];
    if (d.ASSDEFTACKLES) parts.push(`${d.ASSDEFTACKLES} ast`);
    if (d.DEFTACKLESFORLOSS) parts.push(`${d.DEFTACKLESFORLOSS} TFL`);
    if (d.DLINESACKS) parts.push(`${d.DLINESACKS} sk`);
    if (d.DSECINTS) parts.push(`${d.DSECINTS} INT`);
    if (d.DLINEFORCEDFUMBLES) parts.push(`${d.DLINEFORCEDFUMBLES} FF`);
    if (d.DEFPASSDEFLECTIONS) parts.push(`${d.DEFPASSDEFLECTIONS} PD`);
    if (d.DSECINTTDS) parts.push(`${d.DSECINTTDS} TD`);
    bits.push(parts.join(', '));
  }
  return bits.join(' · ');
}

export function weeklyRecap(league, engine, tracker, { stage, week, injuryLog = [], ledger = null }) {
  week = Number(week);
  const weekGames = Object.values(league.games).filter((g) => g.stage === stage && g.week === week).sort((a, b) => String(a.gameId).localeCompare(String(b.gameId)));
  const played = weekGames.filter((g) => g.status === 'played');
  const seasonYear = weekGames[0] ? weekGames[0].seasonYear ?? league.season.year : league.season.year;
  const label = weekGames[0] ? weekGames[0].label : `Week ${week + 1}`;
  const team = (id) => league.teams[id] || { abbr: '?', displayName: 'Unknown', overall: 0 };
  const name = (pid) => (league.players[pid] ? league.players[pid].fullName : 'Unknown player');
  const pos = (pid) => (league.players[pid] ? league.players[pid].position : '');

  const standingsStage = stage === 'post' ? null : stage;
  const rec = standingsStage ? record(league, standingsStage, seasonYear, week) : null;
  const before = standingsStage ? record(league, standingsStage, seasonYear, week - 1) : null;

  // ---------- scores
  const scores = weekGames.map((g) => {
    const out = { gameId: g.gameId, status: g.status, awayTeamId: g.awayTeamId, homeTeamId: g.homeTeamId, away: team(g.awayTeamId).abbr, home: team(g.homeTeamId).abbr, awayName: team(g.awayTeamId).displayName, homeName: team(g.homeTeamId).displayName };
    if (g.status !== 'played') return out;
    const h = engine.highlights(league, g.gameId, tracker);
    const winner = g.homeScore > g.awayScore ? g.homeTeamId : g.awayScore > g.homeScore ? g.awayTeamId : null;
    return {
      ...out,
      awayScore: g.awayScore,
      homeScore: g.homeScore,
      winner,
      overtime: overtime(league, g.gameId),
      simmed: Boolean(g.isSimmed),
      awayRecord: rec ? rec[g.awayTeamId].text : null,
      homeRecord: rec ? rec[g.homeTeamId].text : null,
      headline: h ? h.headline : null,
      playerOfTheGame: h ? h.playerOfTheGame : null,
      topPlay: h && h.highlights[0] ? h.highlights[0].text : null,
    };
  });

  // ---------- storylines, all from the scores and records
  const storylines = [];
  const decided = scores.filter((s) => s.status === 'played');
  const margin = (s) => Math.abs(s.homeScore - s.awayScore);
  const game = (s) => `${s.away} ${s.awayScore}, ${s.home} ${s.homeScore}`;
  if (decided.length) {
    const blow = decided.slice().sort((a, b) => margin(b) - margin(a))[0];
    if (margin(blow) >= 17) storylines.push({ kind: 'Blowout', gameId: blow.gameId, text: `${team(blow.winner).displayName} rolled ${team(blow.winner === blow.homeTeamId ? blow.awayTeamId : blow.homeTeamId).displayName} by ${margin(blow)} (${game(blow)}).` });
    for (const s of decided.filter((x) => margin(x) <= 3 && x.winner)) storylines.push({ kind: 'Nail-biter', gameId: s.gameId, text: `${team(s.winner).displayName} won by ${margin(s)}${s.overtime ? ' in overtime' : ''} (${game(s)}).` });
    for (const s of decided.filter((x) => !x.winner)) storylines.push({ kind: 'Tie', gameId: s.gameId, text: `${s.awayName} and ${s.homeName} tied ${s.homeScore}-${s.awayScore}.` });
    for (const s of decided.filter((x) => x.overtime && margin(x) > 3 && x.winner)) storylines.push({ kind: 'Overtime', gameId: s.gameId, text: `${team(s.winner).displayName} won in overtime (${game(s)}).` });
    const high = decided.slice().sort((a, b) => b.homeScore + b.awayScore - (a.homeScore + a.awayScore))[0];
    if (high.homeScore + high.awayScore >= 55) storylines.push({ kind: 'Shootout', gameId: high.gameId, text: `The ${high.awayName} and ${high.homeName} combined for ${high.homeScore + high.awayScore} points (${game(high)}).` });
    for (const s of decided.filter((x) => x.homeScore === 0 || x.awayScore === 0)) if (s.winner) storylines.push({ kind: 'Shutout', gameId: s.gameId, text: `${team(s.winner).displayName} shut out the ${team(s.winner === s.homeTeamId ? s.awayTeamId : s.homeTeamId).displayName} (${game(s)}).` });
    // Upsets by Madden's team overall rating, only when the gap is real.
    for (const s of decided.filter((x) => x.winner)) {
      const loser = s.winner === s.homeTeamId ? s.awayTeamId : s.homeTeamId;
      const gap = (team(loser).overall || 0) - (team(s.winner).overall || 0);
      if (gap >= 4 && team(s.winner).overall) storylines.push({ kind: 'Upset', gameId: s.gameId, text: `${team(s.winner).displayName} (${team(s.winner).overall} OVR) beat ${team(loser).displayName} (${team(loser).overall} OVR), ${game(s)}.` });
    }
    // Comebacks from the play-by-play
    for (const s of decided) {
      const h = engine.highlights(league, s.gameId, tracker);
      const c = h && h.highlights.find((m) => m.type === 'Comeback');
      if (c) storylines.push({ kind: 'Comeback', gameId: s.gameId, text: c.text });
    }
  }
  if (rec && stage === 'reg') {
    const teamsPlayed = new Set(decided.flatMap((s) => [s.homeTeamId, s.awayTeamId]));
    const unbeaten = Object.values(rec).filter((r) => r.l === 0 && r.w + r.t > 0 && r.w >= 2);
    if (unbeaten.length && unbeaten.length <= 6) storylines.push({ kind: 'Unbeaten', text: `Still unbeaten: ${unbeaten.map((r) => `${team(r.teamId).displayName} (${r.text})`).join(', ')}.` });
    const winless = Object.values(rec).filter((r) => r.w === 0 && r.t === 0 && r.l >= 2);
    if (winless.length && winless.length <= 6) storylines.push({ kind: 'Winless', text: `Still looking for a win: ${winless.map((r) => `${team(r.teamId).displayName} (${r.text})`).join(', ')}.` });
    for (const r of Object.values(rec)) {
      if (!teamsPlayed.has(r.teamId) || !r.streak || r.streak.length < 3) continue;
      if (r.streak.kind === 'W' && r.l === 0) continue; // already unbeaten
      if (r.streak.kind === 'L' && r.w === 0) continue; // already winless
      storylines.push({ kind: r.streak.kind === 'W' ? 'Hot streak' : 'Skid', text: `${team(r.teamId).displayName} have ${r.streak.kind === 'W' ? 'won' : 'lost'} ${r.streak.length} straight (${r.text}).` });
    }
    // First win of the season
    for (const r of Object.values(rec)) {
      const b = before && before[r.teamId];
      if (b && b.w === 0 && r.w === 1 && b.l >= 2) storylines.push({ kind: 'First win', text: `${team(r.teamId).displayName} got their first win of the season (${r.text}).` });
    }
  }

  // ---------- stat leaders, straight from the box scores
  const lines = [];
  for (const g of played) {
    for (const e of Object.values(league.playerGameStats[g.gameId] || {})) {
      const teamId = e.teamId || (league.players[e.playerId] || {}).teamId;
      const won = (g.homeTeamId === teamId && g.homeScore > g.awayScore) || (g.awayTeamId === teamId && g.awayScore > g.homeScore);
      lines.push({ playerId: e.playerId, name: name(e.playerId), position: pos(e.playerId), teamId, gameId: g.gameId, o: OFF(e), d: DEF(e), won, rookie: (league.players[e.playerId] || {}).yearsPro === 0 });
    }
  }
  const lead = (key, pick, fmt, n = 5, filter = () => true) => lines.filter((x) => pick(x) > 0 && filter(x)).sort((a, b) => pick(b) - pick(a)).slice(0, n).map((x) => ({ playerId: x.playerId, name: x.name, position: x.position, teamId: x.teamId, gameId: x.gameId, value: pick(x), line: fmt(x) }));
  const leaders = {
    passing: lead('pass', (x) => x.o.PASSYARDS || 0, (x) => `${x.o.PASSCOMPLETED || 0}/${x.o.PASSATTEMPTS || 0}, ${x.o.PASSTDS || 0} TD, ${x.o.PASSINTS || 0} INT`),
    rushing: lead('rush', (x) => x.o.RUSHYARDS || 0, (x) => `${x.o.RUSHATTEMPTS || 0} car, ${x.o.RUSHTDS || 0} TD`),
    receiving: lead('rec', (x) => x.o.RECEIVEYARDS || 0, (x) => `${x.o.RECEIVECATCHES || 0} rec, ${x.o.RECEIVETDS || 0} TD`),
    sacks: lead('sack', (x) => x.d.DLINESACKS || 0, (x) => `${x.d.DEFTACKLES || 0} tkl`),
    tackles: lead('tkl', (x) => x.d.DEFTACKLES || 0, (x) => `${x.d.DEFTACKLESFORLOSS || 0} TFL`),
    interceptions: lead('int', (x) => x.d.DSECINTS || 0, (x) => `${x.d.DEFPASSDEFLECTIONS || 0} PD${x.d.DSECINTTDS ? `, ${x.d.DSECINTTDS} TD` : ''}`),
    touchdowns: lead('td', (x) => (x.o.RUSHTDS || 0) + (x.o.RECEIVETDS || 0), (x) => `${x.o.RUSHTDS || 0} rush, ${x.o.RECEIVETDS || 0} rec`),
  };

  // ---------- players of the week, picked by this tool from the box scores
  const offScore = (x) => (x.o.PASSYARDS || 0) * 0.04 + (x.o.PASSTDS || 0) * 4 - (x.o.PASSINTS || 0) * 2.5 + (x.o.RUSHYARDS || 0) * 0.1 + (x.o.RUSHTDS || 0) * 6 + (x.o.RECEIVEYARDS || 0) * 0.1 + (x.o.RECEIVETDS || 0) * 6 + (x.o.RECEIVECATCHES || 0) * 0.3 - (x.o.RUSHFUMBLES || 0) * 2;
  const defScore = (x) => (x.d.DEFTACKLES || 0) + (x.d.ASSDEFTACKLES || 0) * 0.5 + (x.d.DLINESACKS || 0) * 4 + (x.d.DSECINTS || 0) * 5 + (x.d.DLINEFORCEDFUMBLES || 0) * 3 + (x.d.DLINEFUMBLERECOVERIES || 0) * 2 + (x.d.DEFPASSDEFLECTIONS || 0) * 1.5 + (x.d.DEFTACKLESFORLOSS || 0) * 1.5 + (x.d.DSECINTTDS || 0) * 6 + (x.d.DLINESAFETIES || 0) * 4;
  const best = (score, filter = () => true) => {
    const x = lines.filter((l) => filter(l)).map((l) => ({ l, s: score(l) + (l.won ? 2 : 0) })).filter((y) => y.s > 2).sort((a, b) => b.s - a.s)[0];
    return x ? { playerId: x.l.playerId, name: x.l.name, position: x.l.position, teamId: x.l.teamId, gameId: x.l.gameId, line: statLine(x.l.o, x.l.d) } : null;
  };
  const offense = best(offScore);
  const defense = best(defScore);
  const taken = new Set([offense, defense].filter(Boolean).map((x) => x.playerId));
  const playersOfWeek = {
    offense,
    defense,
    rookie: best((x) => Math.max(offScore(x), defScore(x)), (x) => x.rookie && !taken.has(x.playerId)),
  };

  // ---------- injuries: every game's full injury report, then anyone else
  // on Madden's injury report dated to this week (hurt away from a game).
  const injuries = [];
  const seen = new Set();
  for (const g of played) {
    const rep = gameInjuryReport(league, g.gameId, { ledger, injuryLog });
    for (const r of rep ? rep.injuries : []) {
      const k = `${r.playerId}|${r.type}`;
      if (seen.has(k)) continue;
      seen.add(k);
      injuries.push({ ...r, gameId: g.gameId });
    }
  }
  for (const p of Object.values(league.players)) {
    const inj = p.injury;
    if (!inj || inj.status !== 'Injured' || inj.week == null || !inj.stage) continue;
    if (!matchesWeek(inj, stage, week) || (inj.year != null && inj.year !== seasonYear)) continue;
    const k = `${p.playerId}|${injuryTypeName(inj.type)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const row = { playerId: p.playerId, name: p.fullName, position: p.position, teamId: p.teamId, type: injuryTypeName(inj.type), injury: injuryLabel(inj.type), severity: severityName(inj.severity), weeksMin: inj.weeksMin, weeksMax: inj.weeksMax, weeksLeft: inj.weeksTotal, stillOut: true, onIR: Boolean(inj.onIR), source: 'report', gameId: null, played: null, note: p.teamId ? 'His team did not play this week' : 'Not on a team' };
    row.severityLabel = row.severity && SEVERITY[row.severity] ? SEVERITY[row.severity].label : row.severity || '';
    row.outlook = outlook(row);
    injuries.push(row);
  }
  const SRC = { 'game-list': 0, tool: 1, report: 2, ledger: 3, export: 4 };
  injuries.sort((a, b) => (SRC[a.source] ?? 5) - (SRC[b.source] ?? 5) || (b.weeksMax || 0) - (a.weeksMax || 0) || String(a.teamId).localeCompare(String(b.teamId)));
  // Madden dates the injuries players carried into a new franchise to its
  // very first week, so that week's report includes them.
  const firstWeek = recapWeeks(league)[0];
  const carriedIn = Boolean(firstWeek && firstWeek.stage === stage && firstWeek.week === week && (seasonYear || 0) === 0);
  // A Companion App export has only today's injury report, with no dates.
  let currentReport = null;
  if (league.source !== 'franchise') {
    const lastPlayed = Object.values(league.games).filter((g) => g.status === 'played').sort((a, b) => (STAGE_RANK[a.stage] ?? 3) - (STAGE_RANK[b.stage] ?? 3) || a.week - b.week).pop();
    if (lastPlayed && lastPlayed.stage === stage && lastPlayed.week === week) {
      currentReport = Object.values(league.players).filter((p) => p.injury && p.injury.status === 'Injured' && p.teamId).map((p) => ({ playerId: p.playerId, name: p.fullName, position: p.position, teamId: p.teamId, injury: prettyInjury(p.injury.type), weeksLeft: p.injury.weeksTotal, onIR: Boolean(p.injury.onIR) })).sort((a, b) => (b.weeksLeft || 0) - (a.weeksLeft || 0));
    }
  }

  // ---------- Madden's own news for the week
  const news = league.news || null;
  const inYear = (x) => x.year == null || x.year === seasonYear;
  const stories = news ? news.stories.filter((x) => matchesWeek(x, stage, week) && inYear(x)).sort((a, b) => Number(b.breaking) - Number(a.breaking) || a.priority - b.priority) : [];
  const posts = news ? news.posts.filter((x) => matchesWeek(x, stage, week) && inYear(x)) : [];
  const transactions = news ? news.transactions.filter((x) => matchesWeek(x, stage, week) && inYear(x)) : [];

  // ---------- the tool's advanced numbers for the week (reconstructed)
  const blockers = [];
  const rushers = [];
  const tacklers = [];
  const flags = [];
  const drops = [];
  for (const g of played) {
    const res = engine.game(league, g.gameId, tracker);
    for (const [tid, t] of Object.entries(res.teams)) {
      for (const b of t.blocking.blockers) blockers.push({ ...b, teamId: tid, gameId: g.gameId });
      for (const r of t.passRush.players) rushers.push({ ...r, teamId: tid, gameId: g.gameId });
      for (const r of t.tackling.players) tacklers.push({ ...r, teamId: tid, gameId: g.gameId });
      for (const r of t.penalties.players) flags.push({ ...r, teamId: tid, gameId: g.gameId });
      for (const r of t.receiving.players) drops.push({ ...r, teamId: tid, gameId: g.gameId });
    }
  }
  const pickTop = (list, key, n, filter = () => true) => list.filter((x) => filter(x) && (x[key] || 0) > 0).sort((a, b) => b[key] - a[key]).slice(0, n).map((x) => ({ playerId: x.playerId, name: x.name, position: x.position, teamId: x.teamId, gameId: x.gameId, value: x[key], source: x.source || null }));
  const advanced = {
    bestBlockers: pickTop(blockers, 'blockGrade', 5, (b) => b.passBlockSnaps >= 20),
    mostPressuresAllowed: pickTop(blockers, 'pressuresAllowed', 5),
    topPassRushers: pickTop(rushers, 'pressures', 5),
    mostDrops: pickTop(drops, 'drops', 5),
    mostMissedTackles: pickTop(tacklers, 'missedTackles', 5),
    mostPenalties: pickTop(flags, 'penalties', 5),
  };

  // ---------- highlights of the week
  const allHl = played.map((g) => engine.highlights(league, g.gameId, tracker)).filter(Boolean);
  const flat = (key) => allHl.flatMap((h) => h[key]).sort((a, b) => b.impact - a.impact).slice(0, 10);

  // ---------- standings after the week
  let standings = null;
  if (rec) {
    const rows = Object.values(rec).map((r) => ({ ...r, abbr: team(r.teamId).abbr, name: team(r.teamId).displayName, division: team(r.teamId).division || DIVISION_OF[team(r.teamId).abbr] || null, change: before ? r.w - before[r.teamId].w : 0, results: undefined }));
    const order = (a, b) => b.pct - a.pct || (b.pf - b.pa) - (a.pf - a.pa) || a.abbr.localeCompare(b.abbr);
    const byDiv = {};
    for (const r of rows) (byDiv[r.division || 'League'] ||= []).push(r);
    standings = { divisions: Object.entries(byDiv).sort(([a], [b]) => a.localeCompare(b)).map(([division, list]) => ({ division, teams: list.sort(order) })), league: rows.slice().sort(order) };
  }

  // ---------- coming up
  const nextGames = Object.values(league.games)
    .filter((g) => g.status !== 'played' && ((g.stage === stage && g.week === week + 1) || (g.stage !== stage && (STAGE_RANK[g.stage] ?? 3) === (STAGE_RANK[stage] ?? 3) + 1 && g.week === Math.min(...Object.values(league.games).filter((x) => x.stage === g.stage).map((x) => x.week)))))
    .sort((a, b) => (STAGE_RANK[a.stage] ?? 3) - (STAGE_RANK[b.stage] ?? 3) || String(a.gameId).localeCompare(String(b.gameId)));
  const nextWeekGames = nextGames.length ? nextGames.filter((g) => g.stage === nextGames[0].stage && g.week === nextGames[0].week) : [];
  const upcoming = nextWeekGames.map((g) => ({ gameId: g.gameId, label: g.label, away: team(g.awayTeamId).abbr, home: team(g.homeTeamId).abbr, awayRecord: rec && rec[g.awayTeamId] && g.stage === stage ? rec[g.awayTeamId].text : null, homeRecord: rec && rec[g.homeTeamId] && g.stage === stage ? rec[g.homeTeamId].text : null }));

  // ---------- league tables (new systems)
  const tableStage = stage === 'post' ? 'reg' : stage;
  const lastRegWeek = Math.max(-1, ...Object.values(league.games).filter((g) => g.status === 'played' && g.stage === 'reg' && (g.seasonYear ?? seasonYear) === seasonYear).map((g) => g.week));
  const tableWeek = stage === 'post' ? lastRegWeek : week;
  const power = tableWeek >= 0 ? powerRankings(league, tableStage, seasonYear, tableWeek) : [];
  const playoffs = stage === 'reg' ? playoffPicture(league, seasonYear, week) : [];
  const playedIds = played.map((g) => g.gameId);
  const gotw = gameOfTheWeek(league, nextWeekGames, rec ? results(league, stage, seasonYear, week) : null, power);

  const totalPoints = decided.reduce((s, x) => s + x.homeScore + x.awayScore, 0);
  return {
    stage,
    week,
    label,
    seasonYear,
    source: league.source,
    hasNews: Boolean(news),
    summary: {
      gamesPlayed: decided.length,
      gamesScheduled: weekGames.length,
      totalPoints,
      averagePoints: decided.length ? Math.round((totalPoints / decided.length) * 10) / 10 : 0,
      homeWins: decided.filter((s) => s.winner && s.winner === s.homeTeamId).length,
      awayWins: decided.filter((s) => s.winner && s.winner === s.awayTeamId).length,
      injuries: injuries.length,
      minorInjuries: injuries.filter((i) => i.outlook && i.outlook.key === 'minor').length,
      transactions: transactions.length,
    },
    scores,
    storylines,
    leaders,
    playersOfWeek,
    highlights: flat('highlights'),
    lowlights: flat('lowlights'),
    injuries,
    injuryNote: carriedIn ? 'This is the first week of the franchise, so Madden dates every injury players brought into it (from before the season) to this week too.' : null,
    currentReport,
    stories,
    posts,
    transactions: transactions.map((x) => ({ ...x, fromAbbr: x.fromTeamId ? team(x.fromTeamId).abbr : null, toAbbr: x.toTeamId ? team(x.toTeamId).abbr : null })),
    advanced,
    standings,
    upcoming,
    gameOfTheWeek: gotw,
    powerRankings: power,
    powerRankingsNote: stage === 'post' ? 'Through the end of the regular season.' : null,
    playoffPicture: playoffs,
    bigPerformances: bigPerformances(league, playedIds).slice(0, 20),
    fantasy: fantasyLeaders(league, playedIds, 10),
    seasonLeaders: seasonLeaders(league, stage, seasonYear, week),
    teamAwards: teamAwards(league, played),
  };
}

// Weeks that have at least one played game, oldest first.
export function recapWeeks(league) {
  const seen = new Map();
  for (const g of Object.values(league.games)) {
    if (g.status !== 'played') continue;
    const k = `${g.stage}:${g.week}`;
    if (!seen.has(k)) seen.set(k, { stage: g.stage, week: g.week, label: g.label, games: 0 });
    seen.get(k).games++;
  }
  return [...seen.values()].sort((a, b) => (STAGE_RANK[a.stage] ?? 3) - (STAGE_RANK[b.stage] ?? 3) || a.week - b.week);
}
