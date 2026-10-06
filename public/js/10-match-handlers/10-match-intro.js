/**
 * Block Puzzle — js/10-match-handlers/03-match-intro.js
 * Match intro sequence and load completion.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
/**
 * Single intro pipeline for new match AND rejoin:
 *   «Почти готово…» (load cosmetics/boards) → «Старт!» once → unlock.
 * Never runs twice for the same match session.
 */
function _currentMatchIntroKey() {
  try {
    if (typeof MatchClient !== 'undefined' && MatchClient.matchId)
      return String(MatchClient.matchId);
  } catch (_) {}
  return '';
}

function runMatchIntroSequence(opts) {
  opts = opts || {};
  const key = _currentMatchIntroKey();
  try {
    // Start already shown for this match — never replay
    if (key && BPState.introStartShownForId === key) return;
    if (BPState.matchGoFinishing) return;
    // Already mid-intro with a live timer — do not restart or kill it
    if (BPState.matchIntroSeqRunning && BPState.matchIntroTimer) return;
    if (BPState.matchStartPhase) return;
  } catch (_) {}
  try { BPState.matchIntroSeqRunning = true; } catch (_) {}
  // Claim "running" for this match (NOT completed — that is set only when Start shows)
  try {
    if (key) window._introRunningMatchId = key;
  } catch (_) {}
  try {
    BPState.matchStartLocked = false;
    BPState.matchStartPhase = false;
    BPState.matchIntroSeqDone = false;
  } catch (_) {}

  const sub = opts.sub
    || (mpFromMatchmaking ? (typeof globalThis.t==='function'?globalThis.t('js.rankedMatch','Рейтинговый матч'):'Рейтинговый матч') : (typeof globalThis.t==='function'?globalThis.t('js.friendlyMatch','Товарищеский матч'):'Товарищеский матч'));
  try {
    showMatchLoading('Загрузка', 'Почти готово…', sub);
  } catch (_) {}

  // Apply cosmetics / boards while overlay shows «Почти готово…»
  try {
    if (opts.applyCosmetics !== false) {
      if (window.mpOppSkinId && typeof applyOppSkin === 'function') applyOppSkin(window.mpOppSkinId);
      if (window.mpOppBoardId && typeof applyOppBoard === 'function') applyOppBoard(window.mpOppBoardId);
      if (typeof applyEquippedSkin === 'function') applyEquippedSkin();
      if (typeof applyEquippedBoard === 'function') applyEquippedBoard();
      try {
        BPState.quietPieceRender = true;
        BPState.animateDealIn = false;
        if (typeof boardMe !== 'undefined' && boardMe && typeof grid !== 'undefined')
          renderGrid(grid, boardMe);
        if (typeof boardOpp !== 'undefined' && boardOpp && typeof oppGrid !== 'undefined')
          renderGrid(oppGrid, boardOpp);
        const area = document.getElementById('piecesAreaVs');
        if (area && typeof renderPieces === 'function' && pieces && pieces.length)
          renderPieces(area);
        if (typeof renderOppPieces === 'function' && oppPieces && oppPieces.length)
          renderOppPieces();
        BPState.quietPieceRender = false;
      } catch (_) {}
      // Opening hands for replay — must exist even if deal arrived before vsActive
      try {
        if (typeof logDeal === 'function') {
          if (pieces && pieces.length) logDeal('me', pieces);
          if (oppPieces && oppPieces.length) logDeal('opp', oppPieces);
        }
      } catch (_) {}
    }
  } catch (_) {}

  const isRejoin = !!(opts && opts.reason === 'rejoin');
  // Server-synced intro: unlock exactly at matchPlayStartTs (both clients same wall clock).
  // Fallback only when playStartTs missing (legacy / rejoin).
  const playStart = (typeof BPState.matchPlayStartTs === 'number' && BPState.matchPlayStartTs > 0)
    ? BPState.matchPlayStartTs
    : 0;
  const START_FLASH_MS = 1100; // «Старт!» visible window before unlock
  const baseHoldFallback = (typeof opts.minMs === 'number' && opts.minMs > 0)
    ? opts.minMs
    : (isRejoin ? 1000 : 800);

  const goStart = () => {
    try {
      if (BPState.matchIntroTimer) clearTimeout(BPState.matchIntroTimer);
    } catch (_) {}
    const scheduleFinish = () => {
      BPState.matchIntroTimer = null;
      try { finishRoomMatchLoadAndGo(); } catch (e) {
        console.warn('runMatchIntroSequence', e);
        try { forceUnlockAfterIntroStuck(); } catch (_) {}
      }
    };
    if (playStart > 0 && !isRejoin) {
      // Show «Старт!» START_FLASH_MS before playStart; unlock at playStart
      const now = Date.now();
      const untilStartFlash = Math.max(0, playStart - START_FLASH_MS - now);
      const untilUnlock = Math.max(0, playStart - now);
      BPState.matchIntroTimer = setTimeout(() => {
        // Enter «Старт!» phase early; finishRoomMatchLoadAndGo waits for playStart
        try { BPState._introAwaitPlayStart = true; } catch (_) {}
        scheduleFinish();
      }, untilStartFlash);
      // Safety: if something blocks finish, force at playStart+200
      try {
        if (BPState.matchIntroSafetyTimer) clearTimeout(BPState.matchIntroSafetyTimer);
      } catch (_) {}
      BPState.matchIntroSafetyTimer = setTimeout(() => {
        if (!BPState.matchIntroSeqDone) {
          try { finishRoomMatchLoadAndGo(); } catch (_) {}
        }
      }, untilUnlock + 400);
    } else {
      BPState.matchIntroTimer = setTimeout(scheduleFinish, baseHoldFallback);
    }
  };

  // All network sync happens NOW under «Почти готово» — never after Start
  const runPreStartSync = () => {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        try {
          // Final quiet paint with whatever state we have
          BPState.quietPieceRender = true;
          BPState.animateDealIn = false;
          if (typeof boardMe !== 'undefined' && boardMe && grid)
            (typeof softRenderGrid === 'function' ? softRenderGrid : renderGrid)(grid, boardMe);
          if (typeof boardOpp !== 'undefined' && boardOpp && oppGrid)
            (typeof softRenderGrid === 'function' ? softRenderGrid : renderGrid)(oppGrid, boardOpp);
          const area = document.getElementById('piecesAreaVs');
          if (area && pieces && pieces.length && typeof renderPieces === 'function') renderPieces(area);
          if (oppPieces && oppPieces.length && typeof renderOppPieces === 'function') renderOppPieces();
          const myEl = document.getElementById('myScore');
          const oppEl = document.getElementById('oppScore');
          if (myEl) myEl.textContent = String(score | 0);
          if (oppEl) oppEl.textContent = String(oppScore | 0);
          BPState.quietPieceRender = false;
        } catch (_) {}
        resolve();
      };
      try {
        if (typeof MatchClient === 'undefined' || !MatchClient.sync) {
          finish();
          return;
        }
        // One-shot listener for next state packet
        let off = null;
        const onState = () => {
          try { if (off) off(); } catch (_) {}
          setTimeout(finish, 80);
        };
        try {
          if (typeof MatchClient.on === 'function') {
            MatchClient.on('state', onState);
            off = () => { try { MatchClient.off && MatchClient.off('state', onState); } catch (_) {} };
          }
        } catch (_) {}
        window._lastRejoinSyncAt = Date.now();
        try { MatchClient.sync({ _fromSync: 1 }); } catch (_) {}
        // If hand empty, also request deal under overlay
        try {
          if (!pieces || !pieces.length || pieces.every(p => p && p.used)) {
            MatchClient.deal && MatchClient.deal({});
          }
        } catch (_) {}
        // Cap wait — never hang on «Почти готово»; rejoin needs more settle time
        setTimeout(finish, isRejoin ? 1000 : 550);
      } catch (_) {
        finish();
      }
    });
  };

  try { window._pendingPostIntroSync = false; } catch (_) {}
  runPreStartSync().then(goStart).catch(goStart);

  // Safety net
  try {
    if (BPState.matchIntroSafetyTimer) clearTimeout(BPState.matchIntroSafetyTimer);
  } catch (_) {}
  BPState.matchIntroSafetyTimer = setTimeout(() => {
    BPState.matchIntroSafetyTimer = null;
    try {
      if (!BPState.introStartShownForId || BPState.introStartShownForId !== key) {
        console.warn('intro safety — force Start/unlock');
        finishRoomMatchLoadAndGo();
      }
    } catch (_) {
      try { forceUnlockAfterIntroStuck(); } catch (_2) {}
    }
  }, 5500);
}

function forceUnlockAfterIntroStuck() {
  try {
    const el = document.getElementById('matchIntro');
    if (el) {
      el.classList.remove('mi-go', 'visible');
      el.style.display = 'none';
      el.style.pointerEvents = 'none';
    }
  } catch (_) {}
  try {
    BPState.matchStartPhase = false;
    BPState.matchStartLocked = true;
    BPState.matchIntroSeqRunning = false;
    BPState.matchIntroSeqDone = true;
    BPState.matchGoFinishing = false;
    BPState.matchAwaitingGo = false;
    const key = _currentMatchIntroKey();
    if (key) {
      window._introCompletedMatchId = key;
      BPState.introStartShownForId = key;
    }
  } catch (_) {}
  try {
    vsActive = true;
    placingLock = false;
    vsIntroLock = false;
    mpLoading = false;
    mpMatchStarting = false;
    unlockRoomPlay && unlockRoomPlay();
    if (typeof startMatchWallClock === 'function' && BPState.matchClockEndTs)
      startMatchWallClock(BPState.matchClockEndTs);
    else if (typeof ensureMatchClockRunning === 'function') ensureMatchClockRunning();
  } catch (_) {}
}

/** After loading: flash "Старт!", then unlock and start the match timer. */
function finishRoomMatchLoadAndGo() {
  try { if (typeof prepareUiForLiveMatch === 'function') prepareUiForLiveMatch(); } catch (_) {}
  try {
    if (BPState.matchGoFallbackTimer) {
      clearTimeout(BPState.matchGoFallbackTimer);
      BPState.matchGoFallbackTimer = null;
    }
  } catch (_) {}
  // Only one «Старт!» per match / rejoin session
  const key = _currentMatchIntroKey();
  if (key && BPState.introStartShownForId === key) return;
  if (BPState.matchGoFinishing) return;
  BPState.matchGoFinishing = true;
  try {
    BPState.matchIntroSeqDone = true;
    if (key) {
      window._introCompletedMatchId = key;
      BPState.introStartShownForId = key;
    }
    if (BPState.matchIntroSafetyTimer) {
      clearTimeout(BPState.matchIntroSafetyTimer);
      BPState.matchIntroSafetyTimer = null;
    }
  } catch (_) {}
  try {
    mpLoading = false;
    mpMatchStarting = false;
    BPState.matchAwaitingGo = false;

    // «Старт!» is final — lock so nothing can change the overlay text afterward
    try {
      BPState.matchStartPhase = true;
      BPState.matchStartLocked = true;
    } catch (_) {}
    try {
      const el = document.getElementById('matchIntro');
      if (el) {
        const lab = document.getElementById('miLabel');
        const tit = document.getElementById('miTitle');
        const su = document.getElementById('miSub');
        if (lab) lab.textContent = (typeof globalThis.t==='function'?globalThis.t('js.ready','Готово'):'Готово');
        if (tit) tit.textContent = (typeof globalThis.t==='function'?globalThis.t('js.start','Старт!'):'Старт!');
        if (su) su.textContent = mpFromMatchmaking ? (typeof globalThis.t==='function'?globalThis.t('js.rankedMatch','Рейтинговый матч'):'Рейтинговый матч') : (typeof globalThis.t==='function'?globalThis.t('js.friendlyMatch','Товарищеский матч'):'Товарищеский матч');
        el.classList.add('visible', 'mi-go');
        el.setAttribute('aria-hidden', 'false');
        el.style.display = 'flex';
        el.style.pointerEvents = 'auto';
        el.style.opacity = '1';
        el.style.visibility = 'visible';
        el.style.zIndex = '9000';
      }
    } catch (_) {}

    // Hold «Старт!» until server playStartTs so both clients unlock together
    const playStart = (typeof BPState.matchPlayStartTs === 'number' && BPState.matchPlayStartTs > 0)
      ? BPState.matchPlayStartTs
      : 0;
    const startHoldMs = playStart > 0
      ? Math.max(400, Math.min(2500, playStart - Date.now()))
      : 1100;
    // While «Старт!» is on screen — finalize ALL DOM under the overlay (invisible to user)
    try {
      BPState.animateDealIn = false;
      BPState.quietPieceRender = true;
      BPState.paintFrozen = false; // allow one quiet final paint under overlay
      if (typeof boardMe !== 'undefined' && boardMe && typeof grid !== 'undefined') {
        if (typeof softRenderGrid === 'function') softRenderGrid(grid, boardMe);
        else if (typeof renderGrid === 'function') renderGrid(grid, boardMe);
      }
      if (typeof boardOpp !== 'undefined' && boardOpp && typeof oppGrid !== 'undefined') {
        if (typeof softRenderGrid === 'function') softRenderGrid(oppGrid, boardOpp);
        else if (typeof renderGrid === 'function') renderGrid(oppGrid, boardOpp);
      }
      const area = document.getElementById('piecesAreaVs');
      if (area && pieces && pieces.length) {
        if (typeof renderPieces === 'function') renderPieces(area);
      }
      if (oppPieces && oppPieces.length && typeof renderOppPieces === 'function') renderOppPieces();
      const myEl = document.getElementById('myScore');
      const oppEl = document.getElementById('oppScore');
      if (myEl) myEl.textContent = String(score | 0);
      if (oppEl) oppEl.textContent = String(oppScore | 0);
      try { updateVersusNameLabels && updateVersusNameLabels(); } catch (_) {}
      try { unlockRoomPlay && unlockRoomPlay(); } catch (_) {}
      BPState.quietPieceRender = false;
      // Freeze again so nothing can paint between now and hide
      BPState.paintFrozen = true;
    } catch (_) {}

    setTimeout(() => {
      // Hide overlay — board underneath is already final
      try {
        const el = document.getElementById('matchIntro');
        if (el) {
          el.classList.remove('mi-go', 'visible');
          el.style.display = 'none';
          el.style.pointerEvents = 'none';
          el.setAttribute('aria-hidden', 'true');
        }
      } catch (_) {}

      BPState.matchEnded = false;
      vsActive = true;
      placingLock = false;
      vsIntroLock = false;
      mpLoading = false;
      mpMatchStarting = false;
      try {
        document.body.classList.remove('match-ending', 'replay-ui', 'replay-playing');
        const fb = document.getElementById('btnForfeit');
        if (fb) { fb.style.display = ''; fb.disabled = false; fb.style.pointerEvents = ''; fb.style.opacity = ''; }
        try { forfeitLock = false; } catch (_) {}
        const liveCtrl = document.getElementById('vsLiveControls');
        if (liveCtrl) liveCtrl.style.display = '';
      } catch (_) {}
      if (!matchStartTs) matchStartTs = Date.now();
      try { window._matchWentLiveAt = matchStartTs || Date.now(); } catch (_) {}

      if (!(typeof BPState.matchClockEndTs === 'number' && BPState.matchClockEndTs > 0)) {
        BPState.matchClockEndTs = Date.now() + Math.max(0, vsTimeLeft || vsDuration || 120) * 1000;
      }
      vsTimeLeft = Math.max(0, Math.ceil((BPState.matchClockEndTs - Date.now()) / 1000));

      // Keep paint frozen + start phase a bit longer so no jumps right after overlay hides
      try {
        BPState.animateDealIn = false;
        BPState.quietPieceRender = true;
        BPState.paintFrozen = true;
        BPState.matchStartPhase = true;
      } catch (_) {}

      try {
        if (typeof startMatchWallClock === 'function') startMatchWallClock(BPState.matchClockEndTs);
        else if (typeof ensureMatchClockRunning === 'function') ensureMatchClockRunning();
      } catch (_) {}
      try { startAfkWatch && startAfkWatch(); } catch (_) {}
      try { updateTimerDisplay && updateTimerDisplay(); } catch (_) {}
      try { persistLiveMatch && persistLiveMatch(); } catch (_) {}
      try { window._pendingIntroOppDeal = null; } catch (_) {}
      try { window._pendingPostIntroSync = false; } catch (_) {}

      // Settle 2 frames + short delay before allowing any paint — calm entry into play
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            try {
              BPState.matchStartPhase = false;
              BPState.matchIntroSeqRunning = false;
              BPState.paintFrozen = false;
              BPState.quietPieceRender = false;
            } catch (_) {}
            BPState.matchGoFinishing = false;
          }, 120);
        });
      });
    }, startHoldMs);
  } catch (e) {
    BPState.matchGoFinishing = false;
    console.warn('finishRoomMatchLoadAndGo', e);
    // Emergency unlock
    try {
      vsActive = true;
      placingLock = false;
      hideMatchLoading && hideMatchLoading();
      unlockRoomPlay && unlockRoomPlay();
      startMatchWallClock && startMatchWallClock();
    } catch (_) {}
  }
}


let _privateLobbyHandlersBound = false;
