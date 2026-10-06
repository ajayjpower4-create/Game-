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
    week: '',
    blockView: 'season',
    recapKey: null,
    teamPage: null,
    teamTab: 'overview',
    contractsView: 'league',
    contractsTeam: null,
    weeklyTeam: null,
    gameId: null,
    gameTab: 'blocking',
    gameTeam: null,
    catalog: null,
    seasonCache: new Map(),
    sort: {},
    serverInfo: null,
  };

  // ---------- UI settings (saved in the data folder, applied live)
  const UI_DEFAULTS = { theme: 'dark', accent: 'blue', textSize: 'normal', density: 'comfortable', sourceTags: true, startPage: 'connect', defaultStage: 'auto', copyFormat: 'aligned', moneyFormat: 'short', myTeams: {}, myTeamFilter: false, stickyHeaders: true, reduceMotion: false,
    gameTab: 'highlights', leaderLength: 8, hiddenPages: [], autoReload: false, autoReloadSec: 30, confirmWrites: true };
  const PAGES = [['schedule', 'Schedule & Injury Tool'], ['teams', 'Teams'], ['recap', 'Weekly Recap'], ['highlights', 'Highlights'], ['contracts', 'Contracts & Cap'], ['blocking', 'Blocking'], ['passrush', 'Pass Rush & Missed Sacks'], ['snaps', 'Snap Counts'], ['receiving', 'Targets & Drops'], ['tackling', 'Missed Tackles'], ['penalties', 'Penalties'], ['tracker', 'Game Tracker'], ['injuries', 'Injury Report']];
  // Writes to the franchise file ask first unless that is switched off.
  const confirmWrite = (msg) => (ui.confirmWrites === false ? true : confirm(msg));
  const ACCENTS = { blue: '#2f7de3', red: '#e3392f', green: '#23a55a', purple: '#8e5bd8', orange: '#e0822a', teal: '#1ba3a3', gold: '#c9a227' };
  const TEXT_ZOOM = { small: 0.9, normal: 1, large: 1.12, xlarge: 1.25 };
  let ui = { ...UI_DEFAULTS };
  function applyUi() {
    const root = document.documentElement;
    root.dataset.theme = ui.theme;
    root.dataset.density = ui.density;
    root.classList.toggle('hide-tags', !ui.sourceTags);
    root.classList.toggle('no-sticky', !ui.stickyHeaders);
    root.classList.toggle('reduce-motion', Boolean(ui.reduceMotion));
    root.style.setProperty('--accent2', ACCENTS[ui.accent] || ACCENTS.blue);
    document.body.style.zoom = String(TEXT_ZOOM[ui.textSize] || 1);
    const hidden = new Set(ui.hiddenPages || []);
    $$('#nav button').forEach((b) => b.classList.toggle('hidden', hidden.has(b.dataset.section)));
    $$('#nav .nav-group').forEach((g) => {
      let el = g.nextElementSibling;
      let any = false;
      while (el && !el.classList.contains('nav-group')) { if (!el.classList.contains('hidden')) any = true; el = el.nextElementSibling; }
      g.classList.toggle('hidden', !any);
    });
  }
  const myTeam = () => (state.leagueKey && ui.myTeams && ui.myTeams[state.leagueKey]) || null;
  async function saveUi(patch) {
    ui = { ...ui, ...patch };
    applyUi();
    try { await api('/settings', { method: 'POST', body: { ui } }); state.status.settings.ui = ui; } catch (e) { banner(esc(e.message), 'error'); }
  }

  // ---------- api
  async function api(path, opts = {}) {
    const res = await fetch('/api' + path, { headers: { 'content-type': 'application/json' }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
    const body = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
    if (!res.ok || body.ok === false) {
      const err = new Error(body.error || `HTTP ${res.status}`);
      if (body.help) err.help = body.help;
      throw err;
    }
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
  const money = (v) => {
    if (v == null || !Number.isFinite(v)) return '—';
    const a = Math.abs(v);
    const sign = v < 0 ? '-' : '';
    if (ui.moneyFormat === 'full') return `${sign}$${Math.round(a).toLocaleString('en-US')}`;
    if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(2)}M`;
    if (a >= 1e3) return `${sign}$${Math.round(a / 1e3)}K`;
    return `${sign}$${a}`;
  };

  // ---------- plain-text copy
  // Everything copied out of the app is plain text: no colours, no table
  // formatting, no R / ~ / T source letters. Tables become lined-up columns.
  const cellText = (c) => {
    const x = c.cloneNode(true);
    x.querySelectorAll('.tag, button, .no-copy, input, select').forEach((n) => n.remove());
    return x.textContent.replace(/[▼▲]/g, '').replace(/\s+/g, ' ').trim();
  };
  function tableToText(t) {
    const rows = [...t.querySelectorAll('tr')].filter((r) => r.style.display !== 'none').map((r) => [...r.cells].map(cellText));
    if (!rows.length) return '';
    const n = Math.max(...rows.map((r) => r.length));
    const widths = Array.from({ length: n }, (_, i) => Math.max(0, ...rows.map((r) => (r[i] || '').length)));
    const isNum = (v) => !v || v === '—' || /^[-+]?\$?[\d.,]+[%sMK]?$|^[-+]?[\d.,]+ ?(?:of \d+)?$/.test(v);
    const numeric = Array.from({ length: n }, (_, i) => i > 0 && rows.slice(1).every((r) => isNum(r[i])));
    if (ui.copyFormat === 'tabs') return rows.map((r) => r.join('\t')).join('\n');
    return rows.map((r) => r.map((v, i) => (numeric[i] ? (v || '').padStart(widths[i]) : (v || '').padEnd(widths[i]))).join('  ').replace(/\s+$/, '')).join('\n');
  }
  function nodeToText(root) {
    const clone = root.cloneNode(true);
    clone.querySelectorAll('.tag, button, .no-copy, input, select, .table-tools, script, style').forEach((n) => n.remove());
    // Tables that were cloned from a selection may have lost their <table>.
    const loose = [...clone.children].filter((c) => /^(TR|TBODY|THEAD)$/.test(c.tagName));
    if (loose.length) { const t = document.createElement('table'); loose.forEach((c) => t.appendChild(c)); clone.appendChild(t); }
    // Cards laid out side by side on screen read as one line each in text.
    const line = (el, txt) => { const d = document.createElement('div'); d.textContent = txt.replace(/\s+/g, ' ').trim(); el.replaceWith(d); };
    const txt = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');
    clone.querySelectorAll('.stat').forEach((el) => line(el, `${txt(el.querySelector('.v'))} ${txt(el.querySelector('.l')).toLowerCase()}`));
    clone.querySelectorAll('.hl').forEach((el) => {
      const type = el.querySelector('.hl-type');
      const base = type ? [...type.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(' ').trim() : '';
      const team = txt(el.querySelector('.hl-team'));
      const tags = [...el.querySelectorAll('.hl-tag')].map(txt).filter(Boolean);
      const game = txt(el.querySelector('.hl-main .small-note'));
      line(el, `${txt(el.querySelector('.hl-when'))} | ${base}${team ? ` (${team})` : ''}${tags.length ? ` [${tags.join(', ')}]` : ''}: ${txt(el.querySelector('.hl-text'))}${game ? ` (${game})` : ''}`);
    });
    clone.querySelectorAll('.teams').forEach((el) => line(el, [...el.children].map(txt).join(' ')));
    clone.querySelectorAll('.game .meta').forEach((el) => line(el, [...el.children].map(txt).join(' · ')));
    clone.querySelectorAll('.leader').forEach((el) => {
      const who = el.querySelector('.who');
      if (who) who.querySelectorAll('.small-note, span').forEach((n) => { n.textContent = ` ${n.classList.contains('small-note') ? `(${n.textContent.trim()})` : n.textContent.trim()}`; });
      line(el, `${txt(who)}: ${txt(el.querySelector('.n'))}`);
    });
    clone.querySelectorAll('.posbar').forEach((el) => line(el, `${txt(el.querySelector('.p'))} ${txt(el.querySelector('.m'))}`));
    clone.querySelectorAll('.game').forEach((el) => { const d = document.createElement('div'); d.innerHTML = el.innerHTML; d.appendChild(document.createElement('br')); el.replaceWith(d); });
    for (const t of [...clone.querySelectorAll('table')]) {
      const live = document.createElement('table');
      live.innerHTML = t.innerHTML;
      const pre = document.createElement('pre');
      pre.textContent = tableToText(live);
      t.replaceWith(pre);
    }
    const holder = document.createElement('div');
    holder.className = 'copy-holder';
    holder.style.cssText = 'position:fixed;left:-100000px;top:0;width:1200px;white-space:normal';
    holder.appendChild(clone);
    document.body.appendChild(holder);
    const text = holder.innerText;
    holder.remove();
    return text.replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  async function copyText(text) {
    // Discord and most chat apps line columns up only inside a code block.
    if (ui.copyFormat === 'discord' && text && !text.startsWith('```')) text = '```\n' + text.replace(/```/g, "'''") + '\n```';
    try { if (window.m26 && window.m26.copyText) { await window.m26.copyText(text); return true; } } catch { /* fall through */ }
    try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
  function copied(btn, ok) {
    if (!btn) return;
    const was = btn.dataset.label || btn.textContent;
    btn.dataset.label = was;
    btn.textContent = ok ? 'Copied ✓' : 'Copy failed';
    btn.classList.toggle('ok', ok);
    setTimeout(() => { btn.textContent = was; btn.classList.remove('ok'); }, 1600);
  }
  // Ctrl+C or right-click Copy on anything selected in the app: plain text only.
  document.addEventListener('copy', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) return;
    const div = document.createElement('div');
    for (let i = 0; i < sel.rangeCount; i++) div.appendChild(sel.getRangeAt(i).cloneContents());
    const text = nodeToText(div);
    if (!text) return;
    e.clipboardData.setData('text/plain', text);
    e.preventDefault();
  });

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
    const mine = myTeam();
    const body = sorted.map((r) => `<tr class="${mine && (r.teamId === mine) ? 'mine' : ''}">${cols.map((c) => `<td class="${c.left ? 'left' : 'num'}">${c.render ? c.render(r) : fmt(r[c.key], c.d || 0)}${c.src && r.source ? tag(r.source[c.src]) : c.src && r.sources ? tag(r.sources[c.src]) : ''}</td>`).join('')}</tr>`).join('');
    return `<div class="table-tools"><button class="small" data-copy-table="${id}" title="Copy this table as plain text, ready to paste anywhere">Copy</button><button class="small" data-csv="${id}" title="Save this table as a CSV file for Excel or Google Sheets">Export CSV</button></div><div class="${maxHeight ? 'table-wrap' : ''}"><table class="data" id="${id}"><thead><tr>${head}</tr></thead><tbody>${body || `<tr><td colspan="${cols.length}" class="left muted">Nothing to show yet.</td></tr>`}</tbody></table></div>`;
  }
  document.addEventListener('click', (e) => {
    const th = e.target.closest('th[data-sort]');
    if (!th) return;
    const id = th.dataset.table;
    const cur = state.sort[id] || {};
    state.sort[id] = { key: th.dataset.sort, dir: cur.key === th.dataset.sort ? -cur.dir : 1 };
    render();
  });

  const playerCell = (r) => `${r.playerId ? `<a href="#" class="plink" data-player="${esc(r.playerId)}" title="Game log">` : ''}<b>${esc(r.name)}</b>${r.playerId ? '</a>' : ''} <span class="muted">${esc(r.position)}${r.teamId && !state.teamId ? ' · ' + esc(abbr(r.teamId)) : ''}</span>`;

  function leaders(title, rows, key, { d = 0, suffix = '', n = ui.leaderLength || 8 } = {}) {
    return `<div class="card"><h3>${esc(title)}</h3>${(rows || []).slice(0, n).map((r) => `<div class="leader"><div class="who">${esc(r.name)}<span>${esc(r.position)} · ${esc(abbr(r.teamId))}</span></div><div class="n">${fmt(r[key], d)}${suffix}</div></div>`).join('') || '<div class="muted">No games yet.</div>'}</div>`;
  }

  // ---------- franchise files sitting on this PC
  async function localCard(open) {
    let found = { files: [], searched: [] };
    try { found = await api('/franchise/detect'); } catch { /* listed as none */ }
    const list = found.files.length
      ? `<ul class="list">${found.files.map((f) => `<li><span><b>${esc(f.league)}</b> <span class="muted">· Madden ${f.year || '?'} · saved ${esc(new Date(f.modified).toLocaleString())}</span><br><span class="small-note mono">${esc(f.path)}</span></span><button class="small blue" data-open-recent="${esc(f.path)}">Open</button></li>`).join('')}</ul>`
      : `<p class="small-note">No franchise files found on this PC. Looked in: ${found.searched.length ? found.searched.map((d) => `<span class="mono">${esc(d)}</span>`).join(', ') : 'nowhere, no Madden folder exists here'}.</p>`;
    return `<div class="card">
      <h3>Franchise file on this PC (unlocks the injury tool)</h3>
      <p>Only a PC franchise file can be written to, so this is the only way to use the injury tool, and it is the only way to get real snap counts and pancakes instead of reconstructed ones.</p>
      <p>${open ? `<span class="pill win">Open</span> <span class="mono">${esc(state.status.filePath)}</span>` : '<span class="pill">No file open</span>'}</p>
      ${list}
      <div class="toolbar"><button class="primary" id="c-open">Browse for a file</button>${open ? '<button id="c-close">Close file</button>' : ''}</div>
      ${!window.m26 ? '<div class="toolbar"><input type="text" id="c-path" placeholder="Paste the full path to the CAREER file" style="min-width:360px"><button id="c-open-path">Open path</button></div>' : ''}
      <p class="small-note">Be out of the franchise in Madden when you write injuries, then load it again in game.</p>
    </div>`;
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
        ? `<div class="plan"><b>Which profile plays Madden ${eaUI.pending.year}?</b>${(eaUI.pending.ownedYears || []).length > 1 ? `<div class="small-note">This account has Madden ${eaUI.pending.ownedYears.join(' and ')}. Cancel and change the year above to use a different one.</div>` : ''}${eaUI.pending.profiles.map((p) => `<label style="display:block;margin:6px 0"><input type="radio" name="ea-profile" value="${esc(p.personaId)}" data-console="${esc(p.console)}" ${eaUI.pending.profiles.length === 1 ? 'checked' : ''}> ${esc(p.displayName)} <span class="muted">· ${esc(p.consoleLabel)} (${esc(p.namespaceLabel)})</span></label>`).join('')}<div class="modal-actions"><button id="ea-cancel">Cancel</button><button class="primary" id="ea-choose" ${eaUI.busy ? 'disabled' : ''}>Continue</button></div></div>`
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
      <p><span class="pill win">Signed in</span> <b>${esc(ea.profile.displayName)}</b> <span class="muted">· ${esc(ea.profile.consoleLabel)} · Madden ${ea.year} · ${ea.encrypted ? 'sign-in sealed with the Windows keychain' : 'sign-in saved unencrypted (no keychain on this system)'}</span></p>
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
      eaUI.pending = { handle: r.handle, profiles: r.profiles, year: r.year, ownedYears: r.ownedYears || [] };
      eaUI.year = r.year;
      eaUI.busy = false;
      if (r.requestedYear && r.year !== r.requestedYear) banner(`This EA account does not have Madden ${r.requestedYear}. Using Madden ${r.year}, which it does have.`, '');
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
      banner(`<b>Could not finish the EA sign-in.</b><br>${esc(e.message)}${e.help ? `<br><br>${esc(e.help)}` : ''}`, 'error');
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
    ui = { ...UI_DEFAULTS, ...((state.status.settings && state.status.settings.ui) || {}) };
    applyUi();
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
    if (ui.autoReload) noteFileTime();
    const [l, s] = await Promise.all([api(`/leagues/${state.leagueKey}`), api(`/leagues/${state.leagueKey}/schedule`)]);
    state.league = l.league;
    state.schedule = s.games;
    if (!state.schedule.some((g) => g.stage === state.stage && g.status === 'played')) {
      const first = state.schedule.find((g) => g.status === 'played');
      if (first) state.stage = first.stage;
    }
    // Anything picked in another league means nothing in this one.
    const ids = new Set(state.league.teams.map((t) => t.teamId));
    if (!ids.has(state.teamId)) state.teamId = '';
    if (!ids.has(state.weeklyTeam)) state.weeklyTeam = null;
    if (!ids.has(state.contractsTeam)) state.contractsTeam = null;
    if (!ids.has(state.gameTeam)) state.gameTeam = null;
    if (state.gameId && !state.schedule.some((g) => g.gameId === state.gameId)) { state.gameId = null; if (state.section === 'game') state.section = 'schedule'; }
    state.recapKey = null;
    if (ui.myTeamFilter && myTeam() && ids.has(myTeam()) && !state.teamId) state.teamId = myTeam();
    if (ui.defaultStage !== 'auto' && state.schedule.some((g) => g.stage === ui.defaultStage)) state.stage = ui.defaultStage;
    const ts = $('#team-select');
    ts.innerHTML = '<option value="">All teams</option>' + state.league.teams.map((t) => `<option value="${esc(t.teamId)}">${esc(t.abbr)} — ${esc(t.displayName)}</option>`).join('');
    ts.value = state.teamId;
    $('#stage-select').value = state.stage;
    fillWeeks();
    render();
  }

  // Weeks of the chosen part of the season that have at least one game.
  function weeksInStage() {
    if (!state.league || state.stage === 'all') return [];
    const seen = new Map();
    for (const g of state.schedule) if (g.stage === state.stage && !seen.has(g.week)) seen.set(g.week, { week: g.week, label: g.label, played: false });
    for (const g of state.schedule) if (g.stage === state.stage && g.status === 'played') seen.get(g.week).played = true;
    return [...seen.values()].sort((a, b) => a.week - b.week);
  }
  function fillWeeks() {
    const sel = $('#week-select');
    const weeks = weeksInStage();
    if (!weeks.some((w) => String(w.week) === String(state.week))) state.week = '';
    const first = state.section === 'highlights' ? 'Latest week' : 'All weeks';
    sel.innerHTML = `<option value="">${first}</option>` + weeks.map((w) => `<option value="${w.week}" ${w.played ? '' : 'disabled'}>${esc(w.label)}${w.played ? '' : ' (not played)'}</option>`).join('');
    sel.value = state.week;
    sel.disabled = state.stage === 'all';
  }
  const weekText = () => (state.week && state.stage !== 'all' ? ` · ${esc((weeksInStage().find((w) => String(w.week) === String(state.week)) || {}).label || 'week ' + state.week)}` : '');

  async function season() {
    const week = state.stage === 'all' ? '' : state.week;
    const key = `${state.leagueKey}|${state.stage}|${state.teamId}|${week}`;
    if (!state.seasonCache.has(key)) state.seasonCache.set(key, api(`/leagues/${state.leagueKey}/season?stage=${state.stage}&teamId=${encodeURIComponent(state.teamId)}&week=${week}`).then((r) => r.totals));
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
      <p class="lead">Sign in with EA and your online franchises are listed here. Click one and the stats load. The other two ways in are below it.</p>
      ${await eaCard()}
      <div class="grid cols-2">
        ${await localCard(open)}
        <div class="card">
          <h3>Madden Companion App export</h3>
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
    const games = state.schedule.filter((g) => (state.stage === 'all' || g.stage === state.stage) && (!state.week || state.stage === 'all' || g.week === Number(state.week)) && (!state.teamId || g.homeTeamId === state.teamId || g.awayTeamId === state.teamId));
    const byWeek = new Map();
    for (const g of games) { const k = `${g.stage}:${g.week}`; if (!byWeek.has(k)) byWeek.set(k, []); byWeek.get(k).push(g); }
    return `
      <h1>Schedule &amp; Injury Tool</h1>
      <p class="lead">Pick any game. Played games open on their highlights, with the advanced stats a tab away. Games still to play open on the matchup preview: who wins the one-on-ones up front and how to plan for it. Or choose a player and injure him in any game: the injury lands on a random play and is written into the franchise file with the type, side and weeks you choose.</p>
      ${canEditSchedule() ? await scheduleChangesHtml() : ''}
      ${weeks.length ? [...byWeek.entries()].map(([k, list]) => `<h2>${esc(list[0].label)}</h2><div class="games">${list.map(gameCard).join('')}</div>`).join('') : '<div class="empty">No games in this part of the season.</div>'}
    `;
  };

  async function scheduleChangesHtml() {
    let r;
    try { r = await api(`/leagues/${state.leagueKey}/schedule/changes`); } catch { return ''; }
    const live = r.entries.filter((e) => !e.undone);
    if (!r.entries.length) return '<p class="small-note">To swap who a team plays in a game that has not been played yet, use <b>Change matchup</b> on the game.</p>';
    return `<div class="card"><h3>Schedule changes you made (${live.length} active)</h3><ul class="list">${r.entries.slice(0, 12).map((e) => `<li><span>${e.lines.map(esc).join('<br>')}<div class="small-note">${esc(new Date(e.at).toLocaleString())}${e.undone ? ' · undone' : ''}</div></span>${e.undone ? '' : `<button class="small" data-undo-sched="${esc(e.id)}">Undo</button>`}</li>`).join('')}</ul></div>`;
  }

  const canEditSchedule = () => Boolean(state.league && state.league.source === 'franchise');

  function gameCard(g) {
    const played = g.status === 'played';
    return `<div class="game ${played ? '' : 'unplayed'}" data-game="${esc(g.gameId)}">
      <div class="teams"><span>${esc(g.away)} ${played ? g.awayScore : ''}</span><span class="muted">@</span><span>${esc(g.home)} ${played ? g.homeScore : ''}</span></div>
      <div class="meta"><span>${esc(g.awayName)} at ${esc(g.homeName)}</span><span>${played ? (g.isSimmed ? 'Simmed' : 'Final') : 'Not played'}</span></div>
      <div class="actions">${played ? `<button class="small blue" data-open-game="${esc(g.gameId)}" data-open-tab="highlights">Highlights</button><button class="small" data-open-game="${esc(g.gameId)}" data-open-tab="box">Box score</button>` : `<button class="small blue" data-open-game="${esc(g.gameId)}" data-open-tab="preview">Matchup preview</button>${canEditSchedule() && ['PreSeason', 'RegularSeason'].includes(g.weekType) ? `<button class="small" data-sched="${esc(g.gameId)}">Change matchup</button>` : ''}`}<button class="small" data-injure="${esc(g.gameId)}">Injure a player</button></div>
    </div>`;
  }

  sections.game = async () => {
    const g = state.schedule.find((x) => x.gameId === state.gameId);
    if (!g) return '<div class="empty">Pick a game from the schedule.</div>';
    const played = g.status === 'played';
    const tabs = played
      ? [['highlights', 'Highlights'], ['box', 'Box score'], ['preview', 'Matchup preview'], ['blocking', 'Blocking'], ['passrush', 'Pass Rush'], ['snaps', 'Snap Counts'], ['receiving', 'Targets & Drops'], ['tackling', 'Missed Tackles'], ['penalties', 'Penalties'], ['injuries', 'Injuries']]
      : [['preview', 'Matchup preview']];
    if (!tabs.some(([k]) => k === state.gameTab)) state.gameTab = tabs[0][0];
    if (![g.homeTeamId, g.awayTeamId].includes(state.gameTeam)) state.gameTeam = g.homeTeamId;
    let body = '';
    let result = null;
    let t = null;
    if (!['highlights', 'preview', 'box'].includes(state.gameTab)) {
      result = (await api(`/leagues/${state.leagueKey}/games/${g.gameId}/stats`)).result;
      t = result.teams[state.gameTeam];
    }
    if (state.gameTab === 'highlights') {
      body = await gameHighlights(g);
    } else if (state.gameTab === 'box') {
      body = await gameBoxScore(g);
    } else if (state.gameTab === 'preview') {
      body = await gamePreview(g);
    } else if (state.gameTab === 'blocking') {
      const s = t.blocking.summary;
      body = `<div class="stat-row card"><div class="stat"><div class="v">${s.pressuresAllowed}${tag(s.pressureSource)}</div><div class="l">pressures allowed</div></div><div class="stat"><div class="v">${s.sacksAllowed}</div><div class="l">sacks allowed</div></div><div class="stat"><div class="v">${s.hitsAllowed}</div><div class="l">QB hits</div></div><div class="stat"><div class="v">${s.hurriesAllowed}</div><div class="l">hurries</div></div><div class="stat"><div class="v">${s.nearSacksAllowed}</div><div class="l">almost sacks</div></div><div class="stat"><div class="v">${s.pressureRate}%</div><div class="l">pressure rate</div></div><div class="stat"><div class="v">${s.pancakes}</div><div class="l">pancakes</div></div><div class="stat"><div class="v">${s.dropbacks}</div><div class="l">dropbacks</div></div></div>
        ${s.bestBlocker ? `<p><b>Best blocker:</b> ${esc(s.bestBlocker.name)} (${esc(s.bestBlocker.position)}) grade ${s.bestBlocker.grade}, ${s.bestBlocker.pressuresAllowed} pressures allowed, ${s.bestBlocker.pancakes} pancakes. <b>Most beaten:</b> ${s.mostBeaten ? `${esc(s.mostBeaten.name)} (${esc(s.mostBeaten.position)}) ${s.mostBeaten.pressuresAllowed} pressures allowed` : '—'}</p>` : ''}
        ${legend()}
        ${s.expectedPressures != null ? `<p class="small-note">The model expected ${fmt(s.expectedPressures, 1)} pressures from these matchups. Run blocking: ${s.runBlockWinRate != null ? `${fmt(s.runBlockWinRate, 0)}% of run blocks won` : '—'}${s.yardsBeforeContact != null ? `, ${fmt(s.yardsBeforeContact, 1)} yards before contact per carry` : ''}${s.leagueYardsBeforeContact != null ? ` (league ${fmt(s.leagueYardsBeforeContact, 1)})` : ''}.${s.unblockedPressures ? ` ${s.unblockedPressures} pressure(s) came from rushers nobody blocked.` : ''}</p>` : ''}
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
      body = `<div class="stat-row card"><div class="stat"><div class="v">${s.passAttempts}</div><div class="l">pass attempts</div></div><div class="stat"><div class="v">${s.targets}</div><div class="l">targets</div></div><div class="stat"><div class="v">${s.throwaways ?? 0}</div><div class="l">thrown away under pressure</div></div><div class="stat"><div class="v">${s.drops}</div><div class="l">drops</div></div><div class="stat"><div class="v">${s.dropRate}%</div><div class="l">drop rate</div></div></div>${legend()}${table('g-rec', t.receiving.players, REC_COLS, { defaultSort: 'targets' })}`;
    } else if (state.gameTab === 'tackling') {
      const s = t.tackling.summary;
      body = `<div class="stat-row card"><div class="stat"><div class="v">${s.missedTackles}</div><div class="l">missed tackles</div></div><div class="stat"><div class="v">${s.brokenTacklesAllowed}</div><div class="l">broken tackles allowed (recorded)</div></div>${s.missedAfterCatch != null ? `<div class="stat"><div class="v">${s.missedAfterCatch}</div><div class="l">missed after the catch</div></div>` : ''}<div class="stat"><div class="v">${s.tackles}</div><div class="l">tackles</div></div><div class="stat"><div class="v">${s.assists}</div><div class="l">assists</div></div></div><p class="small-note">Source: ${esc(s.source)}</p>${legend()}${table('g-tkl', t.tackling.players, TKL_COLS, { defaultSort: 'missedTackles' })}`;
    } else if (state.gameTab === 'penalties') {
      const s = t.penalties.summary;
      body = `<div class="stat-row card"><div class="stat"><div class="v">${s.penalties}</div><div class="l">penalties</div></div><div class="stat"><div class="v">${s.yards}</div><div class="l">yards</div></div><div class="stat"><div class="v">${s.recordedPenalties} / ${s.recordedYards}</div><div class="l">recorded team total</div></div></div>${legend()}${table('g-pen', t.penalties.players.map((p) => ({ ...p, typeList: p.types.map((x) => `${x.type} (${x.yards})`).join(', ') })), PEN_COLS, { defaultSort: 'penalties' })}`;
    } else if (state.gameTab === 'injuries') {
      const rep = result.injuryReport || { injuries: [], counts: { total: 0, minor: 0, out: 0, byTeam: {} }, sources: {} };
      const c = rep.counts;
      const hurt = rep.injuries.filter((i) => i.where !== 'week');
      const week = rep.injuries.filter((i) => i.where === 'week');
      body = `<div class="stat-row card"><div class="stat"><div class="v">${c.total}</div><div class="l">hurt in this game</div></div><div class="stat"><div class="v">${c.minor}</div><div class="l">minor (part of a game)</div></div><div class="stat"><div class="v">${c.out}</div><div class="l">miss next week or more</div></div><div class="stat"><div class="v">${c.byTeam[g.awayTeamId] || 0} / ${c.byTeam[g.homeTeamId] || 0}</div><div class="l">${esc(g.away)} / ${esc(g.home)}</div></div>${c.alsoThisWeek ? `<div class="stat"><div class="v">${c.alsoThisWeek}</div><div class="l">also hurt this week</div></div>` : ''}</div>
        <h3>Hurt in this game (${hurt.length})</h3>
        ${hurt.length ? injuryTable('g-inj', hurt) : '<div class="muted">Nobody on either team got hurt in this game, as far as the save and the tool have seen.</div>'}
        ${week.length ? `<h3>Also on Madden's injury report this week (${week.length})</h3><p class="small-note">Dated to this game's week, but they have no stats in this game: hurt in practice, before kickoff, or they did not play.</p>${injuryTable('g-inj-week', week)}` : ''}
        <p class="small-note">${rep.sources.exportOnly
          ? 'A Companion App / EA export only lists who is hurt when you export. The tool remembers every injury it sees, and an injury that first shows up in the export right after this game is listed here. Export after every game so none are missed; the first export can only show who was already hurt.'
          : "Listed from Madden's post-game injury list, Madden's injury report (every injury dated to this game's week, including the small ones that heal before next week), injuries the tool remembered from earlier loads after they healed, and anything added with the injury tool. \"In the game\" shows whether he has stats in this game."}</p>`;
    }
    const teamPick = ['highlights', 'box'].includes(state.gameTab) ? '' : `<div class="field"><span>Team</span><select id="game-team"><option value="${esc(g.homeTeamId)}" ${state.gameTeam === g.homeTeamId ? 'selected' : ''}>${esc(g.homeName)}</option><option value="${esc(g.awayTeamId)}" ${state.gameTeam === g.awayTeamId ? 'selected' : ''}>${esc(g.awayName)}</option></select></div>`;
    return `
      <button id="back-sched">← ${({ highlights: 'Highlights', recap: 'Weekly Recap', contracts: 'Contracts', teams: state.teamPage ? teamName(state.teamPage).displayName : 'Teams' })[state.backTo] || 'Schedule'}</button>
      <h1>${esc(g.label)}: ${played ? `${esc(g.away)} ${g.awayScore} @ ${esc(g.home)} ${g.homeScore}` : `${esc(g.away)} @ ${esc(g.home)} <span class="pill">Not played yet</span>`}</h1>
      <div class="toolbar">${teamPick}<button data-injure="${esc(g.gameId)}">Injure a player in this game</button>${played ? `<button data-track="${esc(g.gameId)}">Log events in the Game Tracker</button>` : canEditSchedule() && ['PreSeason', 'RegularSeason'].includes(g.weekType) ? `<button data-sched="${esc(g.gameId)}">Change matchup</button>` : ''}<a href="#" class="small" data-team-page="${esc(g.awayTeamId)}">${esc(g.away)} team page</a><a href="#" class="small" data-team-page="${esc(g.homeTeamId)}">${esc(g.home)} team page</a></div>
      <div class="tabs">${tabs.map(([k, l]) => `<button class="${state.gameTab === k ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
      ${body}`;
  }

  const faced = (r) => (r.faced ? `<span class="muted">${esc(r.faced.position)}</span> ${esc(r.faced.name)} <span class="muted">(won ${fmt(r.faced.winPct, 0)}%)</span>` : '—');
  const BLOCK_COLS = [
    { key: 'name', label: 'Blocker', left: true, render: playerCell },
    { key: 'blockGrade', label: 'Grade' },
    { key: 'passGrade', label: 'Pass grade' },
    { key: 'runGrade', label: 'Run grade' },
    { key: 'snaps', label: 'Snaps', src: 'snaps' },
    { key: 'passBlockSnaps', label: 'Pass blk' },
    { key: 'runBlockSnaps', label: 'Run blk' },
    { key: 'pressuresAllowed', label: 'Press allowed', src: 'pressures' },
    { key: 'expectedPressures', label: 'Expected', d: 1 },
    { key: 'hurriesAllowed', label: 'Hurries' },
    { key: 'hitsAllowed', label: 'QB hits' },
    { key: 'sacksAllowed', label: 'Sacks', src: 'sacksAllowed' },
    { key: 'nearSacksAllowed', label: 'Almost sacks' },
    { key: 'cleanPassSnaps', label: 'Clean snaps' },
    { key: 'faced', label: 'Main rusher faced', left: true, render: faced },
    { key: 'passBlockEfficiency', label: 'PBE', d: 1 },
    { key: 'avgTimeHeld', label: 'Held (s)', d: 2, src: 'timing' },
    { key: 'timeToPressure', label: 'Time to press (s)', d: 2 },
    { key: 'runBlockWinRate', label: 'Run win %', d: 1, src: 'run' },
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
    { key: 'airYards', label: 'Air yds' },
    { key: 'yac', label: 'YAC' },
    { key: 'yardsPerTarget', label: 'Yds/target', d: 1 },
    { key: 'tds', label: 'TD' },
    { key: 'snaps', label: 'Snaps', src: 'snaps' },
  ];
  const TKL_COLS = [
    { key: 'name', label: 'Defender', left: true, render: playerCell },
    { key: 'tackles', label: 'Tackles', src: 'tackles' },
    { key: 'assists', label: 'Assists' },
    { key: 'missedTackles', label: 'Missed', src: 'missedTackles' },
    { key: 'missedRun', label: 'On runs' },
    { key: 'missedPass', label: 'After catch' },
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
    { key: 'passGrade', label: 'Pass grade' },
    { key: 'runGrade', label: 'Run grade' },
    { key: 'snaps', label: 'Snaps', src: 'snaps' },
    { key: 'passBlockSnaps', label: 'Pass blk' },
    { key: 'pressuresAllowed', label: 'Press allowed', src: 'pressures' },
    { key: 'expectedPressures', label: 'Expected', d: 1 },
    { key: 'pressureRate', label: 'Press %', d: 1 },
    { key: 'hurriesAllowed', label: 'Hurries' },
    { key: 'hitsAllowed', label: 'QB hits' },
    { key: 'sacksAllowed', label: 'Sacks', src: 'sacksAllowed' },
    { key: 'nearSacksAllowed', label: 'Almost sacks' },
    { key: 'passBlockEfficiency', label: 'PBE', d: 1 },
    { key: 'avgTimeHeld', label: 'Held (s)', d: 2 },
    { key: 'runBlockWinRate', label: 'Run win %', d: 1 },
    { key: 'pancakes', label: 'Pancakes', src: 'pancakes' },
    { key: 'pancakeRate', label: 'Pancake %', d: 1 },
    { key: 'penalties', label: 'Flags' },
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
    return `<h1>${title}</h1><p class="lead">${lead}</p><p class="muted">${s.games} game(s) · ${esc({ pre: 'preseason', reg: 'regular season', post: 'playoffs', all: 'all games' }[state.stage])}${weekText()}${state.teamId ? ' · ' + esc(teamName(state.teamId).displayName) : ''}</p>${legend()}${build(s)}`;
  }

  const blockToggle = () => `<div class="seg"><button class="${state.blockView === 'season' ? 'active' : ''}" data-bview="season">${state.week ? 'This week' : 'Season totals'}</button><button class="${state.blockView === 'weekly' ? 'active' : ''}" data-bview="weekly">Week by week</button></div>`;
  sections.blocking = () => (state.blockView === 'weekly' ? blockingWeekly() : seasonSection('Advanced Blocking', 'Pressures, hurries, QB hits and sacks allowed by every blocker, pancakes, run-block wins, how long each blocker keeps the rusher off the quarterback, and pass, run and overall grades. Pick a week at the top to see one week, or switch to week by week to follow each blocker through the season.', (s) => `
    ${blockToggle()}
    <div class="grid cols-4">${leaders('Best blockers (grade)', s.leaders.bestBlockers, 'blockGrade')}${leaders('Worst blockers (grade)', s.leaders.worstBlockers, 'blockGrade')}${leaders('Most pressures allowed', s.leaders.mostPressuresAllowed, 'pressuresAllowed')}${leaders('Most sacks allowed', s.leaders.mostSacksAllowed, 'sacksAllowed')}</div>
    <div class="grid cols-3" style="margin-top:14px">${leaders('Best run blockers (run grade)', s.leaders.bestRunBlockers, 'runGrade')}${leaders('Most pancakes', s.leaders.mostPancakes, 'pancakes')}${leaders('Longest hold before pressure', s.leaders.longestHold, 'avgTimeHeld', { d: 2, suffix: 's' })}</div>
    <h2>All blockers</h2>${table('s-block', s.blocking.players, SEASON_BLOCK_COLS, { defaultSort: 'blockGrade' })}`));

  const gradeClass = (g) => (g == null ? '' : g >= 80 ? 'g-elite' : g >= 68 ? 'g-good' : g >= 52 ? 'g-avg' : g >= 40 ? 'g-poor' : 'g-bad');
  const shortWeek = (w) => String(w.label || '').replace(/^Preseason\s*/i, 'P').replace(/^Week\s*/i, 'W');

  async function blockingWeekly() {
    if (!state.league) return '<div class="empty">Connect a franchise first.</div>';
    const teams = state.league.teams;
    const valid = (id) => teams.some((t) => t.teamId === id);
    const teamId = [state.teamId, state.weeklyTeam].find(valid) || (teams[0] || {}).teamId;
    state.weeklyTeam = teamId;
    const r = await api(`/leagues/${state.leagueKey}/blocking/weekly?stage=${state.stage}&teamId=${encodeURIComponent(teamId)}`);
    const pick = state.teamId ? '' : `<div class="field"><span>Team</span><select id="bw-team">${teams.map((t) => `<option value="${esc(t.teamId)}" ${t.teamId === teamId ? 'selected' : ''}>${esc(t.abbr)} — ${esc(t.displayName)}</option>`).join('')}</select></div>`;
    const weeks = r.weeks;
    const head = `<tr><th class="left">Blocker</th><th>Season</th><th>Trend</th>${weeks.map((w) => `<th title="${esc(w.label)}">${esc(shortWeek(w))}<div class="small-note">${w.home ? 'vs' : '@'} ${esc(w.opponent)}</div></th>`).join('')}</tr>`;
    const teamRow = `<tr class="teamrow"><td class="left"><b>${esc(abbr(teamId))} line</b><div class="small-note">pressures / sacks allowed</div></td><td></td><td></td>${weeks.map((w) => (w.team ? `<td><b>${w.team.pressuresAllowed}</b> / ${w.team.sacksAllowed}<div class="small-note">${fmt(w.team.pressureRate, 0)}% · exp ${fmt(w.team.expectedPressures, 1)}</div></td>` : '<td class="muted">—</td>')).join('')}</tr>`;
    const rows = r.players.map((p) => `<tr><td class="left">${playerCell({ ...p, teamId })}</td><td class="gcell ${gradeClass(p.season.blockGrade)}"><b>${fmt(p.season.blockGrade)}</b><div class="small-note">${p.season.pressuresAllowed}p ${p.season.sacksAllowed}sk</div></td><td>${p.trend ? `<span class="trend ${p.trend.direction}" title="Last 3 games vs the ones before">${p.trend.direction === 'up' ? '▲' : p.trend.direction === 'down' ? '▼' : '■'} ${p.trend.delta > 0 ? '+' : ''}${p.trend.delta}</span>` : '<span class="muted">—</span>'}</td>${weeks.map((w) => { const c = p.weeks[w.key]; return c ? `<td class="gcell ${gradeClass(c.grade)}" title="${esc(w.label)}: grade ${c.grade}, ${c.pressuresAllowed} pressures and ${c.sacksAllowed} sacks allowed"><b>${c.grade}</b><div class="small-note">${c.pressuresAllowed}p${c.sacksAllowed ? ` ${c.sacksAllowed}sk` : ''}</div></td>` : '<td class="muted">—</td>'; }).join('')}</tr>`).join('');
    return `<h1>Advanced Blocking</h1>
      <p class="lead">Every blocker's grade in every game, with the pressures (p) and sacks (sk) he allowed. The numbers update each week as new games come in. The trend compares his last three games with the rest of his season.</p>
      ${blockToggle()}
      <div class="toolbar">${pick}</div>
      <div class="legend"><span class="gchip g-elite">80+</span> elite <span class="gchip g-good">68-79</span> good <span class="gchip g-avg">52-67</span> average <span class="gchip g-poor">40-51</span> poor <span class="gchip g-bad">under 40</span> bad</div>
      ${weeks.length ? `<div class="table-tools"><button class="small" data-copy-table="bw-grid">Copy</button></div><div class="table-wrap"><table class="data weekly" id="bw-grid">${head}${teamRow}${rows}</table></div>` : '<div class="empty">This team has no games in this part of the season yet.</div>'}`;
  }

  sections.passrush = () => seasonSection('Pass Rush & Missed Sacks', 'Pressures created by every defender, sacks (recorded by Madden), QB hits, hurries, and the sacks they had and let get away.', (s) => `
    <div class="grid cols-3">${leaders('Most pressures', s.leaders.mostPressures, 'pressures')}${leaders('Most sacks', s.leaders.mostSacks, 'sacks', { d: 1 })}${leaders('Most missed sacks', s.leaders.mostMissedSacks, 'missedSacks')}</div>
    <h2>All pass rushers</h2>${table('s-rush', s.passRush.players.map((r) => ({ ...r, games: r.games })), [{ key: 'name', label: 'Rusher', left: true, render: playerCell }, { key: 'games', label: 'G' }, ...RUSH_COLS.slice(1)], { defaultSort: 'pressures' })}`);

  sections.snaps = () => seasonSection('Snap Counts', 'Offensive, defensive and special-teams snaps for every player. From a PC franchise file these are the real numbers Madden recorded; from a Companion App export they are rebuilt from the play count and the box score.', (s) => `
    <div class="grid cols-2">${leaders('Most total snaps', s.leaders.mostSnaps, 'total')}<div class="card"><h3>Team play counts</h3>${Object.values(s.teams).map((t) => `<div class="leader"><div class="who">${esc(abbr(t.teamId))}<span>${t.games} g</span></div><div class="n">${t.offPlays} off · ${t.defPlays} def</div></div>`).join('')}</div></div>
    <h2>All players</h2>${table('s-snaps', s.snaps.players, SEASON_SNAP_COLS, { defaultSort: 'total' })}`);

  sections.receiving = () => seasonSection('Targets & Drops', 'How many times each receiver was thrown to, what he caught, and what he dropped. Catches and drops are recorded by Madden. Targets are rebuilt from the passing totals: balls thrown away under pressure (from the blocking model) come off first, and the other incompletions go mostly to deep targets and shaky hands. An export with catch percentage is used as is.', (s) => `
    <div class="grid cols-3">${leaders('Most targets', s.leaders.mostTargets, 'targets')}${leaders('Most drops', s.leaders.mostDrops, 'drops')}${leaders('Worst drop rate (10+ targets)', s.leaders.worstDropRate, 'dropRate', { d: 1, suffix: '%' })}</div>
    <h2>All receivers</h2>${table('s-rec', s.receiving.players, [{ key: 'name', label: 'Receiver', left: true, render: playerCell }, { key: 'games', label: 'G' }, ...REC_COLS.slice(1)], { defaultSort: 'targets' })}`);

  sections.tackling = () => seasonSection('Missed Tackles', 'Tackles and assists are recorded by Madden. Missed tackles on runs come from the broken tackles Madden credited the runners with and land mostly on the front seven; missed tackles after the catch come from yards after catch and land mostly on whoever gave up the catch. Within each, the defender who was around the ball more and tackles worse gets charged. Logging the real ones in the Game Tracker replaces all of it.', (s) => `
    <div class="grid cols-3">${leaders('Most missed tackles', s.leaders.mostMissedTackles, 'missedTackles')}${leaders('Worst miss rate (10+ attempts)', s.leaders.worstMissRate, 'missRate', { d: 1, suffix: '%' })}${leaders('Surest tacklers (15+ attempts)', s.leaders.surestTacklers, 'missRate', { d: 1, suffix: '%' })}</div>
    <h2>All defenders</h2>${table('s-tkl', s.tackling.players, [{ key: 'name', label: 'Defender', left: true, render: playerCell }, { key: 'games', label: 'G' }, ...TKL_COLS.slice(1)], { defaultSort: 'missedTackles' })}`);

  sections.penalties = () => seasonSection('Penalties', 'Madden records the team penalty count and yards. The tool charges each flag to a player by position, awareness and playing time, and the other systems steer it: blockers who kept getting beaten draw the holding calls, corners giving up catches draw interference, rushers hitting the quarterback risk roughing. Penalty yards add up to the team total. Log the real flags in the Game Tracker to replace this.', (s) => `
    <div class="grid cols-2">${leaders('Most penalties', s.leaders.mostPenalties, 'penalties')}${leaders('Most penalty yards', s.leaders.mostPenaltyYards, 'yards', { suffix: ' yds' })}</div>
    <h2>All players with a flag</h2>${table('s-pen', s.penalties.players.map((p) => ({ ...p, typeList: Object.entries(p.types || {}).map(([t, n]) => `${t}${n > 1 ? ' ×' + n : ''}`).join(', ') })), SEASON_PEN_COLS, { defaultSort: 'penalties' })}`);

  // ---------- highlights
  const SRC_TITLE = {
    'play-by-play': 'From the play-by-play Madden saved for this game',
    'play-by-play + reconstructed': 'The play is from the play-by-play; who got beaten is the blocking model',
    'box score': 'From the box score Madden recorded',
    'box score (real play)': 'A real play, rebuilt exactly from the longest-play stats in the box score. The export has no play-by-play, so there is no clock time.',
    reconstructed: "From this tool's reconstructed stats",
    'injury report': "From Madden's injury report",
  };
  const srcShort = (src) => ({ 'play-by-play': 'PLAY', 'play-by-play + reconstructed': 'PLAY ~', 'box score': 'BOX', 'box score (real play)': 'REAL PLAY', reconstructed: '~', 'injury report': 'INJ' }[src] || '');

  function hlItem(m, { showGame = false } = {}) {
    const g = showGame ? state.schedule.find((x) => x.gameId === m.gameId) : null;
    return `<div class="hl ${m.kind}${showGame ? ' clickable' : ''}" ${showGame ? `data-hl-game="${esc(m.gameId)}"` : ''}>
      <div class="hl-when">${m.clock ? esc(m.clock) : '<span class="muted">game</span>'}</div>
      <div class="hl-main">
        <div class="hl-type">${esc(m.type)} <span class="hl-team">${esc(abbr(m.teamId))}</span>${(m.tags || []).map((t) => `<span class="hl-tag">${esc(t)}</span>`).join('')}</div>
        <div class="hl-text">${esc(m.text)}</div>
        ${g ? `<div class="small-note">${esc(g.away)} ${g.awayScore} @ ${esc(g.home)} ${g.homeScore}</div>` : ''}
      </div>
      <div class="hl-src" title="${esc(SRC_TITLE[m.source] || m.source)}">${esc(srcShort(m.source))}</div>
    </div>`;
  }
  const hlList = (items, empty, opts) => (items.length ? items.map((m) => hlItem(m, opts)).join('') : `<div class="muted">${empty}</div>`);
  const pbpNote = `<p class="small-note">PLAY = straight from the play-by-play in the franchise file (with the game clock). REAL PLAY = one real play rebuilt exactly from an export's box score. BOX = from the box score. ~ = from this tool's reconstructed stats. Companion App exports carry box scores only, so their games get box-score moments; open the PC franchise file for every touchdown, sack and pick with its time.</p>`;

  sections.highlights = async () => {
    if (!state.league) return '<div class="empty">Connect a franchise first.</div>';
    const played = state.schedule.filter((g) => g.status === 'played');
    if (!played.length) return '<h1>Highlights</h1><div class="empty">No games have been played yet.</div>';
    const q = new URLSearchParams();
    if (state.stage !== 'all') q.set('stage', state.stage);
    if (state.week && state.stage !== 'all') q.set('week', state.week);
    const r = await api(`/leagues/${state.leagueKey}/highlights/week?${q}`);
    const chips = state.schedule.filter((g) => g.stage === r.stage && g.status === 'played').reduce((m, g) => (m.some((x) => x.week === g.week) ? m : [...m, { week: g.week, label: g.label }]), []);
    const games = state.teamId ? r.games.filter((x) => x.game.homeTeamId === state.teamId || x.game.awayTeamId === state.teamId) : r.games;
    const keep = (m) => !state.teamId || m.teamId === state.teamId;
    const card = (x) => {
      const g = x.game;
      const winHome = g.homeScore > g.awayScore;
      return `<div class="game hlgame" data-hl-game="${esc(g.gameId)}">
        <div class="teams"><span class="${!winHome && g.awayScore !== g.homeScore ? 'won' : ''}">${esc(g.away)} ${g.awayScore}</span><span class="muted">@</span><span class="${winHome ? 'won' : ''}">${esc(g.home)} ${g.homeScore}</span></div>
        <div class="hl-headline small">${esc(x.headline)}</div>
        ${x.playerOfTheGame ? `<div class="small-note"><b>Player of the game:</b> ${esc(x.playerOfTheGame.name)} (${esc(x.playerOfTheGame.position)}, ${esc(abbr(x.playerOfTheGame.teamId))})${x.playerOfTheGame.line ? ` · ${esc(x.playerOfTheGame.line)}` : ''}</div>` : ''}
        ${x.worst ? `<div class="small-note lowtxt">▼ ${esc(x.worst.text)}</div>` : ''}
        <div class="meta"><span>${x.highlightCount} highlights · ${x.lowlightCount} lowlights</span><span>${x.hasPlayByPlay ? 'play-by-play' : 'box score'}</span></div>
      </div>`;
    };
    return `
      <div class="head-row"><h1>Highlights</h1><button class="blue" data-copy-block="hl-week-body">Copy as text</button></div>
      <p class="lead">The biggest plays and the worst moments of every game, in words: long touchdowns, game-winners, sacks, picks, comebacks, blown leads, drops, missed tackles and blown blocks. Click a game for all of its highlights and lowlights in order.</p>
      <div class="weekchips">${chips.map((c) => `<button class="${c.week === r.week ? 'active' : ''}" data-hl-week="${c.week}">${esc(c.label)}</button>`).join('')}</div>
      <div id="hl-week-body">
      <h2>${esc(r.label || '')}${state.teamId ? ` · ${esc(teamName(state.teamId).displayName)}` : ''}</h2>
      <div class="grid cols-2">
        <div class="card"><h3>Plays of the week</h3>${hlList(r.highlights.filter(keep), 'Nothing yet.', { showGame: true })}</div>
        <div class="card"><h3>Lowlights of the week</h3>${hlList(r.lowlights.filter(keep), 'Nothing yet.', { showGame: true })}</div>
      </div>
      <h2>Games</h2>
      <div class="games">${games.map(card).join('') || '<div class="muted">No games this week.</div>'}</div>
      </div>
      ${pbpNote}`;
  };

  function lineScoreHtml(g, ls) {
    if (!ls) return '';
    const tot = (r) => r.reduce((a, b) => a + b, 0);
    return `<table class="data compact linescore" id="ls-${esc(g.gameId)}"><thead><tr><th class="left">Team</th>${ls.labels.map((l) => `<th>${esc(l)}</th>`).join('')}<th>Final</th></tr></thead><tbody>
      <tr><td class="left"><b>${esc(g.away)}</b></td>${ls.away.map((v) => `<td>${v}</td>`).join('')}<td><b>${tot(ls.away)}</b></td></tr>
      <tr><td class="left"><b>${esc(g.home)}</b></td>${ls.home.map((v) => `<td>${v}</td>`).join('')}<td><b>${tot(ls.home)}</b></td></tr></tbody></table>`;
  }
  function breakdownHtml(g, bd) {
    if (!bd) return '';
    const cell = (b) => {
      const parts = [];
      if (b.passTD) parts.push(`${b.passTD} passing TD`);
      if (b.rushTD) parts.push(`${b.rushTD} rushing TD`);
      if (b.retTD) parts.push(`${b.retTD} return TD`);
      if (b.defTD) parts.push(`${b.defTD} defensive TD`);
      if (b.fgAtt) parts.push(`${b.fg}/${b.fgAtt} FG`);
      if (b.xpAtt) parts.push(`${b.xp}/${b.xpAtt} XP`);
      if (b.twoPt) parts.push(`${b.twoPt} two-point try`);
      if (b.safeties) parts.push(`${b.safeties} safety`);
      return parts.join(', ') || 'no points';
    };
    const row = (id, abbrv) => { const b = bd[id]; return `<tr><td class="left"><b>${esc(abbrv)}</b></td><td class="left">${esc(cell(b))}</td><td>${b.final}</td><td class="left">${b.complete ? '<span class="ol ol-minor">adds up</span>' : b.unexplained == null ? '<span class="muted">no kicking stats</span>' : `<span class="ol ol-out">${b.unexplained > 0 ? `${b.unexplained} pts not itemized` : 'check'}</span>`}</td></tr>`; };
    return `<h3>How they scored</h3><table class="data compact" id="bd-${esc(g.gameId)}"><thead><tr><th class="left">Team</th><th class="left">Scoring</th><th>Points</th><th class="left">Check</th></tr></thead><tbody>${row(g.awayTeamId, g.away)}${row(g.homeTeamId, g.home)}</tbody></table>`;
  }

  async function gameBoxScore(g) {
    const r = await api(`/leagues/${state.leagueKey}/games/${g.gameId}/boxscore`);
    const b = r.box;
    const P = (x) => playerCell({ ...x, teamId: null });
    const sect = (title, id, rows, cols, sortKey) => (rows.length ? `<h4>${esc(title)}</h4>${table(id, rows, cols, { defaultSort: sortKey, maxHeight: false })}` : '');
    const team = (tid, ab, name) => {
      const t = b.teams[tid];
      return `<div class="card box-team"><h3>${esc(name)}</h3>
        ${sect('Passing', `bx-p-${tid}`, t.passing, [{ key: 'name', label: 'Player', left: true, render: P }, { key: 'att', label: 'C/ATT', render: (x) => `${x.comp}/${x.att}` }, { key: 'yards', label: 'YDS' }, { key: 'td', label: 'TD' }, { key: 'int', label: 'INT' }, { key: 'sacked', label: 'SK' }, { key: 'long', label: 'LNG' }, { key: 'ypa', label: 'Y/A', d: 1 }, { key: 'rating', label: 'RTG', d: 1 }], 'yards')}
        ${sect('Rushing', `bx-r-${tid}`, t.rushing, [{ key: 'name', label: 'Player', left: true, render: P }, { key: 'car', label: 'CAR' }, { key: 'yards', label: 'YDS' }, { key: 'avg', label: 'AVG', d: 1 }, { key: 'td', label: 'TD' }, { key: 'long', label: 'LNG' }, { key: 'brokenTackles', label: 'BTK' }, { key: 'fumbles', label: 'FUM' }], 'yards')}
        ${sect('Receiving', `bx-c-${tid}`, t.receiving, [{ key: 'name', label: 'Player', left: true, render: P }, { key: 'rec', label: 'REC' }, { key: 'yards', label: 'YDS' }, { key: 'avg', label: 'AVG', d: 1 }, { key: 'td', label: 'TD' }, { key: 'long', label: 'LNG' }, { key: 'yac', label: 'YAC' }, { key: 'drops', label: 'DROP' }], 'yards')}
        ${sect('Defense', `bx-d-${tid}`, t.defense, [{ key: 'name', label: 'Player', left: true, render: P }, { key: 'tackles', label: 'TKL' }, { key: 'assists', label: 'AST' }, { key: 'tfl', label: 'TFL' }, { key: 'sacks', label: 'SK', d: 1 }, { key: 'int', label: 'INT' }, { key: 'pd', label: 'PD' }, { key: 'ff', label: 'FF' }, { key: 'fr', label: 'FR' }, { key: 'td', label: 'TD' }], 'tackles')}
        ${sect('Kicking', `bx-k-${tid}`, t.kicking, [{ key: 'name', label: 'Player', left: true, render: P }, { key: 'fgAtt', label: 'FG', render: (x) => `${x.fgMade}/${x.fgAtt}` }, { key: 'long', label: 'LNG' }, { key: 'xpAtt', label: 'XP', render: (x) => `${x.xpMade}/${x.xpAtt}` }, { key: 'points', label: 'PTS' }], 'points')}
        ${sect('Punting', `bx-u-${tid}`, t.punting, [{ key: 'name', label: 'Player', left: true, render: P }, { key: 'punts', label: 'NO' }, { key: 'yards', label: 'YDS' }, { key: 'avg', label: 'AVG', d: 1 }, { key: 'net', label: 'NET', d: 1 }, { key: 'long', label: 'LNG' }, { key: 'in20', label: 'IN20' }], 'punts')}
        ${sect('Returns', `bx-t-${tid}`, t.returns, [{ key: 'name', label: 'Player', left: true, render: P }, { key: 'kr', label: 'KR', render: (x) => (x.kr ? `${x.kr}-${x.krYards}` : '—') }, { key: 'krLong', label: 'KR LNG' }, { key: 'krTd', label: 'KR TD' }, { key: 'pr', label: 'PR', render: (x) => (x.pr ? `${x.pr}-${x.prYards}` : '—') }, { key: 'prLong', label: 'PR LNG' }, { key: 'prTd', label: 'PR TD' }], 'kr')}
      </div>`;
    };
    const ts = b.teamStats.length ? `<h3>Team stats</h3><table class="data compact teamstats" id="bx-team"><thead><tr><th class="left">Stat</th><th>${esc(g.away)}</th><th>${esc(g.home)}</th></tr></thead><tbody>${b.teamStats.map((r) => `<tr><td class="left">${esc(r.label)}</td><td class="${r.better === 'away' ? 'best' : ''}">${esc(r.awayText ?? '—')}</td><td class="${r.better === 'home' ? 'best' : ''}">${esc(r.homeText ?? '—')}</td></tr>`).join('')}</tbody></table>` : '';
    return `<div id="bx-body"><div class="table-tools"><button class="small" data-copy-block="bx-body">Copy box score as text</button></div>
      ${lineScoreHtml(g, b.lineScore)}
      <div class="grid cols-2">${ts ? `<div>${ts}</div>` : ''}<div>${breakdownHtml(g, b.breakdown)}</div></div>
      <p class="small-note">Every number here is what Madden recorded for this game.${b.lineScore ? ' The score by quarter comes from the scoring log in the save.' : ''}</p>
      <div class="grid cols-2">${team(g.awayTeamId, g.away, g.awayName)}${team(g.homeTeamId, g.home, g.homeName)}</div></div>`;
  }

  async function gameHighlights(g) {
    const r = await api(`/leagues/${state.leagueKey}/games/${g.gameId}/highlights`);
    const h = r.highlights;
    const pog = h.playerOfTheGame;
    const scoreRows = h.scoring.map((e) => `<tr><td class="left">${esc(e.clock)}</td><td class="left">${esc(abbr(e.teamId))}</td><td class="left">${esc({ TD: 'Touchdown', FG: 'Field goal', SAF: 'Safety' }[e.kind] || e.kind || '')}${e.conversion ? ` <span class="muted">(${esc(e.conversion)})</span>` : ''}${e.gameWinner ? ' <span class="hl-tag">game-winner</span>' : e.tookLead ? ' <span class="hl-tag">lead</span>' : ''}</td><td>${esc(g.away)} ${e.score.away} - ${esc(g.home)} ${e.score.home}</td></tr>`).join('');
    return `<div id="gh-body">
      <div class="table-tools"><button class="small" data-copy-block="gh-body">Copy highlights as text</button></div>
      <div class="card hl-head">
        <div class="hl-headline">${esc(h.headline)}</div>
        ${h.lineScore ? lineScoreHtml(g, h.lineScore) : ''}
        ${pog ? `<div class="pog"><span class="pill win">Player of the game</span> <b>${esc(pog.name)}</b> <span class="muted">${esc(pog.position)} · ${esc(abbr(pog.teamId))}</span>${pog.line ? ` <span class="muted">· ${esc(pog.line)}</span>` : ''}</div>` : ''}
      </div>
      <div class="grid cols-2">
        <div><h2>Highlights (${h.highlights.length})</h2>${hlList(h.highlights, 'No big plays in this one.')}</div>
        <div><h2>Lowlights (${h.lowlights.length})</h2>${hlList(h.lowlights, 'Nothing went badly wrong.')}</div>
      </div>
      ${h.timeline.length ? `<h2>Key plays in order</h2>${h.timeline.map((m) => hlItem(m)).join('')}` : ''}
      ${scoreRows ? `<h2>Scoring</h2><table class="data"><thead><tr><th class="left">When</th><th class="left">Team</th><th class="left">Score</th><th>Score after</th></tr></thead><tbody>${scoreRows}</tbody></table>` : ''}
      ${breakdownHtml(g, h.breakdown)}
      ${h.hasPlayByPlay ? '' : '<p class="small-note">This league has box scores but no play-by-play (Companion App and EA exports do not include it). Plays marked REAL PLAY are rebuilt exactly from the longest-play stats: a quarterback\'s longest completion matched to the one teammate whose longest catch has the same yards, touchdowns only where the numbers force it (every catch he made scored, or his only carry did), pick-sixes, returns and field goals. The order and clock times are not in the export.</p>'}
      ${pbpNote}</div>`;
  }

  // ---------- matchup preview
  const riskPill = (r) => `<span class="risk risk-${esc(String(r).toLowerCase())}">${esc(r)}</span>`;
  async function gamePreview(g) {
    const r = await api(`/leagues/${state.leagueKey}/games/${g.gameId}/preview`);
    const p = r.preview;
    const T = state.gameTeam;
    const O = T === g.homeTeamId ? g.awayTeamId : g.homeTeamId;
    const off = p.teams[T];
    const def = p.teams[O];
    const statRow = (x) => `<div class="stat-row card"><div class="stat"><div class="v">${x.basis.dropbacks}</div><div class="l">expected dropbacks</div></div><div class="stat"><div class="v">${x.predicted.pressures}</div><div class="l">projected pressures</div></div><div class="stat"><div class="v">${x.predicted.pressureRate}%</div><div class="l">pressure rate</div></div><div class="stat"><div class="v">${x.predicted.sacks}</div><div class="l">projected sacks</div></div><div class="stat"><div class="v">${x.predicted.sackPerPressure}%</div><div class="l">pressures that become sacks</div></div>${x.actual ? `<div class="stat"><div class="v">${x.actual.sacks}</div><div class="l">actual sacks</div></div><div class="stat"><div class="v">${x.actual.pressures}${tag(x.actual.pressureSource)}</div><div class="l">actual pressures</div></div>` : ''}</div>`;
    const protRows = (x, id) => table(id, x.blockers.map((b) => ({ ...b, facesName: b.faces ? b.faces.name : '', winPct: b.faces ? b.faces.winPct : null, riskRank: { Low: 0, Medium: 1, High: 2, Critical: 3 }[b.risk] })), [
      { key: 'name', label: 'Blocker', left: true, render: (b) => playerCell({ ...b, teamId: null }) },
      { key: 'riskRank', label: 'Risk', left: true, render: (b) => riskPill(b.risk) },
      { key: 'facesName', label: 'Lines up against', left: true, render: (b) => (b.faces ? `<span class="muted">${esc(b.faces.position)}</span> ${esc(b.faces.name)} <span class="muted">${b.faces.overall || ''}</span>` : '—') },
      { key: 'winPct', label: 'Rusher wins', d: 1, render: (b) => (b.faces ? `${fmt(b.faces.winPct, 1)}% <span class="muted">${esc(b.faces.move)}</span>` : '—') },
      { key: 'holdPct', label: 'Holds up', d: 1, render: (b) => `${fmt(b.holdPct, 1)}%` },
      { key: 'predictedPressures', label: 'Proj. pressures', d: 1 },
      { key: 'predictedSacks', label: 'Proj. sacks', d: 1 },
      { key: 'passBlock', label: 'PBK' },
      { key: 'seasonForm', label: 'Before this game', left: true, render: (b) => (b.seasonForm ? `${b.seasonForm.allowed} allowed vs ${b.seasonForm.expected} expected in ${b.seasonForm.games} g` : '<span class="muted">no games yet</span>') },
    ], { defaultSort: 'predictedPressures' });
    const rushRows = (x, id) => table(id, x.rushers.map((ru) => ({ ...ru, facesName: ru.faces ? ru.faces.name : '', bestPct: ru.bestMatchup ? ru.bestMatchup.winPct : null })), [
      { key: 'name', label: 'Rusher', left: true, render: (ru) => playerCell({ ...ru, teamId: null }) },
      { key: 'passRushSnaps', label: 'Rush snaps' },
      { key: 'predictedPressures', label: 'Proj. pressures', d: 1 },
      { key: 'predictedSacks', label: 'Proj. sacks', d: 1 },
      { key: 'facesName', label: 'Main matchup', left: true, render: (ru) => (ru.faces ? `<span class="muted">${esc(ru.faces.position)}</span> ${esc(ru.faces.name)} · wins ${fmt(ru.faces.winPct, 1)}%` : '—') },
      { key: 'bestPct', label: 'Best matchup', left: true, render: (ru) => (ru.bestMatchup ? `<span class="muted">${esc(ru.bestMatchup.position)}</span> ${esc(ru.bestMatchup.name)} · wins ${fmt(ru.bestMatchup.winPct, 1)}%` : '—') },
    ], { defaultSort: 'predictedPressures' });
    const lanes = (x) => x.runLanes.map((l, i) => `<div class="leader"><div class="who">${i === 0 ? '★ ' : ''}${esc(l.side === 'middle' ? 'Inside' : l.side === 'left' ? 'Left side' : 'Right side')}<span>${esc(l.blockers.join(', '))} vs ${esc(l.defenders.join(', ') || 'nobody')}</span></div><div class="n">${fmt(l.winPct, 1)}%</div></div>`).join('');
    const tips = (list) => (list.length ? `<ul class="tips">${list.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '<div class="muted">Nothing stands out.</div>');
    return `<div id="pv-body"><div class="table-tools"><button class="small" data-copy-block="pv-body">Copy preview as text</button></div>
      <p class="lead">What the blocking model expects up front before kickoff: every one-on-one between the ${esc(teamName(T).displayName)} and the ${esc(teamName(O).displayName)}, from ratings, each player's form, and how he has done in this league's earlier games. League average: a rusher wins ${p.leagueRepWinPct}% of his reps. ${p.played ? 'This game has been played, so the real results sit next to the projection.' : ''}</p>
      <p class="small-note">Built from the ${esc(off.basis.lineup)}${off.basis.fromGames ? `; dropbacks from ${esc(abbr(T))}'s ${off.basis.fromGames} earlier game(s)` : '; no earlier games, so a league-typical 36 dropbacks'}. Switch team at the top to see it from the other side.</p>
      <h2>When ${esc(abbr(T))} has the ball</h2>
      ${statRow(off)}
      <div class="grid cols-2">
        <div class="card"><h3>Game plan: ${esc(abbr(T))} offense</h3>${tips(off.offenseTips)}</div>
        <div class="card"><h3>Run lanes</h3>${lanes(off)}</div>
      </div>
      <h3 style="margin-top:16px">${esc(abbr(T))} pass protection</h3>
      ${protRows(off, 'pv-prot')}
      <h3>${esc(abbr(O))} pass rushers coming at them</h3>
      ${rushRows(off, 'pv-opprush')}
      <h2>When ${esc(abbr(O))} has the ball</h2>
      ${statRow(def)}
      <div class="grid cols-2">
        <div class="card"><h3>Game plan: ${esc(abbr(T))} defense</h3>${tips(def.defenseTipsForOpponent)}</div>
        <div class="card"><h3>Where ${esc(abbr(O))} wants to run</h3>${lanes(def)}</div>
      </div>
      <h3 style="margin-top:16px">${esc(abbr(T))} pass rushers</h3>
      ${rushRows(def, 'pv-rush')}
      <h3>${esc(abbr(O))} pass protection</h3>
      ${protRows(def, 'pv-oppprot')}</div>`;
  }

  // ---------- player game log
  async function openPlayerLog(playerId) {
    const root = $('#modal-root');
    let r;
    try { r = await api(`/leagues/${state.leagueKey}/players/${encodeURIComponent(playerId)}/log`); } catch (e) { banner(esc(e.message), 'error'); return; }
    const games = r.games;
    const has = (k) => games.some((x) => x[k]);
    const cols = [
      { h: 'Game', v: (x) => `${esc(x.label)}` , left: true },
      { h: 'Opp', v: (x) => `${x.home ? 'vs' : '@'} ${esc(x.opponent)}`, left: true },
      { h: 'Result', v: (x) => esc(x.result), left: true },
      { h: 'Snaps', v: (x) => (x.snaps ? x.snaps.offSnaps + x.snaps.defSnaps + x.snaps.stSnaps : '—'), sum: (x) => (x.snaps ? x.snaps.offSnaps + x.snaps.defSnaps + x.snaps.stSnaps : 0) },
    ];
    const add = (group, list) => { if (has(group)) for (const [h, f, d] of list) cols.push({ h, v: (x) => (x[group] ? fmt(f(x[group]), d || 0) : '—'), sum: (x) => (x[group] ? f(x[group]) || 0 : 0), grp: group }); };
    add('blocking', [['Grade', (b) => b.blockGrade], ['Press allowed', (b) => b.pressuresAllowed], ['Sacks allowed', (b) => b.sacksAllowed], ['Pancakes', (b) => b.pancakes]]);
    add('passRush', [['Pressures', (b) => b.pressures], ['Sacks', (b) => b.sacks, 1], ['Missed sacks', (b) => b.missedSacks]]);
    add('receiving', [['Targets', (b) => b.targets], ['Catches', (b) => b.catches], ['Drops', (b) => b.drops], ['Yards', (b) => b.yards], ['TD', (b) => b.tds]]);
    add('tackling', [['Tackles', (b) => b.tackles], ['Missed tkl', (b) => b.missedTackles], ['TFL', (b) => b.tacklesForLoss]]);
    add('penalties', [['Flags', (b) => b.penalties], ['Pen yds', (b) => b.yards]]);
    const total = (c) => { if (!c.sum) return ''; if (c.h === 'Grade') { const gs = games.filter((x) => x.blocking); return gs.length ? Math.round(gs.reduce((s2, x) => s2 + x.blocking.blockGrade, 0) / gs.length) : '—'; } const v = games.reduce((s2, x) => s2 + c.sum(x), 0); return Number.isInteger(v) ? v : v.toFixed(1); };
    const p = r.player;
    root.innerHTML = `<div class="modal-back" id="pl-back"><div class="modal wide">
      <h2>${esc(p.fullName)} <span class="muted">${esc(p.position)} · #${esc(p.jerseyNum)} · ${esc(r.team ? r.team.displayName : 'Free agent')} · ${p.overall} OVR</span></h2>
      ${games.length ? `<div class="table-wrap"><table class="data"><thead><tr>${cols.map((c) => `<th class="${c.left ? 'left' : ''}">${esc(c.h)}</th>`).join('')}</tr></thead><tbody>${games.map((x) => `<tr class="clickable" data-log-game="${esc(x.gameId)}">${cols.map((c) => `<td class="${c.left ? 'left' : 'num'}">${c.v(x)}</td>`).join('')}</tr>`).join('')}<tr class="teamrow">${cols.map((c, i) => `<td class="${c.left ? 'left' : 'num'}">${i === 0 ? `<b>Total (${games.length} g)</b>` : c.left ? '' : `<b>${total(c)}</b>`}</td>`).join('')}</tr></tbody></table></div>` : '<div class="empty">He has not played in a game yet.</div>'}
      <p class="small-note">Grade in the total row is his average. Click a game to open it.</p>
      ${contractHtml(r.contract)}
      <div class="modal-actions"><button class="blue" data-copy-log="1">Copy as text</button><button id="pl-close">Close</button></div>
    </div></div>`;
    $('#pl-close').onclick = () => { root.innerHTML = ''; };
    const cp = $('[data-copy-log]', root);
    if (cp) cp.onclick = async () => { const m = $('.modal', root); copied(cp, await copyText(nodeToText(m))); };
    $('#pl-back').onclick = (e) => { if (e.target.id === 'pl-back') root.innerHTML = ''; };
    $$('[data-log-game]', root).forEach((el) => (el.onclick = () => { root.innerHTML = ''; state.gameId = el.dataset.logGame; state.gameTab = 'highlights'; state.backTo = state.section === 'game' ? state.backTo : state.section; state.section = 'game'; render(); }));
  }

  function contractHtml(c) {
    if (!c) return '';
    if (c.status === 'FreeAgent' || !c.length) return `<h3>Contract</h3><p class="muted">${c.status === 'FreeAgent' ? 'Free agent, no contract.' : 'No contract on file.'}</p>`;
    const head = `<div class="stat-row card"><div class="stat"><div class="v">${money(c.capHit)}</div><div class="l">cap hit this season${c.capPct != null ? ` (${c.capPct}% of cap)` : ''}</div></div>${c.total != null ? `<div class="stat"><div class="v">${money(c.total)}</div><div class="l">total value, ${c.length} yr</div></div>` : `<div class="stat"><div class="v">${c.length} yr</div><div class="l">length</div></div>`}<div class="stat"><div class="v">${esc(c.contractYear || '—')}</div><div class="l">contract year${c.yearsLeft ? `, ${c.yearsLeft} left` : ''}</div></div>${c.remaining != null ? `<div class="stat"><div class="v">${money(c.remaining)}</div><div class="l">still owed</div></div>` : ''}${c.remainingBonus != null ? `<div class="stat"><div class="v">${money(c.remainingBonus)}</div><div class="l">dead money if cut</div></div>` : ''}${c.releaseSavings != null ? `<div class="stat"><div class="v">${money(c.releaseSavings)}</div><div class="l">cap saved if cut</div></div>` : ''}${c.releasePenalty != null ? `<div class="stat"><div class="v">${money(c.releasePenalty)}</div><div class="l">dead money if cut</div></div>` : ''}</div>`;
    const years = c.years && c.years.length ? `<table class="data compact"><thead><tr><th class="left">Season</th><th>Salary</th><th>Bonus</th><th>Cap hit</th><th class="left"></th></tr></thead><tbody>${c.years.map((y) => `<tr class="${y.current ? 'current' : y.done ? 'done' : ''}"><td class="left">${y.season || `Year ${y.index + 1}`}</td><td>${money(y.salary)}</td><td>${money(y.bonus)}</td><td><b>${money(y.capHit)}</b></td><td class="left">${y.current ? 'this season' : y.done ? 'paid' : ''}</td></tr>`).join('')}</tbody></table>` : '';
    return `<h3>Contract</h3>${head}${years}${c.draftRound ? `<p class="small-note">${c.draftRound <= 7 ? `Drafted ${c.draftYear || ''} round ${c.draftRound}, pick ${c.draftPick} of the round.` : 'Undrafted.'}</p>` : ''}`;
  }

  function exportCsv(id) {
    const t = document.getElementById(id);
    if (!t) return;
    const cell = (c) => { const x = c.cloneNode(true); x.querySelectorAll('.tag').forEach((n) => n.remove()); const v = x.textContent.replace(/[▼▲]/g, '').replace(/\s+/g, ' ').trim(); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
    const lines = [...t.rows].map((row) => [...row.cells].map(cell).join(','));
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const league = state.league ? state.league.name.replace(/[^\w-]+/g, '_') : 'league';
    a.download = `${league}_${id}${state.week ? '_week' + state.week : ''}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // ---------- weekly recap
  const who = (x) => `${x.playerId ? `<a href="#" class="plink" data-player="${esc(x.playerId)}">` : ''}<b>${esc(x.name)}</b>${x.playerId ? '</a>' : ''} <span class="muted">${esc(x.position || '')}${x.teamId ? ' · ' + esc(abbr(x.teamId)) : ''}</span>`;
  const SEVERITY = { GameEnding: 'Out for the game', CoupleGames: 'Out a few games', SeasonEnding: 'Season-ending', CareerEnding: 'Career-ending', Minor: 'Minor' };
  const severityText = (v) => (!v || /^Invalid|^Max_/.test(v) ? '' : SEVERITY[v] || String(v).replace(/([a-z])([A-Z])/g, '$1 $2'));
  const SOURCE_LABEL = { 'game-list': "Madden's game injury list", report: "Madden's injury report (this week)", ledger: 'Remembered by the tool', export: 'First seen in the export after this game', tool: 'Injury tool' };

  // One table for injuries, used by the game view and the weekly recap.
  function injuryTable(id, rows, { showGame = false } = {}) {
    const body = rows.map((i) => {
      const g = showGame && i.gameId ? state.schedule.find((q) => q.gameId === i.gameId) : null;
      const weeks = i.weeksMax != null && (i.weeksMax > 0 || i.weeksMin > 0) ? (i.weeksMin === i.weeksMax || i.weeksMin == null ? `${i.weeksMax} wk` : `${i.weeksMin}-${i.weeksMax} wk`) : '0 wk';
      const now = i.stillOut ? `Out${i.weeksLeft ? `, ${i.weeksLeft} wk left` : ''}${i.onIR ? ' · IR' : ''}` : 'Not on the injury report now';
      const inGame = i.played ? (i.played.snaps != null ? `Yes, ${i.played.snaps} snaps` : 'Yes') : i.played === null && i.source !== 'report' ? '—' : 'No stats in it';
      // Off the report already: say what Madden had him down for, not "out".
      const cleared = !i.stillOut && i.outlook && ['out', 'doubtful', 'season'].includes(i.outlook.key);
      const cls = cleared ? 'ol-unknown' : i.outlook ? `ol-${i.outlook.key}` : '';
      const olText = cleared ? `Cleared (was: ${i.outlook.text.toLowerCase()})` : i.outlook ? i.outlook.text : '';
      return `<tr><td class="left">${who(i)}</td><td class="left">${esc(i.injury)}</td><td class="left">${esc(i.severityLabel || severityText(i.severity))}</td><td class="left"><span class="ol ${cls}">${esc(olText)}</span></td><td>${esc(weeks)}</td><td class="left">${esc(now)}</td><td class="left">${esc(inGame)}</td><td class="left">${esc(SOURCE_LABEL[i.source] || i.source)}${i.note ? `<div class="small-note">${esc(i.note)}</div>` : ''}${g ? `<div class="small-note">${esc(g.away)} @ ${esc(g.home)}</div>` : ''}</td></tr>`;
    }).join('');
    return `<div class="table-tools"><button class="small" data-copy-table="${id}">Copy</button></div><div class="table-wrap"><table class="data" id="${id}"><thead><tr><th class="left">Player</th><th class="left">Injury</th><th class="left">How bad</th><th class="left">Outlook</th><th>Madden's range</th><th class="left">Now</th><th class="left">In the game</th><th class="left">Where it came from</th></tr></thead><tbody>${body}</tbody></table></div>`;
  }

  sections.recap = async () => {
    if (!state.league) return '<div class="empty">Connect a franchise first.</div>';
    const [st, wk] = (state.recapKey || '').split(':');
    const r = await api(`/leagues/${state.leagueKey}/recap${state.recapKey ? `?stage=${encodeURIComponent(st)}&week=${encodeURIComponent(wk)}` : ''}`);
    if (!r.recap) return '<h1>Weekly Recap</h1><div class="empty">No games have been played yet.</div>';
    const x = r.recap;
    state.recapKey = `${x.stage}:${x.week}`;
    const chips = r.weeks.map((w) => `<button class="${w.stage === x.stage && w.week === x.week ? 'active' : ''}" data-recap="${esc(w.stage)}:${w.week}">${esc(w.label)}</button>`).join('');
    const scoreCard = (g) => {
      if (g.status !== 'played') return `<div class="game unplayed"><div class="teams"><span>${esc(g.away)}</span><span class="muted">@</span><span>${esc(g.home)}</span></div><div class="meta"><span>${esc(g.awayName)} at ${esc(g.homeName)}</span><span>Not played yet</span></div></div>`;
      const awayWon = g.winner === g.awayTeamId;
      const homeWon = g.winner === g.homeTeamId;
      return `<div class="game hlgame" data-hl-game="${esc(g.gameId)}">
        <div class="teams"><span class="${awayWon ? 'won' : ''}">${esc(g.away)} ${g.awayScore}${g.awayRecord ? ` <span class="rec">(${esc(g.awayRecord)})</span>` : ''}</span><span class="muted">@</span><span class="${homeWon ? 'won' : ''}">${esc(g.home)} ${g.homeScore}${g.homeRecord ? ` <span class="rec">(${esc(g.homeRecord)})</span>` : ''}</span></div>
        <div class="meta"><span>${g.winner ? `${esc(teamName(g.winner).displayName)} win` : 'Tie'}${g.overtime ? ' in OT' : ''}</span><span>${g.simmed ? 'Simmed' : 'Final'}${g.overtime ? '/OT' : ''}</span></div>
        ${g.topPlay ? `<div class="small-note">★ ${esc(g.topPlay)}</div>` : ''}
        ${g.playerOfTheGame ? `<div class="small-note"><b>Player of the game:</b> ${esc(g.playerOfTheGame.name)} (${esc(g.playerOfTheGame.position)}, ${esc(abbr(g.playerOfTheGame.teamId))})${g.playerOfTheGame.line ? ` · ${esc(g.playerOfTheGame.line)}` : ''}</div>` : ''}
      </div>`;
    };
    const leaderCard = (title, list, unit) => `<div class="card"><h3>${esc(title)}</h3>${list.length ? list.map((l, i) => `<div class="leader"><div class="who">${i + 1}. ${who(l)}<div class="small-note">${esc(l.line)}</div></div><div class="n">${l.value}${unit ? ` <span class="muted small">${unit}</span>` : ''}</div></div>`).join('') : '<div class="muted">Nobody.</div>'}</div>`;
    const potw = (title, p) => `<div class="card potw"><h3>${esc(title)}</h3>${p ? `<div class="big">${who(p)}</div><div>${esc(p.line)}</div>` : '<div class="muted">Nobody stood out.</div>'}</div>`;
    const txRows = x.transactions.map((t) => `<tr><td class="left">${who({ ...t, teamId: null })}</td><td class="left">${esc(t.kind)}</td><td class="left">${esc(t.fromAbbr || (t.oldStatus === 'FreeAgent' ? 'Free agency' : '—'))} → ${esc(t.toAbbr || (t.newStatus === 'FreeAgent' ? 'Free agency' : t.newStatus === 'Retired' ? 'Retired' : '—'))}</td><td>${t.contract && t.contract.length ? `${t.contract.length} yr, ${money(t.contract.total)}${t.contract.bonus ? `, ${money(t.contract.bonus)} bonus` : ''}` : '—'}</td></tr>`).join('');
    const adv = (title, list, suffix = '') => `<div class="card"><h3>${esc(title)}</h3>${list.length ? list.map((l) => `<div class="leader"><div class="who">${who(l)}</div><div class="n">${fmt(l.value, 0)}${suffix}</div></div>`).join('') : '<div class="muted">Nobody.</div>'}</div>`;
    const standings = x.standings ? x.standings.divisions.map((d) => `<div class="card"><h3>${esc(d.division)}</h3><table class="data compact"><thead><tr><th class="left">Team</th><th>W-L</th><th>PF</th><th>PA</th><th>Streak</th></tr></thead><tbody>${d.teams.map((t) => `<tr><td class="left">${esc(t.abbr)}</td><td>${esc(t.text)}</td><td>${t.pf}</td><td>${t.pa}</td><td>${t.streak ? esc(t.streak.text) : '—'}</td></tr>`).join('')}</tbody></table></div>`).join('') : '';
    const s = x.summary;
    const move = (m) => (m > 0 ? `<span class="trend up">▲${m}</span>` : m < 0 ? `<span class="trend down">▼${-m}</span>` : '<span class="muted">—</span>');
    state.sort['rc-power'] ||= { key: 'rank', dir: -1 };
    const powerHtml = x.powerRankings.length ? `<h2>Power rankings</h2>${x.powerRankingsNote ? `<p class="small-note">${esc(x.powerRankingsNote)}</p>` : ''}${table('rc-power', x.powerRankings.map((p) => ({ ...p, name: p.name })), [
      { key: 'rank', label: '#', render: (p) => `<b>${p.rank}</b>` },
      { key: 'move', label: 'Move', render: (p) => move(p.move) },
      { key: 'abbr', label: 'Team', left: true, render: (p) => `<a href="#" data-team-page="${esc(p.teamId)}"><b>${esc(p.abbr)}</b></a> <span class="muted">${esc(p.name)}</span>` },
      { key: 'record', label: 'Record', left: true },
      { key: 'diff', label: 'Pt diff', render: (p) => `${p.diff > 0 ? '+' : ''}${p.diff}` },
      { key: 'overall', label: 'OVR' },
      { key: 'lastResult', label: 'This week', left: true },
      { key: 'power', label: 'Score', d: 1 },
    ], { defaultSort: 'rank' })}<p class="small-note">The tool's formula: 40% record, 30% point differential per game, 15% the last three games, 15% Madden's team rating. Before a team has played, rating only.</p>` : '';
    const playoffHtml = x.playoffPicture.length ? `<h2>Playoff picture after ${esc(x.label)}</h2><div class="grid cols-2">${x.playoffPicture.map((c) => `<div class="card"><h3>${esc(c.conference)}</h3><table class="data compact"><thead><tr><th>Seed</th><th class="left">Team</th><th>Record</th><th>Diff</th><th class="left"></th></tr></thead><tbody>${c.teams.map((t) => `<tr class="${t.seed ? '' : 'done'}"><td>${t.seed || '—'}</td><td class="left"><b>${esc(t.abbr)}</b> <span class="muted">${esc(t.division || '')}</span></td><td>${esc(t.record)}</td><td>${t.diff > 0 ? '+' : ''}${t.diff}</td><td class="left small">${esc(t.how)}</td></tr>`).join('')}</tbody></table></div>`).join('')}</div><p class="small-note">If the season ended today. Ties are broken by winning percentage, head-to-head when two teams are tied, then point differential; the NFL uses more tiebreakers than this.</p>` : '';
    const bigHtml = x.bigPerformances.length ? `<h2>Big performances</h2><ul class="list">${x.bigPerformances.map((b) => `<li><span>${who(b)} · ${esc(b.text)}</span></li>`).join('')}</ul>` : '';
    const fantasyHtml = x.fantasy.length ? `<div class="card"><h3>Fantasy points (PPR)</h3>${x.fantasy.map((f, i) => `<div class="leader"><div class="who">${i + 1}. ${who(f)}</div><div class="n">${f.points}</div></div>`).join('')}<p class="small-note">1 per catch, 1 per 10 rushing or receiving yards, 1 per 25 passing yards, 6 per touchdown (4 passing), -2 per interception or fumble.</p></div>` : '';
    const sl = x.seasonLeaders;
    const slCard = (title, list, unit) => `<div class="card"><h3>${esc(title)}</h3>${list.length ? list.map((l, i) => `<div class="leader"><div class="who">${i + 1}. ${who(l)}</div><div class="n">${l.value}${unit ? ` <span class="muted small">${unit}</span>` : ''}</div></div>`).join('') : '<div class="muted">Nobody yet.</div>'}</div>`;
    const seasonHtml = sl && sl.games ? `<h2>Season leaders through ${esc(x.label)}</h2><div class="grid cols-4">${slCard('Passing yards', sl.passing, 'yds')}${slCard('Rushing yards', sl.rushing, 'yds')}${slCard('Receiving yards', sl.receiving, 'yds')}${slCard('Touchdowns', sl.touchdowns, 'TD')}</div><div class="grid cols-4" style="margin-top:14px">${slCard('Sacks', sl.sacks, 'sk')}${slCard('Interceptions', sl.interceptions, 'INT')}${slCard('Tackles', sl.tackles, 'tkl')}${slCard('Fantasy points', sl.fantasy, 'pts')}</div>` : '';
    const ta = x.teamAwards || {};
    const award = (label, r, key, unit) => (r ? `<div class="leader"><div class="who">${esc(label)}<span>${esc(r.name || r.abbr)}</span></div><div class="n">${r[key]}${unit ? ` <span class="muted small">${unit}</span>` : ''}</div></div>` : '');
    const awardsHtml = `<div class="card"><h3>Teams of the week</h3>${award('Most points', ta.mostPoints, 'points', 'pts')}${award('Most yards', ta.mostYards, 'yards', 'yds')}${award('Fewest yards allowed', ta.fewestYardsAllowed, 'yardsAllowed', 'yds')}${award('Fewest points allowed', ta.fewestPointsAllowed, 'allowed', 'pts')}${award('Most takeaways', ta.mostTakeaways, 'takeaways', '')}${award('Most sacks', ta.mostSacks, 'sacks', '')}</div>`;
    const gotw = x.gameOfTheWeek ? `<div class="card gotw"><h3>Game of the week: ${esc(x.gameOfTheWeek.label)}</h3><div class="big"><b>${esc(x.gameOfTheWeek.awayName)}</b> at <b>${esc(x.gameOfTheWeek.homeName)}</b></div><div class="small-note">${esc(x.gameOfTheWeek.why)}. Picked by the tool from records, ratings and power rankings.</div><div class="toolbar"><a href="#" class="small no-copy" data-preview-game="${esc(x.gameOfTheWeek.gameId)}">Matchup preview</a></div></div>` : '';
    return `
      <div class="head-row"><h1>Weekly Recap</h1><button class="blue" data-copy-block="recap-body" title="Copy the whole recap as plain text">Copy recap as text</button></div>
      <p class="lead">Everything that happened across the league in one week: every score, the records and standings after it, the injuries, Madden's own league news and transactions, the stat leaders and the biggest plays. Scores, stats, injuries and news are exactly what Madden saved.</p>
      <div class="weekchips">${chips}</div>
      <div id="recap-body">
        <h2>${esc(x.label)} recap</h2>
        <div class="stat-row card"><div class="stat"><div class="v">${s.gamesPlayed}${s.gamesScheduled > s.gamesPlayed ? ` / ${s.gamesScheduled}` : ''}</div><div class="l">games played</div></div><div class="stat"><div class="v">${s.totalPoints}</div><div class="l">points scored</div></div><div class="stat"><div class="v">${s.averagePoints}</div><div class="l">points per game</div></div><div class="stat"><div class="v">${s.homeWins}-${s.awayWins}</div><div class="l">home vs road wins</div></div><div class="stat"><div class="v">${s.injuries}</div><div class="l">injuries</div></div>${x.hasNews ? `<div class="stat"><div class="v">${s.transactions}</div><div class="l">transactions</div></div>` : ''}</div>

        <h2>Scores</h2>
        <div class="games">${x.scores.map(scoreCard).join('')}</div>

        ${gotw}
        ${x.storylines.length ? `<h2>Storylines</h2><ul class="tips story">${x.storylines.map((t) => `<li><b>${esc(t.kind)}:</b> ${esc(t.text)}</li>`).join('')}</ul>` : ''}

        <h2>Players of the week</h2>
        <div class="grid cols-3">${potw('Offense', x.playersOfWeek.offense)}${potw('Defense', x.playersOfWeek.defense)}${potw('Rookie', x.playersOfWeek.rookie)}</div>
        <p class="small-note">Picked by this tool from the recorded box scores (yards, touchdowns, turnovers, tackles, sacks, takeaways), with a small bump for playing on a winning team.</p>

        ${bigHtml}
        <h2>Stat leaders</h2>
        <div class="grid cols-4">${leaderCard('Passing yards', x.leaders.passing, 'yds')}${leaderCard('Rushing yards', x.leaders.rushing, 'yds')}${leaderCard('Receiving yards', x.leaders.receiving, 'yds')}${leaderCard('Touchdowns', x.leaders.touchdowns, 'TD')}</div>
        <div class="grid cols-3" style="margin-top:14px">${leaderCard('Sacks', x.leaders.sacks, 'sk')}${leaderCard('Tackles', x.leaders.tackles, 'tkl')}${leaderCard('Interceptions', x.leaders.interceptions, 'INT')}</div>

        <div class="grid cols-2" style="margin-top:14px">${fantasyHtml}${awardsHtml}</div>
        <h2>Highlights and lowlights</h2>
        <div class="grid cols-2">
          <div class="card"><h3>Plays of the week</h3>${hlList(x.highlights, 'Nothing yet.', { showGame: true })}</div>
          <div class="card"><h3>Lowlights of the week</h3>${hlList(x.lowlights, 'Nothing yet.', { showGame: true })}</div>
        </div>

        <h2>Injuries (${x.injuries.length})</h2>
        ${x.injuryNote ? `<p class="small-note">${esc(x.injuryNote)}</p>` : ''}
        ${x.summary.minorInjuries ? `<p class="small-note">${x.summary.minorInjuries} of them are minor: out for part of a game at most.</p>` : ''}
        ${x.injuries.length ? injuryTable('rc-inj', x.injuries, { showGame: true }) : `<div class="muted">${x.source === 'franchise' ? 'No injuries this week.' : 'No injuries seen after this week yet. The tool can only see what each export shows, so export after every game.'}</div>`}
        ${x.currentReport ? `<h3>Current injury report (${x.currentReport.length})</h3><p class="small-note">From the latest export. The export lists who is hurt now, not the week it happened.</p>${table('rc-cur', x.currentReport.map((p) => ({ ...p })), [{ key: 'name', label: 'Player', left: true, render: playerCell }, { key: 'injury', label: 'Injury', left: true }, { key: 'weeksLeft', label: 'Weeks left' }, { key: 'onIR', label: 'IR', left: true, render: (p) => (p.onIR ? 'IR' : '') }], { defaultSort: 'weeksLeft' })}` : ''}

        ${x.hasNews ? `
        <h2>League news</h2>
        ${x.stories.length ? `<div class="grid cols-2">${x.stories.map((n) => `<div class="card news"><div class="news-head">${n.breaking ? '<span class="pill loss">Breaking</span> ' : ''}${esc(n.headline)}</div><div>${esc(n.text)}</div>${n.teamId ? `<div class="small-note">${esc(teamName(n.teamId).displayName)}</div>` : ''}</div>`).join('')}</div>` : '<div class="muted">Madden wrote no news stories this week.</div>'}
        ${x.posts.length ? `<h3>Around the league</h3><ul class="list">${x.posts.map((pp) => `<li><span><b>${esc(pp.author || 'Post')}</b>: ${esc(pp.text)}${pp.teamId ? ` <span class="muted">· ${esc(abbr(pp.teamId))}</span>` : ''}</span></li>`).join('')}</ul>` : ''}
        <h3>Transactions (${x.transactions.length})</h3>
        ${x.transactions.length ? `<div class="table-tools"><button class="small" data-copy-table="rc-tx">Copy</button></div><div class="table-wrap"><table class="data" id="rc-tx"><thead><tr><th class="left">Player</th><th class="left">Move</th><th class="left">From → To</th><th>Contract</th></tr></thead><tbody>${txRows}</tbody></table></div>` : '<div class="muted">No signings, releases or trades this week.</div>'}` : '<p class="small-note">League news, social posts and transactions come from the PC franchise file; a Companion App export does not include them.</p>'}

        <h2>Under the hood</h2>
        <p class="small-note">From this tool's advanced stats. Drops are recorded by Madden; the rest are reconstructed from what Madden recorded and the players' ratings.</p>
        <div class="grid cols-3">${adv('Best blockers (grade)', x.advanced.bestBlockers)}${adv('Most pressures allowed', x.advanced.mostPressuresAllowed)}${adv('Most pressures', x.advanced.topPassRushers)}</div>
        <div class="grid cols-3" style="margin-top:14px">${adv('Most drops', x.advanced.mostDrops)}${adv('Most missed tackles', x.advanced.mostMissedTackles)}${adv('Most penalties', x.advanced.mostPenalties)}</div>

        ${powerHtml}
        ${playoffHtml}
        ${standings ? `<h2>Standings after ${esc(x.label)}</h2><div class="grid cols-4">${standings}</div>` : ''}
        ${seasonHtml}

        ${x.upcoming.length ? `<h2>Coming up: ${esc(x.upcoming[0].label)}</h2><ul class="list">${x.upcoming.map((u) => `<li><span><b>${esc(u.away)}</b>${u.awayRecord ? ` <span class="muted">(${esc(u.awayRecord)})</span>` : ''} @ <b>${esc(u.home)}</b>${u.homeRecord ? ` <span class="muted">(${esc(u.homeRecord)})</span>` : ''}</span><a href="#" class="small no-copy" data-preview-game="${esc(u.gameId)}">Matchup preview</a></li>`).join('')}</ul>` : ''}
      </div>`;
  };

  // ---------- contracts and the salary cap
  const capTip = 'Every dollar figure is what Madden stores for the contract.';
  sections.contracts = async () => {
    if (!state.league) return '<div class="empty">Connect a franchise first.</div>';
    const teams = state.league.teams;
    const teamId = [state.teamId, state.contractsTeam].find((id) => teams.some((t) => t.teamId === id)) || (teams[0] || {}).teamId;
    if (state.teamId) state.contractsTeam = state.teamId;
    const view = state.teamId && state.contractsView === 'league' ? 'team' : state.contractsView;
    const focus = view === 'team' ? teamId : state.teamId && ['top', 'expiring'].includes(view) ? state.teamId : null;
    const r = await api(`/leagues/${state.leagueKey}/contracts${focus ? `?teamId=${encodeURIComponent(focus)}` : ''}`);
    const file = r.detail === 'year-by-year';
    const tabs = [['league', 'League cap'], ['team', 'Team contracts'], ['top', 'Biggest contracts'], ['expiring', 'Expiring deals'], ['fa', 'Free agents']];
    const nav = `<div class="seg">${tabs.map(([k, l]) => `<button class="${view === k ? 'active' : ''}" data-cview="${k}">${l}</button>`).join('')}</div>`;
    const capLine = r.salaryCap ? `<p class="small-note">League salary cap: <b>${money(r.salaryCap.cap)}</b>${r.season ? ` for ${r.season}` : ''}. ${file ? `Worked out from every team's cap room (${r.salaryCap.teamsAgreeing} of ${r.teams.length} teams agree; the game is counting ${esc(r.salaryCap.rule)}).` : 'From the exported team caps.'} ${capTip}</p>` : `<p class="small-note">${capTip}</p>`;
    const contractCell = (c) => `${playerCell({ ...c, teamId: view === 'team' ? null : c.teamId })}${c.injured ? ' <span class="injured small">hurt</span>' : ''}`;
    const baseCols = [
      { key: 'name', label: 'Player', left: true, render: contractCell },
      { key: 'age', label: 'Age' },
      { key: 'overall', label: 'OVR' },
      { key: 'devTrait', label: 'Dev', left: true },
      { key: 'capHit', label: 'Cap hit', render: (c) => money(c.capHit) },
    ];
    const fileCols = [
      { key: 'capPct', label: '% of cap', d: 1 },
      { key: 'salary', label: 'Salary', render: (c) => money(c.salary) },
      { key: 'bonusProration', label: 'Bonus (this yr)', render: (c) => money(c.bonusProration) },
      { key: 'yearsLeft', label: 'Year', render: (c) => esc(c.contractYear || '—') },
      { key: 'total', label: 'Total value', render: (c) => money(c.total) },
      { key: 'averagePerYear', label: 'Per year', render: (c) => money(c.averagePerYear) },
      { key: 'signingBonus', label: 'Signing bonus', render: (c) => money(c.signingBonus) },
      { key: 'remaining', label: 'Still owed', render: (c) => money(c.remaining) },
      { key: 'remainingBonus', label: 'Dead $ if cut', render: (c) => money(c.remainingBonus) },
      { key: 'expiresAfter', label: 'Through', render: (c) => (c.expiresAfter ? String(c.expiresAfter) : '—') },
    ];
    const summaryCols = [
      { key: 'capPct', label: '% of cap', d: 1 },
      { key: 'salary', label: 'Salary', render: (c) => money(c.salary) },
      { key: 'signingBonus', label: 'Bonus', render: (c) => money(c.signingBonus) },
      { key: 'length', label: 'Years' },
      { key: 'yearsLeft', label: 'Left' },
      { key: 'releaseSavings', label: 'Cut: saves', render: (c) => money(c.releaseSavings) },
      { key: 'releasePenalty', label: 'Cut: dead $', render: (c) => money(c.releasePenalty) },
    ];
    const cols = [...baseCols, ...(file ? fileCols : summaryCols)];
    const draftCol = { key: 'draftYear', label: 'Drafted', left: true, render: (c) => (c.draftRound && c.draftRound <= 7 ? `${c.draftYear || ''} Rd ${c.draftRound}, #${c.draftPick}` : c.draftRound ? 'Undrafted' : '—') };
    let body = '';
    if (view === 'league') {
      const rows = r.teams.map((t) => ({ ...t, teamCap: t.cap ? t.cap.teamCap : null, spent: t.cap ? t.cap.spent : null, room: t.cap ? t.cap.room : null, dead: t.cap ? t.cap.deadThisYear : null, deadNext: t.cap ? t.cap.deadNextYear : null, nextRoom: t.cap ? t.cap.nextYearRoom : null, rollover: t.cap ? t.cap.rollover : null, top: t.topContract ? t.topContract.capHit : null }));
      body = `${capLine}${table('ct-league', rows, [
        { key: 'abbr', label: 'Team', left: true, render: (t) => `<a href="#" data-ct-team="${esc(t.teamId)}"><b>${esc(t.abbr)}</b></a> <span class="muted">${esc(t.name)}</span>` },
        { key: 'room', label: 'Cap room', render: (t) => `<span class="${t.room != null && t.room < 0 ? 'injured' : ''}">${money(t.room)}</span>` },
        { key: 'spent', label: 'Cap used', render: (t) => money(t.spent) },
        { key: 'teamCap', label: 'Team cap', render: (t) => money(t.teamCap) },
        ...(file ? [
          { key: 'dead', label: 'Dead money', render: (t) => money(t.dead) },
          { key: 'rollover', label: 'Rollover', render: (t) => money(t.rollover) },
          { key: 'nextRoom', label: 'Next yr room', render: (t) => money(t.nextRoom) },
        ] : []),
        { key: 'top', label: 'Biggest cap hit', left: true, render: (t) => (t.topContract ? `${esc(t.topContract.name)} <span class="muted">${esc(t.topContract.position)}</span> ${money(t.topContract.capHit)}` : '—') },
        { key: 'expiring', label: 'Expiring' },
        { key: 'players', label: 'Players' },
      ], { defaultSort: 'room' })}`;
    } else if (view === 'team') {
      const t = r.team;
      const pick = state.teamId ? '' : `<div class="toolbar"><div class="field"><span>Team</span><select id="ct-team">${teams.map((x) => `<option value="${esc(x.teamId)}" ${x.teamId === teamId ? 'selected' : ''}>${esc(x.abbr)} — ${esc(x.displayName)}</option>`).join('')}</select></div></div>`;
      const c = t && t.cap;
      const tiles = c ? `<div class="stat-row card"><div class="stat"><div class="v ${c.room < 0 ? 'injured' : ''}">${money(c.room)}</div><div class="l">cap room</div></div><div class="stat"><div class="v">${money(c.spent)}</div><div class="l">cap used</div></div><div class="stat"><div class="v">${money(c.teamCap)}</div><div class="l">team cap</div></div>${file ? `<div class="stat"><div class="v">${money(c.deadThisYear)}</div><div class="l">dead money this year</div></div><div class="stat"><div class="v">${money(c.deadNextYear)}</div><div class="l">dead money next year</div></div><div class="stat"><div class="v">${money(c.rollover)}</div><div class="l">rolled over</div></div><div class="stat"><div class="v">${money(c.nextYearRoom)}</div><div class="l">room next year</div></div>` : ''}<div class="stat"><div class="v">${t.expiring}</div><div class="l">deals ending</div></div></div>` : '<div class="muted">No cap numbers for this team.</div>';
      const commit = t && t.commitments ? `<h3>Money already committed</h3><table class="data compact" id="ct-commit"><thead><tr><th class="left">Season</th>${t.commitments.map((_, i) => `<th>${r.season ? r.season + i : `Year ${i + 1}`}</th>`).join('')}</tr></thead><tbody><tr><td class="left">Cap hits under contract</td>${t.commitments.map((v) => `<td>${money(v)}</td>`).join('')}</tr></tbody></table><p class="small-note">Salary plus prorated bonus of every contract on the roster for each coming season, from the year-by-year deals. Dead money and future signings are not included.</p>` : '';
      const byPos = t && t.byPosition.length ? `<h3>Cap by position</h3><div class="posbars">${t.byPosition.map((b) => `<div class="posbar"><span class="p">${esc(b.position)}</span><span class="bar"><i style="width:${Math.max(1, Math.round((b.capHit / Math.max(...t.byPosition.map((q) => q.capHit), 1)) * 100))}%"></i></span><span class="m">${money(b.capHit)}</span></div>`).join('')}</div>` : '';
      body = `${pick}<h2>${esc(teamName(teamId).displayName)}</h2>${capLine}${tiles}${table('ct-team-players', r.players, [...cols, { key: 'position', label: 'Pos', left: true }, draftCol], { defaultSort: 'capHit' })}${commit}${byPos}`;
    } else if (view === 'top') {
      const topCols = [...baseCols, ...(file ? fileCols.filter((c) => ['capPct', 'yearsLeft', 'total', 'averagePerYear', 'expiresAfter'].includes(c.key)) : summaryCols.slice(0, 3))];
      body = `${capLine}<h2>Biggest cap hits this season${focus ? ` · ${esc(teamName(focus).displayName)}` : ''}</h2>${table('ct-top-cap', r.leaders.capHit, topCols, { defaultSort: 'capHit' })}${file ? `<h2>Biggest total value</h2>${table('ct-top-total', r.leaders.total, topCols, { defaultSort: 'total' })}<h2>Most per year</h2>${table('ct-top-aav', r.leaders.averagePerYear, topCols, { defaultSort: 'averagePerYear' })}<h2>Most dead money if cut</h2>${table('ct-top-dead', r.leaders.remainingBonus, [...baseCols, fileCols.find((c) => c.key === 'remainingBonus'), fileCols.find((c) => c.key === 'yearsLeft')], { defaultSort: 'remainingBonus' })}` : ''}`;
    } else if (view === 'expiring') {
      body = `<p class="lead">The best players${focus ? ` on the ${esc(teamName(focus).displayName)}` : ''} in the last year of their deals${r.season ? `, due to hit free agency after the ${r.season} season` : ''} unless they are re-signed.</p>${table('ct-exp', r.leaders.expiring, [...baseCols, { key: 'position', label: 'Pos', left: true }, ...(file ? fileCols.filter((c) => ['salary', 'yearsLeft', 'total'].includes(c.key)) : [])], { defaultSort: 'overall' })}`;
    } else {
      body = `<p class="lead">The best free agents available right now (${r.counts.freeAgents} in all), by overall.</p>${table('ct-fa', r.freeAgents, [{ key: 'name', label: 'Player', left: true, render: (c) => `${playerCell({ ...c, teamId: null })}${c.injured ? ' <span class="injured small">hurt</span>' : ''}` }, { key: 'age', label: 'Age' }, { key: 'overall', label: 'OVR' }, { key: 'devTrait', label: 'Dev', left: true }, { key: 'yearsPro', label: 'Years pro' }, draftCol], { defaultSort: 'overall' })}`;
    }
    return `<h1>Contracts &amp; Salary Cap</h1>
      <p class="lead">Every contract in the league: cap hits, salaries, bonuses, years left, total value, money still owed and the dead money a release would leave, plus each team's cap room, dead money, rollover and what is already committed to future seasons. Click a player for his year-by-year deal.</p>
      ${nav}${body}
      ${file ? '' : '<p class="small-note">A Companion App export carries one salary, one bonus, the cap hit and the release numbers for each contract. The year-by-year breakdown, total value and dead money come from the PC franchise file.</p>'}`;
  };

  // ---------- change a matchup
  async function openScheduleModal(gameId, presetTeam) {
    const root = $('#modal-root');
    let opts;
    try { opts = await api(`/leagues/${state.leagueKey}/games/${gameId}/schedule-options`); } catch (e) { banner(esc(e.message), 'error'); return; }
    const g = opts.game;
    if (!opts.editable.ok) { banner(esc(opts.editable.reason), 'error'); return; }
    const inGame = [g.homeTeamId, g.awayTeamId];
    let teamId = inGame.includes(presetTeam) ? presetTeam : inGame.includes(myTeam()) ? myTeam() : g.homeTeamId;
    let newOpp = '';
    let flip = false;
    let plan = null;
    const T = (id) => opts.teams.find((t) => t.teamId === id) || { abbr: '?', name: '?' };
    const draw = () => {
      const oldOpp = teamId === g.homeTeamId ? g.awayTeamId : g.homeTeamId;
      const choices = opts.teams.filter((t) => !inGame.includes(t.teamId));
      root.innerHTML = `<div class="modal-back" id="sm-back"><div class="modal">
        <h2>Change matchup · ${esc(g.label)}: ${esc(g.away)} @ ${esc(g.home)}</h2>
        <p class="small-note">Pick whose game to change and the new opponent. The new opponent leaves his own game that week and your old opponent takes his place there, so every team still plays once that week and no bye weeks move. Written into the franchise file, with a backup first.</p>
        <div class="teamtabs">${inGame.map((id) => `<button class="teamtab${teamId === id ? ' active' : ''}" data-sm-team="${esc(id)}">${esc(T(id).name)}</button>`).join('')}</div>
        <div class="form-grid">
          <div class="field full"><span>New opponent for the ${esc(T(teamId).name)} (instead of ${esc(T(oldOpp).abbr)})</span>
            <select id="sm-opp"><option value="">Keep ${esc(T(oldOpp).abbr)}</option>${choices.map((t) => `<option value="${esc(t.teamId)}" ${t.bye || t.played ? 'disabled' : ''} ${newOpp === t.teamId ? 'selected' : ''}>${esc(t.abbr)} — ${esc(t.name)}${t.bye ? ' (bye that week)' : t.played ? ' (already played)' : ` (now ${t.home ? 'vs' : '@'} ${esc(T(t.opponentId).abbr)})`}</option>`).join('')}</select></div>
          <div class="field full"><label class="check"><input type="checkbox" id="sm-flip" ${flip ? 'checked' : ''}> Swap home and away in this game</label></div>
        </div>
        <div id="sm-plan">${plan ? `<div class="plan"><div class="headline">What changes</div>${plan.lines.map((l) => `<div>${esc(l)}</div>`).join('')}${plan.notes.length ? `<ul class="tips">${plan.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}</div>` : '<p class="small-note">Pick a new opponent or swap home and away to see what changes.</p>'}</div>
        <div class="modal-actions"><button id="sm-cancel">Cancel</button><button class="primary" id="sm-apply" ${plan ? '' : 'disabled'}>Write into franchise file</button></div>
        <p class="small-note">Close the franchise in Madden before writing, then load it again. Every change can be undone from the Schedule page.</p>
      </div></div>`;
      $('#sm-cancel').onclick = () => { root.innerHTML = ''; };
      $('#sm-back').onclick = (e) => { if (e.target.id === 'sm-back') root.innerHTML = ''; };
      $$('[data-sm-team]', root).forEach((b) => (b.onclick = () => { teamId = b.dataset.smTeam; newOpp = ''; plan = null; draw(); }));
      $('#sm-opp').onchange = (e) => { newOpp = e.target.value; replan(); };
      $('#sm-flip').onchange = (e) => { flip = e.target.checked; replan(); };
      $('#sm-apply').onclick = async () => {
        if (!plan || !confirmWrite(`Write this into the franchise file?\n\n${plan.lines.join('\n')}\n\nA backup is made first.`)) return;
        try {
          const r = await api(`/leagues/${state.leagueKey}/schedule/apply`, { method: 'POST', body: { gameId, teamId, newOpponentId: newOpp || null, flipHomeAway: flip } });
          root.innerHTML = '';
          banner(`Schedule changed. ${esc(r.entry.lines.join(' · '))}. Undo it from the Schedule page any time.`, 'ok');
          await loadLeague();
        } catch (e) { banner(esc(e.message), 'error'); }
      };
    };
    const replan = async () => {
      plan = null;
      if (!newOpp && !flip) { draw(); return; }
      try { plan = (await api(`/leagues/${state.leagueKey}/schedule/plan`, { method: 'POST', body: { gameId, teamId, newOpponentId: newOpp || null, flipHomeAway: flip } })).plan; } catch (e) { plan = null; draw(); $('#sm-plan').innerHTML = `<p class="small-note injured">${esc(e.message)}</p>`; return; }
      draw();
    };
    draw();
  }

  // ---------- teams
  sections.teams = async () => {
    if (!state.league) return '<div class="empty">Connect a franchise first.</div>';
    const teams = state.league.teams;
    if (state.teamPage && !teams.some((t) => t.teamId === state.teamPage)) state.teamPage = null;
    if (!state.teamPage) {
      // Every team, grouped by division, with its record.
      const recs = await api(`/leagues/${state.leagueKey}/recap`).catch(() => null);
      const power = recs && recs.recap ? new Map(recs.recap.powerRankings.map((p) => [p.teamId, p])) : new Map();
      const divOf = (t) => t.division || DIVS[t.abbr] || 'Teams';
      const groups = {};
      for (const t of teams) (groups[divOf(t)] ||= []).push(t);
      return `<h1>Teams</h1><p class="lead">Pick a team for everything about it: record and standing, how it is playing, schedule and results, roster, stat leaders, injuries, team news and money.</p>
        <div class="grid cols-4">${Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([d, list]) => `<div class="card"><h3>${esc(d)}</h3>${list.map((t) => { const p = power.get(t.teamId); return `<a href="#" class="team-tile ${myTeam() === t.teamId ? 'mine' : ''}" data-team-page="${esc(t.teamId)}"><b>${esc(t.abbr)}</b> <span>${esc(t.displayName)}</span><span class="rec">${p ? `${esc(p.record)} · #${p.rank}` : ''}</span></a>`; }).join('')}</div>`).join('')}</div>`;
    }
    const r = await api(`/leagues/${state.leagueKey}/teams/${state.teamPage}/profile`);
    const x = r.profile;
    const t = x.team;
    const tabs = [['overview', 'Overview'], ['schedule', 'Schedule & results'], ['roster', `Roster (${x.rosterCount.total})`], ['stats', 'Stats'], ['injuries', `Injuries (${x.rosterCount.injured})`], ['news', 'News'], ['money', 'Money']];
    const st = x.standing;
    const gameLink = (g, tab) => `<a href="#" data-team-game="${esc(g.gameId)}" data-tab2="${tab}">${esc(g.label)}</a>`;
    const nextCard = x.nextGame ? `<div class="card"><h3>Next game</h3><div class="big">${esc(x.nextGame.label)}: ${x.nextGame.home ? 'vs' : '@'} <b>${esc(x.nextGame.opponentName)}</b>${x.nextGame.opponentRecord ? ` <span class="muted">(${esc(x.nextGame.opponentRecord)})</span>` : ''}</div><div class="toolbar">${gameLink(x.nextGame, 'preview').replace(esc(x.nextGame.label), 'Matchup preview')}${x.canEditSchedule && x.nextGame.editable ? ` <button class="small" data-sched="${esc(x.nextGame.gameId)}" data-sched-team="${esc(x.teamId)}">Change matchup</button>` : ''}</div></div>` : '<div class="card"><h3>Next game</h3><div class="muted">No games left this season.</div></div>';
    const lastCard = x.lastGame ? `<div class="card"><h3>Last game</h3><div class="big"><span class="${x.lastGame.won ? 'won' : x.lastGame.won === false ? 'lost' : ''}">${esc(x.lastGame.result)}</span> ${x.lastGame.home ? 'vs' : '@'} ${esc(x.lastGame.opponentName)}</div><div class="toolbar">${gameLink(x.lastGame, 'highlights').replace(esc(x.lastGame.label), 'Highlights')} ${gameLink(x.lastGame, 'box').replace(esc(x.lastGame.label), 'Box score')}</div></div>` : '<div class="card"><h3>Last game</h3><div class="muted">No games played yet.</div></div>';
    const lead = (title, list, unit) => `<div class="card"><h3>${esc(title)}</h3>${list.length ? list.map((l) => `<div class="leader"><div class="who">${who({ ...l, teamId: null })}<div class="small-note">${esc(l.line)}</div></div><div class="n">${l.value}${unit ? ` <span class="muted small">${unit}</span>` : ''}</div></div>`).join('') : '<div class="muted">Nobody yet.</div>'}</div>`;
    let body = '';
    if (state.teamTab === 'overview') {
      body = `<div class="grid cols-2">${nextCard}${lastCard}</div>
        <div class="grid cols-2" style="margin-top:14px">
          <div class="card"><h3>Position groups (starters' average OVR)</h3>${Object.entries(x.unitOvr).map(([k, v]) => `<div class="posbar wide"><span class="p">${esc(k)}</span><span class="bar"><i style="width:${Math.max(2, ((v || 0) - 40) * 1.7)}%"></i></span><span class="m">${v ?? '—'}</span></div>`).join('')}</div>
          <div class="card"><h3>Where they rank (${esc(x.stage === 'pre' ? 'preseason' : x.stage === 'post' ? 'playoffs' : 'regular season')})</h3>${x.ranks.filter((k) => k.value != null).slice(0, 8).map((k) => `<div class="leader"><div class="who">${esc(k.label)}</div><div class="n">${k.value} <span class="muted small">#${k.rank} of ${k.of}</span></div></div>`).join('') || '<div class="muted">No games yet.</div>'}</div>
        </div>
        <div class="grid cols-3" style="margin-top:14px">${lead('Passing', x.leaders.passing, 'yds')}${lead('Rushing', x.leaders.rushing, 'yds')}${lead('Receiving', x.leaders.receiving, 'yds')}</div>
        ${x.injuries.current.length ? `<h3 style="margin-top:16px">Injured now</h3><ul class="list">${x.injuries.current.slice(0, 6).map((p) => `<li><span>${who({ ...p, teamId: null })} · ${esc(p.injury)}</span></li>`).join('')}</ul>` : ''}
        ${x.news.stories.length ? `<h3 style="margin-top:16px">Latest news</h3>${x.news.stories.slice(0, 2).map((n) => `<div class="card news"><div class="news-head">${esc(n.headline)}</div><div>${esc(n.text)}</div></div>`).join('')}` : ''}`;
    } else if (state.teamTab === 'schedule') {
      const rows = [...x.schedule.map((g) => ({ ...g, sortKey: ({ pre: 0, reg: 1, post: 2 }[g.stage] ?? 3) * 100 + g.week })), ...x.byes.map((b) => ({ ...b, sortKey: 100 + b.week }))].sort((a, b) => a.sortKey - b.sortKey);
      body = `<div class="table-tools"><button class="small" data-copy-table="tm-sched">Copy</button></div><div class="table-wrap"><table class="data" id="tm-sched"><thead><tr><th class="left">Week</th><th class="left">Opponent</th><th>Their record</th><th class="left">Result</th><th>Record after</th><th class="left"></th></tr></thead><tbody>${rows.map((g) => g.bye ? `<tr class="done"><td class="left">${esc(g.label)}</td><td class="left" colspan="5">Bye week</td></tr>` : `<tr><td class="left">${esc(g.label)}</td><td class="left">${g.home ? 'vs' : '@'} <a href="#" data-team-page="${esc(g.opponentId)}"><b>${esc(g.opponent)}</b></a> <span class="muted">${esc(g.opponentName)}</span></td><td>${esc(g.opponentRecord || '—')}</td><td class="left">${g.result ? `<span class="${g.won ? 'won' : g.won === false ? 'lost' : ''}">${esc(g.result)}</span>` : '<span class="muted">Not played</span>'}</td><td>${esc(g.recordAfter || '')}</td><td class="left no-copy">${g.status === 'played' ? `${gameLink(g, 'highlights').replace(esc(g.label), 'Highlights')} · ${gameLink(g, 'box').replace(esc(g.label), 'Box score')}` : `${gameLink(g, 'preview').replace(esc(g.label), 'Preview')}${x.canEditSchedule && g.editable ? ` <button class="small" data-sched="${esc(g.gameId)}" data-sched-team="${esc(x.teamId)}">Change matchup</button>` : ''}`}</td></tr>`).join('')}</tbody></table></div>
        ${x.canEditSchedule ? '' : '<p class="small-note">Matchups can be changed in a PC franchise file only.</p>'}`;
    } else if (state.teamTab === 'roster') {
      body = x.rosterGroups.map((gr) => `<h3>${esc(gr.label)} (${gr.players.length})</h3>${table(`tm-ros-${gr.label.replace(/\W+/g, '')}`, gr.players, [
        { key: 'name', label: 'Player', left: true, render: (p) => `${playerCell({ ...p, teamId: null })}${p.injury ? ` <span class="injured small">${esc(p.injury)}</span>` : ''}` },
        { key: 'jerseyNum', label: '#' },
        { key: 'depth', label: 'Depth', render: (p) => `${esc(p.position)}${p.depth}` },
        { key: 'overall', label: 'OVR' },
        { key: 'age', label: 'Age' },
        { key: 'devTrait', label: 'Dev', left: true },
        { key: 'yearsPro', label: 'Exp' },
        { key: 'capHit', label: 'Cap hit', render: (p) => money(p.capHit) },
        { key: 'yearsLeft', label: 'Yrs left' },
      ], { defaultSort: 'overall', maxHeight: false })}`).join('');
    } else if (state.teamTab === 'stats') {
      const a = x.advanced;
      body = `<div class="grid cols-2"><div class="card"><h3>Per game, with league rank</h3>${x.ranks.map((k) => `<div class="leader"><div class="who">${esc(k.label)}</div><div class="n">${k.value ?? '—'} ${k.rank ? `<span class="muted small">#${k.rank} of ${k.of}</span>` : ''}</div></div>`).join('')}</div>
        <div class="card"><h3>More</h3><div class="leader"><div class="who">Third downs</div><div class="n">${esc(x.extra.thirdDown || '—')}</div></div><div class="leader"><div class="who">Red zone</div><div class="n">${esc(x.extra.redZone || '—')}</div></div><div class="leader"><div class="who">Time of possession per game</div><div class="n">${esc(x.extra.possession || '—')}</div></div><div class="leader"><div class="who">Turnover margin</div><div class="n">${x.extra.turnoverMargin > 0 ? '+' : ''}${x.extra.turnoverMargin}</div></div>
          ${a ? `<h3 style="margin-top:12px">From the tool's advanced stats</h3><div class="leader"><div class="who">Pressures allowed</div><div class="n">${a.pressuresAllowed} <span class="muted small">${a.games ? (a.pressuresAllowed / a.games).toFixed(1) : 0}/g</span></div></div><div class="leader"><div class="who">Pressures by the defense</div><div class="n">${a.pressures}</div></div><div class="leader"><div class="who">Pancakes</div><div class="n">${a.pancakes}</div></div><div class="leader"><div class="who">Missed tackles</div><div class="n">${a.missedTackles}</div></div><div class="leader"><div class="who">Drops</div><div class="n">${a.drops}</div></div><div class="leader"><div class="who">Penalties</div><div class="n">${a.penalties} for ${a.penaltyYards} yds</div></div>` : ''}</div></div>
        <div class="grid cols-3" style="margin-top:14px">${lead('Passing', x.leaders.passing, 'yds')}${lead('Rushing', x.leaders.rushing, 'yds')}${lead('Receiving', x.leaders.receiving, 'yds')}</div>
        <div class="grid cols-3" style="margin-top:14px">${lead('Tackles', x.leaders.tackles, 'tkl')}${lead('Sacks', x.leaders.sacks, 'sk')}${lead('Interceptions', x.leaders.interceptions, 'INT')}</div>`;
    } else if (state.teamTab === 'injuries') {
      body = `<h3>Injured now (${x.injuries.current.length})</h3>${x.injuries.current.length ? `<ul class="list">${x.injuries.current.map((p) => `<li><span>${who({ ...p, teamId: null })} · ${esc(p.injury)}</span></li>`).join('')}</ul>` : '<div class="muted">Nobody is hurt.</div>'}
        <h3 style="margin-top:16px">Injury history the tool has seen (${x.injuries.history.length})</h3>${x.injuries.history.length ? `<ul class="list">${x.injuries.history.map((h) => `<li><span>${esc(h.name)} <span class="muted">${esc(h.position || '')}</span> · ${esc(h.injury)}${h.severityLabel ? ` · ${esc(h.severityLabel)}` : ''}${h.healed ? ' · <span class="muted">healed</span>' : ''}</span>${h.gameId ? `<a href="#" data-team-game="${esc(h.gameId)}" data-tab2="injuries">game</a>` : ''}</li>`).join('')}</ul>` : '<div class="muted">None recorded yet.</div>'}`;
    } else if (state.teamTab === 'news') {
      const n = x.news;
      body = !n.available ? '<div class="empty">League news comes from the PC franchise file; a Companion App or EA export does not include it.</div>' : `
        ${n.stories.length ? n.stories.map((s2) => `<div class="card news">${s2.breaking ? '<span class="pill loss">Breaking</span> ' : ''}<div class="news-head">${esc(s2.headline)}</div><div>${esc(s2.text)}</div></div>`).join('') : '<p class="muted">No news stories about this team yet.</p>'}
        ${n.posts.length ? `<h3>Around the league</h3><ul class="list">${n.posts.map((p) => `<li><span><b>${esc(p.author || 'Post')}</b>: ${esc(p.text)}</span></li>`).join('')}</ul>` : ''}
        <h3>Transactions (${n.transactions.length})</h3>${n.transactions.length ? `<div class="table-wrap"><table class="data" id="tm-tx"><thead><tr><th class="left">Player</th><th class="left">Move</th><th class="left">From → To</th><th>Contract</th></tr></thead><tbody>${n.transactions.map((tx) => `<tr><td class="left">${who({ ...tx, teamId: null })}</td><td class="left">${esc(tx.kind)} <span class="muted">${tx.direction === 'in' ? '(joined)' : tx.direction === 'out' ? '(left)' : ''}</span></td><td class="left">${esc(tx.fromAbbr || 'Free agency')} → ${esc(tx.toAbbr || (tx.newStatus === 'Retired' ? 'Retired' : 'Free agency'))}</td><td>${tx.contract && tx.contract.length ? `${tx.contract.length} yr, ${money(tx.contract.total)}` : '—'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="muted">No signings, releases or trades yet.</div>'}`;
    } else if (state.teamTab === 'money') {
      const c = x.cap;
      body = `${c ? `<div class="stat-row card"><div class="stat"><div class="v ${c.room < 0 ? 'injured' : ''}">${money(c.room)}</div><div class="l">cap room</div></div><div class="stat"><div class="v">${money(c.spent)}</div><div class="l">cap used</div></div><div class="stat"><div class="v">${money(c.teamCap)}</div><div class="l">team cap</div></div>${c.deadThisYear != null ? `<div class="stat"><div class="v">${money(c.deadThisYear)}</div><div class="l">dead money</div></div>` : ''}${c.nextYearRoom != null ? `<div class="stat"><div class="v">${money(c.nextYearRoom)}</div><div class="l">room next year</div></div>` : ''}</div>` : '<div class="muted">No cap numbers for this team.</div>'}
        <h3>Biggest cap hits</h3>${x.topContracts.length ? x.topContracts.map((p) => `<div class="leader"><div class="who">${who({ ...p, teamId: null })}<span>${p.yearsLeft} yr left</span></div><div class="n">${money(p.capHit)}</div></div>`).join('') : '<div class="muted">No contracts on file.</div>'}
        <div class="toolbar"><a href="#" data-ct-team="${esc(x.teamId)}">Every contract on the team</a></div>`;
    }
    const sp = st.power ? `#${st.power.rank} in power rankings` : '';
    return `<div class="head-row"><button id="team-back">← All teams</button><button class="blue" data-copy-block="team-body">Copy as text</button></div>
      <div id="team-body">
      <h1>${esc(t.name)} <span class="muted">${esc(t.abbr)}</span></h1>
      <div class="stat-row card team-head"><div class="stat"><div class="v">${esc(x.record.text)}</div><div class="l">${esc(x.record.stage === 'pre' ? 'preseason' : 'regular season')} record</div></div>${st.division ? `<div class="stat"><div class="v">${st.division.place}${['st', 'nd', 'rd'][st.division.place - 1] || 'th'}</div><div class="l">in the ${esc(st.division.name)}</div></div>` : ''}${st.power ? `<div class="stat"><div class="v">#${st.power.rank}</div><div class="l">power ranking</div></div>` : ''}<div class="stat"><div class="v">${x.record.diff > 0 ? '+' : ''}${x.record.diff}</div><div class="l">point differential</div></div><div class="stat"><div class="v">${x.record.streak ? esc(x.record.streak.text) : '—'}</div><div class="l">streak</div></div><div class="stat"><div class="v">${t.overall ?? '—'}</div><div class="l">team OVR</div></div>${x.record.form ? `<div class="stat"><div class="v form">${x.record.form.split('').map((c) => `<span class="f-${c}">${c}</span>`).join('')}</div><div class="l">last games</div></div>` : ''}</div>
      ${st.division ? `<p class="small-note">${esc(st.division.name)}: ${st.division.teams.map((d) => `${esc(d.abbr)} ${esc(d.record)}`).join(' · ')}${sp ? ` · ${esc(sp)}` : ''}</p>` : ''}
      <div class="tabs">${tabs.map(([k, l]) => `<button class="${state.teamTab === k ? 'active' : ''}" data-team-tab="${k}">${esc(l)}</button>`).join('')}</div>
      ${body}</div>`;
  };
  const DIVS = { BUF: 'AFC East', MIA: 'AFC East', NE: 'AFC East', NYJ: 'AFC East', BAL: 'AFC North', CIN: 'AFC North', CLE: 'AFC North', PIT: 'AFC North', HOU: 'AFC South', IND: 'AFC South', JAX: 'AFC South', TEN: 'AFC South', DEN: 'AFC West', KC: 'AFC West', LAC: 'AFC West', LV: 'AFC West', DAL: 'NFC East', NYG: 'NFC East', PHI: 'NFC East', WAS: 'NFC East', CHI: 'NFC North', DET: 'NFC North', GB: 'NFC North', MIN: 'NFC North', ATL: 'NFC South', CAR: 'NFC South', NO: 'NFC South', TB: 'NFC South', ARI: 'NFC West', LAR: 'NFC West', SEA: 'NFC West', SF: 'NFC West' };

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
    // Only the two teams playing this game can have somebody hurt in it, so a
    // team carried over from another screen is ignored rather than shown.
    const teams = [
      { id: g.homeTeamId, name: g.homeName, abbr: g.home },
      { id: g.awayTeamId, name: g.awayName, abbr: g.away },
    ];
    let teamId = teams.some((t) => t.id === presetTeam) ? presetTeam : g.homeTeamId;
    const rosters = {};
    const loadRoster = async (id) => {
      if (!rosters[id]) rosters[id] = (await api(`/leagues/${state.leagueKey}/teams/${id}/roster`)).players;
      return rosters[id];
    };
    await loadRoster(teamId);
    let selectedId = null;
    let plan = null;
    let search = '';
    const canApply = state.league.source === 'franchise';

    const selectedPlayer = () => (rosters[teamId] || []).find((p) => p.playerId === selectedId) || null;
    const selectedLine = () => {
      const p = selectedPlayer();
      if (!p) return '<span class="muted">Pick a player from the list above.</span>';
      return `<b>${esc(p.fullName)}</b> <span class="muted">${esc(p.position)} · #${p.jerseyNum} · ${p.overall} overall${p.injury && p.injury.status === 'Injured' ? ' · already hurt' : ''}</span>`;
    };
    const rosterHtml = () => {
      const players = rosters[teamId] || [];
      if (!players.length) return '<div class="muted" style="padding:12px">No players on this team.</div>';
      let out = '';
      let lastGroup = null;
      for (const p of players) {
        if (p.groupLabel !== lastGroup) {
          lastGroup = p.groupLabel;
          out += `<div class="rgroup" data-group="${esc(lastGroup)}">${esc(lastGroup)}</div>`;
        }
        const hurt = p.injury && p.injury.status === 'Injured';
        out += `<div class="rrow${selectedId === p.playerId ? ' sel' : ''}" data-player="${esc(p.playerId)}" data-group="${esc(p.groupLabel)}" data-search="${esc(`${p.fullName} ${p.position} ${p.jerseyNum}`.toLowerCase())}"><span class="rnum">#${p.jerseyNum}</span><span class="rname">${esc(p.fullName)}</span><span class="rpos">${esc(p.position)}</span><span class="rovr">${p.overall}</span><span class="rinj">${hurt ? '<span class="injured">hurt</span>' : ''}</span></div>`;
      }
      return out;
    };

    const draw = () => {
      const parts = state.catalog.bodyParts;
      root.innerHTML = `<div class="modal-back"><div class="modal">
        <h2>Injure a player · ${esc(g.label)}: ${esc(g.away)} @ ${esc(g.home)}</h2>
        <div class="teamtabs">${teams.map((t) => `<button class="teamtab${teamId === t.id ? ' active' : ''}" data-team="${esc(t.id)}">${esc(t.name)}</button>`).join('')}</div>
        <div style="display:flex;gap:8px"><input type="text" id="im-search" class="rsearch" placeholder="Filter by name, position or number" value="${esc(search)}"><button id="im-random" class="small" style="margin-bottom:8px;white-space:nowrap" title="Picks the way the game would: starters who are on the field a lot and have low injury ratings get hurt most">Let the game pick</button></div>
        <div id="im-roster" class="roster">${rosterHtml()}</div>
        <div id="im-selected" class="selline">${selectedLine()}</div>
        <div class="form-grid">
          <div class="field"><span>Body part</span><select id="im-part">${parts.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join('')}</select></div>
          <div class="field"><span>Injury</span><select id="im-type"></select></div>
          <div class="field"><span>Weeks out (blank = the game's normal range)</span><input type="number" id="im-weeks" min="0" max="63" placeholder="auto"></div>
          <div class="field"><span>Side</span><select id="im-side"><option value="">Random</option><option value="Left">Left</option><option value="Right">Right</option></select></div>
          <div class="field full"><label style="display:flex;align-items:center;gap:8px;color:var(--text)"><input type="checkbox" id="im-ir" style="min-width:0"> Place on injured reserve when 4+ weeks</label></div>
        </div>
        <div id="im-plan">${plan ? planHtml(plan) : '<p class="small-note">Pick a player and the injury is rolled straight away.</p>'}</div>
        <div class="modal-actions">
          <button id="im-cancel">Cancel</button>
          <button id="im-reroll" ${plan ? '' : 'disabled'}>Re-roll play</button>
          <button class="blue" id="im-schedule" ${plan ? '' : 'disabled'} title="Save it here and write it into the file later">Save for later</button>
          <button class="primary" id="im-apply" ${plan && canApply ? '' : 'disabled'} title="${canApply ? 'Write into the franchise file now (a backup is made first)' : 'Needs an open PC franchise file'}">Write into franchise file</button>
        </div>
        <p class="small-note">${g.status === 'played' ? 'This game is already in the books, so the injury is dated to it and the player misses the coming weeks.' : 'This game has not been played yet. Writing now means he sits out starting this week. To have him play and get hurt in this game, save for later and write it in right after the game.'}${canApply ? '' : ' Console franchises live on EA servers, so the tool can only save the injury here for your records.'}</p>
      </div></div>`;
      const partSel = $('#im-part'); const typeSel = $('#im-type');
      const fillTypes = () => { typeSel.innerHTML = state.catalog.byPart[partSel.value].map((t) => `<option value="${esc(t.key)}">${esc(t.name)} · ${t.seasonEnding ? 'season' : t.weeks.min + '-' + t.weeks.max + ' wk'}</option>`).join(''); };
      partSel.value = state._lastPart || 'Knee'; fillTypes(); if (state._lastType) typeSel.value = state._lastType;
      $('#im-cancel').onclick = () => { root.innerHTML = ''; };
      const req = (salt) => ({ playerId: selectedId, gameId, injuryKey: typeSel.value, weeks: $('#im-weeks').value === '' ? undefined : Number($('#im-weeks').value), side: $('#im-side').value || undefined, placeOnIR: $('#im-ir').checked, salt: salt || '' });

      const setButtons = () => {
        const ready = Boolean(selectedId && plan);
        $('#im-reroll').disabled = !ready;
        $('#im-schedule').disabled = !ready;
        $('#im-apply').disabled = !(ready && canApply);
      };
      // Picking a player rolls the injury immediately, so there is nothing
      // extra to press before writing it in.
      const roll = async (salt = '') => {
        if (!selectedId) { $('#im-plan').innerHTML = '<p class="small-note">Pick a player and the injury is rolled straight away.</p>'; plan = null; setButtons(); return; }
        try {
          plan = (await api(`/leagues/${state.leagueKey}/injuries/plan`, { method: 'POST', body: req(salt) })).plan;
          plan._salt = salt;
          $('#im-plan').innerHTML = planHtml(plan);
        } catch (e) {
          plan = null;
          $('#im-plan').innerHTML = `<p class="small-note injured">${esc(e.message)}</p>`;
        }
        setButtons();
      };

      const rosterEl = $('#im-roster');
      const applyFilter = () => {
        const q = search.trim().toLowerCase();
        for (const row of $$('[data-player]', rosterEl)) row.style.display = !q || row.dataset.search.includes(q) ? '' : 'none';
        for (const head of $$('.rgroup', rosterEl)) {
          const any = $$(`[data-player][data-group="${head.dataset.group}"]`, rosterEl).some((r) => r.style.display !== 'none');
          head.style.display = any ? '' : 'none';
        }
      };
      for (const row of $$('[data-player]', rosterEl)) {
        row.onclick = () => {
          selectedId = row.dataset.player;
          for (const other of $$('[data-player]', rosterEl)) other.classList.toggle('sel', other === row);
          $('#im-selected').innerHTML = selectedLine();
          roll('');
        };
      }
      $('#im-search').oninput = (e) => { search = e.target.value; applyFilter(); };
      if (search) applyFilter();
      // Who the game would hurt: players on the field a lot, with low injury
      // ratings, in the positions that take the most contact.
      $('#im-random').onclick = () => {
        const players = (rosters[teamId] || []).filter((p) => !(p.injury && p.injury.status === 'Injured'));
        if (!players.length) return;
        const CONTACT = { HB: 1.5, FB: 1.2, WR: 1.1, TE: 1.2, QB: 0.8, LT: 1, LG: 1, C: 1, RG: 1, RT: 1, LE: 1.1, RE: 1.1, DT: 1.1, LOLB: 1.2, MLB: 1.2, ROLB: 1.2, CB: 1.1, FS: 1.1, SS: 1.2, K: 0.05, P: 0.05, LS: 0.1 };
        const START = { QB: 1, HB: 1, FB: 1, WR: 3, TE: 1, LT: 1, LG: 1, C: 1, RG: 1, RT: 1, LE: 1, RE: 1, DT: 2, LOLB: 1, MLB: 1, ROLB: 1, CB: 2, FS: 1, SS: 1, K: 1, P: 1 };
        const rankAt = new Map();
        for (const p of players.slice().sort((a, b) => b.overall - a.overall)) { const n = (rankAt.get(p.position) || 0) + 1; rankAt.set(p.position, n); p._depth = n; }
        const weights = players.map((p) => (p._depth <= (START[p.position] || 1) ? 1 : 0.18) * (CONTACT[p.position] || 0.8) * (1 + Math.max(0, 90 - ((p.ratings && p.ratings.injury) || 80)) / 30));
        let x = Math.random() * weights.reduce((a, b) => a + b, 0);
        let pick = players[players.length - 1];
        for (let i = 0; i < players.length; i++) { x -= weights[i]; if (x <= 0) { pick = players[i]; break; } }
        search = '';
        $('#im-search').value = '';
        applyFilter();
        const row = $$('[data-player]', rosterEl).find((r) => r.dataset.player === pick.playerId);
        if (row) { row.click(); row.scrollIntoView({ block: 'center' }); }
      };
      for (const btn of $$('[data-team]', root)) {
        btn.onclick = async () => {
          if (btn.dataset.team === teamId) return;
          teamId = btn.dataset.team;
          selectedId = null;
          plan = null;
          search = '';
          await loadRoster(teamId);
          draw();
        };
      }
      partSel.onchange = () => { state._lastPart = partSel.value; fillTypes(); roll(plan ? plan._salt : ''); };
      typeSel.onchange = () => { state._lastType = typeSel.value; roll(plan ? plan._salt : ''); };
      $('#im-weeks').onchange = () => roll(plan ? plan._salt : '');
      $('#im-side').onchange = () => roll(plan ? plan._salt : '');
      $('#im-reroll').onclick = () => roll(String(Math.floor(Math.random() * 1e9)));
      setButtons();
      $('#im-schedule').onclick = async () => { try { await api(`/leagues/${state.leagueKey}/injuries/schedule`, { method: 'POST', body: req(plan._salt) }); root.innerHTML = ''; banner('Injury saved. Find it under Injury Report and write it into the file when you are ready.', 'ok'); } catch (e) { banner(esc(e.message), 'error'); } };
      $('#im-apply').onclick = async () => {
        if (!confirmWrite(`Write this injury into the franchise file now?\n\n${plan.player.name}: ${plan.injury.name}, ${plan.injury.label}.\n\nA backup copy of the file is made first. Make sure Madden is not in this franchise while writing.`)) return;
        try { const r = await api(`/leagues/${state.leagueKey}/injuries/apply`, { method: 'POST', body: { ...req(plan._salt), applyMode: 'now' } }); root.innerHTML = ''; banner(`Done. ${esc(r.plan.player.name)} is out: ${esc(r.plan.injury.name)}, ${esc(r.plan.injury.label)}. Backup: <span class="mono">${esc(r.backupPath)}</span>`, 'ok'); await loadLeague(); } catch (e) { banner(esc(e.message), 'error'); }
      };
    };
    draw();
  }
  const planHtml = (p) => `<div class="plan"><div class="headline">${esc(p.player.name)} (${esc(p.player.position)}) — ${esc(p.injury.name)}${p.injury.side !== 'NA' ? ', ' + esc(p.injury.side.toLowerCase()) : ''}</div><div>${esc(p.injury.label)} · severity ${esc(p.injury.severity)} · ${p.injury.weeks} week(s)</div><div class="muted">Happens on play ${p.play.playNumber}, Q${p.play.quarter} ${esc(p.play.clock)}, ${esc(p.play.down)}${['st', 'nd', 'rd', 'th'][Math.min(3, p.play.down - 1)]} &amp; ${p.play.distance} at the ${esc(p.play.fieldPosition)}, ${esc(p.play.playType)}.</div></div>`;

  // ---------- settings
  sections.settings = async () => {
    const s = state.status.settings;
    const opt = (id, value, list) => `<select id="${id}" data-ui="${id.replace('ui-', '')}">${list.map(([v, l]) => `<option value="${esc(v)}" ${String(value) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    const check = (id, value, label) => `<label class="check"><input type="checkbox" id="${id}" data-ui="${id.replace('ui-', '')}" ${value ? 'checked' : ''}> ${esc(label)}</label>`;
    const teams = state.league ? state.league.teams : [];
    return `
      <h1>Settings</h1>
      <div class="card">
        <h3>Look and feel</h3>
        <div class="form-grid">
          <div class="field"><span>Theme</span>${opt('ui-theme', ui.theme, [['dark', 'Dark'], ['light', 'Light'], ['contrast', 'High contrast']])}</div>
          <div class="field"><span>Accent color</span>${opt('ui-accent', ui.accent, Object.keys(ACCENTS).map((k) => [k, k[0].toUpperCase() + k.slice(1)]))}</div>
          <div class="field"><span>Text size</span>${opt('ui-textSize', ui.textSize, [['small', 'Small'], ['normal', 'Normal'], ['large', 'Large'], ['xlarge', 'Extra large']])}</div>
          <div class="field"><span>Tables</span>${opt('ui-density', ui.density, [['comfortable', 'Comfortable'], ['compact', 'Compact (more rows on screen)']])}</div>
        </div>
        <div class="checks">${check('ui-sourceTags', ui.sourceTags, 'Show where each number comes from (R recorded, ~ reconstructed, T tracked)')}${check('ui-stickyHeaders', ui.stickyHeaders, 'Keep table headers on screen while scrolling')}${check('ui-reduceMotion', ui.reduceMotion, 'Reduce motion')}</div>
      </div>
      <div class="card" style="margin-top:14px">
        <h3>How the app starts and filters</h3>
        <div class="form-grid">
          <div class="field"><span>Open on this page</span>${opt('ui-startPage', ui.startPage, [['connect', 'Connect'], ['schedule', 'Schedule & Injury Tool'], ['teams', 'Teams'], ['recap', 'Weekly Recap'], ['highlights', 'Highlights'], ['contracts', 'Contracts & Cap'], ['blocking', 'Blocking']])}</div>
          <div class="field"><span>Season part to show first</span>${opt('ui-defaultStage', ui.defaultStage, [['auto', 'Whatever has games'], ['pre', 'Preseason'], ['reg', 'Regular season'], ['post', 'Playoffs']])}</div>
          <div class="field"><span>My team${state.league ? ` in ${esc(state.league.name)}` : ''}</span>${state.league ? `<select id="ui-myTeam"><option value="">None</option>${teams.map((t) => `<option value="${esc(t.teamId)}" ${myTeam() === t.teamId ? 'selected' : ''}>${esc(t.abbr)} — ${esc(t.displayName)}</option>`).join('')}</select>` : '<span class="muted">Open a league first</span>'}</div>
        </div>
        <div class="checks">${check('ui-myTeamFilter', ui.myTeamFilter, 'Show only my team when a league opens')}</div>
        <p class="small-note">Your team's rows are highlighted in every table.</p>
      </div>
      <div class="card" style="margin-top:14px">
        <h3>Copy and numbers</h3>
        <div class="form-grid">
          <div class="field"><span>What Copy puts on the clipboard</span>${opt('ui-copyFormat', ui.copyFormat, [['aligned', 'Plain text, columns lined up'], ['discord', 'Plain text in a code block (Discord)'], ['tabs', 'Tab-separated (pastes into Excel / Sheets)']])}</div>
          <div class="field"><span>Money</span>${opt('ui-moneyFormat', ui.moneyFormat, [['short', '$36.33M'], ['full', '$36,330,000']])}</div>
        </div>
        <div class="modal-actions"><button id="ui-reset">Reset look and feel to defaults</button></div>
        <p class="small-note" id="ui-saved">Changes apply and save right away.</p>
      </div>
      <div class="card" style="margin-top:14px">
        <h3>Pages</h3>
        <div class="form-grid">
          <div class="field"><span>Played games open on</span>${opt('ui-gameTab', ui.gameTab, [['highlights', 'Highlights'], ['box', 'Box score'], ['blocking', 'Blocking'], ['injuries', 'Injuries']])}</div>
          <div class="field"><span>Names in each leaderboard</span>${opt('ui-leaderLength', ui.leaderLength, [['5', '5'], ['8', '8'], ['10', '10'], ['15', '15']])}</div>
        </div>
        <p class="small-note" style="margin-top:12px">Show these pages in the sidebar:</p>
        <div class="checks cols">${PAGES.map(([k, l]) => `<label class="check"><input type="checkbox" data-page-toggle="${k}" ${(ui.hiddenPages || []).includes(k) ? '' : 'checked'}> ${esc(l)}</label>`).join('')}</div>
      </div>
      <div class="card" style="margin-top:14px">
        <h3>Franchise file</h3>
        <div class="checks">${check('ui-autoReload', ui.autoReload, 'Reload the franchise file by itself when Madden saves it')}${check('ui-confirmWrites', ui.confirmWrites, 'Ask before writing anything into the franchise file')}</div>
        <div class="form-grid" style="margin-top:10px">
          <div class="field"><span>Check for a new save every</span>${opt('ui-autoReloadSec', ui.autoReloadSec, [['15', '15 seconds'], ['30', '30 seconds'], ['60', '1 minute'], ['300', '5 minutes']])}</div>
          <div class="field"><span>Backups to keep (made before every write)</span><select id="set-backupKeep">${[['0', 'All of them'], ['5', 'Last 5'], ['10', 'Last 10'], ['20', 'Last 20'], ['50', 'Last 50']].map(([v, l]) => `<option value="${v}" ${String(s.backupKeep || 0) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        </div>
        <div id="backup-list">${state.status.franchiseOpen ? '<p class="small-note">Loading backups…</p>' : '<p class="small-note">Open a PC franchise file to see its backups.</p>'}</div>
      </div>
      <div class="card" style="margin-top:14px">
        <h3>Your data</h3>
        <p class="small-note">Everything the tool keeps for ${state.league ? esc(state.league.name) : 'a league'}: Game Tracker events, injuries you made, the injury history and schedule changes.</p>
        <div class="toolbar">${state.league ? `<a class="pill" href="/api/leagues/${encodeURIComponent(state.leagueKey)}/export" download>Save a copy of this league's data</a><button class="danger" id="data-clear-ledger">Clear injury history</button><button class="danger" id="data-clear-tracker">Clear Game Tracker events</button>` : ''}<button class="danger" id="ui-reset-all">Reset every setting</button></div>
      </div>
      <div class="card" style="margin-top:14px">
        <h3>Connection</h3>
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
    $$('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.section === state.section || (state.section === 'game' && b.dataset.section === (['highlights', 'recap', 'teams'].includes(state.backTo) ? state.backTo : 'schedule'))));
    const showFilters = !['connect', 'settings', 'game', 'recap', 'teams'].includes(state.section);
    $('#stage-field').classList.toggle('hidden', !showFilters || state.section === 'contracts');
    $('#team-field').classList.toggle('hidden', !showFilters || ['tracker', 'injuries'].includes(state.section));
    const weekOn = showFilters && !['tracker', 'injuries', 'contracts'].includes(state.section) && !(state.section === 'blocking' && state.blockView === 'weekly');
    $('#week-field').classList.toggle('hidden', !weekOn);
    if (weekOn) fillWeeks();
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
    on('[data-open-game]', 'onclick', (e) => { e.stopPropagation(); state.gameId = e.currentTarget.dataset.openGame; state.gameTab = e.currentTarget.dataset.openTab; state.backTo = 'schedule'; state.section = 'game'; render(); });
    on('[data-hl-game]', 'onclick', (e) => { state.gameId = e.currentTarget.dataset.hlGame; state.gameTab = 'highlights'; state.backTo = ['recap', 'teams'].includes(state.section) ? state.section : 'highlights'; state.section = 'game'; render(); });
    on('[data-sched]', 'onclick', (e) => { e.stopPropagation(); openScheduleModal(e.currentTarget.dataset.sched, e.currentTarget.dataset.schedTeam || null); });
    on('[data-team-page]', 'onclick', (e) => { e.preventDefault(); e.stopPropagation(); state.teamPage = e.currentTarget.dataset.teamPage; state.teamTab = 'overview'; state.section = 'teams'; render(); });
    on('[data-team-tab]', 'onclick', (e) => { state.teamTab = e.currentTarget.dataset.teamTab; render(); });
    on('#team-back', 'onclick', () => { state.teamPage = null; render(); });
    on('[data-team-game]', 'onclick', (e) => { e.preventDefault(); state.gameId = e.currentTarget.dataset.teamGame; state.gameTab = e.currentTarget.dataset.tab2 || 'highlights'; state.backTo = 'teams'; state.section = 'game'; render(); });
    on('[data-undo-sched]', 'onclick', async (e) => {
      if (!confirmWrite('Put this schedule change back in the franchise file? A backup is made first.')) return;
      try { await api(`/leagues/${state.leagueKey}/schedule/undo/${e.currentTarget.dataset.undoSched}`, { method: 'POST' }); banner('Schedule change undone.', 'ok'); await loadLeague(); } catch (err) { banner(esc(err.message), 'error'); }
    });
    on('[data-hl-week]', 'onclick', (e) => { state.week = e.currentTarget.dataset.hlWeek; render(); });
    on('[data-bview]', 'onclick', (e) => { state.blockView = e.currentTarget.dataset.bview; render(); });
    on('#bw-team', 'onchange', (e) => { state.weeklyTeam = e.target.value; render(); });
    on('[data-player]', 'onclick', (e) => { e.preventDefault(); e.stopPropagation(); openPlayerLog(e.currentTarget.dataset.player); });
    on('[data-csv]', 'onclick', (e) => exportCsv(e.currentTarget.dataset.csv));
    on('[data-copy-table]', 'onclick', async (e) => { const btn = e.currentTarget; const t = document.getElementById(btn.dataset.copyTable); copied(btn, t ? await copyText(tableToText(t)) : false); });
    on('[data-copy-block]', 'onclick', async (e) => { const btn = e.currentTarget; const el = document.getElementById(btn.dataset.copyBlock); copied(btn, el ? await copyText(nodeToText(el)) : false); });
    on('[data-recap]', 'onclick', (e) => { state.recapKey = e.currentTarget.dataset.recap; render(); });
    on('[data-cview]', 'onclick', (e) => { state.contractsView = e.currentTarget.dataset.cview; render(); });
    on('#ct-team', 'onchange', (e) => { state.contractsTeam = e.target.value; render(); });
    on('[data-ct-team]', 'onclick', (e) => { e.preventDefault(); state.contractsTeam = e.currentTarget.dataset.ctTeam; state.contractsView = 'team'; state.section = 'contracts'; render(); });
    on('[data-preview-game]', 'onclick', (e) => { e.preventDefault(); state.gameId = e.currentTarget.dataset.previewGame; state.gameTab = 'preview'; state.backTo = state.section; state.section = 'game'; render(); });
    on('[data-injure]', 'onclick', (e) => { e.stopPropagation(); openInjuryModal(e.currentTarget.dataset.injure, state.gameTeam); });
    on('[data-track]', 'onclick', (e) => { state.gameId = e.currentTarget.dataset.track; state.section = 'tracker'; render(); });
    on('.game[data-game]', 'onclick', (e) => { const g = state.schedule.find((x) => x.gameId === e.currentTarget.dataset.game); if (g) { state.gameId = g.gameId; state.gameTab = g.status === 'played' ? ui.gameTab || 'highlights' : 'preview'; state.backTo = 'schedule'; state.section = 'game'; render(); } });
    on('#back-sched', 'onclick', () => { state.section = ['highlights', 'recap', 'contracts', 'teams'].includes(state.backTo) ? state.backTo : 'schedule'; render(); });
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
    on('[data-heal]', 'onclick', async (e) => { if (!confirmWrite('Heal this player in the franchise file?')) return; try { await api(`/leagues/${state.leagueKey}/injuries/heal`, { method: 'POST', body: { playerId: e.currentTarget.dataset.heal } }); banner('Healed.', 'ok'); await loadLeague(); } catch (err) { banner(esc(err.message), 'error'); } });
    on('[data-apply-sched]', 'onclick', async (e) => {
      const r = await api(`/leagues/${state.leagueKey}/injuries`);
      const entry = r.log.find((x) => x.id === e.currentTarget.dataset.applySched);
      if (!entry || !confirmWrite(`Write ${entry.plan.player.name}'s ${entry.plan.injury.name} into the franchise file now? A backup is made first.`)) return;
      try { await api(`/leagues/${state.leagueKey}/injuries/apply`, { method: 'POST', body: { ...entry.request, applyMode: 'later' } }); await api(`/leagues/${state.leagueKey}/injuries/log/${entry.id}`, { method: 'DELETE' }); banner('Written to the franchise file.', 'ok'); await loadLeague(); } catch (err) { banner(esc(err.message), 'error'); }
    });
    on('[data-ui]', 'onchange', async (e) => {
      const el = e.currentTarget;
      const key = el.dataset.ui;
      const val = el.type === 'checkbox' ? el.checked : ['leaderLength', 'autoReloadSec'].includes(key) ? Number(el.value) : el.value;
      await saveUi({ [key]: val });
      const note = $('#ui-saved'); if (note) note.textContent = 'Saved.';
      if (['moneyFormat', 'sourceTags'].includes(key)) render();
      if (['autoReload', 'autoReloadSec'].includes(key)) startAutoReload();
    });
    on('#ui-myTeam', 'onchange', async (e) => { await saveUi({ myTeams: { ...(ui.myTeams || {}), [state.leagueKey]: e.target.value || null } }); const note = $('#ui-saved'); if (note) note.textContent = 'Saved.'; });
    on('[data-page-toggle]', 'onchange', async () => {
      const hidden = $$('[data-page-toggle]').filter((c) => !c.checked).map((c) => c.dataset.pageToggle);
      await saveUi({ hiddenPages: hidden });
      const note = $('#ui-saved'); if (note) note.textContent = 'Saved.';
    });
    on('#set-backupKeep', 'onchange', async (e) => { try { await api('/settings', { method: 'POST', body: { backupKeep: Number(e.target.value) } }); state.status.settings.backupKeep = Number(e.target.value); banner('Saved. Older backups past that number are removed.', 'ok'); render(); } catch (err) { banner(esc(err.message), 'error'); } });
    on('#data-clear-ledger', 'onclick', async () => { if (!confirm('Forget every injury the tool has recorded for this league? Injuries already in the franchise file are not touched.')) return; await api(`/leagues/${state.leagueKey}/injury-ledger`, { method: 'DELETE' }); banner('Injury history cleared.', 'ok'); });
    on('#data-clear-tracker', 'onclick', async () => { if (!confirm('Delete every Game Tracker event you logged for this league?')) return; await api(`/leagues/${state.leagueKey}/tracker`, { method: 'DELETE' }); state.seasonCache.clear(); banner('Game Tracker events cleared.', 'ok'); });
    on('#ui-reset-all', 'onclick', async () => { if (!confirm('Put every setting back to how it started? Your teams and data are kept.')) return; await saveUi({ ...UI_DEFAULTS, myTeams: ui.myTeams || {} }); render(); });
    on('[data-restore]', 'onclick', async (e) => {
      const file = e.currentTarget.dataset.restore;
      if (!confirm(`Put this backup back in place of the franchise file?\n\n${file}\n\nThe current file is backed up first, so this can be undone the same way.`)) return;
      try { await api('/franchise/backups/restore', { method: 'POST', body: { file } }); banner('Backup restored. Load the franchise again in Madden to see it.', 'ok'); await loadLeague(); } catch (err) { banner(esc(err.message), 'error'); }
    });
    if ($('#backup-list') && state.status.franchiseOpen && !$('#backup-list').dataset.loaded) {
      $('#backup-list').dataset.loaded = '1';
      api('/franchise/backups').then((r) => {
        const el = $('#backup-list'); if (!el) return;
        el.innerHTML = r.backups.length ? `<p class="small-note">Backups of the open file (${r.backups.length}), newest first:</p><ul class="list">${r.backups.slice(0, 15).map((b) => `<li><span class="small"><span class="mono">${esc(b.file)}</span> · ${esc(new Date(b.modified).toLocaleString())} · ${(b.size / 1048576).toFixed(1)} MB</span><button class="small" data-restore="${esc(b.file)}">Restore</button></li>`).join('')}</ul>` : '<p class="small-note">No backups yet. One is made before every write.</p>';
        bind();
      }).catch(() => {});
    }
    on('#ui-reset', 'onclick', async () => { await saveUi({ theme: UI_DEFAULTS.theme, accent: UI_DEFAULTS.accent, textSize: UI_DEFAULTS.textSize, density: UI_DEFAULTS.density, sourceTags: true, stickyHeaders: true, reduceMotion: false }); render(); });
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
  $('#btn-copy-page').onclick = async (e) => { const btn = e.currentTarget; copied(btn, await copyText(nodeToText($('#content')))); };
  $('#btn-refresh').onclick = async () => { banner('Refreshing…'); try { if (state.status.franchiseOpen && state.league && state.league.source === 'franchise') await api('/franchise/refresh', { method: 'POST' }); await loadStatus(); await loadLeague(); banner(''); } catch (e) { banner(esc(e.message), 'error'); } };
  $('#league-select').onchange = async (e) => { state.leagueKey = e.target.value; state.gameId = null; await loadLeague(); };
  $('#stage-select').onchange = (e) => { state.stage = e.target.value; state.week = ''; fillWeeks(); render(); };
  $('#week-select').onchange = (e) => { state.week = e.target.value; render(); };
  $('#team-select').onchange = (e) => { state.teamId = e.target.value; render(); };
  $$('#nav button').forEach((b) => (b.onclick = () => { state.section = b.dataset.section; render(); }));
  if (window.m26 && window.m26.onMenuOpenFile) window.m26.onMenuOpenFile(openFile);

  // Reload the franchise file by itself when Madden saves it (setting).
  let reloadTimer = null;
  let lastMtime = null;
  // Remember the save time of the file as loaded, so a later save by Madden
  // (and not the tool's own writes, which reload right away) is noticed.
  async function noteFileTime() {
    try { const r = await api('/franchise/status'); lastMtime = r.file ? r.file.modified : null; } catch { /* ignore */ }
  }
  function startAutoReload() {
    if (reloadTimer) clearInterval(reloadTimer);
    reloadTimer = null;
    if (!ui.autoReload) return;
    noteFileTime();
    reloadTimer = setInterval(async () => {
      if (!state.status || !state.status.franchiseOpen || document.querySelector('#modal-root .modal')) return;
      try {
        const r = await api('/franchise/status');
        if (!r.file) return;
        if (lastMtime && r.file.modified !== lastMtime) {
          await api('/franchise/refresh', { method: 'POST' });
          await loadStatus();
          await loadLeague();
          banner(`Madden saved the franchise; reloaded at ${esc(new Date().toLocaleTimeString())}.`, 'ok');
        }
        lastMtime = r.file.modified;
      } catch { /* try again next time */ }
    }, Math.max(15, Number(ui.autoReloadSec) || 30) * 1000);
  }

  // Poll for new exports while on the Connect page.
  setInterval(async () => { if (state.section !== 'connect') return; try { const before = JSON.stringify(state.status.leagues); await loadStatus(); if (JSON.stringify(state.status.leagues) !== before) { if (!state.leagueKey) state.leagueKey = state.status.leagues[0] && state.status.leagues[0].leagueKey; await loadLeague(); } } catch {} }, 8000);

  (async () => {
    try {
      await loadStatus();
      if (ui.startPage && sections[ui.startPage] && state.status.leagues.length && !(ui.hiddenPages || []).includes(ui.startPage)) state.section = ui.startPage;
      startAutoReload();
      await loadLeague();
    } catch (e) { banner(esc(e.message), 'error'); }
  })();
})();
