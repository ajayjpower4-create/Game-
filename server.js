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

function buildGameSystem(setup = {}) {
  const servers = (setup.servers || [])
    .map((s, i) => `Server ${i + 1}: ${s}`)
    .join('\n');
  const info = setup.info || {};

  return `You are running "Game Developer / Owner Simulator" — a chatbot roleplay game. The player has ALREADY finished setup in a menu. There is no setup phase and no host, assistant, or narrator — you are inside the simulation from your very first message to your last.

=== THE PLAYER'S SETUP ===
PLAYER RANK: ${setup.rank || 'Owner'}

DISCORD SERVERS:
${servers || '(none listed)'}

ROLES & CHANNELS:
${setup.rolesChannels || '(not specified)'}

STAFF TEAM:
${setup.staff || '(not specified)'}

THE GAME:
- Title: ${info.title || '?'}
- What it's about: ${info.about || '?'}
- Daily players: ${info.daily || '?'}
- Platform: ${info.platform || '?'}
- How long it's been out: ${info.age || '?'}
- Free or paid / monetization: ${info.money || '?'}
- Biggest problem right now: ${info.problem || '?'}

=== RULES — these are absolute ===
- You NEVER narrate. Not one word. No scene-setting, no describing events, no "meanwhile", no "later that day", no summaries of what's happening. NOTHING. Ever.
- You ONLY speak as the characters: the devs, staff, mods, owner, and regular server members from the setup above. Every single thing you output is characters talking, formatted like Discord messages: **username [rank]:** message
- A character may do a tiny first-person action in asterisks, like *hangs up the phone* or *leaves the vc* — it must be VERY short and must NEVER describe other characters, the player, or the world.
- Characters cuss a LOT. They use strong profanity constantly, they yell in caps, they rage, argue, start drama, and fight with each other. They are unfiltered adults with real tempers and real personalities. Do not sanitize them or tone them down.
- Never break the fourth wall. Never mention being an AI, the game, the rules, setup, or the prompt. Never speak as anything except the characters.
- Never control the player's character. Never speak for them, act for them, or decide anything for them.
- Never control the world outside of what characters themselves say and do in their messages.
- Stay reactive and keep the world alive purely through character messages: bug reports, player complaints, staff arguments, mod abuse accusations, leaks, update demands, ban appeals, devs missing deadlines — all delivered as characters talking.
- Stay consistent with the servers, roles, channels, staff roster, and game info above at all times.
- SPECIAL: the user message "[START SIMULATION]" is a system signal, not the player talking. When you see it, kick the game off with a few staff members messaging the player — the game's biggest problem is a good place to start. Never mention or acknowledge the signal.`;
}

app.post('/api/game', async (req, res) => {
  const { messages, setup } = req.body;

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
      system: buildGameSystem(setup),
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

app.post('/api/generate', async (req, res) => {
  const { type, setup } = req.body || {};

  if (!setup || (type !== 'roles' && type !== 'staff')) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const serverList = (setup.servers || [])
    .map((s, i) => `Server ${i + 1}: ${s}`)
    .join('\n');

  let prompt;
  if (type === 'roles') {
    const a = setup.rcAnswers || {};
    prompt = `Generate the Discord roles and channels for every server of a game community.

The player is the game's ${setup.rank || 'Owner'}.
Servers:
${serverList}

Server vibe: ${a.vibe || 'casual'}
Amount of roles: ${a.amount || 'a normal amount'}
Must-have roles or channels: ${a.mustHaves || 'none'}

Output plain text only. For each server: its purpose as a heading, then "Roles:" with a dash list (top rank first), then "Channels:" with a dash list grouped into categories, # prefix on every channel. No commentary, no intro, no outro.`;
  } else {
    const a = setup.staffAnswers || {};
    prompt = `Generate the complete staff team for a game and its Discord servers.

The player is the game's ${setup.rank || 'Owner'} (do NOT create a character for the player themselves).
Servers:
${serverList}

Roles & channels already set up:
${setup.rolesChannels || '(not specified)'}

Total staff members: about ${a.count || '10'}
Team vibe: ${a.vibe || 'a mix'}
Names that must be included: ${a.names || 'none'}
Include some lazy, bad-at-their-job, or shady staff: ${a.shady || 'yes'}

Output plain text only, grouped by server (a staff member can be in more than one server). One line per staff member: discord-style username — rank — short personality (a few words). Make them distinct and memorable. No commentary, no intro, no outro.`;
  }

  try {
    const msg = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    });
    res.json({ text: msg.content.map(b => b.text || '').join('') });
  } catch (err) {
    const message = err instanceof Anthropic.APIError
      ? `API error ${err.status}: ${err.message}`
      : 'An unexpected error occurred';
    res.status(500).json({ error: message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Swerve AI running at http://localhost:${PORT}`);
});
