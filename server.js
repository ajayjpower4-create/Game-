import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import { SCHOOL_OVERVIEW, SCHEDULE, STAFF, CAMPUS } from './data/lore.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = 'claude-sonnet-5';

// --- Build a compact one-line-per-student roster from the CSV --------------
// The full CSV (with long prose descriptions) is ~690KB and too large to send
// on every request. We compress each student to a single dense line so the AI
// knows the entire roll of ~900 named students while keeping the prompt small
// enough to prompt-cache cheaply.
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQuotes = false;
      else cur += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}

function compactLine(r) {
  const sen = r.sen_status && r.sen_status !== 'None'
    ? `${r.sen_status}${r.sen_primary_need ? '/' + r.sen_primary_need : ''}`
    : '';
  const flags = [];
  if (r.pupil_premium === 'Yes') flags.push('PP');
  if (r.eal && r.eal !== 'No') flags.push('EAL');
  if (r.attendance_concern === 'True') flags.push('AttConcern');
  if (r.emotionally_based_school_avoidance === 'True') flags.push('EBSA');
  // Dense, pipe-delimited line. Keep it human-readable for the model.
  return [
    r.id,
    r.name,
    r.sex,
    `Y${r.year}`,
    r.form,
    `House:${r.house}`,
    `Tutor:${r.tutor}`,
    `AWG:${r.avg_working_grade}`,
    `Att:${r.attendance_pct}%`,
    `Beh:${r.behaviour_points}pts`,
    `Tier:${r.behaviour_tier}`,
    sen ? `SEN:${sen}` : '',
    `Best:${r.best_subject}`,
    `Weak:${r.weakest_subject}`,
    flags.length ? flags.join(',') : '',
  ].filter(Boolean).join(' | ');
}

function loadStudents() {
  const raw = readFileSync(join(__dirname, 'data', 'harford_students.csv'), 'utf8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim().length);
  const header = parseCsvLine(lines[0]).map(h => h.trim());
  const records = lines.slice(1).map(line => {
    const c = parseCsvLine(line);
    const rec = {};
    header.forEach((h, i) => { rec[h] = (c[i] ?? '').trim(); });
    return rec;
  });
  return records;
}

// Compact index of every student (all fields except the long description) plus
// the distinct values needed to build the filter menus. Served once and then
// filtered instantly in the browser.
// Rows are sent as plain arrays against a shared `fields` list — repeating 20+
// JSON keys 900 times would quadruple the payload. The client zips them back
// into objects. Full records (with the description) come from /api/student.
const INDEX_FIELDS = [
  'id', 'name', 'sex', 'year', 'form', 'house', 'tutor',
  'avg_working_grade', 'reading_age', 'best_subject', 'weakest_subject',
  'attendance_pct', 'behaviour_points', 'detentions', 'suspensions',
  'behaviour_tier', 'sen_status', 'sen_primary_need',
  'pupil_premium', 'eal', 'attendance_concern',
  'emotionally_based_school_avoidance',
];

let INDEX_JSON = '{"fields":[],"rows":[],"facets":{}}';
function buildIndex() {
  const uniq = key => [...new Set(STUDENTS.map(s => s[key]).filter(v => v && v !== 'None'))].sort();
  const subjects = [...new Set([
    ...STUDENTS.map(s => s.best_subject),
    ...STUDENTS.map(s => s.weakest_subject),
  ].filter(Boolean))].sort();
  return JSON.stringify({
    fields: INDEX_FIELDS,
    rows: STUDENTS.map(s => INDEX_FIELDS.map(f => s[f] ?? '')),
    facets: {
      years: uniq('year'),
      forms: uniq('form'),
      houses: uniq('house'),
      tutors: uniq('tutor'),
      subjects,
      behaviour_tiers: uniq('behaviour_tier'),
      sen_statuses: uniq('sen_status'),
      sen_needs: uniq('sen_primary_need'),
    },
  });
}

let STUDENTS = [];
let ROSTER = { count: 0, text: '' };
try {
  STUDENTS = loadStudents();
  ROSTER = { count: STUDENTS.length, text: STUDENTS.map(compactLine).join('\n') };
  INDEX_JSON = buildIndex();
  console.log(`Loaded roster: ${ROSTER.count} students (index ${(INDEX_JSON.length / 1024).toFixed(0)}KB)`);
} catch (err) {
  console.error('Failed to load student roster:', err.message);
}

// Look up students by id, exact name, or partial name/token match.
function findStudents(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const byId = STUDENTS.filter(s => s.id.toLowerCase() === q);
  if (byId.length) return byId;
  const exact = STUDENTS.filter(s => s.name.toLowerCase() === q);
  if (exact.length) return exact;
  const terms = q.split(/\s+/).filter(Boolean);
  return STUDENTS.filter(s => {
    const hay = `${s.name} ${s.id} ${s.form}`.toLowerCase();
    return terms.every(t => hay.includes(t));
  });
}

// --- System prompt ---------------------------------------------------------
const RULES = `
YOU ARE THE ENGINE OF "HARFORD SECONDARY SIMULATOR", a roleplay set at Harford
Secondary, a UK state secondary school in East London. The USER plays a member
of staff (a rank and name they choose). You voice EVERYONE ELSE in the world.

ABSOLUTE RULES — follow these exactly, every single message:

1. NEVER NARRATE. Not a little, not ever. Do not describe scenery, weather,
   rooms, the passage of time, what a character looks like, or what anyone
   other than the character currently speaking is doing. No scene-setting, no
   "the corridor was busy", no stage directions about other people. You are
   not a narrator.

2. YOU ONLY PLAY CHARACTERS. Speak AS the students, parents/family members,
   and staff the user interacts with — in their own voice, in first person.
   The user talks to a character; that character replies. Nothing else.

3. TINY SELF-ACTIONS ONLY. A character may include one very short action about
   THEMSELVES only, e.g. *I hang up the phone* or *slams the door*. Keep it a
   few words. NEVER describe any other character's actions, appearance, or the
   environment inside these asterisks.

4. CUSS AND SHOUT. Characters swear a lot, yell, kick off, and act fully in
   character — angry parents, mouthy Year 9s, stressed teachers. Let them be
   raw, rude and loud when it fits. Match the energy of a real rough day at an
   inner-London secondary. (Keep it to language/attitude — never sexual content
   involving minors, and never real-world instructions for genuine harm.)

5. THE USER LEADS, NOT YOU. You do NOT run the game, decide outcomes, or move
   the plot. You never break the fourth wall, never address "the player", never
   control the world or narrate consequences. You only react as characters to
   what the user does.

6. USER-DECLARED TRUTH. Anything the user writes inside *asterisks* or
   (parentheses) is a TRUE action, event, or fact in the world — accept it
   completely and have your characters react to it. Do not argue with it, undo
   it, or narrate around it. If the user says *I suspend Danny* then Danny is
   suspended; react as Danny (or his family) would.

7. THE USER'S ROLE IS CANONICAL — THE STAFF LIST IS NOT EXHAUSTIVE. The staff
   list below is only the staff we happen to have written down. Harford is a
   big school with many more posts than are listed. If the user says their rank
   is "Head of Student Grades and Advanced Classes", or ANY other title —
   unusual, invented, made up on the spot, or simply not in the list — then
   that post EXISTS at Harford, has existed for years, and the user holds it.
   NEVER tell the user their role isn't real, doesn't exist here, "isn't a
   thing", or that they mean some other job. NEVER correct their title to a
   "proper" one. NEVER have a character express confusion about whether their
   job exists, question their authority to hold it, or ask "since when do we
   have that role?" Characters treat the user's post as completely normal,
   established and legitimate.

   The same applies to ANY department, committee, team, room, policy, meeting,
   event or extra staff member the user declares into existence: from the
   moment they say it, it is real and long-standing, and every character
   behaves as though it always has been. If a listed member of staff would
   overlap with the user's post, they simply work alongside the user — never a
   contradiction, never a turf argument about whether the role is real.

8. STAY IN THE WORLD. Use the real staff, schedule, campus and the student
   roster below. Keep students consistent with their roster data (year, form,
   behaviour, SEND, family situation). If the user talks to a student, BE that
   student. If they phone a parent, BE that parent (invent the family
   consistently with the student's description).

FORMAT: Reply only as the character(s) the user is addressing. If multiple
characters are present and being spoken to, you may voice each with a short
name label (e.g. "Danny: ..."). No narration lines between them.
`.trim();

const HOW_TO_PLAY = `
HOW THE GAME STARTS (guide the user only if they haven't set up yet, and do it
IN CHARACTER as a colleague or by simply prompting them — never as a narrator):
- The user picks their RANK — any title at all, listed or not (see rule 7).
- Then their NAME.
- They may also give extra character details: how many YEARS they have worked
  at Harford, their subject/department, age, where they are based on campus,
  and free-text background. Treat every detail as established fact. If they
  have been at Harford for years, long-serving staff know them well and refer
  to shared history; if they are new, staff treat them as new. Weave these
  details in through what characters SAY — never through narration.
- Then play begins. The user can type /nextday to advance to the next school
  day. When a new day begins, characters behave as if it's the start of a fresh
  school day on the schedule (arrival / tutor time), but YOU still never narrate
  it — a character (e.g. Mr Mike on the intercom, or a tutor-group student)
  reacts instead.
- The user also has a staff computer (the school information system) they can
  search students on. If they quote a student's record at you, it is accurate.
`.trim();

function systemPrompt() {
  return [
    { type: 'text', text: RULES },
    {
      type: 'text',
      text: [SCHOOL_OVERVIEW, SCHEDULE, CAMPUS, STAFF, HOW_TO_PLAY].join('\n\n'),
      cache_control: { type: 'ephemeral' },
    },
    {
      type: 'text',
      text: `STUDENT ROSTER (${ROSTER.count} students — one line each; stay consistent with this data when voicing any student or their family):\n\n${ROSTER.text}`,
      cache_control: { type: 'ephemeral' },
    },
  ];
}

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// Health/diagnostics. Open this URL in a browser to confirm server.js is the
// process actually handling requests. If this returns JSON, the backend is
// live; if it 404s, the site is being served as static files only.
const BUILD = 'harford-2024-06-2';
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'harford-secondary-simulator',
    build: BUILD,
    model: MODEL,
    students: ROSTER.count,
    apiKeyConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    time: new Date().toISOString(),
  });
});

app.get('/api/students/index', (req, res) => {
  // Static for the life of the process; ETag + max-age make repeat opens free.
  res.set('Cache-Control', 'public, max-age=3600');
  res.type('application/json').send(INDEX_JSON);
});

// School "computer" — look up a student's full record. Not routed through the
// AI; this is the staff information system (/computerstudent in the UI).
app.get('/api/student', (req, res) => {
  const q = (req.query.q || '').toString();
  if (!q.trim()) return res.json({ query: q, results: [] });
  const matches = findStudents(q).slice(0, 12);
  res.json({ query: q, count: matches.length, results: matches });
});

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid messages format' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt(),
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    const message = err instanceof Anthropic.APIError
      ? `API error ${err.status}: ${err.message}`
      : 'An unexpected error occurred';
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  }
});

// Any /api/* route that wasn't matched above — return JSON so a 404 here is
// clearly Express (backend is running) rather than a static host.
app.use('/api', (req, res) => {
  res.status(404).json({ error: `No API route: ${req.method} ${req.path}`, build: BUILD });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Harford Secondary Simulator (${BUILD}) running at http://localhost:${PORT}`);
});
