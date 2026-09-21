// Gridiron Control Center — the UI. Every category is its own tab with its own
// table; the schedule tab is where the injury tool lives.

import { TEAMS, teamLabel, generateFranchise, simulateGame, seasonTotals } from './league.js';
import { INJURY_TYPES, resolveInjury, scriptInjury, unscriptInjury, applyInjuriesForGame, advanceHealing, exportInjuryScript } from './injury.js';
import { importFranchise, exportFranchise } from './franchise-file.js';

const SAVE_KEY = 'gcc.franchise.v1';
const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== false && v !== undefined) n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return n;
};

const TABS = [
  ['dashboard', 'Dashboard'],
  ['schedule', 'Schedule & Injury Control'],
  ['blocking', 'Advanced Blocking'],
  ['snaps', 'Snap Counts'],
  ['receiving', 'Targets & Drops'],
  ['defense', 'Missed Sacks & Tackles'],
  ['penalties', 'Penalties'],
  ['injuries', 'Injury Report'],
  ['file', 'Franchise File'],
];

const state = {
  fr: null,
  view: 'dashboard',
  team: 'KC',
  scope: 'season',        // season totals vs. a single game
  gameId: null,
  week: 1,
  sort: {},               // per-view sort column + direction
  flash: null,
  saves: null,            // what the save scan found, newest first
  scanning: false,
  extraDirs: [],          // folders the user pointed at by hand
};

/* ------------------------------------------------------------------ saving */

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ fr: state.fr, team: state.team })); }
  catch { /* private mode, a full disk — the app still works, it just forgets */ }
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data && data.fr && data.fr.rosters) { state.team = data.team || state.team; return data.fr; }
  } catch { /* corrupt save: fall through to a fresh franchise */ }
  return null;
}

/* ------------------------------------------------------------------ tables */

/**
 * Sortable table. cols: [{ key, label, get, fmt, cls, wide }]. The first column
 * is the player and renders name + position + injury flag.
 */
function table(id, rows, cols, { defaultSort, limit = 200, empty = 'Nothing here yet.' } = {}) {
  if (!rows.length) return el('div', { class: 'empty' }, empty);
  const sort = state.sort[id] || (state.sort[id] = { key: defaultSort || cols[1].key, dir: -1 });
  const col = cols.find((c) => c.key === sort.key) || cols[1];
  const sorted = rows.slice().sort((a, b) => {
    const av = col.get(a), bv = col.get(b);
    if (typeof av === 'string' || typeof bv === 'string') return String(av).localeCompare(String(bv)) * -sort.dir;
    return (av - bv) * sort.dir;
  }).slice(0, limit);

  const thead = el('thead', {}, el('tr', {}, cols.map((c) =>
    el('th', {
      class: [c.key === sort.key ? 'sorted' : '', c.wide ? 'left' : ''].join(' ').trim() || null,
      title: c.title || null,
      onclick: () => {
        const s = state.sort[id];
        if (s.key === c.key) s.dir *= -1; else { s.key = c.key; s.dir = -1; }
        render();
      },
    }, c.label + (c.key === sort.key ? (sort.dir === -1 ? ' ▾' : ' ▴') : ''))
  )));

  const tbody = el('tbody', {}, sorted.map((r) => el('tr', {}, cols.map((c) => {
    const v = c.fmt ? c.fmt(r) : c.get(r);
    return el('td', { class: [c.wide ? 'left' : 'num', c.cls ? c.cls(r) : ''].filter(Boolean).join(' ') },
      v && v.nodeType ? v : String(v));
  }))));

  return el('div', { class: 'tablewrap' }, el('table', {}, thead, tbody));
}

const nameCell = (row) => {
  const p = row.player;
  const out = p.injury ? el('span', { class: 'out' }, `OUT ${p.injury.gamesOut}w`) : null;
  return el('span', {}, p.name, el('span', { class: 'pos' }, p.pos), out);
};

const playerCol = { key: 'name', label: 'Player', wide: true, get: (r) => r.player.name, fmt: nameCell };

const gradeCls = (good, mid) => (val) => (val >= good ? 'good' : val >= mid ? 'mid' : 'bad');

/* -------------------------------------------------------------- data feeds */

// Rows for a category: either the season totals for the selected team or the
// single-game lines from whatever game is selected.
function feed(category) {
  const fr = state.fr;
  if (state.scope === 'game' && state.gameId) {
    const game = fr.schedule.find((g) => g.id === state.gameId);
    if (!game || game.bye) return [];
    const box = simulateGame(fr, game);
    const side = box.home.teamId === state.team ? box.home : box.away.teamId === state.team ? box.away : box.home;
    const rows = side[category] || [];
    // A single game's rows use the same field names as season rows except for
    // the derived ones, so fill those in here.
    return rows.map((r) => {
      const row = { ...r, games: 1 };
      if (category === 'receiving') {
        row.catchRate = r.targets ? Math.round((r.catches / r.targets) * 100) : 0;
        row.dropRate = r.targets ? Math.round((r.drops / r.targets) * 1000) / 10 : 0;
      }
      if (category === 'defense') {
        row.missRate = r.tacklesAtt ? Math.round((r.missedTackles / r.tacklesAtt) * 1000) / 10 : 0;
        row.sackConv = r.sacks + r.missedSacks ? Math.round((r.sacks / (r.sacks + r.missedSacks)) * 100) : 0;
      }
      if (category === 'snaps') { row.off = r.unit === 'Offense' ? r.count : 0; row.def = r.unit === 'Defense' ? r.count : 0; }
      return row;
    });
  }
  return seasonTotals(fr, state.team, null)[category] || [];
}

// Penalties are stored one flag at a time; roll them into per-player lines.
function penaltyRows() {
  const raw = state.scope === 'game' ? feed('penalties') : seasonTotals(state.fr, state.team, null).penalties;
  if (state.scope !== 'game') return raw;
  const map = new Map();
  for (const f of raw) {
    const key = f.player.id;
    if (!map.has(key)) map.set(key, { player: f.player, flags: 0, yards: 0, declined: 0, types: [] });
    const row = map.get(key);
    if (f.declined) row.declined++; else row.flags++;
    row.yards += f.yards;
    row.types.push(f.type);
  }
  return [...map.values()];
}

const playedGames = () => state.fr.schedule.filter((g) => !g.bye && g.played);
const teamGames = (teamId) => state.fr.schedule.filter((g) => !g.bye && (g.home === teamId || g.away === teamId));

/* ------------------------------------------------------------------- views */

function scopeBar(note) {
  const fr = state.fr;
  const games = teamGames(state.team).filter((g) => g.played);
  const sel = el('select', {
    onchange: (e) => {
      if (e.target.value === 'season') { state.scope = 'season'; state.gameId = null; }
      else { state.scope = 'game'; state.gameId = e.target.value; }
      render();
    },
  },
    el('option', { value: 'season', selected: state.scope === 'season' || null }, 'Season to date'),
    games.map((g) => {
      const opp = g.home === state.team ? `vs ${g.away}` : `at ${g.home}`;
      return el('option', { value: g.id, selected: state.gameId === g.id || null }, `Week ${g.week} ${opp}`);
    })
  );

  const teamSel = el('select', {
    onchange: (e) => { state.team = e.target.value; state.scope = 'season'; state.gameId = null; save(); render(); },
  }, fr.teams.map((t) => el('option', { value: t.id, selected: t.id === state.team || null }, teamLabel(t))));

  return el('div', { class: 'card' },
    el('div', { class: 'row' },
      el('label', { class: 'field grow' }, 'Team', teamSel),
      el('label', { class: 'field grow' }, 'Scope', sel),
      games.length ? null : el('p', { class: 'note' }, 'No games played yet — play a week on the Schedule tab and the numbers fill in.')
    ),
    note ? el('p', { class: 'hint', style: 'margin:12px 0 0' }, note) : null
  );
}

function viewDashboard() {
  const fr = state.fr;
  const tot = seasonTotals(fr, state.team, null);
  const played = teamGames(state.team).filter((g) => g.played).length;
  const t = fr.teams.find((x) => x.id === state.team);

  const best = (rows, fn) => rows.slice().sort((a, b) => fn(b) - fn(a))[0];
  const bestBlock = best(tot.blocking, (r) => r.winRate);
  const topTarget = best(tot.receiving, (r) => r.targets);
  const dropKing = best(tot.receiving, (r) => r.drops);
  const missedSack = best(tot.defense, (r) => r.missedSacks);
  const flagKing = best(tot.penalties, (r) => r.yards);
  const snapKing = best(tot.snaps, (r) => r.count);
  const injured = fr.rosters[state.team].filter((p) => p.injury);

  const stat = (k, v, s) => el('div', { class: 'stat' }, el('div', { class: 'k' }, k), el('div', { class: 'v' }, v), el('div', { class: 's' }, s || ''));

  return [
    el('div', { class: 'card' },
      el('div', { class: 'spread' },
        el('div', {},
          el('h2', {}, teamLabel(t)),
          el('p', { class: 'hint' }, `${t.conf} ${t.div} · Week ${fr.week} · ${played} games in the books · source: ${fr.source}`)),
        el('div', { class: 'row' },
          el('select', { onchange: (e) => { state.team = e.target.value; save(); render(); } },
            fr.teams.map((x) => el('option', { value: x.id, selected: x.id === state.team || null }, teamLabel(x)))),
          el('button', { class: 'btn', onclick: () => { state.view = 'schedule'; render(); } }, 'Injury Control')))),

    el('div', { class: 'grid' },
      stat('Best blocker', bestBlock ? bestBlock.player.name : '—', bestBlock ? `${bestBlock.winRate}% win rate · ${bestBlock.pancakes} pancakes · ${bestBlock.holdSeconds}s held` : 'no games played'),
      stat('Most snaps', snapKing ? snapKing.player.name : '—', snapKing ? `${snapKing.count} snaps` : ''),
      stat('Most targets', topTarget ? topTarget.player.name : '—', topTarget ? `${topTarget.targets} targets · ${topTarget.catches} catches` : ''),
      stat('Most drops', dropKing && dropKing.drops ? dropKing.player.name : '—', dropKing && dropKing.drops ? `${dropKing.drops} drops on ${dropKing.targets} targets` : 'nobody has dropped one'),
      stat('Most missed sacks', missedSack && missedSack.missedSacks ? missedSack.player.name : '—', missedSack && missedSack.missedSacks ? `${missedSack.missedSacks} let go · ${missedSack.sacks} finished` : ''),
      stat('Most penalty yards', flagKing && flagKing.flags ? flagKing.player.name : '—', flagKing && flagKing.flags ? `${flagKing.flags} flags · ${flagKing.yards} yards` : ''),
      stat('Injured', injured.length, injured.length ? injured.map((p) => p.name.split(' ').pop()).join(', ') : 'clean bill of health'),
      stat('Scripted injuries', fr.injuries.filter((i) => i.status === 'scripted').length, 'queued on the schedule')),

    fr.log.length ? el('div', { class: 'card' },
      el('h3', {}, 'What has gone down'),
      el('ul', { class: 'log' }, fr.log.slice(-8).reverse().map((l) =>
        el('li', {}, el('div', { class: 'w' }, `Week ${l.week} · ${l.teamId}`), l.text,
          el('div', { class: 'note' }, l.out ? `Out ${l.out} weeks — back week ${l.returnWeek}.` : 'Back the same game.'))))) : null,
  ];
}

function viewSchedule() {
  const fr = state.fr;
  const weeks = [...new Set(fr.schedule.map((g) => g.week))];
  const week = state.week;
  const games = fr.schedule.filter((g) => g.week === week && !g.bye);
  const byes = fr.schedule.filter((g) => g.week === week && g.bye).map((g) => g.bye);

  const picker = el('div', { class: 'row' }, weeks.map((w) =>
    el('button', { class: `btn small ${w === week ? '' : 'ghost'}`, onclick: () => { state.week = w; render(); } }, `W${w}`)));

  const cards = games.map((g) => {
    const scripted = fr.injuries.filter((i) => i.gameId === g.id);
    return el('div', { class: `game ${g.played ? 'played' : ''}` },
      el('div', {},
        el('div', { class: 'match' }, `${teamLabel(fr.teams.find((t) => t.id === g.away))} at ${teamLabel(fr.teams.find((t) => t.id === g.home))}`),
        el('div', { class: 'meta' }, `${g.kickoff} · ${g.played ? 'Final' : 'Not played'}`),
        scripted.length ? el('div', { class: 'flags' },
          scripted.map((i) => `${i.playerName} — ${i.typeName} (Q${i.quarter})`).join(' · ')) : null),
      el('div', { class: 'row' },
        el('button', { class: 'btn small', onclick: () => openInjuryModal(g) }, 'Pick an injury'),
        g.played
          ? el('button', { class: 'btn small ghost', onclick: () => { state.team = g.home; state.scope = 'game'; state.gameId = g.id; state.view = 'blocking'; render(); } }, 'Box score')
          : el('button', { class: 'btn small ghost', onclick: () => playGame(g) }, 'Play game')));
  });

  return [
    el('div', { class: 'card' },
      el('div', { class: 'spread' },
        el('div', {}, el('h2', {}, `Week ${week}`), el('p', { class: 'hint' }, 'Pick a game, pick a player, pick what happens to him. The engine picks the play.')),
        el('div', { class: 'row' },
          el('button', { class: 'btn ghost', onclick: () => playWeek(week) }, `Play week ${week}`),
          el('button', { class: 'btn ghost', onclick: () => downloadInjuryScript() }, 'Export injury script'))),
      picker),
    el('div', { class: 'card' }, cards.length ? cards : el('div', { class: 'empty' }, 'No games this week.'),
      byes.length ? el('p', { class: 'note' }, `Bye: ${byes.join(', ')}`) : null),
  ];
}

function viewBlocking() {
  const rows = feed('blocking');
  const cols = [
    playerCol,
    { key: 'reps', label: 'Reps', get: (r) => r.reps, title: 'Blocking snaps, pass and run' },
    { key: 'passSets', label: 'Pass sets', get: (r) => r.passSets },
    { key: 'pressures', label: 'Pressures', get: (r) => r.pressures, cls: (r) => (r.pressures > 12 ? 'bad' : r.pressures > 6 ? 'mid' : 'good'), title: 'Pressures the rusher won against him' },
    { key: 'sacksAllowed', label: 'Sacks allowed', get: (r) => r.sacksAllowed, cls: (r) => (r.sacksAllowed >= 3 ? 'bad' : r.sacksAllowed ? 'mid' : 'good') },
    { key: 'almost', label: 'Almost sacks', get: (r) => r.almost, title: 'Beaten clean, but the QB got it out or escaped' },
    { key: 'hurries', label: 'Hurries', get: (r) => r.hurries },
    { key: 'blown', label: 'Blown blocks', get: (r) => r.blown },
    { key: 'pancakes', label: 'Pancakes', get: (r) => r.pancakes, cls: (r) => (r.pancakes >= 10 ? 'good' : '') },
    { key: 'holdSeconds', label: 'Avg hold', get: (r) => r.holdSeconds, fmt: (r) => `${r.holdSeconds}s`, cls: (r) => (r.holdSeconds >= 3 ? 'good' : r.holdSeconds >= 2.5 ? 'mid' : 'bad'), title: 'How long he keeps his man off the QB' },
    { key: 'winRate', label: 'Win rate', get: (r) => r.winRate, fmt: (r) => `${r.winRate}%`, cls: (r) => gradeCls(88, 80)(r.winRate) },
  ];

  const best = rows.slice().sort((a, b) => (b.winRate - a.winRate) || (b.pancakes - a.pancakes))[0];
  const worst = rows.slice().sort((a, b) => b.pressures - a.pressures)[0];
  const longest = rows.slice().sort((a, b) => b.holdSeconds - a.holdSeconds)[0];
  const mauler = rows.slice().sort((a, b) => b.pancakes - a.pancakes)[0];

  return [
    scopeBar('Pressures, almost-sacks, pancakes and how long each blocker keeps his man off the quarterback.'),
    rows.length ? el('div', { class: 'grid' },
      el('div', { class: 'stat' }, el('div', { class: 'k' }, 'Best blocker'), el('div', { class: 'v' }, best.player.name), el('div', { class: 's' }, `${best.winRate}% win rate · ${best.sacksAllowed} sacks allowed`)),
      el('div', { class: 'stat' }, el('div', { class: 'k' }, 'Most pressures allowed'), el('div', { class: 'v' }, worst.player.name), el('div', { class: 's' }, `${worst.pressures} pressures · ${worst.almost} almost sacks`)),
      el('div', { class: 'stat' }, el('div', { class: 'k' }, 'Holds them longest'), el('div', { class: 'v' }, longest.player.name), el('div', { class: 's' }, `${longest.holdSeconds}s average`)),
      el('div', { class: 'stat' }, el('div', { class: 'k' }, 'Pancake leader'), el('div', { class: 'v' }, mauler.player.name), el('div', { class: 's' }, `${mauler.pancakes} pancakes`))) : null,
    el('div', { class: 'card' }, el('h3', {}, 'Blocking by player'), table('blocking', rows, cols, { defaultSort: 'pressures', empty: 'Play a game to get blocking numbers.' })),
  ];
}

function viewSnaps() {
  const rows = feed('snaps');
  const cols = [
    playerCol,
    { key: 'games', label: 'G', get: (r) => r.games },
    { key: 'count', label: 'Snaps', get: (r) => r.count },
    { key: 'off', label: 'Offense', get: (r) => r.off || 0 },
    { key: 'def', label: 'Defense', get: (r) => r.def || 0 },
    { key: 'avg', label: 'Per game', get: (r) => (r.games ? Math.round(r.count / r.games) : 0) },
  ];
  const off = rows.filter((r) => (r.off || 0) >= (r.def || 0));
  const def = rows.filter((r) => (r.def || 0) > (r.off || 0));
  return [
    scopeBar('Who is actually on the field. Snap counts split by side of the ball.'),
    el('div', { class: 'card' }, el('h3', {}, 'Offense'), table('snapsOff', off, cols, { defaultSort: 'count', empty: 'No snaps logged yet.' })),
    el('div', { class: 'card' }, el('h3', {}, 'Defense'), table('snapsDef', def, cols, { defaultSort: 'count', empty: 'No snaps logged yet.' })),
  ];
}

function viewReceiving() {
  const rows = feed('receiving');
  const cols = [
    playerCol,
    { key: 'games', label: 'G', get: (r) => r.games },
    { key: 'targets', label: 'Targets', get: (r) => r.targets },
    { key: 'catches', label: 'Catches', get: (r) => r.catches },
    { key: 'drops', label: 'Drops', get: (r) => r.drops, cls: (r) => (r.drops >= 5 ? 'bad' : r.drops >= 3 ? 'mid' : '') },
    { key: 'dropRate', label: 'Drop %', get: (r) => r.dropRate, fmt: (r) => `${r.dropRate}%`, cls: (r) => (r.dropRate >= 12 ? 'bad' : r.dropRate >= 7 ? 'mid' : 'good') },
    { key: 'catchRate', label: 'Catch %', get: (r) => r.catchRate, fmt: (r) => `${r.catchRate}%`, cls: (r) => gradeCls(70, 60)(r.catchRate) },
    { key: 'yards', label: 'Yards', get: (r) => r.yards },
    { key: 'yac', label: 'YAC', get: (r) => r.yac },
    { key: 'contested', label: 'Contested', get: (r) => r.contested },
    { key: 'tds', label: 'TD', get: (r) => r.tds },
  ];
  return [
    scopeBar('Every target and every drop, with the drop rate that goes with it.'),
    el('div', { class: 'card' }, el('h3', {}, 'Receiving'), table('receiving', rows, cols, { defaultSort: 'targets', empty: 'No targets yet.' })),
  ];
}

function viewDefense() {
  const rows = feed('defense');
  const cols = [
    playerCol,
    { key: 'games', label: 'G', get: (r) => r.games },
    { key: 'pressures', label: 'Pressures', get: (r) => r.pressures },
    { key: 'sacks', label: 'Sacks', get: (r) => r.sacks },
    { key: 'missedSacks', label: 'Missed sacks', get: (r) => r.missedSacks, cls: (r) => (r.missedSacks >= 4 ? 'bad' : r.missedSacks >= 2 ? 'mid' : ''), title: 'Had the QB dead and let him off' },
    { key: 'sackConv', label: 'Finish %', get: (r) => r.sackConv, fmt: (r) => `${r.sackConv}%`, cls: (r) => gradeCls(60, 40)(r.sackConv) },
    { key: 'qbHits', label: 'QB hits', get: (r) => r.qbHits },
    { key: 'tackles', label: 'Tackles', get: (r) => r.tackles },
    { key: 'missedTackles', label: 'Missed tackles', get: (r) => r.missedTackles, cls: (r) => (r.missedTackles >= 6 ? 'bad' : r.missedTackles >= 3 ? 'mid' : '') },
    { key: 'missRate', label: 'Miss %', get: (r) => r.missRate, fmt: (r) => `${r.missRate}%`, cls: (r) => (r.missRate >= 20 ? 'bad' : r.missRate >= 12 ? 'mid' : 'good') },
    { key: 'tfl', label: 'TFL', get: (r) => r.tfl },
    { key: 'pbu', label: 'PBU', get: (r) => r.pbu },
    { key: 'ints', label: 'INT', get: (r) => r.ints },
  ];
  const worstMiss = rows.slice().sort((a, b) => b.missedTackles - a.missedTackles)[0];
  const worstSack = rows.slice().sort((a, b) => b.missedSacks - a.missedSacks)[0];
  return [
    scopeBar('The plays the defense left on the field: sacks let go and tackles missed.'),
    rows.length ? el('div', { class: 'grid' },
      el('div', { class: 'stat' }, el('div', { class: 'k' }, 'Most missed sacks'), el('div', { class: 'v' }, worstSack.player.name), el('div', { class: 's' }, `${worstSack.missedSacks} let go · ${worstSack.sacks} finished`)),
      el('div', { class: 'stat' }, el('div', { class: 'k' }, 'Most missed tackles'), el('div', { class: 'v' }, worstMiss.player.name), el('div', { class: 's' }, `${worstMiss.missedTackles} misses on ${worstMiss.tacklesAtt} attempts`))) : null,
    el('div', { class: 'card' }, el('h3', {}, 'Defense by player'), table('defense', rows, cols, { defaultSort: 'missedTackles', empty: 'No defensive snaps yet.' })),
  ];
}

function viewPenalties() {
  const rows = penaltyRows();
  const cols = [
    playerCol,
    { key: 'flags', label: 'Flags', get: (r) => r.flags, cls: (r) => (r.flags >= 6 ? 'bad' : r.flags >= 3 ? 'mid' : '') },
    { key: 'yards', label: 'Yards', get: (r) => r.yards, cls: (r) => (r.yards >= 50 ? 'bad' : r.yards >= 25 ? 'mid' : '') },
    { key: 'declined', label: 'Declined', get: (r) => r.declined },
    { key: 'per', label: 'Yds/flag', get: (r) => (r.flags ? Math.round(r.yards / r.flags) : 0) },
  ];
  const total = rows.reduce((a, r) => a + r.flags, 0);
  const yards = rows.reduce((a, r) => a + r.yards, 0);
  const worst = rows.slice().sort((a, b) => b.flags - a.flags || b.yards - a.yards)[0];

  // The single-game view can show the actual flags, one line each.
  let detail = null;
  if (state.scope === 'game' && state.gameId) {
    const game = state.fr.schedule.find((g) => g.id === state.gameId);
    const box = simulateGame(state.fr, game);
    const side = box.home.teamId === state.team ? box.home : box.away;
    detail = el('div', { class: 'card' }, el('h3', {}, 'Every flag in this game'),
      el('div', { class: 'tablewrap' }, el('table', {},
        el('thead', {}, el('tr', {}, ['Qtr', 'Drive', 'Player', 'Penalty', 'Yards'].map((h, i) => el('th', { class: i === 2 || i === 3 ? 'left' : '' }, h)))),
        el('tbody', {}, side.penalties.map((f) => el('tr', {},
          el('td', { class: 'num' }, `Q${f.quarter}`),
          el('td', { class: 'num' }, f.drive),
          el('td', { class: 'left' }, `${f.player.name} (${f.player.pos})`),
          el('td', { class: 'left' }, f.type),
          el('td', { class: 'num' }, f.declined ? 'declined' : f.yards)))))));
  }

  return [
    scopeBar('Who keeps getting flagged, and what it is costing.'),
    rows.length ? el('div', { class: 'grid' },
      el('div', { class: 'stat' }, el('div', { class: 'k' }, 'Team flags'), el('div', { class: 'v' }, total), el('div', { class: 's' }, `${yards} yards given away`)),
      el('div', { class: 'stat' }, el('div', { class: 'k' }, 'Worst offender'), el('div', { class: 'v' }, worst.player.name), el('div', { class: 's' }, `${worst.flags} flags · ${worst.yards} yards`))) : null,
    el('div', { class: 'card' }, el('h3', {}, 'Penalties by player'), table('penalties', rows, cols, { defaultSort: 'flags', empty: 'No flags yet.' })),
    detail,
  ];
}

function viewInjuries() {
  const fr = state.fr;
  const scripted = fr.injuries.filter((i) => i.status === 'scripted');
  const fired = fr.injuries.filter((i) => i.status === 'fired');
  const sevClass = (s) => `pill sev-${s.split(' ')[0]}`;

  const line = (i, actions) => el('div', { class: 'game' },
    el('div', {},
      el('div', { class: 'match' }, `${i.playerName} (${i.pos}, ${i.teamId})`, ' ', el('span', { class: sevClass(i.severity) }, i.severity)),
      el('div', { class: 'meta' }, `Week ${i.week} · ${i.typeName} · out ${i.weeksOut} weeks · back week ${i.returnWeek}`),
      el('div', { class: 'note', style: 'margin-top:6px' }, i.description)),
    actions);

  return [
    el('div', { class: 'card' },
      el('div', { class: 'spread' },
        el('div', {}, el('h2', {}, 'Injury report'), el('p', { class: 'hint' }, 'Everything queued, and everything that has already happened.')),
        el('button', { class: 'btn ghost', onclick: () => downloadInjuryScript() }, 'Export injury script'))),
    el('div', { class: 'card' }, el('h3', {}, `Queued (${scripted.length})`),
      scripted.length ? scripted.map((i) => line(i, el('button', {
        class: 'btn small danger',
        onclick: () => { unscriptInjury(fr, i.id); save(); render(); },
      }, 'Cancel'))) : el('div', { class: 'empty' }, 'Nothing queued. Go to Schedule & Injury Control and pick a game.')),
    el('div', { class: 'card' }, el('h3', {}, `Already happened (${fired.length})`),
      fired.length ? fired.map((i) => line(i, el('span', { class: 'note' }, 'fired'))) : el('div', { class: 'empty' }, 'Nobody has gone down yet.')),
  ];
}

const EXTRA_DIRS_KEY = 'gcc.saveFolders.v1';

const readExtraDirs = () => {
  try { return JSON.parse(localStorage.getItem(EXTRA_DIRS_KEY) || '[]'); } catch { return []; }
};
const writeExtraDirs = (dirs) => {
  try { localStorage.setItem(EXTRA_DIRS_KEY, JSON.stringify(dirs)); } catch { /* nothing to do */ }
};

const KB = 1024;
function fileSize(bytes) {
  if (bytes >= KB * KB) return `${Math.round(bytes / (KB * KB) * 10) / 10} MB`;
  if (bytes >= KB) return `${Math.round(bytes / KB)} KB`;
  return `${bytes} bytes`;
}

// "8 minutes ago", "yesterday", "Mar 4" — whichever reads fastest.
function whenSaved(ms) {
  const diff = Date.now() - ms;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

async function scanSaves() {
  if (!window.gcc || !window.gcc.listSaves) return;
  state.scanning = true; render();
  try { state.saves = await window.gcc.listSaves(state.extraDirs); }
  catch { state.saves = []; }
  state.scanning = false;
  render();
}

async function openSave(save) {
  const res = await window.gcc.readSave(save.path);
  if (!res || res.error) { state.flash = res ? res.error : 'Could not read that file.'; render(); return; }
  if (res.binary) {
    state.flash = `${res.name} is Madden's own save file (${fileSize(res.size)}), not an export. `
      + 'This build can read exports — JSON or CSV — not the packed save, so the rosters in it cannot be pulled out yet.';
    render();
    return;
  }
  connect(res.text, res.name);
}

// The save browser: every save this machine has, newest at the top.
function saveBrowser() {
  if (!window.gcc || !window.gcc.listSaves) {
    return el('div', { class: 'card' },
      el('h3', {}, 'Your saves'),
      el('p', { class: 'hint' }, 'The desktop app lists every save on your PC here and loads one with a click. In a browser tab it can only take a file you hand it, below.'));
  }

  // Kick the first scan off after this render lands, not in the middle of it.
  if (state.saves === null && !state.scanning) setTimeout(scanSaves, 0);

  const rows = (state.saves || []).map((save, i) => el('div', { class: 'game' },
    el('div', {},
      el('div', { class: 'match' }, save.name,
        i === 0 ? el('span', { class: 'pill on', style: 'margin-left:8px' }, 'Most recent') : null,
        save.readable ? null : el('span', { class: 'pill sev-Minor', style: 'margin-left:8px' }, 'Madden save')),
      el('div', { class: 'meta' }, `${save.kind} · saved ${whenSaved(save.modified)} · ${fileSize(save.size)}`),
      el('div', { class: 'note' }, save.label)),
    el('button', { class: `btn small ${save.readable ? '' : 'ghost'}`, onclick: () => openSave(save) },
      save.readable ? 'Load this one' : 'What is this?')));

  return el('div', { class: 'card' },
    el('div', { class: 'spread' },
      el('div', {},
        el('h3', {}, 'Your saves'),
        el('p', { class: 'hint' }, 'Everything found on this PC, newest first. Click the top one.')),
      el('div', { class: 'row' },
        el('button', { class: 'btn ghost small', onclick: scanSaves }, state.scanning ? 'Looking…' : 'Rescan'),
        el('button', {
          class: 'btn ghost small',
          onclick: async () => {
            const dir = await window.gcc.pickSaveFolder();
            if (!dir) return;
            if (!state.extraDirs.includes(dir)) { state.extraDirs.push(dir); writeExtraDirs(state.extraDirs); }
            scanSaves();
          },
        }, 'Add a folder'))),
    state.scanning && !state.saves ? el('div', { class: 'empty' }, 'Looking through your Madden folders…')
      : rows.length ? rows
        : el('div', { class: 'empty' }, 'Nothing found. If your saves live somewhere else, use Add a folder.'));
}

function viewFile() {
  const fr = state.fr;
  const box = el('div', { class: 'filebox' },
    el('p', {}, el('strong', {}, 'Connect your franchise file')),
    el('p', { class: 'note' }, 'Drop a franchise export here, or pick one. JSON or CSV. A Control Center save loads back whole, scripted injuries and all.'),
    el('p', {}, el('button', { class: 'btn', onclick: chooseFile }, 'Choose a file')),
    el('input', { type: 'file', id: 'fileInput', accept: '.json,.csv,.txt', class: 'hidden', onchange: (e) => e.target.files[0] && readFile(e.target.files[0]) }));

  box.addEventListener('dragover', (e) => { e.preventDefault(); box.classList.add('drag'); });
  box.addEventListener('dragleave', () => box.classList.remove('drag'));
  box.addEventListener('drop', (e) => {
    e.preventDefault(); box.classList.remove('drag');
    const f = e.dataTransfer.files[0];
    if (f) readFile(f);
  });

  return [
    saveBrowser(),
    el('div', { class: 'card' }, el('h2', {}, 'Franchise file'),
      el('p', { class: 'hint' }, `Connected: ${fr.source} · ${Object.values(fr.rosters).reduce((a, r) => a + r.length, 0)} players · ${fr.teams.length} teams · week ${fr.week}`),
      box,
      state.flash ? el('div', { class: 'preview' }, state.flash) : null),
    el('div', { class: 'card' }, el('h3', {}, 'Save and export'),
      el('div', { class: 'row' },
        el('button', { class: 'btn', onclick: () => download(`${fr.seedText}-controlcenter.json`, exportFranchise(fr)) }, 'Save franchise'),
        el('button', { class: 'btn ghost', onclick: () => downloadInjuryScript() }, 'Export injury script'),
        el('button', { class: 'btn ghost', onclick: () => download('stats-export.json', statDump()) }, 'Export all stats'),
        el('button', {
          class: 'btn danger', onclick: () => {
            if (!confirm('Throw out this franchise and start a fresh demo league?')) return;
            state.fr = generateFranchise('demo-franchise-' + Date.now());
            state.week = 1; state.scope = 'season'; state.gameId = null; save(); render();
          },
        }, 'Start over')),
      el('p', { class: 'note', style: 'margin-top:12px' }, 'Everything is saved in this app. Nothing gets uploaded anywhere.')),
  ];
}

function statDump() {
  const out = { franchise: state.fr.seedText, year: state.fr.year, week: state.fr.week, teams: {} };
  for (const t of state.fr.teams) out.teams[t.id] = seasonTotals(state.fr, t.id, null);
  // Strip the player objects down so the file is readable.
  for (const cat of Object.values(out.teams)) {
    for (const rows of Object.values(cat)) {
      for (const r of rows) { r.name = r.player.name; r.pos = r.player.pos; delete r.player; }
    }
  }
  return out;
}

/* ---------------------------------------------------------- injury modal */

function openInjuryModal(game) {
  const fr = state.fr;
  const sel = { teamId: game.home, playerId: null, typeId: 'acl', quarter: 0, nonce: 0, preview: null };

  const body = $('#modalBody');

  function draw() {
    const roster = fr.rosters[sel.teamId].filter((p) => !p.injury);
    if (!roster.find((p) => p.id === sel.playerId)) sel.playerId = roster[0] ? roster[0].id : null;
    const player = roster.find((p) => p.id === sel.playerId);
    const type = INJURY_TYPES.find((t) => t.id === sel.typeId);

    // Nulls are how the optional rows opt out, so strip them before mounting.
    body.replaceChildren(...[
      el('h2', {}, 'Pick an injury'),
      el('p', { class: 'hint' }, `Week ${game.week} — ${game.away} at ${game.home}. Pick the guy and the injury; the engine picks the play it happens on.`),
      el('div', { class: 'row' },
        el('label', { class: 'field grow' }, 'Team',
          el('select', { onchange: (e) => { sel.teamId = e.target.value; sel.playerId = null; sel.preview = null; draw(); } },
            [game.away, game.home].map((id) => el('option', { value: id, selected: id === sel.teamId || null }, teamLabel(fr.teams.find((t) => t.id === id)))))),
        el('label', { class: 'field grow' }, 'Player',
          el('select', { onchange: (e) => { sel.playerId = e.target.value; sel.preview = null; draw(); } },
            roster.slice().sort((a, b) => a.pos.localeCompare(b.pos) || b.ovr - a.ovr).map((p) =>
              el('option', { value: p.id, selected: p.id === sel.playerId || null }, `${p.pos} · ${p.name} (${p.ovr} OVR)`))))),
      el('div', { class: 'row', style: 'margin-top:10px' },
        el('label', { class: 'field grow' }, 'Injury',
          el('select', { onchange: (e) => { sel.typeId = e.target.value; sel.preview = null; draw(); } },
            INJURY_TYPES.map((t) => el('option', { value: t.id, selected: t.id === sel.typeId || null }, `${t.name} — ${t.severity}`)))),
        el('label', { class: 'field' }, 'Quarter',
          el('select', { onchange: (e) => { sel.quarter = Number(e.target.value); sel.preview = null; draw(); } },
            el('option', { value: 0, selected: sel.quarter === 0 || null }, 'Random'),
            [1, 2, 3, 4].map((q) => el('option', { value: q, selected: sel.quarter === q || null }, `Q${q}`))))),
      el('p', { class: 'note', style: 'margin-top:10px' },
        `${type.severity} · typically ${type.weeksOut[0]}–${type.weeksOut[1]} weeks out · ${type.contact ? 'contact injury' : 'non-contact'}`),
      sel.preview ? el('div', { class: 'preview' }, sel.preview.description,
        el('div', { class: 'note', style: 'margin-top:8px' }, `Out ${sel.preview.weeksOut} weeks — back week ${sel.preview.returnWeek}.`)) : null,
      el('div', { class: 'row', style: 'margin-top:14px' },
        el('button', {
          class: 'btn ghost', disabled: !player || null,
          onclick: () => { sel.nonce++; sel.preview = resolveInjury({ franchise: fr, game, player, typeId: sel.typeId, forcedQuarter: sel.quarter || null, nonce: sel.nonce }); draw(); },
        }, sel.preview ? 'Roll a different play' : 'Roll the play'),
        el('button', {
          class: 'btn', disabled: !player || null,
          onclick: () => {
            const inj = sel.preview || resolveInjury({ franchise: fr, game, player, typeId: sel.typeId, forcedQuarter: sel.quarter || null, nonce: sel.nonce });
            scriptInjury(fr, inj);
            if (game.played) applyInjuriesForGame(fr, game);   // retro-script a game already played
            save(); closeModal(); render();
          },
        }, 'Script it'),
        el('button', { class: 'btn ghost', onclick: closeModal }, 'Cancel')),
      fr.injuries.filter((i) => i.gameId === game.id).length
        ? el('p', { class: 'note', style: 'margin-top:14px' },
          'Already on this game: ' + fr.injuries.filter((i) => i.gameId === game.id).map((i) => `${i.playerName} (${i.typeName})`).join(', '))
        : null,
    ].filter(Boolean));
  }

  draw();
  $('#modal').classList.remove('hidden');
}

const closeModal = () => $('#modal').classList.add('hidden');

/* ------------------------------------------------------------- game flow */

function playGame(game) {
  game.played = true;
  applyInjuriesForGame(state.fr, game);
  save();
  render();
}

function playWeek(week) {
  const fr = state.fr;
  for (const g of fr.schedule.filter((x) => x.week === week && !x.bye)) {
    if (!g.played) { g.played = true; applyInjuriesForGame(fr, g); }
  }
  advanceHealing(fr);
  fr.week = Math.min(18, week + 1);
  state.week = fr.week;
  save();
  render();
}

/* ------------------------------------------------------------------- files */

// In the desktop build this goes through a real Save dialog; in a browser it
// falls back to a download.
function download(name, data) {
  const text = JSON.stringify(data, null, 2);
  if (window.gcc && window.gcc.desktop) { window.gcc.saveFile(name, text); return; }
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const downloadInjuryScript = () => download('injury_script.json', exportInjuryScript(state.fr));

// Desktop gets the native dialog; the browser gets the file input.
async function chooseFile() {
  if (window.gcc && window.gcc.desktop) {
    const picked = await window.gcc.openFranchiseFile();
    if (picked) connect(picked.text, picked.name);
    return;
  }
  $('#fileInput').click();
}

function connect(text, name) {
  try {
    const { franchise, report } = importFranchise(text, name);
    state.fr = franchise;
    state.week = franchise.week;
    state.scope = 'season'; state.gameId = null;
    if (!franchise.rosters[state.team]) state.team = TEAMS[0].id;
    state.flash = report.notes.join(' ');
    save();
    state.view = 'dashboard';
  } catch (err) {
    state.flash = `Could not connect that file: ${err.message}`;
    state.view = 'file';
  }
  render();
}

function readFile(file) {
  const reader = new FileReader();
  reader.onload = () => connect(String(reader.result), file.name);
  reader.onerror = () => { state.flash = 'Could not read that file off disk.'; render(); };
  reader.readAsText(file);
}

/* ------------------------------------------------------------------ render */

const VIEWS = {
  dashboard: viewDashboard, schedule: viewSchedule, blocking: viewBlocking,
  snaps: viewSnaps, receiving: viewReceiving, defense: viewDefense,
  penalties: viewPenalties, injuries: viewInjuries, file: viewFile,
};

function render() {
  const fr = state.fr;
  $('#status').innerHTML = `Week <b>${fr.week}</b> · ${fr.injuries.filter((i) => i.status === 'scripted').length} scripted · ${playedGames().length} games played`;

  $('#tabs').replaceChildren(...TABS.map(([id, label]) =>
    el('button', { class: state.view === id ? 'on' : '', onclick: () => { state.view = id; render(); } }, label)));

  const out = VIEWS[state.view]();
  $('#app').replaceChildren(...[out].flat().filter(Boolean));
  window.scrollTo({ top: 0 });
}

/* -------------------------------------------------------------------- boot */

const restored = load();
state.extraDirs = readExtraDirs();
state.fr = restored || generateFranchise('demo-franchise');
// First launch on the desktop: open on the save list, not the demo league.
if (!restored && window.gcc && window.gcc.desktop) state.view = 'file';
state.week = state.fr.week;
if (!state.fr.rosters[state.team]) state.team = TEAMS[0].id;

$('#fileBtn').addEventListener('click', () => { state.view = 'file'; render(); });

// Desktop menu: Franchise ▸ Connect / Save / Export injury script.
if (window.gcc && window.gcc.onMenu) {
  window.gcc.onMenu((action) => {
    if (action === 'open') chooseFile();
    else if (action === 'save') download(`${state.fr.seedText}-controlcenter.json`, exportFranchise(state.fr));
    else if (action === 'injury-script') downloadInjuryScript();
  });
}
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' || e.target.dataset.close !== undefined) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

render();
