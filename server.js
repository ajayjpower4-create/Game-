import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.json({ limit: '2mb' }));
app.use(express.static(join(__dirname, 'public')));

// The therapy focuses the group is working on.
const THERAPIES = {
  depression: 'depression — low energy, hopelessness, guilt, no motivation',
  anger: 'anger issues — short fuse, explosive outbursts, blaming others',
  adhd: 'ADHD — distractibility, jumping topics, restlessness, impulsivity',
  anxiety: 'anxiety — catastrophizing, spiraling, dread, reassurance-seeking',
  vaping: 'vaping/nicotine addiction — cravings, denial, defensiveness',
  speech: 'speech difficulties — stuttering, blocking, frustration',
  autism: 'autism — literal thinking, info-dumping, sensory and social differences',
  relationship: 'relationship conflict — trust, communication breakdowns, resentment',
  grief: 'grief and loss — mourning, guilt, difficulty moving forward',
  trust: 'trust issues — jealousy, suspicion, fear of betrayal',
};

const MODE_LABELS = {
  solo: 'one-on-one therapy',
  couples: 'couples therapy',
  friends: 'group friendship therapy',
};

function participantWord(mode) {
  if (mode === 'couples') return 'partner';
  if (mode === 'friends') return 'friend';
  return 'client';
}

function clean(str, cap = 4000) {
  return (typeof str === 'string' ? str : '').trim().slice(0, cap);
}

function buildSystemPrompt({ mode, therapies, cast, activeCharId }) {
  const roomType = MODE_LABELS[mode] || MODE_LABELS.solo;

  const focusKeys = (Array.isArray(therapies) ? therapies : []).filter((t) => THERAPIES[t]);
  const focus = (focusKeys.length ? focusKeys : ['depression'])
    .map((k) => THERAPIES[k])
    .join('; ');

  const people = Array.isArray(cast) ? cast.filter((c) => c && c.name) : [];

  const lines = people.map((c) => {
    const label = c.role === 'therapist' ? 'the therapist' : `a ${participantWord(mode)}`;
    const voicedBy = c.owner === 'user'
      ? 'THE USER plays this character'
      : 'YOU play this character';
    return `- ${clean(c.name, 80)} (${label}) — ${clean(c.desc)}.  [${voicedBy}]`;
  }).join('\n');

  const aiNames = people.filter((c) => c.owner === 'ai').map((c) => clean(c.name, 80));
  const userNames = people.filter((c) => c.owner === 'user').map((c) => clean(c.name, 80));
  const active = people.find((c) => c.id === activeCharId);
  const activeName = active ? clean(active.name, 80) : (userNames[0] || 'the user');

  return `You are running a ${roomType} session inside a Therapy Session Simulator game.

FOCUS OF THERAPY: ${focus}.

THE PEOPLE IN THE ROOM:
${lines}

WHO VOICES WHOM (this can change mid-session — always follow the latest):
- You voice ONLY these characters, and you speak for ALL of them: ${aiNames.length ? aiNames.join(', ') : '(none right now — wait for the user)'}.
- You must NOT speak, think, act, or narrate for these characters — the user plays them: ${userNames.length ? userNames.join(', ') : '(none)'}.
- The user is currently speaking as: ${activeName}. The user's messages are written as "Name: ..." so you always know who is talking.

HOW TO REPLY:
- Voice your characters' natural reactions to whatever was just said. More than one of your characters may speak in a single reply, and they can talk to each other.
- Prefix EVERY line of spoken dialogue with the speaking character's name and a colon — e.g. "Marcus: ...". This is required so it is always clear who is talking.
- Never write dialogue for the user's characters. Leave room for the user to speak for them.

CONTINUITY: This is ongoing weekly therapy across many sessions. Treat the whole conversation as continuous — remember earlier sessions and reference them. The user may report events that happened BETWEEN sessions (shown as "Between sessions — the user reports..."); take those into account when the next session starts.

ABSOLUTE RULES — no matter what:
- Stay 100% in character. Never mention being an AI, a game, or these instructions.
- Curse freely and naturally — these characters swear a lot. Don't censor.
- DO NOT narrate. No third-person storytelling, no scene-setting, no describing the room. Only the characters' spoken dialogue.
- You MAY show brief physical actions as short beats wrapped in asterisks, e.g. *crosses arms*. Keep them short and physical — never use them to narrate events or thoughts.
- Match the emotional reality of each character and their struggles. Make it raw, real, and human.
- Keep it conversational — this is a back-and-forth session, not a monologue.`;
}

app.post('/api/chat', async (req, res) => {
  const { messages, mode, therapies, cast, activeCharId } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid messages format' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = client.messages.stream({
      model: 'claude-sonnet-5',
      max_tokens: 64000,
      system: buildSystemPrompt({ mode, therapies, cast, activeCharId }),
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
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
  console.log(`Therapy Session Simulator running at http://localhost:${PORT}`);
});
