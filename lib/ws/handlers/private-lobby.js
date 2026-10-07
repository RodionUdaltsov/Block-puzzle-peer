/**
 * Block Puzzle — lib/ws/handlers/private-lobby.js
 * Private lobby: create / join / leave / ready / duration.
 * Extracted from the former monolithic lib/ws-handlers.js.
 * Host/guest friend codes come only from ws._friendCode (server-verified identity).
 * Contract: returns true when the message was handled (stop dispatching), false to fall through.
 */
'use strict';

const { clock } = require('../../clock');
const { getWsIdentity } = require('../identity');
const { createWindowCounter } = require('../../rate-limit');

// Resource-exhaustion limits for private lobbies (audit v9.7).
const MAX_PRIVATE_LOBBIES = Math.max(1, Number(process.env.BP_MAX_PRIVATE_LOBBIES) || 2000);
// Memory budget for the heavy base64 avatar blobs held by all open lobbies (host + guest, up to
// 48 KiB each). Over budget the lobby still works — the avatar just falls back to the stock one.
const AVATAR_MAX_LEN = 49152;
const MAX_LOBBY_AVATAR_BYTES = Math.max(0, process.env.BP_PRIVATE_AVATAR_BUDGET_BYTES === undefined
  ? 64 * 1024 * 1024 : Number(process.env.BP_PRIVATE_AVATAR_BUDGET_BYTES) || 0);
const CREATE_COOLDOWN_MS = Math.max(0, process.env.BP_PRIVATE_CREATE_COOLDOWN_MS === undefined
  ? 3000 : Number(process.env.BP_PRIVATE_CREATE_COOLDOWN_MS) || 0);
// Failed join_private attempts (not_found) per IP (or per socket when no IP) per minute.
const JOIN_FAIL_LIMIT = Math.max(1, Number(process.env.BP_PRIVATE_JOIN_FAILS) || 10);
const joinFails = createWindowCounter(JOIN_FAIL_LIMIT, 60 * 1000);
const joinKey = (ws) => String(ws._ip || ws._token || 'unknown');

function lobbyAvatarBytes(privateLobbies) {
  let total = 0;
  for (const l of privateLobbies.values()) {
    if (l.host && l.host.avatarCustom) total += l.host.avatarCustom.length;
    if (l.guest && l.guest.avatarCustom) total += l.guest.avatarCustom.length;
  }
  return total;
}

function pickAvatarCustom(data, privateLobbies) {
  const raw = (data && typeof data.avatarCustom === 'string') ? data.avatarCustom.slice(0, AVATAR_MAX_LEN) : '';
  if (!raw) return '';
  return lobbyAvatarBytes(privateLobbies) + raw.length <= MAX_LOBBY_AVATAR_BYTES ? raw : '';
}

const DEFAULT_COSMETICS = Object.freeze({ skinId: 'default', boardId: 'field_default' });

function handlePrivateLobby(type, ws, data, shared) {
  const {
    authorizeCosmetics,
    dequeueToken,
    genPrivateCode,
    leavePrivateLobby,
    loadServerTrophies,
    lobbySnapshot,
    normalizePlatform,
    privateLobbies,
    rooms,
    send,
    tryStartPrivate,
    syncLobbyToCoord,
    loadLobbyFromCoord,
    coord
  } = shared;

  if (type === 'create_private') {
    // 1) Per-socket cooldown: a socket cannot churn out lobbies at message-rate speed.
    const nowMs = clock.now();
    if (CREATE_COOLDOWN_MS > 0 && ws._lastCreatePrivate && nowMs - ws._lastCreatePrivate < CREATE_COOLDOWN_MS) {
      send(ws, { type: 'private_error', reason: 'rate_limited' });
      return true;
    }
    ws._lastCreatePrivate = nowMs;
    dequeueToken(ws._token);
    ws._queueSeq = ((ws._queueSeq | 0) + 1) | 0; // cancel any in-flight join_queue
    // 2) One active lobby per socket: the previous one (if any) is removed first.
    leavePrivateLobby(ws._token);
    // 3) Global hard cap (checked after the socket's own lobby was freed, so a replace never fails).
    if (privateLobbies.size >= MAX_PRIVATE_LOBBIES) {
      send(ws, { type: 'private_error', reason: 'server_busy' });
      return true;
    }
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
    // Identity is the server-verified one only. Without it the lobby is anonymous (default
    // cosmetics, 0 trophies) — a friendCode in the message is never trusted.
    const hostFc = getWsIdentity(ws);
    // Client-claimed cosmetics are only a *request*; until the server authorizes them the lobby
    // carries stock cosmetics, so an unauthorized skin is never visible to the opponent.
    const reqSkin = data.skinId ? String(data.skinId).slice(0, 32) : 'default';
    const reqBoard = data.boardId ? String(data.boardId).slice(0, 32) : 'field_default';
    const lobby = {
      code, duration, hostReady: false, guestReady: false, createdAt: clock.now(),
      host: {
        token: ws._token, ws,
        name: String(data.name || 'Игрок').slice(0, 24),
        trophies: 0,
        skinId: 'default',
        boardId: 'field_default',
        avatarId: data.avatarId ? String(data.avatarId).slice(0, 32) : 'init',
        avatarCustom: pickAvatarCustom(data, privateLobbies),
        friendCode: hostFc,
        platform: normalizePlatform(data.platform || ws._platform || 'web'),
        os: String(data.os || ws._os || 'unknown').slice(0, 24)
      },
      guest: null
    };
    // Register synchronously: the lobby exists (and is counted / replaced by leavePrivateLobby)
    // before any await, so a burst of create_private messages cannot pile up pending lobbies.
    privateLobbies.set(code, lobby);
    if (typeof syncLobbyToCoord === 'function') syncLobbyToCoord(code, lobby);
    ws._privateCode = code;
    const announce = () => {
      if (privateLobbies.get(code) !== lobby) return; // left / replaced meanwhile
      send(ws, lobbySnapshot(lobby, 'host'));
    };
    // Clamp host cosmetics + trophies from server only
    Promise.resolve().then(() => Promise.all([
      authorizeCosmetics(hostFc, reqSkin, reqBoard),
      loadServerTrophies(hostFc)
    ])).then(
      ([cos, trophies]) => ({ cos, trophies: trophies | 0 }),
      () => ({ cos: DEFAULT_COSMETICS, trophies: 0 })
    ).then(({ cos, trophies }) => {
      lobby.host.skinId = cos.skinId;
      lobby.host.boardId = cos.boardId;
      lobby.host.trophies = trophies;
      announce();
    }).catch(() => {});
    return true;
  }
  if (type === 'join_private') {
    const code = String(data.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
    // Joining your OWN lobby must be a no-op error: leavePrivateLobby() below would otherwise
    // destroy the host's lobby (and make the 'self' branch unreachable).
    const own = privateLobbies.get(code);
    if (own && own.host && own.host.token === ws._token) {
      send(ws, { type: 'private_error', reason: 'self', code });
      return true;
    }
    dequeueToken(ws._token);
    ws._queueSeq = ((ws._queueSeq | 0) + 1) | 0; // cancel any in-flight join_queue
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
    // Brute-force protection: code is a bearer invite token. After too many misses from one
    // IP the answer is a flat 'rate_limited' (no lookup is performed at all).
    if (joinFails.blocked(joinKey(ws))) {
      send(ws, { type: 'private_error', reason: 'rate_limited', retryAfter: joinFails.retryAfterSec(joinKey(ws)) });
      return true;
    }
    let lobby = privateLobbies.get(code);
    if (!lobby || !lobby.host) {
      // Multi-instance: lobby may exist on another Node (Redis mirror).
      if (typeof loadLobbyFromCoord === 'function' && coord && coord.enabled) {
        loadLobbyFromCoord(code).then((remote) => {
          if (remote && remote.host) {
            if (remote.guest) {
              send(ws, { type: 'private_error', reason: 'full', code });
            } else {
              // Host is on another instance — ask the client to retry (sticky LB should
              // converge). Ranked multi-instance is fully supported; private lobbies
              // prefer same-instance affinity.
              send(ws, { type: 'private_error', reason: 'remote_lobby', code });
            }
          } else {
            joinFails.hit(joinKey(ws));
            send(ws, { type: 'private_error', reason: 'not_found', code });
          }
        }).catch(() => {
          joinFails.hit(joinKey(ws));
          send(ws, { type: 'private_error', reason: 'not_found', code });
        });
        return true;
      }
      joinFails.hit(joinKey(ws));
      send(ws, { type: 'private_error', reason: 'not_found', code });
      return true;
    }
    if (lobby.guest) {
      send(ws, { type: 'private_error', reason: 'full', code });
      return true;
    }
    if (lobby.host.token === ws._token) {
      send(ws, { type: 'private_error', reason: 'self', code });
      return true;
    }
    // A soft-disconnected host (lobby.host.ws === null) is re-attached when its owner reconnects
    // and re-proves its identity (see reattachPrivateLobby in presence_register) — a joining
    // guest can never touch the host socket.
    const guestFc = getWsIdentity(ws);
    const reqSkin = data.skinId ? String(data.skinId).slice(0, 32) : 'default';
    const reqBoard = data.boardId ? String(data.boardId).slice(0, 32) : 'field_default';
    const guestDraft = {
      token: ws._token, ws,
      pending: true, // seat is reserved but cosmetics/trophies are not authorized yet
      name: String(data.name || 'Игрок').slice(0, 24),
      trophies: 0,
      skinId: 'default',
      boardId: 'field_default',
      avatarId: data.avatarId ? String(data.avatarId).slice(0, 32) : 'init',
      avatarCustom: pickAvatarCustom(data, privateLobbies),
      friendCode: guestFc,
      platform: normalizePlatform(data.platform || ws._platform || 'web'),
      os: String(data.os || ws._os || 'unknown').slice(0, 24)
    };
    // Reserve the seat SYNCHRONOUSLY, in the same tick as the `lobby.guest` check above.
    // Doing it after the awaits let two near-simultaneous joiners both pass the check and
    // overwrite each other (TOCTOU) — both clients then believed they had joined.
    lobby.guest = guestDraft;
    lobby.hostReady = false;
    lobby.guestReady = false;
    ws._privateCode = code;
    if (typeof syncLobbyToCoord === 'function') syncLobbyToCoord(code, lobby);
    const finalize = ({ cos, trophies }) => {
      // The seat may have been lost while we awaited (guest left / socket closed / lobby
      // closed or replaced / same socket re-joined). Only the current owner may complete it.
      if (privateLobbies.get(code) !== lobby || lobby.guest !== guestDraft) return;
      guestDraft.skinId = cos.skinId;
      guestDraft.boardId = cos.boardId;
      guestDraft.trophies = trophies;
      guestDraft.pending = false;
      send(ws, lobbySnapshot(lobby, 'guest'));
      if (lobby.host.ws) send(lobby.host.ws, lobbySnapshot(lobby, 'host'));
      if (typeof syncLobbyToCoord === 'function') syncLobbyToCoord(code, lobby);
    };
    Promise.resolve().then(() => Promise.all([
      authorizeCosmetics(guestFc, reqSkin, reqBoard),
      loadServerTrophies(guestFc)
    ])).then(
      ([cos, trophies]) => ({ cos, trophies: trophies | 0 }),
      () => ({ cos: DEFAULT_COSMETICS, trophies: 0 })
    ).then(finalize).catch(() => {});
    return true;
  }
  if (type === 'leave_private') {
    leavePrivateLobby(ws._token);
    ws._privateCode = null;
    send(ws, { type: 'private_left' });
    return true;
  }
  if (type === 'private_ready') {
    const code = String(data.code || ws._privateCode || '').toUpperCase();
    const lobby = privateLobbies.get(code);
    if (!lobby) {
      send(ws, { type: 'private_error', reason: 'not_in_lobby' });
      return true;
    }
    if (lobby.host && lobby.host.token === ws._token) {
      lobby.hostReady = !!data.ready;
      lobby.host.ws = ws;
    } else if (lobby.guest && lobby.guest.token === ws._token) {
      if (lobby.guest.pending) return true; // seat reserved, authorization still in flight
      lobby.guestReady = !!data.ready;
      lobby.guest.ws = ws;
    } else {
      send(ws, { type: 'private_error', reason: 'not_in_lobby' });
      return true;
    }
    if (lobby.host && lobby.host.ws) send(lobby.host.ws, lobbySnapshot(lobby, 'host'));
    if (lobby.guest && lobby.guest.ws) send(lobby.guest.ws, lobbySnapshot(lobby, 'guest'));
    if (typeof syncLobbyToCoord === 'function') syncLobbyToCoord(code, lobby);
    if (lobby.hostReady && lobby.guestReady && lobby.host && lobby.guest) {
      tryStartPrivate(lobby);
    }
    return true;
  }
  if (type === 'private_duration') {
    const code = String(data.code || ws._privateCode || '').toUpperCase();
    const lobby = privateLobbies.get(code);
    if (!lobby || !lobby.host || lobby.host.token !== ws._token) return true;
    const d = data.duration | 0;
    lobby.duration = (d === 60 || d === 180) ? d : 120;
    lobby.hostReady = false;
    lobby.guestReady = false;
    if (lobby.host.ws) send(lobby.host.ws, lobbySnapshot(lobby, 'host'));
    if (lobby.guest && lobby.guest.ws) send(lobby.guest.ws, lobbySnapshot(lobby, 'guest'));
    return true;
  }

  return false;
}

module.exports = { handlePrivateLobby, MAX_PRIVATE_LOBBIES, MAX_LOBBY_AVATAR_BYTES, _joinFails: joinFails };
