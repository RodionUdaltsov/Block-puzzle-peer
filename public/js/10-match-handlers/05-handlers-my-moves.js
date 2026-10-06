/**
 * Block Puzzle — js/10-match-handlers/05-handlers-my-moves.js
 * MatchClient events: my place_ok / place_reject / deal.
 * Called from bindMatchClientHandlers() (01-bind-match-client.js).
 */
function bindMyMoveHandlers() {
  MatchClient.on('place_ok', (data) => {
    try {
      // Only clear MY AFK / need-move UI — do not hide opponent AFK banner
      try { hideBoardDisconnectOverlay('me'); } catch (_) {}
      try {
        if (typeof afkBannerKind !== 'undefined' && afkBannerKind === 'me') {
          afkBannerKind = null;
        }
        if (typeof dismissStatusToast === 'function') {
          dismissStatusToast('afk-me');
          dismissStatusToast('need-move');
        }
      } catch (_) {}
      if (!roomMatchMode && !BPState.roomMatchMode) return;
      try { noteMyAction && noteMyAction(); } catch (_) {}
      // Snapshot pending place for clear animation (before clearing flag)
      try {
        if (BPState.pendingServerPlace) {
          window._lastPendingPlaceSnap = {
            r: BPState.pendingServerPlace.r,
            c: BPState.pendingServerPlace.c,
            shape: (BPState.pendingServerPlace.shape || []).map(s => s.slice()),
            color: BPState.pendingServerPlace.color,
            pieceIdx: BPState.pendingServerPlace.pieceIdx,
            legendFx: !!BPState.pendingServerPlace.legendFx,
            skinId: BPState.pendingServerPlace.skinId || null,
            gridBefore: BPState.pendingServerPlace.gridBefore
              ? BPState.pendingServerPlace.gridBefore.map(row => row.slice())
              : null
          };
        }
      } catch (_) {}
      // Authoritative apply — server owns score, grid, hand
      BPState.pendingServerPlace = null;
      try { if (BPState.pendingPlaceTimer) { clearTimeout(BPState.pendingPlaceTimer); BPState.pendingPlaceTimer = null; } } catch (_) {}
      const willAnimClear = ((typeof data.cleared === 'number') ? (data.cleared | 0) : 0) > 0
        && window._lastPendingPlaceSnap && window._lastPendingPlaceSnap.gridBefore;
      // CRITICAL: never apply oppGrid from place_ok — concurrent places make it stale
      // (server snapshot of opp was taken before their simultaneous place was processed).
      // Opponent board/hand must only update via opp_place / opp_deal / periodic state.
      const statePayload = {
        score: data.score,
        // Skip grid when we animate clear — paint path below owns the board
        grid: willAnimClear ? undefined : data.grid,
        pieces: data.pieces,
        deal: data.deal,
        oppScore: data.oppScore,
        vsTimeLeft: data.vsTimeLeft,
        clockEndTs: data.clockEndTs,
        _forceHand: true,
        _fromPlaceOk: true
      };
      applyRoomState(statePayload);
      try {
        placingLock = false;
        BPState.rejoinLoading = false;
        BPState.rejoinInputLock = false;
        document.body.classList.remove('rejoin-loading');
      } catch (_) {}
      // History replay log (online) — offline path already logs in tryPlace
      try {
        if (typeof matchLog !== 'undefined' && Array.isArray(matchLog)) {
          const pending = window._lastPendingPlaceSnap || {};
          const sh = (Array.isArray(data.shape) && data.shape.length) ? data.shape
            : (pending.shape || []);
          matchLog.push({
            type: 'place',
            side: 'me',
            t: Date.now() - (matchStartTs || Date.now()),
            shape: (sh || []).map(c => Array.isArray(c) ? c.slice() : c),
            color: data.color || pending.color,
            r: (data.r != null ? data.r : pending.r) | 0,
            c: (data.c != null ? data.c : pending.c) | 0,
            myScore: (typeof data.score === 'number' ? data.score : score) | 0,
            oppScore: (typeof data.oppScore === 'number' ? data.oppScore : oppScore) | 0,
            pieceIdx: pending.pieceIdx != null ? pending.pieceIdx : -1,
            placePts: (typeof data.placePts === 'number') ? data.placePts : 0,
            legendFx: !!pending.legendFx,
            skinId: pending.skinId || null
          });
        }
        if (data.deal && typeof logDeal === 'function') logDeal('me', data.deal);
        else if (data.pieces && data.deal === true && typeof logDeal === 'function') logDeal('me', data.pieces);
      } catch (_) {}
      // Local clear + combo FX (online): place_ok carries cleared board — animate first
      try {
        const pending = window._lastPendingPlaceSnap || null;
        const clearedN = (typeof data.cleared === 'number') ? (data.cleared | 0) : 0;
        const bonusN = (typeof data.bonus === 'number') ? (data.bonus | 0) : 0;
        const chainN = (typeof data.chain === 'number') ? (data.chain | 0) : 0;
        const b = (typeof boardMe !== 'undefined' && boardMe) ? boardMe : document.getElementById('boardMe');

        if (clearedN > 0 && pending && b && typeof clearLinesOn === 'function') {
          // Rebuild board with piece placed (pre-clear) so clearLinesOn can animate
          let g = pending.gridBefore.map(row => (row || []).slice());
          const sh = pending.shape || [];
          const pr = pending.r | 0, pc = pending.c | 0;
          const col = pending.color;
          for (let i = 0; i < sh.length; i++) {
            const dr = sh[i][0] | 0, dc = sh[i][1] | 0;
            if (g[pr + dr]) g[pr + dr][pc + dc] = col;
            const cell = b.children[(pr + dr) * SIZE + (pc + dc)];
            if (cell) {
              try { paintCellColor(cell, col); } catch (_) {}
              cell.classList.add('filled', 'placing');
            }
          }
          grid = g;
          clearChain = chainN || (clearChain || 0);
          const clearInfo = clearLinesOn(grid, b);
          try {
            const wrap = b.parentElement;
            const banner = document.getElementById('comboBannerMe') || document.getElementById('comboBanner');
            const placeAnchor = {
              baseR: pr, baseC: pc,
              centerR: pr + (Math.max(...sh.map(s => s[0])) / 2),
              centerC: pc + (Math.max(...sh.map(s => s[1])) / 2)
            };
            const positions = (typeof getClearFloatPositions === 'function')
              ? getClearFloatPositions(b, clearInfo.rows || [], clearInfo.cols || [], placeAnchor)
              : null;
            if (typeof showCombo === 'function') {
              showCombo(banner, clearedN || clearInfo.count || 0, bonusN, wrap, 'me', {
                chain: chainN,
                positions,
                placeAnchor,
                baseBonus: bonusN,
                chainExtra: 0
              });
            }
            try { if (clearedN >= 2 || chainN >= 2) SFX.combo(); else if (clearedN > 0) SFX.clear && SFX.clear(); } catch (_) {}
          } catch (_) {}
          const delay = (typeof getClearAnimMs === 'function')
            ? (getClearAnimMs() + 40)
            : ((typeof CLEAR_ANIM_MS === 'number') ? CLEAR_ANIM_MS + 40 : 150);
          setTimeout(() => {
            try {
              if (Array.isArray(data.grid)) {
                grid = data.grid.map(row => (row || []).slice());
                if (b) {
                  if (typeof softRenderGrid === 'function') softRenderGrid(grid, b);
                  else if (typeof renderGrid === 'function') renderGrid(grid, b);
                }
              }
            } catch (_) {}
          }, delay);
        } else if (Array.isArray(data.grid)) {
          grid = data.grid.map(row => (row || []).slice());
          if (b) {
            if (typeof softRenderGrid === 'function') softRenderGrid(grid, b);
            else if (typeof renderGrid === 'function') renderGrid(grid, b);
          }
        }

        // Do NOT apply data.oppGrid here — concurrent place races make place_ok's
        // opp snapshot stale and wipe the opponent's just-placed pieces.
        // opp_place / state sync own the opponent board.
        if (Array.isArray(data.pieces)) {
          pieces = data.pieces.map(p => ({
            shape: (p.shape || []).map(c => Array.isArray(c) ? c.slice() : c),
            color: p.color,
            used: !!p.used
          }));
          const area = document.getElementById('piecesAreaVs');
          if (area) {
            if (data.deal) {
              BPState.animateDealIn = true;
              BPState.quietPieceRender = false;
              if (typeof renderPieces === 'function') renderPieces(area);
              BPState.animateDealIn = false;
            } else if (typeof softRenderPieces === 'function') {
              softRenderPieces(area);
            } else if (typeof renderPieces === 'function') {
              BPState.quietPieceRender = true;
              renderPieces(area);
              BPState.quietPieceRender = false;
            }
          }
        }
        if (typeof data.score === 'number') {
          score = data.score | 0;
          try { document.getElementById('myScore').textContent = String(score); } catch (_) {}
        }
        if (typeof data.oppScore === 'number') {
          oppScore = data.oppScore | 0;
          try { document.getElementById('oppScore').textContent = String(oppScore); } catch (_) {}
        }
      } catch (_) {}
      try { window._lastPendingPlaceSnap = null; } catch (_) {}
      try { window._lastRoomApplyAt = Date.now(); } catch (_) {}
    } catch (e) { console.warn('place_ok', e); }
  });
  MatchClient.on('place_reject', (data) => {
    try {
      console.warn('place_reject', data && data.reason);
      try { rollbackPendingServerPlace(); } catch (_) {}
      // Authoritative restore from server
      applyRoomState({
        score: data.score,
        grid: data.grid,
        pieces: data.pieces,
        _forceHand: true,
        vsTimeLeft: data.vsTimeLeft,
        clockEndTs: data.clockEndTs
      });
      try {
        if (Array.isArray(data.grid)) {
          grid = data.grid.map(row => (row || []).slice());
          const b = document.getElementById('boardMe');
          if (b && typeof renderGrid === 'function') renderGrid(grid, b);
        }
        if (Array.isArray(data.pieces)) {
          pieces = data.pieces.map(p => ({
            shape: (p.shape || []).map(c => Array.isArray(c) ? c.slice() : c),
            color: p.color,
            used: !!p.used
          }));
          const area = document.getElementById('piecesAreaVs');
          if (area && typeof renderPieces === 'function') {
            BPState.quietPieceRender = true;
            renderPieces(area);
            BPState.quietPieceRender = false;
          }
        }
        if (typeof data.score === 'number') {
          score = data.score | 0;
          try { document.getElementById('myScore').textContent = String(score); } catch (_) {}
        }
      } catch (_) {}
      placingLock = false;
      BPState.pendingServerPlace = null;
      try {
        BPState.rejoinLoading = false;
        BPState.rejoinInputLock = false;
        document.body.classList.remove('rejoin-loading');
      } catch (_) {}
    } catch (e) { console.warn('place_reject', e); }
  });
  MatchClient.on('deal', (data) => {
    try {
      if (!roomMatchMode && !BPState.roomMatchMode) return;
      if (!Array.isArray(data.pieces)) return;
      try { unlockRoomPlay(); } catch (_) {}
      pieces = data.pieces.map(p => ({
        shape: (p.shape || []).map(c => Array.isArray(c) ? c.slice() : c),
        color: p.color,
        used: !!p.used
      }));
      try {
        const area = document.getElementById('piecesAreaVs');
        // Fresh deal → animate appearance (not quiet)
        BPState.quietPieceRender = false;
        BPState.animateDealIn = true;
        if (area && typeof renderPieces === 'function') renderPieces(area);
        BPState.animateDealIn = false;
        if (typeof logDeal === 'function') logDeal('me', pieces);
      } catch (_) {}
      placingLock = false;
    } catch (e) { console.warn('deal', e); }
  });
}
