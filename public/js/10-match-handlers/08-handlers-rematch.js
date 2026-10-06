/**
 * Block Puzzle — js/10-match-handlers/08-handlers-rematch.js
 * MatchClient events: rematch flow and rejoin_fail.
 * Called from bindMatchClientHandlers() (01-bind-match-client.js).
 */
function bindRematchHandlers() {
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
      rematchIWant = false;
      rematchTheyWant = false;
      rematchPending = false;
      try { if (typeof clearRmPending === 'function') clearRmPending(); } catch (_) {}
      try { hideRematchOffer(); } catch (_) {}
      try { hideRematchWait(); } catch (_) {}
      try { hideRmToast(false); } catch (_) {}
      // Clear rematch UI; only re-show result if still on versus (no forced jump)
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
