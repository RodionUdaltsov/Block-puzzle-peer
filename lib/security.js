'use strict';

/**
 * HTTP security headers, Origin allowlist, trusted-proxy client IP,
 * CORS and admin-key helpers.
 */

const crypto = require('crypto');

/** Optional Origin allowlist (comma-separated). Empty = allow all. */
const WS_ORIGINS = String(process.env.BP_WS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/**
 * Number of reverse proxies in front of the app whose X-Forwarded-For entry
 * may be trusted (BP_TRUST_PROXY=1 for a single nginx/Caddy; "true" = 1;
 * 0 / unset = trust nobody and use the socket address).
 */
function parseTrustProxy(raw) {
  const s = String(raw == null ? '' : raw).trim().toLowerCase();
  if (!s || s === '0' || s === 'false' || s === 'no') return 0;
  if (s === 'true' || s === 'yes') return 1;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 10) : 0;
}
const TRUST_PROXY = parseTrustProxy(process.env.BP_TRUST_PROXY);

const IS_PRODUCTION = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

function stripV6Prefix(ip) {
  return String(ip || '').replace(/^::ffff:/i, '');
}

/**
 * Client IP for rate limits / logs.
 * Without BP_TRUST_PROXY the forwarded headers are ignored (they are
 * trivially spoofable). With N trusted hops we take the Nth entry from the
 * RIGHT of X-Forwarded-For — the one appended by our own outermost proxy —
 * never the left-most value, which the client controls.
 * @param {import('http').IncomingMessage} req
 * @returns {string}
 */
function getClientIp(req, trustProxy) {
  const hops = trustProxy == null ? TRUST_PROXY : trustProxy;
  const remote = stripV6Prefix(
    (req && req.socket && req.socket.remoteAddress) ||
    (req && req.connection && req.connection.remoteAddress) || ''
  ) || 'unknown';
  if (!hops) return remote;
  try {
    const raw = String((req.headers && req.headers['x-forwarded-for']) || '');
    const parts = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (parts.length) {
      const idx = Math.max(0, parts.length - hops);
      const ip = stripV6Prefix(parts[idx]);
      if (ip) return ip;
    }
  } catch (_) {}
  return remote;
}

function isLoopbackIp(ip) {
  const s = stripV6Prefix(ip);
  return s === '127.0.0.1' || s === '::1' || s === 'localhost';
}

/** Constant-time string comparison (length-independent). */
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a == null ? '' : a)).digest();
  const hb = crypto.createHash('sha256').update(String(b == null ? '' : b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

const DEFAULT_ADMIN_KEY = 'localdev';

/**
 * Admin API access policy.
 *  - BP_ADMIN_KEY set (and not the dev default) → usable from anywhere with that key.
 *  - Not set / dev default:
 *      production  → admin API disabled entirely;
 *      development → allowed ONLY from loopback with the dev key.
 * @returns {{ enabled: boolean, key: string, devOnly: boolean }}
 */
function adminPolicy() {
  const envKey = String(process.env.BP_ADMIN_KEY || '');
  const custom = envKey && envKey !== DEFAULT_ADMIN_KEY;
  if (custom) return { enabled: true, key: envKey, devOnly: false };
  if (IS_PRODUCTION) return { enabled: false, key: '', devOnly: false };
  return { enabled: true, key: DEFAULT_ADMIN_KEY, devOnly: true };
}

/**
 * Admin key is accepted from the X-Admin-Key header or the JSON body —
 * never from the query string (query strings end up in proxy/access logs).
 */
function extractAdminKey(req, body) {
  const h = req && req.headers && req.headers['x-admin-key'];
  if (h) return String(h);
  if (body && body.key) return String(body.key);
  return '';
}

/**
 * Baseline security headers for every HTTP response.
 * CSP allows 'unsafe-inline' for the boot-failsafe script and existing styles.
 * @param {import('http').ServerResponse} res
 */
function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "connect-src 'self' ws: wss:",
      "font-src 'self'",
      "media-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'"
    ].join('; ')
  );
}

/**
 * CORS headers for /api. With no allowlist configured the legacy behaviour
 * (`*`) is kept — auth uses Bearer tokens, not cookies — but as soon as
 * BP_WS_ORIGINS is set the same allowlist is applied to HTTP too.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
function applyCors(req, res) {
  const origin = String((req.headers && req.headers.origin) || '');
  if (!WS_ORIGINS.length) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    res.setHeader('Vary', 'Origin');
    if (origin && WS_ORIGINS.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Id, X-Admin-Key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
}

/**
 * @param {string} origin
 * @returns {boolean}
 */
function isOriginAllowed(origin) {
  if (!WS_ORIGINS.length) return true;
  if (!origin) return false;
  return WS_ORIGINS.includes(origin);
}

/** One-time startup warnings for risky production configuration. */
function startupWarnings(log) {
  const warn = (m) => { try { (log && log.warn ? log.warn(m) : console.warn(m)); } catch (_) {} };
  if (!IS_PRODUCTION) return;
  if (!WS_ORIGINS.length) warn('[security] BP_WS_ORIGINS is empty: any website may open WebSocket connections');
  if (!TRUST_PROXY) warn('[security] BP_TRUST_PROXY=0: behind a reverse proxy every player shares the proxy IP for rate limits (set BP_TRUST_PROXY=1)');
  if (!adminPolicy().enabled) warn('[security] BP_ADMIN_KEY not set: /api/admin/* is disabled');
}

module.exports = {
  WS_ORIGINS,
  TRUST_PROXY,
  IS_PRODUCTION,
  DEFAULT_ADMIN_KEY,
  parseTrustProxy,
  getClientIp,
  isLoopbackIp,
  safeEqual,
  adminPolicy,
  extractAdminKey,
  applySecurityHeaders,
  applyCors,
  isOriginAllowed,
  startupWarnings
};
