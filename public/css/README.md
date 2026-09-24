# CSS sources

Modular styles bundled by `scripts/bundle-css.js` into `public/styles.css`.

| File | Role |
|------|------|
| `styles-base.css` | Reset, tokens, layout shell |
| `styles-home.css` | Home / lobby / modes |
| `styles-board.css` | Board, pieces, soft-render |
| `styles-match.css` | Match overlays, HUD, results |

```bash
npm run build:css          # minify → public/styles.css
node scripts/bundle-css.js --no-minify
```

Production `index.html` loads only `styles.css`. Edit the modular files, then rebuild.
