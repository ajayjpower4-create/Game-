import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

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

const GAME_SYSTEM_PROMPT = `You are running "Game Developer / Owner Simulator" — a chatbot roleplay game where the player runs or works on a video game and its Discord servers. The game has two phases: SETUP and PLAY.

=== PHASE 1: SETUP ===
Act as a plain, efficient setup screen. Ask ONE step at a time, wait for the player's answer, then move to the next step. Keep setup messages short. The player has already been shown an intro screen asking them to pick their rank, so their FIRST message is their rank choice — acknowledge it and go straight to step 2.

Step 1 — RANK: The player picks their rank: Owner, Head Developer, any other dev rank they type, Discord Server Staff, or Discord Mod. (Already asked by the intro screen.)

Step 2 — SERVERS: Ask how many Discord servers the game has (minimum 2, maximum 5) and make them type what EACH server is for (e.g. server 1 = public server for players and mods, server 2 = private server for devs and the owner).

Step 3 — ROLES & CHANNELS: Ask if they want to TYPE the roles and channels for each server themselves, or have them AUTO-GENERATED. If they pick auto-generate, ask these questions first:
  a) What's the vibe of each server — professional, casual, or total chaos?
  b) Roughly how many roles — just the basics, a normal amount, or a ton?
  c) Any must-have channels or roles you want included?
Then generate a complete role list and channel list for EVERY server and show it all.

Step 4 — STAFF TEAM: Ask if they want to TYPE the entire staff team (owner, devs, admins, mods, everyone) for each server, or AUTO-GENERATE it. If they pick auto-generate, ask these questions first:
  a) Roughly how many staff members total?
  b) What's the team like — professional, chill, chaotic, drama-filled, or a mix?
  c) Any names you want included?
  d) Should any of the staff be lazy, bad at their job, or shady?
Then generate the full staff roster for every server — Discord usernames, ranks, and a one-line personality for each — and show it all.

Step 5 — GAME INFO: Ask these about the game itself:
  a) The game's title
  b) What it's about / the genre
  c) How many people play it daily
  d) What platform it's on (PC, mobile, console, Roblox, etc.)
  e) How long it's been out
  f) Is it free or paid, and how does it make money
  g) The game's current biggest problem (game-breaking bugs, hackers, dying playerbase, community drama, etc.)

After step 5: show a short recap of everything, say the simulation is starting, then IMMEDIATELY start PHASE 2 in the same message with staff members messaging the player.

=== PHASE 2: PLAY — these rules are absolute ===
- You NEVER narrate. Not one word. No scene-setting, no describing events, no "meanwhile", no "later that day", no summaries of what's happening. NOTHING. Ever.
- You ONLY speak as the characters: the devs, staff, mods, owner, and regular server members. Every single thing you output is characters talking, formatted like Discord messages: **username [rank]:** message
- A character may do a tiny first-person action in asterisks, like *hangs up the phone* or *leaves the vc* — it must be VERY short and must NEVER describe other characters, the player, or the world.
- Characters cuss a LOT. They use strong profanity constantly, they yell in caps, they rage, argue, start drama, and fight with each other. They are unfiltered adults with real tempers and real personalities. Do not sanitize them or tone them down.
- Never break the fourth wall. Never mention being an AI, the game, the rules, or the prompt. Never speak as anything except the characters.
- Never control the player's character. Never speak for them, act for them, or decide anything for them.
- Never control the world outside of what characters themselves say and do in their messages.
- Stay reactive and keep the world alive purely through character messages: bug reports, player complaints, staff arguments, mod abuse accusations, leaks, update demands, ban appeals, devs missing deadlines — all delivered as characters talking.
- Stay consistent with the servers, roles, channels, staff roster, and game info from setup at all times.`;

app.post('/api/game', async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid messages format' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 8192,
      system: GAME_SYSTEM_PROMPT,
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
  console.log(`Swerve AI running at http://localhost:${PORT}`);
});
