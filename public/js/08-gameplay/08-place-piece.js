/**
 * Block Puzzle — js/08-gameplay/08-place-piece.js
 * tryPlaceAt: placing a piece.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
/** Diamonds from multi-clears: classic and all versus modes (bots, ranked, friends). */
function canEarnClearDiamonds() {
  return mode === 'classic' || mode === 'versus';
}
function tryPlaceAt(x, y, forcedResult) {
  // Only hard rejoin overlay blocks; _mpRejoiningMatch alone must not freeze the player
  if (BPState.rejoinLoading || BPState.rejoinInputLock || placingLock) return false;
  const pos = getGridPos(x, y);
  if (!pos || selectedIdx < 0 || !dragPiece) return false;
  const result = (forcedResult && forcedResult.valid) ? forcedResult : findBestPlacement(dragPiece.shape, pos.r, pos.c);
  if (!result.valid) return false;

  const isServerMatch = !!(roomMatchMode || BPState.roomMatchMode);

  // ——— Server-authoritative place (online room / ranked) ———
  // Client only sends intent; grid/hand/score come back via place_ok.
  if (isServerMatch) {
    placingLock = true;
    hapticTap(14);
    SFX.place();
    const color = dragPiece.color;
    let shape = (dragPiece.shape || []).map(p => Array.isArray(p) ? [p[0]|0, p[1]|0] : p);
    // Recover if hand/shape was corrupted mid-drag (e.g. softRender / log rebuild)
    if (dragPiece._shapeLen && shape.length !== dragPiece._shapeLen && pieces && pieces[selectedIdx]) {
      try {
        const src = pieces[selectedIdx].shape;
        if (src && src.length === dragPiece._shapeLen) {
          shape = src.map(p => Array.isArray(p) ? [p[0]|0, p[1]|0] : p);
        }
      } catch (_) {}
    }
    const placedIdx = selectedIdx;
    const board = getActiveBoard();
    let netShape = shape.map(p => p.slice());
    try {
      if (typeof normalize === 'function') netShape = normalize(netShape.map(p => p.slice()));
    } catch (_) {}

    // Soft local preview only (not authoritative). Rollback on place_reject.
    const _legendNow = document.body.classList.contains('skin-fx-prism');
    BPState.pendingServerPlace = {
      pieceIdx: placedIdx,
      r: result.baseR,
      c: result.baseC,
      shape: netShape.map(c => c.slice()),
      color,
      gridBefore: grid.map(row => row.slice()),
      piecesBefore: (pieces || []).map(p => ({
        shape: (p.shape || []).map(c => Array.isArray(c) ? c.slice() : c),
        color: p.color,
        used: !!p.used
      })),
      scoreBefore: score | 0,
      legendFx: !!_legendNow,
      skinId: _legendNow ? (document.body.dataset.skinId || (typeof equippedSkinId !== 'undefined' ? equippedSkinId : null)) : null
    };
    try {
      for (const [dr, dc] of shape) {
        const cell = board && board.children[(result.baseR + dr) * SIZE + (result.baseC + dc)];
        if (!cell) continue;
        cell.classList.remove('preview-ok', 'preview-bad', 'placing');
        paintCellColor(cell, color);
        cell.classList.add('filled');
        try {
          cell.style.removeProperty('animation');
          cell.style.removeProperty('transition');
          cell.style.removeProperty('transform');
          cell.style.removeProperty('opacity');
        } catch (_) {}
      }
      // Commit filled paint, then start placeSoft from 0% (same as offline path)
      requestAnimationFrame(() => {
        for (const [dr, dc] of shape) {
          const cell = board && board.children[(result.baseR + dr) * SIZE + (result.baseC + dc)];
          if (!cell || !cell.classList.contains('filled')) continue;
          cell.classList.remove('placing');
          try { void cell.offsetWidth; } catch (_) {}
          cell.classList.add('placing');
        }
      });
      if (pieces[placedIdx]) pieces[placedIdx].used = true;
      selectedIdx = -1;
      isDragging = false;
      dragPiece = null;
      try { markPieceUsed(placedIdx, getActivePiecesArea()); } catch (_) {}
      // Legendary place sparks for the local player (online path used to skip these)
      try {
        const isLegendPlace = document.body.classList.contains('skin-fx-prism');
        if (isLegendPlace && typeof spawnLegendSparks === 'function' && board) {
          const wrap = board.parentElement;
          const maxR = Math.max(...shape.map(s => s[0]));
          const maxC = Math.max(...shape.map(s => s[1]));
          const cell0 = board.children[result.baseR * SIZE + result.baseC];
          let origin = null;
          if (cell0 && wrap) {
            const cr = cell0.getBoundingClientRect();
            const wr = wrap.getBoundingClientRect();
            origin = {
              left: cr.left - wr.left + cr.width * (0.5 + maxC / 2),
              top: cr.top - wr.top + cr.height * (0.5 + maxR / 2)
            };
          }
          spawnLegendSparks(wrap, 6 + shape.length, document.body.dataset.skinId || equippedSkinId, origin);
        }
      } catch (_) {}
    } catch (_) {}

    try {
      roomSendPlace({
        shape: netShape,
        color,
        r: result.baseR,
        c: result.baseC,
        pieceIdx: placedIdx
        // NO score/grid/pieces — server is sole authority
      });
    } catch (e) {
      console.warn('roomSendPlace', e);
      try { rollbackPendingServerPlace(); } catch (_) {}
      placingLock = false;
      return false;
    }
    // Safety unlock if server never answers
    try {
      if (BPState.pendingPlaceTimer) clearTimeout(BPState.pendingPlaceTimer);
      BPState.pendingPlaceTimer = setTimeout(() => {
        if (BPState.pendingServerPlace) {
          try { MatchClient && MatchClient.sync && MatchClient.sync({}); } catch (_) {}
        }
        placingLock = false;
      }, 4000);
    } catch (_) {}
    return true;
  }

  placingLock = true;
  hapticTap(14);
  SFX.place();
  const color = dragPiece.color;
  let shape = (dragPiece.shape || []).map(p => Array.isArray(p) ? [p[0]|0, p[1]|0] : p);
  if (dragPiece._shapeLen && shape.length !== dragPiece._shapeLen && pieces && pieces[selectedIdx]) {
    try {
      const src = pieces[selectedIdx].shape;
      if (src && src.length === dragPiece._shapeLen) {
        shape = src.map(p => Array.isArray(p) ? [p[0]|0, p[1]|0] : p);
      }
    } catch (_) {}
  }
  if (!shape.length) return false;
  const placedIdx = selectedIdx;
  const board = getActiveBoard(), g = getActiveGrid(), areaEl = getActivePiecesArea(), banner = getActiveBanner();
  for (const [dr,dc] of shape) g[result.baseR+dr][result.baseC+dc] = color;
  pieces[placedIdx].used = true; selectedIdx = -1;
  // Unlock immediately so the next piece can be grabbed without waiting for anim
  placingLock = false;
  // Visual: promote preview cells → filled + restart place anim so mobile sees full soft settle
  const placeCells = [];
  for (const [dr,dc] of shape) {
    const cell = board.children[(result.baseR+dr)*SIZE+(result.baseC+dc)];
    if (!cell) continue;
    // Drop preview classes without wiping paint (avoids A→D skip of placeSoft)
    cell.classList.remove('preview-ok', 'preview-bad');
    paintCellColor(cell, color);
    cell.classList.add('filled');
    cell.classList.remove('placing');
    // Clear any leftover inline anim kills from clear/render paths
    cell.style.removeProperty('animation');
    cell.style.removeProperty('transition');
    cell.style.removeProperty('transform');
    cell.style.removeProperty('opacity');
    placeCells.push(cell);
  }
  // Detach from preview tracking so later clearPreview won't touch these cells
  try {
    if (_previewCells && _previewCells.length) {
      const set = new Set(placeCells);
      _previewCells = _previewCells.filter(c => !set.has(c));
    }
  } catch (_) {}
  // Restart placeSoft reliably (Safari/mobile often drop a double-rAF under load).
  // Visual = same keyframes; force reflow so animation always begins from 0%.
  const startPlaceSoft = () => {
    for (let i = 0; i < placeCells.length; i++) {
      const cell = placeCells[i];
      if (!cell || !cell.classList.contains('filled')) continue;
      cell.classList.remove('placing');
      try { void cell.offsetWidth; } catch (_) {}
      cell.classList.add('placing');
    }
  };
  requestAnimationFrame(startPlaceSoft);
  const isLegendPlace = document.body.classList.contains('skin-fx-prism');
  try {
    const _mr = Math.max(...shape.map(s => s[0]));
    const _mc = Math.max(...shape.map(s => s[1]));
    window._lastPlaceAnchor = {
      baseR: result.baseR,
      baseC: result.baseC,
      centerR: result.baseR + _mr / 2,
      centerC: result.baseC + _mc / 2
    };
    // Legendary place: soft spark burst at piece center (local)
    if (isLegendPlace && typeof spawnLegendSparks === 'function') {
      const wrap = board.parentElement;
      const cell0 = board.children[result.baseR * SIZE + result.baseC];
      let origin = null;
      if (cell0) {
        const cr = cell0.getBoundingClientRect();
        const wr = wrap.getBoundingClientRect();
        origin = {
          left: cr.left - wr.left + cr.width * (0.5 + _mc / 2),
          top: cr.top - wr.top + cr.height * (0.5 + _mr / 2)
        };
      }
      spawnLegendSparks(wrap, 6 + shape.length, document.body.dataset.skinId, origin);
    }
  } catch (_) {}
  const placePts = shape.length * 10;
  score += placePts;
  if (mode==='versus') {
    matchLog.push({
      type: 'place',
      side: 'me',
      t: Date.now() - matchStartTs,
      shape: (typeof normalize === 'function' ? normalize(shape.map(p => p.slice())) : shape.map(p => p.slice())),
      color,
      r: result.baseR,
      c: result.baseC,
      myScore: score,
      oppScore,
      pieceIdx: (typeof placedIdx === 'number' && placedIdx >= 0) ? placedIdx : -1,
      placePts,
      legendFx: !!isLegendPlace,
      skinId: isLegendPlace ? (document.body.dataset.skinId || equippedSkinId || null) : null
    });
    document.getElementById('myScore').textContent = score;
    try { if (typeof noteMyAction === 'function') noteMyAction(); } catch (_) {}
    try { persistLiveMatch(); } catch (_) {}
    // Online room path already sent intent above and returned.
    // Bots / offline still use local state only.
    if (false && mpMode) {
      let netShape = shape.map(p => p.slice());
      try {
        if (typeof normalize === 'function') netShape = normalize(netShape.map(p => p.slice()));
      } catch (_) {}
      
    }
    if (aiStuck && score > oppScore) { endVersus(); return true; }
  } else updateClassicUI();
  // Clear immediately when the piece is placed (classic + versus)
  const runPlaceClear = () => {
    if (!vsActive && mode==='versus') { placingLock = false; return; }
    // Keep .placing so placeSoft is visible even on rapid successive places;
    // clearLinesOn overrides anim only on cells that actually clear.
    const clearInfo = clearLinesOn(g, board);
    const cleared = clearInfo.count || 0;
    if (cleared > 0) {
      clearChain = (clearChain || 0) + 1;
      bumpAchStat('linesCleared', cleared);
      const baseBonus = bonusFor(cleared);
      const chainExtra = chainBonusFor(clearChain);
      const bonus = baseBonus + chainExtra;
      score += bonus;
      if (cleared >= 3 || clearChain >= 2) SFX.combo();
      else SFX.clear(cleared);
      const wrap = board.parentElement;
      const maxR = Math.max(...shape.map(s => s[0]));
      const maxC = Math.max(...shape.map(s => s[1]));
      const placeAnchor = {
        baseR: result.baseR,
        baseC: result.baseC,
        centerR: result.baseR + maxR / 2,
        centerC: result.baseC + maxC / 2
      };
      const positions = getClearFloatPositions(board, clearInfo.rows, clearInfo.cols, placeAnchor);
      showCombo(banner, cleared, bonus, wrap, 'me', {
        chain: clearChain,
        positions,
        baseBonus,
        chainExtra,
        placeAnchor
      });
      // Achievements (classic tracking)
      if (mode === 'classic') {
        const cmax = Math.max(cleared || 0, clearChain || 0);
        if (cmax >= 2) setAchStat('combo2', 1);
        if (cmax >= 3) setAchStat('combo3', 1);
        if (cmax >= 4) setAchStat('megaCombo', 1);
        if (cmax >= 5) setAchStat('combo5', 1);
        if (cmax >= 6) setAchStat('combo6', 1);
        if (cmax >= 7) setAchStat('combo7', 1);
        if (cmax >= 8) setAchStat('combo8', 1);
        if (cmax >= 10) setAchStat('combo10', 1);
      }
      // Diamonds for ×4+ clears: classic, bots, ranked online — NOT friend/lobby matches
      if (cleared >= 4 && canEarnClearDiamonds()) {
        diamonds += cleared >= 6 ? 2 : 1;
        try { localStorage.setItem('bp_diamonds', String(diamonds)); } catch (_) {}
        if (mode === 'classic') updateClassicUI();
        else {
          try {
            const dEl = document.getElementById('diamonds');
            if (dEl) dEl.textContent = diamonds;
            updateMenuStats();
          } catch (_) {}
        }
      } else if (mode === 'classic') {
        updateClassicUI();
      }
      if (mode==='versus') {
        document.getElementById('myScore').textContent = score;
        if (matchLog.length) {
          const last = matchLog[matchLog.length - 1];
          if (last && last.type === 'place' && last.side === 'me') {
            last.myScore = score;
            last.oppScore = oppScore;
            last.cleared = cleared;
            last.bonus = bonus;
            last.baseBonus = baseBonus;
            last.chainExtra = chainExtra;
            last.chain = clearChain;
            last.rows = clearInfo.rows ? clearInfo.rows.slice() : [];
            last.cols = clearInfo.cols ? clearInfo.cols.slice() : [];
          }
        }
        if (mpMode) {
          
          
        }
        if (aiStuck && score > oppScore) { placingLock = false; endVersus(); return; }
      } else updateClassicUI();
    } else {
      clearChain = 0;
    }
    if (mode==='classic') updateClassicUI();
    placingLock = false;
    if (pieces.every(p=>p.used)) {
      setTimeout(() => {
        generatePieces(areaEl);
        if (mode==='classic') setTimeout(checkStuck, 100);
        if (mode==='versus') {
          setPlayerStuck(false);
          // Wait until new pieces painted + board settled
          setTimeout(checkVersusStuck, 400);
        }
      }, 200);
    } else {
      if (mode==='classic') setTimeout(checkStuck, 100);
      // After clearLinesOn (grid already updated) give a beat before stuck check
      if (mode==='versus') setTimeout(checkVersusStuck, 280);
    }
  };
  // Clear fires in the same turn as the place — only yield so the filled paint commits
  requestAnimationFrame(runPlaceClear);
  return true;
}
