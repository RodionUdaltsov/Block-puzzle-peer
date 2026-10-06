/**
 * Block Puzzle — js/05-render-and-match-state/01-soft-render.js
 * Differential rendering of boards and piece trays.
 * Shares the client bundle scope (order: public/js/modules.json).
 */

const _boardCellCache = new WeakMap();
function _cachedBoardCells(boardEl) {
  let cells = _boardCellCache.get(boardEl);
  if (!cells || cells.length !== SIZE * SIZE || cells.some((c, i) => !c || c !== boardEl.children[i])) {
    cells = Array.from(boardEl.children).filter(el => el && el.classList && el.classList.contains('cell'));
    _boardCellCache.set(boardEl, cells);
  }
  return cells;
}

function softRenderGrid(g, boardEl) {
  /* OPP CLEAR HOLD GUARD: while holding, only update opponent board; never touch metrics/ghost */
  try {
    const holding = (typeof isDragging !== 'undefined' && isDragging)
      || (typeof activeDragSlot !== 'undefined' && activeDragSlot)
      || (document.body && document.body.classList.contains('is-dragging'));
    if (holding) {
      const isMe = boardEl && (
        boardEl.id === 'boardMe' || boardEl.id === 'board'
        || (typeof boardMe !== 'undefined' && boardEl === boardMe)
        || (typeof boardEl !== 'undefined' && boardEl === boardEl && boardEl.id === 'board')
      );
      // Local board: skip entirely during hold (prevents layout thrash → ghost blink)
      if (isMe || (boardEl && boardEl.id === 'boardMe') || (boardEl && boardEl.id === 'board')) {
        try { if (typeof ensureHeldPieceVisible === 'function') ensureHeldPieceVisible(); } catch (_) {}
        return;
      }
    }
  } catch (_) {}

  if (!boardEl || !g) return;
  try {
    // Never thrash board mid clear animation (esp. mobile 420ms window)
    if (typeof isClearBusy === 'function' && isClearBusy(boardEl)) return;
    // Prefer differential cell update if board already has cells
    const cells = _cachedBoardCells(boardEl);
    if (cells && cells.length === SIZE * SIZE) {
      const clearingSet = (typeof CLEARING_CLASSES !== 'undefined' && CLEARING_CLASSES)
        ? CLEARING_CLASSES
        : ['clearing', 'clearing-common', 'clearing-mobile-soft', 'placing'];
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          const cell = cells[r * SIZE + c];
          if (!cell) continue;
          const val = g[r] && g[r][c];
          const filled = !!val;
          let isClearing = false;
          for (let k = 0; k < clearingSet.length; k++) {
            if (cell.classList.contains(clearingSet[k])) { isClearing = true; break; }
          }
          const isPlacing = cell.classList.contains('placing');
          const was = cell.classList.contains('filled') || cell.classList.contains('has-block') || isClearing || isPlacing;
          if (filled && !was) {
            cell.classList.add('filled');
            try { paintCellColor(cell, val); } catch (_) {}
            cell.dataset.renderColor = String(val);
          } else if (!filled && was) {
            // Let in-flight CLEAR finish. Placing on a now-empty cell must
            // clear (line clear after place) — do not freeze placing forever.
            if (isClearing) continue;
            // Full cleanup — incomplete wipe left painted squares until next place
            try {
              cell.style.setProperty('transition', 'none', 'important');
              cell.style.setProperty('animation', 'none', 'important');
              cell.style.background = '';
              cell.style.backgroundColor = '';
              cell.style.backgroundImage = '';
              cell.style.removeProperty('--cell-base');
              cell.style.removeProperty('--cell-glow');
              cell.style.removeProperty('transform');
              cell.style.removeProperty('opacity');
              cell.style.removeProperty('filter');
              cell.style.removeProperty('box-shadow');
              cell.style.removeProperty('clip-path');
            } catch (_) {}
            for (let k = 0; k < clearingSet.length; k++) cell.classList.remove(clearingSet[k]);
            cell.classList.remove('filled', 'has-block', 'preview-ok', 'preview-bad', 'placing');
            delete cell.dataset.renderColor;
            requestAnimationFrame(() => {
              try {
                if (!cell.classList.contains('filled')) {
                  cell.style.removeProperty('transition');
                  cell.style.removeProperty('animation');
                }
              } catch (_) {}
            });
          } else if (filled) {
            // Don't repaint a cell whose color is already represented in the DOM.
            // Opponent snapshots can arrive frequently; repainting all 64 cells
            // on every snapshot creates needless style/paint work on phones.
            if (isClearing || isPlacing) continue;
            const renderKey = String(val);
            if (cell.dataset.renderColor !== renderKey) {
              try { paintCellColor(cell, val); } catch (_) {}
              cell.dataset.renderColor = renderKey;
            }
            if (!cell.classList.contains('filled')) cell.classList.add('filled');
          }
        }
      }
      return;
    }
  } catch (_) {}
  try { renderGrid(g, boardEl); } catch (_) {}
}
function softRenderPieces(areaEl) {
  if (!areaEl) return;
  // While the player is holding a piece, never rebuild the hand DOM —
  // that drops pointer capture on phones and snaps the ghost back to tray.
  // Also keep the floating ghost visible if an opp clear/sync tried to hide it.
  try {
    const holding = (typeof isDragging !== 'undefined' && isDragging)
      || (typeof activeDragSlot !== 'undefined' && activeDragSlot)
      || (typeof document !== 'undefined' && document.body && document.body.classList.contains('is-dragging'));
    if (holding) {
      try { if (typeof ensureHeldPieceVisible === 'function') ensureHeldPieceVisible(); } catch (_) {}
      return;
    }
  } catch (_) {}
  try {
    if (!pieces || !pieces.length) {
      try { recoverHandsFromMatchLog(); } catch (_) {}
    }
    if (!pieces || !pieces.length) return;
    const slots = areaEl.querySelectorAll('.piece-slot');
    const heldSlot = (typeof activeDragSlot !== 'undefined' && activeDragSlot) ? activeDragSlot : null;
    // Same count: update used flags only — no innerHTML wipe (no jump)
    if (slots.length === pieces.length) {
      let needsFull = false;
      for (let i = 0; i < pieces.length; i++) {
        const p = pieces[i];
        const slot = slots[i];
        if (!slot) { needsFull = true; break; }
        // Never mutate the slot currently under the finger (active drag only)
        const liveHold = !!(typeof isDragging !== 'undefined' && isDragging) && heldSlot;
        if (liveHold && slot === heldSlot) continue;
        // Stuck lifting without drag — clear so the piece is visible again
        if (slot.classList.contains('lifting') && !liveHold) {
          slot.classList.remove('lifting');
        }
        if (liveHold && slot.classList.contains('lifting')) continue;
        // Shape mismatch (rejoin desync) → full rebuild so pieces stay pickable
        const domSig = slot.dataset && slot.dataset.handSig;
        const pSig = _pieceHandSig(p);
        if (domSig && pSig && domSig !== pSig && !p.used) {
          needsFull = true;
          break;
        }
        const usedDom = slot.classList.contains('used');
        if (!!p.used !== usedDom) {
          if (p.used) {
            slot.classList.add('used');
            slot.classList.remove('show', 'lifting');
            try {
              slot.style.width = '0';
              slot.style.minWidth = '0';
              slot.style.maxWidth = '0';
              slot.style.height = '0';
              slot.style.opacity = '0';
              slot.style.margin = '0';
              slot.style.padding = '0';
              slot.style.border = 'none';
              slot.style.pointerEvents = 'none';
              if (pSig) slot.dataset.handSig = pSig;
              setTimeout(() => { try { slot.innerHTML = ''; } catch (_) {} }, 260);
            } catch (_) {}
          } else {
            needsFull = true;
            break;
          }
        } else if (domSig && pSig && domSig !== pSig && p.used) {
          try { slot.dataset.handSig = pSig; } catch (_) {}
        }
      }
      if (!needsFull) {
        // Preserve lifting ONLY on the slot currently held. Any other .lifting is
        // a stuck state that made pieces invisible (tray opacity:0, no ghost).
        const liveHold = !!(typeof isDragging !== 'undefined' && isDragging) && heldSlot;
        slots.forEach(s => {
          if (liveHold && s === heldSlot) return;
          if (s.classList.contains('lifting')) {
            s.classList.remove('lifting');
          }
          if (!s.classList.contains('used')) {
            s.classList.add('show');
            s.style.opacity = '';
            s.style.visibility = '';
            s.style.pointerEvents = 'auto';
            s.style.touchAction = 'none';
          }
        });
        return;
      }
    }
  } catch (_) {}
  try {
    // Debounce rapid full rebuilds (concurrent place_ok + state + deal storms)
    const now = Date.now();
    if (window._lastSoftHandFullAt && (now - window._lastSoftHandFullAt) < 80) {
      if (window._softHandFullTimer) clearTimeout(window._softHandFullTimer);
      window._softHandFullTimer = setTimeout(() => {
        try {
          if ((typeof isDragging !== 'undefined' && isDragging)
              || (typeof activeDragSlot !== 'undefined' && activeDragSlot)) {
            return;
          }
          window._lastSoftHandFullAt = Date.now();
          BPState.quietPieceRender = true;
          renderPieces(areaEl);
          BPState.quietPieceRender = false;
        } catch (_) {
          try { BPState.quietPieceRender = false; } catch (_2) {}
        }
      }, 90);
      return;
    }
    window._lastSoftHandFullAt = now;
    // Quiet full rebuild: skip staggered fade-in (sync/rejoin)
    BPState.quietPieceRender = true;
    renderPieces(areaEl);
    BPState.quietPieceRender = false;
  } catch (_) {
    try { BPState.quietPieceRender = false; } catch (_2) {}
  }
}
function _pieceHandSig(p) {
  try {
    if (!p) return 'X';
    const sh = (p.shape || []).map(c => Array.isArray(c) ? (c[0] + ':' + c[1]) : String(c)).join(';');
    return (p.used ? 'U' : 'A') + '|' + (p.color || '') + '|' + sh;
  } catch (_) { return 'X'; }
}
function softRenderOppPieces() {
  try {
    const area = document.getElementById('piecesAreaOpp');
    if (!area) { renderOppPieces(); return; }
    if (!oppPieces || !oppPieces.length) {
      try { recoverHandsFromMatchLog(); } catch (_) {}
    }
    if (!oppPieces || !oppPieces.length) return;
    // Mid place-anim: never rebuild opp tray
    try { if (typeof _oppPlaceAnimBusy !== 'undefined' && _oppPlaceAnimBusy) return; } catch (_) {}
    const slots = area.querySelectorAll('.piece-slot');
    if (slots.length === oppPieces.length) {
      let needsFull = false;
      for (let i = 0; i < oppPieces.length; i++) {
        const p = oppPieces[i];
        const slot = slots[i];
        if (!slot) { needsFull = true; break; }
        const usedDom = slot.classList.contains('used');
        if (!!p.used !== usedDom) {
          if (p.used) {
            // Soft collapse — no full rebuild (prevents jump)
            slot.classList.add('used');
            slot.classList.remove('show', 'lifting');
            try {
              slot.style.width = '0';
              slot.style.minWidth = '0';
              slot.style.maxWidth = '0';
              slot.style.height = '0';
              slot.style.opacity = '0';
              slot.style.margin = '0';
              slot.style.padding = '0';
              slot.style.border = 'none';
              slot.style.pointerEvents = 'none';
              setTimeout(() => { try { slot.innerHTML = ''; } catch (_) {} }, 260);
            } catch (_) {}
          } else {
            needsFull = true;
            break;
          }
        }
      }
      if (!needsFull) {
        slots.forEach(s => {
          if (!s.classList.contains('used')) {
            s.classList.remove('lifting');
            s.classList.add('show');
            s.style.opacity = '1';
            s.style.visibility = '';
            s.style.width = '';
            s.style.minWidth = '';
            s.style.maxWidth = '';
            s.style.height = '';
          }
        });
        return;
      }
    }
    // Debounce rapid full rebuilds
    const now = Date.now();
    if (window._lastSoftOppHandFullAt && (now - window._lastSoftOppHandFullAt) < 80) {
      if (window._softOppHandFullTimer) clearTimeout(window._softOppHandFullTimer);
      window._softOppHandFullTimer = setTimeout(() => {
        try {
          window._lastSoftOppHandFullAt = Date.now();
          BPState.quietPieceRender = true;
          renderOppPieces();
          BPState.quietPieceRender = false;
        } catch (_) {
          try { BPState.quietPieceRender = false; } catch (_2) {}
        }
      }, 90);
      return;
    }
    window._lastSoftOppHandFullAt = now;
    BPState.quietPieceRender = true;
    renderOppPieces();
    BPState.quietPieceRender = false;
  } catch (_) {
    try { BPState.quietPieceRender = false; renderOppPieces(); } catch (_2) {}
  }
}
