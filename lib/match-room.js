/**
 * MatchRoom — server-authoritative multiplayer match state machine.
 * Extracted from server.js for readability / testing.
 *
 * @param {object} env dependencies injected by server.js
 * @returns {typeof MatchRoom}
 */
'use strict';

module.exports = function createMatchRoom(env) {
  const {
    uid,
    dealThree,
    paletteForSkin,
    emptyGrid,
    cloneGrid,
    serializePieces,
    canPlaceOn,
    clearLinesOnGrid,
    bonusFor,
    chainBonusFor,
    sideHasPlayable,
    findAllPlacements,
    normalizeShape,
    randomPiece,
    dealForSeat,
    persistRoom,
    forgetRoom,
    rooms,
    log,
    SIZE,
    MIN_PLACE_INTERVAL_MS,
    PLACE_BURST_WINDOW_MS,
    PLACE_BURST_MAX,
    DC_LIMIT_MS,
    AFK_WARN_MS,
    AFK_LIMIT_MS,
    DETACH_GRACE_MS,
    MATCH_START_GRACE_MS,
    AFK_WARN_BROADCAST_MS,
    ROOM_TTL_ENDED,
    ROOM_TTL_LIVE
  } = env;

class MatchRoom {
  constructor(p1, p2, duration) {
    this.id = uid('m');
    this.duration = duration || 120;
    this.size = 8;
    this.createdAt = Date.now();
    // Clock starts only after both clients report ready (status loading → live)
    this.clockEndTs = 0;
    this.status = 'loading'; // loading | live | ended
    this.ready = { a: false, b: false };
    this.endedReason = null;

    this.players = {
      [p1.token]: this._makePlayer(p1, 'a'),
      [p2.token]: this._makePlayer(p2, 'b')
    };
    this.seatOf = {
      a: p1.token,
      b: p2.token
    };

    // Shared authoritative state (server is source of truth)
    this.state = {
      a: {
        score: 0,
        grid: emptyGrid(this.size),
        pieces: dealThree(paletteForSkin(p1.skinId)),
        clearChain: 0,
        stuck: false,
        lastPlaceAt: 0,
        placeTimes: [],
        name: p1.name || 'Игрок',
        trophies: p1.trophies | 0,
        skinId: p1.skinId ? String(p1.skinId).slice(0, 32) : 'default',
        boardId: p1.boardId ? String(p1.boardId).slice(0, 32) : 'field_default',
        avatarId: p1.avatarId ? String(p1.avatarId).slice(0, 32) : 'init',
        avatarCustom: (p1.avatarCustom && typeof p1.avatarCustom === 'string') ? String(p1.avatarCustom).slice(0, 49152) : '',
        online: true,
        lastSeen: Date.now(),
        lastActionAt: Date.now(),
        offlineSince: 0,
        dcDeadlineTs: 0,
        afkWarned: false,
        rejoinPendingMove: false
      },
      b: {
        score: 0,
        grid: emptyGrid(this.size),
        pieces: dealThree(paletteForSkin(p2.skinId)),
        clearChain: 0,
        stuck: false,
        lastPlaceAt: 0,
        placeTimes: [],
        name: p2.name || 'Игрок',
        trophies: p2.trophies | 0,
        skinId: p2.skinId ? String(p2.skinId).slice(0, 32) : 'default',
        boardId: p2.boardId ? String(p2.boardId).slice(0, 32) : 'field_default',
        avatarId: p2.avatarId ? String(p2.avatarId).slice(0, 32) : 'init',
        avatarCustom: (p2.avatarCustom && typeof p2.avatarCustom === 'string') ? String(p2.avatarCustom).slice(0, 49152) : '',
        online: true,
        lastSeen: Date.now(),
        lastActionAt: Date.now(),
        offlineSince: 0,
        dcDeadlineTs: 0,
        afkWarned: false,
        rejoinPendingMove: false
      },
      moves: []
    };
    // Opening deals for both seats — needed for client replay history
    try {
      const t0 = 0;
      this.state.moves.push({
        type: 'deal', seat: 'a', t: t0,
        pieces: serializePieces(this.state.a.pieces)
      });
      this.state.moves.push({
        type: 'deal', seat: 'b', t: t0,
        pieces: serializePieces(this.state.b.pieces)
      });
    } catch (_) {}

    rooms.set(this.id, this);
    this._clockTimer = setInterval(() => this._tick(), 1000);
    persistRoom(this);
  }

  /** Serialize for Redis/file (no sockets). */
  toJSON() {
    const players = {};
    for (const tok of Object.keys(this.players)) {
      const p = this.players[tok];
      players[tok] = {
        token: p.token,
        seat: p.seat,
        name: p.name,
        trophies: p.trophies | 0
      };
    }
    const seatState = (st) => ({
      score: st.score | 0,
      grid: cloneGrid(st.grid),
      pieces: serializePieces(st.pieces),
      clearChain: st.clearChain | 0,
      stuck: !!st.stuck,
      lastPlaceAt: st.lastPlaceAt | 0,
      placeTimes: (st.placeTimes || []).slice(-20),
      name: st.name,
      trophies: st.trophies | 0,
      skinId: st.skinId || 'default',
      boardId: st.boardId || 'field_default',
      avatarId: st.avatarId || 'init',
      avatarCustom: st.avatarCustom || '',
      online: false, // after restore nobody is connected yet
      lastSeen: st.lastSeen | 0,
      lastActionAt: st.lastActionAt | 0,
      offlineSince: st.offlineSince | 0,
      dcDeadlineTs: st.dcDeadlineTs | 0,
      afkWarned: !!st.afkWarned,
      rejoinPendingMove: !!st.rejoinPendingMove
    });
    return {
      id: this.id,
      duration: this.duration,
      size: this.size,
      createdAt: this.createdAt,
      clockEndTs: this.clockEndTs,
      status: this.status,
      ready: this.ready ? { a: !!this.ready.a, b: !!this.ready.b } : { a: false, b: false },
      endedReason: this.endedReason,
      source: this.source || 'ranked',
      privateCode: this.privateCode || null,
      rematch: this.rematch ? { a: !!this.rematch.a, b: !!this.rematch.b } : null,
      seatOf: { a: this.seatOf.a, b: this.seatOf.b },
      players,
      state: {
        a: seatState(this.state.a),
        b: seatState(this.state.b),
        moves: (this.state.moves || []).slice(-120)
      }
    };
  }

  /**
   * Restore a room from persisted JSON (after process restart).
   * Players start offline; they must rejoin via WebSocket.
   */
  static restore(data) {
    if (!data || !data.id || !data.seatOf || !data.state) return null;
    const tokA = data.seatOf.a;
    const tokB = data.seatOf.b;
    if (!tokA || !tokB) return null;
    const p1 = {
      token: tokA,
      name: (data.state.a && data.state.a.name) || 'Игрок',
      trophies: (data.state.a && data.state.a.trophies) | 0,
      skinId: (data.state.a && data.state.a.skinId) || 'default',
      boardId: (data.state.a && data.state.a.boardId) || 'field_default',
      avatarId: (data.state.a && data.state.a.avatarId) || 'init',
      avatarCustom: (data.state.a && data.state.a.avatarCustom) || '',
      ws: null
    };
    const p2 = {
      token: tokB,
      name: (data.state.b && data.state.b.name) || 'Игрок',
      trophies: (data.state.b && data.state.b.trophies) | 0,
      skinId: (data.state.b && data.state.b.skinId) || 'default',
      boardId: (data.state.b && data.state.b.boardId) || 'field_default',
      avatarId: (data.state.b && data.state.b.avatarId) || 'init',
      avatarCustom: (data.state.b && data.state.b.avatarCustom) || '',
      ws: null
    };
    // Build without constructor side-effects: manual init
    const room = Object.create(MatchRoom.prototype);
    room.id = data.id;
    room.duration = data.duration || 120;
    room.size = data.size || 8;
    room.createdAt = data.createdAt || Date.now();
    room.clockEndTs = data.clockEndTs || 0;
    if (data.status === 'ended') room.status = 'ended';
    else if (data.status === 'loading' || !room.clockEndTs) room.status = 'loading';
    else room.status = 'live';
    room.ready = (data.ready && typeof data.ready === 'object')
      ? { a: !!data.ready.a, b: !!data.ready.b }
      : { a: false, b: false };
    room.endedReason = data.endedReason || null;
    room.source = data.source || 'ranked';
    room.privateCode = data.privateCode || null;
    room.rematch = data.rematch || { a: false, b: false };
    room.players = {
      [tokA]: { token: tokA, seat: 'a', name: p1.name, trophies: p1.trophies, ws: null, online: false, lastSeen: Date.now() },
      [tokB]: { token: tokB, seat: 'b', name: p2.name, trophies: p2.trophies, ws: null, online: false, lastSeen: Date.now() }
    };
    room.seatOf = { a: tokA, b: tokB };
    const hydrate = (raw) => {
      const st = raw || {};
      return {
        score: st.score | 0,
        grid: st.grid && st.grid.length ? cloneGrid(st.grid) : emptyGrid(room.size),
        pieces: (st.pieces && st.pieces.length) ? st.pieces.map(p => ({
          shape: (p.shape || []).map(c => c.slice()),
          color: p.color,
          used: !!p.used
        })) : dealThree(paletteForSkin(st.skinId)),
        clearChain: st.clearChain | 0,
        stuck: !!st.stuck,
        lastPlaceAt: st.lastPlaceAt | 0,
        placeTimes: Array.isArray(st.placeTimes) ? st.placeTimes.slice() : [],
        name: st.name || 'Игрок',
        trophies: st.trophies | 0,
        skinId: st.skinId || 'default',
        boardId: st.boardId || 'field_default',
        avatarId: st.avatarId || 'init',
        avatarCustom: st.avatarCustom || '',
        online: false,
        lastSeen: st.lastSeen | 0,
        lastActionAt: st.lastActionAt || Date.now(),
        offlineSince: st.offlineSince || Date.now(),
        dcDeadlineTs: st.dcDeadlineTs | 0,
        afkWarned: !!st.afkWarned,
      rejoinPendingMove: !!st.rejoinPendingMove
      };
    };
    room.state = {
      a: hydrate(data.state.a),
      b: hydrate(data.state.b),
      moves: Array.isArray(data.state.moves) ? data.state.moves.slice() : []
    };
    // If live but clock already over — end immediately on next tick
    if (room.status === 'live') {
      // Mark both offline so DC/AFK rules can finish the match if needed
      for (const seat of ['a', 'b']) {
        const st = room.state[seat];
        if (!st.dcDeadlineTs) {
          const matchLeft = Math.max(0, room.clockEndTs - Date.now());
          st.dcDeadlineTs = Date.now() + Math.min(DC_LIMIT_MS, matchLeft || 1000);
        }
      }
      room._clockTimer = setInterval(() => room._tick(), 1000);
    } else {
      room._clockTimer = null;
      // Still keep for rematch window — schedule delete
      setTimeout(() => {
        if (rooms.get(room.id) === room) {
          rooms.delete(room.id);
          forgetRoom(room.id, [tokA, tokB]);
        }
      }, Math.max(1000, ROOM_TTL_ENDED * 1000));
    }
    rooms.set(room.id, room);
    return room;
  }

  _makePlayer(info, seat) {
    return {
      token: info.token,
      seat,
      name: info.name || 'Игрок',
      trophies: info.trophies | 0,
      ws: info.ws || null,
      online: true,
      lastSeen: Date.now(),
      platform: info.platform || (info.ws && info.ws._platform) || 'web',
      os: info.os || (info.ws && info.ws._os) || 'unknown'
    };
  }

  getPlayer(token) {
    return this.players[token] || null;
  }

  otherSeat(seat) {
    return seat === 'a' ? 'b' : 'a';
  }

  attach(token, ws) {
    const p = this.players[token];
    if (!p) return false;
    // Allow attach on ended rooms (rematch / result screen)
    // Replace previous socket without treating it as a fresh disconnect
    if (p.ws && p.ws !== ws) {
      try {
        p.ws._matchId = null; // prevent stale close from detaching us
        p.ws._token = null;
        try { p.ws.close(); } catch (_) {}
      } catch (_) {}
    }
    p.ws = ws;
    p.online = true;
    p.lastSeen = Date.now();
    const st = this.state[p.seat];
    // Cancel pending soft-detach (refresh within grace — DC never started)
    const wasGraceOnly = !!st._detachPending;
    try {
      if (st._detachTimer) {
        clearTimeout(st._detachTimer);
        st._detachTimer = null;
      }
      st._detachPending = false;
    } catch (_) {}
    st.online = true;
    st.lastSeen = Date.now();
    st.offlineSince = 0;
    const nowA = Date.now();
    ws._matchId = this.id;
    ws._token = token;

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
        const now = Date.now();
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
  }

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
        clearTimeout(st._detachTimer);
        st._detachTimer = null;
      }
    } catch (_) {}
    st._detachPending = true;
    st._detachAt = Date.now();
    const grace = (typeof DETACH_GRACE_MS === 'number') ? DETACH_GRACE_MS : 5000;
    st._detachTimer = setTimeout(() => {
      try {
        this._confirmDetach(token, seat);
      } catch (e) {
        log('warn', 'confirmDetach', { err: e && e.message });
      }
    }, grace);
  }

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
    p.lastSeen = Date.now();
    st.online = false;
    st.lastSeen = Date.now();
    const now = Date.now();
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

  timeLeft() {
    if (!this.clockEndTs || this.status === 'loading') {
      return this.duration || 120;
    }
    return Math.max(0, Math.ceil((this.clockEndTs - Date.now()) / 1000));
  }

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
  }

  send(token, msg) {
    const p = this.players[token];
    if (!p || !p.ws || p.ws.readyState !== 1) return;
    try { p.ws.send(JSON.stringify(msg)); } catch (_) {}
  }

  broadcast(msg, exceptToken) {
    for (const token of Object.keys(this.players)) {
      if (exceptToken && token === exceptToken) continue;
      this.send(token, msg);
    }
  }

  broadcastState() {
    for (const token of Object.keys(this.players)) {
      const snap = this.snapshotFor(token);
      if (snap) this.send(token, snap);
    }
  }

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
    const now = Date.now();
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
      t: Date.now() - this.createdAt,
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
        t: Date.now() - this.createdAt,
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
  }

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
    const movesN = (this.state.moves && this.state.moves.length) || 0;
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
  }

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
  }

  applySync(token, data) {
    if (this.status !== 'live' && this.status !== 'loading') return;
    const p = this.players[token];
    if (!p) return;
    // Rejoin / soft resync only: push authoritative snapshot, ignore client scores/grids
    this.send(token, this.snapshotFor(token));
  }

  /** Client finished loading boards/assets — when both ready, start the clock. */
  markReady(token) {
    if (this.status !== 'loading') {
      // Already live or ended — echo current clock so client can sync
      if (this.status === 'live') {
        this.send(token, {
          type: 'match_go',
          matchId: this.id,
          clockEndTs: this.clockEndTs,
          vsTimeLeft: this.timeLeft(),
          duration: this.duration
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
      this.goLive();
    }
    persistRoom(this);
  }

  /** Both players loaded — start wall clock and unlock play. */
  goLive() {
    if (this.status !== 'loading') return;
    this.status = 'live';
    // Intro buffer: clients show «Загрузка» → «Старт!» before play; clock includes that delay
    // so remaining time after intro equals full match duration.
    const INTRO_MS = 1800;
    this.clockEndTs = Date.now() + INTRO_MS + (this.duration || 120) * 1000;
    if (!this.ready) this.ready = { a: true, b: true };
    else { this.ready.a = true; this.ready.b = true; }
    this.broadcast({
      type: 'match_go',
      matchId: this.id,
      clockEndTs: this.clockEndTs,
      vsTimeLeft: this.timeLeft(),
      duration: this.duration,
      introMs: INTRO_MS
    });
    persistRoom(this);
  }

  /** Cancel match during loading (peer left / timeout) — no ranked penalty. */
  cancelLoading(reason) {
    if (this.status !== 'loading') return;
    this.status = 'ended';
    this.endedReason = reason || 'void';
    this.rematch = { a: false, b: false };
    if (this._clockTimer) {
      clearInterval(this._clockTimer);
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
    setTimeout(() => {
      try {
        if (rooms.get(id) === this) {
          rooms.delete(id);
          forgetRoom(id, tokens);
        }
      } catch (_) {}
    }, 3000);
  }

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
  }

  end(reason, winnerSeat) {
    if (this.status === 'ended') return;
    this.status = 'ended';
    this.endedReason = reason || 'time';
    if (this._clockTimer) {
      clearInterval(this._clockTimer);
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
      setTimeout(() => {
        try {
          if (this.status === 'ended') this.broadcast(payload);
        } catch (_) {}
      }, 300);
    } catch (_) {}
    persistRoom(this);
    // Keep room for rejoin + rematch window
    const id = this.id;
    const tokens = Object.keys(this.players);
    setTimeout(() => {
      rooms.delete(id);
      forgetRoom(id, tokens);
    }, ROOM_TTL_ENDED * 1000);
  }

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
  }

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
  }

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
  }

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
  }

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
      if (this._clockTimer) { clearInterval(this._clockTimer); this._clockTimer = null; }
    } catch (_) {}
    rooms.delete(oldId);
    forgetRoom(oldId, [tokA, tokB]);
    const room = startRoom(p1, p2, { source: this.source || 'ranked', code: this.privateCode || null });
    // Bind new match id on sockets
    try {
      if (pa.ws) { pa.ws._matchId = room.id; pa.ws._token = tokA; }
      if (pb.ws) { pb.ws._matchId = room.id; pb.ws._token = tokB; }
    } catch (_) {}
  }

  _tick() {
    const now = Date.now();
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
    const movesN = (this.state.moves && this.state.moves.length) || 0;

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
}


  return MatchRoom;
};
