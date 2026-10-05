/**
 * Guest → account migration keeps server-side economy, guest wipe is ownership-checked,
 * and deleting a player removes them from every friends list.
 */
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const { createDeviceApi } = require('../lib/device');
const { MemoryStore } = require('../lib/store');

const ROOT = path.join(__dirname, '..');
const PORT = 19700 + (process.pid % 90);
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

describe('mergeGuestProgressLayers: economy comes from server layers only', () => {
  const api = createDeviceApi({ hooks: { store: null, isFriendCodeDeleted: () => false, isFriendCodeDeletedAsync: async () => false }, Cosmetics: require('../shared/cosmetics') });
  it('keeps server trophies/diamonds and ignores later (client) layers', () => {
    const server = { friendCode: 'ABCD1234', trophies: 150, diamonds: 420 };
    const client = { friendCode: 'ABCD1234', trophies: 999999, diamonds: 99999999 };
    const m = api.mergeGuestProgressLayers(server, null, client);
    assert.equal(m.trophies, 150);
    assert.equal(m.diamonds, 420);
  });
  it('does not zero trophies when only the server layer has them', () => {
    const m = api.mergeGuestProgressLayers({ trophies: 75 }, { nick: 'x' }, {});
    assert.equal(m.trophies, 75);
  });
});

describe('MemoryStore.purgeFriendReferences', () => {
  it('removes the code from accounts and guests and reports the owners', async () => {
    const st = new MemoryStore();
    await st.saveAccount({ id: 'a1', login: 'a1', friendCode: 'AAAAAAAA', friends: [{ code: 'DEADCODE' }, { code: 'KEEPCODE' }] });
    await st.saveGuestProgress('GGGGGGGG', { friendCode: 'GGGGGGGG', friends: [{ code: 'deadcode' }] });
    const owners = await st.purgeFriendReferences('DEADCODE');
    assert.deepEqual(owners.sort(), ['AAAAAAAA', 'GGGGGGGG']);
    const a = await st.loadAccountByCode('AAAAAAAA');
    assert.deepEqual(a.friends.map((f) => f.code), ['KEEPCODE']);
    const g = await st.loadGuestProgress('GGGGGGGG');
    assert.deepEqual(g.friends, []);
  });
});

describe('wipe-guest is ownership-checked', () => {
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
      await wait(150);
    }
  });
  after(() => { try { child.kill(); } catch (_) {} });

  it('refuses to wipe a registered account supplied as "guest" code', async () => {
    const reg = (login, dev) => request({ path: '/api/auth/register', method: 'POST', headers: { 'X-Device-Id': dev } },
      { login, password: 'secret-pass-1', nick: login });
    const victim = (await reg('victim_u', 'victimdevice0000001')).json;
    const attacker = (await reg('attacker_u', 'attackerdevice00001')).json;
    assert.ok(victim && victim.ok && attacker && attacker.ok);
    const r = await request({
      path: '/api/auth/wipe-guest', method: 'POST',
      headers: { Authorization: 'Bearer ' + attacker.token, 'X-Device-Id': 'attackerdevice00001' }
    }, { guestFriendCode: victim.account.friendCode });
    assert.equal(r.status, 403);
    const still = await request({ path: '/api/me', headers: { Authorization: 'Bearer ' + victim.token } });
    assert.equal(still.status, 200);
  });
});

describe('admin delete-guest removes the guest completely', () => {
  let child;
  const P = 19800 + (process.pid % 90);
  const req2 = (opts, body) => new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({
      host: '127.0.0.1', port: P, path: opts.path, method: opts.method || 'GET',
      headers: Object.assign(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}, opts.headers || {})
    }, (res) => {
      let b = ''; res.on('data', (c) => { b += c; });
      res.on('end', () => { let json = null; try { json = JSON.parse(b); } catch (_) {} resolve({ status: res.statusCode, json }); });
    });
    r.on('error', reject); if (data) r.write(data); r.end();
  });
  before(async () => {
    child = spawn(process.execPath, ['server.js'], {
      cwd: ROOT,
      env: Object.assign({}, process.env, { PORT: String(P), BP_STORE: 'memory', BP_LOG: 'error', NODE_ENV: 'development' }),
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const deadline = Date.now() + 15000;
    for (;;) {
      try { if ((await req2({ path: '/health' })).status === 200) break; } catch (_) {}
      if (Date.now() > deadline) throw new Error('server did not start');
      await wait(150);
    }
  });
  after(() => { try { child.kill(); } catch (_) {} });

  it('guest cannot sync again after admin deletion (tombstoned) and registered accounts are protected', async () => {
    const dev = { 'X-Device-Id': 'guestdevice0000000001' };
    const adm = { 'X-Admin-Key': 'localdev' };
    const sync = (code) => req2({ path: '/api/auth/guest-sync', method: 'POST', headers: dev },
      { progress: { friendCode: code, nick: 'G' } });
    const first = await sync('GUESTCODE');
    assert.equal(first.status, 200);
    const del = await req2({ path: '/api/admin/delete-guest', method: 'POST', headers: adm }, { friendCode: 'GUESTCODE' });
    assert.equal(del.status, 200, JSON.stringify(del.json));
    const again = await sync('GUESTCODE');
    assert.equal(again.status, 410);

    const reg = await req2({ path: '/api/auth/register', method: 'POST', headers: { 'X-Device-Id': 'regdevice00000000001' } },
      { login: 'realuser1', password: 'secret-pass-1' });
    assert.ok(reg.json && reg.json.ok);
    const refuse = await req2({ path: '/api/admin/delete-guest', method: 'POST', headers: adm },
      { friendCode: reg.json.account.friendCode });
    assert.equal(refuse.status, 409);
  });
});

describe('admin delete-device kicks the guest even when the bind code differs; auth limits are off', () => {
  const { WebSocket } = require('../vendor/ws');
  let child;
  const P = 19890 + (process.pid % 9);
  const rq = (opts, body) => new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({
      host: '127.0.0.1', port: P, path: opts.path, method: opts.method || 'GET',
      headers: Object.assign(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}, opts.headers || {})
    }, (res) => {
      let b = ''; res.on('data', (c) => { b += c; });
      res.on('end', () => { let json = null; try { json = JSON.parse(b); } catch (_) {} resolve({ status: res.statusCode, json }); });
    });
    r.on('error', reject); if (data) r.write(data); r.end();
  });
  before(async () => {
    child = spawn(process.execPath, ['server.js'], {
      cwd: ROOT,
      env: Object.assign({}, process.env, { PORT: String(P), BP_STORE: 'memory', BP_LOG: 'error', NODE_ENV: 'development' }),
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

  it('kicks the socket of the device and wipes the identity', async () => {
    const DEV = 'kickdevice00000000001';
    const events = [];
    let code = '';
    const ws = new WebSocket('ws://127.0.0.1:' + P + '/ws', { headers: { Cookie: 'bp_device_id=' + DEV } });
    await new Promise((r) => ws.on('open', r));
    ws.on('message', (m) => {
      try {
        const d = JSON.parse(String(m));
        events.push(d.type + (d.reason ? ':' + d.reason : ''));
        if (d.type === 'presence_ok') code = d.friendCode;
      } catch (_) {}
    });
    ws.on('close', (c) => events.push('close:' + c));
    ws.send(JSON.stringify({ type: 'presence_register', name: 'G', activity: 'online' }));
    for (let i = 0; i < 30 && !code; i++) await wait(100);
    assert.ok(code, 'guest got a friend code');
    // Device bind holds a DIFFERENT (stale) code than the live socket
    const sync = await rq({ path: '/api/auth/guest-sync', method: 'POST', headers: { 'X-Device-Id': DEV } },
      { progress: { friendCode: 'STALECODE', nick: 'G' } });
    assert.equal(sync.status, 200);
    events.length = 0;
    const del = await rq({ path: '/api/admin/delete-device', method: 'POST', headers: { 'X-Admin-Key': 'localdev' } }, { deviceId: DEV });
    assert.equal(del.status, 200, JSON.stringify(del.json));
    for (let i = 0; i < 30 && events.indexOf('close:4001') === -1; i++) await wait(100);
    assert.ok(events.some((e) => e.startsWith('auth_revoked')), 'auth_revoked sent: ' + events.join(','));
    assert.ok(events.indexOf('close:4001') !== -1, 'socket closed with 4001: ' + events.join(','));
    const alive = await rq({ path: '/api/auth/alive?code=' + code });
    assert.equal(alive.json.alive, false);
    const again = await rq({ path: '/api/auth/guest-allowed', headers: { 'X-Device-Id': DEV } });
    assert.equal(again.json.guestProgress || null, null);
  });

  it('does not throttle failed logins or registrations by default', async () => {
    for (let i = 0; i < 40; i++) {
      const r = await rq({ path: '/api/auth/login', method: 'POST', headers: { 'X-Device-Id': 'nolimitdevice0000001' } },
        { login: 'nobody_here', password: 'wrong-pass-1' });
      assert.equal(r.status, 401, 'attempt ' + i);
    }
    for (let i = 0; i < 25; i++) {
      const r = await rq({ path: '/api/auth/register', method: 'POST', headers: { 'X-Device-Id': 'nolimitdevice0000001' } },
        { login: 'free_user_' + i, password: 'secret-pass-1' });
      assert.ok(r.status === 200 || r.status === 201, 'register ' + i + ' -> ' + r.status);
    }
  });
});
