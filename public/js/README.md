# Client modules (`public/js`)

Numbered scripts are concatenated by `scripts/bundle-client.js` into
`public/dist/client.bundle.js` (IIFE, shared scope).

| File | Role |
|------|------|
| `00-state.js` | Global state (`BPState`) |
| `00-perf.js` | Early perf hooks |
| `01-cosmetics.js` | Skins, boards, shop UI |
| `02-bots-achievements-settings.js` | Bots, achievements, settings |
| `03-audio.js` | Sound |
| `04-profile-friends.js` | Profile, friends, social |
| `05-soft-render.js` | Board rendering |
| `06-match-liveness.js` | Match liveness / DC UI |
| `07-match-flow-ui.js` | Match flow overlays |
| `08-screens-gameplay.js` | Screens & gameplay UI |
| `09-offline-and-ranked.js` | Offline + ranked queue |
| `10-match-handlers.js` | WS match message handlers |
| `11-private-rooms-ui.js` | Private lobbies UI |
| `12-boot.js` | Boot loader / match intro |
| `13-performance.js` | Adaptive mobile performance |

Liveness lives in `06-match-liveness.js` (do not reintroduce older peer-liveness module names).
