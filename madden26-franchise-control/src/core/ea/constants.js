// Everything the Madden Companion App uses to talk to EA, per game year.
//
// The tool signs in the same way the official Madden Companion App does: EA's
// normal account login page, then the companion app's own client credentials
// for the token exchange, then the Blaze game server the app talks to. These
// values are the ones embedded in the companion app for each Madden year and
// are documented by the open-source Snallabot project (MIT).

export const AUTH_SOURCE = 317239;
export const REDIRECT_URL = 'http://127.0.0.1/success';
export const MACHINE_KEY = '444d362e8e067fe2';
export const ACCOUNTS_HOST = 'https://accounts.ea.com';
export const GATEWAY_HOST = 'https://gateway.ea.com';
export const WAL_HOST = 'https://wal2.tools.gos.bio-iad.ea.com';
export const APP_USER_AGENT = 'Dalvik/2.1.0 (Linux; U; Android 13; sdk_gphone_x86_64 Build/TE1A.220922.031)';
export const WEBVIEW_USER_AGENT = 'Mozilla/5.0 (Linux; Android 13; sdk_gphone_x86_64 Build/TE1A.220922.031; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/103.0.5060.71 Mobile Safari/537.36';

export const YEARS = {
  26: {
    year: 26,
    fullYear: '2026',
    clientId: 'MCA_26_COMP_APP',
    clientSecret: 'teJpJ9cSXFqZAuKNW8IuHpy8D4dwWPoVrPoek38iCnrGbrUSfjqnHMBAv8iCVjeSm_20250910175618',
    componentName: 'careermode',
  },
  27: {
    year: 27,
    fullYear: '2027',
    clientId: 'MCA_27_COMP_APP',
    clientSecret: 'AmVfGJMTkej18iUCKagWGjm06MMPLDAmNklPPgReXy9ENWxEpb4OnOyYORTYRyJcq_20260727062224',
    componentName: 'franchisemode',
  },
};
export const DEFAULT_YEAR = 26;

// Console key -> how EA names it in entitlements, personas and Blaze.
export const CONSOLES = {
  ps5: { key: 'ps5', label: 'PlayStation 5', entitlement: 'PS5', namespace: 'ps3' },
  xbsx: { key: 'xbsx', label: 'Xbox Series X|S', entitlement: 'XBSX', namespace: 'xbox' },
  pc: { key: 'pc', label: 'PC', entitlement: 'PC', namespace: 'cem_ea_id' },
  ps4: { key: 'ps4', label: 'PlayStation 4', entitlement: 'PS4', namespace: 'ps3' },
  xone: { key: 'xone', label: 'Xbox One', entitlement: 'XONE', namespace: 'xbox' },
};

export const NAMESPACE_LABEL = { ps3: 'PlayStation Network', xbox: 'Xbox', cem_ea_id: 'EA account (PC)', stadia: 'Stadia' };

export function yearConfig(year = DEFAULT_YEAR) {
  const cfg = YEARS[Number(year)];
  if (!cfg) throw new Error(`Madden ${year} is not supported for EA sign-in`);
  return cfg;
}

export function entitlementGroup(year, consoleKey) {
  return `MADDEN_${yearConfig(year).year}${CONSOLES[consoleKey].entitlement}`;
}

export function consoleForEntitlement(year, groupName) {
  for (const c of Object.values(CONSOLES)) if (entitlementGroup(year, c.key) === groupName) return c;
  return null;
}

export function blazeServiceId(year, consoleKey) {
  return `madden-${yearConfig(year).fullYear}-${consoleKey}`;
}

export function blazeProductName(year, consoleKey) {
  return `madden-${yearConfig(year).fullYear}-${consoleKey}-mca`;
}

export function loginUrl(year = DEFAULT_YEAR) {
  const cfg = yearConfig(year);
  const q = new URLSearchParams({
    hide_create: 'true',
    release_type: 'prod',
    response_type: 'code',
    redirect_uri: REDIRECT_URL,
    client_id: cfg.clientId,
    machineProfileKey: MACHINE_KEY,
    authentication_source: String(AUTH_SOURCE),
  });
  return `${ACCOUNTS_HOST}/connect/auth?${q.toString()}`;
}

// EA's dedicated export endpoints on the Blaze web access layer.
export const EXPORT_KINDS = {
  leagueteams: 'CareerMode_GetLeagueTeamsExport',
  standings: 'CareerMode_GetStandingsExport',
  schedules: 'CareerMode_GetWeeklySchedulesExport',
  rushing: 'CareerMode_GetWeeklyRushingStatsExport',
  teamstats: 'CareerMode_GetWeeklyTeamStatsExport',
  punting: 'CareerMode_GetWeeklyPuntingStatsExport',
  receiving: 'CareerMode_GetWeeklyReceivingStatsExport',
  defense: 'CareerMode_GetWeeklyDefensiveStatsExport',
  kicking: 'CareerMode_GetWeeklyKickingStatsExport',
  passing: 'CareerMode_GetWeeklyPassingStatsExport',
  roster: 'CareerMode_GetTeamRostersExport',
};

export const COMMANDS = {
  getMyLeagues: { commandName: 'Mobile_GetMyLeagues', componentId: 2060, commandId: 801 },
  getLeagueHub: { commandName: 'Mobile_Career_GetLeagueHub', componentId: 2060, commandId: 811 },
};

export const PRESEASON_WEEKS = [0, 1, 2, 3];
export const SEASON_WEEKS = Array.from({ length: 23 }, (_, i) => i).filter((i) => i !== 21); // 21 is the Pro Bowl
