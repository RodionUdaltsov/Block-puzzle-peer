/**
 * Persistence for Block Puzzle match state.
 *
 * Modes (env BP_STORE or STORE):
 *   memory  — default, no persistence
 *   file    — JSON files in data/ (zero deps)
 *   redis   — REDIS_URL=redis://host:6379 (mini RESP client, no npm)
 *
 * Persists:
 *   - active / recently-ended match rooms (rejoin after restart)
 *   - pending social messages while offline
 *   - token → matchId index for rejoin
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { MiniRedis, parseRedisUrl } = require('./mini-redis');

const PREFIX = 'bp:';
const ROOM_TTL_LIVE = 60 * 60;      // 1h max live room
const ROOM_TTL_ENDED = 180;         // 3 min rematch window (matches server)
const SOCIAL_TTL = 7 * 24 * 3600;   // 7 days
const TOKEN_TTL = 60 * 60;

function roomKey(id) { return PREFIX + 'room:' + id; }
function tokenKey(tok) { return PREFIX + 'tok:' + tok; }
function socialKey(code) { return PREFIX + 'soc:' + code; }

// ─── Memory ───────────────────────────────────────────────────────────────────
class MemoryStore {
  constructor() {
    this.kind = 'memory';
    this.rooms = new Map();
    this.tokens = new Map();
    this.social = new Map();
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
  async deleteRoom(id) {
    this.rooms.delete(id);
  }
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
  async unbindToken(token) {
    this.tokens.delete(token);
  }
  async tokenMatch(token) {
    const e = this.tokens.get(token);
    if (!e) return null;
    if (e.exp && Date.now() > e.exp) { this.tokens.delete(token); return null; }
    return e.matchId;
  }
  async getSocial(code) {
    return this.social.get(code) || [];
  }
  async setSocial(code, arr) {
    if (!arr || !arr.length) this.social.delete(code);
    else this.social.set(code, arr.slice(-50));
  }
  async close() {}
}

// ─── File ─────────────────────────────────────────────────────────────────────
class FileStore {
  constructor(dir) {
    this.kind = 'file';
    this.dir = dir || path.join(process.cwd(), 'data');
    this.roomsDir = path.join(this.dir, 'rooms');
    this.socialPath = path.join(this.dir, 'social.json');
    this.tokensPath = path.join(this.dir, 'tokens.json');
    this._tokens = {};
    this._social = {};
  }
  async init() {
    fs.mkdirSync(this.roomsDir, { recursive: true });
    try {
      this._tokens = JSON.parse(fs.readFileSync(this.tokensPath, 'utf8'));
    } catch (_) { this._tokens = {}; }
    try {
      this._social = JSON.parse(fs.readFileSync(this.socialPath, 'utf8'));
    } catch (_) { this._social = {}; }
    return this;
  }
  _roomPath(id) {
    const safe = String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(this.roomsDir, safe + '.json');
  }
  async saveRoom(id, data, ttlSec) {
    const payload = {
      data,
      exp: Date.now() + (ttlSec || ROOM_TTL_LIVE) * 1000
    };
    fs.writeFileSync(this._roomPath(id), JSON.stringify(payload));
  }
  async loadRoom(id) {
    try {
      const raw = fs.readFileSync(this._roomPath(id), 'utf8');
      const e = JSON.parse(raw);
      if (e.exp && Date.now() > e.exp) {
        try { fs.unlinkSync(this._roomPath(id)); } catch (_) {}
        return null;
      }
      return e.data;
    } catch (_) {
      return null;
    }
  }
  async deleteRoom(id) {
    try { fs.unlinkSync(this._roomPath(id)); } catch (_) {}
  }
  async listRoomIds() {
    let files = [];
    try { files = fs.readdirSync(this.roomsDir); } catch (_) { return []; }
    const ids = [];
    const now = Date.now();
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      try {
        const e = JSON.parse(fs.readFileSync(path.join(this.roomsDir, f), 'utf8'));
        if (e.exp && now > e.exp) {
          try { fs.unlinkSync(path.join(this.roomsDir, f)); } catch (_) {}
          continue;
        }
        if (e.data && e.data.id) ids.push(e.data.id);
        else ids.push(f.replace(/\.json$/, ''));
      } catch (_) {}
    }
    return ids;
  }
  _flushTokens() {
    try { fs.writeFileSync(this.tokensPath, JSON.stringify(this._tokens)); } catch (_) {}
  }
  _flushSocial() {
    try { fs.writeFileSync(this.socialPath, JSON.stringify(this._social)); } catch (_) {}
  }
  async bindToken(token, matchId, ttlSec) {
    this._tokens[token] = { matchId, exp: Date.now() + (ttlSec || TOKEN_TTL) * 1000 };
    this._flushTokens();
  }
  async unbindToken(token) {
    delete this._tokens[token];
    this._flushTokens();
  }
  async tokenMatch(token) {
    const e = this._tokens[token];
    if (!e) return null;
    if (e.exp && Date.now() > e.exp) {
      delete this._tokens[token];
      this._flushTokens();
      return null;
    }
    return e.matchId;
  }
  async getSocial(code) {
    return this._social[code] || [];
  }
  async setSocial(code, arr) {
    if (!arr || !arr.length) delete this._social[code];
    else this._social[code] = arr.slice(-50);
    this._flushSocial();
  }
  async close() {}
}

// ─── Redis ────────────────────────────────────────────────────────────────────
class RedisStore {
  constructor(opts) {
    this.kind = 'redis';
    this.client = new MiniRedis(opts);
  }
  async init() {
    await this.client.connect();
    return this;
  }
  async saveRoom(id, data, ttlSec) {
    const ttl = ttlSec || ROOM_TTL_LIVE;
    await this.client.set(roomKey(id), JSON.stringify(data), ttl);
  }
  async loadRoom(id) {
    const raw = await this.client.get(roomKey(id));
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (_) { return null; }
  }
  async deleteRoom(id) {
    await this.client.del(roomKey(id));
  }
  async listRoomIds() {
    const keys = await this.client.keys(PREFIX + 'room:*');
    if (!Array.isArray(keys)) return [];
    return keys.map((k) => String(k).replace(PREFIX + 'room:', ''));
  }
  async bindToken(token, matchId, ttlSec) {
    await this.client.set(tokenKey(token), matchId, ttlSec || TOKEN_TTL);
  }
  async unbindToken(token) {
    await this.client.del(tokenKey(token));
  }
  async tokenMatch(token) {
    return this.client.get(tokenKey(token));
  }
  async getSocial(code) {
    const raw = await this.client.get(socialKey(code));
    if (!raw) return [];
    try { return JSON.parse(raw); } catch (_) { return []; }
  }
  async setSocial(code, arr) {
    if (!arr || !arr.length) {
      await this.client.del(socialKey(code));
      return;
    }
    await this.client.set(socialKey(code), JSON.stringify(arr.slice(-50)), SOCIAL_TTL);
  }
  async close() {
    this.client.close();
  }
}

/**
 * Create store from env:
 *   BP_STORE=memory|file|redis
 *   REDIS_URL=redis://:pass@host:6379/0
 *   BP_DATA_DIR=./data
 */
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

  if (mode === 'file') {
    const s = new FileStore(process.env.BP_DATA_DIR || path.join(process.cwd(), 'data'));
    await s.init();
    console.log('[store] file', s.dir);
    return s;
  }

  const s = new MemoryStore();
  await s.init();
  console.log('[store] memory (set BP_STORE=file|redis or REDIS_URL for persistence)');
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
  SOCIAL_TTL
};
