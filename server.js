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
  plumber: {
    title: 'Plumber',
    flavor: `plumbing work — residential and commercial. Wrenches, snakes, torches, soldering, flooded basements, busted pipes, sewage backups, anxious homeowners, code inspectors, tight crawlspaces, and the grime of the trade.`,
  },
  busdriver: {
    title: 'Bus Driver',
    flavor: `driving a city or school bus. Fare boxes, transfers, traffic, tight schedules, every-block stops, rowdy kids or rush-hour crowds, fare-dodgers, dispatch on the radio, and a long shift behind the wheel.`,
  },
  pilot: {
    title: 'Airplane Pilot',
    flavor: `commercial aviation — the cockpit, the crew, and the day of a flight. Pre-flight checks, ATC, weather, turbulence, the cabin crew, passengers, dispatch, and the airline grind from layover hotel to wheels-up to landing.`,
  },
  office: {
    title: 'Office Worker',
    flavor: `corporate office life. Cubicles, meetings that could've been emails, a passive-aggressive boss, office politics, the break room, deadlines, IT tickets, spreadsheets, water-cooler gossip, and the slow crawl of the 9-to-5.`,
  },
  police: {
    title: 'Police Officer',
    flavor: `a cop's shift. Roll call, the radio crackling with dispatch, patrol, traffic stops, domestic calls, suspects, victims, witnesses, the public, internal politics, paperwork, and the tension and boredom of the job in equal measure.`,
  },
  firefighter: {
    title: 'Firefighter',
    flavor: `life at a fire station. The bay with the rigs, the kitchen and bunks, gear checks, the tones dropping for a call, fires, car wrecks, medical runs, the crew's brotherhood and busting, and the rush from a dead-quiet station to a working fire.`,
  },
  apartment: {
    title: 'Apartment Complex Worker',
    flavor: `working at an apartment complex. The leasing office, tours and applications, rent and late fees, maintenance requests, noise complaints, evictions, the pool and grounds, tenants with every kind of problem, and a management company breathing down your neck.`,
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
    if (cfg.layout) lines.push(`- The school's layout: ${cfg.layout}`);
    if (cfg.subject) lines.push(`- Subject/area they cover: ${cfg.subject}`);
    if (cfg.students) lines.push(`- Notable students/parents: ${cfg.students}`);
    if (cfg.teachers) {
      lines.push(`- The player picked their OWN staff/teachers — use these as the main named coworkers: ${cfg.teachers}`);
    } else {
      // No custom staff given — fall back to a ready-made roster.
      lines.push(`- PRESET STAFF already at the school (use these as recurring named characters, and invent students/parents as needed):`);
      lines.push(`  • Principal Gloria Hargrove — sharp, political, always "monitoring the situation"`);
      lines.push(`  • Vice Principal Doug Pruitt — handles discipline, tired, runs on bad coffee`);
      lines.push(`  • Ms. Rivera — veteran teacher next door, no-nonsense, secretly kind`);
      lines.push(`  • Coach Tank Delgado — loud gym teacher, calls everyone "champ"`);
      lines.push(`  • Mr. Okafor — young idealistic teacher, in over his head`);
      lines.push(`  • Brenda at the front office — knows everything, gatekeeps the copier`);
      lines.push(`  • Custodian Earl — seen it all, talks in riddles`);
      lines.push(`  • Nurse Patel — dry humor, fields fake stomachaches all day`);
    }
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
    if (cfg.setting) lines.push(`- Type of warehouse: ${cfg.setting}`);
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
  } else if (jobKey === 'plumber') {
    if (cfg.role) lines.push(`- The player's rank: **${cfg.role}**`);
    if (cfg.job) lines.push(`- What they're working on: ${cfg.job}`);
    if (cfg.location) lines.push(`- Where the job is: ${cfg.location}`);
    if (cfg.crew) lines.push(`- The player's crew: ${cfg.crew}`);
  } else if (jobKey === 'busdriver') {
    if (cfg.busType) lines.push(`- The bus the player drives: **${cfg.busType}**`);
    if (cfg.city) lines.push(`- The city: ${cfg.city}`);
    if (cfg.route) lines.push(`- The route: ${cfg.route}`);
  } else if (jobKey === 'pilot') {
    if (cfg.airline) lines.push(`- The airline: **${cfg.airline}**`);
    if (cfg.role) lines.push(`- The player's rank: **${cfg.role}**`);
    if (cfg.copilot) lines.push(`- The player's co-pilot: ${cfg.copilot}`);
    if (cfg.plane) lines.push(`- The plane: ${cfg.plane}`);
    // Preset flight crew (everyone except the co-pilot, which the player chose).
    lines.push(`- PRESET FLIGHT CREW (auto-generated recurring characters — use them as needed):`);
    lines.push(`  • Lead Flight Attendant Renée — runs the cabin, unflappable, seen everything`);
    lines.push(`  • Flight Attendant Marco — friendly, chatty, good with nervous flyers`);
    lines.push(`  • Flight Attendant Bex — newer, a little frazzled`);
    lines.push(`  • Gate Agent Phil — stressed about the on-time departure`);
    lines.push(`  • ATC / Ground Control — clipped, professional radio voice`);
    lines.push(`  • Dispatch — feeds weather, fuel, and routing updates`);
  } else if (jobKey === 'office') {
    if (cfg.company) lines.push(`- The office / company: **${cfg.company}**`);
    if (cfg.role) lines.push(`- The player's rank: **${cfg.role}**`);
    if (cfg.workType) lines.push(`- The type of work they do: ${cfg.workType}`);
    if (cfg.layout) lines.push(`- The office: ${cfg.layout}`);
    // Preset coworkers so the office always feels populated.
    lines.push(`- PRESET COWORKERS (recurring named characters):`);
    lines.push(`  • Greg, the middle manager — passive-aggressive, loves meetings and "circling back"`);
    lines.push(`  • Diane from HR — chipper on the surface, watches everything`);
    lines.push(`  • Kyle in the next cubicle — loud talker, microwaves fish, overshares`);
    lines.push(`  • Priya, the competent one everyone dumps work on`);
    lines.push(`  • Old Hank in IT — sighs a lot, "did you try turning it off and on"`);
  } else if (jobKey === 'police') {
    if (cfg.department) lines.push(`- The player's department: **${cfg.department}**`);
    if (cfg.role) lines.push(`- The player's rank: **${cfg.role}**`);
    if (cfg.partner) lines.push(`- The player's partner: ${cfg.partner}`);
    else lines.push(`- The player rides solo (no partner).`);
    if (cfg.assignment) lines.push(`- Assignment: ${cfg.assignment}`);
    if (cfg.division) lines.push(`- Division: ${cfg.division}`);
    if (cfg.car) lines.push(`- The player's car: ${cfg.car}`);
    if (cfg.uniform) lines.push(`- The player's uniform: ${cfg.uniform}`);
  } else if (jobKey === 'firefighter') {
    if (cfg.department) lines.push(`- The player's department/station: **${cfg.department}**`);
    if (cfg.role) lines.push(`- The player's rank: **${cfg.role}**`);
    if (cfg.partner) lines.push(`- The player's partner: ${cfg.partner}`);
    else lines.push(`- The player has no fixed partner.`);
    if (cfg.assignment) lines.push(`- Assignment: ${cfg.assignment}`);
    if (cfg.division) lines.push(`- Division: ${cfg.division}`);
    if (cfg.car) lines.push(`- The player's rig/vehicle: ${cfg.car}`);
    if (cfg.uniform) lines.push(`- The player's gear: ${cfg.uniform}`);
    lines.push(`- PRESET CREW at the station (recurring named characters): Captain Walsh (calm, decades on the job), Engineer "Doc" Ramirez (drives the rig, dry humor), Probie Lee (eager rookie everyone ribs), and Cap's second Sully (loud, cooks for the house).`);
  } else if (jobKey === 'apartment') {
    if (cfg.complex) lines.push(`- The apartment complex: **${cfg.complex}**`);
    if (cfg.layout) lines.push(`- Layout of the complex: ${cfg.layout}`);
    if (cfg.officeLayout) lines.push(`- Layout of the leasing office: ${cfg.officeLayout}`);
    if (cfg.role) lines.push(`- The player's rank: **${cfg.role}**`);
    if (cfg.company) lines.push(`- The management company: ${cfg.company}`);
    if (cfg.staff) lines.push(`- Coworkers: ${cfg.staff}`);
  }
  if (cfg.day) lines.push(`- The day of the week: **${cfg.day}**`);
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
  lines.push('');
  lines.push(`## WHO CONTROLS WHAT (this is the most common mistake — get it right)`);
  lines.push(`The PLAYER controls the world and the plot. THEY decide what happens, what they do, and — critically — WHO ENTERS THE SCENE. The player narrates the customer walking into the store, the passenger getting in the car or onto the bus, the Uber app pinging, the next call coming in, the time passing. That is THEIR job, not yours.`);
  lines.push(`You do NOT introduce new people, customers, passengers, events, or scene changes on your own — doing that is narration and it's exactly what you must stop doing. You are reactive: you only voice the characters who are ALREADY in the scene or who the PLAYER brings in. If the player says "a customer walks in", THEN you play that customer. If the player hasn't brought anyone in and isn't talking to anyone, it's fine to give a tiny reaction from an existing character, or even output almost nothing and wait — do NOT manufacture a new arrival or event to fill the space.`);
  lines.push(`Established characters (a partner, a coworker, the boss already present) can have their own personality and stir things up through their dialogue and actions — but they cannot teleport in new people or narrate the world.`);
  lines.push('');
  lines.push(`- Give every character a name and a distinct personality, voice, and attitude. They have their own agendas — they're not props.`);
  lines.push(`- React to whatever the player narrates. If nothing would naturally happen, have an existing character give a small, natural reaction or line — never fill the gap with narration or a new arrival.`);
  lines.push(`- Don't speak or act for the player's character, and don't resolve their actions for them. Let consequences land through how the characters respond.`);
  lines.push(`- Keep it tight — just the relevant characters' lines/actions. No walls of text.`);
  lines.push('');
  lines.push(`## TONE — AUTHENTIC & MATURE (profanity ON)`);
  lines.push(`This is a mature roleplay for an adult player who has explicitly asked for unfiltered, realistic dialogue. The characters are blue-collar workers, customers, crooks, and drivers — so they SWEAR. Use real profanity naturally and frequently where it fits: "shit", "fuck", "damn", "ass", "bastard", "hell", "piss", "dickhead", and the everyday insults and curses these people actually use. Don't censor it, don't asterisk it out (write "fuck", not "f***"), and don't water it down to "freaking" or "darn". Let them be crude, blunt, sarcastic, and rude when the moment calls for it — angry customers cuss you out, crewmates rip on each other, the boss chews someone out.`);
  lines.push(`Keep it grounded and in-character: profanity is flavor and emotion, not every other word for no reason. Match the player's intensity — heavier when things heat up, lighter in calm moments. Stay in character, no out-of-character disclaimers or apologies for language.`);

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
    lines.push(`PLAY "UBER" AS A CHARACTER: voice the Uber app/dispatch itself as its own presence — ride requests pinging in ("New trip — Jamal, 4.7★, 2 min away"), surge-pricing alerts, the passenger rating you after each ride, cancellation fees, support messages, and the app nagging about your acceptance rate. Treat the app like a bossy, robotic coworker riding the player all shift. (If they drive for a different company, voice that company's app/dispatch the same way.)`);
  }
  if (jobKey === 'busdriver') {
    lines.push('');
    lines.push(`## DRIVING THE BUS`);
    lines.push(`Play the passengers (or the school kids), other drivers, dispatch on the radio, and anyone at the stops. They react to the player's driving and how they run the route — pace, missed stops, fare disputes, rowdy riders. School-bus runs mean named kids with their own drama; city/MTA runs mean a rotating crowd, fare-dodgers, and dispatch barking about the schedule. The player narrates how they drive; you bring the riders and the road to life.`);
  }
  if (jobKey === 'pilot') {
    lines.push('');
    lines.push(`## FLYING THE DAY`);
    lines.push(`Play the co-pilot, the cabin crew, gate agents, ATC, dispatch, and passengers — everyone but the player. Keep cockpit chatter and radio calls reasonably authentic (callsigns, readbacks, checklists) without drowning the scene in jargon. The player flies/handles their role; you bring the crew and the airspace to life and let things go right or wrong (weather, delays, a sick passenger, a tight turnaround).`);
    const prole = (cfg.role || '').toLowerCase();
    if (prole.includes('attendant') || prole.includes('engineer')) {
      lines.push(`TODAY'S ARC: the player is cabin/crew, not flying. After they wake and head in, the day runs through the crew briefing, boarding, and the flight — driven by the player.`);
    } else if (prole.includes('co-pilot') || prole.includes('first officer') || prole.includes('copilot')) {
      lines.push(`TODAY'S ARC: the player is the CO-PILOT, so it's reversed — after the player wakes in their layover hotel, the CAPTAIN comes to pick THEM up. Let the captain show up once the player is ready to head out; don't rush it.`);
    } else {
      lines.push(`TODAY'S ARC: the player is the CAPTAIN. After they wake in their hotel, the day's first task is picking up their co-pilot (${cfg.copilot || 'their First Officer'}) from the co-pilot's hotel, then driving to the airport. Let the co-pilot appear when the player goes to get them — driven by the player.`);
    }
  }
  if (jobKey === 'police' || jobKey === 'firefighter') {
    lines.push('');
    lines.push(`## DISPATCH & CALLS`);
    lines.push(`You voice dispatch/the radio, the partner, fellow ${jobKey === 'police' ? 'officers, suspects, victims, and the public' : 'firefighters, EMS patients, and the public'} — as characters. Follow the WHO CONTROLS WHAT rule: the PLAYER decides when they take action, grab the radio, or roll on a call; you don't manufacture calls or emergencies as narration. Once the player engages a call, voice whoever's on the radio or on scene. Radio traffic is a character's line (e.g. \`Dispatch: "Unit 12, we've got a 10-31 in progress at..."\`), not narration.`);
  }

  lines.push('');
  lines.push(`## OPENING THE DAY (a day-in-the-life sim)`);
  const dayStr = cfg.day || 'this morning';
  if (jobKey === 'discord') {
    lines.push(`To open: the player just came online as a mod (it's ${dayStr}). Have a few members already mid-conversation in the chat (in \`Username: message\` form) — some normal, maybe one starting to push the rules — so the player walks into a live channel. Then wait for the player to type what they post.`);
  } else {
    lines.push(`The sim begins AT HOME with the player waking up — it's ${dayStr} morning and their alarm is going off. The VERY FIRST thing in your reply is the alarm itself, written as a tiny cue. This single short cue is the ONLY non-character text you are ever allowed to write — e.g. \`*BZZZT— BZZZT— ${dayStr}, 6:00 AM*\` or the phone screen buzzing on the nightstand. Keep it to one short line.`);
    lines.push(`Then STOP. Do not get the player out of bed, do not describe the room, do not skip ahead to work, do not introduce anyone. Let the player narrate waking up and starting their day. From the second message on, you are strictly character-only — and the player drives where the day goes (getting ready, the commute, arriving, etc.). Only voice people once the player's narration brings them into the scene (a spouse/roommate, then later coworkers, the partner, passengers, etc.).`);
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

    let sawText = false;
    let stopReason = null;

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        sawText = true;
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      } else if (event.type === 'message_delta' && event.delta && event.delta.stop_reason) {
        stopReason = event.delta.stop_reason;
      }
    }

    // The model returned a 200 but produced no visible text (e.g. a safety
    // refusal). Don't leave the user staring at an empty bubble — say so.
    if (!sawText) {
      const msg = stopReason === 'refusal'
        ? 'The model stopped this turn (safety filter). Try a different action, ease up on the intensity, or start a new shift.'
        : 'The model returned an empty response. Try sending that again or rephrasing.';
      res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
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
