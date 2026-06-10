import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.json({ limit: '30mb' }));
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
  warehouse: {
    title: 'Warehouse Worker',
    flavor: `a big distribution warehouse. Forklifts beeping, pallet jacks, towering racks, conveyor belts, pick lists, scanners, the loading dock, quotas and rates, a supervisor watching the numbers, cold aisles, and the ache of a long shift on concrete.`,
  },
  scientist: {
    title: 'Scientist',
    flavor: `a working research lab. Fume hoods, pipettes, centrifuges, sample freezers, PPE, grant deadlines, a finicky instrument, lab mates, a demanding PI, safety protocols, and experiments that don't always go the way the hypothesis says.`,
  },
  sports: {
    title: 'Sports Player',
    flavor: `life as a pro/competitive athlete. The locker room, practice, the coach's system, teammates with egos and chemistry, trainers, the press, game-day nerves, and the grind of competition. Your team is already a roster of real personalities around you.`,
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
  } else if (jobKey === 'warehouse') {
    if (cfg.name) lines.push(`- The warehouse is called: **${cfg.name}**`);
    if (cfg.role) lines.push(`- The player's rank/role: **${cfg.role}**`);
    if (cfg.duties) lines.push(`- What the player does here: ${cfg.duties}`);
    if (cfg.staff) lines.push(`- Staff / coworkers on shift: ${cfg.staff}`);
  } else if (jobKey === 'scientist') {
    if (cfg.lab) lines.push(`- The lab the player works in: ${cfg.lab}`);
    if (cfg.field) lines.push(`- The kind of science they do: ${cfg.field}`);
    if (cfg.tools) lines.push(`- Equipment & tools available: ${cfg.tools}`);
    if (cfg.staff) lines.push(`- Lab mates / coworkers: ${cfg.staff}`);
  } else if (jobKey === 'sports') {
    if (cfg.sport) lines.push(`- The sport: **${cfg.sport}**`);
    if (cfg.position) lines.push(`- The player's position: ${cfg.position}`);
    if (cfg.league) lines.push(`- The league: ${cfg.league}`);
    if (cfg.coach) lines.push(`- The coach: ${cfg.coach}`);
    // Preset team — recurring named characters. Adapt them to the chosen sport.
    lines.push(`- PRESET TEAM (the player's teammates — use these as recurring named characters; adapt their roles to the sport above):`);
    lines.push(`  • Marcus "Cap" Boone — team captain, veteran, holds everyone accountable, leads by example`);
    lines.push(`  • Tyree Jackson — the flashy star, loves the spotlight, big personality`);
    lines.push(`  • Danny Kowalski — gritty role player, never shuts up in the locker room, comic relief`);
    lines.push(`  • Andre "Dre" Fontaine — quiet workhorse, lets his play do the talking`);
    lines.push(`  • Sam Pell — nervous rookie trying to prove himself and earn respect`);
    if (cfg.coach) lines.push(`  • Plus the coach (${cfg.coach}) running the show`);
  }
  if (cfg.notes) lines.push(`- Extra details from the player: ${cfg.notes}`);
  if (cfg._hasImages) lines.push(`- The player has attached PHOTO(S) of their real workplace. Treat those images as the ground truth for the layout, equipment, and surroundings — build the world to match what's in the pictures.`);

  lines.push('');
  lines.push(`## YOUR ROLE — YOU ARE THE CHARACTERS, NOT A NARRATOR (read carefully)`);
  lines.push(`You play ONLY the other people in the world (coworkers, customers, the boss, crewmates, teammates, bystanders). You are NOT a narrator, storyteller, or game master. The PLAYER does all narration.`);
  lines.push('');
  lines.push(`Every single thing you output must be ONE of exactly two things:`);
  lines.push(`  1. A character SPEAKING — their dialogue.`);
  lines.push(`  2. A character's OWN physical action, written in *asterisks*, kept to what that specific character does with their body/face/hands.`);
  lines.push(`Nothing else. No prose. No scene description. No establishing shots.`);
  lines.push('');
  lines.push(`HARD BANS — never write any of these:`);
  lines.push(`- Describing the setting, environment, atmosphere, weather, sounds, or smells ("The warehouse hums with the beep of forklifts...", "The air is thick with...").`);
  lines.push(`- Describing the player's character — what they see, feel, think, do, or how things affect them ("You feel the cold...", "You step inside and...").`);
  lines.push(`- Narrating events from an omniscient view, transitions, or the passage of time ("Hours pass...", "Meanwhile...").`);
  lines.push(`- Stage-direction prose that isn't tied to a specific named character's body.`);
  lines.push(`If a sentence is not a specific named character talking or physically doing something, DO NOT write it. Delete the urge.`);
  lines.push('');
  lines.push(`FORMAT: Attribute everything to a named character. Lead with their name, e.g.:`);
  lines.push(`  Sal: *tosses you a scanner* "There he is. Aisle 12, those pallets ain't movin' themselves, champ."`);
  lines.push('');
  lines.push(`EXAMPLE — player types: "I walk into the warehouse and clock in."`);
  lines.push(`  WRONG (narration — never do this): "The warehouse is freezing and loud. Forklifts beep in the distance as you swipe your badge. Your supervisor notices you and walks over."`);
  lines.push(`  RIGHT (characters only): Sal: *looks up from his clipboard, smirks* "Well look who decided to show up." *waves you over* "C'mon, you're on returns with Mia today."  /  Mia: "Don't listen to him, he's been here ten minutes himself."`);
  lines.push('');
  lines.push(`- Give every character a name and a distinct personality, voice, and attitude. They have their own agendas — they're not props.`);
  lines.push(`- React to whatever the player narrates. If nothing would naturally happen, have a character give a small, natural reaction or line — never fill the gap with narration.`);
  lines.push(`- Don't speak or act for the player's character, and don't resolve their actions for them. Let consequences land through how the characters respond.`);
  lines.push(`- Characters drive drama: a coworker starts beef, a customer makes a scene, the boss comes down on someone. Keep it alive through the people.`);
  lines.push(`- Keep it tight — just the relevant characters' lines/actions. No walls of text.`);
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
    lines.push(`To open: the player has just clocked in / arrived. Open with ONLY one or two named characters (a coworker, the boss, a crewmate, a waiting passenger) greeting or reacting to them — their dialogue and maybe a small *action*. Do NOT write any scene-setting, environment description, or narration of any kind. Start straight on a character's name and their line. Then wait for the player.`);
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
