'use strict';

/**
 * Connection + message rate limits for WebSocket.
 *
 * Env (optional):
 *   BP_WS_CONN_LIMIT   — max new connections per IP per window (default 40)
 *   BP_WS_CONN_WINDOW  — window ms (default 10000)
 *   BP_WS_MSG_LIMIT    — max messages per socket per window (default 60)
 *   BP_WS_MSG_WINDOW   — window ms (default 1000)
 */

const CONN_LIMIT = Math.max(5, Number(process.env.BP_WS_CONN_LIMIT) || 40);
const CONN_WINDOW = Math.max(1000, Number(process.env.BP_WS_CONN_WINDOW) || 10000);
const MSG_LIMIT = Math.max(10, Number(process.env.BP_WS_MSG_LIMIT) || 60);
const MSG_WINDOW = Math.max(200, Number(process.env.BP_WS_MSG_WINDOW) || 1000);

/** @type {Map<string, { t0: number, n: number }>} */
const _connHits = new Map();

/**
 * Per-IP connection rate limit (new WS handshakes).
 * @param {string} ip
 * @returns {boolean} true if allowed
 */
function allowWsConnection(ip) {
  const key = ip || 'unknown';
  // Localhost / loopback — no connection rate limit (multi-browser testing)
  if (key === '127.0.0.1' || key === '::1' || key === '::ffff:127.0.0.1' || key === 'localhost') {
    return true;
  }
  const now = Date.now();
  let e = _connHits.get(key);
  if (!e || now - e.t0 > CONN_WINDOW) {
    e = { t0: now, n: 0 };
    _connHits.set(key, e);
  }
  e.n += 1;
  // periodic cleanup
  if (_connHits.size > 5000) {
    for (const [k, v] of _connHits) {
      if (now - v.t0 > CONN_WINDOW * 3) _connHits.delete(k);
    }
  }
  return e.n <= CONN_LIMIT;
}

/**
 * Per-socket message rate limit (all inbound messages).
 * Place moves have additional server-side limits inside MatchRoom.
 * @param {import('ws').WebSocket & { _msgWindow?: { t0: number, n: number }, _rlDrops?: number }} ws
 * @returns {boolean} true if allowed
 */
function allowWsMessage(ws) {
  const now = Date.now();
  if (!ws._msgWindow || now - ws._msgWindow.t0 > MSG_WINDOW) {
    ws._msgWindow = { t0: now, n: 0 };
  }
  ws._msgWindow.n += 1;
  if (ws._msgWindow.n > MSG_LIMIT) {
    ws._rlDrops = (ws._rlDrops | 0) + 1;
    return false;
  }
  return true;
}

module.exports = {
  allowWsConnection,
  allowWsMessage,
  CONN_LIMIT,
  CONN_WINDOW,
  MSG_LIMIT,
  MSG_WINDOW
};
