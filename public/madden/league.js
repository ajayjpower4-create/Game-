// The league model. Everything the Control Center shows is derived from this:
// a franchise (teams, rosters, schedule) plus a deterministic stat engine that
// expands any game into per-player snaps, blocking, receiving, defense and
// penalty lines. Deterministic means the same franchise file always produces
// the same numbers, so a user can close the app and come back to the same week.

/* ------------------------------------------------------------------ random */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const int = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
const round1 = (n) => Math.round(n * 10) / 10;

/* ------------------------------------------------------------------- teams */

export const TEAMS = [
  { id: 'ARI', city: 'Arizona', name: 'Cardinals', conf: 'NFC', div: 'West' },
  { id: 'ATL', city: 'Atlanta', name: 'Falcons', conf: 'NFC', div: 'South' },
  { id: 'BAL', city: 'Baltimore', name: 'Ravens', conf: 'AFC', div: 'North' },
  { id: 'BUF', city: 'Buffalo', name: 'Bills', conf: 'AFC', div: 'East' },
  { id: 'CAR', city: 'Carolina', name: 'Panthers', conf: 'NFC', div: 'South' },
  { id: 'CHI', city: 'Chicago', name: 'Bears', conf: 'NFC', div: 'North' },
  { id: 'CIN', city: 'Cincinnati', name: 'Bengals', conf: 'AFC', div: 'North' },
  { id: 'CLE', city: 'Cleveland', name: 'Browns', conf: 'AFC', div: 'North' },
  { id: 'DAL', city: 'Dallas', name: 'Cowboys', conf: 'NFC', div: 'East' },
  { id: 'DEN', city: 'Denver', name: 'Broncos', conf: 'AFC', div: 'West' },
  { id: 'DET', city: 'Detroit', name: 'Lions', conf: 'NFC', div: 'North' },
  { id: 'GB', city: 'Green Bay', name: 'Packers', conf: 'NFC', div: 'North' },
  { id: 'HOU', city: 'Houston', name: 'Texans', conf: 'AFC', div: 'South' },
  { id: 'IND', city: 'Indianapolis', name: 'Colts', conf: 'AFC', div: 'South' },
  { id: 'JAX', city: 'Jacksonville', name: 'Jaguars', conf: 'AFC', div: 'South' },
  { id: 'KC', city: 'Kansas City', name: 'Chiefs', conf: 'AFC', div: 'West' },
  { id: 'LV', city: 'Las Vegas', name: 'Raiders', conf: 'AFC', div: 'West' },
  { id: 'LAC', city: 'Los Angeles', name: 'Chargers', conf: 'AFC', div: 'West' },
  { id: 'LAR', city: 'Los Angeles', name: 'Rams', conf: 'NFC', div: 'West' },
  { id: 'MIA', city: 'Miami', name: 'Dolphins', conf: 'AFC', div: 'East' },
  { id: 'MIN', city: 'Minnesota', name: 'Vikings', conf: 'NFC', div: 'North' },
  { id: 'NE', city: 'New England', name: 'Patriots', conf: 'AFC', div: 'East' },
  { id: 'NO', city: 'New Orleans', name: 'Saints', conf: 'NFC', div: 'South' },
  { id: 'NYG', city: 'New York', name: 'Giants', conf: 'NFC', div: 'East' },
  { id: 'NYJ', city: 'New York', name: 'Jets', conf: 'AFC', div: 'East' },
  { id: 'PHI', city: 'Philadelphia', name: 'Eagles', conf: 'NFC', div: 'East' },
  { id: 'PIT', city: 'Pittsburgh', name: 'Steelers', conf: 'AFC', div: 'North' },
  { id: 'SF', city: 'San Francisco', name: 'Ers', conf: 'NFC', div: 'West' },
  { id: 'SEA', city: 'Seattle', name: 'Seahawks', conf: 'NFC', div: 'West' },
  { id: 'TB', city: 'Tampa Bay', name: 'Buccaneers', conf: 'NFC', div: 'South' },
  { id: 'TEN', city: 'Tennessee', name: 'Titans', conf: 'AFC', div: 'South' },
  { id: 'WAS', city: 'Washington', name: 'Commanders', conf: 'NFC', div: 'East' },
];

TEAMS.find((t) => t.id === 'SF').name = '49ers';

export const teamLabel = (t) => `${t.city} ${t.name}`;

/* ----------------------------------------------------------------- rosters */

const FIRST = ['Marcus','Jalen','Trey','Deshaun','Cooper','Malik','Tyrell','Bryce','Xavier','Damon','Isaiah','Corey','Jermaine','Rashad','Darius','Elijah','Grant','Hunter','Kendrick','Lamar','Micah','Nolan','Omar','Preston','Quentin','Rondell','Silas','Tavon','Ulysses','Vince','Wyatt','Zion','Braxton','Carlos','Dante','Evan','Finn','Gage','Hollis','Ibrahim','Jax','Kai','Levi','Moses','Nash','Otis','Pierce','Reese','Shane','Tobias'];
const LAST = ['Whitfield','Okafor','Brennan','Caldwell','Ramsey','Dunbar','Holloway','Vaughn','Castillo','Pruitt','McAllister','Sandoval','Tatum','Boone','Crenshaw','Dupree','Escobar','Fairchild','Gainey','Hargrove','Ingram','Jessup','Kirkland','Lockridge','Mabry','Nabors','Oglesby','Pettiford','Quarles','Rutherford','Stroud','Thibodeaux','Ulmer','Verrett','Wooten','Yancey','Zeller','Bledsoe','Chatman','Deveraux','Ellington','Fontenot','Guidry','Hasselback','Iverson','Jeudy','Kmet','Ledbetter','Mixon','Nwosu'];

// Position groups and how many of each a 53-man roster carries.
const ROSTER_PLAN = [
  ['QB', 3], ['RB', 4], ['FB', 1], ['WR', 6], ['TE', 4],
  ['LT', 2], ['LG', 2], ['C', 2], ['RG', 2], ['RT', 2],
  ['LE', 3], ['DT', 4], ['RE', 3], ['LOLB', 2], ['MLB', 3], ['ROLB', 2],
  ['CB', 6], ['FS', 2], ['SS', 2], ['K', 1], ['P', 1],
];

export const BLOCKER_POS = ['LT', 'LG', 'C', 'RG', 'RT', 'TE', 'FB', 'RB'];
export const PASS_CATCHER_POS = ['WR', 'TE', 'RB', 'FB'];
export const PASS_RUSH_POS = ['LE', 'RE', 'DT', 'LOLB', 'ROLB', 'MLB'];
export const DEFENSE_POS = ['LE', 'DT', 'RE', 'LOLB', 'MLB', 'ROLB', 'CB', 'FS', 'SS'];

function makePlayer(rng, team, pos, depth, idx) {
  const first = pick(rng, FIRST);
  const last = pick(rng, LAST);
  // Starters are better than backups; a handful of guys are stars.
  const base = 66 + Math.max(0, 16 - depth * 7) + int(rng, -4, 8);
  const ovr = Math.min(99, Math.max(52, base + (rng() < 0.06 ? int(rng, 6, 12) : 0)));
  return {
    id: `${team.id}-${pos}-${idx}`,
    name: `${first} ${last}`,
    first, last,
    pos,
    depth,
    team: team.id,
    ovr,
    age: int(rng, 21, 34),
    jersey: int(rng, 1, 99),
    // Durability drives how badly a scripted injury lingers.
    dur: int(rng, 55, 97),
    injury: null,
  };
}

function makeRoster(rng, team) {
  const players = [];
  let idx = 0;
  for (const [pos, count] of ROSTER_PLAN) {
    for (let d = 0; d < count; d++) players.push(makePlayer(rng, team, pos, d, idx++));
  }
  return players;
}

/* ---------------------------------------------------------------- schedule */

// 18 weeks, 17 games per team, one bye. Built by rotating the team list, which
// is not the real NFL formula but produces a clean, conflict-free slate.
function makeSchedule(rng) {
  const ids = TEAMS.map((t) => t.id);
  const games = [];
  let gid = 0;
  for (let week = 1; week <= 18; week++) {
    const rotated = ids.slice();
    // Circle method: fix the first team, rotate the rest.
    const head = rotated.shift();
    for (let r = 0; r < week - 1; r++) rotated.push(rotated.shift());
    const order = [head, ...rotated];
    const byeCount = week >= 5 && week <= 14 ? 2 : 0;
    const playing = order.slice(0, order.length - byeCount);
    const byes = order.slice(order.length - byeCount);
    for (let i = 0; i < playing.length / 2; i++) {
      const a = playing[i];
      const b = playing[playing.length - 1 - i];
      const homeFirst = (week + i) % 2 === 0;
      games.push({
        id: `W${week}-G${gid++}`,
        week,
        home: homeFirst ? a : b,
        away: homeFirst ? b : a,
        kickoff: pick(rng, ['Sun 1:00', 'Sun 4:05', 'Sun 4:25', 'Sun 8:20', 'Thu 8:15', 'Mon 8:15']),
        played: false,
      });
    }
    for (const id of byes) games.push({ id: `W${week}-BYE-${id}`, week, bye: id });
  }
  return games;
}

/* --------------------------------------------------------------- franchise */

export function generateFranchise(seedText = 'demo-franchise') {
  const seed = hash(seedText);
  const rng = mulberry32(seed);
  const teams = TEAMS.map((t) => ({ ...t }));
  const rosters = {};
  for (const t of teams) rosters[t.id] = makeRoster(rng, t);
  return {
    source: 'Generated demo franchise',
    seedText,
    seed,
    year: 2026,
    week: 1,
    teams,
    rosters,
    schedule: makeSchedule(rng),
    injuries: [],   // scripted injuries the user has queued
    log: [],        // what actually fired, in order
  };
}

/* ------------------------------------------------------------ stat engine */

const PENALTY_TYPES = [
  { name: 'False Start', yards: 5, pos: BLOCKER_POS },
  { name: 'Holding (Offense)', yards: 10, pos: BLOCKER_POS },
  { name: 'Illegal Block in the Back', yards: 10, pos: BLOCKER_POS },
  { name: 'Chop Block', yards: 15, pos: BLOCKER_POS },
  { name: 'Offensive Pass Interference', yards: 10, pos: PASS_CATCHER_POS },
  { name: 'Defensive Pass Interference', yards: 18, pos: ['CB', 'FS', 'SS'] },
  { name: 'Defensive Holding', yards: 5, pos: ['CB', 'FS', 'SS', 'MLB'] },
  { name: 'Illegal Contact', yards: 5, pos: ['CB'] },
  { name: 'Roughing the Passer', yards: 15, pos: PASS_RUSH_POS },
  { name: 'Offsides', yards: 5, pos: PASS_RUSH_POS },
  { name: 'Neutral Zone Infraction', yards: 5, pos: PASS_RUSH_POS },
  { name: 'Unnecessary Roughness', yards: 15, pos: DEFENSE_POS },
  { name: 'Face Mask', yards: 15, pos: DEFENSE_POS },
  { name: 'Taunting', yards: 15, pos: DEFENSE_POS },
];

const starters = (roster, pos, n = 1) =>
  roster.filter((p) => p.pos === pos && !isOut(p)).slice(0, n);

const isOut = (p) => p.injury && p.injury.gamesOut > 0;

// Everyone who takes meaningful offensive snaps, with a share of the snap pie.
function offensiveUnit(roster) {
  const line = ['LT', 'LG', 'C', 'RG', 'RT'].flatMap((pos) => starters(roster, pos, 1));
  const lineBackups = ['LT', 'LG', 'C', 'RG', 'RT'].flatMap((pos) =>
    roster.filter((p) => p.pos === pos && !isOut(p)).slice(1, 2));
  const qb = starters(roster, 'QB', 2);
  const rb = roster.filter((p) => p.pos === 'RB' && !isOut(p)).slice(0, 3);
  const fb = starters(roster, 'FB', 1);
  const wr = roster.filter((p) => p.pos === 'WR' && !isOut(p)).slice(0, 5);
  const te = roster.filter((p) => p.pos === 'TE' && !isOut(p)).slice(0, 3);
  return { line, lineBackups, qb, rb, fb, wr, te };
}

function defensiveUnit(roster) {
  const dl = ['LE', 'DT', 'RE'].flatMap((pos) =>
    roster.filter((p) => p.pos === pos && !isOut(p)).slice(0, pos === 'DT' ? 2 : 2));
  const lb = ['LOLB', 'MLB', 'ROLB'].flatMap((pos) =>
    roster.filter((p) => p.pos === pos && !isOut(p)).slice(0, 2));
  const cb = roster.filter((p) => p.pos === 'CB' && !isOut(p)).slice(0, 4);
  const saf = [...starters(roster, 'FS', 2), ...starters(roster, 'SS', 2)];
  return { dl, lb, cb, saf };
}

// Expand one matchup into a full box score. Pure function of the game id and
// the two rosters, so it can be recomputed any time instead of stored.
export function simulateGame(fr, game) {
  if (game.bye) return null;
  const rng = mulberry32(hash(fr.seedText + '|' + game.id));
  const sides = {};

  for (const side of ['home', 'away']) {
    const teamId = game[side];
    const roster = fr.rosters[teamId];
    const off = offensiveUnit(roster);
    const def = defensiveUnit(roster);
    const oppRoster = fr.rosters[game[side === 'home' ? 'away' : 'home']];
    const oppDef = defensiveUnit(oppRoster);

    const offSnaps = int(rng, 58, 74);
    const passPlays = Math.round(offSnaps * (0.52 + rng() * 0.16));
    const runPlays = offSnaps - passPlays;

    /* ---- snap counts ---- */
    const snaps = [];
    const addSnap = (p, count, unit) =>
      snaps.push({ player: p, count: Math.max(0, count), unit });

    off.line.forEach((p) => addSnap(p, offSnaps - int(rng, 0, 3), 'Offense'));
    off.lineBackups.forEach((p) => addSnap(p, int(rng, 0, 9), 'Offense'));
    off.qb.forEach((p, i) => addSnap(p, i === 0 ? offSnaps - int(rng, 0, 2) : int(rng, 0, 4), 'Offense'));
    off.rb.forEach((p, i) => addSnap(p, Math.round(offSnaps * ([0.58, 0.29, 0.12][i] || 0)), 'Offense'));
    off.fb.forEach((p) => addSnap(p, Math.round(offSnaps * 0.16), 'Offense'));
    off.wr.forEach((p, i) => addSnap(p, Math.round(offSnaps * ([0.9, 0.82, 0.61, 0.28, 0.11][i] || 0)), 'Offense'));
    off.te.forEach((p, i) => addSnap(p, Math.round(offSnaps * ([0.78, 0.4, 0.15][i] || 0)), 'Offense'));

    const defSnaps = int(rng, 58, 74);
    def.dl.forEach((p, i) => addSnap(p, Math.round(defSnaps * (i < 3 ? 0.78 - i * 0.05 : 0.42 - i * 0.04)), 'Defense'));
    def.lb.forEach((p, i) => addSnap(p, Math.round(defSnaps * (i < 3 ? 0.84 - i * 0.08 : 0.3)), 'Defense'));
    def.cb.forEach((p, i) => addSnap(p, Math.round(defSnaps * ([0.96, 0.93, 0.62, 0.22][i] || 0)), 'Defense'));
    def.saf.forEach((p, i) => addSnap(p, Math.round(defSnaps * ([0.95, 0.9, 0.35, 0.2][i] || 0)), 'Defense'));

    /* ---- blocking ---- */
    const blocking = [...off.line, ...off.te.slice(0, 2), ...off.rb.slice(0, 2), ...off.fb].map((p) => {
      const passSets = Math.round(passPlays * (BLOCKER_POS.indexOf(p.pos) < 5 ? 1 : 0.45));
      const skill = (p.ovr - 60) / 40;                       // 0 .. ~1
      const pressures = Math.max(0, Math.round(passSets * (0.11 - skill * 0.07) + rng() * 2));
      const sacksAllowed = rng() < 0.45 - skill * 0.25 ? int(rng, 1, 2) : 0;
      // "Almost sacks": the rusher beat him but the QB got it out or escaped.
      const almost = Math.max(0, Math.round(pressures * (0.5 + rng() * 0.5)) - sacksAllowed);
      const hurries = Math.max(0, pressures - sacksAllowed - Math.round(almost * 0.4));
      const pancakes = Math.round(runPlays * (0.06 + skill * 0.14) + rng() * 2);
      const blown = Math.max(0, Math.round((1 - skill) * 4 * rng()));
      const holdSeconds = round1(2.1 + skill * 1.6 + rng() * 0.6);
      const reps = Math.max(1, passSets + Math.round(runPlays * 0.9));
      const winRate = Math.max(45, Math.min(99, Math.round(100 - ((pressures + blown) / reps) * 100 * 2.1)));
      return { player: p, passSets, reps, pressures, sacksAllowed, almost, hurries, pancakes, blown, holdSeconds, winRate };
    });

    /* ---- receiving ---- */
    const receivers = [...off.wr, ...off.te.slice(0, 2), ...off.rb.slice(0, 2)];
    const weights = receivers.map((p, i) => Math.max(0.3, (p.ovr / 80) * (1 / (1 + i * 0.5))));
    const wsum = weights.reduce((a, b) => a + b, 0);
    const receiving = receivers.map((p, i) => {
      const targets = Math.max(0, Math.round((passPlays * 0.92) * (weights[i] / wsum)));
      const catchSkill = 0.56 + (p.ovr - 60) / 150;
      const catches = Math.min(targets, Math.round(targets * (catchSkill + rng() * 0.12)));
      const catchable = Math.max(catches, Math.round(targets * (0.72 + rng() * 0.1)));
      const drops = Math.max(0, catchable - catches);
      const yards = catches ? Math.round(catches * (6 + rng() * 9)) : 0;
      const contested = Math.round(targets * (0.15 + rng() * 0.2));
      const tds = rng() < 0.22 + (p.ovr - 70) / 200 ? int(rng, 1, 2) : 0;
      const yac = Math.round(yards * (0.25 + rng() * 0.35));
      return { player: p, targets, catches, drops, yards, yac, contested, tds };
    });

    /* ---- defense ---- */
    const defenders = [...def.dl, ...def.lb, ...def.cb, ...def.saf];
    const defense = defenders.map((p) => {
      const skill = (p.ovr - 60) / 40;
      const rusher = PASS_RUSH_POS.includes(p.pos);
      const pressures = rusher ? Math.max(0, Math.round(passPlays * (0.05 + skill * 0.1) + rng() * 2)) : int(rng, 0, 1);
      const sacks = rusher && rng() < 0.35 + skill * 0.3 ? int(rng, 1, 2) : 0;
      // "Missed sack": had the QB dead to rights and let him off the hook.
      const missedSacks = Math.max(0, Math.round(pressures * (0.18 + (1 - skill) * 0.22) * rng() * 2));
      const qbHits = sacks + Math.round(pressures * 0.4);
      const tacklesAtt = Math.round((rusher ? 5 : 7) * (0.6 + rng() * 0.9));
      const missedTackles = Math.max(0, Math.round(tacklesAtt * (0.16 + (1 - skill) * 0.2) * rng() * 1.6));
      const tackles = Math.max(0, tacklesAtt - missedTackles);
      const tfl = rng() < 0.3 ? int(rng, 1, 2) : 0;
      const pbu = ['CB', 'FS', 'SS'].includes(p.pos) && rng() < 0.5 ? int(rng, 1, 3) : 0;
      const ints = rng() < 0.08 + skill * 0.06 ? 1 : 0;
      return { player: p, pressures, sacks, missedSacks, qbHits, tackles, missedTackles, tacklesAtt, tfl, pbu, ints };
    });

    /* ---- penalties ---- */
    const pool = [...off.line, ...off.wr, ...off.te, ...defenders];
    const flagCount = int(rng, 3, 11);
    const penalties = [];
    for (let i = 0; i < flagCount; i++) {
      const type = pick(rng, PENALTY_TYPES);
      const eligible = pool.filter((p) => type.pos.includes(p.pos));
      if (!eligible.length) continue;
      const p = pick(rng, eligible);
      const declined = rng() < 0.12;
      penalties.push({
        player: p,
        type: type.name,
        yards: declined ? 0 : type.yards,
        declined,
        quarter: int(rng, 1, 4),
        drive: int(rng, 1, 12),
      });
    }

    const score = 10 + Math.round(receiving.reduce((a, r) => a + r.tds, 0) * 7 + int(rng, -3, 10));

    sides[side] = { teamId, offSnaps, defSnaps, passPlays, runPlays, snaps, blocking, receiving, defense, penalties, score, oppDef };
  }

  return { game, ...sides };
}

/* --------------------------------------------------------- aggregation */

// Roll every played game up into season totals for one team (or the league).
export function seasonTotals(fr, teamId, throughWeek) {
  const acc = { snaps: new Map(), blocking: new Map(), receiving: new Map(), defense: new Map(), penalties: new Map() };
  const bump = (map, p, fields) => {
    const key = p.id;
    if (!map.has(key)) map.set(key, { player: p, games: 0, ...Object.fromEntries(Object.keys(fields).map((k) => [k, 0])) });
    const row = map.get(key);
    row.games++;
    for (const [k, v] of Object.entries(fields)) row[k] = (row[k] || 0) + v;
    return row;
  };

  for (const g of fr.schedule) {
    if (g.bye || !g.played) continue;
    if (throughWeek && g.week > throughWeek) continue;
    if (teamId && g.home !== teamId && g.away !== teamId) continue;
    const box = simulateGame(fr, g);
    if (!box) continue;
    for (const side of ['home', 'away']) {
      const s = box[side];
      if (teamId && s.teamId !== teamId) continue;
      s.snaps.forEach((r) => bump(acc.snaps, r.player, { count: r.count, [r.unit === 'Offense' ? 'off' : 'def']: r.count }));
      s.blocking.forEach((r) => bump(acc.blocking, r.player, {
        pressures: r.pressures, sacksAllowed: r.sacksAllowed, almost: r.almost, hurries: r.hurries,
        pancakes: r.pancakes, blown: r.blown, reps: r.reps, holdSum: r.holdSeconds, winSum: r.winRate,
      }));
      s.receiving.forEach((r) => bump(acc.receiving, r.player, {
        targets: r.targets, catches: r.catches, drops: r.drops, yards: r.yards, yac: r.yac, contested: r.contested, tds: r.tds,
      }));
      s.defense.forEach((r) => bump(acc.defense, r.player, {
        pressures: r.pressures, sacks: r.sacks, missedSacks: r.missedSacks, qbHits: r.qbHits,
        tackles: r.tackles, missedTackles: r.missedTackles, tacklesAtt: r.tacklesAtt, tfl: r.tfl, pbu: r.pbu, ints: r.ints,
      }));
      s.penalties.forEach((r) => bump(acc.penalties, r.player, { flags: r.declined ? 0 : 1, yards: r.yards, declined: r.declined ? 1 : 0 }));
    }
  }

  const out = {};
  for (const [k, map] of Object.entries(acc)) out[k] = [...map.values()];
  for (const row of out.blocking) {
    row.holdSeconds = row.games ? round1(row.holdSum / row.games) : 0;
    row.winRate = row.games ? Math.round(row.winSum / row.games) : 0;
  }
  for (const row of out.receiving) {
    row.catchRate = row.targets ? Math.round((row.catches / row.targets) * 100) : 0;
    row.dropRate = row.targets ? round1((row.drops / row.targets) * 100) : 0;
  }
  for (const row of out.defense) {
    row.missRate = row.tacklesAtt ? round1((row.missedTackles / row.tacklesAtt) * 100) : 0;
    row.sackConv = row.sacks + row.missedSacks ? Math.round((row.sacks / (row.sacks + row.missedSacks)) * 100) : 0;
  }
  return out;
}

export { round1, int, pick };
