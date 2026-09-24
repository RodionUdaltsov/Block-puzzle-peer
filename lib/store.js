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

function roomKey(id) { return PREFIX + 'room:' + id; }
function tokenKey(tok) { return PREFIX + 'tok:' + tok; }
function socialKey(code) { return PREFIX + 'soc:' + code; }
function queueStoreKey() { return PREFIX + 'queue'; }
function presenceKey(code) { return PREFIX + 'pres:' + code; }
function presenceIndexKey() { return PREFIX + 'pres:index'; }

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
    this._tokens = {};
    this._social = {};
  }
  async init() {
    fs.mkdirSync(this.roomsDir, { recursive: true });
    fs.mkdirSync(this.presenceDir, { recursive: true });
    try { this._tokens = JSON.parse(fs.readFileSync(this.tokensPath, 'utf8')); } catch (_) { this._tokens = {}; }
    try { this._social = JSON.parse(fs.readFileSync(this.socialPath, 'utf8')); } catch (_) { this._social = {}; }
    return this;
  }
  _roomPath(id) {
    return path.join(this.roomsDir, String(id).replace(/[^a-zA-Z0-9_-]/g, '_') + '.json');
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
