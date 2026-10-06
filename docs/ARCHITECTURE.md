# Architecture

## Principle
No file should grow into a monolith. Every large area is split by **responsibility**, and the
order/membership of generated bundles lives in **manifests** (not hard-coded in scripts).
`test/architecture.test.js` and `npm run check` enforce this.

## Client (`public/`)
| Source | Manifest | Build | Output |
|--------|----------|-------|--------|
| `public/js/**` | `public/js/modules.json` | `scripts/bundle-client.js` | `public/dist/client.bundle.js(.mjs)` |
| `public/css/**` | `public/css/modules.json` | `scripts/bundle-css.js` | `public/styles.css` |
| `public/html/*.html` | `public/html/modules.json` | `scripts/bundle-html.js` | `public/index.html` (`%%VERSION%%` → package version) |

`npm run build` runs all three (also in the Dockerfile and `npm start`). Edit the sources, never the outputs.
JS modules share one IIFE scope — order matters (see `public/js/README.md`).

## Server (`server.js` + `lib/`)
`server.js` is the composition root: creates the store, wires hooks, boots HTTP + WebSocket.

```
lib/ws-handlers.js            connection lifecycle + ordered dispatch
lib/ws/context.js             shared deps + late-bound hook aliases
lib/ws/handlers/*.js          matchmaking · private-lobby · presence-social · match · session-cosmetics · liveness
                              each: (type, ws, data, shared) => true when handled

lib/http-api.js               per-request setup, /api dispatch, /health, static fallback
lib/http/context.js           shared deps, auth limiters, hook aliases, guest-wipe ownership check
lib/http/routes/*.js          admin · auth-guest · auth-account · me
                              each: async (req, res, ctx) => true when handled

lib/match-room.js             MatchRoom class core (constructor, toJSON, restore, seats)
lib/match-room/*.js           method groups installed on the prototype (non-enumerable, like class methods):
                              connection · views · moves · lifecycle · rematch · tick
lib/static-files.js           static server (ETag/304, gzip/brotli cache)
```
Handlers are tried in the original order; message/route types are mutually exclusive, so adding a
new type = add an `if (type === ...)` to the matching handler module (or a new module + list it in
the `HANDLERS` / `ROUTES` array).

## Known follow-ups
- `lib/postgres-store.js`, `lib/accounts.js`, `lib/device.js`: single-purpose but large.
- A few client functions are still 250–370 lines (`startDrag`, `tryPlaceAt`, `endVersus`, `aiTick`,
  `applyRoomState`): hot paths, intentionally not touched during the split.
- `markDevicesAfterAccountDelete` exists only in the admin routes; the self-service delete route calls
  it out of scope (swallowed ReferenceError, pre-existing). See comment in `lib/http/routes/auth-account.js`.
