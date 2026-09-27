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

# Requires PostgreSQL (DATABASE_URL)
npm start
# or: docker compose up -d --build

# Checks & tests
npm run check
npm test

# Client bundle (minified by default; --no-minify via build:dev)
npm run build
npm run build:dev
```

Open `http://127.0.0.1:9000/`. WebSocket path: `/ws`.

Windows: double-click `start-server.bat` (auto-builds bundle if missing).

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `9000` | HTTP + WS port |
| `BP_STORE` / `STORE` | `postgres` | `postgres` (default) \| `memory` (tests only) |
| `DATABASE_URL` | — | **Required.** Postgres URL, e.g. `postgres://bp:bp@127.0.0.1:5432/blockpuzzle` |
| `BP_WS_ORIGINS` | (any) | Comma-separated allowed Origin values; empty = allow all |
| `BP_MAX_WS_MSG` | `65536` | Max WebSocket message size (bytes) |
| `BP_LOG` | `info` | Log level: `debug` \| `info` \| `warn` \| `error` (JSON lines) |
| `BP_WS_CONN_LIMIT` | `40` | Max new WS connections per IP per window |
| `BP_WS_CONN_WINDOW` | `10000` | Connection rate window (ms) |
| `BP_WS_MSG_LIMIT` | `60` | Max WS messages per socket per window |
| `BP_WS_MSG_WINDOW` | `1000` | Message rate window (ms) |

## Architecture

- **`server.js`** — HTTP static files, WS matchmaking, rooms, private lobbies, presence
- **`shared/rules.js`** — placement, clears, scoring (mirrored to `public/shared/rules.js`)
- **`shared/skins.js`** — piece color palettes (server deals from this)
- **`lib/store.js`** + **`lib/postgres-store.js`** — PostgreSQL only (memory for tests)
- **`lib/logger.js`** — structured JSON logger (`BP_LOG`)
- **`lib/rate-limit.js`** — WS connection + message rate limits
- **`lib/security.js`** — HTTP security headers + Origin allowlist
- **`public/js/*`** — client modules → `public/dist/client.bundle.js`
- **`public/css/*`** — modular CSS sources (production bundle is `public/styles.css`)
- **`public/js/00-i18n.js`** — lightweight ru/en i18n (`t()`, `data-i18n`, settings language chips)

### Player progress source of truth

**PostgreSQL** holds durable player data:

- accounts & sessions  
- cosmetics (skins / boards / diamonds)  
- bot silver stars  
- guest progress (until register)  
- social inbox, presence snapshots  

Set `DATABASE_URL` and `BP_STORE=postgres` (Docker defaults do this).  
`file` / `memory` are **dev-only** fallbacks. Optional **Redis** can still hold short-lived match rooms / ranked queue / rejoin tokens.

## Cosmetics (server-authoritative)

Ownership, equip, and diamonds are stored server-side (keyed by friend code).
On `presence_register` the server migrates local ownership once, then becomes source of truth.
WS: `cosmetics_state`, `cosmetics_buy`, `cosmetics_equip` / `*_result`.
Board FX are gated by `html.bp-full-board-fx` (set only on capable devices) to reduce mobile lag.
Private rooms UI ships as deferred chunk `dist/client.deferred.js`.

## Docker

```bash
docker build -t block-puzzle .
docker run -p 9000:9000 -e BP_STORE=postgres -v bp-data:/app/data block-puzzle
```

Or with Compose (app only by default; Redis optional):

```bash
docker compose up -d --build
# With Redis:
BP_STORE=redis REDIS_URL=redis://redis:6379 docker compose --profile redis up -d --build

# With PostgreSQL:
BP_STORE=postgres DATABASE_URL=postgres://bp:bp@postgres:5432/blockpuzzle \
  docker compose --profile postgres up -d --build
```

- Image runs as non-root user (`bp`).
- Healthcheck: `GET /health`.
- Volume `/app/data` for file-store persistence.
- CSS/JS bundles: `npm run build` (or `build:css` / `build:dev`).

### Production tips

- Put a reverse proxy (nginx / Caddy) in front for TLS and WebSocket upgrade.
- Set `BP_WS_ORIGINS` to your real origin(s) in production.
- **Player progress:** use **PostgreSQL** (`BP_STORE=postgres` + `DATABASE_URL`). Required for multi-instance and production.
- `BP_STORE=postgres` is local/dev only. `BP_STORE=memory` is throwaway. Optional Redis for hot match/queue state.

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

## PostgreSQL (required)

Player progress lives **only** in PostgreSQL (accounts, sessions, cosmetics, bot stars, social, presence).

```bash
# Easiest: Docker (app + Postgres)
docker compose up -d --build

# Or local Postgres
npm install
export DATABASE_URL=postgres://bp:bp@127.0.0.1:5432/blockpuzzle
npm start
```

Schema auto-applies on first connect (`lib/postgres-store.js`). DDL: `docs/schema.sql`.

Optional one-shot import from a legacy `data/` folder:
`DATABASE_URL=... npm run migrate:postgres`

`BP_STORE=memory` is for automated tests only.

## Protocol notes

Clients receive `hello` with `token` and `protocolVersion`. Match moves are server-validated (`pieceIdx`, `r`, `c` only). Health: `GET /health`.

## Client modules

See `public/js/README.md` for the ordered module list and roles.


## Local Windows

Double-click `start-server.bat`:

1. Installs `npm` deps if needed
2. Starts Postgres via Docker Compose when Docker is available (`docker compose up -d postgres`)
3. Builds client bundle
4. Runs `node server.js` on port 9000 and opens the browser

Set `DATABASE_URL` beforehand if Postgres is not the default `postgres://bp:bp@127.0.0.1:5432/blockpuzzle`.

## Device binding (not IP)

Guest progress and “already had an account on this machine” are keyed by a stable **device id**
(`localStorage` + header `X-Device-Id`), stored in PostgreSQL table `device_binds`.
VPN / IP change no longer creates a new guest slot.

