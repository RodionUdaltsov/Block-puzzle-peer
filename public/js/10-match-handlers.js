/**
 * Block Puzzle — 10-match-handlers.js
 * bindMatchClientHandlers — online place/sync/end WebSocket glue
 * Shares global scope with other public/js/*.js modules (no bundler).
 */
'use strict';

function bindMatchClientHandlers() {
  if (typeof MatchClient === 'undefined') return;
  if (window._matchClientBound) return;
  window._matchClientBound = true;
  MatchClient.on('match_found', (data) => {
    try { if (typeof broadcastMyActivity === 'function') broadcastMyActivity(true); } catch (_) {}
    try {
      try { if (typeof clearAfkUi === 'function') clearAfkUi(); } catch (_) {}
      try { if (typeof clearRmPending === 'function') clearRmPending(); } catch (_) {}
      try { if (typeof scrubTransientFx === 'function') scrubTransientFx(); } catch (_) {}
      window._lastMatchWasVoid = false;
      roomMatchMode = true;
      BPState.roomMatchMode = true;
      rematchIWant = false;
      rematchTheyWant = false;
      rematchPending = false;
      try { rematchClickCount = 0; } catch (_) {}
      try {
        BPState.matchStartPhase = false;
        BPState.matchStartLocked = false;
        BPState.matchGoFinishing = false;
        BPState.matchIntroSeqDone = false;
        BPState.matchIntroSeqRunning = false;
        window._introCompletedMatchId = null;
        BPState.introStartShownForId = null;
        if (BPState.matchIntroTimer) {
          clearTimeout(BPState.matchIntroTimer);
          BPState.matchIntroTimer = null;
        }
        if (BPState.matchGoFallbackTimer) {
          clearTimeout(BPState.matchGoFallbackTimer);
          BPState.matchGoFallbackTimer = null;
        }
      } catch (_) {}
      try { hideRematchOffer(); } catch (_) {}
      try { hideRematchWait(); } catch (_) {}
      try { hideRmToast && hideRmToast(false); } catch (_) {}
      try {
        document.getElementById('versusResult')?.classList.remove('visible');
        document.getElementById('reviewBar')?.classList.remove('visible');
      } catch (_) {}
      // Immediate formal loading so player always sees it
      try {
        showMatchLoading(
          'Загрузка',
          'Подготовка матча…',
          (data && data.source === 'lobby') ? 'Товарищеский матч' : 'Рейтинговый матч'
        );
      } catch (_) {}
      mmFound = true;
      mmActive = false;
      try {
        if (BPState.roomExpandIv) {
          clearInterval(BPState.roomExpandIv);
          BPState.roomExpandIv = null;
        }
      } catch (_) {}
      const isLobby = !!(data && data.source === 'lobby');
      mpFromMatchmaking = !isLobby;
      mpGameSource = isLobby ? 'lobby' : 'ranked';
      mpMode = true;
      vsModeType = 'online';
      mode = 'versus';
      try { clearBotMatchResidue && clearBotMatchResidue(); } catch (_) {}
      try { document.body.classList.remove('vs-bots'); } catch (_) {}
      currentBot = null;
      mpOppName = (data.opp && data.opp.name) || 'Соперник';
      oppName = mpOppName;
      if (data.opp && typeof data.opp.trophies === 'number') mpOppTrophies = data.opp.trophies;
      else mpOppTrophies = (data.opp && data.opp.trophies) | 0;
      try {
        if (data.opp && data.opp.avatarId) window.mpOppAvatarId = data.opp.avatarId;
        else window.mpOppAvatarId = null;
        if (data.opp && data.opp.avatarCustom) window.mpOppAvatarCustom = data.opp.avatarCustom;
        else window.mpOppAvatarCustom = '';
        // Mutual skins / boards: both players must see each other's cosmetics
        const oppSkin = (data.opp && data.opp.skinId) ? data.opp.skinId
          : (data.skinId || null);
        if (oppSkin) {
          window.mpOppSkinId = oppSkin;
          if (typeof applyOppSkin === 'function') applyOppSkin(oppSkin);
        }
        const oppBoard = (data.opp && data.opp.boardId) ? data.opp.boardId : null;
        if (oppBoard) {
          window.mpOppBoardId = oppBoard;
          if (typeof applyOppBoard === 'function') applyOppBoard(oppBoard);
        }
        // Refresh duel avatar if UI present
        try {
          const avOpp = document.getElementById('avOpp') || document.querySelector('.player-panel.opp .avatar, .duel-avatar.opp');
          if (avOpp && typeof renderAvatarInto === 'function') {
            renderAvatarInto(avOpp, {
              avatarId: window.mpOppAvatarId || 'init',
              nick: mpOppName || 'Соперник',
              custom: window.mpOppAvatarCustom || '',
              size: 'duel'
            });
          }
        } catch (_) {}
      } catch (_) {}
      vsDuration = data.duration || vsDuration || 120;
      // Clock not started yet — wait for match_go
      BPState.matchClockEndTs = 0;
      vsTimeLeft = vsDuration;
      score = 0; oppScore = 0;
      BPState.matchEnded = false;
      BPState.rankedDeltaApplied = false;
      BPState.matchAwaitingGo = true;
      try { closeRoomLobby(); } catch (_) {}
      try {
        let statusMsg = isLobby ? 'Матч начинается…' : 'Соперник найден!';
        if (data.crossplayPair) {
          const op = data.oppPlatform || 'device';
          const label = op === 'mobile' ? 'телефон' : (op === 'desktop' ? 'ПК' : op);
          statusMsg = (isLobby ? 'Матч начинается' : 'Соперник найден') + ' · кроссплей (' + label + ')';
        } else if (data.crossplay) {
          statusMsg = isLobby ? 'Матч начинается…' : 'Соперник найден!';
        }
        setMpStatus(statusMsg);
        window._matchCrossplay = !!data.crossplay;
        window._matchCrossplayPair = !!data.crossplayPair;
        window._oppPlatform = data.oppPlatform || null;
      } catch (_) {}
      try {
        beginRoomRankedMatch(data, { waitForGo: true });
      } catch (e) {
        console.warn('match_found start', e);
        try {
          showScreen('versus');
          showMatchLoading && showMatchLoading('Загрузка', 'Подключение…', '');
        } catch (_) {}
      }
    } catch (e) { console.warn('match_found handler', e); }
  });

  MatchClient.on('match_go', (data) => {
    try {
      // Already ran intro for this match — ignore duplicate match_go
      if (BPState.matchIntroSeqDone || BPState.matchIntroSeqRunning
          || BPState.matchStartPhase || BPState.matchGoFinishing) return;
      BPState.matchAwaitingGo = false;
      if (typeof data.clockEndTs === 'number' && data.clockEndTs > 0) {
        BPState.matchClockEndTs = data.clockEndTs;
      }
      if (typeof data.duration === 'number') vsDuration = data.duration;
      if (typeof data.introMs === 'number') window._matchIntroMs = data.introMs | 0;
      vsTimeLeft = typeof data.vsTimeLeft === 'number'
        ? data.vsTimeLeft
        : Math.max(0, Math.ceil(((BPState.matchClockEndTs || 0) - Date.now()) / 1000));
      runMatchIntroSequence({ reason: 'match_go' });
    } catch (e) { console.warn('match_go', e); }
  });

  MatchClient.on('match_peer_ready', () => {
    try {
      if (BPState.matchStartPhase || BPState.matchStartLocked || BPState.matchGoFinishing) return;
      updateMatchLoading && updateMatchLoading('Ожидание…', 'Соперник на месте');
    } catch (_) {}
  });

  MatchClient.on('match_ready_ack', () => {
    try {
      if (BPState.matchStartPhase || BPState.matchStartLocked || BPState.matchGoFinishing) return;
      updateMatchLoading && updateMatchLoading('Ожидание соперника…', 'Вы готовы');
    } catch (_) {}
  });
  MatchClient.on('state', (data) => {
    try {
      if (!data) return;
      // Periodic sync — server snapshot is authoritative
      data._fromSync = true;
      // While waiting for our place_ok, don't thrash pending local preview
      if (BPState.pendingServerPlace) return;
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
      const myPlacePending = !!BPState.pendingServerPlace;
      const roomPatch = {
        oppScore: data.score,
        vsTimeLeft: data.vsTimeLeft,
        clockEndTs: data.clockEndTs,
        _fromOppPlace: true
      };
      if (!myPlacePending) {
        if (typeof data.meScore === 'number') roomPatch.meScore = data.meScore;
        if (Array.isArray(data.meGrid)) roomPatch.meGrid = data.meGrid;
        if (Array.isArray(data.mePieces)) roomPatch.mePieces = data.mePieces;
      }
      applyRoomState(roomPatch);
      try { window._lastRoomApplyAt = Date.now(); } catch (_) {}
      try {
        if (data.shape && typeof applyOppRemotePlace === 'function') {
          applyOppRemotePlace(data);
        } else if (Array.isArray(data.grid)) {
          // No shape — hard-apply final opp board
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
      const statePayload = {
        score: data.score,
        // Skip grid when we animate clear — paint path below owns the board
        grid: willAnimClear ? undefined : data.grid,
        pieces: data.pieces,
        deal: data.deal,
        oppScore: data.oppScore,
        oppGrid: data.oppGrid,
        vsTimeLeft: data.vsTimeLeft,
        clockEndTs: data.clockEndTs,
        _forceHand: true
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

        if (Array.isArray(data.oppGrid)) {
          // Don't thrash opp board mid their clear anim
          const oppBusy = !!(typeof _oppPlaceAnimBusy !== 'undefined' && _oppPlaceAnimBusy);
          if (!oppBusy) {
            oppGrid = data.oppGrid.map(row => (row || []).slice());
            const bo = (typeof boardOpp !== 'undefined' && boardOpp) ? boardOpp : document.getElementById('boardOpp');
            if (bo) {
              if (typeof softRenderGrid === 'function') softRenderGrid(oppGrid, bo);
              else if (typeof renderGrid === 'function') renderGrid(oppGrid, bo);
            }
          }
        }
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
  MatchClient.on('stuck_status', (data) => {
    try {
      if (!roomMatchMode) return;
      const mySeat = MatchClient.seat || 'a';
      const meStuck = mySeat === 'a' ? !!data.a : !!data.b;
      const oppStuck = mySeat === 'a' ? !!data.b : !!data.a;
      if (typeof setPlayerStuck === 'function') setPlayerStuck(meStuck);
      else playerStuck = meStuck;
      if (typeof setAiStuck === 'function') setAiStuck(oppStuck);
      else aiStuck = oppStuck;
      try {
        if (meStuck && typeof showPlayerStuckBanner === 'function') showPlayerStuckBanner();
        if (typeof updateOppStuckBanner === 'function') updateOppStuckBanner();
        else if (typeof updateStuckBanners === 'function') updateStuckBanners();
      } catch (_) {}
    } catch (e) { console.warn('stuck_status', e); }
  });
  MatchClient.on('player_status', (data) => {
    try {
      if (!data) return;
      roomMatchMode = true;
      BPState.roomMatchMode = true;
      const mySeat = MatchClient.seat || null;
      const isOpp = mySeat ? (data.seat && data.seat !== mySeat) : !!data.seat;
      const isMe = mySeat ? (data.seat === mySeat) : false;
      const rem = (typeof data.dcRemaining === 'number')
        ? data.dcRemaining
        : (data.dcDeadlineTs ? Math.max(0, Math.ceil((data.dcDeadlineTs - Date.now()) / 1000)) : 0);
      const pending = !!(data.rejoinPendingMove || data.awaitingMove || data.reason === 'rejoin_pending');
      // Still under disconnect timer (offline OR rejoin without place yet)
      const underDc = (!data.online || pending) && (rem > 0 || (data.dcDeadlineTs && data.dcDeadlineTs > Date.now()));

      if (isOpp) {
        if (underDc) {
          oppDisconnected = true;
          dcDeadlineTs = data.dcDeadlineTs || (rem > 0 ? Date.now() + rem * 1000 : 0);
          // AFK toast must yield to disconnect / afk_disconnect — one timer only
          try {
            if (typeof dismissStatusToast === 'function') {
              dismissStatusToast('afk');
              dismissStatusToast('afk-me');
            }
            if (typeof afkBannerKind !== 'undefined') afkBannerKind = null;
          } catch (_) {}
          try {
            if (typeof showBoardDisconnectOverlay === 'function') {
              showBoardDisconnectOverlay(rem, 'opp', {
                pending: pending && !!data.online,
                reason: data.reason || (data.online ? 'rejoin_pending' : 'disconnect')
              });
            }
          } catch (_) {}
          try {
            if (mpDisconnectTimer) { clearInterval(mpDisconnectTimer); mpDisconnectTimer = null; }
            if (dcDeadlineTs > 0) {
              mpDisconnectTimer = setInterval(() => {
                if (!oppDisconnected) {
                  clearInterval(mpDisconnectTimer); mpDisconnectTimer = null; return;
                }
                const left = Math.max(0, Math.ceil((dcDeadlineTs - Date.now()) / 1000));
                if (left <= 0) {
                  clearInterval(mpDisconnectTimer); mpDisconnectTimer = null;
                  return;
                }
                try {
                  showBoardDisconnectOverlay(left, 'opp', {
                    pending: pending && !!data.online,
                    reason: data.reason || 'disconnect'
                  });
                } catch (_) {}
              }, 400);
            }
          } catch (_) {}
        } else if (data.online && !pending) {
          // Opponent fully back (or cleared pending) — clear ONLY their DC UI.
          // Do not touch local placingLock / drag / hands: players are independent.
          try { clearDisconnectTimer(); } catch (_) {}
          oppDisconnected = false;
          dcDeadlineTs = 0;
          try { hideBoardDisconnectOverlay('opp'); } catch (_) {}
          try {
            if (typeof dismissStatusToast === 'function') {
              dismissStatusToast('disconnect');
              dismissStatusToast('need-move');
              dismissStatusToast('need-move-opp');
            }
          } catch (_) {}
          // Soft safety: only clear sticky rejoin flags if we somehow inherited them;
          // never force-unlock mid pending local place.
          try {
            if (!BPState.pendingServerPlace) {
              BPState.rejoinLoading = false;
              BPState.rejoinInputLock = false;
              try { document.body.classList.remove('rejoin-loading'); } catch (_) {}
              if (placingLock && !isDragging) placingLock = false;
              if (!BPState.matchEnded && !vsActive) vsActive = true;
            }
          } catch (_) {}
          // AFK resume after quick refresh: keep / refresh opponent AFK toast
          if (data.reason === 'afk_resume') {
            const idleMs = (typeof data.idleMs === 'number') ? data.idleMs : 0;
            const afkRem = Math.max(1, Math.ceil(((typeof AFK_LIMIT_MS === 'number' ? AFK_LIMIT_MS : 30000) - idleMs) / 1000));
            try {
              if (typeof showDisconnectBanner === 'function') showDisconnectBanner(afkRem, 'afk');
              if (typeof showBoardDisconnectOverlay === 'function') {
                showBoardDisconnectOverlay(afkRem, 'opp', { reason: 'afk' });
              }
            } catch (_) {}
          } else if (data.reason === 'online' || data.reason === 'active') {
            // Not AFK anymore — clear stuck opponent AFK toast from before refresh
            try {
              if (typeof dismissStatusToast === 'function') dismissStatusToast('afk');
              if (typeof afkBannerKind !== 'undefined' && afkBannerKind === 'opp') afkBannerKind = null;
            } catch (_) {}
          }
        }
      } else if (isMe) {
        // Own seat: never show "opponent offline" on our board from our own status
        if (underDc && pending) {
          // We rejoined — still counted as disconnect until we place; show AFK/DC on OUR board optional
          try {
            showBoardDisconnectOverlay(rem, 'me', { pending: true, reason: 'rejoin_pending' });
          } catch (_) {}
        } else if (data.online && !pending) {
          try { hideBoardDisconnectOverlay('me'); } catch (_) {}
          if (data.reason === 'afk_resume') {
            const idleMs = (typeof data.idleMs === 'number') ? data.idleMs : 0;
            const afkRem = Math.max(1, Math.ceil(((typeof AFK_LIMIT_MS === 'number' ? AFK_LIMIT_MS : 30000) - idleMs) / 1000));
            try {
              if (typeof showDisconnectBanner === 'function') showDisconnectBanner(afkRem, 'afk-me');
              if (typeof showBoardDisconnectOverlay === 'function') {
                showBoardDisconnectOverlay(afkRem, 'me', { reason: 'afk' });
              }
            } catch (_) {}
          }
        }
      }
    } catch (e) { console.warn('player_status', e); }
  });
  MatchClient.on('clock', (data) => {
    try {
      // Authoritative end timestamp only — avoids timer jump from vsTimeLeft alone
      if (typeof data.clockEndTs === 'number' && data.clockEndTs > 0) {
        BPState.matchClockEndTs = data.clockEndTs;
        vsTimeLeft = Math.max(0, Math.ceil((data.clockEndTs - Date.now()) / 1000));
      } else if (typeof data.vsTimeLeft === 'number') {
        vsTimeLeft = data.vsTimeLeft | 0;
        BPState.matchClockEndTs = Date.now() + vsTimeLeft * 1000;
      }
      try { updateTimerDisplay && updateTimerDisplay(); } catch (_) {}
      try { ensureMatchClockRunning && ensureMatchClockRunning(); } catch (_) {}
    } catch (_) {}
  });
  MatchClient.on('afk_warn', (data) => {
    try {
      if (!roomMatchMode && !BPState.roomMatchMode) return;
      // Do not show AFK while opponent is under disconnect / rejoin-pending
      if (oppDisconnected) return;
      const mySeat = MatchClient.seat;
      const rem = (data && data.remaining) | 0;
      const isMe = data.seat && mySeat && data.seat === mySeat;
      if (isMe) {
        try { showBoardDisconnectOverlay(rem, 'me', { reason: 'afk' }); } catch (_) {}
        try { showDisconnectBanner(rem, 'afk-me'); } catch (_) {}
      } else {
        try { showBoardDisconnectOverlay(rem, 'opp', { reason: 'afk' }); } catch (_) {}
        try { showDisconnectBanner(rem, 'afk'); } catch (_) {}
      }
    } catch (e) { console.warn('afk_warn', e); }
  });
  MatchClient.on('match_end', (data) => {
    try {
      try { if (typeof clearAfkUi === 'function') clearAfkUi(); } catch (_) {}
      try { if (typeof clearRmPending === 'function') clearRmPending(); } catch (_) {}
      try {
        window._lastMatchWasVoid = !!(data && (data.void || data.preStart || data.reason === 'void'));
      } catch (_) { window._lastMatchWasVoid = false; }
      try { stopServerAuthSync(); } catch (_) {}
      BPState.matchAwaitingGo = false;
      BPState.matchGoFinishing = false;
      try {
        if (BPState.matchGoFallbackTimer) {
          clearTimeout(BPState.matchGoFallbackTimer);
          BPState.matchGoFallbackTimer = null;
        }
      } catch (_) {}
      try { hideMatchLoading && hideMatchLoading(); } catch (_) {}
      // Keep roomMatchMode true while matchId lives — needed for rematch window
      // (cleared on leave / new queue / match_found will re-set)
      if (BPState.matchEnded) return;
      let mySeat = MatchClient.seat;
      // Fallback: compare names / tokens if seat missing
      if (!mySeat && data) {
        try {
          if (data.a && data.a.name && data.a.name === myNickname) mySeat = 'a';
          else if (data.b && data.b.name && data.b.name === myNickname) mySeat = 'b';
        } catch (_) {}
      }
      const a = (data.a && data.a.score) | 0;
      const b = (data.b && data.b.score) | 0;
      if (mySeat === 'a') { score = a; oppScore = b; }
      else if (mySeat === 'b') { score = b; oppScore = a; }
      else {
        // last resort keep local scores
      }
      let forceWin = false, forceLoss = false;
      if (data.winnerSeat && mySeat) {
        forceWin = data.winnerSeat === mySeat;
        forceLoss = data.winnerSeat !== mySeat;
      } else if (data.reason === 'forfeit' && data.winnerSeat) {
        // seat unknown — if we just pressed forfeit we already forceLoss locally
        forceWin = false;
        forceLoss = false;
      }
      const reason = (data && data.reason) || 'time';
      // Authoritative replay log from server
      try {
        if (data && Array.isArray(data.moves) && data.moves.length) {
          const seat = mySeat || MatchClient.seat || 'a';
          if (typeof importServerMovesToMatchLog === 'function') {
            importServerMovesToMatchLog(data.moves, seat);
          }
        }
      } catch (e) { console.warn('match_end import moves', e); }
      try {
        // Void = pre-start cancel (no moves) — soft exit, no ranked delta
        if (reason === 'void') {
          endVersus({
            reason: 'void',
            quiet: true,
            silent: false,
            forceWin: false,
            forceLoss: false
          });
        } else {
          endVersus({
            forceWin: forceWin || undefined,
            forceLoss: forceLoss || undefined,
            reason: reason,
            quiet: false,
            silent: false
          });
        }
      } catch (e) { console.warn('match_end endVersus', e); }
    } catch (e) { console.warn('match_end', e); }
  });

  MatchClient.on('rematch_invite', (data) => {
    try {
      // Ignore invites tied to void / pre-start cancels
      if (window._lastMatchWasVoid) return;
      rematchTheyWant = true;
      pendingRematchOfferName = (data && data.from) || 'Соперник';
      if (data && data.matchId) MatchClient.matchId = data.matchId;
      try {
        if (typeof setRmPending === 'function') {
          setRmPending(pendingRematchOfferName, data && data.matchId);
        }
      } catch (_) {}
      try { showRematchOffer && showRematchOffer(pendingRematchOfferName); } catch (_) {}
      // Auto-accept if we already clicked rematch
      if (rematchIWant) {
        try { MatchClient.rematchAccept(); } catch (_) {}
      }
    } catch (e) { console.warn('rematch_invite', e); }
  });
  MatchClient.on('rematch_cancel', (data) => {
    try {
      // Inviter cancelled — drop invite from toast + «Заявки»
      try { if (typeof clearRmPending === 'function') clearRmPending(); } catch (_) {}
      rematchTheyWant = false;
      pendingRematchOfferName = null;
      try { hideRmToast(true); } catch (_) {}
      try { hideRematchOffer && hideRematchOffer(); } catch (_) {}
      if (!(data && data.self)) {
        try { showInfoToast('Реванш', 'Соперник отменил заявку', 'bad'); } catch (_) {}
      } else {
        // self cancel — leave wait UI
        rematchIWant = false;
        rematchPending = false;
        try { hideRematchWait && hideRematchWait(); } catch (_) {}
        try { restorePostMatchResultUI && restorePostMatchResultUI(); } catch (_) {}
      }
    } catch (e) { console.warn('rematch_cancel', e); }
  });
  MatchClient.on('rematch_wait', () => {
    try {
      rematchPending = true;
      try { showRematchWait && showRematchWait(); } catch (_) {}
    } catch (_) {}
  });
  MatchClient.on('rematch_decline', (data) => {
    try {
      const wasWaiting = !!(rematchPending || rematchIWant);
      rematchIWant = false;
      rematchTheyWant = false;
      rematchPending = false;
      try { if (typeof clearRmPending === 'function') clearRmPending(); } catch (_) {}
      try { hideRematchOffer(); } catch (_) {}
      try { hideRematchWait(); } catch (_) {}
      try { hideRmToast(false); } catch (_) {}
      // Opponent (or self cancel) declined — always return to result window
      if (wasWaiting || !(data && data.self)) {
        try {
          if (typeof leaveAfterRematchDecline === 'function') {
            leaveAfterRematchDecline(
              (data && data.self) ? null : 'Соперник отклонил'
            );
          } else {
            if (!(data && data.self)) {
              try { showInfoToast('Реванш', 'Соперник отклонил', 'bad'); } catch (_) {}
            }
            try { restorePostMatchResultUI && restorePostMatchResultUI(); } catch (_) {}
          }
        } catch (_) {}
      } else {
        try { restorePostMatchResultUI && restorePostMatchResultUI(); } catch (_) {}
      }
    } catch (_) {}
  });

  MatchClient.on('rejoin_fail', (data) => {
    try {
      console.warn('rejoin_fail', data);
      try { setMpStatus('Не удалось переподключиться: ' + ((data && data.reason) || 'error')); } catch (_) {}
      // keep roomMatchMode if still in UI — user may retry
    } catch (_) {}
  });
}
try { bindMatchClientHandlers(); } catch (_) {}
try { bindPrivateLobbyHandlers(); } catch (_) {}
try { ensureFriendPresence(); } catch (_) {}
setInterval(() => { try { ensureFriendPresence(); } catch (_) {} }, 15000);

try {
  window.__bpHandlersReady = true;
try {
  if (window._roomSyncIv) clearInterval(window._roomSyncIv);
  window._roomSyncIv = setInterval(() => {
    try {
      if (!(roomMatchMode || BPState.roomMatchMode)) return;
      if (!vsActive || BPState.matchEnded) return;
      // Skip heartbeat while player is dragging a piece
      if (typeof isDragging !== 'undefined' && isDragging) return;
      if (typeof MatchClient !== 'undefined') MatchClient.sync({ _fromSync: 1 });
    } catch (_) {}
  }, 6000);
} catch (_) {}

  if (typeof MatchClient !== 'undefined') {
    if (typeof MatchClient.markHandlersReady === 'function') MatchClient.markHandlersReady();
    setTimeout(() => {
      try { MatchClient.tryResumeFromStorage(); } catch (_) {}
    }, 400);
  }
} catch (_) {}

// Register friend presence over WS (no server)
function registerWsPresence() {
  try {
    if (typeof MatchClient === 'undefined') return;
    if (!myFriendCode) return;
    MatchClient.registerPresence({
      friendCode: myFriendCode,
      name: myNickname,
      trophies: trophies | 0,
      activity: 'online'
    });
    const codes = (friends || []).map(f => f.code).filter(Boolean);
    if (codes.length) MatchClient.queryPresence(codes);
  } catch (_) {}
}
try {
  setTimeout(registerWsPresence, 800);
  setInterval(() => {
    try {
      if (typeof MatchClient === 'undefined') return;
      const codes = (friends || []).map(f => f.code).filter(Boolean);
      if (codes.length) MatchClient.queryPresence(codes);
    } catch (_) {}
  }, 20000);
} catch (_) {}


function rollbackPendingServerPlace() {
  const pend = BPState.pendingServerPlace;
  if (!pend) return;
  try {
    if (Array.isArray(pend.gridBefore)) {
      grid = pend.gridBefore.map(row => row.slice());
      const b = (typeof boardMe !== 'undefined' && boardMe) ? boardMe : document.getElementById('boardMe');
      if (b && typeof renderGrid === 'function') renderGrid(grid, b);
    }
    if (Array.isArray(pend.piecesBefore)) {
      pieces = pend.piecesBefore.map(p => ({
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
    if (typeof pend.scoreBefore === 'number') {
      score = pend.scoreBefore | 0;
      try { document.getElementById('myScore').textContent = String(score); } catch (_) {}
    }
  } catch (e) { console.warn('rollbackPendingServerPlace', e); }
  BPState.pendingServerPlace = null;
  placingLock = false;
}


/** Periodic soft sync — server is source of truth for board/hand/score. */
function startServerAuthSync() {
  try {
    if (BPState.serverAuthSyncIv) {
      clearInterval(BPState.serverAuthSyncIv);
      BPState.serverAuthSyncIv = null;
    }
  } catch (_) {}
  BPState.serverAuthSyncIv = setInterval(() => {
    try {
      if (!vsActive || BPState.matchEnded) return;
      if (!(roomMatchMode || BPState.roomMatchMode)) return;
      if (typeof isDragging !== 'undefined' && isDragging) return;
      if (BPState.pendingServerPlace) return;
      if (typeof MatchClient === 'undefined' || !MatchClient.connected) return;
      MatchClient.sync({});
    } catch (_) {}
  }, 5000);
}
function stopServerAuthSync() {
  try {
    if (BPState.serverAuthSyncIv) {
      clearInterval(BPState.serverAuthSyncIv);
      BPState.serverAuthSyncIv = null;
    }
  } catch (_) {}
}

function roomSendPlace(payload) {
  try {
    if (roomMatchMode && typeof MatchClient !== 'undefined') {
      MatchClient.place(payload);
    }
  } catch (_) {}
}
function roomSendDeal(payload) {
  try {
    if (roomMatchMode && typeof MatchClient !== 'undefined') {
      MatchClient.deal(payload);
    }
  } catch (_) {}
}


function beginRoomRankedMatch(data, opts) {
  opts = opts || {};
  const waitForGo = !!(opts.waitForGo || (data && data.loading) || BPState.matchAwaitingGo);
  try {
    try {
      BPState.rejoinLoading = false;
      BPState.rejoinInputLock = false;
      BPState.mpRejoiningMatch = false;
      document.body.classList.remove('rejoin-loading');
      isDragging = false;
      selectedIdx = -1;
    } catch (_) {}
    roomMatchMode = true;
    BPState.roomMatchMode = true;
    mpMode = true;
    vsModeType = 'online';
    mode = 'versus';
    mpFromMatchmaking = !(data && data.source === 'lobby');
    mpGameSource = (data && data.source === 'lobby') ? 'lobby' : 'ranked';
    BPState.matchHadAnyPlace = false;
    try { BPState.matchEnded = false; } catch (_) {}
    try {
      if (!(opts && opts.rejoin)) {
        matchLog = [];
        matchStartTs = Date.now();
      } else if (!matchStartTs) {
        matchStartTs = Date.now();
      }
    } catch (_) {}

    // Lock play until match_go
    vsActive = false;
    placingLock = true;
    vsIntroLock = true;
    mpMatchStarting = true;
    mpLoading = true;
    // Restore chrome after previous match end / review / forfeit
    try {
      document.body.classList.remove('match-ending', 'replay-ui', 'replay-playing', 'rejoin-loading', 'quiet-hands');
      const fb = document.getElementById('btnForfeit');
      if (fb) { fb.style.display = ''; fb.disabled = false; fb.style.pointerEvents = ''; fb.style.opacity = ''; }
      try { forfeitLock = false; } catch (_) {}
      const liveCtrl = document.getElementById('vsLiveControls');
      if (liveCtrl) liveCtrl.style.display = '';
      const footer = document.getElementById('vsFooter');
      if (footer) footer.style.display = '';
      const reviewBar = document.getElementById('reviewBar');
      if (reviewBar) {
        reviewBar.classList.remove('visible', 'replay-dock');
      }
      const piecesVs = document.getElementById('piecesAreaVs');
      if (piecesVs) {
        piecesVs.style.opacity = '1';
        piecesVs.style.pointerEvents = 'none'; // still locked until go
      }
    } catch (_) {}

    score = (data && data.me && typeof data.me.score === 'number') ? (data.me.score | 0) : 0;
    oppScore = (data && data.opp && typeof data.opp.score === 'number') ? (data.opp.score | 0) : 0;
    grid = (data && data.me && Array.isArray(data.me.grid))
      ? data.me.grid.map(row => row.slice())
      : Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    oppGrid = (data && data.opp && Array.isArray(data.opp.grid))
      ? data.opp.grid.map(row => row.slice())
      : Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    if (data && data.me && Array.isArray(data.me.pieces) && data.me.pieces.length) {
      pieces = data.me.pieces.map(p => ({
        shape: (p.shape || []).map(c => Array.isArray(c) ? c.slice() : c),
        color: p.color,
        used: !!p.used
      }));
    }
    if (data && data.opp && Array.isArray(data.opp.pieces) && data.opp.pieces.length) {
      oppPieces = data.opp.pieces.map(p => ({
        shape: (p.shape || []).map(c => Array.isArray(c) ? c.slice() : c),
        color: p.color,
        used: !!p.used
      }));
    }
    try {
      const empty = !pieces || !pieces.length || pieces.every(p => p && p.used);
      if (empty && typeof MatchClient !== 'undefined') {
        MatchClient.deal({});
        MatchClient.sync({});
      }
    } catch (_) {}

    if (data && data.duration) vsDuration = data.duration;
    // Do not start clock while loading — full duration shown frozen
    BPState.matchClockEndTs = 0;
    vsTimeLeft = vsDuration || 120;
    matchStartTs = 0;

    try { clearBotMatchResidue && clearBotMatchResidue(); } catch (_) {}
    currentBot = null;
    if (data && data.opp && data.opp.name) {
      mpOppName = data.opp.name;
      oppName = mpOppName;
    }
    if (data && data.opp && typeof data.opp.trophies === 'number') {
      mpOppTrophies = data.opp.trophies;
    }
    try {
      if (data && data.opp && data.opp.avatarId) window.mpOppAvatarId = data.opp.avatarId;
      if (data && data.opp && data.opp.avatarCustom) window.mpOppAvatarCustom = data.opp.avatarCustom;
      const oppSkin = data && data.opp && data.opp.skinId;
      if (oppSkin) {
        window.mpOppSkinId = oppSkin;
        if (typeof applyOppSkin === 'function') applyOppSkin(oppSkin);
      }
      const oppBoard = data && data.opp && data.opp.boardId;
      if (oppBoard) {
        window.mpOppBoardId = oppBoard;
        if (typeof applyOppBoard === 'function') applyOppBoard(oppBoard);
      }
    } catch (_) {}

    showScreen('versus');
    try {
      document.body.classList.remove('rejoin-loading', 'match-ending', 'quiet-hands');
      const rl = document.getElementById('rejoinLoading');
      if (rl) {
        rl.classList.remove('show', 'visible');
        rl.style.display = 'none';
      }
    } catch (_) {}

    try {
      if (typeof createBoardDOM === 'function') {
        if (boardMe) createBoardDOM(boardMe);
        if (boardOpp) createBoardDOM(boardOpp);
      }
      renderGrid(grid, boardMe);
      renderGrid(oppGrid, boardOpp);
    } catch (_) {}

    try {
      const area = document.getElementById('piecesAreaVs');
      try {
        if (opts.rejoin || opts.quietLoad) {
          BPState.animateDealIn = false;
          BPState.quietPieceRender = true;
        } else {
          BPState.animateDealIn = true;
          BPState.quietPieceRender = false;
        }
      } catch (_) {}
      if (area && typeof renderPieces === 'function') renderPieces(area);
      if (typeof renderOppPieces === 'function') renderOppPieces();
      try { BPState.quietPieceRender = false; } catch (_) {}
      if (area) {
        area.style.opacity = '1';
        area.style.filter = 'none';
        area.style.pointerEvents = 'none'; // locked until go
        area.querySelectorAll('.piece-slot').forEach(s => {
          if (!s.classList.contains('used')) {
            s.style.opacity = '1';
            s.style.filter = 'none';
            s.style.pointerEvents = 'none';
            s.classList.add('show');
            s.classList.remove('lifting');
          }
        });
      }
    } catch (_) {}

    try {
      document.getElementById('myScore').textContent = String(score);
      document.getElementById('oppScore').textContent = String(oppScore);
    } catch (_) {}
    try { updateVersusNameLabels && updateVersusNameLabels(); } catch (_) {}
    try { updateTimerDisplay && updateTimerDisplay(); } catch (_) {}

    // Cosmetics helper (shared)
    const applyCosmetics = () => {
      try {
        if (data && data.opp) {
          if (data.opp.skinId && typeof applyOppSkin === 'function') {
            window.mpOppSkinId = data.opp.skinId;
            applyOppSkin(data.opp.skinId);
          }
          if (data.opp.boardId && typeof applyOppBoard === 'function') {
            window.mpOppBoardId = data.opp.boardId;
            applyOppBoard(data.opp.boardId);
          }
          if (data.opp.avatarId) window.mpOppAvatarId = data.opp.avatarId;
          if (data.opp.avatarCustom) window.mpOppAvatarCustom = data.opp.avatarCustom;
        }
        if (typeof applyEquippedSkin === 'function') applyEquippedSkin();
        if (typeof applyEquippedBoard === 'function') applyEquippedBoard();
        try {
          if (typeof boardMe !== 'undefined' && boardMe) renderGrid(grid, boardMe);
          if (typeof boardOpp !== 'undefined' && boardOpp) renderGrid(oppGrid, boardOpp);
        } catch (_) {}
        try {
          const avOpp = document.getElementById('avOpp') || document.querySelector('.player-panel.opp .avatar, .duel-avatar.opp');
          if (avOpp && typeof renderAvatarInto === 'function') {
            renderAvatarInto(avOpp, {
              avatarId: window.mpOppAvatarId || 'init',
              nick: (data && data.opp && data.opp.name) || mpOppName || 'Соперник',
              custom: window.mpOppAvatarCustom || '',
              size: 'duel'
            });
          }
        } catch (_) {}
      } catch (_) {}
    };

    const isRejoinQuiet = !!(opts.rejoin || opts.quietLoad);

    if (isRejoinQuiet) {
      // Rejoin: no staged text flashes, no match_ready (would re-trigger match_go → double Start)
      // Cosmetics applied inside runMatchIntroSequence while «Почти готово…» is shown
      try { applyCosmetics(); } catch (_) {}
    } else {
      // New match: single loading label, then cosmetics, then ready
      try {
        showMatchLoading(
          'Загрузка',
          'Почти готово…',
          mpFromMatchmaking ? 'Рейтинговый матч' : 'Товарищеский матч'
        );
      } catch (_) {}

      const sendReady = () => {
        try {
          if (typeof MatchClient !== 'undefined' && MatchClient.matchReady) {
            MatchClient.matchReady();
          }
        } catch (_) {}
      };

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          applyCosmetics();
          setTimeout(sendReady, 100);
        });
      });
      setTimeout(sendReady, 500);
      setTimeout(sendReady, 1400);
    }

    // Soft sync only for NEW matches — rejoin applies snapshot under «Почти готово»
    try {
      if (!(opts && (opts.rejoin || opts.quietLoad))) {
        if (typeof MatchClient !== 'undefined') MatchClient.sync({});
      }
    } catch (_) {}

    // Fallback: only for NEW matches waiting on match_go — never on rejoin
    if (waitForGo && !(opts && (opts.rejoin || opts.quietLoad))) {
      try {
        if (BPState.matchGoFallbackTimer) clearTimeout(BPState.matchGoFallbackTimer);
      } catch (_) {}
      BPState.matchGoFallbackTimer = setTimeout(() => {
        if (BPState.matchAwaitingGo && !BPState.matchIntroSeqDone && !BPState.matchIntroSeqRunning) {
          console.warn('match_go fallback — unlocking locally');
          BPState.matchAwaitingGo = false;
          BPState.matchClockEndTs = Date.now() + (vsDuration || 120) * 1000;
          runMatchIntroSequence({ reason: 'fallback' });
        }
      }, 3000);
    } else if (!(opts && (opts.rejoin || opts.quietLoad))) {
      // Legacy path only
      runMatchIntroSequence({ reason: 'legacy' });
    }
  } catch (e) {
    console.warn('beginRoomRankedMatch', e);
  }
}

/**
 * Single intro pipeline for new match AND rejoin:
 *   «Почти готово…» (load cosmetics/boards) → «Старт!» once → unlock.
 * Never runs twice for the same match session.
 */
function _currentMatchIntroKey() {
  try {
    if (typeof MatchClient !== 'undefined' && MatchClient.matchId)
      return String(MatchClient.matchId);
  } catch (_) {}
  return '';
}

function runMatchIntroSequence(opts) {
  opts = opts || {};
  const key = _currentMatchIntroKey();
  try {
    // Start already shown for this match — never replay
    if (key && BPState.introStartShownForId === key) return;
    if (BPState.matchGoFinishing) return;
    // Already mid-intro with a live timer — do not restart or kill it
    if (BPState.matchIntroSeqRunning && BPState.matchIntroTimer) return;
    if (BPState.matchStartPhase) return;
  } catch (_) {}
  try { BPState.matchIntroSeqRunning = true; } catch (_) {}
  // Claim "running" for this match (NOT completed — that is set only when Start shows)
  try {
    if (key) window._introRunningMatchId = key;
  } catch (_) {}
  try {
    BPState.matchStartLocked = false;
    BPState.matchStartPhase = false;
    BPState.matchIntroSeqDone = false;
  } catch (_) {}

  const sub = opts.sub
    || (mpFromMatchmaking ? 'Рейтинговый матч' : 'Товарищеский матч');
  try {
    showMatchLoading('Загрузка', 'Почти готово…', sub);
  } catch (_) {}

  // Apply cosmetics / boards while overlay shows «Почти готово…»
  try {
    if (opts.applyCosmetics !== false) {
      if (window.mpOppSkinId && typeof applyOppSkin === 'function') applyOppSkin(window.mpOppSkinId);
      if (window.mpOppBoardId && typeof applyOppBoard === 'function') applyOppBoard(window.mpOppBoardId);
      if (typeof applyEquippedSkin === 'function') applyEquippedSkin();
      if (typeof applyEquippedBoard === 'function') applyEquippedBoard();
      try {
        BPState.quietPieceRender = true;
        BPState.animateDealIn = false;
        if (typeof boardMe !== 'undefined' && boardMe && typeof grid !== 'undefined')
          renderGrid(grid, boardMe);
        if (typeof boardOpp !== 'undefined' && boardOpp && typeof oppGrid !== 'undefined')
          renderGrid(oppGrid, boardOpp);
        const area = document.getElementById('piecesAreaVs');
        if (area && typeof renderPieces === 'function' && pieces && pieces.length)
          renderPieces(area);
        if (typeof renderOppPieces === 'function' && oppPieces && oppPieces.length)
          renderOppPieces();
        BPState.quietPieceRender = false;
      } catch (_) {}
      // Opening hands for replay — must exist even if deal arrived before vsActive
      try {
        if (typeof logDeal === 'function') {
          if (pieces && pieces.length) logDeal('me', pieces);
          if (oppPieces && oppPieces.length) logDeal('opp', oppPieces);
        }
      } catch (_) {}
    }
  } catch (_) {}

  const isRejoin = !!(opts && opts.reason === 'rejoin');
  // Rejoin needs a longer «Почти готово…» so all paints/sync settle before «Старт!»
  const baseHold = (typeof opts.minMs === 'number' && opts.minMs > 0)
    ? opts.minMs
    : (isRejoin ? 1000 : 800);

  const goStart = () => {
    try {
      if (BPState.matchIntroTimer) clearTimeout(BPState.matchIntroTimer);
    } catch (_) {}
    BPState.matchIntroTimer = setTimeout(() => {
      BPState.matchIntroTimer = null;
      try { finishRoomMatchLoadAndGo(); } catch (e) {
        console.warn('runMatchIntroSequence', e);
        try { forceUnlockAfterIntroStuck(); } catch (_) {}
      }
    }, baseHold);
  };

  // All network sync happens NOW under «Почти готово» — never after Start
  const runPreStartSync = () => {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        try {
          // Final quiet paint with whatever state we have
          BPState.quietPieceRender = true;
          BPState.animateDealIn = false;
          if (typeof boardMe !== 'undefined' && boardMe && grid)
            (typeof softRenderGrid === 'function' ? softRenderGrid : renderGrid)(grid, boardMe);
          if (typeof boardOpp !== 'undefined' && boardOpp && oppGrid)
            (typeof softRenderGrid === 'function' ? softRenderGrid : renderGrid)(oppGrid, boardOpp);
          const area = document.getElementById('piecesAreaVs');
          if (area && pieces && pieces.length && typeof renderPieces === 'function') renderPieces(area);
          if (oppPieces && oppPieces.length && typeof renderOppPieces === 'function') renderOppPieces();
          const myEl = document.getElementById('myScore');
          const oppEl = document.getElementById('oppScore');
          if (myEl) myEl.textContent = String(score | 0);
          if (oppEl) oppEl.textContent = String(oppScore | 0);
          BPState.quietPieceRender = false;
        } catch (_) {}
        resolve();
      };
      try {
        if (typeof MatchClient === 'undefined' || !MatchClient.sync) {
          finish();
          return;
        }
        // One-shot listener for next state packet
        let off = null;
        const onState = () => {
          try { if (off) off(); } catch (_) {}
          setTimeout(finish, 80);
        };
        try {
          if (typeof MatchClient.on === 'function') {
            MatchClient.on('state', onState);
            off = () => { try { MatchClient.off && MatchClient.off('state', onState); } catch (_) {} };
          }
        } catch (_) {}
        window._lastRejoinSyncAt = Date.now();
        try { MatchClient.sync({ _fromSync: 1 }); } catch (_) {}
        // If hand empty, also request deal under overlay
        try {
          if (!pieces || !pieces.length || pieces.every(p => p && p.used)) {
            MatchClient.deal && MatchClient.deal({});
          }
        } catch (_) {}
        // Cap wait — never hang on «Почти готово»; rejoin needs more settle time
        setTimeout(finish, isRejoin ? 1000 : 550);
      } catch (_) {
        finish();
      }
    });
  };

  try { window._pendingPostIntroSync = false; } catch (_) {}
  runPreStartSync().then(goStart).catch(goStart);

  // Safety net
  try {
    if (BPState.matchIntroSafetyTimer) clearTimeout(BPState.matchIntroSafetyTimer);
  } catch (_) {}
  BPState.matchIntroSafetyTimer = setTimeout(() => {
    BPState.matchIntroSafetyTimer = null;
    try {
      if (!BPState.introStartShownForId || BPState.introStartShownForId !== key) {
        console.warn('intro safety — force Start/unlock');
        finishRoomMatchLoadAndGo();
      }
    } catch (_) {
      try { forceUnlockAfterIntroStuck(); } catch (_2) {}
    }
  }, 5500);
}

function forceUnlockAfterIntroStuck() {
  try {
    const el = document.getElementById('matchIntro');
    if (el) {
      el.classList.remove('mi-go', 'visible');
      el.style.display = 'none';
      el.style.pointerEvents = 'none';
    }
  } catch (_) {}
  try {
    BPState.matchStartPhase = false;
    BPState.matchStartLocked = true;
    BPState.matchIntroSeqRunning = false;
    BPState.matchIntroSeqDone = true;
    BPState.matchGoFinishing = false;
    BPState.matchAwaitingGo = false;
    const key = _currentMatchIntroKey();
    if (key) {
      window._introCompletedMatchId = key;
      BPState.introStartShownForId = key;
    }
  } catch (_) {}
  try {
    vsActive = true;
    placingLock = false;
    vsIntroLock = false;
    mpLoading = false;
    mpMatchStarting = false;
    unlockRoomPlay && unlockRoomPlay();
    if (typeof startMatchWallClock === 'function' && BPState.matchClockEndTs)
      startMatchWallClock(BPState.matchClockEndTs);
    else if (typeof ensureMatchClockRunning === 'function') ensureMatchClockRunning();
  } catch (_) {}
}

/** After loading: flash "Старт!", then unlock and start the match timer. */
function finishRoomMatchLoadAndGo() {
  try {
    if (BPState.matchGoFallbackTimer) {
      clearTimeout(BPState.matchGoFallbackTimer);
      BPState.matchGoFallbackTimer = null;
    }
  } catch (_) {}
  // Only one «Старт!» per match / rejoin session
  const key = _currentMatchIntroKey();
  if (key && BPState.introStartShownForId === key) return;
  if (BPState.matchGoFinishing) return;
  BPState.matchGoFinishing = true;
  try {
    BPState.matchIntroSeqDone = true;
    if (key) {
      window._introCompletedMatchId = key;
      BPState.introStartShownForId = key;
    }
    if (BPState.matchIntroSafetyTimer) {
      clearTimeout(BPState.matchIntroSafetyTimer);
      BPState.matchIntroSafetyTimer = null;
    }
  } catch (_) {}
  try {
    mpLoading = false;
    mpMatchStarting = false;
    BPState.matchAwaitingGo = false;

    // «Старт!» is final — lock so nothing can change the overlay text afterward
    try {
      BPState.matchStartPhase = true;
      BPState.matchStartLocked = true;
    } catch (_) {}
    try {
      const el = document.getElementById('matchIntro');
      if (el) {
        const lab = document.getElementById('miLabel');
        const tit = document.getElementById('miTitle');
        const su = document.getElementById('miSub');
        if (lab) lab.textContent = 'Готово';
        if (tit) tit.textContent = 'Старт!';
        if (su) su.textContent = mpFromMatchmaking ? 'Рейтинговый матч' : 'Товарищеский матч';
        el.classList.add('visible', 'mi-go');
        el.setAttribute('aria-hidden', 'false');
        el.style.display = 'flex';
        el.style.pointerEvents = 'auto';
        el.style.opacity = '1';
        el.style.visibility = 'visible';
        el.style.zIndex = '9000';
      }
    } catch (_) {}

    const startHoldMs = 1100;
    // While «Старт!» is on screen — finalize ALL DOM under the overlay (invisible to user)
    try {
      BPState.animateDealIn = false;
      BPState.quietPieceRender = true;
      BPState.paintFrozen = false; // allow one quiet final paint under overlay
      if (typeof boardMe !== 'undefined' && boardMe && typeof grid !== 'undefined') {
        if (typeof softRenderGrid === 'function') softRenderGrid(grid, boardMe);
        else if (typeof renderGrid === 'function') renderGrid(grid, boardMe);
      }
      if (typeof boardOpp !== 'undefined' && boardOpp && typeof oppGrid !== 'undefined') {
        if (typeof softRenderGrid === 'function') softRenderGrid(oppGrid, boardOpp);
        else if (typeof renderGrid === 'function') renderGrid(oppGrid, boardOpp);
      }
      const area = document.getElementById('piecesAreaVs');
      if (area && pieces && pieces.length) {
        if (typeof renderPieces === 'function') renderPieces(area);
      }
      if (oppPieces && oppPieces.length && typeof renderOppPieces === 'function') renderOppPieces();
      const myEl = document.getElementById('myScore');
      const oppEl = document.getElementById('oppScore');
      if (myEl) myEl.textContent = String(score | 0);
      if (oppEl) oppEl.textContent = String(oppScore | 0);
      try { updateVersusNameLabels && updateVersusNameLabels(); } catch (_) {}
      try { unlockRoomPlay && unlockRoomPlay(); } catch (_) {}
      BPState.quietPieceRender = false;
      // Freeze again so nothing can paint between now and hide
      BPState.paintFrozen = true;
    } catch (_) {}

    setTimeout(() => {
      // Hide overlay — board underneath is already final
      try {
        const el = document.getElementById('matchIntro');
        if (el) {
          el.classList.remove('mi-go', 'visible');
          el.style.display = 'none';
          el.style.pointerEvents = 'none';
          el.setAttribute('aria-hidden', 'true');
        }
      } catch (_) {}

      BPState.matchEnded = false;
      vsActive = true;
      placingLock = false;
      vsIntroLock = false;
      mpLoading = false;
      mpMatchStarting = false;
      try {
        document.body.classList.remove('match-ending', 'replay-ui', 'replay-playing');
        const fb = document.getElementById('btnForfeit');
        if (fb) { fb.style.display = ''; fb.disabled = false; fb.style.pointerEvents = ''; fb.style.opacity = ''; }
        try { forfeitLock = false; } catch (_) {}
        const liveCtrl = document.getElementById('vsLiveControls');
        if (liveCtrl) liveCtrl.style.display = '';
      } catch (_) {}
      if (!matchStartTs) matchStartTs = Date.now();
      try { window._matchWentLiveAt = matchStartTs || Date.now(); } catch (_) {}

      if (!(typeof BPState.matchClockEndTs === 'number' && BPState.matchClockEndTs > 0)) {
        BPState.matchClockEndTs = Date.now() + Math.max(0, vsTimeLeft || vsDuration || 120) * 1000;
      }
      vsTimeLeft = Math.max(0, Math.ceil((BPState.matchClockEndTs - Date.now()) / 1000));

      // Keep paint frozen + start phase a bit longer so no jumps right after overlay hides
      try {
        BPState.animateDealIn = false;
        BPState.quietPieceRender = true;
        BPState.paintFrozen = true;
        BPState.matchStartPhase = true;
      } catch (_) {}

      try {
        if (typeof startMatchWallClock === 'function') startMatchWallClock(BPState.matchClockEndTs);
        else if (typeof ensureMatchClockRunning === 'function') ensureMatchClockRunning();
      } catch (_) {}
      try { startAfkWatch && startAfkWatch(); } catch (_) {}
      try { updateTimerDisplay && updateTimerDisplay(); } catch (_) {}
      try { persistLiveMatch && persistLiveMatch(); } catch (_) {}
      try { window._pendingIntroOppDeal = null; } catch (_) {}
      try { window._pendingPostIntroSync = false; } catch (_) {}

      // Settle 2 frames + short delay before allowing any paint — calm entry into play
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            try {
              BPState.matchStartPhase = false;
              BPState.matchIntroSeqRunning = false;
              BPState.paintFrozen = false;
              BPState.quietPieceRender = false;
            } catch (_) {}
            BPState.matchGoFinishing = false;
          }, 120);
        });
      });
    }, startHoldMs);
  } catch (e) {
    BPState.matchGoFinishing = false;
    console.warn('finishRoomMatchLoadAndGo', e);
    // Emergency unlock
    try {
      vsActive = true;
      placingLock = false;
      hideMatchLoading && hideMatchLoading();
      unlockRoomPlay && unlockRoomPlay();
      startMatchWallClock && startMatchWallClock();
    } catch (_) {}
  }
}


let _privateLobbyHandlersBound = false;
