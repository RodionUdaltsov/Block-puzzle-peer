# Block Puzzle — WebSocket protocol (v1)

Path: `/ws` · JSON text frames · `protocolVersion: 1` in `hello` / `match_found`.

## Connection

Server → client immediately:

```json
{ "type": "hello", "token": "t_…", "protocolVersion": 1, "crossplay": true }
```

`token` is the socket session id until rebound by match.

## Ranked queue

| Client → server | Server → client |
|-----------------|-----------------|
| `join_queue` `{ duration, trophies, name, skinId, boardId, … }` | `queued` / `match_found` |
| `leave_queue` | `queue_left` |
| `expand_queue` `{ expandLevel }` | `queued` |

## Private lobby

| Client | Server |
|--------|--------|
| `create_private` | `private_lobby` `{ code, role: "host", … }` |
| `join_private` `{ code }` | `private_lobby` / `private_error` |
| `private_ready` `{ ready, code? }` | updated `private_lobby` |
| `private_duration` `{ duration }` | host-only; resets ready |
| `leave_private` | `private_left` |

When both ready → both receive `match_found`.

## In-match (authoritative)

Client **must not** send `shape` / `color`. Only:

```json
{ "type": "place", "matchId", "token", "pieceIdx", "r", "c" }
```

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
| GET | `/metrics` | Prometheus text |
