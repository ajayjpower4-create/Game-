// Stats built from what an FC 26 career save records: league tables, the
// season's numbers per player (league goals, appearances and cards from the
// squad links; minutes and ratings from every rated match), leaderboards,
// club and player pages, transfers and the manager's record.

import { GROUP_ORDER, GROUP_LABEL, ATTRIBUTE_GROUPS } from './career.js';

const r1 = (x) => (Number.isFinite(x) ? Math.round(x * 10) / 10 : null);
const r2 = (x) => (Number.isFinite(x) ? Math.round(x * 100) / 100 : null);
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
function sd(xs) {
  if (xs.length < 2) return null;
  const m = avg(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

export const clubName = (c, id) => (c.clubs[id] ? c.clubs[id].name : id > 0 ? `Club ${id}` : '—');

export function competitionName(c, id) {
  if (c.competitions[id]) return c.competitions[id].name;
  if (c.leagues[id]) return c.leagues[id].name;
  return id ? `Competition ${id}` : '—';
}

// Ratings from this season only (the save keeps older ones too).
export function seasonRatings(c) {
  return c.seasonStart ? c.ratings.filter((r) => r.date && r.date >= c.seasonStart) : c.ratings;
}

// Each player's season from the save.
export function playerSeasons(c) {
  const out = new Map();
  for (const r of seasonRatings(c)) {
    let s = out.get(r.playerId);
    if (!s) out.set(r.playerId, (s = { ratings: [], minutes: 0, matches: 0, minutesKnown: 0 }));
    s.ratings.push(r);
    s.matches++;
    if (Number.isFinite(r.minutes)) { s.minutes += r.minutes; s.minutesKnown++; }
  }
  const result = new Map();
  for (const [pid, s] of out) {
    const vals = s.ratings.map((x) => x.rating);
    const last5 = vals.slice(-5);
    const a = avg(vals);
    result.set(pid, {
      matches: s.matches,
      minutes: s.minutesKnown ? s.minutes : null,
      avgRating: r2(a),
      best: Math.max(...vals),
      worst: Math.min(...vals),
      eightPlus: vals.filter((v) => v >= 8).length,
      underSix: vals.filter((v) => v < 6).length,
      last5: r2(avg(last5)),
      trend: vals.length >= 6 ? r2(avg(last5) - a) : null,
      consistency: r2(sd(vals)),
      ratings: s.ratings,
    });
  }
  return result;
}

function playerRow(c, p, seasons) {
  const s = seasons.get(p.playerId) || null;
  const club = c.clubs[p.clubId];
  return {
    playerId: p.playerId,
    name: p.name,
    nameSource: p.nameSource,
    position: p.position,
    group: p.group,
    age: p.age,
    ovr: p.ovr,
    pot: p.pot,
    nation: p.nation,
    clubId: p.clubId,
    club: club ? club.name : null,
    jersey: p.jersey,
    slot: p.slot,
    leagueGoals: p.season ? p.season.leagueGoals : 0,
    leagueApps: p.season ? p.season.leagueApps : 0,
    yellows: p.season ? p.season.yellows : 0,
    reds: p.season ? p.season.reds : 0,
    matches: s ? s.matches : 0,
    minutes: s ? s.minutes : null,
    avgRating: s ? s.avgRating : null,
    best: s ? s.best : null,
    eightPlus: s ? s.eightPlus : 0,
    last5: s ? s.last5 : null,
    trend: s ? s.trend : null,
    consistency: s ? s.consistency : null,
    wage: p.contract ? p.contract.wage : null,
    role: p.contract ? p.contract.role : null,
    contractUntil: p.contractUntil,
    loan: p.loan ? { fromId: p.loan.fromId, from: clubName(c, p.loan.fromId), until: p.loan.until, toBuy: p.loan.toBuy } : null,
    suspension: p.suspension,
    ovrChange: p.ovrChange ? p.ovrChange.now - p.ovrChange.before : null,
    youth: Boolean(p.youth),
  };
}

// Leagues worth showing: club leagues with at least two clubs, yours first.
export function leagueList(c) {
  const userLeague = c.userClubId ? c.clubs[c.userClubId].leagueId : null;
  return Object.values(c.leagues)
    .filter((l) => l.club && (c.standings[l.leagueId] || []).length >= 2)
    .map((l) => ({ leagueId: l.leagueId, name: l.name, level: l.level, clubs: c.standings[l.leagueId].length, played: c.standings[l.leagueId].some((r) => r.played > 0), yours: l.leagueId === userLeague }))
    .sort((a, b) => (b.yours - a.yours) || (b.played - a.played) || (a.level || 9) - (b.level || 9) || a.name.localeCompare(b.name));
}

export function standingsView(c, leagueId) {
  const rows = c.standings[leagueId] || [];
  const league = c.leagues[leagueId];
  return {
    leagueId,
    league: league ? league.name : `League ${leagueId}`,
    rows: rows.map((r) => ({
      ...r,
      club: clubName(c, r.clubId),
      isUser: r.clubId === c.userClubId,
      ppg: r.played ? r2(r.points / r.played) : null,
      winPct: r.played ? Math.round((r.won / r.played) * 100) : null,
      gfPerGame: r.played ? r2(r.gf / r.played) : null,
      gaPerGame: r.played ? r2(r.ga / r.played) : null,
      homePoints: r.home.won * 3 + r.home.drawn,
      awayPoints: r.away.won * 3 + r.away.drawn,
      moved: r.lastSeasonPosition > 0 && r.position > 0 ? r.lastSeasonPosition - r.position : null,
      ovr: c.clubs[r.clubId] ? c.clubs[r.clubId].ovr : null,
    })),
    pointsPerGame: rows.length ? r2(avg(rows.filter((r) => r.played).map((r) => r.points / r.played))) : null,
  };
}

// Leaderboards for one league (or every league), from the save.
export function leaders(c, { leagueId = null, clubId = null, limit = 10 } = {}) {
  const seasons = playerSeasons(c);
  const inScope = (p) => p.clubId != null && (!clubId || p.clubId === Number(clubId)) && (!leagueId || (c.clubs[p.clubId] && c.clubs[p.clubId].leagueId === Number(leagueId)));
  const rows = Object.values(c.players).filter(inScope).map((p) => playerRow(c, p, seasons));
  const top = (list, key, { min = null, dir = -1, filter = () => true } = {}) => list.filter((r) => r[key] != null && (min == null || r[key] >= min) && filter(r)).sort((a, b) => dir * (a[key] - b[key]) || (b.ovr || 0) - (a.ovr || 0)).slice(0, limit);
  const maxMatches = Math.max(0, ...rows.map((r) => r.matches));
  const minMatches = Math.max(3, Math.ceil(maxMatches * 0.3));
  const rated = rows.filter((r) => r.matches >= minMatches);
  const scorers = rows.filter((r) => r.leagueGoals > 0);
  const discipline = rows.map((r) => ({ ...r, cardPoints: r.yellows + r.reds * 3 })).filter((r) => r.cardPoints > 0);
  return {
    minMatches,
    goldenBoot: top(scorers, 'leagueGoals'),
    goalsPerGame: top(scorers.filter((r) => r.leagueApps >= 3).map((r) => ({ ...r, goalsPerGame: r2(r.leagueGoals / r.leagueApps) })), 'goalsPerGame'),
    appearances: top(rows.filter((r) => r.leagueApps > 0), 'leagueApps'),
    bestRated: top(rated, 'avgRating'),
    inForm: top(rows.filter((r) => r.matches >= 5), 'last5'),
    risingForm: top(rows.filter((r) => r.trend != null), 'trend'),
    mostMinutes: top(rows.filter((r) => r.minutes), 'minutes'),
    eightPlus: top(rows.filter((r) => r.eightPlus > 0), 'eightPlus'),
    bestSingle: seasonRatings(c).filter((r) => { const p = c.players[r.playerId]; return p && inScope(p); }).sort((a, b) => b.rating - a.rating).slice(0, limit).map((r) => ({ ...playerRow(c, c.players[r.playerId], seasons), date: r.date, matchRating: r.rating, matchMinutes: r.minutes })),
    mostConsistent: top(rated.filter((r) => r.consistency != null), 'consistency', { dir: 1 }),
    discipline: top(discipline, 'cardPoints'),
    ovrRisers: top(rows.filter((r) => r.ovrChange > 0), 'ovrChange'),
    ovrFallers: top(rows.filter((r) => r.ovrChange < 0), 'ovrChange', { dir: 1 }),
    wonderkids: top(rows.filter((r) => r.age != null && r.age <= 21), 'pot'),
    topEarners: top(rows.filter((r) => r.wage), 'wage'),
  };
}

// The XI picked in the save: players in a real position slot.
function startingXI(players) {
  return players.filter((p) => p.slot && !['SUB', 'RES'].includes(p.slot));
}

export function clubProfile(c, clubId) {
  const id = Number(clubId);
  const club = c.clubs[id];
  if (!club) throw new Error('Unknown club');
  const seasons = playerSeasons(c);
  const squad = Object.values(c.players).filter((p) => p.clubId === id);
  const rows = squad.map((p) => playerRow(c, p, seasons));
  const groups = GROUP_ORDER.map((g) => ({ group: g, label: GROUP_LABEL[g], players: rows.filter((r) => r.group === g).sort((a, b) => (b.ovr || 0) - (a.ovr || 0)) })).filter((g) => g.players.length);
  const xi = startingXI(rows);
  const league = club.leagueId != null ? standingsView(c, club.leagueId) : null;
  const row = league ? league.rows.find((r) => r.clubId === id) : null;
  const wages = rows.reduce((s, r) => s + (r.wage || 0), 0);
  const ages = rows.map((r) => r.age).filter(Number.isFinite);
  const transfersIn = c.transfers.filter((t) => t.toId === id).map((t) => ({ ...t, name: c.players[t.playerId] ? c.players[t.playerId].name : `Player #${t.playerId}`, from: clubName(c, t.fromId) }));
  const transfersOut = c.transfers.filter((t) => t.fromId === id).map((t) => ({ ...t, name: c.players[t.playerId] ? c.players[t.playerId].name : `Player #${t.playerId}`, to: clubName(c, t.toId) }));
  const loanedOut = Object.values(c.players).filter((p) => p.loan && p.loan.fromId === id).map((p) => playerRow(c, p, seasons));
  const fixtures = c.fixtures.filter((f) => f.homeId === id || f.awayId === id).map((f) => ({ ...f, home: f.homeId === id, opponentId: f.homeId === id ? f.awayId : f.homeId, opponent: clubName(c, f.homeId === id ? f.awayId : f.homeId), competition: competitionName(c, f.competitionId) }));
  return {
    club: { ...club, league: league ? league.league : null, rival: club.rivalId ? clubName(c, club.rivalId) : null, captain: club.captainId && c.players[club.captainId] ? c.players[club.captainId].name : null },
    standing: row ? { ...row, of: league.rows.length } : null,
    squadSize: rows.length,
    averageAge: r1(avg(ages)),
    averageOvr: r1(avg(rows.map((r) => r.ovr).filter(Boolean))),
    xiOvr: xi.length ? r1(avg(xi.map((r) => r.ovr))) : null,
    xi: xi.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group)),
    groups,
    wages: wages || null,
    wageBudget: c.manager && c.manager.clubId === id && c.manager.budget ? c.manager.budget.wage : null,
    transferBudget: c.manager && c.manager.clubId === id && c.manager.budget ? c.manager.budget.transfer : null,
    leaders: leaders(c, { clubId: id, limit: 5 }),
    contractsEnding: rows.filter((r) => r.contractUntil && c.date && r.contractUntil <= Number(c.date.slice(0, 4)) + 1).sort((a, b) => a.contractUntil - b.contractUntil),
    loanedIn: rows.filter((r) => r.loan),
    loanedOut,
    suspended: rows.filter((r) => r.suspension),
    transfersIn,
    transfersOut,
    netSpend: transfersIn.reduce((s, t) => s + (t.fee || 0), 0) - transfersOut.reduce((s, t) => s + (t.fee || 0), 0),
    fixtures,
  };
}

export function playerProfile(c, playerId) {
  const p = c.players[Number(playerId)];
  if (!p) throw new Error('Unknown player');
  const seasons = playerSeasons(c);
  const row = playerRow(c, p, seasons);
  const s = seasons.get(p.playerId);
  const all = c.ratings.filter((r) => r.playerId === p.playerId);
  // The opponent for a rated match, when the save's fixture list has it.
  const fixtureOn = (date) => c.fixtures.find((f) => f.date === date && (f.homeId === p.clubId || f.awayId === p.clubId));
  const log = all.map((r) => {
    const f = fixtureOn(r.date);
    return { ...r, opponent: f ? clubName(c, f.homeId === p.clubId ? f.awayId : f.homeId) : null, home: f ? f.homeId === p.clubId : null, competition: f ? competitionName(c, f.competitionId) : null, thisSeason: !c.seasonStart || (r.date && r.date >= c.seasonStart) };
  }).reverse();
  const attributes = Object.entries(ATTRIBUTE_GROUPS).map(([group, fields]) => {
    const vals = fields.map((f) => ({ key: f, value: p.attributes[f] })).filter((x) => Number.isFinite(x.value));
    return { group, average: vals.length ? Math.round(avg(vals.map((v) => v.value))) : null, values: vals };
  }).filter((g) => g.values.length);
  return {
    player: { ...row, fullName: p.fullName, positions: p.positions, birthdate: p.birthdate, height: p.height, weight: p.weight, foot: p.foot, skillMoves: p.skillMoves, weakFoot: p.weakFoot, reputation: p.reputation, joined: p.joined, retiring: p.retiring, nationalTeam: p.nationalTeamId ? clubName(c, p.nationalTeamId) : null },
    contract: p.contract,
    season: s ? { matches: s.matches, minutes: s.minutes, avgRating: s.avgRating, best: s.best, worst: s.worst, eightPlus: s.eightPlus, underSix: s.underSix, last5: s.last5, trend: s.trend, consistency: s.consistency, minutesPerMatch: s.minutes ? Math.round(s.minutes / s.matches) : null, leagueGoalsPer90: s.minutes && row.leagueGoals ? r2((row.leagueGoals / s.minutes) * 90) : null } : null,
    ratingLog: log,
    lastSeason: c.lastSeason.filter((x) => x.playerId === p.playerId).map((x) => ({ ...x, competition: competitionName(c, x.competitionId) })),
    awards: c.awards.filter((a) => a.playerId === p.playerId),
    teamOfWeek: c.teamOfWeek.filter((t) => t.playerId === p.playerId),
    attributes,
    transfers: c.transfers.filter((t) => t.playerId === p.playerId).map((t) => ({ ...t, from: clubName(c, t.fromId), to: clubName(c, t.toId) })),
  };
}

export function transfersView(c) {
  const name = (id) => (c.players[id] ? c.players[id].name : `Player #${id}`);
  const deals = c.transfers.map((t) => ({ ...t, name: name(t.playerId), from: clubName(c, t.fromId), to: clubName(c, t.toId), ovr: c.players[t.playerId] ? c.players[t.playerId].ovr : null, age: c.players[t.playerId] ? c.players[t.playerId].age : null })).sort((a, b) => (b.fee || 0) - (a.fee || 0));
  const net = new Map();
  for (const t of c.transfers) {
    const a = net.get(t.toId) || { clubId: t.toId, spent: 0, received: 0, in: 0, out: 0 };
    a.spent += t.fee || 0; a.in++; net.set(t.toId, a);
    const b = net.get(t.fromId) || { clubId: t.fromId, spent: 0, received: 0, in: 0, out: 0 };
    b.received += t.fee || 0; b.out++; net.set(t.fromId, b);
  }
  const loans = Object.values(c.players).filter((p) => p.loan).map((p) => ({ playerId: p.playerId, name: p.name, from: clubName(c, p.loan.fromId), to: clubName(c, p.clubId), until: p.loan.until, toBuy: p.loan.toBuy, ovr: p.ovr, age: p.age }));
  return {
    deals,
    clubs: [...net.values()].map((x) => ({ ...x, club: clubName(c, x.clubId), net: x.spent - x.received, isUser: x.clubId === c.userClubId })).sort((a, b) => b.spent - a.spent),
    incoming: c.incoming.map((t) => ({ ...t, name: name(t.playerId), from: clubName(c, t.fromId), to: clubName(c, t.toId) })),
    loans: loans.sort((a, b) => (b.ovr || 0) - (a.ovr || 0)),
    total: deals.reduce((s, d) => s + (d.fee || 0), 0),
  };
}

export function managerView(c) {
  const m = c.manager;
  if (!m) return null;
  const history = m.history.map((h) => ({ ...h, club: clubName(c, h.clubId), league: c.leagues[h.leagueId] ? c.leagues[h.leagueId].name : null, ppg: h.played ? r2(h.points / h.played) : null, winPct: h.played ? Math.round((h.won / h.played) * 100) : null }));
  const totals = history.reduce((t, h) => ({ played: t.played + h.played, won: t.won + h.won, drawn: t.drawn + h.drawn, lost: t.lost + h.lost, gf: t.gf + h.gf, ga: t.ga + h.ga, trophies: t.trophies + h.trophies.league + h.trophies.cup + h.trophies.continental }), { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, trophies: 0 });
  const result = (x) => (x ? { ...x, opponent: clubName(c, x.opponentId) } : null);
  return { ...m, club: clubName(c, m.clubId), bigWin: result(m.bigWin), bigLoss: result(m.bigLoss), history, totals: { ...totals, winPct: totals.played ? Math.round((totals.won / totals.played) * 100) : null } };
}

// The matches the save rated for a club: one entry per date its players
// were rated, with the team's average and the best performer.
export function ratedMatches(c, clubId) {
  const id = Number(clubId);
  const byDate = new Map();
  for (const r of seasonRatings(c)) {
    const p = c.players[r.playerId];
    if (!p || p.clubId !== id || !r.date) continue;
    if (!byDate.has(r.date)) byDate.set(r.date, []);
    byDate.get(r.date).push(r);
  }
  return [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, rs]) => {
    const f = c.fixtures.find((x) => x.date === date && (x.homeId === id || x.awayId === id));
    const best = rs.reduce((b, r) => (!b || r.rating > b.rating ? r : b), null);
    return {
      date,
      opponentId: f ? (f.homeId === id ? f.awayId : f.homeId) : null,
      opponent: f ? clubName(c, f.homeId === id ? f.awayId : f.homeId) : null,
      home: f ? f.homeId === id : null,
      competition: f ? competitionName(c, f.competitionId) : null,
      players: rs.map((r) => ({ playerId: r.playerId, name: c.players[r.playerId].name, rating: r.rating, minutes: r.minutes, position: r.position })).sort((a, b) => b.rating - a.rating),
      teamRating: r2(avg(rs.map((r) => r.rating))),
      best: best ? { playerId: best.playerId, name: c.players[best.playerId].name, rating: best.rating } : null,
    };
  });
}

export function overview(c) {
  const id = c.userClubId;
  const club = id ? clubProfile(c, id) : null;
  const next = c.fixtures.filter((f) => !f.past && id && (f.homeId === id || f.awayId === id)).slice(0, 5).map((f) => ({ ...f, opponent: clubName(c, f.homeId === id ? f.awayId : f.homeId), home: f.homeId === id, competition: competitionName(c, f.competitionId), opponentOvr: c.clubs[f.homeId === id ? f.awayId : f.homeId] ? c.clubs[f.homeId === id ? f.awayId : f.homeId].ovr : null }));
  const rated = id ? ratedMatches(c, id) : [];
  return {
    kind: c.kind,
    date: c.date,
    seasonLabel: c.seasonLabel,
    club,
    manager: managerView(c),
    next,
    recent: rated.slice(-5).reverse(),
    leagues: leagueList(c),
    counts: c.details.counts,
    warnings: c.warnings,
  };
}
