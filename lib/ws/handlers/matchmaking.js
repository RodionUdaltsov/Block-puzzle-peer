/**
 * Block Puzzle — lib/ws/handlers/matchmaking.js
 * client_info, join/leave/expand queue, rejoin.
 * Extracted from the former monolithic lib/ws-handlers.js — behaviour unchanged.
 * Contract: returns true when the message was handled (stop dispatching), false to fall through.
 */
'use strict';

function handleMatchmaking(type, ws, data, shared) {
  const {
    MatchRoom,
    authorizeCosmetics,
    dealForSeat,
    dequeueToken,
    enqueue,
    findMatch,
    loadServerTrophies,
    log,
    normalizeDeviceId,
    normalizePlatform,
    pendingQueueIntents,
    rooms,
    send,
    serializePieces,
    startRoom,
    store
  } = shared;

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
    return true;
  }

  if (type === 'join_queue') {
    dequeueToken(ws._token);
    if (ws._matchId && rooms.has(ws._matchId)) {
      const room = rooms.get(ws._matchId);
      const snap = room.snapshotFor(ws._token);
      if (snap) send(ws, snap);
      return true;
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
    return true;
  }
  if (type === 'leave_queue') {
    dequeueToken(ws._token);
    send(ws, { type: 'queue_left' });
    return true;
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
    return true;
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
      return true;
    }
    if (!room) {
      send(ws, { type: 'rejoin_fail', reason: 'not_found', matchId: matchId });
      return true;
    }
    if (room.status === 'ended') {
      send(ws, { type: 'rejoin_fail', reason: 'ended', matchId: matchId });
      return true;
    }
    if (!token || !room.getPlayer(token)) {
      send(ws, { type: 'rejoin_fail', reason: 'bad_token', matchId: matchId });
      return true;
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
    return true;
  }

  return false;
}

module.exports = { handleMatchmaking };
