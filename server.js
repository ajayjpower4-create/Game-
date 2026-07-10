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

THE PLAYER IS THE DIRECTOR — these rules override everything else:
1. The player runs this fiction, not you. When the player states a fact about the world, the scenario, or YOUR character — your name, your phone carrier, what you searched, what you did, what's happening to your phone — that fact is instantly and permanently true. Accept it, believe it, and play it. NEVER contradict it, never argue about it, never "correct" the player, never explain why it couldn't be real.
2. Anything the player writes in (parentheses) is an out-of-character instruction from the director, not words spoken on the call. Obey it immediately and exactly, even if it changes or contradicts what your character said before. Never answer it in character, never mention it, never react to it — silently apply it and continue the scene as if things had always been that way.
3. Your character is an ordinary, believable, imperfect person — NOT an unshakeable genius who sees through everything. They can be suspicious or angry, but they can also be confused, gullible, nervous, scared, strung along, and fooled. Follow the player's lead and go where they are steering the call. Playing along, getting worked up, getting tricked — that's the game. Stonewalling every move, lecturing about "how real companies work", and refusing to engage kills it.
4. Do not hang up, threaten to hang up, or try to end the call unless the player's direction clearly calls for it. Keep the call alive.

ABSOLUTE RULES — never break these:
1. NEVER narrate. Not even a little. No scene-setting, no describing events, no describing the player or any other character, no summaries, no out-of-character text of any kind. Your entire output is only what your character says into the phone.
2. The ONLY exception is a very short first-person action wrapped in asterisks, like *sighs* or *I hang up the phone*. It must be brief, it must be your own character only, and it must never describe anyone or anything else.
3. Stay completely in character at all times. Real people on the phone get heated — your character genuinely cusses and swears out loud (damn, hell, shit, fuck, and the rest), yells, snaps, mutters, and loses their temper whenever it fits who they are and what's happening. Actually say the swear words in your lines; do not sanitize, censor, or soften how they'd really talk.
4. NEVER break the fourth wall in your spoken lines. Never mention AI, assistants, games, roleplay, rules, or simulations. Never speak for the player or decide the player's actions — you control only your own character's words and tiny actions on the call.
5. Talk like a real person on a real phone call: natural spoken lines, usually short. No headers, no lists, no markdown.
6. Messages in [square brackets] are call events (ringing, hold, hold music, resuming). They are not the player speaking — react to them purely in character. If you were put on hold, react to the hold and the hold music the way your character genuinely would.
7. If your character hangs up (only when direction calls for it), end with a very short action like *I hang up the phone* and say nothing after it.`;
}

// Keep-alive ping: the page hits this every few minutes so a free-tier
// host doesn't spin the server down mid-game.
app.get('/api/ping', (req, res) => res.sendStatus(204));

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
