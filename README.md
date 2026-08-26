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
- Court Simulator: <http://localhost:3000/court>
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

# Court Simulator

Run a whole trial as a chat. At `/court`. You play anybody in the room — the
judge, the defendant, a lawyer, the bailiff, a witness — and Claude Sonnet plays
everyone you don't.

Everything in it is fiction: not a real case, not a real person, not legal
advice.

## Phone or computer

The first screen asks. The pick only changes the layout, and the Menu switches
it at any time. Phone gets one column, big tap targets and a composer pinned to
the bottom where Enter is a new line; computer gets the wider transcript and
Enter to send, Shift+Enter for a new line. A window under 760px is compact
either way, so picking "computer" on a phone can't strand you.

## Setting a case up

**1 · The case.** Criminal or civil, the docket number, the court, who is
charging or suing whom, the charge, and a few lines of background both sides
will fight over. Blank fields get filled in with something plausible, and
*Invent a case for me* drafts the whole sheet.

**2 · Who you are.** Pick a role — or pick two and play both at once. Anything
not on the list you can type in. Then name your character and describe them; the
room treats what you write as true, so a public defender four cases behind gets
a different trial than a name partner.

**3 · Everybody else.** Write the rest of the room yourself, or leave them blank
and *Claude writes the blanks* fills in names and two lines of substance each.
Add extras — an expert witness, the lead detective, a reporter in the gallery,
the defendant's mother.

**4 · Who decides.** A jury (you set how many) or the judge from the bench.

## In the trial

Type what your character says. Actions go in asterisks — `*I walk over to the
prosecutor and grab the papers.*` — and a row of one-tap objections and stock
lines sits under the composer. Claude answers as the rest of the room: the
gavel, the objection, the witness who doesn't want to answer.

**Switching character.** *Cast* lists everyone. Take a character over and Claude
stops playing them mid-sentence; hand one of yours back and it picks them up.
Bring somebody new through the doors, or walk someone out. When you play more
than one, a dropdown above the composer picks which of them is speaking, or
*Several of mine at once* lets you write them all in one line.

**Evidence.** Claude never invents what your side is holding. When one of its
characters needs an exhibit, a record or a document off you, the trial stops and
a popup asks whether you have it — with an option to answer in your own words.
Whatever you say becomes true for the rest of the trial, including not having
it.

**The verdict.** *Deliver the verdict* is yours to write: who wins, or a hung
jury, or a split across the counts; the exact words the foreperson or the judge
reads out; the sentence or the damages; how the room takes it. Claude plays the
reading and everything after it, and can't contradict what you decided.

The Menu copies the transcript out, edits the case sheet mid-trial, or throws
the case out and starts a new one. It autosaves to the browser after every line.

`ANTHROPIC_API_KEY` is required — with no key the room stays empty and says so.
`COURT_MODEL` overrides the model (default `claude-sonnet-5`).

## Layout

| Path | What it is |
| --- | --- |
| `public/court/data.js` | The roles, which ones exist in a criminal vs a civil case, and the quick lines |
| `public/court/game.js` | Setup wizard, the courtroom, streaming, the evidence popup, the verdict form |
| `public/court/style.css` | Styles |
| `server.js` | `POST /api/court/chat` (streams the room), `/api/court/cast` (writes characters), `/api/court/case` (invents a case) |
