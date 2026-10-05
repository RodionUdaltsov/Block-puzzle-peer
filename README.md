# Block Puzzle

Server-authoritative multiplayer block puzzle (Node.js HTTP + WebSocket).

**Version:** see `package.json`  
**Node:** >= 18  
**Dependencies:** `pg` (PostgreSQL driver); the WebSocket library is vendored in `vendor/ws`  
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
| `BP_STORE` / `STORE` | `postgres` | `postgres` (default) \| `memory` (tests only; any other value falls back to `postgres`) |
| `DATABASE_URL` | — | **Required.** Postgres URL, e.g. `postgres://bp:bp@127.0.0.1:5432/blockpuzzle` |
| `BP_WS_ORIGINS` | (any) | Comma-separated allowed Origin values for WebSocket **and** CORS on `/api`; empty = allow all (set it in production) |
| `BP_MAX_WS_MSG` | `65536` | Max WebSocket message size (bytes) |
| `BP_LOG` | `info` | Log level: `debug` \| `info` \| `warn` \| `error` (JSON lines) |
| `BP_WS_CONN_LIMIT` | `40` | Max new WS connections per IP per window |
| `BP_WS_CONN_WINDOW` | `10000` | Connection rate window (ms) |
| `BP_WS_MSG_LIMIT` | `60` | Max WS messages per socket per window |
| `BP_WS_MSG_WINDOW` | `1000` | Message rate window (ms) |
| `BP_ADMIN_KEY` | — | Secret for `/api/admin/*`, sent as `X-Admin-Key` header. **Unset in production = admin API disabled.** In development the built-in key `localdev` works from `127.0.0.1` only |
| `BP_TRUST_PROXY` | `0` | Number of reverse proxies in front of the app (`1` for a single nginx/Caddy). Needed so rate limits see the real player IP; with `0` forwarded headers are ignored (anti-spoofing) |
| `BP_AUTH_LIMITS` | `0` (off) | Login / registration throttling. **Off by default while testing**; set `1` to enable all `BP_AUTH_*` / `BP_REGISTER_*` limits below (admin-key guard is always on) |
| `BP_AUTH_IP_FAILS` / `BP_AUTH_IP_WINDOW` | `30` / `600000` | Failed login attempts per IP per window (ms) |
| `BP_AUTH_PAIR_FAILS` | `8` | Failures per IP + login per `BP_AUTH_LOGIN_WINDOW` (default 15 min) |
| `BP_AUTH_LOGIN_FAILS` | `100` | Failures per login from all IPs per `BP_AUTH_LOGIN_WINDOW` |
| `BP_AUTH_DEVICE_FAILS` | `15` | Failures per **device id** per `BP_AUTH_IP_WINDOW` (device+login pairs use `BP_AUTH_PAIR_FAILS`) |
| `BP_REGISTER_LIMIT` / `BP_REGISTER_DEVICE_LIMIT` | `20` / `5` | Registrations per IP / per device id per hour |
| `BP_SCRYPT_PARALLEL` / `BP_SCRYPT_QUEUE` | `2` / `64` | Concurrent password hashes / waiting queue (overflow → HTTP 503) |

## Architecture

- **`server.js`** — HTTP static files, WS matchmaking, rooms, private lobbies, presence
- **`shared/rules.js`** — placement, clears, scoring (mirrored to `public/shared/rules.js`)
- **`shared/skins.js`** — piece color palettes (server deals from this)
- **`lib/store.js`** + **`lib/postgres-store.js`** — PostgreSQL only (memory for tests)
- **`lib/logger.js`** — structured JSON logger (`BP_LOG`)
- **`lib/rate-limit.js`** — WS connection + message rate limits, HTTP login/registration throttling
- **`lib/security.js`** — HTTP security headers, Origin allowlist/CORS, trusted-proxy client IP, admin-key policy
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
`memory` is a throwaway store for automated tests only. The old file and Redis stores were removed.

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

Or with Compose (app + PostgreSQL):

```bash
docker compose up -d --build

# Production example (change the default DB password and set the admin key):
POSTGRES_PASSWORD=change-me \
DATABASE_URL=postgres://bp:change-me@postgres:5432/blockpuzzle \
BP_ADMIN_KEY=$(openssl rand -hex 24) BP_TRUST_PROXY=1 \
BP_WS_ORIGINS=https://your.domain \
  docker compose up -d --build
```

- Image runs as non-root user (`bp`).
- Healthcheck: `GET /health`.
- Volume `/app/data` is only used by the one-shot `npm run migrate:postgres` import of legacy data.
- CSS/JS bundles: `npm run build` (or `build:css` / `build:dev`).

### Production tips

- Put a reverse proxy (nginx / Caddy) in front for TLS and WebSocket upgrade.
- Set `BP_WS_ORIGINS` to your real origin(s) in production.
- Set `BP_TRUST_PROXY=1` (number of proxies) so per-IP limits use the real client address; leave it `0` if the app is exposed directly.
- Set `BP_ADMIN_KEY` to a long random value to use `/admin.html`; without it the admin API is off in production. The key is sent in the `X-Admin-Key` header, never in the URL.
- **Player progress:** use **PostgreSQL** (`DATABASE_URL`). Required for production. `BP_STORE=memory` is throwaway (tests).
- Change the default `bp`/`bp` database credentials from `docker-compose.yml`.

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

## Abuse limits: device id first, IP as backstop

Login / registration throttling is tracked **per device id** and **per IP**. The device id is
created by the browser (`localStorage` + cookie) and sent as `X-Device-Id`, so it identifies one
browser profile, not the physical machine, and a client can mint a new one. That is why the IP
limits stay on as well: they stop an attacker who keeps rotating device ids.

## Device binding (not IP)

Guest progress and “already had an account on this machine” are keyed by a stable **device id**
(`localStorage` + header `X-Device-Id`), stored in PostgreSQL table `device_binds`.
VPN / IP change no longer creates a new guest slot.

