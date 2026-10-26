// Road sign artwork (MUTCD-style): exit guide signs, interstate shields,
// speed limits, stop, do-not-enter, street blades, mile markers.
import * as THREE from 'three';
import { makeCanvas, canvasTexture, roundRect, fitText } from '../util.js';

const GREEN = '#006b3f';
const cache = new Map();

function mat(canvas, emissive = 0.18) {
  const t = canvasTexture(canvas, { aniso: 8 });
  // A touch of emissive mimics retroreflective sheeting.
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.45, metalness: 0.0, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: emissive });
}

export function drawShield(g, x, y, s, num = '671') {
  g.save();
  g.translate(x, y);
  g.scale(s / 100, s / 100);
  const path = () => {
    g.beginPath();
    g.moveTo(-46, -40);
    g.quadraticCurveTo(0, -52, 46, -40);
    g.quadraticCurveTo(52, 10, 0, 52);
    g.quadraticCurveTo(-52, 10, -46, -40);
    g.closePath();
  };
  g.fillStyle = '#ffffff'; path(); g.fill();
  g.scale(0.9, 0.9);
  g.fillStyle = '#003f87'; path(); g.fill();
  g.fillStyle = '#c8102e';
  g.beginPath(); g.moveTo(-46, -40); g.quadraticCurveTo(0, -52, 46, -40); g.lineTo(48, -20); g.lineTo(-48, -20); g.closePath(); g.fill();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 13px Arial'; g.fillText('INTERSTATE', 0, -31);
  g.font = 'bold 42px "Arial Narrow", Arial'; g.fillText(num, 0, 10);
  g.restore();
}

export function exitGuideSign({ exit, street, dest, distance, arrow = false }) {
  const key = `exit${exit}${street}${dest}${distance}${arrow}`;
  if (cache.has(key)) return cache.get(key);
  const W = 1024, H = 520;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#c9cdd2'; g.fillRect(0, 0, W, H);
  // Exit tab.
  g.fillStyle = GREEN; roundRect(g, W - 330, 0, 320, 96, 14); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 6; roundRect(g, W - 322, 8, 304, 80, 10); g.stroke();
  g.fillStyle = '#fff'; g.font = 'bold 64px "Arial Narrow", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(`EXIT ${exit}`, W - 170, 50);
  // Main panel.
  g.fillStyle = GREEN; roundRect(g, 0, 100, W, H - 100, 20); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 8; roundRect(g, 12, 112, W - 24, H - 124, 14); g.stroke();
  g.fillStyle = '#fff';
  fitText(g, street, W - 120, 110, 700, '"Arial Narrow", Arial');
  g.fillText(street, W / 2, 210);
  fitText(g, dest, W - 140, 64, 600, '"Arial Narrow", Arial');
  g.fillText(dest, W / 2, 300);
  if (arrow) {
    // Down arrow(s) over the exit lane.
    g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(W / 2 - 36, 340); g.lineTo(W / 2 + 36, 340); g.lineTo(W / 2 + 36, 400); g.lineTo(W / 2 + 70, 400); g.lineTo(W / 2, 470); g.lineTo(W / 2 - 70, 400); g.lineTo(W / 2 - 36, 400); g.closePath(); g.fill();
    g.fillStyle = '#ffd200'; g.font = 'bold 44px Arial'; g.fillText('EXIT', W / 2 - 220, 430); g.fillText('ONLY', W / 2 + 220, 430);
  } else {
    g.font = 'bold 58px "Arial Narrow", Arial';
    g.fillText(distance, W / 2, 420);
  }
  const m = mat(c);
  cache.set(key, m);
  return m;
}

export function routeSign(loop, arrow = 'down') {
  const key = `route${loop}${arrow}`;
  if (cache.has(key)) return cache.get(key);
  const W = 768, H = 520;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = GREEN; roundRect(g, 0, 0, W, H, 20); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 8; roundRect(g, 12, 12, W - 24, H - 24, 14); g.stroke();
  drawShield(g, W / 2, 150, 210);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 74px "Arial Narrow", Arial';
  g.fillText(`${loop.toUpperCase()} LOOP`, W / 2, 330);
  g.beginPath();
  if (arrow === 'down') { g.moveTo(W / 2 - 30, 380); g.lineTo(W / 2 + 30, 380); g.lineTo(W / 2 + 30, 420); g.lineTo(W / 2 + 60, 420); g.lineTo(W / 2, 480); g.lineTo(W / 2 - 60, 420); g.lineTo(W / 2 - 30, 420); }
  else { g.moveTo(W / 2 - 30, 480); g.lineTo(W / 2 + 30, 480); g.lineTo(W / 2 + 30, 430); g.lineTo(W / 2 + 60, 430); g.lineTo(W / 2, 370); g.lineTo(W / 2 - 60, 430); g.lineTo(W / 2 - 30, 430); }
  g.closePath(); g.fill();
  const m = mat(c);
  cache.set(key, m);
  return m;
}

export function goreSign(exit) {
  const key = 'gore' + exit;
  if (cache.has(key)) return cache.get(key);
  const W = 512, H = 384;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = GREEN; roundRect(g, 0, 0, W, H, 18); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 8; roundRect(g, 10, 10, W - 20, H - 20, 12); g.stroke();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 90px "Arial Narrow", Arial'; g.fillText('EXIT', W / 2, 100);
  g.font = 'bold 120px "Arial Narrow", Arial'; g.fillText(String(exit), W / 2 - 50, 250);
  g.save(); g.translate(W / 2 + 110, 250); g.rotate(-Math.PI / 4);
  g.beginPath(); g.moveTo(-20, 50); g.lineTo(20, 50); g.lineTo(20, -10); g.lineTo(45, -10); g.lineTo(0, -60); g.lineTo(-45, -10); g.lineTo(-20, -10); g.closePath(); g.fill();
  g.restore();
  const m = mat(c);
  cache.set(key, m);
  return m;
}

export function speedLimit(mph) {
  const key = 'speed' + mph;
  if (cache.has(key)) return cache.get(key);
  const W = 256, H = 320;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; roundRect(g, 0, 0, W, H, 16); g.fill();
  g.strokeStyle = '#111'; g.lineWidth = 8; roundRect(g, 10, 10, W - 20, H - 20, 10); g.stroke();
  g.fillStyle = '#111'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 44px "Arial Narrow", Arial'; g.fillText('SPEED', W / 2, 62); g.fillText('LIMIT', W / 2, 110);
  g.font = 'bold 130px "Arial Narrow", Arial'; g.fillText(String(mph), W / 2, 220);
  const m = mat(c, 0.12);
  cache.set(key, m);
  return m;
}

export function stopSign() {
  if (cache.has('stop')) return cache.get('stop');
  const W = 256;
  const c = makeCanvas(W, W);
  const g = c.getContext('2d');
  const oct = (r) => { g.beginPath(); for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + (i / 8) * Math.PI * 2; g.lineTo(W / 2 + Math.cos(a) * r, W / 2 + Math.sin(a) * r); } g.closePath(); };
  g.clearRect(0, 0, W, W);
  g.fillStyle = '#fff'; oct(126); g.fill();
  g.fillStyle = '#c8102e'; oct(116); g.fill();
  g.fillStyle = '#fff'; g.font = 'bold 74px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('STOP', W / 2, W / 2 + 4);
  const t = canvasTexture(c);
  const m = new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.5, roughness: 0.4, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.12, side: THREE.DoubleSide });
  cache.set('stop', m);
  return m;
}

export function doNotEnter() {
  if (cache.has('dne')) return cache.get('dne');
  const W = 256;
  const c = makeCanvas(W, W);
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, W);
  g.fillStyle = '#c8102e'; g.beginPath(); g.arc(W / 2, W / 2, 110, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.fillRect(40, W / 2 - 18, W - 80, 36);
  g.font = 'bold 30px Arial'; g.textAlign = 'center'; g.fillText('DO NOT', W / 2, 92); g.fillText('ENTER', W / 2, 196);
  const m = mat(c, 0.12);
  cache.set('dne', m);
  return m;
}

export function streetBlade(name, num = '') {
  const key = 'blade' + name;
  if (cache.has(key)) return cache.get(key);
  const W = 512, H = 96;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = GREEN; roundRect(g, 0, 0, W, H, 10); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 4; roundRect(g, 5, 5, W - 10, H - 10, 8); g.stroke();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  fitText(g, name.toUpperCase(), W - 40, 60, 700, '"Arial Narrow", Arial');
  g.fillText(name.toUpperCase(), W / 2, H / 2 + 3);
  const m = mat(c, 0.1);
  m.side = THREE.DoubleSide;
  cache.set(key, m);
  return m;
}

export function mileMarker(n) {
  const key = 'mm' + n;
  if (cache.has(key)) return cache.get(key);
  const W = 96, H = 256;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = GREEN; roundRect(g, 0, 0, W, H, 8); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 4; roundRect(g, 4, 4, W - 8, H - 8, 6); g.stroke();
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = 'bold 30px Arial';
  g.fillText('MILE', W / 2, 60);
  g.font = 'bold 64px Arial'; g.fillText(String(n), W / 2, 150);
  const m = mat(c, 0.1);
  cache.set(key, m);
  return m;
}

export function trailblazer(loop, arrowLeft) {
  const key = 'tb' + loop + arrowLeft;
  if (cache.has(key)) return cache.get(key);
  const W = 384, H = 384;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
  drawShield(g, W / 2, 130, 200);
  g.fillStyle = '#111'; g.textAlign = 'center'; g.font = 'bold 40px "Arial Narrow", Arial';
  g.fillText(`${loop.toUpperCase()} LOOP`, W / 2, 268);
  g.save(); g.translate(W / 2, 330); if (arrowLeft) g.scale(-1, 1);
  g.beginPath(); g.moveTo(-60, -10); g.lineTo(20, -10); g.lineTo(20, -30); g.lineTo(60, 0); g.lineTo(20, 30); g.lineTo(20, 10); g.lineTo(-60, 10); g.closePath(); g.fill();
  g.restore();
  const m = mat(c, 0.1);
  cache.set(key, m);
  return m;
}

export function cityLimit() {
  if (cache.has('limit')) return cache.get('limit');
  const W = 768, H = 384;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  g.fillStyle = GREEN; roundRect(g, 0, 0, W, H, 18); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 8; roundRect(g, 10, 10, W - 20, H - 20, 12); g.stroke();
  g.fillStyle = '#fff'; g.textAlign = 'center';
  g.font = 'bold 96px "Arial Narrow", Arial'; g.fillText('SKYVILLE', W / 2, 150);
  g.font = 'bold 56px Arial'; g.fillText('CITY LIMIT', W / 2, 240);
  g.font = 'bold 40px Arial'; g.fillText('POP. 412,600', W / 2, 320);
  const m = mat(c);
  cache.set('limit', m);
  return m;
}
