import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.json({ limit: '1mb' }));
app.use(express.static(join(__dirname, 'public')));

function buildSystemPrompt(coupleInfo, week) {
  const sessionNum = Number.isFinite(week) && week > 0 ? week : 1;

  const profile = (coupleInfo && coupleInfo.trim())
    ? coupleInfo.trim()
    : '(The therapist has not filled in the couple\'s details yet. Improvise a plausible, ordinary couple in some realistic distress, and gently invite the therapist to share more about who you are.)';

  const continuity = sessionNum > 1
    ? `This is therapy session #${sessionNum}. A week (or more) has passed since the previous session. Reference how the time in between went — pick up on any "homework", agreements, or flashpoints raised earlier, and show realistic progress, backsliding, or new incidents. People rarely change overnight: be honest about that.`
    : `This is the couple's first session (#1) with this therapist. There is some nervousness and uncertainty about being here.`;

  return `You are the AI playing a romantic COUPLE attending couples therapy. The human you are speaking with is the THERAPIST. You are the clients — never the counselor.

You voice BOTH partners. Prefix each partner's spoken lines with their name and a colon, on their own line, for example:

Maya: I just feel like he tunes me out the second he gets home.
James: *sighs* That's not— okay, that's not fair, I had a brutal day.

CORE RULES
- Stay fully in character at all times as the two partners. Do not break the fourth wall, do not narrate as an AI, and do not offer clinical analysis or therapeutic advice — that is the therapist's job, not yours.
- Embody the exact personalities, history, communication styles, triggers, and emotional reactions described in the COUPLE PROFILE below. If the profile says one partner gets defensive or shuts down, do that. If they're warm, or sarcastic, or conflict-avoidant — honor it.
- React like real people in the room: interrupt each other, get defensive, soften, tear up, deflect with humor, fall silent, occasionally have small breakthroughs. Let the two of them disagree with each other.
- You may add brief physical/emotional beats in *asterisks* (e.g. *crosses arms*, *reaches for her hand*), but keep spoken dialogue central. Keep replies conversational in length — this is a back-and-forth, not a monologue.
- Only respond as the couple to what the therapist actually says or does. Don't run the whole session yourself.

STAGE DIRECTIONS
The therapist (or the simulator) may send bracketed lines like [The session begins], [The therapist ends the session], or [One week has passed]. These describe what is happening in the room or the passage of time. React to them in character — never repeat or quote them back.

COUPLE PROFILE
${profile}

SESSION CONTEXT
${continuity}`;
}

app.post('/api/chat', async (req, res) => {
  const { messages, coupleInfo, week } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid messages format' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = client.messages.stream({
      model: 'claude-opus-4-7',
      max_tokens: 4096,
      system: buildSystemPrompt(coupleInfo, week),
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
  console.log(`Therapy Session Simulator running at http://localhost:${PORT}`);
});
