/**
 * MatchRoom — server-authoritative multiplayer match.
 * Extracted from server.js (refactor 3.10.5). Behaviour unchanged.
 *
 * @param {object} deps
 * @param {object} deps.hooks  mutable: { persistRoom, forgetRoom, startRoom, send }
 */
'use strict';

const { installConnection } = require('./match-room/connection');
const { installViews } = require('./match-room/views');
const { installMoves } = require('./match-room/moves');
const { installLifecycle } = require('./match-room/lifecycle');
const { installRematch } = require('./match-room/rematch');
const { installTick } = require('./match-room/tick');

function createMatchRoomClass(deps) {
  const uid = deps.uid;
  const emptyGrid = deps.emptyGrid;
  const dealThree = deps.dealThree;
  const paletteForSkin = deps.paletteForSkin;
  const cloneGrid = deps.cloneGrid;
  const serializePieces = deps.serializePieces;
  const clearLinesOnGrid = deps.clearLinesOnGrid;
  const bonusFor = deps.bonusFor;
  const chainBonusFor = deps.chainBonusFor;
  const canPlaceOn = deps.canPlaceOn;
  const sideHasPlayable = deps.sideHasPlayable;
  const normalizeShape = deps.normalizeShape;
  const DEFAULT_COLORS = deps.DEFAULT_COLORS || ['#888'];
  const MIN_PLACE_INTERVAL_MS = deps.MIN_PLACE_INTERVAL_MS;
  const PLACE_BURST_WINDOW_MS = deps.PLACE_BURST_WINDOW_MS;
  const PLACE_BURST_MAX = deps.PLACE_BURST_MAX;
  const DC_LIMIT_MS = deps.DC_LIMIT_MS;
  const AFK_WARN_MS = deps.AFK_WARN_MS;
  const AFK_LIMIT_MS = deps.AFK_LIMIT_MS;
  const DETACH_GRACE_MS = deps.DETACH_GRACE_MS;
  const MATCH_START_GRACE_MS = deps.MATCH_START_GRACE_MS;
  const AFK_WARN_BROADCAST_MS = deps.AFK_WARN_BROADCAST_MS;
  const ROOM_TTL_ENDED = deps.ROOM_TTL_ENDED;
  const log = deps.log;
  const hooks = deps.hooks;
  // rooms Map + store: live bindings via hooks (server assigns after init)
  function getRooms() { return hooks.rooms; }
  function getStore() { return hooks.store; }

  function persistRoom(room) { return hooks.persistRoom(room); }
  function forgetRoom(roomId, tokens) { return hooks.forgetRoom(roomId, tokens); }
  function startRoom(p1, p2, meta) { return hooks.startRoom(p1, p2, meta); }
  function send(ws, msg) { return hooks.send(ws, msg); }

  function dealForSeat(st) {
    return dealThree(paletteForSkin(st && st.skinId));
  }


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

    getRooms().set(this.id, this);
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
        if (getRooms().get(room.id) === room) {
          getRooms().delete(room.id);
          forgetRoom(room.id, [tokA, tokB]);
        }
      }, Math.max(1000, ROOM_TTL_ENDED * 1000));
    }
    getRooms().set(room.id, room);
    return room;
  }

  _makePlayer(info, seat) {
    return {
      token: info.token,
      seat,
      name: info.name || 'Игрок',
      trophies: info.trophies | 0,
      friendCode: info.friendCode ? String(info.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16) : null,
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
}

  // Remaining MatchRoom behaviour lives in lib/match-room/*.js (installed on the prototype).
  const ctx = {
    uid,
    emptyGrid,
    dealThree,
    paletteForSkin,
    cloneGrid,
    serializePieces,
    clearLinesOnGrid,
    bonusFor,
    chainBonusFor,
    canPlaceOn,
    sideHasPlayable,
    normalizeShape,
    DEFAULT_COLORS,
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
    log,
    hooks,
    getRooms,
    getStore,
    persistRoom,
    forgetRoom,
    startRoom,
    send,
    dealForSeat
  };
  [installConnection, installViews, installMoves, installLifecycle, installRematch, installTick]
    .forEach((install) => install(MatchRoom, ctx));


  return MatchRoom;
}

module.exports = { createMatchRoomClass };
