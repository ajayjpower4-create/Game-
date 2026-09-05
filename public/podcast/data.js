// Static tables for the Sports Podcast Simulator. Nothing here is a stat —
// the only stats in the game are the ones the player pastes in themselves.

export const TEAMS = [
  'Arizona Cardinals', 'Atlanta Falcons', 'Baltimore Ravens', 'Buffalo Bills',
  'Carolina Panthers', 'Chicago Bears', 'Cincinnati Bengals', 'Cleveland Browns',
  'Dallas Cowboys', 'Denver Broncos', 'Detroit Lions', 'Green Bay Packers',
  'Houston Texans', 'Indianapolis Colts', 'Jacksonville Jaguars', 'Kansas City Chiefs',
  'Las Vegas Raiders', 'Los Angeles Chargers', 'Los Angeles Rams', 'Miami Dolphins',
  'Minnesota Vikings', 'New England Patriots', 'New Orleans Saints', 'New York Giants',
  'New York Jets', 'Philadelphia Eagles', 'Pittsburgh Steelers', 'San Francisco 49ers',
  'Seattle Seahawks', 'Tampa Bay Buccaneers', 'Tennessee Titans', 'Washington Commanders',
];

// Co-host archetypes. Each one gets a stance assigned at draft time — the game
// guarantees exactly one of them is on the player's side.
export const HOSTS = [
  { name: 'Big Ray', persona: 'ex-offensive lineman, loud, laughs at his own jokes, calls everybody "brother", argues with his gut before he argues with numbers' },
  { name: 'Deuce', persona: 'former corner who played six years, thinks every argument comes down to film, gets personal fast when someone doubts him' },
  { name: 'Marisol', persona: 'beat writer turned host, lives in the box score, will read a number back at you three times until you deal with it' },
  { name: 'Petey', persona: 'lifelong degenerate bettor, frames everything as a line or a win total, superstitious, panics early and often' },
  { name: 'Coach Dunn', persona: 'retired high school coach, old school, hates gadget plays and anyone who misses a tackle, lectures' },
  { name: 'Trell', persona: 'young, extremely online, speaks in takes, loves a rebuild, will say something insane and then defend it for ten minutes' },
  { name: 'Sully', persona: 'call-in-show lifer with a doomsday streak, has watched this franchise break his heart for thirty years' },
  { name: 'Kiah', persona: 'fantasy analyst, cares about volume and touches over vibes, dry, cutting, dunks on bad process' },
  { name: 'Vic', persona: 'salary cap and roster nerd, talks contracts, dead money and 53-man math, unemotional to the point of being rude' },
  { name: 'Duke', persona: 'former special teams captain, obsessed with the guys nobody talks about, takes disrespect personally' },
];

export const TOPICS = [
  'Record prediction',
  'Who gets cut',
  'Who should make the 53',
  'The QB situation',
  'Best player in camp',
  'Biggest disappointment',
  'The offensive line',
  'Defense outlook',
  'Rookie class',
  'The coaching staff',
  'Playoffs or not',
  'Trade or sign somebody',
  'Injuries and depth',
  'Special teams',
  'Fan overreactions',
];

export const SEGMENT_LABEL = {
  open: 'Cold open',
  talk: 'On the air',
  close: 'Outro',
};
