// Snap counts for one team in one game.
//
// From a franchise file the count is REAL (Madden stores DOWNSPLAYED on every
// per-game stat row). From a Companion App export it is reconstructed from the
// team's play count, the depth chart the box score implies, and each player's
// involvement, and the user can type in the real number in the Game Tracker.

import { makeRng } from '../rng.js';
import { side as sideOf, SNAP_SHARE } from '../positions.js';
import { estimatedSnapShare, involvement } from './context.js';

// Special-teams plays in a game: punts, kickoffs, FG/XP tries, and returns.
function specialTeamsPlays(ctx, oppCtx) {
  const kicks = (ctx.line.PASSTDS || 0) + (ctx.line.RUSHTDS || 0) + (oppCtx.line.PASSTDS || 0) + (oppCtx.line.RUSHTDS || 0);
  return Math.max(8, Math.round(9 + kicks * 1.6 + 4));
}

const ST_ROLE = { WR: 0.35, TE: 0.55, HB: 0.35, FB: 0.75, LOLB: 0.6, MLB: 0.45, ROLB: 0.6, SS: 0.65, FS: 0.5, CB: 0.5, LE: 0.25, RE: 0.25, DT: 0.15, K: 1, P: 1, LS: 1, QB: 0, LT: 0, LG: 0, C: 0, RG: 0, RT: 0 };

export function snapsForTeam({ league, gameId, ctx, oppCtx, overrides = {} }) {
  const rng = makeRng('snaps', league.leagueId, gameId, ctx.teamId);
  const offPlays = ctx.offPlays;
  const defPlays = oppCtx.offPlays;
  const stPlays = specialTeamsPlays(ctx, oppCtx);
  const tracked = overrides.snaps || {};

  // Group totals when reconstructing, so a position group never adds up to
  // more bodies than the field allows.
  const groupSlots = { QB: 1, HB: 1.0, FB: 0.25, WR: 2.75, TE: 1.25, LT: 1, LG: 1, C: 1, RG: 1, RT: 1, LE: 1, RE: 1, DT: 1.9, LOLB: 0.85, ROLB: 0.85, MLB: 1.4, CB: 2.9, FS: 1.05, SS: 1.05 };

  const rows = ctx.people.map((x) => {
    const pos = x.player.position;
    const sd = sideOf(pos);
    const plays = sd === 'offense' ? offPlays : sd === 'defense' ? defPlays : 0;
    let snaps;
    let source;
    if (tracked[x.player.playerId]) {
      const t = tracked[x.player.playerId];
      snaps = sd === 'offense' ? t.offSnaps : t.defSnaps;
      source = 'tracked';
    } else if (x.entry && x.entry.snapsRecorded) {
      snaps = x.entry.snaps;
      source = 'recorded';
    } else {
      const { share } = estimatedSnapShare(ctx.people, x);
      const inv = involvement(x);
      const noise = 1 + makeRng('snap-noise', league.leagueId, gameId, x.player.playerId).gaussian(0, 0.06);
      snaps = Math.round(plays * share * noise);
      const floor = Math.min(plays, Math.round(inv * 1.6));
      if (snaps < floor) snaps = floor;
      if (!x.played && share === 0) snaps = 0;
      source = 'reconstructed';
    }
    snaps = Math.max(0, Math.min(plays || snaps, snaps));
    const stSnaps = tracked[x.player.playerId] ? tracked[x.player.playerId].stSnaps : Math.round(stPlays * (ST_ROLE[pos] || 0) * (snaps / Math.max(1, plays) > 0.8 ? 0.3 : 1) * (x.played || SNAP_SHARE[pos] ? 1 : 0.5));
    return {
      playerId: x.player.playerId,
      name: x.player.fullName,
      position: pos,
      side: sd,
      offSnaps: sd === 'offense' ? snaps : 0,
      defSnaps: sd === 'defense' ? snaps : 0,
      stSnaps: Math.max(0, stSnaps),
      snapPct: plays ? Math.round((snaps / plays) * 1000) / 10 : 0,
      played: snaps > 0 || stSnaps > 0,
      source: { snaps: source },
    };
  });

  // Normalize reconstructed groups to the slot totals (never touch recorded).
  for (const [pos, slots] of Object.entries(groupSlots)) {
    const group = rows.filter((r) => r.position === pos && r.source.snaps === 'reconstructed');
    if (!group.length) continue;
    const sd = sideOf(pos);
    const plays = sd === 'offense' ? offPlays : defPlays;
    const target = Math.round(plays * slots);
    const current = group.reduce((s, r) => s + (sd === 'offense' ? r.offSnaps : r.defSnaps), 0);
    if (!current || current <= target) continue;
    const scale = target / current;
    for (const r of group) {
      if (sd === 'offense') r.offSnaps = Math.round(r.offSnaps * scale);
      else r.defSnaps = Math.round(r.defSnaps * scale);
      r.snapPct = plays ? Math.round(((sd === 'offense' ? r.offSnaps : r.defSnaps) / plays) * 1000) / 10 : 0;
    }
  }
  rng.next();

  rows.sort((a, b) => b.offSnaps + b.defSnaps + b.stSnaps - (a.offSnaps + a.defSnaps + a.stSnaps));
  return {
    teamId: ctx.teamId,
    summary: { offPlays, defPlays, stPlays, recorded: ctx.anyRecordedSnaps },
    players: rows.filter((r) => r.played),
  };
}
