# Madden 26 Franchise Control

## ⬇️ Download the exe

**[Download Madden26FranchiseControl-portable.exe](https://github.com/ajayjpower4-create/Game-/raw/claude/laughing-curie-g3tt2q/madden26-franchise-control/download/Madden26FranchiseControl-portable.exe)** (Windows 10/11, 64-bit, about 80 MB, no install needed)

The file is also in this repo at [`download/Madden26FranchiseControl-portable.exe`](download/Madden26FranchiseControl-portable.exe) (open it and press "Download raw file").

1. Download it and double-click it. It is not code-signed, so Windows SmartScreen will show a warning the first time: click **More info → Run anyway**.
2. Windows Firewall will ask to allow the app on private networks. Say **yes**, or the Madden Companion App on your phone cannot send your league to it.
3. The app opens. Go to **Connect**, click **Sign in with EA**, sign in, pick your franchise and click **Download**. (Or open your PC franchise file, or export from the Madden Companion App.)

A Windows desktop mod for **Madden NFL 26 franchise mode**. Connect your franchise and get the stats Madden never shows you, plus an injury tool that lets you decide who gets hurt in which game.

- **Sign in with EA** – sign in once with your EA account; the tool lists the franchises on it and downloads whichever one you pick, no phone needed.
- **Injury tool** – pick any game on the schedule, pick a player, pick the injury (ACL tear, high ankle sprain, broken collarbone… every injury the game has) or let it roll one. The tool picks the random play it happens on and writes the injury into your franchise file.
- **Weekly recap** – one page for the whole league each week: every score with both teams' records, the game of the week coming up, storylines (blowouts, nail-biters, upsets, comebacks, streaks, unbeaten and winless teams), players of the week, big performances, stat leaders, fantasy points, teams of the week, the plays and lowlights of the week, every injury, Madden's own league news stories, social posts and transactions (signings, releases, trades), power rankings with movement, the playoff picture, the standings by division, season leaders to date, advanced-stat notes and next week's games.
- **Teams** – a page for every team: record, place in the division, power ranking, streak and form, next and last game, starters' ratings by position group, where it ranks in the league on offense and defense, stat leaders, the full schedule with results and bye week, the roster by position with depth, contract and injuries, injury history, the team's news stories and transactions, and its cap.
- **Change the schedule** – swap who a team plays in any game that has not happened yet: pick the new opponent and the tool rearranges that week so every team still plays once and no bye week moves, then writes it into the PC franchise file (backup first, checked after writing, undo any time). You can also swap home and away.
- **Every injury in every game** – the Injuries tab lists everyone hurt in a game, including the small ones (out a couple of plays or quarters) that heal before the next week, how bad each one is, whether he will miss next week, whether he is still out, and where the tool found it. It also lists anyone else Madden dated to that week who has no stats in the game.
- **Box score** – every player's passing, rushing, receiving, defense, kicking, punting and return line, the team stat comparison, the score by quarter, and how each team got its points, checked against the final score.
- **Contracts & salary cap** – every contract in the league: cap hit, salary, prorated bonus, contract year, total value, per-year average, money still owed and the dead money a release would leave, each player's year-by-year deal, and each team's cap room, cap used, dead money, rollover, room next year, money already committed to future seasons and cap spent by position. Plus the biggest contracts, the best players on expiring deals, and the free-agent pool.
- **Copy as plain text** – every table has a **Copy** button, pages like the recap and highlights have **Copy as text**, and **Copy page** in the top bar copies whatever you are looking at. What lands on the clipboard is plain text with the columns lined up, no colours or formatting, ready to paste into Discord, a text message or a note. Selecting text and pressing Ctrl+C (or right-click → Copy) gives plain text too.
- **Highlights** – the biggest plays and the worst moments of every game, written out: "Daniel Jones finds Josh Downs for a 28-yard touchdown to win it", pick-sixes, sacks, comebacks, blown leads, drops, missed field goals, blown blocks. Click a game for its highlights, lowlights, key plays in order, scoring and player of the game, or see the plays of the week across the league.
- **Advanced blocking** – pressures, hurries, QB hits and sacks allowed by every blocker, almost-sacks, pancakes, run-block wins, how long each blocker holds his man off the QB, pass-block efficiency, pass, run and overall grades, the best blocker and the most beaten blocker, and who beat whom. See any single week, or the **week by week** grid that follows every blocker through the season with a trend arrow.
- **Matchup preview** – before you play a game, see every one-on-one up front: who each of your blockers lines up against, how often that rusher wins, the pressures and sacks he should give up, a risk rating, the best run lane, and game-plan tips for both sides of the ball (who to chip, when to go quick game, which blocker to attack with your best rusher).
- **Pass rush & missed sacks** – pressures, hits, hurries, sacks and the sacks each defender let get away.
- **Snap counts** – offense, defense and special teams for every player, every game.
- **Targets & drops** – targets, catches, drops, catch rate, drop rate, air yards, yards after catch, yards per target, and balls thrown away under pressure.
- **Missed tackles** – missed tackles and miss rate for every defender, split into misses on runs and misses after the catch.
- **Penalties** – flags and yards charged to each player, with the type of penalty.
- **Player game logs** – click any player's name for his game-by-game line across every category.

Everything is organised by category, by game, by team, by week and by season part (preseason / regular season / playoffs), with leaderboards. Every table exports to CSV.

## How it connects to your franchise

Madden 26 franchises live on EA's servers. There are three ways the tool gets at them:

| | Sign in with EA (easiest) | PC franchise file | Madden Companion App export |
|---|---|---|---|
| Works for | PlayStation, Xbox, PC | PC | PlayStation, Xbox, PC |
| What you do | Sign in once, pick the franchise, click Download | Open the CAREER file | Export from the phone app to the tool |
| Injury tool (writes to the save) | No | Yes | No |
| Snap counts | Reconstructed | Real, recorded by Madden | Reconstructed |
| Pancakes / sacks allowed per lineman | Reconstructed | Real, recorded by Madden | Reconstructed |
| Everything else | Yes | Yes | Yes |

**Sign in with EA:** on the Connect page click **Sign in with EA**. EA's own login page opens in a window; sign in with the EA account your Madden is on. The tool then does exactly what the Madden Companion App does when it exports: it lists every franchise on that account and downloads the one you pick (teams, standings, every week's schedule and stats, every roster) straight from EA. After each week you play, click **Update current week**. Your password is typed on EA's page only. The sign-in the tool keeps is sealed with the Windows keychain on your PC and is only ever sent to EA. If the account has Madden on more than one console, you pick which profile to use. Sign out any time.

> If it says EA's game servers are not accepting connections (a 503), the sign-in worked and the problem is on EA's side. EA takes these servers down for maintenance, and retires them for older Madden titles once a new one ships. The app tries every cluster name EA has used and retries before giving up, and it tells you which Madden years your account actually owns so you can switch years. On PC, opening the franchise file avoids EA entirely and gives you more.

> Worth knowing: EA publishes no official API for this, so the tool signs in as the Madden Companion App and reads only your own leagues, the same approach the open-source [Snallabot](https://github.com/snallabot/snallabot-service) Discord bot has used for years. It is unofficial, it is not endorsed by EA, and EA could change how it works at any time. It only ever reads; it never writes anything back to EA's servers. If you would rather not use an unofficial client, the Companion App export below does the same job with EA's own export button.

**PC:** Madden keeps a local copy of each franchise in `Documents\Madden NFL 26\settings` (the file is named `CAREER-<your league name>`). Open it in the tool. EA's cloud sync uploads it again the next time you save in game.

**Companion App export:** the **Madden Companion App** on your phone has an **Export** feature that sends the whole league to any address you type in. This program listens for that export too. Same Wi-Fi, type the address the tool shows you on the Connect page, export "All", done.

## Install

Use the download link at the top of this page. Run the exe, allow it through SmartScreen (*More info → Run anyway*) and Windows Firewall (private networks), and the app opens on the **Connect** page. The GitHub Actions workflow in this repository (`Build Windows exe`) rebuilds the portable exe and an installer from source whenever you want a fresh copy.

Nothing is sent anywhere. All data stays in the app's data folder on your PC (shown at the bottom of the sidebar), and every franchise-file write makes a timestamped backup next to the file in `franchise-control-backups`.

## Using the injury tool

1. **Schedule & Injury Tool** → pick the game → **Injure a player**.
2. Choose the team, then the player from that team's full roster (or press **Let the game pick** to hurt someone the way the game would: starters on the field a lot with low injury ratings are the likeliest), then the body part and the injury. Leave the weeks blank to get the game's normal range for that injury, or type the weeks yourself. Choose a side or let it be random. Tick IR if you want him on injured reserve.
3. **Preview** rolls the play it happens on (quarter, clock, down and distance, play type) and the exact weeks. **Re-roll play** if you want a different moment.
4. **Write into franchise file** puts it into the save right away (backup first). **Save for later** keeps it in the Injury Report so you can write it in after that game is played.

What the tool writes is exactly what Madden's own injury engine writes on a Player: injury status, type, severity, side, minimum / maximum / remaining weeks, the week it happened, the previously-injured flag and the IR flag. Madden's weekly injury evaluation then takes over: the player shows on the injury report, counts down, and returns (or can push to return early) like any other injury. Close out of the franchise in Madden before writing, then load it again.

Timing: if the game has already been played, the injury is dated to that game and he misses the weeks after it. If the game is still coming up, writing now means he sits out starting this week; to have him play in that game and get hurt in it, use *Save for later* and write it in right after the game.

## Where the numbers come from

Madden 26 records more than its menus show. Every per-game stat row in the save carries the player's **snap count**, offensive linemen carry **pancakes** and **sacks allowed**, and the game keeps its own per-game **injury list**. The tool reads all of that directly. Catches, drops, tackles, assists, broken tackles, sacks, team penalties and penalty yards are recorded too.

Madden does not record pressures, hurries, QB hits, targets, missed tackles, or which player a penalty was on. For those the tool **reconstructs** the number from what was recorded and the players' ratings: the team's dropbacks, its sacks allowed, the pass-block ratings of the line against the pass-rush ratings of the defenders, the broken tackles the offense was credited with, the team penalty total, and so on. The reconstruction is deterministic – the same game always gives the same numbers – and every value in the app is marked:

- **R** recorded by Madden
- **~** reconstructed by the tool
- **T** logged by you in the Game Tracker

### How the blocking model works

Every pass-rush rep is a one-on-one. Rushers line up where they do in the real game (a right end on the left tackle, a left end on the right tackle, tackles on the guards and center, blitzers picked up by backs and tight ends), and each rep is won with a probability set by the rusher's power moves against the blocker's pass-block power, and his finesse moves against the blocker's finesse, leaning on whichever edge is better. Each player also has a steady form of his own and a game-day swing, the quarterback's ability to slip sacks and throw under pressure changes how long the pocket has to hold, and defenses playing with a big lead rush harder.

The model then calibrates itself to your league. It solves for the setting that makes the average rep produce NFL-typical pressure (about 38 pressures per 100 dropbacks), takes the rate at which pressure became a sack from your league's own sack numbers, and measures run blocking against your league's own yards before contact. Madden's recorded sacks are always kept as they are, and so are its recorded sacks allowed per lineman, pancakes and snap counts. Pressures from a rusher nobody blocked are credited to the blitzer and charged to no blocker. Grades run 0-99 with 60 as average and are pulled toward average on small samples.

The matchup preview runs the same model forward, using only what was known before kickoff: the ratings, each player's form, and how he did in this league's earlier games compared with what the model expected of him.

### Injuries

Madden keeps injuries in two places in a franchise file: each game's post-game injury list, which in practice holds only some of the game's injuries, and the league injury report, which dates every injury to a week but drops a player the moment he heals. A Companion App or EA export has neither, only who is hurt when you export. So the tool keeps an injury ledger in its data folder: every time a league loads it writes down every injury it can see, and remembers it after the player heals. A game's injury list is then everything from all of those, each line saying where it came from. For an export, an injury that first shows up in the export after a game is listed with that game (the first export of a league can only show who was already hurt, so export after every game). Injury types and severities sent as Madden's enum numbers are decoded with the game's own tables.

### Highlights from an export

A Companion App or EA export has no play-by-play, but it records each player's longest play, which is enough to rebuild several real plays exactly: a quarterback's longest completion is matched to the one teammate whose longest catch has the same yards (only when no other passer could have thrown it), a catch or run is called a touchdown only when the numbers force it (every catch he made scored, or his only carry did), a defensive touchdown with an interception and no fumble recovery is a pick-six, and a kicker's lone or longest field goal is exact. These show as REAL PLAY. Checked against the real play-by-play in a franchise file, every touchdown this method claims was right.

### Weekly recap

Scores, records, standings, stat leaders, injuries, news stories, social posts and transactions all come straight from what Madden saved: the scoreboard, the recorded box scores, each game's own injury list, Madden's injury report (with the week each injury happened), and the league news and transaction log in the franchise file. Records and standings are counted from the game results; divisions are the NFL's. The recap only says a game went to overtime when the play-by-play shows a fifth quarter, and only calls a result an upset when the loser's Madden team rating was at least 4 points higher. Players of the week are picked by the tool from the recorded box scores, and the advanced-stat notes come from the tool's reconstructed stats; both say so on the page. A Companion App export has no news feed or dated injuries, so its recap shows the current injury report instead.

### Contracts and the salary cap

Madden stores every contract year by year: the salary and the prorated signing bonus for each season, and the cap hit it carries this season. The tool reads those as they are (Madden keeps money in units of $10,000). Each team's cap room, dead money this year and next, rollover and next year's room are also stored. The league salary cap itself is not stored as a plain number, so the tool solves it from the teams' cap room and shows it only when the teams agree (it comes out at $279.2M for 2025, the real NFL figure). "Dead money if cut" is the signing bonus still to be counted, which is what a release accelerates onto the cap. A Companion App export carries one salary, one bonus, the cap hit and the release numbers per contract, so those leagues show that instead of the year-by-year breakdown.

### Highlights

A PC franchise file keeps a play-by-play of every game (the scoring plays, sacks, interceptions and fumble recoveries with the quarter and clock) and a scoreboard after every score. The tool rebuilds the running score from it, including extra points and two-point tries, so it knows which touchdown tied it, which took the lead and which won it. Box-score moments (300-yard passers, 100-yard rushers, drops, missed field goals, shutouts), the tool's own reconstructed stats (blown blocks, missed tackles, penalties) and the injury report add the rest. A league from the Companion App or the EA sign-in has box scores but no play-by-play, so it gets box-score moments without clock times.

### Game Tracker

The **Game Tracker** is how you make the reconstructed categories real. While you play (or from a replay), log the pressures, sacks and the blocker who got beat, pancakes, targets and drops, missed tackles, penalties with their yards, and real snap counts. Whatever you log for a team in a game replaces the reconstruction for that category.

## Changing the schedule

On any game that has not been played (Schedule page, a team's schedule, or the game itself), click **Change matchup**. Pick whose game you are changing and the new opponent. The new opponent leaves the game he had that week and your old opponent takes his place in it, so the week still has every team playing exactly once and nobody's bye moves; a team on its bye that week cannot be picked. The tool shows exactly which two games change, and points out lost division games and teams that would meet more than once. Writing it changes only the two games' home and away teams in the save (a backup is made first, and the file is read back to confirm; if it does not read back right, the backup is put back). Every change is listed on the Schedule page with an **Undo**. Played games and weeks already gone by cannot be changed, and Companion App / EA leagues live on EA's servers and cannot be edited. Close the franchise in Madden before writing, then load it again.

## Settings

Settings has a look-and-feel section: dark, light or high-contrast theme, accent color, text size, compact tables, showing or hiding the R / ~ / T source letters, and sticky table headers. You can pick the page the app opens on, the season part it shows first, and your team in each league (highlighted in every table, and optionally the default filter). Copy can put plain lined-up text, a Discord code block, or tab-separated columns for Excel and Google Sheets on the clipboard, and money can show as $36.33M or $36,330,000. It also covers the pages: which tab a played game opens on, how many names each leaderboard shows, and which pages appear in the sidebar. For the franchise file you can have the tool reload the file by itself whenever Madden saves it, choose whether it asks before every write, keep only the last 5 / 10 / 20 / 50 backups, and restore any backup with one click (the current file is backed up first). Under your data you can save a copy of everything the tool keeps for a league (Game Tracker events, injuries you made, injury history, schedule changes), clear the injury history or the Game Tracker, or reset every setting. Everything saves to the data folder and applies immediately.

## Running from source

```bash
cd madden26-franchise-control
npm install
npm start          # desktop app
npm run serve      # or: just the local server, open http://localhost:3826
npm test           # unit tests (plus a real-file test when a Madden 26 save is available)
npm run dist:win   # build the Windows installer + portable exe into dist/
```

Set `M26_TEST_FILE=<path to a CAREER file>` to run the franchise-file test against your own save.

Franchise file reading and writing uses the open-source [madden-franchise](https://github.com/bep713/madden-franchise) library (the same engine behind the Madden Franchise Editor). Schemas for Madden 26 are bundled; if a future title update changes the save format, point Settings → schema folder at a newer schema.

## Layout

```
electron/        desktop shell (window, file dialogs)
src/server/      local API + Companion App export receiver
src/core/franchise/   franchise-file reader, injury catalog, injury writer
src/core/companion/   Companion App export normaliser
src/core/ea/          EA account sign-in, game-server client and league download
src/core/stats/       blocking, matchup preview, highlights, real plays from exports, box score, weekly recap, power rankings and playoff picture, snaps, receiving, tackling, penalties, aggregation
src/core/contracts.js contracts and salary cap
src/core/teams.js     everything about one team
src/core/franchise/schedule.js  planning schedule changes
src/core/injuries/    per-game injury report and the injury ledger
src/core/tracker/     Game Tracker events and overrides
ui/              the app's pages
schemas/         extra Madden 26 franchise schemas
tests/           node --test suite
```
