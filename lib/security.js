'use strict';

/**
 * HTTP security headers + Origin allowlist helpers.
 */

/** Optional Origin allowlist (comma-separated). Empty = allow all. */
const WS_ORIGINS = String(process.env.BP_WS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

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
 * @param {string} origin
 * @returns {boolean}
 */
function isOriginAllowed(origin) {
  if (!WS_ORIGINS.length) return true;
  if (!origin) return false;
  return WS_ORIGINS.includes(origin);
}

module.exports = {
  WS_ORIGINS,
  applySecurityHeaders,
  isOriginAllowed
};
