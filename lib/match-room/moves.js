/**
 * Block Puzzle — lib/match-room/moves.js
 * MatchRoom methods: Authoritative move handling: place, stuck evaluation, deal, sync.
 * Extracted from the former monolithic lib/match-room.js — behaviour unchanged.
 * Installed onto MatchRoom.prototype by createMatchRoomClass() (non-enumerable, like class methods).
 */
'use strict';

const { clock } = require('../clock');
const { defineMethods } = require('./define-methods');

function installMoves(MatchRoom, ctx) {
  const {
    DEFAULT_COLORS,
    MIN_PLACE_INTERVAL_MS,
    PLACE_BURST_MAX,
    PLACE_BURST_WINDOW_MS,
    bonusFor,
    canPlaceOn,
    chainBonusFor,
    clearLinesOnGrid,
    cloneGrid,
    dealForSeat,
    normalizeShape,
    persistRoom,
    serializePieces,
    sideHasPlayable
  } = ctx;

  defineMethods(MatchRoom.prototype, {
    applyPlace(token, data) {
      if (this.status !== 'live') return;
      const p = this.players[token];
      if (!p) return;
      const seat = p.seat;
      const st = this.state[seat];
      const reject = (reason) => {
        this.send(token, {
          type: 'place_reject',
          reason: reason || 'invalid',
          score: st.score,
          grid: cloneGrid(st.grid),
          pieces: serializePieces(st.pieces),
          vsTimeLeft: this.timeLeft(),
          clockEndTs: this.clockEndTs
        });
      };

      // Rate limit / anti-spam
      const now = clock.now();
      if (st.lastPlaceAt && (now - st.lastPlaceAt) < MIN_PLACE_INTERVAL_MS) {
        return reject('rate_limit');
      }
      st.placeTimes = (st.placeTimes || []).filter(t => now - t < PLACE_BURST_WINDOW_MS);
      if (st.placeTimes.length >= PLACE_BURST_MAX) {
        return reject('rate_limit');
      }

      const pieceIdx = data.pieceIdx | 0;
      if (pieceIdx < 0 || pieceIdx >= st.pieces.length) return reject('bad_piece_idx');
      const handPiece = st.pieces[pieceIdx];
      if (!handPiece || handPiece.used) return reject('piece_used');

      // Server-authoritative move validation: the client may only choose which
      // hand piece to place and its anchor coordinates. Shape/color/score are
      // always taken from the server's current hand state. Never trust or
      // fall back to client-supplied shape/color data for gameplay.
      const shape = normalizeShape(handPiece.shape);
      if (!shape.length) return reject('shape_mismatch');

      const r = data.r | 0;
      const c = data.c | 0;
      if (!canPlaceOn(st.grid, shape, r, c)) return reject('cannot_place');

      // Apply cells
      const color = handPiece.color || DEFAULT_COLORS[0];
      for (const [dr, dc] of shape) {
        st.grid[r + dr][c + dc] = color;
      }
      handPiece.used = true;
      st.lastPlaceAt = now;
      st.lastActionAt = now;
      st.afkWarned = false;
      st.offlineSince = 0;
      st.dcDeadlineTs = 0;
      st.rejoinPendingMove = false;
      st._dcFromAfk = false;
      st.placeTimes.push(now);
      st.stuck = false;
      // Clear disconnect/AFK UI for both clients
      try {
        this.broadcast({
          type: 'player_status',
          seat: seat,
          online: true,
          rejoinPendingMove: false,
          dcDeadlineTs: 0,
          dcRemaining: 0,
          reason: 'active'
        });
      } catch (_) {}

      const placePts = shape.length * 10;
      let scoreDelta = placePts;
      const clearInfo = clearLinesOnGrid(st.grid);
      const cleared = clearInfo.count || 0;
      let bonus = 0;
      let chainExtra = 0;
      if (cleared > 0) {
        st.clearChain = (st.clearChain || 0) + 1;
        const baseBonus = bonusFor(cleared);
        chainExtra = chainBonusFor(st.clearChain);
        bonus = baseBonus + chainExtra;
        scoreDelta += bonus;
      } else {
        st.clearChain = 0;
      }
      st.score = Math.max(0, (st.score | 0) + scoreDelta);

      // Auto-deal when hand exhausted
      let newDeal = null;
      if (st.pieces.every(pc => pc && pc.used)) {
        st.pieces = dealForSeat(st);
        newDeal = serializePieces(st.pieces);
      }

      this.state.moves.push({
        type: 'place',
        seat,
        t: clock.now() - this.createdAt,
        r,
        c,
        pieceIdx,
        shape: shape.map(s => s.slice()),
        color,
        placePts,
        cleared,
        bonus,
        chain: st.clearChain,
        score: st.score
      });
      if (newDeal) {
        this.state.moves.push({
          type: 'deal',
          seat,
          t: clock.now() - this.createdAt,
          pieces: newDeal.map(p => ({
            shape: (p.shape || []).map(c => Array.isArray(c) ? c.slice() : c),
            color: p.color,
            used: !!p.used
          }))
        });
      }
      if (this.state.moves.length > 200) this.state.moves = this.state.moves.slice(-120);

      const oppToken = this.seatOf[this.otherSeat(seat)];
      const oppSeat = this.otherSeat(seat);
      const oppSt = this.state[oppSeat];
      const vsTimeLeft = this.timeLeft();
      const clockEndTs = this.clockEndTs;

      // Do not send the opponent their own full board/hand on every opp_place.
      // Concurrent places: receiver often has an optimistic local place in flight;
      // applying a stale meGrid/mePieces made the piece snap back to the tray.
      // Score + clock are enough for soft sync; boards are independent per seat.
      this.send(oppToken, {
        type: 'opp_place',
        r: r,
        c: c,
        pieceIdx: pieceIdx,
        shape: shape.map(function (x) { return x.slice(); }),
        color: color,
        score: st.score,
        placePts: placePts,
        cleared: cleared,
        bonus: bonus,
        chain: st.clearChain,
        grid: cloneGrid(st.grid),
        pieces: serializePieces(st.pieces),
        meScore: oppSt.score,
        vsTimeLeft: vsTimeLeft,
        clockEndTs: clockEndTs,
        skinId: st.skinId || 'default',
        boardId: st.boardId || 'field_default',
        legendFx: !!(st.skinId && st.skinId !== 'default')
      });
      if (newDeal) {
        this.send(oppToken, {
          type: 'opp_deal',
          pieces: newDeal,
          vsTimeLeft: vsTimeLeft,
          clockEndTs: clockEndTs
        });
      }

      this.send(token, {
        type: 'place_ok',
        score: st.score,
        placePts: placePts,
        cleared: cleared,
        bonus: bonus,
        chain: st.clearChain,
        r: r,
        c: c,
        pieceIdx: pieceIdx,
        shape: shape.map(function (x) { return x.slice(); }),
        color: color,
        grid: cloneGrid(st.grid),
        pieces: serializePieces(st.pieces),
        deal: newDeal,
        oppScore: oppSt.score,
        oppGrid: cloneGrid(oppSt.grid),
        oppPieces: serializePieces(oppSt.pieces),
        vsTimeLeft: vsTimeLeft,
        clockEndTs: clockEndTs
      });

      persistRoom(this);
      this.evaluateStuck();
    },

    /**
     * Recompute stuck flags for both seats and end the match when rules say so:
     *  - stuck + behind → loss
     *  - both stuck → end by score
     *  - stuck + ahead while opp can still play → wait
     */
    evaluateStuck() {
      if (this.status !== 'live') return;
      const aPlay = sideHasPlayable(this.state.a.grid, this.state.a.pieces);
      const bPlay = sideHasPlayable(this.state.b.grid, this.state.b.pieces);

      const prevA = !!this.state.a.stuck;
      const prevB = !!this.state.b.stuck;
      if (aPlay === true) this.state.a.stuck = false;
      else if (aPlay === false) this.state.a.stuck = true;
      if (bPlay === true) this.state.b.stuck = false;
      else if (bPlay === false) this.state.b.stuck = true;

      if (prevA !== this.state.a.stuck || prevB !== this.state.b.stuck) {
        this.broadcast({
          type: 'stuck_status',
          a: this.state.a.stuck,
          b: this.state.b.stuck,
          aScore: this.state.a.score | 0,
          bScore: this.state.b.score | 0,
          vsTimeLeft: this.timeLeft()
        });
      }

      const aScore = this.state.a.score | 0;
      const bScore = this.state.b.score | 0;
      // Only true "false" counts — null (empty hand / deal pending) is NOT stuck
      const aStuck = aPlay === false;
      const bStuck = bPlay === false;
      // Only real placements count: the two opening 'deal' entries are always in state.moves
      const movesN = (this.state.moves || []).filter((m) => m && m.type === 'place').length;
      if (movesN === 0) return; // never stuck-end before any place

      // Game must not end while either player can still place and time remains.
      const timeLeft = this.timeLeft();
      // Both truly stuck → end by score
      if (aStuck && bStuck) {
        let winner = null;
        if (aScore > bScore) winner = 'a';
        else if (bScore > aScore) winner = 'b';
        this.end('stuck', winner);
        return;
      }
      // One stuck and behind: only end if the other still has moves OR little time left
      // If leader is also unable to improve... already handled by both stuck.
      // If behind player stuck and leader can play → leader will keep playing; behind already lost ability.
      if (aStuck && aScore < bScore && (bPlay === true || timeLeft <= 3)) {
        this.end('stuck', 'b');
        return;
      }
      if (bStuck && bScore < aScore && (aPlay === true || timeLeft <= 3)) {
        this.end('stuck', 'a');
        return;
      }
    },

    /** Client-requested deal is ignored in room mode — server owns the RNG. */
    applyDeal(token, data) {
      if (this.status !== 'live' && this.status !== 'loading') return;
      const p = this.players[token];
      if (!p) return;
      const seat = p.seat;
      const st = this.state[seat];
      // If hand fully used, deal a new set (server RNG)
      if (!st.pieces || !st.pieces.length || st.pieces.every(pc => pc && pc.used)) {
        st.pieces = dealForSeat(st);
      }
      this.send(token, {
        type: 'deal',
        pieces: serializePieces(st.pieces),
        vsTimeLeft: this.timeLeft(),
        clockEndTs: this.clockEndTs
      });
    },

    applySync(token, data) {
      if (this.status !== 'live' && this.status !== 'loading') return;
      const p = this.players[token];
      if (!p) return;
      // Rejoin / soft resync only: push authoritative snapshot, ignore client scores/grids
      this.send(token, this.snapshotFor(token));
    }
  });
}

module.exports = { installMoves };
