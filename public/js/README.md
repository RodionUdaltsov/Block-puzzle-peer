# public/js — client modules

Refactored from the former ~19 000-line `game.js` monolith.

Scripts share **one global scope** (classic `<script>` tags, no bundler / no ES modules)
so existing cross-calls and shared `let`/`const` state keep working.

## Load order

| # | File | Responsibility |
|---|------|----------------|
| 0 | `../shared/rules.js` | Authoritative shapes / place / clear / score |
| 0 | `../match-client.js` | WebSocket MatchClient |
| 1 | `01-cosmetics.js` | Skins, boards, shop/inventory helpers |
| 2 | `02-bots-achievements-settings.js` | Bots, achievements, settings, scales |
| 3 | `03-audio.js` | Procedural SFX + music |
| 4 | `04-profile-friends.js` | Profile, avatars, friends/social |
| 5 | `05-soft-render.js` | Differential board/hand soft render |
| 6 | `06-peer-liveness.js` | Pre-start peer liveness / lobby HUD |
| 7 | `07-match-flow-ui.js` | Match loading, end freeze, score duel |
| 8 | `08-screens-gameplay.js` | Screens, classic play, clear, pieces |
| 9 | `09-offline-and-ranked.js` | Offline bots + ranked queue entry |
| 10 | `10-match-handlers.js` | Online WS place/sync/end handlers |
| 11 | `11-private-rooms-ui.js` | Private rooms + remaining UI |
| 12 | `12-boot.js` | Boot loader + match intro |

`index.html` loads these in order. Legacy `game.js` is only a dynamic fallback loader.
