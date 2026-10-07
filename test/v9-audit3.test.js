/**
 * Third-audit regressions: join_private TOCTOU (two joiners, one seat), pending-seat visibility,
 * self-join not destroying the lobby, lobby avatar memory budget.
 */
'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

function loadFresh(mod) {
  const p = require.resolve(mod);
  delete require.cache[p];
  return require(mod);
}

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

const { createMatchmakingApi } = require('../lib/matchmaking.js');
const realSnapshot = createMatchmakingApi({ hooks: {}, clock: require('../lib/clock').clock }).lobbySnapshot;

function makeShared(overrides) {
  const privateLobbies = new Map();
  const sent = [];
  const shared = {
    authorizeCosmetics: async (fc, skinId, boardId) => ({ skinId, boardId }),
    dequeueToken: () => {},
    genPrivateCode: () => require('crypto').randomBytes(4).toString('hex').toUpperCase(),
    // Mirrors lib/matchmaking.js: host leaving closes the lobby, guest leaving frees the seat.
    leavePrivateLobby: (token) => {
      for (const [code, l] of privateLobbies) {
        if (l.host && l.host.token === token) { privateLobbies.delete(code); return code; }
        if (l.guest && l.guest.token === token) {
          l.guest = null; l.hostReady = false; l.guestReady = false; return code;
        }
      }
      return null;
    },
    loadServerTrophies: async () => 0,
    lobbySnapshot: realSnapshot,
    normalizePlatform: (p) => String(p || 'web'),
    privateLobbies,
    rooms: new Map(),
    send: (ws, msg) => { sent.push({ ws, msg }); },
    tryStartPrivate: () => {}
  };
  return { shared: Object.assign(shared, overrides || {}), privateLobbies, sent };
}

function fakeWs(i, ip) {
  return { _token: 't' + i, _ip: ip || '10.1.0.' + (i % 250), readyState: 1, _matchId: null };
}

const tick = () => new Promise((r) => setImmediate(r));

async function makeHostedLobby(h, host) {
  h.handle('create_private', host, { name: 'Host' }, h.shared);
  await tick(); await tick();
  const code = Array.from(h.privateLobbies.keys())[0];
  h.sent.length = 0;
  return code;
}

describe('join_private: seat reservation (TOCTOU)', () => {
  it('two simultaneous joiners: exactly one guest, exactly one success, one "full"', async () => {
    const { handlePrivateLobby } = loadFresh('../lib/ws/handlers/private-lobby');
    const gate = deferred();
    const { shared, privateLobbies, sent } = makeShared({
      authorizeCosmetics: async (fc, s, b) => { await gate.promise; return { skinId: s, boardId: b }; }
    });
    const h = { handle: handlePrivateLobby, shared, privateLobbies, sent };
    const host = fakeWs(1);
    const code = await (async () => {
      h.handle('create_private', host, { name: 'Host' }, shared);
      gate.resolve(); await tick(); await tick();
      return Array.from(privateLobbies.keys())[0];
    })();
    sent.length = 0;

    // From here on every authorization hangs until released.
    const gate2 = deferred();
    shared.authorizeCosmetics = async (fc, s, b) => { await gate2.promise; return { skinId: s, boardId: b }; };

    const A = fakeWs(2, '2.2.2.2');
    const B = fakeWs(3, '3.3.3.3');
    handlePrivateLobby('join_private', A, { code, name: 'A' }, shared);
    handlePrivateLobby('join_private', B, { code, name: 'B' }, shared); // before A's awaits resolve
    const lobby = privateLobbies.get(code);
    assert.equal(lobby.guest.token, 't2', 'A holds the seat synchronously');
    assert.equal(B._privateCode, undefined, 'B never got a seat');

    gate2.resolve();
    await tick(); await tick(); await tick();

    assert.equal(lobby.guest.token, 't2', 'A is still the one and only guest');
    assert.equal(lobby.guest.pending, false);
    const toB = sent.filter((s) => s.ws === B);
    assert.equal(toB.length, 1);
    assert.equal(toB[0].msg.type, 'private_error');
    assert.equal(toB[0].msg.reason, 'full');
    const successes = sent.filter((s) => s.msg.type === 'private_lobby' && s.msg.role === 'guest');
    assert.equal(successes.length, 1, 'exactly one successful join');
    assert.equal(successes[0].ws, A);
  });

  it('seat is held while authorization is in flight and hidden from the host', async () => {
    const { handlePrivateLobby } = loadFresh('../lib/ws/handlers/private-lobby');
    const { shared, privateLobbies, sent } = makeShared();
    const h = { handle: handlePrivateLobby, shared, privateLobbies, sent };
    const code = await makeHostedLobby(h, fakeWs(1));
    const gate = deferred();
    shared.authorizeCosmetics = async (fc, s, b) => { await gate.promise; return { skinId: s, boardId: b }; };
    const G = fakeWs(2);
    handlePrivateLobby('join_private', G, { code, name: 'G', skinId: 'evil_skin' }, shared);
    const lobby = privateLobbies.get(code);
    assert.equal(lobby.guest.pending, true);
    assert.equal(lobby.guest.skinId, 'default', 'unauthorized skin is never exposed');
    assert.equal(realSnapshot(lobby, 'host').opp, null, 'host does not see a pending guest');
    // a pending guest cannot ready up
    handlePrivateLobby('private_ready', G, { code, ready: true }, shared);
    assert.equal(lobby.guestReady, false);
    gate.resolve(); await tick(); await tick(); await tick();
    assert.equal(lobby.guest.pending, false);
    assert.equal(lobby.guest.skinId, 'evil_skin'); // the stub authorizer accepted it
    assert.ok(realSnapshot(lobby, 'host').opp);
  });

  it('a guest who leaves during authorization does not come back as a ghost', async () => {
    const { handlePrivateLobby } = loadFresh('../lib/ws/handlers/private-lobby');
    const { shared, privateLobbies, sent } = makeShared();
    const h = { handle: handlePrivateLobby, shared, privateLobbies, sent };
    const code = await makeHostedLobby(h, fakeWs(1));
    const gate = deferred();
    shared.authorizeCosmetics = async (fc, s, b) => { await gate.promise; return { skinId: s, boardId: b }; };
    const G = fakeWs(2);
    handlePrivateLobby('join_private', G, { code, name: 'G' }, shared);
    handlePrivateLobby('leave_private', G, {}, shared);
    sent.length = 0;
    gate.resolve(); await tick(); await tick(); await tick();
    assert.equal(privateLobbies.get(code).guest, null);
    assert.ok(!sent.some((s) => s.msg.type === 'private_lobby'), 'no late success is sent');
  });

  it('a late authorization of a replaced joiner cannot overwrite the new guest', async () => {
    const { handlePrivateLobby } = loadFresh('../lib/ws/handlers/private-lobby');
    const { shared, privateLobbies, sent } = makeShared();
    const h = { handle: handlePrivateLobby, shared, privateLobbies, sent };
    const code = await makeHostedLobby(h, fakeWs(1));
    const slow = deferred();
    shared.authorizeCosmetics = async (fc, s, b) => { await slow.promise; return { skinId: s, boardId: b }; };
    const A = fakeWs(2, '2.2.2.2');
    handlePrivateLobby('join_private', A, { code, name: 'A' }, shared);
    handlePrivateLobby('leave_private', A, {}, shared);      // A frees the seat
    shared.authorizeCosmetics = async (fc, s, b) => ({ skinId: s, boardId: b });
    const B = fakeWs(3, '3.3.3.3');
    handlePrivateLobby('join_private', B, { code, name: 'B' }, shared);
    await tick(); await tick(); await tick();
    slow.resolve(); await tick(); await tick(); await tick();
    const lobby = privateLobbies.get(code);
    assert.equal(lobby.guest.token, 't3');
    assert.equal(sent.filter((s) => s.ws === A && s.msg.type === 'private_lobby').length, 0);
  });
});

describe('join_private: joining your own lobby', () => {
  it('answers "self" and keeps the lobby alive', async () => {
    const { handlePrivateLobby } = loadFresh('../lib/ws/handlers/private-lobby');
    const { shared, privateLobbies, sent } = makeShared();
    const h = { handle: handlePrivateLobby, shared, privateLobbies, sent };
    const host = fakeWs(1);
    const code = await makeHostedLobby(h, host);
    handlePrivateLobby('join_private', host, { code }, shared);
    assert.ok(privateLobbies.has(code), 'host lobby was not destroyed');
    assert.equal(sent.length, 1);
    assert.equal(sent[0].msg.reason, 'self');
  });
});

describe('private lobby: avatar memory budget', () => {
  it('drops oversized avatar blobs once the global budget is used up', async () => {
    process.env.BP_PRIVATE_AVATAR_BUDGET_BYTES = String(100000);
    process.env.BP_PRIVATE_CREATE_COOLDOWN_MS = '0';
    try {
      const { handlePrivateLobby } = loadFresh('../lib/ws/handlers/private-lobby');
      const { shared, privateLobbies } = makeShared();
      const big = 'x'.repeat(60000);
      for (let i = 0; i < 6; i++) handlePrivateLobby('create_private', fakeWs(10 + i), { avatarCustom: big }, shared);
      let total = 0;
      for (const l of privateLobbies.values()) total += l.host.avatarCustom.length;
      assert.ok(total <= 100000, 'sum of stored avatars is within the budget, got ' + total);
      assert.equal(privateLobbies.size, 6, 'lobbies are still created (stock avatar fallback)');
    } finally {
      delete process.env.BP_PRIVATE_AVATAR_BUDGET_BYTES;
      delete process.env.BP_PRIVATE_CREATE_COOLDOWN_MS;
    }
  });

  it('defaults stay conservative (cap <= 2000, budget <= 64 MiB)', () => {
    const m = loadFresh('../lib/ws/handlers/private-lobby');
    assert.ok(m.MAX_PRIVATE_LOBBIES <= 2000);
    assert.ok(m.MAX_LOBBY_AVATAR_BYTES <= 64 * 1024 * 1024);
  });
});

describe('join_queue: stale attempts must not enqueue', () => {
  function queueHarness() {
    const { handleMatchmaking } = loadFresh('../lib/ws/handlers/matchmaking');
    const queue = [];
    const sent = [];
    const gate = deferred();
    const shared = {
      authorizeCosmetics: async (fc, s, b) => { await gate.promise; return { skinId: s, boardId: b }; },
      dequeueToken: (t) => { for (let i = queue.length - 1; i >= 0; i--) if (queue[i].token === t) queue.splice(i, 1); },
      enqueue: (p) => { queue.push(p); },
      findMatch: () => null,
      loadServerTrophies: async () => 0,
      normalizePlatform: (p) => String(p || 'web'),
      pendingQueueIntents: new Map(),
      rooms: new Map(),
      send: (ws, msg) => { sent.push({ ws, msg }); },
      startRoom: () => {},
      store: null
    };
    return { handleMatchmaking, queue, sent, gate, shared };
  }

  it('leave_queue sent while authorization is pending cancels the join', async () => {
    const h = queueHarness();
    const ws = fakeWs(1);
    h.handleMatchmaking('join_queue', ws, { duration: 120 }, h.shared);
    h.handleMatchmaking('leave_queue', ws, {}, h.shared);
    h.gate.resolve(); await tick(); await tick(); await tick();
    assert.equal(h.queue.length, 0, 'no ghost queue entry after leave_queue');
    assert.ok(!h.sent.some((s) => s.msg.type === 'queued'));
  });

  it('two quick join_queue messages enqueue the player only once (latest wins)', async () => {
    const h = queueHarness();
    const ws = fakeWs(2);
    h.handleMatchmaking('join_queue', ws, { duration: 120 }, h.shared);
    h.handleMatchmaking('join_queue', ws, { duration: 60 }, h.shared);
    h.gate.resolve(); await tick(); await tick(); await tick();
    assert.equal(h.queue.length, 1);
    assert.equal(h.queue[0].duration, 60);
  });

  it('a socket that closed while authorizing is not enqueued', async () => {
    const h = queueHarness();
    const ws = fakeWs(3);
    h.handleMatchmaking('join_queue', ws, { duration: 120 }, h.shared);
    ws.readyState = 3;
    h.gate.resolve(); await tick(); await tick(); await tick();
    assert.equal(h.queue.length, 0);
  });

  it('opening a private lobby while queueing cancels the pending queue join', async () => {
    const h = queueHarness();
    const { handlePrivateLobby } = loadFresh('../lib/ws/handlers/private-lobby');
    const ws = fakeWs(4);
    h.handleMatchmaking('join_queue', ws, { duration: 120 }, h.shared);
    const { shared } = makeShared({ dequeueToken: h.shared.dequeueToken });
    handlePrivateLobby('create_private', ws, {}, shared);
    h.gate.resolve(); await tick(); await tick(); await tick();
    assert.equal(h.queue.length, 0);
  });

  it('a normal join_queue still enqueues', async () => {
    const h = queueHarness();
    const ws = fakeWs(5);
    h.handleMatchmaking('join_queue', ws, { duration: 120 }, h.shared);
    h.gate.resolve(); await tick(); await tick(); await tick();
    assert.equal(h.queue.length, 1);
    assert.ok(h.sent.some((s) => s.msg.type === 'queued'));
  });
});
