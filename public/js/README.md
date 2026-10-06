# Client modules (`public/js`)

All modules are concatenated by `scripts/bundle-client.js` into `public/dist/client.bundle.js`
(one IIFE, **shared scope**). The **load order is `public/js/modules.json`** — the single source of
truth for the bundler, `scripts/check.js` and the dev loader `public/game.js`.
Because scope is shared, order matters: top-level `const`/`let` must be declared before any module
that touches them at load time. Function declarations are hoisted, so cross-file calls from
functions are safe.

**Production entry:** `index.html` loads only `dist/client.bundle.js`.
`public/game.js` (dev loader) and `public/js/main.js` (legacy) are not used in production.

Rules: add a file → list it in `modules.json` (`npm run check` fails on orphans); keep files under
~1300 lines (`check` enforces it) and split by responsibility, not by line count.

| Path | Role |
|------|------|
| `00-state.js`, `00-perf.js`, `00-i18n.js` | Global state (`BPState`), early perf hooks, ru/en i18n |
| `01-cosmetics/` | `01-skins-core` skins · `02-boards` fields & purchase · `03-skin-shop-actions` · `04-shop-grid` · `05-preview-modals` · `06-inventory-and-server-state` |
| `02-bots-achievements-settings.js` | Bots, achievements, settings |
| `03-audio.js` | Sound |
| `04-profile-friends/` | `01-profile-avatar` · `02-friends-store` · `03-friends-requests` · `04-friend-request-toast` · `05-friends-presence` · `06-friends-list-ui` · `07-live-match-rejoin` · `08-auth-session` · `09-guest-progress-migration` · `10-guest-mode-sync` · `11-auth-modal` · `12-account-delete-confirm` · `13-profile-sync-restore` · `14-entry-gate` · `15-account-ui-bind` |
| `05-render-and-match-state/` | `01-soft-render` (board/tray diff render) · `02-remote-match-state` · `03-online-room-state` · `04-disconnect-afk-ui` |
| `06-match-liveness.js` | Pre-start cancel, redial, opponent disconnect, AFK watch |
| `06-match-lifecycle/` | Opponent profile, rematch, create/join room, friend removal, lobby ping & toasts, challenges |
| `07-match-flow/` | Match loading, opponent remote moves, bot list/voice, achievements, match-end freeze + score duel, opponent tray & DOM refs |
| `08-gameplay/` | Screens, placement helpers, clear FX, grid/pieces, board metrics, drag input, ghost/preview, `tryPlaceAt`, combo/FX/stuck |
| `09-offline-and-ranked.js` | Offline mode + ranked queue |
| `10-match-handlers/` | `01-bind-match-client` (entry) + `02..08-handlers-*` (MatchClient events by theme) · `09-room-match-sync` · `10-match-intro` |
| `11-lobby-versus-replay/` | Private lobby, versus start, bot AI, stuck/match end, `endVersus`, replay (core/hands/seek), bot pick, shop & inventory screens, forfeit, post-match rematch |
| `12-boot.js` | Boot loader / match intro |
| `13-performance.js` | Adaptive mobile performance |
| `14-settings-ui.js` | Settings tabs, volume, chips |

Liveness lives in `06-match-liveness.js` (do not reintroduce older peer-liveness module names).
