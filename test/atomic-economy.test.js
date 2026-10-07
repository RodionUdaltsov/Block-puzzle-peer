/**
 * v9.5: SQL-level atomic economy. Behaviour on the memory store (same contract) driven through the real
 * buy/equip handlers, plus a fake-pool contract test for the PostgreSQL transaction / locking statements.
 * A real database is NOT used here: scripts/stress-economy-postgres.js is the check to run against Postgres.
 */
'use strict';
const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { MemoryStore } = require('../lib/store');
const { PostgresStore } = require('../lib/postgres-store');
const { handleSessionCosmetics } = require('../lib/ws/handlers/session-cosmetics');
const Cosmetics = require('../shared/cosmetics');

const CODE = 'AAAA1111';
const PRICES = { ocean: 30, forest: 30, mono: 45, sunset: 120, neon: 150, candy: 160, ice: 180, lava: 280 };

function mkAccount(over) {
  return Object.assign({
    id: 'acc1', login: 'tester', passSalt: 's', passHash: 'h', friendCode: CODE, nick: 'T',
    trophies: 0, diamonds: 500, best: 0, ownedSkins: ['default'], ownedBoards: ['field_default'],
    friends: [], history: [], achievements: {}, botStars: {}, avatarId: 'init', avatarCustom: '',
    status: '', skinId: 'default', boardId: 'field_default', createdAt: 1, updatedAt: 1
  }, over || {});
}

function harness(store) {
  const sent = [];
  const waiters = [];
  const send = (ws, msg) => {
    sent.push(msg);
    for (let i = waiters.length - 1; i >= 0; i--) waiters[i](msg);
  };
  const shared = {
    Cosmetics, store, send,
    applyServerCosmeticsToGuest: (gp) => gp,
    cosmeticsResultPayload: (type, base, profile) => Object.assign({ type, diamonds: profile && profile.diamonds, owned: profile && profile.ownedSkins }, base),
    isFriendCodeDeletedAsync: async () => false,
    kickFriendCodeSessions: () => {}, loadDeviceBindRecord: async () => null,
    loadLiveCosmeticsProfile: async (code) => {
      if (await store.isDeletedCode(code)) { const e = new Error('account_deleted'); e.dead = true; throw e; }
      return Cosmetics.normalizeProfile(Cosmetics.defaultProfile());
    },
    normalizeDeviceId: () => '', persistDeviceBind: async () => {}, probeFriendCodeAlive: async () => true,
    saveCosmeticsProfile: async () => {}
  };
  const ws = { _friendCode: CODE, _accountBound: false };
  /** Fire all ops at once (like concurrent requests) and resolve with every result message. */
  function run(ops) {
    const got = [];
    const p = new Promise((resolve) => {
      waiters.push((m) => {
        if (/_result$/.test(m.type)) { got.push(m); if (got.length === ops.length) resolve(got); }
      });
    });
    for (const [type, kind, id] of ops) handleSessionCosmetics(type, ws, { kind, id }, shared);
    return p;
  }
  const one = async (type, kind, id) => (await run([[type, kind, id]]))[0];
  return { run, one, sent };
}

describe('memory store atomic economy (same contract as PostgresStore)', () => {
  let store;
  beforeEach(async () => { store = new MemoryStore(); await store.init(); await store.saveAccount(mkAccount()); });

  it('parallel buys of the same skin charge exactly once', async () => {
    const h = harness(store);
    const res = await h.run(Array.from({ length: 20 }, () => ['cosmetics_buy', 'skin', 'sunset']));
    assert.equal(res.filter((r) => r.ok).length, 1);
    assert.equal(res.filter((r) => !r.ok && r.error === 'owned').length, 19);
    const acc = await store.loadAccountByCode(CODE);
    assert.equal(acc.diamonds, 500 - PRICES.sunset);
    assert.deepEqual(acc.ownedSkins.filter((x) => x === 'sunset').length, 1);
    const prof = await store.loadProfile(CODE);
    assert.equal(prof.diamonds, acc.diamonds, 'profile mirror equals the account balance');
  });

  it('parallel buys of different skins never overspend and the balance is exact', async () => {
    const h = harness(store);
    const ids = Object.keys(PRICES);
    const res = await h.run(ids.map((id) => ['cosmetics_buy', 'skin', id]));
    const acc = await store.loadAccountByCode(CODE);
    const spent = acc.ownedSkins.filter((x) => x !== 'default').reduce((n, id) => n + PRICES[id], 0);
    assert.ok(acc.diamonds >= 0);
    assert.equal(acc.diamonds, 500 - spent);
    assert.ok(res.some((r) => !r.ok && r.error === 'funds'), 'total price (995) exceeds 500, so some buys must be refused');
    assert.equal(res.filter((r) => r.ok).length, acc.ownedSkins.length - 1);
  });

  it('a profile PATCH racing with buys does not undo a purchase (and vice versa)', async () => {
    const h = harness(store);
    const buy = h.one('cosmetics_buy', 'skin', 'neon');
    const patches = Array.from({ length: 10 }, (_, i) => store.atomicAccountUpdate(CODE, (a) => { a.nick = 'nick' + i; a.best = Math.max(a.best, i); }));
    const [r] = await Promise.all([buy, ...patches]);
    assert.equal(r.ok, true);
    const acc = await store.loadAccountByCode(CODE);
    assert.equal(acc.diamonds, 500 - PRICES.neon);
    assert.ok(acc.ownedSkins.includes('neon'));
    assert.equal(acc.best, 9);
    assert.match(acc.nick, /^nick\d$/);
  });

  it('trophy deltas are atomic: no lost updates, clamped at 0 and 999999', async () => {
    const deltas = [];
    for (let i = 0; i < 40; i++) deltas.push(i % 3 === 0 ? -15 : 25);
    await Promise.all(deltas.map((d) => store.adjustAccountCounters(CODE, { trophies: d })));
    let expect = 0;
    for (const d of deltas) expect = Math.max(0, Math.min(999999, expect + d));
    // order of parallel calls is the call order here (FIFO per key) so the clamped fold must match
    assert.equal((await store.loadAccountByCode(CODE)).trophies, expect);
    assert.equal(await store.adjustAccountCounters(CODE, { trophies: -999999 }), 0);
    assert.equal(await store.adjustAccountCounters('ZZZZ9999', { trophies: 5 }), null, 'unknown account -> null');
  });

  it('rolled-back mutators leave nothing behind; async mutators are refused', async () => {
    const out = await store.atomicEconomyUpdate(CODE, ({ account }) => { account.diamonds = 1; return { commit: false, result: 'x' }; });
    assert.equal(out, 'x');
    assert.equal((await store.loadAccountByCode(CODE)).diamonds, 500);
    await assert.rejects(() => store.atomicAccountUpdate(CODE, async () => {}), /synchronous/);
    await assert.rejects(() => store.atomicEconomyUpdate(CODE, async () => ({ commit: false })), /synchronous/);
    assert.equal(await store.atomicAccountUpdate('ZZZZ9999', () => {}), null);
  });

  it('a guest (no account) buys against the profile row; parallel buys stay exact', async () => {
    const g = new MemoryStore(); await g.init();
    const h = harness(g);
    const res = await h.run(['ocean', 'forest', 'mono'].map((id) => ['cosmetics_buy', 'skin', id]));
    assert.ok(res.every((r) => r.ok));
    const prof = await g.loadProfile(CODE);
    assert.equal(prof.diamonds, Cosmetics.defaultProfile().diamonds - 105);
    assert.deepEqual(prof.ownedSkins.slice().sort(), ['default', 'forest', 'mono', 'ocean']);
  });

  it('a deleted identity cannot buy or equip', async () => {
    await store.markDeletedCode(CODE, 'account_deleted', 3600);
    const h = harness(store);
    const r = await h.one('cosmetics_buy', 'skin', 'ocean');
    assert.equal(r.ok, false);
    assert.equal(r.error, 'account_deleted');
    assert.equal((await store.loadAccountByCode(CODE)).diamonds, 500);
  });
});

/** Minimal pg stand-in: records statements, answers the SELECTs from fixtures. */
function fakePool(fx) {
  const log = [];
  let released = 0;
  const norm = (sql) => String(sql).replace(/\s+/g, ' ').trim();
  const client = {
    async query(sql, params) {
      const q = norm(sql);
      log.push({ q, params });
      if (/^SELECT \* FROM accounts WHERE friend_code/.test(q)) return { rows: fx.account ? [fx.account] : [] };
      if (/^SELECT \* FROM profiles WHERE friend_code/.test(q)) return { rows: fx.profile ? [fx.profile] : [] };
      if (/^SELECT 1 FROM deleted_codes/.test(q)) return { rows: fx.deleted ? [{}] : [] };
      if (/RETURNING trophies/.test(q)) return { rows: fx.counterRow ? [fx.counterRow] : [] };
      return { rows: [] };
    },
    release() { released++; }
  };
  return { pool: { connect: async () => client, query: (s, p) => client.query(s, p) }, log, released: () => released };
}
const accRow = () => ({
  id: 'acc1', login: 't', pass_salt: 's', pass_hash: 'h', friend_code: CODE, nick: 'T', trophies: 5, diamonds: 100, best: 0,
  owned_skins: ['default'], owned_boards: ['field_default'], friends: [], history: [], achievements: {}, bot_stars: {},
  avatar_id: 'init', avatar_custom: '', status: '', skin_id: 'default', board_id: 'field_default', classic_save: null,
  created_at: 1, updated_at: 1
});
const kinds = (log) => log.map((l) => l.q.split(' ').slice(0, 3).join(' '));

describe('PostgresStore transaction / locking statements (fake pool)', () => {
  it('atomicEconomyUpdate: advisory lock -> row locks -> writes -> COMMIT, connection released', async () => {
    const f = fakePool({ account: accRow(), profile: null });
    const s = new PostgresStore(f.pool);
    const out = await s.atomicEconomyUpdate(CODE, ({ account }) => {
      account.diamonds = 70;
      return { commit: true, result: 'done', account, profile: { diamonds: 70, ownedSkins: ['default', 'ocean'], ownedBoards: ['field_default'], equippedSkin: 'ocean', equippedBoard: 'field_default', migrated: true }, profileTtlSec: null };
    });
    assert.equal(out, 'done');
    const k = f.log.map((l) => l.q);
    assert.equal(k[0], 'BEGIN');
    assert.match(k[1], /pg_advisory_xact_lock\(hashtext\(\$1\)\)/);
    assert.deepEqual(f.log[1].params, ['econ:' + CODE]);
    assert.match(k[2], /FROM accounts WHERE friend_code = \$1 FOR UPDATE$/);
    assert.match(k[3], /FROM profiles WHERE friend_code = \$1 FOR UPDATE$/);
    assert.ok(k.findIndex((q) => /^INSERT INTO accounts/.test(q)) > 3);
    assert.ok(k.findIndex((q) => /^INSERT INTO profiles/.test(q)) > 3);
    assert.equal(k[k.length - 1], 'COMMIT');
    assert.equal(f.released(), 1);
    const upd = f.log.find((l) => /^INSERT INTO accounts/.test(l.q));
    assert.match(upd.q, /diamonds = EXCLUDED\.diamonds/, 'transactional write includes the economy columns');
  });

  it('commit:false, a throwing mutator and an async mutator all ROLLBACK without writing', async () => {
    for (const fn of [
      () => ({ commit: false, result: 1 }),
      () => { throw new Error('boom'); },
      async () => ({ commit: true })
    ]) {
      const f = fakePool({ account: accRow() });
      const s = new PostgresStore(f.pool);
      try { await s.atomicEconomyUpdate(CODE, fn); } catch (_) {}
      const k = f.log.map((l) => l.q);
      assert.equal(k[k.length - 1], 'ROLLBACK');
      assert.ok(!k.some((q) => /^INSERT/.test(q)), 'nothing written');
      assert.ok(!k.includes('COMMIT'));
      assert.equal(f.released(), 1);
    }
  });

  it('a deleted identity is reported to the mutator inside the transaction', async () => {
    const f = fakePool({ account: null, profile: null, deleted: true });
    const s = new PostgresStore(f.pool);
    let seen;
    await s.atomicEconomyUpdate(CODE, (l) => { seen = l; return { commit: false, result: null }; });
    assert.equal(seen.deleted, true);
    assert.equal(seen.account, null);
  });

  it('atomicAccountUpdate locks the row, writes the fresh row, and returns null for no account', async () => {
    const f = fakePool({ account: accRow() });
    const out = await new PostgresStore(f.pool).atomicAccountUpdate(CODE, (a) => { a.nick = 'N'; return 7; });
    assert.equal(out.result, 7);
    assert.equal(out.account.nick, 'N');
    assert.deepEqual(kinds(f.log).slice(0, 2), ['BEGIN', 'SELECT * FROM']);
    assert.match(f.log[1].q, /FOR UPDATE$/);
    assert.equal(f.log[f.log.length - 1].q, 'COMMIT');
    const none = fakePool({ account: null });
    assert.equal(await new PostgresStore(none.pool).atomicAccountUpdate(CODE, () => {}), null);
    assert.equal(none.log[none.log.length - 1].q, 'ROLLBACK');
  });

  it('saveAccount (unlocked path) never overwrites the economy columns on conflict', async () => {
    const f = fakePool({});
    await new PostgresStore(f.pool).saveAccount({ id: 'acc1', login: 't', friendCode: CODE, diamonds: 999999, trophies: 999, ownedSkins: ['x'] });
    const q = f.log[0].q;
    const conflict = q.slice(q.indexOf('ON CONFLICT'));
    for (const col of ['trophies', 'diamonds', 'owned_skins', 'owned_boards', 'skin_id', 'board_id']) {
      assert.ok(!new RegExp('\\b' + col + ' = EXCLUDED').test(conflict), col + ' must not be updated on conflict');
    }
    assert.match(conflict, /friends = EXCLUDED\.friends/);
  });

  it('adjustAccountCounters is one UPDATE with the arithmetic and clamp in SQL', async () => {
    const f = fakePool({ counterRow: { trophies: 30 } });
    const out = await new PostgresStore(f.pool).adjustAccountCounters(CODE, { trophies: 25 });
    assert.equal(out, 30);
    assert.equal(f.log.length, 1);
    assert.match(f.log[0].q, /SET trophies = GREATEST\(0, LEAST\(999999, trophies \+ \$2\)\)/);
    assert.match(f.log[0].q, /RETURNING trophies/);
    assert.deepEqual(f.log[0].params.slice(0, 2), [CODE, 25]);
    assert.equal(await new PostgresStore(fakePool({}).pool).adjustAccountCounters(CODE, { trophies: 1 }), null);
  });
});
