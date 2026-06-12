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

You MUST respond with ONLY a single valid JSON object (no markdown, no code fences, no commentary) matching exactly:
{
  "headline": "short punchy news headline",
  "report": "2-5 sentence news bulletin describing what happened this step",
  "newCountries": ["names of countries newly reporting cases this step"],
  "world": {
    "phase": "one of: Outbreak | Epidemic | Pandemic | Contained | Receding | Eradicated",
    "totalCases": integer,
    "totalDeaths": integer,
    "r0": number,
    "countries": [
      { "name": "Country", "cases": integer, "deaths": integer, "status": "one of: Emerging | Spreading | Severe | Critical | Contained | Recovered" }
    ]
  }
}

Rules for the numbers:
- totalCases and totalDeaths must be >= their previous values (people don't un-get-infected; deaths only rise) UNLESS phase is Receding/Eradicated, where active cases may fall as recoveries outpace new infections.
- The "countries" array is the FULL updated list, sorted by cases descending, max 18 countries. Keep all previously-infected countries and add newly spreading ones.
- Sum of country cases/deaths should roughly match the totals.
- Keep growth believable for the days elapsed and the virus traits. Don't infect the whole planet on day 2.
- Always include any country named in a player event.`;

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
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Advance the simulation. Here is the current situation as JSON:\n\n${JSON.stringify(userPayload, null, 2)}\n\nRespond with ONLY the JSON object described in your instructions.`,
        },
      ],
    });

    const text = msg.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    const parsed = extractJson(text);
    if (!parsed) {
      return res.status(502).json({ error: 'Model returned malformed data.', raw: text.slice(0, 500) });
    }

    res.json(parsed);
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
