/**
 * Block Puzzle — server-authoritative multiplayer (WebSocket).
 * Rooms, queue, private lobbies, rematch, social relay.
 */
/**
 * Block Puzzle — pure Node HTTP + WebSocket (vendor/ws)
 * No express required.
 */
'use strict';
const { clock } = require('./lib/clock');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { WebSocketServer } = require('./vendor/ws');
const { createStore, ROOM_TTL_LIVE, ROOM_TTL_ENDED, TOKEN_TTL, QUEUE_TTL, PRESENCE_TTL } = require('./lib/store');
const { SKIN_PALETTES, paletteForSkin } = require('./shared/skins');
const Cosmetics = require('./shared/cosmetics');
const { log, PKG_VERSION } = require('./lib/logger');
const { allowWsConnection, allowWsMessage } = require('./lib/rate-limit');
const { WS_ORIGINS, applySecurityHeaders, isOriginAllowed, getClientIp, startupWarnings, validateProductionConfig } = require('./lib/security');
const { createAccounts } = require('./lib/accounts');
const { createMatchRoomClass } = require('./lib/match-room');
const { createHttpRequestListener } = require('./lib/http-api');
const { createStaticServer } = require('./lib/static-files');
const { attachWsHandlers } = require('./lib/ws-handlers');
const { createDeviceApi, DEVICE_GUEST_MARK, DEVICE_HAD_MARK } = require('./lib/device');
const { createIdentityApi } = require('./lib/identity');
const { createMatchmakingApi } = require('./lib/matchmaking');
const { createCoord, disabledCoord } = require('./lib/coord');

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
const WS_MAX_FRAGMENTS = Math.max(8, Number(process.env.BP_MAX_WS_FRAGMENTS) || 128);
const PORT = Number(process.env.PORT) || 9000;
const { PROFILE_TTL_SEC: PROFILE_TTL, GUEST_PROFILE_TTL_SEC: GUEST_PROFILE_TTL } = require('./lib/economy-constants');
/** Guest (unregistered) cosmetics profiles expire quickly so they do not clutter the store. */
const GUEST_PROFILE_MAX_AGE_MS = 3 * 24 * 3600 * 1000; // purge guests older than 3 days

/** In-memory cache friendCode → cosmetics profile (backed by store). */
const profileCache = new Map();

async function isRegisteredFriendCode(friendCode) {
  const code = String(friendCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  if (!code || !store || typeof store.loadAccountByCode !== 'function') return false;
  try {
    const acc = await store.loadAccountByCode(code);
    return !!acc;
  } catch (_) {
    return false;
  }
}

async function loadCosmeticsProfile(friendCode, opts) {
  opts = opts || {};
  const code = String(friendCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  if (!code) return Cosmetics.defaultProfile();
  // Tombstoned identity: never rehydrate or re-persist
  if (await isFriendCodeDeletedAsync(code)) return Cosmetics.defaultProfile();
  // Cache is a hint only — always re-read durable stores so reloads see purchases.
  // (Short-circuit cache was intentionally disabled: it returned pre-merge empties after TTL purge.)
  let raw = null;
  try {
    if (store) raw = await store.loadProfile(code);
  } catch (_) { raw = null; }
  // Starter 9999 only when NO stored profile exists yet
  let p = Cosmetics.normalizeProfile(raw || Cosmetics.defaultProfile());
  // Merge durable ownership from account + guest_progress (profiles TTL must not wipe purchases)
  try {
    if (store && typeof store.loadAccountByCode === 'function') {
      const acc = await store.loadAccountByCode(code);
      if (acc) {
        if (typeof acc.diamonds === 'number') p.diamonds = Math.max(0, acc.diamonds | 0);
        if (Array.isArray(acc.ownedSkins) && acc.ownedSkins.length) {
          const set = new Set((p.ownedSkins || []).map(String));
          acc.ownedSkins.forEach((x) => { if (x) set.add(String(x)); });
          p.ownedSkins = Array.from(set);
        }
        if (Array.isArray(acc.ownedBoards) && acc.ownedBoards.length) {
          const set = new Set((p.ownedBoards || []).map(String));
          acc.ownedBoards.forEach((x) => { if (x) set.add(String(x)); });
          p.ownedBoards = Array.from(set);
        }
        // Owned/diamonds from account; EQUIP only if no durable profile row
        // (otherwise account lag resets the other cosmetic when equipping one)
        if (!raw) {
          if (acc.skinId) p.equippedSkin = String(acc.skinId).slice(0, 32);
          if (acc.boardId) p.equippedBoard = String(acc.boardId).slice(0, 32);
        }
        p.migrated = true;
      }
    }
  } catch (_) {}
  try {
    if (store && typeof store.loadGuestProgress === 'function') {
      const gp = await store.loadGuestProgress(code);
      if (gp && typeof gp === 'object') {
        if (typeof gp.diamonds === 'number' && isFinite(gp.diamonds)) {
          const gd = Math.max(0, gp.diamonds | 0);
          if (raw) {
            // Both rows: take the lower balance (reflects spends)
            p.diamonds = Math.min(p.diamonds | 0, gd);
          } else {
            // No profile row: guest_progress is source of truth
            p.diamonds = gd;
          }
        }
        if (Array.isArray(gp.ownedSkins) && gp.ownedSkins.length) {
          const set = new Set((p.ownedSkins || []).map(String));
          gp.ownedSkins.forEach((x) => { if (x) set.add(String(x)); });
          p.ownedSkins = Array.from(set);
        }
        if (Array.isArray(gp.ownedBoards) && gp.ownedBoards.length) {
          const set = new Set((p.ownedBoards || []).map(String));
          gp.ownedBoards.forEach((x) => { if (x) set.add(String(x)); });
          p.ownedBoards = Array.from(set);
        }
        if (!raw) {
          if (gp.skinId) p.equippedSkin = String(gp.skinId).slice(0, 32);
          if (gp.boardId) p.equippedBoard = String(gp.boardId).slice(0, 32);
          p.migrated = true;
        }
      }
    }
  } catch (_) {}
  p = Cosmetics.normalizeProfile(p);
  profileCache.set(code, p);
  // Persist merged profile so TTL refresh keeps purchases.
  // skipPersist: used on buy/equip hot path — save happens once after tryBuy.
  if (!opts.skipPersist) {
    try {
      if (store) {
        p.migrated = true;
        const hasPaid = (p.ownedSkins && p.ownedSkins.length > 1) || (p.ownedBoards && p.ownedBoards.length > 1);
        const registered = await isRegisteredFriendCode(code);
        const ttl = registered || hasPaid ? null : GUEST_PROFILE_TTL;
        await store.saveProfile(code, p, ttl);
        profileCache.set(code, p);
      }
    } catch (_) {}
  }
  return p;
}

async function saveCosmeticsProfile(friendCode, profile) {
  const code = String(friendCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  if (!code) return;
  if (await isFriendCodeDeletedAsync(code)) return;
  const p = Cosmetics.normalizeProfile(profile);
  if (!p.updatedAt) p.updatedAt = clock.now();
  p.migrated = true; // purchases are durable
  profileCache.set(code, p);
  try {
    if (store) {
      const registered = await isRegisteredFriendCode(code);
      const hasPaid = (p.ownedSkins && p.ownedSkins.length > 1) || (p.ownedBoards && p.ownedBoards.length > 1);
      // Never expire profiles that hold purchases; registered always long-lived
      let ttl = registered ? PROFILE_TTL : (hasPaid ? null : GUEST_PROFILE_TTL);
      if (ttl === null) {
        // null exp = permanent in postgres-store
        await store.saveProfile(code, p, null);
      } else {
        await store.saveProfile(code, p, ttl);
      }
    }
  } catch (e) {
    try { log('warn', 'saveCosmeticsProfile failed', { code, err: e && e.message }); } catch (_) {}
  }
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

/** Build typed result — `type` MUST win over cosmeticsStatePayload.type. */
function cosmeticsResultPayload(type, extra, profile) {
  return Object.assign({}, cosmeticsStatePayload(profile), extra || {}, { type: type });
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

/* —— Device ↔ account binding (see lib/device.js) —— */

// Identity — lib/identity.js
const identityHooks = {
  store: null,
  presence: null,
  pendingSocial: null,
  profileCache: null,
  wss: null,
  send: null
};
const identityApi = createIdentityApi({
  hooks: identityHooks,
  log,
  DEVICE_GUEST_MARK,
  DEVICE_HAD_MARK
});
const {
  markFriendCodeDeleted,
  isFriendCodeDeleted,
  isFriendCodeDeletedAsync,
  probeFriendCodeAlive,
  purgeAllDataForFriendCode,
  startAccountPresenceSweeper,
  kickFriendCodeSessions
} = identityApi;
const { DELETED_FRIEND_CODES, PRESENCE_RACE_GRACE_MS } = require('./lib/identity');

function wireIdentityHooks() {
  identityHooks.store = store;
  identityHooks.presence = presence;
  identityHooks.pendingSocial = pendingSocial;
  identityHooks.profileCache = profileCache;
  identityHooks.send = typeof send === 'function' ? send : identityHooks.send;
}


// Device / guest progress — lib/device.js
const deviceHooks = {
  store: null,
  isFriendCodeDeleted: null,
  isFriendCodeDeletedAsync: null
};
const deviceApi = createDeviceApi({
  hooks: deviceHooks,
  Cosmetics
});
const {
  stripDeletedFriendCodeFromProgress,
  normalizeDeviceId,
  extractDeviceId,
  issueDeviceId,
  resolveDeviceIdForRequest,
  deviceIdSetCookieHeader,
  loadDeviceBindRecord,
  persistDeviceBind,
  deviceHasBoundAccount,
  deviceHasRealAccount,
  deviceForbidsNewGuest,
  deviceCanResumeGuest,
  bindDeviceToAccount,
  setDeviceGuestProgress,
  getDeviceGuestProgress,
  clearDeviceGuestMark,
  bindDeviceGuest,
  unbindDeviceFully,
  unbindAccountFromAllDevices,
  markDevicesAfterAccountDelete,
  friendCodeClaimableByDevice,
  resolveAuthoritativeDiamonds,
  resolveAuthoritativeTrophies,
  filterClientOwnedSkins,
  filterClientOwnedBoards,
  applyServerCosmeticsToGuest,
  sanitizeGuestProgress,
  mergeGuestProgressLayers,
  loadServerTrophies,
  loadAuthoritativeTrophies,
  normalizeClientIp
} = deviceApi;

function wireDeviceHooks() {
  deviceHooks.store = store;
  deviceHooks.isFriendCodeDeleted = isFriendCodeDeleted;
  deviceHooks.isFriendCodeDeletedAsync = isFriendCodeDeletedAsync;
  // lazy: `presence` is declared further down in this file
  deviceHooks.getPresence = () => presence;
}
wireDeviceHooks();



function persistRoom(room) {
  if (!store || !room) return;
  try {
    const ttl = room.status === 'ended' ? ROOM_TTL_ENDED : ROOM_TTL_LIVE;
    let left = ROOM_TTL_LIVE;
    if (room.status === 'live' && room.clockEndTs) {
      left = Math.max(30, Math.ceil((room.clockEndTs - clock.now()) / 1000) + 60);
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

const { sendFile } = createStaticServer({ applySecurityHeaders });

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
        queuedAt: p.queuedAt || clock.now()
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
      lastSeen: e.lastSeen || clock.now(),
      online: !!(e.ws && e.ws.readyState === 1)
    };
  }
  return out;
}

let _persistMetaTimer = null;
function schedulePersistMeta() {
  if (!store || store.kind === 'memory') return;
  if (_persistMetaTimer) return;
  _persistMetaTimer = clock.setTimeout(() => {
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

/** Multi-instance Redis coordination (disabled unless REDIS_URL is set). */
let coord = disabledCoord();


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

/** Wins / played / winrate from account match history (result field). */
function computeWinStats(history) {
  let wins = 0;
  let played = 0;
  try {
    if (Array.isArray(history)) {
      for (const h of history.slice(0, 200)) {
        if (!h || typeof h !== 'object') continue;
        const r = String(h.result || '').toLowerCase();
        if (!r || r === 'void' || r === 'cancelled' || r === 'cancel') continue;
        played++;
        if (r === 'win' || r === 'won' || r === 'victory') wins++;
      }
    }
  } catch (_) {}
  const winrate = played > 0 ? Math.round((wins / played) * 100) : null;
  return { wins, played, winrate };
}

// MatchRoom extracted to lib/match-room.js — hooks filled after send/startRoom exist
const matchHooks = {
  rooms: null, // assigned below once rooms Map exists
  store: null,
  persistRoom: null,
  forgetRoom: null,
  startRoom: null,
  send: null,
  deliverToToken: null // multi-instance remote delivery
};
const MatchRoom = createMatchRoomClass({
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
  hooks: matchHooks
});
matchHooks.rooms = rooms;
matchHooks.deliverToToken = deliverToToken;


// Matchmaking — lib/matchmaking.js
const mmHooks = {
  queues: null,
  rooms: null,
  privateLobbies: null,
  pendingQueueIntents: null,
  schedulePersistMeta: null,
  send: null,
  authorizeCosmetics: null,
  loadServerTrophies: null,
  normalizePlatform: null,
  coord: null
};
let matchmakingApi = null;
function wireMatchmaking() {
  mmHooks.queues = queues;
  mmHooks.rooms = rooms;
  mmHooks.privateLobbies = privateLobbies;
  mmHooks.pendingQueueIntents = pendingQueueIntents;
  mmHooks.schedulePersistMeta = schedulePersistMeta;
  mmHooks.send = send;
  mmHooks.authorizeCosmetics = authorizeCosmetics;
  mmHooks.loadServerTrophies = loadServerTrophies;
  mmHooks.normalizePlatform = normalizePlatform;
  mmHooks.coord = coord;
  if (!matchmakingApi) {
    matchmakingApi = createMatchmakingApi({
      hooks: mmHooks,
      log,
      MatchRoom,
      uid,
      serializePieces
    });
  }
}
// Lazy bind after send exists — call wireMatchmaking from boot and after send defined
function findMatch(player) { wireMatchmaking(); return matchmakingApi.findMatch(player); }
function enqueue(player) { wireMatchmaking(); return matchmakingApi.enqueue(player); }
function dequeueToken(token) { wireMatchmaking(); return matchmakingApi.dequeueToken(token); }
function startRoom(p1, p2, meta) { wireMatchmaking(); return matchmakingApi.startRoom(p1, p2, meta); }
function genPrivateCode() { wireMatchmaking(); return matchmakingApi.genPrivateCode(); }
function leavePrivateLobby(token) { wireMatchmaking(); return matchmakingApi.leavePrivateLobby(token); }
function lobbySnapshot(lobby, role) { wireMatchmaking(); return matchmakingApi.lobbySnapshot(lobby, role); }
function tryStartPrivate(lobby) { wireMatchmaking(); return matchmakingApi.tryStartPrivate(lobby); }
function startPrivateLobbySweeper() { wireMatchmaking(); return matchmakingApi.startPrivateLobbySweeper(); }
function tryMatchAcrossInstances(player) { wireMatchmaking(); return matchmakingApi.tryMatchAcrossInstances(player); }
function tryClaimMatch(player) { wireMatchmaking(); return matchmakingApi.tryClaimMatch(player); }
function syncLobbyToCoord(code, lobby) { wireMatchmaking(); return matchmakingApi.syncLobbyToCoord(code, lobby); }
function loadLobbyFromCoord(code) { wireMatchmaking(); return matchmakingApi.loadLobbyFromCoord(code); }

/** Outbound message to a token that may live on another instance. */
function deliverToToken(token, msg) {
  if (!token || !msg) return;
  // Local fast path: real WS only — skip Redis remote stubs (they call deliverToToken
  // themselves and would recurse forever / swallow the message).
  for (const room of rooms.values()) {
    const p = room.players && room.players[token];
    if (p && p.ws && p.ws.readyState === 1 && !p.ws._remoteStub) {
      try { p.ws.send(JSON.stringify(msg)); } catch (_) {}
      return;
    }
  }
  if (coord && coord.enabled) {
    Promise.resolve(coord.publishToToken(token, msg)).catch(() => {});
  }
}
function queueKey(d, t) { wireMatchmaking(); return matchmakingApi.queueKey(d, t); }
function nearbyQueueKeys(d, t, g) { wireMatchmaking(); return matchmakingApi.nearbyQueueKeys(d, t, g); }


// HTTP listener extracted to lib/http-api.js
const httpHooks = {
  store: null,
  accountsApi: null,
  presence: null,
  pendingSocial: null,
  wss: null,
  rooms: null,
  privateLobbies: null,
  totalQueued: null,
  purgeAllDataForFriendCode: null,
  markFriendCodeDeleted: null,
  isFriendCodeDeleted: null,
  isFriendCodeDeletedAsync: null,
  probeFriendCodeAlive: null,
  kickFriendCodeSessions: null,
  loadCosmeticsProfile: null,
  saveCosmeticsProfile: null,
  bindDeviceGuest: null,
  bindDeviceToAccount: null,
  getDeviceGuestProgress: null,
  setDeviceGuestProgress: null,
  deviceHasBoundAccount: null,
  deviceHasRealAccount: null,
  deviceForbidsNewGuest: null,
  deviceCanResumeGuest: null,
  extractDeviceId: null,
  deviceIdSetCookieHeader: null,
  stripDeletedFriendCodeFromProgress: null,
  mergeGuestProgressLayers: null,
  unbindAccountFromAllDevices: null,
  markDevicesAfterAccountDelete: null,
  friendCodeClaimableByDevice: null,
  persistDeviceBind: null,
  loadDeviceBindRecord: null,
  clearDeviceGuestMark: null,
  authorizeCosmetics: null,
  loadServerTrophies: null
};

function wireHttpHooks() {
  httpHooks.store = store;
  httpHooks.accountsApi = accountsApi;
  httpHooks.presence = presence;
  httpHooks.pendingSocial = pendingSocial;
  // wss assigned separately after WebSocketServer is created
  httpHooks.rooms = rooms;
  httpHooks.privateLobbies = privateLobbies;
  httpHooks.totalQueued = totalQueued;
  httpHooks.purgeAllDataForFriendCode = purgeAllDataForFriendCode;
  httpHooks.markFriendCodeDeleted = markFriendCodeDeleted;
  httpHooks.isFriendCodeDeleted = isFriendCodeDeleted;
  httpHooks.isFriendCodeDeletedAsync = isFriendCodeDeletedAsync;
  httpHooks.probeFriendCodeAlive = probeFriendCodeAlive;
  httpHooks.kickFriendCodeSessions = kickFriendCodeSessions;
  httpHooks.loadCosmeticsProfile = loadCosmeticsProfile;
  httpHooks.saveCosmeticsProfile = saveCosmeticsProfile;
  httpHooks.bindDeviceGuest = bindDeviceGuest;
  httpHooks.bindDeviceToAccount = bindDeviceToAccount;
  httpHooks.getDeviceGuestProgress = getDeviceGuestProgress;
  httpHooks.setDeviceGuestProgress = setDeviceGuestProgress;
  httpHooks.deviceHasBoundAccount = deviceHasBoundAccount;
  httpHooks.deviceHasRealAccount = deviceHasRealAccount;
  httpHooks.deviceForbidsNewGuest = deviceForbidsNewGuest;
  httpHooks.deviceCanResumeGuest = deviceCanResumeGuest;
  httpHooks.extractDeviceId = extractDeviceId;
  httpHooks.deviceIdSetCookieHeader = deviceIdSetCookieHeader;
  httpHooks.stripDeletedFriendCodeFromProgress = stripDeletedFriendCodeFromProgress;
  httpHooks.mergeGuestProgressLayers = mergeGuestProgressLayers;
  httpHooks.unbindAccountFromAllDevices = unbindAccountFromAllDevices;
  httpHooks.markDevicesAfterAccountDelete = markDevicesAfterAccountDelete;
  httpHooks.friendCodeClaimableByDevice = friendCodeClaimableByDevice;
  httpHooks.persistDeviceBind = persistDeviceBind;
  httpHooks.loadDeviceBindRecord = loadDeviceBindRecord;
  httpHooks.clearDeviceGuestMark = clearDeviceGuestMark;
  httpHooks.authorizeCosmetics = authorizeCosmetics;
  httpHooks.loadServerTrophies = loadServerTrophies;
}

const server = http.createServer(createHttpRequestListener({
  hooks: httpHooks,
  applySecurityHeaders,
  sendFile,
  PUBLIC,
  PKG_VERSION,
  log,
  Cosmetics,
  DEVICE_GUEST_MARK,
  DEVICE_HAD_MARK
}));


const wss = new WebSocketServer({
  noServer: true,
  maxPayload: MAX_WS_MSG,
  // Explicit cap on fragments per message (tiny-fragment memory-exhaustion hardening).
  maxFragments: WS_MAX_FRAGMENTS,
  perMessageDeflate: false
});
wss.on('error', (err) => {
  try { log('error', 'wss error', { message: err && err.message, code: err && err.code }); } catch (_) {}
});
httpHooks.wss = wss;
httpHooks.send = (ws, msg) => send(ws, msg);
wireHttpHooks();
identityHooks.wss = wss;
if (typeof send === 'function') identityHooks.send = send;
wireMatchmaking();



server.on('upgrade', (req, socket, head) => {
  try {
    const u = req.url || '';
    if (u === '/ws' || u.startsWith('/ws?')) {
      {
        const origin = String(req.headers.origin || '');
        if (!isOriginAllowed(origin, req.headers.host)) {
          socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
          socket.destroy();
          return;
        }
      }
      const ip = getClientIp(req);
      if (!allowWsConnection(ip)) {
        socket.write('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        ws._ip = ip; // used by per-IP limiters (join_private brute-force protection)
        // Remember which device owns this socket so admin can kick it by device id
        try { ws._deviceId = deviceApi.extractDeviceId(req, null) || ''; } catch (_) { ws._deviceId = ''; }
        // HttpOnly session cookie travels with the (origin-checked) upgrade request; it is only used
        // when presence_register says "use the cookie" (authToken marker), never implicitly.
        try { ws._cookieToken = require('./lib/auth-cookie').readCookieToken(req.headers && req.headers.cookie); } catch (_) { ws._cookieToken = ''; }
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

/**
 * Force-logout every live socket bound to this friend code (all devices/tabs).
 * Used when the account is deleted from DB.
 */

/** Drop private lobbies abandoned for too long (host disconnect without leave_private). */

// WS message handlers extracted to lib/ws-handlers.js
const wsHooks = {
  store: null,
  accountsApi: null,
  presence: null,
  pendingSocial: null,
  privateLobbies: null,
  rooms: null,
  queues: null,
  pendingQueueIntents: null,
  coord: null,
  send: null,
  enqueue: null,
  dequeueToken: null,
  findMatch: null,
  tryMatchAcrossInstances: null,
  tryClaimMatch: null,
  syncLobbyToCoord: null,
  loadLobbyFromCoord: null,
  startRoom: null,
  leavePrivateLobby: null,
  genPrivateCode: null,
  lobbySnapshot: null,
  tryStartPrivate: null,
  authorizeCosmetics: null,
  loadServerTrophies: null,
  loadCosmeticsProfile: null,
  saveCosmeticsProfile: null,
  normalizePlatform: null,
  isFriendCodeDeletedAsync: null,
  probeFriendCodeAlive: null,
  kickFriendCodeSessions: null,
  cosmeticsStatePayload: null,
  cosmeticsResultPayload: null,
  serializePieces: null,
  dealForSeat: null,
  applyServerCosmeticsToGuest: null,
  normalizeDeviceId: null,
  loadDeviceBindRecord: null,
  persistDeviceBind: null,
  computeWinStats: null,
  schedulePersistMeta: null
};

function wireWsHooks() {
  wsHooks.store = store;
  wsHooks.accountsApi = accountsApi;
  wsHooks.presence = presence;
  wsHooks.pendingSocial = pendingSocial;
  wsHooks.privateLobbies = privateLobbies;
  wsHooks.rooms = rooms;
  wsHooks.queues = queues;
  wsHooks.pendingQueueIntents = pendingQueueIntents;
  wsHooks.coord = coord;
  wsHooks.send = send;
  wsHooks.enqueue = enqueue;
  wsHooks.dequeueToken = dequeueToken;
  wsHooks.findMatch = findMatch;
  wsHooks.tryMatchAcrossInstances = tryMatchAcrossInstances;
  wsHooks.tryClaimMatch = tryClaimMatch;
  wsHooks.syncLobbyToCoord = syncLobbyToCoord;
  wsHooks.loadLobbyFromCoord = loadLobbyFromCoord;
  wsHooks.startRoom = startRoom;
  wsHooks.leavePrivateLobby = leavePrivateLobby;
  wsHooks.genPrivateCode = genPrivateCode;
  wsHooks.lobbySnapshot = lobbySnapshot;
  wsHooks.tryStartPrivate = tryStartPrivate;
  wsHooks.authorizeCosmetics = authorizeCosmetics;
  wsHooks.loadServerTrophies = loadServerTrophies;
  wsHooks.loadCosmeticsProfile = loadCosmeticsProfile;
  wsHooks.saveCosmeticsProfile = saveCosmeticsProfile;
  wsHooks.normalizePlatform = normalizePlatform;
  wsHooks.isFriendCodeDeletedAsync = isFriendCodeDeletedAsync;
  wsHooks.probeFriendCodeAlive = probeFriendCodeAlive;
  wsHooks.kickFriendCodeSessions = kickFriendCodeSessions;
  wsHooks.cosmeticsStatePayload = cosmeticsStatePayload;
  wsHooks.cosmeticsResultPayload = cosmeticsResultPayload;
  wsHooks.serializePieces = serializePieces;
  wsHooks.dealForSeat = dealForSeat;
  wsHooks.applyServerCosmeticsToGuest = applyServerCosmeticsToGuest;
  wsHooks.normalizeDeviceId = normalizeDeviceId;
  wsHooks.loadDeviceBindRecord = loadDeviceBindRecord;
  wsHooks.persistDeviceBind = persistDeviceBind;
  wsHooks.computeWinStats = computeWinStats;
  wsHooks.schedulePersistMeta = schedulePersistMeta;
}

wireWsHooks();
attachWsHandlers(wss, {
  hooks: wsHooks,
  uid,
  allowWsMessage,
  log,
  Cosmetics,
  MatchRoom
});


clock.setInterval(() => {
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
  // Fail fast on fatal production misconfiguration (before opening sockets / DB)
  try {
    validateProductionConfig(process.env);
  } catch (e) {
    console.error(e && e.message ? e.message : e);
    process.exit(1);
  }
  // Multi-instance Redis coordination (optional)
  try {
    if (process.env.REDIS_URL) {
      coord = await createCoord({ url: process.env.REDIS_URL, log: (lvl, msg, extra) => log(lvl, msg, extra) });
      await coord.init();
      matchHooks.deliverToToken = deliverToToken;
      mmHooks.coord = coord;
      coord.onDeliver((payload) => {
        try {
          if (!payload || payload.kind !== 'deliver' || !payload.token || !payload.message) return;
          const token = String(payload.token);
          const msg = payload.message;
          function stampAndSend(ws) {
            if (!ws || ws.readyState !== 1) return false;
            try {
              if (msg && msg.type === 'match_found') {
                if (msg.matchId) ws._matchId = String(msg.matchId);
                if (msg.token) ws._token = String(msg.token);
              } else if (msg && msg.matchId) {
                ws._matchId = String(msg.matchId);
              }
            } catch (_) {}
            try { ws.send(JSON.stringify(msg)); } catch (_) {}
            return true;
          }
          if (coord.localTokens && coord.localTokens.has(token)) {
            if (stampAndSend(coord.localTokens.get(token))) return;
          }
          for (const room of rooms.values()) {
            const p = room.players && room.players[token];
            if (p && stampAndSend(p.ws)) return;
          }
          for (const e of presence.values()) {
            if (e && e.token === token && stampAndSend(e.ws)) return;
          }
        } catch (err) {
          log('warn', 'coord deliver handler error', { err: err && err.message });
        }
      });
      coord.onRoomForward((payload) => {
        // Inbound match action from a player whose WS is on another instance
        try {
          if (!payload || !payload.matchId || !payload.token || !payload.data) return;
          const room = rooms.get(String(payload.matchId));
          if (!room) return;
          const token = String(payload.token);
          const data = payload.data;
          const type = data && data.type;
          // Seat may have null ws (remote player) — attach a stub so identity checks that
          // only need token still work; outbound replies go through deliverToToken.
          if (room.players && room.players[token] && !room.players[token].ws) {
            room.players[token].ws = {
              readyState: 1,
              send(json) {
                try {
                  const msg = typeof json === 'string' ? JSON.parse(json) : json;
                  deliverToToken(token, msg);
                } catch (_) {}
              },
              _friendCode: room.players[token].friendCode || null,
              _token: token,
              _matchId: room.id,
              _remoteStub: true
            };
          }
          if (type === 'rejoin') {
            // Remote client reconnected on another instance: attach delivery stub + push snapshot
            if (!room.getPlayer || !room.getPlayer(token)) return;
            if (room.status === 'ended') {
              deliverToToken(token, { type: 'rejoin_fail', reason: 'ended', matchId: room.id });
              return;
            }
            const stub = {
              readyState: 1,
              send(json) {
                try {
                  const msg = typeof json === 'string' ? JSON.parse(json) : json;
                  deliverToToken(token, msg);
                } catch (_) {}
              },
              _friendCode: (room.players[token] && room.players[token].friendCode) || null,
              _token: token,
              _matchId: room.id,
              _remoteStub: true
            };
            room.attach(token, stub);
            try {
              const st = room.state[room.getPlayer(token).seat];
              if (!st.pieces || !st.pieces.length || st.pieces.every(function (pc) { return pc && pc.used; })) {
                if (typeof room.dealForSeat === 'function') st.pieces = room.dealForSeat(st);
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
              try { snap.vsTimeLeft = room.timeLeft(); } catch (_) { snap.vsTimeLeft = room.duration; }
              deliverToToken(token, snap);
            }
          } else if (type === 'match_ready' && typeof room.markReady === 'function') {
            room.markReady(token);
          } else if (type === 'place' && typeof room.applyPlace === 'function') {
            room.applyPlace(token, data);
          } else if (type === 'deal' && typeof room.applyDeal === 'function') {
            room.applyDeal(token, data);
          } else if (type === 'sync' && typeof room.applySync === 'function') {
            room.applySync(token, data);
          } else if (type === 'forfeit' && typeof room.forfeit === 'function') {
            room.forfeit(token);
          } else if (type === 'rematch_offer' && typeof room.offerRematch === 'function') {
            room.offerRematch(token);
          } else if (type === 'rematch_accept' && typeof room.acceptRematch === 'function') {
            room.acceptRematch(token);
          } else if (type === 'rematch_decline' && typeof room.declineRematch === 'function') {
            room.declineRematch(token);
          } else if (type === 'rematch_cancel' && typeof room.cancelRematch === 'function') {
            room.cancelRematch(token);
          }
        } catch (err) {
          log('warn', 'coord room-forward error', { err: err && err.message });
        }
      });
      log('info', 'multi-instance coord enabled', { instanceId: coord.instanceId });
    }
  } catch (e) {
    log('error', 'redis coord init failed — continuing single-instance', { err: e && e.message });
    coord = disabledCoord();
  }
  // Wire MatchRoom runtime hooks (store may be null until createStore resolves)
  matchHooks.persistRoom = persistRoom;
  matchHooks.forgetRoom = forgetRoom;
  matchHooks.startRoom = startRoom;
  matchHooks.send = send;
  try {
    store = await createStore();
    matchHooks.store = store;
    accountsApi = createAccounts(store);
    wireDeviceHooks();
    wireIdentityHooks();
    wireHttpHooks();
    wireWsHooks();
    wireMatchmaking();
  } catch (e) {
    log('error', 'store init failed — PostgreSQL is required', { err: e && e.message });
    console.error('[boot] Set DATABASE_URL or run: docker compose up -d --build');
    process.exit(1);
  }
  try { startAccountPresenceSweeper(); } catch (_) {}
  try { startPrivateLobbySweeper(); } catch (_) {}
  // Warm deleted-code tombstones from durable store (anti-resurrection across restarts)
  try {
    if (store && typeof store.listDeletedCodes === 'function') {
      const list = await store.listDeletedCodes();
      let n = 0;
      for (const row of (list || [])) {
        if (row && row.code && row.exp && row.exp > clock.now()) {
          DELETED_FRIEND_CODES.set(String(row.code).toUpperCase(), row.exp);
          n++;
        }
      }
      if (n) log('info', 'loaded deleted-code tombstones', { count: n });
    }
  } catch (e) {
    log('warn', 'deleted-code tombstone load failed', { err: e && e.message });
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
          if (data.status === 'live' && data.clockEndTs && clock.now() - data.clockEndTs > 120000) {
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
        const now = clock.now();
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
            lastSeen: e.lastSeen || clock.now(),
            ts: e.lastSeen || clock.now()
          });
          pi++;
        } catch (_) {}
      }
      if (pi) log('info', 'store restored presence', { count: pi });
    } catch (e) {
      log('warn', 'store meta restore error', { err: e && e.message });
    }

    // Purge stale guest cosmetics profiles (no registered account) so guests don't fill the DB
    try {
      if (typeof store.purgeGuestProfiles === 'function') {
        const purged = await store.purgeGuestProfiles(GUEST_PROFILE_MAX_AGE_MS);
        if (purged) log('info', 'purged guest profiles', { count: purged });
      }
    } catch (e) {
      log('warn', 'guest profile purge error', { err: e && e.message });
    }
  }

  // Periodic meta flush (queues + presence) + occasional guest profile sweep
  clock.setInterval(() => {
    try { persistMetaNow(); } catch (_) {}
  }, 15000);
  clock.setInterval(() => {
    try {
      if (store && typeof store.purgeGuestProfiles === 'function') {
        store.purgeGuestProfiles(GUEST_PROFILE_MAX_AGE_MS).then((n) => {
          if (n) log('info', 'purged guest profiles', { count: n });
        }).catch(() => {});
      }
    } catch (_) {}
  }, 6 * 3600 * 1000); // every 6 hours

  startupWarnings({ warn: (m) => log('warn', m) });
  server.listen(PORT, '0.0.0.0', () => {
    log('info', 'server listening', {
      port: PORT,
      ws: '/ws',
      store: store && store.kind,
      origins: WS_ORIGINS.length ? WS_ORIGINS.length : 'same-origin'
    });
  });
}

boot().catch((e) => {
  log('error', 'boot failed', { err: e && (e.stack || e.message || String(e)) });
  process.exit(1);
});

let _shuttingDown = false;
function shutdown(signal) {
  if (_shuttingDown) return;
  _shuttingDown = true;
  try { log('info', 'shutdown', { signal: signal || 'signal' }); } catch (_) {}
  try {
    // Stop accepting new HTTP / WS connections
    try { if (typeof server !== 'undefined' && server && server.close) server.close(); } catch (_) {}
    try {
      if (typeof wss !== 'undefined' && wss) {
        wss.clients.forEach((ws) => {
          try { ws.close(1001, 'server_shutdown'); } catch (_) {}
        });
        try { wss.close(); } catch (_) {}
      }
    } catch (_) {}
    // Flush live rooms + queue/presence meta one last time
    if (store) {
      for (const room of rooms.values()) {
        try { persistRoom(room); } catch (_) {}
      }
      try { persistMetaNow(); } catch (_) {}
      const done = () => {
        try { if (coord && coord.close) coord.close(); } catch (_) {}
        try { store.close(); } catch (_) {}
        process.exit(0);
      };
      // Give in-flight DB work a short window, then force exit
      clock.setTimeout(done, 500);
      clock.setTimeout(() => process.exit(0), 5000);
      return;
    }
  } catch (_) {}
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
