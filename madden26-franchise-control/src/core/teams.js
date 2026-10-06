// Everything about one team: record and standing, how it is playing, its
// schedule and results, roster, stat leaders, injuries, news and money.
// Records, stats and news are counted from what Madden saved; the power
// rank is the tool's formula (see league-table.js).

import { results, powerRankings, divisionOf } from './stats/league-table.js';
import { seasonTotals } from './stats/aggregate.js';
import { editability } from './franchise/schedule.js';
import { positionRank, group as positionGroup, GROUP_LABEL } from './positions.js';
import { injuryLabel, severityName, SEVERITY } from './injuries/game-injuries.js';
import { passerRating } from './stats/boxscore.js';

const STAGE_RANK = { pre: 0, reg: 1, post: 2 };
const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function pickStage(league, teamId, stage) {
  if (stage && stage !== 'auto') return stage;
  const played = Object.values(league.games).filter((g) => g.status === 'played' && (g.homeTeamId === teamId || g.awayTeamId === teamId));
  if (played.some((g) => g.stage === 'post')) return 'post';
  if (played.some((g) => g.stage === 'reg')) return 'reg';
  if (played.some((g) => g.stage === 'pre')) return 'pre';
  return Object.values(league.games).some((g) => g.stage === 'reg') ? 'reg' : 'pre';
}

// Per-game team numbers for every team in one part of the season, for ranks.
function teamSeasonStats(league, stage, seasonYear) {
  const out = {};
  for (const id of Object.keys(league.teams)) out[id] = { games: 0, pf: 0, pa: 0, yards: 0, passYds: 0, rushYds: 0, yardsAllowed: 0, passAllowed: 0, rushAllowed: 0, giveaways: 0, takeaways: 0, sacks: 0, sacksAllowed: 0, penalties: 0, penaltyYards: 0, third: 0, thirdConv: 0, rz: 0, rzTd: 0, top: 0, firstDowns: 0 };
  for (const g of Object.values(league.games)) {
    if (g.status !== 'played' || g.stage !== stage || (g.seasonYear ?? seasonYear) !== seasonYear) continue;
    for (const [me, opp] of [[g.homeTeamId, g.awayTeamId], [g.awayTeamId, g.homeTeamId]]) {
      const s = out[me];
      if (!s) continue;
      const t = (league.teamGameStats[g.gameId] || {})[me] || {};
      const o = (league.teamGameStats[g.gameId] || {})[opp] || {};
      s.games++;
      s.pf += me === g.homeTeamId ? g.homeScore : g.awayScore;
      s.pa += me === g.homeTeamId ? g.awayScore : g.homeScore;
      s.yards += n(t.OFFYARDS ?? t.TOTALYARDS); s.passYds += n(t.OFFPASSYARDS); s.rushYds += n(t.OFFRUSHYARDS);
      s.yardsAllowed += n(o.OFFYARDS ?? o.TOTALYARDS); s.passAllowed += n(o.OFFPASSYARDS); s.rushAllowed += n(o.OFFRUSHYARDS);
      s.giveaways += n(t.GIVEAWAYS); s.takeaways += n(t.TAKEAWAYS); s.sacks += n(t.SACKS); s.sacksAllowed += n(t.SACKSALLOWED);
      s.penalties += n(t.PENALTIES); s.penaltyYards += n(t.PENALTYYARDS); s.third += n(t.THIRDDOWNS); s.thirdConv += n(t.THIRDDOWNCONV);
      s.rz += n(t.OFFREDZONES); s.rzTd += n(t.OFFREDZONETDS); s.top += n(t.POSSESSIONTIME); s.firstDowns += n(t.FIRSTDOWNS);
    }
  }
  return out;
}

const PER_GAME = [
  ['Points per game', 'pf', true],
  ['Points allowed per game', 'pa', false],
  ['Yards per game', 'yards', true],
  ['Passing yards per game', 'passYds', true],
  ['Rushing yards per game', 'rushYds', true],
  ['Yards allowed per game', 'yardsAllowed', false],
  ['Passing yards allowed per game', 'passAllowed', false],
  ['Rushing yards allowed per game', 'rushAllowed', false],
  ['Sacks per game', 'sacks', true],
  ['Sacks allowed per game', 'sacksAllowed', false],
  ['Takeaways per game', 'takeaways', true],
  ['Giveaways per game', 'giveaways', false],
  ['Penalty yards per game', 'penaltyYards', false],
  ['First downs per game', 'firstDowns', true],
];

export function teamProfile(league, engine, tracker, teamId, { stage = null, ledger = null } = {}) {
  const team = league.teams[teamId];
  if (!team) throw new Error('Unknown team');
  const st = pickStage(league, teamId, stage);
  const mine = Object.values(league.games).filter((g) => g.homeTeamId === teamId || g.awayTeamId === teamId);
  const seasonYear = mine.length ? Math.max(...mine.map((g) => g.seasonYear ?? 0)) : league.season.year || 0;
  const inSeason = mine.filter((g) => (g.seasonYear ?? seasonYear) === seasonYear).sort((a, b) => (STAGE_RANK[a.stage] ?? 3) - (STAGE_RANK[b.stage] ?? 3) || a.week - b.week);
  const playedSt = inSeason.filter((g) => g.stage === st && g.status === 'played');
  const lastWeek = playedSt.length ? Math.max(...playedSt.map((g) => g.week)) : -1;
  const recordStage = st === 'post' ? 'reg' : st;
  const lastRecWeek = Math.max(-1, ...Object.values(league.games).filter((g) => g.status === 'played' && g.stage === recordStage && (g.seasonYear ?? seasonYear) === seasonYear).map((g) => g.week));
  const res = results(league, recordStage, seasonYear, lastRecWeek);
  const me = res[teamId];
  const T = (id) => league.teams[id] || { abbr: '?', displayName: 'Unknown' };

  // ---------- standing
  const division = divisionOf(team);
  const order = (a, b) => b.pct - a.pct || b.diff - a.diff || (T(a.teamId).abbr || '').localeCompare(T(b.teamId).abbr || '');
  const all = Object.values(res).sort(order);
  const divTeams = division ? all.filter((r) => divisionOf(T(r.teamId)) === division) : [];
  const conf = division ? division.split(' ')[0] : null;
  const confTeams = conf ? all.filter((r) => (divisionOf(T(r.teamId)) || '').startsWith(conf)) : [];
  const power = lastRecWeek >= 0 ? powerRankings(league, recordStage, seasonYear, lastRecWeek) : [];
  const myPower = power.find((p) => p.teamId === teamId) || null;
  let streak = null;
  for (let i = me.games.length - 1, k = null, c = 0; i >= 0; i--) {
    const r = me.games[i].res;
    if (k === null) k = r;
    if (r !== k) break;
    c++;
    streak = { kind: k, length: c, text: `${k}${c}` };
  }

  // ---------- schedule and results (every stage this season)
  const recAfter = {};
  for (const s of ['pre', 'reg']) {
    let w = 0, l = 0, t = 0;
    for (const g of inSeason.filter((x) => x.stage === s && x.status === 'played')) {
      const pf = g.homeTeamId === teamId ? g.homeScore : g.awayScore;
      const pa = g.homeTeamId === teamId ? g.awayScore : g.homeScore;
      if (pf > pa) w++; else if (pf < pa) l++; else t++;
      recAfter[g.gameId] = `${w}-${l}${t ? `-${t}` : ''}`;
    }
  }
  const schedule = inSeason.map((g) => {
    const home = g.homeTeamId === teamId;
    const opp = home ? g.awayTeamId : g.homeTeamId;
    const pf = home ? g.homeScore : g.awayScore;
    const pa = home ? g.awayScore : g.homeScore;
    const ed = editability(league, g);
    return {
      gameId: g.gameId, stage: g.stage, week: g.week, label: g.label, home, opponentId: opp, opponent: T(opp).abbr, opponentName: T(opp).displayName,
      opponentRecord: res[opp] && g.stage === recordStage ? res[opp].text : null,
      status: g.status, result: g.status === 'played' ? `${pf > pa ? 'W' : pf < pa ? 'L' : 'T'} ${pf}-${pa}` : null,
      won: g.status === 'played' ? pf > pa : null, recordAfter: recAfter[g.gameId] || null, editable: ed.ok,
    };
  });
  // Bye weeks: regular-season weeks other teams play in and this team does not.
  const regWeeks = [...new Set(Object.values(league.games).filter((g) => g.stage === 'reg' && (g.seasonYear ?? seasonYear) === seasonYear).map((g) => g.week))].sort((a, b) => a - b);
  const myRegWeeks = new Set(inSeason.filter((g) => g.stage === 'reg').map((g) => g.week));
  const byes = regWeeks.filter((w) => !myRegWeeks.has(w)).map((w) => ({ stage: 'reg', week: w, label: `Week ${w + 1}`, bye: true }));
  const nextGame = schedule.find((g) => g.status !== 'played') || null;
  const lastGame = [...schedule].reverse().find((g) => g.status === 'played') || null;

  // ---------- team stats and league ranks
  const ts = teamSeasonStats(league, st, seasonYear);
  const per = (s, k) => (s.games ? s[k] / s.games : null);
  const ranks = PER_GAME.map(([label, key, high]) => {
    const vals = Object.entries(ts).filter(([, s]) => s.games).map(([id, s]) => ({ id, v: per(s, key) }));
    vals.sort((a, b) => (high ? b.v - a.v : a.v - b.v));
    const mineV = per(ts[teamId], key);
    const rank = vals.findIndex((x) => x.id === teamId) + 1;
    return { label, value: mineV == null ? null : Math.round(mineV * 10) / 10, rank: rank || null, of: vals.length };
  });
  const s0 = ts[teamId];
  const extra = {
    thirdDown: s0.third ? `${s0.thirdConv}/${s0.third} (${Math.round((s0.thirdConv / s0.third) * 100)}%)` : null,
    redZone: s0.rz ? `${s0.rzTd}/${s0.rz} TD (${Math.round((s0.rzTd / s0.rz) * 100)}%)` : null,
    possession: s0.games && s0.top ? `${Math.floor(s0.top / s0.games / 60)}:${String(Math.round((s0.top / s0.games) % 60)).padStart(2, '0')}` : null,
    turnoverMargin: s0.takeaways - s0.giveaways,
  };

  // ---------- stat leaders from this team's games
  const tot = new Map();
  for (const g of inSeason.filter((x) => x.stage === st && x.status === 'played')) {
    for (const e of Object.values(league.playerGameStats[g.gameId] || {})) {
      if ((e.teamId || (league.players[e.playerId] || {}).teamId) !== teamId) continue;
      const p = league.players[e.playerId];
      const t = tot.get(e.playerId) || { playerId: e.playerId, name: p ? p.fullName : 'Unknown', position: p ? p.position : '', games: 0, PASSATTEMPTS: 0, PASSCOMPLETED: 0, PASSYARDS: 0, PASSTDS: 0, PASSINTS: 0, RUSHATTEMPTS: 0, RUSHYARDS: 0, RUSHTDS: 0, RECEIVECATCHES: 0, RECEIVEYARDS: 0, RECEIVETDS: 0, DEFTACKLES: 0, DLINESACKS: 0, DSECINTS: 0, DLINEFORCEDFUMBLES: 0 };
      t.games++;
      for (const k of Object.keys(t)) if (typeof t[k] === 'number' && k !== 'games') t[k] += n((e.offense || {})[k]) + n((e.defense || {})[k]);
      tot.set(e.playerId, t);
    }
  }
  const P = [...tot.values()];
  const top = (key, k = 3) => P.filter((x) => x[key] > 0).sort((a, b) => b[key] - a[key]).slice(0, k).map((x) => ({ playerId: x.playerId, name: x.name, position: x.position, value: x[key], games: x.games, line: lineFor(key, x) }));
  const leaders = { passing: top('PASSYARDS', 2), rushing: top('RUSHYARDS'), receiving: top('RECEIVEYARDS'), tackles: top('DEFTACKLES'), sacks: top('DLINESACKS'), interceptions: top('DSECINTS') };

  // ---------- roster
  const roster = Object.values(league.players).filter((p) => p.teamId === teamId);
  const depth = new Map();
  for (const p of roster.slice().sort((a, b) => (b.overall || 0) - (a.overall || 0))) {
    const k = p.position;
    depth.set(p.playerId, (depth.get(`#${k}`) || 0) + 1);
    depth.set(`#${k}`, (depth.get(`#${k}`) || 0) + 1);
  }
  const rosterRows = roster.map((p) => {
    const c = p.contract;
    const inj = p.injury && ['Injured', 'EarlyReturn'].includes(p.injury.status) ? p.injury : null;
    return {
      playerId: p.playerId, name: p.fullName, position: p.position, group: positionGroup(p.position), groupLabel: GROUP_LABEL[positionGroup(p.position)] || 'Other',
      jerseyNum: p.jerseyNum, age: p.age, overall: p.overall, devTrait: p.devTrait, yearsPro: p.yearsPro, depth: depth.get(p.playerId),
      status: p.contractStatus, capHit: c ? c.capHit : null, yearsLeft: c ? c.yearsLeft : null,
      injury: inj ? `${injuryLabel(inj.type)}${inj.weeksTotal ? `, ${inj.weeksTotal} wk` : ''}${inj.onIR ? ' (IR)' : ''}` : null,
    };
  }).sort((a, b) => positionRank(a.position) - positionRank(b.position) || (b.overall || 0) - (a.overall || 0));
  const byGroup = {};
  for (const r of rosterRows) (byGroup[r.groupLabel] ||= []).push(r);
  const avgOvr = (list) => (list.length ? Math.round(list.reduce((s, x) => s + (x.overall || 0), 0) / list.length) : null);
  const starters = (pos, k) => rosterRows.filter((r) => r.position === pos).slice(0, k);
  const unitOvr = {
    'Quarterback': avgOvr(starters('QB', 1)),
    'Offensive line': avgOvr(['LT', 'LG', 'C', 'RG', 'RT'].flatMap((p) => starters(p, 1))),
    'Skill players': avgOvr([...starters('HB', 1), ...starters('WR', 3), ...starters('TE', 1)]),
    'Defensive line': avgOvr([...starters('LE', 1), ...starters('RE', 1), ...starters('DT', 2)]),
    'Linebackers': avgOvr(['LOLB', 'MLB', 'ROLB'].flatMap((p) => starters(p, 1))),
    'Secondary': avgOvr([...starters('CB', 2), ...starters('FS', 1), ...starters('SS', 1)]),
  };

  // ---------- injuries
  const currentInjuries = rosterRows.filter((r) => r.injury);
  const history = Object.values((ledger && ledger.entries) || {}).filter((e) => e.teamId === teamId).sort((a, b) => String(b.lastSeenAt).localeCompare(String(a.lastSeenAt))).slice(0, 40).map((e) => ({
    playerId: e.playerId, name: e.name, position: e.position, injury: injuryLabel(e.type), severity: severityName(e.severity), severityLabel: SEVERITY[severityName(e.severity)] ? SEVERITY[severityName(e.severity)].label : '',
    gameId: e.gameId || null, healed: Boolean(e.healedSeenAt), firstSeenAt: e.firstSeenAt,
  }));

  // ---------- news (Madden's own, from a franchise file)
  const news = league.news || { stories: [], posts: [], transactions: [] };
  const teamNews = {
    available: Boolean(league.news),
    stories: news.stories.filter((x) => x.teamId === teamId),
    posts: news.posts.filter((x) => x.teamId === teamId),
    transactions: news.transactions.filter((x) => x.fromTeamId === teamId || x.toTeamId === teamId).slice().reverse().map((x) => ({ ...x, direction: x.toTeamId === teamId && x.fromTeamId !== teamId ? 'in' : x.fromTeamId === teamId && x.toTeamId !== teamId ? 'out' : 'stays', fromAbbr: x.fromTeamId ? T(x.fromTeamId).abbr : null, toAbbr: x.toTeamId ? T(x.toTeamId).abbr : null })),
  };

  // ---------- the tool's advanced numbers for the season
  const adv = seasonTotals(league, engine, tracker, { stage: st, teamId }).teams[teamId] || null;

  // ---------- money
  const contracts = roster.filter((p) => p.contract && p.contract.capHit > 0).sort((a, b) => b.contract.capHit - a.contract.capHit).slice(0, 5).map((p) => ({ playerId: p.playerId, name: p.fullName, position: p.position, capHit: p.contract.capHit, yearsLeft: p.contract.yearsLeft }));

  return {
    teamId,
    team: { abbr: team.abbr, name: team.displayName, city: team.city, nick: team.nick, overall: team.overall || null, olRating: team.olRating || null, dlRating: team.dlRating || null, division, conference: conf, userControlled: Boolean(team.userControlled) },
    stage: st,
    seasonYear,
    record: { text: me.text, w: me.w, l: me.l, t: me.t, pf: me.pf, pa: me.pa, diff: me.diff, streak, stage: recordStage, form: me.games.slice(-5).map((x) => x.res).join('') },
    standing: {
      division: divTeams.length ? { name: division, place: divTeams.findIndex((r) => r.teamId === teamId) + 1, of: divTeams.length, teams: divTeams.map((r) => ({ teamId: r.teamId, abbr: T(r.teamId).abbr, record: r.text, diff: r.diff })) } : null,
      conference: confTeams.length ? { name: conf, place: confTeams.findIndex((r) => r.teamId === teamId) + 1, of: confTeams.length } : null,
      league: { place: all.findIndex((r) => r.teamId === teamId) + 1, of: all.length },
      power: myPower ? { rank: myPower.rank, move: myPower.move, power: myPower.power } : null,
    },
    nextGame,
    lastGame,
    schedule,
    byes,
    ranks,
    extra,
    leaders,
    unitOvr,
    roster: rosterRows,
    rosterGroups: Object.entries(byGroup).map(([label, players]) => ({ label, players })),
    rosterCount: { total: rosterRows.length, injured: currentInjuries.length, onIR: roster.filter((p) => p.injury && p.injury.onIR).length },
    injuries: { current: currentInjuries, history },
    news: teamNews,
    advanced: adv ? { ...adv } : null,
    cap: team.cap || null,
    topContracts: contracts,
    canEditSchedule: league.source === 'franchise',
  };
}

function lineFor(key, x) {
  if (key === 'PASSYARDS') return `${x.PASSCOMPLETED}/${x.PASSATTEMPTS}, ${x.PASSTDS} TD, ${x.PASSINTS} INT, rating ${passerRating(x) ?? '—'}`;
  if (key === 'RUSHYARDS') return `${x.RUSHATTEMPTS} car, ${x.RUSHATTEMPTS ? (x.RUSHYARDS / x.RUSHATTEMPTS).toFixed(1) : '0.0'} avg, ${x.RUSHTDS} TD`;
  if (key === 'RECEIVEYARDS') return `${x.RECEIVECATCHES} rec, ${x.RECEIVETDS} TD`;
  if (key === 'DEFTACKLES') return `${x.games} g`;
  if (key === 'DLINESACKS') return `${x.DEFTACKLES} tkl`;
  if (key === 'DSECINTS') return `${x.games} g`;
  return '';
}
