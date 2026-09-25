/**
 * E2E: HTTP accounts API + private lobby happy path over WebSocket.
 */
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const { WebSocket } = require('../vendor/ws');

const ROOT = path.join(__dirname, '..');
const PORT = 19300 + (process.pid % 600);

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function waitHealth(timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 12000);
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get({ host: '127.0.0.1', port: PORT, path: '/health', timeout: 500 }, (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          if (res.statusCode === 200) resolve(JSON.parse(body || '{}'));
          else if (Date.now() > deadline) reject(new Error('health not ready'));
          else setTimeout(tryOnce, 80);
        });
      });
      req.on('error', () => {
        if (Date.now() > deadline) reject(new Error('health connect fail'));
        else setTimeout(tryOnce, 80);
      });
    };
    tryOnce();
  });
}

function request(method, urlPath, { body, token } = {}) {
  const payload = body != null ? JSON.stringify(body) : null;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (payload) headers['Content-Length'] = Buffer.byteLength(payload);
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1',
      port: PORT,
      path: urlPath,
      method,
      headers
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        let json = null;
        try { json = data ? JSON.parse(data) : null; } catch (_) { json = { raw: data }; }
        resolve({ status: res.statusCode, data: json });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

class Client {
  constructor(ws) {
    this.ws = ws;
    this.inbox = [];
    this.waiters = [];
    ws.on('message', (raw) => {
      let data;
      try { data = JSON.parse(String(raw)); } catch (_) { return; }
      this.inbox.push(data);
      for (let i = this.waiters.length - 1; i >= 0; i--) {
        const w = this.waiters[i];
        if (w.pred(data)) {
          clearTimeout(w.timer);
          this.waiters.splice(i, 1);
          w.resolve(data);
        }
      }
    });
  }
  send(obj) { this.ws.send(JSON.stringify(obj)); }
  wait(pred, timeoutMs) {
    for (const d of this.inbox) {
      if (pred(d)) return Promise.resolve(d);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.indexOf(entry);
        if (idx >= 0) this.waiters.splice(idx, 1);
        reject(new Error('timeout waiting for message'));
      }, timeoutMs || 8000);
      const entry = { pred, resolve, reject, timer };
      this.waiters.push(entry);
    });
  }
  close() { try { this.ws.close(); } catch (_) {} }
}

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://127.0.0.1:' + PORT + '/ws');
    const t = setTimeout(() => reject(new Error('ws open timeout')), 5000);
    ws.on('open', () => {
      clearTimeout(t);
      resolve(new Client(ws));
    });
    ws.on('error', (e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

describe('api + private lobby e2e', () => {
  let child;

  before(async () => {
    child = spawn(process.execPath, ['server.js'], {
      cwd: ROOT,
      env: { ...process.env, PORT: String(PORT), BP_STORE: 'memory', BP_LOG: 'error' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    await waitHealth(15000);
  });

  after(async () => {
    if (child && !child.killed) {
      child.kill('SIGTERM');
      await wait(250);
      try { child.kill('SIGKILL'); } catch (_) {}
    }
  });

  it('register → login → me → delete account', async () => {
    const login = 'e2e_' + Date.now().toString(36).slice(-8);
    const password = 'secret12';

    const reg = await request('POST', '/api/auth/register', {
      body: { login, password, nick: 'E2E' }
    });
    assert.equal(reg.status, 201);
    assert.equal(reg.data.ok, true);
    assert.ok(reg.data.token);
    assert.equal(reg.data.account.login, login);

    const me1 = await request('GET', '/api/me', { token: reg.data.token });
    assert.equal(me1.status, 200);
    assert.equal(me1.data.account.nick, 'E2E');

    const badDel = await request('POST', '/api/auth/delete', {
      token: reg.data.token,
      body: { password: 'wrong-password' }
    });
    assert.equal(badDel.status, 403);

    const del = await request('POST', '/api/auth/delete', {
      token: reg.data.token,
      body: { password }
    });
    assert.equal(del.status, 200);
    assert.equal(del.data.ok, true);

    const me2 = await request('GET', '/api/me', { token: reg.data.token });
    assert.equal(me2.status, 401);

    const loginAgain = await request('POST', '/api/auth/login', {
      body: { login, password }
    });
    assert.equal(loginAgain.status, 401);
  });

  it('private lobby: create → join → both ready → match_found', async () => {
    const host = await connect();
    const guest = await connect();
    await host.wait((m) => m.type === 'hello');
    await guest.wait((m) => m.type === 'hello');

    host.send({
      type: 'create_private',
      name: 'Host',
      trophies: 100,
      duration: 120,
      skinId: 'default',
      boardId: 'field_default'
    });
    const created = await host.wait((m) => m.type === 'private_lobby' || m.type === 'private_error');
    assert.equal(created.type, 'private_lobby');
    assert.ok(created.code);
    const code = created.code;

    guest.send({
      type: 'join_private',
      code,
      name: 'Guest',
      trophies: 110,
      skinId: 'default',
      boardId: 'field_default'
    });
    const guestLobby = await guest.wait((m) => m.type === 'private_lobby' || m.type === 'private_error');
    assert.equal(guestLobby.type, 'private_lobby');
    assert.equal(guestLobby.code, code);
    assert.equal(guestLobby.role, 'guest');

    // Host may get updated snapshot when guest joins
    await host.wait((m) => m.type === 'private_lobby' && m.opp, 5000).catch(() => null);

    host.send({ type: 'private_ready', ready: true, code });
    guest.send({ type: 'private_ready', ready: true, code });

    const hostMatch = await host.wait((m) => m.type === 'match_found', 8000);
    const guestMatch = await guest.wait((m) => m.type === 'match_found', 8000);
    assert.equal(hostMatch.type, 'match_found');
    assert.equal(guestMatch.type, 'match_found');
    assert.equal(hostMatch.matchId, guestMatch.matchId);
    assert.ok(hostMatch.token);
    assert.ok(guestMatch.token);

    host.close();
    guest.close();
  });
});
