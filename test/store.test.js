/**
 * Behavioral tests for lib/store.js — rooms + queue/presence API
 */
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { MemoryStore, FileStore, QUEUE_TTL, PRESENCE_TTL } = require('../lib/store');

describe('MemoryStore', () => {
  it('save/load/delete room', async () => {
    const s = new MemoryStore();
    await s.init();
    await s.saveRoom('m1', { id: 'm1', status: 'live' }, 60);
    assert.equal((await s.loadRoom('m1')).id, 'm1');
    await s.deleteRoom('m1');
    assert.equal(await s.loadRoom('m1'), null);
  });

  it('saveQueue / loadQueue round-trip', async () => {
    const s = new MemoryStore();
    await s.init();
    const entries = [{ token: 't1', duration: 120, trophies: 100, queuedAt: Date.now() }];
    await s.saveQueue(entries, QUEUE_TTL);
    const q = await s.loadQueue();
    assert.equal(q.length, 1);
    assert.equal(q[0].token, 't1');
  });

  it('savePresence / loadPresence / listPresenceCodes', async () => {
    const s = new MemoryStore();
    await s.init();
    await s.savePresence('ABC123', { name: 'A', trophies: 50, lastSeen: Date.now() }, PRESENCE_TTL);
    const p = await s.loadPresence('ABC123');
    assert.equal(p.name, 'A');
    const codes = await s.listPresenceCodes();
    assert.ok(codes.includes('ABC123'));
  });

  it('token bind/match/unbind', async () => {
    const s = new MemoryStore();
    await s.init();
    await s.bindToken('tok', 'match9', 60);
    assert.equal(await s.tokenMatch('tok'), 'match9');
    await s.unbindToken('tok');
    assert.equal(await s.tokenMatch('tok'), null);
  });
});

describe('FileStore', () => {
  let dir;
  let s;

  before(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bp-store-'));
    s = new FileStore(dir);
    await s.init();
  });

  after(() => {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  });

  it('persists room across new instance', async () => {
    await s.saveRoom('r1', { id: 'r1', status: 'loading' }, 120);
    const s2 = new FileStore(dir);
    await s2.init();
    assert.equal((await s2.loadRoom('r1')).id, 'r1');
  });

  it('persists queue', async () => {
    await s.saveQueue([{ token: 'x', duration: 60, queuedAt: Date.now() }], QUEUE_TTL);
    const s2 = new FileStore(dir);
    await s2.init();
    const q = await s2.loadQueue();
    assert.equal(q[0].token, 'x');
  });

  it('persists presence last-seen', async () => {
    await s.savePresence('ZZ9', { name: 'Z', lastSeen: 12345, activity: 'offline' }, PRESENCE_TTL);
    const s2 = new FileStore(dir);
    await s2.init();
    const p = await s2.loadPresence('ZZ9');
    assert.equal(p.lastSeen, 12345);
    assert.ok((await s2.listPresenceCodes()).includes('ZZ9'));
  });
});
