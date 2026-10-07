/**
 * Block Puzzle — lib/keyed-lock.js
 * In-process per-key async mutex. Serialises read-modify-write sequences on the same identity
 * (buy / equip / trophy award / profile PATCH) so concurrent requests cannot act on a stale
 * copy of the balance (lost update / TOCTOU).
 *
 * Scope: ONE server process (presence and rooms are in-memory, so the server is single-instance
 * by design). For multi-instance deployments use row locks / optimistic versions in PostgreSQL.
 */
'use strict';

const tails = new Map();

function normKey(code) {
  return 'acct:' + String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
}

/** Run fn() after every previously queued task for `key` has settled. Never rejects the chain. */
function withKeyLock(key, fn) {
  const prev = tails.get(key) || Promise.resolve();
  const run = prev.then(() => fn(), () => fn());
  const tail = run.then(() => {}, () => {});
  tails.set(key, tail);
  tail.then(() => { if (tails.get(key) === tail) tails.delete(key); });
  return run;
}

module.exports = { withKeyLock, normKey, _size: () => tails.size };
