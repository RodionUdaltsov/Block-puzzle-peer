# Client modules

All files listed in `modules.json` are concatenated by `scripts/bundle-client.js` into one IIFE
(`public/dist/client.bundle.js`) and therefore **share one scope**. Order matters: a top-level
`const` / `let` must be declared before any module that uses it at load time (function
declarations are hoisted).

Add or move a module = edit `modules.json` (single source of truth for the bundler,
`scripts/check.js` and the dev loader `public/game.js`), then run `npm run build && npm run check`.

Layout (by responsibility):

| Path | Responsibility |
|------|----------------|
| `00-*.js` | state, perf helpers, i18n |
| `01-cosmetics/` | skins, boards, shop, inventory |
| `02-bots-achievements-settings/` | `01-bots-roster` (BOTS data), `02-bots-logic-avatars`, `03-achievements` (catalog), `04-settings` (settings, scales, wake lock, haptics) |
| `03-audio.js` | sound |
| `04-profile-friends/` | profile, friends, auth session, entry gate |
| `05-*` … `07-*` | render / match state, lifecycle, match flow |
| `08-gameplay/` | board, drag input, placement, FX |
| `09-offline-and-ranked.js` | offline mode and ranked |
| `10-match-handlers/` | WebSocket match handlers |
| `11-lobby-versus-replay/` | lobby, versus, bot AI, replay, shop screens |
| `12-boot.js`, `13-performance.js`, `14-settings-ui.js` | boot, performance, settings UI |

`main.js` is a dev-only ESM entry that re-exports the prebuilt bundle.
