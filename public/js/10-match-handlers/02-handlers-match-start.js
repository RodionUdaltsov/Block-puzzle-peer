/**
 * Block Puzzle — js/10-match-handlers/02-handlers-match-start.js
 * MatchClient events: match_found / match_go / peer ready handshake.
 * Called from bindMatchClientHandlers() (01-bind-match-client.js).
 */
function bindMatchStartHandlers() {
  MatchClient.on('match_found', (data) => {
    try { if (typeof broadcastMyActivity === 'function') broadcastMyActivity(true); } catch (_) {}
    try {
      // Always clear replay / modals / overlays before a new live match (incl. rematch)
      try { if (typeof prepareUiForLiveMatch === 'function') prepareUiForLiveMatch(); } catch (_) {}
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
      // Rematch / new match during score-duel or result modal: skip animation + final window
      try { if (typeof dismissPostMatchResult === 'function') dismissPostMatchResult(); } catch (_) {}
      try {
        document.getElementById('versusResult')?.classList.remove('visible');
        document.getElementById('reviewBar')?.classList.remove('visible');
        const sd = document.getElementById('scoreDuelOverlay');
        if (sd) {
          sd.classList.remove('visible', 'show-verdict', 'duel-win', 'duel-lose', 'duel-draw');
          sd.setAttribute('aria-hidden', 'true');
        }
        document.getElementById('matchEndFreeze')?.classList.remove('visible', 'show');
        document.body.classList.remove('match-ending');
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
      // Authoritative opp identity from server (avatar, trophies, skin, board, name)
      try {
        if (typeof applyOppProfileFromServer === 'function' && data && data.opp) {
          applyOppProfileFromServer(data.opp, { alwaysPaint: true });
        } else if (data && data.opp) {
          mpOppName = data.opp.name || 'Соперник';
          oppName = mpOppName;
          if (typeof data.opp.trophies === 'number') mpOppTrophies = data.opp.trophies | 0;
          if (data.opp.avatarId) window.mpOppAvatarId = data.opp.avatarId;
          if (data.opp.avatarCustom) window.mpOppAvatarCustom = data.opp.avatarCustom;
          try { updateVersusNameLabels && updateVersusNameLabels(); } catch (_) {}
        }
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
      // Server wall-clock: both clients unlock at the same playStartTs
      if (typeof data.playStartTs === 'number' && data.playStartTs > 0) {
        BPState.matchPlayStartTs = data.playStartTs;
      } else if (typeof data.introMs === 'number' && data.introMs > 0) {
        BPState.matchPlayStartTs = Date.now() + (data.introMs | 0);
      } else {
        BPState.matchPlayStartTs = Date.now() + 2200;
      }
      if (typeof data.clockEndTs === 'number' && data.clockEndTs > 0) {
        BPState.matchClockEndTs = data.clockEndTs;
      }
      if (typeof data.duration === 'number') vsDuration = data.duration;
      if (typeof data.introMs === 'number') window._matchIntroMs = data.introMs | 0;
      // Until playStartTs, show full match duration (do not burn intro into the clock UI)
      vsTimeLeft = (typeof data.duration === 'number' ? data.duration : (vsDuration || 120)) | 0;
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
}
