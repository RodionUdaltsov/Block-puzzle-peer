/**
 * Block Puzzle — js/04-profile-friends/12-account-delete-confirm.js
 * Account deletion modal and generic confirm dialog.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
/** Open in-app modal to permanently delete server account (no native prompt/confirm). */
function openAccountDeleteModal() {
  if (!authToken) {
    try {
      if (typeof showInfoToast === 'function') showInfoToast('Аккаунт', 'Сначала войдите', 'bad');
    } catch (_) {}
    return;
  }
  const modal = document.getElementById('accountDeleteModal');
  const pw = document.getElementById('accountDeletePassword');
  const err = document.getElementById('accountDeleteError');
  if (!modal) {
    // Fallback if markup missing
    if (typeof bpConfirm === 'function') {
      bpConfirm({
        title: 'Удалить аккаунт?',
        text: 'Потребуется пароль. Действие необратимо.',
        okLabel: 'Продолжить',
        danger: true
      }).then(function (ok) { if (ok) openAccountDeleteModal(); });
    }
    return;
  }
  if (err) { err.hidden = true; err.textContent = ''; }
  if (pw) { pw.value = ''; }
  modal.hidden = false;
  modal.style.display = '';
  modal.classList.add('visible');
  modal.setAttribute('aria-hidden', 'false');
  try { setTimeout(function () { if (pw) pw.focus(); }, 60); } catch (_) {}
}
try { window.openAccountDeleteModal = openAccountDeleteModal; } catch (_) {}

function closeAccountDeleteModal() {
  const modal = document.getElementById('accountDeleteModal');
  if (!modal) return;
  modal.classList.remove('visible');
  modal.hidden = true;
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
  const pw = document.getElementById('accountDeletePassword');
  if (pw) pw.value = '';
  const err = document.getElementById('accountDeleteError');
  if (err) { err.hidden = true; err.textContent = ''; }
}
try { window.closeAccountDeleteModal = closeAccountDeleteModal; } catch (_) {}

async function submitAccountDelete() {
  const pwEl = document.getElementById('accountDeletePassword');
  const err = document.getElementById('accountDeleteError');
  const password = pwEl ? String(pwEl.value || '') : '';
  if (!password.length) {
    if (err) { err.hidden = false; err.textContent = 'Введите пароль аккаунта'; }
    try { if (pwEl) pwEl.focus(); } catch (_) {}
    return;
  }
  if (!authToken) {
    closeAccountDeleteModal();
    try {
      if (typeof showInfoToast === 'function') showInfoToast('Аккаунт', 'Сначала войдите', 'bad');
    } catch (_) {}
    return;
  }
  const confirmBtn = document.getElementById('accountDeleteConfirm');
  if (confirmBtn) confirmBtn.disabled = true;
  try {
    if (typeof showAuthLoading === 'function') showAuthLoading('Удаление аккаунта…');
  } catch (_) {}
  try {
    const { ok, data, status } = await apiFetch('/api/auth/delete', {
      method: 'POST',
      body: { password: password }
    });
    if (!ok || !data || !data.ok) {
      let msg = (data && (data.message || data.error))
        || (status === 403 ? 'Неверный пароль' : 'Не удалось удалить аккаунт');
      if (msg === 'password_required' || (data && data.error === 'password_required')) {
        msg = 'Введите пароль для удаления аккаунта';
      }
      if (msg === 'bad_password' || (data && data.error === 'bad_password')) {
        msg = 'Неверный пароль';
      }
      if (err) { err.hidden = false; err.textContent = msg; }
      try {
        if (typeof showInfoToast === 'function') showInfoToast('Аккаунт', msg, 'bad');
      } catch (_) {}
      return;
    }
    authToken = null;
    authAccount = null;
    try { persistAuthToken(null); } catch (_) {}
    try { persistGuestOk(false); } catch (_) {}
    try { sessionStorage.removeItem('bp_guest_shop_warned'); } catch (_) {}
    // Unlock guest on this device BEFORE discard (clean slate like first visit)
    clearDeviceHadBoundAccount();
    try { discardGuestProgressFully(); } catch (_) {}
    try {
      myNickname = 'Гость';
      localStorage.setItem('bp_nickname', 'Гость');
    } catch (_) {}
    closeAccountDeleteModal();
    try {
      if (typeof showScreen === 'function') showScreen('menu');
      else if (typeof navigateScreen === 'function') navigateScreen('menu');
    } catch (_) {}
    try { updateAccountUI(); } catch (_) {}
    try { if (typeof updateMenuStats === 'function') updateMenuStats(); } catch (_) {}
    try { if (typeof refreshProfileUI === 'function') refreshProfileUI(); } catch (_) {}
    try { if (typeof applyEquippedSkin === 'function') applyEquippedSkin(); } catch (_) {}
    try { if (typeof applyEquippedBoard === 'function') applyEquippedBoard(); } catch (_) {}
    // Keep loading overlay while preparing first-visit gate
    try {
      if (typeof showAuthLoading === 'function') {
        showAuthLoading('Аккаунт удалён', 'Подготовка экрана входа…');
      }
    } catch (_) {}
    await new Promise(function (r) { setTimeout(r, 500); });
    entryGateDismissible = false;
    authMode = 'login';
    // Blank slate: guest progress was merged into the account and is gone with it.
    // Never offer «Продолжить играть гостем» — only a fresh guest (or login/register).
    clearDeviceHadBoundAccount();
    _ipGuestBlocked = false;
    _ipCanResumeGuest = false;
    _ipGuestProgress = null;
    _ipHasRealAccount = false;
    try { persistGuestOk(false); } catch (_) {}
    try { persistAuthToken(null); } catch (_) {}
    authToken = null;
    authAccount = null;
    // Ask server: other accounts may still be bound to this IP
    try { await refreshGuestAllowedFromServer(); } catch (_) {}
    // Never resume deleted guest progress
    _ipCanResumeGuest = false;
    _ipGuestProgress = null;
    try { persistGuestOk(false); } catch (_) {}
    // Guest button ONLY if IP has zero real accounts left
    const canOfferGuest = !_ipHasRealAccount && !ipBlocksGuest();
    if (canOfferGuest) {
      clearDeviceHadBoundAccount();
      _ipGuestBlocked = false;
      entryGateShowGuest = true;
    } else {
      markDeviceHadBoundAccount();
      _ipGuestBlocked = true;
      entryGateShowGuest = false;
    }
    try { hideAuthLoading(); } catch (_) {}
    try {
      showEntryGate({ dismissible: false, showGuest: canOfferGuest });
      entryGateSetMode('login');
      try {
        const guestBlock = document.getElementById('entryGateGuestBlock');
        if (guestBlock && canOfferGuest) {
          guestBlock.setAttribute('data-guest-mode', 'create');
          const strong = guestBlock.querySelector('.entry-gate-btn-text strong');
          const small = guestBlock.querySelector('.entry-gate-btn-text small');
          if (strong) strong.textContent = 'Играть гостем';
          if (small) small.textContent = 'Чистый старт — прошлый прогресс удалён вместе с аккаунтом';
        } else if (guestBlock && !canOfferGuest) {
          guestBlock.hidden = true;
          guestBlock.setAttribute('hidden', '');
          guestBlock.style.setProperty('display', 'none', 'important');
        }
        const lead = document.querySelector('#entryGate .entry-gate-lead');
        if (lead) {
          lead.textContent = canOfferGuest
            ? 'Аккаунт удалён. Войди, зарегистрируйся или начни заново гостем'
            : 'Аккаунт удалён. Войди в существующий аккаунт или зарегистрируй новый';
        }
      } catch (_) {}
      try {
        const gb = document.getElementById('entryGateGuest');
        const cb = document.getElementById('entryGateGuestConfirm');
        const xb = document.getElementById('entryGateGuestCancel');
        if (gb) gb._egBound = false;
        if (cb) cb._egBound = false;
        if (xb) xb._egBound = false;
        bindEntryGate();
      } catch (_) {}
    } catch (_) {}
    try {
      if (typeof showInfoToast === 'function') showInfoToast('Аккаунт', 'Аккаунт удалён', 'ok');
    } catch (_) {}
  } catch (e) {
    if (err) { err.hidden = false; err.textContent = 'Нет связи с сервером'; }
    try {
      if (typeof showInfoToast === 'function') showInfoToast('Аккаунт', 'Нет связи с сервером', 'bad');
    } catch (_) {}
  } finally {
    if (confirmBtn) confirmBtn.disabled = false;
    try {
      if (typeof hideAuthLoading === 'function') hideAuthLoading();
    } catch (_) {}
  }
}
try { window.submitAccountDelete = submitAccountDelete; } catch (_) {}

/** Back-compat alias used by older onclick / delegation paths. */
function deleteAccount() {
  openAccountDeleteModal();
}
try { window.deleteAccount = deleteAccount; } catch (_) {}

/** Generic in-app confirm (Promise). Replaces native confirm() for destructive actions. */
function bpConfirm(opts) {
  opts = opts || {};
  return new Promise(function (resolve) {
    const modal = document.getElementById('bpConfirmModal');
    if (!modal) {
      // last-resort fallback
      resolve(window.confirm(opts.text || opts.title || 'Продолжить?'));
      return;
    }
    const title = document.getElementById('bpConfirmTitle');
    const text = document.getElementById('bpConfirmText');
    const okBtn = document.getElementById('bpConfirmOk');
    const cancelBtn = document.getElementById('bpConfirmCancel');
    const backdrop = document.getElementById('bpConfirmBackdrop');
    if (title) title.textContent = opts.title || 'Подтверждение';
    if (text) text.textContent = opts.text || '';
    if (okBtn) {
      okBtn.textContent = opts.okLabel || 'Да';
      okBtn.classList.toggle('danger-btn', !!opts.danger);
    }
    if (cancelBtn) cancelBtn.textContent = opts.cancelLabel || 'Отмена';

    function cleanup(result) {
      modal.classList.remove('visible');
      modal.hidden = true;
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
      if (okBtn) okBtn.onclick = null;
      if (cancelBtn) cancelBtn.onclick = null;
      if (backdrop) backdrop.onclick = null;
      document.removeEventListener('keydown', onKey);
      resolve(!!result);
    }
    function onKey(e) {
      if (e.key === 'Escape') cleanup(false);
      if (e.key === 'Enter') cleanup(true);
    }
    if (okBtn) okBtn.onclick = function () { cleanup(true); };
    if (cancelBtn) cancelBtn.onclick = function () { cleanup(false); };
    if (backdrop) backdrop.onclick = function () { cleanup(false); };
    document.addEventListener('keydown', onKey);
    modal.hidden = false;
    modal.style.display = '';
    modal.classList.add('visible');
    modal.setAttribute('aria-hidden', 'false');
    try { setTimeout(function () { if (okBtn) okBtn.focus(); }, 40); } catch (_) {}
  });
}
try { window.bpConfirm = bpConfirm; } catch (_) {}

(function bindAccountDeleteModal() {
  const closeBtn = document.getElementById('accountDeleteClose');
  const cancelBtn = document.getElementById('accountDeleteCancel');
  const backdrop = document.getElementById('accountDeleteBackdrop');
  const confirmBtn = document.getElementById('accountDeleteConfirm');
  const pw = document.getElementById('accountDeletePassword');
  if (closeBtn && !closeBtn._bpBound) {
    closeBtn._bpBound = true;
    closeBtn.addEventListener('click', closeAccountDeleteModal);
  }
  if (cancelBtn && !cancelBtn._bpBound) {
    cancelBtn._bpBound = true;
    cancelBtn.addEventListener('click', closeAccountDeleteModal);
  }
  if (backdrop && !backdrop._bpBound) {
    backdrop._bpBound = true;
    backdrop.addEventListener('click', closeAccountDeleteModal);
  }
  if (confirmBtn && !confirmBtn._bpBound) {
    confirmBtn._bpBound = true;
    confirmBtn.addEventListener('click', function () { submitAccountDelete(); });
  }
  if (pw && !pw._bpBound) {
    pw._bpBound = true;
    pw.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitAccountDelete();
      }
    });
  }
})();

