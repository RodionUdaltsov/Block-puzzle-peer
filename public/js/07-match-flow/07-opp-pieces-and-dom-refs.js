/**
 * Block Puzzle — js/07-match-flow/07-opp-pieces-and-dom-refs.js
 * Opponent tray rendering and shared DOM element refs.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
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

