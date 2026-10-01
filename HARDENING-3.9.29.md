# Block Puzzle 3.9.29 — server hardening

- `shared/rules.js` is now the exact canonical copy used by both server and browser.
- Online placement is fully server-authoritative: the client supplies only `pieceIdx`, `r`, and `c`; server-side shape/color state is always used.
- Removed the legacy `06-peer-liveness.js` filename and renamed the module to `06-match-liveness.js`.
- Updated all loader/documentation references.
- Synced package version to `3.9.29`.
- Added `npm run check` and `npm test` with Node syntax/integrity checks.
- Verified the server boots and serves HTTP successfully on a clean test port.

---

## 3.9.57 — critical UX / structure

- Account delete: native `confirm`/`prompt` replaced with in-app `accountDeleteModal` (password field + danger CTA).
- Generic `bpConfirm()` modal for destructive actions (remove friend, clear history).
- Settings tabs / volume / chips moved to `public/js/14-settings-ui.js` (no longer mixed into private-rooms UI).
- `showInfoToast` accepts kind aliases: `info`→ok, `warn`/`error`→bad.
- Restored `public/css/styles-match.css` in the CSS bundle pipeline.
- Client bundle modules: 19 (includes settings UI).


---

## 3.10.1 — friend-code false "dead" fixes

Root cause: codes were declared `account_deleted` when only `accounts` + `guest_progress`
rows were checked. Guests with presence/profile only, or mid-race before first
guest_progress write, got kicked.

Fixes:
1. `probeFriendCodeAlive()` — comprehensive alive check (account | guest_progress |
   profile | fresh presence). Used by presence sweeper, `/api/auth/alive`, `session_check`.
2. Presence sweeper: 5s interval, skips stale memory entries, uses probe with 15min grace.
3. `isFriendCodeTaken`: only blocks on *recent* presence (online or lastSeen < 24h),
   registered profiles, or existing guest_progress — not any stale presence row.
4. Private lobby TTL sweeper (30 min / both sockets gone > 1 min).
5. `purgeGuestProfiles` also removes abandoned `guest_progress` so codes become reusable.


---

## 3.10.2 — anti-resurrection after account delete

Problem: after account/guest delete, clients with localStorage friendCode could
recreate rows via guest-bind / presence_register / cosmetics. Tombstones lived
only in memory (lost on restart) and presence alone kept codes "alive".

Fixes:
1. Durable `deleted_codes` table (30-day TTL) + memory cache warmed on boot.
2. `markFriendCodeDeleted` writes durable tombstone; purge awaits it first.
3. `probeFriendCodeAlive`: presence race grace cut to 90s; tombstoned = always dead.
4. presence_register forces a **new** code if proposed code is tombstoned.
5. guest-bind / guest-sync / bindDeviceGuest / saveGuestProgress / cosmetics
   refuse to rehydrate tombstoned identities (410 account_deleted).
6. `isFriendCodeTaken` treats tombstoned codes as taken.


---

## 3.10.3 — stop client-side resurrection after delete

Root cause of remaining resurrection: `softClearDeadGuest()` on alive_poll /
session_check **re-uploaded guest progress to the server** while the player was
in-game, recreating wiped rows.

Fixes:
1. Client `softClearDeadGuest`: hard local wipe, set `_bpGuestSyncBlocked`, show entry gate. Never sync.
2. `forceAuthRevoked('account_deleted')` skips false-alarm /api/me guard.
3. /api/me 401 with accountDeleted → full forceAuthRevoked.
4. Server `resolveSession`: delete orphan sessions when account row is gone.
5. Presence sweeper writes durable tombstone before kick (covers raw SQL deletes).


---

## 3.10.5 — server refactor: extract MatchRoom

- Moved `MatchRoom` class (~1420 lines) to `lib/match-room.js`
- Factory `createMatchRoomClass(deps)` + mutable `matchHooks` for
  `persistRoom` / `forgetRoom` / `startRoom` / `send` / `rooms` / `store`
- `server.js` reduced ~1400 lines; behaviour unchanged


---

## 3.10.6 — server refactor: extract HTTP API

- Moved HTTP request listener (~920 lines) to `lib/http-api.js`
- `createHttpRequestListener(deps)` + `httpHooks` for live store/accounts/device helpers
- `server.js` ~3370 lines (was ~4200 after MatchRoom extract)


---

## 3.10.7 — server refactor: extract WS handlers

- Moved `wss.on('connection')` message handlers (~1300 lines) to `lib/ws-handlers.js`
- `attachWsHandlers(wss, deps)` + `wsHooks` for live maps and matchmaking helpers
- `server.js` ~2125 lines (from original ~5585)


---

## 3.10.8 — server refactor: extract device/guest

- Moved device binding + guest progress helpers (~660 lines) to `lib/device.js`
- `createDeviceApi(deps)` + `deviceHooks` for store / tombstone checks
- `server.js` ~1514 lines (from original ~5585, **−73%**)


---

## 3.10.9 — server refactor: identity + matchmaking

- `lib/identity.js` — tombstones, purge, presence sweeper, kickFriendCodeSessions
- `lib/matchmaking.js` — ranked queue, private lobbies, startRoom
- `server.js` ~1018 lines (from original ~5585, **−82%**)
