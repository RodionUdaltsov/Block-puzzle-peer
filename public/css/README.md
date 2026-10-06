# CSS sources

Modular styles bundled by `scripts/bundle-css.js` into `public/styles.css`.
**Cascade order = `public/css/modules.json`** (later files override earlier ones; keep
`styles-perf.css`, the graphics tiers, last).

| Folder | Content |
|--------|---------|
| `00-base/` | tokens/reset, screen shells, settings, home menu, shop/inventory, friends/matchmaking base, header + versus + board base, a11y/PWA/auth modal |
| `10-home/` | board field themes (two layers), home profile, boot/loading, match intro + end freeze, versus/classic overrides, entry gate, shop purchase/preview |
| `20-board/` | cells/skins/clear FX, pieces & controls, skin preview/ghost/combo, rejoin/disconnect overlays, score floats, review/replay, history/bots, friend-code/comp/duration screens, overrides |
| `30-match/` | friends/lobby/requests, match toasts, achievements, score duel/result, versus overrides, touch/perf tuning |

```bash
npm run build:css          # minify → public/styles.css
node scripts/bundle-css.js --no-minify
```

Production `index.html` loads only `styles.css`. Edit the modular files, then rebuild.
