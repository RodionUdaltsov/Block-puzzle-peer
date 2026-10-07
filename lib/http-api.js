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
const { getClientIp, applyCors, isOriginAllowed } = require('./security');
const AuthCookie = require('./auth-cookie');

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
      const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      };
      // Cookie session mode (client sent X-Auth-Cookie: 1): the token travels only in an HttpOnly cookie.
      if (res._clearAuthCookie) {
        headers['Set-Cookie'] = AuthCookie.clearCookieHeader();
      } else if (res._cookieMode && obj && obj.ok && typeof obj.token === 'string' && obj.token) {
        headers['Set-Cookie'] = AuthCookie.setCookieHeader(obj.token);
        obj = Object.assign({}, obj, { sessionCookie: true, wsTicket: AuthCookie.issueTicket(obj.token) });
        delete obj.token;
      } else if (res._upgradeCookieToken) {
        headers['Set-Cookie'] = AuthCookie.setCookieHeader(res._upgradeCookieToken);
        headers['X-Session-Cookie'] = 'set';
      }
      res.writeHead(code, headers);
      res.end(JSON.stringify(obj));
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
    // Session token: `Authorization: Bearer <token>` or the HttpOnly `bp_token` cookie.
    // The bearer value "cookie" is the web client's marker meaning "use the cookie".
    // Cookie-authenticated state-changing requests must be same-origin (CSRF defence in depth on
    // top of SameSite=Lax); requests with an explicit Authorization header are not cookie-ambient.
    function bearerToken(req) {
      const h = String((req.headers && (req.headers.authorization || req.headers.Authorization)) || '');
      const m = /^Bearer\s+(.+)$/i.exec(h);
      if (m && !AuthCookie.isMarker(m[1])) return m[1].trim();
      const tok = AuthCookie.readCookieToken(req.headers && req.headers.cookie);
      if (!tok) return null;
      const method = String(req.method || 'GET').toUpperCase();
      if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        const origin = String((req.headers && req.headers.origin) || '');
        const site = String((req.headers && req.headers['sec-fetch-site']) || '');
        if (origin && !isOriginAllowed(origin, req.headers && req.headers.host)) return null;
        if (!origin && site === 'cross-site') return null;
      }
      return tok;
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
          // Cookie session mode + one-way upgrade of a legacy Bearer session to the HttpOnly cookie
          res._cookieMode = String((req.headers && req.headers['x-auth-cookie']) || '') === '1';
          if (res._cookieMode && accountsApi) {
            try {
              const ah = /^Bearer\s+(.+)$/i.exec(String((req.headers && req.headers.authorization) || ''));
              const legacy = ah && !AuthCookie.isMarker(ah[1]) ? ah[1].trim() : '';
              if (legacy && !AuthCookie.readCookieToken(req.headers.cookie) && await accountsApi.resolveSession(legacy)) {
                res._upgradeCookieToken = legacy;
              }
            } catch (_) {}
          }

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
      // Public liveness probe: no process/host internals (pid, node version, RSS, room counts).
      // Detailed stats are opt-in for trusted/private deployments: BP_HEALTH_DETAILS=1.
      const body = {
        ok: true,
        service: 'block-puzzle',
        version: PKG_VERSION,
        protocolVersion: 1,
        uptime: Math.floor(process.uptime())
      };
      if (String(process.env.BP_HEALTH_DETAILS || '') === '1') {
        let wsClients = 0;
        try { wsClients = wss.clients.size; } catch (_) {}
        let liveRooms = 0;
        let endedRooms = 0;
        for (const r of rooms.values()) {
          if (r && r.status === 'ended') endedRooms += 1;
          else liveRooms += 1;
        }
        Object.assign(body, {
          crossplay: true,
          rooms: rooms.size,
          roomsLive: liveRooms,
          roomsEnded: endedRooms,
          queue: totalQueued(),
          privateLobbies: privateLobbies.size,
          presence: presence.size,
          wsClients,
          store: store ? store.kind : 'none',
          redis: !!process.env.REDIS_URL,
          instanceId: process.env.BP_INSTANCE_ID || null,
          node: process.version,
          pid: process.pid,
          memoryRss: process.memoryUsage().rss
        });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
      return;
    }
    // Canonical boundary check: resolve first, then require root itself or root + separator
    // (a bare startsWith(PUBLIC) would also accept a sibling such as "<PUBLIC>-private/").
    const publicRoot = path.resolve(PUBLIC);
    let relUrl = url === '/' ? 'index.html' : url;
    if (relUrl.indexOf('\0') !== -1) { res.writeHead(400); res.end('Bad request'); return; }
    let filePath = path.resolve(publicRoot, '.' + (relUrl.charAt(0) === '/' ? relUrl : '/' + relUrl));
    // prevent path escape
    if (filePath !== publicRoot && !filePath.startsWith(publicRoot + path.sep)) {
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
