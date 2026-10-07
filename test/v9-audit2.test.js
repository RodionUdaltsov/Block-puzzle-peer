/**
 * Second-audit regressions: private-lobby resource exhaustion, join brute force, Secure cookies
 * by default in production, static path boundary, /health leak, social_send name spoofing.
 */
'use strict';
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function loadFresh(mod) {
  // private-lobby keeps module-level counters; reload so each test starts clean
  const p = require.resolve(mod);
  delete require.cache[p];
  return require(mod);
}

function makeShared(overrides) {
  const privateLobbies = new Map();
  const sent = [];
  const shared = {
    authorizeCosmetics: async () => ({ skinId: 'default', boardId: 'field_default' }),
    dequeueToken: () => {},
    genPrivateCode: () => require('crypto').randomBytes(5).toString('hex').toUpperCase(),
    leavePrivateLobby: (token) => {
      for (const [code, l] of privateLobbies) {
        if (l.host && l.host.token === token) privateLobbies.delete(code);
      }
    },
    loadServerTrophies: async () => 0,
    lobbySnapshot: (lobby, role) => ({ type: 'private_lobby', code: lobby.code, role }),
    normalizePlatform: (p) => String(p || 'web'),
    privateLobbies,
    rooms: new Map(),
    send: (ws, msg) => { sent.push({ ws, msg }); },
    tryStartPrivate: () => {}
  };
  return { shared: Object.assign(shared, overrides || {}), privateLobbies, sent };
}

function fakeWs(i, ip) {
  return { _token: 't' + i, _ip: ip || '10.0.0.' + (i % 250), readyState: 1, _matchId: null };
}

describe('create_private: resource exhaustion', () => {
  beforeEach(() => { process.env.BP_PRIVATE_CREATE_COOLDOWN_MS = '3000'; });

  it('a burst of create_private from ONE socket leaves at most one lobby', async () => {
    const { handlePrivateLobby } = loadFresh('../lib/ws/handlers/private-lobby');
    const { shared, privateLobbies } = makeShared();
    const ws = fakeWs(1);
    const big = 'x'.repeat(100000);
    for (let i = 0; i < 60; i++) {
      handlePrivateLobby('create_private', ws, { avatarCustom: big, duration: 120 }, shared);
    }
    await new Promise((r) => setImmediate(r));
    assert.equal(privateLobbies.size, 1, 'only one active lobby per socket');
    const lobby = Array.from(privateLobbies.values())[0];
    assert.ok(lobby.host.avatarCustom.length <= 49152, 'avatar blob stays capped');
  });

  it('rejects further creates inside the cooldown with rate_limited', () => {
    const { handlePrivateLobby } = loadFresh('../lib/ws/handlers/private-lobby');
    const { shared, sent } = makeShared();
    const ws = fakeWs(2);
    handlePrivateLobby('create_private', ws, {}, shared);
    handlePrivateLobby('create_private', ws, {}, shared);
    const errs = sent.filter((s) => s.msg.type === 'private_error');
    assert.equal(errs.length, 1);
    assert.equal(errs[0].msg.reason, 'rate_limited');
  });

  it('many sockets cannot exceed the global cap (server_busy)', () => {
    process.env.BP_MAX_PRIVATE_LOBBIES = '5';
    try {
      const { handlePrivateLobby } = loadFresh('../lib/ws/handlers/private-lobby');
      const { shared, privateLobbies, sent } = makeShared();
      for (let i = 0; i < 20; i++) handlePrivateLobby('create_private', fakeWs(100 + i), {}, shared);
      assert.equal(privateLobbies.size, 5);
      const busy = sent.filter((s) => s.msg.type === 'private_error' && s.msg.reason === 'server_busy');
      assert.equal(busy.length, 15);
    } finally {
      delete process.env.BP_MAX_PRIVATE_LOBBIES;
    }
  });
});

describe('join_private: brute-force protection', () => {
  it('blocks an IP after repeated not_found, even for later valid codes', () => {
    process.env.BP_PRIVATE_JOIN_FAILS = '10';
    const { handlePrivateLobby } = loadFresh('../lib/ws/handlers/private-lobby');
    delete process.env.BP_PRIVATE_JOIN_FAILS;
    const { shared, privateLobbies, sent } = makeShared();
    const host = fakeWs(1, '1.1.1.1');
    handlePrivateLobby('create_private', host, {}, shared);
    const realCode = Array.from(privateLobbies.keys())[0];

    const attacker = fakeWs(2, '9.9.9.9');
    for (let i = 0; i < 10; i++) handlePrivateLobby('join_private', attacker, { code: 'ZZZZZZ' + i }, shared);
    sent.length = 0;
    // 11th attempt uses the REAL code — still refused without lookup
    handlePrivateLobby('join_private', attacker, { code: realCode }, shared);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].msg.reason, 'rate_limited');
    assert.equal(privateLobbies.get(realCode).guest, null);

    // another IP is unaffected
    sent.length = 0;
    handlePrivateLobby('join_private', fakeWs(3, '2.2.2.2'), { code: realCode }, shared);
    assert.ok(!sent.some((s) => s.msg.reason === 'rate_limited'));
  });
});

describe('private code entropy', () => {
  it('generates 7-character codes from the unambiguous alphabet', () => {
    const { createMatchmakingApi } = require('../lib/matchmaking.js');
    const api = createMatchmakingApi({ hooks: {}, clock: require('../lib/clock').clock });
    const seen = new Set();
    for (let i = 0; i < 200; i++) {
      const c = api.genPrivateCode();
      assert.match(c, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{7}$/);
      seen.add(c);
    }
    assert.ok(seen.size > 190);
  });
});

describe('cookies: Secure by default in production', () => {
  function withEnv(env, fn) {
    const keep = { n: process.env.NODE_ENV, s: process.env.BP_COOKIE_SECURE };
    const set = (k, v) => { if (v === undefined) delete process.env[k]; else process.env[k] = v; };
    set('NODE_ENV', env.NODE_ENV); set('BP_COOKIE_SECURE', env.BP_COOKIE_SECURE);
    try { return fn(); } finally { set('NODE_ENV', keep.n); set('BP_COOKIE_SECURE', keep.s); }
  }
  it('auth cookie: Secure in production without any extra env', () => {
    const ac = require('../lib/auth-cookie');
    assert.match(withEnv({ NODE_ENV: 'production' }, () => ac.setCookieHeader('tok')), /; Secure/);
    assert.match(withEnv({ NODE_ENV: 'production' }, () => ac.clearCookieHeader()), /; Secure/);
  });
  it('auth cookie: not Secure in development unless forced; explicit 0 overrides production', () => {
    const ac = require('../lib/auth-cookie');
    assert.doesNotMatch(withEnv({ NODE_ENV: 'development' }, () => ac.setCookieHeader('tok')), /Secure/);
    assert.match(withEnv({ NODE_ENV: 'development', BP_COOKIE_SECURE: '1' }, () => ac.setCookieHeader('tok')), /; Secure/);
    assert.doesNotMatch(withEnv({ NODE_ENV: 'production', BP_COOKIE_SECURE: '0' }, () => ac.setCookieHeader('tok')), /Secure/);
  });
  it('device cookie follows the same policy', () => {
    const { createDeviceApi } = require('../lib/device');
    const { MemoryStore } = require('../lib/store');
    const api = createDeviceApi({ hooks: { store: new MemoryStore() }, Cosmetics: require('../shared/cosmetics') });
    const id = 'a'.repeat(32);
    const h = withEnv({ NODE_ENV: 'production' }, () => api.deviceIdSetCookieHeader(id));
    if (h) assert.match(h, /; Secure/);
    const d = withEnv({ NODE_ENV: 'development' }, () => api.deviceIdSetCookieHeader(id));
    if (d) assert.doesNotMatch(d, /Secure/);
  });
});

describe('static path + /health (live server)', () => {
  const { spawn } = require('child_process');
  const http = require('http');
  const PORT = 19950 + (process.pid % 40);
  let proc;

  function get(p, rawPath) {
    return new Promise((resolve, reject) => {
      const req = http.request({ host: '127.0.0.1', port: PORT, method: 'GET', path: rawPath || p }, (res) => {
        let b = '';
        res.on('data', (c) => { b += c; });
        res.on('end', () => resolve({ status: res.statusCode, body: b }));
      });
      req.on('error', reject);
      req.end();
    });
  }

  it('boots', async () => {
    // sibling dir with the PUBLIC prefix, containing a secret
    const sib = path.join(ROOT, 'public-secret-test');
    fs.mkdirSync(sib, { recursive: true });
    fs.writeFileSync(path.join(sib, 'secret.txt'), 'TOPSECRET');
    proc = spawn(process.execPath, ['server.js'], {
      cwd: ROOT,
      env: Object.assign({}, process.env, { PORT: String(PORT), BP_STORE: 'memory', BP_LOG: 'error', NODE_ENV: 'development' }),
      stdio: 'ignore'
    });
    const deadline = Date.now() + 15000;
    for (;;) {
      try { const r = await get('/health'); if (r.status === 200) break; } catch (_) {}
      if (Date.now() > deadline) throw new Error('server did not start');
      await new Promise((r) => setTimeout(r, 100));
    }
  });

  it('sibling directory sharing the "public" prefix is not readable', async () => {
    const r = await get(null, '/../public-secret-test/secret.txt');
    assert.ok(!r.body.includes('TOPSECRET'));
    const r2 = await get(null, '/%2e%2e/public-secret-test/secret.txt');
    assert.ok(!r2.body.includes('TOPSECRET'));
  });

  it('/health exposes no process internals by default', async () => {
    const r = await get('/health');
    const j = JSON.parse(r.body);
    assert.equal(j.ok, true);
    for (const k of ['pid', 'node', 'memoryRss', 'rooms', 'wsClients', 'store', 'privateLobbies']) {
      assert.ok(!(k in j), 'health must not expose ' + k);
    }
  });

  it('cleanup', async () => {
    try { proc.kill(); } catch (_) {}
    fs.rmSync(path.join(ROOT, 'public-secret-test'), { recursive: true, force: true });
  });
});

describe('social_send name is server-authoritative', () => {
  it('source no longer reads data.name / payload.name for the social display name', () => {
    const src = fs.readFileSync(path.join(ROOT, 'lib/ws/handlers/presence-social.js'), 'utf8');
    const i = src.indexOf("type === 'social_send'");
    const j = src.indexOf("const queueable", i);
    const block = src.slice(i, j);
    assert.ok(!/data\.name|payload\.name/.test(block), 'social_send must not trust a client name');
    assert.ok(/_verifiedNick/.test(block));
  });
});
