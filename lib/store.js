/**
 * Persistence for Block Puzzle match state.
 *
 * Modes (env BP_STORE or STORE):
 *   file    — default, JSON files in data/ (zero deps)
 *   memory  — no persistence (explicit only)
 *   redis   — REDIS_URL=redis://host:6379 (mini RESP client, no npm)
 *
 * Persists:
 *   - active / recently-ended match rooms (rejoin after restart)
 *   - pending social messages while offline
 *   - token → matchId index for rejoin
 *   - ranked queue snapshots (saveQueue/loadQueue, TTL 2 min)
 *   - presence (savePresence/loadPresence/listPresenceCodes, last-seen up to 7 days)
 *   - cosmetics profiles (saveProfile/loadProfile by friendCode)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { MiniRedis, parseRedisUrl } = require('./mini-redis');

const PREFIX = 'bp:';
const ROOM_TTL_LIVE = 60 * 60;
const ROOM_TTL_ENDED = 180;
const SOCIAL_TTL = 7 * 24 * 3600;
const TOKEN_TTL = 60 * 60;
const QUEUE_TTL = 2 * 60;
const PRESENCE_TTL = 7 * 24 * 3600;
const PROFILE_TTL = 365 * 24 * 3600;

function roomKey(id) { return PREFIX + 'room:' + id; }
function tokenKey(tok) { return PREFIX + 'tok:' + tok; }
function socialKey(code) { return PREFIX + 'soc:' + code; }
function queueStoreKey() { return PREFIX + 'queue'; }
function presenceKey(code) { return PREFIX + 'pres:' + code; }
function presenceIndexKey() { return PREFIX + 'pres:index'; }
function profileKey(code) { return PREFIX + 'prof:' + code; }
function accountIdKey(id) { return PREFIX + 'acc:id:' + id; }
function accountLoginKey(login) { return PREFIX + 'acc:login:' + String(login || '').toLowerCase(); }
function accountCodeKey(code) { return PREFIX + 'acc:code:' + String(code || '').toUpperCase(); }
function sessionKey(tok) { return PREFIX + 'sess:' + tok; }
const ACCOUNT_TTL = 10 * 365 * 24 * 3600;
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
  }
  async init() { return this; }
  async saveRoom(id, data, ttlSec) {
    this.rooms.set(id, { data, exp: Date.now() + (ttlSec || ROOM_TTL_LIVE) * 1000 });
  }
  async loadRoom(id) {
    const e = this.rooms.get(id);
    if (!e) return null;
    if (e.exp && Date.now() > e.exp) { this.rooms.delete(id); return null; }
    return e.data;
  }
  async deleteRoom(id) { this.rooms.delete(id); }
  async listRoomIds() {
    const now = Date.now();
    const ids = [];
    for (const [id, e] of this.rooms) {
      if (e.exp && now > e.exp) this.rooms.delete(id);
      else ids.push(id);
    }
    return ids;
  }
  async bindToken(token, matchId, ttlSec) {
    this.tokens.set(token, { matchId, exp: Date.now() + (ttlSec || TOKEN_TTL) * 1000 });
  }
  async unbindToken(token) { this.tokens.delete(token); }
  async tokenMatch(token) {
    const e = this.tokens.get(token);
    if (!e) return null;
    if (e.exp && Date.now() > e.exp) { this.tokens.delete(token); return null; }
    return e.matchId;
  }
  async getSocial(code) { return this.social.get(code) || []; }
  async setSocial(code, arr) {
    if (!arr || !arr.length) this.social.delete(code);
    else this.social.set(code, arr.slice(-50));
  }
  async saveQueue(entries, ttlSec) {
    this._queue = Array.isArray(entries) ? entries : [];
    this._queueExp = Date.now() + (ttlSec || QUEUE_TTL) * 1000;
  }
  async loadQueue() {
    if (!this._queue) return [];
    if (this._queueExp && Date.now() > this._queueExp) { this._queue = null; return []; }
    return this._queue.slice();
  }
  async savePresence(code, data, ttlSec) {
    if (!code) return;
    this.presence.set(code, { data: data || {}, exp: Date.now() + (ttlSec || PRESENCE_TTL) * 1000 });
  }
  async loadPresence(code) {
    const e = this.presence.get(code);
    if (!e) return null;
    if (e.exp && Date.now() > e.exp) { this.presence.delete(code); return null; }
    return e.data;
  }
  async listPresenceCodes() {
    const now = Date.now();
    const codes = [];
    for (const [code, e] of this.presence) {
      if (e.exp && now > e.exp) this.presence.delete(code);
      else codes.push(code);
    }
    return codes;
  }
  async saveProfile(code, data, ttlSec) {
    if (!code) return;
    if (!this.profiles) this.profiles = new Map();
    this.profiles.set(String(code).toUpperCase(), {
      data: data || {},
      exp: Date.now() + (ttlSec || PROFILE_TTL) * 1000
    });
  }
  async loadProfile(code) {
    if (!code || !this.profiles) return null;
    const e = this.profiles.get(String(code).toUpperCase());
    if (!e) return null;
    if (e.exp && Date.now() > e.exp) { this.profiles.delete(String(code).toUpperCase()); return null; }
    return e.data;
  }
  async deletePresence(code) {
    if (!code || !this.presence) return;
    this.presence.delete(String(code).toUpperCase());
    this.presence.delete(code);
  }
  async deleteProfile(code) {
    if (!code || !this.profiles) return;
    this.profiles.delete(String(code).toUpperCase());
  }
  /** Remove expired guest cosmetics profiles (not linked to registered accounts). */
  async purgeGuestProfiles(maxAgeMs) {
    if (!this.profiles) return 0;
    const now = Date.now();
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
    return n;
  }

  async saveAccount(acc) {
    if (!acc || !acc.id) return;
    if (!this.accounts) this.accounts = new Map();
    if (!this.accountLogin) this.accountLogin = new Map();
    if (!this.accountCode) this.accountCode = new Map();
    this.accounts.set(acc.id, acc);
    if (acc.login) this.accountLogin.set(String(acc.login).toLowerCase(), acc.id);
    if (acc.friendCode) this.accountCode.set(String(acc.friendCode).toUpperCase(), acc.id);
  }
  async loadAccountById(id) {
    if (!id || !this.accounts) return null;
    return this.accounts.get(id) || null;
  }
  async loadAccountByLogin(login) {
    if (!login || !this.accountLogin) return null;
    const id = this.accountLogin.get(String(login).toLowerCase());
    return id ? this.loadAccountById(id) : null;
  }
  async loadAccountByCode(code) {
    if (!code || !this.accountCode) return null;
    const id = this.accountCode.get(String(code).toUpperCase());
    return id ? this.loadAccountById(id) : null;
  }
  /**
   * Partial search by login / nick / friendCode (for offline player find).
   * @param {string} q
   * @param {number} [limit=20]
   * @returns {Promise<object[]>}
   */
  async searchAccounts(q, limit) {
    limit = Math.min(50, Math.max(1, limit | 0) || 20);
    if (!this.accounts || !q) return [];
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
    if (!this.sessions) this.sessions = new Map();
    this.sessions.set(token, {
      accountId,
      exp: Date.now() + (ttlSec || SESSION_TTL_DEFAULT) * 1000
    });
  }
  async loadSession(token) {
    if (!token || !this.sessions) return null;
    const e = this.sessions.get(token);
    if (!e) return null;
    if (e.exp && Date.now() > e.exp) { this.sessions.delete(token); return null; }
    return e.accountId;
  }
  async deleteSession(token) {
    if (this.sessions) this.sessions.delete(token);
  }
  async deleteAccount(acc) {
    if (!acc || !acc.id) return false;
    if (this.accounts) this.accounts.delete(acc.id);
    if (acc.login && this.accountLogin) this.accountLogin.delete(String(acc.login).toLowerCase());
    if (acc.friendCode && this.accountCode) this.accountCode.delete(String(acc.friendCode).toUpperCase());
    // Drop sessions pointing at this account
    if (this.sessions) {
      for (const [tok, e] of this.sessions.entries()) {
        if (e && e.accountId === acc.id) this.sessions.delete(tok);
      }
    }
    try {
      if (acc.friendCode) {
        await this.deleteProfile(acc.friendCode);
        await this.deletePresence(acc.friendCode);
      }
    } catch (_) {}
    return true;
  }
  async close() {}
}

class FileStore {
  constructor(dir) {
    this.kind = 'file';
    this.dir = dir || path.join(process.cwd(), 'data');
    this.roomsDir = path.join(this.dir, 'rooms');
    this.socialPath = path.join(this.dir, 'social.json');
    this.tokensPath = path.join(this.dir, 'tokens.json');
    this.queuePath = path.join(this.dir, 'queue.json');
    this.presenceDir = path.join(this.dir, 'presence');
    this.profilesDir = path.join(this.dir, 'profiles');
    this.accountsDir = path.join(this.dir, 'accounts');
    this.sessionsPath = path.join(this.dir, 'sessions.json');
    this._tokens = {};
    this._social = {};
    this._sessions = {};
  }
  async init() {
    fs.mkdirSync(this.roomsDir, { recursive: true });
    fs.mkdirSync(this.presenceDir, { recursive: true });
    fs.mkdirSync(this.profilesDir, { recursive: true });
    fs.mkdirSync(this.accountsDir, { recursive: true });
    try { this._tokens = JSON.parse(fs.readFileSync(this.tokensPath, 'utf8')); } catch (_) { this._tokens = {}; }
    try { this._social = JSON.parse(fs.readFileSync(this.socialPath, 'utf8')); } catch (_) { this._social = {}; }
    try { this._sessions = JSON.parse(fs.readFileSync(this.sessionsPath, 'utf8')); } catch (_) { this._sessions = {}; }
    return this;
  }
  _roomPath(id) {
    return path.join(this.roomsDir, String(id).replace(/[^a-zA-Z0-9_-]/g, '_') + '.json');
  }
  _profilePath(code) {
    return path.join(this.profilesDir, String(code).toUpperCase().replace(/[^A-Z0-9]/g, '') + '.json');
  }
  _presencePath(code) {
    return path.join(this.presenceDir, String(code).replace(/[^a-zA-Z0-9_-]/g, '_') + '.json');
  }
  async saveRoom(id, data, ttlSec) {
    fs.writeFileSync(this._roomPath(id), JSON.stringify({ data, exp: Date.now() + (ttlSec || ROOM_TTL_LIVE) * 1000 }));
  }
  async loadRoom(id) {
    try {
      const e = JSON.parse(fs.readFileSync(this._roomPath(id), 'utf8'));
      if (e.exp && Date.now() > e.exp) { try { fs.unlinkSync(this._roomPath(id)); } catch (_) {} return null; }
      return e.data;
    } catch (_) { return null; }
  }
  async deleteRoom(id) { try { fs.unlinkSync(this._roomPath(id)); } catch (_) {} }
  async listRoomIds() {
    let files = [];
    try { files = fs.readdirSync(this.roomsDir); } catch (_) { return []; }
    const ids = [];
    const now = Date.now();
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      try {
        const e = JSON.parse(fs.readFileSync(path.join(this.roomsDir, f), 'utf8'));
        if (e.exp && now > e.exp) { try { fs.unlinkSync(path.join(this.roomsDir, f)); } catch (_) {} continue; }
        if (e.data && e.data.id) ids.push(e.data.id);
        else ids.push(f.replace(/\.json$/, ''));
      } catch (_) {}
    }
    return ids;
  }
  _flushTokens() { try { fs.writeFileSync(this.tokensPath, JSON.stringify(this._tokens)); } catch (_) {} }
  _flushSocial() { try { fs.writeFileSync(this.socialPath, JSON.stringify(this._social)); } catch (_) {} }
  async bindToken(token, matchId, ttlSec) {
    this._tokens[token] = { matchId, exp: Date.now() + (ttlSec || TOKEN_TTL) * 1000 };
    this._flushTokens();
  }
  async unbindToken(token) { delete this._tokens[token]; this._flushTokens(); }
  async tokenMatch(token) {
    const e = this._tokens[token];
    if (!e) return null;
    if (e.exp && Date.now() > e.exp) { delete this._tokens[token]; this._flushTokens(); return null; }
    return e.matchId;
  }
  async getSocial(code) { return this._social[code] || []; }
  async setSocial(code, arr) {
    if (!arr || !arr.length) delete this._social[code];
    else this._social[code] = arr.slice(-50);
    this._flushSocial();
  }
  async saveQueue(entries, ttlSec) {
    try {
      fs.writeFileSync(this.queuePath, JSON.stringify({
        data: Array.isArray(entries) ? entries : [],
        exp: Date.now() + (ttlSec || QUEUE_TTL) * 1000
      }));
    } catch (_) {}
  }
  async loadQueue() {
    try {
      const e = JSON.parse(fs.readFileSync(this.queuePath, 'utf8'));
      if (e.exp && Date.now() > e.exp) { try { fs.unlinkSync(this.queuePath); } catch (_) {} return []; }
      return Array.isArray(e.data) ? e.data : [];
    } catch (_) { return []; }
  }
  async savePresence(code, data, ttlSec) {
    if (!code) return;
    try {
      fs.writeFileSync(this._presencePath(code), JSON.stringify({
        data: data || {},
        exp: Date.now() + (ttlSec || PRESENCE_TTL) * 1000
      }));
    } catch (_) {}
  }
  async loadPresence(code) {
    try {
      const e = JSON.parse(fs.readFileSync(this._presencePath(code), 'utf8'));
      if (e.exp && Date.now() > e.exp) { try { fs.unlinkSync(this._presencePath(code)); } catch (_) {} return null; }
      return e.data;
    } catch (_) { return null; }
  }
  async listPresenceCodes() {
    let files = [];
    try { files = fs.readdirSync(this.presenceDir); } catch (_) { return []; }
    const codes = [];
    const now = Date.now();
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      try {
        const e = JSON.parse(fs.readFileSync(path.join(this.presenceDir, f), 'utf8'));
        if (e.exp && now > e.exp) { try { fs.unlinkSync(path.join(this.presenceDir, f)); } catch (_) {} continue; }
        codes.push(f.replace(/\.json$/, ''));
      } catch (_) {}
    }
    return codes;
  }
  async saveProfile(code, data, ttlSec) {
    if (!code) return;
    try {
      fs.writeFileSync(this._profilePath(code), JSON.stringify({
        data: data || {},
        exp: Date.now() + (ttlSec || PROFILE_TTL) * 1000
      }));
    } catch (_) {}
  }
  async loadProfile(code) {
    if (!code) return null;
    try {
      const e = JSON.parse(fs.readFileSync(this._profilePath(code), 'utf8'));
      if (e.exp && Date.now() > e.exp) {
        try { fs.unlinkSync(this._profilePath(code)); } catch (_) {}
        return null;
      }
      return e.data;
    } catch (_) { return null; }
  }
  async deletePresence(code) {
    if (!code) return;
    try { fs.unlinkSync(this._presencePath(code)); } catch (_) {}
  }
  async deleteProfile(code) {
    if (!code) return;
    try { fs.unlinkSync(this._profilePath(code)); } catch (_) {}
  }
  /**
   * Remove expired / stale guest cosmetics profiles (no registered account for code).
   * @param {number} [maxAgeMs] optional max age by data.updatedAt
   */
  async purgeGuestProfiles(maxAgeMs) {
    let files = [];
    try { files = fs.readdirSync(this.profilesDir); } catch (_) { return 0; }
    const now = Date.now();
    let n = 0;
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const code = f.replace(/\.json$/, '');
      try {
        const e = JSON.parse(fs.readFileSync(path.join(this.profilesDir, f), 'utf8'));
        const expired = e.exp && now > e.exp;
        const old = maxAgeMs && e.data && e.data.updatedAt && (now - e.data.updatedAt > maxAgeMs);
        let isRegistered = false;
        try {
          const acc = await this.loadAccountByCode(code);
          if (acc) isRegistered = true;
        } catch (_) {}
        if (!isRegistered && (expired || old)) {
          try { fs.unlinkSync(path.join(this.profilesDir, f)); } catch (_) {}
          n++;
        }
      } catch (_) {
        // corrupt file — drop it
        try { fs.unlinkSync(path.join(this.profilesDir, f)); n++; } catch (_) {}
      }
    }
    return n;
  }
  
  _accountPath(id) {
    return path.join(this.accountsDir, String(id).replace(/[^a-zA-Z0-9_-]/g, '') + '.json');
  }
  _flushSessions() {
    try { fs.writeFileSync(this.sessionsPath, JSON.stringify(this._sessions)); } catch (_) {}
  }
  async saveAccount(acc) {
    if (!acc || !acc.id) return;
    const payload = Object.assign({}, acc, { _login: String(acc.login || '').toLowerCase(), _code: String(acc.friendCode || '').toUpperCase() });
    fs.writeFileSync(this._accountPath(acc.id), JSON.stringify(payload));
  }
  async loadAccountById(id) {
    if (!id) return null;
    try {
      const acc = JSON.parse(fs.readFileSync(this._accountPath(id), 'utf8'));
      return acc;
    } catch (_) { return null; }
  }
  async loadAccountByLogin(login) {
    const q = String(login || '').toLowerCase();
    if (!q) return null;
    let files = [];
    try { files = fs.readdirSync(this.accountsDir); } catch (_) { return null; }
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      try {
        const acc = JSON.parse(fs.readFileSync(path.join(this.accountsDir, f), 'utf8'));
        if (acc && String(acc.login || '').toLowerCase() === q) return acc;
      } catch (_) {}
    }
    return null;
  }
  async loadAccountByCode(code) {
    const q = String(code || '').toUpperCase();
    if (!q) return null;
    let files = [];
    try { files = fs.readdirSync(this.accountsDir); } catch (_) { return null; }
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      try {
        const acc = JSON.parse(fs.readFileSync(path.join(this.accountsDir, f), 'utf8'));
        if (acc && String(acc.friendCode || '').toUpperCase() === q) return acc;
      } catch (_) {}
    }
    return null;
  }
  /**
   * Partial search by login / nick / friendCode (for offline player find).
   * Scans accountsDir (file store).
   * @param {string} q
   * @param {number} [limit=20]
   * @returns {Promise<object[]>}
   */
  async searchAccounts(q, limit) {
    limit = Math.min(50, Math.max(1, limit | 0) || 20);
    if (!q) return [];
    const qL = String(q).toLowerCase().trim();
    const qCode = String(q).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (qL.length < 1 && qCode.length < 1) return [];
    let files = [];
    try { files = fs.readdirSync(this.accountsDir); } catch (_) { return []; }
    const out = [];
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      try {
        const acc = JSON.parse(fs.readFileSync(path.join(this.accountsDir, f), 'utf8'));
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
      } catch (_) {}
    }
    return out;
  }
  async saveSession(token, accountId, ttlSec) {
    if (!token || !accountId) return;
    this._sessions[token] = {
      accountId,
      exp: Date.now() + (ttlSec || SESSION_TTL_DEFAULT) * 1000
    };
    this._flushSessions();
  }
  async loadSession(token) {
    if (!token) return null;
    const e = this._sessions[token];
    if (!e) return null;
    if (e.exp && Date.now() > e.exp) {
      delete this._sessions[token];
      this._flushSessions();
      return null;
    }
    return e.accountId;
  }
  async deleteSession(token) {
    if (!token) return;
    delete this._sessions[token];
    this._flushSessions();
  }
  async deleteAccount(acc) {
    if (!acc || !acc.id) return false;
    try {
      const p = this._accountPath(acc.id);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch (_) {}
    // Purge sessions for this account
    let changed = false;
    for (const tok of Object.keys(this._sessions || {})) {
      const e = this._sessions[tok];
      if (e && e.accountId === acc.id) {
        delete this._sessions[tok];
        changed = true;
      }
    }
    if (changed) this._flushSessions();
    // Drop cosmetics profile + presence for this friend code
    try {
      if (acc.friendCode) {
        await this.deleteProfile(acc.friendCode);
        await this.deletePresence(acc.friendCode);
      }
    } catch (_) {}
    return true;
  }
  async close() {}
}

class RedisStore {
  constructor(opts) {
    this.kind = 'redis';
    this.client = new MiniRedis(opts);
  }
  async init() { await this.client.connect(); return this; }
  async saveRoom(id, data, ttlSec) {
    await this.client.set(roomKey(id), JSON.stringify(data), ttlSec || ROOM_TTL_LIVE);
  }
  async loadRoom(id) {
    const raw = await this.client.get(roomKey(id));
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (_) { return null; }
  }
  async deleteRoom(id) { await this.client.del(roomKey(id)); }
  async listRoomIds() {
    const keys = await this.client.keys(PREFIX + 'room:*');
    if (!Array.isArray(keys)) return [];
    return keys.map((k) => String(k).replace(PREFIX + 'room:', ''));
  }
  async bindToken(token, matchId, ttlSec) {
    await this.client.set(tokenKey(token), matchId, ttlSec || TOKEN_TTL);
  }
  async unbindToken(token) { await this.client.del(tokenKey(token)); }
  async tokenMatch(token) { return this.client.get(tokenKey(token)); }
  async getSocial(code) {
    const raw = await this.client.get(socialKey(code));
    if (!raw) return [];
    try { return JSON.parse(raw); } catch (_) { return []; }
  }
  async setSocial(code, arr) {
    if (!arr || !arr.length) { await this.client.del(socialKey(code)); return; }
    await this.client.set(socialKey(code), JSON.stringify(arr.slice(-50)), SOCIAL_TTL);
  }
  async saveQueue(entries, ttlSec) {
    await this.client.set(queueStoreKey(), JSON.stringify(Array.isArray(entries) ? entries : []), ttlSec || QUEUE_TTL);
  }
  async loadQueue() {
    const raw = await this.client.get(queueStoreKey());
    if (!raw) return [];
    try { const d = JSON.parse(raw); return Array.isArray(d) ? d : []; } catch (_) { return []; }
  }
  async savePresence(code, data, ttlSec) {
    if (!code) return;
    await this.client.set(presenceKey(code), JSON.stringify(data || {}), ttlSec || PRESENCE_TTL);
    let idx = [];
    try {
      const raw = await this.client.get(presenceIndexKey());
      if (raw) idx = JSON.parse(raw) || [];
    } catch (_) { idx = []; }
    if (!Array.isArray(idx)) idx = [];
    if (idx.indexOf(code) < 0) {
      idx.push(code);
      if (idx.length > 5000) idx = idx.slice(-5000);
      await this.client.set(presenceIndexKey(), JSON.stringify(idx), PRESENCE_TTL);
    }
  }
  async loadPresence(code) {
    const raw = await this.client.get(presenceKey(code));
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (_) { return null; }
  }
  async listPresenceCodes() {
    try {
      const raw = await this.client.get(presenceIndexKey());
      if (!raw) return [];
      const idx = JSON.parse(raw);
      return Array.isArray(idx) ? idx : [];
    } catch (_) { return []; }
  }
  async saveProfile(code, data, ttlSec) {
    if (!code) return;
    await this.client.set(profileKey(String(code).toUpperCase()), JSON.stringify(data || {}), ttlSec || PROFILE_TTL);
  }
  async loadProfile(code) {
    if (!code) return null;
    const raw = await this.client.get(profileKey(String(code).toUpperCase()));
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (_) { return null; }
  }
  async deletePresence(code) {
    if (!code) return;
    try { await this.client.del(presenceKey(code)); } catch (_) {}
  }
  async deleteProfile(code) {
    if (!code) return;
    try { await this.client.del(profileKey(String(code).toUpperCase())); } catch (_) {}
  }
  async purgeGuestProfiles() {
    // Redis keys expire via TTL; optional sweep not required
    return 0;
  }

  async saveAccount(acc) {
    if (!acc || !acc.id) return;
    const raw = JSON.stringify(acc);
    await this.client.set(accountIdKey(acc.id), raw, ACCOUNT_TTL);
    if (acc.login) await this.client.set(accountLoginKey(acc.login), acc.id, ACCOUNT_TTL);
    if (acc.friendCode) await this.client.set(accountCodeKey(acc.friendCode), acc.id, ACCOUNT_TTL);
  }
  async loadAccountById(id) {
    if (!id) return null;
    const raw = await this.client.get(accountIdKey(id));
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (_) { return null; }
  }
  async loadAccountByLogin(login) {
    if (!login) return null;
    const id = await this.client.get(accountLoginKey(login));
    return id ? this.loadAccountById(id) : null;
  }
  async loadAccountByCode(code) {
    if (!code) return null;
    const id = await this.client.get(accountCodeKey(code));
    return id ? this.loadAccountById(id) : null;
  }
  /**
   * Partial search is limited on Redis (no secondary index). Tries exact login/code first.
   * @param {string} q
   * @param {number} [limit=20]
   * @returns {Promise<object[]>}
   */
  async searchAccounts(q, limit) {
    limit = Math.min(50, Math.max(1, limit | 0) || 20);
    if (!q) return [];
    const out = [];
    const qL = String(q).toLowerCase().trim();
    const qCode = String(q).toUpperCase().replace(/[^A-Z0-9]/g, '');
    // Exact login
    if (qL.length >= 2) {
      try {
        const acc = await this.loadAccountByLogin(qL);
        if (acc) out.push(acc);
      } catch (_) {}
    }
    // Exact / prefix code
    if (qCode.length >= 2 && out.length < limit) {
      try {
        const acc = await this.loadAccountByCode(qCode);
        if (acc && !out.some((a) => a && a.id === acc.id)) out.push(acc);
      } catch (_) {}
    }
    return out.slice(0, limit);
  }
  async saveSession(token, accountId, ttlSec) {
    if (!token || !accountId) return;
    await this.client.set(sessionKey(token), String(accountId), ttlSec || SESSION_TTL_DEFAULT);
  }
  async loadSession(token) {
    if (!token) return null;
    return await this.client.get(sessionKey(token));
  }
  async deleteSession(token) {
    if (!token) return;
    try { await this.client.del(sessionKey(token)); } catch (_) {}
  }
  async deleteAccount(acc) {
    if (!acc || !acc.id) return false;
    try { await this.client.del(accountIdKey(acc.id)); } catch (_) {}
    try {
      if (acc.login) await this.client.del(accountLoginKey(acc.login));
    } catch (_) {}
    try {
      if (acc.friendCode) await this.client.del(accountCodeKey(acc.friendCode));
    } catch (_) {}
    try {
      if (acc.friendCode) {
        await this.deleteProfile(acc.friendCode);
        await this.deletePresence(acc.friendCode);
      }
    } catch (_) {}
    return true;
  }
  async close() { this.client.close(); }
}

async function createStore() {
  const mode = String(process.env.BP_STORE || process.env.STORE || '').toLowerCase();
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_URI || '';

  if (mode === 'redis' || (!mode && redisUrl)) {
    const opts = redisUrl
      ? parseRedisUrl(redisUrl)
      : {
          host: process.env.REDIS_HOST || '127.0.0.1',
          port: Number(process.env.REDIS_PORT) || 6379,
          password: process.env.REDIS_PASSWORD || null,
          db: Number(process.env.REDIS_DB) || 0
        };
    try {
      const s = new RedisStore(opts);
      await s.init();
      console.log('[store] redis', opts.host + ':' + opts.port);
      return s;
    } catch (e) {
      console.warn('[store] redis unavailable, falling back to file:', e.message);
      const fsStore = new FileStore(process.env.BP_DATA_DIR || path.join(process.cwd(), 'data'));
      await fsStore.init();
      console.log('[store] file', fsStore.dir);
      return fsStore;
    }
  }

  if (mode === 'memory') {
    const s = new MemoryStore();
    await s.init();
    console.log('[store] memory (explicit BP_STORE=memory)');
    return s;
  }

  // Default: file (persistent, zero deps). Override with BP_STORE=memory|redis.
  if (mode === 'file' || !mode) {
    const s = new FileStore(process.env.BP_DATA_DIR || path.join(process.cwd(), 'data'));
    await s.init();
    console.log('[store] file', s.dir, mode ? '' : '(default)');
    return s;
  }

  // Unknown mode → file
  console.warn('[store] unknown BP_STORE=' + mode + ', using file');
  const s = new FileStore(process.env.BP_DATA_DIR || path.join(process.cwd(), 'data'));
  await s.init();
  console.log('[store] file', s.dir);
  return s;
}

module.exports = {
  createStore,
  MemoryStore,
  FileStore,
  RedisStore,
  ROOM_TTL_LIVE,
  ROOM_TTL_ENDED,
  TOKEN_TTL,
  SOCIAL_TTL,
  QUEUE_TTL,
  PRESENCE_TTL
};
