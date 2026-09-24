/**
 * Block Puzzle — 07-match-flow-ui.js
 * Match loading, presence bind, end freeze, score duel UI
 * Shares global scope with other public/js/*.js modules (no bundler).
 */
'use strict';

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

// Opp place anim in flight — queue places + deals so every move is shown in order
let _oppPlaceAnimBusy = false;
let _pendingOppDeal = null;
let _pendingOppPlaces = [];

function applyOppRemoteDeal(data) {
  if (!data || !data.pieces) return;
  if (typeof replayMode !== 'undefined' && replayMode) return;
  const loading = !vsActive || mpLoading || mpMatchStarting || BPState.matchAwaitingGo || BPState.matchIntroSeqRunning;
  // Wait until current opp place is logged + tray collapse done (live only)
  if (!loading && _oppPlaceAnimBusy) {
    _pendingOppDeal = data;
    return;
  }
  oppPieces = data.pieces.map(p => {
    let sh = [[0, 0]];
    try {
      sh = (typeof cloneShapeCells === 'function')
        ? cloneShapeCells(p && p.shape)
        : (Array.isArray(p && p.shape) ? p.shape.map(c => Array.isArray(c) ? [+c[0] || 0, +c[1] || 0] : [0, 0]) : [[0, 0]]);
      if (typeof normalize === 'function' && sh.length) sh = normalize(sh.map(c => c.slice()));
    } catch (_) {
      sh = [[0, 0]];
    }
    if (!sh.length) sh = [[0, 0]];
    return {
      shape: sh,
      color: (p && p.color) ? String(p.color) : '#7c5cff',
      used: !!(p && p.used)
    };
  });
  try {
    BPState.animateDealIn = !loading;
    BPState.quietPieceRender = !!loading;
  } catch (_) {}
  try { renderOppPieces(); } catch (_) {}
  try { BPState.animateDealIn = false; BPState.quietPieceRender = false; } catch (_) {}
  try { logDeal('opp', oppPieces); } catch (_) {}
}

function flushPendingOppDeal() {
  _oppPlaceAnimBusy = false;
  // Prefer queued places so each move anim plays in order
  if (_pendingOppPlaces && _pendingOppPlaces.length) {
    const next = _pendingOppPlaces.shift();
    try { applyOppRemotePlace(next); } catch (_) {}
    return;
  }
  if (!_pendingOppDeal) return;
  const d = _pendingOppDeal;
  _pendingOppDeal = null;
  try { applyOppRemoteDeal(d); } catch (_) {}
}

function applyOppRemotePlace(data) {
  if (!data || !data.shape) return;
  if (!vsActive && !(roomMatchMode || BPState.roomMatchMode)) return;
  if (!vsActive) vsActive = true;
  // Queue while a previous fly is on screen — never skip a move
  if (_oppPlaceAnimBusy) {
    if (!_pendingOppPlaces) _pendingOppPlaces = [];
    _pendingOppPlaces.push(data);
    return;
  }
  // Lock immediately so concurrent messages cannot start a second fly
  _oppPlaceAnimBusy = true;
  try { if (typeof noteOppAction === 'function') noteOppAction(); } catch (_) {}
  // Keep opponent field theme in sync so clear FX match their equipped board
  try {
    if (data.boardId && data.boardId !== window.mpOppBoardId) {
      window.mpOppBoardId = data.boardId;
      if (typeof applyOppBoard === 'function') applyOppBoard(data.boardId);
    }
  } catch (_) {}
  // Normalize shape cells (server / JSON may alter numbers; keep same key as tray deals)
  let shape = [];
  try {
    const raw = Array.isArray(data.shape) ? data.shape : [];
    for (let i = 0; i < raw.length; i++) {
      const cell = raw[i];
      if (Array.isArray(cell) && cell.length >= 2) shape.push([+cell[0] || 0, +cell[1] || 0]);
    }
    if (typeof normalize === 'function' && shape.length) shape = normalize(shape);
  } catch (_) {
    shape = Array.isArray(data.shape) ? data.shape : [];
  }
  if (!shape.length) {
    _oppPlaceAnimBusy = false;
    try { flushPendingOppDeal(); } catch (_) {}
    return;
  }
  const color = data.color;
  const r = data.r, c = data.c;

  // Visual: lift matching slot → smooth fly to board (no tray rebuild flicker)
  const board = boardOpp;
  const boardRect = board.getBoundingClientRect();
  const gapSz = 2.5;
  const step = (boardRect.width - gapSz * (SIZE - 1)) / SIZE;
  const maxR = Math.max(...shape.map(s => s[0]));
  const maxC = Math.max(...shape.map(s => s[1]));
  const targetX = boardRect.left + (c + maxC / 2) * (step + gapSz) + step / 2;
  const targetY = boardRect.top + (r + maxR / 2) * (step + gapSz) + step / 2;

  let startX = targetX, startY = boardRect.bottom + 10;
  const tray = document.getElementById('piecesAreaOpp');
  let slotEl = null;
  // Prefer explicit pieceIdx from opponent (same order as their deal); fallback to shape match
  let usedIdx = -1;
  if (typeof data.pieceIdx === 'number' && data.pieceIdx >= 0 &&
      oppPieces[data.pieceIdx] && !oppPieces[data.pieceIdx].used) {
    usedIdx = data.pieceIdx;
  } else {
    usedIdx = findOppTrayIdx(shape, color);
  }
  if (usedIdx >= 0 && tray) {
    slotEl = tray.querySelector('.piece-slot[data-opp-idx="' + usedIdx + '"]');
  }
  if (slotEl) {
    const sr = slotEl.getBoundingClientRect();
    startX = sr.left + sr.width / 2;
    startY = sr.top + sr.height / 2;
    slotEl.classList.add('lifting');
  } else if (tray) {
    const tr = tray.getBoundingClientRect();
    startX = tr.left + tr.width / 2;
    startY = tr.top + tr.height / 2;
  }

  // CRITICAL: log place + mark used IMMEDIATELY (before anim / before next deal arrives).
  // Previously matchLog.push ran after 520ms — new deal often logged first → broken replay hands.
  if (usedIdx >= 0 && oppPieces[usedIdx]) {
    oppPieces[usedIdx].used = true;
  } else if (oppPieces.length) {
    const u = oppPieces.find(p => p && !p.used);
    if (u) {
      u.used = true;
      if (usedIdx < 0) usedIdx = oppPieces.indexOf(u);
    }
  }
  if (typeof data.score === 'number') {
    oppScore = data.score;
    try { document.getElementById('oppScore').textContent = oppScore; } catch (_) {}
  }
  try {
    let logShape = shape.map(p => p.slice());
    if (typeof normalize === 'function') logShape = normalize(logShape.map(p => p.slice()));
    const placePts = (typeof data.placePts === 'number')
      ? data.placePts
      : (shape.length * 10);
    matchLog.push({
      type: 'place', side: 'opp', t: Date.now() - matchStartTs,
      shape: logShape,
      color, r, c,
      myScore: score, oppScore,
      pieceIdx: (typeof usedIdx === 'number' && usedIdx >= 0) ? usedIdx : -1,
      placePts,
      legendFx: !!(data && data.legendFx),
      skinId: (data && data.skinId) || window.mpOppSkinId || null
    });
  } catch (_) {}

  const ghost = document.getElementById('aiGhost');
  try { setAiGhostSkin('opp'); } catch (_) {}
  {
    const m = getBoardCellMetrics(board);
    ghost.innerHTML = buildPieceGhostHTML({ shape, color }, m.px, m.gap);
  }
  ghost.style.transition = 'none';
  ghost.style.left = startX + 'px';
  ghost.style.top = startY + 'px';
  ghost.style.display = 'block';
  ghost.style.opacity = '1';
  ghost.style.visibility = 'visible';
  ghost.style.zIndex = '50';
  void ghost.offsetWidth;
  ghost.style.transition =
    'left 0.38s cubic-bezier(0.25, 0.1, 0.25, 1), top 0.38s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.15s ease';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      ghost.style.left = targetX + 'px';
      ghost.style.top = targetY + 'px';
    });
  });

  try {
    window._lastOppPlace = { r, c, maxR, maxC };
  } catch (_) {}
  setTimeout(() => {
    for (const [dr, dc] of shape) {
      if (oppGrid[r + dr]) oppGrid[r + dr][c + dc] = color;
      const cell = board.children[(r + dr) * SIZE + (c + dc)];
      if (cell) {
        paintCellColor(cell, color);
        cell.classList.add('filled', 'placing');
        setTimeout(() => cell.classList.remove('placing'),
          (document.body && document.body.classList.contains('touch-ui')) ? 400 : 780);
      }
    }
    // Legendary place sparks — must be visible on this client when opponent places
    try {
      const wantSpark = !!(data && data.legendFx) ||
        (document.querySelector('.player-panel.opp') &&
          document.querySelector('.player-panel.opp').classList.contains('skin-fx-prism'));
      if (wantSpark && typeof spawnLegendSparks === 'function') {
        const wrap = board.parentElement;
        const maxR = Math.max(...shape.map(s => s[0]));
        const maxC = Math.max(...shape.map(s => s[1]));
        const cell0 = board.children[r * SIZE + c];
        let origin = null;
        if (cell0 && wrap) {
          const cr = cell0.getBoundingClientRect();
          const wr = wrap.getBoundingClientRect();
          origin = {
            left: cr.left - wr.left + cr.width * (0.5 + maxC / 2),
            top: cr.top - wr.top + cr.height * (0.5 + maxR / 2)
          };
        }
        const skinForFx = (data && data.skinId) || window.mpOppSkinId || 'gold';
        spawnLegendSparks(wrap, 6 + shape.length, skinForFx, origin);
      }
    } catch (_) {}
    ghost.style.opacity = '0';
    setTimeout(() => { ghost.style.display = 'none'; }, 160);

    // Soft collapse matching tray slot — no full re-render (avoids flicker)
    if (slotEl) {
      slotEl.classList.remove('lifting', 'show');
      void slotEl.offsetWidth;
      slotEl.classList.add('used');
      try {
        slotEl.style.width = '0';
        slotEl.style.minWidth = '0';
        slotEl.style.maxWidth = '0';
        slotEl.style.height = '0';
        slotEl.style.opacity = '0';
        slotEl.style.margin = '0';
        slotEl.style.padding = '0';
        slotEl.style.border = 'none';
        slotEl.style.background = 'transparent';
        slotEl.style.boxShadow = 'none';
        slotEl.style.pointerEvents = 'none';
        setTimeout(() => { try { slotEl.innerHTML = ''; } catch (_) {} }, 280);
      } catch (_) {}
    } else if (tray) {
      try { renderOppPieces(); } catch (_) {}
    }

    // Clear in the same tick the piece lands on the board
    const clearInfo = clearLinesOn(oppGrid, boardOpp);
    if (!(clearInfo.count > 0)) {
      oppClearChain = 0;
      // Do NOT renderGrid here — cells already painted + placing anim must stay visible
    } else {
      const serverChain = (data && typeof data.chain === 'number') ? (data.chain | 0) : 0;
      oppClearChain = serverChain || ((oppClearChain || 0) + 1);
      // Flying scores + combo banner on opponent board (mutual visibility)
      try {
        const clearedN = (data && typeof data.cleared === 'number') ? (data.cleared | 0) : (clearInfo.count || 0);
        const bonusN = (data && typeof data.bonus === 'number') ? (data.bonus | 0) : 0;
        const wrap = boardOpp && boardOpp.parentElement;
        const banner = document.getElementById('comboBannerOpp')
          || (wrap && wrap.querySelector('.combo-banner'))
          || document.getElementById('comboBannerMe');
        const maxR = Math.max(...shape.map(s => s[0]));
        const maxC = Math.max(...shape.map(s => s[1]));
        const placeAnchor = {
          baseR: r, baseC: c,
          centerR: r + maxR / 2,
          centerC: c + maxC / 2
        };
        const positions = (typeof getClearFloatPositions === 'function')
          ? getClearFloatPositions(boardOpp, clearInfo.rows || [], clearInfo.cols || [], placeAnchor)
          : null;
        if (typeof showCombo === 'function') {
          showCombo(banner, clearedN, bonusN, wrap, 'opp', {
            chain: oppClearChain,
            positions,
            placeAnchor,
            baseBonus: bonusN,
            chainExtra: 0
          });
        }
        try {
          if (clearedN >= 2 || oppClearChain >= 2) SFX.combo();
          else if (clearedN > 0 && SFX.clear) SFX.clear();
        } catch (_) {}
      } catch (_) {}
    }
    // Authoritative final board from server (after place+clear) — kills any stuck cells
    try {
      if (data && Array.isArray(data.grid)) {
        oppGrid = data.grid.map(row => (row || []).slice());
        const delay = (clearInfo.count > 0)
          ? ((typeof getClearAnimMs === 'function') ? getClearAnimMs() + 20 : (typeof CLEAR_ANIM_MS === 'number' ? CLEAR_ANIM_MS + 20 : 30))
          : 30;
        setTimeout(() => {
          try {
            const bo = boardOpp || document.getElementById('boardOpp');
            if (bo && typeof renderGrid === 'function') renderGrid(oppGrid, bo);
          } catch (_) {}
        }, delay);
      }
    } catch (_) {}
    onAiScoreChanged();
    flushPendingOppDeal();
  }, 400);
}

function botTierLabel(t) {
  if (t < 200) return 'Новичок';
  if (t < 500) return 'Любитель';
  if (t < 1000) return 'Клубный';
  if (t < 1500) return 'Сильный / Эксперт';
  if (t < 2200) return 'Мастер';
  if (t < 3000) return 'Гроссмейстер';
  return 'Чемпион';
}

function renderBotList() {
  const list = document.getElementById('botList');
  const sorted = [...BOTS].sort((a, b) => a.trophies - b.trophies);
  // Soft stagger — ~5 cols, cap so last visible rows don't wait too long
  const maxI = 20;
  list.innerHTML = sorted.map((b, i) => `
    <div class="bot-card ${b.id === selectedBotId ? 'selected' : ''}" data-bot="${b.id}" style="--bot-i:${Math.min(i, maxI)}">
      <div class="bot-name">${b.name}</div>
      <div class="bot-icon">${botAvatarSVG(b, 44)}</div>
      <div class="bot-cups">🏆 ${b.trophies}</div>
      <div class="bot-title">${b.title || botTierLabel(b.trophies)}</div>
      ${botStarsHTML(b.id)}
    </div>
  `).join('');
  list.querySelectorAll('.bot-card').forEach(card => {
    card.addEventListener('click', () => {
      selectedBotId = card.dataset.bot;
      currentBot = BOTS.find(b => b.id === selectedBotId);
      renderBotList();
    });
  });
}

let speechTimer = null;
let lastPhraseAt = 0;
let lastPhraseKind = '';
const PHRASE_COOLDOWN_MS = 9000; // rarer lines
function botVoiceProfile(bot) {
  // gender: 'f' | 'm' — slower rates so speech is clear
  const id = (bot && bot.id) || '';
  const map = {
    nugget:  { gender: 'm', rate: 0.78, pitch: 1.15, volume: 0.9 },
    pawz:    { gender: 'f', rate: 0.8,  pitch: 1.28, volume: 0.88 },
    spark:   { gender: 'm', rate: 0.88, pitch: 1.12, volume: 0.9 },
    bloom:   { gender: 'f', rate: 0.76, pitch: 1.18, volume: 0.86 },
    glitch:  { gender: 'm', rate: 0.85, pitch: 0.88, volume: 0.84 },
    brutus:  { gender: 'm', rate: 0.72, pitch: 0.72, volume: 0.92 },
    nova:    { gender: 'f', rate: 0.82, pitch: 1.12, volume: 0.88 },
    hex:     { gender: 'm', rate: 0.8,  pitch: 0.95, volume: 0.86 },
    drift:   { gender: 'm', rate: 0.84, pitch: 1.0,  volume: 0.87 },
    pulse:   { gender: 'f', rate: 0.86, pitch: 1.08, volume: 0.88 },
    vortex:  { gender: 'm', rate: 0.8,  pitch: 0.88, volume: 0.86 },
    ember:   { gender: 'f', rate: 0.8,  pitch: 1.1,  volume: 0.9 },
    aurora:  { gender: 'f', rate: 0.76, pitch: 1.2,  volume: 0.85 },
    gravity: { gender: 'm', rate: 0.7,  pitch: 0.68, volume: 0.9 },
    obelisk: { gender: 'm', rate: 0.68, pitch: 0.62, volume: 0.9 },
    oracle:  { gender: 'f', rate: 0.74, pitch: 0.98, volume: 0.85 },
    apex:    { gender: 'm', rate: 0.75, pitch: 0.78, volume: 0.92 }
  };
  return map[id] || { gender: 'm', rate: 0.8, pitch: 1.0, volume: 0.88 };
}
function polishRussianSpeech(text) {
  // ё helps stress; combining accents often BREAK iOS/Android TTS — strip them
  let out = String(text).replace(/\u0301/g, '');
  // Strip symbols TTS would pronounce awkwardly (/, (), =, >, <, :, etc.)
  out = out
    .replace(/[\/\\|]/g, ' ')
    .replace(/[()\[\]{}<>]/g, ' ')
    .replace(/[=+*_#@&:;]/g, ' ')
    .replace(/\b(vs)\b/gi, 'против')
    .replace(/\b(null|true|false)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const fixes = [
    [/еще\b/gi, 'ещё'], [/ее\b/gi, 'её'], [/счет/gi, 'счёт'],
    [/пойдет/gi, 'пойдёт'], [/придет/gi, 'придёт'], [/ждет/gi, 'ждёт'],
    [/начнет/gi, 'начнёт'], [/взлет/gi, 'взлёт'], [/тверд/gi, 'твёрд'],
    [/черн/gi, 'чёрн'], [/тяжел/gi, 'тяжёл']
  ];
  fixes.forEach(([re, rep]) => { out = out.replace(re, rep); });
  return out;
}
function classifyVoiceGender(v) {
  const n = ((v && v.name) || '') + ' ' + ((v && v.voiceURI) || '');
  if (/female|woman|girl|женск|milena|katya|katia|irina|tanya|tatyana|elena|oksana|samantha|karen|moira|fiona|victoria|zira|susan|hannah|allison|ava|serena|microsoft.*(irina|elena)/i.test(n)) return 'f';
  if (/male|man|boy|мужск|yuri|yury|yuriy|dmitri|dmitry|pavel|alexander|aleksandr|ivan|nikolai|sergey|microsoft.*(pavel|dmitri)|daniel|thomas|alex|aaron|jorge|diego|fred|bruce/i.test(n)) return 'm';
  return 'u';
}
function pickVoiceForGender(gender) {
  const voices = window.speechSynthesis.getVoices() || [];
  if (!voices.length) return null;
  const ru = voices.filter(v => /ru(-|_|$)/i.test(v.lang) || /russian|русский/i.test(v.name || ''));
  const tagged = (ru.length ? ru : voices).map(v => ({ v, g: classifyVoiceGender(v) }));
  const exact = tagged.filter(t => t.g === gender).map(t => t.v);
  if (exact.length) return exact[0];
  // Prefer any non-opposite gender if possible
  if (gender === 'm') {
    const notF = tagged.filter(t => t.g !== 'f').map(t => t.v);
    if (notF.length) return notF[0];
  }
  return (ru[0] || voices[0] || null);
}
function speakBotText(text) {
  if (settings.voice === '0') return;
  if (!window.speechSynthesis || !text) return;
  try {
    window.speechSynthesis.cancel();
    const spoken = polishRussianSpeech(String(text))
      .replace(/…/g, '... ')
      .replace(/—/g, ', ')
      .replace(/([.!?])\s*/g, '$1 ')
      .replace(/\s+/g, ' ')
      .trim();
    const u = new SpeechSynthesisUtterance(spoken);
    const prof = botVoiceProfile(currentBot);
    const gender = prof.gender === 'f' ? 'f' : 'm';
    const voice = pickVoiceForGender(gender);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang || 'ru-RU';
    } else {
      u.lang = 'ru-RU';
    }
    // iPhone often has only Milena (female). Simulate male with very low pitch.
    if (gender === 'm') {
      u.rate = Math.max(0.55, Math.min(0.88, (prof.rate || 0.78) * 0.92));
      u.pitch = Math.max(0.1, Math.min(0.7, (prof.pitch || 0.75) * 0.55));
    } else {
      u.rate = Math.max(0.6, Math.min(0.95, prof.rate || 0.8));
      u.pitch = Math.max(1.1, Math.min(1.6, Math.max(prof.pitch || 1.15, 1.15)));
    }
    const vMul = Math.max(0, Math.min(1, (parseInt(settings.voiceVol, 10) || 70) / 100));
    u.volume = Math.max(0.05, Math.min(1, (prof.volume || 0.9) * vMul));
    window.speechSynthesis.speak(u);
  } catch (_) {}
}
function showBotPhrase(kind, force) {
  if (settings.speech === '0' && settings.voice === '0') return;
  if (!currentBot || !currentBot.phrases) return;
  const list = currentBot.phrases[kind];
  if (!list || !list.length) return;
  const now = Date.now();
  // Always allow start/win/lose; throttle mid-game chatter
  const important = kind === 'start' || kind === 'win' || kind === 'lose';
  if (!force && !important) {
    if (now - lastPhraseAt < PHRASE_COOLDOWN_MS) return;
    if (kind === lastPhraseKind && now - lastPhraseAt < PHRASE_COOLDOWN_MS * 1.5) return;
  }
  lastPhraseAt = now;
  lastPhraseKind = kind;
  const text = list[Math.floor(Math.random() * list.length)];
  if (settings.speech !== '0') {
    const el = document.getElementById('botSpeech');
    if (el) {
      const nameEl = el.querySelector('.bot-speech-name');
      const textEl = el.querySelector('.bot-speech-text');
      if (nameEl) nameEl.textContent = currentBot.name + ':';
      if (textEl) textEl.textContent = ' ' + text;
      el.classList.add('visible');
      if (speechTimer) clearTimeout(speechTimer);
      speechTimer = setTimeout(() => el.classList.remove('visible'), 2600);
    }
  }
  speakBotText(text);
}

function totalBotStars() {
  let n = 0;
  try {
    for (const id of Object.keys(botStars || {})) n += getBotStarCount(id);
  } catch (_) {}
  return n;
}
function achCurrentValue(ach) {
  switch (ach.type) {
    case 'classicBest': return best;
    case 'wins': return getAchStat('wins');
    case 'onlineWins': return getAchStat('onlineWins');
    case 'trophies': return trophies;
    case 'beatBotMax': return getAchStat('beatWeak');
    case 'beatBotMin': return getAchStat('beatBotHighest');
    case 'beatCrown': return Math.max(getAchStat('beatCrown'), getAchStat('beatApex')); // legacy apex
    case 'beatSeer': return getAchStat('beatSeer');
    case 'megaCombo': return getAchStat('megaCombo');
    case 'combo2': return getAchStat('combo2');
    case 'combo3': return getAchStat('combo3');
    case 'combo5': return getAchStat('combo5');
    case 'combo6': return getAchStat('combo6');
    case 'combo7': return getAchStat('combo7');
    case 'combo8': return getAchStat('combo8');
    case 'combo10': return getAchStat('combo10');
    case 'linesCleared': return getAchStat('linesCleared');
    case 'matchesPlayed': return getAchStat('matchesPlayed');
    case 'botStars': return totalBotStars();
    case 'rankedBest': return (typeof rankedBest === 'number' ? rankedBest : 0);
    case 'skinsOwned': return (ownedSkins && ownedSkins.length) ? ownedSkins.length : getAchStat('skinsOwned');
    case 'skinsBought': return getAchStat('skinsBought');
    case 'reliefUsed': return getAchStat('reliefUsed');
    case 'blowoutWin': return getAchStat('blowoutWin');
    case 'clutchWin': return getAchStat('clutchWin');
    case 'botWins': return getAchStat('botWins');
    case 'winDur60': return getAchStat('winDur60');
    case 'winDur120': return getAchStat('winDur120');
    case 'winDur180': return getAchStat('winDur180');
    case 'friendsCount':
      try { return (typeof friends !== 'undefined' && Array.isArray(friends)) ? friends.length : getAchStat('friendsCount'); } catch (_) { return getAchStat('friendsCount'); }
    case 'diamondsHeld': return (typeof diamonds === 'number') ? diamonds : 0;
    case 'achClaimed':
      return ACHIEVEMENTS.filter(a => achProgress['claimed_' + a.id]).length;
    case 'profileNick': return getAchStat('profileNick');
    case 'profileAvatar': return getAchStat('profileAvatar');
    case 'profileCustom': return getAchStat('profileCustom');
    case 'profileStatus': return getAchStat('profileStatus');
    case 'boardsBought': return getAchStat('boardsBought');
    case 'boardsOwned':
      try { return (ownedBoards && ownedBoards.length) ? ownedBoards.length : getAchStat('boardsOwned'); } catch (_) { return getAchStat('boardsOwned'); }
    case 'boardsLegendary': return getAchStat('boardsLegendary');
    case 'winStreak': return Math.max(getAchStat('winStreak'), getAchStat('winStreakBest'));
    case 'comebackWin': return getAchStat('comebackWin');
    case 'rematchPlayed': return getAchStat('rematchPlayed');
            case 'allBotStars':
      try {
        const maxS = maxSilverStars();
        return (maxS > 0 && totalSilverStars() >= maxS) ? 1 : 0;
      } catch (_) { return 0; }
    case 'halfBotStars':
      try {
        const maxS = maxSilverStars();
        return (maxS > 0 && totalSilverStars() >= Math.ceil(maxS / 2)) ? 1 : 0;
      } catch (_) { return 0; }
    case 'perfectClassic': return getAchStat('perfectClassic');
    default: return 0;
  }
}

function achIsDone(ach) {
  if (ach.type === 'beatBotMax') return getAchStat('beatWeak') >= 1;
  if (ach.type === 'beatBotMin') return getAchStat('beatBotHighest') >= ach.target;
  if (ach.type === 'beatCrown') return getAchStat('beatCrown') >= 1 || getAchStat('beatApex') >= 1;
  if (ach.type === 'beatSeer') return getAchStat('beatSeer') >= 1;
  return achCurrentValue(ach) >= ach.target;
}

function achReadyToClaim(ach) {
  if (achProgress['claimed_' + ach.id]) return false;
  return achIsDone(ach);
}

function flashDiamonds(amount, nearEl) {
  // legacy no-op kept for safety; claim uses showAchClaimCeremony
}

let achClaimTimers = [];
let achClaimOpen = false;
function clearAchClaimTimers() {
  achClaimTimers.forEach(t => clearTimeout(t));
  achClaimTimers = [];
}
function closeAchClaim() {
  const ov = document.getElementById('achClaimOverlay');
  if (!ov) return;
  ov.classList.remove('visible', 'reward-in', 'burst', 'multi');
  ov.setAttribute('aria-hidden', 'true');
  achClaimOpen = false;
  clearAchClaimTimers();
}
function showAchClaimCeremony(ach, multiList) {
  const ov = document.getElementById('achClaimOverlay');
  if (!ov) return;
  const isMulti = Array.isArray(multiList) && multiList.length > 0;
  if (!isMulti && !ach) return;
  clearAchClaimTimers();
  ov.classList.remove('visible', 'reward-in', 'burst', 'multi');
  void ov.offsetWidth;

  const labelEl = document.getElementById('achClaimLabel');
  const titleEl = document.getElementById('achClaimTitle');
  const descEl = document.getElementById('achClaimDesc');
  const rewardEl = document.getElementById('achClaimReward');
  const listEl = document.getElementById('achClaimList');
  const countEl = document.getElementById('achClaimCount');
  const badgeEl = document.getElementById('achClaimBadge');

  if (isMulti) {
    ov.classList.add('multi');
    const total = multiList.reduce((s, a) => s + (a.reward || 0), 0);
    if (labelEl) labelEl.textContent = (typeof globalThis.t==='function'?globalThis.t('js.awardsCollected','Награды собраны'):'Награды собраны');
    if (badgeEl) badgeEl.textContent = '✨';
    if (titleEl) titleEl.textContent = multiList.length === 1
      ? (multiList[0].title || 'Достижение')
      : `${multiList.length} достижений`;
    if (descEl) {
      descEl.textContent = multiList.length > 1
        ? 'Все готовые награды зачислены'
        : (multiList[0].desc || '');
    }
    if (countEl) {
      countEl.style.display = '';
      countEl.textContent = `🏅 ${multiList.length} · итог`;
    }
    if (listEl) {
      listEl.style.display = multiList.length > 1 ? '' : 'none';
      listEl.innerHTML = multiList.map((a, i) => {
        const ico = (ACH_SECTIONS.find(s => s.id === a.section) || {}).icon || '🏅';
        return `<div class="ach-claim-list-item" style="animation-delay:${0.08 + i * 0.045}s">
          <span class="ai-ico">${ico}</span>
          <span>${a.title || 'Достижение'}</span>
          <span class="ai-reward">+${a.reward} 💎</span>
        </div>`;
      }).join('');
    }
    if (rewardEl) rewardEl.textContent = `+${total} 💎`;
  } else {
    if (labelEl) labelEl.textContent = (typeof globalThis.t==='function'?globalThis.t('js.achGot','Достижение получено'):'Достижение получено');
    if (badgeEl) badgeEl.textContent = '✓';
    if (titleEl) titleEl.textContent = ach.title || (typeof globalThis.t==='function'?globalThis.t('js.ach','Достижение'):'Достижение');
    if (descEl) descEl.textContent = ach.desc || '';
    if (countEl) { countEl.style.display = 'none'; countEl.textContent = ''; }
    if (listEl) { listEl.style.display = 'none'; listEl.innerHTML = ''; }
    if (rewardEl) rewardEl.textContent = `+${ach.reward} 💎`;
  }

  const parts = document.getElementById('achClaimParticles');
  if (parts) {
    parts.innerHTML = '';
    const n = isMulti ? Math.min(28, 12 + multiList.length * 2) : 14;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      const dist = 48 + Math.random() * (isMulti ? 90 : 70);
      s.style.left = '50%';
      s.style.top = '42%';
      s.style.setProperty('--tx', Math.cos(ang) * dist + 'px');
      s.style.setProperty('--ty', Math.sin(ang) * dist + 'px');
      s.style.animationDelay = (0.35 + Math.random() * 0.2) + 's';
      s.style.background = i % 3 === 0 ? 'var(--accent)' : (i % 3 === 1 ? 'var(--diamond)' : 'var(--trophy)');
      if (isMulti) {
        s.style.width = (5 + Math.random() * 4) + 'px';
        s.style.height = s.style.width;
      }
      parts.appendChild(s);
    }
  }
  ov.classList.add('visible');
  ov.setAttribute('aria-hidden', 'false');
  achClaimOpen = true;
  try { SFX.combo(); hapticTap(isMulti ? 22 : 18); } catch (_) {}
  achClaimTimers.push(setTimeout(() => {
    ov.classList.add('reward-in', 'burst');
    try { SFX.ui(); hapticTap(12); } catch (_) {}
  }, isMulti ? 480 : 380));
  achClaimTimers.push(setTimeout(() => {
    if (achClaimOpen) closeAchClaim();
  }, isMulti ? 5200 : 2800));
}

let claimAllBusy = false;
function claimAllAchievements() {
  if (claimAllBusy || achClaimOpen) return;
  // Snapshot only currently claimable; each id granted at most once
  const ready = ACHIEVEMENTS.filter(a => achReadyToClaim(a));
  if (!ready.length) return;
  claimAllBusy = true;
  try {
    const btn = document.getElementById('btnClaimAllAch');
    if (btn) btn.disabled = true;

    const granted = [];
    let total = 0;
    const seen = new Set();
    for (const ach of ready) {
      if (!ach || !ach.id) continue;
      if (seen.has(ach.id)) continue;
      if (achProgress['claimed_' + ach.id]) continue;
      if (!achIsDone(ach)) continue;
      seen.add(ach.id);
      achProgress['claimed_' + ach.id] = 1;
      const reward = Math.max(0, parseInt(ach.reward, 10) || 0);
      total += reward;
      granted.push(ach);
    }
    if (!granted.length) {
      claimAllBusy = false;
      if (btn) btn.disabled = false;
      updateClaimAllButton();
      return;
    }
    diamonds = Math.max(0, (parseInt(diamonds, 10) || 0) + total);
    saveAch();
    try { localStorage.setItem('bp_diamonds', String(diamonds)); } catch (_) {}
    updateMenuStats();
    try { if (diamondsEl) diamondsEl.textContent = diamonds; } catch (_) {}
    showAchClaimCeremony(null, granted);
    renderAchievements();
    updateAchievementsButton();
    updateClaimAllButton();
  } finally {
    // unlock after ceremony can be reopened (avoid double-tap race)
    setTimeout(() => {
      claimAllBusy = false;
      const btn = document.getElementById('btnClaimAllAch');
      if (btn) btn.disabled = false;
      try { updateClaimAllButton(); } catch (_) {}
    }, 600);
  }
}

function updateClaimAllButton() {
  const btn = document.getElementById('btnClaimAllAch');
  const meta = document.getElementById('achClaimAllMeta');
  const spacer = document.getElementById('achTopSpacer');
  if (!btn) return;
  const ready = ACHIEVEMENTS.filter(a => achReadyToClaim(a));
  if (!ready.length) {
    btn.style.display = 'none';
    if (spacer) spacer.style.display = '';
    return;
  }
  btn.style.display = '';
  if (spacer) spacer.style.display = 'none';
  const total = ready.reduce((s, a) => s + (a.reward || 0), 0);
  if (meta) meta.textContent = `+${total} 💎`;
  btn.title = ready.length === 1
    ? `Собрать 1 награду · +${total} 💎`
    : `Собрать все (${ready.length}) · +${total} 💎`;
}
document.getElementById('achClaimOverlay')?.addEventListener('click', () => {
  if (achClaimOpen) closeAchClaim();
});

function claimAchievement(achId, btnEl) {
  if (claimAllBusy || achClaimOpen) return;
  const ach = ACHIEVEMENTS.find(a => a.id === achId);
  if (!ach || achProgress['claimed_' + ach.id] || !achIsDone(ach)) return;
  achProgress['claimed_' + ach.id] = 1;
  const reward = Math.max(0, parseInt(ach.reward, 10) || 0);
  diamonds = Math.max(0, (parseInt(diamonds, 10) || 0) + reward);
  saveAch();
  try { localStorage.setItem('bp_diamonds', String(diamonds)); } catch (_) {}
  updateMenuStats();
  try { if (diamondsEl) diamondsEl.textContent = diamonds; } catch(_){}
  showAchClaimCeremony(ach);
  renderAchievements();
  updateAchievementsButton();
  try { updateClaimAllButton(); } catch (_) {}
}

// —— Match end freeze (pause before score duel) ——
let matchEndFreezeTimer = null;
let matchEndFreezeResolve = null;
function hideMatchEndFreeze() {
  const el = document.getElementById('matchEndFreeze');
  if (matchEndFreezeTimer) {
    try { clearTimeout(matchEndFreezeTimer); } catch (_) {}
    matchEndFreezeTimer = null;
  }
  try { document.body.classList.remove('match-ending'); } catch (_) {}
  if (el) {
    el.classList.remove('visible', 'mef-out', 'mef-time', 'mef-lose', 'mef-win', 'mef-draw');
    el.setAttribute('aria-hidden', 'true');
    // Do NOT set display:none inline — that blocks future .visible
    try { el.style.display = ''; el.style.pointerEvents = ''; } catch (_) {}
  }
  const r = matchEndFreezeResolve;
  matchEndFreezeResolve = null;
  if (r) {
    try { r(); } catch (_) {}
  }
}
/**
 * Freeze the board briefly so both players register that the match stopped.
 * Then score duel / result modal can play.
 */
function showMatchEndFreeze(opts) {
  opts = opts || {};
  return new Promise((resolve) => {
    // Always show end sequence (user-requested cinematic)

    const el = document.getElementById('matchEndFreeze');
    if (!el) { resolve(); return; }
    // Clear any inline display:none left by boot failsafe
    try {
      el.style.display = '';
      el.style.pointerEvents = '';
      el.style.opacity = '';
      el.style.visibility = '';
    } catch (_) {}

    // Cancel any previous freeze
    if (matchEndFreezeTimer) {
      try { clearTimeout(matchEndFreezeTimer); } catch (_) {}
      matchEndFreezeTimer = null;
    }
    if (matchEndFreezeResolve) {
      const prev = matchEndFreezeResolve;
      matchEndFreezeResolve = null;
      try { prev(); } catch (_) {}
    }
    matchEndFreezeResolve = resolve;

    const reason = (opts.reason || 'normal') + '';
    const timeUp = !!opts.timeUp || (typeof opts.timeLeft === 'number' && opts.timeLeft <= 0);
    const my = Math.max(0, opts.my | 0);
    const opp = Math.max(0, opts.opp | 0);
    const won = !!opts.won;
    const draw = !!opts.draw;

    let label = 'Versus';
    let title = 'Матч окончен';
    let sub = 'Подсчёт результатов…';
    el.classList.remove('mef-time', 'mef-lose', 'mef-win', 'mef-draw');

    if (reason === 'forfeit') {
      title = 'Матч окончен';
      sub = won ? 'Соперник сдался · подсчёт…' : 'Вы сдались · подсчёт…';
      if (!won) el.classList.add('mef-lose');
      else el.classList.add('mef-win');
    } else if (reason === 'disconnect') {
      title = 'Матч окончен';
      sub = won ? 'Соперник отключился · подсчёт…' : 'Обрыв связи · подсчёт…';
    } else if (reason === 'afk') {
      title = 'Матч окончен';
      sub = 'АФК · подсчёт результатов…';
    } else if (timeUp) {
      title = 'Матч окончен';
      sub = 'Время вышло · подсчёт…';
      el.classList.add('mef-time');
      label = 'Таймер';
    } else {
      title = 'Матч окончен';
      sub = 'Подсчёт результатов…';
    }

    if (draw) el.classList.add('mef-draw');
    else if (won) el.classList.add('mef-win');
    else if (reason !== 'forfeit' || !won) {
      if (!won && reason !== 'disconnect') el.classList.add('mef-lose');
    }

    const labEl = document.getElementById('mefLabel');
    const titleEl = document.getElementById('mefTitle');
    const subEl = document.getElementById('mefSub');
    const scMe = document.getElementById('mefScoreMe');
    const scOpp = document.getElementById('mefScoreOpp');
    if (labEl) labEl.textContent = label;
    if (titleEl) titleEl.textContent = title;
    if (subEl) subEl.textContent = sub;
    if (scMe) scMe.textContent = '0';
    if (scOpp) scOpp.textContent = '0';
    // Reveal scores block and count up during freeze
    try {
      const scWrap = document.getElementById('mefScores');
      if (scWrap) {
        scWrap.style.display = 'flex';
        scWrap.setAttribute('aria-hidden', 'false');
      }
    } catch (_) {}
    // Animate count-up during freeze
    try {
      const dur = 900;
      const t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - k, 3);
        if (scMe) scMe.textContent = String(Math.round(my * e));
        if (scOpp) scOpp.textContent = String(Math.round(opp * e));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    } catch (_) {
      if (scMe) scMe.textContent = String(my);
      if (scOpp) scOpp.textContent = String(opp);
    }

    try { document.body.classList.add('match-ending'); } catch (_) {}
    el.classList.remove('mef-out');
    el.classList.add('visible');
    el.setAttribute('aria-hidden', 'false');
    try { hapticTap(16); } catch (_) {}
    try { SFX.ui && SFX.ui(); } catch (_) {}

    const hold = Math.min(3200, Math.max(1800, opts.ms || 2400));
    matchEndFreezeTimer = setTimeout(() => {
      matchEndFreezeTimer = null;
      el.classList.add('mef-out');
      setTimeout(() => {
        try { document.body.classList.remove('match-ending'); } catch (_) {}
        el.classList.remove('visible', 'mef-out', 'mef-time', 'mef-lose', 'mef-win', 'mef-draw');
        el.setAttribute('aria-hidden', 'true');
        const r = matchEndFreezeResolve;
        matchEndFreezeResolve = null;
        if (r) {
          try { r(); } catch (_) {}
        }
      }, 320);
    }, hold);
  });
}

// —— Score duel after match ——
let scoreDuelTimers = [];
let scoreDuelResolve = null;
let scoreDuelSkippable = false;
// Guards against late showResultModal after user already left (menu / again)
let resultModalEpoch = 0;
let resultModalSafetyTimer = null;
BPState.resultDismissed = false;
function clearScoreDuelTimers() {
  scoreDuelTimers.forEach(t => clearTimeout(t));
  scoreDuelTimers = [];
}
/** Cancel pending result modal + score duel (user went to menu / started new match). */
function dismissPostMatchResult() {
  BPState.resultDismissed = true;
  resultModalEpoch++;
  if (resultModalSafetyTimer) {
    try { clearTimeout(resultModalSafetyTimer); } catch (_) {}
    resultModalSafetyTimer = null;
  }
  try { hideMatchEndFreeze(); } catch (_) {}
  try {
    const ov = document.getElementById('scoreDuelOverlay');
    if (ov) {
      ov.classList.remove('visible', 'show-verdict', 'duel-win', 'duel-lose', 'duel-draw');
      ov.setAttribute('aria-hidden', 'true');
    }
  } catch (_) {}
  clearScoreDuelTimers();
  scoreDuelSkippable = false;
  const r = scoreDuelResolve;
  scoreDuelResolve = null;
  // Resolve after epoch bump so any .then(showResultModal) is a no-op
  if (r) {
    try { r(); } catch (_) {}
  }
  try {
    document.getElementById('versusResult').classList.remove('visible');
  } catch (_) {}
  try {
    document.getElementById('reviewBar').classList.remove('visible');
  } catch (_) {}
}
function finishScoreDuel() {
  const ov = document.getElementById('scoreDuelOverlay');
  if (ov) {
    ov.classList.remove('visible', 'show-verdict');
    ov.setAttribute('aria-hidden', 'true');
  }
  clearScoreDuelTimers();
  scoreDuelSkippable = false;
  const r = scoreDuelResolve;
  scoreDuelResolve = null;
  if (r) r();
  // After duel closes, surface any rematch invite that arrived during it
  setTimeout(() => {
    try { tryShowPendingRematchOffer(); } catch (_) {}
  }, 50);
}
function animateCount(el, to, ms) {
  if (!el) return;
  const start = performance.now();
  const from = 0;
  const step = (now) => {
    const t = Math.min(1, (now - start) / ms);
    const ease = 1 - Math.pow(1 - t, 3);
    el.textContent = Math.round(from + (to - from) * ease);
    if (t < 1) requestAnimationFrame(step);
    else el.textContent = to;
  };
  requestAnimationFrame(step);
}

function spawnDuelConfetti(ov) {
  if (!ov) return;
  try { if (settings && settings.confetti === '0') return; } catch (_) {}
  let box = ov.querySelector('.score-duel-confetti');
  if (!box) {
    box = document.createElement('div');
    box.className = 'score-duel-confetti';
    ov.appendChild(box);
  }
  box.innerHTML = '';
  const colors = ['#00d4aa','#7c5cff','#ffd666','#5ee7ff','#ff5c7a','#ff9f43','#c77dff'];
  for (let i = 0; i < 28; i++) {
    const b = document.createElement('b');
    b.style.left = (8 + Math.random() * 84) + '%';
    b.style.background = colors[i % colors.length];
    b.style.width = (6 + Math.random() * 6) + 'px';
    b.style.height = (6 + Math.random() * 8) + 'px';
    b.style.animationDelay = (Math.random() * 0.35) + 's';
    b.style.animationDuration = (1.1 + Math.random() * 0.7) + 's';
    b.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    box.appendChild(b);
  }
  setTimeout(() => { try { box.innerHTML = ''; } catch (_) {} }, 2200);
}

function showScoreDuel(my, opp, won, draw, oppLabel, bot) {
  return new Promise((resolve) => {
    try {
      if (settings && settings.scoreDuel === '0') { resolve(); return; }
    } catch (_) {}
    const ov = document.getElementById('scoreDuelOverlay');
    if (!ov) { resolve(); return; }
    try {
      ov.style.display = '';
      ov.style.pointerEvents = '';
      ov.style.opacity = '';
    } catch (_) {}
    clearScoreDuelTimers();
    scoreDuelResolve = resolve;
    scoreDuelSkippable = false;

    const sideMe = document.getElementById('duelSideMe');
    const sideOpp = document.getElementById('duelSideOpp');
    sideMe.className = 'score-duel-side me';
    sideOpp.className = 'score-duel-side opp';
    ov.classList.remove('show-verdict', 'duel-win', 'duel-lose', 'duel-draw');
    try {
      const cf = ov.querySelector('.score-duel-confetti');
      if (cf) cf.innerHTML = '';
    } catch (_) {}

    document.getElementById('duelNameMe').textContent = (typeof myNickname === 'string' && myNickname) ? myNickname : (typeof globalThis.t==='function'?globalThis.t('js.you','Ты'):'Ты');
    document.getElementById('duelNameOpp').textContent = oppLabel || (typeof globalThis.t==='function'?globalThis.t('js.opp','Соперник'):'Соперник');
    document.getElementById('duelScoreMe').textContent = '0';
    document.getElementById('duelScoreOpp').textContent = '0';

    const avMeInner = document.getElementById('duelAvMeInner');
    const avOppInner = document.getElementById('duelAvOppInner');
    if (avMeInner) {
      try {
        renderAvatarInto(avMeInner, { avatarId: myAvatarId, nick: myNickname, size: 'duel' });
      } catch (_) {
        const initials = ((typeof myNickname === 'string' && myNickname) ? myNickname : (typeof globalThis.t==='function'?globalThis.t('js.you','Ты'):'Ты')).slice(0, 2).toUpperCase();
        avMeInner.textContent = initials;
      }
      avMeInner.style.display = '';
    }
    if (avOppInner) {
      if (bot) {
        avOppInner.innerHTML = botAvatarSVG(bot, 64);
        avOppInner.style.display = 'block';
      } else {
        const ini = (oppLabel || 'С').slice(0, 2).toUpperCase();
        avOppInner.textContent = ini;
        avOppInner.style.display = '';
      }
    }

    ov.classList.add('visible');
    ov.setAttribute('aria-hidden', 'false');

    // Count-up scores
    scoreDuelTimers.push(setTimeout(() => {
      animateCount(document.getElementById('duelScoreMe'), my, 700);
      animateCount(document.getElementById('duelScoreOpp'), opp, 700);
    }, 180));

    // Reveal winner/loser + verdict (stronger, slightly longer)
    scoreDuelTimers.push(setTimeout(() => {
      ov.classList.remove('duel-win', 'duel-lose', 'duel-draw');
      if (draw) {
        sideMe.classList.add('draw');
        sideOpp.classList.add('draw');
        ov.classList.add('duel-draw');
      } else if (won) {
        sideMe.classList.add('winner');
        sideOpp.classList.add('loser');
        ov.classList.add('duel-win');
        try { spawnDuelConfetti(ov); } catch (_) {}
      } else {
        sideOpp.classList.add('winner');
        sideMe.classList.add('loser');
        ov.classList.add('duel-lose');
      }
      const verd = document.getElementById('duelVerdict');
      verd.className = 'score-duel-verdict ' + (draw ? 'draw' : won ? 'win' : 'lose');
      verd.textContent = draw ? (typeof globalThis.t==='function'?globalThis.t('js.draw','Ничья'):'Ничья') : won ? (typeof globalThis.t==='function'?globalThis.t('js.victory','Победа!'):'Победа!') : (typeof globalThis.t==='function'?globalThis.t('js.defeat','Поражение'):'Поражение');
      ov.classList.add('show-verdict');
      try { hapticTap(18); } catch (_) {}
    }, 1000));

    // Allow tap after verdict has time to land
    scoreDuelTimers.push(setTimeout(() => { scoreDuelSkippable = true; }, 1250));
  });
}
document.getElementById('scoreDuelOverlay')?.addEventListener('click', () => {
  if (scoreDuelSkippable) finishScoreDuel();
});

function closeAllAchTabs() {
  try { sessionStorage.removeItem('bp_ach_open'); } catch (_) {}
  const list = document.getElementById('achList');
  if (!list) return;
  list.querySelectorAll('.ach-scroll').forEach(el => {
    el.classList.remove('open', 'ach-rise', 'ach-flip');
    el.style.transition = '';
    el.style.transform = '';
  });
}

function renderAchievements() {
  const list = document.getElementById('achList');
  if (!list) return;
  let openMap = {};
  try { openMap = JSON.parse(sessionStorage.getItem('bp_ach_open') || '{}') || {}; } catch (_) { openMap = {}; }
  // Only one section may be open
  const openId = Object.keys(openMap).find(k => openMap[k] === 1) || null;

  const cardHTML = (ach) => {
    const claimed = !!achProgress['claimed_' + ach.id];
    const ready = achReadyToClaim(ach);
    const cur = achCurrentValue(ach);
    const pct = Math.min(100, Math.round((cur / Math.max(1, ach.target)) * 100));
    let status = `${Math.min(cur, ach.target)} / ${ach.target}`;
    let claimBtn = '';
    if (claimed) status = '✓';
    else if (ready) {
      claimBtn = `<button type="button" class="ach-claim-btn" data-ach="${ach.id}">+${ach.reward} 💎</button>`;
      status = 'Готово';
    }
    return `<div class="ach-card ${claimed ? 'done' : ''} ${ready ? 'ready' : ''}">
      <div class="ach-top">
        <div class="ach-title">${ach.title}</div>
        <div class="ach-reward">+${ach.reward} 💎</div>
      </div>
      <div class="ach-desc">${ach.desc}</div>
      <div class="ach-progress"><div style="width:${claimed || ready ? 100 : pct}%"></div></div>
      <div class="ach-status">${status}</div>
      ${claimBtn}
    </div>`;
  };

  // Build sections; ready-to-claim stay INSIDE their tabs (sorted to top)
  const sectionNodes = [];
  for (const sec of ACH_SECTIONS) {
    const items = ACHIEVEMENTS.filter(a => (a.section || 'classic') === sec.id);
    if (!items.length) continue;
    const doneN = items.filter(a => achIsDone(a) || achProgress['claimed_' + a.id]).length;
    const readyN = items.filter(a => achReadyToClaim(a)).length;
    const isOpen = openId === sec.id;
    const bodyItems = [...items].sort((a, b) => {
      // Ready to claim first → in progress → claimed last
      const rank = (x) => {
        if (achReadyToClaim(x)) return 0;
        if (achProgress['claimed_' + x.id]) return 2;
        return 1;
      };
      const ra = rank(a), rb = rank(b);
      if (ra !== rb) return ra - rb;
      return (achCurrentValue(b) / Math.max(1, b.target)) - (achCurrentValue(a) / Math.max(1, a.target));
    });
    sectionNodes.push({
      id: sec.id,
      isOpen,
      html: `<div class="ach-scroll ${isOpen ? 'open' : ''}" data-sec="${sec.id}">
      <button type="button" class="ach-scroll-head" data-toggle-sec="${sec.id}">
        <span class="ach-scroll-ico">${sec.icon || '📜'}</span>
        <span class="ach-scroll-title">${sec.title}</span>
        ${readyN ? `<span class="ach-scroll-ready-dot" title="Можно забрать: ${readyN}"></span>` : ''}
        <span class="ach-scroll-count ${doneN >= items.length ? 'done-all' : ''}">${doneN}/${items.length}</span>
        <span class="ach-scroll-chev">▶</span>
      </button>
      <div class="ach-scroll-body"><div class="ach-scroll-inner">${bodyItems.map(cardHTML).join('') || '<div class="ach-desc" style="padding:4px 6px">Все выполнены</div>'}</div></div>
    </div>`
    });
  }

  // Open section goes first (visual order matches accordion state)
  if (openId) {
    sectionNodes.sort((a, b) => (a.id === openId ? -1 : b.id === openId ? 1 : 0));
  }

  let html = sectionNodes.map(s => s.html).join('');
  if (!html) html = '<div class="history-empty">Пока нет достижений</div>';
  list.innerHTML = html;

  try { updateClaimAllButton(); } catch (_) {}
  list.querySelectorAll('.ach-claim-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      claimAchievement(btn.dataset.ach, btn);
    });
  });

  list.querySelectorAll('[data-toggle-sec]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-toggle-sec');
      const box = list.querySelector(`.ach-scroll[data-sec="${id}"]`);
      if (!box) return;
      const wasOpen = box.classList.contains('open');
      const tabs = [...list.querySelectorAll('.ach-scroll')];

      // FLIP: capture positions before layout change
      const firstRects = new Map();
      tabs.forEach(el => {
        firstRects.set(el, el.getBoundingClientRect());
        el.classList.remove('ach-flip');
        el.style.transition = 'none';
        el.style.transform = '';
      });

      // Close every section
      tabs.forEach(el => el.classList.remove('open'));
      openMap = {};

      if (!wasOpen) {
        // Move chosen tab to top, then open
        const first = list.querySelector('.ach-scroll');
        if (first && first !== box) {
          list.insertBefore(box, first);
        }
        box.classList.add('open');
        openMap[id] = 1;

        // Invert → play (smooth flow of all tabs)
        requestAnimationFrame(() => {
          const moving = [...list.querySelectorAll('.ach-scroll')];
          moving.forEach(el => {
            const f = firstRects.get(el);
            if (!f) return;
            const last = el.getBoundingClientRect();
            const dx = f.left - last.left;
            const dy = f.top - last.top;
            if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
              el.style.transition = '';
              el.style.transform = '';
              return;
            }
            el.classList.add('ach-flip');
            el.style.transform = `translate(${dx}px, ${dy}px)`;
          });
          // Next frame: animate to natural positions
          requestAnimationFrame(() => {
            moving.forEach(el => {
              if (!el.classList.contains('ach-flip')) return;
              el.style.transition = 'transform 0.48s cubic-bezier(0.22, 1.05, 0.36, 1)';
              el.style.transform = 'translate(0, 0)';
            });
            const clearFlip = (el) => {
              el.classList.remove('ach-flip');
              el.style.transition = '';
              el.style.transform = '';
              el.removeEventListener('transitionend', el._flipClear);
            };
            moving.forEach(el => {
              if (!el.classList.contains('ach-flip')) return;
              clearTimeout(el._flipT);
              el._flipClear = (e) => {
                if (e && e.propertyName && e.propertyName !== 'transform') return;
                clearFlip(el);
              };
              el.addEventListener('transitionend', el._flipClear);
              el._flipT = setTimeout(() => clearFlip(el), 560);
            });
          });
        });

        // Keep opened tab visible at top of scroll area
        try {
          requestAnimationFrame(() => {
            const listTop = list.getBoundingClientRect().top;
            const boxTop = box.getBoundingClientRect().top;
            if (Math.abs(boxTop - listTop) > 12) {
              list.scrollTo({ top: list.scrollTop + (boxTop - listTop) - 4, behavior: 'smooth' });
            }
          });
        } catch (_) {}
      } else {
        // Closing only — soft settle
        tabs.forEach(el => {
          el.style.transition = '';
          el.style.transform = '';
        });
      }

      try { sessionStorage.setItem('bp_ach_open', JSON.stringify(openMap)); } catch (_) {}
    });
  });
  updateAchievementsButton();
}

function trackMatchAchievements(won) {
  bumpAchStat('matchesPlayed', 1);
  if (won) {
    const streak = (getAchStat('winStreak') || 0) + 1;
    setAchStat('winStreak', streak);
    setAchStat('winStreakBest', Math.max(getAchStat('winStreakBest') || 0, streak));
    bumpAchStat('wins', 1);
    if (vsModeType === 'online' || mpMode) bumpAchStat('onlineWins', 1);
    if (vsModeType === 'bots' || currentBot) bumpAchStat('botWins', 1);
    const dur = vsDuration || 120;
    if (dur <= 60) bumpAchStat('winDur60', 1);
    else if (dur >= 180) bumpAchStat('winDur180', 1);
    else bumpAchStat('winDur120', 1);
    try {
      const diff = Math.abs((score || 0) - (oppScore || 0));
      if (diff >= 500) bumpAchStat('blowoutWin', 1);
      if (diff <= 50) bumpAchStat('clutchWin', 1);
    } catch (_) {}
    if (currentBot) {
      if (currentBot.trophies <= 300) setAchStat('beatWeak', Math.max(1, getAchStat('beatWeak')));
      setAchStat('beatBotHighest', Math.max(getAchStat('beatBotHighest'), currentBot.trophies));
      if (currentBot.id === 'apex') {
        setAchStat('beatCrown', 1);
        setAchStat('beatApex', 1);
      }
      if (currentBot.id === 'oracle') setAchStat('beatSeer', 1);
    }
    // Comeback: was behind by 200+ at some point (flag set during match)
    try {
      if (window._matchWasBehind200) bumpAchStat('comebackWin', 1);
    } catch (_) {}
  } else {
    setAchStat('winStreak', 0);
  }
  try { window._matchWasBehind200 = false; } catch (_) {}
}

function renderOppPieces() {
  // Never overwrite replay trays with live hand
  if (typeof replayMode !== 'undefined' && replayMode) return;
  const area = document.getElementById('piecesAreaOpp');
  if (!area) return;
  area.innerHTML = '';
  if (!oppPieces || !oppPieces.length) {
    // Online: never invent a fake hand — wait for deal / rejoin sync
    if (vsModeType === 'online' || mpMode) {
      try { recoverHandsFromMatchLog(); } catch (_) {}
    }
    if (!oppPieces || !oppPieces.length) {
      if (vsModeType === 'bots' || currentBot) {
        const mk = randomBotPiece;
        oppPieces = [mk(), mk(), mk()];
      } else if (!(vsModeType === 'online' || mpMode)) {
        // Classic / non-online fallback only
        oppPieces = [randomPiece(DEFAULT_COLORS), randomPiece(DEFAULT_COLORS), randomPiece(DEFAULT_COLORS)];
      } else {
        // Online with empty hand: leave tray empty (will fill on deal / rejoin_ok)
        return;
      }
    }
  }
  let cellPx = 10;
  let slotPx = 44;
  try {
    const board = document.getElementById('boardOpp');
    if (board) {
      const w = board.getBoundingClientRect().width;
      if (w > 40) {
        const boardCell = w / SIZE;
        cellPx = Math.max(7, Math.min(12, Math.round(boardCell * 0.32)));
        slotPx = Math.max(36, Math.min(56, cellPx * 4 + 8));
      }
    } else {
      const cs = getComputedStyle(document.documentElement);
      const v = parseFloat(cs.getPropertyValue('--opp-piece'));
      if (Number.isFinite(v) && v > 0) cellPx = v;
      const s = parseFloat(cs.getPropertyValue('--opp-slot'));
      if (Number.isFinite(s) && s > 0) slotPx = s;
    }
  } catch (_) {}
  oppPieces.forEach((p, idx) => {
    const slot = document.createElement('div');
    slot.className = 'piece-slot';
    slot.dataset.oppIdx = idx;
    if (p.used) {
      slot.classList.add('used');
      area.appendChild(slot);
      return;
    }
    slot.style.width = slotPx + 'px';
    slot.style.height = slotPx + 'px';
    slot.style.minWidth = slotPx + 'px';
    const maxR = Math.max(...p.shape.map(s => s[0]));
    const maxC = Math.max(...p.shape.map(s => s[1]));
    const gridEl = document.createElement('div');
    gridEl.className = 'piece-grid';
    gridEl.style.gridTemplateColumns = `repeat(${maxC + 1}, ${cellPx}px)`;
    gridEl.style.gridTemplateRows = `repeat(${maxR + 1}, ${cellPx}px)`;
    gridEl.style.gap = '1px';
    const occ = new Set(p.shape.map(([r, c]) => r + ',' + c));
    for (let r = 0; r <= maxR; r++) {
      for (let c = 0; c <= maxC; c++) {
        const cell = document.createElement('div');
        if (occ.has(r + ',' + c)) {
          cell.className = 'piece-cell';
          try { paintCellColor(cell, p.color); } catch (_) {
            cell.style.background = p.color;
            cell.style.backgroundColor = p.color;
            cell.style.setProperty('--cell-base', p.color);
            cell.style.setProperty('--cell-glow', p.color);
          }
          cell.style.width = cellPx + 'px';
          cell.style.height = cellPx + 'px';
        }
        gridEl.appendChild(cell);
      }
    }
    slot.appendChild(gridEl);
    area.appendChild(slot);
    const quiet = !!(BPState.quietPieceRender);
    const animateIn = !quiet && !!(BPState.animateDealIn);
    if (animateIn) {
      slot.classList.add('deal-in');
      slot.style.opacity = '0';
      slot.style.transform = 'scale(0.72) translateY(8px)';
      const delay = idx * 45;
      setTimeout(() => {
        try {
          slot.classList.add('show');
          slot.style.opacity = '1';
          slot.style.transform = 'scale(1) translateY(0)';
        } catch (_) {}
      }, 20 + delay);
      setTimeout(() => {
        try { slot.classList.remove('deal-in'); } catch (_) {}
      }, 300 + delay);
    } else {
      slot.classList.add('show');
      slot.style.opacity = '1';
      slot.style.transform = 'none';
      slot.style.transition = 'none';
      try { slot.style.animation = 'none'; } catch (_) {}
    }
  });
  try { BPState.animateDealIn = false; } catch (_) {}
}
const boardEl = document.getElementById('board');
const boardMe = document.getElementById('boardMe');
const boardOpp = document.getElementById('boardOpp');
const piecesArea = document.getElementById('piecesArea');
const piecesAreaVs = document.getElementById('piecesAreaVs');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const diamondsEl = document.getElementById('diamonds');
const ghost = document.getElementById('ghost');
const comboBanner = document.getElementById('comboBanner');
const comboBannerMe = document.getElementById('comboBannerMe');
const timerEl = document.getElementById('timer');
const gameOverEl = document.getElementById('gameOver');
const stuckOfferEl = document.getElementById('stuckOffer');

