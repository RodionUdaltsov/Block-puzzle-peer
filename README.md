# Block Puzzle

Online multiplayer is **server-authoritative** over WebSocket (`MatchClient` ↔ `server.js`).

## Run
```bash
node server.js
```
Open http://localhost:9000

Windows: `start-server.bat`

## Features
Ranked · private rooms · authoritative moves · rejoin · forfeit · AFK/disconnect · rematch · friends

## Online smoothness
- Soft differential renders on place/sync (no full DOM wipe).
- Local hand not rebuilt while dragging.
- Sync every 6s, skipped while dragging; client throttle.
- softRenderGrid fully clears cell styles (fixes stuck squares after line clear until next place).
- place_ok forces board soft-sync so cleared cells never linger.
- Classic intro 1200ms → 450ms.
