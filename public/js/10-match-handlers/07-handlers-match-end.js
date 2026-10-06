/**
 * Block Puzzle — js/10-match-handlers/07-handlers-match-end.js
 * MatchClient event: match_end.
 * Called from bindMatchClientHandlers() (01-bind-match-client.js).
 */
function bindMatchEndHandlers() {
  MatchClient.on('match_end', (data) => {
    try {
      try { if (typeof clearAfkUi === 'function') clearAfkUi(); } catch (_) {}
      try { if (typeof clearRmPending === 'function') clearRmPending(); } catch (_) {}
      // Match is over — never leave "Матч начинается" / loading flags stuck on Friends
      try { mpMatchStarting = false; } catch (_) {}
      try { mpLoading = false; } catch (_) {}
      try { vsIntroLock = false; } catch (_) {}
      try { BPState.matchAwaitingGo = false; } catch (_) {}
      try { BPState.matchIntroSeqRunning = false; } catch (_) {}
      try { if (typeof setMpStatus === 'function') setMpStatus(''); } catch (_) {}
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
}
