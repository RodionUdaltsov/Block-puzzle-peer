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

## 3.9.58 — alerts + MatchRoom extract

- All client `alert()` removed → `showInfoToast` (diamonds, match client, room code).
- `MatchRoom` class extracted to `lib/match-room.js` (factory with injected deps).
- `server.js` ~1860 lines (was ~3176); tests/check updated for new layout.

## 3.9.59 — medium priority

- `lib/matchmaking.js`: queue buckets, findMatch/enqueue/dequeue, startRoom, private lobby (genPrivateCode, leave, snapshot, tryStart).
- `server.js` further reduced (~1644 lines).
- Screen navigation API exported on `window`: showScreen, navigateScreen, show/hideScreenLoading, withScreenLoading.
- Soft cleanup of deprecated / legacy comments in soft-render + screen module headers.

## 3.9.60 — quality close-out

- `lib/ws-handlers.js`: full WebSocket connection + message router extracted from server.js.
- `server.js` ~747 lines (HTTP static, upgrade, boot, lifecycle only).
- Board FX stylesheet lazy-load fixed (version query + single inject).
- README Architecture table updated for new `lib/*` layout.
- Hardening tests cover match-room, matchmaking, ws-handlers + authoritative place.
- Cache-bust query `?v3960` on styles + client bundle.

**Intentionally deferred (needs larger redesign):** true client code-split into independent chunks — modules still share one IIFE scope by design.

## 3.9.61 — stage: HTTP API extract

- `lib/http-api.js`: `/api/auth/*`, `/api/me`, `/health`, static SPA fallback.
- `server.js` ~583 lines.

## 3.9.62 — stages continued

- Stage HTTP: `lib/http-api.js` (+ `/metrics` Prometheus text).
- Stage E2E: `test/api-private.e2e.test.js` (register/login/delete + private lobby → match_found).
- Stage docs: `docs/PROTOCOL.md` WS + HTTP reference.
- `server.js` ~583 lines.

## 3.9.63 — client code-split

- **Core** `client.bundle.js` ~730KB (menu, match, settings, cosmetics, bots).
- **Deferred** `client.deferred.js` ~294KB (`04-profile-friends`, `11-private-rooms-ui`).
- Both scripts use `defer`; deferred marks `global.__BP_DEFERRED_READY`.
- Initial parse/compile cost reduced vs single ~1.0MB bundle.

## 3.9.64 — hotfix: buttons

- Reverted 3.9.63 code-split of `04-profile-friends` + `11-private-rooms-ui` into deferred.
- Those modules own primary menu click handlers (shop, friends, classic cards, etc.).
- Loading them only in `client.deferred.js` left buttons unbound when deferred lagged/failed.
- Single `client.bundle.js` again; `DEFERRED_MODULES` kept empty until handlers are duplicated or stubbed in core.
