// The driver: a jointed figure built from smooth primitives with a painted
// face, hair styles, facial hair, clothes and an ANSI hi-vis vest. Poses are
// procedural (walk, run, kneel, sit, lie on a creeper, carry, reach).
import * as THREE from 'three';
import { makeCanvas, canvasTexture, clamp, lerp, damp, roundRect } from '../util.js';
import * as TX from '../textures.js';

export const SKIN_TONES = [
  { name: 'Fair', hex: '#f3d1bb' }, { name: 'Light', hex: '#e8b996' }, { name: 'Light-medium', hex: '#d9a27b' },
  { name: 'Medium', hex: '#c68a62' }, { name: 'Olive', hex: '#b5845a' }, { name: 'Tan', hex: '#a2694a' },
  { name: 'Brown', hex: '#8a5537' }, { name: 'Dark brown', hex: '#6b3f28' }, { name: 'Deep', hex: '#4a2a1b' },
];
// Race/ethnicity presets set a starting skin tone and hair; everything can be changed after.
export const RACES = [
  { id: 'white', name: 'White', skin: 1, hair: 'short', hairColor: 3, eyes: 3 },
  { id: 'black', name: 'Black / African American', skin: 7, hair: 'buzz', hairColor: 0, eyes: 0 },
  { id: 'hispanic', name: 'Hispanic / Latino', skin: 4, hair: 'short', hairColor: 0, eyes: 0 },
  { id: 'asian', name: 'East Asian', skin: 2, hair: 'sidepart', hairColor: 0, eyes: 0 },
  { id: 'southasian', name: 'South Asian', skin: 5, hair: 'short', hairColor: 0, eyes: 0 },
  { id: 'mideast', name: 'Middle Eastern', skin: 4, hair: 'curly', hairColor: 1, eyes: 1 },
  { id: 'native', name: 'Native American', skin: 5, hair: 'long', hairColor: 0, eyes: 0 },
  { id: 'pacific', name: 'Pacific Islander', skin: 6, hair: 'curly', hairColor: 0, eyes: 0 },
  { id: 'mixed', name: 'Mixed', skin: 4, hair: 'curly', hairColor: 1, eyes: 1 },
];
export const HAIR_STYLES = [
  ['bald', 'Bald'], ['buzz', 'Buzz cut'], ['short', 'Short'], ['sidepart', 'Side part'], ['curly', 'Curly'],
  ['afro', 'Afro'], ['long', 'Long'], ['ponytail', 'Ponytail'], ['bun', 'Bun'], ['dreads', 'Locs'],
];
export const HAIR_COLORS = ['#17120f', '#3a2618', '#5e3b22', '#8a5a33', '#c9a061', '#a3472a', '#8d8a86', '#d8d6d2'];
export const HAIR_COLOR_NAMES = ['Black', 'Dark brown', 'Brown', 'Light brown', 'Blonde', 'Red', 'Gray', 'White'];
export const EYE_COLORS = [['Brown', '#5a3a1e'], ['Hazel', '#7a6a2e'], ['Green', '#3f7a4a'], ['Blue', '#3f6fa8'], ['Gray', '#7c8a96']];
export const FACIAL_HAIR = [['none', 'Clean shaven'], ['stubble', 'Stubble'], ['mustache', 'Mustache'], ['goatee', 'Goatee'], ['beard', 'Full beard']];
export const FACES = [
  { name: 'Square jaw', jaw: 1.0, cheek: 0.95, eye: 1.0, brow: 1.2, nose: 1.0, lips: 0.9, age: 0 },
  { name: 'Oval', jaw: 0.88, cheek: 1.0, eye: 1.05, brow: 0.9, nose: 0.9, lips: 1.0, age: 0 },
  { name: 'Round', jaw: 0.95, cheek: 1.08, eye: 0.95, brow: 1.0, nose: 1.1, lips: 1.05, age: 0 },
  { name: 'Long', jaw: 0.9, cheek: 0.9, eye: 0.95, brow: 1.0, nose: 1.15, lips: 0.95, age: 0, long: 1.07 },
  { name: 'Weathered', jaw: 1.0, cheek: 0.95, eye: 0.92, brow: 1.3, nose: 1.1, lips: 0.85, age: 1 },
  { name: 'Soft', jaw: 0.86, cheek: 1.02, eye: 1.12, brow: 0.75, nose: 0.85, lips: 1.15, age: 0, soft: 1 },
];
export const BUILDS = [['slim', 'Slim', 0.88], ['average', 'Average', 1.0], ['athletic', 'Athletic', 1.06], ['heavy', 'Heavy', 1.2]];
export const SHIRTS = [['tee', 'T-shirt'], ['work', 'Work shirt'], ['henley', 'Long-sleeve'], ['hoodie', 'Hoodie'], ['jacket', 'Canvas jacket']];
export const PANTS = [['jeans', 'Jeans'], ['work', 'Work pants'], ['cargo', 'Cargo pants'], ['coveralls', 'Coveralls']];
export const BOOTS = [['tan', 'Tan work boots'], ['black', 'Black work boots'], ['sneakers', 'Sneakers']];
export const HATS = [['none', 'No hat'], ['cap', 'Ball cap'], ['beanie', 'Beanie'], ['backwards', 'Cap (backwards)']];
export const GLOVES = [['none', 'Bare hands'], ['mechanic', 'Mechanic gloves'], ['leather', 'Leather gloves']];
export const VESTS = [
  ['lime', 'Lime ANSI Class 2 vest'], ['orange', 'Orange ANSI Class 2 vest'], ['limeBlack', 'Lime vest, black bottom'],
  ['jacket', 'Hi-vis rain jacket'], ['none', 'No vest'],
];
export const CLOTH_COLORS = ['#1f2a44', '#2b2d31', '#5b6770', '#7a1f1f', '#2f4f3a', '#6b4f2a', '#c9c3b5', '#f2f2f0', '#1e5fbf', '#d86a1a'];

export function defaultAppearance() {
  return {
    face: 0, race: 'white', skin: 1, height: 178, build: 'average', body: 'masc', hair: 'short', hairColor: 2,
    eyes: 0, facialHair: 'stubble', shirt: 'work', shirtColor: 0, pants: 'jeans', pantsColor: 0,
    boots: 'tan', hat: 'cap', hatColor: 3, gloves: 'mechanic', vest: 'lime', name: 'Driver',
  };
}

// --------------------------------------------------------------- textures

function faceTexture(a) {
  const W = 512, H = 256;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const skin = new THREE.Color(SKIN_TONES[a.skin].hex);
  const f = FACES[a.face] ?? FACES[0];
  g.fillStyle = '#' + skin.getHexString();
  g.fillRect(0, 0, W, H);
  // Sphere UV: the front (+z) is centered at u = 0.25.
  const cx = W * 0.25, cy = H * 0.52;
  const dark = skin.clone().multiplyScalar(0.78), darker = skin.clone().multiplyScalar(0.6);
  const hexOf = (col, a2 = 1) => `rgba(${Math.round(col.r * 255)},${Math.round(col.g * 255)},${Math.round(col.b * 255)},${a2})`;
  // Cheek warmth and soft shading.
  const blush = g.createRadialGradient(cx, cy + 10, 10, cx, cy + 10, 90);
  blush.addColorStop(0, 'rgba(200,90,80,0.10)'); blush.addColorStop(1, 'rgba(200,90,80,0)');
  g.fillStyle = blush; g.fillRect(0, 0, W, H);
  // Stubble / beard shadow on the jaw.
  if (a.facialHair === 'stubble' || a.facialHair === 'beard' || a.facialHair === 'goatee') {
    const hc = new THREE.Color(HAIR_COLORS[a.hairColor]);
    g.fillStyle = hexOf(hc, a.facialHair === 'stubble' ? 0.28 : 0.45);
    g.beginPath(); g.ellipse(cx, cy + 46, 62, 30, 0, 0, Math.PI); g.fill();
    g.beginPath(); g.ellipse(cx, cy + 32, 26, 9, 0, 0, Math.PI * 2); g.fill();
  }
  const eyeDX = 26 * f.eye, eyeY = cy - 6;
  const eyeCol = EYE_COLORS[a.eyes]?.[1] ?? '#5a3a1e';
  for (const s of [-1, 1]) {
    const ex = cx + s * eyeDX;
    // Socket shadow.
    g.fillStyle = hexOf(dark, 0.5);
    g.beginPath(); g.ellipse(ex, eyeY - 2, 15 * f.eye, 8, 0, 0, Math.PI * 2); g.fill();
    // Sclera, iris, pupil, highlight.
    g.fillStyle = '#f4f1ea';
    g.beginPath(); g.ellipse(ex, eyeY, 11 * f.eye, 5.5 * f.eye, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = eyeCol; g.beginPath(); g.arc(ex, eyeY, 4.6 * f.eye, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#0d0b0a'; g.beginPath(); g.arc(ex, eyeY, 2.2 * f.eye, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(ex - 1.5, eyeY - 1.5, 1.1, 0, Math.PI * 2); g.fill();
    // Upper lid line and lashes.
    g.strokeStyle = hexOf(darker, 0.9); g.lineWidth = 2;
    g.beginPath(); g.ellipse(ex, eyeY + 0.5, 11.5 * f.eye, 6 * f.eye, 0, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
    // Brow.
    g.fillStyle = HAIR_COLORS[a.hairColor];
    g.save(); g.translate(ex, eyeY - 14); g.rotate(s * -0.08);
    roundRect(g, -14, -2.5 * f.brow, 28, 5 * f.brow, 2.5); g.fill(); g.restore();
    if (f.age) { g.strokeStyle = hexOf(darker, 0.35); g.lineWidth = 1; g.beginPath(); g.moveTo(ex + s * 14, eyeY + 2); g.lineTo(ex + s * 20, eyeY + 6); g.stroke(); }
  }
  // Nose: shading on the sides and nostrils.
  g.fillStyle = hexOf(dark, 0.55);
  g.beginPath(); g.ellipse(cx - 7 * f.nose, cy + 16, 3.5, 3, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(cx + 7 * f.nose, cy + 16, 3.5, 3, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = hexOf(dark, 0.35); g.lineWidth = 2;
  g.beginPath(); g.moveTo(cx - 4, eyeY + 4); g.quadraticCurveTo(cx - 7 * f.nose, cy + 10, cx - 9 * f.nose, cy + 15); g.stroke();
  // Mouth.
  const lip = new THREE.Color(SKIN_TONES[a.skin].hex).lerp(new THREE.Color('#9a4a42'), 0.35);
  g.fillStyle = hexOf(lip);
  g.beginPath(); g.ellipse(cx, cy + 31, 13 * f.lips, 3.4 * f.lips, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = hexOf(darker, 0.7); g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(cx - 13 * f.lips, cy + 31); g.quadraticCurveTo(cx, cy + 33, cx + 13 * f.lips, cy + 31); g.stroke();
  if (a.facialHair === 'mustache' || a.facialHair === 'goatee' || a.facialHair === 'beard') {
    g.fillStyle = HAIR_COLORS[a.hairColor];
    g.beginPath(); g.ellipse(cx, cy + 25, 17, 4.5, 0, Math.PI, 0, false); g.fill();
    roundRect(g, cx - 17, cy + 22, 34, 6, 3); g.fill();
  }
  if (a.facialHair === 'goatee') {
    g.fillStyle = HAIR_COLORS[a.hairColor];
    g.beginPath(); g.ellipse(cx, cy + 44, 12, 10, 0, 0, Math.PI * 2); g.fill();
  }
  // Ears get a touch of shading (sides of the sphere).
  for (const u of [0.5, 0.0, 1.0]) { g.fillStyle = hexOf(dark, 0.15); g.fillRect(u * W - 20, cy - 20, 40, 50); }
  const t = canvasTexture(c);
  return t;
}

function hiVisTexture(kind) {
  const W = 512, H = 256;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const fluoro = kind === 'orange' ? '#ff6a13' : '#c6f81a';
  g.fillStyle = fluoro; g.fillRect(0, 0, W, H);
  // Mesh weave.
  g.fillStyle = 'rgba(0,0,0,0.06)';
  for (let y = 0; y < H; y += 4) for (let x = (y / 4) % 2 * 2; x < W; x += 4) g.fillRect(x, y, 2, 2);
  if (kind === 'limeBlack') { g.fillStyle = '#16171a'; g.fillRect(0, H * 0.72, W, H * 0.28); }
  // Silver retroreflective tape: two horizontal bands + vertical bands over the shoulders (front and back).
  const tape = (x, y, w, h) => {
    const gr = g.createLinearGradient(x, y, x, y + h);
    gr.addColorStop(0, '#d6d9dc'); gr.addColorStop(0.5, '#f3f5f7'); gr.addColorStop(1, '#b9bdc1');
    g.fillStyle = gr; g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let i = x; i < x + w; i += 6) g.fillRect(i, y, 1, h);
  };
  tape(0, H * 0.58, W, 18);
  tape(0, H * 0.38, W, 18);
  for (const u of [0.18, 0.32, 0.68, 0.82]) tape(u * W - 9, 0, 18, H * 0.58);
  // Zipper / front closure line at u = 0.25 (front center).
  g.fillStyle = 'rgba(30,30,30,0.6)'; g.fillRect(W * 0.25 - 1.5, 0, 3, H);
  return canvasTexture(c);
}

function fabricNormal() {
  const t = TX.texturedPlastic().normalMap.clone();
  t.needsUpdate = true;
  t.repeat.set(4, 4);
  return t;
}

// --------------------------------------------------------------- builder

const capsule = (r, len, seg = 10) => {
  const g = new THREE.CapsuleGeometry(r, Math.max(0.001, len), 6, seg);
  g.translate(0, -len / 2 - r * 0.2, 0);
  return g;
};

export function buildAvatar(app) {
  const a = { ...defaultAppearance(), ...app };
  const scale = a.height / 178;
  const buildK = (BUILDS.find((b) => b[0] === a.build) ?? BUILDS[1])[2];
  const fem = a.body === 'fem';
  const root = new THREE.Group();
  root.name = 'avatar';
  const body = new THREE.Group();     // scaled by height
  body.scale.setScalar(scale);
  root.add(body);
  const skinMat = new THREE.MeshStandardMaterial({ color: SKIN_TONES[a.skin].hex, roughness: 0.62 });
  const nrm = fabricNormal();
  const clothMat = (hex, rough = 0.9) => new THREE.MeshStandardMaterial({ color: hex, roughness: rough, normalMap: nrm, normalScale: new THREE.Vector2(0.4, 0.4) });
  const shirtCol = CLOTH_COLORS[a.shirtColor] ?? CLOTH_COLORS[0];
  const pantsCol = a.pants === 'jeans' ? ['#2a3a5a', '#1f2a44', '#3b4f6e', '#22262c'][a.pantsColor % 4] : CLOTH_COLORS[a.pantsColor] ?? '#5b5040';
  const shirtMat = clothMat(shirtCol);
  const pantsMat = clothMat(a.pants === 'work' ? (CLOTH_COLORS[a.pantsColor] ?? '#6b5a3e') : pantsCol);
  const coverall = a.pants === 'coveralls';
  const upperMat = coverall ? pantsMat : shirtMat;
  const bootMat = new THREE.MeshStandardMaterial({ color: a.boots === 'tan' ? 0x8a5a2b : a.boots === 'black' ? 0x1b1b1c : 0xe6e6e6, roughness: 0.7 });
  const soleMat = new THREE.MeshStandardMaterial({ color: a.boots === 'sneakers' ? 0xf2f2f2 : 0x241a12, roughness: 0.9 });
  const gloveMat = a.gloves === 'mechanic' ? new THREE.MeshStandardMaterial({ color: 0x2a2b2e, roughness: 0.75 }) : a.gloves === 'leather' ? new THREE.MeshStandardMaterial({ color: 0xc8a46e, roughness: 0.8 }) : skinMat;
  const hairMat = new THREE.MeshStandardMaterial({ color: HAIR_COLORS[a.hairColor], roughness: 0.75, normalMap: nrm, normalScale: new THREE.Vector2(1.2, 1.2) });
  const mats = { skinMat, shirtMat, pantsMat, bootMat, gloveMat, hairMat };
  const mk = (geo, mat, parent, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  const sw = (fem ? 0.9 : 1.0) * buildK;    // shoulder/chest width factor
  const hw = (fem ? 1.08 : 1.0) * buildK;   // hip width factor
  // Joints.
  const hips = new THREE.Group(); hips.position.y = 0.96; body.add(hips);
  const spine = new THREE.Group(); spine.position.y = 0.1; hips.add(spine);
  const chest = new THREE.Group(); chest.position.y = 0.22; spine.add(chest);
  const neck = new THREE.Group(); neck.position.y = 0.26; chest.add(neck);
  const head = new THREE.Group(); head.position.y = 0.1; neck.add(head);

  // Pelvis and torso (lathe profiles, flattened front-to-back).
  const pelvis = mk(new THREE.SphereGeometry(0.16, 20, 12), pantsMat, hips, 0, 0.02, 0);
  pelvis.scale.set(1.05 * hw, 0.7, 0.72 * hw);
  const torsoProfile = [[0.001, -0.06], [0.135, -0.05], [0.142, 0.02], [0.135, 0.1], [0.15, 0.2], [0.17, 0.3], [0.168, 0.38], [0.13, 0.44], [0.06, 0.48], [0.001, 0.49]].map(([r, y]) => new THREE.Vector2(r, y));
  const torsoGeo = new THREE.LatheGeometry(torsoProfile, 24);
  const torso = mk(torsoGeo, upperMat, spine, 0, -0.06, 0);
  torso.scale.set(1.12 * sw, 1, 0.68 * Math.max(sw, buildK));
  if (a.build === 'heavy') { const belly = mk(new THREE.SphereGeometry(0.15, 16, 12), upperMat, spine, 0, 0.04, 0.06); belly.scale.set(1.05, 0.9, 0.85); }
  if (fem) { for (const s of [-1, 1]) { const b = mk(new THREE.SphereGeometry(0.06, 14, 10), upperMat, chest, s * 0.055, 0.04, 0.085); b.scale.set(1, 0.9, 0.8); } }
  // Belt.
  const belt = mk(new THREE.TorusGeometry(0.15, 0.018, 8, 28), new THREE.MeshStandardMaterial({ color: 0x2a1d14, roughness: 0.6 }), hips, 0, 0.1, 0);
  belt.rotation.x = Math.PI / 2;
  belt.scale.set(1.08 * hw, 0.72 * hw, 1);
  if (coverall) belt.visible = false;
  // Hoodie hood / jacket collar.
  if (a.shirt === 'hoodie') { const hood = mk(new THREE.TorusGeometry(0.1, 0.045, 8, 20), shirtMat, chest, 0, 0.22, -0.03); hood.rotation.x = Math.PI / 2.4; }
  if (a.shirt === 'work' || a.shirt === 'jacket') { const col = mk(new THREE.TorusGeometry(0.075, 0.022, 6, 18), a.shirt === 'jacket' ? clothMat('#6b5a3e') : shirtMat, chest, 0, 0.24, 0.0); col.rotation.x = Math.PI / 2.2; }

  // Hi-vis vest: a slightly bigger torso shell with reflective tape.
  let vest = null;
  if (a.vest !== 'none') {
    const kind = a.vest === 'orange' ? 'orange' : a.vest === 'limeBlack' ? 'limeBlack' : 'lime';
    const vt = hiVisTexture(kind);
    const vmat = new THREE.MeshStandardMaterial({ map: vt, roughness: 0.7, emissive: kind === 'orange' ? 0xff5a00 : 0xa8e000, emissiveIntensity: 0.06, emissiveMap: vt });
    const vp = [[0.15, -0.02], [0.152, 0.06], [0.158, 0.16], [0.178, 0.27], [0.18, 0.36], [0.15, 0.42], [0.11, 0.45]].map(([r, y]) => new THREE.Vector2(r, y));
    vest = mk(new THREE.LatheGeometry(vp, 28, 0, Math.PI * 2), vmat, spine, 0, -0.06, 0);
    vest.scale.copy(torso.scale).multiplyScalar(1.03);
    vest.material.side = THREE.DoubleSide;
    if (a.vest === 'jacket') {
      // Long sleeves in hi-vis too.
      mats.sleeveOverride = vmat;
    }
  }

  // Neck and head.
  mk(new THREE.CylinderGeometry(0.052, 0.06, 0.12, 14), skinMat, neck, 0, 0.04, 0);
  const f = FACES[a.face] ?? FACES[0];
  const headGeo = new THREE.SphereGeometry(0.105, 40, 28);
  const hp = headGeo.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    let x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i);
    // Narrow the jaw, flatten the back of the skull a little, push the face forward.
    const lowness = clamp(-y / 0.105, 0, 1);
    x *= 1 - lowness * 0.28 * (2 - f.jaw) + (f.cheek - 1) * 0.5 * (1 - Math.abs(y / 0.105));
    z *= 1 + (z > 0 ? 0.08 : -0.04);
    y *= (f.long ?? 1) * 1.18;
    if (z > 0 && y < 0.02 && y > -0.11) z += 0.01 * (1 - Math.abs(x) / 0.05) * (Math.abs(x) < 0.05 ? 1 : 0);
    hp.setXYZ(i, x, y, z);
  }
  headGeo.computeVertexNormals();
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTexture(a), roughness: 0.6 });
  const headMesh = mk(headGeo, faceMat, head, 0, 0.1, 0);
  // Nose, ears.
  const nose = mk(new THREE.SphereGeometry(0.02, 12, 10), skinMat, head, 0, 0.085, 0.112);
  nose.scale.set(0.9 * f.nose, 1.3, 1.2);
  for (const s of [-1, 1]) {
    const ear = mk(new THREE.SphereGeometry(0.024, 10, 8), skinMat, head, s * 0.1, 0.1, 0.0);
    ear.scale.set(0.45, 1.1, 0.8);
  }
  // Hair.
  buildHair(a, head, hairMat, mk);
  // Facial hair volume for a full beard.
  if (a.facialHair === 'beard') {
    const bg = new THREE.SphereGeometry(0.108, 24, 16, 0, Math.PI * 2, Math.PI * 0.52, Math.PI * 0.4);
    const beard = mk(bg, hairMat, head, 0, 0.1, 0.006);
    beard.scale.set(0.98, 1.2, 1.08);
  }
  // Hat.
  if (a.hat !== 'none') {
    const hatMat = clothMat(CLOTH_COLORS[a.hatColor] ?? '#7a1f1f', 0.85);
    if (a.hat === 'beanie') {
      const b = mk(new THREE.SphereGeometry(0.115, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), hatMat, head, 0, 0.12, -0.005);
      b.scale.set(1, 1.15, 1.05);
      mk(new THREE.TorusGeometry(0.108, 0.018, 8, 28), hatMat, head, 0, 0.12, 0).rotation.x = Math.PI / 2;
    } else {
      const crown = mk(new THREE.SphereGeometry(0.113, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), hatMat, head, 0, 0.135, 0);
      crown.scale.set(1, 0.9, 1.05);
      const brim = mk(new THREE.CylinderGeometry(0.09, 0.09, 0.012, 24, 1, false, -Math.PI / 2, Math.PI), hatMat, head, 0, 0.14, a.hat === 'backwards' ? -0.09 : 0.09);
      brim.scale.set(1, 1, 1.2);
      if (a.hat === 'backwards') brim.rotation.y = Math.PI;
      brim.rotation.x = a.hat === 'backwards' ? 0.15 : -0.15;
      const button = mk(new THREE.SphereGeometry(0.012, 8, 6), hatMat, head, 0, 0.237, 0);
    }
  }

  // Arms.
  const arm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.2 * sw, 0.33, 0);
    chest.add(shoulder);
    const longSleeve = a.shirt !== 'tee' || coverall;
    const sleeveMat = mats.sleeveOverride ?? upperMat;
    mk(new THREE.SphereGeometry(0.058 * buildK, 14, 10), sleeveMat, shoulder, 0, -0.01, 0);
    mk(capsule(0.05 * buildK, 0.22), sleeveMat, shoulder, 0, -0.02, 0);
    const elbow = new THREE.Group(); elbow.position.y = -0.29; shoulder.add(elbow);
    mk(capsule(0.043 * buildK, 0.2), longSleeve ? sleeveMat : skinMat, elbow, 0, 0, 0);
    if (!longSleeve) mk(new THREE.CylinderGeometry(0.056 * buildK, 0.053 * buildK, 0.08, 14), sleeveMat, shoulder, 0, -0.1, 0);
    const wrist = new THREE.Group(); wrist.position.y = -0.27; elbow.add(wrist);
    // Hand: palm + thumb + fingers block.
    const palm = mk(new THREE.BoxGeometry(0.075, 0.09, 0.03), gloveMat, wrist, 0, -0.045, 0);
    const fingers = mk(new THREE.CapsuleGeometry(0.016, 0.05, 4, 8), gloveMat, wrist, 0, -0.105, 0.005);
    fingers.scale.set(2.2, 1, 1);
    const thumb = mk(new THREE.CapsuleGeometry(0.011, 0.035, 4, 8), gloveMat, wrist, side * 0.04, -0.05, 0.015);
    thumb.rotation.z = side * 0.6;
    const grip = new THREE.Group(); grip.position.set(0, -0.09, 0.02); wrist.add(grip);
    return { shoulder, elbow, wrist, grip };
  };
  const L = arm(1), R = arm(-1);

  // Legs.
  const leg = (side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.09 * hw, -0.02, 0);
    hips.add(hip);
    mk(capsule(0.072 * hw, 0.36), pantsMat, hip, 0, 0, 0);
    const knee = new THREE.Group(); knee.position.y = -0.46; hip.add(knee);
    mk(capsule(0.055 * Math.sqrt(hw), 0.36), pantsMat, knee, 0, 0, 0);
    if (a.pants === 'cargo') mk(new THREE.BoxGeometry(0.03, 0.12, 0.1), pantsMat, hip, side * 0.075, -0.25, 0);
    const ankle = new THREE.Group(); ankle.position.y = -0.45; knee.add(ankle);
    const boot = mk(new THREE.BoxGeometry(0.1, 0.1, 0.26, 2, 2, 2), bootMat, ankle, 0, -0.03, 0.04);
    const sole = mk(new THREE.BoxGeometry(0.105, 0.025, 0.27), soleMat, ankle, 0, -0.085, 0.04);
    const toe = mk(new THREE.SphereGeometry(0.052, 12, 8), bootMat, ankle, 0, -0.04, 0.15);
    toe.scale.set(1, 0.8, 1.1);
    return { hip, knee, ankle };
  };
  const LL = leg(1), RL = leg(-1);

  root.traverse((o) => { if (o.isMesh) o.userData.avatar = true; });
  const rig = { root, body, hips, spine, chest, neck, head, L, R, LL, RL, scale, headMesh, vest };
  return new Avatar(rig, a);
}

function buildHair(a, head, hairMat, mk) {
  const style = a.hair;
  if (style === 'bald') return;
  const cap = (thetaLen, s = 1.06, y = 0.105) => {
    const g = new THREE.SphereGeometry(0.106, 32, 18, 0, Math.PI * 2, 0, thetaLen);
    const m = mk(g, hairMat, head, 0, y, -0.004);
    m.scale.set(s, s * 1.12, s * 1.06);
    return m;
  };
  if (style === 'buzz') { const m = cap(Math.PI * 0.46, 1.02); m.material = hairMat.clone(); m.material.roughness = 0.9; return; }
  if (style === 'short' || style === 'sidepart') {
    cap(Math.PI * 0.42, 1.07);
    // Back and sides lower than the front hairline.
    const back = new THREE.SphereGeometry(0.106, 24, 14, Math.PI * 0.15, Math.PI * 0.7, Math.PI * 0.3, Math.PI * 0.32);
    const b = mk(back, hairMat, head, 0, 0.105, -0.004);
    b.scale.set(1.06, 1.18, 1.08);
    b.rotation.y = Math.PI;
    if (style === 'sidepart') { const swoop = mk(new THREE.SphereGeometry(0.05, 12, 8), hairMat, head, 0.03, 0.205, 0.05); swoop.scale.set(1.6, 0.5, 1); }
    return;
  }
  if (style === 'curly' || style === 'afro') {
    const big = style === 'afro';
    const g = new THREE.IcosahedronGeometry(big ? 0.15 : 0.118, 3);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i);
      const n = 1 + 0.06 * Math.sin(v.x * 140) * Math.sin(v.y * 130) * Math.sin(v.z * 120);
      v.multiplyScalar(n);
      if (v.y < -0.01 + (v.z > 0 ? 0.03 : -0.04)) v.y = Math.max(v.y, (v.z > 0 ? 0.02 : -0.03));
      p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals();
    mk(g, hairMat, head, 0, big ? 0.15 : 0.13, big ? -0.02 : -0.01);
    return;
  }
  if (style === 'long' || style === 'ponytail' || style === 'bun' || style === 'dreads') {
    cap(Math.PI * 0.45, 1.07);
    const back = new THREE.SphereGeometry(0.106, 24, 14, Math.PI * 0.1, Math.PI * 0.8, Math.PI * 0.3, Math.PI * 0.35);
    const b = mk(back, hairMat, head, 0, 0.105, -0.004);
    b.scale.set(1.07, 1.18, 1.09);
    b.rotation.y = Math.PI;
    if (style === 'long') {
      const fall = mk(new THREE.BoxGeometry(0.2, 0.28, 0.05), hairMat, head, 0, -0.02, -0.085);
      fall.rotation.x = 0.1;
    } else if (style === 'ponytail') {
      const tail = mk(new THREE.CapsuleGeometry(0.03, 0.16, 4, 8), hairMat, head, 0, 0.06, -0.14);
      tail.rotation.x = 0.35;
    } else if (style === 'bun') {
      mk(new THREE.SphereGeometry(0.05, 14, 10), hairMat, head, 0, 0.2, -0.1);
    } else {
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 1.4 + Math.PI * 0.8;
        const d = mk(new THREE.CapsuleGeometry(0.012, 0.22, 3, 6), hairMat, head, Math.cos(a) * 0.1, 0.0, Math.sin(a) * 0.1 - 0.02);
        d.rotation.x = Math.sin(a) * -0.2;
      }
    }
  }
}

// ---------------------------------------------------------------- poses

export class Avatar {
  constructor(rig, appearance) {
    this.rig = rig;
    this.app = appearance;
    this.root = rig.root;
    this.phase = 0;
    this.pose = 'idle';
    this.blend = {};
    this.t = 0;
    this.headLookPitch = 0;
  }
  get eyeHeight() { return 1.66 * this.rig.scale; }
  setHeadVisible(v) { this.rig.head.visible = v; }

  // speed: m/s on foot. pose: 'idle'|'walk'|'kneel'|'sit'|'lie'|'pull'|'reach'
  update(dt, { speed = 0, pose = 'auto', carrying = false, action = 0, handTargets = null } = {}) {
    const r = this.rig;
    // Leaving IK: clear the twist it left on the arms before the pose blend.
    if (!handTargets && this.ik) {
      this.ik = false;
      for (const arm of [r.L, r.R]) { arm.shoulder.rotation.y = 0; arm.elbow.rotation.set(arm.elbow.rotation.x, 0, 0); }
    }
    this.t += dt;
    const target = {};
    const set = (k, v) => { target[k] = v; };
    const walkAmt = clamp(speed / 1.5, 0, 1);
    const runAmt = clamp((speed - 2.2) / 2.5, 0, 1);
    if (speed > 0.05) this.phase += dt * (5.2 + speed * 1.3);
    const s = Math.sin(this.phase), c = Math.cos(this.phase);
    const swing = (0.42 + runAmt * 0.35) * walkAmt;
    const breathe = Math.sin(this.t * 1.8) * 0.015;
    // Defaults: standing.
    set('hips.y', 0.96 - Math.abs(c) * 0.03 * walkAmt);
    set('hips.rx', 0); set('spine.rx', runAmt * 0.18 + breathe); set('chest.rx', 0); set('neck.rx', 0);
    set('LL.hip.rx', s * swing); set('RL.hip.rx', -s * swing);
    set('LL.knee.rx', Math.max(0, -c) * swing * 1.3 + 0.05); set('RL.knee.rx', Math.max(0, c) * swing * 1.3 + 0.05);
    set('LL.ankle.rx', 0); set('RL.ankle.rx', 0);
    set('L.shoulder.rx', -s * swing * 0.8); set('R.shoulder.rx', s * swing * 0.8);
    set('L.shoulder.rz', 0.08); set('R.shoulder.rz', -0.08);
    set('L.elbow.rx', -0.15 - runAmt * 1.0); set('R.elbow.rx', -0.15 - runAmt * 1.0);
    set('body.rx', 0); set('body.y', 0);
    const P = pose === 'auto' ? 'stand' : pose;
    if (carrying) { set('R.shoulder.rx', -0.55); set('R.elbow.rx', -0.9); set('R.shoulder.rz', -0.05); }
    if (P === 'reach') { set('R.shoulder.rx', -1.25 - action * 0.2); set('R.elbow.rx', -0.25); set('L.shoulder.rx', -0.9); set('L.elbow.rx', -0.3); }
    if (P === 'pull') {
      // Feet planted, leaning back hauling on something.
      const tug = Math.sin(this.t * 14) * 0.08 * action;
      set('hips.y', 0.82); set('spine.rx', -0.35 + tug); set('LL.hip.rx', -0.55); set('RL.hip.rx', 0.2); set('LL.knee.rx', 0.8); set('RL.knee.rx', 0.35);
      set('L.shoulder.rx', -1.3 + tug); set('R.shoulder.rx', -1.3 + tug); set('L.elbow.rx', -0.2); set('R.elbow.rx', -0.2);
    }
    if (P === 'kneel') {
      set('hips.y', 0.52); set('spine.rx', 0.35); set('LL.hip.rx', -1.45); set('LL.knee.rx', 1.5); set('LL.ankle.rx', -0.1);
      set('RL.hip.rx', 0.1); set('RL.knee.rx', 1.9); set('RL.ankle.rx', 0.5);
      set('L.shoulder.rx', -0.9 - action * 0.3); set('R.shoulder.rx', -1.0 - Math.sin(this.t * 10) * 0.15 * action); set('L.elbow.rx', -0.5); set('R.elbow.rx', -0.6);
    }
    if (P === 'sit') {
      // Knees a bit above the hips, shins angled to the pedals.
      set('hips.y', 0.0); set('LL.hip.rx', -1.72); set('RL.hip.rx', -1.66); set('LL.knee.rx', 1.42); set('RL.knee.rx', 1.3);
      set('L.shoulder.rx', -1.0); set('R.shoulder.rx', -1.0); set('L.elbow.rx', -0.5); set('R.elbow.rx', -0.5);
      set('L.shoulder.rz', 0.25); set('R.shoulder.rz', -0.25); set('spine.rx', -0.05);
    }
    if (P === 'lie') {
      // On the back on a creeper, arms reaching up at the underside.
      set('body.rx', -Math.PI / 2); set('body.y', 0.14); set('hips.y', 0.96);
      set('LL.hip.rx', -0.1); set('RL.hip.rx', -0.1); set('LL.knee.rx', 0.35); set('RL.knee.rx', 0.35);
      set('L.shoulder.rx', -2.6 + Math.sin(this.t * 3) * 0.1 * action); set('R.shoulder.rx', -2.8 - action * 0.2); set('L.elbow.rx', -0.4); set('R.elbow.rx', -0.3);
      set('spine.rx', 0); set('neck.rx', -0.3);
    }
    // Apply with smoothing.
    const k = 14;
    for (const [key, v] of Object.entries(target)) {
      const cur = this.blend[key] ?? v;
      const nv = damp(cur, v, k, dt);
      this.blend[key] = nv;
      applyKey(r, key, nv);
    }
    // Hands on something (the steering wheel): two-bone IK on each arm.
    if (handTargets) {
      this.ik = true;
      this.root.updateWorldMatrix(true, true);
      solveArm(r.L, r.chest, handTargets.L, 1);
      solveArm(r.R, r.chest, handTargets.R, -1);
    }
  }
}

// Puts an arm's grip on a world-space target with the elbow hanging down and
// out. Bone lengths match arm(): shoulder→elbow 0.29, elbow→grip 0.36.
const _t = new THREE.Vector3(), _d = new THREE.Vector3(), _u = new THREE.Vector3(), _n = new THREE.Vector3();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _f = new THREE.Vector3(), _pole = new THREE.Vector3();
const _basis = new THREE.Matrix4();
const X_AXIS = new THREE.Vector3(1, 0, 0);
function solveArm(arm, chest, target, side) {
  const A = 0.29, B = 0.36;
  const P = arm.shoulder.position;
  const T = chest.worldToLocal(_t.copy(target));
  _d.subVectors(T, P);
  const dist = clamp(_d.length(), 0.1, A + B - 0.002);
  _d.normalize();
  const phi = Math.acos(clamp((A * A + dist * dist - B * B) / (2 * A * dist), -1, 1));
  _pole.set(side * 0.55, -1, -0.25);
  _n.crossVectors(_d, _pole).normalize();
  _u.copy(_d).applyAxisAngle(_n, phi);
  // Shoulder frame: local -Y down the upper arm, local X on the elbow hinge.
  _y.copy(_u).negate();
  _x.copy(_n);
  _z.crossVectors(_x, _y);
  arm.shoulder.quaternion.setFromRotationMatrix(_basis.makeBasis(_x, _y, _z));
  const bend = Math.PI - Math.acos(clamp((A * A + B * B - dist * dist) / (2 * A * B), -1, 1));
  // Bend whichever way lands the hand on the target.
  let best = 1, bestD = Infinity;
  for (const sgn of [1, -1]) {
    _f.set(0, -A - B * Math.cos(sgn * bend), -B * Math.sin(sgn * bend)).applyQuaternion(arm.shoulder.quaternion).add(P);
    const dd = _f.distanceTo(T);
    if (dd < bestD) { bestD = dd; best = sgn; }
  }
  arm.elbow.quaternion.setFromAxisAngle(X_AXIS, best * bend);
}

function applyKey(r, key, v) {
  switch (key) {
    case 'hips.y': r.hips.position.y = v; return;
    case 'hips.rx': r.hips.rotation.x = v; return;
    case 'spine.rx': r.spine.rotation.x = v; return;
    case 'chest.rx': r.chest.rotation.x = v; return;
    case 'neck.rx': r.neck.rotation.x = v; return;
    case 'body.rx': r.body.rotation.x = v; return;
    case 'body.y': r.body.position.y = v; return;
  }
  const [limb, joint, ax] = key.split('.');
  const g = r[limb]?.[joint];
  if (!g) return;
  if (ax === 'rx') g.rotation.x = v; else if (ax === 'rz') g.rotation.z = v;
}
