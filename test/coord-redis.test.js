/**
 * Multi-instance coord unit tests (no real Redis required for most cases).
 */
'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createCoord, disabledCoord, instanceId } = require('../lib/coord');
const { parseUrl, encode, RedisConn } = require('../lib/coord/redis-client');

describe('coord disabled (no REDIS_URL)', () => {
  it('disabledCoord is a safe no-op', async () => {
    const c = disabledCoord();
    assert.equal(c.enabled, false);
    assert.ok(c.instanceId);
    await c.init();
    await c.bindToken('t1', {});
    assert.equal(await c.getTokenRoute('t1'), null);
    assert.equal(await c.claimRoom('m1'), true);
    assert.equal(await c.queueClaimPair({ token: 'a', trophies: 0 }), null);
    await c.close();
  });

  it('createCoord without URL returns disabled', async () => {
    const prev = process.env.REDIS_URL;
    delete process.env.REDIS_URL;
    try {
      const c = await createCoord({});
      assert.equal(c.enabled, false);
    } finally {
      if (prev != null) process.env.REDIS_URL = prev;
    }
  });

  it('instanceId is stable when BP_INSTANCE_ID is set', () => {
    const prev = process.env.BP_INSTANCE_ID;
    process.env.BP_INSTANCE_ID = 'node-alpha';
    try {
      assert.equal(instanceId(), 'node-alpha');
    } finally {
      if (prev == null) delete process.env.BP_INSTANCE_ID;
      else process.env.BP_INSTANCE_ID = prev;
    }
  });
});

describe('redis URL parser', () => {
  it('parses host port password db', () => {
    const o = parseUrl('redis://:s3cret@redis.internal:6380/2');
    assert.equal(o.host, 'redis.internal');
    assert.equal(o.port, 6380);
    assert.equal(o.password, 's3cret');
    assert.equal(o.db, 2);
    assert.equal(o.tls, false);
  });

  it('defaults', () => {
    const o = parseUrl('redis://127.0.0.1');
    assert.equal(o.port, 6379);
    assert.equal(o.db, 0);
  });

  it('parses rediss TLS', () => {
    const o = parseUrl('rediss://:pw@example.com:6380/0');
    assert.equal(o.tls, true);
    assert.equal(o.password, 'pw');
  });
});

describe('RESP encode', () => {
  it('encodes a simple command', () => {
    const s = encode(['PING']);
    assert.equal(s, '*1\r\n$4\r\nPING\r\n');
  });
  it('encodes AUTH without re-entering connect semantics', () => {
    const s = encode(['AUTH', 'secret']);
    assert.ok(s.includes('AUTH'));
    assert.ok(s.includes('secret'));
  });
});

describe('RedisConn handshake safety', () => {
  it('_rawCommand rejects when not connected (no connect() recursion)', async () => {
    const c = new RedisConn({ host: '127.0.0.1', port: 1 });
    await assert.rejects(() => c._rawCommand(['PING']), /not connected/);
  });
});

describe('match remote-forward contract', () => {
  it('handleMatch rejects without ctx when coord disabled', () => {
    const { handleMatch } = require('../lib/ws/handlers/match');
    const sent = [];
    const shared = {
      resolveMatchCtx: () => null,
      rooms: new Map(),
      send: (ws, msg) => sent.push(msg),
      coord: { enabled: false }
    };
    const ws = { _token: 't', _matchId: null };
    assert.equal(handleMatch('place', ws, { type: 'place', pieceIdx: 0 }, shared), true);
    assert.equal(sent[0].type, 'place_reject');
  });
});

describe('tryClaimMatch single-instance path', () => {
  it('uses local findMatch when coord disabled', async () => {
    const { createMatchmakingApi } = require('../lib/matchmaking');
    const queues = new Map();
    const rooms = new Map();
    const privateLobbies = new Map();
    const pendingQueueIntents = new Map();
    const started = [];
    const FakeRoom = function (p1, p2) {
      this.id = 'm_test';
      this.players = { [p1.token]: p1, [p2.token]: p2 };
      this.attach = () => {};
      this.send = () => {};
      this.snapshotFor = (tok) => ({ me: { pieces: [] }, opp: { pieces: [] }, seat: 'a' });
      rooms.set(this.id, this);
      started.push([p1.token, p2.token]);
    };
    const api = createMatchmakingApi({
      hooks: {
        queues, rooms, privateLobbies, pendingQueueIntents,
        schedulePersistMeta: () => {},
        send: () => {},
        authorizeCosmetics: async () => ({}),
        loadServerTrophies: async () => 0,
        normalizePlatform: (p) => p || 'web',
        coord: { enabled: false }
      },
      log: () => {},
      MatchRoom: FakeRoom,
      uid: (p) => p + '_x',
      serializePieces: (x) => x
    });
    const a = { token: 'ta', ws: { readyState: 1 }, trophies: 100, duration: 120, name: 'A' };
    const b = { token: 'tb', ws: { readyState: 1 }, trophies: 110, duration: 120, name: 'B' };
    api.enqueue(a);
    const ok = await api.tryClaimMatch(b);
    assert.equal(ok, true);
    assert.equal(started.length, 1);
  });
});

describe('enqueue Redis-first (no invisible player)', () => {
  it('does not leave a local-only entry when Redis mirror fails', async () => {
    const { createMatchmakingApi } = require('../lib/matchmaking');
    const queues = new Map();
    const rooms = new Map();
    let calls = 0;
    const failingCoord = {
      enabled: true,
      instanceId: 'n1',
      async queueRemoveToken() {},
      async queueEnqueue() {
        calls++;
        throw new Error('redis down');
      },
      async queueClaimPair() { return null; }
    };
    const api = createMatchmakingApi({
      hooks: {
        queues, rooms, privateLobbies: new Map(), pendingQueueIntents: new Map(),
        schedulePersistMeta: () => {},
        send: () => {},
        authorizeCosmetics: async () => ({}),
        loadServerTrophies: async () => 0,
        normalizePlatform: (p) => p || 'web',
        coord: failingCoord
      },
      log: () => {},
      MatchRoom: function () { this.attach = () => {}; this.send = () => {}; this.snapshotFor = () => ({ me: {}, opp: {}, seat: 'a' }); },
      uid: (p) => p + '_x',
      serializePieces: (x) => x
    });
    const player = { token: 'tx', ws: { readyState: 1 }, trophies: 50, duration: 120, name: 'T' };
    await assert.rejects(() => api.enqueue(player), /queue_sync_failed/);
    assert.ok(calls >= 3, 'should retry Redis write');
    // Local queue must stay empty
    let localCount = 0;
    for (const q of queues.values()) localCount += q.length;
    assert.equal(localCount, 0);
  });
});

/**
 * Two logical "nodes" share one in-memory Redis-like queue store.
 * Proves: exactly one match when A and B claim via the same distributed path.
 */
describe('two-node claim: exactly one match', () => {
  function sharedQueueStore() {
    /** @type {Map<string, string[]>} */
    const lists = new Map();
    let lockOwner = null;
    return {
      async queueEnqueue(key, entry) {
        const k = String(key);
        if (!lists.has(k)) lists.set(k, []);
        lists.get(k).push(JSON.stringify(Object.assign({}, entry)));
      },
      async queueRemoveToken(token) {
        for (const [k, arr] of lists) {
          for (let i = arr.length - 1; i >= 0; i--) {
            try {
              if (JSON.parse(arr[i]).token === token) arr.splice(i, 1);
            } catch (_) {}
          }
        }
      },
      async queueClaimPair(player) {
        if (lockOwner) return null;
        lockOwner = player.token;
        try {
          const duration = player.duration || 120;
          let best = null;
          for (const [k, arr] of lists) {
            if (!String(k).startsWith('d' + duration + '-')) continue;
            for (const raw of arr) {
              try {
                const other = JSON.parse(raw);
                if (!other || other.token === player.token) continue;
                if (other.clientId && player.clientId && other.clientId === player.clientId) continue;
                const dt = Math.abs((other.trophies | 0) - (player.trophies | 0));
                if (dt > 99999) continue;
                if (!best || dt < best._dt) best = Object.assign({ _dt: dt }, other);
              } catch (_) {}
            }
          }
          if (!best) return null;
          await this.queueRemoveToken(player.token);
          await this.queueRemoveToken(best.token);
          delete best._dt;
          return best;
        } finally {
          lockOwner = null;
        }
      },
      lists
    };
  }

  it('A then B: exactly one startRoom', async () => {
    const { createMatchmakingApi } = require('../lib/matchmaking');
    const store = sharedQueueStore();
    const started = [];
    function makeNode(name) {
      const queues = new Map();
      const rooms = new Map();
      const FakeRoom = function (p1, p2) {
        this.id = 'm_' + started.length;
        this.attach = () => {};
        this.send = () => {};
        this.snapshotFor = () => ({ me: { pieces: [] }, opp: { pieces: [] }, seat: 'a' });
        rooms.set(this.id, this);
        started.push({ node: name, a: p1.token, b: p2.token });
      };
      const coord = {
        enabled: true,
        instanceId: name,
        localTokens: new Map(),
        isLocalToken(t) { return this.localTokens.has(t); },
        queueEnqueue: (...a) => store.queueEnqueue(...a),
        queueRemoveToken: (...a) => store.queueRemoveToken(...a),
        queueClaimPair: (...a) => store.queueClaimPair(...a),
        claimRoom: async () => true
      };
      const api = createMatchmakingApi({
        hooks: {
          queues, rooms, privateLobbies: new Map(), pendingQueueIntents: new Map(),
          schedulePersistMeta: () => {},
          send: () => {},
          authorizeCosmetics: async () => ({}),
          loadServerTrophies: async () => 0,
          normalizePlatform: (p) => p || 'web',
          coord
        },
        log: () => {},
        MatchRoom: FakeRoom,
        uid: (p) => p + '_' + name,
        serializePieces: (x) => x
      });
      return { api, coord, queues };
    }
    const nodeA = makeNode('A');
    const nodeB = makeNode('B');
    const pA = { token: 'tokA', ws: { readyState: 1 }, trophies: 100, duration: 120, name: 'Alice' };
    const pB = { token: 'tokB', ws: { readyState: 1 }, trophies: 105, duration: 120, name: 'Bob' };
    nodeA.coord.localTokens.set('tokA', pA.ws);
    nodeB.coord.localTokens.set('tokB', pB.ws);

    // A joins: claim empty → enqueue into shared store
    assert.equal(await nodeA.api.tryClaimMatch(pA), false);
    await nodeA.api.enqueue(pA);

    // B joins: claim finds A → one room
    assert.equal(await nodeB.api.tryClaimMatch(pB), true);
    assert.equal(started.length, 1, 'exactly one match');
    assert.equal(started[0].node, 'B');

    // A tries again — should not create a second room
    assert.equal(await nodeA.api.tryClaimMatch(pA), false);
    assert.equal(started.length, 1);
  });

  it('claimRoom resolves before any match_found is sent', async () => {
    const { createMatchmakingApi } = require('../lib/matchmaking');
    const order = [];
    let claimDelayResolve;
    const claimDelay = new Promise((r) => { claimDelayResolve = r; });
    const sent = [];
    const rooms = new Map();
    const FakeRoom = function (p1, p2) {
      this.id = 'room_claim_order';
      this.duration = 120;
      this.source = 'ranked';
      this.privateCode = null;
      this.clockEndTs = 0;
      this.attach = () => {};
      this.send = (token, msg) => {
        order.push('send:' + msg.type);
        sent.push({ token, msg });
      };
      this.snapshotFor = () => ({
        me: { pieces: [] },
        opp: { pieces: [] },
        seat: 'a'
      });
      rooms.set(this.id, this);
    };
    const coord = {
      enabled: true,
      instanceId: 'owner',
      async claimRoom(id) {
        order.push('claim:start');
        await claimDelay;
        order.push('claim:done');
        return true;
      },
      async queueEnqueue() {},
      async queueRemoveToken() {},
      async queueClaimPair() { return null; }
    };
    const api = createMatchmakingApi({
      hooks: {
        queues: new Map(),
        rooms,
        privateLobbies: new Map(),
        pendingQueueIntents: new Map(),
        schedulePersistMeta: () => {},
        send: () => {},
        authorizeCosmetics: async () => ({}),
        loadServerTrophies: async () => 0,
        normalizePlatform: (p) => p || 'web',
        coord
      },
      log: () => {},
      MatchRoom: FakeRoom,
      uid: (p) => p + '_x',
      serializePieces: (x) => x || []
    });
    const p1 = {
      token: 't1', ws: { readyState: 1 }, trophies: 10, duration: 120,
      name: 'P1', platform: 'web', os: 'unknown'
    };
    const p2 = {
      token: 't2', ws: { readyState: 1 }, trophies: 12, duration: 120,
      name: 'P2', platform: 'web', os: 'unknown'
    };
    const startP = api.startRoom(p1, p2, { source: 'ranked' });
    // While claim is pending, no match_found must have been sent
    await new Promise((r) => setImmediate(r));
    assert.ok(order.includes('claim:start'));
    assert.ok(!order.some((x) => x.startsWith('send:')), 'no client messages before claim finishes');
    claimDelayResolve();
    await startP;
    assert.ok(order.indexOf('claim:done') < order.indexOf('send:match_found') ||
      order.filter((x) => x === 'send:match_found').length >= 1);
    const claimIdx = order.indexOf('claim:done');
    const firstSend = order.findIndex((x) => x.startsWith('send:'));
    assert.ok(claimIdx >= 0 && firstSend >= 0 && claimIdx < firstSend,
      'claimRoom must complete before match_found: ' + order.join(','));
    assert.ok(sent.some((s) => s.msg.type === 'match_found'));
  });
});

describe('Redis lock release (atomic compare-and-delete)', () => {
  it('source uses Lua EVAL for lock/room release (not GET+DEL)', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '../lib/coord/index.js'), 'utf8');
    assert.match(src, /LUA_COMPARE_AND_DEL/);
    assert.match(src, /redis\.call\("GET", KEYS\[1\]\) == ARGV\[1\]/);
    assert.match(src, /redis\.call\("DEL", KEYS\[1\]\)/);
    // queueClaimPair must not use non-atomic GET then DEL on lockKey
    const claimBody = src.slice(src.indexOf('async function queueClaimPair'), src.indexOf('async function lobbySet'));
    assert.ok(claimBody.includes('compareAndDel'), 'queueClaimPair releases via compareAndDel');
    assert.ok(!/await cmd\.get\(lockKey\)[\s\S]*cmd\.del\(lockKey\)/.test(claimBody),
      'queueClaimPair must not GET+DEL lock non-atomically');
    const relBody = src.slice(src.indexOf('async function releaseRoom'), src.indexOf('async function queueEnqueue'));
    assert.ok(relBody.includes('compareAndDel'), 'releaseRoom uses compareAndDel');
  });

  it('MM_LOCK_TTL is at least 30 seconds', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '../lib/coord/index.js'), 'utf8');
    const m = src.match(/MM_LOCK_TTL\s*=\s*(\d+)/);
    assert.ok(m, 'MM_LOCK_TTL constant present');
    assert.ok(Number(m[1]) >= 30, 'TTL >= 30');
  });
});

const HAS_REDIS = !!process.env.REDIS_URL;

describe('Redis lock release live (requires REDIS_URL)', { skip: !HAS_REDIS }, () => {
  it('compare-and-delete does not remove a re-acquired lock', async () => {
    const { createCoord } = require('../lib/coord');
    const prev = process.env.BP_INSTANCE_ID;
    process.env.BP_INSTANCE_ID = 'lock-test-a';
    let a;
    try {
      a = await createCoord({ url: process.env.REDIS_URL });
      await a.init();
      const cmd = a._cmd || null;
      // Exercise via queueClaimPair path: hold lock briefly by using empty snapshot
      // Direct EVAL test through redis client
      const { createRedis } = require('../lib/coord/redis-client');
      const r = createRedis(process.env.REDIS_URL);
      await r.connect();
      const key = 'bp:test:lock:cad';
      const tokenA = 'tok_a_' + Date.now();
      const tokenB = 'tok_b_' + Date.now();
      await r.cmd('SET', key, tokenA, 'EX', '5');
      // Simulate expire + reacquire by B
      await r.cmd('SET', key, tokenB, 'EX', '5');
      // A tries atomic release with stale token — must not delete B's lock
      const lua = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;
      const delA = await r.eval(lua, [key], [tokenA]);
      assert.equal(Number(delA), 0, 'stale token must not delete');
      const still = await r.get(key);
      assert.equal(still, tokenB, 'B lock remains');
      // B releases successfully
      const delB = await r.eval(lua, [key], [tokenB]);
      assert.equal(Number(delB), 1);
      assert.equal(await r.get(key), null);
      await r.quit();
    } finally {
      if (prev == null) delete process.env.BP_INSTANCE_ID;
      else process.env.BP_INSTANCE_ID = prev;
      try { if (a && a.close) await a.close(); } catch (_) {}
    }
  });
});

describe('queueClaimPair lost-lock abort', () => {
  it('source commits claim via atomic Lua (lock check + dual remove)', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '../lib/coord/index.js'), 'utf8');
    assert.match(src, /LUA_CLAIM_REMOVE_PAIR/);
    const body = src.slice(src.indexOf('async function queueClaimPair'), src.indexOf('async function lobbySet'));
    assert.ok(body.includes('LUA_CLAIM_REMOVE_PAIR'), 'claim uses atomic Lua commit');
    assert.ok(
      !/await queueRemoveToken\(player\.token\)[\s\S]*await queueRemoveToken\(best\.token\)/.test(body),
      'must not use sequential queueRemoveToken for claim commit'
    );
  });
});

describe('queueClaimPair lost-lock live (requires REDIS_URL)', { skip: !HAS_REDIS }, () => {
  it('aborts claim without removing queue entries when lock was stolen', async () => {
    const { createCoord } = require('../lib/coord');
    const { createRedis } = require('../lib/coord/redis-client');
    const prev = process.env.BP_INSTANCE_ID;
    process.env.BP_INSTANCE_ID = 'lost-lock-a';
    let coord;
    const r = createRedis(process.env.REDIS_URL);
    await r.connect();
    try {
      coord = await createCoord({ url: process.env.REDIS_URL });
      await coord.init();
      const duration = 177;
      const pTok = 'plost_' + Date.now();
      const oTok = 'olost_' + Date.now();
      await coord.queueEnqueue('d' + duration + '-b0', {
        token: pTok, trophies: 10, duration, name: 'P'
      });
      await coord.queueEnqueue('d' + duration + '-b0', {
        token: oTok, trophies: 12, duration, name: 'O'
      });

      const claimed = await coord.queueClaimPair(
        { token: pTok, trophies: 10, duration, expandLevel: 0 },
        {
          afterSnapshot: async ({ lockKey }) => {
            // Simulate lock expiry + reacquire by another instance
            await r.cmd('SET', lockKey, 'stolen_by_other', 'EX', '30');
          }
        }
      );
      assert.equal(claimed, null, 'must abort when lock was stolen');

      const snap = await coord.queueSnapshot(duration);
      const tokens = snap.map((e) => e.token);
      assert.ok(tokens.includes(pTok), 'player still queued');
      assert.ok(tokens.includes(oTok), 'opponent still queued');
    } finally {
      try { await r.cmd('DEL', 'bp:mm:lock:177'); } catch (_) {}
      try { await r.quit(); } catch (_) {}
      if (prev == null) delete process.env.BP_INSTANCE_ID;
      else process.env.BP_INSTANCE_ID = prev;
      try { if (coord && coord.close) await coord.close(); } catch (_) {}
    }
  });
});
