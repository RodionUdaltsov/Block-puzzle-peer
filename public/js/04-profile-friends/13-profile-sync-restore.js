/**
 * Block Puzzle — js/04-profile-friends/13-profile-sync-restore.js
 * Profile sync to server and session restore from token.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
/** Push local profile fields to server (when logged in). Full progress bind. */
let _lastProfileSyncAt = 0;
let _lastProfileSyncSig = '';
async function syncProfileToServer(extra) {
  if (!authToken) {
    // Guest: persist progress on server by IP so it survives browser wipe
    try { await syncGuestProgressToServer(); } catch (_) {}
    return null;
  }
  // Never PATCH before the account has been loaded from the server: the in-memory state would be
  // device defaults, and the server replaces friends / history / achievements / bot stars wholesale.
  if (!window._bpAccountLoaded) {
    try {
      if (!window._bpRestoreRetry) {
        window._bpRestoreRetry = true;
        restoreSessionFromToken().finally(function () { window._bpRestoreRetry = false; });
      }
    } catch (_) { window._bpRestoreRetry = false; }
    return null;
  }
  try {
    const now = Date.now();
    // Soft throttle unless explicit extra fields (place rewards etc.)
    const forced = extra && typeof extra === 'object' && Object.keys(extra).length;
    if (!forced && _lastProfileSyncAt && (now - _lastProfileSyncAt) < 8000) return null;
    const body = Object.assign({
      nick: typeof myNickname !== 'undefined' ? myNickname : undefined,
      status: typeof myStatus !== 'undefined' ? myStatus : undefined,
      avatarId: typeof myAvatarId !== 'undefined' ? myAvatarId : undefined,
      trophies: typeof trophies === 'number' ? trophies : undefined,
      // diamonds intentionally omitted — server owns donation currency
      best: typeof best === 'number' ? best : undefined,
      skinId: typeof equippedSkinId !== 'undefined' ? equippedSkinId : undefined,
      boardId: typeof equippedBoardId !== 'undefined' ? equippedBoardId : undefined,
      ownedSkins: (typeof ownedSkins !== 'undefined' && Array.isArray(ownedSkins)) ? ownedSkins.slice(0, 64) : undefined,
      ownedBoards: (typeof ownedBoards !== 'undefined' && Array.isArray(ownedBoards)) ? ownedBoards.slice(0, 64) : undefined,
      friends: (typeof friends !== 'undefined' && Array.isArray(friends)) ? friends.slice(0, 200) : undefined,
      history: (typeof matchHistory !== 'undefined' && Array.isArray(matchHistory)) ? matchHistory.slice(0, 30) : undefined,
      achievements: (typeof achProgress === 'object' && achProgress) ? achProgress : undefined,
      botStars: (typeof botStars === 'object' && botStars) ? botStars : undefined,
      classicSave: (function () {
        try {
          const raw = localStorage.getItem(typeof classicSaveStorageKey === 'function' ? classicSaveStorageKey() : 'bp_classic_save');
          if (!raw) return undefined;
          const data = JSON.parse(raw);
          if (data && Array.isArray(data.grid) && data.grid.length >= 8) return data;
        } catch (_) {}
        return undefined;
      })()
    }, extra || {});
    // avatarCustom only when custom and either forced or not yet synced this session
    if (typeof myAvatarId !== 'undefined' && myAvatarId === 'custom' && myAvatarCustom) {
      if (forced || !window._bpAvatarCustomSynced) {
        body.avatarCustom = myAvatarCustom;
        window._bpAvatarCustomSynced = true;
      }
    } else if (!('avatarCustom' in (extra || {}))) {
      body.avatarCustom = '';
    }
    const sig = [
      body.nick, body.status, body.avatarId, body.trophies, body.diamonds, body.best,
      body.skinId, body.boardId,
      Array.isArray(body.ownedSkins) ? body.ownedSkins.length : 0,
      Array.isArray(body.friends) ? body.friends.length : 0
    ].join('|');
    if (!forced && sig === _lastProfileSyncSig && !body.avatarCustom) return null;
    _lastProfileSyncSig = sig;
    _lastProfileSyncAt = now;
    const { ok, data } = await apiFetch('/api/me', { method: 'PATCH', body });
    if (ok && data && data.account) {
      authAccount = data.account;
      return data.account;
    }
  } catch (_) {}
  return null;
}

async function restoreSessionFromToken() {
  if (!authToken) {
    try { authToken = loadAuthToken(); } catch (_) {}
  }
  if (!authToken) {
    updateAccountUI();
    return false;
  }
  try {
    let result = await apiFetch('/api/me');
    // Retry once on network / server error (refresh mid-match, brief outage)
    if (!result.ok && (result.networkError || result.status >= 500 || result.status === 0)) {
      await new Promise(function (r) { setTimeout(r, 450); });
      result = await apiFetch('/api/me');
    }
    if (result.ok && result.data && result.data.account) {
      applyServerAccount(result.data.account);
      try { persistAuthToken(authToken); } catch (_) {}
      markDeviceHadBoundAccount();
      updateAccountUI();
      return true;
    }
    // Wipe token only on explicit unauthorized (not on offline)
    if (result.status === 401 || result.status === 403) {
      authToken = null;
      authAccount = null;
      try { persistAuthToken(null); } catch (_) {}
    }
    updateAccountUI();
    return false;
  } catch (_) {
    updateAccountUI();
    return false;
  }
}
