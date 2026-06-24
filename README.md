# Couch — Therapy Session Simulator

The AI plays **both partners of a couple** (powered by Claude Opus 4.8). **You are the therapist.**

- Paste the couple's details (life, conflict, how they react) into the **Couple Profile** box.
- Talk to them like their counselor.
- Use `(` commands:
  - `(start` — begin the session
  - `(end` — end the session
  - `(next` — jump to next week's session
  - `(help` — show the commands

## Easiest way to run it (no terminal) — deploy on Render

1. Go to **https://render.com** and sign up with your **GitHub** account.
2. Click **New +** → **Blueprint**.
3. Pick this repository (`Game-`) and the branch `claude/therapy-session-simulator-kssNi`.
4. Render reads `render.yaml` automatically. When it asks, paste your Anthropic API key
   into the **ANTHROPIC_API_KEY** field.
   - Get a key at **https://console.anthropic.com** → **API Keys**.
5. Click **Apply / Deploy**. After a minute or two you get a public URL like
   `https://couch-therapy-simulator.onrender.com`.
6. Open that URL on your computer **or your phone** — it works anywhere.

## Run it locally (optional, needs Node.js 18+)

```bash
npm install
# create a file named .env containing:
# ANTHROPIC_API_KEY=sk-ant-...
npm start
```

Then open http://localhost:3000
