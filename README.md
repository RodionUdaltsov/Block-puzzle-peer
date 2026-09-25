# Block Puzzle

Server-authoritative multiplayer block puzzle (Node.js HTTP + WebSocket).

**Version:** see `package.json`  
**Node:** >= 18  
**Dependencies:** none (vendor WebSocket, optional Redis via mini client)  
**License:** MIT

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

# Client bundle (minified by default; --no-minify via build:dev)
npm run build
npm run build:dev
```

Open `http://127.0.0.1:9000/`. WebSocket path: `/ws`.

Protocol reference: [`docs/PROTOCOL.md`](docs/PROTOCOL.md). Health: `/health`. Metrics: `/metrics`.

Windows: double-click `start-server.bat` (auto-builds bundle if missing).

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `9000` | HTTP + WS port |
| `BP_STORE` / `STORE` | `file` | `file` (default) \| `memory` \| `redis` |
| `REDIS_URL` | — | Required when store is `redis` |
| `BP_WS_ORIGINS` | (any) | Comma-separated allowed Origin values; empty = allow all |
| `BP_MAX_WS_MSG` | `65536` | Max WebSocket message size (bytes) |
| `BP_LOG` | `info` | Log level: `debug` \| `info` \| `warn` \| `error` (JSON lines) |
| `BP_WS_CONN_LIMIT` | `40` | Max new WS connections per IP per window |
| `BP_WS_CONN_WINDOW` | `10000` | Connection rate window (ms) |
| `BP_WS_MSG_LIMIT` | `60` | Max WS messages per socket per window |
| `BP_WS_MSG_WINDOW` | `1000` | Message rate window (ms) |

## Architecture

**Server (Node ≥18, zero npm deps)**

| File | Role |
|------|------|
| `server.js` | HTTP static + upgrade, boot, process lifecycle (~750 lines) |
| `lib/match-room.js` | Authoritative match state machine |
| `lib/matchmaking.js` | Ranked queue + private lobbies |
| `lib/ws-handlers.js` | WebSocket message handlers |
| `lib/http-api.js` | `/api/*`, `/health`, static files |
| `lib/store.js` | memory / file / redis persistence |
| `lib/accounts.js` | register / login / sessions / delete |
| `lib/security.js` + `rate-limit.js` | headers, origin, WS rate limits |
| `shared/rules.js` | Canonical game rules (shared with client) |

**Client**

| Path | Role |
|------|------|
| `public/js/00–14-*.js` | Source modules (IIFE shared scope) |
| `scripts/bundle-client.js` | → `public/dist/client.bundle.js` |
| `public/js/14-settings-ui.js` | Settings tabs (not mixed into rooms UI) |
| `public/match-client.js` | WS client API |

Online placement is **server-authoritative**: client sends only `pieceIdx`, `r`, `c`.


## Cosmetics (server-authoritative)

Ownership, equip, and diamonds are stored server-side (keyed by friend code).
On `presence_register` the server migrates local ownership once, then becomes source of truth.
WS: `cosmetics_state`, `cosmetics_buy`, `cosmetics_equip` / `*_result`.
Board FX are gated by `html.bp-full-board-fx` (set only on capable devices) to reduce mobile lag.
Private rooms UI ships as deferred chunk `dist/client.deferred.js`.

## Docker

```bash
docker build -t block-puzzle .
docker run -p 9000:9000 -e BP_STORE=file -v bp-data:/app/data block-puzzle
```

Or with Compose (app only by default; Redis optional):

```bash
docker compose up -d --build
# With Redis:
BP_STORE=redis REDIS_URL=redis://redis:6379 docker compose --profile redis up -d --build
```

- Image runs as non-root user (`bp`).
- Healthcheck: `GET /health`.
- Volume `/app/data` for file-store persistence.
- CSS/JS bundles: `npm run build` (or `build:css` / `build:dev`).

### Production tips

- Put a reverse proxy (nginx / Caddy) in front for TLS and WebSocket upgrade.
- Set `BP_WS_ORIGINS` to your real origin(s) in production.
- Default store is **file** (data under `data/`). Prefer `BP_STORE=redis` for multi-instance. Use `BP_STORE=memory` only for throwaway local runs.

Example nginx location:

```nginx
location / {
  proxy_pass http://127.0.0.1:9000;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}
```

## Protocol notes

Clients receive `hello` with `token` and `protocolVersion`. Match moves are server-validated (`pieceIdx`, `r`, `c` only). Health: `GET /health`.

## Client modules

See `public/js/README.md` for the ordered module list and roles.
