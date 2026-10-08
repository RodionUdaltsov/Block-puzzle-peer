/**
 * Block Puzzle — js/08-gameplay/04-grid-and-pieces.js
 * Grid render, classic mode save/start, piece tray.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
function renderGrid(g, boardDOM) {
  for (let r=0;r<SIZE;r++) for (let c=0;c<SIZE;c++) {
    const cell = boardDOM.children[r*SIZE+c];
    if (!cell) continue;
    const val = g[r][c];
    if (val) {
      const prev = cell.style.getPropertyValue('--cell-base');
      // Keep in-flight placeSoft visible even if renderGrid runs mid-settle
      const already = cell.classList.contains('filled') && prev === val &&
        !cell.classList.contains('preview-ok') && !cell.classList.contains('preview-bad');
      if (already) {
        let clearing = false;
        for (let k=0;k<CLEARING_CLASSES.length;k++) {
          if (cell.classList.contains(CLEARING_CLASSES[k])) { clearing = true; break; }
        }
        // Skip thrash — preserves .placing animation
        if (!clearing) continue;
      }
      if (prev !== val) paintCellColor(cell, val);
      if (!cell.classList.contains('filled')) cell.classList.add('filled');
      CLEARING_CLASSES.forEach(cl => cell.classList.remove(cl));
      cell.classList.remove('preview-ok','preview-bad');
      // Only kill place anim when color/value actually changed
      if (prev !== val) {
        cell.classList.remove('placing');
        cell.style.removeProperty('animation');
        cell.style.removeProperty('transition');
        cell.style.removeProperty('transform');
        cell.style.removeProperty('opacity');
        cell.style.removeProperty('filter');
        cell.style.removeProperty('box-shadow');
        cell.style.removeProperty('clip-path');
      }
    } else {
      const wasClearing = CLEARING_CLASSES.some(cl => cell.classList.contains(cl));
      if (cell.classList.contains('filled') || cell.classList.contains('preview-ok') || cell.classList.contains('preview-bad') || wasClearing || cell.classList.contains('placing')) {
        // Kill any in-flight clear anim without a flash-back
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
        CLEARING_CLASSES.forEach(cl => cell.classList.remove(cl));
        cell.classList.remove('filled','preview-ok','preview-bad','placing');
        // Restore default transition on next frame
        requestAnimationFrame(() => {
          if (!cell.classList.contains('filled')) {
            cell.style.removeProperty('transition');
            cell.style.removeProperty('animation');
          }
        });
      }
    }
  }
}
function createBoardDOM(el) {
  el.innerHTML = '';
  for (let i=0;i<SIZE*SIZE;i++) {
    const cell = document.createElement('div');
    cell.className = 'cell'; cell.dataset.idx = i;
    el.appendChild(cell);
  }
  try {
    const wrap = el && el.closest && el.closest('.board-wrap');
    if (wrap && typeof getBoardById === 'function') {
      const isOpp = (el && el.id === 'boardOpp') || (wrap.closest && wrap.closest('.player-panel.opp'));
      const b = getBoardById(isOpp ? 'field_default' : equippedBoardId);
      applyBoardToWrap(wrap, b);
    }
  } catch (_) {}
}
function bonusFor(cleared) {
  if (_R) return _R.bonusFor(cleared);
  return [0,100,300,600,1000,1500,2200,3000,4000][cleared] || 4000;
}
/** Extra points for consecutive clears (chain): 2nd clear +50, 3rd +100, … */
function chainBonusFor(chain) {
  if (_R) return _R.chainBonusFor(chain);
  if (chain < 2) return 0;
  return Math.min(800, (chain - 1) * 50);
}

function classicSaveStorageKey() {
  try {
    if (typeof authToken !== 'undefined' && authToken && typeof authAccount !== 'undefined'
        && authAccount && authAccount.id) {
      return 'bp_classic_save_acc_' + String(authAccount.id);
    }
  } catch (_) {}
  try {
    if (typeof myFriendCode === 'string' && myFriendCode) {
      return 'bp_classic_save_fc_' + String(myFriendCode).toUpperCase();
    }
  } catch (_) {}
  return 'bp_classic_save_guest';
}

function saveClassicState() {
  if (mode !== 'classic') return;
  try {
    const payload = {
      grid,
      score,
      diamonds,
      pieces: (pieces || []).map(p => ({
        shape: p.shape.map(c => c.slice()),
        color: p.color,
        used: !!p.used
      }))
    };
    localStorage.setItem(classicSaveStorageKey(), JSON.stringify(payload));
    // Persist classic board + best to Postgres (guest device bind or registered account)
    try {
      if (typeof best === 'number' && typeof payload.score === 'number' && payload.score > best) {
        best = payload.score | 0;
        try { localStorage.setItem('bp_best', String(best)); } catch (_2) {}
      }
    } catch (_) {}
    try {
      if (typeof scheduleGuestProgressSync === 'function') scheduleGuestProgressSync();
    } catch (_) {}
    try {
      if (typeof syncProfileToServer === 'function') {
        syncProfileToServer({ best: (typeof best === 'number' ? best : undefined), classicSave: payload });
      }
    } catch (_) {}
  } catch (_) {}
}
function clearClassicSave() {
  try { localStorage.removeItem(classicSaveStorageKey()); } catch (_) {}
  // The finished / abandoned board must also disappear from the account on the server,
  // otherwise the next login (or another device) resurrects a game that is already over.
  try {
    if (typeof authToken !== 'undefined' && authToken && window._bpAccountLoaded
        && typeof syncProfileToServer === 'function') {
      syncProfileToServer({ classicSave: null });
    }
  } catch (_) {}
}
function loadClassicState() {
  try {
    const raw = localStorage.getItem(classicSaveStorageKey());
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.grid) || data.grid.length !== SIZE) return null;
    return data;
  } catch (_) {
    return null;
  }
}

function clearBoardScoreFX() {
  try {
    document.querySelectorAll('.score-float').forEach(el => el.remove());
    document.querySelectorAll('.combo-banner').forEach(b => {
      b.classList.remove('show');
      b.textContent = '';
      try {
        b.style.opacity = '';
        b.style.left = '';
        b.style.top = '';
      } catch (_) {}
    });
    window._lastPlaceAnchor = null;
  } catch (_) {}
}
function startClassic(forceNew) {
  const run = () => {
  // Hard-stop any leftover versus / AI clocks before classic board opens
  try {
    if (typeof vsTimerId !== 'undefined' && vsTimerId) { clearInterval(vsTimerId); vsTimerId = null; }
    if (typeof aiInterval !== 'undefined' && aiInterval) { clearInterval(aiInterval); aiInterval = null; }
    if (typeof replayTimer !== 'undefined' && replayTimer) { clearTimeout(replayTimer); replayTimer = null; }
    try { scrubTransientFx(); } catch (_) {}
    vsActive = false;
    replayMode = false;
    document.body.classList.remove('replay-ui');
    document.body.classList.remove('replay-playing');
  } catch (_) {}
  showScreen('classic');
  mode = 'classic';
  try { if (typeof startFxMaintenance === 'function') startFxMaintenance(); } catch (_) {}
  try { clearBoardScoreFX(); } catch (_) {}
  gameOverEl.classList.remove('visible');
  stuckOfferEl.classList.remove('visible');
  selectedIdx = -1; placingLock = false;

  const saved = (!forceNew) ? loadClassicState() : null;
  if (saved) {
    grid = saved.grid.map(row => row.map(c => c));
    score = typeof saved.score === 'number' ? saved.score : 0;
    if (typeof saved.diamonds === 'number') diamonds = saved.diamonds;
    if (diamonds < 0) diamonds = 0;
    pieces = Array.isArray(saved.pieces) && saved.pieces.length
      ? saved.pieces.map(p => ({
          shape: (p.shape || []).map(c => c.slice()),
          color: p.color || COLORS[0],
          used: !!p.used
        }))
      : [randomPiece(), randomPiece(), randomPiece()];
  } else {
    grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    score = 0;
    if (diamonds < 1) diamonds = 3;
    pieces = [randomPiece(), randomPiece(), randomPiece()];
  }
  clearChain = 0;

  updateClassicUI();
  createBoardDOM(boardEl);
  applyBoardScales();
  renderGrid(grid, boardEl);
  renderPieces(piecesArea);
  // If all pieces used, deal new set
  if (pieces.every(p => p.used)) generatePieces(piecesArea);
  updateBoardMetrics(boardEl);
  saveClassicState();
  };
  // Open board immediately — no waiting on intro
  run();
  // Optional brief flash (does not block input)
  try {
    showMatchIntro({
      label: 'Классика',
      title: 'Собери поле',
      sub: forceNew ? 'Новая партия' : 'Продолжение',
      goText: 'Играй!',
      ms: 520
    });
  } catch (_) {}
}
function updateClassicUI() {
  scoreEl.textContent = score; bestEl.textContent = best; diamondsEl.textContent = diamonds;
  localStorage.setItem('bp_diamonds', diamonds);
  document.getElementById('btnRelief').disabled = diamonds < 1 || !grid.some(row => row.some(x => x));
  if (score > best) {
    best = score;
    bestEl.textContent = best;
    localStorage.setItem('bp_best', best);
  }
  try {
    if (mode === 'classic' && score >= 50000 && !window._classicUsedRelief) {
      setAchStat('perfectClassic', 1);
    }
  } catch (_) {}
  saveClassicState();
}
function generatePieces(areaEl) {
  // Ranked room mode: server owns deal — never invent local hands, never wipe tray
  if (roomMatchMode || BPState.roomMatchMode) {
    try {
      // If we still have unused pieces, just re-render; do not request deal
      const hasLive = Array.isArray(pieces) && pieces.some(p => p && !p.used);
      if (hasLive) {
        if (areaEl) renderPieces(areaEl);
        return;
      }
      // Hand empty — ask server; keep showing empty until deal arrives (do not randomize)
      try { if (typeof roomSendDeal === 'function') roomSendDeal({}); } catch (_) {}
      if (areaEl) renderPieces(areaEl);
    } catch (_) {}
    return;
  }
  pieces = [randomPiece(), randomPiece(), randomPiece()];
  try { BPState.animateDealIn = true; BPState.quietPieceRender = false; } catch (_) {}
  renderPieces(areaEl);
  if (mode === 'versus' && vsActive) {
    logDeal('me', pieces);
    if (mpMode) {
      
    }
  }
  if (mode === 'classic') saveClassicState();
}
function getPieceCellPx(isVs) {
  // Prefer live board cell so tray pieces stay proportional after any scale
  try {
    const board = isVs ? document.getElementById('boardMe') : document.getElementById('board');
    if (board) {
      const w = board.getBoundingClientRect().width;
      if (w > 40) {
        const boardCell = w / SIZE;
        return Math.max(isVs ? 8 : 9, Math.min(isVs ? 16 : 22, Math.round(boardCell * 0.42)));
      }
    }
  } catch (_) {}
  const cs = getComputedStyle(document.documentElement);
  if (isVs) {
    const v = parseFloat(cs.getPropertyValue('--versus-piece'));
    return Number.isFinite(v) && v > 0 ? v : 12;
  }
  const v = parseFloat(cs.getPropertyValue('--classic-piece'));
  return Number.isFinite(v) && v > 0 ? v : 16;
}
function getPieceSlotPx(isVs) {
  const cell = getPieceCellPx(isVs);
  return Math.max(isVs ? 44 : 56, Math.min(isVs ? 78 : 110, cell * 5 + (isVs ? 8 : 12)));
}
function renderPieces(areaEl) {
  // Never rebuild tray while a piece is held — opp line-clears must not blink the ghost
  try {
    if ((typeof isDragging !== 'undefined' && isDragging)
        || (typeof activeDragSlot !== 'undefined' && activeDragSlot)
        || (document.body && document.body.classList.contains('is-dragging'))) {
      try { if (typeof ensureHeldPieceVisible === 'function') ensureHeldPieceVisible(); } catch (_) {}
      return;
    }
  } catch (_) {}

  // Never overwrite replay trays with live hand
  if (typeof replayMode !== 'undefined' && replayMode) return;
  // Critical: do not destroy hand DOM mid-drag (phones lose pointer capture → piece snaps back)
  try {
    if ((typeof isDragging !== 'undefined' && isDragging)
        || (typeof activeDragSlot !== 'undefined' && activeDragSlot)
        || (document.body && document.body.classList.contains('is-dragging'))) {
      try { if (typeof ensureHeldPieceVisible === 'function') ensureHeldPieceVisible(); } catch (_) {}
      return;
    }
  } catch (_) {}
  // Rejoin / desync safety: try restore own hand from match log if empty
  try {
    if ((!pieces || !pieces.length) && (vsModeType === 'online' || mpMode || mode === 'versus')) {
      recoverHandsFromMatchLog();
    }
  } catch (_) {}
  areaEl.innerHTML = '';
  const isVs = mode === 'versus' || (areaEl && areaEl.id === 'piecesAreaVs');
  const cellPx = getPieceCellPx(isVs);
  const slotPx = getPieceSlotPx(isVs);
  if (!pieces || !pieces.length) return;
  const quiet = !!(BPState.quietPieceRender);
  const animateIn = !quiet && !!(BPState.animateDealIn);
  pieces.forEach((p, idx) => {
    const slot = document.createElement('div');
    slot.className = 'piece-slot'; slot.dataset.idx = idx;
    // Store shape signature so softRender can detect rejoin desync
    try {
      const sh = (p.shape || []).map(c => Array.isArray(c) ? (c[0] + ':' + c[1]) : String(c)).join(';');
      slot.dataset.handSig = (p.used ? 'U' : 'A') + '|' + (p.color || '') + '|' + sh;
    } catch (_) {}
    if (p.used) { slot.classList.add('used'); areaEl.appendChild(slot); return; }
    slot.style.width = slotPx + 'px';
    slot.style.height = slotPx + 'px';
    slot.style.minWidth = slotPx + 'px';
    const maxR = Math.max(...p.shape.map(s=>s[0])), maxC = Math.max(...p.shape.map(s=>s[1]));
    const gridEl = document.createElement('div');
    gridEl.className = 'piece-grid';
    gridEl.style.gridTemplateColumns = `repeat(${maxC+1},${cellPx}px)`;
    gridEl.style.gridTemplateRows = `repeat(${maxR+1},${cellPx}px)`;
    gridEl.style.gap = isVs ? '1px' : '1.5px';
    const occ = new Set(p.shape.map(([r,c])=>r+','+c));
    for (let r=0;r<=maxR;r++) for (let c=0;c<=maxC;c++) {
      const cell = document.createElement('div');
      if (occ.has(r+','+c)) {
        cell.className='piece-cell';
        paintCellColor(cell, p.color);
        cell.style.width=cellPx+'px';
        cell.style.height=cellPx+'px';
      }
      gridEl.appendChild(cell);
    }
    slot.appendChild(gridEl); areaEl.appendChild(slot);
    if (animateIn) {
      // Smooth short pop-in for new deals (not for quiet network sync)
      slot.classList.add('deal-in');
      slot.style.opacity = '0';
      slot.style.transform = 'scale(0.72) translateY(10px)';
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
      }, 320 + delay);
    } else {
      // Quiet/sync path: no animation, stay interactive
      slot.classList.add('show');
      slot.style.opacity = '1';
      slot.style.transform = 'none';
      slot.style.transition = 'none';
      try { slot.style.animation = 'none'; } catch (_) {}
    }
    const startHandler = e => startDrag(e, idx, areaEl);
    slot.style.pointerEvents = 'auto';
    slot.style.touchAction = 'none';
    try {
      if (typeof _pieceHandSig === 'function') slot.dataset.handSig = _pieceHandSig(p);
    } catch (_) {}
    if (window.PointerEvent) {
      slot.addEventListener('pointerdown', startHandler, { passive: false });
    } else {
      slot.addEventListener('touchstart', startHandler, { passive: false });
      slot.addEventListener('mousedown', startHandler, { passive: false });
    }
  });
  try { BPState.animateDealIn = false; } catch (_) {}
}
function markPieceUsed(idx, areaEl) {
  // Never skip marking used — locks only block NEW input, not finishing a placed piece
  if (!pieces[idx]) return;
  pieces[idx].used = true;
  const slot = areaEl && areaEl.querySelector(`.piece-slot[data-idx="${idx}"]`);
  if (!slot) return;
  slot.classList.remove('lifting','show');
  slot.classList.add('used');
  try {
    slot.style.width = '0';
    slot.style.minWidth = '0';
    slot.style.opacity = '0';
    slot.innerHTML = '';
  } catch (_) {}
}
