/**
 * Block Puzzle — lib/match-room/connection.js
 * MatchRoom methods: Socket attach/detach and the delayed disconnect confirmation.
 * Extracted from the former monolithic lib/match-room.js — behaviour unchanged.
 * Installed onto MatchRoom.prototype by createMatchRoomClass() (non-enumerable, like class methods).
 */
'use strict';

const { clock } = require('../clock');
const { defineMethods } = require('./define-methods');

function installConnection(MatchRoom, ctx) {
  const {
    AFK_LIMIT_MS,
    AFK_WARN_MS,
    DC_LIMIT_MS,
    DETACH_GRACE_MS,
    log,
    persistRoom,
    sideHasPlayable
  } = ctx;

  defineMethods(MatchRoom.prototype, {
    attach(token, ws) {
      const p = this.players[token];
      if (!p) return false;
      // Cross-instance: remote seat may be attached with ws === null (delivery via Redis).
      // Never write to null; still register the seat so the room can start.
      // Allow attach on ended rooms (rematch / result screen)
      // Replace previous socket without treating it as a fresh disconnect
      if (ws && p.ws && p.ws !== ws) {
        try {
          p.ws._matchId = null; // prevent stale close from detaching us
          p.ws._token = null;
          try { p.ws.close(); } catch (_) {}
        } catch (_) {}
      }
      p.ws = ws || null;
      p.online = !!ws;
      p.lastSeen = clock.now();
      const st = this.state[p.seat];
      // Cancel pending soft-detach (refresh within grace — DC never started)
      const wasGraceOnly = !!st._detachPending;
      try {
        if (st._detachTimer) {
          clock.clearTimeout(st._detachTimer);
          st._detachTimer = null;
        }
        st._detachPending = false;
      } catch (_) {}
      st.online = !!ws;
      st.lastSeen = clock.now();
      st.offlineSince = ws ? 0 : clock.now();
      const nowA = clock.now();
      if (ws) {
        ws._matchId = this.id;
        ws._token = token;
      } else {
        // Remote seat (other instance owns the WS) — seat registered, no local status fanout
        return true;
      }

      // Keep DC countdown across rejoin until a real place (or clear if no moves).
      // Grace-only refresh (never confirmed offline) → full clear, no plaque.
      const hadActiveDc = !wasGraceOnly && st.dcDeadlineTs > nowA;
      let playable = true;
      try {
        playable = sideHasPlayable(st.grid, st.pieces);
      } catch (_) { playable = true; }
      // null = empty hand / deal pending — treat as "can still act" (keep timer)
      // false = truly no placement possible → drop plaque on rejoin
      const noMovesLeft = (playable === false);

      if (hadActiveDc && !noMovesLeft) {
        // Timer continues; player must place to clear the plaque
        st.rejoinPendingMove = true;
        // Do NOT reset lastActionAt / AFK — DC path owns the deadline
        st.afkWarned = false;
        st._lastAfkWarnAt = 0;
        const dcRem = Math.max(0, Math.ceil((st.dcDeadlineTs - nowA) / 1000));
        this.broadcast({
          type: 'player_status',
          seat: p.seat,
          online: true,
          clockEndTs: this.clockEndTs,
          vsTimeLeft: this.timeLeft(),
          dcDeadlineTs: st.dcDeadlineTs,
          dcRemaining: dcRem,
          rejoinPendingMove: true,
          awaitingMove: true,
          reason: 'rejoin_pending'
        }, token);
      } else if (noMovesLeft) {
        // No placements possible → drop any DC/AFK plaque on rejoin
        st.dcDeadlineTs = 0;
        st.rejoinPendingMove = false;
        st._dcFromAfk = false;
        st.lastActionAt = nowA;
        st.afkWarned = false;
        st._lastAfkWarnAt = 0;
        this.broadcast({
          type: 'player_status',
          seat: p.seat,
          online: true,
          clockEndTs: this.clockEndTs,
          vsTimeLeft: this.timeLeft(),
          dcDeadlineTs: 0,
          dcRemaining: 0,
          rejoinPendingMove: false,
          idleMs: 0,
          awaitingMove: false,
          reason: 'online'
        }, token);
      } else {
        // Grace refresh or plain rejoin without DC — NEVER reset lastActionAt.
        // Quick page reload must not wipe AFK progress or restart the 15s window.
        st.dcDeadlineTs = 0;
        st.rejoinPendingMove = false;
        st._dcFromAfk = false;
        const idle = Math.max(0, nowA - (st.lastActionAt || nowA));
        const inAfk = idle >= AFK_WARN_MS;
        st.afkWarned = inAfk;
        // Force next tick to re-broadcast afk_warn so opponent toast does not stay frozen
        st._lastAfkWarnAt = 0;
        this.broadcast({
          type: 'player_status',
          seat: p.seat,
          online: true,
          clockEndTs: this.clockEndTs,
          vsTimeLeft: this.timeLeft(),
          dcDeadlineTs: 0,
          dcRemaining: 0,
          rejoinPendingMove: false,
          idleMs: idle,
          awaitingMove: false,
          reason: inAfk ? 'afk_resume' : 'online'
        }, token);
        if (inAfk) {
          const remain = Math.max(1, Math.ceil((AFK_LIMIT_MS - idle) / 1000));
          this.broadcast({
            type: 'afk_warn',
            seat: p.seat,
            remaining: remain,
            vsTimeLeft: this.timeLeft(),
            clockEndTs: this.clockEndTs
          });
          st._lastAfkWarnAt = nowA;
        }
      }

      // Tell rejoiner the opponent's current online status only (does not touch opp state)
      try {
        const oppSeat = this.otherSeat(p.seat);
        const oppSt = this.state[oppSeat];
        if (oppSt) {
          const now = clock.now();
          const oppUnderDc = !!(oppSt.dcDeadlineTs > now && (!oppSt.online || oppSt.rejoinPendingMove));
          const dcRem = oppUnderDc
            ? Math.max(0, Math.ceil((oppSt.dcDeadlineTs - now) / 1000))
            : 0;
          this.send(token, {
            type: 'player_status',
            seat: oppSeat,
            online: !!oppSt.online,
            clockEndTs: this.clockEndTs,
            vsTimeLeft: this.timeLeft(),
            dcDeadlineTs: oppUnderDc ? (oppSt.dcDeadlineTs || 0) : 0,
            dcRemaining: dcRem,
            rejoinPendingMove: !!(oppSt.online && oppSt.rejoinPendingMove),
            reason: oppUnderDc
              ? (oppSt.online ? 'rejoin_pending' : (oppSt._dcFromAfk ? 'afk_disconnect' : 'disconnect'))
              : (oppSt.online ? 'online' : 'disconnect')
          });
        }
      } catch (_) {}
      persistRoom(this);
      return true;
    },

    detach(token, closedWs) {
      const p = this.players[token];
      if (!p) return;
      if (this.status === 'loading') {
        // Peer left before start — void the match, no AFK/history
        try {
          if (closedWs && p.ws && p.ws !== closedWs) return;
          if (closedWs && p.ws === closedWs) p.ws = null;
          else if (!closedWs) p.ws = null;
        } catch (_) {}
        this.cancelLoading('peer_left');
        return;
      }
      if (this.status !== 'live') return;
      // Ignore stale close: a newer socket already re-attached
      if (closedWs && p.ws && p.ws !== closedWs) {
        return;
      }
      // Socket gone, but do NOT mark offline / start DC yet — grace for refresh storms
      if (closedWs && p.ws === closedWs) {
        p.ws = null;
      } else if (!closedWs) {
        p.ws = null;
      }
      const st = this.state[p.seat];
      const seat = p.seat;
      // Cancel prior pending detach
      try {
        if (st._detachTimer) {
          clock.clearTimeout(st._detachTimer);
          st._detachTimer = null;
        }
      } catch (_) {}
      st._detachPending = true;
      st._detachAt = clock.now();
      const grace = (typeof DETACH_GRACE_MS === 'number') ? DETACH_GRACE_MS : 5000;
      st._detachTimer = clock.setTimeout(() => {
        try {
          this._confirmDetach(token, seat);
        } catch (e) {
          log('warn', 'confirmDetach', { err: e && e.message });
        }
      }, grace);
    },

    /** Apply offline + DC timer only after grace — cancelled if player re-attaches. */
    _confirmDetach(token, seat) {
      const p = this.players[token];
      if (!p || this.status !== 'live') return;
      // Re-attached with a live socket → abort
      if (p.ws && p.ws.readyState === 1) {
        const st = this.state[p.seat];
        if (st) {
          st._detachPending = false;
          st._detachTimer = null;
        }
        return;
      }
      const st = this.state[p.seat];
      if (!st) return;
      st._detachTimer = null;
      st._detachPending = false;

      p.online = false;
      p.lastSeen = clock.now();
      st.online = false;
      st.lastSeen = clock.now();
      const now = clock.now();
      st.offlineSince = now;

      // Track flaps
      st.detachCount = (st.detachCount || 0) + 1;
      st.lastDetachAt = now;

      // Idle relative to last real action (place). If player was already in AFK
      // warning window, keep the SAME remaining countdown — do not reset to full
      // DC_LIMIT and do not run a second parallel timer.
      const idle = Math.max(0, now - (st.lastActionAt || now));
      const matchLeftMs = Math.max(0, (this.clockEndTs || now) - now);
      let dcMs;
      let reason = 'disconnect';
      if (idle >= AFK_WARN_MS) {
        // Continue AFK countdown as disconnect: remaining = AFK_LIMIT - idle
        const afkRemain = Math.max(1000, AFK_LIMIT_MS - idle);
        dcMs = afkRemain;
        if (matchLeftMs > 0 && matchLeftMs < dcMs) dcMs = matchLeftMs;
        reason = 'afk_disconnect';
      } else {
        // Normal disconnect: full 60s (or remaining match time if shorter)
        dcMs = DC_LIMIT_MS;
        if (matchLeftMs > 0 && matchLeftMs < dcMs) dcMs = matchLeftMs;
        // Minimum 5s so tiny clock remainder still allows a brief rejoin
        if (dcMs < 5000 && matchLeftMs >= 5000) dcMs = 5000;
        if (dcMs < 1000) dcMs = Math.max(1000, matchLeftMs);
      }
      st.dcDeadlineTs = now + dcMs;
      st.offlineSince = now;
      st.rejoinPendingMove = false;
      st._dcFromAfk = (reason === 'afk_disconnect');
      // Stop AFK warn spam while offline — DC path owns the UI now
      st.afkWarned = false;
      st._lastAfkWarnAt = 0;

      this.broadcast({
        type: 'player_status',
        seat: p.seat,
        online: false,
        clockEndTs: this.clockEndTs,
        vsTimeLeft: this.timeLeft(),
        dcDeadlineTs: st.dcDeadlineTs,
        dcRemaining: Math.max(0, Math.ceil(dcMs / 1000)),
        reason: reason
      }, token);
      persistRoom(this);
    }
  });
}

module.exports = { installConnection };
