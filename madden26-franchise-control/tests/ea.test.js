import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { messageAuth, AUTH_TYPE } from '../src/core/ea/signing.js';
import { codeFromRedirect } from '../src/core/ea/auth.js';
import { loginUrl, blazeServiceId, blazeServiceCandidates, blazeProductName, entitlementGroup, consoleForEntitlement, gameClientId, yearConfig, EXPORT_KINDS, COMMANDS } from '../src/core/ea/constants.js';
import { weeksFor, importLeague, leagueKeyFor } from '../src/core/ea/importer.js';
import { Store } from '../src/core/store.js';
import { buildLeagueFromCompanion } from '../src/core/companion/league.js';
import { syntheticRaw } from './helpers.js';

test('message auth is stable for a fixed nonce and carries the companion auth type', () => {
  const nonce = Buffer.from('01020304', 'hex');
  const a = messageAuth(417448296, 3, nonce);
  const b = messageAuth(417448296, 3, nonce);
  assert.deepEqual(a, b, 'same inputs give the same signature');
  assert.equal(a.authType, AUTH_TYPE);
  // 4 nonce bytes in front of the scrambled request description
  const described = Buffer.byteLength(JSON.stringify({ staticData: '05e6a7ead5584ab4', requestId: 3, blazeId: 417448296 }));
  assert.equal(Buffer.from(a.authData, 'base64').length, 4 + described);
  assert.equal(Buffer.from(a.authCode, 'base64').length, 16, 'the code is an md5 digest');
  // The nonce is carried in the clear so the server can unscramble it.
  assert.ok(Buffer.from(a.authData, 'base64').subarray(0, 4).equals(nonce));
  // Each request in a session must sign differently.
  assert.notEqual(messageAuth(417448296, 4, nonce).authData, a.authData);
  assert.notEqual(messageAuth(1, 3, nonce).authData, a.authData);
});

test('codeFromRedirect accepts the pasted address or the bare code', () => {
  assert.equal(codeFromRedirect('http://127.0.0.1/success?code=QUOwAFs1F2cl_yzfbijvjqvosL_xZ7Bxt4tVjSdhAQ'), 'QUOwAFs1F2cl_yzfbijvjqvosL_xZ7Bxt4tVjSdhAQ');
  assert.equal(codeFromRedirect('  ?code=abcDEF123456  '), 'abcDEF123456');
  assert.equal(codeFromRedirect('QUOwAFs1F2cl_yzfbijvjqvosL_xZ7Bxt4tVjSdhAQ'), 'QUOwAFs1F2cl_yzfbijvjqvosL_xZ7Bxt4tVjSdhAQ');
  assert.equal(codeFromRedirect('http://127.0.0.1/success?error=denied'), null);
  assert.equal(codeFromRedirect(''), null);
});

test('Madden 26 constants match the companion app naming', () => {
  assert.match(loginUrl(26), /accounts\.ea\.com\/connect\/auth\?/);
  assert.match(loginUrl(26), /client_id=MCA_26_COMP_APP/);
  assert.match(loginUrl(26), /redirect_uri=http%3A%2F%2F127\.0\.0\.1%2Fsuccess/);
  assert.equal(blazeServiceId(26, 'ps5'), 'madden-2026-ps5');
  assert.equal(blazeProductName(26, 'xbsx'), 'madden-2026-xbsx-mca');
  assert.equal(entitlementGroup(26, 'pc'), 'MADDEN_26PC');
  assert.equal(consoleForEntitlement(26, 'MADDEN_26PS5').key, 'ps5');
  assert.equal(consoleForEntitlement(26, 'MADDEN_25PS5'), null);
  assert.equal(yearConfig(26).componentName, 'careermode');
  assert.equal(yearConfig(27).componentName, 'franchisemode');
  assert.throws(() => yearConfig(24));
  assert.equal(COMMANDS.getMyLeagues.commandId, 801);
  assert.equal(EXPORT_KINDS.roster, 'CareerMode_GetTeamRostersExport');
  // The game client signs in under its own name, not the phone app's.
  assert.equal(gameClientId(26, 'pc'), 'MADDEN_26_PC_BLZ_SERVER');
  assert.equal(gameClientId(26, 'ps5'), 'MADDEN_26_PS5_BLZ_SERVER');
  assert.equal(gameClientId(27, 'xbsx'), 'MADDEN_27_XBSX_BLZ_SERVER');
});

test('game server naming falls back the way EA has renamed these clusters', () => {
  // EA answered a 503 naming madden-2026-common, so that form is tried too.
  assert.deepEqual(blazeServiceCandidates(26, 'pc'), ['madden-2026-pc', 'madden-2026-pc-gen5', 'madden-2026-common']);
  assert.deepEqual(blazeServiceCandidates(26, 'ps4'), ['madden-2026-ps4', 'madden-2026-ps4-gen4', 'madden-2026-common']);
  assert.equal(blazeServiceCandidates(27, 'xbsx')[0], 'madden-2027-xbsx');
  // The first candidate is always the plain name used on its own elsewhere.
  for (const c of ['pc', 'ps5', 'xbsx', 'ps4', 'xone']) {
    assert.equal(blazeServiceCandidates(26, c)[0], blazeServiceId(26, c));
    assert.equal(new Set(blazeServiceCandidates(26, c)).size, blazeServiceCandidates(26, c).length, 'no duplicates');
  }
});

test('weeksFor covers the whole season or just the current week', () => {
  const all = weeksFor('all', null);
  assert.equal(all.length, 4 + 22);
  assert.ok(!all.some((w) => w.stageIndex === 1 && w.weekIndex === 21), 'pro bowl week is skipped');
  const hub = { careerHubInfo: { seasonInfo: { seasonWeek: 7, seasonWeekType: 1 } } };
  assert.deepEqual(weeksFor('current', hub), [{ stageIndex: 1, weekIndex: 7 }]);
  assert.deepEqual(weeksFor('surrounding', hub).map((w) => w.weekIndex), [6, 7, 8]);
  assert.deepEqual(weeksFor('current', { careerHubInfo: { seasonInfo: { seasonWeek: 1, seasonWeekType: 0 } } }), [{ stageIndex: 0, weekIndex: 1 }]);
});

test('importLeague files EA data into the store like a companion export', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'm26fc-ea-'));
  const store = new Store(dir);
  const raw = syntheticRaw();
  const calls = [];
  const client = {
    console: 'ps5',
    async getLeagueHub(leagueId) { calls.push(['hub', leagueId]); return { careerHubInfo: { seasonInfo: { seasonWeek: 0, seasonWeekType: 1 } }, teamIdInfoList: [{ teamId: 101 }, { teamId: 102 }] }; },
    async teams() { return { success: true, message: '', leagueTeamInfoList: raw.leagueteams }; },
    async standings() { return { success: true, message: '', teamStandingInfoList: raw.standings }; },
    async weekly(kind, leagueId, stageIndex, weekIndex) {
      calls.push(['weekly', kind, stageIndex, weekIndex]);
      const key = { schedules: 'gameScheduleInfoList', passing: 'playerPassingStatInfoList', rushing: 'playerRushingStatInfoList', receiving: 'playerReceivingStatInfoList', defense: 'playerDefensiveStatInfoList', kicking: 'playerKickingStatInfoList', punting: 'playerPuntingStatInfoList', teamstats: 'teamStatInfoList' }[kind];
      const list = stageIndex === 1 && weekIndex === 0 ? raw[kind]['reg-1'] || [] : [];
      return { success: true, message: '', [key]: list };
    },
    async roster(leagueId, teamId) { return { success: true, message: '', rosterInfoList: raw.rosters[teamId] }; },
    async freeAgents() { return { success: true, message: '', rosterInfoList: [] }; },
  };
  const steps = [];
  const result = await importLeague({ client, store, league: { leagueId: 555, leagueName: 'Test league', userTeamName: 'Chiefs' }, scope: 'current', onProgress: (p) => steps.push(p.step) });
  assert.equal(result.leagueKey, leagueKeyFor('ps5', 555));
  assert.equal(result.weeks, 1);
  assert.equal(result.errors.length, 0);
  assert.ok(steps.includes('done'));
  const stored = store.getCompanionRaw(result.leagueKey);
  assert.equal(stored.leagueteams.length, 2);
  assert.equal(stored.schedules['reg-1'].length, 2);
  assert.equal(Object.keys(stored.rosters).sort().join(','), '101,102,freeagents');
  const meta = store.getMeta(result.leagueKey);
  assert.equal(meta.via, 'ea');
  assert.equal(meta.name, 'Test league');
  const league = buildLeagueFromCompanion(stored, { leagueKey: result.leagueKey, name: meta.name });
  assert.equal(Object.keys(league.games).length, 2);
  assert.equal(league.games.s9001.status, 'played');
  fs.rmSync(dir, { recursive: true, force: true });
});
