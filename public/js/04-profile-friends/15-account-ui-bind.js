/**
 * Block Puzzle — js/04-profile-friends/15-account-ui-bind.js
 * Account UI event binding.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
function bindAccountUI() {
  const bindBtn = document.getElementById('btnProfileBind');
  if (bindBtn && !bindBtn._authBound) {
    bindBtn._authBound = true;
    bindBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openAuthModal('login');
    });
  }
  const logoutBtn = document.getElementById('btnAccountLogout');
  if (logoutBtn && !logoutBtn._authBound) {
    logoutBtn._authBound = true;
    logoutBtn.addEventListener('click', () => logoutAccount());
  }
  const delBtn = document.getElementById('btnAccountDelete');
  if (delBtn && !delBtn._authBound) {
    delBtn._authBound = true;
    delBtn.addEventListener('click', () => deleteAccount());
  }
  const closeBtn = document.getElementById('authModalClose');
  if (closeBtn && !closeBtn._authBound) {
    closeBtn._authBound = true;
    closeBtn.addEventListener('click', closeAuthModal);
  }
  const backdrop = document.getElementById('authModalBackdrop');
  if (backdrop && !backdrop._authBound) {
    backdrop._authBound = true;
    backdrop.addEventListener('click', closeAuthModal);
  }
  const form = document.getElementById('authForm');
  if (form && !form._authBound) {
    form._authBound = true;
    form.addEventListener('submit', submitAuthForm);
  }
  // Only modal tabs — entry-gate tabs use data-entry-auth-tab and must NOT call openAuthModal
  document.querySelectorAll('#authModal .auth-tab').forEach((tab) => {
    if (tab._authBound) return;
    tab._authBound = true;
    tab.addEventListener('click', () => {
      openAuthModal(tab.getAttribute('data-auth-tab') === 'register' ? 'register' : 'login');
    });
  });
}

// Delegation: works even if profile DOM is re-rendered later
if (!window._authDelegateBound) {
  window._authDelegateBound = true;
  document.addEventListener('click', (e) => {
    const t = e.target && e.target.closest && e.target.closest('#btnProfileBind, #btnAccountLogout, #btnAccountDelete, #authModalClose, #authModal .auth-tab');
    if (!t) return;
    if (t.id === 'btnProfileBind') {
      e.preventDefault();
      openAuthModal('login');
    } else if (t.id === 'btnAccountLogout') {
      e.preventDefault();
      logoutAccount();
    } else if (t.id === 'btnAccountDelete') {
      e.preventDefault();
      deleteAccount();
    } else if (t.id === 'authModalClose') {
      closeAuthModal();
    } else if (t.closest && t.closest('#authModal') && t.classList && t.classList.contains('auth-tab')) {
      // Never treat entry-gate tabs as modal tabs (that was killing «Играть гостем»)
      openAuthModal(t.getAttribute('data-auth-tab') === 'register' ? 'register' : 'login');
    }
  }, true);
}

function scheduleAuthBind() {
  try { bindAccountUI(); } catch (e) { console.warn('bindAccountUI', e); }
  try { bindEntryGate(); } catch (e) { console.warn('bindEntryGate', e); }
  try {
    maybeShowEntryGate().catch(function (e) { console.warn('entryGate', e); });
  } catch (e) { console.warn('entryGate', e); }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', scheduleAuthBind);
} else {
  scheduleAuthBind();
}
window.addEventListener('load', () => {
  try { bindAccountUI(); } catch (_) {}
  try { bindEntryGate(); } catch (_) {}
});

/** Hook: after profile save, sync to cloud */
(function patchProfileSaveSync() {
  const btn = document.getElementById('btnProfileSave');
  if (!btn || btn._authSyncBound) return;
  btn._authSyncBound = true;
  btn.addEventListener('click', () => {
    setTimeout(() => { try { syncProfileToServer(); } catch (_) {} }, 50);
  });
})();


(function wireAuthRevokedWatcher() {
  function onRevoked(data) {
    try {
      if (!(data && (data.type === 'auth_revoked' || data.reason === 'account_deleted'))) return;
      // Guest / no session: soft path — never yank open tabs to login gate
      try {
        if (!authToken) {
          softClearDeadGuest(data.reason === 'account_deleted' ? 'session_check' : (data.reason || 'session_check'));
          return;
        }
      } catch (_) {}
      forceAuthRevoked(data.reason || 'account_deleted');
    } catch (_) {}
  }
  function tryWire() {
    if (typeof MatchClient === 'undefined' || typeof MatchClient.on !== 'function') {
      setTimeout(tryWire, 400);
      return;
    }
    try { MatchClient.on('auth_revoked', onRevoked); } catch (_) {}
    // Also catch generic messages if client routes by type field only
    try {
      MatchClient.on('message', function (msg) {
        if (msg && msg.type === 'auth_revoked') onRevoked(msg);
      });
    } catch (_) {}
  }
  tryWire();

  // Poll every 2.5s: account/guest gone from DB → force entry gate
  setInterval(function () {
    try {
      if (window._bpAuthRevokedBusy) return;
      if (window._bpIntentionalLogout) return;
      if (window._bpAuthTransition) return;
      if (window._bpBooting) return;
      // Only poll while we actually have an active identity (session or guest)
      let guestOk = false;
      try { guestOk = localStorage.getItem('bp_guest_ok') === '1'; } catch (_) {}
      const hasSession = !!(authToken || guestOk);
      if (!hasSession) return;

      // Prefer registered account friend code when logged in (never poll wiped guest code)
      let code = '';
      try {
        if (authToken && authAccount && authAccount.friendCode) {
          code = String(authAccount.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
        }
      } catch (_) {}
      if (!code && typeof myFriendCode !== 'undefined' && myFriendCode) {
        code = String(myFriendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
      }

      // Logged-in users: trust /api/me. Alive-by-code is only a guest safety net.
      if (authToken && typeof apiFetch === 'function') {
        const tok = authToken;
        const polledCode = code;
        apiFetch('/api/me', { method: 'GET' }).then(function (res) {
          try {
            if (window._bpIntentionalLogout || window._bpAuthTransition) return;
            if (!authToken || authToken !== tok) return;
            if (!res) return;
            if (res.status === 401 || res.status === 403 || (res.data && res.data.error === 'unauthorized')) {
              // Account row gone (deleted from DB) → full wipe + auto-logout everywhere
              const deleted = !!(res.data && (res.data.accountDeleted || res.data.error === 'account_deleted'));
              forceAuthRevoked(deleted ? 'account_deleted' : 'session_expired');
            }
          } catch (_) {}
        }).catch(function () {});
        // Optional: if we know account code, soft-check alive; ignore mismatches
        if (polledCode && authAccount && authAccount.friendCode) {
          const accCode = String(authAccount.friendCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
          if (polledCode === accCode) {
            apiFetch('/api/auth/alive?code=' + encodeURIComponent(polledCode), { method: 'GET' }).then(function (res) {
              try {
                if (window._bpIntentionalLogout || window._bpAuthTransition) return;
                if (!authToken) return;
                if (!res || !res.data) return;
                // Only kick if server says account is gone (hasAccount false & not alive)
                if (res.data.alive === false && res.data.hasAccount === false) {
                  forceAuthRevoked('account_deleted');
                }
              } catch (_) {}
            }).catch(function () {});
          }
        }
      } else if (code && typeof apiFetch === 'function') {
        // Guest-only alive check
        apiFetch('/api/auth/alive?code=' + encodeURIComponent(code), { method: 'GET' }).then(function (res) {
          try {
            if (window._bpIntentionalLogout || window._bpAuthTransition) return;
            if (authToken) return; // logged in mid-flight — ignore guest check
            if (!res || !res.data) return;
            if (res.data.alive === false) {
              try { softClearDeadGuest('alive_poll'); } catch (_) {
                forceAuthRevoked('account_deleted');
              }
            }
          } catch (_) {}
        }).catch(function () {});
      }
      try {
        if (window._bpBooting) { /* skip session_check during boot */ }
        else if (code && MatchClient && MatchClient.ws && MatchClient.ws.readyState === 1 && typeof MatchClient.send === 'function') {
          MatchClient.send({ type: 'session_check', friendCode: code });
        }
      } catch (_) {}
    } catch (_) {}
  }, 2500);
  // WS close 4001 → immediate kick
  try {
    if (typeof MatchClient !== 'undefined' && MatchClient.on) {
      MatchClient.on('close', function (ev) {
        try {
          if (window._bpIntentionalLogout || window._bpAuthTransition) return;
          if (ev && (ev.code === 4001 || ev.reason === 'account_deleted')) {
            if (!authToken) {
              softClearDeadGuest('session_check');
              return;
            }
            forceAuthRevoked('account_deleted');
          }
        } catch (_) {}
      });
    }
  } catch (_) {}
})();
