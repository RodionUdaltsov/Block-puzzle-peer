/**
 * HTTP request listener (static files + /api/*).
 * Extracted from server.js — behaviour unchanged.
 */
'use strict';

const path = require('path');
const fs = require('fs');
const { getClientIp, isLoopbackIp, safeEqual, adminPolicy, extractAdminKey, applyCors } = require('./security');
const { createAuthLimiter } = require('./rate-limit');

function createHttpRequestListener(deps) {
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

  return function httpRequestListener(req, res) {
    // Live state snapshots for this request
    const store = hooks.store;
    const accountsApi = hooks.accountsApi;
    const presence = hooks.presence;
    const pendingSocial = hooks.pendingSocial;
    const wss = hooks.wss;
    const rooms = hooks.rooms;
    const privateLobbies = hooks.privateLobbies;
    const totalQueued = hooks.totalQueued || (() => 0);


  try {
    applySecurityHeaders(res);
    applyCors(req, res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    const url = (req.url || '/').split('?')[0];

    // —— JSON body helper ——
    function readJsonBody(req, limit) {
      limit = limit || 65536;
      return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on('data', (c) => {
          size += c.length;
          if (size > limit) {
            reject(new Error('body_too_large'));
            try { req.destroy(); } catch (_) {}
            return;
          }
          chunks.push(c);
        });
        req.on('end', () => {
          try {
            const raw = Buffer.concat(chunks).toString('utf8');
            if (!raw) return resolve({});
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(e);
          }
        });
        req.on('error', reject);
      });
    }
    function sendJson(res, code, obj) {
      const body = JSON.stringify(obj);
      res.writeHead(code, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      res.end(body);
    }
    function sendTooMany(res, retryAfter) {
      const sec = Math.max(1, retryAfter | 0);
      res.writeHead(429, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Retry-After': String(sec)
      });
      res.end(JSON.stringify({
        ok: false,
        error: 'too_many_attempts',
        retryAfter: sec,
        message: 'Слишком много попыток. Повторите через ' + sec + ' сек.'
      }));
    }
    const clientIp = getClientIp(req);
    function bearerToken(req) {
      const h = String((req.headers && (req.headers.authorization || req.headers.Authorization)) || '');
      const m = /^Bearer\s+(.+)$/i.exec(h);
      if (m) return m[1].trim();
      // optional cookie
      const cookie = String((req.headers && req.headers.cookie) || '');
      const cm = /(?:^|;\s*)bp_token=([^;]+)/.exec(cookie);
      return cm ? decodeURIComponent(cm[1]) : null;
    }

    // —— Accounts API ——
    if (url.startsWith('/api/')) {
      // Guest IP bind endpoints work without full accounts service
      const isGuestIpApi = (
        (url === '/api/auth/guest-allowed' && req.method === 'GET') ||
        (url === '/api/auth/guest-bind' && req.method === 'POST') ||
        (url === '/api/auth/guest-sync' && req.method === 'POST')
      );
      const isAdminApi = url.startsWith('/api/admin/');
      if (!accountsApi && !isGuestIpApi && !isAdminApi) {
        sendJson(res, 503, { ok: false, error: 'accounts_unavailable', message: 'Сервис аккаунтов недоступен' });
        return;
      }
      (async () => {
        try {


          // —— Local admin (view / wipe accounts) ——
          if (url.startsWith('/api/admin/')) {
            const policy = adminPolicy();
            if (!policy.enabled) {
              return sendJson(res, 404, { ok: false, error: 'admin_disabled', message: 'Админ-API выключен: задайте BP_ADMIN_KEY' });
            }
            // Dev default key is only honoured for local connections.
            if (policy.devOnly && !isLoopbackIp(req.socket && req.socket.remoteAddress)) {
              return sendJson(res, 403, { ok: false, error: 'forbidden', message: 'Задайте BP_ADMIN_KEY для удалённого доступа' });
            }
            const gate = adminLimiter.check(clientIp, '__admin__');
            if (!gate.ok) return sendTooMany(res, gate.retryAfter);
            // Read body ONCE (stream can only be consumed once)
            let adminBody = {};
            if (req.method !== 'GET') {
              try { adminBody = await readJsonBody(req, 64 * 1024); } catch (_) { adminBody = {}; }
            }
            // Key: X-Admin-Key header or JSON body — never the query string (logged by proxies).
            const key = extractAdminKey(req, adminBody);
            if (!safeEqual(key, policy.key)) {
              adminLimiter.fail(clientIp, '__admin__');
              return sendJson(res, 403, { ok: false, error: 'forbidden', message: 'Неверный BP_ADMIN_KEY' });
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
                return sendJson(res, 500, { ok: false, error: String(e && e.message || e) });
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
              return sendJson(res, 200, { ok: true, accounts, devices, guests });
            }

            if (url === '/api/admin/delete-account' && req.method === 'POST') {
              const id = adminBody && adminBody.id ? String(adminBody.id) : '';
              if (!id) return sendJson(res, 400, { ok: false, error: 'id_required' });
              try {
                if (!store || !store.pool) {
                  return sendJson(res, 500, { ok: false, error: 'no_store' });
                }
                const { rows } = await store.pool.query(
                  'SELECT id, friend_code FROM accounts WHERE id = $1',
                  [id]
                );
                if (!rows[0]) {
                  return sendJson(res, 404, { ok: false, error: 'not_found', message: 'Аккаунт не найден' });
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
                  return sendJson(res, 500, { ok: false, error: String(e && e.message || e) });
                }
                return sendJson(res, 200, { ok: true, deleted: id });
              } catch (e) {
                return sendJson(res, 500, { ok: false, error: String(e && e.message || e) });
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
                return sendJson(res, 500, { ok: false, error: String(e && e.message || e) });
              }
              return sendJson(res, 200, { ok: true, message: 'Все аккаунты и гости удалены, устройства освобождены' });
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
              if (!code) return sendJson(res, 400, { ok: false, error: 'friendCode_required' });
              try {
                const r = await adminPurgeGuest(code);
                if (!r.ok) {
                  return sendJson(res, r.error === 'is_registered_account' ? 409 : 400, {
                    ok: false, error: r.error,
                    message: r.error === 'is_registered_account' ? 'Это зарегистрированный аккаунт — удалите его как аккаунт' : 'Нет кода'
                  });
                }
                return sendJson(res, 200, { ok: true, deleted: code, message: 'Гость удалён полностью' });
              } catch (e) {
                return sendJson(res, 500, { ok: false, error: String(e && e.message || e) });
              }
            }

            if (url === '/api/admin/delete-device' && req.method === 'POST') {
              const did = adminBody && adminBody.deviceId ? String(adminBody.deviceId) : '';
              if (!did) return sendJson(res, 400, { ok: false, error: 'deviceId_required' });
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
                    return sendJson(res, 409, { ok: false, error: r.error, message: 'Это зарегистрированный аккаунт — удалите его как аккаунт' });
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
                return sendJson(res, 200, {
                  ok: true, purged,
                  message: 'Гость полностью удалён (прогресс, профиль, друзья, привязка устройства), игрок выброшен'
                });
              } catch (e) {
                return sendJson(res, 500, { ok: false, error: String(e && e.message || e) });
              }
            }

            return sendJson(res, 404, { ok: false, error: 'unknown_admin_route' });
          }

          if (url === '/api/auth/guest-allowed' && req.method === 'GET') {
            const deviceId = extractDeviceId(req, null);
            if (!deviceId) {
              return sendJson(res, 400, {
                ok: false,
                error: 'device_id_required',
                message: 'Нужен идентификатор устройства (X-Device-Id)'
              });
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
              return;
            }
          }
          // Claim guest slot for this IP — blocks another NEW guest after browser data wipe
          if (url === '/api/auth/guest-bind' && req.method === 'POST') {
            const body = await readJsonBody(req, 256 * 1024).catch(() => ({}));
            const deviceId = extractDeviceId(req, body);
            if (!deviceId) {
              return sendJson(res, 400, {
                ok: false,
                error: 'device_id_required',
                message: 'Нужен идентификатор устройства (X-Device-Id)'
              });
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
              return sendBound(403, {
                ok: false,
                guestAllowed: false,
                canResumeGuest: false,
                bound: true,
                hasAccount: true,
                error: 'already_bound',
                message: 'С этого устройства уже был аккаунт — войдите или зарегистрируйтесь'
              });
            }
            // Already has guest — update progress, never create a second slot
            if ((await deviceCanResumeGuest(deviceId)) || (await deviceHasBoundAccount(deviceId))) {
              await bindDeviceGuest(deviceId, stripDeletedFriendCodeFromProgress(body && body.progress));
              return sendBound(200, {
                ok: true,
                resumed: true,
                guestAllowed: false,
                canResumeGuest: true,
                guestProgress: await getDeviceGuestProgress(deviceId)
              });
            }
            // First claim on this device — write device_binds row IMMEDIATELY
            const boundOk = await bindDeviceGuest(deviceId, stripDeletedFriendCodeFromProgress((body && body.progress) || { ts: Date.now() }));
            if (!boundOk) {
              return sendBound(500, {
                ok: false,
                error: 'bind_failed',
                message: 'Не удалось привязать устройство к базе'
              });
            }
            return sendBound(200, {
              ok: true,
              guestAllowed: false,
              canResumeGuest: true,
              bound: false,
              guestProgress: await getDeviceGuestProgress(deviceId)
            });
          }
          // Sync guest progress while playing (IP-bound)
          if (url === '/api/auth/guest-sync' && req.method === 'POST') {
            let body = {};
            try { body = await readJsonBody(req, 512 * 1024); } catch (_) { body = {}; }
            const deviceId = extractDeviceId(req, body);
            if (!deviceId) {
              return sendJson(res, 400, {
                ok: false,
                error: 'device_id_required',
                message: 'Нужен идентификатор устройства (X-Device-Id)'
              });
            }
            if (await deviceHasRealAccount(deviceId)) {
              return sendJson(res, 403, { ok: false, error: 'real_account', message: 'Войдите в аккаунт' });
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
                  return sendJson(res, 410, {
                    ok: false,
                    error: 'account_deleted',
                    message: 'Аккаунт удалён — начните заново',
                    accountDeleted: true
                  });
                }
              } catch (_) {}
              await setDeviceGuestProgress(deviceId, prog);
            }
            const gp = await getDeviceGuestProgress(deviceId);
            return sendJson(res, 200, {
              ok: true,
              canResumeGuest: true,
              guestProgress: gp
            });
          }
          if (url === '/api/auth/register' && req.method === 'POST') {
            // Larger body: may include full guestProgress for migration
            const body = await readJsonBody(req, 512 * 1024);
            const deviceId = extractDeviceId(req, body);
            const regGate = authLimiter.checkRegister(clientIp, deviceId);
            if (!regGate.ok) return sendTooMany(res, regGate.retryAfter);
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
                if (prefCode) codesTry.push(prefCode);
                if (guestProgress && guestProgress.friendCode) {
                  codesTry.push(String(guestProgress.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, ''));
                }
                for (const c of codesTry) {
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
            if (!result.ok) return sendJson(res, result.error === 'busy' ? 503 : 400, result);
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
            return sendJson(res, 201, result);
          }
          // Credential check only — no session, no device bind, no guest wipe
          if (url === '/api/auth/check-login' && req.method === 'POST') {
            const body = await readJsonBody(req, 8192);
            const clDev = extractDeviceId(req, body);
            const gate = authLimiter.check(clientIp, body && body.login, clDev);
            if (!gate.ok) return sendTooMany(res, gate.retryAfter);
            const result = await accountsApi.checkCredentials({
              login: body.login,
              password: body.password
            });
            if (!result.ok) {
              if (result.error === 'busy') return sendJson(res, 503, result);
              authLimiter.fail(clientIp, body && body.login, clDev);
              return sendJson(res, 401, result);
            }
            authLimiter.success(clientIp, body && body.login, clDev);
            return sendJson(res, 200, result);
          }
          if (url === '/api/auth/login' && req.method === 'POST') {
            const body = await readJsonBody(req, 16384);
            const loginDev = extractDeviceId(req, body);
            const gate = authLimiter.check(clientIp, body && body.login, loginDev);
            if (!gate.ok) return sendTooMany(res, gate.retryAfter);
            const result = await accountsApi.login({
              login: body.login,
              password: body.password
            });
            if (!result.ok) {
              if (result.error === 'busy') return sendJson(res, 503, result);
              authLimiter.fail(clientIp, body && body.login, loginDev);
              return sendJson(res, 401, result);
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
            return sendJson(res, 200, result);
          }
          if (url === '/api/auth/logout' && req.method === 'POST') {
            const token = bearerToken(req);
            await accountsApi.logout(token);
            return sendJson(res, 200, { ok: true });
          }
          // After confirmed login-from-guest: permanently erase guest identity
          if (url === '/api/auth/wipe-guest' && req.method === 'POST') {
            const token = bearerToken(req);
            const acc = await accountsApi.resolveSession(token);
            if (!acc) return sendJson(res, 401, { ok: false, error: 'unauthorized' });
            const body = await readJsonBody(req, 4096);
            const guestCode = String(body.guestFriendCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
            const accCode = acc.friendCode
              ? String(acc.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
              : '';
            if (!guestCode) {
              return sendJson(res, 400, { ok: false, error: 'missing_guest_code' });
            }
            if (guestCode === accCode) {
              return sendJson(res, 400, { ok: false, error: 'cannot_wipe_self' });
            }
            const wipeVerdict = await checkGuestWipeOwnership(extractDeviceId(req, body), guestCode);
            if (wipeVerdict === 'forbidden') {
              return sendJson(res, 403, { ok: false, error: 'not_your_guest' });
            }
            if (wipeVerdict === 'noop') {
              return sendJson(res, 200, { ok: true, wiped: guestCode, alreadyWiped: true });
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
            return sendJson(res, 200, { ok: true, wiped: guestCode });
          }
          if (url === '/api/auth/delete' && req.method === 'POST') {
            const token = bearerToken(req);
            const body = await readJsonBody(req, 4096);
            const delKey = 'del:' + String(token || '').slice(0, 16);
            const delDev = extractDeviceId(req, body);
            const delGate = authLimiter.check(clientIp, delKey, delDev);
            if (!delGate.ok) return sendTooMany(res, delGate.retryAfter);
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
              return sendJson(res, code, result);
            }
            try {
              if (delCode) await purgeAllDataForFriendCode(delCode, { reason: 'account_deleted' });
              else if (result.id) {
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
            return sendJson(res, 200, result);
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
            if (!code) return sendJson(res, 400, { ok: false, alive: false, error: 'code_required' });
            const probe = await probeFriendCodeAlive(code);
            if (!probe.alive) {
              try { kickFriendCodeSessions(code, 'account_deleted'); } catch (_) {}
            }
            return sendJson(res, 200, {
              ok: true,
              alive: !!probe.alive,
              hasAccount: !!probe.hasAccount,
              hasGuest: !!probe.hasGuest,
              hasProfile: !!probe.hasProfile,
              code
            });
          }

          if (url === '/api/me' && req.method === 'GET') {
            const token = bearerToken(req);
            const acc = await accountsApi.resolveSession(token);
            if (!acc) {
              return sendJson(res, 401, {
                ok: false,
                error: 'unauthorized',
                accountDeleted: true,
                message: 'Требуется вход'
              });
            }
            return sendJson(res, 200, { ok: true, account: accountsApi.publicAccount(acc) });
          }
          if (url === '/api/me' && (req.method === 'PATCH' || req.method === 'POST')) {
            const token = bearerToken(req);
            const acc = await accountsApi.resolveSession(token);
            if (!acc) return sendJson(res, 401, { ok: false, error: 'unauthorized', message: 'Требуется вход' });
            // Larger limit: history (with replays) + friends + cosmetics progress
            const body = await readJsonBody(req, 512 * 1024);
            const updated = await accountsApi.updateAccount(acc, body || {});
            return sendJson(res, 200, { ok: true, account: updated });
          }
          sendJson(res, 404, { ok: false, error: 'not_found', message: 'Не найдено' });
        } catch (e) {
          try { log('error', 'api', { message: e && e.message }); } catch (_) {}
          sendJson(res, 500, { ok: false, error: 'server_error', message: 'Ошибка сервера' });
        }
      })();
      return;
    }

    if (url === '/health') {
      let wsClients = 0;
      try { wsClients = wss.clients.size; } catch (_) {}
      let liveRooms = 0;
      let endedRooms = 0;
      for (const r of rooms.values()) {
        if (r && r.status === 'ended') endedRooms += 1;
        else liveRooms += 1;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        service: 'block-puzzle',
        version: PKG_VERSION,
        crossplay: true,
        protocolVersion: 1,
        rooms: rooms.size,
        roomsLive: liveRooms,
        roomsEnded: endedRooms,
        queue: totalQueued(),
        privateLobbies: privateLobbies.size,
        presence: presence.size,
        wsClients,
        store: store ? store.kind : 'none',
        uptime: Math.floor(process.uptime()),
        node: process.version,
        pid: process.pid,
        memoryRss: process.memoryUsage().rss
      }));
      return;
    }
    let filePath = path.join(PUBLIC, url === '/' ? 'index.html' : url);
    // prevent path escape
    if (!filePath.startsWith(PUBLIC)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    fs.stat(filePath, (err, st) => {
      if (!err && st.isFile()) {
        sendFile(req, res, filePath);
        return;
      }
      // SPA fallback
      sendFile(req, res, path.join(PUBLIC, 'index.html'));
    });
  } catch (e) {
    try { applySecurityHeaders(res); } catch (_) {}
    res.writeHead(500);
    res.end('Server error');
  }

  };
}

module.exports = { createHttpRequestListener };
