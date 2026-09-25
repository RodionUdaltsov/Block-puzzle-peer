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
  // CSP tuned for:
  // - Safari / Android WebView / PWA
  // - Cloudflare Turnstile / Bot Management (challenges.cloudflare.com etc.)
  //   Without these domains the "Are you human?" check loops forever
  //   and the page becomes "unavailable".
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://static.cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://challenges.cloudflare.com",
      "connect-src 'self' ws: wss: blob: https://challenges.cloudflare.com https://cloudflareinsights.com",
      "font-src 'self' data:",
      "media-src 'self' blob: data:",
      "worker-src 'self' blob:",
      "child-src 'self' blob: https://challenges.cloudflare.com",
      "frame-src 'self' https://challenges.cloudflare.com",
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
