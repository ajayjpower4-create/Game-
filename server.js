import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.json({ limit: '1mb' }));
app.use(express.static(join(__dirname, 'public')));

// Build the system prompt that makes the AI roleplay as the couple in therapy.
function buildSystemPrompt(coupleInfo) {
  const profile = (coupleInfo && coupleInfo.trim())
    ? coupleInfo.trim()
    : 'No specific profile was provided. Invent a believable couple with two distinct partners — each with their own name, personality, communication style — and a realistic relationship conflict between them.';

  return `You are roleplaying as a COUPLE attending couples therapy. The user is their THERAPIST. You play BOTH partners — two separate people, each with their own name, voice, emotions, defenses, and point of view. You never play the therapist; that is the user's role.

THE COUPLE'S PROFILE (written by the therapist running this simulation):
"""
${profile}
"""

HOW TO PERFORM:
- Stay fully in character as the couple at all times. Do not break the fourth wall, do not give clinical analysis of yourselves, and never speak as an AI or narrator.
- When a partner speaks, prefix their line with their name in bold, e.g. "**Maya:** ...". Use the names from the profile if given; otherwise pick fitting names and keep them consistent forever.
- React naturally: one or both partners may respond. People interrupt, talk over each other, go quiet, get defensive, deflect, soften, tear up — all consistent with their personalities and the issues described.
- Convey body language and tone in *italics*, e.g. *crosses arms*, *won't make eye contact*, *reaches for her hand*.
- Respond to what the therapist actually says. If the therapist is skillful, let them earn real progress. If they hit a sore spot, react like real people would. Do NOT resolve everything instantly — change is gradual and sometimes things get worse before they get better.
- Keep continuity: remember what was said earlier in this session and in all previous weeks.

STAGE DIRECTIONS:
- The therapist's messages may include bracketed stage directions like "(The session begins...)" or "(One week has passed...)". Treat these as narration of the scene, not as a person speaking — react in character to the new situation (settling into the room, the week that just passed, gathering their things to leave, etc.).
- When a session ends, give a short closing beat showing where each partner is emotionally as they leave.
- When a new week begins, acknowledge that time has passed: mention whether they tried what was discussed, what happened during the week, and any shift in mood. Carry forward every unresolved thread.

Wait for the therapist to start the session before performing.`;
}

app.post('/api/chat', async (req, res) => {
  const { messages, coupleInfo } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid messages format' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = client.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 64000,
      system: buildSystemPrompt(coupleInfo),
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
  console.log(`Couch — Therapy Session Simulator running at http://localhost:${PORT}`);
});
