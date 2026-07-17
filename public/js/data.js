// ---------------------------------------------------------------------------
// data.js — school day schedule, seeded RNG, 986-student generation, timetable
// ---------------------------------------------------------------------------
'use strict';
window.HSS = window.HSS || {};

// School day (user-adjustable). Ends 15:30 as specified.
HSS.SCHEDULE = [
  { name: 'Before school',   start: '08:00', end: '08:40', kind: 'free' },
  { name: 'Registration',    start: '08:40', end: '09:00', kind: 'form' },
  { name: 'Period 1',        start: '09:00', end: '10:00', kind: 'lesson' },
  { name: 'Period 2',        start: '10:00', end: '11:00', kind: 'lesson' },
  { name: 'Break',           start: '11:00', end: '11:20', kind: 'break' },
  { name: 'Period 3',        start: '11:20', end: '12:20', kind: 'lesson' },
  { name: 'Lunch',           start: '12:20', end: '13:00', kind: 'lunch' },
  { name: 'Period 4',        start: '13:00', end: '14:00', kind: 'lesson' },
  { name: 'Period 5',        start: '14:00', end: '15:00', kind: 'lesson' },
  { name: 'Form time',       start: '15:00', end: '15:30', kind: 'form' },
  { name: 'After school',    start: '15:30', end: '17:00', kind: 'free' },
];

HSS.SUBJECTS = ['English', 'Maths', 'Science', 'Geography', 'History', 'Spanish', 'PE', 'Art', 'Computing', 'Drama'];

HSS.toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
HSS.fmtTime = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(Math.floor(min % 60)).padStart(2, '0')}`;
HSS.periodAt = (min) => HSS.SCHEDULE.find(p => min >= HSS.toMin(p.start) && min < HSS.toMin(p.end)) || HSS.SCHEDULE[0];

// --- deterministic RNG so the 986 students are the same every session -------
HSS.makeRng = function (seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const FIRST = ['Amara','Tyrese','Chloe','Mohammed','Ruby','Kian','Fatima','Jayden','Grace','Tomasz','Nia','Ibrahim','Ellie','Marcus','Zainab','Leo','Shanice','Daniel','Aaliyah','Oscar','Priya','Callum','Yusuf','Megan','Andre','Sofia','Reece','Halima','Jacob','Tia','Emmanuel','Lily','Hassan','Freya','Dominik','Keisha','Ethan','Anaya','Louie','Blessing','Ryan','Maryam','Alfie','Simran','Nathan','Esther','Kacper','Jasmine','Tunde','Holly','Rohan','Demi','Samuel','Aisha','Charlie','Renee','Malik','Poppy','Ayaan','Erin','Kofi','Maja','Harvey','Sara','Jerome','Isla','Abdul','Skye','Femi','Lacey','Arjun','Tegan','Micah','Noor','Frankie','Adaeze','Dylan','Hafsa','Troy','Amelia','Kwesi','Bethany','Zack','Imani','Finlay','Rania','Jaden','Olivia','Seyi','Courtney','Aran','Destiny','Lukas','Sumaya','Tyler','Angel','Idris','Mia','Junior','Layla'];
const LAST = ['Okafor','Smith','Begum','Kowalski','Johnson','Hussain','Brown','Adeyemi','Taylor','Ali','Williams','Mensah','Davies','Khan','Wilson','Osei','Evans','Ahmed','Thomas','Boateng','Roberts','Chowdhury','Walker','Diallo','White','Rahman','Edwards','Nwosu','Hughes','Iqbal','Green','Sowa','Lewis','Abubakar','Clarke','Nowak','Wood','Patel','Harris','Eze','Martin','Sesay','Jackson','Uddin','Clark','Toure','Turner','Sharma','Hill','Baptiste','Scott','Yusuf','Cooper','Adjei','Morris','Sylla','Ward','Krasniqi','King','Campbell','Baker','Asante','Bell','Gyamfi','Murphy','Ionescu','Bailey','Owusu','Kelly','Demir','Watson','Ndiaye','Price','Haruna','James','Conteh','Griffiths','Popa','Reid','Balogun'];

const HOME_LIVES = [
  ['stable and supportive home, both parents working', 30],
  ['lives with mum, dad not around much', 14],
  ['large family, shares a room with siblings, little quiet space', 10],
  ['recently moved to the UK, family still settling', 8],
  ['young carer — helps look after a family member before and after school', 5],
  ['parents recently separated, splits the week between two homes', 8],
  ['living with grandparents', 5],
  ['family under financial pressure, sometimes comes in without breakfast', 8],
  ['in temporary housing, long commute to school', 4],
  ['looked-after child with a foster family', 2],
  ['high-achieving household with intense pressure to perform', 6],
];

const SEN_STATUSES = [
  [null, 71],
  ['SEN Support — dyslexia', 6],
  ['SEN Support — ADHD', 5],
  ['SEN Support — autism spectrum', 4],
  ['SEN Support — speech, language & communication', 4],
  ['SEN Support — social, emotional & mental health', 4],
  ['EHCP — autism spectrum', 2],
  ['EHCP — moderate learning difficulty', 2],
  ['EHCP — physical/sensory need', 1],
  ['EHCP — social, emotional & mental health', 1],
];

const BEHAVIOURS = [
  'quiet and hardworking, hates being singled out',
  'confident class clown, plays to the crowd but folds one-to-one',
  'bright but coasting, does the minimum unless challenged',
  'easily distracted, constantly chatting to neighbours',
  'anxious perfectionist, panics over small mistakes',
  'friendly and helpful, wants to please staff',
  'defiant when embarrassed, fine when treated with respect',
  'daydreamer, in their own world half the lesson',
  'sporty and restless, struggles to sit still',
  'socially isolated, eats lunch alone, flinches at attention',
  'ringleader, others follow their mood',
  'argumentative — will debate every instruction on principle',
  'sweet-natured but forgetful, never has equipment',
  'high-achieving and competitive, hates group work',
  'withdrawn since last term, staff suspect something at home',
];

HSS.SKIN_TONES = ['#f5d0b0', '#eab88e', '#d9a06f', '#b97e50', '#94582f', '#6e3d1f', '#503018'];
HSS.HAIR_COLORS = ['#181512', '#3a2a1a', '#6b4423', '#a56b2e', '#c99e57', '#8a8a8a', '#b3382a'];
HSS.HAIR_STYLES = ['short', 'buzz', 'curly', 'long', 'bun', 'braids', 'bald'];
HSS.OUTFIT_COLORS = ['#2a3550', '#3d3d3f', '#5c2a33', '#274a34', '#5b4632', '#333f5c', '#4a3560'];

function weighted(rng, table) {
  const total = table.reduce((a, [, w]) => a + w, 0);
  let r = rng() * total;
  for (const [v, w] of table) { r -= w; if (r <= 0) return v; }
  return table[0][0];
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// --- 986 students: years 7-11, 7 forms per year (A-G) ----------------------
HSS.FORMS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
HSS.generateStudents = function () {
  const rng = HSS.makeRng(986986);
  const students = [];
  const perYear = [198, 198, 198, 196, 196]; // = 986
  let idn = 0;
  for (let yi = 0; yi < 5; yi++) {
    const year = 7 + yi;
    for (let i = 0; i < perYear[yi]; i++) {
      const form = HSS.FORMS[i % 7];
      const grades = {};
      const base = 3 + rng() * 4;
      for (const s of HSS.SUBJECTS) grades[s] = Math.max(1, Math.min(9, Math.round(base + (rng() * 4 - 2))));
      students.push({
        id: `st-${++idn}`,
        kind: 'student',
        name: `${pick(rng, FIRST)} ${pick(rng, LAST)}`,
        year, form: `${year}${form}`,
        age: 11 + yi + (rng() < 0.5 ? 0 : 1),
        sen: weighted(rng, SEN_STATUSES),
        homeLife: weighted(rng, HOME_LIVES),
        behaviour: pick(rng, BEHAVIOURS),
        stats: {
          engagement: 1 + Math.floor(rng() * 10),
          disruption: 1 + Math.floor(rng() * 10),
          anxiety: 1 + Math.floor(rng() * 10),
          sociability: 1 + Math.floor(rng() * 10),
        },
        grades,
        records: [],
        attendancePct: 86 + Math.floor(rng() * 14),
        appearance: {
          skin: pick(rng, HSS.SKIN_TONES),
          hairStyle: pick(rng, HSS.HAIR_STYLES.slice(0, 6)),
          hairColor: pick(rng, HSS.HAIR_COLORS),
          outfit: '#2a3550', // uniform blazer navy
          height: 0.82 + yi * 0.035 + rng() * 0.08,
        },
      });
    }
  }
  return students;
};

// Timetable: which subject a form has in a given lesson period, and which
// classroom. Classroom list is provided by campus.js after build.
HSS.lessonFor = function (form, periodName) {
  const lessons = HSS.SCHEDULE.filter(p => p.kind === 'lesson' || p.kind === 'form');
  const pi = Math.max(0, lessons.findIndex(p => p.name === periodName));
  const year = parseInt(form, 10);
  const fi = HSS.FORMS.indexOf(form.slice(-1));
  const subject = HSS.SUBJECTS[(pi * 3 + fi + year) % HSS.SUBJECTS.length];
  return { subject, roomIndex: (fi + (year - 7) * 7) % 28 };
};
