/**
 * Block Puzzle — js/05-render-and-match-state/03-online-room-state.js
 * Online multiplayer state flags, net status, room lobby UI.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
// ========== Online multiplayer (MatchClient / rooms) ==========
let mpMode = false;
let mpRole = null; // 'host' | 'guest'
let mpRoomCode = null;
let mpPendingJoin = null;
let mpExpectedJoinCode = null;
let mpRemoteSessionId = null;
let mpOppName = 'Соперник';
try { window.mpOppAvatarId = window.mpOppAvatarId || null; } catch (_) {}
let mpReady = false;
let mpOppReady = false;
let mpOppConnected = false;
let mpLobbyDuration = 120;
let mpMatchStarting = false;
let vsIntroLock = false;
let mpJoinTimer = null;
let oppDisconnected = false;
let mpDisconnectTimer = null;
let rematchPending = false;
let mpFromMatchmaking = false;
/** 'ranked' | 'lobby' | null */
let mpGameSource = null;
let rematchIWant = false;
let rematchTheyWant = false;
/** Queued rematch offer while score-duel overlay is still covering the UI */
let pendingRematchOfferName = null;
/** Keep online link after match so rematch works from menu / delayed result UI */
let postMatchOnlineEligible = false;
/** Remote server id for post-match reconnect */

function setMpStatus(t) {
  const el = document.getElementById('mpStatus');
  if (el) el.textContent = t || '';
}

function clearMpJoinTimer() {
  if (mpJoinTimer) {
    clearTimeout(mpJoinTimer);
    mpJoinTimer = null;
  }
}

function failJoinRoom(reason, silentAlert) {
  clearMpJoinTimer();
  closeRoomLobby();
  hideRjToast(false);
  // Room gone / full — drop pending lobby invite for this room
  try {
    if (chPending && chPending.room) {
      const closed = String(chPending.room).toUpperCase();
      const tried = String(mpRoomCode || '').toUpperCase();
      if (!tried || closed === tried || (reason && /занят|не найден|отклон|закрыт|full|closed/i.test(String(reason)))) {
        chPending = null;
        try { hideChToast(false); } catch (_) {}
      }
    }
  } catch (_) {}
  const modal = document.getElementById('joinRoomModal');
  if (modal) modal.classList.remove('visible');
  const msg = reason || 'Комната не найдена';
  setMpStatus(msg);
  mpMode = false;
  mpRole = null;
  mpRoomCode = null;
  mpReady = false;
  mpOppReady = false;
  mpOppConnected = false;
  try { renderFriendRequests(); updateFriendsSectionCounts(); } catch (_) {}
  if (!silentAlert) {
    try { SFX.bad && SFX.bad(); } catch (_) {}
  }
}

function mpIsLinked() {
  try {
    if (roomMatchMode || BPState.roomMatchMode) return true;
    if (typeof MatchClient !== "undefined" && MatchClient.connected) return true;
  } catch (_) {}
  return false;
}











function destroyMp() {
  clearMpJoinTimer();
  const closedRoom = mpRoomCode;
  try { stopLobbyPing(); } catch (_) {}
  try {
    if (typeof MatchClient !== 'undefined') {
      MatchClient.leavePrivate();
      if (!(roomMatchMode || BPState.roomMatchMode)) {
        /* keep matchId for rematch if room mode ended */
      }
    }
  } catch (_) {}
  try {
    if (closedRoom) notifyChallengeCancelled(closedRoom, 'closed');
  } catch (_) {
    try { clearLobbyInviteWait(null, closedRoom); } catch (_) {}
  }
  mpMode = false; mpRole = null;
  mpRoomCode = null; mpReady = false; mpOppReady = false;
  mpOppConnected = false; mpMatchStarting = false;
  mpFromMatchmaking = false;
  mpGameSource = null;
  postMatchOnlineEligible = false;
  try { stopMatchmaking(true); } catch (_) {}
  try { mmFound = false; mmActive = false; } catch (_) {}
  vsIntroLock = false;
  rematchIWant = false;
  rematchTheyWant = false;
  rematchPending = false;
  pendingRematchOfferName = null;
  try { hideRmToast(false); } catch (_) {}
  try { hideRjToast(false); } catch (_) {}
  setMpStatus('');
  closeRoomLobby();
  try { renderFriendRequests(); updateFriendsSectionCounts(); } catch (_) {}
}

function roomSessionId(code) {
  return 'bp-room-' + String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** @deprecated server removed — always rejects */
let _netOk = null;
function setNetStatus(ok, detail) {
  _netOk = !!ok;
  const el = document.getElementById('netStatusPill');
  if (!el) return;
  if (ok) {
    // Online — no indicator
    el.textContent = '';
    el.title = '';
    el.removeAttribute('aria-label');
    el.className = 'net-status-pill ok';
  } else {
    const map = {
      'peer-unavailable': 'друг оффлайн',
      'network': 'нет связи',
      'server-error': 'ошибка сервера',
      'socket-error': 'ошибка сокета',
      'timeout': 'таймаут сети',
      'peer': 'нет связи',
      'disconnected': 'отключение',
      'network': 'network недоступен'
    };
    const label = detail ? (map[detail] || String(detail)) : 'оффлайн';
    // Visual: red ring only; error name in tooltip
    el.textContent = '';
    el.title = label;
    el.setAttribute('aria-label', 'Сеть: ' + label);
    el.className = 'net-status-pill bad';
  }
}

function isNetworkApiSupported() {
  // online removed — network not required
  return true;
}

function isSecureOk() {
  // WebSocket works on http:// and https://. legacy needed secure context —
  // we no longer use server, so allow plain HTTP (LAN IP, tunnels, etc.).
  try {
    const p = location.protocol;
    if (p === 'https:' || p === 'http:' || p === 'file:') return true;
  } catch (_) {}
  return true;
}

function showNetBanner(html, opts) {
  let el = document.getElementById('netBanner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'netBanner';
    el.className = 'net-banner';
    el.innerHTML = '<div class="nb-text"></div><div class="nb-actions"></div>';
    document.body.appendChild(el);
  }
  el.querySelector('.nb-text').innerHTML = html;
  const actions = el.querySelector('.nb-actions');
  actions.innerHTML = '';
  const dismiss = document.createElement('button');
  dismiss.className = 'ghost';
  dismiss.textContent = (typeof globalThis.t==='function'?globalThis.t('js.gotIt','Понятно'):'Понятно');
  dismiss.onclick = () => el.classList.remove('visible');
  actions.appendChild(dismiss);
  if (opts && opts.copyUrl) {
    const b = document.createElement('button');
    b.className = 'primary';
    b.textContent = (typeof globalThis.t==='function'?globalThis.t('js.copyLink','Скопировать ссылку'):'Скопировать ссылку');
    b.onclick = () => {
      try {
        copyText(location.href.split('#')[0]);
        b.textContent = (typeof globalThis.t==='function'?globalThis.t('js.copied','Скопировано'):'Скопировано');
      } catch (_) {}
    };
    actions.appendChild(b);
  }
  el.classList.add('visible');
}

function checkCrossPlatformReady() {
  if (typeof MatchClient === 'undefined') {
    showNetBanner('<strong>Клиент матчей не загрузился</strong><br/>Обнови страницу.');
    return false;
  }
  try { MatchClient.connect(); } catch (_) {}
  return true;
}

// iOS Safari: prevent pinch-zoom / double-tap zoom during play
(function iosGestureGuards() {
  document.addEventListener('gesturestart', (e) => { e.preventDefault(); }, { passive: false });
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
})();

function delayMs(ms) {
  return new Promise(r => setTimeout(r, ms));
}

let mpCreateGen = 0;
let mpJoinGen = 0;
/** Friend code expected after challenge — auto-admit without host toast */

let rjToastHideTimer = null;
let rjToastCountTimer = null;
function clearRjToastHideTimer() {
  if (rjToastHideTimer) { clearTimeout(rjToastHideTimer); rjToastHideTimer = null; }
  if (rjToastCountTimer) { clearInterval(rjToastCountTimer); rjToastCountTimer = null; }
}
function hideRjToast(animate) {
  const toast = document.getElementById('rjToast');
  if (!toast) return;
  clearRjToastHideTimer();
  if (animate === false) {
    toast.classList.remove('visible', 'out');
    return;
  }
  toast.classList.add('out');
  toast.classList.remove('visible');
  setTimeout(() => toast.classList.remove('out'), 400);
}

function showRjToast(req) {
  const toast = document.getElementById('rjToast');
  if (!toast || !req) return;
  clearRjToastHideTimer();
  const av = document.getElementById('rjToastAv');
  const name = document.getElementById('rjToastName');
  const meta = document.getElementById('rjToastMeta');
  if (av) av.textContent = (req.name || '?').slice(0, 2).toUpperCase();
  if (name) name.textContent = req.name || (typeof globalThis.t==='function'?globalThis.t('js.player','Игрок'):'Игрок');
  if (meta) {
    const parts = [];
    if (req.code) parts.push('код ' + req.code);
    if (req.trophies != null) parts.push('🏆 ' + req.trophies);
    parts.push('хочет войти');
    meta.textContent = parts.join(' · ');
  }
  toast.classList.remove('out');
  void toast.offsetWidth;
  toast.classList.add('visible');
  try { SFX.ui(); } catch (_) {}
  try { hapticTap(12); } catch (_) {}
  rjToastCountTimer = startToastCountdown('rjToastCountdown', 5, null);
  try { renderFriendRequests(); } catch (_) {}
  rjToastHideTimer = setTimeout(() => {
    rjToastHideTimer = null;
    if (null && mpPendingJoin === req) {
      try { declinePendingJoin('timeout'); } catch (_) { hideRjToast(true); }
    } else {
      hideRjToast(true);
    }
  }, 5000);
}






(function bindRjToast() {
  const acc = document.getElementById('rjToastAccept');
  const dec = document.getElementById('rjToastDecline');
  if (acc) acc.addEventListener('click', () => { try { hideRjToast(true); } catch (_) {} });
  if (dec) dec.addEventListener('click', () => { try { hideRjToast(true); } catch (_) {} });
})();
(function bindRjToastSwipe() {
  const toast = document.getElementById('rjToast');
  if (!toast || toast._bpSwipe) return;
  toast._bpSwipe = true;
  let startY = 0, startX = 0, dragging = false, dy = 0, dx = 0;
  const onStart = (e) => {
    if (e.target && e.target.closest && e.target.closest('button')) return;
    const t = e.touches ? e.touches[0] : e;
    startY = t.clientY; startX = t.clientX; dy = 0; dx = 0;
    dragging = true;
    toast.classList.add('dragging');
  };
  const onMove = (e) => {
    if (!dragging) return;
    const t = e.touches ? e.touches[0] : e;
    dy = t.clientY - startY; dx = t.clientX - startX;
    if (dx > 8 || dy < -8) {
      if (e.cancelable) e.preventDefault();
      const distX = Math.max(0, Math.min(dx, 200));
      const distY = Math.min(0, Math.max(dy, -120));
      toast.style.transform = 'translateX(' + distX + 'px) translateY(' + distY + 'px)';
      toast.style.opacity = String(Math.max(0.2, 1 - distX / 160 - Math.abs(distY) / 140));
    }
  };
  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    toast.classList.remove('dragging');
    if (dx > 64 || dy < -56) {
      try { declinePendingJoin('declined'); } catch (_) { hideRjToast(true); }
    } else {
      toast.style.transform = '';
      toast.style.opacity = '';
    }
    dy = 0; dx = 0;
  };
  toast.addEventListener('touchstart', onStart, { passive: true });
  toast.addEventListener('touchmove', onMove, { passive: false });
  toast.addEventListener('touchend', onEnd);
  toast.addEventListener('touchcancel', onEnd);
})();

(function bindChToast() {
  const a = document.getElementById('chBtnAccept');
  const d = document.getElementById('chBtnDecline');
  if (a) a.addEventListener('click', () => acceptChallenge());
  if (d) d.addEventListener('click', () => declineChallenge());
})();

function openRoomLobby() {
  const el = document.getElementById('roomLobby');
  if (!el) return;
  document.getElementById('lobbyCode').textContent = mpRoomCode || '————';
  document.getElementById('lobbyTitle').textContent = mpRole === 'host' ? (typeof globalThis.t==='function'?globalThis.t('js.yourRoom','Твоя комната'):'Твоя комната') : (typeof globalThis.t==='function'?globalThis.t('js.room','Комната'):'Комната');
  updateLobbyHostLabels();
  updateLobbyUI();
  el.classList.add('visible');
  startLobbyPing();
}
function updateLobbyHostLabels() {
  try {
    const meName = document.getElementById('lobbyMeName');
    const oppName = document.getElementById('lobbyOppName');
    const meHost = mpRole === 'host';
    if (meName) {
      meName.innerHTML = escapeHtmlLobby(myNickname || 'Ты') +
        (meHost ? ' <span class="lobby-host-badge">хост</span>' : '');
    }
    if (oppName && mpOppConnected) {
      const on = mpOppName || 'Соперник';
      oppName.innerHTML = escapeHtmlLobby(on) +
        (!meHost ? ' <span class="lobby-host-badge">хост</span>' : '');
    }
  } catch (_) {}
}
function escapeHtmlLobby(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
}

function closeRoomLobby() {
  const el = document.getElementById('roomLobby');
  if (el) el.classList.remove('visible');
  stopLobbyPing();
}

function updateLobbyUI() {
  const meState = document.getElementById('lobbyMeState');
  const meSlot = document.getElementById('lobbySlotMe');
  const oppName = document.getElementById('lobbyOppName');
  const oppState = document.getElementById('lobbyOppState');
  const oppSlot = document.getElementById('lobbySlotOpp');
  const readyBtn = document.getElementById('btnLobbyReady');
  const inviteBtn = document.getElementById('btnLobbyInvite');
  const hint = document.getElementById('lobbyHint');

  if (meState) meState.textContent = mpReady ? 'Готов ✓' : 'Не готов';
  if (meSlot) meSlot.classList.toggle('ready', !!mpReady);
  if (readyBtn) {
    readyBtn.textContent = mpReady ? (typeof globalThis.t==='function'?globalThis.t('js.notReady','Не готов'):'Не готов') : (typeof globalThis.t==='function'?globalThis.t('js.readyBtn','Готов'):'Готов');
    readyBtn.classList.toggle('is-ready', !!mpReady);
  }

  try { updateLobbyHostLabels(); } catch (_) {}
  if (mpOppConnected) {
    if (oppState) oppState.textContent = mpOppReady ? 'Готов ✓' : 'Не готов';
    if (oppSlot) {
      oppSlot.classList.remove('empty');
      oppSlot.classList.toggle('ready', !!mpOppReady);
    }
    // Room is full (2/2) — no more invites
    if (inviteBtn) inviteBtn.style.display = 'none';
    try { closeLobbyInviteModal(); } catch (_) {}
    try { updateLobbyPingUI(); } catch (_) {}
  } else {
    if (oppName) oppName.textContent = 'Ожидание игрока…';
    if (oppState) oppState.textContent = '—';
    if (oppSlot) {
      oppSlot.classList.add('empty');
      oppSlot.classList.remove('ready');
    }
    if (inviteBtn) inviteBtn.style.display = '';
    try {
      const op = document.getElementById('lobbyOppPing');
      const mp = document.getElementById('lobbyMePing');
      if (op) { op.textContent = ''; op.className = 'lobby-ping'; }
      if (mp) { mp.textContent = ''; mp.className = 'lobby-ping'; }
    } catch (_) {}
  }

  if (hint) {
    if (!mpOppConnected) {
      hint.textContent = 'Нажми «Пригласить» или скажи другу код комнаты';
    } else if (!mpReady || !mpOppReady) {
      hint.textContent = 'Оба игрока должны нажать «Готов»';
    } else {
      hint.textContent = 'Оба готовы — старт…';
    }
  }

  // Sync duration button selection (host only can change; guest is view-only)
  document.querySelectorAll('.lobby-dur').forEach(btn => {
    btn.classList.toggle('selected', parseInt(btn.dataset.sec, 10) === mpLobbyDuration);
    const hostOnly = mpRole === 'host';
    btn.disabled = !hostOnly;
    btn.setAttribute('aria-disabled', hostOnly ? 'false' : 'true');
    btn.classList.toggle('lobby-dur-locked', !hostOnly);
    btn.style.pointerEvents = hostOnly ? '' : 'none';
    btn.style.opacity = hostOnly ? '' : '0.55';
    btn.style.cursor = hostOnly ? '' : 'default';
  });

  tryStartMpMatch();
}

function tryStartMpMatch() {
  // Server starts the match when both players are ready (private_ready).
  // Kept as no-op for legacy callers.
}


let rjExpireTimer = null;
