# Political Election Simulator

Pick any two people — famous or invented — run them through a three-month
campaign, then either rig the map yourself or let Claude Opus call the race.

Everything in it is fiction. The results are invented for play: not a poll, not
a forecast, and not a claim about any real person or real election.

## Running it

```bash
npm install
npm start
```

- Game: <http://localhost:3000/> (also at `/election/`)
- The original Swerve chatbot moved to <http://localhost:3000/chat>

Set `ANTHROPIC_API_KEY` before starting if you want Claude to call the
election. Without a key the game falls back to its own built-in model and says
so on the results screen — every screen still works offline.

```bash
ANTHROPIC_API_KEY=sk-ant-... npm start
```

`ELECTION_MODEL` overrides the model (default `claude-opus-4-6`).

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
| `server.js` | Routing (game at `/`, chatbot at `/chat`) plus `POST /api/election/simulate`, which prompts Claude and validates what comes back |

The map is a grid cartogram: one tile per state placed roughly where it sits on
a US map, sized the same regardless of area, so Rhode Island is as clickable as
Texas. All 538 electoral votes are the 2024–2030 apportionment.
