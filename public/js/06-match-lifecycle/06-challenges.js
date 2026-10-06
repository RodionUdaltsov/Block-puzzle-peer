/**
 * Block Puzzle — js/06-match-lifecycle/06-challenges.js
 * Challenge accept/decline, lobby invites, join room flow.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
function handleIncomingChallenge(data, conn) {
  if (!data || !data.room) return;
  const room = String(data.room).toUpperCase();
  if (mpOppConnected && !vsActive) {
    try {
      const from = normalizeFriendCode(data.code || data.from);
      if (from) deliverSocialMessage(from, { type: 'challenge_decline', reason: 'busy', room });
    } catch (_) {}
    return;
  }
  // Same room already pending — refresh fields; still surface toast if it was hidden
  if (chPending && String(chPending.room || '').toUpperCase() === room) {
    chPending.conn = conn || chPending.conn;
    if (data.name) chPending.name = (data.name || chPending.name).toString().slice(0, 20);
    if (data.code) chPending.code = data.code;
    if (typeof data.trophies === 'number') chPending.trophies = data.trophies;
    try { renderFriendRequests(); updateFriendsSectionCounts(); } catch (_) {}
    // Toast may have auto-hidden after 5s while invite is still pending — show again
    try { showChToast(chPending); } catch (_) {}
    return;
  }
  showChToast({
    conn,
    room,
    name: (data.name || 'Игрок').toString().slice(0, 20),
    code: data.code || '',
    trophies: typeof data.trophies === 'number' ? data.trophies : null
  });
}

function doAcceptChallengeJoin(req) {
  if (!req || !req.room) return;
  // Accepting a friend challenge must leave ranked search / post-match ranked session
  try { stopMatchmaking(true); } catch (_) {}
  mmActive = false;
  mmFound = false;
  postMatchOnlineEligible = false;
  mpFromMatchmaking = false;
  mpGameSource = 'lobby';
  try {
    document.getElementById('versusResult')?.classList.remove('visible');
    document.getElementById('reviewBar')?.classList.remove('visible');
  } catch (_) {}
  try {
    const to = normalizeFriendCode(req.code);
    if (to) {
      deliverSocialMessage(to, {
        type: 'challenge_accept',
        code: myFriendCode,
        name: myNickname,
        room: req.room
      });
    }
  } catch (_) {}
  joinMpRoom(req.room, { fromChallenge: true });
}

let pendingJoinAfterForfeit = null;

function forfeitCurrentMatchForLobby() {
  if (!isReallyInLiveMatch()) {
    try { vsActive = false; } catch (_) {}
    return;
  }
  try {
    if (mpMode) {
      
    }
    endVersus({ forceLoss: true, reason: 'leave_for_lobby', silent: !!mpMode });
  } catch (_) {
    try { vsActive = false; } catch (_) {}
  }
}


/** True only during an actual live fight — not post-match result / rematch wait. */
function isReallyInLiveMatch() {
  try {
    if (BPState.matchEnded) return false;
    if (!vsActive) return false;
    // Result modal visible → match already over
    try {
      const r = document.getElementById('versusResult');
      if (r && r.classList.contains('visible')) return false;
    } catch (_) {}
    // Score duel / end freeze → ending, not live
    try {
      const mef = document.getElementById('matchEndFreeze');
      if (mef && mef.classList.contains('visible')) return false;
      const sd = document.getElementById('scoreDuelOverlay');
      if (sd && sd.classList.contains('visible')) return false;
    } catch (_) {}
    // Review / replay
    try {
      if (typeof replayMode !== 'undefined' && replayMode) return false;
    } catch (_) {}
    return true;
  } catch (_) {
    return !!(typeof vsActive !== 'undefined' && vsActive && !BPState.matchEnded);
  }
}

function openLeaveMatchConfirm(req) {
  leaveMatchChallengeReq = req;
  const ov = document.getElementById('leaveMatchConfirm');
  const msg = document.getElementById('leaveMatchConfirmMsg');
  if (msg) {
    const who = (req && req.name) ? req.name : 'игроку';
    msg.textContent = 'Сейчас идёт матч. Если принять приглашение от «' + who +
      '», текущий матч будет засчитан как поражение. Точно присоединиться?';
  }
  if (ov) ov.classList.add('visible');
}

function closeLeaveMatchConfirm() {
  const ov = document.getElementById('leaveMatchConfirm');
  if (ov) ov.classList.remove('visible');
  leaveMatchChallengeReq = null;
}

function acceptChallenge() {
  const req = chPending;
  if (!req || !req.room) return;
  // Only warn if a LIVE match is in progress — not after match_end / result screen
  if (isReallyInLiveMatch()) {
    openLeaveMatchConfirm(req);
    return;
  }
  // Stale flags after ended match — clear so join is clean
  try {
    vsActive = false;
    BPState.matchEnded = true;
    roomMatchMode = false;
    BPState.roomMatchMode = false;
    if (typeof MatchClient !== 'undefined') {
      MatchClient._skipAutoRejoin = true;
      MatchClient.leaveMatch && MatchClient.leaveMatch();
      MatchClient.freeMatch && MatchClient.freeMatch();
    }
  } catch (_) {}
  chPending = null;
  hideChToast(true);
  try { renderFriendRequests(); updateFriendsSectionCounts(); } catch (_) {}
  doAcceptChallengeJoin(req);
}

function declineChallenge() {
  const req = chPending;
  try {
    if (req && req.code) {
      const body = { room: req.room || null, code: myFriendCode || null, name: myNickname || null };
      if (typeof socialSend === 'function') {
        socialSend(req.code, 'challenge_decline', body);
      } else if (typeof MatchClient !== 'undefined' && MatchClient.socialSend) {
        MatchClient.socialSend(req.code, 'challenge_decline', body);
      } else if (typeof deliverSocialMessage === 'function') {
        deliverSocialMessage(req.code, Object.assign({ type: 'challenge_decline' }, body));
      }
    }
  } catch (_) {}
  chPending = null;
  try { hideChToast(false); } catch (_) {}
  try { renderFriendRequests(); updateFriendsSectionCounts(); } catch (_) {}
}

(function bindLeaveMatchConfirm() {
  const y = document.getElementById('btnLeaveMatchYes');
  const n = document.getElementById('btnLeaveMatchNo');
  if (y) y.addEventListener('click', () => {
    const req = leaveMatchChallengeReq || chPending;
    closeLeaveMatchConfirm();
    if (!req || !req.room) return;
    chPending = null;
    hideChToast(true);
    try { renderFriendRequests(); updateFriendsSectionCounts(); } catch (_) {}
    pendingJoinAfterForfeit = req;
    forfeitCurrentMatchForLobby();
  });
  if (n) n.addEventListener('click', () => {
    closeLeaveMatchConfirm();
    // stay in match, keep invite in list (don't decline) — user only cancelled leave
    // actually previous behavior declined; keep decline to free host "Ожидание"
    declineChallenge();
  });
})();

(function bindChToastSwipe() {
  const toast = document.getElementById('chToast');
  if (!toast || toast._bpSwipe) return;
  toast._bpSwipe = true;
  let startY = 0, startX = 0, dragging = false, dy = 0, dx = 0;
  const onStart = (e) => {
    if (e.target && e.target.closest && e.target.closest('button')) return;
    const t = e.touches ? e.touches[0] : e;
    startY = t.clientY;
    startX = t.clientX;
    dy = 0; dx = 0;
    dragging = true;
    toast.classList.add('dragging');
  };
  const onMove = (e) => {
    if (!dragging) return;
    const t = e.touches ? e.touches[0] : e;
    dy = t.clientY - startY;
    dx = t.clientX - startX;
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
      // Только скрыть тост — заявка остаётся в списке «Заявки»
      hideChToast(true);
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

(function bindRmToastSwipe() {
  const toast = document.getElementById('rmToast');
  if (!toast || toast._bpSwipe) return;
  toast._bpSwipe = true;
  let startY = 0, startX = 0, dragging = false, dy = 0, dx = 0;
  const onStart = (e) => {
    if (e.target && e.target.closest && e.target.closest('button')) return;
    const t = e.touches ? e.touches[0] : e;
    startY = t.clientY;
    startX = t.clientX;
    dy = 0; dx = 0;
    dragging = true;
    toast.classList.add('dragging');
  };
  const onMove = (e) => {
    if (!dragging) return;
    const t = e.touches ? e.touches[0] : e;
    dy = t.clientY - startY;
    dx = t.clientX - startX;
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
      // Only hide toast — rematch request stays in «Заявки»
      hideRmToast(true);
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
  // Mouse drag (desktop)
  toast.addEventListener('mousedown', (e) => {
    if (e.target && e.target.closest && e.target.closest('button')) return;
    onStart(e);
    const move = (ev) => onMove(ev);
    const up = () => {
      onEnd();
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  });
})();



// Outgoing lobby invites: friendCode -> roomCode (host side)
let lobbyInviteWait = {};
function markLobbyInviteWait(friendCode, room) {
  const c = normalizeFriendCode(friendCode);
  const r = String(room || '').toUpperCase();
  if (!c || !r) return;
  lobbyInviteWait[c] = r;
}
function clearLobbyInviteWait(friendCode, room) {
  const c = normalizeFriendCode(friendCode || '');
  if (c && lobbyInviteWait[c]) {
    if (!room || String(lobbyInviteWait[c]).toUpperCase() === String(room).toUpperCase()) {
      delete lobbyInviteWait[c];
    }
    return;
  }
  if (room) {
    const ru = String(room).toUpperCase();
    Object.keys(lobbyInviteWait).forEach(k => {
      if (String(lobbyInviteWait[k]).toUpperCase() === ru) delete lobbyInviteWait[k];
    });
  }
}
function isLobbyInviteWaiting(friendCode, room) {
  const c = normalizeFriendCode(friendCode);
  if (!c || !lobbyInviteWait[c]) return false;
  if (room) return String(lobbyInviteWait[c]).toUpperCase() === String(room).toUpperCase();
  return true;
}

/** Host: tell pending invitees that lobby is gone / full */
function notifyChallengeCancelled(room, reason) {
  try {
    const roomCode = room ? String(room).toUpperCase() : null;
    const targets = [];
    if (roomCode) {
      Object.keys(lobbyInviteWait || {}).forEach((fc) => {
        if (String(lobbyInviteWait[fc]).toUpperCase() === roomCode) targets.push(fc);
      });
    } else {
      Object.keys(lobbyInviteWait || {}).forEach((fc) => targets.push(fc));
    }
    // Also clear local wait state for this room
    try { clearLobbyInviteWait(null, roomCode); } catch (_) {}
    const body = { room: roomCode, reason: reason || 'closed', code: myFriendCode || null, name: myNickname || null };
    targets.forEach((fc) => {
      try {
        if (typeof socialSend === 'function') {
          socialSend(fc, 'challenge_cancel', body);
        } else if (typeof MatchClient !== 'undefined' && MatchClient.socialSend) {
          MatchClient.socialSend(fc, 'challenge_cancel', body);
        } else if (typeof deliverSocialMessage === 'function') {
          deliverSocialMessage(fc, Object.assign({ type: 'challenge_cancel' }, body));
        }
      } catch (_) {}
    });
  } catch (_) {}
}

async function challengeFriend(friend) {
  if (!friend || !friend.code) return;
  if (typeof MatchClient === 'undefined') {
    alert('Сервер матчей недоступен');
    return;
  }
  ensureFriendPresence();
  try { setFriendAddStatus('Создаём комнату для вызова…', 'wait'); } catch (_) {}

  try { stopMatchmaking(true); } catch (_) {}
  try { closeRoomLobby(); } catch (_) {}
  try {
    document.getElementById('versusResult')?.classList.remove('visible');
    document.getElementById('reviewBar')?.classList.remove('visible');
  } catch (_) {}
  const myGen = ++mpCreateGen;
  destroyMp();
  hideRjToast(false);
  mpPendingJoin = null;
  postMatchOnlineEligible = false;
  mpFromMatchmaking = false;
  mpGameSource = 'lobby';
  vsModeType = 'online';
  mmActive = false;
  mmFound = false;
  mpRole = 'host';
  mpMode = true;
  mpReady = false;
  mpOppReady = false;
  mpOppConnected = false;
  mpLobbyDuration = 120;
  mpMatchStarting = false;
  mpExpectedJoinCode = normalizeFriendCode(friend.code);
  try { showScreen('friends'); } catch (_) {}
  try { bindPrivateLobbyHandlers(); } catch (_) {}
  setMpStatus('Создаю комнату для вызова…');

  // Wait for private_lobby once, then send challenge
  let handled = false;
  const onLobby = (data) => {
    if (handled || myGen !== mpCreateGen) return;
    if (!data || data.role !== 'host') return;
    handled = true;
    try { MatchClient.off('private_lobby', onLobby); } catch (_) {}
    mpRoomCode = data.code;
    setMpStatus('Комната ' + data.code + ' · зовём друга…');
    try { openRoomLobby(); } catch (_) {}
    markLobbyInviteWait(friend.code, data.code);
    deliverSocialMessage(friend.code, {
      type: 'challenge',
      room: data.code,
      code: myFriendCode,
      name: myNickname,
      trophies: trophies | 0
    }, { timeoutMs: 10000 }).then((ok) => {
      if (!ok) {
        setMpStatus('Вызов отправлен (друг получит при входе)');
        try { setFriendAddStatus('Вызов сохранён — друг получит, когда будет в игре', 'ok'); } catch (_) {}
        clearLobbyInviteWait(friend.code, data.code);
      } else {
        try { setFriendAddStatus('Вызов отправлен', 'ok'); } catch (_) {}
      }
    });
  };
  try { MatchClient.on('private_lobby', onLobby); } catch (_) {}
  MatchClient.createPrivate({
    name: myNickname,
    trophies: trophies | 0,
    skinId: (typeof equippedSkinId !== 'undefined' && equippedSkinId) ? equippedSkinId : 'default',
    boardId: (typeof equippedBoardId !== 'undefined' && equippedBoardId) ? equippedBoardId : 'field_default',
    avatarId: (typeof myAvatarId !== 'undefined' && myAvatarId) ? myAvatarId : 'init',
    avatarCustom: (typeof myAvatarCustom !== 'undefined' && myAvatarId === 'custom' && myAvatarCustom) ? myAvatarCustom : '',
    duration: 120,
    friendCode: myFriendCode
  });
  setTimeout(() => {
    if (!handled) {
      try { MatchClient.off('private_lobby', onLobby); } catch (_) {}
      setMpStatus('Не удалось создать комнату');
    }
  }, 12000);
}




function toggleLobbyReady() {
  if (!mpRoomCode) return;
  mpReady = !mpReady;
  try {
    if (typeof MatchClient !== 'undefined') {
      MatchClient.privateReady(mpReady, mpRoomCode);
    }
  } catch (_) {}
  try { updateLobbyUI && updateLobbyUI(); } catch (_) {}
}


function closeLobbyInviteModal() {
  const m = document.getElementById('lobbyInviteModal');
  if (m) m.classList.remove('visible');
}

function getLobbyInviteSearchQuery() {
  const el = document.getElementById('lobbyInviteSearch');
  return el ? (el.value || '').trim().toLowerCase() : '';
}

function renderLobbyInviteList() {
  const list = document.getElementById('lobbyInviteList');
  if (!list) return;
  if (!friends || !friends.length) {
    list.innerHTML = '<div class="lobby-invite-empty">Нет друзей — добавьте их во вкладке «Друзья»</div>';
    return;
  }
  const q = getLobbyInviteSearchQuery();
  const indexed = friends.map((f, i) => ({ f, i })).filter(({ f }) => {
    if (!q) return true;
    const name = (f.name || '').toLowerCase();
    const code = (f.code || '').toLowerCase();
    return name.includes(q) || code.includes(q);
  });
  if (!indexed.length) {
    list.innerHTML = '<div class="lobby-invite-empty">Никого не найдено</div>';
    return;
  }
  list.innerHTML = indexed.map(({ f, i }) => {
    const initials = (f.name || f.code || '?').slice(0, 2).toUpperCase();
    const pres = getFriendPresence(f.code);
    const act = getFriendActivity(f.code);
    const dotCls = pres === 'online' ? 'on' : pres === 'offline' ? 'off' : 'checking';
    let stText = pres === 'online' ? 'В сети' : pres === 'offline' ? 'Не в сети' : 'Проверка…';
    if (pres === 'online' && act) stText = activityLabel(act);
    const stCls = pres === 'online' ? 'on' : '';
    const waiting = isLobbyInviteWaiting(f.code, mpRoomCode);
    const btnLabel = waiting ? 'Ожидание...' : 'Пригласить';
    const btnCls = waiting ? 'primary lobby-inv-btn waiting' : 'primary lobby-inv-btn';
    const btnDis = waiting ? ' disabled' : '';
    return `<div class="lobby-invite-item" data-code="${f.code}" data-fi="${i}">
      <div class="f-av">${initials}<span class="f-online-dot ${dotCls}"></span></div>
      <div class="f-info">
        <div class="f-name">${f.name || 'Друг'}</div>
        <div class="f-meta">${f.code} · <span class="f-status-line ${stCls}" style="display:inline">${stText}</span></div>
      </div>
      <button type="button" class="${btnCls}" data-fi="${i}"${btnDis}>${btnLabel}</button>
    </div>`;
  }).join('');
  list.querySelectorAll('.lobby-inv-btn:not(.waiting)').forEach(btn => {
    btn.addEventListener('click', () => {
      const f = friends[parseInt(btn.dataset.fi, 10)];
      if (f) inviteFriendToCurrentLobby(f, btn);
    });
  });
  try { refreshFriendsPresence(); } catch (_) {}
}

function openLobbyInviteModal() {
  if (!mpRoomCode) return;
  if (mpOppConnected) {
    // Room already full
    try { closeLobbyInviteModal(); } catch (_) {}
    return;
  }
  const search = document.getElementById('lobbyInviteSearch');
  if (search) search.value = '';
  renderLobbyInviteList();
  const m = document.getElementById('lobbyInviteModal');
  if (m) m.classList.add('visible');
  if (search) setTimeout(() => { try { search.focus(); } catch (_) {} }, 120);
}

function inviteFromLobby() {
  openLobbyInviteModal();
}

async function inviteFriendToCurrentLobby(friend, btnEl) {
  if (!friend || !friend.code || !mpRoomCode) return;
  if (typeof MatchClient === 'undefined') {
    try { setFriendAddStatus('Сервер недоступен', 'err'); } catch (_) {}
    return;
  }
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.textContent = 'Ожидание...';
    btnEl.classList.add('waiting');
  }
  markLobbyInviteWait(friend.code, mpRoomCode);
  const ok = await deliverSocialMessage(friend.code, {
    type: 'challenge',
    room: mpRoomCode,
    code: myFriendCode,
    name: myNickname,
    trophies: trophies | 0
  }, { timeoutMs: 8000 });
  if (!ok) {
    clearLobbyInviteWait(friend.code, mpRoomCode);
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.textContent = 'Пригласить';
      btnEl.classList.remove('waiting');
    }
    try { setFriendAddStatus('Сообщение сохранено на сервере', 'ok'); } catch (_) {}
  } else {
    try { setFriendAddStatus('Приглашение отправлено', 'ok'); } catch (_) {}
    try { renderLobbyInviteList(); } catch (_) {}
  }
}


function joinRoomFlow() {
  const modal = document.getElementById('joinRoomModal');
  const input = document.getElementById('joinRoomInput');
  if (modal) modal.classList.add('visible');
  if (input) {
    input.value = '';
    setTimeout(() => input.focus(), 100);
  }
}
function submitJoinRoom() {
  const input = document.getElementById('joinRoomInput');
  const code = (input && input.value || '').trim();
  if (!code) {
    alert('Введи код комнаты');
    return;
  }
  const modal = document.getElementById('joinRoomModal');
  if (modal) modal.classList.remove('visible');
  joinMpRoom(code);
}

/** Start versus for multiplayer (no AI) */
