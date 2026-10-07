# Block Puzzle

Block puzzle game with an authoritative multiplayer server (Node.js, WebSocket), accounts,
economy (skins / boards / inventory), achievements, bots, friends, replays and rematches.

- **Server is authoritative.** The client sends only `pieceIdx + row + col`; the server owns the
  hand, validates placement, scores lines and decides the winner. Rules live in `shared/rules.js`
  and are used by both sides (`npm run check` verifies they stay in sync).
- **Storage:** PostgreSQL is the source of truth for player progress (`BP_STORE=postgres`).
  An in-memory store exists for local development only (progress is lost on restart).
- **Scaling:** optional Redis (`REDIS_URL`) shares the matchmaking queue, private lobbies and
  room routing between several app instances. Rooms are serialisable (`MatchRoom.toJSON()` /
  `restore()`) so a live match survives a restart.

See also: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/PROTOCOL.md](docs/PROTOCOL.md),
[docs/schema.sql](docs/schema.sql), [public/js/README.md](public/js/README.md).

## Requirements

Node.js >= 22 (the Docker image uses Node 24). PostgreSQL 16 for the real store, Redis 7 for multi-instance.

## Quick start (local, no database)

```bash
npm install
BP_STORE=memory npm start        # builds the client, then serves http://127.0.0.1:9000/
```

On Windows: `start-local-memory.bat` (memory mode) or `start-server.bat`.

## Docker (PostgreSQL + Redis)

```bash
POSTGRES_PASSWORD=change-me docker compose up -d --build
# several app instances (requires Redis, sticky WebSocket sessions recommended at the LB):
POSTGRES_PASSWORD=change-me REDIS_URL=redis://redis:6379 docker compose up -d --build --scale app=2
```

`docs/schema.sql` is applied automatically on the first start of the PostgreSQL volume.

## Production checklist

Set at least `BP_ADMIN_KEY`, `BP_TRUST_PROXY=1` (behind nginx/Caddy) and `BP_WS_ORIGINS`
(allowed WebSocket origins). Serve over HTTPS; cookies are `HttpOnly` and `Secure` accordingly
(`BP_COOKIE_SECURE` overrides detection).

## Configuration (environment variables)

| Variable | Purpose |
|----------|---------|
| `PORT` | HTTP/WebSocket port (default `9000`) |
| `BP_STORE` | `postgres` or `memory` |
| `DATABASE_URL` | PostgreSQL connection string (also `POSTGRES_*` / `PG*` variants, `PG_POOL_MAX`) |
| `REDIS_URL` | Enables multi-instance coordination when set |
| `BP_INSTANCE_ID` | Instance label for logs / routing |
| `BP_ADMIN_KEY` | Key for the admin API (`/admin.html`) |
| `BP_TRUST_PROXY` | `1` when behind a reverse proxy (trust `X-Forwarded-*`) |
| `BP_WS_ORIGINS` | Allowed WebSocket / API origins |
| `BP_COOKIE_SECURE` | Force the `Secure` cookie flag on/off |
| `BP_LOG` | Log level (default `info`) |
| `BP_HEALTH_DETAILS` | `1` exposes detailed stats on `/health` (trusted deployments only) |
| `BP_WS_MSG_LIMIT` / `BP_WS_MSG_WINDOW` | WebSocket message rate limit |
| `BP_WS_CONN_LIMIT` / `BP_WS_CONN_WINDOW` | WebSocket connection rate limit |
| `BP_MAX_WS_MSG` / `BP_MAX_WS_FRAGMENTS` | WebSocket frame size limits |
| `BP_AUTH_LIMITS` | Auth rate-limit tuning |
| `BP_SCRYPT_PARALLEL` / `BP_SCRYPT_QUEUE` | Password hashing concurrency / queue |
| `BP_MAX_PRIVATE_LOBBIES`, `BP_PRIVATE_*` | Private lobby limits and cooldowns |

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run build` | Generates `public/index.html`, `public/styles.css`, `public/dist/client.bundle.js` from sources |
| `npm run build:dev` | Same, without minification |
| `npm run check` | Syntax check of all JS, rules sync, authoritative-move guard, bundle manifest |
| `npm test` | Unit / integration tests (`node --test`) |
| `npm run test:pg` | PostgreSQL concurrency tests (needs a running database) |
| `npm run migrate:postgres` | Migrate legacy file-based progress to PostgreSQL |

Edit sources only (`public/js/**`, `public/css/**`, `public/html/**`); generated files are rebuilt
by `npm run build`, which the Dockerfile and `npm start` run automatically.

## Health

`GET /health` returns `{ ok, service, version, uptime }`; the Docker `HEALTHCHECK` uses it.

## License

MIT, see [LICENSE](LICENSE).
