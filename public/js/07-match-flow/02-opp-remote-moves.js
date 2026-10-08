/**
 * Block Puzzle — js/07-match-flow/02-opp-remote-moves.js
 * Applying opponent deals/placements from the server.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
// Opp place anim in flight — queue places + deals so every move is shown in order
let _oppPlaceAnimBusy = false;
let _pendingOppDeal = null;
let _pendingOppPlaces = [];
// Token + animation handle so a finished move can never hide / cancel the NEXT move's ghost
let _oppGhostTok = 0;
let _oppGhostAnim = null;

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
  // Fly duration shrinks when moves are queued behind this one, so a burst of fast
  // placements stays 1:1 with the opponent (no growing lag), yet every piece still
  // visibly travels from its tray slot to its cell.
  const _queued = _pendingOppPlaces ? _pendingOppPlaces.length : 0;
  const FLY_MS = _queued > 0 ? Math.max(170, 340 - 90 * _queued) : 360;
  const myGhostTok = ++_oppGhostTok;
  if (_oppGhostAnim) { try { _oppGhostAnim.cancel(); } catch (_) {} _oppGhostAnim = null; }
  ghost.style.transition = 'none'; // appear fully opaque instantly (no fade-in blink between back-to-back moves)
  ghost.style.left = targetX + 'px';
  ghost.style.top = targetY + 'px';
  ghost.style.display = 'block';
  ghost.style.opacity = '1';
  ghost.style.visibility = 'visible';
  ghost.style.zIndex = '50';
  ghost.style.willChange = 'transform';
  void ghost.offsetWidth;
  ghost.style.transition = 'opacity 0.15s ease';
  // GPU-composited transform flight (left/top transitions re-layout every frame and stutter)
  try {
    if (typeof ghost.animate === 'function') {
      _oppGhostAnim = ghost.animate([
        { transform: 'translate(calc(-50% + ' + (startX - targetX) + 'px), calc(-50% + ' + (startY - targetY) + 'px))' },
        { transform: 'translate(-50%, -50%)' }
      ], { duration: FLY_MS, easing: 'cubic-bezier(0.25, 0.1, 0.25, 1)', fill: 'both' });
    } else {
      ghost.style.transition = 'left ' + FLY_MS + 'ms cubic-bezier(0.25,0.1,0.25,1), top ' + FLY_MS + 'ms cubic-bezier(0.25,0.1,0.25,1), opacity 0.15s ease';
      ghost.style.left = startX + 'px';
      ghost.style.top = startY + 'px';
      void ghost.offsetWidth;
      ghost.style.left = targetX + 'px';
      ghost.style.top = targetY + 'px';
    }
  } catch (_) {}

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
    // Hide only if no newer move has taken over the shared ghost (the old unconditional
    // 160ms hide killed the next piece mid-flight → it "vanished" and snapped into place).
    if (_oppGhostTok === myGhostTok) {
      ghost.style.opacity = '0';
      setTimeout(() => {
        if (_oppGhostTok === myGhostTok) {
          ghost.style.display = 'none';
          if (_oppGhostAnim) { try { _oppGhostAnim.cancel(); } catch (_) {} _oppGhostAnim = null; }
        }
      }, 160);
    }

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
  }, FLY_MS + 30);
}
