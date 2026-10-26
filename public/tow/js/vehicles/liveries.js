// Company liveries. Every truck gets five, each with white or black lettering.
import { makeCanvas, canvasTexture, fitText, roundRect } from '../util.js';

export const COMPANIES = {
  flag: { name: 'FLAG CITY TOWING', tag: 'Towing · Recovery · Roadside', address: '8563 West Skyville Road', phone: '671-907-4212', dot: 'USDOT 3184207' },
  skyrec: { name: 'SKYVILLE RECOVERY', tag: 'Light & Medium Duty Towing', address: '1200 Harbor Avenue', phone: '671-338-2100', dot: 'USDOT 2207415' },
  eastside: { name: 'EASTSIDE TOWING', tag: '24 HR Towing & Lockouts', address: '47 Bayview Boulevard', phone: '671-822-5160', dot: 'USDOT 1956630' },
  liberty: { name: 'LIBERTY WRECKER SERVICE', tag: 'Since 1987 · Family Owned', address: '912 Liberty Pike', phone: '671-404-8899', dot: 'USDOT 0884213' },
  beltway: { name: 'BELTWAY AUTO TOWING', tag: 'Exit 4 · I-671 Inner Loop', address: '300 Ridge Road', phone: '671-260-7700', dot: 'USDOT 3011982' },
  harbor: { name: 'HARBOR POINT TOWING', tag: 'Flatbed · Motorcycle · Exotic', address: '18 Pier Street', phone: '671-519-3344', dot: 'USDOT 2774109' },
  kowalski: { name: "KOWALSKI'S TOWING", tag: 'We Get You Home', address: '2290 Chestnut Street', phone: '671-733-0618', dot: 'USDOT 1640357' },
  metro: { name: 'METRO HEAVY RECOVERY', tag: 'Rotators · Flatbeds · Landolls', address: '7 Foundry Lane', phone: '671-848-9020', dot: 'USDOT 2488316' },
};

// cab: paint, bed: deck-side fascia paint, text: lettering, stripe: accent band.
const L = (company, cab, bed, text, stripe, metallic = false) => ({ company, cab, bed, text, stripe, metallic });

export const LIVERIES = {
  f550: [
    L('flag', '#b3121b', '#16171a', '#ffffff', '#f2f2f2'),
    L('skyrec', '#f2f2f0', '#1a1b1e', '#111111', '#1f4fa3'),
    L('eastside', '#111214', '#111214', '#ffffff', '#e8b10f', true),
    L('liberty', '#1b2f5e', '#1b2f5e', '#ffffff', '#c7202b', true),
    L('beltway', '#f1c40f', '#1a1b1e', '#111111', '#111111'),
  ],
  ram5500: [
    L('flag', '#f4f4f2', '#b3121b', '#111111', '#b3121b'),
    L('harbor', '#0f4c5c', '#0f4c5c', '#ffffff', '#e9c46a', true),
    L('kowalski', '#e05a00', '#16171a', '#111111', '#ffffff'),
    L('metro', '#2b2d31', '#2b2d31', '#ffffff', '#ff7a00', true),
    L('skyrec', '#8c97a3', '#1a1b1e', '#111111', '#1f4fa3', true),
  ],
  npr: [
    L('flag', '#f6f6f4', '#f6f6f4', '#111111', '#b3121b'),
    L('eastside', '#e8b10f', '#111214', '#111111', '#111111'),
    L('beltway', '#1d6b3a', '#1d6b3a', '#ffffff', '#f4d35e'),
    L('liberty', '#c7202b', '#c7202b', '#ffffff', '#ffffff'),
    L('harbor', '#0a0b0d', '#0a0b0d', '#ffffff', '#4fb3d9', true),
  ],
  intl: [
    L('metro', '#f2f2f0', '#2b2d31', '#111111', '#ff7a00'),
    L('flag', '#9b0f17', '#16171a', '#ffffff', '#d9d9d9', true),
    L('kowalski', '#203864', '#203864', '#ffffff', '#f2c14e', true),
    L('skyrec', '#101113', '#101113', '#ffffff', '#3ea0ff', true),
    L('beltway', '#ffd400', '#ffd400', '#111111', '#111111'),
  ],
  pete: [
    L('liberty', '#0b0c0e', '#0b0c0e', '#ffffff', '#c7202b', true),
    L('flag', '#c8102e', '#c8102e', '#ffffff', '#ffffff', true),
    L('harbor', '#e9eef2', '#1a1b1e', '#111111', '#0f4c5c'),
    L('metro', '#5b2a86', '#1a1b1e', '#ffffff', '#f2c14e', true),
    L('eastside', '#3e6b48', '#3e6b48', '#ffffff', '#e8b10f', true),
  ],
};

const texCache = new Map();

// Door panel: big company name, tagline, address, phone, DOT number.
export function doorTexture(liv) {
  const key = 'door' + JSON.stringify(liv);
  if (texCache.has(key)) return texCache.get(key);
  const c = COMPANIES[liv.company];
  const W = 1024, H = 512;
  const cv = makeCanvas(W, H);
  const g = cv.getContext('2d');
  g.clearRect(0, 0, W, H);
  g.fillStyle = liv.text;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  // Accent band behind the name.
  g.fillStyle = liv.stripe;
  g.globalAlpha = 0.95;
  g.fillRect(0, 40, W, 12);
  g.fillRect(0, 210, W, 8);
  g.globalAlpha = 1;
  g.fillStyle = liv.text;
  const words = c.name.split(' ');
  const line1 = words.length > 2 ? words.slice(0, -1).join(' ') : words[0];
  const line2 = words.length > 2 ? words[words.length - 1] : words.slice(1).join(' ');
  fitText(g, line1, W - 60, 118, 900, 'Impact, "Arial Black", Arial, sans-serif');
  g.fillText(line1, W / 2, 140);
  fitText(g, line2, W - 200, 70, 800, '"Arial Black", Arial, sans-serif');
  g.fillText(line2, W / 2, 200);
  g.font = 'italic 600 34px Arial, sans-serif';
  g.fillText(c.tag, W / 2, 268);
  g.font = '600 38px Arial, sans-serif';
  g.fillText(c.address + ', Skyville', W / 2, 330);
  fitText(g, c.phone, W - 100, 104, 900, 'Impact, "Arial Black", Arial, sans-serif');
  g.fillText(c.phone, W / 2, 438);
  g.font = '600 26px Arial, sans-serif';
  g.fillText(c.dot + '   ·   MC 771034', W / 2, 490);
  const t = canvasTexture(cv);
  texCache.set(key, t);
  return t;
}

// Long bed-side panel: name and phone number.
export function bedSideTexture(liv) {
  const key = 'bed' + JSON.stringify(liv);
  if (texCache.has(key)) return texCache.get(key);
  const c = COMPANIES[liv.company];
  const W = 2048, H = 128;
  const cv = makeCanvas(W, H);
  const g = cv.getContext('2d');
  g.fillStyle = liv.bed;
  g.fillRect(0, 0, W, H);
  g.fillStyle = liv.stripe;
  g.fillRect(0, 0, W, 10);
  g.fillRect(0, H - 10, W, 10);
  g.fillStyle = liv.text === '#111111' && isDark(liv.bed) ? '#ffffff' : liv.text === '#ffffff' && !isDark(liv.bed) ? '#111111' : liv.text;
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  fitText(g, c.name, 1100, 84, 900, 'Impact, "Arial Black", Arial, sans-serif');
  g.fillText(c.name, 60, H / 2 + 4);
  g.textAlign = 'right';
  fitText(g, c.phone, 700, 84, 900, 'Impact, "Arial Black", Arial, sans-serif');
  g.fillText(c.phone, W - 60, H / 2 + 4);
  const t = canvasTexture(cv);
  texCache.set(key, t);
  return t;
}

// Headboard (rear of the cab protector) sign.
export function headboardTexture(liv) {
  const key = 'head' + JSON.stringify(liv);
  if (texCache.has(key)) return texCache.get(key);
  const c = COMPANIES[liv.company];
  const W = 1024, H = 256;
  const cv = makeCanvas(W, H);
  const g = cv.getContext('2d');
  g.fillStyle = liv.cab;
  roundRect(g, 0, 0, W, H, 12);
  g.fill();
  g.fillStyle = liv.text;
  g.textAlign = 'center';
  fitText(g, c.name, W - 60, 92, 900, 'Impact, "Arial Black", Arial, sans-serif');
  g.fillText(c.name, W / 2, 110);
  fitText(g, c.phone, W - 200, 96, 900, 'Impact, "Arial Black", Arial, sans-serif');
  g.fillText(c.phone, W / 2, 215);
  const t = canvasTexture(cv);
  texCache.set(key, t);
  return t;
}

export function isDark(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
  return 0.299 * r + 0.587 * gg + 0.114 * b < 128;
}

export function liveryLabel(liv) {
  const c = COMPANIES[liv.company];
  return `${c.name} — ${liv.text === '#ffffff' ? 'white' : 'black'} text`;
}
