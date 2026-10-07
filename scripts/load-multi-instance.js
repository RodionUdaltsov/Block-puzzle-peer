#!/usr/bin/env node
/**
 * Multi-instance load / smoke scenario (not part of the unit suite).
 *
 * Requires two running Node instances that share Redis (and optionally Postgres).
 *
 *   REDIS_URL=redis://127.0.0.1:6379 PORT=9001 BP_INSTANCE_ID=a BP_STORE=memory node server.js
 *   REDIS_URL=redis://127.0.0.1:6379 PORT=9002 BP_INSTANCE_ID=b BP_STORE=memory node server.js
 *   node scripts/load-multi-instance.js --a ws://127.0.0.1:9001/ws --b ws://127.0.0.1:9002/ws --pairs 20
 *
 * Scenario per pair:
 *   join_queue → match_found → match_ready → match_go
 *   → place (requestId) → disconnect → rejoin
 *
 * Concurrency is limited (default 2) so pairs are not cross-matched in the
 * shared duration queue (server only allows 60/120/180).
 */
'use strict';

const { WebSocket } = require('../vendor/ws');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return def;
  return process.argv[i + 1] != null ? process.argv[i + 1] : def;
}

const URL_A = arg('a', process.env.WS_A || 'ws://127.0.0.1:9001/ws');
const URL_B = arg('b', process.env.WS_B || 'ws://127.0.0.1:9002/ws');
const PAIRS = Math.max(1, parseInt(arg('pairs', process.env.PAIRS || '8'), 10) || 8);
const CONCURRENCY = Math.max(1, parseInt(arg('concurrency', process.env.CONCURRENCY || '2'), 10) || 2);
const DURATION = [60, 120, 180].includes(Number(arg('duration', '180')))
  ? Number(arg('duration', '180'))
  : 180;
const TIMEOUT_MS = parseInt(arg('timeout', '30000'), 10) || 30000;

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

class Client {
  constructor(ws, label) {
    this.ws = ws;
    this.label = label;
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
    for (const d of this.inbox) if (pred(d)) return Promise.resolve(d);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.indexOf(entry);
        if (idx >= 0) this.waiters.splice(idx, 1);
        const types = this.inbox.map((m) => m.type).slice(-12).join(',');
        reject(new Error(this.label + ' timeout; recent=' + types));
      }, timeoutMs || TIMEOUT_MS);
      const entry = { pred, resolve, reject, timer };
      this.waiters.push(entry);
    });
  }
  close() { try { this.ws.close(); } catch (_) {} }
}

function connect(url, label) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const t = setTimeout(() => reject(new Error('connect timeout ' + label)), 10000);
    ws.once('open', () => { clearTimeout(t); resolve(new Client(ws, label)); });
    ws.once('error', (e) => { clearTimeout(t); reject(e); });
  });
}

async function runPair(i) {
  const a = await connect(URL_A, 'A' + i);
  const b = await connect(URL_B, 'B' + i);
  await a.wait((d) => d.type === 'hello');
  await b.wait((d) => d.type === 'hello');

  const cid = 'load-' + process.pid + '-' + i + '-' + Date.now();
  // Rotate allowed durations (60/120/180) so concurrent pairs do not share a queue
  const duration = [60, 120, 180][i % 3];

  a.send({ type: 'join_queue', name: 'A' + i, duration, clientId: cid + '-a' });
  await wait(80);
  b.send({ type: 'join_queue', name: 'B' + i, duration, clientId: cid + '-b' });

  const foundA = await a.wait((d) => d.type === 'match_found');
  const foundB = await b.wait((d) => d.type === 'match_found');
  if (foundA.matchId !== foundB.matchId) {
    // Under residual cross-match, finish the real partners separately is hard —
    // treat as fail so concurrency can be lowered.
    a.close();
    b.close();
    throw new Error(
      'pair ' + i + ' matchId mismatch a=' + foundA.matchId + ' b=' + foundB.matchId
    );
  }
  const matchId = foundA.matchId;
  const tokA = foundA.token;
  const tokB = foundB.token;

  a.send({ type: 'match_ready', matchId, token: tokA });
  b.send({ type: 'match_ready', matchId, token: tokB });

  const goA = a.wait((d) => d.type === 'match_go');
  const goB = b.wait((d) => d.type === 'match_go');
  await Promise.race([goA, goB]);
  await Promise.all([goA.catch(() => null), goB.catch(() => null)]);

  const requestId = 'rq-' + cid;
  a.send({
    type: 'place',
    matchId,
    token: tokA,
    pieceIdx: 0,
    r: 0,
    c: 0,
    requestId
  });
  await a.wait(
    (d) => (d.type === 'place_ok' || d.type === 'place_reject') &&
      (d.requestId == null || d.requestId === requestId)
  ).catch(() => null);

  a.close();
  await wait(350);
  const a2 = await connect(URL_A, 'A' + i + '-re');
  await a2.wait((d) => d.type === 'hello');
  a2.send({ type: 'rejoin', matchId, token: tokA });
  const re = await a2.wait(
    (d) => d.type === 'rejoin_ok' || d.type === 'rejoin_fail' || d.type === 'match_found'
  );
  if (re.type === 'rejoin_fail') {
    a2.close();
    b.close();
    throw new Error('pair ' + i + ' rejoin_fail ' + (re.reason || ''));
  }

  a2.close();
  b.close();
  return { pair: i, matchId };
}

async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const idx = next++;
      try {
        results[idx] = { status: 'fulfilled', value: await fn(items[idx], idx) };
      } catch (reason) {
        results[idx] = { status: 'rejected', reason };
      }
    }
  }
  const workers = [];
  for (let i = 0; i < Math.min(limit, items.length); i++) workers.push(worker());
  await Promise.all(workers);
  return results;
}

async function main() {
  console.log(JSON.stringify({
    urlA: URL_A,
    urlB: URL_B,
    pairs: PAIRS,
    concurrency: CONCURRENCY,
    duration: DURATION
  }));
  const t0 = Date.now();
  const results = await mapPool(
    Array.from({ length: PAIRS }, (_, i) => i),
    CONCURRENCY,
    (i) => runPair(i)
  );
  const ok = results.filter((r) => r.status === 'fulfilled');
  const fail = results.filter((r) => r.status === 'rejected');
  for (const f of fail) {
    console.error('FAIL', f.reason && f.reason.message ? f.reason.message : f.reason);
  }
  console.log(JSON.stringify({
    ok: ok.length,
    fail: fail.length,
    ms: Date.now() - t0
  }));
  process.exit(fail.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
