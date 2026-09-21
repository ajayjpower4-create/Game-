// The Game Tracker: what the user logged by hand while watching a game.
// Anything tracked for a team in a game replaces the reconstructed numbers for
// that category, so real observations always win.

export const EVENT_TYPES = {
  pressure: { label: 'Pressure', side: 'defense', needsOpponent: true },
  hurry: { label: 'Hurry', side: 'defense', needsOpponent: true },
  hit: { label: 'QB Hit', side: 'defense', needsOpponent: true },
  sack: { label: 'Sack', side: 'defense', needsOpponent: true },
  missedSack: { label: 'Missed Sack', side: 'defense', needsOpponent: true },
  pancake: { label: 'Pancake', side: 'offense', needsOpponent: false },
  target: { label: 'Target', side: 'offense', needsOpponent: false },
  drop: { label: 'Drop', side: 'offense', needsOpponent: false },
  missedTackle: { label: 'Missed Tackle', side: 'defense', needsOpponent: false },
  penalty: { label: 'Penalty', side: 'any', needsOpponent: false },
  snaps: { label: 'Snap Count', side: 'any', needsOpponent: false },
};

let counter = 0;
export function newEventId() {
  counter += 1;
  return `${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function validateEvent(ev) {
  if (!ev || typeof ev !== 'object') return 'event must be an object';
  if (!EVENT_TYPES[ev.type]) return `unknown event type ${ev.type}`;
  if (!ev.gameId) return 'gameId is required';
  if (!ev.teamId) return 'teamId is required';
  if (!ev.playerId) return 'playerId is required';
  if (ev.type === 'penalty' && !(Number.isFinite(Number(ev.yards)) && Number(ev.yards) >= 0)) return 'penalty needs yards';
  if (ev.type === 'snaps' && !['offSnaps', 'defSnaps', 'stSnaps'].some((k) => Number.isFinite(Number(ev[k])))) return 'snap count needs offSnaps, defSnaps or stSnaps';
  return null;
}

export function addEvent(tracker, ev) {
  const err = validateEvent(ev);
  if (err) throw new Error(err);
  const event = { id: newEventId(), createdAt: new Date().toISOString(), ...ev };
  tracker.events.push(event);
  return event;
}

export function removeEvent(tracker, id) {
  const before = tracker.events.length;
  tracker.events = tracker.events.filter((e) => e.id !== id);
  return tracker.events.length !== before;
}

export function eventsForGame(tracker, gameId) {
  return (tracker && tracker.events ? tracker.events : []).filter((e) => e.gameId === gameId);
}

// Group a game's events into the overrides the engine understands.
export function overridesForGame(tracker, gameId) {
  const events = eventsForGame(tracker, gameId);
  const out = {}; // teamId -> category -> data
  const bucket = (teamId, cat) => ((out[teamId] ||= {})[cat] ||= {});
  for (const e of events) {
    switch (e.type) {
      case 'pressure':
      case 'hurry':
      case 'hit':
      case 'sack':
      case 'missedSack': {
        const rush = bucket(e.teamId, 'passRush');
        const r = (rush[e.playerId] ||= { pressures: 0, hurries: 0, hits: 0, sacks: 0, missedSacks: 0, beat: {} });
        if (e.type === 'pressure') { r.pressures += 1; r.hurries += 1; }
        if (e.type === 'hurry') { r.pressures += 1; r.hurries += 1; }
        if (e.type === 'hit') { r.pressures += 1; r.hits += 1; }
        if (e.type === 'sack') { r.pressures += 1; r.sacks += 1; }
        if (e.type === 'missedSack') { r.pressures += 1; r.hits += 1; r.missedSacks += 1; }
        if (e.againstPlayerId) r.beat[e.againstPlayerId] = (r.beat[e.againstPlayerId] || 0) + 1;
        if (e.againstTeamId && e.againstPlayerId) {
          const blk = bucket(e.againstTeamId, 'blocking');
          const b = (blk[e.againstPlayerId] ||= { pressuresAllowed: 0, hurriesAllowed: 0, hitsAllowed: 0, sacksAllowed: 0 });
          b.pressuresAllowed += 1;
          if (e.type === 'sack') b.sacksAllowed += 1;
          else if (e.type === 'hit' || e.type === 'missedSack') b.hitsAllowed += 1;
          else b.hurriesAllowed += 1;
        }
        break;
      }
      case 'pancake': {
        const blk = bucket(e.teamId, 'pancakes');
        blk[e.playerId] = (blk[e.playerId] || 0) + 1;
        break;
      }
      case 'target':
      case 'drop': {
        const rec = bucket(e.teamId, 'receiving');
        const r = (rec[e.playerId] ||= { targets: 0, drops: 0 });
        r.targets += 1;
        if (e.type === 'drop') r.drops += 1;
        break;
      }
      case 'missedTackle': {
        const t = bucket(e.teamId, 'missedTackles');
        t[e.playerId] = (t[e.playerId] || 0) + 1;
        break;
      }
      case 'penalty': {
        const pen = bucket(e.teamId, 'penalties');
        const p = (pen[e.playerId] ||= []);
        p.push({ type: e.penaltyType || 'Penalty', yards: Number(e.yards) || 0, quarter: e.quarter || null });
        break;
      }
      case 'snaps': {
        const s = bucket(e.teamId, 'snaps');
        s[e.playerId] = { offSnaps: Number(e.offSnaps) || 0, defSnaps: Number(e.defSnaps) || 0, stSnaps: Number(e.stSnaps) || 0 };
        break;
      }
      default:
        break;
    }
  }
  return out;
}
