/**
 * Block Puzzle — lib/ws/handlers/matchmaking.js
 * client_info, join/leave/expand queue, rejoin.
 * Extracted from the former monolithic lib/ws-handlers.js — behaviour unchanged.
 * Contract: returns true when the message was handled (stop dispatching), false to fall through.
 */
'use strict';
const { clock } = require('../../clock');
const { verifyWsOwnsPlayer } = require('../identity');

// Rejoin requests whose seat ownership (token + identity) has already been proven.
const REJOIN_VERIFIED = new WeakSet();

/**
 * Every queue-affecting action bumps ws._queueSeq. A join_queue / expand_queue captures the value
 * before its awaits and must still match afterwards — otherwise the player left the queue, closed
 * the socket, opened a private lobby or was already placed into a match while we were waiting,
 * and enqueueing now would create a ghost entry / double-book the player.
 */
function bumpQueueSeq(ws) { ws._queueSeq = ((ws._queueSeq | 0) + 1) | 0; return ws._queueSeq; }
function queueAttemptStale(ws, seq, rooms) {
  return ws._queueSeq !== seq
    || ws.readyState !== 1
    || !!(ws._matchId && rooms.has(ws._matchId));
}

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
    store,
    tryMatchAcrossInstances,
    tryClaimMatch
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
    const seq = bumpQueueSeq(ws);
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
      if (queueAttemptStale(ws, seq, rooms)) return;
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
      if (queueAttemptStale(ws, seq, rooms)) return; // state changed while loading trophies
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
        queuedAt: (intent && intent.queuedAt) || clock.now(),
        friendCode
      };
      try {
        ws._platform = player.platform;
        ws._os = player.os;
      } catch (_) {}
      // Authoritative claim: local-only when no Redis; Redis lock when multi-instance
      const claim = typeof tryClaimMatch === 'function'
        ? tryClaimMatch
        : async (p) => {
            const opp = findMatch(p);
            if (!opp) return false;
            dequeueToken(opp.token);
            startRoom(opp, p);
            return true;
          };
      const matched = await claim(player);
      if (!matched) {
        try {
          await enqueue(player);
          send(ws, { type: 'queued', duration: player.duration, trophies: player.trophies, restored: !!intent });
        } catch (e) {
          send(ws, {
            type: 'error',
            code: (e && e.code) || 'queue_sync_failed',
            message: 'matchmaking temporarily unavailable'
          });
        }
      }
    }).catch(() => {
      send(ws, { type: 'error', code: 'cosmetics_auth', message: 'cosmetics validation failed' });
    });
    return true;
  }
  if (type === 'leave_queue') {
    dequeueToken(ws._token);
    bumpQueueSeq(ws); // cancels any join_queue still awaiting authorization
    send(ws, { type: 'queue_left' });
    return true;
  }
  if (type === 'expand_queue') {
    dequeueToken(ws._token);
    const seqEq = bumpQueueSeq(ws);
    const friendCodeEq = ws._friendCode || null;
    (async () => {
      const cos = await authorizeCosmetics(
        friendCodeEq,
        data.skinId ? String(data.skinId).slice(0, 32) : 'default',
        data.boardId ? String(data.boardId).slice(0, 32) : 'field_default'
      );
      const trophies = await loadServerTrophies(friendCodeEq);
      if (queueAttemptStale(ws, seqEq, rooms)) return;
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
      const claim = typeof tryClaimMatch === 'function'
        ? tryClaimMatch
        : async (p) => {
            const opp = findMatch(p);
            if (!opp) return false;
            dequeueToken(opp.token);
            startRoom(opp, p);
            return true;
          };
      const matched = await claim(player);
      if (!matched) {
        try {
          await enqueue(player);
          send(ws, { type: 'queued', expandLevel: player.expandLevel });
        } catch (e) {
          send(ws, {
            type: 'error',
            code: (e && e.code) || 'queue_sync_failed',
            message: 'matchmaking temporarily unavailable'
          });
        }
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
    // Cross-instance: room lives on another Node — bind token here and ask owner to re-attach.
    if (!room && matchId && token && shared.coord && shared.coord.enabled) {
      Promise.resolve(shared.coord.roomOwner(matchId)).then(async (owner) => {
        if (!owner || owner === shared.coord.instanceId) {
          // Fall through to store restore / not_found below via retry path
          if (store && typeof store.loadRoom === 'function') {
            try {
              const snap = await store.loadRoom(matchId);
              if (!snap) {
                send(ws, { type: 'rejoin_fail', reason: 'not_found', matchId });
                return;
              }
              let r = rooms.get(matchId);
              if (!r) {
                r = MatchRoom.restore(snap);
                if (r) log('info', 'store restored room on rejoin', { matchId, status: r.status });
              }
              if (!r || !r.getPlayer(token)) {
                send(ws, { type: 'rejoin_fail', reason: r && r.status === 'ended' ? 'ended' : 'not_found', matchId });
                return;
              }
              if (!(await verifyWsOwnsPlayer(ws, r.getPlayer(token), shared))) {
                send(ws, { type: 'rejoin_fail', reason: 'bad_token', matchId });
                return;
              }
              ws._token = token;
              ws._matchId = r.id;
              r.attach(token, ws);
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
              return;
            } catch (_) {
              send(ws, { type: 'rejoin_fail', reason: 'not_found', matchId });
              return;
            }
          }
          send(ws, { type: 'rejoin_fail', reason: 'not_found', matchId });
          return;
        }
        try {
          if (typeof shared.coord.bindToken === 'function') {
            await shared.coord.bindToken(token, { ws, friendCode: ws._friendCode || '' });
          }
        } catch (_) {}
        ws._token = token;
        ws._matchId = matchId;
        try {
          await shared.coord.publishRoomForward(owner, {
            matchId,
            token,
            data: { type: 'rejoin', matchId, token }
          });
        } catch (_) {
          send(ws, { type: 'rejoin_fail', reason: 'not_found', matchId });
        }
      }).catch(() => {
        send(ws, { type: 'rejoin_fail', reason: 'not_found', matchId });
      });
      return true;
    }
    // Persistence: after restart room may only exist in store
    if (!room && matchId && store) {
      // Sync path: schedule async restore then client can retry, or wait briefly
      store.loadRoom(matchId).then(async (snap) => {
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
        if (!(await verifyWsOwnsPlayer(ws, r.getPlayer(token), shared))) {
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
    // Seat ownership = token + verified identity. Proof is async, then this handler is re-run once.
    if (!REJOIN_VERIFIED.has(data)) {
      verifyWsOwnsPlayer(ws, room.getPlayer(token), shared).then((ok) => {
        if (!ok) {
          send(ws, { type: 'rejoin_fail', reason: 'bad_token', matchId: matchId });
          return;
        }
        REJOIN_VERIFIED.add(data);
        handleMatchmaking(type, ws, data, shared);
      }, () => send(ws, { type: 'rejoin_fail', reason: 'bad_token', matchId: matchId }));
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
