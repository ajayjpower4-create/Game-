/* Madden 26 Franchise Control — UI */
(() => {
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const state = {
    status: null,
    leagueKey: null,
    league: null,
    schedule: [],
    section: 'connect',
    stage: 'reg',
    teamId: '',
    gameId: null,
    gameTab: 'blocking',
    gameTeam: null,
    catalog: null,
    seasonCache: new Map(),
    sort: {},
    serverInfo: null,
  };

  // ---------- api
  async function api(path, opts = {}) {
    const res = await fetch('/api' + path, { headers: { 'content-type': 'application/json' }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
    const body = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
    if (!res.ok || body.ok === false) throw new Error(body.error || `HTTP ${res.status}`);
    return body;
  }

  function banner(msg, kind = '') {
    const el = $('#banner');
    if (!msg) { el.classList.add('hidden'); return; }
    el.className = `banner ${kind}`;
    el.innerHTML = msg;
  }

  // ---------- helpers
  const teamName = (id) => (state.league && state.league.teams.find((t) => t.teamId === id)) || { abbr: '?', displayName: 'Unknown' };
  const abbr = (id) => teamName(id).abbr;
  const tag = (src) => (src ? `<span class="tag ${esc(src)}" title="${src === 'recorded' ? 'Recorded by Madden' : src === 'tracked' ? 'Logged in the Game Tracker' : src === 'mixed' ? 'Mix of recorded and reconstructed games' : 'Reconstructed by the tool from recorded stats and ratings'}">${src === 'recorded' ? 'R' : src === 'tracked' ? 'T' : src === 'mixed' ? 'M' : '~'}</span>` : '');
  const legend = () => `<div class="legend"><span class="tag recorded">R</span> recorded by Madden &nbsp; <span class="tag tracked">T</span> logged in the Game Tracker &nbsp; <span class="tag reconstructed">~</span> reconstructed by this tool from what Madden recorded plus player ratings &nbsp; <span class="tag mixed">M</span> mixed across games</div>`;
  const fmt = (v, d = 0) => (v == null || Number.isNaN(v) ? '—' : typeof v === 'number' ? v.toFixed(d) : esc(v));

  function sortRows(rows, key, dir) {
    return rows.slice().sort((a, b) => {
      const va = a[key]; const vb = b[key];
      if (typeof va === 'number' || typeof vb === 'number') return dir * ((vb ?? -Infinity) - (va ?? -Infinity));
      return dir * String(vb ?? '').localeCompare(String(va ?? ''));
    });
  }

  // Generic sortable table. cols: [{key, label, d (decimals), src (source key), left}]
  function table(id, rows, cols, { defaultSort, maxHeight = true } = {}) {
    const sort = state.sort[id] || { key: defaultSort || cols[1].key, dir: 1 };
    const sorted = sortRows(rows, sort.key, sort.dir);
    const head = cols.map((c) => `<th class="${c.left ? 'left' : ''} ${sort.key === c.key ? 'sorted' : ''}" data-sort="${c.key}" data-table="${id}">${esc(c.label)}${sort.key === c.key ? (sort.dir === 1 ? ' ▼' : ' ▲') : ''}</th>`).join('');
    const body = sorted.map((r) => `<tr>${cols.map((c) => `<td class="${c.left ? 'left' : 'num'}">${c.render ? c.render(r) : fmt(r[c.key], c.d || 0)}${c.src && r.source ? tag(r.source[c.src]) : c.src && r.sources ? tag(r.sources[c.src]) : ''}</td>`).join('')}</tr>`).join('');
    return `<div class="${maxHeight ? 'table-wrap' : ''}"><table class="data" id="${id}"><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${cols.length}" class="left muted">Nothing to show yet.</td></tr>`}</tbody></table></div>`;
  }
  document.addEventListener('click', (e) => {
    const th = e.target.closest('th[data-sort]');
    if (!th) return;
    const id = th.dataset.table;
    const cur = state.sort[id] || {};
    state.sort[id] = { key: th.dataset.sort, dir: cur.key === th.dataset.sort ? -cur.dir : 1 };
    render();
  });

  const playerCell = (r) => `<b>${esc(r.name)}</b> <span class="muted">${esc(r.position)}${r.teamId && !state.teamId ? ' · ' + esc(abbr(r.teamId)) : ''}</span>`;

  function leaders(title, rows, key, { d = 0, suffix = '', n = 8 } = {}) {
    return `<div class="card"><h3>${esc(title)}</h3>${(rows || []).slice(0, n).map((r) => `<div class="leader"><div class="who">${esc(r.name)}<span>${esc(r.position)} · ${esc(abbr(r.teamId))}</span></div><div class="n">${fmt(r[key], d)}${suffix}</div></div>`).join('') || '<div class="muted">No games yet.</div>'}</div>`;
  }

  // ---------- EA account sign-in
  const eaUI = { pending: null, task: null, busy: false, showDiag: false };

  async function eaCard() {
    let ea;
    try { ea = await api('/ea/status'); } catch (e) { return `<div class="card"><h3>1 · Sign in with EA</h3><div class="muted">${esc(e.message)}</div></div>`; }
    const year = eaUI.year || ea.year || 26;
    const yearSel = `<select id="ea-year" class="small">${(ea.years || [26]).map((y) => `<option value="${y}" ${y === year ? 'selected' : ''}>Madden ${y}</option>`).join('')}</select>`;
    if (!ea.signedIn) {
      const pick = eaUI.pending
        ? `<div class="plan"><b>Which profile plays Madden?</b>${eaUI.pending.profiles.map((p) => `<label style="display:block;margin:6px 0"><input type="radio" name="ea-profile" value="${esc(p.personaId)}" data-console="${esc(p.console)}" ${eaUI.pending.profiles.length === 1 ? 'checked' : ''}> ${esc(p.displayName)} <span class="muted">· ${esc(p.consoleLabel)} (${esc(p.namespaceLabel)})</span></label>`).join('')}<div class="modal-actions"><button id="ea-cancel">Cancel</button><button class="primary" id="ea-choose" ${eaUI.busy ? 'disabled' : ''}>Continue</button></div></div>`
        : '';
      return `<div class="card">
        <h3>1 · Sign in with EA (easiest)</h3>
        <p>Sign in with the EA account your Madden is on. The tool lists every franchise on the account and downloads the one you pick straight from EA, the same way the Madden Companion App does. Your password is typed on EA's page only.</p>
        <div class="toolbar">${yearSel}${window.m26 ? `<button class="primary" id="ea-signin" ${eaUI.busy ? 'disabled' : ''}>${eaUI.busy ? 'Working…' : 'Sign in with EA'}</button>` : `<a id="ea-open-link" href="#" class="pill">Open the EA sign-in page</a>`}</div>
        ${window.m26 ? '' : `<p class="small-note">Sign in on that page. EA then sends the browser to an address starting with <span class="mono">http://127.0.0.1/success</span> that will not load. Copy that whole address from the browser bar and paste it here:</p><div class="toolbar"><input type="text" id="ea-paste" placeholder="http://127.0.0.1/success?code=…" style="min-width:420px"><button class="primary" id="ea-paste-go" ${eaUI.busy ? 'disabled' : ''}>Continue</button></div>`}
        ${pick}
        ${eaDiag(ea)}
      </div>`;
    }
    const imported = new Map((ea.importedLeagues || []).map((l) => [String(l.leagueId), l]));
    const running = (ea.imports || []).find((t) => t.status === 'running' || t.status === 'queued');
    if (running) eaUI.task = running.id;
    const leagues = (ea.leagues || []).map((l) => {
      const imp = imported.get(String(l.leagueId));
      const task = (ea.imports || []).find((t) => t.leagueId === l.leagueId);
      const busy = task && (task.status === 'running' || task.status === 'queued');
      const pct = task && task.progress && task.progress.total ? Math.round((task.progress.done / task.progress.total) * 100) : 0;
      return `<li>
        <span><b>${esc(l.leagueName)}</b> <span class="muted">· ${esc(l.seasonText || '')} · ${l.numMembers || 1} member(s) · you: ${esc(l.userTeamName || '—')}</span>
          ${imp ? `<br><span class="small-note">Downloaded ${esc(new Date(imp.lastImportAt).toLocaleString())} (${esc(imp.lastImportScope)})</span>` : ''}
          ${busy ? `<br><span class="small-note">${esc(task.progress.step)} · ${pct}%</span>` : ''}
          ${task && task.status === 'error' ? `<br><span class="injured">${esc(task.error)}</span>` : ''}
          ${task && task.status === 'done' && task.result && task.result.errors.length ? `<br><span class="small-note">${task.result.errors.length} part(s) failed: ${esc(task.result.errors.slice(0, 2).join('; '))}</span>` : ''}
        </span>
        <span style="white-space:nowrap">
          ${imp ? `<button class="small" data-ea-open="${esc(imp.leagueKey)}">Open</button> ` : ''}
          <button class="small blue" data-ea-import="${esc(l.leagueId)}" data-scope="all" ${busy ? 'disabled' : ''}>${imp ? 'Download everything again' : 'Download everything'}</button>
          <button class="small" data-ea-import="${esc(l.leagueId)}" data-scope="surrounding" ${busy ? 'disabled' : ''}>Update current week</button>
        </span>
      </li>`;
    }).join('');
    return `<div class="card">
      <h3>1 · Sign in with EA</h3>
      <p><span class="pill win">Signed in</span> <b>${esc(ea.profile.displayName)}</b> <span class="muted">· ${esc(ea.profile.consoleLabel)} · Madden ${ea.year}${ea.encrypted ? ' · sign-in sealed with the Windows keychain' : ''}</span></p>
      <div class="toolbar"><button id="ea-refresh" class="small">Refresh franchise list</button><button id="ea-signout" class="small danger">Sign out</button></div>
      <h3>Franchises on this account (${(ea.leagues || []).length})</h3>
      ${leagues ? `<ul class="list">${leagues}</ul>` : '<div class="muted">No franchises found on this EA account. Refresh after you create or join one.</div>'}
      <p class="small-note">"Download everything" pulls every week of the season and every roster (a few minutes). After each week you play, "Update current week" pulls just the weeks around the current one.</p>
      ${eaDiag(ea)}
    </div>`;
  }

  function eaDiag() {
    return `<p class="small-note"><a href="#" id="ea-diag-toggle">${eaUI.showDiag ? 'Hide' : 'Show'} EA connection log</a></p>${eaUI.showDiag ? `<pre class="mono" id="ea-diag" style="white-space:pre-wrap;max-height:200px;overflow:auto">loading…</pre>` : ''}`;
  }

  async function eaStartSignIn() {
    eaUI.busy = true;
    render();
    try {
      const year = Number($('#ea-year') ? $('#ea-year').value : 26) || 26;
      eaUI.year = year;
      const { url } = await api(`/ea/login-url?year=${year}`);
      const result = await window.m26.eaLogin(url);
      if (!result || result.canceled || !result.url) { eaUI.busy = false; render(); return; }
      await eaSubmitCode(result.url, year);
    } catch (e) {
      eaUI.busy = false;
      banner(`EA sign-in failed: ${esc(e.message)}`, 'error');
      render();
    }
  }

  async function eaSubmitCode(input, year) {
    eaUI.busy = true;
    render();
    try {
      const r = await api('/ea/code', { method: 'POST', body: { code: input, year } });
      eaUI.pending = { handle: r.handle, profiles: r.profiles, year: r.year };
      eaUI.busy = false;
      if (r.profiles.length === 1) { await eaChooseProfile(r.profiles[0].personaId, r.profiles[0].console); return; }
      render();
    } catch (e) {
      eaUI.busy = false;
      banner(`EA sign-in failed: ${esc(e.message)}`, 'error');
      render();
    }
  }

  async function eaChooseProfile(personaId, consoleKey) {
    if (!eaUI.pending) return;
    eaUI.busy = true;
    render();
    try {
      const r = await api('/ea/profile', { method: 'POST', body: { handle: eaUI.pending.handle, personaId, console: consoleKey } });
      eaUI.pending = null;
      eaUI.busy = false;
      banner(`Signed in as ${esc(r.profile.displayName)} (${esc(r.profile.consoleLabel)}). ${r.leagues.length} franchise(s) found.`, 'ok');
      await loadStatus();
      render();
    } catch (e) {
      eaUI.busy = false;
      banner(`Could not finish the EA sign-in: ${esc(e.message)}`, 'error');
      render();
    }
  }

  async function eaImport(leagueId, scope) {
    try {
      const r = await api(`/ea/leagues/${leagueId}/import`, { method: 'POST', body: { scope } });
      eaUI.task = r.task.id;
      banner(`Downloading ${esc(r.task.leagueName)} from EA…`, '');
      render();
    } catch (e) { banner(`Could not start the download: ${esc(e.message)}`, 'error'); }
  }

  // While a download runs, keep the Connect page fresh.
  setInterval(async () => {
    if (!eaUI.task || state.section !== 'connect') return;
    try {
      const { task } = await api(`/ea/imports/${eaUI.task}`);
      if (task.status === 'done' || task.status === 'error') {
        eaUI.task = null;
        if (task.status === 'done') { banner(`${esc(task.leagueName)} downloaded from EA: ${task.result.weeks} week(s), ${task.result.teams} rosters${task.result.errors.length ? `, ${task.result.errors.length} part(s) failed` : ''}.`, 'ok'); await loadStatus(); if (!state.leagueKey || state.leagueKey !== task.leagueKey) { state.leagueKey = task.leagueKey; $('#league-select').value = task.leagueKey; await loadLeague(); return; } }
        else banner(`Download failed: ${esc(task.error)}`, 'error');
      }
      render();
    } catch { /* keep polling */ }
  }, 2000);

  // ---------- data loading
  async function loadStatus() {
    state.status = await api('/status');
    const sel = $('#league-select');
    sel.innerHTML = state.status.leagues.map((l) => `<option value="${esc(l.leagueKey)}">${esc(l.name)} (${l.source === 'franchise' ? 'franchise file' : l.via === 'ea' ? 'EA account' : 'Companion App export'})</option>`).join('') || '<option value="">No league yet</option>';
    if (!state.leagueKey || !state.status.leagues.some((l) => l.leagueKey === state.leagueKey)) state.leagueKey = state.status.leagues[0] ? state.status.leagues[0].leagueKey : null;
    sel.value = state.leagueKey || '';
    $('#sidebar-foot').innerHTML = `Data folder:<br><span class="mono">${esc(state.status.dataDir)}</span>`;
  }

  async function loadLeague() {
    state.league = null;
    state.schedule = [];
    state.seasonCache.clear();
    if (!state.leagueKey) { render(); return; }
    const [l, s] = await Promise.all([api(`/leagues/${state.leagueKey}`), api(`/leagues/${state.leagueKey}/schedule`)]);
    state.league = l.league;
    state.schedule = s.games;
    if (!state.schedule.some((g) => g.stage === state.stage && g.status === 'played')) {
      const first = state.schedule.find((g) => g.status === 'played');
      if (first) state.stage = first.stage;
    }
    const ts = $('#team-select');
    ts.innerHTML = '<option value="">All teams</option>' + state.league.teams.map((t) => `<option value="${esc(t.teamId)}">${esc(t.abbr)} — ${esc(t.displayName)}</option>`).join('');
    ts.value = state.teamId;
    $('#stage-select').value = state.stage;
    render();
  }

  async function season() {
    const key = `${state.leagueKey}|${state.stage}|${state.teamId}`;
    if (!state.seasonCache.has(key)) state.seasonCache.set(key, api(`/leagues/${state.leagueKey}/season?stage=${state.stage}&teamId=${encodeURIComponent(state.teamId)}`).then((r) => r.totals));
    return state.seasonCache.get(key);
  }

  // ---------- sections
  const sections = {};

  sections.connect = async () => {
    const info = state.serverInfo || (window.m26 ? await window.m26.serverInfo() : null);
    state.serverInfo = info;
    const port = info ? info.port : location.port || 80;
    const lan = info ? info.lan : [location.hostname];
    const open = state.status.franchiseOpen;
    return `
      <h1>Connect your franchise</h1>
      <p class="lead">Three ways in. Sign in with your EA account and the tool lists your franchises and downloads the one you pick. A PC franchise file gives you everything, including the injury tool and real snap counts. The Madden Companion App export works too.</p>
      ${await eaCard()}
      <div class="grid cols-2">
        <div class="card">
          <h3>2 · PC franchise file (full access)</h3>
          <p>Madden 26 on PC keeps each franchise as a file in <span class="mono">Documents\\Madden NFL 26\\settings</span> (files named <span class="mono">CAREER-…</span>). Open it here and the tool reads rosters, the schedule, box scores, snap counts and injuries straight from the save, and can write injuries back into it. A backup is made before every write.</p>
          <p>${open ? `<span class="pill win">Open</span> <span class="mono">${esc(state.status.filePath)}</span>` : '<span class="pill">No file open</span>'}</p>
          <div class="toolbar"><button class="primary" id="c-open">Open franchise file</button>${open ? '<button id="c-close">Close file</button>' : ''}</div>
          ${!window.m26 ? '<div class="toolbar"><input type="text" id="c-path" placeholder="Paste the full path to the CAREER file" style="min-width:360px"><button id="c-open-path">Open path</button></div>' : ''}
          ${(state.status.settings.recentFiles || []).length ? `<h3>Recent</h3><ul class="list">${state.status.settings.recentFiles.map((f) => `<li><span class="mono">${esc(f)}</span><button class="small" data-open-recent="${esc(f)}">Open</button></li>`).join('')}</ul>` : ''}
          <p class="small-note">Close Madden or be out of the franchise when you write injuries, then re-load the franchise in game. Madden's cloud sync will upload the changed file the next time you save.</p>
        </div>
        <div class="card">
          <h3>3 · Madden Companion App export</h3>
          <p>Every Madden 26 franchise (console or PC) lives on EA's servers, and EA's official way out of the cloud is the <b>Madden Companion App</b> on your phone. Its <b>Export</b> feature sends the whole league to any address you type in. This program is listening right now at:</p>
          ${lan.map((a) => `<div class="url-box">http://${esc(a)}:${port}</div>`).join('')}
          <ol class="steps">
            <li>Phone and this computer on the same Wi-Fi.</li>
            <li>Open the Madden Companion App → your franchise → <b>Export</b> (under league settings / Export League).</li>
            <li>Type one of the addresses above as the export URL and export <b>All</b> weeks (rosters, schedules, stats, standings).</li>
            <li>Come back here and pick the league at the top. Re-export after each week you play.</li>
          </ol>
          <p class="small-note">Windows Firewall will ask to allow this app the first time; say yes for private networks. Console leagues cannot be edited from outside the game, so the injury tool works with PC franchise files only.</p>
          <p class="small-note">Exports received: <b id="export-count">${state.status.leagues.filter((l) => l.source === 'companion').length}</b> league(s). Last export: ${esc((state.status.leagues.find((l) => l.source === 'companion') || {}).lastExportAt || 'none yet')}</p>
        </div>
      </div>
      ${state.league ? `<h2>${esc(state.league.name)}</h2><div class="stat-row card"><div class="stat"><div class="v">${state.league.counts.teams}</div><div class="l">teams</div></div><div class="stat"><div class="v">${state.league.counts.players}</div><div class="l">players</div></div><div class="stat"><div class="v">${state.league.counts.played} / ${state.league.counts.games}</div><div class="l">games played</div></div><div class="stat"><div class="v">${esc(state.league.season.weekType)} ${state.league.season.week + 1}</div><div class="l">current week</div></div><div class="stat"><div class="v">${state.league.capabilities.snapsRecorded ? 'Real' : 'Reconstructed'}</div><div class="l">snap counts</div></div><div class="stat"><div class="v">${state.league.capabilities.injuryTool ? 'On' : 'File only'}</div><div class="l">injury tool</div></div></div>${state.league.warnings.length ? `<div class="banner">${state.league.warnings.map(esc).join('<br>')}</div>` : ''}` : ''}
    `;
  };

  sections.schedule = async () => {
    if (!state.league) return '<div class="empty">Connect a franchise first.</div>';
    const weeks = state.league.weeks.filter((w) => state.stage === 'all' || w.stage === state.stage);
    const games = state.schedule.filter((g) => (state.stage === 'all' || g.stage === state.stage) && (!state.teamId || g.homeTeamId === state.teamId || g.awayTeamId === state.teamId));
    const byWeek = new Map();
    for (const g of games) { const k = `${g.stage}:${g.week}`; if (!byWeek.has(k)) byWeek.set(k, []); byWeek.get(k).push(g); }
    return `
      <h1>Schedule &amp; Injury Tool</h1>
      <p class="lead">Pick any game. Open its advanced stats, or choose a player and injure him in that game: the injury lands on a random play of the game and is written into the franchise file with the type, side and weeks you choose.</p>
      ${weeks.length ? [...byWeek.entries()].map(([k, list]) => `<h2>${esc(list[0].label)}</h2><div class="games">${list.map(gameCard).join('')}</div>`).join('') : '<div class="empty">No games in this part of the season.</div>'}
    `;
  };

  function gameCard(g) {
    const played = g.status === 'played';
    return `<div class="game ${played ? '' : 'unplayed'}" data-game="${esc(g.gameId)}">
      <div class="teams"><span>${esc(g.away)} ${played ? g.awayScore : ''}</span><span class="muted">@</span><span>${esc(g.home)} ${played ? g.homeScore : ''}</span></div>
      <div class="meta"><span>${esc(g.awayName)} at ${esc(g.homeName)}</span><span>${played ? (g.isSimmed ? 'Simmed' : 'Final') : 'Not played'}</span></div>
      <div class="actions"><button class="small blue" data-stats="${esc(g.gameId)}" ${played ? '' : 'disabled'}>Advanced stats</button><button class="small" data-injure="${esc(g.gameId)}">Injure a player</button></div>
    </div>`;
  }

  sections.game = async () => {
    const g = state.schedule.find((x) => x.gameId === state.gameId);
    if (!g) return '<div class="empty">Pick a game from the schedule.</div>';
    const r = await api(`/leagues/${state.leagueKey}/games/${g.gameId}/stats`);
    const result = r.result;
    if (!result.played) return `<h1>${esc(g.label)}: ${esc(g.away)} @ ${esc(g.home)}</h1><div class="empty">This game has not been played yet.</div>`;
    if (!state.gameTeam || !result.teams[state.gameTeam]) state.gameTeam = g.homeTeamId;
    const t = result.teams[state.gameTeam];
    const tabs = [['blocking', 'Blocking'], ['passrush', 'Pass Rush'], ['snaps', 'Snap Counts'], ['receiving', 'Targets & Drops'], ['tackling', 'Missed Tackles'], ['penalties', 'Penalties'], ['injuries', 'Injuries']];
    let body = '';
    if (state.gameTab === 'blocking') {
      const s = t.blocking.summary;
      body = `<div class="stat-row card"><div class="stat"><div class="v">${s.pressuresAllowed}${tag(s.pressureSource)}</div><div class="l">pressures allowed</div></div><div class="stat"><div class="v">${s.sacksAllowed}</div><div class="l">sacks allowed</div></div><div class="stat"><div class="v">${s.hitsAllowed}</div><div class="l">QB hits</div></div><div class="stat"><div class="v">${s.hurriesAllowed}</div><div class="l">hurries</div></div><div class="stat"><div class="v">${s.nearSacksAllowed}</div><div class="l">almost sacks</div></div><div class="stat"><div class="v">${s.pressureRate}%</div><div class="l">pressure rate</div></div><div class="stat"><div class="v">${s.pancakes}</div><div class="l">pancakes</div></div><div class="stat"><div class="v">${s.dropbacks}</div><div class="l">dropbacks</div></div></div>
        ${s.bestBlocker ? `<p><b>Best blocker:</b> ${esc(s.bestBlocker.name)} (${esc(s.bestBlocker.position)}) grade ${s.bestBlocker.grade}, ${s.bestBlocker.pressuresAllowed} pressures allowed, ${s.bestBlocker.pancakes} pancakes. <b>Most beaten:</b> ${s.mostBeaten ? `${esc(s.mostBeaten.name)} (${esc(s.mostBeaten.position)}) ${s.mostBeaten.pressuresAllowed} pressures allowed` : '—'}</p>` : ''}
        ${legend()}
        ${table('g-block', t.blocking.blockers, BLOCK_COLS, { defaultSort: 'blockGrade' })}
        <h3>Who beat whom</h3>${t.blocking.matchups.length ? `<ul class="list">${t.blocking.matchups.map((m) => `<li><span>${esc(m.rusher)} (${esc(m.rusherPos)}) beat ${esc(m.blocker)} (${esc(m.blockerPos)})</span><b>${m.wins}×</b></li>`).join('')}</ul>` : '<div class="muted">No pressures.</div>'}`;
    } else if (state.gameTab === 'passrush') {
      const s = t.passRush.summary;
      body = `<div class="stat-row card"><div class="stat"><div class="v">${s.pressures}${tag(s.source)}</div><div class="l">pressures</div></div><div class="stat"><div class="v">${s.sacks}</div><div class="l">sacks</div></div><div class="stat"><div class="v">${s.hits}</div><div class="l">QB hits</div></div><div class="stat"><div class="v">${s.hurries}</div><div class="l">hurries</div></div><div class="stat"><div class="v">${s.missedSacks}</div><div class="l">missed sacks</div></div></div>${legend()}${table('g-rush', t.passRush.players, RUSH_COLS, { defaultSort: 'pressures' })}`;
    } else if (state.gameTab === 'snaps') {
      const s = t.snaps.summary;
      body = `<div class="stat-row card"><div class="stat"><div class="v">${s.offPlays}</div><div class="l">offensive plays</div></div><div class="stat"><div class="v">${s.defPlays}</div><div class="l">defensive plays</div></div><div class="stat"><div class="v">${s.stPlays}</div><div class="l">special teams plays</div></div><div class="stat"><div class="v">${s.recorded ? 'Recorded' : 'Reconstructed'}</div><div class="l">snap source</div></div></div>${legend()}${table('g-snaps', t.snaps.players, SNAP_COLS, { defaultSort: 'snapPct' })}`;
    } else if (state.gameTab === 'receiving') {
      const s = t.receiving.summary;
      body = `<div class="stat-row card"><div class="stat"><div class="v">${s.passAttempts}</div><div class="l">pass attempts</div></div><div class="stat"><div class="v">${s.targets}</div><div class="l">targets</div></div><div class="stat"><div class="v">${s.drops}</div><div class="l">drops</div></div><div class="stat"><div class="v">${s.dropRate}%</div><div class="l">drop rate</div></div></div>${legend()}${table('g-rec', t.receiving.players, REC_COLS, { defaultSort: 'targets' })}`;
    } else if (state.gameTab === 'tackling') {
      const s = t.tackling.summary;
      body = `<div class="stat-row card"><div class="stat"><div class="v">${s.missedTackles}</div><div class="l">missed tackles</div></div><div class="stat"><div class="v">${s.brokenTacklesAllowed}</div><div class="l">broken tackles allowed (recorded)</div></div><div class="stat"><div class="v">${s.tackles}</div><div class="l">tackles</div></div><div class="stat"><div class="v">${s.assists}</div><div class="l">assists</div></div></div><p class="small-note">Source: ${esc(s.source)}</p>${legend()}${table('g-tkl', t.tackling.players, TKL_COLS, { defaultSort: 'missedTackles' })}`;
    } else if (state.gameTab === 'penalties') {
      const s = t.penalties.summary;
      body = `<div class="stat-row card"><div class="stat"><div class="v">${s.penalties}</div><div class="l">penalties</div></div><div class="stat"><div class="v">${s.yards}</div><div class="l">yards</div></div><div class="stat"><div class="v">${s.recordedPenalties} / ${s.recordedYards}</div><div class="l">recorded team total</div></div></div>${legend()}${table('g-pen', t.penalties.players.map((p) => ({ ...p, typeList: p.types.map((x) => `${x.type} (${x.yards})`).join(', ') })), PEN_COLS, { defaultSort: 'penalties' })}`;
    } else if (state.gameTab === 'injuries') {
      const inj = result.injuries || [];
      body = inj.length ? `<ul class="list">${inj.map((i) => `<li><span><b>${esc(i.player ? i.player.fullName : i.playerId)}</b> <span class="muted">${esc(i.player ? i.player.position : '')} · ${esc(i.gameTeam === 0 ? g.home : g.away)}</span> — ${esc(i.type)} (${esc(i.severity)}, ${i.weeksMin}-${i.weeksMax} weeks)</span><span class="tag recorded">game</span></li>`).join('')}</ul>` : '<div class="empty">Madden did not record any injuries in this game. Use "Injure a player" to add one.</div>';
    }
    return `
      <button id="back-sched">← Schedule</button>
      <h1>${esc(g.label)}: ${esc(g.away)} ${g.awayScore} @ ${esc(g.home)} ${g.homeScore}</h1>
      <div class="toolbar"><div class="field"><span>Team</span><select id="game-team"><option value="${esc(g.homeTeamId)}" ${state.gameTeam === g.homeTeamId ? 'selected' : ''}>${esc(g.homeName)}</option><option value="${esc(g.awayTeamId)}" ${state.gameTeam === g.awayTeamId ? 'selected' : ''}>${esc(g.awayName)}</option></select></div><button data-injure="${esc(g.gameId)}">Injure a player in this game</button><button data-track="${esc(g.gameId)}">Log events in the Game Tracker</button></div>
      <div class="tabs">${tabs.map(([k, l]) => `<button class="${state.gameTab === k ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
      ${body}`;
  }

  const BLOCK_COLS = [
    { key: 'name', label: 'Blocker', left: true, render: playerCell },
    { key: 'blockGrade', label: 'Grade' },
    { key: 'snaps', label: 'Snaps', src: 'snaps' },
    { key: 'passBlockSnaps', label: 'Pass blk' },
    { key: 'runBlockSnaps', label: 'Run blk' },
    { key: 'pressuresAllowed', label: 'Press allowed', src: 'pressures' },
    { key: 'hurriesAllowed', label: 'Hurries' },
    { key: 'hitsAllowed', label: 'QB hits' },
    { key: 'sacksAllowed', label: 'Sacks', src: 'sacksAllowed' },
    { key: 'nearSacksAllowed', label: 'Almost sacks' },
    { key: 'cleanPassSnaps', label: 'Clean snaps' },
    { key: 'passBlockEfficiency', label: 'PBE', d: 1 },
    { key: 'avgTimeHeld', label: 'Held (s)', d: 2, src: 'timing' },
    { key: 'timeToPressure', label: 'Time to press (s)', d: 2 },
    { key: 'pancakes', label: 'Pancakes', src: 'pancakes' },
    { key: 'pancakeRate', label: 'Pancake %', d: 1 },
  ];
  const RUSH_COLS = [
    { key: 'name', label: 'Rusher', left: true, render: playerCell },
    { key: 'passRushSnaps', label: 'Rush snaps', src: 'snaps' },
    { key: 'pressures', label: 'Pressures', src: 'pressures' },
    { key: 'sacks', label: 'Sacks', d: 1, src: 'sacks' },
    { key: 'hits', label: 'QB hits' },
    { key: 'hurries', label: 'Hurries' },
    { key: 'missedSacks', label: 'Missed sacks' },
    { key: 'nearSacks', label: 'Almost sacks' },
    { key: 'winRate', label: 'Win %', d: 1 },
  ];
  const SNAP_COLS = [
    { key: 'name', label: 'Player', left: true, render: playerCell },
    { key: 'offSnaps', label: 'Offense', src: 'snaps' },
    { key: 'defSnaps', label: 'Defense' },
    { key: 'stSnaps', label: 'Special teams' },
    { key: 'snapPct', label: 'Snap %', d: 1 },
  ];
  const REC_COLS = [
    { key: 'name', label: 'Receiver', left: true, render: playerCell },
    { key: 'targets', label: 'Targets', src: 'targets' },
    { key: 'catches', label: 'Catches', src: 'catches' },
    { key: 'drops', label: 'Drops', src: 'drops' },
    { key: 'catchRate', label: 'Catch %', d: 1 },
    { key: 'dropRate', label: 'Drop %', d: 1 },
    { key: 'yards', label: 'Yards' },
    { key: 'yardsPerTarget', label: 'Yds/target', d: 1 },
    { key: 'tds', label: 'TD' },
    { key: 'snaps', label: 'Snaps', src: 'snaps' },
  ];
  const TKL_COLS = [
    { key: 'name', label: 'Defender', left: true, render: playerCell },
    { key: 'tackles', label: 'Tackles', src: 'tackles' },
    { key: 'assists', label: 'Assists' },
    { key: 'missedTackles', label: 'Missed', src: 'missedTackles' },
    { key: 'missRate', label: 'Miss %', d: 1 },
    { key: 'tacklesForLoss', label: 'TFL' },
    { key: 'sacks', label: 'Sacks', d: 1 },
    { key: 'bigHits', label: 'Big hits' },
    { key: 'forcedFumbles', label: 'FF' },
    { key: 'catchesAllowed', label: 'Catches allowed' },
    { key: 'deflections', label: 'PD' },
    { key: 'snaps', label: 'Snaps', src: 'snaps' },
  ];
  const PEN_COLS = [
    { key: 'name', label: 'Player', left: true, render: playerCell },
    { key: 'penalties', label: 'Penalties', src: 'penalties' },
    { key: 'yards', label: 'Yards' },
    { key: 'typeList', label: 'Flags', left: true },
  ];
  const SEASON_BLOCK_COLS = [
    { key: 'name', label: 'Blocker', left: true, render: playerCell },
    { key: 'games', label: 'G' },
    { key: 'blockGrade', label: 'Grade' },
    { key: 'snaps', label: 'Snaps', src: 'snaps' },
    { key: 'passBlockSnaps', label: 'Pass blk' },
    { key: 'pressuresAllowed', label: 'Press allowed', src: 'pressures' },
    { key: 'hurriesAllowed', label: 'Hurries' },
    { key: 'hitsAllowed', label: 'QB hits' },
    { key: 'sacksAllowed', label: 'Sacks', src: 'sacksAllowed' },
    { key: 'nearSacksAllowed', label: 'Almost sacks' },
    { key: 'passBlockEfficiency', label: 'PBE', d: 1 },
    { key: 'avgTimeHeld', label: 'Held (s)', d: 2 },
    { key: 'pancakes', label: 'Pancakes', src: 'pancakes' },
    { key: 'pancakeRate', label: 'Pancake %', d: 1 },
  ];
  const SEASON_SNAP_COLS = [
    { key: 'name', label: 'Player', left: true, render: playerCell },
    { key: 'games', label: 'G' },
    { key: 'offSnaps', label: 'Offense', src: 'snaps' },
    { key: 'defSnaps', label: 'Defense' },
    { key: 'stSnaps', label: 'Special teams' },
    { key: 'total', label: 'Total' },
    { key: 'snapPct', label: 'Snap %', d: 1 },
  ];
  const SEASON_PEN_COLS = [
    { key: 'name', label: 'Player', left: true, render: playerCell },
    { key: 'games', label: 'G' },
    { key: 'penalties', label: 'Penalties', src: 'penalties' },
    { key: 'yards', label: 'Yards' },
    { key: 'typeList', label: 'Flags', left: true },
  ];

  async function seasonSection(title, lead, build) {
    if (!state.league) return '<div class="empty">Connect a franchise first.</div>';
    const s = await season();
    return `<h1>${title}</h1><p class="lead">${lead}</p><p class="muted">${s.games} game(s) · ${esc({ pre: 'preseason', reg: 'regular season', post: 'playoffs', all: 'all games' }[state.stage])}${state.teamId ? ' · ' + esc(teamName(state.teamId).displayName) : ''}</p>${legend()}${build(s)}`;
  }

  sections.blocking = () => seasonSection('Advanced Blocking', 'Pressures, hurries, QB hits and sacks allowed by every blocker, pancakes, how long each blocker keeps the rusher off the quarterback, and a blocking grade that combines all of it.', (s) => `
    <div class="grid cols-4">${leaders('Best blockers (grade)', s.leaders.bestBlockers, 'blockGrade')}${leaders('Most pressures allowed', s.leaders.mostPressuresAllowed, 'pressuresAllowed')}${leaders('Most pancakes', s.leaders.mostPancakes, 'pancakes')}${leaders('Longest hold before pressure', s.leaders.longestHold, 'avgTimeHeld', { d: 2, suffix: 's' })}</div>
    <h2>All blockers</h2>${table('s-block', s.blocking.players, SEASON_BLOCK_COLS, { defaultSort: 'blockGrade' })}`);

  sections.passrush = () => seasonSection('Pass Rush & Missed Sacks', 'Pressures created by every defender, sacks (recorded by Madden), QB hits, hurries, and the sacks they had and let get away.', (s) => `
    <div class="grid cols-3">${leaders('Most pressures', s.leaders.mostPressures, 'pressures')}${leaders('Most sacks', s.leaders.mostSacks, 'sacks', { d: 1 })}${leaders('Most missed sacks', s.leaders.mostMissedSacks, 'missedSacks')}</div>
    <h2>All pass rushers</h2>${table('s-rush', s.passRush.players.map((r) => ({ ...r, games: r.games })), [{ key: 'name', label: 'Rusher', left: true, render: playerCell }, { key: 'games', label: 'G' }, ...RUSH_COLS.slice(1)], { defaultSort: 'pressures' })}`);

  sections.snaps = () => seasonSection('Snap Counts', 'Offensive, defensive and special-teams snaps for every player. From a PC franchise file these are the real numbers Madden recorded; from a Companion App export they are rebuilt from the play count and the box score.', (s) => `
    <div class="grid cols-2">${leaders('Most total snaps', s.leaders.mostSnaps, 'total')}<div class="card"><h3>Team play counts</h3>${Object.values(s.teams).map((t) => `<div class="leader"><div class="who">${esc(abbr(t.teamId))}<span>${t.games} g</span></div><div class="n">${t.offPlays} off · ${t.defPlays} def</div></div>`).join('')}</div></div>
    <h2>All players</h2>${table('s-snaps', s.snaps.players, SEASON_SNAP_COLS, { defaultSort: 'total' })}`);

  sections.receiving = () => seasonSection('Targets & Drops', 'How many times each receiver was thrown to, what he caught, and what he dropped. Catches and drops are recorded by Madden; targets are rebuilt from the passing totals unless the export carries catch percentage.', (s) => `
    <div class="grid cols-3">${leaders('Most targets', s.leaders.mostTargets, 'targets')}${leaders('Most drops', s.leaders.mostDrops, 'drops')}${leaders('Worst drop rate (10+ targets)', s.leaders.worstDropRate, 'dropRate', { d: 1, suffix: '%' })}</div>
    <h2>All receivers</h2>${table('s-rec', s.receiving.players, [{ key: 'name', label: 'Receiver', left: true, render: playerCell }, { key: 'games', label: 'G' }, ...REC_COLS.slice(1)], { defaultSort: 'targets' })}`);

  sections.tackling = () => seasonSection('Missed Tackles', 'Tackles and assists are recorded by Madden. Missed tackles are charged from the broken tackles the offense was credited with, by who was in on the play and how well he tackles, unless you logged the real ones in the Game Tracker.', (s) => `
    <div class="grid cols-3">${leaders('Most missed tackles', s.leaders.mostMissedTackles, 'missedTackles')}${leaders('Worst miss rate (10+ attempts)', s.leaders.worstMissRate, 'missRate', { d: 1, suffix: '%' })}${leaders('Surest tacklers (15+ attempts)', s.leaders.surestTacklers, 'missRate', { d: 1, suffix: '%' })}</div>
    <h2>All defenders</h2>${table('s-tkl', s.tackling.players, [{ key: 'name', label: 'Defender', left: true, render: playerCell }, { key: 'games', label: 'G' }, ...TKL_COLS.slice(1)], { defaultSort: 'missedTackles' })}`);

  sections.penalties = () => seasonSection('Penalties', 'Madden records the team penalty count and yards. The tool charges each flag to a player by position, awareness and playing time, with penalty types whose yards add up to the team total. Log the real flags in the Game Tracker to replace this.', (s) => `
    <div class="grid cols-2">${leaders('Most penalties', s.leaders.mostPenalties, 'penalties')}${leaders('Most penalty yards', s.leaders.mostPenaltyYards, 'yards', { suffix: ' yds' })}</div>
    <h2>All players with a flag</h2>${table('s-pen', s.penalties.players.map((p) => ({ ...p, typeList: Object.entries(p.types || {}).map(([t, n]) => `${t}${n > 1 ? ' ×' + n : ''}`).join(', ') })), SEASON_PEN_COLS, { defaultSort: 'penalties' })}`);

  // ---------- tracker
  sections.tracker = async () => {
    if (!state.league) return '<div class="empty">Connect a franchise first.</div>';
    const games = state.schedule.filter((g) => g.status === 'played' && (state.stage === 'all' || g.stage === state.stage));
    if (!state.gameId || !games.some((g) => g.gameId === state.gameId)) state.gameId = games.length ? games[games.length - 1].gameId : null;
    const g = games.find((x) => x.gameId === state.gameId);
    if (!g) return '<h1>Game Tracker</h1><div class="empty">Play a game first.</div>';
    const ev = await api(`/leagues/${state.leagueKey}/tracker?gameId=${g.gameId}`);
    const teamId = state.gameTeam && [g.homeTeamId, g.awayTeamId].includes(state.gameTeam) ? state.gameTeam : g.homeTeamId;
    state.gameTeam = teamId;
    const oppId = teamId === g.homeTeamId ? g.awayTeamId : g.homeTeamId;
    const [roster, oppRoster] = await Promise.all([api(`/leagues/${state.leagueKey}/teams/${teamId}/roster`), api(`/leagues/${state.leagueKey}/teams/${oppId}/roster`)]);
    const opt = (list) => list.map((p) => `<option value="${esc(p.playerId)}">${esc(p.position)} ${esc(p.fullName)} #${p.jerseyNum}</option>`).join('');
    const types = ev.eventTypes;
    return `
      <h1>Game Tracker</h1>
      <p class="lead">Log what you actually saw while playing: pressures, hurries, hits, sacks and missed sacks (with the blocker who got beat), pancakes, targets and drops, missed tackles, penalties, and real snap counts. Anything you log replaces the tool's reconstruction for that team and game, and shows a <span class="tag tracked">T</span>.</p>
      <div class="toolbar">
        <div class="field"><span>Game</span><select id="tr-game">${games.map((x) => `<option value="${esc(x.gameId)}" ${x.gameId === g.gameId ? 'selected' : ''}>${esc(x.label)}: ${esc(x.away)} @ ${esc(x.home)}</option>`).join('')}</select></div>
        <div class="field"><span>Team</span><select id="tr-team"><option value="${esc(g.homeTeamId)}" ${teamId === g.homeTeamId ? 'selected' : ''}>${esc(g.homeName)}</option><option value="${esc(g.awayTeamId)}" ${teamId === g.awayTeamId ? 'selected' : ''}>${esc(g.awayName)}</option></select></div>
      </div>
      <div class="card">
        <div class="form-grid">
          <div class="field"><span>Event</span><select id="tr-type">${Object.entries(types).map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`).join('')}</select></div>
          <div class="field"><span>Player (${esc(abbr(teamId))})</span><select id="tr-player">${opt(roster.players)}</select></div>
          <div class="field" id="tr-against-field"><span>Blocker beaten (${esc(abbr(oppId))}, optional)</span><select id="tr-against"><option value="">—</option>${opt(oppRoster.players.filter((p) => ['LT', 'LG', 'C', 'RG', 'RT', 'TE', 'HB', 'FB'].includes(p.position)))}</select></div>
          <div class="field" id="tr-pen-field"><span>Penalty type / yards</span><div style="display:flex;gap:6px"><input type="text" id="tr-pentype" placeholder="Holding" style="min-width:0"><input type="number" id="tr-yards" placeholder="10" min="0" max="60" style="min-width:0;width:90px"></div></div>
          <div class="field" id="tr-snaps-field"><span>Snaps: offense / defense / special teams</span><div style="display:flex;gap:6px"><input type="number" id="tr-off" min="0" style="min-width:0;width:90px"><input type="number" id="tr-def" min="0" style="min-width:0;width:90px"><input type="number" id="tr-st" min="0" style="min-width:0;width:90px"></div></div>
          <div class="field"><span>Quarter (optional)</span><select id="tr-q"><option value="">—</option><option>1</option><option>2</option><option>3</option><option>4</option><option>OT</option></select></div>
        </div>
        <div class="modal-actions"><button class="primary" id="tr-add">Log event</button></div>
      </div>
      <h2>Logged for this game (${ev.events.length})</h2>
      ${ev.events.length ? `<ul class="list">${ev.events.slice().reverse().map((e) => `<li><span><b>${esc(types[e.type] ? types[e.type].label : e.type)}</b> · ${esc(abbr(e.teamId))} ${esc(nameOf(e.playerId, roster.players, oppRoster.players))}${e.againstPlayerId ? ' beat ' + esc(nameOf(e.againstPlayerId, roster.players, oppRoster.players)) : ''}${e.type === 'penalty' ? ` — ${esc(e.penaltyType || 'Penalty')} ${e.yards} yds` : ''}${e.type === 'snaps' ? ` — off ${e.offSnaps || 0} / def ${e.defSnaps || 0} / st ${e.stSnaps || 0}` : ''}${e.quarter ? ` (Q${esc(e.quarter)})` : ''}</span><button class="small danger" data-del-event="${esc(e.id)}">Remove</button></li>`).join('')}</ul>` : '<div class="empty">Nothing logged for this game yet.</div>'}`;
  };
  const nameOf = (id, ...lists) => { for (const l of lists) { const p = l.find((x) => x.playerId === id); if (p) return `${p.fullName} (${p.position})`; } return id; };

  // ---------- injuries
  sections.injuries = async () => {
    if (!state.league) return '<div class="empty">Connect a franchise first.</div>';
    const r = await api(`/leagues/${state.leagueKey}/injuries`);
    const canWrite = state.league.source === 'franchise';
    return `
      <h1>Injury Report</h1>
      <p class="lead">Injuries you created with this tool, and everybody currently hurt in the franchise.</p>
      <h2>Your injuries (${r.log.length})</h2>
      ${r.log.length ? `<ul class="list">${r.log.map((e) => `<li><span><b>${esc(e.plan.player.name)}</b> <span class="muted">${esc(e.plan.player.position)}</span> — ${esc(e.plan.injury.name)}${e.plan.injury.side !== 'NA' ? ' (' + esc(e.plan.injury.side.toLowerCase()) + ')' : ''}, ${esc(e.plan.injury.label)} · ${esc(e.game.label)} ${esc(e.game.away)} @ ${esc(e.game.home)} · Q${e.plan.play.quarter} ${esc(e.plan.play.clock)}, play ${e.plan.play.playNumber}, ${esc(e.plan.play.playType)} <span class="pill ${e.status === 'applied' ? 'win' : ''}">${e.status === 'applied' ? 'Written to file' : 'Scheduled'}</span></span><span>${e.status === 'scheduled' && canWrite ? `<button class="small blue" data-apply-sched="${esc(e.id)}">Write to file now</button>` : ''}<button class="small danger" data-del-inj="${esc(e.id)}">Remove</button></span></li>`).join('')}</ul>` : '<div class="empty">No injuries created yet. Go to the schedule, pick a game and click "Injure a player".</div>'}
      <h2>Currently injured (${r.current.length})</h2>
      ${r.current.length ? table('inj-cur', r.current.map((p) => ({ name: p.fullName, position: p.position, teamId: p.teamId, type: p.injury.type, weeks: p.injury.weeksTotal, onIR: p.injury.onIR ? 'IR' : '', playerId: p.playerId })), [{ key: 'name', label: 'Player', left: true, render: playerCell }, { key: 'type', label: 'Injury', left: true }, { key: 'weeks', label: 'Weeks left' }, { key: 'onIR', label: 'IR', left: true }, ...(canWrite ? [{ key: 'playerId', label: '', left: true, render: (r) => `<button class="small" data-heal="${esc(r.playerId)}">Heal</button>` }] : [])], { defaultSort: 'weeks' }) : '<div class="muted">Nobody is hurt.</div>'}`;
  };

  async function openInjuryModal(gameId, presetTeam) {
    const g = state.schedule.find((x) => x.gameId === gameId);
    if (!g) return;
    if (!state.catalog) state.catalog = await api('/injuries/catalog');
    const root = $('#modal-root');
    let teamId = presetTeam || g.homeTeamId;
    let roster = (await api(`/leagues/${state.leagueKey}/teams/${teamId}/roster`)).players;
    let plan = null;
    const canApply = state.league.source === 'franchise';
    const draw = () => {
      const parts = state.catalog.bodyParts;
      root.innerHTML = `<div class="modal-back"><div class="modal">
        <h2>Injure a player · ${esc(g.label)}: ${esc(g.away)} @ ${esc(g.home)}</h2>
        <div class="form-grid">
          <div class="field"><span>Team</span><select id="im-team"><option value="${esc(g.homeTeamId)}" ${teamId === g.homeTeamId ? 'selected' : ''}>${esc(g.homeName)}</option><option value="${esc(g.awayTeamId)}" ${teamId === g.awayTeamId ? 'selected' : ''}>${esc(g.awayName)}</option></select></div>
          <div class="field"><span>Player</span><select id="im-player">${roster.map((p) => `<option value="${esc(p.playerId)}">${esc(p.position)} ${esc(p.fullName)} #${p.jerseyNum} (${p.overall})${p.injury && p.injury.status === 'Injured' ? ' — already injured' : ''}</option>`).join('')}</select></div>
          <div class="field"><span>Body part</span><select id="im-part">${parts.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join('')}</select></div>
          <div class="field"><span>Injury</span><select id="im-type"></select></div>
          <div class="field"><span>Weeks out (blank = the game's normal range)</span><input type="number" id="im-weeks" min="0" max="63" placeholder="auto"></div>
          <div class="field"><span>Side</span><select id="im-side"><option value="">Random</option><option value="Left">Left</option><option value="Right">Right</option></select></div>
          <div class="field full"><label style="display:flex;align-items:center;gap:8px;color:var(--text)"><input type="checkbox" id="im-ir" style="min-width:0"> Place on injured reserve when 4+ weeks</label></div>
        </div>
        <div id="im-plan">${plan ? planHtml(plan) : '<p class="small-note">Click <b>Preview</b> to roll the play it happens on and the exact weeks.</p>'}</div>
        <div class="modal-actions">
          <button id="im-cancel">Cancel</button>
          <button id="im-preview">Preview</button>
          <button id="im-reroll" ${plan ? '' : 'disabled'}>Re-roll play</button>
          <button class="blue" id="im-schedule" ${plan ? '' : 'disabled'} title="Save it here and write it into the file later">Save for later</button>
          <button class="primary" id="im-apply" ${plan && canApply ? '' : 'disabled'} title="${canApply ? 'Write into the franchise file now (a backup is made first)' : 'Needs an open PC franchise file'}">Write into franchise file</button>
        </div>
        <p class="small-note">${g.status === 'played' ? 'This game is already in the books, so the injury is dated to it and the player misses the coming weeks.' : 'This game has not been played yet. Writing now means he sits out starting this week. To have him play and get hurt in this game, save for later and write it in right after the game.'}${canApply ? '' : ' Console franchises live on EA servers, so the tool can only save the injury here for your records.'}</p>
      </div></div>`;
      const partSel = $('#im-part'); const typeSel = $('#im-type');
      const fillTypes = () => { typeSel.innerHTML = state.catalog.byPart[partSel.value].map((t) => `<option value="${esc(t.key)}">${esc(t.name)} · ${t.seasonEnding ? 'season' : t.weeks.min + '-' + t.weeks.max + ' wk'}</option>`).join(''); };
      fillTypes();
      partSel.value = state._lastPart || 'Knee'; fillTypes(); if (state._lastType) typeSel.value = state._lastType;
      partSel.onchange = () => { state._lastPart = partSel.value; fillTypes(); };
      typeSel.onchange = () => { state._lastType = typeSel.value; };
      $('#im-team').onchange = async (e) => { teamId = e.target.value; roster = (await api(`/leagues/${state.leagueKey}/teams/${teamId}/roster`)).players; plan = null; draw(); };
      $('#im-cancel').onclick = () => { root.innerHTML = ''; };
      const req = (salt) => ({ playerId: $('#im-player').value, gameId, injuryKey: $('#im-type').value, weeks: $('#im-weeks').value === '' ? undefined : Number($('#im-weeks').value), side: $('#im-side').value || undefined, placeOnIR: $('#im-ir').checked, salt: salt || '' });
      $('#im-preview').onclick = async () => { try { plan = (await api(`/leagues/${state.leagueKey}/injuries/plan`, { method: 'POST', body: req('') })).plan; plan._salt = ''; draw(); } catch (e) { banner(esc(e.message), 'error'); } };
      $('#im-reroll').onclick = async () => { const salt = String(Math.floor(Math.random() * 1e9)); try { plan = (await api(`/leagues/${state.leagueKey}/injuries/plan`, { method: 'POST', body: req(salt) })).plan; plan._salt = salt; draw(); } catch (e) { banner(esc(e.message), 'error'); } };
      $('#im-schedule').onclick = async () => { try { await api(`/leagues/${state.leagueKey}/injuries/schedule`, { method: 'POST', body: req(plan._salt) }); root.innerHTML = ''; banner('Injury saved. Find it under Injury Report and write it into the file when you are ready.', 'ok'); } catch (e) { banner(esc(e.message), 'error'); } };
      $('#im-apply').onclick = async () => {
        if (!confirm(`Write this injury into the franchise file now?\n\n${plan.player.name}: ${plan.injury.name}, ${plan.injury.label}.\n\nA backup copy of the file is made first. Make sure Madden is not in this franchise while writing.`)) return;
        try { const r = await api(`/leagues/${state.leagueKey}/injuries/apply`, { method: 'POST', body: { ...req(plan._salt), applyMode: 'now' } }); root.innerHTML = ''; banner(`Done. ${esc(r.plan.player.name)} is out: ${esc(r.plan.injury.name)}, ${esc(r.plan.injury.label)}. Backup: <span class="mono">${esc(r.backupPath)}</span>`, 'ok'); await loadLeague(); } catch (e) { banner(esc(e.message), 'error'); }
      };
    };
    draw();
  }
  const planHtml = (p) => `<div class="plan"><div class="headline">${esc(p.player.name)} (${esc(p.player.position)}) — ${esc(p.injury.name)}${p.injury.side !== 'NA' ? ', ' + esc(p.injury.side.toLowerCase()) : ''}</div><div>${esc(p.injury.label)} · severity ${esc(p.injury.severity)} · ${p.injury.weeks} week(s)</div><div class="muted">Happens on play ${p.play.playNumber}, Q${p.play.quarter} ${esc(p.play.clock)}, ${esc(p.play.down)}${['st', 'nd', 'rd', 'th'][Math.min(3, p.play.down - 1)]} &amp; ${p.play.distance} at the ${esc(p.play.fieldPosition)}, ${esc(p.play.playType)}.</div></div>`;

  // ---------- settings
  sections.settings = async () => {
    const s = state.status.settings;
    return `
      <h1>Settings</h1>
      <div class="card">
        <div class="form-grid">
          <div class="field"><span>Port the Companion App exports to (restart to apply)</span><input type="number" id="set-port" value="${esc(s.port || 3826)}"></div>
          <div class="field"><span>Extra schema folder (advanced: newer Madden patches)</span><input type="text" id="set-schema" value="${esc(s.schemaDirectory || '')}" placeholder="leave empty for the bundled schemas"></div>
        </div>
        <div class="modal-actions"><button class="primary" id="set-save">Save</button></div>
      </div>
      <div class="card" style="margin-top:14px">
        <h3>About</h3>
        <p>Madden 26 Franchise Control ${esc(state.status.version)}. Data folder: <span class="mono">${esc(state.status.dataDir)}</span>. Franchise file schema in use: ${state.league && state.league.schema ? `<span class="mono">M${state.league.schema.gameYear} ${state.league.schema.major}.${state.league.schema.minor}</span>` : '—'}.</p>
        <p class="small-note">If a future Madden patch changes the save format and files stop opening, drop the new schema (.gz from the madden-franchise project) into a folder and point the tool at it above.</p>
      </div>`;
  };

  // ---------- render / events
  async function render() {
    $$('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.section === state.section || (state.section === 'game' && b.dataset.section === 'schedule')));
    const showFilters = !['connect', 'settings', 'game'].includes(state.section);
    $('#stage-field').classList.toggle('hidden', !showFilters);
    $('#team-field').classList.toggle('hidden', !showFilters || ['tracker', 'injuries'].includes(state.section));
    const content = $('#content');
    content.innerHTML = '<div class="muted">Loading…</div>';
    try {
      content.innerHTML = await sections[state.section]();
    } catch (e) {
      content.innerHTML = `<div class="empty">${esc(e.message)}</div>`;
    }
    bind();
  }

  function bind() {
    const c = $('#content');
    const on = (sel, ev, fn) => $$(sel, c).forEach((el) => (el[ev] = fn));
    on('#c-open', 'onclick', openFile);
    on('#c-close', 'onclick', async () => { await api('/franchise/close', { method: 'POST' }); await loadStatus(); await loadLeague(); });
    on('#c-open-path', 'onclick', () => openPath($('#c-path').value));
    on('[data-open-recent]', 'onclick', (e) => openPath(e.currentTarget.dataset.openRecent));
    on('#ea-signin', 'onclick', eaStartSignIn);
    on('#ea-open-link', 'onclick', async (e) => { e.preventDefault(); const year = Number($('#ea-year') ? $('#ea-year').value : 26) || 26; eaUI.year = year; const { url } = await api(`/ea/login-url?year=${year}`); window.open(url, '_blank'); });
    on('#ea-paste-go', 'onclick', () => eaSubmitCode($('#ea-paste').value, Number($('#ea-year') ? $('#ea-year').value : 26) || 26));
    on('#ea-year', 'onchange', (e) => { eaUI.year = Number(e.target.value); });
    on('#ea-cancel', 'onclick', () => { eaUI.pending = null; render(); });
    on('#ea-choose', 'onclick', () => { const r = $('input[name="ea-profile"]:checked'); if (!r) { banner('Pick a profile first.', ''); return; } eaChooseProfile(r.value, r.dataset.console); });
    on('#ea-refresh', 'onclick', async () => { try { await api('/ea/leagues/refresh', { method: 'POST' }); render(); } catch (err) { banner(esc(err.message), 'error'); } });
    on('#ea-signout', 'onclick', async () => { if (!confirm('Sign out of EA on this PC? Downloaded leagues stay.')) return; await api('/ea/signout', { method: 'POST' }); await loadStatus(); render(); });
    on('[data-ea-import]', 'onclick', (e) => eaImport(e.currentTarget.dataset.eaImport, e.currentTarget.dataset.scope));
    on('[data-ea-open]', 'onclick', async (e) => { state.leagueKey = e.currentTarget.dataset.eaOpen; $('#league-select').value = state.leagueKey; state.section = 'schedule'; await loadLeague(); });
    on('#ea-diag-toggle', 'onclick', async (e) => { e.preventDefault(); eaUI.showDiag = !eaUI.showDiag; render(); });
    if (eaUI.showDiag && $('#ea-diag')) api('/ea/diagnostics').then((r) => { const el = $('#ea-diag'); if (el) el.textContent = r.lines.join('\n') || 'nothing yet'; }).catch(() => {});
    on('[data-stats]', 'onclick', (e) => { e.stopPropagation(); state.gameId = e.currentTarget.dataset.stats; state.section = 'game'; render(); });
    on('[data-injure]', 'onclick', (e) => { e.stopPropagation(); openInjuryModal(e.currentTarget.dataset.injure, state.gameTeam); });
    on('[data-track]', 'onclick', (e) => { state.gameId = e.currentTarget.dataset.track; state.section = 'tracker'; render(); });
    on('.game', 'onclick', (e) => { const g = state.schedule.find((x) => x.gameId === e.currentTarget.dataset.game); if (g && g.status === 'played') { state.gameId = g.gameId; state.section = 'game'; render(); } });
    on('#back-sched', 'onclick', () => { state.section = 'schedule'; render(); });
    on('[data-tab]', 'onclick', (e) => { state.gameTab = e.currentTarget.dataset.tab; render(); });
    on('#game-team', 'onchange', (e) => { state.gameTeam = e.target.value; render(); });
    on('#tr-game', 'onchange', (e) => { state.gameId = e.target.value; state.gameTeam = null; render(); });
    on('#tr-team', 'onchange', (e) => { state.gameTeam = e.target.value; render(); });
    on('#tr-type', 'onchange', updateTrackerFields);
    updateTrackerFields();
    on('#tr-add', 'onclick', async () => {
      const type = $('#tr-type').value;
      const g = state.schedule.find((x) => x.gameId === state.gameId);
      const teamId = $('#tr-team').value;
      const body = { type, gameId: state.gameId, teamId, playerId: $('#tr-player').value, quarter: $('#tr-q').value || undefined };
      if ($('#tr-against') && $('#tr-against').value) { body.againstPlayerId = $('#tr-against').value; body.againstTeamId = teamId === g.homeTeamId ? g.awayTeamId : g.homeTeamId; }
      if (type === 'penalty') { body.penaltyType = $('#tr-pentype').value || 'Penalty'; body.yards = Number($('#tr-yards').value || 0); }
      if (type === 'snaps') { body.offSnaps = Number($('#tr-off').value || 0); body.defSnaps = Number($('#tr-def').value || 0); body.stSnaps = Number($('#tr-st').value || 0); }
      try { await api(`/leagues/${state.leagueKey}/tracker`, { method: 'POST', body }); state.seasonCache.clear(); render(); } catch (e) { banner(esc(e.message), 'error'); }
    });
    on('[data-del-event]', 'onclick', async (e) => { await api(`/leagues/${state.leagueKey}/tracker/${e.currentTarget.dataset.delEvent}`, { method: 'DELETE' }); state.seasonCache.clear(); render(); });
    on('[data-del-inj]', 'onclick', async (e) => { await api(`/leagues/${state.leagueKey}/injuries/log/${e.currentTarget.dataset.delInj}`, { method: 'DELETE' }); render(); });
    on('[data-heal]', 'onclick', async (e) => { if (!confirm('Heal this player in the franchise file?')) return; try { await api(`/leagues/${state.leagueKey}/injuries/heal`, { method: 'POST', body: { playerId: e.currentTarget.dataset.heal } }); banner('Healed.', 'ok'); await loadLeague(); } catch (err) { banner(esc(err.message), 'error'); } });
    on('[data-apply-sched]', 'onclick', async (e) => {
      const r = await api(`/leagues/${state.leagueKey}/injuries`);
      const entry = r.log.find((x) => x.id === e.currentTarget.dataset.applySched);
      if (!entry || !confirm(`Write ${entry.plan.player.name}'s ${entry.plan.injury.name} into the franchise file now? A backup is made first.`)) return;
      try { await api(`/leagues/${state.leagueKey}/injuries/apply`, { method: 'POST', body: { ...entry.request, applyMode: 'later' } }); await api(`/leagues/${state.leagueKey}/injuries/log/${entry.id}`, { method: 'DELETE' }); banner('Written to the franchise file.', 'ok'); await loadLeague(); } catch (err) { banner(esc(err.message), 'error'); }
    });
    on('#set-save', 'onclick', async () => { try { await api('/settings', { method: 'POST', body: { port: Number($('#set-port').value) || 3826, schemaDirectory: $('#set-schema').value || null } }); banner('Saved.', 'ok'); await loadStatus(); } catch (e) { banner(esc(e.message), 'error'); } });
  }
  function updateTrackerFields() {
    const sel = $('#tr-type'); if (!sel) return;
    const t = sel.value;
    $('#tr-against-field').classList.toggle('hidden', !['pressure', 'hurry', 'hit', 'sack', 'missedSack'].includes(t));
    $('#tr-pen-field').classList.toggle('hidden', t !== 'penalty');
    $('#tr-snaps-field').classList.toggle('hidden', t !== 'snaps');
  }

  async function openFile() {
    if (window.m26) { const p = await window.m26.pickFranchiseFile(); if (p) await openPath(p); }
    else { state.section = 'connect'; render(); banner('Paste the full path to your CAREER file in the box on the Connect page.', ''); }
  }
  async function openPath(filePath) {
    if (!filePath) return;
    banner('Opening the franchise file… this takes a few seconds.', '');
    try {
      const r = await api('/franchise/open', { method: 'POST', body: { filePath } });
      state.leagueKey = r.leagueKey;
      banner(`Opened ${esc(r.summary.name)}: ${r.summary.counts.teams} teams, ${r.summary.counts.players} players, ${r.summary.counts.played} games played.`, 'ok');
      await loadStatus();
      await loadLeague();
    } catch (e) { banner(`Could not open the file: ${esc(e.message)}`, 'error'); }
  }

  $('#btn-open-file').onclick = openFile;
  $('#btn-refresh').onclick = async () => { banner('Refreshing…'); try { if (state.status.franchiseOpen && state.league && state.league.source === 'franchise') await api('/franchise/refresh', { method: 'POST' }); await loadStatus(); await loadLeague(); banner(''); } catch (e) { banner(esc(e.message), 'error'); } };
  $('#league-select').onchange = async (e) => { state.leagueKey = e.target.value; state.gameId = null; await loadLeague(); };
  $('#stage-select').onchange = (e) => { state.stage = e.target.value; render(); };
  $('#team-select').onchange = (e) => { state.teamId = e.target.value; render(); };
  $$('#nav button').forEach((b) => (b.onclick = () => { state.section = b.dataset.section; render(); }));
  if (window.m26 && window.m26.onMenuOpenFile) window.m26.onMenuOpenFile(openFile);

  // Poll for new exports while on the Connect page.
  setInterval(async () => { if (state.section !== 'connect') return; try { const before = JSON.stringify(state.status.leagues); await loadStatus(); if (JSON.stringify(state.status.leagues) !== before) { if (!state.leagueKey) state.leagueKey = state.status.leagues[0] && state.status.leagues[0].leagueKey; await loadLeague(); } } catch {} }, 8000);

  (async () => {
    try { await loadStatus(); await loadLeague(); } catch (e) { banner(esc(e.message), 'error'); }
  })();
})();
