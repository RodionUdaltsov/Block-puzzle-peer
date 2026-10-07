/**
 * v9.4 adversarial pass: every in-match WS message carrying a leaked/foreign match token.
 * In-process (MatchRoom + real ws handler code, fake sockets, fake clock) — no server process.
 */
'use strict';
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { makeHarness } = require('./helpers/match-room-harness');
const { createWsContext } = require('../lib/ws/context');
const { handleMatch } = require('../lib/ws/handlers/match');

describe('in-match messages with a foreign match token', () => {
  let h; let room; let wa; let wb; let shared; let thief; let sentToThief;

  beforeEach(() => {
    h = makeHarness();
    ({ room, wa, wb } = h.newRoom(120));
    room.markReady('ta'); room.markReady('tb');
    h.fake.advance(3000);
    const hooks = { rooms: h.rooms, send: (ws, m) => ws.send(JSON.stringify(m)) };
    const ctx = createWsContext({ hooks, uid: () => 'x', allowWsMessage: () => true, log: () => {}, Cosmetics: {}, MatchRoom: h.MatchRoom });
    shared = { resolveMatchCtx: ctx.resolveMatchCtx, rooms: h.rooms, send: hooks.send };
    thief = h.mkWs('CCCC3333'); // verified as someone else, holds A's leaked token
    sentToThief = () => thief.sent;
    room.attach('ta', wa); room.attach('tb', wb);
  });
  afterEach(() => h.dispose());

  const leaked = (extra) => Object.assign({ matchId: undefined, token: 'ta' }, extra || {});

  for (const type of ['match_ready', 'place', 'deal', 'sync', 'forfeit']) {
    it(type + ': foreign socket cannot take the seat or act for it', () => {
      handleMatch(type, thief, leaked({ matchId: room.id, r: 0, c: 0, pieceIdx: 0 }), shared);
      assert.equal(room.players.ta.ws, wa, 'seat must stay attached to its owner');
      assert.equal(thief._token, undefined);
      assert.equal(room.status, 'live', 'a foreign forfeit must not end the match');
    });
  }

  it('the real owner on a new socket (same verified identity) still can rejoin the seat via a message', () => {
    const wa2 = h.mkWs('AAAA1111');
    handleMatch('sync', wa2, { matchId: room.id, token: 'ta' }, shared);
    assert.equal(room.players.ta.ws, wa2);
  });

  describe('rematch_* after the match ended', () => {
    beforeEach(() => {
      room.end('time', null);
      assert.equal(room.status, 'ended');
    });

    for (const type of ['rematch_offer', 'rematch_accept', 'rematch_decline', 'rematch_cancel']) {
      it(type + ': foreign socket with a leaked token has no effect', () => {
        room.offerRematch('tb');
        const before = JSON.stringify(room.rematch);
        const aBefore = wa.sent.length; const bBefore = wb.sent.length;
        handleMatch(type, thief, leaked({ matchId: room.id }), shared);
        assert.equal(room.players.ta.ws, wa);
        assert.equal(JSON.stringify(room.rematch), before);
        assert.equal(wa.sent.length, aBefore, 'owner must not be notified of a foreign action');
        assert.equal(wb.sent.length, bBefore, 'opponent must not be notified of a foreign action');
      });
    }

    it('rematch_decline from the real owner still works', () => {
      room.offerRematch('tb');
      handleMatch('rematch_decline', wa, { matchId: room.id, token: 'ta' }, shared);
      assert.ok(wb.sent.some((m) => m.type === 'rematch_decline'));
    });

    it('rematch_cancel from the real owner still works', () => {
      room.offerRematch('ta');
      handleMatch('rematch_cancel', wa, { matchId: room.id, token: 'ta' }, shared);
      assert.equal(room.rematch.a, false);
    });
  });
});
