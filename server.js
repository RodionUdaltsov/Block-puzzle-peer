/**
 * Block Puzzle — server-authoritative multiplayer (WebSocket).
 * Rooms, queue, private lobbies, rematch, social relay.
 */
/**
 * Block Puzzle — pure Node HTTP + WebSocket (vendor/ws)
 * No express required.
 */
'use strict';
const path = require('path');
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const { WebSocketServer } = require('./vendor/ws');
const { createStore, ROOM_TTL_LIVE, ROOM_TTL_ENDED, TOKEN_TTL } = require('./lib/store');

// Shared authoritative rules (single source with client)
const R = require('./shared/rules');
const {
  SIZE, DEFAULT_COLORS, emptyGrid, cloneGrid, normalizeShape, shapesEqual,
  randomPiece, dealThree, canPlaceOn, clearLinesOnGrid, bonusFor, chainBonusFor,
  serializePieces, findAllPlacements, sideHasPlayable,
  MIN_PLACE_INTERVAL_MS, PLACE_BURST_WINDOW_MS, PLACE_BURST_MAX,
  DC_LIMIT_MS, AFK_WARN_MS, AFK_LIMIT_MS
} = R;

const PORT = Number(process.env.PORT) || 9000;
const PUBLIC = path.join(__dirname, 'public');

/** @type {import('./lib/store').MemoryStore|null} */
let store = null;

function persistRoom(room) {
  if (!store || !room) return;
  try {
    const ttl = room.status === 'ended' ? ROOM_TTL_ENDED : ROOM_TTL_LIVE;
    const left = room.status === 'live'
      ? Math.max(30, Math.ceil((room.clockEndTs - Date.now()) / 1000) + 60)
      : ROOM_TTL_ENDED;
    const useTtl = room.status === 'ended' ? ROOM_TTL_ENDED : Math.min(ttl, left);
    store.saveRoom(room.id, room.toJSON(), useTtl).catch(() => {});
    for (const token of Object.keys(room.players || {})) {
      store.bindToken(token, room.id, TOKEN_TTL).catch(() => {});
    }
  } catch (_) {}
}

function forgetRoom(roomId, tokens) {
  if (!store || !roomId) return;
  store.deleteRoom(roomId).catch(() => {});
  if (tokens) {
    for (const t of tokens) store.unbindToken(t).catch(() => {});
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json'
};

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    if (ext === '.html' || ext === '.js' || ext === '.css') {
      headers['Cache-Control'] = 'no-cache';
    }
    res.writeHead(200, headers);
    res.end(data);
  });
}

const rooms = new Map();
/** queue key → waiting players */
const queues = new Map();
/** Private lobby code → lobby state */
const privateLobbies = new Map();
/** friendCode → presence entry */
const presence = new Map();
/** friendCode → queued social messages while offline */
const pendingSocial = new Map();

function totalQueued() {
  let n = 0;
  for (const q of queues.values()) n += q.length;
  return n;
}

function uid(prefix) {
  return prefix + '_' + crypto.randomBytes(8).toString('hex');
}

function queueKey(duration, trophies) {
  const bucket = Math.floor(Math.max(0, trophies) / 50) * 50;
  return 'd' + duration + '-b' + bucket;
}

function nearbyQueueKeys(duration, trophies, gap) {
  const base = Math.floor(Math.max(0, trophies) / 50) * 50;
  const keys = [];
  for (let b = base - gap; b <= base + gap; b += 50) {
    if (b < 0) continue;
    keys.push(queueKey(duration, b));
  }
  return keys;
}

class MatchRoom {
  constructor(p1, p2, duration) {
    this.id = uid('m');
    this.duration = duration || 120;
    this.size = 8;
    this.createdAt = Date.now();
    this.clockEndTs = Date.now() + this.duration * 1000;
    this.status = 'live'; // live | ended
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
        pieces: dealThree(),
        clearChain: 0,
        stuck: false,
        lastPlaceAt: 0,
        placeTimes: [],
        name: p1.name || 'Игрок',
        trophies: p1.trophies | 0,
        online: true,
        lastSeen: Date.now(),
        lastActionAt: Date.now(),
        offlineSince: 0,
        dcDeadlineTs: 0,
        afkWarned: false
      },
      b: {
        score: 0,
        grid: emptyGrid(this.size),
        pieces: dealThree(),
        clearChain: 0,
        stuck: false,
        lastPlaceAt: 0,
        placeTimes: [],
        name: p2.name || 'Игрок',
        trophies: p2.trophies | 0,
        online: true,
        lastSeen: Date.now(),
        lastActionAt: Date.now(),
        offlineSince: 0,
        dcDeadlineTs: 0,
        afkWarned: false
      },
      moves: []
    };

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
      online: false, // after restore nobody is connected yet
      lastSeen: st.lastSeen | 0,
      lastActionAt: st.lastActionAt | 0,
      offlineSince: st.offlineSince | 0,
      dcDeadlineTs: st.dcDeadlineTs | 0,
      afkWarned: !!st.afkWarned
    });
    return {
      id: this.id,
      duration: this.duration,
      size: this.size,
      createdAt: this.createdAt,
      clockEndTs: this.clockEndTs,
      status: this.status,
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
      ws: null
    };
    const p2 = {
      token: tokB,
      name: (data.state.b && data.state.b.name) || 'Игрок',
      trophies: (data.state.b && data.state.b.trophies) | 0,
      ws: null
    };
    // Build without constructor side-effects: manual init
    const room = Object.create(MatchRoom.prototype);
    room.id = data.id;
    room.duration = data.duration || 120;
    room.size = data.size || 8;
    room.createdAt = data.createdAt || Date.now();
    room.clockEndTs = data.clockEndTs || (Date.now() + room.duration * 1000);
    room.status = data.status === 'ended' ? 'ended' : 'live';
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
        })) : dealThree(),
        clearChain: st.clearChain | 0,
        stuck: !!st.stuck,
        lastPlaceAt: st.lastPlaceAt | 0,
        placeTimes: Array.isArray(st.placeTimes) ? st.placeTimes.slice() : [],
        name: st.name || 'Игрок',
        trophies: st.trophies | 0,
        online: false,
        lastSeen: st.lastSeen | 0,
        lastActionAt: st.lastActionAt || Date.now(),
        offlineSince: st.offlineSince || Date.now(),
        dcDeadlineTs: st.dcDeadlineTs | 0,
        afkWarned: !!st.afkWarned
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
      lastSeen: Date.now()
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
        p.ws.close();
      } catch (_) {}
    }
    p.ws = ws;
    p.online = true;
    p.lastSeen = Date.now();
    const st = this.state[p.seat];
    st.online = true;
    st.lastSeen = Date.now();
    st.offlineSince = 0;
    st.dcDeadlineTs = 0;
    ws._matchId = this.id;
    ws._token = token;
    this.broadcast({
      type: 'player_status',
      seat: p.seat,
      online: true,
      clockEndTs: this.clockEndTs,
      vsTimeLeft: this.timeLeft(),
      dcDeadlineTs: 0,
      dcRemaining: 0,
      idleMs: Date.now() - (st.lastActionAt || Date.now()),
      awaitingMove: true
    }, token);
    // Tell rejoiner the opponent's current online status (broadcast above skips self)
    try {
      const oppSeat = this.otherSeat(p.seat);
      const oppSt = this.state[oppSeat];
      if (oppSt) {
        const now = Date.now();
        const dcRem = (!oppSt.online && oppSt.dcDeadlineTs > 0)
          ? Math.max(0, Math.ceil((oppSt.dcDeadlineTs - now) / 1000))
          : 0;
        this.send(token, {
          type: 'player_status',
          seat: oppSeat,
          online: !!oppSt.online,
          clockEndTs: this.clockEndTs,
          vsTimeLeft: this.timeLeft(),
          dcDeadlineTs: oppSt.dcDeadlineTs || 0,
          dcRemaining: dcRem
        });
      }
    } catch (_) {}
    persistRoom(this);
    return true;
  }

  detach(token, closedWs) {
    const p = this.players[token];
    if (!p || this.status !== 'live') return;
    // Ignore stale close: a newer socket already re-attached
    if (closedWs && p.ws && p.ws !== closedWs) {
      return;
    }
    p.ws = null;
    p.online = false;
    p.lastSeen = Date.now();
    const st = this.state[p.seat];
    st.online = false;
    st.lastSeen = Date.now();
    const now = Date.now();
    st.offlineSince = now;

    // Disconnect grace: min(60s, remaining match time)
    // If already under AFK (idle >= AFK_WARN), continue AFK deadline — no full 60s
    const idle = now - (st.lastActionAt || now);
    const matchLeftMs = Math.max(0, this.clockEndTs - now);
    let dcMs;
    if (idle >= AFK_WARN_MS) {
      const afkEnd = (st.lastActionAt || now) + AFK_LIMIT_MS;
      dcMs = Math.max(0, Math.min(afkEnd - now, matchLeftMs));
      if (dcMs < 1000 && matchLeftMs > 0) dcMs = Math.min(1000, matchLeftMs);
    } else {
      dcMs = Math.min(DC_LIMIT_MS, matchLeftMs);
    }
    st.dcDeadlineTs = now + dcMs;

    this.broadcast({
      type: 'player_status',
      seat: p.seat,
      online: false,
      clockEndTs: this.clockEndTs,
      vsTimeLeft: this.timeLeft(),
      dcDeadlineTs: st.dcDeadlineTs,
      dcRemaining: Math.max(0, Math.ceil(dcMs / 1000)),
      reason: idle >= AFK_WARN_MS ? 'afk_disconnect' : 'disconnect'
    }, token);
    persistRoom(this);
  }

  timeLeft() {
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
        online: this.state[me].online
      },
      opp: {
        score: this.state[opp].score,
        grid: cloneGrid(this.state[opp].grid),
        pieces: serializePieces(this.state[opp].pieces),
        name: this.state[opp].name,
        trophies: this.state[opp].trophies,
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

    // Prefer server hand shape (client may normalize differently)
    let shape = normalizeShape(handPiece.shape);
    if (!shape.length) {
      shape = normalizeShape(data.shape);
    }
    if (!shape.length) return reject('shape_mismatch');
    // If client sent a shape, only require same cell count (orientation already normalized)
    if (data.shape) {
      const clientShape = normalizeShape(data.shape);
      if (clientShape.length && clientShape.length !== shape.length) {
        // still allow if server shape places at r,c
      }
    }

    const r = data.r | 0;
    const c = data.c | 0;
    if (!canPlaceOn(st.grid, shape, r, c)) {
      // Retry with client shape if different
      const clientShape = normalizeShape(data.shape);
      if (clientShape.length && shapesEqual(clientShape, handPiece.shape) === false) {
        if (canPlaceOn(st.grid, clientShape, r, c) && clientShape.length === shape.length) {
          shape = clientShape;
        } else {
          return reject('cannot_place');
        }
      } else {
        return reject('cannot_place');
      }
    }

    // Apply cells
    const color = handPiece.color || data.color || DEFAULT_COLORS[0];
    for (const [dr, dc] of shape) {
      st.grid[r + dr][c + dc] = color;
    }
    handPiece.used = true;
    st.lastPlaceAt = now;
    st.lastActionAt = now;
    st.afkWarned = false;
    st.offlineSince = 0;
    st.dcDeadlineTs = 0;
    st.placeTimes.push(now);
    st.stuck = false;

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
      st.pieces = dealThree();
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
    if (this.state.moves.length > 200) this.state.moves = this.state.moves.slice(-120);

    const oppToken = this.seatOf[this.otherSeat(seat)];
    const oppSeat = this.otherSeat(seat);
    const oppSt = this.state[oppSeat];
    const vsTimeLeft = this.timeLeft();
    const clockEndTs = this.clockEndTs;

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
      meGrid: cloneGrid(oppSt.grid),
      mePieces: serializePieces(oppSt.pieces),
      vsTimeLeft: vsTimeLeft,
      clockEndTs: clockEndTs
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
    const aStuck = aPlay === false;
    const bStuck = bPlay === false;

    // Both truly stuck → end by score
    if (aStuck && bStuck) {
      let winner = null;
      if (aScore > bScore) winner = 'a';
      else if (bScore > aScore) winner = 'b';
      this.end('stuck', winner);
      return;
    }
    // One stuck and behind → immediate loss
    if (aStuck && aScore < bScore) {
      this.end('stuck', 'b');
      return;
    }
    if (bStuck && bScore < aScore) {
      this.end('stuck', 'a');
      return;
    }
  }

  /** Client-requested deal is ignored in room mode — server owns the RNG. */
  applyDeal(token, data) {
    if (this.status !== 'live') return;
    const p = this.players[token];
    if (!p) return;
    const seat = p.seat;
    const st = this.state[seat];
    // If hand fully used, deal a new set (server RNG)
    if (!st.pieces || !st.pieces.length || st.pieces.every(pc => pc && pc.used)) {
      st.pieces = dealThree();
    }
    this.send(token, {
      type: 'deal',
      pieces: serializePieces(st.pieces),
      vsTimeLeft: this.timeLeft(),
      clockEndTs: this.clockEndTs
    });
  }

  applySync(token, data) {
    if (this.status !== 'live') return;
    const p = this.players[token];
    if (!p) return;
    // Rejoin / soft resync only: push authoritative snapshot, ignore client scores/grids
    this.send(token, this.snapshotFor(token));
  }

  forfeit(token) {
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
      a: { score: this.state.a.score, name: this.state.a.name },
      b: { score: this.state.b.score, name: this.state.b.name }
    };
    this.broadcast(payload);
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
    const p = this.players[token];
    if (!p) return;
    if (!this.rematch) this.rematch = { a: false, b: false };
    this.rematch[p.seat] = true;
    this.send(token, { type: 'rematch_wait', matchId: this.id });
    if (this.rematch.a && this.rematch.b) this.startRematch();
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
    // Remove old room id mapping after starting new one
    const oldId = this.id;
    const p1 = {
      token: tokA,
      ws: pa.ws,
      name: this.state.a.name,
      trophies: this.state.a.trophies | 0,
      duration: duration
    };
    const p2 = {
      token: tokB,
      ws: pb.ws,
      name: this.state.b.name,
      trophies: this.state.b.trophies | 0,
      duration: duration
    };
    rooms.delete(oldId);
    forgetRoom(oldId, [tokA, tokB]);
    startRoom(p1, p2, { source: this.source || 'ranked', code: this.privateCode || null });
  }

  _tick() {
    if (this.status !== 'live') return;
    const now = Date.now();
    const left = this.timeLeft();
    if (left <= 0) {
      const a = this.state.a.score | 0;
      const b = this.state.b.score | 0;
      let winner = null;
      if (a > b) winner = 'a';
      else if (b > a) winner = 'b';
      this.end('time', winner);
      return;
    }

    // Disconnect forfeit + AFK forfeit (server-authoritative)
    for (const seat of ['a', 'b']) {
      const st = this.state[seat];
      if (!st) continue;

      // Offline: technical loss when dcDeadlineTs passes
      if (!st.online && st.dcDeadlineTs > 0 && now >= st.dcDeadlineTs) {
        const loser = seat;
        const winner = seat === 'a' ? 'b' : 'a';
        this.end('disconnect', winner);
        return;
      }

      // Online but idle: AFK warn / loss (only if online — offline uses dc path)
      if (st.online) {
        const idle = now - (st.lastActionAt || now);
        if (idle >= AFK_LIMIT_MS) {
          const winner = seat === 'a' ? 'b' : 'a';
          this.end('afk', winner);
          return;
        }
        if (idle >= AFK_WARN_MS && !st.afkWarned) {
          st.afkWarned = true;
          const token = this.seatOf[seat];
          const remain = Math.max(1, Math.ceil((AFK_LIMIT_MS - idle) / 1000));
          this.send(token, {
            type: 'afk_warn',
            seat: seat,
            remaining: remain,
            vsTimeLeft: left,
            clockEndTs: this.clockEndTs
          });
          // Tell opponent too
          const oppTok = this.seatOf[seat === 'a' ? 'b' : 'a'];
          this.send(oppTok, {
            type: 'afk_warn',
            seat: seat,
            remaining: remain,
            vsTimeLeft: left,
            clockEndTs: this.clockEndTs
          });
        }
      }

      // Offline countdown broadcast every second for UI
      if (!st.online && st.dcDeadlineTs > 0) {
        const dcRem = Math.max(0, Math.ceil((st.dcDeadlineTs - now) / 1000));
        this.broadcast({
          type: 'player_status',
          seat: seat,
          online: false,
          clockEndTs: this.clockEndTs,
          vsTimeLeft: left,
          dcDeadlineTs: st.dcDeadlineTs,
          dcRemaining: dcRem
        });
      }
    }

    this.broadcast({
      type: 'clock',
      vsTimeLeft: left,
      clockEndTs: this.clockEndTs
    });
    this.evaluateStuck();
  }
}

function findMatch(player) {
  const duration = player.duration || 120;
  // Expand quickly so real players actually meet
  const gapSteps = [150, 300, 600, 99999];
  const gap = gapSteps[Math.min(player.expandLevel | 0, gapSteps.length - 1)];
  let keys = nearbyQueueKeys(duration, player.trophies | 0, gap);
  // Also scan every queue with same duration (keys may miss empty buckets)
  const extra = [];
  for (const k of queues.keys()) {
    if (String(k).startsWith('d' + duration + '-')) extra.push(k);
  }
  keys = keys.concat(extra.filter(k => keys.indexOf(k) < 0));

  for (const key of keys) {
    const q = queues.get(key);
    if (!q || !q.length) continue;
    for (let i = 0; i < q.length; i++) {
      const other = q[i];
      if (!other.ws || other.ws.readyState !== 1) {
        q.splice(i, 1); i--; continue;
      }
      if (other.token === player.token) continue;
      if (other.clientId && player.clientId && other.clientId === player.clientId) continue;
      const dt = Math.abs((other.trophies | 0) - (player.trophies | 0));
      if (dt > gap) continue;
      q.splice(i, 1);
      return other;
    }
  }
  return null;
}

function enqueue(player) {
  const duration = player.duration || 120;
  const key = queueKey(duration, player.trophies | 0);
  if (!queues.has(key)) queues.set(key, []);
  // Remove duplicates for same token
  for (const [k, q] of queues) {
    for (let i = q.length - 1; i >= 0; i--) {
      if (q[i].token === player.token) q.splice(i, 1);
    }
  }
  queues.get(key).push(player);
}

function dequeueToken(token) {
  for (const q of queues.values()) {
    for (let i = q.length - 1; i >= 0; i--) {
      if (q[i].token === token) q.splice(i, 1);
    }
  }
}

function startRoom(p1, p2, meta) {
  meta = meta || {};
  const duration = p1.duration || p2.duration || 120;
  const room = new MatchRoom(p1, p2, duration);
  room.source = meta.source || 'ranked';
  room.privateCode = meta.code || null;
  room.attach(p1.token, p1.ws);
  room.attach(p2.token, p2.ws);

  for (const token of [p1.token, p2.token]) {
    const snap = room.snapshotFor(token);
    const me = Object.assign({}, snap.me, {
      pieces: serializePieces(snap.me && snap.me.pieces)
    });
    const opp = Object.assign({}, snap.opp, {
      pieces: serializePieces(snap.opp && snap.opp.pieces)
    });
    room.send(token, {
      type: 'match_found',
      matchId: room.id,
      token,
      duration: room.duration,
      clockEndTs: room.clockEndTs,
      vsTimeLeft: room.timeLeft(),
      me,
      opp,
      seat: snap.seat,
      source: room.source,
      privateCode: room.privateCode
    });
  }
  return room;
}

function genPrivateCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

function leavePrivateLobby(token) {
  for (const [code, lobby] of privateLobbies) {
    if (lobby.host && lobby.host.token === token) {
      if (lobby.guest && lobby.guest.ws) {
        send(lobby.guest.ws, { type: 'private_closed', code, reason: 'host_left' });
      }
      privateLobbies.delete(code);
      return code;
    }
    if (lobby.guest && lobby.guest.token === token) {
      lobby.guest = null;
      lobby.hostReady = false;
      lobby.guestReady = false;
      if (lobby.host && lobby.host.ws) {
        send(lobby.host.ws, {
          type: 'private_lobby',
          code,
          role: 'host',
          duration: lobby.duration,
          hostReady: false,
          guestReady: false,
          opp: null
        });
      }
      return code;
    }
  }
  return null;
}

function lobbySnapshot(lobby, role) {
  const opp = role === 'host' ? lobby.guest : lobby.host;
  return {
    type: 'private_lobby',
    code: lobby.code,
    role,
    duration: lobby.duration,
    hostReady: !!lobby.hostReady,
    guestReady: !!lobby.guestReady,
    opp: opp ? {
      name: opp.name,
      trophies: opp.trophies | 0,
      friendCode: opp.friendCode || null
    } : null
  };
}

function tryStartPrivate(lobby) {
  if (!lobby || !lobby.host || !lobby.guest) return false;
  if (!lobby.hostReady || !lobby.guestReady) return false;
  const code = lobby.code;
  privateLobbies.delete(code);
  const p1 = {
    token: lobby.host.token,
    ws: lobby.host.ws,
    name: lobby.host.name,
    trophies: lobby.host.trophies | 0,
    duration: lobby.duration
  };
  const p2 = {
    token: lobby.guest.token,
    ws: lobby.guest.ws,
    name: lobby.guest.name,
    trophies: lobby.guest.trophies | 0,
    duration: lobby.duration
  };
  // Bind duration onto both
  p1.duration = lobby.duration;
  p2.duration = lobby.duration;
  startRoom(p1, p2, { source: 'lobby', code });
  return true;
}

const server = http.createServer((req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    const url = (req.url || '/').split('?')[0];
    if (url === '/health') {
      let wsClients = 0;
      try { wsClients = wss.clients.size; } catch (_) {}
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        service: 'block-puzzle',
        rooms: rooms.size,
        queue: totalQueued(),
        privateLobbies: privateLobbies.size,
        presence: presence.size,
        wsClients,
        store: store ? store.kind : 'none',
        uptime: Math.floor(process.uptime())
      }));
      return;
    }
    let filePath = path.join(PUBLIC, url === '/' ? 'index.html' : url);
    // prevent path escape
    if (!filePath.startsWith(PUBLIC)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    fs.stat(filePath, (err, st) => {
      if (!err && st.isFile()) {
        sendFile(res, filePath);
        return;
      }
      // SPA fallback
      sendFile(res, path.join(PUBLIC, 'index.html'));
    });
  } catch (e) {
    res.writeHead(500);
    res.end('Server error');
  }
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  try {
    const u = req.url || '';
    if (u === '/ws' || u.startsWith('/ws?')) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } else {
      socket.destroy();
    }
  } catch (_) {
    try { socket.destroy(); } catch (_) {}
  }
});

function send(ws, msg) {
  if (!ws || ws.readyState !== 1) return;
  try { ws.send(JSON.stringify(msg)); } catch (_) {}
}


function resolveMatchCtx(ws, data) {
  const matchId = (data && data.matchId) ? String(data.matchId) : (ws._matchId || null);
  const token = (data && data.token) ? String(data.token) : (ws._token || null);
  if (!matchId || !token) return null;
  const room = rooms.get(matchId);
  if (!room || room.status !== 'live') return null;
  if (!room.getPlayer(token)) return null;
  // Soft re-bind if socket lost binding (common after refresh race)
  if (ws._matchId !== matchId || ws._token !== token || room.players[token].ws !== ws) {
    ws._matchId = matchId;
    ws._token = token;
    room.attach(token, ws);
  }
  return { room, token, matchId };
}

wss.on('connection', (ws) => {
  ws._token = uid('t');
  ws._matchId = null;
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  send(ws, { type: 'hello', token: ws._token });

  ws.on('message', (raw) => {
    let data;
    try { data = JSON.parse(String(raw)); } catch (_) { return; }
    if (!data || typeof data !== 'object') return;
    const type = data.type;

    if (type === 'join_queue') {
      dequeueToken(ws._token);
      if (ws._matchId && rooms.has(ws._matchId)) {
        const room = rooms.get(ws._matchId);
        const snap = room.snapshotFor(ws._token);
        if (snap) send(ws, snap);
        return;
      }
      const player = {
        token: ws._token, ws,
        name: String(data.name || 'Игрок').slice(0, 24),
        trophies: Math.max(0, data.trophies | 0),
        duration: (data.duration === 60 || data.duration === 180) ? data.duration : 120,
        expandLevel: Math.min(3, Math.max(0, data.expandLevel | 0)),
        clientId: data.clientId ? String(data.clientId).slice(0, 64) : null
      };
      const opp = findMatch(player);
      if (opp) {
        dequeueToken(opp.token);
        startRoom(opp, player);
      } else {
        enqueue(player);
        send(ws, { type: 'queued', duration: player.duration, trophies: player.trophies });
      }
      return;
    }
    if (type === 'leave_queue') {
      dequeueToken(ws._token);
      send(ws, { type: 'queue_left' });
      return;
    }
    if (type === 'expand_queue') {
      dequeueToken(ws._token);
      const player = {
        token: ws._token, ws,
        name: String(data.name || 'Игрок').slice(0, 24),
        trophies: Math.max(0, data.trophies | 0),
        duration: (data.duration === 60 || data.duration === 180) ? data.duration : 120,
        expandLevel: Math.min(3, Math.max(0, data.expandLevel | 0)),
        clientId: data.clientId ? String(data.clientId).slice(0, 64) : null
      };
      const opp = findMatch(player);
      if (opp) {
        dequeueToken(opp.token);
        startRoom(opp, player);
      } else {
        enqueue(player);
        send(ws, { type: 'queued', expandLevel: player.expandLevel });
      }
      return;
    }
    if (type === 'rejoin') {
      const matchId = data.matchId ? String(data.matchId) : null;
      const token = data.token ? String(data.token) : (ws._token || null);
      let room = matchId ? rooms.get(matchId) : null;
      // Persistence: after restart room may only exist in store
      if (!room && matchId && store) {
        // Sync path: schedule async restore then client can retry, or wait briefly
        store.loadRoom(matchId).then((snap) => {
          if (!snap) {
            send(ws, { type: 'rejoin_fail', reason: 'not_found', matchId: matchId });
            return;
          }
          let r = rooms.get(matchId);
          if (!r) {
            r = MatchRoom.restore(snap);
            if (r) console.log('[store] restored room', matchId, 'status=', r.status);
          }
          if (!r) {
            send(ws, { type: 'rejoin_fail', reason: 'not_found', matchId: matchId });
            return;
          }
          if (r.status === 'ended') {
            send(ws, { type: 'rejoin_fail', reason: 'ended', matchId: matchId });
            return;
          }
          if (!token || !r.getPlayer(token)) {
            send(ws, { type: 'rejoin_fail', reason: 'bad_token', matchId: matchId });
            return;
          }
          ws._token = token;
          ws._matchId = r.id;
          r.attach(token, ws);
          try {
            const st = r.state[r.getPlayer(token).seat];
            if (!st.pieces || !st.pieces.length || st.pieces.every(function (pc) { return pc && pc.used; })) {
              st.pieces = dealThree();
            }
          } catch (_) {}
          const snap2 = r.snapshotFor(token);
          if (snap2) {
            snap2.type = 'rejoin_ok';
            snap2.matchId = r.id;
            snap2.token = token;
            snap2.seat = r.getPlayer(token).seat;
            snap2.source = r.source || 'ranked';
            snap2.duration = r.duration;
            snap2.clockEndTs = r.clockEndTs;
            snap2.vsTimeLeft = r.timeLeft();
            if (snap2.me && snap2.me.pieces) snap2.me.pieces = serializePieces(snap2.me.pieces);
            if (snap2.opp && snap2.opp.pieces) snap2.opp.pieces = serializePieces(snap2.opp.pieces);
            send(ws, snap2);
          }
        }).catch(() => {
          send(ws, { type: 'rejoin_fail', reason: 'not_found', matchId: matchId });
        });
        return;
      }
      if (!room) {
        send(ws, { type: 'rejoin_fail', reason: 'not_found', matchId: matchId });
        return;
      }
      if (room.status === 'ended') {
        send(ws, { type: 'rejoin_fail', reason: 'ended', matchId: matchId });
        return;
      }
      if (!token || !room.getPlayer(token)) {
        send(ws, { type: 'rejoin_fail', reason: 'bad_token', matchId: matchId });
        return;
      }
      // Bind this socket as the live connection for the seat
      ws._token = token;
      ws._matchId = room.id;
      room.attach(token, ws);
      // Ensure rejoiner has a playable hand
      try {
        const st = room.state[room.getPlayer(token).seat];
        if (!st.pieces || !st.pieces.length || st.pieces.every(function (pc) { return pc && pc.used; })) {
          st.pieces = dealThree();
        }
      } catch (_) {}
      const snap = room.snapshotFor(token);
      if (snap) {
        snap.type = 'rejoin_ok';
        snap.matchId = room.id;
        snap.token = token;
        snap.seat = room.getPlayer(token).seat;
        snap.source = room.source || 'ranked';
        snap.duration = room.duration;
        snap.clockEndTs = room.clockEndTs;
        snap.vsTimeLeft = room.timeLeft();
        if (snap.me && snap.me.pieces) snap.me.pieces = serializePieces(snap.me.pieces);
        if (snap.opp && snap.opp.pieces) snap.opp.pieces = serializePieces(snap.opp.pieces);
        send(ws, snap);
      }
      // Explicit online to the other player (attach also broadcasts; send twice is ok)
      try {
        const seat = room.getPlayer(token).seat;
        const otherTok = room.seatOf[room.otherSeat(seat)];
        const other = room.players[otherTok];
        if (other && other.ws) {
          send(other.ws, {
            type: 'player_status',
            seat: seat,
            online: true,
            clockEndTs: room.clockEndTs,
            vsTimeLeft: room.timeLeft(),
            dcDeadlineTs: 0,
            dcRemaining: 0
          });
          const otherSnap = room.snapshotFor(otherTok);
          if (otherSnap) {
            otherSnap.type = 'state';
            send(other.ws, otherSnap);
          }
        }
      } catch (_) {}
      return;
    }
    if (type === 'create_private') {
      dequeueToken(ws._token);
      leavePrivateLobby(ws._token);
      if (ws._matchId && rooms.has(ws._matchId)) {
        send(ws, { type: 'private_error', reason: 'in_match' });
        return;
      }
      let code = genPrivateCode();
      let guard = 0;
      while (privateLobbies.has(code) && guard++ < 20) code = genPrivateCode();
      const duration = (data.duration === 60 || data.duration === 180) ? data.duration : 120;
      const lobby = {
        code, duration, hostReady: false, guestReady: false, createdAt: Date.now(),
        host: {
          token: ws._token, ws,
          name: String(data.name || 'Игрок').slice(0, 24),
          trophies: Math.max(0, data.trophies | 0),
          friendCode: data.friendCode ? String(data.friendCode).slice(0, 16) : null
        },
        guest: null
      };
      privateLobbies.set(code, lobby);
      ws._privateCode = code;
      send(ws, lobbySnapshot(lobby, 'host'));
      return;
    }
    if (type === 'join_private') {
      dequeueToken(ws._token);
      leavePrivateLobby(ws._token);
      if (ws._matchId && rooms.has(ws._matchId)) {
        send(ws, { type: 'private_error', reason: 'in_match' });
        return;
      }
      const code = String(data.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const lobby = privateLobbies.get(code);
      if (!lobby || !lobby.host) {
        send(ws, { type: 'private_error', reason: 'not_found', code });
        return;
      }
      if (lobby.guest) {
        send(ws, { type: 'private_error', reason: 'full', code });
        return;
      }
      if (lobby.host.token === ws._token) {
        send(ws, { type: 'private_error', reason: 'self', code });
        return;
      }
      // Reattach host if soft-disconnected
      if (lobby.host && !lobby.host.ws) lobby.host.ws = lobby.host.ws;
      lobby.guest = {
        token: ws._token, ws,
        name: String(data.name || 'Игрок').slice(0, 24),
        trophies: Math.max(0, data.trophies | 0),
        friendCode: data.friendCode ? String(data.friendCode).slice(0, 16) : null
      };
      ws._privateCode = code;
      send(ws, lobbySnapshot(lobby, 'guest'));
      if (lobby.host.ws) send(lobby.host.ws, lobbySnapshot(lobby, 'host'));
      return;
    }
    if (type === 'leave_private') {
      leavePrivateLobby(ws._token);
      ws._privateCode = null;
      send(ws, { type: 'private_left' });
      return;
    }
    if (type === 'private_ready') {
      const code = String(data.code || ws._privateCode || '').toUpperCase();
      const lobby = privateLobbies.get(code);
      if (!lobby) {
        send(ws, { type: 'private_error', reason: 'not_in_lobby' });
        return;
      }
      if (lobby.host && lobby.host.token === ws._token) {
        lobby.hostReady = !!data.ready;
        lobby.host.ws = ws;
      } else if (lobby.guest && lobby.guest.token === ws._token) {
        lobby.guestReady = !!data.ready;
        lobby.guest.ws = ws;
      } else {
        send(ws, { type: 'private_error', reason: 'not_in_lobby' });
        return;
      }
      if (lobby.host && lobby.host.ws) send(lobby.host.ws, lobbySnapshot(lobby, 'host'));
      if (lobby.guest && lobby.guest.ws) send(lobby.guest.ws, lobbySnapshot(lobby, 'guest'));
      if (lobby.hostReady && lobby.guestReady && lobby.host && lobby.guest) {
        tryStartPrivate(lobby);
      }
      return;
    }
    if (type === 'private_duration') {
      const code = String(data.code || ws._privateCode || '').toUpperCase();
      const lobby = privateLobbies.get(code);
      if (!lobby || !lobby.host || lobby.host.token !== ws._token) return;
      const d = data.duration | 0;
      lobby.duration = (d === 60 || d === 180) ? d : 120;
      lobby.hostReady = false;
      lobby.guestReady = false;
      if (lobby.host.ws) send(lobby.host.ws, lobbySnapshot(lobby, 'host'));
      if (lobby.guest && lobby.guest.ws) send(lobby.guest.ws, lobbySnapshot(lobby, 'guest'));
      return;
    }
    if (type === 'presence_register') {
      const code = String(data.friendCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
      if (!code) return;
      presence.set(code, {
        token: ws._token, ws,
        name: String(data.name || 'Игрок').slice(0, 24),
        activity: String(data.activity || 'online').slice(0, 32),
        trophies: Math.max(0, data.trophies | 0),
        ts: Date.now()
      });
      ws._friendCode = code;
      send(ws, { type: 'presence_ok', friendCode: code });
      const deliverBox = (box) => {
        if (!box || !box.length) return;
        pendingSocial.delete(code);
        if (store) store.setSocial(code, []).catch(() => {});
        for (const msg of box) {
          try { send(ws, { type: 'social_msg', msg }); } catch (_) {}
        }
      };
      const memBox = pendingSocial.get(code);
      if (memBox && memBox.length) {
        deliverBox(memBox);
      } else if (store) {
        store.getSocial(code).then((box) => deliverBox(box)).catch(() => {});
      }
      return;
    }
    if (type === 'presence_query') {
      const codes = Array.isArray(data.codes) ? data.codes : [];
      const result = {};
      for (const raw of codes.slice(0, 40)) {
        const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
        if (!code) continue;
        const p = presence.get(code);
        if (p && p.ws && p.ws.readyState === 1) {
          result[code] = { online: true, name: p.name, activity: p.activity, trophies: p.trophies | 0 };
        } else {
          result[code] = { online: false };
        }
      }
      send(ws, { type: 'presence_state', friends: result });
      return;
    }
    if (type === 'presence_activity') {
      if (ws._friendCode && presence.has(ws._friendCode)) {
        const p = presence.get(ws._friendCode);
        p.activity = String(data.activity || 'online').slice(0, 32);
        p.ts = Date.now();
      }
      return;
    }
    if (type === 'social_send') {
      const to = String(data.to || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
      if (!to) {
        send(ws, { type: 'social_result', ok: false, reason: 'bad_target' });
        return;
      }
      const fromCode = ws._friendCode || String(data.from || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
      const msgType = String(data.msgType || data.socialType || 'message').slice(0, 40);
      const payload = (data.payload && typeof data.payload === 'object') ? data.payload : {};
      const out = Object.assign({}, payload, {
        type: msgType, code: fromCode, from: fromCode,
        name: String(data.name || payload.name || 'Игрок').slice(0, 24),
        trophies: Math.max(0, (data.trophies != null ? data.trophies : payload.trophies) | 0),
        activity: String(data.activity || payload.activity || 'online').slice(0, 32),
        via: 'ws', ts: Date.now()
      });
      if (payload.room) out.room = String(payload.room).slice(0, 12);
      if (payload.reason) out.reason = String(payload.reason).slice(0, 40);

      const target = presence.get(to);
      if (target && target.ws && target.ws.readyState === 1) {
        send(target.ws, { type: 'social_msg', msg: out });
        send(ws, { type: 'social_result', ok: true, to, msgType, delivered: true });
        return;
      }
      const queueable = /^(friend_req|friend_req_cancel|friend_accept|friend_decline|friend_remove|friend_req_ack|challenge|challenge_cancel|challenge_decline|challenge_accept)$/.test(msgType);
      if (queueable) {
        if (!pendingSocial.has(to)) pendingSocial.set(to, []);
        const box = pendingSocial.get(to);
        if (msgType === 'friend_req' || msgType === 'friend_req_cancel') {
          for (let i = box.length - 1; i >= 0; i--) {
            if (box[i].type === 'friend_req' && box[i].from === fromCode) box.splice(i, 1);
          }
        }
        if (msgType !== 'friend_req_cancel') box.push(out);
        if (box.length > 30) box.splice(0, box.length - 30);
        if (store) store.setSocial(to, box).catch(() => {});
        send(ws, { type: 'social_result', ok: true, to, msgType, delivered: false, queued: true });
        return;
      }
      send(ws, { type: 'social_result', ok: false, reason: 'offline', to });
      return;
    }
    if (type === 'place') {
      const ctx = resolveMatchCtx(ws, data);
      if (!ctx) {
        send(ws, { type: 'place_reject', reason: 'no_match' });
        return;
      }
      ctx.room.applyPlace(ctx.token, data);
      return;
    }
    if (type === 'deal') {
      const ctx = resolveMatchCtx(ws, data);
      if (ctx) ctx.room.applyDeal(ctx.token, data);
      return;
    }
    if (type === 'sync') {
      const ctx = resolveMatchCtx(ws, data);
      if (ctx) ctx.room.applySync(ctx.token, data);
      return;
    }
    if (type === 'forfeit') {
      const ctx = resolveMatchCtx(ws, data);
      if (ctx) ctx.room.forfeit(ctx.token);
      return;
    }
    if (type === 'rematch_offer' || type === 'rematch_accept') {
      const matchId = data.matchId || ws._matchId;
      const room = matchId ? rooms.get(matchId) : null;
      const token = data.token || ws._token;
      if (!room || !room.getPlayer(token)) {
        send(ws, { type: 'rematch_decline', reason: 'not_found' });
        return;
      }
      ws._token = token;
      ws._matchId = room.id;
      // Re-bind socket if needed
      if (room.players[token].ws !== ws) room.attach(token, ws);
      if (type === 'rematch_offer') room.offerRematch(token);
      else room.acceptRematch(token);
      return;
    }
    if (type === 'rematch_decline') {
      const matchId = data.matchId || ws._matchId;
      const room = matchId ? rooms.get(matchId) : null;
      const token = data.token || ws._token;
      if (room && room.getPlayer(token)) room.declineRematch(token);
      return;
    }
    if (type === 'ping') {
      send(ws, { type: 'pong', t: data.t || Date.now() });
      const room = rooms.get(ws._matchId);
      if (room) {
        const p = room.getPlayer(ws._token);
        if (p) {
          p.lastSeen = Date.now();
          room.state[p.seat].lastSeen = Date.now();
          if (!p.online) {
            p.online = true;
            room.state[p.seat].online = true;
            room.broadcast({ type: 'player_status', seat: p.seat, online: true, vsTimeLeft: room.timeLeft() }, ws._token);
          }
        }
      }
      return;
    }
    if (type === 'leave_match') {
      const room = rooms.get(ws._matchId);
      if (room) room.detach(ws._token);
      return;
    }
  });

  ws.on('close', () => {
    dequeueToken(ws._token);
    if (ws._privateCode && privateLobbies.has(ws._privateCode)) {
      const lobby = privateLobbies.get(ws._privateCode);
      const code = ws._privateCode;
      if (lobby.host && lobby.host.token === ws._token) {
        lobby.host.ws = null;
        setTimeout(() => {
          const L = privateLobbies.get(code);
          if (L && L.host && L.host.token === ws._token && (!L.host.ws || L.host.ws.readyState !== 1)) {
            leavePrivateLobby(ws._token);
          }
        }, 90000);
      } else if (lobby.guest && lobby.guest.token === ws._token) {
        lobby.guest = null;
        lobby.hostReady = false;
        lobby.guestReady = false;
        if (lobby.host && lobby.host.ws && lobby.host.ws.readyState === 1) {
          send(lobby.host.ws, lobbySnapshot(lobby, 'host'));
        }
      }
    }
    if (ws._friendCode && presence.has(ws._friendCode)) {
      const p = presence.get(ws._friendCode);
      if (p && p.token === ws._token) presence.delete(ws._friendCode);
    }
    if (ws._matchId && rooms.has(ws._matchId)) {
      rooms.get(ws._matchId).detach(ws._token, ws);
    }
  });
});

setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      try { ws.terminate(); } catch (_) {}
      return;
    }
    ws.isAlive = false;
    try { ws.ping(); } catch (_) {}
  });
}, 25000);

async function boot() {
  try {
    store = await createStore();
  } catch (e) {
    console.warn('[store] init failed, using memory:', e && e.message);
    store = await createStore(); // createStore already falls back
  }

  // Restore active rooms from persistence (rejoin after restart)
  if (store && store.kind !== 'memory') {
    try {
      const ids = await store.listRoomIds();
      let n = 0;
      for (const id of ids) {
        try {
          const data = await store.loadRoom(id);
          if (!data) continue;
          // Skip expired live matches whose clock is long over
          if (data.status === 'live' && data.clockEndTs && Date.now() - data.clockEndTs > 120000) {
            await store.deleteRoom(id);
            continue;
          }
          if (rooms.has(id)) continue;
          const room = MatchRoom.restore(data);
          if (room) n++;
        } catch (err) {
          console.warn('[store] restore failed', id, err && err.message);
        }
      }
      if (n) console.log('[store] restored', n, 'room(s)');
    } catch (e) {
      console.warn('[store] list/restore error:', e && e.message);
    }
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log('Block Puzzle on http://0.0.0.0:' + PORT + ' | ws /ws | store=' + (store && store.kind));
  });
}

boot().catch((e) => {
  console.error('boot failed', e);
  process.exit(1);
});

function shutdown() {
  try {
    // Flush live rooms one last time
    if (store) {
      for (const room of rooms.values()) {
        try { persistRoom(room); } catch (_) {}
      }
      setTimeout(() => {
        try { store.close(); } catch (_) {}
        process.exit(0);
      }, 200);
      return;
    }
  } catch (_) {}
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
