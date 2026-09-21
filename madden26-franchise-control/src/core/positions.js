// Position groups and helpers shared by the stats engine, the UI and the
// franchise reader. Madden 26 position names are used everywhere.

export const OFFENSE = ['QB', 'HB', 'FB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT'];
export const OLINE = ['LT', 'LG', 'C', 'RG', 'RT'];
export const DLINE = ['LE', 'RE', 'DT'];
export const LINEBACKERS = ['LOLB', 'MLB', 'ROLB'];
export const SECONDARY = ['CB', 'FS', 'SS'];
export const DEFENSE = [...DLINE, ...LINEBACKERS, ...SECONDARY];
export const SPECIAL = ['K', 'P', 'LS'];
export const RECEIVERS = ['WR', 'TE', 'HB', 'FB'];
export const EDGE = ['LE', 'RE', 'LOLB', 'ROLB'];
export const PASS_RUSHERS = ['LE', 'RE', 'DT', 'LOLB', 'ROLB', 'MLB'];
export const BLOCKERS = ['LT', 'LG', 'C', 'RG', 'RT', 'TE', 'FB', 'HB'];

export function side(position) {
  if (OFFENSE.includes(position)) return 'offense';
  if (DEFENSE.includes(position)) return 'defense';
  return 'special';
}

export function group(position) {
  if (position === 'QB') return 'QB';
  if (position === 'HB' || position === 'FB') return 'RB';
  if (position === 'WR') return 'WR';
  if (position === 'TE') return 'TE';
  if (OLINE.includes(position)) return 'OL';
  if (DLINE.includes(position)) return 'DL';
  if (LINEBACKERS.includes(position)) return 'LB';
  if (SECONDARY.includes(position)) return 'DB';
  return 'ST';
}

export function isBlocker(position) {
  return BLOCKERS.includes(position);
}

export function isPassRusher(position) {
  return PASS_RUSHERS.includes(position);
}

// Typical share of a team's offensive/defensive snaps played by the Nth
// player on the depth chart at a position. Used only when the game did not
// give us a real snap count.
export const SNAP_SHARE = {
  QB: [1.0, 0.02],
  HB: [0.62, 0.3, 0.12],
  FB: [0.28, 0.05],
  WR: [0.9, 0.82, 0.62, 0.3, 0.12, 0.05],
  TE: [0.85, 0.45, 0.15],
  LT: [1.0, 0.03],
  LG: [1.0, 0.03],
  C: [1.0, 0.03],
  RG: [1.0, 0.03],
  RT: [1.0, 0.03],
  LE: [0.75, 0.35],
  RE: [0.75, 0.35],
  DT: [0.7, 0.62, 0.35, 0.15],
  LOLB: [0.8, 0.25],
  ROLB: [0.8, 0.25],
  MLB: [0.95, 0.5, 0.1],
  CB: [0.95, 0.9, 0.6, 0.2, 0.05],
  FS: [0.97, 0.1],
  SS: [0.95, 0.15],
  K: [0, 0],
  P: [0, 0],
  LS: [0, 0],
};

// Number of starters at each position in a base personnel grouping.
export const STARTERS = {
  QB: 1, HB: 1, FB: 0, WR: 3, TE: 1, LT: 1, LG: 1, C: 1, RG: 1, RT: 1,
  LE: 1, RE: 1, DT: 2, LOLB: 1, MLB: 1, ROLB: 1, CB: 3, FS: 1, SS: 1,
  K: 1, P: 1, LS: 1,
};
