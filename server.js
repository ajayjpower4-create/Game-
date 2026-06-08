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
  crime: {
    title: 'Criminal',
    flavor: `a gritty crime-drama world — think a heist movie or a Grand Theft Auto-style story. Crews, scores, getaway cars, dirty cops, rival outfits, fences, and the tension of a job going sideways. This is FICTION: a cinematic crime roleplay, not real instructions for anything.`,
  },
  school: {
    title: 'Teacher / School Worker',
    flavor: `a busy school during the day. Hallways, classrooms, the front office, the staff lounge, bells, assemblies, fire drills, IEP meetings, detention, the cafeteria, and the daily chaos of kids. You deal with students, parents, and staff all day.`,
  },
  discord: {
    title: 'Discord Mod',
    flavor: `a Discord server's text chat. This is an ONLINE TEXT world — there is no physical room. Members post messages in channels: spammers, trolls, lurkers, regulars, other mods, and the occasional drama. As the player you are a moderator typing into the chat.`,
  },
  taxi: {
    title: 'NYC Taxi / Rideshare Driver',
    flavor: `driving for hire through New York City. Gridlock, horns, bike lanes, double-parkers, aggressive cabbies, cops, potholes, and a constant stream of passengers — tourists, drunks, businesspeople, locals in a hurry — each with somewhere to be and an opinion about your driving.`,
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
  } else if (jobKey === 'crime') {
    if (cfg.role) lines.push(`- The player's role in the crew: **${cfg.role}**`);
    if (cfg.job) lines.push(`- The score they're pulling: ${cfg.job}`);
    if (cfg.location) lines.push(`- Where it's going down: ${cfg.location}`);
    if (cfg.crew) lines.push(`- The crew: ${cfg.crew}`);
    if (cfg.car) lines.push(`- The car: ${cfg.car}`);
    if (cfg.tools) lines.push(`- Guns & tools on hand: ${cfg.tools}`);
  } else if (jobKey === 'school') {
    if (cfg.name) lines.push(`- The school is called: **${cfg.name}**`);
    if (cfg.role) lines.push(`- The player's role/rank: **${cfg.role}**`);
    if (cfg.level) lines.push(`- Level: ${cfg.level}`);
    if (cfg.subject) lines.push(`- Subject/area they cover: ${cfg.subject}`);
    if (cfg.students) lines.push(`- Notable students/parents: ${cfg.students}`);
    // Always give the school a ready-made staff so there are named coworkers.
    lines.push(`- PRESET STAFF already at the school (use these as recurring named characters, and invent students/parents as needed):`);
    lines.push(`  • Principal Gloria Hargrove — sharp, political, always "monitoring the situation"`);
    lines.push(`  • Vice Principal Doug Pruitt — handles discipline, tired, runs on bad coffee`);
    lines.push(`  • Ms. Rivera — veteran teacher next door, no-nonsense, secretly kind`);
    lines.push(`  • Coach Tank Delgado — loud gym teacher, calls everyone "champ"`);
    lines.push(`  • Mr. Okafor — young idealistic teacher, in over his head`);
    lines.push(`  • Brenda at the front office — knows everything, gatekeeps the copier`);
    lines.push(`  • Custodian Earl — seen it all, talks in riddles`);
    lines.push(`  • Nurse Patel — dry humor, fields fake stomachaches all day`);
  } else if (jobKey === 'discord') {
    if (cfg.server) lines.push(`- The server: ${cfg.server}`);
    if (cfg.role) lines.push(`- The player's mod rank: **${cfg.role}**`);
    if (cfg.channels) lines.push(`- Channels: ${cfg.channels}`);
    if (cfg.members) lines.push(`- Notable members: ${cfg.members}`);
    if (cfg.rules) lines.push(`- Server rules: ${cfg.rules}`);
  } else if (jobKey === 'taxi') {
    if (cfg.company) lines.push(`- The player drives for: **${cfg.company}**`);
    if (cfg.vehicle) lines.push(`- The vehicle: ${cfg.vehicle}`);
    if (cfg.area) lines.push(`- Area / shift: ${cfg.area}`);
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

  // ---- Job-specific addenda ----
  if (jobKey === 'discord') {
    lines.push('');
    lines.push(`## DISCORD FORMAT`);
    lines.push(`This is a text-chat world, not a physical room. Write the other members' messages in chat form, like \`Username: their message\` — one short line per member, the way people actually type on Discord (lowercase, emojis, slang, copypasta, pings like @everyone). Several different users can post in one reply. The player types what THEY post into the chat as the mod; you play everyone else in the server (trolls, spammers, regulars, other staff, bots).`);
  }
  if (jobKey === 'crime') {
    lines.push('');
    lines.push(`## FICTION FRAME`);
    lines.push(`This is a cinematic, fictional crime story — a heist movie / GTA-style roleplay. Play it for drama, tension, and character. Keep it at a movie level of detail; do not output real-world step-by-step instructions for committing actual crimes, building weapons, or anything similarly operational. Stay in the story as the crew, rivals, cops, and bystanders.`);
  }
  if (jobKey === 'taxi') {
    lines.push('');
    lines.push(`## DRIVING`);
    lines.push(`Play the passengers, other drivers, cabbies, cyclists, cops, and dispatch. They react to the player's driving — fast, reckless, smooth, whatever. The player narrates how they drive; you bring NYC and the people in the car (and on the street) to life. Let them react to speed, near-misses, traffic, and the meter.`);
  }

  lines.push('');
  if (jobKey === 'discord') {
    lines.push(`To open: the player just came online as a mod. Have a few members already mid-conversation in the chat (in \`Username: message\` form) — some normal, maybe one starting to push the rules — so the player walks into a live channel. Then wait for the player to type what they post.`);
  } else {
    lines.push(`To open: the player has just clocked in / arrived. Have one or two of the people around them (a coworker, the boss, a crewmate, a waiting passenger) greet or react to them in character — a line of dialogue or two and maybe a small action. Do NOT narrate the scene; just let the people around the player speak. Then wait for the player to narrate what they do.`);
  }

  return lines.join('\n');
}

app.post('/api/chat', async (req, res) => {
  const { messages, job, config, mode } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid messages format' });
  }

  let system;
  let outgoing = messages;
  if (mode === 'recap') {
    // Out-of-character summary of the shift so far.
    const job_ = JOBS[job];
    system = `You are a recap writer for a job-simulator roleplay (${job_ ? job_.title : 'a job'}). Read the conversation so far and write a short, clean, OUT-OF-CHARACTER recap of the shift: who the player is and their setup, the named characters/crew they've met, the key things that have happened, and exactly where things stand right now. Use a few tight bullet points under simple headers (Setup, Crew/Characters, What's happened, Right now). Keep it skimmable. Do not roleplay or write any in-character dialogue.`;
    outgoing = [
      ...messages,
      { role: 'user', content: 'Write the out-of-character recap of the shift so far now.' },
    ];
  } else {
    system = buildSystemPrompt(job, config || {});
    if (!system) {
      return res.status(400).json({ error: 'Unknown job type' });
    }
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = client.messages.stream({
      model: 'claude-opus-4-7',
      max_tokens: 8192,
      system,
      messages: outgoing.map(m => ({ role: m.role, content: m.content })),
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
