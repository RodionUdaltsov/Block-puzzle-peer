/**
 * Block Puzzle — js/08-gameplay/06-drag-input.js
 * Pointer drag of pieces.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
function startDrag(e, idx, areaEl) {
  try {
    const sh = pieces && pieces[idx] && pieces[idx].shape;
    _dragShapeMaxR = sh && sh.length ? Math.max(...sh.map(s => s[0])) : 0;
    _dragShapeMaxC = sh && sh.length ? Math.max(...sh.map(s => s[1])) : 0;
  } catch (_) { _dragShapeMaxR = 0; _dragShapeMaxC = 0; }
  // Always clear sticky locks unless rejoin overlay is actually visible
  try {
    const ov = document.getElementById('rejoinLoading');
    const ovOn = ov && (ov.classList.contains('show') || ov.classList.contains('visible'));
    if (!ovOn) {
      BPState.rejoinLoading = false;
      BPState.rejoinInputLock = false;
      try { document.body.classList.remove('rejoin-loading'); } catch (_) {}
      if (ov) {
        try { ov.classList.remove('show', 'visible'); ov.style.display = 'none'; } catch (_) {}
      }
    }
    if (placingLock && !isDragging) placingLock = false;
    try {
      if (!document.getElementById('matchEndFreeze')?.classList.contains('visible')) {
        document.body.classList.remove('match-ending');
      }
    } catch (_) {}
    // Live online match must be interactive
    if (mode === 'versus' && (mpMode || roomMatchMode || BPState.roomMatchMode)) {
      if (!vsActive && !BPState.matchEnded) vsActive = true;
      try { vsIntroLock = false; mpMatchStarting = false; mpLoading = false; } catch (_) {}
    }
  } catch (_) {}
  if (BPState.rejoinLoading || BPState.rejoinInputLock || placingLock) return;
  if (!pieces[idx] || pieces[idx].used) return;
  if (mode==='versus' && !vsActive) return;
  // One piece at a time — ignore second finger / multi-touch
  if (isDragging) return;
  if (e && e.pointerId != null && activeDragPointerId != null && e.pointerId !== activeDragPointerId) return;
  // Never hard-lock on playerStuck: if this piece fits, unstick and allow
  if (mode === 'versus' && playerStuck) {
    if (pieceIsPlayable(grid, pieces[idx])) {
      playerStuck = false;
      const w = document.getElementById('stuckWait');
      if (w) w.style.display = 'none';
      } else {
      return; // this specific piece can't place
    }
  }
  e.preventDefault(); e.stopPropagation();
  selectedIdx = idx; dragPiece = pieces[idx]; isDragging = true;
  // Freeze shape for this gesture (never share refs with SHAPES / hand array)
  try {
    if (dragPiece && Array.isArray(dragPiece.shape)) {
      const frozen = dragPiece.shape.map(c => Array.isArray(c) ? [c[0]|0, c[1]|0] : c);
      // Also re-clone into hand so softRender cannot shrink the live piece mid-drag
      if (pieces && pieces[idx] && Array.isArray(pieces[idx].shape)) {
        pieces[idx] = {
          shape: frozen.map(c => Array.isArray(c) ? c.slice() : c),
          color: dragPiece.color,
          used: !!pieces[idx].used
        };
      }
      dragPiece = {
        shape: frozen.map(c => Array.isArray(c) ? c.slice() : c),
        color: dragPiece.color,
        used: !!dragPiece.used,
        _shapeLen: frozen.length
      };
    }
  } catch (_) {}
  activeDragPointerId = (e && e.pointerId != null) ? e.pointerId : 'mouse';
  _ghostLerpInit = false;
  _ghostCellKey = '';
  _dragLastTs = 0;
  _ghostNoGlideOn = false;
  // Clear previous place/preview residue so the NEW piece shape never flashes
  // over the last placement cells on the board.
  try { clearPreview(); } catch (_) {}
  lastPreview = null;
  try {
    // Force-clear ghost (hideGhost is a no-op while isDragging is already true)
    if (ghost) {
      ghost.innerHTML = '';
      try { delete ghost.dataset.holdSig; } catch (_) {}
      ghost.style.left = '0';
      ghost.style.top = '0';
      ghost.style.right = '';
      ghost.style.bottom = '';
      ghost.style.transform = 'translate3d(-9999px,-9999px,0)';
      ghost.classList.remove('visible', 'cell-glide', 'no-glide');
      ghost.style.display = 'none';
      ghost.style.opacity = '0';
      ghost.style.visibility = 'hidden';
    }
  } catch (_) {}
  SFX.pick();
  const xy0 = eventClientXY(e);
  pointerX = xy0.x; pointerY = xy0.y;
  updateBoardMetrics();
  const slot = e.currentTarget;
  activeDragSlot = slot;
  // Ensure no other slot is stuck in lifting from a previous multi-touch
  clearAllLifting(areaEl);
  slot.classList.add('lifting');
  // Ghost is position:fixed + transform only (left/top must stay 0).
  // Tray slot is hidden via .lifting — ghost is the only visible piece.
  showGhost(dragPiece);
  try { startHoldVisibilityPin(); } catch (_) {}
  const slotRect = slot.getBoundingClientRect();
  try {
    ghost.style.left = '0';
    ghost.style.top = '0';
    ghost.style.display = 'block';
    ghost.style.visibility = 'visible';
    ghost.style.opacity = '1';
    ghost.style.pointerEvents = 'none';
    ghost.classList.add('visible', 'no-glide');
    ghost.classList.remove('cell-glide');
  } catch (_) {}
  invalidateBoardMetrics();
  updateBoardMetrics();
  const startX = (typeof pointerX === 'number' && pointerX > 0)
    ? pointerX
    : (slotRect.left + slotRect.width / 2);
  const startY = (typeof pointerY === 'number' && pointerY > 0)
    ? pointerY
    : (slotRect.top + slotRect.height / 2);
  moveGhost(startX, startY);
  // Delay board cell-snap slightly so the NEW shape does not flash on last place cells
  try {
    window._dragStartX = startX;
    window._dragStartY = startY;
    window._dragBoardSnapReady = false;
  } catch (_) {}
  requestAnimationFrame(() => {
    if (!isDragging) return;
    try {
      ghost.style.left = '0';
      ghost.style.top = '0';
      ghost.style.display = 'block';
      ghost.style.visibility = 'visible';
      ghost.style.opacity = '1';
      ghost.classList.add('visible');
    } catch (_) {}
    moveGhost(pointerX || startX, pointerY || startY);
    requestAnimationFrame(() => {
      _ghostCellKey = '';
      // Allow cell snap after first frame if pointer already moved
      try {
        const dx = (pointerX || 0) - (window._dragStartX || 0);
        const dy = (pointerY || 0) - (window._dragStartY || 0);
        if (dx * dx + dy * dy >= 36) window._dragBoardSnapReady = true;
      } catch (_) {}
      if (isDragging) dragFrame();
    });
  });
  // Capture on document/body instead of the slot: opp_place / softRender
  // mutate tray DOM on phones and slot-level capture fires pointercancel → snap back.
  try {
    if (e.pointerId != null) {
      const capTarget = document.body || document.documentElement;
      if (capTarget && capTarget.setPointerCapture) {
        capTarget.setPointerCapture(e.pointerId);
      } else if (slot.setPointerCapture) {
        slot.setPointerCapture(e.pointerId);
      }
    }
  } catch(_){}
  const onMove = ev => {
    if (!isDragging) return;
    // High-refresh: use last coalesced sample (smoother on 120/144Hz + precision trackpads)
    try {
      if (ev.getCoalescedEvents) {
        const coalesced = ev.getCoalescedEvents();
        if (coalesced && coalesced.length) {
          const last = coalesced[coalesced.length - 1];
          const xyC = eventClientXY(last);
          pointerX = xyC.x; pointerY = xyC.y;
        } else {
          const xy = eventClientXY(ev);
          pointerX = xy.x; pointerY = xy.y;
        }
      } else {
        const xy = eventClientXY(ev);
        pointerX = xy.x; pointerY = xy.y;
      }
    } catch (_) {
      const xy = eventClientXY(ev);
      pointerX = xy.x; pointerY = xy.y;
    }
    if (ev.cancelable) {
      const typ = ev.type || '';
      if (typ.indexOf('touch') === 0 || typ === 'pointermove') {
        try { ev.preventDefault(); } catch (_) {}
      }
    }
    if (!rafId) rafId = requestAnimationFrame(dragFrame);
  };
  const unbind = () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onCancel);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onUp);
    document.removeEventListener('touchcancel', onCancel);
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    try { document.body.classList.remove('is-dragging'); } catch (_) {}
    activeDragSlot = null;
  };
  // Remote DOM updates (opp_place tray/board) often fire pointercancel on phones.
  // Do NOT end the drag — keep holding until real pointerup / touchend.
  const onCancel = ev => {
    if (!isDragging) return;
    if (ev && ev.pointerId != null && activeDragPointerId != null &&
        activeDragPointerId !== 'mouse' && ev.pointerId !== activeDragPointerId) {
      return;
    }
    try {
      if (ev && ev.pointerId != null) {
        const capTarget = document.body || document.documentElement;
        if (capTarget && capTarget.releasePointerCapture) {
          try { capTarget.releasePointerCapture(ev.pointerId); } catch (_) {}
        }
        if (slot && slot.releasePointerCapture) {
          try { slot.releasePointerCapture(ev.pointerId); } catch (_) {}
        }
      }
    } catch (_) {}
    // Keep isDragging / ghost / lifting — listeners stay; next move/up continues
  };
  const onUp = ev => {
    if (!isDragging) return;
    // Ignore pointerup from a different finger
    if (ev && ev.pointerId != null && activeDragPointerId != null &&
        activeDragPointerId !== 'mouse' && ev.pointerId !== activeDragPointerId) {
      return;
    }
    // Rejoin loading overlay only — solo wait / rejoin flag must still allow play
    if (BPState.rejoinLoading || BPState.rejoinInputLock || placingLock) {
      isDragging = false;
      activeDragPointerId = null;
      activeDragSlot = null;
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      try {
        if (e.pointerId != null) {
          const capTarget = document.body || document.documentElement;
          if (capTarget && capTarget.releasePointerCapture) {
            try { capTarget.releasePointerCapture(e.pointerId); } catch (_) {}
          }
          if (slot.releasePointerCapture) slot.releasePointerCapture(e.pointerId);
        }
      } catch (_) {}
      try { ghost.classList.remove('visible'); hideGhost(); } catch (_) {}
      try { slot.classList.remove('lifting'); slot.classList.add('show'); } catch (_) {}
      try { clearAllLifting(areaEl); } catch (_) {}
      try { clearPreview(); } catch (_) {}
      lastPreview = null;
      dragPiece = null;
      unbind();
      return;
    }
    isDragging = false;
    activeDragPointerId = null;
    activeDragSlot = null;
    if (rafId) { cancelAnimationFrame(rafId); rafId=0; }
    try {
      if (e.pointerId != null) {
        const capTarget = document.body || document.documentElement;
        if (capTarget && capTarget.releasePointerCapture) {
          try { capTarget.releasePointerCapture(e.pointerId); } catch (_) {}
        }
        if (slot.releasePointerCapture) slot.releasePointerCapture(e.pointerId);
      }
    } catch(_){}
    const xy = eventClientXY(ev);
    pointerX = xy.x; pointerY = xy.y;
    updateBoardMetrics();
    const aim = aimFromPointer(pointerX, pointerY);
    let placed = false;
    if (lastPreview && lastPreview.valid && dragPiece) {
      const pos = getGridPos(aim.x, aim.y);
      if (pos) {
        const maxR = Math.max(...dragPiece.shape.map(s => s[0]));
        const maxC = Math.max(...dragPiece.shape.map(s => s[1]));
        const expectR = pos.r - Math.floor(maxR / 2);
        const expectC = pos.c - Math.floor(maxC / 2);
        if (Math.abs(lastPreview.baseR - expectR) <= 1 && Math.abs(lastPreview.baseC - expectC) <= 1) {
          placed = tryPlaceAt(aim.x, aim.y, lastPreview);
        }
      }
    }
    if (!placed) placed = tryPlaceAt(aim.x, aim.y);
    // Soft lock: settle ghost onto board center before fade
    try {
      if (placed && lastPreview && lastPreview.valid && dragPiece) {
        const center = placementWorldCenter(lastPreview, dragPiece.shape);
        if (center) {
          if (_isTouchUi()) {
            ghost.classList.add('no-glide');
            ghost.classList.remove('cell-glide');
            const fromX = _ghostLerpInit ? _ghostLerpX : center.x;
            const fromY = _ghostLerpInit ? _ghostLerpY : center.y;
            let step = 0;
            const steps = 5; // ~70ms soft land — PC-snappy
            const settleStep = () => {
              step++;
              const u = step / steps;
              const e = 1 - Math.pow(1 - u, 2.4);
              moveGhost(fromX + (center.x - fromX) * e, fromY + (center.y - fromY) * e);
              if (step < steps) requestAnimationFrame(settleStep);
            };
            requestAnimationFrame(settleStep);
          } else {
            ghost.classList.remove('no-glide');
            ghost.classList.add('cell-glide');
            moveGhost(center.x, center.y);
          }
        }
      }
    } catch (_) {}
    // Fade ghost while cells play placeSoft — overlap avoids hard pop
    const hideMs = placed
      ? (_isTouchUi() ? 140 : 160)
      : (_isTouchUi() ? 90 : 100);
    // Always park ghost off-board as soon as place resolves so the NEXT piece
    // shape cannot appear over the cells we just filled.
    try {
      ghost.classList.remove('visible', 'cell-glide');
      ghost.style.opacity = '0';
      ghost.style.left = '-9999px';
      ghost.style.top = '-9999px';
      ghost.dataset.holdSig = '';
    } catch (_) {}
    if (_isTouchUi() && placed) {
      requestAnimationFrame(() => {
        try { hideGhost(); } catch (_) {}
      });
    } else {
      try { hideGhost(); } catch (_) {}
    }
    if (placed) markPieceUsed(idx, areaEl);
    else { SFX.bad(); slot.classList.remove('lifting'); slot.classList.add('show'); }
    // Always clear any stuck lifting slots (multi-touch recovery)
    clearAllLifting(areaEl);
    // clearPreview after place must not rewrite filled cells (see clearPreview guard)
    clearPreview(); lastPreview = null;
    dragPiece = null;
    _dragShapeMaxR = _dragShapeMaxC = 0;
    unbind();
  };
  // Touch needs non-passive move so preventDefault can stop scroll/bounce (PC keeps passive)
  try { document.body.classList.add('is-dragging'); } catch (_) {}
  const touchLike = !!(window.matchMedia && (
    window.matchMedia('(pointer: coarse)').matches
    || window.matchMedia('(hover: none)').matches
  )) || (('ontouchstart' in window) && (navigator.maxTouchPoints > 0));
  if (window.PointerEvent) {
    document.addEventListener('pointermove', onMove, { passive: !touchLike });
    document.addEventListener('pointerup', onUp);
    // pointercancel must NOT end the drag — concurrent opp_place DOM updates
    // fire cancel on phones and would snap the held piece back to the tray.
    document.addEventListener('pointercancel', onCancel);
  } else {
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
    document.addEventListener('touchcancel', onCancel);
    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseup', onUp);
  }
}
