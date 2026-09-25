/**
 * HTTP request handler: CORS, /api/*, /health, static files.
 * Extracted from server.js.
 *
 * @param {object} env
 * @returns {(req: import('http').IncomingMessage, res: import('http').ServerResponse) => void}
 */
'use strict';

const path = require('path');
const fs = require('fs');

function readJsonBody(req, limit) {
  limit = limit || 65536;
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('body_too_large'));
        try { req.destroy(); } catch (_) {}
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (!raw) return resolve({});
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function bearerToken(req) {
  const h = String((req.headers && (req.headers.authorization || req.headers.Authorization)) || '');
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (m) return m[1].trim();
  const cookie = String((req.headers && req.headers.cookie) || '');
  const cm = /(?:^|;\s*)bp_token=([^;]+)/.exec(cookie);
  return cm ? decodeURIComponent(cm[1]) : null;
}

/**
 * @param {object} env
 * @param {function} env.applySecurityHeaders
 * @param {function} env.sendFile
 * @param {string} env.PUBLIC
 * @param {function} env.log
 * @param {object|null} env.getAccountsApi
 * @param {function} env.getStore
 * @param {function} env.getWss
 * @param {Map} env.rooms
 * @param {Map} env.privateLobbies
 * @param {Map} env.presence
 * @param {function} env.totalQueued
 * @param {string} env.PKG_VERSION
 */
module.exports = function createHttpHandler(env) {
  const {
    applySecurityHeaders,
    sendFile,
    PUBLIC,
    log,
    rooms,
    privateLobbies,
    presence,
    totalQueued,
    PKG_VERSION
  } = env;

  return function onHttpRequest(req, res) {
    try {
      applySecurityHeaders(res);
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }
      const url = (req.url || '/').split('?')[0];

      if (url.startsWith('/api/')) {
        const accountsApi = typeof env.getAccountsApi === 'function' ? env.getAccountsApi() : env.accountsApi;
        if (!accountsApi) {
          sendJson(res, 503, { ok: false, error: 'accounts_unavailable', message: 'Сервис аккаунтов недоступен' });
          return;
        }
        (async () => {
          try {
            if (url === '/api/auth/register' && req.method === 'POST') {
              const body = await readJsonBody(req, 16384);
              const result = await accountsApi.register({
                login: body.login,
                password: body.password,
                nick: body.nick
              });
              if (!result.ok) return sendJson(res, 400, result);
              return sendJson(res, 201, result);
            }
            if (url === '/api/auth/login' && req.method === 'POST') {
              const body = await readJsonBody(req, 16384);
              const result = await accountsApi.login({
                login: body.login,
                password: body.password
              });
              if (!result.ok) return sendJson(res, 401, result);
              return sendJson(res, 200, result);
            }
            if (url === '/api/auth/logout' && req.method === 'POST') {
              const token = bearerToken(req);
              await accountsApi.logout(token);
              return sendJson(res, 200, { ok: true });
            }
            if (url === '/api/auth/delete' && req.method === 'POST') {
              const token = bearerToken(req);
              const body = await readJsonBody(req, 4096);
              const result = await accountsApi.deleteAccount(token, {
                password: body && body.password
              });
              if (!result.ok) {
                const code = result.error === 'unauthorized' ? 401
                  : result.error === 'bad_password' ? 403 : 400;
                return sendJson(res, code, result);
              }
              return sendJson(res, 200, result);
            }
            if (url === '/api/me' && req.method === 'GET') {
              const token = bearerToken(req);
              const acc = await accountsApi.resolveSession(token);
              if (!acc) return sendJson(res, 401, { ok: false, error: 'unauthorized', message: 'Требуется вход' });
              return sendJson(res, 200, { ok: true, account: accountsApi.publicAccount(acc) });
            }
            if (url === '/api/me' && (req.method === 'PATCH' || req.method === 'POST')) {
              const token = bearerToken(req);
              const acc = await accountsApi.resolveSession(token);
              if (!acc) return sendJson(res, 401, { ok: false, error: 'unauthorized', message: 'Требуется вход' });
              const body = await readJsonBody(req, 512 * 1024);
              const updated = await accountsApi.updateAccount(acc, body || {});
              return sendJson(res, 200, { ok: true, account: updated });
            }
            sendJson(res, 404, { ok: false, error: 'not_found', message: 'Не найдено' });
          } catch (e) {
            try { log('error', 'api', { message: e && e.message }); } catch (_) {}
            sendJson(res, 500, { ok: false, error: 'server_error', message: 'Ошибка сервера' });
          }
        })();
        return;
      }

      if (url === '/health') {
        let wsClients = 0;
        try {
          const wss = typeof env.getWss === 'function' ? env.getWss() : env.wss;
          if (wss && wss.clients) wsClients = wss.clients.size;
        } catch (_) {}
        let liveRooms = 0;
        let endedRooms = 0;
        for (const r of rooms.values()) {
          if (r && r.status === 'ended') endedRooms += 1;
          else liveRooms += 1;
        }
        const store = typeof env.getStore === 'function' ? env.getStore() : env.store;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          service: 'block-puzzle',
          version: PKG_VERSION,
          crossplay: true,
          protocolVersion: 1,
          rooms: rooms.size,
          roomsLive: liveRooms,
          roomsEnded: endedRooms,
          queue: totalQueued(),
          privateLobbies: privateLobbies.size,
          presence: presence.size,
          wsClients,
          store: store ? store.kind : 'none',
          uptime: Math.floor(process.uptime()),
          node: process.version,
          pid: process.pid,
          memoryRss: process.memoryUsage().rss
        }));
        return;
      }


      if (url === '/metrics') {
        let wsClients = 0;
        try {
          const wss = typeof env.getWss === 'function' ? env.getWss() : env.wss;
          if (wss && wss.clients) wsClients = wss.clients.size;
        } catch (_) {}
        let liveRooms = 0;
        let endedRooms = 0;
        for (const r of rooms.values()) {
          if (r && r.status === 'ended') endedRooms += 1;
          else liveRooms += 1;
        }
        const store = typeof env.getStore === 'function' ? env.getStore() : env.store;
        const lines = [
          '# HELP bp_rooms_total Active match rooms',
          '# TYPE bp_rooms_total gauge',
          'bp_rooms_total ' + rooms.size,
          '# HELP bp_rooms_live Live match rooms',
          '# TYPE bp_rooms_live gauge',
          'bp_rooms_live ' + liveRooms,
          '# HELP bp_rooms_ended Ended match rooms still in memory',
          '# TYPE bp_rooms_ended gauge',
          'bp_rooms_ended ' + endedRooms,
          '# HELP bp_queue_depth Players waiting in ranked queues',
          '# TYPE bp_queue_depth gauge',
          'bp_queue_depth ' + totalQueued(),
          '# HELP bp_private_lobbies Open private lobbies',
          '# TYPE bp_private_lobbies gauge',
          'bp_private_lobbies ' + privateLobbies.size,
          '# HELP bp_presence_entries Presence map size',
          '# TYPE bp_presence_entries gauge',
          'bp_presence_entries ' + presence.size,
          '# HELP bp_ws_clients Connected WebSocket clients',
          '# TYPE bp_ws_clients gauge',
          'bp_ws_clients ' + wsClients,
          '# HELP bp_uptime_seconds Process uptime',
          '# TYPE bp_uptime_seconds gauge',
          'bp_uptime_seconds ' + Math.floor(process.uptime()),
          '# HELP bp_memory_rss_bytes Resident set size',
          '# TYPE bp_memory_rss_bytes gauge',
          'bp_memory_rss_bytes ' + process.memoryUsage().rss,
          ''
        ];
        const body = lines.join('\n');
        res.writeHead(200, {
          'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
          'Cache-Control': 'no-store'
        });
        res.end(body);
        return;
      }

      let filePath = path.join(PUBLIC, url === '/' ? 'index.html' : url);
      if (!filePath.startsWith(PUBLIC)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      fs.stat(filePath, (err, st) => {
        if (!err && st.isFile()) {
          sendFile(req, res, filePath);
          return;
        }
        sendFile(req, res, path.join(PUBLIC, 'index.html'));
      });
    } catch (e) {
      try { applySecurityHeaders(res); } catch (_) {}
      res.writeHead(500);
      res.end('Server error');
    }
  };
};

module.exports.readJsonBody = readJsonBody;
module.exports.sendJson = sendJson;
module.exports.bearerToken = bearerToken;
