/** In-process MatchRoom harness on a fake clock (no sockets, no server process). */
'use strict';
const { clock, createFakeClock } = require('../../lib/clock');
const { createMatchRoomClass } = require('../../lib/match-room');
const R = require('../../shared/rules');

function makeHarness() {
  const fake = createFakeClock({ start: 1_700_000_000_000 });
  clock.use(fake);
  const rooms = new Map();
  let n = 0;
  const MatchRoom = createMatchRoomClass({
    uid: (p) => p + (++n),
    emptyGrid: R.emptyGrid, dealThree: R.dealThree, paletteForSkin: () => R.DEFAULT_COLORS,
    cloneGrid: R.cloneGrid, serializePieces: R.serializePieces, clearLinesOnGrid: R.clearLinesOnGrid,
    bonusFor: R.bonusFor, chainBonusFor: R.chainBonusFor, canPlaceOn: R.canPlaceOn,
    sideHasPlayable: R.sideHasPlayable, normalizeShape: R.normalizeShape, DEFAULT_COLORS: R.DEFAULT_COLORS,
    MIN_PLACE_INTERVAL_MS: R.MIN_PLACE_INTERVAL_MS, PLACE_BURST_WINDOW_MS: R.PLACE_BURST_WINDOW_MS,
    PLACE_BURST_MAX: R.PLACE_BURST_MAX, DC_LIMIT_MS: R.DC_LIMIT_MS, AFK_WARN_MS: R.AFK_WARN_MS,
    AFK_LIMIT_MS: R.AFK_LIMIT_MS, DETACH_GRACE_MS: R.DETACH_GRACE_MS,
    MATCH_START_GRACE_MS: R.MATCH_START_GRACE_MS, AFK_WARN_BROADCAST_MS: R.AFK_WARN_BROADCAST_MS,
    ROOM_TTL_ENDED: 60,
    log: () => {},
    hooks: {
      rooms, store: null,
      persistRoom() {}, forgetRoom() {}, startRoom() {},
      send(ws, msg) { if (ws && ws.send) ws.send(JSON.stringify(msg)); }
    }
  });
  const mkWs = (code) => ({ readyState: 1, _friendCode: code, sent: [], send(m) { this.sent.push(JSON.parse(m)); }, close() {} });
  const player = (token, ws, code) => ({ token, ws, name: token, friendCode: code, trophies: 0, skinId: 'default' });
  function newRoom(duration) {
    const wa = mkWs('AAAA1111'); const wb = mkWs('BBBB2222');
    const room = new MatchRoom(player('ta', wa, 'AAAA1111'), player('tb', wb, 'BBBB2222'), duration || 60);
    return { room, wa, wb };
  }
  function dispose() {
    for (const r of rooms.values()) { try { clock.clearInterval(r._clockTimer); } catch (_) {} }
    clock.reset();
  }
  return { fake, rooms, MatchRoom, mkWs, player, newRoom, dispose };
}

module.exports = { makeHarness };
