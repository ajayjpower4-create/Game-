// Builds FC 26 databases and career saves for the tests, in the same layout
// the reader expects (and fc26-mcp's reference parser reads).
import { loadMeta, DB_MAGIC } from '../src/core/fc26/t3db.js';

function writeBits(buf, pos, bitOffset, depth, value) {
  let byte = pos + (bitOffset >> 3);
  let bit = bitOffset & 7;
  let written = 0;
  let v = value;
  while (written < depth) {
    const take = Math.min(8 - bit, depth - written);
    const mask = (1 << take) - 1;
    const chunk = v % 2 ** take;
    buf[byte] = (buf[byte] & ~(mask << bit)) | (chunk << bit);
    v = Math.floor(v / 2 ** take);
    written += take;
    bit = 0;
    byte++;
  }
}

// One table's bytes: header, field list, records. Every field EA defines for
// the table is written, the way the game writes them.
function tableBytes(tmeta, rows) {
  const fields = [];
  let bits = 0;
  for (const [short, f] of tmeta.fields) {
    if (f.type === 'string') bits = Math.ceil(bits / 8) * 8;
    if (f.type === 'real') bits = Math.ceil(bits / 32) * 32;
    const depth = f.type === 'real' ? 32 : f.depth;
    fields.push({ short, ...f, depth, bitOffset: bits, code: f.type === 'string' ? 0 : f.type === 'real' ? 4 : 3 });
    bits += depth;
  }
  const recordSize = Math.ceil(bits / 32) * 4;
  const header = Buffer.alloc(36 + fields.length * 16);
  header.writeUInt32LE(3, 0);
  header.writeUInt32LE(recordSize, 4);
  header.writeUInt32LE(bits, 8);
  header.writeUInt16LE(rows.length, 16);
  header.writeUInt16LE(rows.length, 18);
  header.writeInt32LE(-1, 20);
  header[24] = fields.length;
  // Fields in a different order than their bit offsets, as in real files.
  [...fields].reverse().forEach((f, i) => {
    const at = 36 + i * 16;
    header.writeUInt32LE(f.code, at);
    header.writeUInt32LE(f.bitOffset, at + 4);
    header.write(f.short, at + 8, 'latin1');
    header.writeUInt32LE(f.depth, at + 12);
  });
  const records = Buffer.alloc(recordSize * rows.length);
  rows.forEach((row, r) => {
    const at = r * recordSize;
    for (const f of fields) {
      const v = row[f.name];
      if (f.type === 'string') {
        records.write(String(v ?? '').slice(0, (f.depth >> 3) - 1), at + (f.bitOffset >> 3), 'utf8');
      } else if (f.type === 'real') {
        records.writeFloatLE(Number(v ?? 0), at + (f.bitOffset >> 3));
      } else {
        const raw = Math.max(0, Math.round(Number(v ?? f.low) - f.low));
        writeBits(records, at, f.bitOffset, f.depth, raw % 2 ** f.depth);
      }
    }
  });
  return Buffer.concat([header, records]);
}

// A database holding the given tables ({ name: rows }).
export function buildDatabase(tables) {
  const meta = loadMeta();
  const byName = new Map([...meta.tables.values()].map((t) => [t.name, t]));
  const names = Object.keys(tables);
  const parts = names.map((n) => {
    const tm = byName.get(n);
    if (!tm) throw new Error(`No FC 26 table called ${n}`);
    return { short: tm.shortname, bytes: tableBytes(tm, tables[n]) };
  });
  const head = Buffer.alloc(24 + parts.length * 8 + 4);
  DB_MAGIC.copy(head, 0);
  head.writeUInt32LE(names.length, 16);
  let off = 0;
  parts.forEach((p, i) => {
    head.write(p.short, 24 + i * 8, 'latin1');
    head.writeUInt32LE(off, 24 + i * 8 + 4);
    off += p.bytes.length;
  });
  const db = Buffer.concat([head, ...parts.map((p) => p.bytes)]);
  db.writeUInt32LE(db.length, 8);
  return db;
}

// A career save: an FBCHUNKS header, then the career's databases.
export function buildCareerSave(databases, { label = 'ManagerCareer' } = {}) {
  const header = Buffer.alloc(0x480);
  header.write('FBCHUNKS', 0, 'latin1');
  header.writeUInt16LE(1, 8);
  header.write(label, 0x22, 'latin1');
  header.write('SaveType_Career', 0x466, 'latin1');
  const gap = Buffer.alloc(64, 0xcd);
  return Buffer.concat([header, ...databases.flatMap((d) => [d, gap])]);
}

// Days from 14 October 1582, the way FC stores dates.
export function fcDays(iso) {
  return Math.round((Date.parse(iso + 'T00:00:00Z') - Date.UTC(1582, 9, 14)) / 86400000);
}

export const ymdNum = (iso) => Number(iso.replace(/-/g, ''));

// A small but complete career: two leagues, eight clubs, a user club with a
// full squad, match ratings, contracts, transfers, fixtures and history.
export function sampleCareer() {
  const leagues = [
    { leagueid: 13, leaguename: 'Premier League', countryid: 14, level: 1, leaguetype: 0, isinternationalleague: 0 },
    { leagueid: 14, leaguename: 'EFL Championship', countryid: 14, level: 2, leaguetype: 0, isinternationalleague: 0 },
  ];
  const clubs = [
    { teamid: 1, teamname: 'Arsenal', leagueid: 13, overallrating: 84, attackrating: 85, midfieldrating: 84, defenserating: 84 },
    { teamid: 9, teamname: 'Liverpool', leagueid: 13, overallrating: 85, attackrating: 86, midfieldrating: 84, defenserating: 83 },
    { teamid: 10, teamname: 'Manchester City', leagueid: 13, overallrating: 85, attackrating: 86, midfieldrating: 85, defenserating: 84 },
    { teamid: 18, teamname: 'Tottenham Hotspur', leagueid: 13, overallrating: 80, attackrating: 82, midfieldrating: 79, defenserating: 78 },
    { teamid: 8, teamname: 'Leeds United', leagueid: 14, overallrating: 74, attackrating: 75, midfieldrating: 74, defenserating: 73 },
    { teamid: 95, teamname: 'Leicester City', leagueid: 14, overallrating: 74, attackrating: 74, midfieldrating: 74, defenserating: 73 },
    { teamid: 1799, teamname: 'Sunderland', leagueid: 14, overallrating: 72, attackrating: 72, midfieldrating: 72, defenserating: 71 },
    { teamid: 1792, teamname: 'Norwich City', leagueid: 14, overallrating: 70, attackrating: 70, midfieldrating: 70, defenserating: 70 },
  ];
  // Premier League table after 4 games, Championship after 3.
  const table = [
    { teamid: 1, leagueid: 13, homewins: 2, homedraws: 0, homelosses: 0, awaywins: 1, awaydraws: 1, awaylosses: 0, homegf: 5, homega: 1, awaygf: 3, awayga: 2, points: 10, nummatchesplayed: 4, currenttableposition: 1, previousyeartableposition: 2 },
    { teamid: 9, leagueid: 13, homewins: 1, homedraws: 1, homelosses: 0, awaywins: 1, awaydraws: 0, awaylosses: 1, homegf: 4, homega: 2, awaygf: 2, awayga: 3, points: 7, nummatchesplayed: 4, currenttableposition: 2, previousyeartableposition: 1 },
    { teamid: 10, leagueid: 13, homewins: 1, homedraws: 0, homelosses: 1, awaywins: 0, awaydraws: 1, awaylosses: 1, homegf: 3, homega: 3, awaygf: 1, awayga: 2, points: 4, nummatchesplayed: 4, currenttableposition: 3, previousyeartableposition: 3 },
    { teamid: 18, leagueid: 13, homewins: 0, homedraws: 1, homelosses: 1, awaywins: 0, awaydraws: 0, awaylosses: 2, homegf: 1, homega: 3, awaygf: 2, awayga: 5, points: 1, nummatchesplayed: 4, currenttableposition: 4, previousyeartableposition: 5 },
    { teamid: 8, leagueid: 14, homewins: 2, homedraws: 0, homelosses: 0, awaywins: 0, awaydraws: 1, awaylosses: 0, homegf: 4, homega: 1, awaygf: 1, awayga: 1, points: 7, nummatchesplayed: 3, currenttableposition: 1, previousyeartableposition: 1 },
    { teamid: 95, leagueid: 14, homewins: 1, homedraws: 1, homelosses: 0, awaywins: 0, awaydraws: 0, awaylosses: 1, homegf: 2, homega: 1, awaygf: 0, awayga: 2, points: 4, nummatchesplayed: 3, currenttableposition: 2, previousyeartableposition: 4 },
    { teamid: 1799, leagueid: 14, homewins: 0, homedraws: 1, homelosses: 0, awaywins: 1, awaydraws: 0, awaylosses: 1, homegf: 1, homega: 1, awaygf: 2, awayga: 3, points: 4, nummatchesplayed: 3, currenttableposition: 3, previousyeartableposition: 6 },
    { teamid: 1792, leagueid: 14, homewins: 0, homedraws: 0, homelosses: 2, awaywins: 0, awaydraws: 0, awaylosses: 1, homegf: 1, homega: 4, awaygf: 0, awayga: 1, points: 0, nummatchesplayed: 3, currenttableposition: 4, previousyeartableposition: 3 },
  ];
  // Arsenal's squad: real EA ids so the bundled names resolve, plus an
  // academy player with no known name and one with an edited name.
  const squad = [
    [220901, 'GK', 0, 87, 88, '1998-10-15', 22, 'David Raya'],
    [231936, 'RB', 3, 81, 84, '1998-12-02', 4, 'B. White'],
    [243715, 'CB', 5, 85, 86, '1997-10-31', 2, 'W. Saliba'],
    [232580, 'CB', 5, 84, 86, '1998-07-26', 6, 'Gabriel'],
    [251805, 'LB', 7, 76, 85, '2002-03-07', 12, 'J. Timber'],
    [234378, 'CDM', 10, 86, 87, '1999-11-24', 41, 'D. Rice'],
    [222665, 'CM', 14, 87, 87, '1998-12-04', 8, 'M. Ødegaard'],
    [225193, 'CM', 14, 80, 82, '1999-05-29', 36, 'Mikel Merino'],
    [246669, 'RW', 23, 88, 91, '2001-09-05', 7, 'B. Saka'],
    [251566, 'LW', 27, 82, 86, '2001-07-12', 11, 'Gabriel Martinelli'],
    [241651, 'ST', 25, 83, 88, '1998-05-13', 9, 'V. Gyökeres'],
    [500001, 'ST', 25, 62, 84, '2008-02-01', 49, null],
    [500002, 'CAM', 18, 64, 82, '2007-06-20', 53, 'Edited Name'],
  ];
  const players = squad.map(([playerid, , pos, ovr, pot, dob]) => ({ playerid, preferredposition1: pos, overallrating: ovr, potential: pot, birthdate: fcDays(dob), nationality: 14, height: 180, weight: 75, preferredfoot: 1, contractvaliduntil: 2028, firstnameid: 0, lastnameid: 0, commonnameid: 0, playerjerseynameid: 0, internationalrep: 3, skillmoves: 3, weakfootabilitytypecode: 3 }));
  // A Liverpool striker so the league has a scorer outside the user's club.
  players.push({ playerid: 209331, preferredposition1: 25, overallrating: 89, potential: 89, birthdate: fcDays('1992-06-15'), nationality: 18, contractvaliduntil: 2027 });
  const lineup = [0, 3, 4, 6, 7, 10, 13, 15, 23, 27, 25, 28, 29];
  const goals = [0, 0, 1, 1, 0, 1, 2, 0, 4, 1, 3, 0, 0];
  const apps = [4, 4, 4, 4, 3, 4, 4, 2, 4, 4, 4, 1, 0];
  const links = squad.map(([playerid, , , , , , jersey], i) => ({ artificialkey: i + 1, playerid, teamid: 1, jerseynumber: jersey, position: lineup[i], leaguegoals: goals[i], leagueappearances: apps[i], yellows: i === 5 ? 2 : i === 2 ? 1 : 0, reds: i === 7 ? 1 : 0, injury: 0, form: 3 }));
  links.push({ artificialkey: 50, playerid: 209331, teamid: 9, jerseynumber: 11, position: 25, leaguegoals: 5, leagueappearances: 4, yellows: 0, reds: 0 });
  // The national team link must not move Saka to England.
  links.push({ artificialkey: 51, playerid: 246669, teamid: 1318, jerseynumber: 7, position: 23, leaguegoals: 0, leagueappearances: 0 });

  // Four league games and a cup game, with ratings for the starters.
  const dates = ['2025-08-16', '2025-08-23', '2025-08-30', '2025-09-13', '2025-09-24'];
  const ratings = [];
  let key = 1;
  squad.slice(0, 11).forEach(([playerid, , pos], i) => {
    dates.forEach((d, g) => {
      if (i === 7 && g < 2) return; // Merino came in later
      const base = [70, 68, 72, 71, 66, 74, 75, 69, 82, 70, 76][i];
      ratings.push({ artificialkey: key++, playerid, date: ymdNum(d), rating: base + ((g * 3 + i) % 7) - 3, minsplayed: i === 9 && g === 4 ? 61 : 90, position: pos });
    });
  });
  ratings.push({ artificialkey: key++, playerid: 500001, date: ymdNum('2025-09-24'), rating: 72, minsplayed: 29, position: 25 });
  const fixtures = [
    ['2025-08-16', 1, 18, 13], ['2025-08-23', 10, 1, 13], ['2025-08-30', 1, 9, 13], ['2025-09-13', 18, 1, 13], ['2025-09-24', 1, 8, 99],
    ['2025-10-04', 1, 10, 13], ['2025-10-18', 9, 1, 13], ['2025-08-16', 9, 10, 13],
  ].map(([d, h, a, c], i) => ({ fixtureid: i + 1, hometeamid: h, awayteamid: a, competitionid: c, fixturedate: fcDays(d), fixturetime: 1500 }));

  const squads = buildDatabase({
    leagues,
    teams: clubs.map((c) => ({ ...c, form: 3 })).concat([{ teamid: 1318, teamname: 'England', overallrating: 84 }]),
    leagueteamlinks: table.map((t, i) => ({ artificialkey: i + 1, ...t })).concat([{ artificialkey: 99, teamid: 1318, leagueid: 78, points: 0 }]),
    players,
    teamplayerlinks: links,
    editedplayernames: [{ playerid: 500002, firstname: 'Edited', surname: 'Name', commonname: '', playerjerseyname: 'Name' }],
    playerloans: [{ playerid: 251805, teamidloanedfrom: 9, loandateend: fcDays('2026-06-30'), isloantobuy: 1 }],
    playersuspensions: [{ artificialkey: 1, playerid: 225193, teamid: 1, games: 1, enddate: fcDays('2025-10-04') }],
    fixtures,
    prevcompetitionstats: [
      { artificialkey: 1, playerid: 246669, competitionid: 13, appearances: 36, goals: 16, assists: 14, cleansheets: 0, yellowcards: 3, redcards: 0 },
      { artificialkey: 2, playerid: 220901, competitionid: 13, appearances: 38, goals: 0, assists: 0, cleansheets: 15, yellowcards: 1, redcards: 0 },
    ],
  });
  const career = buildDatabase({
    career_users: [{ userid: 0, firstname: 'Pat', surname: 'Manager', clubteamid: 1, leagueid: 13, seasoncount: 2, usertype: 1, nationalteamid: -1 }],
    career_calendar: [{ dateid: 0, currdate: ymdNum('2025-09-27'), startdate: ymdNum('2025-07-01'), enddate: ymdNum('2026-06-30'), setupdate: ymdNum('2025-07-01'), objectivecheckdate: ymdNum('2026-05-24') }],
    career_managerinfo: [{ userid: 0, clubteamid: 1, boardconfidence: 78, managerreputation: 640, wage: 150000, totalearnings: 9000000, bigwinuserscore: 4, bigwinoppscore: 0, bigwinoppteamid: 18, bigwindate: ymdNum('2025-08-16'), biglossuserscore: 0, biglossoppscore: 2, biglossoppteamid: 9, biglossdate: ymdNum('2025-03-02'), losingstreak: 0 }],
    career_managerpref: [{ managerprefid: 0, transferbudget: 85000000, wagebudget: 3200000, startofseasontransferbudget: 120000000, startofseasonwagebudget: 3500000, startofseasonplayerwages: 2900000, currency: 1 }],
    career_managerhistory: [{ artificialkey: 1, season: 1, teamid: 1, leagueid: 13, tableposition: 2, wins: 26, draws: 6, losses: 6, goals_for: 81, goals_against: 34, points: 84, games_played: 38, leaguetrophies: 0, domesticcuptrophies: 1, continentalcuptrophies: 0, bigbuyplayername: 'V. Gyökeres', bigbuyamount: 64000000, bigsellplayername: 'E. Nketiah', bigsellamount: 25000000 }],
    career_playercontract: squad.map(([playerid], i) => ({ playerid, teamid: 1, wage: [90000, 120000, 190000, 180000, 70000, 240000, 240000, 110000, 195000, 140000, 200000, 2000, 3000][i], contract_date: ymdNum('2024-07-01'), duration_months: [48, 36, 60, 48, 36, 60, 48, 36, 60, 48, 60, 36, 36][i], playerrole: [1, 2, 1, 1, 3, 1, 1, 2, 1, 2, 1, 5, 5][i], contract_status: 0 })),
    career_playermatchratinghistory: ratings,
    career_playerlastmatchhistory: [{ artificialkey: 1, playerid: 246669, teamid: 1, minsplayed: 90, playeroverall: 88, position: 23 }],
    career_teamofweek: [{ artificialkey: 1, playerid: 246669, month: 8, weekswon: 2, matchrating: 92 }, { artificialkey: 2, playerid: 241651, month: 9, weekswon: 1, matchrating: 88 }],
    career_playerawards: [{ artificialkey: 1, playerid: 246669, teamid: 1, typeid: 3, season: 1, count: 1 }],
    career_squadranking: [{ playerid: 246669, curroverall: 88, lastoverall: 87 }, { playerid: 500001, curroverall: 62, lastoverall: 58 }, { playerid: 222665, curroverall: 87, lastoverall: 88 }],
    career_youthplayers: [{ playerid: 500001, monthsinsquad: 6, potentialvariance: 2, playertier: 1 }],
    career_competitionprogress: [{ artificialkey: 1, teamid: 1, compobjid: 13, compshortname: 'ENG1', season: 2, stageid: 1, hasteamwon: 0 }, { artificialkey: 2, teamid: 1, compobjid: 99, compshortname: 'EFLCUP', season: 2, stageid: 2, hasteamwon: 0 }],
    career_presignedcontract: [{ playerid: 209331, teamid: 9, offerteamid: 1, offeredfee: 0, offeredwage: 260000, iscomingthisseason: 0, completedate: ymdNum('2026-07-01') }],
  });
  const transfersDb = buildDatabase({
    transfers: [
      { playerid: 241651, buyingteamid: 1, sellingteamid: 1792, transferamount: 64000000 },
      { playerid: 225193, buyingteamid: 1, sellingteamid: 95, transferamount: 32000000 },
    ],
  });
  return { save: buildCareerSave([squads, career, transfersDb]), squads, career };
}
