/**
 * Block Puzzle — lib/http/context.js
 * Shared (per-server) context for HTTP routes: deps, auth limiters and late-bound hook aliases.
 * Extracted from the former monolithic lib/http-api.js — behaviour unchanged.
 */
'use strict';

const { createAuthLimiter } = require('../rate-limit');

function createHttpContext(deps) {
  const hooks = deps.hooks;
  // Login / registration throttling is OFF by default (testing phase).
  // Set BP_AUTH_LIMITS=1 to enable brute-force protection again.
  const AUTH_LIMITS_ON = String(process.env.BP_AUTH_LIMITS || '') === '1';
  const realAuthLimiter = deps.authLimiter || createAuthLimiter();
  const OPEN_GATE = { ok: true, retryAfter: 0 };
  const noopAuthLimiter = {
    check() { return OPEN_GATE; },
    fail() {}, success() {},
    checkRegister() { return OPEN_GATE; },
    registerHit() {},
    clear() {}
  };
  const authLimiter = AUTH_LIMITS_ON ? realAuthLimiter : noopAuthLimiter;
  // Admin key brute-force guard always stays on
  const adminLimiter = realAuthLimiter;
  const applySecurityHeaders = deps.applySecurityHeaders;
  const sendFile = deps.sendFile;
  const send = (...a) => hooks.send(...a);
  const PUBLIC = deps.PUBLIC;
  const PKG_VERSION = deps.PKG_VERSION;
  const log = deps.log;
  const Cosmetics = deps.Cosmetics;
  const DEVICE_GUEST_MARK = deps.DEVICE_GUEST_MARK;
  const DEVICE_HAD_MARK = deps.DEVICE_HAD_MARK;

  // Bound helpers from server (stable function refs, closed over live state)
  const purgeAllDataForFriendCode = (...a) => hooks.purgeAllDataForFriendCode(...a);
  const markFriendCodeDeleted = (...a) => hooks.markFriendCodeDeleted(...a);
  const isFriendCodeDeleted = (...a) => hooks.isFriendCodeDeleted(...a);
  const isFriendCodeDeletedAsync = (...a) => hooks.isFriendCodeDeletedAsync(...a);
  const probeFriendCodeAlive = (...a) => hooks.probeFriendCodeAlive(...a);
  const kickFriendCodeSessions = (...a) => hooks.kickFriendCodeSessions(...a);
  const loadCosmeticsProfile = (...a) => hooks.loadCosmeticsProfile(...a);
  const saveCosmeticsProfile = (...a) => hooks.saveCosmeticsProfile(...a);
  const bindDeviceGuest = (...a) => hooks.bindDeviceGuest(...a);
  const bindDeviceToAccount = (...a) => hooks.bindDeviceToAccount(...a);
  const getDeviceGuestProgress = (...a) => hooks.getDeviceGuestProgress(...a);
  const setDeviceGuestProgress = (...a) => hooks.setDeviceGuestProgress(...a);
  const deviceHasBoundAccount = (...a) => hooks.deviceHasBoundAccount(...a);
  const deviceHasRealAccount = (...a) => hooks.deviceHasRealAccount(...a);
  const deviceForbidsNewGuest = (...a) => hooks.deviceForbidsNewGuest(...a);
  const deviceCanResumeGuest = (...a) => hooks.deviceCanResumeGuest(...a);
  const extractDeviceId = (...a) => hooks.extractDeviceId(...a);
  const deviceIdSetCookieHeader = (...a) => hooks.deviceIdSetCookieHeader(...a);
  const stripDeletedFriendCodeFromProgress = (...a) => hooks.stripDeletedFriendCodeFromProgress(...a);
  const mergeGuestProgressLayers = (...a) => hooks.mergeGuestProgressLayers(...a);
  const unbindAccountFromAllDevices = (...a) => hooks.unbindAccountFromAllDevices(...a);
  const persistDeviceBind = (...a) => hooks.persistDeviceBind(...a);
  const loadDeviceBindRecord = (...a) => hooks.loadDeviceBindRecord(...a);
  const clearDeviceGuestMark = (...a) => hooks.clearDeviceGuestMark(...a);
  const authorizeCosmetics = (...a) => hooks.authorizeCosmetics(...a);
  const loadServerTrophies = (...a) => hooks.loadServerTrophies(...a);

  /**
   * Ownership check for "wipe guest" (login-from-guest confirmation).
   * The guest friend code arrives from the client, so it must never be trusted blindly:
   *  - 'forbidden': code belongs to a registered account, or to a guest bound to another device
   *  - 'ok':        code is the guest bound to THIS device → may be purged
   *  - 'noop':      nothing stored for the code (already wiped) → nothing to do
   */
  async function checkGuestWipeOwnership(deviceId, guestCode) {
    const code = String(guestCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
    if (!code) return 'noop';
    const st = hooks.store;
    try {
      if (st && typeof st.loadAccountByCode === 'function' && await st.loadAccountByCode(code)) return 'forbidden';
    } catch (_) { return 'forbidden'; }
    try {
      if (deviceId) {
        const rec = await loadDeviceBindRecord(deviceId);
        const gpCode = rec && rec.guestProgress && rec.guestProgress.friendCode
          ? String(rec.guestProgress.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
          : '';
        if (gpCode && gpCode === code) return 'ok';
      }
    } catch (_) {}
    try {
      if (st && typeof st.loadGuestProgress === 'function' && await st.loadGuestProgress(code)) return 'forbidden';
    } catch (_) { return 'forbidden'; }
    return 'noop';
  }

  return {
    hooks,
    AUTH_LIMITS_ON,
    realAuthLimiter,
    OPEN_GATE,
    noopAuthLimiter,
    authLimiter,
    adminLimiter,
    applySecurityHeaders,
    sendFile,
    send,
    PUBLIC,
    PKG_VERSION,
    log,
    Cosmetics,
    DEVICE_GUEST_MARK,
    DEVICE_HAD_MARK,
    purgeAllDataForFriendCode,
    markFriendCodeDeleted,
    isFriendCodeDeleted,
    isFriendCodeDeletedAsync,
    probeFriendCodeAlive,
    kickFriendCodeSessions,
    loadCosmeticsProfile,
    saveCosmeticsProfile,
    bindDeviceGuest,
    bindDeviceToAccount,
    getDeviceGuestProgress,
    setDeviceGuestProgress,
    deviceHasBoundAccount,
    deviceHasRealAccount,
    deviceForbidsNewGuest,
    deviceCanResumeGuest,
    extractDeviceId,
    deviceIdSetCookieHeader,
    stripDeletedFriendCodeFromProgress,
    mergeGuestProgressLayers,
    unbindAccountFromAllDevices,
    persistDeviceBind,
    loadDeviceBindRecord,
    clearDeviceGuestMark,
    authorizeCosmetics,
    loadServerTrophies,
    checkGuestWipeOwnership
  };
}

module.exports = { createHttpContext };
