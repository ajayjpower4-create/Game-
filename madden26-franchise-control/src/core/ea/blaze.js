// Talks to the Madden game server (Blaze) the way the companion app does:
// log in with the persona token, then run commands and pull the league export
// data straight from EA.

import { request, parseJson } from './http.js';
import { messageAuth } from './signing.js';
import { WAL_HOST, APP_USER_AGENT, MACHINE_KEY, blazeServiceId, blazeServiceCandidates, blazeProductName, yearConfig, COMMANDS, EXPORT_KINDS } from './constants.js';
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
      'X-BLAZE-ID': this.serviceId || blazeServiceId(this.year, this.console),
      'X-BLAZE-VOID-RESP': 'XML',
      'X-Application-Key': 'MADDEN-MCA',
      'Content-Type': 'application/json',
      'User-Agent': APP_USER_AGENT,
    };
  }

  // One attempt against one named cluster.
  async loginOnce(serviceId) {
    this.serviceId = serviceId;
    const res = await request(`${WAL_HOST}/wal/authentication/login`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ accessToken: this.token.accessToken, productName: blazeProductName(this.year, this.console) }),
    });
    let data = null;
    try { data = parseJson(res.text); } catch { data = null; }
    const info = data && data.userLoginInfo;
    if (info && info.sessionKey) {
      this.session = { sessionKey: info.sessionKey, blazeId: info.personaDetails ? info.personaDetails.personaId : info.blazeId, requestId: 1, displayName: info.personaDetails ? info.personaDetails.displayName : null };
      this.log(`game server login ok on ${serviceId}`);
      return this.session;
    }
    // EA answers unreachable backends with a 5xx and an XML error body.
    const named = /Failed to make connection to ([\w.-]+)/i.exec(res.text || '');
    return { failed: true, status: res.status, serviceId, wanted: named ? named[1] : null, body: (res.text || '').slice(0, 400) };
  }

  async login() {
    const candidates = blazeServiceCandidates(this.year, this.console);
    const failures = [];
    for (const serviceId of candidates) {
      // A 503 is often EA being briefly busy, so give each cluster a second go.
      for (let attempt = 0; attempt < 2; attempt++) {
        let result;
        try {
          result = await this.loginOnce(serviceId);
        } catch (e) {
          result = { failed: true, status: 0, serviceId, wanted: null, body: e.message };
        }
        if (!result.failed) return this.session;
        const transient = result.status === 503 || result.status === 0 || result.status === 429;
        if (transient && attempt === 0) {
          this.log(`game server ${serviceId} answered ${result.status}; retrying once`);
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        failures.push(result);
        this.log(`game server ${serviceId} unavailable (${result.status}${result.wanted ? `, wanted ${result.wanted}` : ''})`);
        break;
      }
    }
    this.serviceId = null;
    const y = yearConfig(this.year).year;
    const allDown = failures.every((f) => f.status === 503 || f.status === 0);
    const wanted = failures.map((f) => f.wanted).find(Boolean);
    const detail = failures.map((f) => `${f.serviceId} → ${f.status || 'no reply'}`).join(', ');
    if (allDown) {
      throw new EAError(
        `EA's Madden ${y} game servers are not accepting connections right now (tried ${detail}${wanted ? `; EA reported ${wanted} unreachable` : ''}).`,
        `Your EA sign-in worked, so this is on EA's side, not yours. EA takes these servers down for maintenance, and it also retires them for older Madden titles once a new one ships. If you play Madden ${y + 1}, switch the year above and sign in again. On PC you can skip this entirely: open your franchise file instead, which also unlocks the injury tool and real snap counts.`
      );
    }
    throw new EAError(
      `Could not log in to the Madden ${y} game server for ${this.console} (tried ${detail}).`,
      `Your EA sign-in worked, so the account is fine. This profile may not play Madden ${y} on ${this.console}. Pick a different profile or year, or use your franchise file.`
    );
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
