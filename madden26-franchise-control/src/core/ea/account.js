// Keeps the EA sign-in for this PC: which profile is linked, the sign-in
// (sealed with the OS keychain when the desktop app provides one), the
// game-server session, the list of franchises on the account, and any league
// download in progress.

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { loginUrl, DEFAULT_YEAR, YEARS, CONSOLES } from './constants.js';
import { codeFromRedirect, discoverAccount, personaToken, refreshPersonaToken, EAError } from './auth.js';
import { BlazeClient } from './blaze.js';
import { importLeague, leagueKeyFor } from './importer.js';

const FILE = 'ea-account.json';

export class EAAccountService {
  constructor({ store, secretBox = null, log = () => {}, onImported = () => {} }) {
    this.store = store;
    this.secretBox = secretBox && secretBox.available ? secretBox : null;
    this.log = log;
    this.onImported = onImported;
    this.file = path.join(store.dataDir, FILE);
    this.state = this.load();
    this.pending = new Map(); // handle -> { accountToken, profiles, year, at }
    this.tasks = new Map();
    this.queue = Promise.resolve();
    this.diag = [];
    this.client = null;
  }

  note(line) {
    const entry = `${new Date().toISOString()} ${line}`;
    this.diag.push(entry);
    if (this.diag.length > 200) this.diag.shift();
    this.log(`[ea] ${line}`);
  }

  load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (raw.tokenSealed) {
        if (!this.secretBox) return null; // sealed on another machine / without a keychain
        raw.token = JSON.parse(this.secretBox.decrypt(raw.tokenSealed));
      }
      delete raw.tokenSealed;
      return raw && raw.token && raw.profile ? raw : null;
    } catch {
      return null;
    }
  }

  save() {
    if (!this.state) {
      try { fs.unlinkSync(this.file); } catch { /* nothing to remove */ }
      return;
    }
    const out = { ...this.state };
    if (this.secretBox && out.token) {
      out.tokenSealed = this.secretBox.encrypt(JSON.stringify(out.token));
      delete out.token;
      out.encrypted = true;
    } else {
      out.encrypted = false;
    }
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(out, null, 1));
  }

  get signedIn() {
    return Boolean(this.state && this.state.token && this.state.profile);
  }

  status() {
    const s = this.state;
    return {
      signedIn: this.signedIn,
      year: s ? s.year : DEFAULT_YEAR,
      years: Object.keys(YEARS).map(Number),
      profile: s ? s.profile : null,
      leagues: s && s.leagues ? s.leagues : [],
      leaguesAt: s ? s.leaguesAt : null,
      encrypted: Boolean(this.secretBox),
      imports: [...this.tasks.values()].map(summarizeTask).sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || '')).slice(0, 10),
      importedLeagues: this.store.listLeagues().filter((l) => l.via === 'ea').map((l) => ({ leagueKey: l.leagueKey, leagueId: l.companionLeagueId, name: l.name, lastImportAt: l.lastImportAt, lastImportScope: l.lastImportScope, platform: l.platform, seasonInfo: l.seasonInfo || null })),
    };
  }

  loginUrl(year = DEFAULT_YEAR) {
    return loginUrl(year);
  }

  // Step 1: turn the address EA redirected to into the Madden profiles on the account.
  async beginWithCode(input, year = DEFAULT_YEAR) {
    const code = codeFromRedirect(input);
    if (!code) throw new EAError('That does not look like the EA sign-in address. It should start with http://127.0.0.1/success?code=', 'Copy the whole address from the browser bar after EA sends you to the page that fails to load.');
    this.note(`login code received for Madden ${year}`);
    const found = await discoverAccount(code, Number(year));
    const handle = randomUUID();
    // discoverAccount falls back to a year the account actually owns.
    this.pending.set(handle, { ...found, at: Date.now() });
    for (const [k, v] of this.pending) if (Date.now() - v.at > 15 * 60 * 1000) this.pending.delete(k);
    this.note(`account owns Madden ${found.ownedYears.join(', ')}`);
    if (found.year !== Number(year)) this.note(`Madden ${year} is not on this account; using Madden ${found.year}`);
    this.note(`${found.profiles.length} Madden ${found.year} profile(s): ${found.profiles.map((p) => `${p.displayName}/${p.console}`).join(', ')}`);
    return { handle, profiles: found.profiles, year: found.year, ownedYears: found.ownedYears, requestedYear: Number(year) };
  }

  // Step 2: pick the console profile, log in to the game server, list franchises.
  async selectProfile(handle, personaId, consoleOverride = null) {
    const p = this.pending.get(handle);
    if (!p) throw new EAError('This sign-in attempt expired. Start again.');
    let profile = p.profiles.find((x) => String(x.personaId) === String(personaId));
    if (!profile) throw new EAError('Unknown profile for this sign-in.');
    if (consoleOverride && CONSOLES[consoleOverride]) profile = { ...profile, console: consoleOverride, consoleLabel: CONSOLES[consoleOverride].label, namespace: CONSOLES[consoleOverride].namespace };
    const token = await personaToken(p.accountToken.access_token, profile, p.year);
    this.note(`game sign-in issued for ${profile.displayName} on ${profile.console}`);
    const client = new BlazeClient({ year: p.year, console: profile.console, token, log: (m) => this.note(m) });
    await client.login();
    const leagues = await client.getMyLeagues();
    this.state = { version: 1, year: p.year, profile, token, session: client.session, leagues: leagues.map(publicLeague), leaguesAt: new Date().toISOString(), signedInAt: new Date().toISOString() };
    this.client = client;
    this.pending.delete(handle);
    this.save();
    this.note(`signed in; ${leagues.length} franchise(s) on the account`);
    return { profile, leagues: this.state.leagues };
  }

  async getClient() {
    if (!this.signedIn) throw new EAError('Not signed in to EA.', 'Use "Sign in with EA" on the Connect page.');
    const s = this.state;
    if (!s.token.expiresAt || Date.now() > s.token.expiresAt - 5 * 60 * 1000) {
      this.note('renewing the EA sign-in');
      try {
        s.token = await refreshPersonaToken(s.token, s.year);
      } catch (e) {
        this.note(`renewal failed: ${e.message}`);
        this.state = null;
        this.client = null;
        this.save();
        throw e;
      }
      this.client = null;
      this.save();
    }
    if (!this.client) this.client = new BlazeClient({ year: s.year, console: s.profile.console, token: s.token, session: s.session || null, log: (m) => this.note(m) });
    return this.client;
  }

  async refreshLeagues() {
    const client = await this.getClient();
    const leagues = await client.getMyLeagues();
    this.state.leagues = leagues.map(publicLeague);
    this.state.leaguesAt = new Date().toISOString();
    this.state.session = client.session;
    this.save();
    return this.state.leagues;
  }

  startImport(leagueId, scope = 'all') {
    if (!this.signedIn) throw new EAError('Not signed in to EA.');
    const league = (this.state.leagues || []).find((l) => String(l.leagueId) === String(leagueId));
    if (!league) throw new EAError(`League ${leagueId} is not on this EA account. Refresh the list.`);
    for (const t of this.tasks.values()) if (t.leagueId === league.leagueId && (t.status === 'queued' || t.status === 'running')) return summarizeTask(t);
    const task = { id: randomUUID(), leagueId: league.leagueId, leagueName: league.leagueName, scope, status: 'queued', progress: { step: 'waiting', done: 0, total: 0, errors: [] }, startedAt: new Date().toISOString(), finishedAt: null, error: null, result: null, leagueKey: leagueKeyFor(this.state.profile.console, league.leagueId) };
    this.tasks.set(task.id, task);
    this.queue = this.queue.then(() => this.runImport(task)).catch(() => {});
    return summarizeTask(task);
  }

  async runImport(task) {
    task.status = 'running';
    this.note(`download started: ${task.leagueName} (${task.scope})`);
    try {
      const client = await this.getClient();
      const league = this.state.leagues.find((l) => l.leagueId === task.leagueId);
      const result = await importLeague({ client, store: this.store, league, scope: task.scope, onProgress: (p) => { task.progress = p; }, log: (m) => this.note(m) });
      this.state.session = client.session;
      this.save();
      task.result = result;
      task.status = 'done';
      this.note(`download finished: ${task.leagueName}, ${result.weeks} week(s), ${result.teams} rosters, ${result.errors.length} error(s)`);
      this.onImported(task.leagueKey);
    } catch (e) {
      task.status = 'error';
      task.error = e.message + (e.help ? ` — ${e.help}` : '');
      this.note(`download failed: ${task.leagueName}: ${e.message}`);
    } finally {
      task.finishedAt = new Date().toISOString();
    }
  }

  getTask(id) {
    const t = this.tasks.get(id);
    return t ? summarizeTask(t) : null;
  }

  signOut() {
    this.state = null;
    this.client = null;
    this.pending.clear();
    this.save();
    this.note('signed out');
  }

  diagnostics() {
    return this.diag.slice(-80);
  }
}

function summarizeTask(t) {
  return { id: t.id, leagueId: t.leagueId, leagueName: t.leagueName, leagueKey: t.leagueKey, scope: t.scope, status: t.status, progress: t.progress, startedAt: t.startedAt, finishedAt: t.finishedAt, error: t.error, result: t.result };
}

export function publicLeague(l) {
  return {
    leagueId: Number(l.leagueId),
    leagueName: l.leagueName,
    calendarYear: l.calendarYear,
    seasonText: l.seasonText,
    numMembers: l.numMembers,
    userTeamName: l.userTeamName,
    userFullName: l.userFullName,
    commish: l.commish ? l.commish.persona : null,
    lastAdvancedTimeSecs: l.lastAdvancedTimeSecs,
  };
}
