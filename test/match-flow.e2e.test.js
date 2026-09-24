/**
 * Smoke e2e: mock WS clients → join queue → match → place → end
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
const PORT = 19100 + (process.pid % 800);

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

function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    const t = setTimeout(() => reject(new Error('connect timeout')), 5000);
    ws.once('open', () => {
      clearTimeout(t);
      resolve(new Client(ws));
    });
    ws.once('error', (e) => { clearTimeout(t); reject(e); });
  });
}

describe('e2e match flow (mock WS)', () => {
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

  it('two clients queue, place piece, match ends', async () => {
    const a = await connect();
    const b = await connect();

    const helloA = await a.wait((d) => d.type === 'hello', 5000);
    const helloB = await b.wait((d) => d.type === 'hello', 5000);
    assert.ok(helloA.token);
    assert.ok(helloB.token);

    a.send({
      type: 'join_queue',
      name: 'Alice',
      trophies: 100,
      duration: 60,
      clientId: 'clientA-' + Date.now()
    });
    b.send({
      type: 'join_queue',
      name: 'Bob',
      trophies: 100,
      duration: 60,
      clientId: 'clientB-' + Date.now()
    });

    const foundA = await a.wait((d) => d.type === 'match_found', 12000);
    const foundB = await b.wait((d) => d.type === 'match_found', 12000);
    assert.equal(foundA.matchId, foundB.matchId);

    const matchId = foundA.matchId;
    const tokA = foundA.token || helloA.token;
    const tokB = foundB.token || helloB.token;

    a.send({ type: 'match_ready', matchId, token: tokA });
    b.send({ type: 'match_ready', matchId, token: tokB });

    await a.wait((d) => d.type === 'match_go', 8000);

    let me = foundA.me;
    if (!me || !me.pieces) {
      a.send({ type: 'sync', matchId, token: tokA });
      const snap = await a.wait((d) => d.me || d.type === 'state' || d.type === 'fullSync', 5000).catch(() => null);
      if (snap) me = snap.me || me;
    }

    if (me && Array.isArray(me.pieces)) {
      const grid = me.grid || R.emptyGrid();
      for (let i = 0; i < me.pieces.length; i++) {
        const p = me.pieces[i];
        if (!p || p.used) continue;
        const shape = R.normalizeShape(p.shape);
        const spots = R.findAllPlacements(grid, shape);
        if (!spots.length) continue;
        const { r, c } = spots[0];
        a.send({ type: 'place', matchId, token: tokA, pieceIdx: i, r, c });
        const resp = await a.wait(
          (d) => d.type === 'place_ok' || d.type === 'place' || d.type === 'place_reject',
          6000
        );
        assert.notEqual(resp.type, 'place_reject', String(resp.reason || ''));
        break;
      }
    }

    a.send({ type: 'forfeit', matchId, token: tokA });
    const endA = await a.wait((d) => d.type === 'match_end', 8000);
    assert.equal(endA.type, 'match_end');
    assert.ok(endA.reason);

    a.close();
    b.close();
  });
});

describe('rules match-flow smoke', () => {
  it('place fills cells and clearLines scores', () => {
    const g = R.emptyGrid();
    for (let c = 0; c < R.SIZE - 1; c++) g[0][c] = '#00d4aa';
    assert.equal(R.canPlaceOn(g, [[0, 0]], 0, R.SIZE - 1), true);
    g[0][R.SIZE - 1] = '#ff5c7a';
    const cleared = R.clearLinesOnGrid(g);
    assert.equal(cleared.count, 1);
    assert.equal(R.bonusFor(cleared.count), 100);
  });

  it('stuck when board full', () => {
    const g = R.emptyGrid();
    for (let r = 0; r < R.SIZE; r++) {
      for (let c = 0; c < R.SIZE; c++) g[r][c] = '#111';
    }
    assert.equal(R.sideHasPlayable(g, [{ shape: [[0, 0], [0, 1]], color: '#f00', used: false }]), false);
  });
});
