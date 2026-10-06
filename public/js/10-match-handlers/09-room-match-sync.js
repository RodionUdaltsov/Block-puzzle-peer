/**
 * Block Puzzle — js/10-match-handlers/02-room-match-sync.js
 * Presence registration, server-authoritative sync, ranked match start.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
// Register friend presence over WS (no server)
function registerWsPresence() {
  try {
    if (typeof MatchClient === 'undefined') return;
    if (!myFriendCode) return;
    // Lean presence — heavy payload only via ensureFriendPresence(true) after auth/profile save
    if (typeof ensureFriendPresence === 'function') ensureFriendPresence(true);
    else {
      MatchClient.registerPresence({
        friendCode: myFriendCode,
        name: myNickname,
        trophies: trophies | 0,
        activity: 'online',
        avatarId: typeof myAvatarId !== 'undefined' ? myAvatarId : 'init',
        status: (typeof myStatus === 'string') ? myStatus : ''
      });
    }
    const codes = (friends || []).map(f => f.code).filter(Boolean);
    if (codes.length) MatchClient.queryPresence(codes);
  } catch (_) {}
}
try {
  setTimeout(registerWsPresence, 800);
  setInterval(() => {
    try {
      if (typeof MatchClient === 'undefined') return;
      const codes = (friends || []).map(f => f.code).filter(Boolean);
      if (codes.length) MatchClient.queryPresence(codes);
    } catch (_) {}
  }, 45000);
} catch (_) {}


function rollbackPendingServerPlace() {
  const pend = BPState.pendingServerPlace;
  if (!pend) return;
  try {
    if (Array.isArray(pend.gridBefore)) {
      grid = pend.gridBefore.map(row => row.slice());
      const b = (typeof boardMe !== 'undefined' && boardMe) ? boardMe : document.getElementById('boardMe');
      if (b && typeof renderGrid === 'function') renderGrid(grid, b);
    }
    if (Array.isArray(pend.piecesBefore)) {
      pieces = pend.piecesBefore.map(p => ({
        shape: (p.shape || []).map(c => Array.isArray(c) ? c.slice() : c),
        color: p.color,
        used: !!p.used
      }));
      const area = document.getElementById('piecesAreaVs');
      if (area && typeof renderPieces === 'function') {
        BPState.quietPieceRender = true;
        renderPieces(area);
        BPState.quietPieceRender = false;
      }
    }
    if (typeof pend.scoreBefore === 'number') {
      score = pend.scoreBefore | 0;
      try { document.getElementById('myScore').textContent = String(score); } catch (_) {}
    }
  } catch (e) { console.warn('rollbackPendingServerPlace', e); }
  BPState.pendingServerPlace = null;
  placingLock = false;
}


/** Periodic soft sync — server is source of truth for board/hand/score. */
function startServerAuthSync() {
  try {
    if (BPState.serverAuthSyncIv) {
      clearInterval(BPState.serverAuthSyncIv);
      BPState.serverAuthSyncIv = null;
    }
  } catch (_) {}
  BPState.serverAuthSyncIv = setInterval(() => {
    try {
      if (!vsActive || BPState.matchEnded) return;
      if (!(roomMatchMode || BPState.roomMatchMode)) return;
      if (typeof isDragging !== 'undefined' && isDragging) return;
      if (BPState.pendingServerPlace) return;
      if (typeof MatchClient === 'undefined' || !MatchClient.connected) return;
      MatchClient.sync({});
    } catch (_) {}
  }, 5000);
}
function stopServerAuthSync() {
  try {
    if (BPState.serverAuthSyncIv) {
      clearInterval(BPState.serverAuthSyncIv);
      BPState.serverAuthSyncIv = null;
    }
  } catch (_) {}
}

function roomSendPlace(payload) {
  try {
    if (roomMatchMode && typeof MatchClient !== 'undefined') {
      MatchClient.place(payload);
    }
  } catch (_) {}
}
function roomSendDeal(payload) {
  try {
    if (roomMatchMode && typeof MatchClient !== 'undefined') {
      MatchClient.deal(payload);
    }
  } catch (_) {}
}


function beginRoomRankedMatch(data, opts) {
  opts = opts || {};
  const waitForGo = !!(opts.waitForGo || (data && data.loading) || BPState.matchAwaitingGo);
  try {
    try {
      BPState.rejoinLoading = false;
      BPState.rejoinInputLock = false;
      BPState.mpRejoiningMatch = false;
      document.body.classList.remove('rejoin-loading');
      isDragging = false;
      selectedIdx = -1;
    } catch (_) {}
    roomMatchMode = true;
    BPState.roomMatchMode = true;
    mpMode = true;
    vsModeType = 'online';
    mode = 'versus';
    mpFromMatchmaking = !(data && data.source === 'lobby');
    mpGameSource = (data && data.source === 'lobby') ? 'lobby' : 'ranked';
    BPState.matchHadAnyPlace = false;
    try { BPState.matchEnded = false; } catch (_) {}
    try {
      if (!(opts && opts.rejoin)) {
        matchLog = [];
        matchStartTs = Date.now();
      } else if (!matchStartTs) {
        matchStartTs = Date.now();
      }
    } catch (_) {}

    // Lock play until match_go
    vsActive = false;
    placingLock = true;
    vsIntroLock = true;
    mpMatchStarting = true;
    mpLoading = true;
    // Restore chrome after previous match end / review / forfeit
    try {
      document.body.classList.remove('match-ending', 'replay-ui', 'replay-playing', 'rejoin-loading', 'quiet-hands');
      const fb = document.getElementById('btnForfeit');
      if (fb) { fb.style.display = ''; fb.disabled = false; fb.style.pointerEvents = ''; fb.style.opacity = ''; }
      try { forfeitLock = false; } catch (_) {}
      const liveCtrl = document.getElementById('vsLiveControls');
      if (liveCtrl) liveCtrl.style.display = '';
      const footer = document.getElementById('vsFooter');
      if (footer) footer.style.display = '';
      const reviewBar = document.getElementById('reviewBar');
      if (reviewBar) {
        reviewBar.classList.remove('visible', 'replay-dock');
      }
      const piecesVs = document.getElementById('piecesAreaVs');
      if (piecesVs) {
        piecesVs.style.opacity = '1';
        piecesVs.style.pointerEvents = 'none'; // still locked until go
      }
    } catch (_) {}

    score = (data && data.me && typeof data.me.score === 'number') ? (data.me.score | 0) : 0;
    oppScore = (data && data.opp && typeof data.opp.score === 'number') ? (data.opp.score | 0) : 0;
    grid = (data && data.me && Array.isArray(data.me.grid))
      ? data.me.grid.map(row => row.slice())
      : Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    oppGrid = (data && data.opp && Array.isArray(data.opp.grid))
      ? data.opp.grid.map(row => row.slice())
      : Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    if (data && data.me && Array.isArray(data.me.pieces) && data.me.pieces.length) {
      pieces = data.me.pieces.map(p => ({
        shape: (p.shape || []).map(c => Array.isArray(c) ? c.slice() : c),
        color: p.color,
        used: !!p.used
      }));
    }
    if (data && data.opp && Array.isArray(data.opp.pieces) && data.opp.pieces.length) {
      oppPieces = data.opp.pieces.map(p => ({
        shape: (p.shape || []).map(c => Array.isArray(c) ? c.slice() : c),
        color: p.color,
        used: !!p.used
      }));
    }
    try {
      const empty = !pieces || !pieces.length || pieces.every(p => p && p.used);
      if (empty && typeof MatchClient !== 'undefined') {
        MatchClient.deal({});
        MatchClient.sync({});
      }
    } catch (_) {}

    if (data && data.duration) vsDuration = data.duration;
    // Do not start clock while loading — full duration shown frozen
    BPState.matchClockEndTs = 0;
    vsTimeLeft = vsDuration || 120;
    matchStartTs = 0;

    try { clearBotMatchResidue && clearBotMatchResidue(); } catch (_) {}
    currentBot = null;
    try {
      if (typeof applyOppProfileFromServer === 'function' && data && data.opp) {
        applyOppProfileFromServer(data.opp, { alwaysPaint: true });
      } else if (data && data.opp) {
        if (data.opp.name) { mpOppName = data.opp.name; oppName = mpOppName; }
        if (typeof data.opp.trophies === 'number') mpOppTrophies = data.opp.trophies | 0;
        if (data.opp.avatarId) window.mpOppAvatarId = data.opp.avatarId;
        if (data.opp.avatarCustom) window.mpOppAvatarCustom = data.opp.avatarCustom;
        if (data.opp.skinId && typeof applyOppSkin === 'function') {
          window.mpOppSkinId = data.opp.skinId;
          applyOppSkin(data.opp.skinId);
        }
        if (data.opp.boardId && typeof applyOppBoard === 'function') {
          window.mpOppBoardId = data.opp.boardId;
          applyOppBoard(data.opp.boardId);
        }
      }
    } catch (_) {}

    showScreen('versus');
    try {
      document.body.classList.remove('rejoin-loading', 'match-ending', 'quiet-hands');
      const rl = document.getElementById('rejoinLoading');
      if (rl) {
        rl.classList.remove('show', 'visible');
        rl.style.display = 'none';
      }
    } catch (_) {}

    try {
      if (typeof createBoardDOM === 'function') {
        if (boardMe) createBoardDOM(boardMe);
        if (boardOpp) createBoardDOM(boardOpp);
      }
      renderGrid(grid, boardMe);
      renderGrid(oppGrid, boardOpp);
    } catch (_) {}

    try {
      const area = document.getElementById('piecesAreaVs');
      try {
        if (opts.rejoin || opts.quietLoad) {
          BPState.animateDealIn = false;
          BPState.quietPieceRender = true;
        } else {
          BPState.animateDealIn = true;
          BPState.quietPieceRender = false;
        }
      } catch (_) {}
      if (area && typeof renderPieces === 'function') renderPieces(area);
      if (typeof renderOppPieces === 'function') renderOppPieces();
      try { BPState.quietPieceRender = false; } catch (_) {}
      if (area) {
        area.style.opacity = '1';
        area.style.filter = 'none';
        area.style.pointerEvents = 'none'; // locked until go
        area.querySelectorAll('.piece-slot').forEach(s => {
          if (!s.classList.contains('used')) {
            s.style.opacity = '1';
            s.style.filter = 'none';
            s.style.pointerEvents = 'none';
            s.classList.add('show');
            s.classList.remove('lifting');
          }
        });
      }
    } catch (_) {}

    try {
      document.getElementById('myScore').textContent = String(score);
      document.getElementById('oppScore').textContent = String(oppScore);
    } catch (_) {}
    try { updateVersusNameLabels && updateVersusNameLabels(); } catch (_) {}
    try { updateTimerDisplay && updateTimerDisplay(); } catch (_) {}

    // Cosmetics helper (shared) — opp identity always from server payload
    const applyCosmetics = () => {
      try {
        if (data && data.opp && typeof applyOppProfileFromServer === 'function') {
          applyOppProfileFromServer(data.opp, { alwaysPaint: true });
        } else if (data && data.opp) {
          if (data.opp.skinId && typeof applyOppSkin === 'function') {
            window.mpOppSkinId = data.opp.skinId;
            applyOppSkin(data.opp.skinId);
          }
          if (data.opp.boardId && typeof applyOppBoard === 'function') {
            window.mpOppBoardId = data.opp.boardId;
            applyOppBoard(data.opp.boardId);
          }
          if (data.opp.avatarId) window.mpOppAvatarId = data.opp.avatarId;
          if (data.opp.avatarCustom) window.mpOppAvatarCustom = data.opp.avatarCustom;
          try { updateVersusNameLabels && updateVersusNameLabels(); } catch (_) {}
        }
        if (typeof applyEquippedSkin === 'function') applyEquippedSkin();
        if (typeof applyEquippedBoard === 'function') applyEquippedBoard();
        try {
          if (typeof boardMe !== 'undefined' && boardMe) renderGrid(grid, boardMe);
          if (typeof boardOpp !== 'undefined' && boardOpp) renderGrid(oppGrid, boardOpp);
        } catch (_) {}
      } catch (_) {}
    };

    const isRejoinQuiet = !!(opts.rejoin || opts.quietLoad);

    if (isRejoinQuiet) {
      // Rejoin: no staged text flashes, no match_ready (would re-trigger match_go → double Start)
      // Cosmetics applied inside runMatchIntroSequence while «Почти готово…» is shown
      try { applyCosmetics(); } catch (_) {}
    } else {
      // New match: single loading label, then cosmetics, then ready
      try {
        showMatchLoading(
          'Загрузка',
          'Почти готово…',
          mpFromMatchmaking ? (typeof globalThis.t==='function'?globalThis.t('js.rankedMatch','Рейтинговый матч'):'Рейтинговый матч') : (typeof globalThis.t==='function'?globalThis.t('js.friendlyMatch','Товарищеский матч'):'Товарищеский матч')
        );
      } catch (_) {}

      const sendReady = () => {
        try {
          if (typeof MatchClient !== 'undefined' && MatchClient.matchReady) {
            MatchClient.matchReady();
          }
        } catch (_) {}
      };

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          applyCosmetics();
          setTimeout(sendReady, 100);
        });
      });
      setTimeout(sendReady, 500);
      setTimeout(sendReady, 1400);
    }

    // Soft sync only for NEW matches — rejoin applies snapshot under «Почти готово»
    try {
      if (!(opts && (opts.rejoin || opts.quietLoad))) {
        if (typeof MatchClient !== 'undefined') MatchClient.sync({});
      }
    } catch (_) {}

    // Fallback: only for NEW matches waiting on match_go — never on rejoin.
    // Must NOT start play early: server goLive() broadcasts match_go only when BOTH
    // players have marked ready (fully loaded). Local fallback is a last-resort
    // safety net after a long wait so a stuck peer does not freeze forever.
    // Clock still comes from server when match_go arrives; do not invent local start.
    if (waitForGo && !(opts && (opts.rejoin || opts.quietLoad))) {
      try {
        if (BPState.matchGoFallbackTimer) clearTimeout(BPState.matchGoFallbackTimer);
      } catch (_) {}
      BPState.matchGoFallbackTimer = setTimeout(() => {
        if (BPState.matchAwaitingGo && !BPState.matchIntroSeqDone && !BPState.matchIntroSeqRunning) {
          console.warn('match_go fallback — still waiting for peer/server clock');
          // Re-signal ready in case the first packets were lost; do NOT unlock play
          // or start intro locally — that would desync clocks between players.
          try {
            if (typeof MatchClient !== 'undefined' && MatchClient.matchReady) {
              MatchClient.matchReady();
            }
          } catch (_) {}
          // Second soft retry a few seconds later; still no local start
          try {
            if (BPState.matchGoFallbackTimer2) clearTimeout(BPState.matchGoFallbackTimer2);
          } catch (_) {}
          BPState.matchGoFallbackTimer2 = setTimeout(() => {
            if (BPState.matchAwaitingGo && !BPState.matchIntroSeqDone && !BPState.matchIntroSeqRunning) {
              try {
                if (typeof MatchClient !== 'undefined' && MatchClient.matchReady) {
                  MatchClient.matchReady();
                }
              } catch (_) {}
            }
          }, 5000);
        }
      }, 8000);
    } else if (!(opts && (opts.rejoin || opts.quietLoad))) {
      // Legacy path only
      runMatchIntroSequence({ reason: 'legacy' });
    }
  } catch (e) {
    console.warn('beginRoomRankedMatch', e);
  }
}
