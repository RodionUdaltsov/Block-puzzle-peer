/**
 * Concurrency tests for device_binds RMW (lost-update protection).
 * Memory store exercises the same atomicDeviceBindUpdate contract as Postgres.
 */
'use strict';
const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { MemoryStore } = require('../lib/store');
const { createDeviceApi, DEVICE_GUEST_MARK } = require('../lib/device');
const Cosmetics = require('../shared/cosmetics');

// Device ids must match normalizeDeviceId: /^[A-Za-z0-9_-]{16,64}$/
function did(suffix) {
  return ('deviceid_' + suffix + '_xxxxxxxx').slice(0, 24);
}

describe('device_binds concurrency (atomic RMW)', () => {
  let store;
  let device;

  beforeEach(async () => {
    store = new MemoryStore();
    await store.init();
    device = createDeviceApi({
      Cosmetics,
      hooks: {
        store,
        isFriendCodeDeleted: () => false,
        isFriendCodeDeletedAsync: async () => false
      }
    });
  });

  it('parallel bindDeviceToAccount keeps all account ids', async () => {
    const deviceId = did('bind');
    const ids = Array.from({ length: 20 }, (_, i) => 'acc_' + i);
    await Promise.all(ids.map((aid) => device.bindDeviceToAccount(deviceId, aid)));
    const rec = await store.loadDeviceBind(deviceId);
    assert.ok(rec, 'bind record should exist');
    assert.equal(rec.accountIds.length, 20);
    for (const aid of ids) {
      assert.ok(rec.accountIds.includes(aid), 'missing ' + aid);
    }
  });

  it('parallel setDeviceGuestProgress does not lose last writer fields', async () => {
    const deviceId = did('guest');
    await device.bindDeviceGuest(deviceId, {
      friendCode: 'GUEST001',
      nick: 'A',
      diamonds: 100,
      trophies: 10
    });
    const nicks = Array.from({ length: 30 }, (_, i) => 'N' + i);
    await Promise.all(
      nicks.map((nick) =>
        device.setDeviceGuestProgress(deviceId, {
          friendCode: 'GUEST001',
          nick,
          trophies: 10
        })
      )
    );
    const gp = await device.getDeviceGuestProgress(deviceId);
    assert.ok(gp, 'guest progress should exist');
    assert.ok(nicks.includes(gp.nick), 'nick should be one of concurrent writers, got ' + gp.nick);
    assert.equal(String(gp.friendCode).toUpperCase(), 'GUEST001');
  });

  it('bindDeviceToAccount concurrent with clearDeviceGuestMark is stable', async () => {
    const deviceId = did('clear');
    await device.bindDeviceGuest(deviceId, { friendCode: 'GUEST002', nick: 'G' });
    await Promise.all([
      device.bindDeviceToAccount(deviceId, 'acc_real'),
      device.clearDeviceGuestMark(deviceId),
      device.bindDeviceToAccount(deviceId, 'acc_real2')
    ]);
    const rec = await store.loadDeviceBind(deviceId);
    assert.ok(rec, 'record should not be fully wiped');
    const real = rec.accountIds.filter((x) => x !== DEVICE_GUEST_MARK && x !== '__had_account__');
    assert.ok(real.length >= 1, 'at least one real account id remains');
  });

  it('atomicDeviceBindUpdate serialises mutators on memory store', async () => {
    const deviceId = did('atomic');
    await store.saveDeviceBind(deviceId, { accountIds: [], guestProgress: null, updatedAt: 1 });
    let counter = 0;
    const N = 20; // under slice(-32) cap
    await Promise.all(
      Array.from({ length: N }, () =>
        store.atomicDeviceBindUpdate(deviceId, (rec) => {
          if (!Array.isArray(rec.accountIds)) rec.accountIds = [];
          counter += 1;
          rec.accountIds.push('x' + counter);
        })
      )
    );
    const rec = await store.loadDeviceBind(deviceId);
    assert.equal(rec.accountIds.length, N);
    assert.equal(counter, N);
  });

  /**
   * Regression: first concurrent creates must not lose an account id.
   * Starts from a device_id that does NOT exist yet (no pre-seeded row).
   */
  it('first-create concurrent atomicDeviceBindUpdate keeps every account id', async () => {
    const deviceId = did('firstcreate');
    assert.equal(await store.loadDeviceBind(deviceId), null, 'row must not exist yet');
    const ids = Array.from({ length: 12 }, (_, i) => 'newacc_' + i);
    await Promise.all(
      ids.map((aid) =>
        store.atomicDeviceBindUpdate(deviceId, (rec) => {
          if (!Array.isArray(rec.accountIds)) rec.accountIds = [];
          if (rec.accountIds.indexOf(aid) === -1) rec.accountIds.push(aid);
        })
      )
    );
    const rec = await store.loadDeviceBind(deviceId);
    assert.ok(rec, 'row must be created');
    assert.equal(rec.accountIds.length, ids.length);
    for (const aid of ids) {
      assert.ok(rec.accountIds.includes(aid), 'lost id ' + aid);
    }
  });

  it('first-create concurrent bindDeviceToAccount keeps every account id', async () => {
    const deviceId = did('firstbind');
    assert.equal(await store.loadDeviceBind(deviceId), null);
    const ids = Array.from({ length: 15 }, (_, i) => 'bindacc_' + i);
    await Promise.all(ids.map((aid) => device.bindDeviceToAccount(deviceId, aid)));
    const rec = await store.loadDeviceBind(deviceId);
    assert.ok(rec);
    assert.equal(rec.accountIds.length, ids.length);
    for (const aid of ids) assert.ok(rec.accountIds.includes(aid));
  });
});

// ── PostgresStore SQL contract: ensure-row then FOR UPDATE ──────────
const { PostgresStore } = require('../lib/postgres-store');

function fakeDevicePool(existingRow) {
  const log = [];
  let released = 0;
  const norm = (sql) => String(sql).replace(/\s+/g, ' ').trim();
  const client = {
    async query(sql, params) {
      const q = norm(sql);
      log.push({ q, params });
      if (/^BEGIN$/i.test(q) || /^COMMIT$/i.test(q) || /^ROLLBACK$/i.test(q)) return { rows: [] };
      if (/INSERT INTO device_binds.*ON CONFLICT \(device_id\) DO NOTHING/i.test(q)) {
        return { rows: [] };
      }
      if (/FROM device_binds WHERE device_id = \$1 FOR UPDATE/i.test(q)) {
        if (existingRow) {
          return {
            rows: [{
              device_id: existingRow.deviceId,
              account_ids: existingRow.accountIds || [],
              guest_progress: existingRow.guestProgress || null,
              updated_at: existingRow.updatedAt || 1
            }]
          };
        }
        // After placeholder insert the row exists (empty)
        return {
          rows: [{
            device_id: params[0],
            account_ids: [],
            guest_progress: null,
            updated_at: 1
          }]
        };
      }
      if (/^UPDATE device_binds/i.test(q)) return { rows: [] };
      return { rows: [] };
    },
    release() { released++; }
  };
  return {
    pool: { connect: async () => client, query: (s, p) => client.query(s, p) },
    log,
    released: () => released
  };
}

describe('PostgresStore atomicDeviceBindUpdate SQL contract (fake pool)', () => {
  it('first-create: INSERT placeholder ON CONFLICT DO NOTHING, then SELECT FOR UPDATE, then UPDATE', async () => {
    const f = fakeDevicePool(null);
    const s = new PostgresStore(f.pool);
    const out = await s.atomicDeviceBindUpdate('deviceid_sqlcontract_xxxx', (rec) => {
      rec.accountIds.push('acc_a');
      return { commit: true, result: 'ok' };
    });
    assert.equal(out, 'ok');
    const qs = f.log.map((l) => l.q);
    assert.equal(qs[0], 'BEGIN');
    // Placeholder ensure-row
    assert.match(qs[1], /INSERT INTO device_binds/);
    assert.match(qs[1], /ON CONFLICT \(device_id\) DO NOTHING/);
    // Lock
    assert.match(qs[2], /FROM device_binds WHERE device_id = \$1 FOR UPDATE/);
    // Write (UPDATE after ensure — not a second INSERT race)
    assert.match(qs[3], /^UPDATE device_binds/);
    assert.equal(qs[4], 'COMMIT');
    assert.equal(f.released(), 1);
  });

  it('existing row: still ensure-placeholder then FOR UPDATE then UPDATE', async () => {
    const f = fakeDevicePool({
      deviceId: 'deviceid_existing_row_xxx',
      accountIds: ['acc_old'],
      guestProgress: null,
      updatedAt: 42
    });
    const s = new PostgresStore(f.pool);
    await s.atomicDeviceBindUpdate('deviceid_existing_row_xxx', (rec) => {
      if (rec.accountIds.indexOf('acc_new') === -1) rec.accountIds.push('acc_new');
    });
    const qs = f.log.map((l) => l.q);
    assert.match(qs[1], /ON CONFLICT \(device_id\) DO NOTHING/);
    assert.match(qs[2], /FOR UPDATE/);
    const upd = f.log.find((l) => /^UPDATE device_binds/i.test(l.q));
    assert.ok(upd);
    // account_ids JSON must contain both
    const idsJson = upd.params[1];
    const parsed = JSON.parse(idsJson);
    assert.ok(parsed.includes('acc_old'));
    assert.ok(parsed.includes('acc_new'));
  });
});
