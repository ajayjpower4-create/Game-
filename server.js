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
app.use(express.static(join(__dirname, 'public')));

// Tow Truck Simulator loads three.js from node_modules — no CDN at runtime.
const threeRoot = join(__dirname, 'node_modules', 'three');
app.use('/tow/vendor/three', express.static(join(threeRoot, 'build')));
app.use('/tow/vendor/three-addons', express.static(join(threeRoot, 'examples', 'jsm')));

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Swerve AI running at http://localhost:${PORT}`);
  console.log(`Political Election Simulator at http://localhost:${PORT}/election/`);
  console.log(`Tow Truck Simulator at http://localhost:${PORT}/tow/`);
});
