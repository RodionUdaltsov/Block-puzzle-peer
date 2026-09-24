/**
 * WS protocol hardening: garbage payloads must not crash the server.
 */
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const { WebSocket } = require('../vendor/ws');

const ROOT = path.join(__dirname, '..');
const PORT = 19200 + (process.pid % 700);

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
          if (res.statusCode === 200) resolve(body);
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

describe('ws fuzz / hardening', () => {
  let child;

  before(async () => {
    child = spawn(process.execPath, ['server.js'], {
      cwd: ROOT,
      env: { ...process.env, PORT: String(PORT), BP_STORE: 'memory', BP_LOG: 'error' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let bootErr = '';
    child.stderr.on('data', (c) => { bootErr += c; });
    child.on('exit', (code) => {
      if (code && code !== 0 && code !== null) {
        // captured for assertion after tests if needed
        child._exitCode = code;
      }
    });
    await waitHealth(15000);
  });

  after(async () => {
    if (child && !child.killed) {
      child.kill('SIGTERM');
      await wait(300);
      try { child.kill('SIGKILL'); } catch (_) {}
    }
  });

  function openWs() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket('ws://127.0.0.1:' + PORT + '/ws');
      const t = setTimeout(() => reject(new Error('ws open timeout')), 5000);
      ws.on('open', () => {
        clearTimeout(t);
        resolve(ws);
      });
      ws.on('error', (e) => {
        clearTimeout(t);
        reject(e);
      });
    });
  }

  it('survives malformed frames and stays healthy', async () => {
    const ws = await openWs();
    const payloads = [
      '',
      'not-json',
      '{',
      '[]',
      'null',
      '"string"',
      JSON.stringify({ type: 'place', pieceIdx: -1, r: 999, c: -5 }),
      JSON.stringify({ type: 'place' }),
      JSON.stringify({ type: 'queue', name: 'x'.repeat(5000) }),
      JSON.stringify({ type: '__unknown__', a: 1 }),
      JSON.stringify({ type: 'hello' }),
      Buffer.alloc(200, 0xff).toString('binary'),
      JSON.stringify({ type: 'place', pieceIdx: 0, r: 0, c: 0, shape: [[0, 0]], color: '#fff' })
    ];

    for (const p of payloads) {
      try {
        ws.send(p);
      } catch (_) {}
      await wait(20);
    }

    // Connection may still be open or closed — server must answer /health
    await wait(100);
    const body = await waitHealth(3000);
    const j = JSON.parse(body);
    assert.equal(j.ok, true);
    assert.ok(j.version);

    try { ws.close(); } catch (_) {}
    // Process still running
    assert.equal(child.killed, false);
    assert.equal(child._exitCode, undefined);
  });


  it('rejects oversized messages without dying', async () => {
    // Default BP_MAX_WS_MSG is 64 KiB — oversize must not crash the process
    const ws = await openWs();
    const closed = new Promise((resolve) => {
      ws.on('close', () => resolve('closed'));
      ws.on('error', () => resolve('error'));
      setTimeout(() => resolve('timeout'), 2500);
    });
    const huge = '{"type":"queue","name":"' + 'A'.repeat(70000) + '"}';
    try { ws.send(huge); } catch (_) {}
    await closed;
    await wait(150);
    const body = await waitHealth(8000);
    assert.equal(JSON.parse(body).ok, true);
    try { ws.close(); } catch (_) {}
    assert.equal(child.killed, false);
    assert.equal(child._exitCode, undefined);
  });

});
