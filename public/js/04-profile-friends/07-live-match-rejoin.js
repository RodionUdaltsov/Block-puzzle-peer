/**
 * Block Puzzle — js/04-profile-friends/07-live-match-rejoin.js
 * Live-match persistence, wall clock, leave/rejoin panels and sync payloads.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
const LIVE_MATCH_KEY = 'bp_live_match';
function persistLiveMatch(opts) {
  try {
    opts = opts || {};
    // Server-authoritative matches: do NOT store grid/hand/score locally.
    // Rejoin uses MatchClient credentials + server snapshot only.
    const serverMatch = !!(
      (typeof roomMatchMode !== 'undefined' && roomMatchMode)
      || BPState.roomMatchMode
      || (typeof MatchClient !== 'undefined' && MatchClient.matchId)
    );
    if (serverMatch && !opts.forceLeave && !opts.force) {
      // Keep only a tiny pointer so UI knows a match existed — no board state
      try {
        const thin = {
          v: 2,
          serverAuth: true,
          matchId: (typeof MatchClient !== 'undefined' && MatchClient.matchId) || null,
          seat: (typeof MatchClient !== 'undefined' && MatchClient.seat) || null,
          ts: Date.now()
        };
        // Intentionally omit grid/pieces/score/moves
        localStorage.setItem(LIVE_MATCH_KEY, JSON.stringify(thin));
      } catch (_) {}
      return;
    }
    const resultUp = (() => {
      try {
        const r = document.getElementById('versusResult');
        return !!(r && r.classList.contains('visible'));
      } catch (_) { return false; }
    })();
    // Never DELETE the snapshot here — only skip writing.
    // Deleting on !vsActive wiped rejoin ability when both players left.
    if (resultUp || BPState.matchEnded) return;
    if (!opts.forceLeave && (!vsActive || !mpMode)) return;
    if (!mpMode && !opts.forceLeave) return;
    // Empty pre-start / no moves: never create a rejoinable live snapshot.
    // (Previously only within 6s after go-live — waiting on loaded boards without
    // touching the screen left a rejoin offer for the leaver into a cancelled match.)
    try {
      if (typeof isEmptyMatchNoMoves === 'function' && isEmptyMatchNoMoves()) {
        try { clearLiveMatch(); } catch (_) {}
        return;
      }
    } catch (_) {}

    const nowTs = Date.now();
    // leftAt only when the player actually left (myDcAt set by notifyLeavingMatch)
    const leftAtVal = (typeof myDcAt === 'number' && myDcAt > 0) ? myDcAt : null;
    const oppLeftVal = (typeof oppDcAt === 'number' && oppDcAt > 0) ? oppDcAt : 0;
    const snap = {
      t: nowTs,
      leftAt: leftAtVal || nowTs,
      oppLeftAt: oppLeftVal,
      oppDcDeadline: (typeof dcDeadlineTs === 'number' && dcDeadlineTs > 0) ? dcDeadlineTs : 0,
      bothAway: !!(leftAtVal && oppLeftVal),
      role: mpRole,
      room: mpRoomCode,
      remoteSessionId: mpRemoteSessionId,
      selfSessionId: (typeof MatchClient !== "undefined" && MatchClient.matchId) ? MatchClient.matchId : null,
      fromMM: !!mpFromMatchmaking,
      score: score,
      oppScore: oppScore,
      vsTimeLeft: vsTimeLeft,
      // Wall-clock match end — keeps ticking while both players are offline
      clockEndTs: (function () {
        try {
          if (typeof BPState.matchClockEndTs === 'number' && BPState.matchClockEndTs > 0) {
            return BPState.matchClockEndTs;
          }
          const prev = JSON.parse(localStorage.getItem(LIVE_MATCH_KEY) || 'null');
          if (prev && typeof prev.clockEndTs === 'number' && prev.clockEndTs > 0) {
            BPState.matchClockEndTs = prev.clockEndTs;
            return prev.clockEndTs;
          }
        } catch (_) {}
        const end = Date.now() + Math.max(0, vsTimeLeft || 0) * 1000;
        BPState.matchClockEndTs = end;
        return end;
      })(),
      vsDuration: vsDuration,
      oppName: oppName || mpOppName,
      myBoardId: equippedBoardId,
      oppBoardId: window.mpOppBoardId || null,
      mySkinId: equippedSkinId,
      oppSkinId: window.mpOppSkinId || null,
      ranked: !!mpFromMatchmaking,
      grid: (typeof grid !== 'undefined' && Array.isArray(grid)) ? grid : null,
      oppGrid: (typeof oppGrid !== 'undefined' && Array.isArray(oppGrid)) ? oppGrid : null,
      pieces: (typeof pieces !== 'undefined' && Array.isArray(pieces)) ? pieces.map(p => ({
        shape: (p.shape || []).map(c => c.slice()), color: p.color, used: !!p.used
      })) : null,
      oppPieces: (typeof oppPieces !== 'undefined' && Array.isArray(oppPieces)) ? oppPieces.map(p => ({
        shape: (p.shape || []).map(c => c.slice()), color: p.color, used: !!p.used
      })) : null,
      // Replay log so expired dual-away matches still appear in history
      moves: (typeof matchLog !== 'undefined' && Array.isArray(matchLog)) ? matchLog.slice() : null,
      matchStartTs: (typeof matchStartTs === 'number') ? matchStartTs : null
    };
    // Preserve prior leave stamps if this is a mid-match autosave without leave
    // Critical: while solo-rejoin / opponent still offline, never rewrite leftAt to "now"
    // (that freezes the reconnect countdown for both clients).
    if (!leftAtVal) {
      try {
        const prev = JSON.parse(localStorage.getItem(LIVE_MATCH_KEY) || 'null');
        const solo = !!(typeof window !== 'undefined' && BPState.soloRejoinActive);
        const waitingOpp = !!(typeof oppDisconnected !== 'undefined' && oppDisconnected);
        if (prev && typeof prev.leftAt === 'number' && prev.leftAt > 0 && (prev.bothAway || solo || waitingOpp)) {
          snap.leftAt = prev.leftAt;
          snap.bothAway = !!(prev.bothAway || solo);
          if (typeof prev.oppLeftAt === 'number' && prev.oppLeftAt > 0 && !snap.oppLeftAt) {
            snap.oppLeftAt = prev.oppLeftAt;
          }
          if (typeof prev.oppDcDeadline === 'number' && prev.oppDcDeadline > 0 && !snap.oppDcDeadline) {
            snap.oppDcDeadline = prev.oppDcDeadline;
          }
        } else if (solo || waitingOpp) {
          // Keep absolute deadline already in memory
          if (typeof dcDeadlineTs === 'number' && dcDeadlineTs > 0) {
            snap.oppDcDeadline = dcDeadlineTs;
            // Reconstruct a stable leftAt so panel countdown keeps ticking
            const winMs = (typeof reconnectWindowMs === 'function' && prev)
              ? reconnectWindowMs(prev) : 60000;
            snap.leftAt = Math.max(0, dcDeadlineTs - winMs);
          } else if (prev && typeof prev.leftAt === 'number' && prev.leftAt > 0) {
            snap.leftAt = prev.leftAt;
          }
          snap.bothAway = true;
        } else {
          // Active match save — leftAt = t means "last seen alive", not a leave
          snap.leftAt = nowTs;
          snap.bothAway = false;
        }
      } catch (_) {}
    }
    localStorage.setItem(LIVE_MATCH_KEY, JSON.stringify(snap));
  } catch (_) {}
}
function clearLiveMatch() {
  try { localStorage.removeItem(LIVE_MATCH_KEY); } catch (_) {}
  try { hideMatchRejoinPanel(); } catch (_) {}
  try { window._rejoinStateApplied = false; } catch (_) {}
  try { window._rejoinPanelListening = false; } catch (_) {}
  try {
    if (window._rejoinPanelDialIv) {
      clearInterval(window._rejoinPanelDialIv);
      window._rejoinPanelDialIv = null;
    }
  } catch (_) {}
}
/** Sync vsTimeLeft from wall-clock end; start 1s tick. Time runs even if opponent is gone. */
function startMatchWallClock(endTs) {
  try {
    // Do not start the clock while waiting for match_go / loading overlay
    if (BPState.matchAwaitingGo || mpLoading) {
      try { updateTimerDisplay(); } catch (_) {}
      return;
    }
    if (typeof endTs === 'number' && endTs > 0) {
      BPState.matchClockEndTs = endTs;
    } else if (!(typeof BPState.matchClockEndTs === 'number' && BPState.matchClockEndTs > 0)) {
      BPState.matchClockEndTs = Date.now() + Math.max(0, vsTimeLeft || vsDuration || 120) * 1000;
    }
    // Before playStartTs show full duration (intro is not match time)
    const playStart = (typeof BPState.matchPlayStartTs === 'number' && BPState.matchPlayStartTs > 0)
      ? BPState.matchPlayStartTs : 0;
    if (playStart && Date.now() < playStart) {
      vsTimeLeft = (typeof vsDuration === 'number' ? vsDuration : 120) | 0;
    } else {
      vsTimeLeft = Math.max(0, Math.ceil((BPState.matchClockEndTs - Date.now()) / 1000));
    }
    try { updateTimerDisplay(); } catch (_) {}
    if (vsTimerId) { try { clearInterval(vsTimerId); } catch (_) {} vsTimerId = null; }
    vsTimerId = setInterval(() => {
      if (!vsActive || BPState.matchEnded) return;
      const ps = (typeof BPState.matchPlayStartTs === 'number' && BPState.matchPlayStartTs > 0)
        ? BPState.matchPlayStartTs : 0;
      if (ps && Date.now() < ps) {
        vsTimeLeft = (typeof vsDuration === 'number' ? vsDuration : 120) | 0;
      } else {
        vsTimeLeft = Math.max(0, Math.ceil((BPState.matchClockEndTs - Date.now()) / 1000));
      }
      try { updateTimerDisplay(); } catch (_) {}
      if (vsTimeLeft <= 0) {
        // Server-authoritative online/room: ONLY server may end the match.
        // Local endVersus here caused one client "Ничья 0:0" while the other kept playing.
        try {
          if (roomMatchMode || BPState.roomMatchMode
              || (typeof MatchClient !== 'undefined' && MatchClient.matchId)) {
            try { MatchClient.sync && MatchClient.sync({}); } catch (_) {}
            return;
          }
        } catch (_) {}
        try { endVersus(); } catch (_) {}
      }
    }, 250);
  } catch (_) {}
}
/** Restart wall clock if interval was killed but match is still live. */
function ensureMatchClockRunning() {
  try {
    if (!vsActive || BPState.matchEnded || replayMode) return;
    if (vsTimerId) return;
    const end = (typeof BPState.matchClockEndTs === 'number' && BPState.matchClockEndTs > 0)
      ? BPState.matchClockEndTs
      : (Date.now() + Math.max(0, vsTimeLeft || 0) * 1000);
    startMatchWallClock(end);
  } catch (_) {}
}
/** Drop input locks if match is live (recovers from stuck rejoin overlay). */
function ensurePlayableIfLive() {
  try {
    if (mpMode || mode === 'versus') document.body.classList.add('quiet-hands');
    else document.body.classList.remove('quiet-hands');
  } catch (_) {}
  try {
    if (!vsActive || BPState.matchEnded || replayMode) return;
    // Overlay must not stick forever
    if (BPState.rejoinLoading || BPState.rejoinInputLock) {
      const el = document.getElementById('rejoinLoading');
      const shown = el && el.classList.contains('show');
      // If overlay not visible, force-clear locks
      if (!shown) {
        BPState.rejoinLoading = false;
        BPState.rejoinInputLock = false;
        placingLock = false;
        BPState.mpRejoiningMatch = false;
      }
    }
    if (placingLock && !isDragging && !BPState.rejoinLoading) {
      placingLock = false;
    }
    ensureMatchClockRunning();
  } catch (_) {}
}
/** Absolute wall-clock end of match timer (ms). Time keeps running while both are away. */
function getSnapClockEndTs(snap) {
  if (!snap) return 0;
  if (typeof snap.clockEndTs === 'number' && snap.clockEndTs > 0) return snap.clockEndTs;
  const leftAt = (typeof snap.leftAt === 'number' && snap.leftAt > 0) ? snap.leftAt : (snap.t || Date.now());
  const leftSec = (typeof snap.vsTimeLeft === 'number') ? snap.vsTimeLeft
    : (typeof snap.vsDuration === 'number' ? snap.vsDuration : 120);
  return leftAt + Math.max(0, leftSec) * 1000;
}
/** Remaining match seconds from wall clock (0 if time already up). */
function remainingMatchSecFromSnap(snap) {
  const end = getSnapClockEndTs(snap);
  return Math.max(0, Math.ceil((end - Date.now()) / 1000));
}
/** Reconnect window: min(60s from leave, remaining match time at leave). */
function reconnectWindowMs(snap) {
  if (!snap) return 60000;
  const leftAt = (typeof snap.leftAt === 'number' && snap.leftAt > 0) ? snap.leftAt : (snap.t || Date.now());
  const end = getSnapClockEndTs(snap);
  // How much match time was left when they left
  const matchLeftAtLeave = Math.max(0, end - leftAt);
  return Math.min(60000, matchLeftAtLeave);
}
function reconnectDeadlineTs(snap) {
  const leftAt = (typeof snap.leftAt === 'number' && snap.leftAt > 0) ? snap.leftAt : (snap.t || Date.now());
  return leftAt + reconnectWindowMs(snap);
}
function readLiveMatch() {
  try {
    const raw = localStorage.getItem(LIVE_MATCH_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !s.t) return null;
    const now = Date.now();
    // Hard expire after 10 minutes wall-clock (safety)
    if (now - s.t > 10 * 60 * 1000) {
      localStorage.removeItem(LIVE_MATCH_KEY);
      return null;
    }
    // Empty 0–0 never-played match is not rejoinable (opponent already cancelled as pre-start).
    // Drop so leaver is not offered «переподключиться» into a free win on disconnected board.
    try {
      const empty = (s.score | 0) === 0 && (s.oppScore | 0) === 0
        && (!Array.isArray(s.moves) || !s.moves.some(e => e && (e.type === 'place' || e.type === 'opp_place')));
      if (empty) {
        localStorage.removeItem(LIVE_MATCH_KEY);
        return null;
      }
    } catch (_) {}
    const leftAt = (typeof s.leftAt === 'number' && s.leftAt > 0) ? s.leftAt : s.t;
    const age = now - leftAt;
    const reconnectMs = reconnectWindowMs(s);
    // Prefer wall-clock match end: allow rejoin while match time remains
    let clockEnd = 0;
    try {
      if (typeof s.clockEndTs === 'number' && s.clockEndTs > 0) clockEnd = s.clockEndTs;
      else if (typeof s.vsTimeLeft === 'number') clockEnd = leftAt + Math.max(0, s.vsTimeLeft) * 1000;
    } catch (_) {}
    const matchStillRunning = clockEnd > now + 1500;
    // Expire only if reconnect window AND match clock are both over
    if (age > reconnectMs + 5000 && !matchStillRunning) {
      localStorage.removeItem(LIVE_MATCH_KEY);
      return null;
    }
    // Soft: if age > reconnect but match still running, keep snap for auto-rejoin
    return s;
  } catch (_) { return null; }
}
function resolveRejoinAwait(payload) {
  try {
    const fn = window._rejoinAwait;
    window._rejoinAwait = null;
    if (typeof fn === 'function') fn(payload);
  } catch (_) {}
}
/** Quiet probe: if opponent says match ended (or unreachable), drop rejoin toast. */
function probeAndCleanLiveMatch() {
  const snap = readLiveMatch();
  if (!snap) { try { hideMatchRejoinPanel(); } catch (_) {} return false; }
  if (vsActive || BPState.mpRejoiningMatch) return true;
  return true;
}
/** True when no one has placed a piece and scores are still 0-0. */
function isEmptyMatchNoMoves() {
  try {
    if (BPState.matchHadAnyPlace) return false;
    const hasPlace = Array.isArray(matchLog) && matchLog.some(e => e && (e.type === 'place' || e.type === 'opp_place'));
    if (hasPlace) return false;
    if ((score | 0) !== 0 || (oppScore | 0) !== 0) return false;
    return true;
  } catch (_) {
    return (score | 0) === 0 && (oppScore | 0) === 0;
  }
}
/** Align with abortPreMatch / handleOpponentDisconnect: loading or empty (no places) = pre-start. */
function isPreStartOrEmptyMatchLeave() {
  try {
    if (!vsActive && (
      (typeof isMatchLoadActive === 'function' && isMatchLoadActive())
      || !!mpLoading || !!vsIntroLock || !!mpMatchStarting
    )) return true;
    // Went live but nobody placed: always cancel as pre-start (no time window).
    // Leaver must not keep a rejoin snapshot; stayer must not freeze on DC wait.
    if (mpMode && isEmptyMatchNoMoves()) return true;
  } catch (_) {}
  return false;
}
function notifyLeavingMatch() {
  try { sessionStorage.setItem('bp_rejoin_storm', '1'); } catch (_) {}
  try { window._thisMatchHadRejoin = true; } catch (_) {}

  if (!mpMode) return;
  // Pre-live / empty just-started leave: cancel for opponent, never persist rejoin snapshot
  const preLive = isPreStartOrEmptyMatchLeave();
  if (preLive) {
    // Fire both signals repeatedly — Opera may drop the first packet on tab close
    const blast = () => {
      
      
    };
    try { blast(); } catch (_) {}
    try { blast(); } catch (_) {}
    
    // After boards were prepared / "Старт!" shown — record local forfeit so history is not empty
    try {
      const bound = (_matchLoad && _matchLoad.meBound && _matchLoad.oppBound)
        || mode === 'versus'
        || !!vsIntroLock
        || !!mpMatchStarting
        || !!vsActive;
      if (bound && !BPState.matchEnded) {
        // Soft local loss record without full live fight UI
        BPState.matchEnded = true;
        vsActive = false;
        const opp = oppName || mpOppName || 'Соперник';
        const entry = {
          id: Date.now() + '_' + Math.random().toString(36).slice(2, 7),
          opp: opp,
          oppName: opp,
          botId: null,
          mySkinId: (typeof equippedSkinId !== 'undefined' ? equippedSkinId : null) || 'default',
          myBoardId: (typeof equippedBoardId !== 'undefined' ? equippedBoardId : null) || 'field_default',
          oppSkinId: (typeof window.mpOppSkinId === 'string' && window.mpOppSkinId) ? window.mpOppSkinId : null,
          oppBoardId: (typeof window.mpOppBoardId === 'string' && window.mpOppBoardId) ? window.mpOppBoardId : null,
          my: 0,
          oppScore: 0,
          result: 'Поражение',
          delta: 0,
          mode: mpFromMatchmaking ? 'online' : 'friendly',
          difficulty: '',
          duration: vsDuration || 120,
          timeLeft: vsDuration || 120,
          date: Date.now(),
          reason: 'leave_before_start',
          moves: []
        };
        try {
          matchHistory.unshift(entry);
          if (matchHistory.length > 30) matchHistory = matchHistory.slice(0, 30);
          localStorage.setItem('bp_history', JSON.stringify(matchHistory));
          try { if (typeof scheduleHistorySync === 'function') scheduleHistorySync(); } catch (_2) {}
        } catch (_) {}
      }
    } catch (_) {}
    try { clearMatchLoadState(); } catch (_) {}
    try { hideMatchLoading(); } catch (_) {}
    try { vsIntroLock = false; mpMatchStarting = false; mpLoading = false; } catch (_) {}
    // Critical: never offer "переподключиться" into a match the opponent already cancelled
    try { clearLiveMatch(); } catch (_) {}
    try { myDcAt = 0; oppDcAt = 0; bothAwayMode = false; } catch (_) {}
    return;
  }
  // Allow leave stamp even if vsActive just flipped — still need rejoin snapshot
  if (!vsActive && !readLiveMatch()) return;
  try {
    if (!myDcAt) myDcAt = Date.now();
  } catch (_) { myDcAt = Date.now(); }
  try {
    if (oppDcAt > 0) bothAwayMode = true;
  } catch (_) {}
  try { myDcAt = Date.now(); } catch (_) {}
  try { bothAwayMode = !!(oppDcAt > 0); } catch (_) {}
  try { persistLiveMatch({ forceLeave: true }); } catch (_) {}
  
  
  // Force flush storage for mobile webviews
  try { localStorage.setItem(LIVE_MATCH_KEY, localStorage.getItem(LIVE_MATCH_KEY) || ''); } catch (_) {}
}
window.addEventListener('pagehide', () => { try { notifyLeavingMatch(); } catch (_) {} });
window.addEventListener('beforeunload', () => { try { notifyLeavingMatch(); } catch (_) {} });

function showMatchRejoinPanel(snap) {
  // New system: no rejoin toasts/panels — auto-return into the match
  try { hideMatchRejoinPanel(); } catch (_) {}
  if (!snap) {
    try { snap = readLiveMatch(); } catch (_) { snap = null; }
  }
  if (!snap) return;
  if (BPState.matchEnded || vsActive || BPState.mpRejoiningMatch) return;
  try {
    if (typeof snap.leftAt === 'number') myDcAt = snap.leftAt;
    if (typeof snap.oppLeftAt === 'number' && snap.oppLeftAt > 0) oppDcAt = snap.oppLeftAt;
    if (myDcAt && oppDcAt) bothAwayMode = true;
  } catch (_) {}
  // Keep listening so forfeit packets still arrive
  try { startRejoinPanelListen(snap); } catch (_) {}
  // Auto rejoin immediately (and retry a few times if opponent is not up yet)
  try {
    if (window._autoRejoinTimer) { clearTimeout(window._autoRejoinTimer); window._autoRejoinTimer = null; }
  } catch (_) {}
  const tryAuto = (attempt) => {
    try {
      if (BPState.matchEnded || vsActive) return;
      const s = readLiveMatch();
      if (!s) return;
      if (BPState.mpRejoiningMatch) {
        window._autoRejoinTimer = setTimeout(() => tryAuto(attempt), 800);
        return;
      }
      attemptMatchRejoin().then(() => {
        try {
          if (!vsActive && !BPState.matchEnded && readLiveMatch() && attempt < 8) {
            window._autoRejoinTimer = setTimeout(() => tryAuto(attempt + 1), 1200);
          }
        } catch (_) {}
      }).catch(() => {
        try {
          if (!vsActive && !BPState.matchEnded && readLiveMatch() && attempt < 8) {
            window._autoRejoinTimer = setTimeout(() => tryAuto(attempt + 1), 1200);
          }
        } catch (_) {}
      });
    } catch (_) {}
  };
  tryAuto(0);
}

function hideMatchRejoinPanel() {
  const el = document.getElementById('matchRejoinPanel');
  if (el) el.classList.remove('show');
}
function showRejoinLoading(msg) {
  BPState.rejoinLoading = true;
  BPState.rejoinInputLock = true;
  placingLock = true;
  try { cancelActivePieceDrag(); } catch (_) {}
  try { document.body.classList.add('rejoin-loading'); } catch (_) {}
  const el = document.getElementById('rejoinLoading');
  if (el) {
    const sub = document.getElementById('rejoinLoadingSub');
    if (sub) sub.textContent = msg || (typeof globalThis.t==='function'?globalThis.t('js.returnMatch','Возврат в матч…'):'Возврат в матч…');
    el.classList.add('show');
  }
}
function hideRejoinLoading() {
  BPState.rejoinLoading = false;
  try { document.body.classList.remove('rejoin-loading'); } catch (_) {}
  const el = document.getElementById('rejoinLoading');
  if (el) el.classList.remove('show');
}
function finishRejoinLoading() {
  // Brief lock + overlay, then unlock for play
  showRejoinLoading('Возврат в матч…');
  if (window._rejoinUnlockTimer) {
    try { clearTimeout(window._rejoinUnlockTimer); } catch (_) {}
  }
  const unlockNow = () => {
    try {
      cancelActivePieceDrag();
      hideRejoinLoading();
      BPState.rejoinLoading = false;
      BPState.rejoinInputLock = false;
      BPState.mpRejoiningMatch = false;
      placingLock = false;
      try { ensureMatchClockRunning(); } catch (_) {}
      try { ensurePlayableIfLive(); } catch (_) {}
    } catch (_) {
      hideRejoinLoading();
      BPState.rejoinLoading = false;
      BPState.rejoinInputLock = false;
      BPState.mpRejoiningMatch = false;
      placingLock = false;
    }
    window._rejoinUnlockTimer = null;
  };
  window._rejoinUnlockTimer = setTimeout(() => {
    hideRejoinLoading();
    window._rejoinUnlockTimer = setTimeout(unlockNow, 400);
  }, 350);
  // Hard safety: never leave locks on longer than 2.5s
  setTimeout(() => {
    if (BPState.rejoinLoading || BPState.rejoinInputLock || placingLock) {
      unlockNow();
    }
  }, 2500);
}

// Capture-phase: swallow tray/board input while rejoin lock is on
(function rejoinInputCaptureBlock() {
  const block = (e) => {
    try {
      const ov = document.getElementById('rejoinLoading');
      const ovOn = ov && ov.classList.contains('show');
      if (!ovOn) {
        // Sticky flags must not freeze a live room match
        if (roomMatchMode || BPState.roomMatchMode) {
          BPState.rejoinLoading = false;
          BPState.rejoinInputLock = false;
        }
        if (!BPState.rejoinLoading && !BPState.rejoinInputLock) return;
      }
    } catch (_) {}
    if (!BPState.rejoinLoading && !BPState.rejoinInputLock) return;
    try {
      const t = e.target;
      if (t && t.closest && (t.closest('#screenVersus .pieces-area') || t.closest('#screenVersus .board-wrap') || t.closest('#screenVersus .piece-slot'))) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      }
    } catch (_) {}
  };
  ['pointerdown', 'touchstart', 'mousedown'].forEach(ev => {
    document.addEventListener(ev, block, true);
  });
})();

/**
 * One player rejoins while the other is still offline.
 * Match UI + wall-clock timer run; opponent side keeps listening / retrying dial.
 */
/** While rejoin panel is open, stay reachable so opponent «Сдаться» arrives as quiet win. */
function startRejoinPanelListen(snap) {
  return;
}

function enterSoloRejoinWait(snap, existingPeer) {
  try {
    if (typeof MatchClient !== "undefined" && MatchClient.matchId) {
      MatchClient.rejoin(MatchClient.matchId, MatchClient.token);
    }
  } catch (_) {}
}


function packHandForNet(arr) {
  return (arr || []).map(p => ({
    shape: (p && p.shape ? p.shape : []).map(c => Array.isArray(c) ? c.slice() : c),
    color: p && p.color,
    used: !!(p && p.used)
  }));
}
function buildFullMatchSyncPayload(extra) {
  const base = {
    type: 'match_rejoin_ok',
    stillLive: !BPState.matchEnded && (!!vsActive || !!BPState.mpRejoiningMatch || !!BPState.soloRejoinActive),
    name: myNickname,
    score: score | 0,
    oppScore: oppScore | 0,
    vsTimeLeft: vsTimeLeft | 0,
    clockEndTs: (typeof BPState.matchClockEndTs === 'number') ? BPState.matchClockEndTs : 0,
    grid: grid,
    oppGrid: oppGrid,
    pieces: packHandForNet(pieces),
    oppPieces: packHandForNet(oppPieces),
    boardId: equippedBoardId,
    skinId: equippedSkinId,
    matchStartTs: matchStartTs || 0,
    fullSync: true,
    t: Date.now()
  };
  if (extra && typeof extra === 'object') {
    Object.keys(extra).forEach(k => { base[k] = extra[k]; });
  }
  return base;
}
/** Apply remote state as truth (remote "me" → our opp). Always full replace of boards/hands. */
function handSig(arr) {
  try {
    return (arr || []).map(p => {
      if (!p) return '_';
      const sh = (p.shape || []).map(c => (c && c[0]) + ',' + (c && c[1])).join(';');
      return (p.used ? '1' : '0') + '#' + sh + '#' + (p.color || '');
    }).join('/');
  } catch (_) { return ''; }
}
function gridSig(g) {
  try {
    if (!Array.isArray(g)) return '';
    let s = '';
    for (let r = 0; r < g.length; r++) {
      const row = g[r];
      if (!Array.isArray(row)) continue;
      for (let c = 0; c < row.length; c++) s += row[c] ? '1' : '0';
      s += '|';
    }
    return s;
  } catch (_) { return ''; }
}
function countUnusedInHand(arr) {
  try {
    return (arr || []).filter(p => p && !p.used && p.shape && p.shape.length).length;
  } catch (_) { return 0; }
}
function cloneHand(arr) {
  return (arr || []).map(p => ({
    shape: (p.shape || []).map(c => Array.isArray(c) ? c.slice() : c),
    color: p.color,
    used: !!p.used
  }));
}

