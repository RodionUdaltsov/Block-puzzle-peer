/**
 * Block Puzzle — js/10-match-handlers/06-handlers-status-clock.js
 * MatchClient events: stuck/player status, clock, AFK warnings.
 * Called from bindMatchClientHandlers() (01-bind-match-client.js).
 */
function bindMatchStatusHandlers() {
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
}
