# Block Puzzle 3.9.29 — server hardening

- `shared/rules.js` is now the exact canonical copy used by both server and browser.
- Online placement is fully server-authoritative: the client supplies only `pieceIdx`, `r`, and `c`; server-side shape/color state is always used.
- Removed the legacy `06-peer-liveness.js` filename and renamed the module to `06-match-liveness.js`.
- Updated all loader/documentation references.
- Synced package version to `3.9.29`.
- Added `npm run check` and `npm test` with Node syntax/integrity checks.
- Verified the server boots and serves HTTP successfully on a clean test port.


## v3.9.30 mobile performance pass
- Mobile/touch browsers get a CSS-only compositor profile; desktop is unchanged.
- Continuous decorative board/hologram animations and backdrop blur are paused/removed on touch devices.
- Drag placement search is cached by board cell while the ghost remains frame-smooth.
