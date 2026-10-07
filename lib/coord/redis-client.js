/**
 * Minimal Redis RESP client (no external dependency).
 * Production-oriented subset for multi-instance coordination:
 *   - connect timeout, command timeout
 *   - AUTH/SELECT without re-entering connect() (no deadlock)
 *   - basic reconnect with exponential backoff
 *   - rediss:// (TLS) support via tls module
 *   - bounded parser buffer
 *
 * Not a full redis driver — only what Block Puzzle coordination needs.
 */
'use strict';

const net = require('net');
const tls = require('tls');
const { EventEmitter } = require('events');

const DEFAULT_CONNECT_TIMEOUT_MS = 5000;
const DEFAULT_COMMAND_TIMEOUT_MS = 5000;
const MAX_BUF = 8 * 1024 * 1024; // 8 MiB hard cap on inbound buffer

function encode(args) {
  let out = '*' + args.length + '\r\n';
  for (const a of args) {
    const s = a == null ? '' : String(a);
    const buf = Buffer.from(s, 'utf8');
    out += '$' + buf.length + '\r\n' + s + '\r\n';
  }
  return out;
}

function parseUrl(url) {
  // redis://[:password@]host:port[/db]
  // rediss://… for TLS
  const u = new URL(url);
  const tlsOn = u.protocol === 'rediss:';
  return {
    host: u.hostname || '127.0.0.1',
    port: Number(u.port) || (tlsOn ? 6380 : 6379),
    password: u.password
      ? decodeURIComponent(u.password)
      : (u.username && u.username !== 'default' ? decodeURIComponent(u.username) : null),
    db: u.pathname && u.pathname.length > 1 ? Number(u.pathname.slice(1)) || 0 : 0,
    tls: tlsOn,
    connectTimeoutMs: DEFAULT_CONNECT_TIMEOUT_MS,
    commandTimeoutMs: DEFAULT_COMMAND_TIMEOUT_MS
  };
}

class RedisConn extends EventEmitter {
  constructor(opts) {
    super();
    this.opts = Object.assign({
      connectTimeoutMs: DEFAULT_CONNECT_TIMEOUT_MS,
      commandTimeoutMs: DEFAULT_COMMAND_TIMEOUT_MS
    }, opts || {});
    this.sock = null;
    this.buf = Buffer.alloc(0);
    this.queue = []; // {resolve,reject,timer}
    this.subMode = false;
    this._connecting = null;
    this._closed = false;
    this._reconnectAttempt = 0;
    this._reconnectTimer = null;
    this._wantReconnect = !!(opts && opts.reconnect !== false);
  }

  /**
   * Low-level write that does NOT call connect() — used during handshake
   * (AUTH/SELECT) to avoid deadlock on the in-flight _connecting promise.
   */
  _rawCommand(args) {
    return new Promise((resolve, reject) => {
      if (!this.sock || this.sock.destroyed) {
        return reject(new Error('redis not connected'));
      }
      const timer = setTimeout(() => {
        // Remove this waiter if still first in queue
        const idx = this.queue.findIndex((q) => q.resolve === resolve);
        if (idx >= 0) this.queue.splice(idx, 1);
        reject(new Error('redis command timeout'));
      }, this.opts.commandTimeoutMs || DEFAULT_COMMAND_TIMEOUT_MS);
      if (timer.unref) timer.unref();
      this.queue.push({
        resolve: (v) => { clearTimeout(timer); resolve(v); },
        reject: (e) => { clearTimeout(timer); reject(e); }
      });
      try {
        this.sock.write(encode(args));
      } catch (e) {
        clearTimeout(timer);
        this.queue.pop();
        reject(e);
      }
    });
  }

  connect() {
    if (this._closed) return Promise.reject(new Error('redis client closed'));
    if (this.sock && !this.sock.destroyed) return Promise.resolve();
    if (this._connecting) return this._connecting;

    this._connecting = new Promise((resolve, reject) => {
      let settled = false;
      const fail = (e) => {
        if (settled) return;
        settled = true;
        cleanup();
        this._connecting = null;
        try { if (sock) sock.destroy(); } catch (_) {}
        this.sock = null;
        reject(e);
      };
      const ok = () => {
        if (settled) return;
        settled = true;
        cleanup();
        this._connecting = null;
        this._reconnectAttempt = 0;
        resolve();
      };

      const connectTimeout = setTimeout(() => {
        fail(new Error('redis connect timeout'));
      }, this.opts.connectTimeoutMs || DEFAULT_CONNECT_TIMEOUT_MS);
      if (connectTimeout.unref) connectTimeout.unref();

      const sockOpts = { host: this.opts.host, port: this.opts.port };
      const sock = this.opts.tls
        ? tls.connect(Object.assign({ servername: this.opts.host, rejectUnauthorized: this.opts.tlsRejectUnauthorized !== false }, sockOpts))
        : net.createConnection(sockOpts);

      const cleanup = () => {
        clearTimeout(connectTimeout);
        sock.removeListener('error', onErr);
        sock.removeListener('connect', onConnect);
        sock.removeListener('secureConnect', onConnect);
      };
      const onErr = (e) => fail(e);

      const onConnect = async () => {
        // TCP (or TLS) is up — install data handlers, then AUTH/SELECT via _rawCommand
        // (must NOT call connect() again).
        this.sock = sock;
        sock.on('data', (chunk) => this._onData(chunk));
        sock.on('error', (e) => this.emit('error', e));
        sock.on('close', () => this._onClose());
        try {
          if (this.opts.password) await this._rawCommand(['AUTH', this.opts.password]);
          if (this.opts.db) await this._rawCommand(['SELECT', String(this.opts.db)]);
          ok();
        } catch (e) {
          fail(e);
        }
      };

      sock.once('error', onErr);
      if (this.opts.tls) sock.once('secureConnect', onConnect);
      else sock.once('connect', onConnect);
    });
    return this._connecting;
  }

  _onClose() {
    this.sock = null;
    this._failAll(new Error('redis connection closed'));
    this.emit('close');
    if (this._wantReconnect && !this._closed && !this.subMode) {
      this._scheduleReconnect();
    }
  }

  _scheduleReconnect() {
    if (this._reconnectTimer || this._closed) return;
    const attempt = ++this._reconnectAttempt;
    const delay = Math.min(30000, 200 * Math.pow(2, Math.min(attempt, 8)));
    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      this.connect().catch((e) => {
        this.emit('error', e);
        this._scheduleReconnect();
      });
    }, delay);
    if (this._reconnectTimer.unref) this._reconnectTimer.unref();
  }

  _failAll(err) {
    const q = this.queue.splice(0);
    for (const item of q) {
      try { item.reject(err); } catch (_) {}
    }
  }

  _onData(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    if (this.buf.length > MAX_BUF) {
      this._failAll(new Error('redis response buffer overflow'));
      try { this.sock.destroy(); } catch (_) {}
      this.buf = Buffer.alloc(0);
      return;
    }
    while (true) {
      const parsed = this._tryParse(this.buf);
      if (!parsed) break;
      this.buf = this.buf.slice(parsed.bytes);
      if (this.subMode) {
        if (Array.isArray(parsed.value) && parsed.value[0] === 'message') {
          this.emit('message', parsed.value[1], parsed.value[2]);
        } else if (Array.isArray(parsed.value) && parsed.value[0] === 'pmessage') {
          this.emit('pmessage', parsed.value[1], parsed.value[2], parsed.value[3]);
        }
        if (this.queue.length && Array.isArray(parsed.value) &&
            (parsed.value[0] === 'subscribe' || parsed.value[0] === 'psubscribe' || parsed.value[0] === 'unsubscribe')) {
          this.queue.shift().resolve(parsed.value);
        }
      } else {
        const item = this.queue.shift();
        if (!item) continue;
        if (parsed.error) item.reject(parsed.error);
        else item.resolve(parsed.value);
      }
    }
  }

  _tryParse(buf) {
    if (buf.length < 1) return null;
    const type = String.fromCharCode(buf[0]);
    if (type === '+' || type === '-' || type === ':') {
      const end = buf.indexOf('\r\n');
      if (end < 0) return null;
      const body = buf.slice(1, end).toString('utf8');
      if (type === '+') return { bytes: end + 2, value: body };
      if (type === '-') return { bytes: end + 2, error: new Error(body) };
      return { bytes: end + 2, value: Number(body) };
    }
    if (type === '$') {
      const end = buf.indexOf('\r\n');
      if (end < 0) return null;
      const len = Number(buf.slice(1, end).toString('utf8'));
      if (len === -1) return { bytes: end + 2, value: null };
      if (!Number.isFinite(len) || len < 0 || len > MAX_BUF) {
        return { bytes: end + 2, error: new Error('invalid bulk length') };
      }
      const start = end + 2;
      const total = start + len + 2;
      if (buf.length < total) return null;
      return { bytes: total, value: buf.slice(start, start + len).toString('utf8') };
    }
    if (type === '*') {
      const end = buf.indexOf('\r\n');
      if (end < 0) return null;
      const n = Number(buf.slice(1, end).toString('utf8'));
      if (n === -1) return { bytes: end + 2, value: null };
      if (!Number.isFinite(n) || n < 0 || n > 100000) {
        return { bytes: end + 2, error: new Error('invalid array length') };
      }
      let offset = end + 2;
      const arr = [];
      for (let i = 0; i < n; i++) {
        const part = this._tryParse(buf.slice(offset));
        if (!part) return null;
        if (part.error) return { bytes: offset + part.bytes, error: part.error };
        arr.push(part.value);
        offset += part.bytes;
      }
      return { bytes: offset, value: arr };
    }
    return null;
  }

  async cmd(...args) {
    await this.connect();
    return this._rawCommand(args);
  }

  async get(key) { return this.cmd('GET', key); }
  async set(key, val, mode, ttl) {
    if (mode === 'EX' && ttl != null) return this.cmd('SET', key, val, 'EX', String(ttl));
    if (mode === 'PX' && ttl != null) return this.cmd('SET', key, val, 'PX', String(ttl));
    return this.cmd('SET', key, val);
  }
  async del(...keys) { return this.cmd('DEL', ...keys); }
  async exists(key) { return this.cmd('EXISTS', key); }
  async expire(key, sec) { return this.cmd('EXPIRE', key, String(sec)); }
  async rpush(key, ...vals) { return this.cmd('RPUSH', key, ...vals); }
  async lrange(key, start, stop) { return this.cmd('LRANGE', key, String(start), String(stop)); }
  async lrem(key, count, val) { return this.cmd('LREM', key, String(count), val); }
  async llen(key) { return this.cmd('LLEN', key); }
  async sadd(key, ...members) { return this.cmd('SADD', key, ...members); }
  async smembers(key) {
    const r = await this.cmd('SMEMBERS', key);
    return Array.isArray(r) ? r : [];
  }
  async srem(key, ...members) { return this.cmd('SREM', key, ...members); }
  async hset(key, field, val) {
    if (typeof field === 'object') {
      const args = ['HSET', key];
      for (const [k, v] of Object.entries(field)) args.push(k, String(v));
      return this.cmd(...args);
    }
    return this.cmd('HSET', key, field, val);
  }
  async hget(key, field) { return this.cmd('HGET', key, field); }
  async hgetall(key) {
    const arr = await this.cmd('HGETALL', key);
    const out = {};
    if (!Array.isArray(arr)) return out;
    for (let i = 0; i < arr.length; i += 2) out[arr[i]] = arr[i + 1];
    return out;
  }
  async hdel(key, ...fields) { return this.cmd('HDEL', key, ...fields); }
  async publish(channel, message) { return this.cmd('PUBLISH', channel, message); }
  async eval(script, keys, args) {
    const ks = keys || [];
    const as = args || [];
    return this.cmd('EVAL', script, String(ks.length), ...ks, ...as);
  }
  async ping() { return this.cmd('PING'); }

  async quit() {
    this._closed = true;
    this._wantReconnect = false;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    try { await this._rawCommand(['QUIT']); } catch (_) {}
    try { if (this.sock) this.sock.destroy(); } catch (_) {}
    this.sock = null;
  }

  async subscribe(...channels) {
    await this.connect();
    this.subMode = true;
    this._wantReconnect = false; // subscriber reconnect is managed by coord layer
    return this._rawCommand(['SUBSCRIBE', ...channels]);
  }
}

function createRedis(url, extra) {
  const opts = Object.assign(parseUrl(url || process.env.REDIS_URL || 'redis://127.0.0.1:6379'), extra || {});
  return new RedisConn(opts);
}

module.exports = { createRedis, RedisConn, parseUrl, encode };
