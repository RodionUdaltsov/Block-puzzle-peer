/**
 * Behavioral tests for lib/store.js — MemoryStore (postgres needs DATABASE_URL)
 */
'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { MemoryStore, QUEUE_TTL, PRESENCE_TTL } = require('../lib/store');

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

  it('guest progress save/load', async () => {
    const s = new MemoryStore();
    await s.init();
    await s.saveGuestProgress('XYZ', { diamonds: 100, botStars: { nova: { '60': true } } });
    const g = await s.loadGuestProgress('XYZ');
    assert.equal(g.diamonds, 100);
    assert.ok(g.botStars.nova['60']);
  });

  it('account + session', async () => {
    const s = new MemoryStore();
    await s.init();
    await s.saveAccount({
      id: 'a1', login: 'tester', friendCode: 'AB12CD',
      passSalt: 'x', passHash: 'y', nick: 'T', trophies: 0, diamonds: 0
    });
    assert.equal((await s.loadAccountByLogin('tester')).id, 'a1');
    assert.equal((await s.loadAccountByCode('AB12CD')).id, 'a1');
    await s.saveSession('sess1', 'a1', 3600);
    assert.equal(await s.loadSession('sess1'), 'a1');
  });
});
