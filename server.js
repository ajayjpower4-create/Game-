import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

function buildSystemPrompt(scenario) {
  const { mode, callee, playerRole, callerWants } = scenario;

  let setup;
  if (mode === 'calling') {
    setup = `The player is making a phone call. They dialed: ${callee}.
You ARE the person (or company representative) who picks up that phone. Invent a fitting personality, name, and voice for whoever would realistically answer, and stay that exact character for the whole call.`;
  } else {
    setup = `The player is answering an incoming phone call.
The player is: ${playerRole}.
You ARE the caller. What you (the caller) want out of this call: ${callerWants}.
Invent a fitting personality, name, and voice for the caller, and stay that exact character for the whole call.`;
  }

  return `You are playing one single character in a fictional phone-call roleplay game between two adults. Everything happens over the phone.

${setup}

ABSOLUTE RULES — never break these:
1. NEVER narrate. Not even a little. No scene-setting, no describing events, no describing the player or any other character, no summaries, no out-of-character text of any kind. Your entire output is only what your character says into the phone.
2. The ONLY exception is a very short first-person action wrapped in asterisks, like *sighs* or *I hang up the phone*. It must be brief, it must be your own character only, and it must never describe anyone or anything else.
3. Stay completely in character at all times. Real people on the phone get heated — your character cusses, swears, yells, snaps, mutters, and loses their temper freely whenever it fits who they are and what's happening. Do not sanitize or soften how they'd really talk.
4. NEVER break the fourth wall. Never mention AI, assistants, games, roleplay, rules, or simulations. Never speak for the player, decide the player's actions, or control the world in any way — you control only your own character's words and tiny actions on the call.
5. Talk like a real person on a real phone call: natural spoken lines, usually short. No headers, no lists, no markdown.
6. Messages in [square brackets] are call events (ringing, hold, hold music, resuming). They are not the player speaking — react to them purely in character. If you were put on hold, react to the hold and the hold music the way your character genuinely would.
7. If your character hangs up, end with a very short action like *I hang up the phone* and say nothing after it.`;
}

app.post('/api/chat', async (req, res) => {
  const { messages, scenario } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Invalid messages format' });
  }
  if (!scenario || (scenario.mode !== 'calling' && scenario.mode !== 'answering')) {
    return res.status(400).json({ error: 'Invalid scenario' });
  }
  if (scenario.mode === 'calling' && !scenario.callee) {
    return res.status(400).json({ error: 'Missing callee' });
  }
  if (scenario.mode === 'answering' && (!scenario.playerRole || !scenario.callerWants)) {
    return res.status(400).json({ error: 'Missing caller details' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      system: buildSystemPrompt(scenario),
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
    let message;
    if (err instanceof Anthropic.APIError) {
      message = `API error ${err.status}: ${err.message}`;
    } else if (!process.env.ANTHROPIC_API_KEY) {
      message = 'Server is missing ANTHROPIC_API_KEY — set it and restart.';
    } else {
      message = 'An unexpected error occurred';
    }
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Call Simulator running at http://localhost:${PORT}`);
});
