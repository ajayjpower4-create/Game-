/* ------------------------------------------------------------------------
 * NFL Franchise Simulator — screens, state and the save system.
 *
 * Six tabs once a franchise is running: Dashboard, Media, Team Settings,
 * Practice, Game Day and League. Everything works offline; the league media
 * generator reaches for the server when it can and falls back to the local
 * writer when it cannot.
 * ---------------------------------------------------------------------- */

import {
  TEAMS, TEAM_BY_CODE, DIVISIONS, PRACTICE_TYPES, INJURY_TYPES, ABSENCE_REASONS,
  MEDIA_ROLES, OUTLETS, GAMEPLAN_PRESETS, OFFENSE_SCHEMES, DEFENSE_SCHEMES,
  POSITION_ORDER, SALARY_CAP, FIRST_NAMES, LAST_NAMES, ROSTER_SHAPE,
} from './data.js';

import {
  buildRoster, buildSchedule, teamSchedule, gameFor, teamStrength, capUsed,
  depthChart, starters, isAvailable, leagueRatings, makeRng, seedFrom, shuffle,
  simWeek, rosterFor, blankRecord, applyResult, winPct, sortedDivision,
  conferenceSeeds, applyPractice, generateBoxScore, applyGameToPlayers,
  advanceWeekHealth, tradeValue, PICK_VALUE, pickLabel, defaultPicks,
  evaluateTrade, localMedia, sanitizeMediaItems, contractFor, clamp, byDepth,
  simGame, rollInjury, resetUid,
} from './sim.js';

const SAVE_KEY = 'nfl-franchise-save-v1';
const CHECKPOINT_KEY = 'nfl-franchise-checkpoints-v1';
const MAX_CHECKPOINTS = 8;
const PRESEASON_WEEKS = 3;
const REGULAR_WEEKS = 18;
const GAME_DAY = 7;

/* ------------------------------------------------------------------ dom */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function modal(title, bodyHtml, actionsHtml = '') {
  $('#modal-root').innerHTML = `
    <div class="modal-backdrop" data-modal-backdrop>
      <div class="modal" role="dialog" aria-modal="true">
        <h3>${esc(title)}</h3>
        ${bodyHtml}
        <div class="modal-actions">
          ${actionsHtml}
          <button class="ghost-btn" data-action="close-modal" type="button">Close</button>
        </div>
      </div>
    </div>`;
}
const closeModal = () => { $('#modal-root').innerHTML = ''; };

/* ---------------------------------------------------------------- state */

let state = null;      // the live franchise
let setup = null;      // pre-kickoff wizard state
let ui = { tab: 'dashboard', mediaFilter: 'all', rosterSort: 'depth', rosterFilter: '', tradePartner: null, tradeGive: [], tradeGet: [], leagueWeek: 1 };

function saveNow(quiet) {
  if (!state) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    if (!quiet) flashSave('Saved');
  } catch (err) {
    flashSave('Save failed');
  }
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveNow(true), 200);
  flashSave('Saving…');
}

function flashSave(text) {
  const el = $('#save-status');
  if (!el) return;
  el.textContent = text;
  if (text === 'Saving…') setTimeout(() => { if (el.textContent === 'Saving…') el.textContent = 'Saved'; }, 400);
}

function checkpoint(label) {
  if (!state) return;
  try {
    const list = JSON.parse(localStorage.getItem(CHECKPOINT_KEY) || '[]');
    list.unshift({ label, at: new Date().toISOString(), data: JSON.stringify(state) });
    localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(list.slice(0, MAX_CHECKPOINTS)));
  } catch (err) { /* storage full — the main save still matters more */ }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && data.teamId ? data : null;
  } catch (err) { return null; }
}

/* -------------------------------------------------------------- helpers */

const myTeam = () => TEAM_BY_CODE[state.teamId];
const teamName = (code) => `${TEAM_BY_CODE[code].city} ${TEAM_BY_CODE[code].name}`;
const weeksInPhase = (phase) => (phase === 'preseason' ? PRESEASON_WEEKS : REGULAR_WEEKS);

function applyTeamColors(code) {
  const t = TEAM_BY_CODE[code];
  if (!t) return;
  document.documentElement.style.setProperty('--team-primary', t.colors[0]);
  document.documentElement.style.setProperty('--team-secondary', t.colors[1]);
}

function ovrClass(n) {
  return n >= 88 ? 'elite' : n >= 79 ? 'good' : n >= 70 ? 'mid' : 'low';
}

function stamp() {
  const phase = state.phase === 'preseason' ? 'PRE' : 'WK';
  return `${phase}${state.week} · D${state.day}`;
}

function playerById(id) {
  return state.roster.find((p) => p.id === id);
}

function statusOf(p) {
  if (p.status === 'ir') return { label: 'IR', cls: 'ir' };
  if (p.injury && p.injury.weeksOut > 0) return { label: `OUT ${p.injury.weeksOut}w`, cls: 'out' };
  return { label: 'Active', cls: 'ok' };
}

function myRecord() {
  const st = computeStandings();
  return st[state.teamId] || blankRecord();
}

function recordText(rec) {
  return rec.t ? `${rec.w}-${rec.l}-${rec.t}` : `${rec.w}-${rec.l}`;
}

function computeStandings() {
  const standings = {};
  TEAMS.forEach((t) => { standings[t.code] = blankRecord(); });
  state.results.forEach((r) => applyResult(standings, r));
  return standings;
}

function currentGame() {
  if (!state.schedule || state.phase === 'offseason') return null;
  return gameFor(state.schedule, state.phase, state.week, state.teamId);
}

function resultFor(phase, week, code) {
  return state.results.find((r) => r.phase === phase && r.week === week
    && (r.home === code || r.away === code));
}

const myGamePlayed = () => !!resultFor(state.phase, state.week, state.teamId);

function totalCapUsed() {
  return Math.round((capUsed(state.roster) + (state.deadCap || 0)) * 10) / 10;
}

function pushMedia(item) {
  state.media.unshift({
    id: `m${Date.now()}${Math.floor(Math.random() * 999)}`,
    ts: stamp(),
    phase: state.phase,
    week: state.week,
    day: state.day,
    ...item,
  });
  state.media = state.media.slice(0, 300);
}

/* ------------------------------------------------------------- screens */

function showScreen(name) {
  $$('.screen').forEach((s) => { s.hidden = s.dataset.screen !== name; });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderClock() {
  const clock = $('#clock');
  if (!state) { clock.hidden = true; return; }
  clock.hidden = false;
  const phase = state.phase === 'preseason' ? 'Preseason' : state.phase === 'offseason' ? 'Offseason' : 'Regular Season';
  $('#clock-phase').textContent = phase;
  $('#clock-week').textContent = state.phase === 'offseason' ? String(state.year) : `Week ${state.week}`;
  $('#clock-day').textContent = state.phase === 'offseason' ? 'Season over' : state.day === GAME_DAY ? 'Game Day' : `Day ${state.day}`;
}

/* -------------------------------------------------------- team selection */

function renderTeamSelect() {
  const grid = $('#team-grid');
  let html = '';
  for (const conf of ['AFC', 'NFC']) {
    for (const div of DIVISIONS) {
      html += `<div class="div-head">${conf} ${div}</div>`;
      TEAMS.filter((t) => t.conf === conf && t.div === div).forEach((t) => {
        const selected = setup?.teamId === t.code ? ' selected' : '';
        html += `
          <button class="team-card${selected}" type="button" data-action="pick-team" data-code="${t.code}"
                  style="--tp:${t.colors[0]};--ts:${t.colors[1]}">
            <span class="team-chip">${t.code}</span>
            <span><b>${esc(t.city)} ${esc(t.name)}</b><span>${esc(t.hc)}</span></span>
          </button>`;
      });
    }
  }
  grid.innerHTML = html;
  $('#btn-to-roster').disabled = !setup?.teamId;
}

function pickTeam(code) {
  setup.teamId = code;
  resetUid(0);
  setup.roster = buildRoster(code, seedFrom(`roster-${code}`));
  applyTeamColors(code);
  renderTeamSelect();
  const t = TEAM_BY_CODE[code];
  const s = teamStrength(setup.roster, { healthyOnly: false });
  const top = setup.roster.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 5)
    .map((p) => `${p.pos} ${p.name} (${p.ovr})`).join(' · ');
  $('#btn-to-roster').textContent = `Take the ${t.name} job`;
  toast(`${t.city} ${t.name} — OFF ${s.off.toFixed(0)} / DEF ${s.def.toFixed(0)} · ${top}`);
}

/* ----------------------------------------------------------- roster edit */

function renderRosterEdit() {
  const filter = ($('#roster-filter')?.value || '').toLowerCase();
  const rows = setup.roster
    .filter((p) => !filter || p.name.toLowerCase().includes(filter) || p.pos.toLowerCase().includes(filter))
    .map((p) => `
      <tr>
        <td class="num">${p.jersey}</td>
        <td>${p.pos}</td>
        <td><input class="cell-input" data-edit="name" data-id="${p.id}" value="${esc(p.name)}" /></td>
        <td class="num"><input class="cell-input num" data-edit="ovr" data-id="${p.id}" type="number" min="50" max="99" value="${p.ovr}" /></td>
        <td class="num"><input class="cell-input num" data-edit="age" data-id="${p.id}" type="number" min="20" max="45" value="${p.age}" /></td>
        <td class="num">$${p.contract.apy}M</td>
        <td>${p.real ? '<span class="tag">real</span>' : '<span class="tag new">depth</span>'}</td>
      </tr>`).join('');

  $('#roster-edit-table').innerHTML = `
    <table>
      <thead><tr><th class="num">#</th><th>Pos</th><th>Player</th><th class="num">OVR</th><th class="num">Age</th><th class="num">APY</th><th>Source</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;

  const s = teamStrength(setup.roster, { healthyOnly: false });
  $('#roster-summary').textContent =
    `${setup.roster.length} players · Offense ${s.off.toFixed(1)} · Defense ${s.def.toFixed(1)} · Cap used $${capUsed(setup.roster)}M of $${SALARY_CAP}M`;
}

function editSetupPlayer(id, field, value) {
  const p = setup.roster.find((x) => x.id === id);
  if (!p) return;
  if (field === 'name') p.name = value.slice(0, 40) || p.name;
  if (field === 'ovr') {
    p.ovr = clamp(Math.round(Number(value) || p.ovr), 50, 99);
    p.contract = { ...contractFor(p.pos, p.ovr, p.age), yearsLeft: p.contract.yearsLeft };
  }
  if (field === 'age') {
    p.age = clamp(Math.round(Number(value) || p.age), 20, 45);
    p.exp = Math.max(0, p.age - 22);
  }
}

/* -------------------------------------------------------------- schedule */

function buildSetupSchedule(seed) {
  const rosters = {};
  TEAMS.forEach((t) => {
    rosters[t.code] = t.code === setup.teamId ? setup.roster : buildRoster(t.code, seedFrom(`roster-${t.code}-${seed}`));
  });
  setup.aiRosters = Object.fromEntries(Object.entries(rosters).filter(([c]) => c !== setup.teamId));
  const ratings = leagueRatings(rosters);
  const sched = buildSchedule({ year: setup.year, seed, ratings });
  if (!sched) {
    toast('Schedule generator hit a wall — reshuffling.');
    return buildSetupSchedule(seed + 977);
  }
  return sched;
}

function renderSchedule() {
  const code = setup.teamId;
  const rows = teamSchedule(setup.schedule, code);
  const pre = rows.filter((r) => r.phase === 'preseason');
  const reg = rows.filter((r) => r.phase === 'regular');

  const line = (r) => {
    if (r.bye) return `<div class="sched-row"><span class="wk">Week ${r.week}</span><span class="bye">Bye week</span><span></span></div>`;
    const opp = TEAM_BY_CODE[r.opp];
    return `<div class="sched-row">
      <span class="wk">Week ${r.week}</span>
      <span>${r.home ? '<span class="at">vs</span>' : '<span class="at">at</span>'} ${esc(opp.city)} ${esc(opp.name)}</span>
      <span class="res">${r.home ? myTeamStadium() : esc(opp.stadium)}</span>
    </div>`;
  };
  function myTeamStadium() { return esc(TEAM_BY_CODE[code].stadium); }

  $('#pre-schedule').innerHTML = pre.map(line).join('') || '<p class="empty">No preseason games.</p>';
  $('#reg-schedule').innerHTML = reg.map(line).join('');
  const homes = reg.filter((r) => r.home && !r.bye).length;
  const bye = reg.find((r) => r.bye);
  $('#sched-note').textContent = `${homes} home · ${reg.filter((r) => !r.bye).length - homes} away · bye in week ${bye ? bye.week : '—'}`;
}

/* ------------------------------------------------------- franchise start */

function generateFreeAgents(seed) {
  const rng = makeRng(seed);
  const out = [];
  const positions = ROSTER_SHAPE.map((r) => r.pos);
  for (let i = 0; i < 36; i += 1) {
    const pos = positions[Math.floor(rng() * positions.length)];
    const ovr = clamp(Math.round(58 + rng() * 24), 55, 84);
    const age = Math.round(23 + rng() * 11);
    const name = `${FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)]} ${LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)]}`;
    out.push({
      id: `fa${i}-${Math.floor(rng() * 1e6)}`,
      name, pos, ovr, age, exp: Math.max(0, age - 22),
      jersey: 1 + Math.floor(rng() * 98),
      injury: null, status: 'active', fatigue: 0, sharpness: 45, morale: 65, reps: 0, practiceNotes: 0,
      season: { gp: 0, snaps: 0, pass: 0, rush: 0, rec: 0, td: 0, tackles: 0, sacks: 0, ints: 0 },
      contract: contractFor(pos, ovr, age, rng),
      real: false,
    });
  }
  return out.sort((a, b) => b.ovr - a.ovr);
}

function startFranchise(phase) {
  state = {
    v: 1,
    teamId: setup.teamId,
    year: setup.year,
    phase,
    week: 1,
    day: 1,
    roster: setup.roster,
    aiRosters: setup.aiRosters,
    schedule: setup.schedule,
    results: [],
    media: [],
    practices: [],
    transactions: [],
    picks: defaultPicks(setup.year),
    aiPicks: {},
    freeAgents: generateFreeAgents(setup.schedule.seed + 5),
    deadCap: 0,
    skippedPreseason: phase === 'regular',
    practiceDraft: blankPracticeDraft(),
    gameDraft: blankGameDraft(),
    settings: { autoMedia: true },
    aiMedia: { available: null },
  };
  const t = myTeam();
  pushMedia({
    kind: 'wire',
    outlet: 'League Wire',
    headline: `${t.city} hand the keys to a new front office`,
    body: phase === 'regular'
      ? `The ${t.name} open the regular season with no preseason tape to work from. ${t.hc} remains the head coach.`
      : `Camp opens with the ${t.name} carrying ${state.roster.length} players. ${t.hc} remains the head coach.`,
  });
  ui.tab = 'dashboard';
  ui.leagueWeek = 1;
  checkpoint('Franchise created');
  saveNow(true);
  enterFranchise();
}

function blankPracticeDraft() {
  return { typeId: 'padded', injuries: [], absences: [], bigPlays: [] };
}

function blankGameDraft() {
  return {
    presetId: 'starters-all',
    offScheme: 'balanced',
    defScheme: 'base',
    inactives: [],
    teamScore: '',
    oppScore: '',
    injuries: [],
    plays: [],
  };
}

function enterFranchise() {
  applyTeamColors(state.teamId);
  const t = myTeam();
  $('#brand-title').textContent = `${t.city} ${t.name}`;
  $('#brand-sub').textContent = `Franchise Simulator · ${state.year}`;
  $('#brand-mark').textContent = t.code;
  renderClock();
  showScreen('franchise');
  renderFranchise();
}

/* ------------------------------------------------------- franchise shell */

function renderFranchise() {
  renderClock();
  renderHead();
  $$('.tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === ui.tab));
  const body = $('#tab-body');
  const renderers = {
    dashboard: renderDashboard,
    media: renderMedia,
    team: renderTeam,
    practice: renderPractice,
    gameday: renderGameDay,
    league: renderLeague,
  };
  body.innerHTML = (renderers[ui.tab] || renderDashboard)();
  afterRender();
}

function renderHead() {
  const t = myTeam();
  const rec = myRecord();
  const s = teamStrength(state.roster);
  const cap = totalCapUsed();
  const space = Math.round((SALARY_CAP - cap) * 10) / 10;
  const inj = state.roster.filter((p) => !isAvailable(p)).length;
  const g = currentGame();
  const next = g
    ? `${g.isHome ? 'vs' : 'at'} ${TEAM_BY_CODE[g.opp].city} ${TEAM_BY_CODE[g.opp].name}`
    : 'Bye week';
  const when = state.phase === 'offseason'
    ? `${state.year} season complete`
    : `${state.phase === 'preseason' ? 'Preseason' : 'Regular season'} week ${state.week}, ${state.day === GAME_DAY ? 'game day' : `day ${state.day}`} — ${next}`;

  $('#franchise-head').innerHTML = `
    <div class="fh-badge">${t.code}</div>
    <div class="fh-main">
      <h2>${esc(t.city)} ${esc(t.name)}</h2>
      <p>${esc(t.hc)} · ${esc(t.stadium)} · ${t.conf} ${t.div} · ${esc(when)}</p>
    </div>
    <div class="fh-stats">
      <div class="fh-stat"><b>${recordText(rec)}</b><span>Record</span></div>
      <div class="fh-stat"><b>${s.off.toFixed(0)}/${s.def.toFixed(0)}</b><span>Off / Def</span></div>
      <div class="fh-stat"><b style="color:${space < 0 ? 'var(--bad)' : 'inherit'}">$${space}M</b><span>Cap space</span></div>
      <div class="fh-stat"><b>${inj}</b><span>Unavailable</span></div>
    </div>`;
}

/* ------------------------------------------------------------- dashboard */

function renderOffseason() {
  const st = computeStandings();
  const rec = st[state.teamId];
  const seeds = conferenceSeeds(st, myTeam().conf);
  const seedIdx = seeds.findIndex((s) => s.team.code === state.teamId);
  const leaders = state.roster.slice()
    .sort((a, b) => (b.season.pass + b.season.rush + b.season.rec) - (a.season.pass + a.season.rush + a.season.rec))
    .slice(0, 6);

  return `
    <div class="panel">
      <h3>${state.year} season complete</h3>
      <p class="panel-sub">${teamName(state.teamId)} finished ${recordText(rec)} — ${rec.pf} points for, ${rec.pa} against.
        ${seedIdx >= 0 ? `In the field as the ${seedIdx + 1} seed.` : 'Out of the playoff field.'}</p>
      <div class="two-col">
        <div>
          <h4>Your leaders</h4>
          <ul class="list">${leaders.map((p) => `<li><span>${p.pos} ${esc(p.name)}</span><span class="hint">${p.season.pass ? `${p.season.pass} pass ` : ''}${p.season.rush ? `${p.season.rush} rush ` : ''}${p.season.rec ? `${p.season.rec} rec ` : ''}${p.season.td} TD · ${p.season.sacks} sacks</span></li>`).join('')}</ul>
        </div>
        <div>
          <h4>${myTeam().conf} field</h4>
          <ul class="list">${seeds.map((s, i) => `<li><span>${i + 1}. ${esc(s.team.city)} ${esc(s.team.name)}</span><span class="hint">${recordText(s.rec)}</span></li>`).join('')}</ul>
        </div>
      </div>
      <div class="inline-actions" style="margin-top:1rem">
        <button class="primary-btn big" data-action="next-season" type="button">Open ${state.year + 1} camp</button>
        <button class="ghost-btn" data-action="generate-media" type="button">Season wrap from the media</button>
      </div>
      <p class="hint" style="margin-top:.6rem">Rolling the calendar ages everyone a year, moves ratings, re-signs expiring deals and builds a brand new schedule.</p>
    </div>`;
}

function renderDashboard() {
  if (state.phase === 'offseason') return renderOffseason();
  const t = myTeam();
  const rec = myRecord();
  const s = teamStrength(state.roster);
  const g = currentGame();
  const top = state.roster.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 6);
  const injured = state.roster.filter((p) => !isAvailable(p));
  const recentMedia = state.media.slice(0, 4);
  const lastResults = state.results.filter((r) => r.home === state.teamId || r.away === state.teamId).slice(-4).reverse();

  return `
    <div class="stat-row">
      <div class="stat-card"><span>Record</span><b>${recordText(rec)}</b><small>${state.phase === 'preseason' ? 'Preseason games do not count' : `${rec.pf} for / ${rec.pa} against`}</small></div>
      <div class="stat-card"><span>Next up</span><b style="font-size:1rem">${g ? `${g.isHome ? 'vs' : 'at'} ${g.opp}` : 'BYE'}</b><small>${g ? esc(teamName(g.opp)) : 'No game this week'}</small></div>
      <div class="stat-card"><span>Team rating</span><b>${s.overall.toFixed(1)}</b><small>OFF ${s.off.toFixed(1)} · DEF ${s.def.toFixed(1)}</small></div>
      <div class="stat-card"><span>Cap space</span><b>$${Math.round((SALARY_CAP - totalCapUsed()) * 10) / 10}M</b><small>$${totalCapUsed()}M used${state.deadCap ? ` · $${state.deadCap}M dead` : ''}</small></div>
    </div>

    <div class="split-2">
      <div>
        <div class="panel">
          <h3>This week <span class="hint">${state.phase === 'preseason' ? 'Preseason' : 'Regular season'} · Week ${state.week} · ${state.day === GAME_DAY ? 'Game day' : `Day ${state.day} of ${GAME_DAY}`}</span></h3>
          ${weekBar()}
          <div class="inline-actions" style="margin-top:.8rem">
            ${state.day < GAME_DAY ? '<button class="primary-btn" data-action="goto-practice" type="button">Run today\'s practice</button>' : ''}
            ${state.day === GAME_DAY && g && !myGamePlayed() ? '<button class="primary-btn" data-action="goto-gameday" type="button">Go to game day</button>' : ''}
            ${state.day === GAME_DAY && (!g || myGamePlayed()) ? '<button class="primary-btn" data-action="advance-week" type="button">Advance to next week</button>' : ''}
            <button class="ghost-btn" data-action="advance-day" type="button">Advance a day</button>
            <button class="ghost-btn" data-action="generate-media" type="button">Generate league media</button>
          </div>
        </div>

        <div class="panel">
          <h3>Recent results</h3>
          ${lastResults.length ? `<ul class="list">${lastResults.map((r) => {
    const mine = r.home === state.teamId;
    const me = mine ? r.homeScore : r.awayScore;
    const them = mine ? r.awayScore : r.homeScore;
    const opp = mine ? r.away : r.home;
    const tagCls = me > them ? 'ok' : me < them ? 'out' : '';
    return `<li><span>${r.phase === 'preseason' ? 'PRE' : 'WK'} ${r.week} · ${mine ? 'vs' : 'at'} ${esc(teamName(opp))}</span><span class="tag ${tagCls}">${me > them ? 'W' : me < them ? 'L' : 'T'} ${me}-${them}</span></li>`;
  }).join('')}</ul>` : '<p class="empty">No games played yet.</p>'}
        </div>

        <div class="panel">
          <h3>Latest from the media <button class="mini-btn" data-action="tab-media" type="button">Open media desk</button></h3>
          ${recentMedia.length ? `<div class="media-feed">${recentMedia.map(mediaCard).join('')}</div>` : '<p class="empty">Nothing written about you yet. Issue a statement and see who bites.</p>'}
        </div>
      </div>

      <div>
        <div class="panel">
          <h3>Best on the roster</h3>
          <ul class="list">${top.map((p) => `<li><span>${p.pos} ${esc(p.name)}</span><span class="ovr ${ovrClass(p.ovr)}">${p.ovr}</span></li>`).join('')}</ul>
        </div>
        <div class="panel">
          <h3>Injury report <span class="hint">${injured.length} out</span></h3>
          ${injured.length ? `<ul class="list">${injured.slice(0, 10).map((p) => {
    const st = statusOf(p);
    return `<li><span>${p.pos} ${esc(p.name)}<br><small>${esc(p.injury?.type || 'Unavailable')}</small></span><span class="tag ${st.cls}">${st.label}</span></li>`;
  }).join('')}</ul>` : '<p class="empty">Nobody on the report. Enjoy it.</p>'}
        </div>
        <div class="panel">
          <h3>Division</h3>
          ${divisionTable(t.conf, t.div)}
        </div>
      </div>
    </div>`;
}

function weekBar() {
  const days = [];
  for (let d = 1; d <= GAME_DAY; d += 1) {
    const done = d < state.day;
    const isNow = d === state.day;
    const prac = state.practices.find((p) => p.phase === state.phase && p.week === state.week && p.day === d);
    const label = d === GAME_DAY ? 'Game' : `Day ${d}`;
    const sub = prac ? prac.typeLabel : d === GAME_DAY ? 'Kickoff' : '—';
    days.push(`<div class="chip ${isNow ? 'active' : ''}" style="${done ? 'opacity:.55' : ''}">${label}<small>${esc(sub)}</small></div>`);
  }
  return `<div class="chips">${days.join('')}</div>`;
}

function divisionTable(conf, div) {
  const rows = sortedDivision(computeStandings(), conf, div);
  return `<table>
    <thead><tr><th>${conf} ${div}</th><th class="num">W</th><th class="num">L</th><th class="num">T</th><th class="num">PF</th><th class="num">PA</th></tr></thead>
    <tbody>${rows.map(({ team, rec }) => `
      <tr class="${team.code === state.teamId ? 'me' : ''}">
        <td>${esc(team.city)} ${esc(team.name)}</td>
        <td class="num">${rec.w}</td><td class="num">${rec.l}</td><td class="num">${rec.t}</td>
        <td class="num">${rec.pf}</td><td class="num">${rec.pa}</td>
      </tr>`).join('')}</tbody></table>`;
}

/* ----------------------------------------------------------------- media */

function mediaCard(m) {
  const cls = m.kind === 'statement' ? 'statement' : m.kind === 'press' ? 'press' : m.kind === 'league' ? 'league' : 'wire';
  const src = m.kind === 'statement'
    ? `${esc(m.author)}${m.role ? ` · ${esc(m.role)}` : ''}`
    : esc(m.outlet || 'League Media');
  return `
    <article class="media-item ${cls}">
      <div class="media-head">
        <span class="media-src">${src}</span>
        <span class="media-when">${esc(m.ts)}${m.source === 'ai' ? ' · league media' : m.source === 'local' ? ' · wire' : ''}</span>
      </div>
      ${m.headline ? `<h4>${esc(m.headline)}</h4>` : ''}
      <p class="${m.kind === 'statement' ? 'media-quote' : ''}">${esc(m.body)}</p>
    </article>`;
}

function renderMedia() {
  const roles = MEDIA_ROLES.map((r) => `<option value="${r.id}">${esc(r.label)}</option>`).join('');
  const outlets = OUTLETS.map((o) => `<option value="${o.id}">${esc(o.label)}</option>`).join('');
  const filtered = state.media.filter((m) => ui.mediaFilter === 'all' || m.kind === ui.mediaFilter);
  const filters = [['all', 'Everything'], ['statement', 'Statements'], ['press', 'Press'], ['league', 'League media'], ['wire', 'Wire']];

  return `
    <div class="split-2">
      <div>
        <div class="panel">
          <h3>The feed <span class="hint">${state.media.length} items</span></h3>
          <div class="filters">
            ${filters.map(([id, label]) => `<button class="mini-btn ${ui.mediaFilter === id ? 'active' : ''}" data-action="media-filter" data-filter="${id}" type="button">${label}</button>`).join('')}
          </div>
          ${filtered.length ? `<div class="media-feed">${filtered.map(mediaCard).join('')}</div>` : '<p class="empty">Nothing here yet.</p>'}
        </div>
      </div>
      <div>
        <div class="panel">
          <h3>Issue a statement</h3>
          <p class="panel-sub">Speak as anybody in the building. It goes on the record.</p>
          <div class="field">
            <label for="st-role">Speaking as</label>
            <select id="st-role">${roles}</select>
          </div>
          <div class="field">
            <label for="st-author">Attributed to</label>
            <input type="text" id="st-author" placeholder="Name on the quote" value="${esc(defaultAuthorFor('gm'))}" />
          </div>
          <div class="field">
            <label for="st-text">Statement</label>
            <textarea id="st-text" placeholder="We are aware of the report. We have no intention of trading him."></textarea>
          </div>
          <div class="inline-actions">
            <button class="primary-btn" data-action="post-statement" type="button">Issue statement</button>
            <button class="ghost-btn" data-action="post-statement-react" type="button">Issue &amp; let the league react</button>
          </div>
        </div>

        <div class="panel">
          <h3>Post as the press</h3>
          <p class="panel-sub">Write the ESPN hit, the beat report, the radio take.</p>
          <div class="field-row">
            <div class="field">
              <label for="pr-outlet">Outlet</label>
              <select id="pr-outlet">${outlets}</select>
            </div>
            <div class="field">
              <label for="pr-byline">Byline</label>
              <input type="text" id="pr-byline" placeholder="Reporter name (optional)" />
            </div>
          </div>
          <div class="field">
            <label for="pr-headline">Headline</label>
            <input type="text" id="pr-headline" style="width:100%" placeholder="Sources: front office fielding calls on veteran corner" />
          </div>
          <div class="field">
            <label for="pr-body">Story</label>
            <textarea id="pr-body" placeholder="The report, the quote, the reaction…"></textarea>
          </div>
          <button class="primary-btn" data-action="post-press" type="button">Publish</button>
        </div>

        <div class="panel">
          <h3>League media</h3>
          <p class="panel-sub">The rest of the league writes about what you have done this week — results, practice reports, injuries, whatever you said on the record.</p>
          <label style="display:flex;gap:.5rem;align-items:center;margin-bottom:.6rem">
            <input type="checkbox" id="auto-media" ${state.settings.autoMedia ? 'checked' : ''} />
            Auto-generate after games and practices
          </label>
          <button class="primary-btn" data-action="generate-media" type="button">Generate league media now</button>
          <p class="hint" id="media-status" style="margin-top:.6rem">${state.aiMedia?.note ? esc(state.aiMedia.note) : ''}</p>
        </div>
      </div>
    </div>`;
}

function defaultAuthorFor(roleId) {
  const t = myTeam();
  if (roleId === 'hc') return t.hc;
  if (roleId === 'gm') return `${t.name} General Manager`;
  if (roleId === 'owner') return `${t.name} Ownership`;
  if (roleId === 'pr') return `${t.city} ${t.name}`;
  if (roleId === 'captain' || roleId === 'player') {
    const best = state.roster.slice().sort((a, b) => b.ovr - a.ovr)[0];
    return best ? best.name : 'Team Captain';
  }
  return '';
}

function postStatement(withReaction) {
  const roleId = $('#st-role').value;
  const role = MEDIA_ROLES.find((r) => r.id === roleId);
  const author = $('#st-author').value.trim() || defaultAuthorFor(roleId) || 'Unnamed';
  const text = $('#st-text').value.trim();
  if (!text) { toast('Write the statement first.'); return; }
  pushMedia({ kind: 'statement', author, role: role?.label || 'Statement', body: text, headline: '' });
  save();
  renderFranchise();
  toast('Statement is on the record.');
  if (withReaction) generateMedia({ trigger: 'statement', statement: { author, role: role?.label, text } });
}

function postPress() {
  const outletId = $('#pr-outlet').value;
  const outlet = OUTLETS.find((o) => o.id === outletId);
  const byline = $('#pr-byline').value.trim();
  const headline = $('#pr-headline').value.trim();
  const body = $('#pr-body').value.trim();
  if (!headline && !body) { toast('Needs a headline or a story.'); return; }
  pushMedia({
    kind: 'press',
    outlet: byline ? `${outlet.label} — ${byline}` : outlet.label,
    headline,
    body,
  });
  save();
  renderFranchise();
  toast('Published.');
}

/* ------------------------------------------------------ league media (AI) */

function mediaContext(extra = {}) {
  const t = myTeam();
  const rec = myRecord();
  const last = state.results.filter((r) => r.home === state.teamId || r.away === state.teamId).slice(-1)[0];
  const lastPractice = state.practices.slice(-1)[0];
  const injuries = state.roster.filter((p) => !isAvailable(p)).slice(0, 8)
    .map((p) => ({ name: p.name, pos: p.pos, type: p.injury?.type || 'unavailable', weeksOut: p.injury?.weeksOut || 0 }));
  const stars = state.roster.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 6)
    .map((p) => `${p.pos} ${p.name} (${p.ovr})`);
  const statements = state.media.filter((m) => m.kind === 'statement').slice(0, 4)
    .map((m) => ({ author: m.author, role: m.role, text: m.body, when: m.ts }));
  const press = state.media.filter((m) => m.kind === 'press').slice(0, 3)
    .map((m) => ({ outlet: m.outlet, headline: m.headline, body: m.body.slice(0, 300) }));

  let lastResult = null;
  if (last) {
    const mine = last.home === state.teamId;
    lastResult = {
      week: last.week,
      phase: last.phase,
      opponent: teamName(mine ? last.away : last.home),
      teamScore: mine ? last.homeScore : last.awayScore,
      oppScore: mine ? last.awayScore : last.homeScore,
      won: (mine ? last.homeScore : last.awayScore) > (mine ? last.awayScore : last.homeScore),
      plays: (last.plays || []).slice(0, 8),
      topPerformers: (last.box?.offense || []).slice(0, 4).map((l) => `${l.pos} ${l.name}: ${l.line}`),
    };
  }

  return {
    team: `${t.city} ${t.name}`,
    teamName: t.name,
    headCoach: t.hc,
    conference: `${t.conf} ${t.div}`,
    phase: state.phase,
    week: state.week,
    day: state.day,
    record: recordText(rec),
    stars,
    lastResult,
    practice: lastPractice ? { type: lastPractice.typeLabel, notes: lastPractice.log?.slice(0, 5) } : null,
    injuries,
    statements,
    press,
    ...extra,
  };
}

async function generateMedia(extra = {}) {
  const statusEl = $('#media-status');
  if (statusEl) statusEl.innerHTML = '<span class="spinner"></span> The league is writing…';
  const context = mediaContext(extra);
  let items = null;
  let source = 'local';
  let note = '';

  try {
    const res = await fetch('/api/nfl/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context }),
    });
    if (res.ok) {
      const data = await res.json();
      items = sanitizeMediaItems(data.items);
      source = 'ai';
      note = `League media written by ${data.model || 'the league model'}.`;
    } else {
      const data = await res.json().catch(() => ({}));
      note = data.error === 'no_api_key'
        ? 'No API key on the server — using the built-in league writer.'
        : 'League model unavailable — using the built-in league writer.';
    }
  } catch (err) {
    note = 'Offline — using the built-in league writer.';
  }

  if (!items || !items.length) {
    const ctx = mediaContext(extra);
    items = localMedia({
      teamName: ctx.teamName,
      week: ctx.week,
      opp: ctx.lastResult?.opponent,
      teamScore: ctx.lastResult?.teamScore,
      oppScore: ctx.lastResult?.oppScore,
      star: ctx.stars[0]?.split(' ').slice(1).join(' '),
      lastResult: ctx.lastResult,
      practice: ctx.practice,
      injuries: ctx.injuries,
    });
    source = 'local';
  }

  // Reversed so the first thing written lands at the top of the feed.
  items.slice().reverse().forEach((item) => pushMedia({
    kind: 'league',
    outlet: item.outlet,
    headline: item.headline,
    body: item.body,
    source,
  }));
  state.aiMedia = { available: source === 'ai', note };
  save();
  renderFranchise();
}

/* --------------------------------------------------------- team settings */

function sortRoster(list) {
  const s = ui.rosterSort;
  const copy = list.slice();
  if (s === 'ovr') return copy.sort((a, b) => b.ovr - a.ovr);
  if (s === 'age') return copy.sort((a, b) => a.age - b.age);
  if (s === 'apy') return copy.sort((a, b) => b.contract.apy - a.contract.apy);
  if (s === 'name') return copy.sort((a, b) => a.name.localeCompare(b.name));
  return copy.sort(byDepth);
}

function renderTeam() {
  const filter = ui.rosterFilter.toLowerCase();
  const list = sortRoster(state.roster.filter((p) => !filter
    || p.name.toLowerCase().includes(filter) || p.pos.toLowerCase().includes(filter)));
  const injured = state.roster.filter((p) => !isAvailable(p));
  const cap = totalCapUsed();
  const pct = clamp((cap / SALARY_CAP) * 100, 0, 100);

  const rows = list.map((p) => {
    const st = statusOf(p);
    return `<tr>
      <td class="num">${p.jersey}</td>
      <td>${p.pos}</td>
      <td><input class="cell-input" data-live-edit="name" data-id="${p.id}" value="${esc(p.name)}" /></td>
      <td class="num"><span class="ovr ${ovrClass(p.ovr)}">${p.ovr}</span></td>
      <td class="num">${p.age}</td>
      <td class="num">$${p.contract.apy}M</td>
      <td class="num">${p.contract.yearsLeft}y</td>
      <td class="num">${Math.round(p.sharpness)}</td>
      <td class="num">${Math.round(p.morale)}</td>
      <td><span class="tag ${st.cls}">${st.label}</span></td>
      <td class="inline-actions">
        <button class="mini-btn" data-action="player-card" data-id="${p.id}" type="button">Card</button>
        <button class="mini-btn" data-action="release-player" data-id="${p.id}" type="button">Release</button>
      </td>
    </tr>`;
  }).join('');

  return `
    <div class="stat-row">
      <div class="stat-card"><span>Roster</span><b>${state.roster.length}</b><small>${state.roster.filter((p) => isAvailable(p)).length} available</small></div>
      <div class="stat-card"><span>Cap used</span><b>$${cap}M</b><div class="bar ${cap > SALARY_CAP ? 'warn' : ''}"><i style="width:${pct}%"></i></div><small>of $${SALARY_CAP}M${state.deadCap ? ` · $${state.deadCap}M dead` : ''}</small></div>
      <div class="stat-card"><span>Draft picks</span><b>${state.picks.length}</b><small>${state.picks.filter((p) => p.round <= 2).length} in the first two rounds</small></div>
      <div class="stat-card"><span>Unavailable</span><b>${injured.length}</b><small>${state.roster.filter((p) => p.status === 'ir').length} on IR</small></div>
    </div>

    ${state.roster.length > 53 ? `<div class="notice warn">You are carrying ${state.roster.length} players. The limit is 53 — release ${state.roster.length - 53} before the next game or the league does it for you.</div>` : ''}
    ${totalCapUsed() > SALARY_CAP ? `<div class="notice bad">You are $${Math.round((totalCapUsed() - SALARY_CAP) * 10) / 10}M over the cap. Restructure a deal or move somebody.</div>` : ''}

    <div class="panel">
      <h3>Roster
        <span class="inline-actions">
          <button class="mini-btn" data-action="open-trade" type="button">Trade machine</button>
          <button class="mini-btn" data-action="open-fa" type="button">Free agents</button>
          <button class="mini-btn" data-action="open-contracts" type="button">Contracts</button>
          <button class="mini-btn" data-action="open-depth" type="button">Depth chart</button>
        </span>
      </h3>
      <div class="roster-tools">
        <input type="search" id="team-roster-filter" placeholder="Filter…" value="${esc(ui.rosterFilter)}" />
        <select id="roster-sort">
          <option value="depth"${ui.rosterSort === 'depth' ? ' selected' : ''}>Depth chart order</option>
          <option value="ovr"${ui.rosterSort === 'ovr' ? ' selected' : ''}>Overall</option>
          <option value="apy"${ui.rosterSort === 'apy' ? ' selected' : ''}>Salary</option>
          <option value="age"${ui.rosterSort === 'age' ? ' selected' : ''}>Age</option>
          <option value="name"${ui.rosterSort === 'name' ? ' selected' : ''}>Name</option>
        </select>
        <span class="hint">Names are editable right here.</span>
      </div>
      <div class="table-wrap scroll-list">
        <table>
          <thead><tr><th class="num">#</th><th>Pos</th><th>Player</th><th class="num">OVR</th><th class="num">Age</th><th class="num">APY</th><th class="num">Yrs</th><th class="num">Sharp</th><th class="num">Morale</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>

    <div class="two-col">
      <div class="panel">
        <h3>Injury list</h3>
        ${injured.length ? `<table>
          <thead><tr><th>Player</th><th>Injury</th><th class="num">Out</th><th>When</th><th></th></tr></thead>
          <tbody>${injured.map((p) => `<tr>
            <td>${p.pos} ${esc(p.name)}</td>
            <td>${esc(p.injury?.type || '—')}</td>
            <td class="num">${p.injury?.weeksOut ?? 0}w</td>
            <td>${esc(p.injury?.when || '')}</td>
            <td><button class="mini-btn" data-action="clear-injury" data-id="${p.id}" type="button">Clear</button></td>
          </tr>`).join('')}</tbody></table>` : '<p class="empty">Clean bill of health.</p>'}
      </div>
      <div class="panel">
        <h3>The calendar</h3>
        ${state.phase === 'offseason' ? `
          <p class="panel-sub">${state.year} is in the books. Roster moves still work — the practice field opens with next year's camp.</p>
          <button class="primary-btn" data-action="next-season" type="button">Open ${state.year + 1} camp</button>
        ` : `
          <p class="panel-sub">${state.phase === 'preseason' ? 'Preseason' : 'Regular season'} · week ${state.week} · ${state.day === GAME_DAY ? 'game day' : `day ${state.day}`}</p>
          ${weekBar()}
          <div class="inline-actions" style="margin-top:.6rem">
            <button class="primary-btn" data-action="goto-practice" type="button">Simulate practice</button>
            <button class="ghost-btn" data-action="advance-day" type="button">Advance a day</button>
            ${state.day === GAME_DAY ? '<button class="ghost-btn" data-action="goto-gameday" type="button">Game day</button>' : ''}
          </div>
        `}
        <h3 style="margin-top:1rem">Transactions</h3>
        ${state.transactions.length ? `<ul class="list">${state.transactions.slice(0, 8).map((t) => `<li><span>${esc(t.text)}</span><span class="media-when">${esc(t.ts)}</span></li>`).join('')}</ul>` : '<p class="empty">No moves yet.</p>'}
      </div>
    </div>`;
}

function playerCard(id) {
  const p = playerById(id);
  if (!p) return;
  const st = statusOf(p);
  const value = tradeValue(p);
  modal(`${p.pos} ${p.name}`, `
    <div class="stat-row">
      <div class="stat-card"><span>Overall</span><b>${p.ovr}</b><small>${p.pos} · #${p.jersey}</small></div>
      <div class="stat-card"><span>Age</span><b>${p.age}</b><small>${p.exp} yrs exp · ${esc(p.college || '')}</small></div>
      <div class="stat-card"><span>Contract</span><b>$${p.contract.apy}M</b><small>${p.contract.yearsLeft} of ${p.contract.years} yrs · $${p.contract.guaranteed}M gtd</small></div>
      <div class="stat-card"><span>Trade value</span><b>${value}</b><small>${st.label}</small></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Name</label><input type="text" id="card-name" value="${esc(p.name)}" /></div>
      <div class="field"><label>Overall</label><input type="number" id="card-ovr" min="50" max="99" value="${p.ovr}" /></div>
      <div class="field"><label>Jersey</label><input type="number" id="card-jersey" min="0" max="99" value="${p.jersey}" /></div>
    </div>
    <p class="hint">Season: ${p.season.gp} games · ${p.season.pass} pass yds · ${p.season.rush} rush yds · ${p.season.rec} rec yds · ${p.season.td} TD · ${p.season.tackles} tkl · ${p.season.sacks} sacks · ${p.season.ints} INT</p>
    <p class="hint">Sharpness ${Math.round(p.sharpness)} · Fatigue ${Math.round(p.fatigue)} · Morale ${Math.round(p.morale)}</p>
  `, `<button class="primary-btn" data-action="save-card" data-id="${p.id}" type="button">Save changes</button>
      <button class="ghost-btn" data-action="extend-player" data-id="${p.id}" type="button">Extend</button>
      <button class="ghost-btn" data-action="restructure-player" data-id="${p.id}" type="button">Restructure</button>`);
}

function releasePlayer(id) {
  const p = playerById(id);
  if (!p) return;
  const dead = Math.round(p.contract.guaranteed * 0.5 * 10) / 10;
  state.roster = state.roster.filter((x) => x.id !== id);
  state.deadCap = Math.round(((state.deadCap || 0) + dead) * 10) / 10;
  state.freeAgents.unshift(p);
  logTransaction(`Released ${p.pos} ${p.name} — $${dead}M dead cap.`);
  pushMedia({ kind: 'wire', outlet: 'Transaction Wire', headline: `${myTeam().name} release ${p.pos} ${p.name}`, body: `The move leaves $${dead}M in dead money on the books.` });
  save();
  renderFranchise();
}

function signFreeAgent(id) {
  const p = state.freeAgents.find((x) => x.id === id);
  if (!p) return;
  state.freeAgents = state.freeAgents.filter((x) => x.id !== id);
  p.team = state.teamId;
  state.roster.push(p);
  state.roster.sort(byDepth);
  logTransaction(`Signed ${p.pos} ${p.name} (${p.ovr} OVR) for $${p.contract.apy}M per year.`);
  pushMedia({ kind: 'wire', outlet: 'Transaction Wire', headline: `${myTeam().name} sign ${p.pos} ${p.name}`, body: `Terms: ${p.contract.years} years, $${p.contract.apy}M per year.` });
  save();
  closeModal();
  renderFranchise();
}

function logTransaction(text) {
  state.transactions.unshift({ text, ts: stamp() });
  state.transactions = state.transactions.slice(0, 60);
}

function openFreeAgents() {
  const rows = state.freeAgents.slice(0, 30).map((p) => `<tr>
    <td>${p.pos}</td><td>${esc(p.name)}</td>
    <td class="num"><span class="ovr ${ovrClass(p.ovr)}">${p.ovr}</span></td>
    <td class="num">${p.age}</td><td class="num">$${p.contract.apy}M</td>
    <td><button class="mini-btn" data-action="sign-fa" data-id="${p.id}" type="button">Sign</button></td>
  </tr>`).join('');
  modal('Free agents', `
    <p class="hint">Cap space: $${Math.round((SALARY_CAP - totalCapUsed()) * 10) / 10}M</p>
    <div class="table-wrap scroll-list"><table>
      <thead><tr><th>Pos</th><th>Player</th><th class="num">OVR</th><th class="num">Age</th><th class="num">Ask</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`);
}

function openContracts() {
  const list = state.roster.slice().sort((a, b) => b.contract.apy - a.contract.apy);
  const rows = list.map((p) => `<tr>
    <td>${p.pos} ${esc(p.name)}</td>
    <td class="num">${p.ovr}</td>
    <td class="num">$${p.contract.apy}M</td>
    <td class="num">${p.contract.yearsLeft}/${p.contract.years}</td>
    <td class="num">$${p.contract.guaranteed}M</td>
    <td class="inline-actions">
      <button class="mini-btn" data-action="extend-player" data-id="${p.id}" type="button">Extend</button>
      <button class="mini-btn" data-action="restructure-player" data-id="${p.id}" type="button">Restructure</button>
    </td>
  </tr>`).join('');
  modal('Contracts', `
    <p class="hint">Cap $${SALARY_CAP}M · used $${totalCapUsed()}M · space $${Math.round((SALARY_CAP - totalCapUsed()) * 10) / 10}M${state.deadCap ? ` · dead $${state.deadCap}M` : ''}</p>
    <div class="table-wrap scroll-list"><table>
      <thead><tr><th>Player</th><th class="num">OVR</th><th class="num">APY</th><th class="num">Yrs</th><th class="num">Gtd</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`);
}

function extendPlayer(id) {
  const p = playerById(id);
  if (!p) return;
  p.contract.years += 2;
  p.contract.yearsLeft += 2;
  p.contract.apy = Math.round(p.contract.apy * 1.12 * 10) / 10;
  p.contract.guaranteed = Math.round(p.contract.guaranteed * 1.5 * 10) / 10;
  p.morale = clamp(p.morale + 8, 0, 100);
  logTransaction(`Extended ${p.pos} ${p.name} — 2 more years at $${p.contract.apy}M.`);
  save();
  closeModal();
  renderFranchise();
  toast(`${p.name} signed the extension.`);
}

function restructurePlayer(id) {
  const p = playerById(id);
  if (!p) return;
  const saved = Math.round(p.contract.apy * 0.25 * 10) / 10;
  p.contract.apy = Math.round((p.contract.apy - saved) * 10) / 10;
  p.contract.years += 1;
  p.contract.yearsLeft += 1;
  logTransaction(`Restructured ${p.pos} ${p.name} — $${saved}M of cap relief this year.`);
  save();
  closeModal();
  renderFranchise();
  toast(`Freed $${saved}M.`);
}

function openDepthChart() {
  const chart = depthChart(state.roster);
  const blocks = POSITION_ORDER.map((pos) => {
    const list = chart[pos] || [];
    if (!list.length) return '';
    return `<div class="div-block"><h4>${pos}</h4><ul class="list">${list.map((p, i) => {
      const st = statusOf(p);
      return `<li><span>${i + 1}. ${esc(p.name)}</span><span><span class="ovr ${ovrClass(p.ovr)}">${p.ovr}</span> <span class="tag ${st.cls}">${st.label}</span></span></li>`;
    }).join('')}</ul></div>`;
  }).join('');
  modal('Depth chart', `<div class="scroll-list">${blocks}</div>`);
}

/* ---------------------------------------------------------------- trades */

function openTrade() {
  ui.tradePartner = ui.tradePartner || TEAMS.find((t) => t.code !== state.teamId).code;
  ui.tradeGive = [];
  ui.tradeGet = [];
  renderTradeModal();
}

function aiPicksFor(code) {
  if (!state.aiPicks[code]) state.aiPicks[code] = defaultPicks(state.year);
  return state.aiPicks[code];
}

function renderTradeModal() {
  const partner = ui.tradePartner;
  const partnerRoster = rosterFor(state, partner);
  const options = TEAMS.filter((t) => t.code !== state.teamId)
    .map((t) => `<option value="${t.code}"${t.code === partner ? ' selected' : ''}>${esc(t.city)} ${esc(t.name)}</option>`).join('');

  const assetRow = (asset, side) => {
    const checked = (side === 'give' ? ui.tradeGive : ui.tradeGet).includes(asset.key) ? ' checked' : '';
    return `<li>
      <label style="display:flex;gap:.5rem;align-items:center;margin:0;color:inherit">
        <input type="checkbox" data-trade="${side}" data-key="${esc(asset.key)}"${checked} />
        <span>${esc(asset.label)}</span>
      </label>
      <span class="hint">${asset.value}</span>
    </li>`;
  };

  const myAssets = [
    ...state.roster.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 30)
      .map((p) => ({ key: `p:${p.id}`, label: `${p.pos} ${p.name} (${p.ovr}, $${p.contract.apy}M)`, value: tradeValue(p) })),
    ...state.picks.map((pk) => ({ key: `k:${pk.id}`, label: `${pickLabel(pk)} round pick`, value: PICK_VALUE[pk.round] })),
  ];
  const theirAssets = [
    ...partnerRoster.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 30)
      .map((p) => ({ key: `p:${p.id}`, label: `${p.pos} ${p.name} (${p.ovr}, $${p.contract.apy}M)`, value: tradeValue(p) })),
    ...aiPicksFor(partner).map((pk) => ({ key: `k:${pk.id}`, label: `${pickLabel(pk)} round pick`, value: PICK_VALUE[pk.round] })),
  ];

  const giving = myAssets.filter((a) => ui.tradeGive.includes(a.key));
  const getting = theirAssets.filter((a) => ui.tradeGet.includes(a.key));
  const evalResult = evaluateTrade({ giving, getting });

  modal('Trade machine', `
    <div class="field">
      <label for="trade-partner">Trade partner</label>
      <select id="trade-partner">${options}</select>
    </div>
    <div class="two-col">
      <div>
        <h4>You send</h4>
        <ul class="list scroll-list" style="max-height:260px">${myAssets.map((a) => assetRow(a, 'give')).join('')}</ul>
      </div>
      <div>
        <h4>You get</h4>
        <ul class="list scroll-list" style="max-height:260px">${theirAssets.map((a) => assetRow(a, 'get')).join('')}</ul>
      </div>
    </div>
    <div class="notice ${evalResult.accepted ? 'info' : 'warn'}" style="margin-top:.8rem">
      <b>${esc(evalResult.verdict)}</b><br>
      You send ${evalResult.give} in value, you get ${evalResult.get}.
    </div>
  `, `<button class="primary-btn" data-action="execute-trade" type="button"${evalResult.accepted && (giving.length || getting.length) ? '' : ' disabled'}>Make the trade</button>`);
}

function executeTrade() {
  const partner = ui.tradePartner;
  const partnerRoster = rosterFor(state, partner);
  const movedOut = [];
  const movedIn = [];

  ui.tradeGive.forEach((key) => {
    const [kind, id] = key.split(':');
    if (kind === 'p') {
      const p = playerById(id);
      if (!p) return;
      state.roster = state.roster.filter((x) => x.id !== id);
      p.team = partner;
      partnerRoster.push(p);
      movedOut.push(`${p.pos} ${p.name}`);
    } else {
      const pk = state.picks.find((x) => x.id === id);
      if (!pk) return;
      state.picks = state.picks.filter((x) => x.id !== id);
      aiPicksFor(partner).push(pk);
      movedOut.push(`${pickLabel(pk)} round pick`);
    }
  });

  ui.tradeGet.forEach((key) => {
    const [kind, id] = key.split(':');
    if (kind === 'p') {
      const p = partnerRoster.find((x) => x.id === id);
      if (!p) return;
      const idx = partnerRoster.findIndex((x) => x.id === id);
      partnerRoster.splice(idx, 1);
      p.team = state.teamId;
      state.roster.push(p);
      movedIn.push(`${p.pos} ${p.name}`);
    } else {
      const picks = aiPicksFor(partner);
      const pk = picks.find((x) => x.id === id);
      if (!pk) return;
      state.aiPicks[partner] = picks.filter((x) => x.id !== id);
      state.picks.push(pk);
      movedIn.push(`${pickLabel(pk)} round pick`);
    }
  });

  state.roster.sort(byDepth);
  const text = `Trade with ${teamName(partner)} — out: ${movedOut.join(', ') || 'nothing'}; in: ${movedIn.join(', ') || 'nothing'}.`;
  logTransaction(text);
  pushMedia({
    kind: 'wire',
    outlet: 'Transaction Wire',
    headline: `${myTeam().name} and ${TEAM_BY_CODE[partner].name} swap pieces`,
    body: text,
  });
  ui.tradeGive = [];
  ui.tradeGet = [];
  save();
  closeModal();
  renderFranchise();
  toast('Trade processed.');
}

/* -------------------------------------------------------------- practice */

function renderPractice() {
  if (state.phase === 'offseason') {
    return `<div class="panel">
      <h3>Nobody is in the building</h3>
      <p class="panel-sub">The season is over. Open next year's camp from the Dashboard and the practice field comes back.</p>
      <button class="primary-btn" data-action="next-season" type="button">Open ${state.year + 1} camp</button>
    </div>`;
  }
  const d = state.practiceDraft;
  const available = state.roster.filter(isAvailable);
  const playerOptions = (sel) => state.roster.map((p) => `<option value="${p.id}"${p.id === sel ? ' selected' : ''}>${p.pos} ${esc(p.name)}</option>`).join('');
  const injuryOptions = INJURY_TYPES.map((t) => `<option value="${esc(t.label)}">${esc(t.label)} (${t.min}-${t.max}w)</option>`).join('');
  const reasonOptions = ABSENCE_REASONS.map((r) => `<option value="${esc(r)}">${esc(r)}</option>`).join('');
  const weekPractices = state.practices.filter((p) => p.phase === state.phase && p.week === state.week);

  if (state.day === GAME_DAY) {
    return `<div class="panel">
      <h3>It is game day</h3>
      <p class="panel-sub">No practice on game day. Head to the Game Day tab to set the lineup and call the score.</p>
      <button class="primary-btn" data-action="goto-gameday" type="button">Go to game day</button>
    </div>${practiceHistory(weekPractices)}`;
  }

  return `
    <div class="split-2">
      <div>
        <div class="panel">
          <h3>Today's practice <span class="hint">${state.phase === 'preseason' ? 'Preseason' : 'Week'} ${state.week} · Day ${state.day}</span></h3>
          <p class="panel-sub">Pick what you actually did today. Everything else on this page is yours to fill in.</p>
          <div class="chips">
            ${PRACTICE_TYPES.map((t) => `<button class="chip ${d.typeId === t.id ? 'active' : ''}" data-action="set-practice-type" data-id="${t.id}" type="button">${esc(t.label)}<small>${esc(t.desc)}</small></button>`).join('')}
          </div>
          <div class="inline-actions">
            <button class="primary-btn" data-action="run-practice" type="button">Run practice &amp; advance the day</button>
            <button class="ghost-btn" data-action="roll-practice-injury" type="button">Roll a random injury</button>
          </div>
        </div>

        <div class="panel">
          <h3>Who got hurt at practice</h3>
          <div class="field-row">
            <div class="field"><label for="inj-player">Player</label><select id="inj-player">${playerOptions()}</select></div>
            <div class="field"><label for="inj-type">Injury</label><select id="inj-type">${injuryOptions}</select></div>
            <div class="field" style="flex:0 0 110px"><label for="inj-weeks">Weeks out</label><input type="number" id="inj-weeks" min="0" max="40" value="2" /></div>
            <button class="ghost-btn" data-action="add-practice-injury" type="button">Add</button>
          </div>
          ${d.injuries.length ? `<ul class="list">${d.injuries.map((i, idx) => {
    const p = playerById(i.playerId);
    return `<li><span>${p ? `${p.pos} ${esc(p.name)}` : 'Player'} — ${esc(i.type)}, ${i.weeksOut}w</span><button class="mini-btn" data-action="drop-practice-injury" data-idx="${idx}" type="button">Remove</button></li>`;
  }).join('')}</ul>` : '<p class="empty">Nobody hurt so far today.</p>'}
        </div>

        <div class="panel">
          <h3>Who did not show up</h3>
          <div class="field-row">
            <div class="field"><label for="abs-player">Player</label><select id="abs-player">${playerOptions()}</select></div>
            <div class="field"><label for="abs-reason">Reason</label><select id="abs-reason">${reasonOptions}</select></div>
            <button class="ghost-btn" data-action="add-absence" type="button">Add</button>
          </div>
          ${d.absences.length ? `<ul class="list">${d.absences.map((a, idx) => {
    const p = playerById(a.playerId);
    return `<li><span>${p ? `${p.pos} ${esc(p.name)}` : 'Player'} — ${esc(a.reason)}</span><button class="mini-btn" data-action="drop-absence" data-idx="${idx}" type="button">Remove</button></li>`;
  }).join('')}</ul>` : '<p class="empty">Full attendance.</p>'}
        </div>

        <div class="panel">
          <h3>Big plays at practice</h3>
          <p class="panel-sub">The rep everybody in the building is going to talk about.</p>
          <div class="field-row">
            <div class="field"><label for="bp-player">Player</label><select id="bp-player"><option value="">— nobody in particular —</option>${playerOptions()}</select></div>
            <div class="field" style="flex:0 0 140px">
              <label for="bp-tone">Kind</label>
              <select id="bp-tone"><option value="good">Highlight</option><option value="bad">Lowlight</option></select>
            </div>
          </div>
          <div class="field">
            <label for="bp-text">What happened</label>
            <input type="text" id="bp-text" style="width:100%" placeholder="Beat the starting corner deep on the first rep of team period for a 60-yard touchdown." />
          </div>
          <button class="ghost-btn" data-action="add-bigplay" type="button">Add to the practice report</button>
          ${d.bigPlays.length ? `<ul class="list" style="margin-top:.6rem">${d.bigPlays.map((b, idx) => `<li><span>${b.good ? '▲' : '▼'} ${esc(b.text)}</span><button class="mini-btn" data-action="drop-bigplay" data-idx="${idx}" type="button">Remove</button></li>`).join('')}</ul>` : ''}
        </div>
      </div>

      <div>
        <div class="panel">
          <h3>Available bodies <span class="hint">${available.length} of ${state.roster.length}</span></h3>
          <ul class="list">
            ${['QB', 'RB', 'WR', 'TE', 'EDGE', 'LB', 'CB', 'S'].map((pos) => {
    const n = available.filter((p) => p.pos === pos).length;
    const total = state.roster.filter((p) => p.pos === pos).length;
    return `<li><span>${pos}</span><span class="${n < total ? 'tag out' : 'tag ok'}">${n}/${total}</span></li>`;
  }).join('')}
          </ul>
        </div>
        <div class="panel">
          <h3>Freshest legs</h3>
          <ul class="list">${state.roster.filter(isAvailable).slice().sort((a, b) => (b.sharpness - b.fatigue) - (a.sharpness - a.fatigue)).slice(0, 6)
    .map((p) => `<li><span>${p.pos} ${esc(p.name)}</span><span class="hint">sharp ${Math.round(p.sharpness)} · fatigue ${Math.round(p.fatigue)}</span></li>`).join('')}</ul>
        </div>
        <div class="panel">
          <h3>Most tired</h3>
          <ul class="list">${state.roster.filter(isAvailable).slice().sort((a, b) => b.fatigue - a.fatigue).slice(0, 6)
    .map((p) => `<li><span>${p.pos} ${esc(p.name)}</span><span class="hint">fatigue ${Math.round(p.fatigue)}</span></li>`).join('')}</ul>
        </div>
      </div>
    </div>
    ${practiceHistory(weekPractices)}`;
}

function practiceHistory(list) {
  if (!list.length) return '';
  return `<div class="panel">
    <h3>This week's practices</h3>
    ${list.map((p) => `<div class="div-block">
      <h4>Day ${p.day} · ${esc(p.typeLabel)}</h4>
      ${p.log.length ? `<ul class="list">${p.log.map((l) => `<li><span>${esc(l)}</span></li>`).join('')}</ul>` : '<p class="hint">Quiet day. Nothing to report.</p>'}
    </div>`).join('')}
  </div>`;
}

function runPractice() {
  const d = state.practiceDraft;
  const type = PRACTICE_TYPES.find((t) => t.id === d.typeId);
  const { log } = applyPractice(state, d);
  const record = {
    phase: state.phase,
    week: state.week,
    day: state.day,
    typeId: d.typeId,
    typeLabel: type.label,
    log,
    injuries: d.injuries.length,
    absences: d.absences.length,
  };
  state.practices.push(record);
  pushMedia({
    kind: 'wire',
    outlet: 'Practice Report',
    headline: `${myTeam().name} — ${type.label}, day ${state.day}`,
    body: log.length ? log.join('\n') : `${type.desc} Nothing new to report.`,
  });
  state.practiceDraft = blankPracticeDraft();
  advanceDay(true);
  if (state.settings.autoMedia && (record.injuries || record.absences || log.length > 2)) {
    generateMedia({ trigger: 'practice' });
  } else {
    save();
    renderFranchise();
  }
}

function rollPracticeInjury() {
  const pool = state.roster.filter(isAvailable);
  if (!pool.length) return;
  const rng = makeRng(seedFrom(`roll-${state.week}-${state.day}-${state.practiceDraft.injuries.length}-${Date.now()}`));
  const p = pool[Math.floor(rng() * pool.length)];
  const inj = rollInjury(rng);
  state.practiceDraft.injuries.push({ playerId: p.id, type: inj.type, weeksOut: inj.weeksOut });
  save();
  renderFranchise();
  toast(`${p.name} — ${inj.type} (${inj.weeksOut}w)`);
}

/* -------------------------------------------------------------- game day */

function lineupFor(presetId, inactives) {
  const preset = GAMEPLAN_PRESETS.find((p) => p.id === presetId) || GAMEPLAN_PRESETS[0];
  const out = new Set(inactives);
  let pool = state.roster.filter((p) => isAvailable(p) && !out.has(p.id));
  if (preset.snaps === 'backups') {
    const chart = depthChart(pool);
    const startersSet = new Set(starters(pool).map((p) => p.id));
    pool = pool.filter((p) => !startersSet.has(p.id));
    if (pool.length < 22) pool = state.roster.filter((p) => isAvailable(p) && !out.has(p.id));
    void chart;
  } else if (preset.snaps === 'vets') {
    const vets = pool.filter((p) => p.exp >= 2);
    if (vets.length >= 30) pool = vets;
  } else if (preset.snaps === 'rested') {
    const fresh = pool.filter((p) => p.fatigue < 55);
    if (fresh.length >= 30) pool = fresh;
  }
  return pool;
}

function renderGameDay() {
  if (state.phase === 'offseason') return renderOffseason();
  const g = currentGame();
  if (!g) {
    return `<div class="panel">
      <h3>Bye week</h3>
      <p class="panel-sub">No game scheduled in ${state.phase === 'preseason' ? 'preseason' : 'week'} ${state.week}. Practice, make moves, or push the calendar forward.</p>
      <button class="primary-btn" data-action="advance-week" type="button">Advance to next week</button>
    </div>`;
  }

  const played = resultFor(state.phase, state.week, state.teamId);
  if (played) return renderGameRecap(played);

  const d = state.gameDraft;
  const opp = TEAM_BY_CODE[g.opp];
  const oppRoster = rosterFor(state, g.opp);
  const oppS = teamStrength(oppRoster);
  const myS = teamStrength(state.roster);
  const lineup = lineupFor(d.presetId, d.inactives);
  const inactiveList = state.roster.filter((p) => !isAvailable(p) || d.inactives.includes(p.id));
  const oppStars = oppRoster.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 5);

  if (state.day < GAME_DAY) {
    return `<div class="panel">
      <h3>Kickoff is on day ${GAME_DAY}</h3>
      <p class="panel-sub">It is day ${state.day} of the week. You can keep practicing, or jump straight to the game — the remaining days get logged as walkthroughs.</p>
      <div class="inline-actions">
        <button class="primary-btn" data-action="jump-to-gameday" type="button">Jump to game day</button>
        <button class="ghost-btn" data-action="goto-practice" type="button">Back to practice</button>
      </div>
    </div>`;
  }

  return `
    <div class="panel">
      <div class="matchup">
        <div class="matchup-side">
          <div class="team-chip" style="--tp:${myTeam().colors[0]};--ts:${myTeam().colors[1]}">${myTeam().code}</div>
          <b>${esc(teamName(state.teamId))}</b>
          <span>OFF ${myS.off.toFixed(0)} · DEF ${myS.def.toFixed(0)}</span>
        </div>
        <div class="matchup-vs">${g.isHome ? 'HOSTS' : 'AT'}</div>
        <div class="matchup-side">
          <div class="team-chip" style="--tp:${opp.colors[0]};--ts:${opp.colors[1]}">${opp.code}</div>
          <b>${esc(teamName(g.opp))}</b>
          <span>OFF ${oppS.off.toFixed(0)} · DEF ${oppS.def.toFixed(0)}</span>
        </div>
      </div>
      <p class="hint" style="text-align:center">${state.phase === 'preseason' ? 'Preseason' : 'Regular season'} · Week ${state.week} · ${esc(g.isHome ? myTeam().stadium : opp.stadium)} · Their best: ${oppStars.map((p) => `${p.pos} ${esc(p.name)}`).join(', ')}</p>
    </div>

    <div class="split-2">
      <div>
        <div class="panel">
          <h3>Who is playing</h3>
          <div class="chips">
            ${GAMEPLAN_PRESETS.map((p) => `<button class="chip ${d.presetId === p.id ? 'active' : ''}" data-action="set-preset" data-id="${p.id}" type="button">${esc(p.label)}</button>`).join('')}
          </div>
          <div class="field-row">
            <div class="field">
              <label for="off-scheme">Offensive plan</label>
              <select id="off-scheme">${OFFENSE_SCHEMES.map((s) => `<option value="${s.id}"${d.offScheme === s.id ? ' selected' : ''}>${esc(s.label)} — ${esc(s.desc)}</option>`).join('')}</select>
            </div>
            <div class="field">
              <label for="def-scheme">Defensive plan</label>
              <select id="def-scheme">${DEFENSE_SCHEMES.map((s) => `<option value="${s.id}"${d.defScheme === s.id ? ' selected' : ''}>${esc(s.label)} — ${esc(s.desc)}</option>`).join('')}</select>
            </div>
          </div>
          <p class="hint">${lineup.length} players active · ${inactiveList.length} inactive</p>
          <details>
            <summary class="hint" style="cursor:pointer">Set inactives manually</summary>
            <ul class="list scroll-list" style="max-height:240px;margin-top:.5rem">
              ${state.roster.map((p) => {
    const forced = !isAvailable(p);
    const checked = forced || d.inactives.includes(p.id);
    return `<li><label style="display:flex;gap:.5rem;align-items:center;margin:0;color:inherit">
              <input type="checkbox" data-inactive="${p.id}"${checked ? ' checked' : ''}${forced ? ' disabled' : ''} />
              <span>${p.pos} ${esc(p.name)} <span class="ovr ${ovrClass(p.ovr)}">${p.ovr}</span></span>
            </label><span class="hint">${forced ? esc(p.injury?.type || 'unavailable') : ''}</span></li>`;
  }).join('')}
            </ul>
          </details>
        </div>

        <div class="panel">
          <h3>The plays that decided it</h3>
          <p class="panel-sub">Write them the way you would call them on the broadcast.</p>
          <div class="field-row">
            <div class="field" style="flex:0 0 90px">
              <label for="play-q">Quarter</label>
              <select id="play-q"><option>1st</option><option>2nd</option><option>3rd</option><option selected>4th</option><option>OT</option></select>
            </div>
            <div class="field" style="flex:0 0 120px">
              <label for="play-clock">Clock</label>
              <input type="text" id="play-clock" placeholder="0:60" />
            </div>
            <div class="field" style="flex:0 0 130px">
              <label for="play-side">Unit</label>
              <select id="play-side"><option>Offense</option><option>Defense</option><option>Special Teams</option></select>
            </div>
            <div class="field" style="flex:0 0 130px">
              <label for="play-tone">Result</label>
              <select id="play-tone"><option value="good">Big play</option><option value="bad">Bad play</option><option value="turnover">Turnover</option><option value="score">Score</option><option value="penalty">Penalty</option></select>
            </div>
          </div>
          <div class="field">
            <label for="play-text">What happened</label>
            <textarea id="play-text" placeholder="60 seconds left in the game, Patrick Mahomes throws a 40-yard pass downfield and it is intercepted by Nate Wiggins for a pick six."></textarea>
          </div>
          <button class="ghost-btn" data-action="add-play" type="button">Add play</button>
          <div class="play-list">
            ${d.plays.map((p, idx) => `<div class="play-item ${p.tone === 'bad' || p.tone === 'penalty' ? 'bad' : 'good'}">
              <span class="clockcell">${esc(p.q)} ${esc(p.clock || '')}</span>
              <span>${esc(p.text)}<br><small>${esc(p.side)} · ${esc(p.tone)}</small></span>
              <button class="mini-btn" data-action="drop-play" data-idx="${idx}" type="button">×</button>
            </div>`).join('') || '<p class="empty">No plays logged yet.</p>'}
          </div>
        </div>
      </div>

      <div>
        <div class="panel">
          <h3>Final score</h3>
          <p class="panel-sub">You call it. The rest of the league gets simulated around your result.</p>
          <div class="score-inputs">
            <div style="text-align:center">
              <input type="number" id="my-score" min="0" max="99" value="${d.teamScore}" placeholder="0" />
              <div class="hint">${myTeam().code}</div>
            </div>
            <span class="matchup-vs">—</span>
            <div style="text-align:center">
              <input type="number" id="opp-score" min="0" max="99" value="${d.oppScore}" placeholder="0" />
              <div class="hint">${opp.code}</div>
            </div>
          </div>
          <div class="inline-actions" style="margin-top:.8rem;justify-content:center">
            <button class="ghost-btn" data-action="suggest-score" type="button">Suggest a score</button>
          </div>
        </div>

        <div class="panel">
          <h3>Injuries in the game</h3>
          <div class="field-row">
            <div class="field"><label for="ginj-player">Player</label><select id="ginj-player">${lineup.map((p) => `<option value="${p.id}">${p.pos} ${esc(p.name)}</option>`).join('')}</select></div>
            <div class="field"><label for="ginj-type">Injury</label><select id="ginj-type">${INJURY_TYPES.map((t) => `<option value="${esc(t.label)}">${esc(t.label)}</option>`).join('')}</select></div>
            <div class="field" style="flex:0 0 100px"><label for="ginj-weeks">Weeks</label><input type="number" id="ginj-weeks" min="0" max="40" value="2" /></div>
            <button class="ghost-btn" data-action="add-game-injury" type="button">Add</button>
          </div>
          ${d.injuries.length ? `<ul class="list">${d.injuries.map((i, idx) => {
    const p = playerById(i.playerId);
    return `<li><span>${p ? `${p.pos} ${esc(p.name)}` : ''} — ${esc(i.type)}, ${i.weeksOut}w</span><button class="mini-btn" data-action="drop-game-injury" data-idx="${idx}" type="button">Remove</button></li>`;
  }).join('')}</ul>` : '<p class="empty">Everybody walked off under their own power.</p>'}
        </div>

        <div class="panel">
          <h3>Finalize</h3>
          <p class="panel-sub">Locks the result, plays out the rest of the league's week and sends it all to the media.</p>
          <button class="primary-btn big" data-action="finalize-game" type="button">Final — send it to the wire</button>
        </div>
      </div>
    </div>`;
}

function renderGameRecap(result) {
  const mine = result.home === state.teamId;
  const me = mine ? result.homeScore : result.awayScore;
  const them = mine ? result.awayScore : result.homeScore;
  const opp = mine ? result.away : result.home;
  const won = me > them;
  const box = result.box || { offense: [], defense: [] };

  return `
    <div class="panel">
      <h3>${won ? 'Win' : me === them ? 'Tie' : 'Loss'} — ${me}-${them} ${mine ? 'vs' : 'at'} ${esc(teamName(opp))}</h3>
      <p class="panel-sub">${state.phase === 'preseason' ? 'Preseason' : 'Regular season'} · Week ${result.week}</p>
      <div class="two-col">
        <div>
          <h4>Offense</h4>
          <ul class="list">${box.offense.map((l) => `<li><span>${l.pos} ${esc(l.name)}</span><span class="hint">${esc(l.line)}</span></li>`).join('') || '<li class="empty">No box score.</li>'}</ul>
        </div>
        <div>
          <h4>Defense</h4>
          <ul class="list">${box.defense.map((l) => `<li><span>${l.pos} ${esc(l.name)}</span><span class="hint">${esc(l.line)}</span></li>`).join('') || '<li class="empty">No box score.</li>'}</ul>
        </div>
      </div>
      ${result.plays?.length ? `<h4 style="margin-top:1rem">Key plays</h4>
        <div class="play-list">${result.plays.map((p) => `<div class="play-item ${p.tone === 'bad' || p.tone === 'penalty' ? 'bad' : 'good'}">
          <span class="clockcell">${esc(p.q)} ${esc(p.clock || '')}</span>
          <span>${esc(p.text)}<br><small>${esc(p.side)} · ${esc(p.tone)}</small></span><span></span>
        </div>`).join('')}</div>` : ''}
      <div class="inline-actions" style="margin-top:1rem">
        <button class="primary-btn" data-action="advance-week" type="button">Advance to next week</button>
        <button class="ghost-btn" data-action="generate-media" type="button">Get the league's reaction</button>
      </div>
    </div>`;
}

function suggestScore() {
  const g = currentGame();
  if (!g) return;
  const rng = makeRng(seedFrom(`suggest-${state.teamId}-${state.week}-${Date.now()}`));
  const oppRoster = rosterFor(state, g.opp);
  const lineup = lineupFor(state.gameDraft.presetId, state.gameDraft.inactives);
  const { homeScore, awayScore } = simGame(
    g.isHome ? lineup : oppRoster,
    g.isHome ? oppRoster : lineup,
    { rng, preseason: state.phase === 'preseason' },
  );
  state.gameDraft.teamScore = g.isHome ? homeScore : awayScore;
  state.gameDraft.oppScore = g.isHome ? awayScore : homeScore;
  save();
  renderFranchise();
}

function finalizeGame() {
  const g = currentGame();
  if (!g) return;
  const d = state.gameDraft;
  const me = Number($('#my-score')?.value ?? d.teamScore);
  const them = Number($('#opp-score')?.value ?? d.oppScore);
  if (!Number.isFinite(me) || !Number.isFinite(them) || me < 0 || them < 0) {
    toast('Put a score in first.');
    return;
  }

  const lineup = lineupFor(d.presetId, d.inactives);
  const box = generateBoxScore(state, {
    lineup,
    teamScore: me,
    oppScore: them,
    scheme: d.offScheme,
    opp: g.opp,
    isHome: g.isHome,
    phase: state.phase,
    week: state.week,
  });

  const result = {
    phase: state.phase,
    week: state.week,
    home: g.isHome ? state.teamId : g.opp,
    away: g.isHome ? g.opp : state.teamId,
    homeScore: g.isHome ? me : them,
    awayScore: g.isHome ? them : me,
    mine: true,
    plays: d.plays,
    box,
    scheme: { off: d.offScheme, def: d.defScheme, preset: d.presetId },
  };
  state.results.push(result);
  applyGameToPlayers(state, { lineup, box, injuries: d.injuries, won: me > them });

  const won = me > them;
  const verb = won ? 'beat' : me === them ? 'tie' : 'fall to';
  pushMedia({
    kind: 'wire',
    outlet: 'Final',
    headline: `${myTeam().name} ${verb} ${TEAM_BY_CODE[g.opp].name}, ${me}-${them}`,
    body: d.plays.length ? d.plays.map((p) => `${p.q} ${p.clock || ''} — ${p.text}`).join('\n') : 'Final from the wire.',
  });

  state.gameDraft = blankGameDraft();
  simOthersThisWeek();
  checkpoint(`After ${state.phase === 'preseason' ? 'PRE' : 'WK'}${result.week}`);
  if (state.settings.autoMedia) generateMedia({ trigger: 'game' });
  else { save(); renderFranchise(); }
}

/* ------------------------------------------------------- calendar motion */

function advanceDay(silent) {
  if (state.phase === 'offseason') { toast('The season is over — start the next one.'); return; }
  if (state.day < GAME_DAY) {
    state.day += 1;
    if (!silent) { save(); renderFranchise(); }
    return;
  }
  const g = currentGame();
  if (g && !myGamePlayed()) {
    toast('Game day — play the game before the week turns over.');
    ui.tab = 'gameday';
    renderFranchise();
    return;
  }
  rollWeekForward();
  if (!silent) { save(); renderFranchise(); }
}

function jumpToGameDay() {
  while (state.day < GAME_DAY) {
    const type = PRACTICE_TYPES.find((t) => t.id === 'walkthrough');
    const { log } = applyPractice(state, { typeId: 'walkthrough', injuries: [], absences: [], bigPlays: [] });
    state.practices.push({
      phase: state.phase, week: state.week, day: state.day, typeId: 'walkthrough', typeLabel: type.label, log, injuries: 0, absences: 0,
    });
    state.day += 1;
  }
  ui.tab = 'gameday';
  save();
  renderFranchise();
}

/** Play out every other team's game for the week the player is sitting in. */
function simOthersThisWeek() {
  if (state.phase === 'offseason') return;
  const already = state.results.some((r) => r.phase === state.phase && r.week === state.week
    && r.home !== state.teamId && r.away !== state.teamId);
  if (already) return;
  simWeek(state, state.phase, state.week, { skipTeam: state.teamId })
    .forEach((r) => state.results.push(r));
}

/** Close the week out and move the calendar to the next one. */
function rollWeekForward() {
  simOthersThisWeek();
  advanceWeekHealth(state).forEach((p) => {
    pushMedia({ kind: 'wire', outlet: 'Injury Wire', headline: `${p.pos} ${p.name} is back`, body: `${p.name} has been cleared and is available again.` });
  });
  state.week += 1;
  state.day = 1;
  state.practiceDraft = blankPracticeDraft();
  state.gameDraft = blankGameDraft();

  if (state.phase === 'preseason' && state.week > PRESEASON_WEEKS) {
    state.phase = 'regular';
    state.week = 1;
    pushMedia({ kind: 'wire', outlet: 'League Wire', headline: 'Camp is over — the season is here', body: `${teamName(state.teamId)} open the regular season.` });
  } else if (state.phase === 'regular' && state.week > REGULAR_WEEKS) {
    enterOffseason();
  }
  ui.leagueWeek = clamp(state.week, 1, state.phase === 'preseason' ? PRESEASON_WEEKS : REGULAR_WEEKS);
}

function enterOffseason() {
  state.phase = 'offseason';
  state.week = 1;
  state.day = 1;
  const st = computeStandings();
  const rec = st[state.teamId];
  const seeds = conferenceSeeds(st, myTeam().conf);
  const seed = seeds.findIndex((s) => s.team.code === state.teamId);
  pushMedia({
    kind: 'wire',
    outlet: 'League Wire',
    headline: `${myTeam().name} finish ${recordText(rec)}`,
    body: seed >= 0
      ? `The ${myTeam().name} are in as the ${seed + 1} seed in the ${myTeam().conf}.`
      : `The ${myTeam().name} miss the field. The offseason starts now.`,
  });
}

function advanceWeek() {
  const g = currentGame();
  if (g && !myGamePlayed()) {
    toast('You have a game this week — play it first.');
    ui.tab = 'gameday';
    renderFranchise();
    return;
  }
  rollWeekForward();
  save();
  renderFranchise();
}

/** Age the roster, rebuild the calendar and open a new camp. */
function startNextSeason() {
  const rng = makeRng(seedFrom(`offseason-${state.teamId}-${state.year}`));
  const departures = [];
  state.roster.forEach((p) => {
    p.age += 1;
    p.exp += 1;
    const swing = p.age <= 24 ? Math.round(rng() * 3)
      : p.age <= 28 ? Math.round(rng() * 2) - 1
        : p.age <= 31 ? -Math.round(rng() * 2)
          : -1 - Math.round(rng() * 3);
    p.ovr = clamp(p.ovr + swing, 50, 99);
    p.injury = null;
    p.status = 'active';
    p.fatigue = 0;
    p.sharpness = 50;
    p.season = { gp: 0, snaps: 0, pass: 0, rush: 0, rec: 0, td: 0, tackles: 0, sacks: 0, ints: 0 };
    p.contract.yearsLeft -= 1;
    if (p.contract.yearsLeft <= 0) {
      const fresh = contractFor(p.pos, p.ovr, p.age, rng);
      p.contract = fresh;
      departures.push(`${p.pos} ${p.name} re-signed at $${fresh.apy}M per year`);
    }
  });

  state.year += 1;
  state.deadCap = 0;
  state.results = [];
  state.practices = [];
  state.picks = defaultPicks(state.year);
  state.aiPicks = {};
  state.freeAgents = generateFreeAgents(seedFrom(`fa-${state.year}-${state.teamId}`));
  state.aiRosters = {};

  const rosters = { [state.teamId]: state.roster };
  TEAMS.forEach((t) => {
    if (t.code !== state.teamId) rosters[t.code] = rosterFor(state, t.code);
  });
  const seed = Math.floor(Math.random() * 100000) + 1;
  const sched = buildSchedule({ year: state.year, seed, ratings: leagueRatings(rosters) });
  if (sched) state.schedule = sched;

  state.phase = 'preseason';
  state.week = 1;
  state.day = 1;
  state.practiceDraft = blankPracticeDraft();
  state.gameDraft = blankGameDraft();
  ui.leagueWeek = 1;
  ui.tab = 'dashboard';
  pushMedia({
    kind: 'wire',
    outlet: 'League Wire',
    headline: `${state.year} camp opens in ${myTeam().city}`,
    body: departures.length ? `Contract business: ${departures.slice(0, 4).join('; ')}.` : 'A new calendar, a new schedule, same building.',
  });
  checkpoint(`${state.year} season start`);
  save();
  renderFranchise();
  toast(`Welcome to ${state.year}.`);
}

/* ---------------------------------------------------------------- league */

function renderLeague() {
  const standings = computeStandings();
  const phase = state.phase === 'offseason' ? 'regular' : state.phase;
  const wk = clamp(ui.leagueWeek, 1, phase === 'preseason' ? PRESEASON_WEEKS : REGULAR_WEEKS);
  const list = phase === 'preseason' ? state.schedule.preseason : state.schedule.regular;
  const games = list[wk - 1] || [];

  const cards = games.map((g) => {
    const r = state.results.find((x) => x.phase === phase && x.week === wk && x.home === g.home && x.away === g.away);
    const mine = g.home === state.teamId || g.away === state.teamId;
    if (!r) {
      return `<div class="score-card ${mine ? 'mine' : ''}">
        <div class="score-line"><b>${esc(TEAM_BY_CODE[g.away].name)}</b><span>—</span></div>
        <div class="score-line"><b>${esc(TEAM_BY_CODE[g.home].name)}</b><span>—</span></div>
        <small class="hint">Not played</small>
      </div>`;
    }
    const homeWin = r.homeScore > r.awayScore;
    return `<div class="score-card ${mine ? 'mine' : ''}">
      <div class="score-line ${homeWin ? '' : 'win'}"><b>${esc(TEAM_BY_CODE[r.away].name)}</b><span>${r.awayScore}</span></div>
      <div class="score-line ${homeWin ? 'win' : ''}"><b>${esc(TEAM_BY_CODE[r.home].name)}</b><span>${r.homeScore}</span></div>
      <small class="hint">${r.mine ? 'Your game' : 'Final'}</small>
    </div>`;
  }).join('');

  const byes = phase === 'regular'
    ? TEAMS.filter((t) => !games.some((g) => g.home === t.code || g.away === t.code))
    : [];

  const seedTable = (conf) => `<table>
    <thead><tr><th>${conf} seeds</th><th class="num">W</th><th class="num">L</th><th class="num">T</th><th class="num">PCT</th></tr></thead>
    <tbody>${conferenceSeeds(standings, conf).map((s, i) => `<tr class="${s.team.code === state.teamId ? 'me' : ''}">
      <td>${i + 1}. ${esc(s.team.city)} ${esc(s.team.name)}${i < 4 ? ' <span class="tag">div</span>' : ''}</td>
      <td class="num">${s.rec.w}</td><td class="num">${s.rec.l}</td><td class="num">${s.rec.t}</td>
      <td class="num">${winPct(s.rec).toFixed(3).replace(/^0/, '')}</td>
    </tr>`).join('')}</tbody></table>`;

  return `
    <div class="panel">
      <h3>Week ${wk} scoreboard
        <span class="inline-actions">
          <button class="mini-btn" data-action="league-week" data-delta="-1" type="button">◀ Prev</button>
          <button class="mini-btn" data-action="league-week" data-delta="1" type="button">Next ▶</button>
        </span>
      </h3>
      <p class="panel-sub">${phase === 'preseason' ? 'Preseason' : 'Regular season'}${byes.length ? ` · On bye: ${byes.map((t) => t.code).join(', ')}` : ''}</p>
      <div class="scorebox">${cards || '<p class="empty">No games this week.</p>'}</div>
    </div>

    <div class="panel">
      <h3>Standings</h3>
      <div class="standings-grid">
        <div>${DIVISIONS.map((d) => `<div class="div-block">${divisionTable('AFC', d)}</div>`).join('')}</div>
        <div>${DIVISIONS.map((d) => `<div class="div-block">${divisionTable('NFC', d)}</div>`).join('')}</div>
      </div>
    </div>

    <div class="panel">
      <h3>Playoff picture</h3>
      <div class="standings-grid"><div>${seedTable('AFC')}</div><div>${seedTable('NFC')}</div></div>
    </div>

    <div class="panel">
      <h3>Your season</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Week</th><th>Opponent</th><th>Result</th></tr></thead>
        <tbody>${teamSchedule(state.schedule, state.teamId).map((row) => {
    const r = row.bye ? null : state.results.find((x) => x.phase === row.phase && x.week === row.week
      && (x.home === state.teamId || x.away === state.teamId));
    let res = row.bye ? '<span class="bye">Bye</span>' : '—';
    if (r) {
      const mine = r.home === state.teamId;
      const me = mine ? r.homeScore : r.awayScore;
      const them = mine ? r.awayScore : r.homeScore;
      res = `<span class="tag ${me > them ? 'ok' : me < them ? 'out' : ''}">${me > them ? 'W' : me < them ? 'L' : 'T'} ${me}-${them}</span>`;
    }
    return `<tr><td>${row.phase === 'preseason' ? 'PRE' : 'WK'} ${row.week}</td>
      <td>${row.bye ? '—' : `${row.home ? 'vs' : 'at'} ${esc(teamName(row.opp))}`}</td><td>${res}</td></tr>`;
  }).join('')}</tbody>
      </table></div>
    </div>`;
}

/* ----------------------------------------------------------------- menu */

function openMenu() {
  const hasSave = !!loadSave();
  let checkpoints = [];
  try { checkpoints = JSON.parse(localStorage.getItem(CHECKPOINT_KEY) || '[]'); } catch (err) { checkpoints = []; }
  modal('Menu', `
    <div class="menu-list">
      ${state ? '<button class="ghost-btn" data-action="export-save" type="button">Export save file</button>' : ''}
      <button class="ghost-btn" data-action="import-save" type="button">Import save file</button>
      ${state ? '<button class="ghost-btn" data-action="checkpoint-now" type="button">Save a checkpoint</button>' : ''}
      ${checkpoints.length ? `<div class="field" style="margin-top:.6rem">
        <label>Restore a checkpoint</label>
        <select id="checkpoint-select">${checkpoints.map((c, i) => `<option value="${i}">${esc(c.label)} — ${new Date(c.at).toLocaleString()}</option>`).join('')}</select>
      </div>
      <button class="ghost-btn" data-action="restore-checkpoint" type="button">Restore selected</button>` : ''}
      <button class="danger-btn" data-action="wipe-save" type="button">Delete everything and start over</button>
      ${hasSave && !state ? '<button class="primary-btn" data-action="continue" type="button">Continue saved franchise</button>' : ''}
    </div>
    <input type="file" id="import-file" accept="application/json" hidden />`);
}

function exportSave() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.teamId.toLowerCase()}-franchise-${state.year}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importSave(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      if (!data?.teamId || !data?.schedule) throw new Error('not a franchise save');
      state = data;
      state.aiMedia = state.aiMedia || { available: null };
      saveNow(true);
      closeModal();
      enterFranchise();
      toast('Save loaded.');
    } catch (err) {
      toast('That file is not a franchise save.');
    }
  };
  reader.readAsText(file);
}

/* ------------------------------------------------------------- listeners */

function afterRender() {
  const filterEl = $('#team-roster-filter');
  if (filterEl) {
    filterEl.addEventListener('input', (e) => {
      ui.rosterFilter = e.target.value;
      const pos = e.target.selectionStart;
      renderFranchise();
      const again = $('#team-roster-filter');
      if (again) { again.focus(); again.setSelectionRange(pos, pos); }
    });
  }
  const sortEl = $('#roster-sort');
  if (sortEl) sortEl.addEventListener('change', (e) => { ui.rosterSort = e.target.value; renderFranchise(); });

  const roleEl = $('#st-role');
  if (roleEl) {
    roleEl.addEventListener('change', (e) => {
      const author = $('#st-author');
      if (author) author.value = defaultAuthorFor(e.target.value);
    });
  }
  const autoMedia = $('#auto-media');
  if (autoMedia) autoMedia.addEventListener('change', (e) => { state.settings.autoMedia = e.target.checked; save(); });

  const offScheme = $('#off-scheme');
  if (offScheme) offScheme.addEventListener('change', (e) => { state.gameDraft.offScheme = e.target.value; save(); });
  const defScheme = $('#def-scheme');
  if (defScheme) defScheme.addEventListener('change', (e) => { state.gameDraft.defScheme = e.target.value; save(); });

  ['my-score', 'opp-score'].forEach((id) => {
    const el = $(`#${id}`);
    if (el) {
      el.addEventListener('change', () => {
        state.gameDraft.teamScore = $('#my-score').value;
        state.gameDraft.oppScore = $('#opp-score').value;
        save();
      });
    }
  });
}

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.edit) editSetupPlayer(t.dataset.id, t.dataset.edit, t.value);
  if (t.dataset.liveEdit === 'name') {
    const p = playerById(t.dataset.id);
    if (p) { p.name = t.value.slice(0, 40); save(); }
  }
  if (t.id === 'roster-filter') renderRosterEdit();
});

document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.inactive) {
    const id = t.dataset.inactive;
    const list = new Set(state.gameDraft.inactives);
    if (t.checked) list.add(id); else list.delete(id);
    state.gameDraft.inactives = Array.from(list);
    save();
    renderFranchise();
  }
  if (t.dataset.trade) {
    const bucket = t.dataset.trade === 'give' ? 'tradeGive' : 'tradeGet';
    const set = new Set(ui[bucket]);
    if (t.checked) set.add(t.dataset.key); else set.delete(t.dataset.key);
    ui[bucket] = Array.from(set);
    renderTradeModal();
  }
  if (t.id === 'trade-partner') {
    ui.tradePartner = t.value;
    ui.tradeGet = [];
    renderTradeModal();
  }
  if (t.id === 'import-file' && t.files?.[0]) importSave(t.files[0]);
});

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (e.target.matches('[data-modal-backdrop]')) { closeModal(); return; }
  if (!btn) return;
  const { action } = btn.dataset;

  const actions = {
    'new-franchise': () => {
      setup = { teamId: null, roster: null, year: new Date().getFullYear(), schedule: null, aiRosters: {} };
      renderTeamSelect();
      showScreen('team-select');
    },
    continue: () => {
      const data = loadSave();
      if (!data) { toast('No saved franchise found.'); return; }
      state = data;
      state.aiMedia = state.aiMedia || { available: null };
      closeModal();
      enterFranchise();
    },
    'pick-team': () => pickTeam(btn.dataset.code),
    'back-start': () => showScreen('start'),
    'to-roster': () => { renderRosterEdit(); showScreen('roster-edit'); },
    'back-team': () => { renderTeamSelect(); showScreen('team-select'); },
    'reset-roster': () => { resetUid(0); setup.roster = buildRoster(setup.teamId, seedFrom(`roster-${setup.teamId}`)); renderRosterEdit(); },
    'to-schedule': () => {
      setup.schedule = buildSetupSchedule(Math.floor(Math.random() * 100000) + 1);
      renderSchedule();
      showScreen('schedule');
    },
    'back-roster': () => { renderRosterEdit(); showScreen('roster-edit'); },
    'reroll-pre': () => {
      const s = buildSetupSchedule(setup.schedule.seed + 101);
      setup.schedule.preseason = s.preseason;
      renderSchedule();
    },
    'reroll-reg': () => {
      const s = buildSetupSchedule(Math.floor(Math.random() * 100000) + 1);
      setup.schedule.regular = s.regular;
      setup.schedule.byeWeek = s.byeWeek;
      setup.schedule.seed = s.seed;
      renderSchedule();
    },
    'start-preseason': () => startFranchise('preseason'),
    'start-regular': () => startFranchise('regular'),

    'tab-media': () => { ui.tab = 'media'; renderFranchise(); },
    'goto-practice': () => { ui.tab = 'practice'; renderFranchise(); },
    'goto-gameday': () => { ui.tab = 'gameday'; renderFranchise(); },
    'jump-to-gameday': jumpToGameDay,
    'advance-day': () => advanceDay(false),
    'advance-week': advanceWeek,
    'generate-media': () => generateMedia({ trigger: 'manual' }),
    'media-filter': () => { ui.mediaFilter = btn.dataset.filter; renderFranchise(); },
    'post-statement': () => postStatement(false),
    'post-statement-react': () => postStatement(true),
    'post-press': postPress,

    'player-card': () => playerCard(btn.dataset.id),
    'save-card': () => {
      const p = playerById(btn.dataset.id);
      if (!p) return;
      p.name = ($('#card-name').value || p.name).slice(0, 40);
      p.ovr = clamp(Math.round(Number($('#card-ovr').value) || p.ovr), 50, 99);
      p.jersey = clamp(Math.round(Number($('#card-jersey').value) || p.jersey), 0, 99);
      save();
      closeModal();
      renderFranchise();
    },
    'release-player': () => releasePlayer(btn.dataset.id),
    'clear-injury': () => {
      const p = playerById(btn.dataset.id);
      if (!p) return;
      p.injury = null;
      if (p.status === 'ir') p.status = 'active';
      save();
      renderFranchise();
    },
    'open-fa': openFreeAgents,
    'sign-fa': () => signFreeAgent(btn.dataset.id),
    'open-contracts': openContracts,
    'open-depth': openDepthChart,
    'extend-player': () => extendPlayer(btn.dataset.id),
    'restructure-player': () => restructurePlayer(btn.dataset.id),
    'open-trade': openTrade,
    'execute-trade': executeTrade,

    'set-practice-type': () => { state.practiceDraft.typeId = btn.dataset.id; save(); renderFranchise(); },
    'run-practice': runPractice,
    'roll-practice-injury': rollPracticeInjury,
    'add-practice-injury': () => {
      const playerId = $('#inj-player').value;
      const type = $('#inj-type').value;
      const weeksOut = clamp(Math.round(Number($('#inj-weeks').value) || 1), 0, 40);
      state.practiceDraft.injuries.push({ playerId, type, weeksOut });
      save();
      renderFranchise();
    },
    'drop-practice-injury': () => { state.practiceDraft.injuries.splice(Number(btn.dataset.idx), 1); save(); renderFranchise(); },
    'add-absence': () => {
      state.practiceDraft.absences.push({ playerId: $('#abs-player').value, reason: $('#abs-reason').value });
      save();
      renderFranchise();
    },
    'drop-absence': () => { state.practiceDraft.absences.splice(Number(btn.dataset.idx), 1); save(); renderFranchise(); },
    'add-bigplay': () => {
      const text = $('#bp-text').value.trim();
      if (!text) { toast('Describe the play first.'); return; }
      state.practiceDraft.bigPlays.push({
        text, playerId: $('#bp-player').value || null, good: $('#bp-tone').value === 'good',
      });
      save();
      renderFranchise();
    },
    'drop-bigplay': () => { state.practiceDraft.bigPlays.splice(Number(btn.dataset.idx), 1); save(); renderFranchise(); },

    'set-preset': () => { state.gameDraft.presetId = btn.dataset.id; save(); renderFranchise(); },
    'add-play': () => {
      const text = $('#play-text').value.trim();
      if (!text) { toast('Write the play first.'); return; }
      state.gameDraft.plays.push({
        q: $('#play-q').value, clock: $('#play-clock').value.trim(),
        side: $('#play-side').value, tone: $('#play-tone').value, text,
      });
      state.gameDraft.teamScore = $('#my-score')?.value ?? state.gameDraft.teamScore;
      state.gameDraft.oppScore = $('#opp-score')?.value ?? state.gameDraft.oppScore;
      save();
      renderFranchise();
    },
    'drop-play': () => { state.gameDraft.plays.splice(Number(btn.dataset.idx), 1); save(); renderFranchise(); },
    'add-game-injury': () => {
      state.gameDraft.injuries.push({
        playerId: $('#ginj-player').value,
        type: $('#ginj-type').value,
        weeksOut: clamp(Math.round(Number($('#ginj-weeks').value) || 1), 0, 40),
      });
      save();
      renderFranchise();
    },
    'drop-game-injury': () => { state.gameDraft.injuries.splice(Number(btn.dataset.idx), 1); save(); renderFranchise(); },
    'suggest-score': suggestScore,
    'finalize-game': finalizeGame,

    'next-season': startNextSeason,
    'league-week': () => {
      const max = state.phase === 'preseason' ? PRESEASON_WEEKS : REGULAR_WEEKS;
      ui.leagueWeek = clamp(ui.leagueWeek + Number(btn.dataset.delta), 1, max);
      renderFranchise();
    },

    'close-modal': closeModal,
    'export-save': exportSave,
    'import-save': () => $('#import-file')?.click(),
    'checkpoint-now': () => { checkpoint(`Manual · ${stamp()}`); closeModal(); toast('Checkpoint saved.'); },
    'restore-checkpoint': () => {
      try {
        const list = JSON.parse(localStorage.getItem(CHECKPOINT_KEY) || '[]');
        const idx = Number($('#checkpoint-select').value);
        const data = JSON.parse(list[idx].data);
        state = data;
        saveNow(true);
        closeModal();
        enterFranchise();
        toast('Checkpoint restored.');
      } catch (err) { toast('Could not restore that checkpoint.'); }
    },
    'wipe-save': () => {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(CHECKPOINT_KEY);
      state = null;
      closeModal();
      location.reload();
    },
  };

  const fn = actions[action];
  if (fn) fn();
});

$('#btn-menu').addEventListener('click', openMenu);
$('#tabs').addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  ui.tab = tab.dataset.tab;
  renderFranchise();
});

/* ------------------------------------------------------------------ boot */

(function boot() {
  const saved = loadSave();
  if (saved) {
    $('#btn-continue').hidden = false;
    applyTeamColors(saved.teamId);
  }
  showScreen('start');
}());
