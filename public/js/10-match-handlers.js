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
    try {
      roomMatchMode = true;
      window._roomMatchMode = true;
      rematchIWant = false;
      rematchTheyWant = false;
      rematchPending = false;
      try { hideRematchOffer(); } catch (_) {}
      try { hideRematchWait(); } catch (_) {}
      mmFound = true;
      mmActive = false;
      try {
        // Don't call leaveQueue after match — just clear timers
        if (window._roomExpandIv) {
          clearInterval(window._roomExpandIv);
          window._roomExpandIv = null;
        }
      } catch (_) {}
      const isLobby = !!(data && data.source === 'lobby');
      mpFromMatchmaking = !isLobby;
      mpGameSource = isLobby ? 'lobby' : 'ranked';
      mpMode = true;
      vsModeType = 'online';
      mode = 'versus';
      mpOppName = (data.opp && data.opp.name) || 'Соперник';
      oppName = mpOppName;
      if (data.opp && typeof data.opp.trophies === 'number') mpOppTrophies = data.opp.trophies;
      vsDuration = data.duration || vsDuration || 120;
      if (typeof data.clockEndTs === 'number') window._matchClockEndTs = data.clockEndTs;
      vsTimeLeft = typeof data.vsTimeLeft === 'number' ? data.vsTimeLeft : vsDuration;
      score = 0; oppScore = 0;
      window._matchEnded = false;
      window._rankedDeltaApplied = false;
      try { closeRoomLobby(); } catch (_) {}
      try { setMpStatus(isLobby ? 'Матч начинается…' : 'Соперник найден!'); } catch (_) {}
      try {
        beginRoomRankedMatch(data);
      } catch (e) {
        console.warn('match_found start', e);
        try {
          showScreen('versus');
          vsActive = true;
        } catch (_) {}
      }
    } catch (e) { console.warn('match_found handler', e); }
  });
  MatchClient.on('state', (data) => {
    try {
      if (!data) return;
      // Periodic sync snapshots — soft + throttled inside applyRoomState
      data._fromSync = true;
      applyRoomState(data);
    } catch (e) { console.warn('state', e); }
  });
  MatchClient.on('rejoin_ok', (data) => {
    try {
      roomMatchMode = true;
      window._roomMatchMode = true;
      if (data && data.seat) MatchClient.seat = data.seat;
      if (data && data.matchId) MatchClient.matchId = data.matchId;
      if (data && data.token) MatchClient.token = data.token;
      mpMode = true;
      vsModeType = 'online';
      mode = 'versus';
      mpFromMatchmaking = (data && data.source !== 'lobby');
      mpGameSource = (data && data.source === 'lobby') ? 'lobby' : 'ranked';
      window._matchEnded = false;
      window._rejoinLoading = false;
      window._rejoinInputLock = false;
      placingLock = false;
      try { document.body.classList.remove('rejoin-loading'); } catch (_) {}
      try {
        // Prefer full state apply (keeps hands)
        if (typeof applyRoomState === 'function') applyRoomState(data);
        beginRoomRankedMatch(data);
      } catch (e) {
        console.warn('rejoin begin', e);
      }
      // If hand still empty, ask server for deal/state
      try {
        if (!pieces || !pieces.length || pieces.every(p => p && p.used)) {
          MatchClient.deal({});
        }
        MatchClient.sync({});
      } catch (_) {}
      try {
        const area = document.getElementById('piecesAreaVs');
        if (area && typeof renderPieces === 'function') renderPieces(area);
        if (typeof renderOppPieces === 'function') renderOppPieces();
      } catch (_) {}
      // Do NOT noteMyAction — AFK continues until real place
      // Rejoiner must NOT see "opponent offline" — only the side that stayed online should
      try {
        clearDisconnectTimer();
        oppDisconnected = false;
        hideBoardDisconnectOverlay();
        hideBoardDisconnectOverlay('me');
        hideBoardDisconnectOverlay('opp');
        hideDisconnectBanner();
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
      window._roomMatchMode = true;
      vsActive = true;
      // Moves prove opponent is online — kill DC overlay
      try {
        oppDisconnected = false;
        clearDisconnectTimer();
        hideBoardDisconnectOverlay();
      } catch (_) {}
      try { noteOppAction && noteOppAction(); } catch (_) {}
      // Scores / my board / hands only — DO NOT apply oppGrid yet.
      // applyOppRemotePlace paints the piece then clearLinesOn; if we pre-load
      // the already-cleared server grid, re-placing the piece leaves stuck blocks.
      applyRoomState({
        meScore: data.meScore,
        meGrid: data.meGrid,
        mePieces: data.mePieces,
        oppScore: data.score,
        oppPieces: data.pieces,
        vsTimeLeft: data.vsTimeLeft,
        clockEndTs: data.clockEndTs
      });
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
    } catch (e) { console.warn('opp_deal', e); }
  });
  MatchClient.on('place_ok', (data) => {
    try {
      if (!roomMatchMode && !window._roomMatchMode) return;
      try { noteMyAction && noteMyAction(); } catch (_) {}
      // Local already painted optimistically — soft-correct only, never hard wipe hands while dragging
      applyRoomState({
        score: data.score,
        grid: data.grid,
        pieces: data.pieces,
        deal: data.deal,
        oppScore: data.oppScore,
        oppGrid: data.oppGrid,
        oppPieces: data.oppPieces,
        vsTimeLeft: data.vsTimeLeft,
        clockEndTs: data.clockEndTs
      });
      // Force FULL board paint after place_ok — soft path left painted cells after line clears
      try {
        if (Array.isArray(data.grid)) {
          grid = data.grid.map(row => (row || []).slice());
          const b = (typeof boardMe !== 'undefined' && boardMe) ? boardMe : document.getElementById('boardMe');
          if (b && typeof renderGrid === 'function') renderGrid(grid, b);
        }
        if (Array.isArray(data.oppGrid)) {
          oppGrid = data.oppGrid.map(row => (row || []).slice());
          const bo = (typeof boardOpp !== 'undefined' && boardOpp) ? boardOpp : document.getElementById('boardOpp');
          if (bo && typeof renderGrid === 'function') renderGrid(oppGrid, bo);
        }
      } catch (_) {}
      try { window._lastRoomApplyAt = Date.now(); } catch (_) {}
    } catch (e) { console.warn('place_ok', e); }
  });
  MatchClient.on('place_reject', (data) => {
    try {
      if (!roomMatchMode) return;
      console.warn('place_reject', data && data.reason);
      applyRoomState({
        score: data.score,
        grid: data.grid,
        pieces: data.pieces,
        vsTimeLeft: data.vsTimeLeft,
        clockEndTs: data.clockEndTs
      });
      placingLock = false;
    } catch (e) { console.warn('place_reject', e); }
  });
  MatchClient.on('deal', (data) => {
    try {
      if (!roomMatchMode && !window._roomMatchMode) return;
      if (!Array.isArray(data.pieces)) return;
      try { unlockRoomPlay(); } catch (_) {}
      pieces = data.pieces.map(p => ({
        shape: (p.shape || []).map(c => c.slice()),
        color: p.color,
        used: !!p.used
      }));
      try {
        const area = document.getElementById('piecesAreaVs');
        if (area && typeof renderPieces === 'function') renderPieces(area);
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
      window._roomMatchMode = true;
      const mySeat = MatchClient.seat || null;
      const isOpp = mySeat ? (data.seat && data.seat !== mySeat) : !!data.seat;
      const isMe = mySeat ? (data.seat === mySeat) : false;

      if (data.online) {
        if (isOpp || !mySeat) {
          // Opponent came back online
          try { clearDisconnectTimer(); } catch (_) {}
          oppDisconnected = false;
          dcDeadlineTs = 0;
          dcPausedByReconnect = false;
          try { hideBoardDisconnectOverlay('opp'); } catch (_) {}
          try { hideBoardDisconnectOverlay(); } catch (_) {}
          try { hideDisconnectBanner(); } catch (_) {}
        }
        if (isMe) {
          // Our own seat online (e.g. after rejoin echo) — never mark opponent offline
          try { hideBoardDisconnectOverlay('me'); } catch (_) {}
        }
        try {
          document.querySelectorAll('.board-dc-overlay').forEach(el => {
            if (isOpp || !mySeat) {
              el.classList.remove('show');
              el.style.display = 'none';
            }
          });
        } catch (_) {}
      } else if (isOpp) {
        // ONLY show offline overlay when the OFFLINE seat is the opponent — never when we ourselves dropped
        const rem = (typeof data.dcRemaining === 'number')
          ? data.dcRemaining
          : (data.dcDeadlineTs ? Math.max(0, Math.ceil((data.dcDeadlineTs - Date.now()) / 1000)) : 0);
        oppDisconnected = true;
        dcDeadlineTs = data.dcDeadlineTs || (rem > 0 ? Date.now() + rem * 1000 : 0);
        try {
          if (typeof showBoardDisconnectOverlay === 'function') {
            showBoardDisconnectOverlay(rem, 'opp');
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
              try { showBoardDisconnectOverlay(left, 'opp'); } catch (_) {}
            }, 500);
          }
        } catch (_) {}
      } else if (isMe) {
        // We went offline on server — do NOT put "opponent offline" on our screen
        try { hideBoardDisconnectOverlay('opp'); } catch (_) {}
        oppDisconnected = false;
      }
    } catch (e) { console.warn('player_status', e); }
  });
  MatchClient.on('clock', (data) => {
    try {
      // Authoritative end timestamp only — avoids timer jump from vsTimeLeft alone
      if (typeof data.clockEndTs === 'number' && data.clockEndTs > 0) {
        window._matchClockEndTs = data.clockEndTs;
        vsTimeLeft = Math.max(0, Math.ceil((data.clockEndTs - Date.now()) / 1000));
      } else if (typeof data.vsTimeLeft === 'number') {
        vsTimeLeft = data.vsTimeLeft | 0;
        window._matchClockEndTs = Date.now() + vsTimeLeft * 1000;
      }
      try { updateTimerDisplay && updateTimerDisplay(); } catch (_) {}
      try { ensureMatchClockRunning && ensureMatchClockRunning(); } catch (_) {}
    } catch (_) {}
  });
  MatchClient.on('afk_warn', (data) => {
    try {
      if (!roomMatchMode && !window._roomMatchMode) return;
      const mySeat = MatchClient.seat;
      const rem = (data && data.remaining) | 0;
      if (data.seat && mySeat && data.seat === mySeat) {
        try { showDisconnectBanner(rem, 'afk-me'); } catch (_) {}
      } else {
        try { showDisconnectBanner(rem, 'afk'); } catch (_) {}
      }
    } catch (e) { console.warn('afk_warn', e); }
  });
  MatchClient.on('match_end', (data) => {
    try {
      roomMatchMode = false;
      window._roomMatchMode = false;
      if (window._matchEnded) return;
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
      try {
        endVersus({
          forceWin: forceWin || undefined,
          forceLoss: forceLoss || undefined,
          reason: reason,
          quiet: reason === 'forfeit' ? false : false
        });
      } catch (e) { console.warn('match_end endVersus', e); }
    } catch (e) { console.warn('match_end', e); }
  });

  MatchClient.on('rematch_invite', (data) => {
    try {
      rematchTheyWant = true;
      pendingRematchOfferName = (data && data.from) || 'Соперник';
      if (data && data.matchId) MatchClient.matchId = data.matchId;
      try { showRematchOffer && showRematchOffer(pendingRematchOfferName); } catch (_) {}
      try { showInfoToast('Реванш', (pendingRematchOfferName || 'Соперник') + ' хочет реванш', 'ok'); } catch (_) {}
      // Auto-accept if we already clicked rematch
      if (rematchIWant) {
        try { MatchClient.rematchAccept(); } catch (_) {}
      }
    } catch (e) { console.warn('rematch_invite', e); }
  });
  MatchClient.on('rematch_wait', () => {
    try {
      rematchPending = true;
      try { showRematchWait && showRematchWait(); } catch (_) {}
    } catch (_) {}
  });
  MatchClient.on('rematch_decline', (data) => {
    try {
      rematchIWant = false;
      rematchTheyWant = false;
      rematchPending = false;
      try { hideRematchOffer(); } catch (_) {}
      try { hideRematchWait(); } catch (_) {}
      if (!(data && data.self)) {
        try { showInfoToast('Реванш', 'Соперник отклонил', 'bad'); } catch (_) {}
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
      if (!(roomMatchMode || window._roomMatchMode)) return;
      if (!vsActive || window._matchEnded) return;
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


function beginRoomRankedMatch(data) {
  try {
    try { unlockRoomPlay(); } catch (_) {}
    roomMatchMode = true;
    window._roomMatchMode = true;
    mpMode = true; // treat as online for scoring UI
    vsModeType = 'online';
    mode = 'versus';
    vsActive = true;
    mpFromMatchmaking = true;
    mpGameSource = 'ranked';
    placingLock = false;
    window._matchHadAnyPlace = false;
    try { window._matchEnded = false; } catch (_) {}
    score = (data && data.me && typeof data.me.score === 'number') ? (data.me.score | 0) : 0;
    oppScore = (data && data.opp && typeof data.opp.score === 'number') ? (data.opp.score | 0) : 0;
    grid = (data && data.me && Array.isArray(data.me.grid))
      ? data.me.grid.map(row => row.slice())
      : Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    oppGrid = (data && data.opp && Array.isArray(data.opp.grid))
      ? data.opp.grid.map(row => row.slice())
      : Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    // Authoritative hands from server — never wipe to [] on missing field
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
    if (typeof data.clockEndTs === 'number' && data.clockEndTs > 0) {
      window._matchClockEndTs = data.clockEndTs;
      vsTimeLeft = Math.max(0, Math.ceil((data.clockEndTs - Date.now()) / 1000));
    } else if (typeof data.vsTimeLeft === 'number') {
      vsTimeLeft = data.vsTimeLeft | 0;
      window._matchClockEndTs = Date.now() + vsTimeLeft * 1000;
    }
    if (data.duration) vsDuration = data.duration;
    if (data.opp && data.opp.name) {
      mpOppName = data.opp.name;
      oppName = mpOppName;
    }
    showScreen('versus');
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
      if (area && typeof renderPieces === 'function') renderPieces(area);
      if (typeof renderOppPieces === 'function') renderOppPieces();
    } catch (_) {}
    try {
      if (typeof startMatchWallClock === 'function') startMatchWallClock();
      else if (typeof ensureMatchClockRunning === 'function') ensureMatchClockRunning();
    } catch (_) {}
    try { startAfkWatch && startAfkWatch(); } catch (_) {}
    try { updateTimerDisplay && updateTimerDisplay(); } catch (_) {}
    try {
      document.getElementById('myScore').textContent = String(score);
      document.getElementById('oppScore').textContent = String(oppScore);
    } catch (_) {}
    // Soft sync — server ignores client scores and returns snapshot
    try {
      if (typeof MatchClient !== 'undefined') {
        MatchClient.sync({});
      }
    } catch (_) {}
  } catch (e) {
    console.warn('beginRoomRankedMatch', e);
  }
}


let _privateLobbyHandlersBound = false;
