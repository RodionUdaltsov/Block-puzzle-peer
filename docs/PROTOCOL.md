# Block Puzzle — WebSocket protocol (v1)

Path: `/ws` · JSON text frames · `protocolVersion: 1` in `hello` / `match_found`.

## Connection

Server → client immediately:

```json
{ "type": "hello", "token": "t_…", "protocolVersion": 1, "crossplay": true }
```

`token` is the socket session id until rebound by match.

### Security note: match tokens as bearer credentials

- **Registered players**: identity is established via session cookie / `friendCode` verification
  (`presence_register` → verified session/device). The match `token` alone is not sufficient
  to impersonate a registered seat when `wsMatchesPlayerSync` can resolve a real player.
- **Anonymous (guest) players**: the match `token` **is** the bearer credential. Anyone who
  knows `{ matchId, token }` can attempt to occupy that seat on a WebSocket. This is intentional
  so guests can reconnect after reload without a durable login.
- **Do not** log match tokens, put them in analytics, error trackers, or third-party telemetry.
- Prefer short-lived tokens and avoid embedding them in shareable URLs.

## Ranked queue

| Client → server | Server → client |
|-----------------|-----------------|
| `join_queue` `{ duration, trophies, name, skinId, boardId, … }` | `queued` / `match_found` |
| `leave_queue` | `queue_left` |
| `expand_queue` `{ expandLevel }` | `queued` |

## Private lobby

| Client | Server |
|--------|--------|
| `create_private` | `private_lobby` `{ code (7 chars), role: "host", … }`; errors `rate_limited` (3 s cooldown), `server_busy` (global cap) |
| `join_private` `{ code }` | `private_lobby` / `private_error` (`not_found`, `full`, `self`, `rate_limited` after 10 misses/min/IP) |
| `private_ready` `{ ready, code? }` | updated `private_lobby` |
| `private_duration` `{ duration }` | host-only; resets ready |
| `leave_private` | `private_left` |

When both ready → both receive `match_found`.

## In-match (authoritative)

Client **must not** send `shape` / `color`. Only:

```json
{ "type": "place", "matchId", "token", "pieceIdx", "r", "c", "requestId?" }
```

Optional `requestId` (string ≤ 64) is echoed on `place_ok` / `place_reject` so clients can
correlate ACKs and dedupe when the room lives on another Node instance (Redis forward).
If no ACK arrives within a short timeout, client should send `sync`.

Also: `match_ready`, `deal`, `sync`, `forfeit`, `rematch_offer` / `accept` / `decline` / `cancel`, `leave_match`, `rejoin`.

Server replies with snapshots / `place_reject` / result events.

## Social / presence

`presence_register`, `presence_query`, `presence_search`, `presence_activity`, `friend_code_check`, `social_send`.

## Cosmetics

`cosmetics_get`, `cosmetics_buy`, `cosmetics_equip` (validated against server profile).

## HTTP

| Method | Path | Notes |
|--------|------|--------|
| POST | `/api/auth/register` | `{ login, password, nick? }` |
| POST | `/api/auth/login` | `{ login, password }` |
| POST | `/api/auth/logout` | Bearer token |
| POST | `/api/auth/delete` | Bearer + `{ password }` |
| GET/PATCH | `/api/me` | Bearer |
| GET | `/health` | JSON liveness |
| POST | `/api/auth/check-login` | `{ login, password }` — verify credentials only |
| GET/POST | `/api/admin/*` | Header `X-Admin-Key`; disabled in production unless `BP_ADMIN_KEY` is set |

Auth endpoints (`login`, `check-login`, `register`, `delete`) answer **429** with a `Retry-After`
header after too many failed attempts, and **503** `busy` when the password-hashing queue is full.
