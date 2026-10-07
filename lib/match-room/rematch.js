/**
 * Block Puzzle — lib/match-room/rematch.js
 * MatchRoom methods: Rematch offer / accept / cancel / decline / start.
 * Extracted from the former monolithic lib/match-room.js — behaviour unchanged.
 * Installed onto MatchRoom.prototype by createMatchRoomClass() (non-enumerable, like class methods).
 */
'use strict';

const { clock } = require('../clock');
const { defineMethods } = require('./define-methods');

function installRematch(MatchRoom, ctx) {
  const {
    forgetRoom,
    getRooms,
    startRoom
  } = ctx;

  defineMethods(MatchRoom.prototype, {
    offerRematch(token) {
      if (this.status !== 'ended') return;
      // No rematch after void / pre-start cancel
      const er = String(this.endedReason || '');
      if (er === 'void' || er === 'peer_left' || er === 'load_timeout' || er === 'forfeit_prestart') {
        this.send(token, { type: 'rematch_decline', matchId: this.id, reason: 'void', self: true });
        return;
      }
      const p = this.players[token];
      if (!p) return;
      if (!this.rematch) this.rematch = { a: false, b: false };
      this.rematch[p.seat] = true;
      const other = this.otherSeat(p.seat);
      const otherTok = this.seatOf[other];
      this.send(otherTok, {
        type: 'rematch_invite',
        matchId: this.id,
        from: this.state[p.seat].name,
        seat: p.seat
      });
      this.send(token, { type: 'rematch_wait', matchId: this.id });
      // If both already want — start immediately
      if (this.rematch.a && this.rematch.b) this.startRematch();
    },

    acceptRematch(token) {
      if (this.status !== 'ended') return;
      const er = String(this.endedReason || '');
      if (er === 'void' || er === 'peer_left' || er === 'load_timeout' || er === 'forfeit_prestart') {
        this.send(token, { type: 'rematch_decline', matchId: this.id, reason: 'void', self: true });
        return;
      }
      const p = this.players[token];
      if (!p) return;
      if (!this.rematch) this.rematch = { a: false, b: false };
      this.rematch[p.seat] = true;
      this.send(token, { type: 'rematch_wait', matchId: this.id });
      if (this.rematch.a && this.rematch.b) this.startRematch();
    },

    /** Inviter cancels their own rematch request — other side drops invite. */
    cancelRematch(token) {
      if (this.status !== 'ended') return;
      const p = this.players[token];
      if (!p) return;
      if (this.rematch) this.rematch[p.seat] = false;
      const otherTok = this.seatOf[this.otherSeat(p.seat)];
      this.send(otherTok, {
        type: 'rematch_cancel',
        matchId: this.id,
        name: this.state[p.seat].name,
        seat: p.seat
      });
      this.send(token, { type: 'rematch_cancel', matchId: this.id, self: true });
    },

    declineRematch(token) {
      if (this.status !== 'ended') return;
      const p = this.players[token];
      if (!p) return;
      if (this.rematch) {
        this.rematch.a = false;
        this.rematch.b = false;
      }
      const otherTok = this.seatOf[this.otherSeat(p.seat)];
      this.send(otherTok, {
        type: 'rematch_decline',
        matchId: this.id,
        name: this.state[p.seat].name
      });
      this.send(token, { type: 'rematch_decline', matchId: this.id, self: true });
    },

    startRematch() {
      if (this.status !== 'ended') return;
      const tokA = this.seatOf.a;
      const tokB = this.seatOf.b;
      const pa = this.players[tokA];
      const pb = this.players[tokB];
      if (!pa || !pb) return;
      // Both must still be connected
      if (!pa.ws || pa.ws.readyState !== 1 || !pb.ws || pb.ws.readyState !== 1) {
        this.broadcast({ type: 'rematch_decline', reason: 'offline', matchId: this.id });
        if (this.rematch) { this.rematch.a = false; this.rematch.b = false; }
        return;
      }
      const duration = this.duration || 120;
      const oldId = this.id;
      // Carry cosmetics into the new room so skins/avatars load immediately
      const p1 = {
        token: tokA,
        ws: pa.ws,
        name: this.state.a.name,
        trophies: this.state.a.trophies | 0,
        skinId: this.state.a.skinId || 'default',
        boardId: this.state.a.boardId || 'field_default',
        avatarId: this.state.a.avatarId || 'init',
        avatarCustom: this.state.a.avatarCustom || '',
        duration: duration
      };
      const p2 = {
        token: tokB,
        ws: pb.ws,
        name: this.state.b.name,
        trophies: this.state.b.trophies | 0,
        skinId: this.state.b.skinId || 'default',
        boardId: this.state.b.boardId || 'field_default',
        avatarId: this.state.b.avatarId || 'init',
        avatarCustom: this.state.b.avatarCustom || '',
        duration: duration
      };
      // Stop old clock before swapping rooms
      try {
        if (this._clockTimer) { clock.clearInterval(this._clockTimer); this._clockTimer = null; }
      } catch (_) {}
      getRooms().delete(oldId);
      forgetRoom(oldId, [tokA, tokB]);
      const room = startRoom(p1, p2, { source: this.source || 'ranked', code: this.privateCode || null });
      // Bind new match id on sockets
      try {
        if (pa.ws) { pa.ws._matchId = room.id; pa.ws._token = tokA; }
        if (pb.ws) { pb.ws._matchId = room.id; pb.ws._token = tokB; }
      } catch (_) {}
    }
  });
}

module.exports = { installRematch };
