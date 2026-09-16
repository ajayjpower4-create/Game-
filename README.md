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

**1 · Draft your tickets.** Each side is a candidate *and* a running mate.
Pick from the roster of famous names and the game already knows their name
recognition, where the public places them, and which state they're from — no
description needed. Choose "someone I made up" instead and you write them into
existence: the description drives how well they poll, so words like *veteran*,
*billionaire*, *activist* or *conservative* actually move numbers. Each ticket
gets a party name and a colour, and you set election day (the campaign window
is the 90 days before it).

Your running mate is a real decision, not a formality:

- **Name recognition.** Theirs blends into the ticket's, so a famous VP lifts an
  unknown at the top.
- **A second home state.** Both halves of the ticket carry a home-state
  advantage — worth about six points of margin for the candidate, less for the
  running mate, plus a little warmth across the running mate's region.
- **Balance.** A running mate who reaches across the divide widens the coalition;
  a near-clone of yourself adds nothing, and a wildly mismatched pair reads as
  incoherent. The bonus peaks in between, and the game tells you where you are.
- **A second body on the trail.** They can hold their own rallies, in a different
  state on the same day. They draw a smaller crowd than the top of the ticket.

**2 · Three months of rallies.** Book each half of the ticket into states across
the window. Where they go moves those states, spills over into the region, and
late rallies hit harder than early ones. A toggle picks who's on stage.
"Auto-schedule" spreads a tour across the biggest prizes and opens each person
in their own home state, if you'd rather not click twenty-four times. Three
rallies per ticket is the minimum to move on.

**3 · The message.** The line they close on, the stump speech behind every
rally, and up to five themes they hammer. Themes decide which states warm to
them — and more than three starts to blur the message.

**4 · Election day.** Two ways to finish:

- **Rig it.** Click through all 51 contests yourself (click once for ticket A,
  again for B, again to clear), then set the final vote totals. The game shows
  what your map *should* be worth — a projection with a plausible range for each
  ticket, based on real turnout baselines per state — tracks whether each home
  state is still held, and flags it when your popular-vote winner isn't your
  Electoral College winner.
- **Simulate it.** The whole campaign goes to Claude Opus, which calls all 51
  contests and the national popular vote and writes up what happened. State
  margins come from the local model so the returns look like returns.

**5 · The recap.** President-elect and Vice President-elect, Electoral College
and popular vote, the full map, how it happened, both campaigns side by side
with every rally and who spoke at it, whether each ticket held its home states,
the closest calls, the biggest blowouts and a full state-by-state table.
Download it as JSON, copy it as text, or print it.

## Saving

The game autosaves to your browser on every step and keeps the last eight
checkpoints, so a crash costs you at most the step you were in the middle of.
The Menu button reloads a checkpoint, exports a save file, imports one back, or
wipes everything.

## Layout

| Path | What it is |
| --- | --- |
| `public/election/data.js` | States (electoral votes, turnout, cultural lean, region), themes, the famous roster and their home states |
| `public/election/us-map.js` | Generated: real state outlines as SVG paths, plus where each label sits |
| `public/election/sim.js` | The local election model — ticket ratings, home-state advantage, scoring, vote distribution, narrative. Pure functions, shared with the server |
| `public/election/game.js` | Screen flow, save system, the map renderer, all rendering |
| `public/election/style.css` | Styles |
| `tools/build-map.mjs` | One-off generator for `us-map.js` (see below) |
| `server.js` | Routing plus `POST /api/election/simulate`, which prompts Claude and validates what comes back |

### The map

Real state outlines, from the US Census cartographic boundaries shipped in
[us-atlas](https://github.com/topojson/us-atlas), already projected with Albers
USA so Alaska and Hawaii sit in their insets. The whole country is 28 KB of SVG
path data with no projection library at runtime.

States too small to write inside — Rhode Island, DC, Delaware, Maryland, New
Jersey, Connecticut, Massachusetts, New Hampshire, Vermont — get a label outside
the map on a leader line, which is also a generous click target for a state
that's four pixels wide. Every other label is placed at the most interior point
of its state rather than its centroid, so Michigan and Florida don't get labelled
in the water. On results, a close state is shaded paler than a safe one.

To regenerate the map data (only needed if the outlines or detail level change):

```bash
npm i --no-save us-atlas topojson-client topojson-simplify d3-geo playwright
node tools/build-map.mjs 0.22    # fraction of detail retained
```

The generator reads the topology, simplifies it (shared borders stay aligned,
since it simplifies the topology rather than each state), drops the sub-pixel
island slivers that leaves behind, and finds each label anchor using the
browser's own SVG hit-testing. All 538 electoral votes are the 2024–2030
apportionment.


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
