/**
 * Identity: friend-code tombstones, purge, presence sweeper, session kick.
 * Extracted from server.js — behaviour unchanged.
 */
'use strict';

const { clock } = require('./clock');
const DELETED_FRIEND_CODES = new Map(); // code -> expiresAt
const DELETED_CODE_TTL_SEC = 30 * 24 * 3600;
const PRESENCE_RACE_GRACE_MS = 90 * 1000;

function createIdentityApi(deps) {
  const hooks = deps.hooks;
  const log = deps.log;
  const DEVICE_GUEST_MARK = deps.DEVICE_GUEST_MARK;
  const DEVICE_HAD_MARK = deps.DEVICE_HAD_MARK;
  const getStore = () => hooks.store;
  const getPresence = () => hooks.presence;
  const getPendingSocial = () => hooks.pendingSocial;
  const getProfileCache = () => hooks.profileCache;
  const getWss = () => hooks.wss;
  const send = (...a) => hooks.send(...a);

function markFriendCodeDeleted(code, reason) {
  const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  if (!c) return Promise.resolve();
  DELETED_FRIEND_CODES.set(c, clock.now() + DELETED_CODE_TTL_SEC * 1000);
  // Durable tombstone — return promise so purge can await it
  try {
    if (getStore() && typeof getStore().markDeletedCode === 'function') {
      return getStore().markDeletedCode(c, reason || 'account_deleted', DELETED_CODE_TTL_SEC).catch(() => {});
    }
  } catch (_) {}
  return Promise.resolve();
}

function isFriendCodeDeleted(code) {
  const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  if (!c) return false;
  const exp = DELETED_FRIEND_CODES.get(c);
  if (exp) {
    if (clock.now() > exp) { DELETED_FRIEND_CODES.delete(c); }
    else return true;
  }
  return false;
}

/** Async check: memory cache first, then durable store (survives restart). */
async function isFriendCodeDeletedAsync(code) {
  const c = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  if (!c) return false;
  if (isFriendCodeDeleted(c)) return true;
  try {
    if (getStore() && typeof getStore().isDeletedCode === 'function') {
      const dead = await getStore().isDeletedCode(c);
      if (dead) {
        // Warm memory cache
        DELETED_FRIEND_CODES.set(c, clock.now() + DELETED_CODE_TTL_SEC * 1000);
        return true;
      }
    }
  } catch (_) {}
  return false;
}

/**
 * Comprehensive "is this friend code still valid?" probe.
 *
 * Alive only if durable data exists (account / guest_progress / profile)
 * OR a very short getPresence() race-window (connected socket, age < 90s) to avoid
 * false kills right after first connect before guest_progress is written.
 *
 * Presence alone beyond the race window does NOT keep a deleted code alive —
 * that was allowing resurrection after DB delete.
 *
 * Tombstoned codes are always dead.
 *
 * @param {string} friendCode
 * @param {{ requireAccount?: boolean, presenceGraceMs?: number }} [opts]
 */
async function probeFriendCodeAlive(friendCode, opts) {
  opts = opts || {};
  const code = String(friendCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  const out = { alive: false, hasAccount: false, hasGuest: false, hasProfile: false, hasFreshPresence: false };
  if (!code) return out;

  if (await isFriendCodeDeletedAsync(code)) return out;

  const now = clock.now();

  try {
    if (getStore() && typeof getStore().loadAccountByCode === 'function') {
      const acc = await getStore().loadAccountByCode(code);
      if (acc) { out.hasAccount = true; out.alive = true; }
    }
  } catch (_) {}

  // Registered sessions: account row is the only source of truth
  if (opts.requireAccount) {
    out.alive = out.hasAccount;
    return out;
  }

  if (out.alive) return out;

  try {
    if (getStore() && typeof getStore().loadGuestProgress === 'function') {
      const gp = await getStore().loadGuestProgress(code);
      if (gp) { out.hasGuest = true; out.alive = true; }
    }
  } catch (_) {}

  if (out.alive) return out;

  try {
    if (getStore() && typeof getStore().loadProfile === 'function') {
      const prof = await getStore().loadProfile(code);
      if (prof) { out.hasProfile = true; out.alive = true; }
    }
  } catch (_) {}

  if (out.alive) return out;

  // Short race grace only: connected socket whose getPresence() entry is < 90s old.
  // Does NOT apply to restored-from-DB getPresence() (no live socket) or long-lived sessions
  // after the durable rows were wiped.
  try {
    const ent = getPresence() && getPresence().get(code);
    if (ent && ent.ws && ent.ws.readyState === 1) {
      const born = Number(ent.connectedAt || ent.ts || ent.lastSeen || 0) || 0;
      const age = born ? (now - born) : 0;
      const grace = typeof opts.presenceGraceMs === 'number' ? opts.presenceGraceMs : PRESENCE_RACE_GRACE_MS;
      if (age > 0 && age < grace) {
        out.hasFreshPresence = true;
        out.alive = true;
      }
    }
  } catch (_) {}

  return out;
}


/**
 * Irreversibly wipe EVERY server artifact for a friend code:
 * accounts, sessions, guest_progress, profiles, getPresence(), social,
 * device_binds.guest_progress that reference this code, profile cache.
 * Marks code as deleted so guest-bind/sync cannot resurrect it.
 */
async function purgeAllDataForFriendCode(friendCode, opts) {
  opts = opts || {};
  const code = String(friendCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  if (!code) return { ok: false };
  // Durable tombstone FIRST so concurrent guest-bind/sync cannot recreate rows
  try { await markFriendCodeDeleted(code, opts.reason || 'account_deleted'); } catch (_) {
    try { markFriendCodeDeleted(code, opts.reason || 'account_deleted'); } catch (_) {}
  }
  try { if (getProfileCache() && getProfileCache().has(code)) getProfileCache().delete(code); } catch (_) {}
  try { getPresence().delete(code); } catch (_) {}
  try { getPendingSocial().delete(code); } catch (_) {}

  let accountId = null;
  const formerFriends = new Set();
  try {
    if (getStore() && typeof getStore().loadAccountByCode === 'function') {
      const acc = await getStore().loadAccountByCode(code);
      if (acc && acc.id) accountId = String(acc.id);
      if (acc && Array.isArray(acc.friends)) {
        acc.friends.forEach((f) => {
          const c = String((f && f.code) || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
          if (c && c !== code) formerFriends.add(c);
        });
      }
    }
  } catch (_) {}

  // DB rows
  try {
    if (getStore() && getStore().pool) {
      if (accountId) {
        try { await getStore().pool.query('DELETE FROM sessions WHERE account_id = $1', [accountId]); } catch (_) {}
        try { await getStore().pool.query('DELETE FROM accounts WHERE id = $1', [accountId]); } catch (_) {}
      }
      try { await getStore().pool.query('DELETE FROM accounts WHERE friend_code = $1', [code]); } catch (_) {}
      try { await getStore().pool.query('DELETE FROM guest_progress WHERE friend_code = $1', [code]); } catch (_) {}
      try { await getStore().pool.query('DELETE FROM profiles WHERE friend_code = $1', [code]); } catch (_) {}
      try { await getStore().pool.query('DELETE FROM presence WHERE friend_code = $1', [code]); } catch (_) {}
      try { await getStore().pool.query('DELETE FROM social WHERE friend_code = $1', [code]); } catch (_) {}
    } else {
      try { if (getStore() && getStore().deleteGuestProgress) await getStore().deleteGuestProgress(code); } catch (_) {}
      try { if (getStore() && getStore().deleteProfile) await getStore().deleteProfile(code); } catch (_) {}
      try { if (getStore() && getStore().deletePresence) await getStore().deletePresence(code); } catch (_) {}
    }
  } catch (_) {}

  // Remove the code from EVERY other player's friends list (accounts, guests, device binds)
  // and tell former friends so their open clients drop it immediately.
  try {
    if (getStore() && typeof getStore().purgeFriendReferences === 'function') {
      const owners = await getStore().purgeFriendReferences(code);
      (owners || []).forEach((c) => formerFriends.add(String(c).toUpperCase()));
    }
  } catch (e) {
    try { log('warn', 'purge friend refs failed', { code, err: e && e.message }); } catch (_) {}
  }
  try {
    for (const tCode of formerFriends) {
      const msg = { type: 'friend_remove', code, from: code, name: '', reason: 'account_deleted', ts: clock.now() };
      const target = getPresence() && getPresence().get(tCode);
      if (target && target.ws && target.ws.readyState === 1) {
        try { send(target.ws, { type: 'social_msg', msg }); } catch (_) {}
      } else if (getPendingSocial()) {
        try {
          if (!getPendingSocial().has(tCode)) getPendingSocial().set(tCode, []);
          const box = getPendingSocial().get(tCode);
          box.push(msg);
          if (box.length > 30) box.splice(0, box.length - 30);
          if (getStore() && typeof getStore().setSocial === 'function') getStore().setSocial(tCode, box).catch(() => {});
        } catch (_) {}
      }
    }
  } catch (_) {}

  // Wipe guest_progress from EVERY device_bind that holds this friend code
  try {
    if (getStore() && getStore().pool) {
      const { rows } = await getStore().pool.query(
        `SELECT device_id, account_ids, guest_progress FROM device_binds`
      );
      for (const r of (rows || [])) {
        let touched = false;
        let ids = Array.isArray(r.account_ids) ? r.account_ids.map(String) : [];
        let gp = r.guest_progress;
        if (typeof gp === 'string') {
          try { gp = JSON.parse(gp); } catch (_) { gp = null; }
        }
        const gpCode = gp && gp.friendCode
          ? String(gp.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
          : '';
        if (gpCode === code) {
          gp = null;
          touched = true;
        }
        if (accountId && ids.indexOf(String(accountId)) !== -1) {
          ids = ids.filter((x) => x !== String(accountId));
          touched = true;
        }
        // Drop pure guest mark if we wiped its progress for this code
        if (touched) {
          ids = ids.filter((x) => x !== DEVICE_GUEST_MARK && x !== '__guest__');
          const stillLive = ids.some(
            (x) => x && x !== DEVICE_GUEST_MARK && x !== DEVICE_HAD_MARK && x !== '__had_account__' && x !== '__guest__'
          );
          if (!stillLive && !gp) {
            // Free device completely — new guest allowed from scratch
            try {
              await getStore().pool.query('DELETE FROM device_binds WHERE device_id = $1', [r.device_id]);
            } catch (_) {}
          } else {
            try {
              await getStore().pool.query(
                `UPDATE device_binds SET account_ids = $2::jsonb, guest_progress = $3::jsonb, updated_at = $4 WHERE device_id = $1`,
                [r.device_id, JSON.stringify(ids), gp ? JSON.stringify(gp) : null, clock.now()]
              );
            } catch (_) {}
          }
        }
      }
    }
  } catch (e) {
    try { log('warn', 'purge device_binds failed', { code, err: e && e.message }); } catch (_) {}
  }

  // Kick live sockets last (skipPurge to avoid recursion)
  if (!opts.skipKick) {
    try { kickFriendCodeSessions(code, opts.reason || 'account_deleted', { skipPurge: true }); } catch (_) {}
  }
  return { ok: true, code, accountId };
}


function startAccountPresenceSweeper() {
  clock.setInterval(async () => {
    try {
      if (!getPresence() || !getPresence().size || !getStore()) return;
      const codes = Array.from(getPresence().keys());
      for (const code of codes) {
        try {
          const ent = getPresence().get(code);
          // Skip entries with no live socket and stale lastSeen — just drop from memory map
          if (ent && !(ent.ws && ent.ws.readyState === 1)) {
            const last = Number(ent.lastSeen || ent.ts || 0) || 0;
            if (!last || clock.now() - last > 15 * 60 * 1000) {
              getPresence().delete(code);
              continue;
            }
          }
          const wasReg = !!(ent && ent.ws && ent.ws._accountBound);
          const probe = await probeFriendCodeAlive(code, {
            requireAccount: wasReg,
            presenceGraceMs: PRESENCE_RACE_GRACE_MS
          });
          if (!probe.alive) {
            // Ensure durable tombstone even when account was deleted via raw SQL
            try { await markFriendCodeDeleted(code, 'account_deleted'); } catch (_) {
              try { markFriendCodeDeleted(code, 'account_deleted'); } catch (_2) {}
            }
            kickFriendCodeSessions(code, 'account_deleted');
          }
        } catch (_) {}
      }
    } catch (_) {}
  }, 5000); // 5s — was 2s; less aggressive, fewer false positives under load
}

function kickFriendCodeSessions(friendCode, reason, opts) {
  opts = opts || {};
  const code = String(friendCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  if (!code) return 0;
  try { markFriendCodeDeleted(code); } catch (_) {}
  let n = 0;
  const payload = {
    type: 'auth_revoked',
    reason: reason || 'account_deleted',
    friendCode: code,
    ts: clock.now()
  };
  try {
    const p = getPresence().get(code);
    if (p && p.ws && p.ws.readyState === 1) {
      try { send(p.ws, payload); } catch (_) {}
      try { p.ws.close(4001, 'account_deleted'); } catch (_) {}
      n++;
    }
    getPresence().delete(code);
  } catch (_) {}
  try {
    if (getWss() && getWss().clients) {
      getWss().clients.forEach((ws) => {
        try {
          if (!ws || ws.readyState !== 1) return;
          if (ws._friendCode && String(ws._friendCode).toUpperCase() === code) {
            try { send(ws, payload); } catch (_) {}
            try { ws.close(4001, 'account_deleted'); } catch (_) {}
            try { ws._friendCode = null; ws._accountBound = false; } catch (_) {}
            n++;
          }
        } catch (_) {}
      });
    }
  } catch (_) {}
  try {
    if (getProfileCache() && getProfileCache().has(code)) getProfileCache().delete(code);
  } catch (_) {}
  // Full DB wipe unless caller already did (opts.skipPurge) or already in progress
  if (!opts.skipPurge && ((reason || '') === 'account_deleted' || (reason || '') === 'deleted')) {
    try {
      if (!kickFriendCodeSessions._purging) kickFriendCodeSessions._purging = new Set();
      if (!kickFriendCodeSessions._purging.has(code)) {
        kickFriendCodeSessions._purging.add(code);
        Promise.resolve()
          .then(function () { return purgeAllDataForFriendCode(code, { reason: reason || 'account_deleted', skipKick: true }); })
          .catch(function () {})
          .then(function () {
            try { kickFriendCodeSessions._purging.delete(code); } catch (_) {}
          });
      }
    } catch (_) {}
  }
  return n;
}


  return {
    DELETED_FRIEND_CODES,
    DELETED_CODE_TTL_SEC,
    PRESENCE_RACE_GRACE_MS,
    markFriendCodeDeleted,
    isFriendCodeDeleted,
    isFriendCodeDeletedAsync,
    probeFriendCodeAlive,
    purgeAllDataForFriendCode,
    startAccountPresenceSweeper,
    kickFriendCodeSessions
  };
}

module.exports = { createIdentityApi, DELETED_FRIEND_CODES, PRESENCE_RACE_GRACE_MS };
