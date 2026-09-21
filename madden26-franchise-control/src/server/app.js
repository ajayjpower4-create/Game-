// The local server behind the desktop app: serves the UI, answers the API,
// and receives Madden Companion App exports (the EA cloud path).

import express from 'express';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { Store } from '../core/store.js';
import { FranchiseService } from '../core/franchise/service.js';
import { StatsEngine } from '../core/stats/engine.js';
import { seasonTotals } from '../core/stats/aggregate.js';
import { buildLeagueFromCompanion } from '../core/companion/league.js';
import { classifyPath, extractList } from '../core/companion/normalize.js';
import { INJURY_TYPES, BODY_PARTS, injuryTypesByPart } from '../core/franchise/injury-catalog.js';
import { planInjury } from '../core/franchise/injuries.js';
import { addEvent, removeEvent, EVENT_TYPES } from '../core/tracker/tracker.js';
import { BUNDLED_SCHEMA_DIR } from '../core/franchise/reader.js';
import { findFranchiseFiles } from '../core/franchise/locate.js';
import { positionRank, group as positionGroup, GROUP_LABEL, GROUP_ORDER } from '../core/positions.js';
import { hashString } from '../core/rng.js';
import { EAAccountService } from '../core/ea/account.js';
import { DEFAULT_YEAR } from '../core/ea/constants.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const UI_DIR = path.resolve(HERE, '../../ui');

// The companion app sometimes gzips the body without saying so.
function rawBodyParser(req, res, next) {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    let buf = Buffer.concat(chunks);
    try {
      if (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
      else if ((req.headers['content-encoding'] || '').includes('gzip')) buf = zlib.gunzipSync(buf);
      else if ((req.headers['content-encoding'] || '').includes('deflate')) buf = zlib.inflateSync(buf);
    } catch (e) {
      req.bodyError = `could not decompress body: ${e.message}`;
    }
    req.rawBody = buf;
    try {
      req.body = buf.length ? JSON.parse(buf.toString('utf8')) : {};
    } catch (e) {
      req.body = null;
      req.bodyError = req.bodyError || `body is not JSON: ${e.message}`;
    }
    next();
  });
  req.on('error', next);
}

export function createApp({ store, franchise, engine, dataDir, secretBox = null, log = () => {} } = {}) {
  store ||= new Store(dataDir);
  franchise ||= new FranchiseService({ schemaDirectory: store.getSettings().schemaDirectory || BUNDLED_SCHEMA_DIR });
  engine ||= new StatsEngine();
  const app = express();
  app.disable('x-powered-by');
  app.locals.store = store;
  app.locals.franchise = franchise;
  app.locals.engine = engine;

  const companionLeagues = new Map(); // leagueKey -> built league (cached)
  const leagueKeyFor = (platform, leagueId) => `companion-${platform}-${leagueId}`;
  const ea = new EAAccountService({ store, secretBox, log, onImported: (leagueKey) => { companionLeagues.delete(leagueKey); engine.clear(); } });
  app.locals.ea = ea;

  function getLeague(leagueKey) {
    if (franchise.isOpen && franchise.league.leagueId === leagueKey) return franchise.league;
    if (leagueKey === 'file' && franchise.isOpen) return franchise.league;
    if (companionLeagues.has(leagueKey)) return companionLeagues.get(leagueKey);
    const meta = store.getMeta(leagueKey);
    if (!meta) return null;
    const raw = store.getCompanionRaw(leagueKey);
    const league = buildLeagueFromCompanion(raw, { leagueKey, name: meta.name || `${meta.platform || ''} league ${meta.companionLeagueId || ''}`.trim() });
    league.loadedAt = meta.updatedAt || '';
    companionLeagues.set(leagueKey, league);
    return league;
  }

  const api = express.Router();
  api.use(express.json({ limit: '2mb' }));

  // ---- status / leagues
  api.get('/status', (req, res) => {
    const leagues = store.listLeagues().filter((l) => l.source !== 'franchise').map((l) => ({ leagueKey: l.leagueKey, name: l.name || `${l.platform || ''} league ${l.companionLeagueId || ''}`.trim(), source: 'companion', via: l.via || 'companion-app', lastExportAt: l.lastImportAt || l.lastExportAt || null, platform: l.platform || null }));
    if (franchise.isOpen) leagues.unshift({ leagueKey: franchise.league.leagueId, name: franchise.league.name, source: 'franchise', filePath: franchise.filePath, openedAt: franchise.openedAt, schema: franchise.league.schema, gameYear: franchise.league.gameYear });
    res.json({ ok: true, leagues, franchiseOpen: franchise.isOpen, filePath: franchise.filePath, dataDir: store.dataDir, settings: store.getSettings(), version: process.env.M26FC_VERSION || 'dev', ea: { signedIn: ea.signedIn, profile: ea.signedIn ? ea.state.profile : null } });
  });

  // Every franchise save already on this PC, found automatically.
  api.get('/franchise/detect', (req, res) => {
    const settings = store.getSettings();
    const extraDirs = [...new Set((settings.recentFiles || []).map((f) => path.dirname(f)))];
    try {
      const { files, searched } = findFranchiseFiles({ extraDirs });
      res.json({ ok: true, files, searched });
    } catch (e) {
      res.json({ ok: true, files: [], searched: [], error: e.message });
    }
  });

  api.post('/franchise/open', async (req, res) => {
    const { filePath } = req.body || {};
    if (!filePath) return res.status(400).json({ ok: false, error: 'filePath is required' });
    try {
      const league = await franchise.open(filePath);
      engine.clear();
      const settings = store.getSettings();
      settings.recentFiles = [filePath, ...(settings.recentFiles || []).filter((f) => f !== filePath)].slice(0, 8);
      store.saveSettings(settings);
      store.setMeta(league.leagueId, { name: league.name, source: 'franchise', filePath });
      res.json({ ok: true, leagueKey: league.leagueId, summary: summarizeLeague(league) });
    } catch (e) {
      log('open failed', e);
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  api.post('/franchise/refresh', async (req, res) => {
    try {
      const league = await franchise.refresh();
      engine.clear();
      res.json({ ok: true, leagueKey: league.leagueId, summary: summarizeLeague(league) });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  api.post('/franchise/close', (req, res) => {
    franchise.close();
    engine.clear();
    res.json({ ok: true });
  });

  api.get('/leagues/:leagueKey', (req, res) => {
    const league = getLeague(req.params.leagueKey);
    if (!league) return res.status(404).json({ ok: false, error: 'league not found' });
    res.json({ ok: true, league: summarizeLeague(league) });
  });

  api.get('/leagues/:leagueKey/teams/:teamId/roster', (req, res) => {
    const league = getLeague(req.params.leagueKey);
    if (!league) return res.status(404).json({ ok: false, error: 'league not found' });
    const players = Object.values(league.players)
      .filter((p) => p.teamId === req.params.teamId)
      .map(publicPlayer)
      .sort((a, b) => positionRank(a.position) - positionRank(b.position) || b.overall - a.overall || a.fullName.localeCompare(b.fullName));
    res.json({ ok: true, teamId: req.params.teamId, team: league.teams[req.params.teamId] || null, players });
  });

  api.get('/leagues/:leagueKey/schedule', (req, res) => {
    const league = getLeague(req.params.leagueKey);
    if (!league) return res.status(404).json({ ok: false, error: 'league not found' });
    const games = Object.values(league.games).sort(gameSort);
    res.json({ ok: true, games: games.map((g) => publicGame(g, league)) });
  });

  // ---- stats
  api.get('/leagues/:leagueKey/games/:gameId/stats', (req, res) => {
    const league = getLeague(req.params.leagueKey);
    if (!league) return res.status(404).json({ ok: false, error: 'league not found' });
    if (!league.games[req.params.gameId]) return res.status(404).json({ ok: false, error: 'game not found' });
    const tracker = store.getTracker(req.params.leagueKey);
    const result = engine.game(league, req.params.gameId, tracker);
    res.json({ ok: true, result: { ...result, game: publicGame(result.game, league), injuries: (league.gameInjuries[req.params.gameId] || []).map((i) => ({ ...i, player: publicPlayer(league.players[i.playerId]) })) } });
  });

  api.get('/leagues/:leagueKey/season', (req, res) => {
    const league = getLeague(req.params.leagueKey);
    if (!league) return res.status(404).json({ ok: false, error: 'league not found' });
    const tracker = store.getTracker(req.params.leagueKey);
    const stage = req.query.stage || 'reg';
    const teamId = req.query.teamId || null;
    const totals = seasonTotals(league, engine, tracker, { stage, teamId });
    res.json({ ok: true, totals });
  });

  // ---- tracker
  api.get('/leagues/:leagueKey/tracker', (req, res) => {
    const tracker = store.getTracker(req.params.leagueKey);
    const gameId = req.query.gameId;
    res.json({ ok: true, events: gameId ? tracker.events.filter((e) => e.gameId === gameId) : tracker.events, eventTypes: EVENT_TYPES });
  });
  api.post('/leagues/:leagueKey/tracker', (req, res) => {
    try {
      const tracker = store.getTracker(req.params.leagueKey);
      const event = addEvent(tracker, req.body);
      store.saveTracker(req.params.leagueKey, tracker);
      engine.clear();
      res.json({ ok: true, event });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });
  api.delete('/leagues/:leagueKey/tracker/:eventId', (req, res) => {
    const tracker = store.getTracker(req.params.leagueKey);
    const removed = removeEvent(tracker, req.params.eventId);
    store.saveTracker(req.params.leagueKey, tracker);
    engine.clear();
    res.json({ ok: true, removed });
  });

  // ---- injuries
  api.get('/injuries/catalog', (req, res) => {
    res.json({ ok: true, bodyParts: BODY_PARTS, types: INJURY_TYPES, byPart: injuryTypesByPart() });
  });

  api.post('/leagues/:leagueKey/injuries/plan', (req, res) => {
    const league = getLeague(req.params.leagueKey);
    if (!league) return res.status(404).json({ ok: false, error: 'league not found' });
    const { playerId, gameId, injuryKey, weeks, side, placeOnIR, salt } = req.body || {};
    const player = league.players[playerId];
    const game = league.games[gameId];
    if (!player || !game) return res.status(400).json({ ok: false, error: 'player and game are required' });
    try {
      const plan = planInjury({ leagueId: league.leagueId, gameId, player, injuryKey, weeks, side, week: game.week, stage: game.weekType === 'PreSeason' ? 'PreSeason' : 'NFLSeason', year: league.season.year, placeOnIR, salt });
      res.json({ ok: true, plan, game: publicGame(game, league), canApply: league.source === 'franchise' && franchise.isOpen, gameStatus: game.status });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  api.post('/leagues/:leagueKey/injuries/apply', async (req, res) => {
    const league = getLeague(req.params.leagueKey);
    if (!league) return res.status(404).json({ ok: false, error: 'league not found' });
    if (league.source !== 'franchise' || !franchise.isOpen) return res.status(400).json({ ok: false, error: 'Injuries can only be written into an open PC franchise file. Console franchises live on EA servers and cannot be edited.' });
    const { playerId, gameId, injuryKey, weeks, side, placeOnIR, salt, applyMode } = req.body || {};
    try {
      const result = await franchise.applyInjury({ playerId, gameId, injuryKey, weeks, side, placeOnIR, salt });
      engine.clear();
      const logData = store.getInjuryLog(req.params.leagueKey);
      const entry = { id: `${Date.now().toString(36)}-${hashString(playerId + gameId).toString(36)}`, at: new Date().toISOString(), gameId, game: publicGame(league.games[gameId], league), plan: result.plan, written: result.written, backupPath: result.backupPath, applyMode: applyMode || 'now', status: 'applied' };
      logData.entries.unshift(entry);
      store.saveInjuryLog(req.params.leagueKey, logData);
      res.json({ ok: true, ...result, entry });
    } catch (e) {
      log('apply failed', e);
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  api.post('/leagues/:leagueKey/injuries/schedule', (req, res) => {
    // For games not yet played: remember the injury so it can be applied once
    // the franchise reaches that week.
    const league = getLeague(req.params.leagueKey);
    if (!league) return res.status(404).json({ ok: false, error: 'league not found' });
    const { playerId, gameId, injuryKey, weeks, side, placeOnIR, salt } = req.body || {};
    const player = league.players[playerId];
    const game = league.games[gameId];
    if (!player || !game) return res.status(400).json({ ok: false, error: 'player and game are required' });
    try {
      const plan = planInjury({ leagueId: league.leagueId, gameId, player, injuryKey, weeks, side, week: game.week, stage: game.weekType === 'PreSeason' ? 'PreSeason' : 'NFLSeason', year: league.season.year, placeOnIR, salt });
      const logData = store.getInjuryLog(req.params.leagueKey);
      const entry = { id: `${Date.now().toString(36)}-${hashString(playerId + gameId).toString(36)}`, at: new Date().toISOString(), gameId, game: publicGame(game, league), plan, request: { playerId, gameId, injuryKey, weeks, side, placeOnIR, salt }, status: 'scheduled' };
      logData.entries.unshift(entry);
      store.saveInjuryLog(req.params.leagueKey, logData);
      res.json({ ok: true, entry });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  api.get('/leagues/:leagueKey/injuries', (req, res) => {
    const league = getLeague(req.params.leagueKey);
    if (!league) return res.status(404).json({ ok: false, error: 'league not found' });
    const logData = store.getInjuryLog(req.params.leagueKey);
    const current = Object.values(league.players).filter((p) => p.injury && p.injury.status === 'Injured').map(publicPlayer).sort((a, b) => (b.injury.weeksTotal || 0) - (a.injury.weeksTotal || 0));
    res.json({ ok: true, log: logData.entries, current });
  });

  api.delete('/leagues/:leagueKey/injuries/log/:id', (req, res) => {
    const logData = store.getInjuryLog(req.params.leagueKey);
    logData.entries = logData.entries.filter((e) => e.id !== req.params.id);
    store.saveInjuryLog(req.params.leagueKey, logData);
    res.json({ ok: true });
  });

  api.post('/leagues/:leagueKey/injuries/heal', async (req, res) => {
    const league = getLeague(req.params.leagueKey);
    if (!league || league.source !== 'franchise' || !franchise.isOpen) return res.status(400).json({ ok: false, error: 'Healing needs an open PC franchise file.' });
    try {
      const result = await franchise.heal(req.body.playerId);
      engine.clear();
      res.json({ ok: true, ...result });
    } catch (e) {
      res.status(400).json({ ok: false, error: e.message });
    }
  });

  api.post('/settings', (req, res) => {
    const settings = { ...store.getSettings(), ...(req.body || {}) };
    store.saveSettings(settings);
    if (settings.schemaDirectory) franchise.schemaDirectory = settings.schemaDirectory;
    res.json({ ok: true, settings });
  });

  // ---- EA account sign-in: the companion app's own login and export flow, run from here.
  const eaError = (res, e) => { log('ea error', e && e.message); res.status(400).json({ ok: false, error: e.message, help: e.help || null }); };
  api.get('/ea/status', (req, res) => res.json({ ok: true, ...ea.status() }));
  api.get('/ea/login-url', (req, res) => {
    try { res.json({ ok: true, url: ea.loginUrl(Number(req.query.year) || DEFAULT_YEAR) }); } catch (e) { eaError(res, e); }
  });
  api.post('/ea/code', async (req, res) => {
    try { res.json({ ok: true, ...(await ea.beginWithCode(req.body.code || req.body.url, Number(req.body.year) || DEFAULT_YEAR)) }); } catch (e) { eaError(res, e); }
  });
  api.post('/ea/profile', async (req, res) => {
    try { res.json({ ok: true, ...(await ea.selectProfile(req.body.handle, req.body.personaId, req.body.console || null)) }); } catch (e) { eaError(res, e); }
  });
  api.post('/ea/leagues/refresh', async (req, res) => {
    try { res.json({ ok: true, leagues: await ea.refreshLeagues() }); } catch (e) { eaError(res, e); }
  });
  api.post('/ea/leagues/:leagueId/import', (req, res) => {
    try { res.json({ ok: true, task: ea.startImport(req.params.leagueId, req.body.scope || 'all') }); } catch (e) { eaError(res, e); }
  });
  api.get('/ea/imports/:taskId', (req, res) => {
    const task = ea.getTask(req.params.taskId);
    if (!task) return res.status(404).json({ ok: false, error: 'task not found' });
    res.json({ ok: true, task });
  });
  api.post('/ea/signout', (req, res) => { ea.signOut(); res.json({ ok: true }); });
  api.get('/ea/diagnostics', (req, res) => res.json({ ok: true, lines: ea.diagnostics() }));

  app.use('/api', api);

  // ---- Madden Companion App export receiver. The app POSTs to
  // {your url}/{platform}/{leagueId}/... ; any base path works.
  app.post(/^\/(?:companion\/)?([^/]+)\/([^/]+)\/(.+)$/, rawBodyParser, (req, res) => {
    const segments = [req.params[0], req.params[1], ...req.params[2].split('/')];
    const info = classifyPath(segments);
    if (!info) return res.status(404).json({ success: false, message: 'not a companion export path' });
    if (req.bodyError || !req.body) return res.status(400).json({ success: false, message: req.bodyError || 'empty body' });
    const list = extractList(info.kind, req.body);
    const leagueKey = leagueKeyFor(info.platform, info.leagueId);
    store.saveCompanionPayload(leagueKey, info, list);
    companionLeagues.delete(leagueKey);
    engine.clear();
    log(`companion export: ${info.kind} ${info.stage || ''} ${info.week != null ? 'week ' + info.week : ''} ${info.teamId || ''} -> ${list.length} rows (${leagueKey})`);
    app.emit('companion-export', { leagueKey, info, rows: list.length });
    res.json({ success: true, message: `Received ${list.length} ${info.kind} rows` });
  });
  app.get(/^\/(?:companion\/)?([^/]+)\/([^/]+)\/?$/, (req, res, next) => {
    if (['api', 'ui', 'assets'].includes(req.params[0])) return next();
    res.json({ success: true, message: 'Madden 26 Franchise Control is listening. Point the Companion App export here.' });
  });

  app.use(express.static(UI_DIR));
  app.get('/', (req, res) => res.sendFile(path.join(UI_DIR, 'index.html')));
  return app;
}

function gameSort(a, b) {
  const stageRank = { pre: 0, reg: 1, post: 2, off: 3 };
  return (stageRank[a.stage] ?? 9) - (stageRank[b.stage] ?? 9) || a.week - b.week || String(a.gameId).localeCompare(String(b.gameId));
}

export function publicPlayer(p) {
  if (!p) return null;
  return { playerId: p.playerId, teamId: p.teamId, fullName: p.fullName, firstName: p.firstName, lastName: p.lastName, position: p.position, group: positionGroup(p.position), groupLabel: GROUP_LABEL[positionGroup(p.position)] || 'Other', jerseyNum: p.jerseyNum, age: p.age, overall: p.overall, devTrait: p.devTrait, injury: p.injury, career: p.career || null, ratings: p.ratings };
}

export { GROUP_ORDER };

export function publicGame(g, league) {
  if (!g) return null;
  const home = league.teams[g.homeTeamId] || {};
  const away = league.teams[g.awayTeamId] || {};
  return { gameId: g.gameId, stage: g.stage, weekType: g.weekType, week: g.week, label: g.label, homeTeamId: g.homeTeamId, awayTeamId: g.awayTeamId, home: home.abbr, away: away.abbr, homeName: home.displayName, awayName: away.displayName, homeScore: g.homeScore, awayScore: g.awayScore, status: g.status, isSimmed: g.isSimmed };
}

export function summarizeLeague(league) {
  const games = Object.values(league.games);
  return {
    leagueKey: league.leagueId,
    name: league.name,
    source: league.source,
    season: league.season,
    capabilities: league.capabilities,
    teams: Object.values(league.teams).sort((a, b) => (a.abbr || '').localeCompare(b.abbr || '')),
    counts: { players: Object.keys(league.players).length, games: games.length, played: games.filter((g) => g.status === 'played').length, teams: Object.keys(league.teams).length },
    weeks: [...new Set(games.map((g) => `${g.stage}:${g.week}:${g.weekType}`))].map((k) => { const [stage, week, weekType] = k.split(':'); return { stage, week: Number(week), weekType, label: (games.find((g) => g.stage === stage && g.week === Number(week)) || {}).label }; }).sort((a, b) => ({ pre: 0, reg: 1, post: 2 }[a.stage] - { pre: 0, reg: 1, post: 2 }[b.stage]) || a.week - b.week),
    warnings: league.warnings || [],
    filePath: league.filePath || null,
    schema: league.schema || null,
    exportInfo: league.exportInfo || null,
  };
}
