/**
 * Minimal Redis client (RESP) over TCP — no npm deps.
 * Supports: PING, GET, SET, SETEX, DEL, KEYS, EXISTS, TTL, RPUSH, LRANGE, LTRIM, EXPIRE
 */
'use strict';
const net = require('net');

function encode(args) {
  let out = '*' + args.length + '\r\n';
  for (let i = 0; i < args.length; i++) {
    const s = String(args[i]);
    out += '$' + Buffer.byteLength(s) + '\r\n' + s + '\r\n';
  }
  return out;
}

class MiniRedis {
  constructor(opts) {
    opts = opts || {};
    this.host = opts.host || '127.0.0.1';
    this.port = opts.port || 6379;
    this.password = opts.password || null;
    this.db = opts.db | 0;
    this.url = opts.url || null;
    if (this.url) this._parseUrl(this.url);
    this.socket = null;
    this.buf = Buffer.alloc(0);
    this.queue = [];
    this.connected = false;
    this._connecting = null;
    this._closed = false;
  }

  _parseUrl(u) {
    try {
      const parsed = new URL(u);
      this.host = parsed.hostname || '127.0.0.1';
      this.port = Number(parsed.port) || 6379;
      if (parsed.password) this.password = decodeURIComponent(parsed.password);
      if (parsed.username && parsed.username !== 'default' && !this.password) {
        this.password = decodeURIComponent(parsed.username);
      }
      const pathDb = (parsed.pathname || '').replace(/^\//, '');
      if (pathDb && /^\d+$/.test(pathDb)) this.db = Number(pathDb);
    } catch (_) {}
  }

  connect() {
    if (this.connected && this.socket) return Promise.resolve(this);
    if (this._connecting) return this._connecting;
    this._closed = false;
    this._connecting = new Promise((resolve, reject) => {
      const sock = net.createConnection({ host: this.host, port: this.port });
      const fail = (err) => {
        try { sock.destroy(); } catch (_) {}
        this.socket = null;
        this.connected = false;
        this._connecting = null;
        reject(err || new Error('redis connect failed'));
      };
      const t = setTimeout(() => fail(new Error('redis connect timeout')), 5000);
      sock.setNoDelay(true);
      sock.on('error', (e) => {
        if (!this.connected) fail(e);
        else this._onClose();
      });
      sock.on('close', () => this._onClose());
      sock.on('data', (chunk) => this._onData(chunk));
      sock.on('connect', async () => {
        clearTimeout(t);
        this.socket = sock;
        this.connected = true;
        try {
          if (this.password) await this._cmd(['AUTH', this.password]);
          if (this.db) await this._cmd(['SELECT', String(this.db)]);
          await this._cmd(['PING']);
          this._connecting = null;
          resolve(this);
        } catch (e) {
          fail(e);
        }
      });
    });
    return this._connecting;
  }

  _onClose() {
    this.connected = false;
    this.socket = null;
    const q = this.queue.splice(0);
    for (const item of q) {
      try { item.reject(new Error('redis disconnected')); } catch (_) {}
    }
  }

  _onData(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    while (this.queue.length) {
      const parsed = this._tryParse();
      if (parsed === undefined) break;
      const item = this.queue.shift();
      if (parsed && parsed.err) item.reject(parsed.err);
      else item.resolve(parsed ? parsed.val : null);
    }
  }

  _tryParse() {
    if (!this.buf.length) return undefined;
    const type = String.fromCharCode(this.buf[0]);
    if (type === '+' || type === '-' || type === ':') {
      const idx = this.buf.indexOf('\r\n');
      if (idx < 0) return undefined;
      const line = this.buf.slice(1, idx).toString();
      this.buf = this.buf.slice(idx + 2);
      if (type === '-') return { err: new Error(line) };
      if (type === ':') return { val: Number(line) };
      return { val: line };
    }
    if (type === '$') {
      const idx = this.buf.indexOf('\r\n');
      if (idx < 0) return undefined;
      const len = Number(this.buf.slice(1, idx).toString());
      if (len === -1) {
        this.buf = this.buf.slice(idx + 2);
        return { val: null };
      }
      const start = idx + 2;
      const end = start + len;
      if (this.buf.length < end + 2) return undefined;
      const val = this.buf.slice(start, end).toString();
      this.buf = this.buf.slice(end + 2);
      return { val };
    }
    if (type === '*') {
      const idx = this.buf.indexOf('\r\n');
      if (idx < 0) return undefined;
      const n = Number(this.buf.slice(1, idx).toString());
      if (n === -1) {
        this.buf = this.buf.slice(idx + 2);
        return { val: null };
      }
      // Save and restore buf while parsing array elements
      const saved = this.buf;
      this.buf = this.buf.slice(idx + 2);
      const arr = [];
      for (let i = 0; i < n; i++) {
        const el = this._tryParse();
        if (el === undefined) {
          this.buf = saved;
          return undefined;
        }
        if (el.err) return el;
        arr.push(el.val);
      }
      return { val: arr };
    }
    // Unknown — skip one byte
    this.buf = this.buf.slice(1);
    return undefined;
  }

  _cmd(args) {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.socket) {
        reject(new Error('redis not connected'));
        return;
      }
      this.queue.push({ resolve, reject });
      try {
        this.socket.write(encode(args));
      } catch (e) {
        this.queue.pop();
        reject(e);
      }
    });
  }

  async get(key) {
    return this._cmd(['GET', key]);
  }
  async set(key, val, ttlSec) {
    if (ttlSec && ttlSec > 0) return this._cmd(['SETEX', key, String(Math.ceil(ttlSec)), val]);
    return this._cmd(['SET', key, val]);
  }
  async del(...keys) {
    if (!keys.length) return 0;
    return this._cmd(['DEL', ...keys]);
  }
  async keys(pattern) {
    return this._cmd(['KEYS', pattern]) || [];
  }
  async exists(key) {
    return this._cmd(['EXISTS', key]);
  }
  async expire(key, sec) {
    return this._cmd(['EXPIRE', key, String(sec)]);
  }
  async ping() {
    return this._cmd(['PING']);
  }
  close() {
    this._closed = true;
    try { if (this.socket) this.socket.end(); } catch (_) {}
    this.socket = null;
    this.connected = false;
  }
}

function parseRedisUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return {
      host: u.hostname || '127.0.0.1',
      port: Number(u.port) || 6379,
      password: u.password ? decodeURIComponent(u.password) : null,
      db: /^\d+$/.test((u.pathname || '').replace(/^\//, ''))
        ? Number(u.pathname.replace(/^\//, ''))
        : 0,
      url
    };
  } catch (_) {
    return { host: '127.0.0.1', port: 6379, url };
  }
}

module.exports = { MiniRedis, parseRedisUrl };
