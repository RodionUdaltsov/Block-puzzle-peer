/**
 * Account progress must live on the server, survive logout/login unchanged,
 * never leak between identities, and a new account / guest starts from a clean slate.
 */
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const PORT = 19600 + (process.pid % 90);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function request(opts, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      host: '127.0.0.1', port: PORT, path: opts.path, method: opts.method || 'GET',
      headers: Object.assign(
        data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {},
        opts.headers || {}
      )
    }, (res) => {
      let b = '';
      res.on('data', (c) => { b += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(b); } catch (_) {}
        resolve({ status: res.statusCode, json, raw: b });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const auth = (token, device) => Object.assign({ Authorization: 'Bearer ' + token }, device ? { 'X-Device-Id': device } : {});
const dev = (id) => ({ 'X-Device-Id': id });

async function register(login, device, extra) {
  const r = await request({ path: '/api/auth/register', method: 'POST', headers: dev(device) },
    Object.assign({ login, password: 'secret-pass-1', nick: login }, extra || {}));
  assert.ok(r.status === 200 || r.status === 201, 'register ' + r.status + ' ' + r.raw);
  return r.json;
}
async function login(loginName, device) {
  const r = await request({ path: '/api/auth/login', method: 'POST', headers: dev(device) },
    { login: loginName, password: 'secret-pass-1' });
  assert.equal(r.status, 200, r.raw);
  return r.json;
}
const me = async (token) => (await request({ path: '/api/me', headers: auth(token) })).json.account;
const patch = (token, body) => request({ path: '/api/me', method: 'PATCH', headers: auth(token) }, body);

const MATCH = (id, date, my) => ({
  id, opp: 'Nova', oppName: 'Nova', botId: 'nova', my, oppScore: 100, result: 'win', delta: 0,
  mode: 'bots', difficulty: 'easy', duration: 120, timeLeft: 0, date, reason: 'normal', moves: []
});
const CLASSIC = () => ({
  grid: Array.from({ length: 8 }, (_, r) => Array.from({ length: 8 }, (_, c) => (r === 7 && c < 3 ? '#ff0000' : null))),
  score: 321, pieces: [{ shape: [[0, 0], [0, 1]], color: '#00ff00', used: false }]
});

describe('account progress: server is the source of truth', () => {
  let child;
  before(async () => {
    child = spawn(process.execPath, ['server.js'], {
      cwd: ROOT,
      env: Object.assign({}, process.env, {
        PORT: String(PORT), BP_STORE: 'memory', BP_LOG: 'error', NODE_ENV: 'development',
        BP_REGISTER_LIMIT: '500', BP_REGISTER_DEVICE_LIMIT: '500'
      }),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const deadline = Date.now() + 15000;
    for (;;) {
      try { if ((await request({ path: '/health' })).status === 200) break; } catch (_) {}
      if (Date.now() > deadline) throw new Error('server did not start');
      await wait(100);
    }
  });
  after(async () => { if (child) { child.kill('SIGTERM'); await wait(300); try { child.kill('SIGKILL'); } catch (_) {} } });

  it('everything survives logout → login unchanged (stars, history, friends, achievements, records, classic board, profile)', async () => {
    const d = 'device_persist_000000001';
    const reg = await register('persist_a', d);
    const tok = reg.token;
    const sent = await patch(tok, {
      nick: 'Persist A', status: 'hello', avatarId: 'a7', best: 4321,
      friends: [{ code: 'ZZZZ2222', name: 'Bob', trophies: 40 }],
      history: [MATCH('m1', 1000, 500), MATCH('m2', 2000, 700)],
      achievements: { totalWins: 5, ranked_best_score: 2750, winStreakBest: 3 },
      botStars: { nova: { '60': true, '180': true }, rex: { '120': true } },
      classicSave: CLASSIC()
    });
    assert.equal(sent.status, 200, sent.raw);

    assert.equal((await request({ path: '/api/auth/logout', method: 'POST', headers: auth(tok) })).status, 200);
    assert.equal((await request({ path: '/api/me', headers: auth(tok) })).status, 401, 'old session is dead');

    const back = await login('persist_a', d);
    const a = await me(back.token);
    assert.equal(a.nick, 'Persist A');
    assert.equal(a.status, 'hello');
    assert.equal(a.avatarId, 'a7');
    assert.equal(a.best, 4321);
    assert.deepEqual(a.friends.map((f) => f.code), ['ZZZZ2222']);
    assert.deepEqual(a.history.map((h) => h.id), ['m2', 'm1']);
    assert.equal(a.achievements.ranked_best_score, 2750);
    assert.equal(a.achievements.totalWins, 5);
    assert.deepEqual(a.botStars.nova, { '60': true, '180': true });
    assert.deepEqual(a.botStars.rex, { '120': true });
    assert.equal(a.classicSave.score, 321);
    assert.equal(a.classicSave.grid[7][0], '#ff0000');
  });

  it('a stale / freshly-booted client sending EMPTY data cannot wipe stars, history or achievements', async () => {
    const tok = (await register('persist_b', 'device_persist_000000002')).token;
    await patch(tok, {
      history: [MATCH('h1', 10, 1)], achievements: { totalWins: 9 }, botStars: { nova: { '60': true } }
    });
    const wipe = await patch(tok, { history: [], achievements: {}, botStars: {} });
    assert.equal(wipe.status, 200);
    const a = await me(tok);
    assert.equal(a.history.length, 1);
    assert.equal(a.achievements.totalWins, 9);
    assert.deepEqual(a.botStars.nova, { '60': true });
  });

  it('stars only accumulate; history from two devices is merged, newest first', async () => {
    const tok = (await register('persist_c', 'device_persist_000000003')).token;
    await patch(tok, { botStars: { nova: { '60': true } }, history: [MATCH('a', 100, 1)] });
    await patch(tok, { botStars: { nova: { '120': true } }, history: [MATCH('b', 200, 2)] });
    const a = await me(tok);
    assert.deepEqual(a.botStars.nova, { '60': true, '120': true });
    assert.deepEqual(a.history.map((h) => h.id), ['b', 'a']);
  });

  it('classicSave:null (game over / new game) clears the stored board', async () => {
    const tok = (await register('persist_d', 'device_persist_000000004')).token;
    await patch(tok, { classicSave: CLASSIC() });
    assert.ok((await me(tok)).classicSave);
    await patch(tok, { classicSave: null });
    assert.equal((await me(tok)).classicSave, null);
  });

  it('accounts never see each other\'s progress', async () => {
    const a = (await register('iso_a', 'device_persist_000000005')).token;
    const b = (await register('iso_b', 'device_persist_000000006')).token;
    await patch(a, { botStars: { nova: { '180': true } }, history: [MATCH('only-a', 5, 5)], classicSave: CLASSIC(), best: 999 });
    const accB = await me(b);
    assert.deepEqual(accB.botStars, {});
    assert.deepEqual(accB.history, []);
    assert.equal(accB.classicSave, null);
    assert.equal(accB.best, 0);
  });

  it('a NEW account registered on a device that used to hold another identity starts completely clean', async () => {
    // Account X lives on another device
    const x = (await register('clean_x', 'device_persist_000000007')).token;
    await patch(x, { botStars: { nova: { '180': true } }, history: [MATCH('x1', 1, 1)], best: 777 });
    // Device D: guest plays and leaves progress behind…
    const D = 'device_persist_000000008';
    const gb = await request({ path: '/api/auth/guest-bind', method: 'POST', headers: dev(D) }, {
      progress: { friendCode: 'GUESTAAA', trophies: 120, best: 555, botStars: { rex: { '60': true } },
        history: [MATCH('g1', 3, 3)], friends: [{ code: 'QQQQ3333', name: 'Q' }] }
    });
    assert.ok(gb.status === 200 || gb.status === 201, gb.raw);
    // …then logs into X without wiping the guest (leftover guest snapshot stays on the device)
    await login('clean_x', D);
    // A brand-new account created on that device must NOT inherit the leftovers
    const fresh = await register('clean_new', D, { guestProgress: { friendCode: 'GUESTAAA', botStars: { rex: { '60': true } } }, preferredFriendCode: 'GUESTAAA' });
    const a = fresh.account;
    assert.deepEqual(a.botStars, {});
    assert.deepEqual(a.history, []);
    assert.deepEqual(a.friends, []);
    assert.equal(a.best, 0);
    assert.equal(a.trophies, 0);
    assert.equal(a.classicSave, null);
    assert.notEqual(a.friendCode, 'GUESTAAA');
  });
});
