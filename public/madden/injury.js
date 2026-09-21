// The Injury Control tool. The user picks a game off the schedule, picks a
// player, picks what happens to him — and the engine decides *when* it happens:
// a random play in a random quarter, with a play description built around the
// injury type and the player's position.

import { mulberry32, hash, int, pick } from './league.js';

export const INJURY_TYPES = [
  { id: 'acl', name: 'Torn ACL', severity: 'Season ending', weeksOut: [17, 17], contact: true,
    blurb: 'Plants, the knee buckles, he goes down untouched. Cart comes out.' },
  { id: 'achilles', name: 'Torn Achilles', severity: 'Season ending', weeksOut: [17, 17], contact: false,
    blurb: 'Pushes off, grabs the back of the leg, looks around for who hit him. Nobody did.' },
  { id: 'patellar', name: 'Torn Patellar Tendon', severity: 'Season ending', weeksOut: [17, 17], contact: true,
    blurb: 'Knee takes the whole pile. He does not get up.' },
  { id: 'mcl', name: 'MCL Sprain', severity: 'Major', weeksOut: [4, 8], contact: true,
    blurb: 'Hit on the outside of the knee while the foot is stuck in the turf.' },
  { id: 'highankle', name: 'High Ankle Sprain', severity: 'Major', weeksOut: [3, 6], contact: true,
    blurb: 'Leg gets rolled up on at the bottom of the pile.' },
  { id: 'fibula', name: 'Fractured Fibula', severity: 'Major', weeksOut: [6, 10], contact: true,
    blurb: 'Low hit, awkward landing, immediate air cast.' },
  { id: 'collarbone', name: 'Broken Collarbone', severity: 'Major', weeksOut: [5, 9], contact: true,
    blurb: 'Lands shoulder first with a defender riding him down.' },
  { id: 'shoulder', name: 'Separated Shoulder', severity: 'Moderate', weeksOut: [2, 5], contact: true,
    blurb: 'Arm gets caught behind him on the tackle.' },
  { id: 'hamstring', name: 'Hamstring Strain', severity: 'Moderate', weeksOut: [2, 4], contact: false,
    blurb: 'Pulls up mid-play, grabs the back of the leg and starts limping.' },
  { id: 'groin', name: 'Groin Strain', severity: 'Moderate', weeksOut: [1, 3], contact: false,
    blurb: 'Changes direction, stops, waves to the sideline.' },
  { id: 'ribs', name: 'Bruised Ribs', severity: 'Moderate', weeksOut: [1, 3], contact: true,
    blurb: 'Takes a helmet to the side while the ball is in the air.' },
  { id: 'concussion', name: 'Concussion', severity: 'Protocol', weeksOut: [1, 2], contact: true,
    blurb: 'Head hits the turf. Gets walked straight to the blue tent.' },
  { id: 'ankle', name: 'Ankle Sprain', severity: 'Minor', weeksOut: [1, 2], contact: true,
    blurb: 'Steps on a foot in the pile and hobbles off.' },
  { id: 'hand', name: 'Broken Hand', severity: 'Minor', weeksOut: [1, 3], contact: true,
    blurb: 'Hand gets caught in a facemask. Comes off holding it.' },
  { id: 'knee-bruise', name: 'Knee Contusion', severity: 'Minor', weeksOut: [0, 1], contact: true,
    blurb: 'Helmet to the knee. Walks it off on the sideline bike.' },
  { id: 'cramps', name: 'Cramps', severity: 'Questionable', weeksOut: [0, 0], contact: false,
    blurb: 'Locks up in the fourth. Comes back after an IV.' },
];

export const SEVERITY_ORDER = ['Questionable', 'Minor', 'Protocol', 'Moderate', 'Major', 'Season ending'];

// What the player was doing when it happened, by position group.
const PLAY_CONTEXT = {
  QB: ['stepping up in a collapsing pocket', 'scrambling for the sticks', 'getting hit as he throws', 'sliding at the end of a scramble'],
  RB: ['cutting back on an inside zone', 'getting stood up in the hole', 'taking a checkdown up the seam', 'blocking a free blitzer'],
  FB: ['leading up on an iso', 'catching a flat route', 'blocking down on the backside'],
  WR: ['breaking off a deep comeback', 'going up for a fade in the end zone', 'getting cracked over the middle', 'blocking downfield on a screen'],
  TE: ['chipping the edge before releasing', 'stretching out for a seam ball', 'getting rolled up on a down block'],
  LT: ['kicking out against a speed rush', 'anchoring a bull rush', 'pulling on a counter'],
  LG: ['pulling on a power run', 'doubling the nose', 'picking up a delayed blitz'],
  C: ['reaching the backside nose', 'climbing to the second level', 'passing off a twist'],
  RG: ['pulling on a toss', 'picking up an A-gap stunt', 'doubling the three-tech'],
  RT: ['setting against a wide-9 rusher', 'down blocking on a duo run', 'chipping and climbing'],
  DEF: ['fighting off a block at the point of attack', 'chasing a screen from the backside', 'diving for a tackle in space', 'rushing the passer off the edge', 'covering a crosser in the flat'],
  K: ['planting on a 48-yard attempt'],
  P: ['covering his own punt'],
};

const contextFor = (pos) => PLAY_CONTEXT[pos] || PLAY_CONTEXT.DEF;

const PLAY_TYPES = [
  '1st & 10', '2nd & 6', '2nd & 12', '3rd & 3', '3rd & 8', '3rd & 1', '4th & 2', '1st & Goal', '2nd & Goal',
];

/**
 * Decide the exact moment a scripted injury fires. The quarter/play/drive come
 * from a seed built out of the game, the player and a nonce, so re-opening the
 * franchise shows the same play — but each new script gets its own roll.
 */
export function resolveInjury({ franchise, game, player, typeId, forcedQuarter = null, nonce = 0 }) {
  const type = INJURY_TYPES.find((t) => t.id === typeId);
  if (!type) throw new Error(`Unknown injury type: ${typeId}`);

  const rng = mulberry32(hash(`${franchise.seedText}|${game.id}|${player.id}|${typeId}|${nonce}`));
  const quarter = forcedQuarter || int(rng, 1, 4);
  const clock = `${String(int(rng, 0, 14)).padStart(2, '0')}:${String(int(rng, 0, 59)).padStart(2, '0')}`;
  const drive = int(rng, 1, 13);
  const playInGame = int(rng, 1, 68);
  const down = pick(rng, PLAY_TYPES);
  const context = pick(rng, contextFor(player.pos));

  // Durability shortens or stretches the layoff inside the type's window.
  const [lo, hi] = type.weeksOut;
  const span = hi - lo;
  const durPush = (85 - player.dur) / 40;                 // tough guys skew low
  const weeksOut = Math.max(0, Math.min(17, Math.round(lo + span * Math.min(1, Math.max(0, rng() * 0.8 + durPush * 0.3)))));

  return {
    id: `INJ-${game.id}-${player.id}-${nonce}`,
    gameId: game.id,
    week: game.week,
    teamId: player.team,
    playerId: player.id,
    playerName: player.name,
    pos: player.pos,
    typeId: type.id,
    typeName: type.name,
    severity: type.severity,
    weeksOut,
    quarter,
    clock,
    drive,
    playInGame,
    down,
    contact: type.contact,
    description: `Q${quarter} ${clock} — ${down}, drive ${drive}, play ${playInGame}: ${player.pos} ${player.name} goes down ${context}. ${type.blurb}`,
    returnWeek: weeksOut > 0 ? game.week + weeksOut : game.week,
    status: 'scripted',
  };
}

/** Queue an injury onto the franchise, replacing any earlier script for the same player in the same game. */
export function scriptInjury(franchise, injury) {
  franchise.injuries = franchise.injuries.filter(
    (i) => !(i.gameId === injury.gameId && i.playerId === injury.playerId)
  );
  franchise.injuries.push(injury);
  franchise.injuries.sort((a, b) => a.week - b.week || a.quarter - b.quarter);
  return injury;
}

export function unscriptInjury(franchise, injuryId) {
  franchise.injuries = franchise.injuries.filter((i) => i.id !== injuryId);
}

/**
 * Fire every script attached to a game and stamp the players. Called when the
 * user plays/advances past that week, so stat pages stop counting the guy.
 */
export function applyInjuriesForGame(franchise, game) {
  const fired = [];
  for (const inj of franchise.injuries.filter((i) => i.gameId === game.id && i.status === 'scripted')) {
    const roster = franchise.rosters[inj.teamId] || [];
    const player = roster.find((p) => p.id === inj.playerId);
    if (!player) continue;
    player.injury = {
      typeName: inj.typeName,
      severity: inj.severity,
      gamesOut: inj.weeksOut,
      returnWeek: inj.returnWeek,
      week: inj.week,
    };
    inj.status = 'fired';
    franchise.log.push({
      week: game.week,
      gameId: game.id,
      text: inj.description,
      out: inj.weeksOut,
      returnWeek: inj.returnWeek,
      teamId: inj.teamId,
    });
    fired.push(inj);
  }
  return fired;
}

/** Tick every injured player down one week and clear the ones who are back. */
export function advanceHealing(franchise) {
  for (const roster of Object.values(franchise.rosters)) {
    for (const p of roster) {
      if (!p.injury) continue;
      p.injury.gamesOut = Math.max(0, p.injury.gamesOut - 1);
      if (p.injury.gamesOut === 0) p.injury = null;
    }
  }
}

/** The file the runtime reads: just the scripts, nothing else. */
export function exportInjuryScript(franchise) {
  return {
    format: 'gcc-injury-script',
    version: 1,
    franchise: franchise.seedText,
    year: franchise.year,
    generated: new Date().toISOString(),
    injuries: franchise.injuries.map((i) => ({ ...i })),
  };
}
