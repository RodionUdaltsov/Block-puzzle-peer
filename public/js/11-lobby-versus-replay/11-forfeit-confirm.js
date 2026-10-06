/**
 * Block Puzzle — js/11-lobby-versus-replay/11-forfeit-confirm.js
 * Forfeit confirm.
 * Shares the client bundle scope (order: public/js/modules.json).
 */
let forfeitLock = false;
function openForfeitConfirm() {
  if (!vsActive || forfeitLock) return;
  try {
    if (settings && settings.confirmForfeit === '0') {
      confirmForfeit();
      return;
    }
  } catch (_) {}
  const el = document.getElementById('forfeitConfirm');
  if (el) el.classList.add('visible');
}
function closeForfeitConfirm() {
  const el = document.getElementById('forfeitConfirm');
  if (el) el.classList.remove('visible');
}
function confirmForfeit() {
  if (!vsActive || forfeitLock) return;
  closeForfeitConfirm();
  forfeitLock = true;
  const flag = document.getElementById('flagBreak');
  const btn = document.getElementById('btnForfeit');
  if (btn) {
    btn.style.visibility = 'hidden';
    btn.disabled = true;
  }
  if (flag) {
    flag.classList.remove('play');
    void flag.offsetWidth;
    flag.classList.add('play');
  }
  // Room mode: server ends match and notifies opponent with match_end
  try {
    if ((roomMatchMode || BPState.roomMatchMode) && typeof MatchClient !== 'undefined') {
      MatchClient.forfeit();
    }
  } catch (_) {}
  // Legacy server path for non-room matches
  try {
    if (!(roomMatchMode || BPState.roomMatchMode) && mpMode) {
      try {
        try { if (typeof MatchClient !== 'undefined') MatchClient.forfeit(); } catch (_) {}
      } catch (_) {}
    }
  } catch (_) {}
  setTimeout(() => {
    // Local loss UI (server match_end may also fire — endVersus is idempotent via _matchEnded)
    try {
      if (!BPState.matchEnded) {
        endVersus({ forceLoss: true, reason: 'forfeit' });
      }
    } catch (_) {}
    forfeitLock = false;
    if (btn) {
      btn.style.visibility = '';
      btn.disabled = false;
    }
    if (flag) flag.classList.remove('play');
  }, 900);
}
document.getElementById('btnForfeit')?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  openForfeitConfirm();
});
document.getElementById('btnForfeitYes')?.addEventListener('click', (e) => {
  e.preventDefault();
  confirmForfeit();
});
document.getElementById('btnForfeitNo')?.addEventListener('click', (e) => {
  e.preventDefault();
  closeForfeitConfirm();
});
document.getElementById('btnVsRematch')?.addEventListener('click', () => {
  requestRematch();
});
document.getElementById('btnVsAgain')?.addEventListener('click', () => {
  // «Ещё матч» / «Другой бот»: new opponent — not same-bot rematch
  try { dismissPostMatchResult(); } catch (_) {
    try { document.getElementById('versusResult').classList.remove('visible'); } catch (_) {}
    try { document.getElementById('reviewBar').classList.remove('visible'); } catch (_) {}
  }
  hideRematchOffer();
  hideRematchWait();
  rematchIWant = false;
  rematchTheyWant = false;
  pendingRematchOfferName = null;
  pendingJoinAfterForfeit = null;
  // Ranked «Ещё матч»: new opponent search (not same-opponent rematch).
  // Use durable signals — after session teardown / false abort, mpFromMatchmaking &
  // mpGameSource are often cleared; lastMatchResult / _lastMatchWasRanked must still win.
  const wantRankedAgain = !!(
    window._lastMatchWasRanked
    || mpGameSource === 'ranked'
    || (lastMatchResult && lastMatchResult.ranked)
    || (lastMatchResult && lastMatchResult.mode === 'online')
    || (mpMode && mpFromMatchmaking)
  );
  if (wantRankedAgain) {
    // startOnlineMatchmaking() performs the single authoritative teardown.
    vsModeType = 'online';
    mpFromMatchmaking = true;
    mpGameSource = 'ranked';
    try { BPState.leftForRankedSearch = 0; } catch (_) {}
    startOnlineMatchmaking();
    return;
  }
  if (mpMode && vsModeType === 'online') {
    try { destroyMp(); } catch (_) {}
    showScreen('menu');
    return;
  }
  // Bot path: pick another bot
  try { destroyMp(); } catch (_) {}
  mpMode = false;
  vsModeType = 'bots';
  renderBotList();
  showScreen('difficulty');
});
document.getElementById('btnVsMenu')?.addEventListener('click', () => {
  try { dismissPostMatchResult(); } catch (_) {
    try { document.getElementById('versusResult').classList.remove('visible'); } catch (_) {}
    try { document.getElementById('reviewBar').classList.remove('visible'); } catch (_) {}
  }
  hideRematchOffer();
  hideRematchWait();
  rematchIWant = false;
  // Keep rematchTheyWant / pending offer — opponent may still send invite while we are in menu
  // Do not clear pendingRematchOfferName if invite already queued
  const lobbyJoin = pendingJoinAfterForfeit;
  pendingJoinAfterForfeit = null;
  // Free server match binding so "create room" is never blocked by in_match.
  // Rematch invite can still arrive via presence/challenge path.
  try {
    if (typeof MatchClient !== 'undefined') {
      MatchClient._skipAutoRejoin = true;
      MatchClient.leaveMatch();
      MatchClient.freeMatch && MatchClient.freeMatch();
    }
  } catch (_) {}
  try { roomMatchMode = false; BPState.roomMatchMode = false; } catch (_) {}
  if (!vsActive && !lobbyJoin && !postMatchOnlineEligible) {
    try { destroyMp(); } catch (_) {}
  }
  showScreen('menu');
  updateMenuStats();
  // If rematch invite arrived during score duel / result, surface toast on menu
  try { tryShowPendingRematchOffer(); } catch (_) {}
  if (lobbyJoin && lobbyJoin.room) {
    setTimeout(() => {
      try { doAcceptChallengeJoin(lobbyJoin); } catch (_) {}
    }, 280);
  }
});
document.getElementById('btnVsReview')?.addEventListener('click', () => {
  const match = getMatchForPostResultReplay();
  if (!match) {
    try { showInfoToast('Повтор', 'Запись этого матча недоступна', 'bad'); } catch (_) {}
    return;
  }
  startReplay(match, { from: 'result' });
});
