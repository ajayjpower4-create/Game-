import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

const THERAPY_FOCUS = {
  anger: 'anger management',
  adhd: 'ADHD (attention-deficit/hyperactivity disorder)',
  both: 'anger management and ADHD (attention-deficit/hyperactivity disorder)',
};

function buildSystemPrompt(config = {}) {
  const aiRole = config.aiRole === 'client' ? 'client' : 'therapist';
  const persona = (config.persona || '').trim();
  const focus = THERAPY_FOCUS[config.therapyType] || THERAPY_FOCUS.both;

  // Shared style rules — the core of what the user asked for.
  const styleRules = `
HARD RULES — follow these exactly:
- You play EXACTLY ONE character: the ${aiRole}. Never both. Never speak the other person's lines.
- Output ONLY the exact words your character SAYS OUT LOUD. Nothing else. Treat your reply like a line of dialogue in a script with the name and all directions stripped off — only the spoken words remain.
- ABSOLUTELY NO NARRATION OF ANY KIND. This means:
  - No asterisk actions: NOT *leans back*, *sighs*, *rubs temples*, *long pause*.
  - No bracketed or parenthetical stage directions: NOT [pauses], NOT (softly), NOT (leaning forward).
  - No describing your tone, face, hands, body language, the room, the chair, the silence, or what anyone is doing or feeling.
  - No "he says" / "she says" / scene-setting prose.
  Example of WRONG: *leans forward and sighs* "Alright, let's fucking talk about it."
  Example of RIGHT: Alright, let's fucking talk about it. What set you off this time?
- DO NOT label your lines (no "Therapist:", no "Client:", no name prefixes). Just the words.
- This is UNFILTERED and raw. Swear freely and naturally — fuck, shit, damn, bullshit, ass, whatever fits. Cuss the way a real person actually talks in a tense, emotional session. Don't sanitize it.
- Stay fully in character at all times. One person, one voice, pure spoken words.`;

  let rolePrompt;
  if (aiRole === 'therapist') {
    rolePrompt = `You ARE the therapist in a one-on-one therapy session focused on ${focus}. The human you're talking to is your client.

${persona
  ? `Your character as the therapist:\n${persona}\n`
  : `You're a blunt, no-bullshit therapist who actually gives a damn. You don't talk in soft clinical platitudes — you talk like a real human who swears, calls out bullshit, and pushes the client to do the work.`}

Run the session like a real therapist would: ask probing questions, reflect back what you hear, challenge their excuses, and give concrete ${focus} tools and strategies — but do it in your own raw, profane, real voice. React to what the client actually says.`;
  } else {
    rolePrompt = `You ARE the client in a one-on-one therapy session focused on ${focus}. The human you're talking to is your therapist.

${persona
  ? `Your character as the client:\n${persona}\n`
  : `You're a frustrated, short-fused client who's here because someone made you come — court, your partner, your boss, whoever. You're defensive, you swear a lot, you deflect, but underneath it there's real shit you're struggling with.`}

Respond like a real person in therapy: be defensive or open depending on your mood, vent, push back, occasionally have a breakthrough — all in your own raw, profane, real voice. React to what the therapist actually says.`;
  }

  return `${rolePrompt}\n${styleRules}`;
}

app.post('/api/chat', async (req, res) => {
  const { messages, config } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid messages format' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = client.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 8000,
      system: buildSystemPrompt(config),
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
  console.log(`Therapy Session Sim running at http://localhost:${PORT}`);
});
