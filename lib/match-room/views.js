/**
 * Block Puzzle — lib/match-room/views.js
 * MatchRoom methods: Time left, per-seat snapshots, send/broadcast helpers.
 * Extracted from the former monolithic lib/match-room.js — behaviour unchanged.
 * Installed onto MatchRoom.prototype by createMatchRoomClass() (non-enumerable, like class methods).
 */
'use strict';

const { clock } = require('../clock');
const { defineMethods } = require('./define-methods');

function installViews(MatchRoom, ctx) {
  const {
    cloneGrid,
    serializePieces,
    hooks
  } = ctx;

  defineMethods(MatchRoom.prototype, {
    timeLeft() {
      if (!this.clockEndTs || this.status === 'loading') {
        return this.duration || 120;
      }
      // During intro (before playStartTs) report full match duration
      if (this.playStartTs && clock.now() < this.playStartTs) {
        return this.duration || 120;
      }
      return Math.max(0, Math.ceil((this.clockEndTs - clock.now()) / 1000));
    },

    /** Snapshot for a given player (their seat = "me") */
    snapshotFor(token) {
      const p = this.players[token];
      if (!p) return null;
      const me = p.seat;
      const opp = this.otherSeat(me);
      return {
        type: 'state',
        matchId: this.id,
        token: token,
        seat: me,
        status: this.status,
        endedReason: this.endedReason,
        duration: this.duration,
        clockEndTs: this.clockEndTs,
        vsTimeLeft: this.timeLeft(),
        source: this.source || 'ranked',
        me: {
          score: this.state[me].score,
          grid: cloneGrid(this.state[me].grid),
          pieces: serializePieces(this.state[me].pieces),
          name: this.state[me].name,
          trophies: this.state[me].trophies | 0,
          skinId: this.state[me].skinId || 'default',
          boardId: this.state[me].boardId || 'field_default',
          avatarId: this.state[me].avatarId || 'init',
          avatarCustom: this.state[me].avatarCustom || '',
          online: this.state[me].online
        },
        opp: {
          score: this.state[opp].score,
          grid: cloneGrid(this.state[opp].grid),
          pieces: serializePieces(this.state[opp].pieces),
          name: this.state[opp].name,
          trophies: this.state[opp].trophies | 0,
          skinId: this.state[opp].skinId || 'default',
          boardId: this.state[opp].boardId || 'field_default',
          avatarId: this.state[opp].avatarId || 'init',
          avatarCustom: this.state[opp].avatarCustom || '',
          online: this.state[opp].online
        },
        moves: this.state.moves.slice(-80)
      };
    },

    send(token, msg) {
      const p = this.players[token];
      if (p && p.ws && p.ws.readyState === 1) {
        try { p.ws.send(JSON.stringify(msg)); } catch (_) {}
        return;
      }
      // Multi-instance: player WS lives on another Node — deliver via Redis coord
      if (hooks && typeof hooks.deliverToToken === 'function') {
        try { hooks.deliverToToken(token, msg); } catch (_) {}
      }
    },

    broadcast(msg, exceptToken) {
      for (const token of Object.keys(this.players)) {
        if (exceptToken && token === exceptToken) continue;
        this.send(token, msg);
      }
    },

    broadcastState() {
      for (const token of Object.keys(this.players)) {
        const snap = this.snapshotFor(token);
        if (snap) this.send(token, snap);
      }
    }
  });
}

module.exports = { installViews };
