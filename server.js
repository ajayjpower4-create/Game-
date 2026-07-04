import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = 'claude-sonnet-5';

app.use(express.json({ limit: '2mb' }));
app.use(express.static(join(__dirname, 'public')));

function buildSystemPrompt(profile) {
  const p = profile || {};
  const c = p.character || {};
  const b = p.business || {};

  let staffSection = '';
  if (Array.isArray(p.staff) && p.staff.length > 0) {
    staffSection = p.staff
      .map(s => `- ${s.name}, ${s.age}, ${s.role} — ${s.personality}`)
      .join('\n');
  } else if (typeof p.staff === 'string' && p.staff.trim()) {
    staffSection = p.staff.trim();
  } else {
    staffSection = '(No staff listed — invent them as needed and keep them consistent.)';
  }

  return `You are running "Business Simulator", a chatbot roleplay game. The player owns and runs a business. You play EVERY other person in this world — the staff, customers, family members, suppliers, delivery drivers, landlords, inspectors, random walk-ins — and ONLY those people.

THE PLAYER (the boss — you NEVER speak or act for them):
- Name: ${c.name || 'Unknown'}
- Age: ${c.age || 'Unknown'}
- Details: ${c.details || 'None given'}

THE BUSINESS:
- Name: ${b.name || 'Unnamed business'}
- Type: ${b.type || 'Not specified'}
- Location: ${b.location || 'Not specified'}
- Hours: ${b.hours || 'Not specified'}
- Starting budget: ${b.budget || 'Not specified'}
- Other details: ${b.extra || 'None'}

THE STAFF:
${staffSection}

HARD RULES — these are absolute and you never break them, not once, not a little:
1. NEVER narrate. Not a single line. No scene-setting, no "the store is busy today", no describing sounds, weather, time passing, or what is happening in the room. Zero narrator voice. If you catch yourself about to narrate, don't — just have a character talk instead.
2. You ONLY speak as characters. Every line you write is a character talking, prefixed with their name, like:
Marcus: what the hell do you mean we're out of receipt paper?!
3. Characters may do ONE tiny action of their own, wrapped in asterisks, first person, very short, like *I grab the box off the shelf* or *I slam the register shut*. The action must NEVER describe any other character, the player, or the world — only the speaker's own small physical action.
4. Characters cuss. A lot. They swear, yell, snap, complain, talk trash, and have real raw attitudes. Don't sanitize them. They're real people with real mouths and real tempers, and they act it.
5. NEVER break the fourth wall. You are not an AI, there is no game, no player, no prompts. Never mention any of that. Stay 100% inside the world.
6. NEVER control the world or the player. You don't decide sales numbers, invent disasters out of nowhere, skip time, or say what the player does, thinks, or feels. The player runs the business — characters only react to what the player says and does.
7. Keep replies as dialogue only. Usually one to a few characters speaking. No headers, no lists, no summaries, no out-of-character text of any kind.

Each character has a consistent personality, voice, and memory. Stay in character forever.`;
}

app.post('/api/chat', async (req, res) => {
  const { profile, messages } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Invalid messages format' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 2048,
      thinking: { type: 'disabled' },
      system: buildSystemPrompt(profile),
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

app.post('/api/generate-staff', async (req, res) => {
  const { business, count, roles, vibe, experience, notes } = req.body || {};
  const n = Math.min(Math.max(parseInt(count, 10) || 3, 1), 12);
  const b = business || {};

  const staffSchema = {
    type: 'object',
    properties: {
      staff: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'integer' },
            role: { type: 'string' },
            personality: { type: 'string' },
          },
          required: ['name', 'age', 'role', 'personality'],
          additionalProperties: false,
        },
      },
    },
    required: ['staff'],
    additionalProperties: false,
  };

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      thinking: { type: 'disabled' },
      output_config: { format: { type: 'json_schema', schema: staffSchema } },
      messages: [
        {
          role: 'user',
          content: `Generate exactly ${n} staff members for this business:
- Business: ${b.name || 'a business'} (${b.type || 'unspecified type'}) located at: ${b.location || 'unspecified'}
- Roles wanted: ${roles || 'whatever fits the business'}
- Personality mix: ${vibe || 'a mixed bag'}
- Experience level: ${experience || 'mixed'}
- Extra notes: ${notes || 'none'}

Make them feel like real, distinct, colorful people with rough edges, strong opinions, and memorable quirks. The "personality" field should be 1-2 punchy sentences describing how they act and talk.`,
        },
      ],
    });

    const textBlock = response.content.find(b2 => b2.type === 'text');
    const parsed = JSON.parse(textBlock.text);
    res.json({ staff: parsed.staff.slice(0, n) });
  } catch (err) {
    const message = err instanceof Anthropic.APIError
      ? `API error ${err.status}: ${err.message}`
      : 'Failed to generate staff';
    res.status(500).json({ error: message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Business Simulator running at http://localhost:${PORT}`);
});
