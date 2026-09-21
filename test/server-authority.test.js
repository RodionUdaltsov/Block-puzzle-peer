'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const WebSocket = require('../vendor/ws');

const ROOT = path.join(__dirname, '..');
let server;
let port;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function waitForOpen(ws, timeout = 5000) {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) return resolve();
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('WebSocket open timeout'));
    }, timeout);
    const onOpen = () => { cleanup(); resolve(); };
    const onError = (err) => { cleanup(); reject(err || new Error('WebSocket error')); };
    function cleanup() {
      clearTimeout(timer);
      ws.removeListener('open', onOpen);
      ws.removeListener('error', onError);
    }
    ws.once('open', onOpen);
    ws.once('error', onError);
  });
}

function nextMessage(ws, predicate, timeout = 6000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Message timeout'));
    }, timeout);
    const onMessage = raw => {
      let msg;
      try { msg = JSON.parse(String(raw)); } catch (_) { return; }
      if (!predicate || predicate(msg)) {
        cleanup();
        resolve(msg);
      }
    };
    function cleanup() {
      clearTimeout(timer);
      ws.removeListener('message', onMessage);
    }
    ws.on('message', onMessage);
  });
}

async function startServer() {
  port = 19000 + Math.floor(Math.random() * 1000);
  server = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const started = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Server start timeout')), 5000);
    const onData = chunk => {
      if (String(chunk).includes('Block Puzzle on')) {
        clearTimeout(timer);
        server.stdout.off('data', onData);
        resolve();
      }
    };
    server.stdout.on('data', onData);
    server.once('exit', code => {
      clearTimeout(timer);
      reject(new Error('Server exited: ' + code));
    });
  });
  await started;
}

test.before(async () => {
  await startServer();
});

test.after(async () => {
  if (server && !server.killed) server.kill('SIGTERM');
  await wait(100);
});

test('authoritative match survives reconnect and stale socket close', async () => {
  const a = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const b = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  await Promise.all([waitForOpen(a), waitForOpen(b)]);

  const aFoundP = nextMessage(a, m => m.type === 'match_found');
  const bFoundP = nextMessage(b, m => m.type === 'match_found');
  a.send(JSON.stringify({ type: 'join_queue', name: 'A', trophies: 100, duration: 60 }));
  b.send(JSON.stringify({ type: 'join_queue', name: 'B', trophies: 100, duration: 60 }));
  const [aFound, bFound] = await Promise.all([aFoundP, bFoundP]);

  assert.equal(aFound.matchId, bFound.matchId);
  assert.ok(aFound.token);
  assert.ok(aFound.seat);
  assert.ok(aFound.clockEndTs > Date.now());

  const offlineP = nextMessage(b, m => m.type === 'player_status' && m.seat === aFound.seat && m.online === false);
  a.close();
  const offline = await offlineP;
  assert.ok(offline.dcDeadlineTs >= Date.now());

  const rejoin = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  await waitForOpen(rejoin);
  const onlineP = nextMessage(b, m => m.type === 'player_status' && m.seat === aFound.seat && m.online === true);
  const rejoinP = nextMessage(rejoin, m => m.type === 'rejoin_ok');
  rejoin.send(JSON.stringify({ type: 'rejoin', matchId: aFound.matchId, token: aFound.token }));
  const [joined, online] = await Promise.all([rejoinP, onlineP]);

  assert.equal(joined.matchId, aFound.matchId);
  assert.equal(joined.token, aFound.token);
  assert.equal(joined.seat, aFound.seat);
  assert.equal(joined.status, 'live');
  assert.equal(online.online, true);

  // The old socket's close handler must not detach the freshly reattached seat.
  await wait(100);
  const noFalseOffline = nextMessage(b, m => m.type === 'player_status' && m.seat === aFound.seat && m.online === false, 800);
  await assert.rejects(noFalseOffline, /Message timeout/);

  rejoin.send(JSON.stringify({ type: 'place', pieceIdx: 99, r: 0, c: 0 }));
  const rejected = await nextMessage(rejoin, m => m.type === 'place_reject');
  assert.equal(rejected.reason, 'bad_piece_idx');

  b.close();
  rejoin.close();
});


test('latest reconnect wins when two sockets race for the same seat', async () => {
  const a = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const b = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  await Promise.all([waitForOpen(a), waitForOpen(b)]);
  const aFoundP = nextMessage(a, m => m.type === 'match_found');
  const bFoundP = nextMessage(b, m => m.type === 'match_found');
  a.send(JSON.stringify({ type: 'join_queue', name: 'Race A', trophies: 200, duration: 60 }));
  b.send(JSON.stringify({ type: 'join_queue', name: 'Race B', trophies: 200, duration: 60 }));
  const [aFound] = await Promise.all([aFoundP, bFoundP]);

  const r1 = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  const r2 = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  await Promise.all([waitForOpen(r1), waitForOpen(r2)]);
  const r1Ok = nextMessage(r1, m => m.type === 'rejoin_ok');
  r1.send(JSON.stringify({ type: 'rejoin', matchId: aFound.matchId, token: aFound.token }));
  await r1Ok;

  const r2Ok = nextMessage(r2, m => m.type === 'rejoin_ok');
  r2.send(JSON.stringify({ type: 'rejoin', matchId: aFound.matchId, token: aFound.token }));
  await r2Ok;

  // The first reconnect socket was superseded. A ping from it must not resurrect
  // or otherwise mutate the authoritative seat after the second reconnect wins.
  r1.send(JSON.stringify({ type: 'ping', t: Date.now() }));
  const status = nextMessage(b, m => m.type === 'player_status' && m.seat === aFound.seat && m.online === false, 800);
  await assert.rejects(status, /Message timeout/);

  r2.send(JSON.stringify({ type: 'sync' }));
  const snap = await nextMessage(r2, m => m.type === 'state');
  assert.equal(snap.matchId, aFound.matchId);
  assert.equal(snap.seat, aFound.seat);

  a.close();
  b.close();
  r1.close();
  r2.close();
});
