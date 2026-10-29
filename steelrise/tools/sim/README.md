# Offline smoke test

A small mock of the Roblox engine (Lua 5.4 via `lupa`) that runs the real
STEELRISE scripts outside Studio. It catches Lua errors, bad property types
and broken game flow; it does not render, simulate physics or prove that the
engine accepts every call.

```bash
pip install lupa
python3 tools/sim/run.py . server   # boots the server, loads all 8 sites, save/continue, delivery, crane, carry
python3 tools/sim/run.py . client   # loading screen -> menu -> click PLAY -> in-game keys
```
