/**
 * HTTP request listener (static files + /api/*).
 *
 * Layout (was a single 1200-line closure):
 *   lib/http/context.js          shared deps, auth limiters, late-bound hook aliases
 *   lib/http/routes/*.js         one module per API area (admin, guest auth, account auth, /api/me)
 *   lib/http-api.js              (this file) per-request setup, /api dispatch, /health, static files
 *
 * Each route module exports `async (req, res, ctx) => boolean`; the first one that resolves true
 * consumes the request, otherwise the final 404 below is sent (same order as the old if-chain).
 */
'use strict';

const path = require('path');
const fs = require('fs');
const { getClientIp, applyCors } = require('./security');

const { createHttpContext } = require('./http/context');
const { handleAdminRoutes } = require('./http/routes/admin');
const { handleGuestAuthRoutes } = require('./http/routes/auth-guest');
const { handleAccountAuthRoutes } = require('./http/routes/auth-account');
const { handleMeRoutes } = require('./http/routes/me');

const ROUTES = [handleAdminRoutes, handleGuestAuthRoutes, handleAccountAuthRoutes, handleMeRoutes];

function createHttpRequestListener(deps) {
  const shared = createHttpContext(deps);
  const {
    PKG_VERSION,
    PUBLIC,
    applySecurityHeaders,
    hooks,
    log,
    sendFile
  } = shared;

  return function httpRequestListener(req, res) {
    // Live state snapshots for this request
    const store = hooks.store;
    const accountsApi = hooks.accountsApi;
    const presence = hooks.presence;
    const pendingSocial = hooks.pendingSocial;
    const wss = hooks.wss;
    const rooms = hooks.rooms;
    const privateLobbies = hooks.privateLobbies;
    const totalQueued = hooks.totalQueued || (() => 0);


  try {
    applySecurityHeaders(res);
    applyCors(req, res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    const url = (req.url || '/').split('?')[0];

    // —— JSON body helper ——
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
    function sendTooMany(res, retryAfter) {
      const sec = Math.max(1, retryAfter | 0);
      res.writeHead(429, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Retry-After': String(sec)
      });
      res.end(JSON.stringify({
        ok: false,
        error: 'too_many_attempts',
        retryAfter: sec,
        message: 'Слишком много попыток. Повторите через ' + sec + ' сек.'
      }));
    }
    const clientIp = getClientIp(req);
    function bearerToken(req) {
      const h = String((req.headers && (req.headers.authorization || req.headers.Authorization)) || '');
      const m = /^Bearer\s+(.+)$/i.exec(h);
      if (m) return m[1].trim();
      // optional cookie
      const cookie = String((req.headers && req.headers.cookie) || '');
      const cm = /(?:^|;\s*)bp_token=([^;]+)/.exec(cookie);
      return cm ? decodeURIComponent(cm[1]) : null;
    }

    // —— Accounts API ——
    if (url.startsWith('/api/')) {
      // Guest IP bind endpoints work without full accounts service
      const isGuestIpApi = (
        (url === '/api/auth/guest-allowed' && req.method === 'GET') ||
        (url === '/api/auth/guest-bind' && req.method === 'POST') ||
        (url === '/api/auth/guest-sync' && req.method === 'POST')
      );
      const isAdminApi = url.startsWith('/api/admin/');
      if (!accountsApi && !isGuestIpApi && !isAdminApi) {
        sendJson(res, 503, { ok: false, error: 'accounts_unavailable', message: 'Сервис аккаунтов недоступен' });
        return;
      }
      (async () => {
        try {


          // —— Local admin (view / wipe accounts) ——
          const rctx = Object.assign({}, shared, {
            store, accountsApi, presence, pendingSocial, wss, rooms, privateLobbies, totalQueued,
            url, clientIp, readJsonBody, sendJson, sendTooMany, bearerToken, isGuestIpApi, isAdminApi
          });
          for (let i = 0; i < ROUTES.length; i++) {
            if (await ROUTES[i](req, res, rctx)) return;
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
      try { wsClients = wss.clients.size; } catch (_) {}
      let liveRooms = 0;
      let endedRooms = 0;
      for (const r of rooms.values()) {
        if (r && r.status === 'ended') endedRooms += 1;
        else liveRooms += 1;
      }
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
    let filePath = path.join(PUBLIC, url === '/' ? 'index.html' : url);
    // prevent path escape
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
      // SPA fallback
      sendFile(req, res, path.join(PUBLIC, 'index.html'));
    });
  } catch (e) {
    try { applySecurityHeaders(res); } catch (_) {}
    res.writeHead(500);
    res.end('Server error');
  }

  };
}

module.exports = { createHttpRequestListener };
