// EA account sign-in, the way the Madden Companion App does it:
//   1. the user logs in on EA's real login page (loginUrl) and EA redirects
//      to http://127.0.0.1/success?code=...
//   2. that code becomes an account token
//   3. the account's Madden entitlements and personas tell us which console
//      profiles own this year's Madden
//   4. a second, persona-scoped code becomes the JWS token Blaze accepts

import { request, parseJson } from './http.js';
import { ACCOUNTS_HOST, GATEWAY_HOST, REDIRECT_URL, AUTH_SOURCE, MACHINE_KEY, APP_USER_AGENT, WEBVIEW_USER_AGENT, CONSOLES, YEARS, yearConfig, consoleForEntitlement, NAMESPACE_LABEL } from './constants.js';

export class EAError extends Error {
  constructor(message, help) {
    super(message);
    this.name = 'EAError';
    this.help = help || '';
  }
}

const form = (obj) => new URLSearchParams(obj).toString();
const appHeaders = { 'Accept-Charset': 'UTF-8', 'User-Agent': APP_USER_AGENT };

// Accepts the pasted redirect URL, or just the code.
export function codeFromRedirect(input) {
  const s = String(input || '').trim();
  if (!s) return null;
  if (/^[A-Za-z0-9_-]{10,}$/.test(s) && !s.includes('://')) return s;
  const q = s.includes('?') ? s.slice(s.indexOf('?') + 1) : s;
  const code = new URLSearchParams(q.replace(/^\?/, '')).get('code');
  return code || null;
}

export async function exchangeCode(code, year) {
  const cfg = yearConfig(year);
  const res = await request(`${ACCOUNTS_HOST}/connect/token`, {
    method: 'POST',
    headers: { ...appHeaders, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: form({ authentication_source: AUTH_SOURCE, client_secret: cfg.clientSecret, grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URL, release_type: 'prod', client_id: cfg.clientId }),
  });
  if (!res.ok) throw new EAError(`EA rejected the login code (${res.status}): ${res.text.slice(0, 300)}`, 'Each login link works once. Go back, sign in again, and paste the new address right away.');
  const token = parseJson(res.text);
  if (!token.access_token) throw new EAError(`EA returned no token: ${res.text.slice(0, 300)}`);
  return token;
}

export async function tokenInfo(accessToken) {
  const res = await request(`${ACCOUNTS_HOST}/connect/tokeninfo?access_token=${encodeURIComponent(accessToken)}`, { headers: { ...appHeaders, 'X-Include-Deviceid': 'true' } });
  if (!res.ok) throw new EAError(`Could not read the EA account (${res.status}): ${res.text.slice(0, 300)}`);
  return parseJson(res.text);
}

export async function entitlements(pid, accessToken) {
  const res = await request(`${GATEWAY_HOST}/proxy/identity/pids/${pid}/entitlements/?status=ACTIVE`, { headers: { ...appHeaders, 'X-Expand-Results': 'true', Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new EAError(`Could not read the account's games (${res.status}): ${res.text.slice(0, 300)}`, 'Make sure this EA account is the one linked to your Madden console account: https://myaccount.ea.com/cp-ui/connectaccounts/index');
  const data = parseJson(res.text);
  return (data.entitlements && data.entitlements.entitlement) || [];
}

export async function personas(pidUri, accessToken) {
  const res = await request(`${GATEWAY_HOST}/proxy/identity${pidUri}/personas?status=ACTIVE&access_token=${encodeURIComponent(accessToken)}`, { headers: { ...appHeaders, 'X-Expand-Results': 'true' } });
  if (!res.ok) throw new EAError(`Could not read the account's gamertags (${res.status}): ${res.text.slice(0, 300)}`);
  const data = parseJson(res.text);
  return (data.personas && data.personas.persona) || [];
}

// From a fresh login code: the account token plus every console profile on
// this EA account that owns this year's Madden.
export async function discoverAccount(code, year) {
  const token = await exchangeCode(code, year);
  const info = await tokenInfo(token.access_token);
  const ents = await entitlements(info.pid_id, token.access_token);
  const online = ents.filter((e) => e.entitlementTag === 'ONLINE_ACCESS');
  // Which Madden years this account can actually use, so the year is a fact
  // rather than a guess. Newest first.
  const ownedYears = Object.keys(YEARS)
    .map(Number)
    .filter((y) => online.some((e) => consoleForEntitlement(y, e.groupName)))
    .sort((a, b) => b - a);
  let owned = online.filter((e) => consoleForEntitlement(year, e.groupName));
  if (!owned.length) {
    if (!ownedYears.length) {
      throw new EAError(`This EA account does not own Madden ${yearConfig(year).year} online access on any console (games found: ${[...new Set(ents.map((e) => e.groupName))].join(', ') || 'none'}).`, 'Sign in with the EA account that is linked to the PlayStation, Xbox or PC profile you play Madden on: https://myaccount.ea.com/cp-ui/connectaccounts/index');
    }
    // They own a different Madden than the one picked; use theirs.
    year = ownedYears[0];
    owned = online.filter((e) => consoleForEntitlement(year, e.groupName));
  }
  const profiles = [];
  for (const e of owned) {
    const console_ = consoleForEntitlement(year, e.groupName);
    const list = await personas(e.pidUri, token.access_token);
    for (const p of list) {
      if (p.namespaceName !== console_.namespace) continue;
      profiles.push({ personaId: p.personaId, displayName: p.displayName || p.name, namespace: p.namespaceName, namespaceLabel: NAMESPACE_LABEL[p.namespaceName] || p.namespaceName, console: console_.key, consoleLabel: console_.label, entitlement: e.groupName, year });
    }
  }
  if (!profiles.length) throw new EAError('Madden is on this EA account, but no matching console gamertag was found.', 'Check the linked accounts at https://myaccount.ea.com/cp-ui/connectaccounts/index');
  // De-duplicate persona+console pairs
  const seen = new Set();
  const unique = profiles.filter((p) => { const k = `${p.personaId}|${p.console}`; if (seen.has(k)) return false; seen.add(k); return true; });
  return { accountToken: token, pid: info.pid_id, profiles: unique, ownedYears, year };
}

// Persona-scoped JWS token for Blaze.
export async function personaToken(accountAccessToken, profile, year) {
  const cfg = yearConfig(year);
  const q = new URLSearchParams({ hide_create: 'true', release_type: 'prod', response_type: 'code', redirect_uri: REDIRECT_URL, client_id: cfg.clientId, machineProfileKey: MACHINE_KEY, authentication_source: String(AUTH_SOURCE), access_token: accountAccessToken, persona_id: String(profile.personaId), persona_namespace: profile.namespace });
  const res = await request(`${ACCOUNTS_HOST}/connect/auth?${q.toString()}`, {
    headers: { 'Upgrade-Insecure-Requests': '1', 'User-Agent': WEBVIEW_USER_AGENT, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'X-Requested-With': 'com.ea.gp.madden19companionapp', 'Accept-Language': 'en-US,en;q=0.9' },
  });
  const location = res.headers.location;
  if (!location) throw new EAError(`EA did not hand back a profile code (${res.status}): ${res.text.slice(0, 200)}`);
  const code = new URLSearchParams(location.slice(location.indexOf('?') + 1)).get('code');
  if (!code) throw new EAError(`EA profile redirect had no code: ${location}`);
  const tokenRes = await request(`${ACCOUNTS_HOST}/connect/token`, {
    method: 'POST',
    headers: { ...appHeaders, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: form({ authentication_source: AUTH_SOURCE, code, grant_type: 'authorization_code', token_format: 'JWS', release_type: 'prod', client_secret: cfg.clientSecret, redirect_uri: REDIRECT_URL, client_id: cfg.clientId }),
  });
  if (!tokenRes.ok) throw new EAError(`Could not create the game token (${tokenRes.status}): ${tokenRes.text.slice(0, 300)}`);
  const t = parseJson(tokenRes.text);
  return { accessToken: t.access_token, refreshToken: t.refresh_token, expiresAt: Date.now() + (Number(t.expires_in) || 3600) * 1000 };
}

export async function refreshPersonaToken(token, year) {
  const cfg = yearConfig(year);
  const res = await request(`${ACCOUNTS_HOST}/connect/token`, {
    method: 'POST',
    headers: { ...appHeaders, 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: form({ grant_type: 'refresh_token', client_id: cfg.clientId, client_secret: cfg.clientSecret, release_type: 'prod', refresh_token: token.refreshToken, authentication_source: AUTH_SOURCE, token_format: 'JWS' }),
  });
  const t = res.ok ? parseJson(res.text) : null;
  if (!t || !t.access_token) throw new EAError(`EA would not refresh the sign-in (${res.status}): ${res.text.slice(0, 300)}`, 'Sign in with EA again.');
  return { accessToken: t.access_token, refreshToken: t.refresh_token || token.refreshToken, expiresAt: Date.now() + (Number(t.expires_in) || 3600) * 1000 };
}

export function consoleLabel(key) {
  return CONSOLES[key] ? CONSOLES[key].label : key;
}
