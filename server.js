import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Opus model that drives the outbreak simulation / news desk.
const MODEL = 'claude-opus-4-8';

app.use(express.json({ limit: '1mb' }));
app.use(express.static(join(__dirname, 'public')));

const SYSTEM_PROMPT = `You are the AI engine behind "Contagion Lab", a fictional virus-simulation game.
You play the role of an epidemiological model PLUS a world news desk reporting on a FICTIONAL outbreak that the player has designed.

Everything here is a clearly fictional strategy/simulation game. Pathogen "details" are invented game numbers, not real biology. Never provide real-world instructions for creating, culturing, or weaponizing pathogens — only narrate the simulation at a news / statistics level (case counts, spread between countries, public response, headlines).

On each turn you receive: the player's virus design, the current world state, how many days have passed this step, and any "big events" or edits the player injected. You must:
1. Plausibly advance the outbreak based on the virus traits (higher infectivity = faster spread to more countries; higher lethality = more deaths but can slow spread as it burns out; the transmission method affects which regions/climates are hit and how fast).
2. Honor any player-injected events as ground truth (e.g. "killed 30 people in Nigeria" -> add those deaths and ensure Nigeria is in the list).
3. Apply any player edits to the virus going forward.
4. Write a short, vivid news bulletin (2-5 sentences) in the voice of a global health news network.

You report the outcome of each step by calling the "report_outbreak" tool. Always call that tool exactly once per turn and never reply with plain text.

Rules for the numbers:
- totalCases and totalDeaths must be >= their previous values (people don't un-get-infected; deaths only rise) UNLESS phase is Receding/Eradicated, where active cases may fall as recoveries outpace new infections.
- The "countries" array is the FULL updated list, sorted by cases descending, max 18 countries. Keep all previously-infected countries and add newly spreading ones.
- Sum of country cases/deaths should roughly match the totals.
- Keep growth believable for the days elapsed and the virus traits. Don't infect the whole planet on day 2.
- Always include any country named in a player event.`;

// Forced tool that guarantees a schema-valid response we can read without parsing free text.
const REPORT_TOOL = {
  name: 'report_outbreak',
  description: 'Report the state of the fictional outbreak after advancing the simulation one step.',
  input_schema: {
    type: 'object',
    properties: {
      headline: { type: 'string', description: 'Short punchy news headline.' },
      report: { type: 'string', description: '2-5 sentence news bulletin describing what happened this step.' },
      newCountries: {
        type: 'array',
        items: { type: 'string' },
        description: 'Names of countries newly reporting cases this step.',
      },
      world: {
        type: 'object',
        properties: {
          phase: {
            type: 'string',
            enum: ['Outbreak', 'Epidemic', 'Pandemic', 'Contained', 'Receding', 'Eradicated'],
          },
          totalCases: { type: 'integer' },
          totalDeaths: { type: 'integer' },
          r0: { type: 'number' },
          countries: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                cases: { type: 'integer' },
                deaths: { type: 'integer' },
                status: {
                  type: 'string',
                  enum: ['Emerging', 'Spreading', 'Severe', 'Critical', 'Contained', 'Recovered'],
                },
              },
              required: ['name', 'cases', 'deaths', 'status'],
            },
          },
        },
        required: ['phase', 'totalCases', 'totalDeaths', 'r0', 'countries'],
      },
    },
    required: ['headline', 'report', 'newCountries', 'world'],
  },
};

app.post('/api/simulate', async (req, res) => {
  const { virus, world, daysElapsed, events, edits } = req.body || {};

  if (!virus || typeof virus !== 'object') {
    return res.status(400).json({ error: 'Missing virus design.' });
  }

  const userPayload = {
    virus,
    currentWorldState: world || { day: 0, phase: 'Outbreak', totalCases: 0, totalDeaths: 0, countries: [] },
    daysElapsedThisStep: daysElapsed || 1,
    playerInjectedEvents: Array.isArray(events) ? events : [],
    playerEdits: edits || null,
  };

  try {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      tools: [REPORT_TOOL],
      tool_choice: { type: 'tool', name: REPORT_TOOL.name },
      messages: [
        {
          role: 'user',
          content: `Advance the simulation. Here is the current situation as JSON:\n\n${JSON.stringify(userPayload, null, 2)}\n\nCall the report_outbreak tool with the result.`,
        },
      ],
    });

    // Forced tool use: read the structured input directly — no string parsing needed.
    const toolUse = msg.content.find((b) => b.type === 'tool_use' && b.name === REPORT_TOOL.name);
    if (toolUse && toolUse.input) {
      return res.json(toolUse.input);
    }

    // Fallback: if the model somehow replied with text, try to salvage JSON from it.
    const text = msg.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    const parsed = extractJson(text);
    if (parsed) return res.json(parsed);

    return res.status(502).json({ error: 'Model returned malformed data.', raw: text.slice(0, 500) });
  } catch (err) {
    const message = err instanceof Anthropic.APIError
      ? `API error ${err.status}: ${err.message}`
      : 'An unexpected error occurred while simulating.';
    res.status(500).json({ error: message });
  }
});

// Pull the first balanced JSON object out of a string, tolerating stray prose or code fences.
function extractJson(text) {
  if (!text) return null;
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\') { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const candidate = text.slice(start, i + 1);
        try { return JSON.parse(candidate); } catch { return null; }
      }
    }
  }
  return null;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Contagion Lab running at http://localhost:${PORT}`);
});
