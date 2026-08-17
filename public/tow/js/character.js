// The driver. Blocky limbs, a drawn-on face, and a wardrobe you pick before
// you ever touch a truck.
import * as THREE from 'three';
import { box, sphere, makeCanvas, canvasTexture, TAU } from './util.js';
import { mat, texMat } from './materials.js';

export const SKIN_TONES = [
  { id: 'porcelain', name: 'Porcelain', hex: 0xf6ddc9 },
  { id: 'fair', name: 'Fair', hex: 0xefc9a8 },
  { id: 'olive', name: 'Olive', hex: 0xd9a878 },
  { id: 'tan', name: 'Tan', hex: 0xbe8a5c },
  { id: 'bronze', name: 'Bronze', hex: 0x9c6b42 },
  { id: 'brown', name: 'Brown', hex: 0x7a4b2c },
  { id: 'deep', name: 'Deep', hex: 0x54301c },
  { id: 'ebony', name: 'Ebony', hex: 0x3a2013 },
];

export const HAIR_STYLES = [
  { id: 'buzz', name: 'Buzz cut' },
  { id: 'short', name: 'Short' },
  { id: 'curls', name: 'Curls' },
  { id: 'ponytail', name: 'Ponytail' },
  { id: 'locs', name: 'Locs' },
  { id: 'bun', name: 'Top bun' },
  { id: 'bald', name: 'Bald' },
  { id: 'mullet', name: 'Mullet' },
];

export const HAIR_COLORS = [
  { id: 'black', hex: 0x1b1613 }, { id: 'brown', hex: 0x4a2f1d },
  { id: 'chestnut', hex: 0x6b4423 }, { id: 'blonde', hex: 0xd9b26a },
  { id: 'ginger', hex: 0xa8481f }, { id: 'grey', hex: 0x9a9a97 },
  { id: 'white', hex: 0xe6e4df }, { id: 'blue', hex: 0x2b5fa8 },
];

export const FACES = [
  { id: 'neutral', name: 'Neutral' },
  { id: 'grin', name: 'Grin' },
  { id: 'focused', name: 'Focused' },
  { id: 'tired', name: 'Long shift' },
  { id: 'smirk', name: 'Smirk' },
  { id: 'shades', name: 'Shades' },
  { id: 'freckles', name: 'Freckles' },
  { id: 'stubble', name: 'Stubble' },
];

export const BUILDS = [
  { id: 'slim', name: 'Slim', w: 0.86 },
  { id: 'average', name: 'Average', w: 1.0 },
  { id: 'stocky', name: 'Stocky', w: 1.16 },
  { id: 'heavy', name: 'Heavy', w: 1.3 },
];

export const SHIRTS = [
  { id: 'workblue', name: 'Blue work shirt', hex: 0x2f5d8c },
  { id: 'flannel', name: 'Red flannel', hex: 0x9c2f2f, pattern: 'plaid' },
  { id: 'tee', name: 'Plain tee', hex: 0xe8e9e6 },
  { id: 'hoodie', name: 'Grey hoodie', hex: 0x565a60, hood: true },
  { id: 'company', name: 'Company polo', hex: 0x1e2a38 },
  { id: 'thermal', name: 'Thermal', hex: 0x4b3f33 },
];

export const PANTS = [
  { id: 'jeans', name: 'Jeans', hex: 0x37506e },
  { id: 'carhartt', name: 'Duck canvas', hex: 0xb98a3f },
  { id: 'cargo', name: 'Cargo pants', hex: 0x4a4f42 },
  { id: 'black', name: 'Black work pants', hex: 0x22242a },
  { id: 'shorts', name: 'Shorts', hex: 0x3a4450, short: true },
];

export const VESTS = [
  { id: 'hivis_yellow', name: 'Hi-vis yellow', hex: 0xd8e638 },
  { id: 'hivis_orange', name: 'Hi-vis orange', hex: 0xf26b1f },
  { id: 'hivis_lime', name: 'Hi-vis lime', hex: 0x9fe83a },
  { id: 'hivis_class3', name: 'Class 3 jacket', hex: 0xf0a80c, sleeves: true },
];

export const HATS = [
  { id: 'none', name: 'No hat' },
  { id: 'cap', name: 'Ball cap' },
  { id: 'beanie', name: 'Beanie' },
  { id: 'hardhat', name: 'Hard hat' },
  { id: 'trucker', name: 'Trucker cap' },
];

export function defaultCharacter() {
  return {
    name: 'Driver',
    skin: 'tan', face: 'neutral', hair: 'short', hairColor: 'brown',
    height: 1.0, build: 'average',
    shirt: 'workblue', pants: 'jeans', vest: 'hivis_yellow', vestOn: true,
    hat: 'cap', gloves: true, boots: true,
  };
}

/* ------------------------------------------------------------------- faces */

function faceTexture(faceId, skinHex) {
  const c = makeCanvas(256, 256);
  const x = c.getContext('2d');
  const skin = '#' + skinHex.toString(16).padStart(6, '0');
  x.fillStyle = skin; x.fillRect(0, 0, 256, 256);
  const eye = (ex, ey, r = 16) => {
    x.fillStyle = '#ffffff';
    x.beginPath(); x.ellipse(ex, ey, r, r * 1.05, 0, 0, TAU); x.fill();
    x.fillStyle = '#20160f';
    x.beginPath(); x.arc(ex, ey + 2, r * 0.5, 0, TAU); x.fill();
  };
  const brow = (bx, by, tilt) => {
    x.save(); x.translate(bx, by); x.rotate(tilt);
    x.fillStyle = '#3b2a1c'; x.fillRect(-20, -5, 40, 9); x.restore();
  };
  switch (faceId) {
    case 'grin':
      eye(88, 108); eye(168, 108);
      x.strokeStyle = '#3a241a'; x.lineWidth = 8; x.beginPath();
      x.arc(128, 150, 40, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke();
      x.fillStyle = '#fff'; x.fillRect(100, 168, 56, 10);
      break;
    case 'focused':
      eye(88, 110, 13); eye(168, 110, 13);
      brow(88, 84, 0.2); brow(168, 84, -0.2);
      x.strokeStyle = '#3a241a'; x.lineWidth = 7;
      x.beginPath(); x.moveTo(102, 172); x.lineTo(154, 168); x.stroke();
      break;
    case 'tired':
      eye(88, 112, 12); eye(168, 112, 12);
      x.strokeStyle = 'rgba(70,40,30,.35)'; x.lineWidth = 6;
      x.beginPath(); x.moveTo(70, 134); x.lineTo(106, 134); x.moveTo(150, 134); x.lineTo(186, 134); x.stroke();
      x.strokeStyle = '#3a241a'; x.lineWidth = 6;
      x.beginPath(); x.moveTo(104, 176); x.lineTo(152, 176); x.stroke();
      break;
    case 'smirk':
      eye(88, 108); eye(168, 108);
      x.strokeStyle = '#3a241a'; x.lineWidth = 8; x.beginPath();
      x.moveTo(100, 172); x.quadraticCurveTo(132, 178, 158, 160); x.stroke();
      break;
    case 'shades':
      x.fillStyle = '#15171c';
      x.fillRect(52, 92, 152, 36);
      x.fillRect(120, 100, 16, 8);
      x.fillStyle = '#2b3038'; x.fillRect(58, 98, 56, 22); x.fillRect(142, 98, 56, 22);
      x.strokeStyle = '#3a241a'; x.lineWidth = 8; x.beginPath();
      x.arc(128, 152, 34, 0.2 * Math.PI, 0.8 * Math.PI); x.stroke();
      break;
    case 'freckles':
      eye(88, 108); eye(168, 108);
      x.fillStyle = 'rgba(120,70,40,.5)';
      for (let i = 0; i < 22; i++) {
        const fx = 60 + Math.random() * 136, fy = 128 + Math.random() * 26;
        x.beginPath(); x.arc(fx, fy, 3, 0, TAU); x.fill();
      }
      x.strokeStyle = '#3a241a'; x.lineWidth = 8; x.beginPath();
      x.arc(128, 150, 36, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke();
      break;
    case 'stubble':
      eye(88, 108); eye(168, 108);
      x.fillStyle = 'rgba(35,25,20,.35)';
      x.beginPath(); x.ellipse(128, 180, 74, 52, 0, 0, TAU); x.fill();
      x.fillStyle = skin;
      x.beginPath(); x.ellipse(128, 150, 60, 26, 0, 0, TAU); x.fill();
      x.strokeStyle = '#2c1d15'; x.lineWidth = 8; x.beginPath();
      x.moveTo(104, 174); x.lineTo(154, 174); x.stroke();
      break;
    default:
      eye(88, 108); eye(168, 108);
      x.strokeStyle = '#3a241a'; x.lineWidth = 8; x.beginPath();
      x.arc(128, 150, 34, 0.2 * Math.PI, 0.8 * Math.PI); x.stroke();
  }
  return canvasTexture(c);
}

function shirtTexture(shirt) {
  const c = makeCanvas(128, 128);
  const x = c.getContext('2d');
  const base = '#' + shirt.hex.toString(16).padStart(6, '0');
  x.fillStyle = base; x.fillRect(0, 0, 128, 128);
  if (shirt.pattern === 'plaid') {
    x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 6;
    for (let i = 0; i < 128; i += 24) {
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke();
      x.beginPath(); x.moveTo(0, i); x.lineTo(128, i); x.stroke();
    }
    x.strokeStyle = 'rgba(255,255,255,.25)'; x.lineWidth = 2;
    for (let i = 12; i < 128; i += 24) {
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke();
      x.beginPath(); x.moveTo(0, i); x.lineTo(128, i); x.stroke();
    }
  }
  return canvasTexture(c);
}

function vestTexture(vest, company) {
  const c = makeCanvas(256, 256);
  const x = c.getContext('2d');
  x.fillStyle = '#' + vest.hex.toString(16).padStart(6, '0');
  x.fillRect(0, 0, 256, 256);
  // Retro-reflective banding.
  x.fillStyle = '#d9dde2';
  x.fillRect(0, 90, 256, 26); x.fillRect(0, 150, 256, 26);
  x.fillStyle = '#9aa1a8';
  x.fillRect(0, 90, 256, 5); x.fillRect(0, 111, 256, 5);
  x.fillRect(0, 150, 256, 5); x.fillRect(0, 171, 256, 5);
  x.fillStyle = '#14161a';
  x.font = 'bold 22px Arial'; x.textAlign = 'center';
  x.fillText((company || 'TOWING').slice(0, 18), 128, 60);
  x.font = 'bold 16px Arial';
  x.fillText('RECOVERY', 128, 214);
  return canvasTexture(c);
}

/* --------------------------------------------------------------- assembling */

const byId = (arr, id) => arr.find((a) => a.id === id) || arr[0];

export function buildCharacter(cfg, opts = {}) {
  const skin = byId(SKIN_TONES, cfg.skin).hex;
  const build = byId(BUILDS, cfg.build);
  const shirt = byId(SHIRTS, cfg.shirt);
  const pants = byId(PANTS, cfg.pants);
  const vest = byId(VESTS, cfg.vest);
  const hair = byId(HAIR_STYLES, cfg.hair);
  const hairHex = byId(HAIR_COLORS, cfg.hairColor).hex;
  const hat = byId(HATS, cfg.hat);

  const skinM = mat(skin, { roughness: 0.9 });
  const shirtM = texMat(shirtTexture(shirt), { roughness: 0.92 });
  const pantsM = mat(pants.hex, { roughness: 0.95 });
  const bootM = mat(0x2a2320, { roughness: 0.9 });
  const gloveM = mat(0x232a33, { roughness: 0.95 });
  const hairM = mat(hairHex, { roughness: 0.95 });

  const root = new THREE.Group();
  const scaleY = cfg.height;           // 0.86 – 1.16 nominal
  const bw = build.w;

  // Proportions (metres at height 1.0): legs .82, torso .72, head .30
  const legH = 0.82, torsoH = 0.72, headS = 0.3;
  const hipY = legH;
  const torso = new THREE.Group();
  torso.position.y = hipY;
  root.add(torso);

  const chest = box(0.52 * bw, torsoH, 0.28 * bw, shirtM, 0, torsoH / 2, 0);
  torso.add(chest);
  // Hi-vis vest over the shirt.
  if (cfg.vestOn) {
    const vestM = texMat(vestTexture(vest, opts.company), { roughness: 0.85 });
    const v = box(0.56 * bw, torsoH * 0.82, 0.33 * bw, vestM, 0, torsoH * 0.52, 0);
    torso.add(v);
    if (vest.sleeves) {
      for (const s of [-1, 1]) torso.add(box(0.17 * bw, 0.34, 0.2 * bw, vestM, s * 0.35 * bw, torsoH * 0.72, 0));
    }
  }
  if (shirt.hood) torso.add(box(0.36 * bw, 0.16, 0.24 * bw, shirtM, 0, torsoH * 0.98, -0.1));

  // Head + face + hair + hat
  const head = new THREE.Group();
  head.position.y = torsoH + headS * 0.5 + 0.06;
  const skull = box(headS * 1.05, headS, headS * 0.95, skinM, 0, 0, 0);
  head.add(skull);
  const face = box(headS * 0.98, headS * 0.92, 0.02, texMat(faceTexture(cfg.face, skin)), 0, 0.005, headS * 0.48);
  head.add(face);
  head.add(box(0.05, 0.09, 0.05, skinM, -headS * 0.55, 0, 0));
  head.add(box(0.05, 0.09, 0.05, skinM, headS * 0.55, 0, 0));
  head.add(box(0.14, 0.14, 0.16, skinM, 0, -headS * 0.55, -0.02)); // neck

  if (hair.id !== 'bald') {
    const top = box(headS * 1.08, headS * 0.3, headS * 1.0, hairM, 0, headS * 0.42, -0.01);
    head.add(top);
    if (hair.id === 'short' || hair.id === 'mullet') {
      head.add(box(headS * 1.06, headS * 0.4, 0.05, hairM, 0, headS * 0.16, -headS * 0.48));
    }
    if (hair.id === 'mullet') head.add(box(headS * 0.9, 0.22, 0.06, hairM, 0, headS * 0.0, -headS * 0.52));
    if (hair.id === 'curls') {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * TAU;
        head.add(sphere(0.055, hairM, Math.cos(a) * headS * 0.5, headS * 0.44 + Math.sin(i) * 0.02, Math.sin(a) * headS * 0.45));
      }
    }
    if (hair.id === 'ponytail') {
      head.add(box(0.1, 0.34, 0.1, hairM, 0, headS * 0.2, -headS * 0.62));
    }
    if (hair.id === 'locs') {
      for (let i = 0; i < 8; i++) {
        head.add(box(0.05, 0.3, 0.05, hairM, -0.12 + (i % 4) * 0.08, headS * 0.24, -headS * 0.45 - Math.floor(i / 4) * 0.07));
      }
    }
    if (hair.id === 'bun') head.add(sphere(0.09, hairM, 0, headS * 0.62, -0.03));
  }
  if (hat.id === 'cap' || hat.id === 'trucker') {
    const capM = mat(hat.id === 'trucker' ? 0xe8e9e6 : 0x1e2a38, { roughness: 0.9 });
    head.add(box(headS * 1.06, 0.12, headS * 1.0, capM, 0, headS * 0.55, 0));
    head.add(box(headS * 1.0, 0.04, 0.16, capM, 0, headS * 0.5, headS * 0.6));
    if (hat.id === 'trucker') head.add(box(headS * 1.04, 0.1, 0.04, mat(0x2f5d8c), 0, headS * 0.55, -headS * 0.5));
  } else if (hat.id === 'beanie') {
    head.add(box(headS * 1.08, 0.2, headS * 1.02, mat(0x8c3f2f, { roughness: 1 }), 0, headS * 0.5, 0));
  } else if (hat.id === 'hardhat') {
    head.add(box(headS * 1.1, 0.16, headS * 1.05, mat(0xf0c419, { roughness: 0.5 }), 0, headS * 0.56, 0));
    head.add(box(headS * 1.15, 0.04, headS * 1.2, mat(0xf0c419, { roughness: 0.5 }), 0, headS * 0.48, 0));
  }
  torso.add(head);

  // Arms
  const arms = [];
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * (0.26 * bw + 0.09), torsoH * 0.92, 0);
    const upper = box(0.17 * bw, 0.36, 0.19 * bw, shirt.hood || shirt.id === 'thermal' ? shirtM : shirtM, 0, -0.18, 0);
    const fore = box(0.155 * bw, 0.34, 0.175 * bw, skinM, 0, -0.5, 0);
    const hand = box(0.16 * bw, 0.14, 0.18 * bw, cfg.gloves ? gloveM : skinM, 0, -0.72, 0);
    shoulder.add(upper, fore, hand);
    shoulder.userData.hand = hand;
    torso.add(shoulder);
    arms.push(shoulder);
  }

  // Legs
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(s * 0.14 * bw, 0, 0);
    const thigh = box(0.21 * bw, 0.44, 0.23 * bw, pantsM, 0, -0.22, 0);
    const shin = box(0.19 * bw, 0.4, 0.2 * bw, pants.short ? skinM : pantsM, 0, -0.62, 0);
    const boot = box(0.22 * bw, 0.14, 0.3 * bw, cfg.boots ? bootM : skinM, 0, -0.86, 0.04);
    hip.add(thigh, shin, boot);
    torso.add(hip);
    legs.push(hip);
  }

  root.scale.setScalar(scaleY);
  root.userData = {
    kind: 'character', cfg, torso, head, arms, legs,
    handR: arms[1], handL: arms[0],
    height: (legH + torsoH + headS) * scaleY,
    phase: 0,
  };
  return root;
}

/* Simple walk cycle + carry pose. */
export function animateCharacter(char, dt, { speed = 0, seated = false, carrying = false, working = 0 } = {}) {
  const u = char.userData;
  u.phase += dt * (2.2 + speed * 1.4);
  const swing = Math.sin(u.phase * 2.2) * Math.min(1, speed / 3) * 0.8;
  if (seated) {
    u.legs[0].rotation.x = -1.4; u.legs[1].rotation.x = -1.4;
    u.arms[0].rotation.x = -1.1; u.arms[1].rotation.x = -1.1;
    u.arms[0].rotation.z = 0.2; u.arms[1].rotation.z = -0.2;
    u.torso.rotation.x = 0;
    return;
  }
  u.legs[0].rotation.x = swing;
  u.legs[1].rotation.x = -swing;
  if (carrying) {
    u.arms[0].rotation.x = -1.35; u.arms[1].rotation.x = -1.35;
    u.arms[0].rotation.z = 0.12; u.arms[1].rotation.z = -0.12;
  } else if (working > 0) {
    const w = Math.sin(u.phase * 8) * 0.3;
    u.arms[0].rotation.x = -1.1 + w; u.arms[1].rotation.x = -1.1 - w;
    u.arms[0].rotation.z = 0.2; u.arms[1].rotation.z = -0.2;
  } else {
    u.arms[0].rotation.x = -swing * 0.8; u.arms[1].rotation.x = swing * 0.8;
    u.arms[0].rotation.z = 0.06; u.arms[1].rotation.z = -0.06;
  }
  u.torso.rotation.x = Math.min(0.12, speed * 0.02);
  u.torso.position.y = 0.82 + Math.abs(Math.sin(u.phase * 2.2)) * Math.min(0.05, speed * 0.012);
}

export const CHARACTER_OPTIONS = {
  SKIN_TONES, HAIR_STYLES, HAIR_COLORS, FACES, BUILDS, SHIRTS, PANTS, VESTS, HATS,
};
