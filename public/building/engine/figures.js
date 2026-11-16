/* People as things you place: a figure in a pose, with whatever the pose
 * puts in its hands — a box, a clipboard, a phone, a shovel, a stop/slow
 * paddle. The figures themselves come from people.js. */

import * as THREE from 'three';
import * as M from './materials.js';
import { rng, panelTexture } from './textures.js';
import { cylGeo } from './builder.js';
import { placePerson } from './people.js';

const PI = Math.PI;

export const POSE_NAMES = {
  stand: 'Standing', relaxed: 'At ease', hips: 'Hands on hips', crossed: 'Arms crossed', phone: 'On the phone',
  text: 'Texting', point: 'Pointing', wave: 'Waving', talk: 'Talking', carry: 'Carrying a box', clipboard: 'Clipboard',
  lean: 'Leaning', counter: 'At a counter', sit: 'Sitting', type: 'Typing', lounge: 'Lounging', eat: 'Eating',
  read: 'Reading', stool: 'On a stool', dig: 'Digging', kneel: 'Kneeling', crouch: 'Crouching', reach: 'Reaching up',
  push: 'Pushing', flag: 'Stop / slow paddle', squat: 'Squatting', lie: 'Lying down', lift: 'Arms up', run: 'Running',
};
export const STANDING = ['stand', 'relaxed', 'hips', 'crossed', 'phone', 'text', 'point', 'wave', 'talk', 'carry', 'clipboard', 'lean', 'run'];
export const SEATED = ['sit', 'type', 'lounge', 'eat', 'read', 'stool'];
export const WORKING = ['stand', 'hips', 'crossed', 'point', 'talk', 'carry', 'clipboard', 'dig', 'kneel', 'crouch', 'reach', 'push', 'squat', 'phone'];

/** The poses a kind of person usually strikes when none is chosen. */
const USUAL = {
  worker: ['stand', 'hips', 'carry', 'dig', 'kneel', 'point', 'talk', 'crouch'],
  foreman: ['clipboard', 'point', 'phone', 'hips'],
  flagger: ['flag'],
  guard: ['hips', 'stand', 'crossed', 'talk'],
  chef: ['crossed', 'stand', 'counter'],
  server: ['carry', 'stand', 'clipboard'],
  medic: ['clipboard', 'stand', 'talk'],
  doctor: ['clipboard', 'crossed', 'talk'],
  mechanic: ['reach', 'kneel', 'hips', 'crouch'],
  clerk: ['counter', 'stand', 'carry'],
  athlete: ['run', 'lift', 'hips', 'stand'],
  child: ['stand', 'wave', 'run', 'relaxed'],
};
const ANY = ['stand', 'relaxed', 'relaxed', 'phone', 'crossed', 'hips', 'text', 'talk'];

export function usualPose(role, seed) {
  const list = USUAL[role] || ANY;
  return list[Math.floor(rng(seed ^ 0x51ed)() * list.length)];
}

let PADDLE = null;
function paddleMats() {
  if (!PADDLE) {
    const face = (text, bg, color) => {
      const m = M.printFace(panelTexture({ text, color, bg, aspect: 1, border: false }), { rough: 0.4 });
      return m;
    };
    PADDLE = { stop: face('STOP', '#c8102e', '#ffffff'), slow: face('SLOW', '#f08a1c', '#111111') };
  }
  return PADDLE;
}

/** A tube between two points, in the builder. */
const rod = (B, mat, a, b, r, seg = 6) => B.tube(mat, a, b, r, seg);

/**
 * A person in a pose, holding what the pose calls for.
 * Returns what placePerson returns (the figure and where its hands are).
 */
export function personWith(B, role, seed, { x = 0, y = 0, z = 0, turn = 0, pose = null, spec = null, props = true } = {}) {
  const P = pose || usualPose(role, seed);
  const who = placePerson(B, role, seed, { x, y, z, turn, pose: P, spec });
  if (!props) return who;
  const R = who.grip('R');
  const L = who.grip('L');
  const mid = [(R.at[0] + L.at[0]) / 2, (R.at[1] + L.at[1]) / 2, (R.at[2] + L.at[2]) / 2];
  const fwd = [-Math.sin(turn), 0, -Math.cos(turn)];     // the way the figure faces
  const r = rng(seed ^ 0x9e37);
  switch (P) {
    case 'carry': {
      const w = Math.hypot(R.at[0] - L.at[0], R.at[2] - L.at[2]) - 0.08;
      B.box(M.plastic('#b58a55', 0.85), Math.max(0.9, w), 0.95, 1.05, mid[0] + fwd[0] * 0.18, mid[1] + 0.28, mid[2] + fwd[2] * 0.18, [0, turn, 0]);
      B.box(M.plastic('#8f6b3f', 0.8), Math.max(0.9, w) + 0.01, 0.06, 0.16, mid[0] + fwd[0] * 0.18, mid[1] + 0.76, mid[2] + fwd[2] * 0.18, [0, turn, 0]);
      break;
    }
    case 'clipboard': {
      B.box(M.plastic('#3b2a1c', 0.6), 0.72, 0.03, 0.95, L.at[0] + fwd[0] * 0.2, L.at[1] + 0.1, L.at[2] + fwd[2] * 0.2, [-0.5, turn, 0]);
      B.box(M.plastic('#f4f4f0', 0.7), 0.64, 0.012, 0.84, L.at[0] + fwd[0] * 0.2, L.at[1] + 0.125, L.at[2] + fwd[2] * 0.2, [-0.5, turn, 0]);
      rod(B, M.plastic('#1f4f9c', 0.4), [R.at[0], R.at[1] + 0.02, R.at[2]], [R.at[0] + fwd[0] * 0.3, R.at[1] + 0.2, R.at[2] + fwd[2] * 0.3], 0.018, 5);
      break;
    }
    case 'phone':
      B.box(M.pianoBlack(), 0.04, 0.5, 0.25, R.at[0], R.at[1] + 0.12, R.at[2], [0.2, turn, 0]);
      break;
    case 'text': case 'read': {
      const book = P === 'read';
      B.box(book ? M.plastic(['#7a1f2b', '#1f4f9c', '#2e6b3a', '#3b2a1c'][Math.floor(r() * 4)], 0.7) : M.pianoBlack(), book ? 0.85 : 0.26, book ? 0.06 : 0.03, book ? 0.6 : 0.5, mid[0] + fwd[0] * 0.12, mid[1] + 0.1, mid[2] + fwd[2] * 0.12, [-0.7, turn, 0]);
      if (book) B.box(M.plastic('#f1efe6', 0.8), 0.8, 0.05, 0.56, mid[0] + fwd[0] * 0.12, mid[1] + 0.115, mid[2] + fwd[2] * 0.12, [-0.7, turn, 0]);
      break;
    }
    case 'flag': {
      // The paddle: STOP one side, SLOW the other, on a staff held upright.
      const top = [R.at[0], R.at[1] + 4.6, R.at[2]];
      rod(B, M.metal('#c9ced3', 0.35), [R.at[0], R.at[1] - 0.7, R.at[2]], top, 0.045, 8);
      const mats = paddleMats();
      const oct = () => new THREE.CircleGeometry(0.78, 8).rotateZ(PI / 8);
      B.add(oct().rotateY(turn + PI), mats.stop, { pos: [top[0] + fwd[0] * 0.03, top[1] - 0.2, top[2] + fwd[2] * 0.03] });
      B.add(oct().rotateY(turn), mats.slow, { pos: [top[0] - fwd[0] * 0.03, top[1] - 0.2, top[2] - fwd[2] * 0.03] });
      B.add(cylGeo(0.8, 0.8, 0.05, 8).rotateX(PI / 2).rotateZ(PI / 8).rotateY(turn), M.painted('#f4f4f2', 0.5), { pos: [top[0], top[1] - 0.2, top[2]] });
      break;
    }
    case 'dig': {
      // A shovel through both hands, its blade in the ground ahead.
      const a = L.at;
      const b = R.at;
      const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const len = Math.hypot(d[0], d[1], d[2]) || 1;
      const u = d.map((v) => v / len);
      const k = u[1] < -0.05 ? (b[1] - 0.15) / -u[1] : 2;
      const tip = [b[0] + u[0] * Math.min(3.2, k), Math.max(0.12, b[1] + u[1] * Math.min(3.2, k)), b[2] + u[2] * Math.min(3.2, k)];
      const back = [a[0] - u[0] * 0.9, a[1] - u[1] * 0.9, a[2] - u[2] * 0.9];
      rod(B, M.wood('#b98f5b'), back, tip, 0.05, 6);
      B.box(M.metal('#8d949b', 0.45), 0.62, 0.05, 0.85, tip[0] + u[0] * 0.3, tip[1] + u[1] * 0.3 + 0.02, tip[2] + u[2] * 0.3, [Math.asin(Math.max(-1, Math.min(1, -u[1]))) * 0.8, Math.atan2(u[0], u[2]), 0]);
      B.box(M.wood('#8a6a4a'), 0.34, 0.07, 0.07, back[0], back[1], back[2], [0, turn, 0]);
      break;
    }
    case 'eat':
      rod(B, M.metal('#c9ced3', 0.3), R.at, [R.at[0] + fwd[0] * 0.25, R.at[1] + 0.22, R.at[2] + fwd[2] * 0.25], 0.012, 4);
      break;
    case 'kneel': case 'crouch': case 'squat':
      if (role === 'worker' || role === 'mechanic') {
        // A hand tool on the ground in front.
        B.box(M.painted('#c8241b', 0.5), 0.22, 0.14, 0.7, x + fwd[0] * 1.9 + fwd[2] * 0.5, y + 0.07, z + fwd[2] * 1.9 - fwd[0] * 0.5, [0, turn + 0.5, 0]);
      }
      break;
    default:
  }
  return who;
}

/** A knot of people talking, facing one another. */
export function peopleGroup(B, seed, roles = ['visitor', 'visitor', 'office', 'visitor'], spread = 2.2) {
  const r = rng(seed);
  const n = roles.length;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * PI * 2 + r() * 0.5;
    const d = spread * (0.75 + r() * 0.35);
    const px = Math.sin(a) * d;
    const pz = Math.cos(a) * d;
    // Facing the middle, give or take.
    personWith(B, roles[i], seed + i * 7919, { x: px, z: pz, turn: a + (r() - 0.5) * 0.5, pose: ['talk', 'stand', 'crossed', 'hips', 'relaxed', 'phone'][Math.floor(r() * 6)] });
  }
}
