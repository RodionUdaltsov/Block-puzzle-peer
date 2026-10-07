/**
 * v9.2: match token alone is not enough to take a seat — the socket's verified identity must match.
 */
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const { WebSocket } = require('../vendor/ws');
const R = require('../shared/rules');

const ROOT = path.join(__dirname, '..');
const PORT = 20100 + (process.pid % 800);

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function waitHealth(timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 10000);
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get({ host: '127.0.0.1', port: PORT, path: '/health', timeout: 500 }, (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          if (res.statusCode === 200) resolve(body);
          else if (Date.now() > deadline) reject(new Error('health not ready'));
          else setTimeout(tryOnce, 100);
        });
      });
      req.on('error', () => {
        if (Date.now() > deadline) reject(new Error('health connect fail'));
        else setTimeout(tryOnce, 100);
      });
    };
    tryOnce();
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
  send(obj) {
    this.ws.send(JSON.stringify(obj));
  }
  wait(pred, timeoutMs) {
    for (const d of this.inbox) {
      if (pred(d)) return Promise.resolve(d);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.indexOf(entry);
        if (idx >= 0) this.waiters.splice(idx, 1);
        reject(new Error('timeout waiting for message'));
      }, timeoutMs || 10000);
      const entry = { pred, resolve, reject, timer };
      this.waiters.push(entry);
    });
  }
  close() {
    try { this.ws.close(); } catch (_) {}
  }
}

function bindGuest(device, friendCode) {
  const body = JSON.stringify({ progress: { friendCode, ts: 1 } });
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1', port: PORT, path: '/api/auth/guest-bind', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'X-Device-Id': device }
    }, (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
    req.on('error', reject);
    req.end(body);
  });
}

function connect(device) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`, { headers: device ? { 'X-Device-Id': device } : {} });
    const t = setTimeout(() => reject(new Error('connect timeout')), 5000);
    ws.once('open', () => {
      clearTimeout(t);
      resolve(new Client(ws));
    });
    ws.once('error', (e) => { clearTimeout(t); reject(e); });
  });
}


describe('e2e: rejoin needs token + identity', () => {
  let child;
  before(async () => {
    child = spawn(process.execPath, ['server.js'], {
      cwd: ROOT,
      env: { ...process.env, PORT: String(PORT), BP_STORE: 'memory' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    await waitHealth(12000);
  });
  after(async () => {
    if (child && !child.killed) {
      child.kill('SIGTERM');
      await wait(400);
      try { child.kill('SIGKILL'); } catch (_) {}
    }
  });

  async function startMatch(ca, cb, da, db) {
    await bindGuest(da, ca);
    await bindGuest(db, cb);
    const a = await connect(da);
    const b = await connect(db);
    await a.wait((d) => d.type === 'hello', 5000);
    await b.wait((d) => d.type === 'hello', 5000);
    a.send({ type: 'presence_register', friendCode: ca, name: 'Alice' });
    b.send({ type: 'presence_register', friendCode: cb, name: 'Bob' });
    await wait(300);
    a.send({ type: 'join_queue', name: 'Alice', trophies: 100, duration: 60, clientId: 'ca-' + Date.now() });
    b.send({ type: 'join_queue', name: 'Bob', trophies: 100, duration: 60, clientId: 'cb-' + Date.now() });
    const foundA = await a.wait((d) => d.type === 'match_found', 12000);
    const foundB = await b.wait((d) => d.type === 'match_found', 12000);
    a.send({ type: 'match_ready', matchId: foundA.matchId, token: foundA.token });
    b.send({ type: 'match_ready', matchId: foundB.matchId, token: foundB.token });
    await wait(500);
    return { a, b, foundA };
  }

  it('a socket with another identity cannot take the seat with a leaked token', async () => {
    const { a, b, foundA } = await startMatch('AAAA1111', 'BBBB2222', 'rejoindevice000000a1', 'rejoindevice000000b1');
    const evil = await connect('rejoindevice000000ee');
    await evil.wait((d) => d.type === 'hello', 5000);
    evil.send({ type: 'presence_register', friendCode: 'EVIL9999', name: 'Eve' });
    evil.send({ type: 'rejoin', matchId: foundA.matchId, token: foundA.token });
    const res = await evil.wait((d) => d.type === 'rejoin_fail' || d.type === 'rejoin_ok', 5000);
    assert.equal(res.type, 'rejoin_fail');
    assert.equal(res.reason, 'bad_token');
    // an unregistered socket is refused as well
    const anon = await connect();
    await anon.wait((d) => d.type === 'hello', 5000);
    anon.send({ type: 'rejoin', matchId: foundA.matchId, token: foundA.token });
    const res2 = await anon.wait((d) => d.type === 'rejoin_fail' || d.type === 'rejoin_ok', 5000);
    assert.equal(res2.type, 'rejoin_fail');
    // stray in-match messages with a foreign token do not attach either
    anon.send({ type: 'place', matchId: foundA.matchId, token: foundA.token, pieceIdx: 0, r: 0, c: 0 });
    const rej = await anon.wait((d) => d.type === 'place_reject', 5000);
    assert.equal(rej.reason, 'no_match');
    [a, b, evil, anon].forEach((c) => c.close());
  });

  it('the rightful player reconnecting with the same identity gets the seat back', async () => {
    const { a, b, foundA } = await startMatch('CCCC3333', 'DDDD4444', 'rejoindevice000000a2', 'rejoindevice000000b2');
    a.close();
    await wait(400);
    const a2 = await connect('rejoindevice000000a2');
    await a2.wait((d) => d.type === 'hello', 5000);
    a2.send({ type: 'presence_register', friendCode: 'CCCC3333', name: 'Alice' });
    a2.send({ type: 'rejoin', matchId: foundA.matchId, token: foundA.token });
    const res = await a2.wait((d) => d.type === 'rejoin_fail' || d.type === 'rejoin_ok', 5000);
    assert.equal(res.type, 'rejoin_ok', JSON.stringify(a2.inbox.map((m) => [m.type, m.friendCode, m.reassigned, m.reason])));
    [a2, b].forEach((c) => c.close());
  });
});
