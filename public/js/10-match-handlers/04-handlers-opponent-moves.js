/**
 * Block Puzzle — js/10-match-handlers/04-handlers-opponent-moves.js
 * MatchClient events: opponent placements and deals.
 * Called from bindMatchClientHandlers() (01-bind-match-client.js).
 */
function bindOpponentMoveHandlers() {
  MatchClient.on('opp_place', (data) => {
    try {
      roomMatchMode = true;
      BPState.roomMatchMode = true;
      vsActive = true;
      // Keep opp cosmetics in sync from place packets
      try {
        if (data.skinId && data.skinId !== window.mpOppSkinId && typeof applyOppSkin === 'function') {
          window.mpOppSkinId = data.skinId;
          applyOppSkin(data.skinId);
        }
        if (data.boardId && data.boardId !== window.mpOppBoardId && typeof applyOppBoard === 'function') {
          window.mpOppBoardId = data.boardId;
          applyOppBoard(data.boardId);
        }
      } catch (_) {}
      // Moves prove opponent is online — kill DC overlay
      try {
        oppDisconnected = false;
        clearDisconnectTimer();
        hideBoardDisconnectOverlay();
      } catch (_) {}
      try { noteOppAction && noteOppAction(); } catch (_) {}
      // Scores / clock only for OUR side when we have an optimistic place in flight.
      // Applying meGrid/mePieces from opp_place while pendingServerPlace is set
      // rolls back our local preview (piece jumps back to hand) because the server
      // snapshot was taken before our concurrent place was processed.
      // Never pre-load oppGrid here — applyOppRemotePlace paints then clears.
      // Deals arrive via opp_deal.
      // Also skip while local player is holding a piece — concurrent tray/board
      // writes on phones fire pointercancel and snap the held piece back.
      const myPlacePending = !!BPState.pendingServerPlace;
      const localHolding = !!(typeof isDragging !== 'undefined' && isDragging)
        || !!(typeof activeDragSlot !== 'undefined' && activeDragSlot);
      // Boards are independent: opponent place must NEVER touch our hand/board/drag.
      // Only update opp score + clock here; paint opp board via applyOppRemotePlace.
      if (typeof data.score === 'number') {
        oppScore = data.score | 0;
        try {
          const oppEl = document.getElementById('oppScore');
          if (oppEl) oppEl.textContent = String(oppScore);
        } catch (_) {}
      }
      if (typeof data.clockEndTs === 'number' && data.clockEndTs > 0) {
        BPState.matchClockEndTs = data.clockEndTs;
      }
      if (typeof data.vsTimeLeft === 'number' && !localHolding) {
        const nextLeft = Math.max(0, data.vsTimeLeft | 0);
        if (Math.abs(nextLeft - (vsTimeLeft | 0)) >= 1) vsTimeLeft = nextLeft;
      }
      try { if (typeof updateTimerDisplay === 'function') updateTimerDisplay(); } catch (_) {}
      // Soft meScore only when not mid-gesture / pending place
      if (!myPlacePending && !localHolding && typeof data.meScore === 'number') {
        score = data.meScore | 0;
        try {
          const myEl = document.getElementById('myScore');
          if (myEl) myEl.textContent = String(score);
        } catch (_) {}
      }
      try {
        if (data.shape && typeof applyOppRemotePlace === 'function') {
          applyOppRemotePlace(data);
        } else if (Array.isArray(data.grid)) {
          oppGrid = data.grid.map(row => (row || []).slice());
          const bo = (typeof boardOpp !== 'undefined' && boardOpp) ? boardOpp : document.getElementById('boardOpp');
          if (bo && typeof renderGrid === 'function') renderGrid(oppGrid, bo);
        }
      } catch (_) {}
      // Replay log for opp place is written inside applyOppRemotePlace
    } catch (e) { console.warn('opp_place', e); }
  });
  MatchClient.on('opp_deal', (data) => {
    try {
      if (typeof applyOppRemoteDeal === 'function' && data.pieces) {
        applyOppRemoteDeal({ pieces: data.pieces });
      } else if (Array.isArray(data.pieces)) {
        oppPieces = data.pieces.map(p => ({
          shape: (p.shape || []).map(c => Array.isArray(c) ? c.slice() : c),
          color: p.color,
          used: !!p.used
        }));
        try {
          if (typeof softRenderOppPieces === 'function') softRenderOppPieces();
          else renderOppPieces();
        } catch (_) {}
      }
      try {
        if (data && data.pieces && typeof logDeal === 'function') logDeal('opp', data.pieces);
      } catch (_) {}
    } catch (e) { console.warn('opp_deal', e); }
  });
}
