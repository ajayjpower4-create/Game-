// A small made-up league in the same shape the Companion App builder makes.
import { buildLeagueFromCompanion } from '../src/core/companion/league.js';

export function syntheticRaw() {
  const kc = [
    { rosterId: 1, firstName: 'Pat', lastName: 'Passer', position: 'QB', teamId: 101, jerseyNum: 15, playerBestOvr: 99, awareRating: 99, devTrait: 3, capHit: 45000000, contractSalary: 40000000, contractBonus: 60000000, contractLength: 5, contractYearsLeft: 3, capReleaseNetSavings: 12000000, capReleasePenalty: 33000000 },
    { rosterId: 2, firstName: 'Left', lastName: 'Tackle', position: 'LT', teamId: 101, jerseyNum: 77, playerBestOvr: 80, passBlockRating: 82, runBlockRating: 78, impactBlockRating: 80, capHit: 9000000, contractSalary: 8000000, contractBonus: 5000000, contractLength: 3, contractYearsLeft: 1 },
    { rosterId: 3, firstName: 'Right', lastName: 'Guard', position: 'RG', teamId: 101, jerseyNum: 65, playerBestOvr: 75, passBlockRating: 70 },
    { rosterId: 4, firstName: 'Fast', lastName: 'Receiver', position: 'WR', teamId: 101, jerseyNum: 10, playerBestOvr: 92, deepRouteRunRating: 90 },
    { rosterId: 5, firstName: 'Slot', lastName: 'Guy', position: 'WR', teamId: 101, jerseyNum: 11, playerBestOvr: 80 },
    { rosterId: 6, firstName: 'Bell', lastName: 'Cow', position: 'HB', teamId: 101, jerseyNum: 25, playerBestOvr: 85 },
    { rosterId: 7, firstName: 'Corner', lastName: 'One', position: 'CB', teamId: 101, jerseyNum: 21, playerBestOvr: 85, tackleRating: 55 },
    { rosterId: 8, firstName: 'Mike', lastName: 'Backer', position: 'MLB', teamId: 101, jerseyNum: 54, playerBestOvr: 84, tackleRating: 88 },
    { rosterId: 9, firstName: 'Edge', lastName: 'Rusher', position: 'RE', teamId: 101, jerseyNum: 91, playerBestOvr: 90, powerMovesRating: 90 },
    { rosterId: 10, firstName: 'Big', lastName: 'Leg', position: 'K', teamId: 101, jerseyNum: 3, playerBestOvr: 80 },
  ];
  const buf = [
    { rosterId: 21, firstName: 'Josh', lastName: 'Thrower', position: 'QB', teamId: 102, jerseyNum: 17, playerBestOvr: 95 },
    { rosterId: 22, firstName: 'Big', lastName: 'Tackle', position: 'LT', teamId: 102, jerseyNum: 73, playerBestOvr: 85, passBlockRating: 88 },
    { rosterId: 23, firstName: 'Von', lastName: 'Edge', position: 'LE', teamId: 102, jerseyNum: 40, playerBestOvr: 88, finesseMovesRating: 92 },
    { rosterId: 24, firstName: 'Ed', lastName: 'Tackle', position: 'DT', teamId: 102, jerseyNum: 50, playerBestOvr: 86, powerMovesRating: 88 },
    { rosterId: 25, firstName: 'Stef', lastName: 'Wideout', position: 'WR', teamId: 102, jerseyNum: 14, playerBestOvr: 93 },
    { rosterId: 26, firstName: 'James', lastName: 'Back', position: 'HB', teamId: 102, jerseyNum: 4, playerBestOvr: 84 },
    { rosterId: 27, firstName: 'Safety', lastName: 'Man', position: 'FS', teamId: 102, jerseyNum: 23, playerBestOvr: 86, tackleRating: 70 },
  ];
  return {
    leagueteams: [
      { teamId: 101, abbrName: 'KC', cityName: 'Kansas City', displayName: 'Chiefs', nickName: 'Chiefs', divName: 'AFC West', logoId: 1, ovrRating: 90, userName: 'me' },
      { teamId: 102, abbrName: 'BUF', cityName: 'Buffalo', displayName: 'Bills', nickName: 'Bills', divName: 'AFC East', logoId: 2, ovrRating: 88 },
    ],
    standings: [{ teamId: 101, totalWins: 1, totalLosses: 0, seed: 1, rank: 1, capRoom: 279200000, capSpent: 250000000, capAvailable: 29200000 }, { teamId: 102, totalWins: 0, totalLosses: 1, seed: 5, rank: 5, capRoom: 279200000, capSpent: 270000000, capAvailable: 9200000 }],
    rosters: { 101: kc, 102: buf },
    schedules: { 'reg-1': [{ scheduleId: 9001, homeTeamId: 101, awayTeamId: 102, homeScore: 27, awayScore: 24, status: 3, weekIndex: 0, stageIndex: 1, seasonIndex: 0 }, { scheduleId: 9002, homeTeamId: 102, awayTeamId: 101, homeScore: 0, awayScore: 0, status: 1, weekIndex: 1, stageIndex: 1, seasonIndex: 0 }] },
    passing: { 'reg-1': [{ scheduleId: 9001, rosterId: 1, teamId: 101, fullName: 'Pat Passer', passAtt: 34, passComp: 24, passYds: 310, passTDs: 3, passInts: 1, passSacks: 2, passLongest: 45 }, { scheduleId: 9001, rosterId: 21, teamId: 102, fullName: 'Josh Thrower', passAtt: 40, passComp: 26, passYds: 290, passTDs: 2, passInts: 0, passSacks: 3 }] },
    rushing: { 'reg-1': [{ scheduleId: 9001, rosterId: 6, teamId: 101, fullName: 'Bell Cow', rushAtt: 22, rushYds: 110, rushBrokenTackles: 4 }, { scheduleId: 9001, rosterId: 26, teamId: 102, fullName: 'James Back', rushAtt: 15, rushYds: 60, rushBrokenTackles: 2 }] },
    receiving: { 'reg-1': [{ scheduleId: 9001, rosterId: 4, teamId: 101, fullName: 'Fast Receiver', recCatches: 9, recDrops: 1, recYds: 150, recTDs: 2, recYdsAfterCatch: 60, recCatchPct: 75, recLongest: 45 }, { scheduleId: 9001, rosterId: 5, teamId: 101, fullName: 'Slot Guy', recCatches: 6, recDrops: 2, recYds: 70, recLongest: 20 }, { scheduleId: 9001, rosterId: 6, teamId: 101, fullName: 'Bell Cow', recCatches: 1, recDrops: 0, recYds: 12, recTDs: 1, recLongest: 12 }, { scheduleId: 9001, rosterId: 25, teamId: 102, fullName: 'Stef Wideout', recCatches: 10, recDrops: 1, recYds: 140 }] },
    defense: { 'reg-1': [{ scheduleId: 9001, rosterId: 7, teamId: 101, fullName: 'Corner One', defTotalTackles: 6 }, { scheduleId: 9001, rosterId: 8, teamId: 101, fullName: 'Mike Backer', defTotalTackles: 11, defSacks: 1 }, { scheduleId: 9001, rosterId: 9, teamId: 101, fullName: 'Edge Rusher', defTotalTackles: 4, defSacks: 2 }, { scheduleId: 9001, rosterId: 23, teamId: 102, fullName: 'Von Edge', defTotalTackles: 5, defSacks: 2 }, { scheduleId: 9001, rosterId: 24, teamId: 102, fullName: 'Ed Tackle', defTotalTackles: 4 }, { scheduleId: 9001, rosterId: 27, teamId: 102, fullName: 'Safety Man', defTotalTackles: 9 }] },
    kicking: { 'reg-1': [{ scheduleId: 9001, rosterId: 10, teamId: 101, fullName: 'Big Leg', fGAtt: 2, fGMade: 2, fGLongest: 48, xpAtt: 3, xpMade: 3 }] },
    punting: {},
    teamstats: { 'reg-1': [{ scheduleId: 9001, teamId: 101, penalties: 6, penaltyYds: 55, offSacks: 2, defSacks: 3, offTotalYds: 420, offPassYds: 310, offRushYds: 110 }, { scheduleId: 9001, teamId: 102, penalties: 4, penaltyYds: 30, offSacks: 3, defSacks: 2, offTotalYds: 350 }] },
    meta: { platform: 'xbsx', leagueId: '555' },
  };
}

export function syntheticLeague() {
  return buildLeagueFromCompanion(syntheticRaw(), { leagueKey: 'companion-xbsx-555', name: 'Test league' });
}
