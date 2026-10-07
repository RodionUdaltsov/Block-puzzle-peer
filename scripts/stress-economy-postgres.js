#!/usr/bin/env node
/**
 * Stress check for the SQL-level atomic economy against a REAL PostgreSQL.
 * Two PostgresStore objects with separate connection pools stand in for two server instances.
 *
 *   DATABASE_URL=postgres://user:pass@host:5432/blockpuzzle node scripts/stress-economy-postgres.js
 *
 * Creates one throw-away account, hammers it, asserts the invariants, deletes it. Exit code 1 on failure.
 */
'use strict';
const crypto = require('crypto');
const { PostgresStore, createPoolFromEnv } = require('../lib/postgres-store');
const Cosmetics = require('../shared/cosmetics');

const SKINS = { ocean: 30, forest: 30, mono: 45, sunset: 120, neon: 150, candy: 160, ice: 180, lava: 280 };
let failures = 0;
function check(name, cond, extra) {
  console.log((cond ? 'ok   ' : 'FAIL ') + name + (cond ? '' : '  ' + (extra || '')));
  if (!cond) failures++;
}

function buyMutator(kind, id) {
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

(async () => {
  const A = new PostgresStore(createPoolFromEnv());
  const B = new PostgresStore(createPoolFromEnv());
  await A.init(); await B.init();
  const stores = [A, B];
  const code = ('ST' + crypto.randomBytes(4).toString('hex')).toUpperCase().slice(0, 10);
  const acc = {
    id: 'stress_' + code, login: 'stress_' + code.toLowerCase(), passSalt: 's', passHash: 'h', friendCode: code, nick: 'stress',
    trophies: 100000, diamonds: 1000, best: 0, ownedSkins: ['default'], ownedBoards: ['field_default'],
    friends: [], history: [], achievements: {}, botStars: {}, createdAt: Date.now(), updatedAt: Date.now()
  };
  try {
    await A.saveAccount(acc);

    // 1) concurrent buys from two "instances": duplicates and more than the balance can pay for
    const ids = [];
    for (let i = 0; i < 4; i++) ids.push(...Object.keys(SKINS));
    const results = await Promise.all(ids.map((id, i) => stores[i % 2].atomicEconomyUpdate(code, buyMutator('skin', id))));
    const a1 = await A.loadAccountByCode(code);
    const spent = a1.ownedSkins.filter((x) => x !== 'default').reduce((n, id) => n + SKINS[id], 0);
    check('balance never negative', a1.diamonds >= 0, 'diamonds=' + a1.diamonds);
    check('balance == 1000 - price of what is owned', a1.diamonds === 1000 - spent, a1.diamonds + ' vs ' + (1000 - spent));
    check('no duplicate ownership', new Set(a1.ownedSkins).size === a1.ownedSkins.length, JSON.stringify(a1.ownedSkins));
    check('successful buys == owned items', results.filter((r) => r && r.ok).length === a1.ownedSkins.length - 1);
    const p1 = await A.loadProfile(code);
    check('profile mirror == account balance', p1 && p1.diamonds === a1.diamonds, JSON.stringify(p1));

    // 2) trophy deltas from both instances: exact sum, no lost updates
    const deltas = Array.from({ length: 200 }, (_, i) => (i % 3 === 0 ? -15 : 25));
    await Promise.all(deltas.map((d, i) => stores[i % 2].adjustAccountCounters(code, { trophies: d })));
    const a2 = await B.loadAccountByCode(code);
    check('trophies == exact sum of all deltas', a2.trophies === 100000 + deltas.reduce((n, d) => n + d, 0), String(a2.trophies));

    // 3) a stale full-row save (old copy) must not undo purchases or trophies
    const stale = JSON.parse(JSON.stringify(a1));
    await B.saveAccount(Object.assign(stale, { nick: 'stale-writer' }));
    const a3 = await A.loadAccountByCode(code);
    check('stale saveAccount keeps trophies', a3.trophies === a2.trophies, a3.trophies + ' vs ' + a2.trophies);
    check('stale saveAccount keeps diamonds/ownership', a3.diamonds === a1.diamonds && a3.ownedSkins.length === a1.ownedSkins.length);
    check('stale saveAccount still updates non-economy fields', a3.nick === 'stale-writer');

    // 4) PATCH-style updates racing with buys
    await Promise.all([
      ...Object.keys(SKINS).map((id, i) => stores[i % 2].atomicEconomyUpdate(code, buyMutator('skin', id))),
      ...Array.from({ length: 20 }, (_, i) => stores[i % 2].atomicAccountUpdate(code, (a) => { a.best = Math.max(a.best, i); }))
    ]);
    const a4 = await A.loadAccountByCode(code);
    check('best == 19 after racing PATCHes', a4.best === 19, String(a4.best));
    check('balance still consistent after racing PATCHes', a4.diamonds === 1000 - a4.ownedSkins.filter((x) => x !== 'default').reduce((n, id) => n + SKINS[id], 0));

    // 5) DB safety net
    let rejected = false;
    try { await A.pool.query('UPDATE accounts SET diamonds = -1 WHERE friend_code = $1', [code]); } catch (_) { rejected = true; }
    check('CHECK (diamonds >= 0) rejects negative balances', rejected);
  } finally {
    try { await A.pool.query('DELETE FROM profiles WHERE friend_code = $1', [code]); } catch (_) {}
    try { await A.pool.query('DELETE FROM accounts WHERE friend_code = $1', [code]); } catch (_) {}
    await A.pool.end(); await B.pool.end();
  }
  console.log(failures ? '\n' + failures + ' check(s) FAILED' : '\nAll economy checks passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
