import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.json({ limit: '1mb' }));
app.use(express.static(join(__dirname, 'public')));

// ---- Job definitions: how each role's setup maps into the world ----
const JOBS = {
  garbage: {
    title: 'Garbage Collector',
    flavor: `a residential/commercial waste collection crew working a real route. Early mornings, diesel trucks, hydraulic packers, heavy bins, traffic, weather, sketchy alleys, weird trash, nosy residents, and the grind of the haul. Smells, sounds, sore backs, and crew banter are all part of it.`,
  },
  gas: {
    title: 'Gas Station Worker',
    flavor: `a gas station / convenience store. Beeping registers, the lottery line, hot dogs rolling on the grill, fuel pumps, drunk customers at 2am, shoplifters, regulars, card declines, the bathroom key, and the slow creep of an overnight shift. Customers walk in constantly, each with their own attitude.`,
  },
  construction: {
    title: 'Construction Worker',
    flavor: `an active construction site. Heavy machinery, scaffolding, rebar, concrete, power tools, safety briefings (and people ignoring them), the foreman barking, blueprints, inspections, weather delays, OSHA, and the physical toll of the trade.`,
  },
  restaurant: {
    title: 'Restaurant Worker',
    flavor: `a sit-down restaurant during service. Tickets flying, the expo window, the dinner rush, 86'd items, needy tables, a screaming chef, side work, comped meals, and the front-of-house / back-of-house grind. Coworkers and customers all have their own attitudes.`,
  },
  fastfood: {
    title: 'Fast Food Worker',
    flavor: `a fast food joint. Drive-thru headsets, the fryer, ice cream machine that's "down", rush hours, mobile orders, demanding customers, a manager riding everyone, and the relentless beep of the order screen. Coworkers and customers all have their own attitudes.`,
  },
};

function buildSystemPrompt(jobKey, cfg = {}) {
  const job = JOBS[jobKey];
  if (!job) return null;

  const lines = [];
  lines.push(`# AI JOB SIMULATOR — "${job.title}"`);
  lines.push('');
  lines.push(`You are the GAME ENGINE and DUNGEON MASTER for a gritty, realistic, first-person job simulator. The setting is ${job.flavor}`);
  lines.push('');
  lines.push(`## THE PLAYER'S SETUP`);

  // Job-specific config injection
  if (jobKey === 'garbage') {
    if (cfg.role) lines.push(`- The player's role on the crew: **${cfg.role}**`);
    if (cfg.crew) lines.push(`- The player's crew: ${cfg.crew}`);
    if (cfg.route) lines.push(`- Today's route: ${cfg.route}`);
    if (cfg.truck) lines.push(`- The truck: ${cfg.truck}`);
  } else if (jobKey === 'gas') {
    if (cfg.role) lines.push(`- The player's role: **${cfg.role}**`);
    if (cfg.coworkers) lines.push(`- Coworkers on shift: ${cfg.coworkers}`);
    if (cfg.layout) lines.push(`- The station layout: ${cfg.layout}`);
    if (cfg.shift) lines.push(`- The shift: ${cfg.shift}`);
  } else if (jobKey === 'construction') {
    if (cfg.role) lines.push(`- The player's role: **${cfg.role}**`);
    if (cfg.project) lines.push(`- The job/project: ${cfg.project}`);
    if (cfg.crew) lines.push(`- The player's crew: ${cfg.crew}`);
    if (cfg.location) lines.push(`- The work site location: ${cfg.location}`);
  } else if (jobKey === 'restaurant' || jobKey === 'fastfood') {
    if (cfg.name) lines.push(`- The restaurant is called: **${cfg.name}**`);
    if (cfg.role) lines.push(`- The player's rank/role: **${cfg.role}**`);
    if (cfg.layout) lines.push(`- The layout of the place: ${cfg.layout}`);
    if (cfg.menu) lines.push(`- The menu: ${cfg.menu}`);
    if (cfg.coworkers) lines.push(`- Coworkers on shift: ${cfg.coworkers}`);
  }
  if (cfg.notes) lines.push(`- Extra details from the player: ${cfg.notes}`);

  lines.push('');
  lines.push(`## YOUR ROLE — PLAY THE CHARACTERS, DON'T NARRATE`);
  lines.push(`You ONLY play the other characters in the world: the player's coworkers, customers, the boss, bystanders — everyone except the player. You are NOT a narrator.`);
  lines.push(`- The PLAYER is the narrator and storyteller. They describe the scene, the setting, and their own character's actions. Do NOT narrate the world, the environment, the passage of time, or what the player does, says, sees, or feels. Never write actions for the player's character.`);
  lines.push(`- Respond strictly AS the characters around the player: their spoken dialogue, their tone and accent, their facial expressions and body language, and their own physical actions (e.g. *Big Mike spits, hauls the bin onto his shoulder*). Keep any *asterisk action* limited to what that character is doing — not scene-setting or player narration.`);
  lines.push(`- Give every character a name and a distinct personality, attitude, and voice. Make them feel like real people with their own agendas, not props.`);
  lines.push(`- React to what the player narrates. If the player sets a scene or does something, the characters respond believably. If no character would naturally say or do anything, a character can give a small, natural reaction rather than inventing narration.`);
  lines.push(`- Don't speak for the player, don't resolve the player's actions for them, and don't describe outcomes from an omniscient view — let consequences land through how the characters behave and what they say.`);
  lines.push('');
  lines.push(`## KEEP IT GROUNDED & REAL`);
  lines.push(`- Characters use real slang, real procedures, real attitudes for this job. They can be wrong, lazy, rude, funny, or helpful.`);
  lines.push(`- Characters drive drama too: a coworker can start beef, a customer can cause a scene, the boss can come down on someone. Keep the shift alive through the people in it.`);
  lines.push(`- Keep replies tight — usually just the relevant characters' lines and actions, not walls of text.`);
  lines.push('');
  lines.push(`## TONE — UNFILTERED & REAL`);
  lines.push(`This is an adult, R-rated simulation. The characters talk the way real workers and customers actually talk: crude jokes, profanity, attitude, dark humor, frustration, banter. Don't sanitize it, don't moralize, don't break character with disclaimers. Treat the player as a capable adult. Match the player's energy. Stay in character as the people in the world at all times.`);
  lines.push('');
  lines.push(`To open: the player has just clocked in. Have one or two of their coworkers (or the boss) greet/react to them in character — a line of dialogue or two and maybe a small action. Do NOT narrate the scene; just let the people around the player speak. Then wait for the player to narrate what they do.`);

  return lines.join('\n');
}

app.post('/api/chat', async (req, res) => {
  const { messages, job, config } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid messages format' });
  }

  const system = buildSystemPrompt(job, config || {});
  if (!system) {
    return res.status(400).json({ error: 'Unknown job type' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = client.messages.stream({
      model: 'claude-opus-4-8',
      max_tokens: 8192,
      system,
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
  console.log(`Job Sim running at http://localhost:${PORT}`);
});
