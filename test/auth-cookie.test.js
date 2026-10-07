/**
 * v9.3: the session token lives in an HttpOnly cookie (web client) — never in the JSON body / JS storage.
 */
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const { WebSocket } = require('../vendor/ws');

const ROOT = path.join(__dirname, '..');
const PORT = 21100 + (process.pid % 500);
const ORIGIN = 'http://127.0.0.1:' + PORT;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function rq(opts, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({
      host: '127.0.0.1', port: PORT, path: opts.path, method: opts.method || 'GET',
      headers: Object.assign(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}, opts.headers || {})
    }, (res) => {
      let b = ''; res.on('data', (c) => { b += c; });
      res.on('end', () => {
        let json = null; try { json = JSON.parse(b); } catch (_) {}
        resolve({ status: res.statusCode, json, headers: res.headers, setCookie: [].concat(res.headers['set-cookie'] || []) });
      });
    });
    r.on('error', reject); if (data) r.write(data); r.end();
  });
}

async function openWs(device, extraHeaders) {
  const headers = Object.assign({ 'X-Device-Id': device }, extraHeaders || {});
  const ws = new WebSocket('ws://127.0.0.1:' + PORT + '/ws', { headers });
  const got = [];
  ws.on('message', (m) => { try { got.push(JSON.parse(String(m))); } catch (_) {} });
  await new Promise((res, rej) => { ws.on('open', res); ws.on('error', rej); });
  const c = {
    ws, got,
    send(o) { ws.send(JSON.stringify(o)); },
    async nextPresence(afterCount) {
      const end = Date.now() + 2500;
      while (Date.now() < end) {
        const hits = got.filter((m) => m.type === 'presence_ok');
        if (hits.length > (afterCount || 0)) return hits[hits.length - 1];
        await wait(40);
      }
      return null;
    }
  };
  return c;
}

const cookieOf = (setCookie) => {
  const c = setCookie.find((x) => /^bp_token=/.test(x));
  return c ? c.split(';')[0] : '';
};

describe('HttpOnly session cookie', () => {
  let child;
  let acc; // { cookie, code, ticket }

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
    const reg = await rq({ path: '/api/auth/register', method: 'POST', headers: { 'X-Device-Id': 'cookiedevice0000001', 'X-Auth-Cookie': '1' } },
      { login: 'cookie_user', password: 'secret-pass-1' });
    assert.ok(reg.json && reg.json.ok, JSON.stringify(reg.json));
    acc = { cookie: cookieOf(reg.setCookie), code: reg.json.account.friendCode, ticket: reg.json.wsTicket, reg };
  });
  after(async () => {
    try { child.kill('SIGTERM'); await wait(200); child.kill('SIGKILL'); } catch (_) {}
  });

  it('cookie mode: HttpOnly cookie is set and the token is NOT in the response body', () => {
    const raw = acc.reg.setCookie.find((x) => /^bp_token=/.test(x));
    assert.ok(raw, 'Set-Cookie bp_token');
    assert.match(raw, /HttpOnly/);
    assert.match(raw, /SameSite=Lax/);
    assert.equal(acc.reg.json.token, undefined);
    assert.equal(acc.reg.json.sessionCookie, true);
    assert.ok(acc.ticket && acc.ticket.length >= 32);
  });

  it('API clients without X-Auth-Cookie still get the token in the body (Bearer)', async () => {
    const r = await rq({ path: '/api/auth/register', method: 'POST', headers: { 'X-Device-Id': 'cookiedevice0000002' } },
      { login: 'bearer_user', password: 'secret-pass-1' });
    assert.ok(r.json.ok && r.json.token);
    assert.equal(cookieOf(r.setCookie), '');
    const me = await rq({ path: '/api/me', headers: { Authorization: 'Bearer ' + r.json.token } });
    assert.equal(me.status, 200);
  });

  it('the cookie alone authenticates (also with the "cookie" bearer marker)', async () => {
    const a = await rq({ path: '/api/me', headers: { Cookie: acc.cookie } });
    assert.equal(a.status, 200);
    assert.equal(a.json.account.friendCode, acc.code);
    const b = await rq({ path: '/api/me', headers: { Cookie: acc.cookie, Authorization: 'Bearer cookie' } });
    assert.equal(b.status, 200);
  });

  it('CSRF: cookie-authenticated writes from a foreign origin are refused', async () => {
    const evil = await rq({ path: '/api/me', method: 'PATCH', headers: { Cookie: acc.cookie, Origin: 'https://evil.example' } }, { status: 'pwned' });
    assert.equal(evil.status, 401);
    const cross = await rq({ path: '/api/me', method: 'PATCH', headers: { Cookie: acc.cookie, 'Sec-Fetch-Site': 'cross-site' } }, { status: 'pwned' });
    assert.equal(cross.status, 401);
    const ok = await rq({ path: '/api/me', method: 'PATCH', headers: { Cookie: acc.cookie, Origin: ORIGIN } }, { status: 'fine' });
    assert.equal(ok.status, 200);
    assert.equal(ok.json.account.status, 'fine');
  });

  it('WebSocket: the cookie sent with the upgrade authenticates a presence_register marker', async () => {
    const c = await openWs('cookiedevice0000001', { Cookie: acc.cookie });
    c.send({ type: 'presence_register', friendCode: acc.code, authToken: 'cookie', name: 'C' });
    const ok = await c.nextPresence();
    assert.ok(ok);
    assert.equal(ok.authenticated, true);
    assert.equal(ok.friendCode, acc.code);
    c.ws.close();
  });

  it('WebSocket: a one-time ticket authenticates an already-open socket, once; the marker then keeps working', async () => {
    const c = await openWs('cookiedevice0000009'); // socket opened BEFORE the cookie existed
    c.send({ type: 'presence_register', friendCode: acc.code, authToken: 'cookie', name: 'C' });
    const first = await c.nextPresence(0);
    assert.equal(first.authenticated, false, 'no cookie on this socket and marker only');
    c.send({ type: 'presence_register', friendCode: acc.code, authToken: 'ticket:' + acc.ticket, name: 'C' });
    const viaTicket = await c.nextPresence(1);
    assert.equal(viaTicket.authenticated, true);
    assert.equal(viaTicket.friendCode, acc.code);
    c.send({ type: 'presence_register', friendCode: acc.code, authToken: 'cookie', name: 'C2' });
    const again = await c.nextPresence(2);
    assert.equal(again.authenticated, true, 'marker re-register reuses the ticket-proven session');
    // the ticket is single use
    const d = await openWs('cookiedevice0000010');
    d.send({ type: 'presence_register', friendCode: acc.code, authToken: 'ticket:' + acc.ticket, name: 'D' });
    const reuse = await d.nextPresence(0);
    assert.equal(reuse.authenticated, false);
    c.ws.close(); d.ws.close();
  });

  it('a legacy Bearer session is upgraded to the cookie on the next request', async () => {
    const r = await rq({ path: '/api/auth/login', method: 'POST', headers: { 'X-Device-Id': 'cookiedevice0000003' } },
      { login: 'cookie_user', password: 'secret-pass-1' });
    assert.ok(r.json.ok && r.json.token);
    const me = await rq({ path: '/api/me', headers: { Authorization: 'Bearer ' + r.json.token, 'X-Auth-Cookie': '1' } });
    assert.equal(me.status, 200);
    assert.equal(me.headers['x-session-cookie'], 'set');
    assert.match(me.setCookie.find((x) => /^bp_token=/.test(x)) || '', /HttpOnly/);
  });

  it('logout clears the cookie and the session stops working', async () => {
    const r = await rq({ path: '/api/auth/login', method: 'POST', headers: { 'X-Device-Id': 'cookiedevice0000004', 'X-Auth-Cookie': '1' } },
      { login: 'cookie_user', password: 'secret-pass-1' });
    const cookie = cookieOf(r.setCookie);
    assert.ok(cookie);
    const out = await rq({ path: '/api/auth/logout', method: 'POST', headers: { Cookie: cookie, Origin: ORIGIN, 'X-Auth-Cookie': '1' } }, {});
    assert.equal(out.status, 200);
    assert.match(out.setCookie.find((x) => /^bp_token=/.test(x)) || '', /Max-Age=0/);
    const me = await rq({ path: '/api/me', headers: { Cookie: cookie } });
    assert.equal(me.status, 401);
  });
});
