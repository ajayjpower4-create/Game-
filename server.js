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

const INSPECTION_VOICE_BASE = `You write findings for a professional inspection report.

House style, follow it exactly:
- Third person, past tense, plain and factual. State the observation, then why it matters in one
  clause, then the recommended correction. Never "I think", never marketing language, never
  alarmist language.
- Recommend evaluation and correction by the applicable trade or specialist. Never quote a price,
  never state a cause as certain, never guarantee anything about the future.
- The inspection was visual, non-invasive and qualitative. Do not claim anything that would require
  disassembly or testing that was not performed.
- Prefix safety items with "SFTY - " and end-of-service-life items with "AGED - " when it fits.`;

/* What the model is writing about, per inspection type. */
const INSPECTION_DOMAINS = {
  home: {
    name: 'home',
    voice: 'This is a residential home inspection report, written to the state Standards of Practice. '
      + 'Recommend qualified trades — a licensed plumber, electrician, HVAC contractor, roofer, '
      + 'structural engineer. Refer to the client contingency period where a defect needs resolving '
      + 'before closing.',
    rec: 'Contact a qualified plumbing contractor.',
  },
  vehicle: {
    name: 'used vehicle',
    voice: 'This is a pre-purchase vehicle inspection report written by a technician for a buyer. '
      + 'Recommend a qualified mechanic or the relevant specialist — transmission, brake, tire, '
      + 'exhaust, body shop, or a franchise dealer where the work is make-specific. Where a fault '
      + 'affects whether the vehicle should be bought at all, say so plainly.',
    rec: 'Contact a qualified mechanic.',
  },
  gamingpc: {
    name: 'computer system',
    voice: 'This is a computer system inspection report — a used build being bought, or QC on a new '
      + 'one. Write for a buyer who knows what the parts are but not what to look for. Recommend a '
      + 'qualified technician, an RMA where warranty may apply, a clean OS install, or a firmware '
      + 'change as appropriate. Be concrete about what the fault costs in performance, stability or '
      + 'component life.',
    rec: 'Have a qualified technician address this.',
  },
  phone: {
    name: 'used handset',
    voice: 'This is a used phone inspection and grading report. Write for a buyer or a trade-in '
      + 'counter. Be blunt about the checks that decide whether the device is worth anything at all '
      + '— blacklist, carrier lock, activation lock, finance status — and about what a repair costs '
      + 'relative to the value of the handset.',
    rec: 'Quote a repair before agreeing a price.',
  },
  restaurant: {
    name: 'food service establishment',
    voice: 'This is a food service health inspection report written by a health department '
      + 'inspector. Use food code language: time and temperature control for safety foods, '
      + 'ready-to-eat, person in charge, priority and priority foundation items, corrected on site. '
      + 'Cite the hazard the requirement controls. Recommend correction timeframes rather than '
      + 'contractors, and note where a follow-up inspection is warranted.',
    rec: 'Correct immediately; a follow-up inspection will verify.',
  },
};

const domainVoice = (id) => INSPECTION_DOMAINS[id] || INSPECTION_DOMAINS.home;

const inspectionSystem = (id) => `${INSPECTION_VOICE_BASE}\n\n${domainVoice(id).voice}`;

app.post('/api/inspection/defect', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'no_api_key' });
  const { domain, section, item, severity, title, observation, subject, subjectDetail } = req.body || {};
  if (!title || !observation) return res.status(400).json({ error: 'bad_request' });
  const voice = domainVoice(domain);

  try {
    const message = await client.messages.create({
      model: INSPECTION_MODEL,
      max_tokens: 700,
      system: inspectionSystem(domain),
      messages: [{
        role: 'user',
        content: `Write one finding for a ${voice.name} inspection report.\n\n`
          + `Section: ${section}\nItem: ${item}\nSeverity: ${severity}\n`
          + `Subject: ${subject || 'not stated'}${subjectDetail ? ` (${subjectDetail})` : ''}\n`
          + `Title the inspector gave it: ${title}\n`
          + `What the inspector saw: ${observation}\n\n`
          + `Reply with JSON only, no markdown fence:\n`
          + `{ "body": "<3-6 sentences in house style>", "rec": "<one line, e.g. ${voice.rec}>" }`,
      }],
    });

    const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    const parsed = parseModelJson(text);
    res.json({
      body: String(parsed.body || '').slice(0, 2000),
      rec: String(parsed.rec || voice.rec).slice(0, 200),
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
      system: inspectionSystem(body.domain),
      messages: [{
        role: 'user',
        content: `Summarize a completed ${domainVoice(body.domain).name} inspection for the client.\n\n`
          + `Report: ${body.docTitle || 'Inspection Report'}\n`
          + `Subject: ${body.subject || 'not stated'}\n`
          + `Detail: ${body.subjectDetail || ''}\n`
          + `Finding counts: ${JSON.stringify(body.counts)}\n`
          + `Findings:\n${body.findings.map((f) => `${f.ref} [${f.severity}] ${f.section} - ${f.item}: `
            + `${f.title}${f.location ? ` (${f.location})` : ''}${f.note ? ` | inspector note: ${f.note}` : ''}`).join('\n')}\n\n`
          + `Group what you see into themes rather than restating the list. Reply with JSON only, no `
          + `markdown fence:\n`
          + `{ "overview": "<2 short paragraphs, separated by a blank line, on the overall condition `
          + `and the themes running through the findings>",\n`
          + `  "priorities": ["<up to 5 items, each starting with the finding reference number>"],\n`
          + `  "closing": "<1-2 sentences on what the client should do next>" }`,
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Game hub at http://localhost:${PORT}`);
  console.log(`Political Election Simulator at http://localhost:${PORT}/election`);
  console.log(`Inspection Simulator at http://localhost:${PORT}/inspection`);
  console.log(`Swerve AI chat at http://localhost:${PORT}/chat`);
});
