/**
 * Block Puzzle — lib/ws/handlers/session-cosmetics.js
 * Session check and server-authoritative cosmetics (get / buy / equip).
 * Extracted from the former monolithic lib/ws-handlers.js — behaviour unchanged.
 * Contract: returns true when the message was handled (stop dispatching), false to fall through.
 */
'use strict';

function handleSessionCosmetics(type, ws, data, shared) {
  const {
    Cosmetics,
    applyServerCosmeticsToGuest,
    cosmeticsResultPayload,
    cosmeticsStatePayload,
    isFriendCodeDeletedAsync,
    kickFriendCodeSessions,
    loadDeviceBindRecord,
    loadLiveCosmeticsProfile,
    normalizeDeviceId,
    persistDeviceBind,
    probeFriendCodeAlive,
    saveCosmeticsProfile,
    send,
    store
  } = shared;

  if (type === 'session_check') {
    (async () => {
      const code = ws._friendCode || String(data.friendCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
      if (!code) {
        send(ws, { type: 'auth_revoked', reason: 'no_session', ts: Date.now() });
        return;
      }
      // Registered sessions require account row; guests are alive if any durable artifact exists
      const probe = await probeFriendCodeAlive(code, { requireAccount: !!ws._accountBound });
      if (!probe.alive) {
        try { send(ws, { type: 'auth_revoked', reason: 'account_deleted', friendCode: code, ts: Date.now() }); } catch (_) {}
        try { ws._friendCode = null; ws._accountBound = false; } catch (_) {}
        try { kickFriendCodeSessions(code, 'account_deleted'); } catch (_) {}
      } else {
        if (probe.hasAccount) ws._accountBound = true;
        send(ws, { type: 'session_ok', friendCode: code, ts: Date.now() });
      }
    })().catch(() => {});
    return true;
  }

  // —— Server-authoritative cosmetics ——
  // A socket that has not registered presence yet must NOT adopt the code the client puts in the
  // message (that minted a second guest with a fresh 9999 profile). If this device already owns
  // a guest, bind the socket to THAT code first, then re-dispatch the message.
  if ((type === 'cosmetics_get' || type === 'cosmetics_buy' || type === 'cosmetics_equip')
      && !ws._friendCode && !data.__devBound) {
    (async () => {
      try {
        const did = normalizeDeviceId(ws._deviceId);
        if (did) {
          const rec = await loadDeviceBindRecord(did);
          const gc = rec && rec.guestProgress && rec.guestProgress.friendCode
            ? String(rec.guestProgress.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
            : '';
          if (gc.length >= 4 && !(await isFriendCodeDeletedAsync(gc))) ws._friendCode = gc;
        }
      } catch (_) {}
      try { ws.emit('message', JSON.stringify(Object.assign({}, data, { __devBound: true }))); } catch (_) {}
    })().catch(() => {});
    return true;
  }
  if (type === 'cosmetics_get') {
    const code = ws._friendCode || String(data.friendCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
    if (code && !ws._friendCode) ws._friendCode = code;
    if (!code) {
      // Do not push defaultProfile — client would treat it as authoritative wipe
      send(ws, { type: 'cosmetics_state', ok: false, error: 'no_profile' });
      return true;
    }
    loadLiveCosmeticsProfile(code).then((profile) => {
      send(ws, cosmeticsStatePayload(profile));
    }).catch((err) => {
      send(ws, { type: 'cosmetics_state', ok: false, error: (err && err.dead) ? 'account_deleted' : 'load_failed' });
    });
    return true;
  }
  if (type === 'cosmetics_buy') {
    const code = ws._friendCode || String(data.friendCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
    if (code && !ws._friendCode) ws._friendCode = code;
    if (!code) {
      send(ws, { type: 'cosmetics_buy_result', ok: false, error: 'no_profile' });
      return true;
    }
    const kind = data.kind === 'board' ? 'board' : 'skin';
    const id = String(data.id || '').slice(0, 32);
    // skipPersist: avoid double-write; saveCosmeticsProfile runs after tryBuy
    loadLiveCosmeticsProfile(code, { skipPersist: true }).then(async (profile) => {
      // Keep cosmetics balance in sync with registered account when present
      try {
        if (store && typeof store.loadAccountByCode === 'function') {
          const acc = await store.loadAccountByCode(code);
          if (acc && typeof acc.diamonds === 'number') {
            // Registered account balance is exact source of truth
            profile.diamonds = Math.max(0, acc.diamonds | 0);
            if (Array.isArray(acc.ownedSkins) && acc.ownedSkins.length) {
              const set = new Set((profile.ownedSkins || []).map(String));
              acc.ownedSkins.forEach((x) => { if (x) set.add(String(x)); });
              profile.ownedSkins = Array.from(set);
            }
            if (Array.isArray(acc.ownedBoards) && acc.ownedBoards.length) {
              const set = new Set((profile.ownedBoards || []).map(String));
              acc.ownedBoards.forEach((x) => { if (x) set.add(String(x)); });
              profile.ownedBoards = Array.from(set);
            }
          }
        }
      } catch (_) {}
      const result = Cosmetics.tryBuy(profile, kind, id);
      if (result.ok) {
        await saveCosmeticsProfile(code, result.profile);
        // Persist spend on registered account too
        try {
          if (store && typeof store.loadAccountByCode === 'function') {
            const acc = await store.loadAccountByCode(code);
            if (acc) {
              acc.diamonds = result.profile.diamonds | 0;
              if (Array.isArray(result.profile.ownedSkins)) acc.ownedSkins = result.profile.ownedSkins.slice(0, 64);
              if (Array.isArray(result.profile.ownedBoards)) acc.ownedBoards = result.profile.ownedBoards.slice(0, 64);
              if (result.profile.equippedSkin) acc.skinId = String(result.profile.equippedSkin).slice(0, 32);
              if (result.profile.equippedBoard) acc.boardId = String(result.profile.equippedBoard).slice(0, 32);
              acc.updatedAt = Date.now();
              await store.saveAccount(acc);
            }
          }
        } catch (_) {}
        // Keep guest progress (DB + device) in sync — TRUST server profile (paid skins)
        try {
          if (store && typeof store.saveGuestProgress === 'function') {
            let gp = null;
            try { gp = await store.loadGuestProgress(code); } catch (_) { gp = null; }
            gp = applyServerCosmeticsToGuest(gp || { friendCode: code }, result.profile, code);
            await store.saveGuestProgress(code, gp);
          }
          // Mirror onto device bind for this WS (if any) when it holds this guest code
          try {
            const did = normalizeDeviceId(ws._deviceId);
            if (did) {
              const e = await loadDeviceBindRecord(did);
              if (e) {
                const fc = e.guestProgress && e.guestProgress.friendCode
                  ? String(e.guestProgress.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '')
                  : '';
                if (!e.guestProgress || fc === code || !fc) {
                  e.guestProgress = applyServerCosmeticsToGuest(
                    e.guestProgress || { friendCode: code },
                    result.profile,
                    code
                  );
                  await persistDeviceBind(did, e);
                }
              }
            }
          } catch (_) {}
        } catch (_) {}
        send(ws, cosmeticsResultPayload('cosmetics_buy_result', { ok: true, kind, id }, result.profile));
      } else {
        send(ws, cosmeticsResultPayload('cosmetics_buy_result', { ok: false, error: result.error, kind, id }, result.profile));
      }
    }).catch((err) => {
      send(ws, { type: 'cosmetics_buy_result', ok: false, error: (err && err.dead) ? 'account_deleted' : 'server' });
    });
    return true;
  }
  if (type === 'cosmetics_equip') {
    const code = ws._friendCode || String(data.friendCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
    if (code && !ws._friendCode) ws._friendCode = code;
    if (!code) {
      send(ws, { type: 'cosmetics_equip_result', ok: false, error: 'no_profile' });
      return true;
    }
    const kind = data.kind === 'board' ? 'board' : 'skin';
    const id = String(data.id || '').slice(0, 32);
    loadLiveCosmeticsProfile(code, { skipPersist: true }).then(async (profile) => {
      const result = Cosmetics.tryEquip(profile, kind, id);
      if (result.ok) {
        // Profile is sole authority for both equip slots; account mirrors both
        await saveCosmeticsProfile(code, result.profile);
        try {
          if (store && typeof store.loadAccountByCode === 'function') {
            const acc = await store.loadAccountByCode(code);
            if (acc) {
              acc.skinId = String(result.profile.equippedSkin || 'default').slice(0, 32);
              acc.boardId = String(result.profile.equippedBoard || 'field_default').slice(0, 32);
              acc.updatedAt = Date.now();
              await store.saveAccount(acc);
            }
          }
        } catch (_) {}
        try {
          if (store && typeof store.saveGuestProgress === 'function') {
            let gp = null;
            try { gp = await store.loadGuestProgress(code); } catch (_) { gp = null; }
            gp = applyServerCosmeticsToGuest(gp || { friendCode: code }, result.profile, code);
            await store.saveGuestProgress(code, gp);
          }
          try {
            const did = normalizeDeviceId(ws._deviceId);
            if (did) {
              const e = await loadDeviceBindRecord(did);
              if (e) {
                const fc = e.guestProgress && e.guestProgress.friendCode
                  ? String(e.guestProgress.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '')
                  : '';
                if (!e.guestProgress || fc === code || !fc) {
                  e.guestProgress = applyServerCosmeticsToGuest(
                    e.guestProgress || { friendCode: code },
                    result.profile,
                    code
                  );
                  await persistDeviceBind(did, e);
                }
              }
            }
          } catch (_) {}
        } catch (_) {}
        send(ws, cosmeticsResultPayload('cosmetics_equip_result', { ok: true, kind, id }, result.profile));
      } else {
        send(ws, cosmeticsResultPayload('cosmetics_equip_result', { ok: false, error: result.error, kind, id }, result.profile));
      }
    }).catch((err) => {
      send(ws, { type: 'cosmetics_equip_result', ok: false, error: (err && err.dead) ? 'account_deleted' : 'server' });
    });
    return true;
  }

  return false;
}

module.exports = { handleSessionCosmetics };
