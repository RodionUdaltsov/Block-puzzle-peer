'use strict';

/**
 * HTTP security headers, Origin allowlist, trusted-proxy client IP,
 * CORS and admin-key helpers.
 */

const crypto = require('crypto');

/**
 * Origin allowlist (comma-separated) for WebSocket upgrades and CORS.
 *   - set                : only these origins may open a WebSocket;
 *   - empty (default)    : SAME-ORIGIN only (Origin host must equal the Host header);
 *   - "*" (explicit)     : any website may connect (opt-out, logged as a warning).
 * Requests with no Origin header (native clients, curl, tests) are not browser cross-site
 * requests and are still accepted — identity is proven separately (session token / device).
 */
const WS_ORIGINS_RAW = String(process.env.BP_WS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const WS_ORIGINS_ANY = WS_ORIGINS_RAW.includes('*');
const WS_ORIGINS = WS_ORIGINS_RAW.filter((o) => o !== '*');

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
 * CSP: scripts are nonce-based (no 'unsafe-inline'); inline style attributes still need 'unsafe-inline'.
 * @param {import('http').ServerResponse} res
 */
function applySecurityHeaders(res, opts) {
  // Scripts: nonce-only when a nonce is supplied (HTML documents); otherwise 'self' only.
  const nonce = opts && opts.nonce;
  const scriptSrc = nonce ? "script-src 'self' 'nonce-" + nonce + "'" : "script-src 'self'";
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      scriptSrc,
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
  if (!WS_ORIGINS.length || WS_ORIGINS_ANY) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    res.setHeader('Vary', 'Origin');
    if (origin && WS_ORIGINS.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Id, X-Admin-Key, X-Auth-Cookie');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
}

/**
 * @param {string} origin    value of the Origin header ('' when absent)
 * @param {string} [host]    value of the Host header (for the same-origin default)
 * @returns {boolean}
 */
function isOriginAllowed(origin, host) {
  if (WS_ORIGINS_ANY) return true;
  if (!origin) return true; // no Origin = not a browser cross-site request
  if (WS_ORIGINS.length) return WS_ORIGINS.includes(origin);
  // Default: same-origin only
  try {
    const u = new URL(origin);
    return !!host && u.host.toLowerCase() === String(host).toLowerCase();
  } catch (_) {
    return false;
  }
}

/** One-time startup warnings for risky production configuration. */
function startupWarnings(log) {
  const warn = (m) => { try { (log && log.warn ? log.warn(m) : console.warn(m)); } catch (_) {} };
  if (!IS_PRODUCTION) return;
  if (WS_ORIGINS_ANY) warn('[security] BP_WS_ORIGINS=* : any website may open WebSocket connections');
  else if (!WS_ORIGINS.length) warn('[security] BP_WS_ORIGINS is empty: only same-origin WebSocket connections are accepted (set BP_WS_ORIGINS=https://your.site if a proxy rewrites Host)');
  if (!TRUST_PROXY) warn('[security] BP_TRUST_PROXY=0: behind a reverse proxy every player shares the proxy IP for rate limits (set BP_TRUST_PROXY=1)');
  if (!adminPolicy().enabled) warn('[security] BP_ADMIN_KEY not set: /api/admin/* is disabled');
}

/**
 * Hard production config validation. Throws on fatal misconfiguration so the
 * process never accepts traffic in a half-configured state.
 *
 * Checked when NODE_ENV=production:
 *   - DATABASE_URL present (unless BP_STORE=memory, which is rejected in prod)
 *   - BP_WS_ORIGINS set (empty is allowed only with explicit BP_WS_ORIGINS_ALLOW_EMPTY=1)
 *   - DATABASE_URL does not embed well-known default passwords (bp/bp, change-me, password)
 *   - BP_ADMIN_KEY, if set, is not a short/default value
 *   - PORT is a valid number when provided
 */
function validateProductionConfig(env) {
  env = env || process.env;
  const isProd = String(env.NODE_ENV || '').toLowerCase() === 'production';
  if (!isProd) return;

  const errors = [];
  const storeMode = String(env.BP_STORE || env.STORE || '').toLowerCase();
  if (storeMode === 'memory') {
    // Tests may set BP_ALLOW_MEMORY_IN_PROD=1 to exercise production HTTP/admin behaviour
    // without a real database. Real deployments must never set this.
    if (String(env.BP_ALLOW_MEMORY_IN_PROD || '') !== '1') {
      errors.push('BP_STORE=memory is not allowed in production (player progress would be lost on restart)');
    }
  }
  const dbUrl = String(env.DATABASE_URL || '').trim();
  if (!dbUrl && storeMode !== 'memory') {
    errors.push('DATABASE_URL is required in production');
  }
  if (dbUrl) {
    const lower = dbUrl.toLowerCase();
    const badPass = [':bp@', ':change-me@', ':password@', ':secret@', ':admin@', ':123456@'];
    for (const needle of badPass) {
      if (lower.includes(needle)) {
        errors.push('DATABASE_URL embeds a default/weak password (' + needle.slice(1, -1) + ') — set a strong POSTGRES_PASSWORD');
        break;
      }
    }
  }
  const origins = String(env.BP_WS_ORIGINS || '').trim();
  const allowEmpty = String(env.BP_WS_ORIGINS_ALLOW_EMPTY || '') === '1';
  if (!origins && !allowEmpty) {
    errors.push('BP_WS_ORIGINS is required in production (comma-separated https origins), or set BP_WS_ORIGINS_ALLOW_EMPTY=1 to accept same-origin only');
  }
  const adminKey = String(env.BP_ADMIN_KEY || '').trim();
  if (adminKey) {
    if (adminKey.length < 16 || adminKey === 'localdev' || adminKey === 'change-me') {
      errors.push('BP_ADMIN_KEY is too short or is a default value (use openssl rand -hex 24)');
    }
  }
  const port = env.PORT;
  if (port != null && port !== '' && !Number.isFinite(Number(port))) {
    errors.push('PORT must be a number, got: ' + port);
  }
  if (errors.length) {
    const msg = '[boot] production config invalid:\n  - ' + errors.join('\n  - ');
    const err = new Error(msg);
    err.code = 'PRODUCTION_CONFIG';
    throw err;
  }
}

module.exports = {
  WS_ORIGINS,
  WS_ORIGINS_ANY,
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
  startupWarnings,
  validateProductionConfig
};
