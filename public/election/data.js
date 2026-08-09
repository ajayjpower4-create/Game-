// Static game data for the Political Election Simulator.
// This file is pure data + pure functions so it can be imported by both the
// browser client and the Node server (no DOM access in here).

// row/col place each state on a 8x12 grid cartogram of the US.
// ev  = electoral votes (2024–2030 apportionment, 538 total)
// pop = rough turnout baseline in thousands of votes cast
// lean = cultural axis, -1 (traditional / rural) .. +1 (progressive / urban)
export const STATES = [
  { code: 'AK', name: 'Alaska',         ev: 3,  pop: 340,   lean: -0.35, region: 'West',      row: 0, col: 0 },
  { code: 'ME', name: 'Maine',          ev: 4,  pop: 830,   lean: 0.20,  region: 'Northeast', row: 0, col: 11 },
  { code: 'VT', name: 'Vermont',        ev: 3,  pop: 330,   lean: 0.55,  region: 'Northeast', row: 1, col: 10 },
  { code: 'NH', name: 'New Hampshire',  ev: 4,  pop: 830,   lean: 0.10,  region: 'Northeast', row: 1, col: 11 },
  { code: 'WA', name: 'Washington',     ev: 12, pop: 4000,  lean: 0.45,  region: 'West',      row: 2, col: 0 },
  { code: 'ID', name: 'Idaho',          ev: 4,  pop: 900,   lean: -0.80, region: 'West',      row: 2, col: 1 },
  { code: 'MT', name: 'Montana',        ev: 4,  pop: 620,   lean: -0.50, region: 'West',      row: 2, col: 2 },
  { code: 'ND', name: 'North Dakota',   ev: 3,  pop: 370,   lean: -0.75, region: 'Midwest',   row: 2, col: 3 },
  { code: 'MN', name: 'Minnesota',      ev: 10, pop: 3300,  lean: 0.15,  region: 'Midwest',   row: 2, col: 4 },
  { code: 'IL', name: 'Illinois',       ev: 19, pop: 5700,  lean: 0.35,  region: 'Midwest',   row: 2, col: 5 },
  { code: 'WI', name: 'Wisconsin',      ev: 10, pop: 3400,  lean: 0.01,  region: 'Midwest',   row: 2, col: 6 },
  { code: 'MI', name: 'Michigan',       ev: 15, pop: 5700,  lean: 0.02,  region: 'Midwest',   row: 2, col: 7 },
  { code: 'NY', name: 'New York',       ev: 28, pop: 8100,  lean: 0.45,  region: 'Northeast', row: 2, col: 8 },
  { code: 'CT', name: 'Connecticut',    ev: 7,  pop: 1800,  lean: 0.45,  region: 'Northeast', row: 2, col: 9 },
  { code: 'RI', name: 'Rhode Island',   ev: 4,  pop: 510,   lean: 0.45,  region: 'Northeast', row: 2, col: 10 },
  { code: 'MA', name: 'Massachusetts',  ev: 11, pop: 3400,  lean: 0.55,  region: 'Northeast', row: 2, col: 11 },
  { code: 'OR', name: 'Oregon',         ev: 8,  pop: 2400,  lean: 0.40,  region: 'West',      row: 3, col: 0 },
  { code: 'NV', name: 'Nevada',         ev: 6,  pop: 1500,  lean: 0.05,  region: 'West',      row: 3, col: 1 },
  { code: 'WY', name: 'Wyoming',        ev: 3,  pop: 270,   lean: -0.90, region: 'West',      row: 3, col: 2 },
  { code: 'SD', name: 'South Dakota',   ev: 3,  pop: 430,   lean: -0.65, region: 'Midwest',   row: 3, col: 3 },
  { code: 'IA', name: 'Iowa',           ev: 6,  pop: 1700,  lean: -0.30, region: 'Midwest',   row: 3, col: 4 },
  { code: 'IN', name: 'Indiana',        ev: 11, pop: 3000,  lean: -0.45, region: 'Midwest',   row: 3, col: 5 },
  { code: 'OH', name: 'Ohio',           ev: 17, pop: 5800,  lean: -0.25, region: 'Midwest',   row: 3, col: 6 },
  { code: 'PA', name: 'Pennsylvania',   ev: 19, pop: 7000,  lean: 0.00,  region: 'Northeast', row: 3, col: 7 },
  { code: 'NJ', name: 'New Jersey',     ev: 14, pop: 4300,  lean: 0.35,  region: 'Northeast', row: 3, col: 8 },
  { code: 'CA', name: 'California',     ev: 54, pop: 16000, lean: 0.62,  region: 'West',      row: 4, col: 0 },
  { code: 'UT', name: 'Utah',           ev: 6,  pop: 1500,  lean: -0.55, region: 'West',      row: 4, col: 1 },
  { code: 'CO', name: 'Colorado',       ev: 10, pop: 3200,  lean: 0.22,  region: 'West',      row: 4, col: 2 },
  { code: 'NE', name: 'Nebraska',       ev: 5,  pop: 950,   lean: -0.50, region: 'Midwest',   row: 4, col: 3 },
  { code: 'MO', name: 'Missouri',       ev: 10, pop: 3000,  lean: -0.45, region: 'Midwest',   row: 4, col: 4 },
  { code: 'KY', name: 'Kentucky',       ev: 8,  pop: 2100,  lean: -0.65, region: 'South',     row: 4, col: 5 },
  { code: 'WV', name: 'West Virginia',  ev: 4,  pop: 770,   lean: -0.80, region: 'South',     row: 4, col: 6 },
  { code: 'VA', name: 'Virginia',       ev: 13, pop: 4400,  lean: 0.20,  region: 'South',     row: 4, col: 7 },
  { code: 'MD', name: 'Maryland',       ev: 10, pop: 3000,  lean: 0.50,  region: 'Northeast', row: 4, col: 8 },
  { code: 'DE', name: 'Delaware',       ev: 3,  pop: 510,   lean: 0.35,  region: 'Northeast', row: 4, col: 9 },
  { code: 'AZ', name: 'Arizona',        ev: 11, pop: 3400,  lean: -0.06, region: 'West',      row: 5, col: 1 },
  { code: 'NM', name: 'New Mexico',     ev: 5,  pop: 930,   lean: 0.25,  region: 'West',      row: 5, col: 2 },
  { code: 'KS', name: 'Kansas',         ev: 6,  pop: 1300,  lean: -0.45, region: 'Midwest',   row: 5, col: 3 },
  { code: 'AR', name: 'Arkansas',       ev: 6,  pop: 1200,  lean: -0.75, region: 'South',     row: 5, col: 4 },
  { code: 'TN', name: 'Tennessee',      ev: 11, pop: 3100,  lean: -0.62, region: 'South',     row: 5, col: 5 },
  { code: 'NC', name: 'North Carolina', ev: 16, pop: 5700,  lean: -0.08, region: 'South',     row: 5, col: 6 },
  { code: 'SC', name: 'South Carolina', ev: 9,  pop: 2500,  lean: -0.40, region: 'South',     row: 5, col: 7 },
  { code: 'DC', name: 'Washington DC',  ev: 3,  pop: 330,   lean: 0.95,  region: 'Northeast', row: 5, col: 8 },
  { code: 'OK', name: 'Oklahoma',       ev: 7,  pop: 1600,  lean: -0.80, region: 'South',     row: 6, col: 3 },
  { code: 'LA', name: 'Louisiana',      ev: 8,  pop: 2100,  lean: -0.60, region: 'South',     row: 6, col: 4 },
  { code: 'MS', name: 'Mississippi',    ev: 6,  pop: 1200,  lean: -0.60, region: 'South',     row: 6, col: 5 },
  { code: 'AL', name: 'Alabama',        ev: 9,  pop: 2300,  lean: -0.72, region: 'South',     row: 6, col: 6 },
  { code: 'GA', name: 'Georgia',        ev: 16, pop: 5300,  lean: -0.02, region: 'South',     row: 6, col: 7 },
  { code: 'HI', name: 'Hawaii',         ev: 4,  pop: 550,   lean: 0.60,  region: 'West',      row: 7, col: 0 },
  { code: 'TX', name: 'Texas',          ev: 40, pop: 11300, lean: -0.25, region: 'South',     row: 7, col: 3 },
  { code: 'FL', name: 'Florida',        ev: 30, pop: 10800, lean: -0.18, region: 'South',     row: 7, col: 8 },
];

export const STATE_BY_CODE = Object.fromEntries(STATES.map((s) => [s.code, s]));
export const STATE_CODES = STATES.map((s) => s.code);
export const TOTAL_EV = STATES.reduce((n, s) => n + s.ev, 0); // 538
export const EV_TO_WIN = Math.floor(TOTAL_EV / 2) + 1; // 270

// Campaign themes. `axis` pushes a candidate along the same -1..+1 cultural
// axis the states are scored on; `reach` is how broadly the theme travels.
export const THEMES = [
  { id: 'economy',    label: 'The economy & cost of living', axis: 0.00,  reach: 1.00 },
  { id: 'jobs',       label: 'Jobs, unions & factories',     axis: 0.10,  reach: 0.85 },
  { id: 'healthcare', label: 'Healthcare',                   axis: 0.50,  reach: 0.80 },
  { id: 'housing',    label: 'Housing & rent',               axis: 0.40,  reach: 0.75 },
  { id: 'student',    label: 'Student debt & young voters',  axis: 0.70,  reach: 0.65 },
  { id: 'climate',    label: 'Climate & clean energy',       axis: 0.80,  reach: 0.70 },
  { id: 'tech',       label: 'Tech, AI & the internet',      axis: 0.20,  reach: 0.60 },
  { id: 'education',  label: 'Schools & education',          axis: 0.30,  reach: 0.70 },
  { id: 'foreign',    label: 'Foreign policy & war',         axis: 0.00,  reach: 0.55 },
  { id: 'crime',      label: 'Crime & policing',             axis: -0.50, reach: 0.80 },
  { id: 'border',     label: 'The border & immigration',     axis: -0.60, reach: 0.85 },
  { id: 'culture',    label: 'Culture war & media bias',     axis: -0.80, reach: 0.60 },
  { id: 'faith',      label: 'Faith & family values',        axis: -0.90, reach: 0.60 },
  { id: 'guns',       label: 'Gun rights',                   axis: -0.70, reach: 0.55 },
  { id: 'speech',     label: 'Free speech',                  axis: -0.30, reach: 0.60 },
  { id: 'corruption', label: 'Draining the swamp',           axis: -0.10, reach: 0.75 },
];

export const THEME_BY_ID = Object.fromEntries(THEMES.map((t) => [t.id, t]));

// Well-known figures you can draft without writing a description.
// `star` is name recognition (0-100), `axis` is where the public already
// places them on the same -1..+1 cultural axis. All of this is a game.
export const FAMOUS = [
  { name: 'Taylor Swift',        role: 'Musician',              star: 95, axis: 0.55 },
  { name: 'Charlie Kirk',        role: 'Political commentator',  star: 72, axis: -0.80 },
  { name: 'Dwayne Johnson',      role: 'Actor & former wrestler', star: 88, axis: 0.15 },
  { name: 'Oprah Winfrey',       role: 'Media mogul',            star: 90, axis: 0.45 },
  { name: 'Elon Musk',           role: 'Entrepreneur',           star: 86, axis: -0.20 },
  { name: 'MrBeast',             role: 'YouTuber',               star: 84, axis: 0.05 },
  { name: 'LeBron James',        role: 'Athlete',                star: 85, axis: 0.40 },
  { name: 'Joe Rogan',           role: 'Podcaster',              star: 80, axis: -0.25 },
  { name: 'Beyoncé',             role: 'Musician',               star: 92, axis: 0.50 },
  { name: 'Michelle Obama',      role: 'Author & former FLOTUS', star: 88, axis: 0.60 },
  { name: 'Tucker Carlson',      role: 'Commentator',            star: 73, axis: -0.85 },
  { name: 'Ben Shapiro',         role: 'Commentator',            star: 70, axis: -0.75 },
  { name: 'Jon Stewart',         role: 'Comedian',               star: 74, axis: 0.50 },
  { name: 'Tom Hanks',           role: 'Actor',                  star: 79, axis: 0.35 },
  { name: 'Keanu Reeves',        role: 'Actor',                  star: 78, axis: 0.10 },
  { name: 'Ryan Reynolds',       role: 'Actor',                  star: 80, axis: 0.20 },
  { name: 'Snoop Dogg',          role: 'Rapper',                 star: 77, axis: 0.30 },
  { name: 'Kim Kardashian',      role: 'Media personality',      star: 82, axis: 0.20 },
  { name: 'Mark Cuban',          role: 'Investor',               star: 71, axis: 0.05 },
  { name: 'Bill Gates',          role: 'Philanthropist',         star: 70, axis: 0.30 },
  { name: 'Serena Williams',     role: 'Athlete',                star: 76, axis: 0.35 },
  { name: 'Arnold Schwarzenegger', role: 'Actor & ex-governor',  star: 81, axis: -0.10 },
  { name: 'Gordon Ramsay',       role: 'Chef',                   star: 78, axis: -0.05 },
  { name: 'Simone Biles',        role: 'Gymnast',                star: 74, axis: 0.35 },
];

export const PARTY_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#a855f7', '#f59e0b',
  '#14b8a6', '#ec4899', '#6366f1', '#84cc16', '#f97316',
];

export function fmtNum(n) {
  return Math.round(n || 0).toLocaleString('en-US');
}

export function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  });
}

export function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function daysBetween(aIso, bIso) {
  const [ay, am, ad] = aIso.split('-').map(Number);
  const [by, bm, bd] = bIso.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
