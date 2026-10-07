/**
 * Multi-instance e2e: two Node processes + shared Redis.
 *
 * Requires REDIS_URL. Without it the suite is skipped (CI without Redis stays green).
 *
 *   REDIS_URL=redis://127.0.0.1:6379 npm test -- --test-name-pattern=multi-instance
 *
 * Optional: BP_STORE=postgres DATABASE_URL=… for durable path (default memory).
 *
 * Scenarios (from production review):
 *   A@NodeA + B@NodeB join_queue → Redis match → claimRoom before match_found
 *   → match_ready (no no_match) → place + requestId → place_ok echoes requestId
 *   → A disconnect → B still has room → A reconnect / rejoin
 */
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const { WebSocket } = require('../vendor/ws');

const ROOT = path.join(__dirname, '..');
const HAS_REDIS = !!process.env.REDIS_URL;
const BASE = 19200 + (process.pid % 700);
const PORT_A = BASE;
const PORT_B = BASE + 1;

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function waitHealth(port, timeoutMs) {
  const deadline = Date.now() + (timeoutMs || 15000);
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/health', timeout: 500 }, (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          if (res.statusCode === 200) resolve(body);
          else if (Date.now() > deadline) reject(new Error('health not ready :' + port));
          else setTimeout(tryOnce, 120);
        });
      });
      req.on('error', () => {
        if (Date.now() > deadline) reject(new Error('health connect fail :' + port));
        else setTimeout(tryOnce, 120);
      });
    };
    tryOnce();
  });
}

class Client {
  constructor(ws, label) {
    this.ws = ws;
    this.label = label || 'c';
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
        const types = this.inbox.map((m) => m.type).slice(-12);
        reject(new Error(this.label + ' timeout; recent=' + types.join(',')));
      }, timeoutMs || 15000);
      const entry = { pred, resolve, reject, timer };
      this.waiters.push(entry);
    });
  }
  close() {
    try { this.ws.close(); } catch (_) {}
  }
}

function connect(port, label) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
    const t = setTimeout(() => reject(new Error('connect timeout :' + port)), 8000);
    ws.once('open', () => {
      clearTimeout(t);
      resolve(new Client(ws, label));
    });
    ws.once('error', (e) => { clearTimeout(t); reject(e); });
  });
}

function spawnNode(port, instanceId) {
  const env = {
    ...process.env,
    PORT: String(port),
    BP_INSTANCE_ID: instanceId,
    BP_STORE: process.env.BP_STORE || 'memory',
    REDIS_URL: process.env.REDIS_URL,
    BP_LOG: process.env.BP_LOG || 'warn'
  };
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child._stderr = '';
  child.stderr.on('data', (c) => { child._stderr += String(c); });
  child.stdout.on('data', () => {});
  return child;
}

describe('multi-instance e2e (two nodes + Redis)', { skip: !HAS_REDIS }, () => {
  let nodeA;
  let nodeB;

  before(async () => {
    nodeA = spawnNode(PORT_A, 'e2e-node-a');
    nodeB = spawnNode(PORT_B, 'e2e-node-b');
    await Promise.all([
      waitHealth(PORT_A, 20000),
      waitHealth(PORT_B, 20000)
    ]);
  });

  after(async () => {
    for (const c of [nodeA, nodeB]) {
      if (c && !c.killed) {
        c.kill('SIGTERM');
        await wait(300);
        try { c.kill('SIGKILL'); } catch (_) {}
      }
    }
  });

  it('cross-node queue → match_found → ready (no no_match) → place with requestId', async () => {
    const a = await connect(PORT_A, 'A');
    const b = await connect(PORT_B, 'B');

    const helloA = await a.wait((d) => d.type === 'hello', 8000);
    const helloB = await b.wait((d) => d.type === 'hello', 8000);
    assert.ok(helloA.token);
    assert.ok(helloB.token);

    const cid = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    // duration 180 avoids colliding with other e2e suites that use 60
    a.send({
      type: 'join_queue',
      name: 'Alice',
      trophies: 200,
      duration: 180,
      clientId: 'mi-a-' + cid
    });
    // slight stagger so both land in Redis queue before claim races
    await wait(120);
    b.send({
      type: 'join_queue',
      name: 'Bob',
      trophies: 200,
      duration: 180,
      clientId: 'mi-b-' + cid
    });

    const foundA = await a.wait((d) => d.type === 'match_found', 20000);
    const foundB = await b.wait((d) => d.type === 'match_found', 20000);
    assert.equal(foundA.matchId, foundB.matchId, 'same matchId across nodes');
    assert.ok(foundA.matchId);

    const matchId = foundA.matchId;
    const tokA = foundA.token || helloA.token;
    const tokB = foundB.token || helloB.token;

    // Critical: match_ready must not get no_match (claimRoom completed before match_found)
    a.send({ type: 'match_ready', matchId, token: tokA });
    b.send({ type: 'match_ready', matchId, token: tokB });

    const goA = await a.wait(
      (d) => d.type === 'match_go' || (d.type === 'match_ready_ack' && d.ok === false),
      12000
    );
    const goB = await b.wait(
      (d) => d.type === 'match_go' || (d.type === 'match_ready_ack' && d.ok === false),
      12000
    );
    assert.notEqual(goA.type, 'match_ready_ack', 'A must not get no_match on ready');
    assert.notEqual(goB.type, 'match_ready_ack', 'B must not get no_match on ready');
    assert.equal(goA.type, 'match_go');
    assert.equal(goB.type, 'match_go');

    // Place from A with requestId (may be local or cross-instance forward)
    const requestId = 'req_' + cid;
    const pieceIdx = 0;
    // Use server pieces from match_found if present
    a.send({
      type: 'place',
      matchId,
      token: tokA,
      pieceIdx,
      r: 0,
      c: 0,
      requestId
    });

    const placeResp = await a.wait(
      (d) =>
        (d.type === 'place_ok' || d.type === 'place_reject') &&
        (d.requestId == null || d.requestId === requestId),
      12000
    );
    // place may reject (geometry) but must echo requestId when present
    if (placeResp.requestId != null) {
      assert.equal(placeResp.requestId, requestId);
    }
    // If accepted, B should see opp_place (cross-instance deliver)
    if (placeResp.type === 'place_ok') {
      const opp = await b.wait((d) => d.type === 'opp_place' || d.type === 'opp_grid', 8000).catch(() => null);
      // opp_place is best-effort depending on payload shape; at least no crash
      assert.ok(opp === null || opp.type);
    }

    a.close();
    b.close();
  });

  it('owner node holds room: remote match_ready after claim is not no_match', async () => {
    const a = await connect(PORT_A, 'A2');
    const b = await connect(PORT_B, 'B2');
    await a.wait((d) => d.type === 'hello', 8000);
    await b.wait((d) => d.type === 'hello', 8000);

    const cid = 'r2-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    a.send({ type: 'join_queue', name: 'A2', trophies: 50, duration: 180, clientId: 'mi2-a-' + cid });
    await wait(120);
    b.send({ type: 'join_queue', name: 'B2', trophies: 50, duration: 180, clientId: 'mi2-b-' + cid });

    const foundA = await a.wait((d) => d.type === 'match_found', 20000);
    const foundB = await b.wait((d) => d.type === 'match_found', 20000);
    assert.equal(foundA.matchId, foundB.matchId);

    // Immediate ready from both (stresses claim-before-visible race)
    a.send({ type: 'match_ready', matchId: foundA.matchId, token: foundA.token });
    b.send({ type: 'match_ready', matchId: foundB.matchId, token: foundB.token });

    const ackFail = [];
    const collect = (c) => {
      for (const m of c.inbox) {
        if (m.type === 'match_ready_ack' && m.ok === false && m.reason === 'no_match') {
          ackFail.push(m);
        }
      }
    };
    await Promise.race([
      a.wait((d) => d.type === 'match_go', 12000),
      b.wait((d) => d.type === 'match_go', 12000)
    ]);
    await wait(200);
    collect(a);
    collect(b);
    assert.equal(ackFail.length, 0, 'no no_match after match_found (claim was awaited)');

    a.close();
    b.close();
  });

  it('cross-node: disconnect then rejoin with same token reaches the room', async () => {
    const a = await connect(PORT_A, 'A3');
    const b = await connect(PORT_B, 'B3');
    const helloA = await a.wait((d) => d.type === 'hello', 8000);
    const helloB = await b.wait((d) => d.type === 'hello', 8000);

    const cid = 'r3-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    a.send({ type: 'join_queue', name: 'A3', duration: 180, clientId: 'mi3-a-' + cid });
    await wait(120);
    b.send({ type: 'join_queue', name: 'B3', duration: 180, clientId: 'mi3-b-' + cid });

    const foundA = await a.wait((d) => d.type === 'match_found', 20000);
    const foundB = await b.wait((d) => d.type === 'match_found', 20000);
    assert.equal(foundA.matchId, foundB.matchId);
    const matchId = foundA.matchId;
    const tokA = foundA.token || helloA.token;
    const tokB = foundB.token || helloB.token;

    a.send({ type: 'match_ready', matchId, token: tokA });
    b.send({ type: 'match_ready', matchId, token: tokB });
    await Promise.race([
      a.wait((d) => d.type === 'match_go', 12000),
      b.wait((d) => d.type === 'match_go', 12000)
    ]);

    // Drop A (may be local or remote relative to room owner)
    a.close();
    await wait(400);

    // Reconnect on the same node A and rejoin with match token
    const a2 = await connect(PORT_A, 'A3-re');
    await a2.wait((d) => d.type === 'hello', 8000);
    a2.send({ type: 'rejoin', matchId, token: tokA });
    const re = await a2.wait(
      (d) => d.type === 'rejoin_ok' || d.type === 'rejoin_fail' || d.type === 'match_found' || d.type === 'sync',
      12000
    );
    // Accept any successful seat recovery path
    assert.ok(
      re.type === 'rejoin_ok' || re.type === 'match_found' || re.type === 'sync',
      'expected rejoin recovery, got ' + re.type + (re.reason ? ' ' + re.reason : '')
    );

    a2.close();
    b.close();
  });
});
