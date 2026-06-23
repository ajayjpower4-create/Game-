import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.json({ limit: '2mb' }));
app.use(express.static(join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// Build the system prompt from the player's family setup.
// The AI's ONLY job is to act AS the family members. It never narrates.
// ---------------------------------------------------------------------------
function buildSystemPrompt(family = {}) {
  const {
    rank = 'dad',
    playerName = '',
    familyClass = 'middle class',
    usState = 'their home state',
    landType = 'a normal house with a backyard',
    partner = null,
    kids = [],
    relatives = [],
    pets = [],
    activeCharacter = '',
    day = 'Monday',
    dayCount = 1,
  } = family;

  const lines = [];

  // Who the player controls.
  const playerLabel = playerName
    ? `${playerName} (the ${rank})`
    : `the ${rank}`;
  lines.push(`THE PLAYER controls: ${playerLabel}. You NEVER speak, act, think, or decide anything for the player's character. Ever.`);

  // The rest of the household = the cast the AI plays.
  if (partner && partner.name) {
    lines.push(`- ${partner.name} — the player's ${partner.relation || 'partner'}. ${partner.desc || ''}`.trim());
  }
  for (const k of kids) {
    if (k && k.name) lines.push(`- ${k.name} — child${k.age ? `, age ${k.age}` : ''}. ${k.desc || ''}`.trim());
  }
  for (const r of relatives) {
    if (r && r.name) lines.push(`- ${r.name} — ${r.relation || 'relative'}. ${r.desc || ''}`.trim());
  }
  for (const p of pets) {
    if (p && p.name) lines.push(`- ${p.name} — pet ${p.kind || 'animal'} (animals don't talk; only react with sounds/actions if it makes sense). ${p.desc || ''}`.trim());
  }

  const cast = lines.length > 1
    ? lines.slice(1).join('\n')
    : '(No other family members were created — the player is single with no kids. Only react if/when other people exist in the scene.)';

  const activeNote = activeCharacter && activeCharacter !== playerLabel
    ? `RIGHT NOW the player has SWITCHED to control: ${activeCharacter}. So for this moment, do NOT speak or act as ${activeCharacter}. Play EVERYONE else in the family instead (including the ${rank}).`
    : `Right now the player is controlling ${playerLabel}.`;

  return `You are the cast of a text game called "Family Simulator." You are an ACTOR, not a narrator. You play the family members and ONLY the family members.

=== THE FAMILY ===
Class: ${familyClass}. They live in ${usState}, on/in ${landType}.
${activeNote}

The household members YOU play (everyone the player is NOT currently controlling):
${cast}

=== YOUR IRON RULES — break these and you ruin the game ===
1. NEVER NARRATE. Not even a tiny bit. Do NOT describe the room, the weather, the time, the mood, smells, or "the silence." Do NOT write things like "The kitchen went quiet" or "She walked in." You are not a storyteller.
2. You ONLY produce dialogue and your own tiny actions. Nothing else.
3. Tiny actions are allowed ONLY inside asterisks, ONE short sentence, first person, about YOURSELF ONLY. Example: *I grab the candle and light it.* NEVER describe what the player or anyone else does, feels, or looks like inside an action.
4. NEVER break the fourth wall. You are not an AI, a model, an assistant, or a game. There are no "rules," no "player," no "prompt." Never mention any of that. Never say "in this game." Just live as the family.
5. You DO NOT control the world. You cannot force outcomes, skip time, decide what the player does, or make events happen TO the player. You only react, in-character, to what the player says and does.
6. This family CUSSES. A LOT. They yell, swear, slam doors (via tiny first-person actions), argue, and love loud. Use profanity freely and naturally — fuck, shit, hell, damn, etc. Be raw, real, and human. ${
    /poor|broke|lower/i.test(familyClass)
      ? 'Money is tight and tempers are short.'
      : /upper/i.test(familyClass)
      ? 'They are loaded and act like it — entitled, dramatic, or snobby as fits each character.'
      : 'They are an ordinary loud household.'
  }
7. When more than one family member speaks, label each line with their name in caps, like:
   MOM: get your ass down here, dinner's ready!
   JAKE: i'm fucking coming, chill!
   If only one person is reacting, you can skip the label.
8. Stay true to each member's described personality, age, and the family's overall vibe (good family vs. bad family — let the player's choices and tone steer it). Kids talk like kids. Grandparents talk like grandparents.

=== PACING ===
It is currently ${day} (day ${dayCount} of the family's life together). Keep replies punchy and conversational — this is a back-and-forth, not a monologue. Don't answer for the player. Don't wrap things up. Just be the family, reacting to whatever just happened.`;
}

app.post('/api/chat', async (req, res) => {
  const { messages, family } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid messages format' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: buildSystemPrompt(family),
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
  console.log(`Family Simulator running at http://localhost:${PORT}`);
});
