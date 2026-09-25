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
const Cosmetics = require('./shared/cosmetics');
const { log, PKG_VERSION } = require('./lib/logger');
const { allowWsConnection, allowWsMessage } = require('./lib/rate-limit');
const { WS_ORIGINS, applySecurityHeaders, isOriginAllowed } = require('./lib/security');
const { createAccounts } = require('./lib/accounts');
const createMatchRoom = require('./lib/match-room');
const createMatchmaking = require('./lib/matchmaking');
const attachWsHandlers = require('./lib/ws-handlers');
const createHttpHandler = require('./lib/http-api');

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
const PROFILE_TTL = 365 * 24 * 3600;

/** In-memory cache friendCode → cosmetics profile (backed by store). */
const profileCache = new Map();

async function loadCosmeticsProfile(friendCode) {
  const code = String(friendCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  if (!code) return Cosmetics.defaultProfile();
  if (profileCache.has(code)) return Cosmetics.normalizeProfile(profileCache.get(code));
  let raw = null;
  try {
    if (store) raw = await store.loadProfile(code);
  } catch (_) { raw = null; }
  const p = Cosmetics.normalizeProfile(raw || Cosmetics.defaultProfile());
  profileCache.set(code, p);
  return p;
}

async function saveCosmeticsProfile(friendCode, profile) {
  const code = String(friendCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  if (!code) return;
  const p = Cosmetics.normalizeProfile(profile);
  profileCache.set(code, p);
  try {
    if (store) await store.saveProfile(code, p, PROFILE_TTL);
  } catch (_) {}
}

function cosmeticsStatePayload(profile) {
  const p = Cosmetics.normalizeProfile(profile);
  return {
    type: 'cosmetics_state',
    diamonds: p.diamonds,
    ownedSkins: p.ownedSkins.slice(),
    ownedBoards: p.ownedBoards.slice(),
    equippedSkin: p.equippedSkin,
    equippedBoard: p.equippedBoard,
    migrated: !!p.migrated
  };
}

async function authorizeCosmetics(friendCode, skinId, boardId) {
  if (!friendCode) {
    return Cosmetics.clampCosmetics(Cosmetics.defaultProfile(), skinId, boardId);
  }
  const p = await loadCosmeticsProfile(friendCode);
  return Cosmetics.clampCosmetics(p, skinId, boardId);
}
const PUBLIC = path.join(__dirname, 'public');


/** @type {import('./lib/store').MemoryStore|null} */
let store = null;
let accountsApi = null;

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
    const base = path.basename(filePath).toLowerCase();
    const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
    // Service worker must not be long-cached or browsers keep a stale install path
    if (base === 'sw.js') {
      headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
      headers['Pragma'] = 'no-cache';
      headers['Service-Worker-Allowed'] = '/';
    } else if (ext === '.html' || ext === '.js' || ext === '.css' || ext === '.webmanifest') {
      // Prevent stale mobile WebView cache of gameplay/CSS/manifest
      headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
      headers['Pragma'] = 'no-cache';
    } else if (ext === '.svg' || ext === '.woff2' ||
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




const MatchRoom = createMatchRoom({
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
});


const mm = createMatchmaking({
  queues,
  privateLobbies,
  pendingQueueIntents,
  MatchRoom,
  serializePieces,
  schedulePersistMeta,
  rooms
});
const {
  normalizePlatform,
  queueKey,
  nearbyQueueKeys,
  findMatch,
  enqueue,
  dequeueToken,
  startRoom,
  genPrivateCode,
  leavePrivateLobby,
  lobbySnapshot,
  tryStartPrivate
} = mm;

const server = http.createServer(createHttpHandler({
  applySecurityHeaders,
  sendFile,
  PUBLIC,
  log,
  rooms,
  privateLobbies,
  presence,
  totalQueued,
  PKG_VERSION,
  getAccountsApi: () => accountsApi,
  getStore: () => store,
  getWss: () => wss
}));

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


const { send, resolveMatchCtx } = attachWsHandlers(wss, {
  uid,
  log,
  rooms,
  queues,
  privateLobbies,
  presence,
  pendingSocial,
  pendingQueueIntents,
  findMatch,
  enqueue,
  dequeueToken,
  startRoom,
  genPrivateCode,
  leavePrivateLobby,
  lobbySnapshot,
  tryStartPrivate,
  normalizePlatform,
  authorizeCosmetics,
  loadCosmeticsProfile,
  saveCosmeticsProfile,
  cosmeticsStatePayload,
  schedulePersistMeta,
  serializePieces,
  allowWsMessage,
  MAX_WS_MSG,
  Cosmetics,
  PKG_VERSION
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
    accountsApi = createAccounts(store);
  } catch (e) {
    log('warn', 'store init failed, using memory', { err: e && e.message });
    store = await createStore(); // createStore already falls back
    try { accountsApi = createAccounts(store); } catch (_) {}
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
