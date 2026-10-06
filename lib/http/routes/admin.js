/**
 * Block Puzzle — lib/http/routes/admin.js
 * Local admin API (/api/admin/*): view / wipe accounts.
 * Extracted from the former monolithic lib/http-api.js — behaviour unchanged.
 * Contract: resolves true when the request was handled, false to fall through to the next route module.
 */
'use strict';

const { isLoopbackIp, safeEqual, adminPolicy, extractAdminKey } = require('../../security');

async function handleAdminRoutes(req, res, ctx) {
  const {
    DEVICE_GUEST_MARK,
    DEVICE_HAD_MARK,
    adminLimiter,
    clientIp,
    kickFriendCodeSessions,
    loadDeviceBindRecord,
    markFriendCodeDeleted,
    pendingSocial,
    persistDeviceBind,
    presence,
    purgeAllDataForFriendCode,
    readJsonBody,
    send,
    sendJson,
    sendTooMany,
    store,
    url,
    wss
  } = ctx;

  // —— Local admin (view / wipe accounts) ——
  if (url.startsWith('/api/admin/')) {
    const policy = adminPolicy();
    if (!policy.enabled) {
      return (sendJson(res, 404, { ok: false, error: 'admin_disabled', message: 'Админ-API выключен: задайте BP_ADMIN_KEY' }), true);
    }
    // Dev default key is only honoured for local connections.
    if (policy.devOnly && !isLoopbackIp(req.socket && req.socket.remoteAddress)) {
      return (sendJson(res, 403, { ok: false, error: 'forbidden', message: 'Задайте BP_ADMIN_KEY для удалённого доступа' }), true);
    }
    const gate = adminLimiter.check(clientIp, '__admin__');
    if (!gate.ok) return (sendTooMany(res, gate.retryAfter), true);
    // Read body ONCE (stream can only be consumed once)
    let adminBody = {};
    if (req.method !== 'GET') {
      try { adminBody = await readJsonBody(req, 64 * 1024); } catch (_) { adminBody = {}; }
    }
    // Key: X-Admin-Key header or JSON body — never the query string (logged by proxies).
    const key = extractAdminKey(req, adminBody);
    if (!safeEqual(key, policy.key)) {
      adminLimiter.fail(clientIp, '__admin__');
      return (sendJson(res, 403, { ok: false, error: 'forbidden', message: 'Неверный BP_ADMIN_KEY' }), true);
    }
    adminLimiter.success(clientIp, '__admin__');
    const HAD = '__had_account__';

    /**
     * After account removal: detach account from devices.
     * If device still has OTHER live accounts → guest stays forbidden.
     * If no live accounts left → delete device bind so NEW guest is allowed.
     */
    async function markDevicesAfterAccountDelete(accountId, friendCode) {
      if (!store || !store.pool) return;
      try {
        const { rows } = await store.pool.query(
          `SELECT device_id, account_ids, guest_progress FROM device_binds`
        );
        for (const r of (rows || [])) {
          let ids = Array.isArray(r.account_ids) ? r.account_ids.map(String) : [];
          if (!ids.some((x) => x === String(accountId))) continue;
          ids = ids.filter((x) => x && x !== String(accountId) && x !== '__guest__' && x !== HAD && x !== DEVICE_HAD_MARK);
          const stillLive = ids.some((x) => x && x !== DEVICE_GUEST_MARK && x !== HAD && x !== DEVICE_HAD_MARK);
          if (stillLive) {
            await store.pool.query(
              `UPDATE device_binds SET account_ids = $2::jsonb, guest_progress = NULL, updated_at = $3 WHERE device_id = $1`,
              [r.device_id, JSON.stringify(ids), Date.now()]
            );
          } else {
            // No remaining accounts on this device → free for a new guest
            await store.pool.query('DELETE FROM device_binds WHERE device_id = $1', [r.device_id]);
          }
        }
      } catch (e) {
        try { console.warn('[admin] markDevicesAfterAccountDelete', e && e.message); } catch (_) {}
      }
      try {
        if (friendCode && store.deleteGuestProgress) {
          await store.deleteGuestProgress(friendCode);
        }
      } catch (_) {}
    }

    if (url === '/api/admin/overview' && req.method === 'GET') {
      let accounts = [];
      let devices = [];
      let guests = [];
      try {
        if (store && store.pool) {
          const a = await store.pool.query(
            `SELECT id, login, friend_code, nick, trophies, diamonds, best,
                            avatar_id, status, skin_id, board_id, created_at, updated_at,
                            jsonb_array_length(COALESCE(history, '[]'::jsonb)) AS history_len,
                            bot_stars
                     FROM accounts ORDER BY updated_at DESC NULLS LAST LIMIT 1000`
          );
          accounts = a.rows || [];
          const d = await store.pool.query(
            `SELECT device_id, account_ids, guest_progress, updated_at
                     FROM device_binds ORDER BY updated_at DESC NULLS LAST LIMIT 1000`
          );
          devices = d.rows || [];
          const g = await store.pool.query(
            `SELECT friend_code, updated_at, data FROM guest_progress ORDER BY updated_at DESC LIMIT 500`
          );
          guests = g.rows || [];
        }
      } catch (e) {
        return (sendJson(res, 500, { ok: false, error: String(e && e.message || e) }), true);
      }
      // Attach device ids to each account
      const byAcc = {};
      for (const d of devices) {
        const ids = Array.isArray(d.account_ids) ? d.account_ids : [];
        for (const aid of ids) {
          if (!aid || aid === '__guest__' || aid === HAD) continue;
          if (!byAcc[aid]) byAcc[aid] = [];
          byAcc[aid].push(d.device_id);
        }
      }
      accounts = accounts.map((a) => Object.assign({}, a, {
        device_ids: byAcc[a.id] || []
      }));
      return (sendJson(res, 200, { ok: true, accounts, devices, guests }), true);
    }

    if (url === '/api/admin/delete-account' && req.method === 'POST') {
      const id = adminBody && adminBody.id ? String(adminBody.id) : '';
      if (!id) return (sendJson(res, 400, { ok: false, error: 'id_required' }), true);
      try {
        if (!store || !store.pool) {
          return (sendJson(res, 500, { ok: false, error: 'no_store' }), true);
        }
        const { rows } = await store.pool.query(
          'SELECT id, friend_code FROM accounts WHERE id = $1',
          [id]
        );
        if (!rows[0]) {
          return (sendJson(res, 404, { ok: false, error: 'not_found', message: 'Аккаунт не найден' }), true);
        }
        const friendCode = rows[0].friend_code;
        try {
          if (friendCode) await purgeAllDataForFriendCode(friendCode, { reason: 'account_deleted' });
          else {
            await store.pool.query('DELETE FROM sessions WHERE account_id = $1', [id]);
            await store.pool.query('DELETE FROM accounts WHERE id = $1', [id]);
            await markDevicesAfterAccountDelete(id, friendCode);
          }
        } catch (e) {
          return (sendJson(res, 500, { ok: false, error: String(e && e.message || e) }), true);
        }
        return (sendJson(res, 200, { ok: true, deleted: id }), true);
      } catch (e) {
        return (sendJson(res, 500, { ok: false, error: String(e && e.message || e) }), true);
      }
    }

    if (url === '/api/admin/delete-all-accounts' && req.method === 'POST') {
      try {
        // Collect every identity first: registered accounts AND guests
        const codes = new Set();
        try {
          if (presence && presence.size) for (const c of presence.keys()) codes.add(String(c).toUpperCase());
        } catch (_) {}
        if (store && store.pool) {
          const grab = async (sql, col) => {
            try {
              const r = await store.pool.query(sql);
              (r.rows || []).forEach((x) => { const c = String(x[col] || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); if (c) codes.add(c); });
            } catch (_) {}
          };
          await grab('SELECT friend_code FROM accounts', 'friend_code');
          await grab('SELECT friend_code FROM guest_progress', 'friend_code');
          await grab('SELECT friend_code FROM profiles', 'friend_code');
          await grab("SELECT guest_progress->>'friendCode' AS fc FROM device_binds WHERE guest_progress IS NOT NULL", 'fc');
        }
        // Tombstone + kick (skipPurge: tables are wiped in bulk below)
        for (const code of codes) {
          try { await markFriendCodeDeleted(code, 'account_deleted'); } catch (_) {}
          try { kickFriendCodeSessions(code, 'account_deleted', { skipPurge: true }); } catch (_) {}
        }
        if (store && store.pool) {
          await store.pool.query('DELETE FROM sessions');
          await store.pool.query('DELETE FROM accounts');
          await store.pool.query('DELETE FROM device_binds');
          await store.pool.query('DELETE FROM guest_progress');
          try { await store.pool.query('DELETE FROM profiles'); } catch (_) {}
          try { await store.pool.query('DELETE FROM presence'); } catch (_) {}
          try { await store.pool.query('DELETE FROM social'); } catch (_) {}
        }
        try { pendingSocial.clear(); } catch (_) {}
      } catch (e) {
        return (sendJson(res, 500, { ok: false, error: String(e && e.message || e) }), true);
      }
      return (sendJson(res, 200, { ok: true, message: 'Все аккаунты и гости удалены, устройства освобождены' }), true);
    }

    const normGuestCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);

    // Full guest removal: tombstone + guest_progress + profile + presence + social +
    // every friends list + every device bind, and live sockets get auth_revoked (4001).
    async function adminPurgeGuest(code) {
      if (!code) return { ok: false, error: 'no_code' };
      if (store && typeof store.loadAccountByCode === 'function') {
        const acc = await store.loadAccountByCode(code);
        if (acc) return { ok: false, error: 'is_registered_account' };
      }
      await purgeAllDataForFriendCode(code, { reason: 'account_deleted' });
      return { ok: true, code };
    }

    if (url === '/api/admin/delete-guest' && req.method === 'POST') {
      const code = normGuestCode(adminBody && adminBody.friendCode);
      if (!code) return (sendJson(res, 400, { ok: false, error: 'friendCode_required' }), true);
      try {
        const r = await adminPurgeGuest(code);
        if (!r.ok) {
          return (sendJson(res, r.error === 'is_registered_account' ? 409 : 400, {
            ok: false, error: r.error,
            message: r.error === 'is_registered_account' ? 'Это зарегистрированный аккаунт — удалите его как аккаунт' : 'Нет кода'
          }), true);
        }
        return (sendJson(res, 200, { ok: true, deleted: code, message: 'Гость удалён полностью' }), true);
      } catch (e) {
        return (sendJson(res, 500, { ok: false, error: String(e && e.message || e) }), true);
      }
    }

    if (url === '/api/admin/delete-device' && req.method === 'POST') {
      const did = adminBody && adminBody.deviceId ? String(adminBody.deviceId) : '';
      if (!did) return (sendJson(res, 400, { ok: false, error: 'deviceId_required' }), true);
      try {
        // Every guest identity that could belong to this device:
        //  - friend code stored in the device bind
        //  - friend code of every live socket opened from this device
        const codes = new Set();
        const rec = await loadDeviceBindRecord(did);
        const bindCode = normGuestCode(rec && rec.guestProgress && rec.guestProgress.friendCode);
        if (bindCode) codes.add(bindCode);
        try {
          if (wss && wss.clients) {
            wss.clients.forEach((w) => {
              if (w && w._deviceId === did && w._friendCode) codes.add(normGuestCode(w._friendCode));
            });
          }
        } catch (_) {}
        let purged = 0;
        for (const code of codes) {
          const r = await adminPurgeGuest(code);
          if (r.ok) purged++;
          else if (r.error === 'is_registered_account') {
            return (sendJson(res, 409, { ok: false, error: r.error, message: 'Это зарегистрированный аккаунт — удалите его как аккаунт' }), true);
          }
        }
        // Bind row: drop it when no live account remains, otherwise only the guest part
        const left = await loadDeviceBindRecord(did);
        if (left) {
          const ids = (Array.isArray(left.accountIds) ? left.accountIds.map(String) : [])
            .filter((x) => x && x !== DEVICE_GUEST_MARK && x !== HAD && x !== DEVICE_HAD_MARK);
          if (ids.length) {
            await persistDeviceBind(did, { accountIds: ids, guestProgress: null });
          } else if (store && typeof store.deleteDeviceBind === 'function') {
            await store.deleteDeviceBind(did);
          }
        }
        // Sockets of this device that were not tied to a purged code still get kicked
        try {
          if (wss && wss.clients) {
            wss.clients.forEach((w) => {
              if (!w || w._deviceId !== did || w.readyState !== 1 || w._accountBound) return;
              try { send(w, { type: 'auth_revoked', reason: 'account_deleted', ts: Date.now() }); } catch (_) {}
              try { w.close(4001, 'account_deleted'); } catch (_) {}
            });
          }
        } catch (_) {}
        return (sendJson(res, 200, {
          ok: true, purged,
          message: 'Гость полностью удалён (прогресс, профиль, друзья, привязка устройства), игрок выброшен'
        }), true);
      } catch (e) {
        return (sendJson(res, 500, { ok: false, error: String(e && e.message || e) }), true);
      }
    }

    return (sendJson(res, 404, { ok: false, error: 'unknown_admin_route' }), true);
  }

  return false;
}

module.exports = { handleAdminRoutes };
