/**
 * Block Puzzle — lib/match-room/lifecycle.js
 * MatchRoom methods: Ready handshake, go-live, cancel, trophies, forfeit and match end.
 * Extracted from the former monolithic lib/match-room.js — behaviour unchanged.
 * Installed onto MatchRoom.prototype by createMatchRoomClass() (non-enumerable, like class methods).
 */
'use strict';
const { clock } = require('../clock');
const { withKeyLock, normKey } = require('../keyed-lock');

const { defineMethods } = require('./define-methods');

function installLifecycle(MatchRoom, ctx) {
  const {
    ROOM_TTL_ENDED,
    forgetRoom,
    getRooms,
    getStore,
    persistRoom
  } = ctx;

  defineMethods(MatchRoom.prototype, {
    /** Client finished loading boards/assets — when both ready, start the clock. */
    markReady(token) {
      if (this.status !== 'loading') {
        // Already live or ended — echo current clock so client can sync
        if (this.status === 'live') {
          this.send(token, {
            type: 'match_go',
            matchId: this.id,
            playStartTs: this.playStartTs || 0,
            clockEndTs: this.clockEndTs,
            vsTimeLeft: this.timeLeft(),
            duration: this.duration,
            introMs: this.playStartTs ? Math.max(0, (this.playStartTs - clock.now()) | 0) : 0,
            serverNow: clock.now()
          });
        }
        return;
      }
      const p = this.players[token];
      if (!p) return;
      if (!this.ready) this.ready = { a: false, b: false };
      this.ready[p.seat] = true;
      this.send(token, { type: 'match_ready_ack', seat: p.seat, matchId: this.id });
      // Notify peer that opponent is loaded
      const otherTok = this.seatOf[this.otherSeat(p.seat)];
      if (otherTok) {
        this.send(otherTok, {
          type: 'match_peer_ready',
          seat: p.seat,
          matchId: this.id
        });
      }
      if (this.ready.a && this.ready.b) {
        // Only go live when both seats still have a live socket
        const tokA = this.seatOf && this.seatOf.a;
        const tokB = this.seatOf && this.seatOf.b;
        const aOk = !!(tokA && this.players[tokA] && this.players[tokA].ws
          && this.players[tokA].ws.readyState === 1);
        const bOk = !!(tokB && this.players[tokB] && this.players[tokB].ws
          && this.players[tokB].ws.readyState === 1);
        if (aOk && bOk) this.goLive();
      }
      persistRoom(this);
    },

    /** Both players loaded — start wall clock and unlock play. */
    goLive() {
      if (this.status !== 'loading') return;
      this.status = 'live';
      // Server wall-clock intro: both clients unlock at the same playStartTs.
      // Match duration starts AFTER intro, so a late-painting client never loses seconds.
      const INTRO_MS = 2200;
      const now = clock.now();
      this.playStartTs = now + INTRO_MS;
      this.clockEndTs = this.playStartTs + (this.duration || 120) * 1000;
      if (!this.ready) this.ready = { a: true, b: true };
      else { this.ready.a = true; this.ready.b = true; }
      this.broadcast({
        type: 'match_go',
        matchId: this.id,
        playStartTs: this.playStartTs,
        clockEndTs: this.clockEndTs,
        vsTimeLeft: this.timeLeft(),
        duration: this.duration,
        introMs: INTRO_MS,
        serverNow: now
      });
      persistRoom(this);
    },

    /** Cancel match during loading (peer left / timeout) — no ranked penalty. */
    cancelLoading(reason) {
      if (this.status !== 'loading') return;
      this.status = 'ended';
      this.endedReason = reason || 'void';
      this.rematch = { a: false, b: false };
      if (this._clockTimer) {
        clock.clearInterval(this._clockTimer);
        this._clockTimer = null;
      }
      this.broadcast({
        type: 'match_end',
        reason: 'void',
        winnerSeat: null,
        clockEndTs: 0,
        matchId: this.id,
        void: true,
        preStart: true,
        rematchAllowed: false
      });
      persistRoom(this);
      // Drop room soon — no rematch window for void / pre-start cancels
      const id = this.id;
      const tokens = Object.keys(this.players);
      clock.setTimeout(() => {
        try {
          if (getRooms().get(id) === this) {
            getRooms().delete(id);
            forgetRoom(id, tokens);
          }
        } catch (_) {}
      }, 3000);
    },

    /**
     * Persist trophy changes on accounts / guest progress. Client cannot set trophies.
     * Winner +25, loser −15 (floor 0). Void / pre-start cancels: no change.
     */
    _applyTrophyResults(winnerSeat, reason) {
      const er = String(reason || this.endedReason || '');
      if (er === 'void' || er === 'peer_left' || er === 'load_timeout' || er === 'forfeit_prestart') return;
      const store = getStore();
      if (!store) return;
      const applyOne = (seat, delta) => {
        const tok0 = this.seatOf[seat];
        const p0 = tok0 && this.players[tok0];
        const code0 = p0 && p0.friendCode;
        return withKeyLock(normKey(code0), () => applyOneLocked(seat, delta));
      };
      const applyOneLocked = async (seat, delta) => {
        try {
          const tok = this.seatOf[seat];
          const p = tok && this.players[tok];
          const code = (p && p.friendCode)
            ? String(p.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
            : '';
          if (!code) return;
          let next = Math.max(0, (this.state[seat].trophies | 0) + delta);
          this.state[seat].trophies = next;
          if (typeof store.adjustAccountCounters === 'function') {
            // Atomic in the store (single UPDATE with clamp in Postgres): no read-modify-write window
            const nt = await store.adjustAccountCounters(code, { trophies: delta });
            if (nt != null) { this.state[seat].trophies = nt; return; }
          }
          if (typeof store.loadGuestProgress === 'function' && typeof store.saveGuestProgress === 'function') {
            let gp = null;
            try { gp = await store.loadGuestProgress(code); } catch (_) { gp = null; }
            gp = gp && typeof gp === 'object' ? gp : { friendCode: code };
            gp.trophies = Math.max(0, Math.min(999999, ((gp.trophies | 0) || 0) + delta));
            gp.friendCode = code;
            await store.saveGuestProgress(code, gp);
          }
        } catch (_) {}
      };
      if (winnerSeat === 'a' || winnerSeat === 'b') {
        const loser = winnerSeat === 'a' ? 'b' : 'a';
        applyOne(winnerSeat, 25);
        applyOne(loser, -15);
      }
    },

    forfeit(token) {
      if (this.status === 'loading') {
        this.cancelLoading('forfeit_prestart');
        return;
      }
      if (this.status !== 'live') return;
      const p = this.players[token];
      if (!p) return;
      const loser = p.seat;
      const winner = this.otherSeat(loser);
      this.end('forfeit', winner);
    },

    end(reason, winnerSeat) {
      if (this.status === 'ended') return;
      this.status = 'ended';
      this.endedReason = reason || 'time';
      if (this._clockTimer) {
        clock.clearInterval(this._clockTimer);
        this._clockTimer = null;
      }
      this.rematch = { a: false, b: false };
      const payload = {
        type: 'match_end',
        reason: this.endedReason,
        winnerSeat: winnerSeat || null,
        clockEndTs: this.clockEndTs,
        matchId: this.id,
        moves: (this.state.moves || []).slice(-160),
        moveCount: (this.state.moves && this.state.moves.length) || 0,
        a: {
          score: this.state.a.score | 0,
          name: this.state.a.name,
          skinId: this.state.a.skinId || 'default',
          boardId: this.state.a.boardId || 'field_default'
        },
        b: {
          score: this.state.b.score | 0,
          name: this.state.b.name,
          skinId: this.state.b.skinId || 'default',
          boardId: this.state.b.boardId || 'field_default'
        }
      };
      // Deliver to both even if one socket is flaky — try twice
      this.broadcast(payload);
      try {
        clock.setTimeout(() => {
          try {
            if (this.status === 'ended') this.broadcast(payload);
          } catch (_) {}
        }, 300);
      } catch (_) {}
      // Server-authoritative trophy delta (ranked / private with friend codes)
      try {
        this._applyTrophyResults(winnerSeat, reason);
      } catch (_) {}
      persistRoom(this);
      // Keep room for rejoin + rematch window
      const id = this.id;
      const tokens = Object.keys(this.players);
      clock.setTimeout(() => {
        getRooms().delete(id);
        forgetRoom(id, tokens);
      }, ROOM_TTL_ENDED * 1000);
    }
  });
}

module.exports = { installLifecycle };
