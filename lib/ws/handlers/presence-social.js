/**
 * Block Puzzle — lib/ws/handlers/presence-social.js
 * Presence registration/query, friend profile + code check, nick search, activity, social messages.
 * Extracted from the former monolithic lib/ws-handlers.js — behaviour unchanged.
 * Contract: returns true when the message was handled (stop dispatching), false to fall through.
 */
'use strict';

// FIX: this constant was referenced but never defined in the old lib/ws-handlers.js, so
// `presence_register` threw a ReferenceError for durable identities on non-memory stores
// (PostgreSQL) right before `presence_ok` was sent.
const { PRESENCE_TTL } = require('../../store');

function handlePresenceSocial(type, ws, data, shared) {
  const {
    Cosmetics,
    accountsApi,
    computeWinStats,
    cosmeticsStatePayload,
    isFriendCodeDeletedAsync,
    loadCosmeticsProfile,
    loadDeviceBindRecord,
    loadServerTrophies,
    normalizeDeviceId,
    normalizePlatform,
    pendingSocial,
    presence,
    saveCosmeticsProfile,
    schedulePersistMeta,
    send,
    store
  } = shared;

  if (type === 'presence_register') {
    // Individual friend code for guests and registered players alike.
    // If the proposed code is already held by another live connection, assign a unique one.
    // Registered accounts keep their code (even if a guest offline-collided with it).
    (async () => {
      let code = String(data.friendCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
      let reassigned = false;

      const liveTakenByOther = (c) => {
        if (!c || c.length < 4) return true;
        const live = presence.get(c);
        return !!(live && live.token && live.token !== ws._token && live.ws && live.ws.readyState === 1);
      };

      // Tombstoned codes must never re-register — force a brand-new identity
      let wasTombstoned = false;
      try {
        if (code && await isFriendCodeDeletedAsync(code)) {
          wasTombstoned = true;
          code = '';
        }
      } catch (_) {}

      // Registered accounts keep their stored friend code (even legacy 6-char).
      // Guests must always have exactly 8 characters.
      let isRegisteredCode = false;
      try {
        if (code && store && typeof store.loadAccountByCode === 'function') {
          const acc = await store.loadAccountByCode(code);
          isRegisteredCode = !!acc;
        }
      } catch (_) {}

      // One device = one guest identity: if this device already owns a guest, that code wins over
      // whatever the client proposes. Otherwise purchases (WS, keyed by the presence code) and
      // the device-bound guest (used by registration) drift apart into two guests.
      let deviceGuestCode = '';
      try {
        const did = normalizeDeviceId(ws._deviceId);
        if (did && !isRegisteredCode) {
          const rec = await loadDeviceBindRecord(did);
          const gc = rec && rec.guestProgress && rec.guestProgress.friendCode
            ? String(rec.guestProgress.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
            : '';
          if (gc.length >= 4 && gc !== code && !(await isFriendCodeDeletedAsync(gc)) && !liveTakenByOther(gc)) {
            let gcIsAccount = false;
            try {
              gcIsAccount = !!(store && typeof store.loadAccountByCode === 'function' && await store.loadAccountByCode(gc));
            } catch (_) {}
            if (!gcIsAccount) deviceGuestCode = gc;
          } else if (gc && gc === code) {
            deviceGuestCode = gc;
          }
        }
      } catch (_) { deviceGuestCode = ''; }
      if (deviceGuestCode && deviceGuestCode !== code) {
        code = deviceGuestCode;
        wasTombstoned = false;
        reassigned = true;
      }

      const needNewCode = !code
        || (!isRegisteredCode && code.length !== 8 && code !== deviceGuestCode)
        || liveTakenByOther(code)
        || wasTombstoned;

      if (needNewCode) {
        try {
          if (accountsApi && typeof accountsApi.uniqueFriendCode === 'function') {
            code = await accountsApi.uniqueFriendCode();
          } else {
            const { genFriendCode } = require('./lib/accounts');
            let found = null;
            for (let i = 0; i < 64; i++) {
              const tryCode = genFriendCode(8);
              if (!liveTakenByOther(tryCode)) {
                let taken = false;
                try {
                  if (store && typeof store.loadAccountByCode === 'function') {
                    const acc = await store.loadAccountByCode(tryCode);
                    if (acc) taken = true;
                  }
                } catch (_) {}
                if (!taken) { found = tryCode; break; }
              }
            }
            code = found || genFriendCode(8);
          }
          reassigned = true;
        } catch (_) {
          const { genFriendCode } = require('./lib/accounts');
          code = genFriendCode(8);
          reassigned = true;
        }
      }

      // Preserve previously known custom avatar when client omits the heavy blob
      const prevPres = presence.get(code);
      let nextCustom = '';
      if (typeof data.avatarCustom === 'string' && data.avatarCustom.length > 8) {
        nextCustom = data.avatarCustom.slice(0, 49152);
      } else if (prevPres && typeof prevPres.avatarCustom === 'string' && prevPres.avatarCustom) {
        nextCustom = prevPres.avatarCustom;
      }
      // Trophies for presence: server store only (never client payload)
      let presTrophies = 0;
      try { presTrophies = await loadServerTrophies(code); } catch (_) { presTrophies = 0; }
      const nowTs = Date.now();
      const prevConnectedAt = (prevPres && prevPres.token === ws._token && prevPres.connectedAt)
        ? prevPres.connectedAt
        : nowTs;
      const presEntry = {
        token: ws._token, ws,
        name: String(data.name || 'Игрок').slice(0, 24),
        activity: String(data.activity || 'online').slice(0, 32),
        trophies: presTrophies | 0,
        avatarId: data.avatarId ? String(data.avatarId).slice(0, 32) : 'init',
        avatarCustom: nextCustom,
        status: typeof data.status === 'string' ? String(data.status).slice(0, 80) : '',
        platform: normalizePlatform(data.platform || ws._platform || 'web'),
        os: String(data.os || ws._os || 'unknown').slice(0, 24),
        lastSeen: nowTs,
        ts: nowTs,
        connectedAt: prevConnectedAt // stable for race-grace; not refreshed on every presence_register
      };
      // If this socket previously held another code, clear it so we do not leak presence
      if (ws._friendCode && ws._friendCode !== code) {
        const old = presence.get(ws._friendCode);
        if (old && old.token === ws._token) presence.delete(ws._friendCode);
      }
      // Double-check tombstone after code assignment (async race)
      if (await isFriendCodeDeletedAsync(code)) {
        try { send(ws, { type: 'auth_revoked', reason: 'account_deleted', friendCode: code, ts: Date.now() }); } catch (_) {}
        try { ws._friendCode = null; ws._accountBound = false; } catch (_) {}
        return;
      }
      presence.set(code, presEntry);
      ws._friendCode = code;
      // Track registered vs guest for session_check after DB deletes
      try {
        let reg = false;
        if (store && typeof store.loadAccountByCode === 'function') {
          const acc = await store.loadAccountByCode(code);
          reg = !!acc;
        }
        ws._accountBound = reg;
      } catch (_) { ws._accountBound = false; }
      // A code that is neither a registered account nor a bound guest is a throw-away
      // pre-login identity: keep it in memory only, never write presence / a cosmetics profile
      // for it (that is what produced the second, "empty" 9999-diamond guest).
      let durableIdentity = !!(ws._accountBound || (deviceGuestCode && deviceGuestCode === code));
      if (!durableIdentity) {
        try {
          durableIdentity = !!(store && typeof store.loadGuestProgress === 'function' && await store.loadGuestProgress(code));
        } catch (_) { durableIdentity = false; }
      }
      ws._durableIdentity = durableIdentity;
      if (durableIdentity && store && store.kind !== 'memory') {
        store.savePresence(code, {
          name: presEntry.name,
          activity: presEntry.activity,
          trophies: presEntry.trophies,
          avatarId: presEntry.avatarId,
          avatarCustom: presEntry.avatarCustom,
          status: presEntry.status || '',
          platform: presEntry.platform,
          os: presEntry.os,
          lastSeen: presEntry.lastSeen,
          online: true
        }, PRESENCE_TTL).catch(() => {});
      }
      schedulePersistMeta();
      send(ws, { type: 'presence_ok', friendCode: code, reassigned: !!reassigned });
      // Always push authoritative cosmetics so inventory survives reload
      try {
        let profile = await loadCosmeticsProfile(code);
        if (!profile.migrated) {
          if (durableIdentity) {
            profile = Cosmetics.migrateFromClient(profile, (data && data.cosmeticsHint) || {});
            await saveCosmeticsProfile(code, profile);
          }
          // else: show defaults, persist nothing until the identity is really bound
        }
        send(ws, cosmeticsStatePayload(profile));
      } catch (_) {}
      const deliverBox = (box) => {
        if (!box || !box.length) return;
        pendingSocial.delete(code);
        if (store) store.setSocial(code, []).catch(() => {});
        for (const msg of box) {
          try { send(ws, { type: 'social_msg', msg }); } catch (_) {}
        }
      };
      const memBox = pendingSocial.get(code);
      if (memBox && memBox.length) {
        deliverBox(memBox);
      } else if (store) {
        store.getSocial(code).then((box) => deliverBox(box)).catch(() => {});
      }
    })().catch(() => {});
    return true;
  }
  if (type === 'presence_query') {
    const codes = Array.isArray(data.codes) ? data.codes : [];
    const normalized = [];
    for (const raw of codes.slice(0, 40)) {
      const code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
      if (code) normalized.push(code);
    }
    const result = {};
    const needEnrich = [];
    for (const code of normalized) {
      const p = presence.get(code);
      if (p && p.ws && p.ws.readyState === 1) {
        result[code] = {
          online: true,
          name: p.name || '',
          activity: p.activity || 'online',
          trophies: p.trophies | 0,
          avatarId: p.avatarId ? String(p.avatarId).slice(0, 32) : 'init',
          // avatarCustom omitted from query (heavy base64) — use friend_profile for full
          status: typeof p.status === 'string' ? p.status.slice(0, 80) : '',
          lastSeen: p.lastSeen || p.ts || Date.now()
        };
        needEnrich.push(code);
      } else if (p && (p.name || p.trophies || p.avatarId)) {
        result[code] = {
          online: false,
          name: p.name || '',
          activity: p.activity || 'away',
          trophies: p.trophies | 0,
          avatarId: p.avatarId ? String(p.avatarId).slice(0, 32) : 'init',
          status: typeof p.status === 'string' ? p.status.slice(0, 80) : '',
          lastSeen: p.lastSeen || p.ts || 0
        };
        needEnrich.push(code);
      } else {
        result[code] = { online: false };
        needEnrich.push(code);
      }
    }
    const enrichFromStoreAndAccount = async (code) => {
      const snap = result[code] || { online: false };
      try {
        if (store && typeof store.loadPresence === 'function') {
          const data = await store.loadPresence(code);
          if (data) {
            if (!snap.name && data.name) snap.name = String(data.name).slice(0, 24);
            if (!snap.activity) snap.activity = data.activity || 'offline';
            if (!(snap.trophies > 0) && data.trophies) snap.trophies = data.trophies | 0;
            if ((!snap.avatarId || snap.avatarId === 'init') && data.avatarId) {
              snap.avatarId = String(data.avatarId).slice(0, 32);
            }
            // skip avatarCustom on presence_query (use friend_profile)
            if (!snap.lastSeen && data.lastSeen) snap.lastSeen = data.lastSeen;
            if (!snap.status && data.status) snap.status = String(data.status).slice(0, 80);
          }
        }
      } catch (_) {}
      try {
        if (store && typeof store.loadAccountByCode === 'function') {
          const acc = await store.loadAccountByCode(code);
          if (acc) {
            if (acc.nick || acc.login) snap.name = String(acc.nick || acc.login).slice(0, 24);
            if (typeof acc.trophies === 'number') snap.trophies = acc.trophies | 0;
            if (acc.avatarId) snap.avatarId = String(acc.avatarId).slice(0, 32);
            // skip avatarCustom on presence_query
            if (typeof acc.status === 'string') snap.status = String(acc.status).slice(0, 80);
            const stats = computeWinStats(acc.history);
            snap.wins = stats.wins;
            snap.played = stats.played;
            snap.winrate = stats.winrate;
          }
        }
      } catch (_) {}
      result[code] = snap;
    };
    Promise.all(needEnrich.map(enrichFromStoreAndAccount))
      .then(() => send(ws, { type: 'presence_state', friends: result }))
      .catch(() => send(ws, { type: 'presence_state', friends: result }));
    return true;
  }
  if (type === 'friend_profile') {
    const code = String(data.code || data.friendCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
    if (!code || code.length < 4) {
      send(ws, { type: 'friend_profile_result', ok: false, reason: 'bad_code' });
      return true;
    }
    (async () => {
      const out = {
        ok: true,
        code,
        online: false,
        name: '',
        trophies: 0,
        avatarId: 'init',
        avatarCustom: '',
        status: '',
        wins: 0,
        played: 0,
        winrate: null,
        activity: 'offline'
      };
      const live = presence.get(code);
      if (live && live.ws && live.ws.readyState === 1) {
        out.online = true;
        out.name = String(live.name || '').slice(0, 24);
        out.trophies = live.trophies | 0;
        out.avatarId = live.avatarId ? String(live.avatarId).slice(0, 32) : 'init';
        out.avatarCustom = (typeof live.avatarCustom === 'string' && out.avatarId === 'custom')
          ? live.avatarCustom.slice(0, 49152) : '';
        out.status = typeof live.status === 'string' ? live.status.slice(0, 80) : '';
        out.activity = live.activity || 'online';
      }
      try {
        if (store && typeof store.loadPresence === 'function') {
          const data = await store.loadPresence(code);
          if (data) {
            if (!out.name && data.name) out.name = String(data.name).slice(0, 24);
            if (!(out.trophies > 0) && data.trophies) out.trophies = data.trophies | 0;
            if ((!out.avatarId || out.avatarId === 'init') && data.avatarId) {
              out.avatarId = String(data.avatarId).slice(0, 32);
            }
            if (!out.avatarCustom && data.avatarCustom && out.avatarId === 'custom') {
              out.avatarCustom = String(data.avatarCustom).slice(0, 49152);
            }
            if (!out.online) out.activity = data.activity || 'offline';
            if (!out.status && data.status) out.status = String(data.status).slice(0, 80);
          }
        }
      } catch (_) {}
      try {
        if (store && typeof store.loadAccountByCode === 'function') {
          const acc = await store.loadAccountByCode(code);
          if (acc) {
            out.name = String(acc.nick || acc.login || out.name || code).slice(0, 24);
            if (typeof acc.trophies === 'number') out.trophies = acc.trophies | 0;
            if (acc.avatarId) out.avatarId = String(acc.avatarId).slice(0, 32);
            if (typeof acc.avatarCustom === 'string' && out.avatarId === 'custom') {
              out.avatarCustom = acc.avatarCustom.slice(0, 49152);
            }
            if (typeof acc.status === 'string') out.status = String(acc.status).slice(0, 80);
            const stats = computeWinStats(acc.history);
            out.wins = stats.wins;
            out.played = stats.played;
            out.winrate = stats.winrate;
          }
        }
      } catch (_) {}
      if (!out.name) out.name = code;
      send(ws, Object.assign({ type: 'friend_profile_result' }, out));
    })().catch(() => {
      send(ws, { type: 'friend_profile_result', ok: false, code, reason: 'error' });
    });
    return true;
  }
  if (type === 'friend_code_check') {
    const code = String(data.code || data.friendCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    if (!code || code.length < 6) {
      send(ws, { type: 'friend_code_check_result', code: code || '', ok: false, reason: 'bad_code' });
      return true;
    }
    if (ws._friendCode && code === ws._friendCode) {
      send(ws, { type: 'friend_code_check_result', code, ok: false, reason: 'self' });
      return true;
    }
    // Live presence first
    const live = presence.get(code);
    if (live && live.ws && live.ws.readyState === 1) {
      send(ws, {
        type: 'friend_code_check_result',
        code,
        ok: true,
        online: true,
        name: String(live.name || '').slice(0, 24) || code,
        trophies: live.trophies | 0
      });
      return true;
    }
    // Recently seen (persisted presence) OR registered account offline
    const finish = (snap, fromAccount) => {
      if (snap && (snap.name || snap.lastSeen || fromAccount)) {
        send(ws, {
          type: 'friend_code_check_result',
          code,
          ok: true,
          online: false,
          name: String(snap.name || snap.nick || '').slice(0, 24) || code,
          trophies: (snap.trophies | 0)
        });
      } else {
        send(ws, { type: 'friend_code_check_result', code, ok: false, reason: 'not_found' });
      }
    };
    const tryAccount = () => {
      if (store && typeof store.loadAccountByCode === 'function') {
        store.loadAccountByCode(code).then((acc) => {
          if (acc) {
            finish({
              name: acc.nick || acc.login || code,
              nick: acc.nick || acc.login,
              trophies: acc.trophies | 0,
              lastSeen: acc.updatedAt || acc.createdAt || 1
            }, true);
          } else {
            finish(null, false);
          }
        }).catch(() => finish(null, false));
      } else {
        finish(null, false);
      }
    };
    if (store && typeof store.loadPresence === 'function') {
      store.loadPresence(code).then((snap) => {
        if (snap && (snap.name || snap.lastSeen)) finish(snap, false);
        else tryAccount();
      }).catch(() => tryAccount());
    } else {
      tryAccount();
    }
    return true;
  }
  if (type === 'presence_search') {
    const raw = String(data.q || data.query || '').trim();
    const q = raw.toUpperCase().replace(/[^A-Z0-9А-ЯЁ\s\-_]/gi, '').slice(0, 24);
    const results = [];
    const seenCodes = new Set();
    if (q.length >= 1) {
      const qCode = q.replace(/[^A-Z0-9]/g, '');
      const qName = raw.toLowerCase().slice(0, 24);
      // 1) Online players from live presence
      for (const [code, p] of presence) {
        if (!p || !p.ws || p.ws.readyState !== 1) continue;
        if (ws._friendCode && code === ws._friendCode) continue; // self
        const name = String(p.name || '');
        const nameL = name.toLowerCase();
        const codeHit = qCode.length >= 2 && code.indexOf(qCode) === 0;
        const nameHit = qName.length >= 2 && (nameL.indexOf(qName) !== -1);
        if (!codeHit && !nameHit) continue;
        results.push({
          code,
          name: name.slice(0, 24) || code,
          trophies: p.trophies | 0,
          activity: String(p.activity || 'online').slice(0, 32),
          online: true,
          avatarId: p.avatarId ? String(p.avatarId).slice(0, 32) : 'init',
          avatarCustom: (typeof p.avatarCustom === 'string' && p.avatarId === 'custom')
            ? p.avatarCustom.slice(0, 49152) : ''
        });
        seenCodes.add(code);
        if (results.length >= 20) break;
      }
      // 2) Offline (and any registered) accounts from store — include players not currently online
      const finishSearch = () => {
        // Prefer exact code match first, then online, then trophies
        results.sort((a, b) => {
          const ae = a.code === qCode ? 0 : 1;
          const be = b.code === qCode ? 0 : 1;
          if (ae !== be) return ae - be;
          const ao = a.online ? 0 : 1;
          const bo = b.online ? 0 : 1;
          if (ao !== bo) return ao - bo;
          return (b.trophies | 0) - (a.trophies | 0);
        });
        send(ws, { type: 'presence_search_result', q: raw.slice(0, 24), results: results.slice(0, 20) });
      };
      if (store && typeof store.searchAccounts === 'function' && results.length < 20) {
        store.searchAccounts(raw, 20).then((accs) => {
          try {
            for (const acc of (accs || [])) {
              if (!acc || !acc.friendCode) continue;
              const code = String(acc.friendCode).toUpperCase();
              if (seenCodes.has(code)) continue;
              if (ws._friendCode && code === ws._friendCode) continue;
              const name = String(acc.nick || acc.login || code).slice(0, 24);
              const login = String(acc.login || '').toLowerCase();
              const nickL = String(acc.nick || '').toLowerCase();
              const codeHit = qCode.length >= 2 && code.indexOf(qCode) === 0;
              const nameHit = qName.length >= 2 && (login.indexOf(qName) !== -1 || nickL.indexOf(qName) !== -1);
              if (!codeHit && !nameHit) continue;
              results.push({
                code,
                name: name || code,
                trophies: (acc.trophies | 0),
                activity: 'offline',
                online: false,
                avatarId: acc.avatarId ? String(acc.avatarId).slice(0, 32) : 'init',
                avatarCustom: (typeof acc.avatarCustom === 'string' && acc.avatarId === 'custom')
                  ? acc.avatarCustom.slice(0, 49152) : ''
              });
              seenCodes.add(code);
              if (results.length >= 20) break;
            }
          } catch (_) {}
          finishSearch();
        }).catch(() => finishSearch());
        return true;
      }
      finishSearch();
      return true;
    }
    send(ws, { type: 'presence_search_result', q: raw.slice(0, 24), results });
    return true;
  }
  if (type === 'presence_activity') {
    if (ws._friendCode && presence.has(ws._friendCode)) {
      const p = presence.get(ws._friendCode);
      p.activity = String(data.activity || 'online').slice(0, 32);
      p.ts = Date.now();
    }
    return true;
  }
  if (type === 'social_send') {
    const to = String(data.to || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
    if (!to) {
      send(ws, { type: 'social_result', ok: false, reason: 'bad_target' });
      return true;
    }
    const fromCode = ws._friendCode || String(data.from || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
    const msgType = String(data.msgType || data.socialType || 'message').slice(0, 40);
    const payload = (data.payload && typeof data.payload === 'object') ? data.payload : {};
    // Display trophies from server presence / store — not client claim
    let socialTrophies = 0;
    try {
      const live = fromCode && presence.get(fromCode);
      if (live && typeof live.trophies === 'number') socialTrophies = live.trophies | 0;
    } catch (_) {}
    const out = Object.assign({}, payload, {
      type: msgType, code: fromCode, from: fromCode,
      name: String(data.name || payload.name || 'Игрок').slice(0, 24),
      trophies: socialTrophies | 0,
      activity: String(data.activity || payload.activity || 'online').slice(0, 32),
      via: 'ws', ts: Date.now()
    });
    if (payload.room) out.room = String(payload.room).slice(0, 12);
    if (payload.reason) out.reason = String(payload.reason).slice(0, 40);

    const target = presence.get(to);
    if (target && target.ws && target.ws.readyState === 1) {
      send(target.ws, { type: 'social_msg', msg: out });
      send(ws, { type: 'social_result', ok: true, to, msgType, delivered: true });
      return true;
    }
    const queueable = /^(friend_req|friend_req_cancel|friend_accept|friend_decline|friend_remove|friend_req_ack|challenge|challenge_cancel|challenge_decline|challenge_accept)$/.test(msgType);
    if (queueable) {
      if (!pendingSocial.has(to)) pendingSocial.set(to, []);
      const box = pendingSocial.get(to);
      if (msgType === 'friend_req' || msgType === 'friend_req_cancel') {
        for (let i = box.length - 1; i >= 0; i--) {
          if (box[i].type === 'friend_req' && box[i].from === fromCode) box.splice(i, 1);
        }
      }
      if (msgType !== 'friend_req_cancel') box.push(out);
      if (box.length > 30) box.splice(0, box.length - 30);
      if (store) store.setSocial(to, box).catch(() => {});
      send(ws, { type: 'social_result', ok: true, to, msgType, delivered: false, queued: true });
      return true;
    }
    send(ws, { type: 'social_result', ok: false, reason: 'offline', to });
    return true;
  }

  return false;
}

module.exports = { handlePresenceSocial };
