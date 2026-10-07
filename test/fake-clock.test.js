/**
 * v9.4: deterministic time. lib/clock.js is the only time source of the server code, so match timers
 * (load timeout, match end, disconnect deadline) can be tested in-process without real sleeps.
 */
'use strict';
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { clock, createFakeClock } = require('../lib/clock');
const { makeHarness } = require('./helpers/match-room-harness');
const R = require('../shared/rules');

describe('createFakeClock', () => {
  it('fires timers in time order and moves now()', () => {
    const f = createFakeClock({ start: 1000 });
    const seen = [];
    f.setTimeout(() => seen.push('b@' + f.now()), 200);
    f.setTimeout(() => seen.push('a@' + f.now()), 100);
    f.setTimeout(() => seen.push('c@' + f.now()), 200);
    f.advance(150);
    assert.deepEqual(seen, ['a@1100']);
    assert.equal(f.now(), 1150);
    f.advance(100);
    assert.deepEqual(seen, ['a@1100', 'b@1200', 'c@1200']);
  });

  it('runs intervals repeatedly, honours clear*, and timers scheduled from callbacks', () => {
    const f = createFakeClock();
    let n = 0;
    const h = f.setInterval(() => { n++; }, 1000);
    f.advance(3500);
    assert.equal(n, 3);
    f.clearInterval(h);
    f.advance(5000);
    assert.equal(n, 3);
    const order = [];
    f.setTimeout(() => { order.push(1); f.setTimeout(() => order.push(2), 10); }, 10);
    f.advance(25);
    assert.deepEqual(order, [1, 2]);
    const t = f.setTimeout(() => order.push('never'), 5);
    f.clearTimeout(t);
    f.advance(10);
    assert.ok(!order.includes('never'));
    assert.equal(typeof f.setTimeout(() => {}, 1).unref, 'function');
  });

  it('clock facade switches between fake and real and resets', () => {
    const f = createFakeClock({ start: 42 });
    clock.use(f);
    try {
      assert.equal(clock.isFake(), true);
      assert.equal(clock.now(), 42);
    } finally { clock.reset(); }
    assert.equal(clock.isFake(), false);
    assert.ok(Math.abs(clock.now() - Date.now()) < 1000);
  });
});

describe('MatchRoom on a fake clock', () => {
  let h; let fake; let newRoom;
  beforeEach(() => { h = makeHarness(); fake = h.fake; newRoom = h.newRoom; });
  afterEach(() => h.dispose());

  it('is created on the fake time base', () => {
    const { room } = newRoom();
    assert.equal(room.createdAt, 1_700_000_000_000);
    assert.equal(room.status, 'loading');
  });

  it('loading with a missing ready is force-started or cancelled only after the 20s load timeout', () => {
    const { room } = newRoom();
    fake.advance(19_000);
    assert.equal(room.status, 'loading');
    fake.advance(2_000);
    assert.notEqual(room.status, 'loading');
  });

  it('a live match ends by time exactly when the clock runs out (no real waiting)', () => {
    const { room } = newRoom(60);
    room.markReady('ta'); room.markReady('tb');
    fake.advance(1500);
    assert.equal(room.status, 'live');
    fake.advance(58_000);
    assert.equal(room.status, 'live');
    fake.advance(5_000);
    assert.equal(room.status, 'ended');
    assert.equal(room.endedReason, 'time');
  });

  it('two idle players who never placed are not AFK-forfeited (opening deals are not moves)', () => {
    const { room } = newRoom(300);
    room.markReady('ta'); room.markReady('tb');
    fake.advance(R.AFK_LIMIT_MS + 20_000);
    assert.equal(room.status, 'live');
    assert.equal(room.endedReason, null);
  });

  it('a seat that stays offline past the disconnect limit before any move voids the match', () => {
    const { room, wa } = newRoom(300);
    room.markReady('ta'); room.markReady('tb');
    fake.advance(1500);
    assert.equal(room.status, 'live');
    wa.readyState = 3;
    room.detach('ta', wa);
    fake.advance(R.DETACH_GRACE_MS + 2000);
    assert.equal(room.status, 'live');
    fake.advance(R.DC_LIMIT_MS + 5000);
    assert.equal(room.status, 'ended');
    assert.equal(room.endedReason, 'void');
  });
});

describe('no raw time sources left in server code', () => {
  it('lib/ and server.js use lib/clock instead of Date.now / bare timers', () => {
    const root = path.join(__dirname, '..');
    const files = ['server.js'];
    (function walk(d) {
      for (const e of fs.readdirSync(path.join(root, d), { withFileTypes: true })) {
        const rel = path.join(d, e.name);
        if (e.isDirectory()) walk(rel); else if (e.name.endsWith('.js')) files.push(rel);
      }
    })('lib');
    const bad = [];
    const re = /(\bDate\.now\(\)|(?<![\w.$])(setTimeout|setInterval|clearTimeout|clearInterval)\()/;
    for (const f of files) {
      // Network Redis client uses real OS timers for connect/command timeouts — not game clock.
      if (f === path.join('lib', 'clock.js') || f === path.join('lib', 'logger.js') ||
          f === path.join('lib', 'coord', 'redis-client.js')) continue;
      fs.readFileSync(path.join(root, f), 'utf8').split('\n').forEach((line, i) => {
        if (re.test(line.replace(/\/\/.*$/, ''))) bad.push(f + ':' + (i + 1));
      });
    }
    assert.deepEqual(bad, []);
  });
});
