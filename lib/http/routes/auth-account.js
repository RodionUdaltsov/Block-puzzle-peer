/**
 * Block Puzzle — lib/http/routes/auth-account.js
 * Account endpoints: register, check-login, login, logout, wipe-guest, delete, alive.
 * Extracted from the former monolithic lib/http-api.js — behaviour unchanged.
 * Contract: resolves true when the request was handled, false to fall through to the next route module.
 */
'use strict';

async function handleAccountAuthRoutes(req, res, ctx) {
  const {
    DEVICE_GUEST_MARK,
    DEVICE_HAD_MARK,
    accountsApi,
    authLimiter,
    bearerToken,
    bindDeviceToAccount,
    checkGuestWipeOwnership,
    clientIp,
    deviceHasRealAccount,
    extractDeviceId,
    getDeviceGuestProgress,
    kickFriendCodeSessions,
    loadCosmeticsProfile,
    loadDeviceBindRecord,
    markFriendCodeDeleted,
    mergeGuestProgressLayers,
    pendingSocial,
    persistDeviceBind,
    presence,
    probeFriendCodeAlive,
    purgeAllDataForFriendCode,
    readJsonBody,
    saveCosmeticsProfile,
    send,
    sendJson,
    sendTooMany,
    store,
    unbindAccountFromAllDevices,
    url
  } = ctx;

  if (url === '/api/auth/register' && req.method === 'POST') {
    // Larger body: may include full guestProgress for migration
    const body = await readJsonBody(req, 512 * 1024);
    const deviceId = extractDeviceId(req, body);
    const regGate = authLimiter.checkRegister(clientIp, deviceId);
    if (!regGate.ok) return (sendTooMany(res, regGate.retryAfter), true);
    authLimiter.registerHit(clientIp, deviceId);
    // Server is the authority: merge stored guest progress (friendCode) + device + client body
    let guestProgress = null;
    try {
      let bodyGp = (body && body.guestProgress && typeof body.guestProgress === 'object')
        ? body.guestProgress : null;
      const deviceGp = deviceId ? await getDeviceGuestProgress(deviceId) : null;
      // After browser wipe the client has no guest session — body is local defaults
      // (often diamonds:9999). Prefer pure server layers in that case.
      const bodyHasCode = !!(bodyGp && bodyGp.friendCode);
      const deviceHasCode = !!(deviceGp && deviceGp.friendCode);
      const bodyCode = bodyHasCode
        ? String(bodyGp.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '')
        : '';
      const deviceCode = deviceHasCode
        ? String(deviceGp.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '')
        : '';
      if (bodyGp) {
        // Economy NEVER comes from the client: strip balances/ownership from the body in
        // every case so only server layers (guest_progress / device bind / cosmetics
        // profile) can feed the migrated account.
        bodyGp = Object.assign({}, bodyGp);
        delete bodyGp.diamonds;
        delete bodyGp.trophies;
        delete bodyGp.best;
        delete bodyGp.ownedSkins;
        delete bodyGp.ownedBoards;
      }
      // Active guest registering from profile: body HAS friendCode — keep body currencies 1:1
      let storedGp = null;
      const prefCode = String(
        (body && body.preferredFriendCode) ||
        bodyCode ||
        deviceCode ||
        ''
      ).toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (prefCode && store && typeof store.loadGuestProgress === 'function') {
        try { storedGp = await store.loadGuestProgress(prefCode); } catch (_) { storedGp = null; }
      }
      // Also try IP friend code if different
      if (deviceCode && deviceCode !== prefCode && store && typeof store.loadGuestProgress === 'function') {
        try {
          const alt = await store.loadGuestProgress(deviceCode);
          storedGp = mergeGuestProgressLayers(storedGp, alt);
        } catch (_) {}
      }
      // Server layers first (store + device), client body last
      guestProgress = mergeGuestProgressLayers(storedGp, deviceGp, bodyGp);
      // Economy NEVER taken from client body — only storedGp / deviceGp / cosmetics profile.
      // Non-economy (friends, avatar, status) may come from mergeGuestProgressLayers(bodyGp)
      // after body economy fields were stripped above.
      // Ensure friendCode is set for resolveFriendCode
      if (guestProgress && !guestProgress.friendCode && prefCode) {
        guestProgress.friendCode = prefCode;
      }
      // Cosmetics profile is the live shop balance for guests — fold into migration
      try {
        const codesTry = [];
        // The device-bound guest code is the real identity; client codes may be stale.
        if (deviceCode) codesTry.push(deviceCode);
        if (prefCode) codesTry.push(prefCode);
        if (bodyCode) codesTry.push(bodyCode);
        if (guestProgress && guestProgress.friendCode) {
          codesTry.push(String(guestProgress.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, ''));
        }
        // Pick the profile that was actually USED (most owned items, then lowest balance)
        // instead of the first one found — repairs guests that were already split in two.
        const seen = new Set();
        const ranked = [];
        for (const c of codesTry) {
          if (!c || seen.has(c)) continue;
          seen.add(c);
          try {
            const pr = await loadCosmeticsProfile(c);
            if (pr && typeof pr.diamonds === 'number') {
              const owned = ((pr.ownedSkins || []).length) + ((pr.ownedBoards || []).length);
              ranked.push({ c, pr, owned, d: pr.diamonds | 0, i: ranked.length });
            }
          } catch (_) {}
        }
        ranked.sort((a, b) => (b.owned - a.owned) || (a.d - b.d) || (a.i - b.i));
        const bestRanked = ranked.length ? [ranked[0].c] : [];
        if (bestRanked.length && guestProgress && guestProgress.friendCode !== bestRanked[0]) {
          guestProgress.friendCode = bestRanked[0];
          if (body) body.preferredFriendCode = bestRanked[0];
        }
        for (const c of bestRanked) {
          if (!c) continue;
          const profile = await loadCosmeticsProfile(c);
          if (profile && typeof profile.diamonds === 'number') {
            if (!guestProgress) guestProgress = {};
            // Cosmetics profile = live guest shop balance → take it as primary, then max with any IP snapshot
            // Profile is the live shop balance (post-purchase) — it wins over any stale snapshot
            guestProgress.diamonds = Math.max(0, profile.diamonds | 0);
            if (Array.isArray(profile.ownedSkins) && profile.ownedSkins.length) {
              const set = new Set((guestProgress.ownedSkins || []).map(String));
              profile.ownedSkins.forEach((id) => { if (id) set.add(String(id)); });
              guestProgress.ownedSkins = Array.from(set);
            }
            if (Array.isArray(profile.ownedBoards) && profile.ownedBoards.length) {
              const set = new Set((guestProgress.ownedBoards || []).map(String));
              profile.ownedBoards.forEach((id) => { if (id) set.add(String(id)); });
              guestProgress.ownedBoards = Array.from(set);
            }
            break;
          }
        }
      } catch (_) {}
    } catch (_) {
      guestProgress = (body && body.guestProgress && typeof body.guestProgress === 'object')
        ? body.guestProgress : null;
    }
    // Clean slate: a device that already holds a live registered account can never have an
    // active guest (guests are forbidden there). Any guest snapshot / friend code found for it
    // is a leftover of a previous identity and must NOT be migrated into this new account.
    try {
      if (deviceId && await deviceHasRealAccount(deviceId)) {
        guestProgress = null;
        if (body) { body.preferredFriendCode = ''; body.guestProgress = null; }
      }
    } catch (_) {}
    // Client body economy ignored — guestProgress already merged from server layers only.
    const preferredFriendCode = (body && body.preferredFriendCode)
      || (guestProgress && guestProgress.friendCode)
      || '';
    const result = await accountsApi.register({
      login: body.login,
      password: body.password,
      nick: body.nick,
      guestProgress,
      preferredFriendCode
    });
    if (!result.ok) return (sendJson(res, result.error === 'busy' ? 503 : 400, result), true);
    // Account.diamonds is already authoritative after register migrate — do NOT Math.max with client 9999
    try {
      if (result.account && typeof result.account.diamonds === 'number') {
        result.account.diamonds = Math.max(0, result.account.diamonds | 0);
      }
    } catch (_) {}
    try {
      const accId = result.account && (result.account.id || result.account.login);
      // Convert device bind: drop __guest__, keep only registered account id
      if (deviceId && accId) {
        let _e = await loadDeviceBindRecord(deviceId);
        if (!_e) _e = { accountIds: [], guestProgress: null };
        _e.guestProgress = null; // guest row becomes the account — no duplicate guest data
        let ids = Array.isArray(_e.accountIds) ? _e.accountIds.map(String) : [];
        ids = ids.filter((x) => x && x !== DEVICE_GUEST_MARK);
        if (ids.indexOf(String(accId)) === -1) ids.push(String(accId));
        _e.accountIds = ids;
        await persistDeviceBind(deviceId, _e);
      }
      try {
        const delCode = (result.account && result.account.friendCode) ||
          (guestProgress && guestProgress.friendCode) ||
          (body && body.preferredFriendCode) || '';
        const c = String(delCode).toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (c && store && typeof store.deleteGuestProgress === 'function') {
          store.deleteGuestProgress(c).catch(() => {});
        }
      } catch (_) {}
      if (guestProgress) result.guestProgress = guestProgress;
    } catch (_) {}
    // Sync cosmetics profile (shop diamonds/skins) to match migrated account
    // so cosmetics_state does not overwrite guest progress with an empty profile
    try {
      const acc = result.account;
      const code = acc && acc.friendCode ? String(acc.friendCode).toUpperCase() : '';
      if (code) {
        let profile = await loadCosmeticsProfile(code);
        // 1:1 transfer: account already holds the migrated guest balance.
        // Cosmetics profile must match account exactly (not max with stale defaults).
        if (typeof acc.diamonds === 'number') {
          profile.diamonds = Math.max(0, acc.diamonds | 0);
        }
        if (guestProgress && typeof guestProgress.diamonds === 'number'
            && (typeof acc.diamonds !== 'number' || !isFinite(acc.diamonds))) {
          profile.diamonds = Math.max(0, guestProgress.diamonds | 0);
        }
        // Mirror final balance onto HTTP response account
        try {
          if (result.account) result.account.diamonds = Math.max(0, profile.diamonds | 0, result.account.diamonds | 0);
        } catch (_) {}
        if (Array.isArray(acc.ownedSkins) && acc.ownedSkins.length) {
          const set = new Set((profile.ownedSkins || []).map(String));
          acc.ownedSkins.forEach((id) => { if (id) set.add(String(id)); });
          profile.ownedSkins = Array.from(set);
        }
        if (Array.isArray(acc.ownedBoards) && acc.ownedBoards.length) {
          const set = new Set((profile.ownedBoards || []).map(String));
          acc.ownedBoards.forEach((id) => { if (id) set.add(String(id)); });
          profile.ownedBoards = Array.from(set);
        }
        if (acc.skinId) profile.equippedSkin = String(acc.skinId);
        if (acc.boardId) profile.equippedBoard = String(acc.boardId);
        profile.migrated = true;
        profile.updatedAt = Date.now();
        await saveCosmeticsProfile(code, profile);
      }
    } catch (_) {}
    return (sendJson(res, 201, result), true);
  }
  // Credential check only — no session, no device bind, no guest wipe
  if (url === '/api/auth/check-login' && req.method === 'POST') {
    const body = await readJsonBody(req, 8192);
    const clDev = extractDeviceId(req, body);
    const gate = authLimiter.check(clientIp, body && body.login, clDev);
    if (!gate.ok) return (sendTooMany(res, gate.retryAfter), true);
    const result = await accountsApi.checkCredentials({
      login: body.login,
      password: body.password
    });
    if (!result.ok) {
      if (result.error === 'busy') return (sendJson(res, 503, result), true);
      authLimiter.fail(clientIp, body && body.login, clDev);
      return (sendJson(res, 401, result), true);
    }
    authLimiter.success(clientIp, body && body.login, clDev);
    return (sendJson(res, 200, result), true);
  }
  if (url === '/api/auth/login' && req.method === 'POST') {
    const body = await readJsonBody(req, 16384);
    const loginDev = extractDeviceId(req, body);
    const gate = authLimiter.check(clientIp, body && body.login, loginDev);
    if (!gate.ok) return (sendTooMany(res, gate.retryAfter), true);
    const result = await accountsApi.login({
      login: body.login,
      password: body.password
    });
    if (!result.ok) {
      if (result.error === 'busy') return (sendJson(res, 503, result), true);
      authLimiter.fail(clientIp, body && body.login, loginDev);
      return (sendJson(res, 401, result), true);
    }
    authLimiter.success(clientIp, body && body.login, loginDev);
    // Guest wipe only when client already confirmed (wipeGuest=true).
    try {
      const accCode = result.account && result.account.friendCode
        ? String(result.account.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
        : '';
      let guestCode = '';
      if (body.wipeGuest && body.guestFriendCode) {
        guestCode = String(body.guestFriendCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
      }
      if (guestCode && guestCode !== accCode
          && (await checkGuestWipeOwnership(extractDeviceId(req, body), guestCode)) === 'ok') {
        try {
          await purgeAllDataForFriendCode(guestCode, {
            reason: 'login_wipe_guest',
            skipKick: true
          });
        } catch (_) {}
        try { markFriendCodeDeleted(guestCode); } catch (_) {}
      }
    } catch (_) {}
    try {
      const deviceId = extractDeviceId(req, body);
      const accId = result.account && (result.account.id || result.account.login);
      if (accId && deviceId) {
        await bindDeviceToAccount(deviceId, accId);
        try {
          const e = await loadDeviceBindRecord(deviceId);
          if (e && Array.isArray(e.accountIds)) {
            e.accountIds = e.accountIds.filter((x) => x !== DEVICE_HAD_MARK);
            if (body.wipeGuest) {
              e.accountIds = e.accountIds.filter((x) => x !== DEVICE_GUEST_MARK);
              e.guestProgress = null;
            }
            if (e.accountIds.indexOf(String(accId)) === -1) e.accountIds.push(String(accId));
            await persistDeviceBind(deviceId, e);
          }
        } catch (_) {}
      }
    } catch (_) {}
    return (sendJson(res, 200, result), true);
  }
  if (url === '/api/auth/logout' && req.method === 'POST') {
    const token = bearerToken(req);
    await accountsApi.logout(token);
    return (sendJson(res, 200, { ok: true }), true);
  }
  // After confirmed login-from-guest: permanently erase guest identity
  if (url === '/api/auth/wipe-guest' && req.method === 'POST') {
    const token = bearerToken(req);
    const acc = await accountsApi.resolveSession(token);
    if (!acc) return (sendJson(res, 401, { ok: false, error: 'unauthorized' }), true);
    const body = await readJsonBody(req, 4096);
    const guestCode = String(body.guestFriendCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
    const accCode = acc.friendCode
      ? String(acc.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
      : '';
    if (!guestCode) {
      return (sendJson(res, 400, { ok: false, error: 'missing_guest_code' }), true);
    }
    if (guestCode === accCode) {
      return (sendJson(res, 400, { ok: false, error: 'cannot_wipe_self' }), true);
    }
    const wipeVerdict = await checkGuestWipeOwnership(extractDeviceId(req, body), guestCode);
    if (wipeVerdict === 'forbidden') {
      return (sendJson(res, 403, { ok: false, error: 'not_your_guest' }), true);
    }
    if (wipeVerdict === 'noop') {
      return (sendJson(res, 200, { ok: true, wiped: guestCode, alreadyWiped: true }), true);
    }
    // skipKick: avoid WS 4001 storm that clients may misread as "account deleted"
    try {
      await purgeAllDataForFriendCode(guestCode, {
        reason: 'login_wipe_guest',
        skipKick: true
      });
    } catch (_) {}
    try { markFriendCodeDeleted(guestCode); } catch (_) {}
    try {
      const deviceId = extractDeviceId(req, body);
      if (deviceId) {
        const e = await loadDeviceBindRecord(deviceId);
        if (e) {
          if (Array.isArray(e.accountIds)) {
            e.accountIds = e.accountIds.filter(
              (x) => x !== DEVICE_GUEST_MARK && x !== DEVICE_HAD_MARK
            );
          }
          e.guestProgress = null;
          await persistDeviceBind(deviceId, e);
        }
      }
    } catch (_) {}
    return (sendJson(res, 200, { ok: true, wiped: guestCode }), true);
  }
  if (url === '/api/auth/delete' && req.method === 'POST') {
    const token = bearerToken(req);
    const body = await readJsonBody(req, 4096);
    const delKey = 'del:' + String(token || '').slice(0, 16);
    const delDev = extractDeviceId(req, body);
    const delGate = authLimiter.check(clientIp, delKey, delDev);
    if (!delGate.ok) return (sendTooMany(res, delGate.retryAfter), true);
    // Resolve friend code before delete so we can drop in-memory cosmetics cache
    let delCode = null;
    try {
      const acc = await accountsApi.resolveSession(token);
      if (acc && acc.friendCode) delCode = String(acc.friendCode).toUpperCase();
    } catch (_) {}
    const result = await accountsApi.deleteAccount(token, {
      password: body && body.password
    });
    if (!result.ok) {
      if (result.error === 'bad_password') authLimiter.fail(clientIp, delKey, delDev);
      const code = result.error === 'unauthorized' ? 401
        : result.error === 'bad_password' ? 403
        : result.error === 'busy' ? 503 : 400;
      return (sendJson(res, code, result), true);
    }
    try {
      if (delCode) await purgeAllDataForFriendCode(delCode, { reason: 'account_deleted' });
      else if (result.id) {
        // KNOWN PRE-EXISTING ISSUE (kept as-is, behaviour unchanged): markDevicesAfterAccountDelete is
        // only defined inside the admin routes (lib/http/routes/admin.js). Here it is not in scope, so
        // this call throws ReferenceError and is swallowed. Hoist the helper into lib/http/context.js
        // if device binds should be released on self-service account deletion.
        try { await markDevicesAfterAccountDelete(result.id, null); } catch (_) {}
      }
    } catch (_) {}
    // Notify former friends (online) so they drop this code from their local list
    try {
      const fc = delCode || result.friendCode || null;
      const targets = Array.isArray(result.hadFriends) ? result.hadFriends : [];
      if (fc) {
        // Also clear pending social for this code
        try {
          pendingSocial.delete(fc);
          if (store && typeof store.setSocial === 'function') store.setSocial(fc, []).catch(() => {});
        } catch (_) {}
        for (const to of targets) {
          const tCode = String(to || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (!tCode || tCode === fc) continue;
          const msg = {
            type: 'friend_remove',
            code: fc,
            from: fc,
            name: '',
            reason: 'account_deleted',
            ts: Date.now()
          };
          const target = presence.get(tCode);
          if (target && target.ws && target.ws.readyState === 1) {
            try { send(target.ws, { type: 'social_msg', msg }); } catch (_) {}
          } else {
            try {
              if (!pendingSocial.has(tCode)) pendingSocial.set(tCode, []);
              const box = pendingSocial.get(tCode);
              box.push(msg);
              if (box.length > 30) box.splice(0, box.length - 30);
              if (store) store.setSocial(tCode, box).catch(() => {});
            } catch (_) {}
          }
        }
      }
    } catch (_) {}
    // Remove account from device binds but leave __had_account__ so guest is forbidden
    try {
      if (result.id) await unbindAccountFromAllDevices(result.id);
      const deviceId = extractDeviceId(req, body);
      if (deviceId) {
        let _e = await loadDeviceBindRecord(deviceId);
        if (!_e) _e = { accountIds: [], guestProgress: null };
        _e.guestProgress = null;
        let ids = Array.isArray(_e.accountIds) ? _e.accountIds.map(String) : [];
        ids = ids.filter((x) => x && x !== DEVICE_GUEST_MARK);
        if (ids.indexOf('__had_account__') === -1) ids.push('__had_account__');
        _e.accountIds = ids;
        await persistDeviceBind(deviceId, _e);
      }
    } catch (_) {}
    return (sendJson(res, 200, result), true);
  }
  
  if (url === '/api/auth/alive' && req.method === 'GET') {
    // req.url still has ?query — local `url` var strips it
    let code = '';
    try {
      const full = String(req.url || '');
      const qi = full.indexOf('?');
      if (qi >= 0) {
        const params = new URLSearchParams(full.slice(qi + 1));
        code = String(params.get('code') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
      }
    } catch (_) {}
    if (!code) return (sendJson(res, 400, { ok: false, alive: false, error: 'code_required' }), true);
    const probe = await probeFriendCodeAlive(code);
    if (!probe.alive) {
      try { kickFriendCodeSessions(code, 'account_deleted'); } catch (_) {}
    }
    return (sendJson(res, 200, {
      ok: true,
      alive: !!probe.alive,
      hasAccount: !!probe.hasAccount,
      hasGuest: !!probe.hasGuest,
      hasProfile: !!probe.hasProfile,
      code
    }), true);
  }

  return false;
}

module.exports = { handleAccountAuthRoutes };
