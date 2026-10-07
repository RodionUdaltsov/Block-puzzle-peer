/**
 * Multi-instance coordination via Redis.
 *
 * When REDIS_URL is unset the module returns a disabled coord (all methods no-op /
 * local-only), so single-instance deployments and tests stay unchanged.
 *
 * Responsibilities:
 *   - instance identity + heartbeat
 *   - token → instance routing (where is this player's WS?)
 *   - room → owner instance
 *   - shared ranked queues (JSON entries without live ws)
 *   - shared private lobbies
 *   - pub/sub delivery of outbound messages to a remote player's instance
 *
 * MatchRoom game state stays in-process on the owner instance. Cross-instance
 * place/ready/… messages are forwarded to the owner over Redis and replies
 * come back via the token→instance route.
 */
'use strict';

const crypto = require('crypto');
const { clock } = require('../clock');
const { createRedis } = require('./redis-client');

const PREFIX = 'bp:';
const TOKEN_TTL = 3600;
const ROOM_TTL = 7200;
const LOBBY_TTL = 1800;
const QUEUE_TTL = 120;
const INST_TTL = 30;

function instanceId() {
  const env = process.env.BP_INSTANCE_ID;
  if (env) return String(env).slice(0, 64);
  return 'i_' + crypto.randomBytes(6).toString('hex');
}

function disabledCoord() {
  return {
    enabled: false,
    instanceId: instanceId(),
    async init() { return this; },
    async close() {},
    async bindToken() {},
    async unbindToken() {},
    async getTokenRoute() { return null; },
    async claimRoom() { return true; },
    async roomOwner() { return null; },
    async releaseRoom() {},
    async queueEnqueue() {},
    async queueRemoveToken() { return false; },
    async queueSnapshot() { return []; },
    async queueClaimPair() { return null; },
    async lobbySet() {},
    async lobbyGet() { return null; },
    async lobbyDelete() {},
    async publishToToken() { return false; },
    async publishToInstance() {},
    async publishRoomForward() {},
    onDeliver() {},
    onRoomForward() {},
    isLocalToken() { return true; }
  };
}

/**
 * @param {{ url?: string, log?: Function }} opts
 */
async function createCoord(opts) {
  opts = opts || {};
  const url = opts.url || process.env.REDIS_URL || '';
  if (!url) return disabledCoord();

  const log = typeof opts.log === 'function' ? opts.log : () => {};
  const id = instanceId();
  const cmd = createRedis(url);
  let sub = createRedis(url, { reconnect: false });
  /** @type {Map<string, any>} local token → ws (this process only) */
  const localTokens = new Map();
  let deliverHandler = null;
  let roomForwardHandler = null;
  let heartbeatTimer = null;
  let closed = false;

  const chInst = PREFIX + 'inst:' + id;
  const chRoom = PREFIX + 'roomfwd';

  let subReconnectTimer = null;
  let subReconnectAttempt = 0;
  let subMessageBound = false;

  function handleSubMessage(channel, payload) {
    let msg;
    try { msg = JSON.parse(payload); } catch (_) { return; }
    if (channel === chInst && deliverHandler) {
      try { deliverHandler(msg); } catch (e) { log('warn', 'coord deliver failed', { err: e && e.message }); }
    }
    if (channel === chRoom && msg && msg.ownerId === id && roomForwardHandler) {
      try { roomForwardHandler(msg); } catch (e) { log('warn', 'coord room-forward failed', { err: e && e.message }); }
    }
  }

  async function setupSubscriber() {
    // Fresh connection each time (old socket is dead after disconnect)
    if (sub && typeof sub.quit === 'function') {
      try { await sub.quit(); } catch (_) {}
    }
    const { createRedis } = require('./redis-client');
    sub = createRedis(url, { reconnect: false });
    await sub.connect();
    if (!subMessageBound) {
      // bind once per logical sub object — re-bind after recreate
    }
    sub.on('message', handleSubMessage);
    sub.on('close', () => {
      if (closed) return;
      log('warn', 'coord subscriber disconnected — reconnecting');
      scheduleSubReconnect();
    });
    await sub.subscribe(chInst, chRoom);
    subReconnectAttempt = 0;
    log('info', 'coord subscriber ready', { channels: [chInst, chRoom] });
  }

  function scheduleSubReconnect() {
    if (closed || subReconnectTimer) return;
    subReconnectAttempt += 1;
    const delay = Math.min(30000, 250 * Math.pow(2, Math.min(subReconnectAttempt - 1, 8)));
    subReconnectTimer = clock.setTimeout(() => {
      subReconnectTimer = null;
      setupSubscriber().catch((e) => {
        log('warn', 'coord subscriber reconnect failed', { err: e && e.message, attempt: subReconnectAttempt });
        scheduleSubReconnect();
      });
    }, delay);
  }

  async function init() {
    await cmd.connect();
    await setupSubscriber();
    await cmd.set(PREFIX + 'instalive:' + id, String(clock.now()), 'EX', INST_TTL);
    heartbeatTimer = clock.setInterval(() => {
      if (closed) return;
      cmd.set(PREFIX + 'instalive:' + id, String(clock.now()), 'EX', INST_TTL).catch(() => {});
    }, 10000);
    try { if (heartbeatTimer && heartbeatTimer.unref) heartbeatTimer.unref(); } catch (_) {}
    log('info', 'redis coord online', { instanceId: id });
    return api;
  }

  async function close() {
    closed = true;
    try { if (subReconnectTimer) clock.clearTimeout(subReconnectTimer); } catch (_) {}
    subReconnectTimer = null;
    try { if (heartbeatTimer) clock.clearInterval(heartbeatTimer); } catch (_) {}
    try { await cmd.del(PREFIX + 'instalive:' + id); } catch (_) {}
    try { await sub.quit(); } catch (_) {}
    try { await cmd.quit(); } catch (_) {}
  }

  function trackLocal(token, ws) {
    if (token) localTokens.set(String(token), ws || true);
  }
  function untrackLocal(token) {
    if (token) localTokens.delete(String(token));
  }
  function isLocalToken(token) {
    return localTokens.has(String(token));
  }

  async function bindToken(token, meta) {
    if (!token) return;
    trackLocal(token, meta && meta.ws);
    const key = PREFIX + 'tok:' + token;
    await cmd.hset(key, {
      instanceId: id,
      friendCode: (meta && meta.friendCode) || '',
      boundAt: String(clock.now())
    });
    await cmd.expire(key, TOKEN_TTL);
  }

  async function unbindToken(token) {
    if (!token) return;
    untrackLocal(token);
    const key = PREFIX + 'tok:' + token;
    const owner = await cmd.hget(key, 'instanceId');
    if (owner === id) await cmd.del(key);
  }

  async function getTokenRoute(token) {
    if (!token) return null;
    const h = await cmd.hgetall(PREFIX + 'tok:' + token);
    if (!h || !h.instanceId) return null;
    return h;
  }

  async function claimRoom(matchId) {
    const key = PREFIX + 'room:' + matchId;
    // SET NX EX
    const r = await cmd.cmd('SET', key, id, 'EX', String(ROOM_TTL), 'NX');
    if (r === 'OK') return true;
    const cur = await cmd.get(key);
    return cur === id;
  }

  async function roomOwner(matchId) {
    return cmd.get(PREFIX + 'room:' + matchId);
  }

  async function releaseRoom(matchId) {
    const key = PREFIX + 'room:' + matchId;
    const cur = await cmd.get(key);
    if (cur === id) await cmd.del(key);
  }

  async function queueEnqueue(queueKey, entry) {
    const key = PREFIX + 'q:' + queueKey;
    const payload = JSON.stringify(Object.assign({}, entry, {
      instanceId: id,
      queuedAt: entry.queuedAt || clock.now()
    }));
    // Remove any previous entry for this token across all duration queues would be expensive;
    // callers should queueRemoveToken first.
    await cmd.rpush(key, payload);
    await cmd.expire(key, QUEUE_TTL);
  }

  async function queueRemoveToken(token) {
    // Scan known pattern via a side index of active queue keys
    const indexKey = PREFIX + 'qindex';
    let keys = [];
    try {
      const raw = await cmd.get(indexKey);
      if (raw) keys = JSON.parse(raw);
    } catch (_) { keys = []; }
    let removed = false;
    for (const qk of keys) {
      const key = PREFIX + 'q:' + qk;
      const items = await cmd.lrange(key, 0, -1);
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        try {
          const e = JSON.parse(item);
          if (e && e.token === token) {
            await cmd.lrem(key, 0, item);
            removed = true;
          }
        } catch (_) {}
      }
    }
    return removed;
  }

  async function _rememberQueueKey(queueKey) {
    const indexKey = PREFIX + 'qindex';
    let keys = [];
    try {
      const raw = await cmd.get(indexKey);
      if (raw) keys = JSON.parse(raw);
    } catch (_) {}
    if (!keys.includes(queueKey)) {
      keys.push(queueKey);
      if (keys.length > 200) keys = keys.slice(-150);
      await cmd.set(indexKey, JSON.stringify(keys), 'EX', 600);
    }
  }

  async function queueSnapshot(duration) {
    const indexKey = PREFIX + 'qindex';
    let keys = [];
    try {
      const raw = await cmd.get(indexKey);
      if (raw) keys = JSON.parse(raw);
    } catch (_) {}
    const out = [];
    for (const qk of keys) {
      if (duration != null && !String(qk).startsWith('d' + duration + '-')) continue;
      const items = await cmd.lrange(PREFIX + 'q:' + qk, 0, -1);
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        try {
          const e = JSON.parse(item);
          if (e && e.token) out.push(Object.assign({ _raw: item, _qkey: qk }, e));
        } catch (_) {}
      }
    }
    return out;
  }

  /**
   * Atomically claim a compatible opponent for `player` under a short distributed lock.
   * Returns the opponent entry (without ws) or null.
   */
  async function queueClaimPair(player, opts) {
    opts = opts || {};
    const gapSteps = opts.gapSteps || [150, 300, 600, 99999];
    const gap = gapSteps[Math.min(player.expandLevel | 0, gapSteps.length - 1)];
    const duration = player.duration || 120;
    const lockKey = PREFIX + 'mm:lock:' + duration;
    // Simple lock
    const got = await cmd.cmd('SET', lockKey, id, 'EX', '3', 'NX');
    if (got !== 'OK') return null;
    try {
      const candidates = await queueSnapshot(duration);
      let best = null;
      for (const other of candidates) {
        if (!other || other.token === player.token) continue;
        if (other.clientId && player.clientId && other.clientId === player.clientId) continue;
        const dt = Math.abs((other.trophies | 0) - (player.trophies | 0));
        if (dt > gap) continue;
        // Prefer closer trophies
        if (!best || dt < best._dt) best = Object.assign({ _dt: dt }, other);
      }
      if (!best) return null;
      // Remove both from queues
      await queueRemoveToken(player.token);
      await queueRemoveToken(best.token);
      delete best._raw;
      delete best._qkey;
      delete best._dt;
      return best;
    } finally {
      const cur = await cmd.get(lockKey);
      if (cur === id) await cmd.del(lockKey);
    }
  }

  async function lobbySet(code, data) {
    const key = PREFIX + 'lobby:' + String(code).toUpperCase();
    await cmd.set(key, JSON.stringify(data), 'EX', LOBBY_TTL);
  }

  async function lobbyGet(code) {
    const raw = await cmd.get(PREFIX + 'lobby:' + String(code).toUpperCase());
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (_) { return null; }
  }

  async function lobbyDelete(code) {
    await cmd.del(PREFIX + 'lobby:' + String(code).toUpperCase());
  }

  async function publishToInstance(targetId, payload) {
    if (!targetId || targetId === id) return;
    await cmd.publish(PREFIX + 'inst:' + targetId, JSON.stringify(payload));
  }

  /**
   * Deliver an outbound WS message to the instance that currently owns the token.
   * Returns true if published remotely, false if caller should send locally.
   */
  async function publishToToken(token, message) {
    if (!token) return false;
    if (isLocalToken(token)) return false;
    const route = await getTokenRoute(token);
    if (!route || !route.instanceId || route.instanceId === id) return false;
    await publishToInstance(route.instanceId, {
      kind: 'deliver',
      token: String(token),
      message
    });
    return true;
  }

  async function publishRoomForward(ownerId, payload) {
    if (!ownerId) return;
    await cmd.publish(chRoom, JSON.stringify(Object.assign({ ownerId }, payload)));
  }

  const api = {
    enabled: true,
    instanceId: id,
    init,
    close,
    bindToken,
    unbindToken,
    getTokenRoute,
    claimRoom,
    roomOwner,
    releaseRoom,
    queueEnqueue: async (qk, entry) => {
      await _rememberQueueKey(qk);
      // strip non-serializable
      const clean = Object.assign({}, entry);
      delete clean.ws;
      await queueEnqueue(qk, clean);
    },
    queueRemoveToken,
    queueSnapshot,
    queueClaimPair,
    lobbySet,
    lobbyGet,
    lobbyDelete,
    publishToToken,
    publishToInstance,
    publishRoomForward,
    onDeliver(fn) { deliverHandler = fn; },
    onRoomForward(fn) { roomForwardHandler = fn; },
    isLocalToken,
    trackLocal,
    untrackLocal,
    localTokens
  };
  return api;
}

module.exports = { createCoord, disabledCoord, instanceId };
