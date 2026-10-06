/**
 * Block Puzzle — js/04-profile-friends/10-guest-mode-sync.js
 * Guest-mode gating (IP/device), guest progress sync to server.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
/** When true, entry gate shows × to dismiss (guest already active — just cancel login/register). */
let entryGateDismissible = false;
/** When true, «Играть гостем» is allowed (ONLY first visit). Never from profile. */
let entryGateShowGuest = false;

/** Device once registered/logged in — no more guest accounts until account delete. */
function deviceHadBoundAccount() {
  try { return localStorage.getItem('bp_device_had_account') === '1'; } catch (_) { return false; }
}
function markDeviceHadBoundAccount() {
  try { localStorage.setItem('bp_device_had_account', '1'); } catch (_) {}
}
function clearDeviceHadBoundAccount() {
  try { localStorage.removeItem('bp_device_had_account'); } catch (_) {}
}
/** Server device binding state (survives browser wipe; not bypassable via VPN). */
let _ipGuestBlocked = false;      // cannot CREATE a new guest
let _ipCanResumeGuest = false;    // can CONTINUE previous device guest
let _ipGuestProgress = null;      // snapshot from server
let _ipHasRealAccount = false;
function ipBlocksGuest() {
  return !!_ipGuestBlocked;
}
function ipCanResumeGuest() {
  return !!_ipCanResumeGuest;
}
function getIpGuestProgress() {
  return _ipGuestProgress;
}
/**
 * Ask server whether guest is allowed / resumable for this device id.
 */
async function refreshGuestAllowedFromServer() {
  try {
    try {
      const did = getDeviceId();
      if (typeof persistDeviceId === 'function') persistDeviceId(did);
    } catch (_) {}
    const { ok, data } = await apiFetch('/api/auth/guest-allowed');
    if (ok && data) {
      if (data.deviceId && typeof persistDeviceId === 'function') {
        try { persistDeviceId(String(data.deviceId)); } catch (_) {}
      }
      // Real registered account only — never treat "bound" guest mark as registered
      const hasReal = !!(data.hasAccount);
      _ipHasRealAccount = hasReal;
      // Server canResume is authoritative for guest continue
      _ipCanResumeGuest = !hasReal && !!(data.canResumeGuest);
      _ipGuestProgress = (_ipCanResumeGuest && data.guestProgress) ? data.guestProgress : null;

      if (hasReal) {
        _ipGuestBlocked = true;
        _ipCanResumeGuest = false;
        _ipGuestProgress = null;
        markDeviceHadBoundAccount();
        try { persistGuestOk(false); } catch (_) {}
        return false;
      }

      try { clearDeviceHadBoundAccount(); } catch (_) {}

      // Persist guest session flag when server says we can resume
      if (_ipCanResumeGuest) {
        try { persistGuestOk(true); } catch (_) {}
      }

      // guestAllowed=false only blocks NEW guest create, not resume
      if (data.guestAllowed === false && !_ipCanResumeGuest) {
        _ipGuestBlocked = true;
        return false;
      }
      _ipGuestBlocked = false;
      return true;
    }
  } catch (_) {}
  // Network fail: keep local guest session if present
  try {
    if (localStorage.getItem('bp_guest_ok') === '1' || readGuestOkCookie()) {
      _ipCanResumeGuest = true;
      return true;
    }
  } catch (_) {}
  return !deviceHadBoundAccount();
}
/** Apply server-stored guest progress into local state (after browser wipe resume). */
function applyGuestProgressSnapshot(snap) {
  if (!snap || typeof snap !== 'object') return;
  try {
    if (typeof snap.trophies === 'number') {
      trophies = Math.max(0, snap.trophies | 0);
      localStorage.setItem('bp_trophies', String(trophies));
    }
    if (typeof snap.diamonds === 'number') {
      diamonds = Math.max(0, snap.diamonds | 0);
      localStorage.setItem('bp_diamonds', String(diamonds));
    }
    if (typeof snap.best === 'number') {
      best = Math.max(0, snap.best | 0);
      localStorage.setItem('bp_best', String(best));
    }
    if (Array.isArray(snap.ownedSkins) && snap.ownedSkins.length) {
      ownedSkins = snap.ownedSkins.slice();
      try { localStorage.setItem('bp_skins_owned', JSON.stringify(ownedSkins)); } catch (_) {}
    }
    if (Array.isArray(snap.ownedBoards) && snap.ownedBoards.length) {
      ownedBoards = snap.ownedBoards.slice();
      try { localStorage.setItem('bp_boards_owned', JSON.stringify(ownedBoards)); } catch (_) {}
    }
    if (snap.skinId) {
      equippedSkinId = snap.skinId;
      try {
        localStorage.setItem('bp_skin_equipped', snap.skinId);
        localStorage.setItem('bp_skin', snap.skinId);
      } catch (_) {}
    }
    if (snap.boardId) {
      equippedBoardId = snap.boardId;
      try {
        localStorage.setItem('bp_board_equipped', snap.boardId);
        localStorage.setItem('bp_board', snap.boardId);
      } catch (_) {}
    }
    if (typeof snap.nick === 'string' && snap.nick) {
      myNickname = snap.nick;
      try { localStorage.setItem('bp_nickname', snap.nick); } catch (_) {}
    }
    if (typeof snap.status === 'string') {
      myStatus = snap.status;
      try { localStorage.setItem('bp_status', snap.status); } catch (_) {}
    }
    if (typeof snap.avatarId === 'string') {
      myAvatarId = snap.avatarId;
      try { localStorage.setItem('bp_avatar_id', snap.avatarId); } catch (_) {}
    }
    if (typeof snap.avatarCustom === 'string') {
      myAvatarCustom = snap.avatarCustom;
      try { localStorage.setItem('bp_avatar_custom', snap.avatarCustom); } catch (_) {}
    }
    if (snap.friendCode) {
      myFriendCode = String(snap.friendCode).toUpperCase();
      try { localStorage.setItem('bp_my_code', myFriendCode); } catch (_) {}
    }
    if (Array.isArray(snap.friends)) {
      try { mergeFriendsFromServer(snap.friends); } catch (_) {
        friends = snap.friends.slice();
        try { localStorage.setItem('bp_friends', JSON.stringify(friends)); } catch (_) {}
      }
    }
    if (Array.isArray(snap.history)) {
      try { mergeHistoryFromServer(snap.history); } catch (_) {
        matchHistory = snap.history.slice();
        try { localStorage.setItem('bp_history', JSON.stringify(matchHistory)); } catch (_) {}
      }
    }
    if (snap.achievements && typeof snap.achievements === 'object') {
      try {
        achProgress = Object.assign({}, snap.achievements);
        localStorage.setItem('bp_ach', JSON.stringify(achProgress));
      } catch (_) {}
    }
    if (snap.botStars && typeof snap.botStars === 'object') {
      try {
        if (typeof botStars !== 'object' || !botStars) botStars = {};
        const incoming = snap.botStars;
        for (const id of Object.keys(incoming)) {
          if (!id) continue;
          const st = incoming[id];
          if (!st || typeof st !== 'object') continue;
          if (!botStars[id]) botStars[id] = {};
          if (st['60']) botStars[id]['60'] = true;
          if (st['120']) botStars[id]['120'] = true;
          if (st['180']) botStars[id]['180'] = true;
        }
        if (typeof saveBotStars === 'function') saveBotStars();
        else try { localStorage.setItem('bp_bot_stars', JSON.stringify(botStars)); } catch (_) {}
        try { if (typeof updateMenuStats === 'function') updateMenuStats(); } catch (_) {}
      } catch (_) {}
    }
    if (snap.classicSave && typeof snap.classicSave === 'object' && Array.isArray(snap.classicSave.grid)) {
      try {
        localStorage.setItem(typeof classicSaveStorageKey === 'function' ? classicSaveStorageKey() : 'bp_classic_save', JSON.stringify(snap.classicSave));
      } catch (_) {}
    }
    try {
      if (typeof renderShopGrid === 'function') renderShopGrid();
      if (typeof renderInvGrid === 'function') renderInvGrid();
      if (typeof renderShop === 'function') renderShop();
      if (typeof updateMenuStats === 'function') updateMenuStats();
    } catch (_) {}
  } catch (_) {}
}
/** Push current local guest progress to server (IP-bound). */
let _guestSyncInFlight = false;
let _guestSyncTimer = null;
let _guestSyncLastAt = 0;

function buildGuestProgressPayload(full) {
  const progress = snapshotGuestProgress();
  try {
    if (typeof myFriendCode === 'string' && myFriendCode) progress.friendCode = myFriendCode;
  } catch (_) {}
  // Skip heavy fields on frequent sync to avoid body limits / lag
  if (!full) {
    try { delete progress.avatarCustom; } catch (_) {}
    try { delete progress.history; } catch (_) {}
  }
  return progress;
}

async function syncGuestProgressToServer(opts) {
  opts = opts || {};
  if (authToken) return false;
  try {
    if (window._bpGuestSyncBlocked || window._bpAccountDeleted) return false;
  } catch (_) {}
  try {
    if (localStorage.getItem('bp_guest_ok') !== '1') return false;
  } catch (_) { return false; }
  if (_guestSyncInFlight && !opts.force) return false;
  const now = Date.now();
  if (!opts.force && now - _guestSyncLastAt < 2000) return false;
  _guestSyncInFlight = true;
  try {
    const progress = buildGuestProgressPayload(!!opts.full);
    const result = await apiFetch('/api/auth/guest-sync', {
      method: 'POST',
      body: { progress }
    });
    _guestSyncLastAt = Date.now();
    if (result && result.ok) {
      _ipCanResumeGuest = true;
      if (result.data && result.data.guestProgress) {
        _ipGuestProgress = result.data.guestProgress;
      }
      return true;
    }
    // Deleted guest identity — clear quietly (no "Аккаунт удалён" flash on boot)
    if (result && (result.status === 410 || (result.data && (result.data.error === 'account_deleted' || result.data.accountDeleted)))) {
      try { softClearDeadGuest('guest_sync_410'); } catch (_) {}
      return false;
    }
    // If not bound yet, claim guest slot with progress
    if (result && (result.status === 403 || result.status === 400)) {
      try {
        await apiFetch('/api/auth/guest-bind', { method: 'POST', body: { progress } });
        _guestSyncLastAt = Date.now();
        return true;
      } catch (_) {}
    }
    return false;
  } catch (_) {
    return false;
  } finally {
    _guestSyncInFlight = false;
  }
}

/** Fire-and-forget sync when tab closes (best-effort). */
function syncGuestProgressBeacon() {
  try {
    if (authToken) return;
    if (localStorage.getItem('bp_guest_ok') !== '1') return;
    const progress = buildGuestProgressPayload(true);
    const url = apiBase() + '/api/auth/guest-sync';
    const body = JSON.stringify({ progress });
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
      return;
    }
    // keepalive fetch fallback
    try {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true
      });
    } catch (_) {}
  } catch (_) {}
}

function scheduleGuestProgressSync() {
  try {
    if (_guestSyncTimer) return;
    _guestSyncTimer = setInterval(function () {
      try {
        if (authToken) return;
        if (window._bpGuestSyncBlocked || window._bpAccountDeleted) return;
        if (localStorage.getItem('bp_guest_ok') !== '1') return;
        syncGuestProgressToServer({ full: false }).catch(function () {});
      } catch (_) {}
    }, 15000);
    // Page hide / background
    if (!window._bpGuestSyncVisBound) {
      window._bpGuestSyncVisBound = true;
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
          syncGuestProgressBeacon();
          syncGuestProgressToServer({ force: true, full: true }).catch(function () {});
        }
      });
      window.addEventListener('pagehide', function () {
        syncGuestProgressBeacon();
      });
      window.addEventListener('beforeunload', function () {
        syncGuestProgressBeacon();
      });
    }
  } catch (_) {}
}
try { window.syncGuestProgressToServer = syncGuestProgressToServer; } catch (_) {}
try { window.scheduleGuestProgressSync = scheduleGuestProgressSync; } catch (_) {}
/**
 * «Играть гостем» only when:
 * - not logged in, AND
 * - not already a guest, AND
 * - device never had a real account (local), AND
 * - this IP is not bound on the server
 */
function hasLocalGuestSession() {
  try { if (window._bpAccountDeleted || window._bpGuestSyncBlocked) return false; } catch (_) {}
  try { if (localStorage.getItem('bp_guest_ok') === '1') return true; } catch (_) {}
  try { if (readGuestOkCookie()) return true; } catch (_) {}
  return false;
}

/** True when the player is currently in guest mode (not logged into a registered account). */
function isPlayingAsGuest() {
  try { if (authToken) return false; } catch (_) {}
  try { if (authAccount) return false; } catch (_) {}
  return hasLocalGuestSession() || !!(_ipCanResumeGuest && _ipGuestProgress);
}

/**
 * Warn before login from guest: guest progress will be wiped.
 * @returns {Promise<'register'|'continue'|'cancel'>}
 */
function confirmGuestLoginWipe() {
  return new Promise(function (resolve) {
    const modal = document.getElementById('guestLoginWarnModal');
    if (!modal) {
      // Fallback: binary confirm
      const ok = window.confirm(
        'Прогресс гостя будет безвозвратно удалён. Рекомендуем зарегистрироваться.\n\nOK — войти и удалить гостя\nОтмена — остаться'
      );
      resolve(ok ? 'continue' : 'cancel');
      return;
    }
    const regBtn = document.getElementById('guestLoginWarnRegister');
    const skipBtn = document.getElementById('guestLoginWarnSkip');
    const cancelBtn = document.getElementById('guestLoginWarnCancel');
    const backdrop = document.getElementById('guestLoginWarnBackdrop');

    function cleanup(result) {
      modal.classList.remove('visible');
      modal.hidden = true;
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
      if (regBtn) regBtn.onclick = null;
      if (skipBtn) skipBtn.onclick = null;
      if (cancelBtn) cancelBtn.onclick = null;
      if (backdrop) backdrop.onclick = null;
      document.removeEventListener('keydown', onKey);
      resolve(result);
    }
    function onKey(e) {
      if (e.key === 'Escape') cleanup('cancel');
    }
    if (regBtn) regBtn.onclick = function () { cleanup('register'); };
    if (skipBtn) skipBtn.onclick = function () { cleanup('continue'); };
    if (cancelBtn) cancelBtn.onclick = function () { cleanup('cancel'); };
    if (backdrop) backdrop.onclick = function () { cleanup('cancel'); };
    document.addEventListener('keydown', onKey);
    // Above entry-gate (z-index 100000) and auth form
    try { document.body.appendChild(modal); } catch (_) {}
    modal.hidden = false;
    modal.style.display = 'flex';
    modal.style.zIndex = '100060';
    modal.classList.add('visible');
    modal.setAttribute('aria-hidden', 'false');
    try { setTimeout(function () { if (regBtn) regBtn.focus(); }, 40); } catch (_) {}
  });
}

/** Current guest friend code to purge on login (if any). */
function getActiveGuestFriendCode() {
  try {
    if (typeof myFriendCode === 'string' && myFriendCode) {
      return String(myFriendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
    }
  } catch (_) {}
  try {
    const c = localStorage.getItem('bp_my_code');
    if (c) return String(c).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  } catch (_) {}
  try {
    if (_ipGuestProgress && _ipGuestProgress.friendCode) {
      return String(_ipGuestProgress.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
    }
  } catch (_) {}
  return '';
}

try { window.confirmGuestLoginWipe = confirmGuestLoginWipe; } catch (_) {}
try { window.isPlayingAsGuest = isPlayingAsGuest; } catch (_) {}
function shouldAllowGuestButton() {
  try { if (authToken) return false; } catch (_) {}
  // Absolute rule: any real account bound to this IP → never offer guest
  if (_ipHasRealAccount) return false;
  if (deviceHadBoundAccount()) return false;
  if (ipBlocksGuest()) return false;
  try { if (localStorage.getItem('bp_guest_ok') === '1') return false; } catch (_) {}
  return true;
}


