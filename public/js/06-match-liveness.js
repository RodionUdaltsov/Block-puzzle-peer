/**
 * Block Puzzle — 06-match-liveness.js
 * AFK, disconnect wait, rematch UI, private room create/join (MatchClient)
 * Shares global scope with other public/js/*.js modules (no bundler).
 */
'use strict';

// Pre-start disconnect helpers (server-authoritative rooms; server path only)
let _lastOppPrestartAt = 0;



function noMovesYet() {
  try {
    if (window._matchHadAnyPlace) return false;
  } catch (_) {}
  try {
    const hasPlace = Array.isArray(matchLog) && matchLog.some(e => e && (e.type === 'place' || e.type === 'opp_place'));
    if (hasPlace) return false;
  } catch (_) {}
  return (score | 0) === 0 && (oppScore | 0) === 0;
}

/** Hard cancel: empty/pre-move disconnect. Bypasses soft guards that fail in Opera. */
function forceCancelPreMoveMatch(reason) {
  // Server live match: never locally cancel — wait for match_end
  try {
    if (typeof MatchClient !== 'undefined' && MatchClient.matchId
        && (roomMatchMode || window._roomMatchMode || vsActive)
        && !window._matchEnded) {
      // Only allow cancel if truly zero places on server perspective is unknown —
      // still don't end with 0:0 UI; sync and wait
      try { MatchClient.sync && MatchClient.sync({}); } catch (_) {}
      return;
    }
  } catch (_) {}
  // Allow re-entry if previous cancel left UI stuck (Opera)
  try {
    if (window._forceCancelPreMoveLock) {
      const vs = document.getElementById('screenVersus');
      const stuckVs = !!(vs && vs.classList.contains('active'));
      const empty = (typeof noMovesYet === 'function') ? noMovesYet() : true;
      if (!(stuckVs && empty)) return;
      window._forceCancelPreMoveLock = false;
    }
  } catch (_) {
    window._forceCancelPreMoveLock = false;
  }
  window._forceCancelPreMoveLock = true;
  const msg = reason || 'Соперник отключился до начала матча';
  try { window._leftForRankedSearch = 0; } catch (_) {}
  try { window._preMatchAborting = false; } catch (_) {}
  try { stopEmptyMatchPeerWatch(); } catch (_) {}
  try { oppDisconnected = false; } catch (_) {}
  try { clearDisconnectTimer(); } catch (_) {}
  try { hideBoardDisconnectOverlay(); } catch (_) {}
  try { hideDisconnectBanner(); } catch (_) {}
  try { hideMatchLoading(); } catch (_) {}
  try { clearMatchLoadState(); } catch (_) {}
  try { stopAfkWatch(); } catch (_) {}
  try {
    if (vsTimerId) { clearInterval(vsTimerId); vsTimerId = null; }
  } catch (_) {}
  try { vsActive = false; } catch (_) {}
  try { placingLock = false; } catch (_) {}
  try { vsIntroLock = false; } catch (_) {}
  try { mpMatchStarting = false; } catch (_) {}
  try { mpLoading = false; } catch (_) {}
  try { window._matchEnded = true; } catch (_) {}
  try { window._matchHadAnyPlace = false; } catch (_) {}
  try { sessionStorage.removeItem('bp_rejoin_storm'); } catch (_) {}
  try { window._thisMatchHadRejoin = false; window._lastRejoinActivityAt = 0; } catch (_) {}
  try { clearLiveMatch(); } catch (_) {}
  try { myDcAt = 0; oppDcAt = 0; bothAwayMode = false; } catch (_) {}

  const ranked = !!(mpFromMatchmaking || mpGameSource === 'ranked');

  // Opera: strip versus UI / DC overlays from DOM state even if hide*() no-ops
  try {
    document.querySelectorAll('.board-dc-overlay').forEach(el => el.classList.remove('show'));
    const vs = document.getElementById('screenVersus');
    if (vs) vs.classList.remove('active');
    const ml = document.getElementById('matchLoading');
    if (ml) ml.classList.remove('visible');
  } catch (_) {}

  try {
    if (false) {
      
    }
  } catch (_) {}
  try { destroyMp(); } catch (_) {}

  // No cancel toast — go straight to search / lobby

  // Always requeue ranked; friendly → friends
  try {
    const vr = document.getElementById('versusResult');
    const onResult = !!(vr && vr.classList.contains('visible'));
    if (!onResult && ranked) {
      window._preMatchAborting = false;
      window._forceCancelPreMoveLock = false;
      try {
        showScreen('match');
        mmActive = true;
        mmFound = false;
        mmSetStatus(msg, 'Ищем снова…');
      } catch (_) {}
      try {
        startOnlineMatchmaking();
        mmSetStatus(msg, 'Ищем снова…');
      } catch (_) {
        try {
          showScreen('duration');
          mmSetStatus(msg, 'Попробуй поиск снова');
        } catch (_2) {}
      }
      return;
    }
    if (!onResult) {
      try { showScreen('friends'); } catch (_) {}
    }
  } catch (_) {
    try { showScreen('menu'); } catch (_2) {}
  }
  window._preMatchAborting = false;
  window._forceCancelPreMoveLock = false;
}












function markRejoinCalm(ms) {
  const add = (typeof ms === 'number' && ms > 0) ? ms : 15000;
  const until = Date.now() + add;
  try {
    window._rejoinCalmUntil = Math.max(window._rejoinCalmUntil || 0, until);
  } catch (_) {
    window._rejoinCalmUntil = until;
  }
  try { window._lastRejoinActivityAt = Date.now(); } catch (_) {}
  try { window._thisMatchHadRejoin = true; } catch (_) {}
}
function isRejoinCalm() {
  try {
    if (window._mpRejoiningMatch) return true;
    if (window._rejoinCalmUntil && Date.now() < window._rejoinCalmUntil) return true;
  } catch (_) {}
  return false;
}
function softRedial() {
  return;
}
function ensureDualRedialLoop() {
  return;
}

function handleOpponentDisconnect() {
  if (!mpMode) return;
  // HARD RULE: no move placed yet → never freeze on DC overlay (Opera-critical)
  try {
    const stillLoading = !!(typeof isMatchLoadActive === 'function' && isMatchLoadActive())
      || !!mpLoading || !!vsIntroLock || !!mpMatchStarting;
    if (stillLoading || noMovesYet()) {
      forceCancelPreMoveMatch('Соперник отключился до начала матча');
      return;
    }
  } catch (_) {
    try {
      if (noMovesYet()) {
        forceCancelPreMoveMatch('Соперник отключился до начала матча');
        return;
      }
    } catch (_2) {}
  }
  if (window._matchEnded || !vsActive) return;

  // During mutual rejoin storms — never show DC UI; keep dialing room id
  try {
    if (sessionStorage.getItem('bp_rejoin_storm') === '1') {
      markRejoinCalm(30000);
    }
  } catch (_) {}
  if (isRejoinCalm() || bothAwayMode || (typeof myDcAt === 'number' && myDcAt > 0)) {
    try { markRejoinCalm(20000); } catch (_) {}
    try { softRedial(); } catch (_) {}
    try { ensureDualRedialLoop(); } catch (_) {}
    return;
  }
  try {
    if (window._lastOppPacketAt && (Date.now() - window._lastOppPacketAt) < 4000) {
      return;
    }
  } catch (_) {}
  if (false) return;
  if (oppDisconnected && dcDeadlineTs) {
    // Already in wait — do not refresh overlay every close flap
    return;
  }
  if (oppDisconnected) return;
  if (window._dcGraceTimer) return;
  window._dcGraceTimer = setTimeout(() => {
    window._dcGraceTimer = null;
    try {
      if (window._matchEnded || !vsActive || !mpMode) return;
      if (isRejoinCalm()) { softRedial(); return; }
      if (false) return;
      if (window._lastOppPacketAt && (Date.now() - window._lastOppPacketAt) < 5000) return;
      if (oppDisconnected) return;
      beginOpponentDisconnectWait();
    } catch (_) {}
  }, 5000);
  return;
}

function beginOpponentDisconnectWait() {
  return; // server player_status only
}

function handleOpponentReconnectSignal() {
  if (!oppDisconnected) return;
  // Soft reconnect: keep deadline, stop showing as "offline" only after they PLACE
  dcPausedByReconnect = true;
  // Keep overlay visible with remaining time — timer does not reset
  const left = Math.max(0, Math.ceil((dcDeadlineTs - Date.now()) / 1000));
  if (left <= 0) {
    resolveDisconnectWin();
    return;
  }
  showBoardDisconnectOverlay(left);
  // Overlay title stays "Отсоединение" until first move clears it via noteOppAction
}

function noteMyAction() {
  lastMyActionTs = Date.now();
  try { window._matchHadAnyPlace = true; } catch (_) {}
  try { stopEmptyMatchPeerWatch(); } catch (_) {}
  // Only clear MY AFK / need-move — opponent AFK must keep showing
  if (afkBannerKind === 'me') {
    afkBannerKind = null;
    try { dismissStatusToast('afk-me'); } catch (_) {}
    hideBoardDisconnectOverlay('me');
  }
  try { dismissStatusToast('need-move'); } catch (_) {}
}
function noteOppAction() {
  lastOppActionTs = Date.now();
  try { window._matchHadAnyPlace = true; } catch (_) {}
  try { stopEmptyMatchPeerWatch(); } catch (_) {}
  // Real move ends disconnect wait for opponent
  if (oppDisconnected || dcDeadlineTs) {
    clearDisconnectTimer();
  }
  // Only clear OPP AFK — my AFK must keep showing until I place
  if (afkBannerKind === 'opp') {
    afkBannerKind = null;
    try { dismissStatusToast('afk'); } catch (_) {}
  }
  try { dismissStatusToast('need-move-opp'); } catch (_) {}
}

function startAfkWatch() {
  stopAfkWatch();
  const now = Date.now();
  lastMyActionTs = now;
  lastOppActionTs = now;
  try { window._lastOppPacketAt = now; } catch (_) {}
  afkBannerKind = null;
  // Keepalive: prevents mutual false "Отсоединение" when connection flaps
  try {
    if (window._liveKeepaliveIv) { clearInterval(window._liveKeepaliveIv); }
    window._liveKeepaliveIv = setInterval(() => {
      try {
        if (window._matchEnded || !vsActive || !mpMode) return;
        if (false) {
          
        }
        // Persist often so refresh can auto-rejoin
        try { persistLiveMatch(); } catch (_) {}
      } catch (_) {}
    }, 4000);
  } catch (_) {}
  afkCheckTimer = setInterval(() => {
    if (window._matchEnded || !vsActive || !mpMode || replayMode) return;
    try { ensurePlayableIfLive(); } catch (_) {}
    // Server-room mode: peer is MatchClient, not server — never treat missing null as AFK
    if (roomMatchMode || window._roomMatchMode) {
      // Server owns AFK entirely — client only renders afk_warn events
      return;
    }
    // While opponent is offline / reconnecting, do not AFK-punish either side
    if (oppDisconnected && !dcPausedByReconnect) {
      try { lastMyActionTs = Date.now(); } catch (_) {}
      try { lastOppActionTs = Date.now(); } catch (_) {}
      return;
    }

    const now = Date.now();
    // No moves left = not AFK (waiting for opponent is legitimate)
    let myNoMoves = false, oppNoMoves = false;
    try {
      myNoMoves = !!playerStuck || (typeof playerHasMoves === 'function' && !playerHasMoves());
    } catch (_) {}
    try {
      oppNoMoves = !!aiStuck;
    } catch (_) {}
    // Freeze idle clocks while stuck so reconnect/wait does not punish
    if (myNoMoves) lastMyActionTs = now;
    if (oppNoMoves) lastOppActionTs = now;

    const myIdle = now - lastMyActionTs;
    const oppIdle = now - lastOppActionTs;

    // AFK is a real idle limit and must not shrink with the remaining match clock.
    // Otherwise, e.g. 5 seconds left in a 2-minute match could turn a normal idle
    // interval into a false AFK loss.
    const oppAfkLimit = AFK_LIMIT_MS;
    const myAfkLimit = AFK_LIMIT_MS;

    // While opponent is disconnected / solo rejoin wait — AFK does not apply to them
    const oppAfkDone = !oppDisconnected && !window._soloRejoinActive
      && !oppNoMoves && oppIdle >= oppAfkLimit && oppAfkLimit > 0;
    const myAfkDone = !myNoMoves && myIdle >= myAfkLimit && myAfkLimit > 0;
    // Both AFK: decide by score (0-0 → draw; higher score wins)
    if (oppAfkDone && myAfkDone) {
      afkBannerKind = null;
      hideDisconnectBanner();
      stopAfkWatch();
      clearDisconnectTimer();
      if (score > oppScore) endVersus({ forceWin: true, reason: 'afk' });
      else if (score < oppScore) endVersus({ forceLoss: true, reason: 'afk' });
      else endVersus({ reason: 'afk' }); // draw
      return;
    }
    if (oppAfkDone) {
      afkBannerKind = null;
      hideDisconnectBanner();
      stopAfkWatch();
      clearDisconnectTimer();
      endVersus({ forceWin: true, reason: 'afk' });
      return;
    }
    if (myAfkDone) {
      afkBannerKind = null;
      hideDisconnectBanner();
      stopAfkWatch();
      clearDisconnectTimer();
      endVersus({ forceLoss: true, reason: 'afk' });
      return;
    }

    // Bottom AFK warnings. Skip if disconnect overlay is primary.
    // Stuck / no moves is NOT AFK — freeze clocks already applied above.
    if (!oppDisconnected) {
      if (!oppNoMoves && oppIdle >= AFK_WARN_MS && oppAfkLimit > AFK_WARN_MS) {
        afkBannerKind = 'opp';
        const left = Math.ceil((oppAfkLimit - oppIdle) / 1000);
        showDisconnectBanner(Math.max(1, left), 'afk');
      } else if (!myNoMoves && myIdle >= AFK_WARN_MS && myAfkLimit > AFK_WARN_MS) {
        afkBannerKind = 'me';
        const left = Math.ceil((myAfkLimit - myIdle) / 1000);
        showDisconnectBanner(Math.max(1, left), 'afk-me');
        try { hideBoardDisconnectOverlay('me'); } catch (_) {}
      } else if (afkBannerKind === 'opp' && (oppNoMoves || oppIdle < AFK_WARN_MS)) {
        // Opp stuck / moved — clear only opp AFK (keep stack toasts)
        afkBannerKind = null;
        try { dismissStatusToast('afk'); } catch (_) {}
      } else if (afkBannerKind === 'me' && (myNoMoves || myIdle < AFK_WARN_MS)) {
        // Me stuck or I moved — clear only my AFK
        afkBannerKind = null;
        try { dismissStatusToast('afk-me'); } catch (_) {}
        try { hideBoardDisconnectOverlay('me'); } catch (_) {}
      }
    }
  }, 500);
}
function stopAfkWatch() {
  if (afkCheckTimer) {
    clearInterval(afkCheckTimer);
    afkCheckTimer = null;
  }
  afkBannerKind = null;
  try {
    if (window._liveKeepaliveIv) {
      clearInterval(window._liveKeepaliveIv);
      window._liveKeepaliveIv = null;
    }
  } catch (_) {}
}


/** Watchdog: sticky rejoin-loading / match-ending / locks freeze the tray. */
function ensurePiecesInteractive() {
  try {
    if (!vsActive || window._matchEnded) return;
    if (typeof isDragging !== 'undefined' && isDragging) return;
    const ov = document.getElementById('rejoinLoading');
    const ovOn = ov && (ov.classList.contains('show') || ov.classList.contains('visible'));
    if (!ovOn) {
      window._rejoinLoading = false;
      window._rejoinInputLock = false;
      document.body.classList.remove('rejoin-loading');
    }
    const mef = document.getElementById('matchEndFreeze');
    if (!mef || !mef.classList.contains('visible')) {
      document.body.classList.remove('match-ending');
    }
    if (typeof placingLock !== 'undefined' && placingLock) placingLock = false;
    try { vsIntroLock = false; mpMatchStarting = false; mpLoading = false; } catch (_) {}
    // Ensure slots accept input and look normal (not dimmed)
    const area = document.getElementById('piecesAreaVs');
    if (area) {
      area.style.opacity = '1';
      area.style.filter = 'none';
      area.querySelectorAll('.piece-slot:not(.used)').forEach(s => {
        s.style.pointerEvents = 'auto';
        s.style.opacity = '1';
        s.style.filter = 'none';
        s.classList.add('show');
        s.classList.remove('lifting');
      });
    }
  } catch (_) {}
}
try {
  if (!window._pieceInteractIv) {
    window._pieceInteractIv = setInterval(ensurePiecesInteractive, 1500);
  }
} catch (_) {}

function updateVersusNameLabels() {
  const nick = (typeof myNickname === 'string' && myNickname.trim()) ? myNickname.trim() : 'Гость';
  const t = (typeof trophies === 'number') ? trophies : 0;
  const me = document.getElementById('myNameLabel');
  if (me) {
    me.innerHTML =
      '<span class="vs-me-av" id="vsMeAv"></span>' +
      '<span class="vs-me-nick" id="vsMeNick"></span>' +
      '<span id="vsMeCups" style="opacity:0.9;font-weight:700;font-size:0.72rem;margin-left:2px;color:var(--trophy);white-space:nowrap;flex-shrink:0">🏆 ' + t + '</span>';
    me.classList.add('vs-me-name', 'name');
    const avEl = document.getElementById('vsMeAv');
    const nickEl = document.getElementById('vsMeNick');
    if (nickEl) nickEl.textContent = nick;
    if (avEl) {
      try { renderAvatarInto(avEl, { avatarId: myAvatarId, nick: nick }); }
      catch (_) { avEl.textContent = (nick[0] || '?').toUpperCase(); }
    }
  }
  const opp = document.getElementById('oppName');
  if (!opp) return;

  const isOnline = !!(mpMode || roomMatchMode || window._roomMatchMode || vsModeType === 'online');
  // Online always paints human opponent — never keep leftover bot avatar/name
  if (!isOnline && currentBot) {
    // bot path: leave bot-specific HTML (painted by bot start)
    return;
  }

  const nm = (oppName || mpOppName || 'Соперник').toString().slice(0, 20);
  let cups = null;
  if (isOnline && typeof mpOppTrophies === 'number') cups = mpOppTrophies;
  else if (!isOnline && currentBot && typeof currentBot.trophies === 'number') cups = currentBot.trophies;
  else if (typeof mpOppTrophies === 'number') cups = mpOppTrophies;

  const avId = (isOnline ? (window.mpOppAvatarId || null) : null) || window.mpOppAvatarId || 'init';
  opp.classList.add('vs-opp-name', 'name');
  opp.innerHTML =
    '<span class="vs-opp-av" id="vsOppAv"></span>' +
    '<span class="vs-opp-nick" id="vsOppNick"></span>' +
    (cups != null
      ? '<span class="vs-opp-cups" style="opacity:0.9;font-weight:700;font-size:0.72rem;margin-left:2px;color:var(--trophy);white-space:nowrap;flex-shrink:0">🏆 ' + cups + '</span>'
      : '');
  const on = document.getElementById('vsOppNick');
  if (on) on.textContent = nm;
  const oa = document.getElementById('vsOppAv');
  if (oa) {
    try {
      if (isOnline) {
        renderAvatarInto(oa, {
          avatarId: window.mpOppAvatarId || 'init',
          nick: nm,
          custom: window.mpOppAvatarCustom || null
        });
      } else {
        renderAvatarInto(oa, { avatarId: avId, nick: nm });
      }
    } catch (_) { oa.textContent = (nm[0] || '?').toUpperCase(); }
  }
}

/** Clear bot match residue before online / ranked / private match. */
function clearBotMatchResidue() {
  try { currentBot = null; } catch (_) {}
  try { document.body.classList.remove('vs-bots'); } catch (_) {}
  try {
    if (aiInterval) { clearInterval(aiInterval); aiInterval = null; }
  } catch (_) {}
  try { aiBusy = false; aiStuck = false; } catch (_) {}
  try {
    const speech = document.querySelector('.bot-speech');
    if (speech) speech.classList.remove('visible');
  } catch (_) {}
  try {
    const ghost = document.getElementById('aiGhost');
    if (ghost) { ghost.style.display = 'none'; ghost.innerHTML = ''; }
  } catch (_) {}
  try { window.mpOppAvatarId = null; window.mpOppAvatarCustom = null; } catch (_) {}
}


/** Bring back the post-match result overlay after a declined / cancelled rematch. */
function restorePostMatchResultUI() {
  try {
    // Do not yank user back if a new match already started
    if (vsActive && !window._matchEnded && !rematchPending) return;
    // Prefer staying in post-match context (versus screen)
    try {
      const vs = document.getElementById('screenVersus');
      const onVersus = !!(vs && vs.classList.contains('active'));
      if (!onVersus && typeof showScreen === 'function') showScreen('versus');
    } catch (_) {
      try { if (typeof showScreen === 'function') showScreen('versus'); } catch (_2) {}
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
  // Dismiss rematch wait/offer and return to result window
  rematchPending = false;
  rematchIWant = false;
  rematchTheyWant = false;
  pendingRematchOfferName = null;
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
  setTimeout(() => {
    hideRematchOffer();
    hideRematchWait();
    try { restorePostMatchResultUI(); } catch (_) {}
  }, 280);
  // Also restore immediately so result is never blank
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
    if (typeof isReallyInLiveMatch === 'function' ? isReallyInLiveMatch() : (vsActive && !window._matchEnded)) return true;

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
  // 15s auto-hide with live countdown; on expiry auto-decline
  rmToastCountTimer = startToastCountdown('rmToastCountdown', REMATCH_TOAST_SEC, null);
  rmToastHideTimer = setTimeout(() => {
    rmToastHideTimer = null;
    // Time expired — decline so requester is notified
    if (pendingRematchOfferName || rematchTheyWant) {
      pendingRematchOfferName = null;
      try {
        if (roomMatchMode || window._roomMatchMode) {
          if (typeof MatchClient !== 'undefined' && MatchClient.rematchDecline)
            MatchClient.rematchDecline();
        }
      } catch (_) {}
      rematchTheyWant = false;
    }
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

  const hasRoom = !!(roomMatchMode || window._roomMatchMode
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

async function createMpRoom() {
  if (typeof MatchClient === 'undefined') {
    setMpStatus('Сервер матчей недоступен. Обнови страницу.');
    return;
  }
  try { stopMatchmaking(true); } catch (_) {}
  try { closeRoomLobby(); } catch (_) {}
  const myGen = ++mpCreateGen;
  // Leave finished/rematch room so server does not answer in_match
  try {
    if (typeof MatchClient !== 'undefined') {
      MatchClient._skipAutoRejoin = true;
      MatchClient.leaveMatch();
      MatchClient.freeMatch && MatchClient.freeMatch();
    }
  } catch (_) {}
  try { roomMatchMode = false; window._roomMatchMode = false; } catch (_) {}
  try { postMatchOnlineEligible = false; } catch (_) {}
  // Soft reset without leavePrivate race before create
  try { if (typeof MatchClient !== 'undefined') MatchClient.leavePrivate(); } catch (_) {}
  mpPendingJoin = null;
  mpFromMatchmaking = false;
  mpGameSource = 'lobby';
  vsModeType = 'online';
  mpRole = 'host';
  mpMode = true;
  mpReady = false;
  mpOppReady = false;
  mpOppConnected = false;
  mpLobbyDuration = 120;
  mpMatchStarting = false;
  mpRoomCode = null;
  setMpStatus('Создаю комнату…');
  try { bindMatchClientHandlers(); } catch (_) {}
  try { bindPrivateLobbyHandlers(); } catch (_) {}
  try { ensureFriendPresence(); } catch (_) {}
  let gotLobby = false;
  const onLobby = (data) => {
    if (myGen !== mpCreateGen) return;
    if (!data || data.role !== 'host') return;
    gotLobby = true;
    try { MatchClient.off('private_lobby', onLobby); } catch (_) {}
  };
  try { MatchClient.on('private_lobby', onLobby); } catch (_) {}

  (async () => {
    setMpStatus('Подключение к серверу…');
    const opened = await MatchClient.waitForOpen(8000);
    if (myGen !== mpCreateGen) return;
    if (!opened) {
      setMpStatus('Нет связи с сервером. Запусти: npm start и открой http://localhost:9000 (не file://).');
      return;
    }
    try { ensureFriendPresence(); } catch (_) {}
    setMpStatus('Создаю комнату…');
    MatchClient.createPrivate({
      name: myNickname,
      trophies: trophies | 0,
      skinId: (typeof equippedSkinId !== 'undefined' && equippedSkinId) ? equippedSkinId : 'default',
      boardId: (typeof equippedBoardId !== 'undefined' && equippedBoardId) ? equippedBoardId : 'field_default',
      avatarId: (typeof myAvatarId !== 'undefined' && myAvatarId) ? myAvatarId : 'init',
      avatarCustom: (typeof myAvatarCustom !== 'undefined' && myAvatarId === 'custom' && myAvatarCustom) ? myAvatarCustom : '',
      duration: mpLobbyDuration || 120,
      friendCode: typeof myFriendCode !== 'undefined' ? myFriendCode : null
    });
    setTimeout(() => {
      if (myGen !== mpCreateGen || gotLobby || mpRoomCode) return;
      setMpStatus('Повтор создания комнаты…');
      MatchClient.createPrivate({
        name: myNickname,
        trophies: trophies | 0,
        skinId: (typeof equippedSkinId !== 'undefined' && equippedSkinId) ? equippedSkinId : 'default',
        boardId: (typeof equippedBoardId !== 'undefined' && equippedBoardId) ? equippedBoardId : 'field_default',
        avatarId: (typeof myAvatarId !== 'undefined' && myAvatarId) ? myAvatarId : 'init',
        avatarCustom: (typeof myAvatarCustom !== 'undefined' && myAvatarId === 'custom' && myAvatarCustom) ? myAvatarCustom : '',
        duration: mpLobbyDuration || 120,
        friendCode: typeof myFriendCode !== 'undefined' ? myFriendCode : null
      });
      setTimeout(() => {
        if (myGen !== mpCreateGen) return;
        if (!mpRoomCode) {
          setMpStatus('Сервер не ответил. Открой сайт по адресу сервера (не file://).');
        }
      }, 4000);
    }, 3000);
  })();
}

function joinMpRoom(code, opts) {
  opts = opts || {};
  const fromChallenge = !!opts.fromChallenge;
  if (typeof MatchClient === 'undefined') {
    setMpStatus('Сервер матчей недоступен. Обнови страницу.');
    return;
  }
  code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length < 4) {
    setMpStatus('Введи код комнаты (5 символов)');
    return;
  }
  const myGen = ++mpJoinGen;
  destroyMp();
  hideRjToast(false);
  mpPendingJoin = null;
  mpRoomCode = code;
  mpRole = 'guest';
  mpMode = true;
  mpFromMatchmaking = false;
  mpGameSource = 'lobby';
  postMatchOnlineEligible = false;
  mmActive = false;
  mmFound = false;
  try { stopMatchmaking(true); } catch (_) {}
  try { document.getElementById('versusResult')?.classList.remove('visible'); } catch (_) {}
  try { showScreen('friends'); } catch (_) {}
  mpReady = false;
  mpOppReady = false;
  mpOppConnected = false;
  mpLobbyDuration = 120;
  mpMatchStarting = false;
  setMpStatus(fromChallenge ? ('Входим в комнату вызова ' + code + '…') : ('Ищем комнату ' + code + '…'));
  try { bindMatchClientHandlers(); } catch (_) {}
  try { bindPrivateLobbyHandlers(); } catch (_) {}
  try { ensureFriendPresence(); } catch (_) {}
  try { MatchClient.connect(); } catch (_) {}
  MatchClient.joinPrivate(code, {
    name: myNickname,
    trophies: trophies | 0,
    skinId: (typeof equippedSkinId !== 'undefined' && equippedSkinId) ? equippedSkinId : 'default',
    boardId: (typeof equippedBoardId !== 'undefined' && equippedBoardId) ? equippedBoardId : 'field_default',
    avatarId: (typeof myAvatarId !== 'undefined' && myAvatarId) ? myAvatarId : 'init',
    avatarCustom: (typeof myAvatarCustom !== 'undefined' && myAvatarId === 'custom' && myAvatarCustom) ? myAvatarCustom : '',
    friendCode: typeof myFriendCode !== 'undefined' ? myFriendCode : null
  });
  setTimeout(() => {
    if (myGen !== mpJoinGen) return;
    if (!mpOppConnected && mpRole === 'guest' && !mpRoomCode) {
      setMpStatus('Комната не найдена. Проверь код (5 символов) — хост должен держать лобби открытым.');
    }
  }, 5000);
}


function applyRemoteFriendRemove(data) {
  const code = normalizeFriendCode(
    (data && (data.code || data.from || data.remover || '')) || ''
  );
  if (!code || code === myFriendCode) return false;
  const before = friends.length;
  const stillHas = friends.some(f => normalizeFriendCode(f.code) === code);
  if (!stillHas) return false;

  const finish = () => {
    friends = friends.filter(f => normalizeFriendCode(f.code) !== code);
    if (friends.length === before) return false;
    saveFriends();
    try { renderFriends(); } catch (_) {}
    try {
      const who = data && data.name ? ' (' + data.name + ')' : '';
      setFriendAddStatus('Вас удалили из друзей' + who, 'err');
    } catch (_) {}
    return true;
  };

  // Animate the card out for the removed player (same as local delete)
  try {
    const list = document.getElementById('friendList');
    const card = list && list.querySelector('.friend-card[data-code="' + code + '"]');
    if (card && !card.classList.contains('friend-exit')) {
      void card.offsetWidth;
      card.classList.add('friend-exit');
      setTimeout(() => { finish(); }, 360);
      return true;
    }
  } catch (_) {}
  return finish();
}

/** Deliver friend_remove to peer presence; retries while they may be online */
function notifyFriendRemoved(theirCode) {
  try {
    if (typeof socialSend === "function") socialSend(theirCode, "friend_remove", {});
    else if (typeof MatchClient !== "undefined") MatchClient.socialSend(theirCode, "friend_remove", {});
  } catch (_) {}
}

function removeFriendAt(idx) {
  const f = friends[idx];
  if (!f) return;
  const theirCode = normalizeFriendCode(f.code);
  const list = document.getElementById('friendList');
  const card = list && list.querySelector('.friend-card[data-fi="' + idx + '"]');
  const finish = () => {
    friends.splice(idx, 1);
    saveFriends();
    renderFriends();
    setFriendAddStatus('Друг удалён', 'ok');
    try { SFX.ui(); } catch (_) {}
    if (theirCode) notifyFriendRemoved(theirCode);
  };
  if (card) {
    void card.offsetWidth;
    card.classList.add('friend-exit');
    setTimeout(finish, 360);
  } else {
    finish();
  }
}

let chPending = null; // { conn, room, name, code, trophies }
let chHideTimer = null;
let chCountTimer = null;
let leaveMatchChallengeReq = null;

// Lobby RTT
let mpLastRtt = null;
let mpPingTimer = null;
let mpPingSentAt = 0;
function stopLobbyPing() {
  if (mpPingTimer) { clearInterval(mpPingTimer); mpPingTimer = null; }
  mpPingSentAt = 0;
  mpLastRtt = null;
}
function _smoothLobbyRtt(sample) {
  // Ignore tab-throttle / clock-skew outliers (often 2000–5000ms after background)
  if (typeof sample !== 'number' || sample < 0 || sample > 900) return mpLastRtt;
  if (typeof mpLastRtt !== 'number') {
    mpLastRtt = sample;
    return sample;
  }
  // EMA — damp spikes
  mpLastRtt = Math.round(mpLastRtt * 0.65 + sample * 0.35);
  return mpLastRtt;
}
function startLobbyPing() {
  stopLobbyPing();
  const tick = () => {
    try {
      if (typeof MatchClient === 'undefined' || !MatchClient.connected) return;
      const raw = (typeof MatchClient.lastRtt === 'number') ? MatchClient.lastRtt : null;
      if (typeof raw === 'number') {
        const smooth = _smoothLobbyRtt(raw);
        if (typeof smooth === 'number') {
          window._lobbyMeRtt = smooth;
          try {
            MatchClient.send({ type: 'lobby_ping', rtt: smooth | 0 });
          } catch (_) {}
        }
      }
      try { updateLobbyPingUI(); } catch (_) {}
    } catch (_) {}
  };
  tick();
  mpPingTimer = setInterval(tick, 2500);
  try {
    if (typeof MatchClient !== 'undefined' && !window._lobbyRttBound) {
      window._lobbyRttBound = true;
      MatchClient.on('rtt', (data) => {
        try {
          if (data && typeof data.rtt === 'number') {
            const smooth = _smoothLobbyRtt(data.rtt);
            if (typeof smooth === 'number') {
              window._lobbyMeRtt = smooth;
              updateLobbyPingUI();
            }
          }
        } catch (_) {}
      });
    }
  } catch (_) {}
}
function updateLobbyPingUI() {
  const apply = (id, ms) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (ms == null || ms < 0) {
      el.textContent = '';
      el.className = 'lobby-ping';
      return;
    }
    // Cap display so 3000ms spikes never show
    const shown = Math.min(999, ms | 0);
    el.textContent = shown + ' мс';
    el.className = 'lobby-ping ' + (shown < 80 ? 'good' : shown < 160 ? 'mid' : 'bad');
  };
  const meRtt = (typeof window._lobbyMeRtt === 'number')
    ? window._lobbyMeRtt
    : (typeof mpLastRtt === 'number' ? mpLastRtt : null);
  let oppRtt = (typeof window._lobbyOppRtt === 'number') ? window._lobbyOppRtt : null;
  // Cap opp samples from server too
  if (typeof oppRtt === 'number' && oppRtt > 900) oppRtt = Math.min(999, oppRtt);
  apply('lobbyMePing', meRtt);
  apply('lobbyOppPing', mpOppConnected ? oppRtt : null);
}

// Compact top-right info toast (2s, swipe to dismiss)
let infoHideTimer = null;
function hideInfoToast(animate) {
  const toast = document.getElementById('infoToast');
  if (!toast) return;
  if (infoHideTimer) { clearTimeout(infoHideTimer); infoHideTimer = null; }
  toast.style.transform = '';
  toast.style.opacity = '';
  toast.classList.remove('dragging');
  if (animate === false) {
    toast.classList.remove('visible', 'out', 'ok', 'bad');
    return;
  }
  toast.classList.add('out');
  toast.classList.remove('visible');
  setTimeout(() => toast.classList.remove('out', 'ok', 'bad'), 380);
}
function showInfoToast(label, text, kind) {
  const toast = document.getElementById('infoToast');
  if (!toast) return;
  const lab = document.getElementById('infoToastLabel');
  const tx = document.getElementById('infoToastText');
  if (lab) lab.textContent = label || '';
  if (tx) tx.textContent = text || '';
  toast.classList.remove('out', 'dragging', 'ok', 'bad');
  if (kind === 'ok') toast.classList.add('ok');
  else if (kind === 'bad') toast.classList.add('bad');
  toast.style.transform = '';
  toast.style.opacity = '';
  void toast.offsetWidth;
  toast.classList.add('visible');
  if (infoHideTimer) clearTimeout(infoHideTimer);
  infoHideTimer = setTimeout(() => {
    infoHideTimer = null;
    hideInfoToast(true);
  }, 2000);
}
(function bindInfoToastSwipe() {
  const toast = document.getElementById('infoToast');
  if (!toast) return;
  let sx = 0, sy = 0, dx = 0, dy = 0, dragging = false;
  const onStart = (e) => {
    if (!toast.classList.contains('visible')) return;
    const t = e.touches && e.touches[0];
    if (!t) return;
    dragging = true;
    sx = t.clientX; sy = t.clientY; dx = 0; dy = 0;
    toast.classList.add('dragging');
  };
  const onMove = (e) => {
    if (!dragging) return;
    const t = e.touches && e.touches[0];
    if (!t) return;
    dx = t.clientX - sx;
    dy = t.clientY - sy;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) e.preventDefault();
    const x = Math.max(0, dx);
    const y = Math.min(0, dy);
    toast.style.transform = 'translate(' + x + 'px,' + y + 'px)';
    toast.style.opacity = String(Math.max(0.25, 1 - Math.max(x, -y) / 120));
  };
  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    toast.classList.remove('dragging');
    if (dx > 56 || dy < -48) hideInfoToast(true);
    else {
      toast.style.transform = '';
      toast.style.opacity = '';
    }
    dx = 0; dy = 0;
  };
  toast.addEventListener('touchstart', onStart, { passive: true });
  toast.addEventListener('touchmove', onMove, { passive: false });
  toast.addEventListener('touchend', onEnd);
  toast.addEventListener('touchcancel', onEnd);
})();

function clearChHideTimer() {
  if (chHideTimer) { clearTimeout(chHideTimer); chHideTimer = null; }
  if (chCountTimer) { clearInterval(chCountTimer); chCountTimer = null; }
}

function hideChToast(animate) {
  const toast = document.getElementById('chToast');
  if (!toast) return;
  clearChHideTimer();
  toast.style.transform = '';
  toast.style.opacity = '';
  toast.classList.remove('dragging');
  if (animate === false) {
    toast.classList.remove('visible', 'out');
    return;
  }
  toast.classList.add('out');
  toast.classList.remove('visible');
  setTimeout(() => toast.classList.remove('out'), 400);
}

let lastChToastKey = '';
let lastChToastAt = 0;
function showChToast(req) {
  const toast = document.getElementById('chToast');
  if (!toast || !req) return;
  const roomKey = String(req.room || '').toUpperCase();
  const inviterKey = normalizeFriendCode(req.code || '');
  const toastKey = roomKey + '|' + inviterKey;
  const samePending = chPending && String(chPending.room || '').toUpperCase() === roomKey;
  chPending = req;
  const av = document.getElementById('chToastAv');
  const name = document.getElementById('chToastName');
  const meta = document.getElementById('chToastMeta');
  if (av) av.textContent = (req.name || '?').slice(0, 2).toUpperCase();
  if (name) name.textContent = req.name || 'Игрок';
  if (meta) {
    const parts = [];
    if (req.trophies != null) parts.push('🏆 ' + req.trophies);
    parts.push(vsActive ? 'зовёт в лобби (идёт матч)' : 'приглашает в лобби');
    if (req.room) parts.push('комната ' + req.room);
    meta.textContent = parts.join(' · ');
  }
  try { renderFriendRequests(); updateFriendsSectionCounts(); } catch (_) {}
  // Suppress double flash: same invite within 10s, or toast already visible for same room
  const recentlyShown = (toastKey === lastChToastKey && (Date.now() - lastChToastAt) < 10000);
  if ((samePending && toast.classList.contains('visible')) || recentlyShown) {
    return;
  }
  lastChToastKey = toastKey;
  lastChToastAt = Date.now();
  toast.style.transform = '';
  toast.style.opacity = '';
  toast.classList.remove('out', 'dragging');
  void toast.offsetWidth;
  toast.classList.add('visible');
  try { SFX.ui && SFX.ui(); } catch (_) {}
  try { hapticTap(18); } catch (_) {}
  clearChHideTimer();
  chCountTimer = startToastCountdown('chToastCountdown', 5, null);
  // Toast only — заявка остаётся в «Заявках» до отклонения / заполнения / удаления лобби
  chHideTimer = setTimeout(() => {
    chHideTimer = null;
    hideChToast(true);
  }, 5000);
}

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
  // Same room already pending — refresh conn only, no second toast/flash
  if (chPending && String(chPending.room || '').toUpperCase() === room) {
    chPending.conn = conn || chPending.conn;
    if (data.name) chPending.name = (data.name || chPending.name).toString().slice(0, 20);
    if (data.code) chPending.code = data.code;
    if (typeof data.trophies === 'number') chPending.trophies = data.trophies;
    try { renderFriendRequests(); updateFriendsSectionCounts(); } catch (_) {}
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
    if (window._matchEnded) return false;
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
    return !!(typeof vsActive !== 'undefined' && vsActive && !window._matchEnded);
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
    window._matchEnded = true;
    roomMatchMode = false;
    window._roomMatchMode = false;
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
  try {
    if (typeof socialSend === "function") socialSend(req && req.code, "challenge_decline", {});
  } catch (_) {}
  try { hideChToast(false); } catch (_) {}
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
    if (friendCode && typeof socialSend === "function")
      socialSend(friendCode, "challenge_cancel", { room: roomCode || null });
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
