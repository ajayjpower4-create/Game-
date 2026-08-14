# Games

Two simulation games and a chatbot, served by one small Express app.

| Path | What it is |
| --- | --- |
| `/` and `/nfl/` | **NFL Franchise Simulator** — run a franchise day by day |
| `/election/` | **Political Election Simulator** — run a campaign, call the race |
| `/chat/` | The original Swerve chatbot — only opens if you go looking for it |

## Running it

```bash
npm install
npm start
```

Both games work with **no API key at all** — each one has its own local writer
and falls back to it automatically, and the server boots fine without a key.
Set one if you want the AI-written content:

```bash
ANTHROPIC_API_KEY=sk-ant-... npm start
```

Model overrides: `NFL_MEDIA_MODEL` (default `claude-sonnet-5`),
`ELECTION_MODEL` (default `claude-opus-4-6`). The port comes from `PORT`,
so it deploys to Render as-is.

---

# NFL Franchise Simulator

Take over any of the 32 teams and run the building: pick the practice every
day, decide who got hurt and who did not show up, set the game-day lineup,
call the final score, and write the plays that decided it. The league writes
about you afterwards.

Nothing here is real news. Ratings are this game's own estimates, every roster
is editable, and every quote, headline and result the game produces is
invented for play.

## Getting started

**1 · Pick a team.** All 32, by division. Each one carries a hand-written core
of real players with sim ratings at every position, filled out to a 53-man
roster with generated depth.

**2 · Edit the roster.** Rename anybody, re-rate anybody, change the ages —
contracts re-price themselves as you go. Names stay editable later from the
Team Settings tab.

**3 · Build the schedule.** Three preseason weeks and a 17-game regular season
across 18 weeks, built on the real rotation formula: six division games home
and away, a division block in conference, a division block out of conference,
same-place finishers, and one cross-conference 17th game. Everybody gets one
bye between weeks 5 and 14 and 8 or 9 home dates. Reshuffle until you like it.

**4 · Choose where to start.** Preseason week 1 for camp, joint practices and
three weeks of tape — or jump straight to regular season week 1 and start with
no preseason data at all.

## The six tabs

**Dashboard** — record, next opponent, team rating, cap space, the week's day
strip, injury report, division table and the latest media.

**Media** — issue a statement as the general manager, the head coach, the
owner, a player, an agent, team PR or anybody else you name, and it goes on the
record. Post as the press too — ESPN, NFL Network, The Athletic, a beat writer,
radio, a podcast — with your own headline and story. Then let the league media
write back: it reacts to your actual week (the score, the plays you wrote, the
practice report, who is hurt, what you said) with headlines, columns, insider
notes and hot takes. Auto-generation after games and practices is a toggle.

**Team Settings** — the full roster with ratings, ages, contracts, sharpness
and morale; editable names inline; player cards; the depth chart; the injury
list; contracts with extend and restructure; a free agent pool; and a trade
machine that values players and draft picks and tells you whether the other
GM hangs up.

**Practice** — pick what you actually did today: walkthrough, install, full
pads, red zone, a joint practice, special teams, conditioning or a rest day.
Add who got hurt (and for how long), who did not show up and why, and the big
plays from team period. Consequences are real: sharpness, fatigue, morale,
young players developing, injured players rehabbing back. Then advance the day.

**Game Day** — lineup presets (full go, starters a half, one series, backups
only, rest the veterans, no rookies), offensive and defensive plans, manual
inactives, injuries in the game, and the score, which you call. "Suggest a
score" simulates one if you would rather. Log the plays that decided it with
quarter, clock and unit — *60 seconds left in the game, Patrick Mahomes throws
a 40-yard pass downfield and it is intercepted by Nate Wiggins for a pick six.*
Finalizing builds a box score around your score, plays out the rest of the
league's week and sends the whole thing to the media.

**League** — every week's scoreboard for all 32 teams, standings by division,
the playoff picture by conference seed, and your season at a glance.

At the end of week 18 the season closes out with final standings and seeding,
and you can open next year's camp: everybody ages, ratings move, expiring
deals get re-signed and a fresh schedule gets built.

## Saving

Autosaves to your browser on every action and keeps the last eight
checkpoints. The Menu button exports a save file, imports one back, restores a
checkpoint, or wipes everything.

## Layout

| File | What it is |
| --- | --- |
| `public/nfl/data.js` | All 32 teams, the real-player cores with ratings, practice types, injuries, schemes, cap constants |
| `public/nfl/sim.js` | Rosters, the schedule builder, team strength, game sim, practice effects, box scores, trade values, the local media writer — pure functions, shared with the server |
| `public/nfl/game.js` | Screens, the six tabs, the save system |
| `public/nfl/style.css` | Styles |
| `server.js` | Static hosting plus `POST /api/nfl/media`, which prompts Claude Sonnet and validates what comes back |

---

# Political Election Simulator

Pick any two people — famous or invented — run them through a three-month
campaign, then either rig the map yourself or let Claude Opus call the race.

Everything in it is fiction. The results are invented for play: not a poll, not
a forecast, and not a claim about any real person or real election.

## How a game runs

**1 · Draft your candidates.** Pick from the roster of famous names and the
game already knows their name recognition and where the public places them —
no description needed. Choose "someone I made up" instead and you write them
into existence: the description drives how well they poll, so words like
*veteran*, *billionaire*, *activist* or *conservative* actually move numbers.
Each candidate gets a party name and a colour, and you set election day (the
campaign window is the 90 days before it).

**2 · Three months of rallies.** Book each candidate into states across the
window. Where they go moves those states, spills over into the region, and
late rallies hit harder than early ones. "Auto-schedule 8 stops" spreads a
tour across the biggest prizes if you'd rather not click 16 times. Three
rallies each is the minimum to move on.

**3 · The message.** The line they close on, the stump speech behind every
rally, and up to five themes they hammer. Themes decide which states warm to
them — and more than three starts to blur the message.

**4 · Election day.** Two ways to finish:

- **Rig it.** Click through all 51 contests yourself (click once for candidate
  A, again for B, again to clear), then set the final vote totals. The game
  shows what your map *should* be worth — a projection with a plausible range
  for each candidate, based on real turnout baselines per state — and flags it
  when your popular-vote winner isn't your Electoral College winner.
- **Simulate it.** The whole campaign goes to Claude Opus, which calls all 51
  contests and the national popular vote and writes up what happened. State
  margins come from the local model so the returns look like returns.

**5 · The recap.** Winner, Electoral College and popular vote, the full map,
how it happened, both campaigns side by side with every rally they held, the
closest calls, the biggest blowouts and a full state-by-state table. Download
it as JSON, copy it as text, or print it.

## Saving

The game autosaves to your browser on every step and keeps the last eight
checkpoints, so a crash costs you at most the step you were in the middle of.
The Menu button reloads a checkpoint, exports a save file, imports one back, or
wipes everything.

## Layout

| Path | What it is |
| --- | --- |
| `public/election/data.js` | States (electoral votes, turnout, cultural lean, map position), themes, the famous roster |
| `public/election/sim.js` | The local election model — scoring, vote distribution, narrative. Pure functions, shared with the server |
| `public/election/game.js` | Screen flow, save system, all rendering |
| `public/election/style.css` | Styles |
| `server.js` | Static hosting plus `POST /api/election/simulate`, which prompts Claude and validates what comes back |

The map is a grid cartogram: one tile per state placed roughly where it sits on
a US map, sized the same regardless of area, so Rhode Island is as clickable as
Texas. All 538 electoral votes are the 2024–2030 apportionment.
