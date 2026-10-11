// FC 26: the database reader, reading a career, the stats built from it, the
// Match Log and its advanced stats, the API, and finding saves on disk.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { buildDatabase, buildCareerSave, sampleCareer, fcDays } from './fc26-helpers.js';
import { findDatabases, databasesInFile, T3DB, fcDate, ymd } from '../src/core/fc26/t3db.js';
import { readCareer, FcSaveError, positionName, positionGroup } from '../src/core/fc26/career.js';
import { leagueList, standingsView, leaders, clubProfile, playerProfile, transfersView, managerView, ratedMatches, overview } from '../src/core/fc26/stats.js';
import { normalizeMatch, logStats, matchStory, matchView } from '../src/core/fc26/matchlog.js';
import { findFcSaves } from '../src/core/fc26/locate.js';
import { startServer } from '../src/server/start.js';

const career = () => readCareer(sampleCareer().save, { fileName: 'ManagerCareer-test' });

test('the database reader reads back every kind of field, including negative ranges and dates', () => {
  const db = buildDatabase({
    leagues: [{ leagueid: 13, leaguename: 'Premier League', countryid: 14, level: 1 }],
    career_playerlastgrowth: [{ playerid: 12, injuryduration: 5, initialcurveoffset: -250 }],
    playerloans: [{ playerid: 7, teamidloanedfrom: 9, loandateend: fcDays('2026-06-30'), isloantobuy: 1 }],
    career_manager: [{ managerid: 3, starrating: 3.5, playstyle: 2 }],
  });
  const [found] = findDatabases(Buffer.concat([Buffer.alloc(77, 9), db]));
  assert.equal(found.offset, 77);
  const t = new T3DB(found);
  assert.deepEqual(t.tableNames.sort(), ['career_manager', 'career_playerlastgrowth', 'leagues', 'playerloans']);
  assert.equal(t.rows('leagues')[0].leaguename, 'Premier League');
  assert.equal(t.rows('career_playerlastgrowth')[0].initialcurveoffset, -250);
  assert.equal(fcDate(t.rows('playerloans')[0].loandateend), '2026-06-30');
  assert.equal(t.rows('career_manager')[0].starrating, 3.5);
  assert.equal(ymd(20250927), '2025-09-27');
  assert.equal(ymd(5), null);
});

test('databases inside a compressed save are found too', () => {
  const db = buildDatabase({ leagues: [{ leagueid: 1, leaguename: 'Test' }] });
  const packed = Buffer.concat([Buffer.from('FBCHUNKS'), Buffer.alloc(40), zlib.deflateSync(db)]);
  const r = databasesInFile(packed);
  assert.equal(r.dbs.length, 1);
  assert.equal(r.unpacked, true);
});

test('a career save is read into clubs, league tables, players and ratings', () => {
  const c = career();
  assert.equal(c.kind, 'career');
  assert.equal(c.date, '2025-09-27');
  assert.equal(c.seasonLabel, '2025/26');
  assert.equal(c.userClubId, 1);
  assert.equal(c.manager.name, 'Pat Manager');
  assert.equal(c.manager.budget.transfer, 85000000);
  assert.equal(c.manager.currency, '€');
  // League table straight from the save.
  const pl = c.standings[13];
  assert.deepEqual(pl.map((r) => c.clubs[r.clubId].name), ['Arsenal', 'Liverpool', 'Manchester City', 'Tottenham Hotspur']);
  assert.deepEqual([pl[0].played, pl[0].won, pl[0].drawn, pl[0].lost, pl[0].gf, pl[0].ga, pl[0].points], [4, 3, 1, 0, 8, 3, 10]);
  // Names: the bundled list, an edited name from the save, and a placeholder.
  assert.equal(c.players[246669].name, 'B. Saka');
  assert.equal(c.players[246669].fullName, 'Bukayo Saka');
  assert.equal(c.players[500002].name, 'Edited Name');
  assert.equal(c.players[500001].name, 'Academy player #500001');
  // The club, not the national team.
  assert.equal(c.players[246669].clubId, 1);
  assert.equal(c.players[246669].nationalTeamId, 1318);
  assert.equal(c.players[246669].slot, 'RW');
  assert.equal(c.players[246669].season.leagueGoals, 4);
  assert.equal(c.players[246669].age, 24);
  assert.equal(c.players[246669].contract.role, 'Crucial');
  assert.equal(c.players[246669].contract.wage, 195000);
  assert.deepEqual(c.players[251805].loan, { fromId: 9, until: '2026-06-30', toBuy: true });
  assert.equal(c.players[225193].suspension.games, 1);
  // Ratings come back on FC's 0-10 scale.
  const saka = c.ratings.filter((r) => r.playerId === 246669);
  assert.equal(saka.length, 5);
  assert.ok(saka.every((r) => r.rating >= 3 && r.rating <= 10 && r.minutes === 90));
  assert.equal(c.fixtures[0].date, '2025-08-16');
  assert.equal(c.fixtures.filter((f) => !f.past).length, 2);
  assert.equal(c.clubs[1].rivalId, null, 'a club is never its own rival');
});

test('a file with no FC database says so plainly', () => {
  assert.throws(() => readCareer(Buffer.alloc(200000, 3), { fileName: 'Settings' }), (e) => e instanceof FcSaveError && e.code === 'NO_DATABASE' && /no FC database/.test(e.message));
  const onlyCareer = buildCareerSave([buildDatabase({ career_users: [{ userid: 0, clubteamid: 1 }] })]);
  assert.throws(() => readCareer(onlyCareer, { fileName: 'x' }), (e) => e.code === 'NO_SQUADS');
});

test('a squads file opens without the career parts', () => {
  const { squads } = sampleCareer();
  const c = readCareer(buildCareerSave([squads]), { fileName: 'Squads20250927' });
  assert.equal(c.kind, 'squads');
  assert.equal(c.manager, null);
  assert.equal(c.userClubId, null);
  assert.ok(Object.keys(c.players).length > 10);
});

test('position codes and groups', () => {
  assert.equal(positionName(0), 'GK');
  assert.equal(positionName(25), 'ST');
  assert.equal(positionName(28), 'SUB');
  assert.equal(positionGroup('RCB'), 'DEF');
  assert.equal(positionGroup('LDM'), 'MID');
  assert.equal(positionGroup('LS'), 'ATT');
});

test('stats from the save: tables, leaders, club and player pages', () => {
  const c = career();
  assert.equal(leagueList(c)[0].name, 'Premier League', 'your league first');
  const t = standingsView(c, 13);
  assert.equal(t.rows[0].ppg, 2.5);
  assert.equal(t.rows[0].homePoints, 6);
  assert.equal(t.rows[0].moved, 1);
  const L = leaders(c, { leagueId: 13 });
  assert.deepEqual(L.goldenBoot.slice(0, 2).map((r) => [r.name, r.leagueGoals]), [['M. Salah', 5], ['B. Saka', 4]]);
  assert.equal(L.bestRated[0].name, 'B. Saka');
  assert.ok(L.bestRated.every((r) => r.matches >= L.minMatches));
  assert.equal(L.discipline[0].name, 'Mikel Merino', 'a red counts three');
  assert.equal(L.ovrRisers[0].ovrChange, 4);
  const club = clubProfile(c, 1);
  assert.equal(club.squadSize, 13);
  assert.equal(club.xi.length, 11);
  assert.equal(club.netSpend, 96000000);
  assert.equal(club.wages, [90000, 120000, 190000, 180000, 70000, 240000, 240000, 110000, 195000, 140000, 200000, 2000, 3000].reduce((a, b) => a + b, 0));
  const p = playerProfile(c, 246669);
  assert.equal(p.season.matches, 5);
  assert.equal(p.season.minutes, 450);
  assert.equal(p.ratingLog[0].opponent, 'Leeds United', 'the opponent comes from the fixture on that date');
  assert.equal(p.ratingLog[0].competition, 'EFLCUP');
  const rated = ratedMatches(c, 1);
  assert.equal(rated.length, 5);
  assert.equal(rated[2].opponent, 'Liverpool');
  assert.equal(rated[2].players.length, 11);
  const tv = transfersView(c);
  assert.equal(tv.deals[0].name, 'V. Gyökeres');
  assert.equal(tv.incoming[0].name, 'M. Salah');
  const m = managerView(c);
  assert.equal(m.history[0].points, 84);
  assert.equal(m.bigWin.opponent, 'Tottenham Hotspur');
  const o = overview(c);
  assert.equal(o.next.length, 2);
  assert.equal(o.next[0].opponent, 'Manchester City');
});

// A run of logged matches for the advanced stats.
function sampleLog() {
  const base = { competition: 'Premier League', players: [] };
  return [
    // Behind, then a late winner.
    normalizeMatch({ ...base, date: '2025-08-16', opponentId: 18, venue: 'home', goalsFor: 2, goalsAgainst: 1, goals: [{ side: 'against', minute: 10 }, { side: 'for', minute: 55, playerId: 246669, assistId: 222665 }, { side: 'for', minute: 90, added: 3, playerId: 241651, type: 'header' }], stats: { shots: [14, 9], xg: [1.9, 1.1], possession: [58, ''] }, motmId: 246669 }),
    // Ahead, pegged back.
    normalizeMatch({ ...base, date: '2025-08-23', opponentId: 10, venue: 'away', goalsFor: 1, goalsAgainst: 1, goals: [{ side: 'for', minute: 20, playerId: 246669, type: 'penalty' }, { side: 'against', minute: 70 }], cards: [{ side: 'for', minute: 60, playerId: 225193, color: 'red' }], injuries: [{ minute: 30, playerId: 243715, injury: 'Hamstring strain', weeks: 6 }] }),
    // A clean-sheet thrashing with a hat-trick.
    normalizeMatch({ ...base, date: '2025-08-30', opponentId: 9, venue: 'home', goalsFor: 4, goalsAgainst: 0, goals: [{ side: 'for', minute: 5, playerId: 241651 }, { side: 'for', minute: 44, playerId: 241651, assistId: 246669 }, { side: 'for', minute: 45, added: 2, playerId: 241651, assistId: 246669 }, { side: 'for', minute: 80, playerId: 222665, assistId: 246669 }], players: [{ playerId: 220901, minutes: 90, rating: 7.4 }, { playerId: 243715, minutes: 90, rating: 7.8 }, { playerId: 241651, minutes: 75, rating: 9.6 }] }),
    // A defeat, goals not listed.
    normalizeMatch({ ...base, date: '2025-09-13', opponentId: 9, venue: 'away', goalsFor: 0, goalsAgainst: 2 }),
  ];
}

test('a match has to add up before it is logged', () => {
  assert.throws(() => normalizeMatch({ date: '2025-08-16', opponentId: 9, goalsFor: 1, goalsAgainst: 0, goals: [{ side: 'for', minute: 3, playerId: 1 }, { side: 'for', minute: 9, playerId: 2 }] }), /2 goals are listed/);
  assert.throws(() => normalizeMatch({ date: '', opponentId: 9, goalsFor: 1, goalsAgainst: 0 }), /date/);
  assert.throws(() => normalizeMatch({ date: '2025-08-16', goalsFor: 1, goalsAgainst: 0 }), /opponent/);
  assert.throws(() => normalizeMatch({ date: '2025-08-16', opponentId: 9, goalsFor: 1, goalsAgainst: 0, goals: [{ side: 'for', minute: 3, playerId: 4, assistId: 4 }] }), /assist his own/);
  assert.throws(() => normalizeMatch({ date: '2025-08-16', opponentId: 9, goalsFor: 1, goalsAgainst: 0, goals: [{ side: 'for', minute: 300, playerId: 4 }] }), /minute/);
  const m = normalizeMatch({ date: '2025-08-16', opponentId: 9, goalsFor: 0, goalsAgainst: 0, stats: { possession: [61, ''] } });
  assert.deepEqual(m.stats.possession, [61, 39], 'their possession fills itself in');
});

test('the story of a match: comebacks, late winners, hat-tricks', () => {
  const [first, second, third] = sampleLog();
  const s1 = matchStory(first, (id) => `#${id}`);
  assert.equal(s1.result, 'W');
  assert.equal(s1.facts.cameFromBehind, true);
  assert.equal(s1.facts.lateWinner.playerId, 241651);
  assert.ok(s1.lines.some((l) => /Late winner: #241651 90\+3'/.test(l)));
  const s2 = matchStory(second, (id) => `#${id}`);
  assert.equal(s2.facts.ledAndDidNotWin, true);
  assert.ok(s2.lines.some((l) => /Red card: #225193 60'/.test(l)));
  const s3 = matchStory(third, (id) => `#${id}`);
  assert.ok(s3.lines.some((l) => /Hat-trick for #241651/.test(l)));
  assert.ok(s3.lines.some((l) => /3 assists for #246669/.test(l)));
  assert.ok(s3.lines.includes('Clean sheet.'));
});

test('advanced stats from the Match Log', () => {
  const c = career();
  const s = logStats(sampleLog(), { career: c });
  assert.equal(s.matches, 4);
  assert.deepEqual([s.record.won, s.record.drawn, s.record.lost, s.record.gf, s.record.ga, s.record.points], [2, 1, 1, 7, 4, 7]);
  assert.equal(s.venue.home.won, 2);
  assert.equal(s.team.cleanSheets, 1);
  assert.equal(s.team.failedToScore, 1);
  assert.equal(s.team.cameFromBehind, 1);
  assert.equal(s.team.pointsFromBehind, 3);
  assert.equal(s.team.ledAndDidNotWin, 1);
  assert.equal(s.team.pointsDroppedFromAhead, 2);
  assert.equal(s.team.lateWinners, 1);
  // The fourth match has no goals listed, so it is left out of game state.
  assert.equal(s.team.scoredFirst.played + s.team.concededFirst.played, 3);
  // Goal times: 5', 20', 44', 45+2', 55', 80', 90+3' for; 10', 70' against.
  assert.deepEqual(s.team.goalsFor, [1, 1, 2, 1, 0, 2, 0], 'stoppage time stays in its half');
  assert.deepEqual(s.team.goalsAgainst, [1, 0, 0, 0, 1, 0, 0]);
  assert.equal(s.team.goalTypesFor.penalty, 1);
  assert.equal(s.team.goalTypesFor.header, 1);
  assert.equal(s.finishing.conversion, 14);
  assert.equal(s.finishing.goalsMinusXg, 0.1);
  const gy = s.players.find((p) => p.playerId === 241651);
  assert.equal(gy.goals, 4);
  assert.equal(gy.hatTricks, 1);
  assert.equal(gy.headers, 1);
  const saka = s.players.find((p) => p.playerId === 246669);
  assert.deepEqual([saka.goals, saka.assists, saka.penalties, saka.motm], [2, 3, 1, 1]);
  // Minutes from the save fill in where the log has none (Saka played 90 in
  // each of the save's matches on these dates).
  assert.ok(saka.minutes >= 270);
  assert.equal(saka.goalsPer90, Math.round((2 / saka.minutes) * 90 * 100) / 100);
  const saliba = s.players.find((p) => p.playerId === 243715);
  assert.equal(saliba.cleanSheets, 1, 'a defender who played 60+ in a clean sheet');
  assert.equal(s.partnerships[0].assister, 'B. Saka');
  assert.equal(s.partnerships[0].goals, 2);
  assert.equal(s.injuries[0].name, 'W. Saliba');
  assert.equal(s.injuries[0].back, '2025-10-04');
  assert.equal(s.injuries[0].out, true, 'still out on the career date (27 Sep)');
  assert.equal(s.streaks.losses.current, 1);
  assert.equal(s.streaks.unbeaten.best, 3);
  assert.equal(s.extremes.biggestWin.score, '4-0');
  assert.equal(s.strength.top.played + s.strength.middle.played + s.strength.bottom.played, 0, 'opponent strength needs a league of six or more clubs');
  const view = matchView(sampleLog()[0], c);
  assert.equal(view.goals[2].scorer, 'V. Gyökeres');
  assert.equal(view.goals[2].minuteText, "90+3'");
  assert.equal(view.motm, 'B. Saka');
});

test('the FC 26 API opens a save, logs a match and names a player', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc26-api-'));
  const file = path.join(dir, 'ManagerCareer20250927');
  fs.writeFileSync(file, sampleCareer().save);
  const before = fs.readFileSync(file);
  const { server, port } = await startServer({ port: 0, host: '127.0.0.1', dataDir: path.join(dir, 'data') });
  const base = `http://127.0.0.1:${port}/api`;
  const get = async (p) => (await fetch(base + p)).json();
  const post = async (p, body) => (await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json();
  try {
    const o = await post('/fc/open', { filePath: file });
    assert.equal(o.ok, true);
    assert.equal(o.summary.club, 'Arsenal');
    const k = o.careerKey;
    const ov = await get(`/fc/${k}/overview`);
    assert.equal(ov.overview.club.standing.position, 1);
    const bad = await post(`/fc/${k}/matches`, { date: '2025-08-16', opponentId: 18, goalsFor: 1, goalsAgainst: 0, goals: [{ side: 'for', minute: 3, playerId: 246669 }, { side: 'for', minute: 9, playerId: 241651 }] });
    assert.equal(bad.ok, false);
    const saved = await post(`/fc/${k}/matches`, { date: '2025-08-16', opponentId: 18, venue: 'home', competition: 'Premier League', goalsFor: 2, goalsAgainst: 0, goals: [{ side: 'for', minute: 12, playerId: 246669 }, { side: 'for', minute: 70, playerId: 241651, assistId: 246669 }] });
    assert.equal(saved.ok, true);
    assert.equal(saved.match.score, '2-0');
    const list = await get(`/fc/${k}/matches`);
    assert.equal(list.matches.length, 1);
    assert.equal(list.rated.length, 5);
    const st = await get(`/fc/${k}/log-stats`);
    assert.equal(st.stats.record.won, 1);
    const fx = await get(`/fc/${k}/fixtures`);
    assert.equal(fx.fixtures.find((f) => f.date === '2025-08-16').logged.score, '2-0', 'the logged result shows on the fixture');
    const pl = await get(`/fc/${k}/players/246669`);
    assert.equal(pl.logged.goals, 1);
    assert.equal(pl.logged.assists, 1);
    const named = await post(`/fc/${k}/names`, { playerId: 500001, name: 'Jamie Prospect' });
    assert.equal(named.ok, true);
    assert.equal((await get(`/fc/${k}/players/500001`)).profile.player.name, 'Jamie Prospect');
    for (const p of ['/leagues', '/standings/13', '/leaders?leagueId=13', '/clubs', '/clubs/1', '/transfers', '/manager', '/squad/1']) assert.equal((await get(`/fc/${k}${p}`)).ok, true, p);
    const status = await get('/fc/status');
    assert.equal(status.careers[0].club, 'Arsenal');
    assert.ok(fs.readFileSync(file).equals(before), 'the save is never written to');
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('FC 26 saves are found in Documents, OneDrive and the local app data folder', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'fc26-home-'));
  const put = (dir, name, kb) => { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, name), Buffer.alloc(kb * 1024, 1)); };
  put(path.join(home, 'OneDrive', 'Documents', 'FC 26', 'settings'), 'ManagerCareer20250927', 500);
  put(path.join(home, 'OneDrive', 'Documents', 'FC 26', 'settings'), 'Squads20250901', 900);
  put(path.join(home, 'OneDrive', 'Documents', 'FC 26', 'settings'), 'profile', 900);
  put(path.join(home, 'AppData', 'Local', 'EA SPORTS FC 26', 'settings'), 'CareerSave1', 600);
  put(path.join(home, 'AppData', 'Local', 'EA SPORTS FC 26', 'settings'), 'CareerTiny', 2);
  const { files } = findFcSaves({ home, env: {} });
  assert.deepEqual(files.map((f) => `${f.kind}:${f.name}`).sort(), ['career:CareerSave1', 'career:ManagerCareer20250927', 'squads:Squads20250901']);
  assert.equal(files[0].kind, 'career', 'career saves come first');
  fs.rmSync(home, { recursive: true, force: true });
});
