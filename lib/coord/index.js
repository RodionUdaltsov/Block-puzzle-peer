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
/** Matchmaking claim lock TTL — covers multi-round-trip queueSnapshot + removes. */
const MM_LOCK_TTL = 30;
/**
 * Atomic compare-and-delete (only DEL if value matches).
 * Prevents the classic GET→expire→reacquire→DEL race of a non-atomic release.
 */
const LUA_COMPARE_AND_DEL = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;
/**
 * Atomic claim commit under matchmaking lock:
 *   1) verify lock token still owned
 *   2) remove player + opponent from every queue listed in qindex
 *   3) return 1 only if opponent was present and removed
 *
 * Closes the TOCTOU window between stillOwnsLock() and dual queueRemoveToken,
 * and the partial-remove case (A gone, B left).
 *
 * KEYS[1]=lockKey  KEYS[2]=qindex
 * ARGV[1]=lockToken  ARGV[2]=playerToken  ARGV[3]=opponentToken  ARGV[4]=listPrefix (e.g. bp:q:)
 */
const LUA_CLAIM_REMOVE_PAIR = `
local cur = redis.call("GET", KEYS[1])
if cur ~= ARGV[1] then
  return 0
end
local qkeys = redis.call("SMEMBERS", KEYS[2])
local prefix = ARGV[4]
local pTok = ARGV[2]
local oTok = ARGV[3]
local removedP = 0
local removedO = 0
for i = 1, #qkeys do
  local listKey = prefix .. qkeys[i]
  local items = redis.call("LRANGE", listKey, 0, -1)
  for j = 1, #items do
    local item = items[j]
    local tok = nil
    -- Prefer cjson (built into Redis) over fragile regex JSON scraping
    local ok, decoded = pcall(cjson.decode, item)
    if ok and type(decoded) == "table" and decoded.token then
      tok = tostring(decoded.token)
    else
      tok = string.match(item, '"token"%s*:%s*"([^"]+)"')
    end
    if tok == pTok then
      redis.call("LREM", listKey, 0, item)
      removedP = 1
    elseif tok == oTok then
      redis.call("LREM", listKey, 0, item)
      removedO = 1
    end
  end
end
if removedO == 1 then
  return 1
end
return 0
`;

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

  async function compareAndDel(key, expected) {
    if (!key || expected == null) return 0;
    try {
      return await cmd.eval(LUA_COMPARE_AND_DEL, [key], [String(expected)]);
    } catch (_) {
      return 0;
    }
  }

  async function releaseRoom(matchId) {
    const key = PREFIX + 'room:' + matchId;
    // Atomic: only delete if we still own the room (no GET/DEL race)
    await compareAndDel(key, id);
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
    // Scan known pattern via a side index of active queue keys (Redis Set — race-free)
    const indexKey = PREFIX + 'qindex';
    let keys = [];
    try {
      keys = await cmd.smembers(indexKey);
      if (!Array.isArray(keys)) keys = [];
    } catch (_) { keys = []; }
    // Legacy: if key is still a JSON string, migrate once
    if (!keys.length) {
      try {
        const raw = await cmd.get(indexKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length) {
            keys = parsed;
            await cmd.del(indexKey);
            if (keys.length) {
              await cmd.sadd(indexKey, ...keys);
              await cmd.expire(indexKey, 600);
            }
          }
        }
      } catch (_) {}
    }
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
    // Atomic set membership — no lost-update race
    await cmd.sadd(indexKey, queueKey);
    await cmd.expire(indexKey, 600);
  }

  async function queueSnapshot(duration) {
    const indexKey = PREFIX + 'qindex';
    let keys = [];
    try {
      keys = await cmd.smembers(indexKey);
      if (!Array.isArray(keys)) keys = [];
    } catch (_) { keys = []; }
    // Legacy JSON fallback (one-shot migration path)
    if (!keys.length) {
      try {
        const raw = await cmd.get(indexKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) keys = parsed;
        }
      } catch (_) {}
    }
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
   *
   * Lock uses a unique per-invocation token + atomic Lua compare-and-delete on release
   * so a slow holder cannot DEL a lock re-acquired by another instance.
   */
  async function queueClaimPair(player, opts) {
    opts = opts || {};
    const gapSteps = opts.gapSteps || [150, 300, 600, 99999];
    const gap = gapSteps[Math.min(player.expandLevel | 0, gapSteps.length - 1)];
    const duration = player.duration || 120;
    const lockKey = PREFIX + 'mm:lock:' + duration;
    const lockToken = crypto.randomBytes(16).toString('hex');
    // Unique token + TTL covering multi-round-trip queueSnapshot / removes
    const got = await cmd.cmd('SET', lockKey, lockToken, 'EX', String(MM_LOCK_TTL), 'NX');
    if (got !== 'OK') return null;
    // Periodic renew while the claim runs (every ~1/3 of TTL) so a slow
    // snapshot/remove path cannot expire the lock mid-operation.
    // Failed renewals are counted; before mutating queues we re-check ownership
    // so a claim that lost the lock aborts without queueRemoveToken.
    const LUA_RENEW =
      `if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("EXPIRE", KEYS[1], ARGV[2]) end return 0`;
    let renewTimer = null;
    try {
      try {
        const renewEveryMs = Math.max(1000, Math.floor(MM_LOCK_TTL * 1000 / 3));
        renewTimer = clock.setInterval(() => {
          cmd.eval(LUA_RENEW, [lockKey], [lockToken, String(MM_LOCK_TTL)])
            .catch(() => {});
        }, renewEveryMs);
        if (renewTimer && renewTimer.unref) renewTimer.unref();
      } catch (_) {}
      const candidates = await queueSnapshot(duration);
      // Test/chaos hook: run after snapshot, before ownership check (e.g. steal lock).
      if (typeof opts.afterSnapshot === 'function') {
        try { await opts.afterSnapshot({ lockKey, lockToken, duration }); } catch (_) {}
      }
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
      // Atomic: re-check lock ownership AND remove both tokens in one Redis EVAL.
      // Prevents (1) lock loss between GET and remove, (2) partial remove of only one player.
      let committed = 0;
      try {
        committed = await cmd.eval(
          LUA_CLAIM_REMOVE_PAIR,
          [lockKey, PREFIX + 'qindex'],
          [lockToken, String(player.token), String(best.token), PREFIX + 'q:']
        );
      } catch (_) {
        committed = 0;
      }
      if (Number(committed) !== 1) return null;
      delete best._raw;
      delete best._qkey;
      delete best._dt;
      return best;
    } finally {
      try { if (renewTimer) clock.clearInterval(renewTimer); } catch (_) {}
      // Atomic compare-and-delete — single Redis round-trip, no GET/DEL race
      await compareAndDel(lockKey, lockToken);
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
