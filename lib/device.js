/**
 * Device binding + guest progress helpers.
 * Extracted from server.js — behaviour unchanged.
 */
'use strict';

const { clock } = require('./clock');
const crypto = require('crypto');
const { withKeyLock } = require('./keyed-lock');

const DEVICE_GUEST_MARK = '__guest__';
const DEVICE_HAD_MARK = '__had_account__';

function deviceLockKey(deviceId) {
  return 'dev:' + String(deviceId || '').slice(0, 64);
}

function createDeviceApi(deps) {
  const hooks = deps.hooks;
  const Cosmetics = deps.Cosmetics;
  const getStore = () => hooks.store;
  const isFriendCodeDeleted = (...a) => hooks.isFriendCodeDeleted(...a);
  const isFriendCodeDeletedAsync = (...a) => hooks.isFriendCodeDeletedAsync(...a);

function stripDeletedFriendCodeFromProgress(progress) {
  if (!progress || typeof progress !== 'object') return progress;
  try {
    const fc = progress.friendCode
      ? String(progress.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
      : '';
    if (fc && isFriendCodeDeleted(fc)) {
      const out = Object.assign({}, progress);
      delete out.friendCode;
      return out;
    }
  } catch (_) {}
  return progress;
}


function normalizeDeviceId(raw) {
  const s = String(raw || '').trim();
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(s)) return '';
  return s;
}

/**
 * Device id authority:
 * 1) Cookie bp_device_id (server-set) — highest trust for continuity
 * 2) X-Device-Id header — must match cookie when cookie present
 * 3) body.deviceId — only if no cookie (first contact); never overrides cookie
 * Client cannot swap device id mid-session via body to hijack another bind.
 */
function extractDeviceId(req, body) {
  let cookieId = '';
  try {
    const raw = String((req && req.headers && req.headers.cookie) || '');
    const m = /(?:^|;\s*)bp_device_id=([^;]+)/.exec(raw);
    if (m) {
      let v = decodeURIComponent(m[1].trim());
      cookieId = normalizeDeviceId(v);
    }
  } catch (_) {}
  let headerId = '';
  try {
    const h = req && req.headers;
    if (h) {
      const fromHeader = h['x-device-id'] || h['X-Device-Id'];
      headerId = normalizeDeviceId(fromHeader);
    }
  } catch (_) {}
  let bodyId = '';
  try {
    if (body && body.deviceId) bodyId = normalizeDeviceId(body.deviceId);
  } catch (_) {}

  if (cookieId) {
    // Cookie is authoritative. Accept header only if it matches cookie.
    if (headerId && headerId !== cookieId) {
      // Ignore mismatched header — possible spoof attempt
      return cookieId;
    }
    return cookieId;
  }
  // No cookie yet: prefer header, then body (first-time bind)
  if (headerId) return headerId;
  if (bodyId) return bodyId;
  return '';
}

/** Server-issued device id when client has none. */
function issueDeviceId() {
  try {
    return crypto.randomBytes(24).toString('base64url').slice(0, 32);
  } catch (_) {
    return ('srv' + clock.now().toString(36) + Math.random().toString(36).slice(2, 14)).slice(0, 32);
  }
}

/** Resolve device id for HTTP: extract or issue + Set-Cookie. Returns { id, setCookie }. */
function resolveDeviceIdForRequest(req, body, res) {
  let id = extractDeviceId(req, body);
  let setCookie = null;
  if (!id) {
    id = issueDeviceId();
    setCookie = deviceIdSetCookieHeader(id);
  } else {
    // Always refresh cookie so client stays bound to server-known id
    setCookie = deviceIdSetCookieHeader(id);
  }
  return { id, setCookie };
}

/** Load trophies only from server stores (account → guest_progress). */
async function loadServerTrophies(friendCode) {
  const code = String(friendCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  if (!code || !getStore()) return 0;
  try {
    if (typeof getStore().loadAccountByCode === 'function') {
      const acc = await getStore().loadAccountByCode(code);
      if (acc && typeof acc.trophies === 'number') return Math.max(0, acc.trophies | 0);
    }
  } catch (_) {}
  try {
    if (typeof getStore().loadGuestProgress === 'function') {
      const gp = await getStore().loadGuestProgress(code);
      if (gp && typeof gp.trophies === 'number') return Math.max(0, gp.trophies | 0);
    }
  } catch (_) {}
  return 0;
}

function deviceIdSetCookieHeader(deviceId) {
  const id = normalizeDeviceId(deviceId);
  if (!id) return null;
  // 10 years
  // Secure is default in production; BP_COOKIE_SECURE=1/0 force it on/off (see auth-cookie.js).
  const secure = require('./auth-cookie').cookieSecure() ? '; Secure' : '';
  return 'bp_device_id=' + id + '; Path=/; Max-Age=315360000; SameSite=Lax' + secure;
}

// Client IP for logs / rate-limit only (not for guest binding).
// Honours X-Forwarded-For only when BP_TRUST_PROXY is configured (see security.js).
function normalizeClientIp(req) {
  return require('./security').getClientIp(req);
}

async function loadDeviceBindRecord(deviceId) {
  const id = normalizeDeviceId(deviceId);
  if (!id || !getStore() || typeof getStore().loadDeviceBind !== 'function') return null;
  try {
    return await getStore().loadDeviceBind(id);
  } catch (_) {
    return null;
  }
}

async function persistDeviceBind(deviceId, rec) {
  const id = normalizeDeviceId(deviceId);
  if (!id) return false;
  if (!getStore() || typeof getStore().saveDeviceBind !== 'function') {
    try { console.warn('[device] getStore().saveDeviceBind unavailable'); } catch (_) {}
    return false;
  }
  try {
    await getStore().saveDeviceBind(id, {
      accountIds: Array.isArray(rec.accountIds) ? rec.accountIds : [],
      guestProgress: rec.guestProgress || null,
      updatedAt: clock.now()
    });
    return true;
  } catch (e) {
    try { console.warn('[device] saveDeviceBind failed', e && e.message); } catch (_) {}
    return false;
  }
}

async function deviceHasBoundAccount(deviceId) {
  const e = await loadDeviceBindRecord(deviceId);
  if (!e || !Array.isArray(e.accountIds) || !e.accountIds.length) return false;
  // Ignore legacy HAD-only rows (device is free for a new guest)
  const meaningful = e.accountIds.some(
    (id) => id && id !== DEVICE_HAD_MARK && id !== '__had_account__'
  );
  return meaningful;
}

/** True if device is linked to at least one live registered account id (not marks). */
async function deviceHasRealAccount(deviceId) {
  const e = await loadDeviceBindRecord(deviceId);
  if (!e || !Array.isArray(e.accountIds)) return false;
  return e.accountIds.some((id) => id && id !== DEVICE_GUEST_MARK && id !== DEVICE_HAD_MARK);
}

/**
 * Forbid NEW guest only while at least one LIVE registered account is linked.
 * After all accounts on this device are deleted, guest is allowed again.
 */
async function deviceForbidsNewGuest(deviceId) {
  return deviceHasRealAccount(deviceId);
}

async function deviceCanResumeGuest(deviceId) {
  if (!deviceId) return false;
  // Live registered account on device → no guest
  if (await deviceHasRealAccount(deviceId)) return false;
  const e = await loadDeviceBindRecord(deviceId);
  if (!e) return false;
  if (Array.isArray(e.accountIds) && e.accountIds.indexOf(DEVICE_GUEST_MARK) !== -1) return true;
  if (e.guestProgress && typeof e.guestProgress === 'object') return true;
  return false;
}

async function bindDeviceToAccount(deviceId, accountId) {
  const id = normalizeDeviceId(deviceId);
  if (!id || !accountId) return;
  const aid = String(accountId);
  const store = getStore();
  if (store && typeof store.atomicDeviceBindUpdate === 'function') {
    await store.atomicDeviceBindUpdate(id, (rec) => {
      if (!Array.isArray(rec.accountIds)) rec.accountIds = [];
      if (rec.accountIds.indexOf(aid) === -1) rec.accountIds.push(aid);
      if (rec.accountIds.length > 32) rec.accountIds = rec.accountIds.slice(-32);
    });
    return;
  }
  let e = await loadDeviceBindRecord(id);
  if (!e) e = { accountIds: [], guestProgress: null };
  if (!Array.isArray(e.accountIds)) e.accountIds = [];
  if (e.accountIds.indexOf(aid) === -1) e.accountIds.push(aid);
  if (e.accountIds.length > 32) e.accountIds = e.accountIds.slice(-32);
  await persistDeviceBind(id, e);
}

async function setDeviceGuestProgress(deviceId, progress) {
  const id = normalizeDeviceId(deviceId);
  if (!id) return;
  // In-process serialisation + Postgres FOR UPDATE via atomicDeviceBindUpdate
  // closes the lost-update race on concurrent guest-sync / bind.
  return withKeyLock(deviceLockKey(id), async () => {
  progress = stripDeletedFriendCodeFromProgress(progress);
  try {
    if (progress && progress.friendCode && await isFriendCodeDeletedAsync(String(progress.friendCode))) {
      delete progress.friendCode;
    }
  } catch (_) {}
  // Pre-resolve claimability (async) before the locked RMW section.
  const cleaned = sanitizeGuestProgress(progress);
  let preOkClaim = false;
  if (cleaned && cleaned.friendCode) {
    try { preOkClaim = await friendCodeClaimableByDevice(id, cleaned.friendCode); } catch (_) { preOkClaim = false; }
  }
  // Optional profile enrichment (async) — applied after merge inside the mutator path.
  let enrichProf = null;
  let enrichCode = '';
  const store = getStore();
  // First pass: compute merged guest under row lock when available.
  const applyMerge = (e) => {
    if (!Array.isArray(e.accountIds)) e.accountIds = [];
    if (e.accountIds.indexOf(DEVICE_GUEST_MARK) === -1) e.accountIds.push(DEVICE_GUEST_MARK);
    if (!cleaned) return e;
    const prev = e.guestProgress && typeof e.guestProgress === 'object' ? e.guestProgress : null;
    const merged = Object.assign({}, prev || {});
    if (cleaned.friendCode && !(prev && prev.friendCode)) {
      if (preOkClaim) merged.friendCode = cleaned.friendCode;
    }
    if (cleaned.nick) merged.nick = cleaned.nick;
    if (cleaned.status != null) merged.status = cleaned.status;
    if (cleaned.avatarId) merged.avatarId = cleaned.avatarId;
    if (cleaned.avatarCustom != null) merged.avatarCustom = cleaned.avatarCustom;
    if (cleaned.friends) merged.friends = cleaned.friends;
    if (cleaned.history) merged.history = cleaned.history;
    if (cleaned.achievements) merged.achievements = cleaned.achievements;
    if (cleaned.botStars) merged.botStars = cleaned.botStars;
    if (typeof cleaned.best === 'number') {
      const prevB = typeof merged.best === 'number' ? merged.best : 0;
      if (cleaned.best > prevB) merged.best = cleaned.best;
    }
    const prevD = prev && typeof prev.diamonds === 'number' ? prev.diamonds : undefined;
    const nextD = resolveAuthoritativeDiamonds(prevD, cleaned.diamonds);
    if (typeof nextD === 'number') merged.diamonds = nextD;
    else if (prevD != null) merged.diamonds = prevD;
    else {
      try {
        merged.diamonds = Math.max(0, (Cosmetics.defaultProfile().diamonds | 0));
      } catch (_) {
        merged.diamonds = 0;
      }
    }
    merged.trophies = resolveAuthoritativeTrophies(
      prev && typeof prev.trophies === 'number' ? prev.trophies : 0,
      cleaned.trophies
    );
    merged.ownedSkins = filterClientOwnedSkins(cleaned.ownedSkins, prev && prev.ownedSkins);
    merged.ownedBoards = filterClientOwnedBoards(cleaned.ownedBoards, prev && prev.ownedBoards);
    const skins = merged.ownedSkins || [];
    const boards = merged.ownedBoards || [];
    if (cleaned.skinId && skins.indexOf(String(cleaned.skinId)) !== -1) merged.skinId = String(cleaned.skinId);
    else if (prev && prev.skinId && skins.indexOf(String(prev.skinId)) !== -1) merged.skinId = String(prev.skinId);
    else merged.skinId = 'default';
    if (cleaned.boardId && boards.indexOf(String(cleaned.boardId)) !== -1) merged.boardId = String(cleaned.boardId);
    else if (prev && prev.boardId && boards.indexOf(String(prev.boardId)) !== -1) merged.boardId = String(prev.boardId);
    else merged.boardId = 'field_default';
    e.guestProgress = merged;
    return e;
  };

  // Load profile for enrichment outside the DB lock (best-effort).
  try {
    let probe = await loadDeviceBindRecord(id);
    if (!probe) probe = { accountIds: [DEVICE_GUEST_MARK], guestProgress: null };
    applyMerge(probe);
    enrichCode = probe.guestProgress && probe.guestProgress.friendCode
      ? String(probe.guestProgress.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
      : '';
    if (enrichCode && store && typeof store.loadProfile === 'function') {
      enrichProf = await store.loadProfile(enrichCode);
    }
  } catch (_) {}

  const applyEnrich = (e) => {
    if (!enrichProf || !e.guestProgress) return;
    const code = e.guestProgress.friendCode
      ? String(e.guestProgress.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
      : '';
    if (!code || code !== enrichCode) return;
    e.guestProgress = applyServerCosmeticsToGuest(e.guestProgress, {
      diamonds: typeof e.guestProgress.diamonds === 'number' ? e.guestProgress.diamonds : enrichProf.diamonds,
      ownedSkins: enrichProf.ownedSkins,
      ownedBoards: enrichProf.ownedBoards,
      equippedSkin: e.guestProgress.skinId || enrichProf.equippedSkin,
      equippedBoard: e.guestProgress.boardId || enrichProf.equippedBoard
    }, code);
    if (typeof enrichProf.diamonds === 'number') {
      const gd = typeof e.guestProgress.diamonds === 'number' ? e.guestProgress.diamonds : enrichProf.diamonds;
      e.guestProgress.diamonds = Math.min(gd, Math.max(0, enrichProf.diamonds | 0));
    }
  };

  let finalGp = null;
  if (store && typeof store.atomicDeviceBindUpdate === 'function') {
    await store.atomicDeviceBindUpdate(id, (rec) => {
      applyMerge(rec);
      applyEnrich(rec);
      finalGp = rec.guestProgress || null;
    });
  } else {
    let e = await loadDeviceBindRecord(id);
    if (!e) e = { accountIds: [DEVICE_GUEST_MARK], guestProgress: null };
    applyMerge(e);
    applyEnrich(e);
    await persistDeviceBind(id, e);
    finalGp = e.guestProgress || null;
  }
  // Mirror to guest_progress table by friend code
  try {
    const code = finalGp && finalGp.friendCode
      ? String(finalGp.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
      : '';
    if (code && !(await isFriendCodeDeletedAsync(code)) && store && typeof store.saveGuestProgress === 'function') {
      await store.saveGuestProgress(code, finalGp);
    }
  } catch (_) {}
  }); // withKeyLock
}

async function getDeviceGuestProgress(deviceId) {
  const e = await loadDeviceBindRecord(deviceId);
  if (!e || !e.guestProgress) return null;
  let gp = sanitizeGuestProgress(e.guestProgress);
  // Always re-merge paid ownership from profiles so resume after reload is correct
  try {
    const code = gp && gp.friendCode
      ? String(gp.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
      : '';
    if (code && getStore() && typeof getStore().loadProfile === 'function') {
      const prof = await getStore().loadProfile(code);
      if (prof) {
        gp = applyServerCosmeticsToGuest(gp, {
          diamonds: typeof gp.diamonds === 'number' ? gp.diamonds : prof.diamonds,
          ownedSkins: prof.ownedSkins,
          ownedBoards: prof.ownedBoards,
          equippedSkin: gp.skinId || prof.equippedSkin,
          equippedBoard: gp.boardId || prof.equippedBoard
        }, code);
        if (typeof prof.diamonds === 'number') {
          const gd = typeof gp.diamonds === 'number' ? gp.diamonds : prof.diamonds;
          gp.diamonds = Math.min(gd, Math.max(0, prof.diamonds | 0));
        }
      }
    }
  } catch (_) {}
  return gp;
}

async function clearDeviceGuestMark(deviceId) {
  const id = normalizeDeviceId(deviceId);
  if (!id) return;
  const store = getStore();
  if (store && typeof store.atomicDeviceBindUpdate === 'function') {
    const shouldDelete = await store.atomicDeviceBindUpdate(id, (rec) => {
      if (Array.isArray(rec.accountIds)) {
        rec.accountIds = rec.accountIds.filter((x) => x !== DEVICE_GUEST_MARK);
      }
      if ((!rec.accountIds || !rec.accountIds.length) && !rec.guestProgress) {
        return { commit: false, result: true }; // signal delete
      }
      return { commit: true, result: false };
    });
    if (shouldDelete) {
      try {
        if (typeof store.deleteDeviceBind === 'function') await store.deleteDeviceBind(id);
      } catch (_) {}
    }
    return;
  }
  const e = await loadDeviceBindRecord(id);
  if (!e) return;
  if (Array.isArray(e.accountIds)) e.accountIds = e.accountIds.filter((x) => x !== DEVICE_GUEST_MARK);
  if (!e.accountIds.length && !e.guestProgress) {
    try {
      if (store && typeof store.deleteDeviceBind === 'function') await store.deleteDeviceBind(id);
    } catch (_) {}
    return;
  }
  await persistDeviceBind(id, e);
}

async function bindDeviceGuest(deviceId, progress) {
  const id = normalizeDeviceId(deviceId);
  if (!id) return false;
  if (await deviceHasRealAccount(id)) return false;
  return withKeyLock(deviceLockKey(id), async () => {
  progress = stripDeletedFriendCodeFromProgress(progress);
  // Refuse to resurrect a deleted identity (durable tombstone)
  try {
    const fc = progress && progress.friendCode
      ? String(progress.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
      : '';
    if (fc && await isFriendCodeDeletedAsync(fc)) {
      progress = Object.assign({}, progress || {});
      delete progress.friendCode;
    }
  } catch (_) {}
  const cleaned = sanitizeGuestProgress(progress || {}) || { ts: clock.now() };
  if (!cleaned.ts) cleaned.ts = clock.now();
  try {
    if (cleaned.friendCode && await isFriendCodeDeletedAsync(String(cleaned.friendCode))) {
      delete cleaned.friendCode;
    }
  } catch (_) {}
  // Pre-resolve claimability for first-identity path
  let incomingClaimable = true;
  const incomingCode = cleaned.friendCode
    ? String(cleaned.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
    : '';
  if (incomingCode) {
    try { incomingClaimable = await friendCodeClaimableByDevice(id, incomingCode); } catch (_) { incomingClaimable = false; }
  }
  let keepDeleted = false;
  const store = getStore();
  const apply = (e) => {
    if (!Array.isArray(e.accountIds)) e.accountIds = [];
    if (e.accountIds.indexOf(DEVICE_GUEST_MARK) === -1) e.accountIds.push(DEVICE_GUEST_MARK);
    const localCleaned = Object.assign({}, cleaned);
    const keep = e.guestProgress && typeof e.guestProgress === 'object' && e.guestProgress.friendCode
      ? String(e.guestProgress.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
      : '';
    const incoming = localCleaned.friendCode
      ? String(localCleaned.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
      : '';
    if (keep && !keepDeleted && incoming !== keep) {
      localCleaned.friendCode = keep;
      ['diamonds', 'ownedSkins', 'ownedBoards', 'skinId', 'boardId', 'trophies', 'best'].forEach((k) => {
        delete localCleaned[k];
      });
    }
    if (!(keep && !keepDeleted) && incoming && !incomingClaimable) {
      delete localCleaned.friendCode;
      ['diamonds', 'ownedSkins', 'ownedBoards', 'skinId', 'boardId', 'trophies', 'best'].forEach((k) => {
        delete localCleaned[k];
      });
    }
    if (e.guestProgress && typeof e.guestProgress === 'object') {
      e.guestProgress = Object.assign({}, e.guestProgress, localCleaned);
    } else {
      e.guestProgress = localCleaned;
    }
  };
  // Check if stored keep code is deleted (async, outside mutator)
  try {
    const probe = await loadDeviceBindRecord(id);
    const keep = probe && probe.guestProgress && probe.guestProgress.friendCode
      ? String(probe.guestProgress.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
      : '';
    if (keep) keepDeleted = await isFriendCodeDeletedAsync(keep);
  } catch (_) {}

  let finalGp = null;
  if (store && typeof store.atomicDeviceBindUpdate === 'function') {
    await store.atomicDeviceBindUpdate(id, (rec) => {
      apply(rec);
      try {
        if (rec.guestProgress && rec.guestProgress.friendCode && keepDeleted) {
          // keep was deleted — already handled via keepDeleted flag
        }
      } catch (_) {}
      finalGp = rec.guestProgress || null;
    });
  } else {
    let e = await loadDeviceBindRecord(id);
    if (!e) e = { accountIds: [], guestProgress: null };
    apply(e);
    await persistDeviceBind(id, e);
    finalGp = e.guestProgress || null;
  }
  try {
    const code = finalGp && finalGp.friendCode
      ? String(finalGp.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
      : '';
    if (code && !(await isFriendCodeDeletedAsync(code)) && store && typeof store.saveGuestProgress === 'function') {
      await store.saveGuestProgress(code, finalGp);
    }
  } catch (_) {}
  return true;
  }); // withKeyLock
}

async function unbindDeviceFully(deviceId) {
  const id = normalizeDeviceId(deviceId);
  if (!id || !getStore() || typeof getStore().deleteDeviceBind !== 'function') return;
  try {
    await getStore().deleteDeviceBind(id);
  } catch (_) {}
}

async function unbindAccountFromAllDevices(accountId) {
  if (!accountId || !getStore() || typeof getStore().unbindAccountFromDevices !== 'function') return;
  try {
    await getStore().unbindAccountFromDevices(String(accountId));
  } catch (_) {}
}


/**
 * May THIS device take `friendCode` as its guest identity?
 *
 * A friend code is a public identifier, never a credential. The only proof of ownership for a
 * guest identity is the server-issued device cookie, so a device may adopt a code only if:
 *   - it is not tombstoned,
 *   - it does not belong to a registered account (those are proven by a session token),
 *   - it is not held by a live socket of ANOTHER device,
 *   - it has no stored guest identity, unless that identity is already bound to THIS device.
 * Brand-new, never-seen codes (client-generated pre-login codes) are claimable.
 */
async function friendCodeClaimableByDevice(deviceId, friendCode) {
  const code = String(friendCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  if (!code) return false;
  const did = normalizeDeviceId(deviceId);
  try { if (await isFriendCodeDeletedAsync(code)) return false; } catch (_) { return false; }
  const st = getStore();
  try {
    if (st && typeof st.loadAccountByCode === 'function' && await st.loadAccountByCode(code)) return false;
  } catch (_) { return false; }
  try {
    const presMap = typeof hooks.getPresence === 'function' ? hooks.getPresence() : hooks.presence;
    const pres = presMap && presMap.get(code);
    if (pres && pres.ws && pres.ws.readyState === 1 && did && pres.ws._deviceId && pres.ws._deviceId !== did) {
      return false;
    }
  } catch (_) {}
  // Already bound to THIS device?
  let own = false;
  try {
    const rec = did ? await loadDeviceBindRecord(did) : null;
    const bound = rec && rec.guestProgress && rec.guestProgress.friendCode
      ? String(rec.guestProgress.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
      : '';
    own = !!bound && bound === code;
  } catch (_) {}
  if (own) return true;
  try {
    if (st && typeof st.loadGuestProgress === 'function' && await st.loadGuestProgress(code)) return false;
  } catch (_) { return false; }
  // A cosmetics profile that holds purchases outlives guest_progress (it is permanent), so it is
  // still proof that someone owns this code: another device must not be able to adopt it.
  try {
    if (st && typeof st.loadProfile === 'function') {
      const prof = await st.loadProfile(code);
      if (prof) {
        const skins = Array.isArray(prof.ownedSkins) ? prof.ownedSkins.length : 0;
        const boards = Array.isArray(prof.ownedBoards) ? prof.ownedBoards.length : 0;
        if (skins > 1 || boards > 1) return false;
      }
    }
  } catch (_) { return false; }
  return true;
}

/**
 * After account removal: detach the account from every device bind.
 * If a device still has OTHER live accounts, a new guest stays forbidden there.
 * If no live account is left, the device bind is deleted so a NEW guest is allowed.
 * Shared by the admin API and the self-service /api/auth/delete route.
 */
async function markDevicesAfterAccountDelete(accountId, friendCode) {
  const st = getStore();
  if (!st || !st.pool || !accountId) return;
  const HAD = '__had_account__';
  try {
    const { rows } = await st.pool.query(
      `SELECT device_id, account_ids, guest_progress FROM device_binds`
    );
    for (const r of (rows || [])) {
      let ids = Array.isArray(r.account_ids) ? r.account_ids.map(String) : [];
      if (!ids.some((x) => x === String(accountId))) continue;
      ids = ids.filter((x) => x && x !== String(accountId) && x !== '__guest__' && x !== HAD && x !== DEVICE_HAD_MARK);
      const stillLive = ids.some((x) => x && x !== DEVICE_GUEST_MARK && x !== HAD && x !== DEVICE_HAD_MARK);
      if (stillLive) {
        await st.pool.query(
          `UPDATE device_binds SET account_ids = $2::jsonb, guest_progress = NULL, updated_at = $3 WHERE device_id = $1`,
          [r.device_id, JSON.stringify(ids), clock.now()]
        );
      } else {
        // No remaining accounts on this device -> free for a new guest
        await st.pool.query('DELETE FROM device_binds WHERE device_id = $1', [r.device_id]);
      }
    }
  } catch (e) {
    try { console.warn('[device] markDevicesAfterAccountDelete', e && e.message); } catch (_) {}
  }
  try {
    if (friendCode && st.deleteGuestProgress) {
      await st.deleteGuestProgress(friendCode);
    }
  } catch (_) {}
}

/** Donation currency: never trust client 9999 to raise a stored balance. */
function resolveAuthoritativeDiamonds(stored, incoming) {
  // Diamonds are server-only. Client values are never applied on sync paths.
  // Purchases go through cosmetics_buy / tryBuy which write the stored balance.
  const hasS = typeof stored === 'number' && isFinite(stored);
  if (hasS) return Math.max(0, stored | 0);
  // First-time only: seed from server default, ignore client (including 9999 dumps)
  return undefined;
}

/** Trophies: never take client value over stored. */
function resolveAuthoritativeTrophies(stored, incoming) {
  const hasS = typeof stored === 'number' && isFinite(stored);
  if (hasS) return Math.max(0, stored | 0);
  return 0;
}

/** Only free / already-owned cosmetics may appear in client-supplied lists. */
function filterClientOwnedSkins(incoming, prevOwned) {
  const prev = Array.isArray(prevOwned) ? prevOwned.map(String) : [];
  const prevSet = new Set(prev);
  const out = new Set(prev);
  // Always keep free defaults
  try {
    for (const id of Cosmetics.FREE_SKIN_IDS) out.add(id);
  } catch (_) { out.add('default'); }
  if (Array.isArray(incoming)) {
    for (const raw of incoming.slice(0, 64)) {
      const id = String(raw || '');
      if (!id) continue;
      if (prevSet.has(id)) { out.add(id); continue; }
      try {
        if (Cosmetics.isFreeSkin(id)) out.add(id);
      } catch (_) {}
    }
  }
  return Array.from(out).slice(0, 64);
}

/**
 * Server-authoritative write of shop ownership into a guest_progress object.
 * Unlike mergeGuestProgressLayers + filterClientOwnedSkins, this TRUSTS the
 * cosmetics profile (post-buy / post-equip) so paid skins are not stripped.
 */
function applyServerCosmeticsToGuest(gp, profile, code) {
  const out = gp && typeof gp === 'object' ? Object.assign({}, gp) : {};
  if (code) out.friendCode = String(code).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  if (!profile || typeof profile !== 'object') return out;
  if (typeof profile.diamonds === 'number' && isFinite(profile.diamonds)) {
    out.diamonds = Math.max(0, profile.diamonds | 0);
  }
  if (Array.isArray(profile.ownedSkins)) {
    const set = new Set();
    try { for (const id of Cosmetics.FREE_SKIN_IDS) set.add(id); } catch (_) { set.add('default'); }
    profile.ownedSkins.forEach(function (x) { if (x) set.add(String(x)); });
    out.ownedSkins = Array.from(set).slice(0, 64);
  }
  if (Array.isArray(profile.ownedBoards)) {
    const set = new Set();
    try { for (const id of Cosmetics.FREE_BOARD_IDS) set.add(id); } catch (_) { set.add('field_default'); }
    profile.ownedBoards.forEach(function (x) { if (x) set.add(String(x)); });
    out.ownedBoards = Array.from(set).slice(0, 64);
  }
  if (profile.equippedSkin) out.skinId = String(profile.equippedSkin).slice(0, 32);
  if (profile.equippedBoard) out.boardId = String(profile.equippedBoard).slice(0, 32);
  out.updatedAt = clock.now();
  return out;
}

function filterClientOwnedBoards(incoming, prevOwned) {
  const prev = Array.isArray(prevOwned) ? prevOwned.map(String) : [];
  const prevSet = new Set(prev);
  const out = new Set(prev);
  try {
    for (const id of Cosmetics.FREE_BOARD_IDS) out.add(id);
  } catch (_) { out.add('field_default'); }
  if (Array.isArray(incoming)) {
    for (const raw of incoming.slice(0, 64)) {
      const id = String(raw || '');
      if (!id) continue;
      if (prevSet.has(id)) { out.add(id); continue; }
      try {
        if (Cosmetics.isFreeBoard(id)) out.add(id);
      } catch (_) {}
    }
  }
  return Array.from(out).slice(0, 64);
}

/** Load authoritative trophies for a friend code (account → guest progress → 0). */
async function loadAuthoritativeTrophies(friendCode) {
  const code = String(friendCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  if (!code || !getStore()) return 0;
  try {
    if (typeof getStore().loadAccountByCode === 'function') {
      const acc = await getStore().loadAccountByCode(code);
      if (acc && typeof acc.trophies === 'number') return Math.max(0, acc.trophies | 0);
    }
  } catch (_) {}
  try {
    if (typeof getStore().loadGuestProgress === 'function') {
      const gp = await getStore().loadGuestProgress(code);
      if (gp && typeof gp.trophies === 'number') return Math.max(0, gp.trophies | 0);
    }
  } catch (_) {}
  return 0;
}

function sanitizeGuestProgress(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  try {
    if (raw.friendCode) out.friendCode = String(raw.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
    if (typeof raw.nick === 'string') out.nick = String(raw.nick).slice(0, 24);
    // Economy fields are accepted only as soft hints; merges use server authority helpers.
    if (typeof raw.trophies === 'number') out.trophies = Math.max(0, Math.min(1e9, raw.trophies | 0));
    if (typeof raw.diamonds === 'number') out.diamonds = Math.max(0, Math.min(1e9, raw.diamonds | 0));
    if (typeof raw.best === 'number') out.best = Math.max(0, Math.min(1e9, raw.best | 0));
    if (Array.isArray(raw.ownedSkins)) out.ownedSkins = raw.ownedSkins.map(String).slice(0, 64);
    if (Array.isArray(raw.ownedBoards)) out.ownedBoards = raw.ownedBoards.map(String).slice(0, 64);
    if (raw.skinId) out.skinId = String(raw.skinId).slice(0, 64);
    if (raw.boardId) out.boardId = String(raw.boardId).slice(0, 64);
    if (typeof raw.status === 'string') out.status = String(raw.status).slice(0, 80);
    if (typeof raw.avatarId === 'string') out.avatarId = String(raw.avatarId).slice(0, 64);
    if (typeof raw.avatarCustom === 'string') out.avatarCustom = String(raw.avatarCustom).slice(0, 200000);
    if (Array.isArray(raw.friends)) out.friends = raw.friends.slice(0, 200);
    if (Array.isArray(raw.history)) out.history = raw.history.slice(0, 30);
    if (raw.achievements && typeof raw.achievements === 'object') out.achievements = raw.achievements;
    if (raw.botStars && typeof raw.botStars === 'object' && !Array.isArray(raw.botStars)) {
      const stars = {};
      const ids = Object.keys(raw.botStars).slice(0, 200);
      for (const id of ids) {
        const bid = String(id).slice(0, 32);
        const st = raw.botStars[id];
        if (!st || typeof st !== 'object') continue;
        const entry = {};
        if (st['60']) entry['60'] = true;
        if (st['120']) entry['120'] = true;
        if (st['180']) entry['180'] = true;
        if (Object.keys(entry).length) stars[bid] = entry;
      }
      if (Object.keys(stars).length) out.botStars = stars;
    }
    if (raw.classicSave && typeof raw.classicSave === 'object') {
      try {
        const cs = raw.classicSave;
        const grid = Array.isArray(cs.grid) ? cs.grid.slice(0, 12) : null;
        if (grid && grid.length >= 8) {
          out.classicSave = {
            grid: grid.map((row) => Array.isArray(row) ? row.slice(0, 12).map((c) => (c == null ? null : String(c).slice(0, 24))) : []),
            score: typeof cs.score === 'number' ? Math.max(0, cs.score | 0) : 0,
            diamonds: typeof cs.diamonds === 'number' ? Math.max(0, cs.diamonds | 0) : undefined,
            pieces: Array.isArray(cs.pieces) ? cs.pieces.slice(0, 6).map((p) => ({
              shape: Array.isArray(p && p.shape) ? p.shape.slice(0, 16).map((c) => Array.isArray(c) ? [c[0]|0, c[1]|0] : c) : [],
              color: p && p.color ? String(p.color).slice(0, 24) : '',
              used: !!(p && p.used)
            })) : [],
            t: clock.now()
          };
        }
      } catch (_) {}
    }
    out.ts = clock.now();
  } catch (_) {}
  return out;
}
function mergeGuestProgressLayers() {
  // Merge multiple guest progress snapshots: later layers win on scalars,
  // arrays are unioned, currencies take max.
  const layers = Array.prototype.slice.call(arguments).filter((x) => x && typeof x === 'object');
  if (!layers.length) return null;
  const out = {};
  for (const gp of layers) {
    if (typeof gp.friendCode === 'string' && gp.friendCode) out.friendCode = String(gp.friendCode).toUpperCase();
    if (typeof gp.nick === 'string' && gp.nick) out.nick = String(gp.nick).slice(0, 24);
    if (typeof gp.status === 'string') out.status = String(gp.status).slice(0, 80);
    if (typeof gp.avatarId === 'string' && gp.avatarId) out.avatarId = String(gp.avatarId).slice(0, 64);
    if (typeof gp.avatarCustom === 'string') out.avatarCustom = gp.avatarCustom;
    if (gp.skinId) out.skinId = String(gp.skinId).slice(0, 64);
    if (gp.boardId) out.boardId = String(gp.boardId).slice(0, 64);
    // Economy: the FIRST layer that defines a value wins. Callers pass layers in order of
    // authority (server store → device bind → client body) and must strip economy fields from
    // the client body, so a later (less trusted) layer can never override or inflate a balance.
    if (typeof gp.trophies === 'number' && isFinite(gp.trophies) && typeof out.trophies !== 'number') {
      out.trophies = Math.max(0, Math.min(999999, gp.trophies | 0));
    }
    if (typeof gp.diamonds === 'number' && isFinite(gp.diamonds) && typeof out.diamonds !== 'number') {
      out.diamonds = Math.max(0, Math.min(99999999, gp.diamonds | 0));
    }
    if (typeof gp.best === 'number' && isFinite(gp.best)) {
      out.best = Math.max(typeof out.best === 'number' ? out.best : 0, gp.best | 0);
    }
    if (gp.classicSave && typeof gp.classicSave === 'object' && Array.isArray(gp.classicSave.grid)) {
      out.classicSave = gp.classicSave;
    }
    if (Array.isArray(gp.ownedSkins) && gp.ownedSkins.length) {
      out.ownedSkins = filterClientOwnedSkins(gp.ownedSkins, out.ownedSkins);
    }
    if (Array.isArray(gp.ownedBoards) && gp.ownedBoards.length) {
      out.ownedBoards = filterClientOwnedBoards(gp.ownedBoards, out.ownedBoards);
    }
    if (Array.isArray(gp.friends) && gp.friends.length) {
      const map = new Map();
      (Array.isArray(out.friends) ? out.friends : []).forEach((f) => {
        if (f && f.code) map.set(String(f.code).toUpperCase(), f);
      });
      gp.friends.forEach((f) => {
        if (f && f.code) map.set(String(f.code).toUpperCase(), f);
      });
      out.friends = Array.from(map.values()).slice(0, 200);
    }
    if (Array.isArray(gp.history) && gp.history.length) {
      const map = new Map();
      (Array.isArray(out.history) ? out.history : []).forEach((h, i) => {
        if (h) map.set(String(h.id || ('p' + i)), h);
      });
      gp.history.forEach((h, i) => {
        if (h) map.set(String(h.id || ('n' + i)), h);
      });
      out.history = Array.from(map.values()).slice(0, 30);
    }
    if (gp.achievements && typeof gp.achievements === 'object') {
      out.achievements = Object.assign({}, out.achievements || {}, gp.achievements);
    }
    if (gp.botStars && typeof gp.botStars === 'object' && !Array.isArray(gp.botStars)) {
      if (!out.botStars || typeof out.botStars !== 'object') out.botStars = {};
      for (const id of Object.keys(gp.botStars).slice(0, 200)) {
        const bid = String(id).slice(0, 32);
        const st = gp.botStars[id];
        if (!st || typeof st !== 'object') continue;
        if (!out.botStars[bid]) out.botStars[bid] = {};
        if (st['60']) out.botStars[bid]['60'] = true;
        if (st['120']) out.botStars[bid]['120'] = true;
        if (st['180']) out.botStars[bid]['180'] = true;
      }
    }
  }
  return out;
}


  return {
    DEVICE_GUEST_MARK,
    DEVICE_HAD_MARK,
    stripDeletedFriendCodeFromProgress,
    normalizeDeviceId,
    extractDeviceId,
    issueDeviceId,
    resolveDeviceIdForRequest,
    deviceIdSetCookieHeader,
    loadDeviceBindRecord,
    persistDeviceBind,
    deviceHasBoundAccount,
    deviceHasRealAccount,
    deviceForbidsNewGuest,
    deviceCanResumeGuest,
    bindDeviceToAccount,
    setDeviceGuestProgress,
    getDeviceGuestProgress,
    clearDeviceGuestMark,
    bindDeviceGuest,
    unbindDeviceFully,
    unbindAccountFromAllDevices,
    markDevicesAfterAccountDelete,
    friendCodeClaimableByDevice,
    resolveAuthoritativeDiamonds,
    resolveAuthoritativeTrophies,
    filterClientOwnedSkins,
    filterClientOwnedBoards,
    applyServerCosmeticsToGuest,
    sanitizeGuestProgress,
    mergeGuestProgressLayers,
    loadServerTrophies,
    loadAuthoritativeTrophies,
    normalizeClientIp
  };
}

module.exports = {
  DEVICE_GUEST_MARK,
  DEVICE_HAD_MARK,
  createDeviceApi
};
