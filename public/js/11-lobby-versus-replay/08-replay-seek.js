/**
 * Block Puzzle — js/11-lobby-versus-replay/08-replay-seek.js
 * Replay seek/step.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
function resetReplay() {
  if (!replayData) return;
  stopReplayPlay();
  rebuildReplayTo(replayMinIndex(replayData.moves), true);
}

/** Rebuild state after applying events [0 .. end) */
function rebuildReplayTo(end, animateDeals = false) {
  if (!replayData) return;
  replayBusy = false;
  clearReplayEffects();

  const minIdx = replayMinIndex(replayData.moves);
  end = Math.max(minIdx, Math.min(end, replayData.moves.length));

  grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  oppGrid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  createBoardDOM(boardMe);
  createBoardDOM(boardOpp);

  replayMePieces = [];
  replayOppPieces = [];
  document.getElementById('piecesAreaVs').innerHTML = '';
  const oa = document.getElementById('piecesAreaOpp');
  if (oa) oa.innerHTML = '';

  // Trays from deals + place shapes (place wins) — fixes wrong first hands when opp moved first
  try { rebuildReplayTraysFromMoves(replayData.moves, end); } catch (_) {
    try { applyOpeningReplayHands(replayData.moves, false); } catch (_) {}
  }

  let my = 0, opp = 0;
  for (let i = 0; i < end; i++) {
    const m = replayData.moves[i];
    if (!m) continue;
    if (m.type === 'deal' || m.type === 'Deal') {
      // Tray already built by rebuildReplayTraysFromMoves; optional soft anim on bootstrap deals
      if (animateDeals && i < minIdx) {
        try {
          if (m.side === 'opp') renderReplayTray(document.getElementById('piecesAreaOpp'), replayOppPieces, true, true);
          else renderReplayTray(document.getElementById('piecesAreaVs'), replayMePieces, false, true);
        } catch (_) {}
      }
    } else if (m.type === 'place' || m.shape) {
      const placeSide = m.side === 'opp' ? 'opp' : 'me';
      const g = placeSide === 'me' ? grid : oppGrid;
      const placeShape = Array.isArray(m.shape) ? m.shape : [];
      for (const cell of placeShape) {
        if (!Array.isArray(cell) || cell.length < 2) continue;
        const dr = +cell[0] || 0, dc = +cell[1] || 0;
        if (g[m.r + dr]) g[m.r + dr][m.c + dc] = m.color;
      }
      clearLinesSilent(g);
      if (typeof m.myScore === 'number') my = m.myScore;
      if (typeof m.oppScore === 'number') opp = m.oppScore;
    }
  }

  // Fallback empty trays
  try {
    if (!replayMePieces.length) {
      let di = dealIndexForSideBefore(replayData.moves, 'me', end);
      if (di < 0) di = firstDealIndex(replayData.moves, 'me');
      if (di >= 0) applyReplayDeal(replayData.moves[di], false);
    }
    if (!replayOppPieces.length) {
      let di = dealIndexForSideBefore(replayData.moves, 'opp', end);
      if (di < 0) di = firstDealIndex(replayData.moves, 'opp');
      if (di >= 0) applyReplayDeal(replayData.moves[di], false);
    }
  } catch (_) {}

  renderGrid(grid, boardMe);
  renderGrid(oppGrid, boardOpp);
  renderReplayTray(document.getElementById('piecesAreaVs'), replayMePieces, false, false);
  renderReplayTray(document.getElementById('piecesAreaOpp'), replayOppPieces, true, false);
  document.getElementById('myScore').textContent = my;
  document.getElementById('oppScore').textContent = opp;
  clearReplayEffects();

  // Re-apply cosmetics after createBoardDOM — otherwise opp field/skin resets on step-back
  try {
    if (typeof applyEquippedBoard === 'function') applyEquippedBoard();
    if (typeof applyEquippedSkin === 'function') applyEquippedSkin();
    if (window.mpOppBoardId && typeof applyOppBoard === 'function') applyOppBoard(window.mpOppBoardId);
    else if (replayData && replayData.oppBoardId && typeof applyOppBoard === 'function') {
      window.mpOppBoardId = replayData.oppBoardId;
      applyOppBoard(replayData.oppBoardId);
    }
    if (window.mpOppSkinId && typeof applyOppSkin === 'function') applyOppSkin(window.mpOppSkinId);
    else if (replayData && replayData.oppSkinId && typeof applyOppSkin === 'function') {
      window.mpOppSkinId = replayData.oppSkinId;
      applyOppSkin(replayData.oppSkinId);
    }
  } catch (_) {}

  replayIndex = end;
  replayClockMs = end > 0 ? getEventTime(replayData.moves[end - 1], end - 1) : 0;
  updateReplayClockDisplay();
  document.getElementById('reviewMeta').textContent =
    `Событие ${replayIndex} / ${replayData.moves.length} · ${my}:${opp}`;
  try { updateReplayProgressUI(); } catch (_) {}
}

function replayStepBack() {
  if (!replayData || replayBusy) return;
  const minIdx = (typeof replayMinIndex === 'function')
    ? replayMinIndex(replayData.moves)
    : leadingDealCount(replayData.moves);
  const target = Math.max(minIdx, replayIndex - 1);
  if (target === replayIndex) return;
  seekReplayTo(target, { force: true });
}

function replayStep(onDone, speed = 1) {
  if (!replayData || replayIndex >= replayData.moves.length || replayBusy) {
    if (onDone) onDone();
    return false;
  }
  const m = replayData.moves[replayIndex];
  // Visual timing scales with speed, but 1x matches live feel
  const s = Math.max(1, speed || 1);
  // Softer flight + land (slightly longer at 1x, still snappy when sped up)
  const tFly = Math.max(120, 380 / s);
  const tClear = Math.max(50, 120 / s);
  const tDeal = Math.max(110, 320 / s);
  const tLift = Math.max(50, 100 / s);

  // Deal — soft staggered appear, same as live
  if (m.type === 'deal' || m.type === 'Deal') {
    replayBusy = true;
    applyReplayDeal(m, true);
    replayIndex++;
    document.getElementById('reviewMeta').textContent =
      `Событие ${replayIndex} / ${replayData.moves.length} · раздача (${m.side === 'me' ? 'ты' : 'соперник'})`;
    try { updateReplayProgressUI(); } catch (_) {}
    setTimeout(() => {
      replayBusy = false;
      if (onDone) onDone();
    }, tDeal);
    return true;
  }

  // Place — mirror live: lift → fly → land → collapse → clear + combo floats
  replayBusy = true;
  try {
    ensureReplayHandBefore(m.side === 'opp' ? 'opp' : 'me', replayIndex);
  } catch (_) {}
  const g = m.side === 'me' ? grid : oppGrid;
  const board = m.side === 'me' ? boardMe : boardOpp;
  const boardRect = board.getBoundingClientRect();
  const gapSz = 2.5;
  const step = (boardRect.width - gapSz * (SIZE - 1)) / SIZE;
  const maxR = Math.max(...m.shape.map(s => s[0]));
  const maxC = Math.max(...m.shape.map(s => s[1]));
  const targetX = boardRect.left + (m.c + maxC / 2) * (step + gapSz) + step / 2;
  const targetY = boardRect.top + (m.r + maxR / 2) * (step + gapSz) + step / 2;

  const found = findReplaySlot(m.side, m.shape, m.color, m.pieceIdx);
  let startX, startY;
  if (found.slot) {
    const sr = found.slot.getBoundingClientRect();
    startX = sr.left + sr.width / 2;
    startY = sr.top + sr.height / 2;
    found.slot.classList.add('lifting');
  } else {
    const trayEl = document.getElementById(m.side === 'me' ? 'piecesAreaVs' : 'piecesAreaOpp');
    if (trayEl) {
      const tr = trayEl.getBoundingClientRect();
      startX = tr.left + tr.width / 2;
      startY = tr.top + tr.height / 2;
    } else {
      startX = boardRect.left + boardRect.width / 2;
      startY = boardRect.bottom + 20;
    }
  }

  const ghost = document.getElementById('aiGhost');
  // Apply the same skin FX as the tray / board for this side (legendary prism, epic gloss, …)
  try { setAiGhostSkin(m.side === 'opp' ? 'opp' : 'me'); } catch (_) {}
  let cellPx = Math.max(10, Math.round(step * 0.92));
  let gapPx = Math.max(1, Math.round(step - cellPx));
  try {
    const c0 = board.children[0];
    if (c0) {
      const rw = c0.getBoundingClientRect().width;
      if (rw > 4) { cellPx = Math.round(rw); gapPx = Math.max(1, Math.round(step - cellPx)); }
    }
  } catch (_) {}
  // Normalize shape for ghost grid
  let flyShape = m.shape;
  try { if (typeof normalize === 'function') flyShape = normalize(m.shape.map(c => c.slice())); } catch (_) {}
  ghost.innerHTML = buildPieceGhostHTML({ shape: flyShape, color: m.color }, cellPx, gapPx);
  ghost.style.transition = 'none';
  ghost.style.transform = 'translate(-50%,-50%) scale(0.82)';
  ghost.style.left = startX + 'px';
  ghost.style.top = startY + 'px';
  ghost.style.display = 'block';
  ghost.style.opacity = '0';
  void ghost.offsetWidth;
  // Pickup: fade+scale up in tray, then soft fly + settle onto board
  ghost.style.transition =
    `opacity ${tLift}ms ease, transform ${tLift}ms cubic-bezier(0.33, 0.0, 0.25, 1)`;
  requestAnimationFrame(() => {
    ghost.style.opacity = '1';
    ghost.style.transform = 'translate(-50%,-50%) scale(1.03)';
  });
  setTimeout(() => {
    ghost.style.transition =
      `left ${tFly}ms cubic-bezier(0.25, 0.1, 0.25, 1), top ${tFly}ms cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.15s ease, transform ${tFly}ms cubic-bezier(0.25, 0.1, 0.25, 1)`;
    requestAnimationFrame(() => {
      ghost.style.left = targetX + 'px';
      ghost.style.top = targetY + 'px';
      ghost.style.transform = 'translate(-50%,-50%) scale(1)';
    });
  }, tLift);

  setTimeout(() => {
    for (const [dr, dc] of m.shape) {
      if (!g[m.r + dr]) continue;
      g[m.r + dr][m.c + dc] = m.color;
      const cell = board.children[(m.r + dr) * SIZE + (m.c + dc)];
      if (cell) {
        paintCellColor(cell, m.color);
        cell.classList.add('filled', 'placing');
        setTimeout(() => cell.classList.remove('placing'), Math.max(400, 900 / s));
      }
    }
    // Legendary placement sparks (same as live)
    try {
      const wantLegend = !!(m.legendFx) ||
        (m.side === 'me' && document.body.classList.contains('skin-fx-prism')) ||
        (m.side === 'opp' && document.querySelector('.player-panel.opp') &&
          document.querySelector('.player-panel.opp').classList.contains('skin-fx-prism'));
      if (wantLegend && typeof spawnLegendSparks === 'function') {
        const wrap = board.parentElement;
        const maxRr0 = Math.max(...(m.shape || [[0, 0]]).map(s => s[0]));
        const maxCr0 = Math.max(...(m.shape || [[0, 0]]).map(s => s[1]));
        const cell0 = board.children[m.r * SIZE + m.c];
        let origin = null;
        if (cell0 && wrap) {
          const cr = cell0.getBoundingClientRect();
          const wr = wrap.getBoundingClientRect();
          origin = {
            left: cr.left - wr.left + cr.width * (0.5 + maxCr0 / 2),
            top: cr.top - wr.top + cr.height * (0.5 + maxRr0 / 2)
          };
        }
        const skinForFx = m.skinId ||
          (m.side === 'opp' ? window.mpOppSkinId : (document.body.dataset.skinId || equippedSkinId)) ||
          'gold';
        spawnLegendSparks(wrap, 6 + (m.shape ? m.shape.length : 4), skinForFx, origin);
      }
    } catch (_) {}
    ghost.style.opacity = '0';
    setTimeout(() => {
      ghost.style.display = 'none';
      ghost.style.transform = 'translate(-50%,-50%) scale(1)';
    }, 150);

    markReplayPieceUsed(m.side, found.idx);
    // Show place points first, then full score after clear (mirrors live feel)
    try {
      const placePts = (typeof m.placePts === 'number')
        ? m.placePts
        : (Array.isArray(m.shape) ? m.shape.length * 10 : 0);
      const clearedN = m.cleared || 0;
      const bonusN = m.bonus || 0;
      if (m.side === 'me') {
        const beforeClear = (typeof m.myScore === 'number')
          ? Math.max(0, m.myScore - (clearedN > 0 ? bonusN : 0))
          : null;
        if (beforeClear != null) document.getElementById('myScore').textContent = beforeClear;
        else if (typeof m.myScore === 'number') document.getElementById('myScore').textContent = m.myScore;
        if (typeof m.oppScore === 'number') document.getElementById('oppScore').textContent = m.oppScore;
      } else {
        const beforeClear = (typeof m.oppScore === 'number')
          ? Math.max(0, m.oppScore - (clearedN > 0 ? bonusN : 0))
          : null;
        if (beforeClear != null) document.getElementById('oppScore').textContent = beforeClear;
        else if (typeof m.oppScore === 'number') document.getElementById('oppScore').textContent = m.oppScore;
        if (typeof m.myScore === 'number') document.getElementById('myScore').textContent = m.myScore;
      }
      // Brief +N float for place points
      if (placePts > 0 && settings.anim !== 'off' && !document.body.classList.contains('no-floats')) {
        const wrap = board.parentElement;
        if (wrap) {
          const maxRr = Math.max(...(m.shape || [[0, 0]]).map(s => s[0]));
          const maxCr = Math.max(...(m.shape || [[0, 0]]).map(s => s[1]));
          const cell0 = board.children[(m.r + Math.floor(maxRr / 2)) * SIZE + (m.c + Math.floor(maxCr / 2))]
            || board.children[m.r * SIZE + m.c];
          if (cell0) {
            const cr = cell0.getBoundingClientRect();
            const wr = wrap.getBoundingClientRect();
            const fl = document.createElement('div');
            fl.className = 'score-float';
            fl.textContent = '+' + placePts;
            fl.style.left = (cr.left - wr.left + cr.width / 2) + 'px';
            fl.style.top = (cr.top - wr.top) + 'px';
            wrap.appendChild(fl);
            setTimeout(() => { try { fl.remove(); } catch (_) {} }, Math.max(600, 1100 / s));
          }
        }
      }
    } catch (_) {
      try {
        document.getElementById('myScore').textContent = m.myScore;
        document.getElementById('oppScore').textContent = m.oppScore;
      } catch (_2) {}
    }

    setTimeout(() => {
      // Animated clear + same combo/float as live
      let cleared = m.cleared || 0;
      let bonus = m.bonus || 0;
      let rows = Array.isArray(m.rows) ? m.rows.slice() : [];
      let cols = Array.isArray(m.cols) ? m.cols.slice() : [];
      if (!cleared) {
        rows = []; cols = [];
        for (let r = 0; r < SIZE; r++) if (g[r].every(c => c !== null)) rows.push(r);
        for (let c = 0; c < SIZE; c++) if (g.every(row => row[c] !== null)) cols.push(c);
        cleared = rows.length + cols.length;
        if (cleared) bonus = bonusFor(cleared);
      }
      if (cleared > 0) {
        if (m.side === 'me') {
          BPState.repChainMe = (typeof m.chain === 'number' && m.chain > 0)
            ? m.chain
            : ((BPState.repChainMe || 0) + 1);
          BPState.repChainOpp = 0;
        } else {
          BPState.repChainOpp = (typeof m.chain === 'number' && m.chain > 0)
            ? m.chain
            : ((BPState.repChainOpp || 0) + 1);
          BPState.repChainMe = 0;
        }
        const chain = (typeof m.chain === 'number' && m.chain > 0)
          ? m.chain
          : (m.side === 'me' ? BPState.repChainMe : BPState.repChainOpp);
        const info = clearLinesOn(g, board);
        rows = info.rows.length ? info.rows : rows;
        cols = info.cols.length ? info.cols : cols;
        const banner = m.side === 'me'
          ? document.getElementById('comboBannerMe')
          : document.getElementById('comboBannerOpp');
        const maxRr = Math.max(...(m.shape || [[0,0]]).map(s => s[0]));
        const maxCr = Math.max(...(m.shape || [[0,0]]).map(s => s[1]));
        const placeAnchor = (typeof m.r === 'number') ? {
          baseR: m.r, baseC: m.c,
          centerR: m.r + maxRr / 2,
          centerC: m.c + maxCr / 2
        } : null;
        const positions = getClearFloatPositions(board, rows, cols, placeAnchor);
        const wrap = board.parentElement;
        const baseBonus = (typeof m.baseBonus === 'number') ? m.baseBonus : bonusFor(cleared);
        const chainExtra = (typeof m.chainExtra === 'number') ? m.chainExtra : (bonus - baseBonus);
        showCombo(
          banner || (wrap && wrap.querySelector('.combo-banner')),
          cleared,
          bonus || bonusFor(cleared),
          wrap,
          m.side === 'me' ? 'me' : 'opp',
          { chain, positions, placeAnchor, baseBonus, chainExtra }
        );
        // Final scores after clear bonus
        try {
          if (typeof m.myScore === 'number') document.getElementById('myScore').textContent = m.myScore;
          if (typeof m.oppScore === 'number') document.getElementById('oppScore').textContent = m.oppScore;
        } catch (_) {}
      } else {
        if (m.side === 'me') BPState.repChainMe = 0;
        else BPState.repChainOpp = 0;
        clearLinesSilent(g);
        renderGrid(g, board);
        try {
          if (typeof m.myScore === 'number') document.getElementById('myScore').textContent = m.myScore;
          if (typeof m.oppScore === 'number') document.getElementById('oppScore').textContent = m.oppScore;
        } catch (_) {}
      }

      replayIndex++;
      document.getElementById('reviewMeta').textContent =
        `Событие ${replayIndex} / ${replayData.moves.length} · ${m.side === 'me' ? 'Ты' : 'Соперник'} · ${m.myScore}:${m.oppScore}`;
      try { updateReplayProgressUI(); } catch (_) {}
      setTimeout(() => {
        replayBusy = false;
        if (onDone) onDone();
        // Manual step landed on last event → offer result after a beat
        if (!replayPlaying && replayData && replayIndex >= replayData.moves.length) {
          setTimeout(() => {
            if (replayMode && !replayPlaying && replayIndex >= replayData.moves.length) {
              try { showReplayResult(); } catch (_) {}
            }
          }, 420);
        }
      }, tClear);
    }, Math.max(60, 160 / s));
  }, tFly + Math.max(80, 160 / s));

  return true;
}

document.getElementById('cardClassic')?.addEventListener('click', () => startClassic(false));
document.getElementById('cardVersus')?.addEventListener('click', startVersusFlow);
['cardClassic', 'cardVersus'].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      el.click();
    }
  });
});
document.getElementById('btnBackFromComp')?.addEventListener('click', () => {
  navigateScreen('menu', () => { try { updateMenuStats(); } catch (_) {} });
});
document.getElementById('cardOnline')?.addEventListener('click', goDurationFromOnline);
document.getElementById('cardBots')?.addEventListener('click', goDifficulty);
['cardOnline', 'cardBots'].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      el.click();
    }
  });
});
document.getElementById('btnDiffNext')?.addEventListener('click', () => showScreen('duration'));
