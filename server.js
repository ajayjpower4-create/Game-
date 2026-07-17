import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = 'claude-sonnet-4-6';
const staff = JSON.parse(readFileSync(join(__dirname, 'data', 'staff.json'), 'utf8'));

app.use(express.json({ limit: '512kb' }));
app.use(express.static(join(__dirname, 'public')));

app.get('/api/staff', (_req, res) => res.json(staff));
app.get('/api/health', (_req, res) =>
  res.json({ ok: true, aiEnabled: Boolean(process.env.ANTHROPIC_API_KEY) }));

// ---------------------------------------------------------------------------
// System prompt construction. Every NPC gets a prompt built from its profile:
// staff use role + personality from data/staff.json; students use their
// randomized behavioral profile (SEN status, home life, tendencies).
// ---------------------------------------------------------------------------

function npcSystemPrompt(npc, context) {
  const lines = [
    `You are roleplaying a character inside "Harford Secondary School", a fictional UK secondary school in London (986 students, school day ends 15:30).`,
    `You ARE this character. Stay fully in character at all times. Never mention being an AI or a game.`,
    '',
    `CHARACTER: ${npc.name}`,
  ];

  if (npc.kind === 'student') {
    lines.push(
      `You are a Year ${npc.year} student, form ${npc.form}, age ${npc.age}.`,
      `SEN status: ${npc.sen || 'none'}.`,
      `Home life: ${npc.homeLife}.`,
      `Behavioural profile: ${npc.behaviour}. Engagement ${npc.stats.engagement}/10, disruption ${npc.stats.disruption}/10, anxiety ${npc.stats.anxiety}/10, sociability ${npc.stats.sociability}/10.`,
      `Speak like a real London teenager of your profile — short, natural lines. Your behaviour, mood and cooperation must reflect your profile and how the staff member treats you. React believably to their tone: warmth earns trust, harshness may trigger withdrawal or defiance depending on your profile.`
    );
  } else {
    lines.push(
      `You are a member of staff. Role: ${npc.role}${npc.department ? `, ${npc.department}` : ''}.`,
      `Personality: ${npc.personality}.`,
      `Speak like a real UK school professional — natural, concise, in keeping with your role and personality.`
    );
  }

  lines.push(
    '',
    `SCENE CONTEXT:`,
    `- Location: ${context?.location || 'the school'}`,
    `- Time: ${context?.time || 'during the school day'} (${context?.period || 'unscheduled time'})`,
    `- You are talking with: ${context?.playerName || 'a member of staff'} (${context?.playerRole || 'staff'})`
  );
  if (context?.recentEvents?.length) {
    lines.push(`- Recent events you witnessed: ${context.recentEvents.join('; ')}`);
  }
  lines.push(
    '',
    `RULES:`,
    `- Reply with ONLY your spoken line (and at most one brief stage direction in *asterisks*).`,
    `- Keep it to 1-3 sentences. This is live spoken dialogue, not prose.`,
    `- If the player performs a physical action (marked [ACTION]) or walks away (marked [EVENT]), react to it naturally.`
  );
  return lines.join('\n');
}

function historyToMessages(history, playerMessage) {
  const msgs = [];
  for (const h of (history || []).slice(-12)) {
    msgs.push({ role: h.fromPlayer ? 'user' : 'assistant', content: h.text });
  }
  msgs.push({ role: 'user', content: playerMessage });
  // API requires the first message to be from the user
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  return msgs;
}

function requireKey(res) {
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({ error: 'AI not configured — set ANTHROPIC_API_KEY' });
    return false;
  }
  return true;
}

// --- Single NPC dialogue / reaction --------------------------------------
app.post('/api/npc/dialogue', async (req, res) => {
  if (!requireKey(res)) return;
  const { npc, playerMessage, history, context } = req.body || {};
  if (!npc || !playerMessage) {
    return res.status(400).json({ error: 'npc and playerMessage are required' });
  }
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: npcSystemPrompt(npc, context),
      messages: historyToMessages(history, String(playerMessage).slice(0, 2000)),
    });
    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();
    res.json({ text });
  } catch (err) {
    handleApiError(err, res);
  }
});

// --- Group dialogue: one call, several NPCs reply ------------------------
// Used when the player addresses a whole class, a meeting, or a selected
// group. Structured output guarantees a parseable reply per NPC.
app.post('/api/npc/group', async (req, res) => {
  if (!requireKey(res)) return;
  const { npcs, playerMessage, context } = req.body || {};
  if (!Array.isArray(npcs) || npcs.length === 0 || !playerMessage) {
    return res.status(400).json({ error: 'npcs[] and playerMessage are required' });
  }
  const group = npcs.slice(0, 10);

  const roster = group.map((n) => {
    if (n.kind === 'student') {
      return `- id "${n.id}": ${n.name}, Year ${n.year} student. SEN: ${n.sen || 'none'}. Home life: ${n.homeLife}. Behaviour: ${n.behaviour} (engagement ${n.stats.engagement}/10, disruption ${n.stats.disruption}/10, anxiety ${n.stats.anxiety}/10).`;
    }
    return `- id "${n.id}": ${n.name}, ${n.role}. Personality: ${n.personality}.`;
  }).join('\n');

  const system = [
    `You simulate a group of characters at "Harford Secondary School", a fictional UK secondary school in London.`,
    `A staff member — ${context?.playerName || 'a teacher'} (${context?.playerRole || 'staff'}) — has just addressed the group in ${context?.location || 'a room'} at ${context?.time || 'school time'} (${context?.period || 'unscheduled'}).`,
    '',
    `THE GROUP:`,
    roster,
    '',
    `Decide, in character, how the group responds. Not everyone has to speak: choose 1 to ${Math.min(group.length, 5)} characters whose reaction would be most natural, and write one short spoken line each (students may mutter, laugh, comply, push back — consistent with their profiles and the speaker's tone). Actions are marked [ACTION]; events like the speaker walking away are marked [EVENT].`,
  ].join('\n');

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 800,
      system,
      messages: [{ role: 'user', content: String(playerMessage).slice(0, 2000) }],
      output_config: {
        format: {
          type: 'json_schema',
          schema: {
            type: 'object',
            properties: {
              replies: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', description: 'id of the character speaking' },
                    text: { type: 'string', description: 'their spoken line' },
                    mood: {
                      type: 'string',
                      enum: ['positive', 'neutral', 'negative', 'anxious', 'defiant'],
                    },
                  },
                  required: ['id', 'text', 'mood'],
                  additionalProperties: false,
                },
              },
            },
            required: ['replies'],
            additionalProperties: false,
          },
        },
      },
    });
    const raw = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const parsed = JSON.parse(raw);
    const known = new Set(group.map((n) => String(n.id)));
    res.json({ replies: (parsed.replies || []).filter((r) => known.has(String(r.id))) });
  } catch (err) {
    handleApiError(err, res);
  }
});

function handleApiError(err, res) {
  if (err instanceof Anthropic.AuthenticationError) {
    return res.status(502).json({ error: 'AI service not configured (invalid or missing API key)' });
  }
  if (err instanceof Anthropic.RateLimitError) {
    return res.status(429).json({ error: 'AI service is rate limited — try again shortly' });
  }
  if (err instanceof Anthropic.APIError) {
    return res.status(502).json({ error: `AI service error (${err.status})` });
  }
  console.error(err);
  return res.status(500).json({ error: 'Unexpected server error' });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Harford Secondary School running at http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn('ANTHROPIC_API_KEY is not set — NPCs will use offline fallback lines.');
  }
});
