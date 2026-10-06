/**
 * Block Puzzle — js/08-gameplay/05-board-metrics-drag-state.js
 * Board metrics, drag state, live-match UI prep.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
function getActiveBoard() { return mode==='versus' ? boardMe : boardEl; }
function getActiveGrid() { return grid; }
function getActivePiecesArea() { return mode==='versus' ? piecesAreaVs : piecesArea; }
function getActiveBanner() { return mode==='versus' ? comboBannerMe : comboBanner; }

let _metricsDirty = true;
let _finePointerCached = null;
function invalidateBoardMetrics() { _metricsDirty = true; }
function updateBoardMetrics(el) {
  const target = el || getActiveBoard();
  if (!target) return;
  boardRect = target.getBoundingClientRect();
  // Uniform step across the board — robust under any CSS scale/gap
  const step = boardRect.width / SIZE;
  gap = 0;
  cellSize = step;
  // Refine with real first-cell size when available (for visual lift only)
  const c0 = target.children[0];
  if (c0) {
    const r0 = c0.getBoundingClientRect();
    if (r0.width > 4) cellSize = r0.width;
  }
  _metricsDirty = false;
}
function ensureBoardMetrics() {
  if (_metricsDirty || !boardRect || boardRect.width < 8) updateBoardMetrics();
}
function isFinePointer() {
  if (_finePointerCached != null) return _finePointerCached;
  try {
    _finePointerCached = !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
  } catch (_) { _finePointerCached = false; }
  return _finePointerCached;
}
/** Finger → board aim point. No magnet — 1:1 with finger, piece lifted above. */
function aimFromPointer(clientX, clientY) {
  ensureBoardMetrics();
  // Ghost sits above the contact point so a finger does not cover the piece
  const fine = isFinePointer();
  const base = cellSize > 4 ? cellSize : 24;
  const lift = fine
    ? Math.max(6, Math.min(18, base * 0.35))
    // Touch: lift ~1.5–2 cell heights above fingertip
    : Math.max(52, Math.min(88, base * 1.85));
  return { x: clientX, y: clientY - lift, lift };
}

function eventClientXY(e) {
  if (!e) return { x: 0, y: 0 };
  if (typeof e.clientX === 'number' && (e.touches === undefined || !e.touches.length)) {
    return { x: e.clientX, y: e.clientY };
  }
  const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]);
  if (t) return { x: t.clientX, y: t.clientY };
  if (typeof e.clientX === 'number') return { x: e.clientX, y: e.clientY };
  return { x: 0, y: 0 };
}
let activeDragPointerId = null;
/** Slot currently under an active drag — never strip lifting / rebuild while held. */
let activeDragSlot = null;
function clearAllLifting(areaEl) {
  try {
    // While the player is holding a piece, never strip the active slot —
    // concurrent opp_place / softRender can call this and snap the piece back.
    if (typeof isDragging !== 'undefined' && isDragging && activeDragSlot) {
      const root = areaEl || document;
      root.querySelectorAll('.piece-slot.lifting').forEach(s => {
        if (s === activeDragSlot) return;
        if (!s.classList.contains('used')) {
          s.classList.remove('lifting');
          s.classList.add('show');
        }
      });
      return;
    }
    const root = areaEl || document;
    root.querySelectorAll('.piece-slot.lifting').forEach(s => {
      if (!s.classList.contains('used')) {
        s.classList.remove('lifting');
        s.classList.add('show');
      }
    });
  } catch (_) {}
}
/**
 * Close every transient UI layer when a real match is about to start
 * (ranked, private, rematch, rejoin). Replay scrubber, modals, toasts —
 * nothing may block piece input or cover the board.
 */
function prepareUiForLiveMatch() {
  try {
    // Stop replay / review
    if (typeof replayTimer !== 'undefined' && replayTimer) {
      try { clearTimeout(replayTimer); } catch (_) {}
      try { replayTimer = null; } catch (_) {}
    }
    try { replayMode = false; } catch (_) {}
    try {
      document.body.classList.remove(
        'replay-ui', 'replay-playing', 'match-ending',
        'rejoin-loading', 'quiet-hands', 'vs-bots'
      );
    } catch (_) {}
    try {
      const rb = document.getElementById('reviewBar');
      if (rb) rb.classList.remove('visible', 'replay-dock');
    } catch (_) {}
    try {
      const scrub = document.getElementById('replayScrubBar');
      if (scrub) {
        scrub.style.display = 'none';
        scrub.setAttribute('aria-hidden', 'true');
        scrub.classList.remove('visible');
      }
    } catch (_) {}
    try {
      document.querySelectorAll('.replay-scrub, .review-bar, #reviewBar, #replayScrubBar').forEach((el) => {
        try {
          el.classList.remove('visible', 'show', 'replay-dock');
          if (el.id === 'replayScrubBar') el.style.display = 'none';
        } catch (_) {}
      });
    } catch (_) {}
    // Result / duel / rematch chrome
    try { if (typeof dismissPostMatchResult === 'function') dismissPostMatchResult(); } catch (_) {}
    try { if (typeof hideRematchOffer === 'function') hideRematchOffer(); } catch (_) {}
    try { if (typeof hideRematchWait === 'function') hideRematchWait(); } catch (_) {}
    try { if (typeof hideRmToast === 'function') hideRmToast(false); } catch (_) {}
    try {
      document.getElementById('versusResult')?.classList.remove('visible');
      const sd = document.getElementById('scoreDuelOverlay');
      if (sd) {
        sd.classList.remove('visible', 'show-verdict', 'duel-win', 'duel-lose', 'duel-draw');
        sd.setAttribute('aria-hidden', 'true');
      }
      document.getElementById('matchEndFreeze')?.classList.remove('visible', 'show');
    } catch (_) {}
    // Social / search / auth modals
    try { if (typeof closeNickSearchModal === 'function') closeNickSearchModal(); } catch (_) {}
    try { if (typeof closeFriendMiniProfile === 'function') closeFriendMiniProfile(); } catch (_) {}
    try { if (typeof closeAuthModal === 'function') closeAuthModal(); } catch (_) {}
    try { if (typeof closeAccountDeleteModal === 'function') closeAccountDeleteModal(); } catch (_) {}
    try {
      ['nickSearchModal', 'friendMiniProfileModal', 'authModal', 'accountDeleteModal',
       'lobbyInviteModal', 'bpConfirmModal', 'settingsModal'].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.classList.remove('visible', 'show');
        el.setAttribute('aria-hidden', 'true');
        try { el.hidden = true; } catch (_) {}
        try { el.style.display = 'none'; } catch (_) {}
      });
    } catch (_) {}
    // Achievement / shop overlays that might sit on top
    try { if (typeof closeAllAchTabs === 'function') closeAllAchTabs(); } catch (_) {}
    try {
      document.querySelectorAll('.modal.visible, .overlay.visible, .sheet.visible').forEach((el) => {
        // Keep match-critical overlays (loading / versus HUD)
        const id = el.id || '';
        if (id === 'screenVersus' || id === 'matchLoading' || id === 'vsLiveControls') return;
        if (el.closest && el.closest('#screenVersus')) return;
        try {
          el.classList.remove('visible', 'show');
          el.setAttribute('aria-hidden', 'true');
        } catch (_) {}
      });
    } catch (_) {}
    // Input locks left over from replay / result
    try { placingLock = false; } catch (_) {}
    try {
      BPState.rejoinLoading = false;
      BPState.rejoinInputLock = false;
      BPState.paintFrozen = false;
      BPState.quietPieceRender = false;
    } catch (_) {}
    try { if (typeof cancelActivePieceDrag === 'function') cancelActivePieceDrag(); } catch (_) {}
    try { if (typeof clearAllLifting === 'function') clearAllLifting(); } catch (_) {}
    try { if (typeof hideGhost === 'function') hideGhost(); } catch (_) {}
  } catch (e) {
    try { console.warn('prepareUiForLiveMatch', e); } catch (_) {}
  }
}
try { window.prepareUiForLiveMatch = prepareUiForLiveMatch; } catch (_) {}

/** Abort any in-progress piece drag (used during rejoin load). */
function cancelActivePieceDrag() {
  try {
    isDragging = false;
    activeDragPointerId = null;
    activeDragSlot = null;
    dragPiece = null;
    _dragShapeMaxR = _dragShapeMaxC = 0;
    selectedIdx = -1;
    lastPreview = null;
    if (typeof rafId !== 'undefined' && rafId) {
      try { cancelAnimationFrame(rafId); } catch (_) {}
      rafId = 0;
    }
    try { clearPreview(); } catch (_) {}
    try { hideGhost(); } catch (_) {}
    try {
      if (ghost) {
        ghost.classList.remove('visible');
        ghost.style.display = 'none';
      }
    } catch (_) {}
    try { clearAllLifting(); } catch (_) {}
    // Strip document-level drag listeners that may still be attached
    try {
      const noop = () => {};
      document.removeEventListener('pointermove', noop);
      // Named handlers are scoped inside startDrag — force visual restore via re-render
    } catch (_) {}
  } catch (_) {}
}
