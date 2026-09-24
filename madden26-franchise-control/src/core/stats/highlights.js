// Highlights and lowlights for one game, as text.
//
// Three sources, marked on every item so it is clear what is fact:
//   play-by-play  the game's own key-play log (franchise files): every
//                 touchdown with its length, every field goal with its
//                 distance, every sack, interception and fumble recovery, each
//                 with the quarter and clock
//   box score     recorded stat lines (both franchise files and EA exports):
//                 big passing, rushing and receiving days, longest plays,
//                 turnovers, drops, missed kicks, penalties, red-zone trips
//   reconstructed moments that lean on this tool's rebuilt numbers (sacks
//                 charged to a blocker, missed tackles, a player's penalties)
//
// Scoring comes from the game's scoring timeline, which also tells us which
// scores took the lead, tied it, or won it, which conversions failed, and
// which team blew a lead.

import { makeRng } from '../rng.js';
import { getInjuryType } from '../franchise/injury-catalog.js';

const TD_POINTS = 6;
const FG_POINTS = 3;

export function clockText(quarter, clockSec) {
  if (!Number.isFinite(quarter) || quarter <= 0) return '';
  const q = quarter > 4 ? 'OT' : `Q${quarter}`;
  if (!Number.isFinite(clockSec)) return q;
  const s = Math.max(0, Math.round(clockSec));
  return `${q} ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// Chronological order: earlier quarter first, more time left first.
function chrono(a, b) {
  return (a.quarter || 0) - (b.quarter || 0) || (b.clockSec ?? 0) - (a.clockSec ?? 0);
}

// Turn the entry-by-entry scoreboard into scoring events. EA writes a
// touchdown's conversion into the next entry, so a team's change at an entry
// is (conversion of its last touchdown) + (whatever it just scored).
export function buildScoringEvents(game, gamePlays) {
  const entries = (gamePlays && gamePlays.scoring) || [];
  const plays = (gamePlays && gamePlays.plays) || [];
  const sides = { home: game.homeTeamId, away: game.awayTeamId };
  const prev = { home: 0, away: 0 };
  const pending = { home: null, away: null };
  const events = [];

  const matchPlay = (teamId, quarter, clockSec) =>
    plays.find((p) => p.teamId === teamId && p.quarter === quarter && Math.abs(p.clockSec - clockSec) <= 3 && ['tdPass', 'tdRun', 'fieldGoal'].includes(p.type));

  for (const e of entries) {
    const after = { home: e.homeAfter, away: e.awayAfter };
    for (const side of ['home', 'away']) {
      let delta = after[side] - prev[side];
      if (delta < 0) delta = 0;
      const teamId = sides[side];
      const play = delta > 0 ? matchPlay(teamId, e.quarter, e.clockSec) : null;
      let fresh = 0;
      let kind = null;
      let conv = 0; // points in this entry that finish an earlier touchdown
      if (play) {
        kind = play.type === 'fieldGoal' ? 'FG' : 'TD';
        fresh = kind === 'FG' ? FG_POINTS : TD_POINTS;
      }
      if (pending[side]) {
        if (play) conv = delta - fresh;
        else if (delta >= TD_POINTS) { kind = 'TD'; fresh = TD_POINTS; conv = delta - TD_POINTS; }
        else if (delta >= FG_POINTS) { kind = 'FG'; fresh = FG_POINTS; conv = delta - FG_POINTS; }
        else conv = delta;
        conv = Math.max(0, Math.min(2, conv));
        pending[side].conversion = conv;
        pending[side] = null;
      } else if (!play && delta > 0) {
        if (delta >= TD_POINTS) { kind = 'TD'; fresh = TD_POINTS; }
        else if (delta >= FG_POINTS) { kind = 'FG'; fresh = FG_POINTS; }
        else if (delta === 2) { kind = 'SAF'; fresh = 2; }
      }
      if (kind) {
        const ev = { teamId, side, kind, points: fresh, quarter: e.quarter, clockSec: e.clockSec, play: play || null, conversion: null };
        // Whatever is left over is this touchdown's own conversion, written
        // into the same entry; otherwise it arrives with the next entry.
        const leftover = delta - fresh - conv;
        if (kind === 'TD') {
          if (leftover > 0) ev.conversion = Math.min(2, leftover);
          else pending[side] = ev;
        }
        events.push(ev);
      }
    }
    prev.home = after.home;
    prev.away = after.away;
  }
  // The last touchdown's conversion shows up only in the final score.
  const final = { home: game.homeScore, away: game.awayScore };
  for (const side of ['home', 'away']) if (pending[side]) pending[side].conversion = Math.max(0, Math.min(2, final[side] - prev[side]));

  // Running score after each event, with its conversion.
  const running = { home: 0, away: 0 };
  let leader = null;
  for (const ev of events) {
    const other = ev.side === 'home' ? 'away' : 'home';
    const before = running[ev.side] - running[other];
    running[ev.side] += ev.points + (ev.conversion || 0);
    const after = running[ev.side] - running[other];
    ev.scoreAfter = { home: running.home, away: running.away };
    ev.marginBefore = before;
    ev.marginAfter = after;
    ev.tookLead = before <= 0 && after > 0;
    ev.tied = before < 0 && after === 0;
    if (after > 0) leader = ev.side;
    else if (after === 0) leader = null;
  }
  // Game-winner: the winning team's last go-ahead score, after which it never
  // gave the lead back. Only worth the name when it came late or the game was
  // close; the first touchdown of a blowout is not a game-winner.
  const winnerSide = final.home > final.away ? 'home' : final.away > final.home ? 'away' : null;
  if (winnerSide) {
    for (let i = events.length - 1; i >= 0; i--) {
      const ev = events[i];
      if (ev.side === winnerSide && ev.tookLead) {
        const close = Math.abs(final.home - final.away) <= 7;
        if (ev.quarter >= 4 || (ev.quarter === 3 && close)) ev.gameWinner = true;
        else ev.leadForGood = true; // decided it early: the lead it never gave back
        break;
      }
    }
  }
  return events;
}

// "an 11-point lead", "an 8-yard run", "a 12-yard catch"
export function article(n) {
  const s = String(n);
  return /^(8|11|18|8\d)$/.test(s) || /^8\d\d/.test(s) ? 'an' : 'a';
}

function ordinal(n) {
  return ['', 'first', 'second', 'third', 'fourth', 'fifth'][n] || `${n}th`;
}

// Largest deficit each team faced, from the running score.
function biggestDeficits(events) {
  const worst = { home: 0, away: 0 };
  for (const ev of events) {
    const m = ev.scoreAfter.home - ev.scoreAfter.away;
    worst.home = Math.max(worst.home, -m);
    worst.away = Math.max(worst.away, m);
  }
  return worst;
}

const VERB = {
  tdPass: ['hits', 'finds', 'connects with', 'lofts it to'],
  tdRun: ['punches it in', 'walks in', 'powers in'],
  longRun: ['breaks free for', 'rips off', 'takes it the distance for'],
  sack: ['sacks', 'brings down', 'gets home on'],
  int: ['picks off', 'intercepts', 'jumps the route on'],
};

export function highlightsForGame(league, gameId, result) {
  const game = league.games[gameId];
  if (!game || game.status !== 'played') return null;
  const rng = makeRng('highlights', league.leagueId, gameId);
  const pick = (list) => list[Math.floor(rng.next() * list.length)];
  const teamOf = (id) => league.teams[id] || { abbr: '?', displayName: '?', nick: '?' };
  const nameOf = (person) => (person ? person.name : 'An unnamed player');
  const playerName = (pid) => (league.players[pid] ? league.players[pid].fullName : 'Unknown player');
  const playerPos = (pid) => (league.players[pid] ? league.players[pid].position : '');
  const other = (teamId) => (teamId === game.homeTeamId ? game.awayTeamId : game.homeTeamId);
  const winner = game.homeScore > game.awayScore ? game.homeTeamId : game.awayScore > game.homeScore ? game.awayTeamId : null;
  const loser = winner ? other(winner) : null;
  const margin = Math.abs(game.homeScore - game.awayScore);
  const gp = (league.gamePlays && league.gamePlays[gameId]) || null;
  const hasPbp = Boolean(gp && gp.plays && gp.plays.length);
  const events = gp ? buildScoringEvents(game, gp) : [];
  const moments = [];
  let seq = 0;

  const add = (m) => {
    moments.push({ id: `${gameId}-${seq++}`, gameId, tags: [], playerIds: [], ...m, clock: clockText(m.quarter, m.clockSec), impact: Math.round(Math.max(1, Math.min(100, m.impact))) });
  };
  const leverage = (quarter, clockSec, ev) => {
    let bonus = 0;
    const tags = [];
    if (quarter >= 4) { bonus += 8; }
    if (quarter >= 4 && clockSec <= 120) { bonus += 6; tags.push('final two minutes'); }
    if (quarter === 2 && clockSec <= 60) bonus += 3;
    if (quarter > 4) { bonus += 10; tags.push('overtime'); }
    if (ev) {
      if (ev.gameWinner) { bonus += 22; tags.push('game-winner'); }
      else if (ev.leadForGood) { bonus += 14; tags.push('go-ahead', 'lead for good'); }
      else if (ev.tookLead) { bonus += 10; tags.push('go-ahead'); }
      else if (ev.tied) { bonus += 8; tags.push('tying score'); }
    }
    return { bonus, tags };
  };
  const eventFor = (teamId, quarter, clockSec) => events.find((ev) => ev.teamId === teamId && ev.quarter === quarter && Math.abs(ev.clockSec - clockSec) <= 3);
  const scoreLine = (ev) => (ev ? ` (${teamOf(game.awayTeamId).abbr} ${ev.scoreAfter.away}, ${teamOf(game.homeTeamId).abbr} ${ev.scoreAfter.home})` : '');

  // ---------------- play-by-play moments
  const coveredLongest = new Set(); // playerId|kind already described by a real play
  if (hasPbp) {
    const plays = gp.plays.slice().sort(chrono);
    // The log's own per-player counter is not reliable, so count here.
    const tally = new Map();
    const nth = (p) => {
      const key = `${p.type}|${p.primary ? p.primary.name : '?'}`;
      const n = (tally.get(key) || 0) + 1;
      tally.set(key, n);
      return n;
    };
    for (const p of plays) {
      p.count = nth(p);
      // Only scoring plays carry the score's leverage; a sack two seconds after
      // a field goal is not the game-winner.
      const scoring = ['tdPass', 'tdRun', 'fieldGoal'].includes(p.type);
      const ev = scoring ? eventFor(p.teamId, p.quarter, p.clockSec) : null;
      const lev = leverage(p.quarter, p.clockSec, ev);
      const who = nameOf(p.primary);
      const whoId = p.primary && p.primary.playerId;
      const vsId = p.secondary && p.secondary.playerId;
      const team = teamOf(p.teamId);
      if (p.type === 'tdPass') {
        const yds = Math.max(1, p.yards);
        if (vsId) coveredLongest.add(`${vsId}|rec|${yds}`);
        if (whoId) coveredLongest.add(`${whoId}|pass|${yds}`);
        add({ kind: 'highlight', type: 'Touchdown pass', teamId: p.teamId, quarter: p.quarter, clockSec: p.clockSec, playerIds: [whoId, vsId].filter(Boolean), impact: 38 + yds * 0.55 + lev.bonus, tags: lev.tags, source: 'play-by-play', text: `${who} ${pick(VERB.tdPass)} ${nameOf(p.secondary)} for ${article(yds)} ${yds}-yard touchdown${lev.tags.includes('game-winner') ? ' to win it' : lev.tags.includes('go-ahead') ? ' to take the lead' : lev.tags.includes('tying score') ? ' to tie it' : ''}${scoreLine(ev)}.` });
      } else if (p.type === 'tdRun') {
        const yds = Math.max(1, p.yards);
        if (whoId) coveredLongest.add(`${whoId}|rush|${yds}`);
        const text = yds >= 20
          ? `${who} ${pick(VERB.longRun)} ${article(yds)} ${yds}-yard touchdown run`
          : `${who} ${pick(VERB.tdRun)} from ${yds === 1 ? '1 yard' : `${yds} yards`} out`;
        add({ kind: 'highlight', type: 'Touchdown run', teamId: p.teamId, quarter: p.quarter, clockSec: p.clockSec, playerIds: [whoId].filter(Boolean), impact: 38 + yds * 0.6 + lev.bonus, tags: lev.tags, source: 'play-by-play', text: `${text}${lev.tags.includes('game-winner') ? ' for the winning score' : lev.tags.includes('go-ahead') ? ' to put ' + team.abbr + ' in front' : ''}${scoreLine(ev)}.` });
      } else if (p.type === 'fieldGoal') {
        const yds = Math.max(18, p.yards);
        const big = yds >= 50;
        if (!big && !ev?.gameWinner && !ev?.tookLead && !ev?.tied) continue; // routine kicks are not highlights
        add({ kind: 'highlight', type: 'Field goal', teamId: p.teamId, quarter: p.quarter, clockSec: p.clockSec, playerIds: [whoId].filter(Boolean), impact: 14 + Math.max(0, yds - 40) * 2.2 + lev.bonus, tags: lev.tags, source: 'play-by-play', text: `${who} ${big ? 'drills' : 'knocks through'} ${article(yds)} ${yds}-yard field goal${lev.tags.includes('game-winner') ? ' to win it' : lev.tags.includes('go-ahead') ? ' for the lead' : lev.tags.includes('tying score') ? ' to tie it' : ''}${scoreLine(ev)}.` });
      } else if (p.type === 'sack') {
        const qb = nameOf(p.secondary);
        const blame = result && result.teams[other(p.teamId)] ? (result.teams[other(p.teamId)].blocking.sackBlame || {})[whoId] : null;
        const beat = blame && blame.length ? ` beats ${blame[0].position} ${blame[0].name} and` : '';
        const nthText = p.count >= 2 ? ` (his ${ordinal(p.count)} of the game)` : '';
        add({ kind: 'highlight', type: 'Sack', teamId: p.teamId, quarter: p.quarter, clockSec: p.clockSec, playerIds: [whoId, vsId].filter(Boolean), impact: 20 + (p.count >= 2 ? 6 : 0) + lev.bonus, tags: lev.tags, source: blame && blame.length ? 'play-by-play + reconstructed' : 'play-by-play', text: `${who}${beat} ${pick(VERB.sack)} ${qb}${nthText}.` });
        add({ kind: 'lowlight', type: 'Sacked', teamId: other(p.teamId), quarter: p.quarter, clockSec: p.clockSec, playerIds: [vsId, ...(blame || []).map((b) => b.playerId)].filter(Boolean), impact: 14 + lev.bonus, tags: lev.tags, source: blame && blame.length ? 'play-by-play + reconstructed' : 'play-by-play', text: `${qb} goes down for a sack by ${who}${blame && blame.length ? `; ${blame[0].name} was the one beaten` : ''}.` });
      } else if (p.type === 'intMade') {
        // A defensive score at the same moment makes it a pick-six.
        const six = events.find((e) => e.teamId === p.teamId && e.kind === 'TD' && e.quarter === p.quarter && Math.abs(e.clockSec - p.clockSec) <= 6 && !e.play);
        const bonus = six ? 30 : 0;
        const lev2 = leverage(p.quarter, p.clockSec, six || null);
        add({ kind: 'highlight', type: six ? 'Pick-six' : 'Interception', teamId: p.teamId, quarter: p.quarter, clockSec: p.clockSec, playerIds: [whoId, vsId].filter(Boolean), impact: 42 + bonus + lev2.bonus, tags: lev2.tags, source: 'play-by-play', text: `${who} ${pick(VERB.int)} ${nameOf(p.secondary)}${six ? ' and takes it back for a touchdown' : ''}${p.count >= 2 ? `, his ${ordinal(p.count)} pick of the day` : ''}.` });
      } else if (p.type === 'intThrown') {
        const late = p.quarter >= 4 && p.teamId === loser && margin <= 8;
        add({ kind: 'lowlight', type: 'Interception thrown', teamId: p.teamId, quarter: p.quarter, clockSec: p.clockSec, playerIds: [whoId, vsId].filter(Boolean), impact: 32 + (late ? 20 : 0) + lev.bonus, tags: late ? [...lev.tags, 'costly'] : lev.tags, source: 'play-by-play', text: `${who} throws ${p.count >= 2 ? `his ${ordinal(p.count)} interception` : 'an interception'}, picked by ${nameOf(p.secondary)}${late ? ' with the game on the line' : ''}.` });
      } else if (p.type === 'fumbleRecovery') {
        add({ kind: 'highlight', type: 'Fumble recovery', teamId: p.teamId, quarter: p.quarter, clockSec: p.clockSec, playerIds: [whoId].filter(Boolean), impact: 36 + lev.bonus, tags: lev.tags, source: 'play-by-play', text: `${who} comes up with a fumble for ${team.abbr}.` });
        add({ kind: 'lowlight', type: 'Fumble lost', teamId: other(p.teamId), quarter: p.quarter, clockSec: p.clockSec, playerIds: [], impact: 30 + lev.bonus, tags: lev.tags, source: 'play-by-play', text: `${teamOf(other(p.teamId)).abbr} puts it on the ground and ${who} recovers.` });
      }
    }

    // Scores with no matching play: return and defensive touchdowns, safeties.
    for (const ev of events) {
      if (ev.play) continue;
      const pickSix = gp.plays.some((p) => p.type === 'intMade' && p.teamId === ev.teamId && p.quarter === ev.quarter && Math.abs(p.clockSec - ev.clockSec) <= 6);
      if (pickSix) continue;
      const lev = leverage(ev.quarter, ev.clockSec, ev);
      if (ev.kind === 'TD') add({ kind: 'highlight', type: 'Return or defensive touchdown', teamId: ev.teamId, quarter: ev.quarter, clockSec: ev.clockSec, impact: 55 + lev.bonus, tags: lev.tags, source: 'play-by-play', text: `${teamOf(ev.teamId).abbr} scores a touchdown without its offense on the field${scoreLine(ev)}.` });
      else if (ev.kind === 'SAF') add({ kind: 'highlight', type: 'Safety', teamId: ev.teamId, quarter: ev.quarter, clockSec: ev.clockSec, impact: 45 + lev.bonus, tags: lev.tags, source: 'play-by-play', text: `${teamOf(ev.teamId).abbr} traps the ball carrier in the end zone for a safety${scoreLine(ev)}.` });
    }

    // Conversions that failed.
    for (const ev of events) {
      if (ev.kind !== 'TD' || ev.conversion !== 0) continue;
      const decisive = ev.teamId === loser && margin <= 1;
      add({ kind: 'lowlight', type: 'Failed conversion', teamId: ev.teamId, quarter: ev.quarter, clockSec: ev.clockSec, impact: 20 + (decisive ? 30 : 0) + (ev.quarter >= 4 ? 6 : 0), tags: decisive ? ['cost the game'] : [], source: 'play-by-play', text: `${teamOf(ev.teamId).abbr} fails on the try after its ${clockText(ev.quarter, ev.clockSec)} touchdown${decisive ? ', and that point was the difference' : ''}.` });
    }

    // Comebacks and blown leads.
    if (winner && events.length) {
      const worst = biggestDeficits(events);
      const winSide = winner === game.homeTeamId ? 'home' : 'away';
      const deficit = worst[winSide];
      if (deficit >= 8) {
        add({ kind: 'highlight', type: 'Comeback', teamId: winner, impact: 45 + deficit * 2, tags: ['comeback'], source: 'play-by-play', text: `${teamOf(winner).displayName} came back from ${deficit} points down to win ${Math.max(game.homeScore, game.awayScore)}-${Math.min(game.homeScore, game.awayScore)}.` });
        add({ kind: 'lowlight', type: 'Blown lead', teamId: loser, impact: 45 + deficit * 2, tags: ['blown lead'], source: 'play-by-play', text: `${teamOf(loser).displayName} let ${article(deficit)} ${deficit}-point lead get away.` });
      } else {
        const lateLead = events.some((ev) => ev.quarter >= 4 && ev.teamId === loser && ev.marginAfter > 0);
        if (lateLead) add({ kind: 'lowlight', type: 'Late collapse', teamId: loser, impact: 40, tags: ['blown lead'], source: 'play-by-play', text: `${teamOf(loser).displayName} led in the fourth quarter and lost.` });
      }
    }
  }

  // ---------------- box-score moments (every source)
  const lines = league.playerGameStats[gameId] || {};
  const teamLines = league.teamGameStats[gameId] || {};
  const pogCandidates = [];
  for (const entry of Object.values(lines)) {
    const pid = entry.playerId;
    const teamId = entry.teamId || (league.players[pid] || {}).teamId;
    if (!teamId) continue;
    const name = playerName(pid);
    const pos = playerPos(pid);
    const o = entry.offense || {};
    const d = entry.defense || {};
    const k = entry.kicking || {};
    let gameScore = 0;
    if (o.PASSATTEMPTS) {
      gameScore += o.PASSYARDS / 25 + o.PASSTDS * 4 - o.PASSINTS * 3;
      if (o.PASSYARDS >= 300 || o.PASSTDS >= 3) add({ kind: 'highlight', type: 'Big passing day', teamId, playerIds: [pid], impact: 26 + Math.max(0, o.PASSYARDS - 250) / 6 + o.PASSTDS * 5, source: 'box score', text: `${name} throws for ${o.PASSYARDS} yards and ${o.PASSTDS} touchdown${o.PASSTDS === 1 ? '' : 's'} (${o.PASSCOMPLETED}/${o.PASSATTEMPTS}).` });
      if (o.PASSATTEMPTS >= 15 && o.PASSCOMPLETED / o.PASSATTEMPTS < 0.5) add({ kind: 'lowlight', type: 'Rough day passing', teamId, playerIds: [pid], impact: 24 + (0.5 - o.PASSCOMPLETED / o.PASSATTEMPTS) * 80, source: 'box score', text: `${name} completes only ${o.PASSCOMPLETED} of ${o.PASSATTEMPTS} passes.` });
      if (!hasPbp && o.PASSINTS >= 1) add({ kind: 'lowlight', type: 'Interceptions thrown', teamId, playerIds: [pid], impact: 26 + o.PASSINTS * 12, source: 'box score', text: `${name} throws ${o.PASSINTS} interception${o.PASSINTS === 1 ? '' : 's'}.` });
      if (hasPbp && o.PASSINTS >= 3) add({ kind: 'lowlight', type: 'Turnover machine', teamId, playerIds: [pid], impact: 50, source: 'box score', text: `${name} gives it away ${o.PASSINTS} times through the air.` });
      if (o.PASSSACKED >= 4) add({ kind: 'lowlight', type: 'Under siege', teamId, playerIds: [pid], impact: 22 + o.PASSSACKED * 3, source: 'box score', text: `${name} is sacked ${o.PASSSACKED} times.` });
    }
    if (o.RUSHATTEMPTS) {
      gameScore += o.RUSHYARDS / 10 + o.RUSHTDS * 6 - (o.RUSHFUMBLES || 0) * 3;
      if (o.RUSHYARDS >= 100) add({ kind: 'highlight', type: '100-yard rusher', teamId, playerIds: [pid], impact: 26 + (o.RUSHYARDS - 100) / 4 + o.RUSHTDS * 4, source: 'box score', text: `${name} runs for ${o.RUSHYARDS} yards on ${o.RUSHATTEMPTS} carries${o.RUSHTDS ? ` with ${o.RUSHTDS} touchdown${o.RUSHTDS === 1 ? '' : 's'}` : ''}.` });
      const long = o.RUSHLONGEST || 0;
      if (long >= 35 && !coveredLongest.has(`${pid}|rush|${long}`) && ![long - 1, long + 1].some((y) => coveredLongest.has(`${pid}|rush|${y}`))) add({ kind: 'highlight', type: 'Long run', teamId, playerIds: [pid], impact: 22 + (long - 35) * 0.6, source: 'box score', text: `${name} breaks off ${article(long)} ${long}-yard run.` });
      if (o.RUSHFUMBLES >= 1 && !hasPbp) add({ kind: 'lowlight', type: 'Fumble', teamId, playerIds: [pid], impact: 26 + o.RUSHFUMBLES * 8, source: 'box score', text: `${name} fumbles ${o.RUSHFUMBLES === 1 ? 'once' : `${o.RUSHFUMBLES} times`}.` });
      if (o.RUSHATTEMPTS >= 12 && o.RUSHYARDS / o.RUSHATTEMPTS < 2.5) add({ kind: 'lowlight', type: 'Bottled up', teamId, playerIds: [pid], impact: 18, source: 'box score', text: `${name} manages ${o.RUSHYARDS} yards on ${o.RUSHATTEMPTS} carries.` });
    }
    if (o.RECEIVECATCHES || o.RECEIVEDROPS) {
      gameScore += (o.RECEIVEYARDS || 0) / 10 + (o.RECEIVETDS || 0) * 6 - (o.RECEIVEDROPS || 0) * 1.5;
      if (o.RECEIVEYARDS >= 100) add({ kind: 'highlight', type: '100-yard receiver', teamId, playerIds: [pid], impact: 26 + (o.RECEIVEYARDS - 100) / 4 + (o.RECEIVETDS || 0) * 4, source: 'box score', text: `${name} catches ${o.RECEIVECATCHES} balls for ${o.RECEIVEYARDS} yards${o.RECEIVETDS ? ` and ${o.RECEIVETDS} touchdown${o.RECEIVETDS === 1 ? '' : 's'}` : ''}.` });
      const long = o.RECEIVELONGEST || 0;
      if (long >= 40 && !coveredLongest.has(`${pid}|rec|${long}`) && ![long - 1, long + 1].some((y) => coveredLongest.has(`${pid}|rec|${y}`))) add({ kind: 'highlight', type: 'Deep catch', teamId, playerIds: [pid], impact: 22 + (long - 40) * 0.55, source: 'box score', text: `${name} hauls in ${article(long)} ${long}-yard catch.` });
      if (o.RECEIVEDROPS >= 2) add({ kind: 'lowlight', type: 'Drops', teamId, playerIds: [pid], impact: 18 + (o.RECEIVEDROPS - 2) * 7, source: 'box score', text: `${name} drops ${o.RECEIVEDROPS} passes.` });
    }
    if (d.DEFTACKLES || d.DLINESACKS || d.DSECINTS) {
      gameScore += (d.DLINESACKS || 0) * 3 + (d.DSECINTS || 0) * 4 + (d.DLINEFORCEDFUMBLES || 0) * 3 + (d.DEFTACKLES || 0) * 0.5 + (d.DEFPASSDEFLECTIONS || 0);
      const sacks = (d.DLINESACKS || 0) + (d.DLINEHALFSACK || 0) * 0.5;
      if (sacks >= 2) add({ kind: 'highlight', type: 'Multi-sack game', teamId, playerIds: [pid], impact: 28 + (sacks - 2) * 9, source: 'box score', text: `${name} records ${sacks} sacks.` });
      if (!hasPbp && d.DSECINTS >= 1) add({ kind: 'highlight', type: 'Interception', teamId, playerIds: [pid], impact: 34 + (d.DSECINTS - 1) * 14 + (d.DSECINTTDS || 0) * 25, source: 'box score', text: `${name} ${d.DSECINTS >= 2 ? `picks off ${d.DSECINTS} passes` : 'comes up with an interception'}${d.DSECINTTDS ? ' and scores' : ''}.` });
      if (d.DEFTACKLES >= 10) add({ kind: 'highlight', type: 'Tackling machine', teamId, playerIds: [pid], impact: 18 + (d.DEFTACKLES - 10) * 1.5, source: 'box score', text: `${name} is everywhere with ${d.DEFTACKLES} tackles.` });
      if (d.DLINEFORCEDFUMBLES >= 1) add({ kind: 'highlight', type: 'Forced fumble', teamId, playerIds: [pid], impact: 26 + (d.DLINEFORCEDFUMBLES - 1) * 10, source: 'box score', text: `${name} forces ${d.DLINEFORCEDFUMBLES === 1 ? 'a fumble' : `${d.DLINEFORCEDFUMBLES} fumbles`}.` });
    }
    if (k.KICKFGATTEMPTS) {
      const missed = k.KICKFGATTEMPTS - (k.KICKFGMADE || 0);
      if (missed >= 1) add({ kind: 'lowlight', type: 'Missed field goal', teamId, playerIds: [pid], impact: 22 + missed * 10 + (teamId === loser && margin <= 3 ? 25 : 0), tags: teamId === loser && margin <= 3 ? ['cost the game'] : [], source: 'box score', text: `${name} misses ${missed === 1 ? 'a field goal' : `${missed} field goals`}${teamId === loser && margin <= 3 ? ' in a game decided by a field goal or less' : ''}.` });
      if (!hasPbp && (k.KICKFGLONGEST || 0) >= 50) add({ kind: 'highlight', type: 'Long field goal', teamId, playerIds: [pid], impact: 20 + (k.KICKFGLONGEST - 50) * 2, source: 'box score', text: `${name} hits from ${k.KICKFGLONGEST} yards.` });
      if (k.KICKEPATTEMPTS && k.KICKEPMADE < k.KICKEPATTEMPTS && !hasPbp) add({ kind: 'lowlight', type: 'Missed extra point', teamId, playerIds: [pid], impact: 20, source: 'box score', text: `${name} misses ${k.KICKEPATTEMPTS - k.KICKEPMADE === 1 ? 'an extra point' : 'extra points'}.` });
    }
    if (gameScore > 0) pogCandidates.push({ pid, teamId, gameScore, name, pos, o, d });
  }

  // Team moments
  for (const teamId of [game.homeTeamId, game.awayTeamId]) {
    const t = teamLines[teamId] || {};
    const team = teamOf(teamId);
    const oppScore = teamId === game.homeTeamId ? game.awayScore : game.homeScore;
    const ownScore = teamId === game.homeTeamId ? game.homeScore : game.awayScore;
    if (oppScore === 0) add({ kind: 'highlight', type: 'Shutout', teamId, impact: 55, source: 'box score', text: `${team.displayName} pitch a shutout.` });
    if (ownScore === 0) add({ kind: 'lowlight', type: 'Shut out', teamId, impact: 50, source: 'box score', text: `${team.displayName} fail to score.` });
    if ((t.OFFRUSHYARDS || 0) >= 200) add({ kind: 'highlight', type: 'Ground game', teamId, impact: 30, source: 'box score', text: `${team.displayName} run for ${t.OFFRUSHYARDS} yards as a team.` });
    if ((t.OFFYARDS || t.TOTALYARDS || 0) >= 480) add({ kind: 'highlight', type: 'Offensive explosion', teamId, impact: 32, source: 'box score', text: `${team.displayName} pile up ${t.OFFYARDS || t.TOTALYARDS} yards of offense.` });
    const rzMiss = (t.OFFREDZONES || 0) - (t.OFFREDZONETDS || 0);
    if (rzMiss >= 2) add({ kind: 'lowlight', type: 'Red-zone trouble', teamId, impact: 18 + rzMiss * 6, source: 'box score', text: `${team.displayName} get inside the 20 ${t.OFFREDZONES} times and score ${t.OFFREDZONETDS || 0} touchdown${t.OFFREDZONETDS === 1 ? '' : 's'}.` });
    const fourthFail = (t.FOURTHDOWNS || 0) - (t.FOURTHDOWNCONV || 0);
    if (fourthFail >= 2) add({ kind: 'lowlight', type: 'Fourth-down failures', teamId, impact: 16 + fourthFail * 5, source: 'box score', text: `${team.displayName} come up short on ${fourthFail} fourth downs.` });
    if ((t.PENALTIES || 0) >= 8 || (t.PENALTYYARDS || 0) >= 80) add({ kind: 'lowlight', type: 'Undisciplined', teamId, impact: 20 + Math.max(0, (t.PENALTYYARDS || 0) - 60) / 4, source: 'box score', text: `${team.displayName} are flagged ${t.PENALTIES} times for ${t.PENALTYYARDS} yards.` });
    if ((t.GIVEAWAYS || 0) >= 3) add({ kind: 'lowlight', type: 'Turnovers', teamId, impact: 30 + t.GIVEAWAYS * 5, source: 'box score', text: `${team.displayName} turn it over ${t.GIVEAWAYS} times.` });
  }

  // ---------------- reconstructed moments (clearly marked)
  if (result && result.played) {
    for (const [teamId, t] of Object.entries(result.teams)) {
      for (const b of t.blocking.blockers) {
        if (b.sacksAllowed >= 2 && (b.passBlockSnaps || 0) > 0) add({ kind: 'lowlight', type: 'Beaten in protection', teamId, playerIds: [b.playerId], impact: 20 + b.sacksAllowed * 6, source: b.source.sacksAllowed === 'recorded' ? 'box score' : 'reconstructed', text: `${b.position} ${b.name} gives up ${b.sacksAllowed} sacks and ${b.pressuresAllowed} pressures.` });
        if (b.pancakes >= 3) add({ kind: 'highlight', type: 'Road grader', teamId, playerIds: [b.playerId], impact: 16 + b.pancakes * 3, source: b.source.pancakes === 'recorded' ? 'box score' : 'reconstructed', text: `${b.position} ${b.name} flattens defenders ${b.pancakes} times.` });
      }
      const topBlocker = t.blocking.summary.bestBlocker;
      if (topBlocker && topBlocker.grade >= 85 && topBlocker.pressuresAllowed === 0) add({ kind: 'highlight', type: 'Clean sheet', teamId, playerIds: [topBlocker.playerId], impact: 18, source: 'reconstructed', text: `${topBlocker.position} ${topBlocker.name} does not allow a pressure all game.` });
      for (const r of t.passRush.players) {
        if (r.missedSacks >= 2) add({ kind: 'lowlight', type: 'Sacks that got away', teamId, playerIds: [r.playerId], impact: 14 + r.missedSacks * 4, source: 'reconstructed', text: `${r.position} ${r.name} gets to the quarterback ${r.missedSacks} times without finishing.` });
      }
      for (const m of t.tackling.players) {
        if (m.missedTackles >= 3) add({ kind: 'lowlight', type: 'Missed tackles', teamId, playerIds: [m.playerId], impact: 14 + m.missedTackles * 4, source: m.source.missedTackles === 'tracked' ? 'tracked' : 'reconstructed', text: `${m.position} ${m.name} misses ${m.missedTackles} tackles.` });
      }
      for (const pen of t.penalties.players) {
        if (pen.penalties >= 2) add({ kind: 'lowlight', type: 'Flag magnet', teamId, playerIds: [pen.playerId], impact: 14 + pen.penalties * 5 + pen.yards / 6, source: pen.source.penalties === 'tracked' ? 'tracked' : 'reconstructed', text: `${pen.position} ${pen.name} is flagged ${pen.penalties} times for ${pen.yards} yards (${pen.types.map((x) => x.type).join(', ')}).` });
      }
    }
  }

  // Injuries the game produced
  for (const inj of (league.gameInjuries && league.gameInjuries[gameId]) || []) {
    const p = league.players[inj.playerId];
    if (!p) continue;
    const cat = getInjuryType(inj.type);
    const weeks = inj.weeksMax || 0;
    const seasonEnding = inj.severity === 'SeasonEnding' || inj.severity === 'CareerEnding' || (cat && cat.seasonEnding);
    add({ kind: 'lowlight', type: 'Injury', teamId: p.teamId, playerIds: [p.playerId], impact: seasonEnding ? 58 : 18 + weeks * 4, tags: seasonEnding ? ['season-ending'] : [], source: 'injury report', text: `${p.position} ${p.fullName} is hurt${cat ? ` (${cat.name.toLowerCase()})` : ''}${seasonEnding ? ' and is out for the season' : weeks ? `, out ${inj.weeksMin === inj.weeksMax ? weeks : `${inj.weeksMin}-${weeks}`} week${weeks === 1 ? '' : 's'}` : ''}.` });
  }

  // Player of the game
  pogCandidates.sort((a, b) => b.gameScore - a.gameScore);
  const pogRaw = pogCandidates.find((c) => c.teamId === winner) || pogCandidates[0] || null;
  const statLine = (c) => {
    const bits = [];
    if (c.o.PASSATTEMPTS) bits.push(`${c.o.PASSCOMPLETED}/${c.o.PASSATTEMPTS}, ${c.o.PASSYARDS} yds, ${c.o.PASSTDS} TD${c.o.PASSINTS ? `, ${c.o.PASSINTS} INT` : ''}`);
    if (c.o.RUSHATTEMPTS && c.o.RUSHYARDS >= 20) bits.push(`${c.o.RUSHATTEMPTS} car, ${c.o.RUSHYARDS} yds${c.o.RUSHTDS ? `, ${c.o.RUSHTDS} TD` : ''}`);
    if (c.o.RECEIVECATCHES) bits.push(`${c.o.RECEIVECATCHES} rec, ${c.o.RECEIVEYARDS} yds${c.o.RECEIVETDS ? `, ${c.o.RECEIVETDS} TD` : ''}`);
    if (c.d.DEFTACKLES || c.d.DLINESACKS || c.d.DSECINTS) bits.push(`${c.d.DEFTACKLES || 0} tkl${c.d.DLINESACKS ? `, ${c.d.DLINESACKS} sk` : ''}${c.d.DSECINTS ? `, ${c.d.DSECINTS} INT` : ''}`);
    return bits.join(' · ');
  };
  const playerOfTheGame = pogRaw ? { playerId: pogRaw.pid, name: pogRaw.name, position: pogRaw.pos, teamId: pogRaw.teamId, line: statLine(pogRaw) } : null;

  // One of the same moment from two angles is enough in the highlight list.
  const rank = (a, b) => b.impact - a.impact || chrono(a, b);
  const highlights = moments.filter((m) => m.kind === 'highlight').sort(rank);
  const lowlights = moments.filter((m) => m.kind === 'lowlight').sort(rank);
  const timeline = moments.filter((m) => m.source.startsWith('play-by-play') && m.quarter && !['Comeback', 'Blown lead', 'Late collapse'].includes(m.type) && !(m.kind === 'lowlight' && ['Sacked', 'Fumble lost'].includes(m.type))).sort(chrono);
  // Lead with the moment that decided it when there is one.
  const top = highlights.find((m) => m.tags.includes('game-winner')) || highlights[0] || null;
  const headline = winner
    ? `${teamOf(winner).displayName} ${Math.max(game.homeScore, game.awayScore)}, ${teamOf(loser).displayName} ${Math.min(game.homeScore, game.awayScore)}${top ? `: ${top.text.replace(/\.$/, '')}` : ''}.`
    : `${teamOf(game.awayTeamId).displayName} and ${teamOf(game.homeTeamId).displayName} tie ${game.homeScore}-${game.awayScore}.`;

  return {
    gameId,
    hasPlayByPlay: hasPbp,
    headline,
    playerOfTheGame,
    highlights,
    lowlights,
    timeline,
    scoring: events.map((ev) => ({ teamId: ev.teamId, kind: ev.kind, quarter: ev.quarter, clock: clockText(ev.quarter, ev.clockSec), conversion: ev.conversion, score: ev.scoreAfter, tookLead: ev.tookLead, gameWinner: Boolean(ev.gameWinner) })),
  };
}

// The best and worst of a whole week across every game played.
export function weekHighlights(league, engine, tracker, { stage, week, limit = 12 } = {}) {
  const games = Object.values(league.games)
    .filter((g) => g.status === 'played' && g.stage === stage && g.week === Number(week))
    .sort((a, b) => String(a.gameId).localeCompare(String(b.gameId)));
  const all = [];
  for (const g of games) {
    const h = engine.highlights(league, g.gameId, tracker);
    if (h) all.push(h);
  }
  const flat = (key) => all.flatMap((h) => h[key]).sort((a, b) => b.impact - a.impact).slice(0, limit);
  return {
    stage,
    week: Number(week),
    label: games[0] ? games[0].label : null,
    games: all.map((h) => ({
      gameId: h.gameId,
      headline: h.headline,
      playerOfTheGame: h.playerOfTheGame,
      hasPlayByPlay: h.hasPlayByPlay,
      highlightCount: h.highlights.length,
      lowlightCount: h.lowlights.length,
      top: h.highlights[0] || null,
      worst: h.lowlights[0] || null,
    })),
    highlights: flat('highlights'),
    lowlights: flat('lowlights'),
  };
}
