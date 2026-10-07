/**
 * Block Puzzle — lib/ws/context.js
 * Shared (per-server) context for WebSocket handlers: deps + late-bound hook aliases.
 * Extracted from the former monolithic lib/ws-handlers.js — behaviour unchanged.
 * Hooks are resolved at call time (server.js wires them after construction).
 */
'use strict';
const { wsMatchesPlayerSync } = require('./identity');

function createWsContext(deps) {
  const hooks = deps.hooks;
  const uid = deps.uid;
  const allowWsMessage = deps.allowWsMessage;
  const log = deps.log;
  const Cosmetics = deps.Cosmetics;
  const MatchRoom = deps.MatchRoom;

  const send = (...a) => hooks.send(...a);
  const enqueue = (...a) => hooks.enqueue(...a);
  const dequeueToken = (...a) => hooks.dequeueToken(...a);
  const findMatch = (...a) => hooks.findMatch(...a);
  const tryMatchAcrossInstances = (...a) => hooks.tryMatchAcrossInstances ? hooks.tryMatchAcrossInstances(...a) : Promise.resolve(false);
  const tryClaimMatch = (...a) => hooks.tryClaimMatch ? hooks.tryClaimMatch(...a) : Promise.resolve(false);
  const syncLobbyToCoord = (...a) => hooks.syncLobbyToCoord ? hooks.syncLobbyToCoord(...a) : undefined;
  const loadLobbyFromCoord = (...a) => hooks.loadLobbyFromCoord ? hooks.loadLobbyFromCoord(...a) : Promise.resolve(null);
  const startRoom = (...a) => hooks.startRoom(...a);
  const leavePrivateLobby = (...a) => hooks.leavePrivateLobby(...a);
  const genPrivateCode = (...a) => hooks.genPrivateCode(...a);
  const lobbySnapshot = (...a) => hooks.lobbySnapshot(...a);
  const tryStartPrivate = (...a) => hooks.tryStartPrivate(...a);
  const authorizeCosmetics = (...a) => hooks.authorizeCosmetics(...a);
  const loadServerTrophies = (...a) => hooks.loadServerTrophies(...a);
  const loadCosmeticsProfile = (...a) => hooks.loadCosmeticsProfile(...a);
  // For cosmetics_* requests: a deleted identity must get an error, never a fresh starter profile
  const loadLiveCosmeticsProfile = async (code, opts) => {
    if (await isFriendCodeDeletedAsync(code)) {
      const e = new Error('account_deleted'); e.dead = true; throw e;
    }
    return hooks.loadCosmeticsProfile(code, opts);
  };
  const saveCosmeticsProfile = (...a) => hooks.saveCosmeticsProfile(...a);
  const normalizePlatform = (...a) => hooks.normalizePlatform(...a);
  const isFriendCodeDeletedAsync = (...a) => hooks.isFriendCodeDeletedAsync(...a);
  const probeFriendCodeAlive = (...a) => hooks.probeFriendCodeAlive(...a);
  const kickFriendCodeSessions = (...a) => hooks.kickFriendCodeSessions(...a);
  const cosmeticsStatePayload = (...a) => hooks.cosmeticsStatePayload(...a);
  const cosmeticsResultPayload = (...a) => hooks.cosmeticsResultPayload(...a);
  const serializePieces = (...a) => hooks.serializePieces(...a);
  const dealForSeat = (...a) => hooks.dealForSeat(...a);
  const applyServerCosmeticsToGuest = (...a) => hooks.applyServerCosmeticsToGuest(...a);
  const normalizeDeviceId = (...a) => hooks.normalizeDeviceId(...a);
  const loadDeviceBindRecord = (...a) => hooks.loadDeviceBindRecord(...a);
  const persistDeviceBind = (...a) => hooks.persistDeviceBind(...a);
  const computeWinStats = (...a) => hooks.computeWinStats(...a);
  const schedulePersistMeta = (...a) => {
    if (typeof hooks.schedulePersistMeta === 'function') return hooks.schedulePersistMeta(...a);
  };

  function resolveMatchCtx(ws, data) {
    const rooms = hooks.rooms;
    const matchId = (data && data.matchId) ? String(data.matchId) : (ws._matchId || null);
    const token = (data && data.token) ? String(data.token) : (ws._token || null);
    if (!matchId || !token) return null;
    const room = rooms.get(matchId);
    if (!room || (room.status !== 'live' && room.status !== 'loading')) return null;
    if (!room.getPlayer(token)) return null;
    if (ws._matchId !== matchId || ws._token !== token || room.players[token].ws !== ws) {
      // Taking over a seat needs more than the token: the socket's verified identity must be the
      // one the seat was created for (rejoin does the full async proof before attaching).
      if (!wsMatchesPlayerSync(ws, room.players[token])) return null;
      ws._matchId = matchId;
      ws._token = token;
      room.attach(token, ws);
    }
    return { room, token, matchId };
  }

  const coord = () => hooks.coord;
  return {
    hooks,
    get coord() { return hooks.coord; },
    uid,
    allowWsMessage,
    log,
    Cosmetics,
    MatchRoom,
    send,
    enqueue,
    dequeueToken,
    findMatch,
    tryMatchAcrossInstances,
    tryClaimMatch,
    syncLobbyToCoord,
    loadLobbyFromCoord,
    startRoom,
    leavePrivateLobby,
    genPrivateCode,
    lobbySnapshot,
    tryStartPrivate,
    authorizeCosmetics,
    loadServerTrophies,
    loadCosmeticsProfile,
    loadLiveCosmeticsProfile,
    saveCosmeticsProfile,
    normalizePlatform,
    isFriendCodeDeletedAsync,
    probeFriendCodeAlive,
    kickFriendCodeSessions,
    cosmeticsStatePayload,
    cosmeticsResultPayload,
    serializePieces,
    dealForSeat,
    applyServerCosmeticsToGuest,
    normalizeDeviceId,
    loadDeviceBindRecord,
    persistDeviceBind,
    computeWinStats,
    schedulePersistMeta,
    resolveMatchCtx
  };
}

module.exports = { createWsContext };
