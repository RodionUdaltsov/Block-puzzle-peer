/**
 * Block Puzzle — js/06-match-liveness.js
 * Match liveness: pre-start cancel, redial, opponent disconnect, AFK watch.
 * Shares the client bundle scope (order: public/js/modules.json).
 */

// Pre-start disconnect helpers (server-authoritative rooms; server path only)
let _lastOppPrestartAt = 0;



function noMovesYet() {
  try {
    if (BPState.matchHadAnyPlace) return false;
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
        && (roomMatchMode || BPState.roomMatchMode || vsActive)
        && !BPState.matchEnded) {
      // Only allow cancel if truly zero places on server perspective is unknown —
      // still don't end with 0:0 UI; sync and wait
      try { MatchClient.sync && MatchClient.sync({}); } catch (_) {}
      return;
    }
  } catch (_) {}
  // Allow re-entry if previous cancel left UI stuck (Opera)
  try {
    if (BPState.forceCancelPreMoveLock) {
      const vs = document.getElementById('screenVersus');
      const stuckVs = !!(vs && vs.classList.contains('active'));
      const empty = (typeof noMovesYet === 'function') ? noMovesYet() : true;
      if (!(stuckVs && empty)) return;
      BPState.forceCancelPreMoveLock = false;
    }
  } catch (_) {
    BPState.forceCancelPreMoveLock = false;
  }
  BPState.forceCancelPreMoveLock = true;
  const msg = reason || 'Соперник отключился до начала матча';
  try { BPState.leftForRankedSearch = 0; } catch (_) {}
  try { BPState.preMatchAborting = false; } catch (_) {}
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
  try { BPState.matchEnded = true; } catch (_) {}
  try { BPState.matchHadAnyPlace = false; } catch (_) {}
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
      BPState.preMatchAborting = false;
      BPState.forceCancelPreMoveLock = false;
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
  BPState.preMatchAborting = false;
  BPState.forceCancelPreMoveLock = false;
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
    if (BPState.mpRejoiningMatch) return true;
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
  if (BPState.matchEnded || !vsActive) return;

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
    if (BPState.lastOppPacketAt && (Date.now() - BPState.lastOppPacketAt) < 4000) {
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
      if (BPState.matchEnded || !vsActive || !mpMode) return;
      if (isRejoinCalm()) { softRedial(); return; }
      if (false) return;
      if (BPState.lastOppPacketAt && (Date.now() - BPState.lastOppPacketAt) < 5000) return;
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
  try { BPState.matchHadAnyPlace = true; } catch (_) {}
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
  try { BPState.matchHadAnyPlace = true; } catch (_) {}
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
  try { BPState.lastOppPacketAt = now; } catch (_) {}
  afkBannerKind = null;
  // Keepalive: prevents mutual false "Отсоединение" when connection flaps
  try {
    if (window._liveKeepaliveIv) { clearInterval(window._liveKeepaliveIv); }
    window._liveKeepaliveIv = setInterval(() => {
      try {
        if (BPState.matchEnded || !vsActive || !mpMode) return;
        if (false) {
          
        }
        // Persist often so refresh can auto-rejoin
        try { persistLiveMatch(); } catch (_) {}
      } catch (_) {}
    }, 4000);
  } catch (_) {}
  afkCheckTimer = setInterval(() => {
    if (BPState.matchEnded || !vsActive || !mpMode || replayMode) return;
    try { ensurePlayableIfLive(); } catch (_) {}
    // Server-room mode: peer is MatchClient, not server — never treat missing null as AFK
    if (roomMatchMode || BPState.roomMatchMode) {
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
    const oppAfkDone = !oppDisconnected && !BPState.soloRejoinActive
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
    if (!vsActive || BPState.matchEnded) return;
    if (typeof isDragging !== 'undefined' && isDragging) return;
    const ov = document.getElementById('rejoinLoading');
    const ovOn = ov && (ov.classList.contains('show') || ov.classList.contains('visible'));
    if (!ovOn) {
      BPState.rejoinLoading = false;
      BPState.rejoinInputLock = false;
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
