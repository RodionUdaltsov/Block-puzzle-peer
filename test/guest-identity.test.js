/**
 * One device = one guest identity.
 * Regression: a second bind / sync with a different (stale or regenerated) friend code used to swap the
 * device's guest to a new, empty identity, while purchases landed on another code — so registration
 * migrated the "empty" guest.
 */
'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { createDeviceApi } = require('../lib/device');
const { MemoryStore } = require('../lib/store');

function makeApi() {
  const store = new MemoryStore();
  const api = createDeviceApi({
    hooks: {
      store,
      isFriendCodeDeleted: () => false,
      isFriendCodeDeletedAsync: async () => false
    },
    Cosmetics: require('../shared/cosmetics')
  });
  return { api, store };
}
const DEV = 'device_aaaaaaaaaaaaaaaa';

describe('guest identity is fixed by the first bind', () => {
  it('bindDeviceGuest keeps the original friend code and ignores a later client economy', async () => {
    const { api } = makeApi();
    assert.ok(await api.bindDeviceGuest(DEV, { friendCode: 'AAAAAAAA', ts: 1 }));
    const first = await api.getDeviceGuestProgress(DEV);
    assert.equal(first.friendCode, 'AAAAAAAA');

    // second bind with a different code and fresh-client defaults
    await api.bindDeviceGuest(DEV, { friendCode: 'BBBBBBBB', diamonds: 9999, ownedSkins: ['default'], ts: 2 });
    const after = await api.getDeviceGuestProgress(DEV);
    assert.equal(after.friendCode, 'AAAAAAAA');
  });

  it('setDeviceGuestProgress (guest-sync) cannot move the guest to another code', async () => {
    const { api } = makeApi();
    await api.bindDeviceGuest(DEV, { friendCode: 'AAAAAAAA', ts: 1 });
    await api.setDeviceGuestProgress(DEV, { friendCode: 'CCCCCCCC', nick: 'x', ts: 3 });
    const after = await api.getDeviceGuestProgress(DEV);
    assert.equal(after.friendCode, 'AAAAAAAA');
  });

  it('adopts the incoming code only when the device has none yet', async () => {
    const { api } = makeApi();
    await api.bindDeviceGuest(DEV, { ts: 1 });
    await api.setDeviceGuestProgress(DEV, { friendCode: 'DDDDDDDD', ts: 2 });
    const after = await api.getDeviceGuestProgress(DEV);
    assert.equal(after.friendCode, 'DDDDDDDD');
  });
});
