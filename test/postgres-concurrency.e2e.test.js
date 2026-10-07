/**
 * Real PostgreSQL concurrency e2e (3.12 Stabilization).
 *
 * Runs ONLY when DATABASE_URL is set. Two independent PostgresStore instances
 * (separate pools) stand in for two server processes racing against one account.
 *
 *   DATABASE_URL=postgres://… npm test -- --test-name-pattern=postgres-concurrency
 *
 * Without DATABASE_URL the suite is skipped so CI without Postgres stays green.
 */
'use strict';
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const HAS_PG = !!process.env.DATABASE_URL;

const SKINS = { ocean: 30, forest: 30, mono: 45, sunset: 120, neon: 150, candy: 160, ice: 180, lava: 280 };

function buyMutator(kind, id) {
  const Cosmetics = require('../shared/cosmetics');
  return ({ account, profile }) => {
    const base = Cosmetics.normalizeProfile(Object.assign({}, profile || Cosmetics.defaultProfile(), {
      diamonds: account.diamonds,
      ownedSkins: account.ownedSkins,
      ownedBoards: account.ownedBoards
    }));
    const res = Cosmetics.tryBuy(base, kind, id);
    if (!res.ok) return { commit: false, result: res };
    const r = res.profile;
    r.migrated = true;
    account.diamonds = r.diamonds | 0;
    account.ownedSkins = r.ownedSkins.slice();
    account.ownedBoards = r.ownedBoards.slice();
    account.skinId = r.equippedSkin;
    account.updatedAt = Date.now();
    return { commit: true, result: res, account, profile: r, profileTtlSec: null };
  };
}

describe('postgres-concurrency', { skip: !HAS_PG }, () => {
  let A, B, stores, code;

  before(async () => {
    const { PostgresStore, createPoolFromEnv } = require('../lib/postgres-store');
    A = new PostgresStore(createPoolFromEnv());
    B = new PostgresStore(createPoolFromEnv());
    await A.init();
    await B.init();
    stores = [A, B];
    code = ('PC' + crypto.randomBytes(4).toString('hex')).toUpperCase().slice(0, 10);
    const acc = {
      id: 'pc_' + code,
      login: 'pc_' + code.toLowerCase(),
      passSalt: 's',
      passHash: 'h',
      friendCode: code,
      nick: 'pc',
      trophies: 100000,
      diamonds: 1000,
      best: 0,
      ownedSkins: ['default'],
      ownedBoards: ['field_default'],
      friends: [],
      history: [],
      achievements: {},
      botStars: {},
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await A.saveAccount(acc);
  });

  after(async () => {
    if (!A) return;
    try { await A.pool.query('DELETE FROM profiles WHERE friend_code = $1', [code]); } catch (_) {}
    try { await A.pool.query('DELETE FROM accounts WHERE friend_code = $1', [code]); } catch (_) {}
    try { await A.pool.query('DELETE FROM deleted_codes WHERE code = $1', [code]); } catch (_) {}
    try { await A.close(); } catch (_) {}
    try { await B.close(); } catch (_) {}
  });

  it('concurrent same-skin buys: at most one succeeds, balance exact', async () => {
    const Cosmetics = require('../shared/cosmetics');
    // Fresh account with only enough for one ocean
    await A.atomicEconomyUpdate(code, ({ account, profile }) => {
      account.diamonds = 30;
      account.ownedSkins = ['default'];
      const p = Cosmetics.normalizeProfile(Object.assign({}, profile || {}, {
        diamonds: 30, ownedSkins: ['default']
      }));
      return { commit: true, result: true, account, profile: p, profileTtlSec: null };
    });
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => stores[i % 2].atomicEconomyUpdate(code, buyMutator('skin', 'ocean')))
    );
    const ok = results.filter((r) => r && r.ok);
    assert.equal(ok.length, 1, 'exactly one buy must commit, got ' + ok.length);
    const acc = await B.loadAccountByCode(code);
    assert.equal(acc.diamonds, 0);
    assert.ok(acc.ownedSkins.includes('ocean'));
    assert.equal(acc.ownedSkins.filter((s) => s === 'ocean').length, 1);
  });

  it('concurrent different-skin buys stay within balance', async () => {
    const Cosmetics = require('../shared/cosmetics');
    await A.atomicEconomyUpdate(code, ({ account, profile }) => {
      account.diamonds = 200;
      account.ownedSkins = ['default'];
      const p = Cosmetics.normalizeProfile(Object.assign({}, profile || {}, {
        diamonds: 200, ownedSkins: ['default']
      }));
      return { commit: true, result: true, account, profile: p, profileTtlSec: null };
    });
    const ids = Object.keys(SKINS);
    const results = await Promise.all(
      ids.map((id, i) => stores[i % 2].atomicEconomyUpdate(code, buyMutator('skin', id)))
    );
    const ok = results.filter((r) => r && r.ok);
    const acc = await A.loadAccountByCode(code);
    const spent = acc.ownedSkins.filter((s) => s !== 'default').reduce((n, id) => n + (SKINS[id] || 0), 0);
    assert.equal(acc.diamonds, 200 - spent);
    assert.ok(spent <= 200);
    assert.equal(ok.length, acc.ownedSkins.filter((s) => s !== 'default').length);
  });

  it('concurrent trophy updates: exact sum, no lost writes', async () => {
    await A.atomicAccountUpdate(code, (a) => { a.trophies = 50000; });
    const deltas = Array.from({ length: 100 }, (_, i) => (i % 3 === 0 ? -7 : 11));
    await Promise.all(deltas.map((d, i) => stores[i % 2].adjustAccountCounters(code, { trophies: d })));
    const acc = await B.loadAccountByCode(code);
    const expected = 50000 + deltas.reduce((n, d) => n + d, 0);
    assert.equal(acc.trophies, expected);
  });

  it('concurrent profile PATCH vs buy does not corrupt balance', async () => {
    const Cosmetics = require('../shared/cosmetics');
    await A.atomicEconomyUpdate(code, ({ account, profile }) => {
      account.diamonds = 500;
      account.ownedSkins = ['default'];
      account.best = 0;
      const p = Cosmetics.normalizeProfile(Object.assign({}, profile || {}, {
        diamonds: 500, ownedSkins: ['default']
      }));
      return { commit: true, result: true, account, profile: p, profileTtlSec: null };
    });
    await Promise.all([
      ...['ocean', 'forest', 'mono', 'sunset'].map((id, i) =>
        stores[i % 2].atomicEconomyUpdate(code, buyMutator('skin', id))),
      ...Array.from({ length: 30 }, (_, i) =>
        stores[i % 2].atomicAccountUpdate(code, (a) => { a.best = Math.max(a.best | 0, i); }))
    ]);
    const acc = await A.loadAccountByCode(code);
    const spent = acc.ownedSkins.filter((s) => s !== 'default').reduce((n, id) => n + (SKINS[id] || 0), 0);
    assert.equal(acc.diamonds, 500 - spent);
    assert.equal(acc.best, 29);
  });

  it('CHECK constraint rejects negative diamonds', async () => {
    let rejected = false;
    try {
      await A.pool.query('UPDATE accounts SET diamonds = -1 WHERE friend_code = $1', [code]);
    } catch (_) {
      rejected = true;
    }
    assert.ok(rejected, 'DB must reject negative diamonds');
  });

  it('concurrent deleteAccount: identity is gone for both stores', async () => {
    const code2 = ('PD' + crypto.randomBytes(4).toString('hex')).toUpperCase().slice(0, 10);
    const acc = {
      id: 'pd_' + code2,
      login: 'pd_' + code2.toLowerCase(),
      passSalt: 's',
      passHash: 'h',
      friendCode: code2,
      nick: 'pd',
      trophies: 0,
      diamonds: 10,
      best: 0,
      ownedSkins: ['default'],
      ownedBoards: ['field_default'],
      friends: [],
      history: [],
      achievements: {},
      botStars: {},
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await A.saveAccount(acc);
    const loaded = await B.loadAccountByCode(code2);
    assert.ok(loaded);
    await Promise.all([
      A.deleteAccount(loaded),
      B.deleteAccount(loaded).catch(() => null)
    ]);
    assert.equal(await A.loadAccountByCode(code2), null);
    assert.equal(await B.loadAccountByCode(code2), null);
    try { await A.pool.query('DELETE FROM deleted_codes WHERE code = $1', [code2]); } catch (_) {}
  });
});
