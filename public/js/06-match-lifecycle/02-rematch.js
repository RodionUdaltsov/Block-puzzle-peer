/**
 * Block Puzzle — js/06-match-lifecycle/02-rematch.js
 * Rematch buttons, offers, toasts, request/start flow.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
function restorePostMatchResultUI() {
  try {
    // Do not yank user back if a new match already started
    if (vsActive && !BPState.matchEnded && !rematchPending) return;
    let onVersus = false;
    try {
      const vs = document.getElementById('screenVersus');
      onVersus = !!(vs && vs.classList.contains('active'));
    } catch (_) { onVersus = false; }
    if (!onVersus) {
      // User already left match UI — only clear rematch chrome, do not open result
      return;
    }
    const vr = document.getElementById('versusResult');
    if (vr) {
      vr.classList.add('visible');
      try {
        vr.style.display = '';
        vr.style.pointerEvents = '';
        vr.style.opacity = '';
        vr.style.visibility = '';
      } catch (_) {}
      vr.setAttribute('aria-hidden', 'false');
    }
    try { updateRematchButtonState && updateRematchButtonState(); } catch (_) {}
  } catch (_) {}
}

function leaveAfterRematchDecline(msg) {
  // Dismiss rematch wait/offer. Only restore result if still on versus.
  rematchPending = false;
  rematchIWant = false;
  rematchTheyWant = false;
  pendingRematchOfferName = null;
  try { rematchClickCount = 0; } catch (_) {}
  const offer = document.getElementById('rematchOffer');
  const wait = document.getElementById('rematchWait');
  [offer, wait].forEach((el) => {
    if (!el || !el.classList.contains('visible')) return;
    el.classList.add('rematch-decline-out');
    setTimeout(() => {
      el.classList.remove('visible', 'rematch-decline-out');
    }, 280);
  });
  try { hideRmToast(true); } catch (_) {}
  try { hideRematchOffer(); } catch (_) {}
  try { hideRematchWait(); } catch (_) {}
  try { if (typeof clearRmPending === 'function') clearRmPending(); } catch (_) {}
  // Result only if user is still looking at the match screen
  try { restorePostMatchResultUI(); } catch (_) {}
  if (msg) {
    try { showInfoToast('Реванш', msg, 'bad'); } catch (_) {}
  }
}


let rematchClickCount = 0;
const REMATCH_MAX_CLICKS = 2;

function updateRematchButtonState() {
  const btnR = document.getElementById('btnVsRematch');
  if (!btnR) return;
  if (rematchClickCount >= REMATCH_MAX_CLICKS) {
    btnR.disabled = true;
    btnR.style.opacity = '0.45';
    btnR.style.pointerEvents = 'none';
    btnR.textContent = 'Реванш (лимит)';
  } else {
    btnR.disabled = false;
    btnR.style.opacity = '';
    btnR.style.pointerEvents = '';
    if (btnR.textContent === 'Реванш (лимит)') btnR.textContent = 'Реванш';
  }
}

function configurePostMatchButtons() {
  const btnR = document.getElementById('btnVsRematch');
  const btnA = document.getElementById('btnVsAgain');
  if (!btnR || !btnA) return;
  // Fresh result screen — allow up to 2 rematch requests
  rematchClickCount = 0;
  btnR.disabled = false;
  btnR.style.opacity = '';
  btnR.style.pointerEvents = '';
  // Online match: always offer «Реванш» while post-match session is eligible
  // (even if peer briefly disconnected — requestRematch checks live link)
  const ranked = !!(
    mpGameSource === 'ranked' ||
    (lastMatchResult && lastMatchResult.ranked) ||
    (mpFromMatchmaking && mpGameSource !== 'lobby')
  );
  const onlineMatch = !!(postMatchOnlineEligible || (mpMode && vsModeType === 'online') || ranked ||
    (lastMatchResult && (lastMatchResult.mode === 'online' || lastMatchResult.mode === 'friendly')));
  const isBotMatch = vsModeType === 'bots' || (!!currentBot && !onlineMatch);
  if (onlineMatch && ranked) {
    btnR.style.display = '';
    btnR.textContent = 'Реванш';
    btnA.style.display = '';
    btnA.textContent = 'Ещё матч';
  } else if (onlineMatch) {
    btnR.style.display = '';
    btnR.textContent = 'Реванш';
    btnA.style.display = 'none';
  } else if (isBotMatch) {
    // Bot: rematch same bot immediately; other button picks another
    btnR.style.display = '';
    btnR.textContent = 'Реванш';
    btnA.style.display = '';
    btnA.textContent = 'Другой бот';
  } else {
    btnR.style.display = 'none';
    btnA.style.display = '';
    btnA.textContent = 'Ещё матч';
  }
  try { updateRematchButtonState(); } catch (_) {}
}

function isScoreDuelVisible() {
  const duel = document.getElementById('scoreDuelOverlay');
  return !!(duel && duel.classList.contains('visible'));
}

let rematchOfferRetryTimer = null;
function tryShowPendingRematchOffer() {
  if (!pendingRematchOfferName) return false;
  // Don't cover the score duel — wait until it is dismissed
  if (isScoreDuelVisible()) {
    if (rematchOfferRetryTimer) clearTimeout(rematchOfferRetryTimer);
    rematchOfferRetryTimer = setTimeout(() => {
      rematchOfferRetryTimer = null;
      tryShowPendingRematchOffer();
    }, 280);
    return false;
  }
  const name = pendingRematchOfferName;
  // Keep name until accepted/declined so retries work
  showRematchOffer(name);
  return true;
}

let rmToastHideTimer = null;
let rmToastCountTimer = null;
const REMATCH_TOAST_SEC = 15;
/** Pending resolve for rematch_probe_reply */
let rematchProbeResolve = null;
let rematchProbeBusy = false;





/** Host: accept post-match reconnects on the existing peer. */


/**
 * Ensure online link is alive before rematch probe.
 * If the connection dropped but both peers are still in the game, reconnect.
 */


    /** True if local player cannot accept a rematch right now.
 *  Busy ONLY when: searching for a match, in a live battle, in a room lobby,
 *  or training vs bots. Result screen / menu / shop / etc. = free. */
function isRematchBusyLocal() {
  try {
    // 1) Live battle only (not post-match result / ended)
    if (typeof isReallyInLiveMatch === 'function' ? isReallyInLiveMatch() : (vsActive && !BPState.matchEnded)) return true;

    // 2) Searching for a fight (ranked matchmaking)
    if (typeof mmActive !== 'undefined' && mmActive) return true;
    const matchScreen = document.getElementById('screenMatch');
    if (matchScreen && matchScreen.classList.contains('active')) return true;

    // 3) In a multiplayer room / lobby
    const lobby = document.getElementById('roomLobby');
    if (lobby && lobby.classList.contains('visible')) return true;

    // 4) Training with bots — on bot pick / duration for bots, or bot versus screen
    //    (not post-match result / review of an online game)
    const onResult = (() => {
      const r = document.getElementById('versusResult');
      return !!(r && r.classList.contains('visible'));
    })();
    const onReview = document.body.classList.contains('replay-ui');
    if (!onResult && !onReview && !postMatchOnlineEligible) {
      const diff = document.getElementById('screenDifficulty');
      if (diff && diff.classList.contains('active')) return true;
      // Duration screen only counts as busy on the bots path
      if (vsModeType === 'bots' || currentBot) {
        const dur = document.getElementById('screenDuration');
        if (dur && dur.classList.contains('active')) return true;
        const vs = document.getElementById('screenVersus');
        if (vs && vs.classList.contains('active')) return true;
      }
    }
  } catch (_) {}
  return false;
}

function probeOpponentForRematch(timeoutMs) {
  // Server-authoritative: if we still hold match credentials and socket is open, peer is reachable via room
  try {
    if (typeof MatchClient !== 'undefined' && MatchClient.matchId && MatchClient.connected) {
      return Promise.resolve({ ok: true, offline: false, busy: false });
    }
    const creds = (typeof loadMatchCreds === 'function') ? null : null;
  } catch (_) {}
  try {
    if (typeof MatchClient !== 'undefined' && MatchClient.connected) {
      return Promise.resolve({ ok: true, offline: false, busy: false });
    }
  } catch (_) {}
  return Promise.resolve({ ok: false, offline: true });
}


/** Clear AFK / DC status toasts so they never leak into the next match. */
function clearAfkUi() {
  try {
    if (typeof afkBannerKind !== 'undefined') afkBannerKind = null;
    if (typeof dismissStatusToast === 'function') {
      dismissStatusToast('afk');
      dismissStatusToast('afk-me');
      dismissStatusToast('disconnect');
      dismissStatusToast('need-move');
      dismissStatusToast('need-move-opp');
    }
    if (typeof hideBoardDisconnectOverlay === 'function') hideBoardDisconnectOverlay();
    if (typeof clearDisconnectTimer === 'function') clearDisconnectTimer();
  } catch (_) {}
}

/** Pending rematch invite shown in «Заявки» (survives toast dismiss). */
let rmPending = null;
function clearRmPending() {
  rmPending = null;
  pendingRematchOfferName = null;
  try { rematchTheyWant = false; } catch (_) {}
  try { hideRmToast(false); } catch (_) {}
  try { hideRematchOffer && hideRematchOffer(); } catch (_) {}
  try { renderFriendRequests && renderFriendRequests(); } catch (_) {}
  try { updateFriendsSectionCounts && updateFriendsSectionCounts(); } catch (_) {}
}
function setRmPending(fromName, matchId) {
  rmPending = {
    name: (fromName || mpOppName || 'Соперник').toString(),
    matchId: matchId || (typeof MatchClient !== 'undefined' ? MatchClient.matchId : null),
    ts: Date.now()
  };
  pendingRematchOfferName = rmPending.name;
  rematchTheyWant = true;
  try { renderFriendRequests && renderFriendRequests(); } catch (_) {}
  try { updateFriendsSectionCounts && updateFriendsSectionCounts(); } catch (_) {}
}

function clearRmToastTimers() {
  if (rmToastHideTimer) { clearTimeout(rmToastHideTimer); rmToastHideTimer = null; }
  if (rmToastCountTimer) { clearInterval(rmToastCountTimer); rmToastCountTimer = null; }
}

function hideRmToast(animate) {
  const toast = document.getElementById('rmToast');
  if (!toast) return;
  clearRmToastTimers();
  toast.style.transform = '';
  toast.style.opacity = '';
  if (animate === false) {
    toast.classList.remove('visible', 'out');
    return;
  }
  if (!toast.classList.contains('visible')) {
    toast.classList.remove('out');
    return;
  }
  toast.classList.add('out');
  toast.classList.remove('visible');
  setTimeout(() => toast.classList.remove('out'), 400);
}
function showRmToast(fromName) {
  const toast = document.getElementById('rmToast');
  if (!toast) return;
  const nameEl = document.getElementById('rmToastName');
  const metaEl = document.getElementById('rmToastMeta');
  const avEl = document.getElementById('rmToastAv');
  const nm = (fromName || mpOppName || 'Соперник').toString();
  if (nameEl) nameEl.textContent = nm;
  if (metaEl) metaEl.textContent = 'Предлагает ещё один матч';
  if (avEl) {
    try {
      renderAvatarInto(avEl, {
        avatarId: window.mpOppAvatarId || null,
        nick: nm
      });
    } catch (_) {
      avEl.textContent = (nm.charAt(0) || '↻').toUpperCase();
    }
  }
  clearRmToastTimers();
  toast.classList.remove('out');
  void toast.offsetWidth;
  toast.classList.add('visible');
  // Auto-hide toast only — заявка остаётся в «Заявках» until accept/decline/cancel
  rmToastCountTimer = startToastCountdown('rmToastCountdown', REMATCH_TOAST_SEC, null);
  rmToastHideTimer = setTimeout(() => {
    rmToastHideTimer = null;
    hideRmToast(true);
  }, REMATCH_TOAST_SEC * 1000);
  try { SFX.ui && SFX.ui(); } catch (_) {}
  try { hapticTap(12); } catch (_) {}
}
function showRematchOffer(fromName) {
  // Always use top-right toast (works on result screen, menu, or next flow)
  showRmToast(fromName);
  // Keep legacy modal hidden — toast is the single UX
  try {
    const el = document.getElementById('rematchOffer');
    if (el) el.classList.remove('visible', 'rematch-decline-out', 'out');
  } catch (_) {}
}
function hideRematchOffer() {
  hideRmToast(false);
  const el = document.getElementById('rematchOffer');
  if (el) el.classList.remove('visible', 'rematch-decline-out', 'out');
}
function showRematchWait() {
  const el = document.getElementById('rematchWait');
  if (el) {
    el.classList.remove('rematch-decline-out', 'out');
    void el.offsetWidth;
    el.classList.add('visible');
  }
}
function hideRematchWait() {
  const el = document.getElementById('rematchWait');
  if (el) el.classList.remove('visible', 'rematch-decline-out', 'out');
}
async function requestRematch() {
  // Bot rematch: restart same bot immediately (no network)
  if (vsModeType === 'bots' || (currentBot && !(mpMode && roomMatchMode))) {
    try { document.getElementById('versusResult').classList.remove('visible'); } catch (_) {}
    try { document.getElementById('reviewBar').classList.remove('visible'); } catch (_) {}
    hideRematchOffer();
    hideRematchWait();
    beginVersusMatch();
    return;
  }
  // Restore match credentials from storage (endVersus / UI may have cleared roomMatchMode only)
  try {
    if (typeof MatchClient !== 'undefined' && !MatchClient.matchId) {
      const mid = sessionStorage.getItem('bp_match_id') || localStorage.getItem('bp_match_id');
      const tok = sessionStorage.getItem('bp_match_token') || localStorage.getItem('bp_match_token');
      const seat = sessionStorage.getItem('bp_match_seat') || localStorage.getItem('bp_match_seat');
      if (mid && tok) {
        MatchClient.matchId = mid;
        MatchClient.token = tok;
        if (seat) MatchClient.seat = seat;
      }
    }
  } catch (_) {}

  const hasRoom = !!(roomMatchMode || BPState.roomMatchMode
    || (typeof MatchClient !== 'undefined' && MatchClient.matchId));
  if (!hasRoom) {
    try { showInfoToast('Реванш', 'Соперник не в сети', 'bad'); } catch (_) {}
    return;
  }
  if (rematchClickCount >= REMATCH_MAX_CLICKS) {
    try { updateRematchButtonState(); } catch (_) {}
    try { showInfoToast('Реванш', 'Лимит запросов (2)', 'bad'); } catch (_) {}
    return;
  }
  rematchClickCount++;
  try { updateRematchButtonState(); } catch (_) {}
  rematchIWant = true;
  rematchPending = true;
  try {
    document.getElementById('versusResult').classList.remove('visible');
    document.getElementById('reviewBar').classList.remove('visible');
  } catch (_) {}
  try { hideRematchOffer(); } catch (_) {}
  try { showRematchWait && showRematchWait(); } catch (_) {}
  try { setMpStatus('Ожидаем реванш…'); } catch (_) {}
  try {
    if (typeof MatchClient !== 'undefined') {
      try { MatchClient.connect && MatchClient.connect(); } catch (_) {}
      if (rematchTheyWant) MatchClient.rematchAccept();
      else MatchClient.rematchOffer();
    }
  } catch (e) {
    console.warn('requestRematch', e);
    try { showInfoToast('Реванш', 'Не удалось отправить', 'bad'); } catch (_) {}
    // Failed to send — return to result
    rematchPending = false;
    rematchIWant = false;
    try { hideRematchWait(); } catch (_) {}
    try { restorePostMatchResultUI(); } catch (_) {}
  }
}


function startRematchMatch() {
  try { bumpAchStat('rematchPlayed', 1); } catch (_) {}
  hideRematchOffer();
  hideRematchWait();
  try { hideRmToast(false); } catch (_) {}
  rematchIWant = false;
  rematchTheyWant = false;
  rematchPending = false;
  rematchClickCount = 0;
  pendingRematchOfferName = null;
  postMatchOnlineEligible = false; // in-match again; endVersus will re-arm
  try { if (mpMode) startAfkWatch(); } catch (_) {}
  try { dismissPostMatchResult(); } catch (_) {
    try { document.getElementById('versusResult').classList.remove('visible'); } catch (_) {}
    try { document.getElementById('reviewBar').classList.remove('visible'); } catch (_) {}
  }
  clearDisconnectTimer();
  mpMatchStarting = false;
  vsIntroLock = false;
  currentBot = null;
  vsModeType = 'online';
  mpMode = true;
  // Host re-sends start so clocks sync
  if (mpRole === 'host') {
    
    beginVersusMatchMp(true);
  }
  // guest waits for start message
}

function showRemotePhrase(text) {
  const el = document.getElementById('botSpeech');
  if (!el) return;
  const nameEl = el.querySelector('.bot-speech-name');
  const textEl = el.querySelector('.bot-speech-text');
  if (nameEl) nameEl.textContent = (mpOppName || 'Соперник') + ':';
  if (textEl) textEl.textContent = ' ' + text;
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 2800);
}
