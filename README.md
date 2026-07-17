# Harford Secondary School

A single-player, browser-based 3D school simulation. You pick any one of ~90 staff roles at a fictional London secondary school (986 AI-driven students, school day ends 15:30), build your character, and run the day — teach, take the register, hand out homework, chair meetings, search student records, or just wander the site.

Built with **Babylon.js** (rendering, physics/collisions, PBR lighting) and a small **Node/Express** backend that proxies NPC dialogue to the **Anthropic API** (`claude-sonnet-4-6`).

## Why Babylon.js (vs Three.js)

Both are excellent WebGL engines. Babylon.js was chosen because it is more *game-engine-shaped* out of the box:

- **Built-in collisions & gravity camera** — walkable interiors with no extra physics library.
- **First-class PBR pipeline** — physically based materials, environment lighting, ACES tonemapping, bloom/FXAA via `DefaultRenderingPipeline`, shadow generators — the "high-fidelity lighting" path is one API, not an assembly of add-ons.
- **Instancing & scene management** — hundreds of desks/chairs and pooled student characters stay cheap.
- Three.js has a larger ecosystem, but for a self-contained sim game with collisions, interiors and post-processing, Babylon needs far less glue code.

### A note on "photorealistic"

Everything you see is generated procedurally at runtime (brick, lino, wood, court markings, characters) so the repo ships with zero binary assets and loads instantly. That gets you PBR lighting, shadows, fog and tonemapping — but true photorealism comes from photo-scanned textures and rigged character models. The code is structured so you can drop in glTF buildings/characters and PBR texture sets later without touching game logic (`materials.js` and `characters.js` are the two seams).

## Running locally

```bash
npm install
ANTHROPIC_API_KEY=sk-ant-... npm start
# open http://localhost:3000
```

Without an API key the game still runs — NPCs fall back to canned lines and the start screen tells you AI is offline.

## Deploying on Render

1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, point it at the repo (it reads `render.yaml`), or create a **Web Service** manually with build `npm install`, start `node server.js`.
3. Set the `ANTHROPIC_API_KEY` environment variable in the Render dashboard.

## Controls

| Key | Action |
|---|---|
| WASD + mouse | Move / look (click canvas to capture mouse) |
| E | Sit at any desk/chair/meeting seat · use computer while seated |
| Q | Stand up |
| T | Talk — type a message to one person, the whole class, a meeting, or a group |
| G | Action menu (clap, point, stern look… NPCs react) |
| V | Third-person camera toggle |
| [ / ] | Slow down / speed up game time |
| Esc | Close panels / release mouse |

## The systems

- **Schedule** — Registration 08:40, five lessons, break 11:00, lunch 12:20, form time 15:00, school ends **15:30**. Edit `HSS.SCHEDULE` in `public/js/data.js`.
- **Sit system** — every chair, desk, meeting seat and bench is sittable. Sitting at a **teacher desk** unlocks the teacher computer (E); admin workstations open the administrator panel.
- **Teacher computer** — take attendance (register), create/assign homework and quizzes (with a hand-out cutscene). **Skipping the register** gets you a visit: the Head of Year / SLT walks in and confronts you — the game's one consequence.
- **Administrator panel** — search all 986 students, view/edit grades, add records, email staff (AI replies), contact parents (AI parent answers the phone).
- **Walk-up dialogue (T)** — targeted at the nearest person, the whole class, a meeting group, or the nearest few people. Students can raise hands (click the ✋). NPCs notice you walking away mid-conversation and react.
- **AI students** — all 986 have deterministic randomized profiles: SEN status, home life, behavioural tendencies (engagement/disruption/anxiety/sociability). These are injected into each NPC's system prompt server-side, so students respond in character to your tone and actions.

## Replacing the staff list

`data/staff.json` holds the ~90 named staff. Swap in your own file with entries shaped like:

```json
{ "id": "slt-01", "name": "…", "role": "…", "category": "SLT", "personality": "…", "department": "optional", "building": "main|staff|sen|gym" }
```

`category` drives outfits and default locations: `SLT`, `Year Team`, `SEN`, `Teacher`, `Admin`, `Catering`, `Site`, `IT`, `Support`.

## Architecture

```
server.js            Express: static hosting + /api/npc/dialogue + /api/npc/group
                     (Anthropic SDK, model claude-sonnet-4-6; per-NPC system prompts
                     built from profiles; structured JSON output for group scenes)
data/staff.json      ~90 playable staff roles
public/js/
  data.js            schedule, seeded RNG, 986-student generator, timetable
  materials.js       procedural PBR materials
  campus.js          4 buildings + interiors + furniture + outdoor courts
  characters.js      procedural character models + NPC behaviour
  ai.js              client for the dialogue API + offline fallbacks
  ui.js              HUD, dialogue, action menu, teacher PC, admin panel, cutscenes
  player.js          first/third-person controller, sit system, interactions
  main.js            engine boot, lighting pipeline, game loop, population manager
```
