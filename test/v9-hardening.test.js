/**
 * v9 hardening regressions: per-identity lock (lost updates), ws tiny-fragment cap,
 * orphaned paid cosmetics profile cannot be adopted, auth limits default.
 */
'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { withKeyLock, normKey } = require('../lib/keyed-lock');
const { createDeviceApi } = require('../lib/device');
const { MemoryStore } = require('../lib/store');
const Receiver = require('../vendor/ws/lib/receiver');

describe('keyed lock', () => {
  it('serialises read-modify-write on the same key (no lost update)', async () => {
    let balance = 1000;
    const buy = (price) => withKeyLock(normKey('ABCD1234'), async () => {
      const seen = balance;
      await new Promise((r) => setTimeout(r, 5));
      if (seen < price) return false;
      balance = seen - price;
      return true;
    });
    const res = await Promise.all([buy(300), buy(400), buy(200)]);
    assert.deepEqual(res, [true, true, true]);
    assert.equal(balance, 100);
  });

  it('a failing task does not block the queue', async () => {
    const k = normKey('ZZZZ9999');
    await assert.rejects(withKeyLock(k, async () => { throw new Error('x'); }));
    assert.equal(await withKeyLock(k, async () => 7), 7);
  });

  it('different keys run independently', async () => {
    const order = [];
    await Promise.all([
      withKeyLock('acct:A', async () => { await new Promise((r) => setTimeout(r, 20)); order.push('A'); }),
      withKeyLock('acct:B', async () => { order.push('B'); })
    ]);
    assert.deepEqual(order, ['B', 'A']);
  });
});

describe('ws receiver: tiny fragments', () => {
  function frame(opcode, fin, byte) {
    return Buffer.from([(fin ? 0x80 : 0) | opcode, 1, byte]);
  }
  it('rejects a message made of too many tiny fragments', async () => {
    const r = new Receiver({ isServer: false, maxPayload: 65536, maxFragments: 128 });
    const err = new Promise((res) => r.on('error', res));
    r.write(frame(1, false, 0x61));
    for (let i = 0; i < 300; i++) r.write(frame(0, false, 0x61));
    const e = await err;
    assert.equal(e.code, 'WS_ERR_TOO_MANY_BUFFERED_PARTS');
  });

  it('accepts a normal fragmented message and resets the counter per message', async () => {
    const r = new Receiver({ isServer: false, maxPayload: 65536, maxFragments: 128 });
    const got = [];
    r.on('message', (d) => got.push(d.toString()));
    r.on('error', (e) => assert.fail(e.message));
    for (let m = 0; m < 3; m++) {
      r.write(frame(1, false, 0x61));
      for (let i = 0; i < 99; i++) r.write(frame(0, false, 0x61));
      r.write(frame(0, true, 0x62));
    }
    await new Promise((res) => setImmediate(res));
    assert.equal(got.length, 3);
    assert.equal(got[0].length, 101);
  });
});

describe('friendCodeClaimableByDevice: orphaned paid profile', () => {
  function makeApi() {
    const store = new MemoryStore();
    const api = createDeviceApi({
      hooks: { store, isFriendCodeDeleted: () => false, isFriendCodeDeletedAsync: async () => false },
      Cosmetics: require('../shared/cosmetics')
    });
    return { api, store };
  }
  it('is not claimable by another device when a profile with purchases remains', async () => {
    const { api, store } = makeApi();
    await store.saveProfile('PAIDCODE', { diamonds: 5, ownedSkins: ['default', 'neon'], ownedBoards: ['field_default'] }, null);
    assert.equal(await api.friendCodeClaimableByDevice('device_bbbbbbbbbbbbbbbb', 'PAIDCODE'), false);
  });
  it('a brand-new code and a free (unpaid) profile stay claimable', async () => {
    const { api, store } = makeApi();
    assert.equal(await api.friendCodeClaimableByDevice('device_bbbbbbbbbbbbbbbb', 'NEWCODE1'), true);
    await store.saveProfile('FREECODE', { diamonds: 9999, ownedSkins: ['default'], ownedBoards: ['field_default'] }, 60);
    assert.equal(await api.friendCodeClaimableByDevice('device_bbbbbbbbbbbbbbbb', 'FREECODE'), true);
  });
});

describe('auth limits default', () => {
  function limitsOn(env) {
    const keep = { n: process.env.NODE_ENV, a: process.env.BP_AUTH_LIMITS };
    try {
      if (env.NODE_ENV === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = env.NODE_ENV;
      if (env.BP_AUTH_LIMITS === undefined) delete process.env.BP_AUTH_LIMITS; else process.env.BP_AUTH_LIMITS = env.BP_AUTH_LIMITS;
      const { createHttpContext } = require('../lib/http/context');
      return createHttpContext({ hooks: {}, PUBLIC: '.' }).AUTH_LIMITS_ON;
    } finally {
      if (keep.n === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = keep.n;
      if (keep.a === undefined) delete process.env.BP_AUTH_LIMITS; else process.env.BP_AUTH_LIMITS = keep.a;
    }
  }
  it('is on in production unless explicitly disabled', () => {
    assert.equal(limitsOn({ NODE_ENV: 'production' }), true);
    assert.equal(limitsOn({ NODE_ENV: 'production', BP_AUTH_LIMITS: '0' }), false);
    assert.equal(limitsOn({ NODE_ENV: 'development' }), false);
    assert.equal(limitsOn({ NODE_ENV: 'development', BP_AUTH_LIMITS: '1' }), true);
  });
});
