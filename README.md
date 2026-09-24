# Block Puzzle

Server-authoritative multiplayer block puzzle (Node.js HTTP + WebSocket).

**Version:** see `package.json`  
**Node:** >= 18  
**Dependencies:** none (vendor WebSocket, optional Redis via mini client)

## Quick start

```bash
# Build client bundle + start server (port 9000)
npm start

# Persistence modes
npm run start:file    # JSON files under data/
npm run start:redis   # REDIS_URL=redis://127.0.0.1:6379

# Checks & tests
npm run check
npm test
```

Open `http://127.0.0.1:9000/`. WebSocket path: `/ws`.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `9000` | HTTP + WS port |
| `BP_STORE` / `STORE` | `memory` | `memory` \| `file` \| `redis` |
| `REDIS_URL` | — | Required when store is `redis` |
| `BP_WS_ORIGINS` | (any) | Comma-separated allowed Origin values; empty = allow all |
| `BP_MAX_WS_MSG` | `65536` | Max WebSocket message size (bytes) |

## Architecture

- **`server.js`** — HTTP static files, WS matchmaking, rooms, private lobbies, presence
- **`shared/rules.js`** — placement, clears, scoring (mirrored to `public/shared/rules.js`)
- **`shared/skins.js`** — piece color palettes (server deals from this)
- **`lib/store.js`** — memory / file / Redis persistence
- **`public/js/*`** — client modules → `public/dist/client.bundle.js`

## Docker

```bash
docker build -t block-puzzle .
docker run -p 9000:9000 -e BP_STORE=file block-puzzle
```

## Protocol notes

Clients receive `hello` with `token` and `protocolVersion`. Match moves are server-validated (`pieceIdx`, `r`, `c` only). Health: `GET /health`.
