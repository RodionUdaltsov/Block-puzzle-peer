/**
 * Block Puzzle — lib/http/routes/auth-guest.js
 * Guest/device endpoints: guest-allowed, guest-bind, guest-sync.
 * Extracted from the former monolithic lib/http-api.js — behaviour unchanged.
 * Contract: resolves true when the request was handled, false to fall through to the next route module.
 */
'use strict';

const { clock } = require('../../clock');
async function handleGuestAuthRoutes(req, res, ctx) {
  const {
    DEVICE_GUEST_MARK,
    DEVICE_HAD_MARK,
    bindDeviceGuest,
    bindDeviceToAccount,
    deviceCanResumeGuest,
    deviceForbidsNewGuest,
    deviceHasBoundAccount,
    deviceHasRealAccount,
    deviceIdSetCookieHeader,
    extractDeviceId,
    getDeviceGuestProgress,
    isFriendCodeDeletedAsync,
    loadCosmeticsProfile,
    loadDeviceBindRecord,
    mergeGuestProgressLayers,
    persistDeviceBind,
    readJsonBody,
    sendJson,
    setDeviceGuestProgress,
    store,
    stripDeletedFriendCodeFromProgress,
    url
  } = ctx;

  if (url === '/api/auth/guest-allowed' && req.method === 'GET') {
    const deviceId = extractDeviceId(req, null);
    if (!deviceId) {
      return (sendJson(res, 400, {
        ok: false,
        error: 'device_id_required',
        message: 'Нужен идентификатор устройства (X-Device-Id)'
      }), true);
    }
    // Auto-heal: leftover __had_account__ with no live account → free device
    try {
      const e0 = await loadDeviceBindRecord(deviceId);
      if (e0 && Array.isArray(e0.accountIds)) {
        const live = e0.accountIds.some(
          (id) => id && id !== DEVICE_GUEST_MARK && id !== DEVICE_HAD_MARK && id !== '__had_account__'
        );
        const onlyHad = !live && e0.accountIds.every(
          (id) => !id || id === DEVICE_HAD_MARK || id === '__had_account__'
        );
        if (onlyHad) {
          if (store && typeof store.deleteDeviceBind === 'function') {
            await store.deleteDeviceBind(deviceId);
          } else if (store && store.pool) {
            await store.pool.query('DELETE FROM device_binds WHERE device_id = $1', [deviceId]);
          }
        }
      }
    } catch (_) {}
    const real = await deviceHasRealAccount(deviceId);
    const forbidsGuest = await deviceForbidsNewGuest(deviceId);
    let canResume = await deviceCanResumeGuest(deviceId);
    let guestProgress = canResume ? await getDeviceGuestProgress(deviceId) : null;
    // Tombstoned / purged friend code → destroy residual device guest snapshot
    try {
      const gpCode = guestProgress && guestProgress.friendCode
        ? String(guestProgress.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
        : '';
      if (gpCode && await isFriendCodeDeletedAsync(gpCode)) {
        canResume = false;
        guestProgress = null;
        try {
          const e = await loadDeviceBindRecord(deviceId);
          if (e) {
            e.guestProgress = null;
            e.accountIds = (e.accountIds || []).filter(
              (x) => x !== DEVICE_GUEST_MARK && x !== '__guest__'
            );
            if (!e.accountIds.length) {
              try { await store.deleteDeviceBind(deviceId); } catch (_) {}
            } else {
              await persistDeviceBind(deviceId, e);
            }
          }
        } catch (_) {}
      }
    } catch (_) {}
    // Fold cosmetics profile (live shop balance) into resume snapshot
    try {
      if (guestProgress && !real) {
        const code = guestProgress.friendCode
          ? String(guestProgress.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '')
          : '';
        if (code) {
          let stored = null;
          try {
            if (store && typeof store.loadGuestProgress === 'function') {
              stored = await store.loadGuestProgress(code);
            }
          } catch (_) {}
          const profile = await loadCosmeticsProfile(code);
          guestProgress = mergeGuestProgressLayers(stored, guestProgress, {
            friendCode: code,
            diamonds: (profile && typeof profile.diamonds === 'number') ? profile.diamonds : undefined,
            ownedSkins: (profile && profile.ownedSkins) || undefined,
            ownedBoards: (profile && profile.ownedBoards) || undefined
          });
        }
      }
    } catch (_) {}
    // New guest only if this device never used
    const allowed = !(await deviceHasBoundAccount(deviceId));
    {
      const payload = {
        ok: true,
        guestAllowed: !forbidsGuest && allowed && !canResume,
        canResumeGuest: !forbidsGuest && !!canResume,
        guestProgress: (!forbidsGuest && canResume) ? guestProgress : null,
        bound: !!forbidsGuest || !!real,
        hasAccount: !!real,
        hadAccount: !!forbidsGuest && !real,
        deviceId: deviceId
      };
      const cookie = deviceIdSetCookieHeader(deviceId);
      const body = JSON.stringify(payload);
      const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      };
      if (cookie) headers['Set-Cookie'] = cookie;
      res.writeHead(200, headers);
      res.end(body);
      return true;
    }
  }
  // Claim guest slot for this IP — blocks another NEW guest after browser data wipe
  if (url === '/api/auth/guest-bind' && req.method === 'POST') {
    const body = await readJsonBody(req, 256 * 1024).catch(() => ({}));
    const deviceId = extractDeviceId(req, body);
    if (!deviceId) {
      return (sendJson(res, 400, {
        ok: false,
        error: 'device_id_required',
        message: 'Нужен идентификатор устройства (X-Device-Id)'
      }), true);
    }
    const sendBound = (status, payload) => {
      const cookie = deviceIdSetCookieHeader(deviceId);
      const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      };
      if (cookie) headers['Set-Cookie'] = cookie;
      res.writeHead(status, headers);
      res.end(JSON.stringify(Object.assign({ deviceId }, payload)));
    };
    if (await deviceHasRealAccount(deviceId)) {
      return (sendBound(403, {
        ok: false,
        guestAllowed: false,
        canResumeGuest: false,
        bound: true,
        hasAccount: true,
        error: 'already_bound',
        message: 'С этого устройства уже был аккаунт — войдите или зарегистрируйтесь'
      }), true);
    }
    // Already has guest — update progress, never create a second slot
    if ((await deviceCanResumeGuest(deviceId)) || (await deviceHasBoundAccount(deviceId))) {
      await bindDeviceGuest(deviceId, stripDeletedFriendCodeFromProgress(body && body.progress));
      return (sendBound(200, {
        ok: true,
        resumed: true,
        guestAllowed: false,
        canResumeGuest: true,
        guestProgress: await getDeviceGuestProgress(deviceId)
      }), true);
    }
    // First claim on this device — write device_binds row IMMEDIATELY
    const boundOk = await bindDeviceGuest(deviceId, stripDeletedFriendCodeFromProgress((body && body.progress) || { ts: clock.now() }));
    if (!boundOk) {
      return (sendBound(500, {
        ok: false,
        error: 'bind_failed',
        message: 'Не удалось привязать устройство к базе'
      }), true);
    }
    return (sendBound(200, {
      ok: true,
      guestAllowed: false,
      canResumeGuest: true,
      bound: false,
      guestProgress: await getDeviceGuestProgress(deviceId)
    }), true);
  }
  // Sync guest progress while playing (IP-bound)
  if (url === '/api/auth/guest-sync' && req.method === 'POST') {
    let body = {};
    try { body = await readJsonBody(req, 512 * 1024); } catch (_) { body = {}; }
    const deviceId = extractDeviceId(req, body);
    if (!deviceId) {
      return (sendJson(res, 400, {
        ok: false,
        error: 'device_id_required',
        message: 'Нужен идентификатор устройства (X-Device-Id)'
      }), true);
    }
    if (await deviceHasRealAccount(deviceId)) {
      return (sendJson(res, 403, { ok: false, error: 'real_account', message: 'Войдите в аккаунт' }), true);
    }
    // Always ensure guest mark exists so progress is resumable after browser wipe
    if (!(await deviceHasBoundAccount(deviceId))) {
      await bindDeviceGuest(deviceId);
    } else if (!(await deviceCanResumeGuest(deviceId))) {
      await bindDeviceToAccount(deviceId, DEVICE_GUEST_MARK);
    }
    if (body && body.progress) {
      const prog = stripDeletedFriendCodeFromProgress(body.progress);
      // If client still sends a deleted friend code — refuse to resurrect it
      try {
        const fc = body.progress.friendCode
          ? String(body.progress.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
          : '';
        if (fc && await isFriendCodeDeletedAsync(fc)) {
          return (sendJson(res, 410, {
            ok: false,
            error: 'account_deleted',
            message: 'Аккаунт удалён — начните заново',
            accountDeleted: true
          }), true);
        }
      } catch (_) {}
      await setDeviceGuestProgress(deviceId, prog);
    }
    const gp = await getDeviceGuestProgress(deviceId);
    return (sendJson(res, 200, {
      ok: true,
      canResumeGuest: true,
      guestProgress: gp
    }), true);
  }

  return false;
}

module.exports = { handleGuestAuthRoutes };
