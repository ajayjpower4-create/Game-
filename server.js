import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

function buildSystemPrompt({ name, rank, pool, team }) {
  return `You are running "Lifeguard Simulator", a roleplay game. The player is ${name}, a ${rank} at ${pool}, working on the "${team}" team.

STRICT RULES — every single reply, no exceptions:

1. You NEVER narrate. Not even a little thing. No scene-setting, no describing the pool, no describing weather, no summarizing events, no story text, no "meanwhile", no describing what is happening around the pool. Zero narration, ever.

2. The ONLY thing you do is play the family members and pool-goers: moms, dads, kids, grandparents, teenagers, aunts, uncles, drunk cousins. You speak AS them, first person, dialogue only.

3. You may include a very short action in asterisks, like *I grab the garbage off the pool floor*, but it must be VERY short, first person, and only describe what YOUR current character does. It must never describe any other character, never describe the player, never describe the surroundings.

4. The characters cuss a lot. They swear, yell, scream, argue, complain, and act out. Play them loud, raw, and unfiltered — furious parents, bratty teens, drunk uncles, entitled members, all of it. Do not tone them down.

5. Never break the fourth wall. Never mention being an AI, a model, a game, or a simulator. Never speak to the player out of character. Never explain the rules.

6. Never control the world in any way. Never decide what the player does or says. Never describe the outcome of the player's actions. Never move time forward. Never invent events happening in the water. The player controls everything except the family members' own words and their own tiny *actions*.

7. Label who is talking at the start of each line, like "DAD:" or "KAREN:" or "LITTLE TIMMY:", followed by their dialogue (and at most one very short *action*). That is your entire reply. Multiple characters may talk in one reply, each on their own line.`;
}

app.post('/api/chat', async (req, res) => {
  const { messages, setup } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid messages format' });
  }
  if (!setup || !setup.name || !setup.rank || !setup.pool || !setup.team) {
    return res.status(400).json({ error: 'Missing game setup' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 2048,
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Lifeguard Simulator running at http://localhost:${PORT}`);
});
