/**
 * Matchmaking + private lobbies.
 * Extracted from server.js — queue buckets, ranked match, private codes.
 *
 * @param {object} env
 * @returns {object} API
 */
'use strict';

module.exports = function createMatchmaking(env) {
  const {
    queues,
    privateLobbies,
    pendingQueueIntents,
    MatchRoom,
    serializePieces,
    schedulePersistMeta,
    rooms
  } = env;

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

/**
 * After async join_queue races both players can sit in queue without pairing.
 * Sweep all duration buckets and start rooms for compatible pairs.
 */
function tryPairQueues() {
  let paired = 0;
  const seen = new Set();
  for (const [key, q] of queues) {
    if (!q || q.length < 2) continue;
    // Drop dead sockets
    for (let i = q.length - 1; i >= 0; i--) {
      if (!q[i].ws || q[i].ws.readyState !== 1) q.splice(i, 1);
    }
    for (let i = 0; i < q.length; i++) {
      const a = q[i];
      if (!a || seen.has(a.token)) continue;
      const gapSteps = [150, 300, 600, 99999];
      const gap = gapSteps[Math.min(a.expandLevel | 0, gapSteps.length - 1)];
      for (let j = i + 1; j < q.length; j++) {
        const b = q[j];
        if (!b || seen.has(b.token)) continue;
        if (a.token === b.token) continue;
        if (a.clientId && b.clientId && a.clientId === b.clientId) continue;
        if ((a.duration || 120) !== (b.duration || 120)) continue;
        const dt = Math.abs((a.trophies | 0) - (b.trophies | 0));
        const gapB = gapSteps[Math.min(b.expandLevel | 0, gapSteps.length - 1)];
        if (dt > Math.max(gap, gapB)) continue;
        // remove both from all queues
        dequeueToken(a.token);
        dequeueToken(b.token);
        seen.add(a.token);
        seen.add(b.token);
        startRoom(a, b);
        paired++;
        break;
      }
    }
  }
  // Also cross-bucket: collect by duration
  const byDur = new Map();
  for (const q of queues.values()) {
    for (const p of q) {
      if (!p || !p.ws || p.ws.readyState !== 1) continue;
      const d = p.duration || 120;
      if (!byDur.has(d)) byDur.set(d, []);
      byDur.get(d).push(p);
    }
  }
  for (const [, list] of byDur) {
    if (list.length < 2) continue;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a || seen.has(a.token)) continue;
      const gapSteps = [150, 300, 600, 99999];
      const gap = gapSteps[Math.min(a.expandLevel | 0, gapSteps.length - 1)];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (!b || seen.has(b.token)) continue;
        if (a.clientId && b.clientId && a.clientId === b.clientId) continue;
        const dt = Math.abs((a.trophies | 0) - (b.trophies | 0));
        const gapB = gapSteps[Math.min(b.expandLevel | 0, gapSteps.length - 1)];
        if (dt > Math.max(gap, gapB)) continue;
        dequeueToken(a.token);
        dequeueToken(b.token);
        seen.add(a.token);
        seen.add(b.token);
        startRoom(a, b);
        paired++;
        break;
      }
    }
  }
  return paired;
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


  return {
    normalizePlatform,
    queueKey,
    nearbyQueueKeys,
    findMatch,
    enqueue,
    dequeueToken,
    tryPairQueues,
    startRoom,
    genPrivateCode,
    leavePrivateLobby,
    lobbySnapshot,
    tryStartPrivate
  };
};
