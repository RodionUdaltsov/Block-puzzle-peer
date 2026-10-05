/**
 * WebSocket connection + message handlers.
 * Extracted from server.js — behaviour unchanged.
 */
'use strict';

function attachWsHandlers(wss, deps) {
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
      ws._matchId = matchId;
      ws._token = token;
      room.attach(token, ws);
    }
    return { room, token, matchId };
  }

  // Local aliases refreshed on each connection via getters in message path
  // For connection handler we read hooks.* at call time for mutable maps.

wss.on('connection', (ws) => {
  const store = hooks.store;
  const accountsApi = hooks.accountsApi;
  const presence = hooks.presence;
  const pendingSocial = hooks.pendingSocial;
  const privateLobbies = hooks.privateLobbies;
  const rooms = hooks.rooms;
  const queues = hooks.queues;
  const pendingQueueIntents = hooks.pendingQueueIntents;

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
        if (data.deviceId) {
          const did = normalizeDeviceId(data.deviceId);
          if (did) ws._deviceId = did;
        }
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
      const friendCode = ws._friendCode || null;
      // Server validates ownership — client cannot equip unowned cosmetics
      authorizeCosmetics(
        friendCode,
        data.skinId ? String(data.skinId).slice(0, 32) : 'default',
        data.boardId ? String(data.boardId).slice(0, 32) : 'field_default'
      ).then(async (cos) => {
        // Trophies: server source of truth only (account → guest progress). Never trust client.
        let trophies = 0;
        try {
          if (friendCode && store) {
            if (typeof store.loadAccountByCode === 'function') {
              const acc = await store.loadAccountByCode(friendCode);
              if (acc && typeof acc.trophies === 'number') {
                trophies = Math.max(0, acc.trophies | 0);
              }
            }
            if (trophies === 0 && typeof store.loadGuestProgress === 'function') {
              const gp = await store.loadGuestProgress(friendCode);
              if (gp && typeof gp.trophies === 'number') {
                trophies = Math.max(0, gp.trophies | 0);
              }
            }
          }
        } catch (_) {}
        const player = {
          token: ws._token, ws,
          name: String(data.name || 'Игрок').slice(0, 24),
          trophies: trophies,
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
      const friendCodeEq = ws._friendCode || null;
      (async () => {
        const cos = await authorizeCosmetics(
          friendCodeEq,
          data.skinId ? String(data.skinId).slice(0, 32) : 'default',
          data.boardId ? String(data.boardId).slice(0, 32) : 'field_default'
        );
        const trophies = await loadServerTrophies(friendCodeEq);
        const player = {
          token: ws._token, ws,
          name: String(data.name || 'Игрок').slice(0, 24),
          trophies: trophies | 0,
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
          friendCode: friendCodeEq
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
      })().catch(() => {
        send(ws, { type: 'error', code: 'cosmetics_auth', message: 'cosmetics validation failed' });
      });
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
      // Individual friend code for guests and registered players alike.
      // If the proposed code is already held by another live connection, assign a unique one.
      // Registered accounts keep their code (even if a guest offline-collided with it).
      (async () => {
        let code = String(data.friendCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
        let reassigned = false;

        const liveTakenByOther = (c) => {
          if (!c || c.length < 4) return true;
          const live = presence.get(c);
          return !!(live && live.token && live.token !== ws._token && live.ws && live.ws.readyState === 1);
        };

        // Tombstoned codes must never re-register — force a brand-new identity
        let wasTombstoned = false;
        try {
          if (code && await isFriendCodeDeletedAsync(code)) {
            wasTombstoned = true;
            code = '';
          }
        } catch (_) {}

        // Registered accounts keep their stored friend code (even legacy 6-char).
        // Guests must always have exactly 8 characters.
        let isRegisteredCode = false;
        try {
          if (code && store && typeof store.loadAccountByCode === 'function') {
            const acc = await store.loadAccountByCode(code);
            isRegisteredCode = !!acc;
          }
        } catch (_) {}

        const needNewCode = !code
          || (!isRegisteredCode && code.length !== 8)
          || liveTakenByOther(code)
          || wasTombstoned;

        if (needNewCode) {
          try {
            if (accountsApi && typeof accountsApi.uniqueFriendCode === 'function') {
              code = await accountsApi.uniqueFriendCode();
            } else {
              const { genFriendCode } = require('./lib/accounts');
              let found = null;
              for (let i = 0; i < 64; i++) {
                const tryCode = genFriendCode(8);
                if (!liveTakenByOther(tryCode)) {
                  let taken = false;
                  try {
                    if (store && typeof store.loadAccountByCode === 'function') {
                      const acc = await store.loadAccountByCode(tryCode);
                      if (acc) taken = true;
                    }
                  } catch (_) {}
                  if (!taken) { found = tryCode; break; }
                }
              }
              code = found || genFriendCode(8);
            }
            reassigned = true;
          } catch (_) {
            const { genFriendCode } = require('./lib/accounts');
            code = genFriendCode(8);
            reassigned = true;
          }
        }

        // Preserve previously known custom avatar when client omits the heavy blob
        const prevPres = presence.get(code);
        let nextCustom = '';
        if (typeof data.avatarCustom === 'string' && data.avatarCustom.length > 8) {
          nextCustom = data.avatarCustom.slice(0, 49152);
        } else if (prevPres && typeof prevPres.avatarCustom === 'string' && prevPres.avatarCustom) {
          nextCustom = prevPres.avatarCustom;
        }
        // Trophies for presence: server store only (never client payload)
        let presTrophies = 0;
        try { presTrophies = await loadServerTrophies(code); } catch (_) { presTrophies = 0; }
        const nowTs = Date.now();
        const prevConnectedAt = (prevPres && prevPres.token === ws._token && prevPres.connectedAt)
          ? prevPres.connectedAt
          : nowTs;
        const presEntry = {
          token: ws._token, ws,
          name: String(data.name || 'Игрок').slice(0, 24),
          activity: String(data.activity || 'online').slice(0, 32),
          trophies: presTrophies | 0,
          avatarId: data.avatarId ? String(data.avatarId).slice(0, 32) : 'init',
          avatarCustom: nextCustom,
          status: typeof data.status === 'string' ? String(data.status).slice(0, 80) : '',
          platform: normalizePlatform(data.platform || ws._platform || 'web'),
          os: String(data.os || ws._os || 'unknown').slice(0, 24),
          lastSeen: nowTs,
          ts: nowTs,
          connectedAt: prevConnectedAt // stable for race-grace; not refreshed on every presence_register
        };
        // If this socket previously held another code, clear it so we do not leak presence
        if (ws._friendCode && ws._friendCode !== code) {
          const old = presence.get(ws._friendCode);
          if (old && old.token === ws._token) presence.delete(ws._friendCode);
        }
        // Double-check tombstone after code assignment (async race)
        if (await isFriendCodeDeletedAsync(code)) {
          try { send(ws, { type: 'auth_revoked', reason: 'account_deleted', friendCode: code, ts: Date.now() }); } catch (_) {}
          try { ws._friendCode = null; ws._accountBound = false; } catch (_) {}
          return;
        }
        presence.set(code, presEntry);
        ws._friendCode = code;
        // Track registered vs guest for session_check after DB deletes
        try {
          let reg = false;
          if (store && typeof store.loadAccountByCode === 'function') {
            const acc = await store.loadAccountByCode(code);
            reg = !!acc;
          }
          ws._accountBound = reg;
        } catch (_) { ws._accountBound = false; }
        if (store && store.kind !== 'memory') {
          store.savePresence(code, {
            name: presEntry.name,
            activity: presEntry.activity,
            trophies: presEntry.trophies,
            avatarId: presEntry.avatarId,
            avatarCustom: presEntry.avatarCustom,
            status: presEntry.status || '',
            platform: presEntry.platform,
            os: presEntry.os,
            lastSeen: presEntry.lastSeen,
            online: true
          }, PRESENCE_TTL).catch(() => {});
        }
        schedulePersistMeta();
        send(ws, { type: 'presence_ok', friendCode: code, reassigned: !!reassigned });
        // Always push authoritative cosmetics so inventory survives reload
        try {
          let profile = await loadCosmeticsProfile(code);
          if (!profile.migrated) {
            profile = Cosmetics.migrateFromClient(profile, (data && data.cosmeticsHint) || {});
            await saveCosmeticsProfile(code, profile);
          }
          send(ws, cosmeticsStatePayload(profile));
        } catch (_) {}
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
      })().catch(() => {});
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
      const needEnrich = [];
      for (const code of normalized) {
        const p = presence.get(code);
        if (p && p.ws && p.ws.readyState === 1) {
          result[code] = {
            online: true,
            name: p.name || '',
            activity: p.activity || 'online',
            trophies: p.trophies | 0,
            avatarId: p.avatarId ? String(p.avatarId).slice(0, 32) : 'init',
            // avatarCustom omitted from query (heavy base64) — use friend_profile for full
            status: typeof p.status === 'string' ? p.status.slice(0, 80) : '',
            lastSeen: p.lastSeen || p.ts || Date.now()
          };
          needEnrich.push(code);
        } else if (p && (p.name || p.trophies || p.avatarId)) {
          result[code] = {
            online: false,
            name: p.name || '',
            activity: p.activity || 'away',
            trophies: p.trophies | 0,
            avatarId: p.avatarId ? String(p.avatarId).slice(0, 32) : 'init',
            status: typeof p.status === 'string' ? p.status.slice(0, 80) : '',
            lastSeen: p.lastSeen || p.ts || 0
          };
          needEnrich.push(code);
        } else {
          result[code] = { online: false };
          needEnrich.push(code);
        }
      }
      const enrichFromStoreAndAccount = async (code) => {
        const snap = result[code] || { online: false };
        try {
          if (store && typeof store.loadPresence === 'function') {
            const data = await store.loadPresence(code);
            if (data) {
              if (!snap.name && data.name) snap.name = String(data.name).slice(0, 24);
              if (!snap.activity) snap.activity = data.activity || 'offline';
              if (!(snap.trophies > 0) && data.trophies) snap.trophies = data.trophies | 0;
              if ((!snap.avatarId || snap.avatarId === 'init') && data.avatarId) {
                snap.avatarId = String(data.avatarId).slice(0, 32);
              }
              // skip avatarCustom on presence_query (use friend_profile)
              if (!snap.lastSeen && data.lastSeen) snap.lastSeen = data.lastSeen;
              if (!snap.status && data.status) snap.status = String(data.status).slice(0, 80);
            }
          }
        } catch (_) {}
        try {
          if (store && typeof store.loadAccountByCode === 'function') {
            const acc = await store.loadAccountByCode(code);
            if (acc) {
              if (acc.nick || acc.login) snap.name = String(acc.nick || acc.login).slice(0, 24);
              if (typeof acc.trophies === 'number') snap.trophies = acc.trophies | 0;
              if (acc.avatarId) snap.avatarId = String(acc.avatarId).slice(0, 32);
              // skip avatarCustom on presence_query
              if (typeof acc.status === 'string') snap.status = String(acc.status).slice(0, 80);
              const stats = computeWinStats(acc.history);
              snap.wins = stats.wins;
              snap.played = stats.played;
              snap.winrate = stats.winrate;
            }
          }
        } catch (_) {}
        result[code] = snap;
      };
      Promise.all(needEnrich.map(enrichFromStoreAndAccount))
        .then(() => send(ws, { type: 'presence_state', friends: result }))
        .catch(() => send(ws, { type: 'presence_state', friends: result }));
      return;
    }
    if (type === 'friend_profile') {
      const code = String(data.code || data.friendCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
      if (!code || code.length < 4) {
        send(ws, { type: 'friend_profile_result', ok: false, reason: 'bad_code' });
        return;
      }
      (async () => {
        const out = {
          ok: true,
          code,
          online: false,
          name: '',
          trophies: 0,
          avatarId: 'init',
          avatarCustom: '',
          status: '',
          wins: 0,
          played: 0,
          winrate: null,
          activity: 'offline'
        };
        const live = presence.get(code);
        if (live && live.ws && live.ws.readyState === 1) {
          out.online = true;
          out.name = String(live.name || '').slice(0, 24);
          out.trophies = live.trophies | 0;
          out.avatarId = live.avatarId ? String(live.avatarId).slice(0, 32) : 'init';
          out.avatarCustom = (typeof live.avatarCustom === 'string' && out.avatarId === 'custom')
            ? live.avatarCustom.slice(0, 49152) : '';
          out.status = typeof live.status === 'string' ? live.status.slice(0, 80) : '';
          out.activity = live.activity || 'online';
        }
        try {
          if (store && typeof store.loadPresence === 'function') {
            const data = await store.loadPresence(code);
            if (data) {
              if (!out.name && data.name) out.name = String(data.name).slice(0, 24);
              if (!(out.trophies > 0) && data.trophies) out.trophies = data.trophies | 0;
              if ((!out.avatarId || out.avatarId === 'init') && data.avatarId) {
                out.avatarId = String(data.avatarId).slice(0, 32);
              }
              if (!out.avatarCustom && data.avatarCustom && out.avatarId === 'custom') {
                out.avatarCustom = String(data.avatarCustom).slice(0, 49152);
              }
              if (!out.online) out.activity = data.activity || 'offline';
              if (!out.status && data.status) out.status = String(data.status).slice(0, 80);
            }
          }
        } catch (_) {}
        try {
          if (store && typeof store.loadAccountByCode === 'function') {
            const acc = await store.loadAccountByCode(code);
            if (acc) {
              out.name = String(acc.nick || acc.login || out.name || code).slice(0, 24);
              if (typeof acc.trophies === 'number') out.trophies = acc.trophies | 0;
              if (acc.avatarId) out.avatarId = String(acc.avatarId).slice(0, 32);
              if (typeof acc.avatarCustom === 'string' && out.avatarId === 'custom') {
                out.avatarCustom = acc.avatarCustom.slice(0, 49152);
              }
              if (typeof acc.status === 'string') out.status = String(acc.status).slice(0, 80);
              const stats = computeWinStats(acc.history);
              out.wins = stats.wins;
              out.played = stats.played;
              out.winrate = stats.winrate;
            }
          }
        } catch (_) {}
        if (!out.name) out.name = code;
        send(ws, Object.assign({ type: 'friend_profile_result' }, out));
      })().catch(() => {
        send(ws, { type: 'friend_profile_result', ok: false, code, reason: 'error' });
      });
      return;
    }
    if (type === 'friend_code_check') {
      const code = String(data.code || data.friendCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
      if (!code || code.length < 6) {
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
      // Recently seen (persisted presence) OR registered account offline
      const finish = (snap, fromAccount) => {
        if (snap && (snap.name || snap.lastSeen || fromAccount)) {
          send(ws, {
            type: 'friend_code_check_result',
            code,
            ok: true,
            online: false,
            name: String(snap.name || snap.nick || '').slice(0, 24) || code,
            trophies: (snap.trophies | 0)
          });
        } else {
          send(ws, { type: 'friend_code_check_result', code, ok: false, reason: 'not_found' });
        }
      };
      const tryAccount = () => {
        if (store && typeof store.loadAccountByCode === 'function') {
          store.loadAccountByCode(code).then((acc) => {
            if (acc) {
              finish({
                name: acc.nick || acc.login || code,
                nick: acc.nick || acc.login,
                trophies: acc.trophies | 0,
                lastSeen: acc.updatedAt || acc.createdAt || 1
              }, true);
            } else {
              finish(null, false);
            }
          }).catch(() => finish(null, false));
        } else {
          finish(null, false);
        }
      };
      if (store && typeof store.loadPresence === 'function') {
        store.loadPresence(code).then((snap) => {
          if (snap && (snap.name || snap.lastSeen)) finish(snap, false);
          else tryAccount();
        }).catch(() => tryAccount());
      } else {
        tryAccount();
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
        // 2) Offline (and any registered) accounts from store — include players not currently online
        const finishSearch = () => {
          // Prefer exact code match first, then online, then trophies
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
        if (store && typeof store.searchAccounts === 'function' && results.length < 20) {
          store.searchAccounts(raw, 20).then((accs) => {
            try {
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
            finishSearch();
          }).catch(() => finishSearch());
          return;
        }
        finishSearch();
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
      // Display trophies from server presence / store — not client claim
      let socialTrophies = 0;
      try {
        const live = fromCode && presence.get(fromCode);
        if (live && typeof live.trophies === 'number') socialTrophies = live.trophies | 0;
      } catch (_) {}
      const out = Object.assign({}, payload, {
        type: msgType, code: fromCode, from: fromCode,
        name: String(data.name || payload.name || 'Игрок').slice(0, 24),
        trophies: socialTrophies | 0,
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


    if (type === 'session_check') {
      (async () => {
        const code = ws._friendCode || String(data.friendCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
        if (!code) {
          send(ws, { type: 'auth_revoked', reason: 'no_session', ts: Date.now() });
          return;
        }
        // Registered sessions require account row; guests are alive if any durable artifact exists
        const probe = await probeFriendCodeAlive(code, { requireAccount: !!ws._accountBound });
        if (!probe.alive) {
          try { send(ws, { type: 'auth_revoked', reason: 'account_deleted', friendCode: code, ts: Date.now() }); } catch (_) {}
          try { ws._friendCode = null; ws._accountBound = false; } catch (_) {}
          try { kickFriendCodeSessions(code, 'account_deleted'); } catch (_) {}
        } else {
          if (probe.hasAccount) ws._accountBound = true;
          send(ws, { type: 'session_ok', friendCode: code, ts: Date.now() });
        }
      })().catch(() => {});
      return;
    }

    // —— Server-authoritative cosmetics ——
    if (type === 'cosmetics_get') {
      const code = ws._friendCode || String(data.friendCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
      if (code && !ws._friendCode) ws._friendCode = code;
      if (!code) {
        // Do not push defaultProfile — client would treat it as authoritative wipe
        send(ws, { type: 'cosmetics_state', ok: false, error: 'no_profile' });
        return;
      }
      loadLiveCosmeticsProfile(code).then((profile) => {
        send(ws, cosmeticsStatePayload(profile));
      }).catch((err) => {
        send(ws, { type: 'cosmetics_state', ok: false, error: (err && err.dead) ? 'account_deleted' : 'load_failed' });
      });
      return;
    }
    if (type === 'cosmetics_buy') {
      const code = ws._friendCode || String(data.friendCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
      if (code && !ws._friendCode) ws._friendCode = code;
      if (!code) {
        send(ws, { type: 'cosmetics_buy_result', ok: false, error: 'no_profile' });
        return;
      }
      const kind = data.kind === 'board' ? 'board' : 'skin';
      const id = String(data.id || '').slice(0, 32);
      // skipPersist: avoid double-write; saveCosmeticsProfile runs after tryBuy
      loadLiveCosmeticsProfile(code, { skipPersist: true }).then(async (profile) => {
        // Keep cosmetics balance in sync with registered account when present
        try {
          if (store && typeof store.loadAccountByCode === 'function') {
            const acc = await store.loadAccountByCode(code);
            if (acc && typeof acc.diamonds === 'number') {
              // Registered account balance is exact source of truth
              profile.diamonds = Math.max(0, acc.diamonds | 0);
              if (Array.isArray(acc.ownedSkins) && acc.ownedSkins.length) {
                const set = new Set((profile.ownedSkins || []).map(String));
                acc.ownedSkins.forEach((x) => { if (x) set.add(String(x)); });
                profile.ownedSkins = Array.from(set);
              }
              if (Array.isArray(acc.ownedBoards) && acc.ownedBoards.length) {
                const set = new Set((profile.ownedBoards || []).map(String));
                acc.ownedBoards.forEach((x) => { if (x) set.add(String(x)); });
                profile.ownedBoards = Array.from(set);
              }
            }
          }
        } catch (_) {}
        const result = Cosmetics.tryBuy(profile, kind, id);
        if (result.ok) {
          await saveCosmeticsProfile(code, result.profile);
          // Persist spend on registered account too
          try {
            if (store && typeof store.loadAccountByCode === 'function') {
              const acc = await store.loadAccountByCode(code);
              if (acc) {
                acc.diamonds = result.profile.diamonds | 0;
                if (Array.isArray(result.profile.ownedSkins)) acc.ownedSkins = result.profile.ownedSkins.slice(0, 64);
                if (Array.isArray(result.profile.ownedBoards)) acc.ownedBoards = result.profile.ownedBoards.slice(0, 64);
                if (result.profile.equippedSkin) acc.skinId = String(result.profile.equippedSkin).slice(0, 32);
                if (result.profile.equippedBoard) acc.boardId = String(result.profile.equippedBoard).slice(0, 32);
                acc.updatedAt = Date.now();
                await store.saveAccount(acc);
              }
            }
          } catch (_) {}
          // Keep guest progress (DB + device) in sync — TRUST server profile (paid skins)
          try {
            if (store && typeof store.saveGuestProgress === 'function') {
              let gp = null;
              try { gp = await store.loadGuestProgress(code); } catch (_) { gp = null; }
              gp = applyServerCosmeticsToGuest(gp || { friendCode: code }, result.profile, code);
              await store.saveGuestProgress(code, gp);
            }
            // Mirror onto device bind for this WS (if any) when it holds this guest code
            try {
              const did = normalizeDeviceId(ws._deviceId);
              if (did) {
                const e = await loadDeviceBindRecord(did);
                if (e) {
                  const fc = e.guestProgress && e.guestProgress.friendCode
                    ? String(e.guestProgress.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '')
                    : '';
                  if (!e.guestProgress || fc === code || !fc) {
                    e.guestProgress = applyServerCosmeticsToGuest(
                      e.guestProgress || { friendCode: code },
                      result.profile,
                      code
                    );
                    await persistDeviceBind(did, e);
                  }
                }
              }
            } catch (_) {}
          } catch (_) {}
          send(ws, cosmeticsResultPayload('cosmetics_buy_result', { ok: true, kind, id }, result.profile));
        } else {
          send(ws, cosmeticsResultPayload('cosmetics_buy_result', { ok: false, error: result.error, kind, id }, result.profile));
        }
      }).catch((err) => {
        send(ws, { type: 'cosmetics_buy_result', ok: false, error: (err && err.dead) ? 'account_deleted' : 'server' });
      });
      return;
    }
    if (type === 'cosmetics_equip') {
      const code = ws._friendCode || String(data.friendCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
      if (code && !ws._friendCode) ws._friendCode = code;
      if (!code) {
        send(ws, { type: 'cosmetics_equip_result', ok: false, error: 'no_profile' });
        return;
      }
      const kind = data.kind === 'board' ? 'board' : 'skin';
      const id = String(data.id || '').slice(0, 32);
      loadLiveCosmeticsProfile(code, { skipPersist: true }).then(async (profile) => {
        const result = Cosmetics.tryEquip(profile, kind, id);
        if (result.ok) {
          // Profile is sole authority for both equip slots; account mirrors both
          await saveCosmeticsProfile(code, result.profile);
          try {
            if (store && typeof store.loadAccountByCode === 'function') {
              const acc = await store.loadAccountByCode(code);
              if (acc) {
                acc.skinId = String(result.profile.equippedSkin || 'default').slice(0, 32);
                acc.boardId = String(result.profile.equippedBoard || 'field_default').slice(0, 32);
                acc.updatedAt = Date.now();
                await store.saveAccount(acc);
              }
            }
          } catch (_) {}
          try {
            if (store && typeof store.saveGuestProgress === 'function') {
              let gp = null;
              try { gp = await store.loadGuestProgress(code); } catch (_) { gp = null; }
              gp = applyServerCosmeticsToGuest(gp || { friendCode: code }, result.profile, code);
              await store.saveGuestProgress(code, gp);
            }
            try {
              const did = normalizeDeviceId(ws._deviceId);
              if (did) {
                const e = await loadDeviceBindRecord(did);
                if (e) {
                  const fc = e.guestProgress && e.guestProgress.friendCode
                    ? String(e.guestProgress.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '')
                    : '';
                  if (!e.guestProgress || fc === code || !fc) {
                    e.guestProgress = applyServerCosmeticsToGuest(
                      e.guestProgress || { friendCode: code },
                      result.profile,
                      code
                    );
                    await persistDeviceBind(did, e);
                  }
                }
              }
            } catch (_) {}
          } catch (_) {}
          send(ws, cosmeticsResultPayload('cosmetics_equip_result', { ok: true, kind, id }, result.profile));
        } else {
          send(ws, cosmeticsResultPayload('cosmetics_equip_result', { ok: false, error: result.error, kind, id }, result.profile));
        }
      }).catch((err) => {
        send(ws, { type: 'cosmetics_equip_result', ok: false, error: (err && err.dead) ? 'account_deleted' : 'server' });
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


}

module.exports = { attachWsHandlers };
