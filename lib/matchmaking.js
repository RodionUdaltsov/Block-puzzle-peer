/**
 * Matchmaking: ranked queue, private lobbies, startRoom.
 */
'use strict';

const { clock } = require('./clock');
const crypto = require('crypto');

function createMatchmakingApi(deps) {
  const hooks = deps.hooks;
  const log = deps.log;
  const MatchRoom = deps.MatchRoom;
  const uid = deps.uid;
  const serializePieces = deps.serializePieces || ((x) => x);
  const send = (...a) => hooks.send(...a);
  const authorizeCosmetics = (...a) => hooks.authorizeCosmetics(...a);
  const loadServerTrophies = (...a) => hooks.loadServerTrophies(...a);
  const normalizePlatform = (...a) => hooks.normalizePlatform(...a);

  function Q() { return hooks.queues; }
  function R() { return hooks.rooms; }
  function L() { return hooks.privateLobbies; }
  function pendingQueueIntents() { return hooks.pendingQueueIntents; }
  function schedulePersistMeta() {
    if (typeof hooks.schedulePersistMeta === 'function') hooks.schedulePersistMeta();
  }
  function coord() { return hooks.coord || null; }

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
  for (const k of Q().keys()) {
    if (String(k).startsWith('d' + duration + '-')) extra.push(k);
  }
  keys = keys.concat(extra.filter(k => keys.indexOf(k) < 0));

  for (const key of keys) {
    const q = Q().get(key);
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

/**
 * Enqueue for matchmaking.
 * - No Redis: local queue only (original behaviour).
 * - With Redis: write shared queue FIRST (retry 3×). Only on success add to local
 *   queue and resolve. Failure → reject so the handler does NOT send {type:"queued"}
 *   for a player invisible to other instances.
 */
async function enqueue(player) {
  const duration = player.duration || 120;
  const key = queueKey(duration, player.trophies | 0);
  if (!player.queuedAt) player.queuedAt = clock.now();

  // Strip any prior local entry for this token
  for (const q of Q().values()) {
    for (let i = q.length - 1; i >= 0; i--) {
      if (q[i].token === player.token) q.splice(i, 1);
    }
  }
  pendingQueueIntents().delete(player.token);

  const c = coord();
  if (c && c.enabled) {
    const entry = {
      token: player.token,
      duration: duration,
      trophies: player.trophies | 0,
      expandLevel: player.expandLevel | 0,
      clientId: player.clientId || null,
      name: player.name || '',
      skinId: player.skinId,
      boardId: player.boardId,
      avatarId: player.avatarId,
      avatarCustom: player.avatarCustom || '',
      platform: player.platform || 'web',
      os: player.os || 'unknown',
      friendCode: player.friendCode || null,
      queuedAt: player.queuedAt
    };
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await c.queueRemoveToken(player.token);
        await c.queueEnqueue(key, entry);
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        if (attempt < 2) {
          await new Promise((r) => clock.setTimeout(r, 50 * (attempt + 1)));
        }
      }
    }
    if (lastErr) {
      const err = new Error('queue_sync_failed');
      err.cause = lastErr;
      err.code = 'queue_sync_failed';
      throw err;
    }
  }

  // Local only after Redis success (or when Redis is off)
  if (!Q().has(key)) Q().set(key, []);
  Q().get(key).push(player);
  schedulePersistMeta();
}

function dequeueToken(token) {
  let removed = false;
  for (const q of Q().values()) {
    for (let i = q.length - 1; i >= 0; i--) {
      if (q[i].token === token) {
        q.splice(i, 1);
        removed = true;
      }
    }
  }
  if (pendingQueueIntents().has(token)) {
    pendingQueueIntents().delete(token);
    removed = true;
  }
  if (removed) schedulePersistMeta();
  const c = coord();
  if (c && c.enabled) {
    Promise.resolve(c.queueRemoveToken(token)).catch(() => {});
  }
}

async function startRoom(p1, p2, meta) {
  meta = meta || {};
  const duration = p1.duration || p2.duration || 120;
  const room = new MatchRoom(p1, p2, duration);
  room.source = meta.source || 'ranked';
  room.privateCode = meta.code || null;
  room.attach(p1.token, p1.ws);
  room.attach(p2.token, p2.ws);
  const c = coord();
  // Room ownership MUST be established before match_found is visible to clients,
  // otherwise a cross-instance match_ready can hit roomOwner() === null → no_match.
  if (c && c.enabled) {
    try {
      const claimed = await c.claimRoom(room.id);
      if (!claimed) {
        // Another instance already owns this id (extremely rare UUID collision) — abort.
        try { room.destroy && room.destroy(); } catch (_) {}
        return null;
      }
    } catch (_) {
      // Redis down: still start local room (single-instance fallback)
    }
  }

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

// 32^7 ≈ 3.4e10 combinations (was 32^5 ≈ 3.4e7). Client input allows up to 8 chars.
const PRIVATE_CODE_LEN = 7;
function genPrivateCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  // Private lobby code is a bearer invitation token: use a CSPRNG, not Math.random()
  for (let i = 0; i < PRIVATE_CODE_LEN; i++) code += alphabet[crypto.randomInt(alphabet.length)];
  return code;
}

function leavePrivateLobby(token) {
  for (const [code, lobby] of L()) {
    if (lobby.host && lobby.host.token === token) {
      if (lobby.guest && lobby.guest.ws) {
        send(lobby.guest.ws, { type: 'private_closed', code, reason: 'host_left' });
      }
      L().delete(code);
      const c = coord();
      if (c && c.enabled) Promise.resolve(c.lobbyDelete(code)).catch(() => {});
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
  // A reserved-but-unauthorized guest seat is invisible to the host until it is finalized.
  const opp = role === 'host' ? (lobby.guest && !lobby.guest.pending ? lobby.guest : null) : lobby.host;
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
    guestRtt: guest && !guest.pending && typeof guest.rtt === 'number' ? guest.rtt : null,
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
  if (!lobby || !lobby.host || !lobby.guest || lobby.guest.pending) return false;
  if (!lobby.hostReady || !lobby.guestReady) return false;
  const code = lobby.code;
  L().delete(code);
  {
    const c = coord();
    if (c && c.enabled) Promise.resolve(c.lobbyDelete(code)).catch(() => {});
  }
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
  // Fire-and-forget is no longer safe: claimRoom must complete before match_found.
  // Callers of tryStartPrivate are sync; we still await inside the promise chain.
  void startRoom(p1, p2, { source: 'lobby', code }).catch(() => {});
  return true;
}

const PRIVATE_LOBBY_TTL_MS = 30 * 60 * 1000; // 30 minutes
function startPrivateLobbySweeper() {
  clock.setInterval(() => {
    try {
      if (!L() || !L().size) return;
      const now = clock.now();
      for (const [code, lobby] of Array.from(L().entries())) {
        try {
          const created = Number(lobby && lobby.createdAt) || 0;
          const hostLive = !!(lobby && lobby.host && lobby.host.ws && lobby.host.ws.readyState === 1);
          const guestLive = !!(lobby && lobby.guest && lobby.guest.ws && lobby.guest.ws.readyState === 1);
          const stale = created && (now - created > PRIVATE_LOBBY_TTL_MS);
          const bothGone = !hostLive && !guestLive && created && (now - created > 60 * 1000);
          if (stale || bothGone) {
            if (lobby.guest && lobby.guest.ws && lobby.guest.ws.readyState === 1) {
              try { send(lobby.guest.ws, { type: 'private_closed', code, reason: 'lobby_expired' }); } catch (_) {}
            }
            if (lobby.host && lobby.host.ws && lobby.host.ws.readyState === 1) {
              try { send(lobby.host.ws, { type: 'private_closed', code, reason: 'lobby_expired' }); } catch (_) {}
            }
            L().delete(code);
          }
        } catch (_) {}
      }
    } catch (_) {}
  }, 30 * 1000);
}

  /**
   * Multi-instance match attempt: claim a remote opponent from Redis, then start
   * the room on this instance. Local findMatch remains the fast path.
   * @returns {Promise<boolean>} true if a match was started
   */
  /**
   * Authoritative match path when Redis coord is enabled.
   * Local findMatch is NOT used in multi-instance mode — only Redis claim under lock,
   * so two nodes cannot both create a room for the same pair.
   */
  async function tryMatchAcrossInstances(player) {
    const c = coord();
    if (!c || !c.enabled || !player || !player.token) return false;
    try {
      const other = await c.queueClaimPair(player);
      if (!other || !other.token) return false;
      // Drop both from every local queue (we may hold ourselves; other may be local too)
      dequeueToken(player.token);
      dequeueToken(other.token);
      // Resolve local WS if the opponent is on this same process
      let otherWs = null;
      if (c.isLocalToken && c.isLocalToken(other.token) && c.localTokens) {
        const w = c.localTokens.get(other.token);
        if (w && w.readyState === 1) otherWs = w;
      }
      if (!otherWs) {
        for (const q of Q().values()) {
          for (const e of q) {
            if (e && e.token === other.token && e.ws && e.ws.readyState === 1) {
              otherWs = e.ws;
              break;
            }
          }
          if (otherWs) break;
        }
      }
      const p2 = {
        token: other.token,
        ws: otherWs, // null → remote delivery via coord
        name: other.name || 'Игрок',
        trophies: other.trophies | 0,
        skinId: other.skinId || 'default',
        boardId: other.boardId || 'field_default',
        avatarId: other.avatarId || 'init',
        avatarCustom: other.avatarCustom || '',
        duration: other.duration || player.duration || 120,
        platform: other.platform || 'web',
        os: other.os || 'unknown',
        clientId: other.clientId || null,
        friendCode: other.friendCode || null
      };
      player.duration = player.duration || p2.duration;
      await startRoom(player, p2, { source: 'ranked', crossInstance: !otherWs });
      return true;
    } catch (e) {
      try { log('warn', 'cross-instance match failed', { err: e && e.message }); } catch (_) {}
      return false;
    }
  }

  /**
   * Single entry for "try to pair this player now".
   * - no Redis → local findMatch (original behaviour)
   * - Redis on → ONLY Redis claim (no local findMatch) to avoid dual startRoom races
   */
  async function tryClaimMatch(player) {
    const c = coord();
    if (c && c.enabled) {
      return tryMatchAcrossInstances(player);
    }
    const opp = findMatch(player);
    if (!opp) return false;
    dequeueToken(opp.token);
    dequeueToken(player.token);
    await startRoom(opp, player);
    return true;
  }

  return {
    queueKey,
    nearbyQueueKeys,
    findMatch,
    enqueue,
    dequeueToken,
    startRoom,
    genPrivateCode,
    leavePrivateLobby,
    lobbySnapshot,
    tryStartPrivate,
    startPrivateLobbySweeper,
    tryMatchAcrossInstances,
    tryClaimMatch,
    /** Persist lobby snapshot to Redis (no live ws handles). */
    syncLobbyToCoord(code, lobby) {
      const c = coord();
      if (!c || !c.enabled || !lobby) return;
      const slim = {
        code: lobby.code || code,
        duration: lobby.duration,
        hostReady: !!lobby.hostReady,
        guestReady: !!lobby.guestReady,
        createdAt: lobby.createdAt,
        host: lobby.host ? {
          token: lobby.host.token,
          name: lobby.host.name,
          trophies: lobby.host.trophies | 0,
          skinId: lobby.host.skinId,
          boardId: lobby.host.boardId,
          avatarId: lobby.host.avatarId,
          avatarCustom: lobby.host.avatarCustom || '',
          platform: lobby.host.platform,
          os: lobby.host.os,
          friendCode: lobby.host.friendCode || null,
          instanceId: c.instanceId
        } : null,
        guest: lobby.guest ? {
          token: lobby.guest.token,
          name: lobby.guest.name,
          trophies: lobby.guest.trophies | 0,
          skinId: lobby.guest.skinId,
          boardId: lobby.guest.boardId,
          avatarId: lobby.guest.avatarId,
          avatarCustom: lobby.guest.avatarCustom || '',
          platform: lobby.guest.platform,
          os: lobby.guest.os,
          friendCode: lobby.guest.friendCode || null,
          pending: !!lobby.guest.pending,
          instanceId: c.instanceId
        } : null
      };
      Promise.resolve(c.lobbySet(code, slim)).catch(() => {});
    },
    async loadLobbyFromCoord(code) {
      const c = coord();
      if (!c || !c.enabled) return null;
      return c.lobbyGet(code);
    }
  };
}

module.exports = { createMatchmakingApi };
