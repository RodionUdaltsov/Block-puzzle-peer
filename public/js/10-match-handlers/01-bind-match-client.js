/**
 * Block Puzzle — js/10-match-handlers/01-bind-match-client.js
 * Entry point: binds all MatchClient WebSocket events once, then runs load-time bootstrapping.
 * Handlers live in 02..08-handlers-*.js (function declarations, hoisted in the bundle scope).
 */
function bindMatchClientHandlers() {
  if (typeof MatchClient === 'undefined') return;
  if (window._matchClientBound) return;
  window._matchClientBound = true;
  bindMatchStartHandlers();
  bindMatchStateHandlers();
  bindOpponentMoveHandlers();
  bindMyMoveHandlers();
  bindMatchStatusHandlers();
  bindMatchEndHandlers();
  bindRematchHandlers();
}
try { bindMatchClientHandlers(); } catch (_) {}
try { bindPrivateLobbyHandlers(); } catch (_) {}
try { ensureFriendPresence(); } catch (_) {}
setInterval(() => { try { ensureFriendPresence(); } catch (_) {} }, 45000);

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
