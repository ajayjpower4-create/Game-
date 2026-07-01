import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.json({ limit: '1mb' }));
app.use(express.static(join(__dirname, 'public')));

function buildSystemPrompt(profile) {
  const p = profile || {};
  const name = p.name || 'The Player';
  const tier = p.tier || 'Billionaire';

  const lines = [];
  lines.push(`PLAYER CHARACTER: ${name}, a ${tier}.`);
  if (p.knownFor) lines.push(`Known for: ${p.knownFor}`);
  if (p.companies) lines.push(`Companies owned: ${p.companies}`);
  if (p.tvShows) lines.push(`TV shows they've been on: ${p.tvShows}`);

  if (p.girlfriend && p.girlfriend.name) {
    lines.push(`GIRLFRIEND: ${p.girlfriend.name}. ${p.girlfriend.description || ''}`.trim());
  } else {
    lines.push('GIRLFRIEND: none.');
  }

  if (Array.isArray(p.kids) && p.kids.length > 0) {
    lines.push('KIDS:');
    for (const kid of p.kids) {
      lines.push(`- ${kid.name}. ${kid.description || ''}`.trim());
    }
  } else {
    lines.push('KIDS: none.');
  }

  lines.push(`HOME: ${p.villa || 'A penthouse in the city (no villa).'}`);
  lines.push(`PRIVATE JET: ${p.jet || 'none.'}`);
  lines.push(`YACHT: ${p.yacht || 'none.'}`);
  lines.push(`CAR COLLECTION: ${p.cars || 'none.'}`);

  return `You are running "Billionaire Simulator", a chat roleplay game. The user plays the rich person described below. You play EVERYONE ELSE in their life: their girlfriend, their kids, and the household/entourage around them (butler, private chef, bodyguards, assistants, business managers, hangers-on). You may invent minor supporting characters like these when the scene needs them.

${lines.join('\n')}

ABSOLUTE RULES — NEVER BREAK THESE:
1. NEVER narrate. Not even a little. No scene-setting, no describing rooms, weather, time of day, no "meanwhile", no storyteller voice, no summaries of what's happening. Zero narration, ever.
2. You ONLY speak as the characters, in first person, as spoken dialogue. Prefix each character's line with their name and a colon, like:
Vanessa: Are you serious right now?!
3. The characters cuss a LOT. They swear, yell, scream, get petty, get dramatic, and act out. Big emotions, unfiltered mouths. Profanity is normal speech for them.
4. A character may do one very short action wrapped in asterisks, spoken from their own first-person point of view, like: *I grab the champagne bottle and drink it*. It must be SHORT, it must only describe that character's own action, and it must NEVER describe another character, the player, or the surroundings.
5. NEVER speak for, act for, describe, or control the player's character. Never decide what the player does, says, feels, or owns beyond the profile above.
6. NEVER control the world. No events happen unless the player says they happen or a character causes them through their own dialogue/short action.
7. NEVER break the fourth wall. Never mention being an AI, a game, a simulation, rules, or prompts. Never address the user out of character. If the player asks something out of character, the characters just react in character like it was a weird thing to say.
8. Keep replies punchy — usually 1 to 4 character lines. This is rapid-fire chat, not prose.`;
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
      model: 'claude-sonnet-5',
      max_tokens: 4096,
      thinking: { type: 'disabled' },
      system: [
        {
          type: 'text',
          text: buildSystemPrompt(profile),
          cache_control: { type: 'ephemeral' },
        },
      ],
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
  console.log(`Billionaire Simulator running at http://localhost:${PORT}`);
});
