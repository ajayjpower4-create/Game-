/* FC 26 career pages. app.js owns the shell (sidebar, top bar, settings,
   copy and sortable tables) and hands this module its helpers. */
(() => {
  let H = null;
  const st = { section: 'overview', key: null, status: null, leagueId: null, leadersLeague: '', clubId: null, clubTab: 'overview', playerId: null, matchId: null, edit: null, logComp: '', backTo: null, currency: '€', squad: null, clubs: null, matches: null };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const api = (p, o) => H.api(p, o);
  const K = () => encodeURIComponent(st.key);
  const fmt = (v, d = 0) => (v == null || Number.isNaN(v) ? '—' : typeof v === 'number' ? v.toFixed(d) : esc(v));
  const signed = (v, d = 0) => (v == null ? '—' : `${v > 0 ? '+' : ''}${Number(v).toFixed(d)}`);
  const money = (v) => {
    if (v == null || !Number.isFinite(v)) return '—';
    const a = Math.abs(v);
    const s = v < 0 ? '-' : '';
    if (a >= 1e6) return `${s}${st.currency}${(a / 1e6).toFixed(a >= 1e8 ? 0 : 1)}M`;
    if (a >= 1e3) return `${s}${st.currency}${Math.round(a / 1e3)}K`;
    return `${s}${st.currency}${a}`;
  };
  const wage = (v) => (v == null ? '—' : `${money(v)}/wk`);
  const day = (iso) => (iso ? new Date(iso + 'T00:00:00Z').toLocaleDateString(undefined, { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const ord = (n) => (n ? `${n}${['th', 'st', 'nd', 'rd'][(n % 100 >= 11 && n % 100 <= 13) || n % 10 > 3 ? 0 : n % 10]}` : '—');
  const resPill = (r) => `<span class="pill ${r === 'W' ? 'win' : r === 'L' ? 'loss' : ''}">${esc(r)}</span>`;
  const ratingChip = (v) => (v == null ? '—' : `<span class="fc-rating ${v >= 8 ? 'r-great' : v >= 7 ? 'r-good' : v >= 6 ? 'r-ok' : 'r-poor'}">${Number(v).toFixed(1)}</span>`);
  const pLink = (id, name) => `<a href="#" class="plink" data-fc-player="${esc(id)}">${esc(name)}</a>`;
  const cLink = (id, name) => (id ? `<a href="#" data-fc-club="${esc(id)}">${esc(name)}</a>` : esc(name || '—'));
  const card = (title, body, extra = '') => `<div class="card ${extra}"><h3>${esc(title)}</h3>${body}</div>`;
  const stat = (v, l) => `<div class="stat"><div class="v">${v}</div><div class="l">${esc(l)}</div></div>`;
  const empty = (msg) => `<div class="empty">${msg}</div>`;
  const leaderList = (rows, value, { sub = (r) => `${r.position || ''}${r.club ? ' · ' + r.club : ''}`, n = 10 } = {}) => (rows && rows.length
    ? rows.slice(0, n).map((r, i) => `<div class="leader"><div class="who">${i + 1}. ${pLink(r.playerId, r.name)}<span>${esc(sub(r))}</span></div><div class="n">${value(r)}</div></div>`).join('')
    : '<div class="muted">Nobody yet.</div>');

  // ---------- status and the career picker
  async function loadStatus() {
    st.status = await api('/fc/status');
    const careers = st.status.careers || [];
    if (!st.key || !careers.some((c) => c.careerKey === st.key)) st.key = careers[0] ? careers[0].careerKey : null;
    const sel = $('#fc-career-select');
    if (sel) {
      sel.innerHTML = careers.map((c) => `<option value="${esc(c.careerKey)}">${esc(c.club || c.name)}${c.seasonLabel ? ` · ${esc(c.seasonLabel)}` : ''} (${esc(c.name)})</option>`).join('') || '<option value="">No career yet</option>';
      sel.value = st.key || '';
    }
  }

  async function openSave(filePath) {
    if (!filePath) return;
    H.banner('Reading the FC 26 save…', '');
    try {
      const r = await api('/fc/open', { method: 'POST', body: { filePath } });
      st.key = r.careerKey;
      st.squad = null; st.clubs = null; st.clubId = null; st.playerId = null; st.matchId = null;
      const s = r.summary;
      H.banner(`Opened ${esc(s.club || 'the save')}${s.season ? ` · ${esc(s.season)}` : ''}: ${s.counts.clubs} clubs, ${s.counts.players} players, ${s.counts.ratings} match ratings.${s.warnings.length ? ' ' + s.warnings.map(esc).join(' ') : ''}`, 'ok');
      await loadStatus();
      st.section = s.kind === 'career' ? 'overview' : 'tables';
      H.render();
    } catch (e) {
      H.banner(`<b>Could not read that file.</b> ${esc(e.message)}${e.details ? `<details class="file-details"><summary>File details</summary><pre class="mono">${esc(e.details)}</pre><button class="small" id="fc-copy-details">Copy details</button></details>` : ''}`, 'error');
      const b = $('#fc-copy-details');
      if (b) b.onclick = async () => H.copied(b, await H.copyText(`Could not read that file: ${e.message}\n\n${e.details}`));
    }
  }
  async function pickFile() {
    if (window.m26 && window.m26.pickFcFile) { const p = await window.m26.pickFcFile(); if (p) await openSave(p); }
    else if (window.m26 && window.m26.pickFranchiseFile) { const p = await window.m26.pickFranchiseFile(); if (p) await openSave(p); }
    else { st.section = 'connect'; H.render(); H.banner('Paste the full path to your FC 26 save in the box on the Connect page.', ''); }
  }

  // ---------- Connect
  async function connect() {
    await loadStatus();
    const f = st.status.found || { files: [], searched: [] };
    const files = f.files.length
      ? `<ul class="list">${f.files.map((x) => `<li><span><b>${esc(x.name)}</b> <span class="muted">· ${x.kind === 'career' ? 'Career save' : 'Squads file'} · saved ${esc(new Date(x.modified).toLocaleString())} · ${(x.size / 1048576).toFixed(1)} MB</span><br><span class="small-note mono">${esc(x.path)}</span></span><button class="small blue" data-fc-open="${esc(x.path)}">Open</button></li>`).join('')}</ul>`
      : `<div class="muted">No FC 26 saves found automatically.${f.searched.length ? ` Looked in:<br><span class="mono small">${f.searched.map(esc).join('<br>')}</span>` : ''}</div>`;
    const careers = (st.status.careers || []).length
      ? `<ul class="list">${st.status.careers.map((c) => `<li><span><b>${esc(c.club || c.name)}</b> <span class="muted">· ${esc(c.seasonLabel || '')}${c.date ? ` · in-game date ${esc(day(c.date))}` : ''}</span><br><span class="small-note mono">${esc(c.filePath)}</span></span><span><button class="small" data-fc-switch="${esc(c.careerKey)}">Show</button> <button class="small" data-fc-reopen="${esc(c.filePath)}">Re-read</button> <button class="small" data-fc-forget="${esc(c.careerKey)}" title="Remove from this list and delete its Match Log">Forget</button></span></li>`).join('')}</ul>`
      : '<div class="muted">None yet.</div>';
    return `<h2>Connect your FC 26 career</h2>
      <p class="muted">Open a Career Mode save and every club, league table, player, match rating, contract and budget in it shows up here. The tool only reads FC 26 saves; it never changes them.</p>
      <div class="grid cols-2">
        ${card('Saves on this PC', `${files}<div class="toolbar">${!window.m26 ? '<input type="text" id="fc-path" placeholder="Paste the full path to the save" style="min-width:320px"><button id="fc-open-path">Open path</button>' : ''}<button class="primary" id="fc-browse">Browse for a save</button></div>`)}
        ${card('Careers you have opened', careers)}
      </div>
      <div class="grid cols-2">
        ${card('Where FC 26 keeps your saves', `<ul class="tight"><li><span class="mono">Documents\\FC 26\\settings</span>, or</li><li><span class="mono">%LOCALAPPDATA%\\EA SPORTS FC 26\\settings</span></li><li>If Documents is in OneDrive, it is under <span class="mono">OneDrive\\Documents</span>.</li><li>Career saves have <b>Career</b> in the name. Squad files start with <b>Squads</b>.</li><li>FC writes the save when you save or it autosaves, so save in game before you open or re-read it here.</li></ul>`)}
        ${card('What comes from where', `<p><b>From your save:</b> league tables with home and away splits, every club and squad, player ratings and potential, league goals, appearances and cards, every match rating with minutes, contracts, wages and squad roles, loans, suspensions, transfer and wage budgets, transfer fees, fixtures, Team of the Week picks, last season's goals, assists and clean sheets, and your manager's history.</p><p><b>From the Match Log:</b> FC keeps scores, scorers, assists, cards, injuries and match stats only while the game is running. Log your matches (the save fills in who played, minutes and ratings) and the tool works out goals and assists per 90, clean sheets, when goals come, comebacks, leads lost, late winners, xG against goals, streaks, partnerships and injuries.</p>`)}
      </div>`;
  }

  // ---------- Overview
  async function overview() {
    const r = await api(`/fc/${K()}/overview`);
    const o = r.overview;
    if (o.manager && o.manager.currency) st.currency = o.manager.currency;
    if (o.kind !== 'career' || !o.club) {
      return `<h2>${esc(r.details.file)}</h2><p class="muted">This is a squads file, not a career save, so there is no club of yours, no season and no budgets. League tables, clubs and players are all here.</p><div class="stat-row card">${stat(o.counts.leagues, 'leagues')}${stat(o.counts.clubs, 'clubs')}${stat(o.counts.players, 'players')}</div>`;
    }
    const c = o.club;
    const s = c.standing;
    const m = o.manager;
    const head = `<div class="card fc-hero"><div><div class="fc-club">${esc(c.club.name)}</div><div class="muted">${esc(c.club.league || '')} · ${esc(o.seasonLabel || '')} · in-game date ${esc(day(o.date))}${m && m.name ? ` · manager ${esc(m.name)}` : ''}</div></div>
      <div class="stat-row">${s ? `${stat(`${ord(s.position)}<span class="muted small"> of ${s.of}</span>`, 'league position')}${stat(s.played, 'played')}${stat(`${s.won}-${s.drawn}-${s.lost}`, 'won-drawn-lost')}${stat(`${s.gf}:${s.ga}`, 'goals')}${stat(s.points, 'points')}${stat(fmt(s.ppg, 2), 'points per game')}` : ''}${stat(fmt(c.xiOvr, 1), 'starting XI OVR')}${stat(fmt(c.averageAge, 1), 'average age')}</div></div>`;
    const budget = m && m.budget ? card('Money', `<div class="leader"><div class="who">Transfer budget</div><div class="n">${money(m.budget.transfer)}</div></div><div class="leader"><div class="who">Wage budget<span>per week</span></div><div class="n">${money(m.budget.wage)}</div></div><div class="leader"><div class="who">Squad wages<span>per week, from contracts</span></div><div class="n">${money(c.wages)}</div></div><div class="leader"><div class="who">Start of season<span>transfer / wage budget</span></div><div class="n">${money(m.budget.startTransfer)} / ${money(m.budget.startWage)}</div></div>${m.boardConfidence != null ? `<div class="leader"><div class="who">Board confidence</div><div class="n">${m.boardConfidence}%</div></div><div class="fc-bar"><span style="width:${Math.max(0, Math.min(100, m.boardConfidence))}%"></span></div>` : ''}`) : '';
    const next = card('Next fixtures', o.next.length ? `<ul class="list">${o.next.map((f) => `<li><span>${esc(day(f.date))}${f.time ? ` ${esc(f.time)}` : ''} · <b>${f.home ? 'vs' : '@'} ${cLink(f.awayId === c.club.clubId ? f.homeId : f.awayId, f.opponent)}</b> <span class="muted">${esc(f.competition)}${f.opponentOvr ? ` · OVR ${f.opponentOvr}` : ''}</span></span></li>`).join('')}</ul>` : '<div class="muted">The save has no upcoming fixtures for your club.</div>');
    const recent = card('Last matches the save rated', o.recent.length ? `<ul class="list">${o.recent.map((x) => `<li><span>${esc(day(x.date))}${x.opponent ? ` · ${x.home ? 'vs' : '@'} ${esc(x.opponent)}` : ''} <span class="muted">${esc(x.competition || '')}</span><br><span class="small-note">Best: ${x.best ? `${esc(x.best.name)} ${x.best.rating.toFixed(1)}` : '—'}</span></span><span>team ${ratingChip(x.teamRating)}</span></li>`).join('')}</ul>` : '<div class="muted">No rated matches this season yet.</div>');
    const lead = c.leaders;
    const leadersHtml = `<div class="grid cols-3">${card('Top scorers (league)', leaderList(lead.goldenBoot, (x) => x.leagueGoals, { n: 5, sub: (x) => `${x.position || ''} · ${x.leagueApps} apps` }))}${card(`Best average rating (${lead.minMatches}+ matches)`, leaderList(lead.bestRated, (x) => ratingChip(x.avgRating), { n: 5, sub: (x) => `${x.position || ''} · ${x.matches} matches` }))}${card('In form (last 5)', leaderList(lead.inForm, (x) => ratingChip(x.last5), { n: 5 }))}</div>`;
    const alerts = [];
    for (const p of c.suspended) alerts.push(`${pLink(p.playerId, p.name)} suspended for ${p.suspension.games} match${p.suspension.games === 1 ? '' : 'es'}${p.suspension.until ? ` (until ${esc(day(p.suspension.until))})` : ''}.`);
    for (const p of c.loanedIn) alerts.push(`${pLink(p.playerId, p.name)} is on loan from ${esc(p.loan.from)} until ${esc(day(p.loan.until))}${p.loan.toBuy ? ' with an option to buy' : ''}.`);
    for (const p of c.contractsEnding.slice(0, 6)) alerts.push(`${pLink(p.playerId, p.name)}'s contract runs out in ${p.contractUntil}.`);
    const log = r.log ? card('Match Log', `<div class="stat-row">${stat(`${r.log.stats.record.won}-${r.log.stats.record.drawn}-${r.log.stats.record.lost}`, 'logged W-D-L')}${stat(`${r.log.stats.record.gf}:${r.log.stats.record.ga}`, 'goals')}${stat(r.log.stats.team.cleanSheets, 'clean sheets')}</div><div class="fc-form">${r.log.stats.form.map((f) => `${resPill(f.result)}`).join(' ')}</div><div class="small-note">${r.log.matches} matches logged. See <a href="#" data-fc-section="advanced">Advanced Stats</a>.</div>`) : card('Match Log', '<div class="muted">No matches logged yet. Log a match after you play it and the scorers, assists, clean sheets, injuries and match stats get counted.</div><div class="toolbar"><button class="primary" data-fc-new-match="1">Log a match</button></div>');
    const mgr = m ? card('Manager', `${m.bigWin ? `<div class="leader"><div class="who">Biggest win<span>${esc(day(m.bigWin.date))}</span></div><div class="n">${m.bigWin.us}-${m.bigWin.them} vs ${esc(m.bigWin.opponent)}</div></div>` : ''}${m.bigLoss ? `<div class="leader"><div class="who">Heaviest defeat<span>${esc(day(m.bigLoss.date))}</span></div><div class="n">${m.bigLoss.us}-${m.bigLoss.them} vs ${esc(m.bigLoss.opponent)}</div></div>` : ''}<div class="leader"><div class="who">Career record<span>${m.history.length} finished season${m.history.length === 1 ? '' : 's'}</span></div><div class="n">${m.totals.won}-${m.totals.drawn}-${m.totals.lost}</div></div><div class="leader"><div class="who">Trophies</div><div class="n">${m.totals.trophies}</div></div>`) : '';
    const d = r.details || {};
    const found = `<details class="file-details no-copy"><summary>What the tool read from this save</summary><pre class="mono" id="fc-found">${esc([`File: ${r.filePath}`, `Saved: ${r.savedAt}`, `Size: ${d.size} bytes, header ${d.header}`, `Databases: ${d.databases}${d.compressed ? ' (compressed)' : ''}`, ...(d.databaseList || []).map((x) => `  #${x.index} at ${x.offset}: ${x.size} bytes, ${x.tables} tables`), `Rows: ${Object.entries(d.tables || {}).map(([k, v]) => `${k} ${v}`).join(', ')}`, `Read: ${Object.entries(d.counts || {}).map(([k, v]) => `${v} ${k}`).join(', ')}`].join('\n'))}</pre><button class="small" data-copy-block="fc-found">Copy details</button></details>`;
    return `${head}${r.overview.warnings.length ? `<div class="banner">${r.overview.warnings.map(esc).join('<br>')}</div>` : ''}
      <div class="grid cols-3">${next}${recent}${budget}</div>
      ${leadersHtml}
      <div class="grid cols-3">${card('Heads up', alerts.length ? `<ul class="tight">${alerts.map((a) => `<li>${a}</li>`).join('')}</ul>` : '<div class="muted">No suspensions, loans or contracts running out.</div>')}${log}${mgr}</div>${found}`;
  }

  // ---------- League tables
  async function tables() {
    const ls = await api(`/fc/${K()}/leagues`);
    if (!ls.leagues.length) return empty('No league tables in this save.');
    if (!st.leagueId || !ls.leagues.some((l) => l.leagueId === st.leagueId)) st.leagueId = ls.leagues[0].leagueId;
    const t = (await api(`/fc/${K()}/standings/${st.leagueId}`)).table;
    const rows = t.rows.map((r) => ({ ...r, homeText: `${r.home.won}-${r.home.drawn}-${r.home.lost}`, awayText: `${r.away.won}-${r.away.drawn}-${r.away.lost}` }));
    const sel = `<label class="field"><span>League</span><select id="fc-league">${ls.leagues.map((l) => `<option value="${l.leagueId}" ${l.leagueId === st.leagueId ? 'selected' : ''}>${esc(l.name)}${l.yours ? ' (yours)' : ''}</option>`).join('')}</select></label>`;
    const tbl = H.table('fc-table', rows, [
      { key: 'position', label: '#', render: (r) => `${r.position}${r.champion ? ' 🏆' : ''}` },
      { key: 'club', label: 'Club', left: true, render: (r) => `${r.isUser ? '<b>' : ''}${cLink(r.clubId, r.club)}${r.isUser ? '</b>' : ''}` },
      { key: 'played', label: 'P' }, { key: 'won', label: 'W' }, { key: 'drawn', label: 'D' }, { key: 'lost', label: 'L' },
      { key: 'gf', label: 'GF' }, { key: 'ga', label: 'GA' }, { key: 'gd', label: 'GD', render: (r) => signed(r.gd) }, { key: 'points', label: 'Pts', render: (r) => `<b>${r.points}</b>` },
      { key: 'ppg', label: 'PPG', d: 2 }, { key: 'winPct', label: 'Win %' }, { key: 'gfPerGame', label: 'GF/g', d: 2 }, { key: 'gaPerGame', label: 'GA/g', d: 2 },
      { key: 'homePoints', label: 'Home', render: (r) => `${r.homeText} <span class="muted">(${r.homePoints})</span>` }, { key: 'awayPoints', label: 'Away', render: (r) => `${r.awayText} <span class="muted">(${r.awayPoints})</span>` },
      { key: 'ovr', label: 'OVR' }, { key: 'lastSeasonPosition', label: 'Last season', render: (r) => (r.lastSeasonPosition ? `${ord(r.lastSeasonPosition)}${r.moved ? ` <span class="${r.moved > 0 ? 'won' : 'lost'}">${r.moved > 0 ? '▲' : '▼'}${Math.abs(r.moved)}</span>` : ''}` : '—') },
    ], { defaultSort: 'position', maxHeight: false });
    const best = (key, dir = -1) => [...rows].filter((r) => r.played).sort((a, b) => dir * (a[key] - b[key]))[0];
    const facts = rows.some((r) => r.played) ? `<div class="grid cols-4">${[['Best attack', best('gf'), (r) => `${r.gf} goals`], ['Best defence', best('ga', 1), (r) => `${r.ga} conceded`], ['Best at home', best('homePoints'), (r) => `${r.homePoints} pts`], ['Best away', best('awayPoints'), (r) => `${r.awayPoints} pts`]].map(([title, r, v]) => card(title, r ? `<div class="big">${cLink(r.clubId, r.club)}</div><div class="muted">${v(r)}</div>` : '—')).join('')}</div>` : '';
    return `<h2>${esc(t.league)}</h2><div class="toolbar">${sel}</div>${facts}${tbl}<p class="small-note">Straight from the save. Home and away show won-drawn-lost with the points in brackets. Click a column to sort.</p>`;
  }

  // ---------- Clubs
  async function clubs() {
    if (st.clubId) return clubPage();
    const r = await api(`/fc/${K()}/clubs`);
    return `<h2>Clubs</h2><p class="muted">Every club in every league in the save. Pick one for its squad, stats, money and transfers.</p>${r.leagues.map((l) => `<h3>${esc(l.name)}</h3><div class="fc-tiles">${l.clubs.map((x) => `<button class="fc-tile ${x.clubId === r.userClubId ? 'mine' : ''}" data-fc-club="${x.clubId}"><b>${esc(x.name)}</b><span>${ord(x.position)} · ${x.points} pts${x.ovr ? ` · OVR ${x.ovr}` : ''}</span></button>`).join('')}</div>`).join('')}`;
  }

  function squadTable(id, players) {
    return H.table(id, players, [
      { key: 'jersey', label: '#' },
      { key: 'name', label: 'Player', left: true, render: (p) => `${pLink(p.playerId, p.name)}${p.youth ? ' <span class="pill">academy</span>' : ''}${p.loan ? ' <span class="pill">loan</span>' : ''}${p.suspension ? ' <span class="pill loss">suspended</span>' : ''}` },
      { key: 'position', label: 'Pos', left: true }, { key: 'age', label: 'Age' }, { key: 'ovr', label: 'OVR' }, { key: 'pot', label: 'POT' },
      { key: 'ovrChange', label: '±OVR', render: (p) => (p.ovrChange ? `<span class="${p.ovrChange > 0 ? 'won' : 'lost'}">${signed(p.ovrChange)}</span>` : '—') },
      { key: 'leagueApps', label: 'Lg apps' }, { key: 'leagueGoals', label: 'Lg goals' }, { key: 'matches', label: 'Rated' }, { key: 'minutes', label: 'Mins' },
      { key: 'avgRating', label: 'Avg', render: (p) => ratingChip(p.avgRating) }, { key: 'last5', label: 'Last 5', render: (p) => ratingChip(p.last5) },
      { key: 'yellows', label: 'YC' }, { key: 'reds', label: 'RC' }, { key: 'role', label: 'Role', left: true }, { key: 'wage', label: 'Wage', render: (p) => wage(p.wage) }, { key: 'contractUntil', label: 'Until' },
    ], { defaultSort: 'ovr', maxHeight: false });
  }

  async function clubPage() {
    const r = await api(`/fc/${K()}/clubs/${st.clubId}`);
    const p = r.profile;
    const c = p.club;
    const s = p.standing;
    const tabs = [['overview', 'Overview'], ['squad', 'Squad'], ['stats', 'Stats'], ['money', 'Contracts & money'], ['transfers', 'Transfers'], ['fixtures', 'Fixtures'], ...(r.log ? [['log', 'Match Log']] : [])];
    if (!tabs.some((t) => t[0] === st.clubTab)) st.clubTab = 'overview';
    const head = `<div class="toolbar"><button id="fc-club-back">← All clubs</button><button class="small" data-copy-block="fc-club-body">Copy as text</button></div>
      <div class="card fc-hero"><div><div class="fc-club">${esc(c.name)}</div><div class="muted">${esc(c.league || '')}${c.rival ? ` · rival ${esc(c.rival)}` : ''}${c.captain ? ` · captain ${esc(c.captain)}` : ''}</div></div>
      <div class="stat-row">${s ? `${stat(`${ord(s.position)}<span class="muted small"> of ${s.of}</span>`, 'position')}${stat(`${s.won}-${s.drawn}-${s.lost}`, 'W-D-L')}${stat(`${s.gf}:${s.ga}`, 'goals')}${stat(s.points, 'points')}` : ''}${stat(c.ovr || '—', 'club OVR')}${stat(`${c.att || '—'}/${c.mid || '—'}/${c.def || '—'}`, 'att / mid / def')}${stat(p.squadSize, 'players')}${stat(fmt(p.averageAge, 1), 'avg age')}</div></div>
      <div class="tabs">${tabs.map(([k, l]) => `<button data-fc-club-tab="${k}" class="${st.clubTab === k ? 'active' : ''}">${l}</button>`).join('')}</div>`;
    const all = p.groups.flatMap((g) => g.players);
    let body = '';
    if (st.clubTab === 'overview') {
      const xi = p.xi.length ? `<ul class="list">${p.xi.map((x) => `<li><span><b>${esc(x.slot)}</b> ${pLink(x.playerId, x.name)} <span class="muted">${x.age ?? ''}</span></span><span>${x.ovr}</span></li>`).join('')}</ul><div class="small-note">Average OVR ${fmt(p.xiOvr, 1)}</div>` : '<div class="muted">The save has no starting XI for this club.</div>';
      const recent = r.rated.length ? `<ul class="list">${r.rated.slice(-6).reverse().map((x) => `<li><span>${esc(day(x.date))}${x.opponent ? ` · ${x.home ? 'vs' : '@'} ${esc(x.opponent)}` : ''}<br><span class="small-note">Best: ${x.best ? `${esc(x.best.name)} ${x.best.rating.toFixed(1)}` : '—'}</span></span><span>${ratingChip(x.teamRating)}</span></li>`).join('')}</ul>` : '<div class="muted">No rated matches this season.</div>';
      body = `<div class="grid cols-3">${card('Starting XI in the save', xi)}${card('Top scorers (league)', leaderList(p.leaders.goldenBoot, (x) => x.leagueGoals, { n: 6, sub: (x) => `${x.position || ''} · ${x.leagueApps} apps` }))}${card('Matches the save rated', recent)}</div>
        <div class="grid cols-3">${card('Best average rating', leaderList(p.leaders.bestRated, (x) => ratingChip(x.avgRating), { n: 6, sub: (x) => `${x.matches} matches` }))}${card('Most minutes', leaderList(p.leaders.mostMinutes, (x) => x.minutes, { n: 6 }))}${card('Position groups', p.groups.map((g) => `<div class="leader"><div class="who">${esc(g.label)}<span>${g.players.length} players</span></div><div class="n">${fmt(g.players.reduce((a, x) => a + (x.ovr || 0), 0) / g.players.length, 1)} OVR</div></div>`).join(''))}</div>`;
    } else if (st.clubTab === 'squad') {
      body = `${squadTable('fc-squad', all)}<p class="small-note">League goals, appearances and cards are this season's league numbers from the save. Rated, minutes and ratings count every match the save rated this season (all competitions).</p>`;
    } else if (st.clubTab === 'stats') {
      const L = p.leaders;
      body = `<div class="grid cols-3">${card('In form (last 5)', leaderList(L.inForm, (x) => ratingChip(x.last5)))}${card('Rising (last 5 vs season)', leaderList(L.risingForm, (x) => signed(x.trend, 2)))}${card('8.0+ ratings', leaderList(L.eightPlus, (x) => x.eightPlus))}${card('Best single games', leaderList(L.bestSingle, (x) => ratingChip(x.matchRating), { sub: (x) => `${day(x.date)}${x.matchMinutes != null ? ` · ${x.matchMinutes} min` : ''}` }))}${card('Most consistent', leaderList(L.mostConsistent, (x) => `±${fmt(x.consistency, 2)}`, { sub: (x) => `avg ${fmt(x.avgRating, 2)}` }))}${card('Discipline', leaderList(L.discipline, (x) => `${x.yellows}Y ${x.reds}R`))}${card('OVR risers', leaderList(L.ovrRisers, (x) => signed(x.ovrChange)))}${card('Biggest potential (21 and under)', leaderList(L.wonderkids, (x) => `${x.ovr} → ${x.pot}`, { sub: (x) => `${x.position || ''} · age ${x.age}` }))}${card('Goals per league game', leaderList(L.goalsPerGame, (x) => fmt(x.goalsPerGame, 2)))}</div>`;
    } else if (st.clubTab === 'money') {
      const earners = [...all].filter((x) => x.wage).sort((a, b) => b.wage - a.wage);
      body = `<div class="stat-row card">${stat(money(p.wages), 'weekly wages')}${p.wageBudget != null ? stat(money(p.wageBudget), 'weekly wage budget') : ''}${p.transferBudget != null ? stat(money(p.transferBudget), 'transfer budget') : ''}${stat(earners.length ? money(Math.round(p.wages / earners.length)) : '—', 'average wage')}</div>
        ${H.table('fc-wages', earners, [{ key: 'name', label: 'Player', left: true, render: (x) => pLink(x.playerId, x.name) }, { key: 'position', label: 'Pos', left: true }, { key: 'age', label: 'Age' }, { key: 'ovr', label: 'OVR' }, { key: 'role', label: 'Role', left: true }, { key: 'wage', label: 'Wage', render: (x) => wage(x.wage) }, { key: 'contractUntil', label: 'Contract until' }], { defaultSort: 'wage', maxHeight: false })}
        <div class="grid cols-2">${card('Contracts running out', p.contractsEnding.length ? `<ul class="list">${p.contractsEnding.map((x) => `<li><span>${pLink(x.playerId, x.name)} <span class="muted">${esc(x.position || '')} · ${x.ovr}</span></span><span>${x.contractUntil}</span></li>`).join('')}</ul>` : '<div class="muted">None this year or next.</div>')}${card('Loans', `${p.loanedIn.map((x) => `<div class="leader"><div class="who">${pLink(x.playerId, x.name)}<span>in from ${esc(x.loan.from)}</span></div><div class="n">until ${esc(day(x.loan.until))}</div></div>`).join('')}${p.loanedOut.map((x) => `<div class="leader"><div class="who">${pLink(x.playerId, x.name)}<span>out to ${esc(x.club || '?')}</span></div><div class="n">until ${esc(day(x.loan.until))}</div></div>`).join('') || (!p.loanedIn.length ? '<div class="muted">No loans.</div>' : '')}`)}</div>`;
    } else if (st.clubTab === 'transfers') {
      const list = (rows, dir) => (rows.length ? `<ul class="list">${rows.map((t) => `<li><span>${pLink(t.playerId, t.name)} <span class="muted">${dir === 'in' ? `from ${esc(t.from)}` : `to ${esc(t.to)}`}</span></span><span>${money(t.fee)}</span></li>`).join('')}</ul>` : '<div class="muted">None in the save.</div>');
      body = `<div class="stat-row card">${stat(money(p.transfersIn.reduce((a, t) => a + (t.fee || 0), 0)), 'spent')}${stat(money(p.transfersOut.reduce((a, t) => a + (t.fee || 0), 0)), 'received')}${stat(money(p.netSpend), 'net spend')}</div><div class="grid cols-2">${card('Signed', list(p.transfersIn, 'in'))}${card('Sold', list(p.transfersOut, 'out'))}</div>`;
    } else if (st.clubTab === 'fixtures') {
      body = p.fixtures.length ? H.table('fc-club-fixtures', p.fixtures, [{ key: 'date', label: 'Date', left: true, render: (f) => `${esc(day(f.date))}${f.time ? ` ${esc(f.time)}` : ''}` }, { key: 'competition', label: 'Competition', left: true }, { key: 'home', label: 'H/A', render: (f) => (f.home ? 'H' : 'A') }, { key: 'opponent', label: 'Opponent', left: true, render: (f) => cLink(f.opponentId, f.opponent) }, { key: 'past', label: '', render: (f) => (f.past ? 'played' : 'upcoming') }], { defaultSort: 'date', maxHeight: false }) : empty('The save has no fixtures for this club.');
    } else if (st.clubTab === 'log') {
      body = advancedBody(r.log);
    }
    return `${head}<div id="fc-club-body">${body}</div>`;
  }

  // ---------- Player
  async function player() {
    const r = await api(`/fc/${K()}/players/${st.playerId}`);
    const p = r.profile.player;
    const s = r.profile.season;
    const c = r.profile.contract;
    const lg = r.logged;
    const back = st.backTo ? `<button id="fc-player-back">← Back</button>` : '';
    const head = `<div class="toolbar">${back}<button class="small" data-copy-block="fc-player-body">Copy as text</button></div><div id="fc-player-body">
      <div class="card fc-hero"><div><div class="fc-club">${esc(p.name)}</div><div class="muted">${esc(p.fullName && p.fullName !== p.name ? p.fullName + ' · ' : '')}${esc(p.positions.join(', '))} · age ${p.age ?? '—'} · ${esc(p.nation || '')}${p.club ? ` · ${cLink(p.clubId, p.club)}` : ''}${p.jersey ? ` · #${p.jersey}` : ''}${p.nationalTeam ? ` · plays for ${esc(p.nationalTeam)}` : ''}</div></div>
      <div class="stat-row">${stat(p.ovr, 'OVR')}${stat(p.pot, 'potential')}${p.ovrChange ? stat(signed(p.ovrChange), 'OVR change') : ''}${stat(`${p.skillMoves || '—'}★ / ${p.weakFoot || '—'}★`, 'skills / weak foot')}${stat(esc(p.foot), 'foot')}${stat(p.height ? `${p.height} cm` : '—', 'height')}</div></div>`;
    const seasonCard = card('This season (from the save)', `<div class="stat-row">${stat(p.leagueGoals, 'league goals')}${stat(p.leagueApps, 'league apps')}${stat(s ? s.matches : 0, 'rated matches')}${stat(s && s.minutes != null ? s.minutes : '—', 'minutes')}${stat(s ? ratingChip(s.avgRating) : '—', 'avg rating')}${stat(s ? ratingChip(s.last5) : '—', 'last 5')}${stat(`${p.yellows}/${p.reds}`, 'yellow / red')}</div>${s ? `<div class="small-note">Best ${s.best.toFixed(1)}, worst ${s.worst.toFixed(1)}, ${s.eightPlus} games of 8.0+, ${s.underSix} under 6.0${s.consistency != null ? `, spread ±${s.consistency}` : ''}${s.leagueGoalsPer90 != null ? `, ${s.leagueGoalsPer90} league goals per 90` : ''}.</div>` : ''}`);
    const logCard = lg ? card('From your Match Log', `<div class="stat-row">${stat(lg.apps, 'apps')}${stat(lg.goals, 'goals')}${stat(lg.assists, 'assists')}${stat(fmt(lg.gaPer90, 2), 'G+A per 90')}${stat(lg.minutesPerGA ?? '—', 'mins per G+A')}${stat(lg.motm, 'man of the match')}${p.group === 'GK' || p.group === 'DEF' ? stat(lg.cleanSheets, 'clean sheets') : ''}${stat(lg.record, 'W-D-L when playing')}</div><div class="small-note">${lg.penalties} penalties, ${lg.headers} headers, ${lg.freeKicks} free kicks, ${lg.braces} braces, ${lg.hatTricks} hat-tricks, ${lg.shareOfGoals ?? 0}% of the team's logged goals.</div>`) : '';
    const contract = card('Contract', c ? `<div class="leader"><div class="who">Wage</div><div class="n">${wage(c.wage)}</div></div><div class="leader"><div class="who">Squad role</div><div class="n">${esc(c.role || '—')}</div></div><div class="leader"><div class="who">Signed<span>${c.months ? `${c.months} months` : ''}</span></div><div class="n">${esc(day(c.signed))}</div></div><div class="leader"><div class="who">Runs until</div><div class="n">${p.contractUntil || '—'}</div></div>${c.signOnBonus ? `<div class="leader"><div class="who">Signing bonus</div><div class="n">${money(c.signOnBonus)}</div></div>` : ''}` : `<div class="leader"><div class="who">Runs until</div><div class="n">${p.contractUntil || '—'}</div></div><div class="small-note">The save only keeps full contract terms for your own players.</div>`);
    const recent = r.profile.ratingLog.filter((x) => x.thisSeason).slice(0, 20).reverse();
    const chart = recent.length ? `<div class="fc-spark">${recent.map((x) => `<span title="${esc(day(x.date))}${x.opponent ? ' vs ' + esc(x.opponent) : ''}: ${x.rating.toFixed(1)}" class="${x.rating >= 8 ? 'r-great' : x.rating >= 7 ? 'r-good' : x.rating >= 6 ? 'r-ok' : 'r-poor'}" style="height:${Math.max(6, (x.rating - 3) * 14)}px"></span>`).join('')}</div>` : '';
    const ratingTable = r.profile.ratingLog.length ? H.table('fc-rating-log', r.profile.ratingLog, [{ key: 'date', label: 'Date', left: true, render: (x) => esc(day(x.date)) }, { key: 'opponent', label: 'Opponent', left: true, render: (x) => (x.opponent ? `${x.home ? 'vs' : '@'} ${esc(x.opponent)}` : '—') }, { key: 'competition', label: 'Competition', left: true }, { key: 'position', label: 'Pos', left: true }, { key: 'minutes', label: 'Mins' }, { key: 'rating', label: 'Rating', render: (x) => ratingChip(x.rating) }], { defaultSort: 'date', maxHeight: true }) : '<div class="muted">No match ratings in the save.</div>';
    const attrs = r.profile.attributes.length ? `<div class="grid cols-4">${r.profile.attributes.map((g) => card(`${g.group} ${g.average ?? ''}`, g.values.map((v) => `<div class="leader"><div class="who">${esc(v.key.replace(/^gk/, 'GK ').replace(/([a-z])([A-Z])/g, '$1 $2'))}</div><div class="n">${v.value}</div></div>`).join(''))).join('')}</div>` : '';
    const last = r.profile.lastSeason.length ? H.table('fc-last-season', r.profile.lastSeason, [{ key: 'competition', label: 'Competition', left: true }, { key: 'apps', label: 'Apps' }, { key: 'goals', label: 'Goals' }, { key: 'assists', label: 'Assists' }, { key: 'cleanSheets', label: 'Clean sheets' }, { key: 'yellows', label: 'YC' }, { key: 'reds', label: 'RC' }], { defaultSort: 'apps', maxHeight: false }) : '<div class="muted">Not in the save.</div>';
    const extras = [];
    if (r.profile.teamOfWeek.length) extras.push(`Team of the Week: ${r.profile.teamOfWeek.reduce((a, t) => a + t.weeksWon, 0)} times (best rating ${Math.max(...r.profile.teamOfWeek.map((t) => t.rating)).toFixed(1)}).`);
    if (r.profile.awards.length) extras.push(`${r.profile.awards.reduce((a, x) => a + x.count, 0)} career awards recorded in the save.`);
    for (const t of r.profile.transfers) extras.push(`Moved from ${esc(t.from)} to ${esc(t.to)} for ${money(t.fee)}.`);
    if (p.loan) extras.push(`On loan from ${esc(p.loan.from)} until ${esc(day(p.loan.until))}${p.loan.toBuy ? ', with an option to buy' : ''}.`);
    if (p.suspension) extras.push(`Suspended for ${p.suspension.games} match${p.suspension.games === 1 ? '' : 'es'}.`);
    for (const i of r.injuries) extras.push(`Injured ${esc(day(i.date))} vs ${esc(i.opponent)}: ${esc(i.injury)}${i.weeks ? `, ${i.weeks} weeks` : ''}${i.back ? ` (back ${esc(day(i.back))})` : ''}${i.out ? ' <span class="pill loss">out</span>' : ''}.`);
    const rename = `<div class="toolbar no-copy"><label class="field"><span>${p.nameSource === 'none' ? 'The save has no name for this player. Name him' : 'Show this player as'}</span><input type="text" id="fc-rename" value="${p.nameSource === 'you' ? esc(p.name) : ''}" placeholder="${esc(p.name)}"></label><button class="small" id="fc-rename-save">Save name</button></div>`;
    return `${head}<div class="grid cols-2">${seasonCard}${contract}</div>${logCard}${card('Match ratings', `${chart}${ratingTable}`)}${extras.length ? card('Notes', `<ul class="tight">${extras.map((x) => `<li>${x}</li>`).join('')}</ul>`) : ''}${card('Last season', last)}${attrs}${rename}</div>`;
  }

  // ---------- Player stats (leaderboards)
  async function players() {
    const ls = await api(`/fc/${K()}/leagues`);
    const q = st.leadersLeague ? `?leagueId=${st.leadersLeague}&limit=10` : '?limit=10';
    const L = (await api(`/fc/${K()}/leaders${q}`)).leaders;
    const sel = `<label class="field"><span>League</span><select id="fc-leaders-league"><option value="">Every league</option>${ls.leagues.map((l) => `<option value="${l.leagueId}" ${String(l.leagueId) === String(st.leadersLeague) ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></label>`;
    return `<h2>Player Stats</h2><p class="muted">From the save: league goals, appearances and cards for every player, plus every match rating the save keeps (with minutes). Average ratings need ${L.minMatches} or more rated matches.</p><div class="toolbar">${sel}</div>
      <div class="grid cols-3">
        ${card('Golden Boot (league goals)', leaderList(L.goldenBoot, (x) => x.leagueGoals, { sub: (x) => `${x.club || ''} · ${x.leagueApps} apps` }))}
        ${card('Goals per league game (3+ apps)', leaderList(L.goalsPerGame, (x) => fmt(x.goalsPerGame, 2)))}
        ${card(`Best average rating (${L.minMatches}+)`, leaderList(L.bestRated, (x) => ratingChip(x.avgRating), { sub: (x) => `${x.club || ''} · ${x.matches} matches` }))}
        ${card('In form (last 5 ratings)', leaderList(L.inForm, (x) => ratingChip(x.last5)))}
        ${card('Rising form (last 5 vs season)', leaderList(L.risingForm, (x) => signed(x.trend, 2)))}
        ${card('Most 8.0+ ratings', leaderList(L.eightPlus, (x) => x.eightPlus))}
        ${card('Best single performances', leaderList(L.bestSingle, (x) => ratingChip(x.matchRating), { sub: (x) => `${x.club || ''} · ${day(x.date)}` }))}
        ${card('Most minutes', leaderList(L.mostMinutes, (x) => x.minutes))}
        ${card('Most consistent (smallest spread)', leaderList(L.mostConsistent, (x) => `±${fmt(x.consistency, 2)}`, { sub: (x) => `${x.club || ''} · avg ${fmt(x.avgRating, 2)}` }))}
        ${card('Most appearances (league)', leaderList(L.appearances, (x) => x.leagueApps))}
        ${card('Discipline (yellow 1, red 3)', leaderList(L.discipline, (x) => `${x.yellows}Y ${x.reds}R`))}
        ${card('OVR risers', leaderList(L.ovrRisers, (x) => signed(x.ovrChange)))}
        ${card('OVR fallers', leaderList(L.ovrFallers, (x) => signed(x.ovrChange)))}
        ${card('Wonderkids (21 and under, by potential)', leaderList(L.wonderkids, (x) => `${x.ovr} → ${x.pot}`, { sub: (x) => `${x.club || ''} · age ${x.age}` }))}
        ${card('Top earners', leaderList(L.topEarners, (x) => wage(x.wage)))}
      </div>`;
  }

  // ---------- Fixtures
  async function fixtures() {
    const r = await api(`/fc/${K()}/fixtures`);
    const fx = r.fixtures.length ? H.table('fc-fixtures', r.fixtures, [
      { key: 'date', label: 'Date', left: true, render: (f) => `${esc(day(f.date))}${f.time ? ` ${esc(f.time)}` : ''}` },
      { key: 'competition', label: 'Competition', left: true }, { key: 'home', label: 'H/A', render: (f) => (f.home ? 'H' : 'A') },
      { key: 'opponent', label: 'Opponent', left: true, render: (f) => cLink(f.opponentId, f.opponent) },
      { key: 'logged', label: 'Result', left: true, render: (f) => (f.logged ? `${resPill(f.logged.result)} ${esc(f.logged.score)} <a href="#" data-fc-match="${esc(f.logged.id)}">view</a>` : f.past ? `<button class="small" data-fc-log-fixture="${esc(JSON.stringify({ date: f.date, opponentId: f.opponentId, venue: f.home ? 'home' : 'away', competition: f.competition }))}">Log result</button>` : '<span class="muted">upcoming</span>') },
    ], { defaultSort: 'date', maxHeight: false }) : '<div class="muted">This save has no fixture list. The matches the save rated are below; log any of them from there.</div>';
    const rated = r.rated.length ? `<ul class="list">${r.rated.slice().reverse().map((x) => `<li><span>${esc(day(x.date))}${x.opponent ? ` · ${x.home ? 'vs' : '@'} ${esc(x.opponent)}` : ''} <span class="muted">${esc(x.competition || '')} · ${x.players.length} players rated</span><br><span class="small-note">Best: ${x.best ? `${esc(x.best.name)} ${x.best.rating.toFixed(1)}` : '—'}</span></span><span>${ratingChip(x.teamRating)} <button class="small" data-fc-log-rated="${esc(x.date)}">Log this match</button></span></li>`).join('')}</ul>` : '<div class="muted">No rated matches this season yet.</div>';
    return `<h2>Fixtures &amp; Results</h2><p class="muted">Your club's fixtures from the save. FC does not keep scores in the save, so results show once you log them.</p>${fx}${card('Matches the save rated this season', rated)}`;
  }

  // ---------- Match Log
  async function matchlog() {
    if (st.matchId) return matchDetail();
    const r = await api(`/fc/${K()}/matches`);
    st.matches = r;
    const list = r.matches.length ? r.matches.map((m) => `<div class="card fc-match"><div class="fc-match-head"><span>${resPill(m.result)} <b>${esc(m.score)}</b> ${m.venue === 'away' ? '@' : 'vs'} <b>${esc(m.opponent)}</b>${m.penalties ? ` <span class="muted">(${m.penalties.for}-${m.penalties.against} pens)</span>` : ''}</span><span class="muted">${esc(day(m.date))} · ${esc(m.competition)}</span></div>${m.lines.length ? `<ul class="tight">${m.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}<div class="toolbar no-copy"><button class="small" data-fc-match="${esc(m.id)}">Details</button><button class="small" data-fc-edit-match="${esc(m.id)}">Edit</button><button class="small" data-fc-delete-match="${esc(m.id)}">Delete</button></div></div>`).join('') : empty('No matches logged yet.');
    const loggedDates = new Set(r.matches.map((m) => m.date));
    const unlogged = r.rated.filter((x) => !loggedDates.has(x.date));
    const todo = unlogged.length ? card('Rated in the save, not logged yet', `<ul class="list">${unlogged.slice().reverse().slice(0, 10).map((x) => `<li><span>${esc(day(x.date))}${x.opponent ? ` · ${x.home ? 'vs' : '@'} ${esc(x.opponent)}` : ''} <span class="muted">${x.players.length} players rated</span></span><button class="small" data-fc-log-rated="${esc(x.date)}">Log this match</button></li>`).join('')}</ul><div class="small-note">Logging one of these fills in who played, their minutes and ratings from the save.</div>`) : '';
    return `<h2>Match Log</h2><p class="muted">Log a match after you play it: the score, who scored and assisted and when, cards, injuries, the match stats and ratings. FC 26 does not keep these in the save, so this is where they are counted.</p><div class="toolbar"><button class="primary" data-fc-new-match="1">Log a match</button></div><div class="grid cols-2"><div>${list}</div><div>${todo}</div></div>`;
  }

  async function matchDetail() {
    const m = (await api(`/fc/${K()}/matches/${encodeURIComponent(st.matchId)}`)).match;
    const goals = m.goals.length ? `<ul class="list">${m.goals.map((g) => `<li><span><b>${esc(g.minuteText)}</b> ${g.side === 'for' ? '⚽' : '<span class="muted">⚽</span>'} ${esc(g.scorer)}${g.assister ? ` <span class="muted">(assist ${esc(g.assister)})</span>` : ''}</span><span class="muted">${esc(g.typeLabel)}${g.side === 'against' ? ' · them' : ''}</span></li>`).join('')}</ul>` : '<div class="muted">No goals listed.</div>';
    const cards = m.cards.length ? `<ul class="list">${m.cards.map((c) => `<li><span><b>${esc(c.minuteText)}</b> ${esc(c.who || '')}${c.side === 'against' ? ' <span class="muted">(them)</span>' : ''}</span><span class="pill ${c.color === 'yellow' ? '' : 'loss'}">${esc(c.colorLabel)}</span></li>`).join('')}</ul>` : '<div class="muted">None.</div>';
    const stats = m.stats.length ? `<table class="data compact"><thead><tr><th>You</th><th class="left">Stat</th><th>Them</th></tr></thead><tbody>${m.stats.map((s) => `<tr><td>${fmt(s.us, s.key === 'xg' ? 2 : 0)}</td><td class="left">${esc(s.label)}</td><td>${fmt(s.them, s.key === 'xg' ? 2 : 0)}</td></tr>`).join('')}</tbody></table>` : '<div class="muted">No match stats entered.</div>';
    const players = m.players.length ? `<table class="data compact"><thead><tr><th class="left">Player</th><th>Mins</th><th>Rating</th></tr></thead><tbody>${m.players.map((p) => `<tr><td class="left">${pLink(p.playerId, p.name)}${p.started ? '' : ' <span class="muted">sub</span>'}${m.match.motmId === p.playerId ? ' <span class="pill win">MOTM</span>' : ''}</td><td>${fmt(p.minutes)}</td><td>${ratingChip(p.rating)}</td></tr>`).join('')}</tbody></table>` : '<div class="muted">No player ratings entered.</div>';
    return `<div class="toolbar"><button id="fc-match-back">← Match Log</button><button class="small" data-fc-edit-match="${esc(m.id)}">Edit</button><button class="small" data-copy-block="fc-match-body">Copy as text</button></div><div id="fc-match-body">
      <div class="card fc-hero"><div><div class="fc-club">${resPill(m.result)} ${esc(m.score)} ${m.venue === 'away' ? '@' : 'vs'} ${esc(m.opponent)}</div><div class="muted">${esc(day(m.date))} · ${esc(m.competition)}${m.match.extraTime ? ' · after extra time' : ''}${m.penalties ? ` · ${m.penalties.for}-${m.penalties.against} on penalties` : ''}${m.motm ? ` · man of the match ${esc(m.motm)}` : ''}</div></div></div>
      ${m.story.lines.length ? card('The story', `<ul class="tight">${m.story.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`) : ''}
      <div class="grid cols-3">${card('Goals', goals)}${card('Cards', cards)}${card('Match stats', stats)}</div>
      <div class="grid cols-2">${card('Ratings', players)}${card('Injuries', m.injuries.length ? `<ul class="tight">${m.injuries.map((i) => `<li><b>${esc(i.minuteText)}</b> ${esc(i.who)}: ${esc(i.injury)}${i.weeks ? `, ${i.weeks} weeks` : i.days ? `, ${i.days} days` : ''}</li>`).join('')}</ul>` : '<div class="muted">None.</div>')}</div>
      ${m.match.notes ? card('Notes', `<p>${esc(m.match.notes)}</p>`) : ''}</div>`;
  }

  // ---------- Match editor
  async function loadEditorData() {
    const ov = await api(`/fc/${K()}/clubs`);
    st.clubs = ov;
    const userClub = ov.userClubId;
    st.squad = userClub ? (await api(`/fc/${K()}/squad/${userClub}`)).players : [];
    if (!st.matches) st.matches = await api(`/fc/${K()}/matches`);
  }

  function newMatch(prefill = {}) {
    return { date: '', competition: '', opponentId: '', opponentName: '', venue: 'home', goalsFor: '', goalsAgainst: '', extraTime: false, penaltiesFor: '', penaltiesAgainst: '', goals: [], cards: [], injuries: [], stats: {}, players: [], motmId: '', notes: '', ...prefill };
  }

  // Who played on a date, from the save's ratings.
  function fromSave(date) {
    const rated = st.matches && st.matches.rated ? st.matches.rated.find((x) => x.date === date) : null;
    return rated ? rated.players.map((p) => ({ playerId: p.playerId, minutes: p.minutes, rating: p.rating, started: p.minutes == null || p.minutes >= 60 })) : null;
  }

  async function matchedit() {
    if (!st.squad || !st.clubs) await loadEditorData();
    const m = st.edit;
    const squadOpts = (sel, blank = '—') => `<option value="">${blank}</option>${st.squad.map((p) => `<option value="${p.playerId}" ${String(sel) === String(p.playerId) ? 'selected' : ''}>${esc(p.name)} (${esc(p.position || '')})</option>`).join('')}`;
    const clubOpts = `<option value="">Pick the opponent</option>${st.clubs.leagues.map((l) => `<optgroup label="${esc(l.name)}">${l.clubs.filter((c) => c.clubId !== st.clubs.userClubId).map((c) => `<option value="${c.clubId}" ${String(m.opponentId) === String(c.clubId) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</optgroup>`).join('')}<optgroup label="Other"><option value="other" ${m.opponentId === 'other' ? 'selected' : ''}>Another club (type the name)</option></optgroup>`;
    const comps = [...new Set([...(st.matches ? st.matches.matches.map((x) => x.competition) : []), ...st.clubs.leagues.map((l) => l.name), 'League Cup', 'Domestic Cup', 'Champions League', 'Europa League', 'Conference League', 'Friendly'])];
    const opts = st.matches.options;
    const sel = (cls, obj, cur) => `<select class="${cls}">${Object.entries(obj).map(([k, v]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
    const goalRows = m.goals.map((g, i) => `<tr data-i="${i}"><td class="left">${g.side === 'against' ? 'Them' : 'You'}</td><td><input type="number" class="g-min" min="0" max="130" value="${esc(g.minute ?? '')}" style="width:62px"> + <input type="number" class="g-add" min="0" max="20" value="${esc(g.added || '')}" style="width:48px"></td><td class="left">${g.side === 'for' ? `<select class="g-player">${squadOpts(g.playerId, 'Scorer')}</select>` : `<input type="text" class="g-name" value="${esc(g.name || '')}" placeholder="Scorer (optional)">`}</td><td class="left">${g.side === 'for' ? `<select class="g-assist">${squadOpts(g.assistId, 'No assist')}</select>` : ''}</td><td>${sel('g-type', opts.goalTypes, g.type || 'open')}</td><td><button class="small" data-del="goals" data-i="${i}">✕</button></td></tr>`).join('');
    const cardRows = m.cards.map((c, i) => `<tr data-i="${i}"><td class="left">${c.side === 'against' ? 'Them' : 'You'}</td><td><input type="number" class="c-min" min="0" max="130" value="${esc(c.minute ?? '')}" style="width:62px"></td><td class="left">${c.side === 'for' ? `<select class="c-player">${squadOpts(c.playerId, 'Player')}</select>` : `<input type="text" class="c-name" value="${esc(c.name || '')}" placeholder="Player">`}</td><td>${sel('c-color', opts.cardTypes, c.color || 'yellow')}</td><td><button class="small" data-del="cards" data-i="${i}">✕</button></td></tr>`).join('');
    const injRows = m.injuries.map((x, i) => `<tr data-i="${i}"><td><input type="number" class="i-min" min="0" max="130" value="${esc(x.minute ?? '')}" style="width:62px"></td><td class="left"><select class="i-player">${squadOpts(x.playerId, 'Player')}</select></td><td class="left"><input type="text" class="i-injury" value="${esc(x.injury || '')}" placeholder="e.g. Hamstring strain"></td><td><input type="number" class="i-weeks" min="0" max="60" value="${esc(x.weeks ?? '')}" style="width:62px"></td><td><button class="small" data-del="injuries" data-i="${i}">✕</button></td></tr>`).join('');
    const statRows = opts.teamStats.map(([k, label]) => `<tr><td><input type="number" step="${k === 'xg' ? '0.1' : '1'}" class="s-us" data-k="${k}" value="${esc((m.stats[k] || [])[0] ?? '')}" style="width:80px"></td><td class="left">${esc(label)}</td><td><input type="number" step="${k === 'xg' ? '0.1' : '1'}" class="s-them" data-k="${k}" value="${esc((m.stats[k] || [])[1] ?? '')}" style="width:80px"></td></tr>`).join('');
    const byId = new Map(m.players.map((p) => [String(p.playerId), p]));
    const playerRows = st.squad.map((p) => { const e = byId.get(String(p.playerId)); return `<tr data-pid="${p.playerId}"><td class="left">${esc(p.name)} <span class="muted">${esc(p.position || '')}</span></td><td><input type="checkbox" class="p-played" ${e ? 'checked' : ''}></td><td><input type="checkbox" class="p-start" ${e && e.started !== false ? 'checked' : ''}></td><td><input type="number" class="p-min" min="0" max="130" value="${esc(e && e.minutes != null ? e.minutes : '')}" style="width:62px"></td><td><input type="number" class="p-rating" min="0" max="10" step="0.1" value="${esc(e && e.rating != null ? e.rating : '')}" style="width:62px"></td></tr>`; }).join('');
    const saveHas = m.date && fromSave(m.date);
    return `<h2>${m.id ? 'Edit match' : 'Log a match'}</h2>
      <div class="card"><h3>The match</h3><div class="form-grid">
        <label class="field"><span>Date</span><input type="date" id="me-date" value="${esc(m.date)}"></label>
        <label class="field"><span>Competition</span><input type="text" id="me-comp" list="me-comps" value="${esc(m.competition)}"><datalist id="me-comps">${comps.map((x) => `<option value="${esc(x)}">`).join('')}</datalist></label>
        <label class="field"><span>Opponent</span><select id="me-opp">${clubOpts}</select></label>
        <label class="field ${m.opponentId === 'other' ? '' : 'hidden'}" id="me-oppname-field"><span>Opponent name</span><input type="text" id="me-oppname" value="${esc(m.opponentName || '')}"></label>
        <label class="field"><span>Where</span><select id="me-venue">${['home', 'away', 'neutral'].map((v) => `<option value="${v}" ${m.venue === v ? 'selected' : ''}>${v[0].toUpperCase() + v.slice(1)}</option>`).join('')}</select></label>
        <label class="field"><span>Your goals</span><input type="number" id="me-gf" min="0" value="${esc(m.goalsFor)}" style="width:80px"></label>
        <label class="field"><span>Their goals</span><input type="number" id="me-ga" min="0" value="${esc(m.goalsAgainst)}" style="width:80px"></label>
        <label class="field"><span>Extra time</span><input type="checkbox" id="me-et" ${m.extraTime ? 'checked' : ''}></label>
        <label class="field"><span>Penalties: you / them</span><span><input type="number" id="me-pf" min="0" value="${esc(m.penaltiesFor)}" style="width:56px"> <input type="number" id="me-pa" min="0" value="${esc(m.penaltiesAgainst)}" style="width:56px"></span></label>
      </div></div>
      <div class="card"><h3>Goals</h3><table class="data compact fc-edit"><thead><tr><th class="left">Side</th><th>Minute</th><th class="left">Scorer</th><th class="left">Assist</th><th>Type</th><th></th></tr></thead><tbody>${goalRows || '<tr><td colspan="6" class="left muted">No goals added.</td></tr>'}</tbody></table><div class="toolbar"><button class="small" data-add="goal-for">+ Your goal</button><button class="small" data-add="goal-against">+ Their goal</button><span class="small-note">Add every goal with its minute and the tool can tell who scored first, comebacks, late winners and when your goals come. For stoppage time put 45 or 90 and the extra minutes in the second box.</span></div></div>
      <div class="grid cols-2">
        <div class="card"><h3>Cards</h3><table class="data compact fc-edit"><thead><tr><th class="left">Side</th><th>Minute</th><th class="left">Player</th><th>Card</th><th></th></tr></thead><tbody>${cardRows || '<tr><td colspan="5" class="left muted">No cards.</td></tr>'}</tbody></table><div class="toolbar"><button class="small" data-add="card-for">+ Your card</button><button class="small" data-add="card-against">+ Their card</button></div></div>
        <div class="card"><h3>Injuries</h3><table class="data compact fc-edit"><thead><tr><th>Minute</th><th class="left">Player</th><th class="left">Injury</th><th>Weeks out</th><th></th></tr></thead><tbody>${injRows || '<tr><td colspan="5" class="left muted">No injuries.</td></tr>'}</tbody></table><div class="toolbar"><button class="small" data-add="injury">+ Injury</button></div></div>
      </div>
      <div class="grid cols-2">
        <div class="card"><h3>Match stats</h3><table class="data compact fc-edit"><thead><tr><th>You</th><th class="left">From the match facts screen</th><th>Them</th></tr></thead><tbody>${statRows}</tbody></table><div class="small-note">Fill in what you have. Possession for them fills itself in.</div></div>
        <div class="card"><h3>Your players</h3><div class="toolbar">${saveHas ? '<button class="small" id="me-fill">Fill from the save</button>' : ''}<label class="field"><span>Man of the match</span><select id="me-motm">${squadOpts(m.motmId, 'Nobody picked')}</select></label></div><div class="table-wrap" style="max-height:420px"><table class="data compact fc-edit"><thead><tr><th class="left">Player</th><th>Played</th><th>Started</th><th>Mins</th><th>Rating</th></tr></thead><tbody>${playerRows}</tbody></table></div><div class="small-note">${saveHas ? 'The save rated this match. Fill from the save copies who played, minutes and ratings; "started" is a guess from minutes, so fix it if needed.' : 'Tick who played. Minutes and ratings are optional; per-90 stats use minutes when they are there.'}</div></div>
      </div>
      <div class="card"><h3>Notes</h3><textarea id="me-notes" rows="3" style="width:100%">${esc(m.notes || '')}</textarea></div>
      <div class="toolbar"><button class="primary" id="me-save">Save match</button><button id="me-cancel">Cancel</button></div>`;
  }

  // Copy what is on screen back into st.edit.
  function readEditor() {
    const m = st.edit;
    const v = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    m.date = v('me-date');
    m.competition = v('me-comp');
    m.opponentId = v('me-opp');
    m.opponentName = v('me-oppname');
    m.venue = v('me-venue');
    m.goalsFor = v('me-gf');
    m.goalsAgainst = v('me-ga');
    m.extraTime = Boolean($('#me-et') && $('#me-et').checked);
    m.penaltiesFor = v('me-pf');
    m.penaltiesAgainst = v('me-pa');
    m.motmId = v('me-motm');
    m.notes = v('me-notes');
    const rows = (sel) => $$(sel);
    const val = (tr, cls) => { const el = $(cls, tr); return el ? el.value : ''; };
    rows('.fc-edit tr[data-i]').forEach((tr) => {
      const i = Number(tr.dataset.i);
      if ($('.g-min', tr)) Object.assign(m.goals[i], { minute: val(tr, '.g-min'), added: val(tr, '.g-add'), playerId: val(tr, '.g-player'), assistId: val(tr, '.g-assist'), name: val(tr, '.g-name'), type: val(tr, '.g-type') });
      else if ($('.c-min', tr)) Object.assign(m.cards[i], { minute: val(tr, '.c-min'), playerId: val(tr, '.c-player'), name: val(tr, '.c-name'), color: val(tr, '.c-color') });
      else if ($('.i-min', tr)) Object.assign(m.injuries[i], { minute: val(tr, '.i-min'), playerId: val(tr, '.i-player'), injury: val(tr, '.i-injury'), weeks: val(tr, '.i-weeks') });
    });
    m.stats = {};
    $$('.s-us').forEach((el) => { const k = el.dataset.k; const them = $(`.s-them[data-k="${k}"]`); if (el.value !== '' || (them && them.value !== '')) m.stats[k] = [el.value, them ? them.value : '']; });
    m.players = $$('tr[data-pid]').filter((tr) => $('.p-played', tr).checked).map((tr) => ({ playerId: tr.dataset.pid, minutes: $('.p-min', tr).value, rating: $('.p-rating', tr).value, started: $('.p-start', tr).checked }));
  }

  // ---------- Advanced stats (from the Match Log)
  function advancedBody(s) {
    if (!s || !s.matches) return empty('Log some matches and the advanced stats appear here.');
    const R = s.record;
    const recRow = (label, r) => `<tr><td class="left">${esc(label)}</td><td>${r.played}</td><td>${r.won}</td><td>${r.drawn}</td><td>${r.lost}</td><td>${r.gf}</td><td>${r.ga}</td><td>${signed(r.gd)}</td><td>${r.points}</td><td>${fmt(r.ppg, 2)}</td><td>${r.winPct ?? '—'}${r.winPct != null ? '%' : ''}</td></tr>`;
    const recHead = '<thead><tr><th class="left"></th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th><th>PPG</th><th>Win %</th></tr></thead>';
    const splits = `<table class="data compact">${recHead}<tbody>${recRow('All', R)}${['home', 'away', 'neutral'].filter((k) => s.venue[k].played).map((k) => recRow(k[0].toUpperCase() + k.slice(1), s.venue[k])).join('')}${s.competitions.map((c) => recRow(c.competition, c)).join('')}</tbody></table>`;
    const T = s.team;
    const maxP = Math.max(1, ...T.goalsFor, ...T.goalsAgainst);
    const periods = s.periods.map((p, i) => `<div class="fc-period"><div class="lab">${esc(p)}</div><div class="bars"><span class="for" style="width:${(T.goalsFor[i] / maxP) * 100}%"></span><span class="against" style="width:${(T.goalsAgainst[i] / maxP) * 100}%"></span></div><div class="num">${T.goalsFor[i]} / ${T.goalsAgainst[i]}</div></div>`).join('');
    const types = (obj) => (Object.keys(obj).length ? Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<div class="leader"><div class="who">${esc(({ open: 'Open play', header: 'Header', penalty: 'Penalty', freekick: 'Free kick', longshot: 'Long shot', counter: 'Counter attack', setpiece: 'Corner / set piece', owngoal: 'Own goal' })[k] || k)}</div><div class="n">${n}</div></div>`).join('') : '<div class="muted">No goals listed.</div>');
    const A = s.averages;
    const avgRow = (k, label, d = 0) => (A[k] ? `<tr><td>${fmt(A[k].us, d)}</td><td class="left">${esc(label)}</td><td>${fmt(A[k].them, d)}</td><td class="muted">${A[k].matches}</td></tr>` : '');
    const F = s.finishing;
    const streak = (k, label) => `<div class="leader"><div class="who">${esc(label)}</div><div class="n">${s.streaks[k].current} <span class="muted small">best ${s.streaks[k].best}</span></div></div>`;
    const ext = (label, x) => (x ? `<div class="leader"><div class="who">${esc(label)}<span>${esc(day(x.date))} · ${esc(x.competition)}</span></div><div class="n">${esc(x.score)} ${x.venue === 'away' ? '@' : 'vs'} ${esc(x.opponent)}</div></div>` : '');
    const str = s.strength;
    const strengthRows = ['top', 'middle', 'bottom'].filter((k) => str[k].played).map((k) => recRow({ top: 'Top third of their league', middle: 'Middle third', bottom: 'Bottom third' }[k], str[k])).join('');
    const playersTbl = H.table('fc-log-players', s.players, [
      { key: 'name', label: 'Player', left: true, render: (p) => pLink(p.playerId, p.name) }, { key: 'position', label: 'Pos', left: true },
      { key: 'apps', label: 'Apps' }, { key: 'starts', label: 'Starts' }, { key: 'minutes', label: 'Mins' }, { key: 'goals', label: 'G' }, { key: 'assists', label: 'A' }, { key: 'ga', label: 'G+A' },
      { key: 'goalsPer90', label: 'G/90', d: 2 }, { key: 'assistsPer90', label: 'A/90', d: 2 }, { key: 'minutesPerGA', label: 'Min/G+A' }, { key: 'shareOfGoals', label: '% of goals' },
      { key: 'penalties', label: 'Pens' }, { key: 'headers', label: 'Headers' }, { key: 'braces', label: 'Braces' }, { key: 'hatTricks', label: 'Hat-tricks' },
      { key: 'motm', label: 'MOTM' }, { key: 'avgRating', label: 'Avg', render: (p) => ratingChip(p.avgRating) }, { key: 'cleanSheets', label: 'CS' }, { key: 'yellows', label: 'YC' }, { key: 'reds', label: 'RC' }, { key: 'winPct', label: 'Win %' }, { key: 'injuries', label: 'Inj' },
    ], { defaultSort: 'ga', maxHeight: false });
    return `<div class="stat-row card">${stat(s.matches, 'matches logged')}${stat(`${R.won}-${R.drawn}-${R.lost}`, 'W-D-L')}${stat(`${R.gf}:${R.ga}`, 'goals')}${stat(fmt(R.ppg, 2), 'points per game')}${stat(T.cleanSheets, `clean sheets (${T.cleanSheetPct}%)`)}${stat(T.failedToScore, 'failed to score')}${stat(`<span class="fc-form">${s.form.map((f) => resPill(f.result)).join(' ')}</span>`, 'last six')}</div>
      ${card('Record', splits)}
      <div class="grid cols-3">
        ${card('Game state', `<div class="leader"><div class="who">Scored first<span>${T.scoredFirst.played} matches</span></div><div class="n">${T.scoredFirst.won}-${T.scoredFirst.drawn}-${T.scoredFirst.lost}</div></div><div class="leader"><div class="who">Conceded first<span>${T.concededFirst.played} matches</span></div><div class="n">${T.concededFirst.won}-${T.concededFirst.drawn}-${T.concededFirst.lost}</div></div><div class="leader"><div class="who">Came from behind to win</div><div class="n">${T.cameFromBehind}</div></div><div class="leader"><div class="who">Points won from losing positions</div><div class="n">${T.pointsFromBehind}</div></div><div class="leader"><div class="who">Leads not turned into wins</div><div class="n">${T.ledAndDidNotWin}</div></div><div class="leader"><div class="who">Points dropped from winning positions</div><div class="n">${T.pointsDroppedFromAhead}</div></div><div class="leader"><div class="who">Late winners / late equalisers (85'+)</div><div class="n">${T.lateWinners} / ${T.lateEqualizers}</div></div><div class="leader"><div class="who">Costly late goals conceded</div><div class="n">${T.lateConceded}</div></div><div class="small-note">Counted only for matches with every goal and its minute listed.</div>`)}
        ${card('When the goals come (yours / theirs)', `${periods}`)}
        ${card('Streaks (now, best)', `${streak('wins', 'Wins')}${streak('unbeaten', 'Unbeaten')}${streak('scoring', 'Scoring in')}${streak('cleanSheets', 'Clean sheets')}${streak('winless', 'Without a win')}${streak('losses', 'Losses')}`)}
      </div>
      <div class="grid cols-3">
        ${card('Match stats per game', Object.keys(A).length ? `<table class="data compact"><thead><tr><th>You</th><th class="left"></th><th>Them</th><th class="muted">games</th></tr></thead><tbody>${avgRow('possession', 'Possession %', 1)}${avgRow('shots', 'Shots', 1)}${avgRow('shotsOnTarget', 'Shots on target', 1)}${avgRow('xg', 'xG', 2)}${avgRow('passes', 'Passes', 0)}${avgRow('passAccuracy', 'Pass accuracy %', 1)}${avgRow('tackles', 'Tackles', 1)}${avgRow('interceptions', 'Interceptions', 1)}${avgRow('saves', 'Saves', 1)}${avgRow('fouls', 'Fouls', 1)}${avgRow('corners', 'Corners', 1)}${avgRow('offsides', 'Offsides', 1)}</tbody></table>` : '<div class="muted">No match stats entered yet.</div>')}
        ${card('Finishing and keeping', `<div class="leader"><div class="who">Shot conversion (you / them)</div><div class="n">${F.conversion ?? '—'}% / ${F.conversionAgainst ?? '—'}%</div></div><div class="leader"><div class="who">Shots on target</div><div class="n">${F.onTargetPct ?? '—'}%</div></div><div class="leader"><div class="who">xG for / against</div><div class="n">${fmt(F.xgFor, 1)} / ${fmt(F.xgAgainst, 1)}</div></div><div class="leader"><div class="who">Goals minus xG<span>above 0 = finishing better than the chances</span></div><div class="n">${signed(F.goalsMinusXg, 1)}</div></div><div class="leader"><div class="who">xG against minus goals against<span>above 0 = keeping out more than expected</span></div><div class="n">${signed(F.xgaMinusGoalsAgainst, 1)}</div></div>`)}
        ${card('Goal types (yours / theirs)', `<div class="grid cols-2"><div>${types(T.goalTypesFor)}</div><div>${types(T.goalTypesAgainst)}</div></div>`)}
      </div>
      <div class="grid cols-3">
        ${card('Against opponents by table position', strengthRows ? `<table class="data compact">${recHead}<tbody>${strengthRows}</tbody></table>` : '<div class="muted">Needs logged matches against clubs in a league table.</div>')}
        ${card('Results to remember', `${ext('Biggest win', s.extremes.biggestWin)}${ext('Heaviest defeat', s.extremes.heaviestDefeat)}${ext('Most goals in a match', s.extremes.mostGoals)}<div class="leader"><div class="who">Discipline</div><div class="n">${T.yellows}Y ${T.reds}R</div></div>${T.penaltyShootouts.won + T.penaltyShootouts.lost ? `<div class="leader"><div class="who">Penalty shootouts</div><div class="n">won ${T.penaltyShootouts.won}, lost ${T.penaltyShootouts.lost}</div></div>` : ''}`)}
        ${card('Best partnerships (assist → goal)', s.partnerships.length ? s.partnerships.map((x) => `<div class="leader"><div class="who">${pLink(x.assistId, x.assister)} → ${pLink(x.scorerId, x.scorer)}</div><div class="n">${x.goals}</div></div>`).join('') : '<div class="muted">No assisted goals logged.</div>')}
      </div>
      ${card('Players', playersTbl)}
      ${card('Injuries', s.injuries.length ? H.table('fc-injuries', s.injuries, [{ key: 'name', label: 'Player', left: true, render: (i) => pLink(i.playerId, i.name) }, { key: 'injury', label: 'Injury', left: true }, { key: 'date', label: 'When', left: true, render: (i) => `${esc(day(i.date))} ${esc(i.minute)} vs ${esc(i.opponent)}` }, { key: 'weeks', label: 'Weeks' }, { key: 'back', label: 'Back', left: true, render: (i) => (i.back ? `${esc(day(i.back))}${i.out ? ' <span class="pill loss">out</span>' : ''}` : '—') }], { defaultSort: 'date', maxHeight: false }) : '<div class="muted">No injuries logged.</div>')}`;
  }

  async function advanced() {
    const r = await api(`/fc/${K()}/log-stats${st.logComp ? `?competition=${encodeURIComponent(st.logComp)}` : ''}`);
    const all = st.logComp ? (await api(`/fc/${K()}/log-stats`)).stats : r.stats;
    const sel = all.competitions.length > 1 ? `<label class="field"><span>Competition</span><select id="fc-log-comp"><option value="">All competitions</option>${all.competitions.map((c) => `<option ${c.competition === st.logComp ? 'selected' : ''}>${esc(c.competition)}</option>`).join('')}</select></label>` : '';
    return `<h2>Advanced Stats</h2><p class="muted">Worked out from your Match Log, with minutes and ratings from the save where you left them blank.</p><div class="toolbar">${sel}<button class="small" data-copy-block="fc-adv-body">Copy as text</button></div><div id="fc-adv-body">${advancedBody(r.stats)}</div>`;
  }

  // ---------- Transfers and Manager
  async function transfers() {
    const t = (await api(`/fc/${K()}/transfers`)).transfers;
    const deals = t.deals.length ? H.table('fc-deals', t.deals, [{ key: 'name', label: 'Player', left: true, render: (d) => pLink(d.playerId, d.name) }, { key: 'age', label: 'Age' }, { key: 'ovr', label: 'OVR' }, { key: 'from', label: 'From', left: true, render: (d) => cLink(d.fromId, d.from) }, { key: 'to', label: 'To', left: true, render: (d) => cLink(d.toId, d.to) }, { key: 'fee', label: 'Fee', render: (d) => money(d.fee) }], { defaultSort: 'fee', maxHeight: false }) : '<div class="muted">The save has no transfer history.</div>';
    const clubs = t.clubs.length ? H.table('fc-spend', t.clubs, [{ key: 'club', label: 'Club', left: true, render: (x) => `${x.isUser ? '<b>' : ''}${cLink(x.clubId, x.club)}${x.isUser ? '</b>' : ''}` }, { key: 'in', label: 'In' }, { key: 'spent', label: 'Spent', render: (x) => money(x.spent) }, { key: 'out', label: 'Out' }, { key: 'received', label: 'Received', render: (x) => money(x.received) }, { key: 'net', label: 'Net spend', render: (x) => money(x.net) }], { defaultSort: 'spent', maxHeight: false }) : '';
    const incoming = t.incoming.length ? `<ul class="list">${t.incoming.map((d) => `<li><span>${pLink(d.playerId, d.name)} <span class="muted">${esc(d.from)} → ${esc(d.to)}${d.completes ? ` · joins ${esc(day(d.completes))}` : ''}</span></span><span>${d.fee ? money(d.fee) : 'free'}${d.wage ? ` · ${wage(d.wage)}` : ''}</span></li>`).join('')}</ul>` : '<div class="muted">None.</div>';
    const loans = t.loans.length ? H.table('fc-loans', t.loans, [{ key: 'name', label: 'Player', left: true, render: (d) => pLink(d.playerId, d.name) }, { key: 'age', label: 'Age' }, { key: 'ovr', label: 'OVR' }, { key: 'from', label: 'From', left: true }, { key: 'to', label: 'To', left: true }, { key: 'until', label: 'Until', left: true, render: (d) => `${esc(day(d.until))}${d.toBuy ? ' · option to buy' : ''}` }], { defaultSort: 'ovr', maxHeight: false }) : '<div class="muted">No loans.</div>';
    return `<h2>Transfers</h2><div class="stat-row card">${stat(t.deals.length, 'transfers')}${stat(money(t.total), 'spent in total')}${stat(t.loans.length, 'players on loan')}${stat(t.incoming.length, 'agreed deals')}</div>${card('Every transfer in the save', deals)}${clubs ? card('Spending by club', clubs) : ''}<div class="grid cols-2">${card('Agreed deals not done yet', incoming)}${card('Loans', loans)}</div>`;
  }

  async function manager() {
    const m = (await api(`/fc/${K()}/manager`)).manager;
    if (!m) return empty('This is not a career save, so there is no manager.');
    if (m.currency) st.currency = m.currency;
    const hist = m.history.length ? H.table('fc-history', m.history, [{ key: 'season', label: 'Season' }, { key: 'club', label: 'Club', left: true }, { key: 'league', label: 'League', left: true }, { key: 'position', label: 'Finished', render: (h) => ord(h.position) }, { key: 'played', label: 'P' }, { key: 'won', label: 'W' }, { key: 'drawn', label: 'D' }, { key: 'lost', label: 'L' }, { key: 'gf', label: 'GF' }, { key: 'ga', label: 'GA' }, { key: 'points', label: 'Pts' }, { key: 'ppg', label: 'PPG', d: 2 }, { key: 'trophies', label: 'Trophies', render: (h) => `${h.trophies.league} league, ${h.trophies.cup} cup, ${h.trophies.continental} Europe` }, { key: 'biggestBuy', label: 'Biggest signing', left: true, render: (h) => (h.biggestBuy ? `${esc(h.biggestBuy.name)} ${money(h.biggestBuy.fee)}` : '—') }, { key: 'biggestSale', label: 'Biggest sale', left: true, render: (h) => (h.biggestSale ? `${esc(h.biggestSale.name)} ${money(h.biggestSale.fee)}` : '—') }], { defaultSort: 'season', maxHeight: false }) : '<div class="muted">No finished seasons yet.</div>';
    return `<h2>${esc(m.name || 'Manager')}</h2><div class="stat-row card">${stat(esc(m.club), 'club')}${stat(m.boardConfidence != null ? `${m.boardConfidence}%` : '—', 'board confidence')}${stat(m.reputation ?? '—', 'reputation')}${stat(wage(m.wage), 'your wage')}${stat(money(m.earnings), 'career earnings')}${stat(`${m.totals.won}-${m.totals.drawn}-${m.totals.lost}`, 'finished seasons W-D-L')}${stat(m.totals.trophies, 'trophies')}</div>
      <div class="grid cols-3">${card('Biggest win', m.bigWin ? `<div class="big">${m.bigWin.us}-${m.bigWin.them} vs ${esc(m.bigWin.opponent)}</div><div class="muted">${esc(day(m.bigWin.date))}</div>` : '—')}${card('Heaviest defeat', m.bigLoss ? `<div class="big">${m.bigLoss.us}-${m.bigLoss.them} vs ${esc(m.bigLoss.opponent)}</div><div class="muted">${esc(day(m.bigLoss.date))}</div>` : '—')}${card('Budgets', m.budget ? `<div class="leader"><div class="who">Transfer budget</div><div class="n">${money(m.budget.transfer)}</div></div><div class="leader"><div class="who">Wage budget (weekly)</div><div class="n">${money(m.budget.wage)}</div></div>` : '—')}</div>${card('Season by season', hist)}`;
  }

  // ---------- routing
  const SECTIONS = { connect, overview, tables, clubs, players, fixtures, matchlog, matchedit, advanced, transfers, manager, player };

  async function html() {
    if (!st.status) await loadStatus();
    if (st.section !== 'connect' && !st.key) st.section = 'connect';
    if (st.section === 'player' && !st.playerId) st.section = 'players';
    if (st.section === 'matchedit' && !st.edit) st.section = 'matchlog';
    return (SECTIONS[st.section] || overview)();
  }

  function go(section, extra = {}) {
    Object.assign(st, extra);
    st.section = section;
    H.render();
    window.scrollTo(0, 0);
  }

  function bind(c) {
    const on = (sel, ev, fn) => $$(sel, c).forEach((el) => (el[ev] = fn));
    on('[data-fc-open]', 'onclick', (e) => openSave(e.currentTarget.dataset.fcOpen));
    on('[data-fc-reopen]', 'onclick', (e) => openSave(e.currentTarget.dataset.fcReopen));
    on('#fc-browse', 'onclick', pickFile);
    on('#fc-open-path', 'onclick', () => openSave($('#fc-path').value));
    on('[data-fc-switch]', 'onclick', (e) => { st.key = e.currentTarget.dataset.fcSwitch; st.squad = null; st.clubs = null; st.matches = null; go('overview'); loadStatus(); });
    on('[data-fc-forget]', 'onclick', async (e) => { const k = e.currentTarget.dataset.fcForget; if (!confirm('Forget this career? Its Match Log and the names you gave players are deleted. The save itself is not touched.')) return; await api(`/fc/${encodeURIComponent(k)}`, { method: 'DELETE' }); st.key = null; await loadStatus(); H.render(); });
    on('[data-fc-section]', 'onclick', (e) => { e.preventDefault(); go(e.currentTarget.dataset.fcSection); });
    on('[data-fc-player]', 'onclick', (e) => { e.preventDefault(); st.backTo = { section: st.section, clubId: st.clubId, clubTab: st.clubTab, matchId: st.matchId }; go('player', { playerId: e.currentTarget.dataset.fcPlayer }); });
    on('#fc-player-back', 'onclick', () => { const b = st.backTo || { section: 'players' }; st.backTo = null; go(b.section, { clubId: b.clubId ?? st.clubId, clubTab: b.clubTab || st.clubTab, matchId: b.matchId ?? null }); });
    on('[data-fc-club]', 'onclick', (e) => { e.preventDefault(); go('clubs', { clubId: Number(e.currentTarget.dataset.fcClub), clubTab: 'overview' }); });
    on('#fc-club-back', 'onclick', () => go('clubs', { clubId: null }));
    on('[data-fc-club-tab]', 'onclick', (e) => go('clubs', { clubTab: e.currentTarget.dataset.fcClubTab }));
    on('#fc-league', 'onchange', (e) => go('tables', { leagueId: Number(e.target.value) }));
    on('#fc-leaders-league', 'onchange', (e) => go('players', { leadersLeague: e.target.value }));
    on('#fc-log-comp', 'onchange', (e) => go('advanced', { logComp: e.target.value }));
    on('[data-fc-match]', 'onclick', (e) => { e.preventDefault(); go('matchlog', { matchId: e.currentTarget.dataset.fcMatch }); });
    on('#fc-match-back', 'onclick', () => go('matchlog', { matchId: null }));
    on('[data-fc-new-match]', 'onclick', async () => { st.matches = null; st.squad = null; await loadEditorData(); go('matchedit', { edit: newMatch() }); });
    on('[data-fc-log-rated]', 'onclick', async (e) => {
      const date = e.currentTarget.dataset.fcLogRated;
      st.matches = null; st.squad = null; await loadEditorData();
      const rated = st.matches.rated.find((x) => x.date === date);
      go('matchedit', { edit: newMatch({ date, opponentId: rated && rated.opponentId ? String(rated.opponentId) : '', venue: rated && rated.home === false ? 'away' : 'home', competition: rated && rated.competition ? rated.competition : '', players: fromSave(date) || [] }) });
    });
    on('[data-fc-log-fixture]', 'onclick', async (e) => {
      const f = JSON.parse(e.currentTarget.dataset.fcLogFixture);
      st.matches = null; st.squad = null; await loadEditorData();
      go('matchedit', { edit: newMatch({ date: f.date, opponentId: String(f.opponentId), venue: f.venue, competition: f.competition, players: fromSave(f.date) || [] }) });
    });
    on('[data-fc-edit-match]', 'onclick', async (e) => {
      const id = e.currentTarget.dataset.fcEditMatch;
      st.matches = null; st.squad = null; await loadEditorData();
      const m = st.matches.matches.find((x) => x.id === id);
      if (!m) return;
      const l = m.logged;
      go('matchedit', { edit: newMatch({ ...l, opponentId: l.opponentId ? String(l.opponentId) : l.opponentName ? 'other' : '', penaltiesFor: l.penalties ? l.penalties.for : '', penaltiesAgainst: l.penalties ? l.penalties.against : '', stats: Object.fromEntries(Object.entries(l.stats).map(([k, v]) => [k, v.map((x) => (x == null ? '' : x))])) }) });
    });
    on('[data-fc-delete-match]', 'onclick', async (e) => { const id = e.currentTarget.dataset.fcDeleteMatch; if (!confirm('Delete this match from the log?')) return; await api(`/fc/${K()}/matches/${encodeURIComponent(id)}`, { method: 'DELETE' }); H.banner('Match deleted.', 'ok'); go('matchlog', { matchId: null }); });
    // Editor
    on('[data-add]', 'onclick', (e) => {
      readEditor();
      const k = e.currentTarget.dataset.add;
      if (k === 'goal-for' || k === 'goal-against') st.edit.goals.push({ side: k === 'goal-for' ? 'for' : 'against', minute: '', type: 'open' });
      if (k === 'card-for' || k === 'card-against') st.edit.cards.push({ side: k === 'card-for' ? 'for' : 'against', minute: '', color: 'yellow' });
      if (k === 'injury') st.edit.injuries.push({ minute: '', injury: '' });
      H.render();
    });
    on('[data-del]', 'onclick', (e) => { readEditor(); st.edit[e.currentTarget.dataset.del].splice(Number(e.currentTarget.dataset.i), 1); H.render(); });
    on('#me-opp', 'onchange', (e) => { const f = $('#me-oppname-field'); if (f) f.classList.toggle('hidden', e.target.value !== 'other'); });
    on('#me-date', 'onchange', () => { readEditor(); H.render(); });
    on('#me-fill', 'onclick', () => { readEditor(); const p = fromSave(st.edit.date); if (p) st.edit.players = p; H.render(); });
    on('#me-cancel', 'onclick', () => go('matchlog', { edit: null }));
    on('#me-save', 'onclick', async () => {
      readEditor();
      const m = { ...st.edit };
      if (m.opponentId === 'other') m.opponentId = '';
      try {
        const r = await api(`/fc/${K()}/matches`, { method: 'POST', body: m });
        st.matches = null;
        H.banner(`Saved: ${esc(r.match.score)} ${r.match.venue === 'away' ? '@' : 'vs'} ${esc(r.match.opponent)}.`, 'ok');
        go('matchlog', { edit: null, matchId: r.match.id });
      } catch (err) { H.banner(esc(err.message), 'error'); }
    });
    on('#fc-rename-save', 'onclick', async () => {
      try { await api(`/fc/${K()}/names`, { method: 'POST', body: { playerId: st.playerId, name: $('#fc-rename').value } }); H.banner('Name saved.', 'ok'); H.render(); } catch (err) { H.banner(esc(err.message), 'error'); }
    });
    on('#fc-settings-export', 'onclick', () => { if (st.key) window.open(`/api/fc/${K()}/export`, '_blank'); });
  }

  function settingsCard() {
    return `<div class="card"><h3>FC 26</h3><p class="muted">The FC 26 side never writes to your saves. Its own data (the Match Log and names you give players) is kept per career in the tool's data folder.</p><div class="toolbar"><button class="small" id="fc-settings-export" ${st.key ? '' : 'disabled'}>Save this career's Match Log as a file</button></div></div>`;
  }

  async function refresh() {
    if (!st.key) return;
    H.banner('Re-reading the save…', '');
    try { await api(`/fc/${K()}/refresh`, { method: 'POST' }); st.squad = null; st.clubs = null; st.matches = null; await loadStatus(); H.banner('Re-read the save.', 'ok'); H.render(); } catch (e) { H.banner(esc(e.message), 'error'); }
  }

  window.FC26 = {
    init(helpers) { H = helpers; },
    html,
    bind,
    settingsCard,
    refresh,
    pickFile,
    loadStatus,
    section: () => st.section,
    navSection: () => (st.section === 'player' ? (st.backTo && st.backTo.section) || 'players' : st.section === 'matchedit' ? 'matchlog' : st.section),
    setSection: (s) => { st.section = s; if (s === 'clubs') st.clubId = null; if (s === 'matchlog') st.matchId = null; },
    setCareer: (k) => { st.key = k; st.squad = null; st.clubs = null; st.matches = null; },
  };
})();
