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
  // CSP tuned for Safari / Android WebView / PWA:
  // - connect-src includes explicit wss: and same-origin for WebSocket
  // - worker-src / child-src for any future workers or blob
  // - media-src + blob for audio / generated assets
  // - no upgrade-insecure-requests (Render already terminates TLS)
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "connect-src 'self' ws: wss: blob:",
      "font-src 'self' data:",
      "media-src 'self' blob: data:",
      "worker-src 'self' blob:",
      "child-src 'self' blob:",
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
