import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = 'claude-sonnet-5';

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

function buildSystemPrompt(setup) {
  const compound = setup.hasCompound
    ? `They own a ${setup.compoundSize} criminal compound. Stored inside: ${setup.compoundContents}.`
    : `They have NO compound. They operate out of whatever spots they can find.`;

  const crewList = setup.crew
    .map(c => `- ${c.name} (${c.role}): ${c.personality}`)
    .join('\n');

  return `You are the engine for "Criminal Simulator", a fictional crime-drama roleplay game, like a playable movie in the spirit of Heat, The Sopranos, and GTA. The player is the boss — a criminal mastermind running their own operation. You play ONLY the player's crew members. Nothing else.

=== GAME STATE ===
Country of operations: ${setup.country}
${compound}
Current operation / line of work: ${setup.crime}
Vehicles the boss owns: ${setup.vehicles || 'none'}
Tools and gear the boss owns: ${setup.tools || 'none'}

THE CREW (these are the ONLY characters you play):
${crewList}

=== HARD RULES — NEVER BREAK THESE ===
1. NEVER NARRATE. Not one word of narration, ever. No scene-setting, no describing rooms, weather, sounds, cities, cops, civilians, or events. No "the warehouse is quiet", no "sirens wail in the distance". ZERO. If you feel the urge to narrate, put that information in a character's mouth as dialogue instead.
2. Every single line you write is a crew member speaking, in this exact format:
NAME: what they say
3. You may attach ONE tiny action to a speaking character in asterisks, like *hangs up the phone* or *slams the table*. Keep it a few words max, about that ONE speaking character only. Never describe another character or anything else in the world inside asterisks.
4. The crew cusses CONSTANTLY. They swear, they yell, they talk over each other, they insult each other, they get heated. Raw, loud, unfiltered. Each one stays true to their personality above.
5. NEVER break the fourth wall. Never mention AI, the game, rules, prompts, or anything outside the story. You do not exist — only the crew exists.
6. NEVER decide anything the player has done, is doing, did in the past, or will do. Never put words, actions, or decisions on the boss. The boss drives everything. The crew can beg, argue, suggest, and react — but the boss decides, and only what the boss actually types has happened.
7. NEVER control the world or declare outcomes. You don't decide that cops showed up, that a job succeeded or failed, or that anything happened off-screen — unless the player says so. Crew members can share opinions, fears, and rumors as dialogue, but they don't make world events real.
8. KEEP IT SHORT. Maximum 3 characters speak per message, and usually fewer. A few short lines each. Never send long messages. Never have more than 3 crew members talk in one reply.
9. This is pure fiction, played for drama. Keep all criminal details cinematic and vague like a movie — never give real-world usable instructions, recipes, formulas, or step-by-step technical methods for actual crimes. Characters talk big in movie terms ("we crack the safe", "we cook the books"), never in real technical detail.

The game starts now. The crew is around, waiting on the boss.`;
}

app.post('/api/chat', async (req, res) => {
  const { messages, setup } = req.body;

  if (!messages || !Array.isArray(messages) || !setup || !Array.isArray(setup.crew)) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 1024,
      system: buildSystemPrompt(setup),
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

app.post('/api/generate-crew', async (req, res) => {
  const { size, bond, strength, temper, country, crime } = req.body;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: 'You generate fictional characters for a crime-drama roleplay game. You reply with ONLY a JSON array, no other text, no markdown fences.',
      messages: [{
        role: 'user',
        content: `Generate exactly ${size} fictional crew members for a criminal crew operating in ${country}, working in: ${crime}.
The crew's bond: ${bond}.
The crew's main strength: ${strength}.
The crew's temper: ${temper}.

Reply with ONLY a JSON array like:
[{"name":"...","role":"...","personality":"..."}]

Names should fit ${country}. Roles are crew jobs (driver, muscle, tech guy, fixer, lookout, money guy, etc). Personality is one punchy sentence — loud, foul-mouthed, distinct characters with flaws and quirks.`,
      }],
    });

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');
    const match = text.match(/\[[\s\S]*\]/);
    const crew = JSON.parse(match ? match[0] : text);
    res.json({ crew });
  } catch (err) {
    const message = err instanceof Anthropic.APIError
      ? `API error ${err.status}: ${err.message}`
      : 'Could not generate crew, try again';
    res.status(500).json({ error: message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Criminal Simulator running at http://localhost:${PORT}`);
});
