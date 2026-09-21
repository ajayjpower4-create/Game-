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
- **Advanced blocking** – pressures, hurries, QB hits and sacks allowed by every blocker, almost-sacks, pancakes, how long each blocker holds his man off the QB, pass-block efficiency, a blocking grade, the best blocker and the most beaten blocker, and who beat whom.
- **Pass rush & missed sacks** – pressures, hits, hurries, sacks and the sacks each defender let get away.
- **Snap counts** – offense, defense and special teams for every player, every game.
- **Targets & drops** – targets, catches, drops, catch rate, drop rate, yards per target.
- **Missed tackles** – missed tackles and miss rate for every defender.
- **Penalties** – flags and yards charged to each player, with the type of penalty.

Everything is organised by category, by game, by team and by season part (preseason / regular season / playoffs), with leaderboards.

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
2. Choose the team, the player, the body part and the injury. Leave the weeks blank to get the game's normal range for that injury, or type the weeks yourself. Choose a side or let it be random. Tick IR if you want him on injured reserve.
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

The **Game Tracker** is how you make the reconstructed categories real. While you play (or from a replay), log the pressures, sacks and the blocker who got beat, pancakes, targets and drops, missed tackles, penalties with their yards, and real snap counts. Whatever you log for a team in a game replaces the reconstruction for that category.

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
src/core/stats/       blocking, snaps, receiving, tackling, penalties, aggregation
src/core/tracker/     Game Tracker events and overrides
ui/              the app's pages
schemas/         extra Madden 26 franchise schemas
tests/           node --test suite
```
