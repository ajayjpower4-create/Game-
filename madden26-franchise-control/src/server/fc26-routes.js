// API for the FC 26 side of the app, under /api/fc.

import path from 'node:path';
import { FcService } from '../core/fc26/service.js';
import { findFcSaves } from '../core/fc26/locate.js';
import { overview, leagueList, standingsView, leaders, clubProfile, playerProfile, transfersView, managerView, ratedMatches, clubName, competitionName } from '../core/fc26/stats.js';
import { normalizeMatch, logStats, matchView, summary, matchStory, GOAL_TYPES, CARD_TYPES, TEAM_STATS } from '../core/fc26/matchlog.js';

function describe(details) {
  if (!details) return null;
  const lines = [];
  for (const [k, v] of Object.entries(details)) lines.push(`${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
  return lines.join('\n');
}

export function fcRoutes(api, { store, dataDir, log = () => {} }) {
  const fc = new FcService(dataDir);
  const fail = (res, e, status = 400) => res.status(status).json({ ok: false, error: e.message, code: e.code || null, details: e.details ? describe(e.details) : null });
  // Run a handler with the career for :k (opened again from disk if needed).
  const withCareer = (fn) => (req, res) => {
    let career;
    try {
      career = fc.get(req.params.k);
    } catch (e) {
      return fail(res, e, 404);
    }
    try {
      res.json({ ok: true, ...fn(career, req) });
    } catch (e) {
      log('fc request failed', req.path, e && e.message);
      fail(res, e);
    }
  };

  api.get('/fc/status', (req, res) => {
    const settings = store.getSettings();
    const extraDirs = [...new Set((settings.recentFcFiles || []).map((f) => path.dirname(f)))];
    let found = { files: [], searched: [] };
    try { found = findFcSaves({ extraDirs }); } catch (e) { found.error = e.message; }
    res.json({ ok: true, careers: fc.list(), found });
  });

  api.post('/fc/open', (req, res) => {
    const { filePath } = req.body || {};
    if (!filePath) return res.status(400).json({ ok: false, error: 'filePath is required' });
    try {
      const career = fc.open(filePath);
      const settings = store.getSettings();
      settings.recentFcFiles = [filePath, ...(settings.recentFcFiles || []).filter((f) => f !== filePath)].slice(0, 8);
      store.saveSettings(settings);
      res.json({ ok: true, careerKey: career.careerKey, summary: { kind: career.kind, club: career.userClubId ? clubName(career, career.userClubId) : null, date: career.date, season: career.seasonLabel, counts: career.details.counts, warnings: career.warnings } });
    } catch (e) {
      log('fc open failed', e && e.message);
      fail(res, e);
    }
  });

  api.post('/fc/:k/refresh', (req, res) => {
    try {
      const meta = fc.meta(req.params.k);
      if (!meta) throw new Error('Unknown FC 26 career');
      const career = fc.open(meta.filePath);
      res.json({ ok: true, careerKey: career.careerKey, date: career.date });
    } catch (e) { fail(res, e); }
  });
  api.delete('/fc/:k', (req, res) => { fc.forget(req.params.k); res.json({ ok: true }); });

  api.get('/fc/:k/overview', withCareer((c) => {
    const o = overview(c);
    const matches = fc.matches(c.careerKey);
    return { overview: o, filePath: c.filePath, savedAt: c.savedAt, details: c.details, log: matches.length ? { matches: matches.length, stats: logStats(matches, { career: c }) } : null };
  }));
  api.get('/fc/:k/leagues', withCareer((c) => ({ leagues: leagueList(c), userClubId: c.userClubId })));
  api.get('/fc/:k/standings/:leagueId', withCareer((c, req) => ({ table: standingsView(c, Number(req.params.leagueId)) })));
  api.get('/fc/:k/leaders', withCareer((c, req) => ({ leaders: leaders(c, { leagueId: req.query.leagueId ? Number(req.query.leagueId) : null, clubId: req.query.clubId ? Number(req.query.clubId) : null, limit: Math.min(50, Number(req.query.limit) || 10) }) })));
  api.get('/fc/:k/clubs', withCareer((c) => ({
    userClubId: c.userClubId,
    leagues: leagueList(c).map((l) => ({ ...l, clubs: standingsView(c, l.leagueId).rows.map((r) => ({ clubId: r.clubId, name: r.club, position: r.position, points: r.points, played: r.played, ovr: r.ovr })) })),
    all: Object.values(c.clubs).filter((x) => x.isClub).map((x) => ({ clubId: x.clubId, name: x.name, leagueId: x.leagueId })).sort((a, b) => a.name.localeCompare(b.name)),
  })));
  api.get('/fc/:k/clubs/:clubId', withCareer((c, req) => {
    const id = Number(req.params.clubId);
    const profile = clubProfile(c, id);
    const matches = fc.matches(c.careerKey).filter((m) => (m.clubId || c.userClubId) === id);
    return { profile, rated: ratedMatches(c, id), log: matches.length ? logStats(matches, { career: c }) : null };
  }));
  api.get('/fc/:k/players/:playerId', withCareer((c, req) => {
    const profile = playerProfile(c, Number(req.params.playerId));
    const matches = fc.matches(c.careerKey);
    const stats = matches.length ? logStats(matches, { career: c }) : null;
    return { profile, logged: stats ? stats.players.find((p) => p.playerId === Number(req.params.playerId)) || null : null, injuries: stats ? stats.injuries.filter((i) => i.playerId === Number(req.params.playerId)) : [] };
  }));
  api.get('/fc/:k/squad/:clubId', withCareer((c, req) => ({ players: Object.values(c.players).filter((p) => p.clubId === Number(req.params.clubId)).map((p) => ({ playerId: p.playerId, name: p.name, position: p.position, group: p.group, ovr: p.ovr, jersey: p.jersey, slot: p.slot })).sort((a, b) => ['GK', 'DEF', 'MID', 'ATT', 'OTHER'].indexOf(a.group) - ['GK', 'DEF', 'MID', 'ATT', 'OTHER'].indexOf(b.group) || (b.ovr || 0) - (a.ovr || 0)) })));
  api.get('/fc/:k/transfers', withCareer((c) => ({ transfers: transfersView(c) })));
  api.get('/fc/:k/manager', withCareer((c) => ({ manager: managerView(c) })));
  api.get('/fc/:k/fixtures', withCareer((c, req) => {
    const id = Number(req.query.clubId) || c.userClubId;
    const logged = fc.matches(c.careerKey);
    const fixtures = c.fixtures.filter((f) => !id || f.homeId === id || f.awayId === id).map((f) => {
      const opp = f.homeId === id ? f.awayId : f.homeId;
      const m = logged.find((x) => x.date === f.date && (x.opponentId === opp || !x.opponentId));
      return { ...f, home: f.homeId === id, opponentId: opp, opponent: clubName(c, opp), competition: competitionName(c, f.competitionId), logged: m ? summary(m, c) : null };
    });
    return { clubId: id, fixtures, rated: id ? ratedMatches(c, id) : [] };
  }));

  // ---- the Match Log
  api.get('/fc/:k/matches', withCareer((c) => {
    const list = fc.matches(c.careerKey).sort((a, b) => b.date.localeCompare(a.date));
    const name = (id) => (c.players[id] ? c.players[id].name : `#${id}`);
    return { matches: list.map((m) => ({ ...summary(m, c), lines: matchStory(m, name).lines, goals: m.goals.length, logged: m })), options: { goalTypes: GOAL_TYPES, cardTypes: CARD_TYPES, teamStats: TEAM_STATS }, rated: c.userClubId ? ratedMatches(c, c.userClubId) : [] };
  }));
  api.get('/fc/:k/matches/:id', withCareer((c, req) => {
    const m = fc.matches(c.careerKey).find((x) => x.id === req.params.id);
    if (!m) throw new Error('That match is not in the log.');
    return { match: matchView(m, c) };
  }));
  api.post('/fc/:k/matches', withCareer((c, req) => {
    const list = fc.matches(c.careerKey);
    const m = normalizeMatch(req.body || {}, { clubId: c.userClubId });
    const i = list.findIndex((x) => x.id === m.id);
    if (i >= 0) list[i] = { ...m, createdAt: list[i].createdAt }; else list.push(m);
    fc.saveMatches(c.careerKey, list);
    return { match: matchView(m, c) };
  }));
  api.delete('/fc/:k/matches/:id', withCareer((c, req) => {
    const list = fc.matches(c.careerKey);
    fc.saveMatches(c.careerKey, list.filter((x) => x.id !== req.params.id));
    return { removed: list.length - fc.matches(c.careerKey).length };
  }));
  api.get('/fc/:k/log-stats', withCareer((c, req) => ({ stats: logStats(fc.matches(c.careerKey), { career: c, competition: req.query.competition || null }) })));
  api.post('/fc/:k/names', withCareer((c, req) => {
    const { playerId, name } = req.body || {};
    if (!c.players[Number(playerId)]) throw new Error('Unknown player');
    fc.setName(c.careerKey, Number(playerId), name);
    return { names: fc.names(c.careerKey) };
  }));
  api.get('/fc/:k/export', (req, res) => {
    const meta = fc.meta(req.params.k);
    if (!meta) return res.status(404).json({ ok: false, error: 'Unknown FC 26 career' });
    res.setHeader('content-disposition', `attachment; filename="fc26-${req.params.k}.json"`);
    res.json({ exportedAt: new Date().toISOString(), meta, matches: fc.matches(req.params.k), names: fc.names(req.params.k) });
  });
  return fc;
}
