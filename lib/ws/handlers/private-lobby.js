/**
 * Block Puzzle — lib/ws/handlers/private-lobby.js
 * Private lobby: create / join / leave / ready / duration.
 * Extracted from the former monolithic lib/ws-handlers.js — behaviour unchanged.
 * Contract: returns true when the message was handled (stop dispatching), false to fall through.
 */
'use strict';

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
    tryStartPrivate
  } = shared;

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
    const hostFc = ws._friendCode || (data.friendCode ? String(data.friendCode).slice(0, 16) : null);
    const lobby = {
      code, duration, hostReady: false, guestReady: false, createdAt: Date.now(),
      host: {
        token: ws._token, ws,
        name: String(data.name || 'Игрок').slice(0, 24),
        trophies: 0,
        skinId: data.skinId ? String(data.skinId).slice(0, 32) : 'default',
        boardId: data.boardId ? String(data.boardId).slice(0, 32) : 'field_default',
        avatarId: data.avatarId ? String(data.avatarId).slice(0, 32) : 'init',
        avatarCustom: (data.avatarCustom && typeof data.avatarCustom === 'string') ? String(data.avatarCustom).slice(0, 49152) : '',
        friendCode: hostFc,
        platform: normalizePlatform(data.platform || ws._platform || 'web'),
        os: String(data.os || ws._os || 'unknown').slice(0, 24)
      },
      guest: null
    };
    // Clamp host cosmetics + trophies from server only
    Promise.all([
      authorizeCosmetics(hostFc, lobby.host.skinId, lobby.host.boardId),
      loadServerTrophies(hostFc)
    ]).then(([cos, trophies]) => {
      lobby.host.skinId = cos.skinId;
      lobby.host.boardId = cos.boardId;
      lobby.host.trophies = trophies | 0;
      privateLobbies.set(code, lobby);
      ws._privateCode = code;
      send(ws, lobbySnapshot(lobby, 'host'));
    }).catch(() => {
      lobby.host.skinId = 'default';
      lobby.host.boardId = 'field_default';
      lobby.host.trophies = 0;
      privateLobbies.set(code, lobby);
      ws._privateCode = code;
      send(ws, lobbySnapshot(lobby, 'host'));
    });
    return true;
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
    // Reattach host if soft-disconnected
    if (lobby.host && !lobby.host.ws) lobby.host.ws = lobby.host.ws;
    const guestFc = ws._friendCode || (data.friendCode ? String(data.friendCode).slice(0, 16) : null);
    const guestDraft = {
      token: ws._token, ws,
      name: String(data.name || 'Игрок').slice(0, 24),
      trophies: 0,
      skinId: data.skinId ? String(data.skinId).slice(0, 32) : 'default',
      boardId: data.boardId ? String(data.boardId).slice(0, 32) : 'field_default',
      avatarId: data.avatarId ? String(data.avatarId).slice(0, 32) : 'init',
      avatarCustom: (data.avatarCustom && typeof data.avatarCustom === 'string') ? String(data.avatarCustom).slice(0, 49152) : '',
      friendCode: guestFc,
      platform: normalizePlatform(data.platform || ws._platform || 'web'),
      os: String(data.os || ws._os || 'unknown').slice(0, 24)
    };
    Promise.all([
      authorizeCosmetics(guestFc, guestDraft.skinId, guestDraft.boardId),
      loadServerTrophies(guestFc)
    ]).then(([cos, trophies]) => {
      guestDraft.skinId = cos.skinId;
      guestDraft.boardId = cos.boardId;
      guestDraft.trophies = trophies | 0;
      lobby.guest = guestDraft;
      ws._privateCode = code;
      send(ws, lobbySnapshot(lobby, 'guest'));
      if (lobby.host.ws) send(lobby.host.ws, lobbySnapshot(lobby, 'host'));
    }).catch(() => {
      guestDraft.skinId = 'default';
      guestDraft.boardId = 'field_default';
      lobby.guest = guestDraft;
      ws._privateCode = code;
      send(ws, lobbySnapshot(lobby, 'guest'));
      if (lobby.host.ws) send(lobby.host.ws, lobbySnapshot(lobby, 'host'));
    });
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
      lobby.guestReady = !!data.ready;
      lobby.guest.ws = ws;
    } else {
      send(ws, { type: 'private_error', reason: 'not_in_lobby' });
      return true;
    }
    if (lobby.host && lobby.host.ws) send(lobby.host.ws, lobbySnapshot(lobby, 'host'));
    if (lobby.guest && lobby.guest.ws) send(lobby.guest.ws, lobbySnapshot(lobby, 'guest'));
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

module.exports = { handlePrivateLobby };
