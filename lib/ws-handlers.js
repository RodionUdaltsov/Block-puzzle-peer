/**
 * WebSocket connection + message handlers.
 * Extracted from server.js for maintainability.
 *
 * @param {import('../vendor/ws').WebSocketServer} wss
 * @param {object} env shared server state & helpers
 * @returns {{ send: Function, resolveMatchCtx: Function }}
 */
'use strict';

module.exports = function attachWsHandlers(wss, env) {
  const {
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
    tryPairQueues,
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
    PKG_VERSION,
    getStore,
    PRESENCE_TTL: PRESENCE_TTL_ENV
  } = env;
  const PRESENCE_TTL = Math.max(60, Number(PRESENCE_TTL_ENV) || (7 * 24 * 3600));

  /** Live store handle (initialized async after attach). */
  function store() {
    if (typeof getStore === 'function') return getStore();
    return env.store || null;
  }

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
    try {
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
      // Always free previous match binding — stale matchId was blocking ranked search
      if (ws._matchId && rooms.has(ws._matchId)) {
        const room = rooms.get(ws._matchId);
        try {
          if (room && (room.status === 'live' || room.status === 'loading')) {
            try { room.detach(ws._token); } catch (_) {}
          }
        } catch (_) {}
      }
      ws._matchId = null;
      const intent = pendingQueueIntents.get(ws._token);
      const friendCode = ws._friendCode || null;
      // Server validates ownership — client cannot equip unowned cosmetics
      authorizeCosmetics(
        friendCode,
        data.skinId ? String(data.skinId).slice(0, 32) : 'default',
        data.boardId ? String(data.boardId).slice(0, 32) : 'field_default'
      ).then((cos) => {
        const player = {
          token: ws._token, ws,
          name: String(data.name || 'Игрок').slice(0, 24),
          trophies: Math.max(0, data.trophies | 0),
          skinId: cos.skinId,
          boardId: cos.boardId,
          avatarId: data.avatarId ? String(data.avatarId).slice(0, 32) : 'init',
          avatarCustom: (data.avatarCustom && typeof data.avatarCustom === 'string') ? String(data.avatarCustom).slice(0, 49152) : '',
          duration: (data.duration === 60 || data.duration === 180) ? data.duration : 120,
          expandLevel: Math.min(3, Math.max(0, data.expandLevel | 0)),
          clientId: data.clientId ? String(data.clientId).slice(0, 64) : null,
          platform: normalizePlatform(data.platform || data.device || ws._platform),
          os: String(data.os || ws._os || 'unknown').slice(0, 24),
          protocolVersion: (data.protocolVersion | 0) || 1,
          queuedAt: (intent && intent.queuedAt) || Date.now(),
          friendCode
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
          // Fix async race: second joiner may have enqueued while we searched empty queue
          try { if (typeof tryPairQueues === 'function') tryPairQueues(); } catch (_) {}
        }
      }).catch(() => {
        send(ws, { type: 'error', code: 'cosmetics_auth', message: 'cosmetics validation failed' });
      });
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
        try { if (typeof tryPairQueues === 'function') tryPairQueues(); } catch (_) {}
      }
      return;
    }
    if (type === 'rejoin') {
      const matchId = data.matchId ? String(data.matchId) : null;
      const token = data.token ? String(data.token) : (ws._token || null);
      let room = matchId ? rooms.get(matchId) : null;
      // Persistence: after restart room may only exist in store
      if (!room && matchId && store()) {
        // Sync path: schedule async restore then client can retry, or wait briefly
        store().loadRoom(matchId).then((snap) => {
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
      const hostFc = ws._friendCode || (data.friendCode ? String(data.friendCode).slice(0, 16) : null);
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
          friendCode: hostFc,
          platform: normalizePlatform(data.platform || ws._platform || 'web'),
          os: String(data.os || ws._os || 'unknown').slice(0, 24)
        },
        guest: null
      };
      // Clamp host cosmetics against server profile (async, then snapshot)
      authorizeCosmetics(hostFc, lobby.host.skinId, lobby.host.boardId).then((cos) => {
        lobby.host.skinId = cos.skinId;
        lobby.host.boardId = cos.boardId;
        privateLobbies.set(code, lobby);
        ws._privateCode = code;
        send(ws, lobbySnapshot(lobby, 'host'));
      }).catch(() => {
        lobby.host.skinId = 'default';
        lobby.host.boardId = 'field_default';
        privateLobbies.set(code, lobby);
        ws._privateCode = code;
        send(ws, lobbySnapshot(lobby, 'host'));
      });
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
      const guestFc = ws._friendCode || (data.friendCode ? String(data.friendCode).slice(0, 16) : null);
      const guestDraft = {
        token: ws._token, ws,
        name: String(data.name || 'Игрок').slice(0, 24),
        trophies: Math.max(0, data.trophies | 0),
        skinId: data.skinId ? String(data.skinId).slice(0, 32) : 'default',
        boardId: data.boardId ? String(data.boardId).slice(0, 32) : 'field_default',
        avatarId: data.avatarId ? String(data.avatarId).slice(0, 32) : 'init',
        avatarCustom: (data.avatarCustom && typeof data.avatarCustom === 'string') ? String(data.avatarCustom).slice(0, 49152) : '',
        friendCode: guestFc,
        platform: normalizePlatform(data.platform || ws._platform || 'web'),
        os: String(data.os || ws._os || 'unknown').slice(0, 24)
      };
      authorizeCosmetics(guestFc, guestDraft.skinId, guestDraft.boardId).then((cos) => {
        guestDraft.skinId = cos.skinId;
        guestDraft.boardId = cos.boardId;
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
      return;
    }
    if (type === 'leave_private') {
      const leaveCode = data.code ? String(data.code).toUpperCase().replace(/[^A-Z0-9]/g, '') : null;
      if (leaveCode && privateLobbies.has(leaveCode)) {
        const lobby = privateLobbies.get(leaveCode);
        const isHost = lobby.host && lobby.host.token === ws._token;
        const isGuest = lobby.guest && lobby.guest.token === ws._token;
        if (isHost || isGuest) {
          leavePrivateLobby(ws._token);
        } else {
          // Stale client still sending leave for a room they're not in
        }
      } else {
        leavePrivateLobby(ws._token);
      }
      ws._privateCode = null;
      send(ws, { type: 'private_left' });
      return;
    }
    if (type === 'private_ready') {
      const code = String(data.code || ws._privateCode || '').toUpperCase();
      const lobby = privateLobbies.get(code);
      if (!lobby) {
        send(ws, { type: 'private_error', reason: 'not_in_lobby' });
        send(ws, { type: 'private_left' });
        ws._privateCode = null;
        return;
      }
      if (lobby.host && lobby.host.token === ws._token) {
        lobby.hostReady = !!data.ready;
        lobby.host.ws = ws;
      } else if (lobby.guest && lobby.guest.token === ws._token) {
        lobby.guestReady = !!data.ready;
        lobby.guest.ws = ws;
      } else {
        // Player already left — do NOT re-attach on Ready spam
        send(ws, { type: 'private_error', reason: 'not_in_lobby' });
        send(ws, { type: 'private_left' });
        ws._privateCode = null;
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
        avatarId: data.avatarId ? String(data.avatarId).slice(0, 32) : 'init',
        avatarCustom: (typeof data.avatarCustom === 'string') ? data.avatarCustom.slice(0, 49152) : '',
        platform: normalizePlatform(data.platform || ws._platform || 'web'),
        os: String(data.os || ws._os || 'unknown').slice(0, 24),
        lastSeen: Date.now(),
        ts: Date.now()
      };
      presence.set(code, presEntry);
      ws._friendCode = code;
      if (store() && store().kind !== 'memory') {
        store().savePresence(code, {
          name: presEntry.name,
          activity: presEntry.activity,
          trophies: presEntry.trophies,
          avatarId: presEntry.avatarId,
          avatarCustom: presEntry.avatarCustom,
          platform: presEntry.platform,
          os: presEntry.os,
          lastSeen: presEntry.lastSeen,
          online: true
        }, PRESENCE_TTL).catch(() => {});
      }
      schedulePersistMeta();
      send(ws, { type: 'presence_ok', friendCode: code });
      // Server-authoritative cosmetics: load/migrate profile and push state
      (async () => {
        try {
          let profile = await loadCosmeticsProfile(code);
          if (!profile.migrated && data.cosmeticsHint) {
            profile = Cosmetics.migrateFromClient(profile, data.cosmeticsHint);
            await saveCosmeticsProfile(code, profile);
          } else if (!profile.migrated) {
            profile = Cosmetics.migrateFromClient(profile, {});
            await saveCosmeticsProfile(code, profile);
          }
          send(ws, cosmeticsStatePayload(profile));
        } catch (_) {}
      })();
      const deliverBox = (box) => {
        if (!box || !box.length) return;
        pendingSocial.delete(code);
        if (store()) store().setSocial(code, []).catch(() => {});
        for (const msg of box) {
          try { send(ws, { type: 'social_msg', msg }); } catch (_) {}
        }
      };
      const memBox = pendingSocial.get(code);
      if (memBox && memBox.length) {
        deliverBox(memBox);
      } else if (store()) {
        store().getSocial(code).then((box) => deliverBox(box)).catch(() => {});
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
      if (!needStore.length || !store() || store().kind === 'memory') {
        finish();
        return;
      }
      Promise.all(needStore.map((code) =>
        store().loadPresence(code).then((data) => {
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
      if (store() && typeof store().loadPresence === 'function') {
        store().loadPresence(code).then(finish).catch(() => finish(null));
      } else {
        finish(null);
      }
      return;
    }
    if (type === 'presence_search') {
      const raw = String(data.q || data.query || '').trim();
      const q = raw.toUpperCase().replace(/[^A-Z0-9А-ЯЁ\s\-_]/gi, '').slice(0, 24);
      const results = [];
      const seenCodes = new Set();
      if (q.length >= 1) {
        const qCode = q.replace(/[^A-Z0-9]/g, '');
        const qName = raw.toLowerCase().slice(0, 24);
        // 1) Online players from live presence
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
            activity: String(p.activity || 'online').slice(0, 32),
            online: true,
            avatarId: p.avatarId ? String(p.avatarId).slice(0, 32) : 'init',
            avatarCustom: (typeof p.avatarCustom === 'string' && p.avatarId === 'custom')
              ? p.avatarCustom.slice(0, 49152) : ''
          });
          seenCodes.add(code);
          if (results.length >= 20) break;
        }
        // 2) Offline recent presence + registered accounts
        const finishSearch = () => {
          results.sort((a, b) => {
            const ae = a.code === qCode ? 0 : 1;
            const be = b.code === qCode ? 0 : 1;
            if (ae !== be) return ae - be;
            const ao = a.online ? 0 : 1;
            const bo = b.online ? 0 : 1;
            if (ao !== bo) return ao - bo;
            return (b.trophies | 0) - (a.trophies | 0);
          });
          send(ws, { type: 'presence_search_result', q: raw.slice(0, 24), results: results.slice(0, 20) });
        };
        const st = store();
        const addOfflinePresence = async () => {
          if (!st || typeof st.listPresenceCodes !== 'function' || results.length >= 20) return;
          try {
            const codes = await st.listPresenceCodes();
            for (const codeRaw of (codes || [])) {
              if (results.length >= 20) break;
              const code = String(codeRaw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
              if (!code || seenCodes.has(code)) continue;
              if (ws._friendCode && code === ws._friendCode) continue;
              const codeHit = qCode.length >= 2 && code.indexOf(qCode) === 0;
              let data = null;
              try { data = await st.loadPresence(code); } catch (_) { data = null; }
              if (!data) continue;
              const name = String(data.name || code).slice(0, 24);
              const nameL = name.toLowerCase();
              const nameHit = qName.length >= 2 && nameL.indexOf(qName) !== -1;
              if (!codeHit && !nameHit) continue;
              results.push({
                code,
                name: name || code,
                trophies: data.trophies | 0,
                activity: String(data.activity || 'offline').slice(0, 32),
                online: false,
                avatarId: data.avatarId ? String(data.avatarId).slice(0, 32) : 'init',
                avatarCustom: (typeof data.avatarCustom === 'string' && data.avatarId === 'custom')
                  ? data.avatarCustom.slice(0, 49152) : ''
              });
              seenCodes.add(code);
            }
          } catch (_) {}
        };
        const addAccounts = async () => {
          if (!st || typeof st.searchAccounts !== 'function' || results.length >= 20) return;
          try {
            const accs = await st.searchAccounts(raw, 20);
            for (const acc of (accs || [])) {
              if (!acc || !acc.friendCode) continue;
              const code = String(acc.friendCode).toUpperCase();
              if (seenCodes.has(code)) continue;
              if (ws._friendCode && code === ws._friendCode) continue;
              const name = String(acc.nick || acc.login || code).slice(0, 24);
              const login = String(acc.login || '').toLowerCase();
              const nickL = String(acc.nick || '').toLowerCase();
              const codeHit = qCode.length >= 2 && code.indexOf(qCode) === 0;
              const nameHit = qName.length >= 2 && (login.indexOf(qName) !== -1 || nickL.indexOf(qName) !== -1);
              if (!codeHit && !nameHit) continue;
              results.push({
                code,
                name: name || code,
                trophies: (acc.trophies | 0),
                activity: 'offline',
                online: false,
                avatarId: acc.avatarId ? String(acc.avatarId).slice(0, 32) : 'init',
                avatarCustom: (typeof acc.avatarCustom === 'string' && acc.avatarId === 'custom')
                  ? acc.avatarCustom.slice(0, 49152) : ''
              });
              seenCodes.add(code);
              if (results.length >= 20) break;
            }
          } catch (_) {}
        };
        (async () => {
          await addOfflinePresence();
          await addAccounts();
          finishSearch();
        })().catch(() => finishSearch());
        return;
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
        if (store()) store().setSocial(to, box).catch(() => {});
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

    // —— Server-authoritative cosmetics ——
    if (type === 'cosmetics_get') {
      const code = ws._friendCode || String(data.friendCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
      if (!code) {
        send(ws, cosmeticsStatePayload(Cosmetics.defaultProfile()));
        return;
      }
      loadCosmeticsProfile(code).then((profile) => {
        send(ws, cosmeticsStatePayload(profile));
      }).catch(() => {
        send(ws, cosmeticsStatePayload(Cosmetics.defaultProfile()));
      });
      return;
    }
    if (type === 'cosmetics_buy') {
      const code = ws._friendCode;
      if (!code) {
        send(ws, { type: 'cosmetics_buy_result', ok: false, error: 'no_profile' });
        return;
      }
      const kind = data.kind === 'board' ? 'board' : 'skin';
      const id = String(data.id || '').slice(0, 32);
      loadCosmeticsProfile(code).then(async (profile) => {
        const result = Cosmetics.tryBuy(profile, kind, id);
        if (result.ok) {
          await saveCosmeticsProfile(code, result.profile);
          send(ws, Object.assign({ type: 'cosmetics_buy_result', ok: true, kind, id }, cosmeticsStatePayload(result.profile)));
        } else {
          send(ws, Object.assign({ type: 'cosmetics_buy_result', ok: false, error: result.error, kind, id }, cosmeticsStatePayload(result.profile)));
        }
      }).catch(() => {
        send(ws, { type: 'cosmetics_buy_result', ok: false, error: 'server' });
      });
      return;
    }
    if (type === 'cosmetics_equip') {
      const code = ws._friendCode;
      if (!code) {
        send(ws, { type: 'cosmetics_equip_result', ok: false, error: 'no_profile' });
        return;
      }
      const kind = data.kind === 'board' ? 'board' : 'skin';
      const id = String(data.id || '').slice(0, 32);
      loadCosmeticsProfile(code).then(async (profile) => {
        const result = Cosmetics.tryEquip(profile, kind, id);
        if (result.ok) {
          await saveCosmeticsProfile(code, result.profile);
          send(ws, Object.assign({ type: 'cosmetics_equip_result', ok: true, kind, id }, cosmeticsStatePayload(result.profile)));
        } else {
          send(ws, Object.assign({ type: 'cosmetics_equip_result', ok: false, error: result.error, kind, id }, cosmeticsStatePayload(result.profile)));
        }
      }).catch(() => {
        send(ws, { type: 'cosmetics_equip_result', ok: false, error: 'server' });
      });
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
      else return; // not in this lobby
      // Lightweight ping-only — avoid full profile/UI rebuild on clients
      try {
        const mk = (role) => ({
          type: 'private_lobby',
          pingOnly: true,
          code: lobby.code,
          role,
          hostRtt: lobby.host && typeof lobby.host.rtt === 'number' ? lobby.host.rtt : null,
          guestRtt: lobby.guest && typeof lobby.guest.rtt === 'number' ? lobby.guest.rtt : null
        });
        if (lobby.host && lobby.host.ws && lobby.host.ws.readyState === 1) {
          send(lobby.host.ws, mk('host'));
        }
        if (lobby.guest && lobby.guest.ws && lobby.guest.ws.readyState === 1) {
          send(lobby.guest.ws, mk('guest'));
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
    } catch (err) {
      try {
        log('warn', 'ws message handler error', {
          message: err && err.message,
          stack: err && err.stack ? String(err.stack).slice(0, 400) : null,
          token: ws._token || null
        });
      } catch (_) {}
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


  return { send, resolveMatchCtx };
};
