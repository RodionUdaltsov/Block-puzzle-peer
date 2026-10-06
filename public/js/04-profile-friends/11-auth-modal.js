/**
 * Block Puzzle — js/04-profile-friends/11-auth-modal.js
 * Auth modal: open/close, submit, logout, revoked sessions.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
function openAuthModal(mode) {
  authMode = mode === 'register' ? 'register' : 'login';
  // Guest (or not logged in): use entry gate; allow closing without recreating guest
  const isLoggedIn = !!(authToken && authAccount);
  if (!isLoggedIn) {
    try { closeAuthModal(); } catch (_) {}
    let guestOk = false;
    try { guestOk = localStorage.getItem('bp_guest_ok') === '1'; } catch (_) {}
    // From profile login/register: NEVER show guest buttons
    entryGateDismissible = true;
    entryGateShowGuest = false;
    try { showEntryGate({ dismissible: true, showGuest: false }); } catch (_) {}
    try { entryGateSetMode(authMode); } catch (_) {}
    try {
      const gb = document.getElementById('entryGateGuestBlock');
      if (gb) {
        gb.hidden = true;
        gb.setAttribute('hidden', '');
        gb.style.setProperty('display', 'none', 'important');
      }
      const warn = document.getElementById('entryGateGuestWarn');
      if (warn) {
        warn.hidden = true;
        warn.setAttribute('hidden', '');
        warn.style.setProperty('display', 'none', 'important');
      }
    } catch (_) {}
    try {
      setTimeout(() => document.getElementById('entryAuthLogin')?.focus(), 40);
    } catch (_) {}
    return;
  }
  // Logged in: secondary modal (rare path)
  const modal = document.getElementById('authModal');
  const nickField = document.getElementById('authNickField');
  const passConfirmField = document.getElementById('authPasswordConfirmField');
  const title = document.getElementById('authModalTitle');
  const submit = document.getElementById('authSubmit');
  const err = document.getElementById('authError');
  document.querySelectorAll('#authModal .auth-tab').forEach((tab) => {
    tab.classList.toggle('on', tab.getAttribute('data-auth-tab') === authMode);
  });
  if (nickField) nickField.hidden = authMode !== 'register';
  if (passConfirmField) passConfirmField.hidden = authMode !== 'register';
  if (title) title.textContent = authMode === 'register' ? 'Регистрация' : 'Вход';
  if (submit) submit.textContent = authMode === 'register' ? 'Создать аккаунт' : 'Войти';
  if (err) { err.hidden = true; err.textContent = ''; }
  const pass = document.getElementById('authPassword');
  if (pass) pass.setAttribute('autocomplete', authMode === 'register' ? 'new-password' : 'current-password');
  if (modal) {
    modal.hidden = false;
    modal.removeAttribute('hidden');
    modal.setAttribute('aria-hidden', 'false');
    modal.style.display = 'flex';
    modal.classList.add('visible');
  }
  try { setTimeout(() => document.getElementById('authLogin')?.focus(), 30); } catch (_) {}
}
// Expose for inline onclick / console
try { window.openAuthModal = openAuthModal; } catch (_) {}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) {
    modal.hidden = true;
    modal.setAttribute('hidden', '');
    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none';
    modal.classList.remove('visible');
  }
}
try { window.closeAuthModal = closeAuthModal; } catch (_) {}


/** Build guestProgress + preferredFriendCode for /api/auth/register (1:1 migrate). */
async function prepareRegisterGuestPayload() {
  // 1) Force-save current guest state to server (IP + DB)
  try { await refreshGuestAllowedFromServer(); } catch (_) {}
  try { await syncGuestProgressToServer({ force: true, full: true }); } catch (_) {}
  // 2) Snapshot live client state (active guest session)
  let hasLocalGuest = false;
  try { hasLocalGuest = localStorage.getItem('bp_guest_ok') === '1'; } catch (_) {}
  let gp = null;
  try { gp = collectGuestProgressForRegister(); } catch (_) { gp = null; }
  // 3) Active guest: always prefer live snapshot over empty IP
  if (hasLocalGuest) {
    const live = snapshotGuestProgress() || {};
    try {
      if (typeof myFriendCode === 'string' && myFriendCode) live.friendCode = myFriendCode;
      else {
        const ls = localStorage.getItem('bp_my_code');
        if (ls) live.friendCode = String(ls).toUpperCase();
      }
    } catch (_) {}
    try {
      live.diamonds = Math.max(0, (typeof diamonds === 'number' ? diamonds : 0) | 0);
    } catch (_) {}
    if (gp) {
      gp = Object.assign({}, gp, live);
      // Currencies: take max so we never drop live balance
      gp.diamonds = Math.max(
        typeof gp.diamonds === 'number' ? gp.diamonds : 0,
        typeof live.diamonds === 'number' ? live.diamonds : 0
      );
      gp.trophies = Math.max(
        typeof gp.trophies === 'number' ? gp.trophies : 0,
        typeof live.trophies === 'number' ? live.trophies : 0
      );
      gp.best = Math.max(
        typeof gp.best === 'number' ? gp.best : 0,
        typeof live.best === 'number' ? live.best : 0
      );
    } else {
      gp = live;
    }
    _ipGuestProgress = gp;
  } else if (!gp && _ipGuestProgress) {
    gp = _ipGuestProgress;
  }
  try { ensureMyFriendCode(); } catch (_) {}
  const fc = (gp && gp.friendCode)
    || (_ipGuestProgress && _ipGuestProgress.friendCode)
    || (typeof myFriendCode === 'string' ? myFriendCode : '')
    || (function () { try { return localStorage.getItem('bp_my_code') || ''; } catch (_) { return ''; } })();
  const preferredFriendCode = fc
    ? String(fc).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16)
    : '';
  if (gp && preferredFriendCode) gp.friendCode = preferredFriendCode;
  if (preferredFriendCode) {
    try {
      myFriendCode = preferredFriendCode;
      localStorage.setItem('bp_my_code', preferredFriendCode);
    } catch (_) {}
  }
  return { guestProgress: gp, preferredFriendCode: preferredFriendCode || undefined };
}

async function submitAuthForm(e) {
  if (e) e.preventDefault();
  const login = (document.getElementById('authLogin')?.value || '').trim();
  const password = document.getElementById('authPassword')?.value || '';
  const nick = (document.getElementById('authNick')?.value || '').trim();
  const passwordConfirm = (document.getElementById('authPasswordConfirm')?.value || '');
  const err = document.getElementById('authError');
  const submit = document.getElementById('authSubmit');
  if (err) { err.hidden = true; err.textContent = ''; }
  if (authMode === 'register') {
    if (password.length < 6) {
      if (err) { err.textContent = 'Пароль: минимум 6 символов'; err.hidden = false; }
      return;
    }
    if (password !== passwordConfirm) {
      if (err) { err.textContent = 'Пароли не совпадают'; err.hidden = false; }
      return;
    }
  }
  // Capture guest state BEFORE any auth (must not change until user confirms wipe)
  const wasGuestOnLogin = (authMode === 'login' && isPlayingAsGuest());
  const guestCodePending = wasGuestOnLogin ? getActiveGuestFriendCode() : '';
  if (submit) submit.disabled = true;
  showAuthLoading(
    authMode === 'register' ? 'Создаём аккаунт…' : 'Входим в аккаунт…',
    authMode === 'register' ? 'Регистрация на сервере…' : 'Проверка данных…'
  );
  try {
    // ── Guest login: check credentials ONLY (no session / no wipe) ──
    if (authMode === 'login' && wasGuestOnLogin) {
      const check = await apiFetch('/api/auth/check-login', {
        method: 'POST',
        body: { login, password }
      });
      if (!check.ok || !check.data || !check.data.ok) {
        hideAuthLoading();
        let msg = (check.data && (check.data.message || check.data.error)) || null;
        if (!msg) {
          if (check.networkError || check.status === 0) msg = 'Нет связи с сервером';
          else if (check.status === 401) msg = 'Неверный логин или пароль';
          else msg = 'Ошибка (код ' + check.status + ')';
        }
        if (msg === 'bad_credentials') msg = 'Неверный логин или пароль';
        if (err) { err.textContent = msg; err.hidden = false; }
        return;
      }
      // Account exists — show warning. Server state is UNCHANGED (no session, no wipe).
      hideAuthLoading();
      const decision = await confirmGuestLoginWipe();
      if (decision === 'cancel') return;
      if (decision === 'register') {
        try {
          if (typeof openAuthModal === 'function') openAuthModal('register');
          else if (typeof entryGateSetMode === 'function') entryGateSetMode('register');
        } catch (_) {}
        return;
      }
      // ONLY after "Понятно, войти": real login + wipe guest
      try { window._bpAuthTransition = true; } catch (_) {}
      try {
        localStorage.removeItem('bp_guest_ok');
        if (typeof persistGuestOk === 'function') persistGuestOk(false);
        else { try { document.cookie = 'bp_guest_ok=; Max-Age=0; path=/; SameSite=Lax'; } catch (_2) {} }
      } catch (_) {}
      showAuthLoading('Входим в аккаунт…', 'Удаляем гостевой прогресс…');
      const loginBody = {
        login,
        password,
        wipeGuest: true,
        guestFriendCode: guestCodePending || undefined
      };
      const { ok, data, status, networkError } = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: loginBody
      });
      if (!ok || !data || !data.ok) {
        hideAuthLoading();
        try { window._bpAuthTransition = false; } catch (_) {}
        let msg = (data && (data.message || data.error)) || 'Не удалось войти';
        if (networkError || status === 0) msg = 'Нет связи с сервером';
        if (msg === 'bad_credentials') msg = 'Неверный логин или пароль';
        if (err) { err.textContent = msg; err.hidden = false; }
        return;
      }
      authToken = data.token;
      try { persistAuthToken(authToken); } catch (_) {}
      try {
        if (data.account && data.account.friendCode) {
          myFriendCode = String(data.account.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
          localStorage.setItem('bp_my_code', myFriendCode);
        }
      } catch (_) {}
      try {
        if (guestCodePending) {
          await apiFetch('/api/auth/wipe-guest', {
            method: 'POST',
            body: { guestFriendCode: guestCodePending }
          });
        }
      } catch (_) {}
      closeAuthModal();
      await finishAuthSuccess(data.account, 'login');
      return;
    }

    // ── Register or non-guest login ──
    const path = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const body = { login, password };
    if (authMode === 'register' && nick) body.nick = nick;
    if (authMode === 'register') {
      try {
        const prep = await prepareRegisterGuestPayload();
        if (prep.guestProgress) {
          body.guestProgress = prep.guestProgress;
          try { applyGuestProgressSnapshot(prep.guestProgress); } catch (_) {}
          _ipGuestProgress = prep.guestProgress;
        }
        if (prep.preferredFriendCode) body.preferredFriendCode = prep.preferredFriendCode;
      } catch (_) {}
    }
    if (authMode === 'login') {
      try { window._bpAuthTransition = true; } catch (_) {}
    }
    const { ok, data, status, networkError, contentType } = await apiFetch(path, { method: 'POST', body });
    if (!ok || !data || !data.ok) {
      hideAuthLoading();
      try { window._bpAuthTransition = false; } catch (_) {}
      let msg = (data && (data.message || data.error)) || null;
      if (!msg) {
        if (networkError || status === 0) {
          msg = 'Нет связи с сервером. Откройте игру через http://localhost:9000 (не file://) и убедитесь, что node server.js запущен.';
        } else if (status === 503) {
          msg = 'Сервис аккаунтов недоступен';
        } else if (status === 404 || (contentType && contentType.indexOf('json') === -1)) {
          msg = 'API недоступен (сервер отдаёт не JSON). Нужен Node-сервер (server.js), а не только статические файлы на хостинге.';
        } else if (status >= 500) {
          msg = 'Ошибка сервера (' + status + ')';
        } else {
          msg = 'Ошибка (код ' + status + ')';
        }
      }
      if (msg === 'accounts_unavailable') msg = 'Сервис аккаунтов недоступен';
      if (msg === 'server_error') msg = 'Ошибка сервера';
      if (msg === 'not_found') msg = 'API не найден — обновите страницу или перезапустите сервер';
      if (msg === 'bad_credentials') msg = 'Неверный логин или пароль';
      if (err) { err.textContent = msg; err.hidden = false; }
      try { console.warn('[auth]', status, data, contentType); } catch (_) {}
      return;
    }

    authToken = data.token;
    try { persistAuthToken(authToken); } catch (_) {}
    try {
      if (data.guestProgress && authMode === 'register') {
        _ipGuestProgress = data.guestProgress;
        applyGuestProgressSnapshot(data.guestProgress);
      }
      if (data.account && typeof data.account.diamonds === 'number') {
        diamonds = Math.max(0, data.account.diamonds | 0);
        try { localStorage.setItem('bp_diamonds', String(diamonds)); } catch (_) {}
      }
    } catch (_) {}
    closeAuthModal();
    await finishAuthSuccess(data.account, authMode);
  } catch (ex) {
    hideAuthLoading();
    try { window._bpAuthTransition = false; } catch (_) {}
    if (err) {
      err.textContent = 'Нет связи с сервером';
      err.hidden = false;
    }
  } finally {
    if (submit) submit.disabled = false;
  }
}

/**
 * Push EVERYTHING the account owns to the server right now (used before logout).
 * Cancels debounced syncs first so nothing fires later under a different identity.
 * @returns {Promise<boolean>} true when the server confirmed the save
 */
async function flushAccountProgressToServer() {
  if (!authToken) return true;
  if (!window._bpAccountLoaded) return true; // nothing was loaded → nothing of ours to push
  try { if (window._achSyncTimer) { clearTimeout(window._achSyncTimer); window._achSyncTimer = null; } } catch (_) {}
  try { if (window._historySyncTimer) { clearTimeout(window._historySyncTimer); window._historySyncTimer = null; } } catch (_) {}
  try {
    const ach = Object.assign({}, achProgress || {});
    if (typeof rankedBest === 'number' && rankedBest > (Number(ach.ranked_best_score) | 0)) ach.ranked_best_score = rankedBest | 0;
    const acc = await syncProfileToServer({
      history: Array.isArray(matchHistory) ? matchHistory.slice(0, 30) : [],
      achievements: ach,
      botStars: botStars || {},
      friends: Array.isArray(friends) ? friends.slice(0, 200) : [],
      best: typeof best === 'number' ? best : 0
    });
    return !!acc;
  } catch (_) {
    return false;
  }
}
try { window.flushAccountProgressToServer = flushAccountProgressToServer; } catch (_) {}

async function logoutAccount() {
  // Block the alive/session poll from treating logout as "account deleted"
  try { window._bpIntentionalLogout = true; } catch (_) {}
  try {
    if (typeof showAuthLoading === 'function') showAuthLoading('Сохраняем прогресс…');
  } catch (_) {}
  // 1) Save first. If the server cannot be reached, stay logged in: logging out now would
  //    erase the only copy of the unsynced progress (the local cache is wiped below).
  if (authToken) {
    let saved = false;
    try {
      saved = await Promise.race([
        flushAccountProgressToServer(),
        new Promise(function (r) { setTimeout(function () { r(false); }, 8000); })
      ]);
    } catch (_) { saved = false; }
    if (!saved) {
      try { if (typeof hideAuthLoading === 'function') hideAuthLoading(); } catch (_) {}
      try { window._bpIntentionalLogout = false; } catch (_) {}
      try {
        if (typeof showInfoToast === 'function') {
          showInfoToast('Выход отменён', 'Нет связи с сервером — прогресс ещё не сохранён. Попробуйте позже.', 'warn');
        }
      } catch (_) {}
      return;
    }
  }
  try {
    if (typeof showAuthLoading === 'function') showAuthLoading('Выходим из аккаунта…');
  } catch (_) {}
  try {
    if (authToken) await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch (_) {}
  authToken = null;
  authAccount = null;
  try { window._bpAccountLoaded = false; } catch (_) {}
  // Pending debounced syncs must not run under the logged-out (guest) identity
  try { if (window._achSyncTimer) { clearTimeout(window._achSyncTimer); window._achSyncTimer = null; } } catch (_) {}
  try { if (window._historySyncTimer) { clearTimeout(window._historySyncTimer); window._historySyncTimer = null; } } catch (_) {}
  // Drop the live socket: it is still registered under the old friend code (presence / cosmetics)
  try {
    if (typeof MatchClient !== 'undefined') {
      try { MatchClient._lastPresence = null; } catch (_) {}
      try { MatchClient._wantQueue = null; } catch (_) {}
      try { if (typeof MatchClient.disconnect === 'function') MatchClient.disconnect(); } catch (_) {}
    }
  } catch (_) {}
  try { persistAuthToken(null); } catch (_) {}
  try { persistGuestOk(false); } catch (_) {}
  try { sessionStorage.removeItem('bp_guest_shop_warned'); } catch (_) {}
  // Full wipe — next session starts clean (guest or new account)
  try { discardGuestProgressFully(); } catch (_) {}
  try {
    myNickname = 'Гость';
    localStorage.setItem('bp_nickname', 'Гость');
  } catch (_) {}
  try {
    if (typeof applyEquippedSkin === 'function') applyEquippedSkin();
    if (typeof applyEquippedBoard === 'function') applyEquippedBoard();
  } catch (_) {}
  try { updateAccountUI(); } catch (_) {}
  try { if (typeof refreshProfileUI === 'function') refreshProfileUI(); } catch (_) {}
  try { if (typeof updateMenuStats === 'function') updateMenuStats(); } catch (_) {}
  try { if (typeof renderFriends === 'function') renderFriends(false); } catch (_) {}
  try { if (typeof renderShop === 'function') renderShop(); } catch (_) {}
  try {
    if (typeof showScreen === 'function') showScreen('menu');
    else if (typeof navigateScreen === 'function') navigateScreen('menu');
  } catch (_) {}
  await new Promise((r) => setTimeout(r, 600));
  try { if (typeof hideAuthLoading === 'function') hideAuthLoading(); } catch (_) {}
  // After logout: account remains bound to IP → guest must stay hidden
  entryGateDismissible = false;
  try {
    if (typeof showAuthLoading === 'function') {
      showAuthLoading('Выход выполнен', 'Подготовка меню…');
    }
  } catch (_) {}
  try { await refreshGuestAllowedFromServer(); } catch (_) {}
  const showGuestAfterLogout = !_ipHasRealAccount && shouldAllowGuestButton();
  entryGateShowGuest = showGuestAfterLogout;
  await new Promise(function (r) { setTimeout(r, 400); });
  try { if (typeof hideAuthLoading === 'function') hideAuthLoading(); } catch (_) {}
  try {
    showEntryGate({
      dismissible: false,
      showGuest: showGuestAfterLogout
    });
    entryGateSetMode('login');
    try { bindEntryGate(); } catch (_) {}
  } catch (_) {}
  // Keep the flag a bit longer so in-flight alive polls cannot flash "Аккаунт удалён"
  setTimeout(function () {
    try { window._bpIntentionalLogout = false; } catch (_) {}
  }, 5000);
}


/**
 * Server (or session poll) says this account no longer exists / session revoked.
 * Clear all local auth and force the entry gate — no soft continue as the old user.
 */
/**
 * Guest identity gone from server — clear local guest quietly.
 * Never show the dramatic "Аккаунт удалён" overlay (that is for registered accounts).
 */
/**
 * Guest identity missing/expired on server.
 * NEVER force the login gate while the player is already in the game —
 * that was kicking users when opening Friends/Shop tabs.
 */
function softClearDeadGuest(reason) {
  try {
    if (authToken) return false; // registered — forceAuthRevoked handles
  } catch (_) {}
  try {
    if (window._bpSoftGuestClearBusy) return true;
    window._bpSoftGuestClearBusy = true;
  } catch (_) {}
  try {
    // CRITICAL: never re-upload guest progress when the server says the identity is dead.
    // The old path called scheduleGuestProgressSync() and resurrected deleted accounts.
    try {
      window._bpAccountDeleted = true;
      window._bpGuestSyncBlocked = true;
    } catch (_) {}
    try { persistGuestOk(false); } catch (_) {}
    try { localStorage.removeItem('bp_guest_ok'); } catch (_) {}
    try {
      _ipCanResumeGuest = false;
      _ipGuestProgress = null;
    } catch (_) {}
    // Wipe local friend code + progress so presence_register cannot push the dead code back
    try {
      if (typeof discardGuestProgressFully === 'function') {
        discardGuestProgressFully({ keepFriendCode: false });
      } else {
        try { myFriendCode = ''; localStorage.removeItem('bp_my_code'); } catch (_) {}
      }
    } catch (_) {}
    // Force entry gate — identity is gone on every device path
    try {
      entryGateShowGuest = true;
      entryGateDismissible = false;
      if (typeof showEntryGate === 'function') {
        showEntryGate({ dismissible: false, showGuest: true });
      }
      if (typeof entryGateSetMode === 'function') entryGateSetMode('login');
    } catch (_) {}
    try {
      if (typeof showInfoToast === 'function' && reason !== 'boot') {
        showInfoToast('Сессия', 'Гостевой прогресс сброшен', 'warn');
      }
    } catch (_) {}
  } finally {
    setTimeout(function () {
      try { window._bpSoftGuestClearBusy = false; } catch (_) {}
    }, 2000);
  }
  return true;
}

try { window.softClearDeadGuest = softClearDeadGuest; } catch (_) {}

async function forceAuthRevoked(reason) {
  reason = reason || 'account_deleted';
  // Intentional logout / clean boot must never show "Аккаунт удалён"
  try {
    if (window._bpIntentionalLogout) return;
    // Login/register in progress — ignore stale guest-code "not alive" kicks
    if (window._bpAuthTransition) return;
    // Boot / entry-gate loading — never flash delete over "Подготовка меню"
    if (window._bpBooting) {
      try { softClearDeadGuest('boot'); } catch (_) {}
      return;
    }
  } catch (_) {}
  // Guest-only identity death → hard local wipe + entry gate (no re-sync)
  try {
    if (!authToken && (reason === 'account_deleted' || reason === 'deleted')) {
      try { softClearDeadGuest(reason); } catch (_) {}
      return;
    }
  } catch (_) {}
  // Session expiry is not account deletion — soft clear without delete UX
  if (reason === 'session_expired' || reason === 'unauthorized') {
    try {
      authToken = null;
      authAccount = null;
      try { persistAuthToken(null); } catch (_) {}
    } catch (_) {}
    return;
  }
  // False alarm guard: if we still have a live session, do NOT show "Аккаунт удалён"
  // (common race: wiped guest code polled while logged into a real account)
  // Skip this guard when reason is explicit account_deleted — identity is gone.
  if (reason !== 'account_deleted' && reason !== 'deleted') {
    try {
      if (authToken && typeof apiFetch === 'function') {
        const tok = authToken;
        const res = await apiFetch('/api/me', { method: 'GET' });
        if (authToken === tok && res && res.ok && res.data && res.data.ok && res.data.account) {
          // Session is valid — ignore the spurious revoke
          try {
            if (res.data.account.friendCode) {
              myFriendCode = String(res.data.account.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
              localStorage.setItem('bp_my_code', myFriendCode);
            }
          } catch (_) {}
          return;
        }
      }
    } catch (_) {}
  }
  try {
    if (window._bpAuthRevokedBusy) return;
    window._bpAuthRevokedBusy = true;
  } catch (_) {}
  try {
    // Block any further guest-sync / resume of the deleted identity
    try {
      window._bpAccountDeleted = true;
      window._bpGuestSyncBlocked = true;
    } catch (_) {}
    authToken = null;
    authAccount = null;
    try { persistAuthToken(null); } catch (_) {}
    try { localStorage.removeItem('bp_auth_token'); } catch (_) {}
    try { localStorage.removeItem('bp_account'); } catch (_) {}
    // Wipe in-memory + local guest resume so "Продолжить гостем" cannot appear
    try {
      _ipCanResumeGuest = false;
      _ipGuestProgress = null;
      _ipHasRealAccount = false;
    } catch (_) {}
    try {
      localStorage.removeItem('bp_my_code');
      localStorage.removeItem('bp_guest_ok');
      try { if (typeof persistGuestOk === 'function') persistGuestOk(false); } catch (_) {}
      try { document.cookie = 'bp_guest_ok=; Max-Age=0; path=/'; } catch (_) {}
      localStorage.removeItem('bp_skins_owned');
      localStorage.removeItem('bp_skin_equipped');
      localStorage.removeItem('bp_boards_owned');
      localStorage.removeItem('bp_board_equipped');
      localStorage.removeItem('bp_skin');
      localStorage.removeItem('bp_board');
      localStorage.removeItem('bp_trophies');
      localStorage.removeItem('bp_diamonds');
      localStorage.removeItem('bp_best');
      localStorage.removeItem('bp_friends');
      localStorage.removeItem('bp_history');
      localStorage.removeItem('bp_ach');
      localStorage.removeItem('bp_bot_stars');
      localStorage.removeItem('bp_status');
      localStorage.removeItem('bp_avatar');
      localStorage.removeItem('bp_avatar_custom');
    } catch (_) {}
    try { myFriendCode = ''; } catch (_) {}
    try { trophies = 0; diamonds = 9999; best = 0; friends = []; matchHistory = []; } catch (_) {}
    try { achProgress = {}; botStars = {}; rankedBest = 0; } catch (_) {}
    try { clearAllLocalClassicSaves(); localStorage.removeItem('bp_ranked_best'); localStorage.removeItem('bp_fr_out'); } catch (_) {}
    try { window._bpAccountLoaded = false; } catch (_) {}
    try {
      if (typeof MatchClient !== 'undefined') {
        try { MatchClient._lastPresence = null; } catch (_) {}
        try { MatchClient._wantClose = true; } catch (_) {}
        try { MatchClient._wantQueue = null; } catch (_) {}
        try { if (typeof MatchClient.disconnect === 'function') MatchClient.disconnect(); } catch (_) {}
      }
    } catch (_) {}
    try { if (typeof closeAccountDeleteModal === 'function') closeAccountDeleteModal(); } catch (_) {}
    try { if (typeof navigateScreen === 'function') navigateScreen('menu'); } catch (_) {}
    try {
      if (typeof showAuthLoading === 'function') {
        showAuthLoading(
          reason === 'account_deleted' ? 'Аккаунт удалён' : 'Сессия завершена',
          'Все данные стёрты'
        );
      }
    } catch (_) {}
    // Ask server — residual device guest progress should already be purged
    try { await refreshGuestAllowedFromServer(); } catch (_) {}
    // Force no resume regardless of laggy server response
    try {
      _ipCanResumeGuest = false;
      _ipGuestProgress = null;
    } catch (_) {}
    await new Promise(function (r) { setTimeout(r, 400); });
    try { if (typeof hideAuthLoading === 'function') hideAuthLoading(); } catch (_) {}
    try {
      // Only offer a FRESH guest slot if device is free — never "continue"
      const canCreate = !_ipHasRealAccount
        && !(typeof deviceHadBoundAccount === 'function' && deviceHadBoundAccount())
        && !(typeof ipBlocksGuest === 'function' && ipBlocksGuest());
      showEntryGate({ dismissible: false, showGuest: !!canCreate });
      if (typeof entryGateSetMode === 'function') entryGateSetMode('login');
      if (typeof bindEntryGate === 'function') bindEntryGate();
      // Force guest plaque to "create" mode if visible
      try {
        const gb = document.getElementById('entryGateGuestBlock');
        if (gb && !gb.hidden) {
          gb.setAttribute('data-guest-mode', 'create');
          const strong = gb.querySelector('.entry-gate-btn-text strong');
          const small = gb.querySelector('.entry-gate-btn-text small');
          if (strong) strong.textContent = 'Играть гостем';
          if (small) small.textContent = 'Данные на сервере живут до 48 часов';
        }
      } catch (_) {}
    } catch (_) {}
    try {
      if (typeof showInfoToast === 'function') {
        showInfoToast('Аккаунт', 'Аккаунт удалён — все данные уничтожены', 'bad');
      }
    } catch (_) {}
  } finally {
    try { window._bpAuthRevokedBusy = false; } catch (_) {}
  }
}
try { window.forceAuthRevoked = forceAuthRevoked; } catch (_) {}
