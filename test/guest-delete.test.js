/**
 * Admin deletion of a guest must be final: kick, no resurrection, no fresh 9999 profile,
 * and login/registration throttling is off by default (testing phase).
 */
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const { WebSocket } = require('../vendor/ws');
const { MemoryStore } = require('../lib/store');

const ROOT = path.join(__dirname, '..');
const PORT = 19900 + (process.pid % 40);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function rq(opts, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({
      host: '127.0.0.1', port: PORT, path: opts.path, method: opts.method || 'GET',
      headers: Object.assign(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}, opts.headers || {})
    }, (res) => {
      let b = ''; res.on('data', (c) => { b += c; });
      res.on('end', () => { let json = null; try { json = JSON.parse(b); } catch (_) {} resolve({ status: res.statusCode, json }); });
    });
    r.on('error', reject); if (data) r.write(data); r.end();
  });
}
async function openWs(device) {
  const ws = new WebSocket('ws://127.0.0.1:' + PORT + '/ws', { headers: { 'X-Device-Id': device } });
  const got = []; const state = { closed: null };
  ws.on('message', (m) => { try { got.push(JSON.parse(String(m))); } catch (_) {} });
  ws.on('close', (c, r) => { state.closed = [c, String(r)]; });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  ws.send(JSON.stringify({ type: 'client_info', deviceId: device, platform: 'web' }));
  return { ws, got, state };
}

describe('MemoryStore: tombstoned codes cannot be recreated', () => {
  it('saveGuestProgress / saveProfile are ignored after markDeletedCode', async () => {
    const st = new MemoryStore();
    await st.markDeletedCode('DEADCODE', 'account_deleted', 3600);
    await st.saveGuestProgress('DEADCODE', { friendCode: 'DEADCODE', diamonds: 9999 });
    await st.saveProfile('DEADCODE', { diamonds: 9999 }, 3600);
    assert.equal(await st.loadGuestProgress('DEADCODE'), null);
    assert.equal(await st.loadProfile('DEADCODE'), null);
  });
});

describe('admin guest deletion is final (server e2e)', () => {
  let child;
  before(async () => {
    child = spawn(process.execPath, ['server.js'], {
      cwd: ROOT,
      env: Object.assign({}, process.env, { PORT: String(PORT), BP_STORE: 'memory', BP_LOG: 'error', NODE_ENV: 'development' }),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const deadline = Date.now() + 15000;
    for (;;) {
      try { if ((await rq({ path: '/health' })).status === 200) break; } catch (_) {}
      if (Date.now() > deadline) throw new Error('server did not start');
      await wait(150);
    }
  });
  after(() => { try { child.kill(); } catch (_) {} });

  it('kicks the online guest, wipes data, and a stale client gets no 9999 profile', async () => {
    const DEV = 'delguestdevice00000001';
    const g = await openWs(DEV);
    g.ws.send(JSON.stringify({ type: 'presence_register', name: 'G' }));
    await wait(500);
    const code = (g.got.find((m) => m.type === 'presence_ok') || {}).friendCode;
    assert.ok(code, 'guest got a friend code');
    await rq({ path: '/api/auth/guest-sync', method: 'POST', headers: { 'X-Device-Id': DEV } },
      { progress: { friendCode: code, nick: 'G' } });

    const del = await rq({ path: '/api/admin/delete-device', method: 'POST', headers: { 'X-Admin-Key': 'localdev' } }, { deviceId: DEV });
    assert.equal(del.status, 200, JSON.stringify(del.json));
    await wait(500);
    assert.ok(g.got.some((m) => m.type === 'auth_revoked'), 'guest received auth_revoked');
    assert.deepEqual(g.state.closed && g.state.closed[0], 4001, 'socket closed with 4001');

    // A stale client (not yet wiped) still claims the dead code on a new socket. The claim is no
    // longer honoured at all (identity is server-decided): no profile, no starter balance, no buy.
    const stale = await openWs('delguestdevice00000002');
    stale.ws.send(JSON.stringify({ type: 'cosmetics_get', friendCode: code }));
    stale.ws.send(JSON.stringify({ type: 'cosmetics_buy', friendCode: code, kind: 'skin', id: 'nope' }));
    await wait(500);
    const st = stale.got.find((m) => m.type === 'cosmetics_state');
    assert.ok(st && st.ok === false && (st.error === 'no_profile' || st.error === 'account_deleted'), JSON.stringify(st));
    assert.equal(st.diamonds, undefined, 'no starter balance handed out');
    const buy = stale.got.find((m) => m.type === 'cosmetics_buy_result');
    assert.ok(buy && buy.ok === false && (buy.error === 'no_profile' || buy.error === 'account_deleted'), JSON.stringify(buy));

    const sync = await rq({ path: '/api/auth/guest-sync', method: 'POST', headers: { 'X-Device-Id': DEV } },
      { progress: { friendCode: code } });
    assert.equal(sync.status, 410, 'deleted guest cannot sync back');
    try { stale.ws.close(); } catch (_) {}
  });

  it('login/registration are not throttled by default', async () => {
    const dev = { 'X-Device-Id': 'ratelimitdevice0000001' };
    const reg = await rq({ path: '/api/auth/register', method: 'POST', headers: dev }, { login: 'ratelimit_u', password: 'secret-pass-1' });
    assert.ok(reg.json && reg.json.ok);
    for (let i = 0; i < 45; i++) {
      const bad = await rq({ path: '/api/auth/login', method: 'POST', headers: dev }, { login: 'ratelimit_u', password: 'wrong-pass-' + i });
      assert.equal(bad.status, 401, 'attempt ' + i + ' must be a plain 401, not 429');
    }
    const good = await rq({ path: '/api/auth/login', method: 'POST', headers: dev }, { login: 'ratelimit_u', password: 'secret-pass-1' });
    assert.equal(good.status, 200);
    for (let i = 0; i < 8; i++) {
      const r = await rq({ path: '/api/auth/register', method: 'POST', headers: { 'X-Device-Id': 'ratelimitdevice0000001' } }, { login: 'many_' + i, password: 'secret-pass-1' });
      assert.ok(r.status === 200 || r.status === 201, 'register ' + i + ' got ' + r.status);
    }
  });
});
