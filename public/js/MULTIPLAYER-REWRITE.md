# Clean slate (v3.8.0)

## Removed from client
- All `mpSend`, `mpConn`, `mpSessionLink`, PeerJS/wire/ICE helpers
- P2P match-load handshake, pending-join, empty-peer watches
- No PeerJS library

## Server multipayer foundation (keep & extend)
- `match-client.js` — WebSocket API
- `10-match-handlers.js` — events → UI
- `applyRoomState`, `beginRoomRankedMatch`, `roomMatchMode`
- `server.js` + `shared/rules.js` + `lib/store.js`

## Note
`mpMode` remains as a boolean “in online match” for UI; it is not PeerJS.
