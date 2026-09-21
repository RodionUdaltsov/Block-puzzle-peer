# Block Puzzle

Online multiplayer is **server-authoritative** over WebSocket (`MatchClient` ↔ `server.js`).

Game rules (shapes, place, clear, score, deal) live in **`shared/rules.js`** — one source for server and client.

## Run
```bash
node server.js
```
Open http://localhost:9000

Windows: `start-server.bat`

Docker:
```bash
docker build -t block-puzzle .
docker run -p 9000:9000 block-puzzle
```

## Features
Ranked · private rooms · authoritative moves · rejoin · forfeit · AFK/disconnect · rematch · friends

## Online smoothness
- Soft differential renders on place/sync (no full DOM wipe).
- Local hand not rebuilt while dragging.
- Sync every 6s, skipped while dragging; client throttle.
- softRenderGrid fully clears cell styles (fixes stuck squares after line clear until next place).
- place_ok forces board soft-sync so cleared cells never linger.
- Classic intro 1200ms → 450ms.

## Layout
- `server.js` — HTTP + WebSocket, MatchRoom, queue, private, presence
- `shared/rules.js` — authoritative puzzle rules (Node + browser)
- `public/shared/rules.js` — same file served to client
- `public/match-client.js` — WebSocket client
- `public/game.js` — UI + local/bot modes + online glue
- `vendor/ws` — vendored WebSocket library (no npm install required)

## Persistence

By default state is **in-memory** (restart loses active matches).

| Mode | How | Survives restart |
|------|-----|------------------|
| `memory` | default | no |
| `file` | `BP_STORE=file` | yes (JSON in `data/`) |
| `redis` | `REDIS_URL=redis://…` or `BP_STORE=redis` | yes |

```bash
# File (zero deps)
BP_STORE=file node server.js

# Redis (no npm — mini RESP client)
REDIS_URL=redis://127.0.0.1:6379 node server.js
# or
BP_STORE=redis REDIS_HOST=127.0.0.1 REDIS_PORT=6379 node server.js
```

What is stored:
- Active / recently-ended match rooms (grids, scores, hands, clock) → rejoin after restart
- Token → matchId index
- Offline social queue (friend requests, challenges)

Queues and presence stay in memory (players re-queue / re-register).

## Client modules (`public/js/`)

The former monolithic `game.js` (~19k lines) is split into ordered scripts
`01`…`12` under `public/js/`. They share global scope (no bundler). See `public/js/README.md`.

## P2P / PeerJS

Removed. Online is **only** server-authoritative WebSocket (`MatchClient` ↔ `server.js`).
Legacy PeerJS handlers (`onMpMessage`, `openGameSession`, `mpConn`, ranked peer mesh) are gone or no-op stubs.
