/**
 * Block Puzzle — js/10-match-handlers/03-handlers-state-rejoin.js
 * MatchClient events: full state sync and rejoin_ok.
 * Called from bindMatchClientHandlers() (01-bind-match-client.js).
 */
function bindMatchStateHandlers() {
  MatchClient.on('state', (data) => {
    try {
      if (!data) return;
      // Periodic sync — server snapshot is authoritative
      data._fromSync = true;
      // While waiting for our place_ok, don't thrash pending local preview
      if (BPState.pendingServerPlace) return;
      // Never force-hand while holding a piece — concurrent opp place used to
      // rebuild the tray and snap the ghost back (phones + PC).
      const holding = !!(typeof isDragging !== 'undefined' && isDragging)
        || !!(typeof activeDragSlot !== 'undefined' && activeDragSlot);
      if (holding) {
        // Clock/score only
        try {
          if (typeof data.clockEndTs === 'number' && data.clockEndTs > 0) {
            BPState.matchClockEndTs = data.clockEndTs;
          }
          if (data.me && typeof data.me.score === 'number') score = data.me.score | 0;
          if (data.opp && typeof data.opp.score === 'number') oppScore = data.opp.score | 0;
          if (typeof updateTimerDisplay === 'function') updateTimerDisplay();
          const myEl = document.getElementById('myScore');
          const oppEl = document.getElementById('oppScore');
          if (myEl) myEl.textContent = String(score | 0);
          if (oppEl) oppEl.textContent = String(oppScore | 0);
        } catch (_) {}
        return;
      }
      if (data.me && Array.isArray(data.me.pieces)) data._forceHand = true;
      applyRoomState(data);
    } catch (e) { console.warn('state', e); }
  });
  MatchClient.on('rejoin_ok', (data) => {
    try {
      roomMatchMode = true;
      BPState.roomMatchMode = true;
      if (data && data.seat) MatchClient.seat = data.seat;
      if (data && data.matchId) MatchClient.matchId = data.matchId;
      if (data && data.token) MatchClient.token = data.token;
      mpMode = true;
      vsModeType = 'online';
      mode = 'versus';
      mpFromMatchmaking = (data && data.source !== 'lobby');
      mpGameSource = (data && data.source === 'lobby') ? 'lobby' : 'ranked';
      BPState.matchEnded = false;
      BPState.rejoinLoading = false;
      BPState.rejoinInputLock = false;
      // Keep locked until «Старт!» finishes — prevents early play
      placingLock = true;
      vsActive = false;
      isDragging = false;
      selectedIdx = -1;
      try { document.body.classList.remove('rejoin-loading', 'match-ending'); } catch (_) {}
      try {
        if (data) {
          data._forceHand = true;
          data._rejoin = true;
          data._fromSync = false;
        }
        try { BPState.paintFrozen = true; } catch (_) {}
        // Import server move log for history continuity after refresh
        try {
          if (data && Array.isArray(data.moves) && data.moves.length
              && typeof importServerMovesToMatchLog === 'function') {
            importServerMovesToMatchLog(data.moves, (data.seat || MatchClient.seat || 'a'));
          }
        } catch (_) {}
        if (typeof applyRoomState === 'function') applyRoomState(data);
        beginRoomRankedMatch(data, { waitForGo: true, rejoin: true, quietLoad: true });

        const mid = (data && data.matchId) || (typeof MatchClient !== 'undefined' && MatchClient.matchId) || '';
        const startDone = !!(mid && BPState.introStartShownForId === mid);
        const introRunning = !!(BPState.matchIntroSeqRunning && BPState.matchIntroTimer);

        try {
          if (BPState.matchGoFallbackTimer) {
            clearTimeout(BPState.matchGoFallbackTimer);
            BPState.matchGoFallbackTimer = null;
          }
        } catch (_) {}

        if (startDone) {
          // Intro already finished for this match — quiet unlock only
          try {
            BPState.matchAwaitingGo = false;
            vsActive = true;
            placingLock = false;
            vsIntroLock = false;
            unlockRoomPlay && unlockRoomPlay();
            hideMatchLoading && hideMatchLoading();
          } catch (_) {}
        } else if (introRunning) {
          // Let the current «Почти готово…» → «Старт!» timer finish — do not clear it
        } else {
          // First rejoin for this match — single intro
          try {
            BPState.matchStartPhase = false;
            BPState.matchStartLocked = false;
            BPState.matchGoFinishing = false;
            BPState.matchIntroSeqDone = false;
            BPState.matchIntroSeqRunning = false;
          } catch (_) {}
          runMatchIntroSequence({ reason: 'rejoin', minMs: 1100 });
        }
      } catch (e) {
        console.warn('rejoin begin', e);
      }
      // Always adopt hands from rejoin snapshot if present
      try {
        if (data && data.me && Array.isArray(data.me.pieces)) {
          pieces = data.me.pieces.map(p => ({
            shape: (p.shape || []).map(c => Array.isArray(c) ? c.slice() : c),
            color: p.color,
            used: !!p.used
          }));
        }
        if (data && data.opp && Array.isArray(data.opp.pieces)) {
          oppPieces = data.opp.pieces.map(p => ({
            shape: (p.shape || []).map(c => Array.isArray(c) ? c.slice() : c),
            color: p.color,
            used: !!p.used
          }));
        }
      } catch (_) {}
      // NEVER deal/sync during intro — responses would re-paint after «Старт!»
      // Queue one soft sync for after unlock
      try {
        window._pendingPostIntroSync = true;
      } catch (_) {}
      // Do NOT re-render pieces/boards here — already painted under «Почти готово»
      // and post-Start re-render causes visible flicker.
      // Do NOT noteMyAction — AFK continues until real place
      try {
        // Clear only local rejoin locks/overlays; keep play locked until «Старт!»
        BPState.rejoinLoading = false;
        BPState.rejoinInputLock = false;
        document.body.classList.remove('rejoin-loading');
        hideBoardDisconnectOverlay('me');
        if (typeof dismissStatusToast === 'function') {
          dismissStatusToast('need-move');
          dismissStatusToast('disconnect');
        }
        // placingLock / unlockRoomPlay — only after finishRoomMatchLoadAndGo
      } catch (_) {}
      // Snapshot may say opponent is offline — only then show overlay on opp
      try {
        const oppOnline = data && data.opp && data.opp.online !== false;
        if (!oppOnline && data && data.opp) {
          oppDisconnected = true;
          const rem = (typeof data.vsTimeLeft === 'number') ? data.vsTimeLeft : 0;
          showBoardDisconnectOverlay(rem, 'opp');
        }
      } catch (_) {}
      try { setMpStatus('Снова в матче — сделай ход'); } catch (_) {}
    } catch (e) { console.warn('rejoin_ok', e); }
  });
}
