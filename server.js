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
const zlib = require('zlib');
const crypto = require('crypto');
const { WebSocketServer } = require('./vendor/ws');
const { createStore, ROOM_TTL_LIVE, ROOM_TTL_ENDED, TOKEN_TTL, QUEUE_TTL, PRESENCE_TTL } = require('./lib/store');
const { SKIN_PALETTES, paletteForSkin } = require('./shared/skins');
const { log, PKG_VERSION } = require('./lib/logger');
const { allowWsConnection, allowWsMessage } = require('./lib/rate-limit');
const { WS_ORIGINS, applySecurityHeaders, isOriginAllowed } = require('./lib/security');

// Shared authoritative rules (single source with client)
const R = require('./shared/rules');
const {
  SIZE, DEFAULT_COLORS, emptyGrid, cloneGrid, normalizeShape,
  randomPiece, dealThree, canPlaceOn, clearLinesOnGrid, bonusFor, chainBonusFor,
  serializePieces, findAllPlacements, sideHasPlayable,
  MIN_PLACE_INTERVAL_MS, PLACE_BURST_WINDOW_MS, PLACE_BURST_MAX,
  DC_LIMIT_MS, AFK_WARN_MS, AFK_LIMIT_MS,
  DETACH_GRACE_MS, MATCH_START_GRACE_MS, AFK_WARN_BROADCAST_MS
} = R;

/** Max inbound WS JSON message size (bytes). Default 64 KiB. */
const MAX_WS_MSG = Math.max(4096, Number(process.env.BP_MAX_WS_MSG) || 65536);
const PORT = Number(process.env.PORT) || 9000;
const PUBLIC = path.join(__dirname, 'public');


/** @type {import('./lib/store').MemoryStore|null} */
let store = null;

function persistRoom(room) {
  if (!store || !room) return;
  try {
    const ttl = room.status === 'ended' ? ROOM_TTL_ENDED : ROOM_TTL_LIVE;
    let left = ROOM_TTL_LIVE;
    if (room.status === 'live' && room.clockEndTs) {
      left = Math.max(30, Math.ceil((room.clockEndTs - Date.now()) / 1000) + 60);
    } else if (room.status === 'loading') {
      left = ROOM_TTL_LIVE;
    } else {
      left = ROOM_TTL_ENDED;
    }
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
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8'
};

/** Extensions eligible for on-the-fly gzip (text-like assets). */
const COMPRESSIBLE = new Set([
  '.html', '.js', '.css', '.json', '.svg', '.webmanifest', '.txt', '.map'
]);


/**
 * Serve a static file with optional gzip when the client accepts it.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {string} filePath
 */
function sendFile(req, res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      applySecurityHeaders(res);
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    if (ext === '.html' || ext === '.js' || ext === '.css') {
      // Prevent stale mobile WebView cache of gameplay/CSS (was causing "random" anim feel)
      headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
      headers['Pragma'] = 'no-cache';
    } else if (ext === '.svg' || ext === '.webmanifest' || ext === '.woff2' ||
               ext === '.png' || ext === '.jpg' || ext === '.ico') {
      headers['Cache-Control'] = 'public, max-age=86400';
    }

    // Copy security headers into the response map before writeHead
    applySecurityHeaders({
      setHeader(k, v) { headers[k] = v; }
    });

    const accept = String((req && req.headers && req.headers['accept-encoding']) || '');
    const wantGzip = COMPRESSIBLE.has(ext) && data.length > 512 && /\bgzip\b/.test(accept);

    if (wantGzip) {
      zlib.gzip(data, { level: 6 }, (zerr, compressed) => {
        if (zerr || !compressed || compressed.length >= data.length) {
          res.writeHead(200, headers);
          res.end(data);
          return;
        }
        headers['Content-Encoding'] = 'gzip';
        headers['Vary'] = 'Accept-Encoding';
        res.writeHead(200, headers);
        res.end(compressed);
      });
      return;
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

/** Snapshot queue entries without live ws handles (for persistence). */
function snapshotQueues() {
  const out = [];
  for (const [key, q] of queues) {
    for (const p of q) {
      if (!p || !p.token) continue;
      out.push({
        key,
        token: p.token,
        clientId: p.clientId || null,
        duration: p.duration || 120,
        trophies: p.trophies | 0,
        expandLevel: p.expandLevel | 0,
        name: p.name ? String(p.name).slice(0, 32) : '',
        platform: p.platform || 'web',
        os: p.os || 'unknown',
        queuedAt: p.queuedAt || Date.now()
      });
    }
  }
  return out;
}

function snapshotPresence() {
  const out = {};
  for (const [code, e] of presence) {
    if (!code || !e) continue;
    out[code] = {
      name: e.name ? String(e.name).slice(0, 32) : '',
      trophies: e.trophies | 0,
      platform: e.platform || 'web',
      os: e.os || 'unknown',
      lastSeen: e.lastSeen || Date.now(),
      online: !!(e.ws && e.ws.readyState === 1)
    };
  }
  return out;
}

let _persistMetaTimer = null;
function schedulePersistMeta() {
  if (!store || store.kind === 'memory') return;
  if (_persistMetaTimer) return;
  _persistMetaTimer = setTimeout(() => {
    _persistMetaTimer = null;
    persistMetaNow();
  }, 800);
}

function persistMetaNow() {
  if (!store || store.kind === 'memory') return;
  try {
    store.saveQueue(snapshotQueues(), QUEUE_TTL).catch(() => {});
    // presence is written per-code on register; still refresh all live entries
    const snap = snapshotPresence();
    for (const [code, data] of Object.entries(snap)) {
      store.savePresence(code, data, PRESENCE_TTL).catch(() => {});
    }
  } catch (_) {}
}

/** Pending queue intents restored from disk (token → entry). Re-applied on reconnect. */
const pendingQueueIntents = new Map();


function uid(prefix) {
  // 16 random bytes → 128-bit session/match ids (was 8 bytes / 64-bit)
  return prefix + '_' + crypto.randomBytes(16).toString('hex');
}

function sanitizeCosmetics(data) {
  data = data || {};
  const skinId = data.skinId ? String(data.skinId).slice(0, 32) : 'default';
  const boardId = data.boardId ? String(data.boardId).slice(0, 32) : 'field_default';
  const avatarId = data.avatarId ? String(data.avatarId).slice(0, 32) : 'init';
  // Custom avatar: data-URL / http(s) only, hard size cap (48 KiB) to limit memory DoS
  let avatarCustom = '';
  if (data.avatarCustom && typeof data.avatarCustom === 'string') {
    const s = data.avatarCustom.slice(0, 49152);
    if (/^(data:image\/(png|jpeg|jpg|webp|gif);base64,|https?:\/\/)/i.test(s)) {
      avatarCustom = s;
    }
  }
  return { skinId, boardId, avatarId, avatarCustom };
}

function dealForSeat(st) {
  return dealThree(paletteForSkin(st && st.skinId));
}




function normalizePlatform(p) {
  const s = String(p || '').toLowerCase();
  if (s === 'mobile' || s === 'phone' || s === 'android' || s === 'ios') return 'mobile';
  if (s === 'tablet' || s === 'ipad') return 'tablet';
  if (s === 'desktop' || s === 'pc' || s === 'web') return 'desktop';
  return s || 'web';
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
  if (!player.queuedAt) player.queuedAt = Date.now();
  queues.get(key).push(player);
  pendingQueueIntents.delete(player.token);
  schedulePersistMeta();
}

function dequeueToken(token) {
  let removed = false;
  for (const q of queues.values()) {
    for (let i = q.length - 1; i >= 0; i--) {
      if (q[i].token === token) {
        q.splice(i, 1);
        removed = true;
      }
    }
  }
  if (pendingQueueIntents.has(token)) {
    pendingQueueIntents.delete(token);
    removed = true;
  }
  if (removed) schedulePersistMeta();
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
    const platA = p1.platform || (p1.ws && p1.ws._platform) || 'web';
    const platB = p2.platform || (p2.ws && p2.ws._platform) || 'web';
    const osA = p1.os || (p1.ws && p1.ws._os) || 'unknown';
    const osB = p2.os || (p2.ws && p2.ws._os) || 'unknown';
    const isCross = !!(platA && platB && platA !== platB) || !!(osA && osB && osA !== osB && osA !== 'unknown' && osB !== 'unknown');
    const meIsP1 = token === p1.token;
    room.send(token, {
      type: 'match_found',
      matchId: room.id,
      token,
      duration: room.duration,
      clockEndTs: room.clockEndTs || 0,
      vsTimeLeft: room.duration,
      loading: true,
      me,
      opp,
      seat: snap.seat,
      source: room.source,
      privateCode: room.privateCode,
      // Crossplay: phone ↔ PC / any OS on the same rules + server clock
      crossplay: true,
      crossplayPair: isCross,
      mePlatform: meIsP1 ? platA : platB,
      oppPlatform: meIsP1 ? platB : platA,
      meOs: meIsP1 ? osA : osB,
      oppOs: meIsP1 ? osB : osA,
      protocolVersion: 1
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
  const host = lobby.host;
  const guest = lobby.guest;
  return {
    type: 'private_lobby',
    code: lobby.code,
    role,
    duration: lobby.duration,
    hostReady: !!lobby.hostReady,
    guestReady: !!lobby.guestReady,
    hostName: host ? (host.name || 'Хост') : null,
    hostRtt: host && typeof host.rtt === 'number' ? host.rtt : null,
    guestRtt: guest && typeof guest.rtt === 'number' ? guest.rtt : null,
    opp: opp ? {
      name: opp.name,
      trophies: opp.trophies | 0,
      skinId: opp.skinId || 'default',
      boardId: opp.boardId || 'field_default',
      avatarId: opp.avatarId || 'init',
      avatarCustom: opp.avatarCustom || '',
      friendCode: opp.friendCode || null,
      rtt: typeof opp.rtt === 'number' ? opp.rtt : null,
      isHost: role === 'guest'
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
    skinId: lobby.host.skinId || 'default',
    boardId: lobby.host.boardId || 'field_default',
    avatarId: lobby.host.avatarId || 'init',
    avatarCustom: lobby.host.avatarCustom || '',
    duration: lobby.duration,
    platform: lobby.host.platform || (lobby.host.ws && lobby.host.ws._platform) || 'web',
    os: lobby.host.os || (lobby.host.ws && lobby.host.ws._os) || 'unknown'
  };
  const p2 = {
    token: lobby.guest.token,
    ws: lobby.guest.ws,
    name: lobby.guest.name,
    trophies: lobby.guest.trophies | 0,
    skinId: lobby.guest.skinId || 'default',
    boardId: lobby.guest.boardId || 'field_default',
    avatarId: lobby.guest.avatarId || 'init',
    avatarCustom: lobby.guest.avatarCustom || '',
    duration: lobby.duration,
    platform: lobby.guest.platform || (lobby.guest.ws && lobby.guest.ws._platform) || 'web',
    os: lobby.guest.os || (lobby.guest.ws && lobby.guest.ws._os) || 'unknown'
  };
  // Bind duration onto both
  p1.duration = lobby.duration;
  p2.duration = lobby.duration;
  startRoom(p1, p2, { source: 'lobby', code });
  return true;
}

const server = http.createServer((req, res) => {
  try {
    applySecurityHeaders(res);
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
      let liveRooms = 0;
      let endedRooms = 0;
      for (const r of rooms.values()) {
        if (r && r.status === 'ended') endedRooms += 1;
        else liveRooms += 1;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        service: 'block-puzzle',
        version: PKG_VERSION,
        crossplay: true,
        protocolVersion: 1,
        rooms: rooms.size,
        roomsLive: liveRooms,
        roomsEnded: endedRooms,
        queue: totalQueued(),
        privateLobbies: privateLobbies.size,
        presence: presence.size,
        wsClients,
        store: store ? store.kind : 'none',
        uptime: Math.floor(process.uptime()),
        node: process.version,
        pid: process.pid,
        memoryRss: process.memoryUsage().rss
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
        sendFile(req, res, filePath);
        return;
      }
      // SPA fallback
      sendFile(req, res, path.join(PUBLIC, 'index.html'));
    });
  } catch (e) {
    try { applySecurityHeaders(res); } catch (_) {}
    res.writeHead(500);
    res.end('Server error');
  }
});

const wss = new WebSocketServer({
  noServer: true,
  maxPayload: MAX_WS_MSG,
  perMessageDeflate: false
});
wss.on('error', (err) => {
  try { log('error', 'wss error', { message: err && err.message, code: err && err.code }); } catch (_) {}
});


server.on('upgrade', (req, socket, head) => {
  try {
    const u = req.url || '';
    if (u === '/ws' || u.startsWith('/ws?')) {
      if (WS_ORIGINS.length) {
        const origin = String(req.headers.origin || '');
        if (!isOriginAllowed(origin)) {
          socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
          socket.destroy();
          return;
        }
      }
      const ip = (req.socket && req.socket.remoteAddress) || '';
      if (!allowWsConnection(ip)) {
        socket.write('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return;
      }
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
  if (!room || (room.status !== 'live' && room.status !== 'loading')) return null;
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
  ws._msgWindow = null;
  // Prevent unhandled 'error' (e.g. max payload) from crashing the process
  ws.on('error', (err) => {
    try {
      log('warn', 'ws error', {
        code: err && err.code,
        message: err && err.message,
        token: ws._token || null
      });
    } catch (_) {}
  });
  ws.on('pong', () => { ws.isAlive = true; });
  send(ws, {
    type: 'hello',
    token: ws._token,
    protocolVersion: 1,
    crossplay: true,
    // Explicit: one queue for phone + PC + any OS
    platforms: ['mobile', 'desktop', 'tablet', 'web']
  });

  ws.on('message', (raw) => {
    if (!allowWsMessage(ws)) return;
    let data;
    try { data = JSON.parse(String(raw)); } catch (_) { return; }
    if (!data || typeof data !== 'object') return;
    const type = data.type;

    if (type === 'client_info') {
      try {
        ws._platform = normalizePlatform(data.platform || data.device);
        ws._os = String(data.os || 'unknown').slice(0, 24);
        ws._protocolVersion = (data.protocolVersion | 0) || 1;
        ws._clientBuild = data.build ? String(data.build).slice(0, 32) : '';
        send(ws, {
          type: 'client_info_ok',
          crossplay: true,
          protocolVersion: 1,
          platform: ws._platform,
          os: ws._os
        });
      } catch (_) {}
      return;
    }

    if (type === 'join_queue') {
      dequeueToken(ws._token);
      if (ws._matchId && rooms.has(ws._matchId)) {
        const room = rooms.get(ws._matchId);
        const snap = room.snapshotFor(ws._token);
        if (snap) send(ws, snap);
        return;
      }
      const intent = pendingQueueIntents.get(ws._token);
      const player = {
        token: ws._token, ws,
        name: String(data.name || 'Игрок').slice(0, 24),
        trophies: Math.max(0, data.trophies | 0),
        skinId: data.skinId ? String(data.skinId).slice(0, 32) : 'default',
        boardId: data.boardId ? String(data.boardId).slice(0, 32) : 'field_default',
        avatarId: data.avatarId ? String(data.avatarId).slice(0, 32) : 'init',
        avatarCustom: (data.avatarCustom && typeof data.avatarCustom === 'string') ? String(data.avatarCustom).slice(0, 49152) : '',
        duration: (data.duration === 60 || data.duration === 180) ? data.duration : 120,
        expandLevel: Math.min(3, Math.max(0, data.expandLevel | 0)),
        clientId: data.clientId ? String(data.clientId).slice(0, 64) : null,
        // Crossplay: accept any device/OS — never segregate queues by platform
        platform: normalizePlatform(data.platform || data.device || ws._platform),
        os: String(data.os || ws._os || 'unknown').slice(0, 24),
        protocolVersion: (data.protocolVersion | 0) || 1,
        queuedAt: (intent && intent.queuedAt) || Date.now()
      };
      try {
        ws._platform = player.platform;
        ws._os = player.os;
      } catch (_) {}
      const opp = findMatch(player);
      if (opp) {
        dequeueToken(opp.token);
        startRoom(opp, player);
      } else {
        enqueue(player);
        send(ws, { type: 'queued', duration: player.duration, trophies: player.trophies, restored: !!intent });
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
        skinId: data.skinId ? String(data.skinId).slice(0, 32) : 'default',
        boardId: data.boardId ? String(data.boardId).slice(0, 32) : 'field_default',
        avatarId: data.avatarId ? String(data.avatarId).slice(0, 32) : 'init',
        avatarCustom: (data.avatarCustom && typeof data.avatarCustom === 'string') ? String(data.avatarCustom).slice(0, 49152) : '',
        duration: (data.duration === 60 || data.duration === 180) ? data.duration : 120,
        expandLevel: Math.min(3, Math.max(0, data.expandLevel | 0)),
        clientId: data.clientId ? String(data.clientId).slice(0, 64) : null,
        // Crossplay: accept any device/OS — never segregate queues by platform
        platform: normalizePlatform(data.platform || data.device || ws._platform),
        os: String(data.os || ws._os || 'unknown').slice(0, 24),
        protocolVersion: (data.protocolVersion | 0) || 1
      };
      try {
        ws._platform = player.platform;
        ws._os = player.os;
      } catch (_) {}
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
            if (r) log('info', 'store restored room on rejoin', { matchId, status: r.status });
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
              st.pieces = dealForSeat(st);
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
          st.pieces = dealForSeat(st);
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
      // Explicit online to the other player (attach also broadcasts; send twice is ok).
      // Do NOT push a full state snapshot to the continuous player — it can thrash
      // their hand / placingLock and block their next move mid-drag.
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
            dcRemaining: 0,
            rejoinPendingMove: false,
            awaitingMove: false,
            reason: 'online'
          });
        }
      } catch (_) {}
      return;
    }
    if (type === 'create_private') {
      dequeueToken(ws._token);
      leavePrivateLobby(ws._token);
      // Always leave any previous match (live or ended rematch) — user explicitly wants a room
      if (ws._matchId && rooms.has(ws._matchId)) {
        const room = rooms.get(ws._matchId);
        try {
          if (room && room.status === 'live') {
            // Soft leave — detach without blocking room creation
            try { room.detach(ws._token); } catch (_) {}
          }
        } catch (_) {}
      }
      ws._matchId = null;
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
          skinId: data.skinId ? String(data.skinId).slice(0, 32) : 'default',
          boardId: data.boardId ? String(data.boardId).slice(0, 32) : 'field_default',
          avatarId: data.avatarId ? String(data.avatarId).slice(0, 32) : 'init',
          avatarCustom: (data.avatarCustom && typeof data.avatarCustom === 'string') ? String(data.avatarCustom).slice(0, 49152) : '',
          friendCode: data.friendCode ? String(data.friendCode).slice(0, 16) : null,
          platform: normalizePlatform(data.platform || ws._platform || 'web'),
          os: String(data.os || ws._os || 'unknown').slice(0, 24)
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
        const room = rooms.get(ws._matchId);
        try {
          if (room && room.status === 'live') {
            try { room.detach(ws._token); } catch (_) {}
          }
        } catch (_) {}
      }
      ws._matchId = null;
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
        skinId: data.skinId ? String(data.skinId).slice(0, 32) : 'default',
        boardId: data.boardId ? String(data.boardId).slice(0, 32) : 'field_default',
        avatarId: data.avatarId ? String(data.avatarId).slice(0, 32) : 'init',
        avatarCustom: (data.avatarCustom && typeof data.avatarCustom === 'string') ? String(data.avatarCustom).slice(0, 49152) : '',
        friendCode: data.friendCode ? String(data.friendCode).slice(0, 16) : null,
        platform: normalizePlatform(data.platform || ws._platform || 'web'),
        os: String(data.os || ws._os || 'unknown').slice(0, 24)
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
      const presEntry = {
        token: ws._token, ws,
        name: String(data.name || 'Игрок').slice(0, 24),
        activity: String(data.activity || 'online').slice(0, 32),
        trophies: Math.max(0, data.trophies | 0),
        platform: normalizePlatform(data.platform || ws._platform || 'web'),
        os: String(data.os || ws._os || 'unknown').slice(0, 24),
        lastSeen: Date.now(),
        ts: Date.now()
      };
      presence.set(code, presEntry);
      ws._friendCode = code;
      if (store && store.kind !== 'memory') {
        store.savePresence(code, {
          name: presEntry.name,
          activity: presEntry.activity,
          trophies: presEntry.trophies,
          platform: presEntry.platform,
          os: presEntry.os,
          lastSeen: presEntry.lastSeen,
          online: true
        }, PRESENCE_TTL).catch(() => {});
      }
      schedulePersistMeta();
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
      const normalized = [];
      for (const raw of codes.slice(0, 40)) {
        const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
        if (code) normalized.push(code);
      }
      const result = {};
      const needStore = [];
      for (const code of normalized) {
        const p = presence.get(code);
        if (p && p.ws && p.ws.readyState === 1) {
          result[code] = {
            online: true,
            name: p.name,
            activity: p.activity || 'online',
            trophies: p.trophies | 0,
            lastSeen: p.lastSeen || p.ts || Date.now()
          };
        } else if (p && (p.name || p.trophies)) {
          result[code] = {
            online: false,
            name: p.name || '',
            activity: p.activity || 'away',
            trophies: p.trophies | 0,
            lastSeen: p.lastSeen || p.ts || 0
          };
        } else {
          needStore.push(code);
          result[code] = { online: false };
        }
      }
      const finish = () => send(ws, { type: 'presence_state', friends: result });
      if (!needStore.length || !store || store.kind === 'memory') {
        finish();
        return;
      }
      Promise.all(needStore.map((code) =>
        store.loadPresence(code).then((data) => {
          if (!data) return;
          result[code] = {
            online: false,
            name: data.name || '',
            activity: data.activity || 'offline',
            trophies: data.trophies | 0,
            lastSeen: data.lastSeen || 0
          };
        }).catch(() => {})
      )).then(finish).catch(finish);
      return;
    }
    if (type === 'friend_code_check') {
      const code = String(data.code || data.friendCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      if (!code || code.length !== 6) {
        send(ws, { type: 'friend_code_check_result', code: code || '', ok: false, reason: 'bad_code' });
        return;
      }
      if (ws._friendCode && code === ws._friendCode) {
        send(ws, { type: 'friend_code_check_result', code, ok: false, reason: 'self' });
        return;
      }
      // Live presence first
      const live = presence.get(code);
      if (live && live.ws && live.ws.readyState === 1) {
        send(ws, {
          type: 'friend_code_check_result',
          code,
          ok: true,
          online: true,
          name: String(live.name || '').slice(0, 24) || code,
          trophies: live.trophies | 0
        });
        return;
      }
      // Recently seen (persisted presence)
      const finish = (snap) => {
        if (snap && (snap.name || snap.lastSeen)) {
          send(ws, {
            type: 'friend_code_check_result',
            code,
            ok: true,
            online: false,
            name: String(snap.name || '').slice(0, 24) || code,
            trophies: (snap.trophies | 0)
          });
        } else {
          send(ws, { type: 'friend_code_check_result', code, ok: false, reason: 'not_found' });
        }
      };
      if (store && typeof store.loadPresence === 'function') {
        store.loadPresence(code).then(finish).catch(() => finish(null));
      } else {
        finish(null);
      }
      return;
    }
    if (type === 'presence_search') {
      const raw = String(data.q || data.query || '').trim();
      const q = raw.toUpperCase().replace(/[^A-Z0-9А-ЯЁ\s\-_]/gi, '').slice(0, 24);
      const results = [];
      if (q.length >= 1) {
        const qCode = q.replace(/[^A-Z0-9]/g, '');
        const qName = raw.toLowerCase().slice(0, 24);
        for (const [code, p] of presence) {
          if (!p || !p.ws || p.ws.readyState !== 1) continue;
          if (ws._friendCode && code === ws._friendCode) continue; // self
          const name = String(p.name || '');
          const nameL = name.toLowerCase();
          const codeHit = qCode.length >= 2 && code.indexOf(qCode) === 0;
          const nameHit = qName.length >= 2 && (nameL.indexOf(qName) !== -1);
          if (!codeHit && !nameHit) continue;
          results.push({
            code,
            name: name.slice(0, 24) || code,
            trophies: p.trophies | 0,
            activity: String(p.activity || 'online').slice(0, 32)
          });
          if (results.length >= 20) break;
        }
        // Prefer exact code match first
        results.sort((a, b) => {
          const ae = a.code === qCode ? 0 : 1;
          const be = b.code === qCode ? 0 : 1;
          if (ae !== be) return ae - be;
          return (b.trophies | 0) - (a.trophies | 0);
        });
      }
      send(ws, { type: 'presence_search_result', q: raw.slice(0, 24), results });
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
    if (type === 'match_ready') {
      const ctx = resolveMatchCtx(ws, data);
      if (!ctx) {
        send(ws, { type: 'match_ready_ack', ok: false, reason: 'no_match' });
        return;
      }
      ctx.room.markReady(ctx.token);
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
      const token = data.token || ws._token;
      const room = matchId ? rooms.get(matchId) : null;
      if (room && room.getPlayer(token)) room.declineRematch(token);
      return;
    }
    if (type === 'rematch_cancel') {
      const matchId = data.matchId || ws._matchId;
      const token = data.token || ws._token;
      const room = matchId ? rooms.get(matchId) : null;
      if (room && room.getPlayer(token)) room.cancelRematch(token);
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
    if (type === 'lobby_ping') {
      const code = ws._privateCode;
      if (!code || !privateLobbies.has(code)) return;
      const lobby = privateLobbies.get(code);
      const rtt = Math.max(0, Math.min(900, (data.rtt | 0))); // clamp tab-throttle spikes
      if (lobby.host && lobby.host.token === ws._token) lobby.host.rtt = rtt;
      else if (lobby.guest && lobby.guest.token === ws._token) lobby.guest.rtt = rtt;
      // Push updated lobby to both so each sees both pings + host
      try {
        if (lobby.host && lobby.host.ws && lobby.host.ws.readyState === 1) {
          send(lobby.host.ws, lobbySnapshot(lobby, 'host'));
        }
        if (lobby.guest && lobby.guest.ws && lobby.guest.ws.readyState === 1) {
          send(lobby.guest.ws, lobbySnapshot(lobby, 'guest'));
        }
      } catch (_) {}
      return;
    }
    if (type === 'free_match') {
      // Client left rematch UI / went to menu — free socket without DC forfeit if already ended
      const mid = ws._matchId;
      const room = mid ? rooms.get(mid) : null;
      if (room && room.status === 'live') {
        try { room.detach(ws._token); } catch (_) {}
      }
      ws._matchId = null;
      return;
    }
    if (type === 'leave_match') {
      const mid = ws._matchId;
      const room = mid ? rooms.get(mid) : null;
      if (room && room.status === 'live') {
        try { room.detach(ws._token); } catch (_) {}
      }
      // Always free socket from ended/rematch rooms so create_private works
      ws._matchId = null;
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
    log('warn', 'store init failed, using memory', { err: e && e.message });
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
          log('warn', 'store restore failed', { roomId: id, err: err && err.message });
        }
      }
      if (n) log('info', 'store restored rooms', { count: n });
    } catch (e) {
      log('warn', 'store list/restore error', { err: e && e.message });
    }

    // Restore queue intents + presence soft state (players re-attach on reconnect)
    try {
      const qSnap = await store.loadQueue();
      if (Array.isArray(qSnap) && qSnap.length) {
        const now = Date.now();
        let qi = 0;
        for (const e of qSnap) {
          if (!e || !e.token) continue;
          if (e.queuedAt && now - e.queuedAt > QUEUE_TTL * 1000) continue;
          // Placeholder in pending intents (no live ws — matchmaking skips until reconnect)
          pendingQueueIntents.set(e.token, e);
          qi++;
        }
        if (qi) log('info', 'store restored queue intents', { count: qi });
      }
      const codes = await store.listPresenceCodes();
      let pi = 0;
      for (const code of codes) {
        try {
          const e = await store.loadPresence(code);
          if (!code || !e) continue;
          presence.set(code, {
            token: null,
            ws: null,
            name: e.name || 'Игрок',
            activity: e.activity || 'away',
            trophies: e.trophies | 0,
            platform: e.platform || 'web',
            os: e.os || 'unknown',
            lastSeen: e.lastSeen || Date.now(),
            ts: e.lastSeen || Date.now()
          });
          pi++;
        } catch (_) {}
      }
      if (pi) log('info', 'store restored presence', { count: pi });
    } catch (e) {
      log('warn', 'store meta restore error', { err: e && e.message });
    }
  }

  // Periodic meta flush (queues + presence)
  setInterval(() => {
    try { persistMetaNow(); } catch (_) {}
  }, 15000);

  server.listen(PORT, '0.0.0.0', () => {
    log('info', 'server listening', {
      port: PORT,
      ws: '/ws',
      store: store && store.kind,
      origins: WS_ORIGINS.length ? WS_ORIGINS.length : 'any'
    });
  });
}

boot().catch((e) => {
  log('error', 'boot failed', { err: e && (e.stack || e.message || String(e)) });
  process.exit(1);
});

function shutdown() {
  try {
    // Flush live rooms + queue/presence meta one last time
    if (store) {
      for (const room of rooms.values()) {
        try { persistRoom(room); } catch (_) {}
      }
      try { persistMetaNow(); } catch (_) {}
      setTimeout(() => {
        try { store.close(); } catch (_) {}
        process.exit(0);
      }, 250);
      return;
    }
  } catch (_) {}
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
