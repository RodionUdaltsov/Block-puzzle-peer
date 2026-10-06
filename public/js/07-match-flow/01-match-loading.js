/**
 * Block Puzzle — js/07-match-flow/01-match-loading.js
 * Match loading overlay and server-authoritative load handshake.
 * Shares the client bundle scope (order: public/js/modules.json).
 */

// —— Match loading: presence + board bind before fight is live ——
// Until loading finishes, exit = cancel match (no AFK, no history).
let mpLoading = false;
let _matchLoad = null; // state object

function showMatchLoading(label, title, sub) {
  // After «Старт!» is locked in — ignore any further loading text (no «Почти готово» flash)
  try {
    if (BPState.matchStartPhase || BPState.matchStartLocked) return;
  } catch (_) {}
  const el = document.getElementById('matchIntro');
  if (!el) return;
  const lab = document.getElementById('miLabel');
  const tit = document.getElementById('miTitle');
  const su = document.getElementById('miSub');
  if (lab) lab.textContent = label || (typeof globalThis.t==='function'?globalThis.t('js.loading','Загрузка'):'Загрузка');
  if (tit) tit.textContent = title || (typeof globalThis.t==='function'?globalThis.t('js.connecting','Подключение…'):'Подключение…');
  if (su) su.textContent = sub || (typeof globalThis.t==='function'?globalThis.t('js.checkingPlayers','Проверяем, что оба игрока на месте'):'Проверяем, что оба игрока на месте');
  el.classList.remove('mi-go');
  el.classList.add('visible');
  el.setAttribute('aria-hidden', 'false');
  // Must override boot-failsafe inline display:none
  try {
    el.style.display = 'flex';
    el.style.pointerEvents = 'auto';
    el.style.opacity = '1';
    el.style.visibility = 'visible';
    el.style.zIndex = '9000';
  } catch (_) {}
  try { window._matchIntroShownAt = Date.now(); } catch (_) {}
}

function updateMatchLoading(title, sub) {
  try {
    if (BPState.matchStartPhase || BPState.matchStartLocked) return;
  } catch (_) {}
  try {
    const tit = document.getElementById('miTitle');
    const su = document.getElementById('miSub');
    if (tit && title != null) tit.textContent = title;
    if (su && sub != null) su.textContent = sub;
  } catch (_) {}
}

function hideMatchLoading() {
  const el = document.getElementById('matchIntro');
  if (!el) return;
  el.classList.remove('visible', 'mi-go');
  el.setAttribute('aria-hidden', 'true');
  try {
    el.style.display = 'none';
    el.style.pointerEvents = 'none';
  } catch (_) {}
}

function clearMatchLoadState() {
  try {
    if (_matchLoad) {
      if (_matchLoad.timer) clearTimeout(_matchLoad.timer);
      if (_matchLoad.hb) clearInterval(_matchLoad.hb);
      if (_matchLoad.retry) clearInterval(_matchLoad.retry);
    }
  } catch (_) {}
  _matchLoad = null;
  mpLoading = false;
}

function isMatchLoadActive() {
  return !!(mpLoading || (_matchLoad && !_matchLoad.finished));
}

/**
 * Online-only: show Загрузка, verify peer presence, prepare boards,
 * wait until BOTH sides report bound, then go live (vsActive + AFK/DC).
 * If peer leaves during this phase → cancel (ranked→search, friendly→lobby).
 */
function beginVersusMatchMp(isHost) {
  if (!mpMode) {
    _beginVersusMatchMpBody(isHost, { skipLoad: true });
    return;
  }
  try {
    if (roomMatchMode || BPState.roomMatchMode || (typeof MatchClient !== 'undefined' && MatchClient.matchId)) {
      _beginVersusMatchMpBody(isHost, { skipLoad: true });
      return;
    }
  } catch (_) {}
  vsIntroLock = false;
  try { abortPreMatchMissingPeer('Нет связи с соперником'); } catch (_) {}
}

function _prepareVersusBoardsUnderLoad() {
  mode = 'versus';
  // Prepare DOM but keep loading overlay on top — player must not interact
  showScreen('versus');
  score = 0; oppScore = 0;
  vsTimeLeft = vsDuration;
  vsActive = false;
  placingLock = true; // lock until go
  aiBusy = false;
  playerStuck = false; aiStuck = false;
  clearChain = 0; oppClearChain = 0;
  matchLog = [];
  matchStartTs = Date.now();
  replayMode = false;
  try { BPState.matchHadAnyPlace = false; } catch (_) {}

  grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  oppGrid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  createBoardDOM(boardMe);
  createBoardDOM(boardOpp);
  applyBoardScales();
  try {
    if (window.mpOppSkinId) applyOppSkin(window.mpOppSkinId);
    else clearOppSkin();
  } catch (_) {}
  try { applyEquippedBoard(); } catch (_) {}
  try {
    if (window.mpOppBoardId) applyOppBoard(window.mpOppBoardId);
    else clearOppBoard();
  } catch (_) {}
  renderGrid(grid, boardMe);
  renderGrid(oppGrid, boardOpp);

  document.getElementById('myScore').textContent = '0';
  document.getElementById('oppScore').textContent = '0';
  oppName = oppName || mpOppName || 'Соперник';
  try { updateVersusNameLabels(); } catch (_) {}
  document.getElementById('trophiesLive').textContent = trophies;
  document.getElementById('stuckWait').style.display = 'none';
  document.getElementById('oppStuckWait').style.display = 'none';
  document.getElementById('vsLiveControls').style.display = '';
  document.getElementById('vsFooter').style.display = '';
  const piecesEl = document.getElementById('piecesAreaVs');
  if (piecesEl) {
    piecesEl.style.opacity = '1';
    piecesEl.style.pointerEvents = 'none'; // locked until live
  }
  document.getElementById('botSpeech')?.classList.remove('visible');

  generatePieces(piecesEl);
  oppPieces = [];
  const oa = document.getElementById('piecesAreaOpp');
  if (oa) oa.innerHTML = '';
  updateBoardMetrics(boardMe);
  updateTimerDisplay();
  
  // Keep the same loading overlay — no second flash
  showMatchLoading(
    'Загрузка',
    'Подключение игроков…',
    rankedLabel()
  );
}

function rankedLabel() {
  try {
    if (_matchLoad && _matchLoad.ranked) return 'Рейтинговый матч';
    if (mpFromMatchmaking) return 'Рейтинговый матч';
  } catch (_) {}
  return 'Товарищеский матч';
}

function maybeFinishMatchLoad() {
  if (!_matchLoad || _matchLoad.finished) return;
  if (!_matchLoad.meBound || !_matchLoad.oppBound) return;
  if (false) {
    abortPreMatchMissingPeer('Соперник отключился при загрузке');
    return;
  }
  if (!_matchLoad.goSent) {
    _matchLoad.goSent = true;
    
  }
  _finishMatchLoadAndGoLive();
}

function _finishMatchLoadAndGoLive() {
  if (!_matchLoad || _matchLoad.finished) return;
  if (!_matchLoad.meBound || !_matchLoad.oppBound) return;
  if (false) {
    abortPreMatchMissingPeer('Соперник отключился до начала матча');
    return;
  }
  // Lock immediately so match_load_go cannot re-enter
  _matchLoad.finished = true;
  const loadSnap = _matchLoad;
  clearMatchLoadState();
  mpLoading = false;
  // Prevent a second loading sequence from late start / load_begin
  window._matchLoadCooldown = Date.now() + 5000;

  // Online server path uses finishRoomMatchLoadAndGo — do not flash a second «Старт!»
  if (roomMatchMode || BPState.roomMatchMode || (typeof MatchClient !== 'undefined' && MatchClient.matchId)) {
    try { hideMatchLoading(); } catch (_) {}
    // Fall through to unlock without second overlay
  } else {
  showMatchLoading('Загрузка', 'Старт!', rankedLabel());
  }
  setTimeout(() => {
    hideMatchLoading();
    if (false) {
      abortPreMatchMissingPeer('Соперник отключился до начала матча');
      return;
    }
    BPState.matchEnded = false;
    vsActive = true;
    placingLock = false;
    matchStartTs = Date.now();
    try { window._matchWentLiveAt = matchStartTs; } catch (_) {}
    try { BPState.leftForRankedSearch = 0; } catch (_) {}
    try { BPState.forceCancelPreMoveLock = false; } catch (_) {}
    try { BPState.matchHadAnyPlace = false; } catch (_) {}
    try { BPState.matchHadAnyPlace = false; } catch (_) {}
    // Snapshot immediately so pagehide/leave during the same tick still records history
    try { persistLiveMatch(); } catch (_) {}
    const piecesEl = document.getElementById('piecesAreaVs');
    if (piecesEl) piecesEl.style.pointerEvents = '';
    try { startAfkWatch(); } catch (_) {}
    
    
    try {
      if (window._pendingIntroOppDeal) {
        const d = window._pendingIntroOppDeal;
        window._pendingIntroOppDeal = null;
        applyOppRemoteDeal(d);
      }
    } catch (_) {}
    try {
      if (pieces && pieces.length) {
        logDeal('me', pieces);
        
      }
    } catch (_) {}
    // Opponent may have left during "Старт!" — abort cleanly
    if (false) {
      try {
        vsActive = false;
        abortPreMatchMissingPeer('Соперник отключился до начала матча');
      } catch (_) {}
      return;
    }
    BPState.matchClockEndTs = Date.now() + Math.max(0, vsTimeLeft || vsDuration || 120) * 1000;
    try { startMatchWallClock(BPState.matchClockEndTs); } catch (_) {}
    vsIntroLock = false;
    try { mpMatchStarting = false; } catch (_) {}
  }, 500);
}

/** Opponent left during loading / before vsActive — cancel, no AFK, no history.
 *  Also used right after go-live race when opponent leaved during "Старт!" (empty board). */
function abortPreMatchMissingPeer(reason) {
  if (BPState.preMatchAborting) return;

  let emptyBoard = false;
  let stillLoading = false;
  try {
    emptyBoard = (typeof noMovesYet === 'function') ? noMovesYet() : (
      (score | 0) === 0 && (oppScore | 0) === 0
    );
  } catch (_) {
    emptyBoard = (score | 0) === 0 && (oppScore | 0) === 0;
  }
  try {
    stillLoading = !!(typeof isMatchLoadActive === 'function' && isMatchLoadActive())
      || !!mpLoading || !!vsIntroLock || !!mpMatchStarting;
  } catch (_) {}

  // _leftForRankedSearch is set at EVERY ranked queue start — must NOT block
  // cancel while loading or on empty board (this froze Opera after a fast match).
  try {
    if (BPState.leftForRankedSearch && (Date.now() - BPState.leftForRankedSearch) < 15000) {
      const vr = document.getElementById('versusResult');
      const onResult = !!(vr && vr.classList.contains('visible'));
      if (onResult && !stillLoading && !emptyBoard) return;
    }
  } catch (_) {}
  try {
    const vr = document.getElementById('versusResult');
    if (vr && vr.classList.contains('visible') && !stillLoading && !emptyBoard) {
      return;
    }
  } catch (_) {}
  try {
    const stillPre = !vsActive || stillLoading || emptyBoard;
    if (!stillPre) return;
  } catch (_) {
    if (vsActive && !mpLoading) return;
  }
  BPState.preMatchAborting = true;
  try { BPState.leftForRankedSearch = 0; } catch (_) {}
  
  try { vsActive = false; } catch (_) {}
  clearMatchLoadState();
  try { hideMatchLoading(); } catch (_) {}
  try { vsIntroLock = false; } catch (_) {}
  try { vsActive = false; } catch (_) {}
  try { placingLock = false; } catch (_) {}
  try { mode = null; } catch (_) {}
  try { mpMatchStarting = false; } catch (_) {}
  try { window._matchLoadCooldown = 0; } catch (_) {}
  try { BPState.matchEnded = true; } catch (_) {}
  try { window._pendingIntroOppDeal = null; } catch (_) {}
  try {
    if (vsTimerId) { clearInterval(vsTimerId); vsTimerId = null; }
    if (aiInterval) { clearInterval(aiInterval); aiInterval = null; }
  } catch (_) {}
  try { stopAfkWatch(); } catch (_) {}
  try { clearDisconnectTimer(); } catch (_) {}
  try { hideBoardDisconnectOverlay(); } catch (_) {}
  try { hideDisconnectBanner(); } catch (_) {}
  try { hideMatchRejoinPanel(); } catch (_) {}
  // Opponent may still have a rejoin snapshot from a race — we cannot clear theirs,
  // but clear our own so we never rejoin into a cancelled empty match.
  try { clearLiveMatch(); } catch (_) {}
  try { myDcAt = 0; oppDcAt = 0; bothAwayMode = false; } catch (_) {}

  const ranked = !!mpFromMatchmaking;
  const room = mpRoomCode;

  // Tell peer we aborted (best-effort)
  try {
    if (false) {
      
    }
  } catch (_) {}

  // No cancel toast

  if (ranked) {
    // Auto-requeue for ranked when peer left before any move (or during load).
    // Do not yank someone already on the post-match result screen into search.
    let onResultScreen = false;
    try {
      const vr = document.getElementById('versusResult');
      onResultScreen = !!(vr && vr.classList.contains('visible'));
    } catch (_) {}
    let wasInRankedFlow = true; // ranked flag already true — prefer requeue over menu
    try {
      const matchScreen = document.getElementById('screenMatch');
      const versusScreen = document.getElementById('screenVersus');
      wasInRankedFlow = !!(mmFound || mmActive
        || (matchScreen && matchScreen.classList.contains('active'))
        || (versusScreen && versusScreen.classList.contains('active'))
        || isMatchLoadActive()
        || mpLoading
        || mpMatchStarting
        || ranked);
    } catch (_) {}
    try { destroyMp(); } catch (_) {}
    mmFound = false;
    mmActive = false;
    if (!onResultScreen && wasInRankedFlow) {
      try {
        BPState.preMatchAborting = false;
        startOnlineMatchmaking();
        mmSetStatus('Соперник отключился до начала матча', 'Ищем снова…');
      } catch (_) {
        BPState.preMatchAborting = false;
        try {
          showScreen('duration');
          mmSetStatus('Соперник отключился до начала матча', 'Попробуй поиск снова');
        } catch (_2) {}
      }
    } else {
      BPState.preMatchAborting = false;
      try {
        if (onResultScreen) {
          /* keep result UI */
        } else {
          showScreen('menu');
          updateMenuStats();
        }
      } catch (_) {}
    }
    return;
  }

  // Friendly: back to room lobby if possible
  try { showScreen('friends'); } catch (_) {}
  try {
    if (room) {
      const el = document.getElementById('roomLobby');
      if (el) el.classList.add('visible');
      mpReady = false;
      mpOppReady = false;
      
      try { updateLobbyUI(); } catch (_) {}
    } else {
      try { destroyMp(); } catch (_) {}
    }
  } catch (_) {
    try { destroyMp(); } catch (_2) {}
  }
  BPState.preMatchAborting = false;
}

// Message handlers for loading protocol
function onMatchLoadBegin(data) {
  if (!mpMode) return;
  if (data) {
    if (typeof data.duration === 'number') vsDuration = data.duration;
    if (typeof data.trophies === 'number') mpOppTrophies = data.trophies;
    if (data.name) { mpOppName = data.name; oppName = data.name; }
    if (data.skinId) try { window.mpOppSkinId = data.skinId; } catch (_) {}
    if (data.boardId) try { window.mpOppBoardId = data.boardId; } catch (_) {}
  }
  // Already loading — just mark peer present
  if (_matchLoad && !_matchLoad.finished) {
    _matchLoad.oppHere = true;
    
    return;
  }
  // Join loading only once if peer started and we have not
  if (!vsActive && !BPState.matchEnded && !(window._matchLoadCooldown && Date.now() < window._matchLoadCooldown)) {
    if (!mpLoading && !vsIntroLock) {
      try { beginVersusMatchMp(false); } catch (_) {}
    }
  }
}

function onMatchLoadHere(data) {
  if (!_matchLoad || _matchLoad.finished) return;
  _matchLoad.oppHere = true;
  // Only reply to non-ack heartbeats to avoid infinite ping-pong
  if (data && data.ack) return;
  
}

function onMatchLoadBound(data) {
  if (!_matchLoad || _matchLoad.finished) return;
  _matchLoad.oppBound = true;
  _matchLoad.oppHere = true;
  if (data) {
    if (data.skinId) try { window.mpOppSkinId = data.skinId; applyOppSkin(data.skinId); } catch (_) {}
    if (data.boardId) try { window.mpOppBoardId = data.boardId; applyOppBoard(data.boardId); } catch (_) {}
    if (data.name) { mpOppName = data.name; oppName = data.name; try { updateVersusNameLabels(); } catch (_) {} }
  }
  maybeFinishMatchLoad();
}

function onMatchLoadGo(data) {
  if (!_matchLoad || _matchLoad.finished) return;
  _matchLoad.goRecv = true;
  _matchLoad.oppBound = true; // go implies peer is ready
  _matchLoad.oppHere = true;
  maybeFinishMatchLoad();
}

function onMatchLoadAbort(data) {
  // After go-live, still honour abort if nobody placed yet
  try {
    if (vsActive && !mpLoading && !noMovesYet()) return;
  } catch (_) {
    if (vsActive && !mpLoading) return;
  }
  forceCancelPreMoveMatch('Соперник отключился до начала матча');
}

// Legacy stub — bots / non-mp still call body path through beginVersusMatchMp
function _beginVersusMatchMpBody(isHost, opts) {
  opts = opts || {};
  // Used only for safety fallback (no mpMode)
  mode = 'versus';
  showScreen('versus');
  score = 0; oppScore = 0;
  vsTimeLeft = vsDuration;
  vsActive = false;
  placingLock = false;
  matchLog = [];
  grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  oppGrid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  createBoardDOM(boardMe);
  createBoardDOM(boardOpp);
  applyBoardScales();
  renderGrid(grid, boardMe);
  renderGrid(oppGrid, boardOpp);
  generatePieces(document.getElementById('piecesAreaVs'));
  vsActive = true;
  vsIntroLock = false;
  try { startMatchWallClock(Date.now() + (vsDuration || 120) * 1000); } catch (_) {}
}
