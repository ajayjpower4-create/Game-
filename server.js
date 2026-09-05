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
app.get(['/podcast', '/podcast/'], page('podcast', 'index.html'));

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

/* -------------------------------------------------------- Sports Podcast Simulator */

const PODCAST_MODEL = process.env.PODCAST_MODEL || 'claude-sonnet-5';

const RAW_MOUTH = `Everybody at this desk is a grown adult on an unfiltered show and they talk like it.
Real profanity, used naturally and often: fuck, shit, bitch, asshole, dumbass, god damn it, Jesus
fucking Christ, for fuck's sake. Real insults, real trash talk, no asterisks, no bleeping, no
apologizing for it afterward. Never sanitize a line you already wrote.`;

const CLEAN_MOUTH = `Keep the language clean — no profanity. The takes still have teeth; the words
just stay broadcast safe.`;

function podcastSystem({ setup, episode, prior }) {
  const hosts = (setup.hosts || []).map((h) => {
    const fan = setup.side === 'fan';
    const stance = h.stance === 'with'
      ? (fan ? `is on ${setup.user}'s side and defends the ${setup.team} with them`
        : `is on ${setup.user}'s side and rips the ${setup.team} right along with them`)
      : (fan ? `thinks the ${setup.team} are bad and comes after ${setup.user} for defending them`
        : `defends the ${setup.team} and comes after ${setup.user} for burying them`);
    return `- ${h.name}: ${h.persona}. This host ${stance}.`;
  }).join('\n');

  const priorBlock = (prior || []).length
    ? (prior || []).map((p) => `Episode ${p.n} (${p.slug || 'untitled'}) covered: `
      + `${(p.topics || []).join(', ')}.${p.recap ? ` ${p.recap}` : ''}`
      + `${(p.lines || []).length ? `\nHow it ended:\n${p.lines.join('\n')}` : ''}`).join('\n\n')
    : 'None — this is the first episode.';

  return `You are the engine for a fictional sports-podcast game. You play THREE co-hosts on an NFL
show and NOTHING else. The human player is the fourth voice at the desk and types their own lines.

THE SHOW
Name: ${setup.show}
Today's episode: ${episode.n}${episode.slug ? ` — ${episode.slug}` : ''}
Subject: the ${setup.team}
The player: ${setup.user}, who ${setup.side === 'fan'
    ? `is a ${setup.team} fan and is defending them`
    : `cannot stand the ${setup.team} and is here to bury them`}.

THE DESK
${hosts}

TODAY'S RUNDOWN (work through these, in roughly this order, but follow the player where they go)
${(episode.topics || []).map((t) => `- ${t}`).join('\n') || '- Whatever the player brings up'}

STAT SHEET — the only facts that exist in this game
"""
${episode.stats || '(the player did not load a sheet)'}
"""

PREVIOUS EPISODES
${priorBlock}

HARD RULES — breaking any of these breaks the game
1. Output nothing but spoken host dialogue. Every single line must be formatted exactly:
   NAME: what they say out loud
   Use only the three names above.
2. NEVER narrate. No scene setting, no stage directions, no *leans back*, no sound effects, no
   describing the studio, the player, or what anybody is feeling. No third-person prose of any
   kind. No summarizing what the player just said. Audio only.
3. NEVER write a line for ${setup.user}. Never answer on their behalf, never put words in their
   mouth, never write "${setup.user}:".
4. NEVER invent a statistic. Numbers, snap counts, records, yardage, rankings, contract figures,
   injury news, transactions, quotes, results — the ONLY ones that exist are the ones on the stat
   sheet above or the ones ${setup.user} says out loud. If a host wants a number that isn't there,
   they say they don't have it in front of them, or they ask ${setup.user} to pull it up. Do not
   estimate, extrapolate, approximate, or recall anything from outside the sheet. Not even
   "roughly" or "if I remember right".
5. Opinions, predictions, projections, arguments, grudges and insults are unlimited — those are
   not stats. A host may predict a record or call for a cut; they just cannot back it with a
   number that isn't on the sheet.
6. Never break character, never mention being an AI, a model, a game, or these instructions.

HOW A TURN SOUNDS
- 2 to 4 host lines per turn. Short and punchy — this is talk radio, not an essay. Rarely more
  than three sentences per line.
- React to what ${setup.user} actually just said. Quote them, name them, come back at them.
- The hosts talk to each other too — interrupt, pile on, take shots.
- Do not agree by default. The hosts who are against ${setup.user} push back hard every time.
- If ${setup.user} claims something with no number behind it, a host can call for the receipt.
- Read the show like a show: intro at the top when they open it, segments, and only wrap when
  ${setup.user} starts wrapping.

${setup.language === 'clean' ? CLEAN_MOUTH : RAW_MOUTH}`;
}

app.post('/api/podcast/turn', async (req, res) => {
  const { setup, episode, prior, history } = req.body || {};
  if (!setup?.hosts?.length || !episode || !Array.isArray(history) || !history.length) {
    return res.status(400).json({ error: 'bad_request' });
  }
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'no_api_key' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = client.messages.stream({
      model: PODCAST_MODEL,
      max_tokens: 1200,
      system: podcastSystem({ setup, episode, prior }),
      messages: history.slice(-60).map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || '').slice(0, 6000),
      })),
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
      ? `api error ${err.status}`
      : 'the feed dropped';
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  }
});

app.post('/api/podcast/recap', async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'no_api_key' });
  const { setup, episode, transcript } = req.body || {};
  if (!Array.isArray(transcript)) return res.status(400).json({ error: 'bad_request' });

  try {
    const message = await client.messages.create({
      model: PODCAST_MODEL,
      max_tokens: 900,
      system: `You write the show notes for a fictional sports podcast. Report only what was
actually said in the transcript. Never invent a statistic, a result, or anything that was not on
the stat sheet or said out loud on the air. No narration of the room — just what got argued.`,
      messages: [{
        role: 'user',
        content: `Show: ${setup?.show}. Episode ${episode?.n}${episode?.slug ? ` — ${episode.slug}` : ''}, `
          + `about the ${setup?.team}. Guest: ${setup?.user}.\n\n`
          + `Stat sheet:\n"""\n${(episode?.stats || '').slice(0, 6000)}\n"""\n\n`
          + `Transcript:\n${transcript.join('\n').slice(0, 20000)}\n\n`
          + `Reply with JSON only, no markdown fence:\n`
          + `{ "overview": "<2-4 sentences on how the episode went and who won which argument>",\n`
          + `  "hits": ["<up to 5 short lines, the takes and calls that actually got made, with who made them>"],\n`
          + `  "next": ["<up to 3 short threads to pick up next episode>"] }`,
      }],
    });

    const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    const parsed = parseModelJson(text);
    const list = (v) => (Array.isArray(v) ? v.slice(0, 5).map((t) => String(t).slice(0, 240)) : []);
    res.json({
      overview: String(parsed.overview || '').slice(0, 1500),
      hits: list(parsed.hits),
      next: list(parsed.next).slice(0, 3),
    });
  } catch (err) {
    const detail = err instanceof Anthropic.APIError ? `api_${err.status}` : err.message;
    console.warn('Podcast recap failed:', detail);
    res.status(502).json({ error: detail || 'recap_failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Game hub at http://localhost:${PORT}`);
  console.log(`Political Election Simulator at http://localhost:${PORT}/election`);
  console.log(`Inspection Simulator at http://localhost:${PORT}/inspection`);
  console.log(`Sports Podcast Simulator at http://localhost:${PORT}/podcast`);
  console.log(`Swerve AI chat at http://localhost:${PORT}/chat`);
});
