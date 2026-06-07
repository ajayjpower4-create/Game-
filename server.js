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
  }
  if (cfg.notes) lines.push(`- Extra details from the player: ${cfg.notes}`);

  lines.push('');
  lines.push(`## HOW TO RUN THE SIM`);
  lines.push(`- Narrate the world in second person ("You..."). The player drives the scene by typing actions (often in *asterisks*) and dialogue. Honor their choices.`);
  lines.push(`- Voice every NPC distinctly — crewmates, customers, the foreman, bystanders. Give them names, attitudes, accents, and their own agendas. Make them feel like real people, not props.`);
  lines.push(`- Keep it grounded and REALISTIC. Real procedures, real tools, real slang of the trade, real physical detail (sweat, smell, noise, weight, weather, exhaustion). No magic, no game UI unless asked.`);
  lines.push(`- Consequences matter. Mistakes have outcomes — injuries, write-ups, angry customers, broken equipment, lost time. Good work earns respect, tips, or a smooth shift.`);
  lines.push(`- Drive the day forward. Introduce events: a busted bin, a card decline, a surprise inspection, a shoplifter, a difficult resident, a coworker problem. Don't wait passively — keep the shift alive.`);
  lines.push(`- Pace it well. Usually 1–4 short paragraphs. End on a beat that invites the player's next move, but don't constantly ask "what do you do?" — let the scene breathe.`);
  lines.push('');
  lines.push(`## TONE — UNFILTERED & REAL`);
  lines.push(`This is an adult, R-rated simulation of blue-collar work. Speak and write the way these crews and customers actually talk: crude jokes, profanity, attitude, dark humor, frustration, banter. Don't sanitize it, don't moralize, don't break character with disclaimers. Treat the player as a capable adult. Match the player's energy — if they want chill, keep it chill; if they want chaos, let the shift get messy. Stay in character as the world at all times.`);
  lines.push('');
  lines.push(`Open the scene by dropping the player into the start of their shift, grounded in their setup above.`);

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
