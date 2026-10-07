/**
 * Block Puzzle — lib/ws/handlers/session-cosmetics.js
 * Session check and server-authoritative cosmetics (get / buy / equip).
 * Extracted from the former monolithic lib/ws-handlers.js — behaviour unchanged.
 * Contract: returns true when the message was handled (stop dispatching), false to fall through.
 */
'use strict';
const { clock } = require('../../clock');
const { withKeyLock, normKey } = require('../../keyed-lock');

const { getWsIdentity, deviceGuestCodeFor, wsSessionStillValid } = require('../identity');
const { PROFILE_TTL_SEC, GUEST_PROFILE_TTL_SEC } = require('../../economy-constants');

/** Internal marker (not reachable from JSON) for the re-dispatch after device binding. */
const DEV_BOUND = Symbol('devBound');

/** State-changing cosmetics ops re-check that a registered socket's session still exists. */
function ensureSession(ws, shared) {
  return wsSessionStillValid(ws, shared).then((ok) => {
    if (!ok) { const e = new Error('not_authenticated'); e.unauth = true; throw e; }
  });
}

const uniqStrings = (...lists) => Array.from(new Set([].concat(...lists.map((l) => (Array.isArray(l) ? l : [])))
  .filter(Boolean).map(String)));

/**
 * The profile a buy/equip decision is made on, built from the rows the store has LOCKED.
 * `hint` is the (async-merged) profile read before the lock: it contributes guest_progress /
 * migrated-account information, but it can be stale, so it only ever lowers a guest balance
 * (min) and adds ownership (union) — it can never raise a balance above what is locked.
 * Registered account: its balance is the exact source of truth (same rule as before).
 */
function effectiveProfile(Cosmetics, locked, hint) {
  const acc = locked.account;
  const prof = locked.profile;
  const p = Cosmetics.normalizeProfile(prof ? Object.assign({}, prof) : Object.assign({}, hint));
  p.ownedSkins = uniqStrings(p.ownedSkins, hint && hint.ownedSkins, acc && acc.ownedSkins);
  p.ownedBoards = uniqStrings(p.ownedBoards, hint && hint.ownedBoards, acc && acc.ownedBoards);
  if (acc && typeof acc.diamonds === 'number') p.diamonds = Math.max(0, acc.diamonds | 0);
  else if (prof) p.diamonds = Math.max(0, Math.min(prof.diamonds | 0, (hint && hint.diamonds) | 0));
  return Cosmetics.normalizeProfile(p);
}

/** Commit payload: durable profile (+ mirrored account fields) written in the same transaction. */
function commitPayload(Cosmetics, locked, result, extra) {
  const r = result.profile;
  r.migrated = true;
  if (!r.updatedAt) r.updatedAt = clock.now();
  const hasPaid = (r.ownedSkins && r.ownedSkins.length > 1) || (r.ownedBoards && r.ownedBoards.length > 1);
  const out = {
    commit: true,
    result,
    profile: r,
    // never expire profiles that hold purchases; registered always long-lived
    profileTtlSec: locked.account ? PROFILE_TTL_SEC : (hasPaid ? null : GUEST_PROFILE_TTL_SEC)
  };
  if (locked.account) {
    const acc = locked.account;
    if (extra && extra.spend) {
      acc.diamonds = r.diamonds | 0;
      if (Array.isArray(r.ownedSkins)) acc.ownedSkins = r.ownedSkins.slice(0, 64);
      if (Array.isArray(r.ownedBoards)) acc.ownedBoards = r.ownedBoards.slice(0, 64);
    }
    if (r.equippedSkin) acc.skinId = String(r.equippedSkin).slice(0, 32);
    if (r.equippedBoard) acc.boardId = String(r.equippedBoard).slice(0, 32);
    acc.updatedAt = clock.now();
    out.account = acc;
  }
  return out;
}

function deadError() { const e = new Error('account_deleted'); e.dead = true; return e; }

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
      // Identity is the socket's verified identity — a friendCode in the message is ignored.
      const code = getWsIdentity(ws);
      if (!code) {
        if (data && data.friendCode) {
          // The client believes it has an identity but this socket has none (e.g. presence was
          // refused). Say so without telling it to wipe local guest data.
          send(ws, { type: 'session_check_result', ok: false, reason: 'not_authenticated', ts: clock.now() });
        } else {
          send(ws, { type: 'auth_revoked', reason: 'no_session', ts: clock.now() });
        }
        return;
      }
      if (ws._accountBound && !(await wsSessionStillValid(ws, shared))) {
        send(ws, { type: 'session_check_result', ok: false, reason: 'session_expired', friendCode: code, ts: clock.now() });
        return;
      }
      // Registered sessions require account row; guests are alive if any durable artifact exists
      const probe = await probeFriendCodeAlive(code, { requireAccount: !!ws._accountBound });
      if (!probe.alive) {
        try { send(ws, { type: 'auth_revoked', reason: 'account_deleted', friendCode: code, ts: clock.now() }); } catch (_) {}
        try { ws._friendCode = null; ws._accountBound = false; } catch (_) {}
        try { kickFriendCodeSessions(code, 'account_deleted'); } catch (_) {}
      } else {
        send(ws, { type: 'session_ok', friendCode: code, ts: clock.now() });
      }
    })().catch(() => {});
    return true;
  }

  // —— Server-authoritative cosmetics ——
  // Cosmetics always act on ws._friendCode — the identity the SERVER established (session token
  // for accounts, device cookie for guests). A friendCode inside the message is never used.
  // A socket that has not registered presence yet is bound to the guest its DEVICE owns, then
  // the message is re-dispatched; with no such guest the request is refused.
  if ((type === 'cosmetics_get' || type === 'cosmetics_buy' || type === 'cosmetics_equip')
      && !ws._friendCode && !data[DEV_BOUND]) {
    (async () => {
      try {
        const gc = await deviceGuestCodeFor(ws, shared);
        if (gc && !ws._friendCode) ws._friendCode = gc;
      } catch (_) {}
      try {
        const redo = Object.assign({}, data);
        redo[DEV_BOUND] = true;
        handleSessionCosmetics(type, ws, redo, shared);
      } catch (_) {}
    })().catch(() => {});
    return true;
  }
  if (type === 'cosmetics_get') {
    const code = getWsIdentity(ws);
    if (!code) {
      // Do not push defaultProfile — client would treat it as authoritative wipe
      send(ws, { type: 'cosmetics_state', ok: false, error: 'no_profile' });
      return true;
    }
    // Throw-away (non-durable) identities are shown defaults but never get a profile row written
    loadLiveCosmeticsProfile(code, { skipPersist: ws._durableIdentity === false }).then((profile) => {
      send(ws, cosmeticsStatePayload(profile));
    }).catch((err) => {
      send(ws, { type: 'cosmetics_state', ok: false, error: (err && err.dead) ? 'account_deleted' : 'load_failed' });
    });
    return true;
  }
  if (type === 'cosmetics_buy') {
    const code = getWsIdentity(ws);
    if (!code) {
      send(ws, { type: 'cosmetics_buy_result', ok: false, error: 'no_profile' });
      return true;
    }
    const kind = data.kind === 'board' ? 'board' : 'skin';
    const id = String(data.id || '').slice(0, 32);
    // skipPersist: avoid double-write; saveCosmeticsProfile runs after tryBuy
    ensureSession(ws, shared).then(() => withKeyLock(normKey(code), async () => {
      // Pre-lock read: guest_progress / migration merge (can be stale; only used as a lower bound)
      const hint = await loadLiveCosmeticsProfile(code, { skipPersist: true });
      // Decision + write happen inside ONE store transaction on locked rows (SELECT ... FOR UPDATE in
      // Postgres): a concurrent buy on another request or server instance waits and then sees the new balance.
      const result = await store.atomicEconomyUpdate(code, (locked) => {
        if (locked.deleted) return { commit: false, result: null };
        const base = effectiveProfile(Cosmetics, locked, hint);
        const res = Cosmetics.tryBuy(base, kind, id);
        if (!res.ok) return { commit: false, result: res };
        return commitPayload(Cosmetics, locked, res, { spend: true });
      });
      if (!result) throw deadError();
      if (result.ok) {
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
    })).catch((err) => {
      send(ws, { type: 'cosmetics_buy_result', ok: false, error: (err && err.unauth) ? 'not_authenticated' : (err && err.dead) ? 'account_deleted' : 'server' });
    });
    return true;
  }
  if (type === 'cosmetics_equip') {
    const code = getWsIdentity(ws);
    if (!code) {
      send(ws, { type: 'cosmetics_equip_result', ok: false, error: 'no_profile' });
      return true;
    }
    const kind = data.kind === 'board' ? 'board' : 'skin';
    const id = String(data.id || '').slice(0, 32);
    ensureSession(ws, shared).then(() => withKeyLock(normKey(code), async () => {
      const hint = await loadLiveCosmeticsProfile(code, { skipPersist: true });
      const result = await store.atomicEconomyUpdate(code, (locked) => {
        if (locked.deleted) return { commit: false, result: null };
        const base = effectiveProfile(Cosmetics, locked, hint);
        const res = Cosmetics.tryEquip(base, kind, id);
        if (!res.ok) return { commit: false, result: res };
        return commitPayload(Cosmetics, locked, res, { spend: false });
      });
      if (!result) throw deadError();
      if (result.ok) {
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
    })).catch((err) => {
      send(ws, { type: 'cosmetics_equip_result', ok: false, error: (err && err.unauth) ? 'not_authenticated' : (err && err.dead) ? 'account_deleted' : 'server' });
    });
    return true;
  }

  return false;
}

module.exports = { handleSessionCosmetics };
