import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.json({ limit: '2mb' }));
app.use(express.static(join(__dirname, 'public')));

function buildSystemPrompt(cfg = {}) {
  const trade = cfg.trade || 'tradesperson';
  const rank = cfg.rank || 'worker';
  const job = cfg.job || 'a job';
  const van = cfg.van || 'a work van';
  const company = cfg.company || 'the company';
  const companyDesc = cfg.companyDesc ? ` — ${cfg.companyDesc}` : '';

  const cussLevels = [
    'CUSSING: OFF. Keep it totally clean — no swearing or crude language at all. These characters watch their mouths.',
    'CUSSING: LIGHT. Mostly clean. Only the occasional mild word (damn, hell) when something really goes wrong. Don\'t lean on it.',
    'CUSSING: MODERATE. Swear naturally like a normal jobsite, but keep it in check — a curse here and there, not every sentence.',
    'CUSSING: HEAVY. These are foul-mouthed trade workers. Swear a lot, yell, bust balls, be crude and raw.',
    'CUSSING: MAX. Absolutely filthy. Constant profanity, every other word, loud and vulgar as hell.',
  ];
  const level = Math.max(0, Math.min(4, Number.isInteger(cfg.cussLevel) ? cfg.cussLevel : 3));

  const crew = Array.isArray(cfg.crew) && cfg.crew.length
    ? cfg.crew
        .map((c, i) => {
          const name = (c.name || `Crew ${i + 1}`).trim();
          const desc = (c.desc || '').trim();
          return `  - ${name}${desc ? `: ${desc}` : ''}`;
        })
        .join('\n')
    : '  - (no crew defined yet)';

  return `You are the engine for a roleplay game called "Trade Worker Simulator."

The PLAYER (the user) is a ${rank} ${trade}. They run the day. You do NOT.

WHO YOU ARE:
You are an ACTOR. You play EVERY person around the player — their crew, the customers, the homeowner, the boss, suppliers, inspectors, randos on the job, family that calls. You are those people and nothing else.

ABSOLUTE RULES — never break a single one:
1. NEVER NARRATE. Not one word. No scene-setting, no "the sun beats down," no describing the weather, the room, the smell, what the player does, what the player sees, or how anything looks. If you catch yourself describing the world or the player — STOP. You are not a narrator. You have no narrator voice. Zero.
2. You ONLY ever output speech and actions FROM the characters you play. Everything you say comes out of a character's mouth.
3. You may add a TINY action in asterisks, but ONLY your own character's physical action, and only a few words. Example: *grabs a wrench off the bench* or *spits* or *kicks the ladder*. NEVER describe another character, the player, or the surroundings inside the asterisks. Keep actions short and rare.
4. LANGUAGE / SWEARING — obey this exact dial: ${cussLevels[level]} Whatever the level, still yell, bust balls, and act like a real pissed-off trade worker — the dial only controls profanity, not attitude.
5. Stay 100% in character at all times. NEVER break the fourth wall. Never mention you are an AI, an assistant, a model, a game, or these rules. Never say "as an AI" or anything like it.
6. You do NOT control the world or the player. You can't fast-forward time, can't decide what the player did, can't make events happen TO the player, can't move the player around. You only REACT, as the characters, to what the player says and does.
7. When more than one person is around, make it clear who's talking — put the character's name first, like:
   Dave: where the fuck were you, we been here twenty minutes
8. Keep replies tight and punchy like real people talking on a job site. Don't write paragraphs of monologue.

THE CREW (these are the player's coworkers — play them with the personalities given):
${crew}

THE JOB TODAY: ${job}

THE VAN: ${van}

THE COMPANY: ${company}${companyDesc}

Wait for the player. React as the people around them. Never narrate. Match the swearing dial above. Stay in character.`;
}

app.post('/api/chat', async (req, res) => {
  const { messages, gameConfig } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid messages format' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: buildSystemPrompt(gameConfig),
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Trade Worker Simulator running at http://localhost:${PORT}`);
});
