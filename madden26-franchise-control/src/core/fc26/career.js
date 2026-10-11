// Reads an FC 26 career save (or squads file) into the tool's career model:
// leagues and their tables, clubs, players with their season numbers,
// every match rating the save keeps, contracts, loans, suspensions,
// fixtures, transfers, budgets and the manager's history.
//
// Everything here comes straight from the save. Where FC keeps something only
// in the running game (match scores, current-season assists, injuries), the
// model leaves it out and the Match Log fills it in.

import { databasesInFile, T3DB, loadMeta, fcDate, ymd } from './t3db.js';
import { bundledNames } from './names.js';

export class FcSaveError extends Error {
  constructor(message, { code = 'FC_SAVE', details = null } = {}) {
    super(message);
    this.name = 'FcSaveError';
    this.code = code;
    this.details = details;
  }
}

const POS = ['GK', 'SW', 'RWB', 'RB', 'RCB', 'CB', 'LCB', 'LB', 'LWB', 'RDM', 'CDM', 'LDM', 'RM', 'RCM', 'CM', 'LCM', 'LM', 'RAM', 'CAM', 'LAM', 'RF', 'CF', 'LF', 'RW', 'RS', 'ST', 'LS', 'LW'];
const SIMPLE = { SW: 'CB', RCB: 'CB', LCB: 'CB', RDM: 'CDM', LDM: 'CDM', RCM: 'CM', LCM: 'CM', RAM: 'CAM', LAM: 'CAM', RS: 'ST', LS: 'ST', RF: 'CF', LF: 'CF' };

// FC position codes (the lineup slot and preferred positions both use them).
export function positionName(code) {
  if (code === 28) return 'SUB';
  if (code === 29) return 'RES';
  return POS[code] || null;
}
export const simplePosition = (p) => (p ? SIMPLE[p] || p : null);
export function positionGroup(p) {
  const s = simplePosition(p);
  if (!s) return 'OTHER';
  if (s === 'GK') return 'GK';
  if (['CB', 'RB', 'LB', 'RWB', 'LWB'].includes(s)) return 'DEF';
  if (['CDM', 'CM', 'RM', 'LM', 'CAM'].includes(s)) return 'MID';
  return 'ATT';
}
export const GROUP_ORDER = ['GK', 'DEF', 'MID', 'ATT', 'OTHER'];
export const GROUP_LABEL = { GK: 'Goalkeepers', DEF: 'Defenders', MID: 'Midfielders', ATT: 'Attackers', OTHER: 'Other' };

// Squad roles on a contract.
export const ROLE_LABEL = { 1: 'Crucial', 2: 'Important', 3: 'Rotation', 4: 'Sporadic', 5: 'Prospect' };
// The currency picked when the career was set up.
export const CURRENCY = { 0: '$', 1: '€', 2: '£' };

const ATTRIBUTES = {
  Pace: ['acceleration', 'sprintspeed'],
  Shooting: ['finishing', 'shotpower', 'longshots', 'volleys', 'penalties', 'positioning'],
  Passing: ['vision', 'crossing', 'freekickaccuracy', 'shortpassing', 'longpassing', 'curve'],
  Dribbling: ['agility', 'balance', 'reactions', 'ballcontrol', 'dribbling', 'composure'],
  Defending: ['interceptions', 'headingaccuracy', 'defensiveawareness', 'standingtackle', 'slidingtackle'],
  Physical: ['jumping', 'stamina', 'strength', 'aggression'],
  Goalkeeping: ['gkdiving', 'gkhandling', 'gkkicking', 'gkpositioning', 'gkreflexes'],
};
export const ATTRIBUTE_GROUPS = ATTRIBUTES;
const ATTR_FIELDS = Object.values(ATTRIBUTES).flat();

const PLAYER_FIELDS = ['playerid', 'firstnameid', 'lastnameid', 'commonnameid', 'playerjerseynameid', 'overallrating', 'potential', 'birthdate', 'nationality',
  'preferredposition1', 'preferredposition2', 'preferredposition3', 'preferredposition4', 'height', 'weight', 'preferredfoot', 'internationalrep', 'skillmoves',
  'weakfootabilitytypecode', 'contractvaliduntil', 'playerjointeamdate', 'isretiring', 'gender', ...ATTR_FIELDS];

// Which copy of each table to use when a save holds more than one database:
// the one with the most rows (a later database wins a tie).
function collectTables(dbs, warnings) {
  const meta = loadMeta();
  const byName = new Map();
  const info = [];
  dbs.forEach((d, i) => {
    let t;
    try {
      t = new T3DB(d, meta);
    } catch (e) {
      warnings.push(`Database ${i + 1} in the file could not be read (${e.message}).`);
      return;
    }
    info.push({ index: i + 1, offset: d.offset, size: d.size, tables: t.tableNames.length });
    for (const n of t.tableNames) {
      let rows = -1;
      try {
        rows = t.layout(n).rows;
      } catch { /* damaged table */ }
      const cur = byName.get(n);
      if (rows >= 0 && (!cur || rows >= cur.rows)) byName.set(n, { db: t, rows });
    }
  });
  return { byName, info };
}

const age = (birth, on) => {
  if (!birth || !on) return null;
  const b = new Date(birth + 'T00:00:00Z');
  const d = new Date(on + 'T00:00:00Z');
  let a = d.getUTCFullYear() - b.getUTCFullYear();
  if (d.getUTCMonth() < b.getUTCMonth() || (d.getUTCMonth() === b.getUTCMonth() && d.getUTCDate() < b.getUTCDate())) a--;
  return a;
};

function addMonths(isoDate, months) {
  if (!isoDate || !Number.isFinite(months) || months <= 0) return null;
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

const fixtureTime = (n) => (Number.isFinite(n) && n > 0 && n < 2400 ? `${String(Math.floor(n / 100)).padStart(2, '0')}:${String(n % 100).padStart(2, '0')}` : null);

export function readCareer(buf, { fileName = 'save', customNames = {} } = {}) {
  const warnings = [];
  const { dbs, unpacked } = databasesInFile(buf);
  const details = { file: fileName, size: buf.length, header: buf.subarray(0, 8).toString('latin1').replace(/[^\x20-\x7e]/g, '.'), databases: dbs.length, compressed: unpacked };
  if (!dbs.length) throw new FcSaveError(`${fileName} has no FC database in it. Pick a career save (a file with "Career" in its name) or a Squads file from FC 26's settings folder.`, { code: 'NO_DATABASE', details });
  const { byName, info } = collectTables(dbs, warnings);
  details.databaseList = info;
  const has = (n) => byName.has(n);
  const read = (n, fields = null) => {
    const e = byName.get(n);
    if (!e) return [];
    try {
      return e.db.rows(n, fields);
    } catch (err) {
      warnings.push(`The ${n} table could not be read (${err.message}).`);
      return [];
    }
  };
  details.tables = Object.fromEntries([...byName.entries()].filter(([n]) => /^(players|teams|leagues|leagueteamlinks|teamplayerlinks|fixtures|career_\w+|prevcompetitionstats|transfers|playerloans|playersuspensions|editedplayernames|dcplayernames)$/.test(n)).map(([n, e]) => [n, e.rows]));
  if (!has('teams') || !has('players')) throw new FcSaveError(`${fileName} has FC data in it, but not the clubs and players. It may be a settings or profile file rather than a career save.`, { code: 'NO_SQUADS', details });

  const names = bundledNames();
  const kind = has('career_users') || has('career_calendar') ? 'career' : 'squads';

  // ---- calendar and the user
  const cal = read('career_calendar')[0] || null;
  const date = cal ? ymd(cal.currdate) : null;
  const seasonStart = cal ? ymd(cal.startdate) : null;
  const seasonEnd = cal ? ymd(cal.enddate) : null;
  const users = read('career_users');
  const userRow = users.find((u) => u.clubteamid > 0) || users[0] || null;
  const managerName = userRow ? (userRow.commonname || `${userRow.firstname || ''} ${userRow.surname || ''}`.trim() || null) : null;
  const seasonLabel = seasonStart ? `${seasonStart.slice(0, 4)}/${String(Number(seasonStart.slice(2, 4)) + 1).padStart(2, '0')}` : null;

  // ---- leagues and clubs
  const leagues = {};
  for (const l of read('leagues', ['leagueid', 'leaguename', 'countryid', 'level', 'isinternationalleague', 'iswomencompetition', 'leaguetype'])) {
    const name = l.leaguename || names.leagues[l.leagueid] || `League ${l.leagueid}`;
    leagues[l.leagueid] = { leagueId: l.leagueid, name, countryId: l.countryid, level: l.level, women: l.iswomencompetition === 1, club: l.isinternationalleague !== 1 && !/rest of world|free agents|international/i.test(name) };
  }
  const teamRows = read('teams', ['teamid', 'teamname', 'overallrating', 'attackrating', 'midfieldrating', 'defenserating', 'clubworth', 'internationalprestige', 'domesticprestige', 'foundationyear', 'rivalteam', 'captainid', 'penaltytakerid', 'freekicktakerid', 'leftcornerkicktakerid', 'rightcornerkicktakerid']);
  const ltl = read('leagueteamlinks');
  const leagueOf = new Map();
  for (const r of ltl) if (!leagueOf.has(r.teamid) || (leagues[r.leagueid] && leagues[r.leagueid].club)) leagueOf.set(r.teamid, r.leagueid);
  const clubs = {};
  for (const t of teamRows) {
    const leagueId = leagueOf.has(t.teamid) ? leagueOf.get(t.teamid) : null;
    const lg = leagueId != null ? leagues[leagueId] : null;
    clubs[t.teamid] = {
      clubId: t.teamid,
      name: t.teamname || names.clubs[t.teamid] || `Club ${t.teamid}`,
      leagueId,
      isClub: Boolean(lg && lg.club),
      ovr: t.overallrating || null,
      att: t.attackrating || null,
      mid: t.midfieldrating || null,
      def: t.defenserating || null,
      prestige: { international: t.internationalprestige, domestic: t.domesticprestige },
      rivalId: t.rivalteam > 0 && t.rivalteam !== t.teamid ? t.rivalteam : null,
      captainId: t.captainid > 0 ? t.captainid : null,
      takers: { penalties: t.penaltytakerid > 0 ? t.penaltytakerid : null, freeKicks: t.freekicktakerid > 0 ? t.freekicktakerid : null },
      isUser: Boolean(userRow && userRow.clubteamid === t.teamid),
    };
  }

  // ---- league tables
  const standings = {};
  for (const r of ltl) {
    const lg = leagues[r.leagueid];
    if (!lg || !lg.club || !clubs[r.teamid]) continue;
    const w = r.homewins + r.awaywins;
    const d = r.homedraws + r.awaydraws;
    const l = r.homelosses + r.awaylosses;
    const gf = r.homegf + r.awaygf;
    const ga = r.homega + r.awayga;
    (standings[r.leagueid] ||= []).push({
      clubId: r.teamid,
      position: r.currenttableposition,
      lastSeasonPosition: r.previousyeartableposition,
      played: Math.max(r.nummatchesplayed || 0, w + d + l),
      won: w, drawn: d, lost: l, gf, ga, gd: gf - ga, points: r.points,
      home: { won: r.homewins, drawn: r.homedraws, lost: r.homelosses, gf: r.homegf, ga: r.homega },
      away: { won: r.awaywins, drawn: r.awaydraws, lost: r.awaylosses, gf: r.awaygf, ga: r.awayga },
      unbeaten: { league: r.unbeatenleague === 1, home: r.unbeatenhome === 1, away: r.unbeatenaway === 1 },
      champion: r.champion === 1,
    });
  }
  for (const rows of Object.values(standings)) {
    rows.sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.clubId - b.clubId);
    // The save's own position when it has one that makes sense; otherwise by points.
    const savePositions = rows.map((r) => r.position).filter((p) => p > 0);
    const useSave = new Set(savePositions).size === rows.length && rows.some((r) => r.played > 0);
    if (useSave) rows.sort((a, b) => a.position - b.position);
    rows.forEach((r, i) => { if (!useSave) r.position = i + 1; });
  }

  // ---- players
  const edited = new Map(read('editedplayernames').map((r) => [r.playerid, r]));
  const nameTable = new Map();
  for (const r of read('dcplayernames')) nameTable.set(r.nameid, r.name);
  for (const r of read('playernames', ['nameid', 'name'])) nameTable.set(r.nameid, r.name);
  const nationNames = new Map(read('nations', ['nationid', 'nationname']).map((n) => [n.nationid, n.nationname]));
  const nationName = (id) => nationNames.get(id) || names.nations[id] || null;
  function nameOf(p) {
    const custom = customNames[p.playerid];
    if (custom) return { name: custom, full: custom, source: 'you' };
    const e = edited.get(p.playerid);
    if (e && (e.commonname || e.surname || e.firstname)) {
      const full = e.commonname || `${e.firstname || ''} ${e.surname || ''}`.trim();
      return { name: full, full, source: 'save' };
    }
    const b = names.players[p.playerid];
    if (b) return { name: b[0], full: b[1] || b[0], source: 'list' };
    const first = nameTable.get(p.firstnameid);
    const last = nameTable.get(p.lastnameid);
    const common = nameTable.get(p.commonnameid);
    if (common || last) return { name: common || (first ? `${first[0]}. ${last}` : last), full: common || `${first || ''} ${last}`.trim(), source: 'save' };
    return null;
  }

  const links = read('teamplayerlinks');
  const loans = new Map(read('playerloans').map((r) => [r.playerid, { fromId: r.teamidloanedfrom, until: fcDate(r.loandateend), toBuy: r.isloantobuy === 1 }]));
  const suspensions = new Map();
  for (const r of read('playersuspensions')) if (r.games > 0) suspensions.set(r.playerid, { games: r.games, until: fcDate(r.enddate), clubId: r.teamid });
  const contracts = new Map();
  for (const c of read('career_playercontract')) {
    const signed = ymd(c.contract_date);
    contracts.set(c.playerid, {
      clubId: c.teamid,
      wage: c.wage,
      signed,
      months: c.duration_months > 0 ? c.duration_months : null,
      ends: addMonths(signed, c.duration_months),
      role: ROLE_LABEL[c.playerrole] || null,
      roleCode: c.playerrole,
      signOnBonus: c.signon_bonus > 0 ? c.signon_bonus : null,
      bonus: c.performancebonuscount > 0 ? { type: c.performancebonustype, target: c.performancebonuscount, done: c.performancebonuscountachieved, value: c.performancebonusvalue, achieved: c.isperformancebonusachieved === 1 } : null,
      loanWageSplit: c.loan_wage_split >= 0 ? c.loan_wage_split : null,
    });
  }
  const ovrChange = new Map(read('career_squadranking').filter((r) => r.playerid > 0).map((r) => [r.playerid, { now: r.curroverall, before: r.lastoverall }]));
  const youth = new Map(read('career_youthplayers').map((r) => [r.playerid, { monthsInSquad: r.monthsinsquad, tier: r.playertier }]));
  const asOf = date || new Date().toISOString().slice(0, 10);

  const players = {};
  for (const p of read('players', PLAYER_FIELDS)) {
    const nm = nameOf(p);
    const positions = [p.preferredposition1, p.preferredposition2, p.preferredposition3, p.preferredposition4].map(positionName).filter((x) => x && x !== 'SUB' && x !== 'RES');
    const birth = fcDate(p.birthdate);
    const attrs = {};
    for (const f of ATTR_FIELDS) if (typeof p[f] === 'number') attrs[f] = p[f];
    players[p.playerid] = {
      playerId: p.playerid,
      name: nm ? nm.name : null,
      fullName: nm ? nm.full : null,
      nameSource: nm ? nm.source : null,
      position: positions[0] || null,
      positions: [...new Set(positions)],
      group: positionGroup(positions[0]),
      ovr: p.overallrating,
      pot: p.potential,
      birthdate: birth,
      age: age(birth, asOf),
      nationId: p.nationality,
      nation: nationName(p.nationality),
      height: p.height,
      weight: p.weight,
      foot: p.preferredfoot === 2 ? 'Left' : 'Right',
      reputation: p.internationalrep,
      skillMoves: Number.isFinite(p.skillmoves) ? p.skillmoves + 1 : null,
      weakFoot: p.weakfootabilitytypecode || null,
      contractUntil: p.contractvaliduntil > 0 ? p.contractvaliduntil : null,
      joined: fcDate(p.playerjointeamdate),
      retiring: p.isretiring === 1,
      attributes: attrs,
      clubId: null,
      nationalTeamId: null,
      jersey: null,
      slot: null,
      season: null,
      loan: loans.get(p.playerid) || null,
      suspension: suspensions.get(p.playerid) || null,
      contract: contracts.get(p.playerid) || null,
      ovrChange: ovrChange.get(p.playerid) || null,
      youth: youth.get(p.playerid) || null,
    };
  }
  for (const l of links) {
    const p = players[l.playerid];
    const club = clubs[l.teamid];
    if (!p || !club) continue;
    if (club.isClub && p.clubId == null) {
      p.clubId = l.teamid;
      p.jersey = l.jerseynumber;
      p.slot = positionName(l.position);
      p.season = { leagueGoals: l.leaguegoals || 0, leagueApps: l.leagueappearances || 0, yellows: l.yellows || 0, reds: l.reds || 0, form: l.form || null, topScorer: l.istopscorer === 1 };
    } else if (!club.isClub && p.nationalTeamId == null) {
      p.nationalTeamId = l.teamid;
    }
  }
  // Anyone still nameless gets a placeholder that says where to fix it.
  for (const p of Object.values(players)) {
    if (!p.name) {
      p.name = p.youth ? `Academy player #${p.playerId}` : `Player #${p.playerId}`;
      p.fullName = p.name;
      p.nameSource = 'none';
    }
  }

  // ---- match ratings (every rated appearance the save keeps)
  const ratings = [];
  for (const r of read('career_playermatchratinghistory')) {
    if (!(r.playerid > 0) || !(r.rating > 0)) continue;
    ratings.push({ playerId: r.playerid, date: ymd(r.date), rating: r.rating > 10 ? Math.round(r.rating) / 10 : r.rating, minutes: r.minsplayed >= 0 ? r.minsplayed : null, position: positionName(r.position) });
  }
  ratings.sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.playerId - b.playerId);

  // ---- competitions and fixtures
  const competitions = {};
  for (const c of read('career_competitionprogress')) if (c.compobjid > 0 && c.compshortname) competitions[c.compobjid] = { id: c.compobjid, name: c.compshortname, stage: c.stageid, won: c.hasteamwon === 1, season: c.season, clubId: c.teamid };
  const fixtures = read('fixtures').filter((f) => f.hometeamid > 0 && f.awayteamid > 0).map((f) => {
    const d = fcDate(f.fixturedate);
    return { fixtureId: f.fixtureid, date: d, time: fixtureTime(f.fixturetime), homeId: f.hometeamid, awayId: f.awayteamid, competitionId: f.competitionid, past: Boolean(date && d && d < date) };
  }).sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || ''));

  // ---- transfers, incoming deals, awards, last season
  const transfers = read('transfers').filter((t) => t.playerid > 0).map((t) => ({ playerId: t.playerid, toId: t.buyingteamid, fromId: t.sellingteamid, fee: t.transferamount }));
  const incoming = read('career_presignedcontract').filter((t) => t.playerid > 0).map((t) => ({ playerId: t.playerid, fromId: t.teamid, toId: t.offerteamid, fee: t.offeredfee > 0 ? t.offeredfee : 0, wage: t.offeredwage > 0 ? t.offeredwage : null, completes: ymd(t.completedate), thisSeason: t.iscomingthisseason === 1, loanToBuy: t.isloanbuy === 1 }));
  const awards = read('career_playerawards').filter((a) => a.playerid > 0).map((a) => ({ playerId: a.playerid, clubId: a.teamid, type: a.typeid, season: a.season, count: a.count }));
  const teamOfWeek = read('career_teamofweek').filter((t) => t.playerid > 0).map((t) => ({ playerId: t.playerid, month: t.month, weeksWon: t.weekswon, rating: t.matchrating > 10 ? t.matchrating / 10 : t.matchrating }));
  const lastSeason = read('prevcompetitionstats').filter((s) => s.playerid > 0).map((s) => ({ playerId: s.playerid, competitionId: s.competitionid, apps: s.appearances, goals: s.goals, assists: s.assists, cleanSheets: s.cleansheets, yellows: s.yellowcards, reds: s.redcards }));

  // ---- the manager
  let manager = null;
  if (kind === 'career') {
    const info = read('career_managerinfo').find((m) => !userRow || m.userid === userRow.userid) || null;
    const pref = read('career_managerpref')[0] || null;
    const history = read('career_managerhistory').filter((h) => h.teamid > 0 || h.games_played > 0).map((h) => ({
      season: h.season, clubId: h.teamid, leagueId: h.leagueid, position: h.tableposition, played: h.games_played, won: h.wins, drawn: h.draws, lost: h.losses,
      gf: h.goals_for, ga: h.goals_against, points: h.points, trophies: { league: h.leaguetrophies, cup: h.domesticcuptrophies, continental: h.continentalcuptrophies },
      biggestBuy: h.bigbuyplayername ? { name: h.bigbuyplayername, fee: h.bigbuyamount } : null, biggestSale: h.bigsellplayername ? { name: h.bigsellplayername, fee: h.bigsellamount } : null,
    })).sort((a, b) => a.season - b.season);
    const result = (us, them, opp, d) => (opp > 0 ? { us, them, opponentId: opp, date: ymd(d) } : null);
    manager = {
      name: managerName,
      clubId: userRow ? userRow.clubteamid : null,
      leagueId: userRow ? userRow.leagueid : null,
      seasons: userRow ? userRow.seasoncount : null,
      boardConfidence: info ? info.boardconfidence : null,
      reputation: info ? info.managerreputation : null,
      wage: info ? info.wage : null,
      earnings: info ? info.totalearnings : null,
      losingStreak: info ? info.losingstreak : null,
      bigWin: info ? result(info.bigwinuserscore, info.bigwinoppscore, info.bigwinoppteamid, info.bigwindate) : null,
      bigLoss: info ? result(info.biglossuserscore, info.biglossoppscore, info.biglossoppteamid, info.biglossdate) : null,
      budget: pref ? { transfer: pref.transferbudget, wage: pref.wagebudget, startTransfer: pref.startofseasontransferbudget, startWage: pref.startofseasonwagebudget, startWages: pref.startofseasonplayerwages } : null,
      currency: pref && CURRENCY[pref.currency] ? CURRENCY[pref.currency] : '€',
      history,
    };
  }

  details.kind = kind;
  details.counts = { leagues: Object.keys(leagues).length, clubs: Object.keys(clubs).length, players: Object.keys(players).length, ratings: ratings.length, fixtures: fixtures.length };
  return {
    kind,
    fileName,
    date,
    seasonStart,
    seasonEnd,
    seasonLabel,
    userClubId: userRow && clubs[userRow.clubteamid] ? userRow.clubteamid : null,
    manager,
    leagues,
    clubs,
    standings,
    players,
    ratings,
    competitions,
    fixtures,
    transfers,
    incoming,
    awards,
    teamOfWeek,
    lastSeason,
    warnings,
    details,
  };
}
