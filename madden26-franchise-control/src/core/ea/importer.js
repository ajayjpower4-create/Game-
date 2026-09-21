// Pulls a whole franchise from EA (teams, standings, every week's schedule and
// stats, every roster) and files it in the store exactly as if the Companion
// App had exported it, so the rest of the tool does not care where it came from.

import { extractList } from '../companion/normalize.js';
import { PRESEASON_WEEKS, SEASON_WEEKS } from './constants.js';

export function leagueKeyFor(consoleKey, leagueId) {
  return `ea-${consoleKey}-${leagueId}`;
}

// scope: 'all' | 'current' | 'surrounding'
export function weeksFor(scope, hub) {
  const season = hub && hub.careerHubInfo && hub.careerHubInfo.seasonInfo ? hub.careerHubInfo.seasonInfo : { seasonWeek: 0, seasonWeekType: 1 };
  const stage = Number(season.seasonWeekType) === 0 ? 0 : 1;
  const current = Number(season.seasonWeekType) === 8 ? 22 : Number(season.seasonWeek) || 0;
  if (scope === 'current') return [{ stageIndex: stage, weekIndex: current }];
  if (scope === 'surrounding') {
    const max = stage === 0 ? 3 : 22;
    const prev = current - 1 === 21 ? 20 : current - 1;
    const next = current + 1 === 21 ? 22 : current + 1;
    return [prev, current, next].filter((w) => w >= 0 && w <= max).map((weekIndex) => ({ stageIndex: stage, weekIndex }));
  }
  return [...PRESEASON_WEEKS.map((weekIndex) => ({ stageIndex: 0, weekIndex })), ...SEASON_WEEKS.map((weekIndex) => ({ stageIndex: 1, weekIndex }))];
}

const WEEKLY_KINDS = ['schedules', 'passing', 'rushing', 'receiving', 'defense', 'kicking', 'punting', 'teamstats'];

export async function importLeague({ client, store, league, scope = 'all', rosters = true, onProgress = () => {}, log = () => {} }) {
  const leagueId = Number(league.leagueId);
  const consoleKey = client.console;
  const leagueKey = leagueKeyFor(consoleKey, leagueId);
  const platform = consoleKey;
  const progress = { step: 'league info', done: 0, total: 0, errors: [] };
  const report = (step) => { progress.step = step; onProgress({ ...progress }); };

  const save = (info, data) => {
    const list = extractList(info.kind, data);
    store.saveCompanionPayload(leagueKey, { platform, leagueId: String(leagueId), ...info }, list);
    return list.length;
  };

  report('league info');
  const hub = await client.getLeagueHub(leagueId);
  const weeks = weeksFor(scope, hub);
  const teamList = (hub && hub.teamIdInfoList) || [];
  progress.total = 2 + weeks.length * WEEKLY_KINDS.length + (rosters ? teamList.length + 1 : 0);

  const teams = await client.teams(leagueId);
  save({ kind: 'leagueteams' }, teams);
  progress.done += 1;
  const standings = await client.standings(leagueId);
  save({ kind: 'standings' }, standings);
  progress.done += 1;
  report('league info');

  for (const w of weeks) {
    const stage = w.stageIndex === 0 ? 'pre' : 'reg';
    report(`${stage === 'pre' ? 'preseason' : 'season'} week ${w.weekIndex + 1}`);
    const results = await Promise.allSettled(WEEKLY_KINDS.map((kind) => client.weekly(kind, leagueId, w.stageIndex, w.weekIndex)));
    results.forEach((r, i) => {
      const kind = WEEKLY_KINDS[i];
      if (r.status === 'fulfilled') save({ kind, stage, week: w.weekIndex + 1 }, r.value);
      else { progress.errors.push(`${kind} ${stage} ${w.weekIndex + 1}: ${r.reason && r.reason.message}`); log(`import error: ${kind} ${stage} ${w.weekIndex + 1}: ${r.reason && r.reason.message}`); }
      progress.done += 1;
    });
    report(progress.step);
  }

  if (rosters) {
    report('free agents');
    try { save({ kind: 'roster', teamId: 'freeagents' }, await client.freeAgents(leagueId)); } catch (e) { progress.errors.push(`free agents: ${e.message}`); }
    progress.done += 1;
    for (let i = 0; i < teamList.length; i++) {
      const t = teamList[i];
      report(`roster ${i + 1} of ${teamList.length}`);
      try { save({ kind: 'roster', teamId: String(t.teamId) }, await client.roster(leagueId, t.teamId, i)); } catch (e) { progress.errors.push(`roster ${t.teamId}: ${e.message}`); }
      progress.done += 1;
      report(progress.step);
    }
  }

  const season = hub && hub.careerHubInfo && hub.careerHubInfo.seasonInfo ? hub.careerHubInfo.seasonInfo : null;
  store.setMeta(leagueKey, { name: league.leagueName || `EA league ${leagueId}`, source: 'companion', via: 'ea', platform, companionLeagueId: String(leagueId), eaLeague: { leagueId, leagueName: league.leagueName, userTeamName: league.userTeamName, seasonText: league.seasonText, calendarYear: league.calendarYear }, seasonInfo: season, lastImportAt: new Date().toISOString(), lastImportScope: scope });
  report('done');
  return { leagueKey, weeks: weeks.length, teams: teamList.length, errors: progress.errors };
}
