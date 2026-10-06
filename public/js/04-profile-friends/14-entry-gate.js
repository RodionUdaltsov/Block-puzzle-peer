/**
 * Block Puzzle — js/04-profile-friends/14-entry-gate.js
 * Entry gate (login / guest choice) flow.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
function entryGateSetMode(mode) {
  authMode = mode === 'register' ? 'register' : 'login';
  const title = document.getElementById('entryGateTitle');
  const lead = document.querySelector('#entryGate .entry-gate-lead');
  const nickField = document.getElementById('entryAuthNickField');
  const passConfirmField = document.getElementById('entryAuthPasswordConfirmField');
  const submit = document.getElementById('entryAuthSubmit');
  const err = document.getElementById('entryAuthError');
  const guestBlock = document.getElementById('entryGateGuestBlock');
  const warn = document.getElementById('entryGateGuestWarn');
  const closeBtn = document.getElementById('entryGateClose');
  if (err) { err.hidden = true; err.textContent = ''; }
  if (warn) warn.hidden = true;
  document.querySelectorAll('[data-entry-auth-tab]').forEach((tab) => {
    const on = tab.getAttribute('data-entry-auth-tab') === authMode;
    tab.classList.toggle('on', on);
  });
  if (title) title.textContent = 'Добро пожаловать';
  if (lead) {
    const canGuest = !authToken && !_ipHasRealAccount && (ipCanResumeGuest() || (!ipBlocksGuest() && shouldAllowGuestButton()));
    if (canGuest && (hasLocalGuestSession() || ipCanResumeGuest())) {
      lead.textContent = authMode === 'register'
        ? 'Создай аккаунт — весь гостевой прогресс перенесётся'
        : 'Войди в аккаунт или продолжай играть гостем';
    } else if (canGuest) {
      lead.textContent = authMode === 'register'
        ? 'Создай аккаунт — прогресс сохранится навсегда'
        : 'Войди в аккаунт или играй гостем';
    } else {
      lead.textContent = authMode === 'register'
        ? 'Создай аккаунт — прогресс сохранится навсегда'
        : 'Войди в аккаунт или зарегистрируйся';
    }
  }
  if (submit) submit.textContent = authMode === 'register' ? 'Создать аккаунт' : 'Войти';
  if (nickField) nickField.hidden = authMode !== 'register';
  if (passConfirmField) passConfirmField.hidden = authMode !== 'register';
  // Guest block:
  //  - CREATE: first visit / after account delete (entryGateShowGuest + allowed)
  //  - CONTINUE: local guest session already exists (bp_guest_ok) — keep progress
  // CREATE: first visit only (entryGateShowGuest + allowed)
  // CONTINUE: start gate only (entryGateShowGuest) + local guest OR IP-resumable guest
  // Profile openAuthModal sets entryGateShowGuest=false → no guest button at all
  // CREATE: only if IP never had real account AND never claimed guest slot
  // CONTINUE: if local/IP guest progress exists AND no real account on IP
  //           (ipBlocksGuest is OK for continue — it only means "no NEW guest")
  // Profile login/register (dismissible): never show guest plaque
  const fromProfileAuth = !!entryGateDismissible && !entryGateShowGuest;
  // CONTINUE: server canResume OR local guest session (not from profile login modal)
  const allowContinueGuest = !fromProfileAuth
    && !authToken
    && !_ipHasRealAccount
    && !(window._bpAccountDeleted || window._bpGuestSyncBlocked)
    && (ipCanResumeGuest() || hasLocalGuestSession());
  // CREATE: only brand-new device, not when resume is available
  const allowCreateGuest = !fromProfileAuth
    && !authToken
    && !_ipHasRealAccount
    && !allowContinueGuest
    && !ipBlocksGuest()
    && !!entryGateShowGuest
    && shouldAllowGuestButton();
  const showGuestBlock = allowContinueGuest || allowCreateGuest;
  if (guestBlock) {
    if (showGuestBlock) {
      guestBlock.hidden = false;
      guestBlock.removeAttribute('hidden');
      guestBlock.style.setProperty('display', 'flex', 'important');
      guestBlock.style.setProperty('visibility', 'visible', 'important');
      guestBlock.style.setProperty('opacity', '1', 'important');
      // Update button label
      try {
        const strong = guestBlock.querySelector('.entry-gate-btn-text strong');
        const small = guestBlock.querySelector('.entry-gate-btn-text small');
        if (allowContinueGuest) {
          if (strong) strong.textContent = 'Продолжить играть гостем';
          if (small) {
            small.textContent = hasLocalGuestSession()
              ? 'Вернуться в игру с текущим прогрессом'
              : 'Восстановить гостевой прогресс с этого устройства';
          }
          guestBlock.setAttribute('data-guest-mode', 'continue');
        } else {
          if (strong) strong.textContent = 'Играть гостем';
          if (small) small.textContent = 'Данные на сервере живут до 48 часов';
          guestBlock.setAttribute('data-guest-mode', 'create');
        }
      } catch (_) {}
      const warnEl = document.getElementById('entryGateGuestWarn');
      if (warnEl) {
        warnEl.hidden = true;
        warnEl.style.removeProperty('display');
        warnEl.style.removeProperty('visibility');
        warnEl.style.removeProperty('opacity');
      }
      // Hide «или» divider text nuance
      try {
        const orEl = guestBlock.querySelector('.entry-gate-or span');
        if (orEl) {
          orEl.textContent = allowContinueGuest
            ? 'или войди / зарегистрируйся (прогресс перенесётся)'
            : 'или войди / зарегистрируйся';
        }
      } catch (_) {}
    } else {
      guestBlock.hidden = true;
      guestBlock.setAttribute('hidden', '');
      guestBlock.style.setProperty('display', 'none', 'important');
      const warnEl = document.getElementById('entryGateGuestWarn');
      if (warnEl) {
        warnEl.hidden = true;
        warnEl.style.setProperty('display', 'none', 'important');
      }
    }
  }
  if (closeBtn) {
    if (entryGateDismissible) {
      closeBtn.hidden = false;
      closeBtn.removeAttribute('hidden');
    } else {
      closeBtn.hidden = true;
      closeBtn.setAttribute('hidden', '');
    }
  }
  const pw = document.getElementById('entryAuthPassword');
  if (pw) pw.setAttribute('autocomplete', authMode === 'register' ? 'new-password' : 'current-password');
  const pw2 = document.getElementById('entryAuthPasswordConfirm');
  if (pw2) {
    if (authMode === 'register') {
      pw2.setAttribute('required', '');
    } else {
      pw2.removeAttribute('required');
      pw2.value = '';
    }
  }
}
function entryGateShowAuth(mode) {
  entryGateSetMode(mode);
}
function entryGateShowChoice() {
  entryGateSetMode('login');
}
/** Close login/register overlay without touching guest or server account. */
function dismissEntryGate() {
  entryGateDismissible = false;
  hideEntryGate();
  try { updateAccountUI(); } catch (_) {}
  try { if (typeof refreshProfileUI === 'function') refreshProfileUI(); } catch (_) {}
}
let _entryGateHideTimer = null;
let _entryGateGen = 0;

function showEntryGate(opts) {
  opts = opts || {};
  const el = document.getElementById('entryGate');
  if (!el) return;
  // Cancel pending hide so it cannot wipe flags right after reopen (e.g. after account delete)
  if (_entryGateHideTimer) {
    clearTimeout(_entryGateHideTimer);
    _entryGateHideTimer = null;
  }
  _entryGateGen += 1;
  if (typeof opts.dismissible === 'boolean') entryGateDismissible = opts.dismissible;
  if (typeof opts.showGuest === 'boolean') entryGateShowGuest = opts.showGuest;
  // Real registered account on this IP → never show guest (create OR continue)
  if (_ipHasRealAccount) entryGateShowGuest = false;
  try { closeAuthModal(); } catch (_) {}
  entryGateSetMode(authMode || 'login');
  el.hidden = false;
  el.style.display = 'flex';
  el.setAttribute('aria-hidden', 'false');
  try { void el.offsetWidth; } catch (_) {}
  el.classList.add('visible');
  try { document.body.classList.add('entry-gate-open'); } catch (_) {}
  try { document.documentElement.classList.add('entry-gate-pending'); } catch (_) {}
  try { document.documentElement.classList.remove('entry-gate-booting'); } catch (_) {}
  // Re-apply guest visibility after paint (guards against stale style/hidden)
  try {
    const gen = _entryGateGen;
    setTimeout(function () {
      if (gen !== _entryGateGen) return;
      try { entryGateSetMode(authMode || 'login'); } catch (_) {}
    }, 50);
  } catch (_) {}
}
function hideEntryGate() {
  try { document.documentElement.classList.remove('entry-gate-booting'); } catch (_) {}
  const el = document.getElementById('entryGate');
  if (!el) return;
  el.classList.remove('visible');
  const genAtHide = _entryGateGen;
  if (_entryGateHideTimer) {
    clearTimeout(_entryGateHideTimer);
    _entryGateHideTimer = null;
  }
  _entryGateHideTimer = setTimeout(function () {
    _entryGateHideTimer = null;
    // If gate was reopened meanwhile, do not reset flags / hide it
    if (genAtHide !== _entryGateGen) return;
    if (el.classList.contains('visible')) return;
    el.hidden = true;
    el.style.display = 'none';
    el.setAttribute('aria-hidden', 'true');
    try { document.body.classList.remove('entry-gate-open'); } catch (_) {}
    try { document.documentElement.classList.remove('entry-gate-pending'); } catch (_) {}
    entryGateDismissible = false;
    // Do not force entryGateShowGuest=false here — shouldAllowGuestButton + open path control it
  }, 420);
}
/**
 * Guest account is created ONLY when the player explicitly chooses guest mode.
 * Always a clean slate (new friend code, default skins, nick «Гость»).
 */
/** Resume existing guest (local session or IP-bound server progress). */
async function resumeGuestMode() {
  try { showAuthLoading('Загрузка гостевого аккаунта…'); } catch (_) {}
  try {
    try { await refreshGuestAllowedFromServer(); } catch (_) {}
    // Prefer server snapshot (after browser wipe)
    if (_ipGuestProgress) {
      applyGuestProgressSnapshot(_ipGuestProgress);
    } else if (!hasLocalGuestSession()) {
      // Guest mark without progress — enter as clean guest with same IP bind
      try { discardGuestProgressFully(); } catch (_) {}
    }
    try {
      const progress = snapshotGuestProgress() || {};
      try { if (myFriendCode) progress.friendCode = myFriendCode; } catch (_) {}
      if (!progress.ts) progress.ts = Date.now();
      const { ok, data } = await apiFetch('/api/auth/guest-bind', { method: 'POST', body: { progress } });
      if (data && data.deviceId && typeof persistDeviceId === 'function') {
        try { persistDeviceId(String(data.deviceId)); } catch (_) {}
      }
      if (data && data.guestProgress) {
        try { applyGuestProgressSnapshot(data.guestProgress); } catch (_) {}
      }
      if (!ok && data && (data.bound || data.hasAccount) && !data.canResumeGuest) {
        _ipHasRealAccount = true;
        markDeviceHadBoundAccount();
        try {
          if (typeof showInfoToast === 'function') {
            showInfoToast('Аккаунт', (data && data.message) || 'Войдите в аккаунт', 'bad');
          }
        } catch (_) {}
        return;
      }
    } catch (_) {
      try {
        if (typeof showInfoToast === 'function') showInfoToast('Сеть', 'Нет связи с сервером', 'bad');
      } catch (_2) {}
      return;
    }
    try { persistGuestOk(true); } catch (_) {}
    try { ensureFriendPresence(true); } catch (_) {}
    await new Promise((r) => setTimeout(r, 500));
    try { if (typeof applyEquippedSkin === 'function') applyEquippedSkin(); } catch (_) {}
    try { if (typeof applyEquippedBoard === 'function') applyEquippedBoard(); } catch (_) {}
    try { updateAccountUI(); } catch (_) {}
    try { if (typeof refreshProfileUI === 'function') refreshProfileUI(); } catch (_) {}
    try { if (typeof updateMenuStats === 'function') updateMenuStats(); } catch (_) {}
    // Pull authoritative shop inventory after guest resume
    try {
      if (typeof MatchClient !== 'undefined' && MatchClient.cosmeticsGet) MatchClient.cosmeticsGet();
    } catch (_) {}
    try {
      if (typeof renderShopGrid === 'function') renderShopGrid();
      if (typeof renderInvGrid === 'function') renderInvGrid();
      if (typeof renderShop === 'function') renderShop();
    } catch (_) {}
    try { scheduleGuestProgressSync(); } catch (_) {}
    try { await syncGuestProgressToServer({ force: true, full: true }); } catch (_) {}
    try {
      setTimeout(function () {
        try {
          if (typeof MatchClient !== 'undefined' && MatchClient.cosmeticsGet) MatchClient.cosmeticsGet();
        } catch (_) {}
        try {
          if (typeof renderShopGrid === 'function') renderShopGrid();
          if (typeof renderInvGrid === 'function') renderInvGrid();
        } catch (_) {}
      }, 700);
    } catch (_) {}
    hideEntryGate();
  } finally {
    try { hideAuthLoading(); } catch (_) {}
  }
}

async function acceptGuestMode(opts) {
  opts = opts || {};
  // After account deletion — never resume old identity
  try {
    if (window._bpAccountDeleted || window._bpGuestSyncBlocked) {
      opts = Object.assign({}, opts, { resume: false });
      try { localStorage.removeItem('bp_guest_ok'); } catch (_) {}
      try { _ipCanResumeGuest = false; _ipGuestProgress = null; } catch (_) {}
    }
  } catch (_) {}
  // Resume path: local flag, server canResume, or explicit { resume: true }
  try {
    if (!window._bpAccountDeleted && !window._bpGuestSyncBlocked
        && (opts.resume || localStorage.getItem('bp_guest_ok') === '1' || ipCanResumeGuest())) {
      try { await resumeGuestMode(); } catch (_) {
        hideEntryGate();
        try { updateAccountUI(); } catch (_) {}
      }
      return;
    }
  } catch (_) {}
  try {
    const block = document.getElementById('entryGateGuestBlock');
    const mode = block && block.getAttribute('data-guest-mode');
    if (mode !== 'create') {
      try { await refreshGuestAllowedFromServer(); } catch (_) {}
      if (ipCanResumeGuest()) {
        await resumeGuestMode();
        return;
      }
    } else {
      // Fresh start: ignore any leftover IP guest snapshot
      _ipCanResumeGuest = false;
      _ipGuestProgress = null;
    }
  } catch (_) {}
  if (deviceHadBoundAccount() || ipBlocksGuest() || _ipHasRealAccount) {
    try {
      if (typeof showInfoToast === 'function') {
        showInfoToast('Аккаунт', 'На этом устройстве или сети уже был аккаунт — войдите или зарегистрируйтесь', 'bad');
      }
    } catch (_) {}
    try {
      entryGateShowGuest = false;
      entryGateSetMode(authMode || 'login');
    } catch (_) {}
    return;
  }
  try { showAuthLoading('Создаём гостевой аккаунт…'); } catch (_) {}
  try {
    try { discardGuestProgressFully(); } catch (_) {}
    // Device id must exist before bind
    try {
      const did = getDeviceId();
      if (typeof persistDeviceId === 'function') persistDeviceId(did);
    } catch (_) {}
    try { ensureMyFriendCode(); } catch (_) {}
    // Bind on server FIRST — bp_guest_ok only after success
    let bindOk = false;
    try {
      const progress = snapshotGuestProgress() || {};
      try { if (myFriendCode) progress.friendCode = myFriendCode; } catch (_) {}
      if (!progress.ts) progress.ts = Date.now();
      const { ok, data, status } = await apiFetch('/api/auth/guest-bind', { method: 'POST', body: { progress } });
      if (data && data.deviceId && typeof persistDeviceId === 'function') {
        try { persistDeviceId(String(data.deviceId)); } catch (_) {}
      }
      if (ok && data && data.ok !== false) {
        bindOk = true;
        _ipGuestBlocked = true;
        _ipCanResumeGuest = true;
        if (data.guestProgress) _ipGuestProgress = data.guestProgress;
        // Fresh guest after a deleted identity — allow normal play/sync again
        try {
          window._bpAccountDeleted = false;
          window._bpGuestSyncBlocked = false;
        } catch (_) {}
      } else if (data && (data.error === 'already_bound' || data.bound || data.hasAccount)) {
        if (data.canResumeGuest) {
          _ipCanResumeGuest = true;
          _ipGuestProgress = data.guestProgress || null;
          await resumeGuestMode();
          return;
        }
        _ipHasRealAccount = true;
        _ipGuestBlocked = true;
        markDeviceHadBoundAccount();
        try {
          if (typeof showInfoToast === 'function') {
            showInfoToast('Аккаунт', (data && data.message) || 'С этого устройства уже был аккаунт — войдите', 'bad');
          }
        } catch (_) {}
        entryGateShowGuest = false;
        try { entryGateSetMode(authMode || 'login'); } catch (_) {}
        return;
      } else {
        try {
          if (typeof showInfoToast === 'function') {
            showInfoToast('Сеть', (data && data.message) || ('Не удалось привязать устройство (' + (status || '?') + ')'), 'bad');
          }
        } catch (_) {}
        return;
      }
    } catch (e) {
      try {
        if (typeof showInfoToast === 'function') {
          showInfoToast('Сеть', 'Нет связи с сервером — гость без привязки недоступен', 'bad');
        }
      } catch (_) {}
      return;
    }
    if (!bindOk) return;
    try { persistGuestOk(true); } catch (_) {}
    // Identity is now fixed: register presence with the bound code right away.
    try { ensureFriendPresence(true); } catch (_) {}

    await new Promise((r) => setTimeout(r, 700));
    try { if (typeof applyEquippedSkin === 'function') applyEquippedSkin(); } catch (_) {}
    try { if (typeof applyEquippedBoard === 'function') applyEquippedBoard(); } catch (_) {}
    try { updateAccountUI(); } catch (_) {}
    try { if (typeof refreshProfileUI === 'function') refreshProfileUI(); } catch (_) {}
    try { if (typeof updateMenuStats === 'function') updateMenuStats(); } catch (_) {}
    try { if (typeof renderShop === 'function') renderShop(); } catch (_) {}
    try { if (typeof renderFriends === 'function') renderFriends(false); } catch (_) {}
    try { scheduleGuestProgressSync(); } catch (_) {}
    try { await syncGuestProgressToServer({ force: true, full: true }); } catch (_) {}
    hideEntryGate();
  } finally {
    try { hideAuthLoading(); } catch (_) {}
  }
}
/**
 * First visit: only the registration/login gate.
 * No guest account and no server account are loaded until the player chooses.
 * Returning guest (bp_guest_ok) or valid token may enter the game.
 */
async function maybeShowEntryGate() {
  function endBoot() {
    try { window._bpBooting = false; } catch (_) {}
  }
  if (authToken) {
    try { window._bpBooting = true; } catch (_) {}
    try { showAuthLoading('Загрузка аккаунта…'); } catch (_) {}
    try {
      const ok = await restoreSessionFromToken();
      if (ok) {
        await new Promise((r) => setTimeout(r, 600));
        hideEntryGate();
        endBoot();
        return;
      }
    } finally {
      try { hideAuthLoading(); } catch (_) {}
    }
  }
  // Always ask server first — admin may have deleted the account on this device
  try { window._bpBooting = true; } catch (_) {}
  try { showAuthLoading('Загрузка…', 'Подготовка меню'); } catch (_) {}
  try {
    await refreshGuestAllowedFromServer();
  } catch (_) {}
  // If device had a registered account (even deleted), never auto-enter as guest
  if (_ipHasRealAccount || ipBlocksGuest()) {
    try { persistGuestOk(false); } catch (_) {}
    entryGateShowGuest = false;
    entryGateDismissible = false;
    try { hideAuthLoading(); } catch (_) {}
    showEntryGate({ dismissible: false, showGuest: false });
    try { entryGateSetMode(authMode || 'login'); } catch (_) {}
    endBoot();
    return;
  }
  let guestOk = false;
  try { guestOk = localStorage.getItem('bp_guest_ok') === '1'; } catch (_) {}
  // Auto-resume guest like registered auto-login (no gate if progress/device allows)
  const canAutoGuest = !_ipHasRealAccount && !authToken
    && (ipCanResumeGuest() || hasLocalGuestSession() || guestOk);
  if (canAutoGuest) {
    try { hideAuthLoading(); } catch (_) {}
    hideEntryGate();
    try {
      if (typeof acceptGuestMode === 'function') {
        await acceptGuestMode({ silent: true, resume: true });
      } else {
        try { persistGuestOk(true); } catch (_) {}
        try { updateAccountUI(); } catch (_) {}
        try { scheduleGuestProgressSync(); } catch (_) {}
      }
    } catch (_) {
      try { updateAccountUI(); } catch (_) {}
    }
    // Keep booting flag briefly so in-flight alive polls cannot flash delete UX
    setTimeout(endBoot, 2500);
    return;
  }
  if (guestOk && !ipCanResumeGuest() && !hasLocalGuestSession()) {
    try { persistGuestOk(false); } catch (_) {}
  }
  // Create OR continue guest — never if a real account is bound to this IP
  const showGuest = !_ipHasRealAccount && (ipCanResumeGuest() || hasLocalGuestSession() || shouldAllowGuestButton());
  entryGateShowGuest = showGuest;
  entryGateDismissible = false;
  await new Promise(function (r) {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { setTimeout(r, 280); });
    });
  });
  try { hideAuthLoading(); } catch (_) {}
  showEntryGate({ dismissible: false, showGuest: showGuest });
  try { entryGateSetMode(authMode || 'login'); } catch (_) {}
  try {
    setTimeout(function () {
      try { entryGateSetMode(authMode || 'login'); } catch (_) {}
    }, 100);
  } catch (_) {}
  setTimeout(endBoot, 1500);
}


async function submitEntryAuthForm(e) {
  if (e) e.preventDefault();
  const loginEl = document.getElementById('entryAuthLogin');
  const passEl = document.getElementById('entryAuthPassword');
  const nickEl = document.getElementById('entryAuthNick');
  const err = document.getElementById('entryAuthError');
  const submit = document.getElementById('entryAuthSubmit');
  const login = loginEl ? String(loginEl.value || '').trim() : '';
  const password = passEl ? String(passEl.value || '') : '';
  const nick = nickEl ? String(nickEl.value || '').trim() : '';
  const passConfirmEl = document.getElementById('entryAuthPasswordConfirm');
  const passwordConfirm = passConfirmEl ? String(passConfirmEl.value || '') : '';
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
      hideAuthLoading();
      const decision = await confirmGuestLoginWipe();
      if (decision === 'cancel') return;
      if (decision === 'register') {
        try {
          if (typeof entryGateSetMode === 'function') entryGateSetMode('register');
          else if (typeof openAuthModal === 'function') openAuthModal('register');
        } catch (_) {}
        return;
      }
      // ONLY after confirm: real login + wipe guest
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
    const { ok, data, status, networkError } = await apiFetch(path, { method: 'POST', body });
    if (!ok || !data || !data.ok) {
      hideAuthLoading();
      try { window._bpAuthTransition = false; } catch (_) {}
      let msg = (data && (data.message || data.error)) || null;
      if (!msg) {
        if (networkError || status === 0) msg = 'Нет связи с сервером';
        else if (status === 503) msg = 'Сервис аккаунтов недоступен';
        else msg = 'Ошибка (код ' + status + ')';
      }
      if (msg === 'accounts_unavailable') msg = 'Сервис аккаунтов недоступен';
      if (msg === 'bad_credentials') msg = 'Неверный логин или пароль';
      if (err) { err.textContent = msg; err.hidden = false; }
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
    await finishAuthSuccess(data.account, authMode);
  } catch (ex) {
    hideAuthLoading();
    try { window._bpAuthTransition = false; } catch (_) {}
    if (err) { err.textContent = 'Нет связи с сервером'; err.hidden = false; }
  } finally {
    if (submit) submit.disabled = false;
  }
}

function bindEntryGate() {
  const guestBtn = document.getElementById('entryGateGuest');
  const confirmBtn = document.getElementById('entryGateGuestConfirm');
  const cancelBtn = document.getElementById('entryGateGuestCancel');
  const closeBtn = document.getElementById('entryGateClose');
  const form = document.getElementById('entryAuthForm');
  if (closeBtn && !closeBtn._egBound) {
    closeBtn._egBound = true;
    closeBtn.addEventListener('click', () => dismissEntryGate());
  }
  function showGuestWarn() {
    const warn = document.getElementById('entryGateGuestWarn');
    if (!warn) return;
    warn.hidden = false;
    warn.removeAttribute('hidden');
    warn.style.setProperty('display', 'block', 'important');
    warn.style.setProperty('visibility', 'visible', 'important');
    warn.style.setProperty('opacity', '1', 'important');
  }
  function hideGuestWarn() {
    const warn = document.getElementById('entryGateGuestWarn');
    if (!warn) return;
    warn.hidden = true;
    warn.setAttribute('hidden', '');
    warn.style.removeProperty('display');
    warn.style.removeProperty('visibility');
    warn.style.removeProperty('opacity');
  }
  // Always (re)bind guest controls
  if (guestBtn) {
    guestBtn._egBound = true;
    guestBtn.onclick = function (e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      const block = document.getElementById('entryGateGuestBlock');
      const mode = block && block.getAttribute('data-guest-mode');
      // Explicit create mode (e.g. after account delete) — never resume old progress
      if (mode === 'create') {
        showGuestWarn();
        return;
      }
      if (mode === 'continue' || hasLocalGuestSession() || ipCanResumeGuest()) {
        // Resume guest (local or from IP server snapshot)
        resumeGuestMode().catch(function (err) { console.warn('resumeGuest', err); });
        return;
      }
      // New guest — show warning first
      showGuestWarn();
    };
  }
  if (confirmBtn) {
    confirmBtn._egBound = true;
    confirmBtn.onclick = function (e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      acceptGuestMode().catch(function (err) { console.warn('acceptGuestMode', err); });
    };
  }
  if (cancelBtn) {
    cancelBtn._egBound = true;
    cancelBtn.onclick = function (e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      hideGuestWarn();
    };
  }
  if (form && !form._egBound) {
    form._egBound = true;
    form.addEventListener('submit', submitEntryAuthForm);
  }
  document.querySelectorAll('[data-entry-auth-tab]').forEach((tab) => {
    if (tab._egBound) return;
    tab._egBound = true;
    tab.addEventListener('click', () => {
      entryGateSetMode(tab.getAttribute('data-entry-auth-tab') === 'register' ? 'register' : 'login');
    });
  });
}

try {
  window.showEntryGate = showEntryGate;
  window.hideEntryGate = hideEntryGate;
  window.dismissEntryGate = dismissEntryGate;
  window.acceptGuestMode = acceptGuestMode;
  window.entryGateShowAuth = entryGateShowAuth;
  window.entryGateShowChoice = entryGateShowChoice;
} catch (_) {}
