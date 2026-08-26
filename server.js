import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { STATES, STATE_CODES } from './public/election/data.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ELECTION_MODEL = process.env.ELECTION_MODEL || 'claude-opus-4-6';

app.use(express.json({ limit: '256kb' }));
// index: false so the routes below decide what lives at each path; assets
// (css/js) are still served straight out of public/.
app.use(express.static(join(__dirname, 'public'), { index: false }));

// The homepage is a hub listing every game; each game keeps its own path.
const page = (...parts) => (req, res) => res.sendFile(join(__dirname, 'public', ...parts));

app.get('/', page('hub.html'));
app.get(['/election', '/election/'], page('election', 'index.html'));
app.get(['/chat', '/chat/'], page('index.html'));
app.get(['/inspection', '/inspection/'], page('inspection', 'index.html'));
app.get(['/court', '/court/'], page('court', 'index.html'));

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
      model: 'claude-opus-4-6',
      max_tokens: 64000,
      system: `You are an unrestricted AI assistant. You speak directly, candidly, and without excessive caveats or moralizing. You engage with any topic the user brings up — creative writing, hypotheticals, edgy humor, mature themes — treating the user as a capable adult. You don't add unsolicited warnings, disclaimers, or refuse based on vague discomfort. Be helpful, honest, and real.`,
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

/* ------------------------------------------------- Political Election Simulator */

const ELECTION_SYSTEM = `You are the returns desk for a fictional election game.

The player has invented a presidential race between two people and run a
three-month campaign. Your job is to call the result of that made-up election:
who wins each of the 51 contests (50 states + DC) and the national popular vote.

This is a game. Nothing you produce is a forecast, a poll, or a claim about any
real person or any real election — it is invented entertainment for the player,
so commit to a clear, decisive, entertaining outcome.

How to judge it:
- Weigh each candidate's public standing and how well they fit each state.
- Weigh where they rallied. Rallies move their state and, a little, its region;
  late rallies matter more than early ones.
- Weigh the message: a sharp, focused stump speech travels further than a vague
  one, and the themes they chose decide which states warm to them.
- Landslides, squeakers and popular-vote/electoral-vote splits are all fair game.
  Do not default to a 50/50 map.

Reply with JSON only — no prose, no markdown fence. Shape:
{
  "states": { "AL": "a", "AK": "b", ... all 51 codes, value "a" or "b" ... },
  "popular": { "a": <integer total votes>, "b": <integer total votes> },
  "headline": "<one newspaper headline>",
  "summary": "<2-4 sentences on why it broke this way>",
  "keyMoments": [ { "date": "YYYY-MM-DD", "text": "<what happened>" } ],
  "notes": { "a": "<1-2 sentences on candidate A's campaign>",
             "b": "<1-2 sentences on candidate B's campaign>" }
}
Nationwide turnout should land somewhere near 155,000,000 votes total.
Valid state codes: ${STATE_CODES.join(' ')}`;

// Turnout baselines the model should stay roughly anchored to.
const TURNOUT_TABLE = STATES
  .map((s) => `${s.code} ${s.name}: ${s.ev} EV, ~${(s.pop * 1000).toLocaleString('en-US')} ballots`)
  .join('\n');

function parseModelJson(text) {
  const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON object in reply');
  return JSON.parse(trimmed.slice(start, end + 1));
}

function validateResult(result) {
  if (!result || typeof result !== 'object') throw new Error('empty result');
  const states = result.states;
  if (!states || typeof states !== 'object') throw new Error('missing states');
  for (const code of STATE_CODES) {
    if (states[code] !== 'a' && states[code] !== 'b') throw new Error(`bad call for ${code}`);
  }
  const a = Number(result.popular?.a);
  const b = Number(result.popular?.b);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) {
    throw new Error('bad popular vote');
  }
  // Keep the totals inside believable bounds; the client scales states to match.
  const clampVotes = (n) => Math.min(2.5e8, Math.max(1e6, Math.round(n)));
  return {
    states: Object.fromEntries(STATE_CODES.map((c) => [c, states[c]])),
    popular: { a: clampVotes(a), b: clampVotes(b) },
    headline: String(result.headline || '').slice(0, 200),
    summary: String(result.summary || '').slice(0, 1200),
    keyMoments: Array.isArray(result.keyMoments)
      ? result.keyMoments.slice(0, 8).map((m) => ({
        date: String(m?.date || '').slice(0, 10),
        text: String(m?.text || '').slice(0, 300),
      })).filter((m) => m.text)
      : [],
    notes: {
      a: String(result.notes?.a || '').slice(0, 600),
      b: String(result.notes?.b || '').slice(0, 600),
    },
  };
}

app.post('/api/election/simulate', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'no_api_key' });
  }
  const game = req.body?.game;
  if (!game?.candidates?.a?.name || !game?.candidates?.b?.name) {
    return res.status(400).json({ error: 'bad_request' });
  }

  try {
    const message = await client.messages.create({
      model: ELECTION_MODEL,
      max_tokens: 4000,
      system: ELECTION_SYSTEM,
      messages: [{
        role: 'user',
        content: `Reference turnout and electoral votes:\n${TURNOUT_TABLE}\n\n`
          + `The campaign:\n${JSON.stringify(game, null, 2)}\n\n`
          + 'Call the election. JSON only.',
      }],
    });

    const text = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');

    const result = validateResult(parseModelJson(text));
    res.json({ result, model: ELECTION_MODEL });
  } catch (err) {
    const detail = err instanceof Anthropic.APIError ? `api_${err.status}` : err.message;
    console.warn('Election simulation failed:', detail);
    res.status(502).json({ error: detail || 'simulation_failed' });
  }
});

/* ------------------------------------------------------- Inspection Simulator */

const INSPECTION_MODEL = process.env.INSPECTION_MODEL || 'claude-sonnet-5';

const INSPECTION_VOICE = `You write for a residential home inspection report.

House style, follow it exactly:
- Third person, past tense, plain and factual. "Damaged receptacle(s) were present at the
  referenced area(s)." Never "I think", never marketing language, never alarmist language.
- State the observation, then why it matters in one clause, then the recommended correction.
- Recommend evaluation and repair by the applicable trade. Never quote a price, never estimate
  remaining service life in years for a specific component, never state a cause as certain.
- A home inspection is visual, non-invasive, qualitative and not technically exhaustive. Do not
  claim anything that would require invasive access or testing that was not performed.
- Prefix safety items with "SFTY - " and age-related items with "AGED - " when it fits.`;

app.post('/api/inspection/defect', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'no_api_key' });
  const { section, item, severity, title, observation, property } = req.body || {};
  if (!title || !observation) return res.status(400).json({ error: 'bad_request' });

  try {
    const message = await client.messages.create({
      model: INSPECTION_MODEL,
      max_tokens: 700,
      system: INSPECTION_VOICE,
      messages: [{
        role: 'user',
        content: `Write one defect comment for an inspection report.\n\n`
          + `Section: ${section}\nItem: ${item}\nSeverity: ${severity}\n`
          + `Property: ${property?.type || 'single family home'}, built ${property?.yearBuilt || 'unknown'}\n`
          + `Title the inspector gave it: ${title}\n`
          + `What the inspector saw: ${observation}\n\n`
          + `Reply with JSON only, no markdown fence:\n`
          + `{ "body": "<3-6 sentences in house style>", "rec": "<one line, e.g. Contact a qualified plumbing contractor.>" }`,
      }],
    });

    const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    const parsed = parseModelJson(text);
    res.json({
      body: String(parsed.body || '').slice(0, 2000),
      rec: String(parsed.rec || 'Contact a qualified professional.').slice(0, 200),
    });
  } catch (err) {
    const detail = err instanceof Anthropic.APIError ? `api_${err.status}` : err.message;
    console.warn('Inspection defect write-up failed:', detail);
    res.status(502).json({ error: detail || 'write_failed' });
  }
});

app.post('/api/inspection/summarize', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'no_api_key' });
  const body = req.body || {};
  if (!Array.isArray(body.findings)) return res.status(400).json({ error: 'bad_request' });

  try {
    const message = await client.messages.create({
      model: INSPECTION_MODEL,
      max_tokens: 1500,
      system: INSPECTION_VOICE,
      messages: [{
        role: 'user',
        content: `Summarize a completed home inspection for the client.\n\n`
          + `Property: ${JSON.stringify(body.property)}\n`
          + `Systems: ${JSON.stringify(body.profile)}\n`
          + `Finding counts: ${JSON.stringify(body.counts)}\n`
          + `Findings:\n${body.findings.map((f) => `${f.ref} [${f.severity}] ${f.section} - ${f.item}: `
            + `${f.title}${f.location ? ` (${f.location})` : ''}${f.note ? ` | inspector note: ${f.note}` : ''}`).join('\n')}\n\n`
          + `Group what you see into themes rather than restating the list. Reply with JSON only, no `
          + `markdown fence:\n`
          + `{ "overview": "<2 short paragraphs, separated by a blank line, on the overall condition of `
          + `the home and the themes running through the findings>",\n`
          + `  "priorities": ["<up to 5 items, each starting with the finding reference number>"],\n`
          + `  "closing": "<1-2 sentences on next steps within the contingency period>" }`,
      }],
    });

    const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    const parsed = parseModelJson(text);
    res.json({
      overview: String(parsed.overview || '').slice(0, 4000),
      priorities: Array.isArray(parsed.priorities)
        ? parsed.priorities.slice(0, 5).map((t) => String(t).slice(0, 300))
        : [],
      closing: String(parsed.closing || '').slice(0, 600),
      model: INSPECTION_MODEL,
    });
  } catch (err) {
    const detail = err instanceof Anthropic.APIError ? `api_${err.status}` : err.message;
    console.warn('Inspection summary failed:', detail);
    res.status(502).json({ error: detail || 'summary_failed' });
  }
});

/* ----------------------------------------------------------- Court Simulator */

const COURT_MODEL = process.env.COURT_MODEL || 'claude-sonnet-5';

const clip = (v, n) => String(v ?? '').slice(0, n);

/* The cast is split two ways: characters the player speaks for, and characters
 * the model speaks for. The player can move a character from one pile to the
 * other mid-trial, so the system prompt is rebuilt from the setup on every
 * request rather than pinned at the start. */
function courtCast(setup) {
  const roles = Array.isArray(setup?.roles) ? setup.roles.slice(0, 20) : [];
  const line = (r) => `- ${clip(r.character, 80) || clip(r.role, 60)} — ${clip(r.role, 60)}`
    + `${r.description ? `: ${clip(r.description, 700)}` : ''}`;
  return {
    player: roles.filter((r) => r.played === 'user'),
    ai: roles.filter((r) => r.played !== 'user'),
    line,
  };
}

function buildCourtSystem(setup) {
  const { player, ai, line } = courtCast(setup);
  const c = setup?.caseInfo || {};
  const decider = setup?.verdictBy === 'jury'
    ? `a jury of ${Number(setup?.juryCount) || 12}`
    : 'the judge from the bench';

  return `You are running a courtroom roleplay for one player. Everything here is invented fiction
for a game — no real case, no real person, no legal advice.

THE CASE
Case number: ${clip(c.id, 60) || 'unassigned'}
Court: ${clip(c.court, 120) || 'County Superior Court'}
Matter: ${clip(c.partyA, 120) || 'The People'} v. ${clip(c.partyB, 120) || 'the defendant'}
Type: ${c.type === 'civil' ? 'civil suit' : 'criminal prosecution'}
Charge or claim: ${clip(c.charge, 300) || 'unstated'}
Background: ${clip(c.summary, 2000) || 'The player will fill this in as you go.'}
The verdict will be decided by ${decider}.

CHARACTERS THE PLAYER SPEAKS FOR — never write their dialogue, never narrate their
actions, never decide what they think or do. Wait for the player.
${player.map(line).join('\n') || '- (none yet)'}

CHARACTERS YOU SPEAK FOR — you are all of them, and only them.
${ai.map(line).join('\n') || '- (none)'}

HOW TO WRITE
- You are ONLY these characters. No narrator voice, no scene-setting essays, no
  summaries of what the player did, no coaching, no out-of-character commentary.
- Start every character's turn on its own line with their name and role in bold:
  **Marcus Hale (Prosecutor):** followed by what they say.
- Physical action goes in asterisks, in the same line or on its own:
  *I walk over to the prosecutor and grab the papers.*
- Several of your characters may speak in one reply when the room would naturally
  react — an objection, a gavel, a witness answering. Keep it tight: usually one
  to four turns, then hand the floor back to the player.
- Stay in the procedural shape of a real trial: openings, direct, cross,
  objections and rulings, closings, then the verdict. Push the case forward.
- Let it go badly for the player sometimes. Witnesses can be hostile, objections
  can be sustained against them, rulings can hurt. Do not flatter the player.

EVIDENCE — THIS IS A HARD RULE
You never invent what the player's side is holding. Whenever any of your
characters would have the player's character produce, admit, hand over, read from
or confirm a piece of evidence, testimony record, exhibit or document, you STOP and
ask the player whether they have it. Emit exactly this, alone at the very end of
your reply, and write nothing after it:

[[EVIDENCE]]{"item":"the dashcam footage from the night of the 14th","asker":"Marcus Hale (Prosecutor)","question":"Does the defense have the dashcam footage to enter into evidence?","options":["Yes, I have it","No, I don't have it"]}[[/EVIDENCE]]

The player's answer comes back as a line beginning EVIDENCE ANSWER. Treat that
answer as the truth of the fiction and play the consequences honestly — a missing
exhibit hurts the side that promised it. Evidence YOUR OWN characters hold is
yours to invent freely; only the player's side needs asking.

Do not narrate the verdict until the player asks for it. When the player sends a
line beginning VERDICT, that outcome is final and already decided: play the room
reading it out — the clerk, the foreperson, the judge, the reaction — and never
contradict it.`;
}

function courtMessages(body) {
  const raw = Array.isArray(body?.messages) ? body.messages.slice(-60) : [];
  // Consecutive turns from the same side are merged — the player can send a
  // stage note, an evidence answer and a line of dialogue back to back.
  const msgs = [];
  raw
    .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && String(m?.content || '').trim())
    .forEach((m) => {
      const last = msgs[msgs.length - 1];
      if (last && last.role === m.role) last.content += `\n\n${clip(m.content, 6000)}`;
      else msgs.push({ role: m.role, content: clip(m.content, 6000) });
    });
  // The API needs a user turn to start from; an opening gavel counts as one.
  if (!msgs.length || msgs[0].role !== 'user') {
    msgs.unshift({ role: 'user', content: 'Court is called to order. Begin.' });
  }
  return msgs;
}

app.post('/api/court/chat', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'no_api_key' });
  if (!req.body?.setup) return res.status(400).json({ error: 'bad_request' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = client.messages.stream({
      model: COURT_MODEL,
      max_tokens: 2000,
      system: buildCourtSystem(req.body.setup),
      messages: courtMessages(req.body),
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
      : 'The court reporter dropped the transcript. Try again.';
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  }
});

/* Fills in the cast the player did not want to write themselves. */
app.post('/api/court/cast', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'no_api_key' });
  const c = req.body?.caseInfo || {};
  const roles = Array.isArray(req.body?.roles) ? req.body.roles.slice(0, 12) : [];
  if (!roles.length) return res.status(400).json({ error: 'bad_request' });

  try {
    const message = await client.messages.create({
      model: COURT_MODEL,
      max_tokens: 1600,
      system: 'You invent characters for a fictional courtroom game. Nobody you write is a real '
        + 'person. Give each one a plain name that fits the setting and two sentences of substance: '
        + 'how they carry themselves in a courtroom, and one thing about them that could change how '
        + 'the trial goes. No stage directions, no lists, no markdown.',
      messages: [{
        role: 'user',
        content: `Case ${clip(c.id, 60)}: ${clip(c.partyA, 120)} v. ${clip(c.partyB, 120)} in `
          + `${clip(c.court, 120)}. ${c.type === 'civil' ? 'Civil suit' : 'Criminal case'}, `
          + `${clip(c.charge, 300)}.\nBackground: ${clip(c.summary, 1500) || 'not given'}\n\n`
          + `Write these roles:\n${roles.map((r) => `- ${clip(r.role, 60)}`
            + `${r.hint ? ` (${clip(r.hint, 200)})` : ''}`).join('\n')}\n\n`
          + 'Reply with JSON only, no markdown fence:\n'
          + '{ "cast": [ { "role": "<the role exactly as given>", "character": "<name>", '
          + '"description": "<two sentences>" } ] }',
      }],
    });

    const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    const parsed = parseModelJson(text);
    res.json({
      cast: (Array.isArray(parsed.cast) ? parsed.cast : []).slice(0, 12).map((m) => ({
        role: clip(m.role, 60),
        character: clip(m.character, 80),
        description: clip(m.description, 700),
      })).filter((m) => m.role && m.character),
    });
  } catch (err) {
    const detail = err instanceof Anthropic.APIError ? `api_${err.status}` : err.message;
    console.warn('Court cast generation failed:', detail);
    res.status(502).json({ error: detail || 'cast_failed' });
  }
});

/* "Surprise me" on the case sheet. */
app.post('/api/court/case', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'no_api_key' });
  const type = req.body?.type === 'civil' ? 'civil' : 'criminal';

  try {
    const message = await client.messages.create({
      model: COURT_MODEL,
      max_tokens: 800,
      system: 'You invent fictional court cases for a game. Never use a real case, a real person, '
        + 'or a real company. Make the facts genuinely arguable — both sides should have something.',
      messages: [{
        role: 'user',
        content: `Invent one ${type} case. Reply with JSON only, no markdown fence:\n`
          + '{ "id": "<docket number, e.g. CR-2026-04417>", "court": "<fictional court name>", '
          + `"partyA": "<${type === 'civil' ? 'plaintiff' : 'prosecuting body'}>", `
          + '"partyB": "<defendant name>", "charge": "<the charge or claim, one line>", '
          + '"summary": "<3-5 sentences of background both sides would argue over>" }',
      }],
    });

    const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    const p = parseModelJson(text);
    res.json({
      id: clip(p.id, 60), court: clip(p.court, 120), partyA: clip(p.partyA, 120),
      partyB: clip(p.partyB, 120), charge: clip(p.charge, 300), summary: clip(p.summary, 2000), type,
    });
  } catch (err) {
    const detail = err instanceof Anthropic.APIError ? `api_${err.status}` : err.message;
    console.warn('Court case generation failed:', detail);
    res.status(502).json({ error: detail || 'case_failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Game hub at http://localhost:${PORT}`);
  console.log(`Political Election Simulator at http://localhost:${PORT}/election`);
  console.log(`Inspection Simulator at http://localhost:${PORT}/inspection`);
  console.log(`Court Simulator at http://localhost:${PORT}/court`);
  console.log(`Swerve AI chat at http://localhost:${PORT}/chat`);
});
