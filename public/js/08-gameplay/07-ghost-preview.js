/**
 * Block Puzzle — js/08-gameplay/07-ghost-preview.js
 * Drag frame loop, ghost and placement preview.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
/** World center of a placement so the ghost sits flush on those cells */
/**
 * Ghost uses translate(-50%,-50%) on its bounding box.
 * Must target the AABB center of the placement cells — NOT the centroid
 * (L/T shapes have different centroid vs bbox → misalignment).
 * Scale-independent: reads live DOM cell rects.
 */
function placementWorldCenter(result, shape) {
  if (!result || !shape || !shape.length) return null;
  try {
    const board = (typeof getActiveBoard === 'function') ? getActiveBoard() : null;
    if (board && board.children && board.children.length >= SIZE * SIZE) {
      let minR = Infinity, minC = Infinity, maxR = -Infinity, maxC = -Infinity;
      for (let i = 0; i < shape.length; i++) {
        const cell = shape[i];
        if (!cell || cell.length < 2) continue;
        const r = (result.baseR | 0) + (cell[0] | 0);
        const c = (result.baseC | 0) + (cell[1] | 0);
        if (r < 0 || c < 0 || r >= SIZE || c >= SIZE) continue;
        if (r < minR) minR = r;
        if (c < minC) minC = c;
        if (r > maxR) maxR = r;
        if (c > maxC) maxC = c;
      }
      if (minR !== Infinity) {
        const tl = board.children[minR * SIZE + minC];
        const br = board.children[maxR * SIZE + maxC];
        if (tl && br) {
          const a = tl.getBoundingClientRect();
          const b = br.getBoundingClientRect();
          if (a.width > 2 && b.width > 2) {
            return { x: (a.left + b.right) * 0.5, y: (a.top + b.bottom) * 0.5 };
          }
        }
      }
    }
  } catch (_) {}
  if (!boardRect) return null;
  const step = boardRect.width / SIZE;
  let minR = Infinity, minC = Infinity, maxR = -Infinity, maxC = -Infinity;
  for (let i = 0; i < shape.length; i++) {
    const cell = shape[i];
    if (!cell || cell.length < 2) continue;
    const r = (result.baseR | 0) + (cell[0] | 0);
    const c = (result.baseC | 0) + (cell[1] | 0);
    if (r < minR) minR = r;
    if (c < minC) minC = c;
    if (r > maxR) maxR = r;
    if (c > maxC) maxC = c;
  }
  if (minR === Infinity) return null;
  const cx = boardRect.left + ((minC + maxC + 1) * 0.5) * step;
  const cy = boardRect.top + ((minR + maxR + 1) * 0.5) * step;
  return { x: cx, y: cy };
}
let _dragShapeMaxR = 0, _dragShapeMaxC = 0;
let _ghostCellKey = '';
let _ghostLerpX = 0, _ghostLerpY = 0, _ghostLerpInit = false;
let _ghostTargetX = 0, _ghostTargetY = 0;
function _isTouchUi() {
  try { return !!(document.body && document.body.classList.contains('touch-ui')); } catch (_) { return false; }
}
let _dragLastTs = 0;
let _ghostNoGlideOn = false;

/** Keep tray-slot hidden + floating ghost visible while the player holds a piece.
 *  Opp line-clears / softRender storms must not leave an invisible held piece. */

/** While holding, re-assert ghost visibility every animation frame (survives opp clear storms). */
function startHoldVisibilityPin() {
  try {
    if (window._holdVisPin) return;
    // Re-assert ghost visibility ~7x/s instead of every frame, and only write styles
    // that actually drifted — per-frame style writes on top of dragFrame() cost phones frames.
    const tick = function () {
      window._holdVisPinRaf = 0;
      try {
        const holding = (typeof isDragging !== 'undefined' && isDragging)
          || (typeof activeDragSlot !== 'undefined' && activeDragSlot)
          || (document.body && document.body.classList.contains('is-dragging'));
        if (!holding) { window._holdVisPin = 0; return; }
        const g = document.getElementById('ghost');
        if (g) {
          const st = g.style;
          if (st.display !== 'block') st.display = 'block';
          if (st.visibility !== 'visible') st.visibility = 'visible';
          if (st.opacity !== '1') st.opacity = '1';
          if (st.transition !== 'none') st.transition = 'none';
          if (!g.classList.contains('visible')) g.classList.add('visible');
        }
        // rAF ids and timer ids are separate namespaces — keep them in separate fields.
        window._holdVisPin = 1;
        window._holdVisPinT = setTimeout(function () {
          window._holdVisPinT = 0;
          window._holdVisPinRaf = requestAnimationFrame(tick);
        }, 140);
      } catch (_) {}
    };
    window._holdVisPin = 1;
    window._holdVisPinRaf = requestAnimationFrame(tick);
  } catch (_) {}
}
function stopHoldVisibilityPin() {
  try {
    if (window._holdVisPinRaf) { cancelAnimationFrame(window._holdVisPinRaf); window._holdVisPinRaf = 0; }
    if (window._holdVisPinT) { clearTimeout(window._holdVisPinT); window._holdVisPinT = 0; }
    window._holdVisPin = 0;
  } catch (_) {}
}

function ensureHeldPieceVisible() {
  try {
    const holding = (typeof isDragging !== 'undefined' && isDragging)
      || (typeof activeDragSlot !== 'undefined' && activeDragSlot)
      || (document.body && document.body.classList.contains('is-dragging'));
    if (!holding) return;
    try { document.body.classList.add('is-dragging'); } catch (_) {}
    const slot = (typeof activeDragSlot !== 'undefined') ? activeDragSlot : null;
    if (slot) {
      try {
        slot.classList.add('lifting');
        slot.classList.remove('show');
      } catch (_) {}
    }
    const g = (typeof ghost !== 'undefined' && ghost) ? ghost : document.getElementById('ghost');
    if (g) {
      try {
        const st = g.style;
        // Only write what drifted: this runs every drag frame.
        if (st.display !== 'block') st.display = 'block';
        if (st.visibility !== 'visible') st.visibility = 'visible';
        if (st.opacity !== '1') st.opacity = '1';
        if (st.pointerEvents !== 'none') st.pointerEvents = 'none';
        if (!g.classList.contains('visible')) g.classList.add('visible');
        // Rebuild only if DOM was wiped — never thrash an intact ghost (blink)
        if ((!g.firstChild || !g.querySelector('.piece-cell')) && typeof dragPiece !== 'undefined' && dragPiece
            && typeof showGhost === 'function') {
          showGhost(dragPiece);
          g.classList.add('visible');
          st.display = 'block';
        } else if (st.transition !== 'none') {
          st.transition = 'none';
        }
      } catch (_) {}
    }
  } catch (_) {}
}

function dragFrame(ts) {
  try { ensureHeldPieceVisible(); } catch (_) {}
  rafId = 0; if (!isDragging) return;
  // Metrics only when dirty — never getBoundingClientRect every frame (kills 120/144Hz)
  if (_metricsDirty) ensureBoardMetrics();
  // Do not board-snap until the pointer moved off the tray (~8px).
  // Prevents the next piece silhouette from flashing over the just-placed cells.
  try {
    if (!window._dragBoardSnapReady) {
      const dx = pointerX - (window._dragStartX || pointerX);
      const dy = pointerY - (window._dragStartY || pointerY);
      if (dx * dx + dy * dy >= 64) window._dragBoardSnapReady = true;
    }
  } catch (_) { window._dragBoardSnapReady = true; }
  const aim = aimFromPointer(pointerX, pointerY);
  if (window._dragBoardSnapReady) {
    updatePreview(aim.x, aim.y);
  } else {
    // Free-follow finger; no board cell highlight / cell-center snap
    try { clearPreview(); lastPreview = null; } catch (_) {}
    try {
      if (ghost) {
        ghost.style.display = 'block';
        ghost.style.visibility = 'visible';
        ghost.style.opacity = '1';
        ghost.classList.add('visible');
      }
    } catch (_) {}
  }
  const touchUi = _isTouchUi();

  // Frame-time for rate-independent lerp (60Hz and 144Hz feel the same)
  const now = (typeof ts === 'number' && ts > 0) ? ts : performance.now();
  let dt = _dragLastTs ? (now - _dragLastTs) / 1000 : 1 / 60;
  _dragLastTs = now;
  if (dt > 0.05) dt = 0.05; // clamp after tab-switch
  if (dt < 0.001) dt = 0.001;

  if (touchUi) {
    // PC-like response: 1:1 with finger off-cell; tiny smooth only when snapping cell→cell
    let targetX = aim.x, targetY = aim.y;
    let onCell = false;
    if (lastPreview && dragPiece && boardRect && boardRect.width > 8) {
      const center = placementWorldCenter(lastPreview, dragPiece.shape);
      if (center) {
        targetX = center.x;
        targetY = center.y;
        onCell = true;
        const key = lastPreview.baseR + ',' + lastPreview.baseC;
        if (key !== _ghostCellKey) {
          _ghostCellKey = key;
          // New cell: keep current lerp pos, chase new center quickly
        }
      } else {
        _ghostCellKey = '';
      }
    } else {
      _ghostCellKey = '';
    }
    if (!_ghostLerpInit) {
      _ghostLerpX = targetX;
      _ghostLerpY = targetY;
      _ghostLerpInit = true;
    }
    if (onCell) {
      // Cell snap: short ease (~35ms) — not instant, still tight to finger
      const k = 1 - Math.exp(-38 * dt);
      _ghostLerpX += (targetX - _ghostLerpX) * k;
      _ghostLerpY += (targetY - _ghostLerpY) * k;
    } else {
      // Free drag: true 1:1 with finger
      _ghostLerpX = targetX;
      _ghostLerpY = targetY;
    }
    if (!_ghostNoGlideOn) {
      ghost.classList.add('no-glide');
      ghost.classList.remove('cell-glide');
      _ghostNoGlideOn = true;
    }
    moveGhost(_ghostLerpX, _ghostLerpY);
    // Extra frames only while easing into a cell center
    if (isDragging && onCell) {
      const dx = targetX - _ghostLerpX, dy = targetY - _ghostLerpY;
      if (dx * dx + dy * dy > 0.15) {
        rafId = requestAnimationFrame(dragFrame);
      }
    }
    return;
  }

  // Desktop: 1:1 with mouse off-cell; short soft ease only when snapping cell→cell
  {
    let targetX = aim.x, targetY = aim.y;
    let onCell = false;
    if (lastPreview && dragPiece && boardRect && boardRect.width > 8) {
      const center = placementWorldCenter(lastPreview, dragPiece.shape);
      if (center) {
        targetX = center.x;
        targetY = center.y;
        onCell = true;
        const key = lastPreview.baseR + ',' + lastPreview.baseC + ',' + (lastPreview.valid ? 1 : 0);
        if (key !== _ghostCellKey) {
          _ghostCellKey = key;
          ghost.classList.remove('no-glide');
          ghost.classList.add('cell-glide');
          _ghostNoGlideOn = false;
        }
      } else {
        _ghostCellKey = '';
      }
    } else {
      _ghostCellKey = '';
    }
    if (!_ghostLerpInit) {
      _ghostLerpX = targetX;
      _ghostLerpY = targetY;
      _ghostLerpInit = true;
    }
    if (onCell) {
      // ~30–40ms cell ease — readable, not laggy
      const k = 1 - Math.exp(-40 * dt);
      _ghostLerpX += (targetX - _ghostLerpX) * k;
      _ghostLerpY += (targetY - _ghostLerpY) * k;
      ghost.classList.remove('no-glide');
      ghost.classList.add('cell-glide');
      _ghostNoGlideOn = false;
    } else {
      // True 1:1 mouse follow
      _ghostLerpX = targetX;
      _ghostLerpY = targetY;
      if (!_ghostNoGlideOn) {
        ghost.classList.add('no-glide');
        ghost.classList.remove('cell-glide');
        _ghostNoGlideOn = true;
      }
    }
    moveGhost(_ghostLerpX, _ghostLerpY);
    if (isDragging && onCell) {
      const dx = targetX - _ghostLerpX, dy = targetY - _ghostLerpY;
      if (dx * dx + dy * dy > 0.15) {
        rafId = requestAnimationFrame(dragFrame);
      }
    }
  }
}
function showGhost(piece) {
  // Avoid full rebuild while already showing the same held piece (opp clears would blink)
  try {
    if (piece && ghost && ghost.querySelector('.piece-cell')
        && ghost.dataset && ghost.dataset.holdSig) {
      const sig = (piece.color || '') + '|' + (piece.shape || []).map(function (c) {
        return Array.isArray(c) ? (c[0] + ':' + c[1]) : String(c);
      }).join(';');
      if (ghost.dataset.holdSig === sig) {
        ghost.style.display = 'block';
        ghost.style.visibility = 'visible';
        ghost.style.opacity = '';
        ghost.classList.add('visible');
        return;
      }
    }
  } catch (_) {}
  // Keep .visible during rebuild so opacity transition never flashes to 0
  ghost.classList.remove('cell-glide');
  try {
    ghost.style.display = 'block';
    ghost.style.opacity = '1';
    ghost.style.visibility = 'visible';
    ghost.style.pointerEvents = 'none';
    ghost.classList.add('visible');
  } catch (_) {}
  ghost.innerHTML = '';
  invalidateBoardMetrics();
  updateBoardMetrics();
  let px = 24;
  let gapPx = 2;
  try {
    const board = (typeof getActiveBoard === 'function') ? getActiveBoard() : null;
    if (board && board.children && board.children.length >= 2) {
      const a = board.children[0].getBoundingClientRect();
      const b = board.children[1].getBoundingClientRect();
      if (a.width > 4) {
        px = a.width;
        // horizontal gap between cell 0 and cell 1
        const g = b.left - a.right;
        gapPx = (g > 0.5 && g < a.width) ? g : 0;
      }
    } else if (boardRect && boardRect.width > 40) {
      const step = boardRect.width / SIZE;
      px = (cellSize > 4 && cellSize <= step) ? cellSize : step * 0.92;
      gapPx = Math.max(0, step - px);
    }
  } catch (_) {
    if (boardRect && boardRect.width > 40) {
      const step = boardRect.width / SIZE;
      px = step * 0.92;
      gapPx = Math.max(0, step - px);
    }
  }
  const maxR = Math.max(...piece.shape.map(s => s[0]));
  const maxC = Math.max(...piece.shape.map(s => s[1]));
  const gridEl = document.createElement('div');
  gridEl.className = 'piece-grid';
  gridEl.style.gridTemplateColumns = `repeat(${maxC + 1}, ${px}px)`;
  gridEl.style.gridTemplateRows = `repeat(${maxR + 1}, ${px}px)`;
  gridEl.style.gap = gapPx + 'px';
  const occ = new Set(piece.shape.map(([r, c]) => r + ',' + c));
  for (let r = 0; r <= maxR; r++) for (let c = 0; c <= maxC; c++) {
    const cell = document.createElement('div');
    if (occ.has(r + ',' + c)) {
      cell.className = 'piece-cell';
      paintCellColor(cell, piece.color);
      cell.style.width = px + 'px';
      cell.style.height = px + 'px';
      cell.style.borderRadius = Math.max(3, Math.round(px * 0.18)) + 'px';
    }
    gridEl.appendChild(cell);
  }
  ghost.appendChild(gridEl);
  try {
    ghost.dataset.holdSig = (piece.color || '') + '|' + (piece.shape || []).map(function (c) {
      return Array.isArray(c) ? (c[0] + ':' + c[1]) : String(c);
    }).join(';');
  } catch (_) {}
  _ghostCellKey = '';
}
function moveGhost(x, y) {
  // Ghost uses position:fixed with left/top = 0; position is transform only.
  try {
    if (ghost.style.left !== '0px' && ghost.style.left !== '0') ghost.style.left = '0';
    if (ghost.style.top !== '0px' && ghost.style.top !== '0') ghost.style.top = '0';
  } catch (_) {}
  const scale = ghost.classList.contains('visible') ? 1 : 0.7;
  ghost.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) translate(-50%,-50%) scale(' + scale + ')';
}
function hideGhost() {
  // Never hide the drag ghost while a piece is still held
  try {
    if (typeof isDragging !== 'undefined' && isDragging) return;
    if (typeof activeDragSlot !== 'undefined' && activeDragSlot) return;
    if (document.body && document.body.classList.contains('is-dragging')) return;
  } catch (_) {}
  try { stopHoldVisibilityPin(); } catch (_) {}
  try { if (ghost && ghost.dataset) delete ghost.dataset.holdSig; } catch (_) {}
  ghost.style.display = 'none';
  ghost.classList.remove('visible', 'cell-glide', 'no-glide');
}

function getGridPos(clientX, clientY) {
  ensureBoardMetrics();
  const x = clientX - boardRect.left;
  const y = clientY - boardRect.top;
  const step = boardRect.width / SIZE;
  // Modest pad — stay on the board, less aggressive edge snap
  const pad = step * 0.45;
  if (x < -pad || y < -pad || x > boardRect.width + pad || y > boardRect.height + pad) return null;
  // Nearest cell by center — stable and predictable
  let c = Math.round((x - step / 2) / step);
  let r = Math.round((y - step / 2) / step);
  c = Math.max(0, Math.min(SIZE - 1, c));
  r = Math.max(0, Math.min(SIZE - 1, r));
  return { r, c };
}
function findBestPlacement(shape, hintR, hintC) {
  const maxR = Math.max(...shape.map(s => s[0]));
  const maxC = Math.max(...shape.map(s => s[1]));
  // Align piece bbox center under the aim cell (matches ghost -50%/-50%)
  const aimR = hintR - Math.floor(maxR / 2);
  const aimC = hintC - Math.floor(maxC / 2);
  const g = getActiveGrid();

  // Soft assist: only nearest neighbour (radius 1) — less aggressive hop between slots
  const radius = 1;
  let best = null;
  let bestScore = Infinity;
  for (let or = -radius; or <= radius; or++) {
    for (let oc = -radius; oc <= radius; oc++) {
      const r = aimR + or;
      const c = aimC + oc;
      if (!canPlaceOn(g, shape, r, c)) continue;
      const manh = Math.abs(or) + Math.abs(oc);
      // Prefer exact aim strongly; diagonal slightly penalized
      const score = manh * 1.35 + (or !== 0 && oc !== 0 ? 0.35 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = { baseR: r, baseC: c, valid: true };
      }
    }
  }
  // Exact aim wins when valid
  if (canPlaceOn(g, shape, aimR, aimC)) {
    return { baseR: aimR, baseC: aimC, valid: true };
  }
  if (best) return best;

  return {
    baseR: Math.max(0, Math.min(SIZE - 1 - maxR, aimR)),
    baseC: Math.max(0, Math.min(SIZE - 1 - maxC, aimC)),
    valid: false
  };
}

// Track only cells currently in preview — avoid scanning the whole board each move
let _previewCells = [];
let _lastPreviewAimX = -1, _lastPreviewAimY = -1;
function updatePreview(x,y) {
  const pos = getGridPos(x,y);
  if (!pos || !dragPiece) { clearPreview(); lastPreview = null; _lastPreviewAimX = -1; _lastPreviewAimY = -1; return; }
  if (pos.r === _lastPreviewAimY && pos.c === _lastPreviewAimX && lastPreview) return;
  _lastPreviewAimY = pos.r;
  _lastPreviewAimX = pos.c;
  const result = findBestPlacement(dragPiece.shape, pos.r, pos.c);
  // Aim only — visual ghost shows the piece; no board highlight (preview removed)
  if (lastPreview && lastPreview.baseR === result.baseR && lastPreview.baseC === result.baseC
      && lastPreview.valid === result.valid) {
    return;
  }
  clearPreview();
  lastPreview = result;
  // Preview painting permanently disabled
}
function clearPreview() {
  const g = getActiveGrid();
  const scrub = (cell, r, col) => {
    if (!cell) return;
    cell.classList.remove('preview-ok', 'preview-bad');
    // CRITICAL: if this cell is now a real filled piece (or mid place anim),
    // do NOT rewrite background/styles — that cancels placeSoft/legendPlace on mobile
    if (cell.classList.contains('filled') || cell.classList.contains('placing')) return;
    if (r >= 0 && g[r] && g[r][col]) {
      cell.style.background = g[r][col];
    } else {
      cell.style.removeProperty('background');
      cell.style.removeProperty('background-color');
      cell.style.removeProperty('background-image');
    }
  };
  if (!_previewCells.length) {
    const board = getActiveBoard();
    if (!board) return;
    for (let i = 0; i < board.children.length; i++) {
      const cell = board.children[i];
      if (!cell.classList.contains('preview-ok') && !cell.classList.contains('preview-bad')) continue;
      scrub(cell, Math.floor(i / SIZE), i % SIZE);
    }
    return;
  }
  for (let i = 0; i < _previewCells.length; i++) {
    const cell = _previewCells[i];
    if (!cell) continue;
    const idx = cell.dataset.idx != null ? parseInt(cell.dataset.idx, 10) : -1;
    const r = idx >= 0 ? Math.floor(idx / SIZE) : -1;
    const col = idx >= 0 ? idx % SIZE : -1;
    scrub(cell, r, col);
  }
  _previewCells = [];
  _lastPreviewAimX = -1;
  _lastPreviewAimY = -1;
}

