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
