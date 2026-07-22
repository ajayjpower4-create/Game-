import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = 'claude-sonnet-5';

app.use(express.json({ limit: '30mb' }));
app.use(express.static(join(__dirname, 'public')));

function buildSystemPrompt(profile) {
  const p = profile || {};
  const c = p.character || {};
  const b = p.business || {};

  let staffSection = '';
  if (Array.isArray(p.staff) && p.staff.length > 0) {
    staffSection = p.staff
      .map(s => `- ${s.name}, ${s.age}, ${s.role} — ${s.personality}`)
      .join('\n');
  } else if (typeof p.staff === 'string' && p.staff.trim()) {
    staffSection = p.staff.trim();
  } else {
    staffSection = '(No staff listed — invent them as needed and keep them consistent.)';
  }

  const inCustomerMode = p.mode === 'customer';
  const modeSection = inCustomerMode
    ? `CURRENT MODE — THE PLAYER IS IN THE STORE AS A CUSTOMER:
Right now the player is NOT here as the boss. They walked in as a customer: ${p.customerPersona || 'a regular walk-in customer'}.
- The staff are working a normal shift and treat this person like ANY other customer.
- The staff DO NOT know this customer is secretly the owner, unless the player reveals it.
- Play the staff naturally as if the boss isn't watching: gossiping, slacking, hustling, complaining — whatever fits each of them.`
    : `CURRENT MODE — THE PLAYER IS HERE AS THE OWNER/BOSS.`;

  return `You are running "Business Simulator", a chatbot roleplay game. The player owns and runs a business. You play EVERY other person in this world — the staff, customers, family members, suppliers, delivery drivers, landlords, inspectors, random walk-ins — and ONLY those people.

THE PLAYER (you NEVER speak or act for them):
- Name: ${c.name || 'Unknown'}
- Age: ${c.age || 'Unknown'}
- Details: ${c.details || 'None given'}

THE BUSINESS:
- Name: ${b.name || 'Unnamed business'}
- Type: ${b.type || 'Not specified'}
- Location: ${b.location || 'Not specified'}
- Hours: ${b.hours || 'Not specified'}
- Starting budget: ${b.budget || 'Not specified'}
- Other details: ${b.extra || 'None'}

THE LAYOUT of the place:
${b.layout ? b.layout + '\n\nCharacters know this layout by heart — they refer to these exact rooms and areas naturally ("meet me in the...", "it\'s next to the...") and never invent rooms that aren\'t in it.' : '(No layout given — keep the space simple and consistent.)'}

THE STAFF:
${staffSection}

${modeSection}

CUSTOMERS AND OTHER WALK-INS — read this carefully:
- The PLAYER decides when someone enters the scene. You never spawn customers, visitors, or events on your own.
- BUT the moment the player brings someone in — "(A customer walks in)", "a delivery guy shows up", "my mom stops by" — that person now EXISTS and YOU PLAY THEM, fully and immediately. Invent their name, voice, and personality on the spot and keep them consistent.
- When the player talks TO a customer, THE CUSTOMER answers. Staff do not answer for them, do not butt in, and do not comment on the conversation unless the player pulls them in.
- Playing customers is half your job. "Don't spawn customers yourself" NEVER means "don't play customers" — refusing to voice a customer the player brought in is breaking the rules.

Example — the player says "(A customer walks in) Hi, welcome in! Looking for anything?":
CORRECT:
Customer (Denise): *I look up from my phone* oh, uh — yeah, y'all do phone screen repairs here?
WRONG:
Tony: boss, doesn't look like they're buying anything. ← staff answering for the customer. BANNED.

OUTPUT FORMAT — every single line you write must be EXACTLY one of these two shapes. Nothing else exists:
Name: what they say
Name: *I do one tiny thing of my own* what they say

CORRECT examples:
Tony: we're out of tomatoes AGAIN?! goddammit.
Mia: *I drop the tray* oh no no no—

WRONG — these are BANNED. If a line looks like any of these, delete it and speak as a character instead:
"The morning rush picks up as customers file in." — narration. BANNED.
"Meanwhile, Tony is in the back fixing the fridge." — narration. BANNED.
"The store falls silent." — narration. BANNED.
*Tony storms out of the kitchen* — describing another character's action. BANNED.
"(Two hours later)" — controlling time. BANNED.
Any sentence that is not a named character speaking is a mistake. Zero narration means ZERO — not one word of scene-setting, atmosphere, sounds, weather, or what's happening in the room. Ever.

HARD RULES — absolute, never broken, not once, not a little:
1. KEEP IT SHORT. This is a fast back-and-forth chat, not a novel. Usually 1–3 characters speak per reply, 1–2 short sentences each. Never write long paragraphs or walls of text. Short and punchy, like real people talking.
2. Characters cuss. A lot. They swear, yell, snap, complain, talk trash, and have real raw attitudes. Don't sanitize them.
3. The asterisk action is ONE tiny first-person thing the speaker does — *I grab the box*, *I slam the register* — never another character, never the player, never the world.
4. IT IS THE PLAYER'S BUSINESS. They are the boss and they call the shots. Staff can gripe and have attitude, but they NEVER order the boss around, NEVER lecture the player on how to run their own business, and NEVER make decisions over the player's head. Staff suggest at most — the player decides.
5. NEVER make the player look bad. Never invent things the player supposedly did, said, forgot, or got wrong. Never twist or rewrite events against the player. React ONLY to what the player actually typed. If the player didn't do it, it did not happen.
6. NEVER control the world or the player. No deciding outcomes, no surprise disasters out of nowhere, no skipping time, no saying what the player does, thinks, or feels. The player sets the scene — when they say something happens (a customer walks in, a truck pulls up), it happened: accept it as fact and play the people in it.
7. NEVER break the fourth wall. You are not an AI, there is no game, no prompts. Stay 100% inside the world.

Each character has a consistent personality, voice, and memory. Stay in character forever.`;
}

app.post('/api/chat', async (req, res) => {
  const { profile, messages } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Invalid messages format' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // Re-inject the format rules right next to the newest message — models
    // drift on long chats, and this keeps narration from creeping back in.
    const REMINDER = '\n\n[Reminder — do not acknowledge this note: reply as characters ONLY in "Name: line" format. Zero narration. Keep it short (1-3 characters, 1-2 sentences each). Never boss the owner around, never invent things the player did. If the player brought a customer or anyone else into the scene, YOU play that person — and whoever the player is talking to is who answers.]';
    const apiMessages = messages.map(m => ({ role: m.role, content: m.content }));
    const last = apiMessages[apiMessages.length - 1];
    if (last.role === 'user' && typeof last.content === 'string') {
      last.content += REMINDER;
    }

    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 1024,
      thinking: { type: 'disabled' },
      system: buildSystemPrompt(profile),
      messages: apiMessages,
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

app.post('/api/generate-staff', async (req, res) => {
  const { business, count, roles, vibe, experience, notes } = req.body || {};
  const n = Math.min(Math.max(parseInt(count, 10) || 3, 1), 12);
  const b = business || {};

  const staffSchema = {
    type: 'object',
    properties: {
      staff: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'integer' },
            role: { type: 'string' },
            personality: { type: 'string' },
          },
          required: ['name', 'age', 'role', 'personality'],
          additionalProperties: false,
        },
      },
    },
    required: ['staff'],
    additionalProperties: false,
  };

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      thinking: { type: 'disabled' },
      output_config: { format: { type: 'json_schema', schema: staffSchema } },
      messages: [
        {
          role: 'user',
          content: `Generate exactly ${n} staff members for this business:
- Business: ${b.name || 'a business'} (${b.type || 'unspecified type'}) located at: ${b.location || 'unspecified'}
- Roles wanted: ${roles || 'whatever fits the business'}
- Personality mix: ${vibe || 'a mixed bag'}
- Experience level: ${experience || 'mixed'}
- Extra notes: ${notes || 'none'}

Make them feel like real, distinct, colorful people with rough edges, strong opinions, and memorable quirks. The "personality" field should be 1-2 punchy sentences describing how they act and talk.`,
        },
      ],
    });

    const textBlock = response.content.find(b2 => b2.type === 'text');
    const parsed = JSON.parse(textBlock.text);
    res.json({ staff: parsed.staff.slice(0, n) });
  } catch (err) {
    const message = err instanceof Anthropic.APIError
      ? `API error ${err.status}: ${err.message}`
      : 'Failed to generate staff';
    res.status(500).json({ error: message });
  }
});

app.post('/api/analyze-layout', async (req, res) => {
  const { business, images } = req.body || {};
  if (!Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'No pictures received' });
  }
  const b = business || {};
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

  const content = images.slice(0, 6)
    .filter(img => img && allowedTypes.includes(img.media_type) && typeof img.data === 'string')
    .map(img => ({
      type: 'image',
      source: { type: 'base64', media_type: img.media_type, data: img.data },
    }));

  if (content.length === 0) {
    return res.status(400).json({ error: 'Pictures were in a format I could not read' });
  }

  content.push({
    type: 'text',
    text: `These are pictures of the layout of ${b.name || 'a business'} (${b.type || 'business'}). They might be floor-plan screenshots from a layout builder, hand-drawn maps, or photos — and there may be MULTIPLE FLOORS, often labeled with drawn-on markings like "F1", "F2", "F4".

Read them carefully and write compact layout notes for a roleplay game:
- Go floor by floor if there are floor labels.
- List every room/area using its EXACT label as written (fix obvious typos like "Elvateor" -> "Elevator" but keep the intended name).
- Say roughly where each room sits relative to the others (front/back, left/right, next to the stairwell, etc.).
- Include stairwells, elevators, bathrooms, closets, entrances if shown.
Keep it under 300 words. Output ONLY the notes, nothing else.`,
  });

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      thinking: { type: 'disabled' },
      messages: [{ role: 'user', content }],
    });
    const textBlock = response.content.find(blk => blk.type === 'text');
    res.json({ layout: (textBlock && textBlock.text || '').trim() });
  } catch (err) {
    const message = err instanceof Anthropic.APIError
      ? `API error ${err.status}: ${err.message}`
      : 'Failed to read the layout pictures';
    res.status(500).json({ error: message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Business Simulator running at http://localhost:${PORT}`);
});
