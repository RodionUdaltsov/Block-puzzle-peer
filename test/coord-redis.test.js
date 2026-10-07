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
});
