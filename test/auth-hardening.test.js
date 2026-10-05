/**
 * Auth / admin / proxy hardening.
 * Unit tests for the limiter + IP helpers, and a live-server test for the HTTP behaviour.
 */
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');

// ---------- unit: limiter ----------
describe('auth limiter', () => {
  const { createAuthLimiter, createWindowCounter } = require('../lib/rate-limit');

  it('blocks an IP+login pair after N failures but not another IP', () => {
    const l = createAuthLimiter({ pairFails: 3 });
    for (let i = 0; i < 3; i++) l.fail('1.1.1.1', 'Bob');
    assert.equal(l.check('1.1.1.1', 'bob').ok, false);
    assert.equal(l.check('2.2.2.2', 'bob').ok, true);
  });

  it('success clears the pair counter', () => {
    const l = createAuthLimiter({ pairFails: 3 });
    l.fail('1.1.1.1', 'bob');
    l.fail('1.1.1.1', 'bob');
    l.success('1.1.1.1', 'bob');
    l.fail('1.1.1.1', 'bob');
    assert.equal(l.check('1.1.1.1', 'bob').ok, true);
  });

  it('per-IP ceiling applies across different logins', () => {
    const l = createAuthLimiter({ ipFails: 4, pairFails: 99 });
    for (let i = 0; i < 4; i++) l.fail('9.9.9.9', 'user' + i);
    const r = l.check('9.9.9.9', 'someone_else');
    assert.equal(r.ok, false);
    assert.ok(r.retryAfter >= 1);
  });

  it('window counter resets after the window and stays bounded', () => {
    const c = createWindowCounter(2, 1000);
    const t0 = 1_000_000;
    c.hit('k', t0); c.hit('k', t0);
    assert.equal(c.blocked('k', t0 + 10), true);
    assert.equal(c.blocked('k', t0 + 1500), false);
    for (let i = 0; i < 60000; i++) c.hit('u' + i, t0);
    assert.ok(c.size <= 50000, 'size capped, got ' + c.size);
  });

  it('device id is tracked independently of IP (VPN / IP change does not reset it)', () => {
    const l = createAuthLimiter({ pairFails: 3, ipFails: 999, loginFails: 999 });
    for (let i = 0; i < 3; i++) l.fail('1.1.1.' + i, 'bob', 'device_AAAAAAAAAAAAAAAA');
    // same device, brand-new IP and still blocked
    assert.equal(l.check('8.8.8.8', 'bob', 'device_AAAAAAAAAAAAAAAA').ok, false);
    // another device from a fresh IP is unaffected
    assert.equal(l.check('8.8.8.8', 'bob', 'device_BBBBBBBBBBBBBBBB').ok, true);
  });

  it('rotating device ids does not help: the IP limits still stop it', () => {
    const l = createAuthLimiter({ ipFails: 5, pairFails: 99, loginFails: 999, deviceFails: 99 });
    for (let i = 0; i < 5; i++) l.fail('7.7.7.7', 'user' + i, 'device_rotating_' + String(i).padStart(8, '0'));
    assert.equal(l.check('7.7.7.7', 'bob', 'device_rotating_fresh0000').ok, false);
  });

  it('per-device registration cap', () => {
    const l = createAuthLimiter({ registerLimit: 99, registerDeviceLimit: 2 });
    l.registerHit('5.5.5.1', 'device_CCCCCCCCCCCCCCCC');
    l.registerHit('5.5.5.2', 'device_CCCCCCCCCCCCCCCC');
    assert.equal(l.checkRegister('5.5.5.3', 'device_CCCCCCCCCCCCCCCC').ok, false);
    assert.equal(l.checkRegister('5.5.5.3', 'device_DDDDDDDDDDDDDDDD').ok, true);
  });

  it('registration flood guard', () => {
    const l = createAuthLimiter({ registerLimit: 2 });
    l.registerHit('3.3.3.3'); l.registerHit('3.3.3.3');
    assert.equal(l.checkRegister('3.3.3.3').ok, false);
    assert.equal(l.checkRegister('4.4.4.4').ok, true);
  });
});

// ---------- unit: client IP ----------
describe('getClientIp / trusted proxy', () => {
  const { getClientIp, parseTrustProxy, safeEqual, isLoopbackIp } = require('../lib/security');
  const req = (xff, remote) => ({
    headers: xff ? { 'x-forwarded-for': xff } : {},
    socket: { remoteAddress: remote || '10.0.0.1' }
  });

  it('ignores X-Forwarded-For when no proxy is trusted', () => {
    assert.equal(getClientIp(req('6.6.6.6'), 0), '10.0.0.1');
  });

  it('uses the entry appended by our own proxy, not the spoofable left-most one', () => {
    // client sent "evil", our proxy appended the real address
    assert.equal(getClientIp(req('evil.example, 203.0.113.7'), 1), '203.0.113.7');
    assert.equal(getClientIp(req('evil, 203.0.113.7, 10.1.1.1'), 2), '203.0.113.7');
  });

  it('falls back to the socket address when the header is missing', () => {
    assert.equal(getClientIp(req(null, '::ffff:192.0.2.5'), 1), '192.0.2.5');
  });

  it('parses BP_TRUST_PROXY values', () => {
    assert.equal(parseTrustProxy(undefined), 0);
    assert.equal(parseTrustProxy('0'), 0);
    assert.equal(parseTrustProxy('true'), 1);
    assert.equal(parseTrustProxy('2'), 2);
    assert.equal(parseTrustProxy('garbage'), 0);
  });

  it('safeEqual / isLoopbackIp', () => {
    assert.equal(safeEqual('abc', 'abc'), true);
    assert.equal(safeEqual('abc', 'abd'), false);
    assert.equal(safeEqual('abc', 'abcd'), false);
    assert.equal(isLoopbackIp('::ffff:127.0.0.1'), true);
    assert.equal(isLoopbackIp('172.18.0.3'), false);
  });
});

// ---------- unit: password hashing is async, compatible, capped ----------
describe('password hashing', () => {
  const crypto = require('crypto');

  it('async scrypt matches the legacy scryptSync output (existing accounts keep working)', async () => {
    const salt = crypto.randomBytes(16).toString('hex');
    const legacy = crypto.scryptSync('secret1', salt, 64).toString('hex');
    const viaAsync = await new Promise((res, rej) =>
      crypto.scrypt('secret1', salt, 64, (e, k) => (e ? rej(e) : res(k.toString('hex')))));
    assert.equal(viaAsync, legacy);
  });

  it('does not block the event loop while hashing', async () => {
    const salt = crypto.randomBytes(16).toString('hex');
    let ticks = 0;
    const timer = setInterval(() => { ticks += 1; }, 5);
    await Promise.all(Array.from({ length: 6 }, () =>
      new Promise((res, rej) => crypto.scrypt('pw-123456', salt, 64, (e, k) => (e ? rej(e) : res(k))))));
    clearInterval(timer);
    assert.ok(ticks >= 2, 'event loop kept running, ticks=' + ticks);
  });
});

// ---------- live server ----------
const PORT = 19900 + (process.pid % 90);

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

function request(opts, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      host: '127.0.0.1',
      port: opts.port || PORT,
      path: opts.path,
      method: opts.method || 'GET',
      headers: Object.assign(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}, opts.headers || {})
    }, (res) => {
      let b = '';
      res.on('data', (c) => { b += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(b); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, json, raw: b });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function waitHealth(port) {
  const deadline = Date.now() + 15000;
  for (;;) {
    try {
      const r = await request({ port, path: '/health' });
      if (r.status === 200) return;
    } catch (_) {}
    if (Date.now() > deadline) throw new Error('server did not start');
    await wait(100);
  }
}

function startServer(port, env) {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: Object.assign({}, process.env, { PORT: String(port), BP_STORE: 'memory', BP_LOG: 'error' }, env),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  return child;
}

async function stopServer(child) {
  if (child && !child.killed) {
    child.kill('SIGTERM');
    await wait(300);
    try { child.kill('SIGKILL'); } catch (_) {}
  }
}

describe('live server: dev mode (loopback)', () => {
  let child;
  before(async () => {
    child = startServer(PORT, {
      NODE_ENV: 'development',
      BP_ADMIN_KEY: '',
      BP_AUTH_LIMITS: '1',
      BP_AUTH_PAIR_FAILS: '3',
      BP_TRUST_PROXY: '0'
    });
    await waitHealth(PORT);
  });
  after(() => stopServer(child));

  it('register + login work with the async hashing path', async () => {
    const reg = await request({ path: '/api/auth/register', method: 'POST', headers: { 'X-Device-Id': 'dev_test_register_00000001' } },
      { login: 'alice_t', password: 'correct-horse', nick: 'Alice' });
    assert.ok(reg.status === 200 || reg.status === 201, 'register status ' + reg.status + ' ' + reg.raw);
    const ok = await request({ path: '/api/auth/login', method: 'POST' }, { login: 'alice_t', password: 'correct-horse' });
    assert.equal(ok.status, 200, ok.raw);
    assert.ok(ok.json && ok.json.token);
  });

  it('wrong passwords are throttled with 429 + Retry-After, correct one is blocked too while locked', async () => {
    const attempt = () => request({ path: '/api/auth/login', method: 'POST' }, { login: 'alice_t', password: 'nope-nope' });
    for (let i = 0; i < 3; i++) assert.equal((await attempt()).status, 401);
    const blocked = await attempt();
    assert.equal(blocked.status, 429);
    assert.ok(Number(blocked.headers['retry-after']) >= 1);
    const good = await request({ path: '/api/auth/login', method: 'POST' }, { login: 'alice_t', password: 'correct-horse' });
    assert.equal(good.status, 429, 'lockout must also stop the right password until the window ends');
  });

  it('unknown logins are throttled the same way (no user enumeration by status)', async () => {
    const attempt = () => request({ path: '/api/auth/login', method: 'POST' }, { login: 'ghost_user', password: 'whatever1' });
    for (let i = 0; i < 3; i++) assert.equal((await attempt()).status, 401);
    assert.equal((await attempt()).status, 429);
  });

  it('X-Forwarded-For cannot be used to dodge the limiter when no proxy is trusted', async () => {
    const attempt = (xff) => request(
      { path: '/api/auth/login', method: 'POST', headers: { 'X-Forwarded-For': xff } },
      { login: 'spoof_target', password: 'whatever1' });
    for (let i = 0; i < 3; i++) await attempt('10.0.0.' + i);
    assert.equal((await attempt('10.9.9.9')).status, 429);
  });

  it('lockout follows the device id: other logins from the same device are throttled too', async () => {
    const dev = 'dev_http_limit_test_000001';
    const attempt = (login) => request(
      { path: '/api/auth/login', method: 'POST', headers: { 'X-Device-Id': dev } },
      { login, password: 'whatever1' });
    // 15 failures (default device ceiling) spread over many different logins
    for (let i = 0; i < 15; i++) assert.equal((await attempt('dev_user_' + i)).status, 401);
    assert.equal((await attempt('dev_user_new')).status, 429);
    // a different device is not affected
    const other = await request(
      { path: '/api/auth/login', method: 'POST', headers: { 'X-Device-Id': 'dev_http_limit_other_000002' } },
      { login: 'dev_user_fresh', password: 'whatever1' });
    assert.equal(other.status, 401);
  });

  it('admin: dev key only via header/body, never via query string', async () => {
    const q = await request({ path: '/api/admin/overview?key=localdev' });
    assert.equal(q.status, 403);
    const h = await request({ path: '/api/admin/overview', headers: { 'X-Admin-Key': 'localdev' } });
    assert.notEqual(h.status, 403, 'header key accepted from loopback: ' + h.raw);
    assert.notEqual(h.status, 404);
    const bad = await request({ path: '/api/admin/overview', headers: { 'X-Admin-Key': 'wrong' } });
    assert.equal(bad.status, 403);
  });
});

describe('live server: production without BP_ADMIN_KEY', () => {
  const P = PORT + 100;
  let child;
  before(async () => {
    child = startServer(P, { NODE_ENV: 'production', BP_ADMIN_KEY: '' });
    await waitHealth(P);
  });
  after(() => stopServer(child));

  it('admin API is disabled even with the old default key', async () => {
    const r = await request({ port: P, path: '/api/admin/overview', headers: { 'X-Admin-Key': 'localdev' } });
    assert.equal(r.status, 404);
    const d = await request({ port: P, path: '/api/admin/delete-all-accounts', method: 'POST', headers: { 'X-Admin-Key': 'localdev' } }, { key: 'localdev' });
    assert.equal(d.status, 404);
  });
});

describe('live server: production with BP_ADMIN_KEY + origin allowlist', () => {
  const P = PORT + 200;
  let child;
  before(async () => {
    child = startServer(P, {
      NODE_ENV: 'production',
      BP_ADMIN_KEY: 'a-long-random-key-123',
      BP_WS_ORIGINS: 'https://game.example'
    });
    await waitHealth(P);
  });
  after(() => stopServer(child));

  it('wrong key → 403, right key (header) → accepted', async () => {
    const bad = await request({ port: P, path: '/api/admin/overview', headers: { 'X-Admin-Key': 'localdev' } });
    assert.equal(bad.status, 403);
    const ok = await request({ port: P, path: '/api/admin/overview', headers: { 'X-Admin-Key': 'a-long-random-key-123' } });
    assert.notEqual(ok.status, 403);
    assert.notEqual(ok.status, 404);
  });

  it('CORS follows the allowlist instead of "*"', async () => {
    const allowed = await request({ port: P, path: '/health', headers: { Origin: 'https://game.example' } });
    assert.equal(allowed.headers['access-control-allow-origin'], 'https://game.example');
    const other = await request({ port: P, path: '/health', headers: { Origin: 'https://evil.example' } });
    assert.equal(other.headers['access-control-allow-origin'], undefined);
  });
});
