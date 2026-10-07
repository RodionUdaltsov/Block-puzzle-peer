/**
 * Authentication boundary between a PUBLIC friend code and an AUTHENTICATED identity.
 *
 * A friend code is an identifier (visible in search / presence / friends lists), never a
 * credential. These tests prove that knowing someone's friend code does not let a client
 * impersonate them over WebSocket (presence, cosmetics, social, private lobby) or over the
 * guest-bind / register HTTP paths that feed the same identity.
 */
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const { WebSocket } = require('../vendor/ws');

const ROOT = path.join(__dirname, '..');
const PORT = 19300 + (process.pid % 500);
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

async function openWs(device, extraHeaders) {
  const headers = Object.assign(device ? { 'X-Device-Id': device } : {}, extraHeaders || {});
  const ws = new WebSocket('ws://127.0.0.1:' + PORT + '/ws', { headers });
  const got = [];
  ws.on('message', (m) => { try { got.push(JSON.parse(String(m))); } catch (_) {} });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  const c = {
    ws, got,
    send(o) { ws.send(JSON.stringify(o)); },
    last(type) { for (let i = got.length - 1; i >= 0; i--) if (got[i].type === type) return got[i]; return null; },
    async waitFor(type, ms) {
      const end = Date.now() + (ms || 2500);
      while (Date.now() < end) { const m = c.last(type); if (m) return m; await wait(40); }
      return null;
    }
  };
  return c;
}

describe('ws identity: friend code is an identifier, not a credential', () => {
  let child;
  const DEV_A = 'victimdevice00000001';
  let A; // victim: registered account

  before(async () => {
    child = spawn(process.execPath, ['server.js'], {
      cwd: ROOT,
      env: { ...process.env, PORT: String(PORT), BP_STORE: 'memory', BP_LOG: 'error' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const deadline = Date.now() + 15000;
    for (;;) {
      try { const r = await rq({ path: '/health' }); if (r.status === 200) break; } catch (_) {}
      if (Date.now() > deadline) throw new Error('server did not start');
      await wait(100);
    }
    const reg = await rq({ path: '/api/auth/register', method: 'POST', headers: { 'X-Device-Id': DEV_A } },
      { login: 'victim_a', password: 'secret-pass-1' });
    assert.ok(reg.json && reg.json.ok, JSON.stringify(reg.json));
    A = { token: reg.json.token, code: reg.json.account.friendCode, diamonds: reg.json.account.diamonds };
    assert.ok(A.token && A.code);
  });
  after(async () => {
    try { child.kill('SIGTERM'); await wait(200); child.kill('SIGKILL'); } catch (_) {}
  });

  const meOf = async (acc) => (await rq({ path: '/api/me', headers: { Authorization: 'Bearer ' + acc.token } })).json.account;

  it('presence_register with a victim friendCode (no session) does NOT adopt it', async () => {
    const atk = await openWs('attackerdevice0000001');
    atk.send({ type: 'presence_register', friendCode: A.code, name: 'Evil' });
    const ok = await atk.waitFor('presence_ok');
    assert.ok(ok, 'got presence_ok');
    assert.notEqual(ok.friendCode, A.code, 'attacker must not become the victim');
    assert.equal(ok.authenticated, false);
    assert.equal(ok.claimRejected, 'auth_required');
    atk.ws.close();
  });

  it('a bogus session token + victim friendCode is rejected as well', async () => {
    const atk = await openWs('attackerdevice0000002');
    atk.send({ type: 'presence_register', friendCode: A.code, authToken: 'not-a-real-token' });
    const ok = await atk.waitFor('presence_ok');
    assert.ok(ok);
    assert.notEqual(ok.friendCode, A.code);
    assert.equal(ok.authenticated, false);
    assert.equal(ok.claimRejected, 'invalid_session');
    atk.ws.close();
  });

  it('cosmetics_buy with the victim friendCode cannot spend the victim\'s diamonds / change inventory', async () => {
    const before = await meOf(A);
    // (a) socket that never registered presence
    const a = await openWs('attackerdevice0000003');
    a.send({ type: 'cosmetics_buy', friendCode: A.code, kind: 'skin', id: 'sunset' });
    const ra = await a.waitFor('cosmetics_buy_result');
    assert.ok(ra && ra.ok === false && ra.error === 'no_profile', JSON.stringify(ra));
    // (b) socket that registered presence claiming the victim's code
    const b = await openWs('attackerdevice0000004');
    b.send({ type: 'presence_register', friendCode: A.code });
    await b.waitFor('presence_ok');
    b.send({ type: 'cosmetics_buy', friendCode: A.code, kind: 'skin', id: 'sunset' });
    b.send({ type: 'cosmetics_equip', friendCode: A.code, kind: 'skin', id: 'sunset' });
    await wait(600);
    const after = await meOf(A);
    assert.equal(after.diamonds, before.diamonds, 'victim diamonds unchanged');
    assert.deepEqual(after.ownedSkins, before.ownedSkins, 'victim inventory unchanged');
    assert.equal(after.skinId, before.skinId, 'victim equipped skin unchanged');
    a.ws.close(); b.ws.close();
  });

  it('cosmetics_get with the victim friendCode never returns the victim\'s profile', async () => {
    const a = await openWs('attackerdevice0000005');
    a.send({ type: 'cosmetics_get', friendCode: A.code });
    const st = await a.waitFor('cosmetics_state');
    assert.ok(st && st.ok === false && st.error === 'no_profile', JSON.stringify(st));
    a.ws.close();
  });

  it('a valid session token binds the socket to the account whatever friendCode is claimed', async () => {
    const me0 = await meOf(A);
    const c = await openWs(DEV_A);
    c.send({ type: 'presence_register', friendCode: 'ZZZZZZZZ', authToken: A.token, name: 'A' });
    const ok = await c.waitFor('presence_ok');
    assert.ok(ok);
    assert.equal(ok.friendCode, A.code);
    assert.equal(ok.authenticated, true);
    c.send({ type: 'cosmetics_buy', kind: 'skin', id: 'ocean' });
    const res = await c.waitFor('cosmetics_buy_result');
    assert.ok(res && res.ok === true, JSON.stringify(res));
    const me1 = await meOf(A);
    assert.ok(me1.diamonds < me0.diamonds, 'the legitimate owner is charged');
    assert.ok((me1.ownedSkins || []).includes('ocean'));
    c.ws.close();
  });

  it('social_send: "from" is ignored, the sender is the verified identity', async () => {
    const target = await openWs('targetdevice000000001');
    target.send({ type: 'presence_register', name: 'T' });
    const tOk = await target.waitFor('presence_ok');
    const atk = await openWs('attackerdevice0000006');
    atk.send({ type: 'presence_register', name: 'Evil' });
    const aOk = await atk.waitFor('presence_ok');
    atk.send({ type: 'social_send', to: tOk.friendCode, from: A.code, msgType: 'friend_req', payload: { from: A.code, code: A.code } });
    const msg = await target.waitFor('social_msg');
    assert.ok(msg && msg.msg, 'target got the message');
    assert.equal(msg.msg.from, aOk.friendCode, 'sender is the attacker\'s real identity');
    assert.equal(msg.msg.code, aOk.friendCode);
    assert.notEqual(msg.msg.from, A.code);
    target.ws.close(); atk.ws.close();
  });

  it('social_send without any identity is refused (no spoofing via "from")', async () => {
    const target = await openWs('targetdevice000000002');
    target.send({ type: 'presence_register' });
    const tOk = await target.waitFor('presence_ok');
    // Socket that never registered presence at all, and has no device-bound guest
    const anon = await openWs('anonymousdevice00001');
    anon.send({ type: 'social_send', to: tOk.friendCode, from: A.code, msgType: 'friend_req' });
    const r = await anon.waitFor('social_result');
    assert.ok(r && r.ok === false && r.reason === 'not_authenticated', JSON.stringify(r));
    await wait(200);
    assert.equal(target.last('social_msg'), null, 'target received nothing');
    target.ws.close(); anon.ws.close();
  });

  it('private lobby ignores a client-supplied friendCode (host and guest)', async () => {
    const host = await openWs('lobbyhostdevice000001');
    host.send({ type: 'create_private', friendCode: A.code, name: 'H' });
    const snap = await host.waitFor('private_lobby');
    assert.ok(snap && snap.code);
    const guest = await openWs('lobbyguestdevice00001');
    guest.send({ type: 'join_private', code: snap.code, friendCode: A.code, name: 'G' });
    const gSnap = await guest.waitFor('private_lobby');
    assert.ok(gSnap && gSnap.opp, 'guest sees the host');
    assert.equal(gSnap.opp.friendCode, null, 'host identity is not the claimed victim code');
    await wait(150);
    const hSnap = host.last('private_lobby');
    assert.ok(hSnap && hSnap.opp);
    assert.equal(hSnap.opp.friendCode, null, 'guest identity is not the claimed victim code');
    host.ws.close(); guest.ws.close();
  });

  it('a reconnecting host gets its private lobby back only after re-proving identity', async () => {
    const h1 = await openWs(DEV_A);
    h1.send({ type: 'presence_register', authToken: A.token });
    await h1.waitFor('presence_ok');
    h1.send({ type: 'create_private' });
    const snap = await h1.waitFor('private_lobby');
    assert.ok(snap && snap.code && snap.role === 'host');
    h1.ws.close();
    await wait(250);
    // someone claiming the host's friend code does NOT get the lobby
    const thief = await openWs('attackerdevice0000007');
    thief.send({ type: 'presence_register', friendCode: A.code });
    await thief.waitFor('presence_ok');
    await wait(250);
    assert.equal(thief.last('private_lobby'), null, 'claim alone does not reattach');
    // the real owner (session token) does
    const h2 = await openWs(DEV_A);
    h2.send({ type: 'presence_register', authToken: A.token });
    const back = await h2.waitFor('private_lobby');
    assert.ok(back && back.code === snap.code && back.role === 'host');
    h2.ws.close(); thief.ws.close();
  });

  it('logout drops the socket identity immediately', async () => {
    const reg = await rq({ path: '/api/auth/register', method: 'POST', headers: { 'X-Device-Id': 'logoutdevice0000000001' } },
      { login: 'logout_user', password: 'secret-pass-1' });
    const U = { token: reg.json.token, code: reg.json.account.friendCode };
    const c = await openWs('logoutdevice0000000001');
    c.send({ type: 'presence_register', authToken: U.token });
    await c.waitFor('presence_ok');
    await rq({ path: '/api/auth/logout', method: 'POST', headers: { Authorization: 'Bearer ' + U.token } }, {});
    c.send({ type: 'cosmetics_buy', kind: 'skin', id: 'ocean' });
    const r = await c.waitFor('cosmetics_buy_result');
    assert.ok(r && r.ok === false && ['no_profile', 'not_authenticated'].includes(r.error), JSON.stringify(r));
    c.ws.close();
  });

  it('guest-sync / guest-bind cannot attach another device\'s guest code to this device', async () => {
    const VICTIM_DEV = 'guestvictimdevice00001';
    const ATK_DEV = 'guestattackerdevice001';
    const GCODE = 'GUESTAB2';
    const r1 = await rq({ path: '/api/auth/guest-sync', method: 'POST', headers: { 'X-Device-Id': VICTIM_DEV } },
      { progress: { friendCode: GCODE, nick: 'Victim' } });
    assert.equal(r1.status, 200);
    assert.equal(r1.json.guestProgress.friendCode, GCODE, 'legit device owns its code');
    const r2 = await rq({ path: '/api/auth/guest-sync', method: 'POST', headers: { 'X-Device-Id': ATK_DEV } },
      { progress: { friendCode: GCODE, nick: 'Evil' } });
    assert.equal(r2.status, 200);
    assert.notEqual(r2.json.guestProgress && r2.json.guestProgress.friendCode, GCODE, 'attacker device did not take the code');
    const r3 = await rq({ path: '/api/auth/guest-bind', method: 'POST', headers: { 'X-Device-Id': 'guestattackerdevice002' } },
      { progress: { friendCode: GCODE } });
    assert.notEqual(r3.json.guestProgress && r3.json.guestProgress.friendCode, GCODE);
    // and over WS the attacker device cannot claim it either
    const atk = await openWs(ATK_DEV);
    atk.send({ type: 'presence_register', friendCode: GCODE });
    const ok = await atk.waitFor('presence_ok');
    assert.notEqual(ok.friendCode, GCODE);
    // while the real device keeps it
    const vic = await openWs(VICTIM_DEV);
    vic.send({ type: 'presence_register', friendCode: 'WHATEVER' });
    const vOk = await vic.waitFor('presence_ok');
    assert.equal(vOk.friendCode, GCODE, 'device cookie/header is the guest credential');
    atk.ws.close(); vic.ws.close();
  });

  it('register cannot inherit another guest\'s identity via preferredFriendCode', async () => {
    const VICTIM_DEV = 'regvictimdevice0000001';
    const GCODE = 'GUESTCD3';
    await rq({ path: '/api/auth/guest-sync', method: 'POST', headers: { 'X-Device-Id': VICTIM_DEV } },
      { progress: { friendCode: GCODE, nick: 'Victim' } });
    const reg = await rq({ path: '/api/auth/register', method: 'POST', headers: { 'X-Device-Id': 'regattackerdevice000001' } },
      { login: 'evil_reg', password: 'secret-pass-1', preferredFriendCode: GCODE, guestProgress: { friendCode: GCODE } });
    assert.ok(reg.json && reg.json.ok, JSON.stringify(reg.json));
    assert.notEqual(reg.json.account.friendCode, GCODE);
  });

  it('WebSocket Origin: cross-site browsers are refused, same-origin and non-browser clients work', async () => {
    const tryOrigin = (origin) => new Promise((resolve) => {
      const ws = new WebSocket('ws://127.0.0.1:' + PORT + '/ws', origin ? { headers: { Origin: origin } } : {});
      ws.on('open', () => { ws.close(); resolve('open'); });
      ws.on('unexpected-response', (_req, res) => resolve('http-' + res.statusCode));
      ws.on('error', () => resolve('error'));
    });
    assert.equal(await tryOrigin('https://evil.example'), 'http-403');
    assert.equal(await tryOrigin('http://127.0.0.1:' + PORT), 'open');
    assert.equal(await tryOrigin(null), 'open');
  });

  it('CSP: scripts are nonce-based, every inline <script> carries the per-response nonce', async () => {
    const get = () => new Promise((resolve, reject) => {
      http.get({ host: '127.0.0.1', port: PORT, path: '/', headers: { 'Accept-Encoding': 'identity' } }, (res) => {
        let b = ''; res.on('data', (c) => { b += c; }); res.on('end', () => resolve({ res, body: b }));
      }).on('error', reject);
    });
    const a = await get();
    const csp = String(a.res.headers['content-security-policy']);
    const m = /script-src 'self' 'nonce-([^']+)'/.exec(csp);
    assert.ok(m, csp);
    assert.ok(!/script-src[^;]*unsafe-inline/.test(csp), 'no unsafe-inline for scripts');
    const scripts = a.body.match(/<script\b[^>]*>/gi) || [];
    assert.ok(scripts.length >= 1);
    for (const t of scripts) assert.ok(/src=/.test(t) || t.includes('nonce="' + m[1] + '"'), 'script without nonce: ' + t);
    assert.ok(!/\son(click|change|input|load|error)=/i.test(a.body), 'no inline event handlers');
    assert.equal(a.res.headers['cache-control'], 'no-store');
    const b = await get();
    assert.notEqual(/nonce-([^']+)/.exec(String(b.res.headers['content-security-policy']))[1], m[1], 'fresh nonce per response');
  });
});

describe('ws identity: server-side units', () => {
  it('genPrivateCode uses a CSPRNG (never Math.random)', () => {
    const { createMatchmakingApi } = require('../lib/matchmaking');
    const api = createMatchmakingApi({ hooks: {}, log() {}, MatchRoom: function () {}, uid: () => 'x' });
    const orig = Math.random;
    Math.random = () => { throw new Error('Math.random must not be used for lobby codes'); };
    try {
      const codes = new Set();
      for (let i = 0; i < 50; i++) {
        const c = api.genPrivateCode();
        assert.match(c, /^[A-HJ-NP-Z2-9]{7}$/);
        codes.add(c);
      }
      assert.ok(codes.size > 40, 'codes are not constant');
    } finally { Math.random = orig; }
  });

  it('markDevicesAfterAccountDelete lives in the device service (shared by admin + self-delete)', async () => {
    const { createDeviceApi } = require('../lib/device');
    const queries = [];
    const store = {
      pool: {
        query: async (sql, params) => {
          queries.push(String(sql));
          if (/SELECT device_id/.test(sql)) return { rows: [{ device_id: 'dev1', account_ids: ['acc1'], guest_progress: null }] };
          return { rows: [] };
        }
      }
    };
    const api = createDeviceApi({
      hooks: { store, isFriendCodeDeleted: () => false, isFriendCodeDeletedAsync: async () => false },
      Cosmetics: { defaultProfile: () => ({ diamonds: 0 }) }
    });
    assert.equal(typeof api.markDevicesAfterAccountDelete, 'function');
    await api.markDevicesAfterAccountDelete('acc1', null);
    assert.ok(queries.some((q) => /DELETE FROM device_binds/.test(q)), 'orphaned device bind is released');
    // regression guard: the self-delete route must not reference an out-of-scope helper
    const src = require('fs').readFileSync(path.join(ROOT, 'lib/http/routes/auth-account.js'), 'utf8');
    assert.match(src, /markDevicesAfterAccountDelete,\n/, 'destructured from ctx');
    assert.doesNotMatch(src, /KNOWN PRE-EXISTING ISSUE/);
  });

  it('isOriginAllowed: same-origin default, explicit allowlist and wildcard are distinct', () => {
    const run = (env, fn) => {
      const saved = process.env.BP_WS_ORIGINS;
      if (env == null) delete process.env.BP_WS_ORIGINS; else process.env.BP_WS_ORIGINS = env;
      delete require.cache[require.resolve('../lib/security')];
      try { return fn(require('../lib/security')); } finally {
        if (saved == null) delete process.env.BP_WS_ORIGINS; else process.env.BP_WS_ORIGINS = saved;
        delete require.cache[require.resolve('../lib/security')];
      }
    };
    run(null, (s) => {
      assert.equal(s.isOriginAllowed('https://game.example', 'game.example'), true);
      assert.equal(s.isOriginAllowed('https://evil.example', 'game.example'), false);
      assert.equal(s.isOriginAllowed('', 'game.example'), true);
    });
    run('https://a.example,https://b.example', (s) => {
      assert.equal(s.isOriginAllowed('https://a.example', 'x'), true);
      assert.equal(s.isOriginAllowed('https://evil.example', 'evil.example'), false);
    });
    run('*', (s) => assert.equal(s.isOriginAllowed('https://anything.example', 'x'), true));
  });
});
