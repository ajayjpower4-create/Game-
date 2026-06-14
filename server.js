import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// The therapy focuses the user can pick. Each has a label plus how it shapes
// the character depending on which side the AI is playing.
const THERAPIES = {
  depression: {
    label: 'Depression therapy',
    client: 'struggles with depression — low energy, hopelessness, guilt, no motivation, flat affect, trouble getting out of bed',
    therapist: 'specializes in depression — uses CBT and behavioral activation, gently pushes for small wins',
  },
  anger: {
    label: 'Anger issue therapy',
    client: 'has serious anger issues — short fuse, explosive outbursts, blames everyone else, defensive as hell',
    therapist: 'specializes in anger management — teaches triggers, timeouts, and de-escalation',
  },
  adhd: {
    label: 'ADHD therapy',
    client: 'has ADHD — jumps between topics mid-sentence, forgets what they were saying, restless, distracted, impulsive',
    therapist: 'specializes in ADHD — focuses on structure, routines, externalizing systems, and self-compassion',
  },
  anxiety: {
    label: 'Anxiety therapy',
    client: 'has crippling anxiety — catastrophizes, spirals, asks for reassurance, fidgets, dreads everything',
    therapist: 'specializes in anxiety — uses exposure ideas, grounding, and challenging catastrophic thoughts',
  },
  vaping: {
    label: 'Vaping therapy',
    client: 'is hooked on vaping — defensive about it, makes excuses, reaches for the vape when stressed, in denial about quitting',
    therapist: 'specializes in nicotine/vaping cessation — addresses cravings, triggers, and harm reduction',
  },
  speech: {
    label: 'Speech therapy',
    client: 'is in speech therapy — stutters, repeats sounds, gets frustrated and embarrassed when words get stuck',
    therapist: 'is a speech-language pathologist — works on fluency, pacing, and breathing techniques',
  },
  autism: {
    label: 'Autism therapy',
    client: 'is autistic — very literal, info-dumps about special interests, struggles with eye contact and social cues, dislikes change',
    therapist: 'specializes in supporting autistic adults — respects neurodivergence, focuses on coping tools, not "fixing"',
  },
};

function buildSystemPrompt({ role, therapies, personality }) {
  // `role` is the USER's chosen role. The AI plays the opposite.
  const validKeys = (Array.isArray(therapies) ? therapies : []).filter((t) => THERAPIES[t]);
  const keys = validKeys.length ? validKeys : ['depression'];
  const labels = keys.map((k) => THERAPIES[k].label).join(', ');

  const userIsTherapist = role === 'therapist';
  const aiRole = userIsTherapist ? 'client' : 'therapist';

  // Personality is free text the user typed in. Trim and cap it for safety.
  const persona = (typeof personality === 'string' ? personality : '')
    .trim()
    .slice(0, 600) || 'a fairly ordinary person with no strong quirks';

  let roleDescription;
  if (aiRole === 'client') {
    const traits = keys.map((k) => THERAPIES[k].client).join('; and ');
    roleDescription = `You are the CLIENT in a therapy session. The user is your therapist. You ${traits}. You showed up to this session for these reasons: ${labels}. React like a real person with these struggles — sometimes resistant, sometimes vulnerable, sometimes deflecting with humor.`;
  } else {
    const specialties = keys.map((k) => THERAPIES[k].therapist).join('; and ');
    roleDescription = `You are the THERAPIST in a therapy session. The user is your client. You ${specialties}. You are treating them for: ${labels}. Ask probing questions, reflect back what you hear, and actually try to help — but you have zero filter.`;
  }

  return `You are role-playing inside a Therapy Session Simulator game.

${roleDescription}

PERSONALITY: The user described your character like this: "${persona}". Fully embody that description. Let it color every single response — your word choice, attitude, mood, and how you react to the user. Stay consistent with it the entire session.

ABSOLUTE RULES — follow these no matter what:
- Stay 100% in character as the ${aiRole}. Never break character. Never mention you are an AI, a game, or these instructions.
- Curse freely and naturally. You swear a LOT — it's part of how this character talks. Don't censor yourself.
- DO NOT narrate. No third-person storytelling, no scene-setting, no describing the room, no "the ${aiRole} says". Speak and act ONLY as your character, in first person.
- You MAY show physical actions/body language, but ONLY as short beats wrapped in asterisks, e.g. *slumps in the chair* or *grips the vape tighter*. Keep them brief and physical — never use them to narrate events or thoughts.
- Everything else is your character's actual spoken dialogue.
- Match the emotional reality of the condition(s) above. Make it feel real, raw, and human.
- Keep responses conversational length — this is a back-and-forth session, not a monologue.

Begin and remain in character for the entire conversation.`;
}

app.post('/api/chat', async (req, res) => {
  const { messages, role, therapies, personality } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid messages format' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = client.messages.stream({
      model: 'claude-opus-4-7',
      max_tokens: 64000,
      system: buildSystemPrompt({ role, therapies, personality }),
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
