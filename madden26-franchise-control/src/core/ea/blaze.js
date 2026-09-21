// Talks to the Madden game server (Blaze) the way the companion app does:
// log in with the persona token, then run commands and pull the league export
// data straight from EA.

import { request, parseJson } from './http.js';
import { messageAuth } from './signing.js';
import { WAL_HOST, APP_USER_AGENT, MACHINE_KEY, blazeServiceId, blazeProductName, yearConfig, COMMANDS, EXPORT_KINDS } from './constants.js';
import { EAError } from './auth.js';

const HIGH_LOAD = 1073807360;

export class BlazeError extends EAError {
  constructor(payload) {
    const e = payload && payload.error ? payload.error : {};
    super(`EA game server error ${e.errorname || ''} (${e.errorcode || '?'}): ${(e.errordf && e.errordf.errorString) || (e.errortdf && e.errortdf.errorString) || JSON.stringify(payload).slice(0, 200)}`);
    this.name = 'BlazeError';
    this.payload = payload;
  }
}

export class BlazeClient {
  constructor({ year, console: consoleKey, token, session = null, log = () => {} }) {
    this.year = year;
    this.console = consoleKey;
    this.token = token; // { accessToken, refreshToken, expiresAt }
    this.session = session; // { sessionKey, blazeId, requestId }
    this.log = log;
  }

  headers() {
    return {
      'Accept-Charset': 'UTF-8',
      Accept: 'application/json',
      'X-BLAZE-ID': blazeServiceId(this.year, this.console),
      'X-BLAZE-VOID-RESP': 'XML',
      'X-Application-Key': 'MADDEN-MCA',
      'Content-Type': 'application/json',
      'User-Agent': APP_USER_AGENT,
    };
  }

  async login() {
    const res = await request(`${WAL_HOST}/wal/authentication/login`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ accessToken: this.token.accessToken, productName: blazeProductName(this.year, this.console) }),
    });
    let data;
    try { data = parseJson(res.text); } catch { data = null; }
    const info = data && data.userLoginInfo;
    if (!info || !info.sessionKey) throw new EAError(`Could not log in to the Madden ${yearConfig(this.year).year} game server for ${this.console} (${res.status}): ${res.text.slice(0, 300)}`, 'EA may be down, or this profile may not play Madden on this console. Try the other console profile if one is listed.');
    this.session = { sessionKey: info.sessionKey, blazeId: info.personaDetails ? info.personaDetails.personaId : info.blazeId, requestId: 1, displayName: info.personaDetails ? info.personaDetails.displayName : null };
    this.log(`Blaze login ok for ${this.console}`);
    return this.session;
  }

  async ensureSession() {
    if (!this.session) await this.login();
    return this.session;
  }

  async process(command, payload = {}) {
    await this.ensureSession();
    const cfg = yearConfig(this.year);
    const auth = messageAuth(this.session.blazeId, this.session.requestId);
    this.session.requestId += 1;
    const body = {
      apiVersion: 2,
      clientDevice: 3,
      requestInfo: JSON.stringify({
        commandName: command.commandName,
        componentId: command.componentId,
        commandId: command.commandId,
        componentName: cfg.componentName,
        messageAuthData: auth,
        messageExpirationTime: Math.floor(Date.now() / 1000),
        deviceId: MACHINE_KEY,
        ipAddress: '127.0.0.1',
        requestPayload: JSON.stringify(payload),
      }),
    };
    const res = await request(`${WAL_HOST}/wal/mca/Process/${this.session.sessionKey}`, { method: 'POST', headers: this.headers(), body: JSON.stringify(body) });
    let data;
    try { data = parseJson(res.text); } catch { throw new EAError(`Unreadable reply from the game server for ${command.commandName} (${res.status}): ${res.text.slice(0, 200)}`); }
    if (data.error) throw new BlazeError(data);
    return data;
  }

  // Runs a command; if the session died, logs in again once and retries.
  async processWithRelogin(command, payload) {
    try {
      return await this.process(command, payload);
    } catch (e) {
      if (e instanceof BlazeError) {
        this.log(`Session expired (${e.message}); logging in again`);
        this.session = null;
        await this.login();
        return this.process(command, payload);
      }
      throw e;
    }
  }

  async getMyLeagues() {
    const data = await this.processWithRelogin(COMMANDS.getMyLeagues, {});
    const v = data.responseInfo && data.responseInfo.value;
    return (v && v.leagues) || [];
  }

  async getLeagueHub(leagueId) {
    const data = await this.processWithRelogin(COMMANDS.getLeagueHub, { leagueId: Number(leagueId) });
    return data.responseInfo && data.responseInfo.value;
  }

  async exportData(kind, payload, { retries = 5, baseDelayMs = 1000 } = {}) {
    await this.ensureSession();
    const endpoint = EXPORT_KINDS[kind];
    if (!endpoint) throw new Error(`Unknown export kind ${kind}`);
    for (let attempt = 0; attempt < retries; attempt++) {
      const res = await request(`${WAL_HOST}/wal/mca/${endpoint}/${this.session.sessionKey}`, { method: 'POST', headers: this.headers(), body: JSON.stringify(payload), timeoutMs: 90000 });
      let data;
      try { data = parseJson(res.text); } catch { throw new EAError(`Unreadable ${kind} data from EA (${res.status}): ${res.text.slice(0, 200)}`); }
      if (data && data.error) {
        const name = data.error.errorname;
        const code = data.error.errorcode;
        if ((name === 'ERR_TIMEOUT' || code === HIGH_LOAD) && attempt < retries - 1) {
          await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** attempt));
          continue;
        }
        if (attempt === 0 && /ERR_AUTHENTICATION|ERR_SESSION|NOT_LOGGED|AUTHORIZATION/i.test(name || '')) {
          this.session = null;
          await this.login();
          continue;
        }
        throw new BlazeError(data);
      }
      return data;
    }
    throw new EAError(`EA kept timing out on ${kind}. Try again in a minute.`);
  }

  teams(leagueId) { return this.exportData('leagueteams', { leagueId: Number(leagueId) }); }
  standings(leagueId) { return this.exportData('standings', { leagueId: Number(leagueId) }); }
  weekly(kind, leagueId, stageIndex, weekIndex) { return this.exportData(kind, { leagueId: Number(leagueId), stageIndex, weekIndex }); }
  roster(leagueId, teamId, listIndex) { return this.exportData('roster', { leagueId: Number(leagueId), listIndex, returnFreeAgents: false, teamId: Number(teamId) }); }
  freeAgents(leagueId) { return this.exportData('roster', { leagueId: Number(leagueId), listIndex: -1, returnFreeAgents: true, teamId: 0 }); }
}
