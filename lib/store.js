/**
 * Persistence for Block Puzzle.
 *
 * Modes (env BP_STORE or STORE):
 *   postgres — default / production (DATABASE_URL required). Source of truth for all player progress.
 *   memory   — in-process only (tests / throwaway). Explicit BP_STORE=memory.
 *
 * File and Redis full-stores were removed. Durable player data is PostgreSQL only.
 */
'use strict';

const { clock } = require('./clock');
const { withKeyLock } = require('./keyed-lock');
const ROOM_TTL_LIVE = 60 * 60;
const ROOM_TTL_ENDED = 180;
const SOCIAL_TTL = 7 * 24 * 3600;
const TOKEN_TTL = 60 * 60;
const QUEUE_TTL = 2 * 60;
const PRESENCE_TTL = 7 * 24 * 3600;
const PROFILE_TTL = 365 * 24 * 3600;
const SESSION_TTL_DEFAULT = 30 * 24 * 3600;

class MemoryStore {
  constructor() {
    this.kind = 'memory';
    this.rooms = new Map();
    this.tokens = new Map();
    this.social = new Map();
    this._queue = null;
    this._queueExp = 0;
    this.presence = new Map();
    this.profiles = new Map();
    this.guestProgress = new Map();
    this.accounts = new Map();
    this.accountLogin = new Map();
    this.accountCode = new Map();
    this.sessions = new Map();
    this.deviceBinds = new Map();
    this.deletedCodes = new Map(); // code -> exp
  }

  async init() { return this; }

  async saveRoom(id, data, ttlSec) {
    this.rooms.set(id, { data, exp: clock.now() + (ttlSec || ROOM_TTL_LIVE) * 1000 });
  }
  async loadRoom(id) {
    const e = this.rooms.get(id);
    if (!e) return null;
    if (e.exp && clock.now() > e.exp) { this.rooms.delete(id); return null; }
    return e.data;
  }
  async deleteRoom(id) { this.rooms.delete(id); }
  async listRoomIds() {
    const now = clock.now();
    const ids = [];
    for (const [id, e] of this.rooms) {
      if (e.exp && now > e.exp) this.rooms.delete(id);
      else ids.push(id);
    }
    return ids;
  }

  async bindToken(token, matchId, ttlSec) {
    this.tokens.set(token, { matchId, exp: clock.now() + (ttlSec || TOKEN_TTL) * 1000 });
  }
  async unbindToken(token) { this.tokens.delete(token); }
  async tokenMatch(token) {
    const e = this.tokens.get(token);
    if (!e) return null;
    if (e.exp && clock.now() > e.exp) { this.tokens.delete(token); return null; }
    return e.matchId;
  }

  async getSocial(code) { return this.social.get(code) || []; }
  async setSocial(code, arr) {
    if (!arr || !arr.length) this.social.delete(code);
    else this.social.set(code, arr.slice(-50));
  }

  async saveQueue(entries, ttlSec) {
    this._queue = Array.isArray(entries) ? entries : [];
    this._queueExp = clock.now() + (ttlSec || QUEUE_TTL) * 1000;
  }
  async loadQueue() {
    if (!this._queue) return [];
    if (this._queueExp && clock.now() > this._queueExp) { this._queue = null; return []; }
    return this._queue.slice();
  }

  async savePresence(code, data, ttlSec) {
    if (!code) return;
    this.presence.set(String(code).toUpperCase(), {
      data: data || {},
      exp: clock.now() + (ttlSec || PRESENCE_TTL) * 1000
    });
  }
  async loadPresence(code) {
    const e = this.presence.get(String(code || '').toUpperCase());
    if (!e) return null;
    if (e.exp && clock.now() > e.exp) {
      this.presence.delete(String(code).toUpperCase());
      return null;
    }
    return e.data;
  }
  async listPresenceCodes() {
    const now = clock.now();
    const codes = [];
    for (const [code, e] of this.presence) {
      if (e.exp && now > e.exp) this.presence.delete(code);
      else codes.push(code);
    }
    return codes;
  }
  async deletePresence(code) {
    if (code) this.presence.delete(String(code).toUpperCase());
  }

  async saveProfile(code, data, ttlSec) {
    if (!code) return;
    if (await this.isDeletedCode(code)) return; // never resurrect a deleted identity
    this.profiles.set(String(code).toUpperCase(), {
      data,
      exp: ttlSec != null ? clock.now() + ttlSec * 1000 : null
    });
  }
  async loadProfile(code) {
    const e = this.profiles.get(String(code || '').toUpperCase());
    if (!e) return null;
    if (e.exp && clock.now() > e.exp) {
      this.profiles.delete(String(code).toUpperCase());
      return null;
    }
    return e.data;
  }
  async deleteProfile(code) {
    if (code) this.profiles.delete(String(code).toUpperCase());
  }

  async saveGuestProgress(code, data) {
    if (!code || !data) return;
    if (await this.isDeletedCode(code)) return; // never resurrect a deleted identity
    this.guestProgress.set(String(code).toUpperCase(), data);
  }
  async loadGuestProgress(code) {
    if (!code) return null;
    return this.guestProgress.get(String(code).toUpperCase()) || null;
  }
  async deleteGuestProgress(code) {
    if (code) this.guestProgress.delete(String(code).toUpperCase());
  }

  async purgeGuestProfiles(maxAgeMs) {
    if (!this.profiles) return 0;
    const now = clock.now();
    let n = 0;
    for (const [code, e] of this.profiles.entries()) {
      const expired = e.exp && now > e.exp;
      const old = maxAgeMs && e.data && e.data.updatedAt && (now - e.data.updatedAt > maxAgeMs);
      let isRegistered = false;
      try {
        if (this.accountCode && this.accountCode.has(String(code).toUpperCase())) isRegistered = true;
      } catch (_) {}
      if (!isRegistered && (expired || old)) {
        this.profiles.delete(code);
        n++;
      }
    }
    // Purge abandoned guest_progress so codes can be reused
    if (this.guestProgress && maxAgeMs) {
      for (const [code, data] of Array.from(this.guestProgress.entries())) {
        let isRegistered = false;
        try {
          if (this.accountCode && this.accountCode.has(String(code).toUpperCase())) isRegistered = true;
        } catch (_) {}
        if (isRegistered) continue;
        const updated = (data && (data.updatedAt || data.ts)) || 0;
        if (!updated || now - updated > maxAgeMs) {
          this.guestProgress.delete(code);
          n++;
        }
      }
    }
    return n;
  }

  async markDeletedCode(code, reason, ttlSec) {
    const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
    if (!c) return;
    const ttl = typeof ttlSec === 'number' && ttlSec > 0 ? ttlSec : 30 * 24 * 3600;
    this.deletedCodes.set(c, clock.now() + ttl * 1000);
  }
  async isDeletedCode(code) {
    const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
    if (!c) return false;
    const exp = this.deletedCodes.get(c);
    if (!exp) return false;
    if (clock.now() > exp) { this.deletedCodes.delete(c); return false; }
    return true;
  }
  async unmarkDeletedCode(code) {
    const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
    if (c) this.deletedCodes.delete(c);
  }
  async listDeletedCodes() {
    const now = clock.now();
    const out = [];
    for (const [code, exp] of Array.from(this.deletedCodes.entries())) {
      if (now > exp) this.deletedCodes.delete(code);
      else out.push({ code, reason: 'account_deleted', deletedAt: exp - 30 * 24 * 3600 * 1000, exp });
    }
    return out;
  }

  async saveAccount(acc) {
    if (!acc || !acc.id) return;
    this.accounts.set(acc.id, acc);
    if (acc.login) this.accountLogin.set(String(acc.login).toLowerCase(), acc.id);
    if (acc.friendCode) this.accountCode.set(String(acc.friendCode).toUpperCase(), acc.id);
  }
  // ── Atomic economy (same contract as PostgresStore; in-process lock instead of row locks) ──
  _econKey(code) { return 'store-econ:' + String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16); }

  async atomicAccountUpdate(code, fn) {
    if (!code) return null;
    return withKeyLock(this._econKey(code), async () => {
      const cur = await this.loadAccountByCode(code);
      if (!cur) return null;
      const draft = structuredClone(cur);
      const result = fn(draft);
      if (result && typeof result.then === 'function') throw new Error('atomic mutator must be synchronous');
      await this.saveAccount(draft);
      return { account: draft, result };
    });
  }

  async atomicEconomyUpdate(code, fn) {
    if (!code) return null;
    return withKeyLock(this._econKey(code), async () => {
      const cur = await this.loadAccountByCode(code);
      const account = cur ? structuredClone(cur) : null;
      const raw = await this.loadProfile(code);
      const profile = raw ? structuredClone(raw) : null;
      const deleted = await this.isDeletedCode(code);
      const out = fn({ account, profile, deleted });
      if (out && typeof out.then === 'function') throw new Error('atomic mutator must be synchronous');
      if (!out || !out.commit) return out ? out.result : undefined;
      if (out.account && account) await this.saveAccount(out.account);
      if (out.profile) await this.saveProfile(code, out.profile, out.profileTtlSec);
      return out.result;
    });
  }

  async adjustAccountCounters(code, delta) {
    if (!code) return null;
    return withKeyLock(this._econKey(code), async () => {
      const cur = await this.loadAccountByCode(code);
      if (!cur) return null;
      const t = (delta && delta.trophies) | 0;
      cur.trophies = Math.max(0, Math.min(999999, (cur.trophies | 0) + t));
      cur.updatedAt = clock.now();
      await this.saveAccount(cur);
      return cur.trophies | 0;
    });
  }

  async loadAccountById(id) {
    if (!id) return null;
    return this.accounts.get(id) || null;
  }
  async loadAccountByLogin(login) {
    if (!login) return null;
    const id = this.accountLogin.get(String(login).toLowerCase());
    return id ? this.loadAccountById(id) : null;
  }
  async loadAccountByCode(code) {
    if (!code) return null;
    const id = this.accountCode.get(String(code).toUpperCase());
    return id ? this.loadAccountById(id) : null;
  }
  async searchAccounts(q, limit) {
    limit = Math.min(50, Math.max(1, limit | 0) || 20);
    if (!q) return [];
    const qL = String(q).toLowerCase().trim();
    const qCode = String(q).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (qL.length < 1 && qCode.length < 1) return [];
    const out = [];
    for (const acc of this.accounts.values()) {
      if (!acc) continue;
      const login = String(acc.login || '').toLowerCase();
      const nick = String(acc.nick || '').toLowerCase();
      const code = String(acc.friendCode || '').toUpperCase();
      const nameHit = qL.length >= 2 && (login.indexOf(qL) !== -1 || nick.indexOf(qL) !== -1);
      const codeHit = qCode.length >= 2 && code.indexOf(qCode) === 0;
      if (nameHit || codeHit) {
        out.push(acc);
        if (out.length >= limit) break;
      }
    }
    return out;
  }

  async saveSession(token, accountId, ttlSec) {
    if (!token || !accountId) return;
    this.sessions.set(token, {
      accountId,
      exp: clock.now() + (ttlSec || SESSION_TTL_DEFAULT) * 1000
    });
  }
  async loadSession(token) {
    if (!token) return null;
    const e = this.sessions.get(token);
    if (!e) return null;
    if (e.exp && clock.now() > e.exp) { this.sessions.delete(token); return null; }
    return e.accountId;
  }
  async deleteSession(token) {
    if (token) this.sessions.delete(token);
  }

  async loadDeviceBind(deviceId) {
    const id = String(deviceId || '').trim();
    if (!id) return null;
    const e = this.deviceBinds.get(id);
    if (!e) return null;
    return {
      deviceId: id,
      accountIds: Array.isArray(e.accountIds) ? e.accountIds.slice() : [],
      guestProgress: e.guestProgress || null,
      updatedAt: e.updatedAt || 0
    };
  }
  async saveDeviceBind(deviceId, data) {
    const id = String(deviceId || '').trim();
    if (!id || !data) return;
    this.deviceBinds.set(id, {
      accountIds: Array.isArray(data.accountIds) ? data.accountIds.map(String).slice(-32) : [],
      guestProgress: data.guestProgress || null,
      updatedAt: data.updatedAt || clock.now()
    });
  }
  /**
   * In-memory atomic RMW for device binds.
   * Serialised via withKeyLock so concurrent callers cannot lost-update.
   * fn(rec) may mutate rec; return value is passed through.
   */
  async atomicDeviceBindUpdate(deviceId, fn) {
    const id = String(deviceId || '').trim();
    if (!id || typeof fn !== 'function') return null;
    const { withKeyLock } = require('./keyed-lock');
    return withKeyLock('membind:' + id, async () => {
      let e = this.deviceBinds.get(id);
      if (!e) {
        e = { accountIds: [], guestProgress: null, updatedAt: 0 };
      } else {
        e = {
          accountIds: Array.isArray(e.accountIds) ? e.accountIds.slice() : [],
          guestProgress: e.guestProgress || null,
          updatedAt: e.updatedAt || 0
        };
      }
      const rec = { deviceId: id, accountIds: e.accountIds, guestProgress: e.guestProgress, updatedAt: e.updatedAt };
      const out = fn(rec);
      if (out && typeof out.then === 'function') throw new Error('atomicDeviceBindUpdate mutator must be synchronous');
      if (out && out.commit === false) return out.result;
      this.deviceBinds.set(id, {
        accountIds: Array.isArray(rec.accountIds) ? rec.accountIds.map(String).slice(-32) : [],
        guestProgress: rec.guestProgress || null,
        updatedAt: clock.now()
      });
      return out && 'result' in out ? out.result : out;
    });
  }
  async deleteDeviceBind(deviceId) {
    if (deviceId) this.deviceBinds.delete(String(deviceId).trim());
  }
  async unbindAccountFromDevices(accountId) {
    if (!accountId) return;
    const aid = String(accountId);
    for (const [id, e] of this.deviceBinds.entries()) {
      if (!e || !Array.isArray(e.accountIds)) continue;
      const next = e.accountIds.filter((x) => x !== aid);
      if (next.length === 0 && !e.guestProgress) this.deviceBinds.delete(id);
      else {
        e.accountIds = next;
        e.updatedAt = clock.now();
      }
    }
  }



  async deleteAccount(acc) {
    if (!acc || !acc.id) return false;
    this.accounts.delete(acc.id);
    if (acc.login) this.accountLogin.delete(String(acc.login).toLowerCase());
    if (acc.friendCode) this.accountCode.delete(String(acc.friendCode).toUpperCase());
    for (const [tok, e] of this.sessions.entries()) {
      if (e && e.accountId === acc.id) this.sessions.delete(tok);
    }
    try {
      if (acc.friendCode) {
        await this.deleteProfile(acc.friendCode);
        await this.deletePresence(acc.friendCode);
        await this.deleteGuestProgress(acc.friendCode);
      }
    } catch (_) {}
    return true;
  }

  async purgeFriendFromAllAccounts(friendCode) {
    const code = String(friendCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code) return 0;
    let n = 0;
    for (const acc of this.accounts.values()) {
      if (!acc || !Array.isArray(acc.friends) || !acc.friends.length) continue;
      const before = acc.friends.length;
      acc.friends = acc.friends.filter((f) => {
        const c = String((f && f.code) || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        return c !== code;
      });
      if (acc.friends.length !== before) n++;
    }
    return n;
  }

  /**
   * Remove a friend code from EVERY friends list (accounts, guest progress, device binds).
   * Returns the friend codes of the owners whose list changed (so they can be notified).
   */
  async purgeFriendReferences(friendCode) {
    const code = String(friendCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code) return [];
    const norm = (f) => String((f && f.code) || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const strip = (obj) => {
      if (!obj || !Array.isArray(obj.friends)) return false;
      const before = obj.friends.length;
      obj.friends = obj.friends.filter((f) => norm(f) !== code);
      return obj.friends.length !== before;
    };
    const owners = new Set();
    for (const acc of this.accounts.values()) {
      if (strip(acc) && acc.friendCode) owners.add(String(acc.friendCode).toUpperCase());
    }
    for (const [c, gp] of this.guestProgress.entries()) {
      if (strip(gp)) owners.add(String(c).toUpperCase());
    }
    for (const e of this.deviceBinds.values()) {
      if (e && strip(e.guestProgress) && e.guestProgress.friendCode) {
        owners.add(String(e.guestProgress.friendCode).toUpperCase());
      }
    }
    owners.delete(code);
    return Array.from(owners);
  }

  async close() {}
}

async function createStore() {
  const mode = String(process.env.BP_STORE || process.env.STORE || '').toLowerCase();

  if (mode === 'memory') {
    const s = new MemoryStore();
    await s.init();
    console.log('[store] memory (tests / throwaway only)');
    return s;
  }

  if (mode && mode !== 'postgres' && mode !== 'postgresql' && mode !== 'pg' && mode !== 'sql') {
    console.warn('[store] BP_STORE=' + mode + ' is no longer supported; using postgres');
  }

  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PG_URL || '';
  if (!databaseUrl && !process.env.PGHOST && !process.env.POSTGRES_HOST) {
    const err = new Error(
      'PostgreSQL is required. Set DATABASE_URL=postgres://user:pass@host:5432/blockpuzzle\n' +
      '  Docker: docker compose up -d --build\n' +
      '  Tests only: BP_STORE=memory'
    );
    console.error('[store]', err.message);
    throw err;
  }

  const { createPostgresStore } = require('./postgres-store');
  const s = await createPostgresStore();
  console.log('[store] postgres (sole source of truth for player progress)');
  return s;
}

module.exports = {
  createStore,
  MemoryStore,
  ROOM_TTL_LIVE,
  ROOM_TTL_ENDED,
  TOKEN_TTL,
  SOCIAL_TTL,
  QUEUE_TTL,
  PRESENCE_TTL,
  PROFILE_TTL,
  SESSION_TTL_DEFAULT
};
