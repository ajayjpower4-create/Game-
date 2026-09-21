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

- Game hub: <http://localhost:3000/> — lists every game
- Inspection Simulator: <http://localhost:3000/inspection>
- Election game: <http://localhost:3000/election>
- The original Swerve chatbot: <http://localhost:3000/chat>

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


---

# Inspection Simulator

Write a sixty-page home inspection report without writing sixty paragraphs. At
`/inspection`.

You type the address, the client, the company and the year built. Everything
else in the report is a click.

## Phone or computer

The start screen asks where you are working before anything else, and the pick
changes the layout (never the report). It guesses which one you are on from the
pointer type and window width, and the Menu switches at any time.

- **Phone** — one column, 44-48px tap targets, 16px inputs so iOS doesn't zoom
  on focus, the step rail collapses to a progress bar, menus open as full-screen
  sheets, the Information tables stack label-over-value, and a floating
  *+ Add defect* button follows you down the walkthrough.
- **Computer** — the wide layout: fields side by side, the defect menu on screen
  at once.

A window narrower than 720px gets the compact layout regardless of the pick, so
choosing "computer" on a phone can't strand you in a two-column form.

## How a report gets built

**1 · Intake.** Four screens of buttons and counters: house type, floors,
basement or slab, bedrooms, bathrooms, living rooms, kitchens, garage bays,
attic access, cladding, roof covering, heating, water heater, service amperage,
pipe materials, weather, occupancy, shutoff locations. Those answers fill the
Information table and the standing narrative of all sixteen report sections, and
they generate the room list a defect can be attached to (three bedrooms means
Master, Bedroom 2, Bedroom 3).

**2 · The walkthrough.** *Add defect* → pick the severity (Significant,
Marginal, Minor/FYI) → pick the section → pick the defect off the menu. The
report paragraph and the contractor recommendation come attached. Optionally
choose a location and type your own note; you don't have to type anything.
There are 247 defects in the menu across fourteen inspectable sections, filtered
by severity and searchable by keyword.

**3 · Anything not on the menu.** *Not on the menu…* takes a short title and a
sentence about what you saw, and Claude Sonnet writes the defect paragraph and
the recommendation in the same voice as the rest of the document — third person,
past tense, observation then consequence then recommended correction, no prices,
no guarantees.

**4 · Generate.** Claude summarizes the whole inspection into an overview and a
"what to address first" list, the findings get numbered the way an inspection
report numbers them (`10.1.2` = section ten, first item, second finding on that
item), and the document assembles: cover, table of contents, overview, summary
with a planning budget range, then every section with its Information table, its
standing narrative, and its numbered recommendations.

**5 · The score.** The game part. You are graded out of 100 on how many sections
you touched, how many findings you logged, how many carry a location, and how
many carry your own note — with the specific criticism spelled out ("2 findings
have no location attached").

Copy the report as text, download it as `.txt` or `.json`, or print it to PDF.
It autosaves to the browser on every click, and the Menu exports or imports a
save file.

Without `ANTHROPIC_API_KEY` set, both AI steps fall back to local text and the
report says so on screen — every screen still works offline.
`INSPECTION_MODEL` overrides the model (default `claude-sonnet-5`).

## Layout

| Path | What it is |
| --- | --- |
| `public/inspection/data.js` | The intake form, the sixteen sections, their Information blocks and standing narrative |
| `public/inspection/defects.js` | The defect menu — every canned write-up and recommendation |
| `public/inspection/report.js` | Numbering, summary, cost range, scoring, plain-text rendering. Pure functions |
| `public/inspection/game.js` | Screen flow, the defect picker, the rendered document |
| `server.js` | `POST /api/inspection/defect` (writes a custom defect) and `POST /api/inspection/summarize` (writes the overview) |

Nothing in this report is real. It is a simulator for practicing and drafting,
not a substitute for an inspection by a licensed inspector.

---

# Gridiron Control Center — Madden 26 franchise mod

A franchise control panel. Connect a franchise file, then script injuries onto
any game on the schedule and dig through the stat categories Madden does not
show you: advanced blocking, snap counts, targets and drops, missed sacks and
missed tackles, and penalties. Every category is its own tab.

Two ways to run it: in the browser at `/madden`, or as a Windows desktop app —
the user downloads the installer, opens the exe, connects their franchise file
and everything is there.

**What it is not:** this does not reach into a running copy of Madden and does
not read EA's encrypted save files directly. It works on a franchise *export*
(JSON or CSV) and writes an injury script file back out. Nothing is uploaded
anywhere — the whole thing runs on the machine it's installed on.

## The injury tool

Schedule & Injury Control is the schedule, week by week. Pick a game, hit
**Pick an injury**, and you choose three things:

1. **Who** — either roster, any healthy player, sorted by position.
2. **What** — sixteen injuries from Cramps up to a torn ACL, each with its own
   severity band and a typical number of weeks out.
3. **When** — a quarter, or leave it on Random.

You do *not* pick the play. The engine rolls it: a quarter, a game clock, a
drive number, a play number, a down and distance, and a description built out
of the injury and the player's position — `Q2 07:41 — 3rd & 8, drive 6, play
31: LT Nolan Hasselback goes down anchoring a bull rush. Hit on the outside of
the knee while the foot is stuck in the turf.` Don't like the play? **Roll a
different play** until you do, then **Script it**.

How long he's out comes from the injury type's window narrowed by the player's
durability rating, so the same torn ACL is a season for everybody but a high
ankle sprain is three weeks for one guy and six for another.

Scripted injuries sit on the game until it's played. Play the game and they
fire: the player is stamped OUT, he drops out of the snap counts and every
other stat page, and the play shows up in the injury log. Script one onto a
game that's already final and it fires immediately. **Export injury script**
writes `injury_script.json` — just the scripts, nothing else.

## The stat categories

| Tab | What's in it |
| --- | --- |
| **Advanced Blocking** | Pressures and sacks allowed per blocker, **almost sacks** (beaten clean, QB got it out anyway), hurries, blown blocks, pancakes, average time he keeps his man off the quarterback, and a win rate. Tiles at the top call out the best blocker, the one giving up the most pressure, the one holding them longest, and the pancake leader |
| **Snap Counts** | Who's actually on the field, split offense and defense, with a per-game average |
| **Targets & Drops** | Targets, catches, drops, drop rate, catch rate, yards, YAC, contested catches, TDs |
| **Missed Sacks & Tackles** | Pressures, sacks, **missed sacks** (had him dead and let him go), finish rate, QB hits, tackles, missed tackles, miss rate, TFL, PBU, INT |
| **Penalties** | Flags and yards per player, declined flags, yards per flag — and in a single game, every flag with its quarter, drive and penalty |
| **Injury Report** | Everything queued and everything that's already happened |

Every table sorts by any column. Every tab has a team picker and a scope
picker: season to date, or one specific game.

## Finding your saves

The desktop app opens on a **save list**, the way other Madden tools do, and
lists what it finds newest first with the top one tagged **Most recent**.

Guessing folder paths isn't enough, because with EA's cloud saves the copy on
disk usually isn't in the Madden folder at all. So there are two passes. The
quick one checks the obvious places — `Documents\\Madden NFL 26\\settings` and
the 25 and 24 folders, the same paths again under OneDrive, Downloads and
Desktop. Then a search runs behind it through the EA app's `CloudSyncCache`,
Origin's cloud folder, Steam's `userdata` mirror on every drive, and the Game
Pass `wgs` folder where saves are named as GUIDs — there it judges a file by
where it sits and how big it is rather than by its name. That search is bounded
by a clock, and **Search every drive** is the last resort when it still comes
up short. **Add a folder** points it somewhere specific and is remembered.

Madden names its franchise saves `CAREER-…` — `CAREER-SEP12-04h14m57p-AUTOSAVE`,
`CAREER-EE`, and so on — and those load for real: the app reads the save with
[`madden-franchise`](https://github.com/bep713/madden-franchise), the parser the
community franchise tools are built on, which covers Madden 19 through 27.

## What a real save actually holds

Every number the app shows off a `CAREER-…` file is a field in that file. What
Madden does not record, the app leaves out instead of inventing:

| Category | In the save |
| --- | --- |
| **Injuries** | `InjuryType` (123 real types, from `LegCramp` to `KneeACLCompleteTear`), `InjurySeverity`, `InjuryStatus`, `TotalInjuryDuration`, `IsInjuredReserve`, `LatestInjuryWeek` — all writable |
| **Schedule** | `SeasonGame`: week, home and away team, scores, status |
| **Blocking** | `OLINEPANCAKES`, `OLINESACKSALLOWED`, `GAMERATING`. No pressures, no almost-sacks, no time-held — Madden doesn't track them |
| **Snap counts** | `DOWNSPLAYED`, per player per season |
| **Catches and drops** | `RECEIVECATCHES`, `RECEIVEDROPS`, `RECEIVEYARDS`, `RECEIVEYARDSAFTER`. Targets aren't stored, so catches + drops is the floor |
| **Defense** | `DEFTACKLES`, `ASSDEFTACKLES`, `DEFTACKLESFORLOSS`, `DLINESACKS`, `CTHALLOWED`, `BIGHITS`, `DSECINTS`. Missed tackles and missed sacks are not in the file |
| **Penalties** | Team totals only (`TeamStats.PENALTIES`, `PENALTYYARDS`). Madden never records which player drew the flag |

## Teams, practice squads, and one schedule at a time

A franchise file carries far more "teams" than the 32 clubs: practice squads
(the `PRA` rows), free agency, the Pro Bowl, and template shells. They are told
apart by `TEAM_TYPE`, and only `Current` is a real NFL team — everything else is
filtered out of the team pickers and the schedule. The schedule itself keeps
`RegularSeason` and the four playoff rounds; preseason, Pro Bowl and offseason
weeks are dropped.

There is one team picker, in the top bar, and it drives the whole app: the
dashboard, every stat tab and the schedule all follow it. It only ever lists
real teams — a name that looks like a practice squad, free agency or the Pro
Bowl is dropped even when `TEAM_TYPE` cannot be read, so the picker can never
get stuck on one — and the app lands on a team with a full roster behind it.

The schedule follows that team: `vs`/`at` instead of both names, and W/L with
your score first. **The whole league** is one button away.

Each stat tab only lists the positions that belong in it, so a stray stat line
can never put a quarterback in the defensive table.

## The tracker

The app keeps its own record instead of leaning on Madden's season totals.

Madden writes a line for every player in every game — `GameOLineStats`,
`GameOffensiveStats`, `GameDefensiveStats`, each pointing back at the game it
belongs to — plus the team's own line for that game. Every time a save is
opened, the app reads all of it and folds it into a history file in its own
data folder, keyed by game and player. Open the same save twice and nothing
doubles. Madden ages old games out of the save; the tracker keeps them.

From those game lines it works out what Madden never writes down:

| Tracked | How |
| --- | --- |
| **Pass reps** | The offense's dropbacks (pass attempts + sacks taken, both real) times his share of the snaps |
| **Sack rate** | Sacks allowed ÷ pass reps |
| **Pancake rate** | Pancakes ÷ run reps |
| **Protection score** | 88 − sack rate × 350 + pancake credit (capped at 10) + (game grade − 70) ÷ 4 |
| **Thrown at** | Catches + drops — Madden stores both, but not targets |
| **Missed tackles** | The broken tackles the opposing ball carriers racked up that game — that total is exact — split across the defenders by (tackles × 2 + snaps ÷ 10) |
| **Penalties per game** | The team's own line, week by week, kept for every week the tracker has seen |

Every table says which columns came out of the file and which the tracker
worked out, and the formula is printed under the table. Nothing is a guess
dressed up as a stat.

## Injuring a player for real

Pick the team, the player and the injury, set the weeks out, and the app writes
`InjuryType`, `InjurySeverity`, `InjuryStatus`, `TotalInjuryDuration`, the
`Min`/`Max` duration and `LatestInjuryWeek` onto that player's record, then
saves the file. Before every write the save is copied to
`<name>.gcc-backup-<timestamp>` next to the original, so a mistake is never the
end of a franchise. Heal him and the same fields are cleared.

Close Madden before writing, and load the file in the game afterwards.

## Connecting a franchise file

The **Franchise File** tab (or the button in the top bar) takes a drop or a
file picker:

- **A Control Center save** — comes back whole: rosters, schedule, what's been
  played, scripted injuries, the log.
- **A franchise export** — JSON from a franchise exporter, in a few common
  shapes: `{ players: [...] }`, `{ teams: [{ abbr, roster: [...] }] }`, or a
  bare array. Field names are matched loosely, so `firstName`/`lastName` or
  `name`, `pos` or `position`, `ovr` or `overall` all read.
- **A CSV roster** — a header row plus a row per player.

See `samples/franchise-export-example.json` and `samples/roster-example.csv`.
Teams the file leaves thin get topped up with generated depth so the schedule
isn't full of ghost matchups; imported players always sit above filler on the
depth chart. The import tells you exactly what came across.

With no file connected it opens on a generated 32-team demo league, so it works
the second it launches.

## Why the desktop build needs a recent Electron

Madden 26 and 27 saves are zstd-compressed, and the parser decompresses them
with Node's own `zlib.zstdDecompressSync`, which only exists from **Node
22.15**. Electron 31 ships Node 20, where that function is simply absent — a
build on it cannot read a Madden 26 file at all. The desktop app is therefore
pinned to Electron 38 (Node 22.22), and it checks for zstd before opening a
file so a missing runtime says so in one line instead of surfacing as
`zstdDecompressSync is not a function`.


## Building the exe

```
cd desktop
./build.sh
```

That copies the UI in, installs Electron and electron-builder, and drops both
an NSIS installer and a portable single-file exe in `desktop/release/`. The
desktop build adds native Open/Save dialogs and a Franchise menu
(Ctrl+O connect, Ctrl+S save, export injury script); the page itself is the
same one the website serves.

## Saving

The browser build autosaves the whole franchise to `localStorage` after every
change, so closing the tab doesn't lose the week. **Save franchise** writes a
file you can move between machines or keep as a backup.

## How the numbers work

Nothing is stored per-play. A game's full box score is a pure function of the
franchise seed and the game id, so any game expands to the same numbers every
time it's opened, and season totals are just those games rolled up. Injured
players are pulled out of the units before a game is expanded, which is how a
scripted injury changes the stats that follow it.

## Layout

| Path | What it is |
| --- | --- |
| `public/madden/league.js` | Teams, roster generation, the schedule, the stat engine and season aggregation |
| `public/madden/injury.js` | Injury types, picking the play it happens on, scripting, firing, healing |
| `public/madden/franchise-file.js` | Importing franchise exports and CSVs, and the native save format |
| `public/madden/app.js` | The tabs, the tables, the injury tool |
| `desktop/main.js` | Electron window, Franchise menu, the save scanner and the Open/Save bridge |
| `desktop/build.sh` | Builds the Windows installer and portable exe |

This is a companion tool for a franchise you're already playing. It isn't
affiliated with EA, and team names are used the way any franchise tracker uses
them.
