/**
 * Block Puzzle — lib/match-room/tick.js
 * MatchRoom methods: Periodic server tick: timers, AFK, disconnect and clock handling.
 * Extracted from the former monolithic lib/match-room.js — behaviour unchanged.
 * Installed onto MatchRoom.prototype by createMatchRoomClass() (non-enumerable, like class methods).
 */
'use strict';

const { clock } = require('../clock');
const { defineMethods } = require('./define-methods');

function installTick(MatchRoom, ctx) {
  const {
    AFK_LIMIT_MS,
    AFK_WARN_BROADCAST_MS,
    AFK_WARN_MS,
    MATCH_START_GRACE_MS,
    dealForSeat,
    serializePieces,
    sideHasPlayable
  } = ctx;

  defineMethods(MatchRoom.prototype, {
    _tick() {
      const now = clock.now();
      // Loading phase: wait for both ready, force-start after timeout
      if (this.status === 'loading') {
        const loadAge = now - (this.createdAt || now);
        const LOAD_TIMEOUT_MS = 20000;
        if (loadAge >= LOAD_TIMEOUT_MS) {
          // One or both never ready — if at least one is connected, force go;
          // if neither, cancel.
          const aOnline = !!(this.players[this.seatOf.a] && this.players[this.seatOf.a].ws);
          const bOnline = !!(this.players[this.seatOf.b] && this.players[this.seatOf.b].ws);
          if (aOnline && bOnline) {
            this.goLive();
          } else {
            this.cancelLoading('load_timeout');
          }
        }
        return;
      }
      if (this.status !== 'live') return;
      const left = this.timeLeft();
      const matchAge = this.clockEndTs
        ? (now - (this.clockEndTs - (this.duration || 120) * 1000))
        : (now - (this.createdAt || now));
      const startGrace = (typeof MATCH_START_GRACE_MS === 'number') ? MATCH_START_GRACE_MS : 12000;
      // Only real placements count: the two opening 'deal' entries are always in state.moves
      const movesN = (this.state.moves || []).filter((m) => m && m.type === 'place').length;

      if (left <= 0) {
        const a = this.state.a.score | 0;
        const b = this.state.b.score | 0;
        let winner = null;
        if (a > b) winner = 'a';
        else if (b > a) winner = 'b';
        this.end('time', winner);
        return;
      }

      // Auto-deal empty hands (never treat as stuck)
      for (const seat of ['a', 'b']) {
        const st = this.state[seat];
        if (!st || !st.pieces) continue;
        if (st.pieces.length && st.pieces.every(pc => pc && pc.used)) {
          st.pieces = dealForSeat(st);
          try {
            const tok = this.seatOf[seat];
            this.send(tok, {
              type: 'deal',
              pieces: serializePieces(st.pieces),
              vsTimeLeft: left,
              clockEndTs: this.clockEndTs
            });
          } catch (_) {}
        }
      }

      for (const seat of ['a', 'b']) {
        const st = this.state[seat];
        if (!st) continue;
        const oppSeat = seat === 'a' ? 'b' : 'a';
        const oppSt = this.state[oppSeat];

        // Pending soft-detach: still treated as online for AFK/DC
        if (st._detachPending && !st.online) {
          // not yet confirmed offline
        }

        // ——— Disconnect rules (strict) ———
        // Offline → wait DC_LIMIT (60s). Rejoin clears timer + restores state via snapshot.
        // Both offline → each has own 60s from their offlineSince. First timer to expire loses.
        // If both timers expire in the same tick / simultaneous leave → score comparison.
        // Connection flaps during DETACH_GRACE do not start the timer.
        // Offline OR rejoined but still pending a place — same deadline continues
        const underDc = !!(st.dcDeadlineTs > 0 && !st._detachPending && (!st.online || st.rejoinPendingMove));
        if (underDc && now >= st.dcDeadlineTs) {
          // Collect who else is past deadline this tick
          const aSt = this.state.a;
          const bSt = this.state.b;
          const seatPast = (s) => !!(s && s.dcDeadlineTs > 0 && !s._detachPending
            && (!s.online || s.rejoinPendingMove) && now >= s.dcDeadlineTs);
          const aPast = seatPast(aSt);
          const bPast = seatPast(bSt);

          // No real play yet → void cancel (not a scored draw)
          if (movesN === 0) {
            this.end('void', null);
            return;
          }

          if (aPast && bPast) {
            // Both timed out — simultaneous / mutual leave → by score
            const aSc = aSt.score | 0;
            const bSc = bSt.score | 0;
            let winner = null;
            if (aSc > bSc) winner = 'a';
            else if (bSc > aSc) winner = 'b';
            this.end('disconnect', winner);
            return;
          }

          // Only this seat timed out → opponent wins
          this.end('disconnect', oppSeat);
          return;
        }

        // AFK — after start grace, with playable hand.
        // Soft-detach grace still counts as online for AFK so a page refresh does not
        // freeze the opponent toast or pause the idle clock. Skip only when DC /
        // rejoin-pending owns the deadline (one timer only).
        const trulyOnline = !!(st.online && !st.rejoinPendingMove);
        if (trulyOnline && !(st.dcDeadlineTs > now) && !st.stuck && matchAge >= startGrace) {
          const playable = sideHasPlayable(st.grid, st.pieces);
          if (playable === false || playable === null) {
            st.lastActionAt = now;
            st.afkWarned = false;
          } else {
            const idle = now - (st.lastActionAt || now);
            if (idle >= AFK_LIMIT_MS) {
              // Don't AFK-end if opponent is offline (give them DC path instead)
              if (oppSt && !oppSt.online) {
                st.lastActionAt = now; // freeze while opp offline
              } else if (movesN === 0) {
                // Nobody placed yet — soft reset, not a forfeit
                st.lastActionAt = now;
                st.afkWarned = false;
              } else {
                this.end('afk', oppSeat);
                return;
              }
            } else if (idle >= AFK_WARN_MS) {
              st.afkWarned = true;
              const remain = Math.max(1, Math.ceil((AFK_LIMIT_MS - idle) / 1000));
              const minGap = (typeof AFK_WARN_BROADCAST_MS === 'number') ? AFK_WARN_BROADCAST_MS : 2000;
              if (!st._lastAfkWarnAt || (now - st._lastAfkWarnAt) >= minGap) {
                st._lastAfkWarnAt = now;
                this.broadcast({
                  type: 'afk_warn',
                  seat: seat,
                  remaining: remain,
                  vsTimeLeft: left,
                  clockEndTs: this.clockEndTs
                });
              }
            } else if (st.afkWarned && idle < AFK_WARN_MS) {
              st.afkWarned = false;
            }
          }
        }

        if (underDc) {
          const dcRem = Math.max(0, Math.ceil((st.dcDeadlineTs - now) / 1000));
          // 1s step so the disconnect / AFK-continue countdown does not jump by 2s
          if (!st._lastDcBroadcastAt || (now - st._lastDcBroadcastAt) >= 1000) {
            st._lastDcBroadcastAt = now;
            const isPending = !!(st.online && st.rejoinPendingMove);
            const dcReason = isPending
              ? 'rejoin_pending'
              : (st._dcFromAfk ? 'afk_disconnect' : 'disconnect');
            this.broadcast({
              type: 'player_status',
              seat: seat,
              online: !!st.online,
              rejoinPendingMove: isPending,
              awaitingMove: isPending,
              clockEndTs: this.clockEndTs,
              vsTimeLeft: left,
              dcDeadlineTs: st.dcDeadlineTs,
              dcRemaining: dcRem,
              reason: dcReason
            });
          }
        }
      }

      this.broadcast({
        type: 'clock',
        vsTimeLeft: left,
        clockEndTs: this.clockEndTs
      });
      // Stuck evaluation only after start grace and at least one real place
      if (matchAge >= startGrace && movesN > 0) {
        this.evaluateStuck();
      }
    }
  });
}

module.exports = { installTick };
