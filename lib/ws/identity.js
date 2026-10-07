/**
 * Block Puzzle — lib/ws/identity.js
 * Single place that decides WHO a WebSocket is.
 *
 * Rule: a friend code is a public identifier, never a credential. `ws._friendCode` may only be
 * set by the server after one of these proofs:
 *   - registered account : a valid session token (resolveSession) -> account.friendCode
 *   - guest              : the device cookie bound to that guest (device_binds), or a brand-new
 *                          code that no durable identity owns yet (throw-away, memory only)
 * Client-supplied `friendCode` / `from` fields are only ever "who I want to look at", never
 * "who I am".
 */
'use strict';

const norm = (c) => String(c == null ? '' : c).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);

/** Message types whose behaviour depends on ws._friendCode: they wait for a pending presence_register. */
const IDENTITY_DEPENDENT = new Set([
  'join_queue', 'expand_queue',
  'create_private', 'join_private',
  'social_send',
  'friend_code_check', 'presence_search', 'presence_activity',
  'session_check',
  'rejoin',
  'cosmetics_get', 'cosmetics_buy', 'cosmetics_equip'
]);

/** The verified identity of this socket (or null). Never reads client message fields. */
function getWsIdentity(ws) {
  return (ws && ws._friendCode) ? String(ws._friendCode) : null;
}

/** Guest code this socket's DEVICE is bound to (device cookie = guest credential), else ''. */
async function deviceGuestCodeFor(ws, shared) {
  const { normalizeDeviceId, loadDeviceBindRecord, isFriendCodeDeletedAsync, store } = shared;
  try {
    const did = normalizeDeviceId(ws && ws._deviceId);
    if (!did) return '';
    const rec = await loadDeviceBindRecord(did);
    const gc = rec && rec.guestProgress && rec.guestProgress.friendCode ? norm(rec.guestProgress.friendCode) : '';
    if (gc.length < 4) return '';
    if (await isFriendCodeDeletedAsync(gc)) return '';
    if (store && typeof store.loadAccountByCode === 'function' && await store.loadAccountByCode(gc)) return '';
    return gc;
  } catch (_) {
    return '';
  }
}

/**
 * Does the socket's registered-account session still exist?
 * Guests (no account binding) are always "still authenticated" — their proof is the device cookie.
 * Used before state-changing messages so a logged-out / deleted session cannot keep acting.
 */
async function wsSessionStillValid(ws, shared) {
  if (!ws || !ws._accountBound) return true;
  const { accountsApi } = shared;
  if (!ws._authToken || !accountsApi || typeof accountsApi.resolveSession !== 'function') return false;
  try {
    const acc = await accountsApi.resolveSession(ws._authToken);
    return !!(acc && acc.friendCode && norm(acc.friendCode) === norm(ws._friendCode));
  } catch (_) {
    return false;
  }
}

/**
 * Seat ownership for a match player = match token (possession) AND the verified identity the
 * match was created for. A player without a friend code is an anonymous throw-away (nothing to bind).
 *
 * Sync variant: only trusts what the server already established on the socket (ws._friendCode).
 * Used where an async proof is not possible (stray in-match messages carrying a foreign token).
 */
function wsMatchesPlayerSync(ws, player) {
  const pc = norm(player && player.friendCode);
  if (!pc) return true;
  return !!ws && norm(ws._friendCode) === pc;
}

/**
 * Async variant for rejoin: socket identity first (registered session is re-validated), else the
 * guest bound to this socket's device cookie. Anything else -> false (caller must NOT attach).
 */
async function verifyWsOwnsPlayer(ws, player, shared) {
  const pc = norm(player && player.friendCode);
  if (!pc) return true;
  try {
    if (ws && ws._friendCode) {
      if (norm(ws._friendCode) !== pc) return false;
      if (ws._accountBound) return await wsSessionStillValid(ws, shared);
      return true;
    }
    const gc = await deviceGuestCodeFor(ws, shared);
    return !!gc && gc === pc;
  } catch (_) {
    return false;
  }
}

/** Drop everything a socket proved about itself (logout / switch / revoke). */
function clearWsIdentity(ws) {
  try {
    ws._friendCode = null;
    ws._accountBound = false;
    ws._authToken = null;
    ws._cookieToken = '';
    ws._accountId = null;
    ws._durableIdentity = false;
  } catch (_) {}
}

/**
 * A reconnecting HOST gets its private lobby back — but only because the socket now holds a
 * verified identity equal to the lobby host's friend code (never because a message claimed it).
 */
function reattachPrivateLobby(ws, shared) {
  try {
    const { privateLobbies, lobbySnapshot, send } = shared;
    const fc = getWsIdentity(ws);
    if (!fc || !privateLobbies) return false;
    for (const [code, lobby] of privateLobbies) {
      const host = lobby && lobby.host;
      if (!host || !host.friendCode || norm(host.friendCode) !== norm(fc)) continue;
      if (host.ws && host.ws.readyState === 1 && host.ws !== ws) continue; // still connected elsewhere
      host.token = ws._token;
      host.ws = ws;
      ws._privateCode = code;
      send(ws, lobbySnapshot(lobby, 'host'));
      if (lobby.guest && lobby.guest.ws && !lobby.guest.pending) send(lobby.guest.ws, lobbySnapshot(lobby, 'guest'));
      return true;
    }
  } catch (_) {}
  return false;
}

module.exports = {
  norm,
  IDENTITY_DEPENDENT,
  getWsIdentity,
  deviceGuestCodeFor,
  wsSessionStillValid,
  clearWsIdentity,
  wsMatchesPlayerSync,
  verifyWsOwnsPlayer,
  reattachPrivateLobby
};
