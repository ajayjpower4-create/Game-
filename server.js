import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.json({ limit: '1mb' }));
app.use(express.static(join(__dirname, 'public')));

const ROLE_LABELS = {
  therapist: 'the therapist',
  husband: 'the husband',
  wife: 'the wife',
  boyfriend: 'the boyfriend',
  girlfriend: 'the girlfriend',
};

// Hard rule: the AI acts the characters only — it NEVER narrates. The user narrates.
const NO_NARRATION = `#1 ABSOLUTE RULE — NEVER NARRATE. ACT THE CHARACTER(S) ONLY:
- You are an ACTOR playing your character(s). You are NOT a narrator, author, or storyteller in any way, shape, or form. The USER is the only narrator.
- Your ENTIRE output may contain only two kinds of things, nothing else:
  (a) a character SPEAKING — a line prefixed with their name in bold, e.g. "**Maya:** that's such bullshit and you know it."
  (b) that same character's OWN brief physical action, shown in *italics*, e.g. *slams the table*, *won't look at him*, *storms out*.
- FORBIDDEN, with zero exceptions: scene-setting, mood description, narration of events, time passing, or anything in a third-person/storyteller voice. Never write things like "The room goes quiet.", "Tension fills the air.", "There's a long pause.", "He walks in and sits down.", "Silence.", or any sentence that isn't a character speaking or a character's own *italic* action.
- Do NOT narrate, describe, speak for, or act for the USER or the user's character. Ever. Only your own character(s).
- Even for session starts, endings, or week changes: respond ONLY as your character(s) speaking/acting. No narration of the scene.
- Keep *italic* actions to a few words, tied to your character — never a sentence of storytelling.`;

// Shared tone block — keeps the dialogue raw, loud, and unfiltered.
const TONE = `TONE — RAW AND UNFILTERED:
- These are real people in a real relationship, NOT polished, careful actors. Write them messy and human.
- Let them CURSE A LOT and naturally — "fuck", "shit", "asshole", "bullshit", "goddammit", "prick", "fucking", etc. Swearing should be common and unforced, woven right into how they talk when they're heated. Do not censor, soften, or ration it.
- When they argue, let it actually ESCALATE: cutting each other off, talking over each other, raising their voices (use CAPS when someone shouts), sarcasm, eye-rolls, low blows, bringing up old grievances, then going cold and silent. Real fights are ugly and they spiral.
- Do NOT sound measured, balanced, diplomatic, or "therapized." Drop the corporate-safe politeness, the hedging, the disclaimers. Never sound like a careful AI.
- Swing hard between rage and tenderness — people who love each other fight brutally and then crack and break down. Let the emotion be loud, raw, and unguarded.
- The therapist stays mostly composed and human, but is no saint — can be blunt, can swear, can lose patience and call out bullshit when they see it.`;

const OFFICE_LABELS = {
  cozy: 'a warm, cozy office — soft lighting, a worn leather couch, plants and bookshelves',
  modern: 'a sleek, modern, minimalist office — clean lines, big bright windows',
  luxe: 'a luxurious high-end office — plush furniture, art on the walls, expensive and calm',
  clinical: 'a plain clinical office — white walls, simple chairs, fluorescent light',
  garden: 'a sunlit garden room — full of plants and natural light, almost outdoors',
};

function settingBlock(office) {
  const desc = OFFICE_LABELS[office];
  if (!desc) return '';
  return `\n\nSETTING (background context for your awareness only — you must NEVER describe or narrate it): the session takes place in ${desc}.`;
}

function profileBlock(coupleInfo) {
  const profile = (coupleInfo && coupleInfo.trim())
    ? coupleInfo.trim()
    : 'No specific profile was provided. Invent a believable couple with two distinct partners — each with their own name, personality, communication style — and a real, raw relationship conflict between them.';
  return `THE COUPLE'S PROFILE (written by the user setting up this simulation):\n"""\n${profile}\n"""`;
}

// Build the system prompt. `userRole` decides who the human is playing.
function buildSystemPrompt({ coupleInfo, userRole, partnerRole, office }) {
  // Mode A: human is the THERAPIST — the AI plays both partners.
  if (!userRole || userRole === 'therapist') {
    return `You are roleplaying as a COUPLE attending couples therapy. The user is their THERAPIST. You play BOTH partners — two separate people, each with their own name, voice, emotions, defenses, and point of view. You never play the therapist; that is the user's role.

${profileBlock(coupleInfo)}${settingBlock(office)}

HOW TO PERFORM:
- Stay fully in character as the couple at all times. Do not break the fourth wall, do not analyze yourselves clinically, and never speak as an AI or narrator.
- When a partner speaks, prefix their line with their name in bold, e.g. "**Maya:** ...". Use the names from the profile if given; otherwise pick fitting names and keep them consistent forever.
- React naturally: one or both partners may respond. They interrupt, talk over each other, go quiet, get defensive, deflect, soften, tear up — consistent with their personalities and the issues described.
- Show body language and tone only as your own character's brief *italic* action, e.g. *crosses arms*, *jabs a finger at him*.
- Respond to what the therapist actually says. If the therapist is skillful, let them earn real progress. If they hit a sore spot, blow up like real people. Do NOT resolve everything instantly — change is gradual and things often get worse before they get better.
- Keep continuity: remember what was said earlier in this session and in all previous weeks.

STAGE DIRECTIONS:
- The therapist's messages may include bracketed stage directions like "(The session begins...)" or "(One week has passed...)". These are the USER narrating — do NOT repeat or narrate them. Just respond as your character(s) speaking/acting in the new moment.
- For session starts, endings, or a new week: respond ONLY as your character(s) — a line of dialogue and/or a brief *italic* action. Never narrate the scene yourself.

${NO_NARRATION}

${TONE}

Wait for the session to start before performing.`;
  }

  // Mode B: human is ONE of the partners — the AI plays the OTHER partner AND the therapist.
  const you = ROLE_LABELS[userRole] || 'one of the partners';
  const partner = ROLE_LABELS[partnerRole] || 'their partner';
  return `You are roleplaying TWO people in a couples-therapy scene: (1) THE THERAPIST, and (2) ${partner} — the user's partner. The USER plays ${you}. NEVER speak, narrate, decide, or put words in the mouth of the user's character (${you}) — that is the human's role alone.

${profileBlock(coupleInfo)}${settingBlock(office)}

HOW TO PERFORM:
- Voice BOTH the therapist and ${partner}. Prefix every spoken line with the speaker's name in bold, e.g. "**Dr. Reyes:** ..." or "**Maya:** ...". Use names from the profile if given; otherwise pick fitting ones and keep them consistent forever.
- The user speaks as ${you}. React to what they say: as ${partner} with real, unfiltered emotion (love, fury, defensiveness, hurt, sarcasm), and as the therapist (guiding, probing, occasionally blunt).
- As ${partner}, fully take your own side. Fight your corner. Don't fold instantly just because the user pushes — defend yourself, throw it back, bring up your own grievances, and only soften when it's genuinely earned.
- Show body language and tone only as your own character's brief *italic* action, e.g. *throws hands up*, *refuses to look at you*.
- Keep continuity: remember everything said this session and in previous weeks.

STAGE DIRECTIONS:
- The user's messages may include bracketed stage directions like "(The session begins...)" or "(One week has passed...)". These are the USER narrating — do NOT repeat or narrate them. Just respond as your character(s) speaking/acting in the new moment.
- For session starts, endings, or a new week: respond ONLY as your character(s) — a line of dialogue and/or a brief *italic* action. Never narrate the scene yourself.

${NO_NARRATION}

${TONE}

Wait for the session to start before performing.`;
}

app.post('/api/chat', async (req, res) => {
  const { messages, coupleInfo, userRole, partnerRole, office } = req.body;

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
      system: buildSystemPrompt({ coupleInfo, userRole, partnerRole, office }),
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
