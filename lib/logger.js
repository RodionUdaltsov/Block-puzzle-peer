'use strict';

/**
 * Structured JSON logger (one object per line).
 * Level controlled by BP_LOG=debug|info|warn|error
 */

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

let PKG_VERSION = '0.0.0';
try {
  const fs = require('fs');
  const path = require('path');
  PKG_VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version || PKG_VERSION;
} catch (_) {}

const LOG_LEVEL = LOG_LEVELS[String(process.env.BP_LOG || 'info').toLowerCase()] ?? 1;

/**
 * @param {'debug'|'info'|'warn'|'error'} level
 * @param {string} msg
 * @param {Record<string, unknown>} [extra]
 */
function log(level, msg, extra) {
  const n = LOG_LEVELS[level] ?? 1;
  if (n < LOG_LEVEL) return;
  const row = { ts: new Date().toISOString(), level, msg, v: PKG_VERSION };
  if (extra && typeof extra === 'object') {
    for (const k of Object.keys(extra)) {
      if (extra[k] !== undefined) row[k] = extra[k];
    }
  }
  const line = JSON.stringify(row);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

module.exports = { log, LOG_LEVELS, PKG_VERSION };
